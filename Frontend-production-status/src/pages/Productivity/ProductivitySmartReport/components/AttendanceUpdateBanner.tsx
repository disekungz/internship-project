import React from "react";
import { RefreshCcw, BellRing, X, CalendarCheck2, Clock, CheckCircle2 } from "lucide-react";
import dayjs from "dayjs";

interface AttendanceUpdateBannerProps {
  hasNewUpdate: boolean;
  changedDates: string[];
  totalDaysChanged: number;
  latestAttendanceUpdate: string | null;
  isSyncing: boolean;
  onSync: () => void;
  onDismiss: () => void;
}

export const AttendanceUpdateBanner: React.FC<AttendanceUpdateBannerProps> = ({
  hasNewUpdate,
  changedDates,
  totalDaysChanged,
  latestAttendanceUpdate,
  isSyncing,
  onSync,
  onDismiss,
}) => {
  if (!hasNewUpdate || totalDaysChanged === 0) {
    return null;
  }

  // Format date summary (e.g. "01/08/2026 - 15/08/2026" or "01/08, 02/08, 03/08...")
  const formattedDatesSummary = React.useMemo(() => {
    if (!changedDates || changedDates.length === 0) return "";
    const sorted = [...changedDates].sort();
    if (sorted.length === 1) {
      return dayjs(sorted[0]).format("DD/MM/YYYY");
    }
    const first = dayjs(sorted[0]).format("DD/MM/YYYY");
    const last = dayjs(sorted[sorted.length - 1]).format("DD/MM/YYYY");
    return `${first} ถึง ${last}`;
  }, [changedDates]);

  const formattedLatestUpdate = React.useMemo(() => {
    if (!latestAttendanceUpdate) return null;
    return dayjs(latestAttendanceUpdate).format("DD/MM/YYYY HH:mm:ss");
  }, [latestAttendanceUpdate]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-200/90 bg-gradient-to-r from-blue-50/95 via-indigo-50/90 to-sky-50/95 p-4 shadow-sm transition-all animate-fadeIn">
      {/* Accent left line */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-600 to-indigo-600" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pl-2">
        {/* Left: Info */}
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <BellRing size={20} className="animate-pulse" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-bold text-slate-800 tracking-tight">
                ตรวจพบข้อมูล Attendance มีการอัปเดตใหม่
              </h4>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 border border-blue-200">
                <CalendarCheck2 size={12} />
                {totalDaysChanged} วันที่พบการแก้ไข
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              มีข้อมูลการขาดลามาสายถูกปรับปรุงใหม่ในช่วงวันที่:{" "}
              <span className="font-semibold text-blue-900 bg-white/80 px-1.5 py-0.5 rounded border border-blue-100">
                {formattedDatesSummary}
              </span>
              {formattedLatestUpdate && (
                <span className="inline-flex items-center gap-1 ml-2 text-slate-500">
                  <Clock size={12} />
                  บันทึกล่าสุด: {formattedLatestUpdate}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="btn btn-sm bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm hover:shadow border-none rounded-xl gap-2 px-4 transition-all duration-200 active:scale-95"
          >
            <RefreshCcw size={14} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "กำลังซิงค์ข้อมูล..." : "อัปเดตข้อมูลเดี๋ยวนี้"}
          </button>

          <button
            onClick={onDismiss}
            title="ปิดการแจ้งเตือน"
            className="btn btn-sm btn-ghost btn-circle text-slate-400 hover:text-slate-700 hover:bg-black/5"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
