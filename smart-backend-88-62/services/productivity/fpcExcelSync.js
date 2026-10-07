const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { pool_test } = require('../../routes/10.17.87.244/config');
const poolTest = pool_test;
const { FPC_PLAN_NETWORK_FOLDER, FPC_PLAN_LOCAL_FOLDER, FPC_TARGET_SPECS } = require('./fpcPlanMapping');

const XLSX = xlsx.default || xlsx;
const SSF = XLSX.SSF || xlsx.SSF;

const MONTH_MAP = {
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

/**
 * ดึง ปี-เดือน (YYYY-MM) จากชื่อไฟล์ เช่น '8.PLP_Aug 2026...', '9.PLP_Sep 2026...'
 */
function detectYearMonthFromFileName(fileName, sourceYear = '') {
  const fnLower = (fileName || '').toLowerCase();
  let detectedMonth = '';
  let detectedYear = sourceYear || String(new Date().getFullYear());

  // 1. ตรวจจับจากชื่อเดือนภาษาอังกฤษ
  for (const [mName, mNum] of Object.entries(MONTH_MAP)) {
    if (fnLower.includes(mName)) {
      detectedMonth = mNum;
      break;
    }
  }

  // 2. ถ้าไม่พบ ให้ตรวจจับจากตัวเลขนำหน้าไฟล์ เช่น '8.PLP...' -> '08', '9.PLP...' -> '09'
  if (!detectedMonth) {
    const numPrefixMatch = fileName.match(/^(\d{1,2})\./);
    if (numPrefixMatch) {
      const num = parseInt(numPrefixMatch[1], 10);
      if (num >= 1 && num <= 12) {
        detectedMonth = String(num).padStart(2, '0');
      }
    }
  }

  if (!detectedMonth) {
    detectedMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  }

// 3. ตรวจจับปี ค.ศ. 4 หลัก (20xx)
  const yearMatch = fileName.match(/20\d{2}/);
  if (yearMatch) {
    detectedYear = yearMatch[0];
  } else {
    // ตรวจจับปี พ.ศ. 4 หลัก (25xx) เช่น 2569 -> 2026
    const beMatch = fileName.match(/25\d{2}/);
    if (beMatch) {
      detectedYear = String(parseInt(beMatch[0], 10) - 543);
    } else if (sourceYear) {
      let sy = parseInt(sourceYear, 10);
      if (sy > 2500) sy = sy - 543;
      detectedYear = String(sy);
    } else {
      detectedYear = String(new Date().getFullYear());
    }
  }

  return `${detectedYear}-${detectedMonth}`;
}

/**
 * แปลงค่าวันที่ในเซลล์ Excel (Serial Number หรือ Text) เป็น 'YYYY-MM-DD'
 */
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

  // Match 'YYYY-MM-DD' หรือ 'YYYY/MM/DD'
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    if (ymdMatch[1] !== targetYear && ymdMatch[1] !== buddhistYear) return null;
    if (expectedMonth && ymdMatch[2].padStart(2, '0') !== expectedMonth) return null;
    const yStr = targetYear;
    const mStr = ymdMatch[2].padStart(2, '0');
    const dStr = ymdMatch[3].padStart(2, '0');
    return `${yStr}-${mStr}-${dStr}`;
  }

  // Match 'DD-MMM' เช่น '1-Aug', '02-AUG', '1-Sep'
  const dMmmMatch = str.match(/^(\d{1,2})-[A-Za-z]{3}$/i);
  if (dMmmMatch && dominantYearMonth) {
    const day = dMmmMatch[1].padStart(2, '0');
    return `${dominantYearMonth}-${day}`;
  }

  // Match day number (1-31) เมื่อมี dominantYearMonth
  const dayNum = parseInt(str, 10);
  if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31 && dominantYearMonth && dominantYearMonth.length === 7) {
    const dStr = String(dayNum).padStart(2, '0');
    return `${dominantYearMonth}-${dStr}`;
  }

  return null;
}

/**
 * สร้างตาราง Database สำหรับ FPC Plan (public.fpc_daily_actual_plan)
 */
async function ensureFpcPlanTable() {
  await poolTest.query(`
    CREATE TABLE IF NOT EXISTS public.fpc_daily_actual_plan (
        id SERIAL PRIMARY KEY,
        line VARCHAR(100) NOT NULL,
        date DATE NOT NULL,
        piece_plan NUMERIC(15, 2) DEFAULT 0,
        sht_plan NUMERIC(15, 2) DEFAULT 0,
        lot_plan NUMERIC(15, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_fpc_line_date UNIQUE (line, date)
    );
  `);
}

/**
 * บันทึกประวัติการนำเข้าลงตาราง public.excel_import_history
 */
