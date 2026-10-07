const express = require("express");
const router = express.Router();

const { pool_smart } = require("../../../../config");

// 1. ตรวจสอบสิทธิ์ PIC ID
const ALLOWED_PICS = ['5080318', '5080715', '5082203', '5086619', '5081092', '5080303', '5081302', '5P03612', '5P11370', '7051824', 'ADMIN'];
const verifyPic = (picId, res) => {
  if (!ALLOWED_PICS.includes(picId)) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์บันทึกข้อมูล (PIC ID ไม่อยู่ในระบบ)' });
    return false;
  }
  return true;
};

// PATCH /inspections/:id/update-time
router.patch('/:id/update-time', async (req, res) => {
  const client = await pool_smart.connect(); // ดึง Client Connection
  
  try {
    const { id } = req.params;
    const { fieldName, timestamp, picId, mcNo, outputQty, remark } = req.body;

    // ตรวจสอบ PIC
    if (!verifyPic(picId, res)) {
      client.release(); // คืน connection
      return; 
    }

    // 2. ดึงข้อมูล Task ปัจจุบันก่อน
    const checkResult = await client.query(
      `SELECT * FROM smart.smart_qa_3d_working WHERE id = $1`,
      [id]
    );

    if (checkResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ message: 'ไม่พบข้อมูล Task นี้ในระบบ' });
    }

    const currentTask = checkResult.rows[0];
    const jobId = currentTask.job_id;

    await client.query('BEGIN'); // เริ่ม Transaction

    switch (fieldName) {
      case 'receive_date': {
        const sql = `UPDATE smart.smart_qa_3d_working SET receive_date = $1, receive_by = $2 WHERE id = $3`;
        await client.query(sql, [timestamp, picId, id]);
        break;
      }

      case 'pic_start_time': {
        const sqlMain = `UPDATE smart.smart_qa_3d_working SET pic_start_time = $1, pic_id_start = $2, mc_no = $3 WHERE id = $4`;
        await client.query(sqlMain, [timestamp, picId, mcNo || null, id]);

        const sqlLog = `INSERT INTO smart.smart_qa_3d_working_logs (job_id, session_no, start_time, pic_id) VALUES ($1, 1, $2, $3)`;
        await client.query(sqlLog, [jobId, timestamp, picId]);
        break;
      }

      case 'pic_pause_time': {
        // หา log session ล่าสุดที่ยังไม่มี stop_time
        const activeLogRes = await client.query(
          `SELECT id FROM smart.smart_qa_3d_working_logs WHERE job_id = $1 AND stop_time IS NULL ORDER BY session_no DESC LIMIT 1`,
          [jobId]
        );

        if (activeLogRes.rows.length > 0) {
          const updateLogSql = `UPDATE smart.smart_qa_3d_working_logs SET stop_time = $1, output_qty = COALESCE($2, 0), remark = $3 WHERE id = $4`;
          await client.query(updateLogSql, [timestamp, outputQty || 0, remark || null, activeLogRes.rows[0].id]);
        }
        break; 
      }

      case 'pic_resume_time': {
        // หา session_no ล่าสุด
        const lastSessionRes = await client.query(
          `SELECT MAX(session_no) as max_session FROM smart.smart_qa_3d_working_logs WHERE job_id = $1`,
          [jobId]
        );
        const nextSessionNo = (lastSessionRes.rows[0].max_session || 0) + 1;

        const insertLogSql = `INSERT INTO smart.smart_qa_3d_working_logs (job_id, session_no, start_time, pic_id) VALUES ($1, $2, $3, $4)`;
        await client.query(insertLogSql, [jobId, nextSessionNo, timestamp, picId]);
        break;
      }

      case 'pic_stop_time': {
        const lastLogRes = await client.query(
          `SELECT id FROM smart.smart_qa_3d_working_logs WHERE job_id = $1 ORDER BY session_no DESC LIMIT 1`,
          [jobId]
        );

        if (lastLogRes.rows.length > 0) {
          const updateLogSql = `UPDATE smart.smart_qa_3d_working_logs SET stop_time = $1, output_qty = COALESCE($2, output_qty) WHERE id = $3`;
          await client.query(updateLogSql, [timestamp, outputQty || 0, lastLogRes.rows[0].id]);
        }

        // คำนวณ Cycle Time รวมจาก Log ทุก Session
        const cycleTimeRes = await client.query(
          `SELECT SUM(EXTRACT(EPOCH FROM (COALESCE(stop_time, CURRENT_TIMESTAMP) - start_time))/60) as total_min
           FROM smart.smart_qa_3d_working_logs WHERE job_id = $1`,
          [jobId]
        );
        const totalCycleTimeMin = Math.round(cycleTimeRes.rows[0].total_min || 0);

        const sqlMain = `UPDATE smart.smart_qa_3d_working SET pic_stop_time = $1, pic_id_stop = $2, total_cycle_time_min = $3 WHERE id = $4`;
        await client.query(sqlMain, [timestamp, picId, totalCycleTimeMin, id]);
        break;
      }

      // 🟢 เพิ่มส่วนนี้: อัปเดตเวลาเสร็จสิ้นงาน (Completed Time)
      case 'pic_completed_time': {
        const sql = `UPDATE smart.smart_qa_3d_working SET pic_completed_time = $1, pic_id_completed = $2 WHERE id = $3`;
        await client.query(sql, [timestamp, picId, id]);
        break;
      }

      case 'pic_close_time': {
        const sql = `UPDATE smart.smart_qa_3d_working SET pic_close_time = $1, pic_close_id = $2 WHERE id = $3`;
        await client.query(sql, [timestamp, picId, id]);
        break;
      }

      default:
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Invalid field name' });
    }

    // ดึงข้อมูลล่าสุดกลับไป
    const finalSql = `
      SELECT w.*,
        CASE
          WHEN w.pic_start_time IS NOT NULL AND w.pic_stop_time IS NULL AND (
            SELECT stop_time FROM smart.smart_qa_3d_working_logs l 
            WHERE l.job_id = w.job_id 
            ORDER BY session_no DESC LIMIT 1
          ) IS NOT NULL THEN true
          ELSE false
        END AS is_paused
      FROM smart.smart_qa_3d_working w
      WHERE w.id = $1
    `;
    const finalRes = await client.query(finalSql, [id]);
    const updatedRow = finalRes.rows[0];

    await client.query('COMMIT'); // Commit ยืนยัน Transaction
    return res.status(200).json({ success: true, message: 'บันทึกเวลาเรียบร้อย', data: updatedRow });

  } catch (error) {
    await client.query('ROLLBACK'); // มี Error ให้ Rollback ทันที
    console.error('Error updating inspection time:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์', 
      error: error.message 
    });
  } finally {
    client.release(); // ⚠️ คืน Connection กลับเข้า Pool เสมอ
  }
});

module.exports = router;