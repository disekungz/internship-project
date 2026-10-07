const express = require("express");
const router = express.Router();

const { pool_iot } = require("../../../../config");
const query = (text, params) => pool_iot.query(text, params);

router.get("/", async (req, res) => {
  const {
    startdate,
    stopdate,
    model,
    // product,
    // layer,
    // param_name,
    // out_spec,
    // out_con,
  } = req.query;
  try {
    let params = [startdate, stopdate, model];
    let queryStr = `

        SELECT DISTINCT device_id AS machine_no 
        FROM smt.smt_aoi_output_analysis
        WHERE  to_char(created_at,'YYYY-MM-DD') >= $1 AND to_char(created_at,'YYYY-MM-DD')  <= $2
            AND model_name = $3
        
    `;
    // if (product !== "ALL"  && product !== "") {
    //   params.push(product);
    //   queryStr += ` AND product = $${params.length} `;
    // }
    // if (param_name !== "ALL"  && param_name !== "") {
    //   params.push(param_name);
    //   queryStr += ` AND param_name = $${params.length} `;
    // }
    // if (model !== "ALL"  && model !== "") {
    //   params.push(model);
    //   queryStr += ` AND model = $${params.length} `;
    // }
    // if (out_spec === 'true') {
    //   queryStr += ` AND x_r0 is true `;
    // }
    // if (out_con === 'true') {
    //   queryStr += ` AND x_r1 is true `;
    // }
    const last_query = `ORDER BY machine_no`;
    queryStr += last_query;
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
