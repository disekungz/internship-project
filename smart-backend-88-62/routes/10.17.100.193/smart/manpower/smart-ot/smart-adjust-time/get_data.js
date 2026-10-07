const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { data ,from_date,to_date,factory } = req.query;
    let queryStr =
      `
    select
      c.factory,
      c.week_code,
      c.emp_id_code,
      c.emp_name,
      c.emp_cc,
      c.effective_date,
      c.scan_in,
      c.scan_out,
      t.work_day_status,
      c.verify_status as condition,
      c.leave_type,
      c.ot_type,
      c.scan_work_hr as normal,
      c.scan_ot_hr as ot,
      o.dsn_sv_appove,
      o.dsn_sv_date,
      c.work_status_code as code_type
    from
      manpower.p1_smart_man_working_check c
    left join manpower.mps_time_attendance t
      on c.emp_id_code = t.dlh_employee_id and c.effective_date =  TO_CHAR(TO_DATE(t.dlh_effective_date_time, 'DD-MM-YYYY'), 'YYYY-MM-DD')
    left join manpower.p1_smart_man_working_input_dsn o
      on c.emp_id_code = o.id_no and c.effective_date=o.dsn_select_date
    where 1=1 and c.effective_date::date BETWEEN $1 AND $2
      `
      ;
    const last_query = ` order by c.effective_date desc`
    let params=[from_date,to_date,];

    if (factory) {
      params.push(factory);
      queryStr += ` and c.factory = $${params.length}`
    }
    if (data) {
      params.push(data);
      queryStr += ` and c.verify_status = ANY($${params.length})`
    }
    queryStr+=last_query;
    let result = await query(queryStr,params);
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
    console.log(error.message);
    res.status(500).send({
      status: "ERROR",
      message: error.toString(),
    });
  }
});

module.exports = router;
