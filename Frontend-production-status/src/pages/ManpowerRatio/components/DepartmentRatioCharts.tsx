import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import { FileSpreadsheet, Calendar, Download } from "lucide-react";
import { updateSharedTargets, fetchCustomTargets, saveCustomTarget, deleteCustomTarget, CustomTargetRecord } from "../api/deptSummary";
import { CustomTargetModal } from "./CustomTargetModal";
import {
  ACC_COLOR,
  DEPARTMENTS,
  DEPARTMENT_COLORS,
  INDIRECT_COLOR,
  LEAVE_TARGET,
  OT_DAILY_COLOR,
  OT_DAILY_TARGET,
  OT_TARGET,
  SUM_COLOR,
  TARGET_COLOR,
} from "../config/ratioConfig";

type Kind = "leave" | "ot";

const pct = (value: unknown) => `${Number(value || 0).toFixed(1)}%`;

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// '2026-08-01' → '1-Aug'
function dayLabel(date?: string) {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return `${d.getDate()}-${d.toLocaleString("en-US", { month: "short" })}`;
}

// '2026-08' → "Aug'26"
function monthTitle(month?: string) {
  if (!month) return "";
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return "";
  const label = new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "short",
  });
  return `${label}'${String(y).slice(2)}`;
}

function isWeekend(date?: string) {
  if (!date) return false;
  const day = new Date(`${date}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

// Helper to create 3D Horizontal Cylindrical gradient (แบบที่ 2)
function makeGradient(baseColor: string) {
  return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
    { offset: 0, color: baseColor },
    { offset: 0.45, color: echarts.color.lift(baseColor, 0.18) || baseColor },
    { offset: 1, color: echarts.color.lift(baseColor, -0.2) || baseColor },
  ]);
}

// ==============================================
// 🛡️ Error Boundary สำหรับป้องกัน Chart Rendering Error
// ==============================================
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ChartErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Chart rendering error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="rounded-3xl bg-white p-5 shadow-sm border border-red-200">
          <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500">
            <span className="text-sm font-bold text-red-600 mb-1">
              {this.props.fallbackTitle || "Chart Unavailable"}
            </span>
            <span className="text-xs text-slate-400">
              {this.state.error?.message || "An unexpected error occurred while rendering this chart."}
            </span>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}

// ==============================================
// 📊 คอมโพเนนต์ RatioChart สร้างด้วย Apache ECharts (กำหนดความกว้างคงที่รายวัน)
// ==============================================
const RatioChart = memo(function RatioChart({
  title,
  rows = [],
  kind,
  leaveTarget,
  otTarget,
  otDailyTarget,
  includeIndirect,
  spreadsheetData = null,
  groupKey = null,
  isOverview = false,
  showTarget = true,
  showAcc,
  widthMode = "expand",
  periodLabel = "",
  monthStr = "",
  customTargets = [],
  yearData,
  selectedYear,
  isYearly = false,
  onOpenTargetModal,
  onLeaveTargetChange,
  onOtTargetChange,
  onOtDailyTargetChange,
}: {
  title: string;
  rows: any[];
  kind: Kind;
  leaveTarget: number;
  otTarget: number;
  otDailyTarget: number;
  includeIndirect: boolean;
  spreadsheetData?: any;
  groupKey?: string | null;
  isOverview?: boolean;
  showTarget?: boolean;
  showAcc?: boolean;
  widthMode?: "fit" | "expand";
  periodLabel?: string;
  monthStr?: string;
  customTargets?: CustomTargetRecord[];
  yearData?: Record<string, any>;
  selectedYear?: number;
  isYearly?: boolean;
  onOpenTargetModal?: () => void;
  onLeaveTargetChange?: (val: number) => void;
  onOtTargetChange?: (val: number) => void;
  onOtDailyTargetChange?: (val: number) => void;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const withAcc = showAcc ?? (kind === "ot" && !groupKey);

  const fallbackDaily = Number(otDailyTarget) || 0;
  const fallbackAcc = Number(otTarget) || 0;
  const fallbackLeave = Number(leaveTarget) || 0;

  // Helper สำหรับดึงค่า Target ของแต่ละแถว (รองรับรายวัน, แยกตามเดือนในโหมดรายปี, และ Fallback)
  const getTargetForRow = (
    r: any,
    targetType: "ot_daily" | "ot_acc" | "leave",
    customList: CustomTargetRecord[],
    fallbackVal: number
  ) => {
    if (!r) return fallbackVal;
    const dStr = r?.date;
    // 1. ถ้ามี custom target ตามช่วงวันเฉพาะเจาะจงที่ตรงกับ dStr (ตรวจสอบ pattern วันที่ YYYY-MM-DD)
    if (dStr && /^\d{4}-\d{2}-\d{2}$/.test(dStr) && customList && customList.length > 0) {
      const match = customList.find(
        (ct) => ct.date_from && ct.date_to && dStr >= ct.date_from && dStr <= ct.date_to
      );
      if (match && !isNaN(Number(match.target_value))) return Number(match.target_value);
    }

    // 2. ระบุเดือนของแถวนี้ (mStr เช่น "2026-08", "2026-09")
    let mStr: string | null = null;
    if (r?.month && /^\d{4}-\d{2}$/.test(r.month)) {
      mStr = r.month;
    } else if (dStr && /^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
      mStr = dStr.slice(0, 7);
    } else if (dStr && MONTH_NAMES.includes(dStr)) {
      const mIdx = MONTH_NAMES.indexOf(dStr) + 1;
      const yr = selectedYear || new Date().getFullYear();
      mStr = `${yr}-${String(mIdx).padStart(2, "0")}`;
    }

    if (mStr) {
      // 2.1 ตรวจสอบว่ามี custom target ของเดือนนั้นใน customTargets หรือไม่
      if (customList && customList.length > 0) {
        const monthMatch = customList.find(
          (ct) => ct.month === mStr && (!ct.date_from || !ct.date_to)
        );
        if (monthMatch && !isNaN(Number(monthMatch.target_value))) {
          return Number(monthMatch.target_value);
        }
      }

      // 2.2 ตรวจสอบ localStorage ของเดือนนั้น (เช่น manpower-ratio:target-ot-daily:day:2026-09)
      const storageKey = targetType === "ot_daily" ? "ot-daily" : targetType === "ot_acc" ? "ot" : "leave";
      const savedMonthVal = localStorage.getItem(`manpower-ratio:target-${storageKey}:day:${mStr}`);
      if (savedMonthVal !== null && !isNaN(Number(savedMonthVal))) {
        return Number(savedMonthVal);
      }

      // 2.3 ตรวจสอบ yearData ของเดือนนั้น
      const propKey = targetType === "ot_daily" ? "otDaily" : targetType === "ot_acc" ? "ot" : "leave";
      const monthTargets = yearData?.[mStr]?.targets?.day || yearData?.[mStr]?.targets;
      if (monthTargets && typeof monthTargets[propKey] === "number") {
        return Number(monthTargets[propKey]);
      }
    }

    return fallbackVal;
  };

  // ประมวลผลแถวข้อมูล
  const parsedData = useMemo(() => {
    const categories: string[] = [];
    const weekendList: boolean[] = [];
    const deptSeriesData: Record<string, (number | null)[]> = Object.fromEntries(
      DEPARTMENTS.map((d) => [d, []]),
    );
    const indirectSeriesData: (number | null)[] = [];
    const sumSeriesData: (number | null)[] = [];
    const accSeriesData: (number | null)[] = [];

    (rows || []).forEach((row, idx) => {
      const label = dayLabel(row.date);
      categories.push(label);
      const isHol = row.isHoliday !== undefined ? Boolean(row.isHoliday) : isWeekend(row.date);
      weekendList.push(isHol);

      const g = groupKey ? row.supportGroups?.[groupKey] : null;
      const deptValue = (dept: string) => {
        if (g) {
          return (
            Number(
              kind === "ot"
                ? (g.byDept?.[dept]?.otShare ?? g.byDept?.[dept]?.otPct)
                : (g.byDept?.[dept]?.realRate ?? g.byDept?.[dept]?.leavePct ?? g.byDept?.[dept]?.leaveShare),
            ) || 0
          );
        }
        return kind === "ot"
          ? Number(row.depts?.[dept]?.otShare ?? row.otByDept?.[dept] ?? 0)
          : Number(row.depts?.[dept]?.leavePct ?? row.depts?.[dept]?.realRate ?? row.leaveByDept?.[dept] ?? 0);
      };

      const indirectVal = g
        ? Number(
          kind === "ot"
            ? (g.byDept?.Indirect?.otShare ?? g.byDept?.Indirect?.otPct)
            : (g.byDept?.Indirect?.realRate ?? g.byDept?.Indirect?.leavePct ?? g.byDept?.Indirect?.leaveShare),
        ) || 0
        : kind === "ot"
          ? Number(row.indirect?.otShare ?? row.indirectOt ?? 0)
          : Number(row.indirect?.leavePct ?? row.indirect?.realRate ?? row.indirectLeave ?? 0);

      let sumValue = 0;
      if (isOverview) {
        // 🌟 เฉพาะ 2 กราฟ Overview (All P1): ตรงตามตาราง MANPOWER DASHBOARD 100%
        sumValue = kind === "ot"
          ? Number(row.overviewOtPct ?? row.sumOtPct ?? row.total?.otShare ?? row.total?.otPct ?? 0)
          : Number(row.overviewLeavePct ?? row.total?.leaveShare ?? row.total?.leavePct ?? row.sumLeavePct ?? 0);
      } else if (includeIndirect && !groupKey) {
        // กราฟ Include Indirect (ตามแผนก): ใช้ข้อมูล Sheet 8 ตามเดิม
        sumValue = kind === "ot"
          ? Number(row.sumOtPct ?? row.total?.otShare ?? 0)
          : Number(row.sumLeavePct ?? row.total?.leaveShare ?? 0);
      } else if (!groupKey) {
        // กรณี Direct 5 แผนก: ใช้ยอดรวมจาก MANPOWER RATIO DAILY 100%
        sumValue = kind === "ot"
          ? Number(row.sumOtPct ?? 0)
          : Number(row.sumLeavePct ?? 0);
      } else {
        // กรณีกลุ่มย่อย (MOU, MPS, DC, PER)
        sumValue = Number(
          (kind === "ot" ? Number(g?.sumOtPct ?? 0) : Number(g?.sumLeavePct ?? 0)).toFixed(1)
        );
      }

      const hasDayData = groupKey
        ? ((Number(g?.total?.people) || 0) > 0 || (Number(g?.sumLeavePct) || 0) > 0 || (Number(g?.sumOtPct) || 0) > 0)
        : (Number(row.total?.people) || 0) > 0 ||
        (Number(row.people) || 0) > 0 ||
        sumValue > 0;

      const accRaw =
        kind === "ot"
          ? row.otAcc != null
            ? Number(row.otAcc)
            : null
          : row.leaveAcc != null
            ? Number(row.leaveAcc)
            : null;

      const peopleCount = Number(row.total?.people ?? row.people ?? 0);
      const absentCount = Number(row.total?.absent ?? row.absent ?? 0);
      const otCount = Number(row.total?.otPeople ?? row.otPeople ?? 0);

      // สำหรับแท่งกราฟ (dept / indirect): ใส่ null ถ้าไม่มีข้อมูลหรือ 0% เพื่อไม่ให้เกิดแท่งสแตก
      let dayHasBar = false;
      DEPARTMENTS.forEach((dept) => {
        const val = Number(deptValue(dept).toFixed(1));
        let showVal: any = null;
        if (hasDayData && val >= 0.05) {
          // เฉพาะ OT Ratio ให้มี visual minimum (1.0%) เพื่อให้สแตกแผนกเล็กๆ (เช่น 0.1%, 0.2%) มองเห็นเป็นชั้นสีชัดเจนบนกราฟ
          if (kind === "ot" && val < 1.0) {
            showVal = { value: 1.0, rawValue: val };
          } else {
            showVal = val;
          }
        }
        deptSeriesData[dept].push(showVal);
        if (showVal !== null) dayHasBar = true;
      });

      const indVal = Number(indirectVal.toFixed(1));
      let showIndVal: any = null;
      if (hasDayData && indVal >= 0.05) {
        if (kind === "ot" && indVal < 1.0) {
          showIndVal = { value: 1.0, rawValue: indVal };
        } else {
          showIndVal = indVal;
        }
      }
      indirectSeriesData.push(showIndVal);
      if (showIndVal !== null && includeIndirect) dayHasBar = true;

      const isWeekendDay = isWeekend(row.date);
      // ในวันหยุด ถ้าไม่มีคนมาทำงานปกติ ยอด Leave ต้องเป็น 0 เสมอ (เฉพาะโหมด Leave เท่านั้น ไม่กระทบ OT)
      if (kind === "leave" && !groupKey && isWeekendDay && Number(row.total?.attend ?? row.total?.present ?? 0) < 100) {
        sumValue = 0;
      }

      // ถ้าวันนั้นมีแท่งกราฟจริงแต่ sumValue ยังเป็น 0 หรือต่ำกว่าแท่ง ให้ใช้ผลรวมจากแท่งที่แสดง
      if (dayHasBar && sumValue <= 0.05) {
        let barSum = 0;
        DEPARTMENTS.forEach((dept) => {
          const raw = deptSeriesData[dept][deptSeriesData[dept].length - 1];
          const val = typeof raw === "object" ? raw?.rawValue : raw;
          if (val !== null && val > 0) barSum += Number(val);
        });
        if (includeIndirect) {
          const lastRaw = indirectSeriesData[indirectSeriesData.length - 1];
          const lastInd = typeof lastRaw === "object" ? lastRaw?.rawValue : lastRaw;
          if (lastInd !== null && lastInd > 0) barSum += Number(lastInd);
        }
        if (barSum > 0.05) {
          sumValue = Number(barSum.toFixed(1));
        }
      }

      // ใน overview ถ้า sumValue > 0.05 ถือว่ามีแท่งกราฟ
      if (isOverview && sumValue > 0.05) {
        dayHasBar = true;
      }

      // ✅ สำหรับเส้นรวม (SUM Line): ให้ขึ้นมาทุกวัน
      const dailySum = Number(sumValue.toFixed(1));
      sumSeriesData.push(isNaN(dailySum) ? 0 : dailySum);

    });

    // ✅ คำนวณเส้นสะสม Acc.
    let lastBarIdx = -1;
    (rows || []).forEach((row, i) => {
      const sumVal = sumSeriesData[i];
      let hasBar = false;
      if (isOverview) {
        hasBar = sumVal !== null && sumVal > 0.05;
      } else {
        hasBar =
          DEPARTMENTS.some((dept) => {
            const raw = deptSeriesData[dept]?.[i];
            const v = typeof raw === "object" ? raw?.value : raw;
            return (Number(v) || 0) > 0;
          }) ||
          (includeIndirect && ((typeof indirectSeriesData[i] === "object" ? indirectSeriesData[i]?.value : indirectSeriesData[i]) ?? 0) > 0) ||
          (sumVal !== null && sumVal > 0.05);
      }
      if (hasBar) lastBarIdx = i;
    });

    let runningAccSum = 0;
    let validDaysCount = 0;
    let lastValidAcc: number | null = null;

    (rows || []).forEach((row, i) => {
      // ถ้า Backend ส่งค่าสะสมถ่วงน้ำหนักจริง (row.otAcc / row.leaveAcc) มา ให้ใช้ค่านั้นเป็นหลัก
      const rowAcc = kind === "ot" ? row?.otAcc : row?.leaveAcc;
      if (rowAcc !== undefined && rowAcc !== null && !groupKey) {
        accSeriesData[i] = Number(Number(rowAcc).toFixed(1));
        lastValidAcc = accSeriesData[i];
        return;
      }

      if (lastBarIdx === -1 || i > lastBarIdx) {
        // ถ้าเลยวันสุดท้ายที่มีแท่งกราฟไปแล้ว (เช่น วันในอนาคต) -> อย่าพึ่งขึ้น (null)
        accSeriesData[i] = null;
        return;
      }

      const val = sumSeriesData[i];
      const d = row?.date ? new Date(`${row.date}T00:00:00`) : null;
      const isSunday = d ? d.getDay() === 0 : false;

      // วันอาทิตย์ (หลังสัปดาห์แรก) ที่ไม่มีงานปกติ -> ดึงค่าวันเสาร์มาแสดงต่อเนื่อง (Carry over)
      if (isSunday && i > 1 && lastValidAcc !== null) {
        accSeriesData[i] = lastValidAcc;
        return;
      }

      runningAccSum += (val || 0);
      validDaysCount++;
      lastValidAcc = Number((runningAccSum / validDaysCount).toFixed(1));
      accSeriesData[i] = lastValidAcc;
    });

    const hasData =
      categories.length > 0 &&
      sumSeriesData.some((v) => v !== null && v > 0);

    return {
      categories,
      weekendList,
      deptSeriesData,
      indirectSeriesData,
      sumSeriesData,
      accSeriesData,
      hasData,
    };
  }, [rows, kind, groupKey, includeIndirect, isOverview]);

  const target = kind === "leave" ? leaveTarget : otTarget;
  const dailyTarget = kind === "leave" ? leaveTarget : otDailyTarget;

  // สร้างและอัปเดตออบเจ็กต์ ECharts
  useEffect(() => {
    if (!chartRef.current) return;

    if (chartInstance.current) {
      try {
        const dom = chartInstance.current.getDom();
        if (!dom || !chartRef.current.contains(dom)) {
          chartInstance.current.dispose();
          chartInstance.current = null;
        }
      } catch {
        chartInstance.current = null;
      }
    }

    if (!chartInstance.current) {
      const existing = echarts.getInstanceByDom(chartRef.current);
      if (existing) {
        existing.dispose();
      }
      chartInstance.current = echarts.init(chartRef.current, null, {
        renderer: "canvas",
        devicePixelRatio: Math.max(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2),
      });
    }
    const chart = chartInstance.current;
    if (!chart) return;

    if (!parsedData.hasData) {
      chart.clear();
      return;
    }

    const series: any[] = [];

    const totalCount = parsedData.categories.length;
    const barMaxWidth =
      totalCount <= 12
        ? 34
        : totalCount <= 31
          ? 24
          : totalCount <= 60
            ? 14
            : 22;

    if (isOverview) {
      // 📊 โหมดภาพรวม (Overview): แท่งเดียวพร้อมตัวเลข
      const overviewBarColor = "#0284C7";
      const overviewBarData = parsedData.sumSeriesData.map((val, idx) => {
        if (val === null) return null;
        const accVal = parsedData.accSeriesData[idx];
        const row = (rows || [])[idx] || {};
        const count = kind === "leave"
          ? (row.total?.absent ?? row.absent)
          : (row.total?.otPeople ?? row.otPeople);

        // เมื่อใกล้กันมาก (< 4.5%): ยกตัวเลขแท่งขึ้น
        const isClose = accVal !== null && Math.abs(Number(val) - Number(accVal)) < 4.5;
        const isNearBottom = Number(val) < 3.0;

        return {
          value: val,
          label: {
            show: kind === "ot",
            position: "top",
            distance: isNearBottom && isClose ? 14 : isClose ? 8 : 4,
            formatter: () => (Number(val) > 0.05 ? `${val}%` : ""),
            fontSize: 9,
            fontWeight: "bold",
            color: SUM_COLOR,
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            padding: [1, 2],
            borderRadius: 3,
            align: "center",
          },
        };
      });

      series.push({
        name: kind === "ot" ? "Total OT P1" : "Total Leave P1",
        type: "bar",
        z: 3,
        barMinHeight: kind === "ot" ? 8 : 0,
        barCategoryGap: "20%",
        barMaxWidth,
        itemStyle: {
          color: makeGradient(overviewBarColor),
          borderRadius: [3, 3, 0, 0],
        },
        data: overviewBarData,
      });
    } else {
      // 1. แท่งกราฟฝ่าย Indirect อยู่ติดฐานกราฟล่างสุด
      if (includeIndirect) {
        series.push({
          name: "Indirect",
          type: "bar",
          stack: "total",
          z: 3,
          barMinHeight: kind === "ot" ? 8 : 0,
          barCategoryGap: "20%",
          barMaxWidth,
          itemStyle: {
            color: makeGradient(INDIRECT_COLOR),
            borderRadius: 0,
          },
          data: parsedData.indirectSeriesData,
        });
      }

      // 2. Department bars ซ้อนขึ้นไปตามลำดับ (MDS -> SMT_B -> SMT_F -> FPC -> QA บนสุด)
      const stackOrder = [...DEPARTMENTS].reverse();
      stackOrder.forEach((dept) => {
        const color = DEPARTMENT_COLORS[dept] || "#3b82f6";
        series.push({
          name: dept,
          type: "bar",
          stack: "total",
          z: 3,
          barMinHeight: kind === "ot" ? 8 : 0,
          barCategoryGap: "20%",
          barMaxWidth,
          itemStyle: {
            color: makeGradient(color),
            borderRadius: 0,
          },
          data: parsedData.deptSeriesData[dept],
        });
      });
    }

    // จัดทำข้อความแสดงปลายเส้น Target (เช่น Target OT [Aug: 75% | Sep: 80%] หรือ Target OT (75%))
    const formatTargetEndLabel = (
      prefix: string,
      targetSeries: number[],
      customList: CustomTargetRecord[] | any[],
      defaultVal: number
    ) => {
      if (!targetSeries || targetSeries.length === 0) {
        return `${prefix} (${defaultVal}%)`;
      }
      const firstVal = targetSeries[0];
      const allSame = targetSeries.every((v) => v === firstVal);
      if (allSame) {
        return `${prefix} (${firstVal}%)`;
      }

      const validCustomDateRanges = (customList || []).filter((c: any) => c && c.date_from && c.date_to);
      if (validCustomDateRanges.length > 0 && !isYearly) {
        const sorted = [...validCustomDateRanges].sort((a: any, b: any) => String(a.date_from).localeCompare(String(b.date_from)));
        const rangeParts = sorted.map((item: any) => {
          const fromParts = String(item.date_from).split("-");
          const toParts = String(item.date_to).split("-");
          const fromDay = parseInt(fromParts[2] || fromParts[0], 10);
          const toDay = parseInt(toParts[2] || toParts[0], 10);
          return `${fromDay}-${toDay}: ${Number(item.target_value)}%`;
        });
        return `${prefix}\n[${rangeParts.join(" | ")}]`;
      }

      // หากเป็นโหมดรายปี หรือมีเป้าหมายต่างกันตามเดือน
      const distinctParts: string[] = [];
      let currentMonthName = "";
      let currentTargetVal = -1;
      (rows || []).forEach((r, idx) => {
        if (!r) return;
        const val = targetSeries[idx];
        let mName = "";
        if (r?.month && /^\d{4}-\d{2}$/.test(r.month)) {
          const mIdx = parseInt(r.month.split("-")[1], 10) - 1;
          mName = MONTH_NAMES[mIdx] || r.month;
        } else if (r?.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
          const mIdx = parseInt(r.date.split("-")[1], 10) - 1;
          mName = MONTH_NAMES[mIdx] || "";
        } else if (r?.date && MONTH_NAMES.includes(r.date)) {
          mName = r.date;
        }
        if (mName && (mName !== currentMonthName || val !== currentTargetVal)) {
          currentMonthName = mName;
          currentTargetVal = val;
          distinctParts.push(`${mName}: ${val}%`);
        }
      });

      if (distinctParts.length > 0 && distinctParts.length <= 4) {
        return `${prefix}\n[${distinctParts.join(" | ")}]`;
      }
      if (distinctParts.length > 4) {
        const firstPart = distinctParts[0];
        const lastPart = distinctParts[distinctParts.length - 1];
        return `${prefix}\n[${firstPart} ... ${lastPart}]`;
      }

      return `${prefix} (Step Line)`;
    };

    // 3. SUM Series (Line/Labels) & Marklines
    if (kind === "ot") {
      const sumDataWithOffsets = parsedData.sumSeriesData.map((val, idx) => {
        if (val === null || val === undefined) return null;
        const accVal = parsedData.accSeriesData[idx];
        const isClose = accVal !== null && Math.abs(Number(val) - Number(accVal)) < 4.5;
        const isNearBottom = Number(val) < 3.0;

        return {
          value: val,
          label: {
            show: true,
            position: "top",
            distance: isNearBottom && isClose ? 18 : isClose ? 12 : 5,
            formatter: () => `${Number(val || 0).toFixed(1)}%`,
            fontSize: 9,
            fontWeight: "bold",
            color: SUM_COLOR,
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            padding: [1, 2],
            borderRadius: 3,
          },
        };
      });

      const accDataWithOffsets = parsedData.accSeriesData.map((val, idx) => {
        if (val === null) return null;
        const sumVal = parsedData.sumSeriesData[idx];
        const isClose = sumVal !== null && Math.abs(Number(sumVal) - Number(val)) < 4.5;
        const isNearBottom = Number(val) < 3.0;

        return {
          value: val,
          label: {
            show: true,
            position: isNearBottom ? "top" : isClose ? "bottom" : "top",
            distance: isNearBottom ? 3 : isClose ? 5 : 4,
            formatter: () => (Number(val) > 0.05 ? `${val}%` : ""),
            fontSize: 8,
            fontWeight: "bold",
            color: ACC_COLOR,
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            padding: [1, 2],
            borderRadius: 3,
          },
        };
      });

      // เส้นประแสดงเป้าหมาย (Target Lines - รองรับปรับระดับตามช่วงวันและแยกตามเดือนในโหมดรายปี Step Line)
      const customOtDailyList = (customTargets || []).filter((t) => {
        const typeMatch = t.target_type === "ot_daily" || t.target_type === "default_ot_daily";
        const keyMatch = t.chart_key === "all" || !t.chart_key;
        if (!isYearly && monthStr) {
          const monthMatch = !t.month || t.month === monthStr || (t.date_from && t.date_from.startsWith(monthStr));
          return typeMatch && keyMatch && monthMatch;
        }
        return typeMatch && keyMatch;
      });

      const customOtAccList = (customTargets || []).filter((t) => {
        const typeMatch = t.target_type === "ot_acc" || t.target_type === "default_ot";
        const keyMatch = t.chart_key === "all" || !t.chart_key;
        if (!isYearly && monthStr) {
          const monthMatch = !t.month || t.month === monthStr || (t.date_from && t.date_from.startsWith(monthStr));
          return typeMatch && keyMatch && monthMatch;
        }
        return typeMatch && keyMatch;
      });

      const dailyTargetSeriesData = (rows || []).map((r) =>
        getTargetForRow(r, "ot_daily", customOtDailyList, fallbackDaily)
      );

      const accTargetSeriesData = (rows || []).map((r) =>
        getTargetForRow(r, "ot_acc", customOtAccList, fallbackAcc)
      );

      const dailyEndLabelText = formatTargetEndLabel("Target OT", dailyTargetSeriesData, customOtDailyList, fallbackDaily);
      const accEndLabelText = formatTargetEndLabel("Target OT Acc.", accTargetSeriesData, customOtAccList, fallbackAcc);

      // ตรวจสอบว่าระดับเป้าหมายของวันสุดท้ายชนกันหรือไม่ (เช่น daily = 60% และ acc = 60%)
      const lastDailyVal = dailyTargetSeriesData[dailyTargetSeriesData.length - 1] ?? fallbackDaily;
      const lastAccVal = accTargetSeriesData[accTargetSeriesData.length - 1] ?? fallbackAcc;
      const isTargetLevelColliding = Math.abs(Number(lastDailyVal) - Number(lastAccVal)) < 4.0;

      // เพิ่ม Target OT Series (Step Line หรือ MarkLine)
      series.push({
        name: "Target OT",
        type: "line",
        step: "middle",
        z: 2,
        symbol: "none",
        silent: true,
        data: dailyTargetSeriesData,
        itemStyle: {
          color: OT_DAILY_COLOR,
        },
        lineStyle: {
          color: OT_DAILY_COLOR,
          width: 2,
          type: "dashed",
        },
        endLabel: {
          show: true,
          formatter: () => dailyEndLabelText,
          color: OT_DAILY_COLOR,
          fontWeight: "bold",
          fontSize: 10,
          lineHeight: 13,
          distance: isTargetLevelColliding ? 14 : 14,
          offset: isTargetLevelColliding ? [0, -14] : [0, 0], // ถ้าชนกัน ให้เส้นสีน้ำเงินยกตัวขึ้นด้านบน
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          padding: [2, 4],
          borderRadius: 3,
        },
      });

      // เพิ่ม Target OT Acc. Series (Step Line หรือ MarkLine)
      series.push({
        name: "Target OT Acc.",
        type: "line",
        step: "middle",
        z: 2,
        symbol: "none",
        silent: true,
        data: accTargetSeriesData,
        itemStyle: {
          color: TARGET_COLOR,
        },
        lineStyle: {
          color: TARGET_COLOR,
          width: 2,
          type: "dashed",
        },
        endLabel: {
          show: true,
          formatter: () => accEndLabelText,
          color: TARGET_COLOR,
          fontWeight: "bold",
          fontSize: 10,
          lineHeight: 13,
          distance: isTargetLevelColliding ? 14 : 14,
          offset: isTargetLevelColliding ? [0, 14] : [0, 0], // ถ้าชนกัน ให้เส้นสีแดงกดตัวลงด้านล่าง
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          padding: [2, 4],
          borderRadius: 3,
        },
      });

      if (!isOverview) {
        series.push({
          name: includeIndirect ? "SUM P1" : "SUM Direct",
          type: "line",
          z: 10,
          data: sumDataWithOffsets,
          symbol: "circle",
          symbolSize: 4,
          itemStyle: { color: SUM_COLOR },
          lineStyle: { opacity: 0 },
        });
      }

      // 4. Acc Line
      if (withAcc) {
        const accName = isOverview
          ? "Acc. Total"
          : includeIndirect
            ? "Acc. P1"
            : "Acc. Direct";

        series.push({
          name: accName,
          type: "line",
          z: 10,
          connectNulls: true,
          data: accDataWithOffsets,
          symbol: "circle",
          symbolSize: 5,
          itemStyle: { color: ACC_COLOR },
          lineStyle: { width: 2.2, color: ACC_COLOR },
        });
      }
    } else {
      // Leave mode
      const shouldShowTarget = showTarget !== false;

      if (shouldShowTarget) {
        const customLeaveList = (customTargets || []).filter((t) => {
          const typeMatch = t.target_type === "leave" || t.target_type === "default_leave";
          const keyMatch = t.chart_key === "all" || !t.chart_key;
          if (!isYearly && monthStr) {
            const monthMatch = !t.month || t.month === monthStr || (t.date_from && t.date_from.startsWith(monthStr));
            return typeMatch && keyMatch && monthMatch;
          }
          return typeMatch && keyMatch;
        });
        const fallbackLeave = Number(target) || 0;
        const leaveTargetSeriesData = (rows || []).map((r) =>
          getTargetForRow(r, "leave", customLeaveList, fallbackLeave)
        );

        // จัดทำข้อความแสดงปลายเส้น Target Leave
        const leaveEndLabelText = formatTargetEndLabel("Target", leaveTargetSeriesData, customLeaveList, fallbackLeave);

        series.push({
          name: `Target`,
          type: "line",
          step: "middle",
          z: 2,
          symbol: "none",
          silent: true,
          data: leaveTargetSeriesData,
          itemStyle: {
            color: TARGET_COLOR,
          },
          lineStyle: {
            color: TARGET_COLOR,
            width: 2,
            type: "dashed",
          },
          endLabel: {
            show: true,
            formatter: () => leaveEndLabelText,
            color: TARGET_COLOR,
            fontWeight: "bold",
            fontSize: 10,
            lineHeight: 13,
            distance: 14,
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            padding: [2, 4],
            borderRadius: 3,
          },
        });
      }

      const sumSeriesName = isOverview
        ? "SUM P1"
        : includeIndirect
          ? "SUM P1"
          : "SUM Direct";

      series.push({
        name: sumSeriesName,
        type: "line",
        z: 10,
        connectNulls: true,
        data: parsedData.sumSeriesData,
        symbol: "circle",
        symbolSize: 5,
        itemStyle: { color: SUM_COLOR },
        lineStyle: { width: 2.2, color: SUM_COLOR },
        label: {
          show: true,
          position: "top",
          distance: 5,
          formatter: (params: any) => {
            const rawVal =
              typeof params.value === "object" ? params.value?.value : params.value;
            return rawVal !== null && rawVal !== undefined && Number(rawVal) > 0.05
              ? `${Number(rawVal).toFixed(1)}%`
              : "";
          },
          fontSize: 9,
          fontWeight: "bold",
          color: SUM_COLOR,
          backgroundColor: "rgba(255, 255, 255, 0.88)",
          padding: [1, 3],
          borderRadius: 3,
        },
      });
    }

    const option: echarts.EChartsOption = {
      animation: false,
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(255, 255, 255, 0.96)",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        textStyle: { color: "#1e293b", fontSize: 12 },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const header = `<div style="font-weight: 800; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; margin-bottom: 6px;">Date: ${params[0].axisValue}</div>`;
          const dataIdx = params[0].dataIndex;
          const row = rows[dataIdx] || {};
          const isLeave = kind === "leave";

          const ORDER_MAP: Record<string, number> = {
            QA: 1,
            FPC: 2,
            SMT_F: 3,
            SMT_B: 4,
            MDS: 5,
            Indirect: 6,
          };
          const getSortPriority = (sName: string) => {
            if (ORDER_MAP[sName]) return ORDER_MAP[sName];
            if (typeof sName === "string" && sName.startsWith("SUM")) return 10;
            if (typeof sName === "string" && sName.startsWith("Acc")) return 20;
            if (typeof sName === "string" && sName.startsWith("Target")) return 30;
            return 50;
          };

          const sortedParams = [...params]
            .filter((p: any) => {
              const val = typeof p.value === "object" ? p.value?.value : p.value;
              return val !== undefined && val !== null && Number(val) > 0;
            })
            .sort((a, b) => getSortPriority(a.seriesName) - getSortPriority(b.seriesName));

          const rowsHtml = sortedParams
            .map((p: any) => {
              const val = typeof p.value === "object" ? p.value?.value : p.value;
              const marker = `<span style="display:inline-block;margin-right:6px;border-radius:10px;width:9px;height:9px;background-color:${typeof p.color === "object" ? p.color.colorStops?.[0]?.color || "#3b82f6" : p.color};"></span>`;
              const name = p.seriesName;

              // ตรวจสอบว่าเป็นแผนกในแท่งสแตกหรือไม่ (QA, FPC, SMT_F, SMT_B, MDS, Indirect)
              const groupDeptObj = groupKey ? row.supportGroups?.[groupKey]?.byDept?.[name] : null;
              const deptObj = groupDeptObj || row.depts?.[name] || (name === "Indirect" ? row.indirect : null);
              if (deptObj && typeof deptObj === "object") {
                const realRateVal = deptObj.realRate ?? (isLeave ? deptObj.leavePct : deptObj.otPct);
                const realRate = realRateVal != null ? `${Number(realRateVal).toFixed(1)}%` : pct(val);
                const detailStr = isLeave
                  ? (deptObj.people ? ` (ขาด ${deptObj.absent || 0}/${deptObj.people} คน)` : "")
                  : (deptObj.people ? ` (OT ${deptObj.otPeople || 0}/${deptObj.present || deptObj.people} คน)` : "");
                const showStackDiff = Math.abs(Number(val) - Number(realRateVal ?? val)) >= 0.15;

                return `<div style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin: 3px 0;">
                  <span>${marker}<b>${name}</b></span>
                  <div style="text-align:right;">
                    <span style="font-weight:800; color:#0f172a;">${realRate}</span>
                    <span style="font-size:10px; color:#64748b;">${detailStr}</span>
                    ${showStackDiff ? `<span style="font-size:11px; font-weight:700; color:#334155; margin-left:4px;">[ส่วนแบ่ง: ${pct(val)}]</span>` : ""}
                  </div>
                </div>`;
              }

              // ถ้าเป็นเส้น SUM (SUM Direct, SUM P1)
              if (typeof name === "string" && name.startsWith("SUM")) {
                const tot = (groupKey ? row.supportGroups?.[groupKey]?.total : null) || row.total || {};
                const pCount = Number(tot.people ?? row.people ?? 0);
                const aCount = Number(tot.absent ?? row.absent ?? 0);
                const oCount = Number(tot.otPeople ?? row.otPeople ?? 0);
                const sumDetail = isLeave
                  ? (pCount ? ` (ขาด ${aCount}/${pCount} คน)` : "")
                  : (pCount ? ` (OT ${oCount}/${pCount} คน)` : "");

                return `<div style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin: 4px 0; border-top:1px dashed #e2e8f0; padding-top:4px;">
                  <span>${marker}<b>${name}</b></span>
                  <div style="text-align:right;">
                    <span style="font-weight:900; color:#1e3a8a;">${pct(val)}</span>
                    <span style="font-size:10px; color:#475569; font-weight:600;">${sumDetail}</span>
                  </div>
                </div>`;
              }

              return `<div style="display:flex; justify-content:space-between; gap:16px; margin: 2px 0;">
                <span>${marker}<b>${name}</b></span>
                <span style="font-weight:800;">${pct(val)}</span>
              </div>`;
            })
            .join("");
          return `<div style="padding: 2px 4px; min-width: 220px;">${header}${rowsHtml}</div>`;
        },
      },
      legend: {
        show: !needsHorizontalScroll,
        top: 6,
        left: "center",
        type: "plain",
        textStyle: {
          fontSize: 12,
          fontWeight: "bold",
          color: "#334155",
        },
        itemWidth: 20,
        itemHeight: 12,
        itemGap: 24,
        data: isOverview
          ? undefined
          : [
              ...DEPARTMENTS,
              ...(includeIndirect ? ["Indirect"] : []),
              includeIndirect ? "SUM P1" : "SUM Direct",
              ...(withAcc ? [includeIndirect ? "Acc. P1" : "Acc. Direct"] : []),
            ],
      },
      grid: {
        top: needsHorizontalScroll ? 25 : 56,
        left: 10,
        right: 145,
        bottom: 26,
        containLabel: true,
      },
      toolbox: {
        show: false,
      },
      xAxis: {
        type: "category",
        boundaryGap: true,
        data: parsedData.categories,
        axisTick: {
          alignWithLabel: true,
          interval: 0,
        },
        axisLine: { lineStyle: { color: "#94a3b8" } },
        axisLabel: {
          interval: 0,
          align: "center",
          hideOverlap: false,
          fontSize: 9,
          color: (val: string, index?: number) =>
            typeof index === "number" && parsedData.weekendList[index]
              ? TARGET_COLOR
              : "#334155",
        } as any,
      },
      yAxis: {
        type: "value",
        min: 0,
        max: (() => {
          if (kind !== "leave") return 100;
          let maxVal = 0;
          const numDays = parsedData.categories.length;
          for (let i = 0; i < numDays; i++) {
            let stackSum = 0;
            DEPARTMENTS.forEach((dept) => {
              stackSum += Number(parsedData.deptSeriesData[dept]?.[i] ?? 0);
            });
            if (includeIndirect) {
              stackSum += Number(parsedData.indirectSeriesData?.[i] ?? 0);
            }
            const sumVal = Number(parsedData.sumSeriesData?.[i] ?? 0);
            maxVal = Math.max(maxVal, stackSum, sumVal);
          }
          // ถ้ามีกราฟแท่งไหน สูงกว่า 30% ค่อยปรับแกนวายเป็น 100%
          if (maxVal > 30) {
            return maxVal > 100 ? Math.ceil(maxVal / 10) * 10 : 100;
          }
          return 30;
        })(),
        interval: (() => {
          if (kind !== "leave") return undefined;
          let maxVal = 0;
          const numDays = parsedData.categories.length;
          for (let i = 0; i < numDays; i++) {
            let stackSum = 0;
            DEPARTMENTS.forEach((dept) => {
              stackSum += Number(parsedData.deptSeriesData[dept]?.[i] ?? 0);
            });
            if (includeIndirect) {
              stackSum += Number(parsedData.indirectSeriesData?.[i] ?? 0);
            }
            const sumVal = Number(parsedData.sumSeriesData?.[i] ?? 0);
            maxVal = Math.max(maxVal, stackSum, sumVal);
          }
          return maxVal > 30 ? 20 : 5;
        })(),
        axisLabel: {
          formatter: "{value}%",
          fontSize: 10,
          color: "#475569",
        },
        splitLine: {
          lineStyle: { color: "#e2e8f0", type: "dashed" },
        },
      },
      dataZoom: undefined,
      series: series.map((s) => ({
        ...s,
        large: true,
        largeThreshold: 2000,
        sampling: "lttb",
      })),
    };

    // ⚡ 60fps Frame Sync via requestAnimationFrame (rAF Batcher)
    const rafId = requestAnimationFrame(() => {
      chart.setOption(option, true);
      chart.resize();
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [
    parsedData,
    kind,
    includeIndirect,
    isOverview,
    target,
    dailyTarget,
    withAcc,
    leaveTarget,
    groupKey,
    showTarget,
    customTargets,
  ]);

  // ✅ Scroll แนวนอนเฉพาะเมื่อเป็นมุมมองรายวันทั้งปี (มากกว่า 60 วัน / 365 วัน)
  // สำหรับมุมมอง Month (12 เดือน), Day รายเดือน (31 วัน), และ Week (52 สัปดาห์) ให้แสดงเต็ม 100% โดยไม่ต้องเลื่อนแถบ Scrollbar
  const dayColumnWidth = 38;
  const needsHorizontalScroll =
    widthMode === "expand" && parsedData.categories.length > 60;
  const containerWidth = needsHorizontalScroll
    ? `${parsedData.categories.length * dayColumnWidth}px`
    : "100%";

  // จัดการปรับขนาดหน้าจอด้วย ResizeObserver อย่างนุ่มนวลผ่าน requestAnimationFrame
  useEffect(() => {
    if (!chartRef.current) return;
    let rafResizeId: number | null = null;
    const handleResize = () => {
      if (rafResizeId !== null) cancelAnimationFrame(rafResizeId);
      rafResizeId = requestAnimationFrame(() => {
        chartInstance.current?.resize();
        rafResizeId = null;
      });
    };
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(chartRef.current);
    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      if (rafResizeId !== null) cancelAnimationFrame(rafResizeId);
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
    };
  }, [containerWidth]);

  // คืนหน่วยความจำของกราฟเมื่อคอมโพเนนต์ถูก Unmount เท่านั้น
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  const handleExportExcel = async () => {
    if (!parsedData.hasData || parsedData.categories.length === 0) return;

    const dataToExport: any[] = [];
    const colConfig: Record<string, any> = {
      Period: { width: 14, align: "center", header: "Date / Period" },
    };

    if (isOverview) {
      const colTitle = kind === "ot" ? "Total OT %" : "Total Leave %";
      colConfig[colTitle] = { width: 16, align: "right", numFmt: "0.0\"%\"", header: colTitle };
      if (withAcc && kind === "ot") {
        colConfig["Acc. Total %"] = { width: 16, align: "right", numFmt: "0.0\"%\"", header: "Acc. Total %" };
      }
    } else {
      DEPARTMENTS.forEach((dept) => {
        colConfig[`${dept} %`] = { width: 14, align: "right", numFmt: "0.0\"%\"", header: `${dept} %` };
      });
      if (includeIndirect) {
        colConfig["Indirect %"] = { width: 14, align: "right", numFmt: "0.0\"%\"", header: "Indirect %" };
      }
      const sumHeader = includeIndirect ? "SUM P1 %" : "SUM Direct %";
      colConfig[sumHeader] = { width: 16, align: "right", numFmt: "0.0\"%\"", header: sumHeader };
      if (withAcc) {
        const accHeader = includeIndirect ? "Acc. P1 %" : "Acc. Direct %";
        colConfig[accHeader] = { width: 16, align: "right", numFmt: "0.0\"%\"", header: accHeader };
      }
    }

    parsedData.categories.forEach((cat, idx) => {
      const originalRow = (rows || [])[idx] || {};
      const rowItem: Record<string, any> = {
        Period: originalRow.date || cat,
      };

      if (isOverview) {
        const colTitle = kind === "ot" ? "Total OT %" : "Total Leave %";
        const sumVal = parsedData.sumSeriesData[idx];
        rowItem[colTitle] = sumVal !== null && sumVal !== undefined ? Number(sumVal) : 0;
        if (withAcc && kind === "ot") {
          const accVal = parsedData.accSeriesData[idx];
          rowItem["Acc. Total %"] = accVal !== null && accVal !== undefined ? Number(accVal) : "-";
        }
      } else {
        DEPARTMENTS.forEach((dept) => {
          const raw = parsedData.deptSeriesData[dept]?.[idx];
          const val = typeof raw === "object" ? raw?.rawValue : raw;
          rowItem[`${dept} %`] = val !== null && val !== undefined ? Number(val) : 0;
        });
        if (includeIndirect) {
          const rawInd = parsedData.indirectSeriesData[idx];
          const indVal = typeof rawInd === "object" ? rawInd?.rawValue : rawInd;
          rowItem["Indirect %"] = indVal !== null && indVal !== undefined ? Number(indVal) : 0;
        }
        const sumHeader = includeIndirect ? "SUM P1 %" : "SUM Direct %";
        const sumVal = parsedData.sumSeriesData[idx];
        rowItem[sumHeader] = sumVal !== null && sumVal !== undefined ? Number(sumVal) : 0;
        if (withAcc) {
          const accHeader = includeIndirect ? "Acc. P1 %" : "Acc. Direct %";
          const accVal = parsedData.accSeriesData[idx];
          rowItem[accHeader] = accVal !== null && accVal !== undefined ? Number(accVal) : "-";
        }
      }

      dataToExport.push(rowItem);
    });

    const safeTitle = title.replace(/[\\/:*?"<>|]/g, "_").trim();
    const cleanFileName = periodLabel ? `${safeTitle}_(${periodLabel})` : `${safeTitle}`;

    const { exportStyledExcel } = await import(
      "../../../utility/Service/xlxs/exportStyledExcel"
    );

    await exportStyledExcel({
      data: dataToExport,
      fileName: cleanFileName,
      sheetName: safeTitle.slice(0, 31),
      title: `${title}${periodLabel ? ` (${periodLabel})` : ""}`,
      subtitle: `Exported on: ${new Date().toLocaleString()}`,
      themeColor: kind === "ot" ? "blue" : "emerald",
      showTotalRow: false,
      columnsConfig: colConfig,
    });
  };

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200/70 hover:shadow-md transition-shadow duration-300">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <h2 className="text-sm sm:text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
          <span className="inline-block w-2 h-4.5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
          {title}
        </h2>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {showTarget && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {kind === "ot" ? (
                <>
                  {/* Target OT Daily */}
                  {(() => {
                    const customDailyItems = (customTargets || []).filter((t) => {
                      const typeMatch = t.target_type === "ot_daily" || t.target_type === "default_ot_daily";
                      const keyMatch = t.chart_key === "all" || !t.chart_key;
                      if (!isYearly && monthStr) {
                        const monthMatch = !t.month || t.month === monthStr || (t.date_from && t.date_from.startsWith(monthStr));
                        return typeMatch && keyMatch && monthMatch;
                      }
                      return typeMatch && keyMatch;
                    });
                    const validDateRangeItems = customDailyItems.filter((c) => c.date_from && c.date_to);
                    const hasMultiDaily = validDateRangeItems.length > 1;
                    const singleFullMonthDaily =
                      validDateRangeItems.length === 1 &&
                      validDateRangeItems[0].date_from &&
                      validDateRangeItems[0].date_to &&
                      parseInt(String(validDateRangeItems[0].date_from).split("-")[2] || "0", 10) === 1 &&
                      parseInt(String(validDateRangeItems[0].date_to).split("-")[2] || "0", 10) >= 28;

                    // รายการเป้าหมายแต่ละเดือนในโหมดรายปี
                    const distinctDailyMonthTargets = (() => {
                      if (!isYearly) return [];
                      const map = new Map<string, number>();
                      (rows || []).forEach((r) => {
                        if (!r) return;
                        let mStr: string | null = null;
                        if (r?.month && /^\d{4}-\d{2}$/.test(r.month)) {
                          mStr = r.month;
                        } else if (r?.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
                          mStr = r.date.slice(0, 7);
                        } else if (r?.date && MONTH_NAMES.includes(r.date)) {
                          const mIdx = MONTH_NAMES.indexOf(r.date) + 1;
                          const yr = selectedYear || new Date().getFullYear();
                          mStr = `${yr}-${String(mIdx).padStart(2, "0")}`;
                        }
                        if (mStr && !map.has(mStr)) {
                          const val = getTargetForRow(r, "ot_daily", customDailyItems, fallbackDaily);
                          map.set(mStr, val);
                        }
                      });
                      return Array.from(map.entries()).map(([mKey, val]) => {
                        const parts = mKey.split("-");
                        const mIdx = parts.length > 1 ? parseInt(parts[1], 10) - 1 : -1;
                        return { monthKey: mKey, label: MONTH_NAMES[mIdx] || mKey, val };
                      });
                    })();

                    const hasVaryingMonthDaily = isYearly && distinctDailyMonthTargets.some((m) => m.val !== distinctDailyMonthTargets[0]?.val);

                    // ยุบรวมเดือนที่ค่าเท่ากันเพื่อให้แสดงผลกระชับสวยงาม (เช่น Jan-Aug: 75% | Sep: 80% | Oct-Dec: 75%)
                    const groupedDailyBadges = (() => {
                      if (distinctDailyMonthTargets.length <= 4) return distinctDailyMonthTargets.map((m) => ({ key: m.monthKey, label: m.label, val: m.val }));
                      const groups: { key: string; label: string; val: number }[] = [];
                      let currentGroup: { key: string; start: string; end: string; val: number } | null = null;
                      distinctDailyMonthTargets.forEach((item) => {
                        if (!currentGroup || currentGroup.val !== item.val) {
                          if (currentGroup) {
                            groups.push({
                              key: currentGroup.key,
                              label: currentGroup.start === currentGroup.end ? currentGroup.start : `${currentGroup.start}-${currentGroup.end}`,
                              val: currentGroup.val,
                            });
                          }
                          currentGroup = { key: item.monthKey, start: item.label, end: item.label, val: item.val };
                        } else {
                          currentGroup.end = item.label;
                        }
                      });
                      if (currentGroup) {
                        groups.push({
                          key: currentGroup.key,
                          label: currentGroup.start === currentGroup.end ? currentGroup.start : `${currentGroup.start}-${currentGroup.end}`,
                          val: currentGroup.val,
                        });
                      }
                      return groups;
                    })();

                    return (
                      <div
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold shadow-sm transition ${
                          hasMultiDaily || hasVaryingMonthDaily || customDailyItems.length > 0
                            ? "border-blue-400 bg-blue-100/90 text-blue-950"
                            : "border-blue-300 bg-blue-50/90 text-blue-900 hover:bg-blue-100"
                        }`}
                        title={
                          hasVaryingMonthDaily
                            ? `เป้าหมายแต่ละเดือน: ${distinctDailyMonthTargets.map((m) => `${m.label}: ${m.val}%`).join(" | ")} (คลิกเพื่อปรับเป้าหมาย)`
                            : hasMultiDaily
                            ? `มีเป้าหมายตามช่วงวัน: ${validDateRangeItems
                                .map((c) => `${parseInt(String(c.date_from).split("-")[2] || "0", 10)}-${parseInt(String(c.date_to).split("-")[2] || "0", 10)}: ${Number(c.target_value)}%`)
                                .join(" | ")}`
                            : "ปรับค่า Target OT รายวัน (เส้นสีน้ำเงิน)"
                        }
                      >
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#1D4ED8]" />
                        <span className="font-extrabold">Target OT:</span>
                        {hasVaryingMonthDaily ? (
                          <div
                            onClick={onOpenTargetModal}
                            className="cursor-pointer flex items-center gap-1 rounded bg-white px-1.5 py-0.5 border border-blue-300 text-blue-900 hover:bg-blue-50 font-black text-xs"
                          >
                            {groupedDailyBadges.map((m, idx) => (
                              <span key={m.key} className="inline-flex items-center gap-1 whitespace-nowrap">
                                {idx > 0 && <span className="text-slate-400 font-bold mx-0.5">|</span>}
                                <span className="rounded bg-blue-100/90 px-1 py-0.2 text-[11px] font-bold text-blue-950">
                                  {m.label}
                                </span>
                                <span className="font-black text-[12px] text-blue-900">{m.val}%</span>
                              </span>
                            ))}
                          </div>
                        ) : hasMultiDaily ? (
                          <div
                            onClick={onOpenTargetModal}
                            className="cursor-pointer flex items-center gap-1 rounded bg-white px-1.5 py-0.5 border border-blue-300 text-blue-900 hover:bg-blue-50 font-black text-xs"
                          >
                            {validDateRangeItems.map((c, idx) => {
                              const f = parseInt(String(c.date_from).split("-")[2] || "0", 10);
                              const t = parseInt(String(c.date_to).split("-")[2] || "0", 10);
                              return (
                                <span key={idx} className="inline-flex items-center gap-1 whitespace-nowrap">
                                  {idx > 0 && <span className="text-slate-400 font-bold mx-0.5">|</span>}
                                  <span className="rounded bg-blue-100/90 px-1 py-0.2 text-[11px] font-bold text-blue-950">
                                    {f}-{t}
                                  </span>
                                  <span className="font-black text-[12px] text-blue-900">{Number(c.target_value)}%</span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <>
                            <input
                              type="number"
                              value={
                                singleFullMonthDaily
                                  ? Number(validDateRangeItems[0].target_value)
                                  : otDailyTarget === 0
                                  ? ""
                                  : otDailyTarget ?? ""
                              }
                              placeholder="0"
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const str = e.target.value;
                                if (str === "") {
                                  onOtDailyTargetChange?.(0);
                                  return;
                                }
                                const val = parseFloat(str);
                                if (!isNaN(val)) onOtDailyTargetChange?.(val);
                              }}
                              className="w-14 rounded border border-blue-300 bg-white px-1 py-0.5 text-center text-xs font-black text-blue-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                              min={0}
                              max={100}
                              step={1}
                              title="ปรับค่า Target OT รายวัน (เส้นสีน้ำเงิน)"
                            />
                            <span className="font-extrabold">%</span>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* Target OT Acc */}
                  {(() => {
                    const customAccItems = (customTargets || []).filter((t) => {
                      const typeMatch = t.target_type === "ot_acc" || t.target_type === "default_ot";
                      const keyMatch = t.chart_key === "all" || !t.chart_key;
                      if (!isYearly && monthStr) {
                        const monthMatch = !t.month || t.month === monthStr || (t.date_from && t.date_from.startsWith(monthStr));
                        return typeMatch && keyMatch && monthMatch;
                      }
                      return typeMatch && keyMatch;
                    });
                    const validDateRangeAccItems = customAccItems.filter((c) => c.date_from && c.date_to);
                    const hasMultiAcc = validDateRangeAccItems.length > 1;
                    const singleFullMonthAcc =
                      validDateRangeAccItems.length === 1 &&
                      validDateRangeAccItems[0].date_from &&
                      validDateRangeAccItems[0].date_to &&
                      parseInt(String(validDateRangeAccItems[0].date_from).split("-")[2] || "0", 10) === 1 &&
                      parseInt(String(validDateRangeAccItems[0].date_to).split("-")[2] || "0", 10) >= 28;

                    // รายการเป้าหมายแต่ละเดือนในโหมดรายปี
                    const distinctAccMonthTargets = (() => {
                      if (!isYearly) return [];
                      const map = new Map<string, number>();
                      (rows || []).forEach((r) => {
                        if (!r) return;
                        let mStr: string | null = null;
                        if (r?.month && /^\d{4}-\d{2}$/.test(r.month)) {
                          mStr = r.month;
                        } else if (r?.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
                          mStr = r.date.slice(0, 7);
                        } else if (r?.date && MONTH_NAMES.includes(r.date)) {
                          const mIdx = MONTH_NAMES.indexOf(r.date) + 1;
                          const yr = selectedYear || new Date().getFullYear();
                          mStr = `${yr}-${String(mIdx).padStart(2, "0")}`;
                        }
                        if (mStr && !map.has(mStr)) {
                          const val = getTargetForRow(r, "ot_acc", customAccItems, fallbackAcc);
                          map.set(mStr, val);
                        }
                      });
                      return Array.from(map.entries()).map(([mKey, val]) => {
                        const parts = mKey.split("-");
                        const mIdx = parts.length > 1 ? parseInt(parts[1], 10) - 1 : -1;
                        return { monthKey: mKey, label: MONTH_NAMES[mIdx] || mKey, val };
                      });
                    })();

                    const hasVaryingMonthAcc = isYearly && distinctAccMonthTargets.some((m) => m.val !== distinctAccMonthTargets[0]?.val);

                    // ยุบรวมเดือนที่ค่าเท่ากันเพื่อให้แสดงผลกระชับสวยงาม (เช่น Jan-Aug: 65% | Sep: 70% | Oct-Dec: 65%)
                    const groupedAccBadges = (() => {
                      if (distinctAccMonthTargets.length <= 4) return distinctAccMonthTargets.map((m) => ({ key: m.monthKey, label: m.label, val: m.val }));
                      const groups: { key: string; label: string; val: number }[] = [];
                      let currentGroup: { key: string; start: string; end: string; val: number } | null = null;
                      distinctAccMonthTargets.forEach((item) => {
                        if (!currentGroup || currentGroup.val !== item.val) {
                          if (currentGroup) {
                            groups.push({
                              key: currentGroup.key,
                              label: currentGroup.start === currentGroup.end ? currentGroup.start : `${currentGroup.start}-${currentGroup.end}`,
                              val: currentGroup.val,
                            });
                          }
                          currentGroup = { key: item.monthKey, start: item.label, end: item.label, val: item.val };
                        } else {
                          currentGroup.end = item.label;
                        }
                      });
                      if (currentGroup) {
                        groups.push({
                          key: currentGroup.key,
                          label: currentGroup.start === currentGroup.end ? currentGroup.start : `${currentGroup.start}-${currentGroup.end}`,
                          val: currentGroup.val,
                        });
                      }
                      return groups;
                    })();

                    return (
                      <div
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold shadow-sm transition ${
                          hasMultiAcc || hasVaryingMonthAcc || customAccItems.length > 0
                            ? "border-red-400 bg-red-100/90 text-red-950"
                            : "border-red-300 bg-red-50/90 text-red-900 hover:bg-red-100"
                        }`}
                        title={
                          hasVaryingMonthAcc
                            ? `เป้าหมายแต่ละเดือน: ${distinctAccMonthTargets.map((m) => `${m.label}: ${m.val}%`).join(" | ")} (คลิกเพื่อปรับเป้าหมาย)`
                            : hasMultiAcc
                            ? `มีเป้าหมายตามช่วงวัน: ${validDateRangeAccItems
                                .map((c) => `${parseInt(String(c.date_from).split("-")[2] || "0", 10)}-${parseInt(String(c.date_to).split("-")[2] || "0", 10)}: ${Number(c.target_value)}%`)
                                .join(" | ")}`
                            : "ปรับค่า Target OT สะสม (เส้นสีแดง)"
                        }
                      >
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#DC2626]" />
                        <span className="font-extrabold">Target OT Acc. :</span>
                        {hasVaryingMonthAcc ? (
                          <div
                            onClick={onOpenTargetModal}
                            className="cursor-pointer flex items-center gap-1 rounded bg-white px-1.5 py-0.5 border border-red-300 text-red-900 hover:bg-red-50 font-black text-xs"
                          >
                            {groupedAccBadges.map((m, idx) => (
                              <span key={m.key} className="inline-flex items-center gap-1 whitespace-nowrap">
                                {idx > 0 && <span className="text-slate-400 font-bold mx-0.5">|</span>}
                                <span className="rounded bg-red-100/90 px-1 py-0.2 text-[11px] font-bold text-red-950">
                                  {m.label}
                                </span>
                                <span className="font-black text-[12px] text-red-900">{m.val}%</span>
                              </span>
                            ))}
                          </div>
                        ) : hasMultiAcc ? (
                          <div
                            onClick={onOpenTargetModal}
                            className="cursor-pointer flex items-center gap-1 rounded bg-white px-1.5 py-0.5 border border-red-300 text-red-900 hover:bg-red-50 font-black text-xs"
                          >
                            {validDateRangeAccItems.map((c, idx) => {
                              const f = parseInt(String(c.date_from).split("-")[2] || "0", 10);
                              const t = parseInt(String(c.date_to).split("-")[2] || "0", 10);
                              return (
                                <span key={idx} className="inline-flex items-center gap-1 whitespace-nowrap">
                                  {idx > 0 && <span className="text-slate-400 font-bold mx-0.5">|</span>}
                                  <span className="rounded bg-red-100/90 px-1 py-0.2 text-[11px] font-bold text-red-950">
                                    {f}-{t}
                                  </span>
                                  <span className="font-black text-[12px] text-red-900">{Number(c.target_value)}%</span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <>
                            <input
                              type="number"
                              value={
                                singleFullMonthAcc
                                  ? Number(validDateRangeAccItems[0].target_value)
                                  : otTarget === 0
                                  ? ""
                                  : otTarget ?? ""
                              }
                              placeholder="0"
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const str = e.target.value;
                                if (str === "") {
                                  onOtTargetChange?.(0);
                                  return;
                                }
                                const val = parseFloat(str);
                                if (!isNaN(val)) onOtTargetChange?.(val);
                              }}
                              className="w-14 rounded border border-red-300 bg-white px-1 py-0.5 text-center text-xs font-black text-red-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200"
                              min={0}
                              max={100}
                              step={1}
                              title="ปรับค่า Target OT สะสม (เส้นสีแดง)"
                            />
                            <span className="font-extrabold">%</span>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </>
              ) : (
                (() => {
                  const customLeaveItems = (customTargets || []).filter((t) => {
                    const typeMatch = t.target_type === "leave" || t.target_type === "default_leave";
                    const keyMatch = t.chart_key === "all" || !t.chart_key;
                    if (!isYearly && monthStr) {
                      const monthMatch = !t.month || t.month === monthStr || (t.date_from && t.date_from.startsWith(monthStr));
                      return typeMatch && keyMatch && monthMatch;
                    }
                    return typeMatch && keyMatch;
                  });
                  const validDateRangeLeaveItems = customLeaveItems.filter((c) => c.date_from && c.date_to);
                  const hasMultiLeave = validDateRangeLeaveItems.length > 1;

                  // รายการเป้าหมายแต่ละเดือนในโหมดรายปี
                  const distinctLeaveMonthTargets = (() => {
                    if (!isYearly) return [];
                    const map = new Map<string, number>();
                    (rows || []).forEach((r) => {
                      if (!r) return;
                      let mStr: string | null = null;
                      if (r?.month && /^\d{4}-\d{2}$/.test(r.month)) {
                        mStr = r.month;
                      } else if (r?.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
                        mStr = r.date.slice(0, 7);
                      } else if (r?.date && MONTH_NAMES.includes(r.date)) {
                        const mIdx = MONTH_NAMES.indexOf(r.date) + 1;
                        const yr = selectedYear || new Date().getFullYear();
                        mStr = `${yr}-${String(mIdx).padStart(2, "0")}`;
                      }
                      if (mStr && !map.has(mStr)) {
                        const val = getTargetForRow(r, "leave", customLeaveItems, fallbackLeave);
                        map.set(mStr, val);
                      }
                    });
                    return Array.from(map.entries()).map(([mKey, val]) => {
                      const parts = mKey.split("-");
                      const mIdx = parts.length > 1 ? parseInt(parts[1], 10) - 1 : -1;
                      return { monthKey: mKey, label: MONTH_NAMES[mIdx] || mKey, val };
                    });
                  })();

                  const hasVaryingMonthLeave = isYearly && distinctLeaveMonthTargets.some((m) => m.val !== distinctLeaveMonthTargets[0]?.val);

                  // ยุบรวมเดือนที่ค่าเท่ากัน
                  const groupedLeaveBadges = (() => {
                    if (distinctLeaveMonthTargets.length <= 4) return distinctLeaveMonthTargets.map((m) => ({ key: m.monthKey, label: m.label, val: m.val }));
                    const groups: { key: string; label: string; val: number }[] = [];
                    let currentGroup: { key: string; start: string; end: string; val: number } | null = null;
                    distinctLeaveMonthTargets.forEach((item) => {
                      if (!currentGroup || currentGroup.val !== item.val) {
                        if (currentGroup) {
                          groups.push({
                            key: currentGroup.key,
                            label: currentGroup.start === currentGroup.end ? currentGroup.start : `${currentGroup.start}-${currentGroup.end}`,
                            val: currentGroup.val,
                          });
                        }
                        currentGroup = { key: item.monthKey, start: item.label, end: item.label, val: item.val };
                      } else {
                        currentGroup.end = item.label;
                      }
                    });
                    if (currentGroup) {
                      groups.push({
                        key: currentGroup.key,
                        label: currentGroup.start === currentGroup.end ? currentGroup.start : `${currentGroup.start}-${currentGroup.end}`,
                        val: currentGroup.val,
                      });
                    }
                    return groups;
                  })();

                  return (
                    <div className="flex items-center gap-1.5 rounded-lg border border-orange-300 bg-amber-50/90 px-2.5 py-1 text-xs font-bold text-slate-800 shadow-sm transition hover:bg-amber-100">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#DC2626]" />
                      <span className="font-extrabold">Target:</span>
                      {hasVaryingMonthLeave ? (
                        <div
                          onClick={onOpenTargetModal}
                          className="cursor-pointer flex items-center gap-1 rounded bg-white px-1.5 py-0.5 border border-orange-300 text-orange-950 hover:bg-orange-50 font-black text-xs"
                        >
                          {groupedLeaveBadges.map((m, idx) => (
                            <span key={m.key} className="inline-flex items-center gap-1 whitespace-nowrap">
                              {idx > 0 && <span className="text-slate-400 font-bold mx-0.5">|</span>}
                              <span className="rounded bg-amber-100 px-1 py-0.2 text-[11px] font-bold text-amber-950">
                                {m.label}
                              </span>
                              <span className="font-black text-[12px] text-amber-950">{m.val}%</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <>
                          <input
                            type="number"
                            value={leaveTarget === 0 ? "" : (leaveTarget ?? "")}
                            placeholder="0"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const str = e.target.value;
                              if (str === "") {
                                onLeaveTargetChange?.(0);
                                return;
                              }
                              const val = parseFloat(str);
                              if (!isNaN(val)) onLeaveTargetChange?.(val);
                            }}
                            className="w-14 rounded border border-orange-300 bg-white px-1 py-0.5 text-center text-xs font-black text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                            min={0}
                            max={100}
                            step={0.5}
                            title="ปรับค่า Target การลา (เส้นสีแดง)"
                          />
                          <span className="font-extrabold text-slate-700">%</span>
                        </>
                      )}
                    </div>
                  );
                })()
              )}

              {/* ปุ่มกำหนด Target รายวัน/ช่วงวัน */}
              {onOpenTargetModal && (
                <button
                  type="button"
                  onClick={onOpenTargetModal}
                  className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/80 px-2.5 py-1 text-xs font-bold text-indigo-800 shadow-xs transition hover:bg-indigo-100 hover:border-indigo-300 active:scale-95"
                  title="กำหนด Target ตามวันหรือช่วงวัน (ปรับระดับเส้น Target)"
                >
                  <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                  <span>ตั้งเป้าตามวัน</span>
                  {(() => {
                    const relevantCount = (customTargets || []).filter((t) =>
                      kind === "ot" ? t.target_type === "ot_daily" || t.target_type === "ot_acc" : t.target_type === "leave"
                    ).length;
                    return relevantCount > 0 ? (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-black text-white">
                        {relevantCount}
                      </span>
                    ) : null;
                  })()}
                </button>
              )}
            </div>
          )}

          {/* 🌟 ปุ่มบันทึกข้อมูลด่วน (ส่งออก Excel & รูปภาพ PNG) */}
          {parsedData.hasData && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleExportExcel}
                className="group flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-gradient-to-r from-emerald-50 to-teal-50 px-2.5 py-1 text-xs font-black text-emerald-800 shadow-xs transition-all duration-200 hover:border-emerald-600 hover:from-emerald-600 hover:to-teal-600 hover:text-white hover:shadow-md hover:shadow-emerald-500/20 active:scale-95"
                title="Export ข้อมูลกราฟนี้เป็น Excel (.xlsx)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 transition-colors group-hover:text-white" />
                <span>Export Excel</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (chartInstance.current) {
                    const url = chartInstance.current.getDataURL({
                      type: "png",
                      pixelRatio: 2,
                      backgroundColor: "#ffffff",
                    });
                    const link = document.createElement("a");
                    link.download = `${(periodLabel ? `${title}_(${periodLabel})` : title).replace(/[\\/:*?"<>|]/g, "_").trim()}.png`;
                    link.href = url;
                    link.click();
                  }
                }}
                className="group flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-gradient-to-r from-blue-50 to-indigo-50 px-2.5 py-1 text-xs font-black text-blue-800 shadow-xs transition-all duration-200 hover:border-blue-600 hover:from-blue-600 hover:to-indigo-600 hover:text-white hover:shadow-md hover:shadow-blue-500/20 active:scale-95"
                title="ดาวน์โหลดรูปภาพกราฟ (.png)"
              >
                <Download className="h-3.5 w-3.5 text-blue-600 transition-colors group-hover:text-white" />
                <span>Save PNG</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {needsHorizontalScroll && parsedData.hasData && (
        <div className="mb-2 flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-slate-700">
          {isOverview ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-3.5 rounded-sm bg-[#0284C7]" />
                <span>{kind === "ot" ? "Total OT P1" : "Total Leave P1"}</span>
              </div>
              {kind === "leave" && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#2563EB]" />
                  <span>SUM P1</span>
                </div>
              )}
              {withAcc && kind === "ot" && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#C2410C]" />
                  <span>Acc. Total</span>
                </div>
              )}
            </>
          ) : (
            <>
              {DEPARTMENTS.map((dept) => (
                <div key={dept} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-3.5 rounded-sm"
                    style={{ backgroundColor: DEPARTMENT_COLORS[dept] || "#3b82f6" }}
                  />
                  <span>{dept}</span>
                </div>
              ))}
              {includeIndirect && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-3.5 rounded-sm bg-[#1F3864]" />
                  <span>Indirect</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#2563EB]" />
                <span>{includeIndirect ? "SUM P1" : "SUM Direct"}</span>
              </div>
              {withAcc && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#C2410C]" />
                  <span>{includeIndirect ? "Acc. P1" : "Acc. Direct"}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!parsedData.hasData ? (
        <div className="flex h-[330px] items-center justify-center rounded-lg bg-slate-50 text-sm font-bold text-slate-400">
          There is no data for this month.
        </div>
      ) : (
        <div className={needsHorizontalScroll ? "overflow-x-auto w-full pb-1" : "w-full"}>
          <div
            ref={chartRef}
            style={{
              width: containerWidth,
              minWidth: containerWidth,
              height: 330,
            }}
          />
        </div>
      )}
    </section>
  );
});

// ==============================================
// ✅ คอมโพเนนต์หลัก: DepartmentRatioCharts
// ==============================================
export default function DepartmentRatioCharts({
  data,
  month,
  mode = "ot",
  widthMode = "fit",
  viewMode = "day",
  dayYearMode = false,
  selectedYear,
  yearData,
}: {
  data: any;
  month?: string;
  mode?: "ot" | "leave";
  widthMode?: "fit" | "expand";
  viewMode?: string;
  dayYearMode?: boolean;
  selectedYear?: number;
  yearData?: Record<string, any>;
}) {
  const kind: Kind = mode === "leave" ? "leave" : "ot";
  const viewKey = viewMode === "day" && dayYearMode ? "day_yearly" : viewMode;
  const currentMonthStr = month || data?.month || new Date().toISOString().slice(0, 7);

  // คำนวณปี 4 หลักที่แน่นอน (เช่น 2026)
  const currentYearNum =
    selectedYear ||
    (month ? Number(month.slice(0, 4)) : null) ||
    (data?.month ? Number(String(data.month).slice(0, 4)) : null) ||
    new Date().getFullYear();

  const isYearly = viewMode === "month" || viewMode === "week" || (viewMode === "day" && dayYearMode);

  // กำหนด periodKey:
  // - โหมดรายวัน (Day/Monthly): แยกตามเดือน currentMonthStr (เช่น "2026-09", "2026-08")
  // - โหมดรายสัปดาห์/รายเดือน/Day-Yearly: แยกตามปี String(currentYearNum) (เช่น "2026")
  const targetPeriod = (viewMode === "day" && !dayYearMode) ? currentMonthStr : String(currentYearNum);

  // ล้างค่า global targets เก่าใน localStorage ที่ไม่มีระบุเดือน/ปี (เช่น 'manpower-ratio:target-ot:day')
  // เพื่อไม่ให้ค่า global เดิมหลุดมารั่วใส่เดือนอื่น
  useEffect(() => {
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && /^manpower-ratio:target-(leave|ot|ot-daily):(day|week|month|day_yearly)$/.test(key)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((k) => localStorage.removeItem(k));
  }, []);

  const getTargetFromData = (type: "leave" | "ot" | "otDaily", defaultVal: number) => {
    const storageType = type === "otDaily" ? "ot-daily" : type;

    // 1. อ่านค่าเฉพาะเดือน/ปีจาก localStorage ของงวดนี้ก่อน (เช่น manpower-ratio:target-ot:day:2026-09)
    const savedPeriod = localStorage.getItem(`manpower-ratio:target-${storageType}:${viewKey}:${targetPeriod}`);
    if (savedPeriod !== null && !isNaN(Number(savedPeriod))) {
      return Number(savedPeriod);
    }

    // 2. ถ้า Backend ส่ง targets ของงวดนี้มา (data.targets) ให้ใช้
    const targetsObj = data?.targets?.[viewKey] || data?.targets;
    if (targetsObj && typeof targetsObj[type] === "number") {
      return Number(targetsObj[type]);
    }

    // 3. Fallback เป็น default ค่าเริ่มต้นของระบบ (OT Daily: 75, OT Acc: 65, Leave: 5)
    return defaultVal;
  };

  const [customLeaveTarget, setCustomLeaveTarget] = useState<number>(() =>
    getTargetFromData("leave", LEAVE_TARGET),
  );
  const [customOtTarget, setCustomOtTarget] = useState<number>(() =>
    getTargetFromData("ot", OT_TARGET),
  );
  const [customOtDailyTarget, setCustomOtDailyTarget] = useState<number>(() =>
    getTargetFromData("otDaily", OT_DAILY_TARGET),
  );

  // ✅ State สำหรับเป้าหมายกำหนดเองตามวัน (Custom Targets By Date/Period)
  const [customTargets, setCustomTargets] = useState<CustomTargetRecord[]>([]);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState<boolean>(false);

  const [modalMonth, setModalMonth] = useState<string>(currentMonthStr);

  useEffect(() => {
    if (currentMonthStr) setModalMonth(currentMonthStr);
  }, [currentMonthStr]);

  // ดึง custom targets เมื่อ month เปลี่ยน (หรือเมื่อสลับเดือนใน Modal หรือโหมดรายปี)
  const activeMonthToLoad = isTargetModalOpen ? modalMonth : (isYearly ? String(currentYearNum) : currentMonthStr);

  useEffect(() => {
    if (!activeMonthToLoad) return;
    let isCancelled = false;
    fetchCustomTargets(activeMonthToLoad)
      .then((records) => {
        if (!isCancelled) setCustomTargets(records);
      })
      .catch((err) => console.error("Error fetching custom targets:", err));
    return () => {
      isCancelled = true;
    };
  }, [activeMonthToLoad, isTargetModalOpen, isYearly, currentYearNum]);

  const handleAddCustomTarget = async (target: CustomTargetRecord) => {
    const res = await saveCustomTarget(target);
    if (res.success) {
      const records = await fetchCustomTargets(target.month || activeMonthToLoad);
      setCustomTargets(records);
    }
  };

  const handleDeleteCustomTarget = async (id: number) => {
    const res = await deleteCustomTarget(id);
    if (res.success) {
      setCustomTargets((prev) => prev.filter((t) => t.id !== id));
    }
  };

  // เมื่อเปลี่ยนเดือน หรือเปลี่ยนแท็บ Day / Week / Month ให้ดึงค่าของเดือนและแท็บนั้นๆ มาแสดง
  useEffect(() => {
    setCustomLeaveTarget(getTargetFromData("leave", LEAVE_TARGET));
    setCustomOtTarget(getTargetFromData("ot", OT_TARGET));
    setCustomOtDailyTarget(getTargetFromData("otDaily", OT_DAILY_TARGET));
  }, [viewKey, targetPeriod, data?.targets]);

  const handleLeaveTargetChange = (val: number) => {
    setCustomLeaveTarget(val);
    localStorage.setItem(`manpower-ratio:target-leave:${viewKey}:${targetPeriod}`, String(val));
    if (data?.targets) {
      if (!data.targets[viewKey]) data.targets[viewKey] = {};
      data.targets[viewKey].leave = val;
    }
    updateSharedTargets({ view: viewKey, month: targetPeriod, leave: val });
  };
  const handleOtTargetChange = (val: number) => {
    setCustomOtTarget(val);
    localStorage.setItem(`manpower-ratio:target-ot:${viewKey}:${targetPeriod}`, String(val));
    if (data?.targets) {
      if (!data.targets[viewKey]) data.targets[viewKey] = {};
      data.targets[viewKey].ot = val;
    }
    updateSharedTargets({ view: viewKey, month: targetPeriod, ot: val });
  };
  const handleOtDailyTargetChange = (val: number) => {
    setCustomOtDailyTarget(val);
    localStorage.setItem(`manpower-ratio:target-ot-daily:${viewKey}:${targetPeriod}`, String(val));
    if (data?.targets) {
      if (!data.targets[viewKey]) data.targets[viewKey] = {};
      data.targets[viewKey].otDaily = val;
    }
    updateSharedTargets({ view: viewKey, month: targetPeriod, otDaily: val });
  };

  const leaveTarget = customLeaveTarget;
  const otTarget = customOtTarget;
  const otDailyTarget = customOtDailyTarget;
  const periodText = isYearly ? `${currentYearNum}` : monthTitle(month || data?.month);
  const monthText = periodText;
  const chartData = data?.chartData || data;
  const title = kind === "leave" ? "Leave ratio by Dept." : "OT Ratio by Dept.";

  const supportGroups = kind === "leave" ? (["DC", "MOU", "PER"] as const) : [];
  const directSupportGroups = kind === "leave" ? ["MPS"] : [];

  // ป้ายกำกับโหมด พร้อมระบุปี เช่น "Day_Monthly_2026", "Day_Yearly_2026", "Week_2026", "Month_2026"
  const periodLabel =
    viewMode === "day"
      ? dayYearMode
        ? `Day_Yearly_${currentYearNum}`
        : `Day_Monthly_${currentYearNum}`
      : viewMode === "week"
        ? `Week_${currentYearNum}`
        : `Month_${currentYearNum}`;

  const commonProps = {
    year: currentYearNum,
    selectedYear: currentYearNum,
    yearData,
    isYearly,
    periodLabel,
    monthStr: targetPeriod,
    leaveTarget,
    otTarget,
    otDailyTarget,
    widthMode,
    onLeaveTargetChange: handleLeaveTargetChange,
    onOtTargetChange: handleOtTargetChange,
    onOtDailyTargetChange: handleOtDailyTargetChange,
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* 🌟 ส่วนที่ 0: OVERVIEW — ภาพรวมทั้งหมด (แท่งเดียวรวมทุกแผนก) */}
      <ChartErrorBoundary fallbackTitle={`Overview Chart (${monthText})`}>
        <RatioChart
          {...commonProps}
          title={
            kind === "leave"
              ? `Leave Ratio Overview ${monthText} (All P1)`
              : `OT Ratio Overview ${monthText} (All P1)`
          }
          rows={chartData?.includeIndirect || chartData?.direct || []}
          kind={kind}
          includeIndirect={true}
          spreadsheetData={data?.spreadsheetData}
          isOverview={true}
          customTargets={customTargets}
          onOpenTargetModal={() => setIsTargetModalOpen(true)}
        />
      </ChartErrorBoundary>

      {/* 🔵 ส่วนที่ 1: DIRECT — รวมทุกแผนกผลิต */}
      <ChartErrorBoundary fallbackTitle={`Direct Chart (${monthText})`}>
        <RatioChart
          {...commonProps}
          title={`${title} ${monthText} (Direct)`.trim()}
          rows={chartData?.direct || []}
          kind={kind}
          includeIndirect={false}
          customTargets={customTargets}
          onOpenTargetModal={() => setIsTargetModalOpen(true)}
        />
      </ChartErrorBoundary>

      {/* 🟢 ส่วนที่ 2: INCLUDE INDIRECT — รวมพนักงานสนับสนุนด้วย */}
      <ChartErrorBoundary fallbackTitle={`Include Indirect Chart (${monthText})`}>
        <RatioChart
          {...commonProps}
          title={`${title} ${monthText} (Include indirect)`.trim()}
          rows={chartData?.includeIndirect || []}
          kind={kind}
          includeIndirect={true}
          customTargets={customTargets}
          onOpenTargetModal={() => setIsTargetModalOpen(true)}
        />
      </ChartErrorBoundary>

      {/* 🔹 กราฟกลุ่มย่อย MPS (Direct) */}
      {directSupportGroups.map((group) => (
        <ChartErrorBoundary key={`direct-${group}`} fallbackTitle={`Leave ${group} (Direct)`}>
          <RatioChart
            {...commonProps}
            title={`Leave_${group} ratio by Dept. ${monthText} (Direct)`}
            rows={chartData?.direct || []}
            kind="leave"
            includeIndirect={false}
            groupKey={group}
            showTarget={true}
            showAcc={false}
            customTargets={customTargets}
            onOpenTargetModal={() => setIsTargetModalOpen(true)}
          />
        </ChartErrorBoundary>
      ))}

      {/* 🔹 กราฟกลุ่มย่อย MPS (Include Indirect) */}
      {kind === "leave" && (
        <ChartErrorBoundary key="leave-mps" fallbackTitle="Leave MPS (Include Indirect)">
          <RatioChart
            {...commonProps}
            title={`Leave ratio_MPS by Dept. ${monthText} (Include Indirect)`}
            rows={chartData?.includeIndirect || []}
            kind="leave"
            includeIndirect={true}
            groupKey="MPS"
            showTarget={true}
            showAcc={false}
            customTargets={customTargets}
            onOpenTargetModal={() => setIsTargetModalOpen(true)}
          />
        </ChartErrorBoundary>
      )}

      {/* 🔹 กราฟกลุ่มย่อยอื่นๆ (DC, MOU, PER) */}
      {supportGroups.map((group) => (
        <ChartErrorBoundary key={group} fallbackTitle={`Leave ${group}`}>
          <RatioChart
            {...commonProps}
            title={`Leave ratio_${group} by Dept. ${monthText} (Include Indirect)`}
            rows={chartData?.includeIndirect || []}
            kind="leave"
            includeIndirect={true}
            groupKey={group}
            showTarget={true}
            showAcc={false}
            customTargets={customTargets}
            onOpenTargetModal={() => setIsTargetModalOpen(true)}
          />
        </ChartErrorBoundary>
      ))}

      {/* 🎯 Modal กำหนด Target รายวัน/ช่วงวัน */}
      <CustomTargetModal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)}
        month={modalMonth}
        kind={kind}
        customTargets={customTargets}
        onMonthChange={(m) => setModalMonth(m)}
        onAddTarget={handleAddCustomTarget}
        onDeleteTarget={handleDeleteCustomTarget}
      />
    </div>
  );
}
