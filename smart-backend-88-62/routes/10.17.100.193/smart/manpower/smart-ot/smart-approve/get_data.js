const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { cost_center, status_approve, } = req.query;
    const { data_cc } = req.body;
    let queryStr =
      `
      select
        i.id,
        i.id_no,
        m.name_eng,
        i.dsn_process_cc,
        i.dsn_select_date,
        i.dsn_con_wk,
        i.dsn_con_hr,
        i.dsn_date_time,
        i.dsn_department,
        i.remark,
        i.dsn_sv_appove,
        i.status_ot as status
      from
        manpower.p1_smart_man_working_input_dsn i
      inner join manpower.p1_smart_man_name_list_master m
      on i.id_no = m.employee_id
      where 1=1 
      `
      ;
    let data_cc_filter = [];
    if (data_cc) {
      data_cc_filter = data_cc;
    }
    const params = [];
    if (status_approve) {
      params.push(status_approve);
      queryStr += ` and i.status_ot = $${params.length}`
    }
    if (cost_center) {
      params.push(cost_center);
      queryStr += ` and i.dsn_process_cc = ANY($${params.length}::text[])`
    }
    let result = await query(queryStr, params);
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
