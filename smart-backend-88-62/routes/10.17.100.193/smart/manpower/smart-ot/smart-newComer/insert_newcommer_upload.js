const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");
const query = (text, params) => pool_iot.query(text, params);

router.patch("/", async (req, res) => {
  try {
    const { data_response } = req.body;
    if (!Array.isArray(data_response) || data_response.length === 0) {
      console.error(err.message);
      return res.status(400).json({
        status: "ERROR",
        message: "Invalid or empty data_response array",
      });
    }
    const queryStr = `
with insert_master as (
insert
	into
	manpower.smart_man_mps_database_master
(
	update_date,
	mps_factory,
	mps_emp_id,
	mps_emp_name_thai,
	mps_emp_name_eng,
	mps_join_date,
	mps_terminate_date,
	mps_birth_date,
	mps_position_group,
	mps_cost_center,
	mps_job_grade,
	mps_supervisor,
	mps_emp_status,
	mps_employment_status,
	mps_job_status,
	mps_id,
	mps_gender,
	mps_nationality,
	mps_service_years,
	mps_age,
	mps_tel_no,
	mps_career_transition,
	mps_resign_reason,
	mps_company
  )
values(
 now() AT TIME ZONE 'Asia/Bangkok',
$1,
$2,
$3,
$4,
$5,
$6,
$7,
$8,
$9,
$10,
$11,
$12,
$13,
$14,
$15,
$16,
$17,
$18,
$19,
$20,
$21,
$22,
$23
)
ON CONFLICT (mps_emp_id,mps_factory)
  DO UPDATE SET
    update_date            = EXCLUDED.update_date,
    mps_factory            = EXCLUDED.mps_factory,
    mps_emp_id             = EXCLUDED.mps_emp_id,
    mps_emp_name_eng       = EXCLUDED.mps_emp_name_eng,
    mps_join_date          = EXCLUDED.mps_join_date,
    mps_terminate_date     = EXCLUDED.mps_terminate_date,
    mps_birth_date         = EXCLUDED.mps_birth_date,
    mps_position_group     = EXCLUDED.mps_position_group,
    mps_cost_center        = EXCLUDED.mps_cost_center,
    mps_job_grade          = EXCLUDED.mps_job_grade,
    mps_supervisor         = EXCLUDED.mps_supervisor,
    mps_emp_status         = EXCLUDED.mps_emp_status,
    mps_employment_status  = EXCLUDED.mps_employment_status,
    mps_job_status         = EXCLUDED.mps_job_status,
    mps_gender             = EXCLUDED.mps_gender,
    mps_nationality        = EXCLUDED.mps_nationality,
    mps_service_years      = EXCLUDED.mps_service_years,
    mps_age                = EXCLUDED.mps_age,
    mps_tel_no             = EXCLUDED.mps_tel_no,
    mps_career_transition  = EXCLUDED.mps_career_transition,
    mps_resign_reason      = EXCLUDED.mps_resign_reason,
    mps_company            = EXCLUDED.mps_company
RETURNING  *
)
insert
	into
	manpower.smart_man_mps_database_master_history
  (
	update_date,
	mps_factory,
	mps_emp_id,
	mps_emp_name_thai,
	mps_emp_name_eng,
	mps_join_date,
	mps_terminate_date,
	mps_birth_date,
	mps_position_group,
	mps_cost_center,
	mps_job_grade,
	mps_supervisor,
	mps_emp_status,
	mps_employment_status,
	mps_job_status,
	mps_id,
	mps_gender,
	mps_nationality,
	mps_service_years,
	mps_age,
	mps_tel_no,
	mps_career_transition,
	mps_resign_reason,
	mps_company
  )
select 
	update_date,
	mps_factory,
	mps_emp_id,
	mps_emp_name_thai,
	mps_emp_name_eng,
	mps_join_date,
	mps_terminate_date,
	mps_birth_date,
	mps_position_group,
	mps_cost_center,
	mps_job_grade,
	mps_supervisor,
	mps_emp_status,
	mps_employment_status,
	mps_job_status,
	mps_id,
	mps_gender,
	mps_nationality,
	mps_service_years,
	mps_age,
	mps_tel_no,
	mps_career_transition,
	mps_resign_reason,
	mps_company
from insert_master
ON CONFLICT (mps_emp_id,mps_factory)
  DO UPDATE SET
    update_date            = EXCLUDED.update_date,
    mps_factory            = EXCLUDED.mps_factory,
    mps_emp_id             = EXCLUDED.mps_emp_id,
    mps_emp_name_eng       = EXCLUDED.mps_emp_name_eng,
    mps_join_date          = EXCLUDED.mps_join_date,
    mps_terminate_date     = EXCLUDED.mps_terminate_date,
    mps_birth_date         = EXCLUDED.mps_birth_date,
    mps_position_group     = EXCLUDED.mps_position_group,
    mps_cost_center        = EXCLUDED.mps_cost_center,
    mps_job_grade          = EXCLUDED.mps_job_grade,
    mps_supervisor         = EXCLUDED.mps_supervisor,
    mps_emp_status         = EXCLUDED.mps_emp_status,
    mps_employment_status  = EXCLUDED.mps_employment_status,
    mps_job_status         = EXCLUDED.mps_job_status,
    mps_gender             = EXCLUDED.mps_gender,
    mps_nationality        = EXCLUDED.mps_nationality,
    mps_service_years      = EXCLUDED.mps_service_years,
    mps_age                = EXCLUDED.mps_age,
    mps_tel_no             = EXCLUDED.mps_tel_no,
    mps_career_transition  = EXCLUDED.mps_career_transition,
    mps_resign_reason      = EXCLUDED.mps_resign_reason,
    mps_company            = EXCLUDED.mps_company
RETURNING  * ;

    `;
    let params = [];
    const updatePromises = data_response.map(async (item) => {
      const {
        mps_factory,
        mps_emp_id,
        mps_emp_name_thai,
        mps_emp_name_eng,
        mps_join_date,
        mps_terminate_date,
        mps_birth_date,
        mps_position_group,
        mps_cost_center,
        mps_job_grade,
        mps_supervisor,
        mps_emp_status,
        mps_employment_status,
        mps_job_status,
        mps_id,
        mps_gender,
        mps_nationality,
        mps_service_years,
        mps_age,
        mps_tel_no,
        mps_career_transition,
        mps_resign_reason,
        mps_company
      } = item;
      params = [
        mps_factory,
        mps_emp_id,
        mps_emp_name_thai,
        mps_emp_name_eng,
        mps_join_date,
        mps_terminate_date,
        mps_birth_date,
        mps_position_group,
        mps_cost_center,
        mps_job_grade,
        mps_supervisor,
        mps_emp_status,
        mps_employment_status,
        mps_job_status,
        mps_id,
        mps_gender,
        mps_nationality,
        mps_service_years,
        mps_age,
        mps_tel_no,
        mps_career_transition,
        mps_resign_reason,
        mps_company
      ]

      const result = await query(queryStr, params);

      if (result.rowCount > 0) {
        return {
          employee_id: mps_emp_id,
          name_th: mps_emp_name_thai,
          status: "UPDATE OK",
        };
      } else {
        return {
          employee_id: mps_emp_id,
          name_th: mps_emp_name_thai,
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