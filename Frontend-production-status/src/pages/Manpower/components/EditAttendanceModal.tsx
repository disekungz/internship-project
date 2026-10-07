/**
 * Component: EditAttendanceModal
 * หน้าต่างแก้ไขข้อมูลการลงเวลาทำงานของพนักงานรายบุคคล
 * - ค้นหาพนักงาน, แก้ไขข้อมูลการสแกนเวลาเข้า-ออก, แผนก, กะ และสถานะ
 * - รองรับการแก้ไขทีละคน หรือแก้ไขพร้อมกันหลายคน (Bulk Edit)
 */
import { useMemo, useState, useEffect } from "react";
import { ExcelColumnFilter } from "./ImportPreviewModal";
import { extractDatePart, isOtherFactoryRecord } from "../aggregation";
import { MANHOUR_EMPLOYEES_SEARCH_ENDPOINT } from "../constants";
import ModalButtonIcon from "./ModalButtonIcon";

type AttendanceRow = {
  dlh_employee_id: string;
  employee_name?: string;
  dlh_effective_date_time: string;
  work_day_status?: string | null;
  work_status?: string | null;
  department?: string | null;
  emp_department?: string | null;
  line?: string | null;
  line_check?: string | null;
  shift?: string | null;
  shift_h?: string | null;
  scan_time_in?: string | null;
  scan_time_out?: string | null;
  loan_destination?: string | null;
  is_loan_exclude?: boolean;
};

type Props = {
  date: string;
  rows: AttendanceRow[];
  isSaving: boolean;
  onChange: (index: number, field: keyof AttendanceRow, value: string) => void;
  onBulkChange?: (indexes: number[], field: keyof AttendanceRow, value: string) => void;
  onAddRow: (newRow: AttendanceRow) => void;
  onDeleteRows: (employeeIds: string[]) => void;
  onCancel: () => void;
  onSave: () => void;
};

/**
 * แปลงค่า Timestamp เป็นฟอร์แมต datetime-local ตามเวลาประเทศไทย (Asia/Bangkok)
 */
const toDateTimeLocal = (value?: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
    return match ? `${match[1]}T${match[2]}` : "";
  }
  const bDate = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const yyyy = bDate.getFullYear();
  const mm = String(bDate.getMonth() + 1).padStart(2, "0");
  const dd = String(bDate.getDate()).padStart(2, "0");
  const hh = String(bDate.getHours()).padStart(2, "0");
  const min = String(bDate.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

// แยกวันที่ออกจาก datetime string (Bangkok timezone)
const toLocalDate = (value?: string | null): string => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value).slice(0, 10);
  const bDate = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  return `${bDate.getFullYear()}-${String(bDate.getMonth() + 1).padStart(2, "0")}-${String(bDate.getDate()).padStart(2, "0")}`;
};

// แยกเวลาออกจาก datetime string (Bangkok timezone)
const toLocalTime = (value?: string | null): string => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    const m = String(value).match(/[T ](\d{2}:\d{2})/);
    return m ? m[1] : "";
  }
  const bDate = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  return `${String(bDate.getHours()).padStart(2, "0")}:${String(bDate.getMinutes()).padStart(2, "0")}`;
};

// รวมวันที่+เวลาเป็น ISO string สำหรับส่ง backend
const combineDateTimeUtc = (dateStr: string, timeStr: string): string | null => {
  if (!dateStr && !timeStr) return null;
  if (!dateStr) return null;
  const time = timeStr || "00:00";
  return `${dateStr}T${time}:00+07:00`;
};

// จับคู่ Work Day Status เป็นข้อความและสไตล์ Badge ภาษาไทยที่เข้าใจง่าย
const getWorkDayStatusInfo = (status?: string | null, isThai = true) => {
  const s = String(status || "").trim().toUpperCase();
  if (s.startsWith("1N")) {
    const isHoliday = s.endsWith("H");
    const isOff = s.endsWith("O");
    const base = isHoliday ? "H" : isOff ? "O" : "W";
    const typeDesc = isThai
      ? isHoliday
        ? "(วันหยุดนักขัต)"
        : isOff
          ? "(วันหยุด Off)"
          : "(วันทำงาน)"
      : isHoliday
        ? "(Holiday)"
        : isOff
          ? "(Off Day)"
          : "(Work Day)";
    return {
      label: isThai
        ? `ไปช่วยงาน Factory อื่น ${typeDesc}`
        : `Cross-Factory Support ${typeDesc}`,
      badge: "bg-amber-100 text-amber-900 border-amber-300",
      isCross: true,
      base,
    };
  }
  if (s === "W" || s.endsWith("W"))
    return {
      label: isThai ? "วันทำงานปกติ (Working Day)" : "Regular Working Day (W)",
      badge: "bg-blue-100 text-blue-900 border-blue-200",
      isCross: false,
      base: "W",
    };
  if (s === "H" || s.endsWith("H"))
    return {
      label: isThai ? "วันหยุดนักขัตฤกษ์ (Holiday)" : "Public Holiday (H)",
      badge: "bg-purple-100 text-purple-900 border-purple-200",
      isCross: false,
      base: "H",
    };
  if (s === "O" || s.endsWith("O"))
    return {
      label: isThai ? "วันหยุดประจำสัปดาห์ (Off Day)" : "Weekly Off Day (O)",
      badge: "bg-emerald-100 text-emerald-900 border-emerald-200",
      isCross: false,
      base: "O",
    };
  return {
    label: s || (isThai ? "ไม่ระบุ" : "Unspecified"),
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    isCross: false,
    base: "W",
  };
};

const parseTimeObject = (value?: string | null): Date | null => {
  if (!value) return null;
  const str = String(value).trim();
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return new Date(d.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  }
  const match = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const now = new Date();
    now.setHours(Number(match[1]), Number(match[2]), Number(match[3] || 0), 0);
    return now;
  }
  return null;
};

// คำนวณจำนวนนาทีที่มาสาย
// กะเช้า / ปกติ: เข้างาน 08:00
// กะดึก: เข้างาน 20:00
const getLateMinutes = (row: AttendanceRow): number => {
  const timeIn = parseTimeObject(row.scan_time_in);
  if (!timeIn) return 0;

  const wStatus = String(row.work_status || "").trim().toLowerCase();
  if (wStatus === "absent") return 0;

  const hours = timeIn.getHours();
  const minutes = timeIn.getMinutes();

  const shift = String(row.shift_h || row.shift || "").trim().toUpperCase();
  const isNight = shift === "N" || shift === "B" || shift === "NIGHT" || hours >= 17 || hours < 5;

  if (isNight) {
    // เวลาเริ่มงานตามแผน: 20:00 น.
    // หากเข้างานช่วง 20:01 - 23:59: คิดนาทีมาสายจาก (ชั่วโมง - 20) * 60 + นาที
    // หากเข้างานหลังเที่ยงคืน (00:00 - 05:00): คิดนาทีมาสายจาก (ชั่วโมง + 4) * 60 + นาที
    if (hours >= 20) {
      return (hours - 20) * 60 + minutes;
    } else if (hours < 5) {
      return (hours + 4) * 60 + minutes;
    }
    return 0;
  } else {
    // เวลาเริ่มงานตามแผน: 08:00 น.
    // หากเข้างานหลังเวลา 08:00 น.:
    if (hours > 8 || (hours === 8 && minutes > 0)) {
      return (hours - 8) * 60 + minutes;
    }
    return 0;
  }
};

export type AttendanceCategory = "present" | "absent" | "leave" | "late";

const getAttendanceStatus = (row: AttendanceRow): {
  type: AttendanceCategory;
  labelTh: string;
  labelEn: string;
  badgeClass: string;
  lateMinutes: number;
} => {
  const wds = String(row.work_day_status || "").trim().toUpperCase();
  const ws = String(row.work_status || "").trim().toLowerCase();
  const hasScan = Boolean(row.scan_time_in || row.scan_time_out);
  const lateMin = getLateMinutes(row);

  // 1. ขาดงาน (Absent)
  if (ws === "absent" || (!hasScan && (wds === "W" || wds.endsWith("W")))) {
    return {
      type: "absent",
      labelTh: "ขาดงาน",
      labelEn: "Absent",
      badgeClass: "bg-rose-100 text-rose-800 border-rose-300 font-bold",
      lateMinutes: 0,
    };
  }

  // 2. วันหยุด / ลา (Leave / Holiday / Off)
  if ((wds === "H" || wds.endsWith("H") || wds === "O" || wds.endsWith("O")) && !hasScan) {
    const isHoliday = wds === "H" || wds.endsWith("H");
    return {
      type: "leave",
      labelTh: isHoliday ? "วันหยุดนักขัต (H)" : "วันหยุด Off (O)",
      labelEn: isHoliday ? "Holiday (H)" : "Off Day (O)",
      badgeClass: isHoliday
        ? "bg-purple-100 text-purple-800 border-purple-300 font-bold"
        : "bg-sky-100 text-sky-800 border-sky-300 font-bold",
      lateMinutes: 0,
    };
  }

  // 3. มาสาย (Late)
  if (lateMin > 0) {
    return {
      type: "late",
      labelTh: `มาสาย (${lateMin} นาที)`,
      labelEn: `Late (${lateMin} min)`,
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
      lateMinutes: lateMin,
    };
  }

  // 4. มาทำงานปกติ (Present)
  return {
    type: "present",
    labelTh: "มาทำงาน",
    labelEn: "Present",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold",
    lateMinutes: 0,
  };
};

