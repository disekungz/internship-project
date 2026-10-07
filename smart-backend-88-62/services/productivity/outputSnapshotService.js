const { pool_smart, pool_test, pool_ot } = require('../../routes/10.17.87.244/config');
const pgPool = pool_smart;
const poolTest = pool_test;
const mariaPool = pool_ot;
const { getEmployeeDataForDate } = require('./snapshotManager');
const { clearAllCache } = require('../../Utility/apiCache');

function dayjs(input) {
  const d = input ? (input instanceof Date ? new Date(input.getTime()) : new Date(input)) : new Date();
  return {
    toDate: () => d,
    isValid: () => !isNaN(d.getTime()),
    format: (fmt = 'YYYY-MM-DD') => {
      if (isNaN(d.getTime())) return '';
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const s = String(d.getSeconds()).padStart(2, '0');
      if (fmt === 'YYYY-MM') return y + '-' + m;
      if (fmt === 'YYYY') return String(y);
      if (fmt === 'YYYY-MM-DD HH:mm:ss') return `${y}-${m}-${day} ${h}:${min}:${s}`;
      return y + '-' + m + '-' + day;
    },
    year: () => d.getFullYear(),
    month: () => d.getMonth(),
    date: () => d.getDate(),
    day: () => d.getDay(),
    hour: () => d.getHours(),
    minute: () => d.getMinutes(),
    diff: (other, unit) => {
      const od = other && other.toDate ? other.toDate() : new Date(other);
      const diffMs = d.getTime() - od.getTime();
      if (unit === 'minute' || unit === 'minutes') return diffMs / (1000 * 60);
      if (unit === 'hour' || unit === 'hours') return diffMs / (1000 * 60 * 60);
      if (unit === 'day' || unit === 'days') return diffMs / (1000 * 60 * 60 * 24);
      return diffMs;
    },
    add: (val, unit) => {
      const res = new Date(d.getTime());
      if (unit === 'day' || unit === 'days') res.setDate(res.getDate() + val);
      return dayjs(res);
    },
    startOf: (unit) => {
      const res = new Date(d.getTime());
      if (unit === 'month') { res.setDate(1); res.setHours(0,0,0,0); }
      else if (unit === 'year') { res.setMonth(0); res.setDate(1); res.setHours(0,0,0,0); }
      else if (unit === 'isoWeek') {
        const day = (res.getDay() + 6) % 7;
        res.setDate(res.getDate() - day);
        res.setHours(0,0,0,0);
      }
      return dayjs(res);
    },
    endOf: (unit) => {
      const res = new Date(d.getTime());
      if (unit === 'month') {
        const nextM = new Date(res.getFullYear(), res.getMonth() + 1, 0, 23, 59, 59, 999);
        return dayjs(nextM);
      } else if (unit === 'year') {
        return dayjs(new Date(res.getFullYear(), 11, 31, 23, 59, 59, 999));
      } else if (unit === 'isoWeek') {
        const day = (res.getDay() + 6) % 7;
        res.setDate(res.getDate() + (6 - day));
        res.setHours(23, 59, 59, 999);
        return dayjs(res);
      }
      return dayjs(res);
    },
    isBefore: (other) => d < (other && other.toDate ? other.toDate() : new Date(other)),
    isAfter: (other) => d > (other && other.toDate ? other.toDate() : new Date(other)),
    isSame: (other, unit) => {
      const od = other && other.toDate ? other.toDate() : new Date(other);
      if (unit === 'day') {
        return d.getFullYear() === od.getFullYear() && d.getMonth() === od.getMonth() && d.getDate() === od.getDate();
      }
      return d.getTime() === od.getTime();
    }
  };
}



