const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { main_factory } = req.query;
    let queryStr;

    //K1
    let queryStrK1 =
      `
      SELECT mhr_cc_desc
      FROM manpower.k1_smart_man_cc_master_mhr;
      `
      ;
    //P1
    let queryStrP1 =
      `
      SELECT mhr_cc_desc
      FROM manpower.p1_smart_man_cc_master_mhr;
      `
      ;
    if (main_factory === 'K1') {
      queryStr = queryStrK1;
    } else if (main_factory === 'P1') {
      queryStr = queryStrP1;
    }
    const params = [];
    let result = await query(queryStr, params);
    if (result.rows.length === 0) {
      return res.status(200).send({
        status: "ERROR",
        message: "not found data",
        data: [],
      });
    } else {
      return res.status(200).send({
        status: "OK",
        message: "successfully!",
        data: result.rows,
      });
    }
  } catch (error) {
    res.status(500).send({
      status: "ERROR",
      message: error.toString(),
    });
  }
});

module.exports = router;