const formatHumanDateTime = (value?: string | null) => {
  if (!value) return "(Blank)";
  const str = String(value).trim();
  if (!str) return "(Blank)";

  const d = new Date(str);
  if (isNaN(d.getTime())) {
    return str;
  }

  const bDate = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const day = bDate.getDate();
  const month = bDate.getMonth() + 1;
  const yearBE = bDate.getFullYear() > 2400 ? bDate.getFullYear() : bDate.getFullYear() + 543;
  const hours = bDate.getHours();
  const minutes = String(bDate.getMinutes()).padStart(2, "0");
  const seconds = String(bDate.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${yearBE} ${hours}:${minutes}:${seconds}`;
};

export default function EditAttendanceModal({
  date,
  rows,
  isSaving,
  onChange,
  onBulkChange,
  onAddRow,
  onDeleteRows,
  onCancel,
  onSave,
}: Props) {
  const [columnFilters, setColumnFilters] = useState<
    Record<string, string[] | undefined>
  >({});
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: string;
  }>({ key: "", direction: "" });
  const [selected, setSelected] = useState(() => new Set<number>());
  const [quickFilter, setQuickFilter] = useState<
    | "all"
    | "cross_only"
    | "internal_only"
    | "abnormal_only"
    | "duplicate_only"
    | "present_only"
    | "absent_only"
    | "leave_only"
    | "late_only"
  >("all");

  // Bulk controls
  const [bulkField, setBulkField] = useState<
    "work_day_status" | "work_status" | "dlh_effective_date_time" | "department" | "line" | "scan_time_in" | "scan_time_out"
  >("work_day_status");
  const [bulkValue, setBulkValue] = useState("1NW");

  // State สำหรับฟอร์มเพิ่มพนักงานใหม่
  const [language, setLanguage] = useState<"th" | "en">("th");
  const isThai = language === "th";
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHelpManual, setShowHelpManual] = useState(false);
  const [manualLang, setManualLang] = useState<"TH" | "EN">("TH");

  const toggleLanguage = () => {
    const nextLang = language === "th" ? "en" : "th";
    setLanguage(nextLang);
    setManualLang(nextLang === "th" ? "TH" : "EN");
  };
  const [newEmpId, setNewEmpId] = useState("");
  const [newEmpName, setNewEmpName] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newEmpLine, setNewEmpLine] = useState("");
  const [newWorkDate, setNewWorkDate] = useState(date);
  const [newWorkDayStatus, setNewWorkDayStatus] = useState("W");
  const [newWorkStatus, setNewWorkStatus] = useState("Normal");
  const [newScanIn, setNewScanIn] = useState("");
  const [newScanOut, setNewScanOut] = useState("");
  const [selectedEmpMeta, setSelectedEmpMeta] = useState<any>(null);
  const [activeShiftPreset, setActiveShiftPreset] = useState<"day" | "night" | "8h" | "absent" | "custom">("day");

  // State สำหรับช่องค้นหาพนักงาน
  const [empSearchQuery, setEmpSearchQuery] = useState("");
  const [empSuggestions, setEmpSuggestions] = useState<any[]>([]);
  const [isSearchingEmp, setIsSearchingEmp] = useState(false);
  const [showEmpDropdown, setShowEmpDropdown] = useState(false);

  const applyShiftPreset = (type: "day" | "night" | "8h" | "absent") => {
    setActiveShiftPreset(type);
    if (type === "day") {
      setNewScanIn(`${date}T08:00`);
      setNewScanOut(`${date}T20:00`);
      setNewWorkStatus("Normal");
    } else if (type === "night") {
      setNewScanIn(`${date}T20:00`);
      setNewScanOut(`${nextDateKey}T08:00`);
      setNewWorkStatus("Normal");
    } else if (type === "8h") {
      setNewScanIn(`${date}T08:00`);
      setNewScanOut(`${date}T16:45`);
      setNewWorkStatus("Normal");
    } else if (type === "absent") {
      setNewScanIn("");
      setNewScanOut("");
      setNewWorkStatus("Absent");
    }
  };

  const searchEmployees = async (query: string) => {
    setEmpSearchQuery(query);
    if (!query || query.trim().length < 1) {
      setEmpSuggestions([]);
      return;
    }
    setIsSearchingEmp(true);
    try {
      const resp = await fetch(
        `${MANHOUR_EMPLOYEES_SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`,
      );
      if (resp.ok) {
        const data = await resp.json();
        setEmpSuggestions(Array.isArray(data) ? data : []);
      }
    } catch {
      // ค้นหาจากแถวปัจจุบันในหน้าจอเป็นทางเลือกสำรอง
      const q = query.toLowerCase();
      const localMatches = rows.filter(
        (r) =>
          r.dlh_employee_id?.toLowerCase().includes(q) ||
          r.employee_name?.toLowerCase().includes(q),
      ).map((r) => ({
        code: r.dlh_employee_id,
        name: r.employee_name,
        department: r.department,
        line: r.line || r.line_check,
      }));
      setEmpSuggestions(localMatches);
    } finally {
      setIsSearchingEmp(false);
    }
  };

  const handleSelectEmployee = (emp: any) => {
    const id = String(emp.code || emp.dlh_employee_id || "").trim();
    const name = String(emp.name || emp.employee_name || "").trim();
    const dept = String(emp.department || emp.dept || "").trim();
    const lineVal = String(emp.line || emp.line_check || "").trim();

    setNewEmpId(id);
    setNewEmpName(name);
    setNewDept(dept);
    setNewEmpLine(lineVal);
    setSelectedEmpMeta(emp);
    setEmpSearchQuery(id ? `${id} - ${name}` : name);
    setShowEmpDropdown(false);

    // Auto preset shift if available
    const shift = String(emp.shift || "").toUpperCase();
    if (shift === "N" || shift === "B" || shift === "NIGHT") {
      applyShiftPreset("night");
    } else {
      applyShiftPreset("day");
    }
  };

  const handleAddNewEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpId.trim()) return;
    onAddRow({
      dlh_employee_id: newEmpId.trim(),
      employee_name: newEmpName.trim() || undefined,
      department: newDept.trim() || undefined,
      line: newEmpLine.trim() || undefined,
      line_check: newEmpLine.trim() || undefined,
      dlh_effective_date_time: newWorkDate || date,
      work_day_status: newWorkDayStatus || "W",
      work_status: newWorkStatus || "Normal",
      scan_time_in: newScanIn || null,
      scan_time_out: newScanOut || null,
    });
    // รีเซ็ตค่าในฟอร์มของหน้าต่าง
    setNewEmpId("");
    setNewEmpName("");
    setNewDept("");
    setNewEmpLine("");
    setNewWorkDate(date);
    setSelectedEmpMeta(null);
    setEmpSearchQuery("");
    setEmpSuggestions([]);
    setNewScanIn("");
    setNewScanOut("");
    setShowAddModal(false);
  };

  // ตรวจหาวัน/เวลาหรือสถานะผิดปกติ
  const nextDate = new Date(`${date}T12:00:00+07:00`);
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDateKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
  const previousDate = new Date(`${date}T12:00:00+07:00`);
  previousDate.setDate(previousDate.getDate() - 1);
  const previousDateKey = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}-${String(previousDate.getDate()).padStart(2, "0")}`;

  const getAbnormalReason = (row: AttendanceRow) => {
    const rowDate = extractDatePart(row.dlh_effective_date_time) || date;
    const scanInDate = extractDatePart(row.scan_time_in);
    const scanOutDate = extractDatePart(row.scan_time_out);

    if (rowDate && /^\d{4}-\d{2}-\d{2}$/.test(rowDate)) {
      const rDate = new Date(`${rowDate}T12:00:00+07:00`);
      const prevD = new Date(rDate);
      prevD.setDate(prevD.getDate() - 1);
      const prevKey = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, "0")}-${String(prevD.getDate()).padStart(2, "0")}`;
      const nextD = new Date(rDate);
      nextD.setDate(nextD.getDate() + 1);
      const nextKey = `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, "0")}-${String(nextD.getDate()).padStart(2, "0")}`;

      const validDates = new Set([prevKey, rowDate, nextKey]);
      if (
        (scanInDate && !validDates.has(scanInDate)) ||
        (scanOutDate && !validDates.has(scanOutDate))
      ) {
        return isThai
          ? "วันที่สแกนไม่ตรงวันทำงาน (Date Mismatch)"
          : "Scan date mismatch (Date Mismatch)";
      }
    }

    const status = String(row.work_status || "").trim().toLowerCase();
    const hasScanIn = Boolean(row.scan_time_in);
    const hasScanOut = Boolean(row.scan_time_out);
    if (status === "absent" && (hasScanIn || hasScanOut))
      return isThai
        ? "สถานะ Absent แต่มีเวลาสแกน"
        : "Status is Absent but scan timestamps exist";
    if (
      (status === "normal" || status === "abnormal") &&
      hasScanIn !== hasScanOut
    )
      return isThai
        ? "สแกนไม่ครบ (เข้า/ออก ไม่สมบูรณ์)"
        : "Incomplete scan (Missing In or Out)";

    const wds = String(row.work_day_status || "").trim().toUpperCase();
    if (!wds)
      return isThai
        ? "ไม่มี Work Day Status (W/H/O/1N)"
        : "Missing Work Day Status (W/H/O/1N)";
    return "";
  };

  const [globalSearch, setGlobalSearch] = useState("");
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);

  const columnGetters: Record<string, (row: AttendanceRow) => string> = {
    employeeId: (row) => String(row.dlh_employee_id || ""),
    name: (row) => String(row.employee_name || "-"),
    line: (row) => String(row.line_check || row.line || "-"),
    attendanceStatus: (row) => {
      const st = getAttendanceStatus(row);
      return isThai ? st.labelTh : st.labelEn;
    },
    workDate: (row) => extractDatePart(row.dlh_effective_date_time) || date,
    workDayStatus: (row) => getWorkDayStatusInfo(row.work_day_status, isThai).label,
    workStatus: (row) => String(row.work_status || "Normal"),
    department: (row) => String(row.department || "-"),
    destination: (row) => String(row.loan_destination || "-"),
    crossFactoryStatus: (row) =>
      isOtherFactoryRecord(row)
        ? isThai
          ? "ไปช่วยงานข้าม Factory (1N)"
          : "Cross-Factory Support (1N)"
        : isThai
          ? "ทำงานในโรงงานปกติ"
          : "Internal In-House",
    abnormal: (row) => getAbnormalReason(row) || (isThai ? "ปกติ" : "Valid"),
    scanIn: (row) => formatHumanDateTime(row.scan_time_in),
    scanOut: (row) => formatHumanDateTime(row.scan_time_out),
  };

  const filterValues = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(columnGetters).map(([key, getter]) => [
          key,
          [...new Set(rows.map(getter))].sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true }),
          ),
        ]),
      ),
    [rows],
  );

  // ตรวจหาพนักงานที่มี ID ซ้ำซ้อนในวันเดียวกัน
  const duplicateEmpIds = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => {
      const id = String(r.dlh_employee_id || "").trim();
      if (id) counts.set(id, (counts.get(id) || 0) + 1);
    });
    const duplicates = new Set<string>();
    counts.forEach((count, id) => {
      if (count > 1) duplicates.add(id);
    });
    return duplicates;
  }, [rows]);

  const visibleRows = useMemo(() => {
    const searchLower = globalSearch.trim().toLowerCase();
    const result = rows
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row }) => {
        const empId = String(row.dlh_employee_id || "").trim();
        if (quickFilter === "cross_only" && !isOtherFactoryRecord(row)) return false;
        if (quickFilter === "internal_only" && isOtherFactoryRecord(row)) return false;
        if (quickFilter === "abnormal_only" && !getAbnormalReason(row)) return false;
        if (quickFilter === "duplicate_only" && !duplicateEmpIds.has(empId)) return false;

        const attStatus = getAttendanceStatus(row);
        if (quickFilter === "present_only" && attStatus.type !== "present") return false;
        if (quickFilter === "absent_only" && attStatus.type !== "absent") return false;

        if (searchLower) {
          const matchId = String(row.dlh_employee_id || "").toLowerCase().includes(searchLower);
          const matchName = String(row.employee_name || "").toLowerCase().includes(searchLower);
          const matchDept = String(row.department || "").toLowerCase().includes(searchLower);
          const matchLine = String(row.line_check || row.line || "").toLowerCase().includes(searchLower);
          if (!matchId && !matchName && !matchDept && !matchLine) return false;
        }

        return Object.entries(columnFilters).every(
          ([key, allowed]) =>
            !allowed || allowed.includes(columnGetters[key](row)),
        );
      });
    if (sortConfig.key && sortConfig.direction)
      result.sort(
        (a, b) =>
          columnGetters[sortConfig.key](a.row).localeCompare(
            columnGetters[sortConfig.key](b.row),
            undefined,
            { numeric: true },
          ) * (sortConfig.direction === "asc" ? 1 : -1),
      );
    return result;
  }, [rows, columnFilters, sortConfig, quickFilter, globalSearch, duplicateEmpIds]);

  // State สำหรับระบบแบ่งหน้าความเร็วสูง (Pagination)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    setCurrentPage(1);
  }, [quickFilter, columnFilters, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return visibleRows.slice(start, start + pageSize);
  }, [visibleRows, currentPage, pageSize]);

  const setColumnFilter = (key: string, values: string[] | null) =>
    setColumnFilters((current) => {
      const next = { ...current };
      if (values === null) delete next[key];
      else next[key] = values;
      return next;
    });

  const filterButton = (
    key: string,
    label: string,
    align: "left" | "right" = "left",
  ) => (
    <ExcelColumnFilter
      columnKey={key}
      label={label}
      values={filterValues[key] || []}
      selectedValues={columnFilters[key]}
      onApply={(values) => setColumnFilter(key, values)}
      onSort={(direction) => setSortConfig({ key, direction })}
      sortDirection={sortConfig.key === key ? sortConfig.direction : ""}
      align={align}
    />
  );

  const visibleIndexes = visibleRows.map(({ originalIndex }) => originalIndex);
  const allVisibleSelected =
    visibleIndexes.length > 0 &&
    visibleIndexes.every((index) => selected.has(index));

  const toggleAllVisible = () =>
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleIndexes.forEach((index) => next.delete(index));
      } else {
        visibleIndexes.forEach((index) => next.add(index));
      }
      return next;
    });

  const toggleSelected = (index: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const applyBulkValue = () => {
    if (selected.size === 0) return;
    const selectedIndexes = Array.from(selected);
    if (onBulkChange && bulkField !== "scan_time_in" && bulkField !== "scan_time_out") {
      onBulkChange(selectedIndexes, bulkField, bulkValue);
    } else {
      selectedIndexes.forEach((index) => {
        if (bulkField === "department") {
          onChange(index, "department", bulkValue);
          onChange(index, "emp_department", bulkValue);
        } else if (bulkField === "scan_time_in") {
          const rowDate = extractDatePart(rows[index]?.dlh_effective_date_time) || date;
          const newIso = combineDateTimeUtc(rowDate, bulkValue);
          onChange(index, "scan_time_in", newIso || "");
        } else if (bulkField === "scan_time_out") {
          const rowDate = extractDatePart(rows[index]?.dlh_effective_date_time) || date;
          const newIso = combineDateTimeUtc(rowDate, bulkValue);
          onChange(index, "scan_time_out", newIso || "");
        } else if (bulkField === "line") {
          onChange(index, "line", bulkValue);
          onChange(index, "line_check", bulkValue);
        } else {
          onChange(index, bulkField, bulkValue);
        }
      });
    }
  };

  const handleDeleteSelected = () => {
    if (selected.size === 0) return;
    const selectedIds = Array.from(selected)
      .map((idx) => rows[idx]?.dlh_employee_id)
      .filter(Boolean);
    onDeleteRows(selectedIds);
    setSelected(new Set());
  };

  const crossFactoryCount = useMemo(
    () => rows.filter((r) => isOtherFactoryRecord(r)).length,
    [rows],
  );

  const abnormalCount = useMemo(
    () => rows.filter((r) => Boolean(getAbnormalReason(r))).length,
    [rows],
  );

  const { presentCount, absentCount } = useMemo(() => {
    let present = 0;
    let absent = 0;
    rows.forEach((r) => {
      const st = getAttendanceStatus(r);
      if (st.type === "present") present++;
      else if (st.type === "absent") absent++;
    });
    return { presentCount: present, absentCount: absent };
  }, [rows]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/75 p-3 sm:p-5 backdrop-blur-md animate-in fade-in duration-200">
      <section className="flex h-[90vh] w-[96vw] max-w-[1680px] flex-col overflow-hidden rounded-3xl bg-white text-slate-800 shadow-[0_25px_80px_rgba(0,0,0,0.35)] border border-slate-200">

        {/* ส่วนหัว (Header) */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-white px-6 py-3.5 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-2xl shadow-inner border border-blue-100">
              👥
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {isThai ? "จัดการข้อมูลการทำงานประจำวัน" : "Daily Attendance Management"}
                </h2>
                <span className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-black text-blue-800 shadow-2xs">
                  📅 {date}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 font-medium">
                {isThai
                  ? "ตรวจสอบ ปรับสถานะงาน (W/H/O/1N), แก้ไขเวลาสแกนบัตร และจัดการรายชื่อพนักงานในกะ"
                  : "Review & edit work status (W/H/O/1N), card scan timestamps, and manage shift employee roster."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* ปุ่มสลับภาษา TH / EN */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer hover:border-slate-300"
              title={isThai ? "เปลี่ยนภาษา (Switch to English)" : "Switch language (เปลี่ยนเป็นภาษาไทย)"}
            >
              <span>🌐</span>
              <span className="font-mono">{isThai ? "TH" : "EN"}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowHelpManual(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer hover:border-slate-300"
            >
              <span>📖</span>
              <span>{isThai ? "คู่มือการใช้งาน" : "User Guide"}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-black text-white shadow-md shadow-blue-500/20 transition hover:from-blue-700 hover:to-indigo-700 cursor-pointer active:scale-95"
            >
              <span>➕</span>
              <span>{isThai ? "เพิ่มคนใหม่ (Add)" : "Add Employee"}</span>
            </button>
          </div>
        </div>

        {/* แถบเครื่องมือ: ตัวกรองสถานะ + ช่องค้นหา + ปุ่มดำเนินการ */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-7 py-3 shrink-0">

          {/* ปุ่มตัวกรองสถานะ */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-2xl bg-white p-1 border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setQuickFilter("all")}
                className={`rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer ${quickFilter === "all"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                  }`}
              >
                {isThai ? "ทั้งหมด" : "All"} ({rows.length.toLocaleString()})
              </button>

              {/* มาทำงาน (Present) */}
              <button
                type="button"
                onClick={() => setQuickFilter("present_only")}
                className={`rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${quickFilter === "present_only"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-emerald-800 hover:bg-emerald-50"
                  }`}
                title={isThai ? "แสดงเฉพาะผู้ที่มาทำงาน" : "Show present employees"}
              >
                <span>🟢 {isThai ? "มาทำงาน" : "Present"}</span>
                <span className="rounded-md bg-emerald-100 px-1.5 py-0.2 text-[10px] font-black text-emerald-900">
                  {presentCount}
                </span>
              </button>

              {/* ขาดงาน (Absent) */}
              <button
                type="button"
                onClick={() => setQuickFilter("absent_only")}
                className={`rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${quickFilter === "absent_only"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-rose-800 hover:bg-rose-50"
                  }`}
                title={isThai ? "แสดงเฉพาะผู้ที่ไม่มาทำงาน / ไม่มีเวลาสแกน" : "Show absent employees"}
              >
                <span>🔴 {isThai ? "ขาดงาน" : "Absent"}</span>
                <span className="rounded-md bg-rose-100 px-1.5 py-0.2 text-[10px] font-black text-rose-900">
                  {absentCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setQuickFilter("cross_only")}
                className={`rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${quickFilter === "cross_only"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-amber-800 hover:bg-amber-50"
                  }`}
              >
                <span>🔄 {isThai ? "ไปช่วยงาน" : "Cross"}</span>
                <span className="rounded-md bg-amber-100/40 px-1.5 py-0.2 text-[10px]">
                  {crossFactoryCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setQuickFilter("internal_only")}
                className={`rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer ${quickFilter === "internal_only"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                  }`}
              >
                🏢 {isThai ? "ปกติในโรงงาน" : "In-House"} ({(rows.length - crossFactoryCount).toLocaleString()})
              </button>
              {abnormalCount > 0 && (
                <button
                  type="button"
                  onClick={() => setQuickFilter("abnormal_only")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${quickFilter === "abnormal_only"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-rose-700 hover:bg-rose-50"
                    }`}
                >
                  <span>⚠️ {isThai ? "วัน/สแกนผิดปกติ" : "Anomalies"}</span>
                  <span className="rounded-md bg-rose-100/40 px-1.5 py-0.2 text-[10px]">
                    {abnormalCount}
                  </span>
                </button>
              )}
              {duplicateEmpIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setQuickFilter("duplicate_only")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${quickFilter === "duplicate_only"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-purple-700 hover:bg-purple-50"
                    }`}
                >
                  <span>👥 {isThai ? "รหัสซ้ำ" : "Duplicates"}</span>
                  <span className="rounded-md bg-purple-100 px-1.5 py-0.2 text-[10px] font-bold text-purple-900">
                    {duplicateEmpIds.size}
                  </span>
                </button>
              )}
            </div>

            {/* Quick Search */}
            <div className="relative">
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder={isThai ? "🔍 ค้นหา รหัส / ชื่อ / ไลน์ / แผนก..." : "🔍 Search ID / Name / Line / Dept..."}
                className="w-56 sm:w-64 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-2xs"
              />
              {globalSearch && (
                <button
                  onClick={() => setGlobalSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Right: Bulk Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {selected.size > 0 && (
              <div className="flex items-center gap-1.5 bg-blue-50/80 border border-blue-200 rounded-2xl p-1 shadow-xs animate-in zoom-in-95 duration-150">
                <span className="text-xs font-black text-blue-900 pl-2">
                  {isThai ? "เลือก" : "Selected"} ({selected.size}):
                </span>

                <select
                  value={bulkField}
                  onChange={(e) => {
                    const field = e.target.value as typeof bulkField;
                    setBulkField(field);
                    if (field === "work_day_status") setBulkValue("1NW");
                    else if (field === "work_status") setBulkValue("Normal");
                    else if (field === "dlh_effective_date_time") setBulkValue(date);
                    else setBulkValue("");
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-800 outline-none"
                >
                  <option value="work_day_status">{isThai ? "สถานะงาน (W / 1N / H / O)" : "Work Day Status (W/1N/H/O)"}</option>
                  <option value="work_status">{isThai ? "สถานะการมา (Work Status)" : "Work Status (Normal/Absent/Abnormal)"}</option>
                  <option value="line">{isThai ? "ไลน์ (Line)" : "Line"}</option>
                  <option value="department">{isThai ? "แผนก (Department)" : "Department"}</option>
                  <option value="dlh_effective_date_time">{isThai ? "วันที่ทำงาน (Work Date)" : "Work Date"}</option>
                  <option value="scan_time_in">{isThai ? "เวลา Scan In" : "Scan In Time"}</option>
                  <option value="scan_time_out">{isThai ? "เวลา Scan Out" : "Scan Out Time"}</option>
                </select>

                {bulkField === "work_day_status" ? (
                  <select
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    className="rounded-xl border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-black text-amber-950 outline-none"
                  >
                    <optgroup label={isThai ? "🔄 ไปช่วยงาน Factory อื่น" : "🔄 Cross-Factory Support"}>
                      <option value="1NW">{isThai ? "1NW (ไปช่วยงาน - วันทำงาน)" : "1NW (Support - Work Day)"}</option>
                      <option value="1NH">{isThai ? "1NH (ไปช่วยงาน - วันหยุดนักขัต)" : "1NH (Support - Holiday)"}</option>
                      <option value="1NO">{isThai ? "1NO (ไปช่วยงาน - วันหยุด Off)" : "1NO (Support - Off Day)"}</option>
                    </optgroup>
                    <optgroup label={isThai ? "🏢 ทำงานปกติในโรงงาน" : "🏢 Regular In-House"}>
                      <option value="W">{isThai ? "W (วันทำงานปกติ)" : "W (Working Day)"}</option>
                      <option value="H">{isThai ? "H (วันหยุดนักขัตฤกษ์)" : "H (Public Holiday)"}</option>
                      <option value="O">{isThai ? "O (วันหยุดประจำสัปดาห์)" : "O (Weekly Off Day)"}</option>
                    </optgroup>
                  </select>
                ) : bulkField === "work_status" ? (
                  <select
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    className="rounded-xl border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-950 outline-none"
                  >
                    <option value="Normal">{isThai ? "🟢 ปกติ (Normal)" : "🟢 Normal"}</option>
                    <option value="Absent">{isThai ? "🔴 ไม่มา (Absent)" : "🔴 Absent"}</option>
                    <option value="Abnormal">{isThai ? "🟡 ผิดปกติ (Abnormal)" : "🟡 Abnormal"}</option>
                  </select>
                ) : bulkField === "dlh_effective_date_time" ? (
                  <input
                    type="date"
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    className="rounded-xl border border-blue-300 bg-blue-50/60 px-2 py-1 text-xs font-mono font-bold text-slate-900 outline-none"
                  />
                ) : (
                  <input
                    type={bulkField.startsWith("scan_") ? "time" : "text"}
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    placeholder={isThai ? "กรอกค่า..." : "Enter value..."}
                    className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-semibold w-32 outline-none"
                  />
                )}

                <button
                  type="button"
                  onClick={applyBulkValue}
                  className="rounded-xl bg-blue-600 px-3 py-1 text-xs font-black text-white hover:bg-blue-700 transition cursor-pointer shadow-xs"
                >
                  {isThai ? "ใช้กับทุกคน" : "Apply Bulk"}
                </button>

                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="rounded-xl bg-rose-600 px-3 py-1 text-xs font-black text-white hover:bg-rose-700 transition cursor-pointer shadow-xs"
                  title={isThai ? "ลบพนักงานที่เลือกออกจากวันนี้" : "Delete selected employees"}
                >
                  🗑️ {isThai ? "ลบ" : "Delete"}
                </button>
              </div>
            )}

            {/* ปุ่มล้างตัวกรอง */}
            <button
              type="button"
              onClick={() => {
                setColumnFilters({});
                setSortConfig({ key: "", direction: "" });
                setQuickFilter("all");
                setGlobalSearch("");
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-black transition cursor-pointer shadow-sm ${
                Object.keys(columnFilters).length > 0 || globalSearch || quickFilter !== "all"
                  ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600 shadow-amber-200 active:scale-95"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:text-slate-900 active:scale-95"
              }`}
              title={isThai ? "คลิกเพื่อล้างตัวกรองและการค้นหาทั้งหมด" : "Click to clear all filters and search"}
            >
              <span className="text-sm">🔄</span>
              <span>{isThai ? "ล้างตัวกรอง (Reset)" : "Reset Filters"}</span>
              {(Object.keys(columnFilters).length > 0 || globalSearch || quickFilter !== "all") && (
                <span className="ml-0.5 rounded-full bg-white/30 px-1.5 py-0.2 text-[10px] font-mono font-bold">
                  Active
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Table Area: Clean & Professional Readability */}
        <div className="min-h-0 flex-1 overflow-auto bg-slate-50/40 p-3 sm:p-4">
          {rows.length === 0 ? (
            <div className="py-20 text-center text-slate-400 font-bold">
              {isThai ? "ไม่พบข้อมูลพนักงานในวันที่เลือก" : "No employee records found for this date"}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full min-w-[1220px] border-collapse text-xs table-auto">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/95 text-slate-700 backdrop-blur-xs font-black">
                  <tr>
                    <th className="p-2.5 text-center w-10">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        className="accent-blue-600 h-4 w-4 rounded cursor-pointer mx-auto block"
                        aria-label="Select all visible employees"
                      />
                    </th>
                    <th className="p-2.5 text-center font-black text-slate-900 min-w-[115px] w-28 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <span>{isThai ? "รหัสพนักงาน" : "Employee ID"}</span> {filterButton("employeeId", isThai ? "รหัสพนักงาน" : "Employee ID")}
                      </div>
                    </th>
                    <th className="p-2.5 text-center font-black text-slate-900 min-w-[140px]">
                      <div className="flex items-center justify-center gap-1">
                        <span>{isThai ? "ชื่อ-นามสกุล" : "Name"}</span> {filterButton("name", isThai ? "ชื่อ-นามสกุล" : "Name")}
                      </div>
                    </th>
                    <th className="p-2.5 text-center font-black text-slate-900 min-w-[140px]">
                      <div className="flex items-center justify-center gap-1">
                        <span>{isThai ? "แผนก" : "Department"}</span> {filterButton("department", isThai ? "แผนก" : "Department")}
                      </div>
                    </th>
                    <th className="p-2.5 text-center font-black text-slate-900 min-w-[95px]">
                      <div className="flex items-center justify-center gap-1">
                        <span>{isThai ? "ไลน์" : "Line"}</span> {filterButton("line", isThai ? "ไลน์" : "Line")}
                      </div>
                    </th>
                    <th className="p-2.5 text-center font-black text-slate-900 min-w-[125px] w-32">
                      <div className="flex items-center justify-center gap-1">
                        <span>{isThai ? "วันที่ทำงาน" : "Work Date"}</span> {filterButton("workDate", isThai ? "วันที่ทำงาน" : "Work Date")}
                      </div>
                    </th>
                    <th className="p-2.5 text-center font-black text-slate-900 min-w-[155px]">
                      <div className="flex items-center justify-center gap-1">
                        <span>{isThai ? "สถานะวันทำงาน" : "Work Day Status"}</span> {filterButton("workDayStatus", isThai ? "สถานะวันทำงาน" : "Work Day Status")}
                      </div>
                    </th>
                    <th className="p-2.5 text-center font-black text-slate-900 min-w-[125px] w-32">
                      <div className="flex items-center justify-center gap-1">
                        <span>{isThai ? "สถานะการมา" : "Work Status"}</span> {filterButton("workStatus", isThai ? "สถานะการมา" : "Work Status")}
                      </div>
                    </th>
                    <th className="p-2.5 text-center font-black text-slate-900 min-w-[110px] w-28">
                      <div className="flex items-center justify-center gap-1">
                        <span>{isThai ? "สแกนเข้า" : "Scan In"}</span> {filterButton("scanIn", isThai ? "สแกนเข้า" : "Scan In", "right")}
                      </div>
                    </th>
                    <th className="p-2.5 text-center font-black text-slate-900 min-w-[110px] w-28">
                      <div className="flex items-center justify-center gap-1">
                        <span>{isThai ? "สแกนออก" : "Scan Out"}</span> {filterButton("scanOut", isThai ? "สแกนออก" : "Scan Out", "right")}
                      </div>
                    </th>
                    <th className="p-2.5 text-center font-black text-slate-900 min-w-[140px] w-36">
                      <div className="flex items-center justify-center gap-1">
                        <span>{isThai ? "ความถูกต้อง" : "Validation"}</span> {filterButton("abnormal", isThai ? "ความถูกต้อง" : "Validation", "right")}
                      </div>
                    </th>
                    <th className="p-2.5 text-center w-12 font-black text-slate-900">
                      {isThai ? "จัดการ" : "Action"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRows.map(({ row, originalIndex }) => {
                    const isCross = isOtherFactoryRecord(row);
                    const isSelected = selected.has(originalIndex);
                    const abnormalReason = getAbnormalReason(row);
                    const rowDate = extractDatePart(row.dlh_effective_date_time) || date;

                    const timeInStr = toLocalTime(row.scan_time_in);
                    const timeOutStr = toLocalTime(row.scan_time_out);
                    const lineDisplay = row.line_check || row.line || "";

                    return (
                      <tr
                        key={`${row.dlh_employee_id}-${row.dlh_effective_date_time}-${originalIndex}`}
                        className={`transition-colors hover:bg-blue-50/40 ${isSelected
                            ? "bg-blue-50/70"
                            : abnormalReason
                              ? "bg-rose-50/30"
                              : isCross
                                ? "bg-amber-50/25"
                                : ""
                          }`}
                      >
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelected(originalIndex)}
                            className="accent-blue-600 h-4 w-4 rounded cursor-pointer mx-auto block"
                            aria-label={`Select ${row.dlh_employee_id}`}
                          />
                        </td>

                        {/* ID Inline Editor */}
                        <td className="p-1.5 text-center">
                          <input
                            value={row.dlh_employee_id || ""}
                            onChange={(e) =>
                              onChange(originalIndex, "dlh_employee_id", e.target.value)
                            }
                            className="w-20 text-center font-mono font-black text-slate-900 rounded-xl border border-transparent hover:bg-slate-100 hover:border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 px-1 py-1 text-xs outline-none transition"
                            placeholder="ID..."
                          />
                        </td>

                        {/* Name Inline Editor */}
                        <td className="p-1.5 text-center">
                          <input
                            value={row.employee_name || ""}
                            onChange={(e) =>
                              onChange(originalIndex, "employee_name", e.target.value)
                            }
                            className="w-full min-w-[130px] max-w-[180px] text-center font-bold text-slate-800 rounded-xl border border-transparent hover:bg-slate-100 hover:border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 px-2 py-1 text-xs outline-none transition truncate"
                            placeholder={isThai ? "ชื่อ-นามสกุล..." : "Name..."}
                          />
                        </td>

                        {/* Department Inline Editor */}
                        <td className="p-1.5 text-center">
                          <input
                            value={row.department || ""}
                            onChange={(e) =>
                              onChange(originalIndex, "department", e.target.value)
                            }
                            className="w-full min-w-[130px] max-w-[180px] text-center rounded-xl border border-transparent bg-transparent hover:bg-slate-100 hover:border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 px-2 py-1 text-xs font-semibold text-slate-800 outline-none transition truncate"
                            placeholder={isThai ? "ระบุแผนก..." : "Enter department..."}
                          />
                        </td>

                        {/* Line Inline Editor / Display */}
                        <td className="p-1.5 text-center">
                          <input
                            value={lineDisplay}
                            onChange={(e) => {
                              onChange(originalIndex, "line", e.target.value);
                              onChange(originalIndex, "line_check", e.target.value);
                            }}
                            className="w-24 text-center font-mono font-black text-blue-900 bg-blue-50/70 rounded-xl border border-blue-200 hover:bg-blue-100/70 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 px-1.5 py-1 text-xs outline-none transition shadow-2xs"
                            placeholder={isThai ? "ระบุไลน์..." : "Line..."}
                          />
                        </td>

                        {/* Work Date (dlh_effective_date_time) Inline Editor */}
                        <td className="p-1.5 text-center">
                          <input
                            type="date"
                            value={rowDate}
                            onChange={(e) =>
                              onChange(originalIndex, "dlh_effective_date_time", e.target.value)
                            }
                            className="w-28 text-center rounded-xl bg-slate-50 hover:bg-white border border-slate-200 px-1.5 py-1 text-xs font-mono font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition shadow-2xs cursor-pointer"
                          />
                        </td>

                        {/* Work Day Status Selector Pill */}
                        <td className="p-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <select
                              value={String(row.work_day_status || "").trim().toUpperCase()}
                              onChange={(e) =>
                                onChange(originalIndex, "work_day_status", e.target.value)
                              }
                              className={`w-full max-w-[170px] text-center rounded-xl border px-1.5 py-1 text-xs font-black outline-none transition cursor-pointer shadow-2xs ${isCross
                                  ? "border-amber-300 bg-amber-50 text-amber-950 focus:ring-2 focus:ring-amber-200"
                                  : "border-slate-200 bg-white text-slate-800 focus:border-blue-400"
                                }`}
                            >
                              <optgroup label={isThai ? "🔄 ไปช่วยงาน Factory อื่น" : "🔄 Cross-Factory Support"}>
                                <option value="1NW">{isThai ? "🔄 1NW (วันทำงาน)" : "🔄 1NW (Work Day)"}</option>
                                <option value="1NH">{isThai ? "🔄 1NH (วันหยุดนักขัต)" : "🔄 1NH (Holiday)"}</option>
                                <option value="1NO">{isThai ? "🔄 1NO (วันหยุด Off)" : "🔄 1NO (Off Day)"}</option>
                              </optgroup>
                              <optgroup label={isThai ? "🏢 ทำงานปกติในโรงงาน" : "🏢 Regular In-House"}>
                                <option value="W">{isThai ? "🏢 W (ทำงานปกติ)" : "🏢 W (Working Day)"}</option>
                                <option value="H">{isThai ? "🎉 H (หยุดนักขัต)" : "🎉 H (Holiday)"}</option>
                                <option value="O">{isThai ? "🏖️ O (หยุด Off)" : "🏖️ O (Off Day)"}</option>
                              </optgroup>
                            </select>

                            {/* Destination Tag if exists */}
                            {row.loan_destination && (
                              <span className="shrink-0 rounded-lg bg-purple-50 border border-purple-200 px-1 py-0.5 text-[10px] font-black text-purple-800">
                                ➔ {row.loan_destination}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Work Status (Normal / Absent / Abnormal) Inline Selector */}
                        <td className="p-1.5 text-center">
                          <select
                            value={row.work_status || "Normal"}
                            onChange={(e) =>
                              onChange(originalIndex, "work_status", e.target.value)
                            }
                            className={`w-24 text-center rounded-xl border px-1.5 py-1 text-xs font-black outline-none transition cursor-pointer shadow-2xs ${
                              String(row.work_status || "").toLowerCase() === "absent"
                                ? "border-rose-300 bg-rose-50 text-rose-800"
                                : String(row.work_status || "").toLowerCase() === "abnormal"
                                ? "border-amber-300 bg-amber-50 text-amber-800"
                                : "border-emerald-200 bg-emerald-50 text-emerald-800"
                            }`}
                          >
                            <option value="Normal">{isThai ? "🟢 ปกติ" : "🟢 Normal"}</option>
                            <option value="Absent">{isThai ? "🔴 ไม่มา" : "🔴 Absent"}</option>
                            <option value="Abnormal">{isThai ? "🟡 ผิดปกติ" : "🟡 Abnormal"}</option>
                          </select>
                        </td>

                        {/* คอลัมน์เวลาสแกนบัตรเข้า */}
                        <td className="p-1.5 text-center">
                          <div className="flex justify-center">
                            <input
                              type="time"
                              value={timeInStr}
                              onChange={(e) => {
                                const newIso = combineDateTimeUtc(rowDate, e.target.value);
                                onChange(originalIndex, "scan_time_in", newIso || "");
                              }}
                              className="w-20 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 px-1 py-1 text-xs text-slate-800 font-mono font-black outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition shadow-2xs cursor-pointer text-center"
                              title={isThai ? "เวลาสแกนเข้า" : "Scan in time"}
                            />
                          </div>
                        </td>

                        {/* Separate Scan Out Column */}
                        <td className="p-1.5 text-center">
                          <div className="flex justify-center">
                            <input
                              type="time"
                              value={timeOutStr}
                              onChange={(e) => {
                                const newIso = combineDateTimeUtc(rowDate, e.target.value);
                                onChange(originalIndex, "scan_time_out", newIso || "");
                              }}
                              className="w-20 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 px-1 py-1 text-xs text-slate-800 font-mono font-black outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition shadow-2xs cursor-pointer text-center"
                              title={isThai ? "เวลาสแกนออก" : "Scan out time"}
                            />
                          </div>
                        </td>

                        {/* ตรวจสอบสถานะ */}
                        <td className="p-1.5 text-center">
                          {abnormalReason ? (
                            <span
                              className="inline-flex flex-col items-center justify-center rounded-xl bg-rose-50 border border-rose-200/80 px-2.5 py-1 text-rose-700 shadow-2xs leading-tight transition-transform hover:scale-105"
                              title={abnormalReason}
                            >
                              <span className="inline-flex items-center gap-1 font-black text-xs">
                                <span>⚠️</span>
                                <span>
                                  {abnormalReason.includes("(")
                                    ? abnormalReason.split("(")[0].trim()
                                    : abnormalReason}
                                </span>
                              </span>
                              {abnormalReason.includes("(") && (
                                <span className="text-[10px] font-semibold text-rose-500/90 mt-0.5">
                                  ({abnormalReason.split("(")[1]}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 text-xs font-black text-emerald-700 shadow-2xs">
                              <span className="text-sm">✓</span>
                              <span>{isThai ? "สมบูรณ์" : "Complete"}</span>
                            </span>
                          )}
                        </td>

                        {/* Action Delete */}
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => onDeleteRows([row.dlh_employee_id])}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                            title={isThai ? `ลบ ${row.dlh_employee_id} ออกจากวันนี้` : `Delete ${row.dlh_employee_id}`}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-7 py-3 shrink-0 shadow-xs">
          <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
            <span>
              {isThai
                ? `แสดง ${visibleRows.length === 0 ? 0 : ((currentPage - 1) * pageSize + 1).toLocaleString()} - ${Math.min(currentPage * pageSize, visibleRows.length).toLocaleString()} จาก ${visibleRows.length.toLocaleString()} รายการ`
                : `Showing ${visibleRows.length === 0 ? 0 : ((currentPage - 1) * pageSize + 1).toLocaleString()} - ${Math.min(currentPage * pageSize, visibleRows.length).toLocaleString()} of ${visibleRows.length.toLocaleString()} records`}
            </span>
            <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
              <span className="text-slate-400 font-normal">{isThai ? "แสดงหน้าละ:" : "Per page:"}</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-800 outline-none cursor-pointer"
              >
                <option value={25}>25 {isThai ? "คน" : "rows"}</option>
                <option value={50}>50 {isThai ? "คน" : "rows"}</option>
                <option value={100}>100 {isThai ? "คน" : "rows"}</option>
                <option value={200}>200 {isThai ? "คน" : "rows"}</option>
                <option value={500}>500 {isThai ? "คน" : "rows"}</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage <= 1}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
              title={isThai ? "หน้าแรก" : "First page"}
            >
              «
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
            >
              {isThai ? "‹ ก่อนหน้า" : "‹ Prev"}
            </button>

            <div className="flex items-center gap-1 px-2 text-xs font-black text-slate-800">
              <span>{isThai ? "หน้า" : "Page"}</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={currentPage}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= 1 && val <= totalPages) setCurrentPage(val);
                }}
                className="w-12 text-center rounded-lg border border-slate-300 py-1 font-mono font-black"
              />
              <span>/ {totalPages.toLocaleString()}</span>
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
            >
              {isThai ? "ถัดไป ›" : "Next ›"}
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
              title={isThai ? "หน้าสุดท้าย" : "Last page"}
            >
              »
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
          <div className="text-xs text-slate-500">
            {isThai ? (
              <>* จัดการได้ครบทั้ง <strong>เพิ่มคนใหม่</strong>, <strong>แก้ไขแผนก/สถานะ W-H-O-1N/เวลาสแกน</strong> และ <strong>ลบข้อมูล</strong> ในที่เดียว</>
            ) : (
              <>* Full workspace for <strong>Adding Employees</strong>, <strong>Editing Department/Work Day Status (W/H/O/1N)/Scan Times</strong>, and <strong>Removing Records</strong> in one place.</>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-100 disabled:opacity-50"
            >
              <ModalButtonIcon name="close" />
              {isThai ? "ยกเลิก (Cancel)" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving || rows.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ModalButtonIcon name="save" />
              {isSaving ? "Saving..." : isThai ? "Save Changes (บันทึกข้อมูล)" : "Save Changes"}
            </button>
          </div>
        </div>
      </section>

      {/* หน้าต่างเพิ่มพนักงานใหม่ */}
      {showAddModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 md:p-6 backdrop-blur-md">
          <form
            onSubmit={handleAddNewEmployee}
            className="w-full max-w-4xl rounded-3xl bg-white p-6 md:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200 border border-slate-100 max-h-[92vh] overflow-y-auto"
          >
            {/* ส่วนหัวหน้าต่าง */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white text-2xl font-bold shadow-md shadow-emerald-200">
                  ✨
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    {isThai ? "เพิ่มข้อมูลพนักงานเข้างาน" : "Add Employee Attendance"}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200/60">
                      📅 {isThai ? "วันที่ทำงาน:" : "Work Date:"} {date}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            {/* 1. Quick Search / Profile Card */}
            <div className="space-y-3">
              <label className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center justify-between">
                <span>{isThai ? "1. ค้นหาและเลือกพนักงาน (Employee Selection)" : "1. Employee Selection"}</span>
                {isSearchingEmp && (
                  <span className="text-xs text-emerald-600 font-bold animate-pulse">
                    ⚡ {isThai ? "กำลังค้นหาข้อมูล..." : "Searching..."}
                  </span>
                )}
              </label>

              {/* หากเลือกพนักงานแล้ว จะแสดงการ์ดโปรไฟล์ */}
              {newEmpId ? (
                <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-4 border border-emerald-200/80 shadow-sm animate-in fade-in">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white font-mono font-black text-lg shadow-md shadow-emerald-200">
                      {newEmpId.slice(-3)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-black text-emerald-800 text-base bg-emerald-100/90 px-2.5 py-1 rounded-lg">
                          {newEmpId}
                        </span>
                        <span className="font-black text-slate-900 text-lg">
                          {newEmpName || (isThai ? "ไม่ระบุชื่อ" : "No Name")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 mt-1.5">
                        <span className="text-sm font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                          🏢 {isThai ? "แผนก:" : "Dept:"} {newDept || (isThai ? "ไม่ระบุ" : "Unassigned")}
                        </span>
                        {selectedEmpMeta?.shift && (
                          <span className="text-sm font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                            {isThai ? "กะ:" : "Shift:"} {selectedEmpMeta.shift}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewEmpId("");
                      setNewEmpName("");
                      setNewDept("");
                      setSelectedEmpMeta(null);
                      setEmpSearchQuery("");
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-red-600 transition shadow-sm cursor-pointer"
                  >
                    🔄 {isThai ? "เปลี่ยนคน" : "Change"}
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <input
                      type="text"
                      value={empSearchQuery}
                      onChange={(e) => {
                        setEmpSearchQuery(e.target.value);
                        searchEmployees(e.target.value);
                        setShowEmpDropdown(true);
                      }}
                      onFocus={() => {
                        if (empSearchQuery.trim().length > 0) setShowEmpDropdown(true);
                      }}
                      placeholder={isThai ? "พิมพ์รหัสพนักงานหรือชื่อพนักงาน..." : "Type employee ID or name..."}
                      className="w-full rounded-2xl border-2 border-emerald-300 bg-white px-5 py-3.5 text-base font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 transition shadow-sm"
                      autoFocus
                    />
                    {empSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setEmpSearchQuery("");
                          setEmpSuggestions([]);
                          setShowEmpDropdown(false);
                        }}
                        className="absolute right-4 top-4 text-sm text-slate-400 hover:text-slate-600 font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Suggestions Dropdown */}
                  {showEmpDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 max-h-72 overflow-y-auto rounded-2xl border-2 border-emerald-500 bg-white p-2.5 shadow-2xl z-[300] animate-in fade-in zoom-in-95">
                      {empSuggestions.length > 0 ? (
                        <>
                          <div className="px-3 py-2 text-xs font-bold text-emerald-800 uppercase tracking-wider border-b border-emerald-100 flex items-center justify-between">
                            <span>{isThai ? `พบ ${empSuggestions.length} รายการ — คลิกเพื่อเลือก` : `Found ${empSuggestions.length} items — click to select`}</span>
                            <span className="text-[11px] text-emerald-600 font-bold">✨ Quick Select</span>
                          </div>
                          {empSuggestions.map((emp, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectEmployee(emp);
                              }}
                              className="w-full flex items-center justify-between px-3.5 py-3 text-left rounded-xl hover:bg-emerald-50 active:bg-emerald-100 transition group border-b border-slate-50 last:border-0 cursor-pointer"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-black text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md text-sm shadow-sm">
                                  {emp.code || emp.dlh_employee_id}
                                </span>
                                <span className="font-bold text-base text-slate-800 group-hover:text-emerald-900">
                                  {emp.name || emp.employee_name || (isThai ? "ไม่ระบุชื่อ" : "No Name")}
                                </span>
                              </div>
                              <div className="flex items-center gap-2.5">
                                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                                  {emp.department || emp.dept || emp.line || "-"}
                                </span>
                                <span className="text-emerald-700 font-bold text-sm bg-emerald-100 px-2.5 py-1 rounded-md">
                                  {isThai ? "เลือก ➔" : "Select ➔"}
                                </span>
                              </div>
                            </button>
                          ))}
                        </>
                      ) : (
                        <div className="p-4 text-center text-sm font-semibold text-slate-500">
                          {isSearchingEmp ? (isThai ? "⏳ กำลังค้นหาข้อมูลพนักงาน..." : "⏳ Searching employees...") : (isThai ? "❌ ไม่พบข้อมูลพนักงานที่ตรงกับคำค้นหา" : "❌ No matching employee records")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Manual Edit Grid (Always accessible) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 pt-1">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  {isThai ? "รหัสพนักงาน (ID) *" : "Employee ID *"}
                </label>
                <input
                  required
                  value={newEmpId}
                  onChange={(e) => setNewEmpId(e.target.value)}
                  placeholder="e.g. 5001234"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-2.5 text-sm font-black text-slate-900 outline-none focus:bg-white focus:border-emerald-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  {isThai ? "ชื่อ-นามสกุล (Name)" : "Employee Name"}
                </label>
                <input
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  placeholder="e.g. นายสมชาย ใจดี"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-2.5 text-sm font-black text-slate-900 outline-none focus:bg-white focus:border-emerald-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  {isThai ? "แผนก (Department)" : "Department"}
                </label>
                <input
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  placeholder="e.g. P180/SYSTEM ENGINEERING"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-2.5 text-sm font-black text-slate-900 outline-none focus:bg-white focus:border-emerald-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  {isThai ? "ไลน์ (Line)" : "Line"}
                </label>
                <input
                  value={newEmpLine}
                  onChange={(e) => setNewEmpLine(e.target.value)}
                  placeholder="e.g. SMD, MAIN, QC"
                  className="w-full rounded-xl border border-blue-300 bg-blue-50/40 px-4 py-2.5 text-sm font-black text-blue-900 outline-none focus:bg-white focus:border-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  {isThai ? "วันที่ทำงาน (Work Date) *" : "Work Date *"}
                </label>
                <input
                  type="date"
                  required
                  value={newWorkDate}
                  onChange={(e) => setNewWorkDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-2.5 text-sm font-mono font-black text-slate-900 outline-none focus:bg-white focus:border-emerald-500 transition"
                />
              </div>
            </div>

            {/* Work Status (Segmented Pill Buttons) */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <label className="block text-sm font-black text-slate-800 uppercase tracking-wider">
                {isThai ? "สถานะการมาทำงาน (Work Status)" : "Work Status"}
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { value: "Normal", label: isThai ? "🟢 ปกติ (Normal)" : "🟢 Normal", active: "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200" },
                  { value: "Absent", label: isThai ? "🔴 ไม่มา (Absent)" : "🔴 Absent", active: "bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-200" },
                  { value: "Abnormal", label: isThai ? "🟡 ผิดปกติ (Abnormal)" : "🟡 Abnormal", active: "bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-200" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setNewWorkStatus(item.value)}
                    className={`rounded-xl border p-3 text-sm font-black text-center transition cursor-pointer ${
                      newWorkStatus === item.value
                        ? item.active
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:border-emerald-300"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Work Day Status (Segmented Pill Buttons) */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <label className="block text-sm font-black text-slate-800 uppercase tracking-wider">
                {isThai ? "2. สถานะวันทำงาน (Work Day Status)" : "2. Work Day Status"}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {[
                  { value: "W", label: isThai ? "🏢 วันทำงานปกติ (W)" : "🏢 Regular (W)", bg: "hover:border-blue-400", active: "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200" },
                  { value: "H", label: isThai ? "🏖️ วันหยุดนักขัต (H)" : "🏖️ Holiday (H)", bg: "hover:border-purple-400", active: "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-200" },
                  { value: "O", label: isThai ? "🛌 วันหยุด Off (O)" : "🛌 Off Day (O)", bg: "hover:border-emerald-400", active: "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200" },
                  { value: "1NW", label: isThai ? "🔄 ช่วยงานข้าม Factory" : "🔄 Cross-Factory (1NW)", bg: "hover:border-amber-400", active: "bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-200" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setNewWorkDayStatus(item.value)}
                    className={`rounded-xl border p-3 text-sm font-black text-left transition cursor-pointer ${newWorkDayStatus === item.value
                        ? item.active
                        : `bg-slate-50 text-slate-700 border-slate-200 ${item.bg}`
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Shift & Attendance Quick Presets */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-black text-slate-800 uppercase tracking-wider">
                  {isThai ? "3. เลือกรอบกะและเวลาสแกน (Shift & Scan Times)" : "3. Shift & Scan Times"}
                </label>
                <span className="text-xs font-bold text-slate-500">{isThai ? "คลิกปุ่มเพื่อตั้งเวลาด่วน" : "1-Click Shift Presets"}</span>
              </div>

              {/* Quick Shift Chips */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => applyShiftPreset("day")}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-sm font-black transition shadow-sm cursor-pointer ${activeShiftPreset === "day"
                      ? "bg-amber-500 text-white border-amber-500 shadow-amber-200"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:border-amber-300"
                    }`}
                >
                  <span className="text-xl mb-0.5">🌅</span>
                  <span>{isThai ? "กะเช้า (Day)" : "Day Shift"}</span>
                  <span className={`text-xs font-bold mt-0.5 ${activeShiftPreset === "day" ? "text-amber-100" : "text-slate-500"}`}>
                    08:00 - 20:00
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => applyShiftPreset("night")}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-sm font-black transition shadow-sm cursor-pointer ${activeShiftPreset === "night"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-200"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-300"
                    }`}
                >
                  <span className="text-xl mb-0.5">🌙</span>
                  <span>{isThai ? "กะดึก (Night)" : "Night Shift"}</span>
                  <span className={`text-xs font-bold mt-0.5 ${activeShiftPreset === "night" ? "text-indigo-200" : "text-slate-500"}`}>
                    20:00 - 08:00
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => applyShiftPreset("8h")}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-sm font-black transition shadow-sm cursor-pointer ${activeShiftPreset === "8h"
                      ? "bg-blue-600 text-white border-blue-600 shadow-blue-200"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-300"
                    }`}
                >
                  <span className="text-xl mb-0.5">🏢</span>
                  <span>{isThai ? "ปกติ (Office)" : "Office Shift"}</span>
                  <span className={`text-xs font-bold mt-0.5 ${activeShiftPreset === "8h" ? "text-blue-100" : "text-slate-500"}`}>
                    08:00 - 16:45
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => applyShiftPreset("absent")}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-sm font-black transition shadow-sm cursor-pointer ${activeShiftPreset === "absent"
                      ? "bg-rose-600 text-white border-rose-600 shadow-rose-200"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:border-rose-300"
                    }`}
                >
                  <span className="text-xl mb-0.5">🚫</span>
                  <span>{isThai ? "ไม่สแกน (Absent)" : "Absent"}</span>
                  <span className={`text-xs font-bold mt-0.5 ${activeShiftPreset === "absent" ? "text-rose-200" : "text-slate-500"}`}>
                    {isThai ? "ไม่มีเวลาสแกน" : "No Scan Times"}
                  </span>
                </button>
              </div>

              {/* ช่องกรอกเวลาเข้า-ออกงาน */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-black text-slate-800">🟢 {isThai ? "เวลาสแกนเข้า (Scan In)" : "Scan In Time"}</span>
                    <span className="text-xs font-black text-slate-500 font-mono">{date}</span>
                  </div>
                  <input
                    type="time"
                    value={newScanIn ? newScanIn.split("T")[1]?.slice(0, 5) || "08:00" : ""}
                    onChange={(e) => {
                      setActiveShiftPreset("custom");
                      setNewScanIn(e.target.value ? `${date}T${e.target.value}` : "");
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-lg font-mono font-black text-slate-900 outline-none focus:border-emerald-500 shadow-inner text-center"
                  />
                </div>

                <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-black text-slate-800">🔴 {isThai ? "เวลาสแกนออก (Scan Out)" : "Scan Out Time"}</span>
                    <span className="text-xs font-black text-slate-500 font-mono">
                      {newScanOut ? newScanOut.split("T")[0] : date}
                    </span>
                  </div>
                  <input
                    type="time"
                    value={newScanOut ? newScanOut.split("T")[1]?.slice(0, 5) || "20:00" : ""}
                    onChange={(e) => {
                      setActiveShiftPreset("custom");
                      const targetDate = activeShiftPreset === "night" ? nextDateKey : date;
                      setNewScanOut(e.target.value ? `${targetDate}T${e.target.value}` : "");
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-lg font-mono font-black text-slate-900 outline-none focus:border-emerald-500 shadow-inner text-center"
                  />
                </div>
              </div>
            </div>

            {/* ปุ่มดำเนินการในหน้าต่าง */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                {isThai ? "ยกเลิก (Cancel)" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={!newEmpId}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-3.5 text-base font-black text-white shadow-xl shadow-emerald-200 hover:from-emerald-700 hover:to-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>➕</span>
                <span>{isThai ? "เพิ่มเข้าในรายการ (Add Employee)" : "Add Employee Record"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* หน้าต่างคู่มือการใช้งานระบบแบบโต้ตอบ */}
      {showHelpManual && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/75 p-4 md:p-6 backdrop-blur-md">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 md:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200 border border-slate-100 max-h-[92vh] flex flex-col">
            {/* ส่วนหัว (Header) */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white text-2xl font-bold shadow-md shadow-indigo-200">
                  📖
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    {manualLang === "TH" ? "คู่มือการใช้งานระบบจัดการข้อมูล" : "Attendance Workspace User Guide"}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">
                    {manualLang === "TH"
                      ? "คำแนะนำการใช้งานระบบจัดการกำลังพล เวลาทำงาน และการบันทึกข้อมูล"
                      : "User Guide for Manpower Planning, Attendance Rules & Data Management"}
                  </p>
                </div>
              </div>

              {/* Language Switch & Close */}
              <div className="flex items-center gap-3">
                {/* Language Toggle Pill */}
                <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200/80 shadow-inner">
                  <button
                    type="button"
                    onClick={() => {
                      setManualLang("TH");
                      setLanguage("th");
                    }}
                    className={`rounded-lg px-3 py-1 text-xs font-black transition cursor-pointer ${manualLang === "TH"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    TH
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManualLang("EN");
                      setLanguage("en");
                    }}
                    className={`rounded-lg px-3 py-1 text-xs font-black transition cursor-pointer ${manualLang === "EN"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    EN
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowHelpManual(false)}
                  className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Manual Content Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs text-slate-700">
              {manualLang === "TH" ? (
                <>
                  {/* Section 1 TH: ความหมายรหัสสถานะ */}
                  <div className="rounded-2xl bg-gradient-to-r from-violet-50 to-purple-50 p-4 border border-purple-200/80 shadow-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-600 text-white font-black text-xs">1</span>
                      <h4 className="font-black text-sm text-purple-950">🏷️ ความหมายของรหัสสถานะวันทำงาน (Work Day Status)</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 font-medium">
                      <div className="rounded-xl bg-white p-2.5 border border-purple-100 shadow-2xs">
                        <span className="inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-800 mb-1">W (Work)</span>
                        <p className="text-[11px] text-slate-600">วันทำงานปกติของพนักงาน</p>
                      </div>
                      <div className="rounded-xl bg-white p-2.5 border border-purple-100 shadow-2xs">
                        <span className="inline-block rounded-md bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-800 mb-1">H (Holiday)</span>
                        <p className="text-[11px] text-slate-600">วันหยุดนักขัตฤกษ์ / ประเพณี</p>
                      </div>
                      <div className="rounded-xl bg-white p-2.5 border border-purple-100 shadow-2xs">
                        <span className="inline-block rounded-md bg-rose-100 px-2 py-0.5 text-xs font-black text-rose-800 mb-1">O (Off)</span>
                        <p className="text-[11px] text-slate-600">วันหยุดประจำสัปดาห์</p>
                      </div>
                    </div>
                    <div className="mt-2.5 rounded-xl bg-purple-100/60 p-2 text-[11px] text-purple-900 font-bold flex items-center gap-1.5">
                      <span>💡</span>
                      <span>รหัสที่มีคำว่า <b>1N</b> นำหน้า (เช่น <code className="bg-white px-1 py-0.5 rounded border border-purple-200">1NW</code>, <code className="bg-white px-1 py-0.5 rounded border border-purple-200">1NH</code>, <code className="bg-white px-1 py-0.5 rounded border border-purple-200">1NO</code>) = เป็นพนักงานที่ย้ายไปช่วยงานข้ามโรงงาน (Cross-Factory)</span>
                    </div>
                  </div>

                  {/* Section 2 TH: กฎ 4 ชั่วโมง */}
                  <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border border-blue-200/80 shadow-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-xs">2</span>
                      <h4 className="font-black text-sm text-blue-950">⏱️ กฎการนับชั่วโมงทำงานขั้นต่ำ 4 ชม. (4-Hour Rule)</h4>
                    </div>
                    <ul className="list-disc list-inside space-y-1.5 pl-1 font-medium text-slate-700">
                      <li><strong className="text-blue-900 font-bold">กะเช้า (Day Shift):</strong> เริ่มนับเวลา <strong className="text-emerald-700 font-bold">08:00 น.</strong> หากสแกนออกก่อน 12:00 น. (&lt; 4 ชม.) จะถือว่า <strong className="text-rose-600 font-bold">ไม่มาทำงาน / ขาดงาน (Absent)</strong></li>
                      <li><strong className="text-indigo-900 font-bold">กะดึก (Night Shift):</strong> เริ่มนับเวลา <strong className="text-emerald-700 font-bold">20:00 น.</strong> หากสแกนออกก่อน 00:00 น. (&lt; 4 ชม.) จะถือว่า <strong className="text-rose-600 font-bold">ไม่มาทำงาน / ขาดงาน (Absent)</strong></li>
                      <li>หากพนักงานสแกนเข้าก่อนเวลาเริ่มกะ ระบบจะปรับให้นับจากเวลาเริ่มกะที่ถูกต้องอัตโนมัติ</li>
                    </ul>
                  </div>

                  {/* Section 3 TH: การแก้ไขข้อมูลในตาราง */}
                  <div className="rounded-2xl bg-gradient-to-r from-cyan-50 to-blue-50 p-4 border border-cyan-200/80 shadow-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-700 text-white font-black text-xs">3</span>
                      <h4 className="font-black text-sm text-cyan-950">📝 การแก้ไขข้อมูลโดยตรงบนตาราง (Direct Table Edit)</h4>
                    </div>
                    <ul className="list-disc list-inside space-y-1.5 pl-1 font-medium text-slate-700">
                      <li><strong className="text-cyan-900 font-bold">แก้ไข Line หรือ Shift:</strong> คลิกที่ช่อง Dropdown บนแถวของพนักงานคนนั้นเพื่อเปลี่ยน Line หรือกะทำงานได้ทันที</li>
                      <li><strong className="text-cyan-900 font-bold">แก้ไขเวลาสแกน:</strong> คลิกที่ช่องเวลาเข้า-ออก แล้วพิมพ์หรือเลือกเวลาใหม่ได้เลย</li>
                      <li><strong className="text-cyan-900 font-bold">ปุ่มลัดสลับสถานะ:</strong> คลิกปุ่ม <code className="bg-amber-100 px-1 py-0.5 rounded font-bold text-amber-900">+ 1NW</code> เพื่อเปลี่ยนเป็นพนักงานช่วยงานข้ามโรงงาน หรือกด <code className="bg-blue-100 px-1 py-0.5 rounded font-bold text-blue-900">เป็น W</code> เพื่อกลับเป็นปกติ</li>
                    </ul>
                  </div>

                  {/* Section 4 TH: เพิ่มคนใหม่ & กะด่วน */}
                  <div className="rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 p-4 border border-emerald-200/80 shadow-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white font-black text-xs">4</span>
                      <h4 className="font-black text-sm text-emerald-950">✨ การเพิ่มพนักงานใหม่ (Add New Employee)</h4>
                    </div>
                    <ul className="list-disc list-inside space-y-1.5 pl-1 font-medium text-slate-700">
                      <li>กดปุ่ม <strong className="text-emerald-700 font-bold">➕ เพิ่มคนใหม่</strong> ที่มุมขวาบน</li>
                      <li>พิมพ์รหัสพนักงาน (เช่น <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono font-bold">6866</code>) หรือพิมพ์ชื่อ ระบบจะค้นหาและแสดง <strong className="text-emerald-900 font-bold">Smart Profile Card</strong> พร้อมแผนกและไลน์ให้อัตโนมัติ</li>
                      <li>กดเลือกกะด่วนใน 1 คลิก:
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2 font-bold text-[11px]">
                          <span className="bg-amber-100 text-amber-900 px-2 py-1 rounded-lg text-center">🌅 กะเช้า (08:00 - 20:00)</span>
                          <span className="bg-indigo-100 text-indigo-900 px-2 py-1 rounded-lg text-center">🌙 กะดึก (20:00 - 08:00)</span>
                          <span className="bg-blue-100 text-blue-900 px-2 py-1 rounded-lg text-center">🏢 ปกติ (08:00 - 16:45)</span>
                          <span className="bg-rose-100 text-rose-900 px-2 py-1 rounded-lg text-center">🚫 ไม่สแกน (Absent)</span>
                        </div>
                      </li>
                    </ul>
                  </div>

                  {/* Section 5 TH: แก้ไข/ลบเป็นชุด & กรองข้อมูล */}
                  <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 p-4 border border-amber-200/80 shadow-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-600 text-white font-black text-xs">5</span>
                      <h4 className="font-black text-sm text-amber-950">⚡ การจัดการเป็นชุด (Bulk Edit / Delete) & การกรองข้อมูล</h4>
                    </div>
                    <ul className="list-disc list-inside space-y-1.5 pl-1 font-medium text-slate-700">
                      <li><strong className="text-blue-900 font-bold">แก้ไขพร้อมกันหลายคน:</strong> ติ๊กเลือกพนักงานด้านหน้าหลายคน → เลือกค่าที่ต้องการเปลี่ยนที่แถบด้านบน (เช่น เปลี่ยนเป็นกะเดียวกัน หรือเปลี่ยนสถานะ) → กด <strong className="text-blue-700 font-bold">Apply</strong></li>
                      <li><strong className="text-rose-900 font-bold">ลบเป็นชุด:</strong> ติ๊กเลือกพนักงานที่ต้องการลบ → กดปุ่ม <strong className="text-rose-700 font-bold">🗑️ ลบที่เลือก</strong></li>
                      <li><strong className="text-amber-900 font-bold">การกรองแบบ Excel:</strong> กดปุ่มกรวย 🔍 ที่หัวคอลัมน์ เพื่อพิมพ์ค้นหาหรือเลือกเฉพาะแผนก/ไลน์ที่ต้องการดู</li>
                    </ul>
                  </div>

                  {/* Section 6 TH: ตรวจสอบความผิดปกติและบันทึก */}
                  <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 shadow-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-700 text-white font-black text-xs">6</span>
                      <h4 className="font-black text-sm text-slate-900">🛡️ การตรวจสอบความผิดปกติและบันทึกข้อมูล (Save & Health Check)</h4>
                    </div>
                    <ul className="list-disc list-inside space-y-1.5 pl-1 font-medium text-slate-700">
                      <li><strong className="text-rose-700 font-bold">แท็บ ⚠️ วัน/สแกนผิดปกติ:</strong> ใช้ตรวจดูคนที่ไม่มีเวลาสแกนบัตร หรือวันที่สแกนไม่ตรงกับวันทำงาน เพื่อแก้ไขให้ถูกต้อง</li>
                      <li>เมื่อแก้ไขข้อมูลเสร็จสิ้นแล้ว <strong className="text-emerald-700 font-bold">อย่าลืมกดปุ่ม "💾 Save Changes (บันทึกข้อมูล)"</strong> ที่มุมขวาล่างสุด เพื่ออัปเดตลงระบบและให้ Dashboard คำนวณยอดใหม่ทันที</li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  {/* Section 1 EN */}
                  <div className="rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 p-4 border border-purple-200/80 shadow-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-600 text-white font-black text-xs">1</span>
                      <h4 className="font-black text-sm text-purple-950">🏷️ Work Day Status Code Reference</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 font-medium">
                      <div className="rounded-xl bg-white p-2.5 border border-purple-100 shadow-2xs">
                        <span className="inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-800 mb-1">W (Work)</span>
                        <p className="text-[11px] text-slate-600">Standard scheduled working day.</p>
                      </div>
                      <div className="rounded-xl bg-white p-2.5 border border-purple-100 shadow-2xs">
                        <span className="inline-block rounded-md bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-800 mb-1">H (Holiday)</span>
                        <p className="text-[11px] text-slate-600">Public or factory holiday.</p>
                      </div>
                      <div className="rounded-xl bg-white p-2.5 border border-purple-100 shadow-2xs">
                        <span className="inline-block rounded-md bg-rose-100 px-2 py-0.5 text-xs font-black text-rose-800 mb-1">O (Off)</span>
                        <p className="text-[11px] text-slate-600">Weekly off day / rest day.</p>
                      </div>
                    </div>
                    <div className="mt-2.5 rounded-xl bg-purple-100/60 p-2 text-[11px] text-purple-900 font-bold flex items-center gap-1.5">
                      <span>💡</span>
                      <span>Codes starting with <b>1N</b> (e.g. <code className="bg-white px-1 py-0.5 rounded border border-purple-200">1NW</code>, <code className="bg-white px-1 py-0.5 rounded border border-purple-200">1NH</code>, <code className="bg-white px-1 py-0.5 rounded border border-purple-200">1NO</code>) denote employees dispatched to support other factories (Cross-Factory).</span>
                    </div>
                  </div>

                  {/* Section 2 EN */}
                  <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border border-blue-200/80 shadow-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-xs">2</span>
                      <h4 className="font-black text-sm text-blue-950">⏱️ Minimum 4-Hour Work Duration Rule</h4>
                    </div>
                    <ul className="list-disc list-inside space-y-1.5 pl-1 font-medium text-slate-700">
                      <li><strong className="text-blue-900 font-bold">Day Shift:</strong> Work hours start counting at <strong className="text-emerald-700 font-bold">08:00 AM</strong>. Scanning out before 12:00 PM (&lt; 4 hours) is recorded as <strong className="text-rose-600 font-bold">Absent</strong>.</li>
                      <li><strong className="text-indigo-900 font-bold">Night Shift:</strong> Work hours start counting at <strong className="text-emerald-700 font-bold">08:00 PM (20:00)</strong>. Scanning out before 00:00 AM (&lt; 4 hours) is recorded as <strong className="text-rose-600 font-bold">Absent</strong>.</li>
                      <li>Early scan-in times are automatically clamped to standard shift start.</li>
                    </ul>
                  </div>

                  {/* Section 3 EN */}
                  <div className="rounded-2xl bg-gradient-to-r from-cyan-50 to-blue-50 p-4 border border-cyan-200/80 shadow-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-700 text-white font-black text-xs">3</span>
                      <h4 className="font-black text-sm text-cyan-950">📝 Direct Table Editing</h4>
                    </div>
                    <ul className="list-disc list-inside space-y-1.5 pl-1 font-medium text-slate-700">
                      <li><strong className="text-cyan-900 font-bold">Edit Line / Shift:</strong> Click directly on dropdowns in any employee row to change line or shift.</li>
                      <li><strong className="text-cyan-900 font-bold">Edit Timestamps:</strong> Click in the Scan In / Out boxes to update time immediately.</li>
                      <li><strong className="text-cyan-900 font-bold">Status Toggle:</strong> Click <code className="bg-amber-100 px-1 py-0.5 rounded font-bold text-amber-900">+ 1NW</code> to mark as Cross-Factory support or <code className="bg-blue-100 px-1 py-0.5 rounded font-bold text-blue-900">to W</code> for Normal In-House.</li>
                    </ul>
                  </div>

                  {/* Section 4 EN */}
                  <div className="rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 p-4 border border-emerald-200/80 shadow-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white font-black text-xs">4</span>
                      <h4 className="font-black text-sm text-emerald-950">✨ Adding New Employee Records</h4>
                    </div>
                    <ul className="list-disc list-inside space-y-1.5 pl-1 font-medium text-slate-700">
                      <li>Click the <strong className="text-emerald-700 font-bold">➕ Add Record</strong> button at the top right.</li>
                      <li>Type an Employee ID or name; the system displays an instant <strong className="text-emerald-900 font-bold">Smart Profile Card</strong> with department and line.</li>
                      <li>Select a 1-Click Shift Preset:
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2 font-bold text-[11px]">
                          <span className="bg-amber-100 text-amber-900 px-2 py-1 rounded-lg text-center">🌅 Day (08:00 - 20:00)</span>
                          <span className="bg-indigo-100 text-indigo-900 px-2 py-1 rounded-lg text-center">🌙 Night (20:00 - 08:00)</span>
                          <span className="bg-blue-100 text-blue-900 px-2 py-1 rounded-lg text-center">🏢 Office (08:00 - 16:45)</span>
                          <span className="bg-rose-100 text-rose-900 px-2 py-1 rounded-lg text-center">🚫 Absent</span>
                        </div>
                      </li>
                    </ul>
                  </div>

                  {/* Section 5 EN */}
                  <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 p-4 border border-amber-200/80 shadow-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-600 text-white font-black text-xs">5</span>
                      <h4 className="font-black text-sm text-amber-950">⚡ Bulk Actions & Column Filters</h4>
                    </div>
                    <ul className="list-disc list-inside space-y-1.5 pl-1 font-medium text-slate-700">
                      <li><strong className="text-blue-900 font-bold">Bulk Edit:</strong> Check multiple employee boxes → select target field from top bar → click <strong className="text-blue-700 font-bold">Apply</strong>.</li>
                      <li><strong className="text-rose-900 font-bold">Bulk Delete:</strong> Check employee boxes → click <strong className="text-rose-700 font-bold">🗑️ Delete Selected</strong>.</li>
                      <li><strong className="text-amber-900 font-bold">Excel Filter:</strong> Click the filter icon 🔍 on any column header to search or filter specific departments and lines.</li>
                    </ul>
                  </div>

                  {/* Section 6 EN */}
                  <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 shadow-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-700 text-white font-black text-xs">6</span>
                      <h4 className="font-black text-sm text-slate-900">🛡️ Anomaly Health Checks & Saving Changes</h4>
                    </div>
                    <ul className="list-disc list-inside space-y-1.5 pl-1 font-medium text-slate-700">
                      <li><strong className="text-rose-700 font-bold">⚠️ Anomalies Tab:</strong> Quickly isolate records with missing timestamps or mismatched dates.</li>
                      <li>After finishing your changes, remember to click <strong className="text-emerald-700 font-bold">💾 Save Changes</strong> at the bottom right to commit to the database and re-aggregate the dashboard.</li>
                    </ul>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setShowHelpManual(false)}
                className="rounded-2xl bg-indigo-600 px-7 py-2.5 text-xs font-black text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition cursor-pointer"
              >
                {manualLang === "TH" ? "รับทราบและเข้าใจแล้ว (Close Guide)" : "Got It, Close Guide"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
