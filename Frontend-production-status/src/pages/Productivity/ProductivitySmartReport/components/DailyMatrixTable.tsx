import React, { useMemo, useState, useCallback, useEffect } from "react";
import { LineGroupRow, OutputUnit, OUTPUT_UNITS, Granularity, DEFAULT_LINE_GROUPS, LineGroup } from "../types";
import { CalendarDays, Edit2, Save, RotateCcw, X, FileSpreadsheet } from "lucide-react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import { getMappedAttendanceValue, checkIsMacroRow } from "../utils/attendanceMapper";

import { useMatrixAggregation } from "../hooks/useMatrixAggregation";
import { normalizeMatrixLineGroupName } from "../hooks/useProcessOutputData";
import { getCachedCustomMacroLines, getCustomMacroOutputSources } from "../utils/customMacroStore";
import { fetchCustomLineNames, fetchDynamicLines, fetchCustomLineOrder } from "../../../../utils/apiConfig";
import { getFiscalQuarter, getProductionWeekKey } from "../utils/fiscalYear";
import { exportProductivityMatrixExcel } from "../utils/exportMatrixToExcel";
import { DailyMatrixTableSkeleton } from "./ProductivitySkeletons";
import Swal from "sweetalert2";

dayjs.extend(isoWeek);
dayjs.extend(quarterOfYear);

interface DailyMatrixTableProps {
  rows: LineGroupRow[];
  startDate: string;
  endDate: string;
  selectedUnit: OutputUnit;
  granularity: Granularity;
  calendarData?: Record<string, number>;
  attendanceData?: Record<string, any>;
  lineGroups?: LineGroup[];
  selectedLineGroup?: string[] | "ALL";
  selectedFactory?: string;
  hiddenTables?: string[];
  matrixData?: [string, Map<string, number>][];
  dateColumns?: string[];
  aggregatedAttendanceData?: Record<string, any>;
  isLoading?: boolean;
  onOpenExportModal?: () => void;
  targetData?: any[];
  matDailyData?: any[];
}

type MatrixViewMode = "full" | "compact" | "focus";
type FocusMetric = "production" | "productivity" | "ot" | "leave";

