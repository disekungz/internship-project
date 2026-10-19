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
// ชุดของ process ที่มีการสแกนลง smart_fpc_output_by_lot และชุดของ process ในตารางสรุป
// แคชไว้ 10 นาที เพื่อแยก process ที่มี scan (ใช้อ้างอิงยอดวันปัจจุบันจาก output_by_lot)
// ออกจาก process ที่ไม่มี scan เลย เช่น MELT1, MINT1, MFLD1 (ยังคงใช้ยอดจากตารางสรุป)
// ----------------------------------------------------------------------------
let scanProcessMetaCache = null;
let scanProcessMetaLastFetch = 0;

async function getScanProcessMeta() {
  const now = Date.now();
  if (scanProcessMetaCache && now - scanProcessMetaLastFetch < 10 * 60_000) {
    return scanProcessMetaCache;
  }
  const [scanRes, detailRes] = await Promise.all([
    query(`
      SELECT DISTINCT TRIM(proc_disp) AS proc
      FROM smart.smart_fpc_output_by_lot
      WHERE proc_disp IS NOT NULL
    `),
    query(`
      SELECT DISTINCT TRIM(proc_disp) AS proc
      FROM smart.smart_fpc_process_output_detail
      WHERE proc_disp IS NOT NULL
    `),
  ]);
  scanProcessMetaCache = {
    scanProcessSet: new Set(scanRes.rows.map((r) => r.proc).filter(Boolean)),
    detailProcessSet: new Set(detailRes.rows.map((r) => r.proc).filter(Boolean)),
  };
  scanProcessMetaLastFetch = now;
  return scanProcessMetaCache;
}

// แปลง YYYY-MM-DD เป็น DD/MM/YYYY สำหรับกรอง LEFT(TRIM(out_time), 10) ก่อนแปลงเป็น timestamp
function toDdMmYyyy(isoDate) {
  const [y, m, d] = String(isoDate).split("-");
  return `${d}/${m}/${y}`;
}

// ----------------------------------------------------------------------------
// ข้อมูลจำนวน lot ของวันผลิตหนึ่งวัน จาก smart.smart_fpc_output_by_lot
// ใช้เงื่อนไขเวลาเดียวกับ /process-lots (out_time 08:00 -> 08:00 วันถัดไป, นับทุกแถว)
// คืนค่า:
//   - gateByProcess: Map<proc, lot_count> (เฉพาะคู่ product + process ที่เป็น gate)
//   - allByProcess:  Map<proc, lot_count> (ทุกแถว)
//   - byPair:        Map<`${prd_key}|${proc}`, { prd_key, product_name, proc, is_gate, lot_count }>
// ----------------------------------------------------------------------------
async function getScanLotDataForDate(prodDate) {
  const cacheKey = `scan-lot-data:${prodDate}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const nextDay = new Date(new Date(`${prodDate}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0];
  const datePrefixes = [toDdMmYyyy(prodDate), toDdMmYyyy(nextDay)];

  const sqlStatement = `
    WITH ${GATE_PAIRS_CTE},
    parsed AS (
      SELECT
        REPLACE(TRIM(prd_name), '-', '') AS prd_key,
        TRIM(prd_name) AS prd_name,
        TRIM(proc_disp) AS proc,
        ${gateExists("prd_name", "proc_disp")} AS is_gate,
        CASE WHEN TRIM(out_time) ~ '^\\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2}'
             THEN TO_TIMESTAMP(TRIM(out_time), 'DD/MM/YYYY HH24:MI')
        END AS out_ts
      FROM smart.smart_fpc_output_by_lot
      WHERE LEFT(TRIM(out_time), 10) = ANY($3::text[])
    )
    SELECT
      prd_key,
      MAX(prd_name) AS product_name,
      proc,
      BOOL_OR(is_gate) AS is_gate,
      COUNT(*) AS lot_count
    FROM parsed
    WHERE out_ts >= $1::timestamp
      AND out_ts < $2::timestamp
    GROUP BY prd_key, proc
  `;
  const result = await query(sqlStatement, [`${prodDate} 08:00`, `${nextDay} 08:00`, datePrefixes]);

  const gateByProcess = new Map();
  const allByProcess = new Map();
  const byPair = new Map();

  result.rows.forEach((row) => {
    const proc = row.proc;
    const count = Number(row.lot_count || 0);
    if (!proc || count <= 0) return;

    allByProcess.set(proc, (allByProcess.get(proc) || 0) + count);
    if (row.is_gate) {
      gateByProcess.set(proc, (gateByProcess.get(proc) || 0) + count);
    }
    byPair.set(`${row.prd_key}|${proc}`, {
      prd_key: row.prd_key,
      product_name: row.product_name,
      proc,
      is_gate: Boolean(row.is_gate),
      lot_count: count,
    });
  });

  const data = { gateByProcess, allByProcess, byPair };
  setCache(cacheKey, data, 30_000);
  return data;
}

