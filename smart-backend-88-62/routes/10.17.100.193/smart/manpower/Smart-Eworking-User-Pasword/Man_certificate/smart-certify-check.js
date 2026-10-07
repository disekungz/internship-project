const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);

router.get("/get-info", async (req, res) => {
  try {
    const { octn_emp_id } = req.query;

    let queryStr = `
      SELECT
        t1.id,
        t1.status,
        TO_CHAR(t1.octn_cer_expire, 'YYYY-MM-DD') AS expired,
        t1.octn_emp_id,
        t2.name_eng AS employee_name,
        t1.octr_table_no AS ojt_table,
        t1.otbm_table_name AS ojt_name
      FROM manpower.smart_man_tc_certificate t1
      INNER JOIN manpower.p1_smart_man_name_list_master t2
        ON t1.octn_emp_id = t2.employee_id
      WHERE 1=1
    `;
    // let queryStrp1= `
    //   SELECT
    //     t1.id,
    //     t1.status,
    //     TO_CHAR(t1.octn_cer_expire, 'YYYY-MM-DD') AS expired,
    //     t1.octn_emp_id,
    //     t2.name_eng AS employee_name,
    //     t1.octr_table_no AS ojt_table,
    //     t1.otbm_table_name AS ojt_name
    //   FROM manpower.smart_man_tc_certificate t1
    //   INNER JOIN manpower.p1_smart_man_name_list_master t2
    //     ON t1.octn_emp_id = t2.employee_id
    //   WHERE 1=1
    // `;

    const conditions = [];
    const queryParams = [];

    if (octn_emp_id && octn_emp_id !== "ALL") {
      conditions.push(`t1.octn_emp_id = $${queryParams.length + 1}`);
      queryParams.push(octn_emp_id);
    }

    if (conditions.length > 0) {
      queryStr += ` AND ${conditions.join(" AND ")}`;
    }

    queryStr += ` ORDER BY t1.octn_cer_expire ASC`;

    const result = await query(queryStr, queryParams);

    if (result.rows.length === 0) {
      return res.status(200).send({
        status: "ERROR",
        message: "not found data",
        data: [],
      });
    }

    return res.status(200).send({
      status: "OK",
      message: "successfully!",
      data: result.rows,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send({
      status: "ERROR",
      message: error.toString(),
      data: [],
    });
  }
});

module.exports = router;
