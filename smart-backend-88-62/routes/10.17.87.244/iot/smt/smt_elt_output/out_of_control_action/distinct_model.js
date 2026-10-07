const express = require("express");
const router = express.Router();

const { pool_iot } = require("../../../../config");
const query = (text, params) => pool_iot.query(text, params);

router.get("/", async (req, res) => {
  // 🎯 ดักรับคีย์ line_no เพิ่มเติม (เนื่องจาก Log หน้าบ้านส่งคีย์นี้มาครับ)
  const { startdate, stopdate, machine, line_no } = req.query;

  try {
    let params = [startdate, stopdate];

    // 🎯 1. แก้ไขจาก (ooc IS 0) เป็น (ooc = 0) หรือถ้าในฐานข้อมูลเป็น Boolean ก็แก้เป็น (ooc = false) ครับพี่
    let queryStr = `
        SELECT DISTINCT product
        FROM smt.smt_elt_mc_output_analysis_action
        WHERE ooc = 1
          AND created_at >= $1::date 
          AND created_at <= ($2::date + interval '1 day')
    `;

    // 🎯 2. เลือกใช้ค่าตัวแปรตัวใดตัวหนึ่งที่ส่งมาจากหน้าบ้าน
    const targetLine = line_no || machine;

    // ตรวจสอบเงื่อนไขตัวกรอง Line เครื่องจักร
    if (targetLine && targetLine !== "ALL" && targetLine !== "") {
      params.push(targetLine);
      // แก้ไขชื่อคอลัมน์ให้ตรงกับ Database ของพี่ (สมมติว่าเป็น machine_no หรือ line_no)
      queryStr += ` AND machine = $${params.length}`;
    }

    queryStr += ` ORDER BY product`;

    const result = await query(queryStr, params);

    if (result.rows.length > 0) {
      return res.json({
        status: "OK",
        data: result.rows,
        message: "Data found",
      });
    } else {
      return res.json({
        status: "OK",
        data: [],
        message: "No data found",
      });
    }
  } catch (err) {
    console.error(err.message);
    return res.json({
      status: "ERROR",
      data: [],
      message: err.message,
    });
  }
});

module.exports = router;
