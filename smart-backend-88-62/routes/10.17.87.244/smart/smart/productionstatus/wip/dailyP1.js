// ==========================================
// API Router สำหรับข้อมูล WIP Daily P1 (งานคงค้างในกระบวนการผลิตรายวัน P1)
// - คำนวณ Group (SMT / E-FPC), Semi-Group (Auto / Gen), Storage / Production
// - จัดการแคชข้อมูลรายวัน และส่งอัปเดตแบบ Realtime ผ่าน PostgreSQL Listen/Notify -> SSE Stream
// ==========================================
const express = require('express');
const router = express.Router();
const compression = require('compression');

// 🔹 เปิดใช้งานการบีบอัดไฟล์ (Gzip Compression) สำหรับ Router นี้
router.use(compression());

const { pool_smart } = require('../../../../config');
const query = (text, params) => pool_smart.query(text, params);
/**
 * แปลงวันที่เป็น Object { date, iso } ในรูปแบบ YYYY-MM-DD แบบปลอดภัย
 */
const safeGetDate = (value) => {
  if (!value) return { date: null, iso: null };
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const iso = value.slice(0, 10);
    return { date: new Date(iso + 'T00:00:00'), iso };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: null, iso: null };
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const iso = `${year}-${month}-${day}`;
  return { date, iso };
};
const { readPersistentCache, writePersistentCache } = require('../../../../../../Utility/persistentCache.js');

let dailyP1Cache = null;
const dailyP1DayCache = new Map();
let dailyP1NotifyClient = null;
let dailyP1NotifyRetryTimer = null;
const dailyP1EventClients = new Set();
const DAILY_P1_PERSISTED_CACHE_KEY = 'wip-daily-p1-v3';
// รายชื่อ Process ของโรงงานอื่นที่ไม่นำมารวมใน P1
const FACTORY_OTHER_PROCESSES = new Set(['CTKP', 'FTAP', 'FTKP', 'KTAK', 'KTKP', 'PTKA', 'QTKP', 'QTKP2', 'STKP', 'STKP2']);

/**
 * GET /missing-dates
 * ตรวจสอบหาวันที่ในปฏิทินที่ไม่มีข้อมูล Daily P1 บันทึกอยู่ (ใช้สำหรับ Diagnostic)
 */
router.get('/missing-dates', async (req, res) => {
  try {
    const result = await query(`
      WITH calendar AS (
        SELECT generate_series(
          date_trunc('year', CURRENT_DATE)::date,
          CURRENT_DATE,
          interval '1 day'
        )::date AS date
      ), present AS (
        SELECT DISTINCT to_char(effective_date::date, 'YYYY-MM-DD') AS date
        FROM smart.smart_wip_daily_p1
        WHERE effective_date::date BETWEEN date_trunc('year', CURRENT_DATE)::date AND CURRENT_DATE
      )
      SELECT to_char(calendar.date, 'YYYY-MM-DD') AS date
      FROM calendar
      LEFT JOIN present ON present.date = to_char(calendar.date, 'YYYY-MM-DD')
      WHERE present.date IS NULL
      ORDER BY calendar.date
    `);
    const checked = await query(`
      SELECT
        to_char(date_trunc('year', CURRENT_DATE)::date, 'YYYY-MM-DD') AS checked_from,
        to_char(CURRENT_DATE, 'YYYY-MM-DD') AS checked_to
    `);
    res.json({ ...checked.rows[0], missing_dates: result.rows.map(row => row.date) });
  } catch (error) {
    console.error('[daily-p1/missing-dates] failed:', error.message);
    res.status(500).json({ error: 'ตรวจสอบวันที่หายไม่สำเร็จ' });
  }
});

// SSE stream น้ำหนักเบา: ส่งเฉพาะข้อมูลของวันล่าสุดให้กับ Client เพื่อประหยัด Bandwidth
router.get('/stream', async (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders?.();
  let closed = false;
  dailyP1EventClients.add(res);
  const heartbeat = setInterval(() => { if (!closed) res.write(': heartbeat\n\n'); }, 15000);
  req.on('close', () => { closed = true; dailyP1EventClients.delete(res); clearInterval(heartbeat); });
});

