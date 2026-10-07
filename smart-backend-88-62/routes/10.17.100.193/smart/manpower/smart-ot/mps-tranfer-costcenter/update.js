const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.patch("/", async (req, res) => {
  try {
    let { cost_center, factory,mhr_cc_type } = req.query;
    let { data_tranfer } = req.body;
    let queryStr =
      `
      with 
      update_mps as (
      update
       manpower.smart_man_mps_database_master
      set
        update_date = (now() at TIME zone 'asia/bangkok'::text),
        mps_cost_center = $1,
        mps_job_status = $7,
        mps_supervisor = NULL
      where
        mps_emp_id = $2
        and mps_factory = $3
      )
      update
       manpower.smart_man_mps_database_master_history
      set
        update_date = (now() at TIME zone 'asia/bangkok'::text),
        mps_cost_center = $4,
         mps_job_status = $8,
        mps_supervisor = NULL
      where
        mps_emp_id = $5 
        and mps_factory = $6
      RETURNING *
      `
      ;

    // const params = [cost_center, cost_center_id, code_id, sv, sv, sv];
    const updatePromises = data_tranfer.map(async (item) => {
      const { msh_id_code,name_eng} = item;
      const params = [cost_center, msh_id_code,factory,cost_center, msh_id_code,factory,mhr_cc_type,mhr_cc_type];

      const result = await query(queryStr, params);

      if (result.rowCount > 0) {
        return {
          employee_id: msh_id_code,
          name_eng: name_eng,
          status: "UPDATE OK",
        };
      } else {
        return {
          employee_id: msh_id_code,
          name_eng: name_eng,
          status: "NOT FOUND",
        };
      }
    });

    const results = await Promise.all(updatePromises);

    return res.json({
      status: "OK",
      message: "Success!",
      data: results,
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({
      status: "ERROR",
      message: "Internal server error",
      data: [],
    });
  }
});

module.exports = router;
