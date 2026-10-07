import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Search,
  FileSpreadsheet,
  Layers,
  Calendar,
  Clock,
  Package,
  Copy,
  Check,
  ArrowUpDown,
  AlertCircle,
  Flame,
  CheckCircle2,
  TrendingUp,
  Tag,
  Boxes,
} from "lucide-react";

export interface WipLotItem {
  factory?: string;
  lot_prd_name?: string;
  proc_disp?: string;
  lot_status?: string;
  lot_no?: string;
  effective_date?: string;
  lot_qty?: number;
  wip_scan_in?: string;
  lead_time_wip_days?: number;
  lead_time_group?: string;
  group?: string;
  semi_group?: string;
  group_name?: string;
}

export interface LeadTimeTheme {
  name: string;
  color: string;
  gradient: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  kpiBorder: string;
  kpiText: string;
}

export const getLeadTimeTheme = (
  groupName?: string | null,
  days?: number,
): LeadTimeTheme => {
  const cleanName = (groupName || "")
    .replace(/^\(\d+\)\s*:\s*/, "")
    .trim()
    .toLowerCase();

  // (6) More 365 Days -> Red / Rose (#e11d48 / #be123c)
  if (
    cleanName.includes("365") ||
    cleanName.includes("more") ||
    (days !== undefined && !isNaN(days) && days >= 365)
  ) {
    return {
      name: "More 365 Days",
      color: "#e11d48",
      gradient:
        "linear-gradient(135deg, #f43f5e 0%, #e11d48 45%, #be123c 100%)",
      badgeBg: "bg-rose-50",
      badgeText: "text-rose-700 font-black",
      badgeBorder: "border-rose-200",
      dotColor: "bg-rose-500",
      kpiBorder: "border-rose-200",
      kpiText: "text-rose-600",
    };
  }

  // (5) 100-364 Day -> Orange (#f97316 / #ea580c)
  if (
    cleanName.includes("100-364") ||
    cleanName.includes("100 - 364") ||
    (days !== undefined && !isNaN(days) && days >= 100 && days <= 364)
  ) {
    return {
      name: "100-364 Day",
      color: "#f97316",
      gradient:
        "linear-gradient(135deg, #fb923c 0%, #f97316 35%, #ea580c 70%, #c2410c 100%)",
      badgeBg: "bg-orange-50",
      badgeText: "text-orange-700 font-bold",
      badgeBorder: "border-orange-200",
      dotColor: "bg-orange-500",
      kpiBorder: "border-orange-200",
      kpiText: "text-orange-600",
    };
  }

  // (4) 30-99 Day -> Amber / Yellow (#f59e0b / #d97706)
  if (
    cleanName.includes("30-99") ||
    cleanName.includes("30 - 99") ||
    (days !== undefined && !isNaN(days) && days >= 30 && days <= 99)
  ) {
    return {
      name: "30-99 Day",
      color: "#f59e0b",
      gradient:
        "linear-gradient(135deg, #f59e0b 0%, #d97706 45%, #b45309 100%)",
      badgeBg: "bg-amber-50",
      badgeText: "text-amber-700 font-bold",
      badgeBorder: "border-amber-200",
      dotColor: "bg-amber-500",
      kpiBorder: "border-amber-200",
      kpiText: "text-amber-600",
    };
  }

  // (3) 10-29 Day -> Green (#10b981 / #059669)
  if (
    cleanName.includes("10-29") ||
    cleanName.includes("10 - 29") ||
    (days !== undefined && !isNaN(days) && days >= 10 && days <= 29)
  ) {
    return {
      name: "10-29 Day",
      color: "#10b981",
      gradient:
        "linear-gradient(135deg, #10b981 0%, #059669 45%, #047857 100%)",
      badgeBg: "bg-emerald-50",
      badgeText: "text-emerald-700 font-bold",
      badgeBorder: "border-emerald-200",
      dotColor: "bg-emerald-500",
      kpiBorder: "border-emerald-200",
      kpiText: "text-emerald-600",
    };
  }

  // (2) 4-9 Day -> Blue (#307cf0 / #2563eb)
  if (
    cleanName.includes("4-9") ||
    cleanName.includes("4 - 9") ||
    (days !== undefined && !isNaN(days) && days >= 4 && days <= 9)
  ) {
    return {
      name: "4-9 Day",
      color: "#307cf0",
      gradient:
        "linear-gradient(135deg, #3b82f6 0%, #2563eb 45%, #1d4ed8 100%)",
      badgeBg: "bg-blue-50",
      badgeText: "text-blue-700 font-bold",
      badgeBorder: "border-blue-200",
      dotColor: "bg-blue-500",
      kpiBorder: "border-blue-200",
      kpiText: "text-blue-600",
    };
  }

  // (1) 0-3 Day -> Purple (#6d5ecc / #7c3aed)
  if (
    cleanName.startsWith("0-3") ||
    cleanName.startsWith("0 - 3") ||
    cleanName === "0-3" ||
    (days !== undefined && !isNaN(days) && days >= 0 && days <= 3)
  ) {
    return {
      name: "0-3 Day",
      color: "#6d5ecc",
      gradient:
        "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 45%, #5b21b6 100%)",
      badgeBg: "bg-purple-50",
      badgeText: "text-purple-700 font-bold",
      badgeBorder: "border-purple-200",
      dotColor: "bg-purple-500",
      kpiBorder: "border-purple-200",
      kpiText: "text-purple-600",
    };
  }

  // Default Theme: Deep Royal Navy/Indigo for All Lead Times (หน้ารวมทุกกลุ่มเวลา / Process Drilldown)
  return {
    name: "All Lead Times",
    color: "#4f46e5",
    gradient:
      "linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, #312e81 100%)",
    badgeBg: "bg-indigo-50",
    badgeText: "text-indigo-700 font-bold",
    badgeBorder: "border-indigo-200",
    dotColor: "bg-indigo-500",
    kpiBorder: "border-indigo-200",
    kpiText: "text-indigo-600",
  };
};

