const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { factory, department, from_date, to_date } = req.query;
    let queryStr =
      `
      with request_ot as(
      select
        id_no,
        dsn_select_date,
        dsn_con_hr,
        dsn_date_time,
        dsn_department,
        factory 
      from
        manpower.p1_smart_man_working_input_dsn
      join manpower.p1_smart_man_name_list_master
      on id_no = employee_id
      ),
      final_data as(
      select
        coalesce(a.factory, b.factory) as factory,
        coalesce(a.effective_date::date, b.dsn_select_date::date) as effective_date, -- วันที่ 'Effective Date'
          coalesce(c.mhr_dept, b.dsn_department) as dept,
          case 
            when a.scan_in is not null then
              case
                when a.scan_in::time BETWEEN TIME '01:00:00' AND TIME '13:00:00' THEN 'D/S'
                ELSE 'N/S'
              end
            when a.scan_in is null and b.dsn_date_time is not null then 
              case 
                when b.dsn_date_time::time between time '07:00:00' and time '19:00:00' then 'D/S'
                else 'N/S'
              end
            else 'N/S'
          end as shift,
          COUNT(distinct coalesce(a.emp_id_code, b.id_no)) as emp_count, -- จำนวนพนักงานไม่ซ้ำทั้งหมด 'Total'
          COUNT(distinct case when coalesce(a.ot_request, b.dsn_con_hr) > 0 then coalesce(a.emp_id_code, b.id_no) end) as ot_request, -- พนักงานที่มีการขอ OT 'OT Plan'
          COUNT(distinct case when coalesce(a.scan_ot_hr, 0) > 0 then a.emp_id_code end) as ot_actual, -- พนักงานที่มี OT จริง 'OT Actual'
          ROUND(
                  (COUNT(distinct case when coalesce(a.ot_request, b.dsn_con_hr) > 0 then coalesce(a.emp_id_code, b.id_no) end)::numeric
                  / nullif(COUNT(distinct coalesce(a.emp_id_code, b.id_no)), 0)::numeric) * 100, 2) as ot_req_percent, -- % ของพนักงานที่มีการขอ OT '%Plan'     
          ROUND(
                  (COUNT(distinct case when coalesce(a.scan_ot_hr, 0) > 0 then a.emp_id_code end)::numeric
                  / nullif(COUNT(distinct coalesce(a.emp_id_code, b.id_no)), 0)::numeric) * 100, 2) as ot_percent -- % ของพนักงานที่มี OT จริง '%Actual'  
      from
        manpower.p1_smart_man_working_check a
      left join
        manpower.p1_smart_man_cc_master_mhr c
      on
        emp_cc = mhr_cc_desc
      full join 
        request_ot b
      on
        b.id_no = a.emp_id_code
        and b.dsn_select_date = a.effective_date 

      group by
        coalesce(a.factory, b.factory),
        coalesce(a.effective_date::date, b.dsn_select_date::date),
        shift,
        coalesce(c.mhr_dept, b.dsn_department)
      )
      select *
      from final_data
      where 1=1
      `
      ;
    let last_query = `
     order by
        effective_date,
        shift,
        dept;
    `

    const params = [];
    if (factory) {
      params.push(factory);
      queryStr += ` AND factory = $${params.length}`
    }
    if (department) {
      params.push(department);
      queryStr += ` AND  dept = $${params.length}`
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
