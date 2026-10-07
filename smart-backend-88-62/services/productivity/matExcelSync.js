const fs = require('fs');
const path = require('path');
const os = require('os');
const xlsx = require('xlsx');
const { pool_test } = require('../../routes/10.17.87.244/config');
const poolTest = pool_test;

const XLSX = xlsx.default || xlsx;

const isWindows = os.platform() === 'win32';

const BASE_PATH = isWindows
  ? '\\\\10.17.88.65\\file centers'
  : '/app/file_Folder/OUTPUT_FOLDER';
const MAT_OUTPUT_NETWORK_FOLDER = process.env.MAT_OUTPUT_FOLDER ||
  path.join(BASE_PATH, 'EFPC', '01.Production EFPC', 'Line Mat', 'OUT PUT ส่งพี่ปู');

async function ensureMatOutputTable() {
  await poolTest.query(`
    CREATE TABLE IF NOT EXISTS public.mat_daily_output (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL UNIQUE,
      pd_output NUMERIC(15, 2) DEFAULT 0,
      mos_output NUMERIC(15, 2) DEFAULT 0,
      pd_prod_target NUMERIC(15, 2) DEFAULT NULL,
      sht_prod_target NUMERIC(15, 2) DEFAULT NULL,
      source_file VARCHAR(255),
      imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function excelSerialToDate(serial, dominantYearMonth = '') {
  if (!serial) return null;
  if (serial instanceof Date) {
    return serial.toISOString().split('T')[0];
  }
  if (typeof serial === 'number') {
    if (serial >= 1 && serial <= 31 && dominantYearMonth && /^\d{4}-\d{2}$/.test(dominantYearMonth)) {
      return `${dominantYearMonth}-${String(serial).padStart(2, '0')}`;
    }
    const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }
  if (typeof serial === 'string') {
    const s = serial.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const num = Number(s);
    if (!isNaN(num)) {
      if (num >= 1 && num <= 31 && dominantYearMonth && /^\d{4}-\d{2}$/.test(dominantYearMonth)) {
        return `${dominantYearMonth}-${String(num).padStart(2, '0')}`;
      }
      if (num > 30000 && num < 60000) {
        const d = new Date(Math.round((num - 25569) * 86400 * 1000));
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      }
    }
  }
  return null;
}

function detectYearMonthFromCellE3(sheet) {
  if (!sheet) return null;
  const cell = sheet['E3'] || sheet['e3'];
  if (!cell) return null;

  if (typeof cell.v === 'number' && cell.v > 30000 && cell.v < 60000) {
    const d = new Date(Math.round((cell.v - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      const yStr = d.getUTCFullYear();
      const mStr = String(d.getUTCMonth() + 1).padStart(2, '0');
      return `${yStr}-${mStr}`;
    }
  }

  const text = String(cell.w || cell.v || '').trim();
  if (!text) return null;

  const monthMap = {
    january: '01', jan: '01',
    february: '02', feb: '02',
    march: '03', mar: '03',
    april: '04', apr: '04',
    may: '05',
    june: '06', jun: '06',
    july: '07', jul: '07',
    august: '08', aug: '08',
    september: '09', sept: '09', sep: '09',
    october: '10', oct: '10',
    november: '11', nov: '11',
    december: '12', dec: '12'
  };

  const lower = text.toLowerCase();
  for (const [mName, mNum] of Object.entries(monthMap)) {
    if (lower.includes(mName)) {
      const year4 = text.match(/20\d{2}/);
      if (year4) return `${year4[0]}-${mNum}`;
      const year2 = text.match(/[-/\s](\d{2})$/);
      if (year2) return `20${year2[1]}-${mNum}`;
      return `${new Date().getFullYear()}-${mNum}`;
    }
  }

  const ymd = text.match(/^(\d{4})[-/](\d{1,2})/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}`;
  const mmy = text.match(/^(\d{1,2})[-/](\d{4})/);
  if (mmy) return `${mmy[2]}-${mmy[1].padStart(2, '0')}`;

  return null;
}

function findLatestMatExcelFile(folderPath = MAT_OUTPUT_NETWORK_FOLDER) {
  let targetFolder = folderPath;
  if (!fs.existsSync(targetFolder)) {
    const parentFolder = path.join(BASE_PATH, 'EFPC', '01.Production EFPC', 'Line Mat');
    if (fs.existsSync(parentFolder)) {
      const subdirs = fs.readdirSync(parentFolder);
      const matchDir = subdirs.find(d => d.toLowerCase().includes('out put'));
      if (matchDir) {
        targetFolder = path.join(parentFolder, matchDir);
      }
    }
  }

  if (!fs.existsSync(targetFolder)) {
    throw new Error('Directory not found: ' + targetFolder);
  }

  const files = fs.readdirSync(targetFolder);

  // 1. Primary match: Starts with "File Scan mat" (case-insensitive, flexible whitespace/underscores)
  let candidates = files.filter(f => {
    const trimmed = f.trim();
    if (trimmed.startsWith('~$')) return false;
    const lower = trimmed.toLowerCase();
    const isExcel = lower.endsWith('.xlsm') || lower.endsWith('.xlsx') || lower.endsWith('.xlsb') || lower.endsWith('.xls');
    if (!isExcel) return false;

    return /^file[\s_-]*scan[\s_-]*mat/i.test(trimmed);
  });

  // 2. Fallback: contains "file scan mat" or "scan mat"
  if (candidates.length === 0) {
    candidates = files.filter(f => {
      const trimmed = f.trim();
      if (trimmed.startsWith('~$')) return false;
      const lower = trimmed.toLowerCase();
      const isExcel = lower.endsWith('.xlsm') || lower.endsWith('.xlsx') || lower.endsWith('.xlsb') || lower.endsWith('.xls');
      if (!isExcel) return false;

      return lower.includes('file scan mat') || lower.includes('scan mat');
    });
  }

  if (candidates.length === 0) {
    throw new Error("No Excel file starting with 'File Scan mat' found in: " + targetFolder);
  }

  const sorted = candidates.map(f => {
    const fullPath = path.join(targetFolder, f);
    const stat = fs.statSync(fullPath);
    return { name: f, fullPath, mtime: stat.mtimeMs };
  }).sort((a, b) => b.mtime - a.mtime);

  return sorted[0];
}

function parseMatOutputSheet(buf, fileName = '') {
  const wb = XLSX.read(buf, { type: 'buffer', sheets: ['Output Report'], cellDates: false });
  const sheet = wb.Sheets['Output Report'];
  if (!sheet) {
    throw new Error(`Sheet 'Output Report' not found in ${fileName}`);
  }

  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (!rawRows || rawRows.length < 5) {
    throw new Error(`Sheet 'Output Report' has insufficient rows`);
  }

  let headerRow = rawRows[2];
  let pdRow = rawRows[3];
  let mosRow = rawRows[4];

  for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
    const row = rawRows[r];
    if (!row || !Array.isArray(row)) continue;
    const firstCell = String(row[0] || '').trim().toUpperCase();
    if (firstCell === 'SPDLINEMAT') {
      pdRow = row;
    } else if (firstCell === 'SMLINEMAT') {
      mosRow = row;
    } else if (firstCell === 'UNIT CONTROL' || row.some(c => String(c || '').trim().toUpperCase() === 'UNIT CONTROL')) {
      headerRow = row;
    }
  }

  if (!headerRow || !pdRow || !mosRow) {
    throw new Error(`Could not find required header or SPDLINEMAT/SMLINEMAT rows in sheet 'Output Report'`);
  }

  const dominantYearMonth = detectYearMonthFromCellE3(sheet);
  if (dominantYearMonth) {
    console.log(`[MatExcelSync] Detected dominant month from cell E3: ${dominantYearMonth}`);
  }

  const records = [];
  for (let c = 5; c < headerRow.length; c++) {
    const dateVal = headerRow[c];
    const dateStr = excelSerialToDate(dateVal, dominantYearMonth);
    if (!dateStr) continue;

    const rawPd = pdRow[c];
    const rawMos = mosRow[c];

    const pdVal = (rawPd !== null && rawPd !== undefined && rawPd !== '' && !isNaN(Number(rawPd)))
      ? Math.max(0, Math.round(Number(rawPd)))
      : 0;
    const mosVal = (rawMos !== null && rawMos !== undefined && rawMos !== '' && !isNaN(Number(rawMos)))
      ? Math.max(0, Math.round(Number(rawMos)))
      : 0;

    records.push({
      date: dateStr,
      pd_output: pdVal,
      mos_output: mosVal,
      source_file: fileName
    });
  }

  return records;
}

