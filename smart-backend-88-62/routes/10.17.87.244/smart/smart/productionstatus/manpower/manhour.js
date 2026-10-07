// ==========================================
// API Router สำหรับระบบ Manpower / Man-Hour (MH Production Status)
// - บริหารจัดการข้อมูลการลงเวลาทำงานของพนักงาน (Attendance)
// - คำนวณสรุป Man-Hour, กะการทำงาน (Shift), สถานะ มา/ขาด/ลา
// - เชื่อมโยงข้อมูล Help OT และ Snapshot รายวัน
// ==========================================
const express = require('express');
const { pool_smart, pool_test, queryWithRetry, queryWithRetryPool1, queryWithRetryPool2, safeGetDate } = require('../../../../config.js');
const { readPersistentCache, removePersistentCache, writePersistentCache } = require('../../../../../../Utility/persistentCache.js');
const { invalidateMonth } = require('../../../../../../Utility/cacheManager.js');
const { createDailySnapshot, startSnapshotScheduler } = require('./snapshot.js');
const { requireAdmin } = require('./auth.js');
const { DAYS_ARRAY, buildFullSpreadsheetData, doesLineValueMatchGroup, getEffectiveRecordStatus, isOtherFactoryRecord, shouldCountAsAbsent, shouldCountAsPresent } = require('../../../../../../Utility/manpowerAggregation.js');
const { LINE_GROUPS, MACRO_PCN_GROUPS } = require('../../../../../../Utility/lineGroups.js');
const { fetchHelpSummaryData } = require('./help.js');

const router = express.Router();
// ระบบแคชในหน่วยความจำ (Memory Caches)
const manhourCache = new Map();
const manhourSummaryCache = new Map();
const departmentSummaryCache = new Map();
const calendarCache = new Map();
const deleteMonthCache = new Map();
const inFlightManhourPromises = new Map();
const inFlightSummaryPromises = new Map();
let versionCache = null;
let versionRefreshInFlight = false;
const calendarRefreshes = new Set();
const manhourRefreshes = new Set();
const MANHOUR_CACHE_TTL_MS = 30 * 1000;
const DELETE_MONTH_CACHE_TTL_MS = 10 * 1000;
const STATUS_TOOLTIP_CACHE_VERSION = 5;
const VERSION_CACHE_TTL_MS = 15 * 1000;
const CALENDAR_CACHE_TTL_MS = 5 * 60 * 1000;
const LINE_MAPPING_VERSION = 12;
const manhourEventClients = new Set();
let manhourNotifyClient = null;
let manhourNotifyTimer = null;
let manhourNotifyRetryTimer = null;
let manhourPollingTimer = null;
let manhourPollingFingerprint = null;
const pendingManhourChangeDates = new Set();
const dirtyManhourDates = new Set();
let dirtyManhourDatesLoaded = false;

startSnapshotScheduler().catch(err => {
  console.error('[manhour] Failed to start snapshot scheduler:', err.message);
});

startManhourChangeNotifier().catch(err => {
  console.error('[manhour] Failed to start change notifier:', err.message);
});

/**
 * โหลดรายการวันที่ข้อมูลมีการเปลี่ยนแปลง (Dirty Dates) จาก Persistent Cache
 */
async function loadDirtyManhourDates() {
  if (dirtyManhourDatesLoaded) return;
  const saved = await readPersistentCache('manhour-dirty-dates');
  (saved?.dates || []).forEach(date => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(date))) dirtyManhourDates.add(String(date));
  });
  dirtyManhourDatesLoaded = true;
}

/**
 * บันทึกรายการวันที่ข้อมูลเปลี่ยนแปลงลง Persistent Cache
 */
async function saveDirtyManhourDates() {
  await writePersistentCache('manhour-dirty-dates', { dates: [...dirtyManhourDates].sort() });
}

/**
 * เคลียร์แคชข้อมูล Man-Hour ทั้งหมด (ทั้ง Memory และ Persistent Cache)
 */
async function clearManhourDataCache() {
  manhourCache.clear();
  manhourSummaryCache.clear();
  deleteMonthCache.clear();
  versionCache = null;
  await Promise.all([
    removePersistentCache('manhour-version'),
    removePersistentCache('manhour-current-month'),
    removePersistentCache('manhour-summary-current-month'),
  ]);
  // ล้างไฟล์ persistent cache ของ summary และ manhour ทุกเดือนจาก .server-cache
  try {
    const fs = require('fs/promises');
    const path = require('path');
    const cacheDir = path.join(__dirname, '../../../../../../.server-cache');
    const legacyDir = path.join(__dirname, '../.server-cache');
    
    for (const dir of [cacheDir, legacyDir]) {
      const files = await fs.readdir(dir).catch(() => []);
      await Promise.all(
        files
          .filter(f => f.startsWith('manhour') || f.startsWith('version'))
          .map(f => fs.unlink(path.join(dir, f)).catch(() => {}))
      );
    }
  } catch {}
}

async function clearDeleteMonthCache(month) {
  if (!/^[0-9]{4}-[0-9]{2}$/.test(String(month || ''))) return;
  deleteMonthCache.delete(month);
  await removePersistentCache(`manhour-delete-month-${month}`);
}

async function invalidateManhourDates(dates = []) {
  const validDates = [...new Set(dates.map(date => String(date || '').slice(0, 10)).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)))];
  const months = [...new Set(validDates.map(date => date.slice(0, 7)))];
  versionCache = null;
  await removePersistentCache('manhour-version');
  await loadDirtyManhourDates();
  validDates.forEach(date => dirtyManhourDates.add(date));
  await saveDirtyManhourDates();
  
  // ล้างแคชรายเดือนและรายวันสำหรับเดือนที่มีการเปลี่ยนแปลงข้อมูล
  for (const key of manhourCache.keys()) {
    if (
      (key.startsWith('dates:') && validDates.some(date => key.includes(date))) ||
      months.some(m => key === `month:${m}`) ||
      key === 'current-month'
    ) {
      manhourCache.delete(key);
    }
  }
  for (const key of manhourSummaryCache.keys()) {
    if (months.some(m => key === `month:${m}`) || key === 'current-month') {
      manhourSummaryCache.delete(key);
    }
  }
  await Promise.all([
    ...months.map(clearDeleteMonthCache),
    ...months.map(m => removePersistentCache(`manhour-${m}`)),
    ...months.map(m => removePersistentCache(`manhour-summary-${m}`)),
    ...months.map(m => removePersistentCache(`version-${m}`)),
    ...months.map(m => invalidateMonth(m)),
  ]);
}

function applyDirectHelpSummary(spreadsheet, helpSummary) {
  if (!Array.isArray(helpSummary) || helpSummary.length === 0) return spreadsheet;
  const result = { ...spreadsheet };
  Object.keys(result).forEach(lineName => {
    const configuredLines = MACRO_PCN_GROUPS[lineName] || LINE_GROUPS[lineName] || [lineName];
    const acceptedLines = [...new Set([...configuredLines, lineName])];
    const lineData = Object.fromEntries(Object.entries(result[lineName]).map(([day, values]) => [day, {
      ...values, helpOutHrs: 0, helpInHrs: 0,
      manOT1HelpOut: 0, manOT1HelpIn: 0, manOT2HelpOut: 0, manOT2HelpIn: 0,
    }]));
    const helpPeople = Object.fromEntries(DAYS_ARRAY.map(day => [day, {
      ot1Out: new Set(), ot1In: new Set(), ot2Out: new Set(), ot2In: new Set(),
    }]));
    helpSummary.forEach(item => {
      const day = Number(String(item.date || '').slice(8, 10));
      if (!day || !lineData[day]) return;
      const hour = Number(item.hour) || 0;
      const sourceMatches = doesLineValueMatchGroup(item.line_out, acceptedLines);
      const destinationMatches = doesLineValueMatchGroup(item.line_in, acceptedLines);
      const isMacroPcnTotal = lineName === 'Macro PCN';
      const countsAsHelpOut = isMacroPcnTotal
        ? Boolean(String(item.line_out || '').trim())
        : sourceMatches;
      const countsAsHelpIn = isMacroPcnTotal
        ? Boolean(String(item.line_in || '').trim())
        : destinationMatches;
      // The Macro PCN total still has two distinct directions.  Do not count a
      // help record as both out and in merely because it is a total row.
      if (!countsAsHelpOut && !countsAsHelpIn) return;
      lineData[day].helpOutHrs += countsAsHelpOut ? hour : 0;
      lineData[day].helpInHrs += countsAsHelpIn ? hour : 0;
      if (countsAsHelpOut) {
        (item.ot1_employee_ids || []).forEach(id => helpPeople[day].ot1Out.add(String(id)));
        (item.ot2_employee_ids || []).forEach(id => helpPeople[day].ot2Out.add(String(id)));
      }
      if (countsAsHelpIn) {
        (item.ot1_employee_ids || []).forEach(id => helpPeople[day].ot1In.add(String(id)));
        (item.ot2_employee_ids || []).forEach(id => helpPeople[day].ot2In.add(String(id)));
      }
    });
    DAYS_ARRAY.forEach(day => {
      lineData[day].manOT1HelpOut = helpPeople[day].ot1Out.size;
      lineData[day].manOT1HelpIn = helpPeople[day].ot1In.size;
      lineData[day].manOT2HelpOut = helpPeople[day].ot2Out.size;
      lineData[day].manOT2HelpIn = helpPeople[day].ot2In.size;
    });
    result[lineName] = lineData;
  });
  return result;
}
function buildStatusTooltipData(records) {
  const buckets = new Map();
  records.forEach((record, index) => {
    if (isOtherFactoryRecord(record)) return;
    const day = Number(String(record.dlh_effective_date_time || '').slice(8, 10));
    if (!day) return;
    const line = String(record.line_check || record.line_out || record.line || record.department || '__UNMAPPED__').trim();
    const status = getEffectiveRecordStatus(record);
    const key = `${day}\u0000${line}\u0000${status}`;
    if (!buckets.has(key)) buckets.set(key, { present: new Set(), absent: new Set() });
    const bucket = buckets.get(key);
    const employeeId = String(record.dlh_employee_id || `row-${index}`).trim();
    if (shouldCountAsPresent(record)) bucket.present.add(employeeId);
    if (shouldCountAsAbsent(record, true)) bucket.absent.add(employeeId);
  });
  const result = {};
  buckets.forEach((bucket, key) => {
    const [day, line, status] = key.split('\u0000');
    result[day] ||= {};
    result[day][line] ||= {};
    result[day][line][status] = {
      present: bucket.present.size,
      absent: bucket.absent.size,
      count: bucket.present.size + bucket.absent.size,
    };
  });
  return result;
}

function broadcastManhourChange(dates = []) {
  const message = `event: change\ndata: ${JSON.stringify({ type: 'attendance', dates })}\n\n`;
  manhourEventClients.forEach(client => client.write(message));
}

const wait = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function refreshSnapshotsForChangedDates(dates) { // This internal fetch call also needs to be updated.
  for (const date of dates) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const result = await createDailySnapshot(date);
        if (!result?.skipped) break;
        await wait(500);
      } catch (error) {
        console.error(`[manhour/events] Snapshot refresh failed for ${date}:`, error.message);
        break;
      }
    }
  }
}

function scheduleManhourChange(date) {
  const dateKey = String(date || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) pendingManhourChangeDates.add(dateKey);
  clearTimeout(manhourNotifyTimer);
  manhourNotifyTimer = setTimeout(async () => {
    const dates = [...pendingManhourChangeDates];
    pendingManhourChangeDates.clear();
    try {
      await refreshSnapshotsForChangedDates(dates);
      await invalidateManhourDates(dates);
    } catch (error) {
      console.error('[manhour/events] Cache clear failed:', error.message);
    }
    broadcastManhourChange(dates);
  }, 250);
}

