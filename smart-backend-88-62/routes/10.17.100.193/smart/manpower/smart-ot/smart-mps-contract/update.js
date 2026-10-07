const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.patch("/", async (req, res) => {
  try {
    let { cost_center, cost_center_id, code_id, sv, factory } = req.query;
    let queryStr;
    let queryStrK1 =
      `
      with 
      update_nlm as (
        update
          manpower.k1_smart_man_name_list_master
        set
          update_date = (now() at TIME zone 'asia/bangkok'::text),
          msh_cc = $1,
          cost_center_id = $2,
          supervisor = $4
        where
          employee_id = $3
        RETURNING employee_id,msh_cc
      ),
      update_nlm_his as (
        update
          manpower.k1_smart_man_name_list_master_history
        set
          update_date = (now() at TIME zone 'asia/bangkok'::text),
          msh_cc = $1,
          cost_center_id = $2,
          supervisor = $4
        where
          employee_id = $3
        RETURNING employee_id,msh_cc
      ),
      update_mps as (
      update
       manpower.smart_man_mps_database_master
      set
        update_date = (now() at TIME zone 'asia/bangkok'::text),
        mps_cost_center = (select msh_cc from update_nlm),
        mps_supervisor = $5
      where
        mps_emp_id IN (select employee_id from update_nlm)
      )
      update
       manpower.smart_man_mps_database_master_history
      set
        update_date = (now() at TIME zone 'asia/bangkok'::text),
        mps_cost_center = (select msh_cc from update_nlm),
        mps_supervisor = $6
      where
        mps_emp_id IN (select employee_id from update_nlm)
      RETURNING *
      `
      ;
    let queryStrP1 =
      `
      with 
      update_nlm as (
        update
          manpower.p1_smart_man_name_list_master
        set
          update_date = (now() at TIME zone 'asia/bangkok'::text),
          msh_cc = $1,
          cost_center_id = $2,
          supervisor = $4
        where
          employee_id = $3
        RETURNING employee_id,msh_cc
      ),
      update_nlm_his as (
        update
          manpower.p1_smart_man_name_list_master_history
        set
          update_date = (now() at TIME zone 'asia/bangkok'::text),
          msh_cc = $1,
          cost_center_id = $2,
          supervisor = $4
        where
          employee_id = $3
        RETURNING employee_id,msh_cc
      ),
      update_mps as (
      update
       manpower.smart_man_mps_database_master
      set
        update_date = (now() at TIME zone 'asia/bangkok'::text),
        mps_cost_center = (select msh_cc from update_nlm),
        mps_supervisor = $5
      where
        mps_emp_id IN (select employee_id from update_nlm)
      )
      update
       manpower.smart_man_mps_database_master_history
      set
        update_date = (now() at TIME zone 'asia/bangkok'::text),
        mps_cost_center = (select msh_cc from update_nlm),
        mps_supervisor = $6
      where
        mps_emp_id IN (select employee_id from update_nlm)
      RETURNING *
      `
      ;
    if (factory === 'K1') {
      queryStr = queryStrK1;
    } else if (factory === 'P1') {
      queryStr = queryStrP1;
    }
    const params = [cost_center, cost_center_id, code_id, sv,sv,sv];
    let result = await query(queryStr, params);
    return res.status(200).send({
      status: "OK",
      message: "Update successfully!",
      data: result.rows,
    });
    // }
  } catch (error) {
    res.status(500).send({
      status: "ERROR",
      message: error.toString(),
    });
  }
});

module.exports = router;
