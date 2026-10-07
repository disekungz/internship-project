import { normalizeMatrixLineGroupName } from "../hooks/useProcessOutputData";
import { findCustomMacro, getCustomMacroSubLines } from "./customMacroStore";

export const getSubLineAttendancePrefix = (subLineName: string): string => {
  if (!subLineName) return "";
  const norm = subLineName.trim().toUpperCase();
  const map: Record<string, string> = {
    "LINE MOTA_A": "mota",
    "LINE MOTA_G": "mota_g",
    "MOTA_A": "mota",
    "MOTA_G": "mota_g",
    "LINE MOTB": "motb",
    "LINE MOTB_G": "motb_g",
    "MOTB": "motb",
    "MOTB_G": "motb_g",
    "LINE MOTC": "motc",
    "MOTC": "motc",
    "LINE MOTD": "motd",
    "MOTD": "motd",
    "LINE ASTP_A": "astp_a",
    "LINE ASTP_G": "astp_g",
    "ASTP_A": "astp_a",
    "ASTP_G": "astp_g",
    "LINE MAS": "mas",
    "MAS": "mas",
    "LINE REW": "rew",
    "REW": "rew",
    "LINE MAS & REW": "mas_rew",
    "MAS & REW": "mas_rew",
    "LINE XRAY": "xray",
    "XRAY": "xray",
    "LINE ASY1_A": "asy1_a",
    "ASY1_A": "asy1_a",
    "LINE ASY1_G": "asy1_g",
    "ASY1_G": "asy1_g",
    "LINE ASY2": "asy2",
    "ASY2": "asy2",
    "LINE ASY3": "asy3",
    "ASY3": "asy3",
    "LINE ASY4": "asy4",
    "ASY4": "asy4",
    "LINE ASY5": "asy5",
    "ASY5": "asy5",
    "LINE ASY6": "asy6",
    "ASY6": "asy6",
    "LINE ASY7": "asy7",
    "ASY7": "asy7",
    "LINE AELT": "aelt",
    "AELT": "aelt",
    "LINE SMT_LAM": "smt_lam",
    "SMT_LAM": "smt_lam",
    "MD LAM": "lam_md",
    "LINE MD LAM": "lam_md",
    "AIX-BLK": "blk_1",
    "LINE AIX-BLK": "blk_1",
    "LINE BLK-2": "blk_2",
    "BLK-2": "blk_2",
    "LINE A_FINAL": "line_a_final",
    "A_FINAL": "line_a_final",
    "LINE A": "line_a",
    "A": "line_a",
    "LINE B": "line_b",
    "B": "line_b",
    "LINE B_GEN": "line_b_gen",
    "B_GEN": "line_b_gen",
    "LINE B_NON": "line_b_non",
    "B_NON": "line_b_non",
    "LINE C": "line_c",
    "C": "line_c",
    "LINE D": "line_d",
    "D": "line_d",
    "LINE MAT": "line_mat",
    "MAT": "line_mat",
    "LAM_FPC": "line_lam",
    "LINE LAM": "line_lam",
    "LINE VAC": "line_vac",
    "VAC": "line_vac",
    "LINE HPS": "line_hps",
    "HPS": "line_hps",
    "LINE BLK": "line_blk",
    "BLK": "line_blk",
    "LINE OST": "line_ost",
    "OST": "line_ost",
    "AVI_INS": "line_avi_k2",
    "AVI/K2": "line_avi_k2",
    "LINE AVI/K2": "line_avi_k2",
    "MDS": "mds",
    "AT_VAC": "at_vac",
    "AT VAC": "at_vac",
    "A_TF2": "at_front",
    "AT_FRONT": "at_front",
    "AT FRONT": "at_front",
    "A_LAM": "at_lam",
    "AT_LAM": "at_lam",
    "AT LAM": "at_lam"
  };

  if (map[norm]) return map[norm];
  if (norm.startsWith("P464-1") || norm.startsWith("P465-1") || norm.startsWith("P464-2") || norm.startsWith("P465-2") || norm.includes("PA_VAC") || norm.includes("PA_HPS") || norm.includes("AT_VAC")) return "at_vac";
  if (norm.startsWith("P460") || norm.includes("AT_FRONT") || norm.includes("TF2")) return "at_front";
  if (norm.startsWith("P461") || norm === "LINE A" || norm === "A") return "line_a";
  if (norm.startsWith("P462-1") || norm.includes("B_GEN")) return "line_b_gen";
  if (norm.startsWith("P462-2") || norm.includes("B_NON")) return "line_b_non";
  if (norm.startsWith("P463") || norm.includes("LINE C")) return "line_c";
  if (norm.startsWith("P466") || norm.includes("LINE D")) return "line_d";
  if (norm.startsWith("P467") || norm.includes("LINE MAT")) return "line_mat";
  if (norm.startsWith("P468") || norm.includes("LAM_FPC")) return "line_lam";

  if (norm.includes("AIX-ASY") || norm.includes("AIX_ASY") || norm.includes("ASY4")) return "asy4";
  if (norm.includes("AIX-BLK") || norm.includes("AIX_BLK") || norm.includes("BLK-1") || norm.includes("BLK_1")) return "blk_1";
  if (norm.includes("AIX-MOT") || norm.includes("AIX_MOT") || norm.includes("MOTC")) return "motc";

  // Dynamic fallback for any newly created line name (e.g. 'LINE FOO' -> 'line_foo')
  const clean = norm.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return clean || "";
};

