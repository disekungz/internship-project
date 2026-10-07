import React, { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { getApiBaseUrl } from "../../../../utils/apiConfig";

export interface AttendanceStatusResponse {
  hasNewUpdate: boolean;
  month: string;
  startDate: string;
  endDate: string;
  totalDatesWithData: number;
  changedDates: string[];
  totalDaysChanged: number;
  latestAttendanceUpdate: string | null;
  dateDetails?: Array<{
    workDate: string;
    recordCount: number;
    lastAttendanceUpdate: string | null;
    lastSnapshotUpdate: string | null;
    isChanged: boolean;
    reason: string;
  }>;
}

export interface UseAttendanceSyncProps {
  startDate: string;
  endDate: string;
  onSyncSuccess?: () => Promise<void> | void;
}

export const useAttendanceSync = ({ startDate, endDate, onSyncSuccess }: UseAttendanceSyncProps) => {
  const [hasNewUpdate, setHasNewUpdate] = useState(false);
  const [changedDates, setChangedDates] = useState<string[]>([]);
  const [totalDaysChanged, setTotalDaysChanged] = useState(0);
  const [latestAttendanceUpdate, setLatestAttendanceUpdate] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Track latest check parameters
  const lastCheckedKeyRef = useRef<string>("");

  const checkStatus = useCallback(async (customStart?: string, customEnd?: string) => {
    const sDate = customStart || startDate;
    const eDate = customEnd || endDate;
    if (!sDate || !eDate) return;

    setIsChecking(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/productivity/attendance/month-status?startDate=${sDate}&endDate=${eDate}`);
      if (!res.ok) throw new Error("Failed to fetch attendance update status");
      
      const data: AttendanceStatusResponse = await res.json();
      setHasNewUpdate(data.hasNewUpdate);
      setChangedDates(data.changedDates || []);
      setTotalDaysChanged(data.totalDaysChanged || 0);
      setLatestAttendanceUpdate(data.latestAttendanceUpdate);
      
      // If new updates detected, reset dismissal so user is alerted
      if (data.hasNewUpdate) {
        setIsDismissed(false);
      }
    } catch (err) {
      console.warn("[useAttendanceSync] Status check error:", err);
    } finally {
      setIsChecking(false);
    }
  }, [startDate, endDate]);

  // Trigger check when date range changes and poll every 60 seconds
  useEffect(() => {
    const key = `${startDate}_${endDate}`;
    if (key !== lastCheckedKeyRef.current && startDate && endDate) {
      lastCheckedKeyRef.current = key;
      checkStatus();
    }

    const timer = setInterval(() => {
      if (startDate && endDate) {
        checkStatus();
      }
    }, 60000);

    return () => clearInterval(timer);
  }, [startDate, endDate, checkStatus]);

  const syncSelective = useCallback(async (targetDatesOverride?: string[]) => {
    const datesToSync = targetDatesOverride || changedDates;
    setIsSyncing(true);

    try {
      const res = await fetch(`${getApiBaseUrl()}/productivity/attendance/sync-selective`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetDates: datesToSync,
          startDate,
          endDate,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || "Sync failed");
      }

      const result = await res.json();

      // Trigger matrix data reload
      if (onSyncSuccess) {
        await onSyncSuccess();
      }

      // Recheck status to update indicator
      await checkStatus();

      const msg = result.message || `อัปเดตข้อมูล ${result.totalSynced || datesToSync.length} วันเรียบร้อยแล้ว`;
      toast.success(
        React.createElement(
          "div",
          { className: "flex flex-col gap-0.5 text-left" },
          React.createElement(
            "span",
            { className: "font-semibold text-sm text-slate-800 leading-snug" },
            "ซิงค์ข้อมูล Attendance สำเร็จ"
          ),
          React.createElement(
            "span",
            { className: "text-xs text-slate-500 leading-relaxed" },
            msg
          )
        ),
        { duration: 3200 }
      );

      return result;
    } catch (error: any) {
      console.error("[useAttendanceSync] Sync failed:", error);
      const errMsg = error.message || "ไม่สามารถอัปเดตข้อมูล Attendance ได้";
      toast.error(
        React.createElement(
          "div",
          { className: "flex flex-col gap-0.5 text-left" },
          React.createElement(
            "span",
            { className: "font-semibold text-sm text-slate-800 leading-snug" },
            "เกิดข้อผิดพลาดในการซิงค์"
          ),
          React.createElement(
            "span",
            { className: "text-xs text-slate-500 leading-relaxed" },
            errMsg
          )
        ),
        { duration: 4500 }
      );
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [changedDates, startDate, endDate, onSyncSuccess, checkStatus]);

  const dismissNotification = useCallback(() => {
    setIsDismissed(true);
  }, []);

  return {
    hasNewUpdate: hasNewUpdate && !isDismissed,
    rawHasNewUpdate: hasNewUpdate,
    changedDates,
    totalDaysChanged,
    latestAttendanceUpdate,
    isChecking,
    isSyncing,
    checkStatus,
    syncSelective,
    dismissNotification,
  };
};