async function logExcelImportHistory({ fileName, recordCount, sheetCount = 1, importedBy = 'AutoSync', status = 'SUCCESS', details = '' }) {
  try {
    await poolTest.query(`
      CREATE TABLE IF NOT EXISTS public.excel_import_history (
          id SERIAL PRIMARY KEY,
          file_name VARCHAR(255) NOT NULL,
          record_count INT DEFAULT 0,
          sheet_count INT DEFAULT 1,
          imported_by VARCHAR(100) DEFAULT 'AutoSync',
          imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(50) DEFAULT 'SUCCESS',
          details TEXT
      );
    `);

    await poolTest.query(`
      INSERT INTO public.excel_import_history 
      (file_name, record_count, sheet_count, imported_by, status, details, imported_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP);
    `, [fileName, recordCount, sheetCount, importedBy, status, details]);

    // Auto-clean logs older than 7 days
    await pool_test.query(`
      DELETE FROM public.excel_import_history 
      WHERE imported_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
    `);
  } catch (err) {
    console.error('[FpcExcelSync] Failed to log import history:', err.message);
  }
}

/**
 * สั่งคำนวณสรุปยอด Productivity (Period Summary) ใน Background
 */
function triggerPeriodSummaryRollup(records = []) {
  if (!records || records.length === 0) return;
  const dates = records.map(r => r.date).filter(Boolean);
  if (dates.length === 0) return;
  dates.sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  try {
    const { syncPeriodSummaryRange } = require('./periodSummaryService');
    if (typeof syncPeriodSummaryRange === 'function') {
      syncPeriodSummaryRange(minDate, maxDate).catch(e => {
        console.error('[FpcExcelSync] Background period summary rollup error:', e.message);
      });
    }
  } catch (err) {
    console.warn('[FpcExcelSync] Could not require periodSummaryService:', err.message);
  }
  try {
    const { syncProductivityPeriodSummary } = require('./periodSummaryService');
    if (typeof syncProductivityPeriodSummary === 'function') {
      syncProductivityPeriodSummary(minDate, maxDate).catch(e => {
        console.error('[FpcExcelSync] Background period summary rollup error:', e.message);
      });
    }
  } catch (err) {
    console.warn('[FpcExcelSync] Could not require periodSummaryService:', err.message);
  }
}

/**
 * แกะข้อมูล Workbook ของ FPC (EFPC) ครบทั้ง 16 รายการหลัก
 */
/**
 * ค้นหาแถว Plan LOT สำหรับ LINE BLK (รวม BLK + PIC) และ LINE OST (รวม OST_B + OST_C + OST_D) ด้วยระบบ Dynamic Label & Section Search 100%
 * ไม่พึ่งพาเลขแถว (Row index) ตายตัว รองรับทั้ง Layout ใหม่ (May-Dec) และ Layout เก่า (Jan-Apr)
 */
