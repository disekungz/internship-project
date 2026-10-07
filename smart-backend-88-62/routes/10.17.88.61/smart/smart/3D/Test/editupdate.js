const express = require("express");
const router = express.Router();

const { pool_smart } = require("../../../../config");
const query = (text, params) => pool_smart.query(text, params);

// PUT /update/:id/measurement-request - แก้ไขข้อมูล Header และ Items
router.put("/:id/measurement-request", async (req, res) => {
  // ดึง Client จาก Connection Pool เพื่อทำ Transaction
  const client = await pool_smart.connect();

  try {
    const { id } = req.params; // id ของตารางหลัก (smart_qa_3d_working.id)
    const {
      requestId,
      requestDept,
      jobType,
      productName,
      lotNo,
      phoneNo,
      remark, // 👈 1. รับค่า remark จาก req.body
      items, // Array ของ items [{ requestDetails, qty, unit, measPoint }, ...]
    } = req.body;

    // 🧮 คำนวณ totalPoints (qty * measPoint)
    const calculatedTotalPoint = Array.isArray(items)
      ? items.reduce((sum, item) => {
          const qty = Number(item.qty) || 0;
          const measPoint = Number(item.measPoint) || 0;
          return sum + (qty * measPoint);
        }, 0)
      : 0;

    // 🟢 1. เริ่มต้น Transaction
    await client.query("BEGIN");

    // 📌 2. อัปเดตข้อมูลตารางหลัก (Header) - เพิ่มการอัปเดต remark
    const updateHeaderQuery = `
      UPDATE smart.smart_qa_3d_working
      SET 
        request_id = $1,
        request_dept = $2,
        job_type = $3,
        product_name = $4,
        lot = $5,
        tel = $6,
        total_point = $7,
        remark = $8,
        update_date = NOW()
      WHERE id = $9
      RETURNING job_id;
    `;

    const headerResult = await client.query(updateHeaderQuery, [
      requestId || null,
      requestDept || null,
      jobType || null,
      productName || null,
      lotNo || null,
      phoneNo || null,
      calculatedTotalPoint,
      remark || null, // 👈 2. ส่งค่า remark ไปยัง $8
      id,             // 👈 3. ขยับ id ไปเป็น $9
    ]);

    if (headerResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        status: "ERROR",
        message: "ไม่พบรายการที่ต้องการแก้ไข",
      });
    }

    const jobId = headerResult.rows[0].job_id;

    // 📌 3. ลบรายการ Items เดิมทั้งหมดของ job_id นี้ออกก่อน
    await client.query(
      `DELETE FROM smart.smart_qa_3d_working_items WHERE job_id = $1`,
      [jobId]
    );

    // 📌 4. บันทึก Items ชุดใหม่เข้าไปแทน (Multi-row INSERT)
    if (items && Array.isArray(items) && items.length > 0) {
      const itemValues = [];
      const valueClauses = [];

      items.forEach((item, index) => {
        const offset = index * 5;
        valueClauses.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
        );

        itemValues.push(
          jobId,
          item.requestDetails || null,
          Number(item.qty) || 0,
          item.unit || "pcs",
          Number(item.measPoint) || 0
        );
      });

      const insertItemsQuery = `
        INSERT INTO smart.smart_qa_3d_working_items (
          job_id, 
          request_details, 
          qty, 
          qty_unit, 
          meas_point
        )
        VALUES ${valueClauses.join(", ")};
      `;

      await client.query(insertItemsQuery, itemValues);
    }

    // 🟢 5. ยืนยันการบันทึกข้อมูล (Commit)
    await client.query("COMMIT");

    return res.json({
      status: "OK",
      message: "อัปเดตข้อมูลเรียบร้อยแล้ว",
      data: { id, jobId, totalPoint: calculatedTotalPoint },
    });
  } catch (err) {
    // 🔴 ยกเลิก Transaction กรณีเกิดปัญหา
    await client.query("ROLLBACK");
    console.error("Update Inspection Error:", err);
    return res.status(500).json({
      status: "ERROR",
      message: "เกิดข้อผิดพลาดในการอัปเดตข้อมูล: " + err.message,
    });
  } finally {
    // คืน Connection กลับสู่ Pool
    client.release();
  }
});
 

// DELETE /delete/:id/measurement-request - ลบข้อมูล Header และ Items ที่เกี่ยวข้อง
router.delete("/delete/:id/measurement-request", async (req, res) => {
  const client = await pool_smart.connect();

  try {
    const { id } = req.params; // id ของ smart_qa_3d_working

    // 🟢 1. เริ่มต้น Transaction
    await client.query("BEGIN");

    // 📌 2. ค้นหา job_id จาก id ก่อนเพื่อใช้ลบ items
    const findJobQuery = `
      SELECT job_id 
      FROM smart.smart_qa_3d_working 
      WHERE id = $1
    `;
    const findResult = await client.query(findJobQuery, [id]);

    if (findResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        status: "ERROR",
        message: "ไม่พบรายการที่ต้องการลบ",
      });
    }

    const jobId = findResult.rows[0].job_id;

    // 📌 3. ลบรายการ Items ย่อยทั้งหมดก่อน
    await client.query(
      `DELETE FROM smart.smart_qa_3d_working_items
       WHERE job_id = $1`,
      [jobId]
    );

    // 📌 4. ลบข้อมูลในตารางหลัก (Header)
    await client.query(
      `DELETE FROM smart.smart_qa_3d_working WHERE id = $1`,
      [id]
    );

    // 🟢 5. ยืนยันการลบข้อมูลทั้งหมด (Commit)
    await client.query("COMMIT");

    return res.json({
      status: "OK",
      message: "ลบข้อมูลเรียบร้อยแล้ว",
      data: { id, jobId },
    });

  } catch (err) {
    // 🔴 เกิด Error ให้ยกเลิกคำสั่งลบทั้งหมดทันที
    await client.query("ROLLBACK");
    console.error("Delete Inspection Error:", err);
    return res.status(500).json({
      status: "ERROR",
      message: "เกิดข้อผิดพลาดในการลบข้อมูล: " + err.message,
    });
  } finally {
    // คืน Connection กลับสู่ Pool
    client.release();
  }
});

module.exports = router;