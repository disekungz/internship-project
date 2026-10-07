import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import {
  X,
  Save,
  RotateCcw,
  Calendar,
  Search,
  FileSpreadsheet,
  TrendingUp,
  Download,
  Upload,
  ChevronDown,
  AlertTriangle,
  Info,
  Trash2,
  Copy,
} from "lucide-react";
import { LineGroup } from "../../types";
import { normalizeMatrixLineGroupName } from "../../hooks/useProcessOutputData";
import {
  fetchMatrixTargetsData,
  saveMatrixTargetsData,
  fetchMatTargetsData,
  saveMatTargetsData,
  fetchSmtDailyActualOutput,
  fetchFpcDailyActualPlan,
  PRODUCTIVITY_ENDPOINTS,
  MatTargetItem,
} from "../../services/productivityApi";
import { getApiBaseUrl } from "../../../../../utils/apiConfig";

export interface ManualMatrixEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lineGroups: LineGroup[];
  initialYear?: number;
  initialMonth?: number; // 1-12
}

type EntryMode = "TARGET" | "PLAN";
type TargetMetric = "pcs_prod_target" | "sht_prod_target";
type PlanMetric = "pcs_plan" | "sht_plan" | "lot_plan";
// For LINE MAT: "pd" = PD_Prod Target (pd_prod_target), "mos" = MOS Target (sht_prod_target)
type MatTargetMode = "pd" | "mos";


export const cleanNumberString = (v: any, isTarget: boolean = false): string => {
  if (v === undefined || v === null || v === "") return "";
  const num = Number(String(v).replace(/,/g, "").trim());
  if (isNaN(num) || num === 0) return "";
  if (isTarget) {
    return num.toFixed(2);
  }
  if (Number.isInteger(num) || num % 1 === 0) {
    return String(Math.round(num));
  }
  return String(parseFloat(num.toFixed(2)));
};

