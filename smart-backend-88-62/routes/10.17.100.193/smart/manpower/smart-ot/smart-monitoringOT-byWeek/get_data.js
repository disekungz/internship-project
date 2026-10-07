const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    const { dep, week, factory, code_id } = req.query;
    let queryStr =
      `
      select
        c.factory,
        c.week_code,
        c.emp_id_code,
        c.emp_name,
        c.emp_cc ,
        m.mhr_div as department,
        c.effective_date,
        c.scan_work_hr,
        c.scan_ot_hr as real_ot,
        c.ot_request,
        c.verify_status,
        (select net_time from manpower.smart_man_master_time_hour_mth hm where hm.mth_type = c.work_status_code  LIMIT 1) as total_time,
        --	((c.scan_work_hr IS NOT NULL AND c.scan_ot_hr IS NOT null) or c.verify_status != 'Match') as not_holiday,
        --	((c.scan_work_hr IS NOT NULL AND c.scan_ot_hr IS NOT NULL AND c.verify_status != 'Match')or(c.scan_work_hr IS  NULL AND c.scan_ot_hr IS  NULL AND c.verify_status != 'Match')or(c.scan_work_hr>=0 AND c.scan_ot_hr >=0 )) AS holiday,
        (select MAX(sum_wk_hr) from	manpower.p1_smart_man_working_hrs h where h.week_code = c.week_code and h.emp_id_code = c.emp_id_code) as sum_hrs
      from
        manpower.p1_smart_man_working_check c
      left join manpower.p1_smart_man_cc_master_mhr m
      on c.emp_cc = m.mhr_cc_desc
      where
        1=1
        and ((c.scan_work_hr is not null and c.scan_ot_hr is not null) or c.verify_status != 'Match')
    
      `
      ;
    let params = [];
    if (dep) {
      params.push(dep);
      queryStr += `and m.mhr_div = $${params.length}`
    }
    if (week) {
      params.push(week);
      queryStr += ` and  c.week_code = $${params.length}`
    }
    if (factory) {
      params.push(factory);
      queryStr += ` and  c.factory = $${params.length}`
    }
    if (code_id) {
      params.push(code_id);
      queryStr += ` and c.emp_id_code = $${params.length}`
    }
    queryStr += ` 
      order by c.effective_date asc
    `
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
    res.status(500).send({
      status: "ERROR",
      message: error.toString(),
    });
  }
});

module.exports = router;