function findEfpcLotRows(rows) {
  let ostBIdx = -1;
  let ostCIdx = -1;
  let ostDIdx = -1;
  let picIdx = -1;
  let blkIdx = -1;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row)) continue;
    const text = row.slice(0, 6).map(c => String(c || '').trim().toLowerCase()).join(' ');
    const isOutputMon = text.includes('output monitoring');

    // 1. OST B: OUTPUT MONITORING EFPC_ LINE-OST_B
    if (ostBIdx === -1 && (text.includes('line-ost_b') || (isOutputMon && text.includes('ost') && text.includes(' b')))) {
      for (let sub = r; sub < Math.min(rows.length, r + 15); sub++) {
        const sRow = rows[sub];
        if (!sRow || !Array.isArray(sRow)) continue;
        const sText = sRow.slice(0, 6).map(c => String(c || '').trim().toLowerCase()).join(' ');
        if (sText.includes('plan') && sText.includes('lot') && !sText.includes('acc') && !sText.includes('b/l') && !sText.includes('diff') && !sText.includes('variance') && !sText.includes('/a') && !sText.includes('/b')) {
          ostBIdx = sub;
          break;
        }
      }
    }

    // 2. OST C: OUTPUT MONITORING EFPC_ LINE-OST_C
    if (ostCIdx === -1 && (text.includes('line-ost_c') || (isOutputMon && text.includes('ost') && text.includes(' c')))) {
      if (!text.includes('ost | d') && !text.includes('ost_d') && !text.includes(' d ')) {
        for (let sub = r; sub < Math.min(rows.length, r + 15); sub++) {
          const sRow = rows[sub];
          if (!sRow || !Array.isArray(sRow)) continue;
          const sText = sRow.slice(0, 6).map(c => String(c || '').trim().toLowerCase()).join(' ');
          if (sText.includes('plan') && sText.includes('lot') && !sText.includes('acc') && !sText.includes('b/l') && !sText.includes('diff') && !sText.includes('variance') && !sText.includes('/a') && !sText.includes('/b')) {
            ostCIdx = sub;
            break;
          }
        }
      }
    }

    // 3. OST D: OUTPUT MONITORING EFPC_ LINE-OST_D (หรือแถว OST | D)
    if (ostDIdx === -1 && (text.includes('line-ost_d') || (isOutputMon && text.includes('ost') && (text.includes(' d') || text.includes('ost | d'))))) {
      for (let sub = r; sub < Math.min(rows.length, r + 15); sub++) {
        const sRow = rows[sub];
        if (!sRow || !Array.isArray(sRow)) continue;
        const sText = sRow.slice(0, 6).map(c => String(c || '').trim().toLowerCase()).join(' ');
        if (sText.includes('plan') && sText.includes('lot') && !sText.includes('acc') && !sText.includes('b/l') && !sText.includes('diff') && !sText.includes('variance') && !sText.includes('/a') && !sText.includes('/b')) {
          ostDIdx = sub;
          break;
        }
      }
    }

    // 4. PIC Process (ส่วนหนึ่งของ LINE BLK)
    if (picIdx === -1 && (text.includes('output monitoring efpc_ pic process') || text.includes('overall pic') || text.includes('pic process'))) {
      for (let sub = r; sub < Math.min(rows.length, r + 25); sub++) {
        const sRow = rows[sub];
        if (!sRow || !Array.isArray(sRow)) continue;
        const sText = sRow.slice(0, 6).map(c => String(c || '').trim().toLowerCase()).join(' ');
        if (sText.includes('lot') && sText.includes('plan') && sText.includes('pic') && !sText.includes('acc') && !sText.includes('b/l') && !sText.includes('variance') && !sText.includes('diff') && !sText.includes('wip') && !sText.includes('tf2') && !sText.includes('vac') && !sText.includes('output/')) {
          picIdx = sub;
          break;
        }
      }
    }

    // 5. BLK Process (ส่วนหนึ่งของ LINE BLK)
    if (blkIdx === -1 && (text.includes('output monitoring efpc_ blk') || text.includes('overall blk') || text.includes('blk process'))) {
      for (let sub = r; sub < Math.min(rows.length, r + 25); sub++) {
        const sRow = rows[sub];
        if (!sRow || !Array.isArray(sRow)) continue;
        const sText = sRow.slice(0, 6).map(c => String(c || '').trim().toLowerCase()).join(' ');
        if (sText.includes('lot') && sText.includes('plan') && sText.includes('blk') && !sText.includes('acc') && !sText.includes('b/l') && !sText.includes('variance') && !sText.includes('diff') && !sText.includes('wip') && !sText.includes('tf2') && !sText.includes('vac') && !sText.includes('output/')) {
          blkIdx = sub;
          break;
        }
      }
    }
  }

  // Fallback สำหรับฟอร์แมตช่วงเดือน Jan - Apr
  let ostRows = [ostBIdx, ostCIdx, ostDIdx].filter(x => x !== -1).map(x => x + 1);
  if (ostRows.length === 0) {
    for (let r = 0; r < Math.min(rows.length, 300); r++) {
      const row = rows[r];
      if (!row || !Array.isArray(row)) continue;
      const text = row.slice(0, 6).map(c => String(c || '').trim().toLowerCase()).join(' ');
      if (text.includes('total plan ost (lot') || text.includes('total  plan ost (lot')) {
        ostRows = [r + 1];
        break;
      }
    }
  }

  let blkRows = [...(blkIdx !== -1 ? [blkIdx + 1] : []), ...(picIdx !== -1 ? [picIdx + 1] : [])];
  if (blkRows.length === 0) {
    for (let r = 0; r < Math.min(rows.length, 300); r++) {
      const row = rows[r];
      if (!row || !Array.isArray(row)) continue;
      const text = row.slice(0, 6).map(c => String(c || '').trim().toLowerCase()).join(' ');
      if (text.includes('total plan blk (lot') || text.includes('total  plan blk (lot')) {
        blkRows = [r + 1];
        break;
      }
    }
  }

  return { ostRows, blkRows };
}

/**
 * ดึงยอด Plan LOT เพิ่มเติมจาก Sheet LINE A (ถ้ามี)
 * - Total plan OST (lots) สำหรับ LINE OST
 * - Total plan PIC & BLK (lots) สำหรับ LINE BLK
 */
