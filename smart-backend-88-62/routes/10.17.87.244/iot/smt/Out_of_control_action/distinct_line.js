const express = require("express");
const router = express.Router();

const { pool_iot } = require("../../../config");
const query = (text, params) => pool_iot.query(text, params);

router.get("/", async (req, res) => {
  const { startdate, stopdate } = req.query;
  try {
    let params = [startdate, stopdate];
    let queryStr = `

        SELECT DISTINCT line_no
        FROM smt.smt_spi_sampling_spc_analysis_action 
        WHERE spc_sr_1 IS TRUE
        AND inspection_date_time >= $1::date 
        AND inspection_date_time <= ($2::date + interval '1 day')
        ORDER BY line_no

    `;

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
