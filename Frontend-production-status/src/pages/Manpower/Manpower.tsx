/**
 * หน้าจอหลัก: Manpower (ภาพรวมกำลังคนและชั่วโมงการทำงาน Man-Hour)
 * - แสดงตารางและกราฟ Man-Hour ประจำเดือนของแต่ละ Line การผลิต
 * - คำนวณยอดพนักงานมาทำงาน (Present), ขาด/ลา (Absent), ชั่วโมง Help In/Out, OT1, OT2
 * - รองรับระบบนำเข้า (Import Excel), ส่งออก (Export), ลบข้อมูล (Delete) และ SSE Auto Refresh
 */
import React, { useState, useMemo, useEffect, useRef } from "react";
import Select from "react-select";
import {
  DashboardHeader,
  DeleteAttendanceModal,
  GraphLineOption as ExtractedGraphLineOption,
  ImportPreviewModal,
  ImportSummaryModal,
  ExecutiveKpiBanner,
  WarRoomModal,
  DepartmentMatrixView,
  LineDeepDiveView,
} from "./components";
import { FileSpreadsheet, LayoutGrid, Building2, Sparkles, Search, ChevronDown, Download, Layers, X, Table } from "lucide-react";
import { exportManHourMatrixExcel, exportAllManHourMatrixExcel, exportStackedManHourMatrixExcel, exportTabsStackedManHourMatrixExcel } from "./utils/exportManHourMatrixExcel";
import { isAggregateLine, isShiftLine, partitionLines } from "./utils/lineClassification";
import {
  MANHOUR_API_ENDPOINT,
  MANHOUR_CALENDAR_ENDPOINT,
  MANHOUR_HELP_SUMMARY_ENDPOINT,
  MANHOUR_MONTHS_ENDPOINT,
  MANHOUR_SUMMARY_ENDPOINT,
  MANHOUR_VERSION_ENDPOINT,
  MANHOUR_CUSTOM_MAPPINGS_ENDPOINT,
} from "./constants";
import { getBrowserCache, setBrowserCache, removeBrowserCache } from "../../utility/browserCache";
import {
  LINE_GROUPS,
  MACRO_PCN_GROUPS,
  TAB_LINES,
  TAB_TOTAL_LINE_MAP,
  tabMenuList,
} from "./config/lineGroups";
import {
  GRAPH_AXIS_OPTIONS,
  GRAPH_GROUPS,
  GRAPH_OPTIONS,
  WEEK_RANGES,
} from "./config/graphConfig";
import {
  DAYS_ARRAY,
  EMPTY_DAY_INPUT,
  buildCalculatedRows,
  buildFullSpreadsheetData,
  buildLinesInputData,
  buildTabInputData,
  extractDatePart,
  createZeroLineData,
  doesLineValueMatchGroup,
  enrichSpreadsheetWithCustomLines,
  getEffectiveRecordStatus,
  getGraphMetricValue,
  getGraphMetricValueForDays,
  getRuntimeMappings,
  getRuntimeTabLines,
  isOtherFactoryRecord,
  isRecordMatchingLine,
  shouldCountAsAbsent,
  shouldCountAsPresent,
} from "./aggregation";
import useManHourImport from "./hooks/useManHourImport";
import useManhourServerEvents from "./hooks/useManhourServerEvents";
import ManHourChart, {
  MULTI_LINE_WORKING_COLORS,
} from "./components/ManHourChart";
import ManHourTable from "./components/ManHourTable";

const applyDirectHelpSummary = (spreadsheet, helpSummary) => {
  if (!Array.isArray(helpSummary) || helpSummary.length === 0)
    return spreadsheet;
  const result = { ...spreadsheet };

  Object.keys(result).forEach((lineName) => {
    const configuredLines = MACRO_PCN_GROUPS[lineName] ||
      LINE_GROUPS[lineName] || [lineName];
    const acceptedLines = [...new Set([...configuredLines, lineName])];
    const lineData: Record<number, any> = Object.fromEntries(
      Object.entries(result[lineName]).map(([day, values]) => [
        day,
        {
          ...values,
          helpOutHrs: 0,
          helpInHrs: 0,
          manOT1HelpOut: 0,
          manOT1HelpIn: 0,
          manOT2HelpOut: 0,
          manOT2HelpIn: 0,
        },
      ]),
    );
    const helpPeople = Object.fromEntries(
      DAYS_ARRAY.map((day: number) => [
        day,
        {
          ot1Out: new Set(),
          ot1In: new Set(),
          ot2Out: new Set(),
          ot2In: new Set(),
        },
      ]),
    );

    helpSummary.forEach((item) => {
      const day = Number(extractDatePart(item.date).slice(8, 10));
      if (!day || !lineData[day]) return;
      const hour = Number(item.hour) || 0;
      const sourceMatches = doesLineValueMatchGroup(
        item.line_out,
        acceptedLines,
      );
      const destinationMatches = doesLineValueMatchGroup(
        item.line_in,
        acceptedLines,
      );
      const isMacroPcnTotal = lineName === "Macro PCN";
      const countsAsHelpOut = isMacroPcnTotal
        ? Boolean(String(item.line_out || "").trim())
        : sourceMatches;
      const countsAsHelpIn = isMacroPcnTotal
        ? Boolean(String(item.line_in || "").trim())
        : destinationMatches;
      if (!countsAsHelpOut && !countsAsHelpIn) return;
      lineData[day] = {
        ...lineData[day],
        helpOutHrs:
          (Number(lineData[day].helpOutHrs) || 0) +
          (countsAsHelpOut ? hour : 0),
        helpInHrs:
          (Number(lineData[day].helpInHrs) || 0) + (countsAsHelpIn ? hour : 0),
      };
      const people = helpPeople[day];
      if (countsAsHelpOut) {
        (item.ot1_employee_ids || []).forEach((id) =>
          people.ot1Out.add(String(id)),
        );
        (item.ot2_employee_ids || []).forEach((id) =>
          people.ot2Out.add(String(id)),
        );
      }
      if (countsAsHelpIn) {
        (item.ot1_employee_ids || []).forEach((id) =>
          people.ot1In.add(String(id)),
        );
        (item.ot2_employee_ids || []).forEach((id) =>
          people.ot2In.add(String(id)),
        );
      }
    });
    DAYS_ARRAY.forEach((day) => {
      lineData[day] = {
        ...lineData[day],
        manOT1HelpOut: helpPeople[day].ot1Out.size,
        manOT1HelpIn: helpPeople[day].ot1In.size,
        manOT2HelpOut: helpPeople[day].ot2Out.size,
        manOT2HelpIn: helpPeople[day].ot2In.size,
      };
    });
    result[lineName] = lineData;
  });

  return result;
};

const isVdsLineName = (lineName: string) => /(?:_|-)VDS\b/i.test(lineName);

let initialManhourCacheLoaded = false;
let initialManhourCache = null;
const MANHOUR_CACHE_PREFIX = "manhour-summary-daily-v35:";
const MANHOUR_FAST_CACHE_PREFIX = "manhour-summary-fast-v20:";
const MANHOUR_AGGREGATION_VERSION = 57;
/**
 * ดึงข้อมูลสรุปตาราง Manpower จากแคชด่วน (Fast Cache) ของเดือนปัจจุบัน
 */
const getInitialSpreadsheetSummary = () => {
  try {
    const month = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      timeZone: "Asia/Bangkok",
    }).format(new Date());
    return JSON.parse(
      localStorage.getItem(`${MANHOUR_FAST_CACHE_PREFIX}${month}`) || "null",
    );
  } catch {
    return null;
  }
};

const saveSpreadsheetSummary = (month: string, spreadsheetData: any) => {
  try {
    localStorage.setItem(
      `${MANHOUR_FAST_CACHE_PREFIX}${month}`,
      JSON.stringify(spreadsheetData),
    );
  } catch {
    /* cache is optional */
  }
};

const MANHOUR_CALENDAR_CACHE_PREFIX = "manhour-calendar-v1:";

/**
 * ดึงข้อมูลปฏิทินวันทำงานจาก Fast Cache ของเบราว์เซอร์ เพื่อให้แสดงผลทันทีโดยไม่ต้องรอ API
 */
const getInitialManhourCalendar = () => {
  try {
    const month = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      timeZone: "Asia/Bangkok",
    }).format(new Date());
    return JSON.parse(
      localStorage.getItem(`${MANHOUR_CALENDAR_CACHE_PREFIX}${month}`) || "{}",
    );
  } catch {
    return {};
  }
};

const saveManhourCalendarCache = (month: string, calendarData: any) => {
  try {
    localStorage.setItem(
      `${MANHOUR_CALENDAR_CACHE_PREFIX}${month}`,
      JSON.stringify(calendarData),
    );
  } catch {}
};

/**
 * โหลดแคชข้อมูลสรุปรายวันเริ่มต้น (Initial Daily Summary Cache) เพื่อให้หน้าจอแสดงผลได้ทันที
 */
const getInitialManhourCache = () => {
  if (initialManhourCacheLoaded) return initialManhourCache;
  initialManhourCacheLoaded = true;
  try {
    const month = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      timeZone: "Asia/Bangkok",
    }).format(new Date());
    initialManhourCache = JSON.parse(
      localStorage.getItem(`${MANHOUR_CACHE_PREFIX}${month}`) || "null",
    );
  } catch (error) {
    console.warn("Unable to restore cached Man-Hour summary:", error);
  }
  return initialManhourCache;
};

// ─────────────────────────────────────────────────────────────
// 🚀 Dedicated Persistent Singleton Web Worker for Manpower
// ─────────────────────────────────────────────────────────────
let sharedAggregationWorker: Worker | null = null;
let currentWorkerRequestId = 0;
const pendingWorkerRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

function getOrCreateAggregationWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  if (!sharedAggregationWorker) {
    try {
      sharedAggregationWorker = new Worker(
        new URL("./aggregation.worker.ts", import.meta.url),
        { type: "module" },
      );
      sharedAggregationWorker.onmessage = (event) => {
        const { requestId, ok, spreadsheetData, error } = event.data || {};
        if (requestId !== undefined && pendingWorkerRequests.has(requestId)) {
          const req = pendingWorkerRequests.get(requestId)!;
          pendingWorkerRequests.delete(requestId);
          if (ok) req.resolve(spreadsheetData);
          else req.reject(new Error(error || "Man-Hour aggregation worker failed"));
        }
      };
      sharedAggregationWorker.onerror = (event) => {
        console.error("[Manpower Worker Error]", event.message);
        sharedAggregationWorker?.terminate();
        sharedAggregationWorker = null;
        pendingWorkerRequests.forEach((req) =>
          req.reject(new Error(event.message || "Man-Hour aggregation worker failed"))
        );
        pendingWorkerRequests.clear();
      };
    } catch (e) {
      console.warn("[Manpower Worker Init Fallback]", e);
      sharedAggregationWorker = null;
    }
  }
  return sharedAggregationWorker;
}

/**
 * ส่งข้อมูลไปคำนวณและประมวลผลตาราง Man-Hour บน Web Worker เบื้องหลัง (ไม่บล็อก UI Thread)
 */
const buildSpreadsheetOffMainThread = (records: any[], workingDateKeys?: Set<string>) => {
  const mappings = getRuntimeMappings();
  const worker = getOrCreateAggregationWorker();
  if (!worker) {
    return Promise.resolve(buildFullSpreadsheetData(records, mappings, workingDateKeys));
  }
  const reqId = ++currentWorkerRequestId;
  return new Promise((resolve, reject) => {
    pendingWorkerRequests.set(reqId, { resolve, reject });
    worker.postMessage({
      requestId: reqId,
      records,
      mappings,
      workingDateKeys: workingDateKeys ? Array.from(workingDateKeys) : undefined,
    });
  });
};

