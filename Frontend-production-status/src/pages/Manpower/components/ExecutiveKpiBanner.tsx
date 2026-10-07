import React, { useState, useMemo } from "react";
import {
  Users,
  UserCheck,
  Clock,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
} from "lucide-react";
import { isAggregateLine, isShiftLine } from "../utils/lineClassification";

interface ExecutiveKpiBannerProps {
  selectedLine: string;
  activeTab: string;
  selectedMonth: string;
  displayDays: number[];
  calculatedRows: Record<number, any>;
  rowSums: Record<string, any>;
}

/**
 * Creative Tim Smooth Bezier Curved Line / Area Chart (SVG)
 */
function CreativeTimCurvedChart({
  data,
  displayDays = [],
  color = "#2563eb",
  gradientId,
  unit = "",
}: {
  data: number[];
  displayDays?: number[];
  color?: string;
  gradientId: string;
  unit?: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length < 2) {
    return (
      <div className="flex h-28 items-center justify-center text-xs font-bold text-slate-400">
        No trend data available
      </div>
    );
  }

  const width = 460;
  const height = 96;
  const paddingX = 12;
  const paddingTop = 12;
  const paddingBottom = 16;
  const effectiveH = height - paddingTop - paddingBottom;
  const effectiveW = width - paddingX * 2;

  const maxVal = Math.max(...data, 1);
  const minVal = Math.min(...data, 0);
  const range = maxVal - minVal || 1;

  const points: [number, number][] = data.map((val, idx) => {
    const x = paddingX + (idx / (data.length - 1)) * effectiveW;
    const y = paddingTop + effectiveH - ((val - minVal) / range) * effectiveH;
    return [x, y];
  });

  // Calculate smooth Cubic Bezier Path
  let pathD = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    pathD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }

  const areaD = `${pathD} L ${points[points.length - 1][0].toFixed(1)} ${height - paddingBottom} L ${points[0][0].toFixed(1)} ${height - paddingBottom} Z`;

  const hoveredVal = hoveredIndex !== null ? data[hoveredIndex] : null;
  const hoveredDay =
    hoveredIndex !== null && Array.isArray(displayDays)
      ? displayDays[hoveredIndex] ?? null
      : null;

  return (
    <div className="relative w-full overflow-hidden select-none">
      {/* Floating value pill when hovering */}
      <div className="flex h-5 items-center justify-between px-1 text-[11px] font-mono">
        <span className="text-slate-400">
          {hoveredDay !== null ? `Day ${hoveredDay}:` : "Monthly Range:"}
        </span>
        <span className="font-bold" style={{ color }}>
          {hoveredVal !== null ? `${hoveredVal.toLocaleString()} ${unit}` : `Min ${minVal.toLocaleString()} - Max ${maxVal.toLocaleString()} ${unit}`}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-24 overflow-visible"
        preserveAspectRatio="none"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="90%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal Dashed Subtle Grid Lines (Creative Tim style) */}
        <line
          x1={paddingX}
          y1={paddingTop}
          x2={width - paddingX}
          y2={paddingTop}
          stroke="#f1f5f9"
          strokeDasharray="4 4"
          strokeWidth="1"
        />
        <line
          x1={paddingX}
          y1={paddingTop + effectiveH / 2}
          x2={width - paddingX}
          y2={paddingTop + effectiveH / 2}
          stroke="#f1f5f9"
          strokeDasharray="4 4"
          strokeWidth="1"
        />
        <line
          x1={paddingX}
          y1={height - paddingBottom}
          x2={width - paddingX}
          y2={height - paddingBottom}
          stroke="#e2e8f0"
          strokeWidth="1"
        />

        {/* Gradient Area Fill */}
        <path d={areaD} fill={`url(#${gradientId})`} />

        {/* Smooth Curved Line */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interactive Hover Hitboxes and Points */}
        {points.map(([px, py], i) => (
          <g key={i} className="cursor-pointer" onMouseEnter={() => setHoveredIndex(i)}>
            {/* Transparent Hitbox */}
            <rect
              x={px - (effectiveW / data.length) / 2}
              y={0}
              width={effectiveW / data.length}
              height={height}
              fill="transparent"
            />
            {/* Active circle marker */}
            {hoveredIndex === i && (
              <>
                <line
                  x1={px}
                  y1={paddingTop}
                  x2={px}
                  y2={height - paddingBottom}
                  stroke={color}
                  strokeDasharray="2 2"
                  strokeWidth="1"
                  opacity="0.6"
                />
                <circle
                  cx={px}
                  cy={py}
                  r="4.5"
                  fill="#ffffff"
                  stroke={color}
                  strokeWidth="2.5"
                />
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

/**
 * Creative Tim Daily Rounded Bar Chart (SVG)
 */
function CreativeTimBarChart({
  data,
  displayDays = [],
  benchmark = 95,
  regData,
}: {
  data: number[];
  displayDays?: number[];
  benchmark?: number;
  regData?: number[];
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length < 2) return null;

  const width = 460;
  const height = 96;
  const paddingX = 12;
  const paddingTop = 12;
  const paddingBottom = 16;
  const effectiveH = height - paddingTop - paddingBottom;
  const effectiveW = width - paddingX * 2;

  const maxVal = Math.max(...data, 100);
  const minVal = 0;
  const barWidth = Math.max(3, (effectiveW / data.length) * 0.65);

  const hoveredVal = hoveredIndex !== null ? data[hoveredIndex] : null;
  const hoveredDay =
    hoveredIndex !== null && Array.isArray(displayDays)
      ? displayDays[hoveredIndex] ?? null
      : null;
  const hoveredHasReg =
    hoveredIndex !== null && regData ? (regData[hoveredIndex] || 0) > 0 : true;

  const benchmarkY =
    paddingTop + effectiveH - ((benchmark - minVal) / (maxVal - minVal)) * effectiveH;

  return (
    <div className="relative w-full overflow-hidden select-none">
      <div className="flex h-5 items-center justify-between px-1 text-[11px] font-mono">
        <span className="text-slate-400">
          {hoveredDay !== null ? `Day ${hoveredDay}:` : "Monthly Benchmark:"}
        </span>
        <span className="font-bold text-emerald-600">
          {hoveredVal !== null
            ? hoveredHasReg
              ? `${hoveredVal.toFixed(1)}%`
              : "Off / Rest"
            : `Target ${benchmark}.0%`}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-24 overflow-visible"
        preserveAspectRatio="none"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {/* Horizontal Dashed Grid & Benchmark */}
        <line
          x1={paddingX}
          y1={benchmarkY}
          x2={width - paddingX}
          y2={benchmarkY}
          stroke="#10b981"
          strokeDasharray="3 3"
          strokeWidth="1.2"
          opacity="0.8"
        />
        <line
          x1={paddingX}
          y1={height - paddingBottom}
          x2={width - paddingX}
          y2={height - paddingBottom}
          stroke="#e2e8f0"
          strokeWidth="1"
        />

        {/* Bars */}
        {data.map((val, idx) => {
          const hasReg = regData ? (regData[idx] || 0) > 0 : val > 0;
          const barH = hasReg ? Math.max(4, (val / maxVal) * effectiveH) : 2;
          const x =
            paddingX + (idx / (data.length - 1 || 1)) * effectiveW - barWidth / 2;
          const y = paddingTop + effectiveH - barH;
          const isTargetMet = val >= benchmark;
          const barColor = !hasReg
            ? "#cbd5e1"
            : isTargetMet
              ? "#10b981"
              : val >= 85
                ? "#0284c7"
                : "#f43f5e";
          const isHovered = hoveredIndex === idx;

          return (
            <g
              key={idx}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIndex(idx)}
            >
              <rect
                x={x - 2}
                y={0}
                width={barWidth + 4}
                height={height}
                fill="transparent"
              />
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={2}
                ry={2}
                fill={barColor}
                opacity={isHovered ? 1 : hasReg ? 0.85 : 0.4}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function ExecutiveKpiBanner({
  selectedLine,
  activeTab,
  selectedMonth,
  displayDays,
  calculatedRows,
  rowSums,
}: ExecutiveKpiBannerProps) {
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | "all">("all");

  const { kpiStats, chartData, activeDays } = useMemo(() => {
    // Determine active recorded days in month to prevent sparkline cliff drops for future unrecorded days
    let maxRecordedIdx = -1;
    displayDays.forEach((day, idx) => {
      const r = calculatedRows[day] || {};
      const reg = Number(r.r1) || 0;
      const present = Number(r.r2) || 0;
      const ot = Number(r.r15) || 0;
      if (reg > 0 || present > 0 || ot > 0) {
        maxRecordedIdx = idx;
      }
    });

    const activeDays = maxRecordedIdx >= 1 ? displayDays.slice(0, maxRecordedIdx + 1) : displayDays;

    const presentTrend: number[] = [];
    const regTrend: number[] = [];
    const absentTrend: number[] = [];
    const otTrend: number[] = [];
    const attendanceTrend: number[] = [];

    activeDays.forEach((day) => {
      const r = calculatedRows[day] || {};
      const reg = Number(r.r1) || 0;
      const present = Number(r.r2) || 0;
      const absent = Number(r.r3) || 0;
      const ot = Number(r.r15) || 0;

      presentTrend.push(present);
      regTrend.push(reg);
      absentTrend.push(absent);
      otTrend.push(ot);

      const rate = reg > 0 ? Number(((present / reg) * 100).toFixed(1)) : 0;
      attendanceTrend.push(rate);
    });

    if (selectedDayFilter !== "all") {
      const row = calculatedRows[selectedDayFilter] || {};
      const reg = Number(row.r1) || 0;
      const present = Number(row.r2) || 0;
      const absent = Number(row.r3) || 0;
      const otHr = Number(row.r15) || 0;
      const normalHr = Number(row.r14) || 0;
      const totalManHours = normalHr + otHr;

      const attendanceRateNum =
        reg > 0 ? Number(((present / reg) * 100).toFixed(1)) : 0;
      const absentRateNum =
        reg > 0 ? Number(((absent / reg) * 100).toFixed(1)) : 0;
      const otRatioNum =
        totalManHours > 0 ? Number(((otHr / totalManHours) * 100).toFixed(1)) : 0;
      const otCostEst = Math.round(otHr * 150);

      return {
        activeDays,
        chartData: { presentTrend, regTrend, absentTrend, otTrend, attendanceTrend },
        kpiStats: {
          isSingleDay: true,
          selectedDay: selectedDayFilter,
          avgPresent: present,
          avgRegister: reg,
          avgAbsent: absent,
          attendanceRateNum,
          absentRateNum,
          targetVariance: Number((attendanceRateNum - 95.0).toFixed(1)),
          totalOtHours: Math.round(otHr),
          otCostEst,
          otRatioNum,
        },
      };
    }

    let workingDaysCount = 0;
    let totalPresentSum = 0;
    let totalRegisterSum = 0;
    let totalAbsentSum = 0;
    let totalOtHours = 0;
    let totalNormalHours = 0;

    displayDays.forEach((day) => {
      const row = calculatedRows[day];
      if (!row) return;
      const reg = Number(row.r1) || 0;
      const present = Number(row.r2) || 0;
      const absent = Number(row.r3) || 0;
      const otHr = Number(row.r15) || 0;
      const normalHr = Number(row.r14) || 0;

      if (reg > 0 || present > 0) {
        workingDaysCount++;
        totalRegisterSum += reg;
        totalPresentSum += present;
        totalAbsentSum += absent;
        totalOtHours += otHr;
        totalNormalHours += normalHr;
      }
    });

    const avgPresent =
      workingDaysCount > 0 ? Math.round(totalPresentSum / workingDaysCount) : 0;
    const avgRegister =
      workingDaysCount > 0 ? Math.round(totalRegisterSum / workingDaysCount) : 0;
    const avgAbsent =
      workingDaysCount > 0 ? Math.round(totalAbsentSum / workingDaysCount) : 0;

    const attendanceRateNum =
      totalRegisterSum > 0
        ? Number(((totalPresentSum / totalRegisterSum) * 100).toFixed(1))
        : 0;
    const absentRateNum =
      totalRegisterSum > 0
        ? Number(((totalAbsentSum / totalRegisterSum) * 100).toFixed(1))
        : 0;
    const totalManHours = totalNormalHours + totalOtHours;
    const otRatioNum =
      totalManHours > 0 ? Number(((totalOtHours / totalManHours) * 100).toFixed(1)) : 0;
    const otCostEst = Math.round(totalOtHours * 150);

    return {
      activeDays,
      chartData: { presentTrend, regTrend, absentTrend, otTrend, attendanceTrend },
      kpiStats: {
        isSingleDay: false,
        selectedDay: null,
        avgPresent,
        avgRegister,
        avgAbsent,
        attendanceRateNum,
        absentRateNum,
        targetVariance: Number((attendanceRateNum - 95.0).toFixed(1)),
        totalOtHours: Math.round(totalOtHours),
        otCostEst,
        otRatioNum,
      },
    };
  }, [calculatedRows, displayDays, selectedDayFilter]);

  const isMasterLine = isAggregateLine(selectedLine, activeTab);

  return (
    <div className="w-full space-y-3">
      {/* 🔹 Top Context Toolbar (Clean Factory Theme) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-500/20">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-blue-600">
                EXECUTIVE TELEMETRY
              </span>
              <span className="text-slate-300">&bull;</span>
              <span className="font-mono text-xs font-bold text-slate-800">
                {activeTab} / {selectedLine}
              </span>
              {isMasterLine ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                  PROCESS SUMMARY
                </span>
              ) : isShiftLine(selectedLine) ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-200">
                  SHIFT LINE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  PRODUCTION LINE
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Period Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500">Period:</span>
          <select
            aria-label="Select Date Period"
            value={selectedDayFilter}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedDayFilter(val === "all" ? "all" : Number(val));
            }}
            className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 outline-none hover:bg-slate-100 focus:border-blue-500 transition-colors"
          >
            <option value="all">Full Month ({displayDays.length} Days)</option>
            {displayDays.map((d) => (
              <option key={d} value={d}>
                Date {d} ({selectedMonth})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 🌟 Creative Tim Chart Trio (col-lg-4 x 3) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Working Headcount (Smooth Curved Area Chart) */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-blue-300">
          <div className="flex items-center justify-between">
            <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-sans">
              TOTAL WORKING STRENGTH
            </h5>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black tracking-tight text-slate-900 font-mono">
                {kpiStats.avgPresent.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {kpiStats.isSingleDay ? "OP" : "OP/D"}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-700 border border-blue-200">
              Pool: {kpiStats.avgRegister.toLocaleString()}
            </span>
          </div>

          {/* Smooth Curved Line Chart with Gradient Fill */}
          <div className="mt-3">
            <CreativeTimCurvedChart
              data={chartData.presentTrend}
              displayDays={activeDays || displayDays || []}
              color="#2563eb"
              gradientId="kpi-present-gradient"
              unit="OP"
            />
          </div>
        </div>

        {/* Card 2: Daily Attendance Rate (Clean Rounded Bar Chart) */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-emerald-300">
          <div className="flex items-center justify-between">
            <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-sans">
              DAILY ATTENDANCE RATE
            </h5>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-2xl font-black tracking-tight font-mono ${
                  kpiStats.attendanceRateNum >= 95
                    ? "text-emerald-600"
                    : kpiStats.attendanceRateNum >= 85
                      ? "text-blue-600"
                      : "text-rose-600"
                }`}
              >
                {kpiStats.attendanceRateNum}%
              </span>
              <span className="text-xs font-semibold text-slate-500">Benchmark: 95%</span>
            </div>
            <span
              className={`inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[10px] font-mono font-bold border ${
                kpiStats.targetVariance >= 0
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {kpiStats.targetVariance >= 0 ? (
                <>
                  <ArrowUpRight className="h-3 w-3" /> +{kpiStats.targetVariance}%
                </>
              ) : (
                <>
                  <ArrowDownRight className="h-3 w-3" /> {kpiStats.targetVariance}%
                </>
              )}
            </span>
          </div>

          {/* Daily Bar Chart */}
          <div className="mt-3">
            <CreativeTimBarChart
              data={chartData.attendanceTrend}
              displayDays={activeDays || displayDays || []}
              regData={chartData.regTrend}
              benchmark={95}
            />
          </div>
        </div>

        {/* Card 3: Overtime & Financial Exposure (Curved Line Chart) */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-amber-300">
          <div className="flex items-center justify-between">
            <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-sans">
              OVERTIME EXPOSURE & COST
            </h5>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black tracking-tight text-slate-900 font-mono">
                {kpiStats.totalOtHours.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-slate-500">Hrs</span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-800 border border-amber-200">
              THB {(kpiStats.otCostEst / 1000).toFixed(1)}k Est.
            </span>
          </div>

          {/* Smooth Curved Line Chart with Amber Gradient */}
          <div className="mt-3">
            <CreativeTimCurvedChart
              data={chartData.otTrend}
              displayDays={activeDays || displayDays || []}
              color="#d97706"
              gradientId="kpi-ot-gradient"
              unit="Hrs"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
