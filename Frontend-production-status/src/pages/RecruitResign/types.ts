export interface DayCategory {
  mp: number;
  attend: number;
  ot: number;
  otPct: number;
  accOtPct?: number;
}

export interface DayItem {
  day: number;
  date: string;
  dayOfWeek?: number;
  isWorkingDay?: boolean;
  isHoliday?: boolean;
  hasData?: boolean;
  recruit: number | null;
  accRecruit: number | null;
  resign: number | null;
  resignRatio: number | null;
  isUserEdited?: boolean;
  categories: {
    ind1: DayCategory;
    ind2: DayCategory;
    totInd: DayCategory;
    dir1: DayCategory;
    dir2: DayCategory;
    totDir: DayCategory;
  };
}

export interface RecruitResignResponse {
  ok: boolean;
  month: string;
  group: string;
  initialBalance?: number | null;
  daysData: DayItem[];
  error?: string;
}

export interface SaveRecruitResignPayload {
  month: string;
  group: string;
  initialBalance?: number;
  entries: {
    day: number;
    recruit: number;
    resign: number;
    accRecruit?: number;
  }[];
}
