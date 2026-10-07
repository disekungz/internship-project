const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.post("/", async (req, res) => {
  try {
    let {
      factory,
      code_id,
      name,
      join_date,
      contact_time,
      end_contact_time,
      main_factory
    } = req.query;
    let queryStr;
    const queryStrK1 =
      `
      insert
        into
        manpower.k1_smart_man_name_list_contract
      (
        factory,
        msh_id_code,
        name_eng,
        join_date,
        contact_time,
        end_contact_time
        )
      values(
      $1,
      $2,
      $3,
      $4,
      $5,
      $6
      );
      `
      ;
    const queryStrP1 =
      `
      insert
        into
        manpower.p1_smart_man_name_list_contract
      (
        factory,
        msh_id_code,
        name_eng,
        join_date,
        contact_time,
        end_contact_time
        )
      values(
      $1,
      $2,
      $3,
      $4,
      $5,
      $6
      );
      `
      ;
    let params = [
      factory,
      code_id,
      name,
      join_date,
      contact_time,
      end_contact_time
    ];
    if (main_factory === 'K1') {
      queryStr = queryStrK1;
    } else if (main_factory === 'P1') {
      queryStr = queryStrP1;
    }
    let result = await query(queryStr, params);
    return res.status(200).send({
      status: "OK",
      message: "บันทึกสำเร็จ",
      data: result.rows,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).send({
      status: "ERROR",
      message: "มีบางอย่างผิดพลาด ไม่สามารถบันทึกได้",
    });
  }
});

module.exports = router;
