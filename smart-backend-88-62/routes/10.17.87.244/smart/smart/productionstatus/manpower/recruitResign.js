// ==========================================
// 📊 API Router: RECRUIT & RESIGN (100% PURE REAL DATABASE)
// Dedicated router for Recruit & Resign Tracking & Matrix Breakdown
// เส้นทาง API แยกอิสระ: /api_p1/production_status/mh/recruit_resign
// ดึงข้อมูลจริงทั้งหมด 100% จากฐานข้อมูล (smart_man_time_attendance, tbl_employee_help, tbl_date, ฯลฯ)
// ไม่มีข้อมูล mock / baseline แข็งแกร่งและรองรับการบันทึก recruit / resign
// ==========================================

const express = require('express');
const { pool_ot, pool_test, queryWithRetry, queryWithRetryPool1 } = require('../../../../config.js');
const { getOrRevalidate, invalidateMonth } = require('../../../../../../Utility/cacheManager.js');
const { shouldCountAsPresent } = require('../../../../../../Utility/manpowerAggregation.js');

const router = express.Router();

/**
 * แปลงเวลา (Date/Timestamp) ให้เป็นจำนวนนาทีตั้งแต่ 00:00
 */
function getTimeMinutes(rawTime) {
  if (!rawTime) return -1;
  const d = new Date(rawTime);
  if (isNaN(d.getTime())) return -1;
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * ตรวจสอบว่าพนักงานทำงานล่วงเวลา (OT) หรือไม่จากเวลาสแกนบัตรและกะ
 */
function isPersonDoingOt(row, emp) {
  const inMin = getTimeMinutes(row.scan_time_in);
  const outMin = getTimeMinutes(row.scan_time_out);
  const shift = String(emp?.shift || row.work_status || '').toUpperCase();

  // กะกลางวัน (Day Shift): เวลาเลิกงานปกติ ~16:30/17:00 ถ้าสแกนออก >= 19:30 หรือทำงาน >= 10.5 ชม. = OT
  if (inMin >= 2 * 60 && inMin <= 14 * 60) {
    if (outMin >= 19 * 60 + 30 || (outMin >= 0 && outMin <= 5 * 60 && inMin >= 2 * 60)) return true;
    if (outMin > inMin && (outMin - inMin) >= 10.5 * 60) return true;
  }
  // กะกลางคืน (Night Shift): เวลาเลิกงานปกติ ~04:30/05:00 ถ้าสแกนออก >= 07:30 = OT
  if (inMin >= 18 * 60 && inMin <= 23 * 60) {
    if (outMin >= 7 * 60 + 30 && outMin <= 12 * 60) return true;
  }
  if (shift === 'B' || shift === 'NIGHT') {
    if (outMin >= 7 * 60 + 30 && outMin <= 12 * 60) return true;
  }
  const ws = String(row.work_status || '').toUpperCase();
  if (ws.includes('OT')) return true;

  return false;
}

/**
 * จัดกลุ่มประเภทพนักงาน (MPS, MOU, DC, PER, IND, ALL)
 */
function isTargetGroup(empId, emp, group) {
  const grp = String(group || 'MPS').trim().toUpperCase();
  const st = String(emp?.status || '').toUpperCase();
  const id = String(empId || '').toUpperCase();

  if (grp === 'MPS' || grp === 'SUBCONTRACT') {
    return st === 'MPS' || st === 'VDS' || st === 'PIMB' || id.startsWith('S');
  } else if (grp === 'MOU') {
    return st === 'MOU' || id.startsWith('M');
  } else if (grp === 'DC') {
    return st === 'DC' || id.startsWith('D');
  } else if (grp === 'PER' || grp === 'PERMANENT') {
    return st === 'PER' || st === 'PERMANENT' || (!st && !id.startsWith('S') && !id.startsWith('M') && !id.startsWith('D'));
  } else if (grp === 'IND' || grp === 'INDIRECT') {
    const dept = String(emp?.dept || '').toUpperCase();
    const line = String(emp?.line || '').toUpperCase();
    return !['FPC', 'SMT_F', 'SMT_B', 'MDS'].includes(dept) || line.includes('TECH') || line.includes('MAT');
  }
  return true;
}

/**
 * แยกสายงานแผนกย่อย (Indirect 1, Indirect 2, Direct 1 - FPC, Direct 2 - SMT)
 */
function getSubCategory(emp) {
  const dept = String(emp?.dept || '').toUpperCase();
  const line = String(emp?.line || '').toUpperCase();
  const department = String(emp?.department || '').toUpperCase();

  const IND1_DEPTS = ['HR', 'ACCT', 'STR', 'SE', 'SHE', 'AUT', 'PLN', 'PTE', 'FPS', 'NPM', 'QA'];
  const IND2_DEPTS = ['LOG', 'DIE', 'FIX', 'FIXTURE', 'MAT', 'MATERIAL', 'TECH', 'TSTE'];

  if (dept === 'FPC') {
    if (IND2_DEPTS.some(d => line.includes(d))) return 'ind2';
    return 'dir1';
  }
  if (dept === 'SMT_F' || dept === 'SMT_B' || dept === 'SMT') {
    if (IND2_DEPTS.some(d => line.includes(d))) return 'ind2';
    return 'dir2';
  }
  if (dept === 'MDS') {
    if (IND2_DEPTS.some(d => line.includes(d))) return 'ind2';
    return 'mds';
  }
  if (IND2_DEPTS.some(d => dept.includes(d) || line.includes(d))) {
    return 'ind2';
  }
  if (IND1_DEPTS.some(d => dept.includes(d) || department.includes(d))) {
    return 'ind1';
  }
  return 'ind1';
}

/**
 * ดึงข้อมูลปฏิทินจาก tbl_date
 */
async function getCalendarMap(month) {
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
    if (r.w_date) calMap.set(String(r.w_date), String(r.w_result || '').toLowerCase());
  });
  return calMap;
}

