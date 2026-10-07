/**
 * หน้าจอ: Manpower Ratio (สัดส่วนกำลังคนแยกตามแผนก)
 * - แสดงกราฟสัดส่วน OT Ratio และ Leave (ขาด/ลา) Ratio แยกตาม 5 แผนกหลัก
 * - สลับมุมมองได้ทั้งแบบ รายวัน (Day), รายสัปดาห์ (Week), รายเดือน (Month), และรายปี (Year)
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Flame,
  UserX,
  RefreshCw,
  AlertCircle,
  BarChart2,
  Layers,
  Sparkles,
  FileSpreadsheet,
} from "lucide-react";
import FujiLogo from "../../assets/icon/Fuji.png";
import DepartmentRatioCharts from "./components/DepartmentRatioCharts";
import { useDepartmentRatio } from "./hooks/useDepartmentRatio";
import { fetchDeptSummary } from "./api/deptSummary";
import { aggregateByWeek, aggregateByYear } from "./utils/ratioAggregation";
import { ManualManpowerRatioModal } from "./components/ManualManpowerRatioModal";
import { ModernMonthPicker } from "../../components/ModernMonthPicker";

type ViewMode = "day" | "week" | "month";

/**
 * ลดขนาดข้อมูลของแต่ละเดือนก่อนบันทึกลงใน localStorage สำหรับโหมดแสดงผลรายปี/สัปดาห์
 * เก็บเฉพาะฟิลด์ที่จำเป็นในการคำนวณและพล็อตกราฟ (ลดจาก ~1.8MB เหลือ ~3KB ต่อเดือน)
 */
function compactMonthForYear(m: any) {
  if (!m) return null;
  const direct = (m.chartData?.direct || m.direct || []).map((r: any) => ({
    date: r.date,
    isHoliday: r.isHoliday,
    sumOtPct: r.sumOtPct,
    sumLeavePct: r.sumLeavePct,
    depts: r.depts,
    indirect: r.indirect,
    total: r.total,
    people: r.people,
    supportGroups: r.supportGroups,
  }));
  const includeIndirect = (m.chartData?.includeIndirect || m.includeIndirect || []).map((r: any) => ({
    date: r.date,
    isHoliday: r.isHoliday,
    sumOtPct: r.sumOtPct,
    supportOtPct: r.supportOtPct,
    sumLeavePct: r.sumLeavePct,
    overviewLeavePct: r.overviewLeavePct,
    overviewOtPct: r.overviewOtPct,
    depts: r.depts,
    indirect: r.indirect,
    total: r.total,
    people: r.people,
    supportGroups: r.supportGroups,
  }));
  return {
    month: m.month,
    targets: m.targets,
    spreadsheetData: m.spreadsheetData || null,
    chartData: { direct, includeIndirect },
    direct,
    includeIndirect,
  };
}


