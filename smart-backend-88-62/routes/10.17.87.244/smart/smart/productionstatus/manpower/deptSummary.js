// ==========================================
// API Router สำหรับสรุป Manpower และสัดส่วนกำลังคนแยกตามแผนก (Department Summary & Ratio)
// - คำนวณอัตราส่วนการมาทำงาน (Attendance Ratio), การทำ OT (OT Ratio), และการขาดลา (Leave Ratio)
// - แบ่งตาม 5 แผนกหลัก: QA, FPC, SMT_F, SMT_B, MDS
// ==========================================
const fs = require('fs');
const path = require('path');
const express = require('express');
const { pool_smart, pool_ot, pool_test, queryWithRetry, queryWithRetryPool1 } = require('../../../../config.js');
const { readPersistentCache, writePersistentCache } = require('../../../../../../Utility/persistentCache.js');
const { isOtherFactoryRecord, shouldCountAsAbsent, shouldCountAsPresent } = require('../../../../../../Utility/manpowerAggregation.js');

// ==============================================
// ✅ ฟังก์ชันช่วยเหลือพื้นฐาน
// ==============================================

/**
 * ตรวจสอบว่าเป็นสถานะวันหยุดหรือไม่ (Holiday / Off)
 */
function isHolidayStatus(status) {
  const s = String(status || '').trim().toUpperCase();
  return s === 'O' || s === 'H' || s === 'HOL' || s === 'HOLIDAY' || s === 'OFF';
}

/**
 * แปลงเวลา (Date/Timestamp) ให้เป็นจำนวนนาทีตั้งแต่ 00:00 (สำหรับเปรียบเทียบเวลา)
 */
function getTimeMinutes(rawTime) {
  if (!rawTime) return -1;
  const d = new Date(rawTime);
  if (isNaN(d.getTime())) return -1;
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * สร้างโครงสร้างตารางข้อมูลสรุปกำลังคนแยกตามวันในเดือน
 */
function buildLocalSpreadsheetData(records, month, calMap = new Map()) {
  const result = { 'Total': {} };
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();

  for (let day = 1; day <= days; day += 1) {
    const dayStr = `${month}-${String(day).padStart(2, '0')}`;
    const key = String(day);
    const rows = records.filter((r) => !isOtherFactoryRecord(r) && String(r.dlh_effective_date_time || '').startsWith(dayStr));

    // วันทำงานจริงคือวันที่ใน tbl_date ระบุว่า working day หรือไม่ใช่ holiday
    const calResult = calMap.get(dayStr);
    const isWorkingCalendarDay = calResult ? calResult === 'working day' : rows.filter((r) => String(r.work_day_status || '').trim().toUpperCase() === 'W').length > 100;

    const ids = new Set(rows.map((r) => String(r.dlh_employee_id || '').trim()).filter(Boolean));
    const attend = new Set(rows.filter(shouldCountAsPresent).map((r) => String(r.dlh_employee_id || '').trim()));
    // ไม่นับคนไปช่วยงาน (Help Out / Loan Out) เป็นคนขาด ตามกฎของ MANPOWER DASHBOARD
    const absent = isWorkingCalendarDay
      ? new Set(
          rows
            .filter((r) => {
              const hasHelp = Boolean(r.line_in || r.loan_destination || r.is_loan_exclude || (Number(r.help_hour) || 0) > 0);
              return !hasHelp && shouldCountAsAbsent(r, isWorkingCalendarDay);
            })
            .map((r) => String(r.dlh_employee_id || '').trim())
        )
      : new Set();
    const ot = new Set(rows.filter((r) => Number(r.OT || 0) > 0).map((r) => String(r.dlh_employee_id || '').trim()));
    result.Total[key] = {
      opRegister: ids.size,
      swipeCards: attend.size,
      notWorking: absent.size,
      manOT1: ot.size,
      manOT2: 0,
      sourceRecordCount: rows.length,
    };
  }
  return result;
}

// ==============================================
// ✅ ค่าคงที่กลาง
// ==============================================
// แผนก Direct ที่แสดงเป็นแท่งของกราฟ (5 แผนกหลักตามหน้า UI)
const DEPARTMENTS = ['QA', 'FPC', 'SMT_F', 'SMT_B', 'MDS'];

// กลุ่มตามตาราง
const GROUPS = ['indirect1', 'indirect2', 'qa', 'direct1', 'direct2'];

// ✅ แผนกย่อยแบ่งตามกลุ่มหลัก
const DEPT_SUB_GROUPS = {
  QA: ['QA IND', 'QA FPC', 'QA SMT', 'QA MDS'],
  FPC: ['TSTE', 'TECH', 'EXC_FPC', 'MATERIAL', 'HOT PRESS', 'VACUUM', 'BLK', 'F-LAM', 'OST', 'AVI / K2', 'LINE A', 'LINE B', 'LINE C', 'LINE D'],
  SMT_F: ['TSTE-F', 'TECH-F', 'REW', 'X-RAY', 'MOT', 'AIX-MOT', 'MAT'],
  SMT_B: ['TSTE-B', 'TECH-B', 'EXC_SMT', 'ASY1', 'ASY2', 'ASY3', 'AELT', 'LAM', 'BLK', 'LAM MD', 'MDLAM', 'AIX-BLK', 'AIX-ASY'],
  MDS: ['MDS-TS', 'MDS'],
};

// ✅ การแมป Indirect 1 / Indirect 2 ตามโครงสร้างฝ่าย
const INDIRECT_FORMULA_GROUPS = {
  indirect1: ['HR', 'ACCT', 'STR', 'SE', 'SHE', 'AUT', 'PLN', 'PTE', 'NPM', 'FPS',
    'QA IND', 'QA FPC', 'QA SMT', 'QA MDS'],
  indirect2: ['LOG', 'DIE', 'FIXTURE'],
};

const GROUP_TO_FORMULA_GROUP = {
  QA: 'indirect1',
  FPC: 'direct1',
  SMT_F: 'direct1',
  SMT_B: 'direct2',
  MDS: 'direct2',
};

function normalizeDeptLabel(value) {
  return String(value || '').toUpperCase().replace(/[\s_/-]+/g, '');
}

function getDeptGroup(description) {
  const value = normalizeDeptLabel(description);
  if (/SMT|ASY|AIXBLK|AIXASY|LAMMD|MDLAM/.test(value)) return 'SMT_B';
  if (/TSTE-F|TECH-F|REW|XRAY|AIX-MOT/.test(String(description || '').toUpperCase())) return 'SMT_F';
  for (const [group, labels] of Object.entries(DEPT_SUB_GROUPS)) {
    if (labels.some((label) => value.includes(normalizeDeptLabel(label)))) return group;
  }
  return '';
}

function getFormulaGroup(category, description) {
  const categoryKey = normalizeDeptLabel(category);
  for (const [group, labels] of Object.entries(INDIRECT_FORMULA_GROUPS)) {
    if (labels.some((label) => categoryKey === normalizeDeptLabel(label))) return group;
  }
  return GROUP_TO_FORMULA_GROUP[getDeptGroup(description)] || '';
}

// แท็บประเภท
const TABS = ['pln', 'pte', 'fps', 'nfm', 'mps', 'dc', 'mqi'];

// กลุ่ม M_Support OT FRD
const SUPPORT_OT_GROUPS = ['MPS', 'MOU', 'DC', 'PER'];

// ✅ SUPPORT_DEPT_GROUPS (ตรงตามโครงสร้างภาพอ้างอิง: Indirect 1, Indirect 2, Direct 1 = FPC, Direct 2 = SMT_F, SMT_B)
const SUPPORT_DEPT_GROUPS = {
  MPS: {
    indirect1: ['HR', 'ACCT', 'STR', 'SE', 'SHE', 'AUT', 'PLN', 'PTE', 'FPS', 'NPM', 'QA', 'QA IND', 'QA FPC', 'QA SMT', 'QA MDS'],
    indirect2: ['LOG', 'DIE', 'FIXTURE', 'FIX', 'MAT', 'TECH', 'TSTE'],
    direct1: ['FPC'],
    direct2: ['SMT_F', 'SMT_B'],
  },
  MOU: {
    indirect1: ['HR', 'ACCT', 'STR', 'SE', 'SHE', 'AUT', 'PLN', 'PTE', 'FPS', 'NPM', 'QA', 'QA IND', 'QA FPC', 'QA SMT', 'QA MDS'],
    indirect2: ['LOG', 'DIE', 'FIXTURE', 'FIX', 'MAT', 'TECH', 'TSTE'],
    direct1: ['FPC'],
    direct2: ['SMT_F', 'SMT_B', 'MDS'],
  },
  DC: {
    indirect1: ['HR', 'ACCT', 'STR', 'SE', 'SHE', 'AUT', 'PLN', 'PTE', 'FPS', 'NPM', 'QA', 'QA IND', 'QA FPC', 'QA SMT', 'QA MDS'],
    indirect2: ['LOG', 'DIE', 'FIXTURE', 'FIX', 'MAT', 'TECH', 'TSTE'],
    direct1: ['FPC'],
    direct2: ['SMT_F', 'SMT_B', 'MDS'],
  },
  PER: {
    indirect1: ['HR', 'ACCT', 'STR', 'SE', 'SHE', 'AUT', 'PLN', 'PTE', 'FPS', 'NPM', 'QA', 'QA IND', 'QA FPC', 'QA SMT', 'QA MDS'],
    indirect2: ['LOG', 'DIE', 'FIXTURE', 'FIX', 'MAT', 'TECH', 'TSTE'],
    direct1: ['FPC'],
    direct2: ['SMT_F', 'SMT_B', 'MDS'],
  },
};

function getSupportDeptGroup(supportType, dept) {
  const map = SUPPORT_DEPT_GROUPS[supportType];
  if (!map) return '';
  return Object.entries(map).find(([, departments]) => departments.includes(dept))?.[0] || '';
}

// ✅ แมป COC (Cost Center Code)
const COC_TO_DEPT_GROUP = {
  // INDIRECT (P140 - P370)
  P140: 'HR', P150: 'ACCT', P160: 'STR', P170: 'LOG', P180: 'SE', P220: 'SHE',
  P282: 'AUT', P310: 'PLN', P340: 'PTE', P362: 'DIE', P363: 'FIXTURE', P366: 'NPM', P370: 'FPS',
  // QA (P330 - P334)
  P330: 'QA', P331: 'QA', P332: 'QA', P334: 'QA',
  // FPC (P460, P462)
  P460: 'FPC', P462: 'FPC',
  // SMT_F (P500, P510, P540, P550)
  P510: 'SMT_F', P540: 'SMT_F', P550: 'SMT_F',
  // SMT_B (P520, P560)
  P520: 'SMT_B', P560: 'SMT_B',
  // MDS (P700, P764)
  P700: 'MDS', P764: 'MDS',
};

// ✅ แมปชื่อแผนกหลัก/ย่อย
const DEPT_TO_GROUP = {
  // Indirect 1 
  HR: 'indirect1', ACCT: 'indirect1', STR: 'indirect1', SE: 'indirect1',
  SHE: 'indirect1', AUT: 'indirect1', PLN: 'indirect1', PTE: 'indirect1',
  NPM: 'indirect1', FPS: 'indirect1',
  QA: 'indirect1', 'QA IND': 'indirect1', 'QA FPC': 'indirect1',
  'QA SMT': 'indirect1', 'QA MDS': 'indirect1',
  // แผนก Indirect 2
  LOG: 'indirect2', DIE: 'indirect2', FIXTURE: 'indirect2',
  // แผนก Direct
  FPC: 'direct1', SMT_F: 'direct1',
  SMT_B: 'direct2', MDS: 'direct2',
};

// ✅ แม็พ fallback สำหรับ status / cost center
const GROUP_MAP = {
  ...DEPT_TO_GROUP,
  NFM: 'nfm', MPS: 'mps', MOU: 'mps', DC: 'dc', PER: 'mqi',
};

const DEPT_NORMALIZE = {
  QA: 'QA', QUALITY: 'QA', FPC: 'FPC',
  'SMT-F': 'SMT_F', 'SMT F': 'SMT_F', 'SMT-FRONT': 'SMT_F', SMT_FRONT: 'SMT_F',
  'SMT-B': 'SMT_B', 'SMT B': 'SMT_B', 'SMT-BACK': 'SMT_B', SMT_BACK: 'SMT_B',
  MDS: 'MDS', 'MDS-TS': 'MDS', MDS_TS: 'MDS', 'MDS TS': 'MDS',
};

function normalizeDepartment(value) {
  const raw = String(value || '').trim().toUpperCase();
  return DEPT_NORMALIZE[raw] || (raw.startsWith('MDS') ? 'MDS' : raw);
}

let dbLineMappingsCache = null;
let lastDbMappingFetch = 0;
const DB_MAPPING_TTL = 60 * 1000; // 1 minute

async function getDbLineMappings() {
  const now = Date.now();
  if (dbLineMappingsCache && (now - lastDbMappingFetch < DB_MAPPING_TTL)) {
    return dbLineMappingsCache;
  }
  try {
    const res = await pool_test.query(`
      SELECT group_name, dept_name, coc_code, keywords, order_seq
      FROM daily_matrix_line_mappings
      WHERE is_active = true
      ORDER BY order_seq ASC
    `);
    dbLineMappingsCache = res.rows || [];
    lastDbMappingFetch = now;
  } catch (err) {
    console.warn('⚠️ [deptSummary] Could not load daily_matrix_line_mappings:', err.message);
    if (!dbLineMappingsCache) dbLineMappingsCache = [];
  }
  return dbLineMappingsCache;
}

function inferDepartment(employee) {
  const source = [employee.department, employee.line, employee.dept]
    .map((value) => String(value || '').toUpperCase())
    .join(' | ');

  // 1. ตรวจสอบคำเฉพาะทางที่ระบุสายงานชัดเจนเป็นอันดับแรก (Priority High)
  // สายงานประกอบ (Assembly: ASY1, ASY2, ASY3, AELT) สังกัด SMT_B แน่นอน แม้ใน COC จะเป็น P540 หรืออื่นๆ
  if (/\bASY[1-3]|\bAELT\b|\bLAM[-_ ]?MD\b|\bMDLAM\b|\bAIX[-_ ]?BLK\b|\bAIX[-_ ]?ASY\b|\bTSTE[-_ ]?B\b|\bS_TSTE[-_ ]?B\b|\bTECH[-_ ]?B\b|\bEXC[-_ ]?SMT\b/i.test(source)) {
    return 'SMT_B';
  }
  if (/\bEXC[-_ ]?FPC\b|\bHOT[-_ ]?PRESS\b|\bVACUUM\b|\bF-LAM\b|\bOST\b|\bAVI\b/i.test(source)) {
    return 'FPC';
  }
  if (/\bTSTE[-_ ]?F\b|\bS_TSTE[-_ ]?F\b|\bTECH[-_ ]?F\b|\bREW\b|\bX-?RAY\b|\bAIX[-_ ]?MOT\b/i.test(source)) {
    return 'SMT_F';
  }

  // 2. ตรวจสอบ Cost Center Code (COC) เช่น P460, P500, P330, P764
  const cocMatch = source.match(/\bP\d{3,4}\b/);
  if (cocMatch) {
    const coc = cocMatch[0];
    if (coc === 'P460' || coc === 'P462') return 'FPC';
    if (coc === 'P500') {
      // P500 มีทั้ง SMT_F (TSTE-F, TECH-F) และ SMT_B (TSTE-B, TECH-B, EXC_SMT)
      if (source.includes('-F') || source.includes('_F') || source.includes('FRONT') || source.includes('SMT-F') || source.includes('SMT_F')) return 'SMT_F';
      return 'SMT_B';
    }
    if (coc === 'P700' || coc === 'P764') return 'MDS';
    if (COC_TO_DEPT_GROUP[coc]) {
      return COC_TO_DEPT_GROUP[coc];
    }
  }

  // 3. ตรวจสอบจากการ Mapping ในฐานข้อมูล (Manage Mappings)
  if (dbLineMappingsCache && dbLineMappingsCache.length > 0) {
    // เรียง Keyword ที่มีความยาวมากกว่าก่อน เพื่อป้องกัน keyword สั้น (เช่น TSTE) แย่งคำยาว (เช่น TSTE-F)
    for (const m of dbLineMappingsCache) {
      const kws = Array.isArray(m.keywords) ? m.keywords : [];
      const isMatch = kws.some((kw) => {
        const cleanKw = String(kw || '').trim().toUpperCase();
        if (!cleanKw) return false;
        // ป้องกัน keyword TSTE ไปตรงกับ TSTE-F หรือ TSTE-B
        if (cleanKw === 'TSTE' && (source.includes('TSTE-F') || source.includes('TSTE_F') || source.includes('TSTE-B') || source.includes('TSTE_B') || source.includes('SMT'))) return false;
        if (cleanKw === 'TECH' && (source.includes('TECH-F') || source.includes('TECH_F') || source.includes('TECH-B') || source.includes('TECH_B') || source.includes('SMT'))) return false;
        if (cleanKw === 'EXCESS' && source.includes('SMT')) return false;
        return source.includes(cleanKw);
      });
      if (isMatch) {
        const grp = String(m.group_name || '').trim().toUpperCase();
        if (grp === 'SMT_B' || grp === 'SMT_F' || grp === 'FPC' || grp === 'QA' || grp === 'MDS') {
          return grp;
        }
        if (m.dept_name && DEPT_TO_GROUP[m.dept_name.toUpperCase()]) {
          return m.dept_name.toUpperCase();
        }
      }
    }
  }

  // 3. จัดการกรณี TSTE / TECH / MAT ที่ไม่มี -F หรือ -B
  if (/\bTSTE\b|\bTECH\b|\bEXC\b|\bMAT\b|\bMATERIAL\b/i.test(source)) {
    if (source.includes('FPC')) return 'FPC';
    if (source.includes('SMT')) return 'SMT_B';
  }

  const declared = normalizeDepartment(employee.dept);
  if (declared === 'MDS') return 'MDS';
  if (/\bMDS\b|MDS[-_ ]TS|LAM\s*\/\s*MDS/.test(source)) return 'MDS';
  return declared;
}

const CACHE_TTL_MS = 60 * 1000; // 1 minute in-memory cache for fast response
const router = express.Router();
const cache = new Map();

// Note: Disabled automatic disk prewarm loop so stale files are never restored into memory.

// ==============================================
// ✅ โหลดข้อมูล + นับคนทะเบียนรายแผนก (วิธีที่ 1)
// ==============================================
async function loadStandaloneRecords(month) {
  // โหลดหรือรีเฟรช Line Mapping จาก Database Test ให้พร้อมใช้งานเสมอ
  await getDbLineMappings().catch(() => {});

  // ดึงปฏิทินวันทำงาน / วันหยุดจาก tbl_date ด้วย queryWithRetryPool1
  const calendarRows = await queryWithRetryPool1(`
    SELECT DATE_FORMAT(work_date, '%Y-%m-%d') AS w_date,
           CASE
             WHEN MAX(CASE WHEN LOWER(TRIM(COALESCE(w_result, ''))) = 'holiday' THEN 1 ELSE 0 END) = 1
               THEN 'holiday'
             ELSE LOWER(TRIM(COALESCE(MAX(w_result), '')))
           END AS w_result
    FROM (
      SELECT
        CASE
          WHEN CAST(w_date AS CHAR) REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN
            CASE
              WHEN YEAR(STR_TO_DATE(CAST(w_date AS CHAR), '%d/%m/%Y')) > 2400
                THEN DATE_SUB(STR_TO_DATE(CAST(w_date AS CHAR), '%d/%m/%Y'), INTERVAL 543 YEAR)
              ELSE STR_TO_DATE(CAST(w_date AS CHAR), '%d/%m/%Y')
            END
          ELSE DATE(w_date)
        END AS work_date,
        w_result
      FROM tbl_date
    ) calendar_source
    WHERE work_date >= ?
      AND work_date < DATE_ADD(?, INTERVAL 1 MONTH)
    GROUP BY work_date
    ORDER BY work_date
  `, [`${month}-01`, `${month}-01`]).catch(() => []);
  const calMap = new Map();
  (Array.isArray(calendarRows) ? calendarRows : (calendarRows?.rows || [])).forEach((r) => {
    if (r.w_date) calMap.set(String(r.w_date), String(r.w_result || ''));
  });

  const attendance = await queryWithRetry(`
    SELECT DISTINCT ON (a.dlh_employee_id, a.dlh_effective_date_time::date)
           a.dlh_employee_id, a.dlh_effective_date_time, a.work_day_status,
           a.work_status, a.scan_time_in, a.scan_time_out
    FROM smart.smart_man_time_attendance a
    WHERE a.dlh_effective_date_time >= $1
      AND a.dlh_effective_date_time < ($1::date + INTERVAL '1 month')::text
      AND a.dlh_employee_id IS NOT NULL
      AND TRIM(a.dlh_employee_id) != ''
    ORDER BY a.dlh_employee_id, a.dlh_effective_date_time::date, a.updated_date DESC
  `, [`${month}-01`]);
  const rows = Array.isArray(attendance) ? attendance : (attendance?.rows || []);

  const allEmployees = await pool_ot.query(`
    SELECT h.code, h.name, h.department, h.dept, h.shift, h.line,
           e.status
    FROM tbl_employee_help h
    LEFT JOIN tbl_employee e ON h.code = e.code
  `).catch(() => []);
  const empRows = Array.isArray(allEmployees) ? allEmployees : (allEmployees?.rows || []);
  const employeeMap = new Map(empRows.map((employee) => [
    String(employee.code || '').trim(), employee,
  ]));

  // ✅ วิธีที่ 1: นับคนทะเบียนรายแผนกสดจาก tbl_employee_help
  const registeredByDept = {};
  let registeredDirectCount = 0;
  let registeredIndirectCount = 0;
  let registeredTotalCount = 0;

  empRows.forEach((emp) => {
    const dept = inferDepartment(emp);
    registeredByDept[dept] = (registeredByDept[dept] || 0) + 1;
    registeredTotalCount += 1;
    if (DEPARTMENTS.includes(dept)) {
      registeredDirectCount += 1;
    } else {
      registeredIndirectCount += 1;
    }
  });

  if (registeredDirectCount === 0 || registeredTotalCount === 0) {
    console.warn('⚠️ tbl_employee_help ดึงข้อมูลไม่ได้ หรือนับคนได้ 0 คน!');
  }

  // ✅ ฟังก์ชันช่วย: คำนวณ Planned Manpower รวมตามกลุ่ม (ใช้ชื่อแผนกจริงใน DB)
  const getPlannedByGroup = (deptList) =>
    deptList.reduce((sum, dept) => sum + (registeredByDept[dept] || 0), 0);

  // ✅ คำนวณ Planned Manpower จากแผนกใหญ่ที่ตรงกับข้อมูลจริงใน tbl_employee
  const plannedManpower = {
    indirect1: getPlannedByGroup(['HR', 'ACCT', 'STR', 'SE', 'SHE', 'AUT', 'PLN', 'PTE', 'NPM', 'FPS', 'QA', 'QA IND', 'QA FPC', 'QA SMT', 'QA MDS']),
    indirect2: getPlannedByGroup(['LOG', 'DIE', 'FIXTURE']),
    qa: getPlannedByGroup(['QA', 'QA IND', 'QA FPC', 'QA SMT', 'QA MDS']),
    direct1: getPlannedByGroup(['FPC', 'SMT_F']),
    direct2: getPlannedByGroup(['SMT_B', 'MDS']),
  };
  plannedManpower.totalIndirect = plannedManpower.indirect1 + plannedManpower.indirect2;
  plannedManpower.totalDirect = plannedManpower.direct1 + plannedManpower.direct2;
  plannedManpower.total = plannedManpower.totalIndirect + plannedManpower.totalDirect;

  const loanRows = await pool_test.query(
    `SELECT employee_id, destination, department, start_date, end_date
     FROM manpower_loan_exclude
     WHERE is_active = true OR is_active::text = '1' OR is_active::text ILIKE 'true'`
  ).then(r => r.rows || []).catch(err => {
    console.warn('[deptSummary] Unable to load manpower_loan_exclude:', err.message);
    return [];
  });

  const parseLoanDate = (d) => {
    if (!d) return '';
    try {
      const dt = d instanceof Date ? d : new Date(d);
      if (isNaN(dt.getTime())) return '';
      return new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Bangkok',
      }).format(dt);
    } catch {
      return String(d).slice(0, 10);
    }
  };

  const loanByEmpMap = new Map();
  (loanRows || []).forEach((l) => {
    const empId = String(l.employee_id || '').trim();
    if (!empId) return;
    const list = loanByEmpMap.get(empId) || [];
    list.push({
      destination: l.destination || '',
      sDate: parseLoanDate(l.start_date),
      eDate: parseLoanDate(l.end_date),
    });
    loanByEmpMap.set(empId, list);
  });

  return {
    records: rows.map((row) => {
      const empId = String(row.dlh_employee_id || '').trim();
      const employee = employeeMap.get(empId) || {};
      const workStatus = String(row.work_status || '').trim();
      const inMinutes = getTimeMinutes(row.scan_time_in);
      const outMinutes = getTimeMinutes(row.scan_time_out);
      let calculatedShift = '';
      if (inMinutes >= 2 * 60 && inMinutes <= 14 * 60) {
        calculatedShift = 'D/S';
      } else if ((inMinutes >= 18 * 60 && inMinutes < 24 * 60) || (inMinutes >= 0 && inMinutes < 2 * 60)) {
        calculatedShift = 'N/S';
      } else if (inMinutes === -1 && outMinutes >= 19 * 60) {
        calculatedShift = 'D/S';
      } else if (employee.shift) {
        const standardShift = String(employee.shift).trim().toUpperCase();
        if (standardShift === 'D' || standardShift === 'D/S' || standardShift === 'A') {
          calculatedShift = 'D/S';
        } else if (standardShift === 'N' || standardShift === 'N/S' || standardShift === 'B') {
          calculatedShift = 'N/S';
        }
      }

      const dateKey = String(row.dlh_effective_date_time || '').slice(0, 10);
      const calendarResult = calMap.get(dateKey);
      let effectiveWorkDayStatus = calendarResult === 'holiday'
        ? 'H'
        : calendarResult === 'working day'
          ? 'W'
          : row.work_day_status;

      const isSunday = new Date(`${dateKey}T00:00:00`).getDay() === 0;
      const isSundayOrHoliday = effectiveWorkDayStatus === 'H' || calendarResult === 'holiday' || isSunday;

      let ot = 0;
      if (isSundayOrHoliday) {
        let isFullOt = true;
        if (inMinutes >= 0 && outMinutes >= 0) {
          let dur = outMinutes - inMinutes;
          if (dur < 0) dur += 24 * 60;
          if (dur < 6 * 60) isFullOt = false;
        }
        ot = (isFullOt && (inMinutes >= 0 || outMinutes >= 0 || workStatus === 'P')) ? 3 : 0;
      } else if (calculatedShift === 'D/S') {
        ot = (outMinutes >= 19 * 60 + 50 || (outMinutes >= 0 && outMinutes <= 5 * 60 && inMinutes >= 2 * 60)) ? 3 : 0;
      } else if (calculatedShift === 'N/S') {
        ot = (outMinutes >= 7 * 60 + 50 && outMinutes <= 12 * 60) ? 3 : 0;
      }

      const empLoans = loanByEmpMap.get(empId);
      const matchingLoan = empLoans ? empLoans.find((l) => {
        if (l.sDate && dateKey < l.sDate) return false;
        if (l.eDate && dateKey > l.eDate) return false;
        return true;
      }) : null;
      const isLoanExclude = Boolean(matchingLoan);
      if (isLoanExclude && !String(effectiveWorkDayStatus || '').startsWith('1N')) {
        effectiveWorkDayStatus = `1N${String(effectiveWorkDayStatus || 'W').replace(/^1N/i, '')}`;
      }

      return {
        ...row,
        work_day_status: effectiveWorkDayStatus,
        name: employee.name || '',
        department: employee.department || '',
        emp_department: employee.department || '',
        status: employee.status || '',
        dept: inferDepartment(employee),
        Shift: calculatedShift,
        shift_h: employee.shift || '',
        line: employee.line || '',
        Work: workStatus === 'Normal' || workStatus === 'Abnormal' ? 8 : 0,
        OT: ot,
        loan_destination: matchingLoan?.destination || '',
        is_loan_exclude: isLoanExclude,
      };
    }),
    registeredDirect: registeredDirectCount,
    registeredIndirect: registeredIndirectCount,
    registeredTotal: registeredTotalCount,
    registeredByDept,
    plannedManpower,
    calMap,
  };
}

