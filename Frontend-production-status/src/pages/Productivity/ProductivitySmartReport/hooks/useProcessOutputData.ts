import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  ApiOutputRow,
  DEFAULT_LINE_GROUPS,
  LineGroup,
  LineGroupFilter,
  LineGroupRow,
  OutputUnit,
  UnitTotals,
} from "../types";
import { getCachedCustomMacroLines } from "../utils/customMacroStore";
import { getSubLineAttendancePrefix } from "../utils/attendanceMapper";
import {
  fetchProductivityReportData,
  fetchPeriodSummaryData,
  fetchSmtDailyActualOutput,
  fetchFpcDailyActualPlan,
  fetchMatDailyOutput,
  MatDailyOutputItem,
  fetchAttendanceSummaryData,
  fetchCalendarData,
  fetchLineGroupsData,
  fetchMatrixTargetsData,
  MatrixTargetItem,
} from "../services/productivityApi";

// Factory daily cutoff rule: Output for Day D finishes on D+1 morning at 09:00 - 09:30 AM.
// Therefore, the latest finalized closed production day is yesterday (D-1).
// When today is the 1st of a new month, yesterday belongs to the previous month, so default to that previous month (e.g. Aug 1 - Aug 31).
export const getDefaultDateRange = () => {
  const latestDate = dayjs().subtract(1, "day");
  const startOfMonth = latestDate.startOf("month").format("YYYY-MM-DD");
  const endOfMonth = latestDate.endOf("month").format("YYYY-MM-DD");
  return { startDate: startOfMonth, endDate: endOfMonth };
};

export const MATRIX_LINE_GROUP_NAMES = [
  "Macro SMT", "Direct SMT", "Macro SMT_F", "SMT Front_Direct", "Automotive", "MOTA_A", "MOTA_G", "MOTB",
  "MOTD", "AIX-MOT", "ASTP_A", "ASTP_G", "MAS", "REW", "MAS & REW", "XRAY", "LINE S_TECH_F", "LINE S_TSTE_F",
  "Macro SMT_B", "SMT BACK_DIRECT", "AIX-BLK", "BLK-2", "ASY1_A", "ASY1_G",
  "ASY2", "ASY3", "AIX-ASY", "AELT", "SMT_LAM", "MD LAM", "ASY SMT",
  "LINE S_IND",
  // QA lines
  "QA FPC", "OQI_F-AUTO", "OQI_F-GEN", "QA SMT", "OQI_S-AUTO", "OQI_S-GEN", "OQI_M",
  // FPC lines
  "Macro PCN", "Macro FPC", "Direct FPC", "NPM_FPC", "LINE A", "AT_Front", "AT_VAC", "AT_LAM",
  "LINE A_FINAL", "LINE B", "LINE B_GEN", "LINE B_NON", "LINE C", "LINE D", "LINE MAT",
  "LINE LAM", "LINE VAC & HPS", "LINE VAC", "LINE HPS", "LINE BLK", "LINE OST", "AVI/K2", "MDS"
];
const MATRIX_LINE_GROUP_SET = new Set(MATRIX_LINE_GROUP_NAMES);

