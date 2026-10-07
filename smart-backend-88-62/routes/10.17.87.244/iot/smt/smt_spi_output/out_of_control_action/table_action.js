const express = require("express");
const router = express.Router();

const { pool_iot } = require("../../../../config");
const query = (text, params) => pool_iot.query(text, params);

router.get("/", async (req, res) => {
  const {
    startdate,
    stopdate,
    machine = "ALL",
    product = "ALL",
    // product = "ALL",
    // layer = "ALL",
  } = req.query;

  // Validate required parameters
  if (!startdate || !stopdate) {
    return res.status(400).json({
      status: "ERROR",
      message: "Start date and stop date are required.",
    });
  }

  try {
    // SQL query with placeholders for parameters
    const queryStr = `
      SELECT
        id,
        TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created_at,
        machine AS machine_no,
        product AS model,
        std_target,   
        lot_no AS lot_no,
        total_input,
        reject_count,
        yield,
        ooc,
        root_cause,
        "action",
        action_by,
        TO_CHAR(action_date, 'YYYY-MM-DD HH24:MI:SS') AS action_date,
        approve_by,
        TO_CHAR(approve_date, 'YYYY-MM-DD HH24:MI:SS') AS approve_date
      FROM 
        smt.smt_spi_output_analysis_action 
      WHERE ooc = 0
        AND created_at >= $1::date 
        AND created_at <= ($2::date + interval '1 day')
        AND ($3 = 'ALL' OR machine = $3)
        AND ($4 = 'ALL' OR product = $4)
      ORDER BY
        created_at DESC;
    `;

    const params = [startdate, stopdate, machine, product];

    // Execute the query
    const { rows } = await query(queryStr, params);

    // Respond with data or a no-data message
    if (rows.length > 0) {
      return res.json({
        status: "OK",
        data: rows,
        message: "Data found.",
      });
    } else {
      return res.json({
        status: "OK",
        data: [],
        message: "No data found.",
      });
    }
  } catch (err) {
    console.error("Database error:", err);
    return res.status(500).json({
      status: "ERROR",
      message: "Internal Server Error",
    });
  }
});

module.exports = router;
