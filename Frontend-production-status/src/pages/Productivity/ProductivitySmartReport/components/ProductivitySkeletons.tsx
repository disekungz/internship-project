import React from "react";

/**
 * Skeleton loader for Productivity Summary KPI Cards (Output, Total Man Hour, Acc Productivity)
 */
export const SmartReportSummaryCardsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
      {/* Card 1: Output Skeleton */}
      <div className="relative overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-b from-sky-50/60 via-white to-white p-5 shadow-xs">
        <div className="absolute inset-x-0 top-0 h-1 bg-sky-400" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-3 w-24 bg-sky-200/70 rounded" />
            <div className="flex items-baseline gap-2">
              <div className="h-8 w-36 bg-slate-200 rounded font-mono" />
              <div className="h-5 w-12 bg-sky-100 rounded-md border border-sky-200/60" />
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-sky-100">
              <div className="h-5 w-16 bg-slate-100 rounded border border-slate-200/60" />
              <div className="h-5 w-16 bg-slate-100 rounded border border-slate-200/60" />
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl border border-sky-200 bg-white/80 shrink-0" />
        </div>
      </div>

      {/* Card 2: Total Man Hour Skeleton */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50/60 via-white to-white p-5 shadow-xs">
        <div className="absolute inset-x-0 top-0 h-1 bg-amber-400" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-3 w-28 bg-amber-200/70 rounded" />
            <div className="flex items-baseline gap-2">
              <div className="h-8 w-32 bg-slate-200 rounded font-mono" />
              <div className="h-5 w-10 bg-amber-100 rounded-md border border-amber-200/60" />
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-amber-100">
              <div className="h-5 w-24 bg-slate-100 rounded border border-slate-200/60" />
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl border border-amber-200 bg-white/80 shrink-0" />
        </div>
      </div>

      {/* Card 3: Acc Productivity Skeleton */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/60 via-white to-white p-5 shadow-xs">
        <div className="absolute inset-x-0 top-0 h-1 bg-emerald-400" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-3 w-32 bg-emerald-200/70 rounded" />
            <div className="flex items-baseline gap-2">
              <div className="h-8 w-24 bg-slate-200 rounded font-mono" />
              <div className="h-5 w-16 bg-emerald-100 rounded-md border border-emerald-200/60" />
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-emerald-100">
              <div className="h-5 w-28 bg-slate-100 rounded border border-slate-200/60" />
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl border border-emerald-200 bg-white/80 shrink-0" />
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton loader for Productivity Chart
 */
export const ProductivityChartSkeleton: React.FC = () => {
  // Staggered realistic bar heights for 25 production days
  const barHeights = [
    68, 85, 45, 78, 92, 60, 58, 72, 64, 70,
    66, 68, 75, 77, 72, 79, 74, 88, 100, 80,
    76, 88, 82, 78, 86
  ];

  return (
    <div className="relative z-10 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-pulse">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/80 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-6 w-56 bg-slate-300 rounded-md" />
            <div className="h-5 w-14 bg-slate-200 rounded-full" />
          </div>
          {/* Stat Pills */}
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="h-6 w-28 bg-emerald-100/70 rounded-full border border-emerald-200" />
            <div className="h-6 w-32 bg-sky-100/70 rounded-full border border-sky-200" />
            <div className="h-6 w-28 bg-indigo-100/70 rounded-full border border-indigo-200" />
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Unit pill skeleton */}
          <div className="h-8 w-28 bg-slate-200/80 rounded-lg" />
          {/* Mode pill skeleton */}
          <div className="h-8 w-44 bg-slate-200/80 rounded-lg" />
          {/* Option pill skeleton */}
          <div className="h-8 w-20 bg-slate-200/80 rounded-lg" />
        </div>
      </div>

      {/* Series Toggles Skeleton */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50/40">
        <div className="h-6 w-40 bg-slate-200/70 rounded-lg" />
        <div className="h-6 w-36 bg-slate-200/70 rounded-lg" />
        <div className="h-6 w-28 bg-slate-200/70 rounded-lg" />
      </div>

      {/* Chart Canvas Area Skeleton */}
      <div className="p-6">
        <div className="flex items-end gap-2 md:gap-3 h-[380px] w-full border-b border-l border-slate-200 pb-2 pl-3 relative">
          {/* Horizontal Grid lines */}
          <div className="absolute inset-x-0 top-[25%] border-b border-dashed border-slate-100" />
          <div className="absolute inset-x-0 top-[50%] border-b border-dashed border-slate-100" />
          <div className="absolute inset-x-0 top-[75%] border-b border-dashed border-slate-100" />

          {/* Acc Prod Simulated Line Overlay */}
          <svg className="absolute inset-0 w-full h-[360px] pointer-events-none opacity-40 overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 300">
            <path
              d="M 20 180 Q 250 160, 500 130 T 980 110"
              fill="none"
              stroke="#2563eb"
              strokeWidth="3"
              strokeDasharray="6 4"
            />
          </svg>

          {/* Prior Month Bars */}
          <div className="flex gap-1.5 h-full items-end pr-2 border-r border-dashed border-slate-300 mr-2 shrink-0">
            {[1, 2, 3].map(i => (
              <div key={`prior-${i}`} className="w-5 md:w-7 flex flex-col justify-end h-full">
                <div 
                  className="w-full bg-gradient-to-t from-indigo-300/40 via-indigo-200/30 to-indigo-100/20 rounded-t-md" 
                  style={{ height: `${65 + i * 5}%` }}
                />
                <div className="h-2.5 w-6 bg-slate-200 rounded self-center mt-2 opacity-60" />
              </div>
            ))}
          </div>

          {/* Daily Productivity Bars */}
          {barHeights.map((pct, idx) => (
            <div key={`bar-${idx}`} className="flex-1 flex flex-col justify-end h-full min-w-[10px]">
              <div
                className="w-full bg-gradient-to-t from-emerald-400/30 via-emerald-300/20 to-emerald-200/10 rounded-t-md hover:opacity-80 transition-all duration-300"
                style={{ height: `${pct}%` }}
              />
              <div className="h-2 w-5 bg-slate-200/70 rounded self-center mt-2.5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton loader for Productivity Board Matrix Table
 */
export const DailyMatrixTableSkeleton: React.FC = () => {
  const colCount = 14;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg flex flex-col animate-pulse">
      {/* Header Bar */}
      <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row justify-between items-start lg:items-center bg-slate-50 gap-4">
        <div className="flex items-center gap-3">
          <div>
            <div className="h-5 w-48 bg-slate-300 rounded" />
            <div className="h-3.5 w-32 bg-slate-200 rounded mt-1.5" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 w-36 bg-slate-200 rounded-lg" />
          <div className="h-7 w-28 bg-slate-200 rounded-lg" />
        </div>
      </div>

      {/* Table Structure */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          {/* Header Row: Days & Dates */}
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="p-3 w-56 border-r border-slate-200">
                <div className="h-4 w-24 bg-slate-300 rounded" />
              </th>
              {Array.from({ length: colCount }).map((_, i) => (
                <th key={`head-${i}`} className="p-2.5 text-center border-r border-slate-200">
                  <div className="h-3 w-8 bg-slate-300/80 rounded mx-auto mb-1" />
                  <div className="h-3 w-10 bg-slate-200 rounded mx-auto" />
                </th>
              ))}
              <th className="p-3 w-28 text-center bg-slate-200/60 font-bold">
                <div className="h-4 w-12 bg-slate-300 rounded mx-auto" />
              </th>
            </tr>
          </thead>

          <tbody>
            {/* Section 1: Macro Header */}
            <tr className="bg-slate-200/50 border-y border-slate-300 border-l-4 border-l-blue-600">
              <td colSpan={colCount + 2} className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-600" />
                  <div className="h-4 w-36 bg-slate-400/80 rounded" />
                  <div className="h-3.5 w-12 bg-slate-300 rounded-full ml-1" />
                </div>
              </td>
            </tr>

            {/* Metric Rows */}
            {[
              { labelW: "w-36", cellW: "w-10", bg: "bg-white" },
              { labelW: "w-28", cellW: "w-12", bg: "bg-slate-50/50" },
              { labelW: "w-24", cellW: "w-14", bg: "bg-white" },
              { labelW: "w-32", cellW: "w-10", bg: "bg-slate-50/50" },
              { labelW: "w-32", cellW: "w-10", bg: "bg-white" },
            ].map((row, rIdx) => (
              <tr key={`r1-${rIdx}`} className={`border-b border-slate-200/70 ${row.bg}`}>
                <td className="p-2.5 pl-6 border-r border-slate-200">
                  <div className={`h-3.5 ${row.labelW} bg-slate-300 rounded`} />
                </td>
                {Array.from({ length: colCount }).map((_, cIdx) => (
                  <td key={`c-${rIdx}-${cIdx}`} className="p-2 border-r border-slate-100 text-center">
                    <div className={`h-3 ${row.cellW} bg-slate-200/80 rounded mx-auto`} />
                  </td>
                ))}
                <td className="p-2 bg-slate-100/50 text-center">
                  <div className="h-3.5 w-16 bg-slate-300/80 rounded mx-auto font-mono" />
                </td>
              </tr>
            ))}

            {/* Section 2: Sub-line Header */}
            <tr className="bg-slate-200/50 border-y border-slate-300 border-l-4 border-l-sky-500">
              <td colSpan={colCount + 2} className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-sky-500" />
                  <div className="h-4 w-28 bg-slate-400/80 rounded" />
                </div>
              </td>
            </tr>

            {/* Metric Rows */}
            {[
              { labelW: "w-28", cellW: "w-12", bg: "bg-white" },
              { labelW: "w-24", cellW: "w-14", bg: "bg-slate-50/50" },
              { labelW: "w-32", cellW: "w-10", bg: "bg-white" },
            ].map((row, rIdx) => (
              <tr key={`r2-${rIdx}`} className={`border-b border-slate-200/70 ${row.bg}`}>
                <td className="p-2.5 pl-6 border-r border-slate-200">
                  <div className={`h-3.5 ${row.labelW} bg-slate-300 rounded`} />
                </td>
                {Array.from({ length: colCount }).map((_, cIdx) => (
                  <td key={`c2-${rIdx}-${cIdx}`} className="p-2 border-r border-slate-100 text-center">
                    <div className={`h-3 ${row.cellW} bg-slate-200/80 rounded mx-auto`} />
                  </td>
                ))}
                <td className="p-2 bg-slate-100/50 text-center">
                  <div className="h-3.5 w-16 bg-slate-300/80 rounded mx-auto font-mono" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
