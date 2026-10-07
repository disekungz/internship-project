const express = require("express");
const router = express.Router();

// Database pools from config (4 levels up to routes/10.17.87.244/config.js)
const { pool_smart } = require("../../../../config");
const query = (text, params) => pool_smart.query(text, params);
const { getCached, setCache } = require("../../../../../../Utility/apiCache");

// ----------------------------------------------------------------------------
// GET /available-months
// Fetch distinct YYYY-MM months that have output data, for Dropdown
// ----------------------------------------------------------------------------
router.get("/available-months", async (req, res) => {
  try {
    const sqlStatement = `
      SELECT DISTINCT TO_CHAR(output_date, 'YYYY-MM') AS month
      FROM smart.smart_fpc_process_output_detail 
      WHERE output_date IS NOT NULL
      ORDER BY month DESC
    `;
    const result = await query(sqlStatement);
    res.status(200).json(result.rows.map((row) => row.month));
  } catch (error) {
    console.error("[OutputByProcess] Error fetching available-months:", error.message);
    res.status(500).json({ error: "Cannot fetch available months" });
  }
});

// ----------------------------------------------------------------------------
// GET /available-dates?month=YYYY-MM
// Fetch distinct dates within a selected month, for Dropdown
// ----------------------------------------------------------------------------
router.get("/available-dates", async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.json([]);
    const sqlStatement = `
      SELECT DISTINCT TO_CHAR(output_date, 'YYYY-MM-DD') AS date
      FROM smart.smart_fpc_his_proc_output_detail 
      WHERE output_date IS NOT NULL 
        AND TO_CHAR(output_date, 'YYYY-MM') = $1
        
      ORDER BY date DESC
    `;
    const result = await query(sqlStatement, [month]);
    res.status(200).json(result.rows.map((row) => row.date));
  } catch (error) {
    console.error("[OutputByProcess] Error fetching available-dates:", error.message);
    res.status(500).json({ error: "Cannot fetch available dates" });
  }
});

// ----------------------------------------------------------------------------
// GET /lines
// Fetch all distinct active MC Line names (last 30 days)
// ----------------------------------------------------------------------------
router.get("/lines", async (req, res) => {
  try {
    const sqlStatement = `
      SELECT DISTINCT TRIM(mc_line) AS line_name
      FROM smart.smart_fpc_process_output_detail
      WHERE mc_line IS NOT NULL 
        AND TRIM(mc_line) != '' 
        AND TRIM(mc_line) != '-'
        AND output_date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY line_name ASC
    `;
    const result = await query(sqlStatement);
    res.status(200).json(result.rows.map((row) => row.line_name));
  } catch (error) {
    console.error("[OutputByProcess] Error fetching lines:", error.message);
    res.status(500).json({ error: "Cannot fetch line names" });
  }
});

