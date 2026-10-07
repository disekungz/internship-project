const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { code_id, factory } = req.query;
    let queryStr = "";
    ;
    let queryStrK1 = `
    select
      id,
      employee_id,
      name_th,
      name_eng,
      employment_status,
    --	supervisor,
      position_group
    from
      manpower.k1_smart_man_name_list_master
    where employee_id=$1;
        `;
    ;
    let queryStrP1 = `
    select
      id,
      employee_id,
      name_th,
      name_eng,
      employment_status,
    --	supervisor,
      position_group
    from
      manpower.p1_smart_man_name_list_master
    where employee_id=$1;
        `;
    ;
    const params = [code_id];
    if (factory == 'K1') {
      queryStr = queryStrK1
    } else if (factory == 'P1') {
      queryStr = queryStrP1
    }
    let result = await query(queryStr, params);
    if (result.rows.length === 0) {
      return res.status(200).send({
        status: "ERROR",
        message: "ไม่มีรหัสพนักงานนี้",
        data: [],
      });
    } else {
      return res.status(200).send({
        status: "OK",
        message: "พบรหัสพนักงาน",
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
