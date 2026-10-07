import React from "react";
import { AlertTriangle, Clock, TrendingUp, Users, ArrowUpRight } from "lucide-react";

interface TopHighlightsProps {
  rows: any[];
  totalP1?: Record<string, any>;
}

export const TopCriticalHighlights: React.FC<TopHighlightsProps> = ({ rows, totalP1 }) => {
  if (!rows || rows.length === 0) return null;

  // คำนวณสรุปรวมของโรงงานวันนี้ (Total P1)
  const totP1 = totalP1?.P1 || { mp: 0, work: 0, leave: 0, ot: 0, leaveRatio: 0, otRatio: 0 };
  const totalMp = totP1.mp || 0;
  const totalWork = totP1.work || 0;
  const totalLeave = totP1.leave || 0;
  const totalOt = totP1.ot || 0;
  const totalLeaveRatio = totalMp > 0 ? (Number(totP1.leaveRatio) || ((totalLeave / totalMp) * 100)).toFixed(1) : "0.0";
  const totalOtRatio = totalWork > 0 ? (Number(totP1.otRatio) || ((totalOt / totalWork) * 100)).toFixed(1) : "0.0";
  const workAttendancePct = totalMp > 0 ? ((totalWork / totalMp) * 100).toFixed(1) : "0.0";

  // ดึงข้อมูล P1 ของแต่ละแถว และคำนวณเรียงลำดับ
  const validRows = rows
    .map((r) => {
      const p1 = r.blocks?.P1 || { mp: 0, work: 0, leave: 0, ot: 0, leaveRatio: 0, otRatio: 0 };
      return {
        dept: r.dept,
        group: r.group,
        coc: r.coc,
        mp: p1.mp,
        work: p1.work,
        leave: p1.leave,
        ot: p1.ot,
        leaveRatio: Number(p1.leaveRatio) || 0,
        otRatio: Number(p1.otRatio) || 0,
      };
    })
    .filter((r) => r.mp > 0); // คัดเฉพาะไลน์ที่มีพนักงาน

  // 1. Top 3 Leave Ratio สูงสุด
  const topLeave = [...validRows]
    .sort((a, b) => b.leaveRatio - a.leaveRatio || b.leave - a.leave)
    .slice(0, 3);

  // 2. Top 3 OT Ratio สูงสุด
  const topOT = [...validRows]
    .sort((a, b) => b.otRatio - a.otRatio || b.ot - a.ot)
    .slice(0, 3);

  // 3. Top 3 แผนกที่มีพนักงานมากที่สุด (Workforce Size)
  const topSize = [...validRows]
    .sort((a, b) => b.mp - a.mp)
    .slice(0, 3);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* ── CARD 1: LEAVE % OVERVIEW ── */}
      <div className="group relative overflow-hidden rounded-3xl border border-rose-500/20 bg-base-100 p-5 shadow-sm hover:shadow-md transition-all duration-300">
        {/* Subtle accent background glow */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-rose-500/10 blur-2xl transition-all group-hover:scale-110" />
        
        {/* Header */}
        <div className="relative flex items-center justify-between border-b border-rose-500/10 pb-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-md shadow-rose-500/20">
              <AlertTriangle size={18} />
            </span>
            <div>
              <h3 className="text-sm font-black tracking-tight text-base-content">Leave % รวมของวันนี้</h3>
              <p className="text-[11px] font-semibold text-rose-500">Total P1 Leave Ratio</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[10px] font-black text-rose-500">
            Target ≤ 5.0%
          </span>
        </div>

        {/* Main Metric Area */}
        <div className="relative mt-4 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black tracking-tight text-rose-500">
              {totalLeaveRatio}%
            </span>
            <span className="text-xs font-bold text-base-content/50">
              (ขาด {totalLeave} / {totalMp} คน)
            </span>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold text-base-content/50 block">ขาดสะสมวันนี้</span>
            <span className="text-lg font-black text-base-content">{totalLeave} <span className="text-xs text-base-content/60 font-semibold">คน</span></span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="relative mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-base-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-500 to-red-600 transition-all duration-500"
              style={{ width: `${Math.min(Number(totalLeaveRatio), 100)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-base-content/60">
            <span>ขาดงานทั้งหมด {totalLeave} คน</span>
            <span className="text-base-content/50">จากกำลังพล {totalMp} คน</span>
          </div>
        </div>
      </div>

      {/* ── CARD 2: OT % OVERVIEW ── */}
      <div className="group relative overflow-hidden rounded-3xl border border-blue-500/20 bg-base-100 p-5 shadow-sm hover:shadow-md transition-all duration-300">
        {/* Subtle accent background glow */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-blue-500/10 blur-2xl transition-all group-hover:scale-110" />

        {/* Header */}
        <div className="relative flex items-center justify-between border-b border-blue-500/10 pb-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Clock size={18} />
            </span>
            <div>
              <h3 className="text-sm font-black tracking-tight text-base-content">OT % รวมของวันนี้</h3>
              <p className="text-[11px] font-semibold text-blue-500">Total P1 Overtime Ratio</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-black text-blue-500">
            Workload
          </span>
        </div>

        {/* Main Metric Area */}
        <div className="relative mt-4 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black tracking-tight text-blue-500">
              {totalOtRatio}%
            </span>
            <span className="text-xs font-bold text-base-content/50">
              (ทำ {totalOt} / {totalWork} คน)
            </span>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold text-base-content/50 block">ทำ OT สะสมวันนี้</span>
            <span className="text-lg font-black text-base-content">{totalOt} <span className="text-xs text-base-content/60 font-semibold">คน</span></span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="relative mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-base-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
              style={{ width: `${Math.min(Number(totalOtRatio), 100)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-base-content/60">
            <span>ทำ OT ทั้งหมด {totalOt} คน</span>
            <span className="text-base-content/50">จากคนมาทำงาน {totalWork} คน</span>
          </div>
        </div>
      </div>

      {/* ── CARD 3: TOTAL WORKFORCE OVERVIEW ── */}
      <div className="group relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-base-100 p-5 shadow-sm hover:shadow-md transition-all duration-300">
        {/* Subtle accent background glow */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-500/10 blur-2xl transition-all group-hover:scale-110" />

        {/* Header */}
        <div className="relative flex items-center justify-between border-b border-emerald-500/10 pb-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
              <Users size={18} />
            </span>
            <div>
              <h3 className="text-sm font-black tracking-tight text-base-content">คนมาทำงาน &amp; กำลังพลรวม</h3>
              <p className="text-[11px] font-semibold text-emerald-500">Total Workforce Attendance</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-500">
            {workAttendancePct}% เข้างาน
          </span>
        </div>

        {/* Main Metric Area */}
        <div className="relative mt-4 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black tracking-tight text-emerald-500">
              {totalWork}
            </span>
            <span className="text-xs font-bold text-base-content/50">
              / {totalMp} คนทั้งหมด
            </span>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold text-base-content/50 block">กำลังพลทั้งหมด</span>
            <span className="text-lg font-black text-base-content">{totalMp} <span className="text-xs text-base-content/60 font-semibold">คน</span></span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="relative mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-base-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500"
              style={{ width: `${Math.min(Number(workAttendancePct), 100)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-base-content/60">
            <span>มาทำงานจริง {totalWork} คน</span>
            <span className="text-base-content/50">คิดเป็น {workAttendancePct}% ของโรงงาน</span>
          </div>
        </div>
      </div>
    </div>
  );
};