function broadcastDailyP1Change(date) {
  const rows = filterFactoryProcesses(filterDate(dailyP1Cache?.data || [], date));
  const message = `event: wip-update\ndata: ${JSON.stringify({ changedDate: date, rows })}\n\n`;
  dailyP1EventClients.forEach(client => client.write(message));
}

function retryDailyP1Notifier() {
  if (dailyP1NotifyRetryTimer) return;
  dailyP1NotifyRetryTimer = setTimeout(() => {
    dailyP1NotifyRetryTimer = null;
    startDailyP1Notifier().catch(error => console.error('[daily-p1/events] reconnect failed:', error.message));
  }, 5000);
}

async function startDailyP1Notifier() {
  if (dailyP1NotifyClient) return;
  let client;
  try {
    client = await pool_smart.connect();
    await client.query(`
      CREATE OR REPLACE FUNCTION smart.notify_daily_p1_change() RETURNS trigger AS $$
      BEGIN
        PERFORM pg_notify('daily_p1_changed', COALESCE(NEW.effective_date, OLD.effective_date)::date::text);
        RETURN COALESCE(NEW, OLD);
      END; $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS daily_p1_changed_trigger ON smart.smart_wip_daily_p1;
      CREATE TRIGGER daily_p1_changed_trigger AFTER INSERT OR UPDATE OR DELETE
        ON smart.smart_wip_daily_p1 FOR EACH ROW EXECUTE FUNCTION smart.notify_daily_p1_change();
      LISTEN daily_p1_changed;
    `);
    client.on('notification', async notification => {
      if (notification.channel !== 'daily_p1_changed') return;
      const date = String(notification.payload || '').slice(0, 10);
      try {
        const port = process.env.PORT || 8085;
        await fetch(`http://127.0.0.1:${port}/api_p1/production_status/wip/daily-p1?refresh=1&delta=1`);
        broadcastDailyP1Change(date);
      } catch (error) {
        console.error('[daily-p1/events] refresh failed:', error.message);
      }
    });
    client.on('error', error => { dailyP1NotifyClient = null; console.error('[daily-p1/events] listener failed:', error.message); retryDailyP1Notifier(); });
    client.on('end', () => { dailyP1NotifyClient = null; retryDailyP1Notifier(); });
    dailyP1NotifyClient = client;
    console.log('[daily-p1/events] Listening for PostgreSQL changes.');
  } catch (error) {
    client?.release?.(error);
    retryDailyP1Notifier();
  }
}

startDailyP1Notifier();

function filterFactoryProcesses(rows = []) {
  return rows.filter(row => {
    const factory = String(row.factory ?? '').trim().toUpperCase();
    return factory === '9' || FACTORY_OTHER_PROCESSES.has(String(row.proc_disp || '').trim().toUpperCase());
  });
}

// ฟังก์ชันช่วยหาช่วงวันที่ของปีปัจจุบัน (1 ม.ค. ถึง 31 ธ.ค.)
function getCurrentYearDateRange() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const startDate = new Date(currentYear, 0, 1); // 1 มกราคม ของปีปัจจุบัน
  const endDate = new Date(currentYear, 11, 31); // 31 ธันวาคม ของปีปัจจุบัน
  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0]
  };
}

// ฟังก์ชันช่วยสำหรับตรรกะการคำนวณแบบ DAX
function calculateGroupName(procDisp) {
  if (["SENT", "FFPC", "MFPC", "PAKS"].includes(procDisp)) {
    return "Storage";
  }
  return "Production";
}

function calculateGroup(lotPrdName, procDisp) {
  const productChar4 = lotPrdName && lotPrdName.length >= 4 ? lotPrdName.charAt(3) : ''; // ตัวอักษรตัวที่ 4
  const processStart = procDisp ? procDisp.charAt(0) : ''; // ตัวอักษรตัวแรก

  if (productChar4 === "Z" && processStart === "M") {
    return "SMT";
  }
  return "E-FPC";
}

