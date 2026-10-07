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
      priority,
      remark,
      dueTime,          // 👈 รับค่าแบบ camelCase จาก Frontend
      due_time,         // 👈 เผื่อรับแบบ snake_case
      target_due_date,  // 👈 เผื่อรับแบบ snake_case
      items,
    } = req.body;

    // 🕒 จัดการแปลง Format Date/Time ก่อนบันทึกลง Database
    const rawTime = dueTime || due_time || target_due_date || null;
    let formattedDueTime = null;
    let formattedTargetDueDate = null;

    if (rawTime) {
      if (typeof rawTime === "string" && rawTime.includes("T")) {
        // ตัวอย่าง rawTime = "2026-09-04T14:30"
        const [datePart, timePart] = rawTime.split("T");

        // 1. target_due_date (TIMESTAMP): แปลงเป็น Format "YYYY-MM-DD HH:mm:ss" ให้ Postgres อ่าน timestamp ได้สมบูรณ์
        formattedTargetDueDate = `${datePart} ${timePart}:00`; 

        // 2. due_time (TIME): ส่งเฉพาะส่วนเวลา เช่น "14:30"
        formattedDueTime = timePart; 
      } else {
        formattedDueTime = rawTime;
        formattedTargetDueDate = rawTime;
      }
    }

    // 🧮 คำนวณ totalPoints (qty * measPoint)
    const calculatedTotalPoint = Array.isArray(items)
      ? items.reduce((sum, item) => {
          const qty = Number(item.qty) || 0;
          const measPoint = Number(item.measPoint) || 0;
          return sum + qty * measPoint;
        }, 0)
      : 0;

    // 🟢 1. เริ่มต้น Transaction
    await client.query("BEGIN");

    // 📌 2. อัปเดตข้อมูลตารางหลัก (Header)
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
        priority = $8,
        remark = $9,
        due_time = $10,
        target_due_date = $11,
        update_date = NOW()
      WHERE id = $12
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
      priority || null,
      remark || null,
      formattedDueTime,       // 👈 $10: ส่งเฉพาะเวลา (เช่น "14:30") เข้าคอลัมน์ TIME
      formattedTargetDueDate, // 👈 $11: ส่ง วันที่+เวลา (เช่น "2026-09-04 14:30:00") เข้าคอลัมน์ TIMESTAMP
      id,                     // 👈 $12
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





// PATCH /:id/mc-no - แก้ไขเฉพาะ MC No.
router.patch("/:id/mc-no", async (req, res) => {
  try {
    const { id } = req.params; // id ของตารางหลัก (smart_qa_3d_working.id)
    const { mcNo } = req.body;  // รับค่า mcNo ใหม่จาก req.body

    // ตรวจสอบความถูกต้องของ Input เบื้องต้น
    if (mcNo === undefined) {
      return res.status(400).json({
        status: "ERROR",
        message: "กรุณาระบุค่า mcNo ที่ต้องการแก้ไข",
      });
    }

    const updateMcQuery = `
      UPDATE smart.smart_qa_3d_working
      SET 
        mc_no = $1,
        update_date = NOW()
      WHERE id = $2
      RETURNING id, job_id, mc_no, update_date;
    `;

    const result = await query(updateMcQuery, [mcNo || null, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: "ERROR",
        message: "ไม่พบรายการที่ต้องการแก้ไข",
      });
    }

    return res.json({
      status: "OK",
      message: "อัปเดต MC No. เรียบร้อยแล้ว",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("Update MC No. Error:", err);
    return res.status(500).json({
      status: "ERROR",
      message: "เกิดข้อผิดพลาดในการอัปเดต MC No.: " + err.message,
    });
  }
});

module.exports = router;