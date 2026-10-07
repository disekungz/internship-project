import React, { useEffect, useState, useRef } from "react";
import { X, Search, UserMinus, Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw, ToggleLeft, ToggleRight, Calendar, Pencil, Database, UserCheck, ArrowLeft, ChevronLeft, ChevronRight, CheckSquare, FileSpreadsheet } from "lucide-react";
import Swal from "sweetalert2";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import { LoanExcludeRecord } from "../../types";
import { exportManpowerSupportToExcel } from "../../utils/exportManpowerSupportExcel";

const FormattedDateInput = ({
  value,
  onChange,
  className = "",
  placeholder = "DD/MM/YYYY",
  size = "xs",
  disabled = false,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
  size?: "xs" | "sm" | "md";
  disabled?: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const displayDate = value && dayjs(value).isValid()
    ? dayjs(value).format("DD/MM/YYYY")
    : "";

  const openPicker = () => {
    if (disabled) return;
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch (e) {}
    }
    input.click();
  };

  const heightClass =
    size === "xs"
      ? "h-6 text-xs px-2"
      : size === "sm"
        ? "h-8 text-xs px-2.5"
        : "h-10 text-sm px-3";

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={openPicker}
        className={`w-full ${heightClass} rounded-lg border border-base-300 bg-base-100 text-base-content flex items-center justify-between gap-1.5 text-left font-mono font-bold shadow-2xs hover:border-primary transition-all ${disabled ? "opacity-50 cursor-not-allowed bg-base-200" : "cursor-pointer"
          }`}
      >
        <span className={displayDate ? "text-base-content font-bold" : "text-base-content/40 font-normal"}>
          {displayDate || placeholder}
        </span>
        <Calendar size={size === "xs" ? 12 : 14} className="text-base-content/50 shrink-0" />
      </button>
      <input
        ref={inputRef}
        type="date"
        disabled={disabled}
        className="absolute inset-0 h-full w-full opacity-0 pointer-events-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
      />
    </div>
  );
};

const FACTORY_OPTIONS = ["N1", "A1", "P1", "K1", "Other"];

export const getBranchBadgeStyle = (branchName?: string | null) => {
  const b = (branchName || "").toUpperCase().trim();
  if (b.startsWith("A")) {
    return "bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-2xs font-extrabold";
  }
  if (b.startsWith("N")) {
    return "bg-blue-600 hover:bg-blue-700 text-white border-none shadow-2xs font-extrabold";
  }
  if (b.startsWith("P")) {
    return "bg-purple-600 hover:bg-purple-700 text-white border-none shadow-2xs font-extrabold";
  }
  if (b.startsWith("K")) {
    return "bg-amber-600 hover:bg-amber-700 text-white border-none shadow-2xs font-extrabold";
  }
  if (b.startsWith("B")) {
    return "bg-rose-600 hover:bg-rose-700 text-white border-none shadow-2xs font-extrabold";
  }
  if (b.includes("ลาออก") || b.includes("RESIGN") || b.includes("พ้นสภาพ")) {
    return "bg-rose-600 hover:bg-rose-700 text-white border-none shadow-2xs font-extrabold";
  }
  return "bg-slate-600 text-white border-none shadow-2xs font-extrabold";
};

export const getBranchCardStyle = (branchName?: string | null) => {
  const b = (branchName || "").toUpperCase().trim();
  if (b.startsWith("A")) {
    return {
      active: "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30 shadow-2xs",
      badge: "bg-emerald-600 text-white",
    };
  }
  if (b.startsWith("N")) {
    return {
      active: "bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/30 shadow-2xs",
      badge: "bg-blue-600 text-white",
    };
  }
  if (b.startsWith("P")) {
    return {
      active: "bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500/30 shadow-2xs",
      badge: "bg-purple-600 text-white",
    };
  }
  if (b.startsWith("K")) {
    return {
      active: "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30 shadow-2xs",
      badge: "bg-amber-600 text-white",
    };
  }
  return {
    active: "bg-slate-500/15 border-slate-500/40 text-slate-700 dark:text-slate-300 ring-1 ring-slate-500/30 shadow-2xs",
    badge: "bg-slate-600 text-white",
  };
};

type AttendanceLoanEmp = {
  employee_id: string;
  work_day_status: string;
  employee_name: string;
  department: string;
  alreadyExists: boolean;
  isActive: boolean;
  existingDestination?: string | null;
  assignedDestination: string; // "P1" | "A1" | "K1" | "N1" | "ช่วยงานสาขาอื่น" | custom
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void; // Callback to reload main report if needed
  selectedDate?: string; // Currently active date in report
};

import { getApiBaseUrl } from "../../../../../utils/apiConfig";

const API_BASE_URL = getApiBaseUrl();

