const express = require("express");
const router = express.Router();

const { pool_iot } = require("../../../config");
const query = (text, params) => pool_iot.query(text, params);

router.get("/", async (req, res) => {
  const { startdate, stopdate, line_no } = req.query;
  try {
    let params = [startdate, stopdate];
    let queryStr = `
        SELECT DISTINCT model
        FROM smt.smt_spi_sampling_spc_analysis_action
        WHERE spc_sr_1 IS TRUE
        AND inspection_date_time >= $1::date 
        AND inspection_date_time <= ($2::date + interval '1 day')
    `;

    // Append condition if dept is not 'ALL'
    if (line_no !== "ALL") {
      queryStr += ` AND line_no = $3`; // Adjust query string
      params.push(line_no); // Add dept to params
    }

    queryStr += ` ORDER BY model`; // Add ordering

    const result = await query(queryStr, params);

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
    console.error(err.message);
    return res.json({
      status: "ERROR",
      data: [],
      message: err.message,
    });
  }
});

module.exports = router;