function retryManhourChangeNotifier() {
  if (manhourNotifyRetryTimer) return;
  manhourNotifyRetryTimer = setTimeout(() => {
    manhourNotifyRetryTimer = null;
    startManhourChangeNotifier().catch(error => {
      console.error('[manhour/events] Reconnect failed:', error.message);
    });
  }, 5000);
}

async function startManhourChangeNotifier() {
  if (manhourPollingTimer) return;
  const poll = async () => {
    try {
      const { rows } = await pool_smart.query(`
        SELECT 
          LEFT(dlh_effective_date_time::text, 7) AS month,
          MAX(updated_date)::text AS latest_update,
          COUNT(*)::bigint AS row_count
        FROM smart.smart_man_time_attendance
        WHERE dlh_effective_date_time IS NOT NULL
        GROUP BY LEFT(dlh_effective_date_time::text, 7)
      `);
      
      const currentMap = new Map();
      (rows || []).forEach(r => {
        if (r.month && /^\d{4}-\d{2}$/.test(r.month)) {
          currentMap.set(r.month, `${r.latest_update || ''}:${r.row_count || 0}`);
        }
      });

      if (manhourPollingFingerprint === null) {
        manhourPollingFingerprint = currentMap;
        return;
      }

      const previousMap = manhourPollingFingerprint instanceof Map ? manhourPollingFingerprint : new Map();
      const changedMonths = [];

      // Check for updated or added months
      currentMap.forEach((fp, m) => {
        if (previousMap.get(m) !== fp) {
          changedMonths.push(m);
        }
      });
      // Check for removed months
      previousMap.forEach((_, m) => {
        if (!currentMap.has(m)) {
          changedMonths.push(m);
        }
      });

      manhourPollingFingerprint = currentMap;

      if (changedMonths.length > 0) {
        console.info(`[manhour/polling] Detected DB changes in month(s): ${changedMonths.join(', ')}`);
        // Find specific changed work dates in these months
        const datesRes = await pool_smart.query(`
          SELECT DISTINCT dlh_effective_date_time::date as work_date
          FROM smart.smart_man_time_attendance
          WHERE LEFT(dlh_effective_date_time::text, 7) = ANY($1::text[])
        `, [changedMonths]).catch(() => ({ rows: [] }));

        const dates = (datesRes.rows || []).map(r => {
          const d = r.work_date;
          return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
        }).filter(Boolean);

        if (dates.length > 0) {
          dates.forEach(d => scheduleManhourChange(d));
        } else {
          // If records were altered/deleted, invalidate the months directly
          await Promise.all([
            ...changedMonths.map(m => invalidateManhourDates([`${m}-01`])),
            ...changedMonths.map(m => removePersistentCache(`manhour-${m}`)),
            ...changedMonths.map(m => removePersistentCache(`manhour-summary-${m}`)),
            ...changedMonths.map(m => removePersistentCache(`dept_summary_${m}`)),
          ]);
          broadcastManhourChange([]);
        }
      }
    } catch (error) {
      console.error('[manhour/polling] Attendance check failed:', error.message);
    }
  };
  await poll();
  manhourPollingTimer = setInterval(poll, 15000);
  console.log('[manhour/events] Polling attendance changes across all months every 15 seconds.');
}

async function createImportSnapshots(dates) {
  const results = [];
  for (const date of dates) {
    try {
      results.push({ date, ...(await createDailySnapshot(date)) });
    } catch (error) {
      console.error(`[manhour/import] Snapshot failed for ${date}:`, error.message);
      results.push({ date, ok: false, error: error.message || 'Snapshot failed' });
    }
  }
  return results;
}

function buildCostCenterLineMap(rows) {
  const map = new Map();
  rows.forEach(row => {
    const costCenter = String(row.cost_center_name || '').trim().toUpperCase();
    const lineOut = String(row.line_out || '').trim();
    if (!costCenter || !lineOut) return;
    const existing = map.get(costCenter);
    try {
      // Matches DAX MAX(line_out) when duplicate Cost Center rows exist.
      if (!existing || lineOut > existing) map.set(costCenter, lineOut);
    } catch (e) {}
  });
  return map;
}

const IMPORT_COLUMNS = [
  'dlh_employee_id',
  'dlh_effective_date_time',
  'work_day_status',
  'work_status',
  'scan_time_in',
  'scan_time_out'
];

router.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  manhourEventClients.add(res);
  req.on('close', () => manhourEventClients.delete(res));
});

router.get('/version', async (req, res) => {
  const requestedMonth = /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(String(req.query.month || '')) ? String(req.query.month) : null;
  const bangkokCurrentMonth = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', timeZone: 'Asia/Bangkok',
  }).format(new Date());
  const month = requestedMonth || bangkokCurrentMonth;
  const cacheKey = requestedMonth ? `version-${requestedMonth}` : 'manhour-version';

  let cached = versionCache && (!requestedMonth || versionCache.data?.month === requestedMonth) ? versionCache : null;
  if (!cached) cached = await readPersistentCache(cacheKey);

  if (cached && req.query.refresh !== '1' && Date.now() - cached.savedAt < VERSION_CACHE_TTL_MS) {
    res.set('X-Data-Cache', 'HIT');
    return res.status(200).json(cached.data);
  }
  if (cached && req.query.refresh !== '1') {
    res.set('X-Data-Cache', 'STALE-WHILE-REVALIDATE');
    if (!versionRefreshInFlight) {
      versionRefreshInFlight = true;
      setImmediate(() => {
        const queryParams = new URLSearchParams();
        queryParams.append('refresh', '1');
        if (requestedMonth) queryParams.append('month', requestedMonth);
        fetch(`http://127.0.0.1:${process.env.PORT || 8085}/api_p1/production_status/mh/manhour/version?${queryParams.toString()}`)
          .catch(error => console.error('[manhour/version] Background refresh failed:', error.message))
          .finally(() => { versionRefreshInFlight = false; });
      });
    }
    return res.status(200).json(cached.data);
  }
  try {
    const [result, helpVersionRows, snapshotVersionRows] = await Promise.all([queryWithRetry(`
      SELECT
        a.dlh_effective_date_time::date::text AS work_date,
        COUNT(*)::bigint AS row_count,
        COALESCE(MAX(a.scan_time_in)::text, '') AS max_scan_in,
        COALESCE(MAX(a.scan_time_out)::text, '') AS max_scan_out,
        COALESCE(MAX(a.updated_date)::text, '') AS max_updated,
        COALESCE(SUM(hashtext(CONCAT_WS('|',
          a.dlh_employee_id, a.work_day_status, a.work_status,
          a.scan_time_in::text, a.scan_time_out::text, a.updated_date::text
        ))::bigint), 0)::text AS checksum
      FROM smart.smart_man_time_attendance a
      INNER JOIN (
        SELECT dlh_effective_date_time::date AS work_date, MAX(updated_date) AS max_updated_date
        FROM smart.smart_man_time_attendance
        WHERE dlh_effective_date_time >= $1
          AND dlh_effective_date_time < ($1::date + INTERVAL '1 month')::text
        GROUP BY dlh_effective_date_time::date
      ) latest ON a.dlh_effective_date_time::date = latest.work_date
             AND a.updated_date = latest.max_updated_date
      WHERE a.dlh_effective_date_time >= $1
        AND a.dlh_effective_date_time < ($1::date + INTERVAL '1 month')::text
        AND a.dlh_employee_id IS NOT NULL
        AND TRIM(a.dlh_employee_id) != ''
      GROUP BY a.dlh_effective_date_time::date
      ORDER BY work_date
    `, [`${month}-01`]).catch(error => {
      console.warn('[manhour/version] Attendance version unavailable:', error.message);
      return { rows: [] };
    }), queryWithRetryPool1(`
      SELECT DATE_FORMAT(date_w, '%Y-%m-%d') AS work_date,
             COUNT(*) AS row_count,
             COALESCE(SUM(hour), 0) AS total_hour,
             COALESCE(SUM(CRC32(CONCAT_WS('|', line_in, line_out, cost_center, hour, shift, type))), 0) AS checksum
      FROM tbl_help
      WHERE date_w >= ?
        AND date_w < DATE_ADD(?, INTERVAL 1 MONTH)
        AND LOWER(TRIM(COALESCE(case_h, ''))) <> 'training'
      GROUP BY DATE_FORMAT(date_w, '%Y-%m-%d')
    `, [`${month}-01`, `${month}-01`]).catch(error => {
      console.warn('[manhour/version] Help version unavailable:', error.message);
      return [];
    }), queryWithRetryPool2(`
      SELECT to_char(work_date, 'YYYY-MM-DD') AS work_date,
             COUNT(*)::int AS row_count,
             COALESCE(MD5(STRING_AGG(
               CONCAT_WS('|', employee_id, name, sect,
               department, dept, employee_shift, line),
               '||' ORDER BY employee_id, work_date
             )), '') AS checksum
      FROM tbl_manhour_snapshot
      WHERE work_date >= $1::date
        AND work_date < ($1::date + INTERVAL '1 month')
      GROUP BY work_date
    `, [`${month}-01`]).catch(error => {
      console.warn('[manhour/version] Snapshot checksum unavailable:', error.message);
      return [];
    })]);
    const attendanceRows = Array.isArray(result) ? result : (result?.rows || []);
    const days = Object.fromEntries(attendanceRows.map(row => [
      row.work_date,
      [row.row_count || 0, row.max_scan_in || '', row.max_scan_out || '', row.checksum || 0, row.max_updated || ''].join(':'),
    ]));
    (Array.isArray(helpVersionRows) ? helpVersionRows : []).forEach(row => {
      const date = String(row.work_date || '').slice(0, 10);
      if (!date) return;
      const attendanceVersion = days[date] || '0::';
      days[date] = `${attendanceVersion}:help:${row.row_count || 0}:${row.total_hour || 0}:${row.checksum || 0}`;
    });
    (Array.isArray(snapshotVersionRows) ? snapshotVersionRows : []).forEach(row => {
      const date = String(row.work_date || '').slice(0, 10);
      if (!date) return;
      days[date] = `${days[date] || '0:::0'}:snapshot:${row.row_count || 0}:${row.checksum || 0}`;
    });
    Object.keys(days).forEach(date => {
      days[date] = `${days[date]}:line-map:${LINE_MAPPING_VERSION}`;
    });
    const rowCount = attendanceRows.reduce((sum, row) => sum + Number(row.row_count || 0), 0);
    const payload = { month, days, rowCount };
    versionCache = { savedAt: Date.now(), data: payload };
    writePersistentCache('manhour-version', versionCache)
      .catch(error => console.error('[manhour/version] Save failed:', error.message));
    res.set('X-Data-Cache', 'MISS');
    return res.status(200).json(payload);
  } catch (error) {
    console.error('[manhour/version]', error);
    if (versionCache) {
      res.set('X-Data-Cache', 'STALE');
      return res.status(200).json(versionCache.data);
    }
    return res.status(500).json({ error: 'Unable to read Man-Hour version', errorMessage: error.message });
  }
});

