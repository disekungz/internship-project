export interface DailyStatusItem {
  day: number;
  date: string;
  dayOfWeek: number;
  isWorkingDay: boolean;
  isHoliday: boolean;
  direct: number;
  indirect: number;
  contract: number;
  subcontract: number;
  mou: number;
  total: number;
  rawTotal: number;
  present: number;
  absent: number;
  target: number;
}

export interface P1StatusSummary {
  today: string;
  target: number;
  lastActiveDate: string;
  lastActiveDay: number;
  todayTotal: number;
  variance: number;
  todayDirect: number;
  todayIndirect: number;
  todayContract: number;
  todaySubcontract: number;
  todayMou: number;
  totalWorkingDays: number;
  passedWorkingDays: number;
}

export interface P1StatusResponse {
  ok: boolean;
  month: string;
  target: number;
  today: string;
  days: DailyStatusItem[];
  lastActive?: DailyStatusItem | null;
  summary?: P1StatusSummary;
}

