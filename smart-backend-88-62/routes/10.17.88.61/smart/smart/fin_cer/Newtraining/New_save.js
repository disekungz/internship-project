const express = require("express");
const router = express.Router();
// ดึงมาทั้ง 2 pool ตามที่คุณตั้งค่าไว้ในไฟล์ config
const { pool_smartb } = require("../../../../config");

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
    // --- 🔍 STEP 1: พยายามหาข้อมูลเดิมจากตารางประวัติ (Pool 88.61) ---
    const getOldDataSql = `
      SELECT cost_center, head, images 
      FROM smart.smart_man_tco_certificate 
      WHERE code = $1 
      ORDER BY date_ojt DESC LIMIT 1`;
    const oldDataRes = await pool_smartb.query(getOldDataSql, [code]);

    let finalCostCenter = "";
    let finalHead = "";
    let finalImages = images || "";

    if (oldDataRes.rows.length > 0) {
      // ถ้าเจอในประวัติเก่า ให้ดึงมาใช้
      finalCostCenter = oldDataRes.rows[0].cost_center;
      finalHead = oldDataRes.rows[0].head;
      if (!finalImages) finalImages = oldDataRes.rows[0].images;
     } 
    if (!finalCostCenter || !finalHead) {
      const getMasterSql = `
        SELECT department, head 
        FROM smart.smart_man_name_list_master 
        WHERE code = $1 LIMIT 1`;
      const masterRes = await pool_smartb.query(getMasterSql, [code]);

      if (masterRes.rows.length > 0) {
        // ถ้า finalCostCenter ยังว่าง ให้ใช้ department จากตาราง Master แทน
        if (!finalCostCenter) {
          finalCostCenter = masterRes.rows[0].department || "";
        }
        // ถ้า finalHead ยังว่าง ให้ใช้ head จากตาราง Master
        if (!finalHead) {
          finalHead = masterRes.rows[0].head || "";
        }
      } 
    }

    // เตรียมข้อมูลอื่นๆ
    const finalGrade = grade || "";
    const finalScore = score || "";
    const finalResult = "";
    const finalRemark = "";

    // --- 🔍 STEP 3: เช็คว่ามี Record ชุดนี้อยู่แล้วหรือไม่ (เพื่อตัดสินใจ UPDATE หรือ INSERT) ---
    const findIdSql = `
      SELECT id FROM smart.smart_man_tco_certificate 
      WHERE code = $1 AND group_ojt = $2 AND department = $3 LIMIT 1`;
    const findIdRes = await pool_smartb.query(findIdSql, [
      code,
      group_ojt,
      department,
    ]);

    let result;

    if (findIdRes.rows.length > 0) {
      // --- 🔄 CASE: UPDATE ---
      const existingId = findIdRes.rows[0].id;
      const updateSql = `
        UPDATE smart.smart_man_tco_certificate 
        SET name=$1, dept=$2, cost_center=$3, head=$4, line=$5, date_ojt=$6, 
            product=$7, score=$8, grade=$9, status=$10, images=$11, result=$12, remark=$13
        WHERE id = $14
        RETURNING *;
      `;
      result = await pool_smartb.query(updateSql, [
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
      console.log(`✅ Updated record ID: ${existingId}`);
    } else {
      // --- ✨ CASE: INSERT ---
      try {
        const insertSql = `
          INSERT INTO smart.smart_man_tco_certificate 
            (code, name, dept, cost_center, head, department, line, group_ojt, date_ojt, product, score, grade, status, images, result, remark)
          VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING *;
        `;
        result = await pool_smartb.query(insertSql, [
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
        // จัดการกรณี ID ชนกัน (PK Collision)
        if (insertErr.code === "23505") {
          const maxIdRes = await pool_smartb.query(
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
          result = await pool_smartb.query(insertWithIdSql, [
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
          throw insertErr;
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
