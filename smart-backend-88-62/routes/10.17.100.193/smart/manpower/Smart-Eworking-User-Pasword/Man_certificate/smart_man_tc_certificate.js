const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/distinct_dept", async (req, res) => {
  try {
    let {} = req.query;
    const queryStr = `
  select distinct b.octr_dept
from 
manpower.p1_smart_man_name_list_master a
left join manpower.smart_man_tc_certificate b 
on a.employee_id = b.octn_emp_id
order by 
b.octr_dept asc 
      `;
    let result = await query(queryStr, []);

    // Send the JSON response back to the client
    res.json(result.rows);
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

router.get("/distinct_cc", async (req, res) => {
  try {
    const { select_dept } = req.query;
    let queryStr = `
      SELECT DISTINCT a.msh_cc as cost_center
      FROM manpower.p1_smart_man_name_list_master a
      LEFT JOIN manpower.smart_man_tc_certificate b
      ON a.employee_id = b.octn_emp_id
    `;

    // ตรวจสอบค่า octr_dept เพื่อกำหนดเงื่อนไขในคำสั่ง SQL
    if (select_dept !== "ALL") {
      queryStr += `
        WHERE b.octr_dept = $1
      `;
    }

    const queryParams = select_dept !== "ALL" ? [select_dept] : [];
    let result = await query(queryStr, queryParams);
    // const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

router.get("/distinct_table_no", async (req, res) => {
  try {
    const { select_dept, select_cc } = req.query;

    let query = `
      SELECT DISTINCT b.octr_table_no
      FROM manpower.p1_smart_man_name_list_master a
      LEFT JOIN manpower.smart_man_tc_certificate b
      ON a.employee_id = b.octn_emp_id
    `;

    if (select_dept && select_dept !== "ALL") {
      query += `
        WHERE b.octr_dept = $1
      `;
    }

    if (select_cc && select_cc !== "ALL") {
      if (select_dept && select_dept !== "ALL") {
        query += ` AND `;
      } else {
        query += ` WHERE `;
      }
      query += `
        a.msh_cc = $2
      `;
    }

    const queryParams = [];
    if (select_dept && select_dept !== "ALL") {
      queryParams.push(select_dept);
    }
    if (select_cc && select_cc !== "ALL") {
      queryParams.push(select_cc);
    }

    // const result = await pool.query(query, queryParams);
    let result = await pool_iot.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

router.get("/TableData_Man_Cer", async (req, res) => {
  try {
    const { select_dept, select_cc, select_table_no, status } = req.query;
    let query = `
SELECT
  ROW_NUMBER() OVER (ORDER BY b.octn_cer_expire ASC, b.octr_dept ASC, a.employee_id) AS id,
  COALESCE(b.status, 'No certificate') AS status,
  a.employee_id as id_code,
  a.name_eng as name,
  NULL as surname ,
  a.msh_cc as cost_center,
  b.octr_dept,
  TO_CHAR(b.octn_update_date, 'YYYY-MM-DD HH24:MI') AS octn_update_date,
  TO_CHAR(b.octn_cer_expire, 'YYYY-MM-DD HH24:MI') AS octn_cer_expire,
  b.octr_table_no,
  b.otbm_table_code,
  b.otbm_table_name,
  b.octn_ojt_result
FROM
  manpower.p1_smart_man_name_list_master a
LEFT JOIN manpower.smart_man_tc_certificate b
ON a.employee_id = b.octn_emp_id
`;

    const queryParams = [];
    let whereClauseAdded = false;

    if (select_dept && select_dept !== "ALL") {
      query += `
    WHERE b.octr_dept = $1
  `;
      queryParams.push(select_dept);
      whereClauseAdded = true;
    }

    if (select_cc && select_cc !== "ALL") {
      if (whereClauseAdded) {
        query += ` AND `;
      } else {
        query += ` WHERE `;
        whereClauseAdded = true;
      }
      query += `
    a.msh_cc = $${queryParams.length + 1}
  `;
      queryParams.push(select_cc);
    }

    if (select_table_no && select_table_no !== "ALL") {
      if (whereClauseAdded) {
        query += ` AND `;
      } else {
        query += ` WHERE `;
      }
      query += `
    b.octr_table_no = $${queryParams.length + 1}
  `;
      queryParams.push(select_table_no);
    }

    if (status !== "ALL") {
      if (queryParams.length > 0) {
        query += `
          AND status = $${queryParams.length + 1}
        `;
      } else {
        query += `
          WHERE status = $1
        `;
      }
      queryParams.push(status);
    }

    query += `
  ORDER BY
    b.octn_cer_expire ASC,
    b.octr_dept ASC,
    b.octn_emp_id ASC
`;

    // const result = await pool.query(query, queryParams);
    let result = await pool_iot.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

router.get("/card_certificate", async (req, res) => {
  try {
    const { select_dept, select_cc, select_table_no } = req.query;

    let query = `
      SELECT
        COUNT(*) AS result,
        COALESCE(b.status, 'No certificate') AS status
      FROM
        manpower.p1_smart_man_name_list_master a
      LEFT JOIN manpower.smart_man_tc_certificate b
        ON a.employee_id = b.octn_emp_id
      WHERE
        COALESCE(b.status, 'No certificate') <> 'No certificate'
    `;

    const values = [];

    if (select_dept && select_dept !== "ALL") {
      query += ` AND b.octr_dept = $${values.push(select_dept)}`;
    }

    if (select_cc && select_cc !== "ALL") {
      query += ` AND a.msh_cc = $${values.push(select_cc)}`;
    }

    if (select_table_no && select_table_no !== "ALL") {
      query += ` AND b.octr_table_no = $${values.push(select_table_no)}`;
    }

    query += `
      GROUP BY
        COALESCE(b.status, 'No certificate');
    `;

    // const result = await pool.query(query, values);
    let result = await pool_iot.query(query, values);

    res.json(result.rows);
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

module.exports = router;
