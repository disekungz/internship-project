const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { code_id } = req.query;
    const queryStr =
      `
        select
        mps_emp_id as employee_id,
        mps_emp_name_eng as name_eng,
        mps_emp_name_thai as name_th,
        mps_factory as factory,
        mps_cost_center as msh_cc
        from
        manpower.smart_man_mps_database_master
        where mps_emp_id = $1
 
      `
      ;
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
    console.log(error)
    res.status(500).send({
      status: "ERROR",
      message: error.toString(),
    });
  }
});

module.exports = router;