// Ensure monthly_attendance_import_log table exists
(async () => {
  try {
    await poolTest.query(`
      CREATE TABLE IF NOT EXISTS public.monthly_attendance_import_log (
        id SERIAL PRIMARY KEY,
        target_month VARCHAR(7) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        total_records INT NOT NULL,
        total_days INT NOT NULL,
        uploaded_by VARCHAR(100) DEFAULT 'Admin',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('[MonthlyAttendance] Failed ensuring monthly_attendance_import_log table:', err.message);
  }
})();

// Helper to normalize dates from Excel (supporting DD/MM/YYYY, YYYY-MM-DD, and Excel serial numbers)
const parseExcelDate = (val) => {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return dayjs(val).format('YYYY-MM-DD');
  }
  if (typeof val === 'number') {
    // Excel serial date to JS date
    const jsDate = new Date(Math.round((val - 25569) * 86400 * 1000));
    return dayjs(jsDate).format('YYYY-MM-DD');
  }
  const str = String(val).trim();
  if (!str) return null;

  // Try YYYY-MM-DD
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(str)) {
    const d = dayjs(str.substring(0, 10));
    if (d.isValid()) return d.format('YYYY-MM-DD');
  }

  // Try DD/MM/YYYY
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/.test(str)) {
    const parts = str.split(/[-/.]/);
    if (parts.length >= 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2].substring(0, 4);
      const d = dayjs(`${year}-${month}-${day}`);
      if (d.isValid()) return d.format('YYYY-MM-DD');
    }
  }

  const fallback = dayjs(str);
  return fallback.isValid() ? fallback.format('YYYY-MM-DD') : null;
};

// Helper to combine date string and time string into full datetime
const parseDateTime = (dateStr, timeVal) => {
  if (!timeVal) return null;
  if (timeVal instanceof Date && !isNaN(timeVal.getTime())) {
    return dayjs(timeVal).format('YYYY-MM-DD HH:mm:ss');
  }
  if (typeof timeVal === 'number') {
    // Excel fraction of day
    const totalSeconds = Math.round(timeVal * 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return dateStr ? `${dateStr} ${timeStr}` : null;
  }
  const str = String(timeVal).trim();
  if (!str) return null;

  if (str.includes(' ') && str.length >= 16) {
    const d = dayjs(str);
    return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : null;
  }

  if (dateStr) {
    return `${dateStr} ${str}`;
  }
  return null;
};

const processMonthlyAttendanceImport = async ({ targetMonth, rows, fileName, uploadedBy = 'Admin' }) => {
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    throw new Error('ไม่พบข้อมูลในไฟล์ Excel ที่อัปโหลด');
  }
  if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
    throw new Error('กรุณาระบุเดือนในรูปแบบ YYYY-MM (เช่น 2026-08)');
  }

  console.log(`[MonthlyAttendance] Starting import for month ${targetMonth} (${rows.length} raw rows from ${fileName})...`);

  // 1. Fetch Department Master from PostgreSQL
  const pgResult = await pgPool.query(`
    SELECT mhr_cc, mhr_cc_desc, mhr_cc_type, mhr_div 
    FROM smart.smart_man_cc_master_mhr
  `);
  const pgData = pgResult.rows;

  // 2. Fetch Cost Centers & Loan Exclusions from poolTest
  const monthStart = `${targetMonth}-01`;
  const monthEnd = dayjs(monthStart).endOf('month').format('YYYY-MM-DD');

  const [ccResult, loanExcludeResult] = await Promise.all([
    poolTest.query(`SELECT cost_center_code, line_out, type, cost_center_name FROM public.cost_centers`),
    poolTest.query(`
      SELECT employee_id, 
             TO_CHAR(start_date, 'YYYY-MM-DD') as start_date, 
             TO_CHAR(end_date, 'YYYY-MM-DD') as end_date 
      FROM public.manpower_loan_exclude 
      WHERE is_active = true 
        AND (start_date IS NULL OR TO_CHAR(start_date, 'YYYY-MM-DD') <= $2)
        AND (end_date IS NULL OR TO_CHAR(end_date, 'YYYY-MM-DD') >= $1)
    `, [monthStart, monthEnd])
  ]);

  const ccDirectMap = new Map();
  const ccTypeMap = new Map();
  ccResult.rows.forEach(row => {
    const code = (row.cost_center_code || '').trim();
    if (!code) return;
    ccDirectMap.set(code, row.line_out);
    const cleanCode = code.replace(/[-/]/g, '').toUpperCase();
    let typeVal = 'Direct';
    if (row.type) {
      const u = row.type.toUpperCase();
      if (u === 'INDIRECT PRODUCTION') typeVal = 'Indirect Production';
      else if (u === 'INDIRECT') typeVal = 'Indirect';
      else if (u === 'DIRECT') typeVal = 'Direct';
      else typeVal = row.type;
    }
    ccTypeMap.set(cleanCode, typeVal);
    ccTypeMap.set(code.toUpperCase(), typeVal);
    if (row.cost_center_name) {
      ccTypeMap.set(row.cost_center_name.trim().toUpperCase(), typeVal);
    }
  });

  const loanExcludes = loanExcludeResult.rows.map(r => ({
    employee_id: (r.employee_id || '').trim(),
    start_date: r.start_date ? dayjs(r.start_date).format('YYYY-MM-DD') : null,
    end_date: r.end_date ? dayjs(r.end_date).format('YYYY-MM-DD') : null,
  }));

  const isEmpExcludedOnDate = (empId, dateStr) => {
    if (!empId) return false;
    const cleanId = empId.trim();
    return loanExcludes.some(rec => {
      if (rec.employee_id !== cleanId) return false;
      if (rec.start_date && dateStr < rec.start_date) return false;
      if (rec.end_date && dateStr > rec.end_date) return false;
      return true;
    });
  };

  // Helper to build employee lookup map from a specific day's snapshot
  const buildEmployeeMasterMap = (emps) => {
    const map = new Map();
    (emps || []).forEach(emp => {
      const deptCodeOT = emp.department ? emp.department.split('/')[0].split(' ')[0].replace('-', '').trim() : '';
      const matchedPg = pgData.find(pgRow => {
        if (!pgRow.mhr_cc) return false;
        const mhrCodePG = pgRow.mhr_cc.split('|')[0].trim();
        return deptCodeOT === mhrCodePG;
      });

      const deptUpper = (emp.department || '').trim().toUpperCase();
      const deptCodeRaw = emp.department ? emp.department.split('/')[0].trim().toUpperCase() : '';
      const dbType = ccTypeMap.get(deptCodeOT) || ccTypeMap.get(deptUpper) || ccTypeMap.get(deptCodeRaw);
      let finalMhrType = dbType || (matchedPg ? matchedPg.mhr_cc_type : 'NOT_FOUND');

      const directCodes = [
        'P4613A', 'P4613B', 'P4613D',
        'P4623A', 'P4623B', 'P4623D',
        'P4631A', 'P4631B', 'P4631D',
        'P4633A', 'P4633B', 'P4633D',
        'P4662A', 'P4662B', 'P4662D',
        'P4663A', 'P4663B', 'P4663D',
        'P4671D',
        'P5401B'
      ];

      const exactLineMatchesDirect = [
        'HOT PRESS/A', 'HOT PRESS/B', 'HOT PRESS/D'
      ];

      const directFpcPrefixes = ['P461', 'P462', 'P463', 'P464', 'P465', 'P466', 'P467', 'P468'];
      const allFpcPrefixes = ['P460', ...directFpcPrefixes];

      const isDirectFpcPrefix = directFpcPrefixes.some(prefix => deptCodeOT.startsWith(prefix));
      const isFpcPrefix = allFpcPrefixes.some(prefix => deptCodeOT.startsWith(prefix));

      if (directCodes.includes(deptCodeOT) ||
        exactLineMatchesDirect.includes(emp.line) ||
        isDirectFpcPrefix) {
        finalMhrType = 'Direct';
      }

      let finalMhrDiv = matchedPg ? matchedPg.mhr_div : 'NOT_FOUND';
      if (isFpcPrefix) {
        finalMhrDiv = 'E-FPC';
      }

      const lineOut = ccDirectMap.get(deptCodeRaw) || ccDirectMap.get(emp.department ? emp.department.split('/')[0].trim() : '');

      map.set(emp.code, {
        name: emp.name,
        department: emp.department,
        mhr_cc_type: finalMhrType,
        mhr_div: finalMhrDiv,
        line: emp.line,
        shift: emp.shift,
        line_out: lineOut
      });
    });
    return map;
  };

  // 3. Line mapping matchers
  const lineAAutoLines = ['AT_FRONT/A', 'AT_FRONT/B', 'AT_FRONT/D', 'AT_VAC/A', 'AT_VAC/B', 'AT_VAC/D', 'AT_LAM/A', 'AT_LAM/B', 'AT_LAM/D', 'LINE A_FINAL/A', 'LINE A_FINAL/B', 'LINE A_FINAL/D'];
  const isLineAAuto = (line) => line && lineAAutoLines.includes(line);
  const isAtFront = (line) => line && ['AT_FRONT/A', 'AT_FRONT/B', 'AT_FRONT/D'].includes(line);
  const isAtVac = (line) => line && ['AT_VAC/A', 'AT_VAC/B', 'AT_VAC/D'].includes(line);
  const isAtLam = (line) => line && ['AT_LAM/A', 'AT_LAM/B', 'AT_LAM/D'].includes(line);
  const isLineAFinal = (line) => line && ['LINE A_FINAL/A', 'LINE A_FINAL/B', 'LINE A_FINAL/D'].includes(line);
  const isLineBGen = (line) => line && ['LINE B_GEN/A', 'LINE B_GEN/B', 'LINE B_GEN/D'].includes(line);
  const isLineBNon = (line) => line && ['LINE B_NON/A', 'LINE B_NON/B', 'LINE B_NON/D'].includes(line);
  const isLineC = (line) => line && ['LINE C/A', 'LINE C/B', 'LINE C/D'].includes(line);
  const isLineD = (line) => line && ['LINE D/A', 'LINE D/B', 'LINE D/D'].includes(line);
  const isLineMat = (line) => line && ['MATERIAL/A', 'MATERIAL/B', 'MATERIAL/D', 'Material/A', 'Material/B', 'Material/D'].some(l => l.toUpperCase() === line.toUpperCase());
  const isLineLam = (line) => line && ['F-LAM/A', 'F-LAM/B', 'F-LAM/D'].some(l => l.toUpperCase() === line.toUpperCase());
  const isLineVac = (line) => line && ['VAC/A', 'VAC/B', 'VAC/D'].some(l => l.toUpperCase() === line.toUpperCase());
  const isLineHps = (line) => line && ['HOT PRESS/A', 'HOT PRESS/B', 'HOT PRESS/D'].some(l => l.toUpperCase() === line.toUpperCase());
  const isLineBlk = (line) => line && ['BLK/A', 'BLK/B', 'BLK/D'].some(l => l.toUpperCase() === line.toUpperCase());
  const isLineOst = (line) => line && ['OST/A', 'OST/B', 'OST/D'].some(l => l.toUpperCase() === line.toUpperCase());
  const isLineAviK2 = (line) => line && ['AVI/K2/A', 'AVI/K2/B', 'AVI/K2/D', 'AVI/A', 'AVI/B', 'AVI/D', 'AVI'].some(l => l.toUpperCase() === line.toUpperCase());

  const isMota = (line) => line && ['MOTA_A/A', 'MOTA_A/B', 'MOTA_A/D'].some(l => l.toUpperCase() === line.toUpperCase());
  const isMotaG = (line) => line && ['MOTA_G/A', 'MOTA_G/B', 'MOTA_G/D'].some(l => l.toUpperCase() === line.toUpperCase());
  const isMotb = (line) => line && ['MOTB/A', 'MOTB/B', 'MOTB/D'].some(l => l.toUpperCase() === line.toUpperCase());
  const isMotbG = (line) => line && ['MOTB_G/A', 'MOTB_G/B', 'MOTB_G/D'].some(l => l.toUpperCase() === line.toUpperCase());
  const isMotc = (line) => line && ['MOTC/A', 'MOTC/B', 'MOTC/D', 'AIX-MOT', 'AIX-MOT/A', 'AIX-MOT/B', 'AIX-MOT/D', 'AIX_MOT', 'AIX MOT'].some(l => l.toUpperCase() === line.toUpperCase());
  const isMotd = (line) => line && ['MOTD/A', 'MOTD/B', 'MOTD/D'].some(l => l.toUpperCase() === line.toUpperCase());
  const isAstpA = (line) => line && ['ASTP_A/A', 'ASTP_A/B', 'ASTP_A/D'].some(l => l.toUpperCase() === line.toUpperCase());
  const isAstpG = (line) => line && ['ASTP_G/A', 'ASTP_G/B', 'ASTP_G/D'].some(l => l.toUpperCase() === line.toUpperCase());
  const isXray = (line) => line && ['X-RAY/A', 'X-RAY/B', 'X-RAY/D'].some(l => l.toUpperCase() === line.toUpperCase());
  const isMasRew = (line) => line && ['REW/A', 'REW/B', 'REW/D', 'MAS/A', 'MAS/B', 'MAS/D'].some(l => l.toUpperCase() === line.toUpperCase());
  const isMas = (line) => line && ['MAS/A', 'MAS/B', 'MAS/D'].some(l => l.toUpperCase() === line.toUpperCase());
  const isRew = (line) => line && ['REW/A', 'REW/B', 'REW/D'].some(l => l.toUpperCase() === line.toUpperCase());
  const isSTsteF = (line) => line && ['S_TSTE-F', 'S_TSTE-F/A', 'S_TSTE-F/B', 'S_TSTE-F/D'].some(l => l.toUpperCase() === line.toUpperCase());
  const isSTechF = (line) => line && ['S_TECH-F', 'S_TECH-F/A', 'S_TECH-F/B', 'S_TECH-F/D'].some(l => l.toUpperCase() === line.toUpperCase());

  const smtBackLines = {
    blk_1: ['BLK-1', 'BLK-1/A', 'BLK-1/B', 'BLK-1/D', 'AIX-BLK', 'AIX-BLK/A', 'AIX-BLK/B', 'AIX-BLK/D'],
    blk_2: ['BLK-2', 'BLK-2/A', 'BLK-2/B', 'BLK-2/D'],
    asy1_a: ['ASY1_A', 'ASY1_A/A', 'ASY1_A/B', 'ASY1_A/D'],
    asy1_g: ['ASY1_G', 'ASY1_G/A', 'ASY1_G/B', 'ASY1_G/D'],
    asy2: ['ASY2', 'ASY2/A', 'ASY2/B', 'ASY2/D'],
    asy3: ['ASY3', 'ASY3/A', 'ASY3/B', 'ASY3/D'],
    asy4: ['ASY4', 'ASY4/A', 'ASY4/B', 'ASY4/D', 'AIX-ASY', 'AIX-ASY/A', 'AIX-ASY/B', 'AIX-ASY/D', 'AIX_ASY', 'AIX ASY', 'LINE AIX-ASY', 'LINE ASY4'],
    asy5: ['ASY5', 'ASY5/A', 'ASY5/B', 'ASY5/D'],
    asy6: ['ASY6', 'ASY6/A', 'ASY6/B', 'ASY6/D'],
    asy7: ['ASY7', 'ASY7/A', 'ASY7/B', 'ASY7/D'],
    aelt: ['AELT', 'AELT/A', 'AELT/B', 'AELT/D'],
    smt_lam: ['SMT_LAM', 'SMT_LAM/A', 'SMT_LAM/B', 'SMT_LAM/D', 'LINE SMT_LAM', 'LINE SMT_LAM/A', 'LINE SMT_LAM/B', 'LINE SMT_LAM/D'],
    lam_md: ['LAM MD', 'LAM MD/A', 'LAM MD/B', 'LAM MD/D'],
    md_lam: ['MDLAM', 'MDLAM/A', 'MDLAM/B', 'MDLAM/D'],
    s_tste_b: ['S_TSTE-B', 'S_TSTE-B/A', 'S_TSTE-B/B', 'S_TSTE-B/D'],
    s_ind: ['S_IND', 'S_IND/A', 'S_IND/B', 'S_IND/D'],
  };

  const getSmtBackPrefixes = (line) => {
    if (!line) return [];
    const normalized = line.trim().toUpperCase();
    const matched = Object.entries(smtBackLines)
      .filter(([, lines]) => lines.some(item => item.toUpperCase() === normalized))
      .map(([prefix]) => prefix);
    if (matched.length > 0) return matched;
    if (normalized.includes('ASY4') || normalized.includes('AIX-ASY') || normalized.includes('AIX_ASY') || normalized.includes('AIX ASY')) return ['asy4'];
    if (normalized.includes('ASY1_A') || normalized.includes('ASY1-A') || normalized.includes('ASY1 A')) return ['asy1_a'];
    if (normalized.includes('ASY1_G') || normalized.includes('ASY1-G') || normalized.includes('ASY1 G')) return ['asy1_g'];
    if (normalized.includes('ASY2')) return ['asy2'];
    if (normalized.includes('ASY3')) return ['asy3'];
    if (normalized.includes('ASY5')) return ['asy5'];
    if (normalized.includes('ASY6')) return ['asy6'];
    if (normalized.includes('ASY7')) return ['asy7'];
    if (normalized.includes('BLK-1') || normalized.includes('BLK_1') || normalized.includes('BLK1') || normalized.includes('AIX-BLK') || normalized.includes('AIX_BLK') || normalized.includes('AIX BLK')) return ['blk_1'];
    if (normalized.includes('BLK-2') || normalized.includes('BLK_2') || normalized.includes('BLK2')) return ['blk_2'];
    if (normalized.includes('AELT') || normalized.includes('ASSY-8')) return ['aelt'];
    if (normalized.includes('SMT_LAM') || normalized.includes('SMT-LAM') || normalized.includes('SMT LAM')) return ['smt_lam'];
    if (normalized.includes('MD_LAM') || normalized.includes('MD-LAM') || normalized.includes('MD LAM') || normalized.includes('LAM_MD')) return ['lam_md'];
    if (normalized.includes('S_TSTE-B') || normalized.includes('S_TSTE_B') || normalized.includes('STSTE-B')) return ['s_tste_b'];
    if (normalized.includes('S_IND') || normalized.includes('S-IND')) return ['s_ind'];
    return [];
  };

  const qaFpcLines = {
    oa_f_ind: ['OA_F-IND/D'],
    iqi_m: ['IQI_M/A', 'IQI_M/B', 'IQI_M/D'],
    iqi_f: ['IQI_F/A', 'IQI_F/B', 'IQI_F/D'],
    pqi_r: ['PQI_R/A', 'PQI_R/B', 'PQI_R/D'],
    pqi_m: ['PQI_M/A', 'PQI_M/B', 'PQI_M/D'],
    oqi_m_a: ['OQI_M/A'],
    oqi_m_b: ['OQI_M/B'],
    oqi_m_d: ['OQI_M/D'],
    dqa: ['OQI_M', 'DQA', 'LINE DQA'],
    oqi_f: ['OQI_F-GEN/A', 'OQI_F-GEN/B', 'OQI_F-GEN/D', 'OQI_FPC-A', 'OQI_FPC-B', 'OQI_FPC-D', 'OQI_FPC'],
    oqi_f_pack: ['OQI_F-PACK/A', 'OQI_F-PACK/B', 'OQI_F-PACK/D', 'OQI_FPC-PACK'],
    oqi_fpc_100: ['OQI_FPC-100%/A', 'OQI_FPC-100%/B', 'OQI_FPC-100%/D', 'OQI_FPC-100%'],
    oqi_f_auto: ['OQI_F-AUTO/A', 'OQI_F-AUTO/B', 'OQI_F-AUTO/D'],
    qa_fpc: ['OQI_F-GEN/A', 'OQI_F-GEN/B', 'OQI_F-GEN/D', 'OQI_F-AUTO/A', 'OQI_F-AUTO/B', 'OQI_F-AUTO/D', 'OQI_FPC-A', 'OQI_FPC-B', 'OQI_FPC-D', 'OQI_FPC', 'OQI_FPC-PACK', 'OQI_FPC-100%', 'OQI_FPC-IND', 'QA-IPQC'],
  };
  const getQaFpcPrefixes = (line) => {
    if (!line) return [];
    const normalized = line.toUpperCase();
    return Object.entries(qaFpcLines)
      .filter(([, lines]) => lines.some(item => item.toUpperCase() === normalized))
      .map(([prefix]) => prefix);
  };

  const qaSmtLines = {
    oqi_s_auto: ['OQI_S-AUTO/A', 'OQI_S-AUTO/B', 'OQI_S-AUTO/D'],
    oqi_s_gen: ['OQI_S-GEN/A', 'OQI_S-GEN/B', 'OQI_S-GEN/D'],
    qa_smt_indirect: ['OA_S-IND/D'],
  };
  const getQaSmtPrefixes = (line) => {
    if (!line) return [];
    const normalized = line.toUpperCase();
    return Object.entries(qaSmtLines)
      .filter(([, lines]) => lines.some(item => item.toUpperCase() === normalized))
      .map(([prefix]) => prefix);
  };

  const fpcGroupLines = {
    mds: ['MDS/A', 'MDS/B', 'MDS/D', 'LINE MDS/D', 'MDS'],
  };
  const getFpcGroupPrefixes = (line) => {
    if (!line) return [];
    const normalized = line.toUpperCase();
    return Object.entries(fpcGroupLines)
      .filter(([, lines]) => lines.some(item => item.toUpperCase() === normalized))
      .map(([prefix]) => prefix);
  };

  const getAllPrefixesForLine = (line) => {
    if (!line) return [];
    const prefixes = [];
    if (isLineAAuto(line)) prefixes.push('line_a_auto');
    if (isAtFront(line)) prefixes.push('at_front');
    if (isAtVac(line)) prefixes.push('at_vac');
    if (isAtLam(line)) prefixes.push('at_lam');
    if (isLineAFinal(line)) prefixes.push('line_a_final');
    if (isLineBGen(line)) prefixes.push('line_b_gen');
    if (isLineBNon(line)) prefixes.push('line_b_non');
    if (isLineC(line)) prefixes.push('line_c');
    if (isLineD(line)) prefixes.push('line_d');
    if (isLineMat(line)) prefixes.push('line_mat');
    if (isLineLam(line)) prefixes.push('line_lam');
    if (isLineVac(line)) prefixes.push('line_vac');
    if (isLineHps(line)) prefixes.push('line_hps');
    if (isLineBlk(line)) prefixes.push('line_blk');
    if (isLineOst(line)) prefixes.push('line_ost');
    if (isLineAviK2(line)) prefixes.push('line_avi_k2');
    if (isMota(line)) prefixes.push('mota');
    if (isMotaG(line)) prefixes.push('mota_g');
    if (isMotb(line)) prefixes.push('motb');
    if (isMotbG(line)) prefixes.push('motb_g');
    if (isMotc(line)) prefixes.push('motc');
    if (isMotd(line)) prefixes.push('motd');
    if (isAstpA(line)) prefixes.push('astp_a');
    if (isAstpG(line)) prefixes.push('astp_g');
    if (isXray(line)) prefixes.push('xray');
    if (isMasRew(line)) prefixes.push('mas_rew');
    if (isMas(line)) prefixes.push('mas');
    if (isRew(line)) prefixes.push('rew');
    if (isSTsteF(line)) prefixes.push('s_tste_f');
    if (isSTechF(line)) prefixes.push('s_tech_f');
    getSmtBackPrefixes(line).forEach(p => prefixes.push(p));
    getQaFpcPrefixes(line).forEach(p => prefixes.push(p));
    getQaSmtPrefixes(line).forEach(p => prefixes.push(p));
    getFpcGroupPrefixes(line).forEach(p => prefixes.push(p));

    const cleanLineBase = line.split('/')[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (cleanLineBase) {
      prefixes.push(cleanLineBase);
      if (!cleanLineBase.startsWith('line_')) {
        prefixes.push(`line_${cleanLineBase}`);
      } else {
        prefixes.push(cleanLineBase.replace(/^line_/, ''));
      }
    }

    return Array.from(new Set(prefixes));
  };

  const ALL_ATTENDANCE_PREFIXES = Array.from(new Set([
    'line_a_auto', 'at_front', 'at_vac', 'at_lam', 'line_a_final',
    'line_b_gen', 'line_b_non', 'line_c', 'line_d', 'line_mat',
    'line_lam', 'line_vac', 'line_hps', 'line_blk', 'line_ost', 'line_avi_k2',
    'mota', 'mota_g', 'motb', 'motb_g', 'motc', 'motd', 'astp_a', 'astp_g',
    'xray', 'mas_rew', 'mas', 'rew', 's_tste_f', 's_tech_f',
    ...Object.keys(smtBackLines),
    ...Object.keys(qaFpcLines),
    ...Object.keys(qaSmtLines),
    ...Object.keys(fpcGroupLines)
  ]));

  // 4. Fetch Support (Help transfers) from MariaDB for the entire month
  let helpResult = [];
  try {
    const endPlusOne = dayjs(monthEnd).add(1, 'day').format('YYYY-MM-DD');
    const helpResRaw = await mariaPool.query(`
      SELECT 
        id_code,
        DATE_FORMAT(date_w, '%Y-%m-%d') as work_date,
        type,
        hour,
        line_in,
        line_out
      FROM tbl_help
      WHERE date_w >= ? AND date_w < ?
    `, [monthStart, endPlusOne]);
    helpResult = Array.isArray(helpResRaw) ? (Array.isArray(helpResRaw[0]) ? helpResRaw[0] : helpResRaw) : [];
  } catch (err) {
    console.warn('[MonthlyAttendance] Warning fetching tbl_help from MariaDB:', err.message);
  }

  // 5. Parse and Normalize incoming Excel rows
  const parsedRecordsByDate = new Map();

  rows.forEach((row, idx) => {
    // Look up column values with flexible header names
    const getVal = (keys) => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
          return row[k];
        }
      }
      // Also try normalized lower-cased keys
      for (const [rk, rv] of Object.entries(row)) {
        const normRk = rk.trim().toLowerCase().replace(/[*_ -]/g, '');
        for (const k of keys) {
          const normK = k.trim().toLowerCase().replace(/[*_ -]/g, '');
          if (normRk === normK && rv !== undefined && rv !== null && String(rv).trim() !== '') {
            return rv;
          }
        }
      }
      return null;
    };

    const empCodeRaw = getVal(['รหัสพนักงาน*', 'รหัสพนักงาน', 'dlh_employee_id', 'employee_id', 'code', 'emp_id', 'emp_code', 'id_code']);
    const dateRaw = getVal(['วันที่มีผล*', 'วันที่มีผล', 'dlh_effective_date_time', 'effective_date', 'work_date', 'date']);
    if (!empCodeRaw || !dateRaw) return;

    const empCode = String(empCodeRaw).trim();
    const workDate = parseExcelDate(dateRaw);
    if (!workDate || !workDate.startsWith(targetMonth)) return;

    const shiftRaw = getVal(['รหัสกะการทำงาน*', 'รหัสกะ', 'shift', 'work_day_status']) || 'W';
    const dateInRaw = getVal(['วันที่เข้างาน 1', 'วันที่เข้างาน', 'date_in']);
    const timeInRaw = getVal(['เวลาเข้า 1', 'เวลาเข้า', 'scan_time_in', 'time_in', 'in_time']);
    const dateOutRaw = getVal(['วันที่ออกงาน 1', 'วันที่ออกงาน', 'date_out']);
    const timeOutRaw = getVal(['เวลาออก 1', 'เวลาออก', 'scan_time_out', 'time_out', 'out_time']);
    const remarksRaw = getVal(['หมายเหตุ', 'remarks', 'work_status', 'status', 'leave_type']) || '';

    const scanTimeIn = parseDateTime(parseExcelDate(dateInRaw) || workDate, timeInRaw);
    const scanTimeOut = parseDateTime(parseExcelDate(dateOutRaw) || workDate, timeOutRaw);

    if (!parsedRecordsByDate.has(workDate)) {
      parsedRecordsByDate.set(workDate, []);
    }

    parsedRecordsByDate.get(workDate).push({
      empCode,
      workDate,
      shift: String(shiftRaw).trim(),
      scanTimeIn,
      scanTimeOut,
      remarks: String(remarksRaw).trim()
    });
  });

  const processedDates = Array.from(parsedRecordsByDate.keys()).sort();
  console.log(`[MonthlyAttendance] Parsed ${processedDates.length} distinct dates for month ${targetMonth}. Computing metrics...`);

  if (processedDates.length === 0) {
    throw new Error(`ไม่พบรายการข้อมูลที่ตรงกับเดือน ${targetMonth} ในไฟล์ Excel`);
  }

  // 6. Compute metrics for each date in targetMonth
  const dailyMetricsMap = new Map();
  const dailyEmpMapCache = new Map();

  for (const dateKey of processedDates) {
    const dayRecords = parsedRecordsByDate.get(dateKey);

    // Fetch snapshot for dateKey (automatically resolves to latest prior snapshot if dateKey was skipped)
    let employeeMasterMap = dailyEmpMapCache.get(dateKey);
    if (!employeeMasterMap) {
      const dayEmployees = await getEmployeeDataForDate(dateKey);
      employeeMasterMap = buildEmployeeMasterMap(dayEmployees);
      dailyEmpMapCache.set(dateKey, employeeMasterMap);
    }

    const summary = {
      direct_register: 0, direct_actual: 0,
      indirect_register: 0, indirect_actual: 0,
      indirectProduction_register: 0, indirectProduction_actual: 0,
      unknown_register: 0, unknown_actual: 0,
      total_register: 0, total_actual: 0,
      ot1_actual: 0,
      help_in_normal: 0, help_out_normal: 0,
      help_in_psn: 0, help_out_psn: 0,
      help_in_ot1: 0, help_out_ot1: 0,
      help_in_ot2: 0, help_out_ot2: 0,
      fpc_total_register: 0, fpc_total_actual: 0,
      fpc_direct_register: 0, fpc_direct_actual: 0,
      fpc_ot1_actual: 0, fpc_direct_ot1_actual: 0,
      fpc_help_in_normal: 0, fpc_help_out_normal: 0,
      fpc_direct_help_in_normal: 0, fpc_direct_help_out_normal: 0,
      fpc_help_in_ot1: 0, fpc_help_out_ot1: 0,
      fpc_direct_help_in_ot1: 0, fpc_direct_help_out_ot1: 0,
      fpc_help_in_ot2: 0, fpc_help_out_ot2: 0,
      fpc_direct_help_in_ot2: 0, fpc_direct_help_out_ot2: 0,
    };

    ALL_ATTENDANCE_PREFIXES.forEach(prefix => {
      summary[`${prefix}_total_register`] = 0;
      summary[`${prefix}_total_actual`] = 0;
      summary[`${prefix}_ot1_actual`] = 0;
      summary[`${prefix}_help_in_normal`] = 0;
      summary[`${prefix}_help_out_normal`] = 0;
      summary[`${prefix}_help_in_psn`] = 0;
      summary[`${prefix}_help_out_psn`] = 0;
      summary[`${prefix}_help_in_ot1`] = 0;
      summary[`${prefix}_help_out_ot1`] = 0;
      summary[`${prefix}_help_in_ot2`] = 0;
      summary[`${prefix}_help_out_ot2`] = 0;
    });

    const registeredEmployeesThisDate = new Set();

    for (const record of dayRecords) {
      const empCode = record.empCode;
      if (isEmpExcludedOnDate(empCode, dateKey)) continue;

      const isFirstScan = !registeredEmployeesThisDate.has(empCode);
      if (isFirstScan) registeredEmployeesThisDate.add(empCode);

      const empInfo = employeeMasterMap.get(empCode);
      const empType = empInfo ? empInfo.mhr_cc_type : 'Unknown';
      const empDiv = empInfo ? empInfo.mhr_div : 'Unknown';
      const empLineOut = (empInfo && empInfo.line_out) ? empInfo.line_out : (empInfo && empInfo.line && empInfo.shift ? empInfo.line + '/' + empInfo.shift : null);
      const deptCodeOT = empInfo && empInfo.department ? empInfo.department.split('/')[0].split(' ')[0].replace('-', '').trim() : '';

      const isFpcDeptFallback = ['P460', 'P461', 'P462', 'P463', 'P464', 'P465', 'P466', 'P467', 'P468'].some(prefix => deptCodeOT.startsWith(prefix));
      const isFpcDiv = empDiv === 'E-FPC' || isFpcDeptFallback;
      const isMgrDept = empInfo && empInfo.department && empInfo.department.includes('(MGR)');

      const remarksUpper = record.remarks.toUpperCase();
      const isLeave = remarksUpper.includes('ลา') || remarksUpper.includes('LEAVE') || remarksUpper.includes('ABSENT') || remarksUpper.includes('ขาด');

      let hoursWorked = null;
      if (record.scanTimeIn && record.scanTimeOut) {
        const inTime = dayjs(record.scanTimeIn);
        const outTime = dayjs(record.scanTimeOut);
        hoursWorked = outTime.diff(inTime, 'minute') / 60.0;
      }

      const isShortDuration = hoursWorked !== null && hoursWorked > 0 && hoursWorked < 4.0;
      const isNonWorkingDay = record.shift.includes('H') || record.shift.includes('O');
      const hasScan = Boolean(record.scanTimeIn || record.scanTimeOut);

      let isActual = false;
      if (isLeave || isShortDuration) {
        isActual = false;
      } else if (isNonWorkingDay) {
        isActual = hasScan;
      } else {
        isActual = hasScan || (remarksUpper.includes('NORMAL') && !isLeave);
      }

      if (isFirstScan) {
        const prefixes = getAllPrefixesForLine(empLineOut);
        prefixes.forEach(prefix => {
          summary[`${prefix}_total_register`] = (summary[`${prefix}_total_register`] || 0) + 1;
        });

        const deptRaw = empInfo && empInfo.department ? empInfo.department.split('/')[0].trim().toUpperCase() : '';
        const deptClean = deptRaw.split(' ')[0].replace(/[-_]/g, '');
        if (deptRaw) {
          summary[`${deptRaw}_total_register`] = (summary[`${deptRaw}_total_register`] || 0) + 1;
          summary[`cc_${deptRaw}_total_register`] = (summary[`cc_${deptRaw}_total_register`] || 0) + 1;
          if (deptClean && deptClean !== deptRaw) {
            summary[`${deptClean}_total_register`] = (summary[`${deptClean}_total_register`] || 0) + 1;
            summary[`cc_${deptClean}_total_register`] = (summary[`cc_${deptClean}_total_register`] || 0) + 1;
          }
        }

        if (isFpcDiv && !isMgrDept) {
          summary.fpc_total_register++;
        }

        if (empType === 'Direct') {
          summary.direct_register++;
          if (isFpcDiv) summary.fpc_direct_register++;
        } else if (empType === 'Indirect') {
          summary.indirect_register++;
        } else if (empType === 'Indirect Production') {
          summary.indirectProduction_register++;
        } else {
          summary.unknown_register++;
        }
        summary.total_register++;
      }

      if (isActual) {
        const prefixes = getAllPrefixesForLine(empLineOut);
        prefixes.forEach(prefix => {
          summary[`${prefix}_total_actual`] = (summary[`${prefix}_total_actual`] || 0) + 1;
        });

        const deptRaw = empInfo && empInfo.department ? empInfo.department.split('/')[0].trim().toUpperCase() : '';
        const deptClean = deptRaw.split(' ')[0].replace(/[-_]/g, '');
        if (deptRaw) {
          summary[`${deptRaw}_total_actual`] = (summary[`${deptRaw}_total_actual`] || 0) + 1;
          summary[`cc_${deptRaw}_total_actual`] = (summary[`cc_${deptRaw}_total_actual`] || 0) + 1;
          summary[`${deptRaw}_total_man_hour`] = (summary[`${deptRaw}_total_man_hour`] || 0) + 8;
          summary[`cc_${deptRaw}_total_man_hour`] = (summary[`cc_${deptRaw}_total_man_hour`] || 0) + 8;
          if (deptClean && deptClean !== deptRaw) {
            summary[`${deptClean}_total_actual`] = (summary[`${deptClean}_total_actual`] || 0) + 1;
            summary[`cc_${deptClean}_total_actual`] = (summary[`cc_${deptClean}_total_actual`] || 0) + 1;
            summary[`${deptClean}_total_man_hour`] = (summary[`${deptClean}_total_man_hour`] || 0) + 8;
            summary[`cc_${deptClean}_total_man_hour`] = (summary[`cc_${deptClean}_total_man_hour`] || 0) + 8;
          }
        }

        if (isFpcDiv && !isMgrDept) {
          summary.fpc_total_actual++;
        }

        if (empType === 'Direct') {
          summary.direct_actual++;
          if (isFpcDiv && !isMgrDept) summary.fpc_direct_actual++;
        } else if (empType === 'Indirect') {
          summary.indirect_actual++;
        } else if (empType === 'Indirect Production') {
          summary.indirectProduction_actual++;
        } else {
          summary.unknown_actual++;
        }
        summary.total_actual++;

        // OT check
        if (record.scanTimeOut) {
          const bkkOut = dayjs(record.scanTimeOut);
          const outHour = bkkOut.hour();
          const outMin = bkkOut.minute();

          let isNightShift = false;
          if (record.scanTimeIn) {
            const inHour = dayjs(record.scanTimeIn).hour();
            if (inHour >= 18 && inHour <= 23) isNightShift = true;
          } else if (empInfo && empInfo.shift) {
            const s = empInfo.shift.toUpperCase().trim();
            if (s === 'N' || s === 'B') isNightShift = true;
          }

          let isOt = false;
          if (isNightShift) {
            if ((outHour === 7 && outMin >= 30) || (outHour >= 8 && outHour <= 12)) isOt = true;
          } else {
            if ((outHour === 19 && outMin >= 30) || (outHour >= 20 && outHour <= 23)) isOt = true;
          }

          if (isOt) {
            summary.ot1_actual++;
            prefixes.forEach(prefix => {
              summary[`${prefix}_ot1_actual`] = (summary[`${prefix}_ot1_actual`] || 0) + 1;
            });

            if (deptRaw) {
              summary[`${deptRaw}_ot_psn`] = (summary[`${deptRaw}_ot_psn`] || 0) + 1;
              summary[`cc_${deptRaw}_ot_psn`] = (summary[`cc_${deptRaw}_ot_psn`] || 0) + 1;
              summary[`${deptRaw}_total_man_hour`] = (summary[`${deptRaw}_total_man_hour`] || 0) + 2.5;
              summary[`cc_${deptRaw}_total_man_hour`] = (summary[`cc_${deptRaw}_total_man_hour`] || 0) + 2.5;
              if (deptClean && deptClean !== deptRaw) {
                summary[`${deptClean}_ot_psn`] = (summary[`${deptClean}_ot_psn`] || 0) + 1;
                summary[`cc_${deptClean}_ot_psn`] = (summary[`cc_${deptClean}_ot_psn`] || 0) + 1;
                summary[`${deptClean}_total_man_hour`] = (summary[`${deptClean}_total_man_hour`] || 0) + 2.5;
                summary[`cc_${deptClean}_total_man_hour`] = (summary[`cc_${deptClean}_total_man_hour`] || 0) + 2.5;
              }
            }

            if (isFpcDiv && !isMgrDept) {
              summary.fpc_ot1_actual++;
              if (empType === 'Direct') {
                summary.fpc_direct_ot1_actual++;
              }
            }
          }
        }
      }
    }

    // Workday Type
    const dObj = dayjs(dateKey);
    const dOfWeek = dObj.day();
    if (dOfWeek === 0 || dOfWeek === 6) {
      summary.work_day_type = (summary.ot1_actual >= 20) ? 'H' : 'O';
    } else {
      summary.work_day_type = 'W';
    }

    // Apply Help transfer data for dateKey
    const dateHelpRows = (helpResult || []).filter(r => r.work_date === dateKey);
    dateHelpRows.forEach(h => {
      const type = (h.type || '').trim().toUpperCase();
      const hours = Number(h.hour || 0);

      const inPrefixes = getAllPrefixesForLine(h.line_in);
      const outPrefixes = getAllPrefixesForLine(h.line_out);

      if (type === 'NORMAL') {
        summary.help_in_normal += hours;
        summary.help_out_normal += hours;
        summary.help_in_psn += 1;
        summary.help_out_psn += 1;
        inPrefixes.forEach(p => {
          summary[`${p}_help_in_normal`] = (summary[`${p}_help_in_normal`] || 0) + hours;
          summary[`${p}_help_in_psn`] = (summary[`${p}_help_in_psn`] || 0) + 1;
        });
        outPrefixes.forEach(p => {
          summary[`${p}_help_out_normal`] = (summary[`${p}_help_out_normal`] || 0) + hours;
          summary[`${p}_help_out_psn`] = (summary[`${p}_help_out_psn`] || 0) + 1;
        });
      } else if (type === 'OT 1') {
        summary.help_in_ot1 += hours;
        summary.help_out_ot1 += hours;
        inPrefixes.forEach(p => {
          summary[`${p}_help_in_ot1`] = (summary[`${p}_help_in_ot1`] || 0) + hours;
        });
        outPrefixes.forEach(p => {
          summary[`${p}_help_out_ot1`] = (summary[`${p}_help_out_ot1`] || 0) + hours;
        });
      } else if (type === 'OT 2') {
        summary.help_in_ot2 += hours;
        summary.help_out_ot2 += hours;
        inPrefixes.forEach(p => {
          summary[`${p}_help_in_ot2`] = (summary[`${p}_help_in_ot2`] || 0) + hours;
        });
        outPrefixes.forEach(p => {
          summary[`${p}_help_out_ot2`] = (summary[`${p}_help_out_ot2`] || 0) + hours;
        });
      }
    });

    // Compute standard Man-hours
    summary.total_man_hour = (summary.total_actual * 8) + (summary.ot1_actual * 2.5);
    summary.fpc_total_man_hour = (summary.fpc_total_actual * 8) + (summary.fpc_ot1_actual * 2.5) + (summary.fpc_help_in_normal || 0) - (summary.fpc_help_out_normal || 0) + (summary.fpc_help_in_ot1 || 0) - (summary.fpc_help_out_ot1 || 0);
    summary.fpc_direct_man_hour = (summary.fpc_direct_actual * 8) + (summary.fpc_direct_ot1_actual * 2.5) + (summary.fpc_direct_help_in_normal || 0) - (summary.fpc_direct_help_out_normal || 0) + (summary.fpc_direct_help_in_ot1 || 0) - (summary.fpc_direct_help_out_ot1 || 0);

    ALL_ATTENDANCE_PREFIXES.forEach(prefix => {
      const act = summary[`${prefix}_total_actual`] || 0;
      const ot = summary[`${prefix}_ot1_actual`] || 0;
      const hInNorm = summary[`${prefix}_help_in_normal`] || 0;
      const hOutNorm = summary[`${prefix}_help_out_normal`] || 0;
      const hInOt = summary[`${prefix}_help_in_ot1`] || 0;
      const hOutOt = summary[`${prefix}_help_out_ot1`] || 0;
      summary[`${prefix}_total_man_hour`] = (act * 8) + (ot * 2.5) + hInNorm - hOutNorm + hInOt - hOutOt;
    });

    dailyMetricsMap.set(dateKey, summary);
  }

  // 7. Atomic Database Transaction to Upsert daily snapshots and log
  const client = await poolTest.connect();
  try {
    await client.query('BEGIN');

    for (const [dStr, metrics] of dailyMetricsMap.entries()) {
      await client.query(`
        INSERT INTO public.productivity_attendance_daily_snapshot (work_date, metrics, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (work_date) DO UPDATE SET
          metrics = EXCLUDED.metrics,
          updated_at = NOW()
      `, [dStr, JSON.stringify(metrics)]);
    }

    await client.query(`
      INSERT INTO public.monthly_attendance_import_log
        (target_month, file_name, total_records, total_days, uploaded_by)
      VALUES ($1, $2, $3, $4, $5)
    `, [targetMonth, fileName, rows.length, processedDates.length, uploadedBy]);

    await client.query('COMMIT');
    console.log(`[MonthlyAttendance] Successfully overwritten ${processedDates.length} days into daily snapshot for ${targetMonth}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // 8. Rollup period summary for processed dates and clear cache
  if (processedDates.length > 0) {
    try {
      const { syncProductivityPeriodSummary } = require('./periodSummaryService');
      await syncProductivityPeriodSummary(processedDates[0], processedDates[processedDates.length - 1]);
    } catch (err) {
      console.warn('[MonthlyAttendance] Period summary rollup warning:', err.message);
    }
  }

  try {
    clearAllCache();
  } catch (e) {}

  return {
    success: true,
    targetMonth,
    fileName,
    totalRecords: rows.length,
    totalDays: processedDates.length,
    processedDates
  };
};

const getMonthlyImportLogs = async (limit = 20) => {
  try {
    const res = await poolTest.query(`
      SELECT 
        id, 
        target_month, 
        file_name, 
        total_records, 
        total_days, 
        uploaded_by, 
        TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
      FROM public.monthly_attendance_import_log
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);
    return res.rows;
  } catch (err) {
    console.error('[MonthlyAttendance] Error fetching logs:', err.message);
    return [];
  }
};

module.exports = {
  processMonthlyAttendanceImport,
  getMonthlyImportLogs
};
