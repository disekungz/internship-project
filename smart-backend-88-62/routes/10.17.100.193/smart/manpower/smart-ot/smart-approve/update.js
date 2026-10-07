const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.patch("/", async (req, res) => {
  try {
    let {name_sv, status_approve,update_date,id } = req.query;
    let queryStr =
      `
        update
          manpower.p1_smart_man_working_input_dsn
        set 
          status_ot = $1,
          dsn_sv_appove = $2,
          dsn_sv_date = $3
        where
          id = ANY($4::int[]);
      `
      ;
    const params = [status_approve,name_sv,update_date,id];
    let result = await query(queryStr, params);
    // if (result.rows.length === 0) {
    //   return res.status(200).send({
    //     status: "ERROR",
    //     message: "not found data",
    //     data: result.rows,
    //   });
    // } else {
      return res.status(200).send({
        status: "OK",
        message: "Update successfully!",
        data: result.rows,
      });
    // }
  } catch (error) {
    res.status(500).send({
      status: "ERROR",
      message: error.toString(),
    });
  }
});

module.exports = router;
