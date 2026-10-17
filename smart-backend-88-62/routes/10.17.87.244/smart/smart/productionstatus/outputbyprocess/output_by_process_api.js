const express = require("express");
const router = express.Router();

// Database pools from config (4 levels up to routes/10.17.87.244/config.js)
const { pool_smart } = require("../../../../config");
const query = (text, params) => pool_smart.query(text, params);
const { getCached, setCache } = require("../../../../../../Utility/apiCache");
const { GATE_PAIRS_CTE, gateExists } = require("./gateProcess");

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
// วันผลิตปัจจุบัน (เวลาไทย, ตัดรอบ 08:00) ในรูปแบบ YYYY-MM-DD
// ก่อน 08:00 ยังนับเป็นวันผลิตของเมื่อวาน
// ----------------------------------------------------------------------------
function getCurrentProductionDate() {
  const bkk = new Date(Date.now() + 7 * 60 * 60 * 1000);
  if (bkk.getUTCHours() < 8) bkk.setUTCDate(bkk.getUTCDate() - 1);
  return bkk.toISOString().split("T")[0];
}

// ----------------------------------------------------------------------------
// จำนวน lot ต่อ process ของวันผลิตหนึ่งวัน จาก smart.smart_fpc_output_by_lot
// ใช้เงื่อนไขเดียวกับ /process-lots (gate เท่านั้น, out_time 08:00 -> 08:00 วันถัดไป, นับทุกแถว)
// เพื่อให้จำนวน lot ในตารางตรงกับจำนวน Lot No. ที่กดขยายดู
// คืนค่า Map: process_name (TRIM) -> จำนวน lot
// ----------------------------------------------------------------------------
async function getScanLotCounts(prodDate) {
  const nextDay = new Date(new Date(`${prodDate}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0];
  const sqlStatement = `
    WITH ${GATE_PAIRS_CTE},
    parsed AS (
      SELECT
        TRIM(proc_disp) AS proc,
        CASE WHEN TRIM(out_time) ~ '^\\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2}'
             THEN TO_TIMESTAMP(TRIM(out_time), 'DD/MM/YYYY HH24:MI')
        END AS out_ts
      FROM smart.smart_fpc_output_by_lot
      WHERE ${gateExists()}
    )
    SELECT proc, COUNT(*) AS lot_count
    FROM parsed
    WHERE out_ts >= $1::timestamp
      AND out_ts < $2::timestamp
    GROUP BY proc
  `;
  const result = await query(sqlStatement, [`${prodDate} 08:00`, `${nextDay} 08:00`]);
  return new Map(result.rows.map((row) => [row.proc, Number(row.lot_count || 0)]));
}

// ----------------------------------------------------------------------------
// GET /dashboard-lots
// Fetch aggregated output data grouped by date and process, for Process Dashboard chart
// Supports: startDate+endDate, date, or month query params
// วันผลิตปัจจุบัน: actual_lot_qty = ค่าที่มากกว่าระหว่างตารางสรุป กับ smart_fpc_output_by_lot (real-time)
//   - process ที่ batch สรุปยังตามไม่ทัน จะได้ยอดตรงกับรายการ Lot No.
//   - process ที่ไม่มี process scan ใน output_by_lot (เช่น MELT1, MINT1) ยังใช้ยอดจากตารางสรุป
// วันในอดีต: ใช้ตารางสรุปตามเดิม (ตรวจแล้วตรงกับ output_by_lot ทุก process ที่มีข้อมูลทั้งสองฝั่ง)
// ----------------------------------------------------------------------------
router.get("/dashboard-lots", async (req, res) => {
  try {
    const { month, date, startDate, endDate, line, _t } = req.query;
    const gateOnly = req.query.gateOnly === "1";
    const cacheKey = `dashboard-lots:${startDate}:${endDate}:${date}:${month}:${line}:${gateOnly ? "gate" : "all"}`;

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

    // เฉพาะคู่ product + process ที่เป็น gate (gate_proc = 'Y')
    if (gateOnly) conditions.push(gateExists());

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sqlStatement = `
      ${gateOnly ? `WITH ${GATE_PAIRS_CTE}` : ""}
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

    // วันผลิตปัจจุบัน: ใช้ยอด lot ที่มากกว่าระหว่างตารางสรุปกับ output_by_lot
    // ทำเฉพาะ gateOnly และไม่ได้กรอง line เพราะ output_by_lot ไม่มี mc_line และ /process-lots กรองเฉพาะ gate
    const today = getCurrentProductionDate();
    const includesToday =
      (startDate && endDate && startDate <= today && today <= endDate) ||
      (!startDate && date === today) ||
      (!startDate && !date && month === today.slice(0, 7));
    if (gateOnly && (!line || line === "All Lines") && includesToday) {
      try {
        const scanCounts = await getScanLotCounts(today);
        result.rows.forEach((row) => {
          if (row.output_date !== today) return;
          const scanLots = scanCounts.get((row.process_name || "").trim()) || 0;
          row.actual_lot_qty = Math.max(Number(row.actual_lot_qty || 0), scanLots);
        });
      } catch (scanError) {
        // ถ้าดึงยอดจาก output_by_lot ไม่ได้ ใช้ยอดจากตารางสรุปตามเดิม
        console.error("[OutputByProcess] Error fetching scan lot counts:", scanError.message);
      }
    }

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

    const gateOnly = req.query.gateOnly === "1";
    if (gateOnly) conditions.push(gateExists());

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // TRIM + NULLIF: ชื่อ line ที่ต่างกันแค่ช่องว่าง หรือเป็นค่าว่าง จะไม่แยกเป็นคนละแถว (ตรงกับ /mcline-lots)
    const sqlStatement = `
      ${gateOnly ? `WITH ${GATE_PAIRS_CTE}` : ""}
      SELECT
        NULLIF(TRIM(mc_line), '') AS mc_line,
        SUM(COALESCE(pcs_qty, 0)) AS actual_pcs_qty,
        SUM(COALESCE(sht_qty, 0)) AS actual_sht_qty,
        SUM(COALESCE(lot_qty, 0)) AS actual_lot_qty
      FROM smart.smart_fpc_process_output_detail
      ${whereClause}
      GROUP BY NULLIF(TRIM(mc_line), '')
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
// lot ทุกแถวที่ออกจาก process ในช่วงวันผลิต จาก smart.smart_fpc_output_by_lot
// gate เท่านั้น, out_time startDate 08:00 -> (endDate + 1 วัน) 08:00, นับทุกแถว
// ใช้ร่วมกันระหว่าง /process-lots กับ /mcline-lots
// ----------------------------------------------------------------------------
async function queryProcessLots(processName, startDate, endDate) {
  // ตัดรอบวันผลิต 08:00 ถึง 08:00 ของวันถัดจาก endDate
  const end = new Date(`${endDate}T00:00:00Z`);
  const endPlusOne = new Date(end.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const values = [processName, `${startDate} 08:00`, `${endPlusOne} 08:00`];

  // out_time เป็น varchar — แปลงเฉพาะแถวที่รูปแบบถูกต้อง เพื่อไม่ให้แถวเสียทำให้ทั้ง query error
  // หน้า Output by Process แสดงเฉพาะ gate process — lot จึงกรองเฉพาะ product ที่ process นี้เป็น gate
  const sqlStatement = `
    WITH ${GATE_PAIRS_CTE},
    parsed AS (
      SELECT
        lot, wo, cat, prd_name, proc_disp, plan_date, in_time, out_time,
        input_qty, factory_desc, prbm_problem_name,
        CASE WHEN TRIM(out_time) ~ '^\\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2}'
             THEN TO_TIMESTAMP(TRIM(out_time), 'DD/MM/YYYY HH24:MI')
        END AS out_ts
      FROM smart.smart_fpc_output_by_lot
      WHERE TRIM(proc_disp) = $1
        AND ${gateExists()}
    )
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
    FROM parsed
    WHERE out_ts >= $2::timestamp
      AND out_ts < $3::timestamp
    ORDER BY out_ts ASC, lot ASC
  `;
  const result = await query(sqlStatement, values);
  return result.rows;
}

// ----------------------------------------------------------------------------
// GET /process-lots?process=FOST&startDate=YYYY-MM-DD[&endDate=YYYY-MM-DD]
// Fetch every lot that left one process within the production day(s)
// Source: smart.smart_fpc_output_by_lot (out_time is varchar 'DD/MM/YYYY HH24:MI')
// Production day cutoff: startDate 08:00 -> (endDate + 1 day) 08:00
// Cached for 60 seconds
// ----------------------------------------------------------------------------
router.get("/process-lots", async (req, res) => {
  try {
    const { process, startDate, _t } = req.query;
    const endDate = req.query.endDate || startDate;
    const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

    if (!process || !isDate(startDate) || !isDate(endDate) || endDate < startDate) {
      return res.status(400).json({ error: "process and startDate (YYYY-MM-DD) are required; endDate must be >= startDate" });
    }

    const processName = String(process).trim();
    const cacheKey = `processlots:gate:${processName}:${startDate}:${endDate}`;
    if (!_t) {
      const cached = getCached(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(cached);
      }
    }

    const rows = await queryProcessLots(processName, startDate, endDate);

    setCache(cacheKey, rows, 60_000);
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(rows);
  } catch (error) {
    console.error("[OutputByProcess] Error fetching process-lots:", error.message);
    res.status(500).json({ error: "Cannot fetch lot data" });
  }
});

// ----------------------------------------------------------------------------
// POST /line-lots
// body: { startDate: YYYY-MM-DD, endDate?: YYYY-MM-DD, pairs: [{ product, process }], _t? }
// Fetch every lot of the given product + process pairs within the production day(s), for By Line
// smart_fpc_output_by_lot ไม่มี mc_line — frontend ส่งคู่ product + process ของแถวที่จัดเข้า line นั้นมาให้
// ไม่กรอง gate เพราะคอลัมน์ LOT ของ By Line รวมทุก process
// Production day cutoff: startDate 08:00 -> (endDate + 1 day) 08:00
// Cached for 60 seconds
// ----------------------------------------------------------------------------
router.post("/line-lots", async (req, res) => {
  try {
    const { startDate, pairs, _t } = req.body || {};
    const endDate = req.body?.endDate || startDate;
    const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

    if (!isDate(startDate) || !isDate(endDate) || endDate < startDate) {
      return res.status(400).json({ error: "startDate (YYYY-MM-DD) is required; endDate must be >= startDate" });
    }
    if (!Array.isArray(pairs) || pairs.length === 0 || pairs.length > 1000) {
      return res.status(400).json({ error: "pairs must be a non-empty array (max 1000)" });
    }

    // prd_name แต่ละตารางเก็บทั้งแบบมีขีดและไม่มีขีด — ตัด '-' ออกก่อนเทียบ
    const keySet = new Set();
    pairs.forEach((p) => {
      const product = String(p?.product || "").trim().replace(/-/g, "");
      const process = String(p?.process || "").trim();
      if (product && process) keySet.add(`${product}\u0000${process}`);
    });
    if (keySet.size === 0) return res.status(200).json([]);

    const sortedKeys = Array.from(keySet).sort();
    const cacheKey = `linelots:${startDate}:${endDate}:${sortedKeys.join("|")}`;
    if (!_t) {
      const cached = getCached(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(cached);
      }
    }

    const products = sortedKeys.map((k) => k.split("\u0000")[0]);
    const processes = sortedKeys.map((k) => k.split("\u0000")[1]);
    const end = new Date(`${endDate}T00:00:00Z`);
    const endPlusOne = new Date(end.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // out_time เป็น varchar — แปลงเฉพาะแถวที่รูปแบบถูกต้อง เพื่อไม่ให้แถวเสียทำให้ทั้ง query error
    const sqlStatement = `
      WITH pairs AS (
        SELECT DISTINCT prd_key, proc
        FROM UNNEST($1::text[], $2::text[]) AS p(prd_key, proc)
      ),
      parsed AS (
        SELECT
          l.lot, l.wo, l.cat, l.prd_name, l.proc_disp, l.plan_date, l.in_time, l.out_time,
          l.input_qty, l.factory_desc, l.prbm_problem_name,
          CASE WHEN TRIM(l.out_time) ~ '^\\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2}'
               THEN TO_TIMESTAMP(TRIM(l.out_time), 'DD/MM/YYYY HH24:MI')
          END AS out_ts
        FROM smart.smart_fpc_output_by_lot l
        JOIN pairs p
          ON p.prd_key = REPLACE(TRIM(l.prd_name), '-', '')
         AND p.proc = TRIM(l.proc_disp)
      )
      SELECT
        lot,
        wo,
        cat,
        prd_name AS product_name,
        TRIM(proc_disp) AS process_name,
        TO_CHAR(plan_date, 'YYYY-MM-DD') AS plan_date,
        in_time,
        out_time,
        input_qty,
        factory_desc,
        prbm_problem_name
      FROM parsed
      WHERE out_ts >= $3::timestamp
        AND out_ts < $4::timestamp
      ORDER BY TRIM(proc_disp) ASC, out_ts ASC, lot ASC
    `;
    const result = await query(sqlStatement, [products, processes, `${startDate} 08:00`, `${endPlusOne} 08:00`]);

    setCache(cacheKey, result.rows, 60_000);
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("[OutputByProcess] Error fetching line-lots:", error.message);
    res.status(500).json({ error: "Cannot fetch lot data" });
  }
});

// ----------------------------------------------------------------------------
// ตารางที่เก็บเลข lot คู่กับ line / เครื่อง — ใช้ระบุ MC Line ของ lot ใน /mcline-lots
// แต่ละ query คืน lot, proc (process ของแถวนั้น), line, machine
// ----------------------------------------------------------------------------
const LOT_LINE_SOURCES = [
  {
    name: "fake_scan",
    sql: `
      SELECT TRIM(lot_no::text) AS lot, TRIM(proc_disp::text) AS proc,
             TRIM(line_no::text) AS line, TRIM(machine_no::text) AS machine
      FROM smart.smart_fpc_fake_scan
      WHERE TRIM(lot_no::text) = ANY($1::text[])
    `,
  },
  {
    name: "trace_tools",
    sql: `
      SELECT TRIM(ttl_lot_mos::text) AS lot, TRIM(ttl_process::text) AS proc,
             TRIM(ttl_mc_no::text) AS line, NULL AS machine
      FROM smart.smart_fpct_trace_tools_lot
      WHERE TRIM(ttl_lot_mos::text) = ANY($1::text[])
    `,
  },
  {
    name: "lot_machine",
    sql: `
      SELECT TRIM(lot::text) AS lot, TRIM(proc_id::text) AS proc,
             TRIM(mc_code::text) AS line, NULL AS machine
      FROM smart.smart_fpc_lot_machine
      WHERE TRIM(lot::text) = ANY($1::text[])
    `,
  },
  {
    name: "reject",
    sql: `
      SELECT TRIM(rejh_lotno::text) AS lot, TRIM(rejh_location::text) AS proc,
             TRIM(rejh_line::text) AS line, NULL AS machine
      FROM smart.smart_fpc_reject_header
      WHERE TRIM(rejh_lotno::text) = ANY($1::text[])
    `,
  },
];

// query ที่กำหนด statement_timeout ฝั่ง database — ตารางอ้างอิง lot ใหญ่และค้นด้วย TRIM (ไม่ใช้ index)
// เกินเวลาให้ database ยกเลิก query เอง ไม่ปล่อยให้ค้างกินทรัพยากร
async function queryWithTimeout(text, params, timeoutMs) {
  const client = await pool_smart.connect();
  let resetOk = false;
  try {
    await client.query(`SET statement_timeout = ${Number(timeoutMs)}`);
    const result = await client.query(text, params);
    return result;
  } finally {
    try {
      await client.query("RESET statement_timeout");
      resetOk = true;
    } catch (resetError) {
      console.error("[OutputByProcess] Cannot reset statement_timeout:", resetError.message);
    }
    // reset ไม่สำเร็จ: ทิ้ง connection นี้ ไม่คืนเข้า pool พร้อม timeout ค้าง
    client.release(!resetOk);
  }
}

// ชื่อ line สำหรับเทียบข้ามตาราง: ตัวพิมพ์ใหญ่ ไม่มีช่องว่าง / '-' / '_'
const toLineKey = (value) => String(value || "").toUpperCase().replace(/[\s_-]+/g, "");

// ----------------------------------------------------------------------------
// GET /mcline-lots?process=FFPC&startDate=YYYY-MM-DD[&endDate=YYYY-MM-DD]
// Lot No. ของทุก MC Line ใน process เดียว — สำหรับ MC Line Details
// smart_fpc_output_by_lot ไม่มี mc_line จึงระบุ line ของแต่ละ lot ตามลำดับ:
//   1. ตารางใน LOT_LINE_SOURCES — แถวของ process เดียวกันเชื่อได้มากกว่าแถวของ process อื่น
//      (แถวของ process อื่นใช้ได้เฉพาะเมื่อชี้ไปที่ line ที่ product นี้ผลิตจริงในวันนั้น)
//   2. product ที่วันนั้นผลิตบน MC Line เดียว
//   3. product ที่เหลือ line เดียวที่ยอด lot ยังไม่ครบ (หักจำนวนที่ระบุได้จากข้อ 1 แล้ว)
// lot ที่ยังระบุไม่ได้: mc_line = null พร้อม candidate_lines (line ที่เป็นไปได้)
// คืนค่า { lots, sources } — sources บอกว่าตารางอ้างอิงแต่ละตัว query สำเร็จหรือไม่
// Cache: 10 นาทีสำหรับวันในอดีต, 60 วินาทีเมื่อช่วงวันมีวันผลิตปัจจุบัน
// ----------------------------------------------------------------------------
router.get("/mcline-lots", async (req, res) => {
  try {
    const { process, startDate, _t } = req.query;
    const endDate = req.query.endDate || startDate;
    const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

    if (!process || !isDate(startDate) || !isDate(endDate) || endDate < startDate) {
      return res.status(400).json({ error: "process and startDate (YYYY-MM-DD) are required; endDate must be >= startDate" });
    }

    const processName = String(process).trim();
    const cacheKey = `mclinelots:${processName}:${startDate}:${endDate}`;
    if (!_t) {
      const cached = getCached(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(cached);
      }
    }

    // ยอด lot ต่อ product + MC Line จากตารางสรุป (เงื่อนไขเดียวกับ /dashboard-mcline ที่ gateOnly)
    const endPlusOne = new Date(new Date(`${endDate}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0];
    const [quotaResult, lotRows] = await Promise.all([
      query(`
        WITH ${GATE_PAIRS_CTE}
        SELECT
          REPLACE(TRIM(prd_name), '-', '') AS prd_key,
          COALESCE(NULLIF(TRIM(mc_line), ''), 'Unknown') AS mc_line,
          SUM(COALESCE(lot_qty, 0)) AS lot_qty
        FROM smart.smart_fpc_process_output_detail
        WHERE output_date >= $1
          AND output_date < $2
          AND TRIM(proc_disp) = $3
          AND ${gateExists()}
        GROUP BY 1, 2
      `, [startDate, endPlusOne, processName]),
      queryProcessLots(processName, startDate, endDate),
    ]);

    // processLines: line key -> ชื่อ MC Line ของ process นี้
    // productLines: product -> (line key -> ชื่อ MC Line), productQuota: product -> (ชื่อ MC Line -> ยอด lot)
    const processLines = new Map();
    const productLines = new Map();
    const productQuota = new Map();
    quotaResult.rows.forEach((row) => {
      const key = toLineKey(row.mc_line);
      processLines.set(key, row.mc_line);
      if (!productLines.has(row.prd_key)) {
        productLines.set(row.prd_key, new Map());
        productQuota.set(row.prd_key, new Map());
      }
      productLines.get(row.prd_key).set(key, row.mc_line);
      const quota = productQuota.get(row.prd_key);
      quota.set(row.mc_line, (quota.get(row.mc_line) || 0) + Number(row.lot_qty || 0));
    });

    // ค้นตารางอ้างอิงทุกตัวพร้อมกัน — ตัวไหน error (เช่น ชื่อคอลัมน์ไม่ตรง) ข้ามไป ไม่ทำให้ทั้ง endpoint ล้ม
    const processKey = toLineKey(processName);
    const lotNos = Array.from(new Set(lotRows.map((row) => String(row.lot || "").trim()).filter(Boolean)));
    const hintsByLot = new Map(); // lot -> [{ key, source, sameProcess }]
    const sources = {};
    await Promise.all(LOT_LINE_SOURCES.map(async (source) => {
      if (lotNos.length === 0) {
        sources[source.name] = "skipped";
        return;
      }
      try {
        const { rows } = await queryWithTimeout(source.sql, [lotNos], 15_000);
        rows.forEach((row) => {
          if (!row.lot) return;
          const sameProcess = toLineKey(row.proc) === processKey;
          if (!hintsByLot.has(row.lot)) hintsByLot.set(row.lot, []);
          [row.line, row.machine].forEach((value) => {
            const key = toLineKey(value);
            if (key) hintsByLot.get(row.lot).push({ key, source: source.name, sameProcess });
          });
        });
        sources[source.name] = "ok";
      } catch (sourceError) {
        console.error(`[OutputByProcess] mcline-lots: ${source.name} lookup failed:`, sourceError.message);
        sources[source.name] = "error";
      }
    }));

    // MC Line ที่ hint ชี้ไป เฉพาะที่อยู่ใน allowed (line key -> ชื่อ) — คืน Map ชื่อ MC Line -> ตารางที่ใช้ระบุ
    const matchLines = (hints, allowed) => {
      const found = new Map();
      hints.forEach((hint) => {
        const name = allowed.get(hint.key);
        if (name && !found.has(name)) found.set(name, hint.source);
      });
      return found;
    };

    // ขั้นที่ 1: ระบุจากตารางอ้างอิง
    const emptyLines = new Map();
    const lots = lotRows.map((row) => {
      const prdKey = String(row.product_name || "").trim().replace(/-/g, "");
      const candidates = productLines.get(prdKey) || emptyLines;
      const hints = hintsByLot.get(String(row.lot || "").trim()) || [];
      const sameHints = hints.filter((hint) => hint.sameProcess);
      const otherHints = hints.filter((hint) => !hint.sameProcess);

      let found = matchLines(sameHints, processLines);
      // process เดียวกันชี้หลาย line — ตัดเหลือเฉพาะ line ที่ product นี้ผลิตจริง
      if (found.size > 1) found = matchLines(sameHints, candidates);
      if (found.size === 0) found = matchLines(otherHints, candidates);

      const assigned = found.size === 1 ? Array.from(found.entries())[0] : null;
      return {
        ...row,
        prd_key: prdKey,
        mc_line: assigned ? assigned[0] : null,
        line_source: assigned ? assigned[1] : null,
        candidate_lines: [],
      };
    });

    // ขั้นที่ 2-3: lot ที่เหลือ ระบุด้วยยอด lot ของแต่ละ line ในตารางสรุป
    const unresolvedByProduct = new Map();
    const assignedCount = new Map(); // `${prd_key}|${mc_line}` -> จำนวน lot ที่ระบุจากตารางอ้างอิงแล้ว
    lots.forEach((lot) => {
      if (lot.mc_line) {
        const countKey = `${lot.prd_key}|${lot.mc_line}`;
        assignedCount.set(countKey, (assignedCount.get(countKey) || 0) + 1);
        return;
      }
      if (!unresolvedByProduct.has(lot.prd_key)) unresolvedByProduct.set(lot.prd_key, []);
      unresolvedByProduct.get(lot.prd_key).push(lot);
    });

    unresolvedByProduct.forEach((pending, prdKey) => {
      const quota = productQuota.get(prdKey);
      if (!quota) return; // product ไม่มีในตารางสรุป — ไม่มี line ให้เลือก

      const lineNames = Array.from(quota.keys());
      if (lineNames.length === 1) {
        pending.forEach((lot) => {
          lot.mc_line = lineNames[0];
          lot.line_source = "single_line";
        });
        return;
      }

      const openLines = lineNames
        .map((name) => ({ name, remaining: quota.get(name) - (assignedCount.get(`${prdKey}|${name}`) || 0) }))
        .filter((line) => line.remaining > 0);
      if (openLines.length === 1 && pending.length <= openLines[0].remaining) {
        pending.forEach((lot) => {
          lot.mc_line = openLines[0].name;
          lot.line_source = "remainder";
        });
        return;
      }

      // เหลือหลาย line ที่ยอดยังไม่ครบ: lot อยู่ได้แค่ line เหล่านั้น
      // ไม่มี line ว่าง หรือ lot เกินยอดที่เหลือ (ตารางสรุปยังไม่ครบ): อาจอยู่ line ไหนก็ได้ของ product นี้
      const candidateLines = (openLines.length > 1 ? openLines.map((line) => line.name) : lineNames).sort();
      pending.forEach((lot) => {
        lot.candidate_lines = candidateLines;
      });
    });

    const payload = {
      lots: lots.map(({ prd_key, ...lot }) => lot),
      sources,
    };

    const isPastRange = endDate < getCurrentProductionDate();
    setCache(cacheKey, payload, isPastRange ? 10 * 60_000 : 60_000);
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(payload);
  } catch (error) {
    console.error("[OutputByProcess] Error fetching mcline-lots:", error.message);
    res.status(500).json({ error: "Cannot fetch MC Line lot data" });
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

// ----------------------------------------------------------------------------
// GET /process-products?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD[&process=A,B]
// Output grouped by date, product, process and MC Line — for the Output by Process page
// Same data as /outputbyproduct/dashboard-products plus is_gate (gate_proc = 'Y'),
// kept here so this page does not depend on the Output by Product API
// Cached for 60 seconds
// ----------------------------------------------------------------------------
router.get("/process-products", async (req, res) => {
  try {
    const { startDate, endDate, process, _t } = req.query;
    const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

    if (!isDate(startDate) || !isDate(endDate) || endDate < startDate) {
      return res.status(400).json({ error: "startDate and endDate (YYYY-MM-DD) are required; endDate must be >= startDate" });
    }

    const cacheKey = `process-products:${startDate}:${endDate}:${process || ""}`;
    if (!_t) {
      const cached = getCached(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(cached);
      }
    }

    const values = [];
    const conditions = [];

    if (process && process !== "All processes") {
      const placeholders = String(process).split(",").map((p) => {
        values.push(p);
        return `$${values.length}`;
      }).join(",");
      conditions.push(`proc_disp IN (${placeholders})`);
    }

    // ใช้ช่วงวันที่แบบ >= start AND < end เพื่อให้ใช้ index ของ output_date ได้
    const endPlusOne = new Date(new Date(`${endDate}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0];
    values.push(startDate);
    conditions.push(`output_date >= $${values.length}`);
    values.push(endPlusOne);
    conditions.push(`output_date < $${values.length}`);

    // is_gate: คู่ product + process นี้เป็น gate หรือไม่ — ไม่ตัดแถวทิ้ง เพราะมุมมอง By Line ยังใช้ทุกแถว
    const sqlStatement = `
      WITH ${GATE_PAIRS_CTE}
      SELECT
        TO_CHAR(output_date, 'YYYY-MM-DD') AS output_date,
        prd_name AS product_name,
        proc_disp AS process_name,
        mc_line,
        ${gateExists()} AS is_gate,
        SUM(COALESCE(pcs_qty, 0)) AS actual_pcs_qty,
        SUM(COALESCE(sht_qty, 0)) AS actual_sht_qty,
        SUM(COALESCE(lot_qty, 0)) AS actual_lot_qty
      FROM smart.smart_fpc_process_output_detail
      WHERE ${conditions.join(" AND ")}
      GROUP BY TO_CHAR(output_date, 'YYYY-MM-DD'), prd_name, proc_disp, mc_line
      ORDER BY output_date ASC
    `;
    const result = await query(sqlStatement, values);

    setCache(cacheKey, result.rows, 60_000);
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("[OutputByProcess] Error fetching process-products:", error.message);
    res.status(500).json({ error: "Cannot fetch process product data" });
  }
});

module.exports = router;
