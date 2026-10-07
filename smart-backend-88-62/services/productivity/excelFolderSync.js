const fs = require('fs');
const path = require('path');
const os = require('os');
const xlsx = require('xlsx');
const { pool_test } = require('../../routes/10.17.87.244/config');
const poolTest = pool_test;

const isWindows = os.platform() === 'win32';

const BASE_PATH = isWindows
  ? '\\\\10.17.88.65\\file centers'
  : '/app/file_Folder/OUTPUT_FOLDER';
const NETWORK_FOLDER = process.env.SMT_OUTPUT_FOLDER || 
  path.join(BASE_PATH, 'SMT', '015.SMT Back end', '18.Daily Output monitoring');

const MONTH_MAP = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

const XLSX = xlsx.default || xlsx;
const SSF = XLSX.SSF || xlsx.SSF;

function parseExcelDate(val, dominantYearMonth = '') {
  if (!val) return null;
  const expectedMonth = dominantYearMonth.match(/^\d{4}-(\d{2})$/)?.[1] || '';
  const targetYear = dominantYearMonth.match(/^(\d{4})-/)?.[1] || String(new Date().getFullYear());
  const buddhistYear = String(Number(targetYear) + 543);
  if (typeof val === 'number') {
    const parseFn = SSF?.parse_date_code;
    if (typeof parseFn === 'function') {
      const d = parseFn(val);
      if (d && d.y && d.m && d.d) {
        const parsedYear = String(d.y);
        if (parsedYear !== targetYear && parsedYear !== buddhistYear) return null;
        if (expectedMonth && String(d.m).padStart(2, '0') !== expectedMonth) return null;
        const yStr = targetYear;
        const mStr = String(d.m).padStart(2, '0');
        const dStr = String(d.d).padStart(2, '0');
        return `${yStr}-${mStr}-${dStr}`;
      }
    } else {
      // Fallback for Excel serial date conversion
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        if (expectedMonth && String(date.getUTCMonth() + 1).padStart(2, '0') !== expectedMonth) return null;
        if (String(date.getUTCFullYear()) !== targetYear) return null;
        const yStr = targetYear;
        const mStr = String(date.getUTCMonth() + 1).padStart(2, '0');
        const dStr = String(date.getUTCDate()).padStart(2, '0');
        return `${yStr}-${mStr}-${dStr}`;
      }
    }
  }
  const str = String(val).trim();

  // Match YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    if (ymdMatch[1] !== targetYear && ymdMatch[1] !== buddhistYear) return null;
    if (expectedMonth && ymdMatch[2].padStart(2, '0') !== expectedMonth) return null;
    const yStr = targetYear;
    const mStr = ymdMatch[2].padStart(2, '0');
    const dStr = ymdMatch[3].padStart(2, '0');
    return `${yStr}-${mStr}-${dStr}`;
  }

  // Match day number (1-31) when dominantYearMonth is available
  const dayNum = parseInt(str, 10);
  if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31 && dominantYearMonth && dominantYearMonth.length === 7) {
    const dStr = String(dayNum).padStart(2, '0');
    return `${dominantYearMonth}-${dStr}`;
  }

  return null;
}

