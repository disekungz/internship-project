const express = require("express");
const router = express.Router();

const { pool_iot } = require("../../../../config");
const query = (text, params) => pool_iot.query(text, params);

router.get("/", async (req, res) => {
  const {
    startdate,
    stopdate,
    process,
    product,
    dept,
    param_name,
    out_spec,
    out_con,
  } = req.query;
  try {
    let params = [startdate, stopdate, ];
    let queryStr = `
        SELECT DISTINCT layer
        FROM ipqc.spc_datalake_lpi_analysis
        WHERE measuredate::date BETWEEN $1 AND $2
    `;

    if (dept !== "ALL" && dept !== "") {
      params.push(dept);
      queryStr += ` AND dept = $${params.length} `;
    }
    if (product !== "ALL" && product !== "") {
      params.push(product);
      queryStr += ` AND product = $${params.length} `;
    }
    if (param_name !== "ALL"&&param_name !== "") {
      params.push(param_name);
      queryStr += ` AND param_name = $${params.length} `;
    }
    if (process !== "ALL" && process !== "") {
      params.push(process);
      queryStr += ` AND process = $${params.length} `;
    }
    if (out_spec === 'true') {
      queryStr += ` AND x_r0 is true `;
    }
    if (out_con === 'true') {
      queryStr += ` AND x_r1 is true `;
    }

    queryStr += ` ORDER BY layer`; // Add ordering

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
