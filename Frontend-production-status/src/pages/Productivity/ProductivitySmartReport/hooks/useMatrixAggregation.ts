import { useMemo, useEffect, useState } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import { LineGroupRow, OutputUnit, Granularity } from "../types";
import { normalizeMatrixLineGroupName } from "./useProcessOutputData";
import { fetchCustomMacroLines, getCachedCustomMacroLines, getCustomMacroOutputSources, CustomMacroLine } from "../utils/customMacroStore";
import { getFiscalQuarter, getProductionWeekKey } from "../utils/fiscalYear";

dayjs.extend(isoWeek);
dayjs.extend(quarterOfYear);

interface UseMatrixAggregationProps {
  rows: LineGroupRow[];
  startDate: string;
  endDate: string;
  selectedUnit: OutputUnit;
  granularity: Granularity;
  calendarData?: Record<string, number>;
  attendanceData?: Record<string, any>;
}

// Master list of all sub-line attendance prefixes
const ALL_SUB_LINE_PREFIXES = [
  // MOT & SMT Front
  "mota", "mota_g", "motb", "motb_g", "motc", "motd", "mds",
  "astp_a", "astp_g", "xray", "mas_rew", "mas", "rew", "s_tste_f", "s_tech_f",
  // SMT Back & ASSY
  "blk_1", "blk_2", "asy1_a", "asy1_g", "asy2", "asy3", "asy4", "asy5", "asy6", "asy7", "aelt",
  "smt_lam", "lam_md", "md_lam", "s_tste_b", "s_ind", "aix_asy",
  // QA
  "oa_f_ind", "iqi_m", "iqi_f", "pqi_r", "pqi_m", "oqi_f", "oqi_f_pack", "oqi_fpc_100", "oqi_f_auto",
  "oqi_s_auto", "oqi_s_gen", "qa_smt_indirect", "oqi_m_a", "oqi_m_b", "oqi_m_d", "oqi_m", "dqa", "qa_smt", "qa_fpc",
  // FPC
  "line_a", "at_front", "at_vac", "at_lam", "line_a_final", "line_b_gen", "line_b_non",
  "line_c", "line_d", "line_mat", "line_lam", "line_vac", "line_hps", "line_blk", "line_ost", "line_avi_k2",
  // Direct / Indirect aggregates
  "direct", "indirect", "indirectProduction", "unknown", "fpc", "fpc_direct"
];

// Helper to calculate standard attendance metrics per prefix
const calculatePrefixAttendance = (prefix: string, metrics: Record<string, any>, isWorking: number, resultTarget: Record<string, any>) => {
  const register = Number(metrics[`${prefix}_total_register`]) || Number(metrics[`${prefix}_register`]) || (prefix === 'fpc_direct' ? Number(metrics.fpc_direct_register) : 0) || 0;
  const actual = Number(metrics[`${prefix}_total_actual`]) || Number(metrics[`${prefix}_actual`]) || (prefix === 'fpc_direct' ? Number(metrics.fpc_direct_actual) : 0) || 0;
  const ot1Actual = Number(metrics[`${prefix}_ot1_actual`]) || Number(metrics[`${prefix}_ot_psn`]) || Number(metrics[`${prefix}_ot1`]) || (prefix === 'fpc_direct' ? (Number(metrics.fpc_direct_ot1_actual) || Number(metrics.fpc_direct_ot_psn)) : 0) || 0;
  const helpInNormal = Number(metrics[`${prefix}_help_in_normal`]) || 0;
  const helpOutNormal = Number(metrics[`${prefix}_help_out_normal`]) || 0;
  const helpInOT1 = Number(metrics[`${prefix}_help_in_ot1`]) || 0;
  const helpOutOT1 = Number(metrics[`${prefix}_help_out_ot1`]) || 0;
  const helpInOT2 = Number(metrics[`${prefix}_help_in_ot2`]) || 0;
  const helpOutOT2 = Number(metrics[`${prefix}_help_out_ot2`]) || 0;

  const rawLeave = Number(metrics[`${prefix}_leave`]);
  const leave = Number.isFinite(rawLeave) && rawLeave > 0 ? rawLeave : (isWorking === 1 ? Math.max(0, register - actual) : 0);

  const rawManHour = Number(metrics[`${prefix}_total_man_hour`]) || Number(metrics[`${prefix}_man_hour`]);
  const normalHours = isWorking === 1 ? ((actual + helpInNormal) - helpOutNormal) * 8 : 0;
  const ot1Hours = isWorking === 1 ? ((ot1Actual + helpInOT1) - helpOutOT1) * 3 : 0;
  const ot2PsnCount = isWorking === 0 ? (ot1Actual > 0 ? ot1Actual : (actual < register ? actual : 0)) : 0;
  const ot2Hours = isWorking === 0 ? ((ot2PsnCount + helpInOT2) - helpOutOT2) * 11 : 0;
  const calcTotalManHour = Math.max(0, normalHours + ot1Hours + ot2Hours);

  // Use calculated standard man-hour (matches Excel & Manpower Audit), fallback to rawManHour only if line has no attendance data
  const hasAttendance = register > 0 || actual > 0 || ot1Actual > 0;
  const totalManHour = Math.round(hasAttendance ? calcTotalManHour : (Number.isFinite(rawManHour) && rawManHour > 0 ? rawManHour : calcTotalManHour));

  const otPsn = isWorking === 1 ? ot1Actual : (Number(metrics[`${prefix}_ot_psn`]) || (ot1Actual > 0 ? ot1Actual : 0));

  resultTarget[`${prefix}_total_register`] = register;
  resultTarget[`${prefix}_register`] = register;
  resultTarget[`${prefix}_total_actual`] = actual;
  resultTarget[`${prefix}_actual`] = actual;
  resultTarget[`${prefix}_total_man_hour`] = totalManHour;
  resultTarget[`${prefix}_leave`] = leave;
  resultTarget[`${prefix}_leave_working_day_rate`] = isWorking === 1 && register > 0 ? (leave / register) * 100 : 0;
  resultTarget[`${prefix}_ot_psn`] = otPsn;
  resultTarget[`${prefix}_ot_working_day_rate`] = isWorking === 1 && register > 0 ? (otPsn / register) * 100 : 0;
  resultTarget[`${prefix}_ot_holiday_day_rate`] = isWorking === 0 && register > 0 ? (otPsn / register) * 100 : 0;
};