router.get('/calendar', async (req, res) => {
  const bangkokMonth = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', timeZone: 'Asia/Bangkok',
  }).format(new Date());
  const month = String(req.query.month || bangkokMonth);
  if (!/^[0-9]{4}-[0-9]{2}$/.test(month)) {
    return res.status(400).json({ error: 'month must use YYYY-MM format' });
  }
  let cachedCalendar = calendarCache.get(month);
  if (!cachedCalendar) {
    cachedCalendar = await readPersistentCache(`manhour-calendar-v2-${month}`);
    if (!cachedCalendar) {
      const legacyCalendar = await readPersistentCache(`manhour-calendar-${month}`);
      if (legacyCalendar?.data) {
        const dateFormatter = new Intl.DateTimeFormat('en-CA', {
          year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Bangkok',
        });
        cachedCalendar = {
          savedAt: Date.now(),
          data: legacyCalendar.data.map(item => ({
            ...item,
            date: dateFormatter.format(new Date(item.date)),
          })),
        };
        writePersistentCache(`manhour-calendar-v2-${month}`, cachedCalendar)
          .catch(error => console.error('[manhour/calendar] Migration save failed:', error.message));
      }
    }
    if (cachedCalendar) calendarCache.set(month, cachedCalendar);
  }
  if (cachedCalendar && Date.now() - cachedCalendar.savedAt < CALENDAR_CACHE_TTL_MS) {
    res.set('X-Data-Cache', 'HIT');
    return res.status(200).json(cachedCalendar.data);
  }
  if (cachedCalendar && req.query.refresh !== '1') {
    res.set('X-Data-Cache', 'STALE-WHILE-REVALIDATE');
    if (!calendarRefreshes.has(month)) {
      calendarRefreshes.add(month);
      setImmediate(() => {
        fetch(`http://127.0.0.1:${process.env.PORT || 8085}/api_p1/production_status/mh/manhour/calendar?month=${month}&refresh=1`)
          .catch(error => console.error('[manhour/calendar] Background refresh failed:', error.message))
          .finally(() => calendarRefreshes.delete(month));
      });
    }
    return res.status(200).json(cachedCalendar.data);
  }

  try {
    const rows = await queryWithRetryPool1(`
      SELECT DATE_FORMAT(work_date, '%Y-%m-%d') AS w_date,
             CASE
               WHEN MAX(CASE WHEN LOWER(TRIM(COALESCE(w_result, ''))) = 'holiday' THEN 1 ELSE 0 END) = 1
                 THEN 'Holiday'
               ELSE MAX(COALESCE(w_result, ''))
             END AS w_result
      FROM (
        SELECT
          CASE
            WHEN CAST(w_date AS CHAR) REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN
              CASE
                WHEN YEAR(STR_TO_DATE(CAST(w_date AS CHAR), '%d/%m/%Y')) > 2400
                  THEN DATE_SUB(STR_TO_DATE(CAST(w_date AS CHAR), '%d/%m/%Y'), INTERVAL 543 YEAR)
                ELSE STR_TO_DATE(CAST(w_date AS CHAR), '%d/%m/%Y')
              END
            ELSE DATE(w_date)
          END AS work_date,
          w_result
        FROM tbl_date
      ) calendar_source
      WHERE work_date >= ?
        AND work_date < DATE_ADD(?, INTERVAL 1 MONTH)
      GROUP BY work_date
      ORDER BY work_date
    `, [`${month}-01`, `${month}-01`]);
    const calendar = rows.map(row => ({
      date: row.w_date,
      result: row.w_result || '',
      manhour: String(row.w_result || '').trim().toLowerCase() === 'holiday' ? 0 : 1,
    }));

    const nextCalendarCache = { savedAt: Date.now(), data: calendar };
    calendarCache.set(month, nextCalendarCache);
    writePersistentCache(`manhour-calendar-v2-${month}`, nextCalendarCache)
      .catch(error => console.error('[manhour/calendar] Save failed:', error.message));
    res.set('X-Data-Cache', 'MISS');
    return res.status(200).json(calendar);
  } catch (error) {
    console.error('[manhour/calendar]', error);
    if (cachedCalendar) {
      res.set('X-Data-Cache', 'STALE');
      return res.status(200).json(cachedCalendar.data);
    }
    return res.status(500).json({ error: 'Unable to load Man-Hour calendar', errorMessage: error.message });
  }
});

/**
 * ฟังก์ชันดึงรายการประวัติการลงเวลาทำงานของพนักงานตามวัน (YYYY-MM-DD) หรือทั้งเดือน (YYYY-MM)
 * - ดึงการสแกนเวลาล่าสุดจาก smart.smart_man_time_attendance
 * - ผสานข้อมูลย้อนหลังจาก Snapshot (tbl_manhour_snapshot)
 * - รวมข้อมูลพนักงาน (tbl_employee_help เป็น Master หลัก ร่วมกับ tbl_employee สำหรับ status), กะการทำงาน (Shift), Line/Cost Center และสถานะการยืมตัว (Loan Exclude)
 */
async function handleGetImportRecords(req, res) {
  const date = String(req.params.date || req.params.month || '');
  const isMonth = /^\d{4}-\d{2}$/.test(date);
  const isDay = /^\d{4}-\d{2}-\d{2}$/.test(date);
  if (!isMonth && !isDay) {
    return res.status(400).json({ error: 'date must use YYYY-MM-DD or YYYY-MM format' });
  }
  try {
    const queryDate = isMonth ? `${date}-01` : date;
    const result = isMonth
      ? await pool_smart.query(
          `SELECT a.dlh_employee_id, a.dlh_effective_date_time, a.work_day_status, a.work_status,
                  COALESCE(to_char(a.scan_time_in AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS'), a.scan_time_in::text) AS scan_time_in,
                  COALESCE(to_char(a.scan_time_out AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS'), a.scan_time_out::text) AS scan_time_out
           FROM smart.smart_man_time_attendance a
           INNER JOIN (
             SELECT t.dlh_effective_date_time, MAX(t.updated_date) AS max_updated_date
             FROM smart.smart_man_time_attendance t
             WHERE t.dlh_effective_date_time LIKE $1 || '%'
             GROUP BY t.dlh_effective_date_time
           ) latest ON a.dlh_effective_date_time = latest.dlh_effective_date_time
                   AND a.updated_date = latest.max_updated_date
           WHERE a.dlh_effective_date_time LIKE $1 || '%'
           ORDER BY a.dlh_effective_date_time DESC, a.dlh_employee_id`,
          [date]
        )
      : await pool_smart.query(
          `SELECT a.dlh_employee_id, a.dlh_effective_date_time, a.work_day_status, a.work_status,
                  COALESCE(to_char(a.scan_time_in AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS'), a.scan_time_in::text) AS scan_time_in,
                  COALESCE(to_char(a.scan_time_out AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS'), a.scan_time_out::text) AS scan_time_out
           FROM smart.smart_man_time_attendance a
           INNER JOIN (
             SELECT t.dlh_effective_date_time, MAX(t.updated_date) AS max_updated_date
             FROM smart.smart_man_time_attendance t
             WHERE t.dlh_effective_date_time LIKE $1 || '%'
             GROUP BY t.dlh_effective_date_time
           ) latest ON a.dlh_effective_date_time = latest.dlh_effective_date_time
                   AND a.updated_date = latest.max_updated_date
           WHERE a.dlh_effective_date_time LIKE $1 || '%'
              OR a.scan_time_in::text LIKE $1 || '%'
              OR a.scan_time_out::text LIKE $1 || '%'
           ORDER BY a.dlh_employee_id`,
          [date]
        );
    const attendanceRows = result.rows || [];
    const bangkokMonth = isMonth ? date : date.slice(0, 7);
    const snapshotWhere = isMonth
      ? 'WHERE work_date >= $1::date AND work_date < ($1::date + INTERVAL \'1 month\')'
      : 'WHERE work_date = $1::date';
    const snapshotParams = isMonth ? [`${date}-01`] : [date];

    const snapshotPromise = queryWithRetryPool2(`
      SELECT employee_id, work_date, effective_date_time, name, sect, department,
             dept, employee_shift, line
      FROM tbl_manhour_snapshot
      ${snapshotWhere}
    `, snapshotParams).catch(error => {
      if (error?.code === 'ER_NO_SUCH_TABLE') return [];
      console.warn('[manhour/import/day/list] Snapshot source unavailable:', error?.message || error);
      return [];
    });

    const [snapshotRows, directCcResult, indirectCcResult, loanRows, dateRows] = await Promise.all([
      snapshotPromise,
      queryWithRetryPool2('SELECT cost_center_name, line_out FROM public.cost_centers_direct').catch(() => []),
      queryWithRetryPool2('SELECT cost_center_name, line_out FROM public.cost_centers_indirect').catch(() => []),
      pool_test.query(
        `SELECT employee_id, destination, department
         FROM manpower_loan_exclude
         WHERE (is_active = true OR is_active::text = '1' OR is_active::text ILIKE 'true')
           AND start_date::date <= $1::date
           AND (end_date IS NULL OR end_date::date >= $1::date)`,
        [queryDate]
      ).then(r => r.rows || []).catch(err => {
        console.warn('[manhour/import/day/list] Unable to load manpower_loan_exclude:', err.message);
        return [];
      }),
      queryWithRetryPool1(`
        SELECT DATE_FORMAT(w_date, '%Y-%m-%d') AS work_date, w_s, w_w
        FROM tbl_date
        WHERE w_date >= ? AND w_date < DATE_ADD(?, INTERVAL 1 MONTH)
      `, [`${bangkokMonth}-01`, `${bangkokMonth}-01`]).catch(err => {
        console.warn('[manhour/import/day/list] Unable to load tbl_date:', err.message);
        return [];
      }),
    ]);

    const snapshotMap = new Map();
    (snapshotRows || []).forEach(snapshot => {
      const dParts = getEffectiveDateParts(snapshot.work_date);
      if (!dParts) return;
      const dKey = `${dParts.year}-${String(dParts.month).padStart(2, '0')}-${String(dParts.day).padStart(2, '0')}`;
      snapshotMap.set(`${String(snapshot.employee_id).trim()}_${dKey}`, snapshot);
    });

    // tbl_manhour_snapshot is used only as a metadata lookup (line, dept, sect, shift)
    // for employees present in smart_man_time_attendance. It does NOT create attendance records.
    const resolvedAttendanceRows = attendanceRows;
    const employeeIds = [...new Set(resolvedAttendanceRows.map(row => String(row.dlh_employee_id || '').trim()).filter(Boolean))];

    const [employeeRows, helperRows] = await Promise.all([
      employeeIds.length > 0
        ? queryWithRetryPool1(`
            SELECT h.code, h.name, h.department, h.dept, h.shift, h.line,
                   e.sect, e.process, COALESCE(e.status, 'Training Center') AS status
            FROM tbl_employee_help h
            LEFT JOIN tbl_employee e ON h.code = e.code
            WHERE h.code IN (${employeeIds.map(() => '?').join(',')})
          `, employeeIds.map(id => String(id).trim())).catch(error => {
          console.warn('[manhour/import/day/list] Unable to load employees from tbl_employee_help:', error.message);
          return [];
        })
        : Promise.resolve([]),
      queryWithRetryPool1('SELECT department, line FROM tbl_employee_help').catch(() => []),
    ]);

    const employeeMap = new Map();
    employeeRows.forEach(emp => {
      if (emp.code) employeeMap.set(String(emp.code).trim(), emp);
    });

    const helperLineByDepartment = new Map();
    helperRows.forEach(row => {
      const department = String(row.department || '').trim().toUpperCase();
      const line = String(row.line || '').trim();
      if (department && line) helperLineByDepartment.set(department, line);
    });

    const directCcRows = Array.isArray(directCcResult) ? directCcResult : (directCcResult?.rows || []);
    const indirectCcRows = Array.isArray(indirectCcResult) ? indirectCcResult : (indirectCcResult?.rows || []);
    const directCostCenterMap = buildCostCenterLineMap(directCcRows);
    const indirectCostCenterMap = buildCostCenterLineMap(indirectCcRows);

    const loanMap = new Map((loanRows || []).map(l => [String(l.employee_id || '').trim(), l]));

    const tblDateMap = new Map();
    (dateRows || []).forEach(dRow => {
      if (dRow.work_date) {
        const dKey = String(dRow.work_date).slice(0, 10);
        const shiftGroup = String(dRow.w_s || '').trim().toUpperCase();
        if (shiftGroup) {
          tblDateMap.set(`${dKey}_${shiftGroup}`, String(dRow.w_w || '').trim().toUpperCase());
        }
        tblDateMap.set(dKey, String(dRow.w_w || '').trim().toUpperCase());
      }
    });


    return res.status(200).json(resolvedAttendanceRows.map(row => {
      const empId = String(row.dlh_employee_id || '').trim();
      const dateParts = getEffectiveDateParts(row.dlh_effective_date_time);
      const effectiveDateKey = dateParts
        ? `${dateParts.year}-${String(dateParts.month).padStart(2, '0')}-${String(dateParts.day).padStart(2, '0')}`
        : '';
      const currentEmpInfo = employeeMap.get(empId) || {};
      const historicalEmpInfo = snapshotMap.get(`${empId}_${effectiveDateKey}`);
      const empInfo = {
        name: historicalEmpInfo?.name || currentEmpInfo.name || '',
        sect: historicalEmpInfo?.sect || currentEmpInfo.sect || '',
        department: historicalEmpInfo?.department || currentEmpInfo.department || '',
        dept: historicalEmpInfo?.dept || currentEmpInfo.dept || '',
        shift: historicalEmpInfo?.employee_shift || currentEmpInfo.shift || '',
        line: historicalEmpInfo?.line || currentEmpInfo.line || '',
        status: currentEmpInfo.status || 'Training Center',
      };

      const empDepartment = String(empInfo.department || '').trim();
      const costCenterKey = empDepartment.toUpperCase();
      let baseLine =
        directCostCenterMap.get(costCenterKey) ||
        indirectCostCenterMap.get(costCenterKey) ||
        helperLineByDepartment.get(costCenterKey) ||
        empInfo.line ||
        '';

      if (costCenterKey.includes('EXCESS') || costCenterKey.includes('EXC_FPC') || costCenterKey.includes('EXC_SMT') || String(empInfo.line || '').toUpperCase().includes('EXC')) {
        const isLoanEmp = loanMap.has(empId);
        if (isLoanEmp || costCenterKey.includes('FPC') || String(empInfo.dept || '').toUpperCase().includes('FPC')) {
          baseLine = 'EXC_FPC';
        } else {
          baseLine = 'EXC_SMT';
        }
      }

      const rawTimeIn = parseRawDate(row.scan_time_in);
      let calculatedShift = '';
      if (rawTimeIn) {
        const hourIn = rawTimeIn.getHours();
        if (hourIn >= 6 && hourIn <= 12) {
          calculatedShift = 'D/S';
        } else if (hourIn >= 18 && hourIn <= 23) {
          calculatedShift = 'N/S';
        }
      }

      let employeeShift = String(empInfo.shift || '').trim().toUpperCase();
      if (!/^[ABD]$/.test(employeeShift)) {
        if (calculatedShift === 'D/S') employeeShift = 'D';
        else if (calculatedShift === 'N/S') employeeShift = 'B';
      }

      // ตรวจสอบกะและช่วงเวลาจากตาราง tbl_date ตามวันที่และกะของพนักงาน
      const tblDateWW = tblDateMap.get(`${effectiveDateKey}_${employeeShift}`) || tblDateMap.get(effectiveDateKey) || '';
      const workShiftTime = tblDateWW === 'N/S'
        ? '20:00 - 04:45'
        : tblDateWW === 'D/S'
          ? '08:00 - 17:00'
          : (employeeShift === 'B' || employeeShift === 'N' ? '20:00 - 04:45' : '08:00 - 17:00');

      const lineCheck = baseLine && /^[ABD]$/.test(employeeShift)
        ? (baseLine === 'AVI/K2' ? `${baseLine}/${employeeShift}` : (baseLine.includes('/') ? baseLine : `${baseLine}/${employeeShift}`))
        : baseLine;

      const loanInfo = loanMap.get(empId);
      const isLoanExclude = Boolean(loanInfo);
      return {
        ...row,
        employee_name: empInfo.name || '',
        name: empInfo.name || '',
        department: empDepartment,
        emp_department: empDepartment,
        dept: empInfo.dept || '',
        shift: empInfo.shift || '',
        shift_h: empInfo.shift || employeeShift || '',
        shift_time: workShiftTime,
        line: empInfo.line || '',
        line_check: lineCheck,
        loan_destination: loanInfo?.destination || '',
        is_loan_exclude: isLoanExclude,
        work_day_status: isLoanExclude && !String(row.work_day_status || '').startsWith('1N')
          ? `1N${String(row.work_day_status || 'W').replace(/^1N/i, '')}`
          : row.work_day_status
      };
    }));
  } catch (error) {
    console.error('[manhour/import/day/list]', error);
    return res.status(500).json({ error: error.message || 'Unable to load day records' });
  }
}

