const express = require("express");
const router = express.Router();

const { pool_iot } = require("../../../../config");
const query = (text, params) => pool_iot.query(text, params);

router.get("/", async (req, res) => {
  // 🎯 1. แกะกล่องดักรับพารามิเตอร์ที่หน้าบ้านส่งมาให้ครบ (เผื่อมีการกรองเฉพาะ Line หรือเฉพาะ Model)
  const { startdate, stopdate, line_no, machine_no, model } = req.query;

  try {
    let params = [startdate, stopdate];

    // 🎯 2. แก้ไขไวยากรณ์จาก (ooc IS 0) เปลี่ยนเป็น ooc = 0 (หรือ ooc = false ถ้าใน DB พี่เป็น Boolean)
    let queryStr = `
        SELECT DISTINCT device_id AS machine_no
        FROM smt.smt_aoi_output_analysis_action
        WHERE ooc = 0
          AND created_at >= $1::date 
          AND created_at <= ($2::date + interval '1 day')
    `;

    // 🎯 3. ดักจับเงื่อนไข Line เครื่องจักร (รองรับทั้งคีย์ line_no และ machine_no เผื่อหน้าบ้านยิงสลับกัน)
    const targetLine = line_no || machine_no;
    if (targetLine && targetLine !== "ALL" && targetLine !== "") {
      params.push(targetLine);
      queryStr += ` AND device_id = $${params.length}`; // ปรับชื่อคอลัมน์ซ้ายมือให้ตรงกับ DB จริงของพี่นะครับ (เช่น device_id หรือ machine_no)
    }

    // 🎯 4. ดักจับเงื่อนไข Model (ถ้าหน้าบ้านเลือกเฉพาะโมเดล ไม่ใช่ ALL)
    if (model && model !== "ALL" && model !== "") {
      params.push(model);
      queryStr += ` AND model_name = $${params.length}`; // ปรับชื่อคอลัมน์ซ้ายมือให้ตรงกับ DB จริงของพี่ (เช่น model_name หรือ model)
    }

    // แปะปิดท้ายด้วยการเรียงลำดับข้อมูล
    queryStr += ` ORDER BY machine_no`;

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
