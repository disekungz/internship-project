const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { department,to_date,from_date,status} = req.query;
    let queryStr = `
        with total_work as (
        select
        effective_date as update_date,
        mhr_dept,
        job_status,
        dpt_emp_cnt,
        total_att_cnt,
        shift
        from manpower.p1_smart_man_analyze_attendance
        ), 
        total_ot_req as (
        select 
        a.dsn_select_date,
        c.mhr_dept,
        b.job_status,
        count(a.id_no) as total_ot,
        CASE
          WHEN RIGHT(c.mhr_cc, 1) IN ('A', 'B') THEN RIGHT(c.mhr_cc, 1) ELSE 'DS' 
        END AS shift
        from manpower.p1_smart_man_working_input_dsn a
        left join manpower.p1_smart_man_name_list_master b
        on a.id_no = b.employee_id 
        LEFT JOIN manpower.p1_smart_man_cc_master_mhr c
        ON b.cost_center_id = c.mhr_cc and b.msh_cc = c.mhr_cc_desc
        where status_ot != 'Reject' and dsn_con_wk != 'Cancle OT' 
        group by a.dsn_select_date, c.mhr_dept, b.job_status, shift
        )
        select 
        a.*,
        coalesce(b.total_ot, 0) as ot,
        coalesce(round((coalesce(b.total_ot, 0)::numeric / nullif(a.total_att_cnt, 0))*100, 2),0) as ratio
        from total_work a
        left join total_ot_req b
        on a.update_date  = b.dsn_select_date 
        and a.mhr_dept = b.mhr_dept 
        and a.job_status = b.job_status
        and a.shift = b.shift
        where 1=1
        `;
    // const last_query =` 
    // group by update_date,
    //   mhr_dept,
    //   job_status,
    //   total_att_cnt,
    //   ot,
    //   shift
    // order by update_date asc,mhr_dept,job_status
    // `;
    const params = [];
    if (from_date && to_date) {
      params.push(from_date, to_date);
      queryStr += ` AND a.update_date::date BETWEEN $${params.length - 1} AND $${params.length}`;
    }
    if (department) {
      params.push(department);
      queryStr += ` and  a.mhr_dept = $${params.length}`
    }
    if (status) {
      params.push(status);
      queryStr += ` and a.job_status = $${params.length}`
    }
    // queryStr += last_query;
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