function calculateSemiGroup(lotPrdName, currentGroup) {
  const product4Char = lotPrdName ? lotPrdName.substring(0, 4) : '';
  const product3Char = lotPrdName ? lotPrdName.substring(0, 3) : '';

  if (currentGroup === "SMT") {
    if (["ICIZ", "KITZ", "VLOZ", "VTNZ"].includes(product4Char)) return "SMT-AUTO";
    return "SMT-GEN";
  } else if (currentGroup === "E-FPC") {
    if (["ICI", "KIT", "VLO", "VTN"].includes(product3Char)) return "E-FPC-AUTO";
    return "E-FPC-GEN";
  }
  return ''; // ค่าเริ่มต้นเมื่อไม่อยู่ในกลุ่ม SMT หรือ E-FPC
}

// ฟังก์ชันช่วยประมวลผลข้อมูลแถวเดี่ยวและเติม Calculated Fields
function processDailyP1Row(row) {
  const group = row.group || calculateGroup(row.lot_prd_name, row.proc_disp);
  return {
    ...row,
    group_name: row.group_name || calculateGroupName(row.proc_disp),
    group: group,
    semi_group: row.semi_group || calculateSemiGroup(row.lot_prd_name, group)
  };
}

function compactDailyRows(rows = []) {
  const compacted = new Map();
  rows.forEach(row => {
    const date = safeGetDate(row.effective_date).iso;
    if (!date) return;
    // เพิ่ม wip_scan_in, lead_time_wip_days และ lead_time_group ใน key เพื่อให้การรวมข้อมูลพิจารณาด้วย
    const key = `${date}\u0000${row.factory || ''}\u0000${row.lot_prd_name || ''}\u0000${row.proc_disp || ''}\u0000${row.lot_status || ''}\u0000${row.lot_no || ''}\u0000${row.wip_scan_in || ''}\u0000${row.lead_time_wip_days || ''}\u0000${row.lead_time_group || ''}\u0000${row.group_name || ''}\u0000${row.group || ''}\u0000${row.semi_group || ''}`;
    const current = compacted.get(key);
    if (current) {
      current.lot_qty += Number(row.lot_qty || 0);
    } else {
      compacted.set(key, {
        effective_date: date,
        factory: row.factory,
        lot_no: row.lot_no,
        wip_scan_in: row.wip_scan_in,
        lead_time_wip_days: row.lead_time_wip_days,
        lead_time_group: row.lead_time_group,
        lot_prd_name: row.lot_prd_name,
        proc_disp: row.proc_disp,
        lot_status: row.lot_status,
        lot_qty: Number(row.lot_qty || 0),
        group_name: row.group_name,
        group: row.group,
        semi_group: row.semi_group,
      });
    }
  });
  return [...compacted.values()];
}

function filterLatestDay(rows = []) {
  const latestDate = rows.reduce((latest, row) => {
    const date = safeGetDate(row.effective_date).iso;
    return date && date > latest ? date : latest;
  }, '');
  return latestDate ? rows.filter(row => safeGetDate(row.effective_date).iso === latestDate) : [];
}

function filterDate(rows = [], date) {
  return rows.filter(row => safeGetDate(row.effective_date).iso === date);
}

let isRevalidating = false;

/**
 * ดึงเดือนปัจจุบันในรูปแบบ YYYY-MM (เวลา Asia/Bangkok)
 */
function getCurrentMonthString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit'
  }).format(new Date());
}

/**
 * โหลดข้อมูลแคชจากดิสก์เข้าสู่ RAM หากยังไม่ได้โหลด
 */
