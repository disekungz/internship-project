import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { Clock } from "lucide-react";

const AUTO_LOGOUT_TIME_MS = 15 * 60 * 1000; // 15 minutes inactivity timeout

export interface UseSmartReportAdminReturn {
  isAdmin: boolean;
  adminRemainingSeconds?: number;
  handleAdminLoginSuccess: () => void;
  handleAdminLogout: (isAuto?: boolean) => void;
  handleAdminToggle: (val?: boolean) => void;
  handleSetIsAdmin: (val: boolean) => void;
}

export const useSmartReportAdmin = (): UseSmartReportAdminReturn => {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    const isLogged = localStorage.getItem("pdt_is_admin") === "true";
    const lastActivity = localStorage.getItem("pdt_last_activity");
    if (isLogged && lastActivity) {
      if (Date.now() - parseInt(lastActivity, 10) > AUTO_LOGOUT_TIME_MS) {
        localStorage.removeItem("pdt_is_admin");
        localStorage.removeItem("pdt_last_activity");
        return false;
      }
    }
    return isLogged;
  });

  const handleAdminLogout = useCallback((isAuto = false) => {
    setIsAdmin(false);
    localStorage.removeItem("pdt_is_admin");
    localStorage.removeItem("pdt_last_activity");
    localStorage.removeItem("pdt_admin_user");
    localStorage.removeItem("pdt_admin_display_name");
    localStorage.removeItem("pdt_admin_role");
    if (isAuto) {
      toast(
        React.createElement(
          "div",
          { className: "flex flex-col gap-0.5 text-left" },
          React.createElement(
            "span",
            { className: "font-semibold text-sm text-slate-800 leading-snug" },
            "เซสชัน Admin หมดอายุ"
          ),
          React.createElement(
            "span",
            { className: "text-xs text-slate-500 leading-relaxed" },
            "เนื่องจากไม่มีการใช้งานนานเกิน 15 นาที ระบบได้ออกจากระบบให้อัตโนมัติ"
          )
        ),
        {
          position: "top-right",
          icon: React.createElement(Clock, {
            className: "h-5 w-5 text-amber-500 shrink-0",
            strokeWidth: 2.2,
          }),
          duration: 5000,
        }
      );
    }
  }, []);

  const handleAdminLoginSuccess = useCallback(() => {
    setIsAdmin(true);
    localStorage.setItem("pdt_is_admin", "true");
    localStorage.setItem("pdt_last_activity", Date.now().toString());
  }, []);

  const handleSetIsAdmin = useCallback((val?: boolean) => {
    if (val) {
      handleAdminLoginSuccess();
    } else {
      handleAdminLogout(false);
    }
  }, [handleAdminLoginSuccess, handleAdminLogout]);

  // Throttled inactivity tracking (runs purely in memory, zero React re-renders)
  useEffect(() => {
    if (!isAdmin) return;

    let lastActivityTime = Date.now();
    const lastActivityStr = localStorage.getItem("pdt_last_activity");
    if (lastActivityStr) {
      const parsed = parseInt(lastActivityStr, 10);
      if (!isNaN(parsed) && parsed > 0) {
        lastActivityTime = parsed;
      }
    }

    let lastSyncToStorage = 0;
    const handleUserActivity = () => {
      const now = Date.now();
      lastActivityTime = now;
      // Throttle localStorage write to at most once per 20 seconds
      if (now - lastSyncToStorage > 20000) {
        lastSyncToStorage = now;
        localStorage.setItem("pdt_last_activity", now.toString());
      }
    };

    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    activityEvents.forEach((evt) =>
      window.addEventListener(evt, handleUserActivity, { passive: true })
    );

    // Check timeout every 5 seconds without triggering React state updates unless logged out
    const intervalId = setInterval(() => {
      const now = Date.now();
      if (now - lastActivityTime >= AUTO_LOGOUT_TIME_MS) {
        handleAdminLogout(true);
      }
    }, 5000);

    return () => {
      clearInterval(intervalId);
      activityEvents.forEach((evt) =>
        window.removeEventListener(evt, handleUserActivity)
      );
    };
  }, [isAdmin, handleAdminLogout]);

  return {
    isAdmin,
    handleAdminLoginSuccess,
    handleAdminLogout,
    handleAdminToggle: handleSetIsAdmin,
    handleSetIsAdmin,
  };
};
