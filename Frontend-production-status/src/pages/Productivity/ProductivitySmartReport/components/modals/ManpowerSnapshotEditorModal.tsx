import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Search,
  Filter,
  RefreshCw,
  Check,
  CheckSquare,
  Square,
  Save,
  RotateCcw,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Layers,
  Building2,
  UserCog,
  Users,
  ArrowRight,
  UserCheck,
  Edit3,
  Upload,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import { getApiBaseUrl } from "../../../../../utils/apiConfig";

export interface ManpowerSnapshotRecord {
  id: number;
  employee_code: string;
  employee_name: string;
  department: string | null;
  dept: string | null;
  shift: string | null;
  line_name: string | null;
  line_out: string | null;
  snapshot_date: string;
  updated_at?: string;
}

export interface CostCenterLookupItem {
  cost_center_code: string;
  cost_center_name: string;
  dept: string;
  shift: string;
  line_name: string;
  line_out: string;
  type: string;
}

interface FormattedDateInputProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  disabled?: boolean;
  max?: string;
  min?: string;
}

const FormattedDateInput: React.FC<FormattedDateInputProps> = ({
  value,
  onChange,
  className = "",
  disabled = false,
  max,
  min,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const displayDate =
    value && dayjs(value).isValid() ? dayjs(value).format("DD/MM/YYYY") : "";

  const openPicker = () => {
    if (disabled) return;
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
    input.click();
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={openPicker}
        className={`h-7 px-2.5 rounded-lg border border-base-300 bg-base-100 text-base-content flex items-center justify-between gap-2 text-left font-mono font-bold text-xs shadow-2xs hover:border-primary transition-all ${
          disabled ? "opacity-50 cursor-not-allowed bg-base-200" : "cursor-pointer"
        }`}
      >
        <span>{displayDate || "DD/MM/YYYY"}</span>
        <Calendar size={13} className="text-primary shrink-0" />
      </button>
      <input
        ref={inputRef}
        type="date"
        disabled={disabled}
        max={max}
        min={min}
        className="absolute inset-0 h-full w-full opacity-0 pointer-events-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
      />
    </div>
  );
};

interface SearchableCostCenterDropdownProps {
  value?: string | null;
  placeholder?: string;
  costCenters: CostCenterLookupItem[];
  onSelect: (cc: CostCenterLookupItem) => void;
  className?: string;
  buttonClassName?: string;
  dropUp?: boolean;
}

export const SearchableCostCenterDropdown: React.FC<SearchableCostCenterDropdownProps> = ({
  value,
  placeholder = "Select Cost Center...",
  costCenters,
  onSelect,
  className = "",
  buttonClassName = "",
  dropUp = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!search.trim()) return costCenters.slice(0, 100);
    const q = search.toLowerCase();
    return costCenters
      .filter(
        (c) =>
          c.cost_center_name.toLowerCase().includes(q) ||
          c.cost_center_code.toLowerCase().includes(q) ||
          c.line_name.toLowerCase().includes(q) ||
          c.dept.toLowerCase().includes(q) ||
          c.shift.toLowerCase().includes(q)
      )
      .slice(0, 100);
  }, [costCenters, search]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch("");
        }}
        className={`flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
          buttonClassName || "bg-base-100 hover:bg-base-200 border-base-300 text-base-content"
        }`}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown
          size={13}
          className={`shrink-0 text-base-content/50 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            dropUp ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } left-0 z-50 w-80 sm:w-96 max-h-72 bg-base-100 rounded-xl shadow-2xl border border-base-300 p-2 flex flex-col gap-1.5 animate-fadeIn`}
        >
          {/* Search Box */}
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/40"
            />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Cost Center, Dept, Shift, Line..."
              className="input input-xs input-bordered w-full pl-7 pr-6 text-xs rounded-lg bg-base-200/50 focus:bg-base-100 focus:border-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-56 space-y-0.5 divide-y divide-base-200/40">
            {filtered.length === 0 ? (
              <div className="p-4 text-xs text-center text-base-content/40">
                No matching cost center found
              </div>
            ) : (
              filtered.map((cc) => {
                const isSelected = cc.cost_center_name === value;
                return (
                  <button
                    key={cc.cost_center_name + cc.cost_center_code}
                    type="button"
                    onClick={() => {
                      onSelect(cc);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-base-200 flex flex-col gap-0.5 transition-colors cursor-pointer ${
                      isSelected ? "bg-primary/10 border border-primary/20" : ""
                    }`}
                  >
                    <div className="font-bold text-base-content flex items-center justify-between">
                      <span className="truncate">{cc.cost_center_name}</span>
                      <span className="badge badge-xs font-mono font-bold bg-base-200 text-base-content/70">
                        {cc.dept} / {cc.shift}
                      </span>
                    </div>
                    <div className="text-[10px] text-base-content/60 flex items-center gap-2">
                      <span>Line: {cc.line_name || "-"}</span>
                      <span>Output: {cc.line_out || "-"}</span>
                      <span className="font-bold text-primary">{cc.type}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface ManpowerSnapshotEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialDate?: string;
}

export const ManpowerSnapshotEditorModal: React.FC<ManpowerSnapshotEditorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialDate,
}) => {
  // 1. Core State
  const todayStr = dayjs().format("YYYY-MM-DD");
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (initialDate && dayjs(initialDate).isValid()) {
      return initialDate <= todayStr ? initialDate : todayStr;
    }
    return todayStr;
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [records, setRecords] = useState<ManpowerSnapshotRecord[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenterLookupItem[]>([]);
  const [loadingCostCenters, setLoadingCostCenters] = useState<boolean>(false);

  // 2. Client-side tracking of modifications: Map<employee_code, Partial<ManpowerSnapshotRecord>>
  const [pendingChanges, setPendingChanges] = useState<Map<string, Partial<ManpowerSnapshotRecord>>>(
    new Map()
  );

  // 3. Selection State
  const [selectedEmpCodes, setSelectedEmpCodes] = useState<Set<string>>(new Set());

  // 4. Bulk Target State
  const [bulkSelectedCostCenter, setBulkSelectedCostCenter] = useState<string>("");
  const [costCenterSearch, setCostCenterSearch] = useState<string>("");
  const [showCostCenterDropdown, setShowCostCenterDropdown] = useState<boolean>(false);

  // 5. Filters
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [shiftFilter, setShiftFilter] = useState<string>("ALL");
  const [lineFilter, setLineFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "MODIFIED">("ALL");

  // 6. Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

  // Single Row Quick Edit Modal State
  const [quickEditEmp, setQuickEditEmp] = useState<ManpowerSnapshotRecord | null>(null);

  // Sync initialDate when modal opens (capped at today)
  useEffect(() => {
    if (isOpen) {
      const today = dayjs().format("YYYY-MM-DD");
      if (initialDate && dayjs(initialDate).isValid()) {
        setSelectedDate(initialDate <= today ? initialDate : today);
      } else {
        setSelectedDate(today);
      }
      loadCostCenters();
    }
  }, [isOpen, initialDate]);

  // Fetch Snapshot Records whenever selectedDate changes (and modal is open)
  useEffect(() => {
    if (isOpen && selectedDate) {
      fetchSnapshotData(selectedDate);
    }
  }, [isOpen, selectedDate]);

  // Load Cost Centers Lookup
  const loadCostCenters = async () => {
    if (costCenters.length > 0) return;
    setLoadingCostCenters(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/productivity/cost-center-lookup`);
      if (!res.ok) throw new Error("Failed to fetch cost center lookup");
      const data = await res.json();
      if (Array.isArray(data)) {
        setCostCenters(data);
      }
    } catch (err: any) {
      console.error("Error loading cost centers:", err);
    } finally {
      setLoadingCostCenters(false);
    }
  };

  // Fetch snapshot records for the date
  const fetchSnapshotData = async (date: string) => {
    const today = dayjs().format("YYYY-MM-DD");
    if (date > today) {
      setRecords([]);
      setPendingChanges(new Map());
      setSelectedEmpCodes(new Set());
      setCurrentPage(1);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/productivity/manpower-snapshot?date=${date}`
      );
      if (!res.ok) throw new Error("Failed to load manpower snapshot data");
      const json = await res.json();
      if (json.success && Array.isArray(json.rows)) {
        setRecords(json.rows);
        setPendingChanges(new Map());
        setSelectedEmpCodes(new Set());
        setCurrentPage(1);
      }
    } catch (err: any) {
      console.error("Error fetching snapshot:", err);
      toast.error(`Error: ${err.message || "Failed to load snapshot"}`);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic filter options
  const uniqueDepts = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      const d = (r.dept || "").trim();
      if (d) set.add(d);
    });
    return Array.from(set).sort();
  }, [records]);

  const uniqueShifts = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      const s = (r.shift || "").trim().toUpperCase();
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [records]);

  const uniqueLines = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      const l = (r.line_name || "").trim();
      if (l) set.add(l);
    });
    return Array.from(set).sort();
  }, [records]);

  // Cost Center lookup map for quick access
  const costCenterMap = useMemo(() => {
    const map = new Map<string, CostCenterLookupItem>();
    costCenters.forEach((cc) => {
      if (cc.cost_center_name) map.set(cc.cost_center_name.trim(), cc);
      if (cc.cost_center_code) map.set(cc.cost_center_code.trim().toUpperCase(), cc);
    });
    return map;
  }, [costCenters]);

  // Filtered Cost Centers for autocomplete / dropdown
  const filteredCostCenters = useMemo(() => {
    if (!costCenterSearch.trim()) return costCenters.slice(0, 100);
    const q = costCenterSearch.toLowerCase();
    return costCenters
      .filter(
        (c) =>
          c.cost_center_code.toLowerCase().includes(q) ||
          c.cost_center_name.toLowerCase().includes(q) ||
          c.line_name.toLowerCase().includes(q) ||
          c.dept.toLowerCase().includes(q)
      )
      .slice(0, 100);
  }, [costCenters, costCenterSearch]);

  // Resolved bulk Cost Center item
  const resolvedBulkTarget = useMemo(() => {
    if (!bulkSelectedCostCenter) return null;
    return (
      costCenterMap.get(bulkSelectedCostCenter.trim()) ||
      costCenterMap.get(bulkSelectedCostCenter.trim().toUpperCase()) ||
      null
    );
  }, [bulkSelectedCostCenter, costCenterMap]);

  // Combined Records with pending changes
  const effectiveRecords = useMemo(() => {
    return records.map((rec) => {
      const pending = pendingChanges.get(rec.employee_code);
      if (pending) {
        return { ...rec, ...pending, isModified: true };
      }
      return { ...rec, isModified: false };
    });
  }, [records, pendingChanges]);

  // Filtered list based on search and dropdowns
  const filteredRecords = useMemo(() => {
    return effectiveRecords.filter((rec) => {
      if (statusFilter === "MODIFIED" && !rec.isModified) return false;
      if (deptFilter !== "ALL" && (rec.dept || "").toUpperCase() !== deptFilter.toUpperCase())
        return false;
      if (shiftFilter !== "ALL" && (rec.shift || "").toUpperCase() !== shiftFilter.toUpperCase())
        return false;
      if (lineFilter !== "ALL" && (rec.line_name || "").toUpperCase() !== lineFilter.toUpperCase())
        return false;

      if (searchTerm.trim() !== "") {
        const q = searchTerm.toLowerCase();
        const code = (rec.employee_code || "").toLowerCase();
        const name = (rec.employee_name || "").toLowerCase();
        const dept = (rec.department || "").toLowerCase();
        const line = (rec.line_name || "").toLowerCase();
        return (
          code.includes(q) ||
          name.includes(q) ||
          dept.includes(q) ||
          line.includes(q)
        );
      }
      return true;
    });
  }, [effectiveRecords, statusFilter, deptFilter, shiftFilter, lineFilter, searchTerm]);

  // Paginated records
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage]);

  // Selection helpers
  const allFilteredSelected =
    filteredRecords.length > 0 &&
    filteredRecords.every((r) => selectedEmpCodes.has(r.employee_code));

  const toggleSelectAllFiltered = () => {
    const newSet = new Set(selectedEmpCodes);
    if (allFilteredSelected) {
      filteredRecords.forEach((r) => newSet.delete(r.employee_code));
    } else {
      filteredRecords.forEach((r) => newSet.add(r.employee_code));
    }
    setSelectedEmpCodes(newSet);
  };

  const toggleSelectRow = (empCode: string) => {
    const newSet = new Set(selectedEmpCodes);
    if (newSet.has(empCode)) {
      newSet.delete(empCode);
    } else {
      newSet.add(empCode);
    }
    setSelectedEmpCodes(newSet);
  };

  // Apply Bulk Cost Center change to selected rows
  const handleApplyBulkCostCenter = () => {
    if (!resolvedBulkTarget) {
      toast.error("Please select a target Cost Center first");
      return;
    }
    if (selectedEmpCodes.size === 0) {
      toast.error("Please select at least one employee");
      return;
    }

    const newMap = new Map(pendingChanges);
    selectedEmpCodes.forEach((code) => {
      newMap.set(code, {
        department: resolvedBulkTarget.cost_center_name,
        dept: resolvedBulkTarget.dept,
        shift: resolvedBulkTarget.shift,
        line_name: resolvedBulkTarget.line_name,
        line_out: resolvedBulkTarget.line_out,
      });
    });

    setPendingChanges(newMap);
    toast.success(
      `Applied ${resolvedBulkTarget.cost_center_name} to ${selectedEmpCodes.size} employees`
    );
  };

  // Revert single employee changes
  const handleRevertRow = (empCode: string) => {
    const newMap = new Map(pendingChanges);
    newMap.delete(empCode);
    setPendingChanges(newMap);
  };

  // Revert all pending changes
  const handleDiscardAll = () => {
    if (pendingChanges.size === 0) return;
    Swal.fire({
      title: "Discard Changes?",
      text: `Are you sure you want to discard all ${pendingChanges.size} unsaved changes?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, discard",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
    }).then((res) => {
      if (res.isConfirmed) {
        setPendingChanges(new Map());
        toast("Changes discarded");
      }
    });
  };

  // Save changes to database
  const handleSaveChanges = async () => {
    if (pendingChanges.size === 0) {
      toast("No changes to save");
      return;
    }

    if (selectedDate > todayStr) {
      toast.error("ไม่สามารถบันทึก Snapshot ของวันในอนาคตได้");
      return;
    }

    const confirmRes = await Swal.fire({
      title: "Confirm Snapshot Update",
      html: `You are about to update <b>${pendingChanges.size}</b> employee record(s) for <b>${selectedDate}</b>.<br/><br/><span class="text-xs text-slate-500">Note: Period summary and productivity calculations will automatically re-sync for this date.</span>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Save to Database",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#2563eb",
    });

    if (!confirmRes.isConfirmed) return;

    setSaving(true);
    try {
      const updates = Array.from(pendingChanges.entries()).map(([empCode, changes]) => ({
        employee_code: empCode,
        department: changes.department,
        dept: changes.dept,
        shift: changes.shift,
        line_name: changes.line_name,
        line_out: changes.line_out,
      }));

      const res = await fetch(`${getApiBaseUrl()}/productivity/save-manpower-snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          updates,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save snapshot changes");
      }

      await Swal.fire({
        title: "Saved Successfully",
        text: `Updated ${data.count || updates.length} records in manpower_snapshot for ${selectedDate}.`,
        icon: "success",
        confirmButtonText: "OK",
        confirmButtonColor: "#10b981",
      });

      setPendingChanges(new Map());
      setSelectedEmpCodes(new Set());
      await fetchSnapshotData(selectedDate);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Save snapshot error:", err);
      Swal.fire({
        title: "Save Failed",
        text: err.message || "An error occurred while saving",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ef4444",
      });
    } finally {
      setSaving(false);
    }
  };

  // Quick edit single row helper
  const handleApplyQuickEdit = (targetCC: CostCenterLookupItem) => {
    if (!quickEditEmp) return;
    const newMap = new Map(pendingChanges);
    newMap.set(quickEditEmp.employee_code, {
      department: targetCC.cost_center_name,
      dept: targetCC.dept,
      shift: targetCC.shift,
      line_name: targetCC.line_name,
      line_out: targetCC.line_out,
    });
    setPendingChanges(newMap);
    setQuickEditEmp(null);
    toast.success(`Updated ${quickEditEmp.employee_code}`);
  };

  // 7. Excel Import & Export Logic
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState<boolean>(false);

  // Export snapshot records to Excel with auto-fit column widths (no text overlapping)
  const handleExportExcel = () => {
    try {
      const dataToExport = records.length > 0
        ? records.map(r => ({
            code: r.employee_code,
            name: r.employee_name,
            department: r.department || "",
            dept: r.dept || "",
            shift: r.shift || "",
            line: r.line_name || "",
            line_out: r.line_out || ""
          }))
        : [
            {
              code: "3013208",
              name: "นางเพ็ญศรี ทิมรอด",
              department: "P463-4A/PD_INS",
              dept: "FPC",
              shift: "A",
              line: "LINE D",
              line_out: "LINE D/A"
            },
            {
              code: "5002704",
              name: "นางสาวธีราพร ยามจีน",
              department: "P510-4D/SMT-MOTD",
              dept: "SMT_F",
              shift: "D",
              line: "MOTD",
              line_out: "MOTD/D"
            }
          ];

      const ws = XLSX.utils.json_to_sheet(dataToExport);

      // Auto-fit column widths with ample padding so text never overlaps or truncates
      const colWidths = [
        { wch: 15 }, // code
        { wch: 32 }, // name
        { wch: 32 }, // department
        { wch: 12 }, // dept
        { wch: 10 }, // shift
        { wch: 18 }, // line
        { wch: 20 }, // line_out
      ];
      ws["!cols"] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "tbl_employee_help");
      const filename = records.length > 0
        ? `Manpower_Snapshot_${selectedDate}.xlsx`
        : `Manpower_Snapshot_Template.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`Exported ${filename}`);
    } catch (err: any) {
      toast.error(`Export failed: ${err.message}`);
    }
  };

  // Handle Excel file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      setImporting(true);
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (!rows || rows.length === 0) {
        throw new Error("No data found in the selected Excel file");
      }

      // Check column mapping
      const parsedEmployees: any[] = [];
      for (const row of rows) {
        const keys = Object.keys(row);
        const findVal = (...aliases: string[]) => {
          for (const a of aliases) {
            const foundKey = keys.find(k => k.trim().toLowerCase() === a.toLowerCase());
            if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
              return String(row[foundKey]).trim();
            }
          }
          return "";
        };

        const code = findVal("code", "employee_code", "emp_code", "empid", "รหัสพนักงาน");
        if (!code) continue;

        const name = findVal("name", "employee_name", "emp_name", "fullname", "ชื่อ", "ชื่อ-สกุล");
        const department = findVal("department", "cost_center", "cc", "แผนก");
        const dept = findVal("dept", "ฝ่าย");
        const shift = findVal("shift", "กะ");
        const line = findVal("line", "line_name", "ไลน์");
        const line_out = findVal("line_out", "lineout");

        parsedEmployees.push({
          code,
          name,
          department,
          dept,
          shift,
          line,
          line_out
        });
      }

      if (parsedEmployees.length === 0) {
        throw new Error("Could not find valid employee rows. Required column: 'code' or 'employee_code'");
      }

      // Suggest date from filename (e.g. tbl_employee_help-19.xlsx)
      let suggestedDate = selectedDate;
      const fileDayMatch = file.name.match(/[-_](\d{1,2})\.xlsx?$/i);
      if (fileDayMatch) {
        const dayNum = String(parseInt(fileDayMatch[1], 10)).padStart(2, "0");
        const currentYearMonth = selectedDate.substring(0, 7);
        const detectedDate = `${currentYearMonth}-${dayNum}`;
        if (dayjs(detectedDate).isValid() && detectedDate <= todayStr) {
          suggestedDate = detectedDate;
        }
      }

      setImporting(false);

      const confirmRes = await Swal.fire({
        title: "Confirm Excel Import",
        html: `
          <div class="text-left text-xs space-y-2">
            <p><b>File Name:</b> ${file.name}</p>
            <p><b>Total Records:</b> <span class="text-primary font-bold">${parsedEmployees.length.toLocaleString()}</span> employees</p>
            <div class="p-2.5 bg-slate-100 rounded-lg border border-slate-200">
              <label class="block font-bold text-slate-700 mb-1">Target Snapshot Date:</label>
              <input id="swal-target-date" type="date" max="${todayStr}" value="${suggestedDate}" class="input input-bordered input-sm w-full font-mono text-xs bg-white" />
            </div>
            <p class="text-[11px] text-slate-500">
              Note: This will upload and upsert records into <code>public.manpower_snapshot</code> for the target date.
            </p>
          </div>
        `,
        icon: "info",
        showCancelButton: true,
        confirmButtonText: "Upload & Save",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#2563eb",
        preConfirm: () => {
          const input = document.getElementById("swal-target-date") as HTMLInputElement;
          const target = input ? input.value : suggestedDate;
          if (!target || !dayjs(target).isValid()) {
            Swal.showValidationMessage("Please select a valid date");
            return false;
          }
          if (target > todayStr) {
            Swal.showValidationMessage("Cannot save snapshot for future dates");
            return false;
          }
          return target;
        }
      });

      if (!confirmRes.isConfirmed || !confirmRes.value) return;

      const targetDate = confirmRes.value;
      setLoading(true);

      const res = await fetch(`${getApiBaseUrl()}/productivity/import-manpower-snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: targetDate,
          employees: parsedEmployees
        })
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || "Failed to import manpower snapshot");
      }

      await Swal.fire({
        title: "Import Successful",
        text: `Successfully imported ${resData.count || parsedEmployees.length} employee records for ${targetDate}.`,
        icon: "success",
        confirmButtonColor: "#10b981"
      });

      setSelectedDate(targetDate);
      await fetchSnapshotData(targetDate);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Import error:", err);
      Swal.fire({
        title: "Import Failed",
        text: err.message || "An error occurred while importing",
        icon: "error",
        confirmButtonColor: "#ef4444"
      });
    } finally {
      setImporting(false);
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-base-100 rounded-3xl shadow-2xl border border-base-300 w-full max-w-[98vw] xl:max-w-7xl h-[92vh] max-h-[94vh] flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-3.5 border-b border-base-200 flex items-center justify-between bg-gradient-to-r from-base-100 via-base-200/40 to-base-100 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-base-content">
                Manpower Snapshot Adjustment
              </h2>
              <span className="badge badge-primary badge-sm font-semibold">
                Snapshot Editor
              </span>
            </div>
            <p className="text-xs text-base-content/60 mt-0.5">
              ปรับแต่ง Cost Center, Line และ Shift ของพนักงานรายวันย้อนหลังใน public.manpower_snapshot
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Snapshot Date Picker in Header */}
            <div className="flex items-center gap-2 bg-base-200/70 px-3 py-1.5 rounded-xl border border-base-300 shadow-2xs">
              <span className="text-xs font-semibold text-base-content/70">Snapshot Date:</span>
              <FormattedDateInput
                value={selectedDate}
                max={todayStr}
                onChange={(newDate) => {
                  if (newDate > todayStr) {
                    toast.error("ไม่สามารถเลือกหรือแก้ไข Snapshot ของวันในอนาคตได้");
                    setSelectedDate(todayStr);
                  } else {
                    setSelectedDate(newDate);
                  }
                }}
                disabled={loading}
              />
              <button
                onClick={() => fetchSnapshotData(selectedDate)}
                disabled={loading}
                className="btn btn-xs btn-ghost btn-circle text-base-content/70 hover:text-primary"
                title="Refresh Date Data"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            {/* Action Buttons: Import & Export Excel */}
            <div className="flex items-center gap-2">
              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Import Excel Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || importing}
                className="btn btn-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg gap-1.5 border-none shadow-2xs cursor-pointer px-3 h-7"
                title="Import Excel file (tbl_employee_help format)"
              >
                {importing ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}
                Import Excel
              </button>

              {/* Export Excel Button */}
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={loading}
                className="btn btn-xs bg-base-100 hover:bg-base-200 border border-base-300 text-base-content font-semibold rounded-lg gap-1.5 shadow-2xs cursor-pointer px-3 h-7"
                title="Export snapshot records to Excel"
              >
                <Download size={12} />
                Export Excel
              </button>
            </div>

            <div className="h-6 w-px bg-base-300" />

            <button
              onClick={onClose}
              className="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Toolbar & Filters Bar (Single Clean Horizontal Row) */}
        <div className="px-6 py-2.5 border-b border-base-200 bg-base-100 flex items-center justify-between gap-3 shrink-0">
          {/* Left Controls: Search & Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Search Input */}
            <div className="relative w-48 sm:w-56 shrink-0">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search Emp ID, Name..."
                className="input input-sm input-bordered w-full pl-8 pr-7 text-xs rounded-xl focus:border-primary"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filter: Dept */}
            <select
              value={deptFilter}
              onChange={(e) => {
                setDeptFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="select select-sm select-bordered text-xs rounded-xl font-medium max-w-[130px]"
            >
              <option value="ALL">All Depts</option>
              {uniqueDepts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {/* Filter: Shift */}
            <select
              value={shiftFilter}
              onChange={(e) => {
                setShiftFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="select select-sm select-bordered text-xs rounded-xl font-medium max-w-[115px]"
            >
              <option value="ALL">All Shifts</option>
              {uniqueShifts.map((s) => (
                <option key={s} value={s}>
                  Shift {s}
                </option>
              ))}
            </select>

            {/* Filter: Line */}
            <select
              value={lineFilter}
              onChange={(e) => {
                setLineFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="select select-sm select-bordered text-xs rounded-xl font-medium max-w-[130px]"
            >
              <option value="ALL">All Lines</option>
              {uniqueLines.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <button
              onClick={() => {
                setStatusFilter(statusFilter === "ALL" ? "MODIFIED" : "ALL");
                setCurrentPage(1);
              }}
              className={`btn btn-sm text-xs rounded-xl gap-1.5 shrink-0 ${
                statusFilter === "MODIFIED"
                  ? "btn-primary"
                  : "btn-ghost border border-base-300"
              }`}
            >
              <Filter size={13} />
              {statusFilter === "MODIFIED" ? "Modified Only" : "All Status"}
              {pendingChanges.size > 0 && (
                <span className="badge badge-xs bg-amber-500 text-white font-bold px-1">
                  {pendingChanges.size}
                </span>
              )}
            </button>
          </div>

          {/* Right Summary Pill */}
          <div className="flex items-center gap-2 text-xs text-base-content/70 shrink-0">
            <span className="font-semibold">
              Total: <span className="text-base-content font-bold">{records.length}</span>
            </span>
            <span className="text-base-content/30">|</span>
            <span>
              Filtered: <span className="text-base-content font-bold">{filteredRecords.length}</span>
            </span>
            {selectedEmpCodes.size > 0 && (
              <>
                <span className="text-base-content/30">|</span>
                <span className="text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                  {selectedEmpCodes.size} Selected
                </span>
              </>
            )}
            {pendingChanges.size > 0 && (
              <>
                <span className="text-base-content/30">|</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {pendingChanges.size} Unsaved
                </span>
              </>
            )}
          </div>
        </div>

        {/* Bulk Action Bar (Visible when rows exist) */}
        <div className="px-6 py-3 border-b border-base-300 bg-base-200/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAllFiltered}
                className="btn btn-xs bg-base-100 hover:bg-base-200 border border-base-300 text-base-content rounded-lg text-xs gap-1 font-semibold shadow-2xs"
              >
                {allFilteredSelected ? <Square size={13} /> : <CheckSquare size={13} />}
                {allFilteredSelected ? "Deselect All Filtered" : "Select All Filtered"}
              </button>
              {selectedEmpCodes.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedEmpCodes(new Set())}
                  className="btn btn-xs btn-ghost text-xs text-base-content/60 hover:text-base-content"
                >
                  Clear Selection
                </button>
              )}
            </div>

            <div className="h-4 w-px bg-base-300" />

            {/* Target Cost Center Selector */}
            <div className="relative flex items-center gap-2">
              <span className="text-xs font-bold text-base-content">
                Target Cost Center:
              </span>
              <div className="relative">
                <input
                  type="text"
                  value={costCenterSearch}
                  onFocus={() => setShowCostCenterDropdown(true)}
                  onChange={(e) => {
                    setCostCenterSearch(e.target.value);
                    setShowCostCenterDropdown(true);
                  }}
                  placeholder="Search or Select Cost Center..."
                  className="input input-xs input-bordered w-64 rounded-lg text-xs font-medium bg-base-100 border-base-300 focus:border-primary shadow-2xs"
                />
                {showCostCenterDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowCostCenterDropdown(false)}
                    />
                    <div className="absolute left-0 top-full mt-1 w-96 max-h-64 overflow-y-auto bg-base-100 rounded-xl shadow-xl border border-base-300 z-50 p-1">
                      {filteredCostCenters.length === 0 ? (
                        <div className="p-3 text-xs text-base-content/50 text-center">
                          No matching cost center found
                        </div>
                      ) : (
                        filteredCostCenters.map((cc) => (
                          <button
                            key={cc.cost_center_name + cc.cost_center_code}
                            type="button"
                            onClick={() => {
                              setBulkSelectedCostCenter(cc.cost_center_name);
                              setCostCenterSearch(cc.cost_center_name);
                              setShowCostCenterDropdown(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-base-200 flex flex-col gap-0.5 border-b border-base-200/40 last:border-none"
                          >
                            <div className="font-bold text-base-content flex items-center justify-between">
                              <span>{cc.cost_center_name}</span>
                              <span className="badge badge-xs badge-ghost font-mono">
                                {cc.dept} / {cc.shift}
                              </span>
                            </div>
                            <div className="text-[10px] text-base-content/50 flex items-center gap-2">
                              <span>Line: {cc.line_name || "-"}</span>
                              <span>Output: {cc.line_out || "-"}</span>
                              <span className="font-semibold text-primary">{cc.type}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Resolved Preview Badges */}
            {resolvedBulkTarget && (
              <div className="flex items-center gap-1.5 bg-base-100 px-2.5 py-1 rounded-lg border border-base-300 shadow-2xs text-xs">
                <span className="text-[11px] text-base-content/70 font-semibold">Auto-fill:</span>
                <span className="badge badge-xs bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold border border-blue-500/30">
                  {resolvedBulkTarget.dept}
                </span>
                <span className="badge badge-xs bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30">
                  Shift {resolvedBulkTarget.shift}
                </span>
                <span className="badge badge-xs bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold border border-purple-500/30">
                  {resolvedBulkTarget.line_name || "No Line"}
                </span>
              </div>
            )}

            {/* Apply Button */}
            <button
              type="button"
              onClick={handleApplyBulkCostCenter}
              disabled={!resolvedBulkTarget || selectedEmpCodes.size === 0}
              className="btn btn-xs btn-primary font-bold rounded-lg text-xs gap-1.5 shadow-2xs disabled:bg-base-300 disabled:text-base-content/40 disabled:border-none"
            >
              <Check size={13} />
              Apply to Selected ({selectedEmpCodes.size})
            </button>
          </div>
        </div>

        {/* Main Table Area */}
        <div className="flex-1 overflow-auto bg-base-100 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-base-content/50 gap-3">
              <RefreshCw size={28} className="animate-spin text-primary" />
              <span className="text-sm font-semibold">Loading Manpower Snapshot for {selectedDate}...</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-base-content/40 gap-3">
              <AlertCircle size={32} />
              <span className="text-sm font-bold text-base-content/70">
                {selectedDate > todayStr
                  ? "ไม่สามารถดูหรือแก้ไข Snapshot ของวันในอนาคตได้"
                  : `No snapshot records found for ${selectedDate}`}
              </span>
              <span className="text-xs max-w-md text-center">
                {selectedDate > todayStr
                  ? "ข้อมูล Manpower Snapshot จะถูกบันทึกตามวันที่มีการลงเวลาจริงเท่านั้น (ถึงปัจจุบัน)"
                  : "วันที่เลือกยังไม่มีข้อมูล Snapshot คุณสามารถนำเข้าจากไฟล์ Excel ได้ทันที"}
              </span>
              {selectedDate <= todayStr && (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading || importing}
                    className="btn btn-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg gap-1 border-none shadow-xs cursor-pointer px-3 h-7"
                  >
                    <Upload size={12} />
                    Import Excel
                  </button>
                </div>
              )}
            </div>
          ) : (
            <table className="table table-xs table-pin-rows w-full font-sans border-collapse">
              <thead>
                <tr className="bg-base-200/90 text-base-content/80 text-[11px] font-bold border-b border-base-300">
                  <th className="w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      className="checkbox checkbox-xs rounded border-base-content/30"
                    />
                  </th>
                  <th className="w-24">Emp ID</th>
                  <th className="min-w-[150px]">Employee Name</th>
                  <th className="min-w-[220px]">Cost Center (Department)</th>
                  <th className="w-20 text-center">Dept</th>
                  <th className="w-16 text-center">Shift</th>
                  <th className="w-28">Line Name</th>
                  <th className="w-28">Line Out</th>
                  <th className="w-24 text-center">Status</th>
                  <th className="w-20 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map((rec) => {
                  const isChecked = selectedEmpCodes.has(rec.employee_code);
                  return (
                    <tr
                      key={rec.employee_code}
                      className={`hover:bg-base-200/60 transition-colors border-b border-base-200/70 ${
                        rec.isModified
                          ? "bg-amber-50/70 border-l-4 border-l-amber-500"
                          : isChecked
                          ? "bg-primary/5 border-l-4 border-l-primary"
                          : ""
                      }`}
                    >
                      <td className="text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectRow(rec.employee_code)}
                          className="checkbox checkbox-xs rounded border-base-content/30"
                        />
                      </td>

                      {/* Emp Code */}
                      <td className="font-mono font-bold text-xs text-base-content">
                        {rec.employee_code}
                      </td>

                      {/* Emp Name */}
                      <td className="text-xs font-medium text-base-content/90 truncate max-w-[180px]">
                        {rec.employee_name}
                      </td>

                      {/* Cost Center / Department */}
                      <td className="text-xs">
                        <SearchableCostCenterDropdown
                          value={rec.department}
                          placeholder="Select Cost Center..."
                          costCenters={costCenters}
                          dropUp={
                            paginatedRecords.length > 8 &&
                            paginatedRecords.indexOf(rec) >= Math.max(6, paginatedRecords.length - 4)
                          }
                          onSelect={(cc) => {
                            const newMap = new Map(pendingChanges);
                            newMap.set(rec.employee_code, {
                              department: cc.cost_center_name,
                              dept: cc.dept,
                              shift: cc.shift,
                              line_name: cc.line_name,
                              line_out: cc.line_out,
                            });
                            setPendingChanges(newMap);
                            toast.success(`Updated ${rec.employee_code} to ${cc.cost_center_name}`);
                          }}
                          buttonClassName={`w-full max-w-[220px] justify-between text-xs font-bold transition-all ${
                            rec.isModified
                              ? "bg-amber-100 hover:bg-amber-200/80 border-amber-400 text-amber-950 shadow-xs ring-1 ring-amber-400/50"
                              : "bg-base-100 hover:bg-base-200 border-base-300 text-base-content"
                          }`}
                        />
                      </td>

                      {/* Dept */}
                      <td className="text-center">
                        <span className="badge badge-xs font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                          {rec.dept || "-"}
                        </span>
                      </td>

                      {/* Shift */}
                      <td className="text-center">
                        <span className="badge badge-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          {rec.shift || "-"}
                        </span>
                      </td>

                      {/* Line Name */}
                      <td className="text-xs font-medium text-base-content/80">
                        {rec.line_name || "-"}
                      </td>

                      {/* Line Out */}
                      <td className="text-xs font-mono text-base-content/60">
                        {rec.line_out || "-"}
                      </td>

                      {/* Status */}
                      <td className="text-center">
                        {rec.isModified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-white shadow-2xs">
                            <span className="w-1 h-1 rounded-full bg-white animate-ping" />
                            Pending
                          </span>
                        ) : (
                          <span className="badge badge-xs badge-ghost text-base-content/50">
                            Saved
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setQuickEditEmp(rec)}
                            className="btn btn-xs btn-ghost btn-circle text-base-content/60 hover:text-primary"
                            title="Edit Cost Center for this employee"
                          >
                            <Edit3 size={13} />
                          </button>
                          {rec.isModified && (
                            <button
                              type="button"
                              onClick={() => handleRevertRow(rec.employee_code)}
                              className="btn btn-xs btn-ghost btn-circle text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                              title="Revert to original snapshot"
                            >
                              <RotateCcw size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls */}
        <div className="px-6 py-2.5 border-t border-base-200 bg-base-100 flex items-center justify-between text-xs text-base-content/70 shrink-0">
          <div className="flex items-center gap-2">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <span className="text-base-content/30">|</span>
            <span>
              Showing {Math.min(filteredRecords.length, (currentPage - 1) * pageSize + 1)} -{" "}
              {Math.min(filteredRecords.length, currentPage * pageSize)} of {filteredRecords.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="btn btn-xs btn-ghost border border-base-300 rounded-lg gap-1 disabled:opacity-40"
            >
              <ChevronLeft size={13} />
              Prev
            </button>
            <span className="font-bold px-2">{currentPage}</span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="btn btn-xs btn-ghost border border-base-300 rounded-lg gap-1 disabled:opacity-40"
            >
              Next
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* Modal Bottom Footer / Save Bar */}
        <div className="px-6 py-4 border-t border-base-200 bg-base-200/50 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            {pendingChanges.size > 0 ? (
              <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-300 px-3.5 py-1.5 rounded-xl shadow-xs">
                <AlertCircle size={15} className="text-amber-600 shrink-0" />
                <span className="text-xs font-bold text-amber-950">
                  {pendingChanges.size} employee modification(s) ready to be saved
                </span>
                <button
                  type="button"
                  onClick={handleDiscardAll}
                  className="btn btn-xs btn-ghost text-amber-800 hover:text-amber-950 hover:bg-amber-100 rounded-lg font-semibold ml-2"
                >
                  Discard All
                </button>
              </div>
            ) : (
              <div className="text-xs text-base-content/50 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500" />
                Snapshot records are up to date
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-sm btn-ghost rounded-xl text-xs font-bold"
            >
              Close
            </button>
            <button
              type="button"
              disabled={pendingChanges.size === 0 || saving}
              onClick={handleSaveChanges}
              className="btn btn-sm btn-primary rounded-xl text-xs font-bold gap-2 shadow-sm disabled:opacity-50"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Saving Changes..." : `Save Changes (${pendingChanges.size})`}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Edit Single Employee Mini Modal */}
      {quickEditEmp && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-base-100 rounded-2xl shadow-2xl border border-base-300 w-full max-w-md p-5 flex flex-col gap-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-base-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-base-content">
                  Edit Cost Center
                </h3>
                <p className="text-xs text-base-content/60">
                  {quickEditEmp.employee_code} - {quickEditEmp.employee_name}
                </p>
              </div>
              <button
                onClick={() => setQuickEditEmp(null)}
                className="btn btn-xs btn-ghost btn-circle"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-base-content/70 block mb-1">
                  Current Department:
                </label>
                <div className="text-xs font-mono font-bold bg-base-200 px-2.5 py-1.5 rounded-lg border border-base-300">
                  {quickEditEmp.department || "None"}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-base-content/70 block mb-1">
                  Select New Cost Center:
                </label>
                <SearchableCostCenterDropdown
                  value=""
                  placeholder="-- Choose Cost Center --"
                  costCenters={costCenters}
                  onSelect={(target) => {
                    handleApplyQuickEdit(target);
                  }}
                  buttonClassName="w-full justify-between h-9 bg-base-100 border-base-300 hover:border-primary text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-base-200">
              <button
                type="button"
                onClick={() => setQuickEditEmp(null)}
                className="btn btn-xs btn-ghost text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
