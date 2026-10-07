import { getApiBaseUrl } from "../../../../utils/apiConfig";

/**
 * Productivity Smart Report - Centralized API Service Registry
 * Single Source of Truth for all API endpoints and requests used in Productivity features.
 */

export const PRODUCTIVITY_ENDPOINTS = {
  // 1. Output & Plan Data
  REPORT_DATA: "/productivity/productivity-smart-report",
  PERIOD_SUMMARY: "/productivity/period-summary",
  SMT_DAILY_ACTUAL_OUTPUT: "/productivity/smt-daily-actual-output",
  FPC_DAILY_ACTUAL_PLAN: "/productivity/fpc-daily-actual-plan",
  MAT_DAILY_OUTPUT: "/productivity/mat-daily-output",
  SYNC_MAT_EXCEL: "/productivity/sync-mat-excel",
  UPLOAD_FPC_DAILY_PLAN: "/productivity/upload-fpc-daily-plan",
  UPLOAD_SMT_DAILY_ACTUAL_OUTPUT: "/productivity/upload-smt-daily-actual-output",
  MATRIX_TARGETS: "/productivity/matrix-targets",
  SAVE_MATRIX_TARGETS: "/productivity/save-matrix-targets",
  MAT_TARGETS: "/productivity/mat-targets",
  SAVE_MAT_TARGETS: "/productivity/save-mat-targets",

  // 2. Attendance & Schedule
  ATTENDANCE_SUMMARY: "/productivity/attendance/summary",
  CALENDAR: "/productivity/calendar",
  EMPLOYEE_SCANS: "/productivity/attendance/employee-scans",
  LATEST_SCAN_DATE: "/productivity/attendance/latest-scan-date",
  ATTENDANCE_MONTH_STATUS: "/productivity/attendance/month-status",
  SYNC_ATTENDANCE_SELECTIVE: "/productivity/attendance/sync-selective",

  // 3. Manpower Loan & Exclude
  LOAN_EXCLUDE: "/productivity/attendance/loan-exclude",
  LOAN_EXCLUDE_BULK_UPDATE: "/productivity/attendance/loan-exclude/bulk-update",
  LOAN_EXCLUDE_BULK_DELETE: "/productivity/attendance/loan-exclude/bulk-delete",
  CHECK_LOANED_FROM_ATTENDANCE: "/productivity/attendance/check-loaned-from-attendance",
  SYNC_LOANED_FROM_ATTENDANCE: "/productivity/attendance/sync-loaned-from-attendance",
  EMPLOYEE_CHECK: "/productivity/attendance/employee-check",

  // 4. Line Group & Macro Settings
  LINE_GROUPS: "/productivity/line-groups",
  SETTINGS_LINE_GROUPS: "/productivity/settings/line-groups",
  SETTINGS_OUTPUT_OPTIONS: "/productivity/settings/output-options",
  SETTINGS_SYNC_OUTPUT_SNAPSHOT: "/productivity/settings/sync-output-snapshot",
  SETTINGS_SYNC_MACHINES: "/productivity/settings/line-groups/sync-machines",
  SETTINGS_MACRO_LINES: "/productivity/settings/macro-lines",

  // 5. Cost Center Management
  SETTINGS_COST_CENTERS: "/productivity/settings/cost-centers",
  SETTINGS_COST_CENTER_AUDIT_LOGS: "/productivity/settings/cost-center-audit-logs",
  SETTINGS_CHECK_LINE_HELP: "/productivity/settings/check-line-help",

  // 6. Excel Sync & Import History
  SYNC_FPC_FOLDER: "/productivity/sync-fpc-folder",
  SYNC_EXCEL_FOLDER: "/productivity/sync-excel-folder",
  EXCEL_IMPORT_HISTORY: "/productivity/excel-import-history",
} as const;

/**
 * Fetch array data in month chunks if date range exceeds 35 days.
 */
