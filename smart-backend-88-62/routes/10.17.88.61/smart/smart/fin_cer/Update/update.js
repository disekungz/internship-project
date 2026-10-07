const express = require("express");
const router = express.Router();
const os = require("os");
// ดึงข้อมูลเชื่อมต่อจากไฟล์ config ที่เราทำไว้คราวก่อน
const { pool_smartb, pool_smartd } = require("../../../../config");

router.post("/", async (req, res, next) => {
  // ส่งไปให้ฟังก์ชันด้านล่างทำงาน
  return exports.syncTcoData(req, res, next);
});

exports.syncTcoData = async (req, res) => {
  try {
    // 1. ไปดึงข้อมูลพนักงานล่าสุดจากตาราง Master  MariaDB (pool_smartd)
    const masterResult = await pool_smartd.query(
      "SELECT code, name, head, line, department AS cost_center, dept FROM tbl_employee",
    );
    const employees = masterResult; // ได้ Array ของพนักงานมาอยู่ในมือ Node.js

    let affectedRows = 0;

    // 2. ลูปส่งข้อมูลพนักงานทีละคนไปอัปเดตที่ (สมมติว่าอยู่ Postgres เครื่องแรก)
    for (const emp of employees) {
      const updateQuery = `
        UPDATE smart.smart_man_tco_certificate 
        SET name = $1, head = $2, line = $3, cost_center = $4, dept = $5
        WHERE code = $6 AND (name != $7 OR head != $8 OR line != $9 OR cost_center != $10 OR dept != $11)
      `;

      const values = [
        emp.name,
        emp.head,
        emp.line,
        emp.cost_center,
        emp.dept, // ค่าที่จะอัปเดต
        emp.code, // เงื่อนไข WHERE code
        emp.name,
        emp.head,
        emp.line,
        emp.cost_center,
        emp.dept, // เงื่อนไขตรวจสอบความต่าง
      ];

      const result = await pool_smartb.query(updateQuery, values);

      // นับจำนวนแถวที่เกิดการแก้ไขจริง
      if (result && result.rowCount > 0) {
        affectedRows += result.rowCount;
      }
    }

    return res.status(200).json({
      success: true,
      message: "ซิงค์ข้อมูลสำเร็จ",
      affectedRows: affectedRows,
    });
  } catch (error) {
    console.error("Sync Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "เกิดข้อผิดพลาดในการซิงค์ข้อมูล" });
  }
};
module.exports = router;