/**
 * ดึงข้อมูลบันทึก Recruit / Resign ที่ผู้ใช้บันทึกในฐานข้อมูล Test
 */
async function getUserCustomEntries(month, group) {
  try {
    const rows = await pool_test.query(`
      SELECT day_number, recruit, resign, acc_recruit
      FROM public.manpower_recruit_resign_entries
      WHERE month = $1 AND group_name = $2
      ORDER BY day_number ASC
    `, [month, group]).then(r => r.rows || []).catch(() => []);

    const userMap = new Map();
    rows.forEach(r => userMap.set(Number(r.day_number), {
      recruit: Number(r.recruit || 0),
      resign: Number(r.resign || 0),
      accRecruit: r.acc_recruit !== null && r.acc_recruit !== undefined ? Number(r.acc_recruit) : null
    }));

    // คำนวณ initialBalance ตั้งต้นจากข้อมูลวันแรก
    const day1 = userMap.get(1);
    let initialBalance = null;
    if (day1 && day1.accRecruit !== null && day1.accRecruit !== undefined) {
      initialBalance = day1.accRecruit - day1.recruit + day1.resign;
    }

    return { userMap, initialBalance };
  } catch (err) {
    console.warn('⚠️ [recruitResign] Error reading custom entries:', err.message);
    return { userMap: new Map(), initialBalance: null };
  }
}

/**
 * ฟังก์ชันคำนวณข้อมูล Recruit & Resign และ Matrix Breakdown จากฐานข้อมูล
 */
