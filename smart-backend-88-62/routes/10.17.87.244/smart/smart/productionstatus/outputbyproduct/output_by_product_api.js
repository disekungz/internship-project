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
    } else if (date) {
      const end = new Date(new Date(`${date}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000)
        .toISOString().split("T")[0];
      values.push(date);
      conditions.push(`output_date >= $${values.length}`);
      values.push(end);
      conditions.push(`output_date < $${values.length}`);
    } else if (month) {
      const [y, m] = month.split("-").map(Number);
      const start = `${month}-01`;
      const end = new Date(Date.UTC(y, m, 1)).toISOString().split("T")[0]; // first day of next month
      values.push(start);
      conditions.push(`output_date >= $${values.length}`);
      values.push(end);
      conditions.push(`output_date < $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sqlStatement = `
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
      ORDER BY output_date ASC
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

module.exports = router;