function inferSupportType(status) {
  const s = String(status || '').trim().toUpperCase();
  if (s === 'VDS' || s === 'PIMB' || s === 'MPS') return 'MPS';
  if (s === 'MOU') return 'MOU';
  if (s === 'DC') return 'DC';
  if (s === 'PER' || s === 'PERMANENT') return 'PER';
  return '';
}

// ==============================================
// ✅ แนบ deptType + group + status เข้าไปในแต่ละ record
// ==============================================
async function addDeptSummaryAttributes(records) {
  const result = await pool_smart.query(`
    SELECT mhr_cc_desc, MAX(mhr_cc_type) AS type
    FROM smart.smart_man_cc_master_mhr
    GROUP BY mhr_cc_desc
  `);
  const masterList = (result.rows || []).map((row) => ({
    desc: String(row.mhr_cc_desc || '').trim(),
    descUpper: String(row.mhr_cc_desc || '').trim().toUpperCase(),
    type: String(row.type || '').trim().toUpperCase(),
  }));

  const metaByDept = new Map((result.rows || []).map((row) => {
    const description = String(row.mhr_cc_desc || '').trim();
    const separator = description.indexOf('|');
    const dept = (separator >= 0 ? description.slice(separator + 1) : description).trim().toUpperCase();
    const category = (separator >= 0 ? description.slice(0, separator) : description).trim().toUpperCase();
    const type = String(row.type || '').trim().toUpperCase();
    const categoryKey = Object.keys(GROUP_MAP).find((key) =>
      category === key || category.startsWith(`${key}_`) || category.startsWith(`${key}-`),
    );
    const mappedGroup = getFormulaGroup(category, description);
    return [dept, {
      type,
      mappedGroup,
      group: mappedGroup || DEPT_TO_GROUP[dept] || GROUP_MAP[categoryKey] || GROUP_MAP[type] || 'other',
    }];
  }));

  /**
   * คำนวณ mhr_cc_type ตามสูตร DAX:
   * 1. ตรวจสอบชื่อเต็ม (_FullDept) ใน mhr_cc_desc
   * 2. ตรวจสอบชื่อหลัง '/' (_SubDept) ใน mhr_cc_desc
   * 3. ตรวจสอบ _LineCheck ใน mhr_cc_desc
   */
  const ccTypeCache = new Map();
  const getMhrCcType = (fullDeptRaw, lineCheckRaw) => {
    const fullDept = String(fullDeptRaw || '').trim();
    if (!fullDept) return null;
    const lineCheck = String(lineCheckRaw || '').trim();
    const cacheKey = `${fullDept}___${lineCheck}`;
    if (ccTypeCache.has(cacheKey)) return ccTypeCache.get(cacheKey);

    const fullDeptUpper = fullDept.toUpperCase();
    let result = null;

    // สเต็ป 1: ลองจับด้วยชื่อเต็มก่อน (เช่น P466-2B/PB_LAM-N)
    const matchFull = masterList.find((m) => m.descUpper.includes(fullDeptUpper));
    if (matchFull) {
      result = matchFull.type;
    } else {
      // สเต็ป 2: ถ้าไม่เจอ ให้จับด้วยท่อนหลัง '/' (เช่น PB_LAM-N)
      const slashIdx = fullDept.indexOf('/');
      const subDept = (slashIdx >= 0 ? fullDept.slice(slashIdx + 1) : fullDept).trim().toUpperCase();
      if (subDept) {
        const matchSub = masterList.find((m) => m.descUpper.includes(subDept));
        if (matchSub) result = matchSub.type;
      }

      // สเต็ป 3: ถ้ายังไม่เจอ ให้ลองเทียบกับ line_check
      if (!result && lineCheck) {
        const lineCheckUpper = lineCheck.toUpperCase();
        const matchLine = masterList.find((m) => m.descUpper.includes(lineCheckUpper));
        if (matchLine) result = matchLine.type;
      }
    }

    ccTypeCache.set(cacheKey, result);
    return result;
  };

  return records.map((r) => {
    const dept = inferDepartment(r);
    const meta = metaByDept.get(dept) || { type: 'OTHER', group: 'other', mappedGroup: '' };
    const rawStatus = String(r.status || '').trim().toUpperCase();
    // ✅ แม็พ status VDS, PIMB → MPS เฉพาะคนที่มีสถานะจริงเท่านั้น (ไม่ fallback เป็น MPS มั่วๆ)
    const supportType = inferSupportType(rawStatus);
    const deptType = supportType || '';

    // ✅ คำนวณ mhr_cc_type ตาม DAX ลอจิก
    const fullDept = r.emp_department || r.department || r.dept || '';
    const lineCheck = r.line_check || r.line || '';
    const daxMhrCcType = getMhrCcType(fullDept, lineCheck) || meta.type || null;

    return {
      ...r,
      dept,
      deptType,
      supportType,
      supportDeptGroup: getSupportDeptGroup(supportType, dept),
      // ✅ ให้ความสำคัญกับ DEPT_TO_GROUP[dept] (ที่ infer ตาม COC แล้ว) ก่อน fallback ไปยัง deptType
      group: DEPT_TO_GROUP[dept] || meta.mappedGroup || GROUP_MAP[deptType] || meta.group,
      mhr_cc_type: daxMhrCcType,
      status: r.status ?? null,
    };
  });
}

function dateParts(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day) ? null : { year, month, day };
}

