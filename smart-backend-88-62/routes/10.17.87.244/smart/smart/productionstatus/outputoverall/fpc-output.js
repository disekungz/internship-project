const express = require("express");
const router = express.Router();

// Database pool from config (4 levels up to routes/10.17.87.244/config.js)
const { pool_smart } = require("../../../../config");
const query = (text, params) => pool_smart.query(text, params);
const { getCached, setCache } = require("../../../../../../Utility/apiCache");

// ----------------------------------------------------------------------------
// GET /available-months
// Fetch distinct YYYY-MM months that have output data, for Dropdown
// ----------------------------------------------------------------------------
router.get("/available-months", async (req, res) => {
  try {
    const sqlStatement = `
      SELECT DISTINCT TO_CHAR(output_date, 'YYYY-MM') AS month
      FROM smart.smart_fpc_output_detail 
      WHERE output_date IS NOT NULL 
      ORDER BY month DESC
    `;
    const result = await query(sqlStatement);
    res.status(200).json(result.rows.map((row) => row.month));
  } catch (error) {
    console.error("[OutputOverall] Error fetching available-months:", error.message);
    res.status(500).json({ error: "Cannot fetch available months" });
  }
});

// ----------------------------------------------------------------------------
// GET /available-dates?month=YYYY-MM
// Fetch distinct dates within a selected month, for Dropdown
// ----------------------------------------------------------------------------
router.get("/available-dates", async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.json([]);
    const sqlStatement = `
      SELECT DISTINCT TO_CHAR(output_date, 'YYYY-MM-DD') AS date
      FROM smart.smart_fpc_his_proc_output_detail 
      WHERE output_date IS NOT NULL 
        AND TO_CHAR(output_date, 'YYYY-MM') = $1
      ORDER BY date DESC
    `;
    const result = await query(sqlStatement, [month]);
    res.status(200).json(result.rows.map((row) => row.date));
  } catch (error) {
    console.error("[OutputOverall] Error fetching available-dates:", error.message);
    res.status(500).json({ error: "Cannot fetch available dates" });
  }
});

// ----------------------------------------------------------------------------
// GET /fpc-output?month=YYYY-MM&process=SMT|SMT_F|E-FPC
// Fetch daily actual output vs target for the selected month and process type
// Real-time enabled: Includes current-day production
// Processes:
//   SMT    -> actual from smart_fpc_process_output_detail WHERE proc_disp = 'MQA'
//   SMT_F  -> actual from smart_fpc_process_output_detail WHERE proc_disp IN ('MMOT1','MMOT2')
//   E-FPC  -> actual from smart_fpc_output_detail (default)
// ----------------------------------------------------------------------------
router.get("/fpc-output", async (req, res) => {
  try {
    const { month, process, _t } = req.query;

    const cacheKey = `fpc-output:${month}:${process}`;
    if (!_t) {
      const cached = getCached(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(cached);
      }
    }

    const values = [];
    let actualQuery = "";
    let targetQuery = "";

    if (process === "SMT") {
      actualQuery = `
        SELECT 
          TO_CHAR(output_date, 'YYYY-MM-DD') AS "output_date",
          SUM(lot_qty) AS "lot_qty",
          SUM(pcs_qty) AS "pcs_qty",
          SUM(sht_qty) AS "sht_qty"
        FROM smart.smart_fpc_process_output_detail
        WHERE output_date IS NOT NULL
          AND proc_disp = 'MQA'
      `;
      targetQuery = `
        SELECT 
          TO_CHAR("date", 'YYYY-MM-DD') AS "output_date",
          SUM(smt_total_pcs) AS "target_qty",
          0 AS "target_sht_qty",
          0 AS "target_lot_qty"
        FROM smart.smart_fpc_output_target
        WHERE "date" IS NOT NULL
      `;
    } else if (process === "SMT_F") {
      actualQuery = `
        SELECT 
          TO_CHAR(output_date, 'YYYY-MM-DD') AS "output_date",
          SUM(lot_qty) AS "lot_qty",
          SUM(pcs_qty) AS "pcs_qty",
          SUM(sht_qty) AS "sht_qty"
        FROM smart.smart_fpc_process_output_detail
        WHERE output_date IS NOT NULL
          AND proc_disp IN ('MMOT1', 'MMOT2')
      `;
      targetQuery = `
        SELECT 
          TO_CHAR("date", 'YYYY-MM-DD') AS "output_date",
          SUM(smt_f_total_pcs) AS "target_qty",
          0 AS "target_sht_qty",
          0 AS "target_lot_qty"
        FROM smart.smart_fpc_output_target
        WHERE "date" IS NOT NULL
      `;
    } else {
      // Default: E-FPC
      actualQuery = `
        SELECT 
          TO_CHAR(output_date, 'YYYY-MM-DD') AS "output_date",
          SUM(lot_qty) AS "lot_qty",
          SUM(pcs_qty) AS "pcs_qty",
          SUM(sht_qty) AS "sht_qty"
        FROM smart.smart_fpc_output_detail
        WHERE output_date IS NOT NULL
      `;
      targetQuery = `
        SELECT 
          TO_CHAR("date", 'YYYY-MM-DD') AS "output_date",
          SUM(e_fpc_total_pcs) AS "target_qty",
          SUM(e_fpc_total_sheet) AS "target_sht_qty",
          SUM(e_fpc_total_lot) AS "target_lot_qty"
        FROM smart.smart_fpc_output_target
        WHERE "date" IS NOT NULL
      `;
    }

    // Append month filter if provided
    if (month) {
      values.push(month);
      actualQuery += ` AND TO_CHAR(output_date, 'YYYY-MM') = $${values.length} `;
      targetQuery += ` AND TO_CHAR("date", 'YYYY-MM') = $${values.length} `;
    }

    const sqlStatement = `
      WITH actual AS (
        ${actualQuery}
        GROUP BY TO_CHAR(output_date, 'YYYY-MM-DD')
      ),
      target AS (
        ${targetQuery}
        GROUP BY TO_CHAR("date", 'YYYY-MM-DD')
      )
      SELECT 
        COALESCE(a.output_date, t.output_date) AS "output_date",
        COALESCE(a.lot_qty, 0) AS "lot_qty",
        COALESCE(a.pcs_qty, 0) AS "pcs_qty",
        COALESCE(a.sht_qty, 0) AS "sht_qty",
        COALESCE(t.target_qty, 0) AS "target_qty",
        COALESCE(t.target_sht_qty, 0) AS "target_sht_qty",
        COALESCE(t.target_lot_qty, 0) AS "target_lot_qty"
      FROM actual a
      FULL OUTER JOIN target t ON a.output_date = t.output_date
      ORDER BY COALESCE(a.output_date, t.output_date) ASC
      LIMIT 31
    `;

    const result = await query(sqlStatement, values);
    setCache(cacheKey, result.rows, 60_000);
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("[OutputOverall] Error fetching fpc-output:", error.message);
    res.status(500).json({
      error: "Cannot fetch output data",
      details: error.message,
    });
  }
});

module.exports = router;