const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { factory, from_date, to_date } = req.query;
    let queryStr =
      `
      with final_data as(
      select
          coalesce(a.factory, b.factory) as factory,
          coalesce(a.effective_date::date, c.dsn_select_date::date) as effective_date,               -- วันที่
          COALESCE(b.job_status, '(unknown)') AS job_status,      -- job status
          COUNT(DISTINCT coalesce(a.emp_id_code, c.id_no)) AS emp_count,             -- จำนวนพนักงานไม่ซ้ำทั้งหมด
          COUNT(DISTINCT CASE WHEN coalesce(a.scan_ot_hr, 0) > 0 THEN a.emp_id_code END) AS emp_ot_count,   -- จำนวนพนักงานที่มี OT จริง
          COUNT(DISTINCT CASE WHEN coalesce(a.ot_request, c.dsn_con_hr) > 0 THEN coalesce(a.emp_id_code, c.id_no) END) AS emp_ot_req_count, -- จำนวนพนักงานที่มีการขอ OT
        ROUND(
              (COUNT(DISTINCT CASE WHEN coalesce(a.scan_ot_hr, 0) > 0 THEN a.emp_id_code END)::numeric
            / NULLIF(COUNT(DISTINCT coalesce(a.emp_id_code, c.id_no)), 0)::numeric) * 100, 2
          ) AS ot_percentage,  -- % พนักงานที่ทำ OT จริง
        ROUND(
              (COUNT(DISTINCT CASE WHEN coalesce(a.ot_request, c.dsn_con_hr) > 0 THEN coalesce(a.emp_id_code, c.id_no) END)::numeric
            / NULLIF(COUNT(DISTINCT coalesce(a.emp_id_code, c.id_no)), 0)::numeric) * 100, 2
        ) AS ot_req_percentage  -- % พนักงานที่มีการขอ OT
      FROM
        manpower.p1_smart_man_working_check a
      full join
        manpower.p1_smart_man_working_input_dsn c
      on  c.id_no = a.emp_id_code
        and c.dsn_select_date = a.effective_date 
      LEFT JOIN
        manpower.p1_smart_man_name_list_master b
      ON  a.emp_id_code = b.employee_id
        or c.id_no = b.employee_id
      GROUP BY
        coalesce(a.effective_date::date, c.dsn_select_date::date),
          COALESCE(b.job_status, '(unknown)'),
          coalesce(a.factory, b.factory)
      )
      select *
      from final_data
      where 1=1 
  `
  ;
    let last_query = `
        ORDER BY
          effective_date,
          job_status; 
        `

    const params = [];
    if (factory) {
      params.push(factory);
      queryStr += ` AND factory = $${params.length}`
    }
    if (from_date && to_date) {
      params.push(from_date, to_date);
      queryStr += ` AND effective_date::date BETWEEN $${params.length - 1} AND $${params.length}`;
    }
    let result = await query(queryStr + last_query, params);
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
