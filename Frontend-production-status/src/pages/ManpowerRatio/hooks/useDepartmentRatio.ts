import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDeptSummary } from '../api/deptSummary';

const CACHE_PREFIX = 'manpower-ratio-v55:';

/**
 * ดึงเดือนและปีปัจจุบันในรูปแบบ 'YYYY-MM'
 */
function getNowMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * อ่านข้อมูลแคชจาก LocalStorage
 * @param cacheKey คีย์แคช
 */
function readCache(cacheKey: string) {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

function compactRatioData(raw: any) {
  if (!raw) return null;
  const direct = raw.chartData?.direct || raw.direct || [];
  const includeIndirect = raw.chartData?.includeIndirect || raw.includeIndirect || [];
  return {
    month: raw.month,
    targets: raw.targets,
    spreadsheetData: raw.spreadsheetData,
    direct,
    includeIndirect,
    chartData: { direct, includeIndirect },
    plannedManpower: raw.plannedManpower,
    registeredByDept: raw.registeredByDept,
  };
}

/**
 * บันทึกข้อมูลลงใน LocalStorage พร้อมกระบวนการลดขนาดข้อมูล (Compact) เพื่อไม่ให้เกินโควต้า
 * @param cacheKey คีย์แคช
 * @param data ข้อมูลที่ต้องการเก็บ
 */
function writeCache(cacheKey: string, data: any) {
  try {
    const compact = compactRatioData(data);
    localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data: compact }));
  } catch {
    try {
      // หากเกิด QuotaExceeded ให้ล้างแคชเวอร์ชันเก่าออกเพื่อคืนพื้นที่
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('manpower-ratio-') && k !== cacheKey);
      keys.forEach((k) => localStorage.removeItem(k));
      const compact = compactRatioData(data);
      localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data: compact }));
    } catch {
      /* ละเว้นข้อผิดพลาด */
    }
  }
}

export interface DeptRatioState {
  data: any;
  loading: boolean;
  error: string;
  lastChangedDays: number;
  lastRefreshed: Date | null;
  refresh: () => void;
}

/**
 * Custom Hook สำหรับดึงและจัดการสถานะ Manpower Department Ratio
 * - มีระบบอ่าน Cache จาก LocalStorage ก่อนเพื่อการแสดงผลทันที (Optimistic UI)
 * - ดึงข้อมูลล่าสุดจาก Backend API แล้วอัปเดต state + cache
 * @param month เดือนที่เลือกในรูปแบบ 'YYYY-MM'
 */
export function useDepartmentRatio(month: string): DeptRatioState {
  const cacheKey = `${CACHE_PREFIX}${month}`;
  const [data, setData] = useState<any>(() => readCache(cacheKey));
  const [loading, setLoading] = useState(() => !readCache(cacheKey));
  const [error, setError] = useState('');
  const [lastChangedDays, setLastChangedDays] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const dataRef = useRef<any>(null);
  dataRef.current = data;

  // โหลดข้อมูลเมื่อ month หรือ cacheKey เปลี่ยน
  useEffect(() => {
    const cached = readCache(cacheKey);
    if (cached) {
      setData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError('');

    let isMounted = true;
    fetchDeptSummary(month)
      .then((next) => {
        if (!isMounted || !next) return;

        if (next) {
          setData(next);
          writeCache(cacheKey, next);
          setLastChangedDays(1);
        }
        setLastRefreshed(new Date());
        setError('');
      })
      .catch((reason) => {
        if (!isMounted) return;
        if (!dataRef.current) {
          setError(reason.message || 'Unable to load department ratios');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // ตรวจสอบข้อมูลใหม่เป็นระยะสำหรับเดือนปัจจุบัน (Auto-sync Real-time ทุก 3 นาที)
    const isCurrent = month === getNowMonthStr();
    let pollTimer: any = null;
    if (isCurrent) {
      pollTimer = setInterval(() => {
        if (!isMounted) return;
        fetchDeptSummary(month)
          .then((next) => {
            if (!isMounted || !next) return;
            const prevHash = JSON.stringify({
              chart: dataRef.current?.chartData?.direct || dataRef.current?.direct || [],
              targets: dataRef.current?.targets,
            });
            const nextHash = JSON.stringify({
              chart: next?.chartData?.direct || next?.direct || [],
              targets: next?.targets,
            });
            if (prevHash !== nextHash) {
              setData(next);
              writeCache(cacheKey, next);
              setLastRefreshed(new Date());
            }
          })
          .catch(() => {});
      }, 3 * 60 * 1000);
    }

    return () => {
      isMounted = false;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [month, cacheKey]);

  // ฟังก์ชันรีเฟรชข้อมูลแบบ manual โดยดึงจาก API ใหม่ทันที
  const manualRefresh = useCallback(() => {
    setLoading(true);
    fetchDeptSummary(month, undefined, true)
      .then((next) => {
        if (!next) return;
        setData(next);
        writeCache(cacheKey, next);
        setLastRefreshed(new Date());
        setError('');
      })
      .catch((err) => {
        if (!dataRef.current) setError(err.message || 'Error');
      })
      .finally(() => setLoading(false));
  }, [month, cacheKey]);

  return { data, loading, error, lastChangedDays, lastRefreshed, refresh: manualRefresh };
}


