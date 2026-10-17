const express = require("express");
const router = express.Router();

// Database pool from config (4 levels up to routes/10.17.87.244/config.js)
const { pool_smart } = require("../../../../config");
const query = (text, params) => pool_smart.query(text, params);
const { getCached, setCache } = require("../../../../../../Utility/apiCache");

// ----------------------------------------------------------------------------
// Product type map (SMT / FPC) from smart.smart_fpc_output_detail.prd_item_code
// prd_item_code '95' = SMT, '94' = FPC — key is prd_name without '-'
// Cached for 1 hour
// ----------------------------------------------------------------------------
async function getProductTypeMap() {
  const cacheKey = "productname:product-types";
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const result = await query(`
    SELECT
      REPLACE(TRIM(prd_prd_name), '-', '') AS prd,
      CASE
        WHEN BOOL_OR(TRIM(prd_item_code) = '95') THEN 'SMT'
        WHEN BOOL_OR(TRIM(prd_item_code) = '94') THEN 'FPC'
      END AS product_type
    FROM smart.smart_fpc_output_detail
    WHERE prd_prd_name IS NOT NULL
    GROUP BY REPLACE(TRIM(prd_prd_name), '-', '')
  `);
  const map = {};
  result.rows.forEach((row) => {
    if (row.product_type) map[row.prd] = row.product_type;
  });
  setCache(cacheKey, map, 60 * 60_000);
  return map;
}

// ----------------------------------------------------------------------------
// Cache TTL for lot data: production days that already ended (before the current
// production day, which starts 08:00 Bangkok time) no longer change, so keep them 1 hour
// ----------------------------------------------------------------------------
function getLotCacheTtl(lastDate) {
  const currentProdDate = new Date(Date.now() + (7 - 8) * 60 * 60 * 1000).toISOString().split("T")[0];
  return lastDate < currentProdDate ? 60 * 60_000 : 60_000;
}

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
// Fetch aggregated output data grouped by date, product, and process (MC lines merged)
// Only rows that have lot numbers in smart.smart_fpc_output_by_lot are returned
// Current production day (from 08:00 Bangkok today): actual_lot_qty = lot row count from
// smart_fpc_output_by_lot (same as /lots), because the output_detail batch is not finished yet
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

    // lot_count = จำนวนแถว lot ของ product + process + วันผลิต (เงื่อนไขเดียวกับ /lots จึงตรงกับจำนวน badge Lot No.)
    const sqlStatement = `
      WITH lot_days AS (
        SELECT
          REPLACE(TRIM(prd_name), '-', '') AS prd,
          TRIM(proc_disp) AS proc,
          (TO_TIMESTAMP(TRIM(out_time), 'DD/MM/YYYY HH24:MI') - INTERVAL '8 hours')::date AS prod_date,
          COUNT(*) AS lot_count
        FROM smart.smart_fpc_output_by_lot
        WHERE out_time IS NOT NULL ${lotRangeClause}
        GROUP BY 1, 2, 3
      ),
      -- ไม่แยก MC: รวมทุก mc_line ของ product + process เดียวกันในวันเดียวกันเป็นแถวเดียว
      -- (ตาราง lot ไม่มี MC จึงจับคู่เลข lot ได้ตรงระดับ product + process เท่านั้น)
      agg AS (
        SELECT
          TO_CHAR(output_date, 'YYYY-MM-DD') AS output_date,
          prd_name AS product_name,
          proc_disp AS process_name,
          SUM(COALESCE(pcs_qty, 0)) AS actual_pcs_qty,
          SUM(COALESCE(sht_qty, 0)) AS actual_sht_qty,
          SUM(COALESCE(lot_qty, 0)) AS actual_lot_qty
        FROM smart.smart_fpc_process_output_detail
        ${whereClause}
        GROUP BY TO_CHAR(output_date, 'YYYY-MM-DD'), prd_name, proc_disp
      ),
      -- ลำดับขั้นตอนของ process ใน routing ของ product นั้น (proc_seq = null ถ้าไม่มีใน routing)
      route_seq AS (
        SELECT
          REPLACE(TRIM(prd_name), '-', '') AS prd,
          TRIM(proc_disp) AS proc,
          MIN(seq) AS proc_seq
        FROM smart.smart_pln_product_routing_list
        WHERE proc_disp IS NOT NULL
        GROUP BY REPLACE(TRIM(prd_name), '-', ''), TRIM(proc_disp)
      )
      -- JOIN lot_days = แสดงเฉพาะแถวที่มีเลข lot (lot_days มีแถวเดียวต่อ product + process + วัน)
      -- วันผลิตปัจจุบัน (ตั้งแต่ 08:00 วันนี้ เวลาไทย) batch ยังสรุปไม่เสร็จ จึงใช้จำนวน lot จากตาราง lot แทน lot_qty
      SELECT
        a.output_date,
        a.product_name,
        a.process_name,
        a.actual_pcs_qty,
        a.actual_sht_qty,
        CASE
          WHEN a.output_date::date = (NOW() AT TIME ZONE 'Asia/Bangkok' - INTERVAL '8 hours')::date
            THEN ld.lot_count
          ELSE a.actual_lot_qty
        END AS actual_lot_qty,
        rs.proc_seq
      FROM agg a
      JOIN lot_days ld
        ON ld.prd = REPLACE(TRIM(a.product_name), '-', '')
       AND ld.proc = TRIM(a.process_name)
       AND ld.prod_date = a.output_date::date
      LEFT JOIN route_seq rs
        ON rs.prd = REPLACE(TRIM(a.product_name), '-', '')
       AND rs.proc = TRIM(a.process_name)
      ORDER BY a.output_date ASC
    `;
    const [result, productTypeMap] = await Promise.all([
      query(sqlStatement, values),
      getProductTypeMap(),
    ]);

    // product_type: SMT / FPC จาก prd_item_code (null ถ้าไม่พบใน smart_fpc_output_detail)
    const rows = result.rows.map((row) => ({
      ...row,
      product_type: productTypeMap[String(row.product_name || "").trim().replace(/-/g, "")] || null,
    }));

    setCache(cacheKey, rows, 60_000);
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(rows);
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
// Note: table has no mc_line; /dashboard-products is grouped without MC so rows match this list
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
    setCache(cacheKey, data, getLotCacheTtl(date));
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(data);
  } catch (error) {
    console.error("[OutputByProduct] Error fetching lots:", error.message);
    res.status(500).json({ error: "Cannot fetch lot data" });
  }
});

