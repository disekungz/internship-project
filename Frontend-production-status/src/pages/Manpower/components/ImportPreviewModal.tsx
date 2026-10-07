/**
 * Component: ImportPreviewModal
 * หน้าต่างแสดงตัวอย่างและตรวจสอบข้อมูลลงเวลาก่อนนำเข้า (Import Preview)
 * - แสดงรายการแถวข้อมูลจากไฟล์ Excel
 * - อนุญาตให้แก้ไขค่า, แก้ไขเป็นกลุ่ม (Bulk Edit), เพิ่มแถวใหม่, และลบแถว
 * - ฟังก์ชันแปลงวันและเวลาให้อยู่ใน Timezone Asia/Bangkok
 */
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { extractDatePart } from "../aggregation";
import ModalButtonIcon from "./ModalButtonIcon";

// รายการคอลัมน์ที่รองรับการแก้ไขข้อมูลแบบกลุ่ม (Bulk Edit)
const BULK_FIELDS = [
  { value: "dlh_employee_id", label: "Code ID", type: "text" },
  { value: "dlh_effective_date_time", label: "Date", type: "date" },
  { value: "work_day_status", label: "Work Day", type: "text" },
  { value: "work_status", label: "Status", type: "status" },
  { value: "scan_time_in_date", label: "Scan IN date", type: "date" },
  { value: "scan_time_in_time", label: "Scan IN time", type: "time" },
  { value: "scan_time_out_date", label: "Scan OUT date", type: "date" },
  { value: "scan_time_out_time", label: "Scan OUT time", type: "time" },
];

/**
 * แปลงค่าวันที่/เวลาให้อยู่ในฟอร์แมต input datetime-local (YYYY-MM-DDTHH:mm) ตามเวลาประเทศไทย
 */
const toBangkokDateTimeInput = (value) => {
  if (!value) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(text))
    return text.slice(0, 16);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(0, 16);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
};

/**
 * รวมวันที่และเวลาเป็น ISO String พร้อมระบุ Timezone +07:00
 */
const toBangkokIso = (date, time) =>
  date && time ? `${date}T${time}:00+07:00` : null;

/**
 * แยกส่วนของวันที่และเวลาออกจากค่า scan_time
 */
const scanParts = (value) => {
  const local = toBangkokDateTimeInput(value);
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
};

const FILTER_COLUMNS = {
  code: { label: "Code ID", get: (row) => String(row.dlh_employee_id || "") },
  name: { label: "Name", get: (row) => String(row.employee_name || "") },
  date: {
    label: "Date",
    get: (row) => extractDatePart(row.dlh_effective_date_time),
  },
  workDay: {
    label: "Work Day",
    get: (row) => String(row.work_day_status || ""),
  },
  status: { label: "Status", get: (row) => String(row.work_status || "") },
  scanInDate: {
    label: "Scan IN date",
    get: (row) => scanParts(row.scan_time_in).date,
  },
  scanInTime: {
    label: "Scan IN time",
    get: (row) => scanParts(row.scan_time_in).time,
  },
  scanOutDate: {
    label: "Scan OUT date",
    get: (row) => scanParts(row.scan_time_out).date,
  },
  scanOutTime: {
    label: "Scan OUT time",
    get: (row) => scanParts(row.scan_time_out).time,
  },
};

