const express = require("express");
const router = express.Router();
const { pool_smart, pool_test, pool_ot } = require("../../../../config");

// Native Date Utilities
function getTodayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

// Ensure manpower_loan_exclude table exists
(async () => {
  try {
    await pool_test.query(`
      CREATE TABLE IF NOT EXISTS public.manpower_loan_exclude (
        id SERIAL PRIMARY KEY,
        employee_id VARCHAR(50) UNIQUE NOT NULL,
        employee_name VARCHAR(100),
        department VARCHAR(100),
        destination VARCHAR(50) DEFAULT 'N1',
        start_date DATE,
        end_date DATE,
        is_active BOOLEAN DEFAULT TRUE,
        created_by VARCHAR(50) DEFAULT 'Manual',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.warn("[LoanRoutes] Ensure manpower_loan_exclude table warning:", err.message);
  }
})();

// ----------------------------------------------------------------------------
// GET /check-loaned-from-attendance
// ----------------------------------------------------------------------------
router.get("/check-loaned-from-attendance", async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || getTodayStr();

    const { rows: rawAttRows } = await pool_smart.query(`
      SELECT DISTINCT TRIM(dlh_employee_id) as employee_id, work_day_status, dlh_effective_date_time, updated_date
      FROM smart.smart_man_time_attendance
      WHERE dlh_effective_date_time LIKE $1
        AND work_day_status IS NOT NULL
        AND TRIM(work_day_status) NOT IN ('W', 'H', 'O')
      ORDER BY employee_id ASC
    `, [`${targetDate}%`]);

    const attRows = filterMajorityAttendanceRecords(rawAttRows);
    if (attRows.length === 0) {
      return res.json({ success: true, date: targetDate, totalFound: 0, employees: [] });
    }

    const empCodes = attRows.map(r => r.employee_id);
    const empMap = new Map();

    try {
      const placeholders = empCodes.map(() => '?').join(',');
      const empDetails = await pool_ot.query(`
        SELECT TRIM(code) as code, name, department 
        FROM tbl_employee_help 
        WHERE TRIM(code) IN (${placeholders})
      `, empCodes);
      if (Array.isArray(empDetails)) {
        empDetails.forEach(emp => empMap.set(emp.code, emp));
      }
    } catch (empErr) {
      console.warn("[LoanRoutes] MariaDB lookup warning:", empErr.message);
    }

    const existingResult = await pool_test.query(`
      SELECT TRIM(employee_id) as employee_id, is_active, destination 
      FROM public.manpower_loan_exclude
    `);
    const existingMap = new Map();
    existingResult.rows.forEach(ex => existingMap.set(ex.employee_id, ex));

    const employees = attRows.map(att => {
      const info = empMap.get(att.employee_id) || {};
      const exInfo = existingMap.get(att.employee_id);
      return {
        employee_id: att.employee_id,
        work_day_status: att.work_day_status,
        first_loan_date: targetDate,
        start_date: targetDate,
        employee_name: info.name || '',
        department: info.department || '',
        alreadyExists: !!exInfo,
        isActive: exInfo ? exInfo.is_active : false,
        existingDestination: exInfo ? exInfo.destination : null
      };
    });

    res.json({
      success: true,
      date: targetDate,
      totalFound: employees.length,
      newCount: employees.filter(e => !e.alreadyExists).length,
      updatedCount: employees.filter(e => e.alreadyExists).length,
      employees
    });
  } catch (error) {
    console.error("[LoanRoutes] Check Loaned Error:", error.message);
    res.status(500).json({ error: "Failed to check loaned employees", details: error.message });
  }
});

// ----------------------------------------------------------------------------
// POST /sync-loaned-from-attendance
// ----------------------------------------------------------------------------
router.post("/sync-loaned-from-attendance", async (req, res) => {
  try {
    const { employees, defaultDestination, startDate, endDate } = req.body;
    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ error: "กรุณาเลือกรายชื่อพนักงานอย่างน้อย 1 คน" });
    }

    let addedCount = 0;
    let updatedCount = 0;

    for (const emp of employees) {
      const code = (emp.employee_id || '').trim();
      if (!code) continue;

      const name = (emp.employee_name || '').trim();
      const dept = (emp.department || '').trim();
      const dest = (emp.assignedDestination || emp.destination || defaultDestination || 'N1').trim();
      const sDate = (emp.start_date || emp.first_loan_date || startDate || '').trim() || null;
      const eDate = (emp.end_date || endDate || '').trim() || null;

      const checkExist = await pool_test.query(`
        SELECT id FROM public.manpower_loan_exclude WHERE TRIM(employee_id) = $1
      `, [code]);

      if (checkExist.rows.length > 0) {
        await pool_test.query(`
          UPDATE public.manpower_loan_exclude 
          SET employee_name = COALESCE(NULLIF($2, ''), employee_name),
              department = COALESCE(NULLIF($3, ''), department),
              destination = CASE WHEN $4 != '' THEN $4 ELSE destination END,
              start_date = COALESCE($5, start_date),
              end_date = COALESCE($6, end_date),
              is_active = true,
              updated_at = CURRENT_TIMESTAMP
          WHERE TRIM(employee_id) = $1
        `, [code, name, dept, dest, sDate, eDate]);
        updatedCount++;
      } else {
        await pool_test.query(`
          INSERT INTO public.manpower_loan_exclude (employee_id, employee_name, department, destination, start_date, end_date, is_active, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, true, 'Auto-Attendance')
        `, [code, name, dept, dest, sDate, eDate]);
        addedCount++;
      }
    }

    res.json({
      success: true,
      message: `นำเข้าพนักงานเรียบร้อยแล้ว (เพิ่มใหม่ ${addedCount} รายการ, อัปเดต ${updatedCount} รายการ)`,
      addedCount,
      updatedCount,
      totalSynced: addedCount + updatedCount
    });
  } catch (error) {
    console.error("[LoanRoutes] Sync Loaned Error:", error.message);
    res.status(500).json({ error: "ไม่สามารถบันทึกข้อมูลพนักงานช่วยงานได้", details: error.message });
  }
});

// ----------------------------------------------------------------------------
// GET /loan-exclude & CRUD
// ----------------------------------------------------------------------------
router.get("/loan-exclude", async (req, res) => {
  try {
    const result = await pool_test.query(`
      SELECT id, employee_id, employee_name, department, destination,
             TO_CHAR(start_date, 'YYYY-MM-DD') as start_date,
             TO_CHAR(end_date, 'YYYY-MM-DD') as end_date,
             is_active, created_at, created_by, updated_at
      FROM public.manpower_loan_exclude 
      ORDER BY is_active DESC, created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch loan excludes", details: error.message });
  }
});

router.post("/loan-exclude", async (req, res) => {
  try {
    const { employee_id, employee_name, department, destination, start_date, end_date, is_active = true, created_by = 'Manual' } = req.body;
    if (!employee_id) return res.status(400).json({ error: "Employee ID is required" });

    const result = await pool_test.query(`
      INSERT INTO public.manpower_loan_exclude 
      (employee_id, employee_name, department, destination, start_date, end_date, is_active, created_by, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (employee_id) DO UPDATE SET
        employee_name = EXCLUDED.employee_name,
        department = EXCLUDED.department,
        destination = EXCLUDED.destination,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `, [employee_id.trim(), employee_name, department, destination, start_date || null, end_date || null, is_active, created_by]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/loan-exclude/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { employee_name, department, destination, start_date, end_date, is_active } = req.body;
    const result = await pool_test.query(`
      UPDATE public.manpower_loan_exclude
      SET employee_name = COALESCE($1, employee_name),
          department = COALESCE($2, department),
          destination = COALESCE($3, destination),
          start_date = COALESCE($4, start_date),
          end_date = COALESCE($5, end_date),
          is_active = COALESCE($6, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *;
    `, [employee_name, department, destination, start_date || null, end_date || null, is_active, id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/loan-exclude/:id/toggle", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool_test.query(`
      UPDATE public.manpower_loan_exclude
      SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `, [id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/loan-exclude/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool_test.query(`DELETE FROM public.manpower_loan_exclude WHERE id = $1`, [id]);
    res.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/loan-exclude/bulk-update", async (req, res) => {
  try {
    const { ids, destination, startDate, endDate } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array is required" });
    }
    await pool_test.query(`
      UPDATE public.manpower_loan_exclude
      SET destination = COALESCE(NULLIF($1, ''), destination),
          start_date = COALESCE($2, start_date),
          end_date = COALESCE($3, end_date),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($4)
    `, [destination, startDate || null, endDate || null, ids]);
    res.json({ success: true, count: ids.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/loan-exclude/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array is required" });
    }
    await pool_test.query(`DELETE FROM public.manpower_loan_exclude WHERE id = ANY($1)`, [ids]);
    res.json({ success: true, count: ids.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// GET /employee-check/:code
// ----------------------------------------------------------------------------
router.get("/employee-check/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const rows = await pool_ot.query(`
      SELECT code, name, department 
      FROM tbl_employee_help 
      WHERE code = ?
      LIMIT 1
    `, [code]);

    if (Array.isArray(rows) && rows.length > 0) {
      res.json({ success: true, found: true, employee: rows[0] });
    } else {
      res.json({ success: true, found: false });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to check employee", details: error.message });
  }
});

// Stubs for loan alert status & history
router.get("/loan-alert-status", (req, res) => {
  res.json({ success: true, hasAlert: false, alertCount: 0, newCount: 0, isReviewed: true });
});
router.get("/loan-history", (req, res) => {
  res.json({ success: true, history: [] });
});
router.post("/mark-loan-reviewed", (req, res) => {
  res.json({ success: true, message: "Marked as reviewed" });
});

module.exports = router;
