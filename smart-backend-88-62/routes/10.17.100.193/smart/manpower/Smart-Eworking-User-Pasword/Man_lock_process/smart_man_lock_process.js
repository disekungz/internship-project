const express = require("express");
const router = express.Router();
const { Pool } = require("pg");

const pool = new Pool({
  host: "10.17.66.121",
  port: 5432,
  user: "postgres",
  password: "ez2ffp0bp5U3",
  database: "iot",
  application_name: "express-api-3000",
});

router.get("/man_processTable", async (req, res) => {
  try {
    const { select_dept, select_process, otmgm_lock_status } = req.query;

    let query = `
      SELECT *, TO_CHAR(otmgm_create_date, 'YYYY-MM-DD HH24:MI') AS formatted_create_date
      FROM smart.smart_man_lock_process
    `;

    const queryParams = [];

    if (select_dept && select_dept !== "ALL") {
      query += `
        WHERE octr_dept = $1
      `;
      queryParams.push(select_dept);
    }

    if (select_process && select_process !== "ALL") {
      if (queryParams.length > 0) {
        query += ` AND proc_disp = $${queryParams.length + 1}`;
      } else {
        query += ` WHERE proc_disp = $1`;
      }
      queryParams.push(select_process);
    }

    if (otmgm_lock_status !== "ALL") {
      if (queryParams.length > 0) {
        query += `
          AND otmgm_lock_status = $${queryParams.length + 1}
        `;
      } else {
        query += `
          WHERE otmgm_lock_status = $1
        `;
      }
      queryParams.push(otmgm_lock_status);
    }

    query += `
      ORDER BY otmgm_create_date DESC;
    `;

    const result = await pool.query(query, queryParams);

    // Send the JSON response back to the client
    res.json(result.rows);
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

router.get("/distinct_dept", async (req, res) => {
  try {
    const result = await pool.query(
      `
      select distinct octr_dept 
from smart.smart_man_lock_process smlp 
      
      `
    );

    // Send the JSON response back to the client
    res.json(result.rows);
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

router.get("/distinct_process", async (req, res) => {
  try {
    const { select_dept } = req.query;
    let query = `
      select distinct proc_disp 
from smart.smart_man_lock_process smlp 
    `;

    if (select_dept !== "ALL") {
      query += `
        WHERE octr_dept = $1
      `;
    }

    const queryParams = select_dept !== "ALL" ? [select_dept] : [];

    console.log("Executing SQL Query:", query);
    console.log("Query Parameters:", queryParams);

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

router.get("/lock_status_btn_card", async (req, res) => {
  try {
    const { select_dept, select_process } = req.query;

    const query = `
      SELECT otmgm_lock_status, COUNT(*) AS result
      FROM (
          SELECT 'ALL' AS otmgm_lock_status, 1 AS sort_order
          FROM smart.smart_man_lock_process
          WHERE
              otmgm_lock_status IN ('Y', 'N')
              AND
              ($1 = 'ALL' OR octr_dept = $1)
              AND
              ($2 = 'ALL' OR proc_disp = $2)
          UNION ALL
          SELECT otmgm_lock_status, 2 AS sort_order
          FROM smart.smart_man_lock_process
          WHERE 
              otmgm_lock_status IN ('Y', 'N')
              AND
              ($1 = 'ALL' OR octr_dept = $1)
              AND
              ($2 = 'ALL' OR proc_disp = $2)
      ) AS combined_data
      GROUP BY otmgm_lock_status, sort_order
      ORDER BY sort_order, otmgm_lock_status;
    `;

    const values = [select_dept, select_process];

    const result = await pool.query(query, values);

    // Send the JSON response back to the client
    res.json(result.rows);
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

module.exports = router;
