const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { } = req.query;
    const queryStr =
      `
      select
      s.dlh_employee_id as code_id,
      s.dlh_employee_eng as name_eng,
      m.mps_emp_name_thai as name_th,
      m.mps_cost_center as cost_center,
      s.factory,
      s.dlh_clocking_date_status as status,
      s.dlh_clocking_date_time as date_time 
      from
            manpower.smart_man_mps_scan_inout_dlh s
      inner join manpower.smart_man_mps_database_master m
      on s.dlh_employee_id = m.mps_emp_id 
      WHERE   CAST(dlh_clocking_date_time AS DATE) = CURRENT_DATE
      order by  s.dlh_clocking_date_time desc
          `
      ;
    let result = await query(queryStr, []);

    if (result.rows.length === 0) {
      return res.status(200).send({
        status: "ERROR",
        message: "Data not found!",
        data: result.rows,
      });
    } else {
      return res.status(200).send({
        status: "OK",
        message: "Data fetched successfully!",
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
