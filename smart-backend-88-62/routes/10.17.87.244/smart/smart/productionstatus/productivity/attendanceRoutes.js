const express = require("express");
const router = express.Router();
const { pool_smart, pool_test, pool_ot } = require("../../../../config");
const { getCached, setCache } = require("../../../../../../Utility/apiCache");
const { processMonthlyAttendanceImport, getMonthlyImportLogs } = require("../../../../../../services/productivity/monthlyAttendanceService");
const { checkMonthAttendanceStatus, syncSelectiveAttendanceDates } = require("../../../../../../services/productivity/attendanceSyncService");
const { syncSmartManpower } = require("../../../../../../services/productivity/snapshotManager");

// Native Date Utilities
function getTodayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateStr, days = 1) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(val) {
  if (!val) return '-';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    String(d.getSeconds()).padStart(2, '0')
  ].join(':');
}

// Helper: Filter majority attendance records
function filterMajorityAttendanceRecords(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const updateCountsByDate = new Map();
  for (const r of rows) {
    const d = r.work_date || (r.dlh_effective_date_time ? r.dlh_effective_date_time.substring(0, 10) : null);
    if (!d) continue;
    const uStr = r.updated_date ? new Date(r.updated_date).toISOString() : 'NULL';
    let dateMap = updateCountsByDate.get(d);
    if (!dateMap) {
      dateMap = new Map();
      updateCountsByDate.set(d, dateMap);
    }
    dateMap.set(uStr, (dateMap.get(uStr) || 0) + 1);
  }

  const majorityByDate = new Map();
  updateCountsByDate.forEach((dateMap, d) => {
    let maxCount = -1;
    let majorityUStr = null;
    dateMap.forEach((count, uStr) => {
      if (count > maxCount) {
        maxCount = count;
        majorityUStr = uStr;
      }
    });
    majorityByDate.set(d, majorityUStr);
  });

  return rows.filter(r => {
    const d = r.work_date || (r.dlh_effective_date_time ? r.dlh_effective_date_time.substring(0, 10) : null);
    if (!d) return false;
    const majorityUStr = majorityByDate.get(d);
    if (!majorityUStr) return true;
    const uStr = r.updated_date ? new Date(r.updated_date).toISOString() : 'NULL';
    return uStr === majorityUStr;
  });
}

// ----------------------------------------------------------------------------
// GET /summary (or /productivity/attendance/summary)
// ----------------------------------------------------------------------------
router.get("/summary", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }

    const cacheKey = `attendance-summary:${startDate}:${endDate}`;
    const cachedData = getCached(cacheKey);
    if (cachedData) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cachedData);
    }

    // Fetch precomputed snapshots from public.productivity_attendance_daily_snapshot
    const { rows } = await pool_test.query(`
      SELECT work_date::text as work_date, metrics 
      FROM public.productivity_attendance_daily_snapshot
      WHERE work_date >= $1 AND work_date <= $2
      ORDER BY work_date ASC
    `, [startDate, endDate]);

    const summaryByDate = {};
    rows.forEach(r => {
      summaryByDate[r.work_date] = r.metrics;
    });

    setCache(cacheKey, summaryByDate, 60000);
    res.setHeader("X-Cache", "MISS");
    res.json(summaryByDate);
  } catch (error) {
    console.error("[AttendanceRoutes] Summary Error:", error.message);
    res.status(500).json({ error: "Cannot load attendance summary", details: error.message });
  }
});

// ----------------------------------------------------------------------------
// GET /latest-scan-date
// ----------------------------------------------------------------------------
router.get("/latest-scan-date", async (req, res) => {
  try {
    const result = await pool_smart.query(`
      SELECT MAX(SUBSTRING(dlh_effective_date_time, 1, 10)) as latest_date
      FROM smart.smart_man_time_attendance
      WHERE dlh_effective_date_time IS NOT NULL
    `);
    const latestDate = result.rows[0]?.latest_date || getTodayStr();
    res.json({ success: true, latestDate });
  } catch (err) {
    res.json({ success: true, latestDate: getTodayStr() });
  }
});