const graphControlIconPaths = {
  all: "M4 6h16M4 12h16M4 18h16",
  select: "M4 6h10M4 12h7M4 18h4m10-7 3 3-7 7-3 1 1-3 7-7z",
  date: "M3 5h18v16H3zM8 3v4m8-4v4M3 10h18M8 14h3m2 0h3m-8 4h3",
  week: "M3 5h18v16H3zM8 3v4m8-4v4M3 10h18M7 14h2m2 0h2m2 0h2m-10 4h2m2 0h2m2 0h2",
  line: "M4 18 9 11l4 3 7-9M4 5v13h16",
  major: "M4 6h16M4 12h16M4 18h16",
  minor: "M6 7h12M8 12h8m-6 5h4",
};
function GraphControlIcon({
  name,
}: {
  name: keyof typeof graphControlIconPaths;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={graphControlIconPaths[name]} />
    </svg>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("Macro PCN");
  const [selectedLine, setSelectedLine] = useState("Macro PCN");
  const [graphGroup, setGraphGroup] = useState("persons");
  const [graphMetric, setGraphMetric] = useState("register");
  const [graphAxis, setGraphAxis] = useState("date");
  const [graphDay, setGraphDay] = useState(1);
  const [graphScope, setGraphScope] = useState("all");
  const [graphLineLevel, setGraphLineLevel] = useState("major");
  const [selectedGraphLines, setSelectedGraphLines] = useState(["Macro PCN"]);
  const [viewMode, setViewMode] = useState<"split" | "matrix" | "graph" | "table">("split");
  const [isWarRoomOpen, setIsWarRoomOpen] = useState(false);
  const tooltipStatusLoadingDays = useRef(new Set<string>());
  const [manhourCalendar, setManhourCalendar] = useState(getInitialManhourCalendar);
  const [manhourRefreshToken, setManhourRefreshToken] = useState(0);
  const [lineMappingRevision, setLineMappingRevision] = useState(0);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() =>
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      timeZone: "Asia/Bangkok",
    }).format(new Date()),
  );
  const displayDays = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    return DAYS_ARRAY.slice(0, new Date(year, month, 0).getDate());
  }, [selectedMonth]);
  const [isLoadingManhour, setIsLoadingManhour] = useState(() => {
    // ถ้ามี fast cache อยู่แล้ว ไม่ต้องแสดง loading ตั้งแต่แรก
    const fastSummary = getInitialSpreadsheetSummary();
    const fullCache = getInitialManhourCache();
    return !fastSummary && !fullCache?.spreadsheetData;
  });
  const [manhourError, setManhourError] = useState(null);
  const [manhourRecords, setManhourRecords] = useState<any[]>([]);
  const rawAttendanceCacheRef = useRef<any[]>([]);
  const pendingEventRefreshDates = useRef<string[]>([]);
  const statusSpreadsheetCache = useRef(new Map<string, any>());
  const tooltipStatusCache = useRef(new Map<string, Map<string, any[]>>());
  const statusPersonsGraphCache = useRef(new Map<string, any[]>());
  const graphDataCache = useRef(new Map<string, any[]>());
  const [isGraphReady, setIsGraphReady] = useState(true);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [statusFilteredSpreadsheetData, setStatusFilteredSpreadsheetData] =
    useState<any>(null);
  const [statusTooltipData, setStatusTooltipData] = useState<any>(
    () => getInitialManhourCache()?.statusTooltipData || {},
  );

  /**
   * ดึงข้อมูลสถานะพนักงาน (Status Tooltip) ประจำวันที่เลือกแบบ On-demand (เมื่อนำเมาส์ไปชี้)
   */
  const loadTooltipStatusDay = (label: string | number) => {
    const day = Number(label);
    if (
      !Number.isInteger(day) ||
      day < 1 ||
      day > 31 ||
      statusTooltipData?.[day]
    )
      return;
    const date = `${selectedMonth}-${String(day).padStart(2, "0")}`;
    if (tooltipStatusLoadingDays.current.has(date)) return;
    tooltipStatusLoadingDays.current.add(date);
    fetch(
      `${MANHOUR_SUMMARY_ENDPOINT}?month=${encodeURIComponent(selectedMonth)}&dates=${date}`,
      { cache: "no-store" },
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload?.statusTooltipData)
          setStatusTooltipData((current) => ({
            ...current,
            ...payload.statusTooltipData,
          }));
      })
      .catch((error) => console.error("Unable to load tooltip status:", error))
      .finally(() => tooltipStatusLoadingDays.current.delete(date));
  };

  /**
   * State สำหรับเก็บข้อมูลตาราง Man-Hour ทั้งหมด (เริ่มต้นดึงจาก Cache หรือสร้างตารางค่า 0 ไว้ก่อน)
   */
  const [spreadsheetData, setSpreadsheetData] = useState(() => {
    const cached = getInitialManhourCache();
    if (cached?.spreadsheetData) return enrichSpreadsheetWithCustomLines(cached.spreadsheetData);
    const fastSummary = getInitialSpreadsheetSummary();
    if (fastSummary) return enrichSpreadsheetWithCustomLines(fastSummary);
    const initialMap = {};
    Object.entries(TAB_LINES).forEach(([tab, lines]) => {
      lines.forEach((line) => {
        initialMap[line] = createZeroLineData();
      });
    });
    return enrichSpreadsheetWithCustomLines(initialMap);
  });

  const [toastMessage, setToastMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  /**
   * แสดงกล่องข้อความแจ้งเตือน Toast Message (3 วินาที)
   */
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  /**
   * ฟังก์ชันเคลียร์แคชข้อมูล Manpower เฉพาะวันที่เกิดการเปลี่ยนแปลง
   * เพื่อให้ระบบดึงข้อมูลใหม่เฉพาะวันนั้นๆ โดยไม่ต้องคำนวณใหม่ทั้งเดือน
   */
  const invalidateManhourCache = async (changedDates = []) => {
    if (changedDates.length > 0) {
      try {
        const datesByMonth = changedDates.reduce(
          (groups, date) => {
            const dateKey = String(date || "").slice(0, 10);
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey))
              (groups[dateKey.slice(0, 7)] ||= []).push(dateKey);
            return groups;
          },
          {} as Record<string, string[]>,
        );
        await Promise.all(
          Object.entries(datesByMonth).map(async ([month, dates]) => {
            const indexedCache = await getBrowserCache<any>(
              `${MANHOUR_CACHE_PREFIX}${month}`,
            );
            if (!indexedCache?.dayVersions) return;
            dates.forEach((date) => delete indexedCache.dayVersions[date]);
            await setBrowserCache(
              `${MANHOUR_CACHE_PREFIX}${month}`,
              indexedCache,
            );
          }),
        );
        Object.keys(localStorage)
          .filter((key) => key.startsWith(MANHOUR_CACHE_PREFIX))
          .forEach((key) => {
            const cached = JSON.parse(localStorage.getItem(key) || "null");
            if (!cached?.dayVersions) return;
            changedDates.forEach((date) => delete cached.dayVersions[date]);
            localStorage.setItem(key, JSON.stringify(cached));
          });
      } catch (error) {
        console.warn("Unable to invalidate changed Man-Hour days:", error);
      }
    } else {
      try {
        localStorage.removeItem(`${MANHOUR_FAST_CACHE_PREFIX}${selectedMonth}`);
        localStorage.removeItem(`${MANHOUR_CACHE_PREFIX}${selectedMonth}`);
        await removeBrowserCache(`${MANHOUR_CACHE_PREFIX}${selectedMonth}`);
        rawAttendanceCacheRef.current = [];
      } catch (error) {
        console.warn("Unable to clear full Man-Hour cache:", error);
      }
    }
    setManhourRefreshToken((value) => value + 1);
  };

  const {
    importMode,
    setImportMode,
    isImporting,
    importSummary,
    setImportSummary,
    pendingImport,
    setPendingImport,
    deleteDate,
    setDeleteDate,
    deleteMode,
    setDeleteMode,
    isDeletingDay,
    deleteCandidates,
    setDeleteCandidates,
    importFileRef,
    handleManhourImport,
    updatePendingImportRow,
    addPendingImportRow,
    confirmManhourImport,
    handleDeleteDay,
    confirmDeleteEmployees,
  } = useManHourImport({ triggerToast, invalidateManhourCache });

  /**
   * โหลดรายการเดือนที่มีข้อมูลจาก Backend เพื่อนำมาแสดงในตัวเลือก Month Selector
   */
  useEffect(() => {
    let cancelled = false;
    fetch(MANHOUR_MONTHS_ENDPOINT, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((months: string[]) => {
        if (cancelled) return;
        const nextMonths = Array.isArray(months) ? months : [];
        const currentMonth = new Intl.DateTimeFormat("en-CA", {
          year: "numeric",
          month: "2-digit",
          timeZone: "Asia/Bangkok",
        }).format(new Date());
        const monthsWithCurrent = nextMonths.includes(currentMonth)
          ? nextMonths
          : [...nextMonths, currentMonth];
        setAvailableMonths(monthsWithCurrent);
        setSelectedMonth((previous) =>
          monthsWithCurrent.includes(previous) ? previous : currentMonth,
        );
      })
      .catch(() => {
        if (!cancelled) setAvailableMonths([]);
      });

    return () => {
      cancelled = true;
    };
  }, [manhourRefreshToken]);

  /**
   * ซิงค์การตั้งค่า Line Mappings จากฐานข้อมูล PostgreSQL เมื่อเปิดหน้าเว็บ
   */
  useEffect(() => {
    const handleMappingsUpdate = () => {
      setLineMappingRevision((v) => v + 1);
      setSpreadsheetData((prev: any) => (prev ? enrichSpreadsheetWithCustomLines(prev) : prev));
    };
    window.addEventListener("manhour-line-mappings-updated", handleMappingsUpdate);
    window.addEventListener("manhour-hidden-lines-changed", handleMappingsUpdate);

    fetch(MANHOUR_CUSTOM_MAPPINGS_ENDPOINT)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.ok && json?.data) {
          localStorage.setItem("manhour-line-mappings", JSON.stringify(json.data));
          window.dispatchEvent(new Event("manhour-line-mappings-updated"));
        }
      })
      .catch((err) => console.warn("Could not sync line mappings from DB Test:", err));

    return () => {
      window.removeEventListener("manhour-line-mappings-updated", handleMappingsUpdate);
      window.removeEventListener("manhour-hidden-lines-changed", handleMappingsUpdate);
    };
  }, []);

  /**
   * เชื่อมต่อ Server-Sent Events (SSE) เพื่อรับการแจ้งเตือน Real-time เมื่อมีข้อมูลการลงเวลาเปลี่ยนแปลง
   * ระบบจะเคลียร์แคชและดึงข้อมูลใหม่เฉพาะวันที่เปลี่ยนแปลง โดยไม่ต้องโหลดใหม่ทั้งเดือน
   * เมื่อ SSE reconnect (หลัง backend restart) จะเช็ค version แล้ว invalidate เฉพาะวันที่เปลี่ยน
   */
  useEffect(() => {
    const source = new EventSource(`${MANHOUR_API_ENDPOINT}/events`);
    let isFirstOpen = true;

    const handleChange = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data || "{}");
        const dates = Array.isArray(payload?.dates)
          ? payload.dates.filter((date: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(date)))
          : [];
        if (dates.length > 0) invalidateManhourCache(dates);
        else setManhourRefreshToken((value) => value + 1);
      } catch (error) {
        console.warn("Unable to process Man-Hour realtime event:", error);
      }
    };

    source.addEventListener("change", handleChange as EventListener);

    // เมื่อ SSE reconnect หลัง backend restart → เช็ค version แล้ว invalidate เฉพาะวันที่เปลี่ยน
    source.onopen = () => {
      if (isFirstOpen) {
        isFirstOpen = false;
        return; // ครั้งแรกไม่ต้อง refresh (โหลดปกติอยู่แล้ว)
      }
      // reconnect → เช็ค version เพื่อหาวันที่เปลี่ยนระหว่างที่หลุดการเชื่อมต่อ
      console.info("[SSE] Reconnected — checking for changed dates");
      (async () => {
        try {
          const currentMonth = new Intl.DateTimeFormat("en-CA", {
            year: "numeric", month: "2-digit", timeZone: "Asia/Bangkok",
          }).format(new Date());
          const versionRes = await fetch(
            `${MANHOUR_VERSION_ENDPOINT}?month=${encodeURIComponent(currentMonth)}`,
            { cache: "no-store" },
          );
          if (!versionRes.ok) throw new Error(`Version HTTP ${versionRes.status}`);
          const versionData = await versionRes.json();
          const serverDayVersions: Record<string, string> = versionData?.days || {};

          // โหลด cache ที่มีอยู่เพื่อเปรียบเทียบ dayVersions
          const cacheKey = `${MANHOUR_CACHE_PREFIX}${currentMonth}`;
          const cached = await getBrowserCache<any>(cacheKey);
          const cachedDayVersions: Record<string, string> = cached?.dayVersions || {};

          // หาวันที่ version ต่างกัน (มีข้อมูลใหม่หรือถูกแก้ไข)
          const changedDates = [
            ...new Set([
              ...Object.keys(serverDayVersions),
              ...Object.keys(cachedDayVersions),
            ]),
          ].filter((date) => serverDayVersions[date] !== cachedDayVersions[date]);

          if (changedDates.length > 0) {
            console.info(`[SSE] Found ${changedDates.length} changed date(s): ${changedDates.join(", ")}`);
            await invalidateManhourCache(changedDates);
          } else {
            console.info("[SSE] No changes detected after reconnect");
          }
        } catch (err) {
          console.warn("[SSE] Reconnect version check failed — falling back to full refresh:", err);
          setManhourRefreshToken((value) => value + 1);
        }
      })();
    };

    source.onerror = () => {
      // EventSource จะพยายามเชื่อมต่อใหม่ให้อัตโนมัติตาม retry configuration ของเซิร์ฟเวอร์
    };

    return () => {
      source.removeEventListener("change", handleChange as EventListener);
      source.close();
    };
  }, []);



  useEffect(() => {
    rawAttendanceCacheRef.current = [];
    setManhourRecords([]);
    setSelectedStatuses([]);
    setStatusFilteredSpreadsheetData(null);

    // โหลด Fast Cache หรือ IndexedDB ทันทีที่ผู้ใช้สลับเดือน เพื่อให้ตารางและกราฟแสดงผลได้ทันที
    const fastCached = localStorage.getItem(`${MANHOUR_FAST_CACHE_PREFIX}${selectedMonth}`);
    if (fastCached) {
      try {
        const parsed = JSON.parse(fastCached);
        if (parsed) {
          setSpreadsheetData(enrichSpreadsheetWithCustomLines(parsed));
          setIsGraphReady(true);
        }
      } catch {}
    } else {
      getBrowserCache<any>(`${MANHOUR_CACHE_PREFIX}${selectedMonth}`).then((cached) => {
        if (cached?.spreadsheetData && cached.month === selectedMonth) {
          setSpreadsheetData(enrichSpreadsheetWithCustomLines(cached.spreadsheetData));
          if (cached.statusTooltipData) setStatusTooltipData(cached.statusTooltipData);
          setIsGraphReady(true);
        }
      }).catch(() => {});
    }
  }, [selectedMonth]);

  /**
   * Effect หลักสำหรับโหลดข้อมูล Man-Hour และจัดการ Lifecycle ของแคช
   * - ตรวจสอบความถูกต้องของ Cache กับ Version จาก Database
   * - ถ้าข้อมูลเปลี่ยนเฉพาะบางวัน จะดึงเฉพาะวันนั้น (Incremental Update)
   * - ถ้าข้อมูลเปลี่ยนทั้งเดือนหรือยังไม่มีแคช จะดึงข้อมูลสรุปใหม่ทั้งหมด
   */
  useEffect(() => {
    let cancelled = false;
    let refreshInFlight = false;

    async function loadManhourData(forceSummaryRefresh = false) {
      if (refreshInFlight || document.visibilityState === "hidden") return;
      refreshInFlight = true;
      setIsLoadingManhour(true);
      setManhourError(null);
      try {
        const currentMonth = selectedMonth;
        let cacheKey = `${MANHOUR_CACHE_PREFIX}${currentMonth}`;
        let cached = null;
        try {
          cached = await getBrowserCache<any>(cacheKey);
          if (!cached) {
            cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
            if (cached) {
              await setBrowserCache(cacheKey, cached);
              localStorage.removeItem(cacheKey);
            }
          }
          if (cached?.month !== currentMonth) cached = null;
          if (cancelled) return;
          if (cached?.spreadsheetData) {
            setSpreadsheetData(cached.spreadsheetData);
            setIsGraphReady(true);
            saveSpreadsheetSummary(currentMonth, cached.spreadsheetData);
          }
          if (cached?.statusTooltipData)
            setStatusTooltipData(cached.statusTooltipData);
          if (Array.isArray(cached?.records)) {
            rawAttendanceCacheRef.current = cached.records;
          }
          // แสดงผลจากแคชทันทีเพื่อให้หน้าจอไม่กระตุก จากนั้นจึงตรวจเช็คอัปเดตเบื้องหลัง
          if (cached?.spreadsheetData) setIsLoadingManhour(false);
        } catch (cacheError) {
          console.warn("Invalid Man-Hour daily cache:", cacheError);
        }

        const eventDates = pendingEventRefreshDates.current.filter((date) =>
          date.startsWith(`${currentMonth}-`),
        );
        pendingEventRefreshDates.current =
          pendingEventRefreshDates.current.filter(
            (date) => !date.startsWith(`${currentMonth}-`),
          );
        const canUseEventDates =
          eventDates.length > 0 && cached?.spreadsheetData;
        let versionData: any = {};
        let month = currentMonth;
        let currentDayVersions = cached?.dayVersions || {};
        let changedDates: string[] = [];
        if (canUseEventDates) {
          changedDates = [...new Set(eventDates)];
        } else {
          // ตรวจสอบ Version และ Checksum ของข้อมูลประจำเดือนจาก Backend เบื้องหลัง
          const versionUrl = `${MANHOUR_VERSION_ENDPOINT}?month=${encodeURIComponent(currentMonth)}`;
          const versionResponse = await fetch(versionUrl, {
            cache: "no-store",
          });
          if (!versionResponse.ok)
            throw new Error(`Version HTTP ${versionResponse.status}`);
          const latestVersionData = await versionResponse.json();
          if (String(latestVersionData.month || "") === currentMonth) {
            versionData = latestVersionData;
            currentDayVersions = versionData.days || {};
            const previousDayVersions = cached?.dayVersions || {};
            changedDates = [
              ...new Set([
                ...Object.keys(currentDayVersions),
                ...Object.keys(previousDayVersions),
              ]),
            ].filter(
              (date) => currentDayVersions[date] !== previousDayVersions[date],
            );

            // เปรียบเทียบจำนวนแถวข้อมูลของแต่ละวันระหว่างแคชกับ Database
            // หากจำนวนแถวไม่ตรงกัน ให้ดึงข้อมูลใหม่เฉพาะวันที่ไม่ตรง
            if (Array.isArray(cached?.records)) {
              const cachedRowsByDate = cached.records.reduce((counts: Record<string, number>, record: any) => {
                const date = String(record?.dlh_effective_date_time || "").slice(0, 10);
                if (date) counts[date] = (counts[date] || 0) + 1;
                return counts;
              }, {} as Record<string, number>);
              Object.entries(currentDayVersions).forEach(([date, version]) => {
                const apiRowCount = Number(String(version || "").split(":")[0]) || 0;
                if (apiRowCount !== Number(cachedRowsByDate[date] || 0)) {
                  changedDates.push(date);
                }
              });
              changedDates = [...new Set(changedDates)];
            }
            const cachedHelpDates = new Set(
              (Array.isArray(cached?.helpSummary) ? cached.helpSummary : [])
                .map((item) => String(item?.date || "").slice(0, 10))
                .filter(Boolean),
            );
            Object.entries(currentDayVersions).forEach(([date, version]) => {
              const helpMatch = String(version || "").match(/:help:(\d+):/);
              const helpRowCount = helpMatch ? Number(helpMatch[1]) : 0;
              if (helpRowCount > 0 && !cachedHelpDates.has(date)) {
                changedDates.push(date);
              }
            });
            changedDates = [...new Set(changedDates)];
          }
        }

        const hasSummaryCache = Boolean(
          cached?.summaryOnly &&
          cached?.spreadsheetData &&
          cached?.statusTooltipData,
        );
        const hasCompleteCache =
          Array.isArray(cached?.records) &&
          Array.isArray(cached?.helpSummary) &&
          cached?.spreadsheetData;
        const versionRecordCount = Number(
          versionData?.count ??
          versionData?.rowCount ??
          versionData?.total ??
          0,
        );
        const cachedMacroData = cached?.spreadsheetData?.["Macro PCN"] || {};
        const cachedMacroTotal = Object.values(cachedMacroData).reduce(
          (sum: number, dayData: any) => sum + Number(dayData?.opRegister || 0),
          0,
        );
        const cachedBreakdownTotal = Object.values(TAB_TOTAL_LINE_MAP)
          .filter((lineName) => lineName && lineName !== "Macro PCN")
          .reduce((sum: number, lineName: any) => {
            const lineData = cached?.spreadsheetData?.[lineName] || {};
            return (
              sum +
              Object.values(lineData).reduce(
                (lineSum: number, dayData: any) =>
                  lineSum + Number(dayData?.opRegister || 0),
                0,
              )
            );
          }, 0);
        const cacheMissingAttendance =
          hasCompleteCache &&
          versionRecordCount > 0 &&
          (cached.records.length === 0 ||
            cached.records.length < versionRecordCount ||
            cachedMacroTotal === 0 ||
            cachedBreakdownTotal === 0);
        const summaryCacheMissingAttendance =
          hasSummaryCache &&
          Object.entries(currentDayVersions).some(([date, version]) => {
            const sourceRowCount =
              Number(String(version || "").split(":")[0]) || 0;
            const day = Number(String(date).slice(8, 10));
            return (
              sourceRowCount > 0 &&
              Number(cachedMacroData?.[day]?.opRegister || 0) === 0
            );
          });

        const cacheHasStatusTooltipData =
          Object.keys(cached?.statusTooltipData || {}).length > 0;

        const isCurrentActiveMonth = currentMonth === new Intl.DateTimeFormat('en-CA', {
          year: 'numeric', month: '2-digit', timeZone: 'Asia/Bangkok',
        }).format(new Date());

        // แสดงผลจากแคชก่อนทันทีเพื่อให้หน้าจอไม่กระตุก (Optimistic UI) จากนั้นระบบจะตรวจสอบ Version เบื้องหลัง
        if (cached?.spreadsheetData || hasSummaryCache || hasCompleteCache) {
          if (!cancelled) {
            const dataToUse = cached.spreadsheetData;
            const enriched = enrichSpreadsheetWithCustomLines(dataToUse);
            setSpreadsheetData(enriched);
            if (cached?.statusTooltipData) setStatusTooltipData(cached.statusTooltipData);
            if (Array.isArray(cached?.records)) setManhourRecords(cached.records);
            setIsLoadingManhour(false);
            setIsGraphReady(true);
          }
        }

        const hasReliableMonthVersion =
          !isCurrentActiveMonth || String(versionData?.month || "") === currentMonth;

        // ตรวจสอบความสมบูรณ์ของข้อมูล: ถ้าวันใดในเดือนมีข้อมูลในฐานข้อมูล แต่ opRegister เป็น 0 จะบังคับดึงข้อมูลใหม่จาก API ทันที
        // ตรวจสอบเฉพาะวันที่มีอยู่จริงในเดือนนั้น (เช่น ก.พ. มี 28/29 วัน, เม.ย. มี 30 วัน) ไม่เช็คเกินวันสิ้นเดือน
        const actualDaysInMonth = new Date(
          Number(currentMonth.slice(0, 4)),
          Number(currentMonth.slice(5, 7)),
          0,
        ).getDate();
        const validDaysList = DAYS_ARRAY.filter((d) => d <= actualDaysInMonth);

        const hasZeroDataDays = validDaysList.some((day) => {
          const macroDay = cached?.spreadsheetData?.["Macro PCN"]?.[day];
          const dayString = `-${String(day).padStart(2, "0")}`;
          const hasRecordsForDay = Object.keys(currentDayVersions).some((dateStr) =>
            dateStr.endsWith(dayString),
          );
          return hasRecordsForDay && (!macroDay || Number(macroDay.opRegister || 0) === 0);
        });

        const customMappings = getRuntimeMappings();
        const hasMissingCustomLines = Object.keys(customMappings).some(
          (parentName) => !cached?.spreadsheetData?.[parentName],
        );

        if (
          (hasCompleteCache || hasSummaryCache) &&
          cacheHasStatusTooltipData &&
          hasReliableMonthVersion &&
          changedDates.length === 0 &&
          !cacheMissingAttendance &&
          !summaryCacheMissingAttendance &&
          !hasZeroDataDays &&
          !hasMissingCustomLines
        ) {
          if (cached?.summaryOnly && cached?.spreadsheetData) {
            if (!cancelled) {
              const enriched = enrichSpreadsheetWithCustomLines(cached.spreadsheetData);
              setSpreadsheetData(enriched);
              if (cached?.statusTooltipData)
                setStatusTooltipData(cached.statusTooltipData);
              setIsLoadingManhour(false);
              setIsGraphReady(true);
            }
            return;
          }
          if (cached?.aggregationVersion === MANHOUR_AGGREGATION_VERSION && Array.isArray(cached?.records) && cached.records.length > 0) {
            rawAttendanceCacheRef.current = cached.records;
            setManhourRecords(cached.records);
            if (!cancelled) {
              const enriched = enrichSpreadsheetWithCustomLines(cached.spreadsheetData);
              setSpreadsheetData(enriched);
              if (cached?.statusTooltipData)
                setStatusTooltipData(cached.statusTooltipData);
              setIsLoadingManhour(false);
              setIsGraphReady(true);
            }
            return;
          }
          const aggregated = await buildSpreadsheetOffMainThread(
            cached.records || [],
          );
          if (cancelled) return;
          const recalculated = applyDirectHelpSummary(
            aggregated,
            cached.helpSummary || [],
          );
          const enrichedRecalculated = enrichSpreadsheetWithCustomLines(recalculated);
          setSpreadsheetData(enrichedRecalculated);
          saveSpreadsheetSummary(month, enrichedRecalculated);
          rawAttendanceCacheRef.current = cached.records || [];
          setManhourRecords(cached.records || []);
          setIsLoadingManhour(false);
          setIsGraphReady(true);
          return;
        }
        const hasCachedSpreadsheetValues = Boolean(
          cached?.spreadsheetData &&
          Object.values(cached.spreadsheetData["Macro PCN"] || {}).some(
            (dayData: any) => Number(dayData?.opRegister || 0) > 0,
          ),
        );
        const incremental =
          changedDates.length > 0 && hasCachedSpreadsheetValues;
        // ถ้าไม่มีแคชเลยให้ขึ้น Loading แต่ถ้ามีแคชอยู่แล้วให้แสดงแคชเดิมแล้วอัปเดตเงียบๆ เบื้องหลัง
        if (!hasCachedSpreadsheetValues) {
          setIsLoadingManhour(true);
        }
        if (incremental) {
          const summaryResponse = await fetch(
            `${MANHOUR_SUMMARY_ENDPOINT}?month=${encodeURIComponent(currentMonth)}&dates=${encodeURIComponent(changedDates.join(","))}`,
            { cache: "no-store" },
          );
          if (!summaryResponse.ok)
            throw new Error(`Summary HTTP ${summaryResponse.status}`);
          const summaryPayload = await summaryResponse.json();
          const changedSpreadsheetData = summaryPayload?.spreadsheetData;
          if (!changedSpreadsheetData)
            throw new Error(
              "Man-Hour daily summary is missing spreadsheet data",
            );
          if (cancelled) return;
          const changedDays = changedDates.map((date) =>
            Number(date.slice(8, 10)),
          );
          const nextSpreadsheetData = Object.fromEntries(
            Object.entries(cached.spreadsheetData).map(
              ([lineName, dayMap]: [string, any]) => [
                lineName,
                {
                  ...dayMap,
                  ...Object.fromEntries(
                    changedDays.map((day) => [
                      day,
                      changedSpreadsheetData[lineName]?.[day] ||
                      EMPTY_DAY_INPUT,
                    ]),
                  ),
                },
              ],
            ),
          );
          const nextStatusTooltipData = { ...(cached.statusTooltipData || {}) };
          changedDays.forEach((day) => {
            if (summaryPayload.statusTooltipData?.[day])
              nextStatusTooltipData[day] =
                summaryPayload.statusTooltipData[day];
            else delete nextStatusTooltipData[day];
          });
          const enrichedNext = enrichSpreadsheetWithCustomLines(nextSpreadsheetData);
          setSpreadsheetData(enrichedNext);
          setStatusTooltipData(nextStatusTooltipData);
          saveSpreadsheetSummary(month, enrichedNext);
          await setBrowserCache(cacheKey, {
            ...cached,
            aggregationVersion: MANHOUR_AGGREGATION_VERSION,
            month: currentMonth,
            dayVersions: currentDayVersions,
            spreadsheetData: enrichedNext,
            statusTooltipData: nextStatusTooltipData,
            summaryOnly: true,
          });
          setIsLoadingManhour(false);
          setIsGraphReady(true);
          triggerToast(
            `Updated working hours for day ${changedDays.join(", ")}.`,
          );
          return;
        }
        if (!incremental) {
          const summaryResponse = await fetch(
            `${MANHOUR_SUMMARY_ENDPOINT}?month=${encodeURIComponent(currentMonth)}${forceSummaryRefresh || changedDates.length > 0 || hasZeroDataDays ? "&refresh=1" : ""}`,
            { cache: "no-store" },
          );
          if (!summaryResponse.ok)
            throw new Error(`Summary HTTP ${summaryResponse.status}`);
          const summaryPayload = await summaryResponse.json();
          const nextSpreadsheetData = summaryPayload?.spreadsheetData;
          if (!nextSpreadsheetData)
            throw new Error("Man-Hour summary is missing spreadsheet data");
          if (cancelled) return;
          const fetchedHelpSummary = Array.isArray(summaryPayload?.helpSummary)
            ? summaryPayload.helpSummary
            : [];
          const nextSpreadsheetDataWithHelp = fetchedHelpSummary.length > 0
            ? applyDirectHelpSummary(nextSpreadsheetData, fetchedHelpSummary)
            : nextSpreadsheetData;
          const enrichedNext = enrichSpreadsheetWithCustomLines(nextSpreadsheetDataWithHelp);
          setSpreadsheetData(enrichedNext);
          setStatusTooltipData(summaryPayload?.statusTooltipData || {});
          saveSpreadsheetSummary(month, enrichedNext);
          await setBrowserCache(cacheKey, {
            aggregationVersion: MANHOUR_AGGREGATION_VERSION,
            month: currentMonth,
            dayVersions: currentDayVersions,
            spreadsheetData: enrichedNext,
            statusTooltipData: summaryPayload?.statusTooltipData || {},
            helpSummary: fetchedHelpSummary,
            summaryOnly: true,
          });
          setIsLoadingManhour(false);
          setIsGraphReady(true);
          return;
        }
        const datesQuery = incremental
          ? `&dates=${encodeURIComponent(changedDates.join(","))}`
          : "";
        // สร้างข้อมูลใหม่หลังจากมีการอัปเดต Line Mapping เพื่อไม่ให้ใช้ข้อมูลที่ค้าง
        const refreshQuery = "?refresh=1";
        const monthQuery = month ? `&month=${encodeURIComponent(month)}` : "";
        const [response, helpResponse] = await Promise.all([
          fetch(`${MANHOUR_API_ENDPOINT}${refreshQuery}${monthQuery}${datesQuery}`, {
            cache: "no-store",
          }),
          fetch(
            `${MANHOUR_HELP_SUMMARY_ENDPOINT}${refreshQuery}${monthQuery}${datesQuery}`,
            { cache: "no-store" },
          ),
        ]);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!helpResponse.ok)
          throw new Error(`Help summary HTTP ${helpResponse.status}`);
        const data = await response.json();
        const helpData = await helpResponse.json();
        if (cancelled) return;

        const fetchedRecords = Array.isArray(data) ? data : data?.data || [];
        const fetchedHelpSummary = Array.isArray(helpData) ? helpData : [];
        const attendanceCacheStatus =
          response.headers.get("X-Data-Cache") || "";
        if (
          !incremental &&
          versionRecordCount > 0 &&
          fetchedRecords.length < versionRecordCount &&
          attendanceCacheStatus.toUpperCase().includes("STALE")
        ) {
          throw new Error(
            `Man-Hour cache is incomplete (${fetchedRecords.length.toLocaleString()}/${versionRecordCount.toLocaleString()} records). Please refresh again after the server finishes loading.`,
          );
        }
        const changedDateSet = new Set(changedDates);
        const records = incremental
          ? [
            ...cached.records.filter(
              (record) =>
                !changedDateSet.has(
                  extractDatePart(record.dlh_effective_date_time),
                ),
            ),
            ...fetchedRecords,
          ]
          : fetchedRecords;
        const helpSummary = incremental
          ? [
            ...cached.helpSummary.filter(
              (item) => !changedDateSet.has(extractDatePart(item.date)),
            ),
            ...fetchedHelpSummary,
          ]
          : fetchedHelpSummary;
        const calWorkingKeys = new Set(
          Object.values(manhourCalendar || {})
            .filter((item: any) => Number(item?.manhour) !== 0 && item?.date)
            .map((item: any) => String(item.date).slice(0, 10))
        );
        let nextSpreadsheetData;
        if (incremental) {
          const changedDayData = applyDirectHelpSummary(
            await buildSpreadsheetOffMainThread(fetchedRecords, calWorkingKeys), // คำนวณตาราง Man-Hour สำหรับข้อมูลวันที่เปลี่ยนแปลง
            fetchedHelpSummary,
          );
          if (cancelled) return;
          nextSpreadsheetData = Object.fromEntries(
            Object.entries(cached.spreadsheetData).map(
              ([lineName, dayMap]: [string, any]) => [
                lineName,
                {
                  ...dayMap,
                  ...Object.fromEntries(
                    changedDates.map((date) => {
                      const day = Number(String(date).slice(8, 10));
                      return [ // ดึงเลขวันจาก YYYY-MM-DD
                        day,
                        changedDayData[lineName]?.[day] || EMPTY_DAY_INPUT,
                      ];
                    }),
                  ),
                },
              ],
            ),
          );
        } else {
          const aggregated = await buildSpreadsheetOffMainThread(records, calWorkingKeys);
          if (cancelled) return;
          nextSpreadsheetData = applyDirectHelpSummary(aggregated, helpSummary);
        }
        const enrichedNext = enrichSpreadsheetWithCustomLines(nextSpreadsheetData);
        setSpreadsheetData(enrichedNext);
        saveSpreadsheetSummary(month, enrichedNext);
        rawAttendanceCacheRef.current = records;
        setManhourRecords(records); // บันทึกข้อมูลเพื่อใช้คำนวณกราฟแยกตามสถานะพนักงาน
        const attendanceCalendar = {};
        records.forEach((record) => {
          const date = extractDatePart(record.dlh_effective_date_time);
          const day = Number(date.slice(8, 10));
          if (!day) return;
          const status = String(record.work_day_status || "")
            .trim()
            .toUpperCase();
          const manhour = status === "H" || status === "HOLIDAY" ? 0 : 1;
          const current = attendanceCalendar[day];
          attendanceCalendar[day] = {
            date,
            result: manhour === 0 ? "Holiday" : current?.result || "",
            manhour: current?.manhour === 0 ? 0 : manhour,
          };
        });
        await setBrowserCache(cacheKey, {
          aggregationVersion: MANHOUR_AGGREGATION_VERSION,
          month: currentMonth,
          dayVersions: currentDayVersions,
          spreadsheetData: nextSpreadsheetData,
          attendanceCalendar,
          records,
          helpSummary,
        });
        if (incremental) {
          triggerToast(
            `Update working hours information as of ${changedDates.map((date) => Number(date.slice(8, 10))).join(", ")} แล้ว`,
          );
        } else {
          triggerToast(
            `✅ Successfully loaded man-hour data from the API. (${records.length.toLocaleString()} list)`,
          );
        }
      } catch (err) {
        if (cancelled) return;
        console.error("🚨 Failed to load man-hour data from API:", err);
        setManhourError(err.message || "Unknown error");
        triggerToast(
          "⚠️ Failed to load data from the API. Please check the server connection.",
        );
      } finally {
        refreshInFlight = false;
        if (!cancelled) {
          setIsLoadingManhour(false);
          setIsGraphReady(true);
        }
      }
    }

    loadManhourData();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") loadManhourData();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [manhourRefreshToken, selectedMonth]);

  useManhourServerEvents({
    endpoint: MANHOUR_API_ENDPOINT,
    pendingDatesRef: pendingEventRefreshDates,
    requestRefresh: setManhourRefreshToken,
  });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsGraphReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadManhourCalendar() {
      try {
        const month = selectedMonth;
        // ดึงจากแคชขึ้นมาแสดงผลก่อนทันทีเพื่อไม่ให้ขึ้น 1 ล้วน
        try {
          const cachedCal = JSON.parse(localStorage.getItem(`${MANHOUR_CALENDAR_CACHE_PREFIX}${month}`) || "null");
          if (cachedCal && Object.keys(cachedCal).length > 0) {
            setManhourCalendar(cachedCal);
          }
        } catch {}

        const response = await fetch(
          `${MANHOUR_CALENDAR_ENDPOINT}?month=${month}`,
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (cancelled) return;
        const calendarRows = Array.isArray(data) ? data : [];
        const calMap = Object.fromEntries(
          calendarRows.map((item) => [
            Number(String(item.date).slice(8, 10)),
            item,
          ]),
        );
        setManhourCalendar(calMap);
        saveManhourCalendarCache(month, calMap);
      } catch (error) {
        if (!cancelled)
          console.error("Failed to load Man-Hour calendar:", error);
      }
    }

    loadManhourCalendar();
    return () => {
      cancelled = true;
    };
  }, [manhourRefreshToken, selectedMonth]);

  useEffect(() => {
    const handleLineMappingUpdate = () => {
      setLineMappingRevision((v) => v + 1);
      // ล้าง local fast cache ของเดือนปัจจุบันเพื่อให้ดึงและคำนวณใหม่เสมอ ไม่ค้างค่าผลรวมสูตรเดิม
      try {
        localStorage.removeItem(`${MANHOUR_FAST_CACHE_PREFIX}${selectedMonth}`);
        localStorage.removeItem(`${MANHOUR_CACHE_PREFIX}${selectedMonth}`);
        removeBrowserCache(`${MANHOUR_CACHE_PREFIX}${selectedMonth}`).catch(() => {});
      } catch {}

      // ทริกเกอร์ให้ดึงข้อมูล summary ล่าสุดจาก Backend ทันที
      setManhourRefreshToken((token) => token + 1);

      const currentMappings = getRuntimeMappings();
      // คำนวณตารางข้อมูล Man-Hour ใหม่อัตโนมัติเมื่อมีการเปลี่ยนแปลง Mapping ไลน์การผลิต
      if (rawAttendanceCacheRef.current.length > 0) {
        buildSpreadsheetOffMainThread(rawAttendanceCacheRef.current)
          .then((data) => {
            const enriched = enrichSpreadsheetWithCustomLines(data, currentMappings);
            setSpreadsheetData(enriched);
            saveSpreadsheetSummary(selectedMonth, enriched);
          })
          .catch(() => { });
      }
    };
    window.addEventListener("manhour-line-mappings-updated", handleLineMappingUpdate);
    return () => {
      window.removeEventListener("manhour-line-mappings-updated", handleLineMappingUpdate);
    };
  }, [selectedMonth]);

  const getDisplayLinesForTab = (tab) =>
    getRuntimeTabLines(tab).filter((lineName) => {
      const members = MACRO_PCN_GROUPS[lineName] ||
        LINE_GROUPS[lineName] || [lineName];
      const baseLines = new Set(
        members
          .map((member) =>
            String(member)
              .trim()
              .replace(/\/[ABD]\s*$/i, "")
              .trim()
              .toUpperCase(),
          )
          .filter(Boolean),
      );
      const isMajorLine = baseLines.size > 2 || /VDS/i.test(lineName);
      const isMinorLine = /\/[ABD]\s*$/i.test(lineName);
      return graphLineLevel === "minor" ? isMinorLine : isMajorLine;
    });

  const handleTabChange = (tab) => {
    const displayLines = getDisplayLinesForTab(tab);
    setActiveTab(tab);
    setSearchTerm("");
    const tabLines = getRuntimeTabLines(tab);
    const firstLine = displayLines[0] || tabLines[0] || "";
    setSelectedLine(firstLine);
    setSelectedGraphLines(firstLine ? [firstLine] : []);
  };

  const filteredLines = useMemo(() => {
    const currentTabLines = getRuntimeTabLines(activeTab);
    if (!searchTerm) return currentTabLines;

    const allTabsLines = Object.keys(TAB_LINES).flatMap((t) => getRuntimeTabLines(t));
    const allLines = [...new Set(allTabsLines)];
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return allLines.filter((line) =>
      line.toLowerCase().includes(normalizedSearch),
    );
  }, [activeTab, searchTerm, lineMappingRevision]);

  // แยกกลุ่มไลน์ที่กรองแล้วออกเป็น "แบบรวมคน" และ "ไลน์ย่อย"
  const { summaryLines, subLines, shiftLines } = useMemo(
    () => partitionLines(filteredLines, activeTab),
    [filteredLines, activeTab]
  );

  const handleLineChange = (lineName) => {
    const targetTab = Object.keys(TAB_LINES).find((tab) =>
      getRuntimeTabLines(tab).includes(lineName),
    );
    if (targetTab) setActiveTab(targetTab);
    setSelectedLine(lineName);
    setGraphScope("single");
    setSelectedGraphLines([lineName]);
    setSearchTerm("");
  };

  const handleGraphLineChange = (options) => {
    const nextLines = options.map((option) => option.value);
    setSelectedGraphLines(nextLines);

    if (nextLines.length === 1) setSelectedLine(nextLines[0]);
  };

  const handleLineSearch = (value) => {
    setSearchTerm(value);

    const normalizedSearch = value.trim().toLowerCase();
    if (!normalizedSearch) return;

    // 1. ลองหาแบบตรงตัวเป๊ะ (Exact match) ก่อน
    let matchedTab = Object.keys(TAB_LINES).find((tab) =>
      getRuntimeTabLines(tab).some((lineName) => lineName.toLowerCase() === normalizedSearch),
    );
    let matchedLine = matchedTab
      ? getRuntimeTabLines(matchedTab).find((lineName) => lineName.toLowerCase() === normalizedSearch)
      : undefined;

    // 2. ถ้ายังไม่เจอ ให้หาแบบ Partial match (ขึ้นต้นด้วยคำค้นหา หรือมีคำค้นหา)
    if (!matchedLine) {
      // ค้นหาใน tab ปัจจุบันก่อน
      const currentTabLines = getRuntimeTabLines(activeTab);
      const inCurrentTab = currentTabLines.find((ln) => ln.toLowerCase().startsWith(normalizedSearch)) ||
        currentTabLines.find((ln) => ln.toLowerCase().includes(normalizedSearch));

      if (inCurrentTab) {
        matchedTab = activeTab;
        matchedLine = inCurrentTab;
      } else {
        // ค้นหาข้ามทุกแท็บ
        for (const tab of Object.keys(TAB_LINES)) {
          const tabLines = getRuntimeTabLines(tab);
          const found = tabLines.find((ln) => ln.toLowerCase().startsWith(normalizedSearch)) ||
            tabLines.find((ln) => ln.toLowerCase().includes(normalizedSearch));
          if (found) {
            matchedTab = tab;
            matchedLine = found;
            break;
          }
        }
      }
    }

    if (matchedTab && matchedLine) {
      if (matchedTab !== activeTab) {
        setActiveTab(matchedTab);
      }
      setSelectedLine(matchedLine);
      setGraphScope("single");
      setSelectedGraphLines([matchedLine]);
    }
  };

  const graphLines = useMemo(() => {
    return getRuntimeTabLines(activeTab);
  }, [activeTab, lineMappingRevision]);

  const graphDisplayLines = useMemo(() => {
    return getDisplayLinesForTab(activeTab);
  }, [graphLineLevel, graphLines, lineMappingRevision]);

  const graphLineOptions = useMemo(() => {
    return graphLines.map((lineName) => ({
      value: lineName,
      label: isAggregateLine(lineName, activeTab)
        ? `[Master] ${lineName}`
        : lineName,
    }));
  }, [graphLines, activeTab]);

  useEffect(() => {
    const list = graphLines;
    setSelectedGraphLines((current) => {
      const validLines = current.filter((line) => list.includes(line));
      const next =
        validLines.length > 0 ? validLines : list[0] ? [list[0]] : [];
      return next.length === current.length &&
        next.every((line, index) => line === current[index])
        ? current
        : next;
    });
  }, [graphLines]);

  const currentLineData = useMemo(() => {
    const rawData =
      selectedStatuses.length > 0
        ? statusFilteredSpreadsheetData || spreadsheetData
        : spreadsheetData;
    const displayData = enrichSpreadsheetWithCustomLines(rawData);
    return displayData[selectedLine] || createZeroLineData();
  }, [
    spreadsheetData,
    statusFilteredSpreadsheetData,
    selectedLine,
    selectedStatuses,
    lineMappingRevision,
  ]);

  const handleCellValueChange = (day, field, val) => {
    const num = val === "" ? 0 : parseInt(val, 10) || 0;
    setSpreadsheetData((prev) => ({
      ...prev,
      [selectedLine]: {
        ...prev[selectedLine],
        [day]: {
          ...prev[selectedLine][day],
          [field]: num,
        },
      },
    }));
  };

  const displayInputValue = (day, field) => {
    if (field === 'notWorking') {
      const isNonWorkingDay = Number(manhourCalendar[day]?.manhour) === 0;
      if (isNonWorkingDay) return '';
    }
    const item = currentLineData[day] || {};
    const value = Number(item[field]) || 0;
    return value === 0 ? "" : value;
  };

  const displayCalculatedValue = (day, value) => {
    return (Number(value) || 0) === 0 ? "-" : value;
  };

  const calculatedRows = useMemo(() => {
    return buildCalculatedRows(currentLineData, manhourCalendar);
  }, [currentLineData, manhourCalendar]);

  const rowSums = useMemo(() => {
    const sums = {
      r1: 0,
      r2: 0,
      r3: 0,
      r4: 0,
      r5: 0,
      r6: 0,
      r7: 0,
      r8: 0,
      r9: 0,
      r10: 0,
      r11: 0,
      r12: 0,
      r13: 0,
      r14: 0,
      r15: 0,
      r16: 0,
      r17: 0,
      r18: 0,
      r19: 0,
      r20: 0,
      r21: 0,
      r22: 0,
      r23: 0,
    };

    let holidayRegisterSum = 0;
    DAYS_ARRAY.forEach((day) => {
      const isNonWorkingDay = Number(manhourCalendar[day]?.manhour) === 0;
      const r = calculatedRows[day];
      if (!isNonWorkingDay) {
        (sums.r1 as number) += r.r1;
        (sums.r7 as number) += r.r7;
        (sums.r17 as number) += (r.r17 || 0);
      } else {
        holidayRegisterSum += Number(r.r1) || 0;
      }
      (sums.r2 as number) += r.r2;
      (sums.r3 as number) += r.r3;
      (sums.r4 as number) += r.r4;
      (sums.r5 as number) += r.r5;
      (sums.r6 as number) += r.r6;
      (sums.r8 as number) += r.r8;
      (sums.r9 as number) += r.r9;
      (sums.r10 as number) += r.r10;
      (sums.r11 as number) += r.r11;
      (sums.r12 as number) += r.r12;
      (sums.r13 as number) += r.r13;
      (sums.r14 as number) += (r.r14 || 0);
      (sums.r15 as number) += r.r15;
      (sums.r16 as number) += r.r16;
      (sums.r18 as number) += r.r18;
      (sums.r19 as number) += (r.r17 || 0) + r.r18;
      (sums.r20 as number) += r.r20;
    });

    sums.r21 =
      (sums.r1 as number) > 0 ? (((sums.r3 as number) / (sums.r1 as number)) * 100).toFixed(1) + "%" : "#DIV/0!";
    sums.r22 =
      (sums.r1 as number) > 0 ? (((sums.r8 as number) / (sums.r1 as number)) * 100).toFixed(1) + "%" : "#DIV/0!";
    sums.r23 =
      holidayRegisterSum > 0
        ? (((sums.r11 as number) / holidayRegisterSum) * 100).toFixed(1) + "%"
        : (sums.r1 as number) > 0
          ? (((sums.r11 as number) / (sums.r1 as number)) * 100).toFixed(1) + "%"
          : "#DIV/0!";

    return sums;
  }, [calculatedRows, manhourCalendar]);

  /**
   * Helper สำหรับเตรียม SingleLineExportData จากชื่อไลน์ที่ระบุ
   */
  const prepareLineExportData = (lineName: string) => {
    const rawData =
      selectedStatuses.length > 0
        ? statusFilteredSpreadsheetData || spreadsheetData
        : spreadsheetData;
    const displayData = enrichSpreadsheetWithCustomLines(rawData);
    const lineData = displayData[lineName] || createZeroLineData();
    const cRows = buildCalculatedRows(lineData, manhourCalendar);

    const sums: Record<string, number | string> = {
      r1: 0, r2: 0, r3: 0, r4: 0, r5: 0, r6: 0, r7: 0, r8: 0, r9: 0, r10: 0,
      r11: 0, r12: 0, r13: 0, r14: 0, r15: 0, r16: 0, r17: 0, r18: 0, r19: 0, r20: 0,
      r21: 0, r22: 0, r23: 0,
    };

    DAYS_ARRAY.forEach((day) => {
      const isNonWorkingDay = Number(manhourCalendar[day]?.manhour) === 0;
      const r = cRows[day];
      if (!isNonWorkingDay) {
        (sums.r1 as number) += r.r1;
        (sums.r7 as number) += r.r7;
        (sums.r17 as number) += (r.r17 || 0);
      }
      (sums.r2 as number) += r.r2;
      (sums.r3 as number) += r.r3;
      (sums.r4 as number) += r.r4;
      (sums.r5 as number) += r.r5;
      (sums.r6 as number) += r.r6;
      (sums.r8 as number) += r.r8;
      (sums.r9 as number) += r.r9;
      (sums.r10 as number) += r.r10;
      (sums.r11 as number) += r.r11;
      (sums.r12 as number) += r.r12;
      (sums.r13 as number) += r.r13;
      (sums.r14 as number) += (r.r14 || 0);
      (sums.r15 as number) += r.r15;
      (sums.r16 as number) += r.r16;
      (sums.r18 as number) += r.r18;
      (sums.r19 as number) += (r.r17 || 0) + r.r18;
      (sums.r20 as number) += r.r20;
    });

    sums.r21 =
      (sums.r1 as number) > 0 ? (((sums.r3 as number) / (sums.r1 as number)) * 100).toFixed(1) + "%" : "#DIV/0!";
    sums.r22 =
      (sums.r1 as number) > 0 ? (((sums.r8 as number) / (sums.r1 as number)) * 100).toFixed(1) + "%" : "#DIV/0!";
    sums.r23 =
      (sums.r1 as number) > 0 ? (((sums.r11 as number) / (sums.r1 as number)) * 100).toFixed(1) + "%" : "#DIV/0!";

    return {
      lineName,
      rowSums: sums,
      calculatedRows: cRows,
      displayInputValue: (day: number, field: string) => {
        const item = lineData[day] || {};
        const value = Number(item[field]) || 0;
        return value === 0 ? "" : value;
      },
      displayCalculatedValue: (day: number, value: any) => {
        return (Number(value) || 0) === 0 ? "-" : value;
      },
    };
  };

  /**
   * ส่งออกเฉพาะไลน์ปัจจุบัน
   */
  const handleExportCurrentLine = (lineToExport = selectedLine) => {
    const data = prepareLineExportData(lineToExport);
    exportManHourMatrixExcel({
      selectedLine: data.lineName,
      selectedMonth,
      displayDays,
      manhourCalendar,
      rowSums: data.rowSums,
      calculatedRows: data.calculatedRows,
      displayInputValue: data.displayInputValue,
      displayCalculatedValue: data.displayCalculatedValue,
    });
  };

  /**
   * ส่งออกทุกไลน์ในแท็บปัจจุบัน แบบต่อกันในหน้าเดียว (Single Sheet Stacked)
   * ตามคำขอ: รวมต่อกันลงมาในหน้าเดียว ไม่ต้องแยกแต่ละหน้าของ Excel
   */
  const handleExportStackedTabLines = (tabName = activeTab) => {
    const lines = getRuntimeTabLines(tabName);
    if (!lines || lines.length === 0) return;
    const linesData = lines.map((l) => prepareLineExportData(l));
    exportStackedManHourMatrixExcel({
      selectedMonth,
      fileNamePrefix: `ManHour_${tabName.replace(/\s+/g, '_')}_Continuous`,
      sheetName: tabName.slice(0, 31),
      displayDays,
      manhourCalendar,
      linesData,
    });
  };

  /**
   * ส่งออกทุกไลน์ในแท็บปัจจุบัน แบบแยกเป็นหลายแผ่นงาน (Multi-Sheet)
   */
  const handleExportTabLines = (tabName = activeTab) => {
    const lines = getRuntimeTabLines(tabName);
    if (!lines || lines.length === 0) return;
    const linesData = lines.map((l) => prepareLineExportData(l));
    exportAllManHourMatrixExcel({
      selectedMonth,
      fileNamePrefix: `ManHour_${tabName.replace(/\s+/g, '_')}_AllLines`,
      displayDays,
      manhourCalendar,
      linesData,
    });
  };

  /**
   * ส่งออกทุกแท็บในระบบ แยกเป็น 5 แผ่นงานตามแท็บ (Macro PCN, FPC, SMT, QA, IND)
   * โดยในแต่ละแท็บ นำทุกไลน์มาต่อกันลงมาในหน้าเดียว (เว้น 3 ช่อง)
   */
  const handleExportStackedAllTabs = () => {
    const tabsData = tabMenuList.map((tab) => {
      const lines = getRuntimeTabLines(tab) || [];
      const linesData = lines.map((l) => prepareLineExportData(l));
      return {
        tabName: tab,
        linesData,
      };
    });

    exportTabsStackedManHourMatrixExcel({
      selectedMonth,
      fileNamePrefix: `ManHour_All_5Tabs`,
      displayDays,
      manhourCalendar,
      tabsData,
    });
  };

  /**
   * ส่งออกทุกแท็บ ทุกไลน์ในระบบ แบบแยก Sheet (Macro PCN, FPC, SMT, QA, IND)
   */
  const handleExportAllTabs = () => {
    const allLinesSeen = new Set<string>();
    const orderedLines: string[] = [];

    tabMenuList.forEach((tab) => {
      const lines = getRuntimeTabLines(tab);
      lines.forEach((l) => {
        if (!allLinesSeen.has(l)) {
          allLinesSeen.add(l);
          orderedLines.push(l);
        }
      });
    });

    if (orderedLines.length === 0) return;
    const linesData = orderedLines.map((l) => prepareLineExportData(l));
    exportAllManHourMatrixExcel({
      selectedMonth,
      fileNamePrefix: `ManHour_All_Tabs_Complete`,
      displayDays,
      manhourCalendar,
      linesData,
    });
  };

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const graphOptions = useMemo(() => {
    return GRAPH_OPTIONS.filter((option) => option.group === graphGroup);
  }, [graphGroup]);

  const selectedGraphOption = useMemo(() => {
    return (
      GRAPH_OPTIONS.find((option) => option.key === graphMetric) ||
      GRAPH_OPTIONS.find((option) => option.key === "totalHour")
    );
  }, [graphMetric]);

  const statusTabs = [
    { status: "PER", count: 0 },
    { status: "VDS", count: 0 },
    { status: "PIMB", count: 0 },
    { status: "MOU", count: 0 },
    { status: "DC", count: 0 },
    { status: "Training Center", count: 0 },
  ];

  useEffect(() => {
    if (Object.keys(statusTooltipData || {}).length > 0) return;
    let cancelled = false;
    fetch(
      `${MANHOUR_SUMMARY_ENDPOINT}?month=${encodeURIComponent(selectedMonth)}`,
      { cache: "no-store" },
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled && payload?.statusTooltipData)
          setStatusTooltipData(payload.statusTooltipData);
      })
      .catch((error) => console.error("Unable to load status summary:", error));
    return () => {
      cancelled = true;
    };
  }, [selectedMonth, statusTooltipData]);

  useEffect(() => {
    if (selectedStatuses.length === 0 || manhourRecords.length > 0) return;
    if (rawAttendanceCacheRef.current.length > 0) {
      setManhourRecords(rawAttendanceCacheRef.current);
      return;
    }
    let cancelled = false;
    fetch(
      `${MANHOUR_API_ENDPOINT}?month=${encodeURIComponent(selectedMonth)}`,
      { cache: "no-store" },
    )
      .then((response) => {
        if (!response.ok) throw new Error(`Attendance HTTP ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        const records = Array.isArray(payload) ? payload : payload?.data || [];
        rawAttendanceCacheRef.current = records;
        setManhourRecords(records);
      })
      .catch((error) => console.error("Unable to load Status details:", error));
    return () => {
      cancelled = true;
    };
  }, [selectedStatuses, manhourRecords.length, selectedMonth]);

  const getTooltipStatusSummary = useMemo(() => {
    if (!statusTooltipData || Object.keys(statusTooltipData).length === 0) {
      return () => [];
    }
    const cacheKey = [
      "status-tooltip-v2",
      activeTab,
      graphScope,
      graphAxis,
      selectedStatuses.join("|"),
      selectedGraphLines.join("|"),
      graphDisplayLines.join("|"),
    ].join("::");
    const cachedSummary = tooltipStatusCache.current.get(cacheKey);
    if (cachedSummary)
      return (label: string | number) => cachedSummary.get(String(label)) || [];

    const selectedLines =
      graphScope === "single"
        ? selectedGraphLines
        : activeTab === "Macro PCN"
          ? []
          : TAB_LINES[activeTab] || [];
    const expandedSelectedLines = [
      ...new Set(
        selectedLines.flatMap(
          (lineName) =>
            MACRO_PCN_GROUPS[lineName] || LINE_GROUPS[lineName] || [lineName],
        ),
      ),
    ];
    const includeAllLines = graphScope === "all" && activeTab === "Macro PCN";
    const selectedStatusSet = new Set(selectedStatuses);
    const summaries = new Map<
      string,
      Map<string, { present: number; absent: number }>
    >();
    const lineLabels =
      graphScope === "single" ? selectedGraphLines : graphDisplayLines;
    const addLineSummary = (label: string, day: number, lineName?: string) => {
      if (!summaries.has(label)) summaries.set(label, new Map());
      const byStatus = summaries.get(label)!;
      const lineData = statusTooltipData[day] || {};
      Object.entries(lineData).forEach(
        ([sourceLine, statuses]: [string, any]) => {
          const isIncluded =
            includeAllLines ||
            (lineName
              ? (
                MACRO_PCN_GROUPS[lineName] ||
                LINE_GROUPS[lineName] || [lineName]
              ).some((member) =>
                isRecordMatchingLine({ line_check: sourceLine }, member),
              )
              : expandedSelectedLines.some((member) =>
                isRecordMatchingLine({ line_check: sourceLine }, member),
              ));
          if (!isIncluded) return;
          Object.entries(statuses).forEach(
            ([status, values]: [string, any]) => {
              // กำหนดชื่อสถานะ VDS ตามกลุ่มไลน์ที่แสดง
              const normalizedStatus =
                status === "No status" ? "Training Center" : status;
              const displayStatus =
                lineName && isVdsLineName(lineName) ? "VDS" : normalizedStatus;
              if (
                selectedStatusSet.size > 0 &&
                !selectedStatusSet.has(displayStatus)
              )
                return;
              const summary = byStatus.get(displayStatus) || {
                present: 0,
                absent: 0,
              };
              summary.present += Number(values?.present) || 0;
              summary.absent += Number(values?.absent) || 0;
              byStatus.set(displayStatus, summary);
            },
          );
        },
      );
    };

    if (graphAxis === "line") {
      lineLabels.forEach((line) => addLineSummary(line, graphDay, line));
    } else if (graphAxis === "week") {
      WEEK_RANGES.forEach((week) =>
        week.days.forEach((day) => addLineSummary(week.label, day)),
      );
    } else {
      DAYS_ARRAY.forEach((day) => addLineSummary(String(day), day));
    }

    const normalized = new Map(
      [...summaries.entries()].map(([label, byStatus]) => [
        label,
        [...byStatus.entries()]
          .map(([status, employees]) => ({
            status,
            present: employees.present,
            absent: employees.absent,
            count: employees.present + employees.absent,
          }))
          .sort(
            (a, b) => b.count - a.count || a.status.localeCompare(b.status),
          ),
      ]),
    );
    if (tooltipStatusCache.current.size >= 80)
      tooltipStatusCache.current.clear();
    tooltipStatusCache.current.set(cacheKey, normalized);
    return (label: string | number) => normalized.get(String(label)) || [];
  }, [
    statusTooltipData,
    graphScope,
    selectedGraphLines,
    graphDisplayLines,
    activeTab,
    graphAxis,
    graphDay,
    selectedStatuses,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (selectedStatuses.length === 0) {
      setStatusFilteredSpreadsheetData(null);
      return undefined;
    }
    if (manhourRecords.length === 0) return undefined;

    const cacheKey = [...selectedStatuses].sort().join("|");
    const cachedStatusData = statusSpreadsheetCache.current.get(cacheKey);
    if (cachedStatusData) {
      setStatusFilteredSpreadsheetData(cachedStatusData);
      return undefined;
    }
    const selected = new Set(selectedStatuses);
    buildSpreadsheetOffMainThread(
      manhourRecords.filter((record: any) => {
        if (isOtherFactoryRecord(record)) return false;
        const status = getEffectiveRecordStatus(record);
        return selected.has(status);
      }),
    )
      .then((data) => {
        if (!cancelled) {
          statusSpreadsheetCache.current.set(cacheKey, data);
          setStatusFilteredSpreadsheetData(data);
        }
      })
      .catch((error) =>
        console.error("Unable to filter graph by status:", error),
      );

    return () => {
      cancelled = true;
    };
  }, [manhourRecords, selectedStatuses, graphGroup]);

  useEffect(() => {
    statusSpreadsheetCache.current.clear();
    tooltipStatusCache.current.clear();
    statusPersonsGraphCache.current.clear();
  }, [manhourRecords]);

  useEffect(() => {
    graphDataCache.current.clear();
  }, [spreadsheetData, statusFilteredSpreadsheetData]);

  const graphSpreadsheetData = useMemo(() => {
    const raw =
      selectedStatuses.length > 0
        ? statusFilteredSpreadsheetData || spreadsheetData
        : spreadsheetData;
    return enrichSpreadsheetWithCustomLines(raw);
  }, [
    selectedStatuses,
    statusFilteredSpreadsheetData,
    spreadsheetData,
    lineMappingRevision,
  ]);

  const statusPersonsGraphData = useMemo(() => {
    if (graphGroup !== "persons" || selectedStatuses.length !== 1) return null;
    const cacheKey = [
      selectedStatuses[0],
      graphAxis,
      graphDay,
      graphScope,
      activeTab,
      selectedGraphLines.join("|"),
      graphDisplayLines.join("|"),
      DAYS_ARRAY.map((day) => manhourCalendar[day]?.manhour ?? "").join(","),
    ].join("::");
    const cachedGraphData = statusPersonsGraphCache.current.get(cacheKey);
    if (cachedGraphData) return cachedGraphData;
    const status = selectedStatuses[0];
    if (graphAxis === "line") {
      const result = graphDisplayLines
        .map((label) => {
          if (isVdsLineName(label) ? status !== "VDS" : status === "VDS")
            return null;
          const people = {
            working: new Set<string>(),
            leave: new Set<string>(), // เก็บรายการรหัสพนักงานที่ขาด/ลา
            register: new Set<string>(),
          };
          const groupMembers = MACRO_PCN_GROUPS[label] ||
            LINE_GROUPS[label] || [label];
          manhourRecords.forEach((record: any, index: number) => {
            const day = Number(
              extractDatePart(record.dlh_effective_date_time).slice(8, 10),
            );
            if (
              day !== graphDay ||
              isOtherFactoryRecord(record) ||
              !groupMembers.some((line) => isRecordMatchingLine(record, line))
            )
              return;
            const recordStatus = isVdsLineName(label)
              ? "VDS"
              : getEffectiveRecordStatus(record);
            if (recordStatus !== status) return;
            const id = String(record.dlh_employee_id || `row-${index}`);
            people.register.add(id);
            if (shouldCountAsPresent(record)) people.working.add(id);
            if (
              shouldCountAsAbsent(
                record,
                Number(manhourCalendar[day]?.manhour) !== 0,
              )
            )
              people.leave.add(id);
          });
          const working = people.working.size;
          const leave = people.leave.size;
          return {
            label,
            working: working || null,
            leave: leave || null,
            leaveRate: people.register.size
              ? Number(((leave / people.register.size) * 100).toFixed(1))
              : 0,
          };
        })
        .filter((point) => point && (point.working || point.leave));
      if (statusPersonsGraphCache.current.size >= 80)
        statusPersonsGraphCache.current.clear();
      statusPersonsGraphCache.current.set(cacheKey, result);
      return result;
    }
    if (graphScope === "single" && selectedGraphLines.length > 1) {
      const periods =
        graphAxis === "week"
          ? WEEK_RANGES.map((week) => ({ label: week.label, days: week.days }))
          : DAYS_ARRAY.map((day) => ({ label: String(day), days: [day] }));
      const result = periods
        .map(({ label, days }) => {
          const totals = { label, working: 0, leave: 0 } as Record<
            string,
            number | string | null
          >;
          selectedGraphLines.forEach((lineName, lineIndex) => {
            const groupMembers = MACRO_PCN_GROUPS[lineName] ||
              LINE_GROUPS[lineName] || [lineName];
            const people = days.reduce(
              (sum, day) => {
                Object.entries(statusTooltipData?.[day] || {}).forEach(
                  ([sourceLine, statuses]: [string, any]) => {
                    if (
                      !groupMembers.some((line) =>
                        isRecordMatchingLine({ line_check: sourceLine }, line),
                      )
                    )
                      return;
                    Object.entries(statuses).forEach(
                      ([sourceStatus, values]: [string, any]) => {
                        const recordStatus = isVdsLineName(lineName)
                          ? "VDS"
                          : sourceStatus === "No status"
                            ? "Training Center"
                            : sourceStatus;
                        if (recordStatus !== status) return;
                        sum.working += Number(values?.present) || 0;
                        sum.leave += Number(values?.absent) || 0;
                      },
                    );
                  },
                );
                return sum;
              },
              { working: 0, leave: 0 },
            );
            const working = people.working;
            const leave = people.leave;
            totals.working = Number(totals.working) + working;
            totals.leave = Number(totals.leave) + leave;
            totals[`workingLine${lineIndex}`] = working || null;
          });
          const totalPeople = Number(totals.working) + Number(totals.leave);
          return {
            ...totals,
            working: totals.working || null,
            leave: totals.leave || null,
            leaveRate: totalPeople
              ? Number(((Number(totals.leave) / totalPeople) * 100).toFixed(1))
              : 0,
          };
        })
        .filter((point) => point.working || point.leave);
      if (statusPersonsGraphCache.current.size >= 80)
        statusPersonsGraphCache.current.clear();
      statusPersonsGraphCache.current.set(cacheKey, result);
      return result;
    }
    const labels =
      graphAxis === "week"
        ? WEEK_RANGES.map((item) => item.label)
        : DAYS_ARRAY.map(String);
    const result = labels
      .map((label) => {
        const item = getTooltipStatusSummary(label).find(
          (summary) => summary.status === status,
        );
        const working = item?.present || 0;
        const leave = item?.absent || 0;
        return {
          label,
          working: working || null,
          leave: leave || null,
          leaveRate:
            working + leave > 0
              ? Number(((leave / (working + leave)) * 100).toFixed(1))
              : 0,
        };
      })
      .filter((point) => point.working || point.leave);
    if (statusPersonsGraphCache.current.size >= 80)
      statusPersonsGraphCache.current.clear();
    statusPersonsGraphCache.current.set(cacheKey, result);
    return result;
  }, [
    graphGroup,
    selectedStatuses,
    graphAxis,
    graphDay,
    graphDisplayLines,
    graphScope,
    selectedGraphLines,
    manhourRecords,
    manhourCalendar,
    statusTooltipData,
    getTooltipStatusSummary,
  ]);

  const graphData = useMemo(() => {
    if (statusPersonsGraphData) return statusPersonsGraphData;
    if (!selectedGraphOption || !graphSpreadsheetData) return [];
    const cacheKey = [
      activeTab,
      graphScope,
      graphGroup,
      graphAxis,
      graphDay,
      selectedGraphOption.key,
      selectedGraphLines.join("|"),
      graphDisplayLines.join("|"),
      selectedStatuses.join("|"),
    ].join("::");
    const cachedGraphData = graphDataCache.current.get(cacheKey);
    if (cachedGraphData) return cachedGraphData;
    const finish = (result) => {
      if (graphDataCache.current.size >= 120) graphDataCache.current.clear();
      graphDataCache.current.set(cacheKey, result);
      return result;
    };
    const sourceRows =
      graphScope === "single"
        ? buildCalculatedRows(
          buildLinesInputData(graphSpreadsheetData, selectedGraphLines),
          manhourCalendar,
        )
        : buildCalculatedRows(
          buildTabInputData(graphSpreadsheetData, activeTab),
          manhourCalendar,
        );

    const makePersonsPoint = (label, rows, days) => {
      const totals = days.reduce(
        (sum, day) => {
          const row = rows[day] || {};
          sum.register += Number(row.r1) || 0;
          sum.working += Number(row.r7) || 0;
          sum.leave += Number(row.r20) || 0;
          return sum;
        },
        { register: 0, working: 0, leave: 0 },
      );
      return {
        label,
        working: totals.working > 0 ? totals.working : null,
        leave: totals.leave > 0 ? totals.leave : null,
        leaveRate:
          totals.register > 0
            ? Number(((totals.leave / totals.register) * 100).toFixed(1))
            : 0,
      };
    };

    if (graphGroup === "persons") {
      const removeEmptyPersons = (points) =>
        points.filter(
          (point) =>
            Number(point.working || 0) > 0 || Number(point.leave || 0) > 0,
        );
      if (
        graphScope === "single" &&
        selectedGraphLines.length > 1 &&
        graphAxis !== "line"
      ) {
        const periods =
          graphAxis === "week"
            ? WEEK_RANGES.map((week) => ({
              label: week.label,
              days: week.days,
            }))
            : DAYS_ARRAY.map((day) => ({ label: String(day), days: [day] }));
        return finish(
          removeEmptyPersons(
            periods.map(({ label, days }) => {
              const totals = {
                label,
                working: 0,
                leave: 0,
                register: 0,
              } as Record<string, number | string | null>;
              selectedGraphLines.forEach((lineName, index) => {
                const point = makePersonsPoint(
                  label,
                  buildCalculatedRows(
                    graphSpreadsheetData[lineName] || createZeroLineData(),
                    manhourCalendar,
                  ),
                  days,
                );
                const working = Number(point.working) || 0;
                totals.working = Number(totals.working) + working;
                totals.leave =
                  Number(totals.leave) + (Number(point.leave) || 0);
                totals.register =
                  Number(totals.register) +
                  days.reduce(
                    (count, day) =>
                      count +
                      (Number(graphSpreadsheetData[lineName]?.[day]?.r1) || 0),
                    0,
                  );
                totals[`workingLine${index}`] = working || null;
              });
              return {
                ...totals,
                working: totals.working || null,
                leave: totals.leave || null,
                leaveRate:
                  Number(totals.working) + Number(totals.leave)
                    ? Number(
                      (
                        (Number(totals.leave) /
                          (Number(totals.working) + Number(totals.leave))) *
                        100
                      ).toFixed(1),
                    )
                    : 0,
              };
            }),
          ),
        );
      }
      if (graphAxis === "week") {
        return finish(
          removeEmptyPersons(
            WEEK_RANGES.map((week) =>
              makePersonsPoint(week.label, sourceRows, week.days),
            ),
          ),
        );
      }
      if (graphAxis === "line") {
        if (graphScope === "single")
          return finish(
            removeEmptyPersons(
              selectedGraphLines.map((lineName) => {
                const rows = buildCalculatedRows(
                  graphSpreadsheetData[lineName] || createZeroLineData(),
                  manhourCalendar,
                );
                return makePersonsPoint(lineName, rows, [graphDay]);
              }),
            ),
          );
        return finish(
          removeEmptyPersons(
            graphDisplayLines.map((lineName) => {
              const rows = buildCalculatedRows(
                graphSpreadsheetData[lineName] || createZeroLineData(),
                manhourCalendar,
              );
              return makePersonsPoint(lineName, rows, [graphDay]);
            }),
          ),
        );
      }
      return finish(
        removeEmptyPersons(
          DAYS_ARRAY.map((day) =>
            makePersonsPoint(String(day), sourceRows, [day]),
          ),
        ),
      );
    }

    if (graphAxis === "week") {
      return finish(
        WEEK_RANGES.map((week) => ({
          label: week.label,
          value: getGraphMetricValueForDays(
            sourceRows,
            selectedGraphOption.rowKey,
            week.days,
          ),
        })),
      );
    }

    if (graphAxis === "line") {
      if (graphScope === "single") {
        return finish(
          selectedGraphLines.map((lineName) => {
            const rows = buildCalculatedRows(
              graphSpreadsheetData[lineName] || createZeroLineData(),
              manhourCalendar,
            );
            const rawValue = rows[graphDay]?.[selectedGraphOption.rowKey];
            const value =
              typeof rawValue === "string"
                ? Number.parseFloat(rawValue) || 0
                : Number(rawValue) || 0;
            return { label: lineName, value };
          }),
        );
      }

      return finish(
        graphDisplayLines.map((lineName) => {
          const rows = buildCalculatedRows(
            graphSpreadsheetData[lineName] || createZeroLineData(),
            manhourCalendar,
          );
          const rawValue = rows[graphDay]?.[selectedGraphOption.rowKey];
          const value =
            typeof rawValue === "string"
              ? Number.parseFloat(rawValue) || 0
              : Number(rawValue) || 0;
          return {
            label: lineName,
            value,
          };
        }),
      );
    }

    return finish(
      DAYS_ARRAY.map((day) => {
        const rawValue = sourceRows[day]?.[selectedGraphOption.rowKey];
        const value =
          typeof rawValue === "string"
            ? Number.parseFloat(rawValue) || 0
            : Number(rawValue) || 0;
        return {
          label: String(day),
          value,
        };
      }),
    );
  }, [
    activeTab,
    graphAxis,
    graphDay,
    graphDisplayLines,
    graphGroup,
    graphScope,
    selectedGraphLines,
    selectedGraphOption,
    graphSpreadsheetData,
    statusPersonsGraphData,
  ]);

  const isSplitWorkingByLine =
    graphGroup === "persons" &&
    graphScope === "single" &&
    selectedGraphLines.length > 1 &&
    graphAxis !== "line";

  const displayedGraphData = useMemo(() => {
    if (graphGroup !== "persons" || graphData.length === 0) return graphData;
    const largestTotal = Math.max(
      ...graphData.map(
        (point) => Number(point.working || 0) + Number(point.leave || 0),
      ),
      1,
    );
    const minimumVisibleValue = largestTotal * 0.06;
    return graphData.map((point) => {
      const day = graphAxis === "line" ? graphDay : Number(point.label);
      const isHoliday =
        (graphAxis === "date" || graphAxis === "line") &&
        Number(manhourCalendar[day]?.manhour) === 0;
      const splitWorkingDisplay = isSplitWorkingByLine
        ? Object.fromEntries(
          selectedGraphLines.map((_, index) => {
            const value = Number(point[`workingLine${index}`] || 0);
            return [
              `workingLine${index}Display`,
              value > 0 ? Math.max(value, minimumVisibleValue) : 0,
            ];
          }),
        )
        : {};
      return {
        ...point,
        ...splitWorkingDisplay,
        isHoliday,
        workingDisplay:
          Number(point.working || 0) > 0
            ? Math.max(Number(point.working), minimumVisibleValue)
            : 0,
        leave: isHoliday ? null : point.leave,
        leaveRate: isHoliday ? 0 : point.leaveRate,
        leaveDisplay:
          !isHoliday && Number(point.leave || 0) > 0
            ? Math.max(Number(point.leave), minimumVisibleValue)
            : 0,
      };
    });
  }, [
    graphData,
    graphGroup,
    graphAxis,
    isSplitWorkingByLine,
    manhourCalendar,
    selectedGraphLines,
  ]);

  const graphChartWidth = Math.max(
    900,
    displayedGraphData.length *
    (graphScope === "single" && graphAxis === "line"
      ? 320
      : graphAxis === "line"
        ? 80
        : graphAxis === "week"
          ? 160
          : 78),
  );

  const clearAllData = () => {
    const cleared = {};
    DAYS_ARRAY.forEach((day) => {
      cleared[day] = { ...EMPTY_DAY_INPUT };
    });
    setSpreadsheetData((prev) => ({
      ...prev,
      [selectedLine]: cleared,
    }));
    triggerToast("🧹 All input data for the production line has been cleared.");
  };

  return (
    <main role="main" aria-label="Manpower Dashboard" className="h-full w-full max-w-full min-w-0 bg-[#f8fafc] text-slate-800 font-sans antialiased flex flex-col overflow-hidden">
      {Boolean(clearAllData) && null}

      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-gradient-to-br from-blue-900 to-blue-500 border border-blue-100 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
          <p className="text-xs font-bold">{toastMessage}</p>
        </div>
      )}

      <ImportPreviewModal
        data={pendingImport}
        isImporting={isImporting}
        onChangeRow={updatePendingImportRow}
        onAddEmployee={addPendingImportRow}
        onDeleteRow={(index) =>
          setPendingImport((prev) => ({
            ...prev,
            rows: prev.rows.filter((_, rowIndex) => rowIndex !== index),
          }))
        }
        onDeleteRows={(indices) => {
          const selected = new Set(indices);
          setPendingImport((prev) => ({
            ...prev,
            rows: prev.rows.filter((_, rowIndex) => !selected.has(rowIndex)),
          }));
        }}
        onCancel={() => setPendingImport(null)}
        onConfirm={confirmManhourImport}
      />

      {deleteCandidates && (
        <DeleteAttendanceModal
          date={deleteDate}
          rows={deleteCandidates}
          isDeleting={isDeletingDay}
          onCancel={() => setDeleteCandidates(null)}
          onConfirm={confirmDeleteEmployees}
        />
      )}

      <ImportSummaryModal
        data={importSummary}
        onClose={() => setImportSummary(null)}
      />

      <DashboardHeader
        importMode={importMode}
        onImportModeChange={setImportMode}
        isImporting={isImporting}
        importFileRef={importFileRef}
        onImportFile={handleManhourImport}
        deleteDate={deleteDate}
        onDeleteDateChange={setDeleteDate}
        deleteMode={deleteMode}
        onDeleteModeChange={(mode) => {
          setDeleteMode(mode);
          setDeleteDate("");
        }}
        isDeletingDay={isDeletingDay}
        onDeleteDay={handleDeleteDay}
        availableMonths={availableMonths}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        onEditSaved={(date) => invalidateManhourCache([date])}
        onRefresh={() => {
          invalidateManhourCache();
        }}
        isLoading={isLoadingManhour}
      />

      <div className="shrink-0 w-full bg-white flex flex-wrap items-center justify-between shadow-sm border-b border-slate-200 px-2 sm:px-4">
        {/* แถบเลือก Tab Group */}
        <div className="flex overflow-x-auto">
          {tabMenuList.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`
                  px-5 sm:px-6 py-3 text-xs tracking-wider uppercase transition-all whitespace-nowrap flex items-center gap-2 font-black
                  ${isActive
                    ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white border-b-[3px] border-sky-300 shadow-sm"
                    : "text-slate-600 hover:bg-blue-50 hover:text-blue-700 border-b-[3px] border-transparent"
                  }
                `}
              >
                <span>{tab}</span>
              </button>
            );
          })}
        </div>

        {/* Enterprise Executive Navigation & Telemetry Mode Switcher */}
        <div className="my-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1 border border-slate-200/80 shadow-xs">

            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
                viewMode === "split"
                  ? "bg-white text-blue-700 shadow-sm border border-slate-200/60 font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
              title="Workspace (Graph & Grid Analysis)"
            >
              <LayoutGrid className={`h-3.5 w-3.5 ${viewMode === "split" ? "text-blue-600" : "text-slate-400"}`} />
              <span>Workspace Overview</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("matrix")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
                viewMode === "matrix"
                  ? "bg-white text-blue-700 shadow-sm border border-slate-200/60 font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
              title="Cross-Line Comparative Matrix"
            >
              <Building2 className={`h-3.5 w-3.5 ${viewMode === "matrix" ? "text-blue-600" : "text-slate-400"}`} />
              <span>Cross-Line Matrix</span>
            </button>

            {viewMode === "deepdive" && (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-black transition-all duration-200 bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-xs shadow-blue-500/20 border border-blue-400/30"
                title="Line Deep-Dive Telemetry"
              >
                <Sparkles className="h-3.5 w-3.5 text-sky-200" />
                <span>Deep-Dive: {selectedLine}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0 max-w-full overflow-y-auto overflow-x-hidden px-4 pt-3 pb-2 md:px-6 md:pt-3 md:pb-3 space-y-4">
        {/* 🌟 โหมดแสดงผล: Department Cross-Line Matrix */}
        {viewMode === "matrix" && (
          <DepartmentMatrixView
            activeTab={activeTab}
            selectedMonth={selectedMonth}
            tabLines={graphLines}
            spreadsheetData={spreadsheetData}
            displayDays={displayDays}
            manhourCalendar={manhourCalendar}
            onSelectLine={(lineName) => {
              setSelectedLine(lineName);
              setViewMode("deepdive");
            }}
            selectedLine={selectedLine}
            onExportTabLines={() => handleExportStackedTabLines(activeTab)}
            onExportAllTabs={handleExportStackedAllTabs}
          />
        )}

        {/* 🌟 โหมดแสดงผลใหม่: World-Class Precision Line Deep-Dive Cockpit */}
        {viewMode === "deepdive" && (
          <LineDeepDiveView
            selectedLine={selectedLine}
            activeTab={activeTab}
            selectedMonth={selectedMonth}
            displayDays={displayDays}
            spreadsheetData={spreadsheetData}
            manhourCalendar={manhourCalendar}
            tabLines={graphLines}
            onBackToMatrix={() => setViewMode("matrix")}
            onSelectLine={(lineName) => setSelectedLine(lineName)}
            onExportLine={() => handleExportCurrentLine(selectedLine)}
          />
        )}

        {/* กราฟ Manpower (แสดงเมื่อไม่ใช่โหมด table, matrix หรือ deepdive) */}
        {viewMode !== "table" && viewMode !== "matrix" && viewMode !== "deepdive" && (
        <section className="w-full max-w-full min-w-0 overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-5">
          <div className="flex flex-col gap-4">
            <div className="min-w-0 max-w-full xl:max-w-[560px]">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                {activeTab}
              </p>
              <div className="w-full min-w-0">
                <h2
                  className="w-full whitespace-nowrap text-lg md:text-xl font-black leading-tight text-slate-900"
                  title={
                    graphScope === "single"
                      ? selectedGraphLines.join(", ")
                      : undefined
                  }
                >
                  {graphScope === "single"
                    ? `${selectedGraphLines.length > 0 ? selectedGraphLines.join(", ") : "Select Line"} ${graphAxis === "line" ? `on Date ${graphDay}` : `by ${graphAxis === "week" ? "Week" : "Date"}`}`
                    : graphAxis === "line"
                      ? `All ${graphLineLevel === "major" ? "Major" : "Minor"} Lines on Date ${graphDay}`
                      : `All Lines by ${graphAxis === "week" ? "Week" : "Date"}`}
                </h2>
              </div>
            </div>

            <div className="flex w-full max-w-full flex-wrap items-center gap-2 overflow-visible">
              <div className="flex shrink-0 flex-nowrap bg-slate-100 p-1 rounded-xl border border-slate-200 justify-center">
                <button
                  onClick={() => setGraphScope("all")}
                  className={`inline-flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${graphScope === "all" ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                >
                  <GraphControlIcon name="all" />
                  All Lines
                </button>
                <button
                  onClick={() => setGraphScope("single")}
                  className={`inline-flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${graphScope === "single" ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                >
                  <GraphControlIcon name="select" />
                  Select Line
                </button>
              </div>

              {graphScope === "single" && (
                <div className="relative z-20 w-[320px] min-w-[240px] max-w-full">
                  <Select
                    isMulti
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    controlShouldRenderValue={false}
                    isSearchable
                    components={{ Option: ExtractedGraphLineOption }}
                    options={graphLineOptions}
                    value={graphLineOptions.filter((option) =>
                      selectedGraphLines.includes(option.value),
                    )}
                    onChange={handleGraphLineChange}
                    placeholder={
                      selectedGraphLines.length > 0
                        ? `${selectedGraphLines.length} Lines selected`
                        : "Select lines..."
                    }
                    noOptionsMessage={() => "No lines found"}
                    classNamePrefix="graph-line-select"
                    styles={{
                      control: (base) => ({
                        ...base,
                        minHeight: 36,
                        borderRadius: 12,
                        borderColor: "#e2e8f0",
                        backgroundColor: "#f1f5f9",
                        fontSize: 12,
                        fontWeight: 700,
                        boxShadow: "none",
                      }),
                      menu: (base) => ({
                        ...base,
                        zIndex: 50,
                        fontSize: 12,
                        fontWeight: 700,
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isSelected
                          ? "#eff6ff"
                          : state.isFocused
                            ? "#f8fafc"
                            : "#ffffff",
                        color: state.isSelected ? "#1d4ed8" : "#334155",
                        cursor: "pointer",
                      }),
                    }}
                  />
                </div>
              )}

              <div className="flex shrink-0 flex-nowrap bg-slate-100 p-1 rounded-xl border border-slate-200 justify-center">
                {GRAPH_AXIS_OPTIONS.map((option) => {
                  const isActive = graphAxis === option.key;
                  return (
                    <button
                      key={option.key}
                      onClick={() => setGraphAxis(option.key)}
                      className={`inline-flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${isActive ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      <GraphControlIcon
                        name={option.key as "date" | "week" | "line"}
                      />
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {graphAxis === "line" && (
                <>
                  <div className="flex shrink-0 flex-nowrap rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm justify-center">
                    <button
                      onClick={() => setGraphLineLevel("major")}
                      className={`inline-flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${graphLineLevel === "major" ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      <GraphControlIcon name="major" />
                      Major Lines
                    </button>
                    <button
                      onClick={() => setGraphLineLevel("minor")}
                      className={`inline-flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${graphLineLevel === "minor" ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      <GraphControlIcon name="minor" />
                      Minor Lines
                    </button>
                  </div>
                  <select
                    value={graphDay}
                    onChange={(e) => setGraphDay(Number(e.target.value))}
                    className="shrink-0 cursor-pointer rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-800 shadow-sm shadow-blue-100/70 outline-none transition hover:bg-blue-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {displayDays.map((day) => (
                      <option key={day} value={day}>
                        Date {day}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <select
                aria-label="Graph group"
                value={graphGroup}
                onChange={(event) => {
                  const nextGroup = event.target.value;
                  setGraphGroup(nextGroup);
                  setGraphMetric(
                    GRAPH_OPTIONS.find((option) => option.group === nextGroup)
                      ?.key || graphMetric,
                  );
                }}
                className="h-9 shrink-0 cursor-pointer rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-800 shadow-sm shadow-blue-100/70 outline-none transition hover:bg-blue-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {GRAPH_GROUPS.map((group) => (
                  <option key={group.key} value={group.key}>
                    {group.label}
                  </option>
                ))}
              </select>

              {graphGroup !== "persons" && (
                <select
                  aria-label="Graph metric"
                  value={graphMetric}
                  onChange={(event) => setGraphMetric(event.target.value)}
                  className="h-9 shrink-0 min-w-44 cursor-pointer rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-800 shadow-sm shadow-blue-100/70 outline-none transition hover:bg-blue-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {graphOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}

              <select
                aria-label="Filter status"
                value={selectedStatuses[0] || ""}
                onChange={(event) =>
                  setSelectedStatuses(
                    event.target.value ? [event.target.value] : [],
                  )
                }
                className="h-9 shrink-0 min-w-32 cursor-pointer rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-800 shadow-sm shadow-blue-100/70 outline-none transition hover:bg-blue-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All Status</option>
                {statusTabs.map((item) => (
                  <option key={item.status} value={item.status}>
                    {item.status}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-h-4 items-center gap-3 text-xs font-medium">
              {graphGroup === "persons" ? (
                <>
                  {isSplitWorkingByLine ? (
                    selectedGraphLines.map((lineName, index) => (
                      <span
                        key={lineName}
                        className="flex items-center gap-1"
                        style={{
                          color:
                            MULTI_LINE_WORKING_COLORS[
                            index % MULTI_LINE_WORKING_COLORS.length
                            ],
                        }}
                      >
                        <span
                          className="h-3 w-3"
                          style={{
                            backgroundColor:
                              MULTI_LINE_WORKING_COLORS[
                              index % MULTI_LINE_WORKING_COLORS.length
                              ],
                          }}
                        />
                        {lineName}
                      </span>
                    ))
                  ) : (
                    <span className="flex items-center gap-1 font-bold text-sky-700 dark:text-sky-400">
                      <span className="h-3 w-3 bg-sky-500" />
                      {selectedStatuses.length === 1
                        ? `${selectedStatuses[0]} Present`
                        : "Working"}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 font-bold text-rose-500">
                    <span className="h-3 w-3 rounded-xs bg-rose-500" />
                    {selectedStatuses.length === 1
                      ? `${selectedStatuses[0]} Absent`
                      : "Leave"}
                  </span>
                  <span className="flex items-center gap-1.5 font-bold text-purple-600">
                    <span className="h-3 w-3 rounded-xs bg-purple-500" />
                    Off / Holiday
                  </span>
                </>
              ) : selectedGraphOption ? (
                <span
                  className="flex items-center gap-1"
                  style={{ color: selectedGraphOption.color }}
                >
                  <span
                    className="h-3 w-3"
                    style={{ backgroundColor: selectedGraphOption.color }}
                  />
                  {selectedGraphOption.label}
                </span>
              ) : null}
            </div>
          </div>

          {!isGraphReady || isLoadingManhour ? (
            <div className={`flex ${viewMode === "graph" ? "h-[680px]" : "h-[540px]"} w-full animate-pulse flex-col justify-end rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/50 to-slate-100/30 p-6`}>
              <div className="flex items-center justify-between mb-auto">
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

              {/* Gridlines & Skeleton Bars */}
              <div className="relative h-[480px] w-full flex flex-col justify-end">
                <div className="absolute inset-x-0 top-0 bottom-8 flex flex-col justify-between pointer-events-none opacity-50">
                  <div className="border-b border-dashed border-slate-300 w-full" />
                  <div className="border-b border-dashed border-slate-300 w-full" />
                  <div className="border-b border-dashed border-slate-300 w-full" />
                  <div className="border-b border-dashed border-slate-300 w-full" />
                </div>

                <div className="flex items-end justify-between gap-3 sm:gap-4 h-full z-10 pt-8 pb-1">
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
          ) : (
            <div className={`manhour-graph-scroll ${viewMode === "graph" ? "h-[680px]" : "h-[540px]"} w-full max-w-full min-w-0 overflow-x-scroll overflow-y-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 md:p-5 transition-all duration-300`}>
              <div
                className="h-full min-h-[1px] min-w-[1px]"
                style={{ width: `${graphChartWidth}px` }}
              >
                <ManHourChart
                  graphChartWidth={graphChartWidth}
                  displayedGraphData={displayedGraphData}
                  graphGroup={graphGroup}
                  graphAxis={graphAxis}
                  isSplitWorkingByLine={isSplitWorkingByLine}
                  selectedGraphLines={selectedGraphLines}
                  selectedGraphOption={selectedGraphOption}
                  selectedStatuses={selectedStatuses}
                  manhourRecordsCount={manhourRecords.length}
                  loadTooltipStatusDay={loadTooltipStatusDay}
                  getTooltipStatusSummary={getTooltipStatusSummary}
                />
              </div>
            </div>
          )}
        </section>
        )}

        {viewMode !== "graph" && viewMode !== "matrix" && viewMode !== "deepdive" && (
        <div
          style={{ contentVisibility: "auto", containIntrinsicSize: "1200px" }}
          className="mt-2 space-y-2"
        >
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-sm">
            <span className="bg-blue-100 text-blue-900 text-xs px-2.5 py-1 rounded font-mono font-black uppercase">
              {activeTab}
            </span>
            <span className="text-slate-300">/</span>
            <select
              value={selectedLine}
              onChange={(e) => handleLineChange(e.target.value)}
              aria-label="Select Production Line"
              title="Select Production Line"
              className="bg-slate-50 border border-slate-300 text-xs rounded-lg font-mono font-bold px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {(searchTerm.trim() ? filteredLines : graphLines).map((lineName) => (
                <option key={lineName} value={lineName}>
                  {lineName}
                </option>
              ))}
            </select>
            <div className="relative ml-0 w-full sm:ml-2 sm:w-72">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search Line (Ex. OQI_M/A)..."
                aria-label="Search Production Line"
                value={searchTerm}
                onChange={(e) => handleLineSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-8 pr-3 text-xs font-medium text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            {/* ปุ่มส่งออก Excel: คลิกแล้วเปิดหน้าต่าง Pop-up ให้เลือกอย่างชัดเจน */}
            <div className="ml-auto">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:from-emerald-600 hover:to-teal-700 hover:shadow-md active:scale-95 cursor-pointer"
                title="คลิกเพื่อเลือกรูปแบบการส่งออกไฟล์ Excel"
              >
                <FileSpreadsheet className="h-4 w-4 text-white" />
                <span>Export Table (Excel)</span>
              </button>
            </div>
          </div>
          <div className="w-full overflow-x-auto border border-slate-200/90 shadow-sm bg-white rounded-xl">
            <ManHourTable
              displayDays={displayDays}
              manhourCalendar={manhourCalendar}
              selectedMonth={selectedMonth}
              selectedLine={selectedLine}
              rowSums={rowSums}
              calculatedRows={calculatedRows}
              displayInputValue={displayInputValue}
              handleCellValueChange={handleCellValueChange}
              displayCalculatedValue={displayCalculatedValue}
            />
          </div>
        </div>
        )}
      </div>

      {/* 🌟 Export Options Modal (เปิดลอยกลางหน้าจอทันที ไม่ว่าจะอยู่ส่วนไหนของหน้าเว็บ) */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsExportModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    เลือกรูปแบบการดาวน์โหลด Excel
                  </h3>
                  <p className="text-xs text-slate-500">
                    ประจำเดือน {selectedMonth}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2.5 pt-1">
              {/* ตัวเลือกที่ 1: เฉพาะไลน์นี้ */}
              <button
                type="button"
                onClick={() => {
                  setIsExportModalOpen(false);
                  handleExportCurrentLine(selectedLine);
                }}
                className="w-full flex items-center gap-3.5 rounded-xl border-2 border-slate-200 px-4 py-3 text-left transition hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer group"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-blue-600 group-hover:text-white transition">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black text-slate-900 group-hover:text-blue-900 whitespace-nowrap">
                    1. เฉพาะไลน์นี้ ({selectedLine})
                  </div>
                </div>
              </button>

              {/* ตัวเลือกที่ 2: ทั้งหมดในแท็บนี้ รวมต่อกันในหน้าเดียว */}
              <button
                type="button"
                onClick={() => {
                  setIsExportModalOpen(false);
                  handleExportStackedTabLines(activeTab);
                }}
                className="w-full flex items-center gap-3.5 rounded-xl border-2 border-emerald-500 bg-emerald-50/70 px-4 py-3 text-left transition hover:bg-emerald-100/70 hover:border-emerald-600 cursor-pointer group shadow-xs"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black text-emerald-950 whitespace-nowrap">
                    2. ทั้งหมดในแท็บ {activeTab}
                  </div>
                </div>
              </button>

              {/* ตัวเลือกที่ 3: ทั้งหมดทุกแท็บในระบบ แยกเป็น 5 หน้าตามแท็บ */}
              <button
                type="button"
                onClick={() => {
                  setIsExportModalOpen(false);
                  handleExportStackedAllTabs();
                }}
                className="w-full flex items-center gap-3.5 rounded-xl border-2 border-slate-200 px-4 py-3 text-left transition hover:border-indigo-500 hover:bg-indigo-50/50 cursor-pointer group"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-indigo-600 group-hover:text-white transition">
                  <Download className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <div className="text-[13px] font-black text-slate-900 group-hover:text-indigo-900 whitespace-nowrap">
                    3. ทั้งหมดทุกแท็บในระบบ (Macro PCN, FPC, SMT, QA, IND)
                  </div>
                </div>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 transition cursor-pointer"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 Fullscreen World-Class Manufacturing War Room Modal */}
      <WarRoomModal
        isOpen={isWarRoomOpen}
        onClose={() => setIsWarRoomOpen(false)}
        selectedMonth={selectedMonth}
        activeTab={activeTab}
        selectedLine={selectedLine}
        tabLines={graphLines}
        spreadsheetData={spreadsheetData}
        displayDays={displayDays}
        manhourCalendar={manhourCalendar}
      />
    </main>
  );
}
