const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { factory, code_id, name ,join_date ,main_factory} = req.query;
    let queryStr =`
    with data as (
    select
      mps_factory as factory,
      mps_emp_id as msh_id_code,
    --	mps_emp_name_thai,
      mps_emp_name_eng as name_eng,
      mps_join_date as join_date,
      mps_terminate_date as end_contact_time,
    --	mps_birth_date,
    --	mps_position_group,
      mps_cost_center as msh_cc,
    --	mps_job_grade,
    --	mps_supervisor,
    --	mps_emp_status,
      mps_employment_status as employment_status
    --	mps_job_status,
    --	mps_id,
    --	mps_gender,
    --	mps_nationality,
    --	mps_service_years,
    --	mps_age,
    --	mps_tel_no,
    --	mps_career_transition,
    --	mps_resign_reason,
    --	mps_company
    from
      manpower.smart_man_mps_database_master
    )
    select * from data
      where factory = $1
    `;
  //   let queryStrK1 = `select
	// *
  //   from
  //     (
  //     select
  //       coalesce(n.factory , m.factory)         as factory,
  //       coalesce(n.msh_id_code,m.employee_id)   as msh_id_code,
  //       coalesce(n.name_eng,m.name_eng)         as name_eng,
  //       m.msh_cc ,
  //       coalesce(nullif(m.join_date,''),
  //       n.join_date) as join_date,
  //       coalesce(n.contact_time,0)               as contact_time,
  //       n.end_contact_time,
  //       m.employment_status,
  //       row_number() over (
  //         partition by coalesce(n.msh_id_code, m.employee_id)
  //     order by
  //       coalesce(n.contact_time,
  //       0) desc
  //       ) as rn
  //     from
  //       manpower.k1_smart_man_name_list_contract n
  //     full outer join manpower.k1_smart_man_name_list_master m 
  //       on
  //       n.msh_id_code = m.employee_id
  //   ) t
  //    WHERE rn = 1  and employment_status = 'Subcontract Daily'`

     
  //   let queryStrP1 = `select
	// *
  //   from
  //     (
  //     select
  //       coalesce(n.factory , m.factory)         as factory,
  //       coalesce(n.msh_id_code,m.employee_id)   as msh_id_code,
  //       coalesce(n.name_eng,m.name_eng)         as name_eng,
  //       m.msh_cc ,
  //       coalesce(nullif(m.join_date,''),
  //       n.join_date) as join_date,
  //       coalesce(n.contact_time,0)               as contact_time,
  //       n.end_contact_time,
  //       m.employment_status,
  //       row_number() over (
  //         partition by coalesce(n.msh_id_code, m.employee_id)
  //     order by
  //       coalesce(n.contact_time,
  //       0) desc
  //       ) as rn
  //     from
  //       manpower.p1_smart_man_name_list_contract n
  //     full outer join manpower.p1_smart_man_name_list_master m 
  //       on
  //       n.msh_id_code = m.employee_id
  //   ) t
  //    WHERE rn = 1  and employment_status = 'Subcontract Daily'`


    const last_query = ` 
    ORDER BY join_date asc`;

    const params = [factory];
    // if(factory==='K1'){
    //   queryStr = queryStrK1;
    // }else if(factory==='P1'){
    //   queryStr = queryStrP1;
    // }

    // if (factory) {
    //   params.push(factory);
    //   queryStr += ` and factory = $${params.length}`
    // }
    if (code_id) {
      params.push(code_id);
      queryStr += ` and msh_id_code = $${params.length}`
    }
    if (name) {
      params.push(name);
      queryStr += ` and name_eng = $${params.length}`
    }
    if (join_date) {
      params.push(join_date);
      queryStr += ` and join_date = $${params.length}`
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