export const fetchDataInChunksArray = async (
  urlPath: string,
  params: URLSearchParams,
  startStr: string,
  endStr: string
): Promise<any[]> => {
  const baseUrl = getApiBaseUrl();
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 35) {
    const res = await fetch(`${baseUrl}${urlPath}?${params.toString()}`);
    if (!res.ok) throw new Error(`Failed to fetch ${urlPath}`);
    return await res.json();
  }

  const chunks: { start: string; end: string }[] = [];
  let current = new Date(start);
  while (current <= end) {
    const year = current.getFullYear();
    const month = current.getMonth();
    const endOfMonth = new Date(year, month + 1, 0);
    const chunkEnd = endOfMonth < end ? endOfMonth : end;
    const format = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    chunks.push({ start: format(current), end: format(chunkEnd) });
    current = new Date(year, month + 1, 1);
  }

  let allData: any[] = [];
  for (let i = 0; i < chunks.length; i += 4) {
    const batch = chunks.slice(i, i + 4);
    const promises = batch.map(async (chunk) => {
      const chunkParams = new URLSearchParams(params.toString());
      chunkParams.set("startDate", chunk.start);
      chunkParams.set("endDate", chunk.end);
      const res = await fetch(`${baseUrl}${urlPath}?${chunkParams.toString()}`);
      if (!res.ok) throw new Error(`Failed to fetch ${urlPath} for ${chunk.start}`);
      return res.json();
    });
    const results = await Promise.all(promises);
    results.forEach((data) => {
      if (Array.isArray(data)) allData = allData.concat(data);
    });
  }
  return allData;
};

/**
 * Fetch key-value object data in month chunks if date range exceeds 35 days.
 */
export const fetchDataInChunksObject = async (
  urlPath: string,
  params: URLSearchParams,
  startStr: string,
  endStr: string
): Promise<Record<string, any>> => {
  const baseUrl = getApiBaseUrl();
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 35) {
    const res = await fetch(`${baseUrl}${urlPath}?${params.toString()}`);
    if (!res.ok) throw new Error(`Failed to fetch ${urlPath}`);
    return await res.json();
  }

  const chunks: { start: string; end: string }[] = [];
  let current = new Date(start);
  while (current <= end) {
    const year = current.getFullYear();
    const month = current.getMonth();
    const endOfMonth = new Date(year, month + 1, 0);
    const chunkEnd = endOfMonth < end ? endOfMonth : end;
    const format = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    chunks.push({ start: format(current), end: format(chunkEnd) });
    current = new Date(year, month + 1, 1);
  }

  let allData: Record<string, any> = {};
  for (let i = 0; i < chunks.length; i += 4) {
    const batch = chunks.slice(i, i + 4);
    const promises = batch.map(async (chunk) => {
      const chunkParams = new URLSearchParams(params.toString());
      chunkParams.set("startDate", chunk.start);
      chunkParams.set("endDate", chunk.end);
      const res = await fetch(`${baseUrl}${urlPath}?${chunkParams.toString()}`);
      if (!res.ok) throw new Error(`Failed to fetch ${urlPath} for ${chunk.start}`);
      return res.json();
    });
    const results = await Promise.all(promises);
    results.forEach((data) => {
      if (data && typeof data === "object" && !Array.isArray(data)) {
        allData = { ...allData, ...data };
      }
    });
  }
  return allData;
};

// ==========================================
// 1. Output & Plan Data Services
// ==========================================

/**
 * Fetch detailed line group output rows for the matrix table.
 */
export const fetchProductivityReportData = async (
  params: URLSearchParams,
  startDate: string,
  endDate: string
): Promise<any[]> => {
  return fetchDataInChunksArray(PRODUCTIVITY_ENDPOINTS.REPORT_DATA, params, startDate, endDate);
};

/**
 * Fetch precomputed period summary (weekly, monthly, quarterly, yearly).
 */
export const fetchPeriodSummaryData = async (
  periodType: string,
  startDate: string,
  endDate: string
): Promise<any[]> => {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(
    `${baseUrl}${PRODUCTIVITY_ENDPOINTS.PERIOD_SUMMARY}?periodType=${periodType}&startDate=${startDate}&endDate=${endDate}`
  );
  if (!res.ok) throw new Error(`Failed to fetch ${periodType} period summary`);
  return res.json();
};

/**
 * Fetch SMT daily actual output plan numbers for date range.
 */
export const fetchSmtDailyActualOutput = async (
  startDate: string,
  endDate: string
): Promise<any[]> => {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(
    `${baseUrl}${PRODUCTIVITY_ENDPOINTS.SMT_DAILY_ACTUAL_OUTPUT}?startDate=${startDate}&endDate=${endDate}`
  );
  if (!res.ok) return [];
  return res.json();
};

