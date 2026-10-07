import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import { OutputUnit, Granularity, LineGroup, OUTPUT_UNITS, LineGroupRow } from "../types";
import { normalizeMatrixLineGroupName } from "../hooks/useProcessOutputData";
import { getMappedAttendanceValue, checkIsMacroRow } from "./attendanceMapper";
import { getCachedCustomMacroLines, isCustomMacroName } from "./customMacroStore";
import { fetchMatrixTargetsData, fetchMatDailyOutput } from "../services/productivityApi";
import { getFiscalQuarter, getProductionWeekKey } from "./fiscalYear";

dayjs.extend(isoWeek);
dayjs.extend(quarterOfYear);

export interface ExportMatrixOptions {
  pcsMatrixData?: Map<string, Map<string, number>>;
  shtMatrixData?: Map<string, Map<string, number>>;
  lotMatrixData?: Map<string, Map<string, number>>;
  matrixData?: [string, Map<string, number>][];
  rawRows?: LineGroupRow[];
  dateColumns: string[];
  aggregatedAttendanceData: Record<string, any>;
  planData?: Map<string, Map<string, number>>;
  shtPlanData?: Map<string, Map<string, number>>;
  lotPlanData?: Map<string, Map<string, number>>;
  targetData?: any[];
  calendarData?: Record<string, number>;
  selectedUnit?: OutputUnit;
  granularity?: Granularity;
  selectedFactory?: string;
  selectedLineGroup?: string[] | "ALL";
  lineGroups?: LineGroup[];
  customLineNames?: Record<string, string>;
  viewMode?: "full" | "compact" | "focus";
  focusMetric?: "production" | "productivity" | "ot" | "leave";
  startDate: string;
  endDate: string;
  hiddenTables?: string[];
  matDailyData?: any[];
}

// Robust line hiding matcher (synchronized with DailyMatrixTable)
export const isLineHidden = (lineName: string, hiddenList?: string[]): boolean => {
  if (!hiddenList || hiddenList.length === 0) return false;
  const norm = normalizeMatrixLineGroupName(lineName).toUpperCase();
  const raw = lineName.trim().toUpperCase();
  const rawNoLine = raw.replace(/^LINE\s+/, "");
  const rawUnderscore = raw.replace(/\s+/g, "_").replace(/-/g, "_");

  return hiddenList.some(hiddenId => {
    const hNorm = normalizeMatrixLineGroupName(hiddenId).toUpperCase();
    const hRaw = hiddenId.trim().toUpperCase();
    const hRawNoLine = hRaw.replace(/^LINE\s+/, "");
    const hUnderscore = hRaw.replace(/\s+/g, "_").replace(/-/g, "_");

    if (raw === hRaw || norm === hNorm || raw === hNorm || norm === hRaw) return true;
    if (rawNoLine === hRawNoLine) return true;
    if (rawUnderscore === hUnderscore) return true;

    // QA / OQI aliases
    if (
      (raw.includes("QA_FPC_AUTO") || raw.includes("QA FPC AUTO") || raw.includes("OQI_F-AUTO") || raw.includes("OQI_F_AUTO") || raw === "OQI_F-AUTO") &&
      (hRaw.includes("QA_FPC_AUTO") || hRaw.includes("QA FPC AUTO") || hRaw.includes("OQI_F-AUTO") || hRaw.includes("OQI_F_AUTO") || hRaw === "OQI_F-AUTO")
    ) return true;

    if (
      (raw.includes("QA_FPC_GEN") || raw.includes("QA FPC GEN") || raw.includes("OQI_F-GEN") || raw.includes("OQI_F_GEN") || raw === "OQI_F-GEN") &&
      (hRaw.includes("QA_FPC_GEN") || hRaw.includes("QA FPC GEN") || hRaw.includes("OQI_F-GEN") || hRaw.includes("OQI_F_GEN") || hRaw === "OQI_F-GEN")
    ) return true;

    if (
      (raw.includes("QA_SMT_AUTO") || raw.includes("QA SMT AUTO") || raw.includes("OQI_S-AUTO") || raw.includes("OQI_S_AUTO") || raw === "OQI_S-AUTO") &&
      (hRaw.includes("QA_SMT_AUTO") || hRaw.includes("QA SMT AUTO") || hRaw.includes("OQI_S-AUTO") || hRaw.includes("OQI_S_AUTO") || hRaw === "OQI_S-AUTO")
    ) return true;

    if (
      (raw.includes("QA_SMT_GEN") || raw.includes("QA SMT GEN") || raw.includes("OQI_S-GEN") || raw.includes("OQI_S_GEN") || raw === "OQI_S-GEN") &&
      (hRaw.includes("QA_SMT_GEN") || hRaw.includes("QA SMT GEN") || hRaw.includes("OQI_S-GEN") || hRaw.includes("OQI_S_GEN") || hRaw === "OQI_S-GEN")
    ) return true;

    if (
      (raw === "DQA" || raw === "OQI_M" || raw === "LINE DQA" || raw === "OQI_M (DQA)") &&
      (hRaw === "DQA" || hRaw === "OQI_M" || hRaw === "LINE DQA" || hRaw === "OQI_M (DQA)")
    ) return true;

    if (
      (raw === "MQA" || raw === "QA SMT" || raw === "QA_SMT") &&
      (hRaw === "MQA" || hRaw === "QA SMT" || hRaw === "QA_SMT")
    ) return true;

    if (
      (raw === "MD LAM" || raw === "LINE MD LAM" || raw === "MD_LAM") &&
      (hRaw === "MD LAM" || hRaw === "LINE MD LAM" || hRaw === "MD_LAM")
    ) return true;

    if (
      (raw === "LINE MAS & REW" || raw === "MAS & REW" || raw === "LINE MAS & LINE REW") &&
      (hRaw === "LINE MAS & REW" || hRaw === "MAS & REW" || hRaw === "LINE MAS & LINE REW")
    ) return true;

    if (
      (raw.includes("AIX-ASY") || raw.includes("AIX_ASY") || raw.includes("ASY4") || raw.includes("ASSY4")) &&
      (hRaw.includes("AIX-ASY") || hRaw.includes("AIX_ASY") || hRaw.includes("ASY4") || hRaw.includes("ASSY4"))
    ) return true;

    if (
      (raw === "LINE S_IND" || raw === "S_IND" || raw === "SMT BACK_INDIRECT") &&
      (hRaw === "LINE S_IND" || hRaw === "S_IND" || hRaw === "SMT BACK_INDIRECT")
    ) return true;

    return false;
  });
};