// Endpoint ดึงรายการการลงเวลาทำงาน (ทั้งรายวัน และรายเดือน)
router.get('/import/day/:date', handleGetImportRecords);
router.get('/import/month/:month', handleGetImportRecords);

/**
 * DELETE /import/day/:date
 * ลบรายการลงเวลาทำงานของพนักงานตามวันที่และรหัสพนักงานที่เลือก (ต้องใช้สิทธิ์ Admin)
 */
router.delete('/import/day/:date', requireAdmin, async (req, res) => {
  const date = String(req.params.date || '');
  const records = Array.isArray(req.body?.records)
    ? req.body.records.map(record => ({
      employeeId: String(record?.employeeId || '').trim(),
      effectiveDate: String(record?.effectiveDate || '').slice(0, 10)
    })).filter(record => record.employeeId && /^\d{4}-\d{2}-\d{2}$/.test(record.effectiveDate))
    : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must use YYYY-MM-DD format' });
  }
  if (records.length === 0 || records.length > 50000) {
    return res.status(400).json({ error: 'Select 1-50,000 attendance records to delete' });
  }

  try {
    const deleteParams = records.flatMap(record => [record.employeeId, record.effectiveDate]);
    const deleteValues = records.map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`).join(', ');
    const result = await pool_smart.query(
      `DELETE FROM smart.smart_man_time_attendance AS existing
       USING (VALUES ${deleteValues}) AS selected(employee_id, effective_date)
       WHERE existing.dlh_employee_id = selected.employee_id
         AND existing.dlh_effective_date_time::date = selected.effective_date::date`,
      deleteParams
    );
    [...new Set(records.map(record => record.effectiveDate))].forEach(scheduleManhourChange);
    return res.status(200).json({ ok: true, date, deleted: result.rowCount || 0 });
  } catch (error) {
    console.error('[manhour/import/day]', error);
    return res.status(500).json({ error: error.message || 'Delete failed' });
  }
});

/**
 * POST /import
 * นำเข้าข้อมูลการลงเวลาทำงานจากไฟล์ข้อมูลเข้าสู่ฐานข้อมูล (ต้องใช้สิทธิ์ Admin)
 * - รองรับโหมด: upsert (อัปเดตหรือเพิ่มใหม่), replace_day (แทนที่ทั้งวัน), replace (แทนที่ทั้งเดือน)
 * - บันทึกและคำนวณ Snapshot พร้อมแจ้งเตือนฝั่ง Client ผ่าน SSE อัตโนมัติ
 */
router.post('/import', requireAdmin, async (req, res) => {
  const { mode = 'upsert', month, rows } = req.body || {};
  if (!['upsert', 'replace', 'replace_day'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be upsert, replace_day, or replace' });
  }
  if (!/^\d{4}-\d{2}$/.test(String(month || ''))) {
    return res.status(400).json({ error: 'month must use YYYY-MM format' });
  }
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 50000) {
    return res.status(400).json({ error: 'rows must contain 1-50,000 records' });
  }

  const normalizedRows = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] || {};
    const employeeId = String(row.dlh_employee_id || '').trim();
    const effectiveDate = parseRawDate(row.dlh_effective_date_time);
    if (!employeeId || !effectiveDate || Number.isNaN(effectiveDate.getTime())) {
      return res.status(400).json({ error: `Invalid employee/date at row ${index + 2}` });
    }
    const rawEffectiveDate = String(row.dlh_effective_date_time || '').trim();
    const effectiveDateMatch = rawEffectiveDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const effectiveDateKey = effectiveDateMatch
      ? `${effectiveDateMatch[1]}-${effectiveDateMatch[2]}-${effectiveDateMatch[3]}`
      : `${effectiveDate.getFullYear()}-${String(effectiveDate.getMonth() + 1).padStart(2, '0')}-${String(effectiveDate.getDate()).padStart(2, '0')}`;
    const rowMonth = effectiveDateKey.slice(0, 7);
    if (rowMonth !== month) {
      return res.status(400).json({ error: `Row ${index + 2} is outside selected month ${month}` });
    }
    normalizedRows.push({
      dlh_employee_id: employeeId,
      dlh_effective_date_time: effectiveDateKey,
      work_day_status: row.work_day_status || null,
      work_status: row.work_status || null,
      scan_time_in: parseRawDate(row.scan_time_in),
      scan_time_out: parseRawDate(row.scan_time_out)
    });
  }

  const importDates = [...new Set(normalizedRows.map(row => row.dlh_effective_date_time))];
  if (importDates.length > 0) {
    try {
      const calendarRows = await queryWithRetryPool1(`
        SELECT DATE_FORMAT(w_date, '%Y-%m-%d') AS work_date, w_result
        FROM tbl_date
        WHERE w_date IN (${importDates.map(() => '?').join(',')})
      `, importDates);
      const calendarMap = new Map(calendarRows.map(row => [
        String(row.work_date || '').slice(0, 10),
        String(row.w_result || '').trim().toLowerCase()
      ]));
      normalizedRows.forEach(row => {
        if (String(row.work_day_status || '').trim()) return;
        const result = calendarMap.get(row.dlh_effective_date_time);
        if (result === 'holiday') row.work_day_status = 'H';
        else if (result === 'working day') row.work_day_status = 'W';
      });
    } catch (calendarError) {
      console.warn('[manhour/import] Unable to apply tbl_date work status:', calendarError.message);
    }
  }

  const [year, monthNumber] = month.split('-').map(Number);
  const monthStart = `${year}-${String(monthNumber).padStart(2, '0')}-01`;
  const nextMonthDate = new Date(Date.UTC(year, monthNumber, 1));
  const nextMonthStart = `${nextMonthDate.getUTCFullYear()}-${String(nextMonthDate.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const client = await pool_smart.connect();
  let importingRow = 0;
  try {
    await client.query('BEGIN');
    let deleted = 0;
    if (mode === 'replace') {
      const result = await client.query(
        `DELETE FROM smart.smart_man_time_attendance
         WHERE dlh_effective_date_time >= $1 AND dlh_effective_date_time < $2`,
        [monthStart, nextMonthStart]
      );
      deleted = result.rowCount || 0;
    } else if (mode === 'replace_day') {
      const dates = [...new Set(normalizedRows.map(row => row.dlh_effective_date_time))];
      const result = await client.query(
        `DELETE FROM smart.smart_man_time_attendance
         WHERE dlh_effective_date_time::date = ANY($1::date[])`,
        [dates]
      );
      deleted = result.rowCount || 0;
    }

    const IMPORT_BATCH_SIZE = 5000;
    for (let batchStart = 0; batchStart < normalizedRows.length; batchStart += IMPORT_BATCH_SIZE) {
      importingRow = batchStart + 2;
      const batch = normalizedRows.slice(batchStart, batchStart + IMPORT_BATCH_SIZE);

      if (mode === 'upsert') {
        const deleteParams = batch.flatMap(row => [
          row.dlh_employee_id,
          row.dlh_effective_date_time
        ]);
        const deleteValues = batch.map((_, index) => {
          const offset = index * 2;
          return `($${offset + 1}, $${offset + 2})`;
        }).join(', ');
        const result = await client.query(
          `DELETE FROM smart.smart_man_time_attendance AS existing
           USING (VALUES ${deleteValues}) AS incoming(dlh_employee_id, effective_date)
           WHERE existing.dlh_employee_id = incoming.dlh_employee_id
             AND existing.dlh_effective_date_time::date = incoming.effective_date::date`,
          deleteParams
        );
        deleted += result.rowCount || 0;
      }

      const insertParams = batch.flatMap(row =>
        IMPORT_COLUMNS.map(column => row[column])
      );
      const insertValues = batch.map((_, rowIndex) => {
        const offset = rowIndex * IMPORT_COLUMNS.length;
        return `(${IMPORT_COLUMNS.map((__, columnIndex) => `$${offset + columnIndex + 1}`).join(', ')})`;
      }).join(', ');
      await client.query(
        `INSERT INTO smart.smart_man_time_attendance (${IMPORT_COLUMNS.join(', ')})
         VALUES ${insertValues}`,
        insertParams
      );
    }

    await client.query('COMMIT');

    const snapshots = await createImportSnapshots(importDates);
    importDates.forEach(scheduleManhourChange);
    return res.status(200).json({
      ok: true,
      mode,
      month,
      imported: normalizedRows.length,
      deleted,
      snapshots,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[manhour/import]', error);
    return res.status(500).json({
      error: error.code === '22001'
        ? `Text is longer than the database column limit near row ${importingRow}`
        : (error.message || 'Import failed')
    });
  } finally {
    client.release();
  }
});

function parseRawDate(rawValue) {
  if (!rawValue) return null;
  if (rawValue instanceof Date) return isNaN(rawValue.getTime()) ? null : rawValue;
  const dateObj = new Date(rawValue);
  return !isNaN(dateObj.getTime()) ? dateObj : null;
}

function formatToThaiBE(dateInput) {
  if (!dateInput) return null;
  const dateObj = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
  if (isNaN(dateObj.getTime())) return null;
  const day = dateObj.getDate();
  const month = dateObj.getMonth() + 1;
  const yearBE = dateObj.getFullYear() + 543;
  const hours = dateObj.getHours();
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${yearBE} ${hours}:${minutes}:${seconds}`;
}

function getEffectiveDateParts(rawValue) {
  if (!rawValue) return null;
  if (rawValue instanceof Date) {
    if (isNaN(rawValue.getTime())) return null;
    return { day: rawValue.getDate(), month: rawValue.getMonth() + 1, year: rawValue.getFullYear(), obj: rawValue };
  }
  const str = String(rawValue).trim();
  const matchYMD = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchYMD) {
    const year = parseInt(matchYMD[1], 10);
    const month = parseInt(matchYMD[2], 10);
    const day = parseInt(matchYMD[3], 10);
    return { day, month, year, obj: new Date(year, month - 1, day) };
  }
  const matchDMY = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (matchDMY) {
    const day = parseInt(matchDMY[1], 10);
    const month = parseInt(matchDMY[2], 10);
    const year = parseInt(matchDMY[3], 10);
    return { day, month, year, obj: new Date(year, month - 1, day) };
  }
  const parsed = new Date(rawValue);
  if (!isNaN(parsed.getTime())) {
    return { day: parsed.getDate(), month: parsed.getMonth() + 1, year: parsed.getFullYear(), obj: parsed };
  }
  return null;
}

const DEPARTMENT_SUMMARY_DEPARTMENTS = ['QA', 'FPC', 'SMT_F', 'SMT_B', 'MDS'];
const DEPARTMENT_SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000;

function roundDepartmentSummaryPercent(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function createDepartmentSummarySeries(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const makeDay = day => ({
    day,
    date: `${month}-${String(day).padStart(2, '0')}`,
    leaveByDept: Object.fromEntries(DEPARTMENT_SUMMARY_DEPARTMENTS.map(dept => [dept, 0])),
    leaveSum: 0,
    otByDept: Object.fromEntries(DEPARTMENT_SUMMARY_DEPARTMENTS.map(dept => [dept, 0])),
    otSum: 0,
    otAcc: 0,
  });
  return Array.from({ length: daysInMonth }, (_, index) => makeDay(index + 1));
}

function buildDepartmentSummary(records, month, includeIndirect) {
  const days = createDepartmentSummarySeries(month);
  const buckets = days.map(() => new Map());
  records.forEach(record => {
    if (!includeIndirect && isOtherFactoryRecord(record)) return;
    const date = getEffectiveDateParts(record.dlh_effective_date_time || record.effective_date_time);
    const department = String(record.dept || '').trim().toUpperCase();
    if (!date || date.year !== Number(month.slice(0, 4)) || date.month !== Number(month.slice(5, 7)) || !DEPARTMENT_SUMMARY_DEPARTMENTS.includes(department)) return;
    const employeeId = String(record.dlh_employee_id || record.employee_id || '').trim();
    if (!employeeId) return;
    const bucket = buckets[date.day - 1];
    const existing = bucket.get(employeeId) || { absent: false, present: false, ot: 0, work: 0, department };
    existing.absent ||= shouldCountAsAbsent(record, true);
    existing.present ||= shouldCountAsPresent(record);
    existing.ot = Math.max(existing.ot, Number(record.OT) || 0);
    existing.work = Math.max(existing.work, Number(record.Work) || 0);
    bucket.set(employeeId, existing);
  });
  let accumulatedOtRatio = 0;
  days.forEach((day, index) => {
    const totals = Object.fromEntries(DEPARTMENT_SUMMARY_DEPARTMENTS.map(dept => [dept, { leave: 0, people: 0, ot: 0, work: 0 }]));
    buckets[index].forEach(person => {
      const total = totals[person.department];
      total.people += 1;
      if (person.absent && !person.present) total.leave += 1;
      total.ot += person.ot;
      total.work += person.work;
    });
    let leavePeople = 0; let leaveTotal = 0; let otTotal = 0; let workTotal = 0;
    DEPARTMENT_SUMMARY_DEPARTMENTS.forEach(dept => {
      const total = totals[dept];
      day.leaveByDept[dept] = roundDepartmentSummaryPercent(total.people ? total.leave / total.people * 100 : 0);
      day.otByDept[dept] = roundDepartmentSummaryPercent(total.ot + total.work ? total.ot / (total.ot + total.work) * 100 : 0);
      leavePeople += total.people; leaveTotal += total.leave; otTotal += total.ot; workTotal += total.work;
    });
    day.leaveSum = roundDepartmentSummaryPercent(leavePeople ? leaveTotal / leavePeople * 100 : 0);
    day.otSum = roundDepartmentSummaryPercent(otTotal + workTotal ? otTotal / (otTotal + workTotal) * 100 : 0);
    accumulatedOtRatio += day.otSum;
    day.otAcc = roundDepartmentSummaryPercent(accumulatedOtRatio / (index + 1));
  });
  return days;
}

const deptSummaryRouter = require('./deptSummary.js');
router.use('/dept_summary', deptSummaryRouter);

router.get('/summary', async (req, res) => {
  const requestedMonth = /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(String(req.query.month || '')) ? String(req.query.month) : null;
  const requestedDates = [...new Set(String(req.query.dates || '').split(',')
    .map(value => value.trim())
    .filter(value => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))
    .filter(value => !requestedMonth || value.startsWith(`${requestedMonth}-`)))].slice(0, 31);
  const cacheKey = requestedMonth ? `month:${requestedMonth}` : 'current-month';
  const flightKey = requestedDates.length > 0
    ? `dates:${[...requestedDates].sort().join(',')}`
    : cacheKey;

  // Single-Flight: ถ้ามี Request สำหรับเดือน/วันเดียวกันกำลังรันอยู่ ให้รอผลลัพธ์จากตัวเดียวกันทันที
  if (inFlightSummaryPromises.has(flightKey)) {
    try {
      const data = await inFlightSummaryPromises.get(flightKey);
      res.set('X-Data-Cache', 'SINGLE-FLIGHT-HIT');
      return res.json(data);
    } catch {
      // Fallback ถ้าตัวแรก error
    }
  }

  const summaryPromise = (async () => {
    let cached = manhourSummaryCache.get(cacheKey);
    if (!cached) {
      cached = await readPersistentCache(requestedMonth ? `manhour-summary-${requestedMonth}` : 'manhour-summary-current-month');
      if (cached) manhourSummaryCache.set(cacheKey, cached);
    }
    if (requestedMonth && cached?.month !== requestedMonth) cached = null;
    await loadDirtyManhourDates();
    const dirtyDatesForMonth = requestedMonth ? [...dirtyManhourDates].filter(date => date.startsWith(`${requestedMonth}-`)) : [];
    const canApplyDailyPatch = requestedDates.length === 0 && dirtyDatesForMonth.length > 0 && cached?.data?.spreadsheetData;
    const datesToRefresh = requestedDates.length > 0 ? requestedDates : (canApplyDailyPatch ? dirtyDatesForMonth : []);
    if (datesToRefresh.length === 0 && cached?.statusTooltipCacheVersion === STATUS_TOOLTIP_CACHE_VERSION && Object.keys(cached?.data?.statusTooltipData || {}).length > 0 && req.query.refresh !== '1') {
      // Check DB latest timestamp to ensure cache is still fresh
      const monthToCheck = requestedMonth || new Intl.DateTimeFormat('en-CA', {
        year: 'numeric', month: '2-digit', timeZone: 'Asia/Bangkok',
      }).format(new Date());
      let dbLatest = 0;
      try {
        const latestRes = await queryWithRetry(
          `SELECT MAX(updated_date) AS latest FROM smart.smart_man_time_attendance
           WHERE dlh_effective_date_time >= $1 AND dlh_effective_date_time < ($1::date + INTERVAL '1 month')::text`,
          [ `${monthToCheck}-01` ]
        );
        const rows = Array.isArray(latestRes) ? latestRes : (latestRes?.rows || []);
        dbLatest = rows[0]?.latest ? new Date(rows[0].latest).getTime() : 0;
      } catch (e) {
        console.warn(`[manhour] DB latest check failed: ${e.message}`);
      }

      if (dbLatest > (cached.savedAt || 0)) {
        console.info(`[manhour/summary] DB newer than summary cache for ${monthToCheck}, refreshing.`);
        cached = null;
        manhourSummaryCache.delete(cacheKey);
      } else {
        if (Date.now() - cached.savedAt >= MANHOUR_CACHE_TTL_MS) {
          // Force background refresh when cache stale
          setImmediate(() => {
            fetchManhourData({ requestedMonth, requestedDates: datesToRefresh, forceRefresh: true }).catch(() => {});
          });
        }
        return cached.data;
      }
    }
    const [attendancePayload, helpSummary] = await Promise.all([
      fetchManhourData({ requestedMonth, requestedDates: datesToRefresh, forceRefresh: req.query.refresh === '1' }),
      fetchHelpSummaryData({ requestedMonth, requestedDates: datesToRefresh, forceRefresh: req.query.refresh === '1' }),
    ]);
    const records = Array.isArray(attendancePayload) ? attendancePayload : (attendancePayload?.data || []);
    // Do not replace a complete monthly summary with zeros when the attendance
    // source is temporarily unavailable and returns no records.
    if (records.length === 0 && cached?.data?.spreadsheetData) {
      return cached.data;
    }
    let customMappings = {};
    try {
      const mappingRes = await pool_test.query(`
        SELECT parent_line_name, shifts, child_lines, display_pages, main_category, formula_groups, cost_center_prefixes
        FROM public.manhour_line_mappings
      `);
      mappingRes.rows.forEach((row) => {
        customMappings[row.parent_line_name] = {
          shifts: Array.isArray(row.shifts) ? row.shifts : JSON.parse(row.shifts || "[]"),
          lines: Array.isArray(row.child_lines) ? row.child_lines : JSON.parse(row.child_lines || "[]"),
          displayPages: Array.isArray(row.display_pages) ? row.display_pages : JSON.parse(row.display_pages || "[]"),
          macroGroups: Array.isArray(row.main_category) ? row.main_category : JSON.parse(row.main_category || "[]"),
          formulaGroups: Array.isArray(row.formula_groups) ? row.formula_groups : JSON.parse(row.formula_groups || "[]"),
          costCenterPrefixes: Array.isArray(row.cost_center_prefixes) ? row.cost_center_prefixes : JSON.parse(row.cost_center_prefixes || "[]"),
        };
      });
    } catch (err) {
      console.warn('[manhour/summary] Could not load custom mappings:', err.message);
    }

    // ตัดวันทำงานปกติ หรือวันหยุด ตาม tbl_date เสมอ
    const calMonth = requestedMonth || (records[0]?.dlh_effective_date_time ? String(records[0].dlh_effective_date_time).slice(0, 7) : new Date().toISOString().slice(0, 7));
    const workingDateKeys = new Set();
    try {
      const calendarRows = await queryWithRetryPool1(`
        SELECT DATE_FORMAT(work_date, '%Y-%m-%d') AS w_date,
               CASE
                 WHEN MAX(CASE WHEN LOWER(TRIM(COALESCE(w_result, ''))) = 'holiday' THEN 1 ELSE 0 END) = 1
                   THEN 'holiday'
                 ELSE LOWER(TRIM(COALESCE(MAX(w_result), '')))
               END AS w_result
        FROM (
          SELECT
            CASE
              WHEN CAST(w_date AS CHAR) REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN
                CASE
                  WHEN YEAR(STR_TO_DATE(CAST(w_date AS CHAR), '%d/%m/%Y')) > 2400
                    THEN DATE_SUB(STR_TO_DATE(CAST(w_date AS CHAR), '%d/%m/%Y'), INTERVAL 543 YEAR)
                  ELSE STR_TO_DATE(CAST(w_date AS CHAR), '%d/%m/%Y')
                END
              ELSE DATE(w_date)
            END AS work_date,
            w_result
          FROM tbl_date
        ) calendar_source
        WHERE work_date >= ?
          AND work_date < DATE_ADD(?, INTERVAL 1 MONTH)
        GROUP BY work_date
        ORDER BY work_date
      `, [`${calMonth}-01`, `${calMonth}-01`]);
      (Array.isArray(calendarRows) ? calendarRows : (calendarRows?.rows || [])).forEach((r) => {
        const isWorking = String(r.w_result || '').trim().toLowerCase() !== 'holiday';
        if (isWorking && r.w_date) {
          workingDateKeys.add(String(r.w_date).slice(0, 10));
        }
      });
    } catch (calErr) {
      console.warn('[manhour/summary] Could not load tbl_date calendar:', calErr.message);
    }

    let rawSpreadsheet = buildFullSpreadsheetData(records, customMappings, workingDateKeys);

    let data = {
      spreadsheetData: applyDirectHelpSummary(rawSpreadsheet, helpSummary),
      statusTooltipData: buildStatusTooltipData(records),
      helpSummary,
    };
    if (canApplyDailyPatch) {
      const changedDays = datesToRefresh.map(date => Number(date.slice(8, 10)));
      data = {
        spreadsheetData: Object.fromEntries(Object.entries(cached.data.spreadsheetData).map(([lineName, dayMap]) => [lineName, {
          ...dayMap,
          ...Object.fromEntries(changedDays.map(day => [day, data.spreadsheetData?.[lineName]?.[day] || {}])),
        }])),
        statusTooltipData: { ...(cached.data.statusTooltipData || {}), ...data.statusTooltipData },
      };
      changedDays.forEach(day => { if (!data.statusTooltipData?.[day]) delete data.statusTooltipData[day]; });
      datesToRefresh.forEach(date => dirtyManhourDates.delete(date));
      await saveDirtyManhourDates();
    }
    if (requestedDates.length === 0) {
      const nextCache = { savedAt: Date.now(), month: requestedMonth, statusTooltipCacheVersion: STATUS_TOOLTIP_CACHE_VERSION, data };
      manhourSummaryCache.set(cacheKey, nextCache);
      writePersistentCache(requestedMonth ? `manhour-summary-${requestedMonth}` : 'manhour-summary-current-month', nextCache).catch(error => console.error('[manhour/summary] Save failed:', error.message));
    }
    return data;
  })();

  inFlightSummaryPromises.set(flightKey, summaryPromise);
  try {
    const data = await summaryPromise;
    res.set('X-Data-Cache', 'MISS');
    return res.json(data);
  } catch (error) {
    console.error('[manhour/summary]', error);
    if (cached) return res.set('X-Data-Cache', 'STALE').json(cached.data);
    return res.status(500).json({ error: 'Unable to build Man-Hour summary', errorMessage: error.message });
  } finally {
    inFlightSummaryPromises.delete(flightKey);
  }
});

router.put('/import/day/:date', requireAdmin, async (req, res) => {
  const date = String(req.params.date || '');
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || rows.length === 0 || rows.length > 50000) return res.status(400).json({ error: 'Provide 1-50,000 rows for a valid date' });
  const clientSmart = await pool_smart.connect();
  try {
    await clientSmart.query('BEGIN');
    let updated = 0;
    for (const row of rows) {
      const employeeId = String(row?.employeeId || '').trim();
      if (!employeeId) continue;
      const effectiveDate = row.effectiveDate || date;

      const result = await clientSmart.query(
        `UPDATE smart.smart_man_time_attendance
         SET work_day_status = $1, work_status = $2, scan_time_in = $3, scan_time_out = $4
         WHERE dlh_employee_id = $5 AND dlh_effective_date_time::date = $6::date`,
        [row.workDayStatus || null, row.workStatus || null, row.scanTimeIn || null, row.scanTimeOut || null, employeeId, effectiveDate]
      );
      updated += result.rowCount || 0;

      // อัปเดตข้อมูลพนักงานย้อนหลังเฉพาะวันนั้นลง tbl_manhour_snapshot (ไม่กระทบ Master และวันอื่น)
      const hasDept = row.department !== undefined || row.empDepartment !== undefined;
      const hasLine = row.line !== undefined && row.line !== null;
      const hasName = row.employeeName !== undefined && row.employeeName !== null;
      const hasShift = row.shift !== undefined && row.shift !== null;

      if (hasDept || hasLine || hasName || hasShift) {
        const newDept = row.department || row.empDepartment || '';
        const newLine = row.line || '';
        const newName = row.employeeName || '';
        const newShift = row.shift || '';

        await pool_test.query(
          `INSERT INTO tbl_manhour_snapshot (
             employee_id, work_date, name, department, line, employee_shift
           ) VALUES ($1, $2::date, $3, $4, $5, $6)
           ON CONFLICT (employee_id, work_date) DO UPDATE SET
             name = CASE WHEN $3 <> '' THEN $3 ELSE tbl_manhour_snapshot.name END,
             department = CASE WHEN $4 <> '' THEN $4 ELSE tbl_manhour_snapshot.department END,
             line = CASE WHEN $5 <> '' THEN $5 ELSE tbl_manhour_snapshot.line END,
             employee_shift = CASE WHEN $6 <> '' THEN $6 ELSE tbl_manhour_snapshot.employee_shift END,
             snapshot_at = CURRENT_TIMESTAMP`,
          [employeeId, effectiveDate, newName, newDept, newLine, newShift]
        ).catch(err => {
          console.warn(`[manhour/import/day/put] Failed to update tbl_manhour_snapshot for ${employeeId}:`, err.message);
        });
      }
    }
    await clientSmart.query('COMMIT');
    scheduleManhourChange(date);
    return res.json({ ok: true, updated });
  } catch (error) {
    await clientSmart.query('ROLLBACK');
    return res.status(500).json({ error: error.message || 'Update failed' });
  } finally {
    clientSmart.release();
  }
});

router.delete('/import/day/:date', requireAdmin, async (req, res) => {
  const date = String(req.params.date || '');
  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Valid date is required (YYYY-MM-DD)' });
  }
  const client = await pool_smart.connect();
  try {
    await client.query('BEGIN');
    let deleted = 0;
    if (records.length > 0) {
      const empIds = records.map(r => String(r.employeeId || '').trim()).filter(Boolean);
      if (empIds.length > 0) {
        const result = await client.query(
          `DELETE FROM smart.smart_man_time_attendance
           WHERE dlh_effective_date_time::date = $1::date
             AND dlh_employee_id = ANY($2::text[])`,
          [date, empIds]
        );
        deleted = result.rowCount || 0;
      }
    } else {
      const result = await client.query(
        `DELETE FROM smart.smart_man_time_attendance
         WHERE dlh_effective_date_time::date = $1::date`,
        [date]
      );
      deleted = result.rowCount || 0;
    }
    await client.query('COMMIT');
    scheduleManhourChange(date);
    return res.json({ ok: true, deleted });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: error.message || 'Delete failed' });
  } finally {
    client.release();
  }
});

router.get('/employees/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  try {
    const query = q
      ? `SELECT h.code, h.name, h.department, h.line, h.dept, h.shift,
                e.sect, e.process, COALESCE(e.status, 'Training Center') AS status
         FROM tbl_employee_help h
         LEFT JOIN tbl_employee e ON h.code = e.code
         WHERE h.code LIKE ? OR h.name LIKE ? OR h.department LIKE ?
         LIMIT 50`
      : `SELECT h.code, h.name, h.department, h.line, h.dept, h.shift,
                e.sect, e.process, COALESCE(e.status, 'Training Center') AS status
         FROM tbl_employee_help h
         LEFT JOIN tbl_employee e ON h.code = e.code
         LIMIT 200`;
    const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];
    const rows = await queryWithRetryPool1(query, params).catch(() => []);
    return res.json({ ok: true, data: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});



router.get('/months', async (_req, res) => {
  try {
    const year = new Intl.DateTimeFormat('en-CA', { year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date());
    const pgPromise = queryWithRetry(
      `SELECT DISTINCT LEFT(dlh_effective_date_time::text, 7) AS month
       FROM smart.smart_man_time_attendance
       WHERE dlh_effective_date_time IS NOT NULL`
    ).catch(() => ([]));
    
    const myPromise = queryWithRetryPool2(
      `SELECT DISTINCT to_char(work_date, 'YYYY-MM') AS month
       FROM tbl_manhour_snapshot
       WHERE work_date IS NOT NULL`
    ).catch(() => ([]));

    const [pgResult, myResult] = await Promise.all([pgPromise, myPromise]);
    
    const months = new Set();
    const pgRows = Array.isArray(pgResult) ? pgResult : (pgResult.rows || []);
    pgRows.forEach(row => row.month && months.add(row.month));
    const myResultRows = Array.isArray(myResult) ? myResult : (myResult.rows || []);
    myResultRows.forEach(row => row.month && months.add(row.month));
    
    // Sort ascending
    const sortedMonths = Array.from(months).sort();
    return res.json(sortedMonths);
  } catch (error) {
    return res.status(500).json({ error: 'Unable to load Man-Hour months' });
  }
});

// Pre-warm disk cache for past months on startup so data survives server restarts
(async () => {
  try {
    const currentMonth = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date());
    const monthsResult = await queryWithRetry(
      `SELECT DISTINCT LEFT(dlh_effective_date_time::text, 7) AS month
       FROM smart.smart_man_time_attendance
       WHERE dlh_effective_date_time IS NOT NULL`
    ).catch(() => ([]));
    
    // Also include months from snapshot for pre-warming
    const snapshotMonthsResult = await queryWithRetryPool2(
      `SELECT DISTINCT to_char(work_date, 'YYYY-MM') AS month
       FROM tbl_manhour_snapshot
       WHERE work_date IS NOT NULL`
    ).catch(() => ([]));

    const monthsSet = new Set();
    const pgRows = Array.isArray(monthsResult) ? monthsResult : (monthsResult.rows || []);
    pgRows.forEach(row => row.month && monthsSet.add(row.month));
    const snapshotRows = Array.isArray(snapshotMonthsResult) ? snapshotMonthsResult : (snapshotMonthsResult.rows || []);
    snapshotRows.forEach(row => row.month && monthsSet.add(row.month));

    const pastMonths = Array.from(monthsSet).filter(m => m !== currentMonth).sort();
    for (const month of pastMonths) {
      const cacheKey = `manhour-${month}`;
      const existing = await readPersistentCache(cacheKey);
      if (existing) {
        // Already cached on disk — load into memory
        manhourCache.set(`month:${month}`, existing);
        console.info(`[manhour/startup] Loaded disk cache for ${month} (${Array.isArray(existing?.data?.data) ? existing.data.data.length : '?'} records)`);
      } else {
        console.info(`[manhour/startup] Fetching past month ${month} to warm disk cache...`);
        try {
          await fetch(`http://127.0.0.1:${process.env.PORT || 8085}/api_p1/production_status/mh/manhour?month=${month}&refresh=1`);
        } catch(err) {
          console.warn(`[manhour/startup] Pre-warm failed for ${month}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.warn('[manhour/startup] Pre-warm error:', err.message);
  }
})();
 
/**
 * ฟังก์ชันดึงและคำนวณข้อมูล Man-Hour โดยตรง (In-memory Direct Call)
 * พร้อมระบบ Single-Flight Request Collapsing ป้องกันการ Query ซ้ำ
 */
async function fetchManhourData({ requestedMonth = null, requestedDates = [], forceRefresh = false } = {}) {
  const requestedDatesClean = (Array.isArray(requestedDates) ? requestedDates : String(requestedDates || '').split(','))
    .map(value => String(value).trim())
    .filter(value => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))
    .slice(0, 31);
  const requestedMonthClean = /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(String(requestedMonth || '')) ? String(requestedMonth) : null;
  const responseCacheKey = requestedDatesClean.length > 0
    ? `dates:${[...requestedDatesClean].sort().join(',')}`
    : (requestedMonthClean ? `month:${requestedMonthClean}` : 'current-month');

  if (inFlightManhourPromises.has(responseCacheKey)) {
    return inFlightManhourPromises.get(responseCacheKey);
  }

  const promise = (async () => {
    let manhourTasks = [];
    let cachedResponse = manhourCache.get(responseCacheKey);
    if (!cachedResponse && (responseCacheKey === 'current-month' || requestedMonthClean)) {
      cachedResponse = await readPersistentCache(requestedMonthClean ? `manhour-${requestedMonthClean}` : 'manhour-current-month');
      if (cachedResponse) manhourCache.set(responseCacheKey, cachedResponse);
    }
    if (requestedMonthClean && cachedResponse?.month !== requestedMonthClean) cachedResponse = null;
    const cachedTasks = Array.isArray(cachedResponse?.data)
      ? cachedResponse.data
      : cachedResponse?.data?.data;
    const currentMonth = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', timeZone: 'Asia/Bangkok',
    }).format(new Date());

    if (requestedMonthClean === currentMonth && (!Array.isArray(cachedTasks) || cachedTasks.length === 0)) {
      const currentMonthCache = await readPersistentCache('manhour-current-month');
      const currentMonthTasks = Array.isArray(currentMonthCache?.data)
        ? currentMonthCache.data
        : currentMonthCache?.data;
      if (Array.isArray(currentMonthTasks) && currentMonthTasks.length > 0) {
        cachedResponse = { ...currentMonthCache, month: requestedMonthClean };
        manhourCache.set(responseCacheKey, cachedResponse);
      }
    }

    if (cachedResponse && !forceRefresh && (requestedMonthClean || responseCacheKey === 'current-month')) {
      const monthToCheck = requestedMonthClean || currentMonth;
      try {
        const latestRes = await queryWithRetry(
          `SELECT MAX(updated_date) AS latest, COUNT(*)::bigint AS count FROM smart.smart_man_time_attendance
           WHERE dlh_effective_date_time >= $1 AND dlh_effective_date_time < ($1::date + INTERVAL '1 month')::text`,
          [ `${monthToCheck}-01` ]
        );
        const latestRow = Array.isArray(latestRes) ? latestRes[0] : (latestRes?.rows?.[0]);
        const dbLatest = latestRow?.latest ? new Date(latestRow.latest).getTime() : 0;
        const dbCount = Number(latestRow?.count || 0);
        const cachedCount = Array.isArray(cachedTasks) ? cachedTasks.length : 0;
        if (dbLatest > (cachedResponse.savedAt || 0) || (dbCount > 0 && cachedCount === 0)) {
          cachedResponse = null;
          manhourCache.delete(responseCacheKey);
        }
      } catch (e) {
        console.warn(`[manhour/cache] DB freshness check skipped: ${e.message}`);
      }
    }

    if (cachedResponse && !forceRefresh && Date.now() - cachedResponse.savedAt < MANHOUR_CACHE_TTL_MS) {
      return cachedResponse.data;
    }
    if (cachedResponse && !forceRefresh) {
      if (!manhourRefreshes.has(responseCacheKey)) {
        manhourRefreshes.add(responseCacheKey);
        setImmediate(() => {
          fetchManhourData({ requestedMonth: requestedMonthClean, requestedDates: requestedDatesClean, forceRefresh: true })
            .catch(error => console.error('[manhour/cache] Background refresh failed:', error.message))
            .finally(() => manhourRefreshes.delete(responseCacheKey));
        });
      }
      return cachedResponse.data;
    }

    const dateWhereClause = requestedDatesClean.length > 0
      ? 'a.dlh_effective_date_time::date = ANY($1::date[])'
      : requestedMonthClean
        ? `a.dlh_effective_date_time >= $1 AND a.dlh_effective_date_time < ($1::date + INTERVAL '1 month')::text`
        : `a.dlh_effective_date_time >= to_char(
          date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok'),
          'YYYY-MM-DD'
        )
          AND a.dlh_effective_date_time < to_char(
            date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok') + INTERVAL '1 month',
            'YYYY-MM-DD'
          )`;

    const subWhereClause = requestedDatesClean.length > 0
      ? 'dlh_effective_date_time::date = ANY($1::date[])'
      : requestedMonthClean
        ? `dlh_effective_date_time >= $1 AND dlh_effective_date_time < ($1::date + INTERVAL '1 month')::text`
        : `dlh_effective_date_time >= to_char(
          date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok'),
          'YYYY-MM-DD'
        )
          AND dlh_effective_date_time < to_char(
            date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok') + INTERVAL '1 month',
            'YYYY-MM-DD'
          )`;

    const pgQuery = `
      SELECT 
        a.dlh_employee_id,
        a.dlh_effective_date_time,
        a.work_day_status,
        a.work_status,
        a.scan_time_in,
        a.scan_time_out
      FROM smart.smart_man_time_attendance a
      INNER JOIN (
        SELECT dlh_effective_date_time::date AS work_date, MAX(updated_date) AS max_updated_date
        FROM smart.smart_man_time_attendance
        WHERE ${subWhereClause}
        GROUP BY dlh_effective_date_time::date
      ) latest ON a.dlh_effective_date_time::date = latest.work_date
             AND a.updated_date = latest.max_updated_date
      WHERE ${dateWhereClause}
        AND a.dlh_employee_id IS NOT NULL
        AND TRIM(a.dlh_employee_id) != ''
      ORDER BY a.dlh_effective_date_time DESC, a.scan_time_in DESC NULLS LAST
    `;
    const pgParams = requestedDatesClean.length > 0 ? [requestedDatesClean] : (requestedMonthClean ? [`${requestedMonthClean}-01`] : []);
    let attendanceRows = [];
    let attendanceSourceUnavailable = false;
    try {
      const pgResult = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Attendance source timed out after 120 seconds')), 120_000);
        queryWithRetry(pgQuery, pgParams).then(
          result => { clearTimeout(timeout); resolve(result); },
          error => { clearTimeout(timeout); reject(error); },
        );
      });
      attendanceRows = Array.isArray(pgResult) ? pgResult : (pgResult?.rows || []);
    } catch (error) {
      attendanceSourceUnavailable = true;
      console.warn('[manhour] Attendance source unavailable; serving snapshot fallback:', error.message);
    }

    const empIds = [...new Set(attendanceRows.map(row => row.dlh_employee_id).filter(id => id))];
    let employeeMap = new Map();
    const bangkokMonth = requestedMonthClean || new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', timeZone: 'Asia/Bangkok',
    }).format(new Date());
    const snapshotWhere = requestedDatesClean.length > 0
      ? `WHERE work_date::date IN (${requestedDatesClean.map((_, index) => `$${index + 1}`).join(',')})`
      : 'WHERE work_date >= $1::date AND work_date < ($1::date + INTERVAL \'1 month\')';
    const snapshotParams = requestedDatesClean.length > 0
      ? requestedDatesClean
      : [`${bangkokMonth}-01`];
    const employeePromise = empIds.length > 0
      ? queryWithRetryPool1(`
          SELECT h.code, h.name, h.department, h.dept, h.shift, h.line,
                 e.sect, e.process, COALESCE(e.status, 'Training Center') AS status
          FROM tbl_employee_help h
          LEFT JOIN tbl_employee e ON h.code = e.code
          WHERE h.code IN (${empIds.map(() => '?').join(',')})
        `, empIds.map(id => String(id).trim()))
      : Promise.resolve([]);
    const snapshotPromise = queryWithRetryPool2(`
      SELECT employee_id, work_date, effective_date_time, name, sect, department,
             dept, employee_shift, line
      FROM tbl_manhour_snapshot
      ${snapshotWhere}
    `, snapshotParams).catch(error => {
      if (error?.code === 'ER_NO_SUCH_TABLE') return [];
      console.warn('[manhour] Snapshot source unavailable; continuing without snapshot fallback:', error?.message || error);
      return [];
    });
    const [employeeRows, helperRows, snapshotRows, dateRows, directCcResult, indirectCcResult, loanExcludeRows] = await Promise.all([
      employeePromise,
      queryWithRetryPool1('SELECT department, line FROM tbl_employee_help').catch(() => []),
      snapshotPromise,
      queryWithRetryPool1('SELECT w_date, w_w, w_ot FROM tbl_date'),
      attendanceSourceUnavailable
        ? Promise.resolve([])
        : queryWithRetryPool2('SELECT cost_center_name, line_out FROM public.cost_centers_direct').catch(() => []),
      attendanceSourceUnavailable
        ? Promise.resolve([])
        : queryWithRetryPool2('SELECT cost_center_name, line_out FROM public.cost_centers_indirect').catch(() => []),
      pool_test.query("SELECT employee_id, destination, department, start_date, end_date FROM manpower_loan_exclude WHERE is_active = true OR is_active::text = '1' OR is_active::text ILIKE 'true'")
        .then(r => r.rows || [])
        .catch(err => {
          console.warn('[manhour] Unable to load manpower_loan_exclude:', err.message);
          return [];
        }),
    ]);
    employeeRows.forEach(emp => {
      if (emp.code) employeeMap.set(String(emp.code).trim(), emp);
    });
    const helperLineByDepartment = new Map();
    helperRows.forEach(row => {
      const department = String(row.department || '').trim().toUpperCase();
      const line = String(row.line || '').trim();
      if (department && line) helperLineByDepartment.set(department, line);
    });
    const snapshotMap = new Map();
    snapshotRows.forEach(snapshot => {
      const date = getEffectiveDateParts(snapshot.work_date);
      if (!date) return;
      const dateKey = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
      snapshotMap.set(`${String(snapshot.employee_id).trim()}_${dateKey}`, snapshot);
    });
    const resolvedAttendanceRows = attendanceRows;

    if (resolvedAttendanceRows.length === 0) {
      const previousData = cachedResponse?.data;
      const previousTasks = Array.isArray(previousData) ? previousData : previousData?.data;
      if (Array.isArray(previousTasks) && previousTasks.length > 0) {
        return previousData;
      }
      return { data: [] };
    }
    let otConfigMap = new Map();
    if (Array.isArray(dateRows)) {
      dateRows.forEach(dRow => {
        if (dRow.w_date && dRow.w_w) {
          const key = `${String(dRow.w_date).trim()}_${String(dRow.w_w).trim().toUpperCase()}`;
          otConfigMap.set(key, String(dRow.w_ot).trim());
        }
      });
    }

    const directCcRows = Array.isArray(directCcResult)
      ? directCcResult
      : (directCcResult && directCcResult.rows) ? directCcResult.rows : [];
    const indirectCcRows = Array.isArray(indirectCcResult)
      ? indirectCcResult
      : (indirectCcResult && indirectCcResult.rows) ? indirectCcResult.rows : [];

    const allCostCenters = [...directCcRows, ...indirectCcRows];
    const directCostCenterMap = buildCostCenterLineMap(directCcRows);
    const indirectCostCenterMap = buildCostCenterLineMap(indirectCcRows);

    const parseLoanDate = d => {
      if (!d) return '';
      try {
        const dt = d instanceof Date ? d : new Date(d);
        if (isNaN(dt.getTime())) return '';
        return new Intl.DateTimeFormat('en-CA', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          timeZone: 'Asia/Bangkok'
        }).format(dt);
      } catch {
        return String(d).slice(0, 10);
      }
    };
    const loanExcludeByEmpMap = new Map();
    (loanExcludeRows || []).forEach(l => {
      const empId = String(l.employee_id || '').trim();
      if (!empId) return;
      if (!loanExcludeByEmpMap.has(empId)) loanExcludeByEmpMap.set(empId, []);
      loanExcludeByEmpMap.get(empId).push({
        destination: l.destination || '',
        sDate: parseLoanDate(l.start_date),
        eDate: parseLoanDate(l.end_date),
      });
    });

    manhourTasks = resolvedAttendanceRows.map((row) => {
      const dateParts = getEffectiveDateParts(row.dlh_effective_date_time);
      const rawTimeIn = parseRawDate(row.scan_time_in);
      const rawTimeOut = parseRawDate(row.scan_time_out);

      const empKey = row.dlh_employee_id ? String(row.dlh_employee_id).trim() : '';
      const effectiveDateKey = dateParts
        ? `${dateParts.year}-${String(dateParts.month).padStart(2, '0')}-${String(dateParts.day).padStart(2, '0')}`
        : '';
      const currentEmpInfo = employeeMap.get(empKey) || {};
      const historicalEmpInfo = snapshotMap.get(`${empKey}_${effectiveDateKey}`);
      const empInfo = {
        name: historicalEmpInfo?.name || currentEmpInfo.name || '',
        sect: historicalEmpInfo?.sect || currentEmpInfo.sect || '',
        department: historicalEmpInfo?.department || currentEmpInfo.department || '',
        dept: historicalEmpInfo?.dept || currentEmpInfo.dept || '',
        shift: historicalEmpInfo?.employee_shift || currentEmpInfo.shift || '',
        line: historicalEmpInfo?.line || currentEmpInfo.line || '',
        status: currentEmpInfo.status || 'Training Center',
      };
      const empDept = empInfo.department ? String(empInfo.department).trim() : '';

      let calculatedShift = '';
      let calculatedWork = 0;
      let calculatedOt = 0;
      let otType = '';

      if (row.work_status === 'Normal' || row.work_status === 'Abnormal') {
        calculatedWork = 8;
      }

      if (rawTimeIn) {
        const hourIn = rawTimeIn.getHours();
        if (hourIn >= 6 && hourIn <= 12) {
          calculatedShift = 'D/S';
        } else if (hourIn >= 18 && hourIn <= 23) {
          calculatedShift = 'N/S';
        }
      }

      if (!calculatedShift && empInfo.shift) {
        const standardShift = String(empInfo.shift).trim().toUpperCase();
        if (standardShift === 'D' || standardShift === 'D/S' || standardShift === 'A') {
          calculatedShift = 'D/S';
        } else if (standardShift === 'N' || standardShift === 'N/S' || standardShift === 'B') {
          calculatedShift = 'N/S';
        }
      }

      let formattedThaiDate = null;
      if (dateParts) {
        const dd = String(dateParts.day).padStart(2, '0');
        const mm = String(dateParts.month).padStart(2, '0');
        const yyyyBE = dateParts.year + 543;
        formattedThaiDate = `${dd}/${mm}/${yyyyBE}`;
      }

      if (rawTimeOut) {
        const outHour = rawTimeOut.getHours();
        const outMinute = rawTimeOut.getMinutes();
        const outTotalMinutes = outHour * 60 + outMinute;

        const dbLookupDate = dateParts ? `${String(dateParts.day).padStart(2, '0')}/${String(dateParts.month).padStart(2, '0')}/${dateParts.year}` : '';
        const otKey = `${dbLookupDate}_${calculatedShift}`;
        const configuredOt = otConfigMap.get(otKey) || '';
        const isHolidayDate = configuredOt.includes('2') || configuredOt.toLowerCase().includes('holiday');

        if (isHolidayDate) {
          // ในวันหยุด (Holiday / OT 2): ต้องทำงานมากกว่า 4 ชม. (> 4 ชม.) ถ้าทำไม่ถึง (<= 4 ชม.) ไม่นับ
          let durationMs = (rawTimeIn && rawTimeOut) ? rawTimeOut.getTime() - rawTimeIn.getTime() : 0;
          if (durationMs < 0) durationMs += 24 * 60 * 60 * 1000;
          const workHours = durationMs / (1000 * 60 * 60);

          if (workHours > 4) {
            calculatedOt = 3;
            otType = configuredOt || 'OT 2';
          }
        } else {
          // วันทำงานปกติ (OT 1)
          if (calculatedShift === 'D/S') {
            // กะกลางวัน: สแกนออกตั้งแต่ 19:30 น. (1170 นาที) ขึ้นไป
            calculatedOt = (outTotalMinutes >= 1170) ? 3 : 0;
          } else if (calculatedShift === 'N/S') {
            // กะกลางคืน: สแกนออกตั้งแต่ 07:30 น. (450 นาที) ขึ้นไป
            calculatedOt = (outTotalMinutes >= 450 && outTotalMinutes <= 720) ? 3 : 0;
          }
          if (calculatedOt > 0) {
            otType = configuredOt || '';
          }
        }
      }

      const empDepartment = String(
        historicalEmpInfo?.department || currentEmpInfo.department || '',
      ).trim();
      const costCenterKey = empDepartment.toUpperCase();
      let baseLine =
        directCostCenterMap.get(costCenterKey) ||
        indirectCostCenterMap.get(costCenterKey) ||
        helperLineByDepartment.get(costCenterKey) ||
        empInfo.line ||
        '';

      if (costCenterKey.includes('EXCESS') || costCenterKey.includes('EXC_FPC') || costCenterKey.includes('EXC_SMT') || String(empInfo.line || '').toUpperCase().includes('EXC')) {
        const isLoanEmp = loanExcludeByEmpMap.has(empKey);
        if (isLoanEmp || costCenterKey.includes('FPC') || String(empInfo.dept || '').toUpperCase().includes('FPC')) {
          baseLine = 'EXC_FPC';
        } else {
          baseLine = 'EXC_SMT';
        }
      }

      let employeeShift = String(empInfo.shift || '').trim().toUpperCase();
      if (!/^[ABD]$/.test(employeeShift)) {
        if (calculatedShift === 'D/S') employeeShift = 'D';
        else if (calculatedShift === 'N/S') employeeShift = 'B';
      }

      const lineCheck = baseLine && /^[ABD]$/.test(employeeShift)
        ? (baseLine === 'AVI/K2' ? `${baseLine}/${employeeShift}` : (baseLine.includes('/') ? baseLine : `${baseLine}/${employeeShift}`))
        : baseLine;

      const empLoans = loanExcludeByEmpMap.get(empKey);
      let matchingLoan = null;
      if (empLoans && empLoans.length > 0) {
        if (!effectiveDateKey) {
          matchingLoan = empLoans[0];
        } else {
          for (let i = 0; i < empLoans.length; i++) {
            const l = empLoans[i];
            if (l.sDate && effectiveDateKey < l.sDate) continue;
            if (l.eDate && effectiveDateKey > l.eDate) continue;
            matchingLoan = l;
            break;
          }
        }
      }
      const isLoanExclude = Boolean(matchingLoan);
      const effectiveWorkDayStatus = isLoanExclude && !String(row.work_day_status || '').startsWith('1N')
        ? `1N${String(row.work_day_status || 'W').replace(/^1N/i, '')}`
        : row.work_day_status;

      const baseTask = {
        dlh_employee_id: row.dlh_employee_id,
        dlh_effective_date_time: effectiveDateKey || null,
        w_date: formattedThaiDate,
        work_day_status: effectiveWorkDayStatus,
        work_status: row.work_status,
        scan_time_in: formatToThaiBE(rawTimeIn),
        scan_time_out: formatToThaiBE(rawTimeOut),
        Shift: calculatedShift,
        Work: calculatedWork,
        OT: calculatedOt,
        OT_Type: otType,
        line_in: '',
        line_out: '',
        help_hour: 0,
        name: empInfo.name || '',
        department: empDept,
        emp_department: empDepartment,
        status: empInfo.status,
        line_check: lineCheck,
        dept: empInfo.dept || '',
        shift_h: empInfo.shift || '',
        line: empInfo.line || '',
        loan_destination: matchingLoan?.destination || '',
        is_loan_exclude: isLoanExclude,
      };
      return baseTask;
    });

    const responsePayload = {
      data: manhourTasks,
    };
    const nextManhourCache = { savedAt: Date.now(), month: requestedMonthClean, data: responsePayload };
    manhourCache.set(responseCacheKey, nextManhourCache);
    if (responseCacheKey === 'current-month' || requestedMonthClean) {
      writePersistentCache(requestedMonthClean ? `manhour-${requestedMonthClean}` : 'manhour-current-month', nextManhourCache)
        .catch(error => console.error('[manhour/cache] Save failed:', error.message));
    }
    return responsePayload;
  })();

  inFlightManhourPromises.set(responseCacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlightManhourPromises.delete(responseCacheKey);
  }
}

router.get('/', async (req, res) => {
  const requestedDates = String(req.query.dates || '')
    .split(',')
    .map(value => value.trim())
    .filter(value => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))
    .slice(0, 31);
  const requestedMonth = /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(String(req.query.month || '')) ? String(req.query.month) : null;
  const forceRefresh = req.query.refresh === '1';

  try {
    const payload = await fetchManhourData({ requestedMonth, requestedDates, forceRefresh });
    res.set('Cache-Control', 'no-store');
    return res.status(200).json(payload);
  } catch (error) {
    console.error("🚨 An error occurred in /manhour:", error);
    return res.status(500).json({
      error: "Unable to retrieve man-hour data",
      errorMessage: error.message
    });
  }
});

module.exports = router;
module.exports.default = router;
module.exports.clearManhourDataCache = clearManhourDataCache;
module.exports.broadcastManhourChange = broadcastManhourChange;
module.exports.startManhourChangeNotifier = startManhourChangeNotifier;
module.exports.fetchManhourData = fetchManhourData;

