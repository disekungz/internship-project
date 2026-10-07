import React from "react";
import { Package, Clock, TrendingUp } from "lucide-react";
import { OutputUnitMeta } from "../types";

export interface LineBreakdownItem {
  lineName: string;
  output: number;
  manHours: number;
  prod: number;
}

export interface SmartReportSummaryCardsProps {
  grandTotals: {
    output: number;
    manHours: number;
    accProd: number;
  };
  selectedUnitMeta?: OutputUnitMeta;
  lineBreakdowns: LineBreakdownItem[] | null;
  formatCompactNumber?: (num: number) => string;
  isLineMat?: boolean;
  isYearly?: boolean;
}

const defaultFormatCompactNumber = (num: number) => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toLocaleString();
};

export const SmartReportSummaryCards: React.FC<SmartReportSummaryCardsProps> = ({
  grandTotals,
  selectedUnitMeta,
  lineBreakdowns,
  formatCompactNumber = defaultFormatCompactNumber,
  isLineMat = false,
  isYearly = false,
}) => {
  const unitLabel = selectedUnitMeta?.shortLabel || "Piece";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Card 1: Output */}
      <div className={`group relative overflow-hidden rounded-2xl border p-5 shadow-xs transition-all duration-200 hover:shadow-sm ${
        isLineMat
          ? "border-sky-200/80 dark:border-sky-800/60 bg-linear-to-b from-sky-50/40 dark:from-sky-950/30 via-base-100 to-base-100 hover:border-sky-400"
          : "border-sky-200/80 dark:border-sky-800/60 bg-linear-to-b from-sky-50/60 dark:from-sky-950/30 via-base-100 to-base-100 hover:border-sky-400"
      }`}>
        <div className={`absolute inset-x-0 top-0 h-1 ${isLineMat ? "bg-linear-to-r from-blue-600 via-sky-500 to-amber-500" : "bg-sky-500"}`} />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
              {isYearly ? "YTD Output" : (isLineMat ? "Total Output (LINE MAT)" : "Output")}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <h3 className="text-3xl font-black tracking-tight text-base-content font-mono">
                {grandTotals.output.toLocaleString()}
              </h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md border shadow-2xs text-sky-700 dark:text-sky-300 bg-sky-100/90 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800">
                {unitLabel}
              </span>
            </div>
            {lineBreakdowns && lineBreakdowns.length > 0 && (
              <div className={`mt-3 flex flex-wrap items-center gap-1.5 border-t pt-2.5 ${isLineMat ? "border-base-200 dark:border-base-300" : "border-sky-100 dark:border-sky-900/40"}`}>
                {lineBreakdowns.map((b) => (
                  <div
                    key={b.lineName}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold shadow-2xs transition-colors ${
                      b.lineName === "PD"
                        ? "bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-950 dark:text-blue-200"
                        : b.lineName === "MOS"
                        ? "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200"
                        : "bg-base-100/80 border border-sky-200/70 dark:border-sky-800/70 text-base-content hover:bg-sky-50 dark:hover:bg-sky-950/40"
                    }`}
                  >
                    <span className={`font-bold ${b.lineName === "PD" ? "text-blue-600 dark:text-blue-400" : b.lineName === "MOS" ? "text-amber-600 dark:text-amber-400" : "text-sky-600 dark:text-sky-400"}`}>
                      {b.lineName}:
                    </span>
                    <span className="font-mono font-bold text-base-content">
                      {isLineMat ? b.output.toLocaleString() : formatCompactNumber(b.output)} {isLineMat ? unitLabel : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200 dark:border-sky-800 bg-white dark:bg-base-200 text-sky-600 dark:text-sky-400 shadow-xs shrink-0">
            <Package size={20} />
          </div>
        </div>
      </div>

      {/* Card 2: Total Man Hour */}
      <div className="group relative overflow-hidden rounded-2xl border border-amber-200/80 dark:border-amber-800/60 bg-linear-to-b from-amber-50/60 dark:from-amber-950/30 via-base-100 to-base-100 p-5 shadow-xs transition-all duration-200 hover:border-amber-400 hover:shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1 bg-amber-500" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              {isYearly ? "YTD Total Man Hour" : "Total Man Hour"}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <h3 className="text-3xl font-black tracking-tight text-base-content font-mono">
                {grandTotals.manHours > 0 ? grandTotals.manHours.toLocaleString() : "0"}
              </h3>
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 shadow-2xs">
                MH
              </span>
            </div>
            {isLineMat ? (
              <div className="mt-3 flex items-center gap-1.5 border-t border-amber-100 dark:border-amber-900/40 pt-2.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-base-100/80 border border-amber-200/70 dark:border-amber-800 text-[11px] font-medium text-amber-900 dark:text-amber-200 shadow-2xs">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                  </span>
                  <span>Shared Line Workforce (PD & MOS)</span>
                </div>
              </div>
            ) : (
              lineBreakdowns && lineBreakdowns.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-amber-100 dark:border-amber-900/40 pt-2.5">
                  {lineBreakdowns.map((b) => (
                    <div
                      key={b.lineName}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-base-100/80 border border-amber-200/70 dark:border-amber-800/70 text-[11px] font-semibold shadow-2xs transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/40"
                    >
                      <span className="font-bold text-amber-600 dark:text-amber-400">{b.lineName}:</span>
                      <span className="font-mono font-bold text-base-content">
                        {formatCompactNumber(b.manHours)}
                      </span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-base-200 text-amber-600 dark:text-amber-400 shadow-xs shrink-0">
            <Clock size={20} />
          </div>
        </div>
      </div>

      {/* Card 3: AVG Productivity */}
      <div className="group relative overflow-hidden rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 bg-linear-to-b from-emerald-50/60 dark:from-emerald-950/30 via-base-100 to-base-100 p-5 shadow-xs transition-all duration-200 hover:border-emerald-400 hover:shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              {isYearly ? "YTD AVG Productivity" : (isLineMat ? "AVG Productivity (Total)" : "AVG Productivity")}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <h3 className="text-3xl font-black tracking-tight text-base-content font-mono">
                {grandTotals.accProd > 0 ? grandTotals.accProd.toFixed(2) : "-"}
              </h3>
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                {unitLabel}/MH
              </span>
            </div>
            {lineBreakdowns && lineBreakdowns.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-emerald-100 dark:border-emerald-900/40 pt-2.5">
                {lineBreakdowns.map((b) => (
                  <div
                    key={b.lineName}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold shadow-2xs transition-colors ${
                      b.lineName === "PD"
                        ? "bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-950 dark:text-blue-200"
                        : b.lineName === "MOS"
                        ? "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200"
                        : "bg-base-100/80 border border-emerald-200/70 dark:border-emerald-800/70 text-base-content hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    }`}
                  >
                    <span className={`font-bold ${b.lineName === "PD" ? "text-blue-600 dark:text-blue-400" : b.lineName === "MOS" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {b.lineName}:
                    </span>
                    <span className="font-mono font-bold text-base-content">
                      {b.prod > 0 ? b.prod.toFixed(2) : "-"} {isLineMat ? `${unitLabel}/MH` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-base-200 text-emerald-600 dark:text-emerald-400 shadow-xs shrink-0">
            <TrendingUp size={20} />
          </div>
        </div>
      </div>
    </div>
  );
};