export function ExcelColumnFilter({
  columnKey,
  label,
  values,
  selectedValues,
  onApply,
  onSort,
  sortDirection,
  align = "left",
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(() => new Set(selectedValues || values));
  const visibleValues = values.filter((value) =>
    value.toLowerCase().includes(search.toLowerCase()),
  );
  const allVisibleChecked =
    visibleValues.length > 0 &&
    visibleValues.every((value) => draft.has(value));

  const openMenu = () => {
    setDraft(new Set(selectedValues || values));
    setSearch("");
    setOpen((current) => !current);
  };
  const toggleValue = (value) =>
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  const toggleVisible = () =>
    setDraft((current) => {
      const next = new Set(current);
      visibleValues.forEach((value) =>
        allVisibleChecked ? next.delete(value) : next.add(value),
      );
      return next;
    });
  const apply = () => {
    onApply(draft.size === values.length ? null : [...draft]);
    setOpen(false);
  };

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={openMenu}
        title={`Filter ${label || FILTER_COLUMNS[columnKey]?.label || columnKey}`}
        className={`ml-1 rounded px-1 text-[10px] ${selectedValues ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-200"}`}
      >
        ▼
      </button>
      {open && (
        <div
          className={`absolute top-full z-50 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-300 bg-white p-2 text-left font-normal text-slate-700 shadow-2xl ${align === "right" ? "right-0" : "left-0"}`}
        >
          <button
            type="button"
            onClick={() => {
              onSort("asc");
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100 ${sortDirection === "asc" ? "font-bold text-blue-700" : ""}`}
          >
            <ModalButtonIcon name="sortAsc" />
            Sort ascending
          </button>
          <button
            type="button"
            onClick={() => {
              onSort("desc");
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100 ${sortDirection === "desc" ? "font-bold text-blue-700" : ""}`}
          >
            <ModalButtonIcon name="sortDesc" />
            Sort descending
          </button>
          <div className="my-2 border-t" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search values"
            className="mb-2 w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
          />
          <label className="flex cursor-pointer items-center gap-2 border-b px-1 py-1 text-xs font-bold">
            <input
              type="checkbox"
              checked={allVisibleChecked}
              onChange={toggleVisible}
              className="accent-emerald-600"
            />
            (Select all)
          </label>
          <div className="max-h-[min(14rem,40vh)] overflow-y-auto py-1">
            {visibleValues.map((value) => (
              <label
                key={value || "__blank__"}
                className="flex cursor-pointer items-center gap-2 px-1 py-1 text-xs hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={draft.has(value)}
                  onChange={() => toggleValue(value)}
                  className="accent-emerald-600"
                />
                <span className="truncate">{value || "(Blank)"}</span>
              </label>
            ))}
          </div>
          <div className="mt-2 flex justify-end gap-2 border-t pt-2">
            <button
              type="button"
              onClick={apply}
              className="inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white"
            >
              <ModalButtonIcon name="apply" />
              OK
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-xs"
            >
              <ModalButtonIcon name="close" />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ImportPreviewModal({
  data,
  isImporting,
  onChangeRow,
  onAddEmployee,
  onDeleteRow,
  onDeleteRows,
  onCancel,
  onConfirm,
}) {
  const [selectedRows, setSelectedRows] = useState(() => new Set<number>());
  const [bulkField, setBulkField] = useState(BULK_FIELDS[0].value);
  const [bulkValue, setBulkValue] = useState("");
  const [filters, setFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "" });

  useEffect(() => {
    setSelectedRows(new Set());
    setBulkValue("");
    setFilters({});
    setSortConfig({ key: "", direction: "" });
  }, [data?.fileName]);

  const filterValues = useMemo(() => {
    const result = {};
    if (!data) return result;
    Object.entries(FILTER_COLUMNS).forEach(([key, config]) => {
      result[key] = [...new Set(data.rows.map((row) => config.get(row)))].sort(
        (a, b) => a.localeCompare(b, undefined, { numeric: true }),
      );
    });
    return result;
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const result = data.rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        return Object.entries(filters).every(
          ([key, allowedValues]) =>
            !allowedValues ||
            allowedValues.includes(FILTER_COLUMNS[key].get(row)),
        );
      });
    if (sortConfig.key && sortConfig.direction) {
      const getValue = FILTER_COLUMNS[sortConfig.key].get;
      result.sort(
        (a, b) =>
          getValue(a.row).localeCompare(getValue(b.row), undefined, {
            numeric: true,
          }) * (sortConfig.direction === "asc" ? 1 : -1),
      );
    }
    return result;
  }, [data, filters, sortConfig]);

  if (!data) return null;

  const visibleIndices = filteredRows.map((item) => item.index);
  const allVisibleSelected =
    visibleIndices.length > 0 &&
    visibleIndices.every((index) => selectedRows.has(index));
  const selectedField =
    BULK_FIELDS.find((field) => field.value === bulkField) || BULK_FIELDS[0];
  const setColumnFilter = (field, values) =>
    setFilters((current) => {
      const next = { ...current };
      if (values === null) delete next[field];
      else next[field] = values;
      return next;
    });

  const toggleRow = (index) => {
    setSelectedRows((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedRows((current) => {
      const next = new Set(current);
      visibleIndices.forEach((index) => {
        if (allVisibleSelected) next.delete(index);
        else next.add(index);
      });
      return next;
    });
  };

  const changeScanPart = (index, field, part, value) => {
    const row = data.rows[index];
    const current = scanParts(row[field]);
    const date =
      part === "date"
        ? value : current.date || extractDatePart(row.dlh_effective_date_time);
    const time = part === "time" ? value : current.time;
    onChangeRow(index, field, toBangkokIso(date, time));
  };

  const applyBulkEdit = () => {
    selectedRows.forEach((index) => {
      const row = data.rows[index];
      if (bulkField.startsWith("scan_time_")) {
        const field = bulkField.startsWith("scan_time_in")
          ? "scan_time_in"
          : "scan_time_out";
        const part = bulkField.endsWith("_date") ? "date" : "time";
        const current = scanParts(row[field]);
        const date =
          part === "date"
            ? bulkValue
            : current.date || extractDatePart(row.dlh_effective_date_time);
        const time = part === "time" ? bulkValue : current.time || "00:00";
        onChangeRow(index, field, toBangkokIso(date, time));
      } else {
        onChangeRow(index, bulkField, bulkValue);
      }
    });
  };

  const deleteSelected = async () => {
    if (selectedRows.size === 0) return;
    const confirmation = await Swal.fire({
      title: "Delete selected rows?",
      text: `Delete ${selectedRows.size.toLocaleString()} selected rows from this import?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete rows",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed) return;
    onDeleteRows([...selectedRows]);
    setSelectedRows(new Set());
  };

  const deleteOne = (index) => {
    onDeleteRow(index);
    setSelectedRows(new Set());
  };

  const inputClass =
    "w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs";
  const filterButton = (key) => (
    <ExcelColumnFilter
      columnKey={key}
      values={filterValues[key] || []}
      selectedValues={filters[key]}
      onApply={(values) => setColumnFilter(key, values)}
      onSort={(direction) => setSortConfig({ key, direction })}
      sortDirection={sortConfig.key === key ? sortConfig.direction : ""}
      align={
        ["scanInTime", "scanOutDate", "scanOutTime"].includes(key)
          ? "right"
          : "left"
      }
    />
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm">
      <div className="flex max-h-[94vh] w-full max-w-[98vw] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-900 to-blue-600 px-5 py-4 text-white">
          <div>
            <p className="text-xl font-bold">Add Employee Information Page</p>
            <p className="mt-1 text-xs text-blue-100">
              {data.fileName} · {data.rows.length.toLocaleString()} List ·{" "}
              {data.month}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isImporting}
            aria-label="Close"
            title="Close"
            className="inline-flex items-center justify-center rounded-lg border border-white/30 p-2 font-bold hover:bg-white/15"
          >
            <ModalButtonIcon name="close" />
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-b bg-slate-50 px-4 py-3">
          <div className="mr-2 text-xs font-bold text-slate-700">
            Selected{" "}
            <span className="text-blue-700">
              {selectedRows.size.toLocaleString()}
            </span>{" "}
            · Showing{" "}
            <span className="text-blue-700">
              {filteredRows.length.toLocaleString()}
            </span>{" "}
            rows
          </div>
          <label className="grid gap-1 text-[10px] font-bold text-slate-500">
            Field
            <select
              value={bulkField}
              onChange={(event) => {
                setBulkField(event.target.value);
                setBulkValue("");
              }}
              className="min-w-36 rounded-lg border bg-white px-2 py-1.5 text-xs text-slate-700"
            >
              {BULK_FIELDS.map((field) => (
                <option key={field.value} value={field.value}>
                  {field.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[10px] font-bold text-slate-500">
            New value
            {selectedField.type === "status" ? (
              <select
                value={bulkValue}
                onChange={(event) => setBulkValue(event.target.value)}
                className="min-w-40 rounded-lg border bg-white px-2 py-1.5 text-xs text-slate-700"
              >
                <option value="">-</option>
                <option value="Normal">Normal</option>
                <option value="Absent">Absent</option>
              </select>
            ) : (
              <input
                type={selectedField.type}
                value={bulkValue}
                onChange={(event) => setBulkValue(event.target.value)}
                className="min-w-52 rounded-lg border bg-white px-2 py-1.5 text-xs text-slate-700"
              />
            )}
          </label>
          <button
            type="button"
            onClick={onAddEmployee}
            disabled={isImporting}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ModalButtonIcon name="add" />
            Add Employee
          </button>
          <button
            type="button"
            onClick={applyBulkEdit}
            disabled={selectedRows.size === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ModalButtonIcon name="apply" />
            Apply to selected
          </button>
          <button
            type="button"
            onClick={deleteSelected}
            disabled={selectedRows.size === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ModalButtonIcon name="delete" />
            Delete selected
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters({});
              setSortConfig({ key: "", direction: "" });
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600"
          >
            <ModalButtonIcon name="reset" />
            Clear filters
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1650px] border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 shadow-sm">
              <tr>
                <th className="border p-2">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label="Select all filtered rows"
                    className="h-4 w-4 accent-blue-600"
                  />
                </th>
                <th className="border p-2">#</th>
                <th className="border p-2">Code ID {filterButton("code")}</th>
                <th className="border p-2">Name {filterButton("name")}</th>
                <th className="border p-2">Date {filterButton("date")}</th>
                <th className="border p-2">
                  work_day_status {filterButton("workDay")}
                </th>
                <th className="border p-2">
                  work_status {filterButton("status")}
                </th>
                <th className="border p-2">
                  Scan IN date {filterButton("scanInDate")}
                </th>
                <th className="border p-2">
                  Scan IN time {filterButton("scanInTime")}
                </th>
                <th className="border p-2">
                  Scan OUT date {filterButton("scanOutDate")}
                </th>
                <th className="border p-2">
                  Scan OUT time {filterButton("scanOutTime")}
                </th>
                <th className="border p-2">Delete</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ row, index }) => {
                const isSelected = selectedRows.has(index);
                const scanIn = scanParts(row.scan_time_in);
                const scanOut = scanParts(row.scan_time_out);
                return (
                  <tr
                    key={index}
                    className={
                      isSelected
                        ? "bg-blue-100"
                        : "odd:bg-white even:bg-slate-50"
                    }
                  >
                    <td className="border p-2 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(index)}
                        aria-label={`Select row ${index + 1}`}
                        className="h-4 w-4 accent-blue-600"
                      />
                    </td>
                    <td className="border p-2 text-center font-bold text-slate-400">
                      {index + 1}
                    </td>
                    <td className="border p-1.5">
                      <input
                        value={row.dlh_employee_id || ""}
                        onChange={(e) =>
                          onChangeRow(index, "dlh_employee_id", e.target.value)
                        }
                        className={inputClass}
                      />
                    </td>
                    <td className="border p-1.5">
                      <input
                        value={row.employee_name || ""}
                        onChange={(e) =>
                          onChangeRow(index, "employee_name", e.target.value)
                        }
                        placeholder="Employee name"
                        className={inputClass}
                      />
                    </td>
                    <td className="border p-1.5">
                      <input
                        type="date"
                        value={extractDatePart(row.dlh_effective_date_time)}
                        onChange={(e) =>
                          onChangeRow(
                            index,
                            "dlh_effective_date_time",
                            e.target.value,
                          )
                        }
                        className={inputClass}
                      />
                    </td>
                    <td className="border p-1.5">
                      <input
                        value={row.work_day_status || ""}
                        onChange={(e) =>
                          onChangeRow(index, "work_day_status", e.target.value)
                        }
                        className={inputClass}
                      />
                    </td>
                    <td className="border p-1.5">
                      <select
                        value={row.work_status || ""}
                        onChange={(e) =>
                          onChangeRow(index, "work_status", e.target.value)
                        }
                        className={inputClass}
                      >
                        <option value="">-</option>
                        <option value="Normal">Normal</option>
                        <option value="Absent">Absent</option>
                      </select>
                    </td>
                    <td className="border p-1.5">
                      <input
                        type="date"
                        value={scanIn.date}
                        onChange={(e) =>
                          changeScanPart(
                            index,
                            "scan_time_in",
                            "date",
                            e.target.value,
                          )
                        }
                        className={inputClass}
                      />
                    </td>
                    <td className="border p-1.5">
                      <input
                        type="time"
                        value={scanIn.time}
                        onChange={(e) =>
                          changeScanPart(
                            index,
                            "scan_time_in",
                            "time",
                            e.target.value,
                          )
                        }
                        className={inputClass}
                      />
                    </td>
                    <td className="border p-1.5">
                      <input
                        type="date"
                        value={scanOut.date}
                        onChange={(e) =>
                          changeScanPart(
                            index,
                            "scan_time_out",
                            "date",
                            e.target.value,
                          )
                        }
                        className={inputClass}
                      />
                    </td>
                    <td className="border p-1.5">
                      <input
                        type="time"
                        value={scanOut.time}
                        onChange={(e) =>
                          changeScanPart(
                            index,
                            "scan_time_out",
                            "time",
                            e.target.value,
                          )
                        }
                        className={inputClass}
                      />
                    </td>
                    <td className="border p-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => deleteOne(index)}
                        className="inline-flex items-center gap-1.5 rounded bg-rose-50 px-2.5 py-1.5 font-bold text-rose-600"
                      >
                        <ModalButtonIcon name="delete" />
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 border-t p-4">
          <p className="text-xs font-bold">
            Ready {data.rows.length.toLocaleString()} List ·{" "}
            {data.mode === "replace"
              ? "Add data for the entire month"
              : "Daily data updates"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold shadow-sm"
            >
              <ModalButtonIcon name="close" />
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isImporting || data.rows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white disabled:opacity-50"
            >
              <ModalButtonIcon name="import" />
              {isImporting ? "Importing..." : "Confirm Import"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
