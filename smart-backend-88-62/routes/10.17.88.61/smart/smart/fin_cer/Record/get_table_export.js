// ==========================================
// 🔄 เส้นเดิมของพี่ (ปล่อยมันไว้เหมือนเดิม ไม่ต้องไปยุ่งกับมัน)
// ==========================================
const express = require("express");
const router = express.Router();

// 🔌 ใช้ pool_smartc ให้ตรงกับตารางที่เราทำระบบ INSERT ไปก่อนหน้านี้ครับ
const { pool_smartb } = require("../../../../config");
const query = (text, params) => pool_smartb.query(text, params);

// ฝั่ง Backend API
router.get("/get_export", async (req, res) => {
  try {
    // 1. ดึงค่าตัวแปรจากหน้าบ้าน
    const { fromDate, toDate, group_ojt, head, line } = req.query;

    // 🔬 ปริ้นต์ดูค่าเพื่อตรวจสอบความชัวร์
    console.log("📥 [Incoming Filters]:", {
      fromDate,
      toDate,
      group_ojt,
      head,
      line,
    });

    let queryStr = `
      SELECT
        id,
        TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') AS date_time_record,
        group_ojt,
        code,
        name,
        head,
        line,
        result
      FROM smart.smart_man_tco_inspection_record
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // 📅 2. ลอจิกวันที่แบบเสถียร (เปรียบเทียบเฉพาะส่วนของวันที่ ไม่สนใจเศษเวลาวินาที)
    if (fromDate && toDate) {
      queryStr += ` AND created_at::date BETWEEN $${paramIndex}::date AND $${paramIndex + 1}::date`;
      params.push(fromDate); // '2026-05-22'
      params.push(toDate); // '2026-05-22'
      paramIndex += 2;
    }

    // 👥 3. เช็คกลุ่ม OJT
    if (group_ojt && group_ojt !== "ALL" && group_ojt !== "undefined") {
      queryStr += ` AND group_ojt = $${paramIndex}`;
      params.push(group_ojt);
      paramIndex++;
    }

    // 👔 4. เช็ค Leader / Head
    if (head && head !== "ALL" && head !== "undefined") {
      queryStr += ` AND head = $${paramIndex}`;
      params.push(head);
      paramIndex++;
    }

    // 🏭 5. เช็ค Production Line
    if (line && line !== "ALL" && line !== "undefined") {
      queryStr += ` AND line = $${paramIndex}`;
      params.push(line);
      paramIndex++;
    }

    queryStr += ` ORDER BY created_at DESC;`;

    // 3. ยิงไปค้นหาที่ Database
    const { rows } = await query(queryStr, params);

    // 🔬 ปริ้นต์บอกผลลัพธ์ที่หลังบ้าน
    console.log(`📊 [Query Result]: เจอข้อมูลทั้งหมด ${rows.length} แถว`);

    // 4. ส่งข้อมูลกลับไปหน้าบ้าน
    res.json({
      status: "OK",
      data: rows,
      message: "ค้นหาข้อมูลสำเร็จ",
    });
  } catch (err) {
    // 🚨 จุดสำคัญ: พ่นบอกใน Terminal เสมอว่าทำไมถึง 500
    console.error("❌ Search API Error:", err.message);
    res.status(500).json({
      status: "ERROR",
      data: [],
      message: err.message,
    });
  }
});
module.exports = router;