export async function exportProductivityMatrixExcel({
  pcsMatrixData: inputPcsMatrixData,
  shtMatrixData: inputShtMatrixData,
  lotMatrixData: inputLotMatrixData,
  matrixData: inputMatrixData,
  rawRows,
  dateColumns,
  aggregatedAttendanceData,
  planData,
  shtPlanData,
  lotPlanData,
  targetData,
  calendarData,
  selectedUnit = "piece",
  granularity = "daily",
  selectedFactory = "ALL",
  selectedLineGroup = "ALL",
  lineGroups,
  customLineNames = {},
  viewMode = "full",
  focusMetric = "production",
  startDate,
  endDate,
  hiddenTables,
  matDailyData,
}: ExportMatrixOptions): Promise<void> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fujikura Smart Factory System";
  workbook.created = new Date();

  const effectiveGranularity: Granularity = (() => {
    if (dateColumns && dateColumns.length > 0) {
      if (dateColumns.some(col => typeof col === "string" && (col.includes("-W") || /^\d{4}-\d{2}-W\d+$/i.test(col)))) return "weekly";
      if (dateColumns.some(col => typeof col === "string" && (col.includes("-Q") || /^\d{4}-Q\d$/i.test(col)))) return "quarterly";
      if (dateColumns.some(col => typeof col === "string" && /^\d{4}-\d{2}$/.test(col))) return "monthly";
      if (dateColumns.some(col => typeof col === "string" && /^\d{4}$/.test(col))) return "yearly";
    }
    return granularity || "daily";
  })();

  // 1.1 Fetch & Build Target Maps (Pcs & Sht targets)
  let effectiveTargets = targetData;
  if ((!effectiveTargets || effectiveTargets.length === 0) && startDate && endDate) {
    try {
      effectiveTargets = await fetchMatrixTargetsData(startDate, endDate);
    } catch (e) {
      console.warn("Could not fetch targets for export:", e);
    }
  }

  // 1.2 Auto-fetch LINE MAT output data fallback if missing
  let effectiveMatDailyData = matDailyData;
  if ((!effectiveMatDailyData || effectiveMatDailyData.length === 0) && startDate && endDate) {
    try {
      effectiveMatDailyData = await fetchMatDailyOutput(startDate, endDate);
    } catch (e) {
      console.warn("Could not fetch mat daily output for export:", e);
    }
  }

  const targetPcsMap = new Map<string, Map<string, number>>();
  const targetShtMap = new Map<string, Map<string, number>>();

  const setTargetVal = (map: Map<string, Map<string, number>>, key: string, date: string, val: number) => {
    if (!map.has(key)) map.set(key, new Map());
    map.get(key)!.set(date, val);
  };

  if (Array.isArray(effectiveTargets)) {
    effectiveTargets.forEach(item => {
      if (!item.line || !item.date) return;
      const raw = item.line.trim().toUpperCase();
      const norm = normalizeMatrixLineGroupName(item.line).toUpperCase();
      const rawNoLine = raw.replace(/^LINE\s+/, "");
      const normNoLine = norm.replace(/^LINE\s+/, "");

      const pcsVal = Number(item.pcs_prod_target);
      const shtVal = Number(item.sht_prod_target);
      const itemDateStr = String(item.date).includes("T") ? String(item.date).split("T")[0] : String(item.date);

      const keys = [raw, norm, rawNoLine, normNoLine, item.line.trim(), normalizeMatrixLineGroupName(item.line)];
      keys.forEach(k => {
        if (!isNaN(pcsVal) && pcsVal > 0) {
          setTargetVal(targetPcsMap, k, itemDateStr, pcsVal);
        }
        if (!isNaN(shtVal) && shtVal > 0) {
          setTargetVal(targetShtMap, k, itemDateStr, shtVal);
        }
      });
    });
  }

  const getLineTargetMap = (lName: string, isSht: boolean): Map<string, number> => {
    const baseMap = isSht ? targetShtMap : targetPcsMap;
    const raw = lName.trim().toUpperCase();
    const norm = normalizeMatrixLineGroupName(lName).toUpperCase();
    const rawNoLine = raw.replace(/^LINE\s+/, "");
    const normNoLine = norm.replace(/^LINE\s+/, "");

    if (baseMap.has(norm)) return baseMap.get(norm)!;
    if (baseMap.has(raw)) return baseMap.get(raw)!;
    if (baseMap.has(normNoLine)) return baseMap.get(normNoLine)!;
    if (baseMap.has(rawNoLine)) return baseMap.get(rawNoLine)!;
    if (baseMap.has(lName.trim())) return baseMap.get(lName.trim())!;

    for (const [key, map] of baseMap.entries()) {
      const kUpper = key.toUpperCase();
      const kNoLine = kUpper.replace(/^LINE\s+/, "");
      if (
        kUpper === raw ||
        kUpper === norm ||
        kNoLine === rawNoLine ||
        kNoLine === normNoLine
      ) {
        return map;
      }
    }

    return new Map();
  };

  const lineMatDataMaps = (() => {
    const pdMap = new Map<string, number>();
    const mosMap = new Map<string, number>();
    const pdTgtMap = new Map<string, number>();
    const shtTgtMap = new Map<string, number>();

    const targetCounts = new Map<string, { pdSum: number; pdCount: number; shtSum: number; shtCount: number }>();

    const addPeriodTarget = (key: string, pdTgt: number, shtTgt: number) => {
      if (!targetCounts.has(key)) {
        targetCounts.set(key, { pdSum: 0, pdCount: 0, shtSum: 0, shtCount: 0 });
      }
      const entry = targetCounts.get(key)!;
      if (pdTgt > 0) {
        entry.pdSum += pdTgt;
        entry.pdCount++;
      }
      if (shtTgt > 0) {
        entry.shtSum += shtTgt;
        entry.shtCount++;
      }
    };

    if (Array.isArray(effectiveMatDailyData)) {
      effectiveMatDailyData.forEach(item => {
        if (!item.date) return;
        const pd = Math.round(Number(item.pd_output || 0));
        const mos = Math.round(Number(item.mos_output || 0));
        const pdTgt = Number(item.pd_prod_target || 0);
        const shtTgt = Number(item.sht_prod_target || 0);

        const rawDate = String(item.date).includes("T") ? String(item.date).split("T")[0] : String(item.date);
        const parsed = dayjs(rawDate);

        // Always store daily keys
        if (pd > 0) pdMap.set(rawDate, (pdMap.get(rawDate) || 0) + pd);
        if (mos > 0) mosMap.set(rawDate, (mosMap.get(rawDate) || 0) + mos);
        if (pdTgt > 0) pdTgtMap.set(rawDate, pdTgt);
        if (shtTgt > 0) shtTgtMap.set(rawDate, shtTgt);

        if (parsed.isValid()) {
          const isoDate = parsed.format("YYYY-MM-DD");
          if (isoDate !== rawDate) {
            if (pd > 0) pdMap.set(isoDate, (pdMap.get(isoDate) || 0) + pd);
            if (mos > 0) mosMap.set(isoDate, (mosMap.get(isoDate) || 0) + mos);
            if (pdTgt > 0) pdTgtMap.set(isoDate, pdTgt);
            if (shtTgt > 0) shtTgtMap.set(isoDate, shtTgt);
          }

          // Aggregated period keys
          const weekKey = getProductionWeekKey(parsed);
          const monthKey = parsed.format("YYYY-MM");
          const qtrKey = getFiscalQuarter(parsed);
          const yearKey = parsed.format("YYYY");

          // Accumulate output into all applicable period keys
          [weekKey, monthKey, qtrKey, yearKey].forEach(k => {
            if (pd > 0) pdMap.set(k, (pdMap.get(k) || 0) + pd);
            if (mos > 0) mosMap.set(k, (mosMap.get(k) || 0) + mos);
            addPeriodTarget(k, pdTgt, shtTgt);
          });
        }
      });

      // Calculate average targets for periods
      targetCounts.forEach((stats, k) => {
        if (stats.pdCount > 0 && !pdTgtMap.has(k)) {
          pdTgtMap.set(k, Math.round((stats.pdSum / stats.pdCount) * 100) / 100);
        }
        if (stats.shtCount > 0 && !shtTgtMap.has(k)) {
          shtTgtMap.set(k, Math.round((stats.shtSum / stats.shtCount) * 100) / 100);
        }
      });
    }

    // Also incorporate targets from effectiveTargets for LINE MAT
    if (Array.isArray(effectiveTargets)) {
      effectiveTargets.forEach(item => {
        if (!item.line || !item.date) return;
        const raw = item.line.trim().toUpperCase();
        if (raw.includes("LINE MAT") || raw === "MAT") {
          const pdTgt = Number(item.pd_prod_target || item.pcs_prod_target || 0);
          const shtTgt = Number(item.sht_prod_target || 0);
          const dStr = String(item.date).includes("T") ? String(item.date).split("T")[0] : String(item.date);
          const d = dayjs(dStr);

          if (pdTgt > 0 && !pdTgtMap.has(dStr)) pdTgtMap.set(dStr, pdTgt);
          if (shtTgt > 0 && !shtTgtMap.has(dStr)) shtTgtMap.set(dStr, shtTgt);

          if (d.isValid()) {
            const wKey = getProductionWeekKey(d);
            const mKey = d.format("YYYY-MM");
            if (pdTgt > 0 && !pdTgtMap.has(wKey)) pdTgtMap.set(wKey, pdTgt);
            if (shtTgt > 0 && !shtTgtMap.has(wKey)) shtTgtMap.set(wKey, shtTgt);
            if (pdTgt > 0 && !pdTgtMap.has(mKey)) pdTgtMap.set(mKey, pdTgt);
            if (shtTgt > 0 && !shtTgtMap.has(mKey)) shtTgtMap.set(mKey, shtTgt);
          }
        }
      });
    }

    // Merge from rawRows (precomputed period summary or daily rows)
    if (Array.isArray(rawRows)) {
      rawRows.forEach(r => {
        const uLine = normalizeMatrixLineGroupName(r.lineGroup || "").toUpperCase();
        if (uLine === "LINE MAT" || uLine === "MAT") {
          const rAny = r as any;
          const pd = Number(rAny.pd_output || 0);
          const mos = Number(rAny.mos_output || 0);
          if (pd > 0) {
            pdMap.set(r.date, Math.max(pdMap.get(r.date) || 0, pd));
          }
          if (mos > 0) {
            mosMap.set(r.date, Math.max(mosMap.get(r.date) || 0, mos));
          }
        }
      });
    }

    return { pdMap, mosMap, pdTgtMap, shtTgtMap };
  })();

  // 1. Build fast lookup map from matrixData (pre-calculated lines & macros from UI)
  const matrixDataMap = new Map<string, Map<string, number>>();
  if (inputMatrixData && Array.isArray(inputMatrixData)) {
    inputMatrixData.forEach(([lineName, map]) => {
      if (map && map instanceof Map) {
        matrixDataMap.set(lineName, map);
        matrixDataMap.set(lineName.trim().toUpperCase(), map);
        matrixDataMap.set(normalizeMatrixLineGroupName(lineName), map);
        matrixDataMap.set(normalizeMatrixLineGroupName(lineName).trim().toUpperCase(), map);
        const withoutPrefix = lineName.replace(/^LINE\s+/i, "").trim().toUpperCase();
        matrixDataMap.set(withoutPrefix, map);
        const withPrefix = lineName.toUpperCase().startsWith("LINE ") ? lineName.toUpperCase() : `LINE ${lineName.toUpperCase()}`;
        matrixDataMap.set(withPrefix, map);
      }
    });
  }

  // 2. Compute multi-unit maps from rawRows if available with normalized dates
  const pMap = new Map<string, Map<string, number>>();
  const sMap = new Map<string, Map<string, number>>();
  const lMap = new Map<string, Map<string, number>>();

  const rawPcsPlanMap = new Map<string, Map<string, number>>();
  const rawShtPlanMap = new Map<string, Map<string, number>>();
  const rawLotPlanMap = new Map<string, Map<string, number>>();

  if (rawRows && rawRows.length > 0) {
    const macroFpcLines = [
      "LINE NPM", "NPM_FPC", "NPM", "LINE A", "LINE B_GEN", "LINE B_NON", "LINE B_JDT", "LINE B", "LINE C", "LINE D"
    ];
    const macroSmtLines = [
      "ASY1_A", "ASY1_AUTO", "LINE ASY1_A", "ASSY 1 (AUTOMOTIVE)",
      "ASY1_G", "ASY1_GEN", "LINE ASY1_G", "ASSY 1 (GENERAL)", "ASSY1_GEN", "ASY1 GEN", "ASSY1 GEN",
      "ASY2", "ASY2", "LINE ASY2",
      "ASY3", "ASY3", "LINE ASY3",
      "AIX-ASY", "AIX_ASY", "LINE AIX-ASY"
    ];

    const macroFpcPcs = new Map<string, number>();
    const macroFpcSht = new Map<string, number>();
    const macroFpcLot = new Map<string, number>();

    const macroSmtPcs = new Map<string, number>();
    const macroSmtSht = new Map<string, number>();
    const macroSmtLot = new Map<string, number>();

    const macroPcnPcs = new Map<string, number>();
    const macroPcnSht = new Map<string, number>();
    const macroPcnLot = new Map<string, number>();

    rawRows.forEach(row => {
      let dateKey = row.date;
      if (dateKey) {
        const parsed = dayjs(dateKey);
        if (parsed.isValid()) {
          if (effectiveGranularity === "yearly") dateKey = parsed.format("YYYY");
          else if (effectiveGranularity === "quarterly") dateKey = getFiscalQuarter(parsed);
          else if (effectiveGranularity === "monthly") dateKey = parsed.format("YYYY-MM");
          else if (effectiveGranularity === "weekly") dateKey = getProductionWeekKey(parsed);
          else dateKey = parsed.format("YYYY-MM-DD");
        }
      }

      const normLine = normalizeMatrixLineGroupName(row.lineGroup || "").toUpperCase();
      if (!normLine) return;

      if (row.mcLine === "MANUAL_EXCEL") {
        const rowAny = row as any;
        const pPlan = Number(rowAny.piece_plan ?? row.planQty ?? 0);
        const sPlan = Number(rowAny.sht_plan ?? 0);
        const lPlan = Number(rowAny.lot_plan ?? 0);

        if (!rawPcsPlanMap.has(normLine)) rawPcsPlanMap.set(normLine, new Map());
        if (!rawShtPlanMap.has(normLine)) rawShtPlanMap.set(normLine, new Map());
        if (!rawLotPlanMap.has(normLine)) rawLotPlanMap.set(normLine, new Map());

        rawPcsPlanMap.get(normLine)!.set(dateKey, (rawPcsPlanMap.get(normLine)!.get(dateKey) || 0) + pPlan);
        rawShtPlanMap.get(normLine)!.set(dateKey, (rawShtPlanMap.get(normLine)!.get(dateKey) || 0) + sPlan);
        rawLotPlanMap.get(normLine)!.set(dateKey, (rawLotPlanMap.get(normLine)!.get(dateKey) || 0) + lPlan);
        return;
      }

      const pQty = Number(row.pieceQty || 0);
      const sQty = Number(row.shtQty || 0);
      const lQty = Number(row.lotQty || 0);

      // Accumulate exactly ONCE per normalized line name
      if (!pMap.has(normLine)) pMap.set(normLine, new Map());
      if (!sMap.has(normLine)) sMap.set(normLine, new Map());
      if (!lMap.has(normLine)) lMap.set(normLine, new Map());

      pMap.get(normLine)!.set(dateKey, (pMap.get(normLine)!.get(dateKey) || 0) + pQty);
      sMap.get(normLine)!.set(dateKey, (sMap.get(normLine)!.get(dateKey) || 0) + sQty);
      lMap.get(normLine)!.set(dateKey, (lMap.get(normLine)!.get(dateKey) || 0) + lQty);

      const isFpc = macroFpcLines.some(l => l.toUpperCase() === normLine);
      const isSmt = macroSmtLines.some(l => l.toUpperCase() === normLine);

      if (isFpc) {
        macroFpcPcs.set(dateKey, (macroFpcPcs.get(dateKey) || 0) + pQty);
        macroFpcSht.set(dateKey, (macroFpcSht.get(dateKey) || 0) + sQty);
        macroFpcLot.set(dateKey, (macroFpcLot.get(dateKey) || 0) + lQty);
      }

      if (isSmt) {
        macroSmtPcs.set(dateKey, (macroSmtPcs.get(dateKey) || 0) + pQty);
        macroSmtSht.set(dateKey, (macroSmtSht.get(dateKey) || 0) + sQty);
        macroSmtLot.set(dateKey, (macroSmtLot.get(dateKey) || 0) + lQty);
      }

      if (isFpc || isSmt) {
        macroPcnPcs.set(dateKey, (macroPcnPcs.get(dateKey) || 0) + pQty);
        macroPcnSht.set(dateKey, (macroPcnSht.get(dateKey) || 0) + sQty);
        macroPcnLot.set(dateKey, (macroPcnLot.get(dateKey) || 0) + lQty);
      }
    });

    const getAliasMap = (sourceMap: Map<string, Map<string, number>>, aliases: string[]): Map<string, number> => {
      for (const a of aliases) {
        const norm = normalizeMatrixLineGroupName(a).toUpperCase();
        const map = sourceMap.get(norm) || sourceMap.get(a.toUpperCase());
        if (map && map.size > 0) {
          const total = Array.from(map.values()).reduce((sum, v) => sum + v, 0);
          if (total > 0) return map;
        }
      }
      return new Map<string, number>();
    };

    // Helper to sum maps cleanly
    const sumMaps = (sourceMap: Map<string, Map<string, number>>, keys: string[]) => {
      const res = new Map<string, number>();
      const seen = new Set<string>();
      keys.forEach(k => {
        const norm = normalizeMatrixLineGroupName(k).toUpperCase();
        if (seen.has(norm)) return;
        seen.add(norm);
        sourceMap.get(norm)?.forEach((v, d) => res.set(d, (res.get(d) || 0) + v));
      });
      return res;
    };

    // Register Macro FPC, Direct FPC, Macro SMT, Macro PCN into maps
    ["Macro FPC", "MACRO FPC", "Direct FPC", "DIRECT FPC"].forEach(name => {
      pMap.set(name.toUpperCase(), macroFpcPcs);
      sMap.set(name.toUpperCase(), macroFpcSht);
      lMap.set(name.toUpperCase(), macroFpcLot);
    });

    const smtFrontPcs = sumMaps(pMap, ["LINE MOTA_A", "LINE MOTA_G", "LINE MOTB", "AIX-MOT", "LINE MOTC", "MOTC", "LINE MOTD"]);
    const smtFrontSht = sumMaps(sMap, ["LINE MOTA_A", "LINE MOTA_G", "LINE MOTB", "AIX-MOT", "LINE MOTC", "MOTC", "LINE MOTD"]);
    const smtFrontLot = sumMaps(lMap, ["LINE MOTA_A", "LINE MOTA_G", "LINE MOTB", "AIX-MOT", "LINE MOTC", "MOTC", "LINE MOTD"]);

    ["Macro SMT_F", "MACRO SMT_F", "SMT Front_Direct", "SMT FRONT_DIRECT"].forEach(name => {
      pMap.set(name.toUpperCase(), smtFrontPcs);
      sMap.set(name.toUpperCase(), smtFrontSht);
      lMap.set(name.toUpperCase(), smtFrontLot);
    });

    ["Macro SMT", "MACRO SMT", "Direct SMT", "DIRECT SMT", "Macro SMT_B", "MACRO SMT_B", "SMT BACK_DIRECT", "SMT Back_Direct"].forEach(name => {
      pMap.set(name.toUpperCase(), macroSmtPcs);
      sMap.set(name.toUpperCase(), macroSmtSht);
      lMap.set(name.toUpperCase(), macroSmtLot);
    });

    ["Macro PCN", "MACRO PCN"].forEach(name => {
      pMap.set(name.toUpperCase(), macroPcnPcs);
      sMap.set(name.toUpperCase(), macroPcnSht);
      lMap.set(name.toUpperCase(), macroPcnLot);
    });

    // Synchronize LINE A / LINE A_FINAL (single source alias, not additive sum)
    const lineAFinalPcs = getAliasMap(pMap, ["LINE A_FINAL", "LINE A", "A"]);
    const lineAFinalSht = getAliasMap(sMap, ["LINE A_FINAL", "LINE A", "A"]);
    const lineAFinalLot = getAliasMap(lMap, ["LINE A_FINAL", "LINE A", "A"]);
    if (lineAFinalPcs.size > 0) {
      pMap.set("LINE A_FINAL", lineAFinalPcs);
      pMap.set("LINE A", lineAFinalPcs);
    }
    if (lineAFinalSht.size > 0) {
      sMap.set("LINE A_FINAL", lineAFinalSht);
      sMap.set("LINE A", lineAFinalSht);
    }
    if (lineAFinalLot.size > 0) {
      lMap.set("LINE A_FINAL", lineAFinalLot);
      lMap.set("LINE A", lineAFinalLot);
    }

    const lineBPcs = sumMaps(pMap, ["LINE B_GEN", "LINE B_NON"]);
    const lineBSht = sumMaps(sMap, ["LINE B_GEN", "LINE B_NON"]);
    const lineBLot = sumMaps(lMap, ["LINE B_GEN", "LINE B_NON"]);
    pMap.set("LINE B", lineBPcs);
    sMap.set("LINE B", lineBSht);
    lMap.set("LINE B", lineBLot);

    // Rollup LINE VAC & HPS (uses output from LINE VAC)
    const lineVacHpsPcs = sumMaps(pMap, ["LINE VAC"]);
    const lineVacHpsSht = sumMaps(sMap, ["LINE VAC"]);
    const lineVacHpsLot = sumMaps(lMap, ["LINE VAC"]);
    pMap.set("LINE VAC & HPS", lineVacHpsPcs);
    sMap.set("LINE VAC & HPS", lineVacHpsSht);
    lMap.set("LINE VAC & HPS", lineVacHpsLot);

    // For Line REW, use Plan as Output
    const rewPlan = rawPcsPlanMap.get("REW") || rawPcsPlanMap.get("LINE REW") || planData?.get("REW") || planData?.get("LINE REW");
    if (rewPlan && rewPlan.size > 0) {
      const rewOut = pMap.get("REW") || pMap.get("LINE REW") || new Map<string, number>();
      rewPlan.forEach((v, d) => {
        if (!rewOut.has(d) || (rewOut.get(d) || 0) === 0) {
          rewOut.set(d, v);
        }
      });
      pMap.set("REW", rewOut);
      pMap.set("LINE REW", rewOut);
    }

    // Rollup LINE MAS & REW
    const lineMasRewPcs = sumMaps(pMap, ["LINE MAS", "LINE REW"]);
    const lineMasRewSht = sumMaps(sMap, ["LINE MAS", "LINE REW"]);
    const lineMasRewLot = sumMaps(lMap, ["LINE MAS", "LINE REW"]);
    pMap.set("LINE MAS & REW", lineMasRewPcs);
    sMap.set("LINE MAS & REW", lineMasRewSht);
    lMap.set("LINE MAS & REW", lineMasRewLot);

    // Rollup QA FPC
    const qaFpcPcs = sumMaps(pMap, ["OQI_F-AUTO", "OQI_F-GEN"]);
    pMap.set("QA FPC", qaFpcPcs);

    // Rollup QA SMT
    const qaSmtPcs = sumMaps(pMap, ["OQI_S-AUTO", "OQI_S-GEN"]);
    pMap.set("QA SMT", qaSmtPcs);
    pMap.set("MQA", qaSmtPcs);

    // Rollup ASY SMT (including AIX-ASY)
    const asySmtSources = ["LINE ASY1_A", "ASY1_A", "LINE ASY1_G", "ASY1_G", "LINE ASY2", "ASY2", "LINE ASY3", "ASY3", "AIX-ASY", "AIX_ASY", "LINE AIX-ASY", "ASY4", "ASSY4"];
    const asySmtPcs = sumMaps(pMap, asySmtSources);
    const asySmtSht = sumMaps(sMap, asySmtSources);
    const asySmtLot = sumMaps(lMap, asySmtSources);
    pMap.set("ASY SMT", asySmtPcs);
    sMap.set("ASY SMT", asySmtSht);
    lMap.set("ASY SMT", asySmtLot);
  }

  // Helper to resolve line output map strictly according to requested unit
  const getLineOutputMap = (lineName: string, unit: "piece" | "sheet" | "lot" = "piece"): Map<string, number> => {
    const rawUpper = lineName.trim().toUpperCase();
    const norm = normalizeMatrixLineGroupName(lineName).trim().toUpperCase();
    const noLine = rawUpper.replace(/^LINE\s+/i, "");
    const withLine = rawUpper.startsWith("LINE ") ? rawUpper : `LINE ${rawUpper}`;
    const candidates = [lineName, rawUpper, norm, noLine, withLine];

    // 1. Only if the requested unit is piece, check matrixDataMap first (exact match with UI)
    if (unit === "piece" && matrixDataMap && matrixDataMap.size > 0) {
      for (const k of candidates) {
        if (matrixDataMap.has(k)) {
          const map = matrixDataMap.get(k)!;
          if (map && map.size > 0) return map;
        }
      }
    }

    // 2. Pick the strictly unit-specific map (Sheet -> sMap / inputShtMatrixData, Lot -> lMap / inputLotMatrixData, Piece -> pMap / inputPcsMatrixData)
    const targetMap = unit === "sheet" ? (inputShtMatrixData || sMap) : unit === "lot" ? (inputLotMatrixData || lMap) : (inputPcsMatrixData || pMap);

    if (targetMap && targetMap.size > 0) {
      for (const k of candidates) {
        if (targetMap.has(k)) {
          const map = targetMap.get(k)!;
          if (map && map.size > 0) return map;
        }
      }

      if (rawUpper === "LINE A_FINAL" || norm === "LINE A_FINAL" || rawUpper === "A_FINAL") {
        const aMap = targetMap.get("LINE A") || targetMap.get("A");
        if (aMap && aMap.size > 0) return aMap;
      }
      if (rawUpper === "LINE A" || norm === "LINE A" || rawUpper === "A") {
        const aFinMap = targetMap.get("LINE A_FINAL") || targetMap.get("A_FINAL");
        if (aFinMap && aFinMap.size > 0) return aFinMap;
      }
    }

    if (rawUpper === "REW" || norm === "REW" || noLine === "REW") {
      const rewPlan = getLinePlanMap(lineName, unit);
      if (rewPlan && rewPlan.size > 0) return rewPlan;
    }

    return new Map<string, number>();
  };

  // Helper to resolve plan map for a line
  const getLinePlanMap = (lineName: string, unit: "piece" | "sheet" | "lot" = "piece"): Map<string, number> => {
    const targetPlanData = unit === "sheet"
      ? (shtPlanData || (rawShtPlanMap.size > 0 ? rawShtPlanMap : planData))
      : unit === "lot"
        ? (lotPlanData || (rawLotPlanMap.size > 0 ? rawLotPlanMap : planData))
        : (planData || (rawPcsPlanMap.size > 0 ? rawPcsPlanMap : undefined));
    if (!targetPlanData || !(targetPlanData instanceof Map)) return new Map();
    const rawUpper = lineName.trim().toUpperCase();
    const norm = normalizeMatrixLineGroupName(lineName).trim().toUpperCase();
    const noLine = rawUpper.replace(/^LINE\s+/i, "");
    const withLine = rawUpper.startsWith("LINE ") ? rawUpper : `LINE ${rawUpper}`;

    if (targetPlanData.has(lineName)) return targetPlanData.get(lineName)!;
    if (targetPlanData.has(rawUpper)) return targetPlanData.get(rawUpper)!;
    if (targetPlanData.has(norm)) return targetPlanData.get(norm)!;
    if (targetPlanData.has(noLine)) return targetPlanData.get(noLine)!;
    if (targetPlanData.has(withLine)) return targetPlanData.get(withLine)!;

    if (rawUpper === "LINE A_FINAL" || norm === "LINE A_FINAL" || rawUpper === "A_FINAL") {
      const aPlan = targetPlanData.get("LINE A") || targetPlanData.get("A");
      if (aPlan && aPlan.size > 0) return aPlan;
    }
    if (rawUpper === "LINE A" || norm === "LINE A" || rawUpper === "A") {
      const aFinPlan = targetPlanData.get("LINE A_FINAL") || targetPlanData.get("A_FINAL");
      if (aFinPlan && aFinPlan.size > 0) return aFinPlan;
    }

    if (rawUpper === "SMT FRONT_DIRECT" || rawUpper === "SMT FRONT DIRECT" || rawUpper === "SMT FRONT_INDIRECT" || rawUpper === "SMT_FRONT_DIRECT" || rawUpper === "SMT FRONT" || rawUpper === "MACRO SMT_F" || rawUpper === "MACRO SMT-F") {
      return targetPlanData.get("SMT FRONT_DIRECT") || targetPlanData.get("SMT Front_Direct") || targetPlanData.get("Macro SMT_F") || targetPlanData.get("MACRO SMT_F") || new Map();
    }
    if (rawUpper === "DIRECT SMT" || rawUpper === "DIRECT_SMT") {
      return targetPlanData.get("DIRECT SMT") || targetPlanData.get("Direct SMT") || new Map();
    }
    if (rawUpper === "SMT BACK_DIRECT" || rawUpper === "SMT BACK DIRECT" || rawUpper === "SMT_BACK_DIRECT" || rawUpper === "SMT BACK" || rawUpper === "MACRO SMT_B" || rawUpper === "MACRO SMT-B") {
      return targetPlanData.get("SMT BACK_DIRECT") || targetPlanData.get("SMT Back_Direct") || targetPlanData.get("Macro SMT_B") || targetPlanData.get("MACRO SMT_B") || new Map();
    }
    if (rawUpper === "AUTOMOTIVE" || rawUpper === "AUTOMATIVE") {
      return targetPlanData.get("AUTOMOTIVE") || targetPlanData.get("Automotive") || targetPlanData.get("LINE ASY1_A") || targetPlanData.get("ASY1_A") || targetPlanData.get("ASY1_AUTO") || new Map();
    }
    if (rawUpper === "MD LAM" || rawUpper === "MD_LAM" || rawUpper === "LINE MD LAM" || rawUpper === "LAM MD" || rawUpper === "LAM_MD") {
      return targetPlanData.get("MD LAM") || targetPlanData.get("LINE MD LAM") || targetPlanData.get("MD_LAM") || new Map();
    }
    if (rawUpper === "LINE SMT_LAM" || rawUpper === "SMT_LAM" || rawUpper === "LINE SMT LAM" || rawUpper === "SMT LAM" || rawUpper === "LAM") {
      return targetPlanData.get("LINE SMT_LAM") || targetPlanData.get("SMT_LAM") || targetPlanData.get("LINE SMT LAM") || targetPlanData.get("SMT LAM") || new Map();
    }
    if (rawUpper === "ASY SMT" || rawUpper === "ASY_SMT" || rawUpper === "ASY ONLY" || rawUpper === "LINE ASY SMT") {
      const merged = new Map<string, number>();
      const sources = ["LINE ASY1_A", "ASY1_A", "ASY1_AUTO", "LINE ASY1_G", "ASY1_G", "ASY1_GEN", "LINE ASY2", "ASY2", "LINE ASY3", "ASY3", "AIX-ASY", "AIX_ASY", "LINE AIX-ASY", "ASY4", "ASSY4", "ASY SMT"];
      sources.forEach(s => {
        const sMap = targetPlanData.get(s) || targetPlanData.get(s.toUpperCase());
        if (sMap) {
          sMap.forEach((v, d) => merged.set(d, (merged.get(d) || 0) + v));
        }
      });
      if (merged.size > 0) return merged;
    }
    return new Map();
  };

  // Helper to extract value from Map safely for any date format
  const getValFromMap = (map: Map<string, number> | undefined, date: string): number => {
    if (!map || !(map instanceof Map)) return 0;
    if (map.has(date)) return Number(map.get(date) || 0);
    const d = dayjs(date);
    if (d.isValid()) {
      const isoDate = d.format("YYYY-MM-DD");
      if (map.has(isoDate)) return Number(map.get(isoDate) || 0);
    }
    // Week key normalization (e.g. 2026-08-W31 vs 2026-W31)
    if (typeof date === "string" && date.includes("-W")) {
      const wMatch = date.match(/W(\d+)/i);
      if (wMatch) {
        const wNum = parseInt(wMatch[1], 10);
        for (const [k, v] of map.entries()) {
          const kMatch = k.match(/W(\d+)/i);
          if (kMatch && parseInt(kMatch[1], 10) === wNum && v > 0) {
            return Number(v);
          }
        }
      }
    }
    return 0;
  };

  // Helper to get attendance object for date
  const getAttendanceDataForDate = (date: string) => {
    if (!aggregatedAttendanceData) return undefined;
    if (aggregatedAttendanceData[date]) return aggregatedAttendanceData[date];
    const iso = dayjs(date).format("YYYY-MM-DD");
    if (aggregatedAttendanceData[iso]) return aggregatedAttendanceData[iso];
    return undefined;
  };

  const sheetTitle = `Productivity_${selectedFactory || "ALL"}`.substring(0, 31);
  const worksheet = workbook.addWorksheet(sheetTitle, {
    views: [
      {
        state: "frozen",
        xSplit: 3, // Freeze Spacer (Col A), Line Group (Col B), and Parameter (Col C)
        ySplit: effectiveGranularity === "daily" ? 3 : 1, // Freeze top header rows
      },
    ],
    properties: { defaultRowHeight: 20 },
  });

  const showTotalColumn = dateColumns.length > 1;
  const totalColsCount = 3 + dateColumns.length + (showTotalColumn ? 1 : 0);

  // Styling Constants matching Fujikura Excel format
  const BORDER_THIN = {
    top: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    left: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    right: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
  };

  const FONT_BASE = { name: "Calibri", size: 10 };
  const FONT_BOLD = { name: "Calibri", size: 10, bold: true };
  const FONT_HEADER = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E293B" } };

  // Palette definition
  const COLOR_HEADER_FILL = "FFF1F5F9"; // Slate 100
  const COLOR_WEEKEND_SAT = "FFE2F0D9"; // Soft green
  const COLOR_WEEKEND_SUN = "FFFCE4D6"; // Soft red
  const COLOR_TOTAL_HEADER = "FFE2E8F0"; // Slate 200
  const COLOR_PROD_FILL = "FFECFDF5"; // Emerald 50
  const COLOR_PLAN_FILL = "FFF5F3FF"; // Purple 50
  const COLOR_METRIC_FILL = "FFEFF6FF"; // Blue 50
  const COLOR_OT_FILL = "FFFFF2CC"; // Soft yellow matching Image 2
  const COLOR_LEAVE_FILL = "FFFCE4D6"; // Soft orange/peach matching Image 2
  const COLOR_ALERT_RED_FILL = "FFFFE4E6"; // Rose 100

  // 1. Setup Column Widths (Col A is Spacer column for margin)
  const columnsSetup: Array<{ key: string; width: number }> = [
    { key: "spacer", width: 3.5 },
    { key: "lineGroup", width: 16 },
    { key: "parameter", width: 25 },
    ...dateColumns.map(col => ({ key: col, width: 11 })),
  ];
  if (showTotalColumn) {
    columnsSetup.push({ key: "total", width: 14 });
  }
  worksheet.columns = columnsSetup;

  // Department Badge Color Helper (Driven by lineGroups factory metadata + keyword fallback)
  const getDeptBadgeColor = (name: string) => {
    const norm = normalizeMatrixLineGroupName(name).toUpperCase();
    const u = name.toUpperCase();
    const groupDef = lineGroups?.find(g => normalizeMatrixLineGroupName(g.name).toUpperCase() === norm);
    const factory = groupDef?.factory?.toUpperCase() || "";

    if (factory === "AUTOMOTIVE" || u.includes("AUTOMOTIVE") || u.includes("MOTA") || u.includes("ASTP") || u.includes("AIX-MOT")) {
      return { fill: "FFE2F0D9", font: "FF166534" }; // Soft Green
    }
    if (factory === "SMT" || u.includes("SMT") || u.includes("ASY") || u.includes("MAS") || u.includes("REW") || u.includes("S_IND") || u.includes("BACKEND")) {
      return { fill: "FFFFEDD5", font: "FF9A3412" }; // Soft Orange/Peach
    }
    if (factory === "QA" || u.includes("QA") || u.includes("DQA") || u.includes("MQA") || u.includes("OQI")) {
      return { fill: "FFFEF3C7", font: "FF92400E" }; // Soft Amber
    }
    if (factory === "FPC" || u.includes("PCN") || u.includes("FPC") || u.startsWith("LINE ") || u.startsWith("A_") || u.startsWith("LAM_")) {
      return { fill: "FFE0E7FF", font: "FF3730A3" }; // Soft Indigo/Blue
    }
    return { fill: "FFF1F5F9", font: "FF1E293B" }; // Soft Slate
  };

  // 2. Build Headers
  if (effectiveGranularity === "daily") {
    let workingDaysCount = 0;

    // Row 1: Day of Week (ddd)
    const row1Values: (string | number)[] = ["", "ALL Productivity (PCS/MH,SHT/MH)", ""];
    dateColumns.forEach(date => {
      row1Values.push(dayjs(date).format("ddd"));
    });
    if (showTotalColumn) row1Values.push("TOTAL / AVG");
    const headerRow1 = worksheet.addRow(row1Values);
    headerRow1.height = 22;

    // Row 2: Working Day Indicator (1 or 0)
    const sDate = dayjs(startDate).isValid() ? dayjs(startDate) : (dayjs(dateColumns[0]).isValid() ? dayjs(dateColumns[0]) : null);
    const eDate = dayjs(endDate).isValid() ? dayjs(endDate) : (dayjs(dateColumns[dateColumns.length - 1]).isValid() ? dayjs(dateColumns[dateColumns.length - 1]) : null);
    const periodLabel = (sDate && eDate) ? `${sDate.format("D-MMM")} - ${eDate.format("D-MMM YYYY")}` : "SUMMARY";
    const row2Values: (string | number)[] = ["", periodLabel, ""];
    dateColumns.forEach(date => {
      const dOfWeek = dayjs(date).day();
      const calVal = calendarData && calendarData[date] !== undefined
        ? calendarData[date]
        : (dOfWeek === 0 ? 0 : 1);
      if (calVal === 1) workingDaysCount++;
      row2Values.push(calVal);
    });
    if (showTotalColumn) row2Values.push(`Days: ${workingDaysCount}`);
    const headerRow2 = worksheet.addRow(row2Values);
    headerRow2.height = 18;

    // Row 3: Date (D-MMM)
    const row3Values: (string | number)[] = ["", "Line Group", "Parameter"];
    dateColumns.forEach(date => {
      row3Values.push(dayjs(date).format("D-MMM"));
    });
    if (showTotalColumn) row3Values.push("SUMMARY");
    const headerRow3 = worksheet.addRow(row3Values);
    headerRow3.height = 20;

    // Merge B1:C1 for Main Title (Row 1)
    worksheet.mergeCells(1, 2, 1, 3);
    const titleCell = worksheet.getCell("B1");
    titleCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF0F172A" } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER_FILL } };
    titleCell.border = BORDER_THIN;

    // Merge B2:C2 for Period Label (Row 2)
    worksheet.mergeCells(2, 2, 2, 3);
    const periodCell = worksheet.getCell("B2");
    periodCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFF0000" } }; // Bold red prominent date header
    periodCell.alignment = { vertical: "middle", horizontal: "center" };
    periodCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    periodCell.border = BORDER_THIN;

    // Row 3 labels (B3, C3)
    ["B3", "C3"].forEach(pos => {
      const c = worksheet.getCell(pos);
      c.font = FONT_HEADER;
      c.alignment = { vertical: "middle", horizontal: "center" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER_FILL } };
      c.border = BORDER_THIN;
    });

    // Format Row 1 Day cells (Cols 4..End)
    dateColumns.forEach((date, idx) => {
      const colIdx = idx + 4;
      const cell = headerRow1.getCell(colIdx);
      const dayOfWeek = dayjs(date).day();
      let fillColor = COLOR_HEADER_FILL;
      if (dayOfWeek === 6) fillColor = COLOR_WEEKEND_SAT; // Saturday
      else if (dayOfWeek === 0) fillColor = COLOR_WEEKEND_SUN; // Sunday

      cell.font = FONT_HEADER;
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
      cell.border = BORDER_THIN;
    });

    // Format Row 2 Work day 1/0 cells (Cols 4..End)
    dateColumns.forEach((date, idx) => {
      const colIdx = idx + 4;
      const cell = headerRow2.getCell(colIdx);
      const isWorking = cell.value === 1;
      cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: isWorking ? "FF065F46" : "FF991B1B" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isWorking ? "FFD1FAE5" : "FFFEE2E2" },
      };
      cell.border = BORDER_THIN;
    });

    // Format Row 3 Date cells (Cols 4..End)
    dateColumns.forEach((date, idx) => {
      const colIdx = idx + 4;
      const cell = headerRow3.getCell(colIdx);
      cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF475569" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      cell.border = BORDER_THIN;
    });

    // Format Total Column headers
    if (showTotalColumn) {
      const totalColIdx = totalColsCount;
      [headerRow1, headerRow2, headerRow3].forEach((row, rIdx) => {
        const cell = row.getCell(totalColIdx);
        cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF1E3A8A" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TOTAL_HEADER } };
        cell.border = BORDER_THIN;
      });
    }
  } else {
    // Non-daily header
    const headerValues: (string | number)[] = ["", "Line Group", "Parameter"];
    dateColumns.forEach(col => {
      if (effectiveGranularity === "monthly") {
        const d = dayjs(col);
        headerValues.push(d.isValid() ? d.format("MMM-YY") : col);
      } else if (effectiveGranularity === "weekly") {
        headerValues.push(col.includes("-W") ? `Week ${col.split("-W")[1]}` : col);
      } else {
        headerValues.push(col);
      }
    });
    if (showTotalColumn) headerValues.push("TOTAL");

    const headerRow = worksheet.addRow(headerValues);
    headerRow.height = 24;
    headerRow.eachCell((cell, colNumber) => {
      if (colNumber === 1) return; // Spacer column has no border/styling
      const isTotal = showTotalColumn && colNumber === totalColsCount;
      cell.font = isTotal ? { ...FONT_BOLD, color: { argb: "FF1E3A8A" } } : FONT_HEADER;
      cell.alignment = { vertical: "middle", horizontal: colNumber <= 3 ? "center" : "center" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isTotal ? COLOR_TOTAL_HEADER : COLOR_HEADER_FILL },
      };
      cell.border = BORDER_THIN;
    });
  }

  // 3. Dynamic Line Discovery (Master Order + lineGroups + Custom Macros + Raw Data)
  const canonicalOrder = [
    // FPC Macro
    "Macro PCN",
    "Macro FPC",
    "Direct FPC",
    // FPC Main Process Lines
    "LINE A",
    "AT_Front",
    "AT_VAC",
    "AT_LAM",
    "LINE A_FINAL",
    "LINE B",
    "LINE B_GEN",
    "LINE B_NON",
    "LINE C",
    "LINE D",
    "LINE MAT",
    "LINE LAM",
    "LINE VAC & HPS",
    "LINE VAC",
    "LINE HPS",
    // FPC 3-Unit Lines
    "LINE BLK",
    "LINE OST",
    // FPC Inspection
    "AVI/K2",
    "MDS",
    // SMT Macro
    "Macro SMT",
    "Macro SMT_F",
    "Macro SMT_B",
    "Direct SMT",
    "SMT Front_Direct",
    "SMT BACK_DIRECT",
    // SMT Automotive
    "Automotive",
    "MOTA_A",
    "MOTA_G",
    "MOTB",
    "AIX-MOT",
    "MOTD",
    "ASTP_A",
    "ASTP_G",
    "MAS",
    "REW",
    "XRAY",
    "MAS & REW",
    // SMT Assembly (ASSY)
    "AIX-BLK",
    "BLK-2",
    "ASY1_A",
    "ASY1_G",
    "ASY2",
    "ASY3",
    "AIX-ASY",
    "AELT",
    "SMT_LAM",
    "MD LAM",
    "ASY SMT",
    // QA
    "QA FPC",
    "OQI_F-AUTO",
    "OQI_F-GEN",
    "OQI_M",
    "QA SMT",
    "OQI_S-AUTO",
    "OQI_S-GEN",
  ];

  const EXCLUDED_EXPORT_LINES = new Set([
    "LINE NPM", "NPM", "SUPPORT TF2", "LINE SUPPORT TF2",
    "LINE S_TECH_F", "S_TECH_F", "S_TECH-F", "LINE S_TSTE_F", "S_TSTE_F", "S_TSTE-F",
    "LINE ASY5", "ASY5", "LINE ASY6", "ASY6", "LINE ASY7", "ASY7",
    "LINE S_IND", "S_IND", "S-IND",
    "LINE B_JDT", "B_JDT",
    "LAM_NIDEC", "LINE LAM_NIDEC", "NIDEC",
    "LINE MOTC", "MOTC", "UNKNOWN", "LINE UNKNOWN", "TOTAL"
  ]);

  // Resolve effective hidden tables list
  let effectiveHiddenTables = hiddenTables;
  if (!effectiveHiddenTables) {
    try {
      const savedVis = localStorage.getItem("productivity_table_visibility");
      if (savedVis) {
        const parsed = JSON.parse(savedVis);
        if (Array.isArray(parsed)) {
          effectiveHiddenTables = parsed;
        } else if (parsed && Array.isArray(parsed.hidden_tables)) {
          effectiveHiddenTables = parsed.hidden_tables;
        }
      }
    } catch (e) { }
  }

  const discoveredLinesSet = new Set<string>();
  const discoveredLines: string[] = [];

  const addDiscoveredLine = (line: string) => {
    if (!line || typeof line !== "string") return;
    const trimmed = line.trim();
    if (!trimmed) return;
    const norm = normalizeMatrixLineGroupName(trimmed).toUpperCase();
    const upper = trimmed.toUpperCase();
    if (EXCLUDED_EXPORT_LINES.has(norm) || EXCLUDED_EXPORT_LINES.has(upper)) return;
    if (isLineHidden(trimmed, effectiveHiddenTables)) return;
    if (!discoveredLinesSet.has(norm)) {
      discoveredLinesSet.add(norm);
      discoveredLines.push(trimmed);
    }
  };

  // Only discover lines that ACTUALLY exist in the data to be exported!
  // 1. If matrixData was provided (e.g. from UI table view), it is the primary ground truth
  if (inputMatrixData && Array.isArray(inputMatrixData) && inputMatrixData.length > 0) {
    inputMatrixData.forEach(([k]) => addDiscoveredLine(k));
  } else if (inputMatrixData && inputMatrixData instanceof Map && inputMatrixData.size > 0) {
    inputMatrixData.forEach((_, k) => addDiscoveredLine(k));
  } else if (
    (inputPcsMatrixData && inputPcsMatrixData.size > 0) ||
    (inputShtMatrixData && inputShtMatrixData.size > 0) ||
    (inputLotMatrixData && inputLotMatrixData.size > 0)
  ) {
    // 2. Multi-unit matrices (e.g. from historical export Path B in modal)
    inputPcsMatrixData?.forEach((_, k) => addDiscoveredLine(k));
    inputShtMatrixData?.forEach((_, k) => addDiscoveredLine(k));
    inputLotMatrixData?.forEach((_, k) => addDiscoveredLine(k));
  } else if (rawRows && rawRows.length > 0) {
    // 3. Raw rows with actual data
    rawRows.forEach(r => {
      if (r.lineGroup && r.mcLine !== "MANUAL_EXCEL") addDiscoveredLine(r.lineGroup);
    });
  } else {
    // 4. Fallback only if no data at all: active lineGroups & customMacros
    if (lineGroups && Array.isArray(lineGroups)) {
      lineGroups.forEach(g => {
        if (g.name) addDiscoveredLine(g.name);
      });
    }
    const customMacros = getCachedCustomMacroLines();
    customMacros.forEach(cm => {
      if (cm.macro_name) addDiscoveredLine(cm.macro_name);
    });
  }

  // 5. Also discover lines that have productivity targets defined
  if (Array.isArray(effectiveTargets)) {
    effectiveTargets.forEach(t => {
      if (t.line && (Number(t.pcs_prod_target) > 0 || Number(t.sht_prod_target) > 0)) {
        addDiscoveredLine(t.line);
      }
    });
  }

  // 6. Ensure maps calculated above (e.g. pMap) and core macros are registered
  if (pMap && pMap.size > 0) {
    pMap.forEach((_, k) => addDiscoveredLine(k));
  }
  [
    "Macro PCN", "Macro FPC", "Direct FPC",
    "Macro SMT", "Direct SMT", "Macro SMT_F", "Macro SMT_B",
    "SMT Front_Direct", "SMT BACK_DIRECT"
  ].forEach(m => addDiscoveredLine(m));

  // Sort discovered lines by canonical master sequence
  const getCanonicalSortIndex = (name: string) => {
    const norm = normalizeMatrixLineGroupName(name).toUpperCase();
    const upper = name.trim().toUpperCase();
    const idxNorm = canonicalOrder.findIndex(c => normalizeMatrixLineGroupName(c).toUpperCase() === norm);
    if (idxNorm !== -1) return idxNorm;
    const idxUpper = canonicalOrder.findIndex(c => c.trim().toUpperCase() === upper);
    if (idxUpper !== -1) return idxUpper;
    return 9999;
  };
  discoveredLines.sort((a, b) => getCanonicalSortIndex(a) - getCanonicalSortIndex(b));

  const KNOWN_FPC_LINES = new Set([
    "MACRO PCN", "MACRO FPC", "DIRECT FPC", "NPM_FPC", "LINE NPM", "LINE A", "AT_FRONT",
    "AT_VAC", "AT_LAM", "LINE A_FINAL", "LINE B", "LINE B_GEN", "LINE B_NON", "LINE C",
    "LINE D", "LINE MAT", "LINE LAM", "LINE VAC & HPS", "LINE VAC", "LINE HPS",
    "LINE BLK", "LINE OST", "AVI/K2", "LINE AVI/K2", "MDS", "TF-2"
  ]);

  const linesToExport = discoveredLines.filter(lineName => {
    const norm = normalizeMatrixLineGroupName(lineName).toUpperCase();
    const rawUpper = lineName.trim().toUpperCase();

    if (EXCLUDED_EXPORT_LINES.has(norm) || EXCLUDED_EXPORT_LINES.has(rawUpper)) return false;
    if (isLineHidden(lineName, effectiveHiddenTables)) return false;

    const getLineFactory = (normName: string, raw: string): string => {
      const groupDef = lineGroups?.find(g => normalizeMatrixLineGroupName(g.name).toUpperCase() === normName);
      if (groupDef?.factory) return groupDef.factory;
      if (KNOWN_FPC_LINES.has(normName) || KNOWN_FPC_LINES.has(raw)) return "FPC";
      if (normName.includes("QA") || normName.includes("DQA") || normName.includes("MQA") || normName.includes("OQI")) return "QA";
      return "SMT";
    };

    const lineFactory = getLineFactory(norm, rawUpper);

    if (selectedFactory === "MACRO") {
      const isMacro = checkIsMacroRow(lineName) || isCustomMacroName(lineName) || norm.startsWith("MACRO") || norm.startsWith("DIRECT");
      if (!isMacro) return false;
    } else if (selectedFactory === "QA") {
      const isQa = norm.includes("QA") || norm.includes("DQA") || norm.includes("MQA") || norm.includes("OQI");
      if (!isQa && lineFactory !== "QA") return false;
    } else if (selectedFactory === "FPC") {
      const isFpcMacro = norm === "MACRO FPC" || norm === "DIRECT FPC" || norm === "MACRO PCN";
      if (!isFpcMacro && lineFactory !== "FPC") return false;
    } else if (selectedFactory === "SMT") {
      const isSmtMacro =
        norm === "MACRO SMT" ||
        norm === "DIRECT SMT" ||
        norm === "DIRECT FPC" ||
        norm === "MACRO SMT_F" ||
        norm === "MACRO SMT-F" ||
        norm === "MACRO SMT_B" ||
        norm === "MACRO SMT-B" ||
        norm === "SMT FRONT_DIRECT" ||
        norm === "SMT FRONT DIRECT" ||
        norm === "SMT_FRONT_DIRECT" ||
        norm === "SMT BACK_DIRECT" ||
        norm === "SMT BACK DIRECT" ||
        norm === "SMT_BACK_DIRECT";
      if (!isSmtMacro && lineFactory !== "SMT") return false;
    } else if (selectedFactory && selectedFactory !== "ALL") {
      if (lineFactory !== selectedFactory) return false;
    }

    if (selectedLineGroup === "ALL" || !selectedLineGroup) return true;
    if (Array.isArray(selectedLineGroup)) {
      return selectedLineGroup.some(name => normalizeMatrixLineGroupName(name).toUpperCase() === norm);
    }
    return true;
  });

  // Sort linesToExport by customLineOrder if configured
  try {
    const savedOrder = localStorage.getItem("productivity_custom_line_order");
    if (savedOrder) {
      const customLineOrder: string[] = JSON.parse(savedOrder);
      if (Array.isArray(customLineOrder) && customLineOrder.length > 0) {
        const orderMap = new Map<string, number>();
        customLineOrder.forEach((key, idx) => {
          orderMap.set(key.trim().toUpperCase(), idx);
          orderMap.set(normalizeMatrixLineGroupName(key).trim().toUpperCase(), idx);
        });

        linesToExport.sort((a, b) => {
          const aKey = a.trim().toUpperCase();
          const aNorm = normalizeMatrixLineGroupName(a).trim().toUpperCase();
          const bKey = b.trim().toUpperCase();
          const bNorm = normalizeMatrixLineGroupName(b).trim().toUpperCase();

          const aIdx = orderMap.has(aKey) ? orderMap.get(aKey)! : (orderMap.has(aNorm) ? orderMap.get(aNorm)! : 9999);
          const bIdx = orderMap.has(bKey) ? orderMap.get(bKey)! : (orderMap.has(bNorm) ? orderMap.get(bNorm)! : 9999);

          if (aIdx !== bIdx) return aIdx - bIdx;
          return 0;
        });
      }
    }
  } catch (e) { }

  // Helper to format data row
  const applyRowStyling = (
    row: any,
    options: {
      fillColor?: string;
      numFmt?: string;
      boldParam?: boolean;
      paramColor?: string;
      totalColor?: string;
      customCellStyler?: (cell: any, colIdx: number, val: any) => void;
    } = {}
  ) => {
    row.height = 20;
    row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
      // Col 1 (Spacer) has no border
      if (colNumber === 1) {
        cell.border = {};
        return;
      }

      cell.border = {
        top: { style: "dotted", color: { argb: "FF94A3B8" } },
        bottom: { style: "dotted", color: { argb: "FF94A3B8" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };

      // Col 2 (Line Group) will be styled/merged separately
      if (colNumber === 2) {
        cell.border = {
          ...cell.border,
          left: { style: "medium", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
        return;
      }

      // Col 3 (Parameter Name)
      if (colNumber === 3) {
        cell.font = options.boldParam
          ? { ...FONT_BOLD, color: { argb: options.paramColor || "FF1E293B" } }
          : { ...FONT_BASE, color: { argb: options.paramColor || "FF334155" } };
        cell.alignment = { vertical: "middle", horizontal: "right" }; // Right-aligned matching Image 2
        cell.border = {
          ...cell.border,
          right: { style: "thin", color: { argb: "FF94A3B8" } },
        };
        if (options.fillColor) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: options.fillColor } };
        }
        return;
      }

      // Col 4..End-1 (Dates) and Last Col (Total)
      const isTotalCol = showTotalColumn && colNumber === totalColsCount;
      const val = cell.value;
      const isDash = val === "-" || val === "" || val === undefined || val === null;

      if (isTotalCol) {
        cell.font = { ...FONT_BOLD, color: { argb: options.totalColor || "FF1E3A8A" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        cell.alignment = { vertical: "middle", horizontal: isDash ? "center" : "right" };
        cell.border = {
          ...cell.border,
          right: { style: "medium", color: { argb: "FF000000" } },
        };
      } else {
        cell.font = FONT_BASE;
        cell.alignment = { vertical: "middle", horizontal: isDash ? "center" : "right" };
        if (options.fillColor) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: options.fillColor } };
        }
      }

      if (!isDash && typeof val === "number" && options.numFmt) {
        cell.numFmt = options.numFmt;
      }

      if (options.customCellStyler) {
        options.customCellStyler(cell, colNumber, val);
      }
    });
  };

  // 4. Iterate over each Line Group & add rows dynamically according to its data & configuration
  linesToExport.forEach((lineName, lineIdx) => {
    const norm = normalizeMatrixLineGroupName(lineName).toUpperCase();
    const rawUpper = lineName.trim().toUpperCase();
    const customName = customLineNames[lineName] || customLineNames[rawUpper];
    const displayLineTitle = (customName && customName.trim().length > 0) ? customName.trim() : lineName;

    const linePcsMap = getLineOutputMap(lineName, "piece");
    const lineShtMap = getLineOutputMap(lineName, "sheet");
    const lineLotMap = getLineOutputMap(lineName, "lot");
    const linePcsPlanMap = getLinePlanMap(lineName, "piece");
    const lineShtPlanMap = getLinePlanMap(lineName, "sheet");
    const lineLotPlanMap = getLinePlanMap(lineName, "lot");
    const linePlanMap = linePcsPlanMap;
    const linePcsTargetMap = getLineTargetMap(lineName, false);
    const lineShtTargetMap = getLineTargetMap(lineName, true);

    const getVal = (data: any, key: string, fpcKey: string) => {
      return getMappedAttendanceValue(lineName, data, fpcKey, key, effectiveGranularity);
    };

    const isMacroRow = checkIsMacroRow(lineName);
    const isMacroPcnRow = norm === "MACRO PCN";
    const isAsySmt = norm === "ASY SMT" || rawUpper === "ASY SMT";
    const isAutomotiveRow = norm === "AUTOMOTIVE" || norm === "AUTOMATIVE" || rawUpper === "AUTOMOTIVE" || rawUpper === "AUTOMATIVE";

    // Dynamic Unit Detection from data and configurations
    const hasLotData = Array.from(lineLotMap.values()).some(v => v > 0);
    const hasShtData = Array.from(lineShtMap.values()).some(v => v > 0);
    const hasPlanData = Array.from(linePcsPlanMap.values()).some(v => v > 0) || Array.from(lineShtPlanMap.values()).some(v => v > 0) || Array.from(lineLotPlanMap.values()).some(v => v > 0);

    // Identification of QA Lines
    const isQaRow =
      norm.includes("OQI") ||
      norm.includes("DQA") ||
      norm.startsWith("QA ") ||
      norm.startsWith("QA_") ||
      norm === "QA" ||
      norm === "MQA";

    const isExplicitThreeUnit =
      rawUpper === "LINE BLK" || norm === "LINE BLK" || rawUpper === "BLK" || norm === "BLK" ||
      rawUpper === "LINE OST" || norm === "LINE OST" || rawUpper === "OST" || norm === "OST";

    // Strictly LINE BLK and LINE OST have 3 units (Pcs, Sht, Lot)
    const isThreeUnitLine = !isQaRow && isExplicitThreeUnit;

    // Identification of FPC Lines (Macro FPC, Direct FPC, and all other FPC lines have Pcs and Sht)
    const isLineHps = rawUpper === "LINE HPS" || norm === "LINE HPS" || rawUpper === "HPS" || norm === "HPS";
    const isLineMat = rawUpper === "LINE MAT" || norm === "LINE MAT";
    const isLineAviK2 = rawUpper.includes("AVI") || norm.includes("AVI");
    const isLineMds = rawUpper === "MDS" || norm === "MDS";

    const isFpcLine =
      !isQaRow &&
      !isThreeUnitLine &&
      !isLineMat &&
      (
        rawUpper.includes("PCN") || norm.includes("PCN") ||
        rawUpper.includes("FPC") || norm.includes("FPC") ||
        rawUpper === "LINE A" || norm === "LINE A" ||
        rawUpper.startsWith("A_") || norm.startsWith("A_") ||
        rawUpper.startsWith("AT_") || norm.startsWith("AT_") ||
        rawUpper.startsWith("AT-") || norm.startsWith("AT-") ||
        rawUpper === "LINE C" || norm === "LINE C" ||
        rawUpper === "LINE D" || norm === "LINE D" ||
        rawUpper === "LINE VAC" || norm === "LINE VAC" ||
        rawUpper === "LINE HPS" || norm === "LINE HPS" ||
        rawUpper === "LINE VAC & HPS" || norm === "LINE VAC & HPS" ||
        rawUpper === "LAM_FPC" || norm === "LAM_FPC" ||
        rawUpper === "LINE LAM" || norm === "LINE LAM" ||
        rawUpper === "LINE_LAM" || norm === "LINE_LAM" ||
        rawUpper === "LINE NPM" || norm === "LINE NPM" ||
        rawUpper === "AVI_INS" || norm === "AVI_INS" ||
        rawUpper.includes("AVI") || norm.includes("AVI") ||
        rawUpper === "MDS" || norm === "MDS"
      );

    const startRowIdx = worksheet.rowCount + 1;
    let prodEndRowIdx = startRowIdx;
    let otStartRowIdx = 0;
    let otEndRowIdx = 0;
    let leaveStartRowIdx = 0;
    let leaveEndRowIdx = 0;

    const isMacroFpcRow = norm === "MACRO FPC" || rawUpper === "MACRO FPC";
    const createRowValues = (label: string): (string | number)[] => ["", "", label];

    // 1. OP & Leader register
    const regValues: (string | number)[] = createRowValues("OP & Leader register");
    let regCount = 0;
    let regSum = 0;
    dateColumns.forEach(date => {
      if (isMacroRow) {
        const data = getAttendanceDataForDate(date);
        const total = getVal(data, "total_register", "fpc_total_register");
        if (total > 0) {
          regCount++;
          regSum += total;
          regValues.push(Math.round(total));
        } else {
          regValues.push("-");
        }
      } else {
        regValues.push("-");
      }
    });
    if (showTotalColumn) {
      const avg = regCount > 0 ? Math.round(regSum / regCount) : 0;
      regValues.push(avg > 0 ? avg : "-");
    }
    const rReg = worksheet.addRow(regValues);
    applyRowStyling(rReg, { numFmt: "#,##0", fillColor: "FFFFFFFF" });
    prodEndRowIdx = worksheet.rowCount;

    // 2. Total Man Hour (Split into Total Man Hour1 & Total Man Hour2 for Macro FPC)
    if (isMacroFpcRow) {
      // Total Man Hour1
      const mh1Values: (string | number)[] = createRowValues("Total Man Hour1");
      let mh1Sum = 0;
      dateColumns.forEach(date => {
        const data = getAttendanceDataForDate(date);
        const totalMH = getVal(data, "total_man_hour", "fpc_total_man_hour");
        if (totalMH > 0) {
          mh1Sum += totalMH;
          mh1Values.push(Math.round(totalMH));
        } else {
          mh1Values.push("-");
        }
      });
      if (showTotalColumn) {
        mh1Values.push(mh1Sum > 0 ? Math.round(mh1Sum) : "-");
      }
      const rMh1 = worksheet.addRow(mh1Values);
      applyRowStyling(rMh1, { numFmt: "#,##0", fillColor: "FFFFFFFF" });

      // Total Man Hour2
      const mh2Values: (string | number)[] = createRowValues("Total Man Hour2");
      dateColumns.forEach(() => mh2Values.push("-"));
      if (showTotalColumn) mh2Values.push("-");
      const rMh2 = worksheet.addRow(mh2Values);
      applyRowStyling(rMh2, { numFmt: "#,##0", fillColor: "FFFFFFFF" });
    } else {
      const mhValues: (string | number)[] = createRowValues("Total Man Hour");
      let mhSum = 0;
      dateColumns.forEach(date => {
        if (isMacroRow) {
          const data = getAttendanceDataForDate(date);
          const totalMH = getVal(data, "total_man_hour", "fpc_total_man_hour");
          if (totalMH > 0) {
            mhSum += totalMH;
            mhValues.push(Math.round(totalMH));
          } else {
            mhValues.push("-");
          }
        } else {
          mhValues.push("-");
        }
      });
      if (showTotalColumn) {
        mhValues.push(mhSum > 0 ? Math.round(mhSum) : "-");
      }
      const rMh = worksheet.addRow(mhValues);
      applyRowStyling(rMh, { numFmt: "#,##0", fillColor: "FFFFFFFF" });
    }
    prodEndRowIdx = worksheet.rowCount;

    // Helper to add Output row
    const addOutputRow = (label: string, sourceMap: Map<string, number>, planMap?: Map<string, number>) => {
      const rowValues: (string | number)[] = createRowValues(label);
      let sumOut = 0;
      dateColumns.forEach(date => {
        const actualQty = getValFromMap(sourceMap, date);
        if (actualQty > 0) {
          sumOut += actualQty;
          rowValues.push(Math.round(actualQty));
        } else {
          rowValues.push("-");
        }
      });
      if (showTotalColumn) {
        rowValues.push(sumOut > 0 ? Math.round(sumOut) : "-");
      }
      const isBrown = label === "PD_Output" || label === "MOS_Output";
      const r = worksheet.addRow(rowValues);
      applyRowStyling(r, {
        numFmt: "#,##0",
        fillColor: isBrown ? "FFFDF6EE" : COLOR_PROD_FILL,
        boldParam: true,
        paramColor: isBrown ? "FF78350F" : "FF065F46",
        totalColor: isBrown ? "FF78350F" : "FF065F46",
        customCellStyler: (cell, colNumber, val) => {
          if (isBrown && colNumber >= 4 && typeof val === "number" && val > 0) {
            cell.font = { ...FONT_BOLD, color: { argb: "FF78350F" } };
          }
          if (planMap && colNumber >= 4 && colNumber < 4 + dateColumns.length) {
            const date = dateColumns[colNumber - 4];
            const planQty = getValFromMap(planMap, date);
            const actualQty = typeof val === "number" ? val : 0;
            if (planQty > 0 && typeof val === "number" && actualQty < planQty) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ALERT_RED_FILL } };
              cell.font = { ...FONT_BOLD, color: { argb: "FFDC2626" } };
            }
          }
        },
      });
      prodEndRowIdx = worksheet.rowCount;
    };

    // Helper to add Plan row
    const addPlanRow = (label: string, sourceMap?: Map<string, number>) => {
      const rowValues: (string | number)[] = createRowValues(label);
      let sumPlan = 0;
      let hasAnyVal = false;
      dateColumns.forEach(date => {
        const planQty = sourceMap ? getValFromMap(sourceMap, date) : 0;
        if (planQty > 0) {
          hasAnyVal = true;
          sumPlan += planQty;
          rowValues.push(Math.round(planQty));
        } else {
          rowValues.push("-");
        }
      });
      if (showTotalColumn) {
        rowValues.push(hasAnyVal && sumPlan > 0 ? Math.round(sumPlan) : "-");
      }
      const r = worksheet.addRow(rowValues);
      applyRowStyling(r, {
        numFmt: "#,##0",
        fillColor: "FFE0F2FE", // Soft Ice Blue matching Excel template
        boldParam: true,
        paramColor: "FF0369A1",
        totalColor: "FF0369A1",
      });
      prodEndRowIdx = worksheet.rowCount;
    };

    // Helper to add Prod Target row
    const addTargetRow = (label: string, sourceMap?: Map<string, number>) => {
      const isSht = label.toLowerCase().includes("sht");
      const targetMap = sourceMap || (isSht ? lineShtTargetMap : linePcsTargetMap);
      const rowValues: (string | number)[] = createRowValues(label);
      let targetSum = 0;
      let targetCount = 0;

      dateColumns.forEach(date => {
        let targetVal = 0;
        if (targetMap) {
          targetVal = getValFromMap(targetMap, date);
          if (effectiveGranularity === "monthly" && targetVal === 0) {
            let mSum = 0;
            let mCount = 0;
            for (const [d, v] of targetMap.entries()) {
              if (d.startsWith(date) && v > 0) {
                mSum += v;
                mCount++;
              }
            }
            targetVal = mCount > 0 ? Math.round((mSum / mCount) * 100) / 100 : 0;
          }
        }

        if (targetVal > 0) {
          targetSum += targetVal;
          targetCount++;
          rowValues.push(Math.round(targetVal * 100) / 100);
        } else {
          rowValues.push("-");
        }
      });

      if (showTotalColumn) {
        const avgTarget = targetCount > 0 ? Math.round((targetSum / targetCount) * 100) / 100 : "-";
        rowValues.push(avgTarget);
      }

      const r = worksheet.addRow(rowValues);
      applyRowStyling(r, {
        numFmt: "#,##0.00",
        fillColor: "FFFFF1F2",
        boldParam: true,
        paramColor: "FFDC2626",
        totalColor: "FFDC2626",
      });
      prodEndRowIdx = worksheet.rowCount;
    };

    // Helper to add Productivity Actual row
    const addProdActualRow = (label: string, sourceMap: Map<string, number>) => {
      const rowValues: (string | number)[] = createRowValues(label);
      let validTotalQty = 0;
      let validTotalMH = 0;

      dateColumns.forEach(date => {
        if (isMacroRow) {
          const actualQty = getValFromMap(sourceMap, date);
          const data = getAttendanceDataForDate(date);
          const totalMH = getVal(data, "total_man_hour", "fpc_total_man_hour");
          if (actualQty > 0 && totalMH > 0) {
            validTotalQty += actualQty;
            validTotalMH += totalMH;
            rowValues.push(Math.round((actualQty / totalMH) * 100) / 100);
          } else {
            rowValues.push("-");
          }
        } else {
          rowValues.push("-");
        }
      });

      if (showTotalColumn) {
        const totalProd = validTotalMH > 0 ? Math.round((validTotalQty / validTotalMH) * 100) / 100 : "-";
        rowValues.push(totalProd);
      }
      const r = worksheet.addRow(rowValues);
      applyRowStyling(r, {
        numFmt: "#,##0.00",
        fillColor: COLOR_METRIC_FILL,
        boldParam: true,
        paramColor: "FF1E40AF",
        totalColor: "FF047857",
      });
      prodEndRowIdx = worksheet.rowCount;
    };

    // Helper to add Acc Prod row
    const addAccProdRow = (label: string, sourceMap: Map<string, number>) => {
      const rowValues: (string | number)[] = createRowValues(label);
      let runningTotalQty = 0;
      let runningTotalMH = 0;

      dateColumns.forEach(date => {
        if (isMacroRow) {
          const actualQty = getValFromMap(sourceMap, date);
          const data = getAttendanceDataForDate(date);
          const totalMH = getVal(data, "total_man_hour", "fpc_total_man_hour");
          if (actualQty > 0 && totalMH > 0) {
            runningTotalQty += actualQty;
            runningTotalMH += totalMH;
          }
          if (runningTotalMH > 0 && runningTotalQty > 0 && (actualQty > 0 || totalMH > 0)) {
            rowValues.push(Math.round((runningTotalQty / runningTotalMH) * 100) / 100);
          } else {
            rowValues.push("-");
          }
        } else {
          rowValues.push("-");
        }
      });

      if (showTotalColumn) {
        const accProd = runningTotalMH > 0 ? Math.round((runningTotalQty / runningTotalMH) * 100) / 100 : "-";
        rowValues.push(accProd);
      }
      const r = worksheet.addRow(rowValues);
      applyRowStyling(r, {
        numFmt: "#,##0.00",
        fillColor: COLOR_METRIC_FILL,
        boldParam: true,
        paramColor: "FF1E40AF",
        totalColor: "FF1E40AF",
      });
      prodEndRowIdx = worksheet.rowCount;
    };

    // --- Dynamic Output Rows Selection ---
    const matchingCustom = getCachedCustomMacroLines().find(m => m.macro_name.trim().toUpperCase() === norm || m.macro_name.trim().toUpperCase() === rawUpper);
    const customPlanAllowed = matchingCustom ? matchingCustom.show_plan_row !== false : true;
    const customTargetAllowed = matchingCustom ? matchingCustom.show_target_row !== false : true;
    const customOtAllowed = matchingCustom ? Boolean(matchingCustom.show_ot_rows) : true;
    const customLeaveAllowed = matchingCustom ? Boolean(matchingCustom.show_leave_rows) : true;
    const customUnits = matchingCustom?.units && matchingCustom.units.length > 0 ? matchingCustom.units : null;
    const unitIncludePcs = !customUnits || customUnits.includes("piece");
    const unitIncludeSht = !customUnits || customUnits.includes("sheet");
    const unitIncludeLot = !customUnits || customUnits.includes("lot");

    if (isMacroPcnRow) {
      // Macro PCN: Piece only (No Plan)
      addOutputRow("Pcs_Output", linePcsMap);
      if (customTargetAllowed) addTargetRow("Pcs_Prod Target");
      addProdActualRow("Pcs_Prod Actual", linePcsMap);
      addAccProdRow("Acc Prod<PCS/MH>", linePcsMap);
    } else if (isQaRow) {
      // QA Line: Strictly Piece only (No Sheet / No Lot / No Plan)
      addOutputRow("Pcs_Output", linePcsMap);
      if (customTargetAllowed) addTargetRow("Pcs_Prod Target");
      addProdActualRow("Daily Productivity", linePcsMap);
      addAccProdRow("Acc Productivity<Pcs/MH>", linePcsMap);
    } else if (isThreeUnitLine) {
      // 3-Unit Line (LINE BLK, LINE OST): Piece + Sheet + Lot (Only Plan_LOT, NO Plan_Pcs or Plan_Sht)
      if (unitIncludePcs) addOutputRow("Pcs_Output", linePcsMap);
      if (unitIncludeSht) addOutputRow("Sht_Output", lineShtMap);
      if (customPlanAllowed && unitIncludeLot) addPlanRow("Plan_LOT", lineLotPlanMap);
      if (unitIncludeLot) addOutputRow("Lot_Output", lineLotMap, Array.from(lineLotPlanMap.values()).some(v => v > 0) ? lineLotPlanMap : undefined);
      if (customTargetAllowed && unitIncludePcs) addTargetRow("Pcs_Prod Target");
      if (customTargetAllowed && unitIncludeSht) addTargetRow("Sht_Prod Target");
      if (unitIncludePcs) addProdActualRow("Pcs_Prod Actual", linePcsMap);
      if (unitIncludeSht) addProdActualRow("Sht_Prod Actual", lineShtMap);
      if (unitIncludePcs) addAccProdRow("Acc Prod<PCS/MH>", linePcsMap);
      if (unitIncludeSht) addAccProdRow("Acc Prod<SHT/MH>", lineShtMap);
    } else if (isLineMat) {
      addOutputRow("PD_Output", lineMatDataMaps.pdMap);
      addOutputRow("MOS_Output", lineMatDataMaps.mosMap);
      if (customTargetAllowed) addTargetRow("PD_Prod Target", lineMatDataMaps.pdTgtMap);
      if (customTargetAllowed) addTargetRow("Sht_Prod Target", lineMatDataMaps.shtTgtMap);
      addProdActualRow("PD_Prod Actual", lineMatDataMaps.pdMap);
      addProdActualRow("Sht_MOS Actual", lineMatDataMaps.mosMap);
      addAccProdRow("Acc Prod<SHT/MH>", lineMatDataMaps.pdMap);
      addAccProdRow("Acc MOS<SHT/MH>", lineMatDataMaps.mosMap);
    } else if (isFpcLine) {
      // FPC Line (Piece + Sheet only - NO Lot)
      if (customPlanAllowed && !isLineHps && !isLineMat && !isLineAviK2 && unitIncludePcs) addPlanRow("Plan_Pcs", linePcsPlanMap);
      if (unitIncludePcs) addOutputRow("Pcs_Output", linePcsMap, Array.from(linePcsPlanMap.values()).some(v => v > 0) ? linePcsPlanMap : undefined);
      if (customPlanAllowed && !isLineHps && !isLineMat && !isLineAviK2 && !isLineMds && unitIncludeSht) addPlanRow("Plan_Sht", lineShtPlanMap);
      if (unitIncludeSht) addOutputRow("Sht_Output", lineShtMap, Array.from(lineShtPlanMap.values()).some(v => v > 0) ? lineShtPlanMap : undefined);
      if (customTargetAllowed && unitIncludePcs) addTargetRow("Pcs_Prod Target");
      if (customTargetAllowed && unitIncludeSht) addTargetRow("Sht_Prod Target");
      if (unitIncludePcs) addProdActualRow("Pcs_Prod Actual", linePcsMap);
      if (unitIncludeSht) addProdActualRow("Sht_Prod Actual", lineShtMap);
      if (unitIncludePcs) addAccProdRow("Acc Prod<PCS/MH>", linePcsMap);
      if (unitIncludeSht) addAccProdRow("Accum Productivity", lineShtMap);
    } else {
      // SMT / Standard Line (Piece only - NO Sheet, NO Lot)
      const isMacroSmtOverall = norm === "MACRO SMT" || rawUpper === "MACRO SMT";
      const allowPlanComparison = customPlanAllowed && !isMacroSmtOverall && !isAsySmt;
      if (customPlanAllowed && !isMacroSmtOverall && !isAsySmt && unitIncludePcs) addPlanRow("Plan_Pcs", linePcsPlanMap);
      if (unitIncludePcs) addOutputRow("Pcs_Output", linePcsMap, allowPlanComparison && Array.from(linePcsPlanMap.values()).some(v => v > 0) ? linePcsPlanMap : undefined);
      if (!isAutomotiveRow && customTargetAllowed && unitIncludePcs) addTargetRow("Pcs_Prod Target");
      if (unitIncludePcs) addProdActualRow(isAsySmt ? "Pcs_Prod Actual" : "Daily Productivity", linePcsMap);
      if (unitIncludePcs) addAccProdRow(isAsySmt ? "Acc Prod<PCS/MH>" : "SUM Productivity<Pcs/MH>", linePcsMap);
    }

    // --- OT & LEAVE ROWS ---
    const showOtRows = !isAsySmt && !isAutomotiveRow && customOtAllowed;
    const showLeaveRows = !isAsySmt && !isAutomotiveRow && customLeaveAllowed;

    if (showOtRows) {
      // OT (psn)
      const otValues: (string | number)[] = createRowValues("OT.(psn)");
      let otCount = 0;
      let otSum = 0;
      dateColumns.forEach(date => {
        if (isMacroRow) {
          const data = getAttendanceDataForDate(date);
          const otPsn = getVal(data, "ot_psn", "fpc_ot_psn");
          if (otPsn > 0) {
            otCount++;
            otSum += otPsn;
            otValues.push(Math.round(otPsn));
          } else {
            otValues.push("-");
          }
        } else {
          otValues.push("-");
        }
      });
      if (showTotalColumn) {
        const avg = otCount > 0 ? Math.round(otSum / otCount) : 0;
        otValues.push(avg > 0 ? avg : "-");
      }
      const rOt = worksheet.addRow(otValues);
      applyRowStyling(rOt, { numFmt: "#,##0", fillColor: COLOR_OT_FILL, paramColor: "FF0E7490", totalColor: "FF0E7490" });
      if (!otStartRowIdx) otStartRowIdx = worksheet.rowCount;
      otEndRowIdx = worksheet.rowCount;

      // OT working day rate
      const otWorkValues: (string | number)[] = createRowValues("OT working day rate(%)");
      let sumOtWork = 0;
      let sumRegWork = 0;
      dateColumns.forEach(date => {
        if (isMacroRow) {
          const data = getAttendanceDataForDate(date);
          const rate = getVal(data, "ot_working_day_rate", "fpc_ot_working_day_rate");
          const totalReg = getVal(data, "total_register", "fpc_total_register");
          const isWorking = granularity === "daily" ? data?.is_working_day === 1 : true;
          if (rate > 0 && isWorking) {
            sumOtWork += (rate / 100) * (totalReg > 0 ? totalReg : 1);
            sumRegWork += (totalReg > 0 ? totalReg : 1);
            otWorkValues.push(Math.round(rate * 100) / 10000);
          } else {
            otWorkValues.push("-");
          }
        } else {
          otWorkValues.push("-");
        }
      });
      if (showTotalColumn) {
        const avgRate = sumRegWork > 0 ? (sumOtWork / sumRegWork) : 0;
        otWorkValues.push(sumRegWork > 0 ? Math.round(avgRate * 10000) / 10000 : "-");
      }
      const rOtWork = worksheet.addRow(otWorkValues);
      applyRowStyling(rOtWork, { numFmt: "0.00%", fillColor: COLOR_OT_FILL, paramColor: "FF0E7490", totalColor: "FF0E7490" });
      otEndRowIdx = worksheet.rowCount;

      // OT Holiday day rate
      const otHolValues: (string | number)[] = createRowValues("OT Holiday day rate(%)");
      let sumOtHol = 0;
      let sumRegHol = 0;
      dateColumns.forEach(date => {
        if (isMacroRow) {
          const data = getAttendanceDataForDate(date);
          const rate = getVal(data, "ot_holiday_day_rate", "fpc_ot_holiday_day_rate");
          const totalReg = getVal(data, "total_register", "fpc_total_register");
          const isHoliday = granularity === "daily" ? data?.is_working_day === 0 : true;
          if (rate > 0 && isHoliday) {
            sumOtHol += (rate / 100) * (totalReg > 0 ? totalReg : 1);
            sumRegHol += (totalReg > 0 ? totalReg : 1);
            otHolValues.push(Math.round(rate * 100) / 10000);
          } else {
            otHolValues.push("-");
          }
        } else {
          otHolValues.push("-");
        }
      });
      if (showTotalColumn) {
        const avgRate = sumRegHol > 0 ? (sumOtHol / sumRegHol) : 0;
        otHolValues.push(sumRegHol > 0 ? Math.round(avgRate * 10000) / 10000 : "-");
      }
      const rOtHol = worksheet.addRow(otHolValues);
      applyRowStyling(rOtHol, { numFmt: "0.00%", fillColor: COLOR_OT_FILL, paramColor: "FF0E7490", totalColor: "FF0E7490" });
      otEndRowIdx = worksheet.rowCount;
    }

    if (showLeaveRows) {
      // Leave (psn)
      const leaveValues: (string | number)[] = createRowValues("Leave (psn)");
      let leaveCount = 0;
      let leaveSum = 0;
      dateColumns.forEach(date => {
        if (isMacroRow) {
          const data = getAttendanceDataForDate(date);
          const leavePsn = getVal(data, "leave", "fpc_leave");
          if (leavePsn > 0) {
            leaveCount++;
            leaveSum += leavePsn;
            leaveValues.push(Math.round(leavePsn));
          } else {
            leaveValues.push("-");
          }
        } else {
          leaveValues.push("-");
        }
      });
      if (showTotalColumn) {
        const avg = leaveCount > 0 ? Math.round(leaveSum / leaveCount) : 0;
        leaveValues.push(avg > 0 ? avg : "-");
      }
      const rLeave = worksheet.addRow(leaveValues);
      applyRowStyling(rLeave, { numFmt: "#,##0", fillColor: COLOR_LEAVE_FILL, paramColor: "FFC2410C", totalColor: "FFC2410C" });
      if (!leaveStartRowIdx) leaveStartRowIdx = worksheet.rowCount;
      leaveEndRowIdx = worksheet.rowCount;

      // Leave working day rate
      const leaveRateValues: (string | number)[] = createRowValues("Leave working day rate(%)");
      let sumLeaveWork = 0;
      let sumRegLeaveWork = 0;
      dateColumns.forEach(date => {
        if (isMacroRow) {
          const data = getAttendanceDataForDate(date);
          const rate = getVal(data, "leave_working_day_rate", "fpc_leave_working_day_rate");
          const totalReg = getVal(data, "total_register", "fpc_total_register");
          const isWorking = granularity === "daily" ? data?.is_working_day === 1 : true;
          if (rate > 0 && isWorking) {
            sumLeaveWork += (rate / 100) * (totalReg > 0 ? totalReg : 1);
            sumRegLeaveWork += (totalReg > 0 ? totalReg : 1);
            leaveRateValues.push(Math.round(rate * 100) / 10000);
          } else {
            leaveRateValues.push("-");
          }
        } else {
          leaveRateValues.push("-");
        }
      });
      if (showTotalColumn) {
        const avgRate = sumRegLeaveWork > 0 ? (sumLeaveWork / sumRegLeaveWork) : 0;
        leaveRateValues.push(sumRegLeaveWork > 0 ? Math.round(avgRate * 10000) / 10000 : "-");
      }
      const rLeaveRate = worksheet.addRow(leaveRateValues);
      applyRowStyling(rLeaveRate, { numFmt: "0.00%", fillColor: COLOR_LEAVE_FILL, paramColor: "FFC2410C", totalColor: "FFC2410C" });
      leaveEndRowIdx = worksheet.rowCount;
    }

    const endRowIdx = worksheet.rowCount;

    // --- Format & Merge Column B (Line Group) matching Image 2 ---
    if (endRowIdx >= startRowIdx) {
      const BORDER_COL2 = {
        top: { style: "dotted" as const, color: { argb: "FF94A3B8" } },
        bottom: { style: "dotted" as const, color: { argb: "FF94A3B8" } },
        left: { style: "medium" as const, color: { argb: "FF000000" } },
        right: { style: "thin" as const, color: { argb: "FF94A3B8" } },
      };

      if (isMacroFpcRow) {
        // Row 1: Macro FPC (Red Bold, Top-Left aligned, #DBEEF4)
        const fpcCell = worksheet.getCell(startRowIdx, 2);
        fpcCell.value = "Macro FPC";
        fpcCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFF0000" } };
        fpcCell.alignment = { vertical: "top", horizontal: "left" };
        fpcCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEEF4" } };
        fpcCell.border = BORDER_COL2;

        // Row 2: OP Work (Blue Bold, Middle-Left aligned, #DBEEF4)
        const opWorkCell = worksheet.getCell(startRowIdx + 1, 2);
        opWorkCell.value = "OP Work";
        opWorkCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E40AF" } };
        opWorkCell.alignment = { vertical: "middle", horizontal: "left" };
        opWorkCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEEF4" } };
        opWorkCell.border = BORDER_COL2;

        // Row 3: OP register (Blue Bold, Middle-Left aligned, #DBEEF4)
        const opRegCell = worksheet.getCell(startRowIdx + 2, 2);
        opRegCell.value = "OP register";
        opRegCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E40AF" } };
        opRegCell.alignment = { vertical: "middle", horizontal: "left" };
        opRegCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEEF4" } };
        opRegCell.border = BORDER_COL2;

        // Remaining production rows in Col 2 (Merged from Row startRowIdx + 3 .. prodEndRowIdx)
        if (prodEndRowIdx >= startRowIdx + 3) {
          worksheet.mergeCells(startRowIdx + 3, 2, prodEndRowIdx, 2);
          const remCell = worksheet.getCell(startRowIdx + 3, 2);
          remCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEEF4" } };
          remCell.border = BORDER_COL2;
        }
      } else if (isMacroPcnRow) {
        // Macro PCN: Merge Col 2 across production rows with soft peach fill (#FDE9D9)
        worksheet.mergeCells(startRowIdx, 2, prodEndRowIdx, 2);
        const pcnCell = worksheet.getCell(startRowIdx, 2);
        pcnCell.value = "Macro PCN";
        pcnCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFF0000" } };
        pcnCell.alignment = { vertical: "top", horizontal: "left" };
        pcnCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE9D9" } };
        pcnCell.border = BORDER_COL2;
      } else {
        // Standard lines: Merge Col 2 across production rows with white fill
        worksheet.mergeCells(startRowIdx, 2, prodEndRowIdx, 2);
        const lineCell = worksheet.getCell(startRowIdx, 2);
        lineCell.value = displayLineTitle;
        lineCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFF0000" } };
        lineCell.alignment = { vertical: "top", horizontal: "left" };
        lineCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        lineCell.border = BORDER_COL2;
      }

      // Merge Col 2 for OT rows (Soft Yellow fill #FFFFF2CC)
      if (otStartRowIdx && otEndRowIdx >= otStartRowIdx) {
        worksheet.mergeCells(otStartRowIdx, 2, otEndRowIdx, 2);
        const otCell = worksheet.getCell(otStartRowIdx, 2);
        otCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_OT_FILL } };
        otCell.border = BORDER_COL2;
      }

      // Merge Col 2 for Leave rows (Soft Orange/Peach fill #FFFCE4D6)
      if (leaveStartRowIdx && leaveEndRowIdx >= leaveStartRowIdx) {
        worksheet.mergeCells(leaveStartRowIdx, 2, leaveEndRowIdx, 2);
        const leaveCell = worksheet.getCell(leaveStartRowIdx, 2);
        leaveCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_LEAVE_FILL } };
        leaveCell.border = BORDER_COL2;
      }

      // Apply Medium Outer Borders to the Line Group Block (Cols 2 .. totalColsCount)
      for (let c = 2; c <= totalColsCount; c++) {
        const topCell = worksheet.getCell(startRowIdx, c);
        topCell.border = {
          ...topCell.border,
          top: { style: "medium", color: { argb: "FF000000" } },
        };
        const bottomCell = worksheet.getCell(endRowIdx, c);
        bottomCell.border = {
          ...bottomCell.border,
          bottom: { style: "medium", color: { argb: "FF000000" } },
        };
      }
      for (let r = startRowIdx; r <= endRowIdx; r++) {
        // Col 1 (Spacer) has no border
        worksheet.getCell(r, 1).border = {};

        const leftCell = worksheet.getCell(r, 2);
        leftCell.border = {
          ...leftCell.border,
          left: { style: "medium", color: { argb: "FF000000" } },
        };
        const rightCell = worksheet.getCell(r, totalColsCount);
        rightCell.border = {
          ...rightCell.border,
          right: { style: "medium", color: { argb: "FF000000" } },
        };
      }
    }

    // Add 2 blank spacer rows between lines for clear separation
    if (lineIdx < linesToExport.length - 1) {
      const spacerRow1 = worksheet.addRow([]);
      spacerRow1.height = 18;
      const spacerRow2 = worksheet.addRow([]);
      spacerRow2.height = 18;
    }
  });

  // 5. Generate and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  const startFmt = dayjs(startDate).format("YYYYMMDD");
  const endFmt = dayjs(endDate).format("YYYYMMDD");
  link.download = `Productivity_${selectedFactory || "ALL"}_${startFmt}_${endFmt}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
