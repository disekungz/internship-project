/**
 * หน้าจอ: WIP History (ประวัติงานคงค้างในกระบวนการผลิตย้อนหลัง)
 * - แสดงกราฟประวัติแนวโน้ม WIP ตามช่วงเวลา วัน/เดือน
 * - จำแนกตามกลุ่ม Lead Time Groups (0-3 วัน, 4-9 วัน, ..., >365 วัน)
 * - รองรับการเปรียบเทียบกับ Target การผลิต (Target P1)
 */
import { useEffect, useMemo, useState, useCallback, useDeferredValue } from "react";

import { ChartRow } from "./types";

import FujiLogo from "../../../assets/icon/Fuji.png";
import { API_URL, TARGET_URL } from "./api/config";
import {
  generateDistinctColor,
  cleanAndNormalizeDate,
  formatThaiDate,
  getProcessGroup,
  getWipGroup,
} from "./utils";
import { MultiSelectFilter } from "./components/MultiSelectFilter";
import { SingleSelectFilter } from "./components/SingleSelectFilter";
import { WipEChart } from "./components/WipEChart";
import { StickyYAxis } from "./components/StickyYAxis";
import { ManualModal } from "./components/ManualModal";
import { WipDetailModal, WipLotItem } from "./components/WipDetailModal";
import { ModernDateRangePicker } from "@/components/ModernDateRangePicker";
import {
  getBrowserCache,
  removeLegacyLocalCache,
  setBrowserCache,
} from "@/utility/browserCache";
import { useNavigate } from "react-router-dom"; // นำเข้า Hook useNavigate สำหรับเปลี่ยนหน้า
import {
  CalendarDays,
  Clock3,
  Factory,
  FileSpreadsheet,
  Hash,
  PackageSearch,
  Tags,
  Warehouse,
  Workflow,
  X,
} from "lucide-react";

// กำหนดชุดสีมาตรฐานสำหรับแต่ละช่วง Lead Time Group
const LEAD_TIME_GROUP_COLORS = [
  { name: "(1) : 0-3 Day", displayName: "0-3 Day", color: "#6d5ecc" }, // 🟣 ลูกบอลม่วง
  { name: "(2) : 4-9 Day", displayName: "4-9 Day", color: "#307cf0" }, // 🔵 ลูกบอลน้ำเงิน
  { name: "(3) : 10-29 Day", displayName: "10-29 Day", color: "#34d399" }, // 🟢 ลูกบอลเขียว
  { name: "(4) : 30-99 Day", displayName: "30-99 Day", color: "#f59e0b" }, // 🟡 ลูกบอลเหลือง
  { name: "(5) : 100-364 Day", displayName: "100-364 Day", color: "#f97316" }, // 🟠 ลูกบอลส้ม
  {
    name: "(6) : More 365 Days",
    displayName: "More 365 Days",
    color: "#e11d48",
  }, // 🔴 ลูกบอลแดง
];

const SEMI_GROUPS = ["E-FPC-AUTO", "E-FPC-GEN", "SMT-AUTO", "SMT-GEN"] as const;
const MIN_VISIBLE_STACK_VALUE = 5;
const getDisplayedStackValue = (
  row: ChartRow,
  key: string,
  minimum = MIN_VISIBLE_STACK_VALUE,
) => {
  const value = Number(row[key] || 0);
  return value > 0 ? Math.max(value, minimum) : 0;
};

// แปลงค่าความสูงขั้นต่ำที่มองเห็นได้ให้เป็นค่าการแสดงผลแบบ Stack ก่อนที่ ECharts
// จะคำนวณตำแหน่งแต่ละส่วน เพื่อรักษาลำดับ Stack และป้องกันการซ้อนทับกัน
const getMinimumStackValueForPixels = (
  axisMax: number,
  minPixels: number,
  plotHeight = 400,
) => Math.max(MIN_VISIBLE_STACK_VALUE, (axisMax * minPixels) / plotHeight);

let wipHistoryLastFetchAt = 0;

