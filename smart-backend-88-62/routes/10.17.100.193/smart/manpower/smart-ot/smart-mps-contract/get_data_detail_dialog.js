const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { factory, code_id, main_factory } = req.query;
    let queryStr;
    let queryStrK1 =
      `
      select
        coalesce(n.msh_id_code,
        m.employee_id) as msh_id_code,
        coalesce(n.name_eng,
        m.name_eng) as name,
        m.msh_cc,
        coalesce(nullif(m.join_date,''),n.join_date) as join_date,
        n.contact_time,
        n.end_contact_time
      from
        manpower.k1_smart_man_name_list_contract n
      full outer join manpower.k1_smart_man_name_list_master m
          on
        n.msh_id_code = m.employee_id
      where
        coalesce(n.factory = $1,
        m.factory = $1)
        and coalesce(n.msh_id_code,
        m.employee_id) = $2
      order by
        n.end_contact_time asc nulls last;

      `
      ;
    let queryStrP1 =
      `
      select
        coalesce(n.msh_id_code,
        m.employee_id) as msh_id_code,
        coalesce(n.name_eng,
        m.name_eng) as name,
        m.msh_cc,
        coalesce(nullif(m.join_date,''),n.join_date) as join_date,
        n.contact_time,
        n.end_contact_time
      from
        manpower.p1_smart_man_name_list_contract n
      full outer join manpower.p1_smart_man_name_list_master m
          on
        n.msh_id_code = m.employee_id
      where
        coalesce(n.factory = $1,
        m.factory = $1)
        and coalesce(n.msh_id_code,
        m.employee_id) = $2
      order by
        n.end_contact_time asc nulls last;

      `
      ;
    const params = [factory, code_id];
    if (main_factory === 'K1') {
      queryStr = queryStrK1;
    } else if (main_factory === 'P1') {
      queryStr = queryStrP1;
    }
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
