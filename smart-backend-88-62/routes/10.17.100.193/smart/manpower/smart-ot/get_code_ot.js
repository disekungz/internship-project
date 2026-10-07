const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let {  } = req.query;
    const queryStr =
      `
      select
        distinct wk_con
      from
        manpower.smart_man_master_ot
      where wk_con != 'Forget_ID_Card';
      `
      ;
    let result = await query(queryStr, []);

    if (result.rows.length === 0) {
      return res.status(200).send({
        status: "ERROR",
        message: "not found data",
        data: result.rows,
      });
    } else {
      return res.status(200).send({
        status: "OK",
        message: "successfully!",
        data: result.rows,
      });
    }
  } catch (error) {
    console.log(error.message)
    res.status(500).send({
      status: "ERROR",
      message: error.toString(),
    });
  }
});

module.exports = router;