const Page = () => {
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [targetData, setTargetData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedProcesses, setSelectedProcesses] = useState<string[]>([]);
  const [selectedLotStatus, setSelectedLotStatus] = useState<string[]>(["WIP"]);
  const [selectedLotNo, setSelectedLotNo] = useState<string[]>([]);
  const [selectedLeadTimeGroups, setSelectedLeadTimeGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedWipGroup, setSelectedWipGroup] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"process" | "semiGroup">("process");
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);
  const [selectedStackKey, setSelectedStackKey] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportGraph, setExportGraph] = useState("main");
  const [exportPeriod, setExportPeriod] = useState<"current" | "day" | "month">(
    "current",
  );
  const [exportDate, setExportDate] = useState("");
  const [exportMonth, setExportMonth] = useState("");

  // Drill-down Modal State สำหรับแสดงรายละเอียด Lot, Product Name, Aging Days
  const [drillDownModalOpen, setDrillDownModalOpen] = useState(false);
  const [drillDownParams, setDrillDownParams] = useState<{
    date: string | null;
    leadTimeGroupName: string | null;
    leadTimeColor: string;
    processName: string | null;
    items: WipLotItem[];
  }>({
    date: null,
    leadTimeGroupName: null,
    leadTimeColor: "#f97316",
    processName: null,
    items: [],
  });

  // เปิดใช้งาน Area Chart ในกราฟหลักเสมอตามที่กำหนด
  const showComparisonArea = true;

  const selectStack = (chartId: string, key: string, date?: string) => {
    const isSameSelection =
      selectedChartId === chartId && selectedStackKey === key;
    setSelectedChartId(isSameSelection ? null : chartId);
    setSelectedStackKey(isSameSelection ? null : key);
    setSelectedDate(isSameSelection ? null : date || null);
  };
  const clearStackSelection = () => {
    setSelectedChartId(null);
    setSelectedStackKey(null);
    setSelectedDate(null);
  };
  const selectWholeDay = (chartId: string, event: any, data: ChartRow[]) => {
    const payload = event?.activePayload?.[0]?.payload;
    const clickedLabel = event?.activeLabel ?? event?.value;
    const date =
      payload?.date ?? data.find((row) => row.label === clickedLabel)?.date;
    if (!date) return;
    if (
      selectedChartId === chartId &&
      selectedDate === date &&
      selectedStackKey === null
    ) {
      clearStackSelection();
      return;
    }
    setSelectedChartId(chartId);
    setSelectedStackKey(null);
    setSelectedDate(date);
  };

  useEffect(() => {
    let mounted = true;
    let loadInFlight = false;
    const load = async (forceRefresh = false) => {
      if (loadInFlight) return;
      loadInFlight = true;
      try {
        const [cachedDaily, cachedTarget, cachedAt] = await Promise.all([
          getBrowserCache<any[]>("wip-history-daily-v5"),
          getBrowserCache<any[]>("wip-history-target-v5"),
          getBrowserCache<number>("wip-history-cache-v5:saved-at"),
        ]);
        const hasDailyCache = !forceRefresh && Array.isArray(cachedDaily) && cachedDaily.length > 0;
        const hasTargetCache = !forceRefresh && Array.isArray(cachedTarget) && cachedTarget.length > 0;

        if (mounted && hasDailyCache) {
          setDailyData(cachedDaily);
          if (hasTargetCache) {
            setTargetData(cachedTarget);
          }
          setLoading(false);
          wipHistoryLastFetchAt = Number(cachedAt || 0);
        }

        if (!mounted) return;
        setError(null);

        // ตรวจสอบอายุแคช (หากเก่าเกิน 5 นาที หรือ forceRefresh ให้ดึงข้อมูลเต็มเพื่อความชัวร์)
        const isCacheStale = !cachedAt || Date.now() - Number(cachedAt) > 5 * 60 * 1000;
        const fetchDailyUrl = forceRefresh
          ? `${API_URL}?refresh=1`
          : hasDailyCache && !isCacheStale
            ? `${API_URL}?delta=1`
            : `${API_URL}`;
        const fetchTargetUrl = `${TARGET_URL}`;

        const [resDaily, resTarget] = await Promise.all([
          fetch(fetchDailyUrl, { cache: "no-store" }),
          fetch(fetchTargetUrl, { cache: "default" }),
        ]);

        if (!resDaily.ok)
          throw new Error(`Daily P1 API ตอบกลับด้วยสถานะ: ${resDaily.status}`);
        if (!resTarget.ok)
          throw new Error(`Target API ตอบกลับด้วยสถานะ: ${resTarget.status}`);

        const jsonDaily = await resDaily.json();
        const jsonTarget = await resTarget.json();

        if (mounted) {
          if (hasDailyCache && !isCacheStale && !forceRefresh && Array.isArray(jsonDaily)) {
            setDailyData((previous) => {
              const incomingRows = jsonDaily;
              if (!incomingRows.length) return previous;
              const incomingDates = new Set(
                incomingRows
                  .map((row) => cleanAndNormalizeDate(row.effective_date))
                  .filter(Boolean),
              );
              const oldRows = previous.filter(
                (row) =>
                  !incomingDates.has(cleanAndNormalizeDate(row.effective_date)),
              );
              const mergedRows = [...oldRows, ...incomingRows];
              setBrowserCache("wip-history-daily-v5", mergedRows).catch(
                (cacheError) =>
                  console.warn(
                    "Unable to save latest WIP History cache:",
                    cacheError,
                  ),
              );
              return mergedRows;
            });
          } else {
            const finalDailyRows = Array.isArray(jsonDaily) ? jsonDaily : [];
            setDailyData(finalDailyRows);
            setBrowserCache("wip-history-daily-v5", finalDailyRows).catch((cacheError) =>
              console.warn("Unable to save WIP History cache:", cacheError),
            );
          }

          if (Array.isArray(jsonTarget) && jsonTarget.length > 0) {
            setTargetData(jsonTarget);
            setBrowserCache("wip-history-target-v5", jsonTarget).catch(
              (cacheError) =>
                console.warn("Unable to save WIP target cache:", cacheError),
            );
          }

          wipHistoryLastFetchAt = Date.now();
          setBrowserCache(
            "wip-history-cache-v5:saved-at",
            wipHistoryLastFetchAt,
          ).catch((cacheError) =>
            console.warn(
              "Unable to save WIP History cache timestamp:",
              cacheError,
            ),
          );
        }
      } catch (err: any) {
        if (mounted) setError(err?.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        loadInFlight = false;
        if (mounted) setLoading(false);
      }
    };
    removeLegacyLocalCache(
      "wip-history-daily-v1",
      "wip-history-daily-v2",
      "wip-history-daily-v3",
      "wip-history-daily-v4",
      "wip-history-target-v1",
      "wip-history-target-v2",
      "wip-history-target-v3",
      "wip-history-target-v4",
    );
    load();

    // Auto-sync เบื้องหลังทุกๆ 60 วินาที และเมื่อผู้ใช้สลับแท็บกลับมา
    const interval = setInterval(() => {
      load();
    }, 60 * 1000);

    const onFocus = () => {
      load();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    const streamUrl = API_URL.replace(/\/daily-p1$/, "/daily-p1/stream");
    const events = new EventSource(streamUrl);
    events.addEventListener("wip-update", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        const hasChangedDatePayload =
          payload && !Array.isArray(payload) && typeof payload === "object";
        const changedDate = hasChangedDatePayload
          ? cleanAndNormalizeDate(payload.changedDate)
          : "";
        const latestRows = hasChangedDatePayload ? payload.rows : payload;
        if (!Array.isArray(latestRows)) return;
        const incomingDates = new Set(
          (changedDate
            ? [changedDate]
            : latestRows.map((row) => cleanAndNormalizeDate(row.effective_date))
          ).filter(Boolean),
        );
        setDailyData((previous) => {
          const mergedRows = [
            ...previous.filter(
              (row) =>
                !incomingDates.has(cleanAndNormalizeDate(row.effective_date)),
            ),
            ...latestRows,
          ];
          void setBrowserCache("wip-history-daily-v4", mergedRows).catch(
            (cacheError) =>
              console.warn(
                "Unable to save live WIP History cache:",
                cacheError,
              ),
          );
          return mergedRows;
        });
      } catch (streamError) {
        console.warn("Unable to apply live WIP History update:", streamError);
      }
    });
    // ใช้ระบบ Reconnect อัตโนมัติของ EventSource โดยยังคงใช้ข้อมูลแคชเดิมระหว่างรอเชื่อมต่อ
    events.onerror = () => undefined;
    return () => events.close();
  }, []);

  const dailyP1RowsAll = useMemo(() => dailyData, [dailyData]);

  const targetMaps = useMemo(() => {
    const p1: Record<string, number> = {};
    const fpc_total: Record<string, number> = {};
    const fpc_gen: Record<string, number> = {};
    const fpc_automotive: Record<string, number> = {};
    const smt_total: Record<string, number> = {};
    const smt_gen: Record<string, number> = {};
    const smt_automotive: Record<string, number> = {};

    for (const row of targetData) {
      const standardizedDate = cleanAndNormalizeDate(row.effective_date);
      if (standardizedDate) {
        if (row.p1 !== undefined && row.p1 !== null)
          p1[standardizedDate] = Number(row.p1 || row.P1 || 0);
        if (row.fpc_total !== undefined && row.fpc_total !== null)
          fpc_total[standardizedDate] = Number(row.fpc_total || 0);
        if (row.fpc_gen !== undefined && row.fpc_gen !== null)
          fpc_gen[standardizedDate] = Number(row.fpc_gen || 0);
        if (row.fpc_automotive !== undefined && row.fpc_automotive !== null)
          fpc_automotive[standardizedDate] = Number(row.fpc_automotive || 0);
        if (row.smt_total !== undefined && row.smt_total !== null)
          smt_total[standardizedDate] = Number(row.smt_total || 0);
        if (row.smt_gen !== undefined && row.smt_gen !== null)
          smt_gen[standardizedDate] = Number(row.smt_gen || 0);
        if (row.smt_automotive !== undefined && row.smt_automotive !== null)
          smt_automotive[standardizedDate] = Number(row.smt_automotive || 0);
      }
    }
    return {
      p1,
      fpc_total,
      fpc_gen,
      fpc_automotive,
      smt_total,
      smt_gen,
      smt_automotive,
    };
  }, [targetData]);

  const targetByDate = targetMaps.p1;

  const applyTargetToRows = useCallback(
    (
      rows: ChartRow[],
      targetMap: Record<string, number>,
    ) => {
      if (!rows.length) return rows;
      const sortedTargetDates = Object.keys(targetMap)
        .filter((d) => targetMap[d] !== undefined && targetMap[d] !== null)
        .sort();

      if (sortedTargetDates.length === 0) {
        for (const row of rows) {
          row.target = null;
        }
        return rows;
      }

      for (const row of rows) {
        if (targetMap[row.date] !== undefined && targetMap[row.date] !== null) {
          row.target = Number(targetMap[row.date]);
          continue;
        }
        // ค้นหาวันที่ของ Target ล่าสุดที่ <= row.date
        let matchedDate: string | null = null;
        for (let i = sortedTargetDates.length - 1; i >= 0; i--) {
          if (sortedTargetDates[i] <= row.date) {
            matchedDate = sortedTargetDates[i];
            break;
          }
        }
        // ถ้า row.date เกิดก่อน Target วันแรกสุด ให้ใช้ Target วันแรกสุด
        if (!matchedDate) {
          matchedDate = sortedTargetDates[0];
        }
        row.target = Number(targetMap[matchedDate]);
      }
      return rows;
    },
    [],
  );

  const allProcessOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of dailyP1RowsAll)
      set.add(row.proc_disp || "ไม่ระบุ Process");
    return Array.from(set).sort();
  }, [dailyP1RowsAll]);

  const allProductOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of dailyP1RowsAll)
      if (row.lot_prd_name) set.add(row.lot_prd_name);
    return Array.from(set).sort();
  }, [dailyP1RowsAll]);

  const allLotStatusOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of dailyP1RowsAll) set.add(row.lot_status || "ไม่ระบุสถานะ");
    const arr = Array.from(set);
    return arr.sort((a, b) => {
      if (a === "WIP") return -1;
      if (b === "WIP") return 1;
      return a.localeCompare(b);
    });
  }, [dailyP1RowsAll]);

  const allLotNoOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of dailyP1RowsAll) if (row.lot_no) set.add(row.lot_no);
    return Array.from(set).sort();
  }, [dailyP1RowsAll]);

  const allLeadTimeGroupOptions = useMemo(() => {
    // ใช้ displayName (ไม่มีเลขนำหน้า) สำหรับตัวเลือก Filter
    return LEAD_TIME_GROUP_COLORS.map((group) => group.displayName);
  }, [dailyP1RowsAll]);

  // แมป displayName → name เต็มสำหรับการกรองข้อมูลดิบ
  const leadTimeDisplayToName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const g of LEAD_TIME_GROUP_COLORS) map[g.displayName] = g.name;
    return map;
  }, []);

  const dataDateRange = useMemo(() => {
    const dates = dailyP1RowsAll
      .map((r) => cleanAndNormalizeDate(r.effective_date))
      .filter(Boolean)
      .sort();
    return {
      min: dates[0] || "",
      max: dates[dates.length - 1] || "",
    };
  }, [dailyP1RowsAll]);

  // ใช้ React 18 useDeferredValue เพื่อป้องกันไม่ให้การคำนวณข้อมูลหลายพันรายการบล็อก UI การคลิกเลือก Filter
  const deferredDateFrom = useDeferredValue(dateFrom);
  const deferredDateTo = useDeferredValue(dateTo);
  const deferredSelectedProducts = useDeferredValue(selectedProducts);
  const deferredSelectedProcesses = useDeferredValue(selectedProcesses);
  const deferredSelectedLotStatus = useDeferredValue(selectedLotStatus);
  const deferredSelectedLotNo = useDeferredValue(selectedLotNo);
  const deferredSelectedLeadTimeGroups = useDeferredValue(selectedLeadTimeGroups);
  const deferredSelectedGroup = useDeferredValue(selectedGroup);
  const deferredSelectedWipGroup = useDeferredValue(selectedWipGroup);

  const dailyP1Rows = useMemo(() => {
    const hasProd = deferredSelectedProducts.length > 0;
    const prodSet = hasProd ? new Set(deferredSelectedProducts) : null;

    const hasProc = deferredSelectedProcesses.length > 0;
    const procSet = hasProc ? new Set(deferredSelectedProcesses) : null;

    const hasLotStatus = deferredSelectedLotStatus.length > 0;
    const lotStatusSet = hasLotStatus ? new Set(deferredSelectedLotStatus) : null;

    const hasLotNo = deferredSelectedLotNo.length > 0;
    const lotNoSet = hasLotNo ? new Set(deferredSelectedLotNo) : null;

    const hasLeadTime = deferredSelectedLeadTimeGroups.length > 0;
    const leadTimeSet = hasLeadTime
      ? new Set(deferredSelectedLeadTimeGroups.map((d) => leadTimeDisplayToName[d] ?? d))
      : null;

    const len = dailyP1RowsAll.length;
    const result: any[] = [];

    for (let i = 0; i < len; i++) {
      const row = dailyP1RowsAll[i];
      const eff = cleanAndNormalizeDate(row.effective_date);
      if (deferredDateFrom && eff < deferredDateFrom) continue;
      if (deferredDateTo && eff > deferredDateTo) continue;

      if (hasProd && !prodSet!.has(row.lot_prd_name || "")) continue;

      const proc = row.proc_disp || "ไม่ระบุ Process";
      if (hasProc && !procSet!.has(proc)) continue;

      const status = row.lot_status || "ไม่ระบุสถานะ";
      if (hasLotStatus && !lotStatusSet!.has(status)) continue;

      if (hasLeadTime) {
        const rowLtg = row.lead_time_group || "ไม่ระบุ Lead Time Group";
        if (!leadTimeSet!.has(rowLtg)) continue;
      }

      if (hasLotNo && !lotNoSet!.has(row.lot_no || "")) continue;

      if (deferredSelectedGroup !== "all") {
        const currentGroup = getProcessGroup(
          row.proc_disp || "",
          row.lot_prd_name || "",
        );
        if (currentGroup !== deferredSelectedGroup) continue;
      }
      if (deferredSelectedWipGroup !== "all") {
        const currentWipGroup = getWipGroup(row.proc_disp || "");
        if (currentWipGroup !== deferredSelectedWipGroup) continue;
      }

      result.push(row);
    }

    return result;
  }, [
    dailyP1RowsAll,
    deferredDateFrom,
    deferredDateTo,
    deferredSelectedProducts,
    deferredSelectedProcesses,
    deferredSelectedLotStatus,
    deferredSelectedLotNo,
    deferredSelectedLeadTimeGroups,
    deferredSelectedGroup,
    deferredSelectedWipGroup,
    leadTimeDisplayToName,
  ]);

  const openDrillDown = useCallback(
    (
      date: string | null,
      leadTimeGroup: string | null,
      process: string | null,
      color = "#f97316",
    ) => {
      const normalizedTargetDate = date ? cleanAndNormalizeDate(date) : null;
      const matchedLots = dailyP1Rows.filter((row) => {
        if (
          normalizedTargetDate &&
          cleanAndNormalizeDate(row.effective_date) !== normalizedTargetDate
        ) {
          return false;
        }
        if (leadTimeGroup) {
          const rowLtg = String(row.lead_time_group || "");
          const cleanLtg = rowLtg.replace(/^\(\d+\)\s*:\s*/, "").trim();
          const cleanTarget = leadTimeGroup.replace(/^\(\d+\)\s*:\s*/, "").trim();
          if (rowLtg !== leadTimeGroup && cleanLtg !== cleanTarget) {
            return false;
          }
        }
        if (process && (row.proc_disp || "ไม่ระบุ Process") !== process) {
          return false;
        }
        return true;
      });

      setDrillDownParams({
        date: date ? (date.includes("/") ? date : formatThaiDate(date)) : null,
        leadTimeGroupName: leadTimeGroup ? leadTimeGroup.replace(/^\(\d+\)\s*:\s*/, "").trim() : null,
        leadTimeColor: color,
        processName: process,
        items: matchedLots,
      });
      setDrillDownModalOpen(true);
    },
    [dailyP1Rows],
  );

  const processList = useMemo(() => {
    const set = new Set<string>();
    for (const row of dailyP1Rows) set.add(row.proc_disp || "ไม่ระบุ Process");
    const names = Array.from(set).sort();
    return names.map((name) => {
      const globalIdx = allProcessOptions.indexOf(name);
      return {
        key: `proc_${name.replace(/\s+/g, "_")}`,
        name,
        color: generateDistinctColor(
          globalIdx >= 0 ? globalIdx : 0,
          allProcessOptions.length,
        ),
      };
    });
  }, [dailyP1Rows, allProcessOptions]);

  const processNameToKey = useMemo(() => {
    const map: Record<string, string> = {};
    for (const name of allProcessOptions) {
      map[name] = `proc_${name.replace(/\s+/g, "_")}`;
    }
    return map;
  }, [allProcessOptions]);

  const leadTimeGroupList = useMemo(() => {
    const presentLeadTimeGroupNames = new Set<string>();
    for (const row of dailyP1Rows) {
      if (row.lead_time_group) {
        presentLeadTimeGroupNames.add(row.lead_time_group);
      }
    }

    // กรองเอาเฉพาะกลุ่ม Lead Time ที่มีข้อมูลอยู่ในชุดข้อมูลปัจจุบัน
    return LEAD_TIME_GROUP_COLORS.filter((group) =>
      presentLeadTimeGroupNames.has(group.name),
    ).map((group) => ({
      key: `lead_${group.name.replace(/[^a-zA-Z0-9]/g, "_")}`,
      name: group.displayName, // ใช้ displayName (ไม่มี prefix ตัวเลข)
      fullName: group.name, // เก็บชื่อเต็มไว้สำหรับ lookup
      color: group.color,
    }));
  }, [dailyP1Rows]);

  const leadTimeGroupNameToKey = useMemo(() => {
    const map: Record<string, string> = {};
    for (const group of LEAD_TIME_GROUP_COLORS) {
      map[group.name] = `lead_${group.name.replace(/[^a-zA-Z0-9]/g, "_")}`; // แปลง key ให้ปลอดภัยสำหรับ recharts
    }
    return map;
  }, []);

  // ตรวจสอบว่ามีการเลือก Filter ย่อยเพิ่มเติมหรือไม่ (นอกเหนือจากวันที่และสถานะ Lot)
  const hasSubFilters =
    selectedProcesses.length > 0 ||
    selectedProducts.length > 0 ||
    selectedLotNo.length > 0 ||
    selectedGroup !== "all" ||
    selectedWipGroup !== "all" ||
    selectedLeadTimeGroups.length > 0;

  // รวมการคำนวณยอดรวมรายวัน totalAllByDateMain และ totalAllByDateSub ในลูปเดียว
  const { totalAllByDateMain, totalAllByDateSub } = useMemo(() => {
    const mainMap: Record<string, number> = {};
    const subMap: Record<string, number> = {};
    const filterStatuses = hasSubFilters ? selectedLotStatus : [];

    for (let i = 0; i < dailyP1RowsAll.length; i++) {
      const row = dailyP1RowsAll[i];
      const eff = cleanAndNormalizeDate(row.effective_date);
      if (!eff) continue;
      if (dateFrom && eff < dateFrom) continue;
      if (dateTo && eff > dateTo) continue;

      const qty = Number(row.lot_qty || 0);
      const status = row.lot_status || "ไม่ระบุสถานะ";

      // 1. กราฟพื้นที่เปรียบเทียบในกราฟหลัก (Comparison Area)
      if (filterStatuses.length === 0 || filterStatuses.includes(status)) {
        mainMap[eff] = (mainMap[eff] || 0) + qty;
      }

      // 2. กราฟพื้นที่เปรียบเทียบในกราฟย่อย
      if (selectedLotStatus.length === 0 || selectedLotStatus.includes(status)) {
        subMap[eff] = (subMap[eff] || 0) + qty;
      }
    }

    return { totalAllByDateMain: mainMap, totalAllByDateSub: subMap };
  }, [dailyP1RowsAll, dateFrom, dateTo, selectedLotStatus, hasSubFilters]);

  const chartData: ChartRow[] = useMemo(() => {
    if (!dailyP1Rows.length) return [];
    const buckets: Record<string, ChartRow> = {};

    for (let i = 0; i < dailyP1Rows.length; i++) {
      const row = dailyP1Rows[i];
      const dateKey = cleanAndNormalizeDate(row.effective_date);
      if (!dateKey) continue;

      const ltgName = row.lead_time_group || "ไม่ระบุ Lead Time Group";
      const ltgKey = leadTimeGroupNameToKey[ltgName];
      if (!ltgKey) continue;

      const procName = row.proc_disp || "ไม่ระบุ Process";
      const procKey = `proc_${procName.replace(/\s+/g, "_")}`;
      const leadProcessKey = `leadproc:${ltgKey}:${encodeURIComponent(procName)}`;

      if (!buckets[dateKey]) {
        buckets[dateKey] = {
          date: dateKey,
          label: formatThaiDate(dateKey),
          total: 0,
        };
      }

      const qty = Number(row.lot_qty || 0);
      buckets[dateKey].total += qty;
      buckets[dateKey][ltgKey] = (buckets[dateKey][ltgKey] || 0) + qty;
      buckets[dateKey][procKey] = (buckets[dateKey][procKey] || 0) + qty;
      buckets[dateKey][leadProcessKey] =
        (buckets[dateKey][leadProcessKey] || 0) + qty;
    }

    const sortedData = Object.values(buckets).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    for (let i = 0; i < sortedData.length; i++) {
      const row = sortedData[i];
      row.total_all = totalAllByDateMain[row.date] ?? row.total;
    }

    return applyTargetToRows(sortedData, targetByDate);
  }, [dailyP1Rows, leadTimeGroupNameToKey, targetByDate, totalAllByDateMain, applyTargetToRows]);

  const visibleChartData = chartData;

  const semiGroupChartData = useMemo(() => {
    const buckets: Record<string, ChartRow & { semi_group: string }> = {};

    for (const row of dailyP1Rows) {
      const semiGroup = row.semi_group || "";
      if (!SEMI_GROUPS.includes(semiGroup as (typeof SEMI_GROUPS)[number]))
        continue;

      const dateKey = cleanAndNormalizeDate(row.effective_date);
      if (!dateKey) continue;

      const ltgName = row.lead_time_group || "ไม่ระบุ Lead Time Group";
      const ltgKey = leadTimeGroupNameToKey[ltgName];
      if (!ltgKey) continue;

      const procName = row.proc_disp || "ไม่ระบุ Process";
      const procKey = `proc_${procName.replace(/\s+/g, "_")}`;
      const leadProcessKey = `leadproc:${ltgKey}:${encodeURIComponent(procName)}`;

      const bucketKey = `${semiGroup}||${dateKey}`;
      if (!buckets[bucketKey]) {
        buckets[bucketKey] = {
          date: dateKey,
          label: formatThaiDate(dateKey),
          total: 0,
          semi_group: semiGroup,
        } as ChartRow & { semi_group: string };
      }

      const qty = Number(row.lot_qty || 0);
      buckets[bucketKey].total += qty;
      buckets[bucketKey][ltgKey] = (buckets[bucketKey][ltgKey] || 0) + qty;
      buckets[bucketKey][procKey] = (buckets[bucketKey][procKey] || 0) + qty;
      buckets[bucketKey][leadProcessKey] =
        (buckets[bucketKey][leadProcessKey] || 0) + qty;
    }

    const targetMapping: Record<string, Record<string, number>> = {
      "E-FPC-GEN": targetMaps.fpc_gen,
      "E-FPC-AUTO": targetMaps.fpc_automotive,
      "SMT-GEN": targetMaps.smt_gen,
      "SMT-AUTO": targetMaps.smt_automotive,
    };

    const grouped: Record<string, ChartRow[]> = {};
    for (const semiGroup of SEMI_GROUPS) {
      const rows = Object.values(buckets)
        .filter((item) => item.semi_group === semiGroup)
        .sort((a, b) => a.date.localeCompare(b.date));
      for (const r of rows) {
        // กราฟย่อยใช้ยอดรวมของสถานะ Lot ที่เลือกจากทั่วทั้งโรงงาน
        r.total_all = totalAllByDateSub[r.date] ?? r.total;
      }
      const mapToUse = targetMapping[semiGroup] || {};
      grouped[semiGroup] = applyTargetToRows(rows, mapToUse);
    }

    return grouped;
  }, [dailyP1Rows, leadTimeGroupNameToKey, targetMaps, totalAllByDateSub]);

  const processGroupSummaryData = useMemo(() => {
    const buckets: Record<string, ChartRow & { group: string }> = {};

    for (const row of dailyP1Rows) {
      const group = getProcessGroup(
        row.proc_disp || "",
        row.lot_prd_name || "",
      );
      if (group !== "E-FPC" && group !== "SMT") continue;

      const dateKey = cleanAndNormalizeDate(row.effective_date);
      if (!dateKey) continue;

      const ltgName = row.lead_time_group || "ไม่ระบุ Lead Time Group";
      const ltgKey = leadTimeGroupNameToKey[ltgName];
      if (!ltgKey) continue;

      const procName = row.proc_disp || "ไม่ระบุ Process";
      const procKey = `proc_${procName.replace(/\s+/g, "_")}`;
      const leadProcessKey = `leadproc:${ltgKey}:${encodeURIComponent(procName)}`;

      const bucketKey = `${group}||${dateKey}`;
      if (!buckets[bucketKey]) {
        buckets[bucketKey] = {
          date: dateKey,
          label: formatThaiDate(dateKey),
          total: 0,
          group,
        } as ChartRow & { group: string };
      }

      const qty = Number(row.lot_qty || 0);
      buckets[bucketKey].total += qty;
      buckets[bucketKey][ltgKey] = (buckets[bucketKey][ltgKey] || 0) + qty;
      buckets[bucketKey][procKey] = (buckets[bucketKey][procKey] || 0) + qty;
      buckets[bucketKey][leadProcessKey] =
        (buckets[bucketKey][leadProcessKey] || 0) + qty;
    }

    const eFpcRows = Object.values(buckets)
      .filter((item) => item.group === "E-FPC")
      .sort((a, b) => a.date.localeCompare(b.date));
    const smtRows = Object.values(buckets)
      .filter((item) => item.group === "SMT")
      .sort((a, b) => a.date.localeCompare(b.date));

    for (const r of eFpcRows) {
      // กราฟย่อยใช้ยอดรวมของสถานะ Lot ที่เลือกจากทั่วทั้งโรงงาน
      r.total_all = totalAllByDateSub[r.date] ?? r.total;
    }
    for (const r of smtRows) {
      r.total_all = totalAllByDateSub[r.date] ?? r.total;
    }

    return {
      "E-FPC": applyTargetToRows(eFpcRows, targetMaps.fpc_total),
      SMT: applyTargetToRows(smtRows, targetMaps.smt_total),
    };
  }, [dailyP1Rows, leadTimeGroupNameToKey, targetMaps, totalAllByDateSub]);

  const { maxTotal, mainMinStackValue } = useMemo(() => {
    if (!chartData.length)
      return { maxTotal: 100, mainMinStackValue: MIN_VISIBLE_STACK_VALUE };
    // 1. คำนวณค่าสูงสุดเริ่มต้นจากข้อมูลจริงเพื่อประเมินสเกลแกน Y
    const maxBarInitial = Math.max(
      ...chartData.map((d) => d.total_all ?? d.total ?? 0),
      0,
    );
    const maxTargetInitial = Math.max(
      ...chartData.map((d) => d.target ?? 0),
      0,
    );
    const initialMaxTotal = Math.max(maxBarInitial, maxTargetInitial, 100);
    const initialYAxisMax = Math.ceil(initialMaxTotal * 1.15) || 100;

    // 2. กำหนดค่าขั้นต่ำที่มองเห็นได้ เพื่อไม่ให้แท่งขนาดเล็กแบนจนมองไม่เห็น
    const mainMinStackValue = getMinimumStackValueForPixels(
      initialYAxisMax,
      10,
      494,
    );

    // 3. คำนวณความสูงรวมสูงสุดของแท่งกราฟ
    const maxDisplayedTotal = Math.max(
      ...chartData.map((row) => {
        return LEAD_TIME_GROUP_COLORS.reduce((acc, group) => {
          const key = `lead_${group.name.replace(/[^a-zA-Z0-9]/g, "_")}`;
          const value = Number(row[key] || 0);
          return acc + (value > 0 ? Math.max(value, mainMinStackValue) : 0);
        }, 0);
      }),
    );

    // 4. กำหนดค่าสูงสุดของแกน Y โดยเลือกค่าที่มากที่สุดระหว่างยอดรวมแท่ง, ยอดรวมทั้งหมด และเป้าหมาย Target line, or 100
    const finalMax = Math.max(
      maxDisplayedTotal,
      maxBarInitial,
      maxTargetInitial,
      100,
    );
    return { maxTotal: finalMax, mainMinStackValue };
  }, [chartData]);

  const yAxisMax = Math.ceil(maxTotal * 1.15) || 100;

  const dynamicMaxBarSize = 40;
  const summaryBarSize = 40;
  const semiChartBarSize = 35;
  const chartCategoryGap = 2;
  const chartBarGap = 0;

  const handleExportExcel = async () => {
    let rows = dailyP1Rows;
    if (exportGraph === "efpc")
      rows = rows.filter(
        (row) =>
          getProcessGroup(row.proc_disp || "", row.lot_prd_name || "") ===
          "E-FPC",
      );
    if (exportGraph === "smt")
      rows = rows.filter(
        (row) =>
          getProcessGroup(row.proc_disp || "", row.lot_prd_name || "") ===
          "SMT",
      );
    if (exportGraph.startsWith("semi:"))
      rows = rows.filter((row) => row.semi_group === exportGraph.slice(5));
    if (exportPeriod === "day" && exportDate)
      rows = rows.filter(
        (row) => cleanAndNormalizeDate(row.effective_date) === exportDate,
      );
    if (exportPeriod === "month" && exportMonth)
      rows = rows.filter((row) =>
        cleanAndNormalizeDate(row.effective_date).startsWith(exportMonth),
      );

    if (!rows.length) {
      alert("No data to export.");
      return;
    }

    const dataToExport = rows.map((row) => {
      const newRow: any = {
        "Effective Date": formatThaiDate(row.effective_date),
        "Product Name": row.lot_prd_name || "-",
        "Lot No": row.lot_no || "-",
        "Process Display": row.proc_disp || "-",
        "Lot Status": row.lot_status || "-",
        "WIP Scan In": row.wip_scan_in
          ? new Date(row.wip_scan_in).toLocaleDateString("th-TH")
          : "-",
        "Lead Time WIP Days": Number(row.lead_time_wip_days || 0),
        "Lead Time Group": row.lead_time_group || "-",
        "Lot Quantity": Number(row.lot_qty || 0),
      };
      return newRow;
    });

    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = today.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;

    const graphName = exportGraph
      .replace("semi:", "")
      .replace(/[^a-zA-Z0-9-]/g, "_");
    const periodName =
      exportPeriod === "day"
        ? exportDate
        : exportPeriod === "month"
          ? exportMonth
          : "current-filter";
    const fileName = `WIP_History_${graphName}_${periodName}_${formattedDate}.xlsx`;

    const graphLabel =
      exportGraph === "main"
        ? "WIP History (Main)"
        : exportGraph === "efpc"
          ? "E-FPC Summary"
          : exportGraph === "smt"
            ? "SMT Summary"
            : exportGraph.startsWith("semi:")
              ? `Semi Group: ${exportGraph.slice(5)}`
              : exportGraph;

    const periodLabel =
      exportPeriod === "day"
        ? `Day: ${exportDate}`
        : exportPeriod === "month"
          ? `Month: ${exportMonth}`
          : "Current Filter Range";

    const { exportStyledExcel } = await import(
      "@/utility/Service/xlxs/exportStyledExcel"
    );

    await exportStyledExcel({
      title: "WIP HISTORY REPORT",
      metadata: {
        "Graph / Section": graphLabel,
        "Period Filter": periodLabel,
        "Export Date": new Date().toLocaleString("th-TH"),
        "Total Lots": `${dataToExport.length} Lots`,
      },
      data: dataToExport,
      fileName,
      sheetName: "WIP History",
      themeColor: "navy",
      showTotalRow: true,
      totalColumns: ["Lot Quantity"],
    });

    setIsExportDialogOpen(false);
  };

  // แสดง Skeleton UI สวยงามระหว่างโหลดข้อมูลครั้งแรก แทนการปล่อยหน้าจอขาวพร้อม Spinner หมุน
  const renderLoadingSkeleton = () => (
    <div className="animate-pulse space-y-6">
      {/* Skeleton กราฟหลัก */}
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
            <div className="h-[320px] w-full rounded-2xl bg-slate-50 flex items-end justify-between gap-3 p-4">
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
  );

  if (error) {
    return (
      <main
        role="main"
        aria-label="Error WIP History"
        className="flex h-[70vh] flex-col items-center justify-center gap-3 text-rose-500"
      >
        <p className="text-base font-semibold">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          ลองใหม่อีกครั้ง
        </button>
      </main>
    );
  }

  return (
    <main
      role="main"
      aria-label="WIP History Dashboard"
      className={`h-full w-full ${
        drillDownModalOpen ? "overflow-hidden" : "overflow-y-auto"
      } overflow-x-hidden bg-slate-50 p-4 sm:p-6 pb-12`}
    >
      <style>{`.recharts-wrapper, .recharts-wrapper *, .recharts-wrapper:focus, .recharts-wrapper:focus-visible, .recharts-surface, .recharts-surface:focus { outline: none !important; border: none !important; box-shadow: none !important; } .recharts-cartesian-axis-line, .recharts-cartesian-axis-tick-line { stroke: transparent !important; }`}</style>
      <h1 className="mb-4 flex items-center gap-3 rounded-xl bg-gradient-to-br from-blue-900 to-blue-500 px-4 py-5 text-2xl font-bold text-white shadow-sm">
        <img
          src={FujiLogo}
          alt="Fuji"
          width={32}
          height={32}
          className="h-8 w-8 rounded-md bg-white object-contain p-1"
        />
        <div className="flex items-center gap-3">
          <span>WIP P1 Lot Qty by Effective Date and Process</span>
          {loading && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-400/20 px-3 py-1 text-xs font-semibold text-blue-100 backdrop-blur-sm border border-blue-300/30">
              <span className="h-2 w-2 rounded-full bg-blue-300 animate-ping" />
              Loading Data...
            </span>
          )}
        </div>
        <ManualModal />
      </h1>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 16,
          marginBottom: 20,
          padding: 16,
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <div className="w-64 min-w-[240px]">
          <ModernDateRangePicker
            startDate={dateFrom}
            endDate={dateTo}
            onChange={(start, end) => {
              setDateFrom(start);
              setDateTo(end);
            }}
            minDate={dataDateRange.min}
            maxDate={dataDateRange.max}
            align="left"
          />
        </div>

        <MultiSelectFilter
          label="Process"
          icon={<Workflow size={16} />}
          options={allProcessOptions}
          selected={selectedProcesses}
          onChange={setSelectedProcesses}
        />

        {/* สถานะ Lot ในรูปแบบ Checkbox */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50">
          <Tags size={16} className="text-slate-400 shrink-0" />
          <span className="text-sm font-semibold text-slate-700 mr-1 select-none">
            Lot Status:
          </span>
          <div className="flex items-center gap-3">
            {allLotStatusOptions.map((status) => {
              const isChecked = selectedLotStatus.includes(status);
              return (
                <label
                  key={status}
                  className={`flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none px-2 py-1 rounded-lg transition-all ${
                    isChecked
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      if (isChecked) {
                        // ปรับรายการสถานะที่เลือก
                        const next = selectedLotStatus.filter((s) => s !== status);
                        setSelectedLotStatus(next);
                      } else {
                        setSelectedLotStatus([...selectedLotStatus, status]);
                      }
                    }}
                    className="w-3.5 h-3.5 accent-blue-600 rounded cursor-pointer"
                  />
                  <span>{status}</span>
                </label>
              );
            })}
          </div>
        </div>

        <SingleSelectFilter
          label="Group"
          icon={<Factory size={16} />}
          options={["SMT", "E-FPC"]}
          selected={selectedGroup}
          onChange={setSelectedGroup}
        />

        <SingleSelectFilter
          label="Group WIP"
          icon={<Warehouse size={16} />}
          options={["WIP Storage", "WIP Production"]}
          selected={selectedWipGroup}
          onChange={setSelectedWipGroup}
        />

        <MultiSelectFilter
          label="Product Name"
          icon={<PackageSearch size={16} />}
          options={allProductOptions}
          selected={selectedProducts}
          onChange={setSelectedProducts}
        />

        <MultiSelectFilter
          label="Lot No"
          icon={<Hash size={16} />}
          options={allLotNoOptions}
          selected={selectedLotNo}
          onChange={setSelectedLotNo}
        />

        <MultiSelectFilter
          label="Lead Time"
          icon={<Clock3 size={16} />}
          options={allLeadTimeGroupOptions}
          selected={selectedLeadTimeGroups}
          onChange={setSelectedLeadTimeGroups}
        />

        {/* ปุ่ม Action การล้างค่า Filter (ชิดขวาเสมอ) */}
        <div className="ml-auto flex items-center gap-3">
          {(dateFrom ||
            dateTo ||
            selectedProducts.length > 0 ||
            selectedProcesses.length > 0 ||
            selectedLotStatus.length !== 1 ||
            selectedLotStatus[0] !== "WIP" ||
            selectedGroup !== "all" ||
            selectedWipGroup !== "all" ||
            selectedLotNo.length > 0 ||
            selectedLeadTimeGroups.length > 0) && (
              <button
                type="button"
                className="group flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-rose-400 to-amber-500 border border-rose-300 shadow-lg shadow-rose-500/20 hover:shadow-xl hover:from-rose-500 hover:to-amber-600 active:scale-95 transition-all"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setSelectedProducts([]);
                  setSelectedProcesses([]);
                  setSelectedLotStatus(["WIP"]);
                  setSelectedLotNo([]);
                  setSelectedLeadTimeGroups([]);
                  setSelectedGroup("all");
                  setSelectedWipGroup("all");
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4 transition-transform group-hover:rotate-90"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 8.586L6.293 4.879a1 1 0 10-1.414 1.414L8.586 10l-3.707 3.707a1 1 0 101.414 1.414L10 11.414l3.707 3.707a1 1 0 001.414-1.414L11.414 10l3.707-3.707a1 1 0 00-1.414-1.414L10 8.586z"
                    clipRule="evenodd"
                  />
                </svg>
                Clear
              </button>
            )}


          <button
            type="button"
            className="group flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-emerald-400 to-teal-500 border border-emerald-300 shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:from-emerald-500 hover:to-teal-600 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!dailyP1Rows.length}
            onClick={() => setIsExportDialogOpen(true)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 transition-transform group-hover:translate-y-0.5"
            >
              <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
              <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
            </svg>
            Export Data
          </button>
        </div>

        <div className="hidden">
          {[
            {
              key: "process",
              label: "Wip History",
              icon: (
                <svg
                  className="w-4 h-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <rect x="3" y="12" width="4" height="8" rx="1" />
                  <rect x="10" y="7" width="4" height="13" rx="1" />
                  <rect x="17" y="3" width="4" height="17" rx="1" />
                </svg>
              ),
            },
            {
              key: "semiGroup",
              label: "Semi Group",
              icon: (
                <svg
                  className="w-4 h-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                  />
                </svg>
              ),
            },
          ].map((button) => (
            <button
              key={button.key}
              type="button"
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all bg-gradient-to-r ${viewMode === button.key
                ? "from-blue-600 to-indigo-500 text-white border border-blue-400 shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-600"
                : "from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 hover:from-blue-100 hover:to-indigo-100"
                }`}
              onClick={() => setViewMode(button.key as "process" | "semiGroup")}
            >
              {button.icon}
              {button.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-2xl border border-slate-200 bg-white shadow-xs"
        style={{
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          fontSize: 13,
        }}
      >
        {" "}
        {/* ป้ายคำอธิบายสีกลุ่ม Lead Time */}
        <span className="text-xs font-black uppercase tracking-wider text-slate-500 shrink-0 mr-1">
          Lead Time :
        </span>
        {leadTimeGroupList.map((group) => (
          <div
            key={group.key}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs"
            style={{
              backgroundColor: `${group.color}0D`,
              border: `1.5px solid ${group.color}45`,
            }}
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{
                backgroundColor: group.color,
                boxShadow: `0 0 0 2px ${group.color}25`,
              }}
            />
            <span style={{ color: "#334155" }}>{group.name}</span>
          </div>
        ))}
        {/* Divider */}
        <span className="w-px h-5 bg-slate-200 mx-1 shrink-0" />
        {/* ป้ายคำอธิบายเส้น Total Target */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border border-rose-200 bg-rose-50/60 shadow-xs"
          key="total-target-legend"
        >
          <span
            className="w-5 h-0 border-t-2 shrink-0"
            style={{
              borderColor: "#dc2626",
              borderWidth: "2.5px",
              borderStyle: "dashed",
            }}
          />
          <span className="text-rose-700 font-bold">Total Target</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${viewMode === "process" ? "bg-blue-600 text-white border border-blue-600 shadow-md shadow-blue-500/20 hover:bg-blue-700" : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100/80"}`}
            onClick={() => setViewMode("process")}
          >
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <rect x="3" y="12" width="4" height="8" rx="1" />
              <rect x="10" y="7" width="4" height="13" rx="1" />
              <rect x="17" y="3" width="4" height="17" rx="1" />
            </svg>
            Wip History
          </button>
          <button
            type="button"
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${viewMode === "semiGroup" ? "bg-blue-600 text-white border border-blue-600 shadow-md shadow-blue-500/20 hover:bg-blue-700" : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100/80"}`}
            onClick={() => setViewMode("semiGroup")}
          >
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
              />
            </svg>
            Semi Group
          </button>
        </div>
      </div>

      <div className="w-full">
        {loading && dailyData.length === 0 ? (
          renderLoadingSkeleton()
        ) : viewMode === "process" ? (
          <>
            <div
              className="rounded-3xl border border-slate-200 bg-white p-4"
              style={{
                boxShadow:
                  "0 10px 40px -4px rgba(0,0,0,0.18), 0 4px 16px -2px rgba(0,0,0,0.10)",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-slate-700">
                  WIP History
                </div>
                {selectedDate && selectedChartId === "main" && (
                  <button
                    onClick={clearStackSelection}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                  >
                    <span>Clear Selection</span>
                    <span>×</span>
                  </button>
                )}
              </div>

              {/* Dedicated Top Full-Width Tooltip Panel */}
              {selectedDate && selectedChartId === "main" && (() => {
                const selectedRow = chartData.find((d) => d.date === selectedDate);
                if (!selectedRow) return null;
                const selectedGroup = selectedStackKey
                  ? leadTimeGroupList.find((g) => g.key === selectedStackKey)
                  : null;

                const leadTimeItems = Object.keys(selectedRow)
                  .filter((key) => key.startsWith("lead_") && Number(selectedRow[key]) > 0 && (!selectedStackKey || key === selectedStackKey))
                  .map((key) => {
                    const group = leadTimeGroupList.find((g) => g.key === key);
                    return {
                      key,
                      name: group ? group.name : key.replace("lead_", ""),
                      color: group ? group.color : "#cbd5e1",
                      value: Number(selectedRow[key]),
                    };
                  });

                const selectedProcessPrefix = selectedStackKey ? `leadproc:${selectedStackKey}:` : null;
                const processItems = Object.keys(selectedRow)
                  .filter((key) =>
                    selectedProcessPrefix
                      ? key.startsWith(selectedProcessPrefix) && Number(selectedRow[key]) > 0
                      : key.startsWith("proc_") && Number(selectedRow[key]) > 0
                  )
                  .map((key) => {
                    const rawName = selectedProcessPrefix
                      ? decodeURIComponent(key.slice(selectedProcessPrefix.length))
                      : key.replace("proc_", "").replace(/_/g, " ");
                    const process = processList.find(
                      (p) => p.name === rawName || p.key === key || p.name.replace(/\s+/g, "_") === key.replace("proc_", "")
                    );
                    const fallbackIdx = allProcessOptions.indexOf(rawName);
                    const color = selectedGroup?.color || (process ? process.color : generateDistinctColor(fallbackIdx >= 0 ? fallbackIdx : 0, allProcessOptions.length));
                    return {
                      key,
                      name: process ? process.name : rawName,
                      color,
                      value: Number(selectedRow[key]),
                    };
                  })
                  .sort((a, b) => String(a.name).localeCompare(String(b.name)));

                const totalVal = selectedStackKey && leadTimeItems.length === 1
                  ? leadTimeItems[0].value
                  : (selectedRow.total ?? 0);

                return (
                  <div className="mb-4 rounded-2xl border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/30 p-4 shadow-sm transition-all animate-fadeIn">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-slate-400">Date:</span>
                          <span className="text-sm font-black text-slate-800">{selectedRow.label}</span>
                        </div>
                        {selectedGroup ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black border cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                            onClick={() => openDrillDown(selectedRow.date, selectedGroup.name, null, selectedGroup.color)}
                            title="คลิกเพื่อดูรายละเอียดล็อตของกลุ่มนี้"
                            style={{
                              backgroundColor: `${selectedGroup.color}15`,
                              borderColor: `${selectedGroup.color}45`,
                              color: selectedGroup.color,
                            }}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedGroup.color }} />
                            {selectedGroup.name}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            All Stacks (Whole Day)
                          </span>
                        )}
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-50 border border-blue-200/80 text-xs font-black text-blue-700">
                          <span>{selectedStackKey ? "Stack Total:" : "Day Total:"}</span>
                          <span className="text-sm">{totalVal.toLocaleString()}</span>
                        </div>
                        {selectedRow.target !== undefined && selectedRow.target !== null && (
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-rose-50 border border-rose-200 text-xs font-black text-rose-600">
                            <span>Target:</span>
                            <span>{Number(selectedRow.target).toLocaleString()}</span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => openDrillDown(selectedRow.date, selectedGroup?.name || null, null, selectedGroup?.color || "#6366f1")}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
                        title="View details for all lots in this selection"
                      >
                        <PackageSearch className="w-3.5 h-3.5 text-indigo-600" />
                        <span>View All Lots ({totalVal.toLocaleString()} Lots)</span>
                      </button>
                    </div>

                    {/* Lead Time Group Breakdown */}
                    {leadTimeItems.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            {selectedStackKey ? "Selected Lead Time Group" : "Lead Time Breakdown (All Groups)"}
                          </div>
                          <span className="text-[10px] font-bold text-indigo-500 italic">
                            💡 Click group to view Lots & Aging details
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                          {leadTimeItems.map((item) => (
                            <div
                              key={item.key}
                              onClick={() => openDrillDown(selectedRow.date, item.name, null, item.color)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs border transition-all cursor-pointer hover:scale-105 hover:shadow-md active:scale-95 group/lt"
                              style={{
                                backgroundColor: `${item.color}15`,
                                borderColor: `${item.color}70`,
                              }}
                              title={`Click to view lots in group ${item.name}`}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 group-hover/lt:scale-125 transition-transform"
                                style={{
                                  backgroundColor: item.color,
                                  boxShadow: `0 0 0 2px ${item.color}35`,
                                }}
                              />
                              <span style={{ color: "#1e293b" }}>{item.name}:</span>
                              <span className="font-black text-slate-900">{item.value.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Process Breakdown */}
                    {processItems.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            {selectedStackKey ? `Process in ${selectedGroup?.name || "Group"}` : "Process Breakdown"}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-indigo-500 italic">
                              💡 Click process to view Lots & Aging details
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {processItems.length} items
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center max-h-60 overflow-y-auto p-1">
                          {processItems.map((item) => {
                            const isHex = item.color.startsWith("#");
                            const bgStyle = isHex ? `${item.color}18` : item.color.replace("hsl", "hsla").replace(")", ", 0.12)");
                            const borderStyle = isHex ? `${item.color}B3` : item.color.replace("hsl", "hsla").replace(")", ", 0.85)");
                            const ringStyle = isHex ? `${item.color}40` : item.color.replace("hsl", "hsla").replace(")", ", 0.35)");

                            return (
                              <div
                                key={item.key}
                                onClick={() => openDrillDown(selectedRow.date, selectedGroup?.name || null, item.name, item.color)}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer hover:scale-105 hover:shadow-md active:scale-95 group/proc"
                                style={{
                                  backgroundColor: bgStyle,
                                  borderWidth: "1.5px",
                                  borderStyle: "solid",
                                  borderColor: borderStyle,
                                }}
                                title={`Click to view lots in process: ${item.name}`}
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0 group-hover/proc:scale-125 transition-transform"
                                  style={{
                                    backgroundColor: item.color,
                                    boxShadow: `0 0 0 2.5px ${ringStyle}`,
                                  }}
                                />
                                <span style={{ color: "#1e293b" }}>{item.name}:</span>
                                <span className="font-black text-slate-900">{item.value.toLocaleString()}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {visibleChartData.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-16 text-center text-sm font-medium text-slate-500">
                  No data matching filters
                </div>
              ) : (
                <div
                  style={{
                    width: "100%",
                    overflowX: "auto",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "stretch",
                      width: "max-content",
                      minWidth: "100%",
                    }}
                  >
                    <div
                      style={{
                        position: "sticky",
                        left: 0,
                        zIndex: 20,
                        flex: "none",
                        width: 44,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#fff",
                      }}
                    >
                      <div
                        style={{
                          writingMode: "vertical-rl",
                          transform: "rotate(180deg)",
                          fontSize: 12,
                          color: "#475569",
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                        }}
                      >
                        Total Lot No.
                      </div>
                    </div>
                    <StickyYAxis
                      yAxisMax={yAxisMax}
                      height={600}
                      width={58}
                      topMargin={92}
                    />
                    <div style={{ height: 600, position: "relative" }}>
                      <WipEChart
                        chartId="main"
                        data={visibleChartData}
                        yAxisMax={yAxisMax}
                        minStackValue={mainMinStackValue}
                        barSize={dynamicMaxBarSize}
                        showComparisonArea={showComparisonArea}
                        leadTimeGroupColors={LEAD_TIME_GROUP_COLORS}
                        leadTimeGroupList={leadTimeGroupList}
                        processList={processList}
                        selectedChartId={selectedChartId}
                        selectedDate={selectedDate}
                        selectedStackKey={selectedStackKey}
                        onSelectStack={selectStack}
                        onSelectWholeDay={(cId, date) => {
                          if (
                            selectedChartId === cId &&
                            selectedDate === date &&
                            selectedStackKey === null
                          ) {
                            clearStackSelection();
                          } else {
                            setSelectedChartId(cId);
                            setSelectedStackKey(null);
                            setSelectedDate(date);
                          }
                        }}
                        onClearSelection={clearStackSelection}
                        height={600}
                        minWidth={Math.max(visibleChartData.length * (dynamicMaxBarSize + 2) + 200, 760)}
                        topMargin={92}
                        hideYAxisLabels={true}
                        enableScroll={false}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 mt-6 lg:grid-cols-2">
              {(["E-FPC", "SMT"] as const).map((group) => {
                const data = processGroupSummaryData[group];
                // ปรับสเกลแกน Y ให้สอดคล้องกับค่าขั้นต่ำของ Stack
                const initialMaxValue = Math.max(
                  100,
                  ...(data || []).map((row) =>
                    Math.max(
                      row.total_all || 0,
                      row.total || 0,
                      row.target || 0,
                    ),
                  ),
                );
                const initialYMax = Math.ceil(initialMaxValue * 1.15) || 100;

                // ปรับให้ส่วนของแท่งที่มีขนาดเล็กมากสามารถอ่านค่าและคลิกได้ง่ายขึ้น
                const minStackValue = getMinimumStackValueForPixels(
                  initialYMax,
                  10,
                  524,
                );
                const stackMax = Math.max(
                  100,
                  ...(data || []).map((row) =>
                    LEAD_TIME_GROUP_COLORS.reduce(
                      (sum, item) =>
                        sum +
                        Number(
                          row[
                          `lead_${item.name.replace(/[^a-zA-Z0-9]/g, "_")}`
                          ] || 0,
                        ),
                      0,
                    ),
                  ),
                );

                const maxTarget = Math.max(
                  0,
                  ...(data || []).map((row) => row.target || 0),
                );
                const finalMaxValue = Math.max(100, initialMaxValue, maxTarget);
                const yMax = Math.ceil(finalMaxValue * 1.15) || 100;

                const chartId = `summary-${group}`;
                const isSelected = selectedDate && selectedChartId === chartId;

                return (
                  <div
                    key={group}
                    className="rounded-3xl border border-slate-200 bg-white p-4"
                    style={{
                      boxShadow:
                        "0 10px 40px -4px rgba(0,0,0,0.18), 0 4px 16px -2px rgba(0,0,0,0.10)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-slate-700">
                        {group}
                      </div>
                      {isSelected && (
                        <button
                          onClick={clearStackSelection}
                          className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                        >
                          <span>Clear Selection</span>
                          <span>×</span>
                        </button>
                      )}
                    </div>

                    {/* แผงแสดงข้อมูลรายละเอียด (Tooltip Panel) ด้านบนสำหรับกราฟย่อย */}
                    {isSelected && (() => {
                      const selectedRow = data.find((d) => d.date === selectedDate);
                      if (!selectedRow) return null;
                      const selectedGroup = selectedStackKey
                        ? leadTimeGroupList.find((g) => g.key === selectedStackKey)
                        : null;

                      const leadTimeItems = Object.keys(selectedRow)
                        .filter((key) => key.startsWith("lead_") && Number(selectedRow[key]) > 0 && (!selectedStackKey || key === selectedStackKey))
                        .map((key) => {
                          const grp = leadTimeGroupList.find((g) => g.key === key);
                          return {
                            key,
                            name: grp ? grp.name : key.replace("lead_", ""),
                            color: grp ? grp.color : "#cbd5e1",
                            value: Number(selectedRow[key]),
                          };
                        });

                      const selectedProcessPrefix = selectedStackKey ? `leadproc:${selectedStackKey}:` : null;
                      const processItems = Object.keys(selectedRow)
                        .filter((key) =>
                          selectedProcessPrefix
                            ? key.startsWith(selectedProcessPrefix) && Number(selectedRow[key]) > 0
                            : key.startsWith("proc_") && Number(selectedRow[key]) > 0
                        )
                        .map((key) => {
                          const rawName = selectedProcessPrefix
                            ? decodeURIComponent(key.slice(selectedProcessPrefix.length))
                            : key.replace("proc_", "").replace(/_/g, " ");
                          const process = processList.find(
                            (p) => p.name === rawName || p.key === key || p.name.replace(/\s+/g, "_") === key.replace("proc_", "")
                          );
                          const fallbackIdx = allProcessOptions.indexOf(rawName);
                          const color = selectedGroup?.color || (process ? process.color : generateDistinctColor(fallbackIdx >= 0 ? fallbackIdx : 0, allProcessOptions.length));
                          return {
                            key,
                            name: process ? process.name : rawName,
                            color,
                            value: Number(selectedRow[key]),
                          };
                        })
                        .sort((a, b) => String(a.name).localeCompare(String(b.name)));

                      const totalVal = selectedStackKey && leadTimeItems.length === 1
                        ? leadTimeItems[0].value
                        : (selectedRow.total ?? 0);

                      return (
                        <div className="mb-4 rounded-2xl border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/30 p-4 shadow-sm transition-all animate-fadeIn">
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Date:</span>
                                <span className="text-sm font-black text-slate-800">{selectedRow.label}</span>
                              </div>
                              {selectedGroup ? (
                                <span
                                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black border cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                                  onClick={() => openDrillDown(selectedRow.date, selectedGroup.name, null, selectedGroup.color)}
                                  title="คลิกเพื่อดูรายละเอียดล็อตของกลุ่มนี้"
                                  style={{
                                    backgroundColor: `${selectedGroup.color}15`,
                                    borderColor: `${selectedGroup.color}45`,
                                    color: selectedGroup.color,
                                  }}
                                >
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedGroup.color }} />
                                  {selectedGroup.name}
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                  All Stacks (Whole Day)
                                </span>
                              )}
                              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-50 border border-blue-200/80 text-xs font-black text-blue-700">
                                <span>{selectedStackKey ? "Stack Total:" : "Day Total:"}</span>
                                <span className="text-sm">{totalVal.toLocaleString()}</span>
                              </div>
                            </div>

                            <button
                              onClick={() => openDrillDown(selectedRow.date, selectedGroup?.name || null, null, selectedGroup?.color || "#6366f1")}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
                              title="View details for all lots in this selection"
                            >
                              <PackageSearch className="w-3.5 h-3.5 text-indigo-600" />
                              <span>View All Lots ({totalVal.toLocaleString()} Lots)</span>
                            </button>
                          </div>

                          {/* Lead Time Group Breakdown */}
                          {leadTimeItems.length > 0 && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                  {selectedStackKey ? "Selected Lead Time Group" : "Lead Time Breakdown (All Groups)"}
                                </div>
                                <span className="text-[10px] font-bold text-indigo-500 italic">
                                  💡 Click group to view Lots & Aging details
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2 items-center">
                                {leadTimeItems.map((item) => (
                                  <div
                                    key={item.key}
                                    onClick={() => openDrillDown(selectedRow.date, item.name, null, item.color)}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs border transition-all cursor-pointer hover:scale-105 hover:shadow-md active:scale-95 group/lt"
                                    style={{
                                      backgroundColor: `${item.color}15`,
                                      borderColor: `${item.color}70`,
                                    }}
                                    title={`Click to view lots in group ${item.name}`}
                                  >
                                    <span
                                      className="w-2.5 h-2.5 rounded-full shrink-0 group-hover/lt:scale-125 transition-transform"
                                      style={{
                                        backgroundColor: item.color,
                                        boxShadow: `0 0 0 2px ${item.color}35`,
                                      }}
                                    />
                                    <span style={{ color: "#1e293b" }}>{item.name}:</span>
                                    <span className="font-black text-slate-900">{item.value.toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Process Breakdown */}
                          {processItems.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                  {selectedStackKey ? `Process in ${selectedGroup?.name || "Group"}` : "Process Breakdown"}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-indigo-500 italic">
                                    💡 Click process to view Lots & Aging details
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                    {processItems.length} items
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 items-center max-h-52 overflow-y-auto p-1">
                                {processItems.map((item) => {
                                  const isHex = item.color.startsWith("#");
                                  const bgStyle = isHex ? `${item.color}18` : item.color.replace("hsl", "hsla").replace(")", ", 0.12)");
                                  const borderStyle = isHex ? `${item.color}B3` : item.color.replace("hsl", "hsla").replace(")", ", 0.85)");
                                  const ringStyle = isHex ? `${item.color}40` : item.color.replace("hsl", "hsla").replace(")", ", 0.35)");

                                  return (
                                    <div
                                      key={item.key}
                                      onClick={() => openDrillDown(selectedRow.date, selectedGroup?.name || null, item.name, item.color)}
                                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer hover:scale-105 hover:shadow-md active:scale-95 group/proc"
                                      style={{
                                        backgroundColor: bgStyle,
                                        borderWidth: "1.5px",
                                        borderStyle: "solid",
                                        borderColor: borderStyle,
                                      }}
                                      title={`Click to view lots in process: ${item.name}`}
                                    >
                                      <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0 group-hover/proc:scale-125 transition-transform"
                                        style={{
                                          backgroundColor: item.color,
                                          boxShadow: `0 0 0 2.5px ${ringStyle}`,
                                        }}
                                      />
                                      <span style={{ color: "#1e293b" }}>{item.name}:</span>
                                      <span className="font-black text-slate-900">{item.value.toLocaleString()}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {data.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                        No data for {group}
                      </div>
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          overflowX: "auto",
                          WebkitOverflowScrolling: "touch",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "stretch",
                            width: "max-content",
                            minWidth: "100%",
                          }}
                        >
                          <div
                            style={{
                              position: "sticky",
                              left: 0,
                              zIndex: 20,
                              flex: "none",
                              width: 44,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "#fff",
                            }}
                          >
                            <div
                              style={{
                                writingMode: "vertical-rl",
                                transform: "rotate(180deg)",
                                fontSize: 12,
                                color: "#475569",
                                fontWeight: 600,
                                letterSpacing: "0.06em",
                              }}
                            >
                              Total Lot No.
                            </div>
                          </div>
                          <StickyYAxis
                            yAxisMax={yMax}
                            height={600}
                            width={58}
                            topMargin={84}
                          />
                          <div style={{ height: 600, position: "relative" }}>
                            <WipEChart
                              chartId={`summary-${group}`}
                              data={data}
                              yAxisMax={yMax}
                              stackMax={stackMax}
                              hasDualYAxis={false}
                              minStackValue={minStackValue}
                              barSize={summaryBarSize}
                              showComparisonArea={true}
                              leadTimeGroupColors={LEAD_TIME_GROUP_COLORS}
                              leadTimeGroupList={leadTimeGroupList}
                              processList={processList}
                              selectedChartId={selectedChartId}
                              selectedDate={selectedDate}
                              selectedStackKey={selectedStackKey}
                              onSelectStack={selectStack}
                              onSelectWholeDay={(cId, date) => {
                                if (
                                  selectedChartId === cId &&
                                  selectedDate === date &&
                                  selectedStackKey === null
                                ) {
                                  clearStackSelection();
                                } else {
                                  setSelectedChartId(cId);
                                  setSelectedStackKey(null);
                                  setSelectedDate(date);
                                }
                              }}
                              onClearSelection={clearStackSelection}
                              height={600}
                              minWidth={Math.max(data.length * (summaryBarSize + 2) + 200, 600)}
                              topMargin={84}
                              hideYAxisLabels={true}
                              enableScroll={false}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            {SEMI_GROUPS.map((semiGroup) => {
              const data = semiGroupChartData[semiGroup];
              // ปรับสเกลแกน Y ให้สอดคล้องกับค่าขั้นต่ำของ Stack
              // ปรับสเกลของแต่ละ Semi Group ตามยอดรวมของตัวเอง เพื่อป้องกันไม่ให้เป้าหมายรวมทำให้แท่งกราฟแบน
              const initialGroupMax = Math.max(
                100,
                ...(data || []).map((row) =>
                  Math.max(
                    row.total_all || 0,
                    row.total || 0,
                    row.target || 0,
                  ),
                ),
              );
              const initialGroupYAxisMax =
                Math.ceil(initialGroupMax * 1.15) || 100;

              // ปรับให้ส่วนของแท่งที่มีขนาดเล็กมากสามารถอ่านค่าและคลิกได้ง่ายขึ้น
              const minStackValue = getMinimumStackValueForPixels(
                initialGroupYAxisMax,
                10,
                524,
              );
              const stackMax = Math.max(
                100,
                ...(data || []).map((row) =>
                  LEAD_TIME_GROUP_COLORS.reduce(
                    (sum, item) =>
                      sum +
                      Number(
                        row[
                        `lead_${item.name.replace(/[^a-zA-Z0-9]/g, "_")}`
                        ] || 0,
                      ),
                    0,
                  ),
                ),
              );

              const maxTarget = Math.max(
                0,
                ...(data || []).map((row) => row.target || 0),
              );
              const finalGroupMax = Math.max(100, initialGroupMax, maxTarget);
              const groupYAxisMax = Math.ceil(finalGroupMax * 1.15) || 100;

              const chartId = `semi-${semiGroup}`;
              const isSelected = selectedDate && selectedChartId === chartId;

              return (
                <div
                  key={semiGroup}
                  className="rounded-2xl border border-slate-200 bg-white p-4 min-h-[588px]"
                  style={{
                    boxShadow:
                      "0 10px 40px -4px rgba(0,0,0,0.18), 0 4px 16px -2px rgba(0,0,0,0.10)",
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-slate-700">
                      {semiGroup}
                    </div>
                    {isSelected && (
                      <button
                        onClick={clearStackSelection}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                      >
                        <span>Clear Selection</span>
                        <span>×</span>
                      </button>
                    )}
                  </div>

                  {/* แผงแสดงข้อมูลรายละเอียดด้านบนสำหรับกราฟกลุ่ม Semi Group */}
                  {isSelected && (() => {
                    const selectedRow = data.find((d) => d.date === selectedDate);
                    if (!selectedRow) return null;
                    const selectedGroup = selectedStackKey
                      ? leadTimeGroupList.find((g) => g.key === selectedStackKey)
                      : null;

                    const leadTimeItems = Object.keys(selectedRow)
                      .filter((key) => key.startsWith("lead_") && Number(selectedRow[key]) > 0 && (!selectedStackKey || key === selectedStackKey))
                      .map((key) => {
                        const grp = leadTimeGroupList.find((g) => g.key === key);
                        return {
                          key,
                          name: grp ? grp.name : key.replace("lead_", ""),
                          color: grp ? grp.color : "#cbd5e1",
                          value: Number(selectedRow[key]),
                        };
                      });

                    const selectedProcessPrefix = selectedStackKey ? `leadproc:${selectedStackKey}:` : null;
                    const processItems = Object.keys(selectedRow)
                      .filter((key) =>
                        selectedProcessPrefix
                          ? key.startsWith(selectedProcessPrefix) && Number(selectedRow[key]) > 0
                          : key.startsWith("proc_") && Number(selectedRow[key]) > 0
                      )
                      .map((key) => {
                        const rawName = selectedProcessPrefix
                          ? decodeURIComponent(key.slice(selectedProcessPrefix.length))
                          : key.replace("proc_", "").replace(/_/g, " ");
                        const process = processList.find(
                          (p) => p.name === rawName || p.key === key || p.name.replace(/\s+/g, "_") === key.replace("proc_", "")
                        );
                        const fallbackIdx = allProcessOptions.indexOf(rawName);
                        const color = selectedGroup?.color || (process ? process.color : generateDistinctColor(fallbackIdx >= 0 ? fallbackIdx : 0, allProcessOptions.length));
                        return {
                          key,
                          name: process ? process.name : rawName,
                          color,
                          value: Number(selectedRow[key]),
                        };
                      })
                      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

                    const totalVal = selectedStackKey && leadTimeItems.length === 1
                      ? leadTimeItems[0].value
                      : (selectedRow.total ?? 0);

                    return (
                      <div className="mb-4 rounded-2xl border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/30 p-4 shadow-sm transition-all animate-fadeIn">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Date:</span>
                              <span className="text-sm font-black text-slate-800">{selectedRow.label}</span>
                            </div>
                            {selectedGroup ? (
                              <span
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black border cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                                onClick={() => openDrillDown(selectedRow.date, selectedGroup.name, null, selectedGroup.color)}
                                title="คลิกเพื่อดูรายละเอียดล็อตของกลุ่มนี้"
                                style={{
                                  backgroundColor: `${selectedGroup.color}15`,
                                  borderColor: `${selectedGroup.color}45`,
                                  color: selectedGroup.color,
                                }}
                              >
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedGroup.color }} />
                                {selectedGroup.name}
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                All Stacks (Whole Day)
                              </span>
                            )}
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-50 border border-blue-200/80 text-xs font-black text-blue-700">
                              <span>{selectedStackKey ? "Stack Total:" : "Day Total:"}</span>
                              <span className="text-sm">{totalVal.toLocaleString()}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => openDrillDown(selectedRow.date, selectedGroup?.name || null, null, selectedGroup?.color || "#6366f1")}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
                            title="View details for all lots in this selection"
                          >
                            <PackageSearch className="w-3.5 h-3.5 text-indigo-600" />
                            <span>View All Lots ({totalVal.toLocaleString()} Lots)</span>
                          </button>
                        </div>

                        {/* Lead Time Group Breakdown */}
                        {leadTimeItems.length > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                {selectedStackKey ? "Selected Lead Time Group" : "Lead Time Breakdown (All Groups)"}
                              </div>
                              <span className="text-[10px] font-bold text-indigo-500 italic">
                                💡 Click group to view Lots & Aging details
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                              {leadTimeItems.map((item) => (
                                <div
                                  key={item.key}
                                  onClick={() => openDrillDown(selectedRow.date, item.name, null, item.color)}
                                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs border transition-all cursor-pointer hover:scale-105 hover:shadow-md active:scale-95 group/lt"
                                  style={{
                                    backgroundColor: `${item.color}15`,
                                    borderColor: `${item.color}70`,
                                  }}
                                  title={`Click to view lots in group ${item.name}`}
                                >
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0 group-hover/lt:scale-125 transition-transform"
                                    style={{
                                      backgroundColor: item.color,
                                      boxShadow: `0 0 0 2px ${item.color}35`,
                                    }}
                                  />
                                  <span style={{ color: "#1e293b" }}>{item.name}:</span>
                                  <span className="font-black text-slate-900">{item.value.toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Process Breakdown */}
                        {processItems.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                {selectedStackKey ? `Process in ${selectedGroup?.name || "Group"}` : "Process Breakdown"}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-indigo-500 italic">
                                  💡 Click process to view Lots & Aging details
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                  {processItems.length} items
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center max-h-52 overflow-y-auto p-1">
                              {processItems.map((item) => {
                                const isHex = item.color.startsWith("#");
                                const bgStyle = isHex ? `${item.color}18` : item.color.replace("hsl", "hsla").replace(")", ", 0.12)");
                                const borderStyle = isHex ? `${item.color}B3` : item.color.replace("hsl", "hsla").replace(")", ", 0.85)");
                                const ringStyle = isHex ? `${item.color}40` : item.color.replace("hsl", "hsla").replace(")", ", 0.35)");

                                return (
                                  <div
                                    key={item.key}
                                    onClick={() => openDrillDown(selectedRow.date, selectedGroup?.name || null, item.name, item.color)}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer hover:scale-105 hover:shadow-md active:scale-95 group/proc"
                                    style={{
                                      backgroundColor: bgStyle,
                                      borderWidth: "1.5px",
                                      borderStyle: "solid",
                                      borderColor: borderStyle,
                                    }}
                                    title={`Click to view lots in process: ${item.name}`}
                                  >
                                    <span
                                      className="w-2.5 h-2.5 rounded-full shrink-0 group-hover/proc:scale-125 transition-transform"
                                      style={{
                                        backgroundColor: item.color,
                                        boxShadow: `0 0 0 2.5px ${ringStyle}`,
                                      }}
                                    />
                                    <span style={{ color: "#1e293b" }}>{item.name}:</span>
                                    <span className="font-black text-slate-900">{item.value.toLocaleString()}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {!data || !data.length ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
                      No data for this group
                    </div>
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        overflowX: "auto",
                        WebkitOverflowScrolling: "touch",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "stretch",
                          width: "max-content",
                          minWidth: "100%",
                        }}
                      >
                        <div
                          style={{
                            position: "sticky",
                            left: 0,
                            zIndex: 20,
                            flex: "none",
                            width: 44,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#fff",
                          }}
                        >
                          <div
                            style={{
                              writingMode: "vertical-rl",
                              transform: "rotate(180deg)",
                              fontSize: 12,
                              color: "#475569",
                              fontWeight: 600,
                              letterSpacing: "0.06em",
                            }}
                          >
                            Total Lot No.
                          </div>
                        </div>
                        <StickyYAxis
                          yAxisMax={groupYAxisMax}
                          height={600}
                          width={58}
                          topMargin={84}
                        />
                        <div style={{ height: 600, position: "relative" }}>
                          <WipEChart
                            chartId={`semi-${semiGroup}`}
                            data={data}
                            yAxisMax={groupYAxisMax}
                            stackMax={stackMax}
                            hasDualYAxis={false}
                            minStackValue={minStackValue}
                            barSize={semiChartBarSize}
                            showComparisonArea={true}
                            leadTimeGroupColors={LEAD_TIME_GROUP_COLORS}
                            leadTimeGroupList={leadTimeGroupList}
                            processList={processList}
                            selectedChartId={selectedChartId}
                            selectedDate={selectedDate}
                            selectedStackKey={selectedStackKey}
                            onSelectStack={selectStack}
                            onSelectWholeDay={(cId, date) => {
                              if (
                                selectedChartId === cId &&
                                selectedDate === date &&
                                selectedStackKey === null
                              ) {
                                clearStackSelection();
                              } else {
                                setSelectedChartId(cId);
                                setSelectedStackKey(null);
                                setSelectedDate(date);
                              }
                            }}
                            onClearSelection={clearStackSelection}
                            height={600}
                            minWidth={Math.max(data.length * (semiChartBarSize + 2) + 200, 600)}
                            topMargin={84}
                            hideYAxisLabels={true}
                            enableScroll={false}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {isExportDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                <FileSpreadsheet size={20} className="text-emerald-600" />
                Export WIP History
              </h2>
              <button
                type="button"
                aria-label="Close export dialog"
                onClick={() => setIsExportDialogOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Graph
            </label>
            <select
              value={exportGraph}
              onChange={(event) => setExportGraph(event.target.value)}
              className="mb-5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="main">WIP History (Main)</option>
              <option value="efpc">E-FPC Summary</option>
              <option value="smt">SMT Summary</option>
              {SEMI_GROUPS.map((group) => (
                <option key={group} value={`semi:${group}`}>
                  {group}
                </option>
              ))}
            </select>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Period
            </label>
            <select
              value={exportPeriod}
              onChange={(event) =>
                setExportPeriod(
                  event.target.value as "current" | "day" | "month",
                )
              }
              className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="current">Current filter range</option>
              <option value="day">Specific day</option>
              <option value="month">Specific month</option>
            </select>
            {exportPeriod === "day" && (
              <input
                type="date"
                value={exportDate}
                onChange={(event) => setExportDate(event.target.value)}
                className="mb-5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            )}
            {exportPeriod === "month" && (
              <input
                type="month"
                value={exportMonth}
                onChange={(event) => setExportMonth(event.target.value)}
                className="mb-5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsExportDialogOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Export Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drill-down Modal แสดงรายละเอียดล็อต, Product Name, Aging Days */}
      <WipDetailModal
        isOpen={drillDownModalOpen}
        onClose={() => setDrillDownModalOpen(false)}
        date={drillDownParams.date}
        leadTimeGroupName={drillDownParams.leadTimeGroupName}
        leadTimeColor={drillDownParams.leadTimeColor}
        processName={drillDownParams.processName}
        items={drillDownParams.items}
      />
    </main>
  );
};

export default Page;