async function saveMatRecords(records = [], fileName = 'LineMatSync') {
  if (!records || records.length === 0) return 0;
  await ensureMatOutputTable();

  // Pre-fetch existing records to know which dates already exist in the database
  const dates = records.map(r => r.date).filter(Boolean);
  let existingDatesSet = new Set();
  if (dates.length > 0) {
    const existingRes = await poolTest.query(
      'SELECT date::text as date FROM public.mat_daily_output WHERE date::text = ANY($1::text[])',
      [dates]
    );
    existingDatesSet = new Set(existingRes.rows.map(r => r.date));
  }

  let savedCount = 0;
  for (const rec of records) {
    if (!rec.date) continue;

    const pd = Math.max(0, Math.round(Number(rec.pd_output) || 0));
    const mos = Math.max(0, Math.round(Number(rec.mos_output) || 0));
    const alreadyExists = existingDatesSet.has(rec.date);

    // If record doesn't exist yet and both incoming values are 0, skip inserting empty placeholder row
    if (!alreadyExists && pd === 0 && mos === 0) {
      continue;
    }

    await poolTest.query(`
      INSERT INTO public.mat_daily_output (date, pd_output, mos_output, source_file, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (date) DO UPDATE SET
        pd_output = CASE
          WHEN EXCLUDED.pd_output > 0 THEN EXCLUDED.pd_output
          ELSE public.mat_daily_output.pd_output
        END,
        mos_output = CASE
          WHEN EXCLUDED.mos_output > 0 THEN EXCLUDED.mos_output
          ELSE public.mat_daily_output.mos_output
        END,
        source_file = CASE
          WHEN EXCLUDED.pd_output > 0 OR EXCLUDED.mos_output > 0 THEN EXCLUDED.source_file
          ELSE public.mat_daily_output.source_file
        END,
        updated_at = CASE
          WHEN EXCLUDED.pd_output > 0 OR EXCLUDED.mos_output > 0 THEN CURRENT_TIMESTAMP
          ELSE public.mat_daily_output.updated_at
        END;
    `, [rec.date, pd, mos, fileName]);
    savedCount++;
  }

  return savedCount;
}