interface WipDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string | null;
  leadTimeGroupName: string | null;
  leadTimeColor?: string;
  processName: string | null;
  items: WipLotItem[];
}

export const WipDetailModal: React.FC<WipDetailModalProps> = ({
  isOpen,
  onClose,
  date,
  leadTimeGroupName,
  leadTimeColor = "#f97316",
  processName,
  items,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductFilter, setSelectedProductFilter] = useState("all");
  const [activeProcessTab, setActiveProcessTab] = useState<string>("all");
  const [copiedLot, setCopiedLot] = useState<string | null>(null);
  const [sortField, setSortField] = useState<
    "lead_time_wip_days" | "lot_qty" | "lot_prd_name" | "proc_disp"
  >("lead_time_wip_days");
  const [sortAsc, setSortAsc] = useState(false);

  // Sync initial processName to activeProcessTab when modal opens
  useEffect(() => {
    if (processName) {
      setActiveProcessTab(processName);
    } else {
      setActiveProcessTab("all");
    }
  }, [processName, isOpen]);

  // คำนวณ Theme สีของ Modal ตาม Lead Time Group ที่เลือก
  const activeTheme = useMemo(() => {
    return getLeadTimeTheme(leadTimeGroupName);
  }, [leadTimeGroupName]);

  // ล็อกไม่ให้หน้าเว็บหลักด้านหลังเลื่อนขณะ Modal เปิดอยู่
  useEffect(() => {
    if (!isOpen) return;

    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const mainElements = document.querySelectorAll("main");
    const originalMainOverflows: string[] = [];
    mainElements.forEach((el, idx) => {
      originalMainOverflows[idx] = el.style.overflow;
      el.style.overflow = "hidden";
    });

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      mainElements.forEach((el, idx) => {
        el.style.overflow = originalMainOverflows[idx] || "";
      });
    };
  }, [isOpen]);

  // Process breakdown counts for quick filter tabs
  const processTabs = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((item) => {
      const proc = item.proc_disp || "Other";
      map.set(proc, (map.get(proc) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [items]);

  const productOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.lot_prd_name) set.add(item.lot_prd_name);
    });
    return Array.from(set).sort();
  }, [items]);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items
      .filter((item) => {
        if (
          selectedProductFilter !== "all" &&
          item.lot_prd_name !== selectedProductFilter
        ) {
          return false;
        }
        if (activeProcessTab !== "all" && item.proc_disp !== activeProcessTab) {
          return false;
        }
        if (!query) return true;

        const prd = String(item.lot_prd_name || "").toLowerCase();
        const lot = String(item.lot_no || "").toLowerCase();
        const proc = String(item.proc_disp || "").toLowerCase();
        const status = String(item.lot_status || "").toLowerCase();
        const days = String(item.lead_time_wip_days ?? "");
        const group = String(item.lead_time_group || "").toLowerCase();

        return (
          prd.includes(query) ||
          lot.includes(query) ||
          proc.includes(query) ||
          status.includes(query) ||
          days.includes(query) ||
          group.includes(query)
        );
      })
      .sort((a, b) => {
        let valA: any = a[sortField] ?? 0;
        let valB: any = b[sortField] ?? 0;

        if (typeof valA === "string") {
          const comp = valA.localeCompare(String(valB));
          return sortAsc ? comp : -comp;
        }
        return sortAsc ? valA - valB : valB - valA;
      });
  }, [
    items,
    searchQuery,
    selectedProductFilter,
    activeProcessTab,
    sortField,
    sortAsc,
  ]);

  // Statistics Summary
  const stats = useMemo(() => {
    const totalLots = filteredItems.length;
    const totalQty = filteredItems.reduce(
      (sum, item) => sum + Number(item.lot_qty || 0),
      0,
    );
    const validDays = filteredItems
      .map((item) => Number(item.lead_time_wip_days))
      .filter((d) => !isNaN(d) && d > 0);

    const avgDays =
      validDays.length > 0
        ? Math.round(validDays.reduce((a, b) => a + b, 0) / validDays.length)
        : 0;
    const maxDays = validDays.length > 0 ? Math.max(...validDays) : 0;
    const minDays = validDays.length > 0 ? Math.min(...validDays) : 0;
    const uniquePrds = new Set(
      filteredItems.map((i) => i.lot_prd_name).filter(Boolean),
    ).size;

    return { totalLots, totalQty, avgDays, maxDays, minDays, uniquePrds };
  }, [filteredItems]);

  const handleCopyLot = (lot: string) => {
    navigator.clipboard.writeText(lot);
    setCopiedLot(lot);
    setTimeout(() => setCopiedLot(null), 1500);
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const { exportStyledExcel } = await import(
        "@/utility/Service/xlxs/exportStyledExcel"
      );

      const dataToExport = filteredItems.map((item, idx) => ({
        "No.": idx + 1,
        "Product Name": item.lot_prd_name || "-",
        "Lot No.": item.lot_no || "-",
        Process: item.proc_disp || "-",
        "Lead Time Group":
          item.lead_time_group?.replace(/^\(\d+\)\s*:\s*/, "").trim() || "-",
        "Aging (Days)": Number(item.lead_time_wip_days || 0),
        "Lot Qty": Number(item.lot_qty || 0),
        "Lot Status": item.lot_status || "-",
        "WIP Scan In": item.wip_scan_in
          ? new Date(item.wip_scan_in).toLocaleString("th-TH")
          : "-",
        "Effective Date": item.effective_date || "-",
        Factory: item.factory || "-",
      }));

      const dateStr = date ? date.replace(/\//g, "-") : "all";
      const procStr = activeProcessTab !== "all" ? `_${activeProcessTab}` : "";
      const groupStr = leadTimeGroupName
        ? `_${leadTimeGroupName.replace(/[^a-zA-Z0-9]/g, "_")}`
        : "";
      const fileName = `WIP_Lots_Detail_${dateStr}${groupStr}${procStr}.xlsx`;

      await exportStyledExcel({
        title: "WIP LOTS DETAIL REPORT",
        metadata: {
          "Selected Date": date || "All",
          "Lead Time Group": leadTimeGroupName || "All",
          "Process Filter":
            activeProcessTab !== "all" ? activeProcessTab : "All",
          "Total Lots": `${filteredItems.length} Lots`,
          "Total Lot Qty": `${stats.totalQty.toLocaleString()} Lots`,
          "Export Date": new Date().toLocaleString("en-GB"),
        },
        data: dataToExport,
        fileName,
        sheetName: "WIP Lots Detail",
        themeColor: "indigo",
        showTotalRow: true,
        totalColumns: ["Lot Qty"],
      });
    } catch (err) {
      console.error("Failed to export modal data:", err);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-3 sm:p-5 md:p-8 overflow-hidden animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-[95vw] xl:max-w-[1480px] 2xl:max-w-[1680px] max-h-[92vh] bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] border border-slate-200/80 overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header - THEMED WITH VIBRANT LEAD TIME COLOR */}
        <div
          className="flex flex-wrap items-center justify-between gap-4 px-7 py-4.5 border-b border-white/20 text-white shrink-0 shadow-sm"
          style={{
            background: activeTheme.gradient,
          }}
        >
          <div className="flex items-center gap-3.5">
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl shadow-md bg-white/20 backdrop-blur-sm border border-white/30 text-white shrink-0">
              <Boxes className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2 drop-shadow-xs">
                  WIP Lot Details
                  <span className="text-xs font-bold text-white uppercase tracking-widest bg-black/20 px-2.5 py-0.5 rounded-full border border-white/25 backdrop-blur-xs">
                    Lot Breakdown
                  </span>
                </h2>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs font-medium text-white/95 flex-wrap">
                {date && (
                  <span className="inline-flex items-center gap-1.5 bg-black/20 text-white px-3 py-0.5 rounded-lg border border-white/20 text-xs backdrop-blur-xs font-bold">
                    <Calendar className="w-3.5 h-3.5 text-white/80" />
                    <span>Date: {date}</span>
                  </span>
                )}
                {leadTimeGroupName ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-lg text-xs font-black border bg-white text-slate-900 shadow-xs"
                    style={{
                      borderColor: "rgba(255,255,255,0.9)",
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full animate-pulse"
                      style={{ backgroundColor: activeTheme.color }}
                    />
                    <span>Lead Time Group: {leadTimeGroupName}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-black/20 text-white px-3 py-0.5 rounded-lg border border-white/20 text-xs backdrop-blur-xs font-bold">
                    <Clock className="w-3.5 h-3.5 text-white/80" />
                    <span>All Lead Time Groups</span>
                  </span>
                )}
                {activeProcessTab !== "all" ? (
                  <span className="inline-flex items-center gap-1.5 bg-black/20 text-white border border-white/20 px-3 py-0.5 rounded-lg text-xs font-bold">
                    <Layers className="w-3.5 h-3.5 text-white/80" />
                    <span>Process: {activeProcessTab}</span>
                  </span>
                ) : processName && processName !== "all" ? (
                  <span className="inline-flex items-center gap-1.5 bg-black/20 text-white border border-white/20 px-3 py-0.5 rounded-lg text-xs font-bold">
                    <Layers className="w-3.5 h-3.5 text-white/80" />
                    <span>Process: {processName}</span>
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black text-slate-900 bg-white hover:bg-slate-50 rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer active:scale-95 border border-white/90"
              title="Export all lots to Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-white hover:text-white bg-white/15 hover:bg-white/25 rounded-xl transition-all cursor-pointer backdrop-blur-xs border border-white/20"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Executive KPI Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 px-7 py-3.5 bg-gradient-to-b from-slate-50/90 to-slate-100/50 border-b border-slate-200/80 shrink-0">
          <div
            className="flex items-center justify-between bg-white p-3.5 rounded-2xl border shadow-xs transition-all hover:shadow-sm"
            style={{
              borderColor: `${activeTheme.color}60`,
              boxShadow: `0 2px 8px -2px ${activeTheme.color}25`,
            }}
          >
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Package
                  className="w-3.5 h-3.5"
                  style={{ color: activeTheme.color }}
                />
                Total Lots
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className="text-xl font-black tracking-tight"
                  style={{ color: activeTheme.color }}
                >
                  {stats.totalLots.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-slate-400">Lots</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-blue-300 transition-colors">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                Total Lot Qty
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black text-blue-600 tracking-tight">
                  {stats.totalQty.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-slate-400">Lots</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-amber-300 transition-colors">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                Avg Aging
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black text-amber-600 tracking-tight">
                  {stats.avgDays}
                </span>
                <span className="text-xs font-bold text-slate-400">Days</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-rose-300 transition-colors">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                Max Aging
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black text-rose-600 tracking-tight">
                  {stats.maxDays}
                </span>
                <span className="text-xs font-bold text-rose-400">Days</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-indigo-300 transition-colors col-span-2 sm:col-span-1">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-purple-500" />
                Product Models
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black text-purple-600 tracking-tight">
                  {stats.uniquePrds}
                </span>
                <span className="text-xs font-bold text-slate-400">Models</span>
              </div>
            </div>
          </div>
        </div>

        {/* Process Filter Tabs & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-7 py-3 border-b border-slate-200/80 bg-white shrink-0">
          {/* Process Interactive Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-400 mr-1">
              Process:
            </span>
            <button
              onClick={() => setActiveProcessTab("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeProcessTab === "all"
                  ? "text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
              }`}
              style={{
                backgroundColor:
                  activeProcessTab === "all" ? activeTheme.color : undefined,
              }}
            >
              All ({items.length})
            </button>
            {processTabs.map((tab) => {
              const isActive = activeProcessTab === tab.name;
              return (
                <button
                  key={tab.name}
                  onClick={() => setActiveProcessTab(tab.name)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? "text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                  }`}
                  style={{
                    backgroundColor: isActive ? activeTheme.color : undefined,
                  }}
                >
                  <span>{tab.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isActive
                        ? "bg-white/25 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Product Dropdown */}
          <div className="flex items-center gap-3">
            <div className="relative min-w-[200px] sm:min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-8 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder-slate-400 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {productOptions.length > 1 && (
              <select
                value={selectedProductFilter}
                onChange={(e) => setSelectedProductFilter(e.target.value)}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">
                  All Products ({productOptions.length})
                </option>
                {productOptions.map((prd) => (
                  <option key={prd} value={prd}>
                    {prd}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Spacious Scrollable Table with Lead Time Group & Aging Color Styling */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white max-h-[58vh]">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-slate-100 rounded-full text-slate-400 mb-3">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">
                No matching WIP lot records found
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Try adjusting your search query or selecting a different process.
              </p>
            </div>
          ) : (
            <table className="w-full text-center border-collapse table-fixed">
              <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-md text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 select-none shadow-xs">
                <tr>
                  <th className="py-3 px-3 w-12 text-center">#</th>
                  <th
                    className="py-3 px-4 w-[24%] cursor-pointer hover:text-slate-800 transition-colors text-center"
                    onClick={() => toggleSort("lot_prd_name")}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Product Name</span>
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </div>
                  </th>
                  <th className="py-3 px-4 w-[18%] text-center">Lot Number</th>
                  <th
                    className="py-3 px-4 w-[13%] cursor-pointer hover:text-slate-800 transition-colors text-center"
                    onClick={() => toggleSort("proc_disp")}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Process</span>
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </div>
                  </th>
                  <th className="py-3 px-4 w-[17%] text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Lead Time Group</span>
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 w-[14%] cursor-pointer hover:text-slate-800 transition-colors text-center"
                    onClick={() => toggleSort("lead_time_wip_days")}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Aging (Days)</span>
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </div>
                  </th>
                  <th className="py-3 px-4 w-[11%] text-center">WIP Scan In</th>
                  <th
                    className="py-3 px-4 w-[13%] cursor-pointer hover:text-slate-800 transition-colors text-center"
                    onClick={() => toggleSort("lot_qty")}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Quantity</span>
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredItems.map((item, index) => {
                  const days = Number(item.lead_time_wip_days || 0);
                  const rowTheme = getLeadTimeTheme(
                    item.lead_time_group,
                    days,
                  );

                  return (
                    <tr
                      key={`${item.lot_no || index}-${index}`}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="py-3 px-3 text-center font-bold text-slate-400 text-xs">
                        {index + 1}
                      </td>
                      <td className="py-3 px-4 text-center font-black text-slate-900 truncate">
                        <span className="inline-block px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-900 font-black text-xs tracking-wide transition-colors">
                          {item.lot_prd_name || "-"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-700 truncate">
                        <div className="inline-flex items-center justify-center gap-2 group/lot">
                          <span className="text-xs bg-slate-50 px-2 py-0.5 rounded border border-slate-200/80">
                            {item.lot_no || "-"}
                          </span>
                          {item.lot_no && (
                            <button
                              onClick={() => handleCopyLot(item.lot_no!)}
                              className="opacity-0 group-hover/lot:opacity-100 p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
                              title="Copy Lot Number"
                            >
                              {copiedLot === item.lot_no ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-xl text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs">
                          {item.proc_disp || "-"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border shadow-2xs ${rowTheme.badgeBg} ${rowTheme.badgeText} ${rowTheme.badgeBorder}`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${rowTheme.dotColor}`}
                          />
                          <span>
                            {item.lead_time_group
                              ? item.lead_time_group
                                  .replace(/^\(\d+\)\s*:\s*/, "")
                                  .trim()
                              : rowTheme.name}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border shadow-2xs ${rowTheme.badgeBg} ${rowTheme.badgeText} ${rowTheme.badgeBorder}`}
                        >
                          <Clock className="w-3 h-3 opacity-80" />
                          <span>
                            {days.toLocaleString()} {days === 1 ? "Day" : "Days"}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600 font-medium text-xs">
                        {item.wip_scan_in
                          ? new Date(item.wip_scan_in).toLocaleDateString(
                              "en-GB",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              },
                            )
                          : "-"}
                      </td>
                      <td className="py-3 px-4 text-center font-black text-slate-900 text-sm">
                        <span className="bg-slate-100 px-3 py-0.5 rounded-lg border border-slate-200">
                          {Number(item.lot_qty || 0).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Bottom Status Footer */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-7 py-3.5 border-t border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-slate-50 text-xs shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              Showing all{" "}
              <strong className="text-slate-900 font-black">
                {filteredItems.length}
              </strong>{" "}
              records (Continuous scroll)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs font-bold text-slate-900 bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-2xs">
              Total Lots:{" "}
              <strong
                className="font-black"
                style={{ color: activeTheme.color }}
              >
                {stats.totalQty.toLocaleString()} Lots
              </strong>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
