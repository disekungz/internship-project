import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Bell,
  CheckCircle2,
  Clock,
  RefreshCcw,
  CheckCheck,
  UserCheck,
  ChevronRight,
} from "lucide-react";
import Swal from "sweetalert2";
import { getApiBaseUrl } from "../../../../utils/apiConfig";

export interface SyncHistoryItem {
  file_name: string;
  record_count: number;
  sheet_count: number;
  imported_by: string;
  imported_at: string;
  status: string;
  details?: string;
}

export interface NotificationBellProps {
  hasAttendanceUpdate?: boolean;
  changedDates?: string[];
  totalDaysChanged?: number;
  latestAttendanceUpdate?: string | null;
  onSyncAttendance?: () => Promise<any> | void;
  isSyncingAttendance?: boolean;
  onHardReload?: () => void;
}

const STORAGE_KEY = "pdt_notifications_last_read";

export const NotificationBell: React.FC<NotificationBellProps> = ({
  hasAttendanceUpdate = false,
  changedDates = [],
  totalDaysChanged = 0,
  latestAttendanceUpdate = null,
  onSyncAttendance,
  isSyncingAttendance = false,
  onHardReload,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [lastReadTime, setLastReadTime] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch Excel import history (SMT, FPC, MAT)
  const fetchSyncHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/productivity/excel-import-history`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSyncHistory(data.slice(0, 15));
        }
      }
    } catch (err) {
      console.warn("[NotificationBell] Error fetching sync history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Poll sync history on mount & every 60s
  useEffect(() => {
    fetchSyncHistory();
    const timer = setInterval(fetchSyncHistory, 60000);
    return () => clearInterval(timer);
  }, [fetchSyncHistory]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Determine unread sync items
  const unreadSyncs = useMemo(() => {
    if (!lastReadTime) return syncHistory.slice(0, 5);
    const lastReadTs = new Date(lastReadTime).getTime();
    return syncHistory.filter((item) => {
      const itemTs = new Date(item.imported_at).getTime();
      return !isNaN(itemTs) && itemTs > lastReadTs;
    });
  }, [syncHistory, lastReadTime]);

  // Determine unread attendance update
  const isAttendanceUnread = useMemo(() => {
    if (!hasAttendanceUpdate) return false;
    if (!lastReadTime) return true;
    if (!latestAttendanceUpdate) return true;
    const lastReadTs = new Date(lastReadTime).getTime();
    const updateTs = new Date(latestAttendanceUpdate).getTime();
    return isNaN(updateTs) || updateTs > lastReadTs;
  }, [hasAttendanceUpdate, latestAttendanceUpdate, lastReadTime]);

  const unreadCount = unreadSyncs.length + (isAttendanceUnread ? 1 : 0);
  const hasUnread = unreadCount > 0;

  // Mark all notifications as read
  const handleMarkAllAsRead = useCallback(() => {
    const nowIso = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, nowIso);
    } catch (e) {
      console.warn("Could not save to localStorage", e);
    }
    setLastReadTime(nowIso);
  }, []);

  // Clear all notification history & database log table
  const handleClearHistory = useCallback(async () => {
    const result = await Swal.fire({
      title: "ล้างประวัติการแจ้งเตือน?",
      text: "ระบบจะล้างรายการแจ้งเตือนและข้อมูล Log ในฐานข้อมูลทั้งหมด",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "ใช่, Clear ข้อมูล",
      cancelButtonText: "ยกเลิก",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    setIsClearingHistory(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/productivity/excel-import-history`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const postRes = await fetch(`${getApiBaseUrl()}/productivity/excel-import-history/clear`, {
          method: "POST",
        });
        if (!postRes.ok) {
          throw new Error(`Server returned ${postRes.status}: ${postRes.statusText}`);
        }
      }

      setSyncHistory([]);
      handleMarkAllAsRead();
      if (onHardReload) {
        onHardReload();
      }

      Swal.fire({
        title: "Clear เรียบร้อย",
        text: "ล้างรายการแจ้งเตือนและตาราง Log สำเร็จแล้ว",
        icon: "success",
        confirmButtonColor: "#4f46e5",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (err: any) {
      console.error("Error clearing sync history:", err);
      Swal.fire({
        title: "เกิดข้อผิดพลาด",
        text: "ไม่สามารถ Clear ข้อมูลได้: " + (err.message || "Unknown error"),
        icon: "error",
        confirmButtonColor: "#4f46e5",
      });
    } finally {
      setIsClearingHistory(false);
    }
  }, [handleMarkAllAsRead, onHardReload]);

  // When opening the dropdown, auto mark as read
  const handleToggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next && hasUnread) {
        handleMarkAllAsRead();
      }
      return next;
    });
  };

  // Helper to categorize sync file
  const getSyncCategory = (fileName: string, details?: string) => {
    const fn = (fileName || "").toLowerCase();
    const dt = (details || "").toLowerCase();
    if (fn.includes("target") || fn.includes("manual matrix") || dt.includes("target")) {
      return { label: "Target", color: "bg-blue-100 text-blue-800 border-blue-200" };
    }
    if (fn.includes("scan mat") || fn.includes("line mat") || dt.includes("line mat") || /\bmat\b/.test(fn)) {
      return { label: "LINE MAT", color: "bg-amber-100 text-amber-800 border-amber-200" };
    }
    if (fn.includes("fpc") || dt.includes("efpc") || fn.includes("plp")) {
      return { label: "E-FPC", color: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    }
    if (fn.includes("smt") || dt.includes("smt")) {
      return { label: "SMT", color: "bg-indigo-100 text-indigo-800 border-indigo-200" };
    }
    return { label: "Excel", color: "bg-slate-100 text-slate-800 border-slate-200" };
  };

  // Helper to translate raw technical file names into friendly, intuitive Thai descriptions
  const formatFriendlySyncTitle = (fileName: string, details?: string): string => {
    const fn = (fileName || "").trim();
    const dt = (details || "").trim();
    const lowerFn = fn.toLowerCase();

    // 1. Manual Matrix Targets
    if (lowerFn.includes("manual matrix target") || lowerFn.includes("target") || dt.toLowerCase().includes("target")) {
      const monthMatch = fn.match(/(\d{2})[/-](\d{4})/);
      if (monthMatch) {
        return `เป้าหมายการผลิต (Target) ประจำเดือน ${monthMatch[1]}/${monthMatch[2]}`;
      }
      return "เป้าหมายการผลิต (Productivity Target)";
    }

    // 2. LINE MAT Scan Output
    if (lowerFn.includes("scan mat") || lowerFn.includes("line mat") || dt.toLowerCase().includes("line mat") || /\bmat\b/.test(lowerFn)) {
      const dateMatch = fn.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
      if (dateMatch) {
        const d = dateMatch[1].padStart(2, "0");
        const m = dateMatch[2].padStart(2, "0");
        const y = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
        return `ยอดสแกนผลผลิต LINE MAT (อัปเดต ${d}/${m}/${y})`;
      }
      return "ยอดสแกนผลผลิต LINE MAT (สแกนชิ้นงาน)";
    }

    // 3. E-FPC Plan / Monitoring Output
    if (lowerFn.includes("fpc") || lowerFn.includes("plp") || dt.toLowerCase().includes("efpc")) {
      const monthMatch = fn.match(/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[_\s]*(\d{4})?/i);
      if (monthMatch) {
        const monthNames: Record<string, string> = {
          JAN: "มกราคม", FEB: "กุมภาพันธ์", MAR: "มีนาคม", APR: "เมษายน",
          MAY: "พฤษภาคม", JUN: "มิถุนายน", JUL: "กรกฎาคม", AUG: "สิงหาคม",
          SEP: "กันยายน", OCT: "ตุลาคม", NOV: "พฤศจิกายน", DEC: "ธันวาคม"
        };
        const mThai = monthNames[monthMatch[1].toUpperCase()] || monthMatch[1];
        const year = monthMatch[2] || (fn.match(/(\d{4})/) ? fn.match(/(\d{4})/)![1] : "");
        return `แผนงาน & ผลผลิต E-FPC (${mThai}${year ? ` ${year}` : ""})`;
      }
      return "แผนงาน & ผลผลิต E-FPC (Plan & Output)";
    }

    // 4. SMT Daily Output
    if (lowerFn.includes("smt") || dt.toLowerCase().includes("smt")) {
      const monthMatch = fn.match(/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/i);
      const yearMatch = fn.match(/(\d{4})/);
      if (monthMatch) {
        const monthNames: Record<string, string> = {
          JAN: "มกราคม", FEB: "กุมภาพันธ์", MAR: "มีนาคม", APR: "เมษายน",
          MAY: "พฤษภาคม", JUN: "มิถุนายน", JUL: "กรกฎาคม", AUG: "สิงหาคม",
          SEP: "กันยายน", OCT: "ตุลาคม", NOV: "พฤศจิกายน", DEC: "ธันวาคม"
        };
        const mThai = monthNames[monthMatch[1].toUpperCase()] || monthMatch[1];
        const year = yearMatch ? ` ${yearMatch[1]}` : "";
        return `ผลผลิตประจำวัน SMT Daily Output (${mThai}${year})`;
      }
      return "ผลผลิตประจำวัน SMT Daily Output";
    }

    // Fallback: Clean up extension and underscores
    const cleanName = fn.replace(/\.(xlsx|xlsm|xls|csv)$/i, "").replace(/_+/g, " ").trim();
    return cleanName || "ข้อมูลผลผลิตและแผนงาน";
  };

  // Format timestamp
  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const hours = d.getHours().toString().padStart(2, "0");
      const mins = d.getMinutes().toString().padStart(2, "0");
      const day = d.getDate().toString().padStart(2, "0");
      const month = (d.getMonth() + 1).toString().padStart(2, "0");
      return `${day}/${month} ${hours}:${mins} น.`;
    } catch {
      return isoString;
    }
  };

  // Compose ticker headline message
  const tickerMessage = useMemo(() => {
    const messages: string[] = [];
    if (isAttendanceUnread) {
      messages.push(`ข้อมูลรูดบัตร (Attendance) มีการอัปเดต ${totalDaysChanged || changedDates.length} วัน`);
    }
    unreadSyncs.forEach((item) => {
      const friendlyTitle = formatFriendlySyncTitle(item.file_name, item.details);
      messages.push(`${friendlyTitle} (${item.record_count.toLocaleString()} รายการ)`);
    });
    if (messages.length === 0) {
      if (syncHistory.length > 0) {
        const top = syncHistory[0];
        const friendlyTitle = formatFriendlySyncTitle(top.file_name, top.details);
        return `${friendlyTitle}: ${top.record_count.toLocaleString()} รายการ`;
      }
      return "ข้อมูลทั้งหมดเป็นปัจจุบันแล้ว";
    }
    return messages.join("  •  ");
  }, [isAttendanceUnread, totalDaysChanged, changedDates, unreadSyncs, syncHistory]);

  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      {/* Keyframe styles for ticker animation */}
      <style>{`
        @keyframes tickerScroll {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker-marquee {
          display: inline-flex;
          white-space: nowrap;
          animation: tickerScroll 20s linear infinite;
        }
        .animate-ticker-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* 1. Animated Live Ticker Capsule (Stretches out when unread updates exist) */}
      <div
        className={`transition-all duration-500 ease-out overflow-hidden flex items-center ${
          hasUnread
            ? "max-w-[280px] sm:max-w-[360px] md:max-w-[420px] opacity-100 mr-2"
            : "max-w-0 opacity-0 pointer-events-none"
        }`}
      >
        <button
          type="button"
          onClick={handleToggleOpen}
          className="group flex items-center gap-2 px-3 py-1.5 rounded-xl border border-indigo-200/90 bg-gradient-to-r from-indigo-50/95 via-blue-50/90 to-purple-50/90 hover:from-indigo-100 hover:to-purple-100 text-indigo-950 shadow-2xs transition-all cursor-pointer overflow-hidden max-w-full"
          title="คลิกเพื่อดูรายละเอียดการแจ้งเตือน"
        >
          {/* Pulsing red dot */}
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
          </span>

          <span className="font-bold text-[11px] uppercase tracking-wider text-indigo-700 shrink-0">
            Update:
          </span>

          {/* Marquee ticker text */}
          <div className="overflow-hidden whitespace-nowrap text-xs font-semibold text-slate-800 mask-radial-fade">
            <div className="animate-ticker-marquee gap-8">
              <span>{tickerMessage}</span>
              <span className="text-slate-400">•</span>
              <span>{tickerMessage}</span>
            </div>
          </div>

          <ChevronRight className="w-3.5 h-3.5 text-indigo-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* 2. Notification Bell Button */}
      <button
        type="button"
        onClick={handleToggleOpen}
        className={`btn h-9 min-h-9 px-3 rounded-xl border font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer relative ${
          isOpen
            ? "border-slate-800 bg-slate-900 text-white"
            : hasUnread
            ? "border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-100"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900"
        }`}
        title="การแจ้งเตือนและการอัปเดตข้อมูล (Notifications & Live Updates)"
      >
        <Bell className={`w-4 h-4 ${hasUnread ? "text-indigo-600 animate-pulse" : "text-slate-500"}`} />
        
        {/* Unread badge / dot */}
        {hasUnread && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600 text-white font-bold text-[8px] items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* 3. Notification Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[340px] sm:w-[410px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden flex flex-col text-slate-800 animate-in fade-in zoom-in-95 duration-150">
          {/* Popover Header */}
          <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-black text-sm text-slate-900 leading-tight">
                  การแจ้งเตือนและการอัปเดต
                </h4>
                <p className="text-[10px] font-medium text-slate-500">
                  Time Attendance, SMT, FPC, LINE MAT
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={fetchSyncHistory}
                className="btn btn-ghost btn-xs h-7 min-h-7 px-2 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer"
                title="รีเฟรชข้อมูลล่าสุด"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${isLoadingHistory ? "animate-spin text-indigo-600" : ""}`} />
              </button>
              {hasUnread && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="btn btn-ghost btn-xs h-7 min-h-7 px-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg cursor-pointer flex items-center gap-1"
                  title="ทำเครื่องหมายว่าอ่านแล้วทั้งหมด"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>อ่านแล้ว</span>
                </button>
              )}
            </div>
          </div>

          {/* Popover Body */}
          <div className="p-3 space-y-3 max-h-[380px] overflow-y-auto">
            {/* Attendance Status Card */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                hasAttendanceUpdate
                  ? "bg-amber-50/80 border-amber-200 text-amber-950 shadow-2xs"
                  : "bg-slate-50/70 border-slate-200/80 text-slate-700"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      hasAttendanceUpdate ? "bg-amber-200/70 text-amber-800" : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs">ข้อมูลรูดบัตร (Attendance)</span>
                      {hasAttendanceUpdate ? (
                        <span className="badge badge-xs bg-amber-500 text-white font-bold text-[9px] border-none px-1.5">
                          มีข้อมูลใหม่
                        </span>
                      ) : (
                        <span className="badge badge-xs bg-emerald-600 text-white font-bold text-[9px] border-none px-1.5">
                          อัปเดตแล้ว
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {hasAttendanceUpdate
                        ? `พบการเปลี่ยนแปลง ${totalDaysChanged || changedDates.length} วัน: ${changedDates
                            .slice(0, 4)
                            .join(", ")}${changedDates.length > 4 ? "..." : ""}`
                        : "ข้อมูลการรูดบัตรทั้งหมดตรงกับฐานข้อมูลแล้ว"}
                    </p>
                  </div>
                </div>

                {/* 1-Click Sync Attendance Button */}
                {hasAttendanceUpdate && onSyncAttendance && (
                  <button
                    type="button"
                    onClick={async () => {
                      await onSyncAttendance();
                      handleMarkAllAsRead();
                    }}
                    disabled={isSyncingAttendance}
                    className="btn btn-xs h-7 min-h-7 px-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white border-none font-bold text-xs shadow-2xs shrink-0 cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCcw className={`w-3 h-3 ${isSyncingAttendance ? "animate-spin" : ""}`} />
                    <span>{isSyncingAttendance ? "ซิงค์..." : "ซิงค์ทันที"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Excel Sync History Section */}
            <div>
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  ประวัติการซิงค์แผนงาน & ผลผลิต (SMT / FPC / MAT)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {syncHistory.length} รายการล่าสุด
                </span>
              </div>

              {isLoadingHistory && syncHistory.length === 0 ? (
                <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <RefreshCcw className="w-5 h-5 animate-spin text-indigo-500" />
                  <span className="text-xs">กำลังโหลดประวัติการซิงค์...</span>
                </div>
              ) : syncHistory.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  ยังไม่มีประวัติการซิงค์ไฟล์
                </div>
              ) : (
                <div className="space-y-1.5">
                  {syncHistory.map((item, idx) => {
                    const cat = getSyncCategory(item.file_name, item.details);
                    const itemTs = new Date(item.imported_at).getTime();
                    const lastReadTs = lastReadTime ? new Date(lastReadTime).getTime() : 0;
                    const isNew = !isNaN(itemTs) && itemTs > lastReadTs;

                    return (
                      <div
                        key={`${item.file_name}-${item.imported_at}-${idx}`}
                        className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                          isNew
                            ? "bg-indigo-50/50 border-indigo-200 text-indigo-950"
                            : "bg-white border-slate-200/70 hover:bg-slate-50/70 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`badge badge-sm border font-extrabold text-[10px] px-1.5 shrink-0 ${cat.color}`}
                          >
                            {cat.label}
                          </span>

                          <div className="min-w-0">
                            <div
                              className="text-xs font-bold text-slate-900 truncate"
                              title={`ไฟล์ต้นทาง: ${item.file_name}`}
                            >
                              {formatFriendlySyncTitle(item.file_name, item.details)}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{formatTime(item.imported_at)}</span>
                              <span>•</span>
                              <span className="font-semibold text-slate-600">
                                {item.record_count.toLocaleString()} รายการ
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1">
                          {isNew && (
                            <span className="badge badge-xs bg-indigo-600 text-white font-bold text-[9px] px-1">
                              ใหม่
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Popover Footer */}
          <div className="px-3 py-2 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[10px]">ระบบตรวจจับอัตโนมัติทุก 60 วินาที</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClearHistory}
                disabled={isClearingHistory}
                className="text-[11px] font-semibold text-slate-600 hover:text-rose-600 underline cursor-pointer transition-colors"
                title="ล้างประวัติการแจ้งเตือนและข้อมูล Log ในฐานข้อมูลทั้งหมด"
              >
                {isClearingHistory ? "กำลัง Clear..." : "Clear"}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn btn-ghost btn-xs h-6 px-2 text-slate-600 hover:text-slate-900 font-bold rounded cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