/**
 * Fetch FPC daily actual plan numbers for date range.
 */
export const fetchFpcDailyActualPlan = async (
  startDate: string,
  endDate: string
): Promise<any[]> => {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(
    `${baseUrl}${PRODUCTIVITY_ENDPOINTS.FPC_DAILY_ACTUAL_PLAN}?startDate=${startDate}&endDate=${endDate}`
  );
  if (!res.ok) return [];
  return res.json();
};

export interface MatDailyOutputItem {
  date: string;
  pd_output: number | string;
  mos_output: number | string;
  pd_prod_target?: number | string | null;
  sht_prod_target?: number | string | null;
  source_file?: string;
}

/**
 * Fetch LINE MAT daily actual output (PD_Output & MOS_Output) for date range.
 */
export const fetchMatDailyOutput = async (
  startDate: string,
  endDate: string
): Promise<MatDailyOutputItem[]> => {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(
    `${baseUrl}${PRODUCTIVITY_ENDPOINTS.MAT_DAILY_OUTPUT}?startDate=${startDate}&endDate=${endDate}`
  );
  if (!res.ok) return [];
  return res.json();
};

/**
 * Trigger on-demand sync of LINE MAT Excel file from network folder.
 */
export const syncMatExcel = async (): Promise<any> => {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}${PRODUCTIVITY_ENDPOINTS.SYNC_MAT_EXCEL}`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Failed to sync MAT Excel");
  return res.json();
};

// ==========================================
// 2. Attendance & Schedule Services
// ==========================================

/**
 * Fetch daily attendance summary (headcount, actual, OT, man-hours) for date range.
 */
export const fetchAttendanceSummaryData = async (
  startDate: string,
  endDate: string
): Promise<Record<string, any>> => {
  const params = new URLSearchParams({ startDate, endDate, _t: Date.now().toString() });
  return fetchDataInChunksObject(PRODUCTIVITY_ENDPOINTS.ATTENDANCE_SUMMARY, params, startDate, endDate);
};

/**
 * Fetch working day and holiday calendar map.
 */
export const fetchCalendarData = async (): Promise<Record<string, number>> => {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}${PRODUCTIVITY_ENDPOINTS.CALENDAR}`);
  if (!res.ok) throw new Error("Failed to fetch calendar data");
  return res.json();
};

/**
 * Fetch employee card swipe scan detail for an individual line group on a target date.
 */
export const fetchEmployeeScans = async (
  date: string,
  lineGroup: string
): Promise<any> => {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(
    `${baseUrl}${PRODUCTIVITY_ENDPOINTS.EMPLOYEE_SCANS}?date=${encodeURIComponent(date)}&lineGroup=${encodeURIComponent(lineGroup)}`
  );
  if (!res.ok) throw new Error("Failed to fetch employee scans");
  return res.json();
};

/**
 * Fetch latest scan date available in attendance database.
 */
export const fetchLatestScanDate = async (): Promise<{ success: boolean; latestDate: string }> => {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}${PRODUCTIVITY_ENDPOINTS.LATEST_SCAN_DATE}`);
  if (!res.ok) return { success: true, latestDate: new Date().toISOString().slice(0, 10) };
  return res.json();
};

/**
 * Fetch attendance update status by month.
 */
export const fetchAttendanceMonthStatus = async (
  startDate: string,
  endDate: string
): Promise<any> => {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(
    `${baseUrl}${PRODUCTIVITY_ENDPOINTS.ATTENDANCE_MONTH_STATUS}?startDate=${startDate}&endDate=${endDate}`
  );
  if (!res.ok) throw new Error("Failed to fetch attendance month status");
  return res.json();
};

/**
 * Trigger selective synchronization of attendance data for specific dates.
 */
export const syncAttendanceSelective = async (
  dates: string[]
): Promise<any> => {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}${PRODUCTIVITY_ENDPOINTS.SYNC_ATTENDANCE_SELECTIVE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dates }),
  });
  if (!res.ok) throw new Error("Failed to sync attendance selectively");
  return res.json();
};

// ==========================================
// 3. Settings & Line Configurations
// ==========================================

/**
 * Fetch dynamic line group definitions from database.
 */
export const fetchLineGroupsData = async (): Promise<any[]> => {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}${PRODUCTIVITY_ENDPOINTS.LINE_GROUPS}`);
  if (!res.ok) throw new Error("Failed to fetch line groups");
  return res.json();
};

