const express = require("express");
const router = express.Router();
const { pool_smart } = require("../../../../config");

router.post("/save", async (req, res) => {
  const {
    code,
    name,
    dept,
    department,
    line,
    group_ojt,
    date_ojt,
    product,
    score,
    grade,
    status,
    images,
  } = req.body;

  try {
    // 🔍 1. ดึงข้อมูลเดิมมาเตรียมไว้
    const getOldDataSql = `SELECT cost_center, head, images FROM smart.smart_man_tco_certificate 
                           WHERE code = $1 ORDER BY date_ojt DESC LIMIT 1`;
    const oldDataRes = await pool_smart.query(getOldDataSql, [code]);
    const hasOldData = oldDataRes?.rows?.length > 0;

    const finalCostCenter = hasOldData ? oldDataRes.rows[0].cost_center : "";
    const finalHead = hasOldData ? oldDataRes.rows[0].head : "";
    const finalImages = images || (hasOldData ? oldDataRes.rows[0].images : "");
    const finalGrade = grade ? grade : "";
    const finalScore = score ? score : "";
    const finalResult = "Pass";
    const finalRemark = "";

    // 🔍 2. เช็คว่ามี Record นี้อยู่แล้วหรือไม่
    const findIdSql = `SELECT id FROM smart.smart_man_tco_certificate 
                       WHERE code = $1 AND group_ojt = $2 AND department = $3 LIMIT 1`;
    const findIdRes = await pool_smart.query(findIdSql, [
      code,
      group_ojt,
      department,
    ]);

    let result;

    if (findIdRes.rows.length > 0) {
      // 🔄 3. กรณี UPDATE (มี ID อยู่แล้ว ไม่ติดปัญหา Sequence)
      const existingId = findIdRes.rows[0].id;
      const updateSql = `
        UPDATE smart.smart_man_tco_certificate 
        SET name=$1, dept=$2, cost_center=$3, head=$4, line=$5, date_ojt=$6, 
            product=$7, score=$8, grade=$9, status=$10, images=$11, result=$12, remark=$13
        WHERE id = $14
        RETURNING *;
      `;
      result = await pool_smart.query(updateSql, [
        name,
        dept,
        finalCostCenter,
        finalHead,
        line,
        date_ojt,
        product,
        finalScore,
        finalGrade,
        status,
        finalImages,
        finalResult,
        finalRemark,
        existingId,
      ]);
      console.log(`✅ Updated existing ID: ${existingId}`);
    } else {
      // ✨ 4. กรณี INSERT (เพิ่มใหม่)
      try {
        // ลอง Insert แบบปกติก่อน
        const insertSql = `
          INSERT INTO smart.smart_man_tco_certificate 
            (code, name, dept, cost_center, head, department, line, group_ojt, date_ojt, product, score, grade, status, images, result, remark)
          VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING *;
        `;
        result = await pool_smart.query(insertSql, [
          code,
          name,
          dept,
          finalCostCenter,
          finalHead,
          department,
          line,
          group_ojt,
          date_ojt,
          product,
          finalScore,
          finalGrade,
          status,
          finalImages,
          finalResult,
          finalRemark,
        ]);
      } catch (insertErr) {
        // 🚨 ถ้าพังเพราะ ID ซ้ำ (Error Code 23505)
        if (insertErr.code === "23505") {
          console.log("⚠️ ID collision detected. Fetching MAX(id) + 1...");

          const maxIdRes = await pool_smart.query(
            `SELECT MAX(id) FROM smart.smart_man_tco_certificate`,
          );
          const nextId = (parseInt(maxIdRes.rows[0].max) || 0) + 1;

          const insertWithIdSql = `
            INSERT INTO smart.smart_man_tco_certificate 
              (id, code, name, dept, cost_center, head, department, line, group_ojt, date_ojt, product, score, grade, status, images, result, remark)
            VALUES 
              ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING *;
          `;
          result = await pool_smart.query(insertWithIdSql, [
            nextId,
            code,
            name,
            dept,
            finalCostCenter,
            finalHead,
            department,
            line,
            group_ojt,
            date_ojt,
            product,
            finalScore,
            finalGrade,
            status,
            finalImages,
            finalResult,
            finalRemark,
          ]);
        } else {
          throw insertErr; // ถ้าพังเพราะเรื่องอื่น
        }
      }
      console.log(`✅ Inserted new record successfully`);
    }

    res.json({
      status: "OK",
      data: result.rows[0],
      message:
        findIdRes.rows.length > 0
          ? "อัปเดตข้อมูลสำเร็จ"
          : "เพิ่มข้อมูลใหม่สำเร็จ",
    });
  } catch (err) {
    console.error("Save Error:", err.message);
    res.status(500).json({ status: "ERROR", message: err.message });
  }
});

module.exports = router;
