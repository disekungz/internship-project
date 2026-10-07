/**
 * Component: CrossFactoryManager
 * จัดการและเปิดหน้าต่างสำหรับพนักงานที่ทำงานหรือยืมตัวข้ามโรงงาน (Cross Factory Attendance)
 * - ดึงข้อมูลการลงเวลาของวันที่เลือกจาก Backend API
 * - ส่งข้อมูลไปยัง CrossFactoryModal เพื่อแก้ไขและบันทึก
 */
import { useState } from "react";
import Swal from "sweetalert2";
import CrossFactoryModal from "./CrossFactoryModal";
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
  scan_time_in?: string | null;
  scan_time_out?: string | null;
};

type Props = { onClose: () => void; onSaved?: (date: string) => void };
const endpoint = `${MANHOUR_IMPORT_ENDPOINT}/day`;

export default function CrossFactoryManager({ onClose, onSaved }: Props) {
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  /**
   * ดึงข้อมูลการลงเวลาของวันที่เลือกเพื่อนำมาเปิดใน Modal แก้ไข
   */
  const load = async () => {
    if (!date) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${endpoint}/${date}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Unable to load attendance data");
      
      const loadedRows = (Array.isArray(result) ? result : []).filter(
        (row) => extractDatePart(row.dlh_effective_date_time) === date,
      );
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

  const save = async () => {
    const confirmation = await Swal.fire({
      icon: "warning",
      title: "Save changes?",
      text: `Update ${rows.length} attendance record(s) for ${date}.`,
      showCancelButton: true,
      confirmButtonText: "Save",
      cancelButtonText: "Cancel",
    });
    if (!confirmation.isConfirmed) return;
    setIsSaving(true);
    try {
      const response = await fetch(`${endpoint}/${date}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("manhour-admin-token") || ""}`,
        },
        body: JSON.stringify({
          rows: rows.map((row) => ({
            employeeId: row.dlh_employee_id,
            effectiveDate: date,
            workDayStatus: row.work_day_status,
            workStatus: row.work_status,
            department: row.department,
            empDepartment: row.emp_department,
            scanTimeIn: row.scan_time_in,
            scanTimeOut: row.scan_time_out,
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Unable to save attendance data");
      await Swal.fire({
        icon: "success",
        title: "Saved",
        text: `Updated ${result.updated || rows.length} records.`,
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
            <span className="text-lg">🔄</span>
            <p className="text-xs font-black uppercase tracking-wider text-amber-600">
              Cross-Factory Help (ไปช่วยงานข้าม Factory)
            </p>
          </div>
          <h2 className="mt-1 text-xl font-black">
            จัดการคนไปช่วยงานต่างโรงงาน
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            เลือกวันที่ทำงานเพื่อกำหนดพนักงานที่ไปช่วยงานข้าม Factory (ตั้งค่า Work Day Status เป็น 1N) หรือเปลี่ยนกลับเป็นทำงานปกติ
          </p>
          <label className="mt-5 block text-sm font-bold text-slate-700">
            Work date (วันที่ทำงาน)
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={isLoading}
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
            autoFocus
          />
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
              disabled={!date || isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-amber-200 transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ModalButtonIcon name="load" />
              {isLoading ? "Loading..." : "Load Data"}
            </button>
          </div>
        </section>
      </div>

      {showEditor && (
        <CrossFactoryModal
          date={date}
          rows={rows}
          isSaving={isSaving}
          onChange={change}
          onCancel={() => setShowEditor(false)}
          onSave={save}
        />
      )}
    </>
  );
}
