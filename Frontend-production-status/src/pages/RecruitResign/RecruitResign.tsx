import React, { useState, useEffect } from "react";
import { Users, RefreshCw } from "lucide-react";
import { DayItem } from "./types";
import { fetchRecruitResign } from "./api/recruitResignApi";
import { RecruitResignDailyTable } from "./components/RecruitResignDailyTable";
import { RecruitResignChart } from "./components/RecruitResignChart";
import { RecruitResignMatrixTable } from "./components/RecruitResignMatrixTable";
import { ModernMonthPicker } from "../../components/ModernMonthPicker";

export default function RecruitResign() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const GROUPS = ["MPS", "MOU", "DC", "PER", "IND"];
  const [activeGroup, setActiveGroup] = useState<string>("MPS");

  const [daysData, setDaysData] = useState<DayItem[]>(() => {
    try {
      const raw = localStorage.getItem(`recruit-resign:cache:${month}:${activeGroup}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [initialBalance, setInitialBalance] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem(`recruit-resign:balance:${month}:${activeGroup}`);
      return raw ? Number(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      return !localStorage.getItem(`recruit-resign:cache:${month}:${activeGroup}`);
    } catch {
      return false;
    }
  });

  // โหลดข้อมูล
  const loadData = async (m = month, g = activeGroup) => {
    const hasCache = !!localStorage.getItem(`recruit-resign:cache:${m}:${g}`);
    if (!hasCache) {
      setLoading(true);
    }
    try {
      const res = await fetchRecruitResign(m, g);
      if (res.ok && res.daysData) {
        setDaysData(res.daysData);
        setInitialBalance(res.initialBalance ?? null);
        try {
          localStorage.setItem(`recruit-resign:cache:${m}:${g}`, JSON.stringify(res.daysData));
          if (res.initialBalance !== undefined && res.initialBalance !== null) {
            localStorage.setItem(`recruit-resign:balance:${m}:${g}`, String(res.initialBalance));
          }
        } catch {}
      }
    } catch (err) {
      console.error("Error loading recruit & resign data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const cached = localStorage.getItem(`recruit-resign:cache:${month}:${activeGroup}`);
      if (cached) {
        setDaysData(JSON.parse(cached));
      }
      const cachedBal = localStorage.getItem(`recruit-resign:balance:${month}:${activeGroup}`);
      if (cachedBal) {
        setInitialBalance(Number(cachedBal));
      }
    } catch {}
    loadData(month, activeGroup);
  }, [month, activeGroup]);

  return (
    <main className="min-h-full w-full overflow-y-auto overflow-x-hidden bg-base-200/50 p-3 sm:p-4 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="w-full space-y-4 pb-0 mb-1">
        {/* ── Top Header Bar ────────────────────────────────────────── */}
        <div className="rounded-3xl bg-gradient-to-r from-[#193886] via-[#1e40af] to-[#2563eb] p-6 text-white shadow-xl shadow-blue-900/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-2xl bg-white/15 backdrop-blur-md">
                <Users size={24} className="text-blue-200" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2 text-white">
                  RECRUIT & RESIGN
                  {loading && (
                    <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-bold animate-pulse text-white">
                      Loading...
                    </span>
                  )}
                </h1>
                <p className="text-xs sm:text-sm text-blue-100 font-medium">
                  Daily Recruit & Resign Tracking with Sub-Group Matrix Breakdown ({activeGroup})
                </p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Modern Custom Month Picker */}
            <ModernMonthPicker
              value={month}
              onChange={(newMonth) => setMonth(newMonth)}
              variant="glass-dark"
              label="MONTH FILTER"
            />

            {/* Refresh Button */}
            <button
              onClick={() => loadData()}
              className="flex items-center gap-1.5 rounded-2xl bg-white/15 px-3.5 py-2 text-xs font-black text-white hover:bg-white/25 border border-white/30 backdrop-blur-md transition cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* ── Tabs Navigation: MPS | MOU | DC | PER | IND ─────────── */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-base-300/70 border border-base-300 w-fit backdrop-blur-sm">
          {GROUPS.map((grp) => (
            <button
              key={grp}
              onClick={() => setActiveGroup(grp)}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                activeGroup === grp
                  ? "bg-primary text-primary-content shadow-md shadow-primary/20 scale-102"
                  : "text-base-content/70 hover:text-base-content hover:bg-base-100/60"
              }`}
            >
              {grp}
            </button>
          ))}
        </div>

        {/* ── 1. Top Section: Daily Recruit & Resign Table ───────────── */}
        <RecruitResignDailyTable
          activeGroup={activeGroup}
          month={month}
          daysData={daysData}
          initialBalance={initialBalance}
          onReload={() => loadData()}
        />

        {/* ── 2. Middle Section: Combo Chart ────────────────────────── */}
        <RecruitResignChart
          activeGroup={activeGroup}
          month={month}
          daysData={daysData}
          loading={loading}
        />

        {/* ── 3. Bottom Section: Sub-Group Breakdown Matrix ─────────── */}
        <RecruitResignMatrixTable
          activeGroup={activeGroup}
          daysData={daysData}
        />
      </div>
    </main>
  );
}
