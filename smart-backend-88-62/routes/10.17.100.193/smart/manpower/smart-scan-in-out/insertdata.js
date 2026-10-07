const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.post("/", async (req, res) => {
  try {
    let { code_id,
      name_eng,
      cost_center,
      time_in,
      status,
      factory, } = req.query;
    const queryStr =
      `
      insert
      into
      manpower.smart_man_mps_scan_inout_dlh(
      dlh_employee_id,
      dlh_employee_eng,
      dlh_cc,
      dlh_effective_date_time,
      dlh_clocking_date_time,
      dlh_clocking_date_status,
      factory
      )
      values (
      $1,
      $2,
      $3,
      CASE
        WHEN $4 = 'OUT' THEN
          CASE
            WHEN EXTRACT(HOUR FROM CAST($5 AS TIMESTAMP)) < 13 
                AND EXTRACT(HOUR FROM CAST($6 AS TIMESTAMP)) >= 1
              THEN (CAST($7 AS DATE) - INTERVAL '1 day')  -- Night Shift (Scan Out)
            ELSE CAST($8 AS DATE)                         -- Day Shift (Scan Out)
          END
        WHEN $9 = 'IN' THEN
            CASE
            WHEN EXTRACT(HOUR FROM CAST($10 AS TIMESTAMP)) >= 13 
                  OR EXTRACT(HOUR FROM CAST($11 AS TIMESTAMP)) < 1
              THEN (CAST($12 AS DATE) - INTERVAL '1 day')   -- Night Shift (Scan In)
            ELSE CAST($13 AS DATE)                          -- Day Shift (Scan In)
          END
        ELSE NULL  -- กรณีไม่ใช่ in/out
      end,
        $14,
        $15,
        $16
      ) -- scan in
      `
      ;
    let params = [
      code_id, //1
      name_eng, //2
      cost_center, //3
      status, //4
      time_in, //5
      time_in, //6
      time_in, //7
      time_in, //8
      status, //9
      time_in, //10
      time_in, //11
      time_in, //12
      time_in, //13
      time_in, //14
      status, //15
      factory, //16

    ];
    let result = await query(queryStr, params);

    if (result.rows.length >= 0) {
      return res.status(200).send({
        status: "OK",
        message: "บันทึกสำเร็จ",
        data: result.rows,
      });

    } else {
      return res.status(200).send({
        status: "ERROR",
        message: "ไม่พบรหัสพนักงาน",
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