export default function ManpowerRatio() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() =>
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
    }).format(new Date()),
  );
  const [mode, setMode] = useState<"ot" | "leave">("ot");
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [dayYearMode, setDayYearMode] = useState(false);

  const selectedYear = Number(month.slice(0, 4));

  const { data, loading, error, refresh } = useDepartmentRatio(month);

  const [yearData, setYearData] = useState<Record<string, any>>(() => {
    try {
      const year = Number(month.slice(0, 4)) || new Date().getFullYear();
      const raw = localStorage.getItem(`manpower-ratio:year-v24:${year}`);
      return raw ? (JSON.parse(raw).data ?? {}) : {};
    } catch {
      return {};
    }
  });
  const [yearLoading, setYearLoading] = useState(false);

  const needYearData =
    viewMode === "week" ||
    viewMode === "month" ||
    (viewMode === "day" && dayYearMode);

  useEffect(() => {
    if (!needYearData) return;
    const year = selectedYear;
    const cacheKey = `manpower-ratio:year-v24:${year}`;
    const controller = new AbortController();
    const signal = controller.signal;

    // ── 1. โหลดแคช → แสดงผลทันที ไม่ต้องรอ ─────────────────────────
    let cached: Record<string, any> = {};
    try {
      const raw = localStorage.getItem(cacheKey);
      cached = raw ? (JSON.parse(raw).data ?? {}) : {};
    } catch {
      /* ละเว้นข้อผิดพลาด */
    }
    setYearData(cached);

    const saveYearCache = (dataToSave: Record<string, any>) => {
      try {
        const compactObj: Record<string, any> = {};
        Object.entries(dataToSave).forEach(([k, v]) => {
          compactObj[k] = compactMonthForYear(v);
        });
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ savedAt: Date.now(), data: compactObj }),
        );
      } catch {
        // หากแคชเต็ม ให้เคลียร์คีย์เก่าออกแล้วลองเซฟใหม่
        try {
          const keys = Object.keys(localStorage).filter(k => k.startsWith('manpower-ratio:year-') && k !== cacheKey);
          keys.forEach(k => localStorage.removeItem(k));
          const compactObj: Record<string, any> = {};
          Object.entries(dataToSave).forEach(([k, v]) => {
            compactObj[k] = compactMonthForYear(v);
          });
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ savedAt: Date.now(), data: compactObj }),
          );
        } catch {
          /* ละเว้นข้อผิดพลาด */
        }
      }
    };

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthStr = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // ── 2. หาเดือนที่ยังไม่มีแคชเลย (โหลดเฉพาะเดือนที่ขาด) ───────────────
    const toFetch: string[] = [];
    for (let i = 1; i <= 12; i++) {
      const m = `${year}-${String(i).padStart(2, "0")}`;
      if (!cached[m]) toFetch.push(m);
    }

    // ── 3. fetch batch สำหรับเดือนที่ขาด ────────────────────────────────
    const runBatches = async (missingMonths: string[]) => {
      const batchSize = 3;
      const accumulated = { ...cached };
      for (let i = 0; i < missingMonths.length; i += batchSize) {
        if (signal.aborted) return accumulated;
        const batch = missingMonths.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((m) =>
            fetchDeptSummary(m, signal)
              .then((d) => [m, d] as [string, any])
              .catch(() => [m, null] as [string, any]),
          ),
        );
        if (signal.aborted) return accumulated;
        for (const [m, d] of results) {
          if (d) accumulated[m] = d;
        }
        setYearData({ ...accumulated });
        saveYearCache(accumulated);
      }
      return accumulated;
    };

    // ── 4. silent recheck เดือนปัจจุบันเบาๆ: เช็คเฉพาะถ้ามีข้อมูลใหม่ ──
    const silentRecheckCurrentMonth = async (existing: Record<string, any>) => {
      if (signal.aborted) return;
      if (year !== currentYear) return;
      if (toFetch.includes(currentMonthStr)) return;

      try {
        const fresh = await fetchDeptSummary(currentMonthStr, signal);
        if (signal.aborted || !fresh) return;

        const cachedDirect: any[] =
          existing[currentMonthStr]?.chartData?.direct ||
          existing[currentMonthStr]?.direct ||
          [];
        const freshDirect: any[] =
          fresh?.chartData?.direct || fresh?.direct || [];

        const cachedHash = JSON.stringify(cachedDirect);
        const freshHash = JSON.stringify(freshDirect);

        if (cachedHash === freshHash) {
          return;
        }

        const updated = { ...existing, [currentMonthStr]: fresh };
        setYearData(updated);
        saveYearCache(updated);
      } catch {
        /* ละเว้นข้อผิดพลาด */
      }
    };

    const run = async () => {
      if (toFetch.length > 0) {
        setYearLoading(Object.keys(cached).length === 0);
        const result = await runBatches(toFetch);
        setYearLoading(false);
        await silentRecheckCurrentMonth(result || cached);
      } else {
        setYearLoading(false);
        await silentRecheckCurrentMonth(cached);
      }
    };

    run();
    return () => controller.abort();
  }, [needYearData, selectedYear]);

  const displayData = useMemo(() => {
    let result: any = null;

    if (viewMode === "day" && !dayYearMode) {
      result = data ?? null;
    } else if (viewMode === "day" && dayYearMode) {
      if (Object.keys(yearData).length === 0) {
        result = null;
      } else {
        const directMap = new Map<string, any>();
        const indirectMap = new Map<string, any>();
        Object.values(yearData).forEach((m) => {
          (m.chartData?.direct || m.direct || []).forEach((row: any) => {
            if (row?.date) directMap.set(String(row.date), { ...row });
          });
          (m.chartData?.includeIndirect || m.includeIndirect || []).forEach((row: any) => {
            if (row?.date) indirectMap.set(String(row.date), { ...row });
          });
        });
        const allDirect = Array.from(directMap.values()).sort((a, b) =>
          String(a.date).localeCompare(String(b.date)),
        );
        const allIndirect = Array.from(indirectMap.values()).sort((a, b) =>
          String(a.date).localeCompare(String(b.date)),
        );

        // 🌟 คำนวณเส้นสะสม Acc. ต่อเนื่องทั้งปี (Year-to-date) สำหรับ Direct
        let directRunningOt = 0;
        let directRunningLeave = 0;
        let directDaysCount = 0;
        allDirect.forEach((row) => {
          const otVal = Number(row.sumOtPct ?? row.otDirectPct ?? 0);
          const leaveVal = Number(row.sumLeavePct ?? row.sumDirectPct ?? 0);
          const hasData = (Number(row.total?.people) || 0) > 0 || (Number(row.people) || 0) > 0 || otVal > 0.05 || leaveVal > 0.05;
          if (hasData && (otVal > 0 || leaveVal > 0)) {
            directRunningOt += otVal;
            directRunningLeave += leaveVal;
            directDaysCount++;
            row.otAcc = Number((directRunningOt / directDaysCount).toFixed(1));
            row.leaveAcc = Number((directRunningLeave / directDaysCount).toFixed(1));
          } else {
            row.otAcc = null;
            row.leaveAcc = null;
          }
        });

        // 🌟 คำนวณเส้นสะสม Acc. ต่อเนื่องทั้งปี (Year-to-date) สำหรับ Include Indirect
        let indRunningOt = 0;
        let indRunningLeave = 0;
        let indDaysCount = 0;
        allIndirect.forEach((row) => {
          const otVal = Number(row.sumOtPct ?? row.otP1Pct ?? 0);
          const leaveVal = Number(row.sumLeavePct ?? row.sumP1Pct ?? 0);
          const hasData = (Number(row.total?.people) || 0) > 0 || (Number(row.people) || 0) > 0 || otVal > 0.05 || leaveVal > 0.05;
          if (hasData && (otVal > 0 || leaveVal > 0)) {
            indRunningOt += otVal;
            indRunningLeave += leaveVal;
            indDaysCount++;
            row.otAcc = Number((indRunningOt / indDaysCount).toFixed(1));
            row.leaveAcc = Number((indRunningLeave / indDaysCount).toFixed(1));
          } else {
            row.otAcc = null;
            row.leaveAcc = null;
          }
        });

        result = {
          chartData: { direct: allDirect, includeIndirect: allIndirect },
        };
      }
    } else if (viewMode === "week") {
      if (Object.keys(yearData).length === 0) {
        result = null;
      } else {
        const allDirect: any[] = [];
        const allIndirect: any[] = [];
        Object.values(yearData).forEach((m) => {
          allDirect.push(...(m.chartData?.direct || m.direct || []));
          allIndirect.push(
            ...(m.chartData?.includeIndirect || m.includeIndirect || []),
          );
        });
        result = aggregateByWeek({
          chartData: { direct: allDirect, includeIndirect: allIndirect },
        });
      }
    } else if (viewMode === "month") {
      result =
        Object.keys(yearData).length > 0
          ? aggregateByYear(yearData, selectedYear)
          : null;
    }

    if (result && !result.targets) {
      let foundTargets: any = undefined;
      if (data && data.targets) {
        foundTargets = data.targets;
      } else {
        const foundMonth = Object.values(yearData).find((m: any) => m && m.targets);
        if (foundMonth && (foundMonth as any).targets) {
          foundTargets = (foundMonth as any).targets;
        }
      }
      if (foundTargets) {
        result.targets = JSON.parse(JSON.stringify(foundTargets));
      }
    }

    return result;
  }, [data, viewMode, dayYearMode, yearData, selectedYear, month]);

  const isLoading =
    viewMode === "day" && !dayYearMode
      ? loading && !data
      : yearLoading && Object.keys(yearData).length === 0;

  const isYearPicker =
    viewMode === "week" ||
    viewMode === "month" ||
    (viewMode === "day" && dayYearMode);

  return (
    <main className="h-full w-full overflow-y-auto overflow-x-hidden bg-slate-100 p-3 md:p-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="w-full pb-8">
        <header className="mb-6 rounded-2xl bg-gradient-to-r from-[#193886] via-[#1F46A4] to-[#2563EB] p-4 text-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src={FujiLogo}
                alt="Fuji Logo"
                width="40"
                height="40"
                className="h-10 w-10 object-contain rounded-md bg-white p-1"
              />
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-black tracking-wide md:text-2xl">
                    MANPOWER RATIO
                  </h1>
                  {isLoading && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-400/20 px-3 py-1 text-xs font-semibold text-blue-100 backdrop-blur-sm border border-blue-300/30">
                      <span className="h-2 w-2 rounded-full bg-blue-300 animate-ping" />
                      Loading Data...
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-blue-100 md:text-sm">
                  Leave Ratio and OT Ratio by Department
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Mode Selection */}
              <div className="flex items-center rounded-lg bg-white/20 p-0.5">
                {(["day", "week", "month"] as ViewMode[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setViewMode(v)}
                    className={`rounded-md px-3 py-1.5 text-xs font-black transition ${viewMode === v
                      ? "bg-white text-[#193886] shadow"
                      : "text-white hover:bg-white/20"
                      }`}
                  >
                    {v === "day" ? "Day" : v === "week" ? "Week" : "Month"}
                  </button>
                ))}
              </div>

              {viewMode === "day" && (
                <div className="flex items-center rounded-lg bg-white/20 p-0.5">
                  <button
                    type="button"
                    onClick={() => setDayYearMode(false)}
                    className={`rounded-md px-3 py-1.5 text-xs font-black transition ${!dayYearMode
                      ? "bg-white text-[#193886] shadow"
                      : "text-white hover:bg-white/20"
                      }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setDayYearMode(true)}
                    className={`rounded-md px-3 py-1.5 text-xs font-black transition ${dayYearMode
                      ? "bg-white text-[#193886] shadow"
                      : "text-white hover:bg-white/20"
                      }`}
                  >
                    Yearly
                  </button>
                </div>
              )}

              {/* Month / Year Picker */}
              <ModernMonthPicker
                value={month}
                onChange={(m) => setMonth(m)}
                variant="glass-dark"
                label={isYearPicker ? "YEAR" : "MONTH"}
                mode={isYearPicker ? "year" : "month"}
              />

              {/* Refresh Button */}
              <button
                type="button"
                onClick={() => refresh()}
                className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-black text-white hover:bg-white/25 border border-white/30 backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                title="โหลดข้อมูลใหม่"
              >
                <RefreshCw size={14} className={loading || yearLoading ? "animate-spin" : ""} />
                <span>Refresh</span>
              </button>

              <ManualManpowerRatioModal />
            </div>
          </div>
        </header>

        <div className="mb-5 flex items-center gap-2 rounded-2xl bg-white p-1.5 shadow-sm border border-slate-200/80 w-fit">
          <button
            onClick={() => setMode("ot")}
            className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs sm:text-sm font-black transition-all duration-200 cursor-pointer ${
              mode === "ot"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            }`}
          >
            <Flame className={`h-4 w-4 ${mode === "ot" ? "text-amber-300" : "text-slate-400"}`} />
            <span>OT Ratio</span>
          </button>
          <button
            onClick={() => setMode("leave")}
            className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs sm:text-sm font-black transition-all duration-200 cursor-pointer ${
              mode === "leave"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            }`}
          >
            <UserX className={`h-4 w-4 ${mode === "leave" ? "text-amber-300" : "text-slate-400"}`} />
            <span>Leave Ratio</span>
          </button>
        </div>

        {displayData ? (
          <DepartmentRatioCharts
            data={displayData}
            month={month}
            mode={mode}
            viewMode={viewMode}
            dayYearMode={dayYearMode}
            selectedYear={selectedYear}
            yearData={yearData}
            widthMode={viewMode === "day" && !dayYearMode ? "fit" : "expand"}
          />
        ) : isLoading ? (
          <div className="animate-pulse space-y-6">
            {/* Skeleton กราฟหลักแบบเดียวกับ WIP P1 */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-36 rounded-md bg-slate-200" />
                  <div className="h-5 w-24 rounded-full bg-blue-100" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-16 rounded bg-slate-200" />
                  <div className="h-4 w-16 rounded bg-slate-200" />
                  <div className="h-4 w-16 rounded bg-slate-200" />
                </div>
              </div>

              {/* กราฟจำลอง ขนาดใหญ่ขึ้น แท่งชัดเจน */}
              <div className="relative h-[560px] w-full rounded-2xl bg-gradient-to-b from-slate-50/60 to-slate-100/40 p-6 flex flex-col justify-end">
                <div className="absolute inset-x-6 top-8 bottom-12 flex flex-col justify-between pointer-events-none opacity-50">
                  <div className="border-b border-dashed border-slate-300 w-full" />
                  <div className="border-b border-dashed border-slate-300 w-full" />
                  <div className="border-b border-dashed border-slate-300 w-full" />
                  <div className="border-b border-dashed border-slate-300 w-full" />
                </div>

                {/* แท่ง Skeleton Bars ขนาดใหญ่และหนาขึ้น */}
                <div className="flex items-end justify-between gap-3 sm:gap-4 md:gap-5 h-full z-10 pt-10">
                  {[45, 68, 82, 58, 92, 76, 62, 88, 96, 72, 54, 70, 90, 74, 62, 82, 86, 94].map((heightPct, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <div
                        className="w-full max-w-[48px] rounded-t-lg bg-gradient-to-t from-blue-400/50 via-blue-300/40 to-blue-200/30 border-t-2 border-blue-400/40"
                        style={{ height: `${heightPct}%` }}
                      />
                      <div className="h-3 w-8 sm:w-10 rounded-full bg-slate-200" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-sm font-bold text-red-600">
            <div>Unable to load department ratios: {error}</div>
            <button
              onClick={() => refresh()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
