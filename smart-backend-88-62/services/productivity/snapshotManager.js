const { pool_test, pool_ot } = require('../../routes/10.17.87.244/config');
const mariaPool = pool_ot;
const poolTest = pool_test;

// Self-contained lightweight dayjs-compatible helper
function dayjs(input) {
  const d = input ? (input instanceof Date ? new Date(input.getTime()) : new Date(input)) : new Date();
  return {
    toDate: () => d,
    isValid: () => !isNaN(d.getTime()),
    format: (fmt = 'YYYY-MM-DD') => {
      if (isNaN(d.getTime())) return '';
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const s = String(d.getSeconds()).padStart(2, '0');
      if (fmt === 'YYYY-MM') return y + '-' + m;
      if (fmt === 'YYYY') return String(y);
      if (fmt === 'YYYY-MM-DD HH:mm:ss') return `${y}-${m}-${day} ${h}:${min}:${s}`;
      return y + '-' + m + '-' + day;
    }
  };
}

// Ensure manpower_snapshot_log table exists
(async () => {
  try {
    await poolTest.query(`
      CREATE TABLE IF NOT EXISTS public.manpower_snapshot_log (
        id SERIAL PRIMARY KEY,
        snapshot_date DATE NOT NULL,
        sync_type VARCHAR(50) NOT NULL,
        total_records INT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('[SnapshotManager] Failed ensuring manpower_snapshot_log table:', err.message);
  }
})();

// Get current date, hour, and minute specifically in Thailand Time Zone (Asia/Bangkok - UTC+7)
const getThaiTimeInfo = () => {
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now); // Output: YYYY-MM-DD

  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(yesterdayDate);

  const currentHour = parseInt(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    hour: 'numeric',
    hour12: false
  }).format(now), 10);

  const currentMinute = parseInt(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    minute: 'numeric'
  }).format(now), 10);

  const timeMinutes = currentHour * 60 + currentMinute;

  // Factory 09:00 AM cutoff rule:
  // Production output of day D closes at 09:00 AM on D+1.
  // Before 09:00 AM, the latest finalized production day is D-2.
  // At or after 09:00 AM, the latest finalized production day is D-1 (yesterday).
  const cutoffDays = currentHour < 9 ? 2 : 1;
  const cutoffDate = new Date(now.getTime() - cutoffDays * 24 * 60 * 60 * 1000);
  const cutoffYesterdayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(cutoffDate);

  return { todayStr, yesterdayStr, cutoffYesterdayStr, currentHour, currentMinute, timeMinutes };
};

const snapshotQuery = `
  SELECT
    employee_code AS code,
    employee_name AS name,
    department,
    shift,
    line_name AS line,
    dept
  FROM public.manpower_snapshot
  WHERE snapshot_date = (
    SELECT MAX(snapshot_date)
    FROM public.manpower_snapshot
    WHERE snapshot_date <= $1
  )
  ORDER BY employee_code
`;

const earliestSnapshotQuery = `
  SELECT
    employee_code AS code,
    employee_name AS name,
    department,
    shift,
    line_name AS line,
    dept
  FROM public.manpower_snapshot
  WHERE snapshot_date = (
    SELECT MIN(snapshot_date)
    FROM public.manpower_snapshot
  )
  ORDER BY employee_code
`;

let cachedMasterData = null;
let lastMasterFetchTime = 0;

const getMasterEmployeeData = async (forceFresh = false) => {
  const now = Date.now();
  if (!forceFresh && cachedMasterData && (now - lastMasterFetchTime < 5 * 60 * 1000)) {
    return cachedMasterData;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const rawMaria = await mariaPool.query(`
        SELECT code, name, department, dept, shift, line 
        FROM tbl_employee_help
      `);
      const mariaData = Array.isArray(rawMaria) ? (Array.isArray(rawMaria[0]) ? rawMaria[0] : rawMaria) : [];
      cachedMasterData = mariaData;
      lastMasterFetchTime = now;
      return mariaData;
    } catch (err) {
      if (attempt < 3 && (err.code === 'ER_CON_COUNT_ERROR' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT')) {
        console.warn(`[SnapshotManager] MariaDB busy (${err.code}), retrying in ${attempt * 1000}ms (attempt ${attempt}/3)...`);
        await new Promise(r => setTimeout(r, attempt * 1000));
      } else {
        if (cachedMasterData && cachedMasterData.length > 0) {
          console.warn(`[SnapshotManager] MariaDB query failed (${err.message}). Using cached master data (${cachedMasterData.length} emps).`);
          return cachedMasterData;
        }
        throw err;
      }
    }
  }
};

/**
 * Helper to insert full snapshot batch into public.manpower_snapshot
 */
async function insertSnapshotBatch(client, snapshotDate, employees) {
  // Load cost centers mapping for line_out
  const ccMap = new Map();
  try {
    const ccRes = await client.query('SELECT cost_center_code, cost_center_name, line_out FROM public.cost_centers');
    ccRes.rows.forEach(r => {
      if (r.cost_center_code && r.line_out) ccMap.set(r.cost_center_code.trim().toUpperCase(), r.line_out.trim());
      if (r.cost_center_name && r.line_out) ccMap.set(r.cost_center_name.trim().toUpperCase(), r.line_out.trim());
    });
  } catch (_) {}

  const BATCH_SIZE = 500;
  for (let i = 0; i < employees.length; i += BATCH_SIZE) {
    const batch = employees.slice(i, i + BATCH_SIZE);
    const placeholders = [];
    const values = [];
    let pIdx = 1;

    batch.forEach(e => {
      const deptStr = (e.department || '').trim();
      const ccCode = (deptStr.match(/^[A-Za-z0-9-]+/) || [''])[0].toUpperCase();
      const lineOut = ccMap.get(deptStr.toUpperCase()) || ccMap.get(ccCode) || (e.line && e.shift ? `${e.line}/${e.shift}` : e.line || '');

      placeholders.push(`($${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}, $${pIdx+5}, $${pIdx+6}, $${pIdx+7})`);
      values.push(snapshotDate, String(e.code || '').trim(), e.name || '', e.department || '', e.shift || '', e.line || '', e.dept || '', lineOut);
      pIdx += 8;
    });

    await client.query(`
      INSERT INTO public.manpower_snapshot (
        snapshot_date, employee_code, employee_name, department, shift, line_name, dept, line_out
      )
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (snapshot_date, employee_code) DO UPDATE SET
        employee_name = EXCLUDED.employee_name,
        department = EXCLUDED.department,
        shift = EXCLUDED.shift,
        line_name = EXCLUDED.line_name,
        dept = EXCLUDED.dept,
        line_out = COALESCE(NULLIF(EXCLUDED.line_out, ''), public.manpower_snapshot.line_out),
        updated_at = NOW()
    `, values);
  }
}

/**
 * Helper to bulk populate historical snapshot across a list of dates (e.g. all days of August)
 */
const populateHistoricalManpowerForDates = async (dateList, employees) => {
  if (!dateList || dateList.length === 0 || !employees || employees.length === 0) {
    throw new Error('dateList and employees array must not be empty');
  }
  const client = await poolTest.connect();
  try {
    await client.query('BEGIN');
    for (const d of dateList) {
      await insertSnapshotBatch(client, d, employees);
    }
    await client.query(`
      INSERT INTO public.manpower_snapshot_log (snapshot_date, sync_type, total_records)
      VALUES ($1, $2, $3)
    `, [dateList[0], `HISTORICAL_BATCH_${dateList.length}_DAYS`, employees.length]);
    await client.query('COMMIT');
    console.log(`[SnapshotManager] Successfully populated historical snapshot for ${dateList.length} dates (${employees.length} employees per date).`);
    return { success: true, totalDates: dateList.length, totalEmployees: employees.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Smart Manpower Snapshot on Change:
 * Checks tbl_employee_help daily.
 * - If NO changes (no line/shift/dept changes, no new/removed employees):
 *   -> SKIPS saving (0 rows stored, logged as NO_CHANGE_SKIPPED).
 * - If CHANGES detected (new hires, resignations, line/shift/cost center changes):
 *   -> Saves today's full snapshot table (~1,479 emps).
 */
let isManpowerSyncing = false;

const syncSmartManpower = async (dateStr, syncType = 'daily_check') => {
  const { todayStr } = getThaiTimeInfo();
  if (dateStr > todayStr) {
    console.warn(`[SnapshotManager] Cannot sync manpower snapshot for future date: ${dateStr}. Skipping.`);
    return { changed: false, reason: 'FUTURE_DATE_SKIPPED' };
  }

  if (isManpowerSyncing) {
    console.log(`[SnapshotManager] Manpower sync already in progress. Skipping concurrent request for ${dateStr}.`);
    return { changed: false, reason: 'CONCURRENT_SKIPPED' };
  }
  isManpowerSyncing = true;
  try {
    const mariaData = await getMasterEmployeeData(true);
    if (!mariaData || mariaData.length === 0) {
      console.warn(`[SnapshotManager] No employee data retrieved from MariaDB for ${dateStr}.`);
      return { changed: false, reason: 'NO_DATA' };
    }

    const client = await poolTest.connect();
    try {
      await client.query('BEGIN');

      // 1. If snapshot already exists for dateStr today with >= 1000 employees, skip duplicate insert
      const existsRes = await client.query(
        'SELECT count(*) as count FROM public.manpower_snapshot WHERE snapshot_date = $1',
        [dateStr]
      );
      const todayCount = parseInt(existsRes.rows[0]?.count || '0', 10);
      if (todayCount >= 1000 && syncType !== 'force') {
        await client.query('COMMIT');
        return { changed: false, reason: 'ALREADY_EXISTS_FOR_TODAY', totalActive: todayCount };
      }

      // 2. Fetch the latest prior snapshot date before dateStr
      const maxDateRes = await client.query(
        'SELECT MAX(snapshot_date)::text as max_date FROM public.manpower_snapshot WHERE snapshot_date < $1',
        [dateStr]
      );
      const prevDate = maxDateRes.rows[0]?.max_date;

      // 3. If no prior snapshot exists at all, this is the initial baseline -> Save full table
      if (!prevDate) {
        console.log(`[SnapshotManager] Initializing baseline manpower snapshot for ${dateStr} (${mariaData.length} emps)...`);
        await insertSnapshotBatch(client, dateStr, mariaData);
        await client.query(`
          INSERT INTO public.manpower_snapshot_log (snapshot_date, sync_type, total_records)
          VALUES ($1, 'INITIAL_BASELINE', $2)
        `, [dateStr, mariaData.length]);
        await client.query('COMMIT');
        return { changed: true, reason: 'INITIAL_BASELINE', totalActive: mariaData.length };
      }

      // 4. Fetch previous snapshot's employee map to compare
      const prevRes = await client.query(`
        SELECT employee_code, employee_name, department, shift, line_name, dept
        FROM public.manpower_snapshot
        WHERE snapshot_date = $1
      `, [prevDate]);

      const prevMap = new Map();
      prevRes.rows.forEach(r => prevMap.set(r.employee_code.trim(), r));

      const newEmployees = [];
      const changedEmployees = [];
      const mariaCodeSet = new Set();

      mariaData.forEach(e => {
        const code = (e.code || '').trim();
        mariaCodeSet.add(code);
        const prev = prevMap.get(code);

        if (!prev) {
          newEmployees.push(e);
        } else {
          const curDept = (prev.department || '').trim();
          const newDept = (e.department || '').trim();
          const curShift = (prev.shift || '').trim();
          const newShift = (e.shift || '').trim();
          const curLine = (prev.line_name || '').trim();
          const newLine = (e.line || '').trim();

          if (curDept !== newDept || curShift !== newShift || curLine !== newLine) {
            changedEmployees.push({ code, prev, current: e });
          }
        }
      });

      const removedEmployees = [];
      prevRes.rows.forEach(r => {
        if (!mariaCodeSet.has(r.employee_code.trim())) {
          removedEmployees.push(r);
        }
      });

      const hasChanges = newEmployees.length > 0 || changedEmployees.length > 0 || removedEmployees.length > 0;

      // Always save full employee snapshot table for dateStr to support independent per-day cost center adjustments
      await insertSnapshotBatch(client, dateStr, mariaData);

      const logType = hasChanges 
        ? `${syncType}_delta(+${newEmployees.length}/~${changedEmployees.length}/-${removedEmployees.length})`
        : `${syncType}_unchanged`;

      await client.query(`
        INSERT INTO public.manpower_snapshot_log (snapshot_date, sync_type, total_records)
        VALUES ($1, $2, $3)
      `, [dateStr, logType, mariaData.length]);

      await client.query('COMMIT');
      console.log(`[SnapshotManager] Saved manpower snapshot for ${dateStr} (${mariaData.length} emps, ${hasChanges ? 'changes detected' : 'baseline unchanged'}).`);

      return {
        changed: hasChanges,
        reason: hasChanges ? 'DELTA_APPLIED' : 'DAILY_BASELINE_SAVED',
        newEmployees: newEmployees.length,
        changedEmployees: changedEmployees.length,
        removed: removedEmployees.length,
        totalActive: mariaData.length
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`[SnapshotManager] Failed syncing manpower snapshot for ${dateStr}:`, error);
    throw error;
  } finally {
    isManpowerSyncing = false;
  }
};

/**
 * Clean up historical manpower snapshots based on ~45-day retention rule:
 * - Allows retroactive cost center adjustments for Month M up to the 15th of Month M+1.
 * - If currentDay >= 15: cutoff is 1st of previous month (e.g. Sep 15 -> cutoff 2026-08-01, purges < Aug 1).
 * - If currentDay < 15: cutoff is 1st of 2 months ago (e.g. Sep 1-14 -> cutoff 2026-07-01, purges < Jul 1).
 */
const cleanupOldManpowerSnapshots = async () => {
  const { todayStr } = getThaiTimeInfo();
  const now = new Date();
  const currentDay = now.getDate();

  // If day of month is 15 or later, cutoff is start of previous month (retains current month + previous month)
  // If day of month is before 15, cutoff is start of 2 months ago (retains current month + previous month + prior month)
  const monthsToRetain = currentDay >= 15 ? 1 : 2;
  const cutoffDateObj = new Date(now.getFullYear(), now.getMonth() - monthsToRetain, 1);
  const cutoffDate = `${cutoffDateObj.getFullYear()}-${String(cutoffDateObj.getMonth() + 1).padStart(2, '0')}-01`;

  console.log(`[SnapshotManager] Running cleanupOldManpowerSnapshots (Day: ${currentDay}, Cutoff: ${cutoffDate})...`);

  try {
    const delRes = await poolTest.query(`
      DELETE FROM public.manpower_snapshot
      WHERE snapshot_date < $1::date
    `, [cutoffDate]);

    const purgedCount = delRes.rowCount || 0;
    if (purgedCount > 0) {
      console.log(`[SnapshotManager] Successfully purged ${purgedCount} historical manpower snapshot records (< ${cutoffDate}).`);
      await poolTest.query(`
        INSERT INTO public.manpower_snapshot_log (snapshot_date, sync_type, total_records)
        VALUES ($1, 'RETENTION_PURGE', $2)
      `, [todayStr, purgedCount]);

      // Reclaim disk space and update statistics
      try {
        await poolTest.query(`VACUUM (ANALYZE) public.manpower_snapshot;`);
        console.log('[SnapshotManager] Vacuum & analyze completed on manpower_snapshot.');
      } catch (vErr) {
        console.warn('[SnapshotManager] Post-cleanup vacuum error:', vErr.message);
      }
    } else {
      console.log(`[SnapshotManager] No historical manpower snapshots older than ${cutoffDate} to purge.`);
    }

    return { success: true, purgedCount, cutoffDate };
  } catch (err) {
    console.error('[SnapshotManager] cleanupOldManpowerSnapshots error:', err.message);
    return { success: false, error: err.message };
  }
};

// Backward-compatible alias
const takeSnapshotForDate = syncSmartManpower;

const getEmployeeDataForDate = async (dateStr) => {
  const snapshotResult = await poolTest.query(snapshotQuery, [dateStr]);

  // If snapshot exists on or before dateStr with high coverage (>= 1,000 employees), return directly
  if (snapshotResult.rows.length >= 1000) {
    return snapshotResult.rows;
  }

  // Fallback to earliest recorded snapshot
  const earliestResult = await poolTest.query(earliestSnapshotQuery);
  if (earliestResult.rows.length >= 1000) {
    return earliestResult.rows;
  }

  // Otherwise, fallback to MariaDB Master to guarantee employees are available
  try {
    const masterData = await getMasterEmployeeData();
    return masterData || [];
  } catch (err) {
    console.error('[SnapshotManager] Fallback to master data failed:', err.message);
    if (snapshotResult.rows.length > 0) return snapshotResult.rows;
    return [];
  }
};

// Output Snapshot Utilities (PostgreSQL public.output_daily_snapshot)
const getDailyOutputSnapshot = async ({ startDate, endDate, lineGroups, facUnits, factory }) => {
  try {
    let query = `
      SELECT 
        output_date::text as output_date,
        factory,
        line_group,
        process_name,
        mc_line,
        prd_name,
        actual_lot_qty::float as actual_lot_qty,
        actual_sht_qty::float as actual_sht_qty,
        actual_piece_qty::float as actual_piece_qty,
        fac_unit_code
      FROM public.output_daily_snapshot
      WHERE output_date >= $1 AND output_date <= $2
    `;
    const params = [startDate, endDate];
    let pIdx = 3;

    if (factory && factory !== 'ALL') {
      query += ` AND factory = $${pIdx++}`;
      params.push(factory);
    }
    if (lineGroups && lineGroups.length > 0 && !lineGroups.includes('ALL')) {
      const expandedGroups = new Set();
      lineGroups.forEach(g => {
        expandedGroups.add(g);
        const u = (g || '').trim().toUpperCase();
        if (u === 'AVI/K2' || u === 'AVI_K2' || u === 'LINE AVI/K2' || u === 'AVI_INS' || u.includes('AVI')) {
          expandedGroups.add('AVI/K2');
          expandedGroups.add('AVI_K2');
          expandedGroups.add('LINE AVI/K2');
          expandedGroups.add('AVI_INS');
        }
      });
      query += ` AND line_group = ANY($${pIdx++})`;
      params.push(Array.from(expandedGroups));
    }
    if (facUnits && facUnits.length > 0 && !facUnits.includes('ALL')) {
      query += ` AND fac_unit_code = ANY($${pIdx++})`;
      params.push(facUnits);
    }

    query += ` ORDER BY output_date ASC, process_name ASC, mc_line ASC`;

    const res = await poolTest.query(query, params);
    if (!res.rows || res.rows.length === 0) return [];

    const { todayStr, yesterdayStr, cutoffYesterdayStr } = getThaiTimeInfo();
    const expectedMaxDate = endDate < cutoffYesterdayStr ? endDate : cutoffYesterdayStr;

    // 🛡️ Ensure snapshot contains all closed production dates up to yesterdayStr
    if (expectedMaxDate >= startDate) {
      const datesInSnapshot = new Set(res.rows.map(r => String(r.output_date).substring(0, 10)));
      if (!datesInSnapshot.has(expectedMaxDate)) {
        // Missing the latest closed production day, trigger fresh Oracle aggregation
        return [];
      }
    }

    // If query is for ALL factories and ALL lines, ensure snapshot is comprehensive (has FPC, SMT, and QA with positive totals)
    if ((!factory || factory === 'ALL') && (!lineGroups || lineGroups.length === 0 || lineGroups.includes('ALL'))) {
      const smtPieceTotal = res.rows.reduce((sum, r) => {
        const fac = (r.factory || '').toUpperCase();
        const lg = (r.line_group || '').toUpperCase();
        const isSmt = (fac === 'SMT' && !lg.includes('QA')) || lg.includes('SMT') || lg.includes('MOT') || lg.includes('ASY');
        return isSmt ? sum + Number(r.actual_piece_qty || 0) : sum;
      }, 0);
      const fpcPieceTotal = res.rows.reduce((sum, r) => {
        const fac = (r.factory || '').toUpperCase();
        const lg = (r.line_group || '').toUpperCase();
        const isFpc = (fac === 'FPC' && !lg.includes('QA') && !lg.includes('DQA')) || lg.includes('LINE A') || lg.includes('LINE B') || lg.includes('LINE C') || lg.includes('LINE D') || lg.includes('VAC') || lg.includes('OST');
        return isFpc ? sum + Number(r.actual_piece_qty || 0) : sum;
      }, 0);
      const qaPieceTotal = res.rows.reduce((sum, r) => {
        const lg = (r.line_group || '').toUpperCase();
        const proc = (r.process_name || '').toUpperCase();
        const isQa = lg.includes('QA') || lg.includes('DQA') || lg.includes('MQA') || proc.includes('QA') || proc.includes('MQA') || proc.includes('DQA');
        return isQa ? sum + Number(r.actual_piece_qty || 0) : sum;
      }, 0);

      if (smtPieceTotal === 0 || fpcPieceTotal === 0 || qaPieceTotal === 0) {
        return []; // Incomplete snapshot for ALL, trigger fresh Oracle aggregation
      }
    }

    return res.rows;
  } catch (error) {
    console.error('Error fetching output daily snapshot from PostgreSQL:', error);
    return [];
  }
};

const saveDailyOutputSnapshot = async (records, targetFactory) => {
  if (!records || !Array.isArray(records) || records.length === 0) return;
  const { todayStr } = getThaiTimeInfo();
  try {
    // Strictly filter out future/today dates AND any UNKNOWN/blank line_group records
    const validRecords = records.filter(r => {
      const isClosedDay = String(r.output_date).substring(0, 10) < todayStr;
      const lg = (r.line_group || '').trim().toUpperCase();
      const isValidLine = lg !== '' && lg !== 'UNKNOWN';
      return isClosedDay && isValidLine;
    });
    if (validRecords.length === 0) return;

    const distinctDates = Array.from(
      new Set(validRecords.map(r => String(r.output_date).substring(0, 10)).filter(Boolean))
    );

    if (distinctDates.length > 0) {
      // 🛡️ PREVENT DUPLICATES: Clear previous snapshot entries for the targeted dates before saving new snapshot records
      if (targetFactory && targetFactory !== 'ALL') {
        await poolTest.query(
          `DELETE FROM public.output_daily_snapshot WHERE output_date::text = ANY($1::text[]) AND factory = $2`,
          [distinctDates, targetFactory]
        );
      } else {
        await poolTest.query(
          `DELETE FROM public.output_daily_snapshot WHERE output_date::text = ANY($1::text[])`,
          [distinctDates]
        );
      }
    }

    const chunkSize = 500;
    for (let i = 0; i < validRecords.length; i += chunkSize) {
      const chunk = validRecords.slice(i, i + chunkSize);
      const valuePlaceholders = [];
      const values = [];
      let paramIdx = 1;

      chunk.forEach(r => {
        valuePlaceholders.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
        values.push(
          String(r.output_date).substring(0, 10),
          r.factory || null,
          r.line_group,
          r.process_name || '',
          r.mc_line || '',
          r.prd_name || '',
          Number(r.actual_lot_qty || 0),
          Number(r.actual_sht_qty || 0),
          Number(r.actual_piece_qty || 0),
          r.fac_unit_code || ''
        );
      });

      const insertSql = `
        INSERT INTO public.output_daily_snapshot (
          output_date, factory, line_group, process_name, mc_line, prd_name,
          actual_lot_qty, actual_sht_qty, actual_piece_qty, fac_unit_code
        )
        VALUES ${valuePlaceholders.join(', ')}
        ON CONFLICT (
          output_date,
          COALESCE(line_group, ''),
          COALESCE(process_name, ''),
          COALESCE(mc_line, ''),
          COALESCE(prd_name, ''),
          COALESCE(fac_unit_code, '')
        )
        DO UPDATE SET
          actual_lot_qty = EXCLUDED.actual_lot_qty,
          actual_sht_qty = EXCLUDED.actual_sht_qty,
          actual_piece_qty = EXCLUDED.actual_piece_qty,
          updated_at = CURRENT_TIMESTAMP
      `;
      await poolTest.query(insertSql, values);
    }
  } catch (error) {
    console.error('Error saving daily output snapshot to PostgreSQL:', error);
  }
};

// Background task: snapshot scheduler (Manpower & Output Daily Auto-Sync)
let lastExecutedKey = '';
let lastOutputSyncDate = '';

const initSnapshotScheduler = () => {
  console.log('[SnapshotManager] Initialized Daily Auto-Snapshot Scheduler (Manpower & Oracle MES Output Sync)');

  // Startup Check (5 seconds after server start)
  setTimeout(async () => {
    try {
      const { yesterdayStr, todayStr } = getThaiTimeInfo();
      // Ensure manpower active baseline exists
      await syncSmartManpower(todayStr, 'startup_check').catch(() => {});

      const checkRes = await poolTest.query(
        'SELECT count(*) as count FROM public.output_daily_snapshot WHERE output_date = $1',
        [yesterdayStr]
      );
      const rowCount = parseInt(checkRes.rows[0]?.count || '0', 10);
      if (rowCount === 0) {
        console.log(`[SnapshotManager] Startup Check: Missing output snapshot for yesterday (${yesterdayStr}), running automatic sync...`);
        const { syncDailyOutputSnapshotFromPostgres } = require('./outputSnapshotService');
        await syncDailyOutputSnapshotFromPostgres(7);
      } else {
        console.log(`[SnapshotManager] Startup Check: Output snapshot for yesterday (${yesterdayStr}) is already up to date (${rowCount} records).`);
      }

      // LINE MAT Daily Excel Auto-Sync (Startup Check - Non-destructive)
      try {
        const { syncMatExcelToDb } = require('./matExcelSync');
        await syncMatExcelToDb();
      } catch (matErr) {
        console.warn('[SnapshotManager] Startup MAT Excel sync warning:', matErr.message);
      }
    } catch (err) {
      console.error('[SnapshotManager] Startup output sync error:', err.message);
    }
  }, 5000);

  setInterval(async () => {
    try {
      const { todayStr, yesterdayStr, currentHour, currentMinute } = getThaiTimeInfo();
      const currentRunKey = `${todayStr}_H${currentHour}_M${currentMinute}`;

      if (lastExecutedKey === currentRunKey) return;

      // 1. Manpower Daily Smart Delta Sync (Strictly once daily at 09:00 AM)
      if (currentHour === 9 && currentMinute === 0) {
        lastExecutedKey = currentRunKey;
        console.log(`[SnapshotManager] Executing Manpower Smart Delta Check for date: ${todayStr} at 09:00 AM...`);
        const deltaResult = await syncSmartManpower(todayStr, '09:00_daily');
        if (deltaResult.changed) {
          const { syncProductivityPeriodSummary } = require('./periodSummaryService');
          await syncProductivityPeriodSummary().catch(e => console.error('[SnapshotManager] Auto period rollup error:', e.message));
        }

        // LINE MAT Daily Excel Auto-Sync (09:00 AM Daily)
        try {
          console.log(`[SnapshotManager] Scheduled LINE MAT Excel Sync Triggered at 09:00 AM...`);
          const { syncMatExcelToDb } = require('./matExcelSync');
          await syncMatExcelToDb();
        } catch (matErr) {
          console.error('[SnapshotManager] Scheduled MAT sync error:', matErr.message);
        }

        // Cleanup old historical manpower snapshots (~45-day retention based on 15th cutoff)
        try {
          console.log('[SnapshotManager] Checking historical manpower snapshot retention...');
          await cleanupOldManpowerSnapshots();
        } catch (mErr) {
          console.error('[SnapshotManager] Manpower snapshot cleanup error:', mErr.message);
        }
      }

      // 2. Output Daily Sync & Period Summary Rollup & Snapshot Pruning (Strictly once daily at 09:00 AM)
      const isMorningSyncTime = (currentHour === 9 && currentMinute === 0);

      if (isMorningSyncTime && lastOutputSyncDate !== currentRunKey) {
        lastOutputSyncDate = currentRunKey;
        console.log(`[SnapshotManager] Scheduled Output Sync Triggered at 09:00 AM for yesterday (${yesterdayStr})...`);
        const { syncDailyOutputSnapshotFromPostgres, cleanupOldOutputSnapshots } = require('./outputSnapshotService');
        await syncDailyOutputSnapshotFromPostgres(7);

        // Run automated cleanup of old historical snapshots (months older than retention window that exist in productivity_period_summary)
        try {
          console.log('[SnapshotManager] Executing cleanup of historical output_daily_snapshot records...');
          await cleanupOldOutputSnapshots(12);
        } catch (cleanErr) {
          console.error('[SnapshotManager] Snapshot cleanup error:', cleanErr.message);
        }
      }
    } catch (err) {
      console.error('[SnapshotManager Scheduler Error]:', err);
    }
  }, 60000); // Check every minute
};

module.exports = {
  insertSnapshotBatch,
  getThaiTimeInfo,
  getMasterEmployeeData,
  populateHistoricalManpowerForDates,
  syncSmartManpower,
  cleanupOldManpowerSnapshots,
  takeSnapshotForDate,
  getEmployeeDataForDate,
  getDailyOutputSnapshot,
  saveDailyOutputSnapshot,
  initSnapshotScheduler
};