// Helper to combine multiple sub-line attendance metrics into an aggregate group
const combineAttendanceGroups = (
  metrics: Record<string, any>,
  targetPrefix: string,
  sourcePrefixes: string[]
) => {
  const sum = (suffix: string) => sourcePrefixes.reduce(
    (total, prefix) => total + (Number(metrics[`${prefix}_${suffix}`]) || 0),
    0
  );
  const register = sum("total_register");
  const actual = sum("total_actual");
  const leave = sum("leave");
  const otPsn = sum("ot_psn");
  const isWorking = metrics.is_working_day === 1;

  metrics[`${targetPrefix}_total_register`] = register;
  metrics[`${targetPrefix}_total_actual`] = actual;
  metrics[`${targetPrefix}_total_man_hour`] = Math.round(sum("total_man_hour"));
  metrics[`${targetPrefix}_leave`] = leave;
  metrics[`${targetPrefix}_ot_psn`] = otPsn;
  metrics[`${targetPrefix}_help_in_normal`] = sum("help_in_normal");
  metrics[`${targetPrefix}_help_out_normal`] = sum("help_out_normal");
  metrics[`${targetPrefix}_help_in_ot1`] = sum("help_in_ot1");
  metrics[`${targetPrefix}_help_out_ot1`] = sum("help_out_ot1");
  metrics[`${targetPrefix}_help_in_ot2`] = sum("help_in_ot2");
  metrics[`${targetPrefix}_help_out_ot2`] = sum("help_out_ot2");
  metrics[`${targetPrefix}_leave_working_day_rate`] = isWorking && register > 0 ? (leave / register) * 100 : 0;
  metrics[`${targetPrefix}_ot_working_day_rate`] = isWorking && register > 0 ? (otPsn / register) * 100 : 0;
  metrics[`${targetPrefix}_ot_holiday_day_rate`] = !isWorking && register > 0 ? (otPsn / register) * 100 : 0;
};

