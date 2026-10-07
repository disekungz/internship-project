import React, { useState, useEffect } from "react";
import {
  UsersRound,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Calendar,
  Briefcase,
  Layers,
  CheckCircle2,
  UserCheck,
  Award,
  Settings,
} from "lucide-react";
import FujiLogo from "@/assets/icon/Fuji.png";
import { ModernMonthPicker } from "@/components/ModernMonthPicker";
import { fetchP1StatusData, saveP1Target } from "./api/p1StatusApi";
import { DailyStatusItem, P1StatusResponse } from "./types";
import { P1StatusEChart } from "./components/P1StatusEChart";
import { P1StatusTable } from "./components/P1StatusTable";

export default function P1ManpowerStatus() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // ฟังก์ชันดึงค่า Target แยกตามเดือนที่เลือก
  const getMonthlyTarget = (m: string): number => {
    const savedForMonth = localStorage.getItem(`p1-manpower-status:target:${m}`);
    if (savedForMonth) return Number(savedForMonth) || 1440;
    const globalSaved = localStorage.getItem("p1-manpower-status:target");
    return globalSaved ? Number(globalSaved) || 1440 : 1440;
  };

  const [target, setTarget] = useState<number>(() => getMonthlyTarget(month));
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState(String(target));

  const [statusData, setStatusData] = useState<P1StatusResponse | null>(() => {
    try {
      const raw = localStorage.getItem(`p1-manpower-status:cache:${month}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      return !localStorage.getItem(`p1-manpower-status:cache:${month}`);
    } catch {
      return false;
    }
  });

  // เมื่อเปลี่ยนเดือน ให้เปลี่ยน Target ตามเดือนที่เลือกทันที
  useEffect(() => {
    const t = getMonthlyTarget(month);
    setTarget(t);
    setTempTarget(String(t));
    try {
      const cached = localStorage.getItem(`p1-manpower-status:cache:${month}`);
      if (cached) {
        setStatusData(JSON.parse(cached));
      }
    } catch {}
  }, [month]);

  const loadData = async (m = month, t?: number, refresh = false) => {
    const hasCache = !!localStorage.getItem(`p1-manpower-status:cache:${m}`);
    if (!hasCache || refresh) {
      setLoading(true);
    }
    try {
      // เรียก API โดยให้เซิร์ฟเวอร์เป็นศูนย์กลาง (Single Source of Truth)
      const data = await fetchP1StatusData(m, t, refresh);
      setStatusData(data);
      try {
        localStorage.setItem(`p1-manpower-status:cache:${m}`, JSON.stringify(data));
      } catch {}
      // นำค่า Target จากเซิร์ฟเวอร์มาอัปเดตบนเครื่องนี้ทันที เพื่อให้ทุกเครื่องที่เปิดดูตรงกัน 100%
      if (data?.target) {
        setTarget(data.target);
        setTempTarget(String(data.target));
        localStorage.setItem(`p1-manpower-status:target:${m}`, String(data.target));
      }
    } catch (err) {
      console.error("[P1ManpowerStatus] Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(month, undefined, false);
  }, [month]);

  const handleSaveTarget = async () => {
    const val = Number(tempTarget);
    if (val > 0) {
      setTarget(val);
      // บันทึกแยกเฉพาะเดือนที่เลือก
      localStorage.setItem(`p1-manpower-status:target:${month}`, String(val));
      setIsEditingTarget(false);
      // ส่งไปบันทึกที่ Backend API ประจำเดือนนั้นด้วย
      try {
        await saveP1Target(month, val);
      } catch (err) {
        console.warn("[P1ManpowerStatus] Error saving target to server:", err);
      }
      loadData(month, val, true);
    }
  };

  const days = statusData?.days || [];
  // หาวันทำงานล่าสุดที่มีข้อมูลกำลังคน
  const activeDays = days.filter((d) => d.total > 0);
  const lastActive = activeDays.length > 0 ? activeDays[activeDays.length - 1] : (statusData?.lastActive || null);

  const currentTotal = lastActive?.total || statusData?.summary?.todayTotal || 0;
  const currentDirect = lastActive?.direct ?? statusData?.summary?.todayDirect ?? 0;
  const currentIndirect = lastActive?.indirect ?? statusData?.summary?.todayIndirect ?? 0;
  const currentContract = lastActive?.contract ?? statusData?.summary?.todayContract ?? 0;
  const currentSubcontract = lastActive?.subcontract ?? statusData?.summary?.todaySubcontract ?? 0;
  const currentMou = lastActive?.mou ?? statusData?.summary?.todayMou ?? 0;
  const lastActiveDay = lastActive?.day ?? statusData?.summary?.lastActiveDay ?? "-";
  const lastActiveDate = lastActive?.date ?? statusData?.summary?.lastActiveDate ?? "-";

  const variance = currentTotal > 0 ? currentTotal - target : 0;
  const variancePct = target > 0 && currentTotal > 0 ? ((variance / target) * 100).toFixed(1) : "0";

  return (
    <main className="h-full w-full overflow-y-auto overflow-x-hidden bg-slate-50/50 p-2 sm:p-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="w-full space-y-4 pb-12">
        {/* ── Top Header Banner ────────────────────────────────────────── */}
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
                    P1 MANPOWER STATUS
                  </h1>
                  {loading && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur-md border border-white/30">
                      <span className="h-2 w-2 rounded-full bg-blue-300 animate-ping" />
                      Loading...
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Target Setting Button / Popover */}
              <div className="relative">
                {isEditingTarget ? (
                  <div className="flex items-center gap-1.5 rounded-2xl bg-white/20 p-1 backdrop-blur-md border border-white/30">
                    <input
                      type="number"
                      value={tempTarget}
                      onChange={(e) => setTempTarget(e.target.value)}
                      className="w-20 rounded-xl bg-white px-2.5 py-1 text-xs font-black text-slate-800 outline-none"
                      placeholder="1440"
                    />
                    <button
                      onClick={handleSaveTarget}
                      className="rounded-xl bg-emerald-500 px-2.5 py-1 text-xs font-black text-white hover:bg-emerald-600 transition"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditingTarget(false)}
                      className="rounded-xl bg-white/20 px-2 py-1 text-xs font-bold text-white hover:bg-white/30 transition"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setTempTarget(String(target));
                      setIsEditingTarget(true);
                    }}
                    className="flex items-center gap-1.5 rounded-2xl bg-white/15 px-3.5 py-2 text-xs font-black text-white hover:bg-white/25 border border-white/30 backdrop-blur-md transition cursor-pointer"
                    title={`Change Plant Target for ${month}`}
                  >
                    <Settings size={14} />
                    <span>Target: {target.toLocaleString()}</span>
                  </button>
                )}
              </div>

              {/* Month Picker */}
              <ModernMonthPicker
                value={month}
                onChange={(m) => setMonth(m)}
                variant="glass-dark"
                label="MONTH"
              />

              {/* Refresh Button */}
              <button
                onClick={() => loadData(month, target, true)}
                className="flex items-center gap-1.5 rounded-2xl bg-white/15 px-3.5 py-2 text-xs font-black text-white hover:bg-white/25 border border-white/30 backdrop-blur-md transition cursor-pointer"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </header>

        {/* ── KPI Summary Cards ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-3.5">
          {/* Card 1: Total Manpower */}
          <div className="rounded-2xl bg-white p-3.5 sm:p-4 shadow-sm border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Total</span>
                <UsersRound className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-slate-900">
                  {currentTotal > 0 ? currentTotal.toLocaleString() : "-"}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">/ {target.toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[11px] font-bold">
              {variance >= 0 ? (
                <span className="inline-flex items-center text-emerald-600 truncate">
                  <TrendingUp className="h-3 w-3 mr-0.5 shrink-0" />
                  +{variance} ({variancePct}%)
                </span>
              ) : (
                <span className="inline-flex items-center text-rose-600 truncate">
                  <TrendingDown className="h-3 w-3 mr-0.5 shrink-0" />
                  {variance} ({variancePct}%)
                </span>
              )}
            </div>
          </div>

          {/* Card 2: Direct Workers */}
          <div className="rounded-2xl bg-white p-3.5 sm:p-4 shadow-sm border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Direct</span>
                <Briefcase className="h-4 w-4 text-purple-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-purple-900">
                {currentDirect > 0 ? currentDirect.toLocaleString() : "-"}
              </div>
            </div>
            <p className="mt-2 text-[10px] text-purple-700 font-medium truncate">
              TO/TT 1-7 (100% PRD)
            </p>
          </div>

          {/* Card 3: In-Direct Workers */}
          <div className="rounded-2xl bg-white p-3.5 sm:p-4 shadow-sm border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">In-Direct</span>
                <Layers className="h-4 w-4 text-rose-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-rose-900">
                {currentIndirect > 0 ? currentIndirect.toLocaleString() : "-"}
              </div>
            </div>
            <p className="mt-2 text-[10px] text-rose-700 font-medium truncate">
              Employee all level...
            </p>
          </div>

          {/* Card 4: Employee Contract (DC) */}
          <div className="rounded-2xl bg-white p-3.5 sm:p-4 shadow-sm border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Contract (DC)</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-900">
                {currentContract > 0 ? currentContract.toLocaleString() : "-"}
              </div>
            </div>
            <p className="mt-2 text-[10px] text-emerald-700 font-medium truncate">
              DC Contract Balance
            </p>
          </div>

          {/* Card 5: Subcontract */}
          <div className="rounded-2xl bg-white p-3.5 sm:p-4 shadow-sm border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Subcontract</span>
                <UserCheck className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-900">
                {currentSubcontract > 0 ? currentSubcontract.toLocaleString() : "-"}
              </div>
            </div>
            <p className="mt-2 text-[10px] text-amber-700 font-medium truncate">
              VDS / PIMB Balance
            </p>
          </div>

          {/* Card 6: MOU */}
          <div className="rounded-2xl bg-white p-3.5 sm:p-4 shadow-sm border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-pink-700">MOU</span>
                <Award className="h-4 w-4 text-pink-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-pink-900">
                {currentMou > 0 ? currentMou.toLocaleString() : "-"}
              </div>
            </div>
            <p className="mt-2 text-[10px] text-pink-700 font-medium truncate">
              MOU Student Balance
            </p>
          </div>

          {/* Card 7: Schedule */}
          <div className="rounded-2xl bg-white p-3.5 sm:p-4 shadow-sm border border-slate-200 col-span-2 sm:col-span-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Schedule</span>
                <Calendar className="h-4 w-4 text-teal-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-800">
                {days.filter((d) => d.total > 0).length}{" "}
                <span className="text-xs text-slate-400 font-normal">/ {days.length} Days</span>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-teal-700 font-medium truncate">
              Day {lastActiveDay} ({lastActiveDate})
            </p>
          </div>
        </div>

        {/* ── Chart Section ──────────────────────────────────────────── */}
        <P1StatusEChart days={days} target={target} month={month} />

        {/* ── Table Section ──────────────────────────────────────────── */}
        <P1StatusTable days={days} target={target} month={month} />
      </div>
    </main>
  );
}
