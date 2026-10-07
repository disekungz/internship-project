/**
 * Component: EditDataManager
 * ตัวจัดการเปิดหน้าต่างสำหรับแก้ไขข้อมูลการลงเวลาทำงาน (รายวันหรือรายเดือน)
 * - ดึงข้อมูลการลงเวลาจาก Backend
 * - ส่งข้อมูลไปยัง EditAttendanceModal เพื่อทำการแก้ไข
 */
import { useState } from "react";
import Swal from "sweetalert2";
import EditAttendanceModal from "./EditAttendanceModal";
import ModalButtonIcon from "./ModalButtonIcon";
import { MANHOUR_IMPORT_ENDPOINT } from "../constants";
import { extractDatePart } from "../aggregation";

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
};

type Props = { onClose: () => void; onSaved?: (date: string) => void };
const endpoint = `${MANHOUR_IMPORT_ENDPOINT}/day`;

export default function EditDataManager({ onClose, onSaved }: Props) {
  const [scopeMode, setScopeMode] = useState<"day" | "month">("day");
  const [date, setDate] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const selectedKey = scopeMode === "day" ? date : month;

  /**
   * ดึงข้อมูลการลงเวลาตามวันหรือเดือนที่เลือก เพื่อเปิดหน้าจอแก้ไข
   */
  const load = async () => {
    if (!selectedKey) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${endpoint}/${selectedKey}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Unable to load attendance data");
      
      const loadedRows = Array.isArray(result) ? result : [];
      setRows(loadedRows);
      setShowEditor(true);
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "Load failed",
        text:
          error instanceof Error
            ? error.message
            : "Unable to load attendance data",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const change = (index: number, field: keyof AttendanceRow, value: string) => {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? field === "department" || field === "emp_department"
            ? { ...row, department: value, emp_department: value }
            : { ...row, [field]: value }
          : row,
      ),
    );
  };

  const bulkChange = (indexes: number[], field: keyof AttendanceRow, value: string) => {
    const idxSet = new Set(indexes);
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (!idxSet.has(rowIndex)) return row;
        if (field === "department" || field === "emp_department") {
          return { ...row, department: value, emp_department: value };
        }
        return { ...row, [field]: value };
      }),
    );
  };

  const add = (newRow: AttendanceRow) => {
    setRows((current) => [newRow, ...current]);
  };

  const deleteRows = async (employeeIds: string[]) => {
    if (employeeIds.length === 0) return;

    // ค้นหารายละเอียดแถวเพื่อแสดงชื่อและรหัสพนักงาน
    const empDetails = employeeIds
      .map((id) => {
        const found = rows.find((r) => r.dlh_employee_id === id);
        return found
          ? `<strong>${id}</strong> - ${found.employee_name || "ไม่ระบุชื่อ"}`
          : `<strong>${id}</strong>`;
      });

    const isSingle = employeeIds.length === 1;
    const detailListHtml =
      employeeIds.length <= 5
        ? `<div class="mt-2 text-left bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 max-h-40 overflow-y-auto"><ul class="list-disc pl-4 space-y-1">${empDetails.map((item) => `<li>${item}</li>`).join("")}</ul></div>`
        : `<div class="mt-2 text-left bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 max-h-40 overflow-y-auto"><ul class="list-disc pl-4 space-y-1">${empDetails.slice(0, 5).map((item) => `<li>${item}</li>`).join("")}</ul><p class="mt-1 font-bold text-slate-500">...และอีก ${employeeIds.length - 5} คน</p></div>`;

    const confirm = await Swal.fire({
      icon: "warning",
      title: isSingle ? "ยืนยันการลบข้อมูลพนักงาน?" : `ยืนยันการลบข้อมูล ${employeeIds.length} คน?`,
      html: `
        <div class="text-sm text-slate-600">
          <p>คุณต้องการลบข้อมูลของพนักงานในวันที่ <strong>${date}</strong> หรือไม่?</p>
          ${detailListHtml}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "ลบข้อมูล (Delete)",
      confirmButtonColor: "#e11d48",
      cancelButtonText: "ยกเลิก (Cancel)",
    });
    if (!confirm.isConfirmed) return;

    setIsSaving(true);
    try {
      const response = await fetch(`${endpoint}/${date}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("manhour-admin-token") || ""}`,
        },
        body: JSON.stringify({
          records: employeeIds.map((id) => ({
            employeeId: id,
            effectiveDate: date,
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Unable to delete records");

      // ลบออกจาก State
      const idSet = new Set(employeeIds);
      setRows((current) => current.filter((r) => !idSet.has(r.dlh_employee_id)));

      await Swal.fire({
        icon: "success",
        title: "Deleted",
        text: `Deleted ${result.deleted || employeeIds.length} record(s).`,
      });
      window.dispatchEvent(
        new CustomEvent("manhour-edit-saved", { detail: { date } }),
      );
      onSaved?.(date);
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "Delete failed",
        text:
          error instanceof Error ? error.message : "Unable to delete records",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const save = async () => {
    const confirmation = await Swal.fire({
      icon: "warning",
      title: "Save changes?",
      text: `Save ${rows.length} attendance record(s) for ${date}.`,
      showCancelButton: true,
      confirmButtonText: "Save",
      cancelButtonText: "Cancel",
    });
    if (!confirmation.isConfirmed) return;
    setIsSaving(true);
    try {
      // 1. บันทึกและอัปเดตข้อมูลพนักงานทั้งหมด (รวมแถวที่เพิ่มใหม่) ผ่าน API /import
      const importResponse = await fetch(`${MANHOUR_IMPORT_ENDPOINT}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("manhour-admin-token") || ""}`,
        },
        body: JSON.stringify({
          mode: "replace_day",
          month: date.slice(0, 7),
          rows: rows.map((row) => ({
            dlh_employee_id: row.dlh_employee_id,
            dlh_effective_date_time: extractDatePart(row.dlh_effective_date_time) || date,
            work_day_status: row.work_day_status,
            work_status: row.work_status,
            scan_time_in: row.scan_time_in,
            scan_time_out: row.scan_time_out,
          })),
        }),
      });
      const importResult = await importResponse.json();
      if (!importResponse.ok)
        throw new Error(importResult.error || "Unable to save attendance data");

      // 2. อัปเดตแผนกและชื่อพนักงานด้วยหากมีการเปลี่ยนแปลง
      await fetch(`${endpoint}/${date}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("manhour-admin-token") || ""}`,
        },
        body: JSON.stringify({
          rows: rows.map((row) => ({
            employeeId: row.dlh_employee_id,
            employeeName: row.employee_name,
            effectiveDate: extractDatePart(row.dlh_effective_date_time) || date,
            workDayStatus: row.work_day_status,
            workStatus: row.work_status,
            department: row.department,
            empDepartment: row.emp_department,
            line: row.line_check || row.line || "",
            shift: row.shift_h || row.shift || "",
            scanTimeIn: row.scan_time_in,
            scanTimeOut: row.scan_time_out,
          })),
        }),
      }).catch(() => {});

      window.dispatchEvent(
        new CustomEvent("manhour-edit-saved", { detail: { date } }),
      );
      await Swal.fire({
        icon: "success",
        title: "Saved",
        text: `Updated ${rows.length} record(s) successfully.`,
      });
      onSaved?.(date);
      setShowEditor(false);
      onClose();
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "Save failed",
        text:
          error instanceof Error
            ? error.message
            : "Unable to save attendance data",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[105] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
        <section className="w-full max-w-md rounded-3xl bg-white p-6 text-slate-800 shadow-2xl">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🛠️</span>
            <p className="text-xs font-black uppercase tracking-wider text-blue-600">
              Manage Attendance Data (จัดการข้อมูลการทำงาน)
            </p>
          </div>
          <h2 className="mt-1 text-xl font-black">
            เพิ่ม, แก้ไข และลบข้อมูลการทำงาน
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            เลือกขอบเขตข้อมูลเพื่อเปิดหน้าต่างจัดการข้อมูล สามารถ <strong>เพิ่มคนใหม่</strong>, <strong>แก้ไขสถานะการทำงาน</strong> หรือ <strong>เลือกลบคน</strong> ได้ครบจบในที่เดียว
          </p>

          {/* แท็บเลือกขอบเขตข้อมูล (รายวัน / รายเดือน) */}
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setScopeMode("day")}
              className={`rounded-xl py-2 text-xs font-black transition ${
                scopeMode === "day"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📅 ข้อมูลรายวัน (Daily)
            </button>
            <button
              type="button"
              onClick={() => setScopeMode("month")}
              className={`rounded-xl py-2 text-xs font-black transition ${
                scopeMode === "month"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🗓️ ข้อมูลทั้งเดือน (Monthly)
            </button>
          </div>

          {scopeMode === "day" ? (
            <div className="mt-4">
              {/* วิดเจ็ตเลือกวันที่แบบโมเดิร์น */}
              <div className="rounded-2xl border-2 border-blue-100/80 bg-gradient-to-b from-blue-50/40 via-white to-slate-50/50 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600">เลือกวันที่ทำงาน</span>
                    <h3 className="text-sm font-black text-slate-800">
                      {new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date(`${month}-01`))}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const [y, m] = month.split("-").map(Number);
                        const prev = new Date(y, m - 2, 1);
                        setMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`);
                      }}
                      className="h-8 w-8 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300 transition flex items-center justify-center shadow-xs font-bold text-xs"
                      title="เดือนก่อนหน้า"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const [y, m] = month.split("-").map(Number);
                        const next = new Date(y, m, 1);
                        setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
                      }}
                      className="h-8 w-8 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300 transition flex items-center justify-center shadow-xs font-bold text-xs"
                      title="เดือนถัดไป"
                    >
                      ▶
                    </button>
                  </div>
                </div>

                {/* Day of Week Headers */}
                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                  {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d, i) => (
                    <span
                      key={d}
                      className={`text-[11px] font-black py-1 ${
                        i === 0 || i === 6 ? "text-rose-500" : "text-slate-400"
                      }`}
                    >
                      {d}
                    </span>
                  ))}
                </div>

                {/* Calendar Days Matrix */}
                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const [yearNum, monthNum] = month.split("-").map(Number);
                    const firstDayOfWeek = new Date(yearNum, monthNum - 1, 1).getDay();
                    const totalDays = new Date(yearNum, monthNum, 0).getDate();
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const cells = [];

                    // Leading empty slots
                    for (let i = 0; i < firstDayOfWeek; i++) {
                      cells.push(<div key={`empty-${i}`} className="h-9 w-full" />);
                    }

                    // Actual month days
                    for (let d = 1; d <= totalDays; d++) {
                      const dayStr = `${month}-${String(d).padStart(2, "0")}`;
                      const isSelected = date === dayStr;
                      const isToday = todayStr === dayStr;
                      const dayOfWeek = new Date(yearNum, monthNum - 1, d).getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                      cells.push(
                        <button
                          key={dayStr}
                          type="button"
                          onClick={() => setDate(dayStr)}
                          className={`h-9 w-full rounded-xl text-xs font-black transition relative flex items-center justify-center ${
                            isSelected
                              ? "bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30 scale-105 ring-2 ring-blue-400 z-10 font-black"
                              : isToday
                                ? "bg-blue-50 text-blue-700 border-2 border-blue-400/80 hover:bg-blue-100"
                                : isWeekend
                                  ? "bg-rose-50/60 text-rose-700 hover:bg-rose-100/80"
                                  : "bg-white text-slate-700 hover:bg-blue-50 border border-slate-100 hover:border-blue-200"
                          }`}
                        >
                          <span>{d}</span>
                          {isToday && !isSelected && (
                            <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-600" />
                          )}
                        </button>
                      );
                    }
                    return cells;
                  })()}
                </div>

                {/* Selected Date Summary & Quick Actions */}
                <div className="mt-3.5 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                  <div className="text-xs">
                    <span className="text-slate-400 font-medium">วันที่เลือก: </span>
                    <span className="font-black text-blue-700">
                      {date ? date : "ยังไม่ได้เลือกวัน"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const today = now.toISOString().slice(0, 10);
                        setMonth(today.slice(0, 7));
                        setDate(today);
                      }}
                      className="rounded-lg bg-blue-50 border border-blue-200/80 px-2.5 py-1 text-[11px] font-black text-blue-700 hover:bg-blue-100 transition shadow-2xs"
                    >
                      ⚡ วันนี้
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              {/* Modern Custom Month Grid Selector */}
              <div className="rounded-2xl border-2 border-blue-100 bg-gradient-to-b from-blue-50/50 via-white to-slate-50/50 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600">เลือกเดือนทำงาน</span>
                    <h3 className="text-sm font-black text-slate-800">ปี {Number(month.slice(0, 4)) + 543} ({month.slice(0, 4)})</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const curYear = Number(month.slice(0, 4)) - 1;
                        setMonth(`${curYear}-${month.slice(5, 7)}`);
                      }}
                      className="h-8 w-8 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 transition flex items-center justify-center shadow-xs font-bold text-xs"
                      title="ปีก่อนหน้า"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const curYear = Number(month.slice(0, 4)) + 1;
                        setMonth(`${curYear}-${month.slice(5, 7)}`);
                      }}
                      className="h-8 w-8 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 transition flex items-center justify-center shadow-xs font-bold text-xs"
                      title="ปีถัดไป"
                    >
                      ▶
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m) => {
                    const year = month.slice(0, 4);
                    const currentKey = `${year}-${m}`;
                    const isSelected = month === currentKey;
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const monthTh = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
                    const monthThShort = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
                    const idx = Number(m) - 1;

                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMonth(currentKey)}
                        className={`rounded-2xl py-3 px-1.5 text-center transition flex flex-col items-center justify-center ${
                          isSelected
                            ? "bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-700 text-white font-black shadow-lg shadow-blue-500/30 scale-102 ring-2 ring-blue-400"
                            : "bg-white text-slate-700 hover:bg-blue-50 border border-slate-200/80 font-bold hover:border-blue-300"
                        }`}
                      >
                        <span className="text-xs font-black tracking-tight">{monthNames[idx]}</span>
                        <span className={`text-[10px] font-semibold mt-0.5 ${isSelected ? "text-blue-100" : "text-slate-400"}`}>{monthThShort[idx]}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3.5 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">เดือนที่เลือก:</span>
                  <span className="font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                    {new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date(`${month}-01`))}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              <ModalButtonIcon name="close" />
              Cancel
            </button>
            <button
              type="button"
              onClick={load}
              disabled={!selectedKey || isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-50"
            >
              <ModalButtonIcon name="load" />
              {isLoading ? "Loading..." : "Load data"}
            </button>
          </div>
        </section>
      </div>
      {showEditor && (
        <EditAttendanceModal
          date={date}
          rows={rows}
          isSaving={isSaving}
          onChange={change}
          onBulkChange={bulkChange}
          onAddRow={add}
          onDeleteRows={deleteRows}
          onCancel={() => setShowEditor(false)}
          onSave={save}
        />
      )}
    </>
  );
}
