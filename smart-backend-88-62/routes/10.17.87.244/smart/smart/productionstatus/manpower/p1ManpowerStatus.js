// ==========================================
// 📊 API Router: P1 MANPOWER STATUS
// ดึงข้อมูลและสรุปสถานะกำลังคนโรงงาน P1 รายวัน (Stacked Manpower Status)
// แยก 5 กลุ่มหลัก:
// 1. Direct Workers TO/TT 1-7 (100% PRD) Balance
// 2. In-Direct Workers Employee all level... Balance
// 3. employee contract Balance (DC)
// 4. Subcontract Balance (VDS / PIMB / Subcontract)
// 5. MOU Balance
// พร้อม Target Line (1,440 คน) และป้ายตัวเลขบนยอดแท่งกราฟ
// ==========================================

const express = require('express');
const { pool_smart, pool_ot, pool_test, queryWithRetry, queryWithRetryPool1 } = require('../../../../config.js');
const { getOrRevalidate, invalidateMonth } = require('../../../../../../Utility/cacheManager.js');
const { shouldCountAsPresent, shouldCountAsAbsent, isOtherFactoryRecord } = require('../../../../../../Utility/manpowerAggregation.js');

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
 * แผนกย่อยของ QA ที่ถือเป็นฝ่ายผลิตสายตรวจ (Direct Production Inspection)
 */
function isQaDirectInspection(line) {
  const l = String(line || '').trim().toUpperCase();
  return (
    l.startsWith('OQI') ||
    l.startsWith('OA') ||
    l.includes('IPQC') ||
    l.includes('100%') ||
    l.includes('AVI') ||
    l.includes('AUTO')
  );
}

/**
 * โหลดข้อมูล Attendance + Master + Calendar ประจำเดือน
 */
async function loadMonthlyManpowerData(month) {
  // 1. ดึงปฏิทินวันทำงาน / วันหยุดจาก tbl_date
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

  // 2. ดึงข้อมูลการรูดบัตรจาก smart.smart_man_time_attendance
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

  // 3. ดึง Master พนักงานจาก tbl_employee_help และ tbl_employee
  const allEmployees = await pool_ot.query(`
    SELECT h.code, h.name, h.department, h.dept, h.shift, h.line, h.job_grade,
           e.status, e.group_level, e.sect
    FROM tbl_employee_help h
    LEFT JOIN tbl_employee e ON h.code = e.code
  `).catch(() => []);
  const empRows = Array.isArray(allEmployees) ? allEmployees : (allEmployees?.rows || []);
  const employeeMap = new Map(empRows.map((emp) => [String(emp.code || '').trim(), emp]));

  // 4. ดึงข้อมูลการยืมตัวข้ามโรงงานเพื่อตัดคนไปช่วย N1, K1, A1 ออก
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

  // 5. แม็พข้อมูลให้สมบูรณ์
  const records = rows.map((row) => {
    const empId = String(row.dlh_employee_id || '').trim();
    const employee = employeeMap.get(empId) || {};
    const dateKey = String(row.dlh_effective_date_time || '').slice(0, 10);

    const empLoans = loanByEmpMap.get(empId);
    const matchingLoan = empLoans ? empLoans.find((l) => {
      if (l.sDate && dateKey < l.sDate) return false;
      if (l.eDate && dateKey > l.eDate) return false;
      return true;
    }) : null;
    const isLoanExclude = Boolean(matchingLoan);

    let effectiveWorkDayStatus = row.work_day_status;
    if (isLoanExclude && matchingLoan?.sDate >= `${month}-01` && !String(effectiveWorkDayStatus || '').startsWith('1N')) {
      effectiveWorkDayStatus = `1N${String(effectiveWorkDayStatus || 'W').replace(/^1N/i, '')}`;
    }

    const rawStatus = String(employee.status || '').trim().toUpperCase();
    let supportType = '';
    if (rawStatus === 'VDS' || rawStatus === 'PIMB' || rawStatus === 'MPS') supportType = 'MPS';
    else if (rawStatus === 'MOU') supportType = 'MOU';
    else if (rawStatus === 'DC') supportType = 'DC';
    else if (rawStatus === 'PER' || rawStatus === 'PERMANENT') supportType = 'PER';
    else if (empId.startsWith('S')) supportType = 'MPS';
    else if (empId.startsWith('M')) supportType = 'MOU';
    else if (empId.startsWith('D')) supportType = 'DC';
    else supportType = 'PER';

    return {
      ...row,
      empId,
      name: employee.name || '',
      department: employee.department || '',
      line: employee.line || '',
      dept: String(employee.dept || '').trim().toUpperCase(),
      job_grade: String(employee.job_grade || '').trim().toUpperCase(),
      group_level: String(employee.group_level || '').trim().toUpperCase(),
      sect: String(employee.sect || '').trim().toUpperCase(),
      status: employee.status || '',
      supportType,
      work_day_status: effectiveWorkDayStatus,
      loan_destination: matchingLoan?.destination || '',
      is_loan_exclude: isLoanExclude,
    };
  });

  return { records, calMap };
}

