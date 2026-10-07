const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let {factory,dep} = req.query;
    let queryStr = `
    select
      a.factory,
      a.employee_id,
      a.name_eng,
      b.mhr_div
    from manpower.p1_smart_man_name_list_master a
    inner join manpower.p1_smart_man_cc_master_mhr b
    on a.msh_cc = b.mhr_cc_desc
    where 1=1 
        `;
    ;
    const params = [];
    if (factory) {
      params.push(factory);
      queryStr += ` and a.factory = $${params.length}`
    }
    if (dep) {
      params.push(dep);
      queryStr += ` and b.mhr_div = $${params.length}`
    }
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