async function ensureDailyP1Loaded() {
  if (dailyP1Cache && dailyP1Cache.data && dailyP1Cache.data.length > 0) {
    return dailyP1Cache;
  }
  try {
    let persisted = await readPersistentCache(DAILY_P1_PERSISTED_CACHE_KEY);
    const persistedRows = persisted?.days?.flatMap(([, value]) => value?.data || []) || persisted?.data || [];
    if (persistedRows.length > 0 && !Object.prototype.hasOwnProperty.call(persistedRows[0], 'factory')) {
      persisted = null;
    }
    if (persisted) {
      const { start: currentYearStart, end: currentYearEnd } = getCurrentYearDateRange();
      if (persisted.days && persisted.days.length > 0) {
        (persisted.days || []).forEach(([date, value]) => {
          const processedDayData = (value?.data || []).map(processDailyP1Row);
          if (date >= currentYearStart && date <= currentYearEnd) {
            dailyP1DayCache.set(date, { ...value, data: compactDailyRows(processedDayData) });
          }
        });
        const processedDataForCache = [...dailyP1DayCache.keys()].sort().flatMap(date => dailyP1DayCache.get(date)?.data || []);
        dailyP1Cache = { savedAt: persisted.savedAt || Date.now(), data: processedDataForCache };
        return dailyP1Cache;
      } else if (persisted.data) {
        const processedDataForCache = compactDailyRows((persisted.data || []).filter(row => {
          const effectiveDate = safeGetDate(row.effective_date).iso;
          return effectiveDate >= currentYearStart && effectiveDate <= currentYearEnd;
        }).map(row => {
          const group = row.group || calculateGroup(row.lot_prd_name, row.proc_disp);
          return {
            ...row,
            group_name: row.group_name || calculateGroupName(row.proc_disp),
            group: group,
            semi_group: row.semi_group || calculateSemiGroup(row.lot_prd_name, group)
          };
        }));
        dailyP1Cache = { savedAt: persisted.savedAt || Date.now(), data: processedDataForCache };
        return dailyP1Cache;
      }
    }
  } catch (err) {
    console.warn('[daily-p1/cache] Error loading from disk:', err.message);
  }
  return null;
}

/**
 * Revalidate ตรวจสอบและอัปเดตข้อมูลจาก PostgreSQL ในเบื้องหลัง
 */