function extractLineAAdditionalPlan(workbook, fileYearMonth) {
  const lineASheetName = workbook.SheetNames.find(s => {
    const u = (s || '').trim().toUpperCase();
    return u === 'LINE A' || u === 'LINE_A' || u === 'LINEA';
  });
  if (!lineASheetName) return { ostMap: {}, blkMap: {} };

  const sheet = workbook.Sheets[lineASheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  const dateColMap = {};
  for (let r = 0; r < Math.min(120, rows.length); r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row)) continue;
    let found = 0;
    const temp = {};
    row.forEach((c, idx) => {
      const d = parseExcelDate(c, fileYearMonth);
      if (d && d.startsWith(fileYearMonth)) {
        temp[idx] = d;
        found++;
      }
    });
    if (found >= 10) {
      Object.assign(dateColMap, temp);
      break;
    }
  }

  let ostRowIdx = -1;
  let blkRowIdx = -1;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row)) continue;
    const text = row.slice(0, 5).map(c => String(c || '').trim().toLowerCase()).join(' ');
    if (ostRowIdx === -1 && (text.includes('total plan ost (lots)') || text.includes('total  plan ost (lots)'))) {
      ostRowIdx = r;
    }
    if (blkRowIdx === -1 && (text.includes('total plan pic & blk (lots)') || text.includes('total  plan pic & blk (lots)'))) {
      blkRowIdx = r;
    }
  }

  const ostMap = {};
  const blkMap = {};
  Object.entries(dateColMap).forEach(([idx, dStr]) => {
    if (ostRowIdx !== -1 && rows[ostRowIdx]) {
      const v = parseFloat(String(rows[ostRowIdx][idx] || '').replace(/,/g, ''));
      if (!isNaN(v) && v > 0) ostMap[dStr] = v;
    }
    if (blkRowIdx !== -1 && rows[blkRowIdx]) {
      const v = parseFloat(String(rows[blkRowIdx][idx] || '').replace(/,/g, ''));
      if (!isNaN(v) && v > 0) blkMap[dStr] = v;
    }
  });

  return { ostMap, blkMap };
}

/**
 * ค้นหาแถว Plan (pcs, sht, lot) ภายใต้ Section ของ Line นั้นๆ แบบ Dynamic Anchor Matching 100%
 * ไม่พึ่งพาเลขแถว (Row index) และป้องกันไม่ให้เลื่อนไปหยิบแถว Diff / Actual / Acc / SMT / Sub-shift
 */
function resolveDynamicPlanRows(rows, spec) {
  let resolvedPcsRow = null;
  let resolvedShtRow = null;
  let resolvedLotRows = null;

  if (!rows || rows.length === 0) {
    return { resolvedPcsRow, resolvedShtRow, resolvedLotRows };
  }

  // 1. ค้นหาตำแหน่งบรรทัด Section Header (Anchor) พร้อมตรวจสอบ Exclusions
  const keywords = spec.sectionKeywords || (spec.label ? [spec.label] : []);
  const exclusions = spec.sectionExclusions || ['line a/b', 'a/b/c/d', 'line a/b/c/d'];
  let sectionRowIdx = -1;

  if (keywords.length > 0) {
    for (let r = 0; r < Math.min(rows.length, 1250); r++) {
      const row = rows[r];
      if (!row || !Array.isArray(row)) continue;
      const rowText = row.slice(0, 8).map(c => String(c || '').trim().toLowerCase()).join(' ').replace(/\s+/g, ' ');

      // ข้ามแถวที่ติดคำต้องห้าม (เช่น Line A/B/C/D)
      if (exclusions.some(ex => rowText.includes(ex.toLowerCase()))) {
        continue;
      }

      const matched = keywords.some(kw => rowText.includes(kw.toLowerCase()));
      if (matched) {
        if (sectionRowIdx === -1 || rowText.includes('output monitoring') || rowText.includes('overview') || rowText.includes('total output')) {
          sectionRowIdx = r;
          if (rowText.includes('output monitoring') || rowText.includes('overview')) break;
        }
      }
    }
  }

  if (sectionRowIdx === -1) {
    return { resolvedPcsRow: null, resolvedShtRow: null, resolvedLotRows: null };
  }

  // 2. ถ้าเจอ Section Header ให้ค้นหาแถว Plan ภายใน 75 แถวถัดมาโดยใช้ Pattern Matching
  const searchStart = sectionRowIdx;
  const searchEnd = Math.min(rows.length, sectionRowIdx + 75);

  let bestPcsRow = null;
  let bestPcsScore = -1;
  let bestShtRow = null;
  let bestShtScore = -1;
  let bestLotRow = null;

  for (let r = searchStart; r < searchEnd; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row)) continue;
    const labelText = row.slice(0, 8).map(c => String(c || '').trim().toLowerCase()).join(' ').replace(/\s+/g, ' ');

    const hasExclusion = labelText.includes('diff') ||
                         labelText.includes('variance') ||
                         (labelText.includes('actual') && !labelText.includes('actual plan')) ||
                         labelText.includes('acc') ||
                         labelText.includes('accumulated') ||
                         labelText.includes('balance') ||
                         labelText.includes('remain') ||
                         labelText.includes('wip') ||
                         labelText.includes('forcast') ||
                         labelText.includes('forecast') ||
                         labelText.includes('smt') || // ข้าม SMT Sub-process
                         labelText.includes('/a') || // ข้ามกะย่อย /A
                         labelText.includes('/b') || // ข้ามกะย่อย /B
                         labelText.includes('amt') ||
                         labelText.includes('baht') ||
                         labelText.includes('bath') ||
                         labelText.includes('เงิน') ||
                         labelText.includes('target refer') ||
                         labelText.includes('refer master');

    if (hasExclusion) continue;

    // ถ้าเป็น Overall / Macro ให้ข้ามแถวเฉพาะของ Line A/B/C/D หรือ Front/Sub-line
    if ((spec.line === 'Direct FPC' || spec.line === 'Macro FPC') && (labelText.includes('line a/b/c/d') || labelText.includes('line a/b') || labelText.includes('plan front') || labelText.includes('output/a') || labelText.includes('output/b'))) {
      continue;
    }

    const isPcs = labelText.includes('pcs') || labelText.includes('pc') || labelText.includes('ชิ้น');
    const isSht = labelText.includes('sht') || labelText.includes('sheet') || labelText.includes('แผ่น');
    const isLot = labelText.includes('lot');

    // คะแนนความแม่นยำของแถว Plan Pcs
    if (isPcs && !isSht && !isLot) {
      let score = 0;
      if (spec.id === 16) {
        // MDS
        if (labelText.includes('daily plan (actual plan)_pcs')) score = 100;
        else if (labelText.includes('daily master plan (pcs)')) score = 80;
      } else if (spec.id === 4) {
        // AT_VAC
        if (labelText.includes('plan (pcs)') || labelText.includes('plan(pcs)')) score = 100;
      } else {
        if (labelText.includes('daily act plan_pcs') || labelText.includes('plan output (pcs)') || labelText.includes('act plan_pcs')) score = 100;
        else if (labelText.includes('act plan') || labelText.includes('plan output')) score = 80;
        else if (labelText.includes('plan') && !labelText.includes('master plan')) score = 60;
      }

      if (score > bestPcsScore) {
        bestPcsScore = score;
        bestPcsRow = r + 1;
      }
    }

    // คะแนนความแม่นยำของแถว Plan Sht
    if (isSht && !isLot) {
      let score = 0;
      if (labelText.includes('plan output (sht)') || labelText.includes('plan output (sheet)') || labelText.includes('fin_total plan (sht)') || labelText.includes('total plan (sht)')) score = 100;
      else if (labelText.includes('plan output')) score = 80;
      else if (labelText.includes('plan') && !labelText.includes('master plan') && !labelText.includes('target')) score = 60;

      if (score > bestShtScore) {
        bestShtScore = score;
        bestShtRow = r + 1;
      }
    }

    // ตรวจจับแถว Plan Lot
    if (isLot && !isPcs && !isSht) {
      if (labelText.includes('plan final (lots)') || labelText.includes('actual plan') || labelText.includes('plan output (lot)')) {
        if (!bestLotRow) bestLotRow = r + 1;
      }
    }
  }

  let finalShtRow = bestShtRow;
  if (finalShtRow && rows[finalShtRow - 1]) {
    const fallbackText = rows[finalShtRow - 1].slice(0, 8).map(c => String(c || '').trim().toLowerCase()).join(' ');
    if (fallbackText.includes('amt') || fallbackText.includes('baht')) {
      finalShtRow = null;
    }
  }

  return {
    resolvedPcsRow: bestPcsRow,
    resolvedShtRow: finalShtRow,
    resolvedLotRows: bestLotRow ? [bestLotRow] : null
  };
}

