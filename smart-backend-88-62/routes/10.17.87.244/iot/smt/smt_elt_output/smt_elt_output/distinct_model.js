const express = require("express");
const router = express.Router();

const { pool_iot } = require("../../../../config");
const query = (text, params) => pool_iot.query(text, params);

router.get("/", async (req, res) => {
  const {
    startdate,
    stopdate,
    // dept,
    // machine_no,
    // param_code,
    // param_name,
    // out_spec,
    // out_con,
  } = req.query;
  try {
    if (!startdate || !stopdate === "ALL") {
      return res.json({
        status: "ERROR",
        data: [],
        message: "startdate, stopdate และ machine_no ต้องมีค่า",
      });
    }
    let params = [startdate, stopdate];
    let queryStr = `
        SELECT DISTINCT product AS model
        FROM smt.smt_elt_mc_output_analysis
        WHERE  to_char(update_date,'YYYY-MM-DD') >= $1 AND to_char(update_date,'YYYY-MM-DD')  <= $2
        -- AND aor_machine_no = $3
    `;

    // if (line_no?.trim() && line_no !== "ALL") {
    //   params.push(line_no);
    //   queryStr += ` AND line_no = $${params.length} `;
    // }
    // if (product !== "ALL" && product !== "") {
    //   params.push(param_code);
    //   queryStr += ` AND product = $${params.length} `;
    // }
    // if (param_name !== "ALL" && param_name !== "") {
    //   params.push(param_name);
    //   queryStr += ` AND param_name = $${params.length} `;
    // }
    // if (dept !== "ALL" && dept !== "") {
    //   params.push(dept);
    //   queryStr += ` AND dept = $${params.length} `;
    // }
    // if (out_spec === 'true') {
    //   queryStr += ` AND x_r0 is true `;
    // }
    // if (out_con === 'true') {
    //   queryStr += ` AND x_r1 is true `;
    // }

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