const EXCEL_LINE_EXACT_MAP: Record<string, string> = {
  "LINE NPM": "NPM_FPC",
  "NPM": "NPM_FPC",
  "MPM_FPC": "NPM_FPC",
  "NPM_FPC": "NPM_FPC",
  "A_TF2": "AT_Front",
  "AT_TF-2": "AT_Front",
  "AT_TF2": "AT_Front",
  "AT-TF-2": "AT_Front",
  "AT-TF2": "AT_Front",
  "LINE AT_TF-2": "AT_Front",
  "LINE AT_TF2": "AT_Front",
  "AT_FRONT": "AT_Front",
  "AT FRONT": "AT_Front",
  "AT_Front": "AT_Front",
  "A_LAM": "AT_LAM",
  "AT_LAM": "AT_LAM",
  "AT LAM": "AT_LAM",
  "LAM_FPC": "LINE LAM",
  "LINE LAM": "LINE LAM",
  "LINE_LAM": "LINE LAM",
  "AVI_INS": "AVI/K2",
  "AVI/K2": "AVI/K2",
  "LINE AVI/K2": "AVI/K2",
  "AVI_K2": "AVI/K2",
  // Sheet: ASSY OUTPUT
  "ASSY 1 (AUTOMOTIVE)": "ASY1_A",
  "ASSY 1 (GENERAL)": "ASY1_G",
  "ASSY 1": "ASY1_A",
  "ASSY 2 (GENERAL)": "ASY2",
  "ASSY 2 (GEN)": "ASY2",
  "ASSY 2": "ASY2",
  "ASSY 3 (DAY)": "ASY3",
  "ASSY 3": "ASY3",
  "ASSY 4": "AIX-ASY",
  "ASSY4": "AIX-ASY",
  "ASY4": "AIX-ASY",
  "AIX-ASY": "AIX-ASY",
  "AIX_ASY": "AIX-ASY",
  "AIX ASY": "AIX-ASY",
  "AIX-ASY/A": "AIX-ASY",
  "AIX-ASY/D": "AIX-ASY",
  "LINE AIX-ASY": "AIX-ASY",
  "LINE AIX_ASY": "AIX-ASY",
  "LINE ASY4": "AIX-ASY",
  "BLK": "AIX-BLK",
  "LINE BLK": "LINE BLK",
  "LINE OST": "LINE OST",
  "OST": "LINE OST",
  "BLK1": "AIX-BLK",
  "BLK-1": "AIX-BLK",
  "AIX-BLK": "AIX-BLK",
  "AIX_BLK": "AIX-BLK",
  "AIX BLK": "AIX-BLK",
  "LINE BLK-1": "AIX-BLK",
  "LINE BLK 1": "AIX-BLK",
  "LINE AIX-BLK": "AIX-BLK",
  "LINE AIX_BLK": "AIX-BLK",
  "LINE AIX BLK": "AIX-BLK",
  "BLK2": "BLK-2",
  "BLK-2": "BLK-2",
  "LINE BLK-2": "BLK-2",
  "MBLK1": "BLK-2",
  "MBLK2": "BLK-2",
  "MPIC": "BLK-2",
  "MPIC1": "BLK-2",
  "MPIC2": "BLK-2",
  "MPIC3": "BLK-2",
  "ASSY-8 (AUTO FEED)": "AELT",
  "ASSY-8": "AELT",
  "ASSY 8": "AELT",
  "AUTO FEED": "AELT",
  "AELT": "AELT",
  "LINE AELT": "AELT",
  "LAM": "SMT_LAM",
  "SMT LAM": "SMT_LAM",
  "SMT_LAM": "SMT_LAM",
  "LINE SMT_LAM": "SMT_LAM",
  "LINE SMT LAM": "SMT_LAM",
  "MD LAM": "MD LAM",
  "MDLAM": "MD LAM",
  "LINE MD LAM": "MD LAM",
  "MD_LAM": "MD LAM",
  "DIRECT SMT": "Direct SMT",
  "SMT-MOT": "Macro SMT",
  "MOT-A (AUTOMOTIVE)": "MOTA_A",
  "MOT-A (GENERAL)": "MOTA_G",
  "MOT-A": "MOTA_A",
  "MOTA": "MOTA_A",
  "MOTA_A": "MOTA_A",
  "MOTA_AUTO": "MOTA_A",
  "LINE MOTA_A": "MOTA_A",
  "MOTA_GEN": "MOTA_G",
  "MOTA_G": "MOTA_G",
  "LINE MOTA_G": "MOTA_G",
  "MOT-B": "MOTB",
  "MOTB": "MOTB",
  "MOTB_AUTO": "MOTB",
  "LINE MOTB": "MOTB",
  "MOTB_GEN": "MOTB",
  "MOT-B (GENERAL)": "MOTB",
  "MOTB_G": "MOTB",
  "LINE MOTB_G": "MOTB",
  "AIX-MOT": "AIX-MOT",
  "AIX_MOT": "AIX-MOT",
  "AIX MOT": "AIX-MOT",
  "LINE AIX-MOT": "AIX-MOT",
  "LINE AIX_MOT": "AIX-MOT",
  "LINE AIX MOT": "AIX-MOT",
  "MOT-D": "MOTD",
  "MOTD": "MOTD",
  "LINE MOTD": "MOTD",
  "STAMP-AUTOMOTIVE": "ASTP_A",
  "STAMP-GENERAL": "ASTP_G",
  "STAMP AUTOMOTIVE": "ASTP_A",
  "STAMP GENERAL": "ASTP_G",
  "ASTP-A": "ASTP_A",
  "ASTP-G": "ASTP_G",
  "ASTP_A": "ASTP_A",
  "LINE ASTP_A": "ASTP_A",
  "ASTP_G": "ASTP_G",
  "LINE ASTP_G": "ASTP_G",
  "MAS": "MAS",
  "LINE MAS": "MAS",
  "REW": "REW",
  "LINE REW": "REW",
  "X-RAY": "XRAY",
  "XRAY": "XRAY",
  "LINE XRAY": "XRAY",
  "MACRO SMT_F": "Macro SMT_F",
  "MACRO SMT-F": "Macro SMT_F",
  "MACRO SMT F": "Macro SMT_F",
  "SMT FRONT_DIRECT": "SMT Front_Direct",
  "SMT FRONT DIRECT": "SMT Front_Direct",
  "SMT-FRONT-DIRECT": "SMT Front_Direct",
  "SMT_FRONT_DIRECT": "SMT Front_Direct",
  "MACRO SMT_B": "Macro SMT_B",
  "MACRO SMT-B": "Macro SMT_B",
  "MACRO SMT B": "Macro SMT_B",
  "SMT BACK_DIRECT": "SMT BACK_DIRECT",
  "SMT BACK DIRECT": "SMT BACK_DIRECT",
  "SMT-BACK-DIRECT": "SMT BACK_DIRECT",
  "SMT_BACK_DIRECT": "SMT BACK_DIRECT",
  "ASY SMT": "ASY SMT",
  "ASY_SMT": "ASY SMT",
  "ASY ONLY": "ASY SMT",
  "LINE ASY SMT": "ASY SMT",
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
  "DQA": "OQI_M",
  "LINE DQA": "OQI_M",
  "OQI_M": "OQI_M",
  "OQI-M": "OQI_M",
  "QA_FPC_AUTO": "OQI_F-AUTO",
  "QA FPC AUTO": "OQI_F-AUTO",
  "OQI_F-AUTO": "OQI_F-AUTO",
  "QA_FPC_GEN": "OQI_F-GEN",
  "QA FPC GEN": "OQI_F-GEN",
  "OQI_F-GEN": "OQI_F-GEN",
  "QA_SMT_AUTO": "OQI_S-AUTO",
  "QA SMT AUTO": "OQI_S-AUTO",
  "OQI_S-AUTO": "OQI_S-AUTO",
  "QA_SMT_GEN": "OQI_S-GEN",
  "QA SMT GEN": "OQI_S-GEN",
  "OQI_S-GEN": "OQI_S-GEN",
  "MQA": "QA SMT",
  "QA SMT": "QA SMT",
  "QA FPC": "QA FPC",
};