/**
 * Fetch custom macro line configurations.
 */
export const fetchMacroLinesData = async (): Promise<any[]> => {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}${PRODUCTIVITY_ENDPOINTS.SETTINGS_MACRO_LINES}`);
  if (!res.ok) throw new Error("Failed to fetch macro lines");
  return res.json();
};

/**
 * Save or update custom macro line configuration.
 */
export const saveMacroLineData = async (
  macroLine: any,
  performedBy = "Admin"
): Promise<any> => {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}${PRODUCTIVITY_ENDPOINTS.SETTINGS_MACRO_LINES}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...macroLine, performed_by: performedBy }),
  });
  if (!res.ok) throw new Error("Failed to save macro line");
  return res.json();
};

/**
 * Delete custom macro line configuration.
 */
export const deleteMacroLineData = async (
  id: number | string,
  performedBy = "Admin"
): Promise<any> => {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(
    `${baseUrl}${PRODUCTIVITY_ENDPOINTS.SETTINGS_MACRO_LINES}/${id}?performed_by=${encodeURIComponent(performedBy)}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error("Failed to delete macro line");
  return res.json();
};

// ==========================================
// 4. Excel Sync Services
// ==========================================

/**
 * Trigger background sync for FPC Excel share folder.
 */
export const syncFpcFolder = async (): Promise<any> => {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}${PRODUCTIVITY_ENDPOINTS.SYNC_FPC_FOLDER}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to sync FPC folder");
  return res.json();
};

/**
 * Trigger background sync for general Excel share folder.
 */
export const syncExcelFolder = async (): Promise<any> => {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}${PRODUCTIVITY_ENDPOINTS.SYNC_EXCEL_FOLDER}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to sync Excel folder");
  return res.json();
};

/**
 * Fetch Excel file import history logs.
 */
export const fetchExcelImportHistory = async (): Promise<any[]> => {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}${PRODUCTIVITY_ENDPOINTS.EXCEL_IMPORT_HISTORY}`);
  if (!res.ok) throw new Error("Failed to fetch Excel import history");
  return res.json();
};

// ==========================================
// 5. Matrix Targets Services
// ==========================================

export interface MatrixTargetItem {
  line: string;
  date: string;
  pcs_prod_target?: number;
  sht_prod_target?: number;
}

export const fetchMatrixTargetsData = async (
  startDate: string,
  endDate: string,
  line?: string
): Promise<MatrixTargetItem[]> => {
  const baseUrl = getApiBaseUrl();
  let url = `${baseUrl}${PRODUCTIVITY_ENDPOINTS.MATRIX_TARGETS}?startDate=${startDate}&endDate=${endDate}`;
  if (line) url += `&line=${encodeURIComponent(line)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
};

export const saveMatrixTargetsData = async (
  records: MatrixTargetItem[],
  monthLabel?: string
): Promise<{ success: boolean; count: number }> => {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}${PRODUCTIVITY_ENDPOINTS.SAVE_MATRIX_TARGETS}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records, monthLabel }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.details || err.error || "Failed to save matrix targets");
  }
  return res.json();
};

// 6. LINE MAT Targets Services (pd_prod_target, sht_prod_target in mat_daily_output)
// ==========================================

export interface MatTargetItem {
  date: string;
  pd_prod_target?: number | null;
  sht_prod_target?: number | null;
}

export const fetchMatTargetsData = async (
  startDate: string,
  endDate: string
): Promise<MatTargetItem[]> => {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${PRODUCTIVITY_ENDPOINTS.MAT_TARGETS}?startDate=${startDate}&endDate=${endDate}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
};

export const saveMatTargetsData = async (
  records: MatTargetItem[],
  monthLabel?: string
): Promise<{ success: boolean; count: number }> => {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}${PRODUCTIVITY_ENDPOINTS.SAVE_MAT_TARGETS}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records, monthLabel }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.details || err.error || "Failed to save MAT targets");
  }
  return res.json();
};
