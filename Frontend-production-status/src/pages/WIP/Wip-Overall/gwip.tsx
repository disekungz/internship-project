/**
 * หน้าจอ: WIP Overall (ภาพรวมงานคงค้างในกระบวนการผลิต)
 * - แสดงสถานะงาน WIP แบบ Real-time ตามกลุ่มกระบวนการผลิต, ลูกค้า, ผลิตภัณฑ์, Lead Time
 * - มีกราฟสรุป ECharts และตารางรายละเอียด พร้อมระบบ Filter และส่งออก Excel
 */
import React, { useState, useEffect, useMemo } from "react";
import {
  BadgeCheck,
  Boxes,
  Building2,
  Calendar,
  CalendarDays,
  Clock3,
  Download,
  Filter,
  Hash,
  Layers,
  Package,
  ScanLine,
  UsersRound,
  Workflow,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { WipTaskItem } from "./types";
import FujiLogo from "../../../assets/icon/Fuji.png";
import { API_REFRESH_INTERVAL, API_TASKS_URL } from "./api/config";
import { customerMapping } from "./constants";
import { parseThaiDate, getScanInRaw } from "./utils";
import { SearchableSelect } from "./components/SearchableSelect";
import { MultiSearchableSelect } from "./components/MultiSearchableSelect";
import { WipOverallEChart } from "./components/WipOverallEChart";
import { ManualOverallModal } from "./components/ManualOverallModal";
import { ModernDateRangePicker } from "@/components/ModernDateRangePicker";
import {
  getBrowserCache,
  removeLegacyLocalCache,
  setBrowserCache,
} from "@/utility/browserCache";
import { loadXlsx } from "@/utility/loadXlsx";
// โหลดไลบรารี exportStyledExcel แบบ Dynamic เมื่อต้องการใช้งาน

let wipOverallLastFetchAt = 0;

const Page = () => {
  const [tasks, setTasks] = useState<WipTaskItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [selectedLot, setSelectedLot] = useState<string>("All");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedProcesses, setSelectedProcesses] = useState<string[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedLotStatus, setSelectedLotStatus] = useState<string[]>(["WIP"]);
  const [selectedProcessGroup, setSelectedProcessGroup] =
    useState<string>("All");
  const [selectedLeadTimeGroup, setSelectedLeadTimeGroup] =
    useState<string>("All");
  const [selectedFactory, setSelectedFactory] = useState<"9" | "E">("9");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [syncCountdown, setSyncCountdown] = useState<number>(
    API_REFRESH_INTERVAL / 1000,
  );

  const fetchTasks = async (isBackground = false) => {
    try {
      const response = await fetch(API_TASKS_URL);
      if (response.status === 304) {
        // ข้อมูลบน Server ไม่เปลี่ยนแปลง ใช้ข้อมูลปัจจุบันต่อได้
        setLoading(false);
        return;
      }
      if (!response.ok)
        throw new Error(`WIP API returned HTTP ${response.status}`);
      const resData = await response.json();
      const allTasks = Array.isArray(resData) ? resData : [];
      if (allTasks.length === 0) {
        setLoading(false);
        return;
      }

      const uniqueLotProcessDateSet = new Set<string>();
      const mappedData = allTasks.map((item: any) => {
        if (item.status !== "wip") return item;

        const procName = item.process || "General";
        let groupResult = "EFPC_GEN";

        if (procName.includes("AT-")) {
          groupResult = "EFPC_AUTO";
        } else if (procName.includes("M")) {
          groupResult = "SMT";
        }

        // สูตรหาค่า Lead Time = วันที่อ้างอิง - วันที่ Scan In (ลบกัน)
        const scanInRawStr = getScanInRaw(item) || "-";
        const scanInObj = parseThaiDate(scanInRawStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const refObj = endDate
          ? (() => {
              const d = new Date(endDate);
              d.setHours(0, 0, 0, 0);
              return d;
            })()
          : today;
        let calculatedLeadTime = item.lead_time || 0;
        if (scanInObj && scanInRawStr !== "-") {
          const s = new Date(scanInObj);
          s.setHours(0, 0, 0, 0);
          calculatedLeadTime = Math.floor(
            (refObj.getTime() - s.getTime()) / (1000 * 60 * 60 * 24),
          );
        }
        const currentLeadTime = calculatedLeadTime < 0 ? 0 : calculatedLeadTime;
        let ltGroupResult = "Less 1 Day";
        if (currentLeadTime >= 1 && currentLeadTime <= 3) {
          ltGroupResult = "More 1 Day";
        } else if (currentLeadTime > 3) {
          ltGroupResult = "More 3 Days";
        }

        const scanInDate =
          item.wip_by_date || item.update_date || item.db_date || "-";
        const lotKey = `${item.lot || "unknown"}_${procName}_${scanInDate}`;

        let countValue = 0;
        if (
          item.lot &&
          scanInDate !== "-" &&
          !uniqueLotProcessDateSet.has(lotKey)
        ) {
          uniqueLotProcessDateSet.add(lotKey);
          countValue = 1;
        }

        const prefix = item.text ? item.text.substring(0, 3) : "";
        const customerResult = customerMapping[prefix] || "Other";
        return {
          ...item,
          group: groupResult,
          lead_time: currentLeadTime,
          lt_group: ltGroupResult,
          wip_by_date: scanInDate,
          lot_count: countValue,
          customer_group: customerResult,
        };
      });

      setTasks(mappedData);
      wipOverallLastFetchAt = Date.now();
      setBrowserCache("wip-overall-cache-v2", mappedData).catch((cacheError) =>
        console.warn("Unable to save WIP cache:", cacheError),
      );
      setBrowserCache(
        "wip-overall-cache-v2:saved-at",
        wipOverallLastFetchAt,
      ).catch((cacheError) =>
        console.warn("Unable to save WIP cache timestamp:", cacheError),
      );
    } catch (error) {
      console.error(
        "🚨 ไม่สามารถดึงข้อมูลแดชบอร์ดได้:",
        error,
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    removeLegacyLocalCache("wip-overall-cache-v1");
    // 1. อ่านแคชในเบราว์เซอร์ทันทีที่โหลดหน้าจอเพื่อแสดงผลข้อมูลทันทีโดยไม่ต้องรอ
    const initData = async () => {
      try {
        const [cached, cachedAt] = await Promise.all([
          getBrowserCache<WipTaskItem[]>("wip-overall-cache-v2"),
          getBrowserCache<number>("wip-overall-cache-v2:saved-at"),
        ]);
        if (cached?.length) {
          setTasks(cached);
          setLoading(false);
          wipOverallLastFetchAt = Number(cachedAt || 0);
        }
      } catch (e) {
        console.warn("Unable to read local cache:", e);
      }
      // 2. ดึงข้อมูลล่าสุดจาก API ในเบื้องหลัง
      await fetchTasks();
    };
    initData();
  }, []);

  useEffect(() => {
    const streamUrl = API_TASKS_URL.replace(
      /\/wip_tasks\/?$/,
      "/wip_tasks/stream",
    );
    const events = new EventSource(streamUrl);
    events.addEventListener("wip-update", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        if (!Array.isArray(payload)) return;
        // ดึงข้อมูลใหม่อย่างเงียบๆ เบื้องหลังเพื่อไม่ให้กราฟกระพริบ
        void fetchTasks(true);
      } catch (error) {
        console.warn("Unable to apply live WIP update:", error);
      }
    });
    events.onerror = () => undefined;
    return () => events.close();
  }, []);

  const resetFilters = () => {
    setSelectedLot("All");
    setSelectedProducts([]);
    setSelectedProcesses([]);
    setSelectedCustomers([]);
    setSelectedLotStatus(["WIP"]);
    setSelectedProcessGroup("All");
    setSelectedLeadTimeGroup("All");
    setStartDate("");
    setEndDate("");
  };

  const handleExportExcel = async () => {
    if (!filteredWipTasks.length) {
      alert("No data to export.");
      return;
    }

    const dataToExport = filteredWipTasks.map((task) => ({
      Factory:
        task.factory === "9"
          ? "P1"
          : task.factory === "E"
            ? "K1"
            : task.factory || "-",
      "Lot ID": task.lot || "-",
      "Total Lot": Number(task.lot_count || 0),
      "Product Name": task.text || "-",
      "Customer Group": task.customer_group || "Other",
      "Lot Status": task.lot_status || "WIP",
      "Pending Remark": task.pending_remark || "-",
      Group: task.group || "-",
      Process: task.process || "-",
      "Input Qty": Number(task.input_qty || 0),
      "WIP Scan In": getScanInRaw(task) || "-",
      "WIP by Date": task.wip_by_date || "-",
      "Lead Time Wip (Days)": Number(task.lead_time || 0),
    }));

    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = today.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;

    const fileName = `WIP_Overall_${formattedDate}.xlsx`;

    const { exportStyledExcel } = await import(
      "@/utility/Service/xlxs/exportStyledExcel"
    );

    await exportStyledExcel({
      title: "WIP OVERALL REPORT",
      metadata: {
        "Factory Filter":
          selectedFactory === "ALL"
            ? "All Factories (P1 / K1)"
            : selectedFactory === "9"
              ? "P1"
              : selectedFactory === "E"
                ? "K1"
                : selectedFactory,
        "Customer Group":
          selectedCustomers.length > 0
            ? selectedCustomers.join(", ")
            : "All Customer Groups",
        "Export Date": new Date().toLocaleString("th-TH"),
        "Total Items": `${dataToExport.length} Records`,
      },
      data: dataToExport,
      fileName,
      sheetName: "WIP Overall",
      themeColor: "teal",
      showTotalRow: true,
      totalColumns: ["Total Lot", "Input Qty"],
    });
  };

  const wipBaseTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.status === "wip" &&
          (selectedFactory === "ALL" || task.factory === selectedFactory),
      ),
    [tasks, selectedFactory],
  );
  const {
    lotOptions,
    productOptions,
    processOptions,
    customerOptions,
    lotStatusOptions,
    processGroupOptions,
  } = useMemo(
    () => ({
      lotOptions: [
        "All",
        ...Array.from(
          new Set(wipBaseTasks.map((t) => t.lot).filter(Boolean)),
        ).sort(),
      ],
      productOptions: [
        "All",
        ...Array.from(
          new Set(wipBaseTasks.map((t) => t.text || "Unknown Product")),
        ).sort(),
      ],
      processOptions: [
        "All",
        ...Array.from(
          new Set(wipBaseTasks.map((t) => t.process || "General")),
        ).sort(),
      ],
      customerOptions: [
        "All",
        ...Array.from(
          new Set(wipBaseTasks.map((t) => t.customer_group || "Other")),
        ).sort(),
      ],
      lotStatusOptions: Array.from(
        new Set(wipBaseTasks.map((t) => t.lot_status || "WIP")),
      ).sort((a, b) => {
        if (a === "WIP") return -1;
        if (b === "WIP") return 1;
        return a.localeCompare(b);
      }),
      processGroupOptions: [
        "All",
        ...Array.from(
          new Set(wipBaseTasks.map((t) => t.group || "EFPC_GEN")),
        ).sort(),
      ],
    }),
    [wipBaseTasks],
  );
  const leadTimeOptions = ["All", "Less 1 Day", "More 1 Day", "More 3 Days"];

  const filteredWipTasks = useMemo(
    () =>
      wipBaseTasks.filter((task) => {
        const lotPass = selectedLot === "All" || task.lot === selectedLot;
        const productPass =
          selectedProducts.length === 0 || selectedProducts.includes(task.text);
        const processPass =
          selectedProcesses.length === 0 ||
          selectedProcesses.includes(task.process);
        const customerPass =
          selectedCustomers.length === 0 ||
          selectedCustomers.includes(task.customer_group || "Other");
        const lotStatusPass =
          selectedLotStatus.length === 0 ||
          selectedLotStatus.includes(task.lot_status || "WIP");
        const processGroupPass =
          selectedProcessGroup === "All" || task.group === selectedProcessGroup;
        const textLeadTimePass =
          selectedLeadTimeGroup === "All" ||
          task.lt_group === selectedLeadTimeGroup;

        const scanInRaw = getScanInRaw(task);
        const scanInDateObj = parseThaiDate(scanInRaw);
        const startBound = startDate ? new Date(startDate + "T00:00:00") : null;
        const endBound = endDate ? new Date(endDate + "T23:59:59") : null;
        const hasDateFilter = !!(startDate || endDate);
        const datePass = !hasDateFilter
          ? true
          : !scanInDateObj
            ? false
            : (!startBound || scanInDateObj >= startBound) &&
              (!endBound || scanInDateObj <= endBound);
        return (
          lotPass &&
          productPass &&
          processPass &&
          customerPass &&
          lotStatusPass &&
          processGroupPass &&
          textLeadTimePass &&
          datePass
        );
      }),
    [
      wipBaseTasks,
      selectedLot,
      selectedProducts,
      selectedProcesses,
      selectedCustomers,
      selectedLotStatus,
      selectedProcessGroup,
      selectedLeadTimeGroup,
      startDate,
      endDate,
    ],
  );

  const hasActiveFilters =
    selectedLot !== "All" ||
    selectedProducts.length > 0 ||
    selectedProcesses.length > 0 ||
    selectedCustomers.length > 0 ||
    selectedLotStatus.length !== 1 ||
    selectedLotStatus[0] !== "WIP" ||
    selectedProcessGroup !== "All" ||
    selectedLeadTimeGroup !== "All" ||
    !!startDate ||
    !!endDate;

  const {
    totalLotCountSum,
    kpiData,
    sortedChartData,
    maxAxisY,
    yStep,
    yTickCount,
    groupBoundaries,
  } = useMemo(() => {
    const totalLotCountSum = filteredWipTasks.reduce(
      (acc, curr) => acc + (curr.lot_count || 0),
      0,
    );
    const initGroupKpi = () => ({ total: 0, less1: 0, range1to3: 0, more3: 0 });
    const kpiData = {
      EFPC_AUTO: initGroupKpi(),
      SMT: initGroupKpi(),
      EFPC_GEN: initGroupKpi(),
    };

    filteredWipTasks.forEach((task) => {
      if (task.lot_count === 1) {
        const g =
          task.group === "EFPC_AUTO" ||
          task.group === "SMT" ||
          task.group === "EFPC_GEN"
            ? task.group
            : "EFPC_GEN";
        kpiData[g].total++;
        if (task.lt_group === "Less 1 Day") kpiData[g].less1++;
        else if (task.lt_group === "More 1 Day") kpiData[g].range1to3++;
        else if (task.lt_group === "More 3 Days") kpiData[g].more3++;
      }
    });

    const groupOrder = ["EFPC_AUTO", "EFPC_GEN", "SMT"];
    const processGroups: {
      [key: string]: {
        name: string;
        group: string;
        less1: number;
        range1to3: number;
        more3: number;
        total: number;
      };
    } = {};

    filteredWipTasks.forEach((task) => {
      const proc = task.process || "General";
      const groupName = task.group || "EFPC_GEN";
      const ltGroup = task.lt_group || "Less 1 Day";

      if (!processGroups[proc]) {
        processGroups[proc] = {
          name: proc,
          group: groupName,
          less1: 0,
          range1to3: 0,
          more3: 0,
          total: 0,
        };
      }
      if (task.lot_count === 1) {
        if (ltGroup === "Less 1 Day") processGroups[proc].less1++;
        else if (ltGroup === "More 1 Day") processGroups[proc].range1to3++;
        else if (ltGroup === "More 3 Days") processGroups[proc].more3++;
        processGroups[proc].total++;
      }
    });

    const sortedChartData = Object.values(processGroups)
      .filter((d) => d.total > 0)
      .sort((a, b) => {
        if (a.group !== b.group)
          return groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group);
        return a.name.localeCompare(b.name);
      });

    const maxTotalRaw = Math.max(...sortedChartData.map((d) => d.total), 1);
    const getNiceStep = (max: number) => {
      if (max <= 5) return 1;
      if (max <= 10) return 2;
      if (max <= 25) return 5;
      if (max <= 50) return 10;
      if (max <= 100) return 20;
      if (max <= 250) return 50;
      if (max <= 500) return 100;
      if (max <= 1000) return 200;
      return 500;
    };

    const yStep = getNiceStep(maxTotalRaw);
    const maxAxisY = Math.ceil(maxTotalRaw / yStep) * yStep;
    const yTickCount = maxAxisY / yStep + 1;

    const groupBoundaries = groupOrder.map((g) => {
      const itemsInGroup = sortedChartData.filter((d) => d.group === g);
      return { group: g, count: itemsInGroup.length };
    });
    return {
      totalLotCountSum,
      kpiData,
      sortedChartData,
      maxAxisY,
      yStep,
      yTickCount,
      groupBoundaries,
    };
  }, [filteredWipTasks]);

  // รีเซ็ตหน้ากลับไปหน้าที่ 1 เมื่อมีการเปลี่ยน Filter
  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedLot,
    selectedProducts,
    selectedProcesses,
    selectedCustomers,
    selectedLotStatus,
    selectedProcessGroup,
    selectedLeadTimeGroup,
    selectedFactory,
    startDate,
    endDate,
  ]);

  const totalPages = Math.ceil(filteredWipTasks.length / pageSize) || 1;
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredWipTasks.slice(start, start + pageSize);
  }, [filteredWipTasks, currentPage, pageSize]);

  const handleProcessToggle = (processName: string) => {
    setSelectedProcesses((prev) =>
      prev.includes(processName)
        ? prev.filter((p) => p !== processName)
        : [...prev, processName],
    );
  };

  const handleCellClick = (
    type: "product" | "process" | "customer" | "group",
    value: string,
  ) => {
    if (type === "product") {
      setSelectedProducts((prev) =>
        prev.includes(value)
          ? prev.filter((p) => p !== value)
          : [...prev, value],
      );
    } else if (type === "process") {
      handleProcessToggle(value);
    } else if (type === "customer") {
      setSelectedCustomers((prev) =>
        prev.includes(value)
          ? prev.filter((p) => p !== value)
          : [...prev, value],
      );
    } else if (type === "group") {
      setSelectedProcessGroup((prev) => (prev === value ? "All" : value));
    }
  };

  return (
    <main role="main" aria-label="WIP Overall Dashboard" className="h-full w-full overflow-y-auto overflow-x-hidden bg-slate-50 p-4 sm:p-6 text-slate-800">
      <div className="w-full space-y-5 pb-8">
        {/* ================= ส่วนหัวหน้าจอ (Header Section) ================= */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 bg-gradient-to-br from-blue-900 to-blue-500">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-extrabold tracking-tight text-white">
              <img
                src={FujiLogo}
                alt="Fuji"
                width={32}
                height={32}
                className="h-8 w-8 rounded-md bg-white object-contain p-1"
              />
              <span>WIP Monitoring By Process Overall</span>
            </h1>
          </div>

          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-1 gap-1 select-none">
            {(
              [
                { key: "9", label: "P1" },
                { key: "E", label: "K1" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSelectedFactory(opt.key)}
                className={`px-4 py-2 rounded-xl text-sm font-extrabold shadow-lg transition-all duration-300 border-2 ${selectedFactory === opt.key ? "bg-gradient-to-br from-indigo-600 via-blue-700 to-indigo-900 text-white border-indigo-300 shadow-indigo-300/40 scale-110 ring-2 ring-indigo-200" : "bg-gradient-to-br from-slate-50 to-slate-200 text-slate-600 border-slate-200 hover:from-indigo-50 hover:to-blue-100 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-md"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="px-4 py-2 border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 hover:from-amber-100 hover:to-orange-100 text-amber-800 text-[14px] font-extrabold rounded-xl shadow-md hover:shadow-xl transition-all active:scale-95"
              >
                Clear
              </button>
            )}
            <button
              onClick={handleExportExcel}
              disabled={!filteredWipTasks.length}
              className="group flex items-center gap-2 px-5 py-2.5 border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-200 hover:from-emerald-100 hover:to-teal-100 text-emerald-800 text-[14px] font-extrabold rounded-xl shadow-lg hover:shadow-emerald-200/50 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download
                size={14}
                className="transition-transform group-hover:translate-y-0.5"
              />
              Export Data
            </button>
            <ManualOverallModal />
            <div className="bg-gradient-to-br from-blue-700 via-indigo-600 to-blue-900 border-2 border-blue-500/30 rounded-xl px-6 py-2.5 flex flex-col items-center justify-center min-w-[150px] h-[58px] text-center shadow-xl shadow-blue-900/20 hover:shadow-blue-900/30 transition-all">
              <span className="text-3xl font-black leading-none mb-1 bg-gradient-to-r from-cyan-200 via-white to-blue-100 bg-clip-text text-transparent drop-shadow-sm min-h-[30px] flex items-center justify-center">
                {loading ? "..." : totalLotCountSum.toLocaleString()}
              </span>
              <span className="text-[10px] font-extrabold text-blue-100 uppercase tracking-[0.15em] block whitespace-nowrap">
                Count of lot (WIP)
              </span>
            </div>
          </div>
        </div>

        {/* ================= ส่วนแผงตัวกรอง (Filters Grid Section) ================= */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 items-end">
          <div className="w-full">
            <SearchableSelect
              label="Lot ID"
              icon={<Filter size={13} className="text-slate-600" />}
              options={lotOptions}
              selectedValue={selectedLot}
              onSelect={setSelectedLot}
            />
          </div>
          <div className="w-full">
            <MultiSearchableSelect
              label="Product Name"
              icon={<Filter size={13} className="text-slate-600" />}
              options={productOptions}
              selectedValues={selectedProducts}
              onChange={setSelectedProducts}
            />
          </div>
          <div className="w-full">
            <MultiSearchableSelect
              label="Process"
              icon={<Filter size={13} className="text-slate-600" />}
              options={processOptions}
              selectedValues={selectedProcesses}
              onChange={setSelectedProcesses}
            />
          </div>
          <div className="w-full">
            <MultiSearchableSelect
              label="Customer Group"
              icon={<Filter size={13} className="text-slate-600" />}
              options={customerOptions}
              selectedValues={selectedCustomers}
              onChange={setSelectedCustomers}
            />
          </div>
          <div className="w-full">
            <label className="text-[12px] font-bold text-slate-700 mb-1 flex items-center gap-1.5 select-none">
              <Filter size={13} className="text-slate-600" />
              <span>Lot Status</span>
            </label>
            <div className="flex items-center justify-center gap-1.5 h-[38px] px-1.5 rounded-xl border border-slate-200 bg-slate-50">
              {lotStatusOptions.map((status) => {
                const isChecked = selectedLotStatus.includes(status);
                return (
                  <label
                    key={status}
                    className={`flex-1 flex items-center justify-center gap-1 text-xs font-semibold cursor-pointer select-none py-1 px-1.5 rounded-lg transition-all ${
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
                          const next = selectedLotStatus.filter((s) => s !== status);
                          setSelectedLotStatus(next);
                        } else {
                          setSelectedLotStatus([...selectedLotStatus, status]);
                        }
                      }}
                      className="w-3.5 h-3.5 accent-blue-600 rounded cursor-pointer"
                    />
                    <span className="truncate">{status}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="w-full">
            <SearchableSelect
              label="Group"
              icon={<Filter size={13} className="text-slate-600" />}
              options={processGroupOptions}
              selectedValue={selectedProcessGroup}
              onSelect={setSelectedProcessGroup}
            />
          </div>
          <div className="w-full">
            <SearchableSelect
              label="Lead Time Wip"
              icon={<Filter size={13} className="text-slate-600" />}
              options={leadTimeOptions}
              selectedValue={selectedLeadTimeGroup}
              onSelect={setSelectedLeadTimeGroup}
            />
          </div>
          <div className="space-y-1 w-full">
            <ModernDateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(start, end) => {
                setStartDate(start);
                setEndDate(end);
              }}
              label="WIP Scan In"
            />
          </div>
        </div>

        {/* ================= ส่วนกราฟแท่งแบบ STACKED BAR ================= */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
            <h2 className="text-base font-bold text-slate-700">
              Count of lot by Group, Process and Lead Time Group
            </h2>
            <div className="flex gap-6 text-sm font-semibold text-slate-600">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-gradient-to-b from-sky-400 to-blue-600 shadow-md shadow-sky-200/40"></span>
                Less 1 Day
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-gradient-to-b from-violet-400 to-purple-600 shadow-md shadow-violet-200/40"></span>
                More 1 Day
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-gradient-to-b from-amber-400 to-orange-500 shadow-md shadow-amber-200/40"></span>
                More 3 Days
              </div>
            </div>
          </div>

          {loading && tasks.length === 0 ? (
            <div className="h-80 flex flex-col justify-end p-6 gap-3">
              <div className="flex items-end justify-between h-56 gap-3 px-8">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-full bg-slate-100 animate-pulse rounded-t-lg"
                    style={{
                      height: `${25 + (i * 17) % 70}%`,
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-center items-center gap-2 text-slate-400 text-xs mt-4">
                <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                <span>Loading Data WIP Overall...</span>
              </div>
            </div>
          ) : sortedChartData.length === 0 ? (
            <div className="h-80 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
              <span className="text-2xl">📦</span>
              <span>No data found for the selection.</span>
            </div>
          ) : (
            <WipOverallEChart
              data={sortedChartData}
              groupBoundaries={groupBoundaries}
              selectedProcesses={selectedProcesses}
              onProcessToggle={handleProcessToggle}
              maxAxisY={maxAxisY}
            />
          )}
        </div>

        {/* ================= ส่วนตารางแสดงข้อมูล (Data Table Section) ================= */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-gradient-to-br from-blue-900 to-blue-500">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Layers size={16} className="text-white" /> WIP Data
            </h3>
          </div>

          <div className="overflow-x-auto max-h-[350px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-gradient-to-br from-blue-900 to-blue-500 text-white">
                <tr>
                  <th className="p-3 text-center">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <Building2 size={13} />
                      Factory
                    </span>
                  </th>
                  <th className="p-3 text-center">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <Hash size={13} />
                      Lot ID
                    </span>
                  </th>
                  <th className="p-3 text-center">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <Boxes size={13} />
                      Total Lot
                    </span>
                  </th>
                  <th className="p-3 text-center">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <Package size={13} />
                      Product Name
                    </span>
                  </th>
                  <th className="p-3 text-center">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <UsersRound size={13} />
                      Customer Group
                    </span>
                  </th>
                  <th className="p-3 text-center">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <BadgeCheck size={13} />
                      Lot Status
                    </span>
                  </th>
                  <th className="p-3 text-center">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <MessageSquare size={13} />
                      Pending Remark
                    </span>
                  </th>
                  <th className="p-3 text-center">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <Layers size={13} />
                      Group
                    </span>
                  </th>
                  <th className="p-3 text-center">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <Workflow size={13} />
                      Process
                    </span>
                  </th>
                  <th className="p-3 text-center">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <Boxes size={13} />
                      Input Qty
                    </span>
                  </th>
                  <th className="p-3 text-center">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <ScanLine size={13} />
                      WIP Scan In
                    </span>
                  </th>
                  <th className="p-3 text-center">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <CalendarDays size={13} />
                      WIP by Date
                    </span>
                  </th>
                  <th className="p-3 text-center">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <Clock3 size={13} />
                      Lead Time Wip
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedTasks.map((task, index) => {
                  const isProductSelected = selectedProducts.includes(
                    task.text,
                  );
                  const isProcessSelected = selectedProcesses.includes(
                    task.process,
                  );
                  const isCustomerSelected = selectedCustomers.includes(
                    task.customer_group || "Other",
                  );
                  const isGroupSelected = selectedProcessGroup === task.group;
                  const scanInRaw = getScanInRaw(task) || "-";

                  return (
                    <tr
                      key={`${task.lot}-${task.process}-${index}`}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-3 text-center font-bold text-slate-500">
                        {task.factory === "9"
                          ? "P1"
                          : task.factory === "E"
                            ? "K1"
                            : task.factory || "-"}
                      </td>
                      <td className="p-3 text-center font-bold text-indigo-600">
                        {task.lot || "-"}
                      </td>
                      <td className="p-3 text-center font-bold text-slate-500">
                        {task.lot_count}
                      </td>
                      <td
                        onClick={() => handleCellClick("product", task.text)}
                        className={`p-3 text-center cursor-pointer max-w-[150px] truncate ${isProductSelected ? "bg-sky-100 font-bold text-sky-800 rounded" : "font-bold text-slate-700 hover:bg-slate-100"}`}
                      >
                        {task.text || "-"}
                      </td>
                      <td
                        onClick={() =>
                          handleCellClick(
                            "customer",
                            task.customer_group || "Other",
                          )
                        }
                        className={`p-3 text-center cursor-pointer font-bold ${isCustomerSelected ? "bg-pink-100 text-pink-800 rounded" : "text-slate-700 hover:bg-slate-100"}`}
                      >
                        {task.customer_group || "Other"}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wide shadow-sm border transition-all bg-gradient-to-br ${task.lot_status === "PENDING" ? "from-emerald-50 to-emerald-200 text-emerald-700 border-emerald-300 shadow-emerald-200/50" : "from-sky-50 to-blue-100 text-blue-700 border-blue-200 shadow-blue-200/50"}`}
                        >
                          {task.lot_status || "WIP"}
                        </span>
                      </td>
                      <td className="p-3 text-left text-slate-600 font-medium min-w-[150px] max-w-[220px] whitespace-normal break-words leading-tight">
                        {task.pending_remark || "-"}
                      </td>
                      <td
                        onClick={() =>
                          handleCellClick("group", task.group || "EFPC_GEN")
                        }
                        className="p-3 text-center cursor-pointer select-none"
                      >
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wide shadow-sm border transition-all bg-gradient-to-br ${
                            task.group === "EFPC_AUTO"
                              ? isGroupSelected
                                ? "from-purple-600 to-purple-700 text-white border-purple-800 shadow-purple-300/40"
                                : "from-purple-50 to-purple-200 text-purple-700 border-purple-300 shadow-purple-100/40"
                              : task.group === "SMT"
                                ? isGroupSelected
                                ? "from-amber-500 to-yellow-600 text-white border-amber-600 shadow-amber-300/40"
                                : "from-amber-50 to-yellow-100 text-amber-700 border-amber-200 shadow-amber-100/40"
                              : isGroupSelected
                                ? "from-rose-500 to-pink-600 text-white border-rose-600 shadow-rose-300/40"
                                : "from-rose-50 to-pink-200 text-rose-700 border-rose-300 shadow-rose-100/40"
                          }`}
                        >
                          {task.group}
                        </span>
                      </td>
                      <td
                        onClick={() => handleCellClick("process", task.process)}
                        className={`p-3 text-center cursor-pointer font-bold ${isProcessSelected ? "bg-purple-100 text-purple-800 rounded" : "text-slate-700 hover:bg-slate-100"}`}
                      >
                        {task.process || "-"}
                      </td>
                      <td className="p-3 text-center font-bold">
                        {task.input_qty?.toLocaleString() || 0}
                      </td>
                      <td className="p-3 text-center text-slate-500 font-medium">
                        {scanInRaw}
                      </td>
                      <td className="p-3 text-center text-slate-500 font-bold">
                        {task.wip_by_date}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wide shadow-sm border transition-all bg-gradient-to-br ${task.lt_group === "More 3 Days" ? "from-amber-50 to-orange-200 text-amber-700 border-amber-300 shadow-amber-200/50" : task.lt_group === "More 1 Day" ? "from-violet-50 to-purple-200 text-violet-700 border-violet-300 shadow-violet-200/50" : "from-sky-50 to-blue-200 text-sky-700 border-sky-300 shadow-sky-200/50"}`}
                        >{`${task.lead_time || 0} Day${(task.lead_time || 0) > 1 ? "s" : ""}`}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ================= PAGINATION BAR ================= */}
          {filteredWipTasks.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 select-none">
              <div className="flex items-center gap-2">
                <span>Show</span>
                <select
                  aria-label="Items per page"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-300 rounded px-2 py-1 font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
                <span>entries</span>
                <span className="text-slate-400">|</span>
                <span>
                  Showing <b>{Math.min((currentPage - 1) * pageSize + 1, filteredWipTasks.length)}</b> to{" "}
                  <b>{Math.min(currentPage * pageSize, filteredWipTasks.length)}</b> of{" "}
                  <b>{filteredWipTasks.length.toLocaleString()}</b> lots
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Previous page"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed font-medium text-slate-700 flex items-center gap-1"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <div className="px-3 py-1 font-bold text-slate-700">
                  Page {currentPage} of {totalPages}
                </div>
                <button
                  type="button"
                  aria-label="Next page"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed font-medium text-slate-700 flex items-center gap-1"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default Page;
