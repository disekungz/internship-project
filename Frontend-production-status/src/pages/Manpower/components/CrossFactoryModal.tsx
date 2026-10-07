/**
 * Component: CrossFactoryModal
 * หน้าต่างแก้ไขและตรวจสอบข้อมูลพนักงานที่ถูกยืมตัวหรือไปช่วยงานต่างโรงงาน (Cross Factory / Loan)
 * - กำหนดสถานะกะ (Work Day Status) และแสดง Badge ภาษาไทย (ไปช่วยงาน Factory อื่น, วันทำงานปกติ, วันหยุด)
 * - บันทึกและซิงค์ข้อมูลกลับไปยัง Backend
 */
import { useMemo, useState } from "react";
import { ExcelColumnFilter } from "./ImportPreviewModal";
import { extractDatePart, isOtherFactoryRecord } from "../aggregation";
import ModalButtonIcon from "./ModalButtonIcon";

type AttendanceRow = {
  dlh_employee_id: string;
  employee_name?: string;
  dlh_effective_date_time: string;
  work_day_status?: string | null;
  work_status?: string | null;
  department?: string | null;
  emp_department?: string | null;
  scan_time_in?: string | null;
  scan_time_out?: string | null;
  loan_destination?: string | null;
  is_loan_exclude?: boolean | null;
};