function getImportTargetLines(sheetName, rawLine) {
  if (!rawLine) return [];
  const upperSheet = sheetName.trim().toUpperCase().replace(/[-_]/g, ' ');
  const upperLine = rawLine.trim().toUpperCase().replace(/\s+/g, ' ');
  const cleanLine = upperLine.replace(/[^A-Z0-9_\-\(\)\s]/g, '');

  // 0. AIXZ Handling by Sheet
  if (cleanLine.includes('AIXZ') || cleanLine.includes('AIX-Z') || cleanLine.includes('AIX_Z')) {
    if (upperSheet.includes('MOT') || upperSheet.includes('FRONT')) {
      return ['AIX-MOT'];
    }
    if (upperSheet.includes('ASSY') || upperSheet.includes('ASY') || upperSheet.includes('BACK')) {
      return ['AIX-ASY', 'AIX-BLK'];
    }
    return ['AIX-MOT'];
  }

  // 1. Daily Output SMT (Daily output ... OK sheet)
  if (upperSheet.includes('DAILY OUTPUT') || upperSheet.includes('SMT')) {
    if (cleanLine.includes('SMT-FRONT') || cleanLine.includes('SMT FRONT') || cleanLine.includes('SMT_FRONT') || cleanLine.includes('FRONT SMT')) {
      return ['Macro SMT_F'];
    }
    if (cleanLine.includes('SMT OVERALL') || cleanLine.includes('SMT-OVERALL') || cleanLine.includes('SMT_OVERALL') || cleanLine.includes('SMT BACK') || cleanLine.includes('SMT-BACK')) {
      return ['Macro SMT_B'];
    }
  }

  // 2. MOT-Output sheet
  if (cleanLine.includes('STAMP') || cleanLine.includes('ASTP')) {
    if (cleanLine.includes('GEN') || cleanLine.includes('GENERAL') || cleanLine.includes('ASTP-G') || cleanLine.includes('ASTP_G')) {
      return ['ASTP_G'];
    }
    if (cleanLine.includes('AUTO') || cleanLine.includes('AUTOMOTIVE') || cleanLine.includes('ASTP-A') || cleanLine.includes('ASTP_A')) {
      return ['ASTP_A'];
    }
  }

  if (cleanLine.includes('MOT-A') || cleanLine.includes('MOT A') || cleanLine.includes('MOTA')) {
    if (cleanLine.includes('GEN') || cleanLine.includes('GENERAL') || cleanLine.includes('MOTA_G')) {
      return ['MOTA_G'];
    }
    return ['MOTA_A'];
  }

  if (cleanLine.includes('MOT-B') || cleanLine.includes('MOT B') || cleanLine.includes('MOTB')) {
    if (cleanLine.includes('GEN') || cleanLine.includes('GENERAL') || cleanLine.includes('MOTB_G')) {
      return ['MOTB_G'];
    }
    return ['MOTB'];
  }

  if (cleanLine.includes('MOT-C') || cleanLine.includes('MOT C') || cleanLine.includes('MOTC')) {
    return ['MOTC'];
  }

  if (cleanLine.includes('MOT-D') || cleanLine.includes('MOT D') || cleanLine.includes('MOTD')) {
    return ['MOTD'];
  }

  if (cleanLine.includes('MAS')) {
    return ['MAS'];
  }

  if (cleanLine.includes('REW') || cleanLine.includes('REWORK')) {
    return ['REW'];
  }

  if (cleanLine.includes('X-RAY') || cleanLine.includes('XRAY') || cleanLine.includes('X RAY')) {
    return ['XRAY'];
  }

  // 3. ASSY OUTPUT sheet
  if (cleanLine.includes('ASSY 1') || cleanLine.includes('ASY 1') || cleanLine.includes('ASY1')) {
    if (cleanLine.includes('GEN') || cleanLine.includes('GENERAL') || cleanLine.includes('1_G')) {
      return ['ASY1_G'];
    }
    return ['ASY1_A'];
  }

  if (cleanLine.includes('ASSY 2') || cleanLine.includes('ASY 2') || cleanLine.includes('ASY2')) {
    return ['ASY2'];
  }

  if (cleanLine.includes('ASSY 3') || cleanLine.includes('ASY 3') || cleanLine.includes('ASY3')) {
    return ['ASY3'];
  }

  if (cleanLine.includes('ASSY-8') || cleanLine.includes('ASSY 8') || cleanLine.includes('AUTO FEED') || cleanLine.includes('AUTOFEED') || cleanLine.includes('AELT')) {
    return ['AELT'];
  }

  if (cleanLine.includes('MD LAM') || cleanLine.includes('MDLAM') || cleanLine.includes('MD_LAM') || cleanLine.includes('MD-LAM') || cleanLine.includes('LAM MD') || cleanLine.includes('LAM_MD')) {
    return ['MD LAM'];
  }

  if (cleanLine.includes('SMT_LAM') || cleanLine.includes('SMT LAM') || cleanLine === 'LAM') {
    return ['SMT_LAM'];
  }

  if (cleanLine.includes('BLK')) {
    return ['BLK-2'];
  }

  return [rawLine.trim()];
}