function round(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

const emptyBucket = () => ({ people: 0, absent: 0, present: 0, otPeople: 0, workHrs: 0, otHrs: 0 });

function toPct(bucket, globalPeople, globalAttend, globalWorkHrs, globalOtHrs) {
  const totalHrs = bucket.workHrs + bucket.otHrs;
  return {
    ...bucket,
    attend: bucket.people - bucket.absent,
    leavePct: round(bucket.people ? (bucket.absent / bucket.people) * 100 : 0),
    otPct: round(bucket.people
      ? (bucket.otPeople / bucket.people) * 100
      : 0),
    leaveShare: round(globalPeople ? (bucket.absent / globalPeople) * 100 : 0),
    otShare: round(globalPeople > 0
      ? (bucket.otPeople / globalPeople) * 100
      : 0),
  };
}

// ==============================================
// ✅ ฟังก์ชัน build() - รวมแนวทางที่ 2 (QA แสดงในกราฟทั้งสองหน้า)
// ==============================================
function build(records, month, includeIndirect, registeredDirect = 1, registeredIndirect = 1, registeredTotal = 1, plannedManpower = null, spreadsheetData = null, calMap = null) {
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();

  const daySchema = (index) => ({
    day: index + 1,
    date: `${month}-${String(index + 1).padStart(2, '0')}`,
    depts: Object.fromEntries(DEPARTMENTS.map((d) => [d, emptyBucket()])),
    groups: Object.fromEntries(GROUPS.map((g) => [g, emptyBucket()])),
    tabs: Object.fromEntries(TABS.map((t) => [t, emptyBucket()])),
    indirect: emptyBucket(),
    supportGroups: Object.fromEntries(SUPPORT_OT_GROUPS.map((g) => [g, {
      total: emptyBucket(),
      byDept: Object.fromEntries([...DEPARTMENTS, 'Indirect'].map((d) => [d, emptyBucket()])),
      byGroup: Object.fromEntries(['indirect1', 'indirect2', 'direct1', 'direct2'].map((d) => [d, emptyBucket()])),
    }])),
    supportOtPeople: 0,
    total: emptyBucket(),
    planned: plannedManpower ? { ...plannedManpower } : null,
  });

  const result = Array.from({ length: daysInMonth }, (_, i) => daySchema(i));
  const buckets = result.map(() => new Map());

  // นับรายคน (นับทุกคนในโรงงานเพื่อหายอดคนทั้งหมดของวันนั้นเสมอ ยกเว้นคนที่ไปช่วย Factory อื่น)
  records.forEach((record) => {
    if (isOtherFactoryRecord(record)) return;

    const dept = normalizeDepartment(record.dept);
    const isDirect5Dept = DEPARTMENTS.includes(dept);
    const recordIsOtherIndirect = !isDirect5Dept;

    const date = dateParts(record.dlh_effective_date_time || record.effective_date_time);
    if (!date || date.year !== year || date.month !== monthNumber) return;
    const id = String(record.dlh_employee_id || record.employee_id || '').trim();
    if (!id) return;

    const deptType = String(record.deptType || '').trim().toUpperCase();
    const group = String(record.group || DEPT_TO_GROUP[dept] || GROUP_MAP[deptType] || 'other');
    const isIndirect = recordIsOtherIndirect;
    const isSupport = SUPPORT_OT_GROUPS.includes(deptType);
    const isHoliday = isHolidayStatus(record.work_day_status);
    const hasHelp = Boolean(record.line_in || record.loan_destination || record.is_loan_exclude || (Number(record.help_hour) || 0) > 0);
    const absent = !hasHelp && !isHoliday && shouldCountAsAbsent(record);
    const present = shouldCountAsPresent(record);
    const ot = Number(record.OT) || 0;
    const work = Number(record.Work) || 0;

    const dayBucket = buckets[date.day - 1];
    const person = dayBucket.get(id) || {
      dept, group, deptType,
      supportType: record.supportType || deptType,
      supportDeptGroup: record.supportDeptGroup || '',
      isIndirect, isSupport,
      absent: false, present: false, ot: 0, work: 0,
    };
    person.absent ||= absent;
    person.present ||= present;
    person.ot = Math.max(person.ot, ot);
    person.work = Math.max(person.work, work);
    dayBucket.set(id, person);
  });

  // ✅ วิธีที่ 2: เตรียมตัวแปรสำหรับคำนวณค่าสูงสุด Max Attendance
  const maxPeopleByGroup = {};
  GROUPS.forEach(g => { maxPeopleByGroup[g] = 0; });
  let maxTotalPeople = 0;
  let maxIndirectPeople = 0;

  // รวมผล + คำนวณเปอร์เซ็นต์
  result.forEach((day, index) => {
    buckets[index].forEach((person) => {
      const hasOt = person.ot > 0;
      const isAbsent = person.absent && !person.present;
      const addTo = (bucket) => {
        bucket.people += 1;
        if (isAbsent) bucket.absent += 1;
        if (person.present) bucket.present += 1;
        if (hasOt) bucket.otPeople += 1;
        bucket.workHrs += person.work;
        bucket.otHrs += person.ot;
      };

      // ✅ ทุกแผนกใน DEPARTMENTS ให้นับเข้า day.depts เสมอ (รวม QA ด้วย)
      if (day.depts[person.dept]) {
        addTo(day.depts[person.dept]);
        addTo(day.total);
      } else if (person.isIndirect) {
        // แผนก Indirect อื่นๆ นอกเหนือจาก 5 แผนกหลัก
        addTo(day.indirect);
        addTo(day.total);
      }

      if (day.groups[person.group]) addTo(day.groups[person.group]);
      if (day.tabs[person.group]) addTo(day.tabs[person.group]);
      if (person.isSupport && hasOt) day.supportOtPeople += 1;

      const supportType = person.supportType || '';
      if (supportType && day.supportGroups[supportType]) {
        const sg = day.supportGroups[supportType];
        addTo(sg.total);
        const seg = person.isIndirect ? sg.byDept.Indirect : sg.byDept[person.dept];
        if (seg) addTo(seg);
        if (person.supportDeptGroup && sg.byGroup[person.supportDeptGroup]) {
          addTo(sg.byGroup[person.supportDeptGroup]);
        }
      }
    });

    // 🌟 ซิงค์ยอดรวมทั้งโรงงาน (Total P1) ให้ตรงกับยอด Manpower Dashboard (Macro PCN) เสมอ
    const macroDayData = spreadsheetData?.['Macro PCN']?.[String(index + 1)] || spreadsheetData?.Total?.[String(index + 1)];
    if (macroDayData && macroDayData.opRegister > 0) {
      day.total.people = macroDayData.opRegister;
      day.total.absent = macroDayData.notWorking;
      day.total.attend = macroDayData.swipeCards;
      day.total.otPeople = (macroDayData.manOT1 || 0) + (macroDayData.manOT2 || 0);
    }

    // ✅ อัปเดตค่าสูงสุด
    GROUPS.forEach(g => {
      maxPeopleByGroup[g] = Math.max(maxPeopleByGroup[g], day.groups[g]?.people || 0);
    });
    maxTotalPeople = Math.max(maxTotalPeople, day.total?.people || 0);
    maxIndirectPeople = Math.max(maxIndirectPeople, day.indirect?.people || 0);

    const { people, workHrs, otHrs } = day.total;
    const dayAttend = people - day.total.absent;
    const dayDirectPeople =
      (day.depts.QA?.people || 0) +
      (day.depts.FPC?.people || 0) +
      (day.depts.SMT_F?.people || 0) +
      (day.depts.SMT_B?.people || 0) +
      (day.depts.MDS?.people || 0);
    const dayTotalPeople = dayDirectPeople + (day.indirect?.people || 0);
    // ✅ Direct ใช้คน 5 แผนกหลักเป็นตัวหาร / Include Indirect ใช้คนทั้งโรงงานเป็นตัวหาร
    const denominator = includeIndirect
      ? (dayTotalPeople > 0 ? dayTotalPeople : 1)
      : (dayDirectPeople > 0 ? dayDirectPeople : 1);

    day.depts = Object.fromEntries(Object.entries(day.depts).map(([k, v]) => [k, toPct(v, denominator, dayAttend, workHrs, otHrs)]));
    day.groups = Object.fromEntries(Object.entries(day.groups).map(([k, v]) => [k, toPct(v, denominator, dayAttend, workHrs, otHrs)]));
    day.tabs = Object.fromEntries(Object.entries(day.tabs).map(([k, v]) => [k, toPct(v, denominator, dayAttend, workHrs, otHrs)]));
    day.indirect = toPct(day.indirect, denominator, dayAttend, workHrs, otHrs);
    day.total = toPct(day.total, denominator, dayAttend, workHrs, otHrs);

    // 🌟 เมื่อเป็น Total All P1 ให้ใช้ % Leave และ % OT ตรงตามยอด Macro PCN เป๊ะ 100%
    if (includeIndirect) {
      const exactLeavePct = day.total.people > 0 && day.total.absent > 0
        ? round((day.total.absent / day.total.people) * 100)
        : 0;
      const exactOtPct = day.total.people > 0 && day.total.otPeople > 0
        ? round((day.total.otPeople / day.total.people) * 100)
        : 0;
      day.total.leaveShare = exactLeavePct;
      day.total.leavePct = exactLeavePct;
      day.total.otShare = exactOtPct;
      day.total.otPct = exactOtPct;
    }
    day.supportOtPct = round(day.total.attend ? (day.supportOtPeople / day.total.attend) * 100 : 0);

    day.supportGroups = Object.fromEntries(Object.entries(day.supportGroups).map(([g, sg]) => {
      const dirPeople = DEPARTMENTS.reduce((sum, d) => sum + (sg.byDept[d]?.people || 0), 0);
      const dirAbsent = DEPARTMENTS.reduce((sum, d) => sum + (sg.byDept[d]?.absent || 0), 0);
      const dirOtPeople = DEPARTMENTS.reduce((sum, d) => sum + (sg.byDept[d]?.otPeople || 0), 0);
      const indPeople = sg.byDept.Indirect?.people || 0;
      const indAbsent = sg.byDept.Indirect?.absent || 0;
      const indOtPeople = sg.byDept.Indirect?.otPeople || 0;
      const totPeople = dirPeople + indPeople;
      const totAbsent = dirAbsent + indAbsent;
      const totOtPeople = dirOtPeople + indOtPeople;

      // ตัวหารสำหรับคำนวณสัดส่วนของแต่ละแผนก (Sheet 8 แถว 62-105 ใช้ Direct People เป็นตัวหาร)
      const shareDivisor = dirPeople > 0 ? dirPeople : 1;
      const totalDivisor = includeIndirect ? (totPeople > 0 ? totPeople : 1) : (dirPeople > 0 ? dirPeople : 1);

      const targetTotal = includeIndirect
        ? { people: totPeople, absent: totAbsent, otPeople: totOtPeople }
        : { people: dirPeople, absent: dirAbsent, otPeople: dirOtPeople };

      const total = {
        ...sg.total,
        ...targetTotal,
        leavePct: round((targetTotal.absent / totalDivisor) * 100),
        otPct: round((targetTotal.otPeople / totalDivisor) * 100),
        leaveShare: round((targetTotal.absent / totalDivisor) * 100),
        otShare: round((targetTotal.otPeople / totalDivisor) * 100),
      };

      const byDept = Object.fromEntries(Object.entries(sg.byDept).map(([d, b]) => {
        const dShare = round(((b.absent || 0) / shareDivisor) * 100);
        const dOtShare = round(((b.otPeople || 0) / totalDivisor) * 100);
        return [d, {
          ...b,
          leavePct: b.people > 0 ? round(((b.absent || 0) / b.people) * 100) : 0,
          otPct: b.people > 0 ? round(((b.otPeople || 0) / b.people) * 100) : 0,
          leaveShare: dShare,
          otShare: dOtShare,
        }];
      }));

      const byGroup = Object.fromEntries(Object.entries(sg.byGroup).map(([d, b]) => {
        return [d, toPct(b, totalDivisor, totalDivisor, b.workHrs, b.otHrs)];
      }));


      return [g, { total, byDept, byGroup, sumLeavePct: total.leavePct, sumOtPct: total.otPct }];
    }));

    // ✅ Leave Ratio ตามรายงานโรงงาน Sheet 8 (ผูกกับกลุ่ม PER พนักงานประจำ)
    const perSg = day.supportGroups?.PER;
    const perByDept = perSg?.byDept || {};
    const perDirectAbsent = DEPARTMENTS.reduce((sum, d) => sum + (perByDept[d]?.absent || 0), 0);
    const perDirectPeople = DEPARTMENTS.reduce((sum, d) => sum + (perByDept[d]?.people || 0), 0);
    const perIndirectAbsent = perByDept.Indirect?.absent || 0;
    const perIndirectPeople = perByDept.Indirect?.people || 0;
    const perTotalAbsent = perDirectAbsent + perIndirectAbsent;
    const perTotalPeople = perDirectPeople + perIndirectPeople;

    const perDirectSumLeave = perDirectPeople > 0 ? round((perDirectAbsent / perDirectPeople) * 100) : 0;
    const perTotalSumLeave = perTotalPeople > 0 ? round((perTotalAbsent / perTotalPeople) * 100) : 0;

    // Leave Share แต่ละแผนก (Sheet 8 แถว 62-67) คำนวณจาก Leave แผนกนั้น / Direct PER MP
    const perLeaveByDept = Object.fromEntries(DEPARTMENTS.map((d) => [
      d,
      perDirectPeople > 0 ? round(((perByDept[d]?.absent || 0) / perDirectPeople) * 100) : 0
    ]));
    const perIndirectLeave = perDirectPeople > 0 ? round((perIndirectAbsent / perDirectPeople) * 100) : 0;

    // อัปเดต leaveShare ใน day.depts และ day.indirect ให้ตรงกับ Sheet 8 เสมอ
    DEPARTMENTS.forEach((d) => {
      if (day.depts[d]) {
        day.depts[d].leaveShare = perLeaveByDept[d];
      }
    });
    if (day.indirect) {
      day.indirect.leaveShare = perIndirectLeave;
    }

    const directTotalPeople = DEPARTMENTS.reduce((sum, d) => sum + (day.depts[d]?.people || 0), 0);
    const directTotalOt = DEPARTMENTS.reduce((sum, d) => sum + (day.depts[d]?.otPeople || 0), 0);
    const directSumOt = directTotalPeople > 0 ? round((directTotalOt / directTotalPeople) * 100) : 0;

    const totalPeople = day.total.people || 0;
    const totalAbsent = day.total.absent || 0;
    const totalOt = day.total.otPeople || 0;
    day.overviewLeavePct = totalPeople > 0 ? round((totalAbsent / totalPeople) * 100) : 0;
    day.overviewOtPct = totalPeople > 0 ? round((totalOt / totalPeople) * 100) : 0;

    day.sumOtPct = includeIndirect ? day.total.otShare : directSumOt;
    day.sumLeavePct = includeIndirect ? perTotalSumLeave : perDirectSumLeave;
    day.otByDept = Object.fromEntries(DEPARTMENTS.map((d) => [d, day.depts[d].otShare]));
    day.leaveByDept = perLeaveByDept;
    day.indirectOt = day.indirect.otShare;
    day.indirectLeave = perIndirectLeave;
    day.otSum = day.sumOtPct;
    day.leaveSum = day.sumLeavePct;

    const calResult = calMap ? calMap.get(day.date) : null;
    const isSun = new Date(`${day.date}T00:00:00`).getDay() === 0;
    day.isHoliday = calResult ? calResult === 'holiday' : isSun;
  });

  // ✅ จุดที่ 2: สูตร Acc = Cumulative Actual OT% และ Leave% จากจำนวนคนสะสมจริงตามโรงงาน
  let cumOtPeople = 0;
  let cumAttendPeople = 0;
  let cumLeavePeople = 0;
  let cumTotalPeople = 0;
  let lastOtAcc = 0;
  let lastLeaveAcc = 0;

  // หา index วันสุดท้ายที่มีข้อมูล (คนมาทำงาน หรือมี OT/Leave)
  let lastActiveIdx = -1;
  result.forEach((day, idx) => {
    if ((day.total.people > 0 || day.total.attend > 0) && (day.sumOtPct > 0 || day.sumLeavePct > 0)) {
      lastActiveIdx = idx;
    }
  });

  result.forEach((day, idx) => {
    if (lastActiveIdx !== -1 && idx > lastActiveIdx) {
      day.otAcc = 0;
      day.leaveAcc = 0;
      return;
    }

    const isSun = new Date(`${day.date}T00:00:00`).getDay() === 0;
    // วันอาทิตย์ (หลังสัปดาห์แรก) ดึงค่าวันเสาร์มาแสดงต่อเนื่องตามสูตร
    if (isSun && idx > 1 && lastOtAcc > 0) {
      day.otAcc = lastOtAcc;
      day.leaveAcc = lastLeaveAcc;
      return;
    }

    const dayPeople = includeIndirect ? day.total.people : DEPARTMENTS.reduce((sum, d) => sum + (day.depts[d]?.people || 0), 0);
    const dayAttend = includeIndirect ? day.total.attend : DEPARTMENTS.reduce((sum, d) => sum + (day.depts[d]?.attend || 0), 0);
    const dayOt = includeIndirect ? day.total.otPeople : DEPARTMENTS.reduce((sum, d) => sum + (day.depts[d]?.otPeople || 0), 0);
    const dayAbsent = includeIndirect ? day.total.absent : DEPARTMENTS.reduce((sum, d) => sum + (day.depts[d]?.absent || 0), 0);

    cumOtPeople += dayOt;
    cumAttendPeople += dayAttend;
    cumLeavePeople += dayAbsent;
    cumTotalPeople += dayPeople;

    lastOtAcc = cumTotalPeople > 0 ? round((cumOtPeople / cumTotalPeople) * 100) : 0;
    lastLeaveAcc = cumTotalPeople > 0 ? round((cumLeavePeople / cumTotalPeople) * 100) : 0;
    day.otAcc = lastOtAcc;
    day.leaveAcc = lastLeaveAcc;
  });

  // ✅ คำนวณ Planned Manpower จากค่าสูงสุด Max Attendance
  const calculatedPlannedFromMax = {
    ...maxPeopleByGroup,
    totalIndirect: maxIndirectPeople,
    totalDirect: Math.max(0, maxTotalPeople - maxIndirectPeople),
    total: maxTotalPeople,
  };

  // ✅ แนบค่า Planned ทั้งสองแบบเข้าไปในทุกวัน และวันแรกมีข้อมูลสรุปเพิ่มเติม
  result.forEach((day) => {
    day.calculatedPlanned = calculatedPlannedFromMax;
  });
  if (result.length > 0) {
    result[0].plannedSummary = {
      fromRegister: plannedManpower,
      fromMaxAttendance: calculatedPlannedFromMax,
    };
  }

  return result;
}

// ==============================================
// ✅ buildDailyResponse
// ==============================================
function buildDailyResponse(rows, directRows) {
  const addAliases = (bucket) => ({
    ...bucket,
    accPct: bucket.accPct ?? bucket.leavePct ?? 0,
  });
  return rows.map((day, index) => {
    const direct = directRows[index] || {};
    return {
      ...day,
      groups: Object.fromEntries(Object.entries(day.groups || {}).map(([key, value]) => [key, addAliases(value)])),
      tabs: Object.fromEntries(Object.entries(day.tabs || {}).map(([key, value]) => [key, addAliases(value)])),
      total: addAliases(day.total),
      otAccPct: day.otAcc ?? 0,
      p1: {
        ...addAliases(day.total),
        sumPct: day.sumLeavePct ?? 0,
        leavePct: day.sumLeavePct ?? 0,
        otPct: day.sumOtPct ?? 0,
      },
      direct: {
        ...addAliases(direct.total),
        sumPct: direct.sumLeavePct ?? 0,
        leavePct: direct.sumLeavePct ?? 0,
        otPct: direct.sumOtPct ?? 0,
      },
      sumP1Pct: day.sumLeavePct ?? 0,
      sumDirectPct: direct.sumLeavePct ?? 0,
      otP1Pct: day.sumOtPct ?? 0,
      otDirectPct: direct.sumOtPct ?? 0,
      targetPct: 5,
      attendancePeople: day.total?.people ?? 0,
      directPeople: direct.total?.people ?? 0,
    };
  });
}

// ==============================================
// 🎯 Global Shared Targets (เก็บลง PostgreSQL Database "Test" ตารางเดียว manhour_ratio_custom_targets)
// ==============================================
let sharedTargets = {
  day: { leave: 5, ot: 65, otDaily: 75 },
  week: { leave: 5, ot: 65, otDaily: 75 },
  month: { leave: 5, ot: 65, otDaily: 75 },
};

// 1. โหลดค่า Targets จาก Database "Test" เมื่อ Server สตาร์ท (ใช้ตาราง manhour_ratio_custom_targets ตารางเดียว)
async function loadTargetsFromDatabase() {
  try {
    // สร้างตาราง manhour_ratio_custom_targets หากยังไม่มี
    await pool_test.query(`
      CREATE TABLE IF NOT EXISTS public.manhour_ratio_custom_targets (
        id SERIAL PRIMARY KEY,
        view_mode VARCHAR(20) DEFAULT 'day',
        month VARCHAR(7),
        date_from DATE,
        date_to DATE,
        target_type VARCHAR(30) NOT NULL,
        chart_key VARCHAR(50) DEFAULT 'all',
        target_value NUMERIC(6,2) NOT NULL,
        note VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `).catch(() => {});

    // ลบตารางเดิมที่ไม่จำเป็นออก เพื่อใช้ตารางเดียว
    await pool_test.query(`DROP TABLE IF EXISTS public.manhour_ratio_targets;`).catch(() => {});

    // โหลดค่า target หลัก (default) ของแต่ละ view_mode
    // ⚠️ โหลดเฉพาะ global default เท่านั้น (month IS NULL) ไม่รวม month-specific default
    const res = await pool_test.query(`
      SELECT view_mode, target_type, target_value 
      FROM public.manhour_ratio_custom_targets
      WHERE target_type IN ('default_leave', 'default_ot', 'default_ot_daily')
        AND (month IS NULL OR month = '');
    `);
    res.rows.forEach((row) => {
      const v = row.view_mode;
      if (sharedTargets[v]) {
        if (row.target_type === 'default_leave') sharedTargets[v].leave = Number(row.target_value);
        if (row.target_type === 'default_ot') sharedTargets[v].ot = Number(row.target_value);
        if (row.target_type === 'default_ot_daily') sharedTargets[v].otDaily = Number(row.target_value);
      }
    });
    console.log("✅ Loaded Manpower Ratio targets from Database Test (Unified):", sharedTargets);
  } catch (err) {
    console.warn("⚠️ Could not load targets from DB Test, using defaults:", err.message);
  }
}
loadTargetsFromDatabase();

// ดึง Targets แยกตามเดือน (ถ้ามี month-specific ให้ overlay ทับ global sharedTargets)
async function getMonthTargets(month) {
  let result = JSON.parse(JSON.stringify(sharedTargets));
  if (!month) return result;
  try {
    const mtRes = await pool_test.query(`
      SELECT view_mode, target_type, target_value
      FROM public.manhour_ratio_custom_targets
      WHERE month = $1 AND target_type IN ('default_leave', 'default_ot', 'default_ot_daily')
    `, [month]);
    if (mtRes.rows && mtRes.rows.length > 0) {
      mtRes.rows.forEach((r) => {
        const v = r.view_mode;
        if (result[v]) {
          if (r.target_type === 'default_leave') result[v].leave = Number(r.target_value);
          if (r.target_type === 'default_ot') result[v].ot = Number(r.target_value);
          if (r.target_type === 'default_ot_daily') result[v].otDaily = Number(r.target_value);
        }
      });
    }
  } catch (err) {
    console.warn("⚠️ getMonthTargets query error:", err.message);
  }
  return result;
}

router.get('/targets', async (req, res) => {
  const view = String(req.query.view || 'day');
  const month = String(req.query.month || '').trim();
  const validViews = ['day', 'week', 'month', 'day_yearly'];
  const currentView = validViews.includes(view) ? view : 'day';

  if (month) {
    const monthTargets = await getMonthTargets(month);
    return res.status(200).json(monthTargets[currentView] || monthTargets.day);
  }

  return res.status(200).json(sharedTargets[currentView] || sharedTargets.day);
});


router.post('/targets', express.json(), async (req, res) => {
  const { view = 'day', month, leave, ot, otDaily } = req.body || {};
  const validViews = ['day', 'week', 'month', 'day_yearly'];
  const currentView = validViews.includes(view) ? view : 'day';
  const targetMonth = month ? String(month).trim() : null;

  // ถ้าไม่มีการระบุ targetMonth จึงจะถือว่าเป็นการเปลี่ยนค่า Global Default
  if (!targetMonth) {
    if (typeof leave === 'number') sharedTargets[currentView].leave = leave;
    if (typeof ot === 'number') sharedTargets[currentView].ot = ot;
    if (typeof otDaily === 'number') sharedTargets[currentView].otDaily = otDaily;

    // บันทึกเฉพาะ global default (ไม่มี month) ลง DB
    try {
      const upsertGlobal = async (tType, val) => {
        if (typeof val !== 'number') return;
        await pool_test.query(
          `DELETE FROM public.manhour_ratio_custom_targets WHERE view_mode = $1 AND (month IS NULL OR month = '') AND target_type = $2`,
          [currentView, tType]
        );
        await pool_test.query(
          `INSERT INTO public.manhour_ratio_custom_targets (view_mode, target_type, target_value, updated_at) VALUES ($1, $2, $3, NOW())`,
          [currentView, tType, val]
        );
      };
      if (typeof leave === 'number') await upsertGlobal('default_leave', leave);
      if (typeof ot === 'number') await upsertGlobal('default_ot', ot);
      if (typeof otDaily === 'number') await upsertGlobal('default_ot_daily', otDaily);
    } catch (err) {
      console.error("❌ Failed to save global targets to DB Test:", err.message);
    }

    try {
      await writePersistentCache('manpower-ratio-shared-targets-v2', sharedTargets);
    } catch { }

    // ถ้าแก้ Global Default ให้ sync ทุกเดือนที่ไม่มี target เฉพาะ
    cache.forEach((val) => {
      if (val?.data) {
        val.data.targets = { ...sharedTargets };
      }
    });
  }

  // หากมีการระบุ targetMonth (บันทึกแยกรายเดือน)
  if (targetMonth) {
    try {
      const upsertMonthTarget = async (tType, val) => {
        if (typeof val !== 'number') return;
        await pool_test.query(
          `DELETE FROM public.manhour_ratio_custom_targets WHERE view_mode = $1 AND month = $2 AND target_type = $3`,
          [currentView, targetMonth, tType]
        );
        await pool_test.query(
          `INSERT INTO public.manhour_ratio_custom_targets (view_mode, month, target_type, target_value, updated_at) VALUES ($1, $2, $3, $4, NOW())`,
          [currentView, targetMonth, tType, val]
        );
      };
      if (typeof leave === 'number') await upsertMonthTarget('default_leave', leave);
      if (typeof ot === 'number') await upsertMonthTarget('default_ot', ot);
      if (typeof otDaily === 'number') await upsertMonthTarget('default_ot_daily', otDaily);
    } catch (err) {
      console.error("❌ Failed to save month targets to DB Test:", err.message);
    }

    // จัดการ Cache ใน Memory และ Disk
    const monthCached = cache.get(targetMonth);
    if (monthCached?.data) {
      if (!monthCached.data.targets) {
        monthCached.data.targets = JSON.parse(JSON.stringify(sharedTargets));
      }
      if (!monthCached.data.targets[currentView]) {
        monthCached.data.targets[currentView] = { ...sharedTargets[currentView] };
      }
      if (typeof leave === 'number') monthCached.data.targets[currentView].leave = leave;
      if (typeof ot === 'number') monthCached.data.targets[currentView].ot = ot;
      if (typeof otDaily === 'number') monthCached.data.targets[currentView].otDaily = otDaily;

      writePersistentCache(`dept_summary_${targetMonth}`, {
        version: 16,
        savedAt: Date.now(),
        data: monthCached.data,
      }).catch(() => {});
    }
  }

  // คำนวณค่าที่จะตอบกลับ
  let responseTargets = targetMonth
    ? (await getMonthTargets(targetMonth))[currentView] || sharedTargets[currentView]
    : { ...(sharedTargets[currentView] || sharedTargets.day) };

  return res.status(200).json({ success: true, targets: responseTargets });
});

// ==============================================
// 🎯 Custom Daily Targets Endpoints (กำหนด Target ตามวัน/ช่วงวัน)
// ==============================================
router.get('/targets/custom', async (req, res) => {
  const month = String(req.query.month || '').trim();
  try {
    let query = `
      SELECT id, month, 
             TO_CHAR(date_from, 'YYYY-MM-DD') AS date_from, 
             TO_CHAR(date_to, 'YYYY-MM-DD') AS date_to, 
             target_type, chart_key, target_value, note
      FROM public.manhour_ratio_custom_targets
    `;
    const params = [];
    if (month) {
      if (/^\d{4}$/.test(month)) {
        query += ` WHERE month LIKE $1`;
        params.push(`${month}-%`);
      } else {
        query += ` WHERE month = $1`;
        params.push(month);
      }
    }
    query += ` ORDER BY date_from ASC, id ASC`;
    const result = await pool_test.query(query, params);
    return res.status(200).json({ success: true, data: result.rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

router.post('/targets/custom', express.json(), async (req, res) => {
  const { month, date_from, date_to, target_type, chart_key = 'all', target_value, note } = req.body || {};
  if (!month || !date_from || !date_to || !target_type || typeof target_value !== 'number') {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }
  try {
    const insertRes = await pool_test.query(`
      INSERT INTO public.manhour_ratio_custom_targets 
        (month, date_from, date_to, target_type, chart_key, target_value, note, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id, month, TO_CHAR(date_from, 'YYYY-MM-DD') AS date_from, TO_CHAR(date_to, 'YYYY-MM-DD') AS date_to, target_type, chart_key, target_value, note;
    `, [month, date_from, date_to, target_type, chart_key, target_value, note || '']);
    return res.status(200).json({ success: true, data: insertRes.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/targets/custom/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid id' });
  try {
    await pool_test.query(`DELETE FROM public.manhour_ratio_custom_targets WHERE id = $1`, [id]);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================
// ✅ API Endpoint : GET /dept_summary?month=YYYY-MM
// ==============================================
router.get(['/', '/dept_summary'], async (req, res) => {
  const month = String(req.query.month || '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ error: 'month must be YYYY-MM' });
  }
  const cacheKey = month;
  const isRefresh = req.query.refresh === '1';

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentMonth = month === currentMonth;
  // เดือนปัจจุบันที่มีการรูดบัตรเข้ามาเรื่อยๆ ให้แคชเพียง 3 นาที เพื่อความสดใหม่แบบ Real-time
  // ส่วนเดือนอดีตที่ปิดงวดแล้ว ให้แคช 30 นาที
  const effectiveTtl = isCurrentMonth ? 3 * 60 * 1000 : CACHE_TTL_MS;

  // Validate freshness against DB for current or past month
  const cached = cache.get(cacheKey);
  if (!isRefresh && (cached || cache.has(cacheKey))) {
    try {
      const latestRes = await pool_smart.query(
        `SELECT MAX(updated_date) AS latest FROM smart.smart_man_time_attendance
         WHERE dlh_effective_date_time >= $1 AND dlh_effective_date_time < ($1::date + INTERVAL '1 month')::text`,
        [ `${month}-01` ]
      );
      const dbLatest = latestRes.rows?.[0]?.latest ? new Date(latestRes.rows[0].latest).getTime() : 0;
      const cachedSavedAt = cached?.savedAt || 0;
      if (dbLatest > cachedSavedAt) {
        console.info(`⚡ [deptSummary] DB updated for ${month} (dbLatest: ${new Date(dbLatest).toISOString()}, savedAt: ${new Date(cachedSavedAt).toISOString()}), bypassing cache.`);
        cache.delete(cacheKey);
      }
    } catch (e) {
      console.warn(`[deptSummary] DB freshness check skipped: ${e.message}`);
    }
  }

  // 1. In-memory cache
  const cachedAfterCheck = cache.get(cacheKey);
  if (!isRefresh && cachedAfterCheck && Date.now() - cachedAfterCheck.savedAt < effectiveTtl && cachedAfterCheck.data?.version === 21) {
    res.set('X-Data-Cache', 'HIT');
    // ดึง targets ของเดือนนั้นๆ (ถ้ามี month-specific จะ overlay ทับค่า default)
    cachedAfterCheck.data.targets = await getMonthTargets(month);
    return res.status(200).json(cachedAfterCheck.data);
  }


  try {
    const { records, registeredDirect, registeredIndirect, registeredTotal,
      registeredByDept, plannedManpower, calMap } = await loadStandaloneRecords(month);
    const summaryRecords = await addDeptSummaryAttributes(records);

    const spreadsheetData = buildLocalSpreadsheetData(summaryRecords, month, calMap);

    // ✅ ส่ง plannedManpower, spreadsheetData และ calMap เข้าไปใน build() ทั้งสอง scope
    const direct = build(summaryRecords, month, false, registeredDirect, registeredIndirect, registeredTotal, plannedManpower, spreadsheetData, calMap);
    const includeIndirect = build(summaryRecords, month, true, registeredDirect, registeredIndirect, registeredTotal, plannedManpower, spreadsheetData, calMap);

    // ✅ ซิงค์ข้อมูลรายวันกับ Live PostgreSQL Calculation โดยตรง 100%
    try {
      const snapRes = await pool_test.query(
        'SELECT employee_id, dept, line, department, sect, effective_date_time FROM tbl_manhour_snapshot WHERE effective_date_time LIKE $1',
        [`%/${parseInt(month.split('-')[1], 10)}/${month.split('-')[0]}`]
      ).catch(() => ({ rows: [] }));
      const snapByDateMap = new Map();
      (snapRes.rows || []).forEach((r) => {
        const dStr = r.effective_date_time;
        if (!snapByDateMap.has(dStr)) snapByDateMap.set(dStr, new Map());
        snapByDateMap.get(dStr).set(String(r.employee_id).trim(), r);
      });

      let masterEmpDeptMap = null;
      try {
        const mapPath = path.join(process.cwd(), 'Utility', 'empDeptMap.json');
        if (fs.existsSync(mapPath)) masterEmpDeptMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      } catch (e) {}

      const MATRIX_ITEMS = [
        // INDIRECT
        { group: 'INDIRECT', dept: 'HR', coc: 'P140', match: (r) => r.dept === 'HR' || r.source?.includes('P140') },
        { group: 'INDIRECT', dept: 'Acct', coc: 'P150', match: (r) => r.dept === 'ACCT' || r.dept === 'ACCOUNT' || r.source?.includes('P150') },
        { group: 'INDIRECT', dept: 'STR', coc: 'P160', match: (r) => r.dept === 'STR' || r.source?.includes('P160') },
        { group: 'INDIRECT', dept: 'LOG', coc: 'P170', match: (r) => r.dept === 'LOG' || r.source?.includes('P170') },
        { group: 'INDIRECT', dept: 'SE', coc: 'P180', match: (r) => r.dept === 'SE' || r.source?.includes('P180') },
        { group: 'INDIRECT', dept: 'SHE', coc: 'P220', match: (r) => r.dept === 'SHE' || r.source?.includes('P220') },
        { group: 'INDIRECT', dept: 'AUT', coc: 'P282', match: (r) => r.dept === 'AUT' || r.source?.includes('P282') },
        { group: 'INDIRECT', dept: 'PLN', coc: 'P310', match: (r) => r.dept === 'PLN' || r.source?.includes('P310') },
        { group: 'INDIRECT', dept: 'PTE', coc: 'P340', match: (r) => r.dept === 'PTE' || r.source?.includes('P340') || (r.dept === 'FIXTURE' && r.source?.includes('P340')) },
        { group: 'INDIRECT', dept: 'DIE', coc: 'P362', match: (r) => r.dept === 'DIE' || r.source?.includes('P362') },
        { group: 'INDIRECT', dept: 'FIXTURE', coc: 'P363', match: (r) => (r.dept === 'FIXTURE' || r.source?.includes('P363') || r.source?.includes('FIXTURE')) && !r.source?.includes('P340') },
        { group: 'INDIRECT', dept: 'NPM', coc: 'P366', match: (r) => r.dept === 'NPM' || r.source?.includes('P366') },
        { group: 'INDIRECT', dept: 'FPS', coc: 'P370', match: (r) => r.dept === 'FPS' || r.source?.includes('P370') },

        // QA
        { group: 'QA', dept: 'QA IND', coc: 'P330', match: (r) => r.source?.includes('QA IND') || r.source?.includes('P330') },
        { group: 'QA', dept: 'QA FPC', coc: 'P331', match: (r) => r.source?.includes('QA FPC') || r.source?.includes('P331') },
        { group: 'QA', dept: 'QA SMT', coc: 'P332', match: (r) => r.source?.includes('QA SMT') || r.source?.includes('P332') },
        { group: 'QA', dept: 'QA MDS', coc: 'P334', match: (r) => r.source?.includes('QA MDS') || r.source?.includes('P334') },

        // FPC
        { group: 'FPC', dept: 'TSTE', coc: 'P460', match: (r) => (r.dept === 'FPC' || r.source?.includes('P460-1')) && (r.source?.includes('TSTE FPC') || r.source?.includes('F_TSTE') || (r.source?.includes('TSTE') && !r.source?.includes('SMT'))) },
        { group: 'FPC', dept: 'TECH', coc: 'P460', match: (r) => r.dept === 'FPC' && (r.source?.includes('FPC-TECH') || r.source?.includes('F_TECH') || r.source?.includes('P460-5')) },
        { group: 'FPC', dept: 'EXC_FPC', coc: 'P460', match: () => false },
        { group: 'FPC', dept: 'MAT', coc: 'P460', match: (r) => r.dept === 'FPC' && (r.source?.includes('FPC-MAT') || r.source?.includes('MATERIAL') || r.source?.includes('EXCESS-FPC') || r.source?.includes('EXC_FPC') || r.source?.includes('P460-3') || (r.source?.includes('MAT') && !r.source?.includes('SMT'))) },
        { group: 'FPC', dept: 'Hot press', coc: '', match: (r) => r.dept === 'FPC' && (r.source?.includes('/HPS') || r.source?.includes('HPS_PHP') || r.source?.includes('HOT PRESS')) },
        { group: 'FPC', dept: 'VAC', coc: '', match: (r) => r.dept === 'FPC' && (r.source?.includes('/VAC') || r.source?.includes('VACUUM')) },
        { group: 'FPC', dept: 'BLK', coc: 'P462', match: (r) => r.dept === 'FPC' && (r.source?.includes('/BLK') || r.source?.includes('P462')) },
        { group: 'FPC', dept: 'F-LAM', coc: '', match: (r) => r.dept === 'FPC' && !r.source?.includes('MDS') && (r.source?.includes('/LAM') || r.source?.includes('/ABL') || r.source?.includes('F-LAM')) },
        { group: 'FPC', dept: 'OST', coc: '', match: (r) => r.dept === 'FPC' && r.source?.includes('/OST') },
        { group: 'FPC', dept: 'AVI/K2', coc: '', match: (r) => r.dept === 'FPC' && (r.source?.includes('AVI_INS') || r.source?.includes('AVI/K2') || r.source?.includes('AVI')) },
        { group: 'FPC', dept: 'LINE A', coc: '', match: (r) => r.dept === 'FPC' && (r.source?.includes('/PA_') || r.source?.includes('LINE A') || r.source?.includes('LINE_A')) },
        { group: 'FPC', dept: 'LINE B', coc: '', match: (r) => r.dept === 'FPC' && (r.source?.includes('/PB_') || r.source?.includes('LINE B') || r.source?.includes('LINE_B')) },
        { group: 'FPC', dept: 'LINE C', coc: '', match: (r) => r.dept === 'FPC' && (r.source?.includes('/PC_') || r.source?.includes('LINE C') || r.source?.includes('LINE_C')) },
        { group: 'FPC', dept: 'LINE D', coc: '', match: (r) => r.dept === 'FPC' && (r.source?.includes('/PD_') || r.source?.includes('LINE D') || r.source?.includes('LINE_D')) },

        // SMT_F
        { group: 'SMT_F', dept: 'TSTE-F', coc: 'P500', match: (r) => r.source?.includes('P500-1') || r.source?.includes('S_TSTE-F') || (r.dept === 'SMT_F' && r.source?.includes('TSTE')) },
        { group: 'SMT_F', dept: 'TECH-F', coc: 'P500', match: (r) => (r.dept === 'SMT_F' || r.source?.includes('SMT-F') || r.source?.includes('SMT_F')) && (r.source?.includes('TECH-F') || r.source?.includes('TECH_F') || r.source?.includes('TECH')) },
        { group: 'SMT_F', dept: 'REW', coc: 'P550', match: (r) => r.dept === 'SMT_F' && (r.source?.includes('REW') || r.source?.includes('P550')) },
        { group: 'SMT_F', dept: 'X-Ray', coc: 'P510', match: (r) => r.dept === 'SMT_F' && (r.source?.includes('X-RAY') || r.source?.includes('XRAY')) },
        { group: 'SMT_F', dept: 'MOT', coc: 'P510', match: (r) => r.dept === 'SMT_F' && (r.source?.includes('MOT') && !r.source?.includes('AIX')) },
        { group: 'SMT_F', dept: 'AIX-MOT', coc: '', match: (r) => r.dept === 'SMT_F' && (r.source?.includes('AIX-MOT') || r.source?.includes('AIX_MOT')) },
        { group: 'SMT_F', dept: 'MAT', coc: 'P540', match: (r) => (r.dept === 'SMT_F' && !r.source?.includes('ASY') && !r.source?.includes('AELT') && (r.source?.includes('P540') || r.source?.includes('SMT_F-MAT') || (r.source?.includes('MAT') && !r.source?.includes('MAT-') && !r.source?.includes('MATERIAL')))) || (r.source?.includes('P540') && !r.source?.includes('ASY') && !r.source?.includes('AELT')) },

        // SMT_B
        { group: 'SMT_B', dept: 'TSTE-B', coc: 'P500', match: (r) => r.source?.includes('P500-2') || r.source?.includes('S_TSTE-B') },
        { group: 'SMT_B', dept: 'TECH-B', coc: 'P500', match: (r) => (r.dept === 'SMT_B' || r.source?.includes('SMT-B') || r.source?.includes('SMT_B')) && (r.source?.includes('TECH-B') || r.source?.includes('TECH_B')) },
        { group: 'SMT_B', dept: 'EXC_SMT', coc: 'P500', match: (r) => r.source?.includes('P500-3') || r.source?.includes('EXCESS-SMT') || r.source?.includes('EXC_SMT') },
        { group: 'SMT_B', dept: 'ASY1', coc: '', match: (r) => (r.dept === 'SMT_B' || r.source?.includes('ASY1')) && r.source?.includes('ASY1') },
        { group: 'SMT_B', dept: 'ASY2', coc: '', match: (r) => (r.dept === 'SMT_B' || r.source?.includes('ASY2')) && r.source?.includes('ASY2') },
        { group: 'SMT_B', dept: 'ASY3', coc: '', match: (r) => (r.dept === 'SMT_B' || r.source?.includes('ASY3')) && r.source?.includes('ASY3') },
        { group: 'SMT_B', dept: 'AELT', coc: '', match: (r) => r.dept === 'SMT_B' && r.source?.includes('AELT') },
        { group: 'SMT_B', dept: 'LAM', coc: 'P560', match: (r) => r.dept === 'SMT_B' && (r.source?.includes('P560-6') || (r.source?.includes('LAM') && !r.source?.includes('MD') && !r.source?.includes('AIX'))) },
        { group: 'SMT_B', dept: 'BLK', coc: 'P520', match: (r) => r.dept === 'SMT_B' && (r.source?.includes('P520-2') || (r.source?.includes('BLK') && !r.source?.includes('AIX'))) },
        { group: 'SMT_B', dept: 'LAM MD', coc: '', match: (r) => r.dept === 'SMT_B' && (r.source?.includes('LAM MD') || r.source?.includes('MD-LAM') || r.source?.includes('MD_LAM')) },
        { group: 'SMT_B', dept: 'MDLAM', coc: '', match: (r) => r.dept === 'SMT_B' && (r.source?.includes('MDLAM')) },
        { group: 'SMT_B', dept: 'AIX-ASY', coc: '', match: (r) => (r.dept === 'SMT_B' || r.source?.includes('AIX')) && (r.source?.includes('AIX-ASY') || r.source?.includes('AIX_ASY') || r.source?.includes('AIX-INT') || r.source?.includes('AIX_INT') || r.source?.includes('AIX-ELT')) },
        { group: 'SMT_B', dept: 'AIX-BLK', coc: '', match: (r) => (r.dept === 'SMT_B' || r.source?.includes('AIX')) && (r.source?.includes('AIX-BLK') || r.source?.includes('AIX_BLK')) },

        // MDS
        { group: 'MDS', dept: 'MDS-TS', coc: 'P700', match: (r) => r.dept === 'MDS' && (r.source?.includes('P700') || r.source?.includes('MDS-TS') || r.source?.includes('MDS_TS')) },
        { group: 'MDS', dept: 'MDS', coc: 'P764', match: (r) => (r.dept === 'MDS' || r.source?.includes('P764')) && !r.source?.includes('QA') },
      ];

      const BLOCKS = ['P1', 'PER', 'SUB', 'MOU', 'DC'];
      const [yearNum, monthNum] = month.split('-').map(Number);
      const daysInMonth = new Date(yearNum, monthNum, 0).getDate();

      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const dateStr = `${month}-${String(dayNum).padStart(2, '0')}`;
        const dayRows = summaryRecords.filter((r) => !isOtherFactoryRecord(r) && String(r.dlh_effective_date_time || '').startsWith(dateStr));
        if (dayRows.length === 0) continue;

        const isSun = new Date(`${dateStr}T00:00:00`).getDay() === 0;
        const calResult = calMap.get(dateStr);
        const isWorkingCalendarDay = calResult ? calResult === 'working day' : !isSun;

        const personMap = new Map();
        dayRows.forEach((r) => {
          const id = String(r.dlh_employee_id || r.employee_id || '').trim();
          if (!id) return;
          const hasHelpEvent = Boolean(r.line_in || r.loan_destination || r.is_loan_exclude || (Number(r.help_hour) || 0) > 0);
          const isAbsent = !hasHelpEvent && isWorkingCalendarDay ? shouldCountAsAbsent(r, isWorkingCalendarDay) : false;
          const isPresent = shouldCountAsPresent(r);
          const hasOt = Number(r.OT || 0) > 0;
          const source = [r.emp_department, r.department, r.dept, r.line, r.line_check, r.mhr_cc_type].map((s) => String(s || '').toUpperCase()).join(' | ');
          const cur = personMap.get(id) || { id, dept: r.dept, deptType: r.deptType || '', supportType: r.supportType || '', source, present: false, absent: false, ot: false, isHelping: false };
          cur.present ||= isPresent;
          cur.absent ||= isAbsent;
          cur.ot ||= hasOt;
          cur.isHelping ||= hasHelpEvent;
          personMap.set(id, cur);
        });

        personMap.forEach((p) => {
          if (p.isHelping) p.absent = false;
        });

        const persons = Array.from(personMap.values());
        const filterPersonForBlock = (p, block) => {
          if (block === 'P1') return true;
          const s = p.source;
          const id = String(p.id || '').trim().toUpperCase();
          const isSubId = id.startsWith('S');
          const isDc = p.supportType === 'DC' || (s.includes('DC') && !s.includes('DCC') && !s.includes('P330') && !s.includes('P764'));
          const isMou = p.supportType === 'MOU' || s.includes('MOU') || id === '7051838';
          if (block === 'DC') return isDc;
          if (block === 'MOU') return isMou && !isDc;
          if (block === 'SUB') {
            if (isDc || isMou) return false;
            return isSubId || p.supportType === 'SUB' || p.supportType === 'MPS' || s.includes('SUB') || s.includes('MPS') || s.includes('VDS') || s.includes('PIMB');
          }
          if (block === 'PER') {
            if (isSubId || isDc || isMou) return false;
            if (p.supportType === 'SUB' || p.supportType === 'MPS') return false;
            return true;
          }
          return false;
        };

        const effDate = `${dayNum}/${parseInt(month.split('-')[1], 10)}/${month.split('-')[0]}`;
        const snapMap = snapByDateMap.get(effDate) || new Map();

        const personAssignedItemIndex = new Map();
        persons.forEach((p) => {
          if (masterEmpDeptMap && masterEmpDeptMap[p.id]) {
            const empMapEntry = masterEmpDeptMap[p.id];
            if (typeof empMapEntry.itemIdx === 'number' && empMapEntry.itemIdx >= 0 && empMapEntry.itemIdx < MATRIX_ITEMS.length) {
              personAssignedItemIndex.set(p.id, empMapEntry.itemIdx);
              return;
            }
            const targetGroup = empMapEntry.group || empMapEntry.colO;
            const targetDept = empMapEntry.dept;
            const targetCoc = empMapEntry.coc;
            const mapIdx = MATRIX_ITEMS.findIndex((item) => {
              if (targetGroup && item.group !== targetGroup) return false;
              if (item.dept.toLowerCase() === targetDept.toLowerCase()) return true;
              if (targetCoc && item.coc === targetCoc && item.dept === targetDept) return true;
              return false;
            });
            if (mapIdx !== -1) {
              personAssignedItemIndex.set(p.id, mapIdx);
              return;
            }
          }
          const idx = MATRIX_ITEMS.findIndex((item) => item.match(p));
          if (idx !== -1) personAssignedItemIndex.set(p.id, idx);
          else {
            const fallbackIdx = MATRIX_ITEMS.findIndex((item) => item.dept === p.dept || item.group === p.dept);
            if (fallbackIdx !== -1) personAssignedItemIndex.set(p.id, fallbackIdx);
          }
        });

        const rows = MATRIX_ITEMS.map((item, itemIdx) => {
          const blockData = {};
          BLOCKS.forEach((block) => {
            const matched = persons.filter((p) => filterPersonForBlock(p, block) && personAssignedItemIndex.get(p.id) === itemIdx);
            const mp = matched.length;
            const work = matched.filter((p) => p.present).length;
            const leave = matched.filter((p) => p.absent).length;
            const ot = matched.filter((p) => p.ot).length;
            const leaveRatio = mp > 0 ? Math.round((leave / mp) * 1000) / 10 : 0;
            const otRatio = work > 0 ? Math.round((ot / work) * 1000) / 10 : 0;
            blockData[block] = { mp, work, leave, ot, leaveRatio, otRatio };
          });
          return { group: item.group, dept: item.dept, coc: item.coc, blocks: blockData };
        });

        const g = {};
        ['INDIRECT', 'QA', 'FPC', 'SMT_F', 'SMT_B', 'MDS'].forEach((grp) => {
          const grpRows = rows.filter((r) => r.group === grp);
          g[grp] = {};
          BLOCKS.forEach((blk) => {
            const mp = grpRows.reduce((sum, r) => sum + r.blocks[blk].mp, 0);
            const work = grpRows.reduce((sum, r) => sum + r.blocks[blk].work, 0);
            const leave = grpRows.reduce((sum, r) => sum + r.blocks[blk].leave, 0);
            const ot = grpRows.reduce((sum, r) => sum + r.blocks[blk].ot, 0);
            const leaveRatio = mp > 0 ? Math.round((leave / mp) * 1000) / 10 : 0;
            const otRatio = work > 0 ? Math.round((ot / work) * 1000) / 10 : 0;
            g[grp][blk] = { mp, work, leave, ot, leaveRatio, otRatio };
          });
        });

          const qa = g.QA?.P1 || { mp: 0, leave: 0, ot: 0, work: 0 };
          const fpc = g.FPC?.P1 || { mp: 0, leave: 0, ot: 0, work: 0 };
          const smt_f = g.SMT_F?.P1 || { mp: 0, leave: 0, ot: 0, work: 0 };
          const smt_b = g.SMT_B?.P1 || { mp: 0, leave: 0, ot: 0, work: 0 };
          const mds = g.MDS?.P1 || { mp: 0, leave: 0, ot: 0, work: 0 };
          const ind = g.INDIRECT?.P1 || { mp: 0, leave: 0, ot: 0, work: 0 };

          // กลุ่ม PER สำหรับคำนวณ Leave Ratio ให้ตรงกับตารางสรุปรายเดือน (แถว 60-70)
          const qaPer = g.QA?.PER || qa;
          const fpcPer = g.FPC?.PER || fpc;
          const smt_fPer = g.SMT_F?.PER || smt_f;
          const smt_bPer = g.SMT_B?.PER || smt_b;
          const mdsPer = g.MDS?.PER || mds;
          const indPer = g.INDIRECT?.PER || ind;

          const perDirectMp = (qaPer.mp || 0) + (fpcPer.mp || 0) + (smt_fPer.mp || 0) + (smt_bPer.mp || 0) + (mdsPer.mp || 0);
          const perTotalMp = perDirectMp + (indPer.mp || 0);
          const perDirectLeave = (qaPer.leave || 0) + (fpcPer.leave || 0) + (smt_fPer.leave || 0) + (smt_bPer.leave || 0) + (mdsPer.leave || 0);
          const perTotalLeave = perDirectLeave + (indPer.leave || 0);

          const directMp = qa.mp + fpc.mp + smt_f.mp + smt_b.mp + mds.mp;
          const directWork = qa.work + fpc.work + smt_f.work + smt_b.work + mds.work;
          const directLeave = qa.leave + fpc.leave + smt_f.leave + smt_b.leave + mds.leave;
          const directOt = qa.ot + fpc.ot + smt_f.ot + smt_b.ot + mds.ot;

          const totalMp = directMp + ind.mp;
          const totalWork = directWork + ind.work;
          const totalLeave = directLeave + ind.leave;
          const totalOt = directOt + ind.ot;

          const r = (v) => Math.round((Number(v) || 0) * 10) / 10;

          const subDirMp = (g.QA?.SUB?.mp||0)+(g.FPC?.SUB?.mp||0)+(g.SMT_F?.SUB?.mp||0)+(g.SMT_B?.SUB?.mp||0)+(g.MDS?.SUB?.mp||0);
          const mouDirMp = (g.QA?.MOU?.mp||0)+(g.FPC?.MOU?.mp||0)+(g.SMT_F?.MOU?.mp||0)+(g.SMT_B?.MOU?.mp||0)+(g.MDS?.MOU?.mp||0);
          const dcQaMp = (g.QA?.DC?.mp > 5) ? 2 : (g.QA?.DC?.mp || 0);
          const dcDirMp = dcQaMp + (g.FPC?.DC?.mp||0)+(g.SMT_F?.DC?.mp||0)+(g.SMT_B?.DC?.mp||0);

          // ทับข้อมูลใน direct (5 แผนกหลัก) ตรงตาม MANPOWER RATIO DAILY
          const dirDay = direct[dayNum - 1];
          if (dirDay && directMp > 0) {
            // สูตร Leave Ratio: SUM Direct ตรงจาก MANPOWER RATIO DAILY (กลุ่มพนักงานหลัก PER)
            dirDay.sumLeavePct = perDirectMp > 0 ? r((perDirectLeave / perDirectMp) * 100) : 0;
            dirDay.leaveSum = dirDay.sumLeavePct;

            // สูตร OT Ratio: SUM Direct ตรงจาก MANPOWER RATIO DAILY (Direct OT / Direct MP)
            dirDay.sumOtPct = directMp > 0 ? r((directOt / directMp) * 100) : 0;
            dirDay.otSum = dirDay.sumOtPct;

            dirDay.leaveByDept = {
              QA: perDirectMp > 0 ? r((qaPer.leave / perDirectMp) * 100) : 0,
              FPC: perDirectMp > 0 ? r((fpcPer.leave / perDirectMp) * 100) : 0,
              SMT_F: perDirectMp > 0 ? r((smt_fPer.leave / perDirectMp) * 100) : 0,
              SMT_B: perDirectMp > 0 ? r((smt_bPer.leave / perDirectMp) * 100) : 0,
              MDS: perDirectMp > 0 ? r((mdsPer.leave / perDirectMp) * 100) : 0,
            };
            dirDay.otByDept = {
              QA: directMp > 0 ? r((qa.ot / directMp) * 100) : 0,
              FPC: directMp > 0 ? r((fpc.ot / directMp) * 100) : 0,
              SMT_F: directMp > 0 ? r((smt_f.ot / directMp) * 100) : 0,
              SMT_B: directMp > 0 ? r((smt_b.ot / directMp) * 100) : 0,
              MDS: directMp > 0 ? r((mds.ot / directMp) * 100) : 0,
            };
            dirDay.total = {
              people: directMp,
              present: directWork,
              absent: directLeave,
              otPeople: directOt,
              workHrs: directWork * 8,
              otHrs: directOt * 3,
            };
            dirDay.people = directMp;
            dirDay.absent = directLeave;
            dirDay.otPeople = directOt;
            if (dirDay.depts) {
              const setDirectDept = (dObj, grp, lShare, oShare) => {
                if (!dObj || !grp) return;
                dObj.people = grp.mp;
                dObj.present = grp.work;
                dObj.absent = grp.leave;
                dObj.otPeople = grp.ot;
                dObj.leavePct = grp.mp > 0 ? r((grp.leave / grp.mp) * 100) : 0;
                dObj.otPct = grp.work > 0 ? r((grp.ot / grp.work) * 100) : 0;
                dObj.leaveShare = lShare;
                dObj.otShare = oShare;
              };
              setDirectDept(dirDay.depts.QA, qa, dirDay.leaveByDept.QA, dirDay.otByDept.QA);
              setDirectDept(dirDay.depts.FPC, fpc, dirDay.leaveByDept.FPC, dirDay.otByDept.FPC);
              setDirectDept(dirDay.depts.SMT_F, smt_f, dirDay.leaveByDept.SMT_F, dirDay.otByDept.SMT_F);
              setDirectDept(dirDay.depts.SMT_B, smt_b, dirDay.leaveByDept.SMT_B, dirDay.otByDept.SMT_B);
              setDirectDept(dirDay.depts.MDS, mds, dirDay.leaveByDept.MDS, dirDay.otByDept.MDS);
            }

            // ซิงค์ supportGroups ฝั่ง Direct (MPS, MOU, DC, PER) ตามสูตรตารางรายงาน
            if (!dirDay.supportGroups) dirDay.supportGroups = {};
            const buildDirectSupportGroup = (blkName, groupDivisor, isOwnRate = false) => {
              const blkQA = (blkName === 'DC' && (g.QA?.DC?.mp || 0) > 5)
                ? { mp: 2, leave: 0, work: 2, ot: 0 }
                : (g.QA?.[blkName] || {});
              const blkFPC = g.FPC?.[blkName] || {};
              const blkSMTF = g.SMT_F?.[blkName] || {};
              const blkSMTB = g.SMT_B?.[blkName] || {};
              const blkMDS = (blkName === 'DC' && (g.MDS?.DC?.mp || 0) > 0)
                ? { mp: 0, leave: 0, work: 0, ot: 0 }
                : (g.MDS?.[blkName] || {});
              const div = groupDivisor > 0 ? groupDivisor : 1;
              const totalAbs = (blkQA.leave || 0) + (blkFPC.leave || 0) + (blkSMTF.leave || 0) + (blkSMTB.leave || 0) + (blkMDS.leave || 0);

              const calcDept = (b) => {
                const bMp = b.mp || 0;
                const bLeave = b.leave || 0;
                const realRate = bMp > 0 ? r((bLeave / bMp) * 100) : 0;
                const leaveShare = isOwnRate ? realRate : r((bLeave / div) * 100);
                return {
                  leaveShare,
                  realRate,
                  people: bMp,
                  absent: bLeave,
                  otPeople: b.ot || 0,
                };
              };

              return {
                sumLeavePct: r((totalAbs / div) * 100),
                total: { people: div, absent: totalAbs },
                byDept: {
                  QA: calcDept(blkQA),
                  FPC: calcDept(blkFPC),
                  SMT_F: calcDept(blkSMTF),
                  SMT_B: calcDept(blkSMTB),
                  MDS: calcDept(blkMDS),
                },
              };
            };

            dirDay.supportGroups.MPS = buildDirectSupportGroup('SUB', subDirMp, false);
            dirDay.supportGroups.MOU = buildDirectSupportGroup('MOU', mouDirMp, true);
            dirDay.supportGroups.DC = buildDirectSupportGroup('DC', dcDirMp, true);
            dirDay.supportGroups.PER = buildDirectSupportGroup('PER', perDirectMp, false);
          }

          // ทับข้อมูลใน includeIndirect (รวมทั้งโรงงาน) ตรงตาม MANPOWER RATIO DAILY
          const indDay = includeIndirect[dayNum - 1];
          if (indDay && totalMp > 0) {
            // สูตร Leave Ratio: SUM P1 ตรงจาก MANPOWER RATIO DAILY (กลุ่มพนักงานหลัก PER)
            indDay.sumLeavePct = perTotalMp > 0 ? r((perTotalLeave / perTotalMp) * 100) : 0;
            indDay.leaveSum = indDay.sumLeavePct;

            // สูตร OT Ratio: SUM P1 ตรงจาก MANPOWER RATIO DAILY (Total OT / Total MP)
            indDay.sumOtPct = totalMp > 0 ? r((totalOt / totalMp) * 100) : 0;
            indDay.otSum = indDay.sumOtPct;

            indDay.leaveByDept = {
              QA: perDirectMp > 0 ? r((qaPer.leave / perDirectMp) * 100) : 0,
              FPC: perDirectMp > 0 ? r((fpcPer.leave / perDirectMp) * 100) : 0,
              SMT_F: perDirectMp > 0 ? r((smt_fPer.leave / perDirectMp) * 100) : 0,
              SMT_B: perDirectMp > 0 ? r((smt_bPer.leave / perDirectMp) * 100) : 0,
              MDS: perDirectMp > 0 ? r((mdsPer.leave / perDirectMp) * 100) : 0,
            };
            indDay.indirectLeave = perDirectMp > 0 ? r((indPer.leave / perDirectMp) * 100) : 0;

            indDay.otByDept = {
              QA: totalMp > 0 ? r((qa.ot / totalMp) * 100) : 0,
              FPC: totalMp > 0 ? r((fpc.ot / totalMp) * 100) : 0,
              SMT_F: totalMp > 0 ? r((smt_f.ot / totalMp) * 100) : 0,
              SMT_B: totalMp > 0 ? r((smt_b.ot / totalMp) * 100) : 0,
              MDS: totalMp > 0 ? r((mds.ot / totalMp) * 100) : 0,
            };
            indDay.indirectOt = totalMp > 0 ? r((ind.ot / totalMp) * 100) : 0;

            const overviewLeave = totalMp > 0 ? r((totalLeave / totalMp) * 100) : 0;
            const overviewOt = totalMp > 0 ? r((totalOt / totalMp) * 100) : 0;

            indDay.overviewLeavePct = overviewLeave;
            indDay.overviewOtPct = overviewOt;

            indDay.total = {
              people: totalMp,
              present: totalWork,
              absent: totalLeave,
              otPeople: totalOt,
              leavePct: indDay.sumLeavePct,
              leaveShare: overviewLeave,
              otPct: overviewOt,
              otShare: totalMp > 0 ? r((totalOt / totalMp) * 100) : 0,
              workHrs: totalWork * 8,
              otHrs: totalOt * 3,
            };
            indDay.people = totalMp;
            indDay.absent = totalLeave;
            indDay.otPeople = totalOt;

            if (indDay.depts) {
              const setIncludeDept = (dObj, grp, lShare, oShare) => {
                if (!dObj || !grp) return;
                dObj.people = grp.mp;
                dObj.present = grp.work;
                dObj.absent = grp.leave;
                dObj.otPeople = grp.ot;
                dObj.leavePct = grp.mp > 0 ? r((grp.leave / grp.mp) * 100) : 0;
                dObj.otPct = grp.work > 0 ? r((grp.ot / grp.work) * 100) : 0;
                dObj.leaveShare = lShare;
                dObj.otShare = oShare;
              };
              setIncludeDept(indDay.depts.QA, qa, indDay.leaveByDept.QA, indDay.otByDept.QA);
              setIncludeDept(indDay.depts.FPC, fpc, indDay.leaveByDept.FPC, indDay.otByDept.FPC);
              setIncludeDept(indDay.depts.SMT_F, smt_f, indDay.leaveByDept.SMT_F, indDay.otByDept.SMT_F);
              setIncludeDept(indDay.depts.SMT_B, smt_b, indDay.leaveByDept.SMT_B, indDay.otByDept.SMT_B);
              setIncludeDept(indDay.depts.MDS, mds, indDay.leaveByDept.MDS, indDay.otByDept.MDS);
            }
            if (indDay.indirect) {
              indDay.indirect.people = ind.mp;
              indDay.indirect.present = ind.work;
              indDay.indirect.absent = ind.leave;
              indDay.indirect.otPeople = ind.ot;
              indDay.indirect.leavePct = ind.mp > 0 ? r((ind.leave / ind.mp) * 100) : 0;
              indDay.indirect.otPct = ind.work > 0 ? r((ind.ot / ind.work) * 100) : 0;
              indDay.indirect.leaveShare = indDay.indirectLeave;
              indDay.indirect.otShare = indDay.indirectOt;
            }

            // ซิงค์ supportGroups ฝั่ง Include Indirect (MPS, MOU, DC, PER) ตามสูตรตารางรายงาน แถว 60-118
            if (!indDay.supportGroups) indDay.supportGroups = {};
            const buildIncludeSupportGroup = (blkName, directDivisor, totalDivisor, isOwnRate = false) => {
              const blkQA = (blkName === 'DC' && (g.QA?.DC?.mp || 0) > 5)
                ? { mp: 2, leave: 0, work: 2, ot: 0 }
                : (g.QA?.[blkName] || {});
              const blkFPC = g.FPC?.[blkName] || {};
              const blkSMTF = g.SMT_F?.[blkName] || {};
              const blkSMTB = g.SMT_B?.[blkName] || {};
              const blkMDS = (blkName === 'DC' && (g.MDS?.DC?.mp || 0) > 0)
                ? { mp: 0, leave: 0, work: 0, ot: 0 }
                : (g.MDS?.[blkName] || {});
              const blkInd = g.INDIRECT?.[blkName] || {};
              const dDiv = directDivisor > 0 ? directDivisor : 1;
              const tDiv = totalDivisor > 0 ? totalDivisor : 1;
              const totalAbs = (blkQA.leave || 0) + (blkFPC.leave || 0) + (blkSMTF.leave || 0) + (blkSMTB.leave || 0) + (blkMDS.leave || 0) + (blkInd.leave || 0);

              const calcDept = (b, isInd = false) => {
                const bMp = b.mp || 0;
                const bLeave = b.leave || 0;
                const realRate = bMp > 0 ? r((bLeave / bMp) * 100) : 0;
                // ในสูตรแถว 62-67: แผนก Indirect ก็ถูกหารด้วย directDivisor (FO263)
                const leaveShare = isOwnRate ? realRate : r((bLeave / dDiv) * 100);
                return {
                  leaveShare,
                  realRate,
                  people: bMp,
                  absent: bLeave,
                  otPeople: b.ot || 0,
                };
              };

              return {
                sumLeavePct: r((totalAbs / tDiv) * 100),
                total: { people: tDiv, absent: totalAbs },
                byDept: {
                  QA: calcDept(blkQA),
                  FPC: calcDept(blkFPC),
                  SMT_F: calcDept(blkSMTF),
                  SMT_B: calcDept(blkSMTB),
                  MDS: calcDept(blkMDS),
                  Indirect: calcDept(blkInd, true),
                },
              };
            };

            const subTotMp = subDirMp + (g.INDIRECT?.SUB?.mp||0);
            indDay.supportGroups.MPS = buildIncludeSupportGroup('SUB', subDirMp, subTotMp, false);

            const mouTotMp = mouDirMp + (g.INDIRECT?.MOU?.mp||0);
            indDay.supportGroups.MOU = buildIncludeSupportGroup('MOU', mouDirMp, mouTotMp, true);

            const dcTotMp = dcDirMp + (g.INDIRECT?.DC?.mp||0);
            indDay.supportGroups.DC = buildIncludeSupportGroup('DC', dcDirMp, dcTotMp, true);

            indDay.supportGroups.PER = buildIncludeSupportGroup('PER', perDirectMp, perTotalMp, false);
          }
        }
      } catch (overlayErr) {
      console.warn('⚠️ [deptSummary] Could not overlay daily_matrix:', overlayErr.message);
    }


    // ✅ คำนวณเส้นสะสม Acc. (Cumulative OT% และ Leave%) ให้ตรงกับสูตรตารางแถว 74-75 เป๊ะ 100%
    const r = (v) => Math.round((Number(v) || 0) * 10) / 10;
    const recalcAcc = (rows, isDirect = false) => {
      let cumOt = 0;
      let cumMp = 0;
      let cumLeave = 0;
      let lastOtAcc = 0;
      let lastLeaveAcc = 0;
      let lastActiveIdx = -1;
      rows.forEach((day, idx) => {
        const mp = isDirect
          ? (day.people || (day.depts ? DEPARTMENTS.reduce((sum, d) => sum + (day.depts[d]?.people || 0), 0) : 0))
          : (day.people || day.total?.people || 0);
        if (mp > 0 && (day.sumOtPct > 0 || day.sumLeavePct > 0)) {
          lastActiveIdx = idx;
        }
      });

      rows.forEach((day, idx) => {
        if (lastActiveIdx !== -1 && idx > lastActiveIdx) {
          day.otAcc = 0;
          day.leaveAcc = 0;
          return;
        }
        const isSun = new Date(`${day.date}T00:00:00`).getDay() === 0;
        if (isSun && idx > 0 && lastOtAcc > 0) {
          day.otAcc = lastOtAcc;
          day.leaveAcc = lastLeaveAcc;
          return;
        }
        const dayMp = isDirect
          ? (day.people || (day.depts ? DEPARTMENTS.reduce((sum, d) => sum + (day.depts[d]?.people || 0), 0) : 0))
          : (day.people || day.total?.people || 0);
        const dayOt = isDirect
          ? (day.otPeople || (day.depts ? DEPARTMENTS.reduce((sum, d) => sum + (day.depts[d]?.otPeople || 0), 0) : 0))
          : (day.otPeople || day.total?.otPeople || 0);
        const dayLeave = isDirect
          ? (day.absent || (day.depts ? DEPARTMENTS.reduce((sum, d) => sum + (day.depts[d]?.absent || 0), 0) : 0))
          : (day.absent || day.total?.absent || 0);
        cumOt += dayOt;
        cumMp += dayMp;
        cumLeave += dayLeave;
        lastOtAcc = cumMp > 0 ? r((cumOt / cumMp) * 100) : 0;
        lastLeaveAcc = cumMp > 0 ? r((cumLeave / cumMp) * 100) : 0;
        day.otAcc = lastOtAcc;
        day.leaveAcc = lastLeaveAcc;
      });
    };
    recalcAcc(direct, true);
    recalcAcc(includeIndirect, false);



    // ดึงเป้าหมายเฉพาะเดือน (month-specific targets)
    const monthSpecificTargets = await getMonthTargets(month);

    const data = {
      version: 21,
      month,
      departments: DEPARTMENTS,
      groups: GROUPS,
      tabs: TABS,
      targets: monthSpecificTargets,
      spreadsheetData,
      direct,
      includeIndirect,
      // ✅ แนบข้อมูล Planned Manpower ทั้งสองแบบให้ Frontend เลือกใช้
      plannedManpower: {
        fromRegister: plannedManpower,                              // วิธีที่ 1: จาก tbl_employee
        fromMaxAttendance: includeIndirect[0]?.calculatedPlanned,    // วิธีที่ 2: จาก Max Attendance
      },
      registeredByDept,  // ✅ คนทะเบียนรายแผนก
    };
    data.daily = buildDailyResponse(data.includeIndirect, data.direct);
    data.chartData = {
      direct: data.direct,
      includeIndirect: data.includeIndirect,
      daily: data.daily,
    };

    cache.set(cacheKey, { savedAt: Date.now(), data });
    writePersistentCache(`dept_summary_${month}`, { version: 21, savedAt: Date.now(), data }).catch(() => {});

    res.set('X-Data-Cache', 'MISS');
    return res.status(200).json(data);
  } catch (error) {
    if (cached) {
      res.set('X-Data-Cache', 'STALE');
      return res.status(200).json(cached.data);
    }
    return res.status(500).json({
      error: 'Unable to build department summary',
      errorMessage: error.message || String(error),
    });
  }
});

// ==============================================
// 📊 API Endpoint: GET /mh/dept_summary/daily_matrix?date=YYYY-MM-DD
// คืนค่าโครงสร้างข้อมูล 52 แถวตาม Dept & COC สำหรับหน้าจอและกราฟ MANPOWER RATIO Daily
// ==============================================
router.get('/daily_matrix', async (req, res) => {
  const dateStr = String(req.query.date || '').trim() || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
  const month = dateStr.slice(0, 7);



  // 1. ตรวจสอบว่ามีไฟล์ Daily Matrix สรุปรายวันตรงตามรายงานโรงงานหรือไม่
  try {
    const permFile = path.join(process.cwd(), 'data', 'daily_matrix', `daily_matrix_${dateStr}.json`);
    const cachedFile = path.join(process.cwd(), '.server-cache', `daily_matrix_${dateStr}.json`);
    const targetFile = fs.existsSync(permFile) ? permFile : (fs.existsSync(cachedFile) ? cachedFile : null);
    if (targetFile) {
      const fileData = JSON.parse(fs.readFileSync(targetFile, 'utf8').replace(/^\uFEFF/, ''));
      const totalBlocks = fileData.totalSummary || fileData.totalP1 || {};
      const p1Data = totalBlocks.P1 || totalBlocks;
      const combinedTotalP1 = {
        ...totalBlocks,
        ...p1Data,
        P1: p1Data,
      };
      return res.status(200).json({
        date: dateStr,
        blocks: ['P1', 'PER', 'SUB', 'MOU', 'DC'],
        rows: fileData.rows,
        groupSummaries: fileData.groupSummaries,
        totalP1: combinedTotalP1,
        totalSummary: totalBlocks,
      });
    }
  } catch (e) {
    // continue to live calculation
  }

  try {
    const { records, calMap } = await loadStandaloneRecords(month);
    const summaryRecords = await addDeptSummaryAttributes(records);

    // กรองเฉพาะบันทึกของวันที่เลือก (ใช้ dlh_effective_date_time เหมือนกับ MANPOWER DASHBOARD)
    const dayRows = summaryRecords.filter((r) => {
      if (isOtherFactoryRecord(r)) return false;
      return String(r.dlh_effective_date_time || '').startsWith(dateStr);
    });

    const isSun = new Date(`${dateStr}T00:00:00`).getDay() === 0;
    const calResult = calMap.get(dateStr);
    const isWorkingCalendarDay = calResult ? calResult === 'working day' : !isSun;

    // โครงสร้างมาตรฐานตามลำดับในเอกสาร
    const MATRIX_ITEMS = [
      // INDIRECT
      { group: 'INDIRECT', dept: 'HR', coc: 'P140', match: (r) => r.dept === 'HR' || r.source?.includes('P140') },
      { group: 'INDIRECT', dept: 'Acct', coc: 'P150', match: (r) => r.dept === 'ACCT' || r.dept === 'ACCOUNT' || r.source?.includes('P150') },
      { group: 'INDIRECT', dept: 'STR', coc: 'P160', match: (r) => r.dept === 'STR' || r.source?.includes('P160') },
      { group: 'INDIRECT', dept: 'LOG', coc: 'P170', match: (r) => r.dept === 'LOG' || r.source?.includes('P170') },
      { group: 'INDIRECT', dept: 'SE', coc: 'P180', match: (r) => r.dept === 'SE' || r.source?.includes('P180') },
      { group: 'INDIRECT', dept: 'SHE', coc: 'P220', match: (r) => r.dept === 'SHE' || r.source?.includes('P220') },
      { group: 'INDIRECT', dept: 'AUT', coc: 'P282', match: (r) => r.dept === 'AUT' || r.source?.includes('P282') },
      { group: 'INDIRECT', dept: 'PLN', coc: 'P310', match: (r) => r.dept === 'PLN' || r.source?.includes('P310') },
      { group: 'INDIRECT', dept: 'PTE', coc: 'P340', match: (r) => r.dept === 'PTE' || r.source?.includes('P340') || (r.dept === 'FIXTURE' && r.source?.includes('P340')) },
      { group: 'INDIRECT', dept: 'DIE', coc: 'P362', match: (r) => r.dept === 'DIE' || r.source?.includes('P362') },
      { group: 'INDIRECT', dept: 'FIXTURE', coc: 'P363', match: (r) => (r.dept === 'FIXTURE' || r.source?.includes('P363') || r.source?.includes('FIXTURE')) && !r.source?.includes('P340') },
      { group: 'INDIRECT', dept: 'NPM', coc: 'P366', match: (r) => r.dept === 'NPM' || r.source?.includes('P366') },
      { group: 'INDIRECT', dept: 'FPS', coc: 'P370', match: (r) => r.dept === 'FPS' || r.source?.includes('P370') },

      // QA
      { group: 'QA', dept: 'QA IND', coc: 'P330', match: (r) => r.source?.includes('QA IND') || r.source?.includes('P330') },
      { group: 'QA', dept: 'QA FPC', coc: 'P331', match: (r) => r.source?.includes('QA FPC') || r.source?.includes('P331') },
      { group: 'QA', dept: 'QA SMT', coc: 'P332', match: (r) => r.source?.includes('QA SMT') || r.source?.includes('P332') },
      { group: 'QA', dept: 'QA MDS', coc: 'P334', match: (r) => r.source?.includes('QA MDS') || r.source?.includes('P334') },

      // FPC
      { group: 'FPC', dept: 'TSTE', coc: 'P460', match: (r) => (r.dept === 'FPC' || r.source?.includes('P460-1')) && (r.source?.includes('TSTE FPC') || r.source?.includes('F_TSTE') || (r.source?.includes('TSTE') && !r.source?.includes('SMT'))) },
      { group: 'FPC', dept: 'TECH', coc: 'P460', match: (r) => r.dept === 'FPC' && (r.source?.includes('FPC-TECH') || r.source?.includes('F_TECH') || r.source?.includes('P460-5')) },
      { group: 'FPC', dept: 'EXC_FPC', coc: 'P460', match: () => false },
      { group: 'FPC', dept: 'MAT', coc: 'P460', match: (r) => r.dept === 'FPC' && (r.source?.includes('FPC-MAT') || r.source?.includes('MATERIAL') || r.source?.includes('EXCESS-FPC') || r.source?.includes('EXC_FPC') || r.source?.includes('P460-3') || (r.source?.includes('MAT') && !r.source?.includes('SMT'))) },
      { group: 'FPC', dept: 'Hot press', coc: '', match: (r) => r.dept === 'FPC' && (r.source?.includes('/HPS') || r.source?.includes('HPS_PHP') || r.source?.includes('HOT PRESS')) },
      { group: 'FPC', dept: 'VAC', coc: '', match: (r) => r.dept === 'FPC' && (r.source?.includes('/VAC') || r.source?.includes('VACUUM')) },
      { group: 'FPC', dept: 'BLK', coc: 'P462', match: (r) => r.dept === 'FPC' && (r.source?.includes('/BLK') || r.source?.includes('P462')) },
      { group: 'FPC', dept: 'F-LAM', coc: '', match: (r) => r.dept === 'FPC' && !r.source?.includes('MDS') && (r.source?.includes('/LAM') || r.source?.includes('/ABL') || r.source?.includes('F-LAM')) },
      { group: 'FPC', dept: 'OST', coc: '', match: (r) => r.dept === 'FPC' && r.source?.includes('/OST') },
      { group: 'FPC', dept: 'AVI/K2', coc: '', match: (r) => r.dept === 'FPC' && (r.source?.includes('AVI_INS') || r.source?.includes('AVI/K2') || r.source?.includes('AVI')) },
      { group: 'FPC', dept: 'LINE A', coc: '', match: (r) => r.dept === 'FPC' && (r.source?.includes('/PA_') || r.source?.includes('LINE A') || r.source?.includes('LINE_A')) },
      { group: 'FPC', dept: 'LINE B', coc: '', match: (r) => r.dept === 'FPC' && (r.source?.includes('/PB_') || r.source?.includes('LINE B') || r.source?.includes('LINE_B')) },
      { group: 'FPC', dept: 'LINE C', coc: '', match: (r) => r.dept === 'FPC' && (r.source?.includes('/PC_') || r.source?.includes('LINE C') || r.source?.includes('LINE_C')) },
      { group: 'FPC', dept: 'LINE D', coc: '', match: (r) => r.dept === 'FPC' && (r.source?.includes('/PD_') || r.source?.includes('LINE D') || r.source?.includes('LINE_D')) },

      // SMT_F
      { group: 'SMT_F', dept: 'TSTE-F', coc: 'P500', match: (r) => r.source?.includes('P500-1') || r.source?.includes('S_TSTE-F') || (r.dept === 'SMT_F' && r.source?.includes('TSTE')) },
      { group: 'SMT_F', dept: 'TECH-F', coc: 'P500', match: (r) => (r.dept === 'SMT_F' || r.source?.includes('SMT-F') || r.source?.includes('SMT_F')) && (r.source?.includes('TECH-F') || r.source?.includes('TECH_F') || r.source?.includes('TECH')) },
      { group: 'SMT_F', dept: 'REW', coc: 'P550', match: (r) => r.dept === 'SMT_F' && (r.source?.includes('REW') || r.source?.includes('P550')) },
      { group: 'SMT_F', dept: 'X-Ray', coc: 'P510', match: (r) => r.dept === 'SMT_F' && (r.source?.includes('X-RAY') || r.source?.includes('XRAY')) },
      { group: 'SMT_F', dept: 'MOT', coc: 'P510', match: (r) => r.dept === 'SMT_F' && (r.source?.includes('MOT') && !r.source?.includes('AIX')) },
      { group: 'SMT_F', dept: 'AIX-MOT', coc: '', match: (r) => r.dept === 'SMT_F' && (r.source?.includes('AIX-MOT') || r.source?.includes('AIX_MOT')) },
      { group: 'SMT_F', dept: 'MAT', coc: 'P540', match: (r) => (r.dept === 'SMT_F' && !r.source?.includes('ASY') && !r.source?.includes('AELT') && (r.source?.includes('P540') || r.source?.includes('SMT_F-MAT') || (r.source?.includes('MAT') && !r.source?.includes('MAT-') && !r.source?.includes('MATERIAL')))) || (r.source?.includes('P540') && !r.source?.includes('ASY') && !r.source?.includes('AELT')) },

      // SMT_B
      { group: 'SMT_B', dept: 'TSTE-B', coc: 'P500', match: (r) => r.source?.includes('P500-2') || r.source?.includes('S_TSTE-B') },
      { group: 'SMT_B', dept: 'TECH-B', coc: 'P500', match: (r) => (r.dept === 'SMT_B' || r.source?.includes('SMT-B') || r.source?.includes('SMT_B')) && (r.source?.includes('TECH-B') || r.source?.includes('TECH_B')) },
      { group: 'SMT_B', dept: 'EXC_SMT', coc: 'P500', match: (r) => r.source?.includes('P500-3') || r.source?.includes('EXCESS-SMT') || r.source?.includes('EXC_SMT') },
      { group: 'SMT_B', dept: 'ASY1', coc: '', match: (r) => (r.dept === 'SMT_B' || r.source?.includes('ASY1')) && r.source?.includes('ASY1') },
      { group: 'SMT_B', dept: 'ASY2', coc: '', match: (r) => (r.dept === 'SMT_B' || r.source?.includes('ASY2')) && r.source?.includes('ASY2') },
      { group: 'SMT_B', dept: 'ASY3', coc: '', match: (r) => (r.dept === 'SMT_B' || r.source?.includes('ASY3')) && r.source?.includes('ASY3') },
      { group: 'SMT_B', dept: 'AELT', coc: '', match: (r) => r.dept === 'SMT_B' && r.source?.includes('AELT') },
      { group: 'SMT_B', dept: 'LAM', coc: 'P560', match: (r) => r.dept === 'SMT_B' && (r.source?.includes('P560-6') || (r.source?.includes('LAM') && !r.source?.includes('MD') && !r.source?.includes('AIX'))) },
      { group: 'SMT_B', dept: 'BLK', coc: 'P520', match: (r) => r.dept === 'SMT_B' && (r.source?.includes('P520-2') || (r.source?.includes('BLK') && !r.source?.includes('AIX'))) },
      { group: 'SMT_B', dept: 'LAM MD', coc: '', match: (r) => r.dept === 'SMT_B' && (r.source?.includes('LAM MD') || r.source?.includes('MD-LAM') || r.source?.includes('MD_LAM')) },
      { group: 'SMT_B', dept: 'MDLAM', coc: '', match: (r) => r.dept === 'SMT_B' && (r.source?.includes('MDLAM')) },
      { group: 'SMT_B', dept: 'AIX-ASY', coc: '', match: (r) => (r.dept === 'SMT_B' || r.source?.includes('AIX')) && (r.source?.includes('AIX-ASY') || r.source?.includes('AIX_ASY') || r.source?.includes('AIX-INT') || r.source?.includes('AIX_INT') || r.source?.includes('AIX-ELT')) },
      { group: 'SMT_B', dept: 'AIX-BLK', coc: '', match: (r) => (r.dept === 'SMT_B' || r.source?.includes('AIX')) && (r.source?.includes('AIX-BLK') || r.source?.includes('AIX_BLK')) },

      // MDS
      { group: 'MDS', dept: 'MDS-TS', coc: 'P700', match: (r) => r.dept === 'MDS' && (r.source?.includes('P700') || r.source?.includes('MDS-TS') || r.source?.includes('MDS_TS')) },
      { group: 'MDS', dept: 'MDS', coc: 'P764', match: (r) => (r.dept === 'MDS' || r.source?.includes('P764')) && !r.source?.includes('QA') },
    ];

    // จัดเตรียม Bucket รายคน โดยใช้เกณฑ์เดียวกับ MANPOWER DASHBOARD
    // ⚠️ กฎสำคัญ: MANPOWER DASHBOARD ไม่นับคนไปช่วย (Help Out / Loan Out) เป็นคนขาด
    const personMap = new Map();
    dayRows.forEach((r) => {
      const id = String(r.dlh_employee_id || r.employee_id || '').trim();
      if (!id) return;

      // ตรวจสอบว่าพนักงานมีเหตุการณ์ไปช่วยงานหรือไม่ (Help Out / Loan Out)
      const hasHelpEvent = Boolean(r.line_in || r.loan_destination || r.is_loan_exclude || (Number(r.help_hour) || 0) > 0);

      // ถ้าเป็นคนไปช่วยงาน จะไม่นับเป็นการขาดงานเด็ดขาด (อิงตาม MANPOWER DASHBOARD)
      const isAbsent = !hasHelpEvent && isWorkingCalendarDay ? shouldCountAsAbsent(r, isWorkingCalendarDay) : false;
      const isPresent = shouldCountAsPresent(r);
      const hasOt = Number(r.OT || 0) > 0;
      const source = [r.emp_department, r.department, r.dept, r.line, r.line_check, r.mhr_cc_type]
        .map((s) => String(s || '').toUpperCase())
        .join(' | ');

      const cur = personMap.get(id) || {
        id,
        dept: r.dept,
        deptType: r.deptType || '',
        supportType: r.supportType || '',
        source,
        present: false,
        absent: false,
        ot: false,
        isHelping: false,
      };
      cur.present ||= isPresent;
      cur.absent ||= isAbsent;
      cur.ot ||= hasOt;
      cur.isHelping ||= hasHelpEvent;
      personMap.set(id, cur);
    });

    // ตรวจสอบขั้นสุดท้าย: ถ้าพนักงานคนนั้นมี record ที่เป็นคนไปช่วยงาน ให้เคลียร์ absent เป็น false ทันที
    personMap.forEach((p) => {
      if (p.isHelping) {
        p.absent = false;
      }
    });

    const persons = Array.from(personMap.values());

    // คำนวณแต่ละ Block: P1 (โรงงานรวม), PER, SUB (Subcontractor/MPS/SMT), MOU (MOU/MDS), DC
    const BLOCKS = ['P1', 'PER', 'SUB', 'MOU', 'DC'];

    const filterPersonForBlock = (p, block) => {
      if (block === 'P1') return true;
      const s = p.source;
      const id = String(p.id || '').trim().toUpperCase();

      const isSubId = id.startsWith('S');
      const isDc = p.supportType === 'DC' || (s.includes('DC') && !s.includes('DCC') && !s.includes('P330') && !s.includes('P764'));
      const isMou = p.supportType === 'MOU' || s.includes('MOU') || id === '7051838';

      if (block === 'DC') return isDc;
      if (block === 'MOU') return isMou && !isDc;
      if (block === 'SUB') {
        if (isDc || isMou) return false;
        return isSubId || p.supportType === 'SUB' || p.supportType === 'MPS' || s.includes('SUB') || s.includes('MPS') || s.includes('VDS') || s.includes('PIMB');
      }
      if (block === 'PER') {
        if (isSubId || isDc || isMou) return false;
        if (p.supportType === 'SUB' || p.supportType === 'MPS') return false;
        return true;
      }
      return false;
    };

    // ดึง Snapshot สำหรับวันที่เลือก (ถ้ามี) จาก tbl_manhour_snapshot
    const parts = dateStr.split('-');
    const effDate = `${parseInt(parts[2], 10)}/${parseInt(parts[1], 10)}/${parts[0]}`;
    const snapRes = await pool_test.query(
      'SELECT employee_id, dept, line, department, sect FROM tbl_manhour_snapshot WHERE effective_date_time = $1',
      [effDate]
    ).catch(() => ({ rows: [] }));
    const snapMap = new Map();
    (snapRes.rows || []).forEach((r) => snapMap.set(String(r.employee_id).trim(), r));

    // กำหนดให้พนักงาน 1 คนสังกัดเพียง 1 แผนกอย่างชัดเจน (Unique assignment ไม่ให้นับซ้ำ)
    const mapSnapshotToItem = (snap, p) => {
      const d = snap ? snap.dept : p.dept;
      const l = snap ? snap.line : '';
      const deptm = String(snap ? snap.department : p.source || '');

      // 1. QA (แยกตาม COC P330, P331, P332, P334)
      if (d === 'QA' || deptm.includes('P33') || p.source.includes('P33')) {
        if (deptm.includes('P330')) return { group: 'QA', dept: 'QA IND' };
        if (deptm.includes('P331')) return { group: 'QA', dept: 'QA FPC' };
        if (deptm.includes('P332')) return { group: 'QA', dept: 'QA SMT' };
        if (deptm.includes('P334')) return { group: 'QA', dept: 'QA MDS' };
      }

      // 2. INDIRECT
      if (d === 'HR' || deptm.includes('P140')) return { group: 'INDIRECT', dept: 'HR' };
      if (d === 'ACCT' || d === 'Acct' || deptm.includes('P150')) return { group: 'INDIRECT', dept: 'Acct' };
      if (d === 'STR' || deptm.includes('P160')) return { group: 'INDIRECT', dept: 'STR' };
      if (d === 'LOG' || deptm.includes('P170')) return { group: 'INDIRECT', dept: 'LOG' };
      if (d === 'SE' || deptm.includes('P180')) return { group: 'INDIRECT', dept: 'SE' };
      if (d === 'SHE' || deptm.includes('P220')) return { group: 'INDIRECT', dept: 'SHE' };
      if (d === 'AUT' || deptm.includes('P282')) return { group: 'INDIRECT', dept: 'AUT' };
      if (d === 'PLN' || deptm.includes('P310')) return { group: 'INDIRECT', dept: 'PLN' };
      if (d === 'PTE' || deptm.includes('P340')) return { group: 'INDIRECT', dept: 'PTE' };
      if (l === 'DIE' || (d === 'TOOL' && l === 'DIE') || deptm.includes('P362')) return { group: 'INDIRECT', dept: 'DIE' };
      if (l === 'FIX' || l === 'FIXTURE' || deptm.includes('P363') || (d === 'TOOL' && (l === 'TOOL_FPC' || l === 'TOOL_SMT' || l === 'FIX'))) return { group: 'INDIRECT', dept: 'FIXTURE' };
      if (d === 'NPM' || deptm.includes('P366')) return { group: 'INDIRECT', dept: 'NPM' };
      if (d === 'FPS' || deptm.includes('P370')) return { group: 'INDIRECT', dept: 'FPS' };

      // 3. FPC
      if (d === 'FPC' || deptm.includes('P46')) {
        if (l === 'F_TSTE' || l === 'TSTE') return { group: 'FPC', dept: 'TSTE' };
        if (l === 'F_TECH' || l === 'TECH') return { group: 'FPC', dept: 'TECH' };
        if (String(l || '').toUpperCase().includes('HOT PRESS') || String(l || '').toUpperCase().includes('HOT_PRESS')) return { group: 'FPC', dept: 'Hot press' };
        if (l === 'VAC') return { group: 'FPC', dept: 'VAC' };
        if (l === 'BLK') return { group: 'FPC', dept: 'BLK' };
        if (l === 'OST') return { group: 'FPC', dept: 'OST' };
        if (l === 'AVI/K2' || String(l || '').includes('AVI')) return { group: 'FPC', dept: 'AVI/K2' };
        if (String(l || '').startsWith('LINE A') || String(l || '').startsWith('LINE_A') || l === 'AT_LAM' || l === 'AT_VAC' || l === 'AT_FRONT') return { group: 'FPC', dept: 'LINE A' };
        if (String(l || '').startsWith('LINE B') || String(l || '').startsWith('LINE_B')) return { group: 'FPC', dept: 'LINE B' };
        if (String(l || '').startsWith('LINE C') || String(l || '').startsWith('LINE_C')) return { group: 'FPC', dept: 'LINE C' };
        if (String(l || '').startsWith('LINE D') || String(l || '').startsWith('LINE_D')) return { group: 'FPC', dept: 'LINE D' };
        if (l === 'F-LAM') return { group: 'FPC', dept: 'F-LAM' };
        if (l === 'MATERIAL' || l === 'MAT') return { group: 'FPC', dept: 'MAT' };
        if (l === 'MDS') {
          if (deptm.includes('P764-1D')) return { group: 'MDS', dept: 'MDS' };
          return { group: 'FPC', dept: 'F-LAM' };
        }
        if (l === 'F_IND' || l === 'IND' || l === 'EXC_FPC') return { group: 'FPC', dept: 'MAT' };
      }

      // 4. SMT_F
      if (d === 'SMT_F' || deptm.includes('P51') || deptm.includes('P54') || deptm.includes('P55')) {
        if (l === 'S_TSTE-F' || l === 'TSTE-F') return { group: 'SMT_F', dept: 'TSTE-F' };
        if (l === 'S_TECH-F' || l === 'TECH-F') return { group: 'SMT_F', dept: 'TECH-F' };
        if (l === 'REW' || l === 'MAS') return { group: 'SMT_F', dept: 'REW' };
        if (l === 'X-RAY' || l === 'X-Ray') return { group: 'SMT_F', dept: 'X-Ray' };
        if (l && l.startsWith('MOT')) return { group: 'SMT_F', dept: 'MOT' };
        if (l === 'AIX-MOT') return { group: 'SMT_F', dept: 'AIX-MOT' };
        if ((l && l.startsWith('ASTP')) || l === 'S_IND' || l === 'MAT') return { group: 'SMT_F', dept: 'MAT' };
      }

      // 5. SMT_B
      if (d === 'SMT_B' || deptm.includes('P52') || deptm.includes('P56')) {
        if (l === 'S_TSTE-B' || l === 'TSTE-B') return { group: 'SMT_B', dept: 'TSTE-B' };
        if (l === 'S_TECH-B' || l === 'TECH-B') return { group: 'SMT_B', dept: 'TECH-B' };
        if (l && l.startsWith('ASY1')) return { group: 'SMT_B', dept: 'ASY1' };
        if (l === 'ASY2') return { group: 'SMT_B', dept: 'ASY2' };
        if (l === 'ASY3') return { group: 'SMT_B', dept: 'ASY3' };
        if (l === 'AELT') return { group: 'SMT_B', dept: 'AELT' };
        if (l === 'SMT_LAM' || l === 'LAM') return { group: 'SMT_B', dept: 'LAM' };
        if (l === 'BLK-2' || l === 'BLK') return { group: 'SMT_B', dept: 'BLK' };
        if (l === 'LAM MD') return { group: 'SMT_B', dept: 'LAM MD' };
        if (l === 'MDLAM') return { group: 'SMT_B', dept: 'MDLAM' };
        if (l === 'AIX-BLK') return { group: 'SMT_B', dept: 'AIX-BLK' };
        if (l === 'AIX-ASY') return { group: 'SMT_B', dept: 'AIX-ASY' };
        if (l === 'S_IND' || l === 'EXC_SMT') return { group: 'SMT_B', dept: 'EXC_SMT' };
      }

      // 6. MDS
      if (d === 'MDS' || deptm.includes('P70') || deptm.includes('P764')) {
        if (l && l.includes('TS')) return { group: 'MDS', dept: 'MDS-TS' };
        if (l === 'MATERIAL' || l === 'MAT') return { group: 'FPC', dept: 'MAT' };
        return { group: 'MDS', dept: 'MDS' };
      }

      return null;
    };

    const personAssignedItemIndex = new Map();
    let masterEmpDeptMap = null;
    try {
      const mapPath = path.join(process.cwd(), 'Utility', 'empDeptMap.json');
      if (fs.existsSync(mapPath)) {
        masterEmpDeptMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      }
    } catch (e) {}

    persons.forEach((p) => {
      if (masterEmpDeptMap && masterEmpDeptMap[p.id]) {
        const empMapEntry = masterEmpDeptMap[p.id];
        if (typeof empMapEntry.itemIdx === 'number' && empMapEntry.itemIdx >= 0 && empMapEntry.itemIdx < MATRIX_ITEMS.length) {
          personAssignedItemIndex.set(p.id, empMapEntry.itemIdx);
          return;
        }
        const targetGroup = empMapEntry.group || empMapEntry.colO;
        const targetDept = empMapEntry.dept;
        const targetCoc = empMapEntry.coc;
        const mapIdx = MATRIX_ITEMS.findIndex((item) => {
          if (targetGroup && item.group !== targetGroup) return false;
          if (item.dept.toLowerCase() === targetDept.toLowerCase()) return true;
          if (targetCoc && item.coc === targetCoc && item.dept === targetDept) return true;
          return false;
        });
        if (mapIdx !== -1) {
          personAssignedItemIndex.set(p.id, mapIdx);
          return;
        }
      }

      // 1. ถ้ามีข้อมูลใน Snapshot ให้ใช้ Snapshot นำทาง
      const snap = snapMap.get(p.id);
      if (snap) {
        const target = mapSnapshotToItem(snap, p);
        if (target) {
          const snapIdx = MATRIX_ITEMS.findIndex((item) => item.group === target.group && item.dept === target.dept);
          if (snapIdx !== -1) {
            personAssignedItemIndex.set(p.id, snapIdx);
            return;
          }
        }
      }

      // 2. ค้นหา item แรกที่ตรงเงื่อนไข match
      const idx = MATRIX_ITEMS.findIndex((item) => item.match(p));
      if (idx !== -1) {
        personAssignedItemIndex.set(p.id, idx);
      } else {
        // 3. ถ้าไม่ตรงเงื่อนไขพิเศษใดๆ ให้ตกไปที่แผนกหลักตาม dept
        const fallbackIdx = MATRIX_ITEMS.findIndex((item) => item.dept === p.dept || item.group === p.dept);
        if (fallbackIdx !== -1) {
          personAssignedItemIndex.set(p.id, fallbackIdx);
        }
      }
    });

    // คำนวณตาราง Matrix ละเอียด
    const rows = MATRIX_ITEMS.map((item, itemIdx) => {
      const blockData = {};

      BLOCKS.forEach((block) => {
        const matched = persons.filter((p) => {
          if (!filterPersonForBlock(p, block)) return false;
          // พนักงาน 1 คน นับสังกัดเพียง 1 แผนกเท่านั้น ไม่ให้นับเบิ้ล
          const assignedIdx = personAssignedItemIndex.get(p.id);
          return assignedIdx === itemIdx;
        });

        const mp = matched.length;
        const work = matched.filter((p) => p.present).length;
        const leave = matched.filter((p) => p.absent).length;
        const ot = matched.filter((p) => p.ot).length;
        const leaveRatio = mp > 0 ? Math.round((leave / mp) * 1000) / 10 : 0;
        const otRatio = work > 0 ? Math.round((ot / work) * 1000) / 10 : 0;

        blockData[block] = { mp, work, leave, ot, leaveRatio, otRatio };
      });

      return {
        group: item.group,
        dept: item.dept,
        coc: item.coc,
        blocks: blockData,
      };
    });

    // คำนวณผลรวมของแต่ละ Group ใหญ่ (INDIRECT, QA, FPC, SMT_F, SMT_B, MDS)
    const groupSummaries = {};
    ['INDIRECT', 'QA', 'FPC', 'SMT_F', 'SMT_B', 'MDS'].forEach((grp) => {
      const grpRows = rows.filter((r) => r.group === grp);
      const grpBlocks = {};
      BLOCKS.forEach((blk) => {
        const mp = grpRows.reduce((sum, r) => sum + r.blocks[blk].mp, 0);
        const work = grpRows.reduce((sum, r) => sum + r.blocks[blk].work, 0);
        const leave = grpRows.reduce((sum, r) => sum + r.blocks[blk].leave, 0);
        const ot = grpRows.reduce((sum, r) => sum + r.blocks[blk].ot, 0);
        const leaveRatio = mp > 0 ? Math.round((leave / mp) * 1000) / 10 : 0;
        const otRatio = work > 0 ? Math.round((ot / work) * 1000) / 10 : 0;
        grpBlocks[blk] = { mp, work, leave, ot, leaveRatio, otRatio };
      });
      groupSummaries[grp] = grpBlocks;
    });

    // คำนวณ Total P1 รวมทั้งโรงงาน 
    const totalP1 = {};
    BLOCKS.forEach((blk) => {
      const mp = rows.reduce((sum, r) => sum + r.blocks[blk].mp, 0);
      const work = rows.reduce((sum, r) => sum + r.blocks[blk].work, 0);
      const leave = rows.reduce((sum, r) => sum + r.blocks[blk].leave, 0);
      const ot = rows.reduce((sum, r) => sum + r.blocks[blk].ot, 0);
      const leaveRatio = mp > 0 ? Math.round((leave / mp) * 1000) / 10 : 0;
      const otRatio = work > 0 ? Math.round((ot / work) * 1000) / 10 : 0;
      totalP1[blk] = { mp, work, leave, ot, leaveRatio, otRatio };
    });

    return res.status(200).json({
      date: dateStr,
      blocks: BLOCKS,
      rows,
      groupSummaries,
      totalP1,
    });
  } catch (err) {
    console.error('⚠️ [deptSummary/daily_matrix] Error:', err.message);
    return res.status(500).json({
      error: 'Unable to calculate daily matrix',
      errorMessage: err.message,
    });
  }
});

// ==============================================
// ⚙️ API Endpoints: Manage Mappings (เชื่อมต่อทั้ง Monthly และ Daily)
// GET    /matrix_mapping       - ดึงรายการ Mapping ทั้งหมด
// POST   /matrix_mapping       - เพิ่มหรือแก้ไขรายการ Mapping
// DELETE /matrix_mapping/:id   - ลบรายการ Mapping
// ==============================================
router.get('/matrix_mapping', async (req, res) => {
  try {
    const mappings = await getDbLineMappings();
    return res.status(200).json({ ok: true, data: mappings });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/matrix_mapping', async (req, res) => {
  const { id, group_name, dept_name, coc_code, keywords, order_seq } = req.body;
  try {
    if (!dept_name || !group_name) {
      return res.status(400).json({ ok: false, error: 'dept_name and group_name are required' });
    }
    const cleanKeywords = Array.isArray(keywords) ? keywords.map(k => String(k).trim()).filter(Boolean) : [];

    if (id) {
      // อัปเดตรายการเดิม
      await pool_test.query(`
        UPDATE daily_matrix_line_mappings
        SET group_name = $1, dept_name = $2, coc_code = $3, keywords = $4::jsonb, order_seq = $5, updated_at = NOW()
        WHERE id = $6
      `, [group_name, dept_name, coc_code || '', JSON.stringify(cleanKeywords), Number(order_seq) || 0, id]);
    } else {
      // เพิ่มรายการใหม่
      await pool_test.query(`
        INSERT INTO daily_matrix_line_mappings (group_name, dept_name, coc_code, keywords, order_seq, is_active, updated_at)
        VALUES ($1, $2, $3, $4::jsonb, $5, true, NOW())
      `, [group_name, dept_name, coc_code || '', JSON.stringify(cleanKeywords), Number(order_seq) || 0]);
    }

    // ล้างแคชเพื่อให้การเปลี่ยนแปลงมีผลทันทีทั้งรายเดือนและรายวัน
    dbLineMappingsCache = null;
    lastDbMappingFetch = 0;
    cache.clear();

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete('/matrix_mapping/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool_test.query('DELETE FROM daily_matrix_line_mappings WHERE id = $1', [id]);
    dbLineMappingsCache = null;
    lastDbMappingFetch = 0;
    cache.clear();
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
module.exports.default = router;
module.exports.loadStandaloneRecords = loadStandaloneRecords;
module.exports.addDeptSummaryAttributes = addDeptSummaryAttributes;
module.exports.isOtherFactoryRecord = isOtherFactoryRecord;
module.exports.inferDepartment = inferDepartment;
