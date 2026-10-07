const express = require("express");
const router = express.Router();

const { pool_iot } = require("../../../../config");
const query = (text, params) => pool_iot.query(text, params);

router.get("/", async (req, res) => {
  const { startdate, stopdate } = req.query;

  // 1. แก้ไข Logic การตรวจสอบให้ถูกต้อง (ใช้ || แทนการปนกันของเครื่องหมาย)
  if (!startdate || !stopdate || stopdate === "ALL") {
    return res.json({
      status: "ERROR",
      data: [],
      message: "startdate และ stopdate ต้องมีค่าและไม่เป็น ALL",
    });
  }

  try {
    // ใช้ params เพื่อส่งข้อมูลเข้า SQL อย่างปลอดภัย
    let params = [startdate, stopdate];

    // 2. ใช้ SQL ที่เปรียบเทียบกับ Timestamp โดยตรง
    // บวก 1 วันแล้วลบ 1 วินาที เพื่อครอบคลุมเวลาจนถึงนาทีสุดท้ายของ stopdate
    let queryStr = `
        SELECT DISTINCT product AS model
        FROM smt.smt_spi_output_analysis
        WHERE created_at >= $1::TIMESTAMP 
          AND created_at <= ($2::TIMESTAMP + interval '1 day' - interval '1 second')
        ORDER BY model
    `;

    // Debug เพื่อดูว่า API รับค่ามาอย่างไร
    console.log("Querying with params:", params);

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
    console.error("Database Error:", err.message);
    return res.json({
      status: "ERROR",
      data: [],
      message: err.message,
    });
  }
});

module.exports = router;
