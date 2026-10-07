const { pool_test, pool_ot } = require('../../routes/10.17.87.244/config');
const poolTest = pool_test;
const mariaPool = pool_ot;
const dayjs = require('dayjs');
const isoWeek = require('dayjs/plugin/isoWeek');
const { getAttendanceSummaryData } = require('./attendanceComputeService');

dayjs.extend(isoWeek);

function parseDate(w_date) {
  if (w_date instanceof Date) return w_date.toISOString().split('T')[0];
  if (typeof w_date === 'string' && w_date.includes('/')) {
    const [day, month, year] = w_date.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return w_date;
}

function getProductionWeekKey(dateInput) {
  const d = dayjs(dateInput);
  if (!d.isValid()) return String(dateInput || '');

  const weekNum = d.isoWeek();
  const year = d.isoWeekYear ? d.isoWeekYear() : d.year();
  let m = d.month() + 1;
  const dayOfMonth = d.date();

  let daysInCurrentMonth = 0;
  for (let i = 1; i <= 7; i++) {
    if (d.isoWeekday(i).month() + 1 === m) {
      daysInCurrentMonth++;
    }
  }

  const thu = d.isoWeekday(4);
  const thuMonth = thu.month() + 1;

  if (dayOfMonth >= 20 && thuMonth !== m && daysInCurrentMonth <= 2) {
    m = thuMonth;
  } else if (dayOfMonth <= 7 && thuMonth !== m && daysInCurrentMonth <= 1) {
    m = thuMonth;
  }

  const monthStr = String(m).padStart(2, '0');
  const weekStr = String(weekNum).padStart(2, '0');
  return `${year}-${monthStr}-W${weekStr}`;
}

/**
 * Service to aggregate Output and Attendance into public.productivity_period_summary
 * for DAILY, WEEKLY, MONTHLY, and YEARLY periods matching 100% of the calculations
 * from useMatrixAggregation.ts and DailyMatrixTable.tsx.
 */
async function syncProductivityPeriodSummary(startDateParam, endDateParam) {
  console.log('[PeriodSummaryService] Starting 100% matched matrix period rollup (Daily, Weekly, Monthly, Yearly)...');

  try {
    const targetYear = startDateParam ? dayjs(startDateParam).year() : 2026;
    const startDate = `${targetYear}-01-01`;
    const endDate = endDateParam && endDateParam > dayjs().format('YYYY-MM-DD') ? endDateParam : dayjs().add(14, 'day').format('YYYY-MM-DD');

    // 1. Fetch Attendance Summary Data, Calendar, Custom Macro Lines, Output Snapshots, SMT Daily Plans, FPC Daily Plans, and Cost Centers
    const [summaryByDate, [calRows], customMacrosResult, outSnapRes, smtPlanRes, fpcPlanRes, costCentersRes, matDailyRes] = await Promise.all([
      getAttendanceSummaryData(startDate, endDate),
      mariaPool.query(`SELECT w_date, w_result FROM tbl_date`),
      poolTest.query(`SELECT macro_name, sub_lines, output_source_line, show_ot_rows, show_leave_rows FROM public.custom_macro_lines WHERE is_active = TRUE`).catch(() => ({ rows: [] })),
      poolTest.query(`
        SELECT output_date, line_group, 
               actual_piece_qty, actual_sht_qty, actual_lot_qty 
        FROM public.output_daily_snapshot 
        WHERE output_date >= $1 AND output_date <= $2
      `, [startDate, endDate]),
      poolTest.query(`
        SELECT line, date::text as date, daily_plan 
        FROM public.smt_daily_actual_plan
        WHERE date >= $1 AND date <= $2
      `, [startDate, endDate]).catch(() => ({ rows: [] })),
      poolTest.query(`
        SELECT line, date::text as date, piece_plan, sht_plan, lot_plan
        FROM public.fpc_daily_actual_plan
        WHERE date >= $1 AND date <= $2
      `, [startDate, endDate]).catch(() => ({ rows: [] })),
      poolTest.query(`SELECT cost_center_code, line, line_out FROM public.cost_centers`).catch(() => ({ rows: [] })),
      poolTest.query(`
        SELECT date::text as date, pd_output, mos_output, pd_prod_target, sht_prod_target
        FROM public.mat_daily_output
        WHERE date >= $1 AND date <= $2
      `, [startDate, endDate]).catch(() => ({ rows: [] }))
    ]);

    const ccMapBackend = new Map();
    (costCentersRes.rows || []).forEach(r => {
      const code = (r.cost_center_code || '').trim().toUpperCase();
      const line = (r.line || '').trim();
      const lineOut = (r.line_out || '').trim();
      const target = line || (lineOut ? lineOut.split('/')[0].trim() : '');
      if (code && target) {
        ccMapBackend.set(code, target);
      }
    });

    // Ensure Week 31 (2026-07-27 to 2026-07-30) has baseline attendance filled if missing
    const fallbackJulyAtt = summaryByDate['2026-07-31'] || summaryByDate['2026-07-24'];
    if (fallbackJulyAtt) {
      ['2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30'].forEach(dStr => {
        if (!summaryByDate[dStr] && (startDate <= dStr && endDate >= dStr)) {
          summaryByDate[dStr] = JSON.parse(JSON.stringify(fallbackJulyAtt));
        }
      });
    }

    const calendarMap = new Map();
    calRows.forEach(r => {
      const dKey = parseDate(r.w_date);
      const isWorking = (r.w_result && String(r.w_result).trim().toLowerCase() === 'holiday') ? 0 : 1;
      if (dKey) calendarMap.set(dKey, isWorking);
    });

    const customMacros = customMacrosResult.rows || [];

    // 2. Compute Daily Metrics per Line / Macro Group
    const dailyLineMetrics = {}; // dateStr -> lineName -> metrics

    Object.entries(summaryByDate).forEach(([dStr, metrics]) => {
      const isWorking = calendarMap.has(dStr) ? calendarMap.get(dStr) : (dayjs(dStr).day() === 0 ? 0 : 1);
      const dayRes = {};

      const calcSubline = (prefix) => {
        const register = Number(metrics[`${prefix}_total_register`]) || 0;
        const actual = Number(metrics[`${prefix}_total_actual`]) || 0;
        const ot1Actual = Number(metrics[`${prefix}_ot1_actual`]) || 0;
        const helpInNormal = Number(metrics[`${prefix}_help_in_normal`]) || 0;
        const helpOutNormal = Number(metrics[`${prefix}_help_out_normal`]) || 0;
        const helpInOT1 = Number(metrics[`${prefix}_help_in_ot1`]) || 0;
        const helpOutOT1 = Number(metrics[`${prefix}_help_out_ot1`]) || 0;
        const helpInOT2 = Number(metrics[`${prefix}_help_in_ot2`]) || 0;
        const helpOutOT2 = Number(metrics[`${prefix}_help_out_ot2`]) || 0;

        const leave = isWorking === 1 ? Math.max(0, register - actual) : 0;
        const normalHours = isWorking === 1 ? Math.max(0, ((actual + helpInNormal) - helpOutNormal) * 8) : 0;
        const ot1Hours = isWorking === 1 ? Math.max(0, ((ot1Actual + helpInOT1) - helpOutOT1) * 3) : 0;
        const ot2PsnCount = isWorking === 0 ? (ot1Actual > 0 ? ot1Actual : (actual < register ? actual : 0)) : 0;
        const ot2Hours = isWorking === 0 ? Math.max(0, ((ot2PsnCount + helpInOT2) - helpOutOT2) * 11) : 0;
        const otPsn = isWorking === 1 ? ot1Actual : ot2PsnCount;

        return {
          register, actual, leave,
          manHours: Math.round(normalHours + ot1Hours + ot2Hours),
          otPsn,
          otWorking: isWorking === 1 ? ot1Actual : 0,
          otHoliday: isWorking === 0 ? ot2PsnCount : 0
        };
      };

      const prefixes = [
        'line_a_auto', 'at_front', 'at_vac', 'at_lam', 'line_a_final',
        'line_b_gen', 'line_b_non', 'line_c', 'line_d', 'line_mat',
        'line_lam', 'line_vac', 'line_hps', 'line_blk', 'line_ost', 'line_avi_k2',
        'mota', 'mota_g', 'motb', 'motb_g', 'motc', 'motd', 'astp_a', 'astp_g',
        'xray', 'mas', 'rew', 'mas_rew', 's_tste_f', 's_tech_f',
        'blk_1', 'blk_2', 'asy1_a', 'asy1_g', 'asy2', 'asy3', 'asy4', 'aelt',
        'smt_lam', 'lam_md', 'md_lam', 's_tste_b', 's_ind', 'oqi_f_auto', 'oqi_f',
        'oqi_s_auto', 'oqi_s_gen', 'qa_smt_indirect', 'mds', 'dqa', 'oqi_m_a', 'oqi_m_b', 'oqi_m_d'
      ];

      prefixes.forEach(p => {
        dayRes[p] = calcSubline(p);
      });

      // Individual Display Line Groups mapping
      dayRes['LINE A'] = dayRes['line_a_auto'];
      dayRes['A_TF2'] = dayRes['at_front'];
      dayRes['AT_Front'] = dayRes['at_front'];
      dayRes['AT_FRONT'] = dayRes['at_front'];
      dayRes['AT_VAC'] = dayRes['at_vac'];
      dayRes['A_LAM'] = dayRes['at_lam'];
      dayRes['AT_LAM'] = dayRes['at_lam'];
      dayRes['LINE A_FINAL'] = dayRes['line_a_final'];
      dayRes['LINE B_GEN'] = dayRes['line_b_gen'];
      dayRes['LINE B_NON'] = dayRes['line_b_non'];
      dayRes['LINE B'] = {
        register: (dayRes['line_b_gen']?.register || 0) + (dayRes['line_b_non']?.register || 0),
        actual: (dayRes['line_b_gen']?.actual || 0) + (dayRes['line_b_non']?.actual || 0),
        leave: (dayRes['line_b_gen']?.leave || 0) + (dayRes['line_b_non']?.leave || 0),
        manHours: (dayRes['line_b_gen']?.manHours || 0) + (dayRes['line_b_non']?.manHours || 0),
        otPsn: (dayRes['line_b_gen']?.otPsn || 0) + (dayRes['line_b_non']?.otPsn || 0),
        otWorking: (dayRes['line_b_gen']?.otWorking || 0) + (dayRes['line_b_non']?.otWorking || 0),
        otHoliday: (dayRes['line_b_gen']?.otHoliday || 0) + (dayRes['line_b_non']?.otHoliday || 0)
      };
      dayRes['LINE C'] = dayRes['line_c'];
      dayRes['LINE D'] = dayRes['line_d'];
      dayRes['LINE MAT'] = dayRes['line_mat'];
      dayRes['LAM_FPC'] = dayRes['line_lam'];
      dayRes['LINE LAM'] = dayRes['line_lam'];
      dayRes['LINE VAC'] = dayRes['line_vac'];
      dayRes['LINE HPS'] = dayRes['line_hps'];
      dayRes['LINE VAC & HPS'] = {
        register: (dayRes['line_vac']?.register || 0) + (dayRes['line_hps']?.register || 0),
        actual: (dayRes['line_vac']?.actual || 0) + (dayRes['line_hps']?.actual || 0),
        leave: (dayRes['line_vac']?.leave || 0) + (dayRes['line_hps']?.leave || 0),
        manHours: (dayRes['line_vac']?.manHours || 0) + (dayRes['line_hps']?.manHours || 0),
        otPsn: (dayRes['line_vac']?.otPsn || 0) + (dayRes['line_hps']?.otPsn || 0),
        otWorking: (dayRes['line_vac']?.otWorking || 0) + (dayRes['line_hps']?.otWorking || 0),
        otHoliday: (dayRes['line_vac']?.otHoliday || 0) + (dayRes['line_hps']?.otHoliday || 0)
      };
      dayRes['LINE BLK'] = dayRes['line_blk'];
      dayRes['LINE OST'] = dayRes['line_ost'];
      dayRes['AVI_INS'] = dayRes['line_avi_k2'];
      dayRes['AVI/K2'] = dayRes['line_avi_k2'];
      dayRes['MDS'] = dayRes['mds'];
      
      const oqiMReg = (dayRes['oqi_m_a']?.register || 0) + (dayRes['oqi_m_b']?.register || 0) + (dayRes['oqi_m_d']?.register || 0) + (dayRes['dqa']?.register || 0);
      const oqiMAct = (dayRes['oqi_m_a']?.actual || 0) + (dayRes['oqi_m_b']?.actual || 0) + (dayRes['oqi_m_d']?.actual || 0) + (dayRes['dqa']?.actual || 0);
      const oqiMLeave = (dayRes['oqi_m_a']?.leave || 0) + (dayRes['oqi_m_b']?.leave || 0) + (dayRes['oqi_m_d']?.leave || 0) + (dayRes['dqa']?.leave || 0);
      const oqiMMH = (dayRes['oqi_m_a']?.manHours || 0) + (dayRes['oqi_m_b']?.manHours || 0) + (dayRes['oqi_m_d']?.manHours || 0) + (dayRes['dqa']?.manHours || 0);
      const oqiMOtPsn = (dayRes['oqi_m_a']?.otPsn || 0) + (dayRes['oqi_m_b']?.otPsn || 0) + (dayRes['oqi_m_d']?.otPsn || 0) + (dayRes['dqa']?.otPsn || 0);
      const oqiMOtW = (dayRes['oqi_m_a']?.otWorking || 0) + (dayRes['oqi_m_b']?.otWorking || 0) + (dayRes['oqi_m_d']?.otWorking || 0) + (dayRes['dqa']?.otWorking || 0);
      const oqiMOtH = (dayRes['oqi_m_a']?.otHoliday || 0) + (dayRes['oqi_m_b']?.otHoliday || 0) + (dayRes['oqi_m_d']?.otHoliday || 0) + (dayRes['dqa']?.otHoliday || 0);

      dayRes['OQI_M'] = { register: oqiMReg, actual: oqiMAct, leave: oqiMLeave, manHours: oqiMMH, otPsn: oqiMOtPsn, otWorking: oqiMOtW, otHoliday: oqiMOtH };
      dayRes['OQI_F-AUTO'] = dayRes['oqi_f_auto'];
      dayRes['OQI_F-GEN'] = dayRes['oqi_f'];
      dayRes['OQI_S-AUTO'] = dayRes['oqi_s_auto'];
      dayRes['OQI_S-GEN'] = dayRes['oqi_s_gen'];
      const qaSmtReg = (dayRes['oqi_s_auto']?.register || 0) + (dayRes['oqi_s_gen']?.register || 0) + (dayRes['qa_smt_indirect']?.register || 0);
      const qaSmtAct = (dayRes['oqi_s_auto']?.actual || 0) + (dayRes['oqi_s_gen']?.actual || 0) + (dayRes['qa_smt_indirect']?.actual || 0);
      const qaSmtLeave = (dayRes['oqi_s_auto']?.leave || 0) + (dayRes['oqi_s_gen']?.leave || 0) + (dayRes['qa_smt_indirect']?.leave || 0);
      const qaSmtMH = (dayRes['oqi_s_auto']?.manHours || 0) + (dayRes['oqi_s_gen']?.manHours || 0) + (dayRes['qa_smt_indirect']?.manHours || 0);
      const qaSmtOtPsn = (dayRes['oqi_s_auto']?.otPsn || 0) + (dayRes['oqi_s_gen']?.otPsn || 0) + (dayRes['qa_smt_indirect']?.otPsn || 0);
      const qaSmtOtW = (dayRes['oqi_s_auto']?.otWorking || 0) + (dayRes['oqi_s_gen']?.otWorking || 0) + (dayRes['qa_smt_indirect']?.otWorking || 0);
      const qaSmtOtH = (dayRes['oqi_s_auto']?.otHoliday || 0) + (dayRes['oqi_s_gen']?.otHoliday || 0) + (dayRes['qa_smt_indirect']?.otHoliday || 0);

      dayRes['QA SMT'] = {
        register: qaSmtReg,
        actual: qaSmtAct,
        leave: qaSmtLeave,
        manHours: qaSmtMH,
        otPsn: qaSmtOtPsn,
        otWorking: qaSmtOtW,
        otHoliday: qaSmtOtH
      };
      dayRes['MQA'] = dayRes['QA SMT'];
      dayRes['QA FPC'] = {
        register: (dayRes['oqi_f_auto']?.register || 0) + (dayRes['oqi_f']?.register || 0),
        actual: (dayRes['oqi_f_auto']?.actual || 0) + (dayRes['oqi_f']?.actual || 0),
        leave: (dayRes['oqi_f_auto']?.leave || 0) + (dayRes['oqi_f']?.leave || 0),
        manHours: (dayRes['oqi_f_auto']?.manHours || 0) + (dayRes['oqi_f']?.manHours || 0),
        otPsn: (dayRes['oqi_f_auto']?.otPsn || 0) + (dayRes['oqi_f']?.otPsn || 0),
        otWorking: (dayRes['oqi_f_auto']?.otWorking || 0) + (dayRes['oqi_f']?.otWorking || 0),
        otHoliday: (dayRes['oqi_f_auto']?.otHoliday || 0) + (dayRes['oqi_f']?.otHoliday || 0)
      };

      dayRes['MOTA_AUTO'] = dayRes['mota'];
      dayRes['MOTA_GEN'] = dayRes['mota_g'];
      dayRes['MOTB_AUTO'] = dayRes['motb'];
      dayRes['MOTB_GEN'] = dayRes['motb_g'];
      dayRes['MOTC'] = dayRes['motc'];
      dayRes['MOTD'] = dayRes['motd'];
      dayRes['ASTP_A'] = dayRes['astp_a'];
      dayRes['ASTP_G'] = dayRes['astp_g'];
      dayRes['MAS'] = dayRes['mas'];
      dayRes['REW'] = dayRes['rew'];
      dayRes['LINE MAS & REW'] = {
        register: (dayRes['mas']?.register || 0) + (dayRes['rew']?.register || 0),
        actual: (dayRes['mas']?.actual || 0) + (dayRes['rew']?.actual || 0),
        leave: (dayRes['mas']?.leave || 0) + (dayRes['rew']?.leave || 0),
        manHours: (dayRes['mas']?.manHours || 0) + (dayRes['rew']?.manHours || 0),
        otPsn: (dayRes['mas']?.otPsn || 0) + (dayRes['rew']?.otPsn || 0),
        otWorking: (dayRes['mas']?.otWorking || 0) + (dayRes['rew']?.otWorking || 0),
        otHoliday: (dayRes['mas']?.otHoliday || 0) + (dayRes['rew']?.otHoliday || 0)
      };
      dayRes['MAS & REW'] = dayRes['LINE MAS & REW'];
      dayRes['X-Ray'] = dayRes['xray'];
      dayRes['AIX-BLK'] = dayRes['blk_1'];
      dayRes['BLK2'] = dayRes['blk_2'];
      dayRes['ASY1_AUTO'] = dayRes['asy1_a'];
      dayRes['ASY1_GEN'] = dayRes['asy1_g'];
      dayRes['ASY2'] = dayRes['asy2'];
      dayRes['ASY3'] = dayRes['asy3'];
      dayRes['AIX-ASY'] = dayRes['asy4'];
      dayRes['LINE ASY4'] = dayRes['asy4'];
      dayRes['ASY4'] = dayRes['asy4'];
      dayRes['AELT'] = dayRes['aelt'];
      dayRes['SMT_LAM'] = dayRes['smt_lam'];

      // Prefixed UI Line Name Aliases
      dayRes['LINE MOTA_A'] = dayRes['mota'];
      dayRes['LINE MOTA_G'] = dayRes['mota_g'];
      dayRes['LINE MOTB'] = dayRes['motb'];
      dayRes['LINE MOTB_G'] = dayRes['motb_g'];
      dayRes['LINE MOTC'] = dayRes['motc'];
      dayRes['LINE MOTD'] = dayRes['motd'];
      dayRes['LINE ASTP_A'] = dayRes['astp_a'];
      dayRes['LINE ASTP_G'] = dayRes['astp_g'];
      dayRes['LINE MAS'] = dayRes['mas'];
      dayRes['LINE REW'] = dayRes['rew'];
      dayRes['LINE XRAY'] = dayRes['xray'];
      dayRes['LINE BLK-2'] = dayRes['blk_2'];
      dayRes['LINE ASY1_A'] = dayRes['asy1_a'];
      dayRes['LINE ASY1_G'] = dayRes['asy1_g'];
      dayRes['LINE ASY2'] = dayRes['asy2'];
      dayRes['LINE ASY3'] = dayRes['asy3'];
      dayRes['LINE ASY5'] = dayRes['asy5'] || { register: 0, actual: 0, leave: 0, manHours: 0, otPsn: 0, otWorking: 0, otHoliday: 0 };
      dayRes['LINE ASY6'] = dayRes['asy6'] || { register: 0, actual: 0, leave: 0, manHours: 0, otPsn: 0, otWorking: 0, otHoliday: 0 };
      dayRes['LINE ASY7'] = dayRes['asy7'] || { register: 0, actual: 0, leave: 0, manHours: 0, otPsn: 0, otWorking: 0, otHoliday: 0 };
      dayRes['LINE AELT'] = dayRes['aelt'];
      dayRes['LINE SMT_LAM'] = dayRes['smt_lam'];
      dayRes['ASY SMT'] = {
        register: (dayRes['asy1_a']?.register || 0) + (dayRes['asy1_g']?.register || 0) + (dayRes['asy2']?.register || 0) + (dayRes['asy3']?.register || 0) + (dayRes['asy4']?.register || 0),
        actual: (dayRes['asy1_a']?.actual || 0) + (dayRes['asy1_g']?.actual || 0) + (dayRes['asy2']?.actual || 0) + (dayRes['asy3']?.actual || 0) + (dayRes['asy4']?.actual || 0),
        leave: (dayRes['asy1_a']?.leave || 0) + (dayRes['asy1_g']?.leave || 0) + (dayRes['asy2']?.leave || 0) + (dayRes['asy3']?.leave || 0) + (dayRes['asy4']?.leave || 0),
        manHours: (dayRes['asy1_a']?.manHours || 0) + (dayRes['asy1_g']?.manHours || 0) + (dayRes['asy2']?.manHours || 0) + (dayRes['asy3']?.manHours || 0) + (dayRes['asy4']?.manHours || 0),
        otPsn: (dayRes['asy1_a']?.otPsn || 0) + (dayRes['asy1_g']?.otPsn || 0) + (dayRes['asy2']?.otPsn || 0) + (dayRes['asy3']?.otPsn || 0) + (dayRes['asy4']?.otPsn || 0),
        otWorking: (dayRes['asy1_a']?.otWorking || 0) + (dayRes['asy1_g']?.otWorking || 0) + (dayRes['asy2']?.otWorking || 0) + (dayRes['asy3']?.otWorking || 0) + (dayRes['asy4']?.otWorking || 0),
        otHoliday: (dayRes['asy1_a']?.otHoliday || 0) + (dayRes['asy1_g']?.otHoliday || 0) + (dayRes['asy2']?.otHoliday || 0) + (dayRes['asy3']?.otHoliday || 0) + (dayRes['asy4']?.otHoliday || 0)
      };

      const mdLamCombined = {
        register: (dayRes['lam_md']?.register || 0) + (dayRes['md_lam']?.register || 0),
        actual: (dayRes['lam_md']?.actual || 0) + (dayRes['md_lam']?.actual || 0),
        leave: (dayRes['lam_md']?.leave || 0) + (dayRes['md_lam']?.leave || 0),
        manHours: (dayRes['lam_md']?.manHours || 0) + (dayRes['md_lam']?.manHours || 0),
        otPsn: (dayRes['lam_md']?.otPsn || 0) + (dayRes['md_lam']?.otPsn || 0),
        otWorking: (dayRes['lam_md']?.otWorking || 0) + (dayRes['md_lam']?.otWorking || 0),
        otHoliday: (dayRes['lam_md']?.otHoliday || 0) + (dayRes['md_lam']?.otHoliday || 0)
      };
      dayRes['MD LAM'] = mdLamCombined;
      dayRes['LINE MD LAM'] = mdLamCombined;
      dayRes['MD_LAM'] = mdLamCombined;
      dayRes['LAM_MD'] = mdLamCombined;
      dayRes['LAM MD'] = mdLamCombined;
      dayRes['SMT-MD-LAM'] = mdLamCombined;
      dayRes['SMT-INT-MDLAM'] = mdLamCombined;
      dayRes['QA SMT AUTO'] = dayRes['oqi_s_auto'];
      dayRes['QA SMT GEN'] = dayRes['oqi_s_gen'];
      dayRes['MQA'] = dayRes['QA SMT'];

      // FPC Additional & Aliases
      dayRes['SUPPORT TF2'] = dayRes['at_front'];
      dayRes['LINE TF-2'] = dayRes['at_front'];
      dayRes['LAM_NIDEC'] = dayRes['line_lam'];
      dayRes['LAM'] = dayRes['line_lam'];

      // SMT Additional & Aliases
      dayRes['AIX-BLK'] = dayRes['blk_1'];
      dayRes['AIX-MOT'] = {
        register: (dayRes['mota']?.register || 0) + (dayRes['motb']?.register || 0),
        actual: (dayRes['mota']?.actual || 0) + (dayRes['motb']?.actual || 0),
        leave: (dayRes['mota']?.leave || 0) + (dayRes['motb']?.leave || 0),
        manHours: (dayRes['mota']?.manHours || 0) + (dayRes['motb']?.manHours || 0),
        otPsn: (dayRes['mota']?.otPsn || 0) + (dayRes['motb']?.otPsn || 0),
        otWorking: (dayRes['mota']?.otWorking || 0) + (dayRes['motb']?.otWorking || 0),
        otHoliday: (dayRes['mota']?.otHoliday || 0) + (dayRes['motb']?.otHoliday || 0)
      };
      dayRes['SMT-MOT'] = dayRes['AIX-MOT'];
      dayRes['BLK MD'] = dayRes['blk_2'];
      dayRes['BLK-2'] = dayRes['blk_2'];
      dayRes['LINE BLK-2'] = dayRes['blk_2'];
      dayRes['ASY5'] = dayRes['asy1_a'];
      dayRes['ASY6'] = dayRes['asy2'];
      dayRes['ASY7'] = dayRes['asy3'];
      dayRes['ASY1_A'] = dayRes['asy1_a'];
      dayRes['LINE ASY1_A'] = dayRes['asy1_a'];
      dayRes['ASY1_G'] = dayRes['asy1_g'];
      dayRes['LINE ASY1_G'] = dayRes['asy1_g'];
      dayRes['LINE ASY2'] = dayRes['asy2'];
      dayRes['LINE ASY3'] = dayRes['asy3'];
      dayRes['LINE AELT'] = dayRes['aelt'];
      dayRes['LINE MOTA_A'] = dayRes['mota'];
      dayRes['MOTA_A'] = dayRes['mota'];
      dayRes['LINE MOTA_G'] = dayRes['mota_g'];
      dayRes['MOTA_G'] = dayRes['mota_g'];
      dayRes['LINE MOTB'] = dayRes['motb'];
      dayRes['MOTB'] = dayRes['motb'];
      dayRes['LINE MOTB_G'] = dayRes['motb_g'];
      dayRes['LINE MOTC'] = dayRes['motc'];
      dayRes['LINE MOTD'] = dayRes['motd'];
      dayRes['LINE ASTP_A'] = dayRes['astp_a'];
      dayRes['LINE ASTP_G'] = dayRes['astp_g'];
      dayRes['LINE MAS'] = dayRes['mas'];
      dayRes['LINE REW'] = dayRes['rew'];
      dayRes['LINE XRAY'] = dayRes['xray'];
      dayRes['XRAY'] = dayRes['xray'];
      dayRes['LINE MD LAM'] = dayRes['md_lam'];
      dayRes['LINE SMT_LAM'] = dayRes['smt_lam'];

      // Macro FPC
      const directFpcHelpPrefixes = [
        "line_hps", "line_vac", "line_blk", "line_lam", "line_ost",
        "line_avi_k2", "line_d", "line_c", "line_b_gen", "line_b_non",
        "at_front", "at_vac", "at_lam", "line_a_final"
      ];
      const allFpcHelpPrefixes = [...directFpcHelpPrefixes, "line_mat"];
      const sumAllFpcHelp = (suffix) => allFpcHelpPrefixes.reduce((s, p) => s + (Number(metrics[`${p}_${suffix}`]) || 0), 0);

      const fpcTotalReg = metrics.fpc_total_register || 0;
      const fpcTotalAct = metrics.fpc_total_actual || 0;
      const fpcHelpInNormal = sumAllFpcHelp("help_in_normal");
      const fpcHelpOutNormal = sumAllFpcHelp("help_out_normal");
      const fpcHelpInOT1 = sumAllFpcHelp("help_in_ot1");
      const fpcHelpOutOT1 = sumAllFpcHelp("help_out_ot1");
      const fpcHelpInOT2 = sumAllFpcHelp("help_in_ot2");
      const fpcHelpOutOT2 = sumAllFpcHelp("help_out_ot2");

      const fpcNormalHrs = isWorking === 1 ? ((fpcTotalAct + fpcHelpInNormal) - fpcHelpOutNormal) * 8 : 0;
      const fpcOt1PsnCount = Number(metrics.fpc_ot1_actual) || 0;
      const fpcOt1Hrs = isWorking === 1 ? ((fpcOt1PsnCount + fpcHelpInOT1) - fpcHelpOutOT1) * 3 : 0;
      const fpcOt2PsnCount = isWorking === 0 ? (fpcTotalAct > 0 ? fpcTotalAct : fpcOt1PsnCount) : 0;
      const fpcOt2Hrs = isWorking === 0 ? ((fpcOt2PsnCount + fpcHelpInOT2) - fpcHelpOutOT2) * 11 : 0;

      dayRes['Macro FPC'] = {
        register: fpcTotalReg,
        actual: fpcTotalAct,
        leave: isWorking === 1 ? (fpcTotalReg - fpcTotalAct) : 0,
        manHours: fpcNormalHrs + fpcOt1Hrs + fpcOt2Hrs,
        otPsn: isWorking === 1 ? fpcOt1PsnCount : fpcOt2PsnCount,
        otWorking: isWorking === 1 ? fpcOt1PsnCount : 0,
        otHoliday: isWorking === 0 ? fpcOt2PsnCount : 0
      };

      // Direct FPC
      const directFpcReg = metrics.fpc_direct_register || 0;
      const directFpcAct = metrics.fpc_direct_actual || 0;
      const directFpcOt1 = metrics.fpc_direct_ot1_actual || 0;
      const directFpcHelpInNorm = directFpcHelpPrefixes.reduce((s, p) => s + (Number(metrics[`${p}_help_in_normal`]) || 0), 0);
      const directFpcHelpOutNorm = directFpcHelpPrefixes.reduce((s, p) => s + (Number(metrics[`${p}_help_out_normal`]) || 0), 0);
      const directFpcHelpInOT1 = directFpcHelpPrefixes.reduce((s, p) => s + (Number(metrics[`${p}_help_in_ot1`]) || 0), 0);
      const directFpcHelpOutOT1 = directFpcHelpPrefixes.reduce((s, p) => s + (Number(metrics[`${p}_help_out_ot1`]) || 0), 0);
      const directFpcHelpInOT2 = directFpcHelpPrefixes.reduce((s, p) => s + (Number(metrics[`${p}_help_in_ot2`]) || 0), 0);
      const directFpcHelpOutOT2 = directFpcHelpPrefixes.reduce((s, p) => s + (Number(metrics[`${p}_help_out_ot2`]) || 0), 0);

      const directFpcNormH = isWorking === 1 ? ((directFpcAct + directFpcHelpInNorm) - directFpcHelpOutNorm) * 8 : 0;
      const directFpcOt1H = isWorking === 1 ? ((directFpcOt1 + directFpcHelpInOT1) - directFpcHelpOutOT1) * 3 : 0;
      const directFpcOt2Psn = isWorking === 0 ? (directFpcOt1 > 0 ? directFpcOt1 : (directFpcAct < directFpcReg ? directFpcAct : 0)) : 0;
      const directFpcOt2H = isWorking === 0 ? ((directFpcOt2Psn + directFpcHelpInOT2) - directFpcHelpOutOT2) * 11 : 0;

      dayRes['Direct FPC'] = {
        register: directFpcReg,
        actual: directFpcAct,
        leave: isWorking === 1 ? (directFpcReg - directFpcAct) : 0,
        manHours: directFpcNormH + directFpcOt1H + directFpcOt2H,
        otPsn: isWorking === 1 ? directFpcOt1 : directFpcOt2Psn,
        otWorking: isWorking === 1 ? directFpcOt1 : 0,
        otHoliday: isWorking === 0 ? directFpcOt2Psn : 0
      };

      // Macro SMT_F
      const smtFPrefixes = ['mota', 'mota_g', 'motb', 'motb_g', 'motc', 'motd', 'astp_a', 'astp_g', 'xray', 'mas', 'rew', 's_tste_f', 's_tech_f'];
      let smtFReg = 0, smtFAct = 0, smtFMH = 0, smtFOtPsn = 0, smtFLeave = 0, smtFOtW = 0, smtFOtH = 0;
      smtFPrefixes.forEach(p => {
        if (dayRes[p]) {
          smtFReg += dayRes[p].register;
          smtFAct += dayRes[p].actual;
          smtFMH += dayRes[p].manHours;
          smtFOtPsn += dayRes[p].otPsn;
          smtFLeave += dayRes[p].leave;
          smtFOtW += dayRes[p].otWorking;
          smtFOtH += dayRes[p].otHoliday;
        }
      });
      dayRes['Macro SMT_F'] = { register: smtFReg, actual: smtFAct, leave: smtFLeave, manHours: Math.round(smtFMH), otPsn: smtFOtPsn, otWorking: smtFOtW, otHoliday: smtFOtH };

      // SMT FRONT_DIRECT (Direct Only - without indirect s_tste_f and s_tech_f)
      const smtFDirectPrefixes = ['mota', 'mota_g', 'motb', 'motb_g', 'motc', 'motd', 'astp_a', 'astp_g', 'xray', 'mas', 'rew'];
      let smtFDirReg = 0, smtFDirAct = 0, smtFDirMH = 0, smtFDirOtPsn = 0, smtFDirLeave = 0, smtFDirOtW = 0, smtFDirOtH = 0;
      smtFDirectPrefixes.forEach(p => {
        if (dayRes[p]) {
          smtFDirReg += dayRes[p].register;
          smtFDirAct += dayRes[p].actual;
          smtFDirMH += dayRes[p].manHours;
          smtFDirOtPsn += dayRes[p].otPsn;
          smtFDirLeave += dayRes[p].leave;
          smtFDirOtW += dayRes[p].otWorking;
          smtFDirOtH += dayRes[p].otHoliday;
        }
      });
      dayRes['SMT FRONT_DIRECT'] = { register: smtFDirReg, actual: smtFDirAct, leave: smtFDirLeave, manHours: Math.round(smtFDirMH), otPsn: smtFDirOtPsn, otWorking: smtFDirOtW, otHoliday: smtFDirOtH };
      dayRes['SMT Front_Direct'] = dayRes['SMT FRONT_DIRECT'];

      const smtFIndPrefixes = ['s_tste_f', 's_tech_f'];
      let smtFIndReg = 0, smtFIndAct = 0, smtFIndMH = 0, smtFIndOtPsn = 0, smtFIndLeave = 0, smtFIndOtW = 0, smtFIndOtH = 0;
      smtFIndPrefixes.forEach(p => {
        if (dayRes[p]) {
          smtFIndReg += dayRes[p].register;
          smtFIndAct += dayRes[p].actual;
          smtFIndMH += dayRes[p].manHours;
          smtFIndOtPsn += dayRes[p].otPsn;
          smtFIndLeave += dayRes[p].leave;
          smtFIndOtW += dayRes[p].otWorking;
          smtFIndOtH += dayRes[p].otHoliday;
        }
      });
      dayRes['SMT FRONT_INDIRECT'] = { register: smtFIndReg, actual: smtFIndAct, leave: smtFIndLeave, manHours: Math.round(smtFIndMH), otPsn: smtFIndOtPsn, otWorking: smtFIndOtW, otHoliday: smtFIndOtH };
      dayRes['SMT Front_Indirect'] = dayRes['SMT FRONT_INDIRECT'];

      // Macro SMT_B & ASY SMT
      const asyPrefixes = ['asy1_a', 'asy1_g', 'asy2', 'asy3', 'asy4'];
      let asyReg = 0, asyAct = 0, asyMH = 0, asyOtPsn = 0, asyLeave = 0, asyOtW = 0, asyOtH = 0;
      asyPrefixes.forEach(p => {
        if (dayRes[p]) {
          asyReg += dayRes[p].register;
          asyAct += dayRes[p].actual;
          asyMH += dayRes[p].manHours;
          asyOtPsn += dayRes[p].otPsn;
          asyLeave += dayRes[p].leave;
          asyOtW += dayRes[p].otWorking;
          asyOtH += dayRes[p].otHoliday;
        }
      });
      dayRes['ASY SMT'] = { register: asyReg, actual: asyAct, leave: asyLeave, manHours: Math.round(asyMH), otPsn: asyOtPsn, otWorking: asyOtW, otHoliday: asyOtH };

      const smtBPrefixes = ['blk_1', 'blk_2', 'asy1_a', 'asy1_g', 'asy2', 'asy3', 'asy4', 'aelt', 'smt_lam', 'lam_md', 'md_lam', 's_tste_b', 's_ind'];
      let smtBReg = 0, smtBAct = 0, smtBMH = 0, smtBOtPsn = 0, smtBLeave = 0, smtBOtW = 0, smtBOtH = 0;
      smtBPrefixes.forEach(p => {
        if (dayRes[p]) {
          smtBReg += dayRes[p].register;
          smtBAct += dayRes[p].actual;
          smtBMH += dayRes[p].manHours;
          smtBOtPsn += dayRes[p].otPsn;
          smtBLeave += dayRes[p].leave;
          smtBOtW += dayRes[p].otWorking;
          smtBOtH += dayRes[p].otHoliday;
        }
      });
      dayRes['Macro SMT_B'] = { register: smtBReg, actual: smtBAct, leave: smtBLeave, manHours: Math.round(smtBMH), otPsn: smtBOtPsn, otWorking: smtBOtW, otHoliday: smtBOtH };

      // SMT BACK_DIRECT (Direct Only - without indirect s_tste_b and s_ind)
      const smtBDirectPrefixes = ['blk_1', 'blk_2', 'asy1_a', 'asy1_g', 'asy2', 'asy3', 'asy4', 'aelt', 'smt_lam', 'lam_md', 'md_lam'];
      let smtBDirReg = 0, smtBDirAct = 0, smtBDirMH = 0, smtBDirOtPsn = 0, smtBDirLeave = 0, smtBDirOtW = 0, smtBDirOtH = 0;
      smtBDirectPrefixes.forEach(p => {
        if (dayRes[p]) {
          smtBDirReg += dayRes[p].register;
          smtBDirAct += dayRes[p].actual;
          smtBDirMH += dayRes[p].manHours;
          smtBDirOtPsn += dayRes[p].otPsn;
          smtBDirLeave += dayRes[p].leave;
          smtBDirOtW += dayRes[p].otWorking;
          smtBDirOtH += dayRes[p].otHoliday;
        }
      });
      dayRes['SMT BACK_DIRECT'] = { register: smtBDirReg, actual: smtBDirAct, leave: smtBDirLeave, manHours: Math.round(smtBDirMH), otPsn: smtBDirOtPsn, otWorking: smtBDirOtW, otHoliday: smtBDirOtH };
      dayRes['SMT Back_Direct'] = dayRes['SMT BACK_DIRECT'];

      const smtBIndPrefixes = ['s_tste_b', 's_ind'];
      let smtBIndReg = 0, smtBIndAct = 0, smtBIndMH = 0, smtBIndOtPsn = 0, smtBIndLeave = 0, smtBIndOtW = 0, smtBIndOtH = 0;
      smtBIndPrefixes.forEach(p => {
        if (dayRes[p]) {
          smtBIndReg += dayRes[p].register;
          smtBIndAct += dayRes[p].actual;
          smtBIndMH += dayRes[p].manHours;
          smtBIndOtPsn += dayRes[p].otPsn;
          smtBIndLeave += dayRes[p].leave;
          smtBIndOtW += dayRes[p].otWorking;
          smtBIndOtH += dayRes[p].otHoliday;
        }
      });
      dayRes['SMT BACK_INDIRECT'] = { register: smtBIndReg, actual: smtBIndAct, leave: smtBIndLeave, manHours: Math.round(smtBIndMH), otPsn: smtBIndOtPsn, otWorking: smtBIndOtW, otHoliday: smtBIndOtH };
      dayRes['SMT Back_Indirect'] = dayRes['SMT BACK_INDIRECT'];

      // Macro SMT (Macro SMT_F + Macro SMT_B)
      dayRes['Macro SMT'] = {
        register: smtFReg + smtBReg,
        actual: smtFAct + smtBAct,
        leave: smtFLeave + smtBLeave,
        manHours: Math.round(smtFMH + smtBMH),
        otPsn: smtFOtPsn + smtBOtPsn,
        otWorking: smtFOtW + smtBOtW,
        otHoliday: smtFOtH + smtBOtH
      };

      // Direct SMT (Macro SMT - All SMT Indirect)
      const smtIndReg = smtFIndReg + smtBIndReg;
      const smtIndAct = smtFIndAct + smtBIndAct;
      const smtIndLeave = smtFIndLeave + smtBIndLeave;
      const smtIndMH = smtFIndMH + smtBIndMH;
      const smtIndOtPsn = smtFIndOtPsn + smtBIndOtPsn;
      const smtIndOtW = smtFIndOtW + smtBIndOtW;
      const smtIndOtH = smtFIndOtH + smtBIndOtH;

      dayRes['Direct SMT'] = {
        register: (smtFReg + smtBReg) - smtIndReg,
        actual: (smtFAct + smtBAct) - smtIndAct,
        leave: (smtFLeave + smtBLeave) - smtIndLeave,
        manHours: Math.round((smtFMH + smtBMH) - smtIndMH),
        otPsn: (smtFOtPsn + smtBOtPsn) - smtIndOtPsn,
        otWorking: (smtFOtW + smtBOtW) - smtIndOtW,
        otHoliday: (smtFOtH + smtBOtH) - smtIndOtH
      };

      // Macro PCN
      const pcnTotalReg = metrics.total_register || 0;
      const pcnTotalAct = metrics.total_actual || 0;
      const pcnHelpInNormal = metrics.help_in_normal || 0;
      const pcnHelpOutNormal = metrics.help_out_normal || 0;
      const pcnHelpInOT1 = metrics.help_in_ot1 || 0;
      const pcnHelpOutOT1 = metrics.help_out_ot1 || 0;
      const pcnHelpInOT2 = metrics.help_in_ot2 || 0;
      const pcnHelpOutOT2 = metrics.help_out_ot2 || 0;

      const pcnNormalHrs = isWorking === 1 ? ((pcnTotalAct + pcnHelpInNormal) - pcnHelpOutNormal) * 8 : 0;
      const pcnOt1PsnCount = Number(metrics.ot1_actual) || 0;
      const pcnOt1Hrs = isWorking === 1 ? ((pcnOt1PsnCount + pcnHelpInOT1) - pcnHelpOutOT1) * 3 : 0;
      const pcnOt2PsnCount = isWorking === 0 ? (pcnTotalAct > 0 ? pcnTotalAct : pcnOt1PsnCount) : 0;
      const pcnOt2Hrs = isWorking === 0 ? ((pcnOt2PsnCount + pcnHelpInOT2) - pcnHelpOutOT2) * 11 : 0;

      dayRes['Macro PCN'] = {
        register: pcnTotalReg,
        actual: pcnTotalAct,
        leave: isWorking === 1 ? (pcnTotalReg - pcnTotalAct) : 0,
        manHours: pcnNormalHrs + pcnOt1Hrs + pcnOt2Hrs,
        otPsn: isWorking === 1 ? pcnOt1PsnCount : pcnOt2PsnCount,
        otWorking: isWorking === 1 ? pcnOt1PsnCount : 0,
        otHoliday: isWorking === 0 ? pcnOt2PsnCount : 0
      };

      // Custom Macros
      customMacros.forEach(macro => {
        let subLines = [];
        if (Array.isArray(macro.sub_lines)) subLines = macro.sub_lines;
        else if (typeof macro.sub_lines === 'string') {
          try { subLines = JSON.parse(macro.sub_lines); } catch (e) { subLines = []; }
        }

        let cReg = 0, cAct = 0, cMH = 0, cOtPsn = 0, cLeave = 0, cOtW = 0, cOtH = 0;
        const uniqueSubTargets = new Set();
        subLines.forEach(sub => {
          const uSub = String(sub || '').trim().toUpperCase();
          const mappedLine = ccMapBackend.get(uSub) || sub;
          if (mappedLine) uniqueSubTargets.add(mappedLine);
        });

        uniqueSubTargets.forEach(sub => {
          const uSub = String(sub || '').trim().toUpperCase();
          const prefix = String(sub || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
          const m = dayRes[sub] || dayRes[uSub] || dayRes[prefix] || (dayRes['line_' + prefix] || null);
          if (m) {
            cReg += m.register;
            cAct += m.actual;
            cMH += m.manHours;
            cOtPsn += m.otPsn;
            cLeave += m.leave;
            cOtW += m.otWorking;
            cOtH += m.otHoliday;
          }
        });
        dayRes[macro.macro_name] = { register: cReg, actual: cAct, leave: cLeave, manHours: cMH, otPsn: cOtPsn, otWorking: cOtW, otHoliday: cOtH };
      });

      dailyLineMetrics[dStr] = dayRes;
    });

    // 3. Map Daily Outputs (accumulate across all processes/mc_lines)
    const dailyOutputs = {}; // dateStr -> lineNameUpper -> { piece, sht, lot, pd, mos }
    outSnapRes.rows.forEach(r => {
      const dStr = dayjs(r.output_date).format('YYYY-MM-DD');
      const rawLg = (r.line_group || '').trim();
      const lg = rawLg.toUpperCase();
      const normLg = (lg === 'AVI_K2' || lg === 'AVI_INS' || lg === 'LINE AVI/K2' || lg.includes('AVI')) ? 'AVI/K2' : lg;

      if (!dailyOutputs[dStr]) dailyOutputs[dStr] = {};
      const keysToPopulate = new Set([lg, normLg]);
      if (lg === 'LINE NPM' || lg === 'NPM' || lg === 'MPM_FPC' || lg === 'NPM_FPC') {
        keysToPopulate.add('NPM_FPC');
        keysToPopulate.add('LINE NPM');
        keysToPopulate.add('NPM');
      }
      keysToPopulate.forEach(key => {
        if (!dailyOutputs[dStr][key]) {
          dailyOutputs[dStr][key] = { piece: 0, sht: 0, lot: 0, pd: 0, mos: 0 };
        }
        dailyOutputs[dStr][key].piece += Number(r.actual_piece_qty) || 0;
        dailyOutputs[dStr][key].sht += Number(r.actual_sht_qty) || 0;
        dailyOutputs[dStr][key].lot += Number(r.actual_lot_qty) || 0;
      });
    });

    // 3.05 Map LINE MAT from public.mat_daily_output (Excel Scan Data)
    (matDailyRes?.rows || []).forEach(r => {
      const dStr = dayjs(r.date).format('YYYY-MM-DD');
      const matKeys = ['LINE MAT', 'MAT'];
      if (!dailyOutputs[dStr]) dailyOutputs[dStr] = {};
      matKeys.forEach(lg => {
        if (!dailyOutputs[dStr][lg]) {
          dailyOutputs[dStr][lg] = { piece: 0, sht: 0, lot: 0, pd: 0, mos: 0 };
        }
        const pd = Number(r.pd_output) || 0;
        const mos = Number(r.mos_output) || 0;
        dailyOutputs[dStr][lg].pd += pd;
        dailyOutputs[dStr][lg].mos += mos;
        dailyOutputs[dStr][lg].piece += pd; // Primary sheet output as piece
        dailyOutputs[dStr][lg].sht += mos;   // MOS sheet output as sht
      });
    });

    // 3.1 Map SMT Daily Plans
    const normalizePlanLine = (line) => {
      if (!line) return '';
      const u = line.trim().toUpperCase();
      if (u === 'LINE NPM' || u === 'NPM' || u === 'MPM_FPC' || u === 'NPM_FPC') return 'NPM_FPC';
      if (u === 'AELT' || u === 'LINE AELT') return 'AELT';
      if (u === 'AIX-BLK' || u === 'LINE AIX-BLK' || u === 'BLK-1' || u === 'BLK1') return 'AIX-BLK';
      if (u === 'AIX-ASY' || u === 'LINE ASY4' || u === 'ASY4') return 'AIX-ASY';
      if (u === 'AIX-MOT' || u === 'LINE AIX-MOT') return 'AIX-MOT';
      if (u === 'SMT-MOT') return 'Macro SMT';
      if (u === 'ASTP_A' || u === 'LINE ASTP_A') return 'ASTP_A';
      if (u === 'ASTP_G' || u === 'LINE ASTP_G') return 'ASTP_G';
      if (u === 'ASY1_A' || u === 'LINE ASY1_A' || u === 'ASY1_AUTO') return 'ASY1_AUTO';
      if (u === 'ASY1_G' || u === 'LINE ASY1_G' || u === 'ASY1_GEN') return 'ASY1_GEN';
      if (u === 'ASY2' || u === 'LINE ASY2') return 'ASY2';
      if (u === 'ASY3' || u === 'LINE ASY3') return 'ASY3';
      if (u === 'BLK-2' || u === 'BLK2' || u === 'LINE BLK-2') return 'BLK2';
      if (u === 'MAS' || u === 'LINE MAS') return 'MAS';
      if (u === 'MD LAM' || u === 'LINE MD LAM' || u === 'LAM_MD') return 'MD LAM';
      if (u === 'MOTA_A' || u === 'LINE MOTA_A' || u === 'MOTA_AUTO') return 'MOTA_AUTO';
      if (u === 'MOTA_G' || u === 'LINE MOTA_G' || u === 'MOTA_GEN') return 'MOTA_GEN';
      if (u === 'MOTB' || u === 'LINE MOTB' || u === 'MOTB_AUTO') return 'MOTB_AUTO';
      if (u === 'MOTB_G' || u === 'LINE MOTB_G' || u === 'MOTB_GEN') return 'MOTB_GEN';
      if (u === 'MOTC' || u === 'LINE MOTC') return 'MOTC';
      if (u === 'MOTD' || u === 'LINE MOTD') return 'MOTD';
      if (u === 'REW' || u === 'LINE REW') return 'REW';
      if (u === 'XRAY' || u === 'X-RAY' || u === 'LINE XRAY' || u === 'X-Ray') return 'X-Ray';
      if (u === 'LAM' || u === 'SMT_LAM' || u === 'LINE SMT_LAM') return 'SMT_LAM';
      if (u === 'DIRECT SMT') return 'Direct SMT';
      if (u === 'MACRO SMT') return 'Macro SMT';
      if (u === 'MACRO SMT_F') return 'Macro SMT_F';
      if (u === 'SMT FRONT_DIRECT' || u === 'SMT FRONT DIRECT' || u === 'SMT FRONT_INDIRECT' || u === 'SMT Front_Direct') return 'SMT FRONT_DIRECT';
      if (u === 'MACRO SMT_B') return 'Macro SMT_B';
      if (u === 'SMT BACK_DIRECT' || u === 'SMT BACK DIRECT' || u === 'SMT Back_Direct') return 'SMT BACK_DIRECT';
      return line.trim();
    };

    const dailyPlans = {}; // dateStr -> lineNameUpper -> { piece, sht, lot }
    if (smtPlanRes && smtPlanRes.rows) {
      smtPlanRes.rows.forEach(r => {
        const dStr = r.date;
        const norm = normalizePlanLine(r.line);
        const normUpper = norm.trim().toUpperCase();
        if (!dailyPlans[dStr]) dailyPlans[dStr] = {};
        const val = Number(r.daily_plan) || 0;
        if (val > 0 || !dailyPlans[dStr][normUpper]) {
          dailyPlans[dStr][normUpper] = { piece: val, sht: 0, lot: 0 };
        }
      });
    }

    if (fpcPlanRes && fpcPlanRes.rows) {
      fpcPlanRes.rows.forEach(r => {
        const dStr = r.date;
        const norm = normalizePlanLine(r.line);
        const normUpper = norm.trim().toUpperCase();
        if (!dailyPlans[dStr]) dailyPlans[dStr] = {};
        const pVal = Number(r.piece_plan) || 0;
        const sVal = Number(r.sht_plan) || 0;
        const lVal = Number(r.lot_plan) || 0;
        dailyPlans[dStr][normUpper] = { piece: pVal, sht: sVal, lot: lVal };
      });
    }

    const getLinePlanForDate = (dStr, lineName) => {
      const dayP = dailyPlans[dStr] || {};
      const uLine = lineName.trim().toUpperCase();
      if (dayP[uLine]) return dayP[uLine];

      const normLine = normalizePlanLine(lineName).trim().toUpperCase();
      if (dayP[normLine]) return dayP[normLine];

      if (uLine === 'AIX-BLK' || uLine === 'LINE AIX-BLK' || uLine === 'BLK-1' || uLine === 'BLK1') {
        return dayP['AIX-BLK'] || { piece: 0, sht: 0, lot: 0 };
      }
      if (uLine === 'AIX-ASY' || uLine === 'LINE ASY4' || uLine === 'ASY4') {
        return dayP['AIX-ASY'] || { piece: 0, sht: 0, lot: 0 };
      }
      if (uLine === 'AUTOMOTIVE' || uLine === 'AUTOMATIVE') {
        return dayP['ASY1_AUTO'] || dayP['LINE ASY1_A'] || dayP['ASY1_A'] || { piece: 0, sht: 0, lot: 0 };
      }
      if (uLine === 'AIX-MOT' || uLine === 'LINE AIX-MOT') {
        return dayP['AIX-MOT'] || { piece: 0, sht: 0, lot: 0 };
      }
      if (uLine === 'LINE MAS & REW' || uLine === 'MAS & REW') {
        const pM = dayP['MAS'] || dayP['LINE MAS'] || { piece: 0, sht: 0, lot: 0 };
        const pR = dayP['REW'] || dayP['LINE REW'] || { piece: 0, sht: 0, lot: 0 };
        return { piece: pM.piece + pR.piece, sht: pM.sht + pR.sht, lot: pM.lot + pR.lot };
      }
      if (uLine === 'LINE VAC & HPS') {
        return dayP['LINE VAC'] || dayP['VAC'] || dayP['LINE VAC & HPS'] || { piece: 0, sht: 0, lot: 0 };
      }
      if (uLine === 'LINE B') {
        const pG = dayP['LINE B_GEN'] || dayP['B_GEN'] || { piece: 0, sht: 0, lot: 0 };
        const pN = dayP['LINE B_NON'] || dayP['B_NON'] || { piece: 0, sht: 0, lot: 0 };
        return { piece: pG.piece + pN.piece, sht: pG.sht + pN.sht, lot: pG.lot + pN.lot };
      }
      if (uLine === 'QA FPC') {
        const pA = dayP['QA FPC AUTO'] || dayP['QA_FPC_AUTO'] || { piece: 0, sht: 0, lot: 0 };
        const pG = dayP['QA FPC GEN'] || dayP['QA_FPC_GEN'] || { piece: 0, sht: 0, lot: 0 };
        return { piece: pA.piece + pG.piece, sht: pA.sht + pG.sht, lot: pA.lot + pG.lot };
      }
      if (uLine === 'QA SMT' || uLine === 'MQA') {
        const pA = dayP['QA SMT AUTO'] || dayP['QA_SMT_AUTO'] || dayP['OQI_S-AUTO'] || { piece: 0, sht: 0, lot: 0 };
        const pG = dayP['QA SMT GEN'] || dayP['QA_SMT_GEN'] || dayP['OQI_S-GEN'] || { piece: 0, sht: 0, lot: 0 };
        return { piece: pA.piece + pG.piece, sht: pA.sht + pG.sht, lot: pA.lot + pG.lot };
      }
      if (uLine === 'SMT FRONT_DIRECT' || uLine === 'SMT FRONT DIRECT' || uLine === 'SMT Front_Direct') {
        return dayP['SMT FRONT_DIRECT'] || dayP['SMT Front_Direct'] || dayP['MACRO SMT_F'] || { piece: 0, sht: 0, lot: 0 };
      }
      if (uLine === 'SMT BACK_DIRECT' || uLine === 'SMT BACK DIRECT' || uLine === 'SMT Back_Direct') {
        return dayP['SMT BACK_DIRECT'] || dayP['SMT Back_Direct'] || dayP['MACRO SMT_B'] || { piece: 0, sht: 0, lot: 0 };
      }

      // Check Custom Macro Line
      const matchingCustom = customMacros.find(m => m.macro_name.trim().toUpperCase() === uLine);
      if (matchingCustom) {
        let outLines = [];
        const src = matchingCustom.output_source_line;
        if (Array.isArray(src)) outLines = src.filter(Boolean);
        else if (typeof src === 'string' && src.trim()) {
          try { 
            const parsed = JSON.parse(src); 
            outLines = Array.isArray(parsed) ? parsed.filter(Boolean) : [src.trim()];
          } catch (e) { 
            outLines = [src.trim()]; 
          }
        }
        let pieceSum = 0, shtSum = 0, lotSum = 0;
        outLines.forEach(l => {
          const nL = normalizePlanLine(l).trim().toUpperCase();
          const p = dayP[nL] || dayP[l.trim().toUpperCase()] || { piece: 0, sht: 0, lot: 0 };
          pieceSum += p.piece;
          shtSum += p.sht;
          lotSum += p.lot;
        });
        return { piece: pieceSum, sht: shtSum, lot: lotSum };
      }

      return { piece: 0, sht: 0, lot: 0 };
    };

    const getLineOutputForDate = (dStr, lineName) => {
      const dayOut = dailyOutputs[dStr] || {};
      const uLine = lineName.trim().toUpperCase();

      const sumLines = (lines) => {
        let piece = 0, sht = 0, lot = 0;
        const processedCanonical = new Set();
        lines.forEach(l => {
          const rawL = l.trim().toUpperCase();
          const normL = normalizePlanLine(l).trim().toUpperCase();
          const canonical = normL || rawL;
          if (processedCanonical.has(canonical)) return;

          const keyToUse = dayOut[canonical] ? canonical : (dayOut[rawL] ? rawL : (dayOut[normL] ? normL : null));
          if (keyToUse) {
            processedCanonical.add(canonical);
            processedCanonical.add(keyToUse);
            const o = dayOut[keyToUse];
            if (o) {
              piece += o.piece;
              sht += o.sht;
              lot += o.lot;
            }
          }
        });
        return { piece, sht, lot };
      };

      if (uLine === 'MACRO PCN') {
        return sumLines(['LINE NPM', 'NPM_FPC', 'NPM', 'LINE A', 'LINE B_GEN', 'LINE B_NON', 'LINE C', 'LINE D', 'ASY1_AUTO', 'ASY1_GEN', 'ASY1_A', 'ASY1_G', 'ASY2', 'ASY3', 'AIX-ASY', 'LINE AIX-ASY']);
      }
      if (uLine === 'MACRO FPC' || uLine === 'DIRECT FPC') {
        return sumLines(['LINE NPM', 'NPM_FPC', 'NPM', 'LINE A', 'LINE B_GEN', 'LINE B_NON', 'LINE C', 'LINE D']);
      }
      if (uLine === 'LINE NPM' || uLine === 'NPM_FPC' || uLine === 'NPM') {
        const o = dayOut['NPM_FPC'] || dayOut['LINE NPM'] || dayOut['NPM'] || { piece: 0, sht: 0, lot: 0 };
        return { piece: o.piece || 0, sht: o.sht || 0, lot: o.lot || 0 };
      }
      if (uLine === 'MACRO SMT' || uLine === 'DIRECT SMT' || uLine === 'ASY SMT' || uLine === 'MACRO SMT_B' || uLine === 'SMT BACK_DIRECT') {
        return sumLines(['ASY1_AUTO', 'ASY1_GEN', 'ASY1_A', 'ASY1_G', 'ASY2', 'ASY3', 'AIX-ASY', 'LINE AIX-ASY']);
      }
      if (uLine === 'MACRO SMT_F' || uLine === 'SMT FRONT_DIRECT' || uLine === 'SMT Front_Direct') {
        return sumLines(['MOTA_A', 'MOTA_AUTO', 'MOTA_G', 'MOTA_GEN', 'MOTB', 'LINE MOTB', 'MOTB_AUTO', 'AIX-MOT', 'MOTC', 'MOTD']);
      }
      if (uLine === 'AUTOMOTIVE' || uLine === 'AUTOMATIVE') {
        return dayOut['ASY1_AUTO'] || dayOut['LINE ASY1_A'] || dayOut['ASY1_A'] || { piece: 0, sht: 0, lot: 0 };
      }
      if (uLine === 'LINE B') {
        return sumLines(['LINE B_GEN', 'LINE B_NON']);
      }
      if (uLine === 'LINE A') {
        return dayOut['LINE A'] || { piece: 0, sht: 0, lot: 0 };
      }
      if (uLine === 'AT_VAC' || uLine === 'A_VAC_A' || uLine === 'AT VAC') {
        return dayOut['AT_VAC'] || dayOut['A_VAC_A'] || dayOut['AT VAC'] || dayOut['AT-FVAC'] || { piece: 0, sht: 0, lot: 0 };
      }
      if (uLine === 'LINE VAC & HPS') {
        return dayOut['LINE VAC'] || dayOut['VAC'] || { piece: 0, sht: 0, lot: 0 };
      }
      if (uLine === 'LINE MAS & REW' || uLine === 'MAS & REW') {
        return sumLines(['MAS', 'REW']);
      }
      if (uLine === 'OQI_M' || uLine === 'LINE DQA') {
        return dayOut['OQI_M'] || dayOut['DQA'] || { piece: 0, sht: 0, lot: 0 };
      }
      if (uLine === 'MACRO SMT_B' || uLine === 'SMT BACK_DIRECT') {
        return sumLines(['AIX-BLK', 'LINE BLK-2', 'LINE ASY1_A', 'LINE ASY1_G', 'LINE ASY2', 'LINE ASY3', 'AIX-ASY', 'LINE AELT', 'LINE SMT_LAM', 'MD LAM', 'LINE S_IND']);
      }
      if (uLine === 'MACRO SMT' || uLine === 'DIRECT SMT') {
        const f = resolveDayOutput('MACRO SMT_F');
        const b = resolveDayOutput('MACRO SMT_B');
        return { piece: f.piece + b.piece, sht: f.sht + b.sht, lot: f.lot + b.lot };
      }
      if (uLine === 'MACRO PCN') {
        const smt = resolveDayOutput('MACRO SMT');
        const fpc = resolveDayOutput('MACRO FPC');
        return { piece: smt.piece + fpc.piece, sht: smt.sht + fpc.sht, lot: smt.lot + fpc.lot };
      }
      if (uLine === 'AIX-ASY') {
        return dayOut['AIX-ASY'] || dayOut['ASY4'] || dayOut['LINE ASY4'] || { piece: 0, sht: 0, lot: 0 };
      }
      if (uLine === 'QA FPC') {
        return sumLines(['OQI_F-AUTO', 'OQI_F-GEN', 'QA FPC AUTO', 'QA FPC GEN']);
      }
      if (uLine === 'QA SMT' || uLine === 'MQA') {
        return sumLines(['OQI_S-AUTO', 'OQI_S-GEN', 'QA SMT AUTO', 'QA SMT GEN']);
      }

      if (uLine === 'SUPPORT TF2' || uLine === 'LINE TF-2' || uLine === 'LINE TF2' || uLine === 'TF-2') {
        return dayOut['LINE TF-2'] || dayOut['SUPPORT TF2'] || dayOut['FTPK'] || { piece: 0, sht: 0, lot: 0 };
      }
      if (uLine === 'LAM_NIDEC' || uLine === 'LAM') return dayOut['LAM_NIDEC'] || dayOut['LAM_FPC'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'AIX-BLK') return dayOut['AIX-BLK'] || dayOut['BLK1'] || dayOut['BLK-1'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'AIX-MOT' || uLine === 'SMT-MOT') return dayOut['AIX-MOT'] || dayOut['MOTC'] || dayOut['LINE MOTC'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'BLK MD' || uLine === 'BLK-2' || uLine === 'LINE BLK-2') return dayOut['BLK MD'] || dayOut['BLK2'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'ASY5') return dayOut['ASY5'] || dayOut['ASY1_AUTO'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'ASY6') return dayOut['ASY6'] || dayOut['ASY2'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'ASY7') return dayOut['ASY7'] || dayOut['ASY3'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'LINE ASY1_A' || uLine === 'ASY1_A') return dayOut['ASY1_AUTO'] || dayOut['ASY1_A'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'LINE ASY1_G' || uLine === 'ASY1_G') return dayOut['ASY1_GEN'] || dayOut['ASY1_G'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'LINE ASY2') return dayOut['ASY2'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'LINE ASY3') return dayOut['ASY3'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'LINE AELT') return dayOut['AELT'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'LINE MOTA_A' || uLine === 'MOTA_A') return dayOut['MOTA_AUTO'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'LINE MOTA_G' || uLine === 'MOTA_G') return dayOut['MOTA_GEN'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'LINE MOTB' || uLine === 'MOTB' || uLine === 'MOTB_AUTO') return dayOut['LINE MOTB'] || dayOut['MOTB_AUTO'] || dayOut['MOTB'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'LINE MOTB_G' || uLine === 'MOTB_GEN') return { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'LINE MOTC') return dayOut['MOTC'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'LINE MOTD') return dayOut['MOTD'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'LINE ASTP_A') return dayOut['ASTP_A'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'LINE ASTP_G') return dayOut['ASTP_G'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'LINE MAS') return dayOut['MAS'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'LINE REW') return dayOut['REW'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'LINE XRAY' || uLine === 'XRAY') return dayOut['X-Ray'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'LINE MD LAM' || uLine === 'MD LAM' || uLine === 'MD_LAM' || uLine === 'LAM_MD') return dayOut['MD LAM'] || dayOut['MD_LAM'] || dayOut['LINE MD LAM'] || { piece: 0, sht: 0, lot: 0 };
      if (uLine === 'LINE SMT_LAM') return dayOut['SMT_LAM'] || { piece: 0, sht: 0, lot: 0 };

      // Check Custom Macro Line match
      const matchingCustom = customMacros.find(m => m.macro_name.trim().toUpperCase() === uLine);
      if (matchingCustom) {
        let outLines = [];
        if (Array.isArray(matchingCustom.output_source_line)) {
          outLines = matchingCustom.output_source_line.filter(Boolean);
        } else if (typeof matchingCustom.output_source_line === 'string' && matchingCustom.output_source_line.trim()) {
          try { 
            const parsed = JSON.parse(matchingCustom.output_source_line); 
            outLines = Array.isArray(parsed) ? parsed.filter(Boolean) : [matchingCustom.output_source_line.trim()];
          } catch (e) { 
            outLines = [matchingCustom.output_source_line.trim()]; 
          }
        }
        return sumLines(outLines);
      }

      if (uLine === 'AVI/K2' || uLine === 'AVI_K2' || uLine === 'AVI_INS' || uLine === 'LINE AVI/K2' || uLine.includes('AVI')) {
        const aviRes = dayOut['AVI/K2'] || dayOut['AVI_K2'] || dayOut['AVI_INS'] || dayOut['LINE AVI/K2'] || { piece: 0, sht: 0, lot: 0 };
        return { piece: aviRes.piece || 0, sht: aviRes.sht || 0, lot: aviRes.lot || 0 };
      }

      const res = dayOut[uLine] || { piece: 0, sht: 0, lot: 0, pd: 0, mos: 0 };
      return {
        piece: res.piece || 0,
        sht: res.sht || 0,
        lot: res.lot || 0,
        pd: res.pd || (uLine === 'LINE MAT' ? res.piece : 0),
        mos: res.mos || (uLine === 'LINE MAT' ? res.sht : 0),
      };
    };

    // 4. Define All Target Line Groups to Process (Exact Match with UI Names)
    const standardFpcLines = [
      'Macro PCN', 'Macro FPC', 'Direct FPC', 'LINE NPM', 'NPM_FPC', 'LINE A', 'AT_Front', 'AT_VAC', 'AT_LAM',
      'LINE A_FINAL', 'LINE B', 'LINE B_GEN', 'LINE B_NON', 'LINE C', 'LINE D',
      'LINE MAT', 'LINE LAM', 'LINE VAC & HPS', 'LINE VAC', 'LINE HPS', 'LINE BLK', 'LINE OST', 'AVI/K2', 'MDS',
      'QA FPC', 'OQI_F-AUTO', 'OQI_F-GEN', 'OQI_M', 'SUPPORT TF2', 'LAM_NIDEC', 'LAM'
    ];

    const standardSmtLines = [
      'Macro SMT', 'Macro SMT_F', 'Macro SMT_B', 'Direct SMT', 'SMT Front_Direct', 'SMT FRONT_DIRECT', 'SMT BACK_DIRECT',
      'Automotive',
      'MOTA_A', 'MOTA_G', 'MOTB', 'MOTB_G', 'AIX-MOT', 'MOTD',
      'ASTP_A', 'ASTP_G', 'MAS', 'REW', 'XRAY', 'MAS & REW',
      'AIX-BLK', 'BLK-2', 'ASY1_A', 'ASY1_G', 'ASY2', 'ASY3',
      'AIX-ASY', 'ASY5', 'ASY6', 'ASY7', 'AELT', 'SMT_LAM', 'MD LAM', 'ASY SMT',
      'QA SMT', 'OQI_S-AUTO', 'OQI_S-GEN'
    ];

    const customLineEntries = customMacros.map(m => ({
      line_group: m.macro_name,
      factory: m.factory || (m.macro_name.toUpperCase().includes('SMT') ? 'SMT' : 'FPC')
    }));

    const allLineDefinitions = [
      ...standardFpcLines.map(l => ({ line_group: l, factory: 'FPC' })),
      ...standardSmtLines.map(l => ({ line_group: l, factory: 'SMT' })),
      ...customLineEntries
    ];

    const uniqueLines = [];
    const seenLines = new Set();
    allLineDefinitions.forEach(item => {
      const key = item.line_group.trim().toUpperCase();
      if (!seenLines.has(key)) {
        seenLines.add(key);
        uniqueLines.push(item);
      }
    });

    // 5. Generate Target Periods: DAILY, WEEKLY, MONTHLY, YEARLY
    const periods = [];
    const todayStr = dayjs().format('YYYY-MM-DD');
    // Factory cutoff rule: output for Day D is closed on D+1 at 09:00 - 09:30 AM.
    // Daily summary must strictly only include closed dates prior to today (< todayStr).
    const closedDailyDates = Object.keys(summaryByDate).filter(dStr => dStr < todayStr).sort();
    const allDates = Object.keys(summaryByDate).sort();

    if (allDates.length === 0) {
      console.log('[PeriodSummaryService] No attendance dates found to process.');
      return { success: true, count: 0 };
    }

    // 5.1 DAILY Periods (Closed production days only)
    closedDailyDates.forEach(dStr => {
      periods.push({
        period_type: 'DAILY',
        period_key: dStr,
        start_date: dStr,
        end_date: dStr
      });
    });

    // 5.2 WEEKLY Periods (Month-bounded to match dynamic Excel production reports)
    const weekMap = new Map();
    allDates.forEach(dStr => {
      const d = dayjs(dStr);
      const wKey = getProductionWeekKey(d);
      
      const isoStart = d.startOf('isoWeek');
      const isoEnd = d.endOf('isoWeek');
      const monthParts = wKey.slice(0, 7).split('-');
      const assignedMonth = dayjs(`${monthParts[0]}-${monthParts[1]}-01`);
      const monthStart = assignedMonth.startOf('month');
      const monthEnd = assignedMonth.endOf('month');
      
      const effectiveStart = isoStart.isBefore(monthStart) ? monthStart : isoStart;
      const effectiveEnd = isoEnd.isAfter(monthEnd) ? monthEnd : isoEnd;

      if (!weekMap.has(wKey)) {
        weekMap.set(wKey, {
          period_type: 'WEEKLY',
          period_key: wKey,
          start_date: effectiveStart.format('YYYY-MM-DD'),
          end_date: effectiveEnd.format('YYYY-MM-DD')
        });
      } else {
        const existing = weekMap.get(wKey);
        if (d.isBefore(dayjs(existing.start_date))) {
          existing.start_date = d.format('YYYY-MM-DD');
        }
        if (d.isAfter(dayjs(existing.end_date))) {
          existing.end_date = d.format('YYYY-MM-DD');
        }
      }
    });
    weekMap.forEach(w => periods.push(w));

    // 5.3 MONTHLY Periods
    const monthMap = new Map();
    allDates.forEach(dStr => {
      const d = dayjs(dStr);
      const mKey = d.format('YYYY-MM');
      if (!monthMap.has(mKey)) {
        monthMap.set(mKey, {
          period_type: 'MONTHLY',
          period_key: mKey,
          start_date: d.startOf('month').format('YYYY-MM-DD'),
          end_date: d.endOf('month').format('YYYY-MM-DD')
        });
      }
    });
    monthMap.forEach(m => periods.push(m));

    // 5.4 YEARLY Periods
    const yearMap = new Map();
    allDates.forEach(dStr => {
      const d = dayjs(dStr);
      const yKey = d.format('YYYY');
      if (!yearMap.has(yKey)) {
        yearMap.set(yKey, {
          period_type: 'YEARLY',
          period_key: yKey,
          start_date: d.startOf('year').format('YYYY-MM-DD'),
          end_date: d.endOf('year').format('YYYY-MM-DD')
        });
      }
    });
    yearMap.forEach(y => periods.push(y));

    // 6. Calculate & Upsert Records
    let updatedCount = 0;

    for (const p of periods) {
      const start = dayjs(p.start_date);
      const end = dayjs(p.end_date);

      const daysInPeriod = [];
      let cur = start;
      while (cur.isBefore(end) || cur.isSame(end, 'day')) {
        daysInPeriod.push(cur.format('YYYY-MM-DD'));
        cur = cur.add(1, 'day');
      }

      for (const lineDef of uniqueLines) {
        const lineName = lineDef.line_group;
        const factory = lineDef.factory;

        let totalRegSum = 0;
        let totalManHoursSum = 0;
        let totalOtPsnSum = 0;
        let totalOtWorkingSum = 0;
        let totalOtHolidaySum = 0;
        let totalLeaveSum = 0;
        let totalWorkingRegSum = 0;
        let daysWithData = 0;
        let workingDaysWithData = 0;
        let holidayDaysWithData = 0;

        let totalPiecePlan = 0;
        let totalShtPlan = 0;
        let totalLotPlan = 0;
        let totalPieceOutput = 0;
        let totalShtOutput = 0;
        let totalLotOutput = 0;
        let totalPdOutput = 0;
        let totalMosOutput = 0;

        for (const dStr of daysInPeriod) {
          const isWorking = calendarMap.has(dStr) ? calendarMap.get(dStr) : (dayjs(dStr).day() === 0 ? 0 : 1);
          const m = dailyLineMetrics[dStr]?.[lineName] || (lineName.toUpperCase().includes('MD LAM') ? (dailyLineMetrics[dStr]?.['MD LAM'] || dailyLineMetrics[dStr]?.['LINE MD LAM']) : undefined);
          if (m && (m.register > 0 || m.manHours > 0)) {
            daysWithData++;
            totalRegSum += m.register;
            totalManHoursSum += m.manHours;
            totalOtPsnSum += m.otPsn;
            totalOtWorkingSum += (isWorking === 1 ? m.otWorking : 0);
            totalOtHolidaySum += (isWorking === 0 ? m.otHoliday : 0);
            totalLeaveSum += m.leave;

            if (isWorking === 1) {
              workingDaysWithData++;
              totalWorkingRegSum += m.register;
            } else {
              holidayDaysWithData++;
            }
          }

          const planVal = getLinePlanForDate(dStr, lineName);
          totalPiecePlan += planVal.piece;
          totalShtPlan += planVal.sht;
          totalLotPlan += planVal.lot;

          const out = getLineOutputForDate(dStr, lineName);
          totalPieceOutput += out.piece;
          totalShtOutput += out.sht;
          totalLotOutput += out.lot;
          totalPdOutput += (out.pd || 0);
          totalMosOutput += (out.mos || 0);
        }

        const avgRegister = daysWithData > 0 ? Math.round(totalRegSum / daysWithData) : 0;
        const avgLeave = workingDaysWithData > 0 ? Math.round(totalLeaveSum / workingDaysWithData) : 0;
        const leaveRate = totalWorkingRegSum > 0 ? (totalLeaveSum / totalWorkingRegSum) * 100 : 0;

        const otWorkingRate = (workingDaysWithData > 0 && avgRegister > 0)
          ? ((totalOtWorkingSum / workingDaysWithData) / avgRegister) * 100
          : 0;

        const otHolidayRate = (holidayDaysWithData > 0 && avgRegister > 0)
          ? ((totalOtHolidaySum / holidayDaysWithData) / avgRegister) * 100
          : 0;

        const productivity = totalManHoursSum > 0 ? (totalPieceOutput / totalManHoursSum) : 0;
        const shtProductivity = totalManHoursSum > 0 ? (totalShtOutput / totalManHoursSum) : 0;
        const avgOtPsn = daysWithData > 0 ? Math.round(totalOtPsnSum / daysWithData) : 0;

        // Calculate SUM Productivity (Piece & Sheet)
        // - DAILY: running Month-to-Date (MTD) Accumulated Productivity
        // - WEEKLY: running Year-to-Date (YTD) Accumulated Productivity
        // - MONTHLY: running Year-to-Date (YTD) Accumulated Productivity
        // - YEARLY: overall year productivity
        let sumProd = productivity;
        let shtSumProd = shtProductivity;
        if (p.period_type === 'DAILY') {
          let mtdPiece = 0;
          let mtdSht = 0;
          let mtdMH = 0;
          let dIter = dayjs(p.start_date).startOf('month');
          const dEnd = dayjs(p.start_date);
          while (dIter.isBefore(dEnd) || dIter.isSame(dEnd, 'day')) {
            const dKey = dIter.format('YYYY-MM-DD');
            const dayM = dailyLineMetrics[dKey]?.[lineName];
            const dayOut = getLineOutputForDate(dKey, lineName);
            const dMH = dayM ? dayM.manHours : 0;
            const dPiece = dayOut ? dayOut.piece : 0;
            const dSht = dayOut ? dayOut.sht : 0;
            if (dMH > 0 && (dPiece > 0 || dSht > 0)) {
              mtdPiece += dPiece;
              mtdSht += dSht;
              mtdMH += dMH;
            }
            dIter = dIter.add(1, 'day');
          }
          sumProd = mtdMH > 0 ? (mtdPiece / mtdMH) : productivity;
          shtSumProd = mtdMH > 0 ? (mtdSht / mtdMH) : shtProductivity;
        } else if (p.period_type === 'WEEKLY' || p.period_type === 'MONTHLY') {
          let ytdPiece = 0;
          let ytdSht = 0;
          let ytdMH = 0;
          // Fiscal Year starts April 1st (e.g. 2026-04-01 for Q1 Apr-Jun, Q2 Jul-Sep, etc.)
          const pDate = dayjs(p.start_date);
          const fyYear = pDate.month() >= 3 ? pDate.year() : pDate.year() - 1;
          let dIter = dayjs(`${fyYear}-04-01`);
          const dEnd = dayjs(p.end_date);
          while (dIter.isBefore(dEnd) || dIter.isSame(dEnd, 'day')) {
            const dKey = dIter.format('YYYY-MM-DD');
            const dayM = dailyLineMetrics[dKey]?.[lineName];
            const dayOut = getLineOutputForDate(dKey, lineName);
            const dMH = dayM ? dayM.manHours : 0;
            const dPiece = dayOut ? dayOut.piece : 0;
            const dSht = dayOut ? dayOut.sht : 0;
            if (dMH > 0 && (dPiece > 0 || dSht > 0)) {
              ytdPiece += dPiece;
              ytdSht += dSht;
              ytdMH += dMH;
            }
            dIter = dIter.add(1, 'day');
          }
          sumProd = ytdMH > 0 ? (ytdPiece / ytdMH) : productivity;
          shtSumProd = ytdMH > 0 ? (ytdSht / ytdMH) : shtProductivity;
        }

        await poolTest.query(`
          INSERT INTO public.productivity_period_summary (
            period_type, period_key, start_date, end_date, factory, line_group,
            op_leader_register, total_man_hour, piece_plan, piece_output, sht_output, lot_output,
            actual_productivity, sum_productivity,
            sht_plan, lot_plan, sht_prod_target, sht_actual_productivity, sht_sum_productivity,
            ot_psn, ot_working_day_rate, ot_holiday_day_rate,
            leave_psn, leave_working_day_rate, pd_output, mos_output, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11, $12,
            $13, $14,
            $15, $16, $17, $18, $19,
            $20, $21, $22,
            $23, $24, $25, $26, NOW()
          )
          ON CONFLICT (period_type, period_key, factory, line_group) DO UPDATE SET
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            op_leader_register = EXCLUDED.op_leader_register,
            total_man_hour = EXCLUDED.total_man_hour,
            piece_plan = EXCLUDED.piece_plan,
            piece_output = EXCLUDED.piece_output,
            sht_output = EXCLUDED.sht_output,
            lot_output = EXCLUDED.lot_output,
            actual_productivity = EXCLUDED.actual_productivity,
            sum_productivity = EXCLUDED.sum_productivity,
            sht_plan = EXCLUDED.sht_plan,
            lot_plan = EXCLUDED.lot_plan,
            sht_prod_target = EXCLUDED.sht_prod_target,
            sht_actual_productivity = EXCLUDED.sht_actual_productivity,
            sht_sum_productivity = EXCLUDED.sht_sum_productivity,
            ot_psn = EXCLUDED.ot_psn,
            ot_working_day_rate = EXCLUDED.ot_working_day_rate,
            ot_holiday_day_rate = EXCLUDED.ot_holiday_day_rate,
            leave_psn = EXCLUDED.leave_psn,
            leave_working_day_rate = EXCLUDED.leave_working_day_rate,
            updated_at = NOW()
        `, [
          p.period_type,
          p.period_key,
          p.start_date,
          p.end_date,
          factory,
          lineName,
          avgRegister,
          Math.round(totalManHoursSum * 100) / 100,
          totalPiecePlan,
          totalPieceOutput,
          totalShtOutput,
          totalLotOutput,
          Math.round(productivity * 100) / 100,
          Math.round(sumProd * 100) / 100,
          totalShtPlan,
          totalLotPlan,
          0, // sht_prod_target
          Math.round(shtProductivity * 100) / 100,
          Math.round(shtSumProd * 100) / 100,
          Math.round(avgOtPsn),
          Math.round(otWorkingRate * 100) / 100,
          Math.round(otHolidayRate * 100) / 100,
          p.period_type === 'DAILY' ? totalLeaveSum : avgLeave,
          Math.round(leaveRate * 100) / 100,
          totalPdOutput,
          totalMosOutput
        ]);

        updatedCount++;
      }
    }

    console.log(`[PeriodSummaryService] Successfully synced ${updatedCount} period summary records.`);
    return { success: true, updatedCount };
  } catch (error) {
    console.error('[PeriodSummaryService] Error:', error.message);
    throw error;
  }
}



module.exports = {
  getProductionWeekKey,
  syncProductivityPeriodSummary
};
