import React, { useState, useEffect, useMemo, useRef } from "react";
import { Filter, RefreshCcw, Layers, Cpu, Award, BarChart3, Sparkles, ChevronUp, ChevronDown, Package, CalendarDays, ArrowLeft, MousePointerClick, Download, Target, TrendingUp, Scale, Gauge } from "lucide-react";
import TopOutputChart from "./TopOutputChart";
import ProcessDateChart from "./ProcessDateChart";
import LineDateChart from "./LineDateChart";






import { ExportModal } from "../../../components/ExportModal";
import { getApiBaseUrl } from "../../../utils/apiConfig";
import { getGranularityDateInfo, isDateInPeriod, OutputGranularity, getISOWeekInfo } from "../utils/outputDateUtils";


const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  if (dateStr.includes('WK')) {
    const [y, wk] = dateStr.split('-');
    const yy = y.slice(-2);
    const wNum = wk.replace(/^[A-Za-z]+/, '');
    return `WK${yy}${wNum}`;
  }
  if (/^(?:WK|W)\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  const parts = dateStr.split('-');
  if (parts.length === 2) {
    return `${parts[1]}/${parts[0]}`;
  }
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
};

const getStartOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const getEndOfMonth = () => {
  const d = new Date();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const PROCESS_SEQUENCE = [
  "FFPC", "FVIC", "FSTH", "FHPS", "FVAC", "FBAK", "FPIC", "FOST", "FTPK",
  "SCSH2", "TF-2", "STKP", "FBLK", "FHPS2", "FVAC2", "FBAK2", "FADL",
  "FROL", "FOST2", "FIN", "QA", "3D3", "FBAK3", "PAK", "W/H"
];

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

const hasLineTarget = (groupName: string, factory?: "EFPC" | "SMT"): boolean => {
  if (!groupName) return false;
  const clean = groupName.trim().toUpperCase();
  const underscored = clean.replace(/[\s-]+/g, '_');
  const stripped = underscored.replace(/^LINE_/, '');
  const targetSet = factory === "SMT" ? SMT_TARGET_LINES : factory === "EFPC" ? EFPC_TARGET_LINES : TARGET_LINE_NAMES;
  return targetSet.has(clean) ||
         targetSet.has(underscored) ||
         targetSet.has(stripped) ||
         targetSet.has(underscored.replace(/_GEN$/, '_GENERAL')) ||
         targetSet.has(underscored.replace(/_NON$/, '_NON_SILICONE'));
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

export const getTargetForLine = (targetsByLine: { [k: string]: number } | undefined, lineName: string): number => {
  if (!targetsByLine || !lineName) return 0;
  const norm = normalizeLineKey(lineName);
  if (norm === 'ASY1_G') {
    const val = targetsByLine['ASY1_G'] ?? targetsByLine['ASSY 1'] ?? targetsByLine['ASSY1'] ?? targetsByLine['LINE ASY1_G'];
    if (val !== undefined) return val;
  }
  if (norm === 'ASY1_A') {
    const val = targetsByLine['ASY1_A'] ?? targetsByLine['ASSY 1AU'] ?? targetsByLine['ASSY 1 AU'] ?? targetsByLine['ASSY1AU'] ?? targetsByLine['LINE ASY1_A'];
    if (val !== undefined) return val;
  }
  if (norm === 'ASY2') {
    const val = targetsByLine['ASY2'] ?? targetsByLine['ASSY 2'] ?? targetsByLine['ASSY2'] ?? targetsByLine['LINE ASY2'];
    if (val !== undefined) return val;
  }
  if (norm === 'ASY3') {
    const val = targetsByLine['ASY3'] ?? targetsByLine['ASSY 3'] ?? targetsByLine['ASSY3'] ?? targetsByLine['LINE ASY3'];
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
};

const getDatesInRange = (startStr: string, endStr: string): string[] => {
  if (!startStr || !endStr) return [];
  const dates: string[] = [];
  const curr = new Date(startStr);
  const end = new Date(endStr);
  while (curr <= end) {
    dates.push(curr.toISOString().split("T")[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
};

export const getRowLineGroup = (row: any, lineGroups: LineGroupOption[]): string => {
  if (!row || !lineGroups || lineGroups.length === 0) return "Others";
  const rowProc = (row.process_name || "").trim().toUpperCase();
  const rowMc = (row.mc_line || "").trim().toUpperCase();
  const pName = (row.product_name || "").trim().toUpperCase();

  for (const g of lineGroups) {
    if (g.processes && g.processes.length > 0) {
      if (!g.processes.some(p => p.trim().toUpperCase() === rowProc)) continue;
    }
    if (g.mcLines && g.mcLines.length > 0) {
      if (!g.mcLines.some(m => m.trim().toUpperCase() === rowMc)) continue;
    }
    if (g.prefixes && g.prefixes.length > 0) {
      if (!g.prefixes.some(p => p && pName.startsWith(p.trim().toUpperCase()))) continue;
    }
    if (g.excludePrefixes && g.excludePrefixes.length > 0) {
      if (g.excludePrefixes.some(p => p && pName.startsWith(p.trim().toUpperCase()))) continue;
    }
    return g.name;
  }
  return "Others";
};

// Highly professional corporate data visualization colors (Tableau / Looker Studio style)
const CHART_COLORS = [
  "#2b5c8f", // Corporate Blue
  "#0d9488", // Deep Teal
  "#4f46e5", // Indigo
  "#0891b2", // Muted Cyan
  "#15803d", // Forest Green
  "#b91c1c", // Brick Red
  "#c2410c", // Rust Orange
  "#7c3aed", // Violet
  "#b45309", // Amber Gold
  "#a21caf", // Deep Fuchsia
  "#0284c7", // Sky Blue
  "#059669", // Emerald Green
  "#be123c", // Crimson Red
  "#475569", // Steel Grey
  "#6d28d9", // Dark Violet
  "#701a75", // Plum Purple
  "#ca8a04", // Ochre Yellow
  "#854d0e", // Bronze
  "#78350f", // Chocolate Brown
  "#881337", // Muted Burgundy
  "#1e3a8a", // Navy Blue
  "#064e3b", // Pine Green
  "#4c1d95", // Royal Purple
  "#115e59", // Dark Teal
  "#be185d", // Dusty Pink
  "#a16207", // Brass Gold
  "#4d7c0f", // Muted Sage
  "#1d4ed8", // Denim Blue
  "#5f9ea0", // Cadet Blue
  "#008b8b", // Dark Cyan
  "#cd5c5c", // Indian Red
  "#b8860b", // Dark Goldenrod
  "#a0522d", // Sienna Brown
  "#3cb371", // Medium Sea Green
  "#9932cc", // Dark Orchid
  "#4682b4", // Steel Blue
  "#6a5acd", // Slate Blue
  "#334155", // Charcoal
  "#1e293b", // Dark Slate
  "#6366f1"  // Slate Indigo
];

const getProcessIndex = (processName: string) => {
  const idx = PROCESS_SEQUENCE.indexOf(processName);
  return idx === -1 ? 999 : idx;
};

interface ProcessSummary {
  process_name: string;
  sum_pcs: number;
  sum_sht: number;
  sum_lot: number;
  mcline_count: number;
  mc_lines?: string;
  output_value?: number; // Used for the chart
}

type UnitMode = "Piece" | "Sheet" | "Lot";
export type OutputViewMode = "process" | "line";
type ProcessFamilyFilter = "All" | "FPC" | "SMT";

export interface LineGroupOption {
  name: string;
  factory?: string;
  mcLines?: string[];
  processes?: string[];
  prefixes?: string[];
  excludePrefixes?: string[];
}

interface ProductProcessOutput {
  product_name?: string;
  process_name?: string;
  mc_line?: string;
  output_date?: string;
  actual_pcs_qty: number;
  actual_sht_qty: number;
  actual_lot_qty: number;
}

type ExportRow = {
  Date: string;
  Process: string;
  "MC Lines": string;
  "Lot Qty"?: number;
  "Sheet Qty"?: number;
  "Piece Qty"?: number;
};

type ExportMcLineGroup = {
  Date: string;
  Process: string;
  mcLine: string;
  lotQty: number;
  sheetQty: number;
  pieceQty: number;
};

const exportStyledOutputByProcessExcel = async (rows: ExportRow[], fileName: string) => {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Output By Process", {
    views: [{ state: "frozen", ySplit: 1 }],
    properties: { defaultRowHeight: 22 },
  });

  const columns = Object.keys(rows[0]) as (keyof ExportRow)[];
  const columnWidths: Partial<Record<keyof ExportRow, number>> = {
    Date: 14,
    Process: 18,
    "MC Lines": 42,
    "Lot Qty": 14,
    "Sheet Qty": 14,
    "Piece Qty": 16,
  };

  worksheet.addTable({
    name: "OutputByProcessTable",
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium2",
      showRowStripes: true,
    },
    columns: columns.map((name) => ({ name, filterButton: true })),
    rows: rows.map((row) => columns.map((name) => row[name] ?? "")),
  });

  columns.forEach((name, index) => {
    const column = worksheet.getColumn(index + 1);
    column.width = columnWidths[name] ?? 16;
    if (name !== "Date" && name !== "Process" && name !== "MC Lines") {
      column.numFmt = "#,##0";
    }
  });

  const headerRow = worksheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4E78" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFB7C9D6" } },
      left: { style: "thin", color: { argb: "FFB7C9D6" } },
      bottom: { style: "thin", color: { argb: "FFB7C9D6" } },
      right: { style: "thin", color: { argb: "FFB7C9D6" } },
    };
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFD9E2EC" } },
        left: { style: "thin", color: { argb: "FFD9E2EC" } },
        bottom: { style: "thin", color: { argb: "FFD9E2EC" } },
        right: { style: "thin", color: { argb: "FFD9E2EC" } },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber <= 3 ? "left" : "right",
        wrapText: colNumber === 3,
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const getProcessFamily = (productName?: string, processName?: string): "FPC" | "SMT" => {
  const processInitial = processName?.trim().charAt(0).toUpperCase();
  if (processInitial === "M") return "SMT";
  if (processInitial === "F") return "FPC";

  return productName?.charAt(3).toUpperCase() === "Z" ? "SMT" : "FPC";
};

const SearchableDropdown = ({ value, onChange, options, placeholder }: { value: string, onChange: (val: string) => void, options: string[], placeholder: string }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
  }, [search, options]);

  return (
    <div className="relative w-full md:w-40 shrink-0" ref={dropdownRef}>
      <div
        className="input input-sm input-bordered w-full bg-base-100 flex items-center justify-between cursor-pointer text-sm pr-2"
        onClick={() => { setIsOpen(!isOpen); setSearch(""); }}
      >
        <span className="truncate">{value || placeholder}</span>
        <span className="opacity-50 text-[10px]">▼</span>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-base-300 bg-base-100 shadow-lg flex flex-col">
          <div className="p-2 border-b border-base-200">
            <input
              type="text"
              className="input input-xs input-bordered w-full focus:outline-none focus:ring-0 focus:border-primary"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-60 overflow-y-auto scrollbar-thin">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div
                  key={opt}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-base-200 ${value === opt ? "bg-primary/10 text-primary font-medium" : "text-base-content/85"}`}
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                  }}
                >
                  {opt}
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-base-content/50 italic">No options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ChartSkeleton: React.FC = () => {
  return (
    <div className="w-full min-h-[400px] flex flex-col gap-6 p-2">
      {/* Legend Skeleton */}
      <div className="flex justify-center items-center gap-3 w-full animate-pulse">
        <div className="h-3.5 w-12 bg-base-300 rounded"></div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-4.5 w-16 bg-base-300 rounded-full"></div>
          ))}
        </div>
      </div>

      {/* Bars Skeleton */}
      <div className="flex-1 flex items-end gap-3 md:gap-5 h-[350px] border-b border-l border-base-300 pb-2 pl-2 animate-pulse">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(i => {
          const heights = ["60%", "85%", "40%", "75%", "90%", "50%", "65%", "80%", "35%", "70%", "55%", "45%"];
          return (
            <div key={i} className="flex-1 flex flex-col justify-end gap-1.5 h-full">
              <div className="w-full bg-base-300/40 rounded-t" style={{ height: heights[(i - 1) % heights.length] }}>
                <div className="w-full bg-base-300/60 h-[30%] rounded-t"></div>
                <div className="w-full bg-base-300/40 h-[40%]"></div>
              </div>
              <div className="h-3 w-8 bg-base-200 rounded self-center mt-1"></div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ListSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-3 p-4 animate-pulse w-full">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="w-full h-16 bg-base-200/50 rounded-xl border border-base-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-base-300"></div>
            <div className="w-32 h-4 rounded bg-base-300"></div>
          </div>
          <div className="flex gap-4">
            <div className="w-16 h-4 rounded bg-base-300"></div>
            <div className="w-16 h-4 rounded bg-base-300"></div>
          </div>
        </div>
      ))}
    </div>
  );
};


const Page: React.FC = () => {
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  const [startDate, setStartDate] = useState(getStartOfMonth());
  const [endDate, setEndDate] = useState(getEndOfMonth());
  const [unitMode, setUnitMode] = useState<UnitMode>("Piece");
  const [granularity, setGranularity] = useState<OutputGranularity>("daily");
  const [viewMode, setViewMode] = useState<OutputViewMode>("process");
  const [selectedFactory, setSelectedFactory] = useState<"EFPC" | "SMT">("EFPC");
  const [selectedChartDate, setSelectedChartDate] = useState<string | null>(null);

  // Temporary states for UI controls before applying
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);

  const [lots, setLots] = useState<any[]>([]);
  const [productRows, setProductRows] = useState<ProductProcessOutput[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [lineGroups, setLineGroups] = useState<LineGroupOption[]>([]);
  const [selectedLineGroup, setSelectedLineGroup] = useState<string>("All");
  const [tempSelectedLineGroup, setTempSelectedLineGroup] = useState<string>("All");
  const [groupLineDropdownOpen, setGroupLineDropdownOpen] = useState(false);
  const [groupLineSearch, setGroupLineSearch] = useState("");
  const groupLineDropdownRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedProcess, setSelectedProcess] = useState<string>("");
  const [dailyProcessFilter, setDailyProcessFilter] = useState<string[]>([]);
  const [dailyLineFilter, setDailyLineFilter] = useState<string[]>([]);
  const [processFamilyFilter, setProcessFamilyFilter] = useState<ProcessFamilyFilter>("All");
  const [mcLineData, setMcLineData] = useState<{ mc_line: string; output_value: number; sum_pcs: number; sum_sht: number; sum_lot: number }[]>([]);
  const [isMcLineLoading, setIsMcLineLoading] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  // Sorting State - default to sorting by highest output quantity/percentage
  const [sortField, setSortField] = useState<"sequence" | "output_value">("output_value");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [detailsCurrentPage, setDetailsCurrentPage] = useState(1);
  const detailsItemsPerPage = 10;

  useEffect(() => {
    setDetailsCurrentPage(1);
  }, [selectedChartDate, selectedProcess, sortField, sortDirection]);

  // Removed fetchLines since Line filter is removed

  // Fetch lots and targets directly using the high-performance aggregated endpoint
  useEffect(() => {
    const fetchLots = async () => {
      if (!startDate || !endDate) return;

      setIsLoading(true);
      try {
        const url = `${getApiBaseUrl()}/outputbyprocess/dashboard-lots?`;
        const productUrl = `${getApiBaseUrl()}/outputbyproduct/dashboard-products?`;
        const targetUrl = `${getApiBaseUrl()}/outputbyprocess/dashboard-targets?startDate=${startDate}&endDate=${endDate}`;
        const baseParams = new URLSearchParams();
        baseParams.append("startDate", startDate);
        baseParams.append("endDate", endDate);

        const [resLots, resProducts, resTargets] = await Promise.all([
          fetch(url + baseParams.toString()),
          fetch(productUrl + baseParams.toString()),
          fetch(targetUrl)
        ]);
        if (resLots.ok) setLots(await resLots.json());
        if (resProducts.ok) setProductRows(await resProducts.json());
        if (resTargets && resTargets.ok) {
          setTargets(await resTargets.json());
        } else {
          setTargets([]);
        }
      } catch (error) {
        console.error("Failed to fetch lots or targets", error);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    };
    fetchLots();
  }, [startDate, endDate, refreshTrigger]);

  // Fallback targets fetch if switching to line mode and targets are not yet cached
  useEffect(() => {
    if (viewMode === "line" && targets.length === 0 && startDate && endDate && !isLoading) {
      fetch(`${getApiBaseUrl()}/outputbyprocess/dashboard-targets?startDate=${startDate}&endDate=${endDate}`)
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (Array.isArray(data) && data.length > 0) setTargets(data);
        })
        .catch(() => {});
    }
  }, [viewMode, targets.length, startDate, endDate, isLoading]);

  // Fetch Line Groups from line_output_mapping
  useEffect(() => {
    const fetchLineGroups = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/productivity/line-groups`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setLineGroups(
              data.map((g: any) => ({
                name: g.name || "",
                factory: g.factory || "SMT",
                mcLines: Array.isArray(g.mcLines) ? g.mcLines : g.mcLines ? Array.from(g.mcLines) : [],
                processes: Array.isArray(g.processes) ? g.processes : g.processes ? Array.from(g.processes) : [],
                prefixes: Array.isArray(g.prefixes) ? g.prefixes : g.prefixes ? Array.from(g.prefixes) : [],
                excludePrefixes: Array.isArray(g.excludePrefixes) ? g.excludePrefixes : [],
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load line groups for OutputByProcess:", err);
      }
    };
    fetchLineGroups();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (groupLineDropdownRef.current && !groupLineDropdownRef.current.contains(event.target as Node)) {
        setGroupLineDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredGroupLineOptions = useMemo(() => {
    let list = [...lineGroups];
    if (viewMode === "line") {
      list = list.filter(g => hasLineTarget(g.name, selectedFactory));
    }
    list.sort((a, b) => {
      const aHasTarget = hasLineTarget(a.name, selectedFactory) ? 1 : 0;
      const bHasTarget = hasLineTarget(b.name, selectedFactory) ? 1 : 0;
      if (aHasTarget !== bHasTarget) return bHasTarget - aHasTarget; // Lines with Target first!
      const fa = (a.factory || "").localeCompare(b.factory || "");
      if (fa !== 0) return fa;
      return (a.name || "").localeCompare(b.name || "");
    });
    if (!groupLineSearch.trim()) return list;
    const q = groupLineSearch.trim().toLowerCase();
    return list.filter(
      (g) => g.name.toLowerCase().includes(q) || (g.factory && g.factory.toLowerCase().includes(q))
    );
  }, [lineGroups, groupLineSearch, viewMode, selectedFactory]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    const start = getStartOfMonth();
    const end = getEndOfMonth();

    setEndDate(end);
    setStartDate(start);
    setTempEndDate(end);
    setTempStartDate(start);
    setSelectedChartDate(null);
    setSelectedProcess("");
    setDailyProcessFilter([]);
    setProcessFamilyFilter("All");
    setSelectedLineGroup("All");
    setTempSelectedLineGroup("All");
    setRefreshTrigger(prev => prev + 1);
  };

  const handleExport = () => {
    setExportError("");
    setIsExportModalOpen(true);
  };

  const handleConfirmExport = async (eStartDate: string, eEndDate: string, eProcesses: string[], eUnit: string) => {
    setIsExporting(true);
    setExportError("");
    try {
      const selectedExportProcesses = eProcesses.map(process => process.trim()).filter(Boolean);
      const params = new URLSearchParams();
      params.append("startDate", eStartDate);
      params.append("endDate", eEndDate);
      if (selectedExportProcesses.length > 0) params.append("process", selectedExportProcesses.join(","));

      const res = await fetch(`${getApiBaseUrl()}/outputbyproduct/dashboard-products?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch export data");

      let dataToProcess = await res.json();
      if (selectedExportProcesses.length > 0) {
        const processFilter = new Set(selectedExportProcesses);
        dataToProcess = dataToProcess.filter((item: any) => processFilter.has(item.process_name?.trim()));
      }
      if (selectedLineGroup !== "All") {
        const activeGroup = lineGroups.find((g) => (g.name || "").toUpperCase() === selectedLineGroup.toUpperCase());
        if (activeGroup) {
          dataToProcess = dataToProcess.filter((row: any) => {
            if (activeGroup.processes && activeGroup.processes.length > 0) {
              const rowProc = (row.process_name || "").trim().toUpperCase();
              if (!activeGroup.processes.some(p => p.trim().toUpperCase() === rowProc)) return false;
            }
            if (activeGroup.mcLines && activeGroup.mcLines.length > 0) {
              const rowMc = (row.mc_line || "").trim().toUpperCase();
              if (!activeGroup.mcLines.some(m => m.trim().toUpperCase() === rowMc)) return false;
            }
            if (activeGroup.prefixes && activeGroup.prefixes.length > 0) {
              const pName = (row.product_name || "").trim().toUpperCase();
              if (!activeGroup.prefixes.some(p => p && pName.startsWith(p.trim().toUpperCase()))) return false;
            }
            if (activeGroup.excludePrefixes && activeGroup.excludePrefixes.length > 0) {
              const pName = (row.product_name || "").trim().toUpperCase();
              if (activeGroup.excludePrefixes.some(p => p && pName.startsWith(p.trim().toUpperCase()))) return false;
            }
            return true;
          });
        }
      }
      const mcLineGroups = new Map<string, ExportMcLineGroup>();

      dataToProcess.forEach((item: any) => {
        const date = item.output_date || "";
        const process = item.process_name || "";
        const mcLine = item.mc_line?.trim() || "Unknown";
        if (!date || !process) return;

        const key = `${date}||${process}||${mcLine}`;
        if (!mcLineGroups.has(key)) {
          mcLineGroups.set(key, {
            Date: date,
            Process: process,
            mcLine,
            lotQty: 0,
            sheetQty: 0,
            pieceQty: 0,
          });
        }

        const group = mcLineGroups.get(key)!;
        group.lotQty += Number(item.actual_lot_qty || 0);
        group.sheetQty += Number(item.actual_sht_qty || 0);
        group.pieceQty += Number(item.actual_pcs_qty || 0);
      });

      const dataToExport: ExportRow[] = Array.from(mcLineGroups.values())
        .sort((a, b) => a.Date.localeCompare(b.Date) || a.Process.localeCompare(b.Process) || a.mcLine.localeCompare(b.mcLine))
        .map((item) => {
        const row: ExportRow = {
          Date: item.Date,
          Process: item.Process,
          "MC Lines": item.mcLine,
        };
        
        if (eUnit === "All" || eUnit === "Lot") row["Lot Qty"] = item.lotQty;
        if (eUnit === "All" || eUnit === "Sheet") row["Sheet Qty"] = item.sheetQty;
        if (eUnit === "All" || eUnit === "Piece") row["Piece Qty"] = item.pieceQty;
        
        return row;
      });

      if (dataToExport.length === 0) {
        setExportError("No data available for the selected date range and filters.");
        return;
      }

      await exportStyledOutputByProcessExcel(
        dataToExport,
        `OutputByProcess_${eStartDate}_${eEndDate}.xlsx`
      );
      
      setExportError("");
      setIsExportModalOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
      setExportError("Cannot export data right now. Please check the company network/API connection and try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleApplyFilters = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setSelectedLineGroup(tempSelectedLineGroup);
    setSelectedChartDate(null);
    setSelectedProcess("");
    setDailyProcessFilter([]);
    setProcessFamilyFilter("All");
  };

  // Dynamically map each loaded process name to a stable color to ensure no grey fallbacks
  const processColors = useMemo(() => {
    const colorsMap: Record<string, string> = {};
    const lotsArray = Array.isArray(lots) ? lots : [];

    // Extract distinct non-empty process names
    const uniqueNames = Array.from(
      new Set(lotsArray.map(lot => lot?.process_name).filter(Boolean))
    ) as string[];

    // Sort by standard index so standard processes get consistent colors
    uniqueNames.sort((a, b) => getProcessIndex(a) - getProcessIndex(b));

    // Assign unique colors dynamically from the professional 40-color palette
    uniqueNames.forEach((name, idx) => {
      colorsMap[name] = CHART_COLORS[idx % CHART_COLORS.length];
    });

    return colorsMap;
  }, [lots]);

  const getProcessColor = (processName: string) => {
    if (processName === "Others (อื่นๆ)") return "#d3d3d3";
    return processColors[processName] || "#2563eb"; // default fallback to corporate blue
  };

  // Aggregate Data with Safety Guards
  const chartFilteredData = useMemo(() => {
    if (!Array.isArray(lots)) return [];
    if (!selectedChartDate) return lots;
    return lots.filter(lot => isDateInPeriod(lot.output_date, selectedChartDate, granularity));
  }, [lots, selectedChartDate, granularity]);

  const chartFilteredProductRows = useMemo(() => {
    const rows = Array.isArray(productRows) ? productRows : [];
    const isTf2 = (name: string) => {
      const u = (name || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
      return u === 'TF_2' || u === 'LINE_TF_2' || u === 'AT_TF_2' || u === 'AT_TF2' || u === 'SUPPORT_TF2';
    };

    let activeGroup =
      selectedLineGroup !== "All"
        ? lineGroups.find((g) => (g.name || "").toUpperCase() === selectedLineGroup.toUpperCase())
        : null;

    // If user selects TF-2 / LINE TF-2, automatically combine both TF-2 and AT_TF-2 (FTPK + QTPK)
    if (activeGroup && isTf2(selectedLineGroup)) {
      const tfGroups = lineGroups.filter(g => isTf2(g.name));
      const combinedProcesses = new Set<string>();
      const combinedMcLines = new Set<string>();
      const combinedPrefixes = new Set<string>();
      const combinedExcludePrefixes = new Set<string>();

      tfGroups.forEach(g => {
        g.processes?.forEach(p => combinedProcesses.add(p));
        g.mcLines?.forEach(m => combinedMcLines.add(m));
        g.prefixes?.forEach(p => combinedPrefixes.add(p));
        g.excludePrefixes?.forEach(ep => combinedExcludePrefixes.add(ep));
      });

      activeGroup = {
        name: selectedLineGroup,
        processes: Array.from(combinedProcesses),
        mcLines: Array.from(combinedMcLines),
        prefixes: Array.from(combinedPrefixes),
        excludePrefixes: Array.from(combinedExcludePrefixes),
        factory: activeGroup.factory
      };
    }

    return rows.filter(row => {
      if (selectedChartDate && !isDateInPeriod(row.output_date, selectedChartDate, granularity)) return false;
      if (processFamilyFilter !== "All" && getProcessFamily(row.product_name, row.process_name) !== processFamilyFilter) return false;

      if (activeGroup) {
        // Filter by Process Name (if mapped for this line group)
        if (activeGroup.processes && activeGroup.processes.length > 0) {
          const rowProc = (row.process_name || "").trim().toUpperCase();
          const matchProc = activeGroup.processes.some((p) => p.trim().toUpperCase() === rowProc);
          if (!matchProc) return false;
        }

        // Filter by MC Line
        if (activeGroup.mcLines && activeGroup.mcLines.length > 0) {
          const rowMc = (row.mc_line || "").trim().toUpperCase();
          const matchMc = activeGroup.mcLines.some((m) => m.trim().toUpperCase() === rowMc);
          if (!matchMc) return false;
        }

        // Filter by Product Prefix
        if (activeGroup.prefixes && activeGroup.prefixes.length > 0) {
          const pName = (row.product_name || "").trim().toUpperCase();
          const matchPrefix = activeGroup.prefixes.some((p) => p && pName.startsWith(p.trim().toUpperCase()));
          if (!matchPrefix) return false;
        }

        // Filter by Exclude Prefix
        if (activeGroup.excludePrefixes && activeGroup.excludePrefixes.length > 0) {
          const pName = (row.product_name || "").trim().toUpperCase();
          const isExcluded = activeGroup.excludePrefixes.some((p) => p && pName.startsWith(p.trim().toUpperCase()));
          if (isExcluded) return false;
        }
      }

      return true;
    });
  }, [productRows, processFamilyFilter, selectedChartDate, granularity, selectedLineGroup, lineGroups]);

  const baseSummaryData = useMemo(() => {
    const summaryMap: Record<string, ProcessSummary> = {};

    if (processFamilyFilter !== "All" || selectedLineGroup !== "All") {
      const typedSummaryMap: Record<string, ProcessSummary & { mcLinesSet: Set<string> }> = {};

      chartFilteredProductRows.forEach(row => {
        if (!row) return;
        const pName = row.process_name;
        if (!pName) return;

        if (!typedSummaryMap[pName]) {
          typedSummaryMap[pName] = {
            process_name: pName,
            sum_pcs: 0,
            sum_sht: 0,
            sum_lot: 0,
            mcline_count: 0,
            mcLinesSet: new Set<string>()
          };
        }

        typedSummaryMap[pName].sum_pcs += Number(row.actual_pcs_qty || 0);
        typedSummaryMap[pName].sum_sht += Number(row.actual_sht_qty || 0);
        typedSummaryMap[pName].sum_lot += Number(row.actual_lot_qty || 0);
        if (row.mc_line) typedSummaryMap[pName].mcLinesSet.add(row.mc_line);
      });

      const typedSummaryArray = Object.values(typedSummaryMap).map(item => {
        const summary: ProcessSummary = {
          process_name: item.process_name,
          sum_pcs: item.sum_pcs,
          sum_sht: item.sum_sht,
          sum_lot: item.sum_lot,
          mcline_count: item.mcLinesSet.size
        };

        if (unitMode === "Piece") summary.output_value = summary.sum_pcs;
        else if (unitMode === "Sheet") summary.output_value = summary.sum_sht;
        else summary.output_value = summary.sum_lot;

        return summary;
      });

      typedSummaryArray.sort((a, b) => getProcessIndex(a.process_name) - getProcessIndex(b.process_name));
      return typedSummaryArray;
    }

    chartFilteredData.forEach(lot => {
      if (!lot) return;
      const pName = lot.process_name;
      if (!pName) return;

      if (!summaryMap[pName]) {
        summaryMap[pName] = {
          process_name: pName,
          sum_pcs: 0,
          sum_sht: 0,
          sum_lot: 0,
          mcline_count: Number(lot.mcline_count || 0)
        };
      } else {
        summaryMap[pName].mcline_count = Math.max(summaryMap[pName].mcline_count, Number(lot.mcline_count || 0));
      }
      summaryMap[pName].sum_pcs += Number(lot.actual_pcs_qty || 0);
      summaryMap[pName].sum_sht += Number(lot.actual_sht_qty || 0);
      summaryMap[pName].sum_lot += Number(lot.actual_lot_qty || 0);
    });

    const summaryArray = Object.values(summaryMap);
    summaryArray.sort((a, b) => getProcessIndex(a.process_name) - getProcessIndex(b.process_name));

    // Set output_value based on selected unitMode
    summaryArray.forEach(item => {
      if (unitMode === "Piece") item.output_value = item.sum_pcs;
      else if (unitMode === "Sheet") item.output_value = item.sum_sht;
      else item.output_value = item.sum_lot;
    });

    return summaryArray;
  }, [chartFilteredData, chartFilteredProductRows, processFamilyFilter, selectedLineGroup, unitMode]);

  const activeSummaryProcessFilter = useMemo(() => {
    if (viewMode === "line") return [];
    const exactSelectedProcess = selectedProcess && baseSummaryData.some(item => item.process_name === selectedProcess);
    if (exactSelectedProcess) return [selectedProcess];
    if (dailyProcessFilter.length === 0) return [];
    if (dailyProcessFilter.length >= baseSummaryData.length) return [];
    return dailyProcessFilter;
  }, [baseSummaryData, dailyProcessFilter, selectedProcess, viewMode]);

  const summaryData = useMemo(() => {
    if (activeSummaryProcessFilter.length === 0) return baseSummaryData;
    const filterSet = new Set(activeSummaryProcessFilter);
    return baseSummaryData.filter(item => filterSet.has(item.process_name));
  }, [baseSummaryData, activeSummaryProcessFilter]);

  const isSummaryFiltered = activeSummaryProcessFilter.length > 0;

  const summaryFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (selectedLineGroup !== "All") parts.push(`Group: ${selectedLineGroup}`);
    if (processFamilyFilter !== "All") parts.push(`${processFamilyFilter} products`);
    if (isSummaryFiltered) {
      if (activeSummaryProcessFilter.length === 1) parts.push(activeSummaryProcessFilter[0]);
      else parts.push(`${activeSummaryProcessFilter.length} processes`);
    }
    return parts.length > 0 ? parts.join(" • ") : "Across all processes";
  }, [activeSummaryProcessFilter, isSummaryFiltered, processFamilyFilter, selectedLineGroup]);

  // Compute stats for KPI Cards
  const stats = useMemo(() => {
    const total = summaryData.reduce((acc, curr) => acc + (curr.output_value || 0), 0);
    const activeCount = summaryData.filter(item => (item.output_value || 0) > 0).length;

    let topProcess: ProcessSummary | null = null;
    let maxVal = -1;
    let sheets = 0;
    let pieces = 0;
    let lotsCount = 0;

    summaryData.forEach(item => {
      const val = item.output_value || 0;
      if (val > maxVal) {
        maxVal = val;
        topProcess = item;
      }
      sheets += item.sum_sht || 0;
      pieces += item.sum_pcs || 0;
      lotsCount += item.sum_lot || 0;
    });

    let activeProducts = 0;
    if (selectedLineGroup !== "All" || processFamilyFilter !== "All") {
      const processFilterSet = new Set(activeSummaryProcessFilter);
      const activeProductsSet = new Set<string>();

      chartFilteredProductRows.forEach(row => {
        if (!row.product_name) return;
        if (processFilterSet.size > 0 && !processFilterSet.has(row.process_name || "")) return;
        const hasOutput = Number(row.actual_pcs_qty || 0) > 0 || Number(row.actual_sht_qty || 0) > 0 || Number(row.actual_lot_qty || 0) > 0;
        if (hasOutput) activeProductsSet.add(row.product_name);
      });

      activeProducts = activeProductsSet.size;
    } else {
      const lotsArray = Array.isArray(lots) ? lots : [];
      activeProducts = Number(lotsArray[0]?.active_products_count || 0);
    }

    return {
      total,
      activeCount,
      topProcess,
      sheets,
      pieces,
      lotsCount,
      activeProducts
    };
  }, [summaryData, lots, chartFilteredProductRows, activeSummaryProcessFilter]);

  // Line Summary Data for By Line mode
  const lineSummaryData = useMemo(() => {
    const rows = chartFilteredProductRows;
    if (!rows || rows.length === 0) return [];

    const lineMap: Record<string, {
      line_name: string;
      sum_pcs: number;
      sum_sht: number;
      sum_lot: number;
      output_value: number;
      productsSet: Set<string>;
    }> = {};

    rows.forEach(item => {
      const rawLineName = getRowLineGroup(item, lineGroups);
      const lineName = normalizeLineKey(rawLineName);
      if (!lineName || !hasLineTarget(lineName, selectedFactory)) return;

      if (!lineMap[lineName]) {
        lineMap[lineName] = {
          line_name: lineName,
          sum_pcs: 0,
          sum_sht: 0,
          sum_lot: 0,
          output_value: 0,
          productsSet: new Set<string>()
        };
      }

      const pcs = Number(item.actual_pcs_qty || 0);
      const sht = Number(item.actual_sht_qty || 0);
      const lot = Number(item.actual_lot_qty || 0);

      lineMap[lineName].sum_pcs += pcs;
      lineMap[lineName].sum_sht += sht;
      lineMap[lineName].sum_lot += lot;
      if (item.product_name) lineMap[lineName].productsSet.add(item.product_name);
    });

    if (selectedFactory === "EFPC") {
      // Compute LINE B if sub-lines exist
      const bGen = lineMap['LINE B_GEN'];
      const bNon = lineMap['LINE B_NON'];
      const bJdt = lineMap['LINE B_JDT'] || lineMap['LINE B_JDI'];
      if (bGen || bNon || bJdt) {
        const bSet = new Set<string>();
        if (bGen) bGen.productsSet.forEach(p => bSet.add(p));
        if (bNon) bNon.productsSet.forEach(p => bSet.add(p));
        if (bJdt) bJdt.productsSet.forEach(p => bSet.add(p));
        lineMap['LINE B'] = {
          line_name: 'LINE B',
          sum_pcs: (bGen?.sum_pcs || 0) + (bNon?.sum_pcs || 0) + (bJdt?.sum_pcs || 0),
          sum_sht: (bGen?.sum_sht || 0) + (bNon?.sum_sht || 0) + (bJdt?.sum_lot || 0),
          sum_lot: (bGen?.sum_lot || 0) + (bNon?.sum_lot || 0) + (bJdt?.sum_lot || 0),
          output_value: 0,
          productsSet: bSet
        };
      }
    }

    const list = Object.values(lineMap).map(l => {
      let val = 0;
      if (unitMode === "Piece") val = l.sum_pcs;
      else if (unitMode === "Sheet") val = l.sum_sht;
      else val = l.sum_lot;
      return {
        ...l,
        output_value: val
      };
    });

    return list.sort((a, b) => a.line_name.localeCompare(b.line_name));
  }, [chartFilteredProductRows, lineGroups, unitMode, selectedFactory]);

  const targetMapByDate = useMemo(() => {
    const map = new Map<string, {
      PCS: number;
      SHEET: number;
      LOT: number;
      byLine: {
        [lineName: string]: { PCS: number; SHEET: number; LOT: number };
      };
    }>();

    (targets || []).forEach(t => {
      const d = t.plan_date;
      if (!d) return;
      if (!map.has(d)) {
        map.set(d, { PCS: 0, SHEET: 0, LOT: 0, byLine: {} });
      }
      const entry = map.get(d)!;
      const type = (t.plan_type || "").toUpperCase().trim();
      const qty = Number(t.target_qty || 0);
      const isPcs = type === "PCS" || type === "PIECE" || type === "PIECES";
      const isSht = type === "SHEET" || type === "SHT" || type === "SHEETS";
      const isLot = type === "LOT" || type === "LOTS";

      if (isPcs) entry.PCS += qty;
      else if (isSht) entry.SHEET += qty;
      else if (isLot) entry.LOT += qty;

      if (t.line_code) {
        const lineKey = normalizeLineKey(t.line_code);

        const setTarget = (k: string) => {
          if (!k) return;
          if (!entry.byLine[k]) {
            entry.byLine[k] = { PCS: 0, SHEET: 0, LOT: 0 };
          }
          if (isPcs) entry.byLine[k].PCS += qty;
          else if (isSht) entry.byLine[k].SHEET += qty;
          else if (isLot) entry.byLine[k].LOT += qty;
        };

        // Store ONLY under canonical normalized key to prevent duplicate target sums
        setTarget(lineKey);
      }
    });

    // Compute combined LINE B target for every date
    map.forEach(entry => {
      const bGen = entry.byLine['LINE B_GEN'] || { PCS: 0, SHEET: 0, LOT: 0 };
      const bNon = entry.byLine['LINE B_NON'] || { PCS: 0, SHEET: 0, LOT: 0 };
      const bJdt = entry.byLine['LINE B_JDT'] || entry.byLine['LINE B_JDI'] || { PCS: 0, SHEET: 0, LOT: 0 };
      entry.byLine['LINE B'] = {
        PCS: bGen.PCS + bNon.PCS + bJdt.PCS,
        SHEET: bGen.SHEET + bNon.SHEET + bJdt.SHEET,
        LOT: bGen.LOT + bNon.LOT + bJdt.LOT
      };

      // Compute combined MOTB (A-1..A-4) target for every date
      const a1 = entry.byLine['A-1'] || entry.byLine['A1'] || { PCS: 0, SHEET: 0, LOT: 0 };
      const a2 = entry.byLine['A-2'] || entry.byLine['A2'] || { PCS: 0, SHEET: 0, LOT: 0 };
      const a3 = entry.byLine['A-3'] || entry.byLine['A3'] || { PCS: 0, SHEET: 0, LOT: 0 };
      const a4 = entry.byLine['A-4'] || entry.byLine['A4'] || { PCS: 0, SHEET: 0, LOT: 0 };
      const motbSum = {
        PCS: a1.PCS + a2.PCS + a3.PCS + a4.PCS,
        SHEET: a1.SHEET + a2.SHEET + a3.SHEET + a4.SHEET,
        LOT: a1.LOT + a2.LOT + a3.LOT + a4.LOT
      };
      if (!entry.byLine['MOTB'] || (entry.byLine['MOTB'].PCS === 0 && motbSum.PCS > 0)) {
        entry.byLine['MOTB'] = motbSum;
      }
      entry.byLine['LINE_MOTB'] = entry.byLine['MOTB'];
      entry.byLine['LINE MOTB'] = entry.byLine['MOTB'];

      // Compute combined MOTA_A (A-5..A-6) target for every date
      const a5 = entry.byLine['A-5'] || entry.byLine['A5'] || { PCS: 0, SHEET: 0, LOT: 0 };
      const a6 = entry.byLine['A-6'] || entry.byLine['A6'] || { PCS: 0, SHEET: 0, LOT: 0 };
      const motaASum = {
        PCS: a5.PCS + a6.PCS,
        SHEET: a5.SHEET + a6.SHEET,
        LOT: a5.LOT + a6.LOT
      };
      if (!entry.byLine['MOTA_A'] || (entry.byLine['MOTA_A'].PCS === 0 && motaASum.PCS > 0)) {
        entry.byLine['MOTA_A'] = motaASum;
      }
      entry.byLine['LINE_MOTA_A'] = entry.byLine['MOTA_A'];
      entry.byLine['LINE MOTA_A'] = entry.byLine['MOTA_A'];

      // Compute combined MOTA_G (A-7..A-8) target for every date
      const a7 = entry.byLine['A-7'] || entry.byLine['A7'] || { PCS: 0, SHEET: 0, LOT: 0 };
      const a8 = entry.byLine['A-8'] || entry.byLine['A8'] || { PCS: 0, SHEET: 0, LOT: 0 };
      const motaGSum = {
        PCS: a7.PCS + a8.PCS,
        SHEET: a7.SHEET + a8.SHEET,
        LOT: a7.LOT + a8.LOT
      };
      if (!entry.byLine['MOTA_G'] || (entry.byLine['MOTA_G'].PCS === 0 && motaGSum.PCS > 0)) {
        entry.byLine['MOTA_G'] = motaGSum;
      }
      entry.byLine['LINE_MOTA_G'] = entry.byLine['MOTA_G'];
      entry.byLine['LINE MOTA_G'] = entry.byLine['MOTA_G'];

      // Compute combined MOTC (G-1..G-5) target for every date
      const g1 = entry.byLine['G-1'] || entry.byLine['G1'] || { PCS: 0, SHEET: 0, LOT: 0 };
      const g2 = entry.byLine['G-2'] || entry.byLine['G2'] || { PCS: 0, SHEET: 0, LOT: 0 };
      const g3 = entry.byLine['G-3'] || entry.byLine['G3'] || { PCS: 0, SHEET: 0, LOT: 0 };
      const g4 = entry.byLine['G-4'] || entry.byLine['G4'] || { PCS: 0, SHEET: 0, LOT: 0 };
      const g5 = entry.byLine['G-5'] || entry.byLine['G5'] || { PCS: 0, SHEET: 0, LOT: 0 };
      const motcSum = {
        PCS: g1.PCS + g2.PCS + g3.PCS + g4.PCS + g5.PCS,
        SHEET: g1.SHEET + g2.SHEET + g3.SHEET + g4.SHEET + g5.SHEET,
        LOT: g1.LOT + g2.LOT + g3.LOT + g4.LOT + g5.LOT
      };
      if (!entry.byLine['MOTC'] || (entry.byLine['MOTC'].PCS === 0 && motcSum.PCS > 0)) {
        entry.byLine['MOTC'] = motcSum;
      }
      entry.byLine['LINE_MOTC'] = entry.byLine['MOTC'];
      entry.byLine['LINE MOTC'] = entry.byLine['MOTC'];
      entry.byLine['AIX-MOT'] = entry.byLine['MOTC'];

      // Compute combined MOTD (G-6..G-10) target for every date
      const g6 = entry.byLine['G-6'] || entry.byLine['G6'] || { PCS: 0, SHEET: 0, LOT: 0 };
      const g7 = entry.byLine['G-7'] || entry.byLine['G7'] || { PCS: 0, SHEET: 0, LOT: 0 };
      const g8 = entry.byLine['G-8'] || entry.byLine['G8'] || { PCS: 0, SHEET: 0, LOT: 0 };
      const g9 = entry.byLine['G-9'] || entry.byLine['G9'] || { PCS: 0, SHEET: 0, LOT: 0 };
      const g10 = entry.byLine['G-10'] || entry.byLine['G10'] || { PCS: 0, SHEET: 0, LOT: 0 };
      const motdSum = {
        PCS: g6.PCS + g7.PCS + g8.PCS + g9.PCS + g10.PCS,
        SHEET: g6.SHEET + g7.SHEET + g8.SHEET + g9.SHEET + g10.SHEET,
        LOT: g6.LOT + g7.LOT + g8.LOT + g9.LOT + g10.LOT
      };
      if (!entry.byLine['MOTD'] || (entry.byLine['MOTD'].PCS === 0 && motdSum.PCS > 0)) {
        entry.byLine['MOTD'] = motdSum;
      }
      entry.byLine['LINE_MOTD'] = entry.byLine['MOTD'];
      entry.byLine['LINE MOTD'] = entry.byLine['MOTD'];
    });

    return map;
  }, [targets]);

  const chartDataAndProcs = useMemo(() => {
    if (viewMode === "line") {
      const lineSet = new Set<string>();
      const dateMap = new Map<string, any>();

      // Populate ALL dates in the selected date range
      const allDates = getDatesInRange(startDate, endDate);
      allDates.forEach(dStr => {
        const info = getGranularityDateInfo(dStr, granularity);
        const key = info.key;
        if (!dateMap.has(key)) {
          dateMap.set(key, {
            raw_date: key,
            date_label: info.label,
            short_label: info.shortLabel,
            tooltip_title: info.tooltipTitle,
            granularity,
            periodType: info.periodType,
            total: 0,
            total_pcs: 0,
            total_sht: 0,
            total_lot: 0,
            target_qty: 0,
            targets_by_line: {}
          });
        }
      });

      const rows = chartFilteredProductRows;
      (rows || []).forEach(item => {
        const d = item.output_date;
        if (!d) return;
        const rawLineName = getRowLineGroup(item, lineGroups);
        const lineName = normalizeLineKey(rawLineName);
        if (!lineName || !hasLineTarget(lineName, selectedFactory)) return;

        lineSet.add(lineName);
        const isBSubLine = lineName === 'LINE B_GEN' || lineName === 'LINE B_NON' || lineName === 'LINE B_JDT' || lineName === 'LINE B_JDI';
        if (isBSubLine && selectedFactory === 'EFPC') lineSet.add('LINE B');

        const pcs = Number(item.actual_pcs_qty || 0);
        const sht = Number(item.actual_sht_qty || 0);
        const lot = Number(item.actual_lot_qty || 0);
        const val = unitMode === "Piece" ? pcs : unitMode === "Sheet" ? sht : lot;

        const info = getGranularityDateInfo(d, granularity);
        const key = info.key;

        if (!dateMap.has(key)) {
          dateMap.set(key, {
            raw_date: key,
            date_label: info.label,
            short_label: info.shortLabel,
            tooltip_title: info.tooltipTitle,
            granularity,
            total: 0,
            total_pcs: 0,
            total_sht: 0,
            total_lot: 0,
            target_qty: 0,
            targets_by_line: {}
          });
        }
        const existing = dateMap.get(key);
        existing[lineName] = (existing[lineName] || 0) + val;
        if (isBSubLine && selectedFactory === 'EFPC') {
          existing['LINE B'] = (existing['LINE B'] || 0) + val;
        }
        if (isMainSummaryLine(lineName, selectedFactory) && lineName !== 'LINE B') {
          existing.total += val;
          existing.total_pcs += pcs;
          existing.total_sht += sht;
          existing.total_lot += lot;
        }
      });

      const efpcCanonicalSummaryLines = ['LINE A', 'LINE B_GEN', 'LINE B_NON', 'LINE B_JDT', 'LINE C', 'LINE D'];
      const smtCanonicalSummaryLines = ['ASY1_G', 'ASY1_A', 'ASY2', 'ASY3', 'MOTB', 'MOTA_A', 'MOTA_G', 'MOTC', 'MOTD'];
      const factorySummaryLines = selectedFactory === 'EFPC' ? efpcCanonicalSummaryLines : smtCanonicalSummaryLines;

      dateMap.forEach((entry, key) => {
        let targetSum = 0;
        const targetsByLine: { [lineName: string]: number } = {};

        targetMapByDate.forEach((tEntry, tDate) => {
          if (isDateInPeriod(tDate, key, granularity)) {
            Object.entries(tEntry.byLine || {}).forEach(([ln, obj]) => {
              if (unitMode === "Piece") {
                targetsByLine[ln] = (targetsByLine[ln] || 0) + obj.PCS;
              } else if (unitMode === "Sheet") {
                targetsByLine[ln] = (targetsByLine[ln] || 0) + obj.SHEET;
              } else {
                targetsByLine[ln] = (targetsByLine[ln] || 0) + obj.LOT;
              }
            });

            factorySummaryLines.forEach(ln => {
              const obj = tEntry.byLine?.[ln];
              if (obj) {
                if (unitMode === "Piece") targetSum += obj.PCS;
                else if (unitMode === "Sheet") targetSum += obj.SHEET;
                else targetSum += obj.LOT;
              }
            });
          }
        });
        entry.target_qty = targetSum;
        entry.targets_by_line = targetsByLine;
      });

      // Ensure all target-configured lines are in lineSet so they appear in the filter dropdown
      lineGroups.forEach(g => {
        if (g.name && hasLineTarget(g.name, selectedFactory)) {
          const norm = normalizeLineKey(g.name);
          lineSet.add(norm || g.name);
        }
      });
      targets.forEach(t => {
        if (t.line_code) {
          const norm = normalizeLineKey(t.line_code);
          // A-1..A-8 are mapped to MOTB, MOTA_A, MOTA_G
          if (/^A-[1-8]$/.test(norm) || /^A[1-8]$/.test(norm)) return;
          // G-1..G-10 are mapped to MOTC, MOTD
          if (/^G-([1-9]|10)$/.test(norm) || /^G([1-9]|10)$/.test(norm)) return;
          if (norm && hasLineTarget(norm, selectedFactory)) lineSet.add(norm);
        }
      });
      if (selectedFactory === 'SMT') {
        lineSet.add('MOTB');
        lineSet.add('MOTA_A');
        lineSet.add('MOTA_G');
        lineSet.add('MOTC');
        lineSet.add('MOTD');
      }

      const finalData = Array.from(dateMap.values()).sort((a, b) => a.raw_date.localeCompare(b.raw_date));
      return {
        dailyChartData: finalData,
        activeProcesses: Array.from(lineSet).sort()
      };
    }

    const isFiltered = processFamilyFilter !== "All" || selectedLineGroup !== "All";
    const dataSource = isFiltered ? chartFilteredProductRows : (Array.isArray(lots) ? lots : []);
    if (!Array.isArray(dataSource) || dataSource.length === 0) return { dailyChartData: [], activeProcesses: [] };

    const procSet = new Set<string>();
    const dateMap = new Map<string, any>();

    // Populate ALL dates in the selected date range so By Process shows all days in period
    const allDates = getDatesInRange(startDate, endDate);
    allDates.forEach(dStr => {
      const info = getGranularityDateInfo(dStr, granularity);
      const key = info.key;
      if (!dateMap.has(key)) {
        dateMap.set(key, {
          raw_date: key,
          date_label: info.label,
          short_label: info.shortLabel,
          tooltip_title: info.tooltipTitle,
          granularity,
          total: 0,
          total_pcs: 0,
          total_sht: 0,
          total_lot: 0,
          target_qty: 0,
          targets_by_line: {}
        });
      }
    });

    dataSource.forEach(item => {
      const d = item.output_date;
      const p = item.process_name;
      if (!d || !p) return;

      let val = 0;
      if (unitMode === "Piece") val = Number(item.actual_pcs_qty || 0);
      else if (unitMode === "Sheet") val = Number(item.actual_sht_qty || 0);
      else val = Number(item.actual_lot_qty || 0);

      const pcs = Number(item.actual_pcs_qty || 0);
      const sht = Number(item.actual_sht_qty || 0);
      const lotVal = Number(item.actual_lot_qty || 0);

      if (pcs > 0 || sht > 0 || lotVal > 0) {
        procSet.add(p);
        const info = getGranularityDateInfo(d, granularity);
        const key = info.key;

        if (!dateMap.has(key)) {
          dateMap.set(key, {
            raw_date: key,
            date_label: info.label,
            short_label: info.shortLabel,
            tooltip_title: info.tooltipTitle,
            granularity,
            total: 0,
            total_pcs: 0,
            total_sht: 0,
            total_lot: 0,
            target_qty: 0,
            targets_by_line: {}
          });
        }
        const existing = dateMap.get(key);
        existing[p] = (existing[p] || 0) + val;
        existing.total += val;
        existing.total_pcs += pcs;
        existing.total_sht += sht;
        existing.total_lot += lotVal;
      }
    });



    const finalData = Array.from(dateMap.values()).sort((a, b) => a.raw_date.localeCompare(b.raw_date));
    return {
      dailyChartData: finalData,
      activeProcesses: Array.from(procSet)
    };
  }, [lots, chartFilteredProductRows, processFamilyFilter, selectedLineGroup, unitMode, granularity, targetMapByDate, viewMode, lineGroups, startDate, endDate, selectedFactory, targets]);

  const lineStats = useMemo(() => {
    const totalLinesCount = lineSummaryData.length;
    const isLineFiltered = dailyLineFilter.length > 0 && dailyLineFilter.length < totalLinesCount;

    let activeLines = lineSummaryData;
    if (isLineFiltered) {
      activeLines = lineSummaryData.filter(l => dailyLineFilter.includes(l.line_name));
    } else {
      // In default view (All Lines): ONLY include main summary lines
      const mainLines = lineSummaryData.filter(l => isMainSummaryLine(l.line_name, selectedFactory) && l.line_name !== 'LINE B');
      if (mainLines.length > 0) {
        activeLines = mainLines;
      }
    }

    const total = activeLines.reduce((acc, curr) => acc + (curr.output_value || 0), 0);
    const activeCount = lineSummaryData.filter(item => (item.output_value || 0) > 0).length;

    let topLine: (typeof lineSummaryData)[0] | null = null;
    let maxVal = -1;

    activeLines.forEach(item => {
      const val = item.output_value || 0;
      if (val > maxVal) {
        maxVal = val;
        topLine = item;
      }
    });

    const activeProductsSet = new Set<string>();
    activeLines.forEach(item => {
      item.productsSet.forEach(p => activeProductsSet.add(p));
    });

    // Determine cutoff date: today (real-time production date), selectedChartDate, or endDate if in the past
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    let cutoffDate = todayStr;
    if (selectedChartDate) {
      cutoffDate = selectedChartDate;
    } else if (endDate && endDate < todayStr) {
      cutoffDate = endDate;
    }

    const activeLineNames = activeLines.map(l => l.line_name);

    // Calculate Acc Output and Acc Target strictly up to cutoffDate (settled data up to yesterday)
    const chartDays = chartDataAndProcs?.dailyChartData || [];
    let accOutput = 0;
    let accTarget = 0;

    let cutoffKey = cutoffDate;
    let startKey = startDate || "";

    if (granularity === "weekly") {
      cutoffKey = cutoffDate.includes("WK") ? cutoffDate : getISOWeekInfo(cutoffDate).weekKey;
      startKey = startDate ? (startDate.includes("WK") ? startDate : getISOWeekInfo(startDate).weekKey) : "";
    } else if (granularity === "monthly") {
      cutoffKey = cutoffDate.substring(0, 7);
      startKey = startDate ? startDate.substring(0, 7) : "";
    }

    chartDays.forEach((d: any) => {
      if (cutoffKey && d.raw_date > cutoffKey) return;
      if (startKey && d.raw_date < startKey) return;

      activeLineNames.forEach(line => {
        accOutput += Number(d[line] || 0);
      });

      if (!isLineFiltered) {
        accTarget += Number(d.target_qty || 0);
      } else {
        activeLineNames.forEach(line => {
          accTarget += getTargetForLine(d.targets_by_line, line);
        });
      }
    });

    const filterTitle = isLineFiltered
      ? (dailyLineFilter.length === 1 ? dailyLineFilter[0] : `${dailyLineFilter.length} lines`)
      : (selectedLineGroup !== "All" ? selectedLineGroup : (selectedFactory === "EFPC" ? "Line A - D" : "All SMT Lines"));

    const topLineShare = topLine && accOutput > 0
      ? ((topLine.output_value || 0) / accOutput * 100).toFixed(1)
      : "0";

    const activePercent = totalLinesCount > 0
      ? ((activeCount / totalLinesCount) * 100).toFixed(0)
      : "0";

    const achievementRate = accTarget > 0
      ? ((accOutput / accTarget) * 100).toFixed(1)
      : "0";

    const diffTarget = accOutput - accTarget;

    return {
      total: accOutput,
      accOutput,
      accTarget,
      achievementRate,
      diffTarget,
      cutoffDate,
      activeCount,
      totalLinesCount,
      activeProducts: activeProductsSet.size,
      topLine,
      filterTitle,
      isLineFiltered,
      topLineShare,
      activePercent
    };
  }, [lineSummaryData, dailyLineFilter, selectedLineGroup, chartDataAndProcs, selectedChartDate, startDate, endDate, selectedFactory, granularity]);

  const multiUnitData = useMemo(() => {
    if (viewMode === "line") {
      const rows = chartFilteredProductRows;
      if (!rows || rows.length === 0) return undefined;

      const createUnitData = (unitKey: 'actual_pcs_qty' | 'actual_sht_qty' | 'actual_lot_qty', targetType: 'PCS' | 'SHEET' | 'LOT') => {
        const dateMap = new Map<string, any>();

        // Populate ALL dates in the selected date range
        const allDates = getDatesInRange(startDate, endDate);
        allDates.forEach(dStr => {
          const info = getGranularityDateInfo(dStr, granularity);
          const key = info.key;
          if (!dateMap.has(key)) {
            dateMap.set(key, {
              raw_date: key,
              date_label: info.label,
              short_label: info.shortLabel,
              tooltip_title: info.tooltipTitle,
              granularity,
              periodType: info.periodType,
              total: 0,
              target_qty: 0,
              targets_by_line: {}
            });
          }
        });

        rows.forEach(item => {
          const d = item.output_date;
          if (!d) return;
          const rawLineName = getRowLineGroup(item, lineGroups);
          const lineName = normalizeLineKey(rawLineName);
          // Only lines with target for this factory!
          if (!lineName || !hasLineTarget(lineName, selectedFactory)) return;

          const val = Number(item[unitKey] || 0);
          const isBSubLine = lineName === 'LINE B_GEN' || lineName === 'LINE B_NON' || lineName === 'LINE B_JDT' || lineName === 'LINE B_JDI';
          const info = getGranularityDateInfo(d, granularity);
          const key = info.key;

          if (!dateMap.has(key)) {
            dateMap.set(key, {
              raw_date: key,
              date_label: info.label,
              short_label: info.shortLabel,
              tooltip_title: info.tooltipTitle,
              granularity,
              periodType: info.periodType,
              total: 0,
              target_qty: 0,
              targets_by_line: {}
            });
          }
          const existing = dateMap.get(key);
          existing[lineName] = (existing[lineName] || 0) + val;
          if (isBSubLine && selectedFactory === 'EFPC') {
            existing['LINE B'] = (existing['LINE B'] || 0) + val;
          }
          if (isMainSummaryLine(lineName, selectedFactory) && lineName !== 'LINE B') {
            existing.total += val;
          }
        });

        targetMapByDate.forEach((tEntry, tDate) => {
          const info = getGranularityDateInfo(tDate, granularity);
          const key = info.key;
          if (!dateMap.has(key)) {
            dateMap.set(key, {
              raw_date: key,
              date_label: info.label,
              short_label: info.shortLabel,
              tooltip_title: info.tooltipTitle,
              granularity,
              periodType: info.periodType,
              total: 0,
              target_qty: 0,
              targets_by_line: {}
            });
          }
        });

        const efpcCanonicalSummaryLines = ['LINE A', 'LINE B_GEN', 'LINE B_NON', 'LINE B_JDT', 'LINE C', 'LINE D'];
        const smtCanonicalSummaryLines = ['ASY1_G', 'ASY1_A', 'ASY2', 'ASY3', 'MOTB', 'MOTA_A', 'MOTA_G', 'MOTC', 'MOTD'];
        const factorySummaryLines = selectedFactory === 'EFPC' ? efpcCanonicalSummaryLines : smtCanonicalSummaryLines;

        dateMap.forEach((entry, key) => {
          let targetSum = 0;
          const targetsByLine: { [lineName: string]: number } = {};

          targetMapByDate.forEach((tEntry, tDate) => {
            if (isDateInPeriod(tDate, key, granularity)) {
              Object.entries(tEntry.byLine || {}).forEach(([ln, obj]) => {
                if (targetType === "PCS") {
                  targetsByLine[ln] = (targetsByLine[ln] || 0) + obj.PCS;
                } else if (targetType === "SHEET") {
                  targetsByLine[ln] = (targetsByLine[ln] || 0) + obj.SHEET;
                } else {
                  targetsByLine[ln] = (targetsByLine[ln] || 0) + obj.LOT;
                }
              });

              factorySummaryLines.forEach(ln => {
                const obj = tEntry.byLine?.[ln];
                if (obj) {
                  if (targetType === "PCS") targetSum += obj.PCS;
                  else if (targetType === "SHEET") targetSum += obj.SHEET;
                  else targetSum += obj.LOT;
                }
              });
            }
          });
          entry.target_qty = targetSum;
          entry.targets_by_line = targetsByLine;
        });

        return Array.from(dateMap.values()).sort((a, b) => a.raw_date.localeCompare(b.raw_date));
      };

      return {
        pieceData: createUnitData('actual_pcs_qty', 'PCS'),
        sheetData: createUnitData('actual_sht_qty', 'SHEET'),
        lotData: createUnitData('actual_lot_qty', 'LOT')
      };
    }

    const isFiltered = processFamilyFilter !== "All" || selectedLineGroup !== "All";
    const dataSource = isFiltered ? chartFilteredProductRows : (Array.isArray(lots) ? lots : []);
    if (!Array.isArray(dataSource) || dataSource.length === 0) return undefined;

    const createUnitData = (unitKey: 'actual_pcs_qty' | 'actual_sht_qty' | 'actual_lot_qty', targetType: 'PCS' | 'SHEET' | 'LOT') => {
      const dateMap = new Map<string, any>();

      // Populate ALL dates in the selected date range so By Process shows all days in period
      const allDates = getDatesInRange(startDate, endDate);
      allDates.forEach(dStr => {
        const info = getGranularityDateInfo(dStr, granularity);
        const key = info.key;
        if (!dateMap.has(key)) {
          dateMap.set(key, {
            raw_date: key,
            date_label: info.label,
            short_label: info.shortLabel,
            tooltip_title: info.tooltipTitle,
            granularity,
            total: 0,
            target_qty: 0
          });
        }
      });

      dataSource.forEach(item => {
        const d = item.output_date;
        const p = item.process_name;
        if (!d || !p) return;
        const val = Number(item[unitKey] || 0);
        const info = getGranularityDateInfo(d, granularity);
        const key = info.key;

        if (!dateMap.has(key)) {
          dateMap.set(key, {
            raw_date: key,
            date_label: info.label,
            short_label: info.shortLabel,
            tooltip_title: info.tooltipTitle,
            granularity,
            total: 0,
            target_qty: 0
          });
        }
        const existing = dateMap.get(key);
        existing[p] = (existing[p] || 0) + val;
        existing.total += val;
      });



      return Array.from(dateMap.values()).sort((a, b) => a.raw_date.localeCompare(b.raw_date));
    };

    return {
      pieceData: createUnitData('actual_pcs_qty', 'PCS'),
      sheetData: createUnitData('actual_sht_qty', 'SHEET'),
      lotData: createUnitData('actual_lot_qty', 'LOT')
    };
  }, [lots, chartFilteredProductRows, processFamilyFilter, selectedLineGroup, granularity, targetMapByDate, viewMode, lineGroups, startDate, endDate, selectedFactory]);

  // Fetch MC Line Data when a process is selected
  useEffect(() => {
    if (!selectedProcess) {
      setMcLineData([]);
      return;
    }

    if (processFamilyFilter !== "All") {
      const lineMap: Record<string, { mc_line: string; output_value: number; sum_pcs: number; sum_sht: number; sum_lot: number }> = {};

      chartFilteredProductRows
        .filter(row => row.process_name === selectedProcess)
        .forEach(row => {
          const line = row.mc_line || "Unknown";
          if (!lineMap[line]) {
            lineMap[line] = {
              mc_line: line,
              output_value: 0,
              sum_pcs: 0,
              sum_sht: 0,
              sum_lot: 0
            };
          }

          lineMap[line].sum_pcs += Number(row.actual_pcs_qty || 0);
          lineMap[line].sum_sht += Number(row.actual_sht_qty || 0);
          lineMap[line].sum_lot += Number(row.actual_lot_qty || 0);
        });

      const formatted = Object.values(lineMap).map(item => ({
        ...item,
        output_value: unitMode === "Piece" ? item.sum_pcs : unitMode === "Sheet" ? item.sum_sht : item.sum_lot
      }));

      setMcLineData(formatted);
      setIsMcLineLoading(false);
      return;
    }

    const fetchMcLineData = async () => {
      setIsMcLineLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedChartDate) {
          params.append("date", selectedChartDate);
        } else if (startDate && endDate) {
          params.append("startDate", startDate);
          params.append("endDate", endDate);
        }
        params.append("process", selectedProcess);

        const res = await fetch(`${getApiBaseUrl()}/outputbyprocess/dashboard-mcline?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch MC Line data");
        const data = await res.json();

        const formatted = data.map((item: any) => {
          const val = unitMode === "Piece" ? Number(item.actual_pcs_qty || 0) : unitMode === "Sheet" ? Number(item.actual_sht_qty || 0) : Number(item.actual_lot_qty || 0);
          return {
            mc_line: item.mc_line || "Unknown",
            output_value: val,
            sum_pcs: Number(item.actual_pcs_qty || 0),
            sum_sht: Number(item.actual_sht_qty || 0),
            sum_lot: Number(item.actual_lot_qty || 0)
          };
        });

        setMcLineData(formatted);
      } catch (err) {
        console.error("Failed to fetch MC Line data", err);
      } finally {
        setIsMcLineLoading(false);
      }
    };

    fetchMcLineData();
  }, [selectedProcess, startDate, endDate, selectedChartDate, unitMode, processFamilyFilter, chartFilteredProductRows]);

  const mcLineTotal = useMemo(() => mcLineData.reduce((sum, item) => sum + item.output_value, 0), [mcLineData]);

  const sortedMcLineData = useMemo(() => {
    const arr = [...mcLineData];
    arr.sort((a, b) => {
      if (sortField === "sequence") {
        return sortDirection === "asc" ? a.mc_line.localeCompare(b.mc_line) : b.mc_line.localeCompare(a.mc_line);
      }
      return sortDirection === "asc" ? a.output_value - b.output_value : b.output_value - a.output_value;
    });
    return arr;
  }, [mcLineData, sortField, sortDirection]);

  // Handle Sort
  const handleSort = (field: "sequence" | "output_value") => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "output_value" ? "desc" : "asc");
    }
  };

  // Render sorting arrows
  const renderSortIndicator = (field: "sequence" | "output_value") => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="w-3.5 h-3.5 inline-block ml-1" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 inline-block ml-1" />
    );
  };

  // Sorted list of processes or lines
  const sortedSummaryData = useMemo(() => {
    if (viewMode === "line") {
      const listCopy = lineSummaryData.map(l => ({
        process_name: l.line_name,
        sum_lot: l.sum_lot,
        sum_sht: l.sum_sht,
        sum_pcs: l.sum_pcs,
        output_value: l.output_value
      }));
      listCopy.sort((a, b) => {
        let comparison = 0;
        if (sortField === "sequence") {
          comparison = a.process_name.localeCompare(b.process_name);
        } else {
          comparison = (a.output_value || 0) - (b.output_value || 0);
        }
        return sortDirection === "asc" ? comparison : -comparison;
      });
      return listCopy;
    }
    const listCopy = [...summaryData];
    listCopy.sort((a, b) => {
      let comparison = 0;
      if (sortField === "sequence") {
        comparison = getProcessIndex(a.process_name) - getProcessIndex(b.process_name);
      } else {
        comparison = (a.output_value || 0) - (b.output_value || 0);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return listCopy;
  }, [viewMode, lineSummaryData, summaryData, sortField, sortDirection]);

  const exportProcessOptions = useMemo(() => {
    const names = new Set<string>();
    PROCESS_SEQUENCE.forEach(name => names.add(name));
    Object.keys(processColors).forEach(name => {
      if (name) names.add(name);
    });
    summaryData.forEach(item => {
      if (item.process_name) names.add(item.process_name);
    });
    chartDataAndProcs.activeProcesses.forEach(name => {
      if (name) names.add(name);
    });
    if (selectedProcess) names.add(selectedProcess);
    return Array.from(names).sort((a, b) => {
      const bySequence = getProcessIndex(a) - getProcessIndex(b);
      return bySequence !== 0 ? bySequence : a.localeCompare(b);
    });
  }, [processColors, summaryData, chartDataAndProcs.activeProcesses, selectedProcess]);

  return (
    <>
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Export Output By Process"
        availableProcesses={exportProcessOptions}
        defaultStartDate={selectedChartDate || startDate}
        defaultEndDate={selectedChartDate || endDate}
        defaultProcesses={activeSummaryProcessFilter}
        onConfirmExport={handleConfirmExport}
        isLoading={isExporting}
        errorMessage={exportError}
      />

      <div className="w-full h-full p-4 overflow-y-auto overflow-x-hidden bg-base-200 flex flex-col gap-4">
      {/* Header & Controls */}
      <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 shrink-0 relative z-20">
        <div className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-base-content">Output By Process</h2>
            <p className="text-sm text-base-content/60">Summary of actual output quantities grouped by process.</p>
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 shadow-sm text-xs font-bold text-primary tracking-wide">
                <CalendarDays size={14} className="opacity-80" />
                {formatDate(startDate)}
                <span className="text-primary/50 mx-1 font-medium">to</span>
                {formatDate(endDate)}
              </span>
              {selectedLineGroup !== "All" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 shadow-sm text-xs font-bold text-indigo-600 tracking-wide">
                  <Layers size={14} className="opacity-80" />
                  Group: {selectedLineGroup}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="btn btn-sm btn-outline shadow-sm"
            >
              <RefreshCcw size={14} className={isRefreshing || isLoading ? "animate-spin" : ""} />
              Refresh
            </button>

            <div className="flex items-center bg-base-100 border border-base-300 rounded-lg shadow-sm h-8">
              <div
                className="relative flex items-center h-full px-3 cursor-pointer hover:bg-base-200 rounded-l-lg transition-colors border-r border-base-300/50"
                onClick={() => {
                  try { startDateRef.current?.showPicker(); } catch (e) { }
                }}
              >
                <span className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mr-2">From Date</span>
                <span className="text-sm select-none mr-6">{formatDate(tempStartDate)}</span>
                <CalendarDays size={14} className="opacity-50 absolute right-3 pointer-events-none text-base-content/70" />
                <input
                  ref={startDateRef}
                  type="date"
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.target.value)}
                  min="2026-01-01"
                  max={tempEndDate > "2026-12-31" ? "2026-12-31" : tempEndDate}
                  onClick={(e) => {
                    e.stopPropagation();
                    try { e.currentTarget.showPicker(); } catch (err) { }
                  }}
                />
              </div>

              <div
                className="relative flex items-center h-full px-3 cursor-pointer hover:bg-base-200 rounded-r-lg transition-colors"
                onClick={() => {
                  try { endDateRef.current?.showPicker(); } catch (e) { }
                }}
              >
                <span className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mr-2">To Date</span>
                <span className="text-sm select-none mr-6">{formatDate(tempEndDate)}</span>
                <CalendarDays size={14} className="opacity-50 absolute right-3 pointer-events-none text-base-content/70" />
                <input
                  ref={endDateRef}
                  type="date"
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.target.value)}
                  min={tempStartDate < "2026-01-01" ? "2026-01-01" : tempStartDate}
                  max="2026-12-31"
                  onClick={(e) => {
                    e.stopPropagation();
                    try { e.currentTarget.showPicker(); } catch (err) { }
                  }}
                />
              </div>
            </div>

            <button
              onClick={handleApplyFilters}
              disabled={isLoading}
              className="btn btn-sm btn-primary shadow-sm"
            >
              Search
            </button>

            <button
              onClick={handleExport}
              disabled={isLoading}
              className="btn btn-sm btn-outline btn-success shadow-sm"
            >
              <Download size={14} />
              Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* Formal KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        {/* Card 1: Acc Target / Total Output */}
        <div className={`relative overflow-hidden rounded-xl p-5 text-white transition-all duration-300 group hover:shadow-xl hover:-translate-y-1 ${
          viewMode === "line"
            ? "bg-gradient-to-br from-rose-600 via-red-700 to-rose-900 shadow-md shadow-rose-900/20"
            : "bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 shadow-md shadow-slate-900/10"
        }`}>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl group-hover:scale-125 transition-transform duration-500"></div>
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-xs font-semibold uppercase tracking-wider ${viewMode === "line" ? "text-rose-200" : "text-slate-200"}`}>
                  {viewMode === "line" ? "Acc Target" : "Total Output"}
                </span>
                {viewMode === "line" && (
                  <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-white/15 text-rose-100/90 tracking-tight">
                    as of {formatDate(lineStats.cutoffDate)}
                  </span>
                )}
              </div>
              <span className="text-3xl font-extrabold tracking-tight mt-1">
                {viewMode === "line" ? lineStats.accTarget.toLocaleString() : stats.total.toLocaleString()}
              </span>
            </div>
            <div className="rounded-lg bg-white/15 p-2.5 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
              {viewMode === "line" ? (
                <Target className="w-5 h-5 text-white" />
              ) : (
                <Layers className="w-5 h-5 text-white" />
              )}
            </div>
          </div>
          <div className={`mt-4 flex items-center justify-between text-xs ${viewMode === "line" ? "text-rose-100" : "text-slate-300"}`}>
            {viewMode === "line" ? (
              <>
                <span className="font-medium bg-white/10 px-2 py-0.5 rounded">
                  Unit: {unitMode}
                </span>
                <span>
                  Plan Target
                </span>
              </>
            ) : (
              <>
                <span className="font-medium bg-white/10 px-2 py-0.5 rounded">Unit: {unitMode}</span>
                <span>{summaryFilterLabel}</span>
              </>
            )}
          </div>
        </div>

        {/* Card 2: Acc Output / Active Processes */}
        <div className={`relative overflow-hidden rounded-xl p-5 text-white transition-all duration-300 group hover:shadow-xl hover:-translate-y-1 ${
          viewMode === "line"
            ? "bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 shadow-md shadow-emerald-900/20"
            : "bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 shadow-md shadow-teal-700/10"
        }`}>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl group-hover:scale-125 transition-transform duration-500"></div>
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-xs font-semibold uppercase tracking-wider ${viewMode === "line" ? "text-emerald-200" : "text-teal-150"}`}>
                  {viewMode === "line" ? "Acc Output" : "Active Processes"}
                </span>
                {viewMode === "line" && (
                  <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-white/15 text-emerald-100/90 tracking-tight">
                    as of {formatDate(lineStats.cutoffDate)}
                  </span>
                )}
              </div>
              <span className="text-3xl font-extrabold tracking-tight mt-1">
                {viewMode === "line" ? (
                  lineStats.total.toLocaleString()
                ) : (
                  <>
                    {stats.activeCount} <span className="text-lg font-medium text-teal-200">/ {baseSummaryData.length}</span>
                  </>
                )}
              </span>
            </div>
            <div className="rounded-lg bg-white/15 p-2.5 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
              {viewMode === "line" ? (
                <TrendingUp className="w-5 h-5 text-white" />
              ) : (
                <Cpu className="w-5 h-5 text-white" />
              )}
            </div>
          </div>
          <div className={`mt-4 flex items-center justify-between text-xs ${viewMode === "line" ? "text-emerald-100" : "text-teal-200"}`}>
            {viewMode === "line" ? (
              <>
                <span className="font-medium bg-white/10 px-2 py-0.5 rounded">
                  Unit: {unitMode}
                </span>
                <span>{lineStats.filterTitle}</span>
              </>
            ) : (
              <>
                <span className="font-medium bg-white/10 px-2 py-0.5 rounded">
                  Active: {baseSummaryData.length > 0 ? ((stats.activeCount / baseSummaryData.length) * 100).toFixed(0) : 0}%
                </span>
                <span>{isSummaryFiltered ? "Within current filter" : "Currently running output"}</span>
              </>
            )}
          </div>
        </div>

        {/* Card 3: Active Products / Balance Card */}
        <div className={`relative overflow-hidden rounded-xl p-5 text-white transition-all duration-300 group hover:shadow-xl hover:-translate-y-1 ${
          viewMode === "line"
            ? lineStats.diffTarget < 0
              ? "bg-gradient-to-br from-amber-600 via-orange-700 to-amber-950 shadow-md shadow-amber-900/20"
              : "bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-950 shadow-md shadow-emerald-900/20"
            : "bg-gradient-to-br from-blue-600 via-blue-700 to-sky-800 shadow-md shadow-blue-700/10"
        }`}>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl group-hover:scale-125 transition-transform duration-500"></div>
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-xs font-semibold uppercase tracking-wider ${
                  viewMode === "line"
                    ? lineStats.diffTarget < 0 ? "text-amber-200" : "text-emerald-200"
                    : "text-blue-150"
                }`}>
                  {viewMode === "line" ? "Balance" : "Active Products"}
                </span>
                {viewMode === "line" && (
                  <span className={`text-[10px] font-normal px-1.5 py-0.2 rounded bg-white/15 tracking-tight ${
                    lineStats.diffTarget < 0 ? "text-amber-100/90" : "text-emerald-100/90"
                  }`}>
                    as of {formatDate(lineStats.cutoffDate)}
                  </span>
                )}
              </div>
              <span className="text-3xl font-extrabold tracking-tight mt-1">
                {viewMode === "line"
                  ? `${lineStats.diffTarget > 0 ? "+" : ""}${lineStats.diffTarget.toLocaleString()}`
                  : stats.activeProducts.toLocaleString()}
              </span>
            </div>
            <div className="rounded-lg bg-white/15 p-2.5 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
              {viewMode === "line" ? (
                <Scale className="w-5 h-5 text-white" />
              ) : (
                <Package className="w-5 h-5 text-white" />
              )}
            </div>
          </div>
          <div className={`mt-4 flex items-center justify-between text-xs ${
            viewMode === "line"
              ? lineStats.diffTarget < 0 ? "text-amber-100" : "text-emerald-100"
              : "text-blue-200"
          }`}>
            {viewMode === "line" ? (
              <>
                <span className="font-medium bg-white/10 px-2 py-0.5 rounded">
                  {lineStats.diffTarget < 0 ? "Under Target" : lineStats.diffTarget > 0 ? "Over Target" : "On Target"}
                </span>
                <span>
                  {lineStats.diffTarget < 0
                    ? `Shortfall: ${Math.abs(lineStats.diffTarget).toLocaleString()} ${unitMode}`
                    : lineStats.diffTarget > 0
                    ? `Surplus: +${lineStats.diffTarget.toLocaleString()} ${unitMode}`
                    : "Balanced"}
                </span>
              </>
            ) : (
              <>
                <span className="font-medium bg-white/10 px-2 py-0.5 rounded">
                  Active Models
                </span>
                <span>
                  {isSummaryFiltered ? "Overall product count" : "Distinct product parts processed"}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Card 4: Top Process / KPR Card */}
        <div className={`relative overflow-hidden rounded-xl p-5 text-white transition-all duration-300 group hover:shadow-xl hover:-translate-y-1 ${
          viewMode === "line"
            ? "bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-950 shadow-md shadow-violet-900/20"
            : "bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 shadow-md shadow-indigo-700/10"
        }`}>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl group-hover:scale-125 transition-transform duration-500"></div>
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-xs font-semibold uppercase tracking-wider ${viewMode === "line" ? "text-purple-200" : "text-indigo-150"}`}>
                  {viewMode === "line" ? "KPR (%)" : "Top Performing Process"}
                </span>
                {viewMode === "line" && (
                  <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-white/15 text-purple-100/90 tracking-tight">
                    as of {formatDate(lineStats.cutoffDate)}
                  </span>
                )}
              </div>
              <span className="text-3xl font-extrabold tracking-tight mt-1">
                {viewMode === "line"
                  ? `${lineStats.achievementRate}%`
                  : (stats.topProcess ? stats.topProcess.process_name : "N/A")}
              </span>
            </div>
            <div className="rounded-lg bg-white/15 p-2.5 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
              {viewMode === "line" ? (
                <Gauge className="w-5 h-5 text-white" />
              ) : (
                <Award className="w-5 h-5 text-white" />
              )}
            </div>
          </div>
          <div className={`mt-4 flex items-center justify-between text-xs ${viewMode === "line" ? "text-purple-200" : "text-indigo-200"}`}>
            {viewMode === "line" ? (
              <>
                <span className="font-medium bg-white/10 px-2 py-0.5 rounded">
                  Rate
                </span>
                <span>
                  Output vs Target
                </span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium bg-white/10 px-2 py-0.5 rounded">
                    {(stats.topProcess?.output_value || 0).toLocaleString()} {unitMode}
                  </span>
                </div>
                <span>
                  {stats.topProcess && stats.total > 0
                    ? `${((stats.topProcess.output_value || 0) / stats.total * 100).toFixed(1)}% share`
                    : "0%"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Chart Section */}
      <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-4 shrink-0 flex flex-col min-h-[450px]">

        {/* Dynamic header for chart section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
          <h3 className="text-base font-semibold text-base-content/80 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="flex items-center gap-1.5 flex-wrap">
              {selectedProcess ? "MC Line Output" : selectedChartDate ? (viewMode === "line" ? "Line Output" : "Process Output") : `${granularity === 'weekly' ? 'Weekly' : granularity === 'monthly' ? 'Monthly' : 'Daily'} Data Summary (${viewMode === 'line' ? 'By Line' : 'By Process'})`}
              {selectedChartDate && !selectedProcess && (
                <span className="text-primary font-bold ml-1">— {selectedChartDate}</span>
              )}
              {selectedProcess && (
                <span className="text-primary font-bold ml-1">— {selectedProcess}</span>
              )}
              {processFamilyFilter !== "All" && (
                <span className="text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
                  {processFamilyFilter}
                </span>
              )}
            </span>
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher: By Process vs By Line */}
            <div className="join shadow-sm border border-base-300 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setViewMode("process");
                  setSelectedChartDate(null);
                  setSelectedProcess("");
                  setDailyProcessFilter([]);
                }}
                className={`join-item btn btn-xs font-bold ${viewMode === "process" ? "btn-primary" : "btn-ghost bg-base-100 hover:bg-base-200"}`}
              >
                By Process
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode("line");
                  setSelectedChartDate(null);
                  setSelectedProcess("");
                  setDailyLineFilter([]);
                }}
                className={`join-item btn btn-xs font-bold ${viewMode === "line" ? "btn-primary" : "btn-ghost bg-base-100 hover:bg-base-200"}`}
              >
                By Line
              </button>
            </div>

            {/* Granularity Switcher Button Group */}
            <div className="join shadow-sm border border-base-300 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setGranularity("daily")}
                className={`join-item btn btn-xs font-bold ${granularity === "daily" ? "btn-primary" : "btn-ghost bg-base-100 hover:bg-base-200"}`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setGranularity("weekly")}
                className={`join-item btn btn-xs font-bold ${granularity === "weekly" ? "btn-primary" : "btn-ghost bg-base-100 hover:bg-base-200"}`}
              >
                Weekly
              </button>
            </div>

            {selectedChartDate && !selectedProcess && (
              <div className="join shadow-sm">
                {(["All", "FPC", "SMT"] as ProcessFamilyFilter[]).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setProcessFamilyFilter(type)}
                    className={`join-item btn btn-xs ${processFamilyFilter === type ? "btn-primary" : "btn-outline"}`}
                    title={type === "SMT" ? 'SMT: process starts with "M", fallback product code index 3 is "Z"' : type === "FPC" ? 'FPC: process starts with "F", fallback product code index 3 is not "Z"' : "All process types"}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}

            {selectedChartDate && (
              <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs font-semibold">
                <CalendarDays className="w-3.5 h-3.5" />
                <span>{selectedChartDate}</span>
                <button
                  className="ml-1 hover:text-primary-focus transition-colors"
                  onClick={() => {
                    setSelectedChartDate(null);
                    setSelectedProcess("");
                    setProcessFamilyFilter("All");
                  }}
                  title="Clear date filter"
                >
                  <div className="bg-primary/20 rounded-full p-0.5">
                    <span className="opacity-70 font-bold hover:opacity-100 flex items-center justify-center w-3 h-3 text-[10px]">✕</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {(isLoading && !isRefreshing) ? (
          <ChartSkeleton />
        ) : viewMode === "line" ? (
          <LineDateChart
            data={chartDataAndProcs.dailyChartData}
            unit={unitMode}
            setUnitMode={setUnitMode}
            multiUnitData={multiUnitData}
            activeLines={chartDataAndProcs.activeProcesses}
            selectedDate={selectedChartDate}
            selectedFactory={selectedFactory}
            onFactoryChange={(f) => {
              setSelectedFactory(f);
              if (f === "SMT") {
                setUnitMode("Piece");
              }
              setSelectedChartDate(null);
              setSelectedProcess("");
              setDailyLineFilter([]);
            }}
            onLineFilterChange={setDailyLineFilter}
            onBarClick={(rawDate, _lineName) => {
              setSelectedChartDate(prev => (prev === rawDate ? null : rawDate));
              setProcessFamilyFilter("All");
            }}
          />
        ) : ((Array.isArray(lots) && lots.length > 0) || chartFilteredProductRows.length > 0 || summaryData.length > 0) ? (
          startDate !== endDate && !selectedChartDate ? (
            <ProcessDateChart
              data={chartDataAndProcs.dailyChartData}
              unit={unitMode}
              setUnitMode={setUnitMode}
              multiUnitData={multiUnitData}
              activeProcesses={chartDataAndProcs.activeProcesses}
              selectedDate={selectedChartDate}
              onProcessFilterChange={setDailyProcessFilter}
              onBarClick={(rawDate, _procName) => {
                setSelectedChartDate(prev => (prev === rawDate ? null : rawDate));
                setProcessFamilyFilter("All");
              }}
            />
          ) : (
            <TopOutputChart
              data={summaryData.map(item => ({
                process_name: item.process_name,
                output_qty: item.output_value || 0,
                color: getProcessColor(item.process_name),
                mcline_count: item.mcline_count
              }))}
              unit={unitMode}
              selectedProcess={selectedProcess}
              onProcessSelect={setSelectedProcess}
              backButtonNode={
                (selectedChartDate || selectedProcess) ? (
                  <button
                    onClick={() => {
                      if (selectedProcess) {
                        setSelectedProcess("");
                      } else {
                        setSelectedChartDate(null);
                        setProcessFamilyFilter("All");
                      }
                    }}
                    className="btn btn-sm btn-primary shadow-sm hover:scale-105 transition-transform font-bold"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    {selectedProcess ? "Back to Processes" : (granularity === "weekly" ? "Back to All Weeks" : granularity === "monthly" ? "Back to All Months" : "Back to All Days")}
                  </button>
                ) : undefined
              }
            />
          )
        ) : (
          <div className="w-full min-h-[400px] flex items-center justify-center text-base-content/50">
            No data to display
          </div>
        )}
      </div>

      {/* Table Content - Only shown when a specific date or process is selected */}
      {(selectedChartDate || selectedProcess) && (
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 overflow-hidden flex-1 relative min-h-[350px]">
          <div className="p-4 border-b border-base-300 flex justify-between items-center bg-base-200/20">
            <h3 className="text-base font-bold text-base-content/90 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              {selectedProcess
                ? `MC Line Details - ${selectedProcess}`
                : (viewMode === "line" ? "Line Output Details" : "Process Output Details")}
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-base-content/60 font-medium bg-base-200 px-2 py-1 rounded">
                {selectedProcess
                  ? `Total MC Lines: ${mcLineData.length}`
                  : (viewMode === "line" ? `Total lines: ${sortedSummaryData.length}` : `Total processes: ${summaryData.length}`)}
              </span>
              {selectedProcess && (
                <button
                  onClick={() => {
                    setSelectedProcess("");
                  }}
                  className="btn btn-xs btn-ghost border border-base-300 text-base-content/70 hover:bg-base-300/50"
                >
                  Back to Processes
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto h-[calc(100%-60px)]">
            {isLoading || isMcLineLoading ? (
              <ListSkeleton />
            ) : selectedProcess ? (
              <div className="flex flex-col gap-2 p-2 overflow-y-auto h-full scrollbar-thin">
                {sortedMcLineData.length > 0 ? (
                  sortedMcLineData.map((row) => {
                    const color = getProcessColor(selectedProcess);
                    const units = [
                      { key: "Sheet", label: "SHEET", value: row.sum_sht },
                      { key: "Piece", label: "PIECE", value: row.sum_pcs },
                      { key: "Lot", label: "LOT", value: row.sum_lot }
                    ];
                    const activeUnit = units.find(u => u.key === unitMode) || units[0];
                    const otherUnits = units.filter(u => u.key !== unitMode);

                    return (
                      <div
                        key={row.mc_line}
                        className="flex items-center justify-between p-3 rounded-lg border border-base-200 bg-base-100/50 hover:bg-base-200 hover:border-primary/30 transition-all text-left shadow-sm group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                          <div className="w-2.5 h-8 rounded-full shrink-0" style={{ backgroundColor: color }}></div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-sm text-base-content/90 truncate">{row.mc_line}</span>
                            <span className="text-[10px] text-base-content/50 uppercase font-medium">MC Line</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          {otherUnits.map(u => (
                            <div key={u.key} className="flex flex-col items-center min-w-[3.5rem]">
                              <span className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider">{u.label}</span>
                              <span className="text-xs font-mono font-semibold text-base-content/80">{u.value.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-col items-end shrink-0 w-24 pl-3 border-l border-base-300 ml-4">
                          <span className="text-[9px] uppercase font-bold tracking-wider text-primary/70">{activeUnit.label}</span>
                          <span className="font-mono font-bold text-sm text-primary">
                            {activeUnit.value.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-base-content/50">
                    No machine lines found for {selectedProcess}
                  </div>
                )}
              </div>
            ) : (
              <>
                <table className="table w-full border-collapse">
                  <thead className="bg-base-200/60 text-base-content/70 uppercase text-xs sticky top-0 z-10 border-b border-base-300">
                    <tr>
                      <th
                        className="px-6 py-4 font-bold text-left w-[40%] cursor-pointer hover:bg-base-300/30 select-none transition-colors"
                        onClick={() => handleSort("sequence")}
                      >
                        <div className="flex items-center">
                          {viewMode === "line" ? "Line Name" : "Process Name"} {renderSortIndicator("sequence")}
                        </div>
                      </th>
                      <th
                        className={`px-4 py-4 font-bold text-right w-[20%] ${unitMode === "Lot" ? "text-primary cursor-pointer hover:bg-base-300/30" : "text-base-content/50"} select-none text-[10px] tracking-widest transition-colors`}
                        onClick={() => unitMode === "Lot" && handleSort("output_value")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          LOT {unitMode === "Lot" && renderSortIndicator("output_value")}
                        </div>
                      </th>
                      <th
                        className={`px-4 py-4 font-bold text-right w-[20%] ${unitMode === "Sheet" ? "text-primary cursor-pointer hover:bg-base-300/30" : "text-base-content/50"} select-none text-[10px] tracking-widest transition-colors`}
                        onClick={() => unitMode === "Sheet" && handleSort("output_value")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          SHEET {unitMode === "Sheet" && renderSortIndicator("output_value")}
                        </div>
                      </th>
                      <th
                        className={`px-6 py-4 font-bold text-right w-[20%] ${unitMode === "Piece" ? "text-primary cursor-pointer hover:bg-base-300/30" : "text-base-content/50"} select-none text-[10px] tracking-widest transition-colors`}
                        onClick={() => unitMode === "Piece" && handleSort("output_value")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          PIECE {unitMode === "Piece" && renderSortIndicator("output_value")}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(isLoading && !isRefreshing) ? (
                      <tr>
                        <td colSpan={4} className="p-0 border-0">
                          <ListSkeleton />
                        </td>
                      </tr>
                    ) : sortedSummaryData.length > 0 ? (
                      sortedSummaryData.slice((detailsCurrentPage - 1) * detailsItemsPerPage, detailsCurrentPage * detailsItemsPerPage).map((row) => {
                        const color = getProcessColor(row.process_name);

                        return (
                          <tr key={row.process_name} className="hover:bg-base-200/50 transition-colors border-b border-base-300">
                            <td className="px-6 py-3.5 font-medium text-base-content/90">
                              <div className="flex items-center gap-3">
                                <span
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: color }}
                                ></span>
                                <span className="font-semibold text-sm">{row.process_name}</span>
                              </div>
                            </td>
                            <td className={`px-4 py-3.5 text-right font-mono text-sm ${unitMode === "Lot" ? "font-bold text-primary" : "text-base-content/70"}`}>
                              {row.sum_lot.toLocaleString()}
                            </td>
                            <td className={`px-4 py-3.5 text-right font-mono text-sm ${unitMode === "Sheet" ? "font-bold text-primary" : "text-base-content/70"}`}>
                              {row.sum_sht.toLocaleString()}
                            </td>
                            <td className={`px-6 py-3.5 text-right font-mono text-sm ${unitMode === "Piece" ? "font-bold text-primary" : "text-base-content/70"}`}>
                              {row.sum_pcs.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-16 text-center text-base-content/50">
                          {!isLoading && "No output data available for the selected filters."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {sortedSummaryData.length > detailsItemsPerPage && (
                  <div className="flex justify-between items-center p-4 border-t border-base-300 bg-base-100">
                    <div className="text-xs text-base-content/60">
                      Showing {(detailsCurrentPage - 1) * detailsItemsPerPage + 1} to {Math.min(detailsCurrentPage * detailsItemsPerPage, sortedSummaryData.length)} of {sortedSummaryData.length} {viewMode === "line" ? "lines" : "processes"}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDetailsCurrentPage(p => Math.max(1, p - 1))}
                        disabled={detailsCurrentPage === 1}
                        className="btn btn-sm btn-ghost"
                      >
                        Previous
                      </button>
                      <div className="text-xs font-semibold px-2">
                        {detailsCurrentPage} / {Math.ceil(sortedSummaryData.length / detailsItemsPerPage)}
                      </div>
                      <button
                        onClick={() => setDetailsCurrentPage(p => Math.min(Math.ceil(sortedSummaryData.length / detailsItemsPerPage), p + 1))}
                        disabled={detailsCurrentPage >= Math.ceil(sortedSummaryData.length / detailsItemsPerPage)}
                        className="btn btn-sm btn-ghost"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default Page;