export const checkIsMacroRow = (lineGroup: string): boolean => {
  return true;
};

/**
 * Dynamic resolution of attendance metrics from daily attendance snapshot object.
 * Checks known prefix aliases, raw names, uppercase, sanitized snake_case, and cost center keys (cc_...).
 * If total_man_hour is requested and not directly stored, dynamically calculates (actual * 8) + (ot * 2.5).
 */
export const getDynamicAttendanceValue = (
  prefixOrName: string,
  data: any,
  fpcKey: string,
  key: string
): number => {
  if (!data || !prefixOrName) return 0;

  const raw = prefixOrName.trim();
  const rawUpper = raw.toUpperCase();
  const clean = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const noLine = clean.replace(/^line_/, '');
  const withLine = clean.startsWith('line_') ? clean : `line_${clean}`;
  const knownPrefix = getSubLineAttendancePrefix(raw);

  const candidates = Array.from(new Set([
    knownPrefix,
    withLine,
    clean,
    noLine,
    `cc_${rawUpper}`,
    `cc_${clean}`,
    `cc_${noLine}`,
    rawUpper,
    rawUpper.replace(/[-_]/g, ''),
    `cc_${rawUpper.replace(/[-_]/g, '')}`,
    ...(rawUpper === 'TOTAL' || rawUpper === 'MACRO PCN' ? ['macro_pcn', ''] : [])
  ]));

  const getCandidatesForMetric = (suffixes: string[]): number | null => {
    for (const p of candidates) {
      for (const s of suffixes) {
        const candidateKey = p ? `${p}_${s}` : s;
        if (data[candidateKey] !== undefined && data[candidateKey] !== null) {
          return Number(data[candidateKey]) || 0;
        }
      }
      // Check if candidate key itself exists in data
      if (p && data[p] !== undefined && typeof data[p] === 'object' && data[p] !== null) {
        for (const s of suffixes) {
          if (data[p][s] !== undefined) return Number(data[p][s]) || 0;
        }
      }
      // Check if candidate exists in data.byLine
      if (p && data.byLine) {
        const lineObj = data.byLine[p] || data.byLine[p.toUpperCase()] || data.byLine[`LINE ${p.toUpperCase()}`] || data.byLine[p.replace(/^line_/i, '').toUpperCase()];
        if (lineObj && typeof lineObj === 'object') {
          for (const s of suffixes) {
            if (lineObj[s] !== undefined && lineObj[s] !== null) return Number(lineObj[s]) || 0;
          }
        }
      }
    }
    return null;
  };

  // 1. Total Register
  if (fpcKey === 'fpc_total_register' || key === 'total_register' || key === 'register') {
    const val = getCandidatesForMetric(['total_register', 'register', 'op_leader_register']);
    return val !== null ? val : 0;
  }

  // 2. Total Actual
  if (fpcKey === 'fpc_total_actual' || key === 'total_actual' || key === 'actual') {
    const val = getCandidatesForMetric(['total_actual', 'actual']);
    return val !== null ? val : 0;
  }

  // 3. Overtime Person
  if (fpcKey === 'fpc_ot_psn' || key === 'ot_psn' || key === 'ot1_actual') {
    const val = getCandidatesForMetric(['ot1_actual', 'ot_psn', 'ot_actual', 'ot1']);
    return val !== null ? val : 0;
  }

  // 4. Total Man-Hour
  if (fpcKey === 'fpc_total_man_hour' || key === 'total_man_hour' || key === 'man_hours' || key === 'manHours') {
    const val = getCandidatesForMetric(['total_man_hour', 'man_hours', 'manHours']);
    if (val !== null && val > 0) return Math.round(val);
    // Fallback: Calculate dynamically if actual or OT are present
    const act = getDynamicAttendanceValue(prefixOrName, data, 'fpc_total_actual', 'total_actual');
    const ot = getDynamicAttendanceValue(prefixOrName, data, 'fpc_ot_psn', 'ot_psn');
    if (act > 0 || ot > 0) {
      return Math.round((act * 8) + (ot * 2.5));
    }
    return 0;
  }

  // 5. Leave Person
  if (fpcKey === 'fpc_leave' || key === 'leave' || key === 'leave_psn') {
    const val = getCandidatesForMetric(['leave', 'leave_psn']);
    return val !== null ? val : 0;
  }

  // 6. Leave Working Day Rate
  if (fpcKey === 'fpc_leave_working_day_rate' || key === 'leave_working_day_rate') {
    const val = getCandidatesForMetric(['leave_working_day_rate']);
    if (val !== null) return val;
    const reg = getDynamicAttendanceValue(prefixOrName, data, 'fpc_total_register', 'total_register');
    const lv = getDynamicAttendanceValue(prefixOrName, data, 'fpc_leave', 'leave');
    return reg > 0 ? (lv / reg) * 100 : 0;
  }

  // 7. OT Working Day Rate
  if (fpcKey === 'fpc_ot_working_day_rate' || key === 'ot_working_day_rate') {
    const val = getCandidatesForMetric(['ot_working_day_rate']);
    if (val !== null) return val;
    const reg = getDynamicAttendanceValue(prefixOrName, data, 'fpc_total_register', 'total_register');
    const ot = getDynamicAttendanceValue(prefixOrName, data, 'fpc_ot_psn', 'ot_psn');
    return reg > 0 ? (ot / reg) * 100 : 0;
  }

  // 8. OT Holiday Day Rate
  if (fpcKey === 'fpc_ot_holiday_day_rate' || key === 'ot_holiday_day_rate') {
    const val = getCandidatesForMetric(['ot_holiday_day_rate']);
    return val !== null ? val : 0;
  }

  // 9. Help In / Out
  if (fpcKey === 'fpc_help_in_normal' || key === 'help_in_normal' || key === 'help_in') {
    const val = getCandidatesForMetric(['help_in_normal', 'help_in']);
    return val !== null ? val : 0;
  }
  if (fpcKey === 'fpc_help_out_normal' || key === 'help_out_normal' || key === 'help_out') {
    const val = getCandidatesForMetric(['help_out_normal', 'help_out']);
    return val !== null ? val : 0;
  }
  if (fpcKey === 'fpc_help_in_psn' || key === 'help_in_psn') {
    const val = getCandidatesForMetric(['help_in_psn', 'help_in_normal']);
    return val !== null ? val : 0;
  }
  if (fpcKey === 'fpc_help_out_psn' || key === 'help_out_psn') {
    const val = getCandidatesForMetric(['help_out_psn', 'help_out_normal']);
    return val !== null ? val : 0;
  }
  if (fpcKey === 'fpc_help_in_ot1' || key === 'help_in_ot1') {
    const val = getCandidatesForMetric(['help_in_ot1']);
    return val !== null ? val : 0;
  }
  if (fpcKey === 'fpc_help_out_ot1' || key === 'help_out_ot1') {
    const val = getCandidatesForMetric(['help_out_ot1']);
    return val !== null ? val : 0;
  }
  if (fpcKey === 'fpc_help_in_ot2' || key === 'help_in_ot2') {
    const val = getCandidatesForMetric(['help_in_ot2']);
    return val !== null ? val : 0;
  }
  if (fpcKey === 'fpc_help_out_ot2' || key === 'help_out_ot2') {
    const val = getCandidatesForMetric(['help_out_ot2']);
    return val !== null ? val : 0;
  }

  // Fallback direct check
  const suffix = (fpcKey || key || '').replace(/^fpc_/, '');
  const val = getCandidatesForMetric([suffix]);
  return val !== null ? val : 0;
};