async function computeRecruitResignData(month, group) {
  // 1. ดึงปฏิทินวันหยุด / วันทำงานจาก tbl_date
  const calMap = await getCalendarMap(month);

  // 2. ดึงข้อมูล Recruit / Resign ที่ผู้ใช้บันทึก
  const { userMap, initialBalance } = await getUserCustomEntries(month, group);

  // 3. ดึง Master พนักงานจาก tbl_employee_help และ tbl_employee
  const allEmployees = await pool_ot.query(`
    SELECT h.code, h.name, h.department, h.dept, h.shift, h.line, h.job_grade,
           e.status, e.group_level, e.sect
    FROM tbl_employee_help h
    LEFT JOIN tbl_employee e ON h.code = e.code
  `).catch(() => []);
  const empRows = Array.isArray(allEmployees) ? allEmployees : (allEmployees?.rows || []);
  const employeeMap = new Map(empRows.map((emp) => [String(emp.code || '').trim(), emp]));

  // 4. ดึงข้อมูลการรูดบัตรเข้า-ออกจาก smart.smart_man_time_attendance
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
  const attRows = Array.isArray(attendance) ? attendance : (attendance?.rows || []);

  // 4.1 ดึงข้อมูลการยืมตัวข้ามโรงงานเพื่อตัดคนไปช่วย N1, K1, A1 ออกเฉพาะในตาราง Matrix นี้
  const loanRows = await pool_test.query(`
    SELECT employee_id, destination, department, start_date, end_date
    FROM manpower_loan_exclude
    WHERE is_active = true OR is_active::text = '1' OR is_active::text ILIKE 'true'
  `).then(r => r.rows || []).catch(() => []);

  const parseLoanDate = (d) => {
    if (!d) return '';
    try {
      const dt = d instanceof Date ? d : new Date(d);
      if (isNaN(dt.getTime())) return '';
      return new Intl.DateTimeFormat('en-CA', {
        year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Bangkok'
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

  // 4.2 ดึงข้อมูล Matrix ประจำกลุ่มย่อยจากฐานข้อมูล PostgreSQL
  const matrixRows = await pool_test.query(`
    SELECT day_number,
           ind1_mp, ind1_att, ind1_ot, ind1_ot_pct, ind1_acc_pct,
           ind2_mp, ind2_att, ind2_ot, ind2_ot_pct, ind2_acc_pct,
           tot_ind_mp, tot_ind_att, tot_ind_ot, tot_ind_ot_pct, tot_ind_acc_pct,
           dir1_mp, dir1_att, dir1_ot, dir1_ot_pct, dir1_acc_pct,
           dir2_mp, dir2_att, dir2_ot, dir2_ot_pct, dir2_acc_pct,
           tot_dir_mp, tot_dir_att, tot_dir_ot, tot_dir_ot_pct, tot_dir_acc_pct
    FROM public.manpower_recruit_resign_matrix_entries
    WHERE month = $1 AND group_name = $2
    ORDER BY day_number ASC
  `, [month, group]).then(r => r.rows || []).catch(() => []);

  const matrixDbMap = new Map();
  matrixRows.forEach(r => matrixDbMap.set(Number(r.day_number), r));

  const [yearNum, monthNum] = month.split('-').map(Number);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();

  // หาพนักงานทั้งหมดในกลุ่มเป้าหมาย (สำหรับ Initial Balance Fallback)
  const allTargetEmps = Array.from(employeeMap.values()).filter(e => isTargetGroup(e.code, e, group));
  const fallbackInitialBalance = allTargetEmps.length || 0;

  let currentBalance = initialBalance !== null ? initialBalance : fallbackInitialBalance;

  let cumInd1Att = 0, cumInd1Ot = 0;
  let cumInd2Att = 0, cumInd2Ot = 0;
  let cumTotIndAtt = 0, cumTotIndOt = 0;
  let cumDir1Att = 0, cumDir1Ot = 0;
  let cumDir2Att = 0, cumDir2Ot = 0;
  let cumTotDirAtt = 0, cumTotDirOt = 0;

  const daysData = [];

  const maxAttDay = attRows.reduce((max, r) => {
    const dt = String(r.dlh_effective_date_time || '').slice(8, 10);
    return Math.max(max, Number(dt) || 0);
  }, 0);

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    const dayDate = new Date(`${dateStr}T00:00:00`);
    const dayOfWeek = dayDate.getDay();
    const calRes = calMap.get(dateStr);
    const isWorkingCalendarDay = calRes ? calRes === 'working day' : (dayOfWeek !== 0 && dayOfWeek !== 6);
    const isHoliday = calRes === 'holiday' || (!calRes && (dayOfWeek === 0 || dayOfWeek === 6));

    const dayRows = attRows.filter(r => String(r.dlh_effective_date_time || '').startsWith(dateStr));
    const hasUserEntry = userMap.has(d);
    const userEntry = userMap.get(d);
    const hasAttendance = dayRows.length > 0;
    const hasExplicitUserEntry = hasUserEntry && (userEntry.recruit > 0 || userEntry.resign > 0 || userEntry.accRecruit !== null);
    const hasData = (maxAttDay > 0 && d <= maxAttDay) || hasAttendance || hasExplicitUserEntry;

    let recruit = null;
    let resign = null;
    let accRecruit = null;
    let resignRatio = null;

    if (hasData) {
      recruit = hasUserEntry ? userEntry.recruit : 0;
      resign = hasUserEntry ? userEntry.resign : 0;

      if (hasUserEntry && userEntry.accRecruit !== null) {
        accRecruit = userEntry.accRecruit;
        currentBalance = accRecruit;
      } else {
        currentBalance = currentBalance + recruit - resign;
        accRecruit = Math.max(0, currentBalance);
      }

      resignRatio = accRecruit > 0 ? Number((resign / accRecruit * 100).toFixed(1)) : 0;
    }

    // คำนวณ Attendance และ OT จากฐานข้อมูลจริง (ไม่นับคนไปช่วยงาน factory อื่น เฉพาะตาราง Matrix นี้)
    const uniqueMap = new Map();
    dayRows.forEach(r => {
      const empId = String(r.dlh_employee_id || '').trim();
      const emp = employeeMap.get(empId);
      if (!isTargetGroup(empId, emp, group)) return;

      // ตรวจสอบว่าไปช่วย factory อื่นหรือไม่ (Loan Exclude หรือสถานะ 1N)
      const dateKey = String(r.dlh_effective_date_time || '').slice(0, 10);
      const empLoans = loanByEmpMap.get(empId);
      const matchingLoan = empLoans ? empLoans.find((l) => {
        if (l.sDate && dateKey < l.sDate) return false;
        if (l.eDate && dateKey > l.eDate) return false;
        return true;
      }) : null;
      const isLoanExclude = Boolean(matchingLoan);
      const is1N = String(r.work_day_status || '').trim().toUpperCase().startsWith('1N');

      // ไม่นับคนที่ไปช่วย factory อื่น เฉพาะในตาราง Matrix นี้
      if (isLoanExclude || is1N) return;

      const isPresent = shouldCountAsPresent(r);
      const isOt = isPersonDoingOt(r, emp);
      const cat = getSubCategory(emp);

      if (!uniqueMap.has(empId)) {
        uniqueMap.set(empId, { empId, cat, isPresent, isOt });
      }
    });

    const activeList = Array.from(uniqueMap.values());
    const catCounts = {
      ind1: { mp: 0, attend: 0, ot: 0 },
      ind2: { mp: 0, attend: 0, ot: 0 },
      dir1: { mp: 0, attend: 0, ot: 0 },
      dir2: { mp: 0, attend: 0, ot: 0 },
      mds: { mp: 0, attend: 0, ot: 0 }
    };

    activeList.forEach(item => {
      if (catCounts[item.cat]) {
        catCounts[item.cat].mp++;
        if (item.isPresent && (!isHoliday || item.isPresent)) {
          catCounts[item.cat].attend++;
        }
        if (item.isOt) {
          catCounts[item.cat].ot++;
        }
      }
    });

    // คำนวณยอดรวม Indirect และ Direct
    const totInd = {
      mp: catCounts.ind1.mp + catCounts.ind2.mp,
      attend: catCounts.ind1.attend + catCounts.ind2.attend,
      ot: catCounts.ind1.ot + catCounts.ind2.ot
    };
    const totDir = {
      mp: catCounts.dir1.mp + catCounts.dir2.mp + catCounts.mds.mp,
      attend: catCounts.dir1.attend + catCounts.dir2.attend + catCounts.mds.attend,
      ot: catCounts.dir1.ot + catCounts.dir2.ot + catCounts.mds.ot
    };

    // ถ้าวันนั้นมีข้อมูล attendance ให้สะสมยอด
    if (hasData && activeList.length > 0) {
      cumInd1Att += catCounts.ind1.attend; cumInd1Ot += catCounts.ind1.ot;
      cumInd2Att += catCounts.ind2.attend; cumInd2Ot += catCounts.ind2.ot;
      cumTotIndAtt += totInd.attend;
      cumTotIndOt += totInd.ot;
      cumDir1Att += catCounts.dir1.attend; cumDir1Ot += catCounts.dir1.ot;
      cumDir2Att += catCounts.dir2.attend; cumDir2Ot += catCounts.dir2.ot;
      cumTotDirAtt += totDir.attend;
      cumTotDirOt += totDir.ot;
    }
    const calcOtPct = (ot, att) => att > 0 ? Number((ot / att * 100).toFixed(1)) : 0;

    // ดึงข้อมูล Matrix จากฐานข้อมูล หรือ Fallback คำนวณสด
    const dbMatrix = matrixDbMap.get(d);
    let categories;
    if (dbMatrix && hasData) {
      categories = {
        ind1: {
          mp: Number(dbMatrix.ind1_mp) || 0,
          attend: Number(dbMatrix.ind1_att) || 0,
          ot: Number(dbMatrix.ind1_ot) || 0,
          otPct: Number(dbMatrix.ind1_ot_pct) || 0,
          accOtPct: Number(dbMatrix.ind1_acc_pct) || 0
        },
        ind2: {
          mp: Number(dbMatrix.ind2_mp) || 0,
          attend: Number(dbMatrix.ind2_att) || 0,
          ot: Number(dbMatrix.ind2_ot) || 0,
          otPct: Number(dbMatrix.ind2_ot_pct) || 0,
          accOtPct: Number(dbMatrix.ind2_acc_pct) || 0
        },
        totInd: {
          mp: Number(dbMatrix.tot_ind_mp) || 0,
          attend: Number(dbMatrix.tot_ind_att) || 0,
          ot: Number(dbMatrix.tot_ind_ot) || 0,
          otPct: Number(dbMatrix.tot_ind_ot_pct) || 0,
          accOtPct: Number(dbMatrix.tot_ind_acc_pct) || 0
        },
        dir1: {
          mp: Number(dbMatrix.dir1_mp) || 0,
          attend: Number(dbMatrix.dir1_att) || 0,
          ot: Number(dbMatrix.dir1_ot) || 0,
          otPct: Number(dbMatrix.dir1_ot_pct) || 0,
          accOtPct: Number(dbMatrix.dir1_acc_pct) || 0
        },
        dir2: {
          mp: Number(dbMatrix.dir2_mp) || 0,
          attend: Number(dbMatrix.dir2_att) || 0,
          ot: Number(dbMatrix.dir2_ot) || 0,
          otPct: Number(dbMatrix.dir2_ot_pct) || 0,
          accOtPct: Number(dbMatrix.dir2_acc_pct) || 0
        },
        totDir: {
          mp: Number(dbMatrix.tot_dir_mp) || 0,
          attend: Number(dbMatrix.tot_dir_att) || 0,
          ot: Number(dbMatrix.tot_dir_ot) || 0,
          otPct: Number(dbMatrix.tot_dir_ot_pct) || 0,
          accOtPct: Number(dbMatrix.tot_dir_acc_pct) || 0
        }
      };
    } else if (hasData) {
      categories = {
        ind1: {
          mp: catCounts.ind1.mp,
          attend: catCounts.ind1.attend,
          ot: catCounts.ind1.ot,
          otPct: calcOtPct(catCounts.ind1.ot, catCounts.ind1.attend),
          accOtPct: calcOtPct(cumInd1Ot, cumInd1Att)
        },
        ind2: {
          mp: catCounts.ind2.mp,
          attend: catCounts.ind2.attend,
          ot: catCounts.ind2.ot,
          otPct: calcOtPct(catCounts.ind2.ot, catCounts.ind2.attend),
          accOtPct: calcOtPct(cumInd2Ot, cumInd2Att)
        },
        totInd: {
          mp: totInd.mp,
          attend: totInd.attend,
          ot: totInd.ot,
          otPct: calcOtPct(totInd.ot, totInd.attend),
          accOtPct: calcOtPct(cumTotIndOt, cumTotIndAtt)
        },
        dir1: {
          mp: catCounts.dir1.mp,
          attend: catCounts.dir1.attend,
          ot: catCounts.dir1.ot,
          otPct: calcOtPct(catCounts.dir1.ot, catCounts.dir1.attend),
          accOtPct: calcOtPct(cumDir1Ot, cumDir1Att)
        },
        dir2: {
          mp: catCounts.dir2.mp,
          attend: catCounts.dir2.attend,
          ot: catCounts.dir2.ot,
          otPct: calcOtPct(catCounts.dir2.ot, catCounts.dir2.attend),
          accOtPct: calcOtPct(cumDir2Ot, cumDir2Att)
        },
        totDir: {
          mp: totDir.mp,
          attend: totDir.attend,
          ot: totDir.ot,
          otPct: calcOtPct(totDir.ot, totDir.attend),
          accOtPct: calcOtPct(cumTotDirOt, cumTotDirAtt)
        }
      };
    } else {
      categories = {
        ind1: { mp: 0, attend: 0, ot: 0, otPct: 0, accOtPct: 0 },
        ind2: { mp: 0, attend: 0, ot: 0, otPct: 0, accOtPct: 0 },
        totInd: { mp: 0, attend: 0, ot: 0, otPct: 0, accOtPct: 0 },
        dir1: { mp: 0, attend: 0, ot: 0, otPct: 0, accOtPct: 0 },
        dir2: { mp: 0, attend: 0, ot: 0, otPct: 0, accOtPct: 0 },
        totDir: { mp: 0, attend: 0, ot: 0, otPct: 0, accOtPct: 0 }
      };
    }

    daysData.push({
      day: d,
      date: dateStr,
      dayOfWeek,
      isWorkingDay: isWorkingCalendarDay,
      isHoliday,
      hasData,
      recruit,
      accRecruit,
      resign,
      resignRatio,
      isUserEdited: hasUserEntry,
      categories
    });
  }

  return {
    ok: true,
    month,
    group,
    initialBalance: initialBalance !== null ? initialBalance : fallbackInitialBalance,
    daysData
  };
}

// ── GET / หรือ GET /summary: ดึงข้อมูล Recruit & Resign แบบ Multi-Tier SWR & Immutable Cache ────
router.get(['/', '/summary'], async (req, res) => {
  const month = String(req.query.month || '').trim() ||
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date()).slice(0, 7);
  const group = String(req.query.group || 'MPS').trim().toUpperCase();

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ ok: false, error: 'month must be in format YYYY-MM' });
  }

  const isRefresh = req.query.refresh === '1';
  const cacheKey = `recruit_resign_real_${month}_${group}`;

  try {
    const payload = await getOrRevalidate(
      cacheKey,
      month,
      () => computeRecruitResignData(month, group),
      { isRefresh }
    );
    return res.status(200).json(payload);
  } catch (err) {
    console.error('⚠️ [recruitResign] Error calculating dynamic data:', err.message);
    return res.status(500).json({
      ok: false,
      error: 'Unable to calculate Recruit & Resign data from database',
      errorMessage: err.message
    });
  }
});

