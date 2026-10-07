import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { getCustomerGroup, getProductProcessType, CHART_COLORS } from "./components/utils";
import ProductNameChart from "./ProductNameChart";
import * as XLSX from "xlsx";
import { ExportModal } from "../../../components/ExportModal";
import { getApiBaseUrl } from "../../../utils/apiConfig";
import { getGranularityDateInfo, isDateInPeriod, OutputGranularity } from "../utils/outputDateUtils";
import { CalendarDays, RefreshCcw, Download, Layers, Package, Award, Building2, BarChart3, MousePointerClick, ArrowLeft, X, Search, Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ProductOutput {
  product_name: string;
  process_name?: string;
  mc_line?: string;
  output_date?: string;
  actual_pcs_qty: number;
  actual_sht_qty: number;
  actual_lot_qty: number;
  output_value?: number; // Used for dynamic unit mode selection
}

type UnitMode = "Piece" | "Sheet" | "Lot";
type DetailViewMode = "Grouped" | "Entries";
type DetailTypeFilter = "All" | "FPC" | "SMT";
type DetailSortMode = "OutputDesc" | "ProductAsc" | "ProcessAsc";

interface ProductDetailGroup {
  product_name: string;
  customerGroup: string;
  processType: string;
  entries: ProductOutput[];
  processCount: number;
  mcLineCount: number;
  actual_pcs_qty: number;
  actual_sht_qty: number;
  actual_lot_qty: number;
  output_value: number;
}

const KNOWN_CUSTOMER_GROUPS = [
  "All Customers",
  "CANON",
  "EPSON",
  "FUJITSU",
  "FUNAI",
  "HITACHI",
  "HONDA",
  "ICHIKO",
  "JAPAN DISPLAY",
  "KENWOOD",
  "KOITO",
  "KYOCERA",
  "MINEBEA",
  "MITSUBISHI",
  "MURATA",
  "NEC",
  "NEST",
  "NIDEC",
  "NIDEC COPAL",
  "NIKON",
  "NMB",
  "OLYMPUS",
  "ORTUSTECH",
  "PANASONIC",
  "PHILIPS",
  "PIONEER",
  "SEIKO",
  "SEKONIC",
  "SOMC",
  "SONY",
  "TAMRON",
  "TOSHIBA",
  "VALEO",
  "Valmet",
  "VISTEON",
  "Z",
  "Other"
];

const ChartSkeleton: React.FC = () => {
  return (
    <div className="w-full min-h-[400px] flex flex-col gap-6 p-2">
      {/* Legend Skeleton */}
      <div className="flex justify-center items-center gap-3 w-full animate-pulse">
        <div className="h-3.5 w-12 bg-base-300 rounded"></div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-4.5 w-16 bg-base-300 rounded-full"></div>
          ))}
        </div>
      </div>

      {/* Bars Skeleton */}
      <div className="flex-1 flex items-end gap-3 md:gap-5 h-[350px] border-b border-l border-base-300 pb-2 pl-2 animate-pulse">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(i => {
          const heights = ["60%", "85%", "40%", "75%", "90%", "50%", "65%", "80%", "35%", "70%", "55%", "45%"];
          return (
            <div key={i} className="flex-1 flex flex-col justify-end gap-1.5 h-full">
              <div className="w-full bg-base-300/40 rounded-t" style={{ height: heights[(i - 1) % heights.length] }}>
                <div className="w-full bg-base-300/60 h-[30%] rounded-t"></div>
                <div className="w-full bg-base-300/40 h-[40%]"></div>
              </div>
              <div className="h-3 w-8 bg-base-200 rounded self-center mt-1"></div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

const getStartOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const Page: React.FC = () => {
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  const [startDate, setStartDate] = useState(getStartOfMonth());
  const [endDate, setEndDate] = useState(getToday());
  const [unitMode, setUnitMode] = useState<UnitMode>("Piece");
  const [granularity, setGranularity] = useState<OutputGranularity>("daily");
  const [selectedChartDate, setSelectedChartDate] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  // Temp states for UI date pickers
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);

  const [productsData, setProductsData] = useState<ProductOutput[]>([]);
  const [previousProductsData, setPreviousProductsData] = useState<ProductOutput[]>([]);
  const [totalProductsCount, setTotalProductsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [processList, setProcessList] = useState<string[]>([]);
  const [filterProcess, setFilterProcess] = useState<string[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [filterCustomerGroup, setFilterCustomerGroup] = useState("All Customers");
  const [isChartReady, setIsChartReady] = useState(false);
  const [detailViewMode, setDetailViewMode] = useState<DetailViewMode>("Grouped");
  const [detailSearchQuery, setDetailSearchQuery] = useState("");
  const [detailProcessFilter, setDetailProcessFilter] = useState("All Processes");
  const [detailCustomerFilter, setDetailCustomerFilter] = useState("All Customers");
  const [detailTypeFilter, setDetailTypeFilter] = useState<DetailTypeFilter>("All");
  const [detailSortMode, setDetailSortMode] = useState<DetailSortMode>("OutputDesc");
  const [expandedDetailProducts, setExpandedDetailProducts] = useState<string[]>([]);
  const [detailPage, setDetailPage] = useState(1);

  // Defer chart rendering to prevent page stutter on load
  useEffect(() => {
    const timer = setTimeout(() => setIsChartReady(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Clear the selected day detail when the data scope changes
  useEffect(() => {
    setSelectedChartDate(null);
  }, [startDate, endDate, filterProcess, granularity]);

  useEffect(() => {
    setDetailSearchQuery("");
    setDetailProcessFilter("All Processes");
    setDetailCustomerFilter("All Customers");
    setDetailTypeFilter("All");
    setDetailSortMode("OutputDesc");
    setExpandedDetailProducts([]);
    setDetailPage(1);
  }, [selectedChartDate]);

  useEffect(() => {
    setDetailPage(1);
  }, [detailViewMode, detailSearchQuery, detailProcessFilter, detailCustomerFilter, detailTypeFilter, detailSortMode]);

  const comparisonPeriod = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const prevEnd = new Date(start.getTime() - (1000 * 60 * 60 * 24));
    const prevStart = new Date(prevEnd.getTime() - (diffDays - 1) * (1000 * 60 * 60 * 24));

    return {
      current: `${startDate} to ${endDate}`,
      prev: `${prevStart.toISOString().split('T')[0]} to ${prevEnd.toISOString().split('T')[0]}`,
      type: 'Period'
    };
  }, [startDate, endDate]);

  // Fetch available processes on mount
  useEffect(() => {
    const fetchProcesses = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/outputbyproduct/processes`);
        if (res.ok) {
          const data = await res.json();
          setProcessList(data);
        }
      } catch (error) {
        console.error("Failed to fetch processes", error);
      }
    };
    fetchProcesses();
  }, [refreshTrigger]);

  // Fetch total products count for percentage calculation
  useEffect(() => {
    const fetchTotalProducts = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/outputbyproduct/products`);
        if (res.ok) {
          const data = await res.json();
          setTotalProductsCount(data.length);
        }
      } catch (error) {
        console.error("Failed to fetch total products count", error);
      }
    };
    fetchTotalProducts();
  }, [refreshTrigger]);

  // Fetch aggregated product data and previous period data
  useEffect(() => {
    const fetchProducts = async () => {
      if (!startDate || !endDate) return;

      setIsLoading(true);
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        const prevEnd = new Date(start.getTime() - (1000 * 60 * 60 * 24));
        const prevStart = new Date(prevEnd.getTime() - (diffDays - 1) * (1000 * 60 * 60 * 24));

        const buildUrl = (sDate: string, eDate: string) => {
          let url = `${getApiBaseUrl()}/outputbyproduct/dashboard-products?`;
          const params = new URLSearchParams();
          params.append("startDate", sDate);
          params.append("endDate", eDate);
          if (filterProcess && filterProcess.length > 0) {
            params.append("process", filterProcess.join(','));
          }
          return url + params.toString();
        };

        // Fetch the current period first and render the chart as soon as it
        // arrives. The previous period is only used by the customer-group
        // (MoM/DoD) cards, so load it in the background to avoid blocking.
        const resCurrent = await fetch(buildUrl(startDate, endDate));
        if (resCurrent.ok) setProductsData(await resCurrent.json());
        setIsLoading(false);
        setIsRefreshing(false);

        fetch(buildUrl(prevStart.toISOString().split('T')[0], prevEnd.toISOString().split('T')[0]))
          .then(resPrev => (resPrev.ok ? resPrev.json() : []))
          .then(prevData => setPreviousProductsData(prevData))
          .catch(() => setPreviousProductsData([]));
      } catch (error) {
        console.error("Failed to fetch products data", error);
        setPreviousProductsData([]);
        setIsLoading(false);
        setIsRefreshing(false);
      }
    };
    fetchProducts();
  }, [startDate, endDate, filterProcess, refreshTrigger]);

  const handleRefresh = () => {
    setIsRefreshing(true);

    // Reset all filters and search states to simulate a browser reload
    setSelectedProduct(null);
    setSelectedChartDate(null);
    setProductSearchQuery("");
    setFilterProcess([]);
    setDetailSearchQuery("");
    setDetailProcessFilter("All Processes");
    setDetailCustomerFilter("All Customers");
    setDetailTypeFilter("All");
    setDetailSortMode("OutputDesc");
    setExpandedDetailProducts([]);
    setDetailPage(1);
    setGranularity("daily");

    const start = getStartOfMonth();
    const end = getToday();

    setEndDate(end);
    setStartDate(start);
    setTempEndDate(end);
    setTempStartDate(start);

    setUnitMode("Piece");
    setFilterCustomerGroup("All Customers");

    setRefreshTrigger(prev => prev + 1);
  };

  const handleExport = () => {
    setExportError("");
    setIsExportModalOpen(true);
  };

  const handleConfirmExport = async (eStartDate: string, eEndDate: string, eProcesses: string[], eUnit: string, eCustomerGroup = filterCustomerGroup) => {
    setIsExporting(true);
    setExportError("");
    try {
      const params = new URLSearchParams();
      params.append("startDate", eStartDate);
      params.append("endDate", eEndDate);

      const res = await fetch(`${getApiBaseUrl()}/outputbyproduct/dashboard-products?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch export data");

      let dataToProcess = await res.json();

      if (eProcesses.length > 0) {
        dataToProcess = dataToProcess.filter((item: any) => eProcesses.some((fp: string) => fp.trim() === item.process_name?.trim()));
      }
      if (eCustomerGroup !== "All Customers") {
        dataToProcess = dataToProcess.filter((item: any) => getCustomerGroup(item.product_name) === eCustomerGroup);
      }
      if (selectedProduct) {
        dataToProcess = dataToProcess.filter((item: any) => item.product_name === selectedProduct);
      }
      if (productSearchQuery.trim() !== "") {
        const query = productSearchQuery.trim().toLowerCase();
        dataToProcess = dataToProcess.filter((item: any) => item.product_name?.toLowerCase().includes(query));
      }

      const dataToExport = dataToProcess.map((item: any) => {
        const row: any = {
          Date: item.output_date,
          Product: item.product_name,
          Process: item.process_name,
          "Customer Group": getCustomerGroup(item.product_name),
        };

        if (eUnit === "All" || eUnit === "Lot") row["Lot Qty"] = Number(item.actual_lot_qty || 0);
        if (eUnit === "All" || eUnit === "Sheet") row["Sheet Qty"] = Number(item.actual_sht_qty || 0);
        if (eUnit === "All" || eUnit === "Piece") row["Piece Qty"] = Number(item.actual_pcs_qty || 0);

        return row;
      });

      if (dataToExport.length === 0) {
        setExportError("No data available for the selected date range and filters.");
        return;
      }

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Output By Product");
      XLSX.writeFile(wb, `OutputByProduct_${eStartDate}_${eEndDate}.xlsx`);

      setExportError("");
      setIsExportModalOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
      setExportError("Cannot export data right now. Please check the company network/API connection and try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleApplyDates = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
  };

  // Process data with selected Unit Mode
  const processedData = useMemo(() => {
    const list = Array.isArray(productsData) ? productsData : [];
    return list.map(item => {
      let outputVal = 0;
      if (unitMode === "Piece") outputVal = Number(item.actual_pcs_qty || 0);
      else if (unitMode === "Sheet") outputVal = Number(item.actual_sht_qty || 0);
      else outputVal = Number(item.actual_lot_qty || 0);

      return {
        ...item,
        output_value: outputVal
      };
    });
  }, [productsData, unitMode]);

  // Map each product name to a stable color
  const productColors = useMemo(() => {
    const colorsMap: Record<string, string> = {};
    const prodArray = Array.isArray(productsData) ? productsData : [];

    const uniqueNames = Array.from(
      new Set(
        prodArray
          .filter(p => (Number(p.actual_pcs_qty) || Number(p.actual_sht_qty) || Number(p.actual_lot_qty)) > 0)
          .map(p => p?.product_name)
          .filter(Boolean)
      )
    ) as string[];

    uniqueNames.sort(); // Stable alphabetical ordering for colors

    uniqueNames.forEach((name, idx) => {
      colorsMap[name] = CHART_COLORS[idx % CHART_COLORS.length];
    });

    return colorsMap;
  }, [productsData]);

  const customerGroupList = useMemo(() => {
    const groups = new Set<string>();
    const list = Array.isArray(productsData) ? productsData : [];
    if (list.length === 0) {
      KNOWN_CUSTOMER_GROUPS.forEach(group => groups.add(group));
    }
    list.forEach(item => {
      if (item.product_name) groups.add(getCustomerGroup(item.product_name));
    });
    return ["All Customers", ...Array.from(groups).filter(group => group !== "All Customers").sort()];
  }, [productsData]);

  const getProductColor = (productName: string) => {
    return productColors[productName] || "#2563eb";
  };

  const allProductNames = useMemo(() => {
    return Object.keys(productColors);
  }, [productColors]);

  // Filter daily chart data based on selected product and search query
  const chartFilteredData = useMemo(() => {
    let list = Array.isArray(processedData) ? processedData : [];
    if (selectedProduct) {
      list = list.filter(item => item.product_name === selectedProduct);
    }
    if (productSearchQuery.trim() !== "") {
      list = list.filter(item =>
        item.product_name.toLowerCase().includes(productSearchQuery.toLowerCase())
      );
    }
    if (filterCustomerGroup !== "All Customers") {
      list = list.filter(item => getCustomerGroup(item.product_name) === filterCustomerGroup);
    }
    return list;
  }, [processedData, selectedProduct, productSearchQuery, filterCustomerGroup]);

  // Group chart data by date for any specified unit mode (Piece, Sheet, Lot)
  const getUnitChartData = useCallback((targetUnit: UnitMode) => {
    let list = Array.isArray(productsData) ? productsData : [];
    if (selectedProduct) {
      list = list.filter(item => item.product_name === selectedProduct);
    }
    if (productSearchQuery.trim() !== "") {
      list = list.filter(item =>
        item.product_name.toLowerCase().includes(productSearchQuery.toLowerCase())
      );
    }
    if (filterCustomerGroup !== "All Customers") {
      list = list.filter(item => getCustomerGroup(item.product_name) === filterCustomerGroup);
    }

    const activeProcsSet = new Set<string>();
    list.forEach(item => {
      if (item.process_name) activeProcsSet.add(item.process_name);
    });
    const finalProcs = Array.from(activeProcsSet).sort((a, b) => a.localeCompare(b));

    const map: Record<string, any> = {};
    const targetDates: string[] = [];
    if (startDate && endDate) {
      let curr = new Date(startDate);
      const end = new Date(endDate);
      while (curr <= end) {
        targetDates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
      }
    } else {
      const uniqueDataDates = Array.from(new Set(list.map(item => item.output_date))).filter(Boolean).sort() as string[];
      targetDates.push(...uniqueDataDates);
    }

    targetDates.forEach(d => {
      const info = getGranularityDateInfo(d, granularity);
      if (!map[info.key]) {
        map[info.key] = {
          date_label: info.label,
          short_label: info.shortLabel,
          tooltip_title: info.tooltipTitle,
          raw_date: info.key,
          granularity,
          total: 0,
          productsSet: new Set<string>()
        };
      }
    });

    list.forEach(item => {
      let outputVal = 0;
      if (targetUnit === "Piece") outputVal = Number(item.actual_pcs_qty || 0);
      else if (targetUnit === "Sheet") outputVal = Number(item.actual_sht_qty || 0);
      else if (targetUnit === "Lot") outputVal = Number(item.actual_lot_qty || 0);

      const d = item.output_date;
      if (!d) return;
      const info = getGranularityDateInfo(d, granularity);
      const k = info.key;
      if (!map[k]) {
        map[k] = {
          date_label: info.label,
          short_label: info.shortLabel,
          tooltip_title: info.tooltipTitle,
          raw_date: k,
          granularity,
          total: 0,
          productsSet: new Set<string>()
        };
      }
      const key = item.process_name;
      if (key) {
        map[k][key] = (map[k][key] || 0) + outputVal;
        map[k].total += outputVal;
      }
      if (item.product_name && outputVal > 0) {
        map[k].productsSet.add(item.product_name);
      }
    });

    const finalData = Object.values(map).map((val: any) => ({
      ...val,
      products: Array.from(val.productsSet)
    })).sort((a: any, b: any) => a.raw_date.localeCompare(b.raw_date));

    return {
      dailyChartData: finalData,
      activeProcesses: finalProcs
    };
  }, [productsData, selectedProduct, productSearchQuery, filterCustomerGroup, startDate, endDate, granularity]);

  const chartDataAndProcs = useMemo(() => getUnitChartData(unitMode), [getUnitChartData, unitMode]);
  const pieceChartData = useMemo(() => getUnitChartData("Piece"), [getUnitChartData]);
  const sheetChartData = useMemo(() => getUnitChartData("Sheet"), [getUnitChartData]);
  const lotChartData = useMemo(() => getUnitChartData("Lot"), [getUnitChartData]);

  // List of unique active processes for colors or calculations
  const activeProcesses = useMemo(() => {
    const list = Array.isArray(chartFilteredData) ? chartFilteredData : [];
    return Array.from(new Set(list.map(item => item.process_name).filter(Boolean)));
  }, [chartFilteredData]);

  const activeProductName = useMemo(() => {
    if (selectedProduct) return selectedProduct;
    const list = Array.isArray(chartFilteredData) ? chartFilteredData : [];
    const uniqueProds = Array.from(new Set(list.map(item => item.product_name).filter(Boolean)));
    if (uniqueProds.length === 1) return uniqueProds[0];
    if (productSearchQuery.trim() !== "") {
      const query = productSearchQuery.trim();
      const matched = uniqueProds.find(p => p.toLowerCase().includes(query.toLowerCase()));
      return matched || query;
    }
    return "All Products";
  }, [chartFilteredData, selectedProduct, productSearchQuery]);

  // Compute overall stats
  const stats = useMemo(() => {
    const total = processedData.reduce((acc, curr) => acc + (curr.output_value || 0), 0);

    const activeProductsSet = new Set<string>();
    processedData.forEach(item => {
      if ((item.output_value || 0) > 0 && item.product_name) {
        activeProductsSet.add(item.product_name);
      }
    });
    const activeProducts = activeProductsSet.size;

    let topProduct: ProductOutput | null = null;
    let maxVal = -1;

    processedData.forEach(item => {
      const val = item.output_value || 0;
      if (val > maxVal) {
        maxVal = val;
        topProduct = item;
      }
    });

    const activeGroups = new Set<string>();
    processedData.forEach(item => {
      if ((item.output_value || 0) > 0 && item.product_name) {
        activeGroups.add(getCustomerGroup(item.product_name));
      }
    });

    return {
      total,
      activeProducts,
      topProduct,
      customerGroupsCount: activeGroups.size
    };
  }, [processedData]);

  // Compute Top Customer Groups and % Change
  const topCustomerGroups = useMemo(() => {
    const groupMap: Record<string, {
      name: string,
      current: { pcs: number, sht: number, lot: number },
      prev: { pcs: number, sht: number, lot: number }
    }> = {};

    const initGroup = (groupName: string) => {
      if (!groupMap[groupName]) {
        groupMap[groupName] = {
          name: groupName,
          current: { pcs: 0, sht: 0, lot: 0 },
          prev: { pcs: 0, sht: 0, lot: 0 }
        };
      }
    };

    const curList = Array.isArray(productsData) ? productsData : [];
    curList.forEach(item => {
      const g = getCustomerGroup(item.product_name);
      initGroup(g);
      groupMap[g].current.pcs += Number(item.actual_pcs_qty || 0);
      groupMap[g].current.sht += Number(item.actual_sht_qty || 0);
      groupMap[g].current.lot += Number(item.actual_lot_qty || 0);
    });

    const prevList = Array.isArray(previousProductsData) ? previousProductsData : [];
    prevList.forEach(item => {
      const g = getCustomerGroup(item.product_name);
      initGroup(g);
      groupMap[g].prev.pcs += Number(item.actual_pcs_qty || 0);
      groupMap[g].prev.sht += Number(item.actual_sht_qty || 0);
      groupMap[g].prev.lot += Number(item.actual_lot_qty || 0);
    });

    const calculateChange = (cur: number, prev: number) => {
      if (prev === 0) return cur > 0 ? 100 : 0;
      return ((cur - prev) / prev) * 100;
    };

    const result = Object.values(groupMap).map(g => ({
      name: g.name,
      current: g.current,
      prev: g.prev,
      changePcs: calculateChange(g.current.pcs, g.prev.pcs),
      changeSht: calculateChange(g.current.sht, g.prev.sht),
      changeLot: calculateChange(g.current.lot, g.prev.lot)
    }));

    result.sort((a, b) => {
      if (unitMode === "Piece") return b.current.pcs - a.current.pcs;
      if (unitMode === "Sheet") return b.current.sht - a.current.sht;
      return b.current.lot - a.current.lot;
    });

    return result.filter(g => g.current.pcs > 0 || g.current.sht > 0 || g.current.lot > 0).slice(0, 5); // top 5
  }, [productsData, previousProductsData, unitMode]);

  // Compute dynamic customer group display values based on active chart filter
  const customerGroupDisplay = useMemo(() => {
    const list = Array.isArray(chartFilteredData) ? chartFilteredData : [];
    const uniqueProds = Array.from(new Set(list.map(item => item.product_name).filter(Boolean)));

    if (selectedProduct || uniqueProds.length === 1) {
      const prodName = selectedProduct || uniqueProds[0];
      return {
        title: "Product Customer Group",
        value: getCustomerGroup(prodName),
        subtitle: `Model: ${prodName}`,
        isSingle: true
      };
    }

    const groups = new Set<string>();
    uniqueProds.forEach(prod => {
      groups.add(getCustomerGroup(prod));
    });

    return {
      title: "Customer Groups",
      value: groups.size.toString(),
      subtitle: "Based on active model codes",
      isSingle: false
    };
  }, [chartFilteredData, selectedProduct]);

  // Compute dynamic top product card values (adaptive to search and selection)
  const topProductCardDisplay = useMemo(() => {
    const hasSearchOrSelection =
      !!selectedProduct ||
      productSearchQuery.trim() !== "";

    if (!hasSearchOrSelection) {
      // All Products state: show the global top product
      return {
        title: "Top Product",
        name: stats.topProduct ? stats.topProduct.product_name : "N/A",
        value: stats.topProduct ? stats.topProduct.output_value || 0 : 0,
        share: stats.topProduct && stats.total > 0
          ? (stats.topProduct.output_value || 0) / stats.total * 100
          : 0,
        isAdaptive: false,
        processType: stats.topProduct ? getProductProcessType(stats.topProduct.product_name) : ""
      };
    }

    // Identify active product name
    let targetName = "";
    if (selectedProduct) {
      targetName = selectedProduct;
    } else if (productSearchQuery.trim() !== "") {
      const query = productSearchQuery.trim().toLowerCase();
      const match = processedData.find(item => item.product_name.toLowerCase().includes(query));
      if (match) targetName = match.product_name;
    }

    const finalName = targetName || selectedProduct || productSearchQuery.trim();

    // Calculate total output for this product
    const productItems = processedData.filter(item => item.product_name.toLowerCase() === finalName.toLowerCase());
    const productTotal = productItems.reduce((sum, item) => sum + (item.output_value || 0), 0);
    const share = stats.total > 0 ? (productTotal / stats.total * 100) : 0;

    const processType = finalName ? getProductProcessType(finalName) : "";

    return {
      title: selectedProduct ? "Selected Product" : "Searched Product",
      name: finalName,
      value: productTotal,
      share: share,
      isAdaptive: true,
      processType: processType
    };
  }, [selectedProduct, productSearchQuery, processedData, stats]);

  // Clicking a bar opens the inline daily-detail panel for that date.
  const handleBarClick = (rawDate: string) => {
    setSelectedChartDate(prev => (prev === rawDate ? null : rawDate));
  };

  const sortDetailRows = (rows: ProductOutput[], sortMode: DetailSortMode) => {
    const sortedRows = [...rows];
    sortedRows.sort((a, b) => {
      if (sortMode === "ProductAsc") return a.product_name.localeCompare(b.product_name);
      if (sortMode === "ProcessAsc") return (a.process_name || "").localeCompare(b.process_name || "");
      return (b.output_value || 0) - (a.output_value || 0);
    });
    return sortedRows;
  };

  const sortDetailGroups = (groups: ProductDetailGroup[], sortMode: DetailSortMode) => {
    const sortedGroups = [...groups];
    sortedGroups.sort((a, b) => {
      if (sortMode === "ProductAsc") return a.product_name.localeCompare(b.product_name);
      if (sortMode === "ProcessAsc") return (a.entries[0]?.process_name || "").localeCompare(b.entries[0]?.process_name || "");
      return b.output_value - a.output_value;
    });
    return sortedGroups;
  };

  const toggleExpandedDetailProduct = (productName: string) => {
    setExpandedDetailProducts(prev =>
      prev.includes(productName)
        ? prev.filter(item => item !== productName)
        : [...prev, productName]
    );
  };

  // Breakdown of every product produced on the selected day (process + qty + share)
  const selectedDayDetail = useMemo(() => {
    if (!selectedChartDate) return null;

    let baseRows = chartFilteredData
      .filter(item => isDateInPeriod(item.output_date || "", selectedChartDate, granularity) && (item.output_value || 0) > 0);

    if (filterProcess && filterProcess.length > 0) {
      baseRows = baseRows.filter(item => filterProcess.includes(item.process_name));
    }

    const processOptions = Array.from(new Set(baseRows.map(row => row.process_name).filter(Boolean))).sort() as string[];
    const customerOptions = Array.from(new Set(baseRows.map(row => getCustomerGroup(row.product_name)).filter(Boolean))).sort();

    let rows = baseRows.filter(row => {
      const query = detailSearchQuery.trim().toLowerCase();
      const productName = row.product_name || "";
      const processName = row.process_name || "";
      const mcLine = row.mc_line || "";
      const customerGroup = getCustomerGroup(productName);
      const processType = getProductProcessType(productName);

      if (query && !`${productName} ${processName} ${mcLine} ${customerGroup}`.toLowerCase().includes(query)) return false;
      if (detailProcessFilter !== "All Processes" && processName !== detailProcessFilter) return false;
      if (detailCustomerFilter !== "All Customers" && customerGroup !== detailCustomerFilter) return false;
      if (detailTypeFilter !== "All" && processType !== detailTypeFilter) return false;
      return true;
    });

    rows = sortDetailRows(rows, detailSortMode);

    const groupMap = new Map<string, ProductDetailGroup>();
    rows.forEach(row => {
      const existing = groupMap.get(row.product_name);
      if (existing) {
        existing.entries.push(row);
        existing.actual_pcs_qty += Number(row.actual_pcs_qty || 0);
        existing.actual_sht_qty += Number(row.actual_sht_qty || 0);
        existing.actual_lot_qty += Number(row.actual_lot_qty || 0);
        existing.output_value += Number(row.output_value || 0);
      } else {
        groupMap.set(row.product_name, {
          product_name: row.product_name,
          customerGroup: getCustomerGroup(row.product_name),
          processType: getProductProcessType(row.product_name),
          entries: [row],
          processCount: 0,
          mcLineCount: 0,
          actual_pcs_qty: Number(row.actual_pcs_qty || 0),
          actual_sht_qty: Number(row.actual_sht_qty || 0),
          actual_lot_qty: Number(row.actual_lot_qty || 0),
          output_value: Number(row.output_value || 0)
        });
      }
    });

    const groupedRows = sortDetailGroups(Array.from(groupMap.values()).map(group => {
      group.processCount = new Set(group.entries.map(row => row.process_name).filter(Boolean)).size;
      group.mcLineCount = new Set(group.entries.map(row => row.mc_line).filter(Boolean)).size;
      group.entries = sortDetailRows(group.entries, detailSortMode);
      return group;
    }), detailSortMode);

    const total = rows.reduce((sum, r) => sum + (r.output_value || 0), 0);
    const baseTotal = baseRows.reduce((sum, r) => sum + (r.output_value || 0), 0);
    const productSet = new Set(rows.map(r => r.product_name));
    const baseProductSet = new Set(baseRows.map(r => r.product_name));
    const topProduct = groupedRows[0];
    const topProcess = Array.from(rows.reduce((map, row) => {
      const key = row.process_name || "N/A";
      map.set(key, (map.get(key) || 0) + (row.output_value || 0));
      return map;
    }, new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1])[0];
    const fpcTotal = rows
      .filter(row => getProductProcessType(row.product_name) === "FPC")
      .reduce((sum, row) => sum + (row.output_value || 0), 0);
    const smtTotal = rows
      .filter(row => getProductProcessType(row.product_name) === "SMT")
      .reduce((sum, row) => sum + (row.output_value || 0), 0);

    return {
      date: selectedChartDate,
      total,
      baseTotal,
      rows,
      groupedRows,
      productCount: productSet.size,
      baseProductCount: baseProductSet.size,
      baseEntryCount: baseRows.length,
      processOptions,
      customerOptions,
      topProduct,
      topProcess,
      fpcTotal,
      smtTotal
    };
  }, [selectedChartDate, chartFilteredData, filterProcess, detailSearchQuery, detailProcessFilter, detailCustomerFilter, detailTypeFilter, detailSortMode, granularity]);

  const renderDetailEntry = (row: ProductOutput, total: number, compact = false, index = 0) => {
    const color = getProductColor(row.product_name);
    const isSel = selectedProduct === row.product_name;
    const pType = getProductProcessType(row.product_name);

    return (
      <div
        key={`${row.product_name}_${row.process_name}_${row.mc_line || "line"}_${index}`}
        onClick={() => setSelectedProduct(isSel ? null : row.product_name)}
        title="Click to focus this product"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setSelectedProduct(isSel ? null : row.product_name);
        }}
        className={`w-full min-h-[58px] cursor-pointer text-left grid grid-cols-[auto_minmax(180px,1.4fr)_auto_minmax(120px,0.9fr)_minmax(180px,1fr)_96px] items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${compact ? "bg-base-100" : ""} ${isSel ? "bg-primary/10 border-primary/40" : "bg-base-200/30 border-base-200 hover:bg-base-200/60"
          }`}
      >
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-sm truncate text-base-content/90">{row.product_name}</span>
          <span className="text-[11px] text-base-content/50 truncate">{getCustomerGroup(row.product_name)}</span>
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${pType === "SMT" ? "bg-rose-500/15 text-rose-600 border-rose-500/20" : "bg-sky-500/15 text-sky-600 border-sky-500/20"
          }`}>
          {pType}
        </span>
        <div className="text-xs font-medium text-base-content/70 truncate hidden sm:flex flex-col justify-center">
          <span className="truncate">{row.process_name}</span>
          {row.mc_line && (
            <span className="text-[10px] text-base-content/50 font-normal truncate mt-0.5">
              MC: {row.mc_line}
            </span>
          )}
        </div>
        <div className="flex-1 flex items-center justify-end gap-4 min-w-0 pr-2">
          {unitMode !== "Lot" && (
            <div className="flex-col items-end hidden sm:flex">
              <span className="text-[9px] uppercase font-bold text-base-content/40 tracking-wider">Lot</span>
              <span className="text-[11px] font-mono text-base-content/70">{(row.actual_lot_qty || 0).toLocaleString()}</span>
            </div>
          )}
          {unitMode !== "Sheet" && (
            <div className="flex-col items-end hidden md:flex">
              <span className="text-[9px] uppercase font-bold text-base-content/40 tracking-wider">Sheet</span>
              <span className="text-[11px] font-mono text-base-content/70">{(row.actual_sht_qty || 0).toLocaleString()}</span>
            </div>
          )}
          {unitMode !== "Piece" && (
            <div className="flex flex-col items-end">
              <span className="text-[9px] uppercase font-bold text-base-content/40 tracking-wider">Piece</span>
              <span className="text-[11px] font-mono text-base-content/70">{(row.actual_pcs_qty || 0).toLocaleString()}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end shrink-0 pl-3 border-l border-base-300">
          <span className="text-[9px] uppercase font-bold text-primary/70 tracking-wider">{unitMode}</span>
          <span className="font-mono font-bold text-sm text-primary">
            {(row.output_value || 0).toLocaleString()}
          </span>
          {total > 0 && (
            <span className="text-[10px] text-base-content/40">
              {(((row.output_value || 0) / total) * 100).toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    );
  };

  const exportProcessOptions = useMemo(() => {
    const names = new Set<string>();
    processList.forEach(name => {
      if (name) names.add(name);
    });
    activeProcesses.forEach(name => {
      if (name) names.add(name);
    });
    filterProcess.forEach(name => {
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [processList, activeProcesses, filterProcess]);

  const detailPageSize = detailViewMode === "Grouped" ? 8 : 12;
  const detailTotalItems = selectedDayDetail
    ? detailViewMode === "Grouped"
      ? selectedDayDetail.groupedRows.length
      : selectedDayDetail.rows.length
    : 0;
  const detailTotalPages = Math.max(1, Math.ceil(detailTotalItems / detailPageSize));
  const detailCurrentPage = Math.min(detailPage, detailTotalPages);
  const detailStartIndex = (detailCurrentPage - 1) * detailPageSize;
  const detailEndIndex = Math.min(detailStartIndex + detailPageSize, detailTotalItems);
  const pagedDetailGroups = selectedDayDetail && detailViewMode === "Grouped"
    ? selectedDayDetail.groupedRows.slice(detailStartIndex, detailEndIndex)
    : [];
  const pagedDetailRows = selectedDayDetail && detailViewMode === "Entries"
    ? selectedDayDetail.rows.slice(detailStartIndex, detailEndIndex)
    : [];

  return (
    <>
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Export Output By Product"
        availableProcesses={exportProcessOptions}
        availableCustomerGroups={customerGroupList}
        defaultStartDate={selectedChartDate || startDate}
        defaultEndDate={selectedChartDate || endDate}
        defaultProcesses={filterProcess}
        defaultCustomerGroup={filterCustomerGroup}
        onConfirmExport={handleConfirmExport}
        isLoading={isExporting}
        errorMessage={exportError}
      />

      <div className="w-full h-full p-4 overflow-y-auto overflow-x-hidden bg-base-200 flex flex-col gap-4">
        {/* Header & Controls */}
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 overflow-hidden shrink-0">
          <div className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-base-content">Output By Product</h2>
              <p className="text-sm text-base-content/60">Actual output summary grouped by product.</p>
              <div className="flex items-center gap-2 mt-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 shadow-sm text-xs font-bold text-primary tracking-wide">
                  <CalendarDays size={14} className="opacity-80" />
                  {formatDate(startDate)}
                  <span className="text-primary/50 mx-1 font-medium">to</span>
                  {formatDate(endDate)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
                className="btn btn-sm btn-outline shadow-sm"
              >
                <RefreshCcw size={14} className={isRefreshing || isLoading ? "animate-spin" : ""} />
                Refresh
              </button>

              <div className="flex items-center bg-base-100 border border-base-300 rounded-lg shadow-sm h-8">
                <div
                  className="relative flex items-center h-full px-3 cursor-pointer hover:bg-base-200 rounded-l-lg transition-colors border-r border-base-300/50"
                  onClick={() => {
                    try { startDateRef.current?.showPicker(); } catch (e) { }
                  }}
                >
                  <span className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mr-2">From Date</span>
                  <span className="text-sm select-none mr-6">{formatDate(tempStartDate)}</span>
                  <CalendarDays size={14} className="opacity-50 absolute right-3 pointer-events-none text-base-content/70" />
                  <input
                    ref={startDateRef}
                    type="date"
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    value={tempStartDate}
                    onChange={(e) => setTempStartDate(e.target.value)}
                    min="2026-01-01"
                    max={tempEndDate > "2026-12-31" ? "2026-12-31" : tempEndDate}
                    onClick={(e) => {
                      e.stopPropagation();
                      try { e.currentTarget.showPicker(); } catch (err) { }
                    }}
                  />
                </div>

                <div
                  className="relative flex items-center h-full px-3 cursor-pointer hover:bg-base-200 rounded-r-lg transition-colors"
                  onClick={() => {
                    try { endDateRef.current?.showPicker(); } catch (e) { }
                  }}
                >
                  <span className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mr-2">To Date</span>
                  <span className="text-sm select-none mr-6">{formatDate(tempEndDate)}</span>
                  <CalendarDays size={14} className="opacity-50 absolute right-3 pointer-events-none text-base-content/70" />
                  <input
                    ref={endDateRef}
                    type="date"
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    value={tempEndDate}
                    onChange={(e) => setTempEndDate(e.target.value)}
                    min={tempStartDate < "2026-01-01" ? "2026-01-01" : tempStartDate}
                    max="2026-12-31"
                    onClick={(e) => {
                      e.stopPropagation();
                      try { e.currentTarget.showPicker(); } catch (err) { }
                    }}
                  />
                </div>
              </div>

              <button
                onClick={handleApplyDates}
                disabled={isLoading}
                className="btn btn-sm btn-primary shadow-sm"
              >
                Search
              </button>

              <button
                onClick={handleExport}
                disabled={isLoading}
                className="btn btn-sm btn-outline btn-success shadow-sm"
              >
                <Download size={14} />
                Export Excel
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          {/* Total Output Card */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 p-5 text-white shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl group-hover:scale-125 transition-transform duration-500"></div>
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">Total Output</span>
                {isLoading ? (
                  <div className="h-9 w-28 bg-white/20 rounded animate-pulse mt-1"></div>
                ) : (
                  <span className="text-3xl font-extrabold tracking-tight mt-1">
                    {stats.total.toLocaleString()}
                  </span>
                )}
              </div>
              <div className="rounded-lg bg-white/15 p-2.5 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
                <Layers className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-300">
              <span className="font-medium bg-white/10 px-2 py-0.5 rounded">Unit: {unitMode}</span>
              <span>Across all active products</span>
            </div>
          </div>

          {/* Active Products Card */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 p-5 text-white shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl group-hover:scale-125 transition-transform duration-500"></div>
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-150">Active Products</span>
                {isLoading ? (
                  <div className="h-9 w-20 bg-white/20 rounded animate-pulse mt-1"></div>
                ) : (
                  <span className="text-3xl font-extrabold tracking-tight mt-1">
                    {stats.activeProducts.toLocaleString()}
                  </span>
                )}
              </div>
              <div className="rounded-lg bg-white/15 p-2.5 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
                <Package className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-teal-200">
              <span
                className="font-medium bg-white/10 px-2 py-0.5 rounded cursor-help"
                title={`Active models: ${stats.activeProducts.toLocaleString()} / Total factory models: ${totalProductsCount.toLocaleString()}`}
              >
                Active: {totalProductsCount > 0 ? ((stats.activeProducts / totalProductsCount) * 100).toFixed(0) : 0}%
              </span>
              <span>Running models output</span>
            </div>
          </div>

          {/* Top Product Card */}
          <div
            onClick={() => {
              if (topProductCardDisplay.isAdaptive) {
                setSelectedProduct(null);
                setProductSearchQuery("");
              }
            }}
            className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 p-5 text-white shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group ${topProductCardDisplay.isAdaptive ? "cursor-pointer ring-2 ring-white/50" : ""
              }`}
            title={topProductCardDisplay.isAdaptive ? "Click to clear selection" : ""}
          >
            <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl group-hover:scale-125 transition-transform duration-500"></div>
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1 w-[80%]">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-150">
                  {topProductCardDisplay.title}
                </span>
                {isLoading ? (
                  <div className="h-8 w-40 bg-white/20 rounded animate-pulse mt-1"></div>
                ) : (
                  <span className="text-2xl font-extrabold tracking-tight mt-1 truncate" title={topProductCardDisplay.name}>
                    {topProductCardDisplay.name}
                  </span>
                )}
              </div>
              <div className="rounded-lg bg-white/15 p-2.5 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
                <Award className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-indigo-200">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium bg-white/10 px-2 py-0.5 rounded">
                  {topProductCardDisplay.value.toLocaleString()} {unitMode}
                </span>
                {topProductCardDisplay.processType && (
                  <span className={`font-medium px-2 py-0.5 rounded text-[11px] whitespace-nowrap shadow-sm border backdrop-blur-sm ${topProductCardDisplay.processType === 'SMT'
                    ? 'bg-rose-500/20 text-rose-100 border-rose-400/30'
                    : 'bg-sky-500/20 text-sky-100 border-sky-400/30'
                    }`}>
                    {topProductCardDisplay.processType}
                  </span>
                )}
              </div>
              <span className="whitespace-nowrap ml-2">
                {topProductCardDisplay.share.toFixed(1)}% share
              </span>
            </div>
          </div>

          {/* Customer Groups Card */}
          <div
            onClick={() => setSelectedProduct(null)}
            className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-sky-800 p-5 text-white shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group ${selectedProduct || customerGroupDisplay.isSingle ? "cursor-pointer ring-2 ring-white/50" : ""
              }`}
            title={selectedProduct || customerGroupDisplay.isSingle ? "Click to clear selection" : ""}
          >
            <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl group-hover:scale-125 transition-transform duration-500"></div>
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1 w-[80%]">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-150">
                  {customerGroupDisplay.title}
                </span>
                {isLoading ? (
                  <div className="h-9 w-24 bg-white/20 rounded animate-pulse mt-1"></div>
                ) : (
                  <span className={`font-extrabold tracking-tight mt-1 truncate ${customerGroupDisplay.isSingle && customerGroupDisplay.value.length > 10 ? "text-2xl" : "text-3xl"
                    }`}>
                    {customerGroupDisplay.value}
                  </span>
                )}
              </div>
              <div className="rounded-lg bg-white/15 p-2.5 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
                <Building2 className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-blue-200">
              <span className="font-medium bg-white/10 px-2 py-0.5 rounded truncate max-w-[65%]">
                {customerGroupDisplay.subtitle}
              </span>
              <span className="text-[10px] opacity-75">
                {selectedProduct || customerGroupDisplay.isSingle ? "Click card to clear" : "Based on active model codes"}
              </span>
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-4 shrink-0 w-full max-w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h3 className="text-base font-semibold text-base-content/80 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="flex items-center flex-wrap gap-1.5">
              {activeProductName !== "All Products" ? (
                <>
                  Output Analytics
                  <span className="text-primary font-bold">— {activeProductName}</span>
                  {topProductCardDisplay.processType && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shadow-sm ${topProductCardDisplay.processType === 'SMT'
                      ? 'bg-rose-500/15 text-rose-600 border-rose-500/20'
                      : 'bg-sky-500/15 text-sky-600 border-sky-500/20'
                      }`}>
                      {topProductCardDisplay.processType}
                    </span>
                  )}
                </>
              ) : (
                `${granularity === 'weekly' ? 'Weekly' : granularity === 'monthly' ? 'Monthly' : 'Daily'} Output Chart (${unitMode})`
              )}
            </span>
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            {/* Granularity Switcher Button Group */}
            <div className="join shadow-sm border border-base-300 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setGranularity("daily")}
                className={`join-item btn btn-xs font-bold ${granularity === "daily" ? "btn-primary" : "btn-ghost bg-base-100 hover:bg-base-200"}`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setGranularity("weekly")}
                className={`join-item btn btn-xs font-bold ${granularity === "weekly" ? "btn-primary" : "btn-ghost bg-base-100 hover:bg-base-200"}`}
              >
                Weekly
              </button>
            </div>

            {(selectedProduct || (productSearchQuery && activeProductName !== "All Products") || selectedChartDate) && (
              <button
                onClick={() => {
                  if (selectedProduct) setSelectedProduct(null);
                  if (productSearchQuery) setProductSearchQuery("");
                  if (selectedChartDate) setSelectedChartDate(null);
                }}
                className="btn btn-xs btn-primary shadow-xs font-bold flex items-center gap-1.5 shrink-0 hover:scale-105 transition-transform"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {selectedChartDate ? (granularity === 'weekly' ? "Back to All Weeks" : granularity === 'monthly' ? "Back to All Months" : "Back to All Days") : "Back to All Products"}
              </button>
            )}
          </div>
        </div>

          {!isChartReady || isLoading ? (
            <ChartSkeleton />
          ) : processedData.length > 0 ? (
            <ProductNameChart
              data={chartDataAndProcs.dailyChartData}
              unit={unitMode}
              setUnitMode={setUnitMode}
              multiUnitData={
                activeProductName !== "All Products"
                  ? {
                    pieceData: pieceChartData.dailyChartData,
                    sheetData: sheetChartData.dailyChartData,
                    lotData: lotChartData.dailyChartData
                  }
                  : undefined
              }
              activeProcesses={chartDataAndProcs.activeProcesses}
              filterProcess={filterProcess}
              setFilterProcess={setFilterProcess}
              processList={processList}
              productSearchQuery={productSearchQuery}
              setProductSearchQuery={setProductSearchQuery}
              allProductNames={allProductNames}
              activeProductName={activeProductName}
              activeProductType={getProductProcessType(activeProductName)}
              onBarClick={handleBarClick}
              selectedDate={selectedChartDate}
              filterCustomerGroup={filterCustomerGroup}
              setFilterCustomerGroup={setFilterCustomerGroup}
              customerGroupList={customerGroupList}
            />
          ) : (
            <div className="w-full min-h-[400px] flex items-center justify-center text-base-content/50">
              No data to display
            </div>
          )}
        </div>

        {/* Daily Product Detail Panel — opens when a chart bar is clicked */}
        {selectedDayDetail && (
          <div className="bg-base-100 rounded-xl shadow-sm border border-primary/30 ring-1 ring-primary/10 p-4 shrink-0 w-full max-w-full overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                  <CalendarDays className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-base-content/90">
                    Daily Detail - {new Date(selectedDayDetail.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </h3>
                  <p className="text-xs text-base-content/60 mt-0.5">
                    {selectedDayDetail.productCount} of {selectedDayDetail.baseProductCount} products · {selectedDayDetail.rows.length} of {selectedDayDetail.baseEntryCount} entries · Total{" "}
                    <span className="font-semibold text-base-content/80">{selectedDayDetail.total.toLocaleString()} {unitMode}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="join">
                  {(["Grouped", "Entries"] as DetailViewMode[]).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDetailViewMode(mode)}
                      className={`join-item btn btn-xs ${detailViewMode === mode ? "btn-primary" : "btn-outline"}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setSelectedChartDate(null)}
                  className="btn btn-sm btn-ghost gap-1 text-base-content/60 hover:text-base-content shrink-0"
                >
                  <X className="w-4 h-4" /> Close
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
              <div className="rounded-lg border border-base-200 bg-base-200/30 px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-base-content/45">Top Product</div>
                <div className="text-sm font-bold truncate text-base-content/90" title={selectedDayDetail.topProduct?.product_name || ""}>
                  {selectedDayDetail.topProduct?.product_name || "N/A"}
                </div>
                <div className="text-[11px] text-base-content/55">
                  {(selectedDayDetail.topProduct?.output_value || 0).toLocaleString()} {unitMode}
                </div>
              </div>
              <div className="rounded-lg border border-base-200 bg-base-200/30 px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-base-content/45">Top Process</div>
                <div className="text-sm font-bold truncate text-base-content/90">{selectedDayDetail.topProcess?.[0] || "N/A"}</div>
                <div className="text-[11px] text-base-content/55">
                  {(selectedDayDetail.topProcess?.[1] || 0).toLocaleString()} {unitMode}
                </div>
              </div>
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-sky-600/70">FPC Total</div>
                <div className="text-sm font-bold text-sky-700">{selectedDayDetail.fpcTotal.toLocaleString()} {unitMode}</div>
                <div className="text-[11px] text-sky-700/60">
                  {selectedDayDetail.total > 0 ? ((selectedDayDetail.fpcTotal / selectedDayDetail.total) * 100).toFixed(1) : "0.0"}% share
                </div>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-rose-600/70">SMT Total</div>
                <div className="text-sm font-bold text-rose-700">{selectedDayDetail.smtTotal.toLocaleString()} {unitMode}</div>
                <div className="text-[11px] text-rose-700/60">
                  {selectedDayDetail.total > 0 ? ((selectedDayDetail.smtTotal / selectedDayDetail.total) * 100).toFixed(1) : "0.0"}% share
                </div>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-2 mb-3">
              <label className="input input-sm input-bordered flex items-center gap-2 flex-1 bg-base-100">
                <Search className="w-4 h-4 text-base-content/45" />
                <input
                  type="text"
                  className="grow"
                  placeholder="Search product, process, MC line, customer..."
                  value={detailSearchQuery}
                  onChange={(e) => setDetailSearchQuery(e.target.value)}
                />
              </label>
              <select
                className="select select-sm select-bordered w-full lg:w-44"
                value={detailProcessFilter}
                onChange={(e) => setDetailProcessFilter(e.target.value)}
              >
                <option value="All Processes">All Processes</option>
                {selectedDayDetail.processOptions.map(processName => (
                  <option key={processName} value={processName}>{processName}</option>
                ))}
              </select>
              <select
                className="select select-sm select-bordered w-full lg:w-44"
                value={detailCustomerFilter}
                onChange={(e) => setDetailCustomerFilter(e.target.value)}
              >
                <option value="All Customers">All Customers</option>
                {selectedDayDetail.customerOptions.map(customer => (
                  <option key={customer} value={customer}>{customer}</option>
                ))}
              </select>
              <select
                className="select select-sm select-bordered w-full lg:w-32"
                value={detailTypeFilter}
                onChange={(e) => setDetailTypeFilter(e.target.value as DetailTypeFilter)}
              >
                <option value="All">All Types</option>
                <option value="FPC">FPC</option>
                <option value="SMT">SMT</option>
              </select>
              <select
                className="select select-sm select-bordered w-full lg:w-44"
                value={detailSortMode}
                onChange={(e) => setDetailSortMode(e.target.value as DetailSortMode)}
              >
                <option value="OutputDesc">Sort: Output high first</option>
                <option value="ProductAsc">Sort: Product A-Z</option>
                <option value="ProcessAsc">Sort: Process A-Z</option>
              </select>
            </div>

            {selectedDayDetail.rows.length > 0 ? (
              detailViewMode === "Grouped" ? (
                <div className="flex flex-col gap-2 pr-1">
                  {pagedDetailGroups.map((group) => {
                    const color = getProductColor(group.product_name);
                    const isSel = selectedProduct === group.product_name;
                    const isExpanded = expandedDetailProducts.includes(group.product_name);
                    return (
                      <div
                        key={group.product_name}
                        className={`rounded-lg border overflow-hidden ${isSel ? "border-primary/40 bg-primary/5" : "border-base-200 bg-base-200/20"}`}
                      >
                        <div
                          onClick={() => toggleExpandedDetailProduct(group.product_name)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") toggleExpandedDetailProduct(group.product_name);
                          }}
                          className="w-full min-h-[64px] cursor-pointer text-left grid grid-cols-[auto_minmax(220px,1.5fr)_minmax(220px,1fr)_96px] items-center gap-3 px-3 py-3 hover:bg-base-200/60 transition-colors"
                        >
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-bold text-sm truncate text-base-content/90">{group.product_name}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${group.processType === "SMT" ? "bg-rose-500/15 text-rose-600 border-rose-500/20" : "bg-sky-500/15 text-sky-600 border-sky-500/20"}`}>
                                {group.processType}
                              </span>
                            </div>
                            <span className="text-[11px] text-base-content/55 truncate">
                              {group.customerGroup} · {group.entries.length} entries · {group.processCount} processes · {group.mcLineCount} MC lines
                            </span>
                          </div>
                          <div className="hidden md:flex items-center gap-5 text-right">
                            <div>
                              <div className="text-[9px] uppercase font-bold text-base-content/40">Lot</div>
                              <div className="text-[11px] font-mono text-base-content/70">{group.actual_lot_qty.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-[9px] uppercase font-bold text-base-content/40">Sheet</div>
                              <div className="text-[11px] font-mono text-base-content/70">{group.actual_sht_qty.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-[9px] uppercase font-bold text-base-content/40">Piece</div>
                              <div className="text-[11px] font-mono text-base-content/70">{group.actual_pcs_qty.toLocaleString()}</div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end shrink-0 w-24 pl-3 border-l border-base-300">
                            <span className="text-[9px] uppercase font-bold text-primary/70 tracking-wider">{unitMode}</span>
                            <span className="font-mono font-bold text-sm text-primary">{group.output_value.toLocaleString()}</span>
                            <span className="text-[10px] text-base-content/40">
                              {selectedDayDetail.total > 0 ? ((group.output_value / selectedDayDetail.total) * 100).toFixed(1) : "0.0"}%
                            </span>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-3 pb-3 flex flex-col gap-1.5">
                            {group.entries.map((row, index) => renderDetailEntry(row, selectedDayDetail.total, true, index))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 pr-1">
                  {pagedDetailRows.map((row, index) => renderDetailEntry(row, selectedDayDetail.total, false, detailStartIndex + index))}
                </div>
              )
            ) : (
              <div className="text-center py-8 text-base-content/50 text-sm">No output matched the selected daily filters.</div>
            )}

            {selectedDayDetail.rows.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-base-content/50">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-primary/70" />
                  Showing {detailStartIndex + 1}-{detailEndIndex} of {detailTotalItems}. Click a product row to expand process details.
                </span>
                <div className="flex items-center gap-2">
                  {(detailSearchQuery || detailProcessFilter !== "All Processes" || detailCustomerFilter !== "All Customers" || detailTypeFilter !== "All" || detailSortMode !== "OutputDesc") && (
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      onClick={() => {
                        setDetailSearchQuery("");
                        setDetailProcessFilter("All Processes");
                        setDetailCustomerFilter("All Customers");
                        setDetailTypeFilter("All");
                        setDetailSortMode("OutputDesc");
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-xs btn-outline"
                    disabled={detailCurrentPage <= 1}
                    onClick={() => setDetailPage(page => Math.max(1, page - 1))}
                  >
                    Prev
                  </button>
                  <span className="min-w-16 text-center font-semibold text-base-content/60">
                    {detailCurrentPage} / {detailTotalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-xs btn-outline"
                    disabled={detailCurrentPage >= detailTotalPages}
                    onClick={() => setDetailPage(page => Math.min(detailTotalPages, page + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Top Customer Groups Section */}
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-4 shrink-0 w-full max-w-full overflow-hidden">
          <div className="mb-4">
            <h3 className="text-base font-bold text-base-content/90 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Top Customer Groups (MoM / DoD Change)
            </h3>
            {comparisonPeriod && (
              <p className="text-xs text-base-content/60 mt-1 ml-6">
                Comparing <strong>{comparisonPeriod.current}</strong> vs <strong>{comparisonPeriod.prev}</strong> ({comparisonPeriod.type})
              </p>
            )}
          </div>

          {isLoading ? (
            <div className="flex gap-4 animate-pulse overflow-hidden">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex-1 h-32 bg-base-200 rounded-lg"></div>
              ))}
            </div>
          ) : topCustomerGroups.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {topCustomerGroups.map((group, idx) => (
                <div key={group.name} className="relative overflow-hidden rounded-lg border border-base-200 bg-gradient-to-br from-base-100 to-base-200/50 p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-extrabold text-sm text-base-content truncate w-[80%]" title={group.name}>
                      {idx + 1}. {group.name}
                    </span>
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                      #{idx + 1}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 text-xs">
                    {/* LOT */}
                    <div className="flex justify-between items-center">
                      <span className="text-base-content/60 font-medium">Lot:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-base-content/90">{group.current.lot.toLocaleString()}</span>
                        <span
                          title={`Diff: ${(group.current.lot - group.prev.lot).toLocaleString()} (Cur: ${group.current.lot.toLocaleString()}, Prev: ${group.prev.lot.toLocaleString()})`}
                          className={`cursor-help flex items-center text-[10px] px-1 rounded whitespace-nowrap min-w-[54px] justify-end ${group.changeLot > 0 ? 'text-emerald-600 bg-emerald-100' : group.changeLot < 0 ? 'text-rose-600 bg-rose-100' : 'text-slate-500 bg-slate-100'}`}
                        >
                          {group.changeLot > 0 ? <TrendingUp size={10} className="mr-0.5" /> : group.changeLot < 0 ? <TrendingDown size={10} className="mr-0.5" /> : <Minus size={10} className="mr-0.5" />}
                          {Math.abs(group.changeLot).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {/* SHEET */}
                    <div className="flex justify-between items-center">
                      <span className="text-base-content/60 font-medium">Sht:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-base-content/90">{group.current.sht.toLocaleString()}</span>
                        <span
                          title={`Diff: ${(group.current.sht - group.prev.sht).toLocaleString()} (Cur: ${group.current.sht.toLocaleString()}, Prev: ${group.prev.sht.toLocaleString()})`}
                          className={`cursor-help flex items-center text-[10px] px-1 rounded whitespace-nowrap min-w-[54px] justify-end ${group.changeSht > 0 ? 'text-emerald-600 bg-emerald-100' : group.changeSht < 0 ? 'text-rose-600 bg-rose-100' : 'text-slate-500 bg-slate-100'}`}
                        >
                          {group.changeSht > 0 ? <TrendingUp size={10} className="mr-0.5" /> : group.changeSht < 0 ? <TrendingDown size={10} className="mr-0.5" /> : <Minus size={10} className="mr-0.5" />}
                          {Math.abs(group.changeSht).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {/* PCS */}
                    <div className="flex justify-between items-center">
                      <span className="text-base-content/60 font-medium">Pcs:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-base-content/90">{group.current.pcs.toLocaleString()}</span>
                        <span
                          title={`Diff: ${(group.current.pcs - group.prev.pcs).toLocaleString()} (Cur: ${group.current.pcs.toLocaleString()}, Prev: ${group.prev.pcs.toLocaleString()})`}
                          className={`cursor-help flex items-center text-[10px] px-1 rounded whitespace-nowrap min-w-[54px] justify-end ${group.changePcs > 0 ? 'text-emerald-600 bg-emerald-100' : group.changePcs < 0 ? 'text-rose-600 bg-rose-100' : 'text-slate-500 bg-slate-100'}`}
                        >
                          {group.changePcs > 0 ? <TrendingUp size={10} className="mr-0.5" /> : group.changePcs < 0 ? <TrendingDown size={10} className="mr-0.5" /> : <Minus size={10} className="mr-0.5" />}
                          {Math.abs(group.changePcs).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-base-content/50 text-sm">
              No customer group data available for comparison.
            </div>
          )}
        </div>

      </div>
    </>
  );
};

export default Page;
