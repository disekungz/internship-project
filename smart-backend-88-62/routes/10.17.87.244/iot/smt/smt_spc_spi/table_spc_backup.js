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
    parameter_name = "ALL",
    parts_name = "ALL",
    // layer = "ALL",

    out_con,
    out_spec,
  } = req.query;

  // Validate the input parameters
  if (!startdate || !stopdate) {
    return res.status(400).json({
      status: "ERROR",
      message: "startdate and stopdate are required",
    });
  }

  try {
    // SQL query with parameters
    const params = [startdate, stopdate];
    let queryStr = `
        select
        id,
        TO_CHAR(inspection_date_time, 'YYYY-MM-DD HH24:MI') as inspection_date_time,
        model,
        pcb_no,
        line_no,
        parts_name,
        parameter_name,
        parameter_code,
        xbar,
        stdev,
        lcl_x_chart,
        ucl_x_chart,
        cl_x_chart,
        lcl_s_chart,
        ucl_s_chart,
        cl_s_chart,
        spc_xr_0,
        spc_xr_1,
        spc_sr_1,
        usl,
        lsl,
        max,
        min,
        spc_xr_0,
        spc_xr_1,
        spc_sr_1,
        side
      from
        smt.smt_spi_sampling_spc_analysis
			WHERE inspection_date_time >= $1::date
      AND inspection_date_time < ($2::date + interval '1 day')
             --     AND ($3 = 'ALL' OR line_no = $3)
             --     AND ($4 = 'ALL' OR model = $4)
             --     AND ($5 = 'ALL' OR parameter_name = $5)
             --     AND ($6 = 'ALL' OR parts_name = $6)
    `;
    if (line_no !== "ALL" && line_no !== "") {
      params.push(line_no);
      queryStr += ` AND line_no = $${params.length} `;
    }
    if (model !== "ALL" && model !== "") {
      params.push(model);
      queryStr += ` AND model = $${params.length} `;
    }
    if (parameter_name !== "ALL" && parameter_name !== "") {
      params.push(parameter_name);
      queryStr += ` AND parameter_name = $${params.length} `;
    }
    if (parts_name !== "ALL" && parts_name !== "") {
      params.push(parts_name);
      queryStr += ` AND parts_name = $${params.length} `;
    }
    if (out_spec === "true") {
      queryStr += ` AND spc_xr_0 is true `;
    }
    if (out_con === "true") {
      queryStr += ` AND spc_xr_1 is true `;
    }
    queryStr += ` ORDER BY inspection_date_time `;
    const result = await query(queryStr, params);
    // Respond with appropriate data
    if (result.rows.length > 0) {
      return res.json({
        status: "OK",
        data: result.rows,
        message: "Data found",
      });
    } else {
      return res.json({
        status: "OK",
        data: [],
        message: "No data found",
      });
    }
  } catch (err) {
    console.error("Database error:", err.message);
    return res.status(500).json({
      status: "ERROR",
      message: "Internal Server Error",
    });
  }
});
module.exports = router;