// ── POST /save: บันทึกข้อมูล Recruit & Resign ที่ผู้ใช้กรอกลงฐานข้อมูล Test ────────
router.post('/save', async (req, res) => {
  const { month, group = 'MPS', initialBalance, entries = [] } = req.body;

  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ ok: false, error: 'Valid month (YYYY-MM) is required' });
  }

  const grp = String(group || 'MPS').trim().toUpperCase();

  try {
    // บันทึกรายการรายวันลง public.manpower_recruit_resign_entries
    for (const item of entries) {
      const day = Number(item.day);
      if (!day || day < 1 || day > 31) continue;
      const recruit = Number(item.recruit || 0);
      const resign = Number(item.resign || 0);
      const accRecruit = item.accRecruit !== undefined && item.accRecruit !== null ? Number(item.accRecruit) : null;

      // บันทึกเฉพาะวันที่มีข้อมูล
      if (recruit > 0 || resign > 0 || accRecruit !== null) {
        await pool_test.query(`
          INSERT INTO public.manpower_recruit_resign_entries (month, group_name, day_number, recruit, resign, acc_recruit, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          ON CONFLICT (month, group_name, day_number)
          DO UPDATE SET recruit = EXCLUDED.recruit, resign = EXCLUDED.resign, acc_recruit = EXCLUDED.acc_recruit, updated_at = NOW()
        `, [month, grp, day, recruit, resign, accRecruit]);
      } else {
        await pool_test.query(`
          DELETE FROM public.manpower_recruit_resign_entries
          WHERE month = $1 AND group_name = $2 AND day_number = $3
        `, [month, grp, day]);
      }
    }

    // เคลียร์แคชเดือนนั้นทันที (รองรับทั้งเดือนปัจจุบันและอดีต)
    await invalidateMonth(month);

    return res.status(200).json({ ok: true, month, group: grp, savedCount: entries.length });
  } catch (err) {
    console.error('⚠️ [recruitResign/save] Error:', err.message);
    return res.status(500).json({ ok: false, error: 'Failed to save entries', errorMessage: err.message });
  }
});

