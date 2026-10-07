import {
  P1_STATUS_API_ENDPOINT,
  P1_TARGET_API_ENDPOINT,
  P1_FALLBACK_SUMMARY_ENDPOINT,
  P1_FALLBACK_CALENDAR_ENDPOINT,
} from "./config";
import { DailyStatusItem, P1StatusResponse } from "../types";
import { MACRO_PCN_DIRECT_LINES } from "../../Manpower/config/lineGroups";

const DIRECT_LINES_SET = new Set(MACRO_PCN_DIRECT_LINES);

export async function saveP1Target(month: string, target: number): Promise<boolean> {
  try {
    const res = await fetch(P1_TARGET_API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, target }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchP1StatusData(month: string, target?: number, refresh: boolean = false): Promise<P1StatusResponse> {
  // 1. เรียก Dedicated Endpoint ประจำหน้าจอ P1 Manpower Status โดยตรง
  try {
    const refreshParam = refresh ? "&refresh=1" : "";
    const targetParam = target ? `&target=${target}` : "";
    const res = await fetch(`${P1_STATUS_API_ENDPOINT}?month=${encodeURIComponent(month)}${targetParam}${refreshParam}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.days) && data.days.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn("[P1Status] Dedicated /mh/p1_status endpoint error, falling back to MANPOWER summary:", err);
  }

  // 2. Fallback: คำนวณจาก MANPOWER DASHBOARD API data (/summary & /calendar)
  const [summaryRes, calendarRes] = await Promise.all([
    fetch(`${P1_FALLBACK_SUMMARY_ENDPOINT}?month=${encodeURIComponent(month)}`, { cache: "no-store" }).catch(() => null),
    fetch(`${P1_FALLBACK_CALENDAR_ENDPOINT}?month=${encodeURIComponent(month)}`, { cache: "no-store" }).catch(() => null),
  ]);

  const summaryData = summaryRes && summaryRes.ok ? await summaryRes.json() : null;
  const calendarData = calendarRes && calendarRes.ok ? await calendarRes.json() : null;

  const statusTooltipData = summaryData?.statusTooltipData || {};
  const calendarList = Array.isArray(calendarData?.data) ? calendarData.data : Array.isArray(calendarData) ? calendarData : [];

  const calMap = new Map<string, string>();
  calendarList.forEach((c: any) => {
    if (c.date) calMap.set(String(c.date).slice(0, 10), String(c.result || "").toLowerCase());
  });

  const [yearNum, monthNum] = month.split("-").map(Number);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

  const days: DailyStatusItem[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, "0")}`;
    const dayDate = new Date(`${dateStr}T00:00:00`);
    const dayOfWeek = dayDate.getDay();
    const calResult = calMap.get(dateStr);
    const isWorkingDay = calResult ? calResult === "working day" : (dayOfWeek !== 0 && dayOfWeek !== 6);
    const isHoliday = calResult === "holiday" || (!calResult && (dayOfWeek === 0 || dayOfWeek === 6));

    const dayLineData = statusTooltipData[String(d)] || {};
    const hasRecords = Object.keys(dayLineData).length > 0;

    let direct = 0;
    let indirect = 0;
    let contract = 0;
    let subcontract = 0;
    let mou = 0;
    let present = 0;
    let absent = 0;

    if (hasRecords) {
      Object.entries(dayLineData).forEach(([lineName, statuses]: [string, any]) => {
        const isDirectLine = DIRECT_LINES_SET.has(lineName) ||
          lineName.startsWith("FPC") ||
          lineName.startsWith("SMT") ||
          lineName.startsWith("MDS") ||
          lineName.startsWith("OQI_") ||
          lineName.includes("HOT PRESS") ||
          lineName.includes("VAC") ||
          lineName.includes("BLK") ||
          lineName.includes("LINE ");

        Object.entries(statuses || {}).forEach(([stName, val]: [string, any]) => {
          const count = Number(val?.count) || (Number(val?.present || 0) + Number(val?.absent || 0));
          present += Number(val?.present) || 0;
          absent += Number(val?.absent) || 0;

          const stUpper = String(stName).toUpperCase();
          if (stUpper === "DC") {
            contract += count;
          } else if (stUpper === "MOU") {
            mou += count;
          } else if (
            stUpper === "VDS" ||
            stUpper === "PIMB" ||
            stUpper === "TRAINING CENTER" ||
            stUpper === "NO STATUS" ||
            stUpper === ""
          ) {
            subcontract += count;
          } else if (stUpper === "PER" || stUpper === "PERMANENT") {
            if (isDirectLine) {
              direct += count;
            } else {
              indirect += count;
            }
          } else {
            if (isDirectLine) direct += count;
            else indirect += count;
          }
        });
      });
    }

    const rawTotal = direct + indirect + contract + subcontract + mou;
    const isDisplayZero = isHoliday || rawTotal === 0;

    days.push({
      day: d,
      date: dateStr,
      dayOfWeek,
      isWorkingDay,
      isHoliday,
      direct: isDisplayZero ? 0 : direct,
      indirect: isDisplayZero ? 0 : indirect,
      contract: isDisplayZero ? 0 : contract,
      subcontract: isDisplayZero ? 0 : subcontract,
      mou: isDisplayZero ? 0 : mou,
      total: isDisplayZero ? 0 : rawTotal,
      rawTotal,
      present,
      absent,
      target,
    });
  }

  const activeDays = days.filter((d) => d.total > 0);
  const lastActive = activeDays.length > 0 ? activeDays[activeDays.length - 1] : null;

  return {
    ok: true,
    month,
    target,
    today: todayStr,
    days,
    lastActive,
  };
}