export const normalizeMatrixLineGroupName = (name: string) => {
  const upper = name.trim().toUpperCase();

  if (EXCEL_LINE_EXACT_MAP[upper]) {
    return EXCEL_LINE_EXACT_MAP[upper];
  }

  if (upper.includes("ASSY-8") || upper.includes("ASSY 8") || upper.includes("AUTO FEED")) return "AELT";
  if (upper === "DIRECT SMT" || upper === "DIRECT_SMT" || upper === "DIRECT-SMT") return "Direct SMT";
  if (upper === "MACRO SMT_F" || upper === "MACRO SMT-F" || upper === "MACRO SMT F" || upper === "SMT_FRONT" || upper === "SMT-FRONT" || upper === "SMT FRONT") return "Macro SMT_F";
  if (upper === "SMT FRONT_DIRECT" || upper === "SMT FRONT DIRECT" || upper === "SMT-FRONT-DIRECT" || upper === "SMT_FRONT_DIRECT") return "SMT Front_Direct";

  if (upper === "MACRO SMT_B" || upper === "MACRO SMT-B" || upper === "MACRO SMT B" || upper === "SMT_BACK" || upper === "SMT-BACK" || upper === "SMT BACK") return "Macro SMT_B";
  if (upper === "SMT BACK_DIRECT" || upper === "SMT BACK DIRECT" || upper === "SMT-BACK-DIRECT" || upper === "SMT_BACK_DIRECT") return "SMT BACK_DIRECT";
  if (upper === "ASY SMT" || upper === "ASY_SMT" || upper === "ASY ONLY" || upper === "LINE ASY SMT") return "ASY SMT";

  if (
    upper === "AIX-ASY" || upper === "AIX_ASY" || upper === "AIX ASY" ||
    upper === "LINE AIX-ASY" || upper === "LINE AIX_ASY" || upper === "LINE AIX ASY" ||
    upper === "ASY4" || upper === "ASSY4" || upper === "LINE ASY4" || upper === "LINE ASSY4" ||
    upper.includes("AIX-ASY") || upper.includes("AIX_ASY")
  ) return "AIX-ASY";
  if (upper.includes("AIX-MOT") || upper.includes("AIX_MOT") || upper.includes("AIX MOT")) return "AIX-MOT";

  if (upper.includes("ASSY") || upper.includes("ASY")) {
    if (upper.includes("1") || upper.includes("ASY1")) {
      if (upper.includes("GEN") || upper.includes("GENERAL") || upper.includes("1_G") || upper.includes("1 G")) return "ASY1_G";
      return "ASY1_A";
    }
    if (upper.includes("2")) return "ASY2";
    if (upper.includes("3")) return "ASY3";
    if (upper.includes("4")) return "AIX-ASY";
  }
  if (upper === "AELT" || upper === "LINE AELT") return "AELT";
  if (upper === "ASTP_A" || upper === "ASTP A" || upper === "ASTP-A" || upper === "LINE ASTP_A") return "ASTP_A";
  if (upper === "ASTP_GEN" || upper === "ASTP_G" || upper === "ASTP G" || upper === "ASTP-G" || upper === "LINE ASTP_G") return "ASTP_G";
  if (
    upper === "BLK" || upper === "BLK1" || upper === "BLK-1" || upper === "AIX-BLK" || upper === "AIX_BLK" || upper === "AIX BLK" ||
    upper === "LINE BLK-1" || upper === "LINE BLK 1" || upper === "LINE AIX-BLK" || upper === "LINE AIX_BLK" || upper === "LINE AIX BLK"
  ) return "AIX-BLK";
  if (upper === "BLK2" || upper === "BLK-2" || upper === "BLK MD" || upper === "BLK_MD" || upper === "LINE BLK-2") return "BLK-2";
  if (upper === "MD_LAM" || upper === "MD LAM" || upper === "LAM MD" || upper === "LAM_MD" || upper === "MDLAM" || upper === "LINE MD LAM") return "MD LAM";
  if (upper === "SMT_LAM" || upper === "SMT LAM" || upper === "LINE SMT_LAM" || upper === "LINE SMT LAM") return "SMT_LAM";
  if (upper === "X-RAY" || upper === "XRAY" || upper === "LINE XRAY") return "XRAY";
  if (upper === "MAS" || upper === "LINE MAS") return "MAS";
  if (upper === "REW" || upper === "LINE REW") return "REW";
  if (upper === "S_TECH_F" || upper === "S_TECH-F" || upper === "LINE S_TECH_F") return "LINE S_TECH_F";
  if (upper === "S_TSTE_F" || upper === "S_TSTE-F" || upper === "LINE S_TSTE_F") return "LINE S_TSTE_F";
  if (upper === "QA_FPC_AUTO" || upper === "QA_FPC AUTO" || upper === "QA_AUTO" || upper === "OQI_F-AUTO" || upper === "OQI_F_AUTO") return "OQI_F-AUTO";
  if (upper === "QA_FPC_GEN" || upper === "QA_FPC GEN" || upper === "QA_GEN" || upper === "OQI_F-GEN" || upper === "OQI_F_GEN") return "OQI_F-GEN";
  if (upper === "QA_SMT_AUTO" || upper === "QA_SMT AUTO" || upper === "OQI_S-AUTO" || upper === "OQI_S_AUTO") return "OQI_S-AUTO";
  if (upper === "QA_SMT_GEN" || upper === "QA_SMT GEN" || upper === "OQI_S-GEN" || upper === "OQI_S_GEN") return "OQI_S-GEN";
  if (upper === "QA_FPC" || upper === "QA FPC") return "QA FPC";
  if (upper === "QA SMT" || upper === "QA_SMT" || upper === "MQA") return "QA SMT";
  if (upper === "DQA" || upper === "LINE DQA" || upper === "OQI_M" || upper === "OQI-M") return "OQI_M";

  const matchExact = MATRIX_LINE_GROUP_NAMES.find(n => n.toUpperCase() === upper);
  if (matchExact) return matchExact;

  if (upper.startsWith("LINE ")) {
    const withoutLine = upper.replace("LINE ", "").trim();
    const matchWithout = MATRIX_LINE_GROUP_NAMES.find(n => n.toUpperCase() === withoutLine);
    if (matchWithout) return matchWithout;
  }

  return name.trim();
};

export type Granularity = "yearly" | "quarterly" | "monthly" | "weekly" | "daily";

