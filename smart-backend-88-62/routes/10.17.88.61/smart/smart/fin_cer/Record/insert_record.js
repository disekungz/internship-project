const express = require("express");
const router = express.Router();

// 🔌 ดึงจาก pool_smartb เท่านั้น
const { pool_smartb } = require("../../../../config");

// ฟังก์ชัน Helper วิ่งเข้า pool_smartb จุดเดียว
const query = (text, params) => pool_smartb.query(text, params);

router.post("/insert", async (req, res) => {
  const { group_ojt, code } = req.body;

  if (!group_ojt || !code) {
    return res.status(400).json({
      status: "ERROR",
      message: "Missing required fields: group_ojt or code",
    });
  }

  try {
    let checkUserQuery = "";
    let checkParams = [];

    // 1. ตรวจสอบเงื่อนไข Automotive
    if (group_ojt === "AutomotiveFPC" || group_ojt === "AutomotiveSMT") {
      const targetDept = group_ojt === "AutomotiveFPC" ? "FPC" : "SMT";
      checkUserQuery = `
        SELECT name, head, line, date_ojt 
        FROM smart.smart_man_tco_certificate 
        WHERE code = $1 
          AND group_ojt = 'Automotive' 
          AND department = $2
        ORDER BY date_ojt DESC 
        LIMIT 1;
      `;
      checkParams = [code, targetDept];
    } else {
      checkUserQuery = `
        SELECT name, head, line, date_ojt 
        FROM smart.smart_man_tco_certificate 
        WHERE code = $1 
          AND group_ojt = $2
        ORDER BY date_ojt DESC 
        LIMIT 1;
      `;
      checkParams = [code, group_ojt];
    }

    // ยิง Query เช็คสิทธิ์ใน smart_man_tco_certificate (pool_smartb)
    const userResult = await query(checkUserQuery, checkParams);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        status: "ERROR",
        message: `ไม่พบข้อมูลพนักงานรหัส ${code} ในระบบ TCO Certificate (กลุ่ม ${group_ojt})`,
      });
    }

    const { name, head, line, date_ojt } = userResult.rows[0];

    // 2. คำนวณ Pass/Fail
    const dateOjtObj = new Date(date_ojt);
    const now = new Date();

    // คำนวณวันหมดอายุ (สมมติว่าใบเซอร์มีอายุ 6 เดือนเป๊ะ)
    const expiryDate = new Date(dateOjtObj);
    expiryDate.setMonth(expiryDate.getMonth() + 6);

    // คำนวณเวลาที่เหลือเป็นจำนวนวัน
    const timeDiff = expiryDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));

    let finalResult = "";

    if (daysRemaining < 0) {
      // หมดอายุแล้ว
      finalResult = "EXPIRED";
    } else if (daysRemaining <= 7) {
      // ภายใน 7 วัน หรือน้อยกว่านั้น
      finalResult = `Exp: ${daysRemaining} days`;
    } else {
      // ยังใช้งานได้ปกติ
      finalResult = "PASS";
    }

    // 3. INSERT ลงตาราง smart.smart_man_tco_inspection_record (pool_smartb)
    const insertQueryStr = `
      INSERT INTO smart.smart_man_tco_inspection_record (
        group_ojt,
        code,
        name,
        head,
        line,
        result,
        created_at
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, timezone('Asia/Bangkok', now()))
      RETURNING *;
    `;

    const insertParams = [group_ojt, code, name, head, line, finalResult];
    const result = await query(insertQueryStr, insertParams);

    res.json({
      status: "OK",
      data: result.rows[0],
      message: "บันทึกข้อมูลสำเร็จเรียบร้อยแล้วครับ",
    });
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({
      status: "ERROR",
      message: err.message,
    });
  }
});

module.exports = router;