export const useMatrixAggregation = ({
  rows,
  startDate,
  endDate,
  selectedUnit,
  granularity,
  calendarData,
  attendanceData,
}: UseMatrixAggregationProps) => {
  const [customMacros, setCustomMacros] = useState<CustomMacroLine[]>(getCachedCustomMacroLines);

  useEffect(() => {
    fetchCustomMacroLines().then(lines => {
      if (lines && lines.length > 0) setCustomMacros(lines);
    });

    const handleCustomMacrosSync = (e: any) => {
      const updated = e?.detail || getCachedCustomMacroLines();
      setCustomMacros(updated);
    };

    window.addEventListener("custom-macros-updated", handleCustomMacrosSync);
    return () => window.removeEventListener("custom-macros-updated", handleCustomMacrosSync);
  }, []);

  // 1. Generate date columns
  const dateColumns = useMemo(() => {
    if (!startDate || !endDate) return [];
    const keys = new Set<string>();
    let current = dayjs(startDate);
    const end = dayjs(endDate);
    const isSingleMonth = startDate.slice(0, 7) === endDate.slice(0, 7);
    const targetMonth = startDate.slice(0, 7);

    while (current.isBefore(end) || current.isSame(end, "day")) {
      let key = "";
      if (granularity === "yearly") key = current.format("YYYY");
      else if (granularity === "quarterly") key = getFiscalQuarter(current);
      else if (granularity === "monthly") key = current.format("YYYY-MM");
      else if (granularity === "weekly") {
        key = getProductionWeekKey(current);
        if (isSingleMonth && !key.startsWith(targetMonth)) {
          current = current.add(1, "day");
          continue;
        }
      }
      else key = current.format("YYYY-MM-DD");

      keys.add(key);
      current = current.add(1, "day");
    }
    return Array.from(keys);
  }, [startDate, endDate, granularity]);

  // 2. Aggregate attendance metrics
  const aggregatedAttendanceData = useMemo(() => {
    if (!attendanceData) return {};
    if (Object.values(attendanceData)[0]?._is_precomputed_period_summary) {
      return attendanceData;
    }

    const result: Record<string, any> = {};

    Object.entries(attendanceData).forEach(([dateStr, metrics]) => {
      const rowDate = dayjs(dateStr);
      if (!rowDate.isValid()) return;

      const dateKey = rowDate.format("YYYY-MM-DD");
      if (!result[dateKey]) {
        result[dateKey] = { ...metrics };
      }

      // Check working day status from calendar or API
      let isWorking = 1;
      if (calendarData && calendarData[dateKey] !== undefined) {
        isWorking = Number(calendarData[dateKey]) === 1 ? 1 : 0;
      } else if (metrics.is_working_day !== undefined) {
        isWorking = Number(metrics.is_working_day) === 1 ? 1 : 0;
      } else if (metrics.work_day_type === "O" || metrics.work_day_type === "H" || metrics.work_day_status === "O" || metrics.work_day_status === "H") {
        isWorking = 0;
      }
      result[dateKey].is_working_day = isWorking;

      // 1. Calculate Global / Total Attendance Metrics (Macro PCN Level)
      const regAll = Number(metrics.total_register) || 0;
      const actAll = Number(metrics.total_actual) || 0;
      const ot1PsnAll = Number(metrics.ot1_actual) || 0;
      const leaveAll = isWorking === 1 ? Math.max(0, regAll - actAll) : 0;
      const helpInNormalAll = Number(metrics.help_in_normal) || 0;
      const helpOutNormalAll = Number(metrics.help_out_normal) || 0;
      const helpInOt1All = Number(metrics.help_in_ot1) || 0;
      const helpOutOt1All = Number(metrics.help_out_ot1) || 0;
      const helpInOt2All = Number(metrics.help_in_ot2) || 0;
      const helpOutOt2All = Number(metrics.help_out_ot2) || 0;

      const normalHoursAll = isWorking === 1 ? ((actAll + helpInNormalAll) - helpOutNormalAll) * 8 : 0;
      const ot1HoursAll = isWorking === 1 ? ((ot1PsnAll + helpInOt1All) - helpOutOt1All) * 3 : 0;
      const ot2PsnCountAll = isWorking === 0 ? (ot1PsnAll > 0 ? ot1PsnAll : (actAll < regAll ? actAll : 0)) : 0;
      const ot2HoursAll = isWorking === 0 ? ((ot2PsnCountAll + helpInOt2All) - helpOutOt2All) * 11 : 0;
      const calcTotalMhAll = Math.max(0, normalHoursAll + ot1HoursAll + ot2HoursAll);
      const totalMhAll = calcTotalMhAll > 0 ? calcTotalMhAll : (Number(metrics.total_man_hour) || 0);
      const otPsnAll = isWorking === 1 ? ot1PsnAll : ot2PsnCountAll;

      result[dateKey].total_register = regAll;
      result[dateKey].total_actual = actAll;
      result[dateKey].total_man_hour = totalMhAll;
      result[dateKey].leave = leaveAll;
      result[dateKey].leave_working_day_rate = isWorking === 1 && regAll > 0 ? (leaveAll / regAll) * 100 : 0;
      result[dateKey].ot_psn = otPsnAll;
      result[dateKey].ot_working_day_rate = isWorking === 1 && regAll > 0 ? (otPsnAll / regAll) * 100 : 0;
      result[dateKey].ot_holiday_day_rate = isWorking === 0 && regAll > 0 ? (otPsnAll / regAll) * 100 : 0;

      // 2. Calculate attendance metrics for all standard subline prefixes
      ALL_SUB_LINE_PREFIXES.forEach(prefix => {
        calculatePrefixAttendance(prefix, metrics, isWorking, result[dateKey]);
      });

      // Dynamically copy any extra unmapped numbers
      Object.keys(metrics).forEach(k => {
        if (typeof metrics[k] === "number" && result[dateKey][k] === undefined) {
          result[dateKey][k] = metrics[k];
        }
      });
    });

    // Combine attendance groups for composite macro lines
    Object.values(result).forEach(metrics => {
      combineAttendanceGroups(metrics, "line_a", ["at_front", "at_vac", "at_lam", "line_a_final"]);
      combineAttendanceGroups(metrics, "line_a_auto", ["at_front", "at_vac", "at_lam", "line_a_final"]);
      combineAttendanceGroups(metrics, "line_b", ["line_b_gen", "line_b_non"]);
      combineAttendanceGroups(metrics, "line_vac_hps", ["line_vac", "line_hps"]);

      combineAttendanceGroups(metrics, "smt_front_direct", [
        "mota", "mota_g", "motb", "motb_g", "motc", "motd",
        "astp_a", "astp_g", "xray", "mas", "rew",
      ]);
      combineAttendanceGroups(metrics, "smt_front_indirect", ["s_tste_f", "s_tech_f"]);
      combineAttendanceGroups(metrics, "macro_smt_f", ["smt_front_direct", "smt_front_indirect"]);
      combineAttendanceGroups(metrics, "asy_smt", ["asy1_a", "asy1_g", "asy2", "asy3", "asy4"]);
      combineAttendanceGroups(metrics, "smt_back_direct", [
        "blk_1", "blk_2", "asy1_a", "asy1_g", "asy2", "asy3", "asy4", "asy5", "asy6", "asy7", "aelt", "smt_lam", "lam_md", "md_lam",
      ]);
      combineAttendanceGroups(metrics, "smt_back_indirect", ["s_tste_b", "s_ind"]);
      combineAttendanceGroups(metrics, "macro_smt_b", ["smt_back_direct", "smt_back_indirect"]);
      combineAttendanceGroups(metrics, "direct_smt", ["smt_front_direct", "smt_back_direct"]);
      combineAttendanceGroups(metrics, "macro_smt", ["macro_smt_f", "macro_smt_b"]);
      combineAttendanceGroups(metrics, "qa_fpc", [
        "oa_f_ind", "iqi_m", "iqi_f", "pqi_r", "pqi_m",
        "oqi_f", "oqi_f_pack", "oqi_fpc_100", "oqi_f_auto",
      ]);
      combineAttendanceGroups(metrics, "qa_smt", ["oqi_s_auto", "oqi_s_gen", "qa_smt_indirect"]);
      combineAttendanceGroups(metrics, "dqa", ["oqi_m_a", "oqi_m_b", "oqi_m_d", "oqi_m"]);

      // Explicit Direct FPC & Macro FPC leave, rates, and Man Hours matching Excel
      const isWorking = metrics.is_working_day === 1;

      const directFpcHelpPrefixes = [
        "line_hps", "line_vac", "line_blk", "line_lam", "line_ost",
        "line_avi_k2", "line_d", "line_c", "line_b_gen", "line_b_non",
        "at_front", "at_vac", "at_lam", "line_a_final"
      ];
      const sumDirectHelp = (suffix: string) => directFpcHelpPrefixes.reduce(
        (sum, p) => sum + (Number(metrics[`${p}_${suffix}`]) || 0),
        0
      );

      const directFpcReg = Number(metrics.fpc_direct_register) || Number(metrics.fpc_direct_total_register) || 0;
      const directFpcAct = Number(metrics.fpc_direct_actual) || Number(metrics.fpc_direct_total_actual) || 0;
      const directFpcLeave = isWorking ? Math.max(0, directFpcReg - directFpcAct) : 0;
      const directFpcOt1 = Number(metrics.fpc_direct_ot1_actual) || Number(metrics.fpc_direct_ot_psn) || 0;

      const directHelpInNorm = sumDirectHelp("help_in_normal"); // in man-days (hours / 8)
      const directHelpOutNorm = sumDirectHelp("help_out_normal"); // in man-days (hours / 8)
      const directHelpInOT1 = sumDirectHelp("help_in_ot1"); // in persons
      const directHelpOutOT1 = sumDirectHelp("help_out_ot1"); // in persons
      const directHelpInOT2 = sumDirectHelp("help_in_ot2"); // in persons
      const directHelpOutOT2 = sumDirectHelp("help_out_ot2"); // in persons

      const directFpcNormH = isWorking ? Math.max(0, Math.round((directFpcAct + directHelpInNorm - directHelpOutNorm) * 8)) : 0;
      const directNetOt1 = Math.max(0, directFpcOt1 + directHelpInOT1 - directHelpOutOT1);
      const directFpcOt1H = isWorking ? Math.round(directNetOt1 * 3) : 0;
      const directNetOt2 = Math.max(0, directFpcOt1 + directHelpInOT2 - directHelpOutOT2);
      const directFpcOt2H = !isWorking ? Math.round(directNetOt2 * 11) : 0;
      const directFpcTotalMH = isWorking ? (directFpcNormH + directFpcOt1H) : directFpcOt2H;

      metrics.fpc_direct_register = directFpcReg;
      metrics.fpc_direct_total_register = directFpcReg;
      metrics.fpc_direct_actual = directFpcAct;
      metrics.fpc_direct_total_actual = directFpcAct;
      metrics.fpc_direct_leave = directFpcLeave;
      metrics.fpc_direct_leave_working_day_rate = isWorking && directFpcReg > 0 ? (directFpcLeave / directFpcReg) * 100 : 0;
      metrics.fpc_direct_ot_psn = directFpcOt1;
      metrics.fpc_direct_ot_working_day_rate = isWorking && directFpcReg > 0 ? (directFpcOt1 / directFpcReg) * 100 : 0;
      metrics.fpc_direct_ot_holiday_day_rate = !isWorking && directFpcReg > 0 ? (directFpcOt1 / directFpcReg) * 100 : 0;
      metrics.fpc_direct_total_man_hour = directFpcTotalMH;
      metrics.fpc_direct_normal_man_hour = directFpcNormH;
      metrics.fpc_direct_ot_man_hour = isWorking ? directFpcOt1H : directFpcOt2H;
      metrics.fpc_direct_help_in_normal = directHelpInNorm;
      metrics.fpc_direct_help_out_normal = directHelpOutNorm;
      metrics.fpc_direct_help_in_ot1 = directHelpInOT1;
      metrics.fpc_direct_help_out_ot1 = directHelpOutOT1;
      metrics.fpc_direct_help_in_ot2 = directHelpInOT2;
      metrics.fpc_direct_help_out_ot2 = directHelpOutOT2;

      // Macro FPC
      const allFpcHelpPrefixes = [...directFpcHelpPrefixes, "line_mat"];
      const sumAllFpcHelp = (suffix: string) => allFpcHelpPrefixes.reduce(
        (sum, p) => sum + (Number(metrics[`${p}_${suffix}`]) || 0),
        0
      );

      const fpcReg = Number(metrics.fpc_total_register) || 0;
      const fpcAct = Number(metrics.fpc_total_actual) || 0;
      const fpcLeave = isWorking ? Math.max(0, fpcReg - fpcAct) : 0;
      const fpcOt1 = Number(metrics.fpc_ot1_actual) || Number(metrics.fpc_ot_psn) || 0;

      const fpcHelpInNorm = sumAllFpcHelp("help_in_normal");
      const fpcHelpOutNorm = sumAllFpcHelp("help_out_normal");
      const fpcHelpInOT1 = sumAllFpcHelp("help_in_ot1");
      const fpcHelpOutOT1 = sumAllFpcHelp("help_out_ot1");
      const fpcHelpInOT2 = sumAllFpcHelp("help_in_ot2");
      const fpcHelpOutOT2 = sumAllFpcHelp("help_out_ot2");

      const fpcNormH = isWorking ? Math.max(0, Math.round((fpcAct + fpcHelpInNorm - fpcHelpOutNorm) * 8)) : 0;
      const fpcNetOt1 = Math.max(0, fpcOt1 + fpcHelpInOT1 - fpcHelpOutOT1);
      const fpcOt1H = isWorking ? Math.round(fpcNetOt1 * 3) : 0;
      const fpcNetOt2 = Math.max(0, fpcOt1 + fpcHelpInOT2 - fpcHelpOutOT2);
      const fpcOt2H = !isWorking ? Math.round(fpcNetOt2 * 11) : 0;
      const fpcTotalMH = isWorking ? (fpcNormH + fpcOt1H) : fpcOt2H;

      metrics.fpc_leave = fpcLeave;
      metrics.fpc_leave_working_day_rate = isWorking && fpcReg > 0 ? (fpcLeave / fpcReg) * 100 : 0;
      metrics.fpc_ot_psn = fpcOt1;
      metrics.fpc_ot_working_day_rate = isWorking && fpcReg > 0 ? (fpcOt1 / fpcReg) * 100 : 0;
      metrics.fpc_ot_holiday_day_rate = !isWorking && fpcReg > 0 ? (fpcOt1 / fpcReg) * 100 : 0;
      metrics.fpc_total_man_hour = fpcTotalMH;
      metrics.fpc_normal_man_hour = fpcNormH;
      metrics.fpc_ot_man_hour = isWorking ? fpcOt1H : fpcOt2H;
      metrics.fpc_help_in_normal = fpcHelpInNorm;
      metrics.fpc_help_out_normal = fpcHelpOutNorm;
      metrics.fpc_help_in_ot1 = fpcHelpInOT1;
      metrics.fpc_help_out_ot1 = fpcHelpOutOT1;
      metrics.fpc_help_in_ot2 = fpcHelpInOT2;
      metrics.fpc_help_out_ot2 = fpcHelpOutOT2;

      // Macro PCN (Whole Factory Total)
      metrics.macro_pcn_total_register = Number(metrics.total_register) || 0;
      metrics.macro_pcn_total_actual = Number(metrics.total_actual) || 0;
      metrics.macro_pcn_leave = isWorking ? Math.max(0, metrics.macro_pcn_total_register - metrics.macro_pcn_total_actual) : 0;
      metrics.macro_pcn_ot_psn = Number(metrics.ot_psn) || Number(metrics.ot1_actual) || 0;

      metrics.macro_pcn_help_in_normal = Number(metrics.help_in_normal) || 0;
      metrics.macro_pcn_help_out_normal = Number(metrics.help_out_normal) || 0;
      metrics.macro_pcn_help_in_psn = Number(metrics.help_in_psn) || 0;
      metrics.macro_pcn_help_out_psn = Number(metrics.help_out_psn) || 0;
      metrics.macro_pcn_help_in_ot1 = Number(metrics.help_in_ot1) || 0;
      metrics.macro_pcn_help_out_ot1 = Number(metrics.help_out_ot1) || 0;
      metrics.macro_pcn_help_in_ot2 = Number(metrics.help_in_ot2) || 0;
      metrics.macro_pcn_help_out_ot2 = Number(metrics.help_out_ot2) || 0;

      const pcnAct = metrics.macro_pcn_total_actual;
      const pcnReg = metrics.macro_pcn_total_register;
      const pcnNormH = isWorking ? Math.max(0, Math.round((pcnAct + metrics.macro_pcn_help_in_normal - metrics.macro_pcn_help_out_normal) * 8)) : 0;
      const pcnNetOt1 = Math.max(0, metrics.macro_pcn_ot_psn + metrics.macro_pcn_help_in_ot1 - metrics.macro_pcn_help_out_ot1);
      const pcnOt1H = isWorking ? Math.round(pcnNetOt1 * 3) : 0;
      const pcnNetOt2 = Math.max(0, metrics.macro_pcn_ot_psn + metrics.macro_pcn_help_in_ot2 - metrics.macro_pcn_help_out_ot2);
      const pcnOt2H = !isWorking ? Math.round(pcnNetOt2 * 11) : 0;
      const pcnTotalMH = isWorking ? (pcnNormH + pcnOt1H) : pcnOt2H;

      metrics.macro_pcn_total_man_hour = pcnTotalMH;
      metrics.macro_pcn_normal_man_hour = pcnNormH;
      metrics.macro_pcn_ot_man_hour = isWorking ? pcnOt1H : pcnOt2H;
      metrics.macro_pcn_leave_working_day_rate = isWorking && pcnReg > 0 ? (metrics.macro_pcn_leave / pcnReg) * 100 : 0;
      metrics.macro_pcn_ot_working_day_rate = isWorking && pcnReg > 0 ? (metrics.macro_pcn_ot_psn / pcnReg) * 100 : 0;
      metrics.macro_pcn_ot_holiday_day_rate = !isWorking && pcnReg > 0 ? (metrics.macro_pcn_ot_psn / pcnReg) * 100 : 0;
    });

    if (granularity === "daily") return result;

    // Period weighted aggregation for non-daily modes (Weekly, Monthly, Quarterly, Yearly)
    const periodResult: Record<string, any> = {};
    const rateWeights: Record<string, Record<string, { numerator: number; denominator: number }>> = {};

    const getPeriodKey = (dStr: string) => {
      const date = dayjs(dStr);
      if (granularity === "yearly") return date.format("YYYY");
      if (granularity === "quarterly") return getFiscalQuarter(date);
      if (granularity === "monthly") return date.format("YYYY-MM");
      return getProductionWeekKey(date);
    };

    const getRegisterKey = (rateKey: string) => {
      const suffixes = ["_leave_working_day_rate", "_ot_working_day_rate", "_ot_holiday_day_rate"];
      const suffix = suffixes.find(item => rateKey.endsWith(item));
      if (!suffix) return "total_register";
      const prefix = rateKey.slice(0, -suffix.length);
      return prefix ? `${prefix}_total_register` : "total_register";
    };

    Object.entries(result).forEach(([dailyDate, dailyMetrics]) => {
      const periodKey = getPeriodKey(dailyDate);
      if (!periodResult[periodKey]) {
        periodResult[periodKey] = { __daysCount: 0, __workingDaysCount: 0 };
      }
      if (!rateWeights[periodKey]) rateWeights[periodKey] = {};

      periodResult[periodKey].__daysCount += 1;
      if (dailyMetrics.is_working_day === 1) {
        periodResult[periodKey].__workingDaysCount += 1;
      }

      Object.entries(dailyMetrics).forEach(([key, rawValue]) => {
        const value = Number(rawValue) || 0;
        const isRate = key.endsWith("_working_day_rate") || key.endsWith("_holiday_day_rate");

        if (isRate) {
          if (granularity === "weekly" && value > 0) {
            const sumKey = `__${key}_sumGtZero`;
            const countKey = `__${key}_countGtZero`;
            periodResult[periodKey][sumKey] = (periodResult[periodKey][sumKey] || 0) + value;
            periodResult[periodKey][countKey] = (periodResult[periodKey][countKey] || 0) + 1;
          }
          const registerKey = getRegisterKey(key);
          const isWorkingDay = dailyMetrics.is_working_day === 1;
          const appliesToDay = key.endsWith("_holiday_day_rate") ? !isWorkingDay : isWorkingDay;
          const denominator = appliesToDay ? (Number(dailyMetrics[registerKey]) || 0) : 0;
          const weight = rateWeights[periodKey][key] || { numerator: 0, denominator: 0 };
          weight.numerator += (value / 100) * denominator;
          weight.denominator += denominator;
          rateWeights[periodKey][key] = weight;
          return;
        }

        if (key === "is_working_day") return;
        periodResult[periodKey][key] = (periodResult[periodKey][key] || 0) + value;
        if (value > 0) {
          const countKey = `__${key}_countGtZero`;
          periodResult[periodKey][countKey] = (periodResult[periodKey][countKey] || 0) + 1;
        }
      });
    });

    Object.entries(periodResult).forEach(([periodKey, metrics]) => {
      Object.entries(rateWeights[periodKey] || {}).forEach(([rateKey, weight]) => {
        if (granularity === "weekly" && metrics[`__${rateKey}_countGtZero`]) {
          const count = metrics[`__${rateKey}_countGtZero`];
          const sum = metrics[`__${rateKey}_sumGtZero`] || 0;
          metrics[rateKey] = count > 0 ? sum / count : 0;
        } else {
          metrics[rateKey] = weight.denominator > 0 ? (weight.numerator / weight.denominator) * 100 : 0;
        }
        metrics[`__${rateKey}_numerator`] = weight.numerator;
        metrics[`__${rateKey}_denominator`] = weight.denominator;
      });

      metrics.is_working_day = -1;

      const days = metrics.__daysCount || 1;
      Object.keys(metrics).forEach(key => {
        if (
          key.endsWith("register") ||
          key.endsWith("actual") ||
          key.endsWith("_leave") || key === "leave" ||
          key.endsWith("_ot_psn") || key === "ot_psn"
        ) {
          const count = metrics[`__${key}_countGtZero`] || days;
          metrics[key] = Math.round(metrics[key] / count);
        }
      });
    });

    return periodResult;
  }, [attendanceData, granularity, calendarData]);

  // 3. Aggregate matrix output data
  const matrixData = useMemo(() => {
    const grouped = new Map<string, Map<string, number>>();
    const macroMap = new Map<string, number>();
    const macroFpcMap = new Map<string, number>();
    const macroSmtMap = new Map<string, number>();
    const directFpcMap = new Map<string, number>();

    const macroFpcLines = [
      "LINE NPM", "NPM_FPC", "NPM", "LINE A", "LINE B_GEN", "LINE B_NON", "LINE B_JDT", "LINE C", "LINE D"
    ];
    const macroSmtLines = [
      "ASY1_A", "ASY1_AUTO", "LINE ASY1_A", "ASSY 1 (AUTOMOTIVE)",
      "ASY1_G", "ASY1_GEN", "LINE ASY1_G", "ASSY 1 (GENERAL)", "ASSY1_GEN", "ASY1 GEN", "ASSY1 GEN",
      "ASY2", "ASSY2", "LINE ASY2",
      "ASY3", "ASSY3", "LINE ASY3"
    ];

    rows.forEach((row) => {
      const lineGroup = normalizeMatrixLineGroupName(row.lineGroup);
      let dateKey = row.date;
      const isPrecomputed = row.date.includes("-W") || row.date.includes("-Q") || (row.date.length === 7 && row.date.includes("-")) || row.date.length === 4;
      if (!isPrecomputed) {
        const rowDate = dayjs(row.date);
        if (granularity === "yearly") dateKey = rowDate.format("YYYY");
        else if (granularity === "quarterly") dateKey = getFiscalQuarter(rowDate);
        else if (granularity === "monthly") dateKey = rowDate.format("YYYY-MM");
        else if (granularity === "weekly") dateKey = getProductionWeekKey(rowDate);
        else dateKey = rowDate.format("YYYY-MM-DD");
      }

      let val = 0;
      if (selectedUnit === "lot") val = row.lotQty;
      else if (selectedUnit === "sht") val = row.shtQty;
      else if (selectedUnit === "piece") val = row.pieceQty;

      const normUpper = lineGroup.trim().toUpperCase();
      if ((normUpper === "REW" || normUpper === "LINE REW") && val === 0) {
        val = Number((row as any).piece_plan ?? row.planQty ?? 0);
      }

      if (!grouped.has(lineGroup)) {
        grouped.set(lineGroup, new Map<string, number>());
      }
      const dateMap = grouped.get(lineGroup)!;
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + val);

      const rawUpper = (row.lineGroup || "").trim().toUpperCase();

      if (macroFpcLines.includes(rawUpper) || macroFpcLines.includes(normUpper) || macroSmtLines.includes(rawUpper) || macroSmtLines.includes(normUpper)) {
        macroMap.set(dateKey, (macroMap.get(dateKey) || 0) + val);
      }
      if (macroFpcLines.includes(rawUpper) || macroFpcLines.includes(normUpper)) {
        macroFpcMap.set(dateKey, (macroFpcMap.get(dateKey) || 0) + val);
        directFpcMap.set(dateKey, (directFpcMap.get(dateKey) || 0) + val);
      }
      if (macroSmtLines.includes(rawUpper) || macroSmtLines.includes(normUpper)) {
        macroSmtMap.set(dateKey, (macroSmtMap.get(dateKey) || 0) + val);
      }
    });

    // Helper to get line output map with robust alias resolution
    const getLineMap = (name: string): Map<string, number> => {
      const norm = normalizeMatrixLineGroupName(name);
      if (grouped.has(name) && grouped.get(name)!.size > 0) return grouped.get(name)!;
      if (grouped.has(norm) && grouped.get(norm)!.size > 0) return grouped.get(norm)!;

      const upper = name.trim().toUpperCase();
      const normUpper = norm.toUpperCase();
      const noLine = upper.replace(/^LINE\s+/i, '');
      const withLine = upper.startsWith('LINE ') ? upper : `LINE ${upper}`;

      for (const [k, v] of grouped.entries()) {
        const kUpper = k.toUpperCase().trim();
        const kNormUpper = normalizeMatrixLineGroupName(k).toUpperCase();
        const kNoLine = kUpper.replace(/^LINE\s+/i, '');
        if (
          kUpper === upper || 
          kNormUpper === normUpper ||
          kUpper === noLine ||
          kUpper === withLine ||
          kNoLine === noLine
        ) {
          return v;
        }
      }

      if (upper.includes("AVI") || normUpper.includes("AVI")) {
        for (const [k, v] of grouped.entries()) {
          const kUpper = k.toUpperCase().trim();
          const kNormUpper = normalizeMatrixLineGroupName(k).toUpperCase();
          if (kUpper.includes("AVI") || kNormUpper.includes("AVI")) {
            if (v && v.size > 0) return v;
          }
        }
      }

      return new Map<string, number>();
    };

    // Helper to merge multiple line maps into a single map
    const sumLineMaps = (lineNames: string[]): Map<string, number> => {
      const combined = new Map<string, number>();
      lineNames.forEach(name => {
        const map = getLineMap(name);
        map.forEach((v, d) => combined.set(d, (combined.get(d) || 0) + v));
      });
      return combined;
    };

    // Build standard composite line maps
    const smtFrontDirectMap = sumLineMaps([
      "MOTA_A", "MOTA_G", "MOTB", "MOTB_G", "AIX-MOT", "MOTC", "MOTD",
      "LINE MOTA_A", "LINE MOTA_G", "LINE MOTB", "LINE MOTC", "LINE MOTD"
    ]);

    const smtBackDirectMap = sumLineMaps([
      "ASY1_A", "ASY1_G", "ASY2", "ASY3", "AIX-ASY", "ASY5", "ASY6", "ASY7",
      "LINE ASY1_A", "LINE ASY1_G", "LINE ASY2", "LINE ASY3", "LINE ASY5", "LINE ASY6", "LINE ASY7"
    ]);

    const effectiveMacroSmtMap = new Map<string, number>();
    if (macroSmtMap.size > 0) {
      macroSmtMap.forEach((v, d) => effectiveMacroSmtMap.set(d, v));
    } else if (smtBackDirectMap.size > 0) {
      smtBackDirectMap.forEach((v, d) => effectiveMacroSmtMap.set(d, v));
    } else {
      const asySmt = getLineMap("ASY SMT");
      if (asySmt.size > 0) {
        asySmt.forEach((v, d) => effectiveMacroSmtMap.set(d, v));
      } else {
        const direct = getLineMap("Macro SMT");
        direct.forEach((v, d) => effectiveMacroSmtMap.set(d, v));
      }
    }

    const grandMacroPcnMap = new Map(directFpcMap);
    effectiveMacroSmtMap.forEach((val, date) => {
      grandMacroPcnMap.set(date, (grandMacroPcnMap.get(date) || 0) + val);
    });

    const getGroupedOrFallback = (name: string, fallbackMap: Map<string, number>) => {
      const map = getLineMap(name);
      if (map && map.size > 0) {
        const total = Array.from(map.values()).reduce((sum, v) => sum + v, 0);
        if (total > 0) return map;
      }
      return fallbackMap;
    };

    // Standard ordered base lines
    const baseMatrixList: [string, Map<string, number>][] = [
      // FPC Macro & Lines
      ["Macro PCN", getGroupedOrFallback("Macro PCN", grandMacroPcnMap.size > 0 ? grandMacroPcnMap : macroMap)],
      ["Macro FPC", getGroupedOrFallback("Macro FPC", macroFpcMap.size > 0 ? macroFpcMap : directFpcMap)],
      ["Direct FPC", getGroupedOrFallback("Direct FPC", directFpcMap)],
      ["LINE A", getLineMap("LINE A")],
      ["AT_Front", getLineMap("AT_Front")],
      ["AT_VAC", getLineMap("AT_VAC")],
      ["AT_LAM", getLineMap("AT_LAM")],
      ["LINE A_FINAL", getGroupedOrFallback("LINE A_FINAL", getLineMap("LINE A"))],
      ["LINE B", getGroupedOrFallback("LINE B", sumLineMaps(["LINE B_GEN", "LINE B_NON"]))],
      ["LINE B_GEN", getLineMap("LINE B_GEN")],
      ["LINE B_NON", getLineMap("LINE B_NON")],
      ["LINE C", getLineMap("LINE C")],
      ["LINE D", getLineMap("LINE D")],
      ["LINE MAT", getLineMap("LINE MAT")],
      ["LINE LAM", getLineMap("LINE LAM")],
      ["LINE VAC & HPS", getGroupedOrFallback("LINE VAC & HPS", getLineMap("LINE VAC"))],
      ["LINE VAC", getLineMap("LINE VAC")],
      ["LINE HPS", getLineMap("LINE HPS")],
      ["LINE BLK", getLineMap("LINE BLK")],
      ["LINE OST", getLineMap("LINE OST")],
      ["AVI/K2", getLineMap("AVI/K2")],
      ["MDS", getLineMap("MDS")],

      // SMT Macro & Lines
      ["Macro SMT", effectiveMacroSmtMap],
      ["Macro SMT_F", smtFrontDirectMap],
      ["Macro SMT_B", effectiveMacroSmtMap],
      ["Direct SMT", effectiveMacroSmtMap],
      ["SMT Front_Direct", smtFrontDirectMap],
      ["SMT BACK_DIRECT", effectiveMacroSmtMap],
      ["Automotive", getGroupedOrFallback("Automotive", getLineMap("ASY1_A"))],
      ["MOTA_A", getLineMap("MOTA_A")],
      ["MOTA_G", getLineMap("MOTA_G")],
      ["MOTB", getLineMap("MOTB")],
      ["AIX-MOT", getLineMap("AIX-MOT")],
      ["MOTD", getLineMap("MOTD")],
      ["ASTP_A", getLineMap("ASTP_A")],
      ["ASTP_G", getLineMap("ASTP_G")],
      ["MAS", getLineMap("MAS")],
      ["REW", getLineMap("REW")],
      ["XRAY", getLineMap("XRAY")],
      ["MAS & REW", getGroupedOrFallback("MAS & REW", sumLineMaps(["MAS", "REW"]))],
      ["AIX-BLK", getLineMap("AIX-BLK")],
      ["BLK-2", getLineMap("BLK-2")],
      ["ASY1_A", getLineMap("ASY1_A")],
      ["ASY1_G", getLineMap("ASY1_G")],
      ["ASY2", getLineMap("ASY2")],
      ["ASY3", getLineMap("ASY3")],
      ["AIX-ASY", getLineMap("AIX-ASY")],
      ["AELT", getLineMap("AELT")],
      ["SMT_LAM", getLineMap("SMT_LAM")],
      ["MD LAM", getLineMap("MD LAM")],
      ["ASY SMT", getGroupedOrFallback("ASY SMT", sumLineMaps(["ASY1_A", "LINE ASY1_A", "ASY1_G", "LINE ASY1_G", "ASY2", "LINE ASY2", "ASY3", "LINE ASY3", "AIX-ASY", "AIX_ASY", "LINE AIX-ASY", "ASY4", "ASSY4"]))],

      // QA Lines (Standard Set 1)
      ["QA FPC", getGroupedOrFallback("QA FPC", sumLineMaps(["OQI_F-AUTO", "OQI_F-GEN"]))],
      ["OQI_F-AUTO", getLineMap("OQI_F-AUTO")],
      ["OQI_F-GEN", getLineMap("OQI_F-GEN")],
      ["OQI_M", getLineMap("OQI_M")],
      ["QA SMT", getGroupedOrFallback("QA SMT", sumLineMaps(["OQI_S-AUTO", "OQI_S-GEN"]))],
      ["OQI_S-AUTO", getLineMap("OQI_S-AUTO")],
      ["OQI_S-GEN", getLineMap("OQI_S-GEN")],
    ];

    // Set of known standard names for deduplication
    const knownStandardNames = new Set<string>();
    baseMatrixList.forEach(([name]) => {
      knownStandardNames.add(name.trim().toUpperCase());
      knownStandardNames.add(normalizeMatrixLineGroupName(name).trim().toUpperCase());
      knownStandardNames.add(name.replace(/^LINE\s+/i, "").trim().toUpperCase());
    });

    // Custom Macro Lines
    const effectiveMacros = customMacros && customMacros.length > 0 ? customMacros : getCachedCustomMacroLines();
    const customMacroNames = new Set<string>();
    const customMacroNormalized = new Set<string>();
    effectiveMacros.forEach(m => {
      customMacroNames.add(m.macro_name.trim().toUpperCase());
      customMacroNormalized.add(normalizeMatrixLineGroupName(m.macro_name).trim().toUpperCase());
    });

    const customMacroEntries: [string, Map<string, number>][] = effectiveMacros.map(macro => {
      const outLines = getCustomMacroOutputSources(macro);
      const customMap = new Map<string, number>();
      const processedMaps = new Set<Map<string, number>>();

      outLines.forEach(line => {
        const srcMap = getLineMap(line);
        if (srcMap && srcMap.size > 0 && !processedMaps.has(srcMap)) {
          processedMaps.add(srcMap);
          srcMap.forEach((val, date) => {
            customMap.set(date, (customMap.get(date) || 0) + val);
          });
        }
      });
      return [macro.macro_name, customMap] as [string, Map<string, number>];
    });

    // Filter base matrix against custom macros
    const filteredBaseMatrix = baseMatrixList.filter(([baseName]) => {
      const raw = baseName.trim().toUpperCase();
      const norm = normalizeMatrixLineGroupName(baseName).trim().toUpperCase();
      const noLine = baseName.replace(/^LINE\s+/i, "").trim().toUpperCase();
      return !customMacroNames.has(raw) && !customMacroNames.has(norm) && !customMacroNames.has(noLine) && !customMacroNormalized.has(norm);
    });

    // Discover any unmapped extra lines from grouped
    const otherGroups: [string, Map<string, number>][] = [];
    grouped.forEach((dateMap, name) => {
      const norm = normalizeMatrixLineGroupName(name).trim().toUpperCase();
      const raw = name.trim().toUpperCase();
      const noLine = name.replace(/^LINE\s+/i, "").trim().toUpperCase();
      if (
        !knownStandardNames.has(norm) &&
        !knownStandardNames.has(raw) &&
        !knownStandardNames.has(noLine) &&
        !customMacroNames.has(raw) &&
        !customMacroNames.has(norm) &&
        !customMacroNormalized.has(norm)
      ) {
        otherGroups.push([name, dateMap]);
      }
    });
    otherGroups.sort((a, b) => a[0].localeCompare(b[0]));

    return [...filteredBaseMatrix, ...customMacroEntries, ...otherGroups];
  }, [rows, selectedUnit, granularity, customMacros]);

  return useMemo(() => ({
    dateColumns,
    aggregatedAttendanceData,
    matrixData,
  }), [dateColumns, aggregatedAttendanceData, matrixData]);
};
