const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../config");
const { broadcast } = require("../../../../../websocket");

const query = (text, params) => pool_iot.query(text, params);
router.post("/", async (req, res) => {
  try {
    let {
      code_id,
      time_request,
      select_ot_string,
      hr_ot,
      department,
      cost_center,
      remark,
    } = req.query;
    const queryStr =
      `
        insert
        into
        manpower.p1_smart_man_working_input_dsn(
        id_no,
        dsn_select_date,
        dsn_con_wk,
        dsn_con_hr,
        dsn_date_time,
        dsn_department,
        dsn_process_cc,
        remark,
        status_ot
        )
        values (
        $1, --id_no
        TO_CHAR(
            CASE
              WHEN EXTRACT(HOUR FROM CAST($2 AS TIMESTAMP)) < 7 
                THEN (CAST($3 AS DATE) - INTERVAL '1 day')
              ELSE CAST($4 AS DATE)
            END,
          'YYYY-MM-DD'),
        $5, --dsn_con_wk
        $6, --dsn_con_hr,
        $7, --time_scan,
        $8, --dep
        $9, --dsn_process_cc
        $10,
        $11 
        ) 
        ON CONFLICT (id_no, dsn_select_date)
        DO UPDATE SET
        dsn_con_wk = EXCLUDED.dsn_con_wk,
        dsn_con_hr = EXCLUDED.dsn_con_hr,
        dsn_date_time = EXCLUDED.dsn_date_time,
        dsn_department = EXCLUDED.dsn_department,
        dsn_process_cc = EXCLUDED.dsn_process_cc,
        remark = EXCLUDED.remark,
        status_ot = EXCLUDED.status_ot
        RETURNING *
      `
      ;
    let params = [
      code_id, //1
      time_request, //2
      time_request, //3
      time_request, //4
      select_ot_string, //5
      hr_ot, //6
      time_request, //7
      department, //8
      cost_center, //9
      remark, //10
      "Wait"
    ];

    if (select_ot_string === '' || select_ot_string === null || select_ot_string === undefined) {
      return res.status(500).send({
        status: "ERROR",
        message: "ไม่สามารถบันทึกได้ กรุณาเลือกชั่วโมง OT",
        data: [],
      });
    } else if (code_id === '' || code_id === null || code_id === undefined) {
      return res.status(500).send({
        status: "ERROR",
        message: "ไม่สามารถบันทึกได้ กรุณาแสกน Code ID",
        data: [],
      });
    }

    let result = await query(queryStr, params);
    if (result.rows.length >= 0) {
      broadcast({
        type: "REQUEST_OT",
        payload:result,
      });
      return res.status(200).send({
        status: "OK",
        message: "บันทึกสำเร็จ",
        data: result.rows,
      });
    } else {
      return res.status(200).send({
        status: "ERROR",
        message: "ไม่พบรหัสพนักงาน ไม่สามารถบันทึกได้",
        data: result.rows,
      });

    }
  } catch (error) {
    console.log(error.message);
    res.status(500).send({
      status: "ERROR",
      message: "มีบางอย่างผิดพลาด ไม่สามารถบันทึกได้",
    });
  }
});

module.exports = router;