export const ManpowerLoanModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, selectedDate }) => {
  const [records, setRecords] = useState<LoanExcludeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // Attendance Check States
  const [checkDate, setCheckDate] = useState<string>("");
  const [isCheckingAttendance, setIsCheckingAttendance] = useState(false);
  const [showAttendanceCheckModal, setShowAttendanceCheckModal] = useState(false);
  const [attendanceLoanEmps, setAttendanceLoanEmps] = useState<AttendanceLoanEmp[]>([]);
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(new Set());
  const [isSyncingAttendance, setIsSyncingAttendance] = useState(false);

  // Factory Selection & Multi-Step Review States
  const [globalDefaultFactory, setGlobalDefaultFactory] = useState<string>("N1");
  const [subModalStep, setSubModalStep] = useState<"select" | "confirm">("select");
  const [syncStartDate, setSyncStartDate] = useState<string>("");
  const [syncEndDate, setSyncEndDate] = useState<string>("");

  // Master Table Bulk Actions State
  const [selectedSavedIds, setSelectedSavedIds] = useState<Set<number>>(new Set());
  const [isBatchEditMode, setIsBatchEditMode] = useState(false);
  const [bulkMasterFactory, setBulkMasterFactory] = useState<string>("");
  const [bulkMasterStartDate, setBulkMasterStartDate] = useState<string>("");
  const [bulkMasterEndDate, setBulkMasterEndDate] = useState<string>("");

  // Status filter for table: 'all' | 'active' | 'expired'
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired">("all");

  // Form States & Panel Expand/Collapse State
  const [isFormPanelOpen, setIsFormPanelOpen] = useState(true);
  const [empCode, setEmpCode] = useState("");
  const [empName, setEmpName] = useState("");
  const [empDept, setEmpDept] = useState("");
  const [destination, setDestination] = useState("N1");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCheckingEmp, setIsCheckingEmp] = useState(false);
  const [empChecked, setEmpChecked] = useState<"found" | "not_found" | "idle">("idle");
  const [editId, setEditId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchRecords();
      resetForm();
      const today = dayjs().format("YYYY-MM-DD");
      const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
      let initialDate = selectedDate ? dayjs(selectedDate).format("YYYY-MM-DD") : yesterday;
      if (!initialDate || initialDate > today) {
        initialDate = yesterday;
      }
      setCheckDate(initialDate);
      setSyncStartDate(initialDate);
      setSyncEndDate(initialDate);
    }
  }, [isOpen, selectedDate]);

  // Auto pre-populate bulk fields (start_date, end_date, destination) when selecting records
  useEffect(() => {
    if (selectedSavedIds.size === 0) {
      setBulkMasterFactory("");
      setBulkMasterStartDate("");
      setBulkMasterEndDate("");
      return;
    }

    const selectedRecs = records.filter(r => selectedSavedIds.has(r.id));
    if (selectedRecs.length > 0) {
      // 1. Start Date: If selected records share a start date, prefill it
      const startDates = selectedRecs.map(r => (r.start_date ? dayjs(r.start_date).format("YYYY-MM-DD") : "")).filter(Boolean);
      if (startDates.length > 0) {
        const firstStart = startDates[0];
        const allSameStart = startDates.every(d => d === firstStart);
        if (allSameStart) {
          setBulkMasterStartDate(firstStart);
        }
      }

      // 2. End Date: If selected records share an end date, prefill it
      const endDates = selectedRecs.map(r => (r.end_date ? dayjs(r.end_date).format("YYYY-MM-DD") : "")).filter(Boolean);
      if (endDates.length > 0 && endDates.length === selectedRecs.length) {
        const firstEnd = endDates[0];
        const allSameEnd = endDates.every(d => d === firstEnd);
        if (allSameEnd) {
          setBulkMasterEndDate(firstEnd);
        }
      } else {
        setBulkMasterEndDate("");
      }

      // 3. Destination: If selected records share a destination, prefill it
      const dests = selectedRecs.map(r => r.destination).filter(Boolean);
      if (dests.length > 0) {
        const firstDest = dests[0];
        const allSameDest = dests.every(d => d === firstDest);
        if (allSameDest) {
          setBulkMasterFactory(firstDest);
        }
      }
    }
  }, [selectedSavedIds, records]);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/productivity/attendance/loan-exclude`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.data || []);
      }
    } catch (err) {
      console.error("Failed to load loan exclude records:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportMasterExcel = async () => {
    if (records.length === 0) {
      Swal.fire({
        icon: "info",
        title: "ไม่มีข้อมูลสำหรับส่งออก",
        text: "ไม่พบรายชื่อพนักงานช่วยงานในระบบ",
        confirmButtonColor: "#3B82F6",
      });
      return;
    }

    try {
      setIsExportingExcel(true);
      await exportManpowerSupportToExcel(records);
      toast.success(`ส่งออกข้อมูลสำเร็จ (${records.length} รายการ)`, { duration: 2500 });
    } catch (error) {
      console.error("Export Manpower Support Excel error:", error);
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาดในการส่งออกไฟล์ Excel",
        text: error instanceof Error ? error.message : "โปรดลองใหม่อีกครั้ง",
        confirmButtonColor: "#EF4444",
      });
    } finally {
      setIsExportingExcel(false);
    }
  };



  const handleBulkUpdateMasterRecords = async () => {
    if (selectedSavedIds.size === 0) return;
    if (!bulkMasterFactory && !bulkMasterStartDate && !bulkMasterEndDate) {
      Swal.fire({
        icon: "warning",
        title: "กรุณาเลือกสาขาหรือระบุวันที่ที่ต้องการอัปเดต",
        confirmButtonColor: "#3B82F6",
      });
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/productivity/attendance/loan-exclude/bulk-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedSavedIds),
          destination: bulkMasterFactory || undefined,
          start_date: bulkMasterStartDate || undefined,
          end_date: bulkMasterEndDate || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        Swal.fire({
          icon: "success",
          title: "อัปเดตข้อมูลแบบกลุ่มสำเร็จ",
          text: data.message,
          timer: 1500,
          showConfirmButton: false,
        });
        setSelectedSavedIds(new Set());
        setBulkMasterFactory("");
        setBulkMasterStartDate("");
        setBulkMasterEndDate("");
        fetchRecords();
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      console.error("Bulk update master records error:", err);
    }
  };

  const handleBulkDeleteMasterRecords = async () => {
    if (selectedSavedIds.size === 0) return;

    const confirm = await Swal.fire({
      title: `ยืนยันการลบ ${selectedSavedIds.size} รายการ?`,
      text: "การลบรายการที่เลือกจะมีผลทันทีและไม่สามารถกู้คืนได้",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EF4444",
      cancelButtonColor: "#6B7280",
      confirmButtonText: "ยืนยันลบรายการที่เลือก",
      cancelButtonText: "ยกเลิก",
    });

    if (confirm.isConfirmed) {
      try {
        const res = await fetch(`${API_BASE_URL}/productivity/attendance/loan-exclude/bulk-delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ids: Array.from(selectedSavedIds),
          }),
        });

        if (res.ok) {
          Swal.fire({
            icon: "success",
            title: "ลบรายการเรียบร้อยแล้ว",
            timer: 1500,
            showConfirmButton: false,
          });
          setSelectedSavedIds(new Set());
          fetchRecords();
          if (onSuccess) onSuccess();
        }
      } catch (err) {
        console.error("Bulk delete master records error:", err);
      }
    }
  };

  const resetForm = () => {
    setEmpCode("");
    setEmpName("");
    setEmpDept("");
    setDestination("N1");
    setStartDate("");
    setEndDate("");
    setEmpChecked("idle");
    setEditId(null);
  };

  const handleCheckAttendance = async (targetDate?: string) => {
    const queryDate = targetDate || checkDate || dayjs().format("YYYY-MM-DD");
    setIsCheckingAttendance(true);
    setSyncStartDate(queryDate);
    setSyncEndDate(queryDate);

    try {
      const res = await fetch(`${API_BASE_URL}/productivity/attendance/check-loaned-from-attendance?date=${queryDate}`);
      if (res.ok) {
        const data = await res.json();
        const rawEmps: any[] = data.employees || [];
        const emps: AttendanceLoanEmp[] = rawEmps.map((e) => ({
          ...e,
          assignedDestination: e.existingDestination || globalDefaultFactory || "N1",
          startDate: queryDate,
          endDate: queryDate,
        }));
        setAttendanceLoanEmps(emps);
        // By default select only employees NOT yet in the table
        const newIds = new Set<string>(emps.filter((e) => !e.alreadyExists).map((e) => e.employee_id));
        setSelectedEmpIds(newIds);
        setSubModalStep("select");
        setShowAttendanceCheckModal(true);
      } else {
        Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถดึงข้อมูลการรูดบัตรจาก Attendance ได้", "error");
      }
    } catch (err) {
      console.error("Failed to check attendance for loaned employees:", err);
      Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้", "error");
    } finally {
      setIsCheckingAttendance(false);
    }
  };

  const toggleSelectAll = () => {
    const selectableEmps = attendanceLoanEmps.filter((e) => !e.alreadyExists);
    if (selectedEmpIds.size === selectableEmps.length) {
      setSelectedEmpIds(new Set());
    } else {
      setSelectedEmpIds(new Set(selectableEmps.map((e) => e.employee_id)));
    }
  };

  const toggleSelectEmp = (empId: string) => {
    const emp = attendanceLoanEmps.find((e) => e.employee_id === empId);
    if (emp?.alreadyExists) return; // Locked: cannot select or edit existing record

    const newSet = new Set(selectedEmpIds);
    if (newSet.has(empId)) {
      newSet.delete(empId);
    } else {
      newSet.add(empId);
    }
    setSelectedEmpIds(newSet);
  };

  const handleClearAllSelections = () => {
    setSelectedEmpIds(new Set());
  };

  const handleClearDropdowns = () => {
    setGlobalDefaultFactory("N1");
    setAttendanceLoanEmps((prev) =>
      prev.map((e) =>
        !e.alreadyExists && (selectedEmpIds.size === 0 || selectedEmpIds.has(e.employee_id))
          ? { ...e, assignedDestination: "N1" }
          : e
      )
    );
  };

  const handleApplyBulkSettingsToSelected = (factory: string, sDate: string, eDate: string) => {
    setGlobalDefaultFactory(factory);
    setAttendanceLoanEmps((prev) =>
      prev.map((e) =>
        !e.alreadyExists && selectedEmpIds.has(e.employee_id)
          ? { ...e, assignedDestination: factory, startDate: sDate, endDate: eDate }
          : e
      )
    );
  };

  const handleRowFactoryChange = (empId: string, factory: string) => {
    setAttendanceLoanEmps((prev) =>
      prev.map((e) => (e.employee_id === empId ? { ...e, assignedDestination: factory } : e))
    );
  };

  const handleRowDateChange = (empId: string, field: "startDate" | "endDate", value: string) => {
    setAttendanceLoanEmps((prev) =>
      prev.map((e) => (e.employee_id === empId ? { ...e, [field]: value } : e))
    );
  };

  const handleSyncSelectedAttendanceEmps = async () => {
    if (selectedEmpIds.size === 0) return;

    const toSync = attendanceLoanEmps
      .filter((e) => selectedEmpIds.has(e.employee_id))
      .map((e) => ({
        ...e,
        destination: e.assignedDestination || globalDefaultFactory || "N1",
        start_date: e.startDate || syncStartDate || null,
        end_date: e.endDate || syncEndDate || null,
      }));

    setIsSyncingAttendance(true);

    try {
      const res = await fetch(`${API_BASE_URL}/productivity/attendance/sync-loaned-from-attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employees: toSync,
          defaultDestination: globalDefaultFactory,
          startDate: syncStartDate || null,
          endDate: syncEndDate || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        // Calculate breakdown summary text
        const breakdown = data.factoryBreakdown || {};
        const breakdownText = Object.entries(breakdown)
          .map(([fac, count]) => `<b>${fac}</b>: ${count} คน`)
          .join(", ");

        Swal.fire({
          icon: "success",
          title: "บันทึกนำเข้าข้อมูลเรียบร้อยแล้ว",
          html: `
            <div class="text-xs space-y-2 text-left bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2 text-slate-700">
              <p><strong class="text-emerald-700">✓ บันทึกสำเร็จทั้งหมด:</strong> ${data.totalSynced || toSync.length} รายการ</p>
              <p class="text-[11px] text-slate-500">(เพิ่มใหม่ ${data.addedCount || 0} รายการ, อัปเดต ${data.updatedCount || 0} รายการ)</p>
              ${breakdownText ? `<div class="text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 p-2 rounded mt-1">สรุปจำนวนแยกตามสาขา: ${breakdownText}</div>` : ""}
            </div>
          `,
          confirmButtonColor: "#3B82F6",
        });

        setShowAttendanceCheckModal(false);
        setSubModalStep("select");
        fetchRecords();
        try {
          onSuccess();
        } catch (e) {
          console.error("onSuccess callback error:", e);
        }
      } else {
        const data = await res.json();
        Swal.fire("เกิดข้อผิดพลาด", data.error || "ไม่สามารถนำเข้าข้อมูลได้", "error");
      }
    } catch (err) {
      console.error("Failed to sync attendance employees:", err);
      Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", "error");
    } finally {
      setIsSyncingAttendance(false);
    }
  };

  const handleCheckEmployee = async () => {
    const code = empCode.trim();
    if (!code) return;

    setIsCheckingEmp(true);
    setEmpChecked("idle");
    try {
      const res = await fetch(`${API_BASE_URL}/productivity/attendance/employee-check/${code}`);
      if (res.ok) {
        const data = await res.json();
        if (data.found && data.employee) {
          setEmpName(data.employee.name);
          setEmpDept(data.employee.department);
          setEmpChecked("found");
        } else {
          setEmpName("");
          setEmpDept("");
          setEmpChecked("not_found");
          Swal.fire({
            icon: "warning",
            title: "ไม่พบข้อมูลพนักงาน",
            text: `ไม่พบรหัสพนักงาน ${code} ในฐานข้อมูลหลัก แต่อย่างไรก็ตามคุณยังสามารถพิมพ์ชื่อเพื่อบันทึกแบบ Override ได้`,
            confirmButtonColor: "#3B82F6",
          });
        }
      }
    } catch (err) {
      console.error("Failed to check employee:", err);
    } finally {
      setIsCheckingEmp(false);
    }
  };

  const handleStartEdit = (rec: LoanExcludeRecord) => {
    setEditId(rec.id);
    setEmpCode(rec.employee_id);
    setEmpName(rec.employee_name || "");
    setEmpDept(rec.department || "");
    setDestination(rec.destination || "N1");
    setStartDate(rec.start_date ? dayjs(rec.start_date).format("YYYY-MM-DD") : "");
    setEndDate(rec.end_date ? dayjs(rec.end_date).format("YYYY-MM-DD") : "");
    setEmpChecked("found");
  };

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = empCode.trim();
    if (!code) {
      Swal.fire("กรุณากรอกรหัสพนักงาน", "", "warning");
      return;
    }

    const isEdit = editId !== null;
    const url = isEdit
      ? `${API_BASE_URL}/productivity/attendance/loan-exclude/${editId}`
      : `${API_BASE_URL}/productivity/attendance/loan-exclude`;
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: code,
          employee_name: empName.trim(),
          department: empDept.trim(),
          destination: destination.trim(),
          start_date: startDate || null,
          end_date: endDate || null,
          created_by: "Admin",
        }),
      });

      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: isEdit ? "แก้ไขข้อมูลสำเร็จ" : "บันทึกข้อมูลสำเร็จ",
          showConfirmButton: false,
          timer: 1500,
        });
        resetForm();
        fetchRecords();
        try {
          onSuccess(); // Trigger report reload safely
        } catch (e) {
          console.error("onSuccess callback error:", e);
        }
      } else {
        const data = await res.json();
        Swal.fire("เกิดข้อผิดพลาด", data.error || "ไม่สามารถบันทึกข้อมูลได้", "error");
      }
    } catch (err) {
      console.error("Failed to save record:", err);
      Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", "error");
    }
  };

  const handleToggleActive = async (id: number, currentStatus: boolean) => {
    try {
      const res = await fetch(`${API_BASE_URL}/productivity/attendance/loan-exclude/${id}/toggle`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (res.ok) {
        fetchRecords();
        onSuccess();
      } else {
        Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถอัปเดตสถานะได้", "error");
      }
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  };

  const handleDeleteRecord = async (id: number, code: string) => {
    const result = await Swal.fire({
      title: "ยืนยันการลบ?",
      text: `คุณต้องการลบรายชื่อพนักงานรหัส ${code} ออกจากตารางช่วยงานนอกสถานที่ใช่หรือไม่?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EF4444",
      cancelButtonColor: "#6B7280",
      confirmButtonText: "ใช่, ลบเลย",
      cancelButtonText: "ยกเลิก",
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`${API_BASE_URL}/productivity/attendance/loan-exclude/${id}`, {
          method: "DELETE",
        });

        if (res.ok) {
          Swal.fire({
            icon: "success",
            title: "ลบข้อมูลสำเร็จ",
            showConfirmButton: false,
            timer: 1200,
          });
          fetchRecords();
          onSuccess();
        } else {
          Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถลบข้อมูลได้", "error");
        }
      } catch (err) {
        console.error("Failed to delete record:", err);
      }
    }
  };

  if (!isOpen) return null;

  const filteredRecords = records.filter((rec) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      rec.employee_id.toLowerCase().includes(q) ||
      rec.employee_name.toLowerCase().includes(q) ||
      (rec.department && rec.department.toLowerCase().includes(q)) ||
      (rec.destination && rec.destination.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60">
      <div className="bg-base-100 rounded-2xl shadow-2xl border border-base-300 w-full max-w-[96vw] xl:max-w-7xl h-[90vh] flex flex-col overflow-hidden text-base-content">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-base-300 flex items-center justify-between bg-base-200/50">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-base-content">
              จัดการพนักงานไปช่วยงานต่างสาขา (Manpower Support Management)
            </h2>
            <p className="text-xs text-base-content/70 mt-0.5">
              รายชื่อพนักงานในตารางนี้จะไม่ถูกนับรวมในจำนวนคนเข้าทำงาน (Headcount) ของแต่ละไลน์ แต่จะยังแสดงสถานะช่วยงานในหน้ารายชื่อการรูดบัตร
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-sm btn-ghost btn-circle text-base-content/70 hover:text-base-content hover:bg-base-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden p-5 flex flex-col lg:flex-row gap-6">
          {/* Left Form Panel: Animated slide open/close */}
          <div
            className={`hidden lg:flex shrink-0 relative overflow-hidden transition-all duration-300 ease-in-out ${
              isFormPanelOpen ? "w-[300px]" : "w-10"
            }`}
          >
            {/* Collapsed strip - visible when closed */}
            <div
              className={`absolute inset-0 flex flex-col items-center transition-opacity duration-200 ${
                isFormPanelOpen ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
              }`}
            >
              <button
                type="button"
                onClick={() => setIsFormPanelOpen(true)}
                className="rounded-xl font-bold h-full w-full py-4 shadow-sm hover:shadow-md active:scale-95 transition-all flex flex-col justify-start items-center bg-white border border-base-content text-base-content hover:bg-base-100"
                title="ขยาย/เปิดฟอร์มเพิ่มพนักงาน"
              >
                <ChevronRight size={18} className="text-base-content" />
                <span className="[writing-mode:vertical-lr] tracking-wider text-xs font-bold my-2 text-base-content select-none">
                  เปิดฟอร์มเพิ่มข้อมูล
                </span>
                <Plus size={16} className="text-base-content" />
              </button>
            </div>

            {/* Expanded form - visible when open */}
            <div
              className={`w-[300px] flex flex-col gap-4 bg-base-200/40 p-4 rounded-xl border border-base-300 overflow-y-auto transition-opacity duration-200 ${
                isFormPanelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
              }`}
            >
              <div className="flex items-center justify-between border-b border-base-300 pb-2 shrink-0">
                <h3 className="font-bold text-sm text-base-content flex items-center gap-1.5">
                  {editId ? (
                    <>
                      <Pencil size={16} className="text-warning" />
                      <span className="text-warning font-bold">แก้ไขข้อมูลช่วยงาน</span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} className="text-primary" />
                      <span className="font-bold">เพิ่มพนักงานช่วยงานต่างสาขา</span>
                    </>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsFormPanelOpen(false)}
                  className="btn btn-xs btn-circle btn-ghost text-base-content/60 hover:text-base-content"
                  title="ซ่อน/หดฟอร์มเพิ่มข้อมูล"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>

              <form onSubmit={handleAddRecord} className="space-y-3 text-xs flex-1">
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text font-bold">รหัสพนักงาน *</span>
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      className="input input-sm input-bordered w-full rounded-lg font-mono font-bold"
                      placeholder="ระบุรหัสพนักงาน"
                      value={empCode}
                      onChange={(e) => {
                        setEmpCode(e.target.value);
                        if (empChecked !== "idle") setEmpChecked("idle");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCheckEmployee();
                        }
                      }}
                      required
                    />
                    <button
                      type="button"
                      className={`btn btn-sm px-2.5 rounded-lg font-bold shrink-0 ${isCheckingEmp ? "loading btn-disabled" : "btn-primary btn-outline"}`}
                      onClick={handleCheckEmployee}
                    >
                      ตรวจสอบ
                    </button>
                  </div>
                  {empChecked === "found" && (
                    <span className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                      <CheckCircle2 size={10} /> พบข้อมูลในระบบหลัก
                    </span>
                  )}
                  {empChecked === "not_found" && (
                    <span className="text-[10px] text-amber-600 font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle size={10} /> ไม่พบในระบบ (ระบุชื่อแมนนวล)
                    </span>
                  )}
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text font-bold">ชื่อ-นามสกุล</span>
                  </label>
                  <input
                    type="text"
                    className="input input-sm input-bordered w-full rounded-lg"
                    placeholder="ระบุชื่อพนักงาน"
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                  />
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text font-bold">แผนก / Cost Center</span>
                  </label>
                  <input
                    type="text"
                    className="input input-sm input-bordered w-full rounded-lg"
                    placeholder="ระบุแผนก"
                    value={empDept}
                    onChange={(e) => setEmpDept(e.target.value)}
                  />
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text font-bold">สถานที่/สาขาที่ไปช่วยงาน *</span>
                  </label>
                  <select
                    className="select select-sm select-bordered w-full rounded-lg font-bold text-primary"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    required
                  >
                    {FACTORY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text font-bold">วันเริ่มต้น (Start Date)</span>
                  </label>
                  <FormattedDateInput
                    value={startDate}
                    onChange={setStartDate}
                    size="sm"
                    className="w-full"
                  />
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text font-bold">วันสิ้นสุด (End Date)</span>
                  </label>
                  <FormattedDateInput
                    value={endDate}
                    onChange={setEndDate}
                    size="sm"
                    className="w-full"
                  />
                </div>

                <div className="pt-2 flex flex-col gap-1.5">
                  <button
                    type="submit"
                    className={`btn btn-sm w-full rounded-lg font-bold gap-1.5 shadow-lg ${
                      editId ? "btn-warning text-warning-content shadow-warning/20" : "btn-primary shadow-primary/20"
                    }`}
                  >
                    {editId ? <Pencil size={14} /> : <Plus size={14} />}
                    {editId ? "อัปเดตข้อมูลช่วยงาน" : "บันทึกข้อมูลช่วยงาน"}
                  </button>
                  {editId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="btn btn-sm btn-outline btn-ghost w-full rounded-lg font-bold text-xs"
                    >
                      ยกเลิกการแก้ไข
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Right Table Panel: List of Excluded Employees */}
          <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-hidden">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="badge badge-primary font-bold text-xs px-3 py-2 h-auto">
                  รายชื่อทั้งหมด: {records.length} รายการ
                </span>
                {/* Status Filter Tabs */}
                <div className="flex items-center gap-1 bg-base-200 rounded-lg p-0.5 border border-base-300">
                  {(["all", "active", "expired"] as const).map((tab) => {
                    const today = dayjs().startOf("day");
                    const activeCount = records.filter(r => !r.end_date || dayjs(r.end_date).isSame(today) || dayjs(r.end_date).isAfter(today)).length;
                    const expiredCount = records.filter(r => r.end_date && dayjs(r.end_date).isBefore(today)).length;
                    const count = tab === "all" ? records.length : tab === "active" ? activeCount : expiredCount;
                    const label = tab === "all" ? "ทั้งหมด" : tab === "active" ? "กำลังช่วยงาน" : "ครบกำหนดแล้ว";
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setStatusFilter(tab)}
                        className={`btn btn-xs rounded-md font-bold gap-1 transition-all ${
                          statusFilter === tab
                            ? tab === "expired"
                              ? "btn-neutral text-neutral-content"
                              : tab === "active"
                              ? "bg-emerald-600 text-white border-none hover:bg-emerald-700"
                              : "btn-primary text-primary-content"
                            : "btn-ghost text-base-content/60 hover:text-base-content"
                        }`}
                      >
                        <span>{label}</span>
                        <span className={`badge badge-xs font-mono px-1 ${
                          statusFilter === tab ? "badge-outline opacity-80" : "badge-neutral opacity-60"
                        }`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => handleCheckAttendance(checkDate)}
                  disabled={isCheckingAttendance}
                  className="btn btn-sm btn-primary text-primary-content rounded-lg font-bold gap-1.5 shadow-sm"
                  title="เช็คคนไปช่วยงานจากฐานข้อมูล Attendance (สแกนรหัส work_day_status นอกเหนือจาก W, H, O)"
                >
                  {isCheckingAttendance ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Database size={14} />
                  )}
                  <span>เช็คคนช่วยงานจาก Database</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsBatchEditMode(!isBatchEditMode);
                    if (isBatchEditMode) setSelectedSavedIds(new Set());
                  }}
                  className={`btn btn-sm rounded-lg font-bold gap-1.5 transition-all ${isBatchEditMode
                      ? "btn-warning text-warning-content shadow-sm"
                      : "btn-outline border-base-300 text-base-content hover:bg-base-200"
                    }`}
                  title="เปิด/ปิด โหมดติ๊กเลือกแก้ไขพร้อมกันหลายรายการ"
                >
                  <CheckSquare size={14} />
                  <span>{isBatchEditMode ? "ปิดโหมดเลือกหลายคน" : "เลือกหลายคนเพื่อแก้ไข"}</span>
                  {selectedSavedIds.size > 0 && (
                    <span className="badge badge-xs badge-neutral font-mono font-bold px-1.5 py-0.5">
                      {selectedSavedIds.size}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleExportMasterExcel}
                  disabled={records.length === 0 || isExportingExcel}
                  className="btn btn-sm btn-outline border-emerald-600/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg font-bold gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-40"
                  title="ส่งออกรายชื่อพนักงานช่วยงานทั้งหมดเป็นไฟล์ Excel"
                >
                  {isExportingExcel ? (
                    <RefreshCw size={14} className="animate-spin text-emerald-600" />
                  ) : (
                    <FileSpreadsheet size={14} className="text-emerald-600" />
                  )}
                  <span>{isExportingExcel ? "กำลังส่งออก..." : "Export Excel"}</span>
                </button>
              </div>

              <div className="relative w-full sm:w-64 md:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                <input
                  type="search"
                  className="input input-sm input-bordered w-full pl-8 pr-8 rounded-xl text-xs bg-base-100 text-base-content placeholder:text-base-content/40 focus:ring-2 focus:ring-primary/20 shadow-2xs font-medium"
                  placeholder="ค้นหารหัส, ชื่อ หรือหน่วยงาน..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content p-0.5 rounded-full"
                    title="ล้างคำค้นหา"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Master Table Bulk Actions Toolbar */}
            {isBatchEditMode && (
              <div className="bg-base-200 border border-base-300 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-primary">
                    <CheckSquare size={15} />
                    <span>เลือกอยู่ {selectedSavedIds.size} / {filteredRecords.length} รายการ</span>
                  </div>
                  {selectedSavedIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedSavedIds(new Set())}
                      className="btn btn-xs btn-ghost text-base-content/60 hover:text-error"
                    >
                      ล้างที่เลือก
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-base-100 px-2 py-1 rounded-lg border border-base-300">
                    <span className="font-semibold text-base-content/70">สาขา:</span>
                    <select
                      value={bulkMasterFactory}
                      onChange={(e) => setBulkMasterFactory(e.target.value)}
                      className="select select-xs select-ghost font-bold text-primary focus:bg-transparent"
                    >
                      <option value="">-- ไม่เปลี่ยนสาขา --</option>
                      <option value="N1">N1</option>
                      <option value="A1">A1</option>
                      <option value="P1">P1</option>
                      <option value="K1">K1</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 bg-base-100 px-2 py-1 rounded-lg border border-base-300">
                    <span className="font-semibold text-base-content/70">เริ่ม:</span>
                    <FormattedDateInput
                      value={bulkMasterStartDate}
                      onChange={setBulkMasterStartDate}
                      size="xs"
                      className="w-28"
                    />
                    <span className="font-semibold text-base-content/70">ถึง:</span>
                    <FormattedDateInput
                      value={bulkMasterEndDate}
                      onChange={setBulkMasterEndDate}
                      size="xs"
                      className="w-28"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleBulkUpdateMasterRecords}
                    disabled={selectedSavedIds.size === 0}
                    className="btn btn-xs btn-primary text-primary-content font-bold gap-1 shadow-sm disabled:opacity-40"
                  >
                    <CheckCircle2 size={13} />
                    <span>บันทึกทั้งหมด ({selectedSavedIds.size})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBulkDeleteMasterRecords}
                    disabled={selectedSavedIds.size === 0}
                    className="btn btn-xs btn-error text-error-content font-bold gap-1 shadow-sm disabled:opacity-40"
                  >
                    <Trash2 size={13} />
                    <span>ลบ ({selectedSavedIds.size})</span>
                  </button>
                </div>
              </div>
            )}

            {(() => {
              const today = dayjs().startOf("day");
              const isExpired = (rec: LoanExcludeRecord) =>
                !!rec.end_date && dayjs(rec.end_date).isBefore(today);
              const filteredRecords = records.filter((rec) => {
                const matchStatus =
                  statusFilter === "all"
                    ? true
                    : statusFilter === "expired"
                    ? isExpired(rec)
                    : !isExpired(rec);
                const matchSearch =
                  !searchQuery ||
                  rec.employee_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  rec.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  rec.department?.toLowerCase().includes(searchQuery.toLowerCase());
                return matchStatus && matchSearch;
              });
              return (
            <div className="flex-1 overflow-y-auto border border-base-300 rounded-2xl min-h-[350px] bg-base-100 shadow-2xs">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center p-12 text-base-content/50 gap-2 h-full">
                  <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                  <span className="text-xs font-bold">กำลังโหลดข้อมูล...</span>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-base-content/50 gap-2 text-center h-full">
                  <AlertCircle className="w-12 h-12 text-base-content/30" />
                  <span className="text-sm font-bold text-base-content">ไม่พบรายการพนักงานช่วยงาน</span>
                  <span className="text-xs text-base-content/60">
                    {searchQuery
                      ? "ลองเปลี่ยนคำค้นหาใหม่"
                      : statusFilter !== "all"
                      ? "ไม่มีรายการในหมวดนี้"
                      : "เพิ่มพนักงานจากฟอร์มด้านซ้าย หรือคลิกเช็คจาก Database"}
                  </span>
                </div>
              ) : (
                <div className="overflow-x-auto min-w-0 w-full">
                  <table className="table table-sm table-zebra w-full text-xs">
                    <thead>
                      <tr className="bg-base-200/80 text-base-content font-bold border-b border-base-300 sticky top-0 z-10">
                        {isBatchEditMode && (
                          <th className="w-8 text-center px-2 py-2.5">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-xs checkbox-primary"
                              checked={
                                filteredRecords.length > 0 &&
                                filteredRecords.every((r) => selectedSavedIds.has(r.id))
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSavedIds(new Set(filteredRecords.map((r) => r.id)));
                                } else {
                                  setSelectedSavedIds(new Set());
                                }
                              }}
                            />
                          </th>
                        )}
                        <th className="w-8 whitespace-nowrap px-3 py-2.5 text-center font-bold text-base-content/60">#</th>
                        <th className="w-20 whitespace-nowrap px-3 py-2.5 font-bold text-base-content">รหัส</th>
                        <th className="px-3 py-2.5 font-bold text-base-content">ชื่อ-นามสกุล</th>
                        <th className="px-3 py-2.5 font-bold text-base-content">แผนก</th>
                        <th className="w-16 whitespace-nowrap px-2 py-2.5 text-center font-bold text-base-content">ที่</th>
                        <th className="w-44 whitespace-nowrap px-3 py-2.5 text-center font-bold text-base-content">ระยะเวลา</th>
                        <th className="w-28 whitespace-nowrap px-3 py-2.5 text-center font-bold text-base-content">สถานะ</th>
                        <th className="text-center w-20 whitespace-nowrap px-2 py-2.5 font-bold text-base-content">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((rec, idx) => {
                        const expired = isExpired(rec);
                        return (
                        <tr
                          key={rec.id}
                          className={`transition-colors ${
                            selectedSavedIds.has(rec.id)
                              ? "bg-primary/15"
                              : expired
                              ? "opacity-50 hover:opacity-80"
                              : "hover:bg-primary/10"
                          }`}
                        >
                          {isBatchEditMode && (
                            <td className="text-center px-2 py-2">
                              <input
                                type="checkbox"
                                className="checkbox checkbox-xs checkbox-primary"
                                checked={selectedSavedIds.has(rec.id)}
                                onChange={(e) => {
                                  const next = new Set(selectedSavedIds);
                                  if (e.target.checked) {
                                    next.add(rec.id);
                                  } else {
                                    next.delete(rec.id);
                                  }
                                  setSelectedSavedIds(next);
                                }}
                              />
                            </td>
                          )}
                          <td className="font-mono text-base-content/50 whitespace-nowrap px-2 py-2 text-center text-[11px] font-bold">{idx + 1}</td>
                          <td className={`font-mono font-bold whitespace-nowrap px-2 py-2 text-xs ${expired ? "text-base-content/40 line-through" : "text-primary"}`}>
                            {rec.employee_id}
                          </td>
                          <td
                            className={`font-bold truncate max-w-[130px] xl:max-w-[160px] px-2 py-2 text-xs whitespace-nowrap ${
                              expired ? "text-base-content/40 line-through" : "text-base-content"
                            }`}
                            title={rec.employee_name}
                          >
                            {rec.employee_name || "-"}
                          </td>
                          <td className="text-base-content/80 font-medium truncate max-w-[100px] xl:max-w-[130px] px-2 py-2 text-xs whitespace-nowrap" title={rec.department}>
                            {rec.department || "-"}
                          </td>
                          <td className="w-24 whitespace-nowrap px-2 py-2 text-center" title={rec.destination}>
                            <span className={`badge font-bold text-xs px-2.5 py-0.5 whitespace-nowrap ${
                              expired ? "bg-base-300 text-base-content/40 border-none" : getBranchBadgeStyle(rec.destination)
                            }`}>
                              {rec.destination || "ช่วยงานสาขาอื่น"}
                            </span>
                          </td>
                          <td className="font-mono text-xs whitespace-nowrap px-2 py-2 text-center">
                            {rec.start_date || rec.end_date ? (
                              <div className={`flex items-center justify-center gap-1.5 text-xs whitespace-nowrap font-bold ${
                                expired ? "text-base-content/40" : "text-base-content"
                              }`}>
                                <Calendar size={13} className="text-base-content/50 shrink-0" />
                                <span>
                                  {rec.start_date ? dayjs(rec.start_date).format("DD/MM/YYYY") : "—"} -{" "}
                                  {rec.end_date ? dayjs(rec.end_date).format("DD/MM/YYYY") : "ไม่มีกำหนด"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-base-content/40 italic whitespace-nowrap text-[11px]">ไม่มีกำหนด</span>
                            )}
                          </td>
                          <td className="w-24 whitespace-nowrap px-2 py-2 text-center">
                            {expired ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-base-content/40 bg-base-200 border border-base-300 rounded-full px-2 py-0.5 whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-base-content/30 shrink-0" />
                                ครบกำหนดแล้ว
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5 whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                                กำลังช่วยงาน
                              </span>
                            )}
                          </td>
                          <td className="text-center px-3 py-2">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(rec)}
                                className="btn btn-sm btn-square btn-ghost text-warning hover:bg-warning/10"
                                title="แก้ไขรายการ"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRecord(rec.id, rec.employee_id)}
                                className="btn btn-sm btn-square btn-ghost text-error hover:bg-error/10"
                                title="ลบรายการ"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            );
            })()}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-base-300 bg-base-200/50 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="btn btn-sm btn-primary px-6 rounded-xl font-bold shadow-lg shadow-primary/20"
          >
            ปิดหน้าต่าง (Close)
          </button>
        </div>
      </div>

      {/* Attendance Check Sub-Modal */}
      {showAttendanceCheckModal && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/60 animate-backdrop-fade-in">
          <div className="bg-base-100 rounded-2xl shadow-2xl border border-base-300 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden text-base-content animate-modal-scale-in">
            {/* Modal Header */}
            <div className="p-4 border-b border-base-300 flex items-center justify-between bg-base-200/60">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <UserCheck size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-base-content flex items-center gap-2">
                    {subModalStep === "select" ? (
                      <>
                        <span>ผลการตรวจสอบพนักงานไปช่วยงานสาขาอื่น (Auto-Detect)</span>
                        <span className="badge badge-primary font-mono text-xs px-2.5 py-0.5">
                          พบ {attendanceLoanEmps.length} คน
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-primary">ขั้นตอนที่ 2: สรุปและยืนยันการนำเข้าข้อมูลช่วยงาน</span>
                        <span className="badge badge-secondary font-mono text-xs px-2.5 py-0.5">
                          เลือก {selectedEmpIds.size} คน
                        </span>
                      </>
                    )}
                  </h3>
                  <p className="text-xs text-base-content/60">
                    {subModalStep === "select"
                      ? "เลือกพนักงานและกำหนดสาขาปลายทาง (P1, A1, K1, N1) ก่อนนำเข้าข้อมูล"
                      : "โปรดตรวจสอบสรุปการกระจายพนักงานไปตามสาขาต่างๆ ก่อนบันทึกลงระบบ"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAttendanceCheckModal(false)}
                className="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content"
              >
                <X size={18} />
              </button>
            </div>

            {/* STEP 1: SELECT & ASSIGN FACTORY & DATE RANGE */}
            {subModalStep === "select" && (
              <>
                {/* Unified Control & Selection Panel */}
                <div className="p-3 bg-base-200/40 border-b border-base-300">
                  <div className="bg-base-100 rounded-xl border border-base-300 p-3 shadow-2xs space-y-2.5">
                    {/* Top Row: Attendance Date Check & Bulk Destination Settings */}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                      {/* Left: Attendance Check Date */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-base-content/80 whitespace-nowrap">วันที่ตรวจเช็ค:</span>
                        <FormattedDateInput
                          value={checkDate}
                          onChange={(val) => {
                            setCheckDate(val);
                            handleCheckAttendance(val);
                          }}
                          size="xs"
                          className="w-28"
                        />
                        <button
                          type="button"
                          onClick={() => handleCheckAttendance(checkDate)}
                          className="btn btn-xs btn-outline btn-primary rounded-lg font-bold gap-1 shadow-2xs shrink-0"
                        >
                          <RefreshCw size={12} className={isCheckingAttendance ? "animate-spin" : ""} />
                          <span>ค้นหาใหม่</span>
                        </button>
                      </div>

                      {/* Right: Bulk Settings */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-bold text-primary whitespace-nowrap">สาขาหลัก:</span>
                          <select
                            className="select select-xs select-bordered font-bold text-primary rounded-lg"
                            value={globalDefaultFactory}
                            onChange={(e) => setGlobalDefaultFactory(e.target.value)}
                          >
                            {FACTORY_OPTIONS.map((fac) => (
                              <option key={fac} value={fac}>
                                {fac}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-bold text-base-content/70 whitespace-nowrap">วันเริ่ม:</span>
                          <FormattedDateInput
                            value={syncStartDate}
                            onChange={setSyncStartDate}
                            size="xs"
                            className="w-28"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-bold text-base-content/70 whitespace-nowrap">วันสิ้นสุด:</span>
                          <FormattedDateInput
                            value={syncEndDate}
                            onChange={setSyncEndDate}
                            size="xs"
                            className="w-28"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleApplyBulkSettingsToSelected(globalDefaultFactory, syncStartDate, syncEndDate)}
                          className="btn btn-xs btn-primary font-bold rounded-lg px-3 shadow-md shadow-primary/20 hover:scale-105 active:scale-95 transition-transform whitespace-nowrap shrink-0"
                          title="ปรับสาขา และ วันที่เริ่ม-สิ้นสุด ให้คนที่เลือกทั้งหมด"
                        >
                          ปรับให้คนที่เลือกทั้งหมด
                        </button>
                      </div>
                    </div>

                    {/* Bottom Row: Selection Actions & Status Count */}
                    <div className="border-t border-base-200/80 pt-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          className="btn btn-xs btn-ghost text-primary font-bold hover:bg-primary/10 rounded-lg"
                        >
                          {selectedEmpIds.size === attendanceLoanEmps.filter((e) => !e.alreadyExists).length
                            ? "ยกเลิกการเลือกทั้งหมด"
                            : "เลือกทั้งหมด (เฉพาะรายการใหม่)"}
                        </button>
                        <button
                          type="button"
                          onClick={handleClearAllSelections}
                          className="btn btn-xs btn-ghost text-error font-bold hover:bg-error/10 rounded-lg gap-1"
                          title="เคลียร์การเลือกพนักงานทั้งหมด"
                        >
                          <Trash2 size={12} />
                          <span>เคลียร์ที่เลือก</span>
                        </button>
                        <span className="text-base-content/30">|</span>
                        <button
                          type="button"
                          onClick={handleClearDropdowns}
                          className="btn btn-xs btn-ghost text-secondary font-bold hover:bg-secondary/10 rounded-lg gap-1"
                          title="รีเซ็ตค่าสาขา Dropdown ของพนักงานที่เลือกให้กลับเป็น N1"
                        >
                          <RefreshCw size={12} />
                          <span>เคลียร์สาขา Dropdown</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-base-content/70 font-medium">
                          (เลือกแล้ว <strong className="text-primary font-mono text-sm font-bold">{selectedEmpIds.size}</strong> /{" "}
                          {attendanceLoanEmps.filter((e) => !e.alreadyExists).length} คนที่ยังไม่มีในตาราง
                          {attendanceLoanEmps.filter((e) => e.alreadyExists).length > 0 && (
                            <span className="text-base-content/50 font-normal ml-1">
                              · มีในตารางแล้ว {attendanceLoanEmps.filter((e) => e.alreadyExists).length} คน
                            </span>
                          )}
                          )
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Table Body Step 1 */}
                <div className="flex-1 overflow-y-auto p-4 bg-base-100 min-h-[300px]">
                  {attendanceLoanEmps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-base-content/50 gap-2 text-center h-full">
                      <AlertCircle className="w-12 h-12 text-warning opacity-60" />
                      <span className="text-sm font-bold">ไม่พบข้อมูลพนักงานที่มีรหัสช่วยงานสาขาอื่น</span>
                      <span className="text-xs text-base-content/60">
                        ในวันที่ {dayjs(checkDate).format("DD/MM/YYYY")} ทุกคนมีสถานะวันทำงานปกติ (W, H, O)
                      </span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="table table-xs table-zebra w-full text-xs">
                        <thead>
                          <tr className="bg-base-200/80 text-base-content/70">
                            <th className="w-10 text-center">
                              <input
                                type="checkbox"
                                className="checkbox checkbox-xs checkbox-primary"
                                checked={
                                  attendanceLoanEmps.filter((e) => !e.alreadyExists).length > 0 &&
                                  selectedEmpIds.size === attendanceLoanEmps.filter((e) => !e.alreadyExists).length
                                }
                                disabled={attendanceLoanEmps.filter((e) => !e.alreadyExists).length === 0}
                                onChange={toggleSelectAll}
                              />
                            </th>
                            <th className="w-10">#</th>
                            <th className="w-24">รหัสพนักงาน</th>
                            <th className="w-40">ชื่อ-นามสกุล</th>
                            <th>แผนก</th>
                            <th className="w-32 text-center bg-primary/10 text-primary font-bold">
                              สาขาปลายทาง (Factory)
                            </th>
                            <th className="w-64 text-center">ระยะเวลาช่วยงาน (Start - End Date)</th>
                            <th className="w-28 text-center">สถานะในตารางปัจจุบัน</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendanceLoanEmps.map((emp, idx) => {
                            const isSelected = selectedEmpIds.has(emp.employee_id);
                            const isLocked = emp.alreadyExists;
                            return (
                              <tr
                                key={emp.employee_id}
                                className={`hover:bg-base-200/50 transition-colors ${isLocked ? "opacity-60 bg-base-200/30" : isSelected ? "bg-primary/5" : ""
                                  }`}
                              >
                                <td className="text-center">
                                  <input
                                    type="checkbox"
                                    className={`checkbox checkbox-xs checkbox-primary ${isLocked ? "opacity-30 cursor-not-allowed" : ""
                                      }`}
                                    checked={isSelected}
                                    disabled={isLocked}
                                    onChange={() => toggleSelectEmp(emp.employee_id)}
                                    title={isLocked ? "มีอยู่ในตารางหลักแล้ว (ล็อค ไม่สามารถนำเข้าซ้ำ)" : "เลือกเพื่อนำเข้า"}
                                  />
                                </td>
                                <td className="font-mono text-base-content/40">{idx + 1}</td>
                                <td className="font-mono font-bold text-primary">{emp.employee_id}</td>
                                <td className="font-bold text-base-content">{emp.employee_name || "-"}</td>
                                <td className="text-base-content/70 truncate max-w-[130px]" title={emp.department}>
                                  {emp.department || "-"}
                                </td>
                                <td className="text-center bg-primary/5">
                                  {isLocked ? (
                                    <span
                                      className={`badge font-bold text-[10px] px-2 py-0.5 whitespace-nowrap ${getBranchBadgeStyle(emp.assignedDestination || emp.existingDestination || "N1")}`}
                                      title="ล็อคค่าสาขาเดิมในระบบ"
                                    >
                                      {emp.assignedDestination || emp.existingDestination || "N1"}
                                    </span>
                                  ) : (
                                    <select
                                      className="select select-xs select-bordered font-bold text-primary rounded-lg w-28 text-center focus:ring-2 focus:ring-primary"
                                      value={emp.assignedDestination || "N1"}
                                      onChange={(e) => handleRowFactoryChange(emp.employee_id, e.target.value)}
                                    >
                                      {FACTORY_OPTIONS.map((fac) => (
                                        <option key={fac} value={fac}>
                                          {fac}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </td>
                                <td className="text-center">
                                  {isLocked ? (
                                    <div className="flex items-center justify-center gap-1 font-mono text-[11px] text-base-content/60">
                                      <Calendar size={11} className="opacity-50" />
                                      <span>
                                        {emp.startDate ? dayjs(emp.startDate).format("DD/MM/YYYY") : "—"} -{" "}
                                        {emp.endDate ? dayjs(emp.endDate).format("DD/MM/YYYY") : "ไม่มีกำหนด"}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center gap-1">
                                      <FormattedDateInput
                                        value={emp.startDate || ""}
                                        onChange={(val) => handleRowDateChange(emp.employee_id, "startDate", val)}
                                        size="xs"
                                        className="w-28"
                                      />
                                      <span className="text-base-content/40 text-[10px]">-</span>
                                      <FormattedDateInput
                                        value={emp.endDate || ""}
                                        onChange={(val) => handleRowDateChange(emp.employee_id, "endDate", val)}
                                        size="xs"
                                        className="w-28"
                                      />
                                    </div>
                                  )}
                                </td>
                                <td className="text-center">
                                  {isLocked ? (
                                    <span className="badge badge-sm badge-success gap-1.5 text-xs font-semibold text-white px-2.5 py-0.5 shadow-2xs">
                                      <CheckCircle2 size={12} /> อยู่ในตารางแล้ว
                                    </span>
                                  ) : (
                                    <span className="badge badge-sm badge-warning gap-1.5 text-xs font-semibold text-warning-content px-2.5 py-0.5 animate-pulse">
                                      <AlertCircle size={12} /> ยังไม่มีในตาราง
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Footer Step 1 */}
                <div className="p-4 border-t border-base-300 bg-base-200/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-base-content/60 font-semibold">
                      * สามารถเลือกสาขาปลายทาง (P1, A1, K1, N1) และระบุวันเริ่ม-สิ้นสุด แยกเป็นรายคนได้ตามต้องการ
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAttendanceCheckModal(false)}
                      className="btn btn-sm btn-ghost font-bold rounded-xl"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      disabled={selectedEmpIds.size === 0}
                      onClick={() => setSubModalStep("confirm")}
                      className="btn btn-sm btn-primary rounded-xl font-bold gap-2 text-white shadow-lg shadow-primary/20"
                    >
                      <span>ถัดไป: ตรวจสอบและยืนยันข้อมูล ({selectedEmpIds.size} คน)</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* STEP 2: REVIEW & CONFIRM */}
            {subModalStep === "confirm" && (
              <>
                <div className="p-4 bg-base-100 flex-1 overflow-y-auto space-y-4">
                  {/* Summary Breakdown Cards */}
                  <div className="bg-base-200/40 border border-base-300 p-3.5 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-base-content/80 flex items-center justify-between">
                      <span>สรุปการจัดสรรสาขาพนักงานที่เลือกทั้งหมด ({selectedEmpIds.size} คน)</span>
                      <span className="text-[11px] text-base-content/60 font-normal">
                        โปรดตรวจสอบข้อมูลการช่วยงานก่อนกดยืนยันบันทึก
                      </span>
                    </h4>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {FACTORY_OPTIONS.map((fac) => {
                        const count = attendanceLoanEmps.filter(
                          (e) => selectedEmpIds.has(e.employee_id) && (e.assignedDestination || "N1") === fac
                        ).length;
                        const cardStyle = getBranchCardStyle(fac);
                        return (
                          <div
                            key={fac}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 transition-all ${count > 0
                              ? cardStyle.active
                              : "bg-base-100 border-base-300 text-base-content/40 opacity-60"
                              }`}
                          >
                            <span>สาขา {fac}:</span>
                            <span className="font-mono text-sm font-extrabold">{count} คน</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Employees Review Table */}
                  <div className="border border-base-300 rounded-xl overflow-hidden bg-base-100">
                    <div className="p-2.5 bg-base-200/60 font-bold text-xs text-base-content/80 border-b border-base-300">
                      รายชื่อพนักงานที่จะถูกบันทึกนำเข้า ({selectedEmpIds.size} รายการ)
                    </div>
                    <div className="overflow-x-auto max-h-[340px]">
                      <table className="table table-xs table-zebra w-full text-xs">
                        <thead>
                          <tr className="bg-base-200/40 text-base-content/70">
                            <th className="w-10">#</th>
                            <th className="w-24">รหัสพนักงาน</th>
                            <th className="w-44">ชื่อ-นามสกุล</th>
                            <th>แผนก</th>
                            <th className="w-32 text-center font-bold text-primary">สาขาปลายทางที่จะบันทึก</th>
                            <th className="w-56 text-center font-bold">ระยะเวลาช่วยงาน (Start - End Date)</th>
                            <th className="w-28 text-center">สถานะเดิมในระบบ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendanceLoanEmps
                            .filter((emp) => selectedEmpIds.has(emp.employee_id))
                            .map((emp, idx) => (
                              <tr key={emp.employee_id}>
                                <td className="font-mono text-base-content/40">{idx + 1}</td>
                                <td className="font-mono font-bold text-primary">{emp.employee_id}</td>
                                <td className="font-bold text-base-content">{emp.employee_name || "-"}</td>
                                <td className="text-base-content/70 truncate max-w-[150px]" title={emp.department}>
                                  {emp.department || "-"}
                                </td>
                                <td className="text-center font-bold">
                                  <span className={`badge font-mono text-xs px-2.5 py-0.5 whitespace-nowrap ${getBranchBadgeStyle(emp.assignedDestination || "N1")}`}>
                                    {emp.assignedDestination || "N1"}
                                  </span>
                                </td>
                                <td className="text-center font-mono text-[11px]">
                                  {emp.startDate ? dayjs(emp.startDate).format("DD/MM/YYYY") : "—"}{" "}
                                  ถึง{" "}
                                  {emp.endDate ? dayjs(emp.endDate).format("DD/MM/YYYY") : "ไม่มีกำหนด"}
                                </td>
                                <td className="text-center">
                                  {emp.alreadyExists ? (
                                    <span className="text-[10px] text-emerald-600 font-semibold">อัปเดตข้อมูล</span>
                                  ) : (
                                    <span className="text-[10px] text-amber-600 font-semibold">เพิ่มใหม่</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Footer Step 2 */}
                <div className="p-4 border-t border-base-300 bg-base-200/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <span className="text-xs text-base-content/60">
                    * เมื่อกดยืนยัน ข้อมูลจะถูกบันทึกเข้าสู่ตารางพนักงานช่วยงานต่างสาขาโดยอัตโนมัติ
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSyncingAttendance}
                      onClick={() => setSubModalStep("select")}
                      className="btn btn-sm btn-outline btn-ghost font-bold rounded-xl gap-1.5"
                    >
                      <ArrowLeft size={14} />
                      <span>ย้อนกลับไปแก้ไข</span>
                    </button>
                    <button
                      type="button"
                      disabled={selectedEmpIds.size === 0 || isSyncingAttendance}
                      onClick={handleSyncSelectedAttendanceEmps}
                      className="btn btn-sm btn-primary rounded-xl font-bold gap-2 text-white shadow-lg shadow-primary/20 px-5"
                    >
                      {isSyncingAttendance ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                      <span>ยืนยันบันทึกข้อมูล ({selectedEmpIds.size} คน)</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
