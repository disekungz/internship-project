/**
 * Component: DeleteAttendanceModal
 * หน้าต่างยืนยันและเลือกรายการลบข้อมูลการลงเวลาทำงานของพนักงาน
 * - แสดงรายการพนักงานพร้อมตัวกรองและระบบตรวจจับความผิดปกติ (Date Mismatch, Missing Scan, etc.)
 * - ให้ผู้ใช้เลือกรายการที่ต้องการลบเฉพาะบุคคลหรือลบทั้งวัน
 */
import { useMemo, useState } from "react";
import { ExcelColumnFilter } from "./ImportPreviewModal";
import ModalButtonIcon from "./ModalButtonIcon";
import { extractDatePart } from "../aggregation";

// แปลงรูปแบบเวลาสแกนสำหรับแสดงผลในตาราง
const formatScan = (value) =>
  value
    ? new Date(value).toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "-";

export default function DeleteAttendanceModal({
  date,
  rows,
  isDeleting,
  onCancel,
  onConfirm,
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(() => new Set<string>());
  const [mismatchesOnly, setMismatchesOnly] = useState(false);
  const [columnFilters, setColumnFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "" });
  const [scrollTop, setScrollTop] = useState(0);
  const nextDate = new Date(`${date}T12:00:00+07:00`);
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDateKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
  const previousDate = new Date(`${date}T12:00:00+07:00`);
  previousDate.setDate(previousDate.getDate() - 1);
  const previousDateKey = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}-${String(previousDate.getDate()).padStart(2, "0")}`;
  
  /**
   * ตรวจหาสาเหตุความผิดปกติของการลงเวลา (Abnormal Reason) เช่น วันที่สแกนไม่ตรงกะ, ขาดงานแต่มีเวลาสแกน, สแกนไม่ครบเข้า-ออก
   */
  const getAbnormalReason = (row) => {
    const scanInDate = extractDatePart(row.scan_time_in);
    const scanOutDate = extractDatePart(row.scan_time_out);
    // รองรับทั้งกะกลางวันและกะกลางคืนข้ามวัน
    const validDates = new Set([previousDateKey, date, nextDateKey]);
    if (
      (scanInDate && !validDates.has(scanInDate)) ||
      (scanOutDate && !validDates.has(scanOutDate))
    )
      return "DATE MISMATCH";

    const status = String(row.work_status || "")
      .trim()
      .toLowerCase();
    const hasScanIn = Boolean(row.scan_time_in);
    const hasScanOut = Boolean(row.scan_time_out);
    const workHours = getWorkHours(row);
    if (status === "absent" && (hasScanIn || hasScanOut))
      return "ABSENT WITH SCAN";
    if (
      (status === "normal" || status === "abnormal") &&
      hasScanIn !== hasScanOut
    )
      return "INCOMPLETE SCAN";
    if (workHours !== null && workHours < 4) return "WORK < 4 HRS";
    return "";
  };
  const getWorkHours = (row) => {
    if (!row.scan_time_in || !row.scan_time_out) return null;
    const start = new Date(row.scan_time_in).getTime();
    const end = new Date(row.scan_time_out).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    return (end - start) / 3600000;
  };
  const getDisplayStatus = (row) =>
    getWorkHours(row) !== null && getWorkHours(row) < 4
      ? "Absent"
      : String(row.work_status || "-");
  const isMismatch = (row) => Boolean(getAbnormalReason(row));
  const columnGetters = {
    code: (row) => String(row.dlh_employee_id || ""),
    name: (row) => String(row.employee_name || ""),
    department: (row) => String(row.department || row.department_name || row.dept || "-"),
    workHours: (row) => {
      const hours = getWorkHours(row);
      return hours === null ? "-" : hours.toFixed(2);
    },
    workDate: (row) => extractDatePart(row.dlh_effective_date_time),
    workDay: (row) => String(row.work_day_status || "-"),
    status: (row) => getDisplayStatus(row),
    scanIn: (row) => formatScan(row.scan_time_in),
    scanOut: (row) => formatScan(row.scan_time_out),
  };
  const filterValues = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(columnGetters).map(([key, get]) => [
          key,
          [...new Set(rows.map(get))].sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true }),
          ),
        ]),
      ),
    [rows],
  );
  const visibleRows = useMemo(() => {
    const result = rows.filter((row) => {
      const text =
        `${row.dlh_employee_id || ""} ${row.employee_name || ""} ${row.department || row.department_name || ""} ${row.work_status || ""} ${row.work_day_status || ""} ${row.scan_time_in || ""} ${row.scan_time_out || ""}`.toLowerCase();
      return (
        text.includes(search.toLowerCase()) &&
        (!mismatchesOnly || isMismatch(row)) &&
        Object.entries(columnFilters).every(
          ([key, allowed]) =>
            !allowed || allowed.includes(columnGetters[key](row)),
        )
      );
    });
    if (sortConfig.key && sortConfig.direction)
      result.sort(
        (a, b) =>
          columnGetters[sortConfig.key](a).localeCompare(
            columnGetters[sortConfig.key](b),
            undefined,
            { numeric: true },
          ) * (sortConfig.direction === "asc" ? 1 : -1),
      );
    return result;
  }, [rows, search, mismatchesOnly, date, columnFilters, sortConfig]);
  const setColumnFilter = (key, values) =>
    setColumnFilters((current) => {
      const next = { ...current };
      if (values === null) delete next[key];
      else next[key] = values;
      return next;
    });
  const filterButton = (key, label, align = "left") => (
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
  const rowKey = (row) =>
    `${String(row.dlh_employee_id || "")}|${extractDatePart(row.dlh_effective_date_time)}`;
  const rowHeight = 34;
  const viewportHeight = 580;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 12);
  const endIndex = Math.min(
    visibleRows.length,
    Math.ceil((scrollTop + viewportHeight) / rowHeight) + 12,
  );
  const renderedRows = visibleRows.slice(startIndex, endIndex);
  const visibleIds = visibleRows.map(rowKey);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const toggleAll = () =>
    setSelected((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) =>
        allVisibleSelected ? next.delete(id) : next.add(id),
      );
      return next;
    });
  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="flex max-h-[88vh] w-full max-w-[95vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-rose-700 px-5 py-4 text-white">
          <h2 className="text-lg font-black">Employee Data Deletion Page</h2>
          <p className="text-xs text-rose-100">
            {date} · {rows.length.toLocaleString()} records
          </p>
        </div>
        <div className="flex items-center gap-3 border-b bg-slate-50 p-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter Code ID / Name / Status / Scan date"
            className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => setMismatchesOnly((value) => !value)}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${mismatchesOnly ? "border-amber-500 bg-amber-100 text-amber-800" : "bg-white text-slate-600"}`}
          >
            <ModalButtonIcon name="filter" />
            Scan for abnormal status
          </button>
          <button
            type="button"
            onClick={() => {
              setColumnFilters({});
              setSortConfig({ key: "", direction: "" });
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-600"
          >
            <ModalButtonIcon name="reset" />
            Clear filters
          </button>
          <span className="whitespace-nowrap text-xs font-bold text-slate-600">
            Selected {selected.size.toLocaleString()} · Showing{" "}
            {visibleRows.length.toLocaleString()}
          </span>
        </div>
        <div
          className="min-h-0 flex-1 overflow-auto"
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          <table className="w-max min-w-full table-auto border-collapse text-xs [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead className="sticky top-0 z-10 bg-slate-100">
              <tr>
                <th className="border p-2">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    className="accent-rose-600"
                  />
                </th>
                <th className="border p-2 text-left">
                  Code ID {filterButton("code", "Code ID")}
                </th>
                <th className="border p-2 text-left">
                  Name {filterButton("name", "Name")}
                </th>
                <th className="border p-2">
                  Work Date {filterButton("workDate", "Work Date")}
                </th>
                <th className="border p-2">
                  Work Day {filterButton("workDay", "Work Day")}
                </th>
                <th className="border p-2">
                  Status {filterButton("status", "Status")}
                </th>
                <th className="border p-2">
                  Department {filterButton("department", "Department")}
                </th>
                <th className="border p-2">
                  Work Hours {filterButton("workHours", "Work Hours", "right")}
                </th>
                <th className="border p-2">
                  Scan IN {filterButton("scanIn", "Scan IN", "right")}
                </th>
                <th className="border p-2">
                  Scan OUT {filterButton("scanOut", "Scan OUT", "right")}
                </th>
              </tr>
            </thead>
            <tbody>
              {startIndex > 0 && (
                <tr aria-hidden="true">
                  <td
                    colSpan={10}
                    className="border-0 p-0"
                    style={{ height: startIndex * rowHeight }}
                  />
                </tr>
              )}
              {renderedRows.map((row) => {
                const id = String(row.dlh_employee_id || "");
                const key = rowKey(row);
                const abnormalReason = getAbnormalReason(row);
                return (
                  <tr
                    key={key}
                    className={
                      selected.has(key)
                        ? "bg-rose-50"
                        : abnormalReason
                          ? "bg-amber-50"
                          : ""
                    }
                  >
                    <td className="border p-2 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(key)}
                        onChange={() => toggle(key)}
                        className="accent-rose-600"
                      />
                    </td>
                    <td className="border p-2 font-bold">
                      {id}
                      {abnormalReason && (
                        <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-[11px] text-amber-800">
                          {abnormalReason}
                        </span>
                      )}
                    </td>
                    <td className="border p-2 font-bold">
                      {row.employee_name || "-"}
                    </td>
                    <td className="border p-2 text-center font-bold">
                      {extractDatePart(row.dlh_effective_date_time)}
                    </td>
                    <td className="border p-2 text-center">
                      {row.work_day_status || "-"}
                    </td>
                    <td className="border p-2 text-center">
                      {getDisplayStatus(row)}
                    </td>
                    <td className="border p-2 font-bold">
                      {columnGetters.department(row)}
                    </td>
                    <td className="border p-2 text-center font-bold">
                      {columnGetters.workHours(row)}
                    </td>
                    <td className="border p-2 text-center">
                      {formatScan(row.scan_time_in)}
                    </td>
                    <td className="border p-2 text-center">
                      {formatScan(row.scan_time_out)}
                    </td>
                  </tr>
                );
              })}
              {endIndex < visibleRows.length && (
                <tr aria-hidden="true">
                  <td
                    colSpan={10}
                    className="border-0 p-0"
                    style={{
                      height: (visibleRows.length - endIndex) * rowHeight,
                    }}
                  />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 border-t p-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 font-bold shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <ModalButtonIcon name="close" />
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm(
                [...selected].map((key) => {
                  const [employeeId, effectiveDate] = key.split("|");
                  return { employeeId, effectiveDate };
                }),
              )
            }
            disabled={isDeleting || selected.size === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 font-bold text-white disabled:opacity-40"
          >
            <ModalButtonIcon name="delete" />
            {isDeleting
              ? "Deleting..."
              : `Delete ${selected.size.toLocaleString()} selected`}
          </button>
        </div>
      </div>
    </div>
  );
}