export const formatDisplayNumber = (val: string | undefined | null, isTarget: boolean = false): string => {
  if (!val || val.trim() === "" || val === "-") return "";
  const num = Number(String(val).replace(/,/g, ""));
  if (isNaN(num) || num === 0) return "";
  if (isTarget) {
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (Number.isInteger(num) || num % 1 === 0) {
    return Math.round(num).toLocaleString();
  }
  return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

// --- Custom Confirm Dialog Component ---
type AlertType = "success" | "error" | "warning" | "info";

interface ConfirmState {
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmColor?: string;
}

const ConfirmDialog: React.FC<{ confirm: ConfirmState }> = ({ confirm }) => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={confirm.onCancel} />
      <div className="relative bg-white rounded-xl border border-slate-200 shadow-xl max-w-xs w-[90%] overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-amber-100 text-amber-600">
              <AlertTriangle className="h-4 w-4" strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{confirm.title}</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{confirm.text}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 pb-4">
          <button
            onClick={confirm.onCancel}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            {confirm.cancelLabel}
          </button>
          <button
            onClick={confirm.onConfirm}
            className={`px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors cursor-pointer ${
              confirm.confirmColor === "red"
                ? "bg-red-500 hover:bg-red-600"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {confirm.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- High-Performance Memoized Matrix Components ---
export interface MonthDateItem {
  dayNum: number;
  dateStr: string;
  dayName: string;
  isWeekend: boolean;
}

const EMPTY_ROW: Record<string, string> = {};

interface MatrixCellProps {
  lineName: string;
  dateStr: string;
  colIdx: number;
  cellVal: string;
  initVal: string;
  isWeekend: boolean;
  entryMode: EntryMode;
  onCellChange: (lineName: string, dateStr: string, rawVal: string) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>, startLine: string, startIndex: number) => void;
}

const MatrixCell: React.FC<MatrixCellProps> = React.memo(({
  lineName,
  dateStr,
  colIdx,
  cellVal,
  initVal,
  isWeekend,
  entryMode,
  onCellChange,
  onPaste,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const isModified = (cellVal || "").trim() !== (initVal || "").trim();
  const isTarget = entryMode === "TARGET";
  const displayVal = isFocused ? cellVal : formatDisplayNumber(cellVal, isTarget);

  return (
    <td
      className={`p-0.5 border-r border-b text-center ${
        isWeekend ? "bg-amber-50/30 border-r-amber-200/80 border-b-slate-200" : "border-slate-200"
      }`}
    >
      <input
        type="text"
        value={displayVal}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          if (cellVal && cellVal.trim() !== "") {
            const cleaned = cleanNumberString(cellVal, isTarget);
            if (cleaned !== cellVal) {
              onCellChange(lineName, dateStr, cleaned);
            }
          }
        }}
        onChange={(e) => onCellChange(lineName, dateStr, e.target.value)}
        onPaste={(e) => onPaste(e, lineName, colIdx)}
        placeholder="-"
        className={`w-full h-7 text-center font-mono text-xs rounded border transition-all px-1 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white ${
          isModified
            ? "bg-amber-50 font-bold text-amber-900 border-amber-300"
            : cellVal
            ? "bg-transparent font-semibold text-slate-800 border-transparent hover:border-slate-300"
            : "bg-transparent text-slate-400 border-transparent hover:border-slate-200"
        }`}
      />
    </td>
  );
});

interface MatrixRowProps {
  lineItem: { name: string; displayName: string; factory: string };
  rowIdx: number;
  dayMap: Record<string, string>;
  initialDayMap: Record<string, string>;
  monthDates: MonthDateItem[];
  entryMode: EntryMode;
  isHighlighted: boolean;
  isSelectedFill: boolean;
  onCellChange: (lineName: string, dateStr: string, rawVal: string) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>, startLine: string, startIndex: number) => void;
  onClearLine: (lineName: string) => void;
  onSelectRow?: (lineName: string) => void;
}

const MatrixRow: React.FC<MatrixRowProps> = React.memo(({
  lineItem,
  rowIdx,
  dayMap,
  initialDayMap,
  monthDates,
  entryMode,
  isHighlighted,
  isSelectedFill,
  onCellChange,
  onPaste,
  onClearLine,
  onSelectRow,
}) => {
  const lineName = lineItem.name;

  let sum = 0;
  let count = 0;
  monthDates.forEach((d) => {
    const val = Number(dayMap[d.dateStr] || 0);
    if (val > 0) {
      sum += val;
      count++;
    }
  });
  const rowMetric = count > 0 ? (entryMode === "TARGET" ? sum / count : sum) : 0;
  const safeRowId = `matrix-row-${lineItem.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  return (
    <tr
      id={safeRowId}
      data-line-name={lineItem.name}
      className={`transition-colors duration-150 group ${
        isHighlighted
          ? "bg-blue-100/70 ring-2 ring-blue-500 ring-inset shadow-xs"
          : isSelectedFill
          ? "bg-blue-50/50"
          : "hover:bg-blue-50/40"
      }`}
    >
      {/* Frozen Left Column: Index + Line Name */}
      <td
        className={`sticky left-0 border-r-2 border-b border-slate-300 px-3 py-1.5 z-10 shadow-xs transition-colors cursor-pointer ${
          isHighlighted
            ? "bg-blue-200 text-blue-950 font-black ring-1 ring-blue-400"
            : isSelectedFill
            ? "bg-blue-100/80 text-blue-950 font-extrabold group-hover:bg-blue-200/70"
            : "bg-slate-50/90 group-hover:bg-blue-100/70"
        }`}
        onClick={() => onSelectRow?.(lineName)}
        title="Click to focus / toggle line selection"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-7 text-center font-mono text-xs shrink-0 ${
              isHighlighted
                ? "font-black text-blue-900"
                : isSelectedFill
                ? "font-black text-blue-800"
                : "font-black text-slate-700"
            }`}
          >
            {rowIdx + 1}
          </span>
          <span
            className={`truncate text-xs tracking-tight ${
              isHighlighted
                ? "font-black text-blue-950"
                : isSelectedFill
                ? "font-black text-blue-900"
                : "font-extrabold text-slate-950"
            }`}
            title={lineItem.displayName}
          >
            {lineItem.displayName}
          </span>
          {isSelectedFill && (
            <span
              className="shrink-0 h-2 w-2 rounded-full bg-blue-500 ml-auto"
              title="Selected in Quick Fill"
            />
          )}
        </div>
      </td>

      {/* Day cells */}
      {monthDates.map((col, colIdx) => (
        <MatrixCell
          key={col.dateStr}
          lineName={lineName}
          dateStr={col.dateStr}
          colIdx={colIdx}
          cellVal={dayMap[col.dateStr] || ""}
          initVal={initialDayMap[col.dateStr] || ""}
          isWeekend={col.isWeekend}
          entryMode={entryMode}
          onCellChange={onCellChange}
          onPaste={onPaste}
        />
      ))}

      {/* Sticky Right: Row summary with clear button on hover */}
      <td
        className={`sticky right-0 border-l-2 border-b border-slate-300 px-2 py-1.5 text-center font-bold font-mono text-xs z-10 shadow-xs relative group/cell transition-colors ${
          isHighlighted
            ? "bg-blue-200/90 text-blue-950 font-black"
            : isSelectedFill
            ? "bg-blue-100/70 text-blue-900"
            : "bg-slate-50 text-slate-800 group-hover:bg-blue-50/90"
        }`}
      >
        <div className="flex items-center justify-center relative">
          <span>
            {rowMetric > 0
              ? rowMetric.toLocaleString(undefined, {
                  minimumFractionDigits: entryMode === "TARGET" ? 2 : 0,
                  maximumFractionDigits: entryMode === "TARGET" ? 2 : 0,
                })
              : "-"}
          </span>
          <button
            type="button"
            onClick={() => onClearLine(lineName)}
            title={`เคลียร์ค่าว่างทั้งแถวของ ${lineItem.displayName}`}
            className="absolute -right-1 text-slate-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-md transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer shadow-2xs border border-transparent hover:border-red-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
});

export const ManualMatrixEntryModal: React.FC<ManualMatrixEntryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  lineGroups,
  initialYear,
  initialMonth,
}) => {
  const now = new Date();
  const [isClosing, setIsClosing] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(initialYear && initialYear >= 2026 ? initialYear : 2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth || now.getMonth() + 1);

  // Sync selectedYear and selectedMonth when modal opens or initial props change
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      if (initialYear && initialYear >= 2026) {
        setSelectedYear(initialYear);
      } else {
        setSelectedYear(2026);
      }
      if (initialMonth && initialMonth >= 1 && initialMonth <= 12) {
        setSelectedMonth(initialMonth);
      }
    }
  }, [isOpen, initialYear, initialMonth]);
  const [entryMode, setEntryMode] = useState<EntryMode>("TARGET");
  const [targetMetric, setTargetMetric] = useState<TargetMetric>("pcs_prod_target");
  const [planMetric, setPlanMetric] = useState<PlanMetric>("pcs_plan");
  const [sectorFilter, setSectorFilter] = useState<"ALL" | "SMT" | "FPC" | "MACRO">("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // LINE MAT specific target state
  // matPdMatrix: { [dateStr]: value } for pd_prod_target (PD)
  // matMosMatrix: { [dateStr]: value } for sht_prod_target (MOS)
  const [matTargetMode, setMatTargetMode] = useState<MatTargetMode>("pd");
  const [matPdMatrix, setMatPdMatrix] = useState<Record<string, string>>({});
  const [initialMatPdMatrix, setInitialMatPdMatrix] = useState<Record<string, string>>({});
  const [matMosMatrix, setMatMosMatrix] = useState<Record<string, string>>({});
  const [initialMatMosMatrix, setInitialMatMosMatrix] = useState<Record<string, string>>({});


  // Grid Data: Record<lineName, Record<dateStr, string>>
  const [matrixValues, setMatrixValues] = useState<Record<string, Record<string, string>>>({});
  const [initialMatrixValues, setInitialMatrixValues] = useState<Record<string, Record<string, string>>>({});
  const [secondaryMatrixValues, setSecondaryMatrixValues] = useState<Record<string, Record<string, string>>>({});
  const [initialSecondaryMatrixValues, setInitialSecondaryMatrixValues] = useState<Record<string, Record<string, string>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopyingPrevious, setIsCopyingPrevious] = useState(false);

  // Quick fill states
  const [monthlyFillValue, setMonthlyFillValue] = useState<string>("");
  const [selectedFillLines, setSelectedFillLines] = useState<Set<string>>(new Set());
  const [highlightedLine, setHighlightedLine] = useState<string | null>(null);
  const [isLineDropdownOpen, setIsLineDropdownOpen] = useState(false);
  const [dropdownLineSearch, setDropdownLineSearch] = useState("");
  const lineDropdownRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const [downloadDropdownOpen, setDownloadDropdownOpen] = useState(false);
  const downloadDropdownRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom confirm state & react-hot-toast alert helper
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const showAlert = useCallback((type: AlertType, title: string, text?: string) => {
    const renderContent = (t: { id: string }) => (
      <div
        className="flex flex-col gap-0.5 text-left cursor-pointer select-none"
        onClick={() => toast.dismiss(t.id)}
        title="คลิกเพื่อปิดการแจ้งเตือน"
      >
        <span className="font-semibold text-sm text-slate-800 leading-snug">{title}</span>
        {text && <span className="text-xs text-slate-500 leading-relaxed">{text}</span>}
      </div>
    );

    if (type === "success") {
      toast.success(renderContent, { duration: 3200 });
    } else if (type === "error") {
      toast.error(renderContent, { duration: 4500 });
    } else if (type === "warning") {
      toast(renderContent, {
        icon: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" strokeWidth={2.2} />,
        duration: 3800,
      });
    } else {
      toast(renderContent, {
        icon: <Info className="h-5 w-5 text-blue-500 shrink-0" strokeWidth={2.2} />,
        duration: 3200,
      });
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (lineDropdownRef.current && !lineDropdownRef.current.contains(event.target as Node)) {
        setIsLineDropdownOpen(false);
      }
      if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(event.target as Node)) {
        setDownloadDropdownOpen(false);
      }
    };
    if (isLineDropdownOpen || downloadDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isLineDropdownOpen, downloadDropdownOpen]);



  // Days in selected month
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Short month label e.g. "Sep"
  const monthShortLabel = useMemo(() => {
    return new Date(selectedYear, selectedMonth - 1, 1)
      .toLocaleString("en-US", { month: "short" });
  }, [selectedYear, selectedMonth]);

  const monthDates = useMemo(() => {
    const list: { dayNum: number; dateStr: string; dayName: string; isWeekend: boolean }[] = [];
    const monthStr = String(selectedMonth).padStart(2, "0");
    const yearStr = String(selectedYear);

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, "0");
      const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
      const dObj = new Date(selectedYear, selectedMonth - 1, day);
      const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;
      const dayName = dObj.toLocaleDateString("en-US", { weekday: "short" });

      list.push({ dayNum: day, dateStr, dayName, isWeekend });
    }
    return list;
  }, [selectedYear, selectedMonth, daysInMonth]);

  // Format line groups for selection and display
  const allFormattedLines = useMemo(() => {
    const seen = new Set<string>();
    const res: { name: string; displayName: string; factory: string }[] = [];

    lineGroups.forEach((lg) => {
      const norm = normalizeMatrixLineGroupName(lg.name);
      if (
        !norm ||
        norm === "UNKNOWN" ||
        norm === "TOTAL" ||
        norm === "SUMMARY" ||
        seen.has(norm.toUpperCase())
      ) {
        return;
      }
      seen.add(norm.toUpperCase());

      let fac = lg.factory || "SMT";
      const upper = norm.toUpperCase();
      if (upper.includes("MACRO")) fac = "MACRO";
      else if (upper.includes("BLK-2") || upper.includes("BLK 2")) {
        fac = "SMT";
      } else if (
        upper.includes("FPC") ||
        upper.startsWith("LINE A") ||
        upper.startsWith("LINE B") ||
        upper.startsWith("LINE C") ||
        upper.startsWith("LINE D") ||
        upper.startsWith("LINE VAC") ||
        upper.startsWith("LINE HPS") ||
        upper.startsWith("LINE LAM") ||
        upper.startsWith("LINE BLK") ||
        upper.startsWith("LINE OST") ||
        upper.startsWith("LINE MAT") ||
        upper.startsWith("AVI") ||
        upper.startsWith("MDS")
      ) {
        fac = "FPC";
      }

      res.push({
        name: norm,
        displayName: norm,
        factory: fac,
      });
    });

    // Ensure LINE MAT is included in allFormattedLines if not already present
    if (!seen.has("LINE MAT") && !seen.has("MAT")) {
      res.push({
        name: "LINE MAT",
        displayName: "LINE MAT",
        factory: "FPC",
      });
    }

    return res.sort((a, b) => {
      if (a.factory !== b.factory) return a.factory.localeCompare(b.factory);
      return a.displayName.localeCompare(b.displayName);
    });
  }, [lineGroups]);

  // Check whether a line supports Sheet metric for Productivity Target
  // FPC lines, LINE OST, and LINE BLK support Sheet & Piece
  // SMT lines and QA lines are Piece only
  const isLineSupportingSheet = useCallback((lineName: string, factory: string) => {
    const upper = lineName.toUpperCase().trim();
    if (
      upper.includes("QA") ||
      upper.includes("QC") ||
      upper.includes("DQA") ||
      upper.includes("MQA") ||
      upper.startsWith("QA ") ||
      upper.startsWith("QA_") ||
      upper === "QA"
    ) {
      return false;
    }
    if (upper.includes("BLK-2") || upper.includes("BLK 2")) {
      return false;
    }
    if (
      upper === "LINE BLK" ||
      upper === "BLK" ||
      upper === "LINE OST" ||
      upper === "OST"
    ) {
      return true;
    }
    return factory === "FPC";
  }, []);

  // Check whether a line is LINE MAT (uses pd_prod_target + sht_prod_target in mat_daily_output)
  const isMatLine = useCallback((lineName: string) => {
    const upper = lineName.toUpperCase().trim();
    return upper === "LINE MAT" || upper === "MAT";
  }, []);

  // Lines matching current mode & metric capability
  const activeLinesForMetric = useMemo(() => {
    if (entryMode === "TARGET" && targetMetric === "sht_prod_target") {
      return allFormattedLines.filter((l) => isLineSupportingSheet(l.name, l.factory));
    }
    return allFormattedLines;
  }, [allFormattedLines, entryMode, targetMetric, isLineSupportingSheet]);

  // Current unit label for display
  const currentMetricUnit = useMemo(() => {
    if (entryMode === "TARGET") {
      return targetMetric === "pcs_prod_target" ? "Pcs" : "Sht";
    }
    if (planMetric === "pcs_plan") return "Pcs";
    if (planMetric === "sht_plan") return "Sht";
    return "Lot";
  }, [entryMode, targetMetric, planMetric]);

  // Reset sectorFilter if currently SMT but metric is Sheet Target
  useEffect(() => {
    if (entryMode === "TARGET" && targetMetric === "sht_prod_target" && sectorFilter === "SMT") {
      setSectorFilter("ALL");
    }
  }, [entryMode, targetMetric, sectorFilter]);

  // Determine whether to show the special LINE MAT dual rows in table
  const showMatSpecialRows = useMemo(() => {
    if (entryMode !== "TARGET") return false;
    if (sectorFilter !== "ALL" && sectorFilter !== "FPC") return false;

    const term = searchTerm.trim().toLowerCase();
    const isSearchingMat =
      term.length > 0 &&
      ("line mat".includes(term) ||
        "mat".includes(term) ||
        "pd target".includes(term) ||
        "mos target".includes(term));

    // If user explicitly searched for MAT, show it even if in Piece mode
    if (isSearchingMat) return true;

    // If there is an active search term not matching MAT, hide MAT rows
    if (term.length > 0) return false;

    // Otherwise (no search query): only show when in Sheet mode (targetMetric === "sht_prod_target")
    return targetMetric === "sht_prod_target";
  }, [entryMode, sectorFilter, searchTerm, targetMetric]);

  // Filtered lines based on sector & search (LINE MAT expands into PD + MOS targets in natural sorted position)
  const displayedLines = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const result: { name: string; displayName: string; factory: string }[] = [];

    activeLinesForMetric.forEach((l) => {
      if (sectorFilter !== "ALL" && l.factory !== sectorFilter) return;

      if (entryMode === "TARGET" && isMatLine(l.name)) {
        if (showMatSpecialRows) {
          const pdItem = {
            name: "__MAT_PD__",
            displayName: "LINE MAT — PD Target (Sht)",
            factory: l.factory || "FPC",
          };
          const mosItem = {
            name: "__MAT_MOS__",
            displayName: "LINE MAT — MOS Target (Sht)",
            factory: l.factory || "FPC",
          };

          if (term) {
            const matchesPd =
              pdItem.displayName.toLowerCase().includes(term) ||
              pdItem.name.toLowerCase().includes(term) ||
              "line mat".includes(term) ||
              "mat".includes(term);
            const matchesMos =
              mosItem.displayName.toLowerCase().includes(term) ||
              mosItem.name.toLowerCase().includes(term) ||
              "line mat".includes(term) ||
              "mat".includes(term);

            if (matchesPd) result.push(pdItem);
            if (matchesMos) result.push(mosItem);
          } else {
            result.push(pdItem);
            result.push(mosItem);
          }
        }
        return;
      }

      if (term) {
        const matches =
          l.displayName.toLowerCase().includes(term) ||
          l.name.toLowerCase().includes(term);
        if (!matches) return;
      }

      result.push(l);
    });

    return result;
  }, [activeLinesForMetric, entryMode, isMatLine, sectorFilter, searchTerm, showMatSpecialRows]);

  // Options for Quick Fill dropdown (includes virtual entries for LINE MAT when in TARGET mode in natural order)
  const fillDropdownOptions = useMemo(() => {
    if (entryMode !== "TARGET") return activeLinesForMetric;

    const res: { name: string; displayName: string; factory: string }[] = [];
    activeLinesForMetric.forEach((l) => {
      if (sectorFilter !== "ALL" && l.factory !== sectorFilter) return;

      if (isMatLine(l.name)) {
        if (targetMetric === "sht_prod_target" || showMatSpecialRows) {
          res.push({
            name: "__MAT_PD__",
            displayName: "LINE MAT — PD Target (Sht)",
            factory: l.factory || "FPC",
          });
          res.push({
            name: "__MAT_MOS__",
            displayName: "LINE MAT — MOS Target (Sht)",
            factory: l.factory || "FPC",
          });
        }
      } else {
        res.push(l);
      }
    });

    return res;
  }, [activeLinesForMetric, entryMode, isMatLine, sectorFilter, targetMetric, showMatSpecialRows]);

  // Filtered lines for fill dropdown
  const filteredDropdownLines = useMemo(() => {
    if (!dropdownLineSearch.trim()) return fillDropdownOptions;
    const q = dropdownLineSearch.toLowerCase().trim();
    return fillDropdownOptions.filter(
      (l) => l.displayName.toLowerCase().includes(q) || l.name.toLowerCase().includes(q)
    );
  }, [fillDropdownOptions, dropdownLineSearch]);

  // Load existing data from DB
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const monthStr = String(selectedMonth).padStart(2, "0");
      const yearStr = String(selectedYear);
      const startDate = `${yearStr}-${monthStr}-01`;
      const endDate = `${yearStr}-${monthStr}-${String(daysInMonth).padStart(2, "0")}`;

      const newMatrix: Record<string, Record<string, string>> = {};

      if (entryMode === "TARGET") {
        const targetRecords = await fetchMatrixTargetsData(startDate, endDate);

        const pcsMatrix: Record<string, Record<string, string>> = {};
        const shtMatrix: Record<string, Record<string, string>> = {};
        const newPdMatrix: Record<string, string> = {};
        const newMosMatrix: Record<string, string> = {};

        if (Array.isArray(targetRecords)) {
          targetRecords.forEach((item) => {
            if (!item.line || !item.date) return;
            const norm = normalizeMatrixLineGroupName(item.line);

            // Check if this record belongs to LINE MAT
            if (isMatLine(item.line) || norm === "LINE MAT" || norm === "MAT") {
              if (item.pcs_prod_target !== undefined && item.pcs_prod_target !== null && Number(item.pcs_prod_target) > 0) {
                newPdMatrix[item.date] = cleanNumberString(item.pcs_prod_target, true);
              }
              if (item.sht_prod_target !== undefined && item.sht_prod_target !== null && Number(item.sht_prod_target) > 0) {
                newMosMatrix[item.date] = cleanNumberString(item.sht_prod_target, true);
              }
              return;
            }

            if (!pcsMatrix[norm]) pcsMatrix[norm] = {};
            if (!shtMatrix[norm]) shtMatrix[norm] = {};

            if (item.pcs_prod_target !== undefined && item.pcs_prod_target !== null && Number(item.pcs_prod_target) > 0) {
              pcsMatrix[norm][item.date] = cleanNumberString(item.pcs_prod_target, true);
            }
            if (item.sht_prod_target !== undefined && item.sht_prod_target !== null && Number(item.sht_prod_target) > 0) {
              shtMatrix[norm][item.date] = cleanNumberString(item.sht_prod_target, true);
            }
          });
        }

        if (targetMetric === "pcs_prod_target") {
          setMatrixValues(pcsMatrix);
          setInitialMatrixValues(JSON.parse(JSON.stringify(pcsMatrix)));
          setSecondaryMatrixValues(shtMatrix);
          setInitialSecondaryMatrixValues(JSON.parse(JSON.stringify(shtMatrix)));
        } else {
          setMatrixValues(shtMatrix);
          setInitialMatrixValues(JSON.parse(JSON.stringify(shtMatrix)));
          setSecondaryMatrixValues(pcsMatrix);
          setInitialSecondaryMatrixValues(JSON.parse(JSON.stringify(pcsMatrix)));
        }

        setMatPdMatrix(newPdMatrix);
        setInitialMatPdMatrix(JSON.parse(JSON.stringify(newPdMatrix)));
        setMatMosMatrix(newMosMatrix);
        setInitialMatMosMatrix(JSON.parse(JSON.stringify(newMosMatrix)));

      } else {
        // Plan Mode
        const [smtPlans, fpcPlans] = await Promise.all([
          fetchSmtDailyActualOutput(startDate, endDate).catch(() => []),
          fetchFpcDailyActualPlan(startDate, endDate).catch(() => []),
        ]);

        const pcsPlanMatrix: Record<string, Record<string, string>> = {};
        const shtPlanMatrix: Record<string, Record<string, string>> = {};

        if (Array.isArray(smtPlans)) {
          smtPlans.forEach((item: any) => {
            if (!item.line || !item.date) return;
            const norm = normalizeMatrixLineGroupName(item.line);
            if (!pcsPlanMatrix[norm]) pcsPlanMatrix[norm] = {};
            if (item.daily_plan !== undefined && item.daily_plan !== null && Number(item.daily_plan) > 0) {
              pcsPlanMatrix[norm][item.date] = cleanNumberString(item.daily_plan);
            }
          });
        }

        if (Array.isArray(fpcPlans)) {
          fpcPlans.forEach((item: any) => {
            if (!item.line || !item.date) return;
            const norm = normalizeMatrixLineGroupName(item.line);
            if (!pcsPlanMatrix[norm]) pcsPlanMatrix[norm] = {};
            if (!shtPlanMatrix[norm]) shtPlanMatrix[norm] = {};

            if (item.piece_plan !== undefined && item.piece_plan !== null && Number(item.piece_plan) > 0) {
              pcsPlanMatrix[norm][item.date] = cleanNumberString(item.piece_plan);
            }
            if (item.sht_plan !== undefined && item.sht_plan !== null && Number(item.sht_plan) > 0) {
              shtPlanMatrix[norm][item.date] = cleanNumberString(item.sht_plan);
            }
          });
        }

        if (planMetric === "sht_plan") {
          setMatrixValues(shtPlanMatrix);
          setInitialMatrixValues(JSON.parse(JSON.stringify(shtPlanMatrix)));
          setSecondaryMatrixValues(pcsPlanMatrix);
          setInitialSecondaryMatrixValues(JSON.parse(JSON.stringify(pcsPlanMatrix)));
        } else {
          setMatrixValues(pcsPlanMatrix);
          setInitialMatrixValues(JSON.parse(JSON.stringify(pcsPlanMatrix)));
          setSecondaryMatrixValues(shtPlanMatrix);
          setInitialSecondaryMatrixValues(JSON.parse(JSON.stringify(shtPlanMatrix)));
        }
      }
    } catch (err) {
      console.error("Failed loading matrix data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonth, daysInMonth, entryMode]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // Handle cell value change
  const handleCellChange = useCallback((lineName: string, dateStr: string, rawVal: string) => {
    let clean = rawVal.replace(/[^0-9.]/g, "");
    const parts = clean.split(".");
    if (parts.length > 2) {
      clean = parts[0] + "." + parts.slice(1).join("");
    }
    if (lineName === "__MAT_PD__") {
      setMatPdMatrix((prev) => ({ ...prev, [dateStr]: clean }));
      return;
    }
    if (lineName === "__MAT_MOS__") {
      setMatMosMatrix((prev) => ({ ...prev, [dateStr]: clean }));
      return;
    }
    setMatrixValues((prev) => ({
      ...prev,
      [lineName]: {
        ...(prev[lineName] || {}),
        [dateStr]: clean,
      },
    }));
  }, []);

  // Check unsaved changes count (includes MAT targets)
  const unsavedChangesCount = useMemo(() => {
    let diff = 0;
    const allLines = new Set([
      ...Object.keys(matrixValues),
      ...Object.keys(initialMatrixValues),
      ...Object.keys(secondaryMatrixValues),
      ...Object.keys(initialSecondaryMatrixValues),
    ]);

    allLines.forEach((line) => {
      monthDates.forEach((d) => {
        const cur = (matrixValues[line]?.[d.dateStr] || "").trim();
        const init = (initialMatrixValues[line]?.[d.dateStr] || "").trim();
        if (cur !== init) diff++;

        const curSec = (secondaryMatrixValues[line]?.[d.dateStr] || "").trim();
        const initSec = (initialSecondaryMatrixValues[line]?.[d.dateStr] || "").trim();
        if (curSec !== initSec) diff++;
      });
    });

    // MAT targets changes
    monthDates.forEach((d) => {
      const curPd = (matPdMatrix[d.dateStr] || "").trim();
      const initPd = (initialMatPdMatrix[d.dateStr] || "").trim();
      if (curPd !== initPd) diff++;

      const curMos = (matMosMatrix[d.dateStr] || "").trim();
      const initMos = (initialMatMosMatrix[d.dateStr] || "").trim();
      if (curMos !== initMos) diff++;
    });

    return diff;
  }, [matrixValues, initialMatrixValues, secondaryMatrixValues, initialSecondaryMatrixValues, matPdMatrix, initialMatPdMatrix, matMosMatrix, initialMatMosMatrix, monthDates]);


  // Focus and scroll to a line row in the table
  const scrollToAndFocusLine = useCallback(
    (lineName: string, focusFirstInput = false) => {
      // If line is hidden by sectorFilter or searchTerm, adjust them
      if (lineName === "__MAT_PD__" || lineName === "__MAT_MOS__") {
        if (sectorFilter !== "ALL" && sectorFilter !== "FPC") {
          setSectorFilter("ALL");
        }
        if (searchTerm.trim()) {
          const term = searchTerm.trim().toLowerCase();
          const match = "line mat".includes(term) || "mat".includes(term);
          if (!match) setSearchTerm("");
        }
      } else {
        const lineObj = activeLinesForMetric.find((l) => l.name === lineName);
        if (lineObj) {
          if (sectorFilter !== "ALL" && lineObj.factory !== sectorFilter) {
            setSectorFilter("ALL");
          }
          if (searchTerm.trim()) {
            const term = searchTerm.trim().toLowerCase();
            const match =
              lineObj.displayName.toLowerCase().includes(term) ||
              lineObj.name.toLowerCase().includes(term);
            if (!match) {
              setSearchTerm("");
            }
          }
        }
      }

      setHighlightedLine(lineName);

      // Locate row element and scroll into view smoothly within the table container
      const safeId = `matrix-row-${lineName.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
      let attempts = 0;
      const tryScroll = () => {
        const rowEl = document.getElementById(safeId);
        const container = tableContainerRef.current;
        if (rowEl && container) {
          const containerRect = container.getBoundingClientRect();
          const rowRect = rowEl.getBoundingClientRect();
          const relativeTop = rowRect.top - containerRect.top;
          const targetScrollTop =
            container.scrollTop +
            relativeTop -
            container.clientHeight / 2 +
            rowRect.height / 2;

          container.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: "smooth",
          });

          if (focusFirstInput) {
            const inputEl = rowEl.querySelector("input");
            if (inputEl) {
              inputEl.focus();
            }
          }
        } else if (attempts < 6) {
          attempts++;
          setTimeout(tryScroll, 35);
        }
      };

      setTimeout(tryScroll, 40);
    },
    [activeLinesForMetric, sectorFilter, searchTerm]
  );

  const handleSelectTableRow = useCallback(
    (lineName: string) => {
      scrollToAndFocusLine(lineName);
      setSelectedFillLines((prev) => {
        const next = new Set(prev);
        if (next.has(lineName)) {
          next.delete(lineName);
        } else {
          next.add(lineName);
        }
        return next;
      });
    },
    [scrollToAndFocusLine]
  );

  // Quick fill handlers
  const handleSelectAllFillLines = () => {
    setSelectedFillLines(new Set(fillDropdownOptions.map((l) => l.name)));
    if (fillDropdownOptions.length > 0) {
      scrollToAndFocusLine(fillDropdownOptions[0].name);
    }
  };

  const handleSelectSmtFillLines = () => {
    const smtLines = fillDropdownOptions.filter((l) => l.factory === "SMT");
    setSelectedFillLines(
      new Set(smtLines.map((l) => l.name))
    );
    if (smtLines.length > 0) {
      scrollToAndFocusLine(smtLines[0].name);
    }
  };

  const handleSelectFpcFillLines = () => {
    const fpcLines = fillDropdownOptions.filter((l) => l.factory === "FPC");
    setSelectedFillLines(
      new Set(fpcLines.map((l) => l.name))
    );
    if (fpcLines.length > 0) {
      scrollToAndFocusLine(fpcLines[0].name);
    }
  };

  // Prune any selectedFillLines that are not present in fillDropdownOptions
  useEffect(() => {
    setSelectedFillLines((prev) => {
      const activeSet = new Set(fillDropdownOptions.map((l) => l.name));
      const next = new Set(Array.from(prev).filter((name) => activeSet.has(name)));
      return next.size === prev.size ? prev : next;
    });
  }, [fillDropdownOptions]);

  const handleClearFillLines = () => {
    setSelectedFillLines(new Set());
    setHighlightedLine(null);
  };

  const toggleFillLine = (lineName: string) => {
    setSelectedFillLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineName)) {
        next.delete(lineName);
      } else {
        next.add(lineName);
      }
      return next;
    });
    scrollToAndFocusLine(lineName);
  };

  const handleApplyMonthlyFill = () => {
    const val = cleanNumberString(monthlyFillValue.trim(), entryMode === "TARGET");
    if (!val || selectedFillLines.size === 0) return;

    setMatrixValues((prev) => {
      const next = { ...prev };
      selectedFillLines.forEach((lineName) => {
        if (lineName === "__MAT_PD__" || lineName === "__MAT_MOS__") return;
        const lineObj = { ...(next[lineName] || {}) };
        monthDates.forEach((d) => {
          lineObj[d.dateStr] = val;
        });
        next[lineName] = lineObj;
      });
      return next;
    });

    if (selectedFillLines.has("__MAT_PD__")) {
      setMatPdMatrix((prev) => {
        const next = { ...prev };
        monthDates.forEach((d) => {
          next[d.dateStr] = val;
        });
        return next;
      });
    }

    if (selectedFillLines.has("__MAT_MOS__")) {
      setMatMosMatrix((prev) => {
        const next = { ...prev };
        monthDates.forEach((d) => {
          next[d.dateStr] = val;
        });
        return next;
      });
    }
  };

  const handleApplyMonthlyClear = () => {
    if (selectedFillLines.size === 0) return;
    setMatrixValues((prev) => {
      const next = { ...prev };
      selectedFillLines.forEach((lineName) => {
        if (lineName === "__MAT_PD__" || lineName === "__MAT_MOS__") return;
        const lineObj = { ...(next[lineName] || {}) };
        monthDates.forEach((d) => {
          lineObj[d.dateStr] = "";
        });
        next[lineName] = lineObj;
      });
      return next;
    });

    if (selectedFillLines.has("__MAT_PD__")) {
      setMatPdMatrix((prev) => {
        const next = { ...prev };
        monthDates.forEach((d) => {
          next[d.dateStr] = "";
        });
        return next;
      });
    }

    if (selectedFillLines.has("__MAT_MOS__")) {
      setMatMosMatrix((prev) => {
        const next = { ...prev };
        monthDates.forEach((d) => {
          next[d.dateStr] = "";
        });
        return next;
      });
    }
  };

  // Clear single line in matrix
  const handleClearLineData = useCallback((lineName: string) => {
    if (lineName === "__MAT_PD__") {
      setMatPdMatrix((prev) => {
        const next = { ...prev };
        monthDates.forEach((d) => {
          next[d.dateStr] = "";
        });
        return next;
      });
      return;
    }
    if (lineName === "__MAT_MOS__") {
      setMatMosMatrix((prev) => {
        const next = { ...prev };
        monthDates.forEach((d) => {
          next[d.dateStr] = "";
        });
        return next;
      });
      return;
    }
    setMatrixValues((prev) => {
      const updated = { ...prev };
      const lineObj = { ...(updated[lineName] || {}) };
      monthDates.forEach((d) => {
        lineObj[d.dateStr] = "";
      });
      updated[lineName] = lineObj;
      return updated;
    });
  }, [monthDates]);

  // Excel Paste support for a cell
  const handlePaste = useCallback((
    e: React.ClipboardEvent<HTMLInputElement>,
    startLine: string,
    startIndex: number
  ) => {
    const pasteData = e.clipboardData.getData("text");
    if (!pasteData || (!pasteData.includes("\t") && !pasteData.includes("\n"))) {
      return; // Normal single cell paste
    }

    e.preventDefault();
    const rows = pasteData.trim().split(/\r?\n/);
    const lineIndex = displayedLines.findIndex((l) => l.name === startLine);
    if (lineIndex === -1) return;

    rows.forEach((rowStr, rOffset) => {
      const targetLineItem = displayedLines[lineIndex + rOffset];
      if (!targetLineItem) return;
      const lineKey = targetLineItem.name;
      const cells = rowStr.split("\t");

      if (lineKey === "__MAT_PD__") {
        setMatPdMatrix((prev) => {
          const next = { ...prev };
          cells.forEach((cellVal, cOffset) => {
            const dateItem = monthDates[startIndex + cOffset];
            if (!dateItem) return;
            const cleanNum = cleanNumberString(cellVal, true);
            if (cleanNum && !isNaN(Number(cleanNum))) {
              next[dateItem.dateStr] = cleanNum;
            }
          });
          return next;
        });
        return;
      }

      if (lineKey === "__MAT_MOS__") {
        setMatMosMatrix((prev) => {
          const next = { ...prev };
          cells.forEach((cellVal, cOffset) => {
            const dateItem = monthDates[startIndex + cOffset];
            if (!dateItem) return;
            const cleanNum = cleanNumberString(cellVal, true);
            if (cleanNum && !isNaN(Number(cleanNum))) {
              next[dateItem.dateStr] = cleanNum;
            }
          });
          return next;
        });
        return;
      }

      setMatrixValues((prev) => {
        const next = { ...prev };
        const lineObj = { ...(next[lineKey] || {}) };
        cells.forEach((cellVal, cOffset) => {
          const dateItem = monthDates[startIndex + cOffset];
          if (!dateItem) return;
          const cleanNum = cleanNumberString(cellVal, entryMode === "TARGET");
          if (cleanNum && !isNaN(Number(cleanNum))) {
            lineObj[dateItem.dateStr] = cleanNum;
          }
        });
        next[lineKey] = lineObj;
        return next;
      });
    });
  }, [displayedLines, monthDates, entryMode]);

  // Copy target data from previous month to current month
  const handleCopyFromPreviousMonth = async () => {
    let prevYear = selectedYear;
    let prevMonth = selectedMonth - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = selectedYear - 1;
    }

    const prevMonthLabel = `${String(prevMonth).padStart(2, "0")}/${prevYear}`;
    const curMonthLabel = `${String(selectedMonth).padStart(2, "0")}/${selectedYear}`;

    const confirmRes = await Swal.fire({
      title: "คัดลอก Target จากเดือนก่อนหน้า?",
      html: `
        <div style="text-align: left; font-size: 13px; color: #475569; line-height: 1.6;">
          <p>ต้องการคัดลอกค่าเป้าหมาย (Target) จากเดือน <b>${prevMonthLabel}</b> มาใส่ในเดือน <b>${curMonthLabel}</b> หรือไม่?</p>
          <div style="margin-top: 8px; padding: 8px 12px; background: #f1f5f9; border-radius: 8px; font-size: 12px; color: #334155;">
            <div>• คัดลอกค่า Target ของทุกไลน์กลุ่ม (ทั้ง Sheet และ Piece)</div>
            <div>• รวมค่าเป้าหมายของ LINE MAT (PD Target และ MOS Target)</div>
            <div>• สามารถตรวจสอบและแก้ไขตัวเลขก่อนกดบันทึกได้</div>
          </div>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#64748b",
      confirmButtonText: "ใช่, คัดลอกข้อมูล",
      cancelButtonText: "ยกเลิก",
      reverseButtons: true,
    });

    if (!confirmRes.isConfirmed) return;

    setIsCopyingPrevious(true);
    try {
      const prevDaysInMonth = new Date(prevYear, prevMonth, 0).getDate();
      const prevStartDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
      const prevEndDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(prevDaysInMonth).padStart(2, "0")}`;

      const prevRecords = await fetchMatrixTargetsData(prevStartDate, prevEndDate);

      if (!Array.isArray(prevRecords) || prevRecords.length === 0) {
        Swal.fire({
          title: "ไม่พบข้อมูลเป้าหมาย",
          text: `ไม่พบข้อมูล Target ที่บันทึกไว้ในเดือนก่อนหน้า (${prevMonthLabel})`,
          icon: "info",
          confirmButtonColor: "#4f46e5",
        });
        return;
      }

      // Map targets per line from previous month
      const lineTargetsMap: Record<string, {
        latestPcs: string;
        latestSht: string;
        dailyPcs: Record<number, string>;
        dailySht: Record<number, string>;
      }> = {};

      const matPdDaily: Record<number, string> = {};
      const matMosDaily: Record<number, string> = {};
      let matLatestPd = "";
      let matLatestMos = "";

      prevRecords.forEach((item) => {
        if (!item.line || !item.date) return;
        const norm = normalizeMatrixLineGroupName(item.line);
        const dayMatch = item.date.match(/-(\d{2})$/);
        const dayNum = dayMatch ? parseInt(dayMatch[1], 10) : 1;

        if (isMatLine(item.line) || norm === "LINE MAT" || norm === "MAT") {
          if (item.pcs_prod_target !== undefined && item.pcs_prod_target !== null && Number(item.pcs_prod_target) > 0) {
            const cleanVal = cleanNumberString(item.pcs_prod_target, true);
            matPdDaily[dayNum] = cleanVal;
            matLatestPd = cleanVal;
          }
          if (item.sht_prod_target !== undefined && item.sht_prod_target !== null && Number(item.sht_prod_target) > 0) {
            const cleanVal = cleanNumberString(item.sht_prod_target, true);
            matMosDaily[dayNum] = cleanVal;
            matLatestMos = cleanVal;
          }
          return;
        }

        if (!lineTargetsMap[norm]) {
          lineTargetsMap[norm] = { latestPcs: "", latestSht: "", dailyPcs: {}, dailySht: {} };
        }

        if (item.pcs_prod_target !== undefined && item.pcs_prod_target !== null && Number(item.pcs_prod_target) > 0) {
          const cleanVal = cleanNumberString(item.pcs_prod_target, true);
          lineTargetsMap[norm].dailyPcs[dayNum] = cleanVal;
          lineTargetsMap[norm].latestPcs = cleanVal;
        }

        if (item.sht_prod_target !== undefined && item.sht_prod_target !== null && Number(item.sht_prod_target) > 0) {
          const cleanVal = cleanNumberString(item.sht_prod_target, true);
          lineTargetsMap[norm].dailySht[dayNum] = cleanVal;
          lineTargetsMap[norm].latestSht = cleanVal;
        }
      });

      const curYearStr = String(selectedYear);
      const curMonthStr = String(selectedMonth).padStart(2, "0");

      const nextPcsMatrix: Record<string, Record<string, string>> = JSON.parse(JSON.stringify(
        targetMetric === "pcs_prod_target" ? matrixValues : secondaryMatrixValues
      ));
      const nextShtMatrix: Record<string, Record<string, string>> = JSON.parse(JSON.stringify(
        targetMetric === "sht_prod_target" ? matrixValues : secondaryMatrixValues
      ));
      const nextMatPd: Record<string, string> = { ...matPdMatrix };
      const nextMatMos: Record<string, string> = { ...matMosMatrix };

      let filledLineCount = 0;

      Object.keys(lineTargetsMap).forEach((norm) => {
        const tData = lineTargetsMap[norm];
        if (!tData.latestPcs && !tData.latestSht && Object.keys(tData.dailyPcs).length === 0 && Object.keys(tData.dailySht).length === 0) return;

        if (!nextPcsMatrix[norm]) nextPcsMatrix[norm] = {};
        if (!nextShtMatrix[norm]) nextShtMatrix[norm] = {};

        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${curYearStr}-${curMonthStr}-${String(d).padStart(2, "0")}`;
          const pcsVal = tData.dailyPcs[d] || tData.latestPcs;
          const shtVal = tData.dailySht[d] || tData.latestSht;

          if (pcsVal) nextPcsMatrix[norm][dateStr] = pcsVal;
          if (shtVal) nextShtMatrix[norm][dateStr] = shtVal;
        }
        filledLineCount++;
      });

      // Populate LINE MAT
      if (matLatestPd || matLatestMos || Object.keys(matPdDaily).length > 0 || Object.keys(matMosDaily).length > 0) {
        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${curYearStr}-${curMonthStr}-${String(d).padStart(2, "0")}`;
          const pdVal = matPdDaily[d] || matLatestPd;
          const mosVal = matMosDaily[d] || matLatestMos;

          if (pdVal) nextMatPd[dateStr] = pdVal;
          if (mosVal) nextMatMos[dateStr] = mosVal;
        }
        filledLineCount++;
      }

      if (filledLineCount === 0) {
        Swal.fire({
          title: "ไม่พบข้อมูลเป้าหมาย",
          text: `ไม่พบค่า Target ในเดือนก่อนหน้า (${prevMonthLabel})`,
          icon: "info",
          confirmButtonColor: "#4f46e5",
        });
        return;
      }

      if (targetMetric === "pcs_prod_target") {
        setMatrixValues(nextPcsMatrix);
        setSecondaryMatrixValues(nextShtMatrix);
      } else {
        setMatrixValues(nextShtMatrix);
        setSecondaryMatrixValues(nextPcsMatrix);
      }
      setMatPdMatrix(nextMatPd);
      setMatMosMatrix(nextMatMos);

      Swal.fire({
        title: "คัดลอกข้อมูลสำเร็จ",
        text: `คัดลอกเป้าหมาย Target จากเดือน ${prevMonthLabel} มาใส่ในเดือน ${curMonthLabel} เรียบร้อยแล้ว (รวม ${filledLineCount} ไลน์) ท่านสามารถตรวจสอบและกดบันทึกข้อมูลได้`,
        icon: "success",
        confirmButtonColor: "#10b981",
        timer: 3000,
      });

    } catch (err: any) {
      console.error("Error copying targets from previous month:", err);
      Swal.fire({
        title: "เกิดข้อผิดพลาด",
        text: "ไม่สามารถคัดลอกข้อมูลได้: " + (err.message || "Unknown error"),
        icon: "error",
        confirmButtonColor: "#4f46e5",
      });
    } finally {
      setIsCopyingPrevious(false);
    }
  };

  // Save all changes to DB
  const handleSaveAll = async () => {
    if (unsavedChangesCount === 0) {
      showAlert("info", "ไม่มีข้อมูลที่เปลี่ยนแปลง", "ข้อมูลในตารางยังไม่มีการแก้ไข");
      return;
    }

    setIsSaving(true);
    try {
      const monthLabel = `${String(selectedMonth).padStart(2, "0")}/${selectedYear}`;

      if (entryMode === "TARGET") {
        // Collect target records to save (only send modified cells)
        const recordsToSave: MatrixTargetRecord[] = [];

        // All line keys that exist in current or initial state
        const allTargetLineKeys = new Set([
          ...Object.keys(matrixValues),
          ...Object.keys(initialMatrixValues)
        ]);

        // 1. Primary metric records (only modified cells)
        allTargetLineKeys.forEach((lineName) => {
          monthDates.forEach((d) => {
            const rawVal = (matrixValues[lineName]?.[d.dateStr] || "").trim();
            const initVal = (initialMatrixValues[lineName]?.[d.dateStr] || "").trim();
            if (rawVal !== initVal) {
              const num = rawVal !== "" ? Number(rawVal) : 0;
              if (targetMetric === "pcs_prod_target") {
                recordsToSave.push({
                  line: lineName,
                  date: d.dateStr,
                  pcs_prod_target: num,
                });
              } else {
                recordsToSave.push({
                  line: lineName,
                  date: d.dateStr,
                  sht_prod_target: num,
                });
              }
            }
          });
        });

        // 2. Secondary metric records (only modified cells)
        const allSecondaryLineKeys = new Set([
          ...Object.keys(secondaryMatrixValues),
          ...Object.keys(initialSecondaryMatrixValues)
        ]);
        const secondaryMetric = targetMetric === "pcs_prod_target" ? "sht_prod_target" : "pcs_prod_target";
        allSecondaryLineKeys.forEach((lineName) => {
          monthDates.forEach((d) => {
            const rawVal = (secondaryMatrixValues[lineName]?.[d.dateStr] || "").trim();
            const initVal = (initialSecondaryMatrixValues[lineName]?.[d.dateStr] || "").trim();
            if (rawVal !== initVal) {
              const num = rawVal !== "" ? Number(rawVal) : 0;
              const existing = recordsToSave.find((r) => r.line === lineName && r.date === d.dateStr);
              if (existing) {
                if (secondaryMetric === "pcs_prod_target") existing.pcs_prod_target = num;
                else existing.sht_prod_target = num;
              } else {
                if (secondaryMetric === "pcs_prod_target") {
                  recordsToSave.push({
                    line: lineName,
                    date: d.dateStr,
                    pcs_prod_target: num,
                  });
                } else {
                  recordsToSave.push({
                    line: lineName,
                    date: d.dateStr,
                    sht_prod_target: num,
                  });
                }
              }
            }
          });
        });

        // 3. Collect LINE MAT targets directly into recordsToSave for line_productivity_targets
        // PD Target -> pcs_prod_target, MOS Target -> sht_prod_target
        let matHasChanges = false;
        monthDates.forEach((d) => {
          const pdCur = (matPdMatrix[d.dateStr] || "").trim();
          const pdInit = (initialMatPdMatrix[d.dateStr] || "").trim();
          const mosCur = (matMosMatrix[d.dateStr] || "").trim();
          const mosInit = (initialMatMosMatrix[d.dateStr] || "").trim();

          if (pdCur !== pdInit || mosCur !== mosInit) {
            matHasChanges = true;
            const pdNum = pdCur !== "" ? Number(pdCur) : 0;
            const mosNum = mosCur !== "" ? Number(mosCur) : 0;

            const existing = recordsToSave.find((r) => (r.line === "LINE MAT" || r.line === "MAT") && r.date === d.dateStr);
            if (existing) {
              existing.pcs_prod_target = pdNum;
              existing.sht_prod_target = mosNum;
            } else {
              recordsToSave.push({
                line: "LINE MAT",
                date: d.dateStr,
                pcs_prod_target: pdNum,
                sht_prod_target: mosNum,
              });
            }
          }
        });

        if (recordsToSave.length === 0) {
          showAlert("info", "ไม่มีการเปลี่ยนแปลง", "ไม่พบข้อมูลเป้าหมายที่มีการแก้ไข");
          return;
        }

        const res = await saveMatrixTargetsData(recordsToSave, monthLabel);
        setInitialMatrixValues(JSON.parse(JSON.stringify(matrixValues)));
        setInitialSecondaryMatrixValues(JSON.parse(JSON.stringify(secondaryMatrixValues)));
        if (matHasChanges) {
          setInitialMatPdMatrix(JSON.parse(JSON.stringify(matPdMatrix)));
          setInitialMatMosMatrix(JSON.parse(JSON.stringify(matMosMatrix)));
        }

        showAlert("success", "บันทึก Target สำเร็จ", `บันทึกข้อมูล Productivity Target ประจำเดือน ${monthLabel} จำนวน ${res.count} รายการเรียบร้อยแล้ว`);

      } else {
        // Collect Plan records (only send modified cells)
        const smtRecords: any[] = [];
        const fpcRecords: any[] = [];

        const allPlanLineKeys = new Set([
          ...Object.keys(matrixValues),
          ...Object.keys(initialMatrixValues)
        ]);

        allPlanLineKeys.forEach((lineName) => {
          const matchingItem = allFormattedLines.find((l) => l.name === lineName);
          const isFpc = matchingItem?.factory === "FPC";

          monthDates.forEach((d) => {
            const rawVal = (matrixValues[lineName]?.[d.dateStr] || "").trim();
            const initVal = (initialMatrixValues[lineName]?.[d.dateStr] || "").trim();
            if (rawVal !== initVal) {
              const num = rawVal !== "" ? Number(rawVal) : 0;
              if (isFpc) {
                fpcRecords.push({
                  line: lineName,
                  date: d.dateStr,
                  piece_plan: planMetric === "pcs_plan" ? num : 0,
                  sht_plan: planMetric === "sht_plan" ? num : 0,
                  lot_plan: planMetric === "lot_plan" ? num : 0,
                });
              } else {
                smtRecords.push({
                  line: lineName,
                  date: d.dateStr,
                  daily_plan: num,
                });
              }
            }
          });
        });

        // Also check secondaryMatrixValues for FPC lines (Piece / Sheet dual plan)
        const allSecPlanLineKeys = new Set([
          ...Object.keys(secondaryMatrixValues),
          ...Object.keys(initialSecondaryMatrixValues)
        ]);
        const secondaryPlanMetric = planMetric === "pcs_plan" ? "sht_plan" : "pcs_plan";
        allSecPlanLineKeys.forEach((lineName) => {
          const matchingItem = allFormattedLines.find((l) => l.name === lineName);
          const isFpc = matchingItem?.factory === "FPC";
          if (!isFpc) return;

          monthDates.forEach((d) => {
            const rawVal = (secondaryMatrixValues[lineName]?.[d.dateStr] || "").trim();
            const initVal = (initialSecondaryMatrixValues[lineName]?.[d.dateStr] || "").trim();
            if (rawVal !== initVal) {
              const num = rawVal !== "" ? Number(rawVal) : 0;
              const existing = fpcRecords.find((r) => r.line === lineName && r.date === d.dateStr);
              if (existing) {
                if (secondaryPlanMetric === "pcs_plan") existing.piece_plan = num;
                else if (secondaryPlanMetric === "sht_plan") existing.sht_plan = num;
              } else {
                fpcRecords.push({
                  line: lineName,
                  date: d.dateStr,
                  piece_plan: secondaryPlanMetric === "pcs_plan" ? num : 0,
                  sht_plan: secondaryPlanMetric === "sht_plan" ? num : 0,
                  lot_plan: 0,
                });
              }
            }
          });
        });

        const baseUrl = getApiBaseUrl();
        if (smtRecords.length > 0) {
          const res = await fetch(`${baseUrl}${PRODUCTIVITY_ENDPOINTS.UPLOAD_SMT_DAILY_ACTUAL_OUTPUT}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              records: smtRecords,
              fileName: `Matrix Plan SMT - ${monthLabel}`,
              details: `บันทึกผ่าน Matrix Manual Editor (${smtRecords.length} รายการ)`,
            }),
          });
          if (!res.ok) throw new Error("Failed to save SMT plans");
        }

        if (fpcRecords.length > 0) {
          const res = await fetch(`${baseUrl}${PRODUCTIVITY_ENDPOINTS.UPLOAD_FPC_DAILY_PLAN}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              records: fpcRecords,
              fileName: `Matrix Plan FPC - ${monthLabel}`,
              details: `บันทึกผ่าน Matrix Manual Editor (${fpcRecords.length} รายการ)`,
            }),
          });
          if (!res.ok) throw new Error("Failed to save FPC plans");
        }

        showAlert("success", "บันทึก Daily Plan สำเร็จ", `บันทึกข้อมูล Plan ประจำเดือน ${monthLabel} จำนวน ${smtRecords.length + fpcRecords.length} รายการเรียบร้อยแล้ว`);
      }

      setInitialMatrixValues(JSON.parse(JSON.stringify(matrixValues)));
      setInitialSecondaryMatrixValues(JSON.parse(JSON.stringify(secondaryMatrixValues)));
      setTimeout(() => {
        onSuccess?.();
      }, 60);
    } catch (err: any) {
      console.error("Save matrix error:", err);
      showAlert("error", "เกิดข้อผิดพลาดในการบันทึก", err.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อบันทึกข้อมูลได้");
    } finally {
      setIsSaving(false);
    }
  };

  // Immediate close execution with deferred parent state update
  const executeClose = useCallback(() => {
    setIsClosing(true);
    requestAnimationFrame(() => {
      setTimeout(() => {
        onClose();
      }, 0);
    });
  }, [onClose]);

  // Close confirmation if unsaved changes exist
  const handleClose = () => {
    if (unsavedChangesCount > 0) {
      setConfirmState({
        title: "มีข้อมูลที่ยังไม่ได้บันทึก",
        text: `คุณได้แก้ไขข้อมูลไปแล้ว ${unsavedChangesCount} จุด ต้องการปิดโดยไม่บันทึกหรือไม่?`,
        confirmLabel: "ทิ้งการแก้ไขและปิด",
        cancelLabel: "กลับไปแก้ไขต่อ",
        confirmColor: "red",
        onConfirm: () => {
          setConfirmState(null);
          executeClose();
        },
        onCancel: () => setConfirmState(null),
      });
    } else {
      executeClose();
    }
  };

  // Download Excel Format / Template with professional styling & live formulas
  const handleDownloadExcelTemplate = async ({ includeData = false }: { includeData?: boolean } = {}) => {
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Fujikura Smart Factory System";
      workbook.created = new Date();

      const monthStr = String(selectedMonth).padStart(2, "0");
      const monthLongEn = new Date(selectedYear, selectedMonth - 1, 1).toLocaleString("en-US", { month: "long" });
      const monthShortEn = new Date(selectedYear, selectedMonth - 1, 1).toLocaleString("en-US", { month: "short" });

      const currentDaysCount = new Date(selectedYear, selectedMonth, 0).getDate();
      const currentMonthDates: { dayNum: number; dateStr: string; dayName: string; isWeekend: boolean }[] = [];
      for (let day = 1; day <= currentDaysCount; day++) {
        const dayStr = String(day).padStart(2, "0");
        const dateStr = `${selectedYear}-${monthStr}-${dayStr}`;
        const dObj = new Date(selectedYear, selectedMonth - 1, day);
        const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;
        const dayName = dObj.toLocaleDateString("en-US", { weekday: "short" });
        currentMonthDates.push({ dayNum: day, dateStr, dayName, isWeekend });
      }

      const sheetName = `${monthShortEn}_${selectedYear}_${entryMode === "TARGET" ? "Target" : "Plan"}`;
      const worksheet = workbook.addWorksheet(sheetName.slice(0, 31), {
        views: [{ state: "frozen", xSplit: 3, ySplit: 4 }],
      });

      const totalDays = currentMonthDates.length;
      // Columns: # (1), Line Group (2), Metric (3), Days 1..totalDays (4 .. totalDays + 3), Summary (totalDays + 4)
      const totalColsCount = totalDays + 4;

      // Helper to calculate Excel column letter
      const getColLetter = (n: number) => {
        let s = "";
        while (n > 0) {
          const m = (n - 1) % 26;
          s = String.fromCharCode(65 + m) + s;
          n = Math.floor((n - m) / 26);
        }
        return s;
      };
      const endDayColLetter = getColLetter(totalDays + 3);

      // --- 1. Title Banner (Row 1) ---
      // Left Pane (Cols 1-3, locked with Freeze Pane): Title stays completely fixed in place
      worksheet.mergeCells(1, 1, 1, 3);
      const titleLeftCell = worksheet.getCell(1, 1);
      titleLeftCell.value = `FUJIKURA SMART FACTORY - ${entryMode === "TARGET" ? "TARGET ADJUSTMENT" : "DAILY PLAN"}`;
      titleLeftCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      titleLeftCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } }; // Deep Corporate Navy
      titleLeftCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      titleLeftCell.border = {
        top: { style: "thin", color: { argb: "FF94A3B8" } },
        right: { style: "medium", color: { argb: "FF0F172A" } },
        left: { style: "thin", color: { argb: "FF475569" } },
      };

      // Right Pane (Cols 4..totalColsCount): Clean solid navy banner without text (removed per user request)
      worksheet.mergeCells(1, 4, 1, totalColsCount);
      const titleRightCell = worksheet.getCell(1, 4);
      titleRightCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
      titleRightCell.border = {
        top: { style: "thin", color: { argb: "FF94A3B8" } },
        left: { style: "medium", color: { argb: "FF0F172A" } },
      };
      worksheet.getRow(1).height = 24;

      // --- 2. Month Display (Row 2) ---
      // Left Pane (Cols 1-3, locked with Freeze Pane): Month displayed in first column section
      worksheet.mergeCells(2, 1, 2, 3);
      const subLeftCell = worksheet.getCell(2, 1);
      subLeftCell.value = `MONTH: ${monthLongEn.toUpperCase()} ${selectedYear}`;
      subLeftCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E293B" } };
      subLeftCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      subLeftCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      subLeftCell.border = {
        bottom: { style: "medium", color: { argb: "FF0F172A" } },
        right: { style: "medium", color: { argb: "FF0F172A" } },
        left: { style: "thin", color: { argb: "FF475569" } },
      };

      // Right Pane (Cols 4..totalColsCount): Clean background without text (removed per user request)
      worksheet.mergeCells(2, 4, 2, totalColsCount);
      const subRightCell = worksheet.getCell(2, 4);
      subRightCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      subRightCell.border = {
        bottom: { style: "medium", color: { argb: "FF0F172A" } },
        left: { style: "medium", color: { argb: "FF0F172A" } },
      };
      worksheet.getRow(2).height = 20;

      // --- 3. Header Row 3: Day Names (Mon, Tue, ...) ---
      const summaryColName = entryMode === "TARGET" ? "Month Avg" : "Month Total";
      const headerRow3Values = ["#", "Line Group", "", ...currentMonthDates.map((d) => d.dayName), summaryColName];
      const headerRow3 = worksheet.addRow(headerRow3Values);
      headerRow3.height = 22;

      // --- 4. Header Row 4: Day & Month (e.g. 1-Aug, 1-Sep) ---
      const headerRow4Values = ["", "", "", ...currentMonthDates.map((d) => `${d.dayNum}-${monthShortEn}`), ""];
      const headerRow4 = worksheet.addRow(headerRow4Values);
      headerRow4.height = 18;

      // Merge Col A (Rows 3-4), Col B (Rows 3-4), Col C (Rows 3-4), and Col Summary (Rows 3-4)
      worksheet.mergeCells(3, 1, 4, 1);
      worksheet.mergeCells(3, 2, 4, 2);
      worksheet.mergeCells(3, 3, 4, 3);
      worksheet.mergeCells(3, totalColsCount, 4, totalColsCount);

      const cellNoHeader = worksheet.getCell(3, 1);
      cellNoHeader.alignment = { vertical: "middle", horizontal: "center" };
      cellNoHeader.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cellNoHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      cellNoHeader.border = {
        top: { style: "thin", color: { argb: "FF94A3B8" } },
        bottom: { style: "medium", color: { argb: "FF0F172A" } },
        left: { style: "thin", color: { argb: "FF475569" } },
        right: { style: "thin", color: { argb: "FF475569" } },
      };

      const cellLineHeader = worksheet.getCell(3, 2);
      cellLineHeader.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      cellLineHeader.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cellLineHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      cellLineHeader.border = {
        top: { style: "thin", color: { argb: "FF94A3B8" } },
        bottom: { style: "medium", color: { argb: "FF0F172A" } },
        left: { style: "thin", color: { argb: "FF475569" } },
        right: { style: "thin", color: { argb: "FF475569" } },
      };

      const cellMetricHeader = worksheet.getCell(3, 3);
      cellMetricHeader.alignment = { vertical: "middle", horizontal: "center" };
      cellMetricHeader.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cellMetricHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      cellMetricHeader.border = {
        top: { style: "thin", color: { argb: "FF94A3B8" } },
        bottom: { style: "medium", color: { argb: "FF0F172A" } },
        left: { style: "thin", color: { argb: "FF475569" } },
        right: { style: "medium", color: { argb: "FF0F172A" } },
      };

      const cellSummaryHeader = worksheet.getCell(3, totalColsCount);
      cellSummaryHeader.alignment = { vertical: "middle", horizontal: "center" };
      cellSummaryHeader.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cellSummaryHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
      cellSummaryHeader.border = {
        top: { style: "thin", color: { argb: "FF94A3B8" } },
        bottom: { style: "medium", color: { argb: "FF0F172A" } },
        left: { style: "medium", color: { argb: "FF0F172A" } },
        right: { style: "thin", color: { argb: "FF475569" } },
      };

      // Style Day columns in Rows 3 & 4 (starting at col 4)
      currentMonthDates.forEach((d, dIdx) => {
        const colIdx = dIdx + 4;
        const cellDayNum = worksheet.getCell(3, colIdx);
        const cellDayName = worksheet.getCell(4, colIdx);

        const isWeekend = d.isWeekend;
        const headerBg = isWeekend ? "FFD97706" : "FF1E293B"; // Amber for weekend, Dark Slate for weekday
        const subBg = isWeekend ? "FFFEF3C7" : "FFF8FAFC";
        const subColor = isWeekend ? "FF92400E" : "FF475569";

        cellDayNum.alignment = { vertical: "middle", horizontal: "center" };
        cellDayNum.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cellDayNum.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerBg } };
        cellDayNum.border = {
          top: { style: "thin", color: { argb: "FF94A3B8" } },
          left: { style: "thin", color: { argb: "FF475569" } },
          right: { style: "thin", color: { argb: "FF475569" } },
        };

        cellDayName.alignment = { vertical: "middle", horizontal: "center" };
        cellDayName.font = { name: "Calibri", size: 9, bold: true, color: { argb: subColor } };
        cellDayName.fill = { type: "pattern", pattern: "solid", fgColor: { argb: subBg } };
        cellDayName.border = {
          bottom: { style: "medium", color: { argb: "FF0F172A" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });

      // Prepare Data Maps for Piece and Sheet
      let pcsDataMap: Record<string, Record<string, number | string>> = {};
      let shtDataMap: Record<string, Record<string, number | string>> = {};

      if (includeData) {
        const startDate = `${selectedYear}-${monthStr}-01`;
        const endDate = `${selectedYear}-${monthStr}-${String(currentDaysCount).padStart(2, "0")}`;

        if (entryMode === "TARGET") {
          try {
            const targetRecords = await fetchMatrixTargetsData(startDate, endDate);
            if (Array.isArray(targetRecords)) {
              targetRecords.forEach((item) => {
                if (!item.line || !item.date) return;
                const norm = normalizeMatrixLineGroupName(item.line);
                if (!pcsDataMap[norm]) pcsDataMap[norm] = {};
                if (!shtDataMap[norm]) shtDataMap[norm] = {};
                if (item.pcs_prod_target !== undefined && item.pcs_prod_target !== null && Number(item.pcs_prod_target) > 0) {
                  pcsDataMap[norm][item.date] = Number(item.pcs_prod_target);
                }
                if (item.sht_prod_target !== undefined && item.sht_prod_target !== null && Number(item.sht_prod_target) > 0) {
                  shtDataMap[norm][item.date] = Number(item.sht_prod_target);
                }
              });
            }
          } catch (e) {
            console.warn("Could not fetch targets for export:", e);
          }

          // Overlay current in-memory edits
          const activeMap = targetMetric === "pcs_prod_target" ? pcsDataMap : shtDataMap;
          const secondaryMap = targetMetric === "pcs_prod_target" ? shtDataMap : pcsDataMap;

          Object.entries(matrixValues).forEach(([lName, dayMap]) => {
            const norm = normalizeMatrixLineGroupName(lName);
            if (!activeMap[norm]) activeMap[norm] = {};
            Object.entries(dayMap).forEach(([dStr, val]) => {
              if (val !== undefined && val !== null && String(val).trim() !== "" && !isNaN(Number(val))) {
                activeMap[norm][dStr] = Number(val);
              }
            });
          });

          Object.entries(secondaryMatrixValues).forEach(([lName, dayMap]) => {
            const norm = normalizeMatrixLineGroupName(lName);
            if (!secondaryMap[norm]) secondaryMap[norm] = {};
            Object.entries(dayMap).forEach(([dStr, val]) => {
              if (val !== undefined && val !== null && String(val).trim() !== "" && !isNaN(Number(val))) {
                secondaryMap[norm][dStr] = Number(val);
              }
            });
          });

          // Also overlay in-memory edits for LINE MAT (PD Target -> pcsDataMap, MOS Target -> shtDataMap)
          if (!pcsDataMap["LINE MAT"]) pcsDataMap["LINE MAT"] = {};
          if (!shtDataMap["LINE MAT"]) shtDataMap["LINE MAT"] = {};
          Object.entries(matPdMatrix).forEach(([dStr, val]) => {
            if (val !== undefined && val !== null && String(val).trim() !== "" && !isNaN(Number(val))) {
              pcsDataMap["LINE MAT"][dStr] = Number(val);
            }
          });
          Object.entries(matMosMatrix).forEach(([dStr, val]) => {
            if (val !== undefined && val !== null && String(val).trim() !== "" && !isNaN(Number(val))) {
              shtDataMap["LINE MAT"][dStr] = Number(val);
            }
          });
        } else {
          // Plan Mode
          try {
            const [smtPlans, fpcPlans] = await Promise.all([
              fetchSmtDailyActualOutput(startDate, endDate).catch(() => []),
              fetchFpcDailyActualPlan(startDate, endDate).catch(() => []),
            ]);

            if (Array.isArray(smtPlans)) {
              smtPlans.forEach((item: any) => {
                if (!item.line || !item.date) return;
                const norm = normalizeMatrixLineGroupName(item.line);
                if (!pcsDataMap[norm]) pcsDataMap[norm] = {};
                if (item.daily_plan !== undefined && item.daily_plan !== null && Number(item.daily_plan) > 0) {
                  pcsDataMap[norm][item.date] = Number(item.daily_plan);
                }
              });
            }

            if (Array.isArray(fpcPlans)) {
              fpcPlans.forEach((item: any) => {
                if (!item.line || !item.date) return;
                const norm = normalizeMatrixLineGroupName(item.line);
                if (!pcsDataMap[norm]) pcsDataMap[norm] = {};
                if (!shtDataMap[norm]) shtDataMap[norm] = {};
                if (item.piece_plan !== undefined && item.piece_plan !== null && Number(item.piece_plan) > 0) {
                  pcsDataMap[norm][item.date] = Number(item.piece_plan);
                }
                if (item.sht_plan !== undefined && item.sht_plan !== null && Number(item.sht_plan) > 0) {
                  shtDataMap[norm][item.date] = Number(item.sht_plan);
                }
              });
            }
          } catch (e) {
            console.warn("Could not fetch plans for export:", e);
          }

          // Overlay modal matrixValues
          Object.entries(matrixValues).forEach(([lName, dayMap]) => {
            const norm = normalizeMatrixLineGroupName(lName);
            const targetMap = planMetric === "sht_plan" ? shtDataMap : pcsDataMap;
            if (!targetMap[norm]) targetMap[norm] = {};
            Object.entries(dayMap).forEach(([dStr, val]) => {
              if (val !== undefined && val !== null && String(val).trim() !== "" && !isNaN(Number(val))) {
                targetMap[norm][dStr] = Number(val);
              }
            });
          });
        }
      }

      const pcsLabel = entryMode === "TARGET" ? "Pcs_Prod Target" : "Plan Piece (Pcs)";
      const shtLabel = entryMode === "TARGET" ? "Sht_Prod Target" : "Plan Sheet (Sht)";

      // --- 5. Data Rows (2 rows per Line Group) ---
      allFormattedLines.forEach((line, idx) => {
        const rowPcsNum = 5 + idx * 2;
        const rowShtNum = rowPcsNum + 1;
        const isEvenGroup = idx % 2 === 1;

        const pcsDays = pcsDataMap[line.name] || {};
        const shtDays = shtDataMap[line.name] || {};

        const isMat = isMatLine(line.name) || line.name.toUpperCase().includes("LINE MAT") || line.name.toUpperCase() === "MAT";

        // Row 1: Pcs (For LINE MAT: "PD")
        const pcsLabelToUse = isMat ? "PD" : pcsLabel;
        const rowPcsValues: any[] = [idx + 1, line.displayName, pcsLabelToUse];
        currentMonthDates.forEach((d) => {
          const val = pcsDays[d.dateStr];
          if (includeData && val !== undefined && val !== null && String(val).trim() !== "" && !isNaN(Number(val))) {
            rowPcsValues.push(Number(val));
          } else {
            rowPcsValues.push(null);
          }
        });

        // Summary Formula for Pcs / PD
        const pcsFormula =
          entryMode === "TARGET"
            ? `IFERROR(AVERAGE(D${rowPcsNum}:${endDayColLetter}${rowPcsNum}), 0)`
            : `SUM(D${rowPcsNum}:${endDayColLetter}${rowPcsNum})`;
        rowPcsValues.push({ formula: pcsFormula });

        // Row 2: Sht (Option 2: uniform 2 rows, Piece-only lines grayed out as N/A, or MOS for LINE MAT)
        const supportsSheet = isMat || isLineSupportingSheet(line.name, line.factory);
        const shtLabelToUse = isMat
          ? "MOS"
          : supportsSheet
          ? shtLabel
          : (entryMode === "TARGET" ? "Sht_Prod Target (N/A)" : "Plan Sheet (N/A)");

        const rowShtValues: any[] = ["", "", shtLabelToUse];
        currentMonthDates.forEach((d) => {
          if (!supportsSheet) {
            rowShtValues.push("-");
          } else {
            const val = shtDays[d.dateStr];
            if (includeData && val !== undefined && val !== null && String(val).trim() !== "" && !isNaN(Number(val))) {
              rowShtValues.push(Number(val));
            } else {
              rowShtValues.push(null);
            }
          }
        });

        // Summary Formula for Sht / MOS
        if (!supportsSheet) {
          rowShtValues.push("-");
        } else {
          const shtFormula =
            entryMode === "TARGET"
              ? `IFERROR(AVERAGE(D${rowShtNum}:${endDayColLetter}${rowShtNum}), 0)`
              : `SUM(D${rowShtNum}:${endDayColLetter}${rowShtNum})`;
          rowShtValues.push({ formula: shtFormula });
        }

        const pcsRow = worksheet.addRow(rowPcsValues);
        pcsRow.height = 20;

        const shtRow = worksheet.addRow(rowShtValues);
        shtRow.height = 20;

        // Merge Col 1 (#) and Col 2 (Line Group) across rowPcsNum and rowShtNum
        worksheet.mergeCells(rowPcsNum, 1, rowShtNum, 1);
        worksheet.mergeCells(rowPcsNum, 2, rowShtNum, 2);

        // Styling Row 1 (Pcs)
        pcsRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
          cell.font = { name: "Calibri", size: 10 };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };

          if (colNum === 1) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF64748B" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
          } else if (colNum === 2) {
            cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
            cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF0F172A" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isEvenGroup ? "FFF8FAFC" : "FFFFFFFF" } };
          } else if (colNum === 3) {
            // Metric Pcs
            cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
            cell.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FF1E40AF" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isEvenGroup ? "FFF8FAFC" : "FFFFFFFF" } };
            cell.border = {
              ...cell.border,
              bottom: { style: "thin", color: { argb: "FF0F172A" } },
              right: { style: "medium", color: { argb: "FF0F172A" } },
            };
          } else if (colNum === totalColsCount) {
            // Summary Formula Column
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E3A8A" } };
            cell.numFmt = entryMode === "TARGET" ? "#,##0.00" : "#,##0";
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
            cell.border = {
              ...cell.border,
              left: { style: "medium", color: { argb: "FF94A3B8" } },
            };
          } else {
            // Day values
            const dIdx = colNum - 4;
            const isWeekend = currentMonthDates[dIdx]?.isWeekend;
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.numFmt = entryMode === "TARGET" ? "#,##0.00" : "#,##0";
            if (isWeekend) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } };
            } else if (isEvenGroup) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
            }
          }
        });

        // Styling Row 2 (Sht)
        shtRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
          cell.font = { name: "Calibri", size: 10 };
          // Line group separation: bottom border is medium dark slate
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "medium", color: { argb: "FF0F172A" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };

          if (colNum === 1) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
          } else if (colNum === 2) {
            cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isEvenGroup ? "FFF8FAFC" : "FFFFFFFF" } };
          } else if (colNum === 3) {
            // Metric Sht
            cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
            if (!supportsSheet) {
              cell.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF94A3B8" } };
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
            } else {
              cell.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FF0D9488" } };
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isEvenGroup ? "FFF8FAFC" : "FFFFFFFF" } };
            }
            cell.border = {
              ...cell.border,
              top: { style: "thin", color: { argb: "FF0F172A" } },
              right: { style: "medium", color: { argb: "FF0F172A" } },
            };
          } else if (colNum === totalColsCount) {
            // Summary Column
            if (!supportsSheet) {
              cell.alignment = { vertical: "middle", horizontal: "center" };
              cell.font = { name: "Calibri", size: 10, color: { argb: "FF94A3B8" } };
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
            } else {
              cell.alignment = { vertical: "middle", horizontal: "right" };
              cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E3A8A" } };
              cell.numFmt = entryMode === "TARGET" ? "#,##0.00" : "#,##0";
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
            }
            cell.border = {
              ...cell.border,
              left: { style: "medium", color: { argb: "FF94A3B8" } },
            };
          } else {
            // Day values
            if (!supportsSheet) {
              cell.alignment = { vertical: "middle", horizontal: "center" };
              cell.font = { name: "Calibri", size: 10, color: { argb: "FF94A3B8" } };
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
            } else {
              const dIdx = colNum - 4;
              const isWeekend = currentMonthDates[dIdx]?.isWeekend;
              cell.alignment = { vertical: "middle", horizontal: "right" };
              cell.numFmt = entryMode === "TARGET" ? "#,##0.00" : "#,##0";
              if (isWeekend) {
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } };
              } else if (isEvenGroup) {
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
              }
            }
          }
        });

        // Ensure merged cells have proper right and bottom borders
        const col1Top = worksheet.getCell(rowPcsNum, 1);
        const col1Bot = worksheet.getCell(rowShtNum, 1);
        col1Top.border = { ...col1Top.border, bottom: { style: "medium", color: { argb: "FF0F172A" } } };
        col1Bot.border = { ...col1Bot.border, bottom: { style: "medium", color: { argb: "FF0F172A" } } };

        const col2Top = worksheet.getCell(rowPcsNum, 2);
        const col2Bot = worksheet.getCell(rowShtNum, 2);
        col2Top.border = { ...col2Top.border, right: { style: "thin", color: { argb: "FF475569" } }, bottom: { style: "medium", color: { argb: "FF0F172A" } } };
        col2Bot.border = { ...col2Bot.border, right: { style: "thin", color: { argb: "FF475569" } }, bottom: { style: "medium", color: { argb: "FF0F172A" } } };
      });

      // --- 6. Set Column Widths ---
      worksheet.getColumn(1).width = 6;
      worksheet.getColumn(2).width = 24;
      worksheet.getColumn(3).width = 18;
      for (let c = 4; c <= totalDays + 3; c++) {
        worksheet.getColumn(c).width = 8.5;
      }
      worksheet.getColumn(totalColsCount).width = 15;

      // --- 7. Save and Trigger Download ---
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      const cleanMetricName = entryMode === "TARGET" ? "Target" : "Plan";
      const typeSuffix = includeData ? "With_Data" : "Blank";
      const fileName = `Fujikura_${cleanMetricName}_${typeSuffix}_${selectedYear}_${monthStr}.xlsx`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      showAlert("success", "ดาวน์โหลดแบบฟอร์มสำเร็จ", `สร้างแบบฟอร์ม ${fileName} เรียบร้อยแล้ว`);
    } catch (err) {
      console.error("Failed to generate styled template:", err);
      showAlert("error", "ดาวน์โหลดไม่สำเร็จ", "เกิดข้อผิดพลาดในการสร้างแบบฟอร์ม Excel");
    }
  };

  // Helper: parse day number 1..daysInMonth from Excel header cell
  const parseHeaderDayNum = (val: any, daysLimit: number): number => {
    if (val === undefined || val === null) return NaN;
    if (typeof val === "number") {
      if (val >= 1 && val <= daysLimit) return Math.floor(val);
      if (val > 40000 && val < 60000) {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        return d.getDate();
      }
    }
    const str = String(val).trim();
    if (!str) return NaN;
    const lower = str.toLowerCase();
    if (
      lower.includes("avg") ||
      lower.includes("total") ||
      lower.includes("sum") ||
      lower.includes("สรุป") ||
      lower.includes("เฉลี่ย") ||
      lower.includes("รวม")
    ) {
      return NaN;
    }
    let n = parseInt(str, 10);
    if (!isNaN(n) && n >= 1 && n <= daysLimit && (str === String(n) || str.startsWith(n + "-") || str.startsWith(n + "/"))) {
      return n;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.getDate();

    const m = str.match(/(\d{1,2})/);
    if (m) {
      const candidate = parseInt(m[1], 10);
      if (candidate >= 1 && candidate <= daysLimit) return candidate;
    }
    return NaN;
  };

  // Import Excel File directly into matrix grid
  const handleImportExcelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: "array", cellDates: true });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) throw new Error("No sheet found");

        const ws = wb.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        if (!rows || rows.length < 2) {
          showAlert("warning", "ไฟล์ไม่มีข้อมูล", "กรุณาตรวจสอบว่าไฟล์ Excel มีหัวตารางและข้อมูลไลน์ผลิต");
          return;
        }

        // 1. Search the first 10 rows to find the Header Row containing "Line Group" or "Line Name" or "Line"
        let headerRowIdx = -1;
        let lineColIdx = -1;
        let metricColIdx = -1;

        for (let r = 0; r < Math.min(rows.length, 10); r++) {
          const row = rows[r];
          if (!Array.isArray(row)) continue;
          const idx = row.findIndex((cell: any) => {
            const str = String(cell || "").toLowerCase().trim();
            return (
              str === "line group" ||
              str === "line name" ||
              str === "line" ||
              str === "linegroup" ||
              str === "ไลน์ผลิต" ||
              str === "กลุ่มไลน์"
            );
          });
          if (idx !== -1) {
            headerRowIdx = r;
            lineColIdx = idx;
            break;
          }
        }

        if (headerRowIdx === -1) {
          headerRowIdx = 0;
          lineColIdx = 1;
        }

        // 2. Detect metric column (check next column lineColIdx + 1, or scan header row)
        for (let r = headerRowIdx; r < Math.min(rows.length, headerRowIdx + 5); r++) {
          const checkVal = String(rows[r]?.[lineColIdx + 1] || "").toLowerCase().trim();
          if (
            checkVal.includes("pcs") ||
            checkVal.includes("sht") ||
            checkVal.includes("target") ||
            checkVal.includes("plan") ||
            checkVal.includes("metric") ||
            checkVal.includes("piece") ||
            checkVal.includes("sheet")
          ) {
            metricColIdx = lineColIdx + 1;
            break;
          }
        }

        if (metricColIdx === -1) {
          const rowH = rows[headerRowIdx] || [];
          for (let c = 0; c < rowH.length; c++) {
            const hStr = String(rowH[c] || "").toLowerCase().trim();
            if (hStr === "metric" || hStr === "unit" || hStr === "ประเภท" || hStr === "หน่วย") {
              metricColIdx = c;
              break;
            }
          }
        }

        // 3. Map day columns (1..daysInMonth)
        const dayColMap: { colIdx: number; dayNum: number; dateStr: string }[] = [];
        const monthStr = String(selectedMonth).padStart(2, "0");
        const yearStr = String(selectedYear);

        const rowA = rows[headerRowIdx] || [];
        const rowB = rows[headerRowIdx + 1] || [];
        const maxCols = Math.max(rowA.length, rowB.length);
        const seenDays = new Set<number>();

        for (let colIdx = 0; colIdx < maxCols; colIdx++) {
          if (colIdx === lineColIdx || colIdx === metricColIdx || colIdx === 0) continue;
          let num = parseHeaderDayNum(rowA[colIdx], daysInMonth);
          if (isNaN(num)) num = parseHeaderDayNum(rowB[colIdx], daysInMonth);
          if (!isNaN(num) && num >= 1 && num <= daysInMonth && !seenDays.has(num)) {
            seenDays.add(num);
            const dateStr = `${yearStr}-${monthStr}-${String(num).padStart(2, "0")}`;
            dayColMap.push({ colIdx, dayNum: num, dateStr });
          }
        }

        if (dayColMap.length === 0) {
          showAlert("warning", "ไม่พบคอลัมน์วันที่ (1 - 31)", "กรุณาตรวจสอบหัวคอลัมน์ใน Excel ว่ามีตัวเลขวันที่ 1 ถึง 31 ของเดือนที่เลือก");
          return;
        }

        // 4. Line resolver helper
        const resolveLineName = (rawText: string): string => {
          if (!rawText) return "";
          const trimmed = String(rawText).trim();
          const upper = trimmed.toUpperCase();

          const found = allFormattedLines.find(
            (l) => l.name.toUpperCase() === upper || l.displayName.toUpperCase() === upper
          );
          if (found) return found.name;

          const norm = normalizeMatrixLineGroupName(trimmed);
          if (norm && norm !== "UNKNOWN" && norm !== "TOTAL" && norm !== "SUMMARY") {
            const foundNorm = allFormattedLines.find(
              (l) => l.name.toUpperCase() === norm.toUpperCase() || l.displayName.toUpperCase() === norm.toUpperCase()
            );
            if (foundNorm) return foundNorm.name;
            return norm;
          }

          const loose = allFormattedLines.find(
            (l) => l.name.toUpperCase().includes(upper) || upper.includes(l.name.toUpperCase())
          );
          if (loose) return loose.name;

          return trimmed;
        };

        let cellCount = 0;
        let pcsCount = 0;
        let shtCount = 0;
        let currentLine = "";
        const updatedLines = new Set<string>();

        const nextPrimary: Record<string, Record<string, string>> = { ...matrixValues };
        const nextSecondary: Record<string, Record<string, string>> = { ...secondaryMatrixValues };
        const nextMatPd: Record<string, string> = { ...matPdMatrix };
        const nextMatMos: Record<string, string> = { ...matMosMatrix };

        for (let r = headerRowIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!Array.isArray(row)) continue;

          const rawLine = String(row[lineColIdx] || "").trim();
          if (rawLine) {
            const resolved = resolveLineName(rawLine);
            if (resolved) currentLine = resolved;
          }
          if (!currentLine) continue;

          // Check metric text
          let isPcs = false;
          let isSht = false;

          if (metricColIdx !== -1) {
            const mText = String(row[metricColIdx] || "").toLowerCase().trim();
            if (mText.includes("(n/a)") || mText.includes("n/a")) {
              // Line does not support this metric or is marked N/A -> skip row
              continue;
            }
            if (mText.includes("pcs") || mText.includes("piece") || mText === "pd" || mText.includes("pd")) isPcs = true;
            else if (mText.includes("sht") || mText.includes("sheet") || mText === "mos" || mText.includes("mos")) isSht = true;
          }

          if (!isPcs && !isSht) {
            if (entryMode === "TARGET") {
              isPcs = targetMetric === "pcs_prod_target";
              isSht = targetMetric === "sht_prod_target";
            } else {
              isPcs = planMetric === "pcs_plan";
              isSht = planMetric === "sht_plan";
            }
          }

          const isMat = isMatLine(currentLine) || currentLine.toUpperCase().includes("LINE MAT") || currentLine.toUpperCase() === "MAT";

          // If line does not support Sheet, skip Sheet row to prevent invalid targets
          const matchedLineObj = allFormattedLines.find((l) => l.name === currentLine);
          if (!isMat && isSht && matchedLineObj && !isLineSupportingSheet(matchedLineObj.name, matchedLineObj.factory)) {
            continue;
          }

          let isPrimaryRow = false;
          let isSecondaryRow = false;

          if (entryMode === "TARGET") {
            if (targetMetric === "pcs_prod_target") {
              if (isPcs) isPrimaryRow = true;
              if (isSht) isSecondaryRow = true;
            } else {
              if (isSht) isPrimaryRow = true;
              if (isPcs) isSecondaryRow = true;
            }
          } else {
            if (planMetric === "pcs_plan") {
              if (isPcs) isPrimaryRow = true;
              if (isSht) isSecondaryRow = true;
            } else if (planMetric === "sht_plan") {
              if (isSht) isPrimaryRow = true;
              if (isPcs) isSecondaryRow = true;
            } else {
              if (isPcs) isPrimaryRow = true;
            }
          }

          dayColMap.forEach(({ colIdx, dateStr }) => {
            let rawCell = row[colIdx];
            if (rawCell && typeof rawCell === "object") {
              if (rawCell instanceof Date) {
                rawCell = "";
              } else {
                rawCell = (rawCell as any).v ?? (rawCell as any).result ?? (rawCell as any).w ?? "";
              }
            }
            const strVal = String(rawCell ?? "").replace(/,/g, "").trim();
            if (strVal !== "" && strVal !== "-" && !isNaN(Number(strVal))) {
              const numVal = Number(strVal);
              if (numVal >= 0) {
                const cleaned = cleanNumberString(numVal, entryMode === "TARGET");
                if (entryMode === "TARGET" && isMat) {
                  if (isPcs) {
                    nextMatPd[dateStr] = cleaned;
                    cellCount++;
                    pcsCount++;
                    updatedLines.add("LINE MAT (PD)");
                  } else if (isSht) {
                    nextMatMos[dateStr] = cleaned;
                    cellCount++;
                    shtCount++;
                    updatedLines.add("LINE MAT (MOS)");
                  }
                } else {
                  if (isPrimaryRow) {
                    if (!nextPrimary[currentLine]) nextPrimary[currentLine] = {};
                    nextPrimary[currentLine][dateStr] = cleaned;
                    cellCount++;
                    if (isPcs) pcsCount++;
                    else shtCount++;
                    updatedLines.add(currentLine);
                  }
                  if (isSecondaryRow) {
                    if (!nextSecondary[currentLine]) nextSecondary[currentLine] = {};
                    nextSecondary[currentLine][dateStr] = cleaned;
                    cellCount++;
                    if (isSht) shtCount++;
                    else pcsCount++;
                    updatedLines.add(currentLine);
                  }
                }
              }
            }
          });
        }

        setMatrixValues(nextPrimary);
        setSecondaryMatrixValues(nextSecondary);
        if (entryMode === "TARGET") {
          setMatPdMatrix(nextMatPd);
          setMatMosMatrix(nextMatMos);
        }

        if (fileInputRef.current) fileInputRef.current.value = "";

        showAlert(
          "success",
          "นำเข้าข้อมูลจาก Excel สำเร็จ",
          `นำเข้าสำเร็จ: Pcs ${pcsCount} ช่อง, Sheet ${shtCount} ช่อง (${updatedLines.size} ไลน์ผลิต) รวม ${cellCount} ช่องข้อมูล (เซลล์ที่แก้ไขจะแสดงสีส้ม สามารถตรวจสอบและกดบันทึกได้ทันที)`
        );
      } catch (err) {
        console.error("Error importing excel file:", err);
        showAlert("error", "อ่านไฟล์ Excel ล้มเหลว", "โปรดตรวจสอบโครงสร้างไฟล์ Excel ให้ตรงกับแบบฟอร์มของระบบ");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (!isOpen || isClosing) return null;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 md:p-6 overflow-hidden animate-in fade-in duration-200">
      <div className="flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-7xl h-[94vh] overflow-hidden">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                Target Adjustment (Target Data)
                {unsavedChangesCount > 0 && (
                  <span className="text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full">
                    แก้ไข {unsavedChangesCount} ช่อง
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500">
                Monthly Target & Daily Plan Matrix
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download Template Dropdown (Blank vs With Data) */}
            <div className="relative" ref={downloadDropdownRef}>
              <button
                type="button"
                onClick={() => setDownloadDropdownOpen(!downloadDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="เลือกดาวน์โหลดแบบฟอร์ม Excel"
              >
                <Download className="h-3.5 w-3.5 text-emerald-600" />
                <span>Download Form</span>
                <ChevronDown className={`h-3 w-3 text-emerald-700 transition-transform ${downloadDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {downloadDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-left animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      setDownloadDropdownOpen(false);
                      handleDownloadExcelTemplate({ includeData: false });
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-start gap-2.5 transition-colors cursor-pointer group"
                  >
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100 mt-0.5 shrink-0">
                      <FileSpreadsheet className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">แบบฟอร์มเปล่า (Blank Form)</div>
                      <div className="text-[11px] text-slate-500">เฉพาะรายชื่อไลน์ผลิตและสูตรคำนวณ</div>
                    </div>
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  <button
                    type="button"
                    onClick={() => {
                      setDownloadDropdownOpen(false);
                      handleDownloadExcelTemplate({ includeData: true });
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-start gap-2.5 transition-colors cursor-pointer group"
                  >
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 group-hover:bg-blue-100 mt-0.5 shrink-0">
                      <Download className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">แบบมีข้อมูล (With Data)</div>
                      <div className="text-[11px] text-slate-500">พร้อมตัวเลขแผน/เป้าหมายในระบบ</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Import Excel File Button */}
            <label
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Import Excel File"
            >
              <Upload className="h-3.5 w-3.5 text-blue-600" />
              <span>Import File</span>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportExcelFile}
                accept=".xlsx, .xls"
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={loadData}
              disabled={isLoading || isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 border-b border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Mode Toggle: TARGET vs PLAN */}
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setEntryMode("TARGET")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  entryMode === "TARGET"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Productivity Target
              </button>
              <button
                type="button"
                onClick={() => setEntryMode("PLAN")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  entryMode === "PLAN"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                Daily Plan
              </button>
            </div>

            {/* Metric Selector */}
            {entryMode === "TARGET" ? (
              <select
                value={targetMetric}
                onChange={(e) => {
                  const newMetric = e.target.value as TargetMetric;
                  if (newMetric === targetMetric) return;
                  setSecondaryMatrixValues(matrixValues);
                  setInitialSecondaryMatrixValues(initialMatrixValues);
                  setMatrixValues(secondaryMatrixValues);
                  setInitialMatrixValues(initialSecondaryMatrixValues);
                  setTargetMetric(newMetric);
                }}
                className="select select-xs select-bordered font-bold text-blue-700 bg-white rounded-lg h-8"
              >
                <option value="pcs_prod_target">Pcs_Prod Target (Pcs)</option>
                <option value="sht_prod_target">Sht_Prod Target (Sht)</option>
              </select>
            ) : (
              <select
                value={planMetric}
                onChange={(e) => {
                  const newMetric = e.target.value as PlanMetric;
                  if (newMetric === planMetric) return;
                  if (
                    (planMetric === "pcs_plan" && newMetric === "sht_plan") ||
                    (planMetric === "sht_plan" && newMetric === "pcs_plan")
                  ) {
                    setSecondaryMatrixValues(matrixValues);
                    setInitialSecondaryMatrixValues(initialMatrixValues);
                    setMatrixValues(secondaryMatrixValues);
                    setInitialMatrixValues(initialSecondaryMatrixValues);
                  }
                  setPlanMetric(newMetric);
                }}
                className="select select-xs select-bordered font-bold text-purple-700 bg-white rounded-lg h-8"
              >
                <option value="pcs_plan">Plan Piece (Pcs)</option>
                <option value="sht_plan">Plan Sheet (Sht)</option>
                <option value="lot_plan">Plan Lot (Lot)</option>
              </select>
            )}

            {/* Month & Year Selectors */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="select select-xs select-bordered font-bold text-slate-700 bg-white rounded-lg h-8 min-w-[76px] w-20 cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(selectedYear, m - 1, 1).toLocaleString("en-US", { month: "short" })}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="select select-xs select-bordered font-bold text-slate-700 bg-white rounded-lg h-8 min-w-[82px] w-22 cursor-pointer"
              >
                {[2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              {/* Copy Target from Previous Month (Orange Theme) */}
              {entryMode === "TARGET" && (
                <button
                  type="button"
                  onClick={handleCopyFromPreviousMonth}
                  disabled={isLoading || isSaving || isCopyingPrevious}
                  className="flex items-center gap-1.5 px-3 h-8 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50 shrink-0 ml-1"
                  title="คัดลอกข้อมูลเป้าหมาย (Target) จากเดือนก่อนหน้ามาใส่ในเดือนนี้"
                >
                  <Copy className={`h-3.5 w-3.5 text-amber-600 ${isCopyingPrevious ? "animate-spin" : ""}`} />
                  <span>{isCopyingPrevious ? "กำลังคัดลอก..." : "คัดลอกเดือนก่อน"}</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sector Filters */}
            <div className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
              {(["ALL", "SMT", "FPC", "MACRO"] as const).map((sec) => {
                const isSmtDisabled = entryMode === "TARGET" && targetMetric === "sht_prod_target" && sec === "SMT";
                return (
                  <button
                    key={sec}
                    type="button"
                    disabled={isSmtDisabled}
                    onClick={() => !isSmtDisabled && setSectorFilter(sec)}
                    className={`px-2.5 py-1 font-bold rounded-md transition-all ${
                      isSmtDisabled
                        ? "text-slate-300 cursor-not-allowed line-through opacity-40"
                        : sectorFilter === sec
                        ? "bg-white text-slate-800 shadow-2xs cursor-pointer"
                        : "text-slate-500 hover:text-slate-800 cursor-pointer"
                    }`}
                    title={isSmtDisabled ? "SMT ไม่มีเป้าหมาย Sheet (รองรับเฉพาะ Piece)" : undefined}
                  >
                    {sec}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-44">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search line..."
                className="input input-xs input-bordered w-full pl-7 pr-2 h-8 font-medium text-xs rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Quick Fill Toolbar Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2 bg-slate-50 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-600 tracking-wide uppercase shrink-0">
              Quick Fill:
            </span>

            {/* Line multi-select dropdown */}
            <div className="relative" ref={lineDropdownRef}>
              <button
                type="button"
                onClick={() => setIsLineDropdownOpen((p) => !p)}
                className="flex items-center gap-2 px-3 h-7 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-400 transition cursor-pointer shadow-2xs"
              >
                <span>
                  {selectedFillLines.size === 0
                    ? "Select Lines (0)"
                    : `${selectedFillLines.size} Line${selectedFillLines.size > 1 ? "s" : ""} Selected`}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-slate-400 transition-transform ${isLineDropdownOpen ? "rotate-180 text-slate-700" : ""}`}
                />
              </button>

              {isLineDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-72 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2 space-y-2">
                  {/* Search input inside dropdown */}
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={dropdownLineSearch}
                      onChange={(e) => setDropdownLineSearch(e.target.value)}
                      placeholder="Filter lines..."
                      className="input input-xs input-bordered w-full pl-7 pr-2 h-7 font-medium text-xs rounded-md"
                    />
                  </div>

                  {/* Quick select buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleSelectAllFillLines}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition cursor-pointer"
                    >
                      All
                    </button>
                    {!(entryMode === "TARGET" && targetMetric === "sht_prod_target") && (
                      <button
                        type="button"
                        onClick={handleSelectSmtFillLines}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition cursor-pointer"
                      >
                        SMT
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSelectFpcFillLines}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition cursor-pointer"
                    >
                      FPC
                    </button>
                    <button
                      type="button"
                      onClick={handleClearFillLines}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-red-50 text-red-600 rounded text-[11px] font-semibold transition cursor-pointer ml-auto"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Checkbox list */}
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded">
                    {filteredDropdownLines.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">No lines found</div>
                    ) : (
                      filteredDropdownLines.map((line) => {
                        const checked = selectedFillLines.has(line.name);
                        const isFocused = highlightedLine === line.name;
                        return (
                          <label
                            key={line.name}
                            className={`flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer select-none transition ${
                              isFocused ? "bg-blue-50/90 font-medium" : "hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleFillLine(line.name)}
                              className="checkbox checkbox-xs checkbox-primary rounded"
                            />
                            <span className="flex-1 font-medium text-slate-700 truncate">
                              {line.displayName}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                line.factory === "SMT"
                                  ? "bg-blue-50 text-blue-600"
                                  : line.factory === "FPC"
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-purple-50 text-purple-600"
                              }`}
                            >
                              {line.factory}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>

                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>{selectedFillLines.size} selected</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsLineDropdownOpen(false);
                        if (highlightedLine) {
                          scrollToAndFocusLine(highlightedLine, true);
                        } else if (selectedFillLines.size > 0) {
                          const first = Array.from(selectedFillLines)[0];
                          scrollToAndFocusLine(first, true);
                        }
                      }}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded text-xs transition cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Presets on Toolbar */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSelectAllFillLines}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-md text-xs font-semibold transition cursor-pointer shadow-2xs"
              >
                All ({activeLinesForMetric.length})
              </button>
              {!(entryMode === "TARGET" && targetMetric === "sht_prod_target") && (
                <button
                  type="button"
                  onClick={handleSelectSmtFillLines}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-md text-xs font-semibold transition cursor-pointer shadow-2xs"
                >
                  SMT
                </button>
              )}
              <button
                type="button"
                onClick={handleSelectFpcFillLines}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-md text-xs font-semibold transition cursor-pointer shadow-2xs"
              >
                FPC
              </button>
              {selectedFillLines.size > 0 && (
                <button
                  type="button"
                  onClick={handleClearFillLines}
                  className="px-2 py-1 text-red-600 hover:bg-red-50 rounded-md text-xs font-semibold transition cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="h-4 w-px bg-slate-200" />

            {/* Fill Value Input */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Value:</span>
              <input
                type="number"
                step={entryMode === "TARGET" ? "0.01" : "any"}
                value={monthlyFillValue}
                onChange={(e) => setMonthlyFillValue(e.target.value)}
                placeholder={entryMode === "TARGET" ? "0.00" : "0"}
                className="input input-xs input-bordered w-24 h-7 font-bold text-slate-800 bg-white rounded-md text-center text-xs"
              />
              <span className="text-xs font-bold text-slate-600 select-none">
                {currentMetricUnit}
              </span>
            </div>
          </div>

          {/* Fill & Clear Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleApplyMonthlyFill}
              disabled={!monthlyFillValue || selectedFillLines.size === 0}
              className="px-3.5 py-1 h-7 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
            >
              Fill All Days {selectedFillLines.size > 0 ? `(${selectedFillLines.size} Lines)` : ""}
            </button>
            {selectedFillLines.size > 0 && (
              <button
                type="button"
                onClick={handleApplyMonthlyClear}
                className="px-2.5 py-1 h-7 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-xs font-bold transition cursor-pointer shadow-2xs"
                title="เคลียร์ทุกวันของไลน์ที่เลือกให้เป็นค่าว่าง (-)"
              >
                เคลียร์เป็นค่าว่าง ({selectedFillLines.size} Lines)
              </button>
            )}
          </div>
        </div>

        <div ref={tableContainerRef} className="flex-1 overflow-auto bg-slate-50/40 relative">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 py-16">
              <div className="h-7 w-7 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
              <p className="text-xs font-semibold text-slate-600">Loading matrix...</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse border-spacing-0">
              <thead className="sticky top-0 bg-slate-100 border-b-2 border-slate-300 shadow-sm z-20">
                <tr>
                  <th className="sticky left-0 bg-slate-200 border-r-2 border-b border-slate-300 px-3 py-2 z-30 shadow-xs min-w-[200px]">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 text-center font-mono font-black text-slate-700 text-xs">#</span>
                      <span className="font-extrabold text-slate-900 text-xs uppercase tracking-wide">Line Group</span>
                    </div>
                  </th>

                  {/* Day Columns */}
                  {monthDates.map((col) => (
                    <th
                      key={col.dateStr}
                      className={`px-1 py-1 text-center font-mono min-w-[76px] border-r border-b border-slate-300 select-none ${
                        col.isWeekend
                          ? "bg-amber-100/70 text-amber-900 border-r-amber-200"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <div className="text-[10px] font-bold leading-tight">{col.dayName}</div>
                      <div className="text-[9px] font-semibold opacity-80">{col.dayNum}-{monthShortLabel}</div>
                    </th>
                  ))}

                  {/* Total / Average Column */}
                  <th className="sticky right-0 bg-slate-200 border-l-2 border-b border-slate-300 px-3 py-2 font-bold text-slate-800 text-center min-w-[105px] z-30 shadow-xs">
                    {entryMode === "TARGET" ? `Avg Target (${currentMetricUnit})` : `Total Plan (${currentMetricUnit})`}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {displayedLines.map((lineItem, rowIdx) => {
                  const isMatPd = lineItem.name === "__MAT_PD__";
                  const isMatMos = lineItem.name === "__MAT_MOS__";
                  const rowDayMap = isMatPd
                    ? matPdMatrix
                    : isMatMos
                    ? matMosMatrix
                    : matrixValues[lineItem.name] || EMPTY_ROW;
                  const rowInitialDayMap = isMatPd
                    ? initialMatPdMatrix
                    : isMatMos
                    ? initialMatMosMatrix
                    : initialMatrixValues[lineItem.name] || EMPTY_ROW;

                  return (
                    <MatrixRow
                      key={lineItem.name}
                      lineItem={lineItem}
                      rowIdx={rowIdx}
                      dayMap={rowDayMap}
                      initialDayMap={rowInitialDayMap}
                      monthDates={monthDates}
                      entryMode={entryMode}
                      isHighlighted={highlightedLine === lineItem.name}
                      isSelectedFill={selectedFillLines.has(lineItem.name)}
                      onCellChange={handleCellChange}
                      onPaste={handlePaste}
                      onClearLine={handleClearLineData}
                      onSelectRow={handleSelectTableRow}
                    />
                  );
                })}

                {displayedLines.length === 0 && (
                  <tr>
                    <td
                      colSpan={monthDates.length + 2}
                      className="py-12 text-center text-slate-400"
                    >
                      ไม่พบรายการไลน์ที่ตรงกับเงื่อนไขการค้นหา
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
              สีส้ม = แก้ไขยังไม่บันทึก
            </span>
            <span className="hidden md:inline text-slate-300">|</span>
            <span className="hidden md:inline">รองรับ Excel Copy & Paste และ Import File (ทั้ง Piece และ Sheet)</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              ปิด
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving || isLoading}
              className="flex items-center gap-1.5 px-5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {isSaving ? "กำลังบันทึก..." : `บันทึก (${unsavedChangesCount})`}
            </button>
          </div>
        </div>
      </div>
    </div>


      {/* Custom Confirm Dialog Overlay */}
      {confirmState && (
        <ConfirmDialog confirm={confirmState} />
      )}
    </>
  );
};