/**
 * แกะข้อมูล Workbook ของ FPC (EFPC) ครบทั้ง 16 รายการหลัก ด้วยระบบ Dynamic Anchor Search 100%
 */
function parseFpcPlanWorkbook(fileBuffer, fileName = '', sourceYear = '') {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const fileYearMonth = detectYearMonthFromFileName(fileName, sourceYear);
  const records = [];

  FPC_TARGET_SPECS.forEach(spec => {
    const matchingSheetName = workbook.SheetNames.find(s => spec.sheetMatcher(s));
    if (!matchingSheetName) return;

    const sheet = workbook.Sheets[matchingSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // ค้นหาแถว Date Columns ในชีทนี้ (สแกน 120 แถวแรกเพื่อรองรับชีทที่วันที่อยู่ลึกลงไป)
    const dateColMap = {}; // colIdx -> 'YYYY-MM-DD'
    for (let r = 0; r < Math.min(120, rows.length); r++) {
      const row = rows[r];
      if (!row || !Array.isArray(row)) continue;
      let foundDates = 0;
      const tempMap = {};
      row.forEach((cellVal, colIdx) => {
        const dStr = parseExcelDate(cellVal, fileYearMonth);
        if (dStr && dStr.startsWith(fileYearMonth)) {
          tempMap[colIdx] = dStr;
          foundDates++;
        }
      });
      if (foundDates >= 10) {
        Object.assign(dateColMap, tempMap);
        break;
      }
    }

    const dates = Object.values(dateColMap).sort();

    // สำหรับ LINE BLK และ LINE OST ใช้ 100% Dynamic Label & Section Matcher
    let specialLotRows = null;
    if (spec.line === 'LINE BLK' || spec.line === 'LINE OST') {
      const lotInfo = findEfpcLotRows(rows);
      specialLotRows = spec.line === 'LINE BLK' ? lotInfo.blkRows : lotInfo.ostRows;
    }

    // ค้นหาแถว Plan แบบ Dynamic สำหรับแต่ละ Spec
    const { resolvedPcsRow, resolvedShtRow, resolvedLotRows } = resolveDynamicPlanRows(rows, spec);
    const effectiveLotRows = specialLotRows !== null ? specialLotRows : resolvedLotRows;

    dates.forEach(dStr => {
      const colIdx = Object.keys(dateColMap).find(c => dateColMap[c] === dStr);
      if (colIdx === undefined) return;

      let piecePlan = 0;
      let shtPlan = 0;
      let lotPlan = 0;

      if (spec.line === 'LINE BLK' || spec.line === 'LINE OST') {
        // LINE BLK: รวมเฉพาะ Actual Plan BLK (LOT) + Actual Plan PIC (LOT) จาก E-FPC Output
        // LINE OST: รวมเฉพาะ Actual Plan OST (LOT) จาก E-FPC Output
        if (effectiveLotRows && effectiveLotRows.length > 0) {
          effectiveLotRows.forEach(lr => {
            const r = rows[lr - 1];
            if (r && r[colIdx] !== null && r[colIdx] !== undefined) {
              const val = parseFloat(String(r[colIdx]).replace(/,/g, ''));
              if (!isNaN(val)) lotPlan += Math.max(0, val);
            }
          });
        }
        lotPlan = Math.max(0, Math.round(lotPlan * 10) / 10);
      } else {
        if (resolvedPcsRow) {
          const r = rows[resolvedPcsRow - 1];
          if (r && r[colIdx] !== null && r[colIdx] !== undefined) {
            const val = parseFloat(String(r[colIdx]).replace(/,/g, ''));
            if (!isNaN(val)) piecePlan = Math.max(0, Math.round(val));
          }
        }

        if (resolvedShtRow) {
          const r = rows[resolvedShtRow - 1];
          if (r && r[colIdx] !== null && r[colIdx] !== undefined) {
            const val = parseFloat(String(r[colIdx]).replace(/,/g, ''));
            if (!isNaN(val)) shtPlan = Math.max(0, Math.round(val));
          }
        }

        if (effectiveLotRows && effectiveLotRows.length > 0) {
          effectiveLotRows.forEach(lr => {
            const r = rows[lr - 1];
            if (r && r[colIdx] !== null && r[colIdx] !== undefined) {
              const val = parseFloat(String(r[colIdx]).replace(/,/g, ''));
              if (!isNaN(val)) lotPlan += Math.max(0, val);
            }
          });
          lotPlan = Math.max(0, Math.round(lotPlan * 100) / 100);
        }
      }

      records.push({
        line: spec.line,
        date: dStr,
        piece_plan: piecePlan,
        sht_plan: shtPlan,
        lot_plan: lotPlan,
      });
    });
  });

  return { records, fileYearMonth, sheetCount: workbook.SheetNames.length };
}

/**
 * บันทึกข้อมูล FPC Plan ลง Database (public.fpc_daily_actual_plan)
 */
async function saveFpcPlanRecords(records, fileName = 'fpc_plan.xlsx', importedBy = 'AutoSync', skipHistoryLog = false, sheetCount = 0) {
  if (!records || records.length === 0) return 0;
  await ensureFpcPlanTable();

  let savedCount = 0;
  for (const r of records) {
    if (!r.line || !r.date) continue;
    await poolTest.query(`
      INSERT INTO public.fpc_daily_actual_plan (line, date, piece_plan, sht_plan, lot_plan, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (line, date)
      DO UPDATE SET piece_plan = EXCLUDED.piece_plan,
                    sht_plan = EXCLUDED.sht_plan,
                    lot_plan = EXCLUDED.lot_plan,
                    updated_at = CURRENT_TIMESTAMP;
    `, [r.line, r.date, r.piece_plan || 0, r.sht_plan || 0, r.lot_plan || 0]);
    savedCount++;
  }

  if (!skipHistoryLog) {
    await logExcelImportHistory({
      fileName,
      recordCount: savedCount,
      sheetCount: sheetCount || FPC_TARGET_SPECS.length,
      importedBy,
      details: `Sync อัตโนมัติจาก Network Folder Plan EFPC (${fileName}) รวม ${savedCount} รายการ`
    });
  }

  triggerPeriodSummaryRollup(records);
  return savedCount;
}

/**
 * ค้นหาและคัดกรองไฟล์ Excel ของ Plan EFPC สำหรับปีล่าสุดเท่านั้น (Read-Only)
 * กฎการจัดวางไฟล์ Plan EFPC:
 * 1. มี Folder แยกตามปี เช่น '2026', '2025' (หรือ พ.ศ. 2569)
 * 2. ไฟล์ของเดือนปัจจุบันจะวางอยู่ด้านนอก (root directory)
 * 3. เมื่อครบเดือน ไฟล์จะถูกย้ายเข้าไปเก็บใน Folder ปี
 * 4. ระบบจะคัดกรองอ่านเฉพาะไฟล์ที่เป็นของ "ปีล่าสุด" เท่านั้น (Read-Only: ไม่แตะต้อง/ไม่แก้ไขไฟล์ใดๆ)
 */
function getLatestYearFpcFiles(targetFolder) {
  if (!fs.existsSync(targetFolder)) {
    return { latestYear: null, files: [] };
  }

  // 1. สแกน entries ทั้งหมดที่ root folder
  let rootEntries = [];
  try {
    rootEntries = fs.readdirSync(targetFolder, { withFileTypes: true });
  } catch (err) {
    console.error(`[FpcExcelSync] Failed to read directory ${targetFolder}:`, err.message);
    return { latestYear: null, files: [] };
  }

  // 2. ค้นหาโฟลเดอร์ปีทั้งหมด เพื่อหาปีล่าสุด
  const detectedYears = new Set();
  const yearFolderMap = new Map(); // normalizedYear (CE) -> folderName

  // เพิ่มปีปัจจุบันของระบบไว้เป็นตัวเลือกฐาน
  const systemYear = new Date().getFullYear();
  detectedYears.add(systemYear);

  for (const entry of rootEntries) {
    if (entry.isDirectory()) {
      const match = entry.name.match(/^(\d{4})$/);
      if (match) {
        const val = parseInt(match[1], 10);
        const ceYear = val > 2500 ? val - 543 : val;
        if (ceYear >= 2020 && ceYear <= 2099) {
          detectedYears.add(ceYear);
          yearFolderMap.set(ceYear, entry.name);
        }
      }
    }
  }

  // ตรวจจับปีจากชื่อไฟล์ Excel ที่อยู่ที่ root ด้วย
  const rootExcelFiles = rootEntries
    .filter(e => e.isFile() && !e.name.startsWith('~$') && (e.name.endsWith('.xlsx') || e.name.endsWith('.xls')))
    .map(e => e.name);

  for (const fn of rootExcelFiles) {
    const ym = detectYearMonthFromFileName(fn);
    const m = ym.match(/^(\d{4})-/);
    if (m) {
      const y = parseInt(m[1], 10);
      if (y >= 2020 && y <= 2099) {
        detectedYears.add(y);
      }
    }
  }

  // 3. กำหนดปีล่าสุด (Latest Year)
  const latestYearNum = Math.max(...Array.from(detectedYears));
  const latestYearStr = String(latestYearNum);
  console.log(`[FpcExcelSync] Plan EFPC: Identified latest year as ${latestYearStr}`);

  const monthMap = new Map(); // 'YYYY-MM' -> fileInfo

  // 4. อ่านไฟล์จากโฟลเดอร์ปีล่าสุด (ถ้ามีโฟลเดอร์ของปีนี้)
  const yearDirName = yearFolderMap.get(latestYearNum) || latestYearStr;
  const yearDirPath = path.join(targetFolder, yearDirName);

  if (fs.existsSync(yearDirPath)) {
    try {
      const yearEntries = fs.readdirSync(yearDirPath, { withFileTypes: true });
      for (const entry of yearEntries) {
        if (entry.isFile() && !entry.name.startsWith('~$') && (entry.name.endsWith('.xlsx') || entry.name.endsWith('.xls'))) {
          const filePath = path.join(yearDirPath, entry.name);
          const yearMonth = detectYearMonthFromFileName(entry.name, latestYearStr);
          if (yearMonth.startsWith(`${latestYearStr}-`)) {
            let mtime = 0;
            try {
              mtime = fs.statSync(filePath).mtimeMs;
            } catch (_) {}

            monthMap.set(yearMonth, {
              fileName: entry.name,
              filePath,
              sourceYear: latestYearStr,
              yearMonth,
              mtime,
              location: `Folder ${yearDirName}`
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[FpcExcelSync] Warning: Failed to read year folder ${yearDirPath}:`, err.message);
    }
  }

  // 5. อ่านไฟล์ที่อยู่ด้านนอก (root folder) ซึ่งเป็นไฟล์เดือนปัจจุบัน
  for (const fn of rootExcelFiles) {
    const filePath = path.join(targetFolder, fn);
    const yearMonth = detectYearMonthFromFileName(fn, latestYearStr);

    // รับเฉพาะไฟล์ของปีล่าสุดเท่านั้น
    if (yearMonth.startsWith(`${latestYearStr}-`)) {
      let mtime = 0;
      try {
        mtime = fs.statSync(filePath).mtimeMs;
      } catch (_) {}

      // ถ้ายังไม่มีเดือนนี้ หรือถ้าไฟล์ด้านนอกมี mtime ใหม่กว่า/เท่ากับ ให้ใช้ไฟล์ด้านนอก (เดือนปัจจุบัน)
      const existing = monthMap.get(yearMonth);
      if (!existing || mtime >= existing.mtime) {
        monthMap.set(yearMonth, {
          fileName: fn,
          filePath,
          sourceYear: latestYearStr,
          yearMonth,
          mtime,
          location: 'Root (Current Month)'
        });
      }
    } else {
      console.log(`[FpcExcelSync] Plan EFPC: Skipping root file from different year: ${fn} (detected: ${yearMonth})`);
    }
  }

  const selectedFiles = Array.from(monthMap.values()).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

  return {
    latestYear: latestYearStr,
    files: selectedFiles
  };
}

/**
 * สแกน Network / Local Folder ของ Plan EFPC (Read-Only) และ Sync ลง Database
 */
async function syncFpcPlanFolderToDb(currentMonthOnly = true) {
  let targetFolder = FPC_PLAN_NETWORK_FOLDER;
  if (!fs.existsSync(targetFolder)) {
    console.warn(`[FpcExcelSync] Network folder not accessible: ${targetFolder}. Trying local fallback: ${FPC_PLAN_LOCAL_FOLDER}`);
    targetFolder = FPC_PLAN_LOCAL_FOLDER;
  }

  if (!fs.existsSync(targetFolder)) {
    console.warn(`[FpcExcelSync] Folder not found: ${targetFolder}`);
    return { success: false, message: `Folder not found: ${targetFolder}` };
  }

  await ensureFpcPlanTable();

  console.log(`[FpcExcelSync] Scanning Plan EFPC folder (Read-Only): ${targetFolder} (currentMonthOnly: ${currentMonthOnly})`);
  const { latestYear, files: uniqueFiles } = getLatestYearFpcFiles(targetFolder);

  if (uniqueFiles.length === 0) {
    console.log(`[FpcExcelSync] No matching Excel files found for latest year ${latestYear}.`);
    return { success: true, count: 0, filesCount: 0, latestYear, message: `No Excel files found for year ${latestYear}` };
  }

  // Filter to current month only if requested (default true)
  let filesToProcess = uniqueFiles;
  if (currentMonthOnly) {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const matchedFiles = uniqueFiles.filter(f => f.yearMonth === currentYearMonth);
    filesToProcess = matchedFiles.length > 0 ? matchedFiles : (uniqueFiles.length > 0 ? [uniqueFiles[uniqueFiles.length - 1]] : []);
    console.log(`[FpcExcelSync] Filtered for current month (${currentYearMonth}): processing ${filesToProcess.map(f => f.fileName).join(', ')}`);
  }

  console.log(`[FpcExcelSync] Found ${filesToProcess.length} file(s) to process:`);
  filesToProcess.forEach(f => {
    console.log(`  - [${f.yearMonth}] ${f.fileName} (${f.location})`);
  });

  let totalSaved = 0;
  const syncDetails = [];

  for (const file of filesToProcess) {
    const { fileName, filePath, sourceYear, location } = file;
    try {
      console.log(`[FpcExcelSync] Processing file: ${fileName} [${location}] (Year: ${sourceYear})...`);
      const fileBuffer = fs.readFileSync(filePath);
      const { records, sheetCount } = parseFpcPlanWorkbook(fileBuffer, fileName, sourceYear);
      const savedCount = await saveFpcPlanRecords(records, fileName, 'AutoSync', false, sheetCount);
      totalSaved += savedCount;
      syncDetails.push(`${fileName} (${location}): saved ${savedCount} records`);
    } catch (err) {
      console.error(`[FpcExcelSync] Error parsing ${fileName}:`, err);
    }
  }

  console.log(`[FpcExcelSync] Completed Plan EFPC folder sync. Total records saved: ${totalSaved}`);
  return { success: true, count: totalSaved, filesCount: filesToProcess.length, latestYear, details: syncDetails };
}

/**
 * กำหนดเวลารัน Auto-Sync FPC ทุกวันเวลา 09:00 AM (Thai Time UTC+7)
 */
function initFpcFolderScheduler() {
  console.log('[FpcExcelSync] Initializing FPC Excel Folder Auto-Sync Scheduler (09:00 AM Daily)...');

  function scheduleNextRun() {
    const now = new Date();
    const target = new Date();
    target.setHours(9, 0, 0, 0);

    if (now >= target) {
      target.setDate(target.getDate() + 1);
    }

    const msUntilTarget = target.getTime() - now.getTime();
    console.log(`[FpcExcelSync] Next auto-sync scheduled in ${(msUntilTarget / 1000 / 60).toFixed(1)} minutes (at ${target.toLocaleTimeString('th-TH')})`);

    setTimeout(async () => {
      try {
        console.log('[FpcExcelSync] Executing daily auto-sync for FPC folder...');
        await syncFpcPlanFolderToDb();
      } catch (err) {
        console.error('[FpcExcelSync] Error in scheduled sync:', err);
      } finally {
        scheduleNextRun();
      }
    }, msUntilTarget);
  }

  scheduleNextRun();
}


module.exports = {
  detectYearMonthFromFileName,
  parseExcelDate,
  ensureFpcPlanTable,
  parseFpcPlanWorkbook,
  saveFpcPlanRecords,
  getLatestYearFpcFiles,
  syncFpcPlanFolderToDb,
  initFpcFolderScheduler
};