// ----------------------------------------------------------------------------
// GET /employee-scans
// ----------------------------------------------------------------------------
router.get("/employee-scans", async (req, res) => {
  try {
    let targetDate = req.query.date;
    if (!targetDate || targetDate === "LATEST") {
      const latestRes = await pool_smart.query(`
        SELECT MAX(SUBSTRING(dlh_effective_date_time, 1, 10)) as latest_date
        FROM smart.smart_man_time_attendance
        WHERE dlh_effective_date_time IS NOT NULL
      `);
      targetDate = latestRes.rows[0]?.latest_date || getTodayStr();
    }

    const { lineGroup } = req.query;
    const endPlusOne = addDays(targetDate, 1);

    // 1. Fetch attendance scans
    const attResult = await pool_smart.query(`
      SELECT dlh_employee_id, SUBSTRING(dlh_effective_date_time, 1, 10) as work_date,
             scan_time_in, work_status, work_day_status, scan_time_out, updated_date
      FROM smart.smart_man_time_attendance
      WHERE dlh_effective_date_time >= $1 AND dlh_effective_date_time < $2
    `, [targetDate, endPlusOne]);

    const attendanceScans = filterMajorityAttendanceRecords(attResult.rows);

    // 2. Fetch employee details from MariaDB tbl_employee_help
    const empCodes = Array.from(new Set(attendanceScans.map(r => (r.dlh_employee_id || '').trim()).filter(Boolean)));
    const empDetailMap = new Map();

    if (empCodes.length > 0) {
      try {
        const placeholders = empCodes.map(() => '?').join(',');
        const mariaRows = await pool_ot.query(`
          SELECT code, name, department, line, shift
          FROM tbl_employee_help
          WHERE code IN (${placeholders})
        `, empCodes);
        if (Array.isArray(mariaRows)) {
          mariaRows.forEach(emp => empDetailMap.set(String(emp.code || '').trim(), emp));
        }
      } catch (mErr) {
        console.warn("[AttendanceRoutes] MariaDB lookup warning:", mErr.message);
      }
    }

    // 3. Fetch cost center line mapping and loan excludes
    const [ccResult, loanExcludeResult] = await Promise.all([
      pool_test.query(`SELECT cost_center_code, line, line_out FROM public.cost_centers`).catch(() => ({ rows: [] })),
      pool_test.query(`
        SELECT employee_id, 
               TO_CHAR(start_date, 'YYYY-MM-DD') as start_date, 
               TO_CHAR(end_date, 'YYYY-MM-DD') as end_date 
        FROM public.manpower_loan_exclude 
        WHERE is_active = true 
          AND (start_date IS NULL OR TO_CHAR(start_date, 'YYYY-MM-DD') <= $1)
          AND (end_date IS NULL OR TO_CHAR(end_date, 'YYYY-MM-DD') >= $1)
      `, [targetDate]).catch(() => ({ rows: [] }))
    ]);

    const ccMap = new Map();
    ccResult.rows.forEach(r => ccMap.set((r.cost_center_code || '').trim(), r));

    const dayLoanExcludes = loanExcludeResult.rows.map(r => ({
      employee_id: (r.employee_id || '').trim(),
      start_date: r.start_date || null,
      end_date: r.end_date || null,
    }));

    const isLoanedOutOnDate = (empCode) => {
      if (!empCode) return false;
      const cleanId = empCode.trim();
      return dayLoanExcludes.some(rec => {
        if (rec.employee_id !== cleanId) return false;
        if (rec.start_date && targetDate < rec.start_date) return false;
        if (rec.end_date && targetDate > rec.end_date) return false;
        return true;
      });
    };

    const scanList = [];

    attendanceScans.forEach(att => {
      const empCode = att.dlh_employee_id ? String(att.dlh_employee_id).trim() : '';
      const isLoanedOut = isLoanedOutOnDate(empCode);
      const empInfo = empDetailMap.get(empCode) || {};
      const deptCode = empInfo.department ? empInfo.department.split('/')[0].split(' ')[0].replace('-', '').trim() : '';
      const ccInfo = ccMap.get(deptCode) || {};

      let scanInFormatted = formatTime(att.scan_time_in);
      let scanOutFormatted = formatTime(att.scan_time_out);

      const homeLine = empInfo.line || 'Unmapped';
      const workingLine = isLoanedOut ? 'ไปช่วยงานต่างสาขา' : (ccInfo.line_out || ccInfo.line || 'Unmapped');

      let supportType = isLoanedOut ? 'LOANED_OUT' : 'NORMAL';
      if (!isLoanedOut && lineGroup && lineGroup !== 'ALL') {
        const targetUpper = String(lineGroup).toUpperCase();
        const homeUpper = homeLine.toUpperCase();
        const workUpper = workingLine.toUpperCase();

        if (workUpper.includes(targetUpper) && !homeUpper.includes(targetUpper) && homeUpper !== 'UNMAPPED') {
          supportType = 'IN_SUPPORT';
        } else if (homeUpper.includes(targetUpper) && !workUpper.includes(targetUpper)) {
          supportType = 'OUT_SUPPORT';
        }
      }

      let effectiveWorkStatus = att.work_status || 'Normal';
      if (att.scan_time_in && att.scan_time_out) {
        const inTime = new Date(att.scan_time_in).getTime();
        const outTime = new Date(att.scan_time_out).getTime();
        const hoursWorked = (outTime - inTime) / (1000 * 60 * 60);
        if (hoursWorked > 0 && hoursWorked < 4.0) {
          effectiveWorkStatus = 'Abnormal';
        }
      }

      let calculatedShift = 'Day';
      if (scanInFormatted && scanInFormatted !== '-') {
        const inHour = parseInt(scanInFormatted.split(':')[0], 10);
        if (!isNaN(inHour) && (inHour >= 17 || inHour < 5)) {
          calculatedShift = 'Night';
        } else {
          calculatedShift = 'Day';
        }
      } else if (empInfo.shift) {
        const s = String(empInfo.shift).toUpperCase();
        if (s.includes('NIGHT') || s === 'N' || s === 'B') {
          calculatedShift = 'Night';
        } else {
          calculatedShift = 'Day';
        }
      }

      scanList.push({
        empCode,
        empName: empInfo.name || `Emp #${empCode}`,
        department: empInfo.department || deptCode || 'Unknown',
        shift: calculatedShift,
        homeLine,
        workingLine,
        line: workingLine,
        lineGroup: workingLine,
        supportType,
        workStatus: effectiveWorkStatus,
        scanTimeIn: scanInFormatted,
        scanTimeOut: scanOutFormatted,
      });
    });

    res.json({
      success: true,
      date: targetDate,
      lineGroup: lineGroup || 'ALL',
      totalScans: scanList.length,
      employees: scanList
    });
  } catch (error) {
    console.error("[AttendanceRoutes] Employee Scans Error:", error.message);
    res.status(500).json({ error: "Failed to fetch employee scans", details: error.message });
  }
});