type Props = {
  date: string;
  rows: AttendanceRow[];
  isSaving: boolean;
  onChange: (index: number, field: keyof AttendanceRow, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

const toDateTimeLocal = (value?: string | null) => {
  if (!value) return "";
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  return match ? `${match[1]}T${match[2]}` : "";
};

/**
 * แปลงรหัส Work Day Status เป็นข้อความภาษาไทยและสไตล์ Badge สำหรับแสดงผล
 */
const getWorkDayStatusInfo = (status?: string | null) => {
  const s = String(status || "").trim().toUpperCase();
  if (s.startsWith("1N")) {
    const isHoliday = s.endsWith("H");
    const isOff = s.endsWith("O");
    const base = isHoliday ? "H" : isOff ? "O" : "W";
    const typeDesc = isHoliday ? "(วันหยุดนักขัต)" : isOff ? "(วันหยุด Off)" : "(วันทำงาน)";
    return {
      label: `ไปช่วยงาน Factory อื่น ${typeDesc}`,
      badge: "bg-amber-100 text-amber-900 border-amber-300",
      isCross: true,
      base,
    };
  }
  if (s === "W" || s.endsWith("W")) return { label: "วันทำงานปกติ (Working Day)", badge: "bg-blue-100 text-blue-900 border-blue-200", isCross: false, base: "W" };
  if (s === "H" || s.endsWith("H")) return { label: "วันหยุดนักขัตฤกษ์ (Holiday)", badge: "bg-purple-100 text-purple-900 border-purple-200", isCross: false, base: "H" };
  if (s === "O" || s.endsWith("O")) return { label: "วันหยุดประจำสัปดาห์ (Off Day)", badge: "bg-emerald-100 text-emerald-900 border-emerald-200", isCross: false, base: "O" };
  return { label: s || "ไม่ระบุ", badge: "bg-slate-100 text-slate-700 border-slate-200", isCross: false, base: "W" };
};

export default function CrossFactoryModal({
  date,
  rows,
  isSaving,
  onChange,
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
  // เริ่มต้นแสดงเฉพาะรายการที่ไปช่วยงานข้ามโรงงาน เพื่อให้ผู้ใช้ตรวจสอบได้ทันที
  const [quickFilter, setQuickFilter] = useState<"all" | "cross_only" | "internal_only" | "abnormal_only">("cross_only");
  const [selectedBulkCode, setSelectedBulkCode] = useState<"1NW" | "1NH" | "1NO" | "W" | "H" | "O">("1NW");

  // ตรวจหาวัน/เวลาหรือสถานะผิดปกติ
  const nextDate = new Date(`${date}T12:00:00+07:00`);
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDateKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
  const previousDate = new Date(`${date}T12:00:00+07:00`);
  previousDate.setDate(previousDate.getDate() - 1);
  const previousDateKey = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}-${String(previousDate.getDate()).padStart(2, "0")}`;

  const getAbnormalReason = (row: AttendanceRow) => {
    const scanInDate = extractDatePart(row.scan_time_in);
    const scanOutDate = extractDatePart(row.scan_time_out);
    const validDates = new Set([previousDateKey, date, nextDateKey]);
    if (
      (scanInDate && !validDates.has(scanInDate)) ||
      (scanOutDate && !validDates.has(scanOutDate))
    )
      return "วันที่สแกนไม่ตรงวันทำงาน (Date Mismatch)";

    const status = String(row.work_status || "").trim().toLowerCase();
    const hasScanIn = Boolean(row.scan_time_in);
    const hasScanOut = Boolean(row.scan_time_out);
    if (status === "absent" && (hasScanIn || hasScanOut))
      return "สถานะ Absent แต่มีเวลาสแกน";
    if (
      (status === "normal" || status === "abnormal") &&
      hasScanIn !== hasScanOut
    )
      return "สแกนไม่ครบ (เข้า/ออก ไม่สมบูรณ์)";

    const wds = String(row.work_day_status || "").trim().toUpperCase();
    if (!wds) return "ไม่มี Work Day Status (W/H/O/1N)";
    return "";
  };

  const columnGetters: Record<string, (row: AttendanceRow) => string> = {
    employeeId: (row) => String(row.dlh_employee_id || ""),
    name: (row) => String(row.employee_name || "-"),
    workDate: (row) => extractDatePart(row.dlh_effective_date_time),
    workDayStatus: (row) => getWorkDayStatusInfo(row.work_day_status).label,
    workStatus: (row) => String(row.work_status || "-"),
    department: (row) => String(row.department || "-"),
    destination: (row) => String(row.loan_destination || "-"),
    crossFactoryStatus: (row) =>
      isOtherFactoryRecord(row) ? "ไปช่วยงานข้าม Factory" : "ทำงานในโรงงานปกติ",
    abnormal: (row) => getAbnormalReason(row) || "ปกติ",
    scanIn: (row) => toDateTimeLocal(row.scan_time_in) || "-",
    scanOut: (row) => toDateTimeLocal(row.scan_time_out) || "-",
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

  const visibleRows = useMemo(() => {
    const result = rows
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row }) => {
        if (quickFilter === "cross_only" && !isOtherFactoryRecord(row)) return false;
        if (quickFilter === "internal_only" && isOtherFactoryRecord(row)) return false;
        if (quickFilter === "abnormal_only" && !getAbnormalReason(row)) return false;
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
  }, [rows, columnFilters, sortConfig, quickFilter]);

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

  // กำหนดสถานะ Work Day Status พร้อมกันหลายรายการที่เลือก (เช่น 1NW, 1NH, 1NO, W, H, O)
  const applyBulkStatus = (targetStatus: string) => {
    if (selected.size === 0) return;
    selected.forEach((index) => {
      onChange(index, "work_day_status", targetStatus);
    });
  };

  const crossFactoryCount = useMemo(
    () => rows.filter((r) => isOtherFactoryRecord(r)).length,
    [rows],
  );

  const abnormalCount = useMemo(
    () => rows.filter((r) => Boolean(getAbnormalReason(r))).length,
    [rows],
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-2 md:p-3 backdrop-blur-sm">
      <section className="flex h-[96vh] w-[98vw] max-w-[1920px] flex-col overflow-hidden rounded-2xl md:rounded-3xl bg-white text-slate-800 shadow-2xl">
        {/* ส่วนหัวหน้าต่าง (Header) */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 text-2xl font-bold shadow-inner">
              🔄
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900">
                  จัดการคนไปช่วยงานข้าม Factory (Cross-Factory Help & Status)
                </h2>
                <span className="rounded-lg bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-black text-amber-800">
                  วันที่: {date}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                จำแนกตามสถานะ Work Day: <strong className="text-blue-700">W</strong> (วันทำงาน), <strong className="text-purple-700">H</strong> (วันหยุดนักขัต), <strong className="text-emerald-700">O</strong> (วันหยุด Off-day) และ <strong className="text-amber-700">1N</strong> (ไปช่วยงานข้าม Factory เช่น 1NW / 1NH / 1NO)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-500 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <ModalButtonIcon name="close" />
            Close
          </button>
        </div>

        {/* แถบเครื่องมือจัดการ (Action Toolbar) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-amber-50/40 px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600">
              พบ {visibleRows.length.toLocaleString()} / {rows.length.toLocaleString()} รายการ ·{" "}
              <span className="text-amber-800 font-extrabold">
                {crossFactoryCount} คนข้าม Factory
              </span>{" "}
              {abnormalCount > 0 && (
                <span className="text-rose-600 font-bold ml-1">
                  · ⚠️ {abnormalCount} รายการผิดปกติ
                </span>
              )}
              {" "}· เลือกอยู่ {selected.size.toLocaleString()} คน
            </span>

            <div className="h-4 w-px bg-slate-300 mx-1" />

            {/* ปุ่มตัวกรองด่วน (Quick Filters) */}
            <div className="flex items-center rounded-xl bg-white p-0.5 border border-slate-200 shadow-xs">
              <button
                type="button"
                onClick={() => setQuickFilter("all")}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  quickFilter === "all"
                    ? "bg-slate-800 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                ทั้งหมด ({rows.length})
              </button>
              <button
                type="button"
                onClick={() => setQuickFilter("cross_only")}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  quickFilter === "cross_only"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-amber-800 hover:bg-amber-100"
                }`}
              >
                🔄 ไปช่วยงานข้าม Factory ({crossFactoryCount})
              </button>
              <button
                type="button"
                onClick={() => setQuickFilter("internal_only")}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  quickFilter === "internal_only"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                🏢 ทำงานปกติในโรงงาน ({rows.length - crossFactoryCount})
              </button>
              {abnormalCount > 0 && (
                <button
                  type="button"
                  onClick={() => setQuickFilter("abnormal_only")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    quickFilter === "abnormal_only"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-rose-700 hover:bg-rose-100"
                  }`}
                >
                  ⚠️ วัน/สแกนผิดปกติ ({abnormalCount})
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* แผงควบคุมกำหนดค่าพร้อมกันหลายรายการ (Bulk Action) */}
            <div className="flex items-center gap-1.5 bg-white border border-amber-300 rounded-xl p-1 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 pl-1.5">เปลี่ยนเป็น:</span>
              <select
                value={selectedBulkCode}
                onChange={(e) => setSelectedBulkCode(e.target.value as any)}
                className="rounded-lg border border-slate-200 bg-amber-50/60 px-2 py-1 text-xs font-black text-amber-950 outline-none"
              >
                <optgroup label="🔄 ไปช่วยงานข้าม Factory (1N)">
                  <option value="1NW">1NW (ข้าม Factory - วันทำงานปกติ)</option>
                  <option value="1NH">1NH (ข้าม Factory - วันหยุดนักขัต)</option>
                  <option value="1NO">1NO (ข้าม Factory - วันหยุดประจำสัปดาห์)</option>
                </optgroup>
                <optgroup label="🏢 ทำงานปกติในโรงงาน">
                  <option value="W">W (วันทำงานปกติ Working Day)</option>
                  <option value="H">H (วันหยุดนักขัตฤกษ์ Holiday)</option>
                  <option value="O">O (วันหยุดประจำสัปดาห์ Off Day)</option>
                </optgroup>
              </select>
              <button
                type="button"
                onClick={() => applyBulkStatus(selectedBulkCode)}
                disabled={selected.size === 0}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1 text-xs font-black text-white shadow-xs transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span>Apply ให้ที่เลือก ({selected.size})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setColumnFilters({});
                setSortConfig({ key: "", direction: "" });
                setQuickFilter("all");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <ModalButtonIcon name="reset" />
              Reset Filters
            </button>
          </div>
        </div>

        {/* ส่วนตารางข้อมูลพนักงาน (Table Area) */}
        <div className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm font-semibold text-slate-500">
              No attendance records found for this work date.
            </p>
          ) : visibleRows.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl text-amber-600">
                🔄
              </div>
              <h3 className="text-base font-bold text-slate-800">
                {quickFilter === "cross_only"
                  ? "ยังไม่มีพนักงานที่ตั้งค่าเป็นไปช่วยงานข้าม Factory (1N) ในวันนี้"
                  : "ไม่พบข้อมูลที่ตรงกับตัวกรอง"}
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                {quickFilter === "cross_only"
                  ? "กดปุ่มด้านล่างเพื่อแสดงพนักงานทั้งหมด แล้วเลือกคนที่ต้องการเปลี่ยนสถานะเป็น 1NW / 1NH / 1NO"
                  : "ลองรีเซ็ตตัวกรองเพื่อดูรายการทั้งหมด"}
              </p>
              <button
                type="button"
                onClick={() => setQuickFilter("all")}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-900 transition"
              >
                <span>🏢 ดูพนักงานทั้งหมด ({rows.length} คน)</span>
              </button>
            </div>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100/95 text-slate-600 backdrop-blur-xs shadow-xs">
                <tr>
                  <th className="p-3 text-center w-12">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      className="accent-amber-600 h-4 w-4"
                      aria-label="Select all visible employees"
                    />
                  </th>
                  <th className="p-3 text-left w-36">
                    Employee ID {filterButton("employeeId", "Employee ID")}
                  </th>
                  <th className="p-3 text-left min-w-44">
                    Name {filterButton("name", "Name")}
                  </th>
                  <th className="p-3 text-left w-40">
                    Department {filterButton("department", "Department")}
                  </th>
                  <th className="p-3 text-left w-32">
                    Destination {filterButton("destination", "Destination")}
                  </th>
                  <th className="p-3 text-left min-w-72">
                    Work Day Status (W / H / O / Cross-Fac) {filterButton("workDayStatus", "Work Day Status")}
                  </th>
                  <th className="p-3 text-left w-32">
                    Work Status {filterButton("workStatus", "Work Status")}
                  </th>
                  <th className="p-3 text-left min-w-56">
                    การตรวจสอบวัน {filterButton("abnormal", "การตรวจสอบวัน")}
                  </th>
                  <th className="p-3 text-left w-44">
                    Scan in {filterButton("scanIn", "Scan in", "right")}
                  </th>
                  <th className="p-3 text-left w-44">
                    Scan out {filterButton("scanOut", "Scan out", "right")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(({ row, originalIndex }) => {
                  const isCross = isOtherFactoryRecord(row);
                  const isSelected = selected.has(originalIndex);
                  const statusInfo = getWorkDayStatusInfo(row.work_day_status);
                  const abnormalReason = getAbnormalReason(row);

                  return (
                    <tr
                      key={`${row.dlh_employee_id}-${row.dlh_effective_date_time}`}
                      className={`border-b border-slate-100 transition-colors ${
                        isSelected
                          ? "bg-amber-50"
                          : abnormalReason
                            ? "bg-rose-50/40"
                            : isCross
                              ? "bg-amber-50/30"
                              : "hover:bg-slate-50/60"
                      }`}
                    >
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelected(originalIndex)}
                          className="accent-amber-600"
                          aria-label={`Select ${row.dlh_employee_id}`}
                        />
                      </td>
                      <td className="p-2 font-black text-slate-800">
                        {row.dlh_employee_id}
                      </td>
                      <td className="p-2 font-semibold">
                        {row.employee_name || "-"}
                      </td>
                      <td className="p-2 text-slate-600">
                        {row.department || "-"}
                      </td>
                      <td className="p-2">
                        {row.loan_destination ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 border border-purple-200 px-2.5 py-1 text-xs font-black text-purple-900 shadow-xs">
                            <span className="h-2 w-2 rounded-full bg-purple-600 animate-pulse"></span>
                            {row.loan_destination}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-medium">-</span>
                        )}
                      </td>
                      
                      {/* เครื่องมือแก้ไขสถานะวันทำงาน (Work Day Status) */}
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={String(row.work_day_status || "").trim().toUpperCase()}
                            onChange={(e) =>
                              onChange(originalIndex, "work_day_status", e.target.value)
                            }
                            className={`rounded-lg border px-2 py-1 font-black text-xs outline-none transition ${
                              isCross
                                ? "border-amber-400 bg-amber-50 text-amber-950 focus:ring-2 focus:ring-amber-200"
                                : "border-slate-200 bg-white text-slate-800 focus:border-blue-400"
                            }`}
                          >
                            <optgroup label="🔄 ไปช่วยงาน Factory อื่น">
                              <option value="1NW">ไปช่วยงาน Factory อื่น (วันทำงาน)</option>
                              <option value="1NH">ไปช่วยงาน Factory อื่น (วันหยุดนักขัต)</option>
                              <option value="1NO">ไปช่วยงาน Factory อื่น (วันหยุด Off)</option>
                            </optgroup>
                            <optgroup label="🏢 ทำงานปกติ">
                              <option value="W">W - วันทำงานปกติ (Working Day)</option>
                              <option value="H">H - วันหยุดนักขัตฤกษ์ (Holiday)</option>
                              <option value="O">O - วันหยุดประจำสัปดาห์ (Off Day)</option>
                            </optgroup>
                          </select>

                          {/* ปุ่มสลับมุมมองด่วน */}
                          <button
                            type="button"
                            onClick={() => {
                              const base = statusInfo.base || "W";
                              onChange(
                                originalIndex,
                                "work_day_status",
                                isCross ? base : `1N${base}`,
                              );
                            }}
                            className={`px-2 py-1 text-[10px] font-black rounded border transition ${
                              isCross
                                ? "border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100"
                                : "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                            }`}
                            title={
                              isCross
                                ? `เปลี่ยนเป็นปกติ (${statusInfo.base})`
                                : `เปลี่ยนเป็นข้าม Factory (1N${statusInfo.base})`
                            }
                          >
                            {isCross ? `เป็น ${statusInfo.base}` : `+ 1N${statusInfo.base}`}
                          </button>

                          {row.loan_destination && (
                            <span className="rounded-md bg-purple-100 border border-purple-300 text-purple-900 px-2 py-0.5 text-xs font-black shadow-xs shrink-0" title="สถานที่ยืมตัวจากระบบ Loan Exclude">
                              📍 {row.loan_destination}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-2 text-slate-600 font-bold">
                        {row.work_status || "-"}
                      </td>

                      {/* ตรวจสอบวันแปลกๆ */}
                      <td className="p-2">
                        {abnormalReason ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 border border-rose-300 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                            <span>⚠️</span>
                            <span>{abnormalReason}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                            <span>✓</span>
                            <span>วันตรงตามกะ</span>
                          </span>
                        )}
                      </td>

                      <td className="p-2 text-slate-600 font-mono text-[11px]">
                        {toDateTimeLocal(row.scan_time_in) || "-"}
                      </td>
                      <td className="p-2 text-slate-600 font-mono text-[11px]">
                        {toDateTimeLocal(row.scan_time_out) || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* แถบด้านล่างสำหรับบันทึกและยกเลิก (Footer Action Bar) */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 p-4">
          <div className="text-xs text-slate-500">
            * ระบบแยกแยะ: <strong>W</strong> (ทำงานปกติ), <strong>H</strong> (วันหยุดนักขัต), <strong>O</strong> (วันหยุด Off), <strong>1NW / 1NH / 1NO</strong> (ไปช่วยงานข้าม Factory)
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-100 disabled:opacity-50"
            >
              <ModalButtonIcon name="close" />
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving || rows.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-amber-200 transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ModalButtonIcon name="save" />
              {isSaving ? "Saving..." : "Save Changes (บันทึกข้อมูล)"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