export const DailyMatrixTable: React.FC<DailyMatrixTableProps> = React.memo(({
  rows,
  startDate,
  endDate,
  selectedUnit,
  granularity,
  calendarData,
  attendanceData,
  lineGroups,
  selectedLineGroup,
  selectedFactory,
  hiddenTables,
  matrixData: precomputedMatrixData,
  dateColumns: precomputedDateColumns,
  aggregatedAttendanceData: precomputedAggregatedAttendanceData,
  isLoading,
  onOpenExportModal,
  targetData,
  matDailyData,
}) => {
  const [viewMode, setViewMode] = useState<MatrixViewMode>("full");
  const [focusMetric, setFocusMetric] = useState<FocusMetric>("production");
  const selectedUnitMeta = OUTPUT_UNITS.find(u => u.key === selectedUnit) || OUTPUT_UNITS[0];

  const [customLineNames, setCustomLineNames] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("productivity_custom_line_names");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  React.useEffect(() => {
    fetchCustomLineNames().then((data) => {
      fetchDynamicLines().then((dynLines) => {
        const combined = { ...data };
        if (Array.isArray(dynLines)) {
          dynLines.forEach(dl => {
            if (dl.line_name && dl.display_name) {
              combined[dl.line_name] = dl.display_name;
              combined[dl.id] = dl.display_name;
            }
          });
        }
        if (Object.keys(combined).length > 0) {
          setCustomLineNames(combined);
          try {
            localStorage.setItem("productivity_custom_line_names", JSON.stringify(combined));
          } catch (e) {}
        }
      });
    });

    const handleSync = () => {
      try {
        const saved = localStorage.getItem("productivity_custom_line_names");
        setCustomLineNames(saved ? JSON.parse(saved) : {});
      } catch (e) {}
    };
    window.addEventListener("line-names-updated", handleSync);
    return () => window.removeEventListener("line-names-updated", handleSync);
  }, []);

  const [customLineOrder, setCustomLineOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("productivity_custom_line_order");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    fetchCustomLineOrder().then((order) => {
      if (order && order.length > 0) {
        setCustomLineOrder(order);
        try {
          localStorage.setItem("productivity_custom_line_order", JSON.stringify(order));
        } catch (e) {}
      }
    });

    const handleOrderSync = () => {
      try {
        const saved = localStorage.getItem("productivity_custom_line_order");
        setCustomLineOrder(saved ? JSON.parse(saved) : []);
      } catch (e) {}
    };
    window.addEventListener("line-order-updated", handleOrderSync);
    return () => window.removeEventListener("line-order-updated", handleOrderSync);
  }, []);

  // Only run aggregation if precomputed data wasn't provided from parent
  const fallbackAggregation = useMatrixAggregation(
    precomputedMatrixData && precomputedDateColumns && precomputedAggregatedAttendanceData
      ? { rows: [], startDate, endDate, selectedUnit, granularity }
      : { rows, startDate, endDate, selectedUnit, granularity, calendarData, attendanceData }
  );

  const dateColumns = precomputedDateColumns || fallbackAggregation.dateColumns;
  const aggregatedAttendanceData = precomputedAggregatedAttendanceData || fallbackAggregation.aggregatedAttendanceData;
  const rawMatrixData = precomputedMatrixData || fallbackAggregation.matrixData;

  const isLineGroupHidden = useCallback((lineGroup: string): boolean => {
    if (!hiddenTables || hiddenTables.length === 0) return false;
    
    const norm = normalizeMatrixLineGroupName(lineGroup).toUpperCase();
    const raw = lineGroup.trim().toUpperCase();
    const rawNoLine = raw.replace(/^LINE\s+/, "");
    const rawUnderscore = raw.replace(/\s+/g, "_").replace(/-/g, "_");

    return hiddenTables.some(hiddenId => {
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

      // MD LAM
      if (
        (raw === "MD LAM" || raw === "LINE MD LAM" || raw === "MD_LAM") &&
        (hRaw === "MD LAM" || hRaw === "LINE MD LAM" || hRaw === "MD_LAM")
      ) return true;

      // MAS & REW
      if (
        (raw === "LINE MAS & REW" || raw === "MAS & REW" || raw === "LINE MAS & LINE REW") &&
        (hRaw === "LINE MAS & REW" || hRaw === "MAS & REW" || hRaw === "LINE MAS & LINE REW")
      ) return true;

      // AIX-ASY aliases
      if (
        (raw.includes("AIX-ASY") || raw.includes("AIX_ASY") || raw.includes("ASY4") || raw.includes("ASSY4")) &&
        (hRaw.includes("AIX-ASY") || hRaw.includes("AIX_ASY") || hRaw.includes("ASY4") || hRaw.includes("ASSY4"))
      ) return true;

      // S_IND
      if (
        (raw === "LINE S_IND" || raw === "S_IND" || raw === "SMT BACK_INDIRECT") &&
        (hRaw === "LINE S_IND" || hRaw === "S_IND" || hRaw === "SMT BACK_INDIRECT")
      ) return true;

      return false;
    });
  }, [hiddenTables]);

  const matrixData = useMemo(() => {
    let filtered: [string, Map<string, number>][] = [];

    // 1. If user explicitly selected lines in the filter dropdown, show them directly regardless of hidden settings
    if (selectedLineGroup && selectedLineGroup !== "ALL" && selectedLineGroup.length > 0) {
      const selectedSet = new Set(
        selectedLineGroup.map(name => normalizeMatrixLineGroupName(name).toUpperCase())
      );
      filtered = rawMatrixData.filter(([lineGroup]) => {
        const lineUpper = lineGroup.trim().toUpperCase();
        const normUpper = normalizeMatrixLineGroupName(lineGroup).trim().toUpperCase();
        if (lineUpper === "LAM_NIDEC" || normUpper === "LAM_NIDEC") return false;
        return selectedSet.has(normUpper) || selectedSet.has(lineUpper) || selectedLineGroup.includes(lineGroup);
      });
    } else {
      // 2. Otherwise (All lines view), apply table visibility hidden list
      filtered = rawMatrixData.filter(([lineGroup]) => {
        const lineUpper = lineGroup.trim().toUpperCase();
        const normUpper = normalizeMatrixLineGroupName(lineGroup).trim().toUpperCase();
        if (lineUpper === "LAM_NIDEC" || normUpper === "LAM_NIDEC") return false;
        if (isLineGroupHidden(lineGroup)) return false;
        return true;
      });
    }

    if (customLineOrder && customLineOrder.length > 0) {
      const orderMap = new Map<string, number>();
      customLineOrder.forEach((key, idx) => {
        orderMap.set(key.trim().toUpperCase(), idx);
        orderMap.set(normalizeMatrixLineGroupName(key).trim().toUpperCase(), idx);
      });

      return [...filtered].sort((a, b) => {
        const aKey = a[0].trim().toUpperCase();
        const aNorm = normalizeMatrixLineGroupName(a[0]).trim().toUpperCase();
        const bKey = b[0].trim().toUpperCase();
        const bNorm = normalizeMatrixLineGroupName(b[0]).trim().toUpperCase();

        const aIdx = orderMap.has(aKey) ? orderMap.get(aKey)! : (orderMap.has(aNorm) ? orderMap.get(aNorm)! : 9999);
        const bIdx = orderMap.has(bKey) ? orderMap.get(bKey)! : (orderMap.has(bNorm) ? orderMap.get(bNorm)! : 9999);

        if (aIdx !== bIdx) return aIdx - bIdx;
        return 0;
      });
    }

    return filtered;
  }, [rawMatrixData, selectedLineGroup, isLineGroupHidden, customLineOrder]);

  const { pMap, sMap, lMap, pPlanMap, sPlanMap, lPlanMap } = useMemo(() => {
    const pMap = new Map<string, Map<string, number>>();
    const sMap = new Map<string, Map<string, number>>();
    const lMap = new Map<string, Map<string, number>>();

    const pPlanMap = new Map<string, Map<string, number>>();
    const sPlanMap = new Map<string, Map<string, number>>();
    const lPlanMap = new Map<string, Map<string, number>>();

    const macroFpcLines = [
      "LINE NPM", "NPM_FPC", "NPM", "LINE A", "LINE B_GEN", "LINE B_NON", "LINE B_JDT", "LINE C", "LINE D"
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

        if (row.mcLine === "MANUAL_EXCEL") return;
      }

      const pQty = Number(row.pieceQty || 0);
      const sQty = Number(row.shtQty || 0);
      const lQty = Number(row.lotQty || 0);

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

    // Populate plan from aggregated attendance byLine if available
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

    // Output Rollups
    ["Macro FPC", "MACRO FPC", "Direct FPC", "DIRECT FPC"].forEach(name => {
      pMap.set(name.toUpperCase(), macroFpcPcs);
      sMap.set(name.toUpperCase(), macroFpcSht);
      lMap.set(name.toUpperCase(), macroFpcLot);
    });

    const smtFrontPcs = sumMaps(pMap, ["MOTA_A", "MOTA_G", "MOTB", "AIX-MOT", "MOTC", "MOTD"]);
    const smtFrontSht = sumMaps(sMap, ["MOTA_A", "MOTA_G", "MOTB", "AIX-MOT", "MOTC", "MOTD"]);
    const smtFrontLot = sumMaps(lMap, ["MOTA_A", "MOTA_G", "MOTB", "AIX-MOT", "MOTC", "MOTD"]);

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

    const lineVacHpsPcs = sumMaps(pMap, ["LINE VAC"]);
    const lineVacHpsSht = sumMaps(sMap, ["LINE VAC"]);
    const lineVacHpsLot = sumMaps(lMap, ["LINE VAC"]);
    pMap.set("LINE VAC & HPS", lineVacHpsPcs);
    sMap.set("LINE VAC & HPS", lineVacHpsSht);
    lMap.set("LINE VAC & HPS", lineVacHpsLot);

    // For Line REW, use Plan as Output
    const rewPlanPcs = pPlanMap.get("REW") || pPlanMap.get("LINE REW");
    if (rewPlanPcs && rewPlanPcs.size > 0) {
      const rewOutPcs = pMap.get("REW") || pMap.get("LINE REW") || new Map<string, number>();
      rewPlanPcs.forEach((val, date) => {
        if (!rewOutPcs.has(date) || (rewOutPcs.get(date) || 0) === 0) {
          rewOutPcs.set(date, val);
        }
      });
      pMap.set("REW", rewOutPcs);
      pMap.set("LINE REW", rewOutPcs);
    }

    const lineMasRewPcs = sumMaps(pMap, ["MAS", "REW"]);
    const lineMasRewSht = sumMaps(sMap, ["MAS", "REW"]);
    const lineMasRewLot = sumMaps(lMap, ["MAS", "REW"]);
    pMap.set("LINE MAS & REW", lineMasRewPcs);
    sMap.set("LINE MAS & REW", lineMasRewSht);
    lMap.set("LINE MAS & REW", lineMasRewLot);
    pMap.set("MAS & REW", lineMasRewPcs);
    sMap.set("MAS & REW", lineMasRewSht);
    lMap.set("MAS & REW", lineMasRewLot);

    const qaFpcPcs = sumMaps(pMap, ["OQI_F-AUTO", "OQI_F-GEN"]);
    pMap.set("QA FPC", qaFpcPcs);
    const qaSmtPcs = sumMaps(pMap, ["OQI_S-AUTO", "OQI_S-GEN"]);
    pMap.set("QA SMT", qaSmtPcs);
    pMap.set("MQA", qaSmtPcs);

    // Rollup ASY SMT (including AIX-ASY)
    const asySmtSources = ["ASY1_A", "LINE ASY1_A", "ASY1_G", "LINE ASY1_G", "ASY2", "LINE ASY2", "ASY3", "LINE ASY3", "AIX-ASY", "AIX_ASY", "LINE AIX-ASY", "ASY4", "ASSY4"];
    const asySmtPcs = sumMaps(pMap, asySmtSources);
    const asySmtSht = sumMaps(sMap, asySmtSources);
    const asySmtLot = sumMaps(lMap, asySmtSources);
    pMap.set("ASY SMT", asySmtPcs);
    sMap.set("ASY SMT", asySmtSht);
    lMap.set("ASY SMT", asySmtLot);

    // Plan Rollups
    const rollupPlan = (targetMap: Map<string, Map<string, number>>, aliasMap: Record<string, string[]>) => {
      Object.entries(aliasMap).forEach(([target, sources]) => {
        const merged = sumMaps(targetMap, sources);
        if (merged.size > 0) {
          targetMap.set(target.toUpperCase(), merged);
        }
      });
    };

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

    // Synchronize Plan for LINE A / LINE A_FINAL (single source alias)
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

    // Synchronize Plan for SMT FRONT (Macro SMT_F and SMT FRONT_DIRECT share identical single plan)
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

    // Synchronize Plan for SMT BACK (Direct SMT, SMT BACK_DIRECT, and Macro SMT_B share identical single plan)
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

    // Custom Macro Lines
    const customMacros = getCachedCustomMacroLines();
    if (customMacros && customMacros.length > 0) {
      customMacros.forEach(macro => {
        const sources = getCustomMacroOutputSources(macro);

        if (sources && sources.length > 0) {
          const pMerged = sumMaps(pMap, sources);
          if (pMerged.size > 0) pMap.set(macro.macro_name.toUpperCase(), pMerged);
          const sMerged = sumMaps(sMap, sources);
          if (sMerged.size > 0) sMap.set(macro.macro_name.toUpperCase(), sMerged);
          const lMerged = sumMaps(lMap, sources);
          if (lMerged.size > 0) lMap.set(macro.macro_name.toUpperCase(), lMerged);

          const pPlanMerged = sumMaps(pPlanMap, sources);
          if (pPlanMerged.size > 0) pPlanMap.set(macro.macro_name.toUpperCase(), pPlanMerged);
          const sPlanMerged = sumMaps(sPlanMap, sources);
          if (sPlanMerged.size > 0) sPlanMap.set(macro.macro_name.toUpperCase(), sPlanMerged);
          const lPlanMerged = sumMaps(lPlanMap, sources);
          if (lPlanMerged.size > 0) lPlanMap.set(macro.macro_name.toUpperCase(), lPlanMerged);
        }
      });
    }

    return { pMap, sMap, lMap, pPlanMap, sPlanMap, lPlanMap };
  }, [rows, granularity, aggregatedAttendanceData]);

  const lineTargets = useMemo(() => {
    const pcsMap = new Map<string, Map<string, number>>();
    const shtMap = new Map<string, Map<string, number>>();
    if (Array.isArray(targetData)) {
      targetData.forEach(item => {
        if (!item.line || !item.date) return;
        const normLine = normalizeMatrixLineGroupName(item.line).toUpperCase();
        const rawLine = item.line.trim().toUpperCase();

        const pcsVal = (item.pcs_prod_target !== undefined && item.pcs_prod_target !== null && Number(item.pcs_prod_target) > 0) ? Number(item.pcs_prod_target) : 0;
        const shtVal = (item.sht_prod_target !== undefined && item.sht_prod_target !== null && Number(item.sht_prod_target) > 0) ? Number(item.sht_prod_target) : 0;

        const d = dayjs(item.date);
        const keys = [item.date];
        if (d.isValid()) {
          keys.push(d.format("YYYY-MM"));
          keys.push(getProductionWeekKey(d));
          keys.push(d.format("YYYY"));
        }

        [normLine, rawLine].forEach(l => {
          if (!pcsMap.has(l)) pcsMap.set(l, new Map());
          if (!shtMap.has(l)) shtMap.set(l, new Map());

          keys.forEach(k => {
            if (pcsVal > 0) {
              pcsMap.get(l)!.set(k, pcsVal);
            }
            if (shtVal > 0) {
              shtMap.get(l)!.set(k, shtVal);
            }
          });
        });
      });
    }
    return { pcsMap, shtMap };
  }, [targetData]);

  const getValFromMap = useCallback((map: Map<string, number> | undefined, date: string): number => {
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
  }, []);

  const lineMatDataMaps = useMemo(() => {
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

    if (Array.isArray(matDailyData)) {
      matDailyData.forEach(item => {
        if (!item.date) return;
        const pd = Math.round(Number(item.pd_output || 0));
        const mos = Math.round(Number(item.mos_output || 0));
        const pdTgt = Number(item.pd_prod_target || 0);
        const shtTgt = Number(item.sht_prod_target || 0);

        const rawDate = String(item.date).split("T")[0];
        const parsed = dayjs(rawDate);

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

          const weekKey = getProductionWeekKey(parsed);
          const monthKey = parsed.format("YYYY-MM");
          const qtrKey = getFiscalQuarter(parsed);
          const yearKey = parsed.format("YYYY");

          [weekKey, monthKey, qtrKey, yearKey].forEach(k => {
            if (pd > 0) pdMap.set(k, (pdMap.get(k) || 0) + pd);
            if (mos > 0) mosMap.set(k, (mosMap.get(k) || 0) + mos);
            addPeriodTarget(k, pdTgt, shtTgt);
          });
        }
      });

      targetCounts.forEach((stats, k) => {
        if (stats.pdCount > 0 && !pdTgtMap.has(k)) {
          pdTgtMap.set(k, Math.round((stats.pdSum / stats.pdCount) * 100) / 100);
        }
        if (stats.shtCount > 0 && !shtTgtMap.has(k)) {
          shtTgtMap.set(k, Math.round((stats.shtSum / stats.shtCount) * 100) / 100);
        }
      });
    }

    // Incorporate targets from targetData (public.line_productivity_targets) for LINE MAT
    if (Array.isArray(targetData)) {
      targetData.forEach(item => {
        if (!item.line || !item.date) return;
        const norm = normalizeMatrixLineGroupName(item.line).toUpperCase();
        const raw = item.line.trim().toUpperCase();
        if (norm === "LINE MAT" || norm === "MAT" || raw === "LINE MAT" || raw === "MAT") {
          const pdTgt = Number(item.pcs_prod_target || item.pd_prod_target || 0);
          const shtTgt = Number(item.sht_prod_target || 0);
          const dStr = String(item.date).split("T")[0];
          const d = dayjs(dStr);

          if (pdTgt > 0) pdTgtMap.set(dStr, pdTgt);
          if (shtTgt > 0) shtTgtMap.set(dStr, shtTgt);

          if (d.isValid()) {
            const wKey = getProductionWeekKey(d);
            const mKey = d.format("YYYY-MM");
            const qKey = getFiscalQuarter(d);
            const yKey = d.format("YYYY");
            [wKey, mKey, qKey, yKey].forEach(k => {
              if (pdTgt > 0 && !pdTgtMap.has(k)) pdTgtMap.set(k, pdTgt);
              if (shtTgt > 0 && !shtTgtMap.has(k)) shtTgtMap.set(k, shtTgt);
              addPeriodTarget(k, pdTgt, shtTgt);
            });
          }
        }
      });
    }

    if (Array.isArray(rows)) {
      rows.forEach(r => {
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
  }, [matDailyData, targetData, rows, granularity]);

  const getLineOutput = useCallback((lineName: string, unit: "piece" | "sheet" | "lot" = "piece"): Map<string, number> => {
    const targetMap = unit === "sheet" ? sMap : unit === "lot" ? lMap : pMap;
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

    if (raw === "REW" || norm === "REW" || noLine === "REW") {
      const rewOut = targetMap.get(raw) || targetMap.get(norm) || targetMap.get(noLine) || targetMap.get(withLine);
      if (rewOut && rewOut.size > 0 && Array.from(rewOut.values()).some(v => v > 0)) {
        return rewOut;
      }
      const rewPlan = getLinePlan(lineName, unit);
      if (rewPlan && rewPlan.size > 0) return rewPlan;
    }

    if (raw === "LINE A_FINAL" || norm === "LINE A_FINAL" || raw === "A_FINAL") {
      const aMap = targetMap.get("LINE A") || targetMap.get("A");
      if (aMap && aMap.size > 0) return aMap;
    }
    if (raw === "LINE A" || norm === "LINE A" || raw === "A") {
      const aFinMap = targetMap.get("LINE A_FINAL") || targetMap.get("A_FINAL");
      if (aFinMap && aFinMap.size > 0) return aFinMap;
    }

    return new Map<string, number>();
  }, [pMap, sMap, lMap]);

  const getLinePlan = useCallback((lineName: string, unit: "piece" | "sheet" | "lot" = "piece"): Map<string, number> => {
    const targetMap = unit === "sheet" ? sPlanMap : unit === "lot" ? lPlanMap : pPlanMap;
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
  }, [pPlanMap, sPlanMap, lPlanMap]);

  const containerMaxHeight = useMemo(() => {
    if (viewMode === "focus") return "max-h-[460px]";
    if (viewMode === "compact") return "max-h-[560px]";
    return granularity === "daily" ? "max-h-[770px]" : "max-h-[740px]";
  }, [viewMode, granularity]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = useCallback(async () => {
    try {
      setIsExporting(true);
      await exportProductivityMatrixExcel({
        rawRows: rows,
        matrixData,
        dateColumns,
        aggregatedAttendanceData,
        planData: pPlanMap,
        shtPlanData: sPlanMap,
        lotPlanData: lPlanMap,
        targetData,
        matDailyData,
        calendarData,
        granularity,
        selectedFactory,
        selectedLineGroup,
        lineGroups,
        customLineNames,
        viewMode,
        focusMetric,
        startDate,
        endDate,
        hiddenTables,
      });
    } catch (error: any) {
      console.error("Export Excel error:", error);
      Swal.fire({
        icon: "error",
        title: "ส่งออกไฟล์ไม่สำเร็จ",
        text: error?.message || "เกิดข้อผิดพลาดในการส่งออกไฟล์ Excel",
        confirmButtonText: "ปิด",
        confirmButtonColor: "#ef4444",
        customClass: {
          popup: "!rounded-2xl !shadow-2xl !border !border-base-300",
          confirmButton: "btn btn-error px-6 text-white"
        }
      });
    } finally {
      setIsExporting(false);
    }
  }, [
    rows,
    matrixData,
    dateColumns,
    aggregatedAttendanceData,
    pPlanMap,
    sPlanMap,
    lPlanMap,
    calendarData,
    granularity,
    selectedFactory,
    selectedLineGroup,
    lineGroups,
    customLineNames,
    viewMode,
    focusMetric,
    startDate,
    endDate,
  ]);

  if (matrixData.length === 0) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center h-64 text-base-content/50 gap-4">
        <div>No output data available for this period.</div>
      </div>
    );
  }

  const renderColHeader = (col: string) => {
    if (granularity === 'daily') {
      const d = dayjs(col);
      return (
        <div className="flex flex-col items-center">
          <span className="font-mono text-xs font-bold text-slate-800">{d.format('DD')}</span>
          <span className="text-[10px] text-slate-500">{d.format('MMM')}</span>
        </div>
      );
    }
    if (granularity === 'monthly') {
      const d = dayjs(col);
      if (d.isValid()) {
        return (
          <span className="font-semibold text-xs text-slate-700 font-mono tracking-tight">
            {d.format('MMM-YY')}
          </span>
        );
      }
    }
    if (granularity === 'weekly') {
      const wNum = col.includes('-W') ? col.split('-W')[1] : col;
      return (
        <span className="font-bold text-xs text-slate-800 font-mono">
          Week {wNum}
        </span>
      );
    }
    return <span className="font-bold text-xs text-slate-800 font-mono">{col}</span>;
  };

  const showTotalColumn = dateColumns.length > 1;
  const totalColumnCount = 1 + dateColumns.length + (showTotalColumn ? 1 : 0);
  const parameterCellClass =
    "sticky left-0 z-10 bg-white py-2.5 px-3 text-xs font-medium text-slate-700 border-r border-b border-slate-200";
  const metricCellClass =
    "sticky left-0 z-10 bg-blue-50 py-2.5 px-3 text-xs font-bold text-blue-800 border-r border-b border-slate-200";
  const naCellClass =
    "py-2.5 px-3 text-right text-xs font-mono tabular-nums border-r border-b border-slate-200 bg-slate-50/50 text-slate-400";
  const productionCellClass =
    "py-2.5 px-3 text-right text-xs font-mono tabular-nums border-r border-b border-slate-200 bg-emerald-50/70 text-emerald-800 font-semibold";
  const brownOutputCellClass =
    "py-2.5 px-3 text-right text-xs font-mono tabular-nums border-r border-b border-slate-200 bg-amber-50/70 text-amber-900 font-semibold";
  const brownHolidayDataCellClass =
    "py-2.5 px-3 text-right text-xs font-mono tabular-nums border-r border-b border-amber-300 bg-amber-100/80 text-amber-950 font-bold";
  const brownParameterCellClass =
    "sticky left-0 z-10 bg-amber-50/40 py-2.5 px-3 text-xs font-semibold text-amber-900 border-r border-b border-slate-200";
  const brownRowClass =
    "bg-amber-50/20 hover:bg-amber-50/50 transition-colors border-t border-slate-200 snap-start";
  const belowPlanCellClass =
    "py-2.5 px-3 text-right text-xs font-mono tabular-nums border-r border-b border-rose-300 bg-rose-50/70 text-red-600 font-bold";
  const planParameterCellClass =
    "sticky left-0 z-10 bg-purple-50 py-2.5 px-3 text-xs font-bold text-purple-900 border-r border-b border-slate-200";
  const planDataCellClass =
    "py-2.5 px-3 text-right text-xs font-mono tabular-nums border-r border-b border-slate-200 bg-purple-50/60 text-purple-900 font-semibold";
  const productivityCellClass =
    "py-2.5 px-3 text-right text-xs font-mono tabular-nums border-r border-b border-slate-200 bg-blue-50/70 text-blue-800 font-semibold";
  const otCellClass =
    "py-2.5 px-3 text-right text-xs font-mono tabular-nums border-r border-b border-slate-200 bg-cyan-50/60 text-cyan-800 font-semibold";
  const leaveCellClass =
    "py-2.5 px-3 text-right text-xs font-mono tabular-nums border-r border-b border-slate-200 bg-orange-50/60 text-orange-800 font-semibold";
  const holidayDataCellClass =
    "py-2.5 px-3 text-right text-xs font-mono tabular-nums border-r border-b border-slate-200 bg-indigo-50/80 text-indigo-900 font-semibold";
  const totalCellBase =
    "py-2.5 px-3 text-right text-xs font-mono tabular-nums border-l-2 border-b border-slate-300 bg-slate-100 font-bold";
  const standardRowClass =
    "hover:bg-slate-50 transition-colors border-t border-slate-200 snap-start";
  const planRowClass =
    "bg-purple-50/25 hover:bg-purple-50/60 transition-colors border-t border-slate-200 snap-start";
  const productivityRowClass =
    "bg-blue-50/25 hover:bg-blue-50/60 transition-colors border-t border-slate-200 snap-start";
  const otRowClass =
    "bg-cyan-50/25 hover:bg-cyan-50/60 transition-colors border-t border-slate-200 snap-start";
  const leaveRowClass =
    "bg-orange-50/25 hover:bg-orange-50/60 transition-colors border-t border-slate-200 snap-start";
  const prodActualCellClass = productivityCellClass;
  const targetCellClass = productivityCellClass;
  const planCellClass = planDataCellClass;
  const viewButtonClass = (mode: MatrixViewMode) =>
    `px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode === mode
      ? "bg-blue-700 text-white shadow-sm"
      : "bg-white text-slate-600 hover:bg-slate-100"
    }`;
  const focusButtonClass = (metric: FocusMetric) =>
    `px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${focusMetric === metric
      ? "bg-slate-800 text-white"
      : "bg-white text-slate-600 hover:bg-slate-100"
    }`;

  const isHolidayColumn = (date: string) => {
    if (granularity !== "daily") return false;
    return calendarData && calendarData[date] !== undefined
      ? calendarData[date] === 0
      : dayjs(date).day() === 0;
  };
  const getNaCellClass = (date: string) =>
    (isHolidayColumn(date)
      ? "py-2.5 px-3 text-right text-xs font-mono tabular-nums border-r border-b border-slate-200 bg-slate-100/70 text-slate-300"
      : naCellClass) + " snap-start";
  // Holiday columns can still contain OT2/output data, so recorded values use a distinct holiday-data color.
  const getDataCellClass = (date: string, dataClass: string) =>
    (isHolidayColumn(date) ? holidayDataCellClass : dataClass) + " snap-start";
  const getBrownDataCellClass = (date: string) =>
    (isHolidayColumn(date) ? brownHolidayDataCellClass : brownOutputCellClass) + " snap-start";

  const renderNaCells = (prefix: string) => (
    <>
      {dateColumns.map(date => (
        <td key={`${prefix}-${date}`} className={getNaCellClass(date)}>
          -
        </td>
      ))}
      {showTotalColumn && (
        <td className={`${totalCellBase} sticky right-0 z-10 text-base-content/35`}>
          -
        </td>
      )}
    </>
  );

  if (isLoading) {
    return <DailyMatrixTableSkeleton />;
  }

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg flex flex-col relative transition-opacity duration-300">
      <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row justify-between items-start lg:items-center bg-slate-50 gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Productivity Board Matrix</h3>
            <p className="text-sm text-slate-500">Data aggregated by {granularity}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <button type="button" className={viewButtonClass("full")} onClick={() => setViewMode("full")}>
              Full
            </button>
            <button type="button" className={viewButtonClass("compact")} onClick={() => setViewMode("compact")}>
              Compact
            </button>
            <button type="button" className={viewButtonClass("focus")} onClick={() => setViewMode("focus")}>
              Focus
            </button>
          </div>
          {viewMode === "focus" && (
            <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
              <button type="button" className={focusButtonClass("production")} onClick={() => setFocusMetric("production")}>
                Production
              </button>
              <button type="button" className={focusButtonClass("productivity")} onClick={() => setFocusMetric("productivity")}>
                Productivity
              </button>
              <button type="button" className={focusButtonClass("ot")} onClick={() => setFocusMetric("ot")}>
                OT
              </button>
              <button type="button" className={focusButtonClass("leave")} onClick={() => setFocusMetric("leave")}>
                Leave
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={`overflow-x-auto overflow-y-auto ${containerMaxHeight} flex-1 scrollbar-thin snap-both snap-mandatory scroll-pl-[220px] scroll-pt-[90px]`}>
        <table className="table table-xs w-full border-separate border-spacing-0">
          <thead className="bg-slate-100 sticky top-0 z-20 shadow-sm border-b border-slate-300">
            {granularity === 'daily' ? (
              <>
                {/* Row 1: Day of Week */}
                <tr>
                  <th rowSpan={3} className="sticky left-0 z-30 bg-slate-100 py-3.5 px-4 font-bold uppercase text-xs tracking-wide text-slate-700 min-w-[220px] border-r border-b border-slate-300 align-bottom">
                    Parameter
                  </th>
                  {dateColumns.map(col => {
                    const d = dayjs(col);
                    const dayOfWeek = d.day();
                    let stateClass = "bg-white text-slate-700";
                    if (dayOfWeek === 6) {
                      stateClass = "bg-success/20 text-success-content font-bold border-slate-200";
                    } else if (dayOfWeek === 0) {
                      stateClass = "bg-error/20 text-error-content font-bold border-slate-200";
                    }
                    return (
                      <th key={`dow-${col}`} className={`py-1.5 px-3 text-center border-r border-b min-w-[92px] text-xs snap-start ${stateClass}`}>
                        {d.format('ddd')}
                      </th>
                    );
                  })}
                  {showTotalColumn && (
                    <th rowSpan={3} className="sticky right-0 z-30 py-3.5 px-4 text-right border-l-2 border-b border-slate-300 min-w-[110px] font-bold text-blue-800 bg-slate-200 text-xs align-bottom">
                      TOTAL
                    </th>
                  )}
                </tr>
                {/* Row 2: Working Day Indicator (W, H, O) */}
                <tr>
                  {dateColumns.map(col => {
                    const dayAtt = aggregatedAttendanceData ? aggregatedAttendanceData[col] : null;
                    const otHolidayRate = Number(dayAtt?.ot_holiday_day_rate || dayAtt?.fpc_ot_holiday_day_rate || 0);
                    const ot1Actual = Number(dayAtt?.ot1_actual || dayAtt?.fpc_ot1_actual || 0);
                    const dOfWeek = dayjs(col).day();

                    // 1. Check MariaDB tbl_date calendar status (0: Holiday, 1: Working day)
                    const calVal = calendarData && calendarData[col] !== undefined
                      ? calendarData[col]
                      : (dOfWeek === 0 ? 0 : 1);
                    const isWorkingDay = calVal === 1;

                    let letter: 'W' | 'H' | 'O' = 'W';
                    if (dayAtt && dayAtt.work_day_type) {
                      letter = dayAtt.work_day_type;
                    } else if (isWorkingDay) {
                      letter = 'W';
                    } else {
                      letter = (otHolidayRate > 0 || ot1Actual >= 20) ? 'H' : 'H';
                    }

                    const numVal = calVal;
                    const stateClass = numVal === 1
                      ? "bg-emerald-50 text-emerald-800 font-bold border-slate-200"
                      : "bg-rose-100 text-rose-800 font-bold border-rose-200";

                    return (
                      <th key={`work-${col}`} className={`py-1.5 px-3 text-center border-r border-b text-xs snap-start ${stateClass}`}>
                        <span className="font-bold font-mono text-xs">{numVal}</span>
                      </th>
                    );
                  })}
                </tr>
                {/* Row 3: Date */}
                <tr>
                  {dateColumns.map(col => {
                    return (
                      <th key={`date-${col}`} className="py-2 px-3 text-center border-r border-b border-slate-200 text-xs font-mono bg-slate-50 text-slate-600 snap-start">
                        {dayjs(col).format('D-MMM')}
                      </th>
                    );
                  })}
                </tr>
              </>
            ) : (
              <tr>
                <th className="sticky left-0 z-30 bg-slate-100 py-3.5 px-4 font-bold uppercase text-xs tracking-wide text-slate-700 min-w-[220px] border-r border-b border-slate-300">
                  Parameter
                </th>
                {dateColumns.map(col => {
                  return (
                    <th key={col} className="py-3.5 px-3 text-center border-r border-b border-slate-200 min-w-[92px] text-xs text-slate-700 bg-white snap-start">
                      {renderColHeader(col)}
                    </th>
                  );
                })}
                {showTotalColumn && (
                  <th className="sticky right-0 z-30 py-3.5 px-4 text-right border-l-2 border-b border-slate-300 min-w-[110px] font-bold text-blue-800 bg-slate-200 text-xs">
                    TOTAL
                  </th>
                )}
              </tr>
            )}
          </thead>
          <tbody>
            {(() => {
              const customMacros = getCachedCustomMacroLines();
              const customMacroNames = new Set(customMacros.map(m => m.macro_name.trim().toUpperCase()));
              const customMacroNormalized = new Set(customMacros.map(m => normalizeMatrixLineGroupName(m.macro_name).trim().toUpperCase()));
              const seenLineGroups = new Set<string>();

              return matrixData
                .filter(([lineGroup]) => {
                  const normalizedLineGroup = normalizeMatrixLineGroupName(lineGroup).toUpperCase();
                  const rawGroup = lineGroup.trim().toUpperCase();

                  if (
                    normalizedLineGroup === "LINE NPM" ||
                    normalizedLineGroup === "SUPPORT TF2" ||
                    normalizedLineGroup === "LINE B_JDT" ||
                    normalizedLineGroup === "B_JDT" ||
                    normalizedLineGroup.includes("JDT") ||
                    normalizedLineGroup.startsWith("DAILY ACTUAL") ||
                    normalizedLineGroup.startsWith("DAILY PLAN") ||
                    normalizedLineGroup.startsWith("DAILY OUTPUT") ||
                    normalizedLineGroup.includes("ACTUAL PLAN") ||
                    normalizedLineGroup === "UNKNOWN" ||
                    normalizedLineGroup === "TOTAL"
                  ) return false;

                  // If custom line exists, hide the raw fallback entry
                  if (customMacroNormalized.has(normalizedLineGroup) && !customMacroNames.has(rawGroup)) {
                    return false;
                  }

                  // Deduplicate so only 1 entry is rendered per normalized line
                  if (seenLineGroups.has(normalizedLineGroup)) {
                    return false;
                  }
                  seenLineGroups.add(normalizedLineGroup);

                  if (selectedFactory === "MACRO") {
                    const macroLines = ["MACRO PCN", "MACRO FPC", "DIRECT FPC", "MDS", "MACRO SMT", "DIRECT SMT", "MACRO SMT_F", "MACRO SMT_B"];
                    const customMacroObj = customMacros.find(m => m.macro_name.trim().toUpperCase() === rawGroup || normalizeMatrixLineGroupName(m.macro_name).toUpperCase() === normalizedLineGroup);
                    const isCustomMacroType = customMacroObj && customMacroObj.factory === "MACRO";
                    if (!macroLines.includes(normalizedLineGroup) && !isCustomMacroType) return false;
                  } else if (selectedFactory && selectedFactory !== "ALL") {
                    const customMacroObj = customMacros.find(m => m.macro_name.trim().toUpperCase() === rawGroup || normalizeMatrixLineGroupName(m.macro_name).toUpperCase() === normalizedLineGroup);
                    if (customMacroObj) {
                      if (customMacroObj.factory && customMacroObj.factory !== selectedFactory) return false;
                    } else {
                      const groupDef = lineGroups?.find(g => normalizeMatrixLineGroupName(g.name).toUpperCase() === normalizedLineGroup);
                      const KNOWN_FPC_LINES = new Set([
                        "MACRO PCN", "MACRO FPC", "DIRECT FPC", "NPM_FPC", "LINE NPM", "LINE A", "AT_FRONT",
                        "AT_VAC", "AT_LAM", "LINE A_FINAL", "LINE B", "LINE B_GEN", "LINE B_NON", "LINE C",
                        "LINE D", "LINE MAT", "LINE LAM", "LINE VAC & HPS", "LINE VAC", "LINE HPS",
                        "LINE BLK", "LINE OST", "AVI/K2", "LINE AVI/K2", "MDS", "TF-2"
                      ]);
                      const factory = groupDef?.factory || (KNOWN_FPC_LINES.has(normalizedLineGroup) || KNOWN_FPC_LINES.has(rawGroup) ? "FPC" : (normalizedLineGroup.includes("QA") || normalizedLineGroup.includes("OQI") ? "QA" : "SMT"));
                      if (factory !== selectedFactory) return false;
                    }
                  }
                  if (selectedLineGroup === "ALL" || !selectedLineGroup) return true;
                  return selectedLineGroup.some(name =>
                    normalizeMatrixLineGroupName(name).toUpperCase() === normalizedLineGroup
                  );
                })
                .map(([lineGroup, dateMap], lgIdx) => {
                const lineUpper = lineGroup.toUpperCase();
                const lineWithPrefix = lineUpper.startsWith("LINE ") ? lineUpper : `LINE ${lineUpper}`;
                const lineWithoutPrefix = lineUpper.replace(/^LINE\s+/, "");
                const lineWithUnderscore = lineUpper.includes("MOT") && !lineUpper.includes("_") ? lineUpper.replace("MOT", "MOT_") : lineUpper;
                const lineWithDash = lineUpper.replace(/BLK(\d+)/i, "BLK-$1");
                const lineWithoutDash = lineUpper.replace(/BLK-(\d+)/i, "BLK$1");
                const customName = customLineNames[lineGroup] || 
                  customLineNames[lineUpper] || 
                  customLineNames[lineWithPrefix] || 
                  customLineNames[lineWithoutPrefix] ||
                  customLineNames[lineWithUnderscore] ||
                  customLineNames[lineWithDash] ||
                  customLineNames[lineWithoutDash] ||
                  customLineNames[`LINE ${lineWithDash}`] ||
                  customLineNames[`LINE ${lineWithoutDash}`];
                let displayLineGroup: React.ReactNode = customName ? (
                  <><span className="mr-2">{customName}</span><span className="text-[10px] font-normal opacity-50 tracking-normal">({lineGroup})</span></>
                ) : lineGroup;

                const rawUpper = lineGroup.trim().toUpperCase();
                const normUpper = normalizeMatrixLineGroupName(lineGroup).trim().toUpperCase();

                if (!customName) {
                  if (
                    rawUpper === "MACRO SMT" || rawUpper === "MACRO SMT_F" || rawUpper === "MACRO SMT_B" ||
                    rawUpper === "ASY SMT" || rawUpper === "QA FPC" || rawUpper === "QA SMT" ||
                    rawUpper === "MACRO FPC" || rawUpper === "MACRO PCN" || rawUpper === "LINE B" ||
                    rawUpper === "LINE VAC & HPS" || rawUpper === "LINE MAS & REW" || rawUpper === "DAILY OUTPUT SMT OVERALL"
                  ) {
                    const cleanName = rawUpper === "LINE B" ? "LINE B" :
                      rawUpper === "LINE VAC & HPS" ? "LINE VAC & HPS" :
                      rawUpper === "LINE MAS & REW" ? "LINE MAS & REW" :
                      rawUpper === "MACRO SMT" || rawUpper === "DAILY OUTPUT SMT OVERALL" ? "Macro SMT" :
                      rawUpper === "MACRO SMT_F" ? "Macro SMT_F" :
                      rawUpper === "MACRO SMT_B" ? "Macro SMT_B" :
                      rawUpper === "ASY SMT" ? "ASY SMT" :
                      rawUpper === "QA FPC" ? "QA FPC" :
                      rawUpper === "QA SMT" ? "QA SMT" :
                      rawUpper === "MACRO FPC" ? "Macro FPC" :
                      rawUpper === "MACRO PCN" ? "Macro PCN" : lineGroup;
                    displayLineGroup = <><span className="mr-2">{cleanName}</span><span className="text-[10px] font-normal opacity-50 tracking-normal">(Macro)</span></>;
                  } else if (rawUpper === "DIRECT SMT" || rawUpper === "SMT FRONT_DIRECT" || rawUpper === "SMT BACK_DIRECT" || rawUpper === "DIRECT FPC") {
                    const cleanName = rawUpper === "DIRECT SMT" ? "Direct SMT" :
                      rawUpper === "SMT FRONT_DIRECT" ? "SMT FRONT_DIRECT" :
                      rawUpper === "SMT BACK_DIRECT" ? "SMT BACK_DIRECT" :
                      rawUpper === "DIRECT FPC" ? "Direct FPC" : lineGroup;
                    displayLineGroup = <><span className="mr-2">{cleanName}</span><span className="text-[10px] font-normal opacity-50 tracking-normal">(Direct)</span></>;
                  } else {
                    const dbNameMap: Record<string, string> = {
                      // SMT
                      "SMT_LAM": "SMT_LAM",
                      "LINE SMT_LAM": "SMT_LAM",
                      "LINE SMT LAM": "SMT_LAM",
                      "SMT LAM": "SMT_LAM",
                      "LAM": "SMT_LAM",
                      "MD LAM": "MD LAM",
                      "MD_LAM": "MD LAM",
                      "LINE MD LAM": "MD LAM",
                      "AELT": "AELT",
                      "LINE AELT": "AELT",
                      "AIX-ASY": "AIX-ASY",
                      "AIX_ASY": "AIX-ASY",
                      "LINE AIX-ASY": "AIX-ASY",
                      "ASY4": "AIX-ASY",
                      "ASSY4": "AIX-ASY",
                      "AIX-BLK": "AIX-BLK",
                      "AIX_BLK": "AIX-BLK",
                      "LINE AIX-BLK": "AIX-BLK",
                      "BLK-1": "AIX-BLK",
                      "BLK1": "AIX-BLK",
                      "AIX-MOT": "AIX-MOT",
                      "AIX_MOT": "AIX-MOT",
                      "LINE AIX-MOT": "AIX-MOT",
                      "ASTP_A": "ASTP_A",
                      "LINE ASTP_A": "ASTP_A",
                      "ASTP_G": "ASTP_G",
                      "ASTP_GEN": "ASTP_G",
                      "LINE ASTP_G": "ASTP_G",
                      "ASY1_A": "ASY1_A",
                      "ASY1_AUTO": "ASY1_A",
                      "LINE ASY1_A": "ASY1_A",
                      "ASY1_G": "ASY1_G",
                      "ASY1_GEN": "ASY1_G",
                      "LINE ASY1_G": "ASY1_G",
                      "ASY2": "ASY2",
                      "LINE ASY2": "ASY2",
                      "ASY3": "ASY3",
                      "LINE ASY3": "ASY3",
                      "BLK-2": "BLK-2",
                      "LINE BLK-2": "BLK-2",
                      "BLK MD": "BLK MD",
                      "MAS": "MAS",
                      "LINE MAS": "MAS",
                      "MOTA_A": "MOTA_A",
                      "MOTA_AUTO": "MOTA_A",
                      "LINE MOTA_A": "MOTA_A",
                      "MOTA_G": "MOTA_G",
                      "MOTA_GEN": "MOTA_G",
                      "LINE MOTA_G": "MOTA_G",
                      "MOTB": "MOTB",
                      "LINE MOTB": "MOTB",
                      "MOTD": "MOTD",
                      "LINE MOTD": "MOTD",
                      "REW": "REW",
                      "LINE REW": "REW",
                      "XRAY": "XRAY",
                      "LINE XRAY": "XRAY",
                      "AUTOMOTIVE": "Automotive",
                      "AUTOMATIVE": "Automotive",

                      // FPC
                      "NPM_FPC": "NPM_FPC",
                      "LINE NPM": "NPM_FPC",
                      "NPM": "NPM_FPC",
                      "LINE A": "LINE A",
                      "LINE A_FINAL": "LINE A_FINAL",
                      "AT_FRONT": "AT_Front",
                      "AT_Front": "AT_Front",
                      "A_TF2": "AT_Front",
                      "AT_VAC": "AT_VAC",
                      "AT_LAM": "AT_LAM",
                      "A_LAM": "AT_LAM",
                      "LINE B_GEN": "LINE B_GEN",
                      "LINE B_NON": "LINE B_NON",
                      "LINE B_JDT": "LINE B_JDT",
                      "LINE C": "LINE C",
                      "LINE D": "LINE D",
                      "LINE MAT": "LINE MAT",
                      "LINE LAM": "LINE LAM",
                      "LAM_FPC": "LINE LAM",
                      "LINE VAC": "LINE VAC",
                      "LINE HPS": "LINE HPS",
                      "LINE BLK": "LINE BLK",
                      "LINE OST": "LINE OST",
                      "AVI/K2": "AVI/K2",
                      "AVI_INS": "AVI/K2",
                      "LINE AVI/K2": "AVI/K2",
                      "MDS": "MDS",
                      "LINE MDS": "MDS",
                      "LAM_NIDEC": "LAM_NIDEC",
                      "SUPPORT TF2": "SUPPORT TF2",

                      // QA
                      "OQI_F-AUTO": "OQI_F-AUTO",
                      "OQI_F_AUTO": "OQI_F-AUTO",
                      "QA_FPC_AUTO": "OQI_F-AUTO",
                      "OQI_F-GEN": "OQI_F-GEN",
                      "OQI_F_GEN": "OQI_F-GEN",
                      "QA_FPC_GEN": "OQI_F-GEN",
                      "OQI_M": "OQI_M",
                      "DQA": "OQI_M",
                      "LINE DQA": "OQI_M",
                      "OQI_S-AUTO": "OQI_S-AUTO",
                      "OQI_S_AUTO": "OQI_S-AUTO",
                      "QA_SMT_AUTO": "OQI_S-AUTO",
                      "OQI_S-GEN": "OQI_S-GEN",
                      "OQI_S_GEN": "OQI_S-GEN",
                      "QA_SMT_GEN": "OQI_S-GEN",
                    };

                    const cleanDbName = dbNameMap[rawUpper] || dbNameMap[normUpper] || lineGroup;
                    displayLineGroup = <span>{cleanDbName}</span>;
                  }
                }

                const normLineUpper = normalizeMatrixLineGroupName(lineGroup).toUpperCase();
                const rawLineUpper = lineGroup.trim().toUpperCase();

                const linePcsMap = getLineOutput(lineGroup, "piece");
                const lineShtMap = getLineOutput(lineGroup, "sheet");
                const lineLotMap = getLineOutput(lineGroup, "lot");

                const linePcsPlanMap = getLinePlan(lineGroup, "piece");
                const lineShtPlanMap = getLinePlan(lineGroup, "sheet");
                const lineLotPlanMap = getLinePlan(lineGroup, "lot");

                const getVal = (data: any, key: string, fpcKey: string) => {
                  return getMappedAttendanceValue(lineGroup, data, fpcKey, key, granularity);
                };

                const isMacroRow = checkIsMacroRow(lineGroup);
                const isMacroPcnRow = normLineUpper === "MACRO PCN" || rawLineUpper === "MACRO PCN";
                const isLineMatRow = normLineUpper === "LINE MAT" || rawLineUpper === "LINE MAT";
                const isHpsRow = normLineUpper === "LINE HPS" || rawLineUpper === "LINE HPS" || normLineUpper === "HPS" || rawLineUpper === "HPS";
                const isAviK2Row = normLineUpper.includes("AVI") || rawLineUpper.includes("AVI");
                const isMdsRow = normLineUpper === "MDS" || rawLineUpper === "MDS";
                const isQaRow =
                  normLineUpper.includes("OQI") ||
                  normLineUpper.includes("DQA") ||
                  normLineUpper.startsWith("QA ") ||
                  normLineUpper.startsWith("QA_") ||
                  normLineUpper === "QA" ||
                  normLineUpper === "MQA";
                const isThreeUnitLine = !isQaRow && (
                  rawLineUpper === "LINE BLK" || normLineUpper === "LINE BLK" || rawLineUpper === "BLK" || normLineUpper === "BLK" ||
                  rawLineUpper === "LINE OST" || normLineUpper === "LINE OST" || rawLineUpper === "OST" || normLineUpper === "OST"
                );
                const isFpcLine = !isQaRow && !isThreeUnitLine && !isLineMatRow && (
                  rawLineUpper.includes("PCN") || normLineUpper.includes("PCN") ||
                  rawLineUpper.includes("FPC") || normLineUpper.includes("FPC") ||
                  rawLineUpper === "LINE A" || normLineUpper === "LINE A" ||
                  rawLineUpper.startsWith("A_") || normLineUpper.startsWith("A_") ||
                  rawLineUpper.startsWith("AT_") || normLineUpper.startsWith("AT_") ||
                  rawLineUpper.startsWith("AT-") || normLineUpper.startsWith("AT-") ||
                  rawLineUpper === "LINE A_FINAL" || normLineUpper === "LINE A_FINAL" ||
                  rawLineUpper === "LINE B" || normLineUpper === "LINE B" ||
                  rawLineUpper.startsWith("LINE B_") || normLineUpper.startsWith("LINE B_") ||
                  rawLineUpper === "LINE C" || normLineUpper === "LINE C" ||
                  rawLineUpper === "LINE D" || normLineUpper === "LINE D" ||
                  rawLineUpper === "LINE VAC" || normLineUpper === "LINE VAC" ||
                  rawLineUpper === "LINE HPS" || normLineUpper === "LINE HPS" ||
                  rawLineUpper === "LINE VAC & HPS" || normLineUpper === "LINE VAC & HPS" ||
                  rawLineUpper === "LAM_FPC" || normLineUpper === "LAM_FPC" ||
                  rawLineUpper === "LINE LAM" || normLineUpper === "LINE LAM" ||
                  rawLineUpper === "LINE_LAM" || normLineUpper === "LINE_LAM" ||
                  rawLineUpper === "LINE NPM" || normLineUpper === "LINE NPM" ||
                  rawLineUpper.includes("AVI") || normLineUpper.includes("AVI") ||
                  rawLineUpper === "MDS" || normLineUpper === "MDS"
                );

                const hasOutputData = isLineMatRow
                  ? dateColumns.some(d => (getValFromMap(lineMatDataMaps.pdMap, d) || 0) > 0 || (getValFromMap(lineMatDataMaps.mosMap, d) || 0) > 0)
                  : dateColumns.some(d => (getValFromMap(linePcsMap, d) || 0) > 0 || (getValFromMap(lineShtMap, d) || 0) > 0 || (getValFromMap(lineLotMap, d) || 0) > 0);
                const hasAttendanceData = isMacroRow && dateColumns.some(date => {
                  const data = aggregatedAttendanceData?.[date];
                  return getVal(data, 'total_register', 'fpc_total_register') > 0 || getVal(data, 'total_man_hour', 'fpc_total_man_hour') > 0;
                });
                const hasProductivityData = isMacroRow && dateColumns.some(date => {
                  const totalManHour = getVal(aggregatedAttendanceData?.[date], 'total_man_hour', 'fpc_total_man_hour');
                  if (totalManHour <= 0) return false;
                  if (isLineMatRow) {
                    return (getValFromMap(lineMatDataMaps.pdMap, date) || 0) > 0 || (getValFromMap(lineMatDataMaps.mosMap, date) || 0) > 0;
                  }
                  return (getValFromMap(linePcsMap, date) || 0) > 0 || (getValFromMap(lineShtMap, date) || 0) > 0 || (getValFromMap(lineLotMap, date) || 0) > 0;
                });
                const hasOtData = isMacroRow && dateColumns.some(date => {
                  const data = aggregatedAttendanceData?.[date];
                  return getVal(data, 'ot_psn', 'fpc_ot_psn') > 0 || getVal(data, 'ot_working_day_rate', 'fpc_ot_working_day_rate') > 0 || getVal(data, 'ot_holiday_day_rate', 'fpc_ot_holiday_day_rate') > 0;
                });
                const hasLeaveData = isMacroRow && dateColumns.some(date => {
                  const data = aggregatedAttendanceData?.[date];
                  return getVal(data, 'leave', 'fpc_leave') > 0 || getVal(data, 'leave_working_day_rate', 'fpc_leave_working_day_rate') > 0;
                });

                const matchingCustom = getCachedCustomMacroLines().find(m => m.macro_name.trim().toUpperCase() === normLineUpper || m.macro_name.trim().toUpperCase() === rawLineUpper);
                const customPlanAllowed = matchingCustom ? matchingCustom.show_plan_row !== false : true;
                const customTargetAllowed = matchingCustom ? matchingCustom.show_target_row !== false : true;
                const customOtAllowed = matchingCustom ? Boolean(matchingCustom.show_ot_rows) : true;
                const customLeaveAllowed = matchingCustom ? Boolean(matchingCustom.show_leave_rows) : true;
                const customUnits = matchingCustom?.units && matchingCustom.units.length > 0 ? matchingCustom.units : null;
                const unitIncludePcs = !customUnits || customUnits.includes("piece");
                const unitIncludeSht = !customUnits || customUnits.includes("sheet");
                const unitIncludeLot = !customUnits || customUnits.includes("lot");

                const isAutomotiveRow = normLineUpper === "AUTOMOTIVE" || normLineUpper === "AUTOMATIVE" || rawLineUpper === "AUTOMOTIVE" || rawLineUpper === "AUTOMATIVE";
                const isAsySmt = normLineUpper === "ASY SMT" || rawLineUpper === "ASY SMT";
                const isMacroSmtOverall = normLineUpper === "MACRO SMT" || rawLineUpper === "MACRO SMT";
                const isPlanAllowed = customPlanAllowed && !isHpsRow && !isLineMatRow && !isAviK2Row && !isMacroSmtOverall && !isMacroPcnRow && !isAsySmt;
                const showProductionRows = viewMode === "full" || (viewMode === "compact" && (hasAttendanceData || hasOutputData)) || (viewMode === "focus" && focusMetric === "production" && (hasAttendanceData || hasOutputData));
                const showTargetRow = viewMode === "full" && !isAutomotiveRow && !isAsySmt && customTargetAllowed;
                const showProductivityRows = viewMode === "full" || (viewMode === "compact" && hasProductivityData) || (viewMode === "focus" && focusMetric === "productivity" && hasProductivityData);

                const showOtRows = !isAsySmt && !isAutomotiveRow && customOtAllowed && (viewMode === "full" || (viewMode === "compact" && hasOtData) || (viewMode === "focus" && focusMetric === "ot" && hasOtData));
                const showLeaveRows = !isAsySmt && !isAutomotiveRow && customLeaveAllowed && (viewMode === "full" || (viewMode === "compact" && hasLeaveData) || (viewMode === "focus" && focusMetric === "leave" && hasLeaveData));
                const shouldShowLineGroup = showProductionRows || showTargetRow || showProductivityRows || showOtRows || showLeaveRows;

                if (!shouldShowLineGroup) {
                  return null;
                }

                const renderOutputRow = (rowKey: string, label: string, sourceMap: Map<string, number>, planMap?: Map<string, number>) => {
                  let rowTotalActual = 0;
                  let totalPlan = 0;
                  dateColumns.forEach(date => {
                    rowTotalActual += getValFromMap(sourceMap, date) || 0;
                    if (planMap) totalPlan += getValFromMap(planMap, date) || 0;
                  });

                  const isBrown = rowKey === "pd_output" || rowKey === "mos_output";

                  return (
                    <tr key={rowKey} className={isBrown ? brownRowClass : standardRowClass}>
                      <td className={isBrown ? brownParameterCellClass : parameterCellClass}>{label}</td>
                      {dateColumns.map(date => {
                        const actualQty = getValFromMap(sourceMap, date) || 0;
                        const hasActual = actualQty > 0;
                        const planQty = planMap ? getValFromMap(planMap, date) || 0 : 0;
                        const hasPlan = planQty > 0;
                        const isBelowPlan = hasActual && hasPlan && actualQty < planQty;

                        return (
                          <td
                            key={`${rowKey}-${date}`}
                            className={
                              hasActual
                                ? (isBelowPlan
                                    ? getDataCellClass(date, belowPlanCellClass)
                                    : (isBrown ? getBrownDataCellClass(date) : getDataCellClass(date, productionCellClass)))
                                : getNaCellClass(date)
                            }
                          >
                            {hasActual ? Math.round(actualQty).toLocaleString() : "-"}
                          </td>
                        );
                      })}
                      {showTotalColumn && (
                        <td
                          className={`${totalCellBase} sticky right-0 z-10 ${
                            planMap && totalPlan > 0 && rowTotalActual < totalPlan
                              ? "text-red-600 font-bold"
                              : isBrown
                              ? "text-amber-900 font-bold"
                              : "text-emerald-700"
                          }`}
                        >
                          {rowTotalActual > 0 ? Math.round(rowTotalActual).toLocaleString() : "-"}
                        </td>
                      )}
                    </tr>
                  );
                };

                const renderPlanRow = (rowKey: string, label: string, planMap?: Map<string, number>) => {
                  let totalPlan = 0;
                  dateColumns.forEach(date => {
                    totalPlan += planMap ? getValFromMap(planMap, date) || 0 : 0;
                  });

                  return (
                    <tr key={rowKey} className={planRowClass}>
                      <td className={planParameterCellClass}>{label}</td>
                      {dateColumns.map(date => {
                        const planQty = planMap ? getValFromMap(planMap, date) || 0 : 0;
                        const hasPlan = planQty > 0;
                        const formattedPlan = hasPlan
                          ? (planQty % 1 === 0 ? planQty.toLocaleString() : Number(planQty.toFixed(1)).toLocaleString())
                          : "-";
                        return (
                          <td key={`${rowKey}-${date}`} className={hasPlan ? getDataCellClass(date, planDataCellClass) : getNaCellClass(date)}>
                            {formattedPlan}
                          </td>
                        );
                      })}
                      {showTotalColumn && (
                        <td className={`${totalCellBase} sticky right-0 z-10 text-purple-900`}>
                          {totalPlan > 0 ? (totalPlan % 1 === 0 ? totalPlan.toLocaleString() : Number(totalPlan.toFixed(1)).toLocaleString()) : "-"}
                        </td>
                      )}
                    </tr>
                  );
                };

                const renderTargetRow = (rowKey: string, label: string) => {
                  const isSht = rowKey.toLowerCase().includes("sht") || rowKey.toLowerCase().includes("mos");
                  let targetMap = (isSht ? lineTargets.shtMap : lineTargets.pcsMap).get(normLineUpper) ||
                                  (isSht ? lineTargets.shtMap : lineTargets.pcsMap).get(rawLineUpper);

                  if (isLineMatRow) {
                    const matTgt = isSht ? lineMatDataMaps.shtTgtMap : lineMatDataMaps.pdTgtMap;
                    if (matTgt && matTgt.size > 0) {
                      targetMap = matTgt;
                    }
                  }

                  if ((!targetMap || targetMap.size === 0) && (normLineUpper === "MACRO SMT" || rawLineUpper === "MACRO SMT")) {
                    targetMap = (isSht ? lineTargets.shtMap : lineTargets.pcsMap).get("DIRECT SMT");
                  }
                  if ((!targetMap || targetMap.size === 0) && (normLineUpper === "DIRECT SMT" || rawLineUpper === "DIRECT SMT")) {
                    targetMap = (isSht ? lineTargets.shtMap : lineTargets.pcsMap).get("MACRO SMT");
                  }
                  if ((!targetMap || targetMap.size === 0) && (normLineUpper === "MACRO FPC" || rawLineUpper === "MACRO FPC")) {
                    targetMap = (isSht ? lineTargets.shtMap : lineTargets.pcsMap).get("DIRECT FPC");
                  }
                  if ((!targetMap || targetMap.size === 0) && (normLineUpper === "DIRECT FPC" || rawLineUpper === "DIRECT FPC")) {
                    targetMap = (isSht ? lineTargets.shtMap : lineTargets.pcsMap).get("MACRO FPC");
                  }

                  let validCount = 0;
                  let targetSum = 0;
                  dateColumns.forEach(d => {
                    const val = getValFromMap(targetMap, d);
                    if (val > 0) {
                      validCount++;
                      targetSum += val;
                    }
                  });
                  const avgTarget = validCount > 0 ? targetSum / validCount : 0;

                  return (
                    <tr key={rowKey} className={standardRowClass}>
                      <td className={parameterCellClass}>{label}</td>
                      {dateColumns.map(date => {
                        const val = getValFromMap(targetMap, date);
                        const hasVal = val > 0;
                        const targetCellColor = isHolidayColumn(date)
                          ? "py-2.5 px-3 text-right text-xs font-mono tabular-nums border-r border-b border-rose-200 bg-rose-50/60 text-red-600 font-semibold snap-start"
                          : "py-2.5 px-3 text-right text-xs font-mono tabular-nums border-r border-b border-rose-100 bg-rose-50/30 text-red-600 font-semibold snap-start";

                        return (
                          <td
                            key={`${rowKey}-${date}`}
                            className={hasVal ? targetCellColor : getNaCellClass(date)}
                          >
                            {hasVal ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                          </td>
                        );
                      })}
                      {showTotalColumn && (
                        <td className={`${totalCellBase} sticky right-0 z-10 text-red-600 font-bold`}>
                          {avgTarget > 0 ? avgTarget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                        </td>
                      )}
                    </tr>
                  );
                };

                const renderProdActualRow = (rowKey: string, label: string, sourceMap: Map<string, number>) => {
                  return (
                    <tr key={rowKey} className={productivityRowClass}>
                      <td className={metricCellClass}>{label}</td>
                      {isMacroRow ? (
                        <>
                          {dateColumns.map(date => {
                            const actualQty = getValFromMap(sourceMap, date);
                            const data = aggregatedAttendanceData?.[date];
                            const totalManHour = getVal(data, "total_man_hour", "fpc_total_man_hour");
                            const dailyProd = totalManHour > 0 ? actualQty / totalManHour : 0;
                            const hasProd = actualQty > 0 && totalManHour > 0 && dailyProd > 0;

                            return (
                              <td key={`${rowKey}-${date}`} className={hasProd ? getDataCellClass(date, productivityCellClass) : getNaCellClass(date)}>
                                {hasProd ? dailyProd.toFixed(2) : "-"}
                              </td>
                            );
                          })}
                          {showTotalColumn && (
                            <td className={`${totalCellBase} sticky right-0 z-10 text-emerald-700`}>
                              {(() => {
                                const validDates = dateColumns.filter(date => {
                                  const data = aggregatedAttendanceData?.[date];
                                  const totalManHour = getVal(data, "total_man_hour", "fpc_total_man_hour");
                                  const actualQty = getValFromMap(sourceMap, date);
                                  return actualQty > 0 && totalManHour > 0;
                                });
                                if (validDates.length === 0) return "-";

                                const validTotalQty = validDates.reduce((sum, date) => sum + getValFromMap(sourceMap, date), 0);
                                const validTotalMH = validDates.reduce((sum, date) => {
                                  const data = aggregatedAttendanceData?.[date];
                                  return sum + getVal(data, "total_man_hour", "fpc_total_man_hour");
                                }, 0);

                                return validTotalMH > 0 && validTotalQty > 0 ? (validTotalQty / validTotalMH).toFixed(2) : "-";
                              })()}
                            </td>
                          )}
                        </>
                      ) : (
                        renderNaCells(rowKey)
                      )}
                    </tr>
                  );
                };

                const renderAccProdRow = (rowKey: string, label: string, sourceMap: Map<string, number>) => {
                  return (
                    <tr key={rowKey} className={productivityRowClass}>
                      <td className={metricCellClass}>{label}</td>
                      {isMacroRow ? (
                        (() => {
                          let runningTotalQty = 0;
                          let runningTotalMH = 0;

                          return (
                            <>
                              {dateColumns.map(date => {
                                const actualQty = getValFromMap(sourceMap, date);
                                const data = aggregatedAttendanceData?.[date];
                                const totalManHour = getVal(data, "total_man_hour", "fpc_total_man_hour");
                                const isProdDay = actualQty > 0 && totalManHour > 0;

                                if (isProdDay) {
                                  runningTotalQty += actualQty;
                                  runningTotalMH += totalManHour;
                                }

                                const accProd = runningTotalMH > 0 ? runningTotalQty / runningTotalMH : 0;
                                const hasData = actualQty > 0 || totalManHour > 0;
                                const hasAccProd = runningTotalMH > 0 && accProd > 0 && hasData;

                                return (
                                  <td key={`${rowKey}-${date}`} className={hasAccProd ? getDataCellClass(date, prodActualCellClass) : getNaCellClass(date)}>
                                    {hasAccProd ? accProd.toFixed(2) : "-"}
                                  </td>
                                );
                              })}
                              {showTotalColumn && (
                                <td className={`${totalCellBase} sticky right-0 z-10 text-blue-950 font-black`}>
                                  {runningTotalMH > 0 && runningTotalQty > 0 ? (runningTotalQty / runningTotalMH).toFixed(2) : "-"}
                                </td>
                              )}
                            </>
                          );
                        })()
                      ) : (
                        renderNaCells(rowKey)
                      )}
                    </tr>
                  );
                };

                return (
                  <React.Fragment key={`${lineGroup}-${lgIdx}`}>
                    {/* Line Group Header */}
                    <tr className="snap-start">
                      <td
                        colSpan={totalColumnCount}
                        className="bg-slate-100 border-y border-slate-200 border-l-4 border-l-blue-700 px-4 py-3 text-left text-base font-black text-slate-800 tracking-wide shadow-sm snap-start"
                      >
                        <div className="flex items-center gap-2 sticky left-4 w-fit">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-700" />
                          {displayLineGroup}
                        </div>
                      </td>
                    </tr>

                    {/* 1. OP & Leader register */}
                    {showProductionRows && (
                      <tr className={standardRowClass}>
                        <td className="sticky left-0 z-10 bg-emerald-50 py-2 px-3 text-xs font-semibold text-emerald-800 border-r border-b border-emerald-100">
                          OP & Leader register
                        </td>
                        {isMacroRow ? (
                          <>
                            {dateColumns.map((date) => {
                              const data = aggregatedAttendanceData?.[date];
                              const totalRegister = getVal(data, 'total_register', 'fpc_total_register');
                              const hasData = totalRegister > 0;

                              return (
                                <td key={`op-reg-${date}`} className={hasData ? getDataCellClass(date, productionCellClass) : getNaCellClass(date)}>
                                  {hasData ? totalRegister.toLocaleString() : "-"}
                                </td>
                              );
                            })}
                            {showTotalColumn && (
                              <td className={`${totalCellBase} sticky right-0 z-10 text-emerald-700`}>
                                {(() => {
                                  let count = 0;
                                  const sum = dateColumns.reduce((acc, date) => {
                                    const data = aggregatedAttendanceData?.[date];
                                    const val = getVal(data, 'total_register', 'fpc_total_register');
                                    if (val > 0) count++;
                                    return acc + val;
                                  }, 0);
                                  const avg = count > 0 ? Math.round(sum / count) : 0;
                                  return avg > 0 ? avg.toLocaleString() : "-";
                                })()}
                              </td>
                            )}
                          </>
                        ) : (
                          renderNaCells("op-reg")
                        )}
                      </tr>
                    )}

                    {/* 2. Total Man Hour */}
                    {showProductionRows && (
                      <tr className={standardRowClass}>
                        <td className="sticky left-0 z-10 bg-emerald-50 py-2 px-3 text-xs font-semibold text-emerald-800 border-r border-b border-emerald-100">
                          Total Man Hour
                        </td>
                        {isMacroRow ? (
                          <>
                            {dateColumns.map((date) => {
                              const data = aggregatedAttendanceData?.[date];
                              const totalManHour = getVal(data, 'total_man_hour', 'fpc_total_man_hour');
                              const hasData = totalManHour > 0;

                              return (
                                <td key={`total-mh-${date}`} className={hasData ? getDataCellClass(date, productionCellClass) : getNaCellClass(date)}>
                                  {hasData ? Math.round(totalManHour).toLocaleString() : "-"}
                                </td>
                              );
                            })}
                            {showTotalColumn && (
                              <td className={`${totalCellBase} sticky right-0 z-10 text-emerald-700`}>
                                {(() => {
                                  const sum = dateColumns.reduce((acc, date) => {
                                    const data = aggregatedAttendanceData?.[date];
                                    const val = getVal(data, 'total_man_hour', 'fpc_total_man_hour');
                                    return acc + (val > 0 ? val : 0);
                                  }, 0);
                                  return sum > 0 ? Math.round(sum).toLocaleString() : "-";
                                })()}
                              </td>
                            )}
                          </>
                        ) : (
                          renderNaCells("total-mh")
                        )}
                      </tr>
                    )}

                    {/* Multi-Unit Parameter Rows */}
                    {(() => {
                      if (isMacroPcnRow) {
                        return (
                          <>
                            {showProductionRows && unitIncludePcs && renderOutputRow("pcs_output", "Pcs_Output", linePcsMap)}
                            {showTargetRow && unitIncludePcs && renderTargetRow("pcs_prod_target", "Pcs_Prod Target")}
                            {showProductivityRows && unitIncludePcs && renderProdActualRow("pcs_prod_actual", "Pcs_Prod Actual", linePcsMap)}
                            {showProductivityRows && unitIncludePcs && renderAccProdRow("acc_prod_pcs", "Acc Prod<PCS/MH>", linePcsMap)}
                          </>
                        );
                      }

                      if (isQaRow) {
                        return (
                          <>
                            {showProductionRows && renderOutputRow("pcs_output", "Pcs_Output", linePcsMap)}
                            {showTargetRow && renderTargetRow("pcs_prod_target", "Pcs_Prod Target")}
                            {showProductivityRows && renderProdActualRow("daily_prod", "Daily Productivity", linePcsMap)}
                            {showProductivityRows && renderAccProdRow("sum_prod_pcs", "SUM Productivity<Pcs/MH>", linePcsMap)}
                          </>
                        );
                      }

                      if (isThreeUnitLine) {
                        const hasSht = Array.from(lineShtMap.values()).some(v => v > 0);
                        const hasLot = Array.from(lineLotMap.values()).some(v => v > 0);

                        return (
                          <>
                            {showProductionRows && unitIncludePcs && renderOutputRow("pcs_output", "Pcs_Output", linePcsMap)}
                            {showProductionRows && unitIncludeSht && (viewMode !== "compact" || hasSht) && renderOutputRow("sht_output", "Sht_Output", lineShtMap)}
                            {showProductionRows && isPlanAllowed && unitIncludeLot && (viewMode !== "compact" || hasLot) && renderPlanRow("plan_lot", "Plan_LOT", lineLotPlanMap)}
                            {showProductionRows && unitIncludeLot && (viewMode !== "compact" || hasLot) && renderOutputRow("lot_output", "Lot_Output", lineLotMap, lineLotPlanMap)}
                            {showTargetRow && unitIncludePcs && renderTargetRow("pcs_prod_target", "Pcs_Prod Target")}
                            {showTargetRow && unitIncludeSht && renderTargetRow("sht_prod_target", "Sht_Prod Target")}
                            {showProductivityRows && unitIncludePcs && renderProdActualRow("pcs_prod_actual", "Pcs_Prod Actual", linePcsMap)}
                            {showProductivityRows && unitIncludeSht && (viewMode !== "compact" || hasSht) && renderProdActualRow("sht_prod_actual", "Sht_Prod Actual", lineShtMap)}
                            {showProductivityRows && unitIncludePcs && renderAccProdRow("acc_prod_pcs", "Acc Prod<PCS/MH>", linePcsMap)}
                            {showProductivityRows && unitIncludeSht && (viewMode !== "compact" || hasSht) && renderAccProdRow("acc_prod_sht", "Acc Prod<SHT/MH>", lineShtMap)}
                          </>
                        );
                      }

                      if (isLineMatRow) {
                        return (
                          <>
                            {showProductionRows && renderOutputRow("pd_output", "PD_Output", lineMatDataMaps.pdMap)}
                            {showProductionRows && renderOutputRow("mos_output", "MOS_Output", lineMatDataMaps.mosMap)}
                            {showTargetRow && renderTargetRow("pd_prod_target", "PD_Prod Target")}
                            {showTargetRow && renderTargetRow("sht_prod_target", "Sht_Prod Target")}
                            {showProductivityRows && renderProdActualRow("pd_prod_actual", "PD_Prod Actual", lineMatDataMaps.pdMap)}
                            {showProductivityRows && renderProdActualRow("sht_mos_actual", "Sht_MOS Actual", lineMatDataMaps.mosMap)}
                            {showProductivityRows && renderAccProdRow("acc_prod_pd", "Acc Prod<SHT/MH>", lineMatDataMaps.pdMap)}
                            {showProductivityRows && renderAccProdRow("acc_prod_mos", "Acc MOS<SHT/MH>", lineMatDataMaps.mosMap)}
                          </>
                        );
                      }

                      if (isFpcLine) {
                        const hasSht = Array.from(lineShtMap.values()).some(v => v > 0);
                        const hasShtPlan = Array.from(lineShtPlanMap.values()).some(v => v > 0);

                        return (
                          <>
                            {showProductionRows && isPlanAllowed && unitIncludePcs && renderPlanRow("plan_pcs", "Plan_Pcs", linePcsPlanMap)}
                            {showProductionRows && unitIncludePcs && renderOutputRow("pcs_output", "Pcs_Output", linePcsMap, linePcsPlanMap)}
                            {showProductionRows && isPlanAllowed && !isMdsRow && unitIncludeSht && (viewMode !== "compact" || hasShtPlan || hasSht) && renderPlanRow("plan_sht", "Plan_Sht", lineShtPlanMap)}
                            {showProductionRows && unitIncludeSht && (viewMode !== "compact" || hasSht) && renderOutputRow("sht_output", "Sht_Output", lineShtMap, lineShtPlanMap)}
                            {showTargetRow && unitIncludePcs && renderTargetRow("pcs_prod_target", "Pcs_Prod Target")}
                            {showTargetRow && unitIncludeSht && renderTargetRow("sht_prod_target", "Sht_Prod Target")}
                            {showProductivityRows && unitIncludePcs && renderProdActualRow("pcs_prod_actual", "Pcs_Prod Actual", linePcsMap)}
                            {showProductivityRows && unitIncludeSht && (viewMode !== "compact" || hasSht) && renderProdActualRow("sht_prod_actual", "Sht_Prod Actual", lineShtMap)}
                            {showProductivityRows && unitIncludePcs && renderAccProdRow("acc_prod_pcs", "Acc Prod<PCS/MH>", linePcsMap)}
                            {showProductivityRows && unitIncludeSht && (viewMode !== "compact" || hasSht) && renderAccProdRow("acc_prod_sht", "Accum Productivity", lineShtMap)}
                          </>
                        );
                      }

                      // SMT / Standard Line (Piece only - NO Sheet, NO Lot)
                      return (
                        <>
                          {showProductionRows && isPlanAllowed && unitIncludePcs && renderPlanRow("pcs_plan", "Pcs_Plan", linePcsPlanMap)}
                          {showProductionRows && unitIncludePcs && renderOutputRow("pcs_output", "Pcs_Output", linePcsMap, isPlanAllowed ? linePcsPlanMap : undefined)}
                          {showTargetRow && unitIncludePcs && renderTargetRow("pcs_prod_target", "Pcs_Prod Target")}
                          {showProductivityRows && unitIncludePcs && renderProdActualRow("daily_prod", isAsySmt ? "Pcs_Prod Actual" : "Daily Productivity", linePcsMap)}
                          {showProductivityRows && unitIncludePcs && renderAccProdRow("sum_prod_pcs", isAsySmt ? "Acc Prod<PCS/MH>" : "SUM Productivity<Pcs/MH>", linePcsMap)}
                        </>
                      );
                    })()}

                    {/* OT and Leave Metrics (UI Only) */}
                    {showOtRows && (
                      <tr className={otRowClass}>
                        <td className="sticky left-0 z-10 bg-cyan-50 py-2.5 px-3 text-xs font-medium text-cyan-800 border-r border-b border-cyan-100">
                          OT. (psn)
                        </td>
                        {isMacroRow ? (
                          <>
                            {dateColumns.map((date) => {
                              const data = aggregatedAttendanceData?.[date];
                              const otPsn = getVal(data, 'ot_psn', 'fpc_ot_psn');
                              const totalReg = getVal(data, 'total_register', 'fpc_total_register');
                              const hasData = totalReg > 0 && otPsn > 0;

                              return (
                                <td key={`ot-psn-${date}`} className={hasData ? getDataCellClass(date, otCellClass) : getNaCellClass(date)}>
                                  {hasData ? Math.round(otPsn).toLocaleString() : "-"}
                                </td>
                              );
                            })}
                            {showTotalColumn && (
                              <td className={`${totalCellBase} sticky right-0 z-10 text-cyan-800`}>
                                {(() => {
                                  let count = 0;
                                  const sum = dateColumns.reduce((acc, date) => {
                                    const data = aggregatedAttendanceData?.[date];
                                    const val = getVal(data, 'ot_psn', 'fpc_ot_psn');
                                    if (val > 0) count++;
                                    return acc + val;
                                  }, 0);
                                  const avg = count > 0 ? Math.round(sum / count) : 0;
                                  return avg > 0 ? avg.toLocaleString() : "-";
                                })()}
                              </td>
                            )}
                          </>
                        ) : (
                          renderNaCells("ot_psn")
                        )}
                      </tr>
                    )}

                    {showOtRows && (
                      <tr className={otRowClass}>
                        <td className="sticky left-0 z-10 bg-cyan-50 py-2.5 px-3 text-xs font-medium text-cyan-800 border-r border-b border-cyan-100">
                          OT working day rate(%)
                        </td>
                        {isMacroRow ? (
                          <>
                            {dateColumns.map((date) => {
                              const data = aggregatedAttendanceData?.[date];
                              const rate = getVal(data, 'ot_working_day_rate', 'fpc_ot_working_day_rate');
                              const totalReg = getVal(data, 'total_register', 'fpc_total_register');
                              const isWorking = granularity === 'daily'
                                ? data?.is_working_day === 1
                                : true;
                              const hasData = totalReg > 0 && isWorking;

                              return (
                                <td key={`ot-work-rate-${date}`} className={hasData ? getDataCellClass(date, otCellClass) : getNaCellClass(date)}>
                                  {hasData ? `${rate.toFixed(2)}%` : "-"}
                                </td>
                              );
                            })}
                            {showTotalColumn && (
                              <td className={`${totalCellBase} sticky right-0 z-10 text-cyan-800`}>
                                {(() => {
                                  let sumOt = 0;
                                  let sumReg = 0;
                                  dateColumns.forEach(date => {
                                    const data = aggregatedAttendanceData?.[date];
                                    if (data && getVal(data, 'total_register', 'fpc_total_register') > 0 && (granularity !== 'daily' || data.is_working_day === 1)) {
                                      const register = getVal(data, 'total_register', 'fpc_total_register');
                                      const rate = getVal(data, 'ot_working_day_rate', 'fpc_ot_working_day_rate');
                                      sumOt += (rate / 100) * register;
                                      sumReg += register;
                                    }
                                  });
                                  return sumReg > 0 ? `${((sumOt / sumReg) * 100).toFixed(2)}%` : "-";
                                })()}
                              </td>
                            )}
                          </>
                        ) : (
                          renderNaCells("ot_work_rate")
                        )}
                      </tr>
                    )}

                    {showOtRows && (
                      <tr className={otRowClass}>
                        <td className="sticky left-0 z-10 bg-cyan-50 py-2.5 px-3 text-xs font-medium text-cyan-800 border-r border-b border-cyan-100">
                          OT Holiday day rate(%)
                        </td>
                        {isMacroRow ? (
                          <>
                            {dateColumns.map((date) => {
                              const data = aggregatedAttendanceData?.[date];
                              const rate = getVal(data, 'ot_holiday_day_rate', 'fpc_ot_holiday_day_rate');
                              const totalReg = getVal(data, 'total_register', 'fpc_total_register');
                              const isHoliday = granularity === 'daily'
                                ? data?.is_working_day === 0
                                : true;
                              const hasData = totalReg > 0 && isHoliday;

                              return (
                                <td key={`ot-hol-rate-${date}`} className={hasData ? getDataCellClass(date, otCellClass) : getNaCellClass(date)}>
                                  {hasData ? `${rate.toFixed(2)}%` : "-"}
                                </td>
                              );
                            })}
                            {showTotalColumn && (
                              <td className={`${totalCellBase} sticky right-0 z-10 text-cyan-800`}>
                                {(() => {
                                  let sumOt = 0;
                                  let sumReg = 0;
                                  dateColumns.forEach(date => {
                                    const data = aggregatedAttendanceData?.[date];
                                    if (data && getVal(data, 'total_register', 'fpc_total_register') > 0 && (granularity !== 'daily' || data.is_working_day === 0)) {
                                      const register = getVal(data, 'total_register', 'fpc_total_register');
                                      const rate = getVal(data, 'ot_holiday_day_rate', 'fpc_ot_holiday_day_rate');
                                      sumOt += (rate / 100) * register;
                                      sumReg += register;
                                    }
                                  });
                                  return sumReg > 0 ? `${((sumOt / sumReg) * 100).toFixed(2)}%` : "-";
                                })()}
                              </td>
                            )}
                          </>
                        ) : (
                          renderNaCells("ot_hol_rate")
                        )}
                      </tr>
                    )}

                    {showLeaveRows && (
                      <tr className={leaveRowClass}>
                        <td className="sticky left-0 z-10 bg-orange-50 py-2.5 px-3 text-xs font-medium text-orange-800 border-r border-b border-orange-100">
                          Leave (psn)
                        </td>
                        {isMacroRow ? (
                          <>
                            {dateColumns.map((date) => {
                              const data = aggregatedAttendanceData?.[date];
                              const isWorking = granularity === 'daily'
                                ? (data?.is_working_day ?? (dayjs(date).day() === 0 ? 0 : 1)) === 1
                                : true;
                              const rawLeave = getVal(data, 'leave', 'fpc_leave');
                              const leave = isWorking ? rawLeave : 0;
                              const totalReg = getVal(data, 'total_register', 'fpc_total_register');
                              const hasData = totalReg > 0 && isWorking && leave > 0;

                              return (
                                <td key={`leave-psn-${date}`} className={hasData ? getDataCellClass(date, leaveCellClass) : getNaCellClass(date)}>
                                  {hasData ? Math.round(leave).toLocaleString() : "-"}
                                </td>
                              );
                            })}
                            {showTotalColumn && (
                              <td className={`${totalCellBase} sticky right-0 z-10 text-orange-800`}>
                                {(() => {
                                  let count = 0;
                                  const sum = dateColumns.reduce((acc, date) => {
                                    const data = aggregatedAttendanceData?.[date];
                                    const isWorking = granularity === 'daily'
                                      ? (data?.is_working_day ?? (dayjs(date).day() === 0 ? 0 : 1)) === 1
                                      : true;
                                    const val = isWorking ? getVal(data, 'leave', 'fpc_leave') : 0;
                                    if (val > 0) count++;
                                    return acc + val;
                                  }, 0);
                                  const avg = count > 0 ? Math.round(sum / count) : 0;
                                  return avg > 0 ? avg.toLocaleString() : "-";
                                })()}
                              </td>
                            )}
                          </>
                        ) : (
                          renderNaCells("leave_psn")
                        )}
                      </tr>
                    )}
                    {showLeaveRows && (
                      <tr className={leaveRowClass}>
                        <td className="sticky left-0 z-10 bg-orange-50 py-2.5 px-3 text-xs font-medium text-orange-800 border-r border-b border-orange-100">
                          Leave working day rate(%)
                        </td>
                        {isMacroRow ? (
                          <>
                            {dateColumns.map((date) => {
                              const data = aggregatedAttendanceData?.[date];
                              const isWorking = granularity === 'daily'
                                ? (data?.is_working_day ?? (dayjs(date).day() === 0 ? 0 : 1)) === 1
                                : true;
                              const rawRate = getVal(data, 'leave_working_day_rate', 'fpc_leave_working_day_rate');
                              const rate = isWorking ? rawRate : 0;
                              const totalReg = getVal(data, 'total_register', 'fpc_total_register');
                              const hasData = totalReg > 0 && isWorking;

                              return (
                                <td key={`leave-work-rate-${date}`} className={hasData ? getDataCellClass(date, leaveCellClass) : getNaCellClass(date)}>
                                  {hasData ? `${rate.toFixed(2)}%` : "-"}
                                </td>
                              );
                            })}
                            {showTotalColumn && (
                              <td className={`${totalCellBase} sticky right-0 z-10 text-orange-800`}>
                                {(() => {
                                  let sumLeave = 0;
                                  let sumReg = 0;
                                  dateColumns.forEach(date => {
                                    const data = aggregatedAttendanceData?.[date];
                                    const isWorking = granularity === 'daily'
                                      ? (data?.is_working_day ?? (dayjs(date).day() === 0 ? 0 : 1)) === 1
                                      : true;
                                    if (data && isWorking && getVal(data, 'total_register', 'fpc_total_register') > 0) {
                                      const register = getVal(data, 'total_register', 'fpc_total_register');
                                      const rate = getVal(data, 'leave_working_day_rate', 'fpc_leave_working_day_rate');
                                      sumLeave += (rate / 100) * register;
                                      sumReg += register;
                                    }
                                  });
                                  return sumReg > 0 ? `${((sumLeave / sumReg) * 100).toFixed(2)}%` : "-";
                                })()}
                              </td>
                            )}
                          </>
                        ) : (
                          renderNaCells("leave_work_rate")
                        )}
                      </tr>
                    )}
                  </React.Fragment>
                );
              });
            })()}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-100 ring-1 ring-emerald-200" />Production / attendance data</span>
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-blue-100 ring-1 ring-blue-200" />Productivity metrics</span>
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-cyan-100 ring-1 ring-cyan-200" />OT metrics</span>
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-orange-100 ring-1 ring-orange-200" />Leave metrics</span>
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-100 ring-1 ring-indigo-200" />Holiday / OT2 data</span>
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-slate-100 ring-1 ring-slate-200" />Holiday without data</span>
      </div>
    </div>
  );
});

DailyMatrixTable.displayName = 'DailyMatrixTable';
