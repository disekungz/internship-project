const express = require("express");
const router = express.Router();

// Database pool from config (4 levels up to routes/10.17.87.244/config.js)
const { pool_smart } = require("../../../../config");
const query = (text, params) => pool_smart.query(text, params);
const { getCached, setCache } = require("../../../../../../Utility/apiCache");

// ----------------------------------------------------------------------------
// GET /processes
// Fetch distinct process names that have actual output records (non-zero qty)
// Cached for 5 minutes
// ----------------------------------------------------------------------------
router.get("/processes", async (req, res) => {
  try {
    const cacheKey = "productname:processes";
    const cached = getCached(cacheKey);
    if (cached) return res.status(200).json(cached);

    const sqlStatement = `
      SELECT DISTINCT proc_disp AS process_name
      FROM smart.smart_fpc_process_output_detail
      WHERE proc_disp IS NOT NULL 
        AND (COALESCE(lot_qty, 0) > 0 OR COALESCE(sht_qty, 0) > 0 OR COALESCE(pcs_qty, 0) > 0)
      ORDER BY proc_disp ASC
    `;
    const result = await query(sqlStatement);
    const data = result.rows.map((row) => row.process_name);
    setCache(cacheKey, data, 5 * 60_000);
    res.status(200).json(data);
  } catch (error) {
    console.error("[OutputByProduct] Error fetching processes:", error.message);
    res.status(500).json({ error: "Cannot fetch process names" });
  }
});

// ----------------------------------------------------------------------------
// GET /products
// Fetch distinct product names that have actual output records (non-zero qty)
// Cached for 5 minutes
// ----------------------------------------------------------------------------
router.get("/products", async (req, res) => {
  try {
    const cacheKey = "productname:products";
    const cached = getCached(cacheKey);
    if (cached) return res.status(200).json(cached);

    const sqlStatement = `
      SELECT DISTINCT prd_name AS product_name
      FROM smart.smart_fpc_process_output_detail
      WHERE prd_name IS NOT NULL
        AND (COALESCE(lot_qty, 0) > 0 OR COALESCE(sht_qty, 0) > 0 OR COALESCE(pcs_qty, 0) > 0)
      ORDER BY prd_name ASC
    `;
    const result = await query(sqlStatement);
    const data = result.rows.map((row) => row.product_name).sort();
    setCache(cacheKey, data, 5 * 60_000);
    res.status(200).json(data);
  } catch (error) {
    console.error("[OutputByProduct] Error fetching products:", error.message);
    res.status(500).json({ error: "Cannot fetch product names" });
  }
});

