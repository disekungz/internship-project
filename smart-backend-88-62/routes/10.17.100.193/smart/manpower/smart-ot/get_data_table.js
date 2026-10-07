const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { date_now } = req.query;
    const queryStr =
      `
      select
        m.id_no,
        m.dsn_select_date,
        m.dsn_con_wk,
        m.dsn_con_hr,
        nm.name_eng 
      from
        manpower.p1_smart_man_working_input_dsn m
      inner join manpower.p1_smart_man_name_list_master nm
      on m.id_no = nm.employee_id
      where dsn_select_date::date = $1::date 
      order by dsn_select_date desc
      limit 10
      `
      ;
    let result = await query(queryStr, [date_now]);

    if (result.rows.length === 0) {
      return res.status(200).send({
        status: "ERROR",
        message: "์Not found data",
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
    res.status(500).send({
      status: "ERROR",
      message: error.toString(),
    });
  }
});

module.exports = router;
