const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.post("/", async (req, res) => {
  try {
    let {
      code_id,
      password,
      created_date,
      role
    } = req.query;
    const queryStr =
      `
insert
	into
	manpower.p1_smart_user_login(
	    user_id,
		password,
		created_date,
		role
		)
  values(
       $1,
       $2,
       $3,
       $4
        )
  ON CONFLICT (user_id)
        DO UPDATE SET
          user_id = EXCLUDED.user_id,
          password = EXCLUDED.password,
          role = EXCLUDED.role
      `
      ;
    let params = [
      code_id, //1
      password, //2
      created_date,//3
      role//4
    ];

    if (password === '' || password.length < 8) {
      return res.status(500).send({
        status: "ERROR",
        message: "ไม่สามารถบันทึกได้ รหัสผ่านต้องมีจำนวน8ตัว",
        data: [],
      });
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
