const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { factory, code_id, work_date, eff_month } = req.query;
    let queryStr = `
    select
	a.eff_month,
	a.dlh_employee_id,
	b.mps_factory as factory,
	a.dlh_effective_date,
	a.work_day_status,
	a.scan_in,
	a.scan_out,
	a.mth_shift,
	a.adj_mth_type,
	a.mth_normal_hour,
	a.mth_ot_hour,
	a.leave_request,
	a.leave_type,
	a.ot_request,
	a.meal,
	a.meal_ot,
	a.night_shift_pay,
	a.sub_overtime,
	a.sub_daily_pay,
	a.late_min,
	a.sub_late_deduction,
	a.dilligent_status,
	a.suggestion_pay,
	a.sub_dilligent_pay
from
	manpower.smart_man_mps_analysis_cost a
left join manpower.smart_man_mps_database_master b
on a.dlh_employee_id = mps_emp_id
where 1=1  
    `
    const params = [];
    if (factory && factory !== 'ALL') {
      params.push(factory);
      queryStr += ` and b.mps_factory = $${params.length}`
    }
    if (code_id) {
      params.push(`%${code_id}%`);
      queryStr += ` and a.dlh_employee_id like $${params.length}`
    }
    if (eff_month) {
      params.push(eff_month);
      queryStr += ` and a.eff_month = $${params.length}`
    }
    if (work_date) {
      params.push(work_date);
      queryStr += ` and a.dlh_effective_date = $${params.length}`
    }
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
    console.log(error.message)
    res.status(500).send({
      status: "ERROR",
      message: error.toString(),
    });
  }
});

module.exports = router;
