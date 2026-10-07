const express = require("express");
const router = express.Router();

const { pool_smart } = require("../../../config");
const query = (text, params) => pool_smart.query(text, params);

router.get("/", async (req, res) => {
  const { startdate, stopdate } = req.query;

  // Validate required parameters
  if (!startdate || !stopdate) {
    return res.status(400).json({
      status: "ERROR",
      message: "Start date and stop date are required.",
    });
  }

  try {
    // SQL query เพิ่มการ JOIN กับตาราง smart_pcap_std_time เพื่อคำนวณ lead_time_std (ชม./lot)
    const queryStr = `
      SELECT
    w.wip_scan_in,
    w.wip_scan_out_proc,
    w.proc_disp,   
    w.lot,
    w.prd_name,
    (w.wip_scan_out_proc - w.wip_scan_in) AS lead_time, -- 🔹 แก้กลับเป็น lead_time
    s.pcs_lot,
    s.uph,
    CASE 
      WHEN s.uph IS NOT NULL AND s.uph > 0 
      THEN (s.pcs_lot::numeric / s.uph::numeric) 
      ELSE NULL 
    END AS lead_time_std
  FROM 
    smart.smart_fpc_lot_wip_history w
  LEFT JOIN 
    smart.smart_pcap_std_time s 
    ON w.prd_name = s.prd_name 
  AND w.proc_disp = s.proc_disp
  WHERE w.factory_code::text = '9'
    AND w.wip_scan_in >= $1::date 
    AND w.wip_scan_in <= ($2::date + interval '1 day')
    AND w.wip_scan_out_proc IS NOT NULL
    `;

    const params = [startdate, stopdate];

    // Execute the query
    const { rows } = await query(queryStr, params);

    // Respond with data or a no-data message
    return res.json({
      status: "OK",
      data: rows,
      message: rows.length > 0 ? "Data found." : "No data found.",
    });

  } catch (err) {
    console.error("Database error:", err);
    return res.status(500).json({
      status: "ERROR",
      message: "Internal Server Error",
    });
  }
});

module.exports = router;