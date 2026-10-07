const express = require("express");
const router = express.Router();

const { pool_iot } = require("../../../../config");
const query = (text, params) => pool_iot.query(text, params);

router.get("/", async (req, res) => {
  // 🎯 1. แกะกล่องดักรับพารามิเตอร์ที่หน้าบ้านส่งมาให้ครบ (เผื่อมีการกรองเฉพาะ Line หรือเฉพาะ product)
  const { startdate, stopdate, line_no, machine, product } = req.query;

  try {
    let params = [startdate, stopdate];

    let queryStr = `
        SELECT DISTINCT machine
        FROM smt.smt_spi_output_analysis_action
        WHERE ooc = 0
          AND created_at >= $1::date 
          AND created_at <= ($2::date + interval '1 day')
    `;

    // 🎯 3. ดักจับเงื่อนไข Line เครื่องจักร (รองรับทั้งคีย์ line_no และ machine_no เผื่อหน้าบ้านยิงสลับกัน)
    const targetLine = line_no || machine;
    if (targetLine && targetLine !== "ALL" && targetLine !== "") {
      params.push(targetLine);
      queryStr += ` AND machine = $${params.length}`; // ปรับชื่อคอลัมน์ซ้ายมือให้ตรงกับ DB จริงของพี่นะครับ (เช่น device_id หรือ machine_no)
    }

    // 🎯 4. ดักจับเงื่อนไข product (ถ้าหน้าบ้านเลือกเฉพาะโมเดล ไม่ใช่ ALL)
    if (product && product !== "ALL" && product !== "") {
      params.push(product);
      queryStr += ` AND product = $${params.length}`; // ปรับชื่อคอลัมน์ซ้ายมือให้ตรงกับ DB จริงของพี่ (เช่น model_name หรือ product)
    }

    // แปะปิดท้ายด้วยการเรียงลำดับข้อมูล
    queryStr += ` ORDER BY machine`;

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
