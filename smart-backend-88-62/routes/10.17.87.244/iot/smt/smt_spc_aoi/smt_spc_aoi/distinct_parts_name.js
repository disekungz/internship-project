const express = require("express");
const router = express.Router();

const { pool_iot } = require("../../../../config");
const query = (text, params) => pool_iot.query(text, params);

router.get("/", async (req, res) => {
  const {
    startdate,
    stopdate,
    machine_no,
    // dept,
    model,
    // parameter_name,
    // out_spec,
    // out_con,
  } = req.query;
  try {
    let params = [startdate, stopdate, machine_no, model];
    let queryStr = `
        SELECT DISTINCT ref_name AS parts_name
        FROM smt.smt_aoi_pchart_analysis
        WHERE update_date >= $1::date 
        AND update_date < ($2::date + interval '1 day')
        AND aor_machine_no = $3
        AND aor_program_name = $4
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
