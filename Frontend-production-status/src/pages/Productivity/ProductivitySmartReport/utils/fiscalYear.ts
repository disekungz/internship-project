import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);

/**
 * Calculates the Fujikura Fiscal Quarter for a given dayjs date.
 * Fiscal Year starts April 1st:
 * - 1Q: April, May, June (FY Year)
 * - 2Q: July, August, September (FY Year)
 * - 3Q: October, November, December (FY Year)
 * - 4Q: January, February, March (FY Year - 1)
 */
export function getFiscalQuarterInfo(d: dayjs.Dayjs) {
  const month = d.month() + 1; // 1-12
  const year = d.year();
  let qtr = 1;
  let fyYear = year;

  if (month >= 4 && month <= 6) {
    qtr = 1;
    fyYear = year;
  } else if (month >= 7 && month <= 9) {
    qtr = 2;
    fyYear = year;
  } else if (month >= 10 && month <= 12) {
    qtr = 3;
    fyYear = year;
  } else {
    // months 1, 2, 3 (Jan, Feb, Mar) belong to Q4 of previous calendar year
    qtr = 4;
    fyYear = year - 1;
  }

  return {
    qtr,
    fyYear,
    key: `${fyYear}-Q${qtr}`,
    label: `Q${qtr} ${fyYear}`,
    shortLabel: `Q${qtr}`
  };
}

/**
 * Returns the standardized production week key (e.g. 2026-08-W31, 2026-09-W36).
 * Dynamically computes week-to-month assignment for ANY year and month:
 * - Automatically detects boundary crossover weeks between months.
 * - If a week starts near the end of a month (day >= 20) and has <= 2 days in the closing month,
 *   while its Thursday (majority of the week) falls in the next month, it dynamically rolls forward
 *   to the next month (e.g. 2026-08-31 Monday belongs to 2026-09-W36).
 * - If a week starts on the 1st of a month with only 1 day (Sunday) while Thursday was in the previous month,
 *   it dynamically rolls back to the previous month.
 * - Completely dynamic calculation with no hardcoded maps, supporting 2026, 2027, 2028, and forever.
 */
export function getProductionWeekKey(dateInput: dayjs.Dayjs | string | Date): string {
  if (typeof dateInput === "string" && dateInput.includes("-W")) {
    const parts = dateInput.split("-W");
    const wNum = parseInt(parts[1], 10);
    const yPart = parts[0].slice(0, 4);
    const yNum = parseInt(yPart, 10);
    if (isNaN(wNum) || isNaN(yNum)) return dateInput;

    const dWeek = dayjs(`${yPart}-01-04`).isoWeek(wNum);
    const thu = dWeek.isoWeekday(4);
    const thuMonth = thu.month() + 1;

    // If already has YYYY-MM prefix (e.g. "2026-08-W36"):
    if (parts[0].length >= 7) {
      const origMonth = parseInt(parts[0].slice(5, 7), 10);
      let countInOrig = 0;
      for (let i = 1; i <= 7; i++) {
        if (dWeek.isoWeekday(i).month() + 1 === origMonth) countInOrig++;
      }
      // Boundary roll-forward if tail days <= 2 at month end and Thursday is next month:
      if (thuMonth !== origMonth && countInOrig <= 2 && thuMonth === (origMonth % 12) + 1) {
        return `${yPart}-${String(thuMonth).padStart(2, "0")}-W${String(wNum).padStart(2, "0")}`;
      }
      return dateInput;
    }

    // Default for week string without month (e.g. "2026-W36"):
    return `${yPart}-${String(thuMonth).padStart(2, "0")}-W${String(wNum).padStart(2, "0")}`;
  }

  const d = dayjs(dateInput);
  if (!d.isValid()) return String(dateInput || "");

  const weekNum = d.isoWeek();
  const year = d.isoWeekYear ? d.isoWeekYear() : d.year();
  let m = d.month() + 1;
  const dayOfMonth = d.date();

  // Count how many days of this week fall into d's calendar month
  let daysInCurrentMonth = 0;
  for (let i = 1; i <= 7; i++) {
    if (d.isoWeekday(i).month() + 1 === m) {
      daysInCurrentMonth++;
    }
  }

  const thu = d.isoWeekday(4);
  const thuMonth = thu.month() + 1;

  // 1. Month-end boundary roll-forward:
  // If at month end (dayOfMonth >= 20), Thursday is in next month,
  // and current month only has 1 or 2 days of this week (e.g. Monday Aug 31 has 1 day in Aug, Thu in Sep):
  if (dayOfMonth >= 20 && thuMonth !== m && daysInCurrentMonth <= 2) {
    m = thuMonth;
  }
  // 2. Month-start boundary roll-backward:
  // If at month start (dayOfMonth <= 7), Thursday is in previous month,
  // and current month only has 1 day (e.g. solitary Sunday on 1st):
  else if (dayOfMonth <= 7 && thuMonth !== m && daysInCurrentMonth <= 1) {
    m = thuMonth;
  }

  const monthStr = String(m).padStart(2, "0");
  const weekStr = String(weekNum).padStart(2, "0");

  return `${year}-${monthStr}-W${weekStr}`;
}

export function getFiscalQuarter(d: dayjs.Dayjs): string {
  return getFiscalQuarterInfo(d).key;
}
