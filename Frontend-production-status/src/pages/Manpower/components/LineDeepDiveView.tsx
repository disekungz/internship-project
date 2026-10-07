import React, { useState, useMemo, useEffect, useRef } from "react";
import * as echarts from "echarts";
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  Users,
  Clock,
  Activity,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  Zap,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  BarChart3,
  Sliders,
  Cpu,
  Layers,
  Flame,
  Award,
  Maximize2,
  Minimize2,
  RefreshCw,
  Gauge,
  Radio,
  Workflow,
  Sparkles,
  PieChart as PieIcon,
  Search,
  Filter,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { isAggregateLine, isShiftLine } from "../utils/lineClassification";

interface LineDeepDiveViewProps {
  selectedLine: string;
  activeTab: string;
  selectedMonth: string;
  displayDays: number[];
  spreadsheetData: Record<string, any>;
  manhourCalendar: Record<number, any>;
  tabLines: string[];
  onBackToMatrix: () => void;
  onSelectLine: (line: string) => void;
  onExportLine?: () => void;
}

export default function LineDeepDiveView({
  selectedLine,
  activeTab,
  selectedMonth,
  displayDays = [],
  spreadsheetData = {},
  manhourCalendar = {},
  tabLines = [],
  onBackToMatrix,
  onSelectLine,
  onExportLine,
}: LineDeepDiveViewProps) {
  const [selectedDayDetail, setSelectedDayDetail] = useState<number | null>(null);
  const [activeMetricTab, setActiveMetricTab] = useState<"headcount" | "hours" | "leaves">("headcount");
  const [cockpitTime, setCockpitTime] = useState(new Date());
  const [filterSeverity, setFilterSeverity] = useState<"all" | "anomaly" | "weekend">("all");

  const trendChartRef = useRef<HTMLDivElement | null>(null);
  const donutChartRef = useRef<HTMLDivElement | null>(null);
  const trendChartInstance = useRef<echarts.ECharts | null>(null);
  const donutChartInstance = useRef<echarts.ECharts | null>(null);

  // Live Digital Clock simulation
  useEffect(() => {
    const timer = setInterval(() => setCockpitTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Line raw record
  const lineData = useMemo(() => {
    return spreadsheetData[selectedLine] || {};
  }, [spreadsheetData, selectedLine]);

  // Process day by day record
  const dailyRecords = useMemo(() => {
    return displayDays.map((day) => {
      const d = lineData[day] || {};
      const reg = Number(d.opRegister) || 0;
      const present = Number(d.swipeCards) || 0;
      const absent = Number(d.notWorking) || 0;
      const sick = Number(d.sickLeave) || 0;
      const business = Number(d.businessLeave) || 0;
      const annual = Number(d.annualLeave) || 0;
      const otherLeave = Math.max(absent - sick - business - annual, 0);

      const helpOut = Number(d.helpOutHrs) || 0;
      const helpIn = Number(d.helpInHrs) || 0;
      const ot1 = Number(d.manOT1) || 0;
      const ot1Out = Number(d.manOT1HelpOut) || 0;
      const ot1In = Number(d.manOT1HelpIn) || 0;
      const ot2 = Number(d.manOT2) || 0;
      const ot2Out = Number(d.manOT2HelpOut) || 0;
      const ot2In = Number(d.manOT2HelpIn) || 0;

      const isHoliday = Number(manhourCalendar?.[day]?.manhour) === 0;
      const normalHr = isHoliday ? 0 : Math.max(present * 8 - helpOut + helpIn, 0);
      const otHr = Math.max(ot1 - ot1Out + ot1In, 0) * 3 + Math.max(ot2 - ot2Out + ot2In, 0) * 11;
      const totalManHours = normalHr + otHr;

      const attRate = reg > 0 ? Number(((present / reg) * 100).toFixed(1)) : 0;
      const leaveRate = reg > 0 ? Number(((absent / reg) * 100).toFixed(1)) : 0;
      const offDayOrUnaccounted = Math.max(reg - present - absent, 0);
      const offDayRate = reg > 0 ? Number(((offDayOrUnaccounted / reg) * 100).toFixed(1)) : 0;

      // Anomaly detection with precise diagnostic reasons
      const anomalyReasons: string[] = [];
      if (!isHoliday) {
        if (leaveRate > 8) {
          anomalyReasons.push(`High Leaves (${leaveRate}% > 8% limit)`);
        }
        if (normalHr > 0 && otHr / normalHr > 0.45) {
          const otPct = Math.round((otHr / normalHr) * 100);
          anomalyReasons.push(`Critical OT Load (${otPct}% of normal)`);
        }
        if (attRate > 0 && attRate < 85) {
          anomalyReasons.push(`Low Attendance (${attRate}%)`);
        }
      }
      const hasAnomaly = anomalyReasons.length > 0;
      const hasData = reg > 0 || present > 0 || absent > 0 || normalHr > 0 || otHr > 0;

      return {
        day,
        isHoliday,
        hasData,
        reg,
        present,
        absent,
        sick,
        business,
        annual,
        otherLeave,
        helpIn,
        helpOut,
        netHelp: helpIn - helpOut,
        normalHr,
        otHr,
        totalManHours,
        attRate,
        leaveRate,
        offDayOrUnaccounted,
        offDayRate,
        hasAnomaly,
        anomalyReasons,
      };
    });
  }, [displayDays, lineData, manhourCalendar]);

  // Selected Day Record for Day Inspector Flyout
  const selectedDayRecord = useMemo(() => {
    if (selectedDayDetail === null) return null;
    return dailyRecords.find((r) => r.day === selectedDayDetail) || null;
  }, [selectedDayDetail, dailyRecords]);

  // Aggregated Line Statistics
  const lineStats = useMemo(() => {
    let sumReg = 0;
    let sumPresent = 0;
    let sumAbsent = 0;
    let sumNormalHr = 0;
    let sumOtHr = 0;
    let sumHelpIn = 0;
    let sumHelpOut = 0;
    let sumSick = 0;
    let sumBusiness = 0;
    let sumAnnual = 0;
    let workingDaysCount = 0;
    let anomalyCount = 0;

    dailyRecords.forEach((r) => {
      if (r.hasAnomaly) anomalyCount++;
      if (r.reg > 0 || r.present > 0) {
        workingDaysCount++;
        sumReg += r.reg;
        sumPresent += r.present;
        sumAbsent += r.absent;
        sumNormalHr += r.normalHr;
        sumOtHr += r.otHr;
        sumHelpIn += r.helpIn;
        sumHelpOut += r.helpOut;
        sumSick += r.sick;
        sumBusiness += r.business;
        sumAnnual += r.annual;
      }
    });

    const avgReg = workingDaysCount > 0 ? Math.round(sumReg / workingDaysCount) : 0;
    const avgPresent = workingDaysCount > 0 ? Math.round(sumPresent / workingDaysCount) : 0;
    const overallAttRate = sumReg > 0 ? Number(((sumPresent / sumReg) * 100).toFixed(1)) : 0;
    const overallLeaveRate = sumReg > 0 ? Number(((sumAbsent / sumReg) * 100).toFixed(1)) : 0;
    const totalManHours = sumNormalHr + sumOtHr;
    const otReliancePct = totalManHours > 0 ? Number(((sumOtHr / totalManHours) * 100).toFixed(1)) : 0;
    const shiftOffPct = Math.max(100 - overallAttRate - overallLeaveRate, 0);

    // TPS / Apple Ops Composite Scoring Algorithm
    let score = 100;
    if (overallAttRate < 95) score -= (95 - overallAttRate) * 1.5;
    if (overallLeaveRate > 5) score -= (overallLeaveRate - 5) * 2.8;
    if (otReliancePct > 22) score -= (otReliancePct - 22) * 0.9;
    score = Math.max(Math.min(Math.round(score), 100), 40);

    let tier = "S";
    let tierColor = "text-emerald-700 bg-emerald-50 border-emerald-300 ring-emerald-200";
    let statusDesc = "OPTIMAL YIELD / ZERO BOTTLENECK";
    if (score < 70) {
      tier = "C";
      tierColor = "text-rose-700 bg-rose-50 border-rose-300 ring-rose-200";
      statusDesc = "HIGH ATTRITION & WORKLOAD RISK";
    } else if (score < 80) {
      tier = "B";
      tierColor = "text-amber-700 bg-amber-50 border-amber-300 ring-amber-200";
      statusDesc = "ELEVATED FATIGUE / OT HEAVY";
    } else if (score < 90) {
      tier = "A";
      tierColor = "text-blue-700 bg-blue-50 border-blue-300 ring-blue-200";
      statusDesc = "NOMINAL OPERATIONAL PERFORMANCE";
    }

    return {
      workingDaysCount,
      anomalyCount,
      avgReg,
      avgPresent,
      sumReg,
      sumPresent,
      sumAbsent,
      overallAttRate,
      overallLeaveRate,
      shiftOffPct: Number(shiftOffPct.toFixed(1)),
      sumNormalHr,
      sumOtHr,
      totalManHours,
      otReliancePct,
      netHelp: sumHelpIn - sumHelpOut,
      sumHelpIn,
      sumHelpOut,
      sumSick,
      sumBusiness,
      sumAnnual,
      score,
      tier,
      tierColor,
      statusDesc,
    };
  }, [dailyRecords]);

  // ─────────────────────────────────────────────────────────────
  // 📈 ECHARTS 1: DUAL-AXIS LINE/BAR (CLEAN WHITE / SLATE THEME)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!trendChartRef.current) return;
    if (!trendChartInstance.current) {
      trendChartInstance.current = echarts.init(trendChartRef.current, undefined, {
        renderer: 'canvas',
        devicePixelRatio: Math.max(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
      });
    }
    const chart = trendChartInstance.current;

    // ตรวจสอบวันสุดท้ายที่มีการบันทึกข้อมูลจริง (Last day with data)
    let lastRecordedIdx = -1;
    dailyRecords.forEach((d, idx) => {
      if (d.hasData) lastRecordedIdx = idx;
    });

    const daysLabels = dailyRecords.map((d) => String(d.day));
    // วันที่เลยวันสุดท้ายที่มีข้อมูลไปแล้ว (วันในอนาคต) ให้เป็น null เพื่อไม่ให้เส้นกราฟดิ่งลง 0% แล้วลากยาวไปจนถึงสิ้นเดือน
    const presentData = dailyRecords.map((d, idx) => (lastRecordedIdx !== -1 && idx > lastRecordedIdx ? null : d.present));
    const normalHrData = dailyRecords.map((d, idx) => (lastRecordedIdx !== -1 && idx > lastRecordedIdx ? null : d.normalHr));
    const otHrData = dailyRecords.map((d, idx) => (lastRecordedIdx !== -1 && idx > lastRecordedIdx ? null : d.otHr));
    const attRateData = dailyRecords.map((d, idx) => (lastRecordedIdx !== -1 && idx > lastRecordedIdx ? null : d.attRate));
    const leaveRateData = dailyRecords.map((d, idx) => (lastRecordedIdx !== -1 && idx > lastRecordedIdx ? null : d.leaveRate));

    const commonXAxis = {
      type: "category" as const,
      data: daysLabels,
      axisLine: { lineStyle: { color: "#cbd5e1" } },
      axisLabel: {
        color: "#64748b",
        fontSize: 10,
        fontWeight: "bold",
        interval: 0,
      },
    };

    let option: echarts.EChartsOption = {};

    if (activeMetricTab === "headcount") {
      // คำนวณความสูงสัมพันธ์ (0 - 1) ของยอดแท่ง (แกนซ้าย) และจุดเปอร์เซ็นต์ (แกนขวา) เพื่อตรวจจับการซ้อนทับกัน
      const maxPresent = Math.max(...presentData.map((v) => Number(v) || 0), 4);
      const maxLeave = Math.max(35, Math.ceil((Math.max(...leaveRateData.map((v) => Number(v) || 0), 0) + 5) / 5) * 5);

      const presentSeriesData = presentData.map((val, idx) => {
        if (!val || Number(val) <= 0) return null;
        const lVal = leaveRateData[idx];
        const hasLeave = lVal != null && Number(lVal) > 0;
        // ตรวจสอบว่าพิกัดความสูงบนหน้าจอใกล้เคียงกันหรือไม่ (เช่น ต่างกันไม่เกิน 8%)
        const normPresent = Number(val) / maxPresent;
        const normLeave = hasLeave ? Number(lVal) / maxLeave : -1;
        const isOverlapping = hasLeave && Math.abs(normPresent - normLeave) < 0.12;

        return {
          value: val,
          label: {
            show: true,
            position: "top",
            // ถ้าซ้อนกัน ให้ขยับตัวเลขสีฟ้าขึ้นไปสูงขึ้น (distance: 14) ถ้าไม่ซ้อน ให้ใช้ระยะปกติ (distance: 4)
            distance: isOverlapping ? 14 : 4,
            color: "#0284c7",
            fontSize: 10,
            fontWeight: "bold",
            formatter: () => String(val),
          },
        };
      });

      const leaveSeriesData = leaveRateData.map((val, idx) => {
        if (val === null || val === undefined) return null;
        const pVal = presentData[idx];
        const hasPresent = pVal != null && Number(pVal) > 0;
        const normPresent = hasPresent ? Number(pVal) / maxPresent : -1;
        const normLeave = Number(val) > 0 ? Number(val) / maxLeave : -1;
        const isOverlapping = hasPresent && Number(val) > 0 && Math.abs(normPresent - normLeave) < 0.12;

        return {
          value: val,
          label: {
            show: Number(val) > 0,
            // ถ้าซ้อนกัน ให้มีกรอบป้ายสีขาวมนขอบเพื่อให้อ่านค่าได้ชัดเจน ไม่ทับซ้อนกับแท่งกราฟ
            position: isOverlapping ? "bottom" : "top",
            distance: isOverlapping ? 6 : 4,
            color: isOverlapping ? "#be123c" : "#e11d48",
            fontSize: 10,
            fontWeight: "bold",
            backgroundColor: isOverlapping ? "rgba(255, 255, 255, 0.95)" : "transparent",
            padding: isOverlapping ? [1.5, 4] : [0, 0],
            borderRadius: 4,
            borderColor: isOverlapping ? "#fecdd3" : "transparent",
            borderWidth: isOverlapping ? 1 : 0,
            shadowColor: isOverlapping ? "rgba(0, 0, 0, 0.08)" : "transparent",
            shadowBlur: isOverlapping ? 4 : 0,
            formatter: () => (Number(val) > 0 ? `${val}%` : ""),
          },
        };
      });

      option = {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis",
          backgroundColor: "#ffffff",
          borderColor: "#cbd5e1",
          borderWidth: 1,
          textStyle: { color: "#0f172a", fontSize: 12, fontFamily: "sans-serif" },
          extraCssText: "box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border-radius: 12px; padding: 12px;",
          formatter: (params: any) => {
            if (!Array.isArray(params) || params.length === 0) return "";
            const dayIdx = params[0].dataIndex;
            const rec = dailyRecords[dayIdx];
            let html = `<div style="font-weight:bold;color:#0369a1;margin-bottom:6px;font-size:13px;">Day ${rec.day} ${rec.isHoliday ? "(Holiday)" : ""}</div>`;
            params.forEach((p: any) => {
              if (p.value === null || p.value === undefined) return;
              html += `<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:2px;">
                <span style="color:#64748b;">${p.marker} ${p.seriesName}:</span>
                <span style="font-weight:bold;color:#0f172a;">${p.value} ${p.seriesName.includes("%") ? "%" : "persons"}</span>
              </div>`;
            });
            html += `<div style="margin-top:6px;border-top:1px solid #e2e8f0;padding-top:6px;color:#64748b;font-size:11px;">
              Att Rate: <b style="color:${rec.attRate >= 95 ? "#16a34a" : "#dc2626"}">${rec.attRate}%</b> | Register: <b>${rec.reg} persons</b>
            </div>`;
            if (rec.hasAnomaly) {
              html += `<div style="color:#dc2626;font-weight:bold;margin-top:4px;">⚠ ${rec.anomalyReasons.join(", ")}</div>`;
            }
            return html;
          },
        },
        legend: {
          data: ["Present (Active)", "Leave Rate %"],
          textStyle: { color: "#475569", fontSize: 11, fontWeight: "bold" },
          top: 0,
          right: 10,
        },
        grid: { left: "3%", right: "4%", bottom: "8%", top: "15%", containLabel: true },
        xAxis: commonXAxis,
        yAxis: [
          {
            type: "value",
            name: "Headcount (persons)",
            nameTextStyle: { color: "#64748b", fontSize: 11, fontWeight: "bold" },
            splitLine: { lineStyle: { color: "#f1f5f9", type: "dashed" } },
            axisLabel: { color: "#64748b", fontSize: 11 },
          },
          {
            type: "value",
            name: "Leave Rate %",
            max: (value: { max: number }) => Math.max(35, Math.ceil((value.max + 5) / 5) * 5),
            nameTextStyle: { color: "#e11d48", fontSize: 11, fontWeight: "bold" },
            splitLine: { show: false },
            axisLabel: {
              color: "#e11d48",
              fontSize: 11,
              formatter: "{value}%",
            },
          },
        ],
        series: [
          {
            name: "Present (Active)",
            type: "bar",
            data: presentSeriesData,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: "#38bdf8" },
                { offset: 1, color: "#0284c7" },
              ]),
              borderRadius: [6, 6, 0, 0],
            },
            emphasis: { focus: "series" },
          },
          {
            name: "Leave Rate %",
            type: "line",
            yAxisIndex: 1,
            data: leaveSeriesData,
            connectNulls: true,
            smooth: false,
            lineStyle: { color: "#e11d48", width: 2 },
            itemStyle: { color: "#e11d48" },
            symbolSize: 6,
            markLine: {
              symbol: ["none", "none"],
              data: [{ yAxis: 5, name: "Max 5% Target" }],
              lineStyle: { color: "#f43f5e", type: "dashed", width: 1.5 },
              label: {
                show: true,
                position: "insideEndTop",
                color: "#e11d48",
                formatter: "Limit 5%",
                fontSize: 10,
                fontWeight: "bold",
                backgroundColor: "rgba(255, 241, 242, 0.8)",
                padding: [2, 4],
                borderRadius: 4,
              },
            },
          },
        ],
      };
    } else if (activeMetricTab === "hours") {
      option = {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis",
          backgroundColor: "#ffffff",
          borderColor: "#cbd5e1",
          borderWidth: 1,
          textStyle: { color: "#0f172a", fontSize: 12, fontFamily: "sans-serif" },
          extraCssText: "box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border-radius: 12px; padding: 12px;",
        },
        legend: {
          data: ["Normal Man-Hours", "OT Man-Hours", "Total Man-Hours"],
          textStyle: { color: "#475569", fontSize: 11, fontWeight: "bold" },
          top: 0,
          right: 10,
        },
        grid: { left: "3%", right: "4%", bottom: "8%", top: "15%", containLabel: true },
        xAxis: commonXAxis,
        yAxis: {
          type: "value",
          name: "Working Hours (h)",
          nameTextStyle: { color: "#64748b", fontSize: 11, fontWeight: "bold" },
          splitLine: { lineStyle: { color: "#f1f5f9", type: "dashed" } },
          axisLabel: { color: "#64748b", fontSize: 11 },
        },
        series: [
          {
            name: "Normal Man-Hours",
            type: "bar",
            stack: "hours",
            data: normalHrData,
            itemStyle: { color: "#2563eb" },
            label: {
              show: true,
              position: "inside",
              color: "#ffffff",
              fontSize: 9,
              formatter: (params: any) => (params.value > 100 ? `${Math.round(params.value)}h` : ""),
            },
          },
          {
            name: "OT Man-Hours",
            type: "bar",
            stack: "hours",
            data: otHrData,
            itemStyle: { color: "#f59e0b", borderRadius: [6, 6, 0, 0] },
            label: {
              show: true,
              position: "top",
              color: "#d97706",
              fontSize: 10,
              fontWeight: "bold",
              formatter: (params: any) => (params.value > 0 ? `+${Math.round(params.value)}h` : ""),
            },
          },
          {
            name: "Total Man-Hours",
            type: "line",
            data: dailyRecords.map((d) => d.totalManHours),
            smooth: false,
            lineStyle: { color: "#0284c7", width: 2.5 },
            itemStyle: { color: "#0284c7" },
            symbolSize: 6,
          },
        ],
      };
    } else {
      option = {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis",
          backgroundColor: "#ffffff",
          borderColor: "#cbd5e1",
          borderWidth: 1,
          textStyle: { color: "#0f172a", fontSize: 12, fontFamily: "sans-serif" },
          extraCssText: "box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border-radius: 12px; padding: 12px;",
        },
        legend: {
          data: ["Attendance Rate %", "Leave Rate %"],
          textStyle: { color: "#475569", fontSize: 11, fontWeight: "bold" },
          top: 0,
          right: 10,
        },
        grid: { left: "3%", right: "4%", bottom: "8%", top: "15%", containLabel: true },
        xAxis: commonXAxis,
        yAxis: {
          type: "value",
          name: "Percentage (%)",
          max: 100,
          nameTextStyle: { color: "#64748b", fontSize: 11, fontWeight: "bold" },
          splitLine: { lineStyle: { color: "#f1f5f9", type: "dashed" } },
          axisLabel: { color: "#64748b", fontSize: 11, formatter: "{value}%" },
        },
        series: [
          {
            name: "Attendance Rate %",
            type: "line",
            data: attRateData.map((val, idx) => {
              if (val === null || val === undefined) return null;
              const lVal = leaveRateData[idx];
              const isClose = lVal != null && Math.abs(Number(val) - Number(lVal)) < 15;
              const isHigh = Number(val) >= 95;

              return {
                value: val,
                label: {
                  show: Number(val) > 0,
                  position: isHigh ? "bottom" : "top",
                  distance: isHigh ? 8 : isClose ? 10 : 5,
                  color: "#15803d",
                  fontSize: 10,
                  fontWeight: "bold",
                  formatter: () => `${val}%`,
                },
              };
            }),
            smooth: false,
            connectNulls: true,
            lineStyle: { color: "#16a34a", width: 2.5 },
            itemStyle: { color: "#16a34a" },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: "rgba(22, 163, 74, 0.15)" },
                { offset: 1, color: "rgba(22, 163, 74, 0.0)" },
              ]),
            },
          },
          {
            name: "Leave Rate %",
            type: "line",
            data: leaveRateData.map((val, idx) => {
              if (val === null || val === undefined) return null;
              const aVal = attRateData[idx];
              const isClose = aVal != null && Math.abs(Number(val) - Number(aVal)) < 15;
              const isNearZero = Number(val) <= 10;

              return {
                value: val,
                label: {
                  show: Number(val) > 0,
                  // เมื่อใกล้ 0% ให้ขยับขึ้นด้านบน (top) เพื่อไม่ให้ชนกับแกน X และตัวเลขวันที่ด้านล่าง
                  position: "top",
                  distance: isNearZero ? 6 : isClose ? 8 : 4,
                  color: "#be123c",
                  fontSize: 10,
                  fontWeight: "bold",
                  formatter: () => (Number(val) > 0 ? `${val}%` : ""),
                },
              };
            }),
            smooth: false,
            connectNulls: true,
            lineStyle: { color: "#e11d48", width: 2 },
            itemStyle: { color: "#e11d48" },
          },
        ],
      };
    }

    if (option && option.series) {
      option.series = (option.series as any[]).map((s) => ({
        ...s,
        large: true,
        largeThreshold: 2000,
        sampling: "lttb",
      }));
    }

    chart.setOption(option, true);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [dailyRecords, activeMetricTab]);

  // ─────────────────────────────────────────────────────────────
  // 🍩 ECHARTS 2: DONUT CHART (CLEAN WHITE / SLATE THEME)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!donutChartRef.current) return;
    if (!donutChartInstance.current) {
      donutChartInstance.current = echarts.init(donutChartRef.current, undefined, {
        renderer: 'canvas',
        devicePixelRatio: Math.max(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
      });
    }
    const chart = donutChartInstance.current;

    const donutOption: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "#ffffff",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { color: "#0f172a", fontFamily: "sans-serif" },
        extraCssText: "box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); border-radius: 12px;",
        formatter: (params: any) => {
          return `<div style="font-weight:bold;color:#0f172a;margin-bottom:2px;">${params.name}</div>
          <div style="font-size:14px;color:${params.color};font-weight:900;">${params.value}% <span style="font-size:11px;color:#64748b;font-weight:normal;">of workforce</span></div>`;
        },
      },
      legend: {
        show: true,
        bottom: "0%",
        left: "center",
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 16,
        textStyle: { color: "#475569", fontSize: 11, fontWeight: "bold" },
      },
      series: [
        {
          name: "Headcount Allocation",
          type: "pie",
          radius: ["62%", "82%"],
          center: ["50%", "45%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: "#ffffff",
            borderWidth: 3,
          },
          label: {
            show: true,
            position: "center",
            formatter: () => `{rate|${lineStats.overallAttRate}%}\n{title|ATTENDANCE}`,
            rich: {
              rate: {
                fontSize: 22,
                fontWeight: "bold",
                color: "#0f172a",
                lineHeight: 28,
                fontFamily: "monospace",
              },
              title: {
                fontSize: 10,
                color: "#94a3b8",
                fontWeight: "bold",
                letterSpacing: 1,
              },
            },
          },
          emphasis: {
            scale: true,
            scaleSize: 6,
            label: {
              show: true,
              formatter: (params: any) => `{rate|${params.value}%}\n{title|${params.name.toUpperCase()}}`,
              rich: {
                rate: {
                  fontSize: 22,
                  fontWeight: "bold",
                  color: "#0f172a",
                  lineHeight: 28,
                  fontFamily: "monospace",
                },
                title: {
                  fontSize: 10,
                  color: "#64748b",
                  fontWeight: "bold",
                  letterSpacing: 1,
                },
              },
            },
          },
          data: [
            {
              value: lineStats.overallAttRate,
              name: "Present",
              itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
                  { offset: 0, color: "#10b981" },
                  { offset: 1, color: "#059669" },
                ]),
              },
            },
            {
              value: lineStats.overallLeaveRate,
              name: "Leave",
              itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
                  { offset: 0, color: "#f43f5e" },
                  { offset: 1, color: "#e11d48" },
                ]),
              },
            },
            {
              value: lineStats.shiftOffPct,
              name: "Shift Off / Others",
              itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
                  { offset: 0, color: "#94a3b8" },
                  { offset: 1, color: "#64748b" },
                ]),
              },
            },
          ],
        },
      ],
    };

    chart.setOption(donutOption, true);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [lineStats]);

  const isAggregate = isAggregateLine(selectedLine, activeTab);
  const isShift = isShiftLine(selectedLine);

  // Filtered daily records for table
  const displayedDailyRecords = useMemo(() => {
    if (filterSeverity === "anomaly") return dailyRecords.filter((d) => d.hasAnomaly);
    if (filterSeverity === "weekend") return dailyRecords.filter((d) => d.isHoliday);
    return dailyRecords;
  }, [dailyRecords, filterSeverity]);

  return (
    <div className="w-full space-y-4 font-sans text-slate-800 pb-12 animate-in fade-in zoom-in-98 duration-300">
      {/* ─────────────────────────────────────────────────────────────
          ZONE 1: CLEAN ENTERPRISE EXECUTIVE BANNER
      ───────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-white via-blue-50/30 to-sky-50/40 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onBackToMatrix}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-blue-600 hover:text-white hover:border-blue-600 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Cross-Line Matrix</span>
            </button>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-500">{activeTab}</span>
              <span className="text-slate-300">/</span>
              <span className="text-blue-600 font-bold">Line Cockpit</span>
              <span className="text-slate-300">/</span>
              <span className="rounded-lg bg-gradient-to-r from-blue-600 to-sky-500 px-2.5 py-0.5 text-white font-black shadow-xs shadow-blue-300/40">
                {selectedLine}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5 border border-slate-200 text-xs font-mono text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>CYCLE TIME:</span>
              <span className="text-slate-900 font-bold">
                {cockpitTime.toLocaleTimeString("en-GB", { hour12: false })}
              </span>
            </div>

            <select
              aria-label="Switch Line"
              value={selectedLine}
              onChange={(e) => onSelectLine(e.target.value)}
              className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-blue-900 outline-none hover:bg-white hover:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {tabLines.map((line) => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
            </select>

            {onExportLine && (
              <button
                type="button"
                onClick={onExportLine}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:from-emerald-600 hover:to-teal-700 hover:shadow-md active:scale-95 cursor-pointer"
                title={`ส่งออกตารางข้อมูล ${selectedLine} เป็นไฟล์ Excel`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-white" />
                <span>Export (Excel)</span>
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 pt-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                <Cpu className="h-3 w-3" /> PRECISION LINE DIAGNOSTICS
              </span>
              {isAggregate ? (
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-black text-indigo-700 border border-indigo-200">
                  SUMMARY AGGREGATE
                </span>
              ) : isShift ? (
                <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-black text-sky-700 border border-sky-200">
                  SHIFT DEDICATED
                </span>
              ) : (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-700 border border-slate-200">
                  MAIN LINE
                </span>
              )}
            </div>

            <div className="mt-1 flex items-baseline gap-3">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                {selectedLine}
              </h1>
              <span className="text-xs font-bold text-slate-500">
                ({selectedMonth} • {lineStats.workingDaysCount} Working Days)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-blue-200/60 bg-gradient-to-br from-blue-50 to-slate-50 p-3 shadow-xs">
            <div className="text-right">
              <div className="text-[10px] font-bold tracking-widest text-blue-600/80 uppercase">
                OPS READINESS INDEX
              </div>
              <div className="text-xs font-black text-slate-800">{lineStats.statusDesc}</div>
              <div className="text-[10px] font-bold text-slate-500">Health Score: {lineStats.score}/100</div>
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 text-xl font-black shadow-xs ${lineStats.tierColor}`}>
              {lineStats.tier}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ZONE 2: 4 CLEAN TELEMETRY SCORECARD TILES
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Attendance Reliability */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden relative before:absolute before:inset-x-0 before:top-0 before:h-1 before:rounded-t-2xl before:bg-gradient-to-r before:from-emerald-400 before:to-teal-500">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Attendance Reliability
            </span>
            <span className={`p-1.5 rounded-lg ${lineStats.overallAttRate >= 95 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
              <Users className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">
              {lineStats.overallAttRate}%
            </span>
            <span className="text-xs font-bold text-slate-500">
              Avg {lineStats.avgPresent} / {lineStats.avgReg} ops
            </span>
          </div>

          <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                lineStats.overallAttRate >= 95 ? "bg-emerald-500" : lineStats.overallAttRate >= 90 ? "bg-amber-500" : "bg-rose-500"
              }`}
              style={{ width: `${Math.min(lineStats.overallAttRate, 100)}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold">
            <span className="text-slate-400">Benchmark: 95.0%</span>
            <span className={lineStats.overallAttRate >= 95 ? "text-emerald-600" : "text-rose-600"}>
              {lineStats.overallAttRate >= 95 ? "✓ Optimal" : "⚠ Under Benchmark"}
            </span>
          </div>
        </div>

        {/* Absence Leakage */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden relative before:absolute before:inset-x-0 before:top-0 before:h-1 before:rounded-t-2xl before:bg-gradient-to-r before:from-rose-400 before:to-pink-500">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Absence Leakage
            </span>
            <span className={`p-1.5 rounded-lg ${lineStats.overallLeaveRate <= 5 ? "bg-blue-50 text-blue-600" : "bg-rose-50 text-rose-600"}`}>
              <Activity className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={`text-3xl font-black ${lineStats.overallLeaveRate > 5 ? "text-rose-600" : "text-slate-900"}`}>
              {lineStats.overallLeaveRate}%
            </span>
            <span className="text-xs font-bold text-slate-500">
              {lineStats.sumAbsent} total leaves
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg bg-rose-50/70 p-2 border border-rose-100 text-xs font-mono">
            <span className="text-rose-700 font-bold">Unplanned:</span>
            <span className="font-black text-rose-900">{lineStats.sumAbsent} person-days</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold">
            <span className="text-slate-400">Target: &lt;5.0%</span>
            <span className={lineStats.overallLeaveRate <= 5 ? "text-emerald-600" : "text-rose-600"}>
              {lineStats.overallLeaveRate <= 5 ? "Controlled" : `Alert (${lineStats.anomalyCount} anomaly days)`}
            </span>
          </div>
        </div>

        {/* OT Stress */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden relative before:absolute before:inset-x-0 before:top-0 before:h-1 before:rounded-t-2xl before:bg-gradient-to-r before:from-amber-400 before:to-orange-500">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              OT Reliance Load
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-amber-600">
              {lineStats.otReliancePct}%
            </span>
            <span className="text-xs font-bold text-slate-500">
              {lineStats.sumOtHr.toLocaleString()} OT hrs
            </span>
          </div>

          <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500"
              style={{ width: `${Math.min(lineStats.otReliancePct * 2.5, 100)}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold">
            <span className="text-slate-400">Total: {lineStats.totalManHours.toLocaleString()}h</span>
            <span className={lineStats.otReliancePct > 25 ? "text-amber-600" : "text-slate-600"}>
              {lineStats.otReliancePct > 25 ? "High OT Load" : "Controlled"}
            </span>
          </div>
        </div>

        {/* Net Help Mobility */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden relative before:absolute before:inset-x-0 before:top-0 before:h-1 before:rounded-t-2xl before:bg-gradient-to-r before:from-blue-400 before:to-violet-500">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Mobility Balance (Net Help)
            </span>
            <span className={`p-1.5 rounded-lg ${lineStats.netHelp >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-purple-50 text-purple-600"}`}>
              <Zap className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={`text-3xl font-black ${lineStats.netHelp > 0 ? "text-emerald-600" : lineStats.netHelp < 0 ? "text-rose-600" : "text-slate-900"}`}>
              {lineStats.netHelp > 0 ? `+${lineStats.netHelp}` : lineStats.netHelp}h
            </span>
            <span className="text-xs font-bold text-slate-500">
              Net balance
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs font-mono bg-slate-50 rounded-lg p-1.5 border border-slate-200/60">
            <span className="text-emerald-700 font-bold">IN: +{lineStats.sumHelpIn}h</span>
            <span className="text-rose-700 font-bold">OUT: -{lineStats.sumHelpOut}h</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold">
            <span className="text-slate-400">Status:</span>
            <span className="text-slate-800">
              {lineStats.netHelp > 0 ? "Net Receiver (รับคน)" : lineStats.netHelp < 0 ? "Net Supplier (ส่งคน)" : "Balanced Cell"}
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ZONE 3: 📈 ECHARTS INTERACTIVE CHRONO HORIZON (CLEAN WHITE)
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                Operational Telemetry Horizon // {selectedLine}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Daily operational trends across the month — hover over data points for detailed diagnostics
            </p>
          </div>

          {/* Metric Selector Tabs */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveMetricTab("headcount")}
              className={`rounded-lg px-3.5 py-1.5 transition cursor-pointer ${
                activeMetricTab === "headcount"
                  ? "bg-white text-blue-900 font-black shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              👥 Headcount & Leave Rate
            </button>
            <button
              type="button"
              onClick={() => setActiveMetricTab("hours")}
              className={`rounded-lg px-3.5 py-1.5 transition cursor-pointer ${
                activeMetricTab === "hours"
                  ? "bg-white text-blue-900 font-black shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              ⏱️ Workload (Normal vs OT)
            </button>
            <button
              type="button"
              onClick={() => setActiveMetricTab("leaves")}
              className={`rounded-lg px-3.5 py-1.5 transition cursor-pointer ${
                activeMetricTab === "leaves"
                  ? "bg-white text-blue-900 font-black shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📈 Performance Rates %
            </button>
          </div>
        </div>

        {/* ECharts Canvas Container */}
        <div className="w-full rounded-xl bg-slate-50/50 p-2 border border-slate-200">
          <div ref={trendChartRef} className="w-full h-80 sm:h-96" />
        </div>
      </div>


      {/* ─────────────────────────────────────────────────────────────
          ZONE 4: HEATMAP CALENDAR + HEADCOUNT RECONCILIATION
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Left: Attendance Heatmap Calendar */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-3">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blue-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Daily Attendance Heatmap
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-500 font-mono">{selectedMonth}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Color per day by attendance rate — click any day for deep inspection
            </p>
          </div>

          {/* Heatmap Grid */}
          <div className="flex flex-wrap gap-1.5">
            {dailyRecords.map((rec) => {
              const rate = rec.attRate;
              const isHoliday = rec.isHoliday;
              const hasData = rec.hasData;
              const isSelected = selectedDayDetail === rec.day;

              // วันที่ยังไม่มีข้อมูลเข้ามา
              if (!hasData) {
                return (
                  <div
                    key={rec.day}
                    title={`Day ${rec.day}: No data yet`}
                    className="relative flex h-9 w-9 flex-col items-center justify-center rounded-lg text-[10px] font-black border border-dashed border-slate-200 bg-slate-50/50 text-slate-300 cursor-default"
                  >
                    <span className="leading-none text-slate-400">{rec.day}</span>
                    <span className="text-[7px] font-medium text-slate-300 leading-none mt-0.5">-</span>
                  </div>
                );
              }

              let bg = "bg-slate-100 text-slate-400";
              let tooltip = `Day ${rec.day}: Holiday — Click to inspect`;
              if (!isHoliday) {
                if (rate >= 95) { bg = "bg-emerald-500 text-white"; }
                else if (rate >= 90) { bg = "bg-emerald-300 text-emerald-900"; }
                else if (rate >= 85) { bg = "bg-amber-400 text-amber-900"; }
                else if (rate >= 80) { bg = "bg-orange-400 text-white"; }
                else { bg = "bg-rose-500 text-white"; }
                tooltip = `Day ${rec.day}: ${rate}% (${rec.present}/${rec.reg}) — Click to inspect`;
              }

              return (
                <button
                  type="button"
                  key={rec.day}
                  onClick={() => setSelectedDayDetail(selectedDayDetail === rec.day ? null : rec.day)}
                  title={tooltip}
                  className={`relative flex h-9 w-9 flex-col items-center justify-center rounded-lg text-[10px] font-black shadow-xs cursor-pointer transition-all hover:scale-110 active:scale-95 ${bg} ${
                    isSelected ? "ring-3 ring-blue-600 ring-offset-2 scale-110 z-10 shadow-md" : ""
                  }`}
                >
                  <span className="leading-none">{rec.day}</span>
                  {!isHoliday && (
                    <span className="text-[8px] font-bold opacity-80 leading-none">{rate}%</span>
                  )}
                  {rec.hasAnomaly && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-600 border border-white" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Interactive Day Inspector (Quick Flyout when clicked) */}
          {selectedDayRecord && (
            <div className="mt-1 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/70 via-white to-sky-50/50 p-3 shadow-xs space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white">
                    {selectedDayRecord.day}
                  </span>
                  <div>
                    <span className="text-xs font-black text-slate-900">
                      Day {selectedDayRecord.day} Performance Deep-Dive
                    </span>
                    <span className="ml-2 text-[10px] font-bold text-slate-500 font-mono">
                      {selectedMonth}-{String(selectedDayRecord.day).padStart(2, "0")}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDayDetail(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                  title="Close Inspector"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Day Metrics 4-grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="rounded-lg bg-white p-2 border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] text-slate-400 block font-sans">Active / Register</span>
                  <span className="text-sm font-black text-slate-900">
                    {selectedDayRecord.present} <span className="text-xs font-normal text-slate-400">/ {selectedDayRecord.reg}</span>
                  </span>
                  <span className={`text-[10px] font-bold block mt-0.5 ${selectedDayRecord.attRate >= 95 ? "text-emerald-600" : "text-amber-600"}`}>
                    Att. {selectedDayRecord.attRate}%
                  </span>
                </div>

                <div className="rounded-lg bg-white p-2 border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] text-slate-400 block font-sans">Absences</span>
                  <span className="text-sm font-black text-rose-600">
                    {selectedDayRecord.absent} <span className="text-xs font-normal text-slate-400">persons</span>
                  </span>
                  <span className="text-[10px] font-bold text-rose-600 block mt-0.5">
                    Leave {selectedDayRecord.leaveRate}%
                  </span>
                </div>

                <div className="rounded-lg bg-white p-2 border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] text-slate-400 block font-sans">Normal / OT Hrs</span>
                  <span className="text-sm font-black text-slate-900">
                    {selectedDayRecord.normalHr}h <span className="text-xs font-bold text-amber-600">+{selectedDayRecord.otHr}h</span>
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 block mt-0.5">
                    Total {selectedDayRecord.totalManHours}h
                  </span>
                </div>

                <div className="rounded-lg bg-white p-2 border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] text-slate-400 block font-sans">Mobility (Help)</span>
                  <span className={`text-sm font-black ${selectedDayRecord.netHelp > 0 ? "text-emerald-600" : selectedDayRecord.netHelp < 0 ? "text-purple-600" : "text-slate-800"}`}>
                    {selectedDayRecord.netHelp > 0 ? `+${selectedDayRecord.netHelp}h` : `${selectedDayRecord.netHelp}h`}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    +{selectedDayRecord.helpIn}h / -{selectedDayRecord.helpOut}h
                  </span>
                </div>
              </div>

              {/* Anomaly banner if any */}
              {selectedDayRecord.hasAnomaly ? (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-2 text-xs text-rose-700">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span className="font-bold">Alert Detected:</span>
                  <span className="font-medium">{selectedDayRecord.anomalyReasons.join(" • ")}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-1 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span className="font-bold text-[11px]">Normal Operations: Attendance and workload within standard limits.</span>
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center flex-wrap gap-2 border-t border-slate-100 pt-2 text-[10px] font-bold">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500 inline-block" /> ≥95%</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-300 inline-block" /> 90–94%</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-400 inline-block" /> 85–89%</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-orange-400 inline-block" /> 80–84%</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-rose-500 inline-block" /> &lt;80%</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-dashed border-slate-300 bg-slate-50 inline-block" /> No Data</span>
            <span className="flex items-center gap-1 ml-auto text-red-600"><span className="h-2 w-2 rounded-full bg-red-600 inline-block" /> Anomaly</span>
          </div>
        </div>

        {/* Right: Detailed 3-Way Reconciliation */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Headcount Reconciliation Breakdown
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500">
                  Base: <b className="text-slate-800">{lineStats.sumReg.toLocaleString()}</b> Man-Days
                </span>
                <span className="text-[10px] font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-blue-800">
                  100% Accounted
                </span>
              </div>
            </div>
          </div>

          {/* Modern Thick Executive Segmented Bar */}
          <div className="space-y-3 pt-1">
            <div className="flex h-10 w-full overflow-hidden rounded-2xl bg-slate-100 p-1 border border-slate-200 shadow-sm">
              {/* Segment 1: Present */}
              <div
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full rounded-l-xl transition-all flex items-center justify-center px-2 shadow-xs shrink-0"
                style={{ width: `${lineStats.overallAttRate}%` }}
                title={`Present: ${lineStats.overallAttRate}%`}
              >
                <div className="flex items-center gap-1.5 text-white whitespace-nowrap">
                  <span className="text-xs font-bold tracking-wide">Present</span>
                  <span className="font-mono text-xs font-black bg-emerald-700/50 px-1.5 py-0.2 rounded-md">
                    {lineStats.overallAttRate}%
                  </span>
                </div>
              </div>

              {/* Segment 2: Leave */}
              <div
                className="bg-gradient-to-r from-rose-500 to-rose-600 h-full transition-all flex items-center justify-center px-2 shadow-xs shrink-0 min-w-[76px]"
                style={{ width: `${Math.max(lineStats.overallLeaveRate, 7.5)}%` }}
                title={`Leave: ${lineStats.overallLeaveRate}%`}
              >
                <div className="flex items-center gap-1 text-white whitespace-nowrap">
                  <span className="text-xs font-bold">Leave</span>
                  <span className="font-mono text-xs font-black">
                    {lineStats.overallLeaveRate}%
                  </span>
                </div>
              </div>

              {/* Segment 3: Shift Off */}
              <div
                className="bg-gradient-to-r from-slate-500 to-slate-600 h-full rounded-r-xl transition-all flex items-center justify-center px-2 shadow-xs flex-1 min-w-[90px]"
                title={`Shift-Off / Others: ${lineStats.shiftOffPct}%`}
              >
                <div className="flex items-center gap-1.5 text-white whitespace-nowrap">
                  <span className="text-xs font-bold tracking-wide">Shift-Off</span>
                  <span className="font-mono text-xs font-black bg-slate-700/50 px-1.5 py-0.2 rounded-md">
                    {lineStats.shiftOffPct}%
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stat Indicators */}
            <div className="flex items-center justify-between text-xs font-mono font-bold px-1 text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Active: <b>{lineStats.sumPresent.toLocaleString()}</b> ops</span>
              </span>
              <span className="flex items-center gap-1.5 text-rose-600">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span>Absences: <b>{lineStats.sumAbsent}</b> persons</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2 w-2 rounded-full bg-slate-500" />
                <span>Scheduled Off: <b>{lineStats.shiftOffPct}%</b></span>
              </span>
            </div>
          </div>

          {/* 3 Explanation Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
              <div className="flex items-center justify-between text-emerald-800 font-bold">
                <span>Active On-Line</span>
                <span>{lineStats.overallAttRate}%</span>
              </div>
              <p className="text-[11px] text-emerald-700/90 mt-1">
                Employees clocked-in on line ({lineStats.sumPresent.toLocaleString()} person-days)
              </p>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
              <div className="flex items-center justify-between text-rose-800 font-bold">
                <span>Unplanned Leaves</span>
                <span>{lineStats.overallLeaveRate}%</span>
              </div>
              <p className="text-[11px] text-rose-700/90 mt-1">
                {lineStats.sumAbsent} person-days ({lineStats.anomalyCount} days exceeded 8% limit)
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-slate-800 font-bold">
                <span>Scheduled Off</span>
                <span>{lineStats.shiftOffPct}%</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                Rotation day-off &amp; Help-Out — not counted as absence
              </p>
            </div>
          </div>
        </div>
      </div>


      {/* ─────────────────────────────────────────────────────────────
          SMART EXECUTIVE INSIGHTS & ACTIONABLE RECOMMENDATIONS
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-slate-50/80 via-white to-blue-50/30">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs shrink-0 mt-0.5">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Executive Diagnostics &amp; Operational Health
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${lineStats.tierColor}`}>
                TIER {lineStats.tier} · {lineStats.score}/100
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {lineStats.overallAttRate >= 95 ? (
                <span>• Line attendance is robust at <b className="text-emerald-700 font-bold">{lineStats.overallAttRate}%</b>, fully meeting the 95% threshold.</span>
              ) : (
                <span>• Attendance is at <b className="text-rose-700 font-bold">{lineStats.overallAttRate}%</b> (below 95% target). Recommend workforce replenishment.</span>
              )}
              {" "}
              {lineStats.overallLeaveRate <= 5 ? (
                <span>• Unplanned leave rate is healthy (<b className="text-emerald-700">{lineStats.overallLeaveRate}%</b>).</span>
              ) : (
                <span>• Elevated unplanned leaves (<b className="text-rose-700">{lineStats.overallLeaveRate}%</b> &gt; 5% target) across <b className="text-rose-700">{lineStats.anomalyCount} days</b>.</span>
              )}
              {" "}
              {lineStats.otReliancePct > 25 ? (
                <span>• High overtime reliance (<b className="text-amber-700">{lineStats.otReliancePct}%</b> of total {lineStats.totalManHours.toLocaleString()}h). Monitor operator fatigue.</span>
              ) : (
                <span>• OT workload is balanced (<b className="text-slate-800">{lineStats.otReliancePct}%</b>).</span>
              )}
              {" "}
              <span>
                • Mobility status: <b className="text-slate-800">{lineStats.netHelp > 0 ? `Net Receiver (+${lineStats.sumHelpIn}h borrowed)` : lineStats.netHelp < 0 ? `Net Supplier (-${lineStats.sumHelpOut}h loaned)` : "Self-sufficient (0h net)"}</b>.
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-center text-xs font-mono">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-2xs text-right">
            <span className="text-[9px] text-slate-400 block font-sans uppercase">Mobility Balance</span>
            <span className={`font-black ${lineStats.netHelp > 0 ? "text-emerald-600" : lineStats.netHelp < 0 ? "text-purple-600" : "text-slate-700"}`}>
              {lineStats.netHelp > 0 ? `+${lineStats.netHelp}h` : `${lineStats.netHelp}h`}
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-2xs text-right">
            <span className="text-[9px] text-slate-400 block font-sans uppercase">Yield Status</span>
            <span className="font-black text-slate-900">{lineStats.statusDesc.split("/")[0].trim()}</span>
          </div>
        </div>
      </div>


      {/* ─────────────────────────────────────────────────────────────
          ZONE 5: AUDIT LOG GRID WITH SMART FILTERS (CLEAN WHITE)
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-blue-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Precision Chrono Audit Log // {selectedMonth}
            </h3>
            <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              {displayedDailyRecords.length} records
            </span>
          </div>

          {/* Smart Filter Buttons */}
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setFilterSeverity("all")}
              className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                filterSeverity === "all" ? "bg-blue-600 text-white shadow-xs" : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
              }`}
            >
              ALL DAYS
            </button>
            <button
              type="button"
              onClick={() => setFilterSeverity("anomaly")}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition cursor-pointer ${
                filterSeverity === "anomaly" ? "bg-rose-600 text-white shadow-xs" : "bg-white text-rose-600 hover:bg-rose-50 border border-rose-200"
              }`}
            >
              <AlertTriangle className="h-3 w-3" />
              <span>ALERTS ONLY ({lineStats.anomalyCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterSeverity("weekend")}
              className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                filterSeverity === "weekend" ? "bg-slate-800 text-white shadow-xs" : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
              }`}
            >
              HOLIDAYS
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-100 text-slate-700 font-black text-[11px] border-b border-slate-200 z-10 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3 text-center">Date</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Register</th>
                <th className="py-2.5 px-3 text-center">Present</th>
                <th className="py-2.5 px-3 text-center">Att. Rate</th>
                <th className="py-2.5 px-3 text-center">Leaves</th>
                <th className="py-2.5 px-3 text-center">Leave Rate</th>
                <th className="py-2.5 px-3 text-center">Normal (h)</th>
                <th className="py-2.5 px-3 text-center">OT (h)</th>
                <th className="py-2.5 px-3 text-center">Total Man-Hrs</th>
                <th className="py-2.5 px-3 text-center">Help Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700 font-mono">
              {displayedDailyRecords.map((r) => (
                <tr
                  key={r.day}
                  className={`transition-colors hover:bg-blue-50/50 ${
                    r.isHoliday
                      ? "bg-slate-50/80 text-slate-400"
                      : r.hasAnomaly
                        ? "bg-rose-50/40"
                        : ""
                  }`}
                >
                  <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                    Day {r.day}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {r.isHoliday ? (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 font-sans font-bold">HOLIDAY</span>
                    ) : r.hasAnomaly ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="rounded bg-rose-100 border border-rose-200 px-2 py-0.5 text-[10px] font-black text-rose-700 shadow-xs">
                          ⚠ ANOMALY
                        </span>
                        <span className="text-[9px] text-rose-600 font-sans font-bold leading-tight text-center max-w-[150px]">
                          {r.anomalyReasons.join(" • ")}
                        </span>
                      </div>
                    ) : (
                      <span className="rounded bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">
                        NOMINAL
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-600">{r.reg}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-900">{r.present}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`font-bold ${r.attRate >= 95 ? "text-emerald-600" : r.attRate >= 90 ? "text-amber-600" : "text-rose-600"}`}>
                      {r.attRate}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-600">{r.absent}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`font-bold ${r.leaveRate > 5 ? "text-rose-600" : "text-slate-600"}`}>
                      {r.leaveRate}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-700">{r.normalHr.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-amber-700">{r.otHr.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-center font-black text-blue-900">{r.totalManHours.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      r.netHelp > 0
                        ? "bg-emerald-100 text-emerald-800"
                        : r.netHelp < 0
                          ? "bg-rose-100 text-rose-800"
                          : "text-slate-500"
                    }`}>
                      {r.netHelp > 0 ? `+${r.netHelp}` : r.netHelp}h
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