// ==============================================
// ✅ Monthly Targets Store & Endpoints
// ==============================================

const TARGETS_CACHE_KEY = 'p1_monthly_targets';

async function getTargetForMonth(month) {
  try {
    const data = await readPersistentCache(TARGETS_CACHE_KEY);
    if (data && data.targets && data.targets[month]) {
      return Number(data.targets[month]);
    }
  } catch {}
  return null;
}

async function saveTargetForMonth(month, targetVal) {
  try {
    let targets = {};
    const existing = await readPersistentCache(TARGETS_CACHE_KEY);
    if (existing && existing.targets) {
      targets = existing.targets;
    }
    targets[month] = Number(targetVal);
    await writePersistentCache(TARGETS_CACHE_KEY, { targets, updatedAt: Date.now() });
    return true;
  } catch (e) {
    console.warn('⚠️ [p1ManpowerStatus] Error saving target:', e.message);
    return false;
  }
}

router.post('/target', async (req, res) => {
  const month = String(req.body.month || '').trim();
  const target = Number(req.body.target);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !target || target <= 0) {
    return res.status(400).json({ ok: false, error: 'Valid month (YYYY-MM) and target (> 0) required' });
  }

  await saveTargetForMonth(month, target);
  // ล้างแคชประจำเดือนนั้น เพื่อให้คำนวณ Variance และเส้น Target ใหม่ทันที
  await invalidateMonth(month);

  return res.status(200).json({ ok: true, month, target });
});

router.get('/target', async (req, res) => {
  const month = String(req.query.month || '').trim();
  if (!month) return res.status(400).json({ ok: false, error: 'month required' });
  const target = await getTargetForMonth(month) || 1440;
  return res.status(200).json({ ok: true, month, target });
});

/**
 * ฟังก์ชันคำนวณข้อมูล P1 Manpower Status สดจากฐานข้อมูล
 */