// ----------------------------------------------------------------------------
// GET /month-status & /productivity/attendance/month-status
// ----------------------------------------------------------------------------
const handleMonthStatus = async (req, res) => {
  try {
    const { month, startDate, endDate } = req.query;
    const status = await checkMonthAttendanceStatus({ month, startDate, endDate });
    res.json(status);
  } catch (error) {
    console.error("[AttendanceRoutes] Error checking attendance update status:", error);
    res.status(500).json({ error: "Failed checking attendance update status", details: error.message });
  }
};
router.get(["/month-status", "/attendance/month-status", "/productivity/attendance/month-status"], handleMonthStatus);

// ----------------------------------------------------------------------------
// POST /sync-selective & /productivity/attendance/sync-selective
// ----------------------------------------------------------------------------
const handleSyncSelective = async (req, res) => {
  try {
    const { targetDates, month, startDate, endDate } = req.body;
    const result = await syncSelectiveAttendanceDates({ targetDates, month, startDate, endDate });
    res.json(result);
  } catch (error) {
    console.error("[AttendanceRoutes] Error in selective attendance sync:", error);
    res.status(500).json({ error: "Failed syncing selective attendance dates", details: error.message });
  }
};
router.post(["/sync-selective", "/attendance/sync-selective", "/productivity/attendance/sync-selective"], handleSyncSelective);

// ----------------------------------------------------------------------------
// POST /import-monthly-attendance & /productivity/attendance/import-monthly-attendance
// ----------------------------------------------------------------------------
router.post([
  "/import-monthly-attendance",
  "/attendance/import-monthly-attendance",
  "/productivity/attendance/import-monthly-attendance"
], async (req, res) => {
  try {
    const { targetMonth, rows = [], fileName = 'import.xlsx', uploadedBy = 'Admin' } = req.body;
    const result = await processMonthlyAttendanceImport({ targetMonth, rows, fileName, uploadedBy });
    res.json(result);
  } catch (error) {
    console.error("[AttendanceRoutes] Monthly attendance import error:", error);
    res.status(500).json({ error: error.message || "Failed importing monthly attendance file" });
  }
});

// ----------------------------------------------------------------------------
// GET /monthly-import-logs & /productivity/attendance/monthly-import-logs
// ----------------------------------------------------------------------------
router.get([
  "/monthly-import-logs",
  "/attendance/monthly-import-logs",
  "/productivity/attendance/monthly-import-logs"
], async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const logs = await getMonthlyImportLogs(limit);
    res.json(logs);
  } catch (err) {
    console.error("[AttendanceRoutes] Error fetching monthly import logs:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// POST /snapshot-refresh & /productivity/attendance/snapshot-refresh
// ----------------------------------------------------------------------------
router.post([
  "/snapshot-refresh",
  "/attendance/snapshot-refresh",
  "/productivity/attendance/snapshot-refresh"
], async (req, res) => {
  try {
    const { dateStr } = req.body;
    const targetDate = dateStr || getTodayStr();

    console.log("[AttendanceRoutes] Manual Snapshot Refresh triggered for date: " + targetDate);
    const data = await syncSmartManpower(targetDate, 'manual_refresh');

    res.json({
      success: true,
      message: "Snapshot successfully refreshed for " + targetDate,
      date: targetDate,
      result: data
    });
  } catch (error) {
    console.error("[AttendanceRoutes] Snapshot Refresh Error:", error);
    res.status(500).json({ error: "Failed to refresh snapshot", details: error.message });
  }
});

module.exports = router;