// ----------------------------------------------------------------------------
// GET /dashboard-products
// Fetch aggregated output data grouped by date, product, process, and MC Line
// Supports: startDate+endDate, date, or month query params
// Uses index-friendly range comparisons (>= start AND < end) instead of TO_CHAR
// Cached for 60 seconds
// ----------------------------------------------------------------------------
router.get("/dashboard-products", async (req, res) => {
  try {
    const { month, date, process, startDate, endDate, _t } = req.query;

    const cacheKey = `dashboard-products:${startDate}:${endDate}:${date}:${month}:${process}`;
    if (!_t) {
      const cached = getCached(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(cached);
      }
    }

    let conditions = [];
    const values = [];
    // ช่วงวันที่ (start รวม, end ไม่รวม) ใช้กรองตาราง lot ด้วย
    let rangeStart = null;
    let rangeEnd = null;

    if (process && process !== "All processes") {
      const procs = process.split(",");
      const placeholders = procs.map((p) => {
        values.push(p);
        return `$${values.length}`;
      }).join(",");
      conditions.push(`proc_disp IN (${placeholders})`);
    }

    // Use sargable range comparisons (>= start AND < end) so PostgreSQL can use index on output_date
    if (startDate && endDate) {
      const endPlusOne = new Date(new Date(`${endDate}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000)
        .toISOString().split("T")[0];
      values.push(startDate);
      conditions.push(`output_date >= $${values.length}`);
      values.push(endPlusOne);
      conditions.push(`output_date < $${values.length}`);
      rangeStart = startDate;
      rangeEnd = endPlusOne;
    } else if (date) {
      const end = new Date(new Date(`${date}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000)
        .toISOString().split("T")[0];
      values.push(date);
      conditions.push(`output_date >= $${values.length}`);
      values.push(end);
      conditions.push(`output_date < $${values.length}`);
      rangeStart = date;
      rangeEnd = end;
    } else if (month) {
      const [y, m] = month.split("-").map(Number);
      const start = `${month}-01`;
      const end = new Date(Date.UTC(y, m, 1)).toISOString().split("T")[0]; // first day of next month
      values.push(start);
      conditions.push(`output_date >= $${values.length}`);
      values.push(end);
      conditions.push(`output_date < $${values.length}`);
      rangeStart = start;
      rangeEnd = end;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // แสดงเฉพาะแถวที่มีเลข lot ในตาราง smart_fpc_output_by_lot
    // วันผลิตของ lot = out_time ช่วง 08:00 ถึง 08:00 วันถัดไป (ตรงกับ /lots) จึงลบ 8 ชม. ก่อนแปลงเป็นวันที่
    let lotRangeClause = "";
    if (rangeStart && rangeEnd) {
      values.push(`${rangeStart} 08:00`);
      lotRangeClause = `AND TO_TIMESTAMP(TRIM(out_time), 'DD/MM/YYYY HH24:MI') >= $${values.length}::timestamp`;
      values.push(`${rangeEnd} 08:00`);
      lotRangeClause += ` AND TO_TIMESTAMP(TRIM(out_time), 'DD/MM/YYYY HH24:MI') < $${values.length}::timestamp`;
    }

    const sqlStatement = `
      WITH lot_days AS (
        SELECT DISTINCT
          REPLACE(TRIM(prd_name), '-', '') AS prd,
          TRIM(proc_disp) AS proc,
          (TO_TIMESTAMP(TRIM(out_time), 'DD/MM/YYYY HH24:MI') - INTERVAL '8 hours')::date AS prod_date
        FROM smart.smart_fpc_output_by_lot
        WHERE out_time IS NOT NULL ${lotRangeClause}
      ),
      agg AS (
        SELECT
          TO_CHAR(output_date, 'YYYY-MM-DD') AS output_date,
          prd_name AS product_name,
          proc_disp AS process_name,
          mc_line,
          SUM(COALESCE(pcs_qty, 0)) AS actual_pcs_qty,
          SUM(COALESCE(sht_qty, 0)) AS actual_sht_qty,
          SUM(COALESCE(lot_qty, 0)) AS actual_lot_qty
        FROM smart.smart_fpc_process_output_detail
        ${whereClause}
        GROUP BY TO_CHAR(output_date, 'YYYY-MM-DD'), prd_name, proc_disp, mc_line
      )
      SELECT a.*
      FROM agg a
      WHERE EXISTS (
        SELECT 1 FROM lot_days ld
        WHERE ld.prd = REPLACE(TRIM(a.product_name), '-', '')
          AND ld.proc = TRIM(a.process_name)
          AND ld.prod_date = a.output_date::date
      )
      ORDER BY a.output_date ASC
    `;
    const result = await query(sqlStatement, values);

    setCache(cacheKey, result.rows, 60_000);
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("[OutputByProduct] Error fetching dashboard-products:", error.message);
    res.status(500).json({ error: "Cannot fetch dashboard product data" });
  }
});

// ----------------------------------------------------------------------------
// GET /lots
// Fetch lot-level output records for one product + process on one production day
// (08:00 of `date` to 08:00 of the next day, based on out_time)
// Source: smart.smart_fpc_output_by_lot (prd_name matched ignoring '-', out_time is varchar 'DD/MM/YYYY HH24:MI')
// Note: table has no mc_line, so lots are not split by MC line
// Response: { lots: [...], non_gate } — non_gate is true when no lots were found and
// smart.smart_pln_product_routing_list marks this process gate_proc = 'N' (null if unknown)
// Cached for 60 seconds
// ----------------------------------------------------------------------------
router.get("/lots", async (req, res) => {
  try {
    const { date, product, process, _t } = req.query;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !product || !process) {
      return res.status(400).json({ error: "date (YYYY-MM-DD), product and process are required" });
    }

    const cacheKey = `productname:lots:${date}:${product}:${process}`;
    if (!_t) {
      const cached = getCached(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(cached);
      }
    }

    // prd_name ในตาราง lot อาจเก็บแบบไม่มีขีด (เช่น CAK236W0A) จึงตัด '-' ออกทั้งสองฝั่งก่อนเทียบ
    const productCode = String(product).trim().replace(/-/g, "");

    // วันผลิตนับ 08:00 ถึง 08:00 ของวันถัดไป (out_time เป็น varchar 'DD/MM/YYYY HH24:MI')
    const nextDate = new Date(new Date(`${date}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0];
    const shiftStart = `${date} 08:00`;
    const shiftEnd = `${nextDate} 08:00`;

    const sqlStatement = `
      SELECT
        lot,
        wo,
        cat,
        prd_name AS product_name,
        proc_disp AS process_name,
        TO_CHAR(plan_date, 'YYYY-MM-DD') AS plan_date,
        in_time,
        out_time,
        input_qty,
        factory_desc,
        prbm_problem_name
      FROM smart.smart_fpc_output_by_lot
      WHERE REPLACE(TRIM(prd_name), '-', '') = $1
        AND TRIM(proc_disp) = $2
        AND TO_TIMESTAMP(TRIM(out_time), 'DD/MM/YYYY HH24:MI') >= $3::timestamp
        AND TO_TIMESTAMP(TRIM(out_time), 'DD/MM/YYYY HH24:MI') <  $4::timestamp
      ORDER BY TO_TIMESTAMP(TRIM(out_time), 'DD/MM/YYYY HH24:MI') ASC, lot ASC
    `;
    const processName = String(process).trim();
    const result = await query(sqlStatement, [productCode, processName, shiftStart, shiftEnd]);

    // ถ้าไม่มี lot ให้ดู routing ว่า process นี้เป็น gate process ไหม (gate_proc = 'N' คือไม่ใช่ ไม่ต้องแสดงข้อความ)
    // routing มีได้หลายแถว (หลาย prd_item/category) — มีแถวไหนเป็น 'N' ก็ถือว่าไม่ใช่ gate
    let nonGate = null;
    if (result.rows.length === 0) {
      const routing = await query(`
        SELECT BOOL_OR(UPPER(TRIM(gate_proc)) = 'N') AS non_gate
        FROM smart.smart_pln_product_routing_list
        WHERE REPLACE(TRIM(prd_name), '-', '') = $1
          AND TRIM(proc_disp) = $2
      `, [productCode, processName]);
      nonGate = routing.rows[0]?.non_gate ?? null;
    }

    const data = { lots: result.rows, non_gate: nonGate };
    setCache(cacheKey, data, 60_000);
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(data);
  } catch (error) {
    console.error("[OutputByProduct] Error fetching lots:", error.message);
    res.status(500).json({ error: "Cannot fetch lot data" });
  }
});

module.exports = router;