// ----------------------------------------------------------------------------
// GET /lots-by-product
// Fetch lot-level records of every process of one product over production days
// startDate..endDate (inclusive, each day 08:00 to 08:00 of the next day, based on out_time)
// Used to prefetch lots when a product group is expanded, so clicking a process shows lots instantly
// Response: { lots: [{ ...lot, prod_date, process_name }] }
// No non_gate here: /dashboard-products only returns rows that have lots, so it is not needed
// Cached for 60 seconds when the range includes the current production day, otherwise 1 hour
// ----------------------------------------------------------------------------
router.get("/lots-by-product", async (req, res) => {
  try {
    const { startDate, endDate, product, _t } = req.query;
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (!startDate || !endDate || !datePattern.test(startDate) || !datePattern.test(endDate) || !product) {
      return res.status(400).json({ error: "startDate, endDate (YYYY-MM-DD) and product are required" });
    }
    const rangeDays = (new Date(`${endDate}T00:00:00Z`) - new Date(`${startDate}T00:00:00Z`)) / 86_400_000;
    if (!(rangeDays >= 0 && rangeDays <= 62)) {
      return res.status(400).json({ error: "date range must be 0-62 days" });
    }

    const cacheKey = `productname:lots-by-product:${startDate}:${endDate}:${product}`;
    if (!_t) {
      const cached = getCached(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(cached);
      }
    }

    const productCode = String(product).trim().replace(/-/g, "");
    const nextDate = new Date(new Date(`${endDate}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0];
    const shiftStart = `${startDate} 08:00`;
    const shiftEnd = `${nextDate} 08:00`;

    // เงื่อนไขเดียวกับ /lots แต่ไม่กรอง process และคืนวันผลิต (out_time ลบ 8 ชม.) ไว้ให้ frontend แยกกลุ่ม
    const lotSql = `
      SELECT
        lot,
        wo,
        cat,
        prd_name AS product_name,
        TRIM(proc_disp) AS process_name,
        TO_CHAR((TO_TIMESTAMP(TRIM(out_time), 'DD/MM/YYYY HH24:MI') - INTERVAL '8 hours')::date, 'YYYY-MM-DD') AS prod_date,
        TO_CHAR(plan_date, 'YYYY-MM-DD') AS plan_date,
        in_time,
        out_time,
        input_qty,
        factory_desc,
        prbm_problem_name
      FROM smart.smart_fpc_output_by_lot
      WHERE REPLACE(TRIM(prd_name), '-', '') = $1
        AND TO_TIMESTAMP(TRIM(out_time), 'DD/MM/YYYY HH24:MI') >= $2::timestamp
        AND TO_TIMESTAMP(TRIM(out_time), 'DD/MM/YYYY HH24:MI') <  $3::timestamp
      ORDER BY TO_TIMESTAMP(TRIM(out_time), 'DD/MM/YYYY HH24:MI') ASC, lot ASC
    `;
    const lotResult = await query(lotSql, [productCode, shiftStart, shiftEnd]);

    const data = { lots: lotResult.rows };
    setCache(cacheKey, data, getLotCacheTtl(endDate));
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(data);
  } catch (error) {
    console.error("[OutputByProduct] Error fetching lots-by-product:", error.message);
    res.status(500).json({ error: "Cannot fetch lot data" });
  }
});

module.exports = router;
