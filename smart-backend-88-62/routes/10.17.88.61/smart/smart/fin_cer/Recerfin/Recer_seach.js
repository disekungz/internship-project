const express = require("express");
const router = express.Router();
const { pool_smart } = require("../../../../config");

/**
 * [GET] ค้นหาประวัติเพื่อเตรียมต่ออายุ โดยแยกตามกลุ่ม (Department)
 * URL Example: /recer/S01234?type=FPC
 */
router.get("/recer/:code", async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const type = req.query.type; // รับค่าจาก ?type=FPC หรือ ?type=SMT

    console.log(`🔍 ค้นหารหัส: ${code} | กลุ่ม: ${type}`);

    // เตรียม SQL และ Parameters
    let sql = `
      SELECT DISTINCT ON (group_ojt) 
        *, 
        DATE_PART('day', NOW() - date_ojt) AS number_of_days
      FROM smart.smart_man_tco_certificate
      WHERE code = $1 
       AND department = $2
    `;

    const params = [code];

    // ✅ เพิ่มเงื่อนไขถ้ามีการส่ง type (Department) มา
    if (type) {
      sql += ` AND department = $2`; // หรือเปลี่ยนเป็น column 'dept' ตามโครงสร้างตารางจริง
      params.push(type);
    }

    // ต้องใส่ ORDER BY ให้สอดคล้องกับ DISTINCT ON
    sql += ` ORDER BY group_ojt, date_ojt DESC`;

    const result = await pool_smart.query(sql, params);
    console.log("📊 จำนวนแถวที่เจอ:", result.rows.length);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `พนักงานรหัส ${code} ไม่มีข้อมูลการต่ออายุในกลุ่ม ${type}`,
      });
    }

    const first = result.rows[0];

    res.json({
      success: true,
      code: first.code,
      name: first.name ?? "",
      line: first.line ?? "",
      img: first.images ?? null,
      dept: first.dept ?? "",
      department: first.department ?? "",
      certificates: result.rows.map((row) => ({
        group_ojt: row.group_ojt,
        last_date: row.date_ojt,
        status: row.status,
        product: row.product,
        is_expired: Number(row.number_of_days) >= 180,
        number_of_days: row.number_of_days,
      })),
    });
  } catch (err) {
    console.error("Fetch Error:", err);
    res.status(500).json({ success: false, error: "Server Error" });
  }
});

module.exports = router;
