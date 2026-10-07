const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { factory, code_id, name, join_date } = req.query;
    let queryStr = `
    select
      a.id,
      a.factory,
      a.emp_id,
      b.name_eng,
      a.pickup_point,
      a.rount
    from
      manpower.p1_smart_man_bus_route_master a
    right join manpower.p1_smart_man_name_list_master b
    on a.emp_id = b.employee_id
    where 1=1 
        `;
    ;
    const last_query = ` order by a.id`
    const params = [];
    if (factory) {
      params.push(factory);
      queryStr += ` and a.factory = $${params.length}`
    }
    if (code_id) {
      params.push(code_id);
      queryStr += ` and  a.emp_id = $${params.length}`
    }
    if (name) {
      params.push(name);
      queryStr += ` and b.name_eng = $${params.length}`
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
    res.status(500).send({
      status: "ERROR",
      message: error.toString(),
    });
  }
});

module.exports = router;