// ----------------------------------------------------------------------------
// GET /dashboard-lots
// Fetch aggregated output data grouped by date and process, for Process Dashboard chart
// Supports: startDate+endDate, date, or month query params
// ----------------------------------------------------------------------------
router.get("/dashboard-lots", async (req, res) => {
  try {
    const { month, date, startDate, endDate, line, _t } = req.query;
    const cacheKey = `dashboard-lots:${startDate}:${endDate}:${date}:${month}:${line}`;

    const cached = getCached(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.status(200).json(cached);
    }

    const values = [];
    let conditions = [];

    if (startDate && endDate) {
      const end = new Date(`${endDate}T00:00:00Z`);
      const endPlusOne = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      values.push(startDate);
      conditions.push(`output_date >= $${values.length}`);
      values.push(endPlusOne.toISOString().split("T")[0]);
      conditions.push(`output_date < $${values.length}`);
      // Real-time: include current-day output
    } else if (date) {
      values.push(date);
      conditions.push(`TO_CHAR(output_date, 'YYYY-MM-DD') = $${values.length}`);
    } else if (month) {
      values.push(month);
      conditions.push(`TO_CHAR(output_date, 'YYYY-MM') = $${values.length}`);
      // Real-time: include current-day output
    }

    if (line && line !== "All Lines") {
      values.push(line);
      conditions.push(`TRIM(mc_line) = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sqlStatement = `
      SELECT
        TO_CHAR(output_date, 'YYYY-MM-DD') AS output_date,
        proc_disp AS process_name,
        COUNT(DISTINCT mc_line) AS mcline_count,
        ARRAY_TO_STRING(
          ARRAY_AGG(DISTINCT NULLIF(TRIM(mc_line), '') ORDER BY NULLIF(TRIM(mc_line), '')),
          ', '
        ) AS mc_lines,
        SUM(COALESCE(pcs_qty, 0)) AS actual_pcs_qty,
        SUM(COALESCE(sht_qty, 0)) AS actual_sht_qty,
        SUM(COALESCE(lot_qty, 0)) AS actual_lot_qty,
        (SELECT COUNT(DISTINCT prd_name) FROM smart.smart_fpc_process_output_detail ${whereClause}) AS active_products_count
      FROM smart.smart_fpc_process_output_detail
      ${whereClause}
      GROUP BY TO_CHAR(output_date, 'YYYY-MM-DD'), proc_disp
      ORDER BY output_date ASC
    `;
    const result = await query(sqlStatement, values);

    setCache(cacheKey, result.rows, 60_000);
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("[OutputByProcess] Error fetching dashboard-lots:", error.message);
    res.status(500).json({ error: "Cannot fetch dashboard data" });
  }
});

// ----------------------------------------------------------------------------
// GET /dashboard-mcline
// Fetch output aggregated by MC Line for the selected process (drill-down)
// ----------------------------------------------------------------------------
router.get("/dashboard-mcline", async (req, res) => {
  try {
    const { month, date, startDate, endDate, process } = req.query;

    const values = [];
    let conditions = [];

    if (startDate && endDate) {
      const end = new Date(`${endDate}T00:00:00Z`);
      const endPlusOne = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      values.push(startDate);
      conditions.push(`output_date >= $${values.length}`);
      values.push(endPlusOne.toISOString().split("T")[0]);
      conditions.push(`output_date < $${values.length}`);
      // Real-time: include current-day output
    } else if (date) {
      values.push(date);
      conditions.push(`TO_CHAR(output_date, 'YYYY-MM-DD') = $${values.length}`);
    } else if (month) {
      values.push(month);
      conditions.push(`TO_CHAR(output_date, 'YYYY-MM') = $${values.length}`);
    }

    if (process) {
      values.push(process);
      conditions.push(`proc_disp = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sqlStatement = `
      SELECT 
        mc_line,
        SUM(COALESCE(pcs_qty, 0)) AS actual_pcs_qty,
        SUM(COALESCE(sht_qty, 0)) AS actual_sht_qty,
        SUM(COALESCE(lot_qty, 0)) AS actual_lot_qty
      FROM smart.smart_fpc_process_output_detail
      ${whereClause}
      GROUP BY mc_line
      ORDER BY mc_line ASC
    `;
    const result = await query(sqlStatement, values);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("[OutputByProcess] Error fetching dashboard-mcline:", error.message);
    res.status(500).json({ error: "Cannot fetch MC Line data" });
  }
});

// ----------------------------------------------------------------------------
// GET /dashboard-targets?startDate=&endDate=&line=
// Fetch production targets from smart.smart_pln_output_target
// Supports flexible line code matching (alias variants)
// ----------------------------------------------------------------------------
router.get("/dashboard-targets", async (req, res) => {
  try {
    const { startDate, endDate, line, _t } = req.query;

    const cacheKey = `dashboard-targets:${startDate}:${endDate}:${line}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.status(200).json(cached);
    }

    const values = [];
    let conditions = [];

    if (startDate && endDate) {
      values.push(startDate);
      conditions.push(`plan_date >= $${values.length}`);
      values.push(endDate);
      conditions.push(`plan_date <= $${values.length}`);
    }

    if (line && line !== "All" && line !== "All Group Lines") {
      // Build alias variants to match flexible line_code naming in the database
      const cleanLine = line.trim().toUpperCase();
      const underscored = cleanLine.replace(/[\s-]+/g, "_");
      const hyphenated = cleanLine.replace(/[\s_]+/g, "-");
      const genVariant = underscored.replace(/_GEN$/, "_GENERAL");
      const nonVariant = underscored.replace(/_NON$/, "_NON_SILICONE");
      const strippedUnderscored = underscored.replace(/^LINE_/, "");
      const strippedHyphenated = hyphenated.replace(/^LINE-/, "");

      const aliasList = [
        cleanLine,
        underscored,
        hyphenated,
        genVariant,
        nonVariant,
        strippedUnderscored,
        strippedHyphenated,
      ];
      if (cleanLine.includes("TF")) {
        aliasList.push("TF-2", "TF_2", "TF2", "LINE TF-2", "LINE_TF_2", "SUPPORT TF2", "SUPPORT_TF2", "AT_TF2", "AT_TF_2");
      }
      if (
        (cleanLine.includes("AVI") && cleanLine.includes("K2")) ||
        cleanLine === "AVI/K2" ||
        cleanLine === "AVI_K2" ||
        cleanLine === "LINE AVI/K2" ||
        cleanLine === "LINE_AVI_K2"
      ) {
        aliasList.push("AVI", "K2", "LINE AVI", "LINE K2", "LINE_AVI", "LINE_K2");
      }
      if (cleanLine.includes("ASY1_G") || cleanLine === "ASY1_G" || cleanLine === "LINE ASY1_G" || cleanLine === "LINE_ASY1_G" || cleanLine.includes("ASSY 1") || cleanLine === "ASY1_GEN") {
        aliasList.push("ASSY 1", "ASSY1", "ASY1_G", "LINE ASY1_G", "ASSY 1 (GENERAL)", "ASY1_GEN");
      }
      if (cleanLine.includes("ASY1_A") || cleanLine === "ASY1_A" || cleanLine === "LINE ASY1_A" || cleanLine === "LINE_ASY1_A" || cleanLine.includes("ASSY 1AU") || cleanLine === "ASY1_AUTO") {
        aliasList.push("ASSY 1AU", "ASSY 1 AU", "ASSY1AU", "ASY1_A", "LINE ASY1_A", "ASSY 1 (AUTOMOTIVE)", "ASY1_AUTO");
      }
      if (cleanLine.includes("ASY2") || cleanLine === "ASY2" || cleanLine === "LINE ASY2" || cleanLine === "LINE_ASY2" || cleanLine.includes("ASSY 2")) {
        aliasList.push("ASSY 2", "ASSY2", "ASY2", "LINE ASY2");
      }
      if (cleanLine.includes("ASY3") || cleanLine === "ASY3" || cleanLine === "LINE ASY3" || cleanLine === "LINE_ASY3" || cleanLine.includes("ASSY 3")) {
        aliasList.push("ASSY 3", "ASSY3", "ASY3", "LINE ASY3");
      }
      if (cleanLine === "MOTB" || cleanLine === "LINE_MOTB" || cleanLine === "LINE MOTB") {
        aliasList.push("MOTB", "LINE_MOTB", "LINE MOTB", "A-1", "A-2", "A-3", "A-4", "A1", "A2", "A3", "A4");
      }
      if (cleanLine === "MOTA_A" || cleanLine === "LINE_MOTA_A" || cleanLine === "LINE MOTA_A" || cleanLine === "MOTA-A") {
        aliasList.push("MOTA_A", "LINE_MOTA_A", "LINE MOTA_A", "A-5", "A-6", "A5", "A6");
      }
      if (cleanLine === "MOTA_G" || cleanLine === "LINE_MOTA_G" || cleanLine === "LINE MOTA_G" || cleanLine === "MOTA-G") {
        aliasList.push("MOTA_G", "LINE_MOTA_G", "LINE MOTA_G", "A-7", "A-8", "A7", "A8");
      }
      values.push(aliasList);
      conditions.push(`UPPER(line_code) = ANY($${values.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sqlStatement = `
      SELECT 
        TO_CHAR(plan_date, 'YYYY-MM-DD') AS plan_date,
        plan_week,
        plan_type,
        UPPER(line_code) AS line_code,
        SUM(COALESCE(target_qty, 0)) AS target_qty
      FROM smart.smart_pln_output_target
      ${whereClause}
      GROUP BY TO_CHAR(plan_date, 'YYYY-MM-DD'), plan_week, plan_type, UPPER(line_code)
      ORDER BY plan_date ASC
    `;
    const result = await query(sqlStatement, values);

    // Synthesize MOTB (A-1..A-4), MOTA_A (A-5..A-6), MOTA_G (A-7..A-8) targets
    const motGroups = {
      'MOTB': new Set(['A-1', 'A-2', 'A-3', 'A-4', 'A1', 'A2', 'A3', 'A4']),
      'MOTA_A': new Set(['A-5', 'A-6', 'A5', 'A6']),
      'MOTA_G': new Set(['A-7', 'A-8', 'A7', 'A8']),
      'MOTC': new Set(['G-1', 'G-2', 'G-3', 'G-4', 'G-5', 'G1', 'G2', 'G3', 'G4', 'G5']),
      'MOTD': new Set(['G-6', 'G-7', 'G-8', 'G-9', 'G-10', 'G6', 'G7', 'G8', 'G9', 'G10'])
    };

    const syntheticMap = new Map();
    result.rows.forEach(r => {
      const code = (r.line_code || '').toUpperCase().trim();
      for (const [targetLine, sourceSet] of Object.entries(motGroups)) {
        if (sourceSet.has(code)) {
          const key = `${targetLine}:${r.plan_date}:${r.plan_type}`;
          if (!syntheticMap.has(key)) {
            syntheticMap.set(key, {
              plan_date: r.plan_date,
              plan_week: r.plan_week,
              plan_type: r.plan_type,
              line_code: targetLine,
              target_qty: 0
            });
          }
          syntheticMap.get(key).target_qty += Number(r.target_qty || 0);

          if (targetLine === 'MOTC') {
            const aixKey = `AIX-MOT:${r.plan_date}:${r.plan_type}`;
            if (!syntheticMap.has(aixKey)) {
              syntheticMap.set(aixKey, {
                plan_date: r.plan_date,
                plan_week: r.plan_week,
                plan_type: r.plan_type,
                line_code: 'AIX-MOT',
                target_qty: 0
              });
            }
            syntheticMap.get(aixKey).target_qty += Number(r.target_qty || 0);
          }
        }
      }
    });

    const finalRows = [...result.rows, ...Array.from(syntheticMap.values())];

    setCache(cacheKey, finalRows, 60_000);
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(finalRows);
  } catch (error) {
    console.error("[OutputByProcess] Error fetching dashboard-targets:", error.message);
    res.status(500).json({ error: "Cannot fetch target data" });
  }
});

// ----------------------------------------------------------------------------
// In-memory cache for product name mapping (1 hour TTL)
// ----------------------------------------------------------------------------
let productMapCache = null;
let productMapLastFetch = 0;

async function getProductMap() {
  const now = Date.now();
  if (productMapCache && now - productMapLastFetch < 1000 * 60 * 60) {
    return productMapCache;
  }
  const sqlStatement = `SELECT DISTINCT prd_prd_name FROM smart.smart_fpc_output_detail WHERE prd_prd_name IS NOT NULL`;
  const result = await query(sqlStatement);
  const map = {};
  result.rows.forEach((row) => {
    const rawCode = row.prd_prd_name.replace(/-/g, "");
    map[rawCode] = row.prd_prd_name;
  });
  productMapCache = map;
  productMapLastFetch = now;
  return map;
}

// ----------------------------------------------------------------------------
// GET /lots
// Fetch WIP and output lot records (combined from lot history + live WIP)
// ----------------------------------------------------------------------------
router.get("/lots", async (req, res) => {
  try {
    const { month, date, search, process } = req.query;
    const productMap = await getProductMap();

    let conditions = [`a.factory_code = '9'`];
    const values = [];

    if (process && process !== "All processes") {
      values.push(process);
      conditions.push(`a.proc_disp = $${values.length}`);
    }

    if (date) {
      values.push(date);
      conditions.push(`TO_CHAR(a.wip_scan_in, 'YYYY-MM-DD') = $${values.length}`);
    } else if (month) {
      values.push(month);
      conditions.push(`TO_CHAR(a.wip_scan_in, 'YYYY-MM') = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`a.prd_name ILIKE $${values.length}`);
    }

    const whereClause = conditions.join(" AND ");
    const limitClause = search || (process && process !== "All processes") ? "" : "LIMIT 2000";

    const sqlStatement = `
      SELECT 
        a.lot AS lot_id,
        a.prd_name AS product_name,
        a.proc_disp AS process_name,
        CASE WHEN a.wip_scan_out_proc IS NOT NULL THEN 0 ELSE COALESCE(b.input_qty, 0) END AS wip_qty,
        'piece' AS wip_unit,
        CASE WHEN a.wip_scan_out_proc IS NOT NULL THEN COALESCE(b.input_qty - COALESCE(b.rejh_qty, 0), 0) ELSE 0 END AS output_qty,
        'piece' AS output_unit,
        0 AS actual_lot_qty,
        0 AS actual_sht_qty,
        CASE WHEN a.wip_scan_out_proc IS NOT NULL THEN COALESCE(b.input_qty - COALESCE(b.rejh_qty, 0), 0) ELSE 0 END AS actual_pcs_qty,
        a.wip_scan_in AS scan_in_time,
        a.wip_scan_out_proc AS scan_out_time,
        COALESCE(ABS(EXTRACT(EPOCH FROM (COALESCE(a.wip_scan_out_proc, NOW()) - a.wip_scan_in))/60), 0) AS lead_time_minutes,
        1 AS pcs_per_sheet,
        1000 AS lot_qty_pieces
      FROM (
          SELECT lot, proc_disp, prd_name, wip_scan_in, wip_scan_out_proc, factory_code
          FROM smart.smart_fpc_lot_wip_history
          
          UNION ALL
          
          SELECT 
              w.lot, w.proc_disp, w.lot_prd_name AS prd_name,
              COALESCE(w.update_date, CURRENT_TIMESTAMP) AS wip_scan_in,
              NULL AS wip_scan_out_proc, '9' AS factory_code
          FROM smart.smart_wip_napk w
          WHERE w.factory IN ('9', 'E')
            AND NOT EXISTS (
                SELECT 1 FROM smart.smart_fpc_lot_wip_history h 
                WHERE h.lot = w.lot AND h.proc_disp = w.proc_disp
            )
      ) a
      LEFT JOIN (
        SELECT lot, SUM(input_qty) as input_qty, SUM(rejh_qty) as rejh_qty 
        FROM smart.smart_wip_napk 
        WHERE factory IN ('9', 'E')
        GROUP BY lot
      ) b ON TRIM(a.lot) = TRIM(b.lot) 
      WHERE ${whereClause}
      ORDER BY a.wip_scan_in DESC
      ${limitClause}
    `;
    const result = await query(sqlStatement, values);

    const mappedRows = result.rows.map((row) => {
      const rawCode = row.product_name.replace(/-/g, "");
      const realName = productMap[rawCode] || row.product_name;
      return { ...row, product_name: realName };
    });

    res.status(200).json(mappedRows);
  } catch (error) {
    console.error("[OutputByProcess] Error fetching lots:", error.message);
    res.status(500).json({ error: "Cannot fetch lot data" });
  }
});

// ----------------------------------------------------------------------------
// GET /processes
// Fetch distinct process names from WIP table (factory 9 and E only)
// ----------------------------------------------------------------------------
router.get("/processes", async (req, res) => {
  try {
    const sqlStatement = `
      SELECT DISTINCT proc_disp AS process_name
      FROM smart.smart_wip_napk
      WHERE proc_disp IS NOT NULL
        AND factory IN ('9', 'E')
      ORDER BY proc_disp ASC
    `;
    const result = await query(sqlStatement);
    res.status(200).json(result.rows.map((row) => row.process_name));
  } catch (error) {
    console.error("[OutputByProcess] Error fetching processes:", error.message);
    res.status(500).json({ error: "Cannot fetch process names" });
  }
});

// Helper: Format raw product code into human-readable display name
function fallbackFormat(rawName) {
  if (!rawName) return "";
  const match = rawName.match(/^([A-Za-z]+)(\d{3}[A-Za-z]+)(.+)$/);
  if (match) {
    const letters = match[1];
    const middle = match[2];
    let rest = match[3];
    const restMatch = rest.match(/^(\d+[A-Za-z])([A-Za-z])$/);
    if (restMatch) {
      rest = `${restMatch[1]}-${restMatch[2]}`;
    }
    return `${letters}-${middle}-${rest}`;
  }
  return rawName;
}

// ----------------------------------------------------------------------------
// GET /products
// Fetch distinct product names (formatted) for Filter Dropdown
// ----------------------------------------------------------------------------
router.get("/products", async (req, res) => {
  try {
    const productMap = await getProductMap();

    const sqlStatement = `
      SELECT DISTINCT prd_item_code AS product_name
      FROM smart.smart_fpc_his_proc_output_detail
      WHERE factory_code = '9'
        AND left(prd_item_code, 2) = '94'
        AND (proc_disp LIKE 'F%' OR proc_disp IN ('QA', '3D3', 'PAK', 'PAKS', 'W/H'))
    `;
    const result = await query(sqlStatement);

    const mappedProducts = new Set();
    result.rows.forEach((row) => {
      const rawCode = row.product_name.substring(2);
      const realName = productMap[rawCode] || fallbackFormat(rawCode);
      mappedProducts.add(realName);
    });

    res.status(200).json(Array.from(mappedProducts).sort());
  } catch (error) {
    console.error("[OutputByProcess] Error fetching products:", error.message);
    res.status(500).json({ error: "Cannot fetch product names" });
  }
});

module.exports = router;
