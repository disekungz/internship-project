const express = require("express");
const router = express.Router();

const { pool_iot } = require("../../../config");
const query = (text, params) => pool_iot.query(text, params);

router.get("/", async (req, res) => {
  const {
    startdate,
    stopdate,
    line_no = "ALL",
    model = "ALL",
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
        TO_CHAR(inspection_date_time, 'YYYY-MM-DD HH24:MI') AS inspection_date_time,
        model,
        side,
        pcb_no,   
        parameter_name,
        parameter_code,
        parts_name,
        xbar,
        stdev,
        min,
        max,
        spc_xr_0,
        spc_xr_1,
        lcl_x_chart,
        ucl_x_chart,
        cl_x_chart,
        lcl_s_chart,
        ucl_s_chart,
        cl_s_chart,
        lsl,
        usl,
        root_cause,
        "action",
        action_by,
        TO_CHAR(action_date, 'YYYY-MM-DD HH24:MI:SS') AS action_date,
        approve_by,
        TO_CHAR(approve_date, 'YYYY-MM-DD HH24:MI:SS') AS approve_date
      FROM 
        smt.smt_spi_sampling_spc_analysis_action  
      WHERE (spc_xr_0 IS TRUE OR spc_xr_1 IS TRUE)
        AND inspection_date_time >= $1::date 
        AND inspection_date_time <= ($2::date + interval '1 day')
        AND ($3 = 'ALL' OR line_no = $3)
        AND ($4 = 'ALL' OR model = $4)
      ORDER BY
        inspection_date_time DESC;
    `;

    const params = [startdate, stopdate, line_no, model];

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
