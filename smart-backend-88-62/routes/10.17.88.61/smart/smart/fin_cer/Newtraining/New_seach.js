const express = require("express");
const router = express.Router();
const { pool_smartb } = require("../../../../config"); // สมมติว่าใช้ pool เดียวกันหรือแยกตาม config

/**
 * [GET] เช็คข้อมูลการเทรนหรือข้อมูลพื้นฐานพนักงาน
 * URL: /recer/:code?type=FPC
 */
router.get("/newtraining/:code", async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const type = req.query.type;

    console.log(`🔍 Checking Code: ${code} | Type: ${type}`);

    // 1. ค้นหาในตารางประวัติการเทรน (smart_man_tco_certificate)
    const sqlCheck = `
      SELECT DISTINCT ON (group_ojt) 
        *, 
        DATE_PART('day', NOW() - date_ojt) AS number_of_days
      FROM smart.smart_man_tco_certificate
      WHERE code = $1 
      ${type ? "AND department = $2" : ""}
      ORDER BY group_ojt, date_ojt DESC
    `;

    const checkParams = type ? [code, type] : [code];
    const resultCert = await pool_smartb.query(sqlCheck, checkParams);

    // --- CASE 1: เจอข้อมูลในประวัติการเทรน ---
    if (resultCert.rows.length > 0) {
      const first = resultCert.rows[0];
      return res.json({
        success: true,
        is_trained: true, // Flag บอกฟรอนต์ว่ามีประวัติแล้ว
        code: first.code,
        name: first.name ?? "",
        line: first.line ?? "",
        img: first.images ?? null,
        dept: first.dept ?? "",
        department: first.department ?? "",
        certificates: resultCert.rows.map((row) => ({
          group_ojt: row.group_ojt,
          last_date: row.date_ojt,
          status: row.status,
          product: row.product,
          is_expired: Number(row.number_of_days) >= 180,
          days_passed: Math.floor(row.number_of_days),
        })),
      });
    }

    // --- CASE 2: ไม่เจอประวัติการเทรน ให้ไปค้นที่ Master List (smart_man_name_list_master) ---
    const sqlMaster = `
      SELECT code, name, line, department, dept, head 
      FROM smart.smart_man_name_list_master 
      WHERE code = $1
      LIMIT 1
    `;

    const resultMaster = await pool_smartb.query(sqlMaster, [code]);

    if (resultMaster.rows.length > 0) {
      const master = resultMaster.rows[0];
      return res.json({
        success: true,
        is_trained: false, // Flag บอกฟรอนต์ว่ายังไม่เคยเทรน (เป็นพนักงานใหม่)
        code: master.code,
        name: master.name,
        line: master.line,
        department: master.department,
        dept: master.dept,
        head: master.head,
        certificates: [], // ส่ง Array ว่างกลับไป
      });
    }

    // --- CASE 3: ไม่เจอข้อมูลจากทั้งสองตาราง ---
    return res.status(404).json({
      success: false,
      error: `ไม่พบข้อมูลพนักงานรหัส ${code} ในระบบ`,
    });
  } catch (err) {
    console.error("Database Error:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

module.exports = router;