async function refreshDailyP1FromDatabase() {
  if (isRevalidating) return;
  isRevalidating = true;
  try {
    const { start: currentYearStart, end: currentYearEnd } = getCurrentYearDateRange();
    const subqueryForChecksum = `
        WITH daily_p1_base_data AS (
            SELECT
                dp1.factory,
                dp1.lot_prd_name,
                dp1.proc_disp,
                dp1.lot_status,
                dp1.lot_no,
                to_char(dp1.effective_date, 'YYYY-MM-DD') AS effective_date,
                SUM(COALESCE(dp1.lot_qty, 0)) AS lot_qty,
                MAX(hist.wip_scan_in) AS wip_scan_in,
                 (dp1.effective_date - MAX(hist.wip_scan_in::date)) AS lead_time_wip_days
            FROM smart.smart_wip_daily_p1 dp1
            LEFT JOIN smart.smart_fpc_lot_wip_history hist ON
                hist.lot = dp1.lot_no AND
                hist.proc_disp = dp1.proc_disp AND
                hist.wip_scan_in <= dp1.effective_date
            WHERE to_char(dp1.effective_date, 'YYYY-MM-DD') >= '${currentYearStart}' AND to_char(dp1.effective_date, 'YYYY-MM-DD') <= '${currentYearEnd}'
            GROUP BY
                dp1.factory, dp1.lot_prd_name, dp1.proc_disp, dp1.lot_status, dp1.lot_no, dp1.effective_date
        )
        SELECT
            lot_prd_name,
            factory,
            proc_disp,
            lot_status,
            lot_no,
            effective_date,
            lot_qty,
            wip_scan_in,
            lead_time_wip_days,
            CASE
                WHEN wip_scan_in IS NULL OR lead_time_wip_days IS NULL OR lead_time_wip_days <= 3 THEN '(1) : 0-3 Day'
                WHEN lead_time_wip_days > 3 AND lead_time_wip_days <= 9 THEN '(2) : 4-9 Day'
                WHEN lead_time_wip_days > 9 AND lead_time_wip_days <= 29 THEN '(3) : 10-29 Day'
                WHEN lead_time_wip_days > 29 AND lead_time_wip_days <= 99 THEN '(4) : 30-99 Day'
                WHEN lead_time_wip_days > 99 AND lead_time_wip_days <= 364 THEN '(5) : 100-364 Day'
                WHEN lead_time_wip_days > 364 THEN '(6) : More 365 Days'
                ELSE NULL
            END AS lead_time_group
        FROM daily_p1_base_data
    `;

    const versionResult = await query(`
      SELECT
        effective_date AS work_date,
        COUNT(*)::bigint AS row_count,
        COALESCE(SUM(lot_qty), 0)::text AS qty_checksum,
        COALESCE(SUM(hashtext(
          COALESCE(lot_prd_name::text, '') || '|' || COALESCE(proc_disp::text, '') || '|' ||
          COALESCE(lot_no::text, '') || '|' || COALESCE(lot_status::text, '') || '|' ||
          COALESCE(wip_scan_in::text, '') || '|' ||
          COALESCE(lead_time_group::text, '')
        )), 0)::text AS field_checksum
       FROM (${subqueryForChecksum}) AS subquery_data
      GROUP BY effective_date
      ORDER BY effective_date
    `);
    const currentVersions = new Map(versionResult.rows.map(row => {
      const date = safeGetDate(row.work_date).iso;
      return [date, `${row.row_count}:${row.qty_checksum}:${row.field_checksum}`];
    }));
    const changedDates = [...currentVersions.entries()]
      .filter(([date, version]) => dailyP1DayCache.get(date)?.version !== version)
      .map(([date]) => date);
    const removedDates = [...dailyP1DayCache.keys()].filter(date => !currentVersions.has(date));
    removedDates.forEach(date => dailyP1DayCache.delete(date));

    if (changedDates.length > 0) {
      const placeholders = changedDates.map((_, i) => `$${i + 1}`).join(', ');
      const dailyP1Query = `
        WITH daily_p1_base_data AS (
            SELECT
                dp1.factory,
                dp1.lot_prd_name,
                dp1.proc_disp,
                dp1.lot_status,
                dp1.lot_no,
                to_char(dp1.effective_date, 'YYYY-MM-DD') AS effective_date,
                SUM(COALESCE(dp1.lot_qty, 0)) AS lot_qty,
                MAX(hist.wip_scan_in) AS wip_scan_in,
                 (dp1.effective_date - MAX(hist.wip_scan_in::date)) AS lead_time_wip_days
            FROM smart.smart_wip_daily_p1 dp1
            LEFT JOIN smart.smart_fpc_lot_wip_history hist ON
                hist.lot = dp1.lot_no AND
                hist.proc_disp = dp1.proc_disp AND
                hist.wip_scan_in <= dp1.effective_date
            WHERE to_char(dp1.effective_date, 'YYYY-MM-DD') IN (${placeholders})
            GROUP BY
                dp1.factory, dp1.lot_prd_name, dp1.proc_disp, dp1.lot_status, dp1.lot_no, dp1.effective_date
        )
        SELECT
            lot_prd_name,
            factory,
            proc_disp,
            lot_status,
            lot_no,
            effective_date,
            lot_qty,
            wip_scan_in,
            lead_time_wip_days,
            CASE
                WHEN wip_scan_in IS NULL OR lead_time_wip_days IS NULL OR lead_time_wip_days <= 3 THEN '(1) : 0-3 Day'
                WHEN lead_time_wip_days > 3 AND lead_time_wip_days <= 9 THEN '(2) : 4-9 Day'
                WHEN lead_time_wip_days > 9 AND lead_time_wip_days <= 29 THEN '(3) : 10-29 Day'
                WHEN lead_time_wip_days > 29 AND lead_time_wip_days <= 99 THEN '(4) : 30-99 Day'
                WHEN lead_time_wip_days > 99 AND lead_time_wip_days <= 364 THEN '(5) : 100-364 Day'
                WHEN lead_time_wip_days > 364 THEN '(6) : More 365 Days'
                ELSE NULL
            END AS lead_time_group
        FROM daily_p1_base_data
        ORDER BY
            effective_date, proc_disp, lot_prd_name, lot_status
      `;
      const dailyP1Result = await query(dailyP1Query, changedDates);
      const rowsByDate = new Map(changedDates.map(date => [date, []]));

      (dailyP1Result.rows || []).forEach(row => {
        const effectiveDateObj = safeGetDate(row.effective_date);
        const processedRow = processDailyP1Row({
          effective_date: effectiveDateObj.iso,
          factory: row.factory,
          lot_prd_name: row.lot_prd_name,
          lot_no: row.lot_no,
          wip_scan_in: row.wip_scan_in,
          lead_time_wip_days: row.lead_time_wip_days,
          lead_time_group: row.lead_time_group,
          proc_disp: row.proc_disp,
          lot_status: row.lot_status,
          lot_qty: Number(row.lot_qty || 0),
        });
        rowsByDate.get(effectiveDateObj.iso)?.push(processedRow);
      });
      changedDates.forEach(date => {
        dailyP1DayCache.set(date, {
          version: currentVersions.get(date),
          data: rowsByDate.get(date) || [],
        });
      });
    }

    const dailyP1Tasks = [...dailyP1DayCache.keys()]
      .sort()
      .flatMap(date => dailyP1DayCache.get(date)?.data || []);
    dailyP1Cache = { savedAt: Date.now(), data: dailyP1Tasks };
    writePersistentCache(DAILY_P1_PERSISTED_CACHE_KEY, {
      ...dailyP1Cache,
      days: [...dailyP1DayCache.entries()],
    }).catch(error => console.error('[daily-p1/cache] Save failed:', error.message));
  } catch (err) {
    console.error('⚠️ [daily-p1] Background revalidation failed:', err.message);
  } finally {
    isRevalidating = false;
  }
}

