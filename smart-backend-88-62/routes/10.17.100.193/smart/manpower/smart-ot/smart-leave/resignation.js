const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");
const query = (text, params) => pool_iot.query(text, params);

router.patch("/", async (req, res) => {
  try {
    const { data_resignation } = req.body;
    if (!Array.isArray(data_resignation) || data_resignation.length === 0) {
      console.error(err.message);
      return res.status(400).json({
        status: "ERROR",
        message: "Invalid or empty data_resignation array",
      });
    }
    // ----------------------------------------------------------------กรณีหากต้องการลบแล้ว Insert
    // const queryStr = `
    //    WITH deleted AS (
    //       DELETE FROM manpower.k1_smart_man_name_list_master
    //       WHERE id = $1
    //         AND employee_id = $2
    //       RETURNING *
    //     )
    //     INSERT INTO manpower.k1_k1_smart_man_name_list_master_history
    //     (create_date, update_date, employee_id, name_th, name_eng, join_date, birth_date, supervisor, gender, cost_center_id, msh_cc, company, factory, position_group, employment_status, job_status, id_number, status, reason)
    //     SELECT
    //         now() AT TIME ZONE 'asia/bangkok',   -- create_date ใหม่
    //         now() AT TIME ZONE 'asia/bangkok',   -- update_date ใหม่
    // 	employee_id,
    // 	name_th,
    // 	name_eng,
    // 	join_date,
    // 	birth_date,
    // 	supervisor,
    // 	gender,
    // 	cost_center_id,
    // 	msh_cc,
    // 	company,
    // 	factory,
    // 	position_group,
    // 	employment_status,
    // 	job_status,
    // 	id_number,
    // 	true,
    // 	$3
    //     FROM deleted;
    // `;

    //  ---------------------------------------------------------------กรณีหากต้องการลบแล้ว update
    // const queryStr = `
    //    WITH deleted AS (
    //       DELETE FROM manpower.k1_smart_man_name_list_master
    //       WHERE id = $1
    //         AND employee_id = $2
    //       RETURNING *
    //     )
    //     UPDATE manpower.k1_k1_smart_man_name_list_master_history h
    //     SET
    //         update_date = now() AT TIME ZONE 'asia/bangkok',
    //         status = false,
    //         reason = $3
    //     FROM deleted d
    //     WHERE h.employee_id = d.employee_id;
    // `;

    //  ---------------------------------------------------------------กรณี update แล้ว Delete
    //k1
    const queryStr = `
    WITH updated AS (
        UPDATE manpower.k1_smart_man_name_list_master_history 
        SET
            update_date = now() AT TIME ZONE 'asia/bangkok',
            status = false,
            reason = $3
        WHERE employee_id = $2
        RETURNING employee_id
    )
    -- deleted AS (
        DELETE FROM  manpower.k1_smart_man_name_list_master
        WHERE id = $1
          AND employee_id IN (SELECT employee_id FROM updated)
        RETURNING *
    -- )
    -- SELECT * FROM updated;
    `;
    const queryStr_Sub = `
   WITH  updated AS (
        UPDATE manpower.k1_smart_man_name_list_master_history 
        SET
            update_date = now() AT TIME ZONE 'asia/bangkok',
            status = false,
            reason = $3
        WHERE employee_id = $2
        RETURNING employee_id
    ),
    deleted AS (
        DELETE FROM  manpower.k1_smart_man_name_list_master
        WHERE id = $1
          AND employee_id IN (SELECT employee_id FROM updated)
        RETURNING employee_id
     ),
    updated_mps AS (
        UPDATE manpower.smart_man_mps_database_master_history  
        SET
            update_date = now() AT TIME ZONE 'asia/bangkok',
            mps_emp_status = 'Resign',
            mps_resign_reason = $4
        WHERE mps_emp_id IN (SELECT employee_id FROM updated)
        RETURNING mps_emp_id
    )
        DELETE FROM  manpower.smart_man_mps_database_master
        WHERE mps_emp_id IN (SELECT mps_emp_id FROM updated_mps)
        RETURNING *
    `;
    //p1
    const queryStrP1 = `
    WITH updated AS (
        UPDATE manpower.p1_smart_man_name_list_master_history 
        SET
            update_date = now() AT TIME ZONE 'asia/bangkok',
            status = false,
            reason = $3
        WHERE employee_id = $2
        RETURNING employee_id
    )
    -- deleted AS (
        DELETE FROM  manpower.p1_smart_man_name_list_master
        WHERE id = $1
          AND employee_id IN (SELECT employee_id FROM updated)
        RETURNING *
    -- )
    -- SELECT * FROM updated;
    `;
    const queryStr_SubP1 = `
   WITH  updated AS (
        UPDATE manpower.p1_smart_man_name_list_master_history 
        SET
            update_date = now() AT TIME ZONE 'asia/bangkok',
            status = false,
            reason = $3
        WHERE employee_id = $2
        RETURNING employee_id
    ),
    deleted AS (
        DELETE FROM  manpower.p1_smart_man_name_list_master
        WHERE id = $1
          AND employee_id IN (SELECT employee_id FROM updated)
        RETURNING employee_id
     ),
    updated_mps AS (
        UPDATE manpower.smart_man_mps_database_master_history  
        SET
            update_date = now() AT TIME ZONE 'asia/bangkok',
            mps_emp_status = 'Resign',
            mps_resign_reason = $4
        WHERE mps_emp_id IN (SELECT employee_id FROM updated)
        RETURNING mps_emp_id
    )
        DELETE FROM  manpower.smart_man_mps_database_master
        WHERE mps_emp_id IN (SELECT mps_emp_id FROM updated_mps)
        RETURNING *
    `;
    let query_filter = '';
    let params = [];
    const updatePromises = data_resignation.map(async (item) => {
      const { id, employee_id, reason, name_th, employment_status, factory } = item;
      
      //check factory and sub
      if (factory == 'K1') {
        if (employment_status == 'Subcontract Daily') {
          query_filter = queryStr_Sub;
          params = [id, employee_id, reason, reason];
        } else {
          query_filter = queryStr;
          params = [id, employee_id, reason];
        }
      } else if (factory == 'P1') {
        if (employment_status == 'Subcontract Daily') {
          query_filter = queryStr_SubP1;
          params = [id, employee_id, reason, reason];
        } else {
          query_filter = queryStrP1;
          params = [id, employee_id, reason];
        }
      }

      const result = await query(query_filter, params);

      if (result.rowCount > 0) {
        return {
          employee_id: employee_id,
          name_th: name_th,
          status: "UPDATE OK",
        };
      } else {
        return {
          employee_id: employee_id,
          name_th: name_th,
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