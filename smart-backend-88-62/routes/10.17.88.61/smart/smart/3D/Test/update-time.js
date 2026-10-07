const express = require("express");
const router = express.Router();

const { pool_smart } = require("../../../../config");
// Helper function สำหรับ query PostgreSQL
const query = (text, params) => pool_smart.query(text, params);

// PATCH /inspections/:id/update-time
router.patch('/:id/update-time', async (req, res) => {
  try {
    const { id } = req.params;
    const { fieldName, timestamp, picId, mcNo } = req.body;

    // 1. ตรวจสอบสิทธิ์ PIC ID
    const ALLOWED_PICS = ['EMP001', 'EMP002', 'TECH01', 'ADMIN01'];
    if (!ALLOWED_PICS.includes(picId)) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์บันทึกข้อมูล (PIC ID ไม่อยู่ในระบบ)' });
    }

    // 🔍 2. ดึงข้อมูลปัจจุบันของ Task มาเช็กลำดับขั้นตอนก่อน
    const checkSql = `
      SELECT receive_date, pic_start_time, pic_stop_time, pic_close_time 
      FROM smart.smart_qa_3d_working 
      WHERE id = $1
    `;
    const checkResult = await query(checkSql, [id]);

    if (checkResult.rowCount === 0) {
      return res.status(404).json({ message: 'ไม่พบข้อมูล Task ที่ต้องการอัปเดต' });
    }

    const currentTask = checkResult.rows[0];

    // 🛑 3. ตรวจสอบ Sequence (ลำดับขั้นการบันทึกเวลา)
    let sql = '';
    let params = [];

    switch (fieldName) {
      case 'receive_date':
        // ขั้นตอนที่ 1: รับงาน (ทำได้เลย ไม่ต้องเช็กตัวอื่น)
        sql = `
          UPDATE smart.smart_qa_3d_working 
          SET receive_date = $1, receive_by = $2 
          WHERE id = $3 
          RETURNING *
        `;
        params = [timestamp, picId, id];
        break;

      case 'pic_start_time':
        // ขั้นตอนที่ 2: เริ่มงาน ➔ ต้องมี receive_date ก่อน
        if (!currentTask.receive_date) {
          return res.status(400).json({ 
            message: 'ไม่สามารถบันทึกเวลาเริ่มงานได้: ต้องบันทึก "เวลาที่รับงาน (Receive Date)" ก่อน' 
          });
        }
        if (!mcNo) {
          return res.status(400).json({ message: 'กรุณาระบุเครื่องจักร (mcNo)' });
        }
        sql = `
          UPDATE smart.smart_qa_3d_working 
          SET pic_start_time = $1, pic_id_start = $2, mc_no = $3 
          WHERE id = $4 
          RETURNING *
        `;
        params = [timestamp, picId, mcNo, id];
        break;

      case 'pic_stop_time':
        // ขั้นตอนที่ 3: หยุดงาน ➔ ต้องมี pic_start_time ก่อน
        if (!currentTask.pic_start_time) {
          return res.status(400).json({ 
            message: 'ไม่สามารถบันทึกเวลาหยุดงานได้: ต้องบันทึก "เวลาที่เริ่มงาน (Start Time)" ก่อน' 
          });
        }
        sql = `
          UPDATE smart.smart_qa_3d_working 
          SET pic_stop_time = $1, 
              pic_id_stop = $2,
              total_cycle_time_min = ROUND((EXTRACT(EPOCH FROM ($1::timestamp - pic_start_time)) / 60)::numeric, 2) 
          WHERE id = $3 
          RETURNING *
        `;
        params = [timestamp, picId, id];
        break;

      case 'pic_close_time':
        // ขั้นตอนที่ 4: ปิดงาน ➔ ต้องมี pic_stop_time ก่อน
        if (!currentTask.pic_stop_time) {
          return res.status(400).json({ 
            message: 'ไม่สามารถบันทึกเวลาปิดงานได้: ต้องบันทึก "เวลาที่หยุดงาน (Stop Time)" ก่อน' 
          });
        }
        sql = `
          UPDATE smart.smart_qa_3d_working 
          SET pic_close_time = $1, pic_close_id = $2 
          WHERE id = $3 
          RETURNING *
        `;
        params = [timestamp, picId, id];
        break;

      default:
        return res.status(400).json({ message: 'Invalid field name' });
    }

    // 🚀 4. อัปเดตข้อมูลเมื่อผ่านเงื่อนไข Sequence เรียบร้อย
    const result = await query(sql, params);

    return res.json({ 
      success: true, 
      message: 'บันทึกเวลาเรียบร้อย',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating inspection time:', error);
    return res.status(500).json({ 
      message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์', 
      error: error.message 
    });
  }
});

module.exports = router;