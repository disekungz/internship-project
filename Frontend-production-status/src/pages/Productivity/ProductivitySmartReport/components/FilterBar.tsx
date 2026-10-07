import {
  Building2,
  CalendarRange,
  CalendarDays,
  Check,
  ChevronDown,
  FileSpreadsheet,
  PackageCheck,
  RefreshCcw,
  Route,
  Search,
  Shield,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  AlertCircle,
  X,
  UserCheck,
  Calculator,
  Clock,
  UserMinus,
  UserCog,
  ShieldCheck,
  Layers,
  Network,
  User,
  BookOpen,
  HelpCircle,
  Download,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import toast from "react-hot-toast";
import isoWeek from "dayjs/plugin/isoWeek";
dayjs.extend(isoWeek);
import { useNavigate } from "react-router-dom";
import { BASE } from "../../../../routes/config";
import { preloadSmartReportModals } from "./modals/SmartReportModals";
import { getLineGroupDisplayName, LineGroup, LineGroupFilter, OutputUnit, Granularity } from "../types";
import { normalizeMatrixLineGroupName } from "../hooks/useProcessOutputData";
import { fetchCustomLineNames, getApiBaseUrl } from "../../../../utils/apiConfig";
import { getCachedCustomMacroLines } from "../utils/customMacroStore";
import { NotificationBell } from "./NotificationBell";

const formatDate = (date: string) => {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;
  return `${match[3]}/${match[2]}/${match[1]}`;
};

type FilterBarProps = {
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  selectedFactory: string;
  setSelectedFactory: (v: string) => void;
  selectedLineGroup: LineGroupFilter;
  setSelectedLineGroup: (v: LineGroupFilter) => void;
  selectedUnit: OutputUnit;
  setSelectedUnit: (v: OutputUnit) => void;
  facUnit: string;
  setFacUnit: (v: string) => void;
  granularity: Granularity;
  setGranularity: (v: Granularity) => void;
  lineGroups: LineGroup[];
  isLoading: boolean;
  onSearch: () => void;
  onOpenSettings?: () => void;
  onOpenImportExcel?: () => void;
  onOpenManualMatrixModal?: () => void;
  onExportExcel?: () => void;
  isExporting?: boolean;
  isAdmin?: boolean;
  setIsAdmin?: (v: boolean) => void;
  adminRemainingSeconds?: number;
  hiddenTables?: string[];
  setHiddenTables?: (v: string[]) => void;
  onOpenTableVisibilityModal?: () => void;
  onOpenEmployeeScanModal?: () => void;
  onOpenManpowerAuditModal?: () => void;
  onOpenManpowerLoanModal?: () => void;
  onOpenManpowerSnapshotModal?: () => void;
  onOpenCostCenterModal?: () => void;
  onOpenMacroLineModal?: () => void;
  onOpenLineMappingModal?: () => void;
  onOpenToolsGuideModal?: () => void;
  onOpenProductivityOutputModal?: () => void;
  onSyncAttendance?: () => void;
  isSyncingAttendance?: boolean;
  hasAttendanceUpdate?: boolean;
  changedDates?: string[];
  totalDaysChanged?: number;
  latestAttendanceUpdate?: string | null;
};

const selectShellClass =
  "group relative flex h-10 items-center rounded-xl border border-base-300 bg-base-100 shadow-2xs transition-all hover:border-base-content/30 hover:bg-base-100 hover:shadow-xs focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15";
const openSelectShellClass = "!border-primary !ring-2 !ring-primary/15";
const dropdownPanelClass =
  "absolute left-0 top-full z-[100] mt-2 w-full overflow-hidden rounded-xl border border-base-300 bg-base-100 p-2 text-sm shadow-xl";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GRANULARITY_TABS: { id: Granularity; label: string }[] = [
  { id: "yearly", label: "Yearly" },
  { id: "monthly", label: "Monthly" },
  { id: "weekly", label: "Weekly" },
  { id: "daily", label: "Daily" },
];

type FilterSelectProps<T extends string> = {
  label: string;
  icon: React.ReactNode;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
};

const FilterSelect = <T extends string>({
  label,
  icon,
  value,
  onChange,
  options,
  className = "w-[140px] shrink-0",
}: FilterSelectProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(option => option.value === value) ?? options[0];

  return (
    <div className={`relative ${className}`}>
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-base-content/50">
        {label}
      </span>
      <button
        type="button"
        className={`${selectShellClass} ${isOpen ? openSelectShellClass : ""} w-full px-0 text-left`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(open => !open)}
      >
        <span className="flex h-full w-9 items-center justify-center text-base-content/45 transition-colors group-focus-within:text-primary">
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-base-content">
          {selectedOption?.label}
        </span>
        <ChevronDown
          className={`mr-3 h-4 w-4 text-base-content/45 transition-transform ${isOpen ? "rotate-180 text-primary" : ""
            }`}
        />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            className={dropdownPanelClass}
            role="listbox"
          >
            {options.map(option => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left font-semibold transition-colors ${selected
                    ? "bg-primary/5 text-base-content"
                    : "text-base-content hover:bg-primary/5"
                    }`}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${selected ? "bg-primary text-primary-content" : "border border-base-300"
                      }`}
                  >
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export const AdminCountdownBadge: React.FC<{ onLogout?: (isAuto?: boolean) => void }> = React.memo(({ onLogout }) => {
  const [remainingSecs, setRemainingSecs] = useState<number>(() => {
    const last = parseInt(localStorage.getItem("pdt_last_activity") || "0", 10) || Date.now();
    return Math.max(0, Math.floor((15 * 60 * 1000 - (Date.now() - last)) / 1000));
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const last = parseInt(localStorage.getItem("pdt_last_activity") || "0", 10) || Date.now();
      const rem = Math.max(0, Math.floor((15 * 60 * 1000 - (Date.now() - last)) / 1000));
      setRemainingSecs(rem);
      if (rem <= 0 && onLogout) {
        onLogout(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [onLogout]);

  const mins = Math.floor(remainingSecs / 60);
  const secs = remainingSecs % 60;
  const formattedCountdown = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const isUrgent = remainingSecs < 120;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] font-semibold ${
        isUrgent
          ? "bg-rose-600 text-white shadow-xs"
          : "bg-slate-800 text-slate-200 border border-slate-700"
      }`}
      title="System auto logout on inactivity"
    >
      <Clock size={12} className={isUrgent ? "text-white" : "text-slate-400"} />
      <span>Auto Logout: {formattedCountdown}</span>
    </span>
  );
});

export const FilterBar: React.FC<FilterBarProps> = React.memo(({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedFactory,
  setSelectedFactory,
  selectedLineGroup,
  setSelectedLineGroup,
  selectedUnit,
  setSelectedUnit,
  facUnit,
  setFacUnit,
  granularity,
  setGranularity,
  lineGroups,
  isLoading,
  onSearch,
  onOpenSettings,
  onOpenImportExcel,
  onOpenManualMatrixModal,
  onExportExcel,
  isExporting = false,
  isAdmin = false,
  setIsAdmin,
  adminRemainingSeconds,
  hiddenTables = [],
  setHiddenTables,
  onOpenTableVisibilityModal,
  onOpenEmployeeScanModal,
  onOpenManpowerAuditModal,
  onOpenManpowerLoanModal,
  onOpenManpowerSnapshotModal,
  onOpenCostCenterModal,
  onOpenMacroLineModal,
  onOpenLineMappingModal,
  onOpenToolsGuideModal,
  onOpenProductivityOutputModal,
  onSyncAttendance,
  isSyncingAttendance = false,
  hasAttendanceUpdate = false,
  changedDates = [],
  totalDaysChanged = 0,
  latestAttendanceUpdate = null,
}) => {
  const navigate = useNavigate();
  const [lineDropdownOpen, setLineDropdownOpen] = useState(false);
  const [loginError, setLoginError] = useState<string>("");
  const [loanAlertCount, setLoanAlertCount] = useState<number>(0);
  const [adminToolsOpen, setAdminToolsOpen] = useState(false);
  const adminToolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminToolsRef.current && !adminToolsRef.current.contains(event.target as Node)) {
        setAdminToolsOpen(false);
      }
    };
    if (adminToolsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [adminToolsOpen]);

  React.useEffect(() => {
    if (!isAdmin) return;
    const targetDate = dayjs(startDate).format("YYYY-MM-DD");
    fetch(`${getApiBaseUrl()}/productivity/attendance/loan-alert-status?date=${targetDate}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.hasAlert) {
          setLoanAlertCount(data.alertCount || 0);
        } else {
          setLoanAlertCount(0);
        }
      })
      .catch(() => setLoanAlertCount(0));
  }, [startDate, isAdmin]);

  const [lineSearch, setLineSearch] = useState("");
  const [customLineNames, setCustomLineNames] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("productivity_custom_line_names");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  React.useEffect(() => {
    fetchCustomLineNames().then((data) => {
      if (data && Object.keys(data).length > 0) {
        setCustomLineNames(data);
        try {
          localStorage.setItem("productivity_custom_line_names", JSON.stringify(data));
        } catch (e) { }
      }
    });

    const handleSync = () => {
      try {
        const saved = localStorage.getItem("productivity_custom_line_names");
        setCustomLineNames(saved ? JSON.parse(saved) : {});
      } catch (e) { }
    };
    window.addEventListener("line-names-updated", handleSync);
    return () => window.removeEventListener("line-names-updated", handleSync);
  }, []);

  const sectorOptions = useMemo(() => {
    const base = [
      { value: "ALL", label: "All Types" },
      { value: "SMT", label: "SMT" },
      { value: "FPC", label: "FPC" },
      { value: "QA", label: "QA" },
      { value: "MACRO", label: "MACRO" },
    ];
    const knownKeys = new Set(base.map(b => b.value.toUpperCase()));

    (lineGroups || []).forEach(g => {
      if (g.factory && !knownKeys.has(g.factory.toUpperCase())) {
        knownKeys.add(g.factory.toUpperCase());
        base.push({ value: g.factory.toUpperCase(), label: g.factory.toUpperCase() });
      }
    });

    getCachedCustomMacroLines().forEach(m => {
      if (m.factory && !knownKeys.has(m.factory.toUpperCase())) {
        knownKeys.add(m.factory.toUpperCase());
        base.push({ value: m.factory.toUpperCase(), label: m.factory.toUpperCase() });
      }
    });

    return base;
  }, [lineGroups]);

  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"month" | "year">("month");
  const [displayYear, setDisplayYear] = useState<number>(() => dayjs(startDate).year());
  const [loginAttempts, setLoginAttempts] = useState(0);

  const handleHardReload = async () => {
    try {
      await fetch(`${getApiBaseUrl()}/productivity/clear-cache`, { method: "POST" }).catch(() => null);
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      sessionStorage.clear();
      window.location.reload();
    } catch (err) {
      console.error("Hard reload error:", err);
      window.location.reload();
    }
  };

  React.useEffect(() => {
    if (monthPickerOpen) {
      setDisplayYear(dayjs(startDate).year());
    }
  }, [monthPickerOpen, startDate]);

  const dateRangeLabel = useMemo(() => {
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  }, [startDate, endDate]);

  const isLineGroupHidden = useCallback((lineGroup: string): boolean => {
    if (!hiddenTables || hiddenTables.length === 0) return false;
    
    const norm = normalizeMatrixLineGroupName(lineGroup).toUpperCase();
    const raw = lineGroup.trim().toUpperCase();
    const rawNoLine = raw.replace(/^LINE\s+/, "");
    const rawUnderscore = raw.replace(/\s+/g, "_").replace(/-/g, "_");

    return hiddenTables.some(hiddenId => {
      const hNorm = normalizeMatrixLineGroupName(hiddenId).toUpperCase();
      const hRaw = hiddenId.trim().toUpperCase();
      const hRawNoLine = hRaw.replace(/^LINE\s+/, "");
      const hUnderscore = hRaw.replace(/\s+/g, "_").replace(/-/g, "_");

      if (raw === hRaw || norm === hNorm || raw === hNorm || norm === hRaw) return true;
      if (rawNoLine === hRawNoLine) return true;
      if (rawUnderscore === hUnderscore) return true;

      // QA / OQI aliases
      if (
        (raw.includes("QA_FPC_AUTO") || raw.includes("QA FPC AUTO") || raw.includes("OQI_F-AUTO") || raw.includes("OQI_F_AUTO") || raw === "OQI_F-AUTO") &&
        (hRaw.includes("QA_FPC_AUTO") || hRaw.includes("QA FPC AUTO") || hRaw.includes("OQI_F-AUTO") || hRaw.includes("OQI_F_AUTO") || hRaw === "OQI_F-AUTO")
      ) return true;

      if (
        (raw.includes("QA_FPC_GEN") || raw.includes("QA FPC GEN") || raw.includes("OQI_F-GEN") || raw.includes("OQI_F_GEN") || raw === "OQI_F-GEN") &&
        (hRaw.includes("QA_FPC_GEN") || hRaw.includes("QA FPC GEN") || hRaw.includes("OQI_F-GEN") || hRaw.includes("OQI_F_GEN") || hRaw === "OQI_F-GEN")
      ) return true;

      if (
        (raw.includes("QA_SMT_AUTO") || raw.includes("QA SMT AUTO") || raw.includes("OQI_S-AUTO") || raw.includes("OQI_S_AUTO") || raw === "OQI_S-AUTO") &&
        (hRaw.includes("QA_SMT_AUTO") || hRaw.includes("QA SMT AUTO") || hRaw.includes("OQI_S-AUTO") || hRaw.includes("OQI_S_AUTO") || hRaw === "OQI_S-AUTO")
      ) return true;

      if (
        (raw.includes("QA_SMT_GEN") || raw.includes("QA SMT GEN") || raw.includes("OQI_S-GEN") || raw.includes("OQI_S_GEN") || raw === "OQI_S-GEN") &&
        (hRaw.includes("QA_SMT_GEN") || hRaw.includes("QA SMT GEN") || hRaw.includes("OQI_S-GEN") || hRaw.includes("OQI_S_GEN") || hRaw === "OQI_S-GEN")
      ) return true;

      if (
        (raw === "DQA" || raw === "OQI_M" || raw === "LINE DQA" || raw === "OQI_M (DQA)") &&
        (hRaw === "DQA" || hRaw === "OQI_M" || hRaw === "LINE DQA" || hRaw === "OQI_M (DQA)")
      ) return true;

      if (
        (raw === "MQA" || raw === "QA SMT" || raw === "QA_SMT") &&
        (hRaw === "MQA" || hRaw === "QA SMT" || hRaw === "QA_SMT")
      ) return true;

      if (
        (raw === "MD LAM" || raw === "LINE MD LAM" || raw === "MD_LAM") &&
        (hRaw === "MD LAM" || hRaw === "LINE MD LAM" || hRaw === "MD_LAM")
      ) return true;

      if (
        (raw === "LINE MAS & REW" || raw === "MAS & REW" || raw === "LINE MAS & LINE REW") &&
        (hRaw === "LINE MAS & REW" || hRaw === "MAS & REW" || hRaw === "LINE MAS & LINE REW")
      ) return true;

      if (
        (raw.includes("AIX-ASY") || raw.includes("AIX_ASY") || raw.includes("ASY4") || raw.includes("ASSY4")) &&
        (hRaw.includes("AIX-ASY") || hRaw.includes("AIX_ASY") || hRaw.includes("ASY4") || hRaw.includes("ASSY4"))
      ) return true;

      if (
        (raw === "LINE S_IND" || raw === "S_IND" || raw === "SMT BACK_INDIRECT") &&
        (hRaw === "LINE S_IND" || hRaw === "S_IND" || hRaw === "SMT BACK_INDIRECT")
      ) return true;

      return false;
    });
  }, [hiddenTables]);

  useEffect(() => {
    if (selectedLineGroup !== "ALL" && selectedLineGroup.length > 0 && hiddenTables.length > 0) {
      const hasVisible = selectedLineGroup.some(line => !isLineGroupHidden(line));
      if (!hasVisible) {
        setSelectedLineGroup("ALL");
      }
    }
  }, [hiddenTables, selectedLineGroup, isLineGroupHidden, setSelectedLineGroup]);

  const availableLineGroups = useMemo(() => {
    if (selectedFactory === "MACRO") {
      const macroList = [
        { id: "macro_pcn", name: "Macro PCN", factory: "MACRO" },
        { id: "macro_fpc", name: "Macro FPC", factory: "MACRO" },
        { id: "direct_fpc", name: "Direct FPC", factory: "MACRO" },
        { id: "mds", name: "MDS", factory: "MACRO" },
        { id: "macro_smt", name: "Macro SMT", factory: "MACRO" },
        { id: "direct_smt", name: "Direct SMT", factory: "MACRO" },
        { id: "macro_smt_f", name: "Macro SMT_F", factory: "MACRO" },
        { id: "macro_smt_b", name: "Macro SMT_B", factory: "MACRO" },
      ] as any[];
      return macroList.filter(g => !isLineGroupHidden(g.name));
    }
    const visibleGroups = lineGroups.filter(group => {
      const name = normalizeMatrixLineGroupName(group.name).toUpperCase();
      if (name === "LINE S_TECH_F" || name === "LINE NPM" || name === "SUPPORT TF2") return false;
      if (isLineGroupHidden(group.name)) return false;
      return true;
    });
    const factoryFiltered = selectedFactory === "ALL"
      ? visibleGroups
      : visibleGroups.filter(g => g.factory === selectedFactory);

    const seen = new Set<string>();
    const uniqueGroups: any[] = [];
    factoryFiltered.forEach(group => {
      const custom = (customLineNames[group.name] || customLineNames[group.name.toUpperCase()] || "").trim().toUpperCase();
      const norm = normalizeMatrixLineGroupName(group.name).trim().toUpperCase();
      const disp = (custom || getLineGroupDisplayName(group.name)).replace(/^LINE\s+/i, "").trim().toUpperCase();
      const key = disp || norm;
      if (!seen.has(key) && !seen.has(norm)) {
        seen.add(key);
        seen.add(norm);
        uniqueGroups.push(group);
      }
    });

    return uniqueGroups;
  }, [lineGroups, selectedFactory, customLineNames, isLineGroupHidden]);
  const filteredLineGroups = useMemo(() => {
    const query = lineSearch.trim().toLocaleLowerCase();
    if (!query) return availableLineGroups;

    return availableLineGroups.filter(group => {
      const origName = group.name.toLocaleLowerCase();
      const defaultName = getLineGroupDisplayName(group.name).toLocaleLowerCase();
      const custom = (customLineNames[group.name] || customLineNames[group.name.toUpperCase()] || "").toLocaleLowerCase();

      return origName.includes(query) || defaultName.includes(query) || custom.includes(query);
    });
  }, [availableLineGroups, lineSearch, customLineNames]);

  const allLinesSelected = selectedLineGroup === "ALL" || selectedLineGroup.length === 0;
  const selectedLineLabel = useMemo(() => {
    if (selectedLineGroup === "ALL" || selectedLineGroup.length === 0) return "All Lines";
    if (selectedLineGroup.length === 1) {
      const name = selectedLineGroup[0];
      return customLineNames[name] || customLineNames[name.toUpperCase()] || getLineGroupDisplayName(name);
    }
    return `${selectedLineGroup.length} Lines Selected`;
  }, [selectedLineGroup, customLineNames]);
  const selectedMonth = granularity === "yearly" ? dayjs() : dayjs(startDate);
  const activeGranularityIndex = Math.max(
    GRANULARITY_TABS.findIndex(tab => tab.id === granularity),
    0
  );
  const selectMonth = (monthIndex: number, year = selectedMonth.year()) => {
    const validYear = year < 2024 ? dayjs().year() : year;
    const nextMonth = dayjs().year(validYear).month(monthIndex).date(1);

    setStartDate(nextMonth.startOf("month").format("YYYY-MM-DD"));
    setEndDate(nextMonth.endOf("month").format("YYYY-MM-DD"));
    setMonthPickerOpen(false);
  };

  const selectYear = (year: number) => {
    const isCurrentYear = year === dayjs().year();
    const nextYear = dayjs().year(year).month(0).date(1);
    // For 2026, complete data starts from February (2026-02-01)
    const startMonth = year === 2026 ? 1 : 0;
    setStartDate(dayjs().year(year).month(startMonth).startOf("month").format("YYYY-MM-DD"));
    if (isCurrentYear) {
      setEndDate(dayjs().endOf("month").format("YYYY-MM-DD"));
    } else {
      setEndDate(nextYear.endOf("year").format("YYYY-MM-DD"));
    }
    setGranularity("monthly");
    setPickerMode("year");
    setMonthPickerOpen(false);
  };

  const currentYear = dayjs().year();
  const availableYears = [2026, 2027, 2028];

  return (
    <section className="bg-base-100 rounded-2xl shadow-sm border border-base-300/80 shrink-0 transition-all relative z-50 w-full max-w-full">
      {isAdmin && (
        <div className="bg-slate-900 text-white px-5 py-2 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-800 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/30 text-indigo-300 border border-indigo-500/40">
              <Shield size={13} />
            </span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">Admin Mode</span>
              <span className="text-[11px] font-medium text-slate-300 hidden md:inline">
                Authorized for system configuration and data management
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {isAdmin && <AdminCountdownBadge onLogout={setIsAdmin ? () => setIsAdmin(false) : undefined} />}
            <div className="inline-flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-md border border-slate-700 text-white text-[11px] font-mono font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>
                USER: {localStorage.getItem("pdt_admin_display_name") || localStorage.getItem("pdt_admin_user") || "Admin"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ROW 1: Dedicated Header Bar */}
      <div className={`px-5 py-3.5 border-b border-base-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${!isAdmin ? 'bg-slate-50/90 rounded-t-2xl' : 'bg-slate-50/60'}`}>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            Productivity Smart Report
          </h1>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 font-mono shadow-2xs">
            <CalendarDays size={14} className="text-slate-500 shrink-0" />
            {dateRangeLabel}
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
          {/* Notification Bell & Live Update Ticker */}
          <NotificationBell
            hasAttendanceUpdate={hasAttendanceUpdate}
            changedDates={changedDates}
            totalDaysChanged={totalDaysChanged}
            latestAttendanceUpdate={latestAttendanceUpdate}
            onSyncAttendance={onSyncAttendance}
            isSyncingAttendance={isSyncingAttendance}
            onHardReload={handleHardReload}
          />

          {/* Refresh Quick Button */}
          <button
            type="button"
            className="btn h-9 min-h-9 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            onClick={handleHardReload}
            title="รีเฟรชข้อมูลและล้าง Cache (Refresh & Clear Cache)"
          >
            <RefreshCcw className="w-3.5 h-3.5 text-slate-500 active:rotate-180 transition-transform duration-300" />
            <span className="text-xs font-bold hidden sm:inline">Refresh</span>
          </button>

          {/* Admin Login / Status Dropdown */}
          <div className="dropdown dropdown-end">
            <label
              id="admin-login-dropdown-btn"
              tabIndex={0}
              className={`btn h-10 min-h-10 rounded-xl border px-3.5 transition-all shadow-xs flex items-center gap-2 cursor-pointer ${isAdmin
                ? "border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
                : "border-base-300 bg-base-100 text-base-content/70 hover:bg-base-200"
                }`}
              title={isAdmin ? `Admin: ${localStorage.getItem("pdt_admin_display_name") || localStorage.getItem("pdt_admin_user")}` : "Admin Login"}
            >
              {isAdmin ? (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/30 text-indigo-200 flex items-center justify-center font-bold text-xs border border-indigo-400/30">
                    {(localStorage.getItem("pdt_admin_display_name") || localStorage.getItem("pdt_admin_user") || "A").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col items-start leading-none text-left">
                    <span className="text-xs font-bold text-white truncate max-w-[110px]">
                      {localStorage.getItem("pdt_admin_display_name") || localStorage.getItem("pdt_admin_user") || "Admin Mode"}
                    </span>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">
                      {localStorage.getItem("pdt_admin_role") || "Admin"}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-base-content/60" />
                  <span className="text-xs font-bold">Admin Login</span>
                </>
              )}
            </label>

            <div
              tabIndex={0}
              className="dropdown-content z-[100] menu p-4 shadow-2xl bg-base-100 rounded-2xl w-80 mt-2 border border-base-300"
            >
              {isAdmin ? (
                <div className="flex flex-col items-center justify-center p-2 text-center">
                  <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mb-2">
                    <Shield size={24} />
                  </div>
                  <h3 className="font-bold text-base text-base-content flex items-center justify-center gap-2">
                    <span>{localStorage.getItem("pdt_admin_display_name") || localStorage.getItem("pdt_admin_user") || "Admin Logged In"}</span>
                    <span className="badge badge-sm badge-info font-bold text-[10px]">
                      {localStorage.getItem("pdt_admin_role") || "Admin"}
                    </span>
                  </h3>
                  <p className="text-xs text-base-content/60 mt-1 mb-4">
                    คุณกำลังใช้งานในชื่อ <strong className="text-sky-600 font-semibold">{localStorage.getItem("pdt_admin_display_name") || localStorage.getItem("pdt_admin_user") || "Admin"}</strong> (บทบาท: {localStorage.getItem("pdt_admin_role") || "Admin"}) สิทธิ์การจัดการเต็มระบบ
                  </p>
                  <button
                    type="button"
                    className="btn btn-sm btn-error btn-outline w-full gap-2 rounded-xl font-bold cursor-pointer"
                    onClick={() => {
                      if (setIsAdmin) setIsAdmin(false);
                      localStorage.removeItem("pdt_is_admin");
                      localStorage.removeItem("pdt_last_activity");
                      localStorage.removeItem("pdt_admin_user");
                      localStorage.removeItem("pdt_admin_display_name");
                      localStorage.removeItem("pdt_admin_role");
                      (document.activeElement as HTMLElement)?.blur();
                      const btn = document.getElementById("admin-login-dropdown-btn");
                      if (btn) btn.blur();

                      toast.success(
                        <div className="flex flex-col gap-0.5 text-left">
                          <span className="font-semibold text-sm text-slate-800 leading-snug">ออกจากระบบสำเร็จ</span>
                          <span className="text-xs text-slate-500 leading-relaxed">สิ้นสุดการเข้าสู่ระบบผู้ดูแลเรียบร้อย</span>
                        </div>,
                        {
                          position: "top-right",
                          duration: 2800,
                        }
                      );
                    }}
                  >
                    <LogOut size={14} />
                    ออกจากระบบ (Log Out)
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex flex-col items-center justify-center mb-3">
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-1">
                      <Lock size={20} />
                    </div>
                    <h3 className="font-bold text-base">Admin Login</h3>
                    <p className="text-[11px] text-base-content/50">เข้าสู่ระบบเพื่อจัดการตารางและสิทธิ์</p>
                  </div>

                  {loginError && (
                    <div key={loginAttempts} className="alert alert-error py-2 px-3 text-xs rounded-xl flex items-center gap-2 mb-3 font-medium shadow-sm border border-red-200 animate-shake">
                      <AlertCircle size={15} className="shrink-0 text-red-600" />
                      <span className="text-red-700 font-semibold">{loginError}</span>
                    </div>
                  )}

                  <form
                    noValidate
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setLoginAttempts(prev => prev + 1);
                      const form = e.currentTarget;
                      const userVal = (form.elements.namedItem("admin_user") as HTMLInputElement)?.value;
                      const passVal = (form.elements.namedItem("admin_pass") as HTMLInputElement)?.value;

                      if (!userVal || !passVal) {
                        const errMsg = "กรุณากรอก Username และ Password ให้ครบถ้วน";
                        setLoginError(errMsg);
                        return;
                      }

                      try {
                        const res = await fetch(`${getApiBaseUrl()}/productivity/admin-login`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ username: userVal, password: passVal })
                        });
                        const resData = await res.json();

                        if (res.ok && resData.success) {
                          setLoginError("");
                          localStorage.setItem("pdt_is_admin", "true");
                          localStorage.setItem("pdt_admin_user", resData.username || userVal);
                          localStorage.setItem("pdt_admin_display_name", resData.displayName || resData.username || userVal);
                          localStorage.setItem("pdt_admin_role", resData.role || "Admin");
                          if (setIsAdmin) setIsAdmin(true);
                          (document.activeElement as HTMLElement)?.blur();

                          toast.success(
                            <div className="flex flex-col gap-0.5 text-left">
                              <span className="font-semibold text-sm text-slate-800 leading-snug">เข้าสู่ระบบสำเร็จ</span>
                              <span className="text-xs text-slate-500 leading-relaxed">
                                ยินดีต้อนรับ {resData.displayName || resData.username}
                              </span>
                            </div>,
                            {
                              position: "top-right",
                              duration: 3200,
                            }
                          );
                        } else {
                          const errText = resData.error || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
                          setLoginError(errText);
                        }
                      } catch (err) {
                        console.error("Admin login error:", err);
                        const netErr = "เกิดข้อผิดพลาดในการเชื่อมต่อเซิฟเวอร์";
                        setLoginError(netErr);
                      }
                    }}
                    className="space-y-3"
                  >
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-xs font-medium">Username</span>
                      </label>
                      <input
                        name="admin_user"
                        type="text"
                        className="input input-bordered input-sm w-full rounded-lg"
                        placeholder="Enter Username"
                        autoComplete="off"
                        required
                      />
                    </div>
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-xs font-medium">Password</span>
                      </label>
                      <input
                        name="admin_pass"
                        type="password"
                        className="input input-bordered input-sm w-full rounded-lg"
                        placeholder="Enter Password"
                        autoComplete="new-password"
                        required
                      />
                    </div>
                    <button type="submit" className="btn btn-sm btn-primary w-full mt-2 rounded-lg font-bold">
                      Sign In
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body Section: Primary Filters & Tools */}
      <div className="p-5 flex flex-col gap-4">
        {/* ROW 2: Primary Filters (Balanced Split Layout) */}
        <div className="flex flex-wrap items-end justify-between gap-3 w-full">
          {/* Left: View Mode (Granularity Tabs) */}
          <div className="relative w-full sm:w-[240px] shrink-0">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-base-content/50">
              View
            </span>
            <div className="relative grid h-10 w-full grid-cols-4 overflow-hidden rounded-xl border border-base-300 bg-base-200/50 p-1 shadow-2xs">
              <span
                className="absolute bottom-1 left-1 top-1 w-[calc((100%-0.5rem)/4)] rounded-lg bg-base-100 shadow-xs border border-base-300/80 transition-transform duration-200 ease-out"
                style={{ transform: `translateX(${activeGranularityIndex * 100}%)` }}
              />
              {GRANULARITY_TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  className={`relative z-10 rounded-lg text-xs transition-colors duration-150 ${granularity === tab.id
                    ? "font-extrabold text-base-content"
                    : "font-semibold text-base-content/60 hover:text-base-content"
                    }`}
                  onClick={() => {
                    const newGran = tab.id as Granularity;
                    setGranularity(newGran);

                    const now = dayjs();
                    const currentYear = now.year();

                    if (newGran === 'yearly') {
                      setStartDate('2026-01-01');
                      setEndDate(`${currentYear}-12-31`);
                      setPickerMode('year');
                      if (selectedLineGroup === 'ALL' || !selectedLineGroup || selectedLineGroup.length === 0) {
                        setSelectedLineGroup(['Direct FPC', 'Direct SMT']);
                        setSelectedFactory('ALL');
                        setFacUnit('ALL');
                        setSelectedUnit('sht');
                      }
                    } else if (newGran === 'monthly') {
                      const isComingFromMultiYear = granularity === 'yearly' || dayjs(endDate).diff(dayjs(startDate), 'month') > 12;
                      const year = isComingFromMultiYear ? currentYear : (dayjs(endDate).year() || currentYear);
                      const isCurrentYear = year === currentYear;
                      const startMonth = year === 2026 ? 1 : 0;
                      setStartDate(dayjs().year(year).month(startMonth).startOf('month').format('YYYY-MM-DD'));
                      if (isCurrentYear) {
                        setEndDate(now.endOf('month').format('YYYY-MM-DD'));
                      } else {
                        setEndDate(dayjs().year(year).endOf('year').format('YYYY-MM-DD'));
                      }
                      setPickerMode('year');
                    } else if (newGran === 'weekly') {
                      const isComingFromMultiYear = granularity === 'yearly' || dayjs(endDate).diff(dayjs(startDate), 'month') > 12;
                      const targetDate = isComingFromMultiYear ? now : (dayjs(endDate).year() === currentYear ? dayjs(endDate) : now);
                      setStartDate(targetDate.startOf('month').format('YYYY-MM-DD'));
                      setEndDate(targetDate.endOf('month').format('YYYY-MM-DD'));
                      setPickerMode('month');
                    } else if (newGran === 'daily') {
                      const isComingFromMultiYear = granularity === 'yearly' || dayjs(endDate).diff(dayjs(startDate), 'month') > 12;
                      const targetDate = isComingFromMultiYear ? now : (dayjs(endDate).year() === currentYear ? dayjs(endDate) : now);
                      const isCurrentMonth = targetDate.format('YYYY-MM') === now.format('YYYY-MM');
                      const yesterday = now.subtract(1, 'day');

                      if (isCurrentMonth && yesterday.month() !== now.month()) {
                        // If today is the 1st of the month, default to previous month so closed data (31st) is visible
                        setStartDate(yesterday.startOf('month').format('YYYY-MM-DD'));
                        setEndDate(yesterday.format('YYYY-MM-DD'));
                      } else {
                        setStartDate(targetDate.startOf('month').format('YYYY-MM-DD'));
                        setEndDate(isCurrentMonth ? yesterday.format('YYYY-MM-DD') : targetDate.endOf('month').format('YYYY-MM-DD'));
                      }
                      setPickerMode('month');
                    }
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Target Filters Group (Select Period, Sector, Line) */}
          <div className="flex flex-wrap items-end justify-end gap-3 shrink-0 ml-auto">
            {/* 2. Select Period */}
            <div className="relative w-full sm:w-[170px] shrink-0">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-base-content/50">
                Select Period
              </span>
              <button
                type="button"
                className={`${selectShellClass} ${monthPickerOpen ? openSelectShellClass : ""} w-full px-0 text-left`}
                aria-haspopup="dialog"
                aria-expanded={monthPickerOpen}
                onClick={() => setMonthPickerOpen(open => !open)}
              >
                <span className="flex h-full w-9 items-center justify-center text-base-content/45 transition-colors group-focus-within:text-primary shrink-0">
                  <CalendarRange size={16} />
                </span>
                <span className="min-w-0 flex-1 font-mono text-sm font-semibold text-base-content truncate pr-1">
                  {pickerMode === "month" ? selectedMonth.format("MMM YYYY") : selectedMonth.format("YYYY")}
                </span>
                <ChevronDown
                  className={`mr-3 h-4 w-4 shrink-0 text-base-content/45 transition-transform ${monthPickerOpen ? "rotate-180 text-primary" : ""
                    }`}
                />
              </button>
              {monthPickerOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMonthPickerOpen(false)} />
                  <div className={`${dropdownPanelClass} !w-[300px] p-3.5`} role="dialog">
                    <div className="mb-2.5 flex items-center bg-base-200/60 p-1 rounded-lg">
                      <button
                        type="button"
                        className={`flex-1 rounded-md py-1 text-xs font-bold transition-all ${pickerMode === "month" ? "bg-base-100 shadow-sm text-primary" : "text-base-content/60 hover:text-base-content"}`}
                        onClick={() => setPickerMode("month")}
                      >
                        By Month
                      </button>
                      <button
                        type="button"
                        className={`flex-1 rounded-md py-1 text-xs font-bold transition-all ${pickerMode === "year" ? "bg-base-100 shadow-sm text-primary" : "text-base-content/60 hover:text-base-content"}`}
                        onClick={() => setPickerMode("year")}
                      >
                        By Year
                      </button>
                    </div>

                    {pickerMode === "month" ? (
                      <>
                        <div className="mb-2.5 flex h-9 items-center justify-between rounded-lg bg-base-200/50 px-3">
                          <button
                            type="button"
                            className="rounded-md px-2 py-0.5 text-xs font-bold text-base-content/50 transition-colors hover:bg-base-200 hover:text-base-content"
                            onClick={() => setDisplayYear(displayYear - 1)}
                          >
                            {displayYear - 1}
                          </button>
                          <span className="text-sm font-black text-primary tracking-wide">{displayYear}</span>
                          <button
                            type="button"
                            className="rounded-md px-2 py-0.5 text-xs font-bold text-base-content/50 transition-colors hover:bg-base-200 hover:text-base-content"
                            onClick={() => setDisplayYear(displayYear + 1)}
                          >
                            {displayYear + 1}
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {MONTH_LABELS.map((month, idx) => {
                            const isSelected = idx === selectedMonth.month() && displayYear === selectedMonth.year();
                            return (
                              <button
                                key={month}
                                type="button"
                                className={`h-8.5 py-1.5 rounded-lg text-xs font-bold transition-all ${isSelected
                                  ? "bg-primary text-primary-content shadow-[0_4px_12px_rgba(79,70,229,0.3)]"
                                  : "bg-base-200/50 hover:bg-primary/10 hover:text-primary"
                                  }`}
                                onClick={() => selectMonth(idx, displayYear)}
                              >
                                {month}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {availableYears.map(year => {
                          const selected = year === selectedMonth.year();
                          return (
                            <button
                              key={year}
                              type="button"
                              className={`h-9 rounded-lg text-xs font-bold transition-all ${selected
                                ? "bg-primary text-primary-content shadow-[0_4px_12px_rgba(79,70,229,0.3)]"
                                : "bg-base-200/50 hover:bg-primary/10 hover:text-primary"
                                }`}
                              onClick={() => selectYear(year)}
                            >
                              {year}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between border-t border-base-300 pt-2">
                      <button
                        type="button"
                        className="rounded-md px-2 py-1 text-xs font-semibold text-base-content/50 transition-colors hover:bg-base-200 hover:text-base-content"
                        onClick={() => setMonthPickerOpen(false)}
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        className="rounded-md px-2 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
                        onClick={() => {
                          if (pickerMode === "month") {
                            selectMonth(dayjs().month(), dayjs().year());
                          } else {
                            selectYear(dayjs().year());
                          }
                        }}
                      >
                        {pickerMode === "month" ? "This month" : "This year"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 3. Line (In the Middle) */}
            <div className="relative w-full sm:w-[220px] lg:w-[260px] shrink-0 overflow-visible">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-base-content/50">
                Line
              </span>
              <button
                type="button"
                className={`${selectShellClass} ${lineDropdownOpen ? openSelectShellClass : ""} w-full px-0 text-left`}
                onClick={() => setLineDropdownOpen(!lineDropdownOpen)}
              >
                <span className="flex h-full w-9 items-center justify-center text-base-content/45 shrink-0">
                  <Route size={16} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-base-content">
                  {selectedLineLabel}
                </span>
                {!allLinesSelected && (
                  <div
                    className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-base-200/80 transition-colors z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLineGroup("ALL");
                    }}
                  >
                    <X size={14} className="text-base-content/60 hover:text-base-content" />
                  </div>
                )}
                <ChevronDown className={`mr-3 h-4 w-4 shrink-0 text-base-content/45 transition-transform ${lineDropdownOpen ? "rotate-180 text-primary" : ""}`} />
              </button>
              {lineDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                      setLineDropdownOpen(false);
                      setLineSearch("");
                    }}
                  />
                  <ul className="absolute left-0 right-0 top-full z-[100] mt-2 w-full max-h-[60vh] overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-2 text-sm shadow-xl">
                    <li className="sticky top-0 z-10 mb-1 bg-base-100 pb-1">
                      <div className="flex h-9 items-center gap-2 rounded-lg border border-base-300 bg-base-100 px-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
                        <Search className="h-4 w-4 shrink-0 text-base-content/40" />
                        <input
                          type="search"
                          value={lineSearch}
                          onChange={event => setLineSearch(event.target.value)}
                          placeholder="Search line..."
                          className="w-full bg-transparent text-sm placeholder:text-base-content/40 focus:outline-hidden"
                        />
                      </div>
                    </li>

                    <li>
                      <button
                        type="button"
                        className={`flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left font-semibold transition-colors ${allLinesSelected ? "bg-primary/5 text-base-content" : "text-base-content hover:bg-primary/5"
                          }`}
                        onClick={() => {
                          setSelectedLineGroup("ALL");
                          setLineDropdownOpen(false);
                          setLineSearch("");
                        }}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${allLinesSelected ? "bg-primary text-primary-content" : "border border-base-300"
                            }`}
                        >
                          {allLinesSelected && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <span>All Lines</span>
                      </button>
                    </li>

                    {filteredLineGroups.map(group => {
                      const selected = !allLinesSelected && (
                        Array.isArray(selectedLineGroup)
                          ? selectedLineGroup.some(item => {
                            const normItem = normalizeMatrixLineGroupName(item).toUpperCase();
                            const normGroup = normalizeMatrixLineGroupName(group.name).toUpperCase();
                            return normItem === normGroup || item.trim().toUpperCase() === group.name.trim().toUpperCase();
                          })
                          : (selectedLineGroup as string).trim().toUpperCase() === group.name.trim().toUpperCase()
                      );
                      const customName = customLineNames[group.name] || customLineNames[group.name.toUpperCase()];
                      const displayName = customName || getLineGroupDisplayName(group.name);
                      const keepLinePrefix = /^LINE\s+[ABCD]$/i.test(displayName);
                      const dropdownDisplayName = customName
                        ? customName
                        : keepLinePrefix
                          ? displayName
                          : displayName.replace(/^LINE\s+/i, "");

                      return (
                        <li key={group.name}>
                          <button
                            type="button"
                            className={`flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left font-semibold transition-colors cursor-pointer ${selected
                              ? "bg-primary/5 text-base-content"
                              : "text-base-content hover:bg-primary/5"
                              }`}
                            onClick={() => {
                              setSelectedLineGroup([group.name]);
                              setLineDropdownOpen(false);
                              setLineSearch("");
                            }}
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${selected ? "bg-primary text-primary-content" : "border border-base-300"
                                }`}
                            >
                              {selected && <Check className="h-3.5 w-3.5" />}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{dropdownDisplayName}</span>
                          </button>
                        </li>
                      );
                    })}
                    {filteredLineGroups.length === 0 && (
                      <li className="px-2.5 py-4 text-center text-xs text-base-content/50">
                        No lines found
                      </li>
                    )}
                  </ul>
                </>
              )}
            </div>

            {/* 4. Sector (On the Far Right) */}
            <FilterSelect
              label="Sector"
              icon={<Building2 size={16} />}
              value={selectedFactory}
              onChange={value => {
                setSelectedFactory(value);
                setSelectedLineGroup("ALL");
              }}
              options={sectorOptions}
              className="w-full sm:w-[140px] shrink-0"
            />
          </div>
        </div>

        {/* ROW 3: Tools & Data Management Bar (Streamlined Single-Row Enterprise Layout) */}
        <div className="pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mr-0.5">
              Tools:
            </span>

            {/* Core Action Group */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/70 rounded-xl border border-slate-200/80 shadow-2xs">
              {/* 1. Table Visibility */}
              {onOpenTableVisibilityModal && (
                <button
                  type="button"
                  className="btn h-8 min-h-8 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-semibold px-2.5 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  onClick={onOpenTableVisibilityModal}
                  title="Table Visibility (Hide/Show Tables)"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs">Table Visibility</span>
                  {hiddenTables && hiddenTables.length > 0 && (
                    <span className="badge badge-sm bg-blue-600 text-white border-none text-[10px] font-bold px-1.5 h-4 min-h-4">
                      {hiddenTables.length}
                    </span>
                  )}
                </button>
              )}

              {/* 2. Sync Attendance */}
              {onSyncAttendance && (
                <button
                  type="button"
                  className={`btn h-8 min-h-8 rounded-lg border font-semibold px-2.5 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer relative ${hasAttendanceUpdate
                      ? "border-blue-300 bg-blue-50/90 text-blue-800 hover:bg-blue-100 hover:border-blue-400"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  onClick={onSyncAttendance}
                  disabled={isSyncingAttendance}
                  title="Sync Time Attendance data for updated dates"
                >
                  <RefreshCcw className={`w-3.5 h-3.5 text-blue-600 ${isSyncingAttendance ? "animate-spin" : ""}`} />
                  <span className="text-xs">{isSyncingAttendance ? "Syncing..." : "Sync Attendance"}</span>
                  {hasAttendanceUpdate && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                    </span>
                  )}
                </button>
              )}

              {/* 3. Target Adjustment */}
              {onOpenManualMatrixModal && (
                <button
                  type="button"
                  onMouseEnter={preloadSmartReportModals}
                  className={`btn h-8 min-h-8 rounded-lg border font-semibold px-2.5 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer ${isAdmin
                      ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      : "border-slate-200/80 bg-slate-100 text-slate-400 hover:bg-slate-200/70"
                    }`}
                  onClick={() => {
                    if (isAdmin) {
                      onOpenManualMatrixModal();
                    } else {
                      const adminLabel = document.getElementById("admin-login-dropdown-btn");
                      if (adminLabel) {
                        adminLabel.click();
                        adminLabel.focus();
                      } else {
                        Swal.fire({
                          icon: "info",
                          title: "Admin Access Required",
                          text: "Please sign in as Admin to access Target Adjustment",
                          confirmButtonText: "OK",
                          confirmButtonColor: "#3b82f6",
                          customClass: {
                            popup: "!rounded-2xl !shadow-2xl !border !border-base-300",
                            confirmButton: "btn btn-primary px-6"
                          }
                        });
                      }
                    }
                  }}
                  title={isAdmin ? "Target Adjustment (Target & Plan Management)" : "Sign in as Admin to access Target Adjustment"}
                >
                  <TrendingUp className={`w-3.5 h-3.5 ${isAdmin ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="text-xs">Target Adjustment</span>
                  {!isAdmin && <Lock size={11} className="text-slate-400 opacity-70" />}
                </button>
              )}

              {/* 4. Import Excel */}
              {onOpenImportExcel && (
                <button
                  type="button"
                  onMouseEnter={preloadSmartReportModals}
                  className={`btn h-8 min-h-8 rounded-lg border font-semibold px-2.5 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer ${isAdmin
                      ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      : "border-slate-200/80 bg-slate-100 text-slate-400 hover:bg-slate-200/70"
                    }`}
                  onClick={() => {
                    if (isAdmin) {
                      onOpenImportExcel();
                    } else {
                      const adminLabel = document.getElementById("admin-login-dropdown-btn");
                      if (adminLabel) {
                        adminLabel.click();
                        adminLabel.focus();
                      } else {
                        Swal.fire({
                          icon: "info",
                          title: "Admin Access Required",
                          text: "Please sign in as Admin to access Import Excel",
                          confirmButtonText: "OK",
                          confirmButtonColor: "#3b82f6",
                          customClass: {
                            popup: "!rounded-2xl !shadow-2xl !border !border-base-300",
                            confirmButton: "btn btn-primary px-6"
                          }
                        });
                      }
                    }
                  }}
                  title={isAdmin ? "Import Daily Actual Output Excel" : "Sign in as Admin to access Import Excel"}
                >
                  <FileSpreadsheet className={`w-3.5 h-3.5 ${isAdmin ? "text-emerald-600" : "text-slate-400"}`} />
                  <span className="text-xs">Import Excel</span>
                  {!isAdmin && <Lock size={11} className="text-slate-400 opacity-70" />}
                </button>
              )}

              {/* 5. Export Excel */}
              {onExportExcel && (
                <button
                  type="button"
                  onMouseEnter={preloadSmartReportModals}
                  className="btn h-8 min-h-8 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-semibold px-2.5 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  onClick={onExportExcel}
                  disabled={isExporting}
                  title="Export Productivity table to Excel"
                >
                  {isExporting ? (
                    <span className="loading loading-spinner loading-xs text-emerald-600" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span className="text-xs">{isExporting ? "Exporting..." : "Export Excel"}</span>
                </button>
              )}

              {/* 6. Productivity Output */}
              {onOpenProductivityOutputModal ? (
                <button
                  type="button"
                  onMouseEnter={preloadSmartReportModals}
                  className="btn h-8 min-h-8 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-semibold px-2.5 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  onClick={onOpenProductivityOutputModal}
                  title="Productivity Output (Process & Machine Detail Breakdown)"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs">Productivity Output</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn h-8 min-h-8 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 font-semibold px-2.5 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  onClick={() => {
                    navigate(`${BASE}/productivity/productivity-output`);
                  }}
                  title="View Process & Machine Output details (Productivity Output)"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs font-semibold">Productivity Output</span>
                </button>
              )}
            </div>


            {/* Admin Management Tools Dropdown */}
            {isAdmin && (
              <div className="relative" ref={adminToolsRef} onMouseEnter={preloadSmartReportModals}>
                <button
                  type="button"
                  onMouseEnter={preloadSmartReportModals}
                  onClick={() => setAdminToolsOpen((prev) => !prev)}
                  className={`btn h-8 min-h-8 rounded-lg border font-semibold px-3 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer ${adminToolsOpen
                      ? "border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400"
                    }`}
                  title="Admin Management Tools (Master Data & Manpower Audit)"
                >
                  <Shield className={`w-3.5 h-3.5 ${adminToolsOpen ? "text-indigo-300" : "text-indigo-600"}`} />
                  <span className="text-xs font-semibold">Admin Tools</span>
                  {loanAlertCount > 0 && (
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                    </span>
                  )}
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${adminToolsOpen ? "rotate-180 text-white" : "text-slate-400"
                      }`}
                  />
                </button>

                {adminToolsOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 space-y-2">
                    {/* Manpower Category */}
                    <div>
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Manpower & Attendance
                      </div>
                      <div className="space-y-0.5">
                        {onOpenEmployeeScanModal && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdminToolsOpen(false);
                              onOpenEmployeeScanModal();
                            }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer text-left"
                          >
                            <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
                            <div>
                              <div className="font-semibold text-slate-800">Attendance Scan</div>
                              <div className="text-[10px] text-slate-400">Employee scan details</div>
                            </div>
                          </button>
                        )}

                        {onOpenManpowerAuditModal && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdminToolsOpen(false);
                              onOpenManpowerAuditModal();
                            }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer text-left"
                          >
                            <Calculator className="w-4 h-4 text-blue-600 shrink-0" />
                            <div>
                              <div className="font-semibold text-slate-800">Manpower Audit</div>
                              <div className="text-[10px] text-slate-400">Calculation breakdown</div>
                            </div>
                          </button>
                        )}

                        {onOpenManpowerLoanModal && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdminToolsOpen(false);
                              setLoanAlertCount(0);
                              onOpenManpowerLoanModal();
                            }}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer text-left"
                          >
                            <div className="flex items-center gap-2.5">
                              <UserMinus className="w-4 h-4 text-blue-600 shrink-0" />
                              <div>
                                <div className="font-semibold text-slate-800">Manpower Support</div>
                                <div className="text-[10px] text-slate-400">Manage loaned employees</div>
                              </div>
                            </div>
                            {loanAlertCount > 0 && (
                              <span className="badge badge-sm bg-red-600 text-white font-bold text-[10px] px-1.5">
                                {loanAlertCount > 9 ? "9+" : loanAlertCount}
                              </span>
                            )}
                          </button>
                        )}

                        {onOpenManpowerSnapshotModal && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdminToolsOpen(false);
                              onOpenManpowerSnapshotModal();
                            }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer text-left"
                          >
                            <UserCog className="w-4 h-4 text-blue-600 shrink-0" />
                            <div>
                              <div className="font-semibold text-slate-800">Manpower Snapshot</div>
                              <div className="text-[10px] text-slate-400">Adjust snapshot & cost centers</div>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-slate-100" />

                    {/* Master Data Category */}
                    <div>
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Line & Master Data
                      </div>
                      <div className="space-y-0.5">
                        {onOpenCostCenterModal && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdminToolsOpen(false);
                              onOpenCostCenterModal();
                            }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer text-left"
                          >
                            <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                            <div>
                              <div className="font-semibold text-slate-800">Cost Center</div>
                              <div className="text-[10px] text-slate-400">Map cost centers & lines</div>
                            </div>
                          </button>
                        )}

                        {onOpenMacroLineModal && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdminToolsOpen(false);
                              onOpenMacroLineModal();
                            }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer text-left"
                          >
                            <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                            <div>
                              <div className="font-semibold text-slate-800">Custom Line</div>
                              <div className="text-[10px] text-slate-400">Macro line group builder</div>
                            </div>
                          </button>
                        )}

                        {onOpenLineMappingModal && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdminToolsOpen(false);
                              onOpenLineMappingModal();
                            }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer text-left"
                          >
                            <Network className="w-4 h-4 text-indigo-600 shrink-0" />
                            <div>
                              <div className="font-semibold text-slate-800">Line Mapping</div>
                              <div className="text-[10px] text-slate-400">Line group & process mapping</div>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Right: Tools Guide */}
          {onOpenToolsGuideModal && (
            <button
              type="button"
              className="btn h-8 min-h-8 rounded-lg border border-amber-200/90 bg-amber-50/70 text-amber-900 hover:bg-amber-100 hover:border-amber-300 font-semibold px-2.5 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0 ml-auto"
              onClick={onOpenToolsGuideModal}
              title="View Tools Guide & Formula Manual"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-semibold text-amber-900">Tools Guide</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
});

FilterBar.displayName = "FilterBar";

export default FilterBar;
