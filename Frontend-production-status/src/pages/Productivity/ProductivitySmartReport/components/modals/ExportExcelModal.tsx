import React, { useState, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import {
  X,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Building2,
  Layers,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { exportProductivityMatrixExcel, isLineHidden } from "../../utils/exportMatrixToExcel";
import { normalizeMatrixLineGroupName } from "../../hooks/useProcessOutputData";
import { getCachedCustomMacroLines } from "../../utils/customMacroStore";
import { fetchMatrixTargetsData, fetchMatDailyOutput } from "../../services/productivityApi";
import Swal from "sweetalert2";
import { LineGroup, LineGroupRow, ApiOutputRow, Granularity } from "../../types";

const MONTH_NAMES = [
  { idx: 0, th: "มกราคม", en: "Jan", fullEn: "January" },
  { idx: 1, th: "กุมภาพันธ์", en: "Feb", fullEn: "February" },
  { idx: 2, th: "มีนาคม", en: "Mar", fullEn: "March" },
  { idx: 3, th: "เมษายน", en: "Apr", fullEn: "April" },
  { idx: 4, th: "พฤษภาคม", en: "May", fullEn: "May" },
  { idx: 5, th: "มิถุนายน", en: "Jun", fullEn: "June" },
  { idx: 6, th: "กรกฎาคม", en: "Jul", fullEn: "July" },
  { idx: 7, th: "สิงหาคม", en: "Aug", fullEn: "August" },
  { idx: 8, th: "กันยายน", en: "Sep", fullEn: "September" },
  { idx: 9, th: "ตุลาคม", en: "Oct", fullEn: "October" },
  { idx: 10, th: "พฤศจิกายน", en: "Nov", fullEn: "November" },
  { idx: 11, th: "ธันวาคม", en: "Dec", fullEn: "December" },
];

interface ExportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStartDate: string;
  currentEndDate: string;
  currentFactory: string;
  currentMatrixData: [string, Map<string, number>][] | Map<string, Map<string, number>>;
  currentDateColumns: string[];
  currentAggregatedAttendance: Record<string, any>;
  currentPlanData: Map<string, Map<string, number>>;
  currentCalendarData: Record<string, number>;
  currentRows?: LineGroupRow[];
  lineGroups: LineGroup[];
  hiddenTables?: string[];
  currentTargetData?: any[];
  currentMatDailyData?: any[];
  granularity?: Granularity;
}

export const ExportExcelModal: React.FC<ExportExcelModalProps> = ({
  isOpen,
  onClose,
  currentStartDate,
  currentEndDate,
  currentFactory,
  currentMatrixData,
  currentDateColumns,
  currentAggregatedAttendance,
  currentPlanData,
  currentCalendarData,
  currentRows,
  lineGroups,
  hiddenTables = [],
  currentTargetData,
  currentMatDailyData,
  granularity,
}) => {
  const initialDate = dayjs(currentStartDate).isValid() ? dayjs(currentStartDate) : dayjs();

  const [selectedYear, setSelectedYear] = useState<number>(() => initialDate.year());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => initialDate.month());
  const [selectedSector, setSelectedSector] = useState<string>(() => currentFactory || "ALL");
  const [isSectorDropdownOpen, setIsSectorDropdownOpen] = useState<boolean>(false);
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [isLineSelectorOpen, setIsLineSelectorOpen] = useState<boolean>(false);
  const [lineSearchQuery, setLineSearchQuery] = useState<string>("");
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Sync state with incoming props when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const d = dayjs(currentStartDate).isValid() ? dayjs(currentStartDate) : dayjs();
      setSelectedYear(d.year());
      setSelectedMonth(d.month());
      setSelectedSector(currentFactory || "ALL");
      setIsSectorDropdownOpen(false);
      setSelectedLines([]);
      setIsLineSelectorOpen(false);
      setLineSearchQuery("");
      setStatusMessage("");
      setIsExporting(false);
    }
  }, [isOpen, currentStartDate, currentFactory]);

  // Target month dates
  const targetMonthDates = useMemo(() => {
    const start = dayjs().year(selectedYear).month(selectedMonth).startOf("month");
    const end = dayjs().year(selectedYear).month(selectedMonth).endOf("month");
    return {
      startDate: start.format("YYYY-MM-DD"),
      endDate: end.format("YYYY-MM-DD"),
      formattedLabel: `${MONTH_NAMES[selectedMonth].fullEn} ${selectedYear}`,
      daysInMonth: end.date(),
    };
  }, [selectedYear, selectedMonth]);

  // Discover available lines based on selectedSector
  const availableLines = useMemo(() => {
    const canonicalOrder = [
      "Macro PCN", "Macro FPC", "Direct FPC",
      "LINE A", "AT_Front", "AT_VAC", "AT_LAM", "LINE A_FINAL", "LINE B", "LINE B_GEN", "LINE B_NON", "LINE C", "LINE D",
      "LINE MAT", "LINE LAM", "LINE VAC & HPS", "LINE VAC", "LINE HPS", "LINE BLK", "LINE OST", "AVI/K2", "MDS",
      "Macro SMT", "Macro SMT_F", "Macro SMT_B", "Direct SMT", "SMT Front_Direct", "SMT BACK_DIRECT", "Automotive",
      "MOTA_A", "MOTA_G", "MOTB", "AIX-MOT", "MOTD", "ASTP_A", "ASTP_G",
      "MAS", "REW", "XRAY", "MAS & REW",
      "AIX-BLK", "BLK-2", "ASY1_A", "ASY1_G", "ASY2", "ASY3", "AIX-ASY",
      "AELT", "SMT_LAM", "MD LAM", "ASY SMT",
      "QA FPC", "OQI_F-AUTO", "OQI_F-GEN", "OQI_M", "QA SMT", "OQI_S-AUTO", "OQI_S-GEN",
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

    const linesSet = new Set<string>();
    const linesList: { name: string; factory: string }[] = [];

    const KNOWN_FPC_LINES = new Set([
      "MACRO PCN", "MACRO FPC", "DIRECT FPC", "NPM_FPC", "LINE NPM", "LINE A", "AT_FRONT",
      "AT_VAC", "AT_LAM", "LINE A_FINAL", "LINE B", "LINE B_GEN", "LINE B_NON", "LINE C",
      "LINE D", "LINE MAT", "LINE LAM", "LINE VAC & HPS", "LINE VAC", "LINE HPS",
      "LINE BLK", "LINE OST", "AVI/K2", "LINE AVI/K2", "MDS", "TF-2"
    ]);

    const addLine = (line: string, fallbackFactory = "OTHER") => {
      if (!line || typeof line !== "string") return;
      const trimmed = line.trim();
      if (!trimmed) return;
      const norm = normalizeMatrixLineGroupName(trimmed).toUpperCase();
      const upper = trimmed.toUpperCase();
      if (EXCLUDED_EXPORT_LINES.has(norm) || EXCLUDED_EXPORT_LINES.has(upper)) return;
      if (isLineHidden(trimmed, hiddenTables)) return;
      if (!linesSet.has(norm)) {
        linesSet.add(norm);
        const groupDef = lineGroups?.find(g => normalizeMatrixLineGroupName(g.name).toUpperCase() === norm);
        let factory = groupDef?.factory;
        if (!factory) {
          if (KNOWN_FPC_LINES.has(norm) || KNOWN_FPC_LINES.has(upper)) {
            factory = "FPC";
          } else if (norm.includes("QA") || norm.includes("DQA") || norm.includes("MQA") || norm.includes("OQI")) {
            factory = "QA";
          } else {
            factory = fallbackFactory;
          }
        }
        linesList.push({ name: trimmed, factory });
      }
    };

    // Populate lines only from real data (matrixData, lineGroups, customMacros, currentRows)
    if (currentMatrixData) {
      if (Array.isArray(currentMatrixData)) {
        currentMatrixData.forEach(([k]) => addLine(k));
      } else if (currentMatrixData instanceof Map) {
        currentMatrixData.forEach((_, k) => addLine(k));
      }
    }
    if (lineGroups && Array.isArray(lineGroups)) {
      lineGroups.forEach(g => addLine(g.name, g.factory));
    }
    const customMacros = getCachedCustomMacroLines();
    customMacros.forEach(cm => addLine(cm.macro_name, "MACRO"));
    if (currentRows && Array.isArray(currentRows)) {
      currentRows.forEach(r => {
        if (r.lineGroup && r.mcLine !== "MANUAL_EXCEL") addLine(r.lineGroup);
      });
    }

    // Ensure essential macros are available in linesList
    [
      "Macro PCN", "Macro FPC", "Direct FPC",
      "Macro SMT", "Direct SMT", "Macro SMT_F", "Macro SMT_B",
      "SMT Front_Direct", "SMT BACK_DIRECT"
    ].forEach(m => addLine(m, "MACRO"));

    // Sort using canonical master order
    const getCanonicalIndex = (name: string) => {
      const norm = normalizeMatrixLineGroupName(name).toUpperCase();
      const upper = name.trim().toUpperCase();
      const idxNorm = canonicalOrder.findIndex(c => normalizeMatrixLineGroupName(c).toUpperCase() === norm);
      if (idxNorm !== -1) return idxNorm;
      const idxUpper = canonicalOrder.findIndex(c => c.trim().toUpperCase() === upper);
      if (idxUpper !== -1) return idxUpper;
      return 9999;
    };
    linesList.sort((a, b) => getCanonicalIndex(a.name) - getCanonicalIndex(b.name));

    // Filter by selectedSector
    return linesList.filter(item => {
      const norm = normalizeMatrixLineGroupName(item.name).toUpperCase();
      if (selectedSector === "QA") {
        return item.factory === "QA" || norm.includes("QA") || norm.includes("DQA") || norm.includes("MQA");
      }
      if (selectedSector === "MACRO") {
        return norm.startsWith("MACRO") || norm.startsWith("DIRECT") || norm === "MDS";
      }
      if (selectedSector === "FPC") {
        if (norm === "MACRO FPC" || norm === "DIRECT FPC" || norm === "MACRO PCN") return true;
        if (item.factory === "SMT" || item.factory === "QA") return false;
        return item.factory === "FPC";
      }
      if (selectedSector === "SMT") {
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
        if (isSmtMacro) return true;
        if (item.factory === "FPC" || item.factory === "QA") return false;
        return item.factory === "SMT";
      }
      if (selectedSector && selectedSector !== "ALL") {
        const groupDef = lineGroups?.find(g => normalizeMatrixLineGroupName(g.name).toUpperCase() === norm);
        if (groupDef && groupDef.factory && groupDef.factory !== selectedSector) return false;
        if (item.factory !== selectedSector) return false;
      }
      return true;
    });
  }, [lineGroups, currentRows, currentMatrixData, selectedSector, hiddenTables]);

  // Filter lines by search query
  const filteredAvailableLines = useMemo(() => {
    if (!lineSearchQuery.trim()) return availableLines;
    const q = lineSearchQuery.trim().toLowerCase();
    return availableLines.filter(item => item.name.toLowerCase().includes(q));
  }, [availableLines, lineSearchQuery]);

  // Check if target matches current loaded screen month
  const isCurrentScreenMatch = useMemo(() => {
    if (!currentStartDate) return false;
    const isSameYear = dayjs(currentStartDate).year() === selectedYear;
    const isSameMonth = dayjs(currentStartDate).month() === selectedMonth;
    const hasData = (currentRows && currentRows.length > 0) || (currentMatrixData && (Array.isArray(currentMatrixData) ? currentMatrixData.length > 0 : currentMatrixData.size > 0));
    return isSameYear && isSameMonth && hasData;
  }, [currentStartDate, selectedYear, selectedMonth, currentRows, currentMatrixData]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setStatusMessage("กำลังเตรียมข้อมูลสำหรับส่งออก...");

    const effectiveLineSelection = selectedLines.length > 0 ? selectedLines : "ALL";

    try {
      let customNames: Record<string, string> = {};
      try {
        const saved = localStorage.getItem("productivity_custom_line_names");
        if (saved) customNames = JSON.parse(saved);
      } catch { }

      // Path A: Match current screen state - instant export using loaded in-memory data
      if (isCurrentScreenMatch && ((currentRows && currentRows.length > 0) || (currentMatrixData && (Array.isArray(currentMatrixData) ? currentMatrixData.length > 0 : currentMatrixData.size > 0)))) {
        setStatusMessage("กำลังสร้างไฟล์ Excel...");
        const matrixArray = Array.isArray(currentMatrixData) ? currentMatrixData : Array.from(currentMatrixData.entries());
        await exportProductivityMatrixExcel({
          rawRows: currentRows,
          matrixData: matrixArray,
          dateColumns: currentDateColumns,
          aggregatedAttendanceData: currentAggregatedAttendance,
          planData: currentPlanData,
          targetData: currentTargetData,
          matDailyData: currentMatDailyData,
          calendarData: currentCalendarData,
          granularity: granularity || "daily",
          selectedFactory: selectedSector,
          selectedLineGroup: effectiveLineSelection,
          lineGroups,
          customLineNames: customNames,
          startDate: targetMonthDates.startDate,
          endDate: targetMonthDates.endDate,
          hiddenTables,
        });
        setIsExporting(false);
        onClose();
        return;
      }

      // Path B: Fast Fetch historical month data using PostgreSQL Snapshot
      const { startDate, endDate } = targetMonthDates;
      const apiBase = getApiBaseUrl();

      // 1. Fetch Calendar Data
      setStatusMessage("กำลังตรวจสอบปฏิทินวันทำงาน...");
      let calData: Record<string, any> = {};
      try {
        const calRes = await fetch(`${apiBase}/productivity/calendar?startDate=${startDate}&endDate=${endDate}`);
        if (calRes.ok) {
          const calJson = await calRes.json();
          if (Array.isArray(calJson)) {
            calJson.forEach((c: any) => {
              const dt = (c.holiday_date || c.date || "").split("T")[0];
              if (dt) calData[dt] = c;
            });
          }
        }
      } catch { }

      // 2. Fetch Aggregated Attendance (Fast Snapshot)
      setStatusMessage("กำลังรวบรวมข้อมูลกำลังพล (Manpower & Attendance)...");
      let attData: Record<string, any> = {};
      try {
        const attParams = new URLSearchParams({ startDate, endDate });
        const attRes = await fetch(`${apiBase}/productivity/attendance/summary?${attParams.toString()}`);
        if (attRes.ok) {
          const attJson: Record<string, any> = await attRes.json();
          Object.entries(attJson).forEach(([dateKey, metrics]) => {
            const calDay = calData[dateKey];
            const isWorking = calDay ? Number(calDay.is_working_day ?? 1) : 1;

            const regDirect = metrics.direct_register || 0;
            const regIndProd = metrics.indirect_prod_register || 0;
            const regInd = metrics.indirect_register || 0;
            const regUnknown = metrics.unknown_register || 0;
            const totalRegAll = regDirect + regIndProd + regInd + regUnknown;

            const actDirect = metrics.direct_actual || 0;
            const actIndProd = metrics.indirect_prod_actual || 0;
            const actInd = metrics.indirect_actual || 0;
            const actUnknown = metrics.unknown_actual || 0;
            const totalActAll = actDirect + actIndProd + actInd + actUnknown;

            const normalHrs = isWorking === 1 ? totalActAll * 8 : 0;
            const ot1PsnCount = metrics.ot1_actual || 0;
            const ot1Hrs = isWorking === 1 ? ot1PsnCount * 3 : 0;
            const ot2PsnCount = isWorking === 0 ? (totalActAll > 0 ? totalActAll : ot1PsnCount) : 0;
            const ot2Hrs = isWorking === 0 ? ot2PsnCount * 11 : 0;

            attData[dateKey] = {
              ...metrics,
              total_register: totalRegAll,
              total_actual: totalActAll,
              total_man_hour: normalHrs + ot1Hrs + ot2Hrs,
              leave: isWorking === 1 ? (totalRegAll - totalActAll) : 0,
              leave_working_day_rate: isWorking === 1 && totalRegAll > 0 ? ((totalRegAll - totalActAll) / totalRegAll) * 100 : 0,
              ot_psn: isWorking === 1 ? ot1PsnCount : ot2PsnCount,
              ot_working_day_rate: isWorking === 1 && totalRegAll > 0 ? (ot1PsnCount / totalRegAll) * 100 : 0,
              ot_holiday_day_rate: isWorking === 0 && totalRegAll > 0 ? (ot2PsnCount / totalRegAll) * 100 : 0,
              is_working_day: isWorking,
            };
          });
        }
      } catch { }

      // 3. Fetch Output Data (Fast PostgreSQL Snapshot)
      setStatusMessage("กำลังดึงข้อมูลยอดการผลิต (Output)...");
      const outParams = new URLSearchParams();
      outParams.append("startDate", startDate);
      outParams.append("endDate", endDate);
      outParams.append("lineGroup", "ALL");
      if (selectedSector !== "ALL" && selectedSector !== "MACRO" && selectedSector !== "QA") {
        outParams.append("factory", selectedSector);
      }

      const outRes = await fetch(`${apiBase}/productivity/productivity-smart-report?${outParams.toString()}`);
      if (!outRes.ok) throw new Error("ไม่สามารถดึงข้อมูลยอดการผลิตได้");
      const apiRows: any[] = await outRes.json();

      // Group rows with safe date extraction
      const groupedRows = new Map<string, LineGroupRow>();
      apiRows.forEach(item => {
        const rowDate = (item.output_date || item.date || "").split("T")[0];
        if (!rowDate) return;
        const process = (item.process_name || item.process || "").trim().toUpperCase();
        const mcLine = (item.mc_line || "").trim() || "Unknown";
        const lineGroup = normalizeMatrixLineGroupName(item.line_group || "Unknown");
        const key = `${rowDate}||${lineGroup}||${mcLine}`;

        if (!groupedRows.has(key)) {
          groupedRows.set(key, {
            date: rowDate,
            process: process,
            lineGroup: lineGroup,
            mcLine: mcLine,
            lotQty: 0,
            shtQty: 0,
            pieceQty: 0,
          });
        } else {
          const existing = groupedRows.get(key)!;
          if (!existing.process.split(", ").includes(process)) {
            existing.process += `, ${process}`;
          }
        }

        groupedRows.get(key)!.lotQty += Number(item.actual_lot_qty || 0);
        groupedRows.get(key)!.shtQty += Number(item.actual_sht_qty || 0);
        groupedRows.get(key)!.pieceQty += Number(item.actual_piece_qty || 0);
      });

      // 4. Fetch SMT & FPC Plan data (Piece, Sheet, Lot)
      const pcsPlanGrouped = new Map<string, Map<string, number>>();
      const shtPlanGrouped = new Map<string, Map<string, number>>();
      const lotPlanGrouped = new Map<string, Map<string, number>>();

      try {
        const [smtRes, fpcRes] = await Promise.all([
          fetch(`${apiBase}/productivity/smt-daily-actual-output?startDate=${startDate}&endDate=${endDate}`).catch(() => null),
          fetch(`${apiBase}/productivity/fpc-daily-actual-plan?startDate=${startDate}&endDate=${endDate}`).catch(() => null)
        ]);

        if (smtRes && smtRes.ok) {
          const smtData: any[] = await smtRes.json();
          smtData.forEach(item => {
            if (!item.line || item.daily_plan === undefined || item.daily_plan === null) return;
            const pDate = (item.date || item.output_date || "").split("T")[0];
            if (!pDate) return;
            const normLine = normalizeMatrixLineGroupName(item.line);
            const planVal = Number(item.daily_plan);
            if (!pcsPlanGrouped.has(normLine)) pcsPlanGrouped.set(normLine, new Map<string, number>());
            const dateMap = pcsPlanGrouped.get(normLine)!;
            dateMap.set(pDate, (dateMap.get(pDate) || 0) + planVal);
          });
        }

        if (fpcRes && fpcRes.ok) {
          const fpcData: any[] = await fpcRes.json();
          fpcData.forEach(item => {
            if (!item.line || !item.date) return;
            const pDate = (item.date || "").split("T")[0];
            if (!pDate) return;
            const normLine = normalizeMatrixLineGroupName(item.line);
            const pVal = Number(item.piece_plan || 0);
            const sVal = Number(item.sht_plan || 0);
            const lVal = Number(item.lot_plan || 0);

            if (!pcsPlanGrouped.has(normLine)) pcsPlanGrouped.set(normLine, new Map());
            if (!shtPlanGrouped.has(normLine)) shtPlanGrouped.set(normLine, new Map());
            if (!lotPlanGrouped.has(normLine)) lotPlanGrouped.set(normLine, new Map());

            if (pVal > 0) pcsPlanGrouped.get(normLine)!.set(pDate, (pcsPlanGrouped.get(normLine)!.get(pDate) || 0) + pVal);
            if (sVal > 0) shtPlanGrouped.get(normLine)!.set(pDate, (shtPlanGrouped.get(normLine)!.get(pDate) || 0) + sVal);
            if (lVal > 0) lotPlanGrouped.get(normLine)!.set(pDate, (lotPlanGrouped.get(normLine)!.get(pDate) || 0) + lVal);
          });
        }

        const getMergedPlan = (targetPlanMap: Map<string, Map<string, number>>, aliases: string[]) => {
          const merged = new Map<string, number>();
          const set = new Set(aliases.map(a => a.toUpperCase()));
          targetPlanMap.forEach((dateMap, name) => {
            const u = name.toUpperCase();
            const norm = normalizeMatrixLineGroupName(name).toUpperCase();
            const noLine = u.replace(/^LINE\s+/i, "");
            const withLine = u.startsWith("LINE ") ? u : `LINE ${u}`;
            if (set.has(u) || set.has(norm) || set.has(noLine) || set.has(withLine)) {
              dateMap.forEach((v, d) => merged.set(d, (merged.get(d) || 0) + v));
            }
          });
          return merged;
        };

        const masRewPlan = getMergedPlan(pcsPlanGrouped, ["MAS", "LINE MAS", "REW", "LINE REW"]);
        if (masRewPlan.size > 0) {
          pcsPlanGrouped.set("LINE MAS & REW", masRewPlan);
          pcsPlanGrouped.set("MAS & REW", masRewPlan);
        }

        const vacHpsPlanPcs = getMergedPlan(pcsPlanGrouped, ["VAC", "LINE VAC", "HPS", "LINE HPS"]);
        if (vacHpsPlanPcs.size > 0) pcsPlanGrouped.set("LINE VAC & HPS", vacHpsPlanPcs);
        const vacHpsPlanSht = getMergedPlan(shtPlanGrouped, ["VAC", "LINE VAC", "HPS", "LINE HPS"]);
        if (vacHpsPlanSht.size > 0) shtPlanGrouped.set("LINE VAC & HPS", vacHpsPlanSht);

        const autoPlan = getMergedPlan(pcsPlanGrouped, ["ASY1_A", "LINE ASY1_A", "ASY1_AUTO", "ASSY1_AUTO", "ASSY 1 (AUTOMOTIVE)"]);
        if (autoPlan.size > 0) {
          pcsPlanGrouped.set("Automotive", autoPlan);
          pcsPlanGrouped.set("AUTOMOTIVE", autoPlan);
        }

        const smtFrontPlan = getMergedPlan(pcsPlanGrouped, ["Macro SMT_F", "MACRO SMT_F", "SMT FRONT_DIRECT", "SMT Front_Direct", "SMT_FRONT_DIRECT"]);
        if (smtFrontPlan.size > 0) {
          pcsPlanGrouped.set("SMT FRONT_DIRECT", smtFrontPlan);
          pcsPlanGrouped.set("SMT Front_Direct", smtFrontPlan);
          pcsPlanGrouped.set("Macro SMT_F", smtFrontPlan);
        }

        const smtBackPlan = getMergedPlan(pcsPlanGrouped, ["Macro SMT_B", "MACRO SMT_B", "SMT BACK_DIRECT", "SMT Back_Direct", "SMT_BACK_DIRECT"]);
        if (smtBackPlan.size > 0) {
          pcsPlanGrouped.set("SMT BACK_DIRECT", smtBackPlan);
          pcsPlanGrouped.set("SMT Back_Direct", smtBackPlan);
          pcsPlanGrouped.set("Macro SMT_B", smtBackPlan);
        }

        const lineBPlanPcs = getMergedPlan(pcsPlanGrouped, ["LINE B_GEN", "B_GEN", "LINE B_NON", "B_NON"]);
        if (lineBPlanPcs.size > 0) pcsPlanGrouped.set("LINE B", lineBPlanPcs);
        const lineBPlanSht = getMergedPlan(shtPlanGrouped, ["LINE B_GEN", "B_GEN", "LINE B_NON", "B_NON"]);
        if (lineBPlanSht.size > 0) shtPlanGrouped.set("LINE B", lineBPlanSht);
      } catch { }

      // Build dateColumns
      const dateColumns: string[] = [];
      let cur = dayjs(startDate);
      const endD = dayjs(endDate);
      while (cur.isBefore(endD) || cur.isSame(endD, "day")) {
        dateColumns.push(cur.format("YYYY-MM-DD"));
        cur = cur.add(1, "day");
      }

      // Build multi-unit maps
      const pcsMatrixData = new Map<string, Map<string, number>>();
      const shtMatrixData = new Map<string, Map<string, number>>();
      const lotMatrixData = new Map<string, Map<string, number>>();

      groupedRows.forEach(row => {
        if (row.mcLine === "MANUAL_EXCEL") return;
        const lineGroup = row.lineGroup;
        const dateKey = row.date;

        if (!pcsMatrixData.has(lineGroup)) pcsMatrixData.set(lineGroup, new Map());
        if (!shtMatrixData.has(lineGroup)) shtMatrixData.set(lineGroup, new Map());
        if (!lotMatrixData.has(lineGroup)) lotMatrixData.set(lineGroup, new Map());

        pcsMatrixData.get(lineGroup)!.set(dateKey, (pcsMatrixData.get(lineGroup)!.get(dateKey) || 0) + row.pieceQty);
        shtMatrixData.get(lineGroup)!.set(dateKey, (shtMatrixData.get(lineGroup)!.get(dateKey) || 0) + row.shtQty);
        lotMatrixData.get(lineGroup)!.set(dateKey, (lotMatrixData.get(lineGroup)!.get(dateKey) || 0) + row.lotQty);
      });

      // For Line REW, use Plan as Output
      const rewPlan = pcsPlanGrouped.get("REW") || pcsPlanGrouped.get("LINE REW");
      if (rewPlan && rewPlan.size > 0) {
        const rewOut = pcsMatrixData.get("REW") || pcsMatrixData.get("LINE REW") || new Map<string, number>();
        rewPlan.forEach((v, d) => {
          if (!rewOut.has(d) || (rewOut.get(d) || 0) === 0) {
            rewOut.set(d, v);
          }
        });
        pcsMatrixData.set("REW", rewOut);
        pcsMatrixData.set("LINE REW", rewOut);
      }

      // Rollup Macro lines
      const macroFpcLines = ["LINE NPM", "LINE A", "LINE B_GEN", "LINE B_NON", "LINE B_JDT", "LINE C", "LINE D"];
      const macroSmtLines = [
        "ASY1_A", "ASY1_AUTO", "LINE ASY1_A", "ASSY 1 (AUTOMOTIVE)",
        "ASY1_G", "ASY1_GEN", "LINE ASY1_G", "ASSY 1 (GENERAL)", "ASSY1_GEN", "ASY1 GEN", "ASSY1 GEN",
        "ASY2", "LINE ASY2", "ASY3", "LINE ASY3"
      ];
      const asySmtLines = [
        "LINE ASY1_A", "ASY1_A", "ASY1_AUTO",
        "LINE ASY1_G", "ASY1_G", "ASY1_GEN",
        "LINE ASY2", "ASY2",
        "LINE ASY3", "ASY3",
        "AIX-ASY", "AIX_ASY", "LINE AIX-ASY", "ASY4", "ASSY4"
      ];

      ["Macro PCN", "Macro FPC", "Direct FPC", "Macro SMT", "Direct SMT"].forEach(macroName => {
        const isSmtMacro = macroName === "Macro SMT" || macroName === "Direct SMT";
        const targetLines = isSmtMacro ? macroSmtLines : macroFpcLines;

        const mPcs = new Map<string, number>();
        const mSht = new Map<string, number>();
        const mLot = new Map<string, number>();

        targetLines.forEach(l => {
          const normL = normalizeMatrixLineGroupName(l);
          pcsMatrixData.get(normL)?.forEach((v, dateKey) => mPcs.set(dateKey, (mPcs.get(dateKey) || 0) + v));
          shtMatrixData.get(normL)?.forEach((v, dateKey) => mSht.set(dateKey, (mSht.get(dateKey) || 0) + v));
          lotMatrixData.get(normL)?.forEach((v, dateKey) => mLot.set(dateKey, (mLot.get(dateKey) || 0) + v));
        });

        pcsMatrixData.set(macroName, mPcs);
        shtMatrixData.set(macroName, mSht);
        lotMatrixData.set(macroName, mLot);
      });

      // Rollup SMT Front lines (Macro SMT_F, SMT Front_Direct, SMT FRONT_DIRECT)
      const smtFrontLines = ["MOTA_A", "LINE MOTA_A", "MOTA_G", "LINE MOTA_G", "MOTB", "LINE MOTB", "AIX-MOT", "MOTC", "LINE MOTC", "MOTD", "LINE MOTD", "ASTP_A", "ASTP_G"];
      const smtFrontPcs = new Map<string, number>();
      const smtFrontSht = new Map<string, number>();
      const smtFrontLot = new Map<string, number>();
      smtFrontLines.forEach(l => {
        const normL = normalizeMatrixLineGroupName(l);
        pcsMatrixData.get(normL)?.forEach((v, dateKey) => smtFrontPcs.set(dateKey, (smtFrontPcs.get(dateKey) || 0) + v));
        shtMatrixData.get(normL)?.forEach((v, dateKey) => smtFrontSht.set(dateKey, (smtFrontSht.get(dateKey) || 0) + v));
        lotMatrixData.get(normL)?.forEach((v, dateKey) => smtFrontLot.set(dateKey, (smtFrontLot.get(dateKey) || 0) + v));
      });
      ["Macro SMT_F", "SMT Front_Direct", "SMT FRONT_DIRECT"].forEach(mName => {
        pcsMatrixData.set(mName, smtFrontPcs);
        shtMatrixData.set(mName, smtFrontSht);
        lotMatrixData.set(mName, smtFrontLot);
      });

      // Rollup SMT Back lines (Macro SMT_B, SMT Back_Direct, SMT BACK_DIRECT)
      ["Macro SMT_B", "SMT Back_Direct", "SMT BACK_DIRECT"].forEach(mName => {
        pcsMatrixData.set(mName, pcsMatrixData.get("Macro SMT") || new Map());
        shtMatrixData.set(mName, shtMatrixData.get("Macro SMT") || new Map());
        lotMatrixData.set(mName, lotMatrixData.get("Macro SMT") || new Map());
      });

      // Rollup ASY SMT (including AIX-ASY)
      const asyPcs = new Map<string, number>();
      const asySht = new Map<string, number>();
      const asyLot = new Map<string, number>();
      asySmtLines.forEach(l => {
        const normL = normalizeMatrixLineGroupName(l);
        pcsMatrixData.get(normL)?.forEach((v, dateKey) => asyPcs.set(dateKey, (asyPcs.get(dateKey) || 0) + v));
        shtMatrixData.get(normL)?.forEach((v, dateKey) => asySht.set(dateKey, (asySht.get(dateKey) || 0) + v));
        lotMatrixData.get(normL)?.forEach((v, dateKey) => asyLot.set(dateKey, (asyLot.get(dateKey) || 0) + v));
      });
      if (asyPcs.size > 0) pcsMatrixData.set("ASY SMT", asyPcs);
      if (asySht.size > 0) shtMatrixData.set("ASY SMT", asySht);
      if (asyLot.size > 0) lotMatrixData.set("ASY SMT", asyLot);

      // Rollup Macro Plans
      const rollupMacroPlan = (macroName: string, targetLines: string[]) => {
        const mPcs = new Map<string, number>();
        const mSht = new Map<string, number>();
        const mLot = new Map<string, number>();

        targetLines.forEach(l => {
          const normL = normalizeMatrixLineGroupName(l);
          pcsPlanGrouped.get(normL)?.forEach((v, d) => mPcs.set(d, (mPcs.get(d) || 0) + v));
          shtPlanGrouped.get(normL)?.forEach((v, d) => mSht.set(d, (mSht.get(d) || 0) + v));
          lotPlanGrouped.get(normL)?.forEach((v, d) => mLot.set(d, (mLot.get(d) || 0) + v));
        });

        if (mPcs.size > 0) pcsPlanGrouped.set(macroName, mPcs);
        if (mSht.size > 0) shtPlanGrouped.set(macroName, mSht);
        if (mLot.size > 0) lotPlanGrouped.set(macroName, mLot);
      };

      rollupMacroPlan("Macro FPC", macroFpcLines);
      rollupMacroPlan("Direct FPC", macroFpcLines);
      rollupMacroPlan("Macro SMT", macroSmtLines);
      rollupMacroPlan("Direct SMT", macroSmtLines);
      rollupMacroPlan("Macro SMT_F", smtFrontLines);
      rollupMacroPlan("SMT FRONT_DIRECT", smtFrontLines);
      rollupMacroPlan("SMT Front_Direct", smtFrontLines);
      rollupMacroPlan("Macro SMT_B", macroSmtLines);
      rollupMacroPlan("SMT BACK_DIRECT", macroSmtLines);
      rollupMacroPlan("SMT Back_Direct", macroSmtLines);
      rollupMacroPlan("Macro PCN", [...macroFpcLines, ...macroSmtLines]);
      rollupMacroPlan("ASY SMT", asySmtLines);

      setStatusMessage("กำลังเขียนไฟล์ Excel...");

      let targetsData: any[] = [];
      try {
        targetsData = await fetchMatrixTargetsData(startDate, endDate);
      } catch { }

      let matDataToExport = currentMatDailyData;
      if ((!matDataToExport || matDataToExport.length === 0 || startDate !== currentStartDate) && startDate && endDate) {
        try {
          matDataToExport = await fetchMatDailyOutput(startDate, endDate);
        } catch { }
      }

      await exportProductivityMatrixExcel({
        pcsMatrixData,
        shtMatrixData,
        lotMatrixData,
        dateColumns,
        aggregatedAttendanceData: attData,
        planData: pcsPlanGrouped,
        shtPlanData: shtPlanGrouped,
        lotPlanData: lotPlanGrouped,
        targetData: targetsData,
        matDailyData: matDataToExport,
        calendarData: calData,
        granularity: granularity || "daily",
        selectedFactory: selectedSector,
        selectedLineGroup: effectiveLineSelection,
        lineGroups,
        customLineNames: customNames,
        startDate,
        endDate,
        hiddenTables,
      });

      setIsExporting(false);
      onClose();
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
      setIsExporting(false);
      setStatusMessage("");
    }
  }, [
    isCurrentScreenMatch,
    currentRows,
    currentMatrixData,
    currentDateColumns,
    currentAggregatedAttendance,
    currentPlanData,
    currentCalendarData,
    selectedSector,
    selectedLines,
    lineGroups,
    targetMonthDates,
    onClose,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-300 w-full max-w-lg overflow-hidden flex flex-col text-slate-900 relative"
        style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-white to-sky-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              Export Productivity Excel
            </h3>
            <p className="text-xs text-slate-600 font-medium">
              ส่งออกตาราง Productivity ครบทุกหน่วย (Pcs, Sht, Lot)
            </p>
          </div>
          <button
            type="button"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            onClick={onClose}
            disabled={isExporting}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[calc(88vh-130px)] bg-white text-slate-900">
          {/* Month & Year Interactive Picker */}
          <div className="rounded-2xl border border-slate-300 bg-slate-50/50 p-4 shadow-xs">
            {/* Year Selector */}
            <div className="flex items-center justify-between mb-3 px-2">
              <button
                type="button"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition-colors cursor-pointer border border-slate-200 bg-white"
                onClick={() => setSelectedYear(prev => prev - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-2 font-black text-base text-slate-900">
                <Calendar size={18} className="text-emerald-600" />
                <span className="text-slate-900 text-lg font-black">{selectedYear}</span>
                <span className="text-xs font-bold text-slate-600">
                  ({MONTH_NAMES[selectedMonth].fullEn})
                </span>
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition-colors cursor-pointer border border-slate-200 bg-white"
                onClick={() => setSelectedYear(prev => prev + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* 12 Months Grid */}
            <div className="grid grid-cols-4 gap-2">
              {MONTH_NAMES.map(m => {
                const isSelected = selectedMonth === m.idx;
                return (
                  <button
                    key={m.idx}
                    type="button"
                    className={`py-2 px-1 rounded-xl text-center font-bold text-xs transition-all flex flex-col items-center justify-center gap-0.5 border cursor-pointer ${isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/30 scale-[1.03]"
                        : "bg-white text-slate-900 border-slate-300 hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-950"
                      }`}
                    onClick={() => setSelectedMonth(m.idx)}
                  >
                    <span className={`leading-tight font-extrabold ${isSelected ? "text-white" : "text-slate-900"}`}>{m.en}</span>
                    <span className={`text-[10px] font-semibold leading-none ${isSelected ? "text-emerald-100" : "text-slate-500"}`}>
                      {m.th}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sector & Line Selection Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Sector Configuration (Sleek Segmented Pill Selector - No Clipping) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Building2 size={14} className="text-slate-600" />
                Sector ที่ต้องการส่งออก
              </label>
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
                {[
                  { id: "ALL", label: "All" },
                  { id: "FPC", label: "FPC" },
                  { id: "SMT", label: "SMT" },
                  { id: "QA", label: "QA" },
                ].map(opt => {
                  const isSelected = selectedSector === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`h-7 px-1 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center cursor-pointer ${
                        isSelected
                          ? "bg-white text-emerald-900 shadow-xs border border-emerald-500/30 font-black"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                      }`}
                      onClick={() => {
                        setSelectedSector(opt.id);
                        setSelectedLines([]);
                      }}
                    >
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Line Selection Trigger */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Layers size={14} className="text-slate-600" />
                  เลือกไลน์ (Line Selection)
                </label>
                {selectedLines.length > 0 && (
                  <button
                    type="button"
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                    onClick={() => setSelectedLines([])}
                  >
                    ล้าง ({selectedLines.length})
                  </button>
                )}
              </div>

              {/* Selector Trigger Button */}
              <button
                type="button"
                className={`w-full h-8 px-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${selectedLines.length > 0
                    ? "border-emerald-500 bg-emerald-50 text-emerald-950"
                    : "border-slate-300 bg-white hover:border-slate-400 text-slate-700"
                  }`}
                onClick={() => setIsLineSelectorOpen(true)}
              >
                <span className="text-xs truncate font-bold">
                  {selectedLines.length === 0
                    ? `ทุกไลน์ในแผนก (${availableLines.length} ไลน์)`
                    : `เลือกเฉพาะ ${selectedLines.length} จาก ${availableLines.length} ไลน์`}
                </span>
                <div className="flex items-center gap-1 shrink-0 ml-1">
                  {selectedLines.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-md bg-emerald-600 text-white font-black text-[10px]">
                      {selectedLines.length}
                    </span>
                  )}
                  <ChevronRight size={14} className="text-slate-500" />
                </div>
              </button>
            </div>
          </div>

          {/* Export Details Badge */}
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs flex items-center justify-between text-emerald-950 font-bold">
            <span className="font-bold text-emerald-950">
              ช่วงวันที่ส่งออก: {targetMonthDates.startDate} ถึง {targetMonthDates.endDate}
            </span>
            <span className="font-mono font-black bg-emerald-200 text-emerald-950 px-2 py-0.5 rounded-lg text-[11px]">
              {targetMonthDates.daysInMonth} วัน
            </span>
          </div>

          {/* Loading status message */}
          {isExporting && statusMessage && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-sky-50 border border-sky-300 text-sky-950 text-xs font-bold animate-pulse">
              <span className="loading loading-spinner loading-xs text-sky-600" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            className="btn btn-sm btn-ghost rounded-xl font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-200 cursor-pointer"
            onClick={onClose}
            disabled={isExporting}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            className="btn btn-sm rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 border-none shadow-lg shadow-emerald-600/30 flex items-center gap-2 px-5 cursor-pointer disabled:opacity-50"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <span className="loading loading-spinner loading-xs text-white" />
                <span>กำลังส่งออก Excel...</span>
              </>
            ) : (
              <>
                <Download size={15} />
                <span>ดาวน์โหลด Excel ({MONTH_NAMES[selectedMonth].en} {selectedYear})</span>
              </>
            )}
          </button>
        </div>

        {/* Full-Modal Line Selection Subview (No clipping, fixed dimensions) */}
        {isLineSelectorOpen && (
          <div className="absolute inset-0 z-50 bg-white rounded-3xl flex flex-col overflow-hidden animate-in fade-in duration-150 text-slate-900">
            {/* Subview Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-white to-sky-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors cursor-pointer border border-slate-200 bg-white"
                  onClick={() => setIsLineSelectorOpen(false)}
                >
                  <ChevronLeft size={18} />
                </button>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    เลือกกลุ่มไลน์ที่ต้องการส่งออก
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    {selectedLines.length === 0
                      ? `ส่งออกทุกไลน์ (${availableLines.length} ไลน์)`
                      : `เลือกไว้ ${selectedLines.length} จาก ${availableLines.length} ไลน์`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                onClick={() => setIsLineSelectorOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Subview Controls */}
            <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  className="w-full h-8 pl-8 pr-8 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                  placeholder="ค้นหาชื่อไลน์ (เช่น A, B, BLK, SMT, QA)..."
                  value={lineSearchQuery}
                  onChange={e => setLineSearchQuery(e.target.value)}
                />
                {lineSearchQuery && (
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    onClick={() => setLineSearchQuery("")}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <button
                type="button"
                className="px-3 h-8 rounded-xl bg-emerald-100 border border-emerald-300 hover:bg-emerald-200 text-xs font-bold text-emerald-900 transition-colors shrink-0 cursor-pointer"
                onClick={() => {
                  const allNames = filteredAvailableLines.map(l => l.name);
                  setSelectedLines(Array.from(new Set([...selectedLines, ...allNames])));
                }}
              >
                เลือกทั้งหมด ({filteredAvailableLines.length})
              </button>
              <button
                type="button"
                className="px-3 h-8 rounded-xl bg-white border border-slate-300 hover:bg-rose-50 hover:text-rose-800 text-xs font-bold text-slate-700 transition-colors shrink-0 cursor-pointer"
                onClick={() => {
                  if (lineSearchQuery) {
                    const filteredSet = new Set(filteredAvailableLines.map(l => l.name));
                    setSelectedLines(prev => prev.filter(n => !filteredSet.has(n)));
                  } else {
                    setSelectedLines([]);
                  }
                }}
              >
                ล้าง
              </button>
            </div>

            {/* Subview Line Checklist (Scrollable Grid) */}
            <div className="p-6 overflow-y-auto flex-1 min-h-0 grid grid-cols-2 gap-2 bg-white content-start">
              {filteredAvailableLines.length === 0 ? (
                <div className="col-span-2 py-10 text-center text-xs text-slate-500 font-medium">
                  ไม่พบกลุ่มไลน์ที่ตรงกับคำค้นหา "{lineSearchQuery}"
                </div>
              ) : (
                filteredAvailableLines.map(item => {
                  const isChecked = selectedLines.includes(item.name);
                  return (
                    <label
                      key={item.name}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition-all ${isChecked
                          ? "bg-emerald-50/80 border-emerald-500 text-emerald-950 font-bold shadow-xs"
                          : "bg-slate-50/60 border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-white font-medium"
                        }`}
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs checkbox-success rounded"
                        checked={isChecked}
                        onChange={() => {
                          setSelectedLines(prev => {
                            if (prev.includes(item.name)) {
                              return prev.filter(n => n !== item.name);
                            } else {
                              return [...prev, item.name];
                            }
                          });
                        }}
                      />
                      <span className="truncate flex-1 font-semibold" title={item.name}>
                        {item.name}
                      </span>
                      <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md shrink-0">
                        {item.factory}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            {/* Subview Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between mt-auto shrink-0">
              <span className="text-xs font-bold text-slate-700">
                {selectedLines.length === 0
                  ? "ส่งออกทุกไลน์ตามแผนกที่เลือก"
                  : `เลือกไว้ทั้งหมด ${selectedLines.length} ไลน์`}
              </span>
              <button
                type="button"
                className="btn btn-sm rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 border-none shadow-md shadow-emerald-600/25 px-5 cursor-pointer"
                onClick={() => setIsLineSelectorOpen(false)}
              >
                ยืนยันและกลับ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