// ── POST /single: บันทึกวันเดียวแบบรวดเร็ว (Quick Save) ─────────────────────
router.post('/single', async (req, res) => {
  const { month, group = 'MPS', day, recruit = 0, resign = 0, accRecruit } = req.body;
  const dayNum = Number(day);

  if (!month || !dayNum || dayNum < 1 || dayNum > 31) {
    return res.status(400).json({ ok: false, error: 'month and valid day required' });
  }

  const grp = String(group || 'MPS').trim().toUpperCase();

  try {
    await pool_test.query(`
      INSERT INTO public.manpower_recruit_resign_entries (month, group_name, day_number, recruit, resign, acc_recruit, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (month, group_name, day_number)
      DO UPDATE SET recruit = EXCLUDED.recruit, resign = EXCLUDED.resign, acc_recruit = EXCLUDED.acc_recruit, updated_at = NOW()
    `, [month, grp, dayNum, Number(recruit) || 0, Number(resign) || 0, accRecruit !== undefined ? Number(accRecruit) : null]);

    await invalidateMonth(month);

    return res.status(200).json({ ok: true, month, group: grp, day: dayNum, recruit, resign });
  } catch (err) {
    console.error('⚠️ [recruitResign/single] Error:', err.message);
    return res.status(500).json({ ok: false, error: 'Failed to save entry', errorMessage: err.message });
  }
});

module.exports = router;
module.exports.default = router;

