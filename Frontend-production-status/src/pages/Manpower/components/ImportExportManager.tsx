/**
 * Component: ImportExportManager
 * หน้าต่าง Modal จัดการการนำเข้า (Import) และส่งออก (Export) ข้อมูล Excel สำหรับระบบ Manpower
 * - Import: เลือกไฟล์ .xlsx เพื่ออัปโหลดข้อมูลการลงเวลาทำงาน
 * - Export: เลือกช่วงวันหรือเดือน แล้วดาวน์โหลดเป็นไฟล์ Excel หัวตารางภาษาไทย
 */
import { useState, type ChangeEvent, type RefObject } from 'react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { Calendar, FileSpreadsheet, Upload, Download, X, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { MANHOUR_IMPORT_ENDPOINT } from '../constants';

type Props = {
  action: 'import' | 'export';
  isImporting: boolean;
  importFileRef: RefObject<HTMLInputElement | null>;
  onImportFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onImportModeChange: (mode: string) => void;
  defaultSelectedMonth?: string;
  onClose: () => void;
};

export default function ImportExportManager({
  action,
  isImporting,
  importFileRef,
  onImportFile,
  onImportModeChange,
  defaultSelectedMonth,
  onClose,
}: Props) {
  const [range, setRange] = useState<'date' | 'month'>('date');
  // ตั้งค่าเริ่มต้นเป็นวันที่ปัจจุบันอัตโนมัติ เพื่อให้ผู้ใช้สามารถกด Export ได้ทันทีโดยไม่ต้องคลิกเลือกใหม่ถ้าต้องการข้อมูลวันนี้
  const [value, setValue] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [isExporting, setIsExporting] = useState(false);

  // เริ่มกระบวนการ Import โดยเปิด File Dialog
  const startImport = () => {
    onImportModeChange('auto');
    importFileRef.current?.click();
  };

  // รับ Event เมื่อผู้ใช้เลือกไฟล์ Excel สำหรับ Import
  const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const hasFile = Boolean(event.target.files?.[0]);
    onImportFile(event);
    if (hasFile) onClose();
  };

  /**
   * แปลงรูปแบบวันที่และเวลาจาก Backend หรือ Excel ให้อยู่ในฟอร์แมตมาตรฐาน { date: 'YYYY-MM-DD', time: 'HH:mm' }
   * - รองรับ พ.ศ. (แปลงเป็น ค.ศ. ลบ 543 อัตโนมัติ)
   * - ป้องกันปัญหาเวลาคลาดเคลื่อนจาก Timezone
   */
  function parseScanDateTime(val: any): { date: string; time: string } {
    if (!val) return { date: '', time: '' };
    const str = String(val).trim();
    if (!str || str === 'null' || str === 'undefined' || str === '-') return { date: '', time: '' };

    // รูปแบบที่ 1: พ.ศ. ของไทย "D/M/YYYY H:MM:SS" หรือ "DD/MM/YYYY HH:MM:SS"
    // Backend ส่งมาผ่าน formatToThaiBE() เช่น "15/6/2568 8:30:00"
    // ลบ 543 เพื่อแปลงเป็น ค.ศ.
    const thaiDt = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (thaiDt) {
      const day = thaiDt[1].padStart(2, '0');
      const month = thaiDt[2].padStart(2, '0');
      const yearBE = parseInt(thaiDt[3], 10);
      const yearCE = yearBE > 2400 ? yearBE - 543 : yearBE; // แปลง พ.ศ. เป็น ค.ศ.
      const hour = thaiDt[4].padStart(2, '0');
      const min = thaiDt[5];
      return {
        date: `${yearCE}-${month}-${day}`,
        time: `${hour}:${min}`,
      };
    }

    // รูปแบบที่ 2: วันที่แบบ พ.ศ. อย่างเดียว "D/M/YYYY" หรือ "DD/MM/YYYY"
    const thaiDate = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (thaiDate) {
      const day = thaiDate[1].padStart(2, '0');
      const month = thaiDate[2].padStart(2, '0');
      const yearBE = parseInt(thaiDate[3], 10);
      const yearCE = yearBE > 2400 ? yearBE - 543 : yearBE;
      return { date: `${yearCE}-${month}-${day}`, time: '' };
    }

    // รูปแบบที่ 3: ISO format "YYYY-MM-DD HH:MM" หรือ "YYYY-MM-DDTHH:MM"
    const dtMatch = str.match(/(\d{4}-\d{2}-\d{2})[T\s](\d{2}):(\d{2})/);
    if (dtMatch) {
      return { date: dtMatch[1], time: `${dtMatch[2]}:${dtMatch[3]}` };
    }

    // รูปแบบที่ 4: ISO date อย่างเดียว "YYYY-MM-DD"
    const dateOnly = str.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (dateOnly) {
      return { date: dateOnly[1], time: '' };
    }

    // รูปแบบที่ 5: เวลาอย่างเดียว "HH:MM" หรือ "H:MM"
    const timeOnly = str.match(/^(\d{1,2}):(\d{2})/);
    if (timeOnly) {
      return { date: '', time: `${timeOnly[1].padStart(2, '0')}:${timeOnly[2]}` };
    }

    // ไม่ใช้ new Date() fallback เพื่อป้องกันปัญหาเลื่อนของเวลาจาก Timezone UTC
    return { date: str, time: '' };
  }

  function getWorkShiftTime(shift?: string, workDayStatus?: string, scanIn?: string): string {
    const s = String(shift || '').trim().toUpperCase();
    const wds = String(workDayStatus || '').trim().toUpperCase();

    // 1. ตรวจสอบจากเวลาที่สแกนเข้างานจริง (scan_time_in) หากมี
    if (scanIn) {
      const parsedTime = parseScanDateTime(scanIn).time;
      if (parsedTime) {
        const hour = parseInt(parsedTime.split(':')[0], 10);
        if (hour >= 6 && hour < 18) return '08:00 - 17:00';
        if (hour >= 18 || hour < 6) return '20:00 - 04:45';
      }
    }

    // 2. ตรวจสอบจากกะการทำงาน (shift: D = Day, B/N = Night)
    if (s === 'D' || s === 'DAY' || s === 'D/S') {
      return '08:00 - 17:00';
    }
    if (s === 'B' || s === 'N' || s === 'NIGHT' || s === 'N/S') {
      return '20:00 - 04:45';
    }

    // 3. ตรวจสอบจากคำระบุเฉพาะใน work_day_status (เช่น DAY/NIGHT/DAP/NAP)
    if (wds.includes('NIGHT') || wds.includes('NAP')) {
      return '20:00 - 04:45';
    }
    if (wds.includes('DAY') || wds.includes('DAP') || wds.includes('MAP')) {
      return '08:00 - 17:00';
    }

    // 4. Default ตามปกติของกะกลางวัน
    if (wds.endsWith('W') || wds === 'W') {
      return '08:00 - 17:00';
    }

    return '';
  }

  const startExport = async () => {
    if (!value) return;
    setIsExporting(true);
    try {
      const endpointRange = range === 'date' ? 'day' : 'month';
      const response = await fetch(`${MANHOUR_IMPORT_ENDPOINT}/${endpointRange}/${value}`, {
        cache: 'no-store',
      });
      const contentType = response.headers.get('content-type') || '';
      const result = contentType.includes('application/json') ? await response.json() : null;
      if (!response.ok)
        throw new Error(result?.error || `Export request failed (HTTP ${response.status})`);
      if (!result) throw new Error('Export API returned an invalid response');
      const rows = Array.isArray(result) ? result : [];
      if (rows.length === 0) throw new Error(`No attendance records found for ${value}`);

      const dataToExport = rows.map((row: any) => {
        const inScan = parseScanDateTime(row.scan_time_in);
        const outScan = parseScanDateTime(row.scan_time_out);
        const employeeShift = row.shift_h || row.shift || "";
        const shiftTime = row.shift_time || row.work_time || getWorkShiftTime(employeeShift, row.work_day_status, row.scan_time_in);
        const effectiveDate = row.dlh_effective_date_time
          ? String(row.dlh_effective_date_time).slice(0, 10)
          : '';
        const remark = row.loan_destination
          ? `Loan: ${row.loan_destination}`
          : row.remark || row.note || '';

        return {
          "รหัสพนักงาน": row.dlh_employee_id || row.employee_id || "",
          "ชื่อพนักงาน": row.employee_name || "",
          "work_status": row.work_status || "",
          "department": row.department || row.emp_department || "",
          "line": row.line_check || "",
          "shift": row.shift_h || row.shift || "",
          "วันที่มีผล": effectiveDate,
          "รหัสกะการทำงาน": row.work_day_status || "",
          "ช่วงเวลาทำงาน": shiftTime,
          "วันที่เข้างาน": inScan.date || "",
          "เวลาเข้า": inScan.time || "",
          "วันที่ออกงาน": outScan.date || "",
          "เวลาออก": outScan.time || "",
          "หมายเหตุ": remark,
        };
      });

      const { exportStyledExcel } = await import("@/utility/Service/xlxs/exportStyledExcel");
      await exportStyledExcel({
        title: "MANPOWER ATTENDANCE REPORT",
        metadata: {
          "Filter Range": range === "date" ? "Specific Day (รายวัน)" : "Monthly Summary (รายเดือน)",
          "Selected Period / Date": value,
          "Export Date": new Date().toLocaleString("th-TH"),
          "Total Records": `${dataToExport.length} รายการ`,
        },
        data: dataToExport,
        fileName: `manhour-${range}-${value}.xlsx`,
        sheetName: "Attendance",
        themeColor: "sky",
        showTotalRow: false,
        columnsConfig: {
          "รหัสพนักงาน": { align: "center", width: 16 },
          "ชื่อพนักงาน": { align: "left", width: 26 },
          "work_status": { align: "center", width: 16 },
          "department": { align: "left", width: 22 },
          "line": { align: "center", width: 18 },
          "shift": { align: "center", width: 12 },
          "วันที่มีผล": { align: "center", width: 15 },
          "รหัสกะการทำงาน": { align: "center", width: 18 },
          "ช่วงเวลาทำงาน": { align: "center", width: 18 },
          "วันที่เข้างาน": { align: "center", width: 15 },
          "เวลาเข้า": { align: "center", width: 12 },
          "วันที่ออกงาน": { align: "center", width: 15 },
          "เวลาออก": { align: "center", width: 12 },
          "หมายเหตุ": { align: "left", width: 18 },
        },
      });

      onClose();
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Export failed',
        text: error instanceof Error ? error.message : 'Unable to export attendance data',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const isImport = action === 'import';

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md animate-fadeIn">
      <section className="relative w-full max-w-lg rounded-[2rem] border-2 border-white/80 bg-white p-7 text-slate-800 shadow-2xl shadow-blue-950/20 backdrop-blur-xl">
        {/* ส่วนหัว (Header) */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md ${isImport
                  ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-500/25'
                  : 'bg-gradient-to-tr from-emerald-600 to-teal-600 shadow-emerald-500/25'
                }`}
            >
              {isImport ? <Upload className="h-6 w-6" /> : <Download className="h-6 w-6" />}
            </div>
            <div>
              <span
                className={`text-xs font-black uppercase tracking-wider ${isImport ? 'text-blue-600' : 'text-emerald-600'
                  }`}
              >
                {isImport ? 'IMPORT DATA • นำเข้าข้อมูล' : 'EXPORT DATA • ส่งออกข้อมูล'}
              </span>
              <h2 className="text-xl font-black text-slate-900">
                {isImport ? 'เลือกขอบเขตข้อมูลที่ต้องการนำเข้า' : 'เลือกช่วงเวลาที่ต้องการ Export'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* การ์ดเลือกช่วงเวลา: รายวัน หรือ รายเดือน (Range Selection Cards) */}
        <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
          1. เลือกประเภทการทำงาน (Scope)
        </label>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            type="button"
            onClick={() => {
              setRange('date');
              const today = new Date();
              const yyyy = today.getFullYear();
              const mm = String(today.getMonth() + 1).padStart(2, '0');
              const dd = String(today.getDate()).padStart(2, '0');
              setValue(`${yyyy}-${mm}-${dd}`);
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 text-center transition ${range === 'date'
                ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-sm ring-2 ring-blue-200'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
          >
            <Calendar className={`h-6 w-6 ${range === 'date' ? 'text-blue-600' : 'text-slate-400'}`} />
            <div>
              <div className="text-sm font-black">By Date (รายวัน)</div>
              <div className="text-[11px] text-slate-500 font-medium">เซฟทับเฉพาะวันที่เลือก</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setRange('month');
              setValue(defaultSelectedMonth || (() => {
                const today = new Date();
                return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
              })());
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 text-center transition ${range === 'month'
                ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-sm ring-2 ring-blue-200'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
          >
            <FileSpreadsheet
              className={`h-6 w-6 ${range === 'month' ? 'text-blue-600' : 'text-slate-400'}`}
            />
            <div>
              <div className="text-sm font-black">By Month (รายเดือน)</div>
              <div className="text-[11px] text-slate-500 font-medium">เซฟทับข้อมูลทั้งเดือน</div>
            </div>
          </button>
        </div>

        {/* กล่องคำแนะนำข้อมูล (Informational Guidance Box) */}
        {isImport ? (
          <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/60 via-indigo-50/30 to-white p-4 mb-5 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-black text-blue-900">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span>ระบบตรวจจับและเซฟทับอัตโนมัติ:</span>
            </div>
            <ul className="text-[12px] text-slate-600 font-medium space-y-1 pl-6 list-disc">
              <li>
                <b>By Date:</b> อัปโหลดไฟล์ Excel เพื่ออัปเดตข้อมูลของวันนั้นๆ โดยไม่กระทบวันอื่น
              </li>
              <li>
                <b>By Month:</b> อัปโหลดไฟล์ Excel ทั้งเดือนเพื่อเซฟทับข้อมูลทั้ง 31 วันในเดือนนั้น
              </li>
            </ul>
          </div>
        ) : (
          <div className="mb-5 space-y-2">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
              2. เลือก{range === 'date' ? 'วันที่ (Work Date)' : 'เดือน (Month)'}
            </label>
            <input
              type={range === 'date' ? 'date' : 'month'}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onClick={(e) => {
                try {
                  (e.target as any)?.showPicker?.();
                } catch (_) {}
              }}
              className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm font-black text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100 cursor-pointer"
            />
          </div>
        )}

        <input
          ref={importFileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleImportFile}
          className="hidden"
        />

        {/* ปุ่มดำเนินการ (Action Buttons: ยกเลิก / ส่งออก / เลือกไฟล์) */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting || isExporting}
            className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50"
          >
            ยกเลิก (Cancel)
          </button>

          <button
            type="button"
            onClick={isImport ? startImport : startExport}
            disabled={isImport ? isImporting : !value || isExporting}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-white shadow-lg transition hover:scale-101 active:scale-99 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:shadow-none ${isImport
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/25 hover:shadow-blue-500/40'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-500/25 hover:shadow-emerald-500/40'
              }`}
          >
            {isImport ? (
              <>
                <Upload className="h-4 w-4" />
                <span>{isImporting ? 'กำลังนำเข้าข้อมูล...' : 'เลือกไฟล์ Excel (Select Excel)'}</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>{isExporting ? 'กำลังดาวน์โหลด...' : 'ส่งออกไฟล์ Excel (Export Excel)'}</span>
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

