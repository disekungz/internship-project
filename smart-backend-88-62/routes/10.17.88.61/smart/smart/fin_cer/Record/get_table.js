const express = require("express");
const router = express.Router();

// 🔌 ใช้ pool_smartc ให้ตรงกับตารางที่เราทำระบบ INSERT ไปก่อนหน้านี้ครับ
const { pool_smartb } = require("../../../../config");
const query = (text, params) => pool_smartb.query(text, params);

// 🔄 เปลี่ยนเป็นดึงข้อมูลล่าสุดตลอดเวลา ไม่ต้องรอส่ง parameter ใดๆ มาทั้งสิ้น
router.get("/get", async (req, res) => {
  try {
    // ดึงคอลัมน์ให้ตรงตามโครงสร้างตารางปัจจุบันที่คุณพี่ใช้บันทึก TCO
    const queryStr = `
      SELECT
        id,
       TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') AS date_time_record,
        group_ojt,
        code,
        name,
        head,
        line,
        result
      FROM 
        smart.smart_man_tco_inspection_record
      ORDER BY
        created_at DESC -- เอาข้อมูลที่เพิ่งสแกนล่าสุดขึ้นก่อนเสมอ
      LIMIT 500; -- ดึงมาโชว์ 100 รายการล่าสุดพอ เพื่อความรวดเร็วและไม่หนัก Database
    `;

    // สั่งรันดึงข้อมูล (รอบนี้ไม่มี params เพราะดึงสดๆ ตลอดเวลา)
    const { rows } = await query(queryStr);

    // ส่งข้อมูลกลับไปเทใส่ตารางหน้าบ้าน
    res.json({
      status: "OK",
      data: rows,
      message: "Data fetched successfully (Real-time monitoring).",
    });
  } catch (err) {
    console.error("Database error:", err.message);
    return res.status(500).json({
      status: "ERROR",
      data: [],
      message: err.message,
    });
  }
});
router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query(
      "DELETE FROM smart.smart_man_tco_inspection_record WHERE id = $1",
      [id],
    );
    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: "ERROR", message: "ไม่พบรายการที่ต้องการลบ" });
    }
    res.json({ status: "OK", message: "ลบข้อมูลสำเร็จ" });
  } catch (err) {
    res.status(500).json({ status: "ERROR", message: err.message });
  }
});

module.exports = router;
