const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { factory, cost_center, eff_month } = req.query;
    let queryStr = `
select
 a.eff_month,
 b.mps_factory,
-- a.dlh_employee_id,
 b.mps_company,
 b.mps_cost_center,
    SUM(COALESCE(a.meal, 0) + COALESCE(a.meal_ot, 0))      AS cost_meal,
    SUM(COALESCE(a.night_shift_pay, 0))                    AS cost_ns,
    SUM(COALESCE(a.sub_overtime, 0))                       AS cost_ot,
    SUM(COALESCE(a.sub_daily_pay, 0))                      AS cost_mh,
    SUM(COALESCE(a.sub_late_deduction, 0))                 AS unpay_late,
    SUM(COALESCE(a.suggestion_pay, 0))                     AS cost_suggestion,
    SUM(COALESCE(a.mps_dilligent_pay, 0))                  AS cost_dilligent,
 SUM(
     COALESCE(a.meal,0)
   + COALESCE(a.meal_ot,0)
   + COALESCE(a.night_shift_pay,0)
   + COALESCE(a.sub_overtime,0)
   + COALESCE(a.sub_daily_pay,0)
   - COALESCE(a.sub_late_deduction,0)
   + COALESCE(a.suggestion_pay,0)
   + COALESCE(a.mps_dilligent_pay,0)
 ) AS total_cost
from
 manpower.smart_man_mps_analysis_cost a
left join manpower.smart_man_mps_database_master_history b
on a.dlh_employee_id = b.mps_emp_id
where 1=1 
    `
    const last_query = ` 
    group by a.eff_month, b.mps_factory, b.mps_company, b.mps_cost_center 
    order by 
     SUM(
     COALESCE(a.meal,0)
   + COALESCE(a.meal_ot,0)
   + COALESCE(a.night_shift_pay,0)
   + COALESCE(a.sub_overtime,0)
   + COALESCE(a.sub_daily_pay,0)
   - COALESCE(a.sub_late_deduction,0)
   + COALESCE(a.suggestion_pay,0)
   + COALESCE(a.mps_dilligent_pay,0)
 ) desc
    `
    const params = [];
    if (factory && factory !== 'ALL') {
      params.push(factory);
      queryStr += ` and b.mps_factory = $${params.length}`
    }
    if (cost_center) {
      params.push(cost_center);
      queryStr += ` and b.mps_cost_center = $${params.length}`
    }
    if (eff_month) {
      params.push(eff_month);
      queryStr += ` and a.eff_month = $${params.length}`
    }
    queryStr += last_query;
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
