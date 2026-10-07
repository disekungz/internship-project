const { pool_smart, pool_ot, pool_test } = require('../../../../config.js');

const TIME_ZONE = 'Asia/Bangkok';
const RUN_HOUR = 16; // ดึงเวลาทุกๆ 16:45
const RUN_MINUTE = 45;
const START_RETRY_MS = 60 * 1000;
let timer = null;
const ATTENDANCE_WATCH_MS = 15 * 1000;
let attendanceWatchTimer = null;
let running = false;
const lastAttendanceVersions = new Map();

function bangkokDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function addDays(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function yesterdayInBangkok(now = new Date()) {
  const p = bangkokDateParts(now);
  return addDays(`${p.year}-${p.month}-${p.day}`, -1);
}

async function ensureSnapshotTables() {
  await pool_test.query(`
    CREATE TABLE IF NOT EXISTS tbl_manhour_snapshot (
      employee_id VARCHAR(50) NOT NULL,
      work_date DATE NOT NULL,
      effective_date_time VARCHAR(50) NULL,
      name VARCHAR(255) NOT NULL DEFAULT '',
      sect VARCHAR(255) NOT NULL DEFAULT '',
      department VARCHAR(255) NOT NULL DEFAULT '',
      dept VARCHAR(255) NOT NULL DEFAULT '',
      employee_shift VARCHAR(50) NOT NULL DEFAULT '',
      line VARCHAR(255) NOT NULL DEFAULT '',
      snapshot_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (employee_id, work_date)
    )
  `);

  await pool_test.query(`
    CREATE TABLE IF NOT EXISTS tbl_manhour_snapshot_log (
      work_date DATE NOT NULL PRIMARY KEY,
      status VARCHAR(20) NOT NULL CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED')),
      row_count INT NOT NULL DEFAULT 0,
      started_at TIMESTAMP NOT NULL,
      finished_at TIMESTAMP NULL,
      error_message TEXT NULL
    )
  `);
}

function todayInBangkok(now = new Date()) {
  const p = bangkokDateParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

async function createDailySnapshot(workDate = todayInBangkok()) {
  if (running) return { skipped: true, reason: 'snapshot already running' };
  running = true;
  let client;

  try {
    await ensureSnapshotTables();
    client = await pool_test.connect();
    await client.query('BEGIN');
    await pool_test.query(`
      INSERT INTO tbl_manhour_snapshot_log
        (work_date, status, row_count, started_at, finished_at, error_message)
      VALUES ($1, 'RUNNING', 0, CURRENT_TIMESTAMP, NULL, NULL)
      ON CONFLICT (work_date) DO UPDATE SET
        status = 'RUNNING',
        row_count = 0,
        started_at = CURRENT_TIMESTAMP,
        finished_at = NULL,
        error_message = NULL
    `, [workDate]);

    // 1. ดึงข้อมูลจากทั้ง tbl_employee_help (Primary Master) และ tbl_employee (Fallback/Secondary)
    const [employeeHelpResult, employeeResult] = await Promise.all([
      pool_ot.query(`
        SELECT code, name, department, dept, shift, line
        FROM tbl_employee_help
        WHERE code IS NOT NULL AND TRIM(code) <> ''
      `),
      pool_ot.query(`
        SELECT code, name, sect, department, process, dept, shift, line, status
        FROM tbl_employee
        WHERE code IS NOT NULL AND TRIM(code) <> ''
      `),
    ]);

    const allEmployeeHelp = Array.isArray(employeeHelpResult) ? employeeHelpResult : (employeeHelpResult?.rows || []);
    const allEmployees = Array.isArray(employeeResult) ? employeeResult : (employeeResult?.rows || []);

    const employeeMap = new Map();
    allEmployees.forEach(e => {
      employeeMap.set(String(e.code).trim(), e);
    });

    // 2. ดึงข้อมูลการสแกนเวลาจาก smart_man_time_attendance (ถ้ามีข้อมูลของวันดังกล่าว)
    const attendanceResult = await pool_smart.query(`
      SELECT DISTINCT ON (a.dlh_employee_id)
        a.dlh_employee_id, a.dlh_effective_date_time, a.work_day_status,
        a.work_status, a.scan_time_in, a.scan_time_out
      FROM smart.smart_man_time_attendance a
      INNER JOIN (
        SELECT dlh_effective_date_time, MAX(updated_date) AS max_updated_date
        FROM smart.smart_man_time_attendance
        WHERE CASE
                WHEN TRIM(dlh_effective_date_time) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
                THEN SUBSTRING(TRIM(dlh_effective_date_time) FROM 1 FOR 10)::date
                WHEN TRIM(dlh_effective_date_time) ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}'
                THEN TO_DATE(SPLIT_PART(TRIM(dlh_effective_date_time), ' ', 1), 'DD/MM/YYYY')
                ELSE NULL
              END = $1::date
        GROUP BY dlh_effective_date_time
      ) latest ON a.dlh_effective_date_time = latest.dlh_effective_date_time
             AND a.updated_date = latest.max_updated_date
      WHERE CASE
              WHEN TRIM(a.dlh_effective_date_time) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
              THEN SUBSTRING(TRIM(a.dlh_effective_date_time) FROM 1 FOR 10)::date
              WHEN TRIM(a.dlh_effective_date_time) ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}'
              THEN TO_DATE(SPLIT_PART(TRIM(a.dlh_effective_date_time), ' ', 1), 'DD/MM/YYYY')
              ELSE NULL
            END = $1::date
        AND a.dlh_employee_id IS NOT NULL
      ORDER BY a.dlh_employee_id, a.dlh_effective_date_time DESC
    `, [workDate]);
    const attendanceRows = attendanceResult.rows || [];
    const attendanceMap = new Map();
    attendanceRows.forEach(row => {
      attendanceMap.set(String(row.dlh_employee_id).trim(), row);
    });

    // 3. รวม Master Employee (ยึด tbl_employee_help เป็นหลัก) + Attendance สำหรับพนักงานทุกคน
    const processedIds = new Set();
    const snapshotValues = [];

    // แปลง dlh_effective_date_time → "D/M/YYYY" (เช่น "1/9/2026") เก็บเป็น text ไม่ให้ Power BI แปลงเป็น พ.ศ.
    const parseEffectiveDate = (raw) => {
      if (!raw) return null;
      const str = String(raw).trim().slice(0, 10); // "YYYY-MM-DD"
      if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
      const [year, month, day] = str.split('-');
      return `${Number(day)}/${Number(month)}/${year}`; // "1/9/2026"
    };

    // เริ่มจากพนักงานทั้งหมดใน tbl_employee_help (Primary Master)
    for (const help of allEmployeeHelp) {
      const empId = String(help.code).trim();
      if (!empId) continue;
      processedIds.add(empId);
      const att = attendanceMap.get(empId);
      const emp = employeeMap.get(empId) || {};

      snapshotValues.push([
        empId,
        workDate,
        parseEffectiveDate(att?.dlh_effective_date_time) || parseEffectiveDate(workDate),
        help.name || emp.name || '',
        emp.sect || '',
        help.department || emp.department || '',
        help.dept || emp.dept || '',
        help.shift || emp.shift || '',
        help.line || emp.line || '',
      ]);
    }



    // กรณีมีพนักงานที่มีเวลาใน attendance แต่ไม่อยู่ในทั้งสองตาราง
    for (const att of attendanceRows) {
      const empId = String(att.dlh_employee_id).trim();
      if (!empId || processedIds.has(empId)) continue;
      processedIds.add(empId);

      snapshotValues.push([
        empId,
        workDate,
        parseEffectiveDate(att.dlh_effective_date_time) || parseEffectiveDate(workDate),
        '', '', '', '', '', '',
      ]);
    }

    // 4. Batch Insert / Update ลงใน tbl_manhour_snapshot
    for (let offset = 0; offset < snapshotValues.length; offset += 250) {
      const batch = snapshotValues.slice(offset, offset + 250);
      const placeholders = batch.map((_, rowIndex) => {
        const startIndex = rowIndex * 9 + 1;
        return `(${Array.from({ length: 9 }, (_, colIndex) => `$${startIndex + colIndex}`).join(', ')})`;
      }).join(', ');
      const flatParams = batch.flat();
      await client.query(`
        INSERT INTO tbl_manhour_snapshot (
          employee_id, work_date, effective_date_time,
          name, sect, department, dept,
          employee_shift, line
        ) VALUES ${placeholders}
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
          effective_date_time = COALESCE(EXCLUDED.effective_date_time, tbl_manhour_snapshot.effective_date_time),
          name = CASE WHEN EXCLUDED.name <> '' THEN EXCLUDED.name ELSE tbl_manhour_snapshot.name END,
          sect = CASE WHEN EXCLUDED.sect <> '' THEN EXCLUDED.sect ELSE tbl_manhour_snapshot.sect END,
          department = CASE WHEN EXCLUDED.department <> '' THEN EXCLUDED.department ELSE tbl_manhour_snapshot.department END,
          dept = CASE WHEN EXCLUDED.dept <> '' THEN EXCLUDED.dept ELSE tbl_manhour_snapshot.dept END,
          employee_shift = CASE WHEN EXCLUDED.employee_shift <> '' THEN EXCLUDED.employee_shift ELSE tbl_manhour_snapshot.employee_shift END,
          line = CASE WHEN EXCLUDED.line <> '' THEN EXCLUDED.line ELSE tbl_manhour_snapshot.line END
      `, flatParams);
    }
    await client.query('COMMIT');

    await pool_test.query(`
      UPDATE tbl_manhour_snapshot_log
      SET status = 'SUCCESS', row_count = $1, finished_at = CURRENT_TIMESTAMP, error_message = NULL
      WHERE work_date = $2
    `, [snapshotValues.length, workDate]);
    console.log(`[snapshot] Saved ${snapshotValues.length} rows (tbl_employee_help) for ${workDate}`);
    return { skipped: false, workDate, rowCount: snapshotValues.length };
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch { /* ไม่มี Transaction ทำงานค้างอยู่ */ }
    }
    try {
      await pool_test.query(`
        UPDATE tbl_manhour_snapshot_log
        SET status = 'FAILED', finished_at = CURRENT_TIMESTAMP, error_message = $1
        WHERE work_date = $2
      `, [String(error.message || error).slice(0, 65535), workDate]);
    } catch (logError) {
      console.error('[snapshot] Could not save failure log:', logError.message);
    }
    throw error;
  } finally {
    client?.release();
    running = false;
  }
}

function millisecondsUntilNextRunLegacy(now = new Date()) {
  const p = bangkokDateParts(now);
  const today = `${p.year}-${p.month}-${p.day}`;
  const offset = '+07:00';
  let target = new Date(`${today}T${String(RUN_HOUR).padStart(2, '0')}:${String(RUN_MINUTE).padStart(2, '0')}:00${offset}`);
  if (target <= now) target = new Date(`${addDays(today, 1)}T9:30:00${offset}`); //ดึงเวลาทุกๆ 9:30
  return Math.max(1000, target.getTime() - now.getTime());
}

function millisecondsUntilNextRun(now = new Date()) {
  const parts = bangkokDateParts(now);
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const runTime = `${String(RUN_HOUR).padStart(2, '0')}:${String(RUN_MINUTE).padStart(2, '0')}:00`;
  const offset = '+07:00';
  let target = new Date(`${today}T${runTime}${offset}`);

  if (target.getTime() <= now.getTime()) {
    target = new Date(`${addDays(today, 1)}T${runTime}${offset}`);
  }

  const delay = target.getTime() - now.getTime();
  if (!Number.isFinite(delay) || delay < 0) {
    console.error('[snapshot] Could not calculate the next 10:00 run; retrying in 60 seconds.');
    return START_RETRY_MS;
  }
  return Math.max(1000, delay);
}

function scheduleNextRun() {
  clearTimeout(timer);
  const delay = millisecondsUntilNextRun();
  timer = setTimeout(async () => {
    try {
      await createDailySnapshot();
    } catch (error) {
      console.error('[snapshot] Daily snapshot failed:', error);
    } finally {
      scheduleNextRun();
    }
  }, delay);
  timer.unref?.();
  const nextRun = new Date(Date.now() + delay);
  let nextRunText = 'unknown';
  if (!Number.isNaN(nextRun.getTime())) {
    const p = bangkokDateParts(nextRun);
    nextRunText = `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
  }
  console.log(`[snapshot] Next run: ${nextRunText} (${TIME_ZONE})`);
}

async function snapshotMonthDatesWhenAttendanceChanges() {
  const p = bangkokDateParts();
  const monthStart = `${p.year}-${p.month}-01`;
  const result = await pool_smart.query(`
    WITH attendance_dates AS (
      SELECT CASE
            WHEN TRIM(dlh_effective_date_time) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
              THEN SUBSTRING(TRIM(dlh_effective_date_time) FROM 1 FOR 10)::date
            WHEN TRIM(dlh_effective_date_time) ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}'
              THEN TO_DATE(SPLIT_PART(TRIM(dlh_effective_date_time), ' ', 1), 'DD/MM/YYYY')
            ELSE NULL
          END AS work_date,
          dlh_employee_id,
          dlh_effective_date_time,
          work_day_status,
          work_status,
          scan_time_in,
          scan_time_out
      FROM smart.smart_man_time_attendance
      WHERE dlh_employee_id IS NOT NULL
    )
    SELECT
      work_date::text AS work_date,
      COUNT(*)::int AS row_count,
      MD5(STRING_AGG(
        CONCAT_WS('|',
          COALESCE(dlh_employee_id::text, ''),
          COALESCE(dlh_effective_date_time::text, ''),
          COALESCE(work_day_status::text, ''),
          COALESCE(work_status::text, ''),
          COALESCE(scan_time_in::text, ''),
          COALESCE(scan_time_out::text, '')
        ),
        '||' ORDER BY dlh_employee_id::text, dlh_effective_date_time::text, scan_time_in::text, scan_time_out::text
      )) AS checksum
    FROM attendance_dates
    WHERE work_date >= $1::date
      AND work_date < ($1::date + INTERVAL '1 month')::date
    GROUP BY work_date
  `, [monthStart]);

  for (const row of result.rows || []) {
    const workDate = String(row.work_date).slice(0, 10);
    const rowCount = Number(row.row_count || 0);
    const nextVersion = `${rowCount}:${row.checksum || ''}`;
    const previousVersion = lastAttendanceVersions.get(workDate);
    lastAttendanceVersions.set(workDate, nextVersion);
    // การ Poll ครั้งแรกใช้เพื่อสร้างค่าเริ่มต้น Baseline ส่วนการเปลี่ยนแปลงในภายหลังจะรีเฟรชเฉพาะวันที่ข้อมูลเปลี่ยน.
    if (previousVersion === undefined || nextVersion === previousVersion) continue;

    const snapshotResult = await createDailySnapshot(workDate);
    if (!snapshotResult.skipped) {
      console.log(`[snapshot] Attendance change detected; snapshot refreshed for ${workDate} (${rowCount} rows).`);
    }
  }
}

function startAttendanceSnapshotWatcher() {
  clearTimeout(attendanceWatchTimer);
  const poll = async () => {
    try {
      await snapshotMonthDatesWhenAttendanceChanges();
    } catch (error) {
      console.error('[snapshot] Attendance watcher failed:', error.message);
    } finally {
      attendanceWatchTimer = setTimeout(poll, ATTENDANCE_WATCH_MS);
      attendanceWatchTimer.unref?.();
    }
  };
  poll();
}

async function recoverMissedSnapshot() {
  const p = bangkokDateParts();
  const today = `${p.year}-${p.month}-${p.day}`;
  const afterCutoff = Number(p.hour) > RUN_HOUR ||
    (Number(p.hour) === RUN_HOUR && Number(p.minute) >= RUN_MINUTE);

  // ตรวจสอบ Snapshot ของวันนี้ (ถ้าผ่าน 16:45 น. มาแล้ว)
  if (afterCutoff) {
    const todayRes = await pool_test.query(
      `SELECT status FROM tbl_manhour_snapshot_log
       WHERE work_date = $1 AND status = 'SUCCESS' AND row_count > 0`,
      [today]
    );
    if (!todayRes.rows.length) await createDailySnapshot(today);
  }

  // ตรวจสอบ Snapshot ของเมื่อวาน
  const yesterday = yesterdayInBangkok();
  const yestRes = await pool_test.query(
    `SELECT status FROM tbl_manhour_snapshot_log
     WHERE work_date = $1 AND status = 'SUCCESS' AND row_count > 0`,
    [yesterday]
  );
  if (!yestRes.rows.length) await createDailySnapshot(yesterday);
}

async function startSnapshotScheduler() {
  try {
    await ensureSnapshotTables();
    await recoverMissedSnapshot();
  } catch (error) {
    console.error(`[snapshot] Database unavailable; retrying in ${START_RETRY_MS / 1000} seconds:`, error.message);
    clearTimeout(timer);
    timer = setTimeout(() => {
      startSnapshotScheduler().catch((retryError) => {
        console.error('[snapshot] Scheduler retry failed:', retryError.message);
      });
    }, START_RETRY_MS);
    timer.unref?.();
    return;
  }
  scheduleNextRun();
  startAttendanceSnapshotWatcher();
}

module.exports = {
  createDailySnapshot,
  startSnapshotScheduler,
};

