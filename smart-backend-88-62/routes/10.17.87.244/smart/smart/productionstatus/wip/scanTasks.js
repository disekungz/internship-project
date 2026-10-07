const express = require("express");
const router = express.Router();

const { pool_smart } = require("../../../../config");
const query = (text, params) => pool_smart.query(text, params);

const safeGetDate = (rawDate) => {
  const d = new Date(rawDate);
  const isValid = rawDate && !isNaN(d.getTime());
  return {
    iso: isValid
      ? d.toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    local: isValid
      ? d.toLocaleDateString("th-TH")
      : new Date().toLocaleDateString("th-TH"),
  };
};

// GET: / (เดี๋ยวไปต่อพาร์ท /scan-history ที่ไฟล์หลัก)
router.get("/", async (req, res) => {
  let scanTasks = [];

  try {
    const scanQuery = `
      SELECT lot, wip_scan_in, wip_scan_out_proc, prd_name, proc_disp 
      FROM smart.smart_fpc_lot_wip_history
      WHERE TRIM(lot) IN (
        SELECT DISTINCT TRIM(lot) 
        FROM smart.smart_wip_napk 
        WHERE factory IN ('9', 'E')
      )
    `;

    const { rows } = await query(scanQuery);
    scanTasks = rows.map((row, index) => {
      const dateObj = safeGetDate(row.wip_scan_in);
      return {
        id: index + 80000,
        text: row.prd_name || "Unknown Product",
        process: row.proc_disp || "WIP Scan In",
        qty: 0,
        status: "scan",
        date: dateObj.local,
        db_date: dateObj.iso,
        lot: row.lot,
        Wip_Scan_In: dateObj.local,
        wip_scan_out_proc: row.wip_scan_out_proc,
        lead_time: 0, // สวม 0 ไว้ชั่วคราวเนื่องจากโครงสร้างตารางไม่มีคอลัมน์ตรงๆ
      };
    });

    res.status(200).json(scanTasks);
  } catch (err) {
    console.error("🚨 Database error (SCAN):", err.message);
    res
      .status(500)
      .json({
        error: "เกิดข้อผิดพลาดในการดึงข้อมูล SCAN HISTORY",
        message: err.message,
      });
  }
});

module.exports = router;
