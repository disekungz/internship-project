// const express = require("express");
// const router = express.Router();
// const { pool_smart } = require("../../../../config");

// router.get("/", async (req, res) => {
//   const { startdate, stopdate, fromDate, toDate, model, reject_code } = req.query;
//   const finalStart = startdate || fromDate;
//   const finalStop = stopdate || toDate;

//   try {
//     let params = [finalStart, finalStop];
//     let whereClauses = "r.output_date BETWEEN $1 AND $2";

//     if (model) {
//       params.push(model);
//       whereClauses += ` AND r.prd_name = $${params.length}`;
//     }

//     if (reject_code) {
//       params.push(reject_code);
//       whereClauses += ` AND r.reject_code = $${params.length}`;
//     }

//     let queryStr = `
//       SELECT 
//           r.output_date,
//           r.prd_name,
//           r.lot_no,
//           r.reject_code,
//           r.reject_desc,
          
//           -- คำนวณต้นทุนโดยดึงราคาจากตารางที่จับคู่เสร็จสรรพ
//           (r.reject_qty * COALESCE(p_new.tt_cost, p_old.tt_cost, m.diff_total, 0)) AS total_cost_reject_qty,
//           (r.total_input_qty * COALESCE(p_new.tt_cost, p_old.tt_cost, m.diff_total, 0)) AS total_cost_input_qty,
//           (r.total_scrap_qty * COALESCE(p_new.tt_cost, p_old.tt_cost, m.diff_total, 0)) AS total_cost_scrap_qty

//       FROM 
//           smart.smart_reject_lot_smt r

//       -- 1. ยุคใหม่ (>= 2026-06-01): ดึงราคาล่าสุดที่ไม่เกินวันเกิดเหตุ โดยบังคับใช้ Index ผ่านการ Limit 1 ใน Lateral Join
//       LEFT JOIN LATERAL (
//           SELECT p.tt_cost
//           FROM smart.smart_pln_price p
//           WHERE TRIM(p.prd_name) = TRIM(r.prd_name)
//             AND r.output_date >= '2026-06-01'
//             AND p.created_at <= r.output_date
//           ORDER BY p.created_at DESC
//           LIMIT 1
//       ) p_new ON r.output_date >= '2026-06-01'

//       -- 2. ยุคอดีต (< 2026-06-01): ดึงราคาตามช่วงเดือนของวันนั้นๆ
//       LEFT JOIN LATERAL (
//           SELECT p.tt_cost
//           FROM smart.smart_pln_price p
//           WHERE TRIM(p.prd_name) = TRIM(r.prd_name)
//             AND r.output_date < '2026-06-01'
//             AND p.created_at >= DATE_TRUNC('month', r.output_date::timestamp)
//             AND p.created_at < DATE_TRUNC('month', r.output_date::timestamp) + INTERVAL '1 month'
//           ORDER BY p.created_at DESC
//           LIMIT 1
//       ) p_old ON r.output_date < '2026-06-01'

//       -- 3. ตารางสำรอง (Master Cost) อิงตามเดือน file_month
//       LEFT JOIN smart.smart_smt_fi_cost_master_new m 
//         ON TRIM(m.item) = TRIM(r.prd_name)
//        AND m.file_month = TO_CHAR(r.output_date, 'YYYY-MM')

//       WHERE ${whereClauses};
//     `;

//     const result = await pool_smart.query(queryStr, params);

//     if (result.rows.length > 0) {
//       return res.json({
//         status: "OK",
//         data: result.rows,
//         message: "Data found",
//       });
//     } else {
//       return res.json({
//         status: "OK",
//         data: [],
//         message: "No data found",
//       });
//     }
//   } catch (err) {
//     console.error(err.message);
//     return res.json({
//       status: "ERROR",
//       data: [],
//       message: err.message,
//     });
//   }
// });

// module.exports = router;