export const getMappedAttendanceValue = (
  lineGroup: string,
  data: any,
  fpcKey: string,
  key: string,
  granularity: string
): number => {
  if (!data) return 0;
  const rawGroup = lineGroup.trim().toUpperCase();
  const normGroup = normalizeMatrixLineGroupName(lineGroup).trim().toUpperCase();

  const isBuiltInMacro = 
    rawGroup === "DIRECT FPC" || normGroup === "DIRECT FPC" ||
    rawGroup === "MACRO PCN" || normGroup === "MACRO PCN" ||
    rawGroup === "MACRO FPC" || normGroup === "MACRO FPC" ||
    rawGroup === "MACRO SMT" || normGroup === "MACRO SMT" ||
    rawGroup === "MACRO SMT_F" || normGroup === "MACRO SMT_F" ||
    rawGroup === "SMT FRONT_DIRECT" || normGroup === "SMT FRONT_DIRECT" ||
    rawGroup === "MACRO SMT_B" || normGroup === "MACRO SMT_B" ||
    rawGroup === "SMT BACK_DIRECT" || normGroup === "SMT BACK_DIRECT" ||
    rawGroup === "DIRECT SMT" || normGroup === "DIRECT SMT" ||
    rawGroup === "AUTOMOTIVE" || rawGroup === "AUTOMATIVE";

  const matchingCustom = !isBuiltInMacro ? (findCustomMacro(rawGroup) || findCustomMacro(normGroup)) : null;

  // 1. Period Summary (Weekly, Monthly, Yearly, Quarterly)
  if (granularity !== 'daily') {
    const targetLine = data._line_metrics?.[rawGroup] || data._line_metrics?.[normGroup] || data._line_metrics?.[lineGroup]
      || data.byLine?.[rawGroup] || data.byLine?.[normGroup] || data.byLine?.[lineGroup]
      || data.byLine?.[lineGroup.toUpperCase()]
      || data.byLine?.[`LINE ${rawGroup}`]
      || data.byLine?.[rawGroup.replace(/^LINE\s+/i, '')];
    if (targetLine) {
      const reg = Number(targetLine.op_leader_register ?? targetLine.register ?? 0);
      const act = Number(targetLine.actual ?? (targetLine.op_leader_register ? targetLine.op_leader_register - (targetLine.leave_psn || targetLine.leave || 0) : 0));
      const mh = Number(targetLine.total_man_hour ?? targetLine.manHours ?? 0);
      const otPsn = Number(targetLine.ot_psn ?? targetLine.otPsn ?? 0);
      const leave = Number(targetLine.leave_psn ?? targetLine.leave ?? 0);
      const leaveRate = Number(targetLine.leave_working_day_rate ?? 0);
      const otWorkRate = Number(targetLine.ot_working_day_rate ?? 0);
      const otHolRate = Number(targetLine.ot_holiday_day_rate ?? 0);
      const actProd = Number(targetLine.actual_productivity ?? 0);
      const sumProd = Number(targetLine.sum_productivity ?? 0);
      const shtActProd = Number(targetLine.sht_actual_productivity ?? 0);
      const shtSumProd = Number(targetLine.sht_sum_productivity ?? 0);

      const isCompositeGroup =
        isBuiltInMacro ||
        Boolean(matchingCustom) ||
        rawGroup === 'QA SMT' || normGroup === 'QA SMT' || rawGroup === 'MQA' ||
        rawGroup === 'QA FPC' || normGroup === 'QA FPC' ||
        rawGroup === 'ASY SMT' || normGroup === 'ASY SMT' ||
        rawGroup === 'LINE B' || normGroup === 'LINE B' ||
        rawGroup === 'LINE VAC & HPS' || normGroup === 'LINE VAC & HPS';

      if (!isCompositeGroup) {
        if (fpcKey === 'fpc_total_register' || key === 'total_register') return reg;
        if (fpcKey === 'fpc_total_actual' || key === 'total_actual') return act;
        if (fpcKey === 'fpc_total_man_hour' || key === 'total_man_hour') return mh;
        if (fpcKey === 'fpc_ot_psn' || key === 'ot_psn') return otPsn;
        if (fpcKey === 'fpc_leave' || key === 'leave') return leave;
        if (fpcKey === 'fpc_leave_working_day_rate' || key === 'leave_working_day_rate') return leaveRate;
        if (fpcKey === 'fpc_ot_working_day_rate' || key === 'ot_working_day_rate') return otWorkRate;
        if (fpcKey === 'fpc_ot_holiday_day_rate' || key === 'ot_holiday_day_rate') return otHolRate;
        if (fpcKey === 'fpc_actual_productivity' || key === 'actual_productivity') return actProd;
        if (fpcKey === 'fpc_sum_productivity' || key === 'sum_productivity') return sumProd;
        if (fpcKey === 'fpc_sht_actual_productivity' || key === 'sht_actual_productivity') return shtActProd;
        if (fpcKey === 'fpc_sht_sum_productivity' || key === 'sht_sum_productivity') return shtSumProd;
      }
    }
  }

  // 2. Custom Macro Lines (Daily view, Weekly rollup, or non-precomputed period)
  if (matchingCustom) {
    const subLines = getCustomMacroSubLines(matchingCustom);

    // Rate metrics: weighted average based on totalRegister
    if (fpcKey === 'fpc_leave_working_day_rate' || key === 'leave_working_day_rate') {
      let totalReg = 0;
      let totalLeave = 0;
      subLines.forEach(sub => {
        const subRaw = sub.trim().toUpperCase();
        const subNorm = normalizeMatrixLineGroupName(sub).trim().toUpperCase();
        const subTarget = data._line_metrics?.[subRaw] || data._line_metrics?.[subNorm] || data._line_metrics?.[sub]
          || data.byLine?.[subRaw] || data.byLine?.[subNorm] || data.byLine?.[sub]
          || data.byLine?.[`LINE ${subRaw}`]
          || data.byLine?.[subRaw.replace(/^LINE\s+/i, '')];
        if (subTarget) {
          totalReg += Number(subTarget.op_leader_register ?? subTarget.register ?? 0);
          totalLeave += Number(subTarget.leave_psn ?? subTarget.leave ?? 0);
        } else {
          totalReg += getDynamicAttendanceValue(sub, data, 'fpc_total_register', 'total_register');
          totalLeave += getDynamicAttendanceValue(sub, data, 'fpc_leave', 'leave');
        }
      });
      return totalReg > 0 ? (totalLeave / totalReg) * 100 : 0;
    }

    if (fpcKey === 'fpc_ot_working_day_rate' || key === 'ot_working_day_rate' || fpcKey === 'fpc_ot_holiday_day_rate' || key === 'ot_holiday_day_rate') {
      let totalReg = 0;
      let totalOt = 0;
      subLines.forEach(sub => {
        const subRaw = sub.trim().toUpperCase();
        const subNorm = normalizeMatrixLineGroupName(sub).trim().toUpperCase();
        const subTarget = data._line_metrics?.[subRaw] || data._line_metrics?.[subNorm] || data._line_metrics?.[sub]
          || data.byLine?.[subRaw] || data.byLine?.[subNorm] || data.byLine?.[sub]
          || data.byLine?.[`LINE ${subRaw}`]
          || data.byLine?.[subRaw.replace(/^LINE\s+/i, '')];
        if (subTarget) {
          totalReg += Number(subTarget.op_leader_register ?? subTarget.register ?? 0);
          totalOt += Number(subTarget.ot_psn ?? subTarget.otPsn ?? 0);
        } else {
          totalReg += getDynamicAttendanceValue(sub, data, 'fpc_total_register', 'total_register');
          totalOt += getDynamicAttendanceValue(sub, data, 'fpc_ot_psn', 'ot_psn');
        }
      });
      return totalReg > 0 ? (totalOt / totalReg) * 100 : 0;
    }

    let customSum = 0;
    subLines.forEach(sub => {
      const subRaw = sub.trim().toUpperCase();
      const subNorm = normalizeMatrixLineGroupName(sub).trim().toUpperCase();
      const subTarget = data._line_metrics?.[subRaw] || data._line_metrics?.[subNorm] || data._line_metrics?.[sub]
        || data.byLine?.[subRaw] || data.byLine?.[subNorm] || data.byLine?.[sub]
        || data.byLine?.[`LINE ${subRaw}`]
        || data.byLine?.[subRaw.replace(/^LINE\s+/i, '')];
      if (subTarget) {
        if (fpcKey === 'fpc_total_register' || key === 'total_register') customSum += Number(subTarget.op_leader_register ?? subTarget.register ?? 0);
        else if (fpcKey === 'fpc_total_actual' || key === 'total_actual') customSum += Number(subTarget.actual ?? (subTarget.op_leader_register ? subTarget.op_leader_register - (subTarget.leave_psn || subTarget.leave || 0) : 0));
        else if (fpcKey === 'fpc_total_man_hour' || key === 'total_man_hour') customSum += Number(subTarget.total_man_hour ?? subTarget.manHours ?? 0);
        else if (fpcKey === 'fpc_ot_psn' || key === 'ot_psn') customSum += Number(subTarget.ot_psn ?? subTarget.otPsn ?? 0);
        else if (fpcKey === 'fpc_leave' || key === 'leave') customSum += Number(subTarget.leave_psn ?? subTarget.leave ?? 0);
      } else {
        customSum += getDynamicAttendanceValue(sub, data, fpcKey, key);
      }
    });
    return customSum;
  }

  // 3. Composite Built-in Macros
  if (rawGroup === "MACRO PCN" || normGroup === "MACRO PCN") {
    if (fpcKey === 'fpc_total_register' || key === 'total_register') {
      return Number(data.total_register ?? data.macro_pcn_total_register ?? 0);
    }
    if (fpcKey === 'fpc_total_actual' || key === 'total_actual') {
      return Number(data.total_actual ?? data.macro_pcn_total_actual ?? 0);
    }
    if (fpcKey === 'fpc_total_man_hour' || key === 'total_man_hour') {
      return Number(data.total_man_hour ?? data.macro_pcn_total_man_hour ?? ((data.fpc_total_man_hour || 0) + (data.macro_smt_total_man_hour || data.direct_smt_total_man_hour || 0)));
    }
    if (fpcKey === 'fpc_ot_psn' || key === 'ot_psn') {
      return Number(data.ot_psn ?? data.macro_pcn_ot_psn ?? data.ot1_actual ?? 0);
    }
    if (fpcKey === 'fpc_leave' || key === 'leave' || key === 'leave_psn') {
      return Number(data.leave ?? data.macro_pcn_leave ?? 0);
    }
    if (fpcKey === 'fpc_leave_working_day_rate' || key === 'leave_working_day_rate') {
      const rate = data.leave_working_day_rate ?? data.macro_pcn_leave_working_day_rate;
      if (rate !== undefined && rate !== null) return Number(rate);
      const reg = Number(data.total_register ?? data.macro_pcn_total_register ?? 0);
      const lv = Number(data.leave ?? data.macro_pcn_leave ?? 0);
      return reg > 0 ? (lv / reg) * 100 : 0;
    }
    if (fpcKey === 'fpc_ot_working_day_rate' || key === 'ot_working_day_rate') {
      const rate = data.ot_working_day_rate ?? data.macro_pcn_ot_working_day_rate;
      if (rate !== undefined && rate !== null) return Number(rate);
      const reg = Number(data.total_register ?? data.macro_pcn_total_register ?? 0);
      const ot = Number(data.ot_psn ?? data.macro_pcn_ot_psn ?? data.ot1_actual ?? 0);
      return reg > 0 ? (ot / reg) * 100 : 0;
    }
    if (fpcKey === 'fpc_ot_holiday_day_rate' || key === 'ot_holiday_day_rate') {
      const rate = data.ot_holiday_day_rate ?? data.macro_pcn_ot_holiday_day_rate;
      if (rate !== undefined && rate !== null) return Number(rate);
      return 0;
    }
    if (fpcKey === 'fpc_help_in_normal' || key === 'help_in_normal' || key === 'help_in') {
      return Number(data.macro_pcn_help_in_normal ?? data.help_in_normal ?? 0);
    }
    if (fpcKey === 'fpc_help_out_normal' || key === 'help_out_normal' || key === 'help_out') {
      return Number(data.macro_pcn_help_out_normal ?? data.help_out_normal ?? 0);
    }
    if (fpcKey === 'fpc_help_in_psn' || key === 'help_in_psn') {
      return Number(data.macro_pcn_help_in_psn ?? data.help_in_psn ?? data.macro_pcn_help_in_normal ?? data.help_in_normal ?? 0);
    }
    if (fpcKey === 'fpc_help_out_psn' || key === 'help_out_psn') {
      return Number(data.macro_pcn_help_out_psn ?? data.help_out_psn ?? data.macro_pcn_help_out_normal ?? data.help_out_normal ?? 0);
    }
    if (fpcKey === 'fpc_help_in_ot1' || key === 'help_in_ot1') {
      return Number(data.macro_pcn_help_in_ot1 ?? data.help_in_ot1 ?? 0);
    }
    if (fpcKey === 'fpc_help_out_ot1' || key === 'help_out_ot1') {
      return Number(data.macro_pcn_help_out_ot1 ?? data.help_out_ot1 ?? 0);
    }
    if (fpcKey === 'fpc_help_in_ot2' || key === 'help_in_ot2') {
      return Number(data.macro_pcn_help_in_ot2 ?? data.help_in_ot2 ?? 0);
    }
    if (fpcKey === 'fpc_help_out_ot2' || key === 'help_out_ot2') {
      return Number(data.macro_pcn_help_out_ot2 ?? data.help_out_ot2 ?? 0);
    }
    if (fpcKey === 'fpc_normal_man_hour' || key === 'normal_man_hour') {
      return Number(data.macro_pcn_normal_man_hour ?? data.normal_man_hour ?? 0);
    }
    if (fpcKey === 'fpc_ot_man_hour' || key === 'ot_man_hour') {
      return Number(data.macro_pcn_ot_man_hour ?? data.ot_man_hour ?? 0);
    }
    return getDynamicAttendanceValue('macro_pcn', data, fpcKey, key) || getDynamicAttendanceValue('total', data, fpcKey, key);
  }

  if (rawGroup === "MACRO FPC" || normGroup === "MACRO FPC") {
    return getDynamicAttendanceValue('fpc', data, fpcKey, key);
  }

  if (rawGroup === "DIRECT FPC" || normGroup === "DIRECT FPC") {
    return getDynamicAttendanceValue('fpc_direct', data, fpcKey, key);
  }

  if (rawGroup === "MACRO SMT" || normGroup === "MACRO SMT") {
    const macroVal = getDynamicAttendanceValue('macro_smt', data, fpcKey, key);
    if (macroVal > 0) return macroVal;
    const frontVal = getDynamicAttendanceValue('macro_smt_f', data, fpcKey, key);
    const backVal = getDynamicAttendanceValue('macro_smt_b', data, fpcKey, key);
    if (frontVal > 0 || backVal > 0) return frontVal + backVal;
    return 0;
  }

  if (rawGroup === "DIRECT SMT" || normGroup === "DIRECT SMT") {
    return getDynamicAttendanceValue('direct_smt', data, fpcKey, key);
  }

  if (rawGroup === "MACRO SMT_F" || normGroup === "MACRO SMT_F") {
    return getDynamicAttendanceValue('macro_smt_f', data, fpcKey, key);
  }

  if (
    rawGroup === "SMT FRONT_DIRECT" || normGroup === "SMT FRONT_DIRECT" ||
    rawGroup === "SMT FRONT DIRECT" || normGroup === "SMT FRONT DIRECT" ||
    rawGroup === "SMT Front_Direct" || normGroup === "SMT Front_Direct" ||
    rawGroup === "SMT_FRONT_DIRECT" || normGroup === "SMT_FRONT_DIRECT"
  ) {
    return getDynamicAttendanceValue('smt_front_direct', data, fpcKey, key);
  }

  if (rawGroup === "MACRO SMT_B" || normGroup === "MACRO SMT_B") {
    return getDynamicAttendanceValue('macro_smt_b', data, fpcKey, key);
  }

  if (
    rawGroup === "SMT BACK_DIRECT" || normGroup === "SMT BACK_DIRECT" ||
    rawGroup === "SMT BACK DIRECT" || normGroup === "SMT BACK DIRECT" ||
    rawGroup === "SMT Back_Direct" || normGroup === "SMT Back_Direct" ||
    rawGroup === "SMT_BACK_DIRECT" || normGroup === "SMT_BACK_DIRECT"
  ) {
    return getDynamicAttendanceValue('smt_back_direct', data, fpcKey, key);
  }

  if (rawGroup === "AUTOMOTIVE" || normGroup === "AUTOMOTIVE" || rawGroup === "AUTOMATIVE" || normGroup === "AUTOMATIVE") {
    return getDynamicAttendanceValue('mota', data, fpcKey, key) + getDynamicAttendanceValue('asy1_a', data, fpcKey, key);
  }

  if (rawGroup === "LINE B" || normGroup === "LINE B" || rawGroup === "B") {
    return getDynamicAttendanceValue('line_b_gen', data, fpcKey, key) + getDynamicAttendanceValue('line_b_non', data, fpcKey, key);
  }

  if (rawGroup === "LINE VAC & HPS" || normGroup === "LINE VAC & HPS") {
    return getDynamicAttendanceValue('line_vac', data, fpcKey, key) + getDynamicAttendanceValue('line_hps', data, fpcKey, key);
  }

  if (rawGroup === "QA FPC" || normGroup === "QA FPC") {
    const fAuto = data.byLine?.["OQI_F-AUTO"] || data.byLine?.["QA FPC AUTO"] || data.byLine?.["QA_FPC_AUTO"];
    const fGen = data.byLine?.["OQI_F-GEN"] || data.byLine?.["QA FPC GEN"] || data.byLine?.["QA_FPC_GEN"];
    if (fAuto || fGen) {
      if (fpcKey === 'fpc_total_register' || key === 'total_register') return Number(fAuto?.op_leader_register || 0) + Number(fGen?.op_leader_register || 0);
      if (fpcKey === 'fpc_total_actual' || key === 'total_actual') return Number(fAuto?.actual || 0) + Number(fGen?.actual || 0);
      if (fpcKey === 'fpc_total_man_hour' || key === 'total_man_hour') return Number(fAuto?.total_man_hour || 0) + Number(fGen?.total_man_hour || 0);
      if (fpcKey === 'fpc_ot_psn' || key === 'ot_psn') return Number(fAuto?.ot_psn || 0) + Number(fGen?.ot_psn || 0);
      if (fpcKey === 'fpc_leave' || key === 'leave') return Number(fAuto?.leave_psn || 0) + Number(fGen?.leave_psn || 0);
      if (fpcKey === 'fpc_leave_working_day_rate' || key === 'leave_working_day_rate') {
        const tR = Number(fAuto?.op_leader_register || 0) + Number(fGen?.op_leader_register || 0);
        const tL = Number(fAuto?.leave_psn || 0) + Number(fGen?.leave_psn || 0);
        return tR > 0 ? (tL / tR) * 100 : 0;
      }
      if (fpcKey === 'fpc_ot_working_day_rate' || key === 'ot_working_day_rate') {
        const tR = Number(fAuto?.op_leader_register || 0) + Number(fGen?.op_leader_register || 0);
        const tO = Number(fAuto?.ot_psn || 0) + Number(fGen?.ot_psn || 0);
        return tR > 0 ? (tO / tR) * 100 : 0;
      }
      if (fpcKey === 'fpc_ot_holiday_day_rate' || key === 'ot_holiday_day_rate') {
        const tR = Number(fAuto?.op_leader_register || 0) + Number(fGen?.op_leader_register || 0);
        const tO = Number(fAuto?.ot_psn || 0) + Number(fGen?.ot_psn || 0);
        return tR > 0 ? (tO / tR) * 100 : 0;
      }
    }
    const qfVal = getDynamicAttendanceValue('qa_fpc', data, fpcKey, key);
    if (qfVal > 0) return qfVal;
    return getDynamicAttendanceValue('oqi_f', data, fpcKey, key) + getDynamicAttendanceValue('oqi_f_auto', data, fpcKey, key);
  }

  if (rawGroup === "QA SMT" || normGroup === "QA SMT" || rawGroup === "MQA") {
    const sAuto = data.byLine?.["OQI_S-AUTO"] || data.byLine?.["QA SMT AUTO"];
    const sGen = data.byLine?.["OQI_S-GEN"] || data.byLine?.["QA SMT GEN"];
    if (sAuto || sGen) {
      if (fpcKey === 'fpc_total_register' || key === 'total_register') return Number(sAuto?.op_leader_register || 0) + Number(sGen?.op_leader_register || 0);
      if (fpcKey === 'fpc_total_actual' || key === 'total_actual') return Number(sAuto?.actual || 0) + Number(sGen?.actual || 0);
      if (fpcKey === 'fpc_total_man_hour' || key === 'total_man_hour') return Number(sAuto?.total_man_hour || 0) + Number(sGen?.total_man_hour || 0);
      if (fpcKey === 'fpc_ot_psn' || key === 'ot_psn') return Number(sAuto?.ot_psn || 0) + Number(sGen?.ot_psn || 0);
      if (fpcKey === 'fpc_leave' || key === 'leave') return Number(sAuto?.leave_psn || 0) + Number(sGen?.leave_psn || 0);
      if (fpcKey === 'fpc_leave_working_day_rate' || key === 'leave_working_day_rate') {
        const tR = Number(sAuto?.op_leader_register || 0) + Number(sGen?.op_leader_register || 0);
        const tL = Number(sAuto?.leave_psn || 0) + Number(sGen?.leave_psn || 0);
        return tR > 0 ? (tL / tR) * 100 : 0;
      }
      if (fpcKey === 'fpc_ot_working_day_rate' || key === 'ot_working_day_rate') {
        const tR = Number(sAuto?.op_leader_register || 0) + Number(sGen?.op_leader_register || 0);
        const tO = Number(sAuto?.ot_psn || 0) + Number(sGen?.ot_psn || 0);
        return tR > 0 ? (tO / tR) * 100 : 0;
      }
      if (fpcKey === 'fpc_ot_holiday_day_rate' || key === 'ot_holiday_day_rate') {
        const tR = Number(sAuto?.op_leader_register || 0) + Number(sGen?.op_leader_register || 0);
        const tO = Number(sAuto?.ot_psn || 0) + Number(sGen?.ot_psn || 0);
        return tR > 0 ? (tO / tR) * 100 : 0;
      }
    }
    const qsVal = getDynamicAttendanceValue('qa_smt', data, fpcKey, key);
    if (qsVal > 0) return qsVal;
    return getDynamicAttendanceValue('oqi_s_auto', data, fpcKey, key) + getDynamicAttendanceValue('oqi_s_gen', data, fpcKey, key);
  }

  if (rawGroup === "ASY SMT" || normGroup === "ASY SMT") {
    const asy1A = data.byLine?.["ASY1_A"] || data.byLine?.["LINE ASY1_A"];
    const asy1G = data.byLine?.["ASY1_G"] || data.byLine?.["LINE ASY1_G"];
    const asy2 = data.byLine?.["ASY2"] || data.byLine?.["LINE ASY2"];
    const asy3 = data.byLine?.["ASY3"] || data.byLine?.["LINE ASY3"];
    const aixAsy = data.byLine?.["AIX-ASY"] || data.byLine?.["AIX_ASY"] || data.byLine?.["LINE AIX-ASY"] || data.byLine?.["ASY4"];
    if (asy1A || asy1G || asy2 || asy3 || aixAsy) {
      if (fpcKey === 'fpc_total_register' || key === 'total_register') {
        return Number(asy1A?.op_leader_register || 0) + Number(asy1G?.op_leader_register || 0) + Number(asy2?.op_leader_register || 0) + Number(asy3?.op_leader_register || 0) + Number(aixAsy?.op_leader_register || 0);
      }
      if (fpcKey === 'fpc_total_actual' || key === 'total_actual') {
        return Number(asy1A?.actual || 0) + Number(asy1G?.actual || 0) + Number(asy2?.actual || 0) + Number(asy3?.actual || 0) + Number(aixAsy?.actual || 0);
      }
      if (fpcKey === 'fpc_total_man_hour' || key === 'total_man_hour') {
        return Number(asy1A?.total_man_hour || 0) + Number(asy1G?.total_man_hour || 0) + Number(asy2?.total_man_hour || 0) + Number(asy3?.total_man_hour || 0) + Number(aixAsy?.total_man_hour || 0);
      }
      if (fpcKey === 'fpc_ot_psn' || key === 'ot_psn') {
        return Number(asy1A?.ot_psn || 0) + Number(asy1G?.ot_psn || 0) + Number(asy2?.ot_psn || 0) + Number(asy3?.ot_psn || 0) + Number(aixAsy?.ot_psn || 0);
      }
      if (fpcKey === 'fpc_leave' || key === 'leave') {
        return Number(asy1A?.leave_psn || 0) + Number(asy1G?.leave_psn || 0) + Number(asy2?.leave_psn || 0) + Number(asy3?.leave_psn || 0) + Number(aixAsy?.leave_psn || 0);
      }
      if (fpcKey === 'fpc_leave_working_day_rate' || key === 'leave_working_day_rate') {
        const tR = Number(asy1A?.op_leader_register || 0) + Number(asy1G?.op_leader_register || 0) + Number(asy2?.op_leader_register || 0) + Number(asy3?.op_leader_register || 0) + Number(aixAsy?.op_leader_register || 0);
        const tL = Number(asy1A?.leave_psn || 0) + Number(asy1G?.leave_psn || 0) + Number(asy2?.leave_psn || 0) + Number(asy3?.leave_psn || 0) + Number(aixAsy?.leave_psn || 0);
        return tR > 0 ? (tL / tR) * 100 : 0;
      }
      if (fpcKey === 'fpc_ot_working_day_rate' || key === 'ot_working_day_rate' || fpcKey === 'fpc_ot_holiday_day_rate' || key === 'ot_holiday_day_rate') {
        const tR = Number(asy1A?.op_leader_register || 0) + Number(asy1G?.op_leader_register || 0) + Number(asy2?.op_leader_register || 0) + Number(asy3?.op_leader_register || 0) + Number(aixAsy?.op_leader_register || 0);
        const tO = Number(asy1A?.ot_psn || 0) + Number(asy1G?.ot_psn || 0) + Number(asy2?.ot_psn || 0) + Number(asy3?.ot_psn || 0) + Number(aixAsy?.ot_psn || 0);
        return tR > 0 ? (tO / tR) * 100 : 0;
      }
    }

    // Check if asy_smt group already aggregated in data
    const asyVal = getDynamicAttendanceValue('asy_smt', data, fpcKey, key);
    if (asyVal > 0) return asyVal;

    const aixVal = getDynamicAttendanceValue('aix_asy', data, fpcKey, key) || getDynamicAttendanceValue('asy4', data, fpcKey, key);
    if (fpcKey === 'fpc_leave_working_day_rate' || key === 'leave_working_day_rate') {
      const tR = getDynamicAttendanceValue('asy1_a', data, 'fpc_total_register', 'total_register') +
        getDynamicAttendanceValue('asy1_g', data, 'fpc_total_register', 'total_register') +
        getDynamicAttendanceValue('asy2', data, 'fpc_total_register', 'total_register') +
        getDynamicAttendanceValue('asy3', data, 'fpc_total_register', 'total_register') +
        aixVal;
      const tL = getDynamicAttendanceValue('asy1_a', data, 'fpc_leave', 'leave') +
        getDynamicAttendanceValue('asy1_g', data, 'fpc_leave', 'leave') +
        getDynamicAttendanceValue('asy2', data, 'fpc_leave', 'leave') +
        getDynamicAttendanceValue('asy3', data, 'fpc_leave', 'leave') +
        (getDynamicAttendanceValue('aix_asy', data, 'fpc_leave', 'leave') || getDynamicAttendanceValue('asy4', data, 'fpc_leave', 'leave'));
      return tR > 0 ? (tL / tR) * 100 : 0;
    }
    if (fpcKey === 'fpc_ot_working_day_rate' || key === 'ot_working_day_rate' || fpcKey === 'fpc_ot_holiday_day_rate' || key === 'ot_holiday_day_rate') {
      const tR = getDynamicAttendanceValue('asy1_a', data, 'fpc_total_register', 'total_register') +
        getDynamicAttendanceValue('asy1_g', data, 'fpc_total_register', 'total_register') +
        getDynamicAttendanceValue('asy2', data, 'fpc_total_register', 'total_register') +
        getDynamicAttendanceValue('asy3', data, 'fpc_total_register', 'total_register') +
        aixVal;
      const tO = getDynamicAttendanceValue('asy1_a', data, 'fpc_ot_psn', 'ot_psn') +
        getDynamicAttendanceValue('asy1_g', data, 'fpc_ot_psn', 'ot_psn') +
        getDynamicAttendanceValue('asy2', data, 'fpc_ot_psn', 'ot_psn') +
        getDynamicAttendanceValue('asy3', data, 'fpc_ot_psn', 'ot_psn') +
        (getDynamicAttendanceValue('aix_asy', data, 'fpc_ot_psn', 'ot_psn') || getDynamicAttendanceValue('asy4', data, 'fpc_ot_psn', 'ot_psn'));
      return tR > 0 ? (tO / tR) * 100 : 0;
    }

    return (
      getDynamicAttendanceValue('asy1_a', data, fpcKey, key) +
      getDynamicAttendanceValue('asy1_g', data, fpcKey, key) +
      getDynamicAttendanceValue('asy2', data, fpcKey, key) +
      getDynamicAttendanceValue('asy3', data, fpcKey, key) +
      aixVal
    );
  }

  // 4. Everything else (Individual lines, cost centers, sub-lines)
  return getDynamicAttendanceValue(rawGroup, data, fpcKey, key);
};
