import React, { useMemo, useState, useCallback, useRef, useEffect, useDeferredValue } from 'react';
import ReactECharts from 'echarts-for-react';
import * as XLSX from 'xlsx';
import { Search, X, Check, ChevronLeft, ChevronRight, Target, TrendingUp, Scale, Gauge, Maximize2, Minimize2, Download, ChevronDown, FileSpreadsheet, Image as ImageIcon } from 'lucide-react';
import { getProcessColor } from "./processColors";
import { getISOWeekInfo } from "../utils/outputDateUtils";

export interface DailyChartItem {
  raw_date: string;
  date_label: string;
  short_label?: string;
  tooltip_title?: string;
  granularity?: string;
  periodType?: "day" | "week" | "month";
  total: number;
  total_pcs?: number;
  total_sht?: number;
  total_lot?: number;
  target_qty?: number;
  targets_by_line?: { [lineName: string]: number };
  [key: string]: any;
}

export interface MultiUnitChartData {
  pieceData: DailyChartItem[];
  sheetData: DailyChartItem[];
  lotData: DailyChartItem[];
}

export interface LineDateChartProps {
  data: DailyChartItem[];
  unit?: string;
  setUnitMode?: (unit: "Piece" | "Sheet" | "Lot") => void;
  multiUnitData?: MultiUnitChartData;
  activeLines: string[];
  onBarClick?: (rawDate: string, lineName: string) => void;
  selectedDate?: string | null;
  onLineFilterChange?: (lines: string[]) => void;
  selectedFactory?: "EFPC" | "SMT";
  onFactoryChange?: (factory: "EFPC" | "SMT") => void;
}

const EFPC_TARGET_LINES = new Set([
  "LINE A", "LINE B", "LINE B_GEN", "LINE B_NON", "LINE B_JDI", "LINE B_JDT", "LINE C", "LINE D",
  "LINE_A", "LINE_B", "LINE_B_GEN", "LINE_B_NON", "LINE_B_JDI", "LINE_B_JDT", "LINE_C", "LINE_D",
  "LINE_B_GENERAL", "LINE_B_NON_SILICONE",
  "LINE VAC", "LINE_VAC", "VAC",
  "LINE LAM", "LINE_LAM", "LAM",
  "LINE TF-2", "LINE_TF_2", "TF-2", "TF_2",
  "SUPPORT TF2", "AT_TF2", "AT_TF-2", "AT_FRONT", "AT-FRONT"
]);

const SMT_TARGET_LINES = new Set([
  "ASY1_G", "LINE ASY1_G", "LINE_ASY1_G", "ASSY 1", "ASSY 1 (GENERAL)", "ASSY1_GEN", "ASY1_GEN", "ASY1 GEN",
  "ASY1_A", "LINE ASY1_A", "LINE_ASY1_A", "ASSY 1AU", "ASSY 1 AU", "ASSY 1 (AUTOMOTIVE)", "ASSY1_AUTO", "ASY1_AUTO", "ASY1 AUTO",
  "ASY2", "LINE ASY2", "LINE_ASY2", "ASSY 2", "ASSY2",
  "ASY3", "LINE ASY3", "LINE_ASY3", "ASSY 3", "ASSY3",
  "MOTB", "LINE_MOTB", "LINE MOTB", "MOT-B", "MOT B",
  "MOTA_A", "LINE_MOTA_A", "LINE MOTA_A", "MOTA-A", "MOTA A",
  "MOTA_G", "LINE_MOTA_G", "LINE MOTA_G", "MOTA-G", "MOTA G",
  "MOTC", "LINE_MOTC", "LINE MOTC", "AIX-MOT", "AIX_MOT", "AIX MOT",
  "MOTD", "LINE_MOTD", "LINE MOTD"
]);

const TARGET_LINE_NAMES = new Set([
  ...EFPC_TARGET_LINES,
  ...SMT_TARGET_LINES
]);

export const normalizeLineKey = (name: string): string => {
  if (!name) return "";
  const s = name.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (s === "LINE_B" || s === "B") return "LINE B";
  if (s === "LINE_B_GEN" || s === "LINE_B_GENERAL" || s === "B_GEN") return "LINE B_GEN";
  if (s === "LINE_B_NON" || s === "LINE_B_NON_SILICONE" || s === "B_NON") return "LINE B_NON";
  if (s === "LINE_B_JDI" || s === "LINE_B_JDT" || s === "B_JDI" || s === "B_JDT") return "LINE B_JDT";
  if (s === "LINE_A" || s === "A") return "LINE A";
  if (s === "LINE_C" || s === "C") return "LINE C";
  if (s === "LINE_D" || s === "D") return "LINE D";
  if (s === "LINE_VAC" || s === "VAC") return "LINE VAC";
  if (s === "LINE_LAM" || s === "LAM") return "LINE LAM";
  if (s === "LINE_AVI" || s === "AVI") return "LINE AVI";
  if (s === "LINE_K2" || s === "K2") return "LINE K2";
  if (s === "LINE_TF_2" || s === "LINE_TF-2" || s === "TF_2" || s === "TF-2" || s === "SUPPORT_TF2" || s === "SUPPORT_TF_2" || s === "AT_TF2" || s === "AT_TF_2" || s === "AT_FRONT" || s === "AT-FRONT") return "LINE TF-2";
  if (s === "LINE_ASY1_G" || s === "ASY1_G" || s === "ASY1_GEN" || s === "ASSY_1" || s === "ASSY1" || s === "ASSY_1_GENERAL" || s === "ASSY_1_(GENERAL)") return "ASY1_G";
  if (s === "LINE_ASY1_A" || s === "ASY1_A" || s === "ASY1_AUTO" || s === "ASSY_1AU" || s === "ASSY1AU" || s === "ASSY_1_AU" || s === "ASSY_1_AUTOMOTIVE" || s === "ASSY_1_(AUTOMOTIVE)") return "ASY1_A";
  if (s === "LINE_ASY2" || s === "ASY2" || s === "ASSY_2" || s === "ASSY2") return "ASY2";
  if (s === "LINE_ASY3" || s === "ASY3" || s === "ASSY_3" || s === "ASSY3") return "ASY3";
  if (s === "LINE_MOTB" || s === "MOTB" || s === "MOT_B" || s === "MOT-B") return "MOTB";
  if (s === "LINE_MOTA_A" || s === "MOTA_A" || s === "MOTA-A" || s === "MOT_A_A") return "MOTA_A";
  if (s === "LINE_MOTA_G" || s === "MOTA_G" || s === "MOTA-G" || s === "MOT_A_G") return "MOTA_G";
  if (s === "LINE_MOTC" || s === "MOTC" || s === "MOT_C" || s === "MOT-C" || s === "AIX_MOT" || s === "AIX-MOT" || s === "AIX_MOTC") return "MOTC";
  if (s === "LINE_MOTD" || s === "MOTD" || s === "MOT_D" || s === "MOT-D") return "MOTD";
  if (s === "A_1" || s === "A1" || s === "A-1") return "A-1";
  if (s === "A_2" || s === "A2" || s === "A-2") return "A-2";
  if (s === "A_3" || s === "A3" || s === "A-3") return "A-3";
  if (s === "A_4" || s === "A4" || s === "A-4") return "A-4";
  if (s === "A_5" || s === "A5" || s === "A-5") return "A-5";
  if (s === "A_6" || s === "A6" || s === "A-6") return "A-6";
  if (s === "A_7" || s === "A7" || s === "A-7") return "A-7";
  if (s === "A_8" || s === "A8" || s === "A-8") return "A-8";
  if (s === "G_1" || s === "G1" || s === "G-1") return "G-1";
  if (s === "G_2" || s === "G2" || s === "G-2") return "G-2";
  if (s === "G_3" || s === "G3" || s === "G-3") return "G-3";
  if (s === "G_4" || s === "G4" || s === "G-4") return "G-4";
  if (s === "G_5" || s === "G5" || s === "G-5") return "G-5";
  if (s === "G_6" || s === "G6" || s === "G-6") return "G-6";
  if (s === "G_7" || s === "G7" || s === "G-7") return "G-7";
  if (s === "G_8" || s === "G8" || s === "G-8") return "G-8";
  if (s === "G_9" || s === "G9" || s === "G-9") return "G-9";
  if (s === "G_10" || s === "G10" || s === "G-10") return "G-10";
  return name.trim();
};

export const isMainSummaryLine = (lineName: string, factory?: "EFPC" | "SMT"): boolean => {
  if (!lineName) return false;
  const s = normalizeLineKey(lineName);
  if (factory === "SMT" || (!factory && (s === "ASY1_G" || s === "ASY1_A" || s === "ASY2" || s === "ASY3" || s === "MOTB" || s === "MOTA_A" || s === "MOTA_G" || s === "MOTC" || s === "MOTD"))) {
    return s === "ASY1_G" || s === "ASY1_A" || s === "ASY2" || s === "ASY3" || s === "MOTB" || s === "MOTA_A" || s === "MOTA_G" || s === "MOTC" || s === "MOTD";
  }
  return s === "LINE A" ||
    s === "LINE B" ||
    s === "LINE B_GEN" ||
    s === "LINE B_NON" ||
    s === "LINE B_JDT" ||
    s === "LINE C" ||
    s === "LINE D";
};

const ITEMS_PER_PAGE = 12;

// Custom checkbox item component for Line selection
const LineCheckboxItem: React.FC<{
  name: string;
  checked: boolean;
  onToggle: (name: string) => void;
}> = React.memo(({ name, checked, onToggle }) => (
  <div
    className="group flex items-center gap-2 px-2.5 py-1.5 hover:bg-base-200/70 rounded cursor-pointer transition-colors text-xs select-none"
    onClick={() => onToggle(name)}
  >
    <input
      type="checkbox"
      className="checkbox checkbox-xs checkbox-primary !rounded-sm pointer-events-none"
      checked={checked}
      readOnly
    />
    <span className={`truncate ${checked ? "font-bold text-base-content" : "text-base-content/70"}`} title={name}>
      {name}
    </span>
  </div>
));