async function syncExcelFolderToDb(currentMonthOnly = true) {
  console.log(`[ExcelFolderSync] Starting sync from Network Folder: ${NETWORK_FOLDER}...`);

  if (!fs.existsSync(NETWORK_FOLDER)) {
    console.warn(`[ExcelFolderSync] Folder path not accessible: ${NETWORK_FOLDER}`);
    return { success: false, error: `Folder path not accessible: ${NETWORK_FOLDER}` };
  }

  const currentYear = String(new Date().getFullYear());
  const searchLocations = [{ directory: NETWORK_FOLDER, sourceYear: currentYear }];

  // After the year is closed, current-year workbooks may be moved into a
  // folder named by year. Do not scan historical year folders.
  const currentYearFolder = path.join(NETWORK_FOLDER, currentYear);
  if (fs.existsSync(currentYearFolder) && fs.statSync(currentYearFolder).isDirectory()) {
    searchLocations.push({
      directory: currentYearFolder,
      sourceYear: currentYear,
    });
  }

  const files = searchLocations.flatMap(({ directory, sourceYear }) =>
    fs.readdirSync(directory, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.toLowerCase().includes('smt daily output monitoring') && entry.name.toLowerCase().endsWith('.xlsx'))
      .map(entry => ({
        fileName: entry.name,
        filePath: path.join(directory, entry.name),
        sourceYear,
      }))
  );

  // Sort chronologically by month (01 -> 12) so the latest month has the newest timestamp
  files.sort((a, b) => {
    const aPrefix = a.fileName.split('-')[0].toLowerCase().trim();
    const bPrefix = b.fileName.split('-')[0].toLowerCase().trim();
    const aM = MONTH_MAP[aPrefix] || '00';
    const bM = MONTH_MAP[bPrefix] || '00';
    return aM.localeCompare(bM);
  });

  if (files.length === 0) {
    console.log('[ExcelFolderSync] No matching Excel files found.');
    return { success: true, count: 0, filesCount: 0 };
  }

  // Filter to current month only if requested (default true)
  let filesToProcess = files;
  if (currentMonthOnly) {
    const now = new Date();
    const currentMonthNum = String(now.getMonth() + 1).padStart(2, '0');
    const matchedFiles = files.filter(f => {
      const prefix = f.fileName.split('-')[0].toLowerCase().trim();
      return MONTH_MAP[prefix] === currentMonthNum;
    });
    filesToProcess = matchedFiles.length > 0 ? matchedFiles : (files.length > 0 ? [files[files.length - 1]] : []);
    console.log(`[ExcelFolderSync] Filtered for current month (${currentMonthNum}): processing ${filesToProcess.map(f => f.fileName).join(', ')}`);
  }

  let totalSaved = 0;
  const syncDetails = [];

  // Ensure target DB table exists
  await poolTest.query(`
    CREATE TABLE IF NOT EXISTS public.smt_daily_actual_plan (
        id SERIAL PRIMARY KEY,
        line VARCHAR(100) NOT NULL,
        date DATE NOT NULL,
        daily_plan NUMERIC(15, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_line_date UNIQUE (line, date)
    );
  `);

  // Ensure history table exists
  await poolTest.query(`
    CREATE TABLE IF NOT EXISTS public.excel_import_history (
        id SERIAL PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        record_count INT DEFAULT 0,
        sheet_count INT DEFAULT 0,
        imported_by VARCHAR(100) DEFAULT 'AutoSync',
        imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'SUCCESS',
        details TEXT
    );
  `);

  for (const file of filesToProcess) {
    const { fileName, filePath, sourceYear } = file;
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

      // Detect Month from file name e.g. "JUL-P1_SMT Daily Output monitoring.xlsx" -> "2026-07"
      const filePrefix = fileName.split('-')[0].toLowerCase().trim();
      const monthStr = MONTH_MAP[filePrefix] || '07';
      const fileYearMonth = `${sourceYear}-${monthStr}`;

      const recordsToInsert = [];
      let parsedSheetsCount = 0;

      workbook.SheetNames.forEach(sheetName => {
        const sheetLower = sheetName.toLowerCase();
        if (!sheetLower.includes('daily output') && !sheetLower.includes('assy output') && !sheetLower.includes('mot-output')) {
          return;
        }
        parsedSheetsCount++;

        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        let lastSeenLineName = '';

        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || !Array.isArray(row)) continue;

          for (let j = 0; j < Math.min(row.length, 5); j++) {
            const cellText = String(row[j] || '').trim();
            if (!cellText) continue;
            const textLower = cellText.toLowerCase();

            const isLineKeyword =
              textLower.includes('line') || textLower.includes('mot') || textLower.includes('astp') ||
              textLower.includes('stamp') || textLower.includes('assy') || textLower.includes('asy') ||
              textLower.includes('xray') || textLower.includes('x-ray') || textLower.includes('mas') ||
              textLower.includes('rew') || textLower.includes('aelt') || textLower.includes('oqi') ||
              textLower.includes('smt') || textLower.includes('fpc') || textLower.includes('hps') ||
              textLower.includes('blk') || textLower.includes('vac') || textLower.includes('lam') ||
              textLower.includes('mat') || textLower.includes('feed');

            const isNonLineKeyword =
              textLower.includes('daily master') || textLower.includes('daily actual') ||
              textLower.includes('master pln') || textLower.includes('actual plan') ||
              textLower.includes('working') || textLower.includes('holiday') ||
              textLower.includes('kpr') || textLower.includes('acc') || textLower.includes('balance');

            if (isLineKeyword && !isNonLineKeyword) {
              lastSeenLineName = cellText;
              break;
            }
          }

          const rowContentStr = row.slice(0, 5).map(v => String(v || '')).join(' ').toLowerCase();
          const isTargetRow =
            (rowContentStr.includes('daily actual plan') ||
             rowContentStr.includes('daily actual pln') ||
             rowContentStr.includes('daily plan') ||
             rowContentStr.includes('actual plan') ||
             rowContentStr.includes('daily master')) &&
            !rowContentStr.includes('acc') &&
            !rowContentStr.includes('kpr') &&
            !rowContentStr.includes('balance');

          if (isTargetRow) {
            const firstCell = String(row[0] || '').trim();
            const firstCellLower = firstCell.toLowerCase();
            const isGenericRowHeader = firstCellLower.includes('daily actual') || firstCellLower.includes('daily master') || firstCellLower.includes('daily pln');
            const rawLine = (!isGenericRowHeader && firstCell) ? firstCell : (lastSeenLineName || firstCell || 'SMT');
            const targetLines = getImportTargetLines(sheetName, rawLine);

            for (let k = i - 1; k >= 0; k--) {
              const headerRow = rawRows[k];
              if (!headerRow || !Array.isArray(headerRow)) continue;

              let rowAddedCount = 0;
              headerRow.forEach((cellVal, colIdx) => {
                const dateStr = parseExcelDate(cellVal, fileYearMonth);
                if (dateStr && colIdx < row.length) {
                  const planVal = parseFloat(row[colIdx]);
                  if (!isNaN(planVal) && planVal >= 0) {
                    const roundedPlan = Math.round(planVal);
                    for (const tLine of targetLines) {
                      recordsToInsert.push({
                        line: tLine,
                        date: dateStr,
                        daily_plan: roundedPlan
                      });
                    }
                    rowAddedCount++;
                  }
                }
              });

              if (rowAddedCount > 0) break;
            }
          }
        }
      });

      // Batch Upsert into Postgres DB
      if (recordsToInsert.length > 0) {
        for (const r of recordsToInsert) {
          await poolTest.query(`
            INSERT INTO public.smt_daily_actual_plan (line, date, daily_plan, updated_at)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (line, date)
            DO UPDATE SET daily_plan = EXCLUDED.daily_plan,
                          updated_at = CURRENT_TIMESTAMP;
          `, [r.line, r.date, r.daily_plan]);
        }

        totalSaved += recordsToInsert.length;
        syncDetails.push(`${fileName}: saved ${recordsToInsert.length} records`);

        // Record history for this file with its real file name
        try {
          await poolTest.query(`
            INSERT INTO public.excel_import_history (file_name, record_count, sheet_count, imported_by, details)
            VALUES ($1, $2, $3, $4, $5);
          `, [
            fileName,
            recordsToInsert.length,
            parsedSheetsCount || 1,
            'AutoSync',
            `Sync อัตโนมัติจาก Network Folder SMT (${fileName}) รวม ${recordsToInsert.length} รายการ`
          ]);

          // Auto-clean logs older than 7 days
          await poolTest.query(`
            DELETE FROM public.excel_import_history 
            WHERE imported_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
          `);
        } catch (hErr) {
          console.error(`[ExcelFolderSync] Error saving history for ${fileName}:`, hErr);
        }
      }
    } catch (err) {
      console.error(`[ExcelFolderSync] Error processing ${fileName}:`, err);
    }
  }

  console.log(`[ExcelFolderSync] Completed folder sync. Total records updated: ${totalSaved}`);
  return { success: true, count: totalSaved, filesCount: filesToProcess.length, details: syncDetails };
}

