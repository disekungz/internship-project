import dayjs from "dayjs";
import { LineGroupRow, OutputUnit, Granularity } from "../types";
import { normalizeMatrixLineGroupName } from "../hooks/useProcessOutputData";
import { getCachedCustomMacroLines, getCustomMacroOutputSources } from "./customMacroStore";
import { getFiscalQuarter, getProductionWeekKey } from "./fiscalYear";

export interface PlanMapsResult {
  pPlanMap: Map<string, Map<string, number>>;
  sPlanMap: Map<string, Map<string, number>>;
  lPlanMap: Map<string, Map<string, number>>;
  getLinePlan: (lineName: string, unit?: OutputUnit) => Map<string, number>;
}

export const buildPlanMaps = (
  rows: LineGroupRow[],
  granularity: Granularity,
  aggregatedAttendanceData?: Record<string, any>
): PlanMapsResult => {
  const pPlanMap = new Map<string, Map<string, number>>();
  const sPlanMap = new Map<string, Map<string, number>>();
  const lPlanMap = new Map<string, Map<string, number>>();

  const macroFpcLines = [
    "LINE NPM", "NPM_FPC", "NPM", "LINE A", "LINE B_GEN", "LINE B_NON", "LINE B_JDT", "LINE C", "LINE D"
  ];
  const macroSmtLines = [
    "ASY1_A", "ASY1_AUTO", "LINE ASY1_A", "ASSY 1 (AUTOMOTIVE)",
    "ASY1_G", "ASY1_GEN", "LINE ASY1_G", "ASSY 1 (GENERAL)", "ASSY1_GEN", "ASY1 GEN",
    "ASY2", "LINE ASY2",
    "ASY3", "LINE ASY3",
    "AIX-ASY", "AIX_ASY", "LINE AIX-ASY"
  ];

  // 1. Populate plan from rows
  rows.forEach(row => {
    let dateKey = row.date;
    const isPrecomputedPeriod = row.date.includes("-W") || row.date.includes("-Q") || (row.date.length === 7 && row.date.includes("-")) || row.date.length === 4;
    if (!isPrecomputedPeriod) {
      const parsed = dayjs(row.date);
      if (parsed.isValid()) {
        if (granularity === "yearly") dateKey = parsed.format("YYYY");
        else if (granularity === "quarterly") dateKey = getFiscalQuarter(parsed);
        else if (granularity === "monthly") dateKey = parsed.format("YYYY-MM");
        else if (granularity === "weekly") dateKey = getProductionWeekKey(parsed);
        else dateKey = parsed.format("YYYY-MM-DD");
      }
    }

    const normLine = normalizeMatrixLineGroupName(row.lineGroup || "").toUpperCase();
    if (!normLine) return;

    const rowAny = row as any;
    const pPlan = Number(rowAny.piece_plan ?? (row.mcLine === "MANUAL_EXCEL" ? row.planQty : (row.planQty || 0)) ?? 0);
    const sPlan = Number(rowAny.sht_plan ?? 0);
    const lPlan = Number(rowAny.lot_plan ?? 0);

    if (pPlan > 0 || sPlan > 0 || lPlan > 0 || row.mcLine === "MANUAL_EXCEL") {
      if (!pPlanMap.has(normLine)) pPlanMap.set(normLine, new Map());
      if (!sPlanMap.has(normLine)) sPlanMap.set(normLine, new Map());
      if (!lPlanMap.has(normLine)) lPlanMap.set(normLine, new Map());

      if (pPlan > 0) pPlanMap.get(normLine)!.set(dateKey, (pPlanMap.get(normLine)!.get(dateKey) || 0) + pPlan);
      if (sPlan > 0) sPlanMap.get(normLine)!.set(dateKey, (sPlanMap.get(normLine)!.get(dateKey) || 0) + sPlan);
      if (lPlan > 0) lPlanMap.get(normLine)!.set(dateKey, (lPlanMap.get(normLine)!.get(dateKey) || 0) + lPlan);
    }
  });

  // 2. Populate plan from aggregated attendance byLine if available
  if (aggregatedAttendanceData) {
    Object.entries(aggregatedAttendanceData).forEach(([dateKey, attObj]: [string, any]) => {
      if (attObj?.byLine) {
        Object.entries(attObj.byLine).forEach(([lineKey, metrics]: [string, any]) => {
          const norm = normalizeMatrixLineGroupName(lineKey).toUpperCase();
          const pPlan = Number(metrics.piece_plan || 0);
          const sPlan = Number(metrics.sht_plan || 0);
          const lPlan = Number(metrics.lot_plan || 0);

          if (pPlan > 0) {
            if (!pPlanMap.has(norm)) pPlanMap.set(norm, new Map());
            pPlanMap.get(norm)!.set(dateKey, Math.max(pPlanMap.get(norm)!.get(dateKey) || 0, pPlan));
          }
          if (sPlan > 0) {
            if (!sPlanMap.has(norm)) sPlanMap.set(norm, new Map());
            sPlanMap.get(norm)!.set(dateKey, Math.max(sPlanMap.get(norm)!.get(dateKey) || 0, sPlan));
          }
          if (lPlan > 0) {
            if (!lPlanMap.has(norm)) lPlanMap.set(norm, new Map());
            lPlanMap.get(norm)!.set(dateKey, Math.max(lPlanMap.get(norm)!.get(dateKey) || 0, lPlan));
          }
        });
      }
    });
  }

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

  const sumMaps = (sourceMap: Map<string, Map<string, number>>, keys: string[]) => {
    const res = new Map<string, number>();
    const seen = new Set<string>();
    keys.forEach(k => {
      const raw = k.trim().toUpperCase();
      const norm = normalizeMatrixLineGroupName(k).toUpperCase();
      const noLine = raw.replace(/^LINE\s+/i, '');
      const withLine = raw.startsWith('LINE ') ? raw : `LINE ${raw}`;

      const candidates = [norm, raw, noLine, withLine];
      for (const candidate of candidates) {
        if (seen.has(candidate)) break;
        const found = sourceMap.get(candidate);
        if (found && found.size > 0) {
          candidates.forEach(c => seen.add(c));
          found.forEach((v, d) => res.set(d, (res.get(d) || 0) + v));
          break;
        }
      }
    });
    return res;
  };

  const rollupPlan = (targetMap: Map<string, Map<string, number>>, aliasMap: Record<string, string[]>) => {
    Object.entries(aliasMap).forEach(([target, sources]) => {
      const merged = sumMaps(targetMap, sources);
      if (merged.size > 0) {
        targetMap.set(target.toUpperCase(), merged);
      }
    });
  };

  // 3. Macro line rollups
  const macroFpcPlanPcs = sumMaps(pPlanMap, macroFpcLines);
  const macroFpcPlanSht = sumMaps(sPlanMap, macroFpcLines);
  const macroFpcPlanLot = sumMaps(lPlanMap, macroFpcLines);
  ["Macro FPC", "MACRO FPC", "Direct FPC", "DIRECT FPC"].forEach(name => {
    if (macroFpcPlanPcs.size > 0) pPlanMap.set(name.toUpperCase(), macroFpcPlanPcs);
    if (macroFpcPlanSht.size > 0) sPlanMap.set(name.toUpperCase(), macroFpcPlanSht);
    if (macroFpcPlanLot.size > 0) lPlanMap.set(name.toUpperCase(), macroFpcPlanLot);
  });

  const macroSmtPlanPcs = sumMaps(pPlanMap, macroSmtLines);
  const macroSmtPlanSht = sumMaps(sPlanMap, macroSmtLines);
  const macroSmtPlanLot = sumMaps(lPlanMap, macroSmtLines);
  ["Macro SMT", "MACRO SMT", "Direct SMT", "DIRECT SMT"].forEach(name => {
    if (macroSmtPlanPcs.size > 0) pPlanMap.set(name.toUpperCase(), macroSmtPlanPcs);
    if (macroSmtPlanSht.size > 0) sPlanMap.set(name.toUpperCase(), macroSmtPlanSht);
    if (macroSmtPlanLot.size > 0) lPlanMap.set(name.toUpperCase(), macroSmtPlanLot);
  });

  const macroPcnPlanPcs = sumMaps(pPlanMap, [...macroFpcLines, ...macroSmtLines]);
  const macroPcnPlanSht = sumMaps(sPlanMap, [...macroFpcLines, ...macroSmtLines]);
  const macroPcnPlanLot = sumMaps(lPlanMap, [...macroFpcLines, ...macroSmtLines]);
  ["Macro PCN", "MACRO PCN"].forEach(name => {
    if (macroPcnPlanPcs.size > 0) pPlanMap.set(name.toUpperCase(), macroPcnPlanPcs);
    if (macroPcnPlanSht.size > 0) sPlanMap.set(name.toUpperCase(), macroPcnPlanSht);
    if (macroPcnPlanLot.size > 0) lPlanMap.set(name.toUpperCase(), macroPcnPlanLot);
  });

  // Synchronize Plan for LINE A / LINE A_FINAL
  const lineAFinalPlanPcs = getAliasMap(pPlanMap, ["LINE A_FINAL", "LINE A", "A"]);
  const lineAFinalPlanSht = getAliasMap(sPlanMap, ["LINE A_FINAL", "LINE A", "A"]);
  const lineAFinalPlanLot = getAliasMap(lPlanMap, ["LINE A_FINAL", "LINE A", "A"]);
  if (lineAFinalPlanPcs.size > 0) {
    pPlanMap.set("LINE A_FINAL", lineAFinalPlanPcs);
    pPlanMap.set("LINE A", lineAFinalPlanPcs);
  }
  if (lineAFinalPlanSht.size > 0) {
    sPlanMap.set("LINE A_FINAL", lineAFinalPlanSht);
    sPlanMap.set("LINE A", lineAFinalPlanSht);
  }
  if (lineAFinalPlanLot.size > 0) {
    lPlanMap.set("LINE A_FINAL", lineAFinalPlanLot);
    lPlanMap.set("LINE A", lineAFinalPlanLot);
  }

  // Synchronize Plan for SMT FRONT
  const smtFrontPlanPcs = getAliasMap(pPlanMap, ["MACRO SMT_F", "Macro SMT_F", "SMT FRONT_DIRECT", "SMT Front_Direct"]);
  if (smtFrontPlanPcs.size > 0) {
    ["MACRO SMT_F", "Macro SMT_F", "SMT FRONT_DIRECT", "SMT Front_Direct"].forEach(name => {
      pPlanMap.set(name.toUpperCase(), smtFrontPlanPcs);
      pPlanMap.set(name, smtFrontPlanPcs);
    });
  }
  const smtFrontPlanSht = getAliasMap(sPlanMap, ["MACRO SMT_F", "Macro SMT_F", "SMT FRONT_DIRECT", "SMT Front_Direct"]);
  if (smtFrontPlanSht.size > 0) {
    ["MACRO SMT_F", "Macro SMT_F", "SMT FRONT_DIRECT", "SMT Front_Direct"].forEach(name => {
      sPlanMap.set(name.toUpperCase(), smtFrontPlanSht);
      sPlanMap.set(name, smtFrontPlanSht);
    });
  }
  const smtFrontPlanLot = getAliasMap(lPlanMap, ["MACRO SMT_F", "Macro SMT_F", "SMT FRONT_DIRECT", "SMT Front_Direct"]);
  if (smtFrontPlanLot.size > 0) {
    ["MACRO SMT_F", "Macro SMT_F", "SMT FRONT_DIRECT", "SMT Front_Direct"].forEach(name => {
      lPlanMap.set(name.toUpperCase(), smtFrontPlanLot);
      lPlanMap.set(name, smtFrontPlanLot);
    });
  }

  // Synchronize Plan for SMT BACK (Direct SMT, SMT BACK_DIRECT, and Macro SMT_B share identical plan)
  const directSmtPlanPcs = macroSmtPlanPcs.size > 0 ? macroSmtPlanPcs : getAliasMap(pPlanMap, ["MACRO SMT_B", "Macro SMT_B", "DIRECT SMT", "Direct SMT", "SMT BACK_DIRECT", "SMT Back_Direct"]);
  if (directSmtPlanPcs.size > 0) {
    ["DIRECT SMT", "Direct SMT", "SMT BACK_DIRECT", "SMT Back_Direct", "Macro SMT_B", "MACRO SMT_B"].forEach(name => {
      pPlanMap.set(name.toUpperCase(), directSmtPlanPcs);
      pPlanMap.set(name, directSmtPlanPcs);
    });
  }
  const directSmtPlanSht = macroSmtPlanSht.size > 0 ? macroSmtPlanSht : getAliasMap(sPlanMap, ["MACRO SMT_B", "Macro SMT_B", "DIRECT SMT", "Direct SMT", "SMT BACK_DIRECT", "SMT Back_Direct"]);
  if (directSmtPlanSht.size > 0) {
    ["DIRECT SMT", "Direct SMT", "SMT BACK_DIRECT", "SMT Back_Direct", "Macro SMT_B", "MACRO SMT_B"].forEach(name => {
      sPlanMap.set(name.toUpperCase(), directSmtPlanSht);
      sPlanMap.set(name, directSmtPlanSht);
    });
  }
  const directSmtPlanLot = macroSmtPlanLot.size > 0 ? macroSmtPlanLot : getAliasMap(lPlanMap, ["MACRO SMT_B", "Macro SMT_B", "DIRECT SMT", "Direct SMT", "SMT BACK_DIRECT", "SMT Back_Direct"]);
  if (directSmtPlanLot.size > 0) {
    ["DIRECT SMT", "Direct SMT", "SMT BACK_DIRECT", "SMT Back_Direct", "Macro SMT_B", "MACRO SMT_B"].forEach(name => {
      lPlanMap.set(name.toUpperCase(), directSmtPlanLot);
      lPlanMap.set(name, directSmtPlanLot);
    });
  }

  rollupPlan(pPlanMap, {
    "LINE MAS & REW": ["MAS", "LINE MAS", "REW", "LINE REW"],
    "MAS & REW": ["MAS", "LINE MAS", "REW", "LINE REW"],
    "LINE VAC & HPS": ["VAC", "LINE VAC"],
    "LINE B": ["LINE B_GEN", "B_GEN", "LINE B_NON", "B_NON"],
    "QA FPC": ["OQI_F-AUTO", "OQI_F-GEN", "QA FPC AUTO", "QA_FPC_AUTO", "QA FPC GEN", "QA_FPC_GEN", "QA FPC"],
    "QA SMT": ["OQI_S-AUTO", "OQI_S-GEN", "QA SMT AUTO", "QA_SMT_AUTO", "QA SMT GEN", "QA_SMT_GEN", "QA SMT", "MQA"],
    "MQA": ["OQI_S-AUTO", "OQI_S-GEN", "QA SMT AUTO", "QA_SMT_AUTO", "QA SMT GEN", "QA_SMT_GEN", "QA SMT", "MQA"],
    "AIX-BLK": ["AIX-ASY", "AIX_ASY", "AIXZ", "LINE AIX-ASY", "AIX-BLK", "LINE AIX-BLK"],
    "Automotive": ["ASY1_A", "LINE ASY1_A", "ASY1_AUTO", "ASSY1_AUTO", "ASSY 1 (AUTOMOTIVE)", "LINE ASY1_AUTO"],
    "MD LAM": ["MD LAM", "LINE MD LAM", "MD_LAM", "LAM MD", "LAM_MD"],
    "LINE SMT_LAM": ["LINE SMT_LAM", "SMT_LAM", "LINE SMT LAM", "SMT LAM", "LAM"],
    "ASY SMT": ["LINE ASY1_A", "ASY1_A", "ASY1_AUTO", "LINE ASY1_G", "ASY1_G", "ASY1_GEN", "LINE ASY2", "ASY2", "LINE ASY3", "ASY3", "AIX-ASY", "AIX_ASY", "LINE AIX-ASY", "ASY4", "ASSY4", "ASY SMT"]
  });

  rollupPlan(sPlanMap, {
    "LINE B": ["LINE B_GEN", "B_GEN", "LINE B_NON", "B_NON"],
    "LINE VAC & HPS": ["VAC", "LINE VAC"]
  });

  // Custom Macro Lines Plan Rollup
  const customMacros = getCachedCustomMacroLines();
  if (customMacros && customMacros.length > 0) {
    customMacros.forEach(macro => {
      const sources = getCustomMacroOutputSources(macro);
      if (sources && sources.length > 0) {
        const pPlanMerged = sumMaps(pPlanMap, sources);
        if (pPlanMerged.size > 0) pPlanMap.set(macro.macro_name.toUpperCase(), pPlanMerged);
        const sPlanMerged = sumMaps(sPlanMap, sources);
        if (sPlanMerged.size > 0) sPlanMap.set(macro.macro_name.toUpperCase(), sPlanMerged);
        const lPlanMerged = sumMaps(lPlanMap, sources);
        if (lPlanMerged.size > 0) lPlanMap.set(macro.macro_name.toUpperCase(), lPlanMerged);
      }
    });
  }

  const getLinePlan = (lineName: string, unit: OutputUnit = "piece"): Map<string, number> => {
    const isSht = unit === "sht" || (unit as string) === "sheet";
    const isLot = unit === "lot";
    const targetMap = isSht ? sPlanMap : isLot ? lPlanMap : pPlanMap;

    const raw = lineName.trim().toUpperCase();
    const norm = normalizeMatrixLineGroupName(lineName).trim().toUpperCase();
    const noLine = raw.replace(/^LINE\s+/i, "");
    const withLine = raw.startsWith("LINE ") ? raw : `LINE ${raw}`;

    if (targetMap.has(raw)) return targetMap.get(raw)!;
    if (targetMap.has(norm)) return targetMap.get(norm)!;
    if (targetMap.has(noLine)) return targetMap.get(noLine)!;
    if (targetMap.has(withLine)) return targetMap.get(withLine)!;

    if (raw.includes("AVI") || norm.includes("AVI")) {
      const aviAliases = ["AVI/K2", "AVI_K2", "AVI_INS", "LINE AVI/K2", "LINE_AVI_K2"];
      for (const a of aviAliases) {
        if (targetMap.has(a) && targetMap.get(a)!.size > 0) return targetMap.get(a)!;
      }
    }

    if (raw === "LINE A_FINAL" || norm === "LINE A_FINAL" || raw === "A_FINAL") {
      const aPlan = targetMap.get("LINE A") || targetMap.get("A");
      if (aPlan && aPlan.size > 0) return aPlan;
    }
    if (raw === "LINE A" || norm === "LINE A" || raw === "A") {
      const aFinPlan = targetMap.get("LINE A_FINAL") || targetMap.get("A_FINAL");
      if (aFinPlan && aFinPlan.size > 0) return aFinPlan;
    }

    if (raw === "AUTOMOTIVE" || raw === "AUTOMATIVE") {
      return targetMap.get("AUTOMOTIVE") || targetMap.get("Automotive") || targetMap.get("LINE ASY1_A") || targetMap.get("ASY1_A") || targetMap.get("ASY1_AUTO") || new Map();
    }
    if (raw === "SMT FRONT_DIRECT" || raw === "SMT FRONT DIRECT" || raw === "SMT FRONT_INDIRECT" || raw === "SMT_FRONT_DIRECT" || raw === "SMT FRONT" || raw === "MACRO SMT_F" || raw === "MACRO SMT-F") {
      return targetMap.get("SMT FRONT_DIRECT") || targetMap.get("SMT Front_Direct") || targetMap.get("Macro SMT_F") || targetMap.get("MACRO SMT_F") || new Map();
    }
    if (raw === "DIRECT SMT" || raw === "DIRECT_SMT") {
      return targetMap.get("DIRECT SMT") || targetMap.get("Direct SMT") || new Map();
    }
    if (raw === "SMT BACK_DIRECT" || raw === "SMT BACK DIRECT" || raw === "SMT_BACK_DIRECT" || raw === "SMT BACK" || raw === "MACRO SMT_B" || raw === "MACRO SMT-B") {
      return targetMap.get("SMT BACK_DIRECT") || targetMap.get("SMT Back_Direct") || targetMap.get("Macro SMT_B") || targetMap.get("MACRO SMT_B") || new Map();
    }
    if (raw === "MD LAM" || raw === "MD_LAM" || raw === "LINE MD LAM" || raw === "LAM MD" || raw === "LAM_MD") {
      return targetMap.get("MD LAM") || targetMap.get("LINE MD LAM") || targetMap.get("MD_LAM") || new Map();
    }
    if (raw === "LINE SMT_LAM" || raw === "SMT_LAM" || raw === "LINE SMT LAM" || raw === "SMT LAM" || raw === "LAM") {
      return targetMap.get("LINE SMT_LAM") || targetMap.get("SMT_LAM") || targetMap.get("LINE SMT LAM") || targetMap.get("SMT LAM") || new Map();
    }

    return new Map<string, number>();
  };

  return { pPlanMap, sPlanMap, lPlanMap, getLinePlan };
};
