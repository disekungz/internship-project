/**
 * Hook: useManHourImport
 * จัดการกระบวนการนำเข้า (Import) และลบข้อมูล (Delete) การลงเวลาทำงานของพนักงาน
 * - แปลงและตรวจสอบข้อมูลจากไฟล์ Excel
 * - จัดการสิทธิ์ Admin Authentication ก่อนบันทึกหรือลบข้อมูล
 * - อัปเดตข้อมูลและล้างแคชอัตโนมัติ
 */
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { MANHOUR_CALENDAR_ENDPOINT, MANHOUR_IMPORT_COLUMNS, MANHOUR_IMPORT_ENDPOINT } from '../constants';

// ฟังก์ชันสร้าง Header พร้อม JWT Token สำหรับ Admin
const adminHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('manhour-admin-token') || ''}` });
const monthDeleteCandidatesCache = new Map();

/**
 * ตรวจสอบสิทธิ์ผู้ดูแลระบบ (Admin) หากยังไม่ได้ Login จะมี Prompt ให้กรอกรหัสผ่าน
 */
const ensureAdmin = async () => {
  if (sessionStorage.getItem('manhour-admin-token')) return true;
  const username = window.prompt('Admin username');
  const password = username ? window.prompt('Admin password') : null;
  if (!username || !password) return false;
  const response = await fetch(MANHOUR_IMPORT_ENDPOINT.replace('/import', '/auth/login'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const result = await response.json();
  if (!response.ok || !result.token) throw new Error(result.error || 'Admin login failed');
  sessionStorage.setItem('manhour-admin-token', result.token);
  return true;
};
import { excelDateKey, excelDateTime, excelValueToIso, isThaiAttendanceRow } from '../utils';

/**
 * ปรับฟอร์แมตรหัสกะการทำงาน (Work Day Status)
 * ตัวอย่าง: NAP01W -> W (Working Day), NAP01O -> O (Off / Holiday)
 */
const normalizeWorkDayStatus = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  if (!/^NAP/i.test(text)) return text;
  const match = text.match(/([OWH])\s*$/i);
  return match ? match[1].toUpperCase() : text;
};

export default function useManHourImport({ triggerToast, invalidateManhourCache }) {
  const [importMode, setImportMode] = useState('auto');
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [pendingImport, setPendingImport] = useState(null);
  const [deleteDate, setDeleteDate] = useState('');
  const [deleteMode, setDeleteMode] = useState('date');
  const [isDeletingDay, setIsDeletingDay] = useState(false);
  const [deleteCandidates, setDeleteCandidates] = useState(null);
  const importFileRef = useRef(null);

  /**
   * จัดการเมื่อผู้ใช้อัปโหลดไฟล์ Excel เพื่อนำเข้าข้อมูลลงเวลา
   */
  const handleManhourImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      setIsImporting(true);
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const excelRows = workbook.SheetNames.flatMap(sheetName =>
        XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })
      );
      if (!excelRows.length) throw new Error('Excel file has no data.');

      const thaiFormat = excelRows.some(isThaiAttendanceRow);
      if (!thaiFormat) {
        const missingColumns = MANHOUR_IMPORT_COLUMNS.filter(column => !(column in excelRows[0]));
        if (missingColumns.length) throw new Error(`Missing columns: ${missingColumns.join(', ')}`);
      }

      const thaiWorkDayColumn = thaiFormat
        ? Object.keys(excelRows[0] || {}).find(key => /รหัส.*กะ|work\s*day|shift\s*(?:code|work)|schedule/i.test(String(key)))
          || Object.keys(excelRows[0] || {}).find(key => excelRows.some(row => /^(?:NAP|1N)[A-Z0-9]*[OWH]$/i.test(String(row[key] || '').trim())))
        : null;
      const uniqueRows = new Map();
      excelRows.forEach((row, index) => {
        const effectiveDateKey = thaiFormat
          ? excelDateKey(row['วันที่มีผล*'])
          : excelDateKey(row.dlh_effective_date_time);
        const employeeId = String(thaiFormat ? row['รหัสพนักงาน*'] : row.dlh_employee_id || '').trim();
        if (!employeeId || !effectiveDateKey) throw new Error(`Invalid employee/date near Excel data row ${index + 2}`);

        const scanIn = thaiFormat
          ? excelDateTime(row['วันที่เข้างาน 1'], row['เวลาเข้า 1'])
          : excelValueToIso(row.scan_time_in);
        const scanOut = thaiFormat
          ? excelDateTime(row['วันที่ออกงาน 1'], row['เวลาออก 1'])
          : excelValueToIso(row.scan_time_out);
        const nameColumn = Object.keys(row).find(key => /name|ชื่อ/i.test(String(key)));
        const workDayColumn = thaiFormat
          ? Object.keys(row).find(key => /รหัส.*กะ|work\s*day|shift\s*(?:code|work)|schedule/i.test(String(key)))
          : null;
        const sourceWorkDay = thaiFormat ? row[workDayColumn || ''] : row.work_day_status;
        const sourceWorkDayValue = thaiFormat ? row[thaiWorkDayColumn || ''] : row.work_day_status;
        const normalizedRow = {
          dlh_employee_id: employeeId,
          employee_name: nameColumn ? String(row[nameColumn] || '').trim() : '',
          dlh_effective_date_time: effectiveDateKey,
          work_day_status: normalizeWorkDayStatus(sourceWorkDayValue),
          work_status: thaiFormat ? ((scanIn || scanOut) ? 'Normal' : 'Absent') : (row.work_status || null),
          scan_time_in: scanIn,
          scan_time_out: scanOut,
        };
        uniqueRows.set(`${employeeId}_${effectiveDateKey}`, normalizedRow);
      });
      let rows = [...uniqueRows.values()];

      const months = [...new Set(rows.map(row => row.dlh_effective_date_time.slice(0, 7)))];
      if (months.length !== 1) throw new Error('Excel must contain data from exactly one month.');
      const month = months[0];
      const importedDates = new Set(rows.map(row => row.dlh_effective_date_time));
      const [monthYear, monthNumber] = month.split('-').map(Number);
      const daysInMonth = new Date(Date.UTC(monthYear, monthNumber, 0)).getUTCDate();
      const automaticMode = importedDates.size >= daysInMonth ? 'replace' : 'replace_day';
      try {
        const calendarResponse = await fetch(`${MANHOUR_CALENDAR_ENDPOINT}?month=${month}&refresh=1`, { cache: 'no-store' });
        if (calendarResponse.ok) {
          const calendarRows = await calendarResponse.json();
          const calendarMap = new Map((Array.isArray(calendarRows) ? calendarRows : []).map(item => [
            String(item.date || '').slice(0, 10),
            String(item.result || '').trim().toLowerCase(),
          ]));
          rows = rows.map(row => {
            if (String(row.work_day_status || '').trim()) return row;
            const result = calendarMap.get(row.dlh_effective_date_time);
            return {
              ...row,
              work_day_status: normalizeWorkDayStatus(result === 'holiday' ? 'H' : result === 'working day' ? 'W' : null),
            };
          });
        }
      } catch (calendarError) {
        console.warn('Unable to apply work-day calendar during preview:', calendarError);
      }
      const dateKeys = rows.map(row => row.dlh_effective_date_time).sort();
      const employeeCount = new Set(rows.map(row => row.dlh_employee_id)).size;
      const normalCount = rows.filter(row => String(row.work_status || '').toLowerCase() === 'normal').length;
      const absentCount = rows.filter(row => String(row.work_status || '').toLowerCase() === 'absent').length;
      const scanInCount = rows.filter(row => Boolean(row.scan_time_in)).length;
      const scanOutCount = rows.filter(row => Boolean(row.scan_time_out)).length;
      const duplicateCount = Math.max(0, excelRows.length - rows.length);
      setPendingImport({
        fileName: file.name,
        mode: automaticMode,
        month,
        rows,
        sourceRows: excelRows.length,
        duplicateRows: duplicateCount,
        employeeCount,
        startDate: dateKeys[0],
        endDate: dateKeys[dateKeys.length - 1],
        normalCount,
        absentCount,
        scanInCount,
        scanOutCount,
      });
    } catch (error) {
      console.error('Man-hour import failed:', error);
      triggerToast(`Import failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const updatePendingImportRow = (index, field, value) => {
    setPendingImport(prev => prev ? {
      ...prev,
      rows: prev.rows.map((row, rowIndex) => rowIndex === index ? {
        ...row,
        [field]: field === 'work_day_status' ? normalizeWorkDayStatus(value) : value,
      } : row),
    } : prev);
  };

  const addPendingImportRow = () => {
    setPendingImport(prev => {
      if (!prev) return prev;
      const workDate = prev.startDate || `${prev.month}-01`;
      return {
        ...prev,
        rows: [...prev.rows, {
          dlh_employee_id: '',
          employee_name: '',
          dlh_effective_date_time: workDate,
          work_day_status: 'W',
          work_status: 'Normal',
          scan_time_in: null,
          scan_time_out: null,
        }],
      };
    });
  };

  const confirmManhourImport = async () => {
    if (!pendingImport) return;
    if (!await ensureAdmin()) return;
    const invalidIndex = pendingImport.rows.findIndex(row => !String(row.dlh_employee_id || '').trim() || !row.dlh_effective_date_time);
    if (invalidIndex >= 0) {
      triggerToast(`Row ${invalidIndex + 1} requires employee ID and date.`);
      return;
    }

    try {
      setIsImporting(true);
      const response = await fetch(MANHOUR_IMPORT_ENDPOINT, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ mode: pendingImport.mode, month: pendingImport.month, rows: pendingImport.rows }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);

      await invalidateManhourCache?.([...new Set(pendingImport.rows.map(row => String(row.dlh_effective_date_time || '').slice(0, 10)).filter(Boolean))]);
      const importedCount = Number(result.imported ?? pendingImport.rows.length);
      setImportSummary({ ...pendingImport, importedRows: importedCount, uniqueRows: pendingImport.rows.length });
      setPendingImport(null);
      triggerToast(`Imported ${importedCount.toLocaleString()} rows for ${pendingImport.month}.`);
    } catch (error) {
      console.error('Man-hour import failed:', error);
      triggerToast(`Import failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteDay = async () => {
    if (!deleteDate) {
      triggerToast('Please select a date to delete.');
      return;
    }
    try {
      setIsDeletingDay(true);
      const cacheKey = deleteMode === 'month' ? deleteDate : '';
      const cached = cacheKey ? monthDeleteCandidatesCache.get(cacheKey) : null;
      if (cached && Date.now() - cached.savedAt < 10 * 1000) {
        setDeleteCandidates(cached.rows);
        return;
      }
      const endpoint = deleteMode === 'month'
        ? `${MANHOUR_IMPORT_ENDPOINT}/month/${deleteDate}`
        : `${MANHOUR_IMPORT_ENDPOINT}/day/${deleteDate}`;
      const response = await fetch(endpoint, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      setDeleteCandidates(Array.isArray(result) ? result : []);
      if (cacheKey && Array.isArray(result)) monthDeleteCandidatesCache.set(cacheKey, { savedAt: Date.now(), rows: result });
      if (!Array.isArray(result) || result.length === 0) triggerToast(`No attendance records found for ${deleteDate}.`);
    } catch (error) {
      console.error('Load delete candidates failed:', error);
      triggerToast(`Unable to load records: ${error.message || 'Unknown error'}`);
    } finally {
      setIsDeletingDay(false);
    }
  };

  const confirmDeleteEmployees = async (records) => {
    if (!deleteDate || !Array.isArray(records) || records.length === 0) return;
    if (!await ensureAdmin()) return;
    const confirmation = await Swal.fire({
      title: 'Delete selected records?',
      text: `Delete ${records.length.toLocaleString()} selected attendance records?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete records',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed) return;
    try {
      setIsDeletingDay(true);
      const requestDate = deleteMode === 'month' ? `${deleteDate}-01` : deleteDate;
      const response = await fetch(`${MANHOUR_IMPORT_ENDPOINT}/day/${requestDate}`, {
        method: 'DELETE',
        headers: adminHeaders(),
        body: JSON.stringify({ records }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      const affectedDates = [
        ...new Set([
          ...records.map(record => record?.effectiveDate),
        ].filter(Boolean)),
      ];
      await invalidateManhourCache?.(affectedDates);
      triggerToast(`Deleted ${Number(result.deleted || 0).toLocaleString()} selected rows for ${deleteDate}.`);
      setDeleteCandidates(null);
      monthDeleteCandidatesCache.delete(deleteDate.slice(0, 7));
      setDeleteDate('');
    } catch (error) {
      console.error('Delete selected employees failed:', error);
      triggerToast(`Delete failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsDeletingDay(false);
    }
  };

  return {
    importMode, setImportMode, isImporting, importSummary, setImportSummary,
    pendingImport, setPendingImport, deleteDate, setDeleteDate, deleteMode, setDeleteMode, isDeletingDay, deleteCandidates, setDeleteCandidates,
    importFileRef, handleManhourImport, updatePendingImportRow, addPendingImportRow,
    confirmManhourImport, handleDeleteDay, confirmDeleteEmployees,
  };
}
