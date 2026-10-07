const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { code_id } = req.query;
    const queryStr = `
      select
        m.factory,
        m.employee_id,
        m.name_eng,
        m.msh_cc,
        s.mhr_dept,
        w.week_code, 
        w.sum_wk_hr, 
        w.left_hrs, 
        w.count_day
      from
        manpower.p1_smart_man_name_list_master m
      inner join manpower.p1_smart_man_cc_master_mhr s
       on m.msh_cc = s.mhr_cc_desc
      left join manpower.p1_smart_man_working_hrs w
       on w.emp_id_code = m.employee_id
       and w.factory = m.factory
      where m.employee_id= $1
      group by m.factory,
        m.employee_id,
        m.name_eng,
        m.msh_cc,
        s.mhr_dept,
        w.week_code, 
        w.sum_wk_hr, 
        w.left_hrs, 
        w.count_day
      order by w.week_code desc limit 1
      `;
    let result = await query(queryStr, [code_id]);

    if (result.rows.length === 0) {
      return res.status(200).send({
        status: "ERROR",
        message: "ไม่พบรหัสพนักงาน",
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
