const express = require("express");
const router = express.Router();

const { pool_smart } = require("../../../../config");
const query = (text, params) => pool_smart.query(text, params);

// GET / - ดึงข้อมูลตาราง smart.smart_qa_3d_working พร้อม items ทั้งหมด และชื่อพนักงาน
router.get("/", async (req, res) => {
  try {
    // 📌 รับ startDate และ endDate เพิ่มจาก Query Params
    const { search, limit, startDate, endDate } = req.query;

    let queryStr = `
      SELECT 
        -- 📌 1. คอลัมน์จากตารางหลัก (Header)
        h.id,
        h.job_id,
        h.request_id,
        h.request_dept,
        TRIM(REGEXP_REPLACE(MAX(m.name), '^(นางสาว|นาย|นาง)\s*', '')) AS requester_name,
        h.tel,
        h.job_type,
        h.product_name,
        h.lot,
        h.mc_no,
        h.priority,
        h.total_point,
        h.total_cycle_time_min,
        h.attached_file,
        h.result_file,
        h.receive_by,
        h.receive_date,
        h.pic_id_start,
        h.pic_start_time,
        h.pic_id_stop,
        h.pic_stop_time,
        h.pic_close_id,
        h.pic_close_time,
        h.is_reject,
        h.remark, -- 👈 เพิ่มคอลัมน์ remark ตรงนี้
        h.create_date AS created_at,
        h.update_date,

        -- 📌 2. คอลัมน์จากตารางย่อย (Items Array)
        COALESCE(
          json_agg(
            json_build_object(
              'id', i.id,
              'jobId', i.job_id,
              'request_details', i.request_details,
              'qty', i.qty,
              'qtyUnit', i.qty_unit,
              'measPoint', i.meas_point,
              'stdTimeSecPoint', i.std_time_sec_point,
              'offsetTimeMin', i.offset_time_min,
              'cycleTimeMin', i.cycle_time_min,
              'createdAt', i.create_date
            )
          ) FILTER (WHERE i.id IS NOT NULL), '[]'
        ) AS items

      FROM smart.smart_qa_3d_working h
      LEFT JOIN smart.smart_qa_3d_working_items i ON h.job_id = i.job_id
      LEFT JOIN smart.smart_man_name_list_master m ON h.request_id = m.code
    `;

    const params = [];
    const conditions = [];

    // 📌 1. เงื่อนไขการค้นหาข้อความ (Search)
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(h.job_id ILIKE $${params.length} OR h.product_name ILIKE $${params.length} OR h.lot ILIKE $${params.length} OR m.name ILIKE $${params.length})`);
    }

    // 📌 2. เงื่อนไขช่วงเวลา (นับรอบวัน 08:00 - 08:00 วันถัดไป)
    if (startDate) {
      const startDateTime = `${startDate} 08:00:00`;
      
      // ถ้าไม่มี endDate ส่งมา ให้ใช้ startDate วันเดียวกันเพื่อดึงรอบ 1 วัน
      const endTargetDate = endDate || startDate; 
      
      // วันสิ้นสุด + 1 วัน ณ เวลา 08:00:00
      const endNextDay = new Date(endTargetDate);
      endNextDay.setDate(endNextDay.getDate() + 1);
      const endNextDayStr = endNextDay.toISOString().split('T')[0];
      const endDateTime = `${endNextDayStr} 08:00:00`;

      params.push(startDateTime);
      const startParamIdx = params.length;

      params.push(endDateTime);
      const endParamIdx = params.length;

      conditions.push(`h.create_date >= $${startParamIdx} AND h.create_date < $${endParamIdx}`);
    }

    // ประกอบเงื่อนไข WHERE
    if (conditions.length > 0) {
      queryStr += ` WHERE ` + conditions.join(" AND ");
    }

    // GROUP BY ใช้ h.id
    queryStr += ` GROUP BY h.id ORDER BY h.id DESC`;

    // 📌 3. เงื่อนไข Limit
    if (limit) {
      params.push(Number(limit));
      queryStr += ` LIMIT $${params.length}`;
    }

    const { rows } = await query(queryStr, params);

    return res.json({
      status: "OK",
      data: rows,
      message: rows.length > 0 ? "Data found." : "No data found.",
    });

  } catch (err) {
    console.error("Database error:", err);
    return res.status(500).json({ status: "ERROR", message: "Internal Server Error" });
  }
});

module.exports = router;