// ----------------------------------------------------------------------------
// ปรับยอด lot_qty ของแถวระดับ (product, process, mc_line) ในวันผลิตปัจจุบันให้ตรงกับ smart_fpc_output_by_lot
// - เฉพาะ process ที่มีการสแกนลง output_by_lot (scanProcessSet) เท่านั้นที่จะใช้ยอดจาก output_by_lot
// - process ที่ไม่มีการสแกนลง output_by_lot (เช่น MELT1, MINT1, MFLD1) ยังคงใช้ยอดจากตารางสรุปตามเดิม
// ----------------------------------------------------------------------------
function applyTodayScanLotsToProductRows(rows, today, scanData, scanMeta, options = {}) {
  const { scanProcessSet, detailProcessSet } = scanMeta;
  const { byPair } = scanData;
  const { allowedProcesses = null, includeMissingPairs = true, gateOnly = false } = options;

  // จัดกลุ่มแถวของวันนี้ตาม `${prd_key}|${proc}`
  const groupsByPair = new Map();
  rows.forEach((row) => {
    if (row.output_date !== today) return;
    const proc = String(row.process_name || "").trim();
    const prdKey = String(row.product_name || "").trim().replace(/-/g, "");
    if (!proc || !prdKey) return;
    const key = `${prdKey}|${proc}`;
    if (!groupsByPair.has(key)) groupsByPair.set(key, []);
    groupsByPair.get(key).push(row);
  });

  // ปรับยอดของคู่ที่มีอยู่ในตารางสรุปวันนี้
  groupsByPair.forEach((groupRows, pairKey) => {
    const proc = String(groupRows[0].process_name || "").trim();
    if (!scanProcessSet.has(proc)) return; // process ที่ไม่มี scan (เช่น MELT1, MINT1) ใช้ยอดจากตารางสรุปเดิม

    const scanLots = byPair.get(pairKey)?.lot_count || 0;
    if (groupRows.length === 1) {
      groupRows[0].actual_lot_qty = scanLots;
      return;
    }

    const detailSum = groupRows.reduce((sum, r) => sum + Number(r.actual_lot_qty || 0), 0);
    if (detailSum === scanLots) return;
    if (scanLots === 0) {
      groupRows.forEach((r) => {
        r.actual_lot_qty = 0;
      });
      return;
    }

    // กรณีคู่เดียวผลิตหลาย mc_line และยอดรวมยังไม่ตรงกับ output_by_lot: ปรับตามสัดส่วนให้ผลรวมเท่ากับ scanLots พอดี
    let remaining = scanLots;
    groupRows.forEach((r, idx) => {
      if (idx === groupRows.length - 1) {
        r.actual_lot_qty = Math.max(0, remaining);
      } else if (detailSum > 0) {
        const share = Math.min(remaining, Math.round((Number(r.actual_lot_qty || 0) / detailSum) * scanLots));
        r.actual_lot_qty = share;
        remaining -= share;
      } else {
        r.actual_lot_qty = 0;
      }
    });
  });

  // เพิ่มแถวสำหรับคู่ (product, process) ที่มี scan ใน output_by_lot วันนี้แล้ว แต่ตารางสรุปยังไม่มีแถว
  if (includeMissingPairs) {
    byPair.forEach((pairInfo, pairKey) => {
      if (groupsByPair.has(pairKey)) return;
      if (!detailProcessSet.has(pairInfo.proc)) return;
      if (gateOnly && !pairInfo.is_gate) return;
      if (allowedProcesses && !allowedProcesses.has(pairInfo.proc)) return;

      rows.push({
        output_date: today,
        product_name: pairInfo.product_name,
        process_name: pairInfo.proc,
        mc_line: null,
        is_gate: pairInfo.is_gate,
        actual_pcs_qty: 0,
        actual_sht_qty: 0,
        actual_lot_qty: pairInfo.lot_count,
      });
    });
  }
}