async function syncMatExcelToDb(folderPath = MAT_OUTPUT_NETWORK_FOLDER) {
  try {
    const latestFile = findLatestMatExcelFile(folderPath);
    console.log(`[MatExcelSync] Found latest MAT Excel file: ${latestFile.name}`);

    // Strictly Read-Only buffer reading
    const buf = fs.readFileSync(latestFile.fullPath, { flag: 'r' });
    const records = parseMatOutputSheet(buf, latestFile.name);
    const savedCount = await saveMatRecords(records, latestFile.name);

    console.log(`[MatExcelSync] Successfully synced ${savedCount} MAT daily records from ${latestFile.name}`);

    try {
      await poolTest.query(`
        INSERT INTO public.excel_import_history (file_name, record_count, sheet_count, imported_by, details)
        VALUES ($1, $2, $3, $4, $5);
      `, [
        latestFile.name,
        savedCount,
        1,
        'AutoSync',
        `Sync อัตโนมัติจาก Network Folder LINE MAT (${latestFile.name}) รวม ${savedCount} รายการ`
      ]);

      // Auto-clean logs older than 7 days
      await poolTest.query(`
        DELETE FROM public.excel_import_history 
        WHERE imported_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
      `);
    } catch (hErr) {
      console.error(`[MatExcelSync] Error saving history:`, hErr.message);
    }
    return {
      success: true,
      fileName: latestFile.name,
      savedCount,
      recordsCount: records.length
    };
  } catch (err) {
    console.error(`[MatExcelSync] Error syncing MAT Excel:`, err.message);
    throw err;
  }
}

module.exports = {
  MAT_OUTPUT_NETWORK_FOLDER,
  ensureMatOutputTable,
  excelSerialToDate,
  detectYearMonthFromCellE3,
  findLatestMatExcelFile,
  parseMatOutputSheet,
  saveMatRecords,
  syncMatExcelToDb
};