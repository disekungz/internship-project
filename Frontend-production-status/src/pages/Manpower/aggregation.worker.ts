import { buildFullSpreadsheetData } from './aggregation';
import { lttbDownsample } from '../../utility/performance/highPerformanceUtils';

/**
 * 🚀 High-Performance Dedicated Web Worker for Manpower & Analytics
 * - คำนวณ Full Spreadsheet Data
 * - ฟิลเตอร์และค้นหารายชื่อพนักงานใน Worker Thread 100%
 * - ลดทอนจุดกราฟด้วย LTTB Algorithm
 */
self.onmessage = (event) => {
  const payload = event.data;
  const requestId = payload?.requestId;
  try {
    const { action, records = [], mappings, searchTerm, filterDept, chartData, threshold } = payload || {};

    // 1. จัดการลดทอนจุดข้อมูลกราฟ (Downsample Chart Data ด้วย LTTB Algorithm)
    if (action === 'DOWNSAMPLE_CHART' && Array.isArray(chartData)) {
      const sampled = lttbDownsample(chartData, threshold || 1000);
      self.postMessage({ ok: true, requestId, action: 'DOWNSAMPLE_CHART', sampledData: sampled });
      return;
    }

    // 2. กรองและค้นหารายชื่อพนักงานตามคำค้นหาและแผนก (Filter Records)
    if (action === 'FILTER_RECORDS' && Array.isArray(records)) {
      const filtered = records.filter((r: any) => {
        let match = true;
        if (searchTerm) {
          const term = String(searchTerm).toLowerCase();
          const id = String(r.dlh_employee_id || '').toLowerCase();
          const name = String(r.dlh_employee_name || '').toLowerCase();
          match = id.includes(term) || name.includes(term);
        }
        if (match && filterDept) {
          match = String(r.dlh_department || '') === filterDept;
        }
        return match;
      });

      self.postMessage({ ok: true, requestId, action: 'FILTER_RECORDS', filteredRecords: filtered });
      return;
    }

    // 3. ค่าเริ่มต้น: ประมวลผลและคำนวณโครงสร้างข้อมูลตาราง Manpower (Aggregation Spreadsheet Data)
    const rawRecords = Array.isArray(payload) ? payload : records;
    const rawMappings = Array.isArray(payload) ? undefined : mappings;
    const workingDateKeys = Array.isArray(payload?.workingDateKeys) ? new Set(payload.workingDateKeys) : undefined;
    self.postMessage({
      ok: true,
      requestId,
      spreadsheetData: buildFullSpreadsheetData(rawRecords, rawMappings, workingDateKeys)
    });
  } catch (error) {
    self.postMessage({
      ok: false,
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