// ----------------------------------------------------------------------------
// GET /dashboard-lots
// Fetch aggregated output data grouped by date and process, for Process Dashboard chart
// Supports: startDate+endDate, date, or month query params
// วันผลิตปัจจุบัน:
//   - process ที่มีใน smart_fpc_output_by_lot ใช้ยอด lot จาก smart_fpc_output_by_lot โดยตรง
//   - process ที่ไม่มี process scan ใน output_by_lot (เช่น MELT1, MINT1) ยังใช้ยอดจากตารางสรุป
// วันในอดีต: ใช้ตารางสรุปตามเดิม
// ----------------------------------------------------------------------------
router.get("/dashboard-lots", async (req, res) => {
  try {
    const { month, date, startDate, endDate, line, _t } = req.query;
    const gateOnly = req.query.gateOnly === "1";
    const cacheKey = `dashboard-lots:${startDate}:${endDate}:${date}:${month}:${line}:${gateOnly ? "gate" : "all"}`;

    if (!_t) {
      const cached = getCached(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(cached);
      }
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

    // วันผลิตปัจจุบัน: ดึงยอด lot จาก smart_fpc_output_by_lot สำหรับทุก process ที่มีการสแกนลง output_by_lot
    // ส่วน process ที่ไม่มีการสแกนลง output_by_lot (เช่น MELT1, MINT1) ยังคงใช้ยอดจากตารางสรุป
    const today = getCurrentProductionDate();
    const includesToday =
      (startDate && endDate && startDate <= today && today <= endDate) ||
      (!startDate && date === today) ||
      (!startDate && !date && month === today.slice(0, 7));
    if ((!line || line === "All Lines") && includesToday) {
      try {
        const [scanData, scanMeta] = await Promise.all([
          getScanLotDataForDate(today),
          getScanProcessMeta(),
        ]);
        const scanCounts = gateOnly ? scanData.gateByProcess : scanData.allByProcess;
        const { scanProcessSet, detailProcessSet } = scanMeta;
        const seenTodayProcs = new Set();

        result.rows.forEach((row) => {
          if (row.output_date !== today) return;
          const proc = (row.process_name || "").trim();
          seenTodayProcs.add(proc);
          if (scanProcessSet.has(proc)) {
            row.actual_lot_qty = scanCounts.get(proc) || 0;
          }
        });

        // กรณีวันนี้มี lot สแกนใน output_by_lot แล้ว แต่ตารางสรุปยังไม่มีแถวของ process นั้นในวันนี้
        const activeProductsCount = result.rows[0]?.active_products_count || 0;
        scanCounts.forEach((lotCount, proc) => {
          if (lotCount <= 0 || seenTodayProcs.has(proc)) return;
          if (!detailProcessSet.has(proc)) return;
          result.rows.push({
            output_date: today,
            process_name: proc,
            mcline_count: 0,
            mc_lines: null,
            actual_pcs_qty: 0,
            actual_sht_qty: 0,
            actual_lot_qty: lotCount,
            active_products_count: activeProductsCount,
          });
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
// วันผลิตปัจจุบัน: ยอด lot ของแต่ละ MC Line คำนวณจาก smart_fpc_output_by_lot (ผ่าน assignLotMcLines)
// ให้ตรงกับรายการ Lot No. ใน /mcline-lots
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

    const today = getCurrentProductionDate();
    const includesToday =
      (startDate && endDate && startDate <= today && today <= endDate) ||
      (!startDate && date === today) ||
      (!startDate && !date && month === today.slice(0, 7));

    // TRIM + NULLIF: ชื่อ line ที่ต่างกันแค่ช่องว่าง หรือเป็นค่าว่าง จะไม่แยกเป็นคนละแถว (ตรงกับ /mcline-lots)
    const sqlStatement = `
      ${gateOnly ? `WITH ${GATE_PAIRS_CTE}` : ""}
      SELECT
        TO_CHAR(output_date, 'YYYY-MM-DD') AS output_date,
        prd_name AS product_name,
        proc_disp AS process_name,
        NULLIF(TRIM(mc_line), '') AS mc_line,
        SUM(COALESCE(pcs_qty, 0)) AS actual_pcs_qty,
        SUM(COALESCE(sht_qty, 0)) AS actual_sht_qty,
        SUM(COALESCE(lot_qty, 0)) AS actual_lot_qty
      FROM smart.smart_fpc_process_output_detail
      ${whereClause}
      GROUP BY TO_CHAR(output_date, 'YYYY-MM-DD'), prd_name, proc_disp, NULLIF(TRIM(mc_line), '')
    `;
    const result = await query(sqlStatement, values);

    if (includesToday) {
      try {
        const [scanData, scanMeta] = await Promise.all([
          getScanLotDataForDate(today),
          getScanProcessMeta(),
        ]);
        const allowedProcesses = process ? new Set([String(process).trim()]) : null;
        applyTodayScanLotsToProductRows(result.rows, today, scanData, scanMeta, {
          allowedProcesses,
          includeMissingPairs: Boolean(process),
          gateOnly,
        });
      } catch (scanError) {
        console.error("[OutputByProcess] Error applying today scan lots in dashboard-mcline:", scanError.message);
      }
    }

    const byMcLine = new Map();
    result.rows.forEach((row) => {
      const key = row.mc_line || null;
      if (!byMcLine.has(key)) {
        byMcLine.set(key, {
          mc_line: key,
          actual_pcs_qty: 0,
          actual_sht_qty: 0,
          actual_lot_qty: 0,
        });
      }
      const agg = byMcLine.get(key);
      agg.actual_pcs_qty += Number(row.actual_pcs_qty || 0);
      agg.actual_sht_qty += Number(row.actual_sht_qty || 0);
      agg.actual_lot_qty += Number(row.actual_lot_qty || 0);
    });

    const rows = Array.from(byMcLine.values()).sort((a, b) =>
      String(a.mc_line || "").localeCompare(String(b.mc_line || ""))
    );
    res.status(200).json(rows);
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
// GET /lot-search?lot=ABC123&startDate=YYYY-MM-DD[&endDate=YYYY-MM-DD]
// ค้นหา Lot No. ว่าออกจาก gate process ไหนบ้างในช่วงวันผลิต — สำหรับช่องค้นหาใน Process Output Details
// เงื่อนไขเดียวกับ /process-lots (gate เท่านั้น, out_time startDate 08:00 -> (endDate + 1 วัน) 08:00)
// ค้นแบบมีคำค้นอยู่ในเลข lot (ไม่สนตัวพิมพ์), อย่างน้อย 3 ตัวอักษร, คืนไม่เกิน LOT_SEARCH_LIMIT แถว
// คืนค่า { lots, truncated } — Cached for 60 seconds
// ----------------------------------------------------------------------------
const LOT_SEARCH_LIMIT = 200;
const LOT_SEARCH_MAX_DAYS = 62;

router.get("/lot-search", async (req, res) => {
  try {
    const { startDate, _t } = req.query;
    const endDate = req.query.endDate || startDate;
    const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const term = typeof req.query.lot === "string" ? req.query.lot.trim() : "";

    if (term.length < 3 || !isDate(startDate) || !isDate(endDate) || endDate < startDate) {
      return res.status(400).json({ error: "lot (at least 3 characters) and startDate (YYYY-MM-DD) are required; endDate must be >= startDate" });
    }

    // วันที่ทุกวันตั้งแต่ startDate ถึง endDate + 1 วัน — ใช้กรอง LEFT(TRIM(out_time), 10) ก่อนแปลงเป็น timestamp
    const DAY_MS = 24 * 60 * 60 * 1000;
    const startMs = new Date(`${startDate}T00:00:00Z`).getTime();
    const endPlusOneMs = new Date(`${endDate}T00:00:00Z`).getTime() + DAY_MS;
    if ((endPlusOneMs - startMs) / DAY_MS > LOT_SEARCH_MAX_DAYS) {
      return res.status(400).json({ error: `date range must not exceed ${LOT_SEARCH_MAX_DAYS} days` });
    }
    const datePrefixes = [];
    for (let t = startMs; t <= endPlusOneMs; t += DAY_MS) {
      datePrefixes.push(toDdMmYyyy(new Date(t).toISOString().split("T")[0]));
    }
    const endPlusOne = new Date(endPlusOneMs).toISOString().split("T")[0];

    const cacheKey = `lotsearch:${term.toUpperCase()}:${startDate}:${endDate}`;
    if (!_t) {
      const cached = getCached(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(cached);
      }
    }

    // escape อักขระพิเศษของ LIKE ในคำค้น
    const likePattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const result = await query(`
      WITH ${GATE_PAIRS_CTE},
      parsed AS (
        SELECT
          TRIM(lot) AS lot, wo, cat, prd_name, TRIM(proc_disp) AS proc_disp, plan_date, in_time, out_time,
          input_qty, factory_desc, prbm_problem_name,
          CASE WHEN TRIM(out_time) ~ '^\\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2}'
               THEN TO_TIMESTAMP(TRIM(out_time), 'DD/MM/YYYY HH24:MI')
          END AS out_ts
        FROM smart.smart_fpc_output_by_lot
        WHERE TRIM(lot) ILIKE $1
          AND LEFT(TRIM(out_time), 10) = ANY($4::text[])
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
      ORDER BY lot ASC, out_ts ASC
      LIMIT ${LOT_SEARCH_LIMIT + 1}
    `, [likePattern, `${startDate} 08:00`, `${endPlusOne} 08:00`, datePrefixes]);

    const payload = {
      lots: result.rows.slice(0, LOT_SEARCH_LIMIT),
      truncated: result.rows.length > LOT_SEARCH_LIMIT,
    };
    setCache(cacheKey, payload, 60_000);
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(payload);
  } catch (error) {
    console.error("[OutputByProcess] Error searching lot:", error.message);
    res.status(500).json({ error: "Cannot search lot data" });
  }
});

// ----------------------------------------------------------------------------
// ตารางที่เก็บเลข lot คู่กับ line / เครื่อง — ใช้ระบุ MC Line ของ lot ใน assignLotMcLines
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

// ชื่อ line / process สำหรับเทียบข้ามตาราง: ตัวพิมพ์ใหญ่ ไม่มีช่องว่าง / '-' / '_'
const toLineKey = (value) => String(value || "").toUpperCase().replace(/[\s_-]+/g, "");

// ----------------------------------------------------------------------------
// ระบุ MC Line ของแต่ละ lot (smart_fpc_output_by_lot ไม่มี mc_line) — ใช้ร่วมกันระหว่าง /mcline-lots กับ /line-lots
// lotRows: แถวจาก output_by_lot (ต้องมี lot, product_name, process_name)
// quotaRows: ยอด lot จากตารางสรุป { prd_key, proc, mc_line, lot_qty } ของ "ทุก" MC Line ของคู่ product + process นั้น
// ระบุแยกตามคู่ product + process ตามลำดับ:
//   1. ตารางใน LOT_LINE_SOURCES — แถวของ process เดียวกันเชื่อได้มากกว่าแถวของ process อื่น
//      (แถวของ process อื่นใช้ได้เฉพาะเมื่อชี้ไปที่ line ที่ product นี้ผลิตจริงในวันนั้น)
//   2. product ที่วันนั้นผลิตบน MC Line เดียว
//   3. เหลือ line เดียวที่ยอด lot ยังไม่ครบ (หักจำนวนที่ระบุได้จากข้อ 1 แล้ว)
// lot ที่ยังระบุไม่ได้: mc_line = null พร้อม candidate_lines (line ที่เป็นไปได้)
// คืนค่า { lots, sources } — sources บอกว่าตารางอ้างอิงแต่ละตัว query สำเร็จหรือไม่
// ----------------------------------------------------------------------------
async function assignLotMcLines(lotRows, quotaRows) {
  // processLines: process -> (line key -> ชื่อ MC Line)
  // pairLines: `${prd_key}|${process}` -> (line key -> ชื่อ MC Line), pairQuota: -> (ชื่อ MC Line -> ยอด lot)
  const processLines = new Map();
  const pairLines = new Map();
  const pairQuota = new Map();
  quotaRows.forEach((row) => {
    const key = toLineKey(row.mc_line);
    const pairKey = `${row.prd_key}|${row.proc}`;
    if (!processLines.has(row.proc)) processLines.set(row.proc, new Map());
    processLines.get(row.proc).set(key, row.mc_line);
    if (!pairLines.has(pairKey)) {
      pairLines.set(pairKey, new Map());
      pairQuota.set(pairKey, new Map());
    }
    pairLines.get(pairKey).set(key, row.mc_line);
    const quota = pairQuota.get(pairKey);
    quota.set(row.mc_line, (quota.get(row.mc_line) || 0) + Number(row.lot_qty || 0));
  });

  // ค้นตารางอ้างอิงทุกตัวพร้อมกัน — ตัวไหน error (เช่น ชื่อคอลัมน์ไม่ตรง) ข้ามไป ไม่ทำให้ทั้ง endpoint ล้ม
  const lotNos = Array.from(new Set(lotRows.map((row) => String(row.lot || "").trim()).filter(Boolean)));
  const hintsByLot = new Map(); // lot -> [{ key, source, procKey }]
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
        if (!hintsByLot.has(row.lot)) hintsByLot.set(row.lot, []);
        [row.line, row.machine].forEach((value) => {
          const key = toLineKey(value);
          if (key) hintsByLot.get(row.lot).push({ key, source: source.name, procKey: toLineKey(row.proc) });
        });
      });
      sources[source.name] = "ok";
    } catch (sourceError) {
      console.error(`[OutputByProcess] lot line lookup: ${source.name} failed:`, sourceError.message);
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
    const proc = String(row.process_name || "").trim();
    const pairKey = `${String(row.product_name || "").trim().replace(/-/g, "")}|${proc}`;
    const candidates = pairLines.get(pairKey) || emptyLines;
    const procKey = toLineKey(proc);
    const hints = hintsByLot.get(String(row.lot || "").trim()) || [];
    const sameHints = hints.filter((hint) => hint.procKey === procKey);
    const otherHints = hints.filter((hint) => hint.procKey !== procKey);

    let found = matchLines(sameHints, processLines.get(proc) || emptyLines);
    // process เดียวกันชี้หลาย line — ตัดเหลือเฉพาะ line ที่ product นี้ผลิตจริง
    if (found.size > 1) found = matchLines(sameHints, candidates);
    if (found.size === 0) found = matchLines(otherHints, candidates);

    const assigned = found.size === 1 ? Array.from(found.entries())[0] : null;
    return {
      ...row,
      pair_key: pairKey,
      mc_line: assigned ? assigned[0] : null,
      line_source: assigned ? assigned[1] : null,
      candidate_lines: [],
    };
  });

  // ขั้นที่ 2-3: lot ที่เหลือ ระบุด้วยยอด lot ของแต่ละ line ในตารางสรุป
  const unresolvedByPair = new Map();
  const assignedCount = new Map(); // `${pair_key}|${mc_line}` -> จำนวน lot ที่ระบุจากตารางอ้างอิงแล้ว
  lots.forEach((lot) => {
    if (lot.mc_line) {
      const countKey = `${lot.pair_key}|${lot.mc_line}`;
      assignedCount.set(countKey, (assignedCount.get(countKey) || 0) + 1);
      return;
    }
    if (!unresolvedByPair.has(lot.pair_key)) unresolvedByPair.set(lot.pair_key, []);
    unresolvedByPair.get(lot.pair_key).push(lot);
  });

  unresolvedByPair.forEach((pending, pairKey) => {
    const quota = pairQuota.get(pairKey);
    if (!quota) return; // คู่ product + process ไม่มีในตารางสรุป — ไม่มี line ให้เลือก

    const lineNames = Array.from(quota.keys());
    if (lineNames.length === 1) {
      pending.forEach((lot) => {
        lot.mc_line = lineNames[0];
        lot.line_source = "single_line";
      });
      return;
    }

    const openLines = lineNames
      .map((name) => ({ name, remaining: quota.get(name) - (assignedCount.get(`${pairKey}|${name}`) || 0) }))
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

  return {
    lots: lots.map(({ pair_key, ...lot }) => lot),
    sources,
  };
}

// ----------------------------------------------------------------------------
// POST /line-lots
// body: { startDate: YYYY-MM-DD, endDate?: YYYY-MM-DD, pairs: [{ product, process }], _t? }
// Fetch every lot of the given product + process pairs within the production day(s), for By Line
// frontend ส่งคู่ product + process ของแถวที่จัดเข้า line นั้นมาให้ — คู่เดียวกันอาจผลิตหลาย MC Line ที่อยู่คนละ line
// จึงระบุ mc_line ของแต่ละ lot ด้วย assignLotMcLines (ยอดของทุก MC Line ของคู่นั้น) ให้ frontend จัดเข้า line เอง
// ไม่กรอง gate เพราะคอลัมน์ LOT ของ By Line รวมทุก process
// คืนค่า { lots, sources } เหมือน /mcline-lots
// Production day cutoff: startDate 08:00 -> (endDate + 1 day) 08:00
// Cache: 10 นาทีสำหรับวันในอดีต, 60 วินาทีเมื่อช่วงวันมีวันผลิตปัจจุบัน
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
    if (keySet.size === 0) return res.status(200).json({ lots: [], sources: {} });

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
    // ยอด lot ของทุก MC Line ของคู่ที่ส่งมา (ไม่ใช่เฉพาะ line ที่เปิดดู) — ใช้หักยอดใน assignLotMcLines
    const quotaStatement = `
      WITH pairs AS (
        SELECT DISTINCT prd_key, proc
        FROM UNNEST($1::text[], $2::text[]) AS p(prd_key, proc)
      )
      SELECT
        REPLACE(TRIM(d.prd_name), '-', '') AS prd_key,
        TRIM(d.proc_disp) AS proc,
        COALESCE(NULLIF(TRIM(d.mc_line), ''), 'Unknown') AS mc_line,
        SUM(COALESCE(d.lot_qty, 0)) AS lot_qty
      FROM smart.smart_fpc_process_output_detail d
      JOIN pairs p
        ON p.prd_key = REPLACE(TRIM(d.prd_name), '-', '')
       AND p.proc = TRIM(d.proc_disp)
      WHERE d.output_date >= $3
        AND d.output_date < $4
      GROUP BY 1, 2, 3
    `;
    const [lotResult, quotaResult] = await Promise.all([
      query(sqlStatement, [products, processes, `${startDate} 08:00`, `${endPlusOne} 08:00`]),
      query(quotaStatement, [products, processes, startDate, endPlusOne]),
    ]);
    const payload = await assignLotMcLines(lotResult.rows, quotaResult.rows);

    const isPastRange = endDate < getCurrentProductionDate();
    setCache(cacheKey, payload, isPastRange ? 10 * 60_000 : 60_000);
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(payload);
  } catch (error) {
    console.error("[OutputByProcess] Error fetching line-lots:", error.message);
    res.status(500).json({ error: "Cannot fetch lot data" });
  }
});

// ----------------------------------------------------------------------------
// GET /mcline-lots?process=FFPC&startDate=YYYY-MM-DD[&endDate=YYYY-MM-DD]
// Lot No. ของทุก MC Line ใน process เดียว — สำหรับ MC Line Details
// ระบุ mc_line ของแต่ละ lot ด้วย assignLotMcLines — คืนค่า { lots, sources }
// gate เท่านั้น เหมือน /dashboard-mcline ที่ gateOnly
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
          TRIM(proc_disp) AS proc,
          COALESCE(NULLIF(TRIM(mc_line), ''), 'Unknown') AS mc_line,
          SUM(COALESCE(lot_qty, 0)) AS lot_qty
        FROM smart.smart_fpc_process_output_detail
        WHERE output_date >= $1
          AND output_date < $2
          AND TRIM(proc_disp) = $3
          AND ${gateExists()}
        GROUP BY 1, 2, 3
      `, [startDate, endPlusOne, processName]),
      queryProcessLots(processName, startDate, endDate),
    ]);
    const payload = await assignLotMcLines(lotRows, quotaResult.rows);

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

    // วันผลิตปัจจุบัน: ดึงยอด lot จาก smart_fpc_output_by_lot สำหรับ process ที่มีระบบสแกน
    const today = getCurrentProductionDate();
    if (startDate <= today && today <= endDate) {
      try {
        const [scanData, scanMeta] = await Promise.all([
          getScanLotDataForDate(today),
          getScanProcessMeta(),
        ]);
        const allowedProcesses =
          process && process !== "All processes"
            ? new Set(String(process).split(",").map((p) => p.trim()).filter(Boolean))
            : null;
        applyTodayScanLotsToProductRows(result.rows, today, scanData, scanMeta, {
          allowedProcesses,
          includeMissingPairs: true,
        });
      } catch (scanError) {
        console.error("[OutputByProcess] Error applying today scan lots in process-products:", scanError.message);
      }
    }

    setCache(cacheKey, result.rows, 60_000);
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("[OutputByProcess] Error fetching process-products:", error.message);
    res.status(500).json({ error: "Cannot fetch process product data" });
  }
});

module.exports = router;