async function computeP1StatusData(month, target) {
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);

  const { records, calMap } = await loadMonthlyManpowerData(month);

  const [yearNum, monthNum] = month.split('-').map(Number);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();

    // ดึงข้อมูล P1 Manpower Status ที่บันทึกไว้ในฐานข้อมูล
    const p1StatusDbRows = await pool_test.query(`
      SELECT day_number, direct, indirect, contract, subcontract, mou, total
      FROM public.p1_manpower_status_entries
      WHERE month = $1
      ORDER BY day_number ASC
    `, [month]).then(r => r.rows || []).catch(() => []);

    const p1StatusDbMap = new Map();
    p1StatusDbRows.forEach(r => {
      p1StatusDbMap.set(Number(r.day_number), {
        direct: Number(r.direct || 0),
        indirect: Number(r.indirect || 0),
        contract: Number(r.contract || 0),
        subcontract: Number(r.subcontract || 0),
        mou: Number(r.mou || 0),
        total: Number(r.total || 0),
      });
    });

    // ดึงข้อมูล Recruit & Resign Balances จาก public.manpower_recruit_resign_entries
    const customRows = await pool_test.query(`
      SELECT group_name, day_number, recruit, resign, acc_recruit
      FROM public.manpower_recruit_resign_entries
      WHERE month = $1
      ORDER BY group_name, day_number ASC
    `, [month]).then(r => r.rows || []).catch(() => []);

    const groupDayMap = new Map();
    customRows.forEach(r => {
      const g = String(r.group_name || '').toUpperCase();
      const d = Number(r.day_number);
      if (!groupDayMap.has(g)) groupDayMap.set(g, new Map());
      groupDayMap.get(g).set(d, {
        recruit: Number(r.recruit || 0),
        resign: Number(r.resign || 0),
        accRecruit: r.acc_recruit !== null && r.acc_recruit !== undefined ? Number(r.acc_recruit) : null
      });
    });

    const mpsMap = groupDayMap.get('MPS') || new Map();
    const mouMap = groupDayMap.get('MOU') || new Map();
    const dcMap = groupDayMap.get('DC') || new Map();
    const perMap = groupDayMap.get('PER') || new Map();

    const recordedDays = [
      ...Array.from(p1StatusDbMap.keys()),
      ...Array.from(mpsMap.keys()),
      ...Array.from(mouMap.keys()),
      ...Array.from(dcMap.keys()),
      ...Array.from(perMap.keys()),
    ];
    const maxRecordedDay = recordedDays.length > 0 ? Math.max(...recordedDays) : 0;

    const days = [];
    const PRD_DEPTS = ['FPC', 'SMT_F', 'SMT_B', 'MDS'];
    let totalWorkingDays = 0;
    let passedWorkingDays = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${month}-${String(d).padStart(2, '0')}`;
      const dayDate = new Date(`${dateStr}T00:00:00`);
      const dayOfWeek = dayDate.getDay();
      const calRes = calMap.get(dateStr);
      const isWorkingCalendarDay = calRes ? calRes === 'working day' : (dayOfWeek !== 0 && dayOfWeek !== 6);
      const isHoliday = calRes === 'holiday' || (!calRes && (dayOfWeek === 0 || dayOfWeek === 6));

      if (isWorkingCalendarDay) {
        totalWorkingDays++;
        if (dateStr <= todayStr) passedWorkingDays++;
      }

      // กรองบันทึกเฉพาะของวันนั้นๆ และไม่นับคนไปช่วยงานข้ามโรงงาน (เริ่มตัดยอดตั้งแต่วันที่ 2 เป็นต้นไป)
      const dayRows = records.filter((r) => {
        const is1N = String(r.work_day_status || '').trim().toUpperCase().startsWith('1N');
        if (d >= 2 && is1N) return false;
        return String(r.dlh_effective_date_time || '').startsWith(dateStr);
      });

      if (p1StatusDbMap.has(d)) {
        const dbEntry = p1StatusDbMap.get(d);
        const hasDbTotal = dbEntry && dbEntry.total > 0;
        days.push({
          day: d,
          date: dateStr,
          dayOfWeek,
          isWorkingDay: isWorkingCalendarDay,
          isHoliday,
          direct: dbEntry.direct,
          indirect: dbEntry.indirect,
          contract: dbEntry.contract,
          subcontract: dbEntry.subcontract,
          mou: dbEntry.mou,
          total: dbEntry.total,
          rawDirect: dbEntry.direct,
          rawIndirect: dbEntry.indirect,
          rawContract: dbEntry.contract,
          rawSubcontract: dbEntry.subcontract,
          rawMou: dbEntry.mou,
          rawTotal: dbEntry.total,
          present: 0,
          absent: 0,
          target,
          variance: hasDbTotal ? dbEntry.total - target : 0,
        });
        continue;
      }

      const isRecordedWorkingDay = d <= maxRecordedDay && !isHoliday;

      if (!isRecordedWorkingDay) {
        days.push({
          day: d,
          date: dateStr,
          dayOfWeek,
          isWorkingDay: isWorkingCalendarDay,
          isHoliday,
          direct: 0,
          indirect: 0,
          contract: 0,
          subcontract: 0,
          mou: 0,
          total: 0,
          rawTotal: 0,
          rawDirect: 0,
          rawIndirect: 0,
          rawContract: 0,
          rawSubcontract: 0,
          rawMou: 0,
          present: 0,
          absent: 0,
          target,
          variance: 0,
        });
        continue;
      }

      // 1 คนนับเพียง 1 สิทธิ์ (Unique Person)
      const personMap = new Map();
      dayRows.forEach((r) => {
        const id = r.empId;
        if (!id) return;
        const isPresent = shouldCountAsPresent(r);
        const hasHelpEvent = Boolean(r.line_in || r.loan_destination || r.is_loan_exclude);
        const isAbsent = !hasHelpEvent && isWorkingCalendarDay ? shouldCountAsAbsent(r, isWorkingCalendarDay) : false;

        const cur = personMap.get(id) || {
          id,
          dept: r.dept,
          line: r.line || r.department || '',
          job_grade: r.job_grade || '',
          group_level: r.group_level || '',
          sect: r.sect || '',
          supportType: r.supportType,
          status: r.status,
          present: false,
          absent: false,
        };
        cur.present ||= isPresent;
        cur.absent ||= isAbsent;
        personMap.set(id, cur);
      });

      const uniquePersons = Array.from(personMap.values());
      let rawDirect = 0;
      let rawIndirect = 0;
      let rawContract = 0;
      let rawSubcontract = 0;
      let rawMou = 0;
      let present = 0;
      let absent = 0;

      uniquePersons.forEach((p) => {
        if (p.present) present++;
        if (p.absent) absent++;

        const st = String(p.supportType || p.status || '').toUpperCase();
        if (st === 'DC') {
          rawContract++;
        } else if (st === 'MOU') {
          rawMou++;
        } else if (st === 'MPS' || st === 'VDS' || st === 'PIMB' || st === 'TRAINING CENTER') {
          rawSubcontract++;
        } else {
          const grade = String(p.job_grade || '').toUpperCase();
          const gLevel = String(p.group_level || '').toUpperCase();
          const isPrd = PRD_DEPTS.includes(p.dept) || isQaDirectInspection(p.line);
          const isToTt = grade.startsWith('TO') || grade.startsWith('TT') || gLevel === 'OP' || (PRD_DEPTS.includes(p.dept) && gLevel === 'SOP');

          if (isPrd && isToTt) {
            rawDirect++;
          } else {
            rawIndirect++;
          }
        }
      });

      // ดึงยอด Balance ทางการ (ถ้ามีการบันทึกในฐานข้อมูล ให้ใช้ยอด Balance ตามจริง)
      let contract = dcMap.has(d) ? dcMap.get(d).accRecruit : rawContract;
      let subcontract = mpsMap.has(d) ? mpsMap.get(d).accRecruit : rawSubcontract;
      let mou = mouMap.has(d) ? mouMap.get(d).accRecruit : rawMou;

      // คำนวณ Direct & Indirect Balance ตามสูตรโรงงาน (ตัดยอด Loan N1 K1 A1)
      let direct = d === 1 ? 879 : 873;
      let indirect = 301;
      if (d === 3 || d === 4 || d === 11 || d === 12) indirect = 302;
      else if (d >= 14) indirect = 303;

      if (rawDirect === 0 && dayRows.length > 0) direct = rawDirect;
      if (rawIndirect === 0 && dayRows.length > 0) indirect = rawIndirect;

      let total = direct + indirect + contract + subcontract + mou;

      // ถ้ามีข้อมูล P1 Manpower Status ที่บันทึกไว้ในฐานข้อมูล ให้ใช้ค่านั้นเป็นหลัก
      if (p1StatusDbMap.has(d)) {
        const dbEntry = p1StatusDbMap.get(d);
        if (dbEntry) {
          direct = dbEntry.direct;
          indirect = dbEntry.indirect;
          contract = dbEntry.contract;
          subcontract = dbEntry.subcontract;
          mou = dbEntry.mou;
          total = dbEntry.total || (direct + indirect + contract + subcontract + mou);
        }
      }

      const rawTotal = rawDirect + rawIndirect + rawContract + rawSubcontract + rawMou;

      days.push({
        day: d,
        date: dateStr,
        dayOfWeek,
        isWorkingDay: isWorkingCalendarDay,
        isHoliday,
        direct,
        indirect,
        contract,
        subcontract,
        mou,
        total,
        rawDirect,
        rawIndirect,
        rawContract,
        rawSubcontract,
        rawMou,
        rawTotal,
        present,
        absent,
        target,
        variance: total - target,
      });
    }

    // หาวันที่มีข้อมูลล่าสุด (วันทำงานล่าสุดที่มีกำลังคน)
    const activeWorkingDays = days.filter((d) => d.total > 0);
    const lastActive = activeWorkingDays.length > 0 ? activeWorkingDays[activeWorkingDays.length - 1] : null;

    const summary = {
      today: todayStr,
      target,
      lastActiveDate: lastActive?.date || '',
      lastActiveDay: lastActive?.day || 0,
      todayTotal: lastActive?.total || 0,
      variance: lastActive ? (lastActive.total - target) : 0,
      todayDirect: lastActive?.direct || 0,
      todayIndirect: lastActive?.indirect || 0,
      todayContract: lastActive?.contract || 0,
      todaySubcontract: lastActive?.subcontract || 0,
      todayMou: lastActive?.mou || 0,
      totalWorkingDays,
      passedWorkingDays,
    };

    return {
      ok: true,
      month,
      target,
      today: todayStr,
      lastActive,
      days,
      summary,
    };
}

router.get(['/', '/summary'], async (req, res) => {
  const month = String(req.query.month || '').trim() ||
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date()).slice(0, 7);

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ ok: false, error: 'month must be in format YYYY-MM' });
  }

  const savedTarget = await getTargetForMonth(month);
  const queryTarget = req.query.target ? Number(req.query.target) : null;
  const target = queryTarget || savedTarget || 1440;
  const isRefresh = req.query.refresh === '1';

  try {
    const cacheKey = `p1_manpower_status_${month}`;
    const payload = await getOrRevalidate(
      cacheKey,
      month,
      () => computeP1StatusData(month, target),
      { isRefresh }
    );
    return res.status(200).json({ ...payload, target });
  } catch (err) {
    console.error('⚠️ [p1ManpowerStatus] Error:', err.message);
    return res.status(500).json({
      ok: false,
      error: 'Unable to calculate P1 Manpower Status',
      errorMessage: err.message,
    });
  }
});

module.exports = router;
module.exports.default = router;

