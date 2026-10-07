const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { department,date,status} = req.query;
    let queryStr = `
       select
          effective_date as update_date,
          mhr_dept,
          job_status,
          dpt_emp_cnt,
          total_att_cnt,
          attend_ratio,
          shift
          from
        manpower.p1_smart_man_analyze_attendance
        where  1=1
        `
    ;                        
    const params = [];
    if (date) {
      params.push(date);
      queryStr += ` and effective_date = $${params.length}`
    }
    if (department) {
      params.push(department);
      queryStr += ` and mhr_dept = $${params.length}`
    }
    if (status) {
      params.push(status);
      queryStr += ` and job_status = $${params.length}`
    }
    // if (date) {
    //   params.push(date);
    //   queryStr += ` and  a.emp_id = $${params.length}`
    // }
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
    console.log(error.message);
    res.status(500).send({
      status: "ERROR",
      message: error.toString(),
    });
  }
});

module.exports = router;