const ChartDownloadDropdown: React.FC<{
  onDownloadExcel: () => void;
  onDownloadChart: () => void;
}> = React.memo(({ onDownloadExcel, onDownloadChart }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="btn btn-ghost btn-xs h-6 px-1.5 sm:px-2 text-base-content/70 hover:text-base-content hover:bg-base-200 border border-base-300/80 rounded transition-colors flex items-center gap-1 shadow-2xs"
        title="Download"
      >
        <Download className="w-3.5 h-3.5 text-base-content/70" />
        <span className="text-[10px] font-semibold hidden xs:inline">Download</span>
        <ChevronDown className={`w-3 h-3 text-base-content/50 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-48 bg-base-100 rounded-lg shadow-xl border border-base-300/80 py-1.5 z-50 animate-fade-in">
          <div className="px-3 py-1 text-[10px] font-bold text-base-content/40 uppercase tracking-wider border-b border-base-200/80 mb-1">
            Download As
          </div>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onDownloadExcel();
            }}
            className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-base-200/80 transition-colors group cursor-pointer"
          >
            <div className="w-6 h-6 rounded bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20">
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-base-content">Excel (.xlsx)</span>
              <span className="text-[10px] text-base-content/50">Production table data</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onDownloadChart();
            }}
            className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-base-200/80 transition-colors group cursor-pointer"
          >
            <div className="w-6 h-6 rounded bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20">
              <ImageIcon className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-base-content">Chart Image (.png)</span>
              <span className="text-[10px] text-base-content/50">High-resolution image</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
});

const ChartCardHeader: React.FC<{
  badge: string;
  title: string;
  unit: string;
  hasTarget: boolean;
  onExpand?: () => void;
  isExpanded?: boolean;
  onDownloadExcel?: () => void;
  onDownloadChart?: () => void;
}> = React.memo(({ badge, title, unit, hasTarget, onExpand, isExpanded, onDownloadExcel, onDownloadChart }) => (
  <div className="relative flex flex-col md:flex-row md:items-center justify-between px-1 gap-2 pb-1 border-b border-base-200/60 min-h-[36px]">
    <div className="flex items-center gap-2 shrink-0 z-10">
      <span className="badge badge-sm bg-slate-900 text-white font-bold border-none">{badge}</span>
      <span className="text-xs font-bold text-base-content/90">Output Chart ({badge}) — {title}</span>
    </div>

    {/* Top Center Legend - Clean Borderless Black Text */}
    <div className="flex md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 items-center justify-center gap-3 sm:gap-4 flex-wrap z-0 pointer-events-auto">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-black shrink-0 select-none">
        <span className="w-2.5 h-2.5 rounded-xs bg-[#10b981] inline-block"></span>
        <span className="text-black">Actual Output</span>
      </div>

      {hasTarget && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-black shrink-0 select-none">
          <span className="w-2.5 h-2.5 rounded-xs bg-[#ef4444] inline-block"></span>
          <span className="text-black">Actual Target</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[11px] font-bold text-black shrink-0 select-none">
        <span className="w-2.5 h-0.5 bg-[#047857] inline-block"></span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#047857] inline-block -ml-1.5"></span>
        <span className="text-black">Acc Output</span>
      </div>

      {hasTarget && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-black shrink-0 select-none">
          <span className="w-3 h-0.5 bg-[#dc2626] inline-block"></span>
          <span className="w-1.5 h-1.5 rotate-45 bg-[#dc2626] inline-block -ml-1.5"></span>
          <span className="text-black">Acc Target</span>
        </div>
      )}
    </div>

    <div className="flex items-center gap-2 shrink-0 z-10 self-end md:self-auto">
      <span className="text-[11px] text-base-content/50 font-medium mr-1">Unit: {unit}</span>
      {onDownloadExcel && onDownloadChart && (
        <ChartDownloadDropdown
          onDownloadExcel={onDownloadExcel}
          onDownloadChart={onDownloadChart}
        />
      )}
      {onExpand && (
        <button
          type="button"
          onClick={onExpand}
          className="btn btn-ghost btn-xs h-6 px-1.5 text-base-content/60 hover:text-base-content hover:bg-base-200 rounded transition-colors flex items-center gap-1"
          title={isExpanded ? "Close Fullscreen" : "Expand Chart"}
        >
          {isExpanded ? (
            <>
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium hidden sm:inline">Close</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium hidden sm:inline">Expand</span>
            </>
          )}
        </button>
      )}
    </div>
  </div>
));

const MiniKpiCards: React.FC<{
  dataset: DailyChartItem[];
  unit: string;
  selectedDate?: string | null;
  isExpanded?: boolean;
}> = React.memo(({ dataset, unit, selectedDate, isExpanded = false }) => {
  const stats = useMemo(() => {
    if (!dataset || dataset.length === 0) {
      return {
        accOutput: 0,
        accTarget: 0,
        diffTarget: 0,
        achievementRate: "0",
        dayOutput: 0,
        dayTarget: 0,
        cutoffDate: null,
        cutoffLabel: "",
        isSelected: false,
        hasTarget: false
      };
    }

    const isWeekly = dataset.some(d =>
      d.granularity === 'weekly' ||
      d.periodType === 'week' ||
      (typeof d.raw_date === 'string' && (d.raw_date.includes('WK') || /^W\d{4}/.test(d.raw_date)))
    );

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    let cutoff = selectedDate || null;
    const isSelected = Boolean(selectedDate);

    if (!cutoff) {
      if (isWeekly) {
        const todayWeek = getISOWeekInfo(todayStr);
        const todayWeekKey = todayWeek.weekKey;
        const hasBeyondThisWeek = dataset.some(d => d.raw_date > todayWeekKey);
        if (hasBeyondThisWeek) {
          cutoff = todayWeekKey;
        } else {
          cutoff = dataset[dataset.length - 1]?.raw_date || null;
        }
      } else {
        const hasBeyondToday = dataset.some(d => d.raw_date > todayStr);
        if (hasBeyondToday) {
          cutoff = todayStr;
        } else {
          cutoff = dataset[dataset.length - 1]?.raw_date || null;
        }
      }
    }

    let accOutput = 0;
    let accTarget = 0;
    let dayOutput = 0;
    let dayTarget = 0;

    dataset.forEach(d => {
      if (cutoff && d.raw_date > cutoff) return;
      accOutput += Number(d.total || 0);
      accTarget += Number(d.target_qty || 0);
    });

    if (selectedDate) {
      const dayItem = dataset.find(d =>
        d.raw_date === selectedDate ||
        d.short_label === selectedDate ||
        d.date_label === selectedDate
      );
      if (dayItem) {
        dayOutput = Number(dayItem.total || 0);
        dayTarget = Number(dayItem.target_qty || 0);
      }
    }

    const diffTarget = accOutput - accTarget;
    const achievementRate = accTarget > 0 ? ((accOutput / accTarget) * 100).toFixed(1) : "0";
    const hasTarget = dataset.some(d => Number(d.target_qty || 0) > 0);

    const cutoffItem = dataset.find(d =>
      d.raw_date === cutoff ||
      d.short_label === cutoff ||
      d.date_label === cutoff
    );
    let cutoffLabel = cutoffItem?.short_label || cutoffItem?.date_label || cutoff || "";
    if (cutoff && /^\d{4}-\d{2}-\d{2}$/.test(cutoff)) {
      const [y, m, d] = cutoff.split('-');
      cutoffLabel = `${d}/${m}/${y}`;
    } else if (cutoff && cutoff.includes('WK')) {
      const [y, wk] = cutoff.split('-');
      const yy = y.slice(-2);
      const wNum = wk.replace(/^[A-Za-z]+/, '');
      cutoffLabel = `WK${yy}${wNum}`;
    }

    return {
      accOutput,
      accTarget,
      diffTarget,
      achievementRate,
      dayOutput,
      dayTarget,
      cutoffDate: cutoff,
      cutoffLabel,
      isSelected,
      hasTarget,
      isWeekly
    };
  }, [dataset, selectedDate]);

  const renderDecimalNumber = (val: number | string | undefined | null, prefix = "") => {
    if (val === undefined || val === null || val === "" || val === "-") return "-";

    let numStr: string;
    if (typeof val === "number") {
      numStr = val.toLocaleString(undefined, {
        minimumFractionDigits: Number.isInteger(val) ? 0 : 2,
        maximumFractionDigits: 2
      });
    } else {
      numStr = String(val);
    }

    const dotIndex = numStr.lastIndexOf('.');
    if (dotIndex !== -1) {
      const intPart = numStr.substring(0, dotIndex);
      const decPart = numStr.substring(dotIndex);
      return (
        <span className="inline-flex items-baseline">
          <span>{prefix}{intPart}</span>
          <span className={`${isExpanded ? "text-sm" : "text-[11px]"} font-semibold opacity-75 ml-[0.5px]`}>{decPart}</span>
        </span>
      );
    }

    return <span>{prefix}{numStr}</span>;
  };

  if (isExpanded) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full my-2">
        {/* 1. Acc Target */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-base-200/50 dark:bg-base-300/30 border border-base-300/80 shadow-2xs">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
              <span className="text-xs sm:text-sm font-bold text-base-content/70 uppercase tracking-wider">
                Acc Target
              </span>
              {stats.cutoffLabel && (
                <span className="text-[10px] text-base-content/40">
                  ({stats.isSelected ? `Selected: ${stats.cutoffLabel}` : stats.cutoffLabel})
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl sm:text-2xl font-extrabold text-base-content/90">
                {stats.hasTarget ? renderDecimalNumber(stats.accTarget) : "-"}
              </span>
              <span className="text-xs font-semibold text-base-content/50">
                {unit}
              </span>
            </div>
            <div className="text-[11px] text-base-content/50 mt-0.5 truncate">
              {stats.isSelected && stats.hasTarget
                ? `${stats.isWeekly ? "Week" : "Day"} Target: ${renderDecimalNumber(stats.dayTarget)} ${unit}`
                : "Plan Target"}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0 ml-3">
            <Target className="w-5 h-5" />
          </div>
        </div>

        {/* 2. Acc Output */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-base-200/50 dark:bg-base-300/30 border border-base-300/80 shadow-2xs">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="text-xs sm:text-sm font-bold text-base-content/70 uppercase tracking-wider">
                Acc Output
              </span>
              {stats.cutoffLabel && (
                <span className="text-[10px] text-base-content/40">
                  ({stats.isSelected ? `Selected: ${stats.cutoffLabel}` : stats.cutoffLabel})
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl sm:text-2xl font-extrabold text-base-content/90">
                {renderDecimalNumber(stats.accOutput)}
              </span>
              <span className="text-xs font-semibold text-base-content/50">
                {unit}
              </span>
            </div>
            <div className="text-[11px] text-base-content/50 mt-0.5 truncate">
              {stats.isSelected
                ? `${stats.isWeekly ? "Week" : "Day"} Output: ${renderDecimalNumber(stats.dayOutput)} ${unit}`
                : "Actual Output"}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 ml-3">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* 3. Balance */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-base-200/50 dark:bg-base-300/30 border border-base-300/80 shadow-2xs">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                !stats.hasTarget ? "bg-slate-400" : stats.diffTarget < 0 ? "bg-red-500" : "bg-emerald-500"
              }`}></span>
              <span className="text-xs sm:text-sm font-bold text-base-content/70 uppercase tracking-wider">
                Balance
              </span>
              {stats.hasTarget && (
                <span className={`text-[10px] font-semibold ${
                  stats.diffTarget < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                }`}>
                  ({stats.diffTarget < 0 ? "Shortfall" : stats.diffTarget > 0 ? "Surplus" : "On Target"})
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={`text-xl sm:text-2xl font-extrabold ${
                !stats.hasTarget
                  ? "text-base-content/70"
                  : stats.diffTarget < 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}>
                {!stats.hasTarget
                  ? "-"
                  : renderDecimalNumber(stats.diffTarget, stats.diffTarget > 0 ? "+" : "")}
              </span>
              <span className="text-xs font-semibold text-base-content/50">
                {unit}
              </span>
            </div>
            <div className={`text-[11px] mt-0.5 truncate ${
              !stats.hasTarget
                ? "text-base-content/50"
                : stats.diffTarget < 0
                ? "text-red-600/80 dark:text-red-400/80"
                : "text-emerald-600/80 dark:text-emerald-400/80"
            }`}>
              {!stats.hasTarget
                ? "No Target Configured"
                : stats.diffTarget < 0
                ? `Shortfall: ${renderDecimalNumber(Math.abs(stats.diffTarget))} ${unit}`
                : stats.diffTarget > 0
                ? `Surplus: +${renderDecimalNumber(stats.diffTarget)} ${unit}`
                : "On Target"}
            </div>
          </div>
          <div className={`p-2 rounded-xl shrink-0 ml-3 ${
            !stats.hasTarget
              ? "bg-slate-500/10 text-slate-500"
              : stats.diffTarget < 0
              ? "bg-red-500/10 text-red-600 dark:text-red-400"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          }`}>
            <Scale className="w-5 h-5" />
          </div>
        </div>

        {/* 4. KPR (%) */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-base-200/50 dark:bg-base-300/30 border border-base-300/80 shadow-2xs">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0"></span>
              <span className="text-xs sm:text-sm font-bold text-base-content/70 uppercase tracking-wider">
                KPR (%)
              </span>
              {stats.hasTarget && (
                <span className={`text-[10px] font-semibold ${
                  Number(stats.achievementRate) >= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                }`}>
                  ({Number(stats.achievementRate) >= 100 ? "Goal Met" : "Below Target"})
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl sm:text-2xl font-extrabold text-base-content/90 inline-flex items-baseline">
                {stats.hasTarget ? (
                  <>
                    {renderDecimalNumber(stats.achievementRate)}
                    <span className="text-sm font-semibold opacity-75 ml-0.5">%</span>
                  </>
                ) : "-"}
              </span>
              <span className="text-xs font-semibold text-base-content/50">
                Rate
              </span>
            </div>
            <div className="text-[11px] text-base-content/50 mt-0.5 truncate">
              {!stats.hasTarget
                ? "No Target Configured"
                : Number(stats.achievementRate) >= 100
                ? "Target Exceeded / Met"
                : "Under Planned Target"}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0 ml-3">
            <Gauge className="w-5 h-5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 w-full my-1">
      {/* 1. Acc Target */}
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-base-200/50 dark:bg-base-300/30 border border-base-300/70 shrink-0">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
            <span className="text-[10px] font-semibold text-base-content/60 uppercase tracking-wider">
              Acc Target
            </span>
            {stats.cutoffLabel && (
              <span className="text-[9px] text-base-content/40">
                ({stats.isSelected ? `Selected: ${stats.cutoffLabel}` : stats.cutoffLabel})
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-sm font-bold text-base-content/90">
              {stats.hasTarget ? renderDecimalNumber(stats.accTarget) : "-"}
            </span>
            <span className="text-[10px] text-base-content/50 font-normal">
              {unit}
            </span>
            {stats.isSelected && stats.hasTarget && (
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-normal ml-1">
                ({stats.isWeekly ? "Week" : "Day"}: {renderDecimalNumber(stats.dayTarget)})
              </span>
            )}
          </div>
        </div>
        <div className="p-1 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0 ml-1">
          <Target className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* 2. Acc Output */}
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-base-200/50 dark:bg-base-300/30 border border-base-300/70 shrink-0">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
            <span className="text-[10px] font-semibold text-base-content/60 uppercase tracking-wider">
              Acc Output
            </span>
            {stats.cutoffLabel && (
              <span className="text-[9px] text-base-content/40">
                ({stats.isSelected ? `Selected: ${stats.cutoffLabel}` : stats.cutoffLabel})
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-sm font-bold text-base-content/90">
              {renderDecimalNumber(stats.accOutput)}
            </span>
            <span className="text-[10px] text-base-content/50 font-normal">
              {unit}
            </span>
            {stats.isSelected && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal ml-1">
                ({stats.isWeekly ? "Week" : "Day"}: {renderDecimalNumber(stats.dayOutput)})
              </span>
            )}
          </div>
        </div>
        <div className="p-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 ml-1">
          <TrendingUp className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* 3. Balance */}
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-base-200/50 dark:bg-base-300/30 border border-base-300/70 shrink-0">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              !stats.hasTarget ? "bg-slate-400" : stats.diffTarget < 0 ? "bg-red-500" : "bg-emerald-500"
            }`}></span>
            <span className="text-[10px] font-semibold text-base-content/60 uppercase tracking-wider">
              Balance
            </span>
            {stats.hasTarget && (
              <span className={`text-[9px] font-medium ${
                stats.diffTarget < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
              }`}>
                ({stats.diffTarget < 0 ? "Shortfall" : stats.diffTarget > 0 ? "Surplus" : "On Target"})
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={`text-sm font-bold ${
              !stats.hasTarget
                ? "text-base-content/70"
                : stats.diffTarget < 0
                ? "text-red-600 dark:text-red-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}>
              {!stats.hasTarget
                ? "-"
                : renderDecimalNumber(stats.diffTarget, stats.diffTarget > 0 ? "+" : "")}
            </span>
            <span className="text-[10px] text-base-content/50 font-normal">
              {unit}
            </span>
          </div>
        </div>
        <div className={`p-1 rounded shrink-0 ml-1 ${
          !stats.hasTarget
            ? "bg-slate-500/10 text-slate-500"
            : stats.diffTarget < 0
            ? "bg-red-500/10 text-red-600 dark:text-red-400"
            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        }`}>
          <Scale className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* 4. KPR (%) */}
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-base-200/50 dark:bg-base-300/30 border border-base-300/70 shrink-0">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0"></span>
            <span className="text-[10px] font-semibold text-base-content/60 uppercase tracking-wider">
              KPR (%)
            </span>
            {stats.hasTarget && (
              <span className={`text-[9px] font-medium ${
                Number(stats.achievementRate) >= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
              }`}>
                ({Number(stats.achievementRate) >= 100 ? "Goal Met" : "Below Target"})
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-sm font-bold text-base-content/90 inline-flex items-baseline">
              {stats.hasTarget ? (
                <>
                  {renderDecimalNumber(stats.achievementRate)}
                  <span className="text-[11px] font-semibold opacity-75 ml-0.5">%</span>
                </>
              ) : "-"}
            </span>
            <span className="text-[10px] text-base-content/50 font-normal">
              Rate
            </span>
          </div>
        </div>
        <div className="p-1 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0 ml-1">
          <Gauge className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
});

function getNiceMax(val: number, multiplier = 1.15): number {
  if (!val || val <= 0) return 100;
  const raw = val * multiplier;
  const exp = Math.floor(Math.log10(raw));
  const frac = raw / Math.pow(10, exp);
  let niceFrac: number;
  if (frac <= 1) niceFrac = 1;
  else if (frac <= 1.2) niceFrac = 1.2;
  else if (frac <= 1.5) niceFrac = 1.5;
  else if (frac <= 2) niceFrac = 2;
  else if (frac <= 2.5) niceFrac = 2.5;
  else if (frac <= 3) niceFrac = 3;
  else if (frac <= 4) niceFrac = 4;
  else if (frac <= 5) niceFrac = 5;
  else if (frac <= 6) niceFrac = 6;
  else if (frac <= 8) niceFrac = 8;
  else niceFrac = 10;
  return niceFrac * Math.pow(10, exp);
}

const LineDateChart: React.FC<LineDateChartProps> = ({
  data,
  unit,
  setUnitMode,
  multiUnitData,
  activeLines,
  onBarClick,
  selectedDate,
  onLineFilterChange,
  selectedFactory = "EFPC",
  onFactoryChange,
}) => {
  const [legendPage, setLegendPage] = useState(0);
  const [activeUnitTab, setActiveUnitTab] = useState<"ALL" | "Piece" | "Sheet" | "Lot">("ALL");
  const [expandedUnit, setExpandedUnit] = useState<"Piece" | "Sheet" | "Lot" | "Single" | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpandedUnit(null);
      }
    };
    if (expandedUnit) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [expandedUnit]);

  const handleUnitTabClick = useCallback((tab: "ALL" | "Piece" | "Sheet" | "Lot") => {
    setActiveUnitTab(tab);
    if (tab === "ALL") {
      setUnitMode?.("Piece");
    } else {
      setUnitMode?.(tab);
    }
  }, [setUnitMode]);

  useEffect(() => {
    if (unit && (unit === "Piece" || unit === "Sheet" || unit === "Lot")) {
      if (activeUnitTab !== "ALL" && activeUnitTab !== unit) {
        setActiveUnitTab(unit);
      }
    }
  }, [unit, activeUnitTab]);

  // Selection states
  const [confirmedLines, setConfirmedLines] = useState<string[]>(activeLines);
  const [tempSelectedLines, setTempSelectedLines] = useState<string[]>(activeLines);

  // Search autocomplete states
  const [localSearch, setLocalSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // Track factory change synchronously during render to eliminate flash / stutter
  const [prevFactory, setPrevFactory] = useState(selectedFactory);
  if (selectedFactory !== prevFactory) {
    setPrevFactory(selectedFactory);
    setConfirmedLines(activeLines);
    setTempSelectedLines(activeLines);
    setLocalSearch("");
    setShowSuggestions(false);
    if (selectedFactory === "SMT") {
      setActiveUnitTab("Piece");
    } else {
      setActiveUnitTab("ALL");
    }
  }

  const [prevActiveLines, setPrevActiveLines] = useState(activeLines);
  if (activeLines !== prevActiveLines) {
    setPrevActiveLines(activeLines);
    setConfirmedLines(activeLines);
    setTempSelectedLines(activeLines);
    setLocalSearch("");
    setShowSuggestions(false);
  }

  useEffect(() => {
    setConfirmedLines(activeLines);
    setTempSelectedLines(activeLines);
    setLocalSearch("");
    setShowSuggestions(false);
    if (selectedFactory === "SMT") {
      setActiveUnitTab("Piece");
      setUnitMode?.("Piece");
    } else {
      setActiveUnitTab("ALL");
      setUnitMode?.("Piece");
    }
  }, [activeLines, selectedFactory, setUnitMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setTempSelectedLines(confirmedLines);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [confirmedLines]);

  const deferredSearch = useDeferredValue(localSearch);
  const tempSelectedSet = useMemo(() => new Set(tempSelectedLines), [tempSelectedLines]);

  const matches = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    let list = activeLines;
    if (query) {
      list = activeLines.filter(name => name.toLowerCase().includes(query));
    }
    return [...list].sort((a, b) => a.localeCompare(b));
  }, [deferredSearch, activeLines]);

  const DROPDOWN_VISIBLE_LIMIT = 50;
  const visibleMatches = useMemo(() => {
    if (!deferredSearch.trim()) return matches.slice(0, DROPDOWN_VISIBLE_LIMIT);
    return matches;
  }, [matches, deferredSearch]);
  const hiddenCount = matches.length - visibleMatches.length;

  const toggleLine = useCallback((line: string) => {
    setTempSelectedLines(prev =>
      prev.includes(line) ? prev.filter(p => p !== line) : [...prev, line]
    );
  }, []);

  const selectAllMatches = () => {
    setTempSelectedLines(prev => {
      const newSelected = new Set(prev);
      matches.forEach(m => newSelected.add(m));
      return Array.from(newSelected);
    });
  };

  const clearAllMatches = () => {
    setTempSelectedLines([]);
  };

  const handleConfirm = () => {
    setConfirmedLines(tempSelectedLines);
    onLineFilterChange?.(tempSelectedLines);
    setShowSuggestions(false);
    setLegendPage(0);
    if (tempSelectedLines.length === 1) {
      setLocalSearch(tempSelectedLines[0]);
    } else if (tempSelectedLines.length === activeLines.length) {
      setLocalSearch("");
    }
  };

  const handleSelectOnly = (name: string) => {
    setTempSelectedLines([name]);
    setConfirmedLines([name]);
    onLineFilterChange?.([name]);
    setLocalSearch(name);
    setShowSuggestions(false);
    setLegendPage(0);
  };

  // Effective lines driven strictly by confirmed selection
  const effectiveLines = useMemo(() => {
    return confirmedLines;
  }, [confirmedLines]);

  const isLineFiltered = effectiveLines.length > 0 && effectiveLines.length < activeLines.length;
  const filteredLineTitle = isLineFiltered
    ? (effectiveLines.length === 1 ? effectiveLines[0] : `${effectiveLines.length} Lines`)
    : "All Lines";

  const { sortedLines, legendItems } = useMemo(() => {
    let procs = [...effectiveLines];
    if (!isLineFiltered) {
      // Default Summary view (All Lines): ONLY include main summary lines
      procs = procs.filter(p => isMainSummaryLine(p, selectedFactory) && p !== "LINE B");
    } else {
      // User filtered lines: exclude 'LINE B' only if its sublines are also present to avoid double counting
      if (procs.includes("LINE B") && (procs.includes("LINE B_GEN") || procs.includes("LINE B_NON"))) {
        procs = procs.filter(p => p !== "LINE B");
      }
    }
    const sorted = procs.sort((a, b) => a.localeCompare(b));
    const items = sorted.map(line => ({
      value: line,
      color: getProcessColor(line)
    }));
    return { sortedLines: sorted, legendItems: items };
  }, [effectiveLines, activeLines, isLineFiltered, selectedFactory]);

  const getTargetForLine = useCallback((targetsByLine: { [k: string]: number } | undefined, lineName: string): number => {
    if (!targetsByLine || !lineName) return 0;
    const norm = normalizeLineKey(lineName);
    if (norm === 'ASY1_G') {
      const val = targetsByLine['ASY1_G'] ?? targetsByLine['ASSY 1'] ?? targetsByLine['ASSY1'] ?? targetsByLine['LINE ASY1_G'] ?? targetsByLine['LINE_ASY1_G'];
      if (val !== undefined) return val;
    }
    if (norm === 'ASY1_A') {
      const val = targetsByLine['ASY1_A'] ?? targetsByLine['ASSY 1AU'] ?? targetsByLine['ASSY 1 AU'] ?? targetsByLine['ASSY1AU'] ?? targetsByLine['LINE ASY1_A'] ?? targetsByLine['LINE_ASY1_A'];
      if (val !== undefined) return val;
    }
    if (norm === 'ASY2') {
      const val = targetsByLine['ASY2'] ?? targetsByLine['ASSY 2'] ?? targetsByLine['ASSY2'] ?? targetsByLine['LINE ASY2'] ?? targetsByLine['LINE_ASY2'];
      if (val !== undefined) return val;
    }
    if (norm === 'ASY3') {
      const val = targetsByLine['ASY3'] ?? targetsByLine['ASSY 3'] ?? targetsByLine['ASSY3'] ?? targetsByLine['LINE ASY3'] ?? targetsByLine['LINE_ASY3'];
      if (val !== undefined) return val;
    }
    if (norm === 'MOTB') {
      const val = targetsByLine['MOTB'] ?? targetsByLine['LINE_MOTB'] ?? targetsByLine['LINE MOTB'];
      if (val !== undefined) return val;
      const sum = (targetsByLine['A-1'] ?? targetsByLine['A1'] ?? 0) +
                  (targetsByLine['A-2'] ?? targetsByLine['A2'] ?? 0) +
                  (targetsByLine['A-3'] ?? targetsByLine['A3'] ?? 0) +
                  (targetsByLine['A-4'] ?? targetsByLine['A4'] ?? 0);
      if (sum > 0) return sum;
    }
    if (norm === 'MOTA_A') {
      const val = targetsByLine['MOTA_A'] ?? targetsByLine['LINE_MOTA_A'] ?? targetsByLine['LINE MOTA_A'] ?? targetsByLine['MOTA-A'];
      if (val !== undefined) return val;
      const sum = (targetsByLine['A-5'] ?? targetsByLine['A5'] ?? 0) +
                  (targetsByLine['A-6'] ?? targetsByLine['A6'] ?? 0);
      if (sum > 0) return sum;
    }
    if (norm === 'MOTA_G') {
      const val = targetsByLine['MOTA_G'] ?? targetsByLine['LINE_MOTA_G'] ?? targetsByLine['LINE MOTA_G'] ?? targetsByLine['MOTA-G'];
      if (val !== undefined) return val;
      const sum = (targetsByLine['A-7'] ?? targetsByLine['A7'] ?? 0) +
                  (targetsByLine['A-8'] ?? targetsByLine['A8'] ?? 0);
      if (sum > 0) return sum;
    }
    if (norm === 'MOTC') {
      const val = targetsByLine['MOTC'] ?? targetsByLine['LINE_MOTC'] ?? targetsByLine['LINE MOTC'] ?? targetsByLine['AIX-MOT'];
      if (val !== undefined) return val;
      const sum = (targetsByLine['G-1'] ?? targetsByLine['G1'] ?? 0) +
                  (targetsByLine['G-2'] ?? targetsByLine['G2'] ?? 0) +
                  (targetsByLine['G-3'] ?? targetsByLine['G3'] ?? 0) +
                  (targetsByLine['G-4'] ?? targetsByLine['G4'] ?? 0) +
                  (targetsByLine['G-5'] ?? targetsByLine['G5'] ?? 0);
      if (sum > 0) return sum;
    }
    if (norm === 'MOTD') {
      const val = targetsByLine['MOTD'] ?? targetsByLine['LINE_MOTD'] ?? targetsByLine['LINE MOTD'];
      if (val !== undefined) return val;
      const sum = (targetsByLine['G-6'] ?? targetsByLine['G6'] ?? 0) +
                  (targetsByLine['G-7'] ?? targetsByLine['G7'] ?? 0) +
                  (targetsByLine['G-8'] ?? targetsByLine['G8'] ?? 0) +
                  (targetsByLine['G-9'] ?? targetsByLine['G9'] ?? 0) +
                  (targetsByLine['G-10'] ?? targetsByLine['G10'] ?? 0);
      if (sum > 0) return sum;
    }

    if (targetsByLine[lineName] !== undefined) return targetsByLine[lineName];
    if (targetsByLine[norm] !== undefined) return targetsByLine[norm];
    const clean = lineName.trim().toUpperCase();
    const underscored = clean.replace(/[\s-]+/g, '_');
    const stripped = underscored.replace(/^LINE_/, '');
    const withLine = `LINE ${stripped}`;
    if (targetsByLine[clean] !== undefined) return targetsByLine[clean];
    if (targetsByLine[underscored] !== undefined) return targetsByLine[underscored];
    if (targetsByLine[stripped] !== undefined) return targetsByLine[stripped];
    if (targetsByLine[withLine] !== undefined) return targetsByLine[withLine];
    for (const [k, v] of Object.entries(targetsByLine)) {
      const kClean = k.trim().toUpperCase();
      const kUnderscored = kClean.replace(/[\s-]+/g, '_');
      const kStripped = kUnderscored.replace(/^LINE_/, '');
      if (kClean === clean || kUnderscored === underscored || kStripped === stripped || normalizeLineKey(k) === norm) {
        return v;
      }
    }
    return 0;
  }, []);

  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.map(item => {
      let newTotal = 0;
      sortedLines.forEach(line => {
        if (item[line]) newTotal += item[line];
      });

      let newTarget = item.target_qty;
      if (item.targets_by_line) {
        newTarget = sortedLines.reduce((sum, line) => {
          return sum + getTargetForLine(item.targets_by_line, line);
        }, 0);
      }

      return { ...item, total: newTotal, target_qty: newTarget };
    });
  }, [data, sortedLines, getTargetForLine]);

  // Multi-unit prepared data
  const multiUnitPreparedData = useMemo(() => {
    if (!multiUnitData) return undefined;
    const filterUnitData = (unitRows: DailyChartItem[]) => {
      return unitRows.map(item => {
        let newTotal = 0;
        sortedLines.forEach(line => {
          if (item[line]) newTotal += item[line];
        });

        let newTarget = item.target_qty;
        if (item.targets_by_line) {
          newTarget = sortedLines.reduce((sum, line) => {
            return sum + getTargetForLine(item.targets_by_line, line);
          }, 0);
        }

        return { ...item, total: newTotal, target_qty: newTarget };
      });
    };

    return {
      pieceData: filterUnitData(multiUnitData.pieceData),
      sheetData: filterUnitData(multiUnitData.sheetData),
      lotData: filterUnitData(multiUnitData.lotData)
    };
  }, [multiUnitData, sortedLines, getTargetForLine]);

  useEffect(() => {
    setLegendPage(0);
  }, [legendItems.length]);

  const totalPages = Math.ceil(legendItems.length / ITEMS_PER_PAGE);
  const safeLegendPage = Math.min(legendPage, Math.max(0, totalPages - 1));
  const currentLegendItems = useMemo(() => {
    return legendItems.slice(
      safeLegendPage * ITEMS_PER_PAGE,
      (safeLegendPage + 1) * ITEMS_PER_PAGE
    );
  }, [legendItems, safeLegendPage]);

  const hasAnyTargetData = useMemo(() => {
    if (!filteredData) return false;
    return filteredData.some(d => Number(d.target_qty || 0) > 0);
  }, [filteredData]);

  const hasPieceTarget = useMemo(() => {
    if (multiUnitPreparedData?.pieceData) {
      return multiUnitPreparedData.pieceData.some(d => Number(d.target_qty || 0) > 0);
    }
    return hasAnyTargetData;
  }, [multiUnitPreparedData, hasAnyTargetData]);

  const hasSheetTarget = useMemo(() => {
    if (multiUnitPreparedData?.sheetData) {
      return multiUnitPreparedData.sheetData.some(d => Number(d.target_qty || 0) > 0);
    }
    return hasAnyTargetData;
  }, [multiUnitPreparedData, hasAnyTargetData]);

  const hasLotTarget = useMemo(() => {
    if (multiUnitPreparedData?.lotData) {
      return multiUnitPreparedData.lotData.some(d => Number(d.target_qty || 0) > 0);
    }
    return hasAnyTargetData;
  }, [multiUnitPreparedData, hasAnyTargetData]);

  const expandedInfo = useMemo(() => {
    if (!expandedUnit) return null;
    if (expandedUnit === "Piece") {
      const d = multiUnitPreparedData ? multiUnitPreparedData.pieceData : filteredData;
      return {
        badge: "Piece",
        title: filteredLineTitle,
        unit: "Piece",
        dataset: d,
        hasTarget: hasPieceTarget
      };
    }
    if (expandedUnit === "Sheet") {
      const d = multiUnitPreparedData ? multiUnitPreparedData.sheetData : filteredData;
      return {
        badge: "Sheet",
        title: filteredLineTitle,
        unit: "Sheet",
        dataset: d,
        hasTarget: hasSheetTarget
      };
    }
    if (expandedUnit === "Lot") {
      const d = multiUnitPreparedData ? multiUnitPreparedData.lotData : filteredData;
      return {
        badge: "Lot",
        title: filteredLineTitle,
        unit: "Lot",
        dataset: d,
        hasTarget: hasLotTarget
      };
    }
    return {
      badge: unit || "Piece",
      title: filteredLineTitle,
      unit: unit || "Piece",
      dataset: filteredData,
      hasTarget: hasAnyTargetData
    };
  }, [expandedUnit, multiUnitPreparedData, filteredData, filteredLineTitle, hasPieceTarget, hasSheetTarget, hasLotTarget, hasAnyTargetData, unit]);

  const dynamicBarSize = useMemo(() => {
    if (!filteredData) return 32;
    if (filteredData.length === 1) return 80;
    if (filteredData.length <= 7) return 50;
    if (filteredData.length <= 15) return 36;
    return 26;
  }, [filteredData]);

  // Build ECharts option for a given dataset
  const buildChartOption = useCallback((chartDataset: DailyChartItem[], unitLabel?: string) => {
    if (!chartDataset || chartDataset.length === 0) return {};

    const isWeekly = chartDataset.some(d =>
      d.granularity === 'weekly' ||
      d.periodType === 'week' ||
      (typeof d.raw_date === 'string' && (d.raw_date.includes('WK') || /^(?:WK|W)\d{4}/.test(d.raw_date)))
    );

    const xCategories = chartDataset.map(d => {
      if (d.raw_date && /^\d{4}-\d{2}-\d{2}$/.test(d.raw_date)) {
        const [yyyy, mm, dd] = d.raw_date.split('-');
        return `${dd}/${mm}/${yyyy}`;
      }
      if (d.short_label) return d.short_label;
      if (d.date_label) return d.date_label;
      if (d.raw_date && d.raw_date.includes('WK')) {
        const [y, wk] = d.raw_date.split('-');
        const yy = y.slice(-2);
        const wNum = wk.replace(/^[A-Za-z]+/, '');
        return `WK${yy}${wNum}`;
      }
      return d.raw_date;
    });

    // Calculate Accumulated Actual
    let runTotal = 0;
    const accumData = chartDataset.map(d => {
      const sum = sortedLines.reduce((acc, p) => acc + (Number(d[p]) || 0), 0);
      runTotal += sum;
      return runTotal;
    });

    // Calculate Accumulated Target
    let runTarget = 0;
    const targetAccumData = chartDataset.map(d => {
      runTarget += Number(d.target_qty || 0);
      return runTarget;
    });

    const hasTargetData = targetAccumData.some(v => v > 0);
    const seriesList: any[] = [];

    // Target Bar (Solid Opaque RED, straight cut)
    if (hasTargetData) {
      seriesList.push({
        name: 'Actual Target',
        type: 'bar',
        stack: 'target_bar_stack',
        barMaxWidth: dynamicBarSize,
        barGap: '30%',
        itemStyle: {
          color: (params: any) => {
            const rawDate = chartDataset[params.dataIndex]?.raw_date;
            if (selectedDate && rawDate !== selectedDate) {
              return '#ef444440';
            }
            return '#ef4444';
          },
          borderRadius: 0
        },
        animationDuration: 400,
        animationEasing: 'cubicOut',
        animationDurationUpdate: 300,
        animationEasingUpdate: 'cubicOut',
        emphasis: {
          itemStyle: {
            color: '#dc2626'
          }
        },
        labelLayout: {
          hideOverlap: true
        },
        label: {
          show: true,
          position: 'top',
          distance: 6,
          rotate: 90,
          align: 'left',
          verticalAlign: 'middle',
          formatter: (params: any) => {
            const v = Number(params.value);
            if (!v || v <= 0) return '';
            if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
            if (v >= 100000) return Math.round(v / 1000) + 'K';
            if (v >= 1000) {
              const k = v / 1000;
              return (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'K';
            }
            return v.toLocaleString();
          },
          fontSize: 10,
          fontWeight: 500,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          color: '#b91c1c'
        },
        data: chartDataset.map(d => Number(d.target_qty || 0)),
        z: 2
      });
    }

    // Actual Output Bar (Solid Emerald Green #10b981)
    seriesList.push({
      name: 'Actual Output',
      type: 'bar',
      barMaxWidth: dynamicBarSize,
      itemStyle: {
        color: (params: any) => {
          const rawDate = chartDataset[params.dataIndex]?.raw_date;
          if (selectedDate && rawDate !== selectedDate) {
            return '#10b98140';
          }
          return '#10b981';
        },
        borderRadius: 0
      },
      animationDuration: 400,
      animationEasing: 'cubicOut',
      animationDurationUpdate: 300,
      animationEasingUpdate: 'cubicOut',
      emphasis: {
        disabled: true
      },
      labelLayout: {
        hideOverlap: true
      },
      label: {
        show: true,
        position: 'top',
        distance: 6,
        rotate: 90,
        align: 'left',
        verticalAlign: 'middle',
        formatter: (params: any) => {
          const entry = chartDataset[params.dataIndex];
          if (!entry) return '';
          const sum = Number(entry.total) || 0;
          if (!sum || sum <= 0) return '';
          if (sum >= 1000000) return (sum / 1000000).toFixed(1) + 'M';
          if (sum >= 100000) return Math.round(sum / 1000) + 'K';
          if (sum >= 1000) {
            const k = sum / 1000;
            return (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'K';
          }
          return sum.toLocaleString();
        },
        fontSize: 10,
        fontWeight: 500,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: '#047857'
      },
      data: chartDataset.map(d => Number(d.total) || 0),
      z: 5
    });

    const maxDaily = Math.max(
      ...chartDataset.map(d => Number(d.total) || 0),
      ...chartDataset.map(d => Number(d.target_qty || 0)),
      10
    );
    const maxAccum = Math.max(...accumData, ...targetAccumData, 10);
    const niceMaxDaily = getNiceMax(maxDaily, 1.30);
    const niceMaxAccum = getNiceMax(maxAccum, 1.25);

    const lastIdx = chartDataset.length - 1;

    const accumSeriesData = accumData.map((val, idx) => {
      const isEndPoint = idx === lastIdx;
      const showLabel = val > 0 && isEndPoint;

      return {
        value: val,
        label: {
          show: showLabel,
          position: 'top',
          distance: 14,
          offset: [22, -4],
          formatter: (params: any) => {
            const v = Number(params.value);
            if (!v || v <= 0) return '';
            return v.toLocaleString();
          },
          fontSize: 10,
          fontWeight: 700,
          color: '#047857',
          backgroundColor: '#ffffff',
          borderColor: '#10b981',
          borderWidth: 1.2,
          borderRadius: 4,
          padding: [2.5, 6],
          shadowColor: 'rgba(0, 0, 0, 0.08)',
          shadowBlur: 3
        }
      };
    });

    seriesList.push({
      name: 'Acc Output',
      type: 'line',
      yAxisIndex: 1,
      smooth: 0.2,
      symbol: 'circle',
      symbolSize: 6.5,
      showSymbol: true,
      animationDuration: 400,
      animationEasing: 'cubicOut',
      animationDurationUpdate: 300,
      animationEasingUpdate: 'cubicOut',
      labelLine: {
        show: true,
        showAbove: true,
        length2: 8,
        lineStyle: {
          color: '#94a3b8',
          width: 1.2
        }
      },
      emphasis: {
        disabled: true
      },
      itemStyle: {
        color: '#047857',
        borderColor: '#ffffff',
        borderWidth: 1.5
      },
      lineStyle: {
        color: '#047857',
        width: 2.8,
        shadowColor: 'rgba(4, 120, 87, 0.25)',
        shadowBlur: 5
      },
      data: accumSeriesData,
      z: 15
    });

    if (hasTargetData) {
      const targetAccumSeriesData = targetAccumData.map((val, idx) => {
        const isEndPoint = idx === lastIdx;

        return {
          value: val,
          label: {
            show: val > 0 && isEndPoint,
            position: 'top',
            distance: 14,
            offset: [22, -4],
            formatter: (params: any) => {
              const v = Number(params.value);
              if (!v || v <= 0) return '';
              return v.toLocaleString();
            },
            fontSize: 10,
            fontWeight: 700,
            color: '#b91c1c',
            backgroundColor: '#ffffff',
            borderColor: '#dc2626',
            borderWidth: 1.2,
            borderRadius: 4,
            padding: [2.5, 6],
            shadowColor: 'rgba(0, 0, 0, 0.08)',
            shadowBlur: 3
          }
        };
      });

      seriesList.push({
        name: 'Acc Target',
        type: 'line',
        yAxisIndex: 1,
        smooth: 0.2,
        symbol: 'diamond',
        symbolSize: 6.5,
        showSymbol: true,
        animationDuration: 400,
        animationEasing: 'cubicOut',
        animationDurationUpdate: 300,
        animationEasingUpdate: 'cubicOut',
        labelLine: {
          show: true,
          showAbove: true,
          length2: 8,
          lineStyle: {
            color: '#94a3b8',
            width: 1.2
          }
        },
        emphasis: {
          disabled: true
        },
        itemStyle: {
          color: '#dc2626',
          borderColor: '#ffffff',
          borderWidth: 1.5
        },
        lineStyle: {
          color: '#dc2626',
          width: 2.8,
          shadowColor: 'rgba(220, 38, 38, 0.25)',
          shadowBlur: 5
        },
        data: targetAccumSeriesData,
        z: 16
      });
    }

    const currentUnit = unitLabel || (unit || "PCS");

    return {
      animation: true,
      animationDuration: 400,
      animationEasing: 'cubicOut',
      animationDurationUpdate: 300,
      animationEasingUpdate: 'cubicOut',
      grid: {
        top: 65,
        right: 55,
        bottom: 70,
        left: 50,
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        borderWidth: 0,
        padding: 0,
        shadowBlur: 0,
        shadowColor: 'transparent',
        extraCssText: 'box-shadow: none; background: transparent; border: none;',
        axisPointer: {
          type: 'shadow',
          shadowStyle: {
            color: 'rgba(0, 0, 0, 0.04)'
          }
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const dataIndex = params[0].dataIndex;
          const entry = chartDataset[dataIndex];
          if (!entry) return '';

          const total = Number(entry.total) || 0;
          const accumVal = accumData[dataIndex] || 0;
          const dayTargetVal = entry.target_qty || 0;
          const targetAccumVal = targetAccumData[dataIndex] || 0;

          const formattedDate = entry.tooltip_title || entry.date_label || entry.raw_date;

          return `
            <div style="font-family: inherit; font-size: 11px; background: #ffffff; color: #0f172a; border: 1px solid #e2e8f0; border-radius: 6px; width: 195px; box-sizing: border-box; overflow: hidden; box-shadow: 0 8px 20px -4px rgba(0, 0, 0, 0.12);">
              <div style="padding: 5px 10px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 700; font-size: 11px; color: #1e293b;">${formattedDate}</span>
                <span style="font-size: 9.5px; font-weight: 700; color: #64748b; background: #e2e8f0; padding: 0.5px 5px; border-radius: 3px; text-transform: uppercase;">${currentUnit}</span>
              </div>

              <div style="padding: 7px 10px; display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="display: flex; align-items: center; gap: 5px; color: #475569; font-size: 10.5px; font-weight: 600;">
                    <span style="width: 7px; height: 7px; border-radius: 2px; background-color: #10b981; display: inline-block;"></span>
                    Actual Output:
                  </span>
                  <span style="font-family: monospace; font-size: 11.5px; font-weight: 800; color: #059669;">${total.toLocaleString()}</span>
                </div>

                ${dayTargetVal > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="display: flex; align-items: center; gap: 5px; color: #475569; font-size: 10.5px; font-weight: 600;">
                    <span style="width: 7px; height: 7px; border-radius: 2px; background-color: #ef4444; display: inline-block;"></span>
                    Actual Target:
                  </span>
                  <span style="font-family: monospace; font-size: 11.5px; font-weight: 800; color: #dc2626;">${dayTargetVal.toLocaleString()}</span>
                </div>
                ` : ''}

                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="display: flex; align-items: center; gap: 5px; color: #64748b; font-size: 10.5px; font-weight: 500;">
                    <span style="width: 7px; height: 2px; border-radius: 1px; background-color: #00b050; display: inline-block;"></span>
                    Acc Output:
                  </span>
                  <span style="font-family: monospace; font-size: 11.5px; font-weight: 700; color: #007a37;">${accumVal.toLocaleString()}</span>
                </div>

                ${targetAccumVal > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="display: flex; align-items: center; gap: 5px; color: #64748b; font-size: 10.5px; font-weight: 500;">
                    <span style="width: 7px; height: 2px; border-radius: 1px; background-color: #ef4444; display: inline-block;"></span>
                    Acc Target:
                  </span>
                  <span style="font-family: monospace; font-size: 11.5px; font-weight: 700; color: #b91c1c;">${targetAccumVal.toLocaleString()}</span>
                </div>
                ` : ''}
              </div>
            </div>
          `;
        }
      },
      xAxis: {
        type: 'category',
        name: isWeekly ? 'Week' : 'Date',
        nameLocation: 'middle',
        nameGap: isWeekly ? 45 : 58,
        triggerEvent: true,
        nameTextStyle: {
          color: '#64748b',
          fontSize: 11,
          fontWeight: 600
        },
        data: xCategories,
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisTick: {
          show: true,
          alignWithLabel: true,
          length: 5,
          lineStyle: { color: '#94a3b8', width: 1.2 }
        },
        splitLine: {
          show: true,
          lineStyle: {
            type: 'dashed',
            color: '#e2e8f0'
          }
        },
        axisLabel: {
          interval: 0,
          rotate: xCategories.length > 7 ? 45 : 0,
          fontSize: 10,
          color: '#64748b',
          margin: 10
        }
      },
      yAxis: [
        {
          type: 'value',
          name: `Output (${currentUnit})`,
          nameTextStyle: { color: '#64748b', fontSize: 11, fontWeight: 600, padding: [0, 0, 4, 0] },
          axisLine: { show: true, lineStyle: { color: '#cbd5e1' } },
          axisTick: { show: true, length: 5, lineStyle: { color: '#94a3b8', width: 1.2 } },
          splitLine: { lineStyle: { type: 'dashed', color: '#e2e8f0' } },
          axisLabel: {
            fontSize: 10,
            color: '#64748b',
            formatter: (v: number) => {
              if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
              if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
              return String(v);
            }
          },
          max: niceMaxDaily
        },
        {
          type: 'value',
          name: 'Accumulated',
          nameTextStyle: { color: '#047857', fontSize: 11, fontWeight: 600, padding: [0, 0, 4, 0] },
          axisLine: { show: true, lineStyle: { color: '#cbd5e1' } },
          axisTick: { show: true, length: 5, lineStyle: { color: '#94a3b8', width: 1.2 } },
          splitLine: { show: false },
          axisLabel: {
            fontSize: 10,
            color: '#047857',
            formatter: (v: number) => {
              if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
              if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
              return String(v);
            }
          },
          max: niceMaxAccum
        }
      ],
      series: seriesList
    };
  }, [sortedLines, dynamicBarSize, selectedDate, unit]);

  const getChartClickHandler = useCallback((dataset: DailyChartItem[]) => ({
    click: (params: any) => {
      if (!params || !onBarClick) return;
      if (params.componentType === 'xAxis') {
        const found = dataset.find(d => {
          if (d.raw_date && /^\d{4}-\d{2}-\d{2}$/.test(d.raw_date)) {
            const [yyyy, mm, dd] = d.raw_date.split('-');
            return `${dd}/${mm}/${yyyy}` === params.value;
          }
          return d.short_label === params.value || d.date_label === params.value || d.raw_date === params.value;
        });
        if (found?.raw_date) {
          onBarClick(found.raw_date, 'xAxis');
        }
        return;
      }
      if (params.dataIndex !== undefined) {
        const rawDate = dataset[params.dataIndex]?.raw_date;
        if (rawDate) {
          onBarClick(rawDate, params.seriesName);
        }
      }
    }
  }), [onBarClick]);

  // ECharts references for downloading chart images
  const pieceChartRef = useRef<any>(null);
  const sheetChartRef = useRef<any>(null);
  const lotChartRef = useRef<any>(null);
  const singleChartRef = useRef<any>(null);
  const expandedChartRef = useRef<any>(null);

  const handleDownloadChart = useCallback((chartRef: React.RefObject<any>, unitName: string) => {
    const echartsInstance = chartRef.current?.getEchartsInstance?.();
    if (!echartsInstance) return;
    const url = echartsInstance.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#ffffff'
    });
    const now = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.download = `Output_Chart_${unitName}_${now}.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleDownloadExcel = useCallback((dataset: DailyChartItem[], unitName: string) => {
    if (!dataset || dataset.length === 0) return;
    let runActual = 0;
    let runTarget = 0;
    const isWeekly = dataset.some(d =>
      d.granularity === 'weekly' ||
      d.periodType === 'week' ||
      (typeof d.raw_date === 'string' && (d.raw_date.includes('WK') || /^(?:WK|W)\d{4}/.test(d.raw_date)))
    );

    const rows = dataset.map(d => {
      const totalActual = Number(d.total || 0);
      const totalTarget = Number(d.target_qty || 0);
      runActual += totalActual;
      runTarget += totalTarget;
      const diff = runActual - runTarget;
      const kpr = runTarget > 0 ? ((runActual / runTarget) * 100).toFixed(1) + '%' : '0%';

      let dateStr = d.raw_date || '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, day] = dateStr.split('-');
        dateStr = `${day}/${m}/${y}`;
      } else if (d.short_label) {
        dateStr = d.short_label;
      } else if (dateStr.includes('WK')) {
        const [y, wk] = dateStr.split('-');
        const yy = y.slice(-2);
        const wNum = wk.replace(/^[A-Za-z]+/, '');
        dateStr = `WK${yy}${wNum}`;
      }

      const rowObj: Record<string, any> = {
        [isWeekly ? 'Week' : 'Date']: dateStr,
      };
      sortedLines.forEach(line => {
        rowObj[line] = Number(d[line] || 0);
      });
      rowObj[`Actual Output (${unitName})`] = totalActual;
      rowObj[`Actual Target (${unitName})`] = totalTarget;
      rowObj[`Acc Output (${unitName})`] = runActual;
      rowObj[`Acc Target (${unitName})`] = runTarget;
      rowObj[`Balance (${unitName})`] = diff;
      rowObj['KPR (%)'] = kpr;
      return rowObj;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = Object.keys(rows[0] || {}).map(k => {
      const maxLen = Math.max(
        k.length,
        ...rows.map(r => String(r[k] ?? '').length)
      );
      return { wch: Math.min(Math.max(maxLen + 2, 10), 32) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${unitName} Data`);
    const now = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Output_By_Line_${unitName}_${now}.xlsx`);
  }, [sortedLines]);

  return (
    <div className="w-full max-w-full overflow-hidden flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto z-50 flex-wrap">
          {/* Autocomplete Search for Line */}
          <div className="relative w-full sm:w-52" ref={suggestionRef}>
            <input
              type="text"
              placeholder="Search Line..."
              className="input input-sm input-bordered w-full pl-8 pr-7 bg-base-100 shadow-none focus:outline-none focus:ring-0 focus:border-primary"
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowSuggestions(false);
                }
                if (e.key === "Enter") {
                  const q = localSearch.trim().toLowerCase();
                  if (q) {
                    const exactMatch = matches.find(m => m.toLowerCase() === q);
                    const selected = exactMatch ? [exactMatch] : (matches.length > 0 ? matches : activeLines);
                    setTempSelectedLines(selected);
                    setConfirmedLines(selected);
                    onLineFilterChange?.(selected);
                    if (selected.length === 1) {
                      setLocalSearch(selected[0]);
                    }
                  }
                  setShowSuggestions(false);
                }
              }}
            />
            <Search className="w-4 h-4 absolute left-2.5 top-2 text-base-content/50" />
            {(localSearch || (confirmedLines.length > 0 && confirmedLines.length < activeLines.length)) && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch("");
                  setTempSelectedLines(activeLines);
                  setConfirmedLines(activeLines);
                  onLineFilterChange?.(activeLines);
                }}
                className="absolute right-2 top-2 text-base-content/40 hover:text-base-content"
                title="Clear filter & show all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {showSuggestions && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 flex flex-col rounded-lg border border-base-300 bg-base-100 shadow-xl overflow-hidden">
                <div className="p-2 border-b border-base-200 flex justify-between items-center bg-base-200/30">
                  <div className="text-xs font-semibold text-base-content/70">
                    {tempSelectedLines.length} Lines Selected
                  </div>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={selectAllMatches} className="text-[10px] btn btn-xs btn-ghost px-1.5 h-6 min-h-6">All</button>
                    <button type="button" onClick={clearAllMatches} className="text-[10px] btn btn-xs btn-ghost px-1.5 h-6 min-h-6 text-error">Clear</button>
                  </div>
                </div>
                <div className="overflow-y-auto max-h-60 p-1 scrollbar-thin">
                  {visibleMatches.length > 0 ? visibleMatches.map((name) => (
                    <LineCheckboxItem
                      key={name}
                      name={name}
                      checked={tempSelectedSet.has(name)}
                      onToggle={toggleLine}
                    />
                  )) : (
                    <div className="p-3 text-center text-xs text-base-content/50">No matches</div>
                  )}
                  {hiddenCount > 0 && (
                    <div className="px-3 py-2 text-center text-[10px] text-base-content/40 italic border-t border-base-200 mt-1">
                      Type to search all {matches.length} lines...
                    </div>
                  )}
                </div>
                <div className="p-2 border-t border-base-200 bg-base-100">
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="btn btn-primary btn-sm w-full h-8 min-h-8 text-xs font-bold"
                  >
                    Confirm Filter
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Factory Switcher Toggle Group: EFPC vs SMT */}
          {onFactoryChange && (
            <div className="join border border-base-300 rounded-lg p-0.5 bg-base-200/50 shadow-xs">
              <button
                type="button"
                onClick={() => {
                  setLocalSearch("");
                  setShowSuggestions(false);
                  setActiveUnitTab("ALL");
                  setUnitMode?.("Piece");
                  onFactoryChange("EFPC");
                }}
                className={`join-item btn btn-xs font-bold ${selectedFactory === "EFPC"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "btn-ghost text-base-content/70 hover:text-base-content"
                  }`}
              >
                EFPC
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalSearch("");
                  setShowSuggestions(false);
                  setActiveUnitTab("Piece");
                  setUnitMode?.("Piece");
                  onFactoryChange("SMT");
                }}
                className={`join-item btn btn-xs font-bold ${selectedFactory === "SMT"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "btn-ghost text-base-content/70 hover:text-base-content"
                  }`}
              >
                SMT
              </button>
            </div>
          )}

          {/* Unit Toggle Tabs - Only shown for EFPC since SMT only has Piece */}
          {selectedFactory === "EFPC" && multiUnitPreparedData && (
            <div className="join border border-base-300 rounded-lg p-0.5 bg-base-200/50 shadow-xs">
              <button
                type="button"
                onClick={() => handleUnitTabClick("ALL")}
                className={`join-item btn btn-xs font-bold ${activeUnitTab === "ALL" ? "bg-slate-900 text-white shadow-xs" : "btn-ghost text-base-content/70 hover:text-base-content"}`}
              >
                All Units
              </button>
              <button
                type="button"
                onClick={() => handleUnitTabClick("Piece")}
                className={`join-item btn btn-xs font-bold ${activeUnitTab === "Piece" ? "bg-slate-900 text-white shadow-xs" : "btn-ghost text-base-content/70 hover:text-base-content"}`}
              >
                Piece
              </button>
              <button
                type="button"
                onClick={() => handleUnitTabClick("Sheet")}
                className={`join-item btn btn-xs font-bold ${activeUnitTab === "Sheet" ? "bg-slate-900 text-white shadow-xs" : "btn-ghost text-base-content/70 hover:text-base-content"}`}
              >
                Sheet
              </button>
              <button
                type="button"
                onClick={() => handleUnitTabClick("Lot")}
                className={`join-item btn btn-xs font-bold ${activeUnitTab === "Lot" ? "bg-slate-900 text-white shadow-xs" : "btn-ghost text-base-content/70 hover:text-base-content"}`}
              >
                Lot
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Multi-Unit Charts */}
      {multiUnitPreparedData ? (
        <div className="flex flex-col gap-4 w-full mt-2">
          {(selectedFactory === "SMT" || activeUnitTab === "ALL" || activeUnitTab === "Piece") && (
            <div className="bg-base-100 rounded-xl border border-base-300/80 shadow-sm p-4 flex flex-col gap-2">
              <ChartCardHeader
                badge="Piece"
                title={filteredLineTitle}
                unit="Piece"
                hasTarget={hasPieceTarget}
                onExpand={() => setExpandedUnit("Piece")}
                onDownloadExcel={() => handleDownloadExcel(multiUnitPreparedData.pieceData, "Piece")}
                onDownloadChart={() => handleDownloadChart(pieceChartRef, "Piece")}
              />
              {(activeUnitTab === "ALL" || selectedFactory === "SMT") && (
                <MiniKpiCards
                  dataset={multiUnitPreparedData.pieceData}
                  unit="Piece"
                  selectedDate={selectedDate}
                />
              )}
              <div className="w-full h-[460px] min-h-[460px]">
                <ReactECharts
                  ref={pieceChartRef}
                  key={`echarts_piece_${selectedFactory}_${multiUnitPreparedData.pieceData[0]?.granularity || multiUnitPreparedData.pieceData[0]?.periodType || multiUnitPreparedData.pieceData.length}`}
                  option={buildChartOption(multiUnitPreparedData.pieceData, "Piece")}
                  style={{ height: "100%", width: "100%" }}
                  onEvents={getChartClickHandler(multiUnitPreparedData.pieceData)}
                  notMerge={true}
                  lazyUpdate={false}
                />
              </div>
            </div>
          )}

          {selectedFactory === "EFPC" && (activeUnitTab === "ALL" || activeUnitTab === "Sheet") && (
            <div className="bg-base-100 rounded-xl border border-base-300/80 shadow-sm p-4 flex flex-col gap-2">
              <ChartCardHeader
                badge="Sheet"
                title={filteredLineTitle}
                unit="Sheet"
                hasTarget={hasSheetTarget}
                onExpand={() => setExpandedUnit("Sheet")}
                onDownloadExcel={() => handleDownloadExcel(multiUnitPreparedData.sheetData, "Sheet")}
                onDownloadChart={() => handleDownloadChart(sheetChartRef, "Sheet")}
              />
              {activeUnitTab === "ALL" && (
                <MiniKpiCards
                  dataset={multiUnitPreparedData.sheetData}
                  unit="Sheet"
                  selectedDate={selectedDate}
                />
              )}
              <div className="w-full h-[460px] min-h-[460px]">
                <ReactECharts
                  ref={sheetChartRef}
                  key={`echarts_sheet_${selectedFactory}_${multiUnitPreparedData.sheetData[0]?.granularity || multiUnitPreparedData.sheetData[0]?.periodType || multiUnitPreparedData.sheetData.length}`}
                  option={buildChartOption(multiUnitPreparedData.sheetData, "Sheet")}
                  style={{ height: "100%", width: "100%" }}
                  onEvents={getChartClickHandler(multiUnitPreparedData.sheetData)}
                  notMerge={true}
                  lazyUpdate={false}
                />
              </div>
            </div>
          )}

          {selectedFactory === "EFPC" && (activeUnitTab === "ALL" || activeUnitTab === "Lot") && (
            <div className="bg-base-100 rounded-xl border border-base-300/80 shadow-sm p-4 flex flex-col gap-2">
              <ChartCardHeader
                badge="Lot"
                title={filteredLineTitle}
                unit="Lot"
                hasTarget={hasLotTarget}
                onExpand={() => setExpandedUnit("Lot")}
                onDownloadExcel={() => handleDownloadExcel(multiUnitPreparedData.lotData, "Lot")}
                onDownloadChart={() => handleDownloadChart(lotChartRef, "Lot")}
              />
              {activeUnitTab === "ALL" && (
                <MiniKpiCards
                  dataset={multiUnitPreparedData.lotData}
                  unit="Lot"
                  selectedDate={selectedDate}
                />
              )}
              <div className="w-full h-[460px] min-h-[460px]">
                <ReactECharts
                  ref={lotChartRef}
                  key={`echarts_lot_${selectedFactory}_${multiUnitPreparedData.lotData[0]?.granularity || multiUnitPreparedData.lotData[0]?.periodType || multiUnitPreparedData.lotData.length}`}
                  option={buildChartOption(multiUnitPreparedData.lotData, "Lot")}
                  style={{ height: "100%", width: "100%" }}
                  onEvents={getChartClickHandler(multiUnitPreparedData.lotData)}
                  notMerge={true}
                  lazyUpdate={false}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-base-100 rounded-xl border border-base-300/80 shadow-sm p-4 flex flex-col gap-2">
          <ChartCardHeader
            badge={unit}
            title={filteredLineTitle}
            unit={unit}
            hasTarget={hasAnyTargetData}
            onExpand={() => setExpandedUnit("Single")}
            onDownloadExcel={() => handleDownloadExcel(filteredData, unit || "Piece")}
            onDownloadChart={() => handleDownloadChart(singleChartRef, unit || "Piece")}
          />
          {(activeUnitTab === "ALL" || selectedFactory === "SMT") && (
            <MiniKpiCards
              dataset={filteredData}
              unit={unit || "Piece"}
              selectedDate={selectedDate}
            />
          )}

          <div className="w-full h-[460px] min-h-[460px]">
            <ReactECharts
              ref={singleChartRef}
              key={`echarts_${selectedFactory}_${unit}_${filteredData[0]?.granularity || filteredData[0]?.periodType || filteredData.length}`}
              option={buildChartOption(filteredData, unit)}
              style={{ height: "100%", width: "100%" }}
              onEvents={getChartClickHandler(filteredData)}
              notMerge={true}
              lazyUpdate={false}
            />
          </div>
        </div>
      )}

      {/* Fullscreen Expanded Modal */}
      {expandedUnit && expandedInfo && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5 animate-fade-in"
          onClick={() => setExpandedUnit(null)}
        >
          <div
            className="bg-base-100 rounded-2xl border border-base-300 shadow-2xl w-full max-w-[96vw] lg:max-w-[92vw] xl:max-w-[88vw] h-[92vh] flex flex-col p-4 sm:p-5 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="relative flex items-center justify-between pb-2 mb-1 border-b border-base-200/80 shrink-0">
              <div className="flex items-center gap-2">
                <span className="badge badge-md bg-slate-900 text-white font-bold border-none">
                  {expandedInfo.badge}
                </span>
                <span className="text-sm sm:text-base font-bold text-base-content/90">
                  Output Chart ({expandedInfo.badge}) — {filteredLineTitle}
                </span>
              </div>

              {/* Center Legend */}
              <div className="hidden lg:flex items-center justify-center gap-4 flex-wrap select-none">
                <div className="flex items-center gap-1.5 text-xs font-bold text-black">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#10b981] inline-block"></span>
                  <span>Actual Output</span>
                </div>
                {expandedInfo.hasTarget && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-black">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#ef4444] inline-block"></span>
                    <span>Actual Target</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs font-bold text-black">
                  <span className="w-2.5 h-0.5 bg-[#047857] inline-block"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#047857] inline-block -ml-1.5"></span>
                  <span>Acc Output</span>
                </div>
                {expandedInfo.hasTarget && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-black">
                    <span className="w-3 h-0.5 bg-[#dc2626] inline-block"></span>
                    <span className="w-1.5 h-1.5 rotate-45 bg-[#dc2626] inline-block -ml-1.5"></span>
                    <span>Acc Target</span>
                  </div>
                )}
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xs text-base-content/50 font-medium">
                  Unit: {expandedInfo.unit}
                </span>
                <ChartDownloadDropdown
                  onDownloadExcel={() => handleDownloadExcel(expandedInfo.dataset, expandedInfo.unit)}
                  onDownloadChart={() => handleDownloadChart(expandedChartRef, expandedInfo.unit)}
                />
                <button
                  type="button"
                  onClick={() => setExpandedUnit(null)}
                  className="btn btn-sm btn-circle btn-ghost text-base-content/70 hover:bg-base-200"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mini KPI Cards in Modal */}
            <div className="shrink-0 mb-1 w-full">
              <MiniKpiCards
                dataset={expandedInfo.dataset}
                unit={expandedInfo.unit}
                selectedDate={selectedDate}
                isExpanded={true}
              />
            </div>

            {/* Expanded ECharts */}
            <div className="flex-1 w-full min-h-0 pt-1">
              <ReactECharts
                ref={expandedChartRef}
                key={`echarts_expanded_${expandedUnit}_${expandedInfo.dataset.length}`}
                option={buildChartOption(expandedInfo.dataset, expandedInfo.unit)}
                style={{ height: "100%", width: "100%" }}
                onEvents={getChartClickHandler(expandedInfo.dataset)}
                notMerge={true}
                lazyUpdate={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(LineDateChart);