// ==============================================
// 📊 GET /daily-p1: Multi-Tier SWR & Immutable Caching
// ==============================================
router.get('/', async (req, res) => {
  const isRefresh = req.query.refresh === '1';
  const latestOnly = req.query.latest === '1';
  const deltaOnly = req.query.delta === '1';
  const requestedDate = typeof req.query.date === 'string' ? req.query.date.trim() : '';
  const curMonth = getCurrentMonthString();

  const selectResponseRows = rows => requestedDate
    ? filterDate(rows, requestedDate)
    : latestOnly ? filterLatestDay(rows) : rows;

  // 1. Force Refresh: คำนวณสดจาก DB
  if (isRefresh) {
    dailyP1Cache = null;
    dailyP1DayCache.clear();
    await refreshDailyP1FromDatabase();
    const data = deltaOnly ? [] : selectResponseRows(dailyP1Cache?.data || []);
    return res.status(200).json(filterFactoryProcesses(data));
  }

  // 2. โหลดแคชจาก RAM หรือ Persistent Disk
  await ensureDailyP1Loaded();

  if (dailyP1Cache && dailyP1Cache.data && dailyP1Cache.data.length > 0) {
    const isPast = requestedDate ? requestedDate.slice(0, 7) < curMonth : false;
    const isStale = (Date.now() - (dailyP1Cache.savedAt || 0)) > 20000;

    // สำหรับเดือนปัจจุบัน: ถ้าแคชเก่ากว่า 20 วิ ให้สั่ง Revalidate เบื้องหลัง
    if (!isPast && isStale && !isRevalidating) {
      setImmediate(() => refreshDailyP1FromDatabase().catch(() => {}));
    }

    res.set('X-Data-Cache', isPast ? 'IMMUTABLE' : (isStale ? 'STALE' : 'HIT'));
    const responseData = deltaOnly
      ? []
      : selectResponseRows(dailyP1Cache.data);
    return res.status(200).json(filterFactoryProcesses(responseData));
  }

  // 3. Cold start (กรณีไม่มีแคชเลย)
  try {
    await refreshDailyP1FromDatabase();
    const responseData = deltaOnly
      ? []
      : selectResponseRows(dailyP1Cache?.data || []);
    return res.status(200).json(filterFactoryProcesses(responseData));
  } catch (dailyError) {
    console.error("🚨 เกิดข้อผิดพลาดในการดึงข้อมูล Daily P1:", dailyError.code || '', dailyError.message);
    if (dailyP1Cache) {
      res.set('X-Data-Cache', 'STALE');
      return res.status(200).json(filterFactoryProcesses(dailyP1Cache.data));
    }
    return res.status(500).json({ error: "ไม่สามารถดึงข้อมูล Daily P1 ได้" });
  }
});

module.exports = router;