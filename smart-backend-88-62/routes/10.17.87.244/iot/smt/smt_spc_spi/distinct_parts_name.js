const express = require("express");
const router = express.Router();

const { pool_iot } = require("../../../config");
const query = (text, params) => pool_iot.query(text, params);

router.get("/", async (req, res) => {
  const {    startdate,
    stopdate,
    model,
    // dept,
    line_no,
    parameter_name,
    out_spec,
    out_con, } = req.query;
  try {
    let params = [startdate, stopdate, line_no, model, parameter_name];
    let queryStr = `
        SELECT DISTINCT parts_name
        FROM smt.smt_spi_sampling_spc_analysis
        WHERE inspection_date_time >= $1::date 
        AND inspection_date_time < ($2::date + interval '1 day')
        AND line_no = $3
        AND model = $4
        AND parameter_name =$5
    `;

  // if (layer !== "ALL" && layer !== "") {
  //     params.push(layer);
  //     queryStr += ` AND line_no = $${params.length} `;
  //   }
  //   if (dept !== "ALL" && dept !== "") {
  //     params.push(dept);
  //     queryStr += ` AND dept = $${params.length} `;
  //   }
  //   if (param_name !== "ALL" && param_name !== "") {
  //     params.push(param_name);
  //     queryStr += ` AND param_name = $${params.length} `;
  //   }
  //   if (model !== "ALL" && model !== "") {
  //     params.push(model);
  //     queryStr += ` AND model = $${params.length} `;
  //   }
  //   if (out_spec === 'true') {
  //     queryStr += ` AND x_r0 is true `;
  //   }
  //   if (out_con === 'true') {
  //     queryStr += ` AND x_r1 is true `;
  //   }

    queryStr += ` ORDER BY parts_name`; // Add ordering

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
