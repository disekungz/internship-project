import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Maximize2,
  Minimize2,
  RefreshCw,
  TrendingUp,
  Users,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Award,
  BarChart2,
  Calendar,
  Sparkles,
  Zap,
  Activity,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";
import { isAggregateLine, isShiftLine } from "../utils/lineClassification";

interface WarRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: string;
  activeTab: string;
  selectedLine: string;
  tabLines: string[];
  spreadsheetData: Record<string, any>;
  displayDays: number[];
  manhourCalendar: Record<number, any>;
}

export default function WarRoomModal({
  isOpen,
  onClose,
  selectedMonth,
  activeTab,
  selectedLine,
  tabLines,
  spreadsheetData,
  displayDays,
  manhourCalendar,
}: WarRoomModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [lastRefreshedTime, setLastRefreshedTime] = useState(new Date());

  // Filter lines to display
  const activeLinesList = useMemo(() => {
    return tabLines && tabLines.length > 0 ? tabLines : [selectedLine];
  }, [tabLines, selectedLine]);

  // Handle Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // Auto carousel effect for War Room (rotates lines every 10 seconds if enabled)
  useEffect(() => {
    if (!autoRotate || !isOpen || activeLinesList.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentLineIndex((prev) => (prev + 1) % activeLinesList.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRotate, isOpen, activeLinesList.length]);

  // Current active line in presentation
  const viewingLine = activeLinesList[currentLineIndex] || selectedLine;

  // Calculate Metrics for viewingLine
  const currentLineStats = useMemo(() => {
    const lineObj = spreadsheetData[viewingLine] || {};
    let totalRegister = 0;
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalOtHours = 0;
    let totalNormalHours = 0;
    let workDaysCount = 0;
    const dailyTrend: Array<{
      day: number;
      present: number;
      absent: number;
      register: number;
      ot: number;
      isHoliday: boolean;
      status: "good" | "warning" | "danger" | "off";
    }> = [];

    displayDays.forEach((day) => {
      const d = lineObj[day] || {};
      const reg = Number(d.opRegister) || 0;
      const present = Number(d.swipeCards) || 0;
      const absent = Number(d.notWorking) || 0;
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

      if (reg > 0 || present > 0) {
        workDaysCount++;
        totalRegister += reg;
        totalPresent += present;
        totalAbsent += absent;
        totalNormalHours += normalHr;
        totalOtHours += otHr;
      }

      let status: "good" | "warning" | "danger" | "off" = "off";
      if (!isHoliday && reg > 0) {
        const rate = (present / reg) * 100;
        if (rate >= 95) status = "good";
        else if (rate >= 80) status = "warning";
        else status = "danger";
      }

      dailyTrend.push({
        day,
        present,
        absent,
        register: reg,
        ot: otHr,
        isHoliday,
        status,
      });
    });

    const avgPresent = workDaysCount > 0 ? Math.round(totalPresent / workDaysCount) : 0;
    const avgRegister = workDaysCount > 0 ? Math.round(totalRegister / workDaysCount) : 0;
    const attendanceRate = totalRegister > 0 ? ((totalPresent / totalRegister) * 100).toFixed(1) : "0";
    const absentRate = totalRegister > 0 ? ((totalAbsent / totalRegister) * 100).toFixed(1) : "0";
    const otRatio = (totalNormalHours + totalOtHours) > 0
      ? Number(((totalOtHours / (totalNormalHours + totalOtHours)) * 100).toFixed(1))
      : 0;

    return {
      workDaysCount,
      avgPresent,
      avgRegister,
      attendanceRate,
      absentRate,
      totalOtHours: Math.round(totalOtHours),
      totalNormalHours: Math.round(totalNormalHours),
      totalManHours: Math.round(totalNormalHours + totalOtHours),
      otRatio,
      dailyTrend,
    };
  }, [spreadsheetData, viewingLine, displayDays, manhourCalendar]);

  // Overall Department Ranking / Line Comparisons
  const departmentLineRankings = useMemo(() => {
    return activeLinesList.map((line) => {
      const lineObj = spreadsheetData[line] || {};
      let lineReg = 0;
      let linePresent = 0;
      let lineOt = 0;

      displayDays.forEach((day) => {
        const d = lineObj[day] || {};
        lineReg += Number(d.opRegister) || 0;
        linePresent += Number(d.swipeCards) || 0;
        const ot1 = Number(d.manOT1) || 0;
        const ot2 = Number(d.manOT2) || 0;
        lineOt += ot1 * 3 + ot2 * 11;
      });

      const rate = lineReg > 0 ? Number(((linePresent / lineReg) * 100).toFixed(1)) : 0;
      return {
        line,
        rate,
        totalPresent: linePresent,
        totalOt: Math.round(lineOt),
      };
    }).sort((a, b) => b.rate - a.rate);
  }, [activeLinesList, spreadsheetData, displayDays]);

  // Dynamic Live Ticker Data
  const tickerItems = useMemo(() => {
    return departmentLineRankings.slice(0, 15).map((d) => ({
      line: d.line,
      rate: d.rate,
      ot: d.totalOt,
      status: d.rate >= 95 ? "optimal" : d.rate >= 80 ? "alert" : "critical",
    }));
  }, [departmentLineRankings]);

  if (!isOpen) return null;

  const attendanceNum = Number(currentLineStats.attendanceRate);
  // Circular gauge calculations (Circumference of r=44 is ~276.46)
  const strokeDashoffset = 276.46 - (276.46 * Math.min(attendanceNum, 100)) / 100;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#030a17] text-slate-100 font-sans backdrop-blur-2xl overflow-hidden animate-in fade-in duration-300 select-none">
      {/* Ambient Cyber Glow Backgrounds */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-600/15 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 right-1/4 h-[500px] w-[500px] rounded-full bg-sky-500/10 blur-[140px]" />

      {/* 🚀 1. Top Command Header Bar */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-blue-800/40 bg-gradient-to-r from-blue-950/90 via-[#071739]/90 to-blue-950/90 px-6 py-3 backdrop-blur-md shadow-lg shadow-black/40">
        <div className="flex items-center gap-4">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-sky-500 to-cyan-400 p-0.5 shadow-lg shadow-sky-500/30">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#05132d]">
              <Flame className="h-6 w-6 text-sky-400 animate-pulse" />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-black text-white ring-2 ring-[#05132d]">
              ✓
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-sky-950/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-sky-300 border border-sky-500/30 shadow-xs">
                <span className="h-2 w-2 rounded-full bg-sky-400 animate-ping" />
                SMART FACTORY WAR ROOM
              </span>
              <span className="rounded-md bg-blue-900/60 px-2 py-0.5 text-[11px] font-bold text-sky-200 border border-blue-700/40">
                Month: {selectedMonth}
              </span>
              <span className="rounded-md bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/40">
                Data Synced: {currentLineStats.workDaysCount} วันทำงาน
              </span>
            </div>
            <h1 className="text-xl font-black tracking-wide text-white flex items-center gap-3 mt-0.5">
              <span className="bg-gradient-to-r from-white via-sky-100 to-sky-300 bg-clip-text text-transparent">
                {activeTab} &mdash; {viewingLine}
              </span>
              {isAggregateLine(viewingLine, activeTab) ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-950/90 px-2.5 py-0.5 text-[10px] font-mono font-bold text-indigo-300 border border-indigo-500/50 shadow-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  PROCESS SUMMARY
                </span>
              ) : isShiftLine(viewingLine) ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-950/90 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-sky-200 border border-blue-700/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  SHIFT {viewingLine.match(/\/([ABD])\s*$/i)?.[1]?.toUpperCase() || ""}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/90 px-2.5 py-0.5 text-[10px] font-mono font-bold text-slate-200 border border-slate-700/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  PRODUCTION LINE
                </span>
              )}
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-900/40 text-sky-300/80 border border-blue-800/60">
                Line {currentLineIndex + 1} of {activeLinesList.length}
              </span>
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Auto Rotate Toggle */}
          <button
            type="button"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-black transition-all border cursor-pointer ${
              autoRotate
                ? "bg-sky-500/20 text-sky-300 border-sky-400 shadow-md shadow-sky-500/20 ring-1 ring-sky-400/50 animate-pulse"
                : "bg-blue-950/80 text-blue-200 border-blue-800/60 hover:bg-blue-900 hover:text-white"
            }`}
            title="สลับหมุนเวียนแต่ละไลน์อัตโนมัติทุก 10 วินาที"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${autoRotate ? "animate-spin" : ""}`} />
            <span>Auto Cycle {autoRotate ? "ON (10s)" : "OFF"}</span>
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-950/80 px-3.5 py-1.5 text-xs font-bold text-blue-200 border border-blue-800/60 hover:bg-blue-900 hover:text-white transition-all cursor-pointer"
            title="เต็มหน้าจอ (Fullscreen)"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-rose-950/40 p-2 text-rose-300 border border-rose-800/50 hover:bg-rose-900/70 hover:text-white transition-all cursor-pointer shadow-sm"
            title="ปิดหน้าจอ War Room"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* 🚀 2. Main Visual Cockpit Grid */}
      <div className="relative z-10 flex-1 grid grid-cols-12 gap-5 p-5 overflow-hidden">
        {/* Left 8 Cols: Cockpit Radial Gauges + Matrix Heatmap + Rhythm Waves */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-4 overflow-y-auto pr-1">
          {/* Top Row: 3D Radial Speedometer & Key Cockpit Cards */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Speedometer Gauge: Attendance Rate (5 Cols) */}
            <div className="md:col-span-5 relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-b from-[#091f4a]/90 via-[#07173b]/90 to-[#040e24]/90 p-4 shadow-xl shadow-blue-950/40 flex items-center justify-between">
              <div className="flex flex-col justify-between h-full">
                <div>
                  <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-sky-300">
                    <Activity className="h-3.5 w-3.5 text-sky-400" /> Attendance Gauge
                  </span>
                  <h3 className="text-sm font-bold text-white mt-0.5">ดัชนีความพร้อมกำลังคน</h3>
                </div>

                <div className="mt-2">
                  <span className={`text-4xl font-black tracking-tight ${attendanceNum >= 95 ? "text-emerald-300" : attendanceNum >= 80 ? "text-sky-300" : "text-amber-300"}`}>
                    {currentLineStats.attendanceRate}%
                  </span>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-blue-200/80">
                    {attendanceNum >= 95 ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> ผ่านเกณฑ์มาตรฐาน
                      </span>
                    ) : (
                      <span className="text-amber-300 font-bold flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> ต่ำกว่าเป้า 95.0%
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-blue-300/60 mt-1">
                  เฉลี่ยมาทำงาน {currentLineStats.avgPresent} จาก {currentLineStats.avgRegister} OP
                </div>
              </div>

              {/* Radial Donut Dial SVG */}
              <div className="relative flex items-center justify-center shrink-0 w-28 h-28">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="transparent"
                    stroke="#0e2a5c"
                    strokeWidth="10"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="transparent"
                    stroke={attendanceNum >= 95 ? "#10b981" : attendanceNum >= 80 ? "#38bdf8" : "#f59e0b"}
                    strokeWidth="10"
                    strokeDasharray="276.46"
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-lg font-black text-white">{Math.round(attendanceNum)}%</span>
                  <span className="text-[8px] uppercase tracking-wider text-sky-400 font-bold">KPI</span>
                </div>
              </div>
            </div>

            {/* Middle 3 Cards (7 Cols) */}
            <div className="md:col-span-7 grid grid-cols-3 gap-3">
              {/* Card 1: Active Present */}
              <div className="relative overflow-hidden rounded-2xl border border-blue-800/50 bg-[#091b3e]/70 p-3.5 shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-sky-300">
                  <span className="text-[10px] font-black uppercase">Present</span>
                  <Users className="h-3.5 w-3.5 text-sky-400" />
                </div>
                <div className="my-1">
                  <span className="text-2xl font-black text-white">{currentLineStats.avgPresent}</span>
                  <span className="text-[10px] text-blue-300/80 ml-1">/ {currentLineStats.avgRegister} คน</span>
                </div>
                <div className="h-1.5 w-full bg-blue-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-400 transition-all duration-500"
                    style={{ width: `${currentLineStats.avgRegister > 0 ? (currentLineStats.avgPresent / currentLineStats.avgRegister) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Card 2: Overtime Hours */}
              <div className="relative overflow-hidden rounded-2xl border border-blue-800/50 bg-[#091b3e]/70 p-3.5 shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-amber-300">
                  <span className="text-[10px] font-black uppercase">Total OT</span>
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <div className="my-1">
                  <span className="text-2xl font-black text-amber-300">{currentLineStats.totalOtHours}</span>
                  <span className="text-[10px] text-blue-300/80 ml-1">ชม.</span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-blue-200/70">
                  <span>OT Ratio</span>
                  <span className="font-bold text-amber-300">{currentLineStats.otRatio}%</span>
                </div>
              </div>

              {/* Card 3: Leave / Absent */}
              <div className="relative overflow-hidden rounded-2xl border border-blue-800/50 bg-[#091b3e]/70 p-3.5 shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-rose-300">
                  <span className="text-[10px] font-black uppercase">Leave Rate</span>
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                </div>
                <div className="my-1">
                  <span className="text-2xl font-black text-rose-300">{currentLineStats.absentRate}%</span>
                </div>
                <div className="text-[9px] text-blue-200/70 truncate">
                  {Number(currentLineStats.absentRate) > 5 ? "⚠️ เกินเกณฑ์ 5%" : "✓ อยู่ในเกณฑ์ปกติ"}
                </div>
              </div>
            </div>
          </div>

          {/* 🌟 Middle Section: 31-Day Manpower Floor Heatmap Matrix (เต็มตา ไม่โล่ง!) */}
          <div className="rounded-2xl border border-blue-800/40 bg-gradient-to-b from-[#07193d]/80 to-[#05112a]/80 p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-3 border-b border-blue-800/40 pb-2.5">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-sky-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  Monthly Factory Floor Attendance Heatmap ({selectedMonth})
                </h3>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="h-2 w-2 rounded-xs bg-emerald-500" /> &ge; 95% Normal
                </span>
                <span className="flex items-center gap-1 text-amber-300">
                  <span className="h-2 w-2 rounded-xs bg-amber-400" /> 80-94% Under Target
                </span>
                <span className="flex items-center gap-1 text-rose-400">
                  <span className="h-2 w-2 rounded-xs bg-rose-500" /> &lt; 80% Critical
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <span className="h-2 w-2 rounded-xs bg-blue-950" /> Holiday / Off
                </span>
              </div>
            </div>

            {/* Heatmap Grid Cells */}
            <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-16 gap-1.5">
              {currentLineStats.dailyTrend.map((d) => {
                const hasData = d.register > 0 || d.present > 0;
                return (
                  <div
                    key={d.day}
                    className={`group relative flex flex-col items-center justify-between p-2 rounded-xl border transition-all hover:scale-105 cursor-pointer ${
                      !hasData || d.isHoliday
                        ? "bg-blue-950/30 border-blue-900/30 text-blue-300/40"
                        : d.status === "good"
                          ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:border-emerald-400"
                          : d.status === "warning"
                            ? "bg-amber-950/30 border-amber-500/40 text-amber-200 hover:border-amber-400"
                            : "bg-rose-950/40 border-rose-500/40 text-rose-300 hover:border-rose-400"
                    }`}
                  >
                    <span className="text-[10px] font-bold text-blue-300/70">D{d.day}</span>
                    <span className="text-xs font-black mt-0.5">
                      {hasData ? `${d.present}` : "-"}
                    </span>
                    <span className="text-[8px] font-bold uppercase opacity-80">
                      {hasData ? (d.register > 0 ? `${Math.round((d.present / d.register) * 100)}%` : "") : "Off"}
                    </span>

                    {/* Popover Tooltip */}
                    <div className="pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2 z-50 hidden group-hover:flex flex-col items-center rounded-lg bg-[#07132a] border border-blue-600 px-2.5 py-1 text-[10px] text-white shadow-xl whitespace-nowrap">
                      <span className="font-bold text-sky-300">วันที่ {d.day} {selectedMonth}</span>
                      <span>มาทำงาน: {d.present} / ลงทะเบียน: {d.register} OP</span>
                      <span>OT: {d.ot} ชม. &bull; ขาด/ลา: {d.absent} คน</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 🌟 Bottom Wave Chart: High-Contrast Daily Trend Rhythm */}
          <div className="flex-1 rounded-2xl border border-blue-800/40 bg-gradient-to-b from-[#07193d]/80 to-[#05112a]/80 p-4 shadow-xl backdrop-blur-md flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-sky-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  Daily Workforce Dynamic Rhythm (Day 1 - {displayDays.length})
                </h3>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-sky-400">
                  <span className="h-2.5 w-2.5 rounded-xs bg-sky-400 shadow-xs shadow-sky-400/50" /> Present (คน)
                </span>
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="h-2.5 w-2.5 rounded-xs bg-rose-500 shadow-xs shadow-rose-500/50" /> Absent (คน)
                </span>
              </div>
            </div>

            {/* Glowing Column Representation with Reflection Base */}
            <div className="flex items-end gap-1.5 h-36 pt-4 pb-1 border-b border-blue-800/40">
              {currentLineStats.dailyTrend.map((d) => {
                const maxVal = Math.max(...currentLineStats.dailyTrend.map((t) => t.present + t.absent), 1);
                const presentHeight = (d.present / maxVal) * 100;
                const absentHeight = (d.absent / maxVal) * 100;

                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    <div className="w-full flex flex-col items-center justify-end h-full">
                      {d.absent > 0 && (
                        <div
                          className="w-full bg-rose-500 rounded-t-xs shadow-sm shadow-rose-500/40"
                          style={{ height: `${absentHeight}%` }}
                        />
                      )}
                      <div
                        className={`w-full ${d.present > 0 ? "bg-gradient-to-t from-blue-600 via-sky-500 to-cyan-400 shadow-md shadow-sky-500/30" : "bg-blue-950/40"} ${d.absent === 0 ? "rounded-t-xs" : ""}`}
                        style={{ height: `${Math.max(presentHeight, 4)}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-blue-300/60 mt-1">{d.day}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Executive Leaderboard & Insights */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-3.5 overflow-hidden rounded-2xl border border-blue-800/40 bg-gradient-to-b from-[#07193d]/90 to-[#040e24]/90 p-4 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-blue-800/40 pb-3">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-400" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  Line Leaderboard
                </h3>
                <span className="text-[10px] text-blue-200/70">จัดอันดับ % Attendance ในแผนก</span>
              </div>
            </div>
            <span className="rounded-md bg-blue-900/60 px-2 py-0.5 text-[11px] font-bold text-sky-200 border border-blue-700/40">
              {departmentLineRankings.length} Lines
            </span>
          </div>

          {/* Scrollable Leaderboard List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {departmentLineRankings.map((item, index) => {
              const isSelected = item.line === viewingLine;
              return (
                <button
                  key={item.line}
                  type="button"
                  onClick={() => setCurrentLineIndex(activeLinesList.indexOf(item.line))}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer text-left ${
                    isSelected
                      ? "bg-gradient-to-r from-blue-900/90 to-sky-950/90 border-sky-400 shadow-lg shadow-sky-500/20 ring-1 ring-sky-400/50"
                      : "bg-[#061432]/60 border-blue-900/40 hover:bg-blue-900/40 hover:border-blue-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black shrink-0 ${
                        index === 0
                          ? "bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-xs"
                          : index === 1
                            ? "bg-slate-300 text-slate-950 font-bold"
                            : index === 2
                              ? "bg-amber-700 text-white font-bold"
                              : "bg-blue-900/60 text-blue-300"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="truncate max-w-[170px]">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                        <span className="truncate">{item.line}</span>
                        {isAggregateLine(item.line, activeTab) ? (
                          <span className="rounded bg-indigo-950 px-1 py-0.2 text-[8px] font-mono font-bold text-indigo-300 border border-indigo-600/40 shrink-0">
                            รวมคน
                          </span>
                        ) : isShiftLine(item.line) ? (
                          <span className="rounded bg-blue-950 px-1 py-0.2 text-[8px] font-mono font-medium text-sky-300 border border-blue-700/40 shrink-0">
                            กะ
                          </span>
                        ) : (
                          <span className="rounded bg-slate-900 px-1 py-0.2 text-[8px] font-mono font-bold text-slate-200 border border-slate-700/40 shrink-0">
                            ไลน์
                          </span>
                        )}
                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-ping shrink-0" />}
                      </div>
                      <div className="text-[10px] text-blue-200/60">
                        {item.totalPresent.toLocaleString()} Present &bull; {item.totalOt} OT Hrs
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-sm font-black ${item.rate >= 95 ? "text-emerald-400" : item.rate >= 80 ? "text-sky-300" : "text-amber-400"}`}>
                      {item.rate}%
                    </span>
                    <span className="block text-[8px] uppercase tracking-wider text-blue-300/60 font-bold">Rate</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="border-t border-blue-800/40 pt-2 text-[10px] text-blue-300/60 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Real-time Sync Active
            </span>
            <span className="font-mono text-[10px]">{lastRefreshedTime.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* 🚀 3. Bottom Factory Live Feed Ticker (เหมือนแถบตัววิ่งในห้องข่าวธุรกิจ) */}
      <footer className="relative z-10 shrink-0 border-t border-blue-800/40 bg-[#040d21] px-4 py-2 flex items-center gap-4 overflow-hidden">
        <div className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded bg-blue-900/60 text-[10px] font-black text-sky-300 border border-blue-700/50 uppercase tracking-wider">
          <Sparkles className="h-3 w-3 text-sky-400" /> LIVE TICKER
        </div>
        <div className="flex-1 overflow-x-auto no-scrollbar flex items-center gap-6 text-[11px] whitespace-nowrap">
          {tickerItems.map((item) => (
            <span key={item.line} className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${item.status === "optimal" ? "bg-emerald-400" : item.status === "alert" ? "bg-sky-400" : "bg-amber-400"}`} />
              <span className="font-bold text-white">{item.line}:</span>
              <span className={item.rate >= 95 ? "text-emerald-300 font-bold" : "text-sky-300 font-bold"}>{item.rate}%</span>
              <span className="text-blue-300/60">({item.ot}h OT)</span>
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}
