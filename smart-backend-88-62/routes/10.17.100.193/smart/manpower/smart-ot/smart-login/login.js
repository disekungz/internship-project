const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { code_id,password } = req.query;
    const queryStr =
      `
    select
      l.user_id,
      l.password,
      l.role,
      sm.map_sv_name
    from
      manpower.p1_smart_user_login l
    inner join manpower.p1_smart_man_approve_sv_map sm
    on l.user_id = sm.map_id_sv
    where l.user_id= $1 and l.password = $2;
      `
      ;
    let result = await query(queryStr, [code_id,password]);

    if (result.rows.length === 0) {
      return res.status(200).send({
        status: "ERROR",
        message: "ไม่พบบัญชีผู้ใช้ โปรดลงทะเบียน",
        data: result.rows,
      });
    } else {
      return res.status(200).send({
        status: "OK",
        message: "เข้าสู่ระบบสำเร็จ",
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
