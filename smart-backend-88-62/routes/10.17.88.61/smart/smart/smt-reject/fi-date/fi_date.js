const express = require("express");
const router = express.Router();
const { pool_smart } = require("../../../../config");

router.get("/", async (req, res) => {
  const { startdate, stopdate, fromDate, toDate, prd_name, model, reject_code } = req.query;
  const finalStart = startdate || fromDate;
  const finalStop = stopdate || toDate;
  const finalModel = model || prd_name;

  try {
    let params = [finalStart, finalStop];
    let whereClauses = "r.output_date BETWEEN $1 AND $2";

    if (finalModel) {
      params.push(finalModel);
      whereClauses += ` AND r.prd_name = $${params.length}`;
    }

    if (reject_code) {
      params.push(reject_code);
      whereClauses += ` AND r.reject_code = $${params.length}`;
    }

    let queryStr = `
      SELECT 
          r.output_date,
          r.prd_name,
          r.lot_no,
          r.reject_code,
          r.reject_desc,
          
          -- ลำดับการดึงราคา: 1. ตารางสรุปรายวัน -> 2. ตารางสำรอง Master Cost -> 3. ถ้าไม่มีเลยใช้ 0
          (r.reject_qty * COALESCE(d_cost.final_cost, m.diff_total, 0)) AS total_cost_reject_qty,
          (r.total_input_qty * COALESCE(d_cost.final_cost, m.diff_total, 0)) AS total_cost_input_qty,
          (r.total_scrap_qty * COALESCE(d_cost.final_cost, m.diff_total, 0)) AS total_cost_scrap_qty

      FROM 
          smart.smart_reject_lot_smt r

      -- 1. JOIN ตารางสรุปราคาประจำวัน
      LEFT JOIN smart.smart_smt_daily_cost_summary d_cost
        ON d_cost.production_date = r.output_date::date
       AND UPPER(TRIM(d_cost.prd_name)) = UPPER(TRIM(r.prd_name))

      -- 2. JOIN ตารางสำรอง Master Cost (กรณีตารางสรุปไม่มีข้อมูล)
      LEFT JOIN smart.smart_smt_fi_cost_master_new m 
        ON UPPER(TRIM(m.item)) = UPPER(TRIM(r.prd_name))
       AND m.file_month = TO_CHAR(r.output_date, 'YYYY-MM')

      WHERE ${whereClauses};
    `;

    const result = await pool_smart.query(queryStr, params);

    if (result.rows.length > 0) {
      // ✅ แปลงค่าตัวเลขจาก Database ให้เป็น Number แท้ๆ ก่อนส่งให้ Frontend
      const formattedData = result.rows.map(row => ({
        ...row,
        total_cost_reject_qty: Number(row.total_cost_reject_qty || 0),
        total_cost_input_qty: Number(row.total_cost_input_qty || 0),
        total_cost_scrap_qty: Number(row.total_cost_scrap_qty || 0),
      }));

      return res.json({
        status: "OK",
        data: formattedData, // 👈 ส่งตัวแปรที่แปลงแล้วออกไป
        message: "Data found",
      });
    } else {
      return res.json({
        status: "OK",
        data: [],
        message: "No data found",
      });
    }
  } catch (err) {
    console.error(err.message);
    return res.json({
      status: "ERROR",
      data: [],
      message: err.message,
    });
  }
});

module.exports = router;