export const useProcessOutputData = () => {
  const [granularity, setGranularity] = useState<Granularity>("daily");
  
  // By default, fetch from 1st of month to latest closed production date (yesterday)
  // On the 1st of the month, this automatically loads the previous month so full final data (e.g. 31st) is visible.
  const [startDate, setStartDate] = useState(() => getDefaultDateRange().startDate);
  const [endDate, setEndDate] = useState(() => getDefaultDateRange().endDate);
  const [selectedFactory, setSelectedFactory] = useState<string>("ALL");
  const [selectedLineGroup, setSelectedLineGroup] = useState<LineGroupFilter>("ALL");
  const [facUnit, setFacUnit] = useState<string>("ALL");
  const [selectedUnit, setSelectedUnit] = useState<OutputUnit>("piece");
  const [lineGroups, setLineGroups] = useState<LineGroup[]>([...DEFAULT_LINE_GROUPS]);
  const [rows, setRows] = useState<LineGroupRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [calendarData, setCalendarData] = useState<Record<string, number>>({});
  const [attendanceData, setAttendanceData] = useState<Record<string, any>>({});
  const [targetData, setTargetData] = useState<MatrixTargetItem[]>([]);
  const [matDailyData, setMatDailyData] = useState<MatDailyOutputItem[]>([]);

  const activeLineGroups = useMemo(() => {
    let result = lineGroups;
    if (selectedFactory !== "ALL") {
      result = result.filter(group => group.factory === selectedFactory);
    }
    if (selectedLineGroup !== "ALL" && selectedLineGroup.length > 0) {
      const selectedNames = new Set(
        selectedLineGroup.map(name => normalizeMatrixLineGroupName(name).toUpperCase())
      );
      result = result.filter(group =>
        selectedNames.has(normalizeMatrixLineGroupName(group.name).toUpperCase())
      );
    }
    return result;
  }, [lineGroups, selectedLineGroup, selectedFactory]);

  const fetchLineGroups = useCallback(async () => {
    try {
      const data: LineGroup[] = await fetchLineGroupsData();
      if (data.length > 0) {
        // Normalize DB names to internal Matrix names to avoid duplicates in the filter dropdown
        const mappedData = data.map(group => {
          const newName = normalizeMatrixLineGroupName(group.name);
          return { ...group, name: newName };
        });

        // Deduplicate in case multiple DB names mapped to the same internal name
        const uniqueMappedData = Array.from(
          new Map(mappedData.map(group => [group.name, group])).values()
        );

        const names = new Set(uniqueMappedData.map(group => normalizeMatrixLineGroupName(group.name).toUpperCase()));
        const matrixGroups: LineGroup[] = MATRIX_LINE_GROUP_NAMES
          .map(name => normalizeMatrixLineGroupName(name))
          .filter(name => !names.has(name.toUpperCase()))
          .map(name => ({ name, processes: [], factory: "SMT" }));

        const customMacros = getCachedCustomMacroLines();
        const customMacroGroups: LineGroup[] = customMacros.map(m => ({
          name: m.macro_name,
          processes: [],
          factory: m.factory || "SMT"
        }));

        const combinedGroupsRaw = [...uniqueMappedData, ...matrixGroups, ...customMacroGroups];
        const seenCombined = new Set<string>();
        const combinedGroups: LineGroup[] = [];

        combinedGroupsRaw.forEach(group => {
          const norm = normalizeMatrixLineGroupName(group.name).toUpperCase();
          if (!seenCombined.has(norm)) {
            seenCombined.add(norm);
            let factory = group.factory || "SMT";
            const upperName = group.name.toUpperCase();
            const macroNames = ["MACRO PCN", "MACRO FPC", "DIRECT FPC", "MDS", "MACRO SMT", "DIRECT SMT", "MACRO SMT_F", "MACRO SMT_B"];
            const matchingMacro = customMacros.find(cm => cm.macro_name.toUpperCase() === upperName);
            if (macroNames.includes(upperName)) {
              factory = "MACRO";
            } else if (matchingMacro) {
              factory = matchingMacro.factory || "SMT";
            } else if (
              upperName.includes("FPC") || upperName.includes("PCN") || upperName === "LINE NPM" ||
              upperName === "LINE A" || upperName.startsWith("A_") || upperName === "LINE A_FINAL" ||
              upperName === "LINE B" || upperName === "LINE B_GEN" || upperName === "LINE B_NON" ||
              upperName === "LINE C" || upperName === "LINE D" || upperName === "LINE MAT" ||
              upperName.includes("VAC") || upperName.includes("HPS") || upperName === "LINE BLK" ||
              upperName === "LINE OST" || upperName === "AVI_INS" || upperName === "AVI/K2" ||
              upperName === "AVI_K2" || upperName.includes("AVI") || upperName === "MDS"
            ) {
              factory = "FPC";
            }
            combinedGroups.push({ ...group, factory });
          }
        });
        
        setLineGroups(combinedGroups);
        setSelectedLineGroup(prev => {
          if (prev === "ALL") return prev;
          const valid = prev.filter(name => combinedGroups.some(g =>
            normalizeMatrixLineGroupName(g.name).toUpperCase() === normalizeMatrixLineGroupName(name).toUpperCase()
          ));
          if (valid.length === 0) return "ALL";
          if (valid.length !== prev.length) return valid;
          return prev;
        });
      }
    } catch (error) {
      console.error("Failed to fetch productivity line groups", error);
    }
  }, []);

  const fetchLineGroupOutput = useCallback(async () => {
    if (!startDate || !endDate) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const params = new URLSearchParams();
      params.append("startDate", startDate);
      params.append("endDate", endDate);
      const customMacros = getCachedCustomMacroLines();
      const customMacroNames = new Set(customMacros.map(m => m.macro_name.toUpperCase()));
      const hasMatrixSelection = selectedLineGroup !== "ALL" && selectedLineGroup.some(name =>
        MATRIX_LINE_GROUP_SET.has(name) ||
        customMacroNames.has(name.toUpperCase()) ||
        name.toUpperCase() === "AUTOMOTIVE" ||
        name.toUpperCase() === "AUTOMATIVE"
      );
      params.append("lineGroup", selectedLineGroup === "ALL" || hasMatrixSelection ? "ALL" : selectedLineGroup.join(","));
      if (facUnit !== "ALL") {
        params.append("facUnit", facUnit);
      }
      if (selectedFactory !== "ALL" && selectedFactory !== "MACRO") {
        params.append("factory", selectedFactory);
      }

      const data: ApiOutputRow[] = await fetchProductivityReportData(params, startDate, endDate);
      
      const groupedRows = new Map<string, LineGroupRow>();

      data.forEach(item => {
        const process = item.process_name?.trim().toUpperCase() || "";
        const mcLine = item.mc_line?.trim() || "Unknown";

        const rawLineGroup = item.line_group?.trim();
        if (!rawLineGroup || rawLineGroup === "UNKNOWN" || !item.output_date) return;
        const lineGroup = normalizeMatrixLineGroupName(rawLineGroup);

        const key = `${item.output_date}||${lineGroup}||${mcLine}`;
        if (!groupedRows.has(key)) {
          groupedRows.set(key, {
            date: item.output_date,
            process,
            lineGroup,
            mcLine,
            lotQty: 0,
            shtQty: 0,
            pieceQty: 0,
            facUnitCode: item.fac_unit_code,
          });
        } else {
          const existing = groupedRows.get(key)!;
          if (!existing.process.split(', ').includes(process)) {
            existing.process += `, ${process}`;
          }
        }

        groupedRows.get(key)!.lotQty += Number(item.actual_lot_qty || 0);
        groupedRows.get(key)!.shtQty += Number(item.actual_sht_qty || 0);
        groupedRows.get(key)!.pieceQty += Number(item.actual_piece_qty || 0);
      });

      // Merge imported SMT & FPC Daily Plans (from Excel), Matrix Targets, and LINE MAT Output
      try {
        const [smtData, fpcData, targets, matData] = await Promise.all([
          fetchSmtDailyActualOutput(startDate, endDate).catch(() => []),
          fetchFpcDailyActualPlan(startDate, endDate).catch(() => []),
          fetchMatrixTargetsData(startDate, endDate).catch(() => []),
          fetchMatDailyOutput(startDate, endDate).catch(() => [])
        ]);

        if (Array.isArray(targets)) {
          setTargetData(targets);
        }
        if (Array.isArray(matData)) {
          setMatDailyData(matData);
        }

        if (Array.isArray(smtData) && smtData.length > 0) {
          smtData.forEach(item => {
            if (!item.line || !item.date || item.daily_plan === undefined || item.daily_plan === null) return;
            const normLine = normalizeMatrixLineGroupName(item.line);
            const upperLine = normLine.trim().toUpperCase();
            if (
              upperLine.startsWith("DAILY ACTUAL") ||
              upperLine.startsWith("DAILY PLAN") ||
              upperLine.startsWith("DAILY OUTPUT") ||
              upperLine.includes("ACTUAL PLAN") ||
              upperLine === "UNKNOWN" ||
              upperLine === "TOTAL" ||
              upperLine === "SUMMARY"
            ) return;

            const isRew = upperLine.includes("REW");
            const key = `${item.date}||${normLine}||MANUAL_EXCEL_SMT`;
            const planVal = Number(item.daily_plan || 0);

            groupedRows.set(key, {
              date: item.date,
              process: "DAILY PLAN",
              lineGroup: normLine,
              mcLine: "MANUAL_EXCEL",
              lotQty: isRew ? planVal : 0,
              shtQty: isRew ? planVal : 0,
              pieceQty: isRew ? planVal : 0,
              planQty: planVal,
              piece_plan: planVal,
              sht_plan: 0,
              lot_plan: isRew ? planVal : 0,
            });
          });
        }

        if (Array.isArray(fpcData) && fpcData.length > 0) {
          fpcData.forEach(item => {
            if (!item.line || !item.date) return;
            const normLine = normalizeMatrixLineGroupName(item.line);
            const key = `${item.date}||${normLine}||MANUAL_EXCEL_FPC`;
            const piecePlanVal = Number(item.piece_plan || 0);
            const shtPlanVal = Number(item.sht_plan || 0);
            const lotPlanVal = Number(item.lot_plan || 0);

            groupedRows.set(key, {
              date: item.date,
              process: "DAILY PLAN",
              lineGroup: normLine,
              mcLine: "MANUAL_EXCEL",
              lotQty: 0,
              shtQty: 0,
              pieceQty: 0,
              planQty: piecePlanVal > 0 ? piecePlanVal : (shtPlanVal > 0 ? shtPlanVal : lotPlanVal),
              piece_plan: piecePlanVal,
              sht_plan: shtPlanVal,
              lot_plan: lotPlanVal,
            });
          });
        }
      } catch (err) {
        console.error("Failed to fetch daily actual output plans", err);
      }

      setRows(
        Array.from(groupedRows.values()).sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            a.lineGroup.localeCompare(b.lineGroup) ||
            a.process.localeCompare(b.process) ||
            a.mcLine.localeCompare(b.mcLine)
        )
      );
    } catch (err: any) {
        setErrorMessage(err.message || "Failed to fetch data");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    [startDate, endDate, facUnit, selectedLineGroup, selectedFactory]
  );

  const fetchCalendar = useCallback(async () => {
    try {
      const data = await fetchCalendarData();
      setCalendarData(data);
    } catch (err) {
      console.error("Failed to fetch calendar", err);
    }
  }, []);

  const fetchAttendance = useCallback(async () => {
    if (!startDate || !endDate) return;
    setIsAttendanceLoading(true);
    try {
      const data = await fetchAttendanceSummaryData(startDate, endDate);
      setAttendanceData(data);
    } catch (err) {
      console.error("Failed to fetch attendance data", err);
    } finally {
      setIsAttendanceLoading(false);
    }
  }, [startDate, endDate]);

  const fetchPeriodSummary = useCallback(async (targetGran?: Granularity) => {
    const gran = targetGran || granularity;
    if (!startDate || !endDate) return;
    setIsLoading(true);
    setIsAttendanceLoading(true);
    setErrorMessage("");

    try {
      const periodType = gran.toUpperCase();
      const [summaryRows, targets, matData]: [any[], any[], any[]] = await Promise.all([
        fetchPeriodSummaryData(periodType, startDate, endDate),
        fetchMatrixTargetsData(startDate, endDate).catch(() => []),
        fetchMatDailyOutput(startDate, endDate).catch(() => [])
      ]);

      if (Array.isArray(targets)) {
        setTargetData(targets);
      }
      if (Array.isArray(matData)) {
        setMatDailyData(matData);
      }

      const groupedRows: LineGroupRow[] = [];
      const attMap: Record<string, any> = {};

      const seenSummaryMap = new Map<string, { item: any; lineGroup: string; date: string }>();

      summaryRows.forEach(item => {
        const lineGroup = normalizeMatrixLineGroupName(item.line_group);
        const date = item.period_key;
        const dedupeKey = `${date}_${lineGroup.toUpperCase()}`;

        const existing = seenSummaryMap.get(dedupeKey);
        if (!existing) {
          seenSummaryMap.set(dedupeKey, { item, lineGroup, date });
        } else {
          const curScore = (Number(item.piece_output) > 0 || Number(item.lot_output) > 0 || Number(item.lot_plan) > 0 || Number(item.sht_output) > 0 ? 2 : 0) + (Number(item.total_man_hour) > 0 ? 1 : 0);
          const existScore = (Number(existing.item.piece_output) > 0 || Number(existing.item.lot_output) > 0 || Number(existing.item.lot_plan) > 0 || Number(existing.item.sht_output) > 0 ? 2 : 0) + (Number(existing.item.total_man_hour) > 0 ? 1 : 0);
          if (curScore > existScore) {
            seenSummaryMap.set(dedupeKey, { item, lineGroup, date });
          }
        }
      });

      Array.from(seenSummaryMap.values()).forEach(({ item, lineGroup, date }) => {
        groupedRows.push({
          date,
          process: `${periodType} SUMMARY`,
          lineGroup,
          mcLine: "ALL",
          lotQty: Number(item.lot_output || 0),
          shtQty: Number(item.sht_output || 0),
          pieceQty: Number(item.piece_output || 0),
          planQty: Number(item.piece_plan || 0),
          piece_plan: Number(item.piece_plan || 0),
          sht_plan: Number(item.sht_plan || 0),
          lot_plan: Number(item.lot_plan || 0),
          pd_output: Number(item.pd_output || 0),
          mos_output: Number(item.mos_output || 0),
        } as any);

        if (!attMap[date]) {
          attMap[date] = {
            _is_precomputed_period_summary: true,
            is_working_day: gran === 'daily' ? (dayjs(date).day() === 0 ? 0 : 1) : 1,
            byLine: {},
          };
        }

        const dObj = attMap[date];
        const uLine = lineGroup.trim().toUpperCase();
        const prefix = getSubLineAttendancePrefix(lineGroup);

        const reg = Number(item.op_leader_register || 0);
        const mh = Number(item.total_man_hour || 0);
        const otPsn = Number(item.ot_psn || 0);
        const otWorkRate = Number(item.ot_working_day_rate || 0);
        const otHolRate = Number(item.ot_holiday_day_rate || 0);
        const leave = Number(item.leave_psn || 0);
        const leaveRate = Number(item.leave_working_day_rate || 0);
        const actProd = Number(item.actual_productivity || 0);
        const sumProd = Number(item.sum_productivity || 0);
        const shtPlan = Number(item.sht_plan || 0);
        const lotPlan = Number(item.lot_plan || 0);
        const shtTarget = Number(item.sht_prod_target || 0);
        const shtActProd = Number(item.sht_actual_productivity || 0);
        const shtSumProd = Number(item.sht_sum_productivity || 0);

        dObj.byLine[uLine] = {
          op_leader_register: reg,
          total_man_hour: mh,
          piece_plan: Number(item.piece_plan || 0),
          piece_output: Number(item.piece_output || 0),
          sht_output: Number(item.sht_output || 0),
          lot_output: Number(item.lot_output || 0),
          pd_output: Number(item.pd_output || 0),
          mos_output: Number(item.mos_output || 0),
          actual_productivity: actProd,
          sum_productivity: sumProd,
          sht_plan: shtPlan,
          lot_plan: lotPlan,
          sht_prod_target: shtTarget,
          sht_actual_productivity: shtActProd,
          sht_sum_productivity: shtSumProd,
          ot_psn: otPsn,
          ot_working_day_rate: otWorkRate,
          ot_holiday_day_rate: otHolRate,
          leave_psn: leave,
          leave_working_day_rate: leaveRate,
        };
        dObj.byLine[item.line_group.trim().toUpperCase()] = dObj.byLine[uLine];
        if (uLine === "LINE MD LAM" || item.line_group.trim().toUpperCase() === "MD LAM") {
          dObj.byLine["LINE MD LAM"] = dObj.byLine[uLine];
          dObj.byLine["MD LAM"] = dObj.byLine[uLine];
          dObj.byLine["MD_LAM"] = dObj.byLine[uLine];
          dObj.byLine["LAM MD"] = dObj.byLine[uLine];
          dObj.byLine["LAM_MD"] = dObj.byLine[uLine];
          dObj['lam_md_total_register'] = reg;
          dObj['lam_md_total_actual'] = Math.max(0, reg - leave);
          dObj['lam_md_total_man_hour'] = mh;
          dObj['md_lam_total_register'] = reg;
          dObj['md_lam_total_actual'] = Math.max(0, reg - leave);
          dObj['md_lam_total_man_hour'] = mh;
        }

        if (uLine === "LINE MAT" || item.line_group?.trim().toUpperCase() === "MAT") {
          dObj.byLine["LINE MAT"] = dObj.byLine[uLine];
          dObj.byLine["MAT"] = dObj.byLine[uLine];
          dObj['line_mat_total_register'] = reg;
          dObj['line_mat_total_actual'] = Math.max(0, reg - leave);
          dObj['line_mat_total_man_hour'] = mh;
          dObj['line_mat_pd_output'] = Number(item.pd_output || 0);
          dObj['line_mat_mos_output'] = Number(item.mos_output || 0);
          dObj['mat_total_register'] = reg;
          dObj['mat_total_actual'] = Math.max(0, reg - leave);
          dObj['mat_total_man_hour'] = mh;
          dObj['mat_pd_output'] = Number(item.pd_output || 0);
          dObj['mat_mos_output'] = Number(item.mos_output || 0);
        }

        if (prefix) {
          dObj[`${prefix}_total_register`] = reg;
          dObj[`${prefix}_total_actual`] = Math.max(0, reg - leave);
          dObj[`${prefix}_total_man_hour`] = mh;
          dObj[`${prefix}_ot1_actual`] = otPsn;
          dObj[`${prefix}_ot_psn`] = otPsn;
          dObj[`${prefix}_ot_working_day_rate`] = otWorkRate;
          dObj[`${prefix}_ot_holiday_day_rate`] = otHolRate;
          dObj[`${prefix}_leave`] = leave;
          dObj[`${prefix}_leave_working_day_rate`] = leaveRate;
        }

        if (prefix === "a" || uLine === "LINE A" || uLine === "A") {
          dObj['line_a_total_register'] = reg;
          dObj['line_a_total_actual'] = Math.max(0, reg - leave);
          dObj['line_a_total_man_hour'] = mh;
          dObj['line_a_ot_psn'] = otPsn;
          dObj['line_a_leave'] = leave;
          dObj['line_a_leave_working_day_rate'] = leaveRate;
          dObj['line_a_ot_working_day_rate'] = otWorkRate;
          dObj['line_a_ot_holiday_day_rate'] = otHolRate;
          dObj['a_total_register'] = reg;
          dObj['a_total_actual'] = Math.max(0, reg - leave);
          dObj['a_total_man_hour'] = mh;
          dObj['a_ot_psn'] = otPsn;
          dObj['a_leave'] = leave;
          dObj['a_leave_working_day_rate'] = leaveRate;
          dObj['a_ot_working_day_rate'] = otWorkRate;
          dObj['a_ot_holiday_day_rate'] = otHolRate;
        }

        if (prefix === "b" || uLine === "LINE B" || uLine === "B") {
          dObj['line_b_total_register'] = reg;
          dObj['line_b_total_actual'] = Math.max(0, reg - leave);
          dObj['line_b_total_man_hour'] = mh;
          dObj['line_b_ot_psn'] = otPsn;
          dObj['line_b_leave'] = leave;
          dObj['line_b_leave_working_day_rate'] = leaveRate;
          dObj['line_b_ot_working_day_rate'] = otWorkRate;
          dObj['line_b_ot_holiday_day_rate'] = otHolRate;
        }

        if (uLine === "MACRO PCN") {
          dObj['total_register'] = reg;
          dObj['total_actual'] = Math.max(0, reg - leave);
          dObj['total_man_hour'] = mh;
          dObj['leave'] = leave;
          dObj['leave_working_day_rate'] = leaveRate;
          dObj['ot_psn'] = otPsn;
          dObj['ot_working_day_rate'] = otWorkRate;
          dObj['ot_holiday_day_rate'] = otHolRate;
        }

        if (uLine === "MACRO FPC") {
          dObj['fpc_total_register'] = reg;
          dObj['fpc_total_actual'] = Math.max(0, reg - leave);
          dObj['fpc_total_man_hour'] = mh;
          dObj['fpc_leave'] = leave;
          dObj['fpc_leave_working_day_rate'] = leaveRate;
          dObj['fpc_ot_psn'] = otPsn;
          dObj['fpc_ot_working_day_rate'] = otWorkRate;
          dObj['fpc_ot_holiday_day_rate'] = otHolRate;
        }

        if (uLine === "MACRO SMT") {
          dObj['macro_smt_total_register'] = reg;
          dObj['macro_smt_total_actual'] = Math.max(0, reg - leave);
          dObj['macro_smt_total_man_hour'] = mh;
          dObj['macro_smt_leave'] = leave;
          dObj['macro_smt_leave_working_day_rate'] = leaveRate;
          dObj['macro_smt_ot_psn'] = otPsn;
          dObj['macro_smt_ot_working_day_rate'] = otWorkRate;
          dObj['macro_smt_ot_holiday_day_rate'] = otHolRate;
        }

        if (uLine === "DIRECT SMT") {
          dObj['direct_smt_total_register'] = reg;
          dObj['direct_smt_total_actual'] = Math.max(0, reg - leave);
          dObj['direct_smt_total_man_hour'] = mh;
          dObj['direct_smt_leave'] = leave;
          dObj['direct_smt_leave_working_day_rate'] = leaveRate;
          dObj['direct_smt_ot_psn'] = otPsn;
          dObj['direct_smt_ot_working_day_rate'] = otWorkRate;
          dObj['direct_smt_ot_holiday_day_rate'] = otHolRate;
        }

        if (uLine === "DIRECT FPC") {
          dObj['fpc_direct_register'] = reg;
          dObj['fpc_direct_total_register'] = reg;
          dObj['fpc_direct_actual'] = Math.max(0, reg - leave);
          dObj['fpc_direct_total_actual'] = Math.max(0, reg - leave);
          dObj['fpc_direct_total_man_hour'] = mh;
          dObj['fpc_direct_leave'] = leave;
          dObj['fpc_direct_leave_working_day_rate'] = leaveRate;
          dObj['fpc_direct_ot_psn'] = otPsn;
          dObj['fpc_direct_ot_working_day_rate'] = otWorkRate;
          dObj['fpc_direct_ot_holiday_day_rate'] = otHolRate;
        }

        if (uLine === "MACRO SMT_F") {
          dObj['macro_smt_f_total_register'] = reg;
          dObj['macro_smt_f_total_actual'] = Math.max(0, reg - leave);
          dObj['macro_smt_f_total_man_hour'] = mh;
          dObj['macro_smt_f_leave'] = leave;
          dObj['macro_smt_f_leave_working_day_rate'] = leaveRate;
          dObj['macro_smt_f_ot_psn'] = otPsn;
          dObj['macro_smt_f_ot_working_day_rate'] = otWorkRate;
          dObj['macro_smt_f_ot_holiday_day_rate'] = otHolRate;
          dObj.byLine["Macro SMT_F"] = dObj.byLine[uLine];
          dObj.byLine["MACRO SMT_F"] = dObj.byLine[uLine];
        }

        if (uLine === "SMT FRONT_DIRECT" || uLine === "SMT Front_Direct") {
          dObj['smt_front_direct_total_register'] = reg;
          dObj['smt_front_direct_total_actual'] = Math.max(0, reg - leave);
          dObj['smt_front_direct_total_man_hour'] = mh;
          dObj['smt_front_direct_leave'] = leave;
          dObj['smt_front_direct_leave_working_day_rate'] = leaveRate;
          dObj['smt_front_direct_ot_psn'] = otPsn;
          dObj['smt_front_direct_ot_working_day_rate'] = otWorkRate;
          dObj['smt_front_direct_ot_holiday_day_rate'] = otHolRate;
          dObj.byLine["SMT FRONT_DIRECT"] = dObj.byLine[uLine];
          dObj.byLine["SMT Front_Direct"] = dObj.byLine[uLine];
        }

        if (uLine === "MACRO SMT_B") {
          dObj['macro_smt_b_total_register'] = reg;
          dObj['macro_smt_b_total_actual'] = Math.max(0, reg - leave);
          dObj['macro_smt_b_total_man_hour'] = mh;
          dObj['macro_smt_b_leave'] = leave;
          dObj['macro_smt_b_leave_working_day_rate'] = leaveRate;
          dObj['macro_smt_b_ot_psn'] = otPsn;
          dObj['macro_smt_b_ot_working_day_rate'] = otWorkRate;
          dObj['macro_smt_b_ot_holiday_day_rate'] = otHolRate;
          dObj.byLine["Macro SMT_B"] = dObj.byLine[uLine];
          dObj.byLine["MACRO SMT_B"] = dObj.byLine[uLine];
        }

        if (uLine === "SMT BACK_DIRECT" || uLine === "SMT Back_Direct") {
          dObj['smt_back_direct_total_register'] = reg;
          dObj['smt_back_direct_total_actual'] = Math.max(0, reg - leave);
          dObj['smt_back_direct_total_man_hour'] = mh;
          dObj['smt_back_direct_leave'] = leave;
          dObj['smt_back_direct_leave_working_day_rate'] = leaveRate;
          dObj['smt_back_direct_ot_psn'] = otPsn;
          dObj['smt_back_direct_ot_working_day_rate'] = otWorkRate;
          dObj['smt_back_direct_ot_holiday_day_rate'] = otHolRate;
          dObj.byLine["SMT BACK_DIRECT"] = dObj.byLine[uLine];
          dObj.byLine["SMT Back_Direct"] = dObj.byLine[uLine];
        }
      });

      // Ensure composite QA SMT is populated in attMap if sub-lines exist
      Object.values(attMap).forEach((dObj: any) => {
        if (!dObj || !dObj.byLine) return;
        const oqiSAuto = dObj.byLine["OQI_S-AUTO"] || dObj.byLine["QA SMT AUTO"];
        const oqiSGen = dObj.byLine["OQI_S-GEN"] || dObj.byLine["QA SMT GEN"];
        const qaSmt = dObj.byLine["QA SMT"];
        if ((!qaSmt || (qaSmt.op_leader_register === 0 && qaSmt.total_man_hour === 0)) && (oqiSAuto || oqiSGen)) {
          const autoReg = Number(oqiSAuto?.op_leader_register || 0);
          const genReg = Number(oqiSGen?.op_leader_register || 0);
          const autoMh = Number(oqiSAuto?.total_man_hour || 0);
          const genMh = Number(oqiSGen?.total_man_hour || 0);
          const autoOt = Number(oqiSAuto?.ot_psn || 0);
          const genOt = Number(oqiSGen?.ot_psn || 0);
          const autoLeave = Number(oqiSAuto?.leave_psn || 0);
          const genLeave = Number(oqiSGen?.leave_psn || 0);
          const autoPiece = Number(oqiSAuto?.piece_output || 0);
          const genPiece = Number(oqiSGen?.piece_output || 0);
          const totReg = autoReg + genReg;
          const totLeave = autoLeave + genLeave;
          const totOt = autoOt + genOt;
          const totMh = autoMh + genMh;
          const totPiece = autoPiece + genPiece;

          dObj.byLine["QA SMT"] = {
            op_leader_register: totReg,
            total_man_hour: totMh,
            piece_plan: Number(oqiSAuto?.piece_plan || 0) + Number(oqiSGen?.piece_plan || 0),
            piece_output: totPiece,
            sht_output: Number(oqiSAuto?.sht_output || 0) + Number(oqiSGen?.sht_output || 0),
            lot_output: Number(oqiSAuto?.lot_output || 0) + Number(oqiSGen?.lot_output || 0),
            actual_productivity: totMh > 0 ? totPiece / totMh : 0,
            sum_productivity: 0,
            sht_plan: 0,
            sht_prod_target: 0,
            sht_actual_productivity: 0,
            sht_sum_productivity: 0,
            ot_psn: totOt,
            ot_working_day_rate: totReg > 0 ? (totOt / totReg) * 100 : 0,
            ot_holiday_day_rate: 0,
            leave_psn: totLeave,
            leave_working_day_rate: totReg > 0 ? (totLeave / totReg) * 100 : 0,
          };
          dObj.byLine["MQA"] = dObj.byLine["QA SMT"];
        }

        // Ensure composite QA FPC is populated in attMap if sub-lines exist
        const oqiFAuto = dObj.byLine["OQI_F-AUTO"] || dObj.byLine["QA FPC AUTO"];
        const oqiFGen = dObj.byLine["OQI_F-GEN"] || dObj.byLine["QA FPC GEN"];
        const qaFpc = dObj.byLine["QA FPC"];
        if ((!qaFpc || (qaFpc.op_leader_register === 0 && qaFpc.total_man_hour === 0)) && (oqiFAuto || oqiFGen)) {
          const autoReg = Number(oqiFAuto?.op_leader_register || 0);
          const genReg = Number(oqiFGen?.op_leader_register || 0);
          const autoMh = Number(oqiFAuto?.total_man_hour || 0);
          const genMh = Number(oqiFGen?.total_man_hour || 0);
          const autoOt = Number(oqiFAuto?.ot_psn || 0);
          const genOt = Number(oqiFGen?.ot_psn || 0);
          const autoLeave = Number(oqiFAuto?.leave_psn || 0);
          const genLeave = Number(oqiFGen?.leave_psn || 0);
          const autoPiece = Number(oqiFAuto?.piece_output || 0);
          const genPiece = Number(oqiFGen?.piece_output || 0);
          const totReg = autoReg + genReg;
          const totLeave = autoLeave + genLeave;
          const totOt = autoOt + genOt;
          const totMh = autoMh + genMh;
          const totPiece = autoPiece + genPiece;

          dObj.byLine["QA FPC"] = {
            op_leader_register: totReg,
            total_man_hour: totMh,
            piece_plan: Number(oqiFAuto?.piece_plan || 0) + Number(oqiFGen?.piece_plan || 0),
            piece_output: totPiece,
            sht_output: Number(oqiFAuto?.sht_output || 0) + Number(oqiFGen?.sht_output || 0),
            lot_output: Number(oqiFAuto?.lot_output || 0) + Number(oqiFGen?.lot_output || 0),
            actual_productivity: totMh > 0 ? totPiece / totMh : 0,
            sum_productivity: 0,
            sht_plan: 0,
            sht_prod_target: 0,
            sht_actual_productivity: 0,
            sht_sum_productivity: 0,
            ot_psn: totOt,
            ot_working_day_rate: totReg > 0 ? (totOt / totReg) * 100 : 0,
            ot_holiday_day_rate: 0,
            leave_psn: totLeave,
            leave_working_day_rate: totReg > 0 ? (totLeave / totReg) * 100 : 0,
          };
        }
      });

      // Merge help-hour fields from daily attendance snapshots into attMap.
      // The period_summary table stores total_man_hour (which already includes help hours
      // in its calculation), but does NOT store the raw help_in_normal / help_out_normal
      // breakdown. The ManpowerAuditModal reads those raw fields to display Help In/Out hours.
      // We fetch the snapshots here and merge only help-related keys into each attMap date.
      try {
        const snapshotData = await fetchAttendanceSummaryData(startDate, endDate);
        if (snapshotData && typeof snapshotData === 'object') {
          Object.entries(snapshotData).forEach(([dStr, snap]: [string, any]) => {
            if (!attMap[dStr] || !snap || typeof snap !== 'object') return;
            const dObj = attMap[dStr];
            // Copy every key that relates to help hours from the snapshot into the attMap entry.
            // This covers: help_in_normal, help_out_normal, fpc_help_in_normal,
            // {prefix}_help_in_normal, etc. — without overwriting the period-summary-computed
            // registration / man-hour / OT / leave fields.
            Object.keys(snap).forEach(key => {
              if (key.includes('help_in') || key.includes('help_out') || key.includes('help_psn')) {
                dObj[key] = snap[key];
              }
            });
          });
        }
      } catch (snapErr) {
        // Non-critical: help hours may just show 0 if snapshot fetch fails.
        console.warn('[fetchPeriodSummary] Could not merge help snapshot data:', snapErr);
      }

      const hasAnyAttendance = summaryRows.some(r => Number(r.op_leader_register || 0) > 0 || Number(r.total_man_hour || 0) > 0);
      const hasAnyPlan = summaryRows.some(r => Number(r.piece_plan || 0) > 0 || Number(r.sht_plan || 0) > 0);
      if (summaryRows.length === 0 || !hasAnyAttendance || !hasAnyPlan) {
        await Promise.all([fetchLineGroupOutput(), fetchAttendance()]);
        return;
      }

      setRows(groupedRows);
      setAttendanceData(attMap);
    } catch (err: any) {
      console.error(`Failed to fetch ${gran} summary:`, err);
      try {
        await Promise.all([fetchLineGroupOutput(), fetchAttendance()]);
        return;
      } catch (fallbackErr) {
        console.error("Live fallback also failed:", fallbackErr);
      }
      setErrorMessage(err.message || `Failed to fetch ${gran} data`);
    } finally {
      setIsLoading(false);
      setIsAttendanceLoading(false);
    }
  }, [startDate, endDate, granularity, calendarData, fetchLineGroupOutput, fetchAttendance]);

  useEffect(() => {
    fetchLineGroups();
    fetchCalendar();
  }, [fetchLineGroups, fetchCalendar]);

  useEffect(() => {
    const isPastMonth = endDate < dayjs().startOf('month').format('YYYY-MM-DD');
    const isAugust = (startDate >= '2026-08-01' && endDate <= '2026-08-31');

    if (granularity === "daily") {
      if (isAugust || isPastMonth) {
        fetchPeriodSummary("daily");
      } else {
        fetchLineGroupOutput();
        fetchAttendance();
      }
    } else {
      fetchPeriodSummary(granularity);
    }
  }, [granularity, startDate, endDate, fetchPeriodSummary, fetchLineGroupOutput, fetchAttendance]);

  const totals = useMemo(() => {
    const byLineGroup = new Map<string, UnitTotals>();
    rows.forEach(row => {
      const key = row.lineGroup.toUpperCase();
      const current = byLineGroup.get(key) || { lotQty: 0, shtQty: 0, pieceQty: 0 };
      byLineGroup.set(key, {
        lotQty: current.lotQty + row.lotQty,
        shtQty: current.shtQty + row.shtQty,
        pieceQty: current.pieceQty + row.pieceQty,
      });
    });
    return byLineGroup;
  }, [rows]);

  const visibleLineGroups = useMemo(() => {
    if (selectedLineGroup !== "ALL") return activeLineGroups;

    return activeLineGroups.filter(group => {
      const total = totals.get(group.name.toUpperCase());
      return Boolean(total && (total.lotQty > 0 || total.shtQty > 0 || total.pieceQty > 0));
    });
  }, [activeLineGroups, selectedLineGroup, totals]);

  return {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    selectedFactory,
    setSelectedFactory,
    selectedLineGroup,
    setSelectedLineGroup,
    facUnit,
    setFacUnit,
    selectedUnit,
    setSelectedUnit,
    lineGroups,
    rows,
    isLoading: isLoading || isAttendanceLoading,
    errorMessage,
    fetchLineGroupOutput,
    fetchPeriodSummary,
    fetchMonthlyPeriodSummary: fetchPeriodSummary,
    totals,
    visibleLineGroups,
    granularity,
    setGranularity,
    calendarData,
    attendanceData,
    targetData,
    setTargetData,
    matDailyData,
    setMatDailyData,
    fetchAttendance,
    fetchCalendar,
  };
};
