import React, { useState, useEffect } from "react";
import {
  CalendarDays,
  Download,
  Flame,
  UserX,
  FileSpreadsheet,
  Layers,
  RefreshCw,
  Sparkles,
  Settings2,
} from "lucide-react";
import FujiLogo from "../../assets/icon/Fuji.png";
import { fetchDailyMatrix } from "./api/dailyMatrix";
import { DailyComboCharts } from "./components/DailyComboCharts";
import { DailyMatrixTable } from "./components/DailyMatrixTable";
import { MatrixMappingModal } from "./components/MatrixMappingModal";
import { ModernSingleDatePicker } from "../../components/ModernSingleDatePicker";
import { TopCriticalHighlights } from "./components/TopCriticalHighlights";
import { exportDailyMatrixExcel } from "./utils/exportDailyMatrixExcel";

export default function ManpowerRatioDaily() {
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  });
  const [activeTab, setActiveTab] = useState<"charts" | "table">("charts");
  const [matrixData, setMatrixData] = useState<{
    date: string;
    blocks: string[];
    rows: any[];
    groupSummaries: Record<string, any>;
    totalP1: Record<string, any>;
  } | null>(() => {
    try {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
      const raw = localStorage.getItem(`daily-matrix-v4:cache:${today}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
      return !localStorage.getItem(`daily-matrix-v4:cache:${today}`);
    } catch {
      return false;
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);

  const loadData = async (date: string) => {
    const hasCache = !!localStorage.getItem(`daily-matrix-v4:cache:${date}`);
    if (!hasCache) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await fetchDailyMatrix(date);
      setMatrixData(data);
      try {
        localStorage.setItem(`daily-matrix-v4:cache:${date}`, JSON.stringify(data));
      } catch {}
    } catch (err: any) {
      console.error("Failed to load daily matrix:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const cached = localStorage.getItem(`daily-matrix-v4:cache:${selectedDate}`);
      if (cached) {
        setMatrixData(JSON.parse(cached));
      }
    } catch {}
    loadData(selectedDate);
  }, [selectedDate]);

  const handleExport = async () => {
    if (!matrixData) return;
    try {
      await exportDailyMatrixExcel({
        date: matrixData.date,
        blocks: matrixData.blocks,
        rows: matrixData.rows,
        groupSummaries: matrixData.groupSummaries,
        totalP1: matrixData.totalP1,
      });
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    }
  };

  return (
    <main
      className={`h-full w-full ${
        isMappingModalOpen ? "overflow-hidden" : "overflow-y-auto"
      } overflow-x-hidden bg-slate-50/50 p-2 sm:p-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
    >
      <div className="w-full space-y-5 pb-12">
        {/* Header Banner */}
        <header className="rounded-2xl bg-gradient-to-r from-[#193886] via-[#1F46A4] to-[#2563EB] px-5 py-4 text-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <img
                src={FujiLogo}
                alt="Fuji Logo"
                className="h-11 w-11 object-contain rounded-xl bg-white p-1.5 shadow-md"
              />
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl sm:text-2xl font-black tracking-wide">
                    MANPOWER RATIO DAILY
                  </h1>
                  {loading && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur-md border border-white/30">
                      <span className="h-2 w-2 rounded-full bg-blue-300 animate-ping" />
                      Loading Data..
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm font-semibold text-blue-100 mt-0.5">
                  Leave & OT Ratio Daily Breakdown by Department & Cost Center (COC)
                </p>
              </div>
            </div>

            {/* Controls Right */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Modern Custom Date Picker */}
              <ModernSingleDatePicker
                value={selectedDate}
                onChange={(newDate) => setSelectedDate(newDate)}
                variant="glass-dark"
                label="DATE FILTER"
              />

              {/* Refresh Button */}
              <button
                onClick={() => loadData(selectedDate)}
                className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-black text-white hover:bg-white/25 border border-white/30 backdrop-blur-md transition cursor-pointer"
                title="โหลดข้อมูลใหม่"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                <span>Refresh</span>
              </button>

              {/* Manage Lines / Mapping Button */}
              <button
                onClick={() => setIsMappingModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-black text-white hover:bg-white/25 border border-white/30 backdrop-blur-md transition cursor-pointer"
                title="จัดการผูกชื่อไลน์และคำค้นหาสำหรับแต่ละแผนก"
              >
                <Settings2 size={14} />
                <span> Manage Mappings</span>
              </button>

              {/* Export Excel Button */}
              <button
                onClick={handleExport}
                disabled={!matrixData || loading}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs sm:text-sm font-black text-white shadow-lg shadow-emerald-700/30 transition hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <FileSpreadsheet size={16} />
                <span>Export Daily Excel</span>
              </button>
            </div>
          </div>
        </header>

        {/* View Switcher: Charts vs Matrix Table */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 rounded-2xl bg-white p-1.5 shadow-sm border border-slate-200/80">
            <button
              onClick={() => setActiveTab("charts")}
              className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs sm:text-sm font-black transition-all duration-200 cursor-pointer ${
                activeTab === "charts"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <Flame size={16} className={activeTab === "charts" ? "text-amber-300" : "text-slate-400"} />
              <span>Leave Ratio Daily & OT Ratio Daily</span>
            </button>
            <button
              onClick={() => setActiveTab("table")}
              className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs sm:text-sm font-black transition-all duration-200 cursor-pointer ${
                activeTab === "table"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <Layers size={16} className={activeTab === "table" ? "text-amber-300" : "text-slate-400"} />
              <span> Daily Manpower Ratio Schedule</span>
            </button>
          </div>

          {matrixData && (
            <div className="text-xs sm:text-sm font-black text-slate-600">
              Date: <span className="text-blue-600 font-bold">{matrixData.date}</span> | Total MP: <span className="text-slate-900 font-black">{matrixData.totalP1?.P1?.mp || 0}</span> คน
            </div>
          )}
        </div>

        {/* Content Body */}
        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 font-bold">
            เกิดข้อผิดพลาดในการโหลดข้อมูล: {error}
          </div>
        ) : loading || !matrixData ? (
          <div className="animate-pulse space-y-6">
            {/* Skeleton กราฟหลักแบบเดียวกับ WIP P1 และ Manpower Ratio */}
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

            {/* Skeleton กราฟย่อยด้านล่าง */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {[1, 2].map((cardIdx) => (
                <div key={cardIdx} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-5 w-28 rounded-md bg-slate-200" />
                    <div className="h-4 w-20 rounded-full bg-slate-100" />
                  </div>
                  <div className="h-[300px] w-full rounded-2xl bg-slate-50 flex items-end justify-between gap-3 p-4">
                    {[50, 70, 40, 85, 60, 75, 90, 65, 55].map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        <div
                          className="w-full max-w-[32px] rounded-t-md bg-gradient-to-t from-blue-300/50 to-blue-200/40"
                          style={{ height: `${h}%` }}
                        />
                        <div className="h-2.5 w-6 rounded-full bg-slate-200" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Pending Shift / Empty Day Banner */}
            {(matrixData?.totalP1?.P1?.mp === 0 || !matrixData?.totalP1?.P1?.mp) && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-3.5 text-amber-900 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-200/80 text-base">
                    ⏳
                  </span>
                  <div>
                    <h4 className="text-sm font-black text-amber-950">
                      ข้อมูลประจำวันที่ {matrixData.date} กำลังอยู่ระหว่างการปฏิบัติงานของกะปัจจุบัน (ยังไม่ถึงเวลาส่งรายงานสรุปสิ้นวัน)
                    </h4>
                    <p className="text-xs font-semibold text-amber-800">
                      ระบบมีข้อมูลรายงานฉบับสมบูรณ์ที่พร้อมแสดงผลตั้งแต่วันที่ 01 ถึง 22 กันยายน 2026
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDate("2026-09-22")}
                  className="rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 text-xs font-black text-white shadow-md hover:from-amber-700 hover:to-orange-700 transition cursor-pointer"
                >
                  👉 ดูข้อมูลล่าสุด (22 ก.ย. 2026)
                </button>
              </div>
            )}

            {/* Top Critical Highlights Cards */}
            <TopCriticalHighlights rows={matrixData.rows} totalP1={matrixData.totalP1} />

            {activeTab === "charts" ? (
              <DailyComboCharts
                date={matrixData.date}
                rows={matrixData.rows}
                groupSummaries={matrixData.groupSummaries}
                totalP1={matrixData.totalP1}
              />
            ) : (
              <DailyMatrixTable
                blocks={matrixData.blocks}
                rows={matrixData.rows}
                groupSummaries={matrixData.groupSummaries}
                totalP1={matrixData.totalP1}
              />
            )}
          </>
        )}
      </div>

      {/* Matrix Mapping Manager Modal */}
      <MatrixMappingModal
        isOpen={isMappingModalOpen}
        onClose={() => setIsMappingModalOpen(false)}
        onSaved={() => loadData(selectedDate)}
      />
    </main>
  );
}
