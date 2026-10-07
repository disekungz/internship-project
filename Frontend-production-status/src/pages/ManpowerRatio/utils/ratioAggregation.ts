/**
 * โมดูลคำนวณและรวมยอดสถิติอัตราส่วน Manpower (Ratio Aggregation)
 * - คำนวณค่าเฉลี่ย OT Share และ Leave Share รายสัปดาห์ (Week) และรายปี (Year)
 * - คำนวณแยกตาม 5 แผนกหลัก, แผนก Indirect, และกลุ่ม Support Groups (MPS, MOU, DC, PER, IND)
 */
import { DEPARTMENTS } from '../constants';

// รายชื่อกลุ่มงาน Support Groups
const SUPPORT_GROUPS = ['MPS', 'MOU', 'DC', 'PER', 'IND'] as const;

/**
 * คำนวณค่าเฉลี่ยสัดส่วน OT หรือ ขาด/ลา ของแต่ละแผนกจากรายการข้อมูลแถว
 */
function averageDepts(rows: any[], kind: 'ot' | 'leave') {
  const result: Record<string, { otShare: number; leaveShare: number }> = {};
  for (const dept of DEPARTMENTS) {
    const total = rows.reduce((acc, r) => {
      const val = kind === 'ot'
        ? Number(r.depts?.[dept]?.otShare ?? r.otByDept?.[dept] ?? 0)
        : Number(r.depts?.[dept]?.leaveShare ?? r.leaveByDept?.[dept] ?? 0);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    const avg = rows.length > 0 ? Number((total / rows.length).toFixed(1)) : 0;
    result[dept] = {
      otShare: kind === 'ot' ? avg : 0,
      leaveShare: kind === 'leave' ? avg : 0,
    };
  }
  return result;
}

/**
 * คำนวณค่าเฉลี่ยสัดส่วน OT หรือ ขาด/ลา ของแผนก Indirect
 */
function averageIndirect(rows: any[], kind: 'ot' | 'leave') {
  const total = rows.reduce((acc, r) => {
    const val = kind === 'ot'
      ? Number(r.indirect?.otShare ?? r.indirectOt ?? 0)
      : Number(r.indirect?.leaveShare ?? r.indirectLeave ?? 0);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);
  const avg = rows.length > 0 ? Number((total / rows.length).toFixed(1)) : 0;
  return {
    otShare: kind === 'ot' ? avg : 0,
    leaveShare: kind === 'leave' ? avg : 0,
  };
}

/**
 * คำนวณค่าเฉลี่ยสถิติของกลุ่ม Support Groups
 */
function averageSupportGroups(rows: any[]) {
  const result: Record<string, any> = {};
  for (const group of SUPPORT_GROUPS) {
    const byDept: Record<string, any> = {};
    for (const dept of [...DEPARTMENTS, 'Indirect']) {
      const totalLeave = rows.reduce((acc, r) => {
        const val = Number(r.supportGroups?.[group]?.byDept?.[dept]?.leaveShare ?? r.supportGroups?.[group]?.byDept?.[dept]?.leavePct ?? 0);
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
      const totalOt = rows.reduce((acc, r) => {
        const val = Number(r.supportGroups?.[group]?.byDept?.[dept]?.otShare ?? r.supportGroups?.[group]?.byDept?.[dept]?.otPct ?? 0);
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
      byDept[dept] = {
        leaveShare: rows.length > 0 ? Number((totalLeave / rows.length).toFixed(1)) : 0,
        otShare: rows.length > 0 ? Number((totalOt / rows.length).toFixed(1)) : 0,
      };
    }

    const sumLeave = rows.reduce((acc, r) => {
      const val = Number(r.supportGroups?.[group]?.sumLeavePct ?? r.supportGroups?.[group]?.total?.leavePct ?? 0);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    const sumOt = rows.reduce((acc, r) => {
      const val = Number(r.supportGroups?.[group]?.sumOtPct ?? r.supportGroups?.[group]?.total?.otPct ?? 0);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

    const totalPeople = rows.reduce((acc, r) => {
      const val = Number(r.supportGroups?.[group]?.total?.people ?? 0);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    const avgPeople = rows.length > 0 ? Math.round(totalPeople / rows.length) : 0;

    result[group] = {
      byDept,
      total: { people: avgPeople },
      sumLeavePct: rows.length > 0 ? Number((sumLeave / rows.length).toFixed(1)) : 0,
      sumOtPct: rows.length > 0 ? Number((sumOt / rows.length).toFixed(1)) : 0,
    };
  }
  return result;
}

function buildAggregatedRow(label: string, rows: any[]) {
  const deptsOt = averageDepts(rows, 'ot');
  const deptsLeave = averageDepts(rows, 'leave');

  const depts: Record<string, any> = {};
  for (const dept of DEPARTMENTS) {
    depts[dept] = {
      otShare: deptsOt[dept].otShare,
      leaveShare: deptsLeave[dept].leaveShare,
    };
  }

  const indirectOt = averageIndirect(rows, 'ot');
  const indirectLeave = averageIndirect(rows, 'leave');
  const indirect = {
    otShare: indirectOt.otShare,
    leaveShare: indirectLeave.leaveShare,
  };

  const supportGroups = averageSupportGroups(rows);

  const deptLeaveSum = DEPARTMENTS.reduce((s, d) => s + depts[d].leaveShare, 0);
  const deptOtSum = DEPARTMENTS.reduce((s, d) => s + depts[d].otShare, 0);
  const avgDirectLeave = Number(deptLeaveSum.toFixed(1));
  const avgDirectOt = Number(deptOtSum.toFixed(1));
  const avgSumLeave = Number((deptLeaveSum + (indirect.leaveShare || 0)).toFixed(1));
  const avgSumOt = Number((deptOtSum + (indirect.otShare || 0)).toFixed(1));

  const lastRow = rows[rows.length - 1] || {};
  const firstWithDate = rows.find((r) => r?.date && String(r.date).length >= 7);
  const rowMonth = firstWithDate ? String(firstWithDate.date).slice(0, 7) : undefined;

  return {
    date: label,
    month: rowMonth,
    depts,
    indirect,
    supportGroups,
    sumLeavePct: avgSumLeave,
    sumOtPct: avgSumOt,
    leaveSum: avgSumLeave,
    otSum: avgSumOt,
    sumDirectLeave: avgDirectLeave,
    sumDirectOt: avgDirectOt,
    leaveAcc: Number(lastRow.leaveAcc ?? avgSumLeave),
    otAcc: Number(lastRow.otAcc ?? avgSumOt),
  };
}

/**
 * คำนวนเลขสัปดาห์ตามมาตรฐาน ISO (Monday‑start) ของโรงงาน
 * ตัวอย่าง: วันที่ 2026‑08‑25 อยู่ในสัปดาห์ที่ 35
 */
function getISOWeek(dateStr: string): number {
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1; // ดัชนีเดือน 0-11
  const d = parseInt(parts[2], 10);
  const date = new Date(Date.UTC(y, m, d));
  // วันพฤหัสบดีของสัปดาห์เป็นตัวกำหนดเลขปีตามมาตรฐาน ISO
  const day = (date.getUTCDay() + 6) % 7; // กำหนดวันจันทร์เป็นวันที่ 0
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() - day + 3);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const weekNo = Math.round(((thursday.getTime() - yearStart.getTime()) / 86400000 - 3) / 7) + 1;
  return weekNo;
}

/**
 * รวมข้อมูลเป็นรายสัปดาห์ตามเลขสัปดาห์ของโรงงาน (ISO week)
 * label จะเป็น "W<number>" เช่น W35
 */
export function aggregateByWeek(data: any) {
  if (!data) return data;
  const directRows: any[] = data.chartData?.direct || data.direct || [];
  const includeIndirectRows: any[] = data.chartData?.includeIndirect || data.includeIndirect || [];

  if (directRows.length === 0) return data;

  const groupRows = (rows: any[]) => {
    const buckets: Record<string, any[]> = {};
    for (const r of rows) {
      const dateStr = String(r.date || '');
      const wk = getISOWeek(dateStr);
      const label = `W${wk}`;
      if (!buckets[label]) buckets[label] = [];
      buckets[label].push(r);
    }
    // เก็บตามลำดับสัปดาห์ที่เพิ่มเข้ามา
    const sortedLabels = Object.keys(buckets).sort((a, b) => {
      const na = parseInt(a.slice(1), 10);
      const nb = parseInt(b.slice(1), 10);
      return na - nb;
    });
    return sortedLabels.map((label) => buildAggregatedRow(label, buckets[label]));
  };

  const direct = groupRows(directRows);
  const includeIndirect = groupRows(includeIndirectRows);

  return {
    ...data,
    direct,
    includeIndirect,
    chartData: { direct, includeIndirect },
  };
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * รวมข้อมูลเป็นรายเดือน (12 เดือนของปีที่เลือก)
 */
export function aggregateByYear(monthsData: Record<string, any>, year: number) {
  const directList: any[] = [];
  const includeIndirectList: any[] = [];

  let runningLeaveSum = 0;
  let runningOtSum = 0;
  let monthsWithData = 0;

  for (let m = 1; m <= 12; m++) {
    const monthKey = `${year}-${String(m).padStart(2, '0')}`;
    const label = MONTH_NAMES[m - 1];
    const mData = monthsData[monthKey];

    const dRows = mData?.chartData?.direct || mData?.direct || [];
    const indRows = mData?.chartData?.includeIndirect || mData?.includeIndirect || [];

    if (dRows.length > 0) {
      const directRow = buildAggregatedRow(label, dRows);
      const indRow = buildAggregatedRow(label, indRows.length > 0 ? indRows : dRows);
      directRow.month = monthKey;
      indRow.month = monthKey;

      if (directRow.sumLeavePct > 0 || directRow.sumOtPct > 0) {
        runningLeaveSum += directRow.sumLeavePct;
        runningOtSum += directRow.sumOtPct;
        monthsWithData++;
        directRow.leaveAcc = Number((runningLeaveSum / monthsWithData).toFixed(1));
        directRow.otAcc = Number((runningOtSum / monthsWithData).toFixed(1));
        indRow.leaveAcc = directRow.leaveAcc;
        indRow.otAcc = directRow.otAcc;
      }

      directList.push(directRow);
      includeIndirectList.push(indRow);
    } else {
      const emptyRow = {
        date: label,
        month: monthKey,
        depts: Object.fromEntries(DEPARTMENTS.map((d) => [d, { otShare: 0, leaveShare: 0 }])),
        indirect: { otShare: 0, leaveShare: 0 },
        supportGroups: {},
        sumLeavePct: 0,
        sumOtPct: 0,
        leaveSum: 0,
        otSum: 0,
        leaveAcc: monthsWithData > 0 ? Number((runningLeaveSum / monthsWithData).toFixed(1)) : 0,
        otAcc: monthsWithData > 0 ? Number((runningOtSum / monthsWithData).toFixed(1)) : 0,
      };
      directList.push(emptyRow);
      includeIndirectList.push(emptyRow);
    }
  }

  const sample = Object.values(monthsData)[0] || {};
  return {
    ...sample,
    month: `${year}`,
    direct: directList,
    includeIndirect: includeIndirectList,
    chartData: {
      direct: directList,
      includeIndirect: includeIndirectList,
    },
  };
}
