export type OutputGranularity = "daily" | "weekly" | "monthly";

export interface GranularityDateInfo {
  key: string;
  label: string;
  shortLabel: string;
  tooltipTitle: string;
  periodType: "day" | "week" | "month";
  startDate?: string;
  endDate?: string;
}

const EN_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function getISOWeekInfo(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const origDate = new Date(y, m - 1, d);
  const dayOfWeek = origDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // Factory week starts on Sunday
  const sunday = new Date(origDate);
  sunday.setDate(origDate.getDate() - dayOfWeek);

  // Factory week ends on Saturday
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  // Wednesday of the week determines the week number of the year
  const wednesday = new Date(sunday);
  wednesday.setDate(sunday.getDate() + 3);
  const firstJan = new Date(wednesday.getFullYear(), 0, 1);
  const diffDays = Math.floor((wednesday.getTime() - firstJan.getTime()) / (24 * 60 * 60 * 1000));
  const weekNo = Math.floor((diffDays + firstJan.getDay()) / 7) + 1;
  const weekYear = wednesday.getFullYear();

  const pad = (n: number) => String(n).padStart(2, '0');
  const yy = String(weekYear).slice(-2);
  const sunYear = sunday.getFullYear();
  const sunMonth = pad(sunday.getMonth() + 1);
  const sunDay = pad(sunday.getDate());

  const satYear = saturday.getFullYear();
  const satMonth = pad(saturday.getMonth() + 1);
  const satDay = pad(saturday.getDate());

  const weekCode = `WK${yy}${pad(weekNo)}`;
  const weekKey = `${weekYear}-WK${pad(weekNo)}`;
  const weekLabel = weekCode;
  const rangeShort = `${sunDay}/${sunMonth} - ${satDay}/${satMonth}`;
  const rangeFull = `${sunDay}/${sunMonth}/${sunYear} - ${satDay}/${satMonth}/${satYear}`;

  return {
    weekNum: weekNo,
    year: weekYear,
    weekCode,
    weekKey,
    weekLabel,
    rangeShort,
    rangeFull,
    startDate: `${sunYear}-${sunMonth}-${sunDay}`,
    endDate: `${satYear}-${satMonth}-${satDay}`
  };
}

export function getGranularityDateInfo(dateStr: string, granularity: OutputGranularity): GranularityDateInfo {
  if (!dateStr) {
    return {
      key: "unknown",
      label: "Unknown",
      shortLabel: "Unknown",
      tooltipTitle: "Unknown",
      periodType: "day"
    };
  }

  if (granularity === "weekly") {
    const week = getISOWeekInfo(dateStr);
    return {
      key: week.weekKey,
      label: week.weekLabel,
      shortLabel: week.weekLabel,
      tooltipTitle: `Week: ${week.weekLabel} (${week.rangeShort})`,
      periodType: "week",
      startDate: week.startDate,
      endDate: week.endDate
    };
  }

  if (granularity === "monthly") {
    const parts = dateStr.split('-');
    const year = parts[0] || "2026";
    const month = parts[1] || "01";
    const mIdx = parseInt(month, 10) - 1;
    const monthName = EN_MONTHS[mIdx] || month;
    const monthKey = `${year}-${month}`;

    return {
      key: monthKey,
      label: `${monthName} ${year}`,
      shortLabel: `${monthName}`,
      tooltipTitle: `Month: ${monthName} ${year}`,
      periodType: "month",
      startDate: `${year}-${month}-01`,
      endDate: `${year}-${month}-31`
    };
  }

  // Default: daily
  const parts = dateStr.split('-');
  const year = parts[0] || "2026";
  const month = parts[1] || "01";
  const day = parts[2] || "01";
  const mIdx = parseInt(month, 10) - 1;
  const monthName = EN_MONTHS[mIdx] || month;

  return {
    key: dateStr,
    label: `${parseInt(day, 10)} ${monthName} ${year}`,
    shortLabel: `${day}/${month}`,
    tooltipTitle: `Date: ${day} ${monthName} ${year}`,
    periodType: "day",
    startDate: dateStr,
    endDate: dateStr
  };
}

export function isDateInPeriod(rawDate: string, periodKey: string, granularity: OutputGranularity): boolean {
  if (!rawDate || !periodKey) return false;
  if (granularity === "daily") {
    return rawDate === periodKey;
  }
  if (granularity === "weekly") {
    const week = getISOWeekInfo(rawDate);
    return week.weekKey === periodKey;
  }
  if (granularity === "monthly") {
    return rawDate.startsWith(periodKey);
  }
  return rawDate === periodKey;
}