function getMsUntilNext9AM() {
  const now = new Date();
  const thaiParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    hour12: false,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  }).formatToParts(now);

  const p = {};
  thaiParts.forEach(({ type, value }) => { p[type] = parseInt(value, 10); });

  const currentThaiMs = (p.hour * 3600 + p.minute * 60 + p.second) * 1000;
  const target9AMMs = 9 * 3600 * 1000;

  let diffMs = target9AMMs - currentThaiMs;
  if (diffMs <= 0) {
    diffMs += 24 * 3600 * 1000;
  }
  return diffMs;
}

// Auto-run Scheduler: Sync once daily at 09:00 AM
function initExcelFolderScheduler() {
  console.log('[ExcelFolderSync] Initializing Auto-Sync Scheduler (Daily at 09:00 AM)...');

  const scheduleNextSync = () => {
    const delay = getMsUntilNext9AM();
    const nextRunDate = new Date(Date.now() + delay);
    console.log(`[ExcelFolderSync] Next scheduled sync set for 09:00 AM: ${nextRunDate.toLocaleString('th-TH')}`);

    setTimeout(async () => {
      console.log('[ExcelFolderSync] Executing scheduled daily sync at 09:00 AM...');
      try {
        await syncExcelFolderToDb();
      } catch (err) {
        console.error('[ExcelFolderSync 09:00 AM Sync Error]:', err);
      }
      scheduleNextSync(); // Schedule next day 09:00 AM sync
    }, delay);
  };

  scheduleNextSync();
}

module.exports = {
  syncExcelFolderToDb,
  initExcelFolderScheduler
};
