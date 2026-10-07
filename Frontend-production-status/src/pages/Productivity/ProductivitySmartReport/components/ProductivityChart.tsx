import React, { useMemo, useState, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { BarChart3, TrendingUp, Check, Layers } from 'lucide-react';
import { LineGroupRow, OutputUnit, OUTPUT_UNITS, Granularity } from '../types';
import { normalizeMatrixLineGroupName } from '../hooks/useProcessOutputData';
import dayjs from 'dayjs';
import isoWeek from "dayjs/plugin/isoWeek";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import { getFiscalQuarter, getProductionWeekKey } from "../utils/fiscalYear";
import { useHybridRollupData, HybridChartItem } from '../hooks/useHybridRollupData';
import { API_BASE_URL } from '../../../../utils/apiConfig';
import { ProductivityChartSkeleton } from './ProductivitySkeletons';

dayjs.extend(isoWeek);
dayjs.extend(quarterOfYear);

const SERIES_COLORS = [
  { barStart: '#38bdf8', barEnd: '#0284c7', line: '#0284c7' }, // sky
  { barStart: '#34d399', barEnd: '#059669', line: '#059669' }, // emerald
  { barStart: '#fbbf24', barEnd: '#d97706', line: '#d97706' }, // amber
  { barStart: '#c084fc', barEnd: '#7c3aed', line: '#7c3aed' }, // violet
  { barStart: '#fb7185', barEnd: '#e11d48', line: '#e11d48' }, // rose
  { barStart: '#60a5fa', barEnd: '#2563eb', line: '#2563eb' }, // blue
  { barStart: '#f472b6', barEnd: '#db2777', line: '#db2777' }, // pink
  { barStart: '#2dd4bf', barEnd: '#0d9488', line: '#0d9488' }, // teal
];

// Helper to compute a clean, aesthetically pleasing Y-axis max that aligns with round intervals
const getCleanNiceAxisMax = (rawMax: number): number | string => {
  if (!rawMax || rawMax <= 0) return 'dataMax';
  if (rawMax < 1) {
    const p = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const n = rawMax / p;
    const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (const s of steps) {
      if (s >= n * 1.05) return Number((s * p).toFixed(3));
    }
    return Number((rawMax * 1.1).toFixed(3));
  }

  const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const niceMultipliers = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  for (const m of niceMultipliers) {
    if (m * mag >= rawMax * 1.05) {
      return Math.round(m * mag * 100) / 100;
    }
  }
  return Math.ceil(rawMax * 1.15);
};

interface ProductivityChartProps {
  rows: LineGroupRow[];
  selectedUnit: OutputUnit;
  onSelectUnit?: (unit: OutputUnit) => void;
  selectedFactory?: string;
  granularity: Granularity;
  startDate: string;
  endDate: string;
  attendanceData?: Record<string, any>;
  outputData?: Record<string, number>;
  planData?: Record<string, number>;
  linePlanMap?: Record<string, Record<string, number>>;
  title?: string;
  lineOutputMap?: Record<string, Record<string, number>>;
  lineAttendanceMap?: Record<string, Record<string, number>>;
  linesToSum?: string[];
  selectedLineGroup?: string | string[];
  isLoading?: boolean;
  targetData?: any[];
  matDailyData?: any[];
  hybridChartData?: any[];
  hybridBrackets?: any[];
  onTotalsCalculated?: (totals: { output: number; manHours: number; accProd: number }) => void;
}

export const ProductivityChart: React.FC<ProductivityChartProps> = React.memo(({
  rows,
  selectedUnit,
  onSelectUnit,
  selectedFactory,
  granularity,
  startDate,
  endDate,
  attendanceData = {},
  outputData,
  planData,
  linePlanMap,
  title = "Output Trend",
  lineOutputMap,
  lineAttendanceMap,
  linesToSum,
  selectedLineGroup,
  isLoading,
  targetData = [],
  matDailyData = [],
  hybridChartData: propHybridChartData,
  hybridBrackets: propHybridBrackets,
  onTotalsCalculated,
}) => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== "undefined") {
      const theme = document.documentElement.getAttribute("data-theme") || "";
      const isDarkClass = document.documentElement.classList.contains("dark");
      const darkThemes = ["dark", "synthwave", "dracula", "night", "dim", "sunset", "halloween", "forest", "black", "luxury", "business", "coffee"];
      return isDarkClass || darkThemes.includes(theme);
    }
    return false;
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const updateTheme = () => {
      const theme = document.documentElement.getAttribute("data-theme") || "";
      const isDarkClass = document.documentElement.classList.contains("dark");
      const darkThemes = ["dark", "synthwave", "dracula", "night", "dim", "sunset", "halloween", "forest", "black", "luxury", "business", "coffee"];
      setIsDark(isDarkClass || darkThemes.includes(theme));
    };

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  }, []);

  const [showDataOnly, setShowDataOnly] = useState(false);
  const [chartMode, setChartMode] = useState<'output' | 'productivity'>('productivity');
  const [visibleSeries, setVisibleSeries] = useState<{
    plan: boolean;
    output: boolean;
    target: boolean;
    productivity: boolean;
    outputDailyProd: boolean;
    accProd: boolean;
    accPlan: boolean;
    accOutput: boolean;
  }>({
    plan: true,
    output: true,
    target: true,
    productivity: true,
    outputDailyProd: false,
    accProd: true,
    accPlan: true,
    accOutput: true,
  });
  const [matVisibleSeries, setMatVisibleSeries] = useState<{
    pdOutput: boolean;
    mosOutput: boolean;
    accPdOutput: boolean;
    accMosOutput: boolean;
    pdProd: boolean;
    mosProd: boolean;
    pdTarget: boolean;
    mosTarget: boolean;
    accPdProd: boolean;
    accMosProd: boolean;
  }>({
    pdOutput: true,
    mosOutput: true,
    accPdOutput: true,
    accMosOutput: true,
    pdProd: true,
    mosProd: true,
    pdTarget: true,
    mosTarget: true,
    accPdProd: true,
    accMosProd: true,
  });
  const [visibleLineSeries, setVisibleLineSeries] = useState<Record<string, { output?: boolean; productivity?: boolean }>>({});

  const selectedUnitMeta = OUTPUT_UNITS.find(u => u.key === selectedUnit) || OUTPUT_UNITS[0];
  const isCompare = linesToSum && linesToSum.length > 1;
  const isYearly = granularity === 'yearly';
  const isMonthly = granularity === 'monthly';
  const isWeekly = granularity === 'weekly';
  const isDaily = granularity === 'daily';
  const isProdView = chartMode === 'productivity';
  const isHybridMode = isYearly;

  const [showPriorMonths, setShowPriorMonths] = useState<boolean>(true);
  const [priorMonthlyData, setPriorMonthlyData] = useState<any[]>([]);

  // Fetch prior 2 months monthly summary data when in daily view
  useEffect(() => {
    if (granularity !== 'daily' || !startDate) return;

    let isMounted = true;
    const startM = dayjs(startDate);
    const m2Start = startM.subtract(2, 'month').startOf('month').format('YYYY-MM-DD');
    const curMonthEnd = startM.endOf('month').format('YYYY-MM-DD');

    fetch(`${API_BASE_URL}/productivity/period-summary?periodType=MONTHLY&startDate=${m2Start}&endDate=${curMonthEnd}`)
      .then(res => (res.ok ? res.json() : []))
      .then(rows => {
        if (isMounted) {
          setPriorMonthlyData(Array.isArray(rows) ? rows : []);
        }
      })
      .catch(err => {
        console.error("Error fetching prior monthly data for ProductivityChart:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [granularity, startDate]);

  // Identify current active chart line for target lookups
  const currentChartLine = useMemo(() => {
    if (linesToSum && linesToSum.length === 1) return linesToSum[0];
    if (selectedLineGroup) {
      if (Array.isArray(selectedLineGroup) && selectedLineGroup.length === 1) return selectedLineGroup[0];
      if (typeof selectedLineGroup === 'string' && selectedLineGroup !== 'ALL' && selectedLineGroup.trim()) {
        return selectedLineGroup;
      }
    }
    if (title) {
      const stripped = title.replace(/^(Productivity Trend|Output Trend|Productivity Comparison|Output Comparison)\s*-\s*/i, '').trim();
      if (stripped) return stripped;
    }
    if (selectedFactory === 'SMT') return 'Sector SMT';
    if (selectedFactory === 'FPC') return 'Sector FPC';
    return 'Macro PCN';
  }, [linesToSum, selectedLineGroup, title, selectedFactory]);

  // Detect if current line is LINE MAT (requires Sheet only, dual PD/MOS metrics)
  const isLineMat = useMemo(() => {
    const rawNames = [
      ...(Array.isArray(linesToSum) ? linesToSum : []),
      ...(Array.isArray(selectedLineGroup) ? selectedLineGroup : typeof selectedLineGroup === "string" ? [selectedLineGroup] : []),
      title || "",
      currentChartLine || ""
    ].join(" ").toUpperCase();
    return rawNames.includes("LINE MAT") || rawNames.includes("MACRO MAT") || /\bMAT\b/.test(rawNames);
  }, [linesToSum, selectedLineGroup, title, currentChartLine]);

  // Parse LINE MAT daily output & targets from matDailyData and targetData
  const lineMatMaps = useMemo(() => {
    const pdMap = new Map<string, number>();
    const mosMap = new Map<string, number>();
    const pdTgtMap = new Map<string, number>();
    const mosTgtMap = new Map<string, number>();

    const targetCounts = new Map<string, { pdSum: number; pdCount: number; shtSum: number; shtCount: number }>();

    const addPeriodTarget = (key: string, pdTgt: number, shtTgt: number) => {
      if (!targetCounts.has(key)) {
        targetCounts.set(key, { pdSum: 0, pdCount: 0, shtSum: 0, shtCount: 0 });
      }
      const entry = targetCounts.get(key)!;
      if (pdTgt > 0) {
        entry.pdSum += pdTgt;
        entry.pdCount++;
      }
      if (shtTgt > 0) {
        entry.shtSum += shtTgt;
        entry.shtCount++;
      }
    };

    let latestPdTgt: number | null = null;
    let latestMosTgt: number | null = null;

    if (Array.isArray(matDailyData)) {
      matDailyData.forEach(item => {
        if (!item.date) return;
        const pd = Math.round(Number(item.pd_output || 0));
        const mos = Math.round(Number(item.mos_output || 0));
        const pdTgt = Number(item.pd_prod_target || 0);
        const shtTgt = Number(item.sht_prod_target || 0);

        const rawDate = String(item.date).split("T")[0];
        const parsed = dayjs(rawDate);

        if (pd > 0) pdMap.set(rawDate, (pdMap.get(rawDate) || 0) + pd);
        if (mos > 0) mosMap.set(rawDate, (mosMap.get(rawDate) || 0) + mos);
        if (pdTgt > 0) {
          pdTgtMap.set(rawDate, pdTgt);
          latestPdTgt = pdTgt;
        }
        if (shtTgt > 0) {
          mosTgtMap.set(rawDate, shtTgt);
          latestMosTgt = shtTgt;
        }

        if (parsed.isValid()) {
          const isoDate = parsed.format("YYYY-MM-DD");
          if (isoDate !== rawDate) {
            if (pd > 0) pdMap.set(isoDate, (pdMap.get(isoDate) || 0) + pd);
            if (mos > 0) mosMap.set(isoDate, (mosMap.get(isoDate) || 0) + mos);
            if (pdTgt > 0) pdTgtMap.set(isoDate, pdTgt);
            if (shtTgt > 0) mosTgtMap.set(isoDate, shtTgt);
          }

          let periodKey = rawDate;
          if (granularity === "weekly") periodKey = getProductionWeekKey(parsed);
          else if (granularity === "monthly") periodKey = parsed.format("YYYY-MM");
          else if (granularity === "quarterly") periodKey = getFiscalQuarter(parsed);
          else if (granularity === "yearly") periodKey = parsed.format("YYYY");

          if (periodKey !== rawDate) {
            if (pd > 0) pdMap.set(periodKey, (pdMap.get(periodKey) || 0) + pd);
            if (mos > 0) mosMap.set(periodKey, (mosMap.get(periodKey) || 0) + mos);
            addPeriodTarget(periodKey, pdTgt, shtTgt);
          }
        }
      });

      targetCounts.forEach((stats, k) => {
        if (stats.pdCount > 0 && !pdTgtMap.has(k)) {
          pdTgtMap.set(k, Math.round((stats.pdSum / stats.pdCount) * 100) / 100);
        }
        if (stats.shtCount > 0 && !mosTgtMap.has(k)) {
          mosTgtMap.set(k, Math.round((stats.shtSum / stats.shtCount) * 100) / 100);
        }
      });
    }

    if (Array.isArray(targetData)) {
      targetData.forEach(item => {
        if (!item.line || !item.date) return;
        const raw = item.line.trim().toUpperCase();
        if (raw.includes("LINE MAT") || raw === "MAT") {
          const pdTgt = Number(item.pcs_prod_target || item.pd_prod_target || 0);
          const shtTgt = Number(item.sht_prod_target || 0);
          const dStr = String(item.date).split("T")[0];
          const d = dayjs(dStr);

          if (pdTgt > 0) {
            pdTgtMap.set(dStr, pdTgt);
            latestPdTgt = pdTgt;
          }
          if (shtTgt > 0) {
            mosTgtMap.set(dStr, shtTgt);
            latestMosTgt = shtTgt;
          }

          if (d.isValid()) {
            const wKey = getProductionWeekKey(d);
            const mKey = d.format("YYYY-MM");
            if (pdTgt > 0 && !pdTgtMap.has(wKey)) pdTgtMap.set(wKey, pdTgt);
            if (shtTgt > 0 && !mosTgtMap.has(wKey)) mosTgtMap.set(wKey, shtTgt);
            if (pdTgt > 0 && !pdTgtMap.has(mKey)) pdTgtMap.set(mKey, pdTgt);
            if (shtTgt > 0 && !mosTgtMap.has(mKey)) mosTgtMap.set(mKey, shtTgt);
          }
        }
      });
    }

    return { pdMap, mosMap, pdTgtMap, mosTgtMap, latestPdTgt, latestMosTgt };
  }, [matDailyData, targetData, granularity]);

  // Detect which units have output data for the current line(s)
  const availableUnits = useMemo(() => {
    // 0. LINE MAT: Sheet only (NO Piece, NO Lot)
    if (isLineMat) {
      return { piece: false, sht: true, lot: false };
    }

    const rawNames = [
      ...(Array.isArray(linesToSum) ? linesToSum : []),
      ...(Array.isArray(selectedLineGroup) ? selectedLineGroup : typeof selectedLineGroup === "string" ? [selectedLineGroup] : []),
      title || ""
    ].join(" ").toUpperCase();

    // 1. 3-Unit Lines: LINE BLK and LINE OST support Piece, Sheet (Sht), and Lot
    const isThreeUnit =
      rawNames.includes("BLK") ||
      rawNames.includes("OST");

    // 2. Pure SMT-only lines: Piece only (NO Sheet, NO Lot)
    const isPureSmt =
      selectedFactory === "SMT" ||
      (!rawNames.includes("FPC") &&
      !rawNames.includes("PCN") &&
      !rawNames.includes("VAC") &&
      !rawNames.includes("HPS") &&
      !rawNames.includes("LINE A") &&
      !rawNames.includes("LINE B") &&
      !rawNames.includes("LINE C") &&
      !rawNames.includes("LINE D") &&
      (rawNames.includes("MOTA") ||
       rawNames.includes("MOTB") ||
       rawNames.includes("MOTC") ||
       rawNames.includes("MOTD") ||
       rawNames.includes("ASY") ||
       rawNames.includes("SMT") ||
       rawNames.includes("AELT") ||
       rawNames.includes("S_TSTE")));

    if (isThreeUnit) {
      // In Productivity view, Lot is locked/disabled (no productivity calculation for unit Lot)
      return { piece: true, sht: true, lot: !isProdView };
    }

    if (isPureSmt) {
      return { piece: true, sht: false, lot: false };
    }

    // Default for all FPC, PCN, Macro, VAC, HPS, etc.: Support Piece & Sheet (Sht)
    return {
      piece: true,
      sht: true,
      lot: false
    };
  }, [isLineMat, linesToSum, selectedLineGroup, selectedFactory, title, isProdView]);

  // Auto-switch to an available unit if currently selected unit has no data
  useEffect(() => {
    if (!onSelectUnit) return;
    if (!availableUnits[selectedUnit]) {
      if (availableUnits.piece) onSelectUnit('piece');
      else if (availableUnits.sht) onSelectUnit('sht');
      else if (availableUnits.lot) onSelectUnit('lot');
    }
  }, [availableUnits, selectedUnit, onSelectUnit]);

  // PCN lines have no production plan
  const isPcnLine = useMemo(() => {
    const raw = currentChartLine.trim().toUpperCase();
    const norm = normalizeMatrixLineGroupName(currentChartLine).trim().toUpperCase();
    const t = (title || "").trim().toUpperCase();
    return raw.includes("PCN") || norm.includes("PCN") || t.includes("PCN");
  }, [currentChartLine, title]);

  // Target Map by Line & Date
  const targetMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!Array.isArray(targetData) || selectedUnit === 'lot') return map;

    const isSht = selectedUnit === 'sht' || (selectedUnit as string) === 'sheet';

    targetData.forEach(item => {
      if (!item.line || !item.date) return;
      const raw = item.line.trim().toUpperCase();
      const norm = normalizeMatrixLineGroupName(item.line).trim().toUpperCase();
      const pcsVal = (item.pcs_prod_target !== undefined && item.pcs_prod_target !== null && Number(item.pcs_prod_target) > 0)
        ? Number(item.pcs_prod_target)
        : 0;
      const shtVal = (item.sht_prod_target !== undefined && item.sht_prod_target !== null && Number(item.sht_prod_target) > 0)
        ? Number(item.sht_prod_target)
        : 0;

      const val = isSht ? (shtVal > 0 ? shtVal : pcsVal) : (pcsVal > 0 ? pcsVal : shtVal);
      if (val > 0) {
        const keys = [item.date];
        const d = dayjs(item.date);
        if (d.isValid()) {
          keys.push(d.format('YYYY-MM'));
          keys.push(getProductionWeekKey(d));
          keys.push(d.format('YYYY'));
        }

        [raw, norm].forEach(l => {
          keys.forEach(k => {
            map.set(`${l}_${k}`, val);
          });
        });
      }
    });

    return map;
  }, [targetData, selectedUnit]);

  const getTargetForLine = useCallback((line: string, dateKey: string): number | null => {
    if (!line || !dateKey || selectedUnit === 'lot') return null;
    const raw = line.trim().toUpperCase();
    const norm = normalizeMatrixLineGroupName(line).trim().toUpperCase();
    const noLine = raw.replace(/^LINE\s+/i, '');
    const withLine = raw.startsWith('LINE ') ? raw : `LINE ${raw}`;

    const candidates = [raw, norm, noLine, withLine];
    if (norm === 'MACRO SMT' || raw === 'MACRO SMT') candidates.push('DIRECT SMT');
    if (norm === 'DIRECT SMT' || raw === 'DIRECT SMT') candidates.push('MACRO SMT');
    if (norm === 'MACRO FPC' || raw === 'MACRO FPC') candidates.push('DIRECT FPC');
    if (norm === 'DIRECT FPC' || raw === 'DIRECT FPC') candidates.push('MACRO FPC');
    if (norm === 'QA SMT' || raw === 'QA SMT') candidates.push('MQA', 'QA');
    if (norm === 'MQA' || raw === 'MQA') candidates.push('QA SMT', 'QA');

    const dateKeys = [dateKey];
    const d = dayjs(dateKey);
    if (d.isValid()) {
      dateKeys.push(d.format('YYYY-MM'));
      dateKeys.push(getProductionWeekKey(d));
      dateKeys.push(d.format('YYYY'));
    }

    for (const c of candidates) {
      for (const k of dateKeys) {
        const val = targetMap.get(`${c}_${k}`);
        if (val !== undefined && val > 0) return val;
      }
    }
    return null;
  }, [targetMap, selectedUnit]);

  const { hybridChartData: fetchedHybridData, hybridBrackets: fetchedHybridBrackets } = useHybridRollupData({
    startDate,
    endDate,
    selectedUnit,
    selectedLineGroup: selectedLineGroup || (rows && rows[0]?.lineGroup),
    linesToSum,
    enabled: (isHybridMode || isYearly) && !propHybridChartData,
  });

  const hybridChartData = propHybridChartData || fetchedHybridData;
  const hybridBrackets = propHybridBrackets || fetchedHybridBrackets;

  const chartData = useMemo(() => {
    const dailyMap = new Map<string, any>();

    let current = dayjs(startDate);
    // If daily view, expand end date to end of month so all days (1-31) are available for "All days" mode
    const monthEnd = current.isValid() ? current.endOf('month') : dayjs(endDate);
    const end = (granularity === "daily" && monthEnd.isValid() && monthEnd.isAfter(dayjs(endDate)))
      ? monthEnd
      : dayjs(endDate);

    while (current.isBefore(end) || current.isSame(end, 'day')) {
      let dateKey = "";
      let label = "";
      let nextCurrent = current;

      if (granularity === "yearly") {
        dateKey = current.format("YYYY");
        label = dateKey;
        nextCurrent = current.add(1, 'year');
      } else if (granularity === "quarterly") {
        dateKey = getFiscalQuarter(current);
        label = dateKey;
        nextCurrent = current.add(3, 'month');
      } else if (granularity === "monthly") {
        dateKey = current.format("YYYY-MM");
        label = current.format("MMM YYYY");
        nextCurrent = current.add(1, 'month');
      } else if (granularity === "weekly") {
        dateKey = getProductionWeekKey(current);
        const wNum = dateKey.includes("-W") ? dateKey.split("-W")[1] : current.isoWeek();
        label = `W${wNum}`;
        nextCurrent = current.add(1, 'day');
      } else {
        dateKey = current.format("YYYY-MM-DD");
        label = current.format("DD MMM");
        nextCurrent = current.add(1, 'day');
      }

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: label,
          rawDate: dateKey,
          output: 0,
          target: null,
          accProd: null
        });
      }
      current = nextCurrent;
    }

    if (outputData) {
      Object.entries(outputData).forEach(([dateKey, val]) => {
        if (!dailyMap.has(dateKey)) {
          let label = dateKey;
          const parsed = dayjs(dateKey);
          if (granularity === "monthly" && parsed.isValid()) label = parsed.format("MMM YYYY");
          else if (granularity === "daily" && parsed.isValid()) label = parsed.format("DD MMM");
          else if (granularity === "weekly" && dateKey.includes("-W")) label = `W${dateKey.split("-W")[1]}`;

          dailyMap.set(dateKey, {
            date: label,
            rawDate: dateKey,
            output: 0,
            target: null,
            accProd: null
          });
        }
        const dayData = dailyMap.get(dateKey);
        if (dayData) {
          dayData.output = val;
        }
      });
    }

    if (linesToSum && lineOutputMap) {
      linesToSum.forEach(line => {
        const outMap = lineOutputMap[line];
        if (outMap) {
          Object.entries(outMap).forEach(([dateKey, val]) => {
            const dayData = dailyMap.get(dateKey);
            if (dayData) {
              dayData[`output_${line}`] = val;
            }
          });
        }
      });
    }

    Object.entries(attendanceData).forEach(([date, metrics]) => {
      let periodData = dailyMap.get(date);
      if (!periodData) {
        const attendanceDate = dayjs(date);
        if (attendanceDate.isValid()) {
          let dateKey = attendanceDate.format("YYYY-MM-DD");
          if (granularity === "yearly") dateKey = attendanceDate.format("YYYY");
          else if (granularity === "quarterly") dateKey = getFiscalQuarter(attendanceDate);
          else if (granularity === "monthly") dateKey = attendanceDate.format("YYYY-MM");
          else if (granularity === "weekly") dateKey = getProductionWeekKey(attendanceDate);
          periodData = dailyMap.get(dateKey);
        }
      }

      if (periodData) {
        periodData.manHours = (periodData.manHours || 0) + Number(metrics?.total_man_hour || 0);
      }
    });

    if (linesToSum && lineAttendanceMap) {
      linesToSum.forEach(line => {
        const attMap = lineAttendanceMap[line];
        if (attMap) {
          Object.entries(attMap).forEach(([date, mhVal]) => {
            let periodData = dailyMap.get(date);
            if (!periodData) {
              const attendanceDate = dayjs(date);
              if (attendanceDate.isValid()) {
                let dateKey = attendanceDate.format("YYYY-MM-DD");
                if (granularity === "yearly") dateKey = attendanceDate.format("YYYY");
                else if (granularity === "quarterly") dateKey = getFiscalQuarter(attendanceDate);
                else if (granularity === "monthly") dateKey = attendanceDate.format("YYYY-MM");
                else if (granularity === "weekly") dateKey = getProductionWeekKey(attendanceDate);
                periodData = dailyMap.get(dateKey);
              }
            }

            if (periodData) {
              periodData[`manHours_${line}`] = (periodData[`manHours_${line}`] || 0) + Number(mhVal || 0);
            }
          });
        }
      });
    }

    // Aggregate Plan data (from Plan rows, rollups, and Period Summary rows) - PCN has no plan
    if (!isPcnLine) {
      if (planData) {
        Object.entries(planData).forEach(([dateKey, val]) => {
          if (!dailyMap.has(dateKey)) {
            let label = dateKey;
            const parsed = dayjs(dateKey);
            if (granularity === "monthly" && parsed.isValid()) label = parsed.format("MMM YYYY");
            else if (granularity === "daily" && parsed.isValid()) label = parsed.format("DD MMM");
            else if (granularity === "weekly" && dateKey.includes("-W")) label = `W${dateKey.split("-W")[1]}`;

            dailyMap.set(dateKey, {
              date: label,
              rawDate: dateKey,
              output: 0,
              target: null,
              accProd: null
            });
          }
          const dayData = dailyMap.get(dateKey);
          if (dayData) {
            dayData.plan = Number(val || 0);
          }
        });

        if (linesToSum && linePlanMap) {
          linesToSum.forEach(line => {
            const pMap = linePlanMap[line];
            if (pMap) {
              Object.entries(pMap).forEach(([dateKey, val]) => {
                const dayData = dailyMap.get(dateKey);
                if (dayData) {
                  dayData[`plan_${line}`] = Number(val || 0);
                }
              });
            }
          });
        }
      } else if (rows && rows.length > 0) {
        rows.forEach(row => {
          const rowAny = row as any;
          const pPiece = Number(rowAny.piece_plan ?? row.planQty ?? 0);
          const pSht = Number(rowAny.sht_plan ?? 0);
          const pLot = Number(rowAny.lot_plan ?? 0);
          const hasPlan = pPiece > 0 || pSht > 0 || pLot > 0;

          if (hasPlan && (row.mcLine === "MANUAL_EXCEL" || row.mcLine === "ALL" || row.mcLine === "PERIOD_SUMMARY" || row.process?.includes("PLAN") || row.process?.includes("SUMMARY"))) {
            let dateKey = row.date;
            const isPrecomputedPeriod = row.date.includes("-W") || row.date.includes("-Q") || (row.date.length === 7 && row.date.includes("-")) || row.date.length === 4;
            if (!isPrecomputedPeriod) {
              const rowDate = dayjs(row.date);
              if (!rowDate.isValid()) return;
              if (granularity === "yearly") dateKey = rowDate.format("YYYY");
              else if (granularity === "quarterly") dateKey = getFiscalQuarter(rowDate);
              else if (granularity === "monthly") dateKey = rowDate.format("YYYY-MM");
              else if (granularity === "weekly") dateKey = getProductionWeekKey(rowDate);
              else dateKey = rowDate.format("YYYY-MM-DD");
            }

            const normRowLine = normalizeMatrixLineGroupName(row.lineGroup).toUpperCase();
            const rawRowLine = row.lineGroup.trim().toUpperCase();

            let isMatch = false;
            if (linesToSum && linesToSum.length > 0) {
              isMatch = linesToSum.some(line => {
                const normLine = normalizeMatrixLineGroupName(line).toUpperCase();
                const rawLine = line.trim().toUpperCase();
                return normRowLine === normLine || rawRowLine === rawLine || normRowLine === rawLine || rawRowLine === normLine;
              });
            } else if (currentChartLine && !currentChartLine.toUpperCase().includes("PCN")) {
              const normLine = normalizeMatrixLineGroupName(currentChartLine).toUpperCase();
              const rawLine = currentChartLine.trim().toUpperCase();
              isMatch = normRowLine === normLine || rawRowLine === rawLine;
            } else {
              isMatch = false;
            }

            if (isMatch) {
              const dayData = dailyMap.get(dateKey);
              if (dayData) {
                let planVal = pPiece;
                if (selectedUnit === "sht" || (selectedUnit as string) === "sheet") {
                  planVal = pSht > 0 ? pSht : pPiece;
                } else if (selectedUnit === "lot") {
                  planVal = pLot > 0 ? pLot : pPiece;
                }
                dayData.plan = (dayData.plan || 0) + planVal;
              }
            }
          }
        });
      }
    }

    const sortedData = Array.from(dailyMap.values()).sort((a, b) => a.rawDate.localeCompare(b.rawDate));

    let runningOutput = 0;
    let runningPlan = 0;
    let runningManHours = 0;
    let runningPdOutput = 0;
    let runningMosOutput = 0;
    let runningMatMH = 0;
    const runningLineOut: Record<string, number> = {};
    const runningLineMH: Record<string, number> = {};
    if (linesToSum) {
      linesToSum.forEach(line => {
        runningLineOut[line] = 0;
        runningLineMH[line] = 0;
      });
    }

    let runningMatPdTgt = (lineMatMaps as any).latestPdTgt || null;
    let runningMatMosTgt = (lineMatMaps as any).latestMosTgt || null;

    return sortedData.map(item => {
      const pdOut = isLineMat ? (lineMatMaps.pdMap.get(item.rawDate) || 0) : 0;
      const mosOut = isLineMat ? (lineMatMaps.mosMap.get(item.rawDate) || 0) : 0;

      const rawPdTgt = isLineMat ? (lineMatMaps.pdTgtMap.get(item.rawDate) || null) : null;
      const rawMosTgt = isLineMat ? (lineMatMaps.mosTgtMap.get(item.rawDate) || null) : null;
      if (rawPdTgt && rawPdTgt > 0) runningMatPdTgt = rawPdTgt;
      if (rawMosTgt && rawMosTgt > 0) runningMatMosTgt = rawMosTgt;

      const itemMKey = dayjs(item.rawDate).isValid() ? dayjs(item.rawDate).format('YYYY-MM') : '';
      const pdTargetVal = isLineMat
        ? (rawPdTgt || (itemMKey ? lineMatMaps.pdTgtMap.get(itemMKey) : null) || runningMatPdTgt || (lineMatMaps as any).latestPdTgt || null)
        : null;
      const mosTargetVal = isLineMat
        ? (rawMosTgt || (itemMKey ? lineMatMaps.mosTgtMap.get(itemMKey) : null) || runningMatMosTgt || (lineMatMaps as any).latestMosTgt || null)
        : null;

      const out = isLineMat ? (pdOut + mosOut) : (item.output || 0);
      const plan = isPcnLine || isLineMat ? 0 : (item.plan || 0);
      const mh = item.manHours || 0;

      const isProdDay = out > 0 && mh > 0;
      if (isProdDay) {
        runningOutput += out;
        runningManHours += mh;
      }
      if (!isPcnLine && !isLineMat && plan > 0) {
        runningPlan += plan;
      }

      const isMatProdDay = isLineMat && (pdOut > 0 || mosOut > 0) && mh > 0;
      if (isMatProdDay) {
        runningPdOutput += pdOut;
        runningMosOutput += mosOut;
        runningMatMH += mh;
      }

      const dailyProd = (isProdDay && mh > 0) ? (out / mh) : null;
      const accProd = runningManHours > 0 ? (runningOutput / runningManHours) : null;
      const targetVal = isLineMat ? (mosTargetVal || pdTargetVal) : getTargetForLine(currentChartLine, item.rawDate || item.date);

      const pdDailyProd = isLineMat ? (mh > 0 && pdOut > 0 ? Number((pdOut / mh).toFixed(2)) : (mh > 0 && pdOut === 0 ? 0 : null)) : null;
      const mosDailyProd = isLineMat ? (mh > 0 && mosOut > 0 ? Number((mosOut / mh).toFixed(2)) : (mh > 0 && mosOut === 0 ? 0 : null)) : null;
      const accPdProd = isLineMat ? (runningMatMH > 0 && runningPdOutput > 0 ? Number((runningPdOutput / runningMatMH).toFixed(2)) : null) : null;
      const accMosProd = isLineMat ? (runningMatMH > 0 && runningMosOutput > 0 ? Number((runningMosOutput / runningMatMH).toFixed(2)) : null) : null;

      const res: any = {
        ...item,
        output: out,
        plan: isPcnLine || isLineMat ? 0 : plan,
        target: targetVal,
        accOutput: runningOutput > 0 ? runningOutput : null,
        accPlan: (!isPcnLine && !isLineMat && runningPlan > 0) ? runningPlan : null,
        dailyProd: dailyProd,
        accProd: accProd,
        manHours: mh,
        pdOutput: pdOut,
        mosOutput: mosOut,
        pdDailyProd: pdDailyProd,
        mosDailyProd: mosDailyProd,
        accPdOutput: runningPdOutput > 0 ? runningPdOutput : null,
        accMosOutput: runningMosOutput > 0 ? runningMosOutput : null,
        accPdProd: accPdProd,
        accMosProd: accMosProd,
        pdTarget: pdTargetVal,
        mosTarget: mosTargetVal,
      };

      if (linesToSum) {
        linesToSum.forEach(line => {
          const lOut = item[`output_${line}`] || 0;
          const lMh = item[`manHours_${line}`] || 0;
          const isLineProdDay = lOut > 0 && lMh > 0;
          if (isLineProdDay) {
            runningLineOut[line] += lOut;
            runningLineMH[line] += lMh;
          }

          res[`output_${line}`] = lOut;
          res[`manHours_${line}`] = lMh;
          res[`dailyProd_${line}`] = (isLineProdDay && lMh > 0) ? (lOut / lMh) : null;
          res[`accProd_${line}`] = runningLineMH[line] > 0 ? (runningLineOut[line] / runningLineMH[line]) : null;
        });
      }

      return res;
    });
  }, [startDate, endDate, granularity, outputData, planData, linePlanMap, attendanceData, rows, linesToSum, lineOutputMap, lineAttendanceMap, selectedUnit, currentChartLine, getTargetForLine, isPcnLine, isLineMat, lineMatMaps]);

  const priorMonthItems = useMemo(() => {
    if (granularity !== 'daily' || !showPriorMonths || !startDate || !isProdView) {
      return [];
    }

    const startM = dayjs(startDate);
    const m2Date = startM.subtract(2, 'month');
    const m1Date = startM.subtract(1, 'month');
    const m2Key = m2Date.format('YYYY-MM');
    const m1Key = m1Date.format('YYYY-MM');

    // Build target lines set
    const targetLines = new Set<string>();
    if (linesToSum && linesToSum.length > 0) {
      linesToSum.forEach(l => targetLines.add(normalizeMatrixLineGroupName(l).toUpperCase()));
    } else if (selectedLineGroup && selectedLineGroup !== "ALL") {
      const gList = Array.isArray(selectedLineGroup) ? selectedLineGroup : [selectedLineGroup];
      gList.forEach(l => targetLines.add(normalizeMatrixLineGroupName(l).toUpperCase()));
    }

    const isMacroFpcTarget = Array.from(targetLines).some(l => l === "MACRO FPC" || l === "DIRECT FPC");
    const isMacroSmtTarget = Array.from(targetLines).some(l => l === "MACRO SMT" || l === "DIRECT SMT");
    const isMacroPcnTarget = targetLines.size === 0 || Array.from(targetLines).some(l => l === "MACRO PCN");

    const MACRO_FPC_LINES = [
      "MACRO FPC", "DIRECT FPC", "LINE NPM", "NPM_FPC", "NPM", "LINE A", "LINE B_GEN", "LINE B_NON", "LINE B_JDT", "LINE C", "LINE D"
    ];

    const MACRO_SMT_LINES = [
      "MACRO SMT", "DIRECT SMT", "MACRO SMT_F", "MACRO SMT_B", "SMT FRONT_DIRECT", "SMT BACK_DIRECT",
      "ASY1_GEN", "ASSY1_GEN", "ASY1 GEN", "ASSY1 GEN", "ASY1_G", "LINE ASY1_G",
      "ASY1_AUTO", "ASSY1_AUTO", "ASY1 AUTO", "ASSY1 AUTO", "ASY1_A", "LINE ASY1_A",
      "ASY2", "ASSY2", "LINE ASY2", "ASY3", "ASSY3", "LINE ASY3"
    ];

    const filterRowsForMonth = (monthKey: string) => {
      const monthRows = priorMonthlyData.filter(r => {
        const pKey = r.period_key || dayjs(r.start_date).format('YYYY-MM');
        return pKey === monthKey;
      });

      if (isMacroPcnTarget) {
        const macroRow = monthRows.filter(r => normalizeMatrixLineGroupName(r.line_group).toUpperCase() === "MACRO PCN");
        if (macroRow.length > 0) return macroRow;
      }
      if (isMacroFpcTarget) {
        const macroRow = monthRows.filter(r => {
          const u = normalizeMatrixLineGroupName(r.line_group).toUpperCase();
          return u === "MACRO FPC" || u === "DIRECT FPC";
        });
        if (macroRow.length > 0) return macroRow;
      }
      if (isMacroSmtTarget) {
        const macroRow = monthRows.filter(r => {
          const u = normalizeMatrixLineGroupName(r.line_group).toUpperCase();
          return u === "MACRO SMT" || u === "DIRECT SMT";
        });
        if (macroRow.length > 0) return macroRow;
      }

      return monthRows.filter(r => {
        if (targetLines.size === 0) return true;
        const normLine = normalizeMatrixLineGroupName(r.line_group).toUpperCase();
        if (targetLines.has(normLine)) return true;
        if (targetLines.has("QA SMT") && normLine === "MQA") return true;
        if (targetLines.has("MQA") && normLine === "QA SMT") return true;
        return false;
      });
    };

    const computeMonthStats = (rows: any[], monthKey: string, monthDate: dayjs.Dayjs) => {
      let totOutput = 0;
      let totMH = 0;
      let totPlan = 0;
      let totPdOutput = 0;
      let totMosOutput = 0;

      rows.forEach(r => {
        totMH += Number(r.total_man_hour || 0);
        if (isLineMat) {
          const pdOut = Number(r.piece_output || 0);
          const mosOut = Number(r.sht_output || 0);
          totPdOutput += pdOut;
          totMosOutput += mosOut;
          totOutput += (pdOut + mosOut);
        } else if (selectedUnit === 'sht') {
          totOutput += Number(r.sht_output || 0);
          totPlan += Number(r.sht_plan || 0);
        } else if (selectedUnit === 'lot') {
          totOutput += Number(r.lot_output || 0);
        } else {
          totOutput += Number(r.piece_output || 0);
          totPlan += Number(r.piece_plan || 0);
        }
      });

      const prod = totMH > 0 ? Number((totOutput / totMH).toFixed(2)) : 0;
      const pdProd = totMH > 0 ? Number((totPdOutput / totMH).toFixed(2)) : 0;
      const mosProd = totMH > 0 ? Number((totMosOutput / totMH).toFixed(2)) : 0;

      const firstRow = rows[0] || {};
      let accProdVal = 0;
      if (selectedUnit === 'sht') {
        accProdVal = Number(firstRow.sht_sum_productivity || firstRow.sht_actual_productivity || 0);
      } else if (selectedUnit === 'lot') {
        accProdVal = Number((firstRow as any).lot_sum_productivity || (firstRow as any).lot_actual_productivity || 0);
      } else {
        accProdVal = Number(firstRow.sum_productivity || firstRow.actual_productivity || 0);
      }

      // If multiple lines or if unit is lot (which does not have precomputed table sum_productivity), fallback to computed prod
      const effectiveAcc = rows.length > 1
        ? prod
        : (accProdVal > 0 ? Number(accProdVal.toFixed(2)) : prod);

      return {
        key: `prior-month-${monthKey}`,
        rawDate: monthKey,
        date: `${monthDate.format('MMM')} (Result)`,
        output: totOutput,
        plan: totPlan,
        dailyProd: effectiveAcc > 0 ? effectiveAcc : prod,
        productivity: effectiveAcc > 0 ? effectiveAcc : prod,
        accProd: effectiveAcc > 0 ? effectiveAcc : prod,
        manHours: totMH,
        pdOutput: totPdOutput,
        mosOutput: totMosOutput,
        pdDailyProd: pdProd,
        mosDailyProd: mosProd,
        isPriorMonth: true,
        isDivider: false,
      };
    };

    const items: any[] = [];
    const m2Rows = filterRowsForMonth(m2Key);
    const m1Rows = filterRowsForMonth(m1Key);

    if (m2Rows.length > 0) {
      items.push(computeMonthStats(m2Rows, m2Key, m2Date));
    }
    if (m1Rows.length > 0) {
      items.push(computeMonthStats(m1Rows, m1Key, m1Date));
    }

    // 3. Current Month Acc (e.g. Sep (Result) - Calculated directly from Daily chartData for exact consistency)
    const curMonthKey = startM.format('YYYY-MM');
    let curMonthOutput = 0;
    let curMonthMH = 0;
    let curMonthPlan = 0;
    let latestDailyAcc: number | null = null;
    let curMonthPdOutput = 0;
    let curMonthMosOutput = 0;
    let curMonthMatMH = 0;
    let latestDailyPdAcc: number | null = null;
    let latestDailyMosAcc: number | null = null;

    chartData.forEach(d => {
      if (d.isPriorMonth || d.isDivider) return;
      const out = Number(d.output || 0);
      const mh = Number(d.manHours || 0);
      const pl = Number(d.plan || 0);
      curMonthOutput += out;
      curMonthMH += mh;
      curMonthPlan += pl;
      if (d.accProd !== null && d.accProd !== undefined && Number(d.accProd) > 0) {
        latestDailyAcc = Number(d.accProd);
      }

      if (isLineMat) {
        const pdOut = Number(d.pdOutput || 0);
        const mosOut = Number(d.mosOutput || 0);
        curMonthPdOutput += pdOut;
        curMonthMosOutput += mosOut;
        if ((pdOut > 0 || mosOut > 0) && mh > 0) {
          curMonthMatMH += mh;
        }
        if (d.accPdProd !== null && d.accPdProd !== undefined && Number(d.accPdProd) > 0) {
          latestDailyPdAcc = Number(d.accPdProd);
        }
        if (d.accMosProd !== null && d.accMosProd !== undefined && Number(d.accMosProd) > 0) {
          latestDailyMosAcc = Number(d.accMosProd);
        }
      }
    });

    const curMonthAccFromTotal = curMonthMH > 0 ? Number((curMonthOutput / curMonthMH).toFixed(2)) : 0;
    const effectiveCurMonthAcc = latestDailyAcc !== null && latestDailyAcc > 0 ? latestDailyAcc : curMonthAccFromTotal;

    const curMonthPdAccFromTotal = curMonthMatMH > 0 ? Number((curMonthPdOutput / curMonthMatMH).toFixed(2)) : 0;
    const effectiveCurMonthPdAcc = latestDailyPdAcc !== null && latestDailyPdAcc > 0 ? latestDailyPdAcc : curMonthPdAccFromTotal;

    const curMonthMosAccFromTotal = curMonthMatMH > 0 ? Number((curMonthMosOutput / curMonthMatMH).toFixed(2)) : 0;
    const effectiveCurMonthMosAcc = latestDailyMosAcc !== null && latestDailyMosAcc > 0 ? latestDailyMosAcc : curMonthMosAccFromTotal;

    if (
      curMonthOutput > 0 ||
      curMonthMH > 0 ||
      effectiveCurMonthAcc > 0 ||
      (isLineMat && (curMonthPdOutput > 0 || curMonthMosOutput > 0 || effectiveCurMonthPdAcc > 0 || effectiveCurMonthMosAcc > 0))
    ) {
      items.push({
        key: `current-month-acc-${curMonthKey}`,
        rawDate: curMonthKey,
        date: `${startM.format('MMM')} (Result)`,
        output: curMonthOutput,
        plan: curMonthPlan,
        dailyProd: effectiveCurMonthAcc,
        productivity: effectiveCurMonthAcc,
        accProd: effectiveCurMonthAcc,
        manHours: curMonthMH,
        pdOutput: curMonthPdOutput,
        mosOutput: curMonthMosOutput,
        pdDailyProd: effectiveCurMonthPdAcc,
        mosDailyProd: effectiveCurMonthMosAcc,
        accPdOutput: curMonthPdOutput,
        accMosOutput: curMonthMosOutput,
        accPdProd: effectiveCurMonthPdAcc,
        accMosProd: effectiveCurMonthMosAcc,
        isPriorMonth: true,
        isCurrentMonthAcc: true,
        isDivider: false,
      });
    }

    return items;
  }, [granularity, showPriorMonths, startDate, priorMonthlyData, linesToSum, selectedLineGroup, selectedUnit, chartData, isProdView, isLineMat]);

  const visibleChartData = useMemo(() => {
    if (isHybridMode && hybridChartData && hybridChartData.length > 0) {
      const enrichedHybridData = hybridChartData.map(d => {
        let itemTarget = d.target;
        if ((itemTarget === undefined || itemTarget === null || itemTarget <= 0) && getTargetForLine) {
          const tVal = getTargetForLine(currentChartLine, d.rawDate || d.key);
          if (tVal !== null && tVal > 0) {
            itemTarget = tVal;
          }
        }
        return {
          ...d,
          target: itemTarget && itemTarget > 0 ? itemTarget : null,
        };
      });

      if (!showDataOnly) return enrichedHybridData;
      return enrichedHybridData.filter(d => (d.output || 0) > 0 || (d.productivity || 0) > 0 || (d.plan || 0) > 0 || (d.target || 0) > 0);
    }

    let filtered = chartData;
    if (showDataOnly) {
      filtered = chartData.filter(d => {
        if (isLineMat) {
          if (chartMode === 'productivity') {
            const hasPd = typeof d.pdDailyProd === 'number' && d.pdDailyProd > 0;
            const hasMos = typeof d.mosDailyProd === 'number' && d.mosDailyProd > 0;
            return hasPd || hasMos;
          }
          const hasPdOut = typeof d.pdOutput === 'number' && d.pdOutput > 0;
          const hasMosOut = typeof d.mosOutput === 'number' && d.mosOutput > 0;
          return hasPdOut || hasMosOut;
        }
        if (chartMode === 'productivity') {
          const hasProd = typeof d.dailyProd === 'number' && d.dailyProd > 0;
          const hasCompareProd = linesToSum && linesToSum.some(line => typeof d[`dailyProd_${line}`] === 'number' && d[`dailyProd_${line}`] > 0);
          return hasProd || hasCompareProd;
        }
        const hasOut = (typeof d.output === 'number' && d.output > 0) || (typeof d.plan === 'number' && d.plan > 0);
        const hasCompareOut = linesToSum && linesToSum.some(line => (d[`output_${line}`] || 0) > 0);
        return hasOut || hasCompareOut;
      });
    }

    if (granularity === 'daily' && showPriorMonths && priorMonthItems.length > 0) {
      const activePriorItems = showDataOnly
        ? priorMonthItems.filter(p => (p.output || 0) > 0 || (p.productivity || 0) > 0 || (p.accProd || 0) > 0 || (p.pdOutput || 0) > 0 || (p.mosOutput || 0) > 0 || (p.pdDailyProd || 0) > 0 || (p.mosDailyProd || 0) > 0)
        : priorMonthItems;

      if (activePriorItems.length === 0) return filtered;

      const dividerItem = {
        key: 'benchmark-divider-spacer',
        rawDate: 'divider',
        date: ' ',
        isDivider: true,
        output: null,
        plan: null,
        target: null,
        productivity: null,
        dailyProd: null,
        accProd: null,
        manHours: null,
      };
      return [...activePriorItems, dividerItem, ...filtered];
    }

    return filtered;
  }, [chartData, showDataOnly, isHybridMode, hybridChartData, linesToSum, chartMode, granularity, showPriorMonths, priorMonthItems, isLineMat, getTargetForLine, currentChartLine]);

  // Check data availability (PCN has no plan)
  const hasPlanData = useMemo(() => !isPcnLine && visibleChartData.some(d => (d.plan || 0) > 0), [visibleChartData, isPcnLine]);
  const hasOutputData = useMemo(() => visibleChartData.some(d => (d.output || 0) > 0), [visibleChartData]);
  const hasAccPlanData = useMemo(() => !isPcnLine && visibleChartData.some(d => (d.accPlan || 0) > 0), [visibleChartData, isPcnLine]);
  const hasAccOutputData = useMemo(() => visibleChartData.some(d => (d.accOutput || 0) > 0), [visibleChartData]);
  const hasAccProdData = useMemo(() => visibleChartData.some(d => ((d.productivity !== undefined ? d.productivity : d.dailyProd) || 0) > 0 || (d.accProd || 0) > 0), [visibleChartData]);
  const hasTargetData = useMemo(() => {
    return visibleChartData.some(d => !d.isDivider && !d.isPriorMonth && typeof d.target === 'number' && d.target > 0);
  }, [visibleChartData]);

  // LINE MAT Specific Data Availability
  const hasMatPdOutput = useMemo(() => isLineMat && visibleChartData.some(d => (d.pdOutput || 0) > 0), [isLineMat, visibleChartData]);
  const hasMatMosOutput = useMemo(() => isLineMat && visibleChartData.some(d => (d.mosOutput || 0) > 0), [isLineMat, visibleChartData]);
  const hasMatAccPd = useMemo(() => isLineMat && visibleChartData.some(d => (d.accPdOutput || 0) > 0), [isLineMat, visibleChartData]);
  const hasMatAccMos = useMemo(() => isLineMat && visibleChartData.some(d => (d.accMosOutput || 0) > 0), [isLineMat, visibleChartData]);
  const hasMatPdTarget = useMemo(() => isLineMat && visibleChartData.some(d => !d.isDivider && !d.isPriorMonth && typeof d.pdTarget === 'number' && d.pdTarget > 0), [isLineMat, visibleChartData]);
  const hasMatMosTarget = useMemo(() => isLineMat && visibleChartData.some(d => !d.isDivider && !d.isPriorMonth && typeof d.mosTarget === 'number' && d.mosTarget > 0), [isLineMat, visibleChartData]);

  // KPI Calculations
  const totalOutput = useMemo(() => {
    return visibleChartData.reduce((sum, d) => sum + (d.output || 0), 0);
  }, [visibleChartData]);

  const matStats = useMemo(() => {
    if (!isLineMat) return null;

    let totPdOut = 0;
    let totMosOut = 0;
    let totMh = 0;
    let lastDate = '';
    let lastPd = 0;
    let lastMos = 0;
    let lastTotal = 0;
    let lastPdOut = 0;
    let lastMosOut = 0;

    visibleChartData.forEach(d => {
      if (d.isDivider || d.isPriorMonth) return;
      const pd = Number(d.pdOutput || 0);
      const mos = Number(d.mosOutput || 0);
      const mh = Number(d.manHours || 0);
      if (pd > 0) totPdOut += pd;
      if (mos > 0) totMosOut += mos;
      if (mh > 0 && (pd > 0 || mos > 0)) totMh += mh;

      if ((pd > 0 || mos > 0) && d.date) {
        lastDate = d.date;
        lastPd = d.pdDailyProd || 0;
        lastMos = d.mosDailyProd || 0;
        lastTotal = (pd + mos) > 0 && mh > 0 ? Number(((pd + mos) / mh).toFixed(2)) : 0;
        lastPdOut = pd;
        lastMosOut = mos;
      }
    });

    const avgPd = totMh > 0 ? totPdOut / totMh : 0;
    const avgMos = totMh > 0 ? totMosOut / totMh : 0;
    const avgTotal = totMh > 0 ? (totPdOut + totMosOut) / totMh : 0;

    return {
      totPdOut,
      totMosOut,
      totTotalOut: totPdOut + totMosOut,
      avgPd,
      avgMos,
      avgTotal,
      latestDate: lastDate,
      latestPd: lastPd,
      latestMos: lastMos,
      latestTotal: lastTotal,
      latestPdOut: lastPdOut,
      latestMosOut: lastMosOut,
    };
  }, [isLineMat, visibleChartData]);

  const latestOutputPoint = useMemo(() => {
    for (let i = visibleChartData.length - 1; i >= 0; i--) {
      if ((visibleChartData[i].output || 0) > 0) return visibleChartData[i];
    }
    return null;
  }, [visibleChartData]);

  const peakOutputPoint = useMemo(() => {
    let peak = { output: 0, date: '' };
    visibleChartData.forEach(d => {
      if ((d.output || 0) > peak.output) peak = { output: d.output, date: d.date };
    });
    return peak.output > 0 ? peak : null;
  }, [visibleChartData]);

  const prodChartStats = useMemo(() => {
    const validProd = visibleChartData.filter(d => {
      const p = d.productivity !== undefined ? d.productivity : d.dailyProd;
      return typeof p === 'number' && p > 0;
    });
    const avg = validProd.length > 0
      ? validProd.reduce((sum, d) => sum + (d.productivity !== undefined ? d.productivity : (d.dailyProd || 0)), 0) / validProd.length
      : 0;

    let totOut = 0;
    let totMH = 0;
    let latestAcc: number | null = null;
    visibleChartData.forEach(d => {
      if (d.isDivider || d.isPriorMonth) return;
      const o = Number(d.output || 0);
      const m = Number(d.manHours || 0);
      totOut += o;
      totMH += m;
      if (typeof d.accProd === 'number' && d.accProd > 0) {
        latestAcc = d.accProd;
      }
    });
    const accAvg = latestAcc !== null ? latestAcc : (totMH > 0 ? totOut / totMH : avg);

    const lastItem = validProd.length > 0 ? validProd[validProd.length - 1] : null;
    const latest = lastItem ? (lastItem.productivity !== undefined ? lastItem.productivity : (lastItem.dailyProd || 0)) : 0;
    const latestMonth = lastItem ? lastItem.date : '';
    const peak = validProd.reduce((max, d) => {
      const p = d.productivity !== undefined ? d.productivity : (d.dailyProd || 0);
      return Math.max(max, p);
    }, 0);
    const peakPoint = validProd.find(d => (d.productivity !== undefined ? d.productivity : d.dailyProd) === peak);

    const validTargets = visibleChartData
      .filter(d => !d.isDivider && !d.isPriorMonth && typeof d.target === 'number' && d.target > 0)
      .map(d => Number(d.target));
    const targetAvg = validTargets.length > 0
      ? validTargets.reduce((sum, v) => sum + v, 0) / validTargets.length
      : 0;

    return { avg, accAvg, latest, latestMonth, peak, peakMonth: peakPoint?.date || '', targetAvg };
  }, [visibleChartData]);

  const computedTotals = useMemo(() => {
    let output = 0;
    let manHours = 0;
    let latestAccProd: number | null = null;
    visibleChartData.forEach(d => {
      if (d.isDivider || d.isPriorMonth) return;
      output += Number(d.output || 0);
      manHours += Number(d.manHours || 0);
      if (typeof d.accProd === 'number' && d.accProd > 0) {
        latestAccProd = d.accProd;
      }
    });
    const accProd = latestAccProd !== null ? latestAccProd : (manHours > 0 ? output / manHours : 0);
    return { output, manHours, accProd };
  }, [visibleChartData]);

  useEffect(() => {
    if (onTotalsCalculated && computedTotals.output > 0) {
      onTotalsCalculated(computedTotals);
    }
  }, [computedTotals, onTotalsCalculated]);

  const showAccAxis = !isProdView && (
    (isLineMat && ((hasMatAccPd && matVisibleSeries.accPdOutput) || (hasMatAccMos && matVisibleSeries.accMosOutput))) ||
    (!isLineMat && ((hasAccPlanData && visibleSeries.accPlan) || (hasAccOutputData && visibleSeries.accOutput)))
  );
  const showProdAxisInOutputView = !isProdView && hasAccProdData && visibleSeries.outputDailyProd;
  const hasTargetActive = (isLineMat && (matVisibleSeries.pdTarget || matVisibleSeries.mosTarget)) || (!isLineMat && hasTargetData && visibleSeries.target);
  const hasAccProdActive = isProdView && visibleSeries.accProd;
  const targetEndPadding = (hasTargetActive || hasAccProdActive) ? 75 : 28;
  const gridRightPadding = showAccAxis && showProdAxisInOutputView ? 125 : (showAccAxis || showProdAxisInOutputView ? 78 : targetEndPadding);
  const chartLeftPadding = isHybridMode ? (isProdView ? 55 : 65) : 60;
  const chartRightPadding = isHybridMode ? (isProdView ? (hasTargetActive || hasAccProdActive ? 75 : 30) : gridRightPadding) : gridRightPadding;

  // Build Apache ECharts Option Object
  const echartOption = useMemo(() => {
    const dates = visibleChartData.map(d => d.date);
    const isCompareMode = linesToSum && linesToSum.length > 1;

    const yAxisList: any[] = [];

    // Axis 0: Left Y-Axis (Daily Output/Plan, or Productivity in Prod View)
    yAxisList.push({
      type: 'value',
      name: isProdView ? `${selectedUnitMeta.shortLabel}/MH` : selectedUnitMeta.shortLabel,
      nameTextStyle: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 11, fontWeight: 700, padding: [0, 0, 4, 0] },
      axisLine: { show: true, lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
      axisTick: { show: true, lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
      splitNumber: 4,
      max: (value: { max: number }) => getCleanNiceAxisMax(value.max),
      splitLine: { show: true, lineStyle: { color: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0', type: 'dashed' } },
      axisLabel: {
        color: isDark ? '#94a3b8' : '#64748b',
        fontSize: 11,
        fontWeight: 600,
        formatter: (val: number) => {
          if (isProdView) return val >= 1000 ? `${(val / 1000).toFixed(1)}k` : (val < 1 && val > 0 ? val.toFixed(2) : val.toFixed(1));
          if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
          if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
          return val.toLocaleString();
        }
      }
    });

    let accAxisIndex = 0;
    if (showAccAxis) {
      accAxisIndex = yAxisList.length;
      yAxisList.push({
        type: 'value',
        name: `${selectedUnitMeta.shortLabel} (ACC)`,
        nameTextStyle: { color: '#10b981', fontSize: 11, fontWeight: 700, padding: [0, 0, 4, 0] },
        position: 'right',
        offset: 0,
        axisLine: { show: true, lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
        axisTick: { show: true, lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
        splitNumber: 4,
        max: (value: { max: number }) => getCleanNiceAxisMax(value.max),
        splitLine: { show: false },
        axisLabel: {
          color: '#10b981',
          fontSize: 11,
          fontWeight: 600,
          formatter: (val: number) => {
            if (val >= 1000000) return `${(val / 1000000).toFixed(2)}M`;
            if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
            return val.toLocaleString();
          }
        }
      });
    }

    let prodAxisIndex = 0;
    if (showProdAxisInOutputView) {
      prodAxisIndex = yAxisList.length;
      yAxisList.push({
        type: 'value',
        name: `${selectedUnitMeta.shortLabel}/MH`,
        nameTextStyle: { color: '#ea580c', fontSize: 11, fontWeight: 700, padding: [0, 0, 4, 0] },
        position: 'right',
        offset: showAccAxis ? 65 : 0,
        axisLine: { show: true, lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
        axisTick: { show: true, lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
        splitNumber: 4,
        max: (value: { max: number }) => getCleanNiceAxisMax(value.max),
        splitLine: { show: false },
        axisLabel: {
          color: '#ea580c',
          fontSize: 11,
          fontWeight: 600,
          formatter: (val: number) => {
            return val.toFixed(1);
          }
        }
      });
    }

    // Series Definitions
    const seriesList: any[] = [];

    // Benchmark divider line & subtle background area between monthly summary bars and daily breakdown bars
    const hasBenchmarkDivider = granularity === 'daily' && showPriorMonths && priorMonthItems.length > 0;

    const benchmarkMarkLine = hasBenchmarkDivider ? {
      symbol: ['none', 'none'],
      silent: true,
      data: [
        {
          xAxis: ' ',
          lineStyle: {
            color: '#cbd5e1',
            type: 'dashed',
            width: 1.5,
          },
          label: {
            show: false
          }
        }
      ]
    } : undefined;

    const benchmarkMarkArea = hasBenchmarkDivider ? {
      silent: true,
      data: [
        [
          {
            xAxis: 0,
            itemStyle: {
              color: 'rgba(99, 102, 241, 0.04)'
            },
            label: {
              show: false
            }
          },
          {
            xAxis: priorMonthItems.length - 1
          }
        ]
      ]
    } : undefined;

    if (!isProdView) {
      const lastAccPlanIdx = (() => {
        for (let i = visibleChartData.length - 1; i >= 0; i--) {
          if (typeof visibleChartData[i].accPlan === 'number' && (visibleChartData[i].accPlan || 0) > 0) return i;
        }
        return -1;
      })();

      const lastAccOutputIdx = (() => {
        for (let i = visibleChartData.length - 1; i >= 0; i--) {
          if (typeof visibleChartData[i].accOutput === 'number' && (visibleChartData[i].accOutput || 0) > 0) return i;
        }
        return -1;
      })();

      const lastAccPlanVal = lastAccPlanIdx >= 0 ? Number(visibleChartData[lastAccPlanIdx].accPlan || 0) : 0;
      const lastAccOutVal = lastAccOutputIdx >= 0 ? Number(visibleChartData[lastAccOutputIdx].accOutput || 0) : 0;
      const isAccClose = Math.abs(lastAccOutVal - lastAccPlanVal) / Math.max(lastAccOutVal, lastAccPlanVal, 1) < 0.12;

      const lastMonthIdx = isHybridMode
        ? visibleChartData.reduce((last, d, idx) => (d.level === 'month' ? idx : last), -1)
        : -1;
      const hasHybridBreakdown = isHybridMode && lastMonthIdx >= 0 && lastMonthIdx < visibleChartData.length - 1;

      if (isLineMat && !isCompareMode) {
        // ===== LINE MAT OUTPUT VIEW (Dual Bars: PD & MOS) =====
        const lastAccPdIdx = (() => {
          for (let i = visibleChartData.length - 1; i >= 0; i--) {
            if (typeof visibleChartData[i].accPdOutput === 'number' && (visibleChartData[i].accPdOutput || 0) > 0) return i;
          }
          return -1;
        })();

        const lastAccMosIdx = (() => {
          for (let i = visibleChartData.length - 1; i >= 0; i--) {
            if (typeof visibleChartData[i].accMosOutput === 'number' && (visibleChartData[i].accMosOutput || 0) > 0) return i;
          }
          return -1;
        })();

        const lastAccPdVal = lastAccPdIdx >= 0 ? Number(visibleChartData[lastAccPdIdx].accPdOutput || 0) : 0;
        const lastAccMosVal = lastAccMosIdx >= 0 ? Number(visibleChartData[lastAccMosIdx].accMosOutput || 0) : 0;
        const isMatAccClose = Math.abs(lastAccPdVal - lastAccMosVal) / Math.max(lastAccPdVal, lastAccMosVal, 1) < 0.12;

        const isDualMat = Boolean(matVisibleSeries.pdOutput && matVisibleSeries.mosOutput);
        const rotateMat = isDualMat || visibleChartData.length > 25 ? 90 : 0;

        // 1. PD Output Bar (Brown gradient)
        if (matVisibleSeries.pdOutput) {
          seriesList.push({
            name: 'PD_Output (Sht)',
            type: 'bar',
            yAxisIndex: 0,
            barMaxWidth: matVisibleSeries.mosOutput ? 22 : 32,
            markLine: benchmarkMarkLine,
            markArea: benchmarkMarkArea,
            label: {
              show: true,
              position: 'inside',
              align: 'center',
              verticalAlign: 'middle',
              rotate: rotateMat,
              formatter: (params: any) => {
                const val = Number(params.value);
                if (!val || val <= 0) return '';
                if (val >= 1000000) {
                  const m = val / 1000000;
                  return (m >= 10 ? m.toFixed(1) : Number(m.toFixed(2)).toString()) + 'M';
                }
                if (val >= 10000) return Math.round(val / 1000).toLocaleString() + 'k';
                if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
                return val.toLocaleString();
              },
              fontFamily: "'Inter', sans-serif",
              fontSize: rotateMat === 90 ? 9.5 : (matVisibleSeries.mosOutput ? 9 : 10),
              fontWeight: 700,
              color: '#ffffff',
              textBorderColor: 'rgba(15, 23, 42, 0.85)',
              textBorderWidth: 1.2,
            },
            itemStyle: {
              borderRadius: [0, 0, 0, 0],
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#3b82f6' },
                { offset: 1, color: '#1d4ed8' }
              ])
            },
            data: visibleChartData.map(d => d.pdOutput || 0)
          });
        }

        // 2. MOS Output Bar (Amber/golden gradient)
        if (matVisibleSeries.mosOutput) {
          seriesList.push({
            name: 'MOS_Output (Sht)',
            type: 'bar',
            yAxisIndex: 0,
            barMaxWidth: matVisibleSeries.pdOutput ? 22 : 32,
            label: {
              show: true,
              position: 'inside',
              align: 'center',
              verticalAlign: 'middle',
              rotate: rotateMat,
              formatter: (params: any) => {
                const val = Number(params.value);
                if (!val || val <= 0) return '';
                if (val >= 1000000) {
                  const m = val / 1000000;
                  return (m >= 10 ? m.toFixed(1) : Number(m.toFixed(2)).toString()) + 'M';
                }
                if (val >= 10000) return Math.round(val / 1000).toLocaleString() + 'k';
                if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
                return val.toLocaleString();
              },
              fontFamily: "'Inter', sans-serif",
              fontSize: rotateMat === 90 ? 9.5 : (matVisibleSeries.pdOutput ? 9 : 10),
              fontWeight: 700,
              color: '#ffffff',
              textBorderColor: 'rgba(15, 23, 42, 0.85)',
              textBorderWidth: 1.2,
            },
            itemStyle: {
              borderRadius: [0, 0, 0, 0],
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#fbbf24' },
                { offset: 1, color: '#d97706' }
              ])
            },
            data: visibleChartData.map(d => d.mosOutput || 0)
          });
        }

        // 3. PD Output Acc Line (Blue solid)
        if (matVisibleSeries.accPdOutput) {
          seriesList.push({
            name: 'PD_Output (ACC)',
            type: 'line',
            yAxisIndex: showAccAxis ? accAxisIndex : 0,
            smooth: 0.2,
            symbol: 'circle',
            symbolSize: 6,
            showSymbol: true,
            lineStyle: { width: 2.8, color: '#1d4ed8' },
            itemStyle: { color: '#1d4ed8', borderColor: '#ffffff', borderWidth: 1.5 },
            data: visibleChartData.map((d, idx) => {
              const val = d.accPdOutput;
              if (d.isDivider || d.isPriorMonth || val === null || val === undefined) return null;
              const isLast = idx === lastAccPdIdx;
              const isLower = isMatAccClose && lastAccPdVal < lastAccMosVal;
              return {
                value: val,
                label: {
                  show: isLast && val > 0,
                  position: isLower ? 'bottom' : 'top',
                  distance: 14,
                  offset: isLower ? [22, 4] : [22, -4],
                  formatter: (params: any) => Number(params.value).toLocaleString(),
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#1d4ed8',
                  backgroundColor: '#ffffff',
                  borderColor: '#1d4ed8',
                  borderWidth: 1.2,
                  borderRadius: 4,
                  padding: [2.5, 6],
                  shadowColor: 'rgba(0, 0, 0, 0.08)',
                  shadowBlur: 3
                }
              };
            })
          });
        }

        // 4. MOS Output Acc Line (Amber dashed)
        if (matVisibleSeries.accMosOutput) {
          seriesList.push({
            name: 'MOS_Output (ACC)',
            type: 'line',
            yAxisIndex: showAccAxis ? accAxisIndex : 0,
            smooth: 0.2,
            symbol: 'diamond',
            symbolSize: 6.5,
            showSymbol: true,
            lineStyle: { width: 2.8, color: '#d97706', type: 'dashed' },
            itemStyle: { color: '#d97706', borderColor: '#ffffff', borderWidth: 1.5 },
            data: visibleChartData.map((d, idx) => {
              const val = d.accMosOutput;
              if (d.isDivider || d.isPriorMonth || val === null || val === undefined) return null;
              const isLast = idx === lastAccMosIdx;
              const isLower = isMatAccClose && lastAccMosVal < lastAccPdVal;
              return {
                value: val,
                label: {
                  show: isLast && val > 0,
                  position: isLower ? 'bottom' : 'top',
                  distance: 14,
                  offset: isLower ? [22, 4] : [22, -4],
                  formatter: (params: any) => Number(params.value).toLocaleString(),
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#d97706',
                  backgroundColor: '#ffffff',
                  borderColor: '#d97706',
                  borderWidth: 1.2,
                  borderRadius: 4,
                  padding: [2.5, 6],
                  shadowColor: 'rgba(0, 0, 0, 0.08)',
                  shadowBlur: 3
                }
              };
            })
          });
        }
      } else if (!isCompareMode) {
        const isDualBar = Boolean((hasPlanData && visibleSeries.plan) && (hasOutputData && visibleSeries.output));
        const rotateOutBar = isDualBar || visibleChartData.length > 25 ? 90 : 0;

        // 1. Plan Bar (Clean Centered Inside Label)
        if (hasPlanData && visibleSeries.plan) {
          const hasOutput = hasOutputData && visibleSeries.output;
          seriesList.push({
            name: `${selectedUnitMeta.shortLabel}_Plan`,
            type: 'bar',
            yAxisIndex: 0,
            barMaxWidth: hasOutput ? 24 : 34,
            label: {
              show: true,
              position: 'inside',
              align: 'center',
              verticalAlign: 'middle',
              rotate: rotateOutBar,
              formatter: (params: any) => {
                const val = Number(params.value);
                if (!val || val <= 0) return '';
                if (val >= 1000000) {
                  const m = val / 1000000;
                  return (m >= 10 ? m.toFixed(1) : Number(m.toFixed(2)).toString()) + 'M';
                }
                if (val >= 10000) return Math.round(val / 1000).toLocaleString() + 'k';
                if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
                return val.toLocaleString();
              },
              fontFamily: "'Inter', sans-serif",
              fontSize: rotateOutBar === 90 ? 10.5 : (hasOutput ? 9.5 : 10.5),
              fontWeight: 700,
              color: '#ffffff',
              textBorderColor: 'rgba(15, 23, 42, 0.85)',
              textBorderWidth: 1.4,
            },
            itemStyle: {
              borderRadius: [0, 0, 0, 0],
              color: (params: any) => {
                const item = visibleChartData[params.dataIndex];
                if (isHybridMode) {
                  if (item?.level === 'week') {
                    return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                      { offset: 0, color: '#f59e0b' },
                      { offset: 1, color: '#b45309' }
                    ]);
                  }
                  if (item?.level === 'day') {
                    return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                      { offset: 0, color: '#a78bfa' },
                      { offset: 1, color: '#6d28d9' }
                    ]);
                  }
                }
                return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: '#60a5fa' },
                  { offset: 1, color: '#1d4ed8' }
                ]);
              }
            },
            data: visibleChartData.map(d => d.plan || 0)
          });
        }

        // 2. Output Bar (Clean Centered Inside Bold Labels & Rich Emerald Gradient)
        if (hasOutputData && visibleSeries.output) {
          const hasPlan = hasPlanData && visibleSeries.plan;
          seriesList.push({
            name: `${selectedUnitMeta.shortLabel}_Output`,
            type: 'bar',
            yAxisIndex: 0,
            barMaxWidth: hasPlan ? 24 : 34,
            markLine: benchmarkMarkLine,
            markArea: benchmarkMarkArea,
            label: {
              show: true,
              position: 'inside',
              align: 'center',
              verticalAlign: 'middle',
              rotate: rotateOutBar,
              formatter: (params: any) => {
                const val = Number(params.value);
                if (!val || val <= 0) return '';
                if (val >= 1000000) {
                  const m = val / 1000000;
                  return (m >= 10 ? m.toFixed(1) : Number(m.toFixed(2)).toString()) + 'M';
                }
                if (val >= 10000) return Math.round(val / 1000).toLocaleString() + 'k';
                if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
                return val.toLocaleString();
              },
              fontFamily: "'Inter', sans-serif",
              fontSize: rotateOutBar === 90 ? 10.5 : (hasPlan ? 9.5 : 10.5),
              fontWeight: 700,
              color: '#ffffff',
              textBorderColor: 'rgba(15, 23, 42, 0.85)',
              textBorderWidth: 1.4,
            },
            itemStyle: {
              borderRadius: [0, 0, 0, 0],
              color: (params: any) => {
                const item = visibleChartData[params.dataIndex];
                if (isHybridMode) {
                  if (item?.level === 'week') {
                    return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                      { offset: 0, color: '#fb923c' },
                      { offset: 1, color: '#ea580c' }
                    ]);
                  }
                  if (item?.level === 'day') {
                    return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                      { offset: 0, color: '#c084fc' },
                      { offset: 1, color: '#6d28d9' }
                    ]);
                  }
                }
                return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: '#10b981' },
                  { offset: 1, color: '#047857' }
                ]);
              }
            },
            data: visibleChartData.map(d => d.output || 0)
          });
        }

        // 3. Acc Plan Line (Bright Orange Line with Leader Line & Badge Box Endpoint)
        if (hasAccPlanData && visibleSeries.accPlan) {
          if (hasHybridBreakdown) {
            // 3a. Acc Plan Monthly Segment (Solid)
            seriesList.push({
              name: `${selectedUnitMeta.shortLabel}_Plan (ACC)`,
              type: 'line',
              yAxisIndex: showAccAxis ? accAxisIndex : 0,
              smooth: 0.2,
              symbol: 'circle',
              symbolSize: 6.5,
              showSymbol: true,
              lineStyle: {
                width: 3,
                color: '#f97316',
                shadowColor: 'rgba(249, 115, 22, 0.25)',
                shadowBlur: 5
              },
              itemStyle: { color: '#f97316', borderColor: '#ffffff', borderWidth: 2 },
              data: visibleChartData.map((d, idx) => {
                if (idx > lastMonthIdx) return null;
                const val = d.accPlan;
                if (d.isDivider || val === null || val === undefined) return null;
                return val;
              })
            });

            // 3b. Acc Plan Weekly/Daily Segment (Solid Extension)
            seriesList.push({
              name: `${selectedUnitMeta.shortLabel}_Plan (ACC)`,
              type: 'line',
              yAxisIndex: showAccAxis ? accAxisIndex : 0,
              smooth: 0.2,
              symbolSize: 6.5,
              showSymbol: true,
              lineStyle: {
                width: 3,
                color: '#f97316',
                shadowColor: 'rgba(249, 115, 22, 0.25)',
                shadowBlur: 5
              },
              itemStyle: { color: '#f97316', borderColor: '#ffffff', borderWidth: 2 },
              labelLine: {
                show: true,
                showAbove: true,
                length2: 8,
                lineStyle: {
                  color: '#94a3b8',
                  width: 1.2
                }
              },
              data: visibleChartData.map((d, idx) => {
                if (idx < lastMonthIdx) return null;
                const val = d.accPlan;
                if (d.isDivider || val === null || val === undefined) return null;
                const isLast = idx === lastAccPlanIdx;
                const isLower = isAccClose && lastAccPlanVal < lastAccOutVal;
                return {
                  value: val,
                  symbol: idx === lastMonthIdx ? 'none' : 'circle',
                  label: {
                    show: isLast && val > 0,
                    position: isLower ? 'bottom' : 'top',
                    distance: 14,
                    offset: isLower ? [22, 4] : [22, -4],
                    formatter: (params: any) => {
                      const v = Number(params.value);
                      if (!v || v <= 0) return '';
                      return v.toLocaleString();
                    },
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#c2410c',
                    backgroundColor: '#ffffff',
                    borderColor: '#f97316',
                    borderWidth: 1.2,
                    borderRadius: 4,
                    padding: [2.5, 6],
                    shadowColor: 'rgba(0, 0, 0, 0.08)',
                    shadowBlur: 3
                  }
                };
              })
            });
          } else {
            // Normal Single Solid Line - Bright Orange
            seriesList.push({
              name: `${selectedUnitMeta.shortLabel}_Plan (ACC)`,
              type: 'line',
              yAxisIndex: showAccAxis ? accAxisIndex : 0,
              smooth: 0.2,
              symbol: 'circle',
              symbolSize: 6.5,
              showSymbol: true,
              lineStyle: {
                width: 3,
                color: '#f97316',
                shadowColor: 'rgba(249, 115, 22, 0.25)',
                shadowBlur: 5
              },
              itemStyle: { color: '#f97316', borderColor: '#ffffff', borderWidth: 2 },
              labelLine: {
                show: true,
                showAbove: true,
                length2: 8,
                lineStyle: {
                  color: '#94a3b8',
                  width: 1.2
                }
              },
              data: visibleChartData.map((d, idx) => {
                const val = d.accPlan;
                if (d.isDivider || val === null || val === undefined) return null;
                const isLast = idx === lastAccPlanIdx;
                const isLower = isAccClose && lastAccPlanVal < lastAccOutVal;
                return {
                  value: val,
                  label: {
                    show: isLast && val > 0,
                    position: isLower ? 'bottom' : 'top',
                    distance: 14,
                    offset: isLower ? [22, 4] : [22, -4],
                    formatter: (params: any) => {
                      const v = Number(params.value);
                      if (!v || v <= 0) return '';
                      return v.toLocaleString();
                    },
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#c2410c',
                    backgroundColor: '#ffffff',
                    borderColor: '#f97316',
                    borderWidth: 1.2,
                    borderRadius: 4,
                    padding: [2.5, 6],
                    shadowColor: 'rgba(0, 0, 0, 0.08)',
                    shadowBlur: 3
                  }
                };
              })
            });
          }
        }

        // 4. Acc Output Line (Bright Green Line with Leader Line & Badge Box Endpoint)
        if (hasAccOutputData && visibleSeries.accOutput) {
          if (hasHybridBreakdown) {
            // 4a. Acc Output Monthly Segment (Solid)
            seriesList.push({
              name: `${selectedUnitMeta.shortLabel}_Output (ACC)`,
              type: 'line',
              yAxisIndex: showAccAxis ? accAxisIndex : 0,
              smooth: 0.2,
              symbol: 'circle',
              symbolSize: 6.5,
              showSymbol: true,
              lineStyle: {
                width: 3,
                color: '#10b981',
                shadowColor: 'rgba(16, 185, 129, 0.25)',
                shadowBlur: 5
              },
              itemStyle: { color: '#10b981', borderColor: '#ffffff', borderWidth: 2 },
              data: visibleChartData.map((d, idx) => {
                if (idx > lastMonthIdx) return null;
                const val = d.accOutput;
                if (d.isDivider || val === null || val === undefined) return null;
                return val;
              })
            });

            // 4b. Acc Output Weekly/Daily Segment (Solid Extension)
            seriesList.push({
              name: `${selectedUnitMeta.shortLabel}_Output (ACC)`,
              type: 'line',
              yAxisIndex: showAccAxis ? accAxisIndex : 0,
              smooth: 0.2,
              symbolSize: 6.5,
              showSymbol: true,
              lineStyle: {
                width: 3,
                color: '#10b981',
                shadowColor: 'rgba(16, 185, 129, 0.25)',
                shadowBlur: 5
              },
              itemStyle: { color: '#10b981', borderColor: '#ffffff', borderWidth: 2 },
              labelLine: {
                show: true,
                showAbove: true,
                length2: 8,
                lineStyle: {
                  color: '#94a3b8',
                  width: 1.2
                }
              },
              data: visibleChartData.map((d, idx) => {
                if (idx < lastMonthIdx) return null;
                const val = d.accOutput;
                if (d.isDivider || val === null || val === undefined) return null;
                const isLast = idx === lastAccOutputIdx;
                const isLower = isAccClose && lastAccOutVal < lastAccPlanVal;
                return {
                  value: val,
                  symbol: idx === lastMonthIdx ? 'none' : 'circle',
                  label: {
                    show: isLast && val > 0,
                    position: isLower ? 'bottom' : 'top',
                    distance: 14,
                    offset: isLower ? [22, 4] : [22, -4],
                    formatter: (params: any) => {
                      const v = Number(params.value);
                      if (!v || v <= 0) return '';
                      return v.toLocaleString();
                    },
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#059669',
                    backgroundColor: '#ffffff',
                    borderColor: '#10b981',
                    borderWidth: 1.2,
                    borderRadius: 4,
                    padding: [2.5, 6],
                    shadowColor: 'rgba(0, 0, 0, 0.08)',
                    shadowBlur: 3
                  }
                };
              })
            });
          } else {
            // Normal Single Solid Line - Bright Green
            seriesList.push({
              name: `${selectedUnitMeta.shortLabel}_Output (ACC)`,
              type: 'line',
              yAxisIndex: showAccAxis ? accAxisIndex : 0,
              smooth: 0.2,
              symbol: 'circle',
              symbolSize: 6.5,
              showSymbol: true,
              lineStyle: {
                width: 3,
                color: '#10b981',
                shadowColor: 'rgba(16, 185, 129, 0.25)',
                shadowBlur: 5
              },
              itemStyle: { color: '#10b981', borderColor: '#ffffff', borderWidth: 2 },
              labelLine: {
                show: true,
                showAbove: true,
                length2: 8,
                lineStyle: {
                  color: '#94a3b8',
                  width: 1.2
                }
              },
              data: visibleChartData.map((d, idx) => {
                const val = d.accOutput;
                if (d.isDivider || val === null || val === undefined) return null;
                const isLast = idx === lastAccOutputIdx;
                const isLower = isAccClose && lastAccOutVal < lastAccPlanVal;
                return {
                  value: val,
                  label: {
                    show: isLast && val > 0,
                    position: isLower ? 'bottom' : 'top',
                    distance: 14,
                    offset: isLower ? [22, 4] : [22, -4],
                    formatter: (params: any) => {
                      const v = Number(params.value);
                      if (!v || v <= 0) return '';
                      return v.toLocaleString();
                    },
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#059669',
                    backgroundColor: '#ffffff',
                    borderColor: '#10b981',
                    borderWidth: 1.2,
                    borderRadius: 4,
                    padding: [2.5, 6],
                    shadowColor: 'rgba(0, 0, 0, 0.08)',
                    shadowBlur: 3
                  }
                };
              })
            });
          }
        }

        // 5. Daily Productivity Line (in Output mode)
        if (hasAccProdData && visibleSeries.outputDailyProd) {
          seriesList.push({
            name: 'Daily Productivity',
            type: 'line',
            yAxisIndex: prodAxisIndex,
            smooth: 0.35,
            symbol: 'diamond',
            symbolSize: 6,
            label: {
              show: true,
              position: 'top',
              distance: 6,
              formatter: (params: any) => {
                const val = Number(params.value);
                if (!val || val <= 0) return '';
                return val.toFixed(2);
              },
              fontSize: 9,
              fontWeight: 700,
              color: '#6d28d9',
            },
            labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
            lineStyle: { width: 2.5, color: '#8b5cf6', type: 'dashed' },
            itemStyle: { color: '#8b5cf6', borderColor: '#ffffff', borderWidth: 2 },
            data: visibleChartData.map(d => (d.isDivider ? null : (d.productivity !== undefined ? d.productivity : d.dailyProd)) || null)
          });
        }
      } else {
        // Compare Mode
        const rotateCompare = (linesToSum?.length || 1) > 1 || visibleChartData.length > 20 ? 90 : 0;
        linesToSum?.forEach((line, i) => {
          const color = SERIES_COLORS[i % SERIES_COLORS.length];
          const isOutVisible = visibleLineSeries[line]?.output !== false;

          if (isOutVisible) {
            seriesList.push({
              name: `${line} Output`,
              type: 'bar',
              yAxisIndex: 0,
              barMaxWidth: Math.max(12, 36 / linesToSum.length),
              label: {
                show: true,
                position: 'inside',
                align: 'center',
                verticalAlign: 'middle',
                rotate: rotateCompare,
                formatter: (params: any) => {
                  const val = Number(params.value);
                  if (!val || val <= 0) return '';
                  if (val >= 1000000) {
                    const m = val / 1000000;
                    return (m >= 10 ? m.toFixed(1) : Number(m.toFixed(2)).toString()) + 'M';
                  }
                  if (val >= 10000) return Math.round(val / 1000).toLocaleString() + 'k';
                  if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
                  return val.toLocaleString();
                },
                fontSize: rotateCompare === 90 ? 9 : 9.5,
                fontWeight: 700,
                color: '#ffffff',
                textBorderColor: 'rgba(15, 23, 42, 0.85)',
                textBorderWidth: 1.2,
              },
              itemStyle: {
                borderRadius: [0, 0, 0, 0], // Flat top like Excel
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: color.barStart },
                  { offset: 1, color: color.barEnd }
                ])
              },
              data: visibleChartData.map(d => d[`output_${line}`] || 0)
            });
          }
        });
      }
    } else {
      // ===== PRODUCTIVITY VIEW =====
      if (isLineMat && !isCompareMode) {
        // 1. PD Productivity Bar (Brown)
        if (matVisibleSeries.pdProd) {
          seriesList.push({
            name: 'PD Productivity',
            type: 'bar',
            yAxisIndex: 0,
            barMaxWidth: 24,
            markLine: benchmarkMarkLine,
            markArea: benchmarkMarkArea,
            label: {
              show: true,
              position: 'inside',
              align: 'center',
              verticalAlign: 'middle',
              rotate: 90,
              formatter: (params: any) => {
                const val = Number(params.value);
                if (!val || val <= 0) return '';
                return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              },
              fontFamily: "'Inter', sans-serif",
              fontSize: 11,
              fontWeight: 700,
              color: '#ffffff',
              textBorderColor: 'rgba(15, 23, 42, 0.85)',
              textBorderWidth: 1.5,
            },
            itemStyle: {
              borderRadius: [0, 0, 0, 0],
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#3b82f6' },
                { offset: 1, color: '#1d4ed8' }
              ])
            },
            data: visibleChartData.map(d => (d.isDivider ? null : d.pdDailyProd) || 0)
          });
        }

        // 2. MOS Productivity Bar (Amber)
        if (matVisibleSeries.mosProd) {
          seriesList.push({
            name: 'MOS Productivity',
            type: 'bar',
            yAxisIndex: 0,
            barMaxWidth: 24,
            label: {
              show: true,
              position: 'inside',
              align: 'center',
              verticalAlign: 'middle',
              rotate: 90,
              formatter: (params: any) => {
                const val = Number(params.value);
                if (!val || val <= 0) return '';
                return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              },
              fontFamily: "'Inter', sans-serif",
              fontSize: 11,
              fontWeight: 700,
              color: '#ffffff',
              textBorderColor: 'rgba(15, 23, 42, 0.85)',
              textBorderWidth: 1.5,
            },
            itemStyle: {
              borderRadius: [0, 0, 0, 0],
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#fbbf24' },
                { offset: 1, color: '#d97706' }
              ])
            },
            data: visibleChartData.map(d => (d.isDivider ? null : d.mosDailyProd) || 0)
          });
        }

        // 3. PD Target Line (Blue dashed line)
        if (matVisibleSeries.pdTarget && hasMatPdTarget) {
          const lastDailyIdx = (() => {
            for (let i = visibleChartData.length - 1; i >= 0; i--) {
              const d = visibleChartData[i];
              if (!d.isDivider && !d.isPriorMonth) return i;
            }
            return -1;
          })();

          const pdTargetPoints: { idx: number; val: number }[] = [];
          visibleChartData.forEach((d, i) => {
            if (!d.isDivider && !d.isPriorMonth && typeof d.pdTarget === 'number' && d.pdTarget > 0) {
              pdTargetPoints.push({ idx: i, val: Number(d.pdTarget) });
            }
          });

          const fallbackPdVal = pdTargetPoints[pdTargetPoints.length - 1]?.val ?? null;
          const isConstantPdTarget = pdTargetPoints.length === 0 || pdTargetPoints.every(p => p.val === pdTargetPoints[0].val);
          const firstPdTgtIdx = pdTargetPoints[0]?.idx ?? -1;
          const lastPdTgtIdx = lastDailyIdx >= 0 ? lastDailyIdx : (pdTargetPoints[pdTargetPoints.length - 1]?.idx ?? -1);

          const changeIndices = new Set<number>();
          let prevPdVal: number | null = null;
          pdTargetPoints.forEach(p => {
            if (prevPdVal !== null && p.val !== prevPdVal) changeIndices.add(p.idx);
            prevPdVal = p.val;
          });

          seriesList.push({
            name: 'PD Target',
            type: 'line',
            yAxisIndex: 0,
            smooth: false,
            showSymbol: true,
            labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
            lineStyle: { width: 2.2, color: '#2563eb', type: 'dashed' },
            itemStyle: { color: '#2563eb', borderColor: '#ffffff', borderWidth: 2 },
            connectNulls: true,
            data: visibleChartData.map((d, idx) => {
              if (d.isDivider || d.isPriorMonth) return null;
              const directVal = typeof d.pdTarget === 'number' && d.pdTarget > 0 ? Number(d.pdTarget) : null;
              const val = directVal !== null ? directVal : (idx <= lastDailyIdx ? fallbackPdVal : null);

              if (val !== null && val > 0) {
                const isLast = idx === lastPdTgtIdx;
                const isChange = changeIndices.has(idx);
                const isFirstChange = !isConstantPdTarget && idx === firstPdTgtIdx;
                const shouldShowLabel = isLast || isChange || isFirstChange;
                const shouldShowSymbol = isLast || isChange;

                return {
                  value: val,
                  symbol: shouldShowSymbol ? 'circle' : 'none',
                  symbolSize: isLast ? 7.5 : 6.5,
                  itemStyle: shouldShowSymbol ? { color: '#2563eb', borderColor: '#ffffff', borderWidth: 2 } : undefined,
                  label: {
                    show: shouldShowLabel,
                    position: isLast ? 'right' : 'top',
                    distance: isLast ? 8 : 6,
                    formatter: `PD Tgt: ${val.toFixed(2)}`,
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: '#1d4ed8',
                    backgroundColor: '#eff6ff',
                    borderColor: '#bfdbfe',
                    borderWidth: 1,
                    borderRadius: 4,
                    padding: [2, 6],
                    shadowColor: 'rgba(0, 0, 0, 0.06)',
                    shadowBlur: 3
                  }
                };
              }
              return null;
            })
          });
        }

        // 4. MOS Target Line (Orange dashed line)
        if (matVisibleSeries.mosTarget && hasMatMosTarget) {
          const lastDailyIdx = (() => {
            for (let i = visibleChartData.length - 1; i >= 0; i--) {
              const d = visibleChartData[i];
              if (!d.isDivider && !d.isPriorMonth) return i;
            }
            return -1;
          })();

          const mosTargetPoints: { idx: number; val: number }[] = [];
          visibleChartData.forEach((d, i) => {
            if (!d.isDivider && !d.isPriorMonth && typeof d.mosTarget === 'number' && d.mosTarget > 0) {
              mosTargetPoints.push({ idx: i, val: Number(d.mosTarget) });
            }
          });

          const fallbackMosVal = mosTargetPoints[mosTargetPoints.length - 1]?.val ?? null;
          const isConstantMosTarget = mosTargetPoints.length === 0 || mosTargetPoints.every(p => p.val === mosTargetPoints[0].val);
          const firstMosTgtIdx = mosTargetPoints[0]?.idx ?? -1;
          const lastMosTgtIdx = lastDailyIdx >= 0 ? lastDailyIdx : (mosTargetPoints[mosTargetPoints.length - 1]?.idx ?? -1);

          const changeIndices = new Set<number>();
          let prevMosVal: number | null = null;
          mosTargetPoints.forEach(p => {
            if (prevMosVal !== null && p.val !== prevMosVal) changeIndices.add(p.idx);
            prevMosVal = p.val;
          });

          seriesList.push({
            name: 'MOS Target',
            type: 'line',
            yAxisIndex: 0,
            smooth: false,
            showSymbol: true,
            labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
            lineStyle: { width: 2.2, color: '#ea580c', type: 'dashed' },
            itemStyle: { color: '#ea580c', borderColor: '#ffffff', borderWidth: 2 },
            connectNulls: true,
            data: visibleChartData.map((d, idx) => {
              if (d.isDivider || d.isPriorMonth) return null;
              const directVal = typeof d.mosTarget === 'number' && d.mosTarget > 0 ? Number(d.mosTarget) : null;
              const val = directVal !== null ? directVal : (idx <= lastDailyIdx ? fallbackMosVal : null);

              if (val !== null && val > 0) {
                const isLast = idx === lastMosTgtIdx;
                const isChange = changeIndices.has(idx);
                const isFirstChange = !isConstantMosTarget && idx === firstMosTgtIdx;
                const shouldShowLabel = isLast || isChange || isFirstChange;
                const shouldShowSymbol = isLast || isChange;

                return {
                  value: val,
                  symbol: shouldShowSymbol ? 'circle' : 'none',
                  symbolSize: isLast ? 7.5 : 6.5,
                  itemStyle: shouldShowSymbol ? { color: '#ea580c', borderColor: '#ffffff', borderWidth: 2 } : undefined,
                  label: {
                    show: shouldShowLabel,
                    position: isLast ? 'right' : 'top',
                    distance: isLast ? 8 : 6,
                    formatter: `MOS Tgt: ${val.toFixed(2)}`,
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: '#ea580c',
                    backgroundColor: '#fff7ed',
                    borderColor: '#fed7aa',
                    borderWidth: 1,
                    borderRadius: 4,
                    padding: [2, 6],
                    shadowColor: 'rgba(0, 0, 0, 0.06)',
                    shadowBlur: 3
                  }
                };
              }
              return null;
            })
          });
        }

        // 5. Acc Prod (PD) Line (Blue solid)
        if (matVisibleSeries.accPdProd) {
          seriesList.push({
            name: 'Acc Prod (PD)',
            type: 'line',
            yAxisIndex: 0,
            smooth: 0.25,
            symbol: 'circle',
            symbolSize: 5,
            lineStyle: { width: 2.2, color: '#1e40af' },
            itemStyle: { color: '#1e40af' },
            data: visibleChartData.map(d => (d.isDivider || d.isPriorMonth ? null : d.accPdProd) || null)
          });
        }

        // 6. Acc Prod (MOS) Line (Amber dotted)
        if (matVisibleSeries.accMosProd) {
          seriesList.push({
            name: 'Acc Prod (MOS)',
            type: 'line',
            yAxisIndex: 0,
            smooth: 0.25,
            symbol: 'diamond',
            symbolSize: 5,
            lineStyle: { width: 2.2, color: '#d97706', type: 'dotted' },
            itemStyle: { color: '#d97706' },
            data: visibleChartData.map(d => (d.isDivider || d.isPriorMonth ? null : d.accMosProd) || null)
          });
        }
      } else if (isHybridMode) {
        // Hybrid mode with multi-tier colors
        seriesList.push({
          name: `${selectedUnitMeta.shortLabel}/MH`,
          type: 'bar',
          yAxisIndex: 0,
          barMaxWidth: 32,
          label: {
            show: true,
            position: 'inside',
            align: 'center',
            verticalAlign: 'middle',
            rotate: 90,
            formatter: (params: any) => {
              const val = Number(params.value);
              if (!val || val <= 0) return '';
              return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            },
            fontFamily: "'Inter', sans-serif",
            fontSize: 11.5,
            fontWeight: 700,
            color: '#ffffff',
            textBorderColor: 'rgba(15, 23, 42, 0.85)',
            textBorderWidth: 1.5,
          },
          itemStyle: {
            borderRadius: [0, 0, 0, 0],
            color: (params: any) => {
              const item = visibleChartData[params.dataIndex];
              if (item?.isCurrentMonthAcc) {
                return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: '#a855f7' },
                  { offset: 1, color: '#6d28d9' }
                ]);
              }
              if (item?.level === 'month') {
                return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: '#38bdf8' },
                  { offset: 1, color: '#0284c7' }
                ]);
              }
              if (item?.level === 'week') {
                return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: '#fbbf24' },
                  { offset: 1, color: '#d97706' }
                ]);
              }
              return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#c084fc' },
                { offset: 1, color: '#7c3aed' }
              ]);
            }
          },
          data: visibleChartData.map(d => (d.productivity !== undefined ? d.productivity : d.dailyProd) || 0)
        });

        if (visibleSeries.accProd && hasAccProdData) {
          const lastProdDayIdx = (() => {
            for (let i = visibleChartData.length - 1; i >= 0; i--) {
              const d = visibleChartData[i];
              if (!d.isDivider && !d.isPriorMonth && ((d.output || 0) > 0 || (d.productivity !== undefined && (d.productivity || 0) > 0) || (d.dailyProd !== undefined && (d.dailyProd || 0) > 0) || (d.manHours || 0) > 0)) {
                return i;
              }
            }
            return -1;
          })();

          const lastChartIdx = visibleChartData.length - 1;
          const lastAccProdVal = lastProdDayIdx >= 0 ? Number(visibleChartData[lastProdDayIdx].accProd || 0) : 0;

          // Check if Target is active and close to Acc Prod value on the last point
          const lastTargetVal = (visibleSeries.target && hasTargetData)
            ? (() => {
                for (let i = visibleChartData.length - 1; i >= 0; i--) {
                  const d = visibleChartData[i];
                  if (!d.isDivider && !d.isPriorMonth && typeof d.target === 'number' && d.target > 0) {
                    return Number(d.target);
                  }
                }
                return null;
              })()
            : null;

          const isNearTarget = lastTargetVal !== null && Math.abs(lastAccProdVal - lastTargetVal) / Math.max(lastAccProdVal, lastTargetVal, 1) < 0.15;
          const isLowerThanTarget = isNearTarget && lastAccProdVal < lastTargetVal;

          seriesList.push({
            name: `Acc Prod (${selectedUnitMeta.shortLabel}/MH)`,
            type: 'line',
            yAxisIndex: 0,
            z: 10,
            smooth: 0.25,
            symbol: 'circle',
            symbolSize: 6.5,
            labelLine: {
              show: true,
              showAbove: true,
              length2: isLowerThanTarget ? 10 : 8,
              lineStyle: {
                color: '#94a3b8',
                width: 1.2
              }
            },
            lineStyle: { width: 2.8, color: '#2563eb', shadowColor: 'rgba(37, 99, 235, 0.35)', shadowBlur: 6 },
            itemStyle: { color: '#2563eb', borderColor: '#ffffff', borderWidth: 2 },
            connectNulls: true,
            data: visibleChartData.map((d, idx) => {
              if (d.isDivider || d.isPriorMonth) return null;
              if (lastProdDayIdx < 0) return null;

              // If past the last production day, extend flat to the last day of the month
              const val = idx <= lastProdDayIdx
                ? (typeof d.accProd === 'number' && d.accProd > 0 ? Number(d.accProd.toFixed(2)) : null)
                : Number(lastAccProdVal.toFixed(2));

              if (val === null) return null;
              const isLast = idx === lastChartIdx;
              const isPastProd = idx > lastProdDayIdx && idx < lastChartIdx;

              return {
                value: val,
                symbol: isPastProd ? 'none' : 'circle',
                symbolSize: isLast ? 7.5 : 6,
                label: {
                  show: isLast && val > 0,
                  position: 'top',
                  distance: isLowerThanTarget ? 24 : 14,
                  offset: isLowerThanTarget ? [28, -12] : [22, -4],
                  formatter: (params: any) => {
                    const v = Number(params.value);
                    if (!v || v <= 0) return '';
                    return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  },
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#1d4ed8',
                  backgroundColor: '#ffffff',
                  borderColor: '#2563eb',
                  borderWidth: 1.2,
                  borderRadius: 4,
                  padding: [3, 8],
                  shadowColor: 'rgba(0, 0, 0, 0.08)',
                  shadowBlur: 3
                }
              };
            })
          });
        }

        if (visibleSeries.target && hasTargetData) {
          const targetPoints: { idx: number; val: number }[] = [];
          visibleChartData.forEach((d, i) => {
            if (!d.isDivider && !d.isPriorMonth && typeof d.target === 'number' && d.target > 0) {
              targetPoints.push({ idx: i, val: Number(d.target) });
            }
          });

          const isConstantTarget = targetPoints.length === 0 || targetPoints.every(p => p.val === targetPoints[0].val);
          const firstTargetIdx = targetPoints[0]?.idx ?? -1;
          const lastTargetIdx = targetPoints[targetPoints.length - 1]?.idx ?? -1;

          const changeIndices = new Set<number>();
          let prevTgtVal: number | null = null;
          targetPoints.forEach(p => {
            if (prevTgtVal !== null && p.val !== prevTgtVal) changeIndices.add(p.idx);
            prevTgtVal = p.val;
          });

          seriesList.push({
            name: `Target (${selectedUnitMeta.shortLabel}/MH)`,
            type: 'line',
            yAxisIndex: 0,
            z: 5,
            smooth: false,
            showSymbol: true,
            labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
            lineStyle: {
              width: 2.2,
              color: '#e11d48',
              type: 'dashed',
              shadowColor: 'rgba(225, 29, 72, 0.25)',
              shadowBlur: 4
            },
            itemStyle: { color: '#e11d48', borderColor: '#ffffff', borderWidth: 2 },
            connectNulls: true,
            data: visibleChartData.map((d, idx) => {
              if (d.isDivider || d.isPriorMonth) return null;
              if (typeof d.target === 'number' && d.target > 0) {
                const isLast = idx === lastTargetIdx;
                const isChange = changeIndices.has(idx);
                const isFirstChange = !isConstantTarget && idx === firstTargetIdx;
                const shouldShowLabel = isLast || isChange || isFirstChange;
                const shouldShowSymbol = isLast || isChange;
                const val = Number(d.target);

                return {
                  value: val,
                  symbol: shouldShowSymbol ? 'circle' : 'none',
                  symbolSize: isLast ? 7.5 : 6.5,
                  itemStyle: shouldShowSymbol ? { color: '#e11d48', borderColor: '#ffffff', borderWidth: 2 } : undefined,
                  label: {
                    show: shouldShowLabel,
                    position: isLast ? 'right' : 'top',
                    distance: isLast ? 8 : 6,
                    formatter: `Target: ${val.toFixed(2)}`,
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: '#e11d48',
                    backgroundColor: '#fff1f2',
                    borderColor: '#fecdd3',
                    borderWidth: 1,
                    borderRadius: 4,
                    padding: [2, 6],
                    shadowColor: 'rgba(0, 0, 0, 0.06)',
                    shadowBlur: 3
                  }
                };
              }
              return null;
            })
          });
        }
      } else {
        // Standard Productivity View
        if (visibleSeries.productivity) {
          seriesList.push({
            name: `${granularity === 'weekly' ? 'Weekly' : granularity === 'monthly' ? 'Monthly' : 'Daily'} Productivity`,
            type: 'bar',
            yAxisIndex: 0,
            barMaxWidth: 34,
            markLine: benchmarkMarkLine,
            markArea: benchmarkMarkArea,
            label: {
              show: true,
              position: 'inside',
              align: 'center',
              verticalAlign: 'middle',
              rotate: 90,
              formatter: (params: any) => {
                const val = Number(params.value);
                if (!val || val <= 0) return '';
                return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              },
              fontFamily: "'Inter', sans-serif",
              fontSize: 11.5,
              fontWeight: 700,
              color: '#ffffff',
              textBorderColor: 'rgba(15, 23, 42, 0.85)',
              textBorderWidth: 1.5,
            },
            itemStyle: {
              borderRadius: [0, 0, 0, 0],
              color: (params: any) => {
                const item = visibleChartData[params.dataIndex];
                if (item?.isDivider) return 'transparent';
                if (item?.isCurrentMonthAcc) {
                  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#a855f7' },
                    { offset: 1, color: '#6d28d9' }
                  ]);
                }
                if (item?.isPriorMonth) {
                  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#818cf8' },
                    { offset: 1, color: '#4f46e5' }
                  ]);
                }
                return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: '#34d399' },
                  { offset: 1, color: '#059669' }
                ]);
              }
            },
            data: visibleChartData.map(d => (d.isDivider ? null : (d.productivity !== undefined ? d.productivity : d.dailyProd)) || 0)
          });
        }

        // Acc Productivity Line (Accumulated to Date with Extension & Smart Endpoint Badge Box)
        if (visibleSeries.accProd && hasAccProdData) {
          const lastProdDayIdx = (() => {
            for (let i = visibleChartData.length - 1; i >= 0; i--) {
              const d = visibleChartData[i];
              if (!d.isDivider && !d.isPriorMonth && ((d.output || 0) > 0 || (d.productivity !== undefined && (d.productivity || 0) > 0) || (d.dailyProd !== undefined && (d.dailyProd || 0) > 0) || (d.manHours || 0) > 0)) {
                return i;
              }
            }
            return -1;
          })();

          const lastChartIdx = visibleChartData.length - 1;
          const lastAccProdVal = lastProdDayIdx >= 0 ? Number(visibleChartData[lastProdDayIdx].accProd || 0) : 0;

          // Check if Target is active and close to Acc Prod value on the last point
          const lastTargetVal = (visibleSeries.target && hasTargetData)
            ? (() => {
                for (let i = visibleChartData.length - 1; i >= 0; i--) {
                  const d = visibleChartData[i];
                  if (!d.isDivider && !d.isPriorMonth && typeof d.target === 'number' && d.target > 0) {
                    return Number(d.target);
                  }
                }
                return null;
              })()
            : null;

          const isNearTarget = lastTargetVal !== null && Math.abs(lastAccProdVal - lastTargetVal) / Math.max(lastAccProdVal, lastTargetVal, 1) < 0.15;
          const isLowerThanTarget = isNearTarget && lastAccProdVal < lastTargetVal;

          seriesList.push({
            name: `Acc Prod (${selectedUnitMeta.shortLabel}/MH)`,
            type: 'line',
            yAxisIndex: 0,
            z: 10,
            smooth: 0.25,
            symbol: 'circle',
            symbolSize: 6.5,
            labelLine: {
              show: true,
              showAbove: true,
              length2: isLowerThanTarget ? 10 : 8,
              lineStyle: {
                color: '#94a3b8',
                width: 1.2
              }
            },
            lineStyle: { width: 2.8, color: '#2563eb', shadowColor: 'rgba(37, 99, 235, 0.35)', shadowBlur: 6 },
            itemStyle: { color: '#2563eb', borderColor: '#ffffff', borderWidth: 2 },
            connectNulls: true,
            data: visibleChartData.map((d, idx) => {
              if (d.isDivider || d.isPriorMonth) return null;
              if (lastProdDayIdx < 0) return null;

              // If past the last production day, extend flat to the last day of the month
              const val = idx <= lastProdDayIdx
                ? (typeof d.accProd === 'number' && d.accProd > 0 ? Number(d.accProd.toFixed(2)) : null)
                : Number(lastAccProdVal.toFixed(2));

              if (val === null) return null;
              const isLast = idx === lastChartIdx;
              const isPastProd = idx > lastProdDayIdx && idx < lastChartIdx;

              return {
                value: val,
                symbol: isPastProd ? 'none' : 'circle',
                symbolSize: isLast ? 7.5 : 6,
                label: {
                  show: isLast && val > 0,
                  position: 'top',
                  distance: isLowerThanTarget ? 24 : 14,
                  offset: isLowerThanTarget ? [28, -12] : [22, -4],
                  formatter: (params: any) => {
                    const v = Number(params.value);
                    if (!v || v <= 0) return '';
                    return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  },
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#1d4ed8',
                  backgroundColor: '#ffffff',
                  borderColor: '#2563eb',
                  borderWidth: 1.2,
                  borderRadius: 4,
                  padding: [3, 8],
                  shadowColor: 'rgba(0, 0, 0, 0.08)',
                  shadowBlur: 3
                }
              };
            })
          });
        }

        if (visibleSeries.target && hasTargetData) {
          const targetPoints: { idx: number; val: number }[] = [];
          visibleChartData.forEach((d, i) => {
            if (!d.isDivider && !d.isPriorMonth && typeof d.target === 'number' && d.target > 0) {
              targetPoints.push({ idx: i, val: Number(d.target) });
            }
          });

          const isConstantTarget = targetPoints.length === 0 || targetPoints.every(p => p.val === targetPoints[0].val);
          const firstTargetIdx = targetPoints[0]?.idx ?? -1;
          const lastTargetIdx = targetPoints[targetPoints.length - 1]?.idx ?? -1;

          const changeIndices = new Set<number>();
          let prevTgtVal: number | null = null;
          targetPoints.forEach(p => {
            if (prevTgtVal !== null && p.val !== prevTgtVal) changeIndices.add(p.idx);
            prevTgtVal = p.val;
          });

          seriesList.push({
            name: `Target (${selectedUnitMeta.shortLabel}/MH)`,
            type: 'line',
            yAxisIndex: 0,
            z: 5,
            smooth: false,
            showSymbol: true,
            labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
            lineStyle: {
              width: 2.2,
              color: '#e11d48',
              type: 'dashed',
              shadowColor: 'rgba(225, 29, 72, 0.25)',
              shadowBlur: 4
            },
            itemStyle: { color: '#e11d48', borderColor: '#ffffff', borderWidth: 2 },
            connectNulls: true,
            data: visibleChartData.map((d, idx) => {
              if (d.isDivider || d.isPriorMonth) return null;
              if (typeof d.target === 'number' && d.target > 0) {
                const isLast = idx === lastTargetIdx;
                const isChange = changeIndices.has(idx);
                const isFirstChange = !isConstantTarget && idx === firstTargetIdx;
                const shouldShowLabel = isLast || isChange || isFirstChange;
                const shouldShowSymbol = isLast || isChange;
                const val = Number(d.target);

                return {
                  value: val,
                  symbol: shouldShowSymbol ? 'circle' : 'none',
                  symbolSize: isLast ? 7.5 : 6.5,
                  itemStyle: shouldShowSymbol ? { color: '#e11d48', borderColor: '#ffffff', borderWidth: 2 } : undefined,
                  label: {
                    show: shouldShowLabel,
                    position: isLast ? 'right' : 'top',
                    distance: isLast ? 8 : 6,
                    formatter: `Target: ${val.toFixed(2)}`,
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: '#e11d48',
                    backgroundColor: '#fff1f2',
                    borderColor: '#fecdd3',
                    borderWidth: 1,
                    borderRadius: 4,
                    padding: [2, 6],
                    shadowColor: 'rgba(0, 0, 0, 0.06)',
                    shadowBlur: 3
                  }
                };
              }
              return null;
            })
          });
        }
      }
    }

    return {
      backgroundColor: 'transparent',
      animationDuration: 400,
      animationEasing: 'cubicOut',
      animationDurationUpdate: 400,
      animationEasingUpdate: 'cubicOut',
      grid: {
        top: 45,
        right: chartRightPadding,
        bottom: visibleChartData.length > 15 ? 42 : 28,
        left: chartLeftPadding,
        containLabel: false
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
          shadowStyle: { color: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(224, 242, 254, 0.35)' }
        },
        backgroundColor: isDark ? '#1e293b' : 'rgba(255, 255, 255, 0.98)',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: { color: isDark ? '#f8fafc' : '#1e293b', fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif' },
        extraCssText: isDark
          ? 'box-shadow: 0 12px 28px -4px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4); border-radius: 14px; backdrop-filter: blur(8px); min-width: 230px;'
          : 'box-shadow: 0 12px 28px -4px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08); border-radius: 14px; backdrop-filter: blur(8px); min-width: 230px;',
        formatter: (params: any) => {
          if (!params || !params.length) return '';
          const dataIdx = params[0].dataIndex;
          const curItem = visibleChartData[dataIdx];
          if (curItem?.isDivider) return '';

          const dateLabel = params[0].axisValueLabel || params[0].name;
          const isCurrentAcc = curItem?.isCurrentMonthAcc;
          const isPrior = curItem?.isPriorMonth && !isCurrentAcc;

          let badgeHtml = '';
          if (isCurrentAcc) {
            badgeHtml = '<span style="font-size: 9px; padding: 2px 6px; background: #f3e8ff; color: #7c3aed; border-radius: 4px; font-weight: 800;">CURRENT MONTH ACC</span>';
          } else if (isPrior) {
            badgeHtml = '<span style="font-size: 9px; padding: 2px 6px; background: #e0e7ff; color: #4338ca; border-radius: 4px; font-weight: 800;">PRIOR MONTH ACC</span>';
          } else if (isHybridMode && curItem?.level) {
            if (curItem.level === 'month') {
              badgeHtml = '<span style="font-size: 9px; padding: 2px 6px; background: #e0f2fe; color: #0369a1; border-radius: 4px; font-weight: 800;">MONTHLY TOTAL</span>';
            } else if (curItem.level === 'week') {
              badgeHtml = '<span style="font-size: 9px; padding: 2px 6px; background: #fef3c7; color: #b45309; border-radius: 4px; font-weight: 800;">WEEKLY TOTAL</span>';
            } else if (curItem.level === 'day') {
              badgeHtml = '<span style="font-size: 9px; padding: 2px 6px; background: #f3e8ff; color: #7c3aed; border-radius: 4px; font-weight: 800;">DAILY</span>';
            }
          }

          let html = `<div style="font-weight: 800; color: ${isCurrentAcc ? '#a855f7' : isPrior ? '#818cf8' : isDark ? '#cbd5e1' : '#475569'}; margin-bottom: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid ${isDark ? '#334155' : '#f1f5f9'}; padding-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">
            <span>${dateLabel}</span>
            ${badgeHtml}
          </div>`;
          if (isLineMat) {
            const isProd = isProdView;
            const unitLabel = isProd ? 'Sht/MH' : 'Sht';

            // PD Values
            const pdVal = isProd ? (curItem?.pdDailyProd ?? null) : (curItem?.pdOutput ?? null);
            const accPdVal = isProd ? (curItem?.accPdProd ?? null) : (curItem?.accPdOutput ?? null);
            const pdTgt = isProd ? (curItem?.pdTarget ?? null) : null;

            // MOS Values
            const mosVal = isProd ? (curItem?.mosDailyProd ?? null) : (curItem?.mosOutput ?? null);
            const accMosVal = isProd ? (curItem?.accMosProd ?? null) : (curItem?.accMosOutput ?? null);
            const mosTgt = isProd ? (curItem?.mosTarget ?? null) : null;

            // PD Daily Achievement
            const pdPct = pdTgt && pdTgt > 0 && pdVal !== null && pdVal > 0 ? (pdVal / pdTgt) * 100 : null;
            const pdDiff = pdTgt && pdTgt > 0 && pdVal !== null ? pdVal - pdTgt : null;
            const pdIsOver = pdDiff !== null && pdDiff >= 0;

            // PD Acc Achievement
            const pdAccPct = pdTgt && pdTgt > 0 && accPdVal !== null && accPdVal > 0 ? (accPdVal / pdTgt) * 100 : null;
            const pdAccDiff = pdTgt && pdTgt > 0 && accPdVal !== null ? accPdVal - pdTgt : null;
            const pdAccIsOver = pdAccDiff !== null && pdAccDiff >= 0;

            // MOS Daily Achievement
            const mosPct = mosTgt && mosTgt > 0 && mosVal !== null && mosVal > 0 ? (mosVal / mosTgt) * 100 : null;
            const mosDiff = mosTgt && mosTgt > 0 && mosVal !== null ? mosVal - mosTgt : null;
            const mosIsOver = mosDiff !== null && mosDiff >= 0;

            // MOS Acc Achievement
            const mosAccPct = mosTgt && mosTgt > 0 && accMosVal !== null && accMosVal > 0 ? (accMosVal / mosTgt) * 100 : null;
            const mosAccDiff = mosTgt && mosTgt > 0 && accMosVal !== null ? accMosVal - mosTgt : null;
            const mosAccIsOver = mosAccDiff !== null && mosAccDiff >= 0;

            const formatVal = (v: number | null | undefined, isP: boolean) => {
              if (v === null || v === undefined) return '-';
              if (!isP) return v.toLocaleString('en-US');
              return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            };

            html += `
              <div style="display: flex; flex-direction: column; gap: 8px; min-width: 270px;">
                <!-- PD Card -->
                <div style="background: ${isDark ? '#0f172a' : '#f8fafc'}; border: 1px solid ${isDark ? '#1e3a8a' : '#bfdbfe'}; border-left: 4px solid #2563eb; border-radius: 8px; padding: 8px 10px;">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid ${isDark ? '#1e293b' : '#e0f2fe'};">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="width: 9px; height: 9px; border-radius: 2px; background: #2563eb; display: inline-block;"></span>
                      <strong style="color: ${isDark ? '#60a5fa' : '#1e40af'}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">PD (${unitLabel})</strong>
                    </div>
                    ${pdTgt !== null ? `
                      <span style="font-size: 10px; font-weight: 700; color: ${isDark ? '#93c5fd' : '#1d4ed8'}; background: ${isDark ? '#1e293b' : '#eff6ff'}; padding: 1px 6px; border-radius: 4px; border: 1px solid ${isDark ? '#1e3a8a' : '#bfdbfe'}; font-family: monospace;">
                        Target: ${pdTgt.toFixed(2)}
                      </span>
                    ` : ''}
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                      <span style="color: ${isDark ? '#94a3b8' : '#64748b'};">${isCurrentAcc || isPrior ? 'Monthly' : 'Daily'}:</span>
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <strong style="color: ${isDark ? '#f8fafc' : '#0f172a'}; font-family: monospace; font-size: 12px;">${formatVal(pdVal, isProd)}</strong>
                        ${pdPct !== null ? `
                          <span style="font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px; background: ${pdIsOver ? (isDark ? '#064e3b' : '#ecfdf5') : (isDark ? '#7f1d1d' : '#fef2f2')}; color: ${pdIsOver ? (isDark ? '#34d399' : '#059669') : (isDark ? '#f87171' : '#dc2626')}; font-family: monospace;">
                            ${pdPct.toFixed(1)}% (${pdDiff! >= 0 ? '+' : ''}${pdDiff!.toFixed(2)})
                          </span>
                        ` : ''}
                      </div>
                    </div>
                    ${!isCurrentAcc && !isPrior ? `
                      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <span style="color: ${isDark ? '#94a3b8' : '#64748b'};">Acc Prod:</span>
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <strong style="color: ${isDark ? '#60a5fa' : '#1e40af'}; font-family: monospace; font-size: 12px;">${formatVal(accPdVal, isProd)}</strong>
                          ${pdAccPct !== null ? `
                            <span style="font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px; background: ${pdAccIsOver ? (isDark ? '#064e3b' : '#ecfdf5') : (isDark ? '#7f1d1d' : '#fef2f2')}; color: ${pdAccIsOver ? (isDark ? '#34d399' : '#059669') : (isDark ? '#f87171' : '#dc2626')}; font-family: monospace;">
                              ${pdAccPct.toFixed(1)}% (${pdAccDiff! >= 0 ? '+' : ''}${pdAccDiff!.toFixed(2)})
                            </span>
                          ` : ''}
                        </div>
                      </div>
                    ` : ''}
                  </div>
                </div>

                <!-- MOS Card -->
                <div style="background: ${isDark ? '#1c1917' : '#fffdfa'}; border: 1px solid ${isDark ? '#7c2d12' : '#fed7aa'}; border-left: 4px solid #ea580c; border-radius: 8px; padding: 8px 10px;">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid ${isDark ? '#292524' : '#ffedd5'};">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="width: 9px; height: 9px; border-radius: 2px; background: #ea580c; display: inline-block;"></span>
                      <strong style="color: ${isDark ? '#fb923c' : '#c2410c'}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">MOS (${unitLabel})</strong>
                    </div>
                    ${mosTgt !== null ? `
                      <span style="font-size: 10px; font-weight: 700; color: ${isDark ? '#fdba74' : '#ea580c'}; background: ${isDark ? '#292524' : '#fff7ed'}; padding: 1px 6px; border-radius: 4px; border: 1px solid ${isDark ? '#7c2d12' : '#fed7aa'}; font-family: monospace;">
                        Target: ${mosTgt.toFixed(2)}
                      </span>
                    ` : ''}
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                      <span style="color: ${isDark ? '#94a3b8' : '#64748b'};">${isCurrentAcc || isPrior ? 'Monthly' : 'Daily'}:</span>
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <strong style="color: ${isDark ? '#f8fafc' : '#0f172a'}; font-family: monospace; font-size: 12px;">${formatVal(mosVal, isProd)}</strong>
                        ${mosPct !== null ? `
                          <span style="font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px; background: ${mosIsOver ? (isDark ? '#064e3b' : '#ecfdf5') : (isDark ? '#7f1d1d' : '#fef2f2')}; color: ${mosIsOver ? (isDark ? '#34d399' : '#059669') : (isDark ? '#f87171' : '#dc2626')}; font-family: monospace;">
                            ${mosPct.toFixed(1)}% (${mosDiff! >= 0 ? '+' : ''}${mosDiff!.toFixed(2)})
                          </span>
                        ` : ''}
                      </div>
                    </div>
                    ${!isCurrentAcc && !isPrior ? `
                      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <span style="color: ${isDark ? '#94a3b8' : '#64748b'};">Acc Prod:</span>
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <strong style="color: ${isDark ? '#fb923c' : '#ea580c'}; font-family: monospace; font-size: 12px;">${formatVal(accMosVal, isProd)}</strong>
                          ${mosAccPct !== null ? `
                            <span style="font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px; background: ${mosAccIsOver ? (isDark ? '#064e3b' : '#ecfdf5') : (isDark ? '#7f1d1d' : '#fef2f2')}; color: ${mosAccIsOver ? (isDark ? '#34d399' : '#059669') : (isDark ? '#f87171' : '#dc2626')}; font-family: monospace;">
                              ${mosAccPct.toFixed(1)}% (${mosAccDiff! >= 0 ? '+' : ''}${mosAccDiff!.toFixed(2)})
                            </span>
                          ` : ''}
                        </div>
                      </div>
                    ` : ''}
                  </div>
                </div>
              </div>
            `;
            return html;
          }

          html += `<div style="display: flex; flex-direction: column; gap: 6px;">`;

          let planVal: number | null = null;
          let outputVal: number | null = null;
          let prodVal: number | null = null;
          let accProdVal: number | null = null;
          let targetVal: number | null = null;

          const seenSeriesNames = new Set<string>();
          params.forEach((item: any) => {
            if (item.value === undefined || item.value === null) return;
            const valNum = Number(item.value);
            if (valNum <= 0 && item.seriesType === 'line') return;
            if (seenSeriesNames.has(item.seriesName)) return;
            seenSeriesNames.add(item.seriesName);

            const formattedVal = valNum >= 1000 ? valNum.toLocaleString('en-US', { maximumFractionDigits: 2 }) : valNum.toFixed(2);
            const marker = item.marker || '';
            const seriesName = item.seriesName;

            let displaySeriesName = seriesName;
            if (!isLineMat && isProdView && (isCurrentAcc || isPrior || curItem?.level === 'month') && (seriesName.includes('Productivity') || seriesName.includes('/MH')) && !seriesName.includes('Acc Prod')) {
              displaySeriesName = 'Monthly Avg Productivity';
            }

            if (seriesName.includes('Plan') && !seriesName.includes('(ACC)')) planVal = valNum;
            if (seriesName.includes('Output') && !seriesName.includes('(ACC)')) outputVal = valNum;
            if ((seriesName.includes('Productivity') || seriesName.includes('/MH')) && !seriesName.includes('Acc')) prodVal = valNum;
            if (seriesName.includes('Acc Prod')) accProdVal = valNum;
            if (seriesName.includes('Target')) targetVal = valNum;

            html += `
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                <span style="display: flex; align-items: center; gap: 6px; font-weight: 600; color: ${isDark ? '#cbd5e1' : '#334155'}; font-size: 12px;">
                  ${marker} ${displaySeriesName}
                </span>
                <span style="font-family: monospace; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'}; font-size: 13px;">
                  ${formattedVal}
                </span>
              </div>
            `;
          });

          // Show Plan vs Output achievement percentage
          if (planVal !== null && outputVal !== null && planVal > 0) {
            const diff = outputVal - planVal;
            const pct = (outputVal / planVal) * 100;
            const isOver = diff >= 0;
            const badgeColor = isOver ? (isDark ? '#34d399' : '#059669') : (isDark ? '#f87171' : '#dc2626');
            const badgeBg = isOver ? (isDark ? '#064e3b' : '#ecfdf5') : (isDark ? '#7f1d1d' : '#fef2f2');
            html += `
              <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed ${isDark ? '#334155' : '#e2e8f0'}; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 11px; font-weight: 700; color: ${isDark ? '#94a3b8' : '#64748b'};">Achievement:</span>
                <span style="font-size: 11px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: ${badgeBg}; color: ${badgeColor}; font-family: monospace;">
                  ${pct.toFixed(1)}% (${diff >= 0 ? '+' : ''}${diff.toLocaleString()})
                </span>
              </div>
            `;
          }

          // Show Prod vs Target achievement percentage
          if (isProdView && targetVal !== null && targetVal > 0 && prodVal !== null && prodVal > 0) {
            const diff = prodVal - targetVal;
            const pct = (prodVal / targetVal) * 100;
            const isOver = diff >= 0;
            const badgeColor = isOver ? (isDark ? '#34d399' : '#059669') : (isDark ? '#f87171' : '#dc2626');
            const badgeBg = isOver ? (isDark ? '#064e3b' : '#ecfdf5') : (isDark ? '#7f1d1d' : '#fef2f2');
            html += `
              <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed ${isDark ? '#334155' : '#e2e8f0'}; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 11px; font-weight: 700; color: ${isDark ? '#94a3b8' : '#64748b'};">Target Achv:</span>
                <span style="font-size: 11px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: ${badgeBg}; color: ${badgeColor}; font-family: monospace;">
                  ${pct.toFixed(1)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(2)})
                </span>
              </div>
            `;
          }

          html += `</div>`;
          return html;
        }
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
        axisTick: { show: true, alignWithLabel: true, lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
        splitLine: {
          show: true,
          interval: 0,
          lineStyle: {
            color: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
            type: 'dashed'
          }
        },
        axisLabel: {
          color: isDark ? '#94a3b8' : '#64748b',
          fontSize: 11,
          fontWeight: 600,
          rotate: dates.length > 15 ? 45 : 0,
          margin: 12
        }
      },
      yAxis: yAxisList,
      dataZoom: [],
      series: seriesList
    };
  }, [visibleChartData, isProdView, isHybridMode, linesToSum, visibleSeries, visibleLineSeries, hasPlanData, hasOutputData, hasAccPlanData, hasAccOutputData, hasAccProdData, hasTargetData, selectedUnitMeta, granularity, isLineMat, matVisibleSeries, hasMatPdOutput, hasMatMosOutput, hasMatAccPd, hasMatAccMos, hasMatPdTarget, hasMatMosTarget, chartLeftPadding, chartRightPadding, showAccAxis, showProdAxisInOutputView, isDark]);

  // Dynamic Title depending on Mode (Output vs Productivity) and Line/Sector Selection
  const displayTitle = useMemo(() => {
    const isCompare = Boolean(linesToSum && linesToSum.length > 1);
    let targetName = title.replace(/^(Productivity Trend|Output Trend|Productivity Comparison|Output Comparison)\s*-\s*/i, '').trim();
    if (!targetName) {
      if (selectedLineGroup && selectedLineGroup !== "ALL" && selectedLineGroup.length > 0) {
        targetName = Array.isArray(selectedLineGroup) ? selectedLineGroup.join(', ') : selectedLineGroup;
      } else if (selectedFactory === "SMT") {
        targetName = "Sector SMT";
      } else if (selectedFactory === "FPC") {
        targetName = "Sector FPC";
      } else {
        targetName = "Macro PCN";
      }
    }

    if (isCompare) {
      return isProdView ? `Productivity Comparison - ${targetName}` : `Output Comparison - ${targetName}`;
    }
    return isProdView ? `Productivity Trend - ${targetName}` : `Output Trend - ${targetName}`;
  }, [title, isProdView, linesToSum, selectedLineGroup, selectedFactory]);

  if (isLoading) {
    return <ProductivityChartSkeleton />;
  }

  return (
    <div className="relative z-10 w-full overflow-hidden rounded-2xl border border-base-300/80 bg-base-100 shadow-xl transition-opacity duration-300">

      {/* Header Bar */}
      <div className="flex flex-col gap-4 border-b border-base-300/80 bg-base-200/50 dark:bg-base-200/30 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-black text-base-content">
              {displayTitle}
            </h3>
            <span className="rounded-full border border-base-300 bg-base-100 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] text-base-content/70">
              {granularity}
            </span>
          </div>
          {isLineMat && matStats ? (
            !isProdView ? (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-base-content/80">
                <span className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 font-medium text-amber-900 dark:text-amber-200">
                  Total PD: <b className="font-mono text-amber-950 dark:text-amber-100">{matStats.totPdOut.toLocaleString()}</b> Sht
                </span>
                <span className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30 px-3 py-1.5 font-medium text-amber-800 dark:text-amber-300">
                  Total MOS: <b className="font-mono text-amber-950 dark:text-amber-100">{matStats.totMosOut.toLocaleString()}</b> Sht
                </span>
                <span className="rounded-lg border border-base-300 bg-base-100 dark:bg-base-200/60 px-3 py-1.5 font-medium text-base-content">
                  Total Output: <b className="font-mono text-base-content font-bold">{matStats.totTotalOut.toLocaleString()}</b> Sht
                </span>
                {matStats.latestDate && (
                  <span className="rounded-lg border border-base-300 bg-base-100 dark:bg-base-200/60 px-3 py-1.5 font-medium text-base-content">
                    Latest on <b className="font-mono text-base-content font-bold">{matStats.latestDate}</b>: PD <b className="font-mono text-amber-900 dark:text-amber-300">{matStats.latestPdOut.toLocaleString()}</b> | MOS <b className="font-mono text-amber-800 dark:text-amber-400">{matStats.latestMosOut.toLocaleString()}</b>
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-base-content/80">
                <span className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 font-medium text-amber-900 dark:text-amber-200">
                  Avg PD: <b className="font-mono text-amber-950 dark:text-amber-100">{matStats.avgPd.toFixed(2)}</b> Sht/MH
                </span>
                <span className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30 px-3 py-1.5 font-medium text-amber-800 dark:text-amber-300">
                  Avg MOS: <b className="font-mono text-amber-950 dark:text-amber-100">{matStats.avgMos.toFixed(2)}</b> Sht/MH
                </span>
                <span className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 font-medium text-emerald-800 dark:text-emerald-300">
                  Avg Total: <b className="font-mono text-emerald-950 dark:text-emerald-100">{matStats.avgTotal.toFixed(2)}</b> Sht/MH
                </span>
                {matStats.latestDate && (
                  <span className="rounded-lg border border-base-300 bg-base-100 dark:bg-base-200/60 px-3 py-1.5 font-medium text-base-content">
                    Latest on {matStats.latestDate}: PD <b className="font-mono text-base-content font-bold">{matStats.latestPd.toFixed(2)}</b> | MOS <b className="font-mono text-base-content font-bold">{matStats.latestMos.toFixed(2)}</b>
                  </span>
                )}
              </div>
            )
          ) : !isProdView ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-base-content/80">
              <span className="rounded-lg border border-base-300 bg-base-100 dark:bg-base-200/60 px-3 py-1.5 font-medium text-base-content">
                {isHybridMode ? "YTD Total " : "Total "}
                <b className="font-mono text-base-content font-bold">{totalOutput.toLocaleString()}</b> {selectedUnitMeta.shortLabel}
              </span>
              {latestOutputPoint && (
                <span className="rounded-lg border border-base-300 bg-base-100 dark:bg-base-200/60 px-3 py-1.5 font-medium text-base-content">
                  Latest <b className="font-mono text-base-content font-bold">{latestOutputPoint.output.toLocaleString()}</b> on {latestOutputPoint.date}
                </span>
              )}
              {peakOutputPoint && peakOutputPoint.output > 0 && (
                <span className="rounded-lg border border-base-300 bg-base-100 dark:bg-base-200/60 px-3 py-1.5 font-medium text-base-content">
                  Peak <b className="font-mono text-base-content font-bold">{peakOutputPoint.output.toLocaleString()}</b> on {peakOutputPoint.date}
                </span>
              )}
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-base-content/80">
              <span className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-emerald-800 dark:text-emerald-300 font-medium">
                {isHybridMode ? "YTD Acc " : "Avg "}
                <b className="font-mono text-emerald-950 dark:text-emerald-100 font-bold">
                  {isHybridMode && prodChartStats.accAvg > 0 ? prodChartStats.accAvg.toFixed(2) : prodChartStats.avg.toFixed(2)}
                </b> {selectedUnitMeta.shortLabel}/MH
              </span>
              {hasTargetData && visibleSeries.target && prodChartStats.targetAvg > 0 && (
                <span className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 text-rose-700 dark:text-rose-300 font-medium">
                  Target <b className="font-mono text-rose-900 dark:text-rose-200 font-bold">{prodChartStats.targetAvg.toFixed(2)}</b> {selectedUnitMeta.shortLabel}/MH
                  {(isHybridMode && prodChartStats.accAvg > 0 ? prodChartStats.accAvg : prodChartStats.avg) > 0 && (
                    <span className={`ml-1.5 font-bold ${(isHybridMode && prodChartStats.accAvg > 0 ? prodChartStats.accAvg : prodChartStats.avg) >= prodChartStats.targetAvg ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      ({(((isHybridMode && prodChartStats.accAvg > 0 ? prodChartStats.accAvg : prodChartStats.avg) / prodChartStats.targetAvg) * 100).toFixed(1)}%)
                    </span>
                  )}
                </span>
              )}
              {prodChartStats.latestMonth && (
                <span className="rounded-lg border border-base-300 bg-base-100 dark:bg-base-200/60 px-3 py-1.5 font-medium text-base-content">
                  Latest <b className="font-mono text-base-content font-bold">{prodChartStats.latest.toFixed(2)}</b> on {prodChartStats.latestMonth}
                </span>
              )}
              {prodChartStats.peak > 0 && (
                <span className="rounded-lg border border-base-300 bg-base-100 dark:bg-base-200/60 px-3 py-1.5 font-medium text-base-content">
                  Peak <b className="font-mono text-base-content font-bold">{prodChartStats.peak.toFixed(2)}</b> on {prodChartStats.peakMonth}
                </span>
              )}
            </div>
          )}
        </div>

        {/* View Mode & Filter Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Unit Toggle (Piece / Sht / Lot) - Locked/Disabled if line has no data */}
          {onSelectUnit && (
            <div className="flex overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-sm">
              <button
                type="button"
                disabled={!availableUnits.piece}
                className={`px-3 py-1.5 text-xs font-bold transition-colors ${!availableUnits.piece
                  ? 'opacity-35 cursor-not-allowed bg-base-200/50 text-base-content/40'
                  : selectedUnit === 'piece'
                    ? 'bg-primary text-primary-content font-extrabold shadow-inner cursor-pointer'
                    : 'text-base-content/70 hover:bg-base-200 cursor-pointer'
                  }`}
                onClick={() => availableUnits.piece && onSelectUnit('piece')}
                title={availableUnits.piece ? "หน่วย Piece (ชิ้น)" : "ไม่มีข้อมูลหน่วย Piece สำหรับไลน์นี้"}
              >
                Piece
              </button>
              <button
                type="button"
                disabled={!availableUnits.sht}
                className={`px-3 py-1.5 text-xs font-bold transition-colors ${!availableUnits.sht
                  ? 'opacity-35 cursor-not-allowed bg-base-200/50 text-base-content/40'
                  : selectedUnit === 'sht'
                    ? 'bg-primary text-primary-content font-extrabold shadow-inner cursor-pointer'
                    : 'text-base-content/70 hover:bg-base-200 cursor-pointer'
                  }`}
                onClick={() => availableUnits.sht && onSelectUnit('sht')}
                title={availableUnits.sht ? "หน่วย Sheet (แผ่น)" : "ไม่มีข้อมูลหน่วย Sheet สำหรับไลน์นี้"}
              >
                Sht
              </button>
              <button
                type="button"
                disabled={!availableUnits.lot}
                className={`px-3 py-1.5 text-xs font-bold transition-colors ${!availableUnits.lot
                  ? 'opacity-35 cursor-not-allowed bg-base-200/50 text-base-content/40'
                  : selectedUnit === 'lot'
                    ? 'bg-primary text-primary-content font-extrabold shadow-inner cursor-pointer'
                    : 'text-base-content/70 hover:bg-base-200 cursor-pointer'
                  }`}
                onClick={() => availableUnits.lot && onSelectUnit('lot')}
                title={
                  availableUnits.lot
                    ? "หน่วย Lot (ล็อต)"
                    : isProdView
                    ? "ไม่มีการคำนวณ Productivity สำหรับหน่วย Lot (ดูได้ที่โหมด Output)"
                    : "ไม่มีข้อมูลหน่วย Lot สำหรับไลน์นี้"
                }
              >
                Lot
              </button>
            </div>
          )}

          {(isYearly || isMonthly || isWeekly || isDaily) && (
            <div className="flex overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-sm">
              <button
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${chartMode === 'output' ? 'bg-slate-900 dark:bg-slate-800 text-white' : 'text-base-content/70 hover:bg-base-200'
                  }`}
                onClick={() => setChartMode('output')}
              >
                <BarChart3 size={13} />
                Output
              </button>
              <button
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${chartMode === 'productivity' ? 'bg-emerald-600 text-white' : 'text-base-content/70 hover:bg-base-200'
                  }`}
                onClick={() => {
                  setChartMode('productivity');
                  if (selectedUnit === 'lot' && onSelectUnit) {
                    onSelectUnit('piece');
                  }
                }}
              >
                <TrendingUp size={13} />
                Productivity
              </button>
            </div>
          )}
          <div className="flex overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-sm">
            <button
              type="button"
              className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${showDataOnly ? "bg-slate-900 dark:bg-slate-800 text-white" : "text-base-content/70 hover:bg-base-200"
                }`}
              onClick={() => setShowDataOnly(true)}
            >
              Data only
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${!showDataOnly ? "bg-slate-900 dark:bg-slate-800 text-white" : "text-base-content/70 hover:bg-base-200"
                }`}
              onClick={() => setShowDataOnly(false)}
            >
              All days
            </button>
          </div>
        </div>
      </div>

      {/* Series Toggle Buttons / Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-base-300/60 px-5 py-2.5 text-xs font-semibold text-base-content/70 bg-base-200/30">
        {isHybridMode && isProdView ? (
          <div className="flex flex-wrap items-center gap-2 w-full">
            <span className="text-xs font-bold text-base-content mr-1">Hierarchy Legend:</span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 px-2.5 py-1 text-xs font-bold text-sky-800 dark:text-sky-300 shadow-xs">
              <span className="h-2.5 w-2.5 rounded-sm bg-sky-600" />
              MONTHLY
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300 shadow-xs">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
              WEEKLY
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 px-2.5 py-1 text-xs font-bold text-purple-800 dark:text-purple-300 shadow-xs">
              <span className="h-2.5 w-2.5 rounded-sm bg-purple-600" />
              DAILY
            </span>
            {hasAccProdData && (
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold border transition-all ${visibleSeries.accProd
                  ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300 shadow-xs"
                  : "bg-base-200/60 border-base-300 text-base-content/40 opacity-60"
                  }`}
                onClick={() => setVisibleSeries(prev => ({ ...prev, accProd: !prev.accProd }))}
              >
                <span className="h-0.5 w-4 rounded bg-blue-600" />
                Acc Prod ({selectedUnitMeta.shortLabel}/MH)
              </button>
            )}
            {hasTargetData && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-2.5 py-1 text-xs font-bold text-rose-800 dark:text-rose-300 shadow-xs sm:ml-auto">
                <span className="h-0.5 w-4 rounded bg-rose-600" />
                Target ({selectedUnitMeta.shortLabel}/MH)
              </span>
            )}
          </div>
        ) : !isProdView ? (
          isLineMat && !isCompare ? (
            <>
              {/* PD Output Toggle */}
              <button
                type="button"
                className={`inline-flex items-center gap-2 cursor-pointer select-none rounded-lg px-2.5 py-1.5 border transition-all ${matVisibleSeries.pdOutput
                  ? "bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-800 text-blue-950 dark:text-blue-200 font-bold shadow-xs hover:bg-blue-100 dark:hover:bg-blue-900/40"
                  : "bg-base-200/60 border-base-300 text-base-content/40 opacity-60 hover:opacity-100"
                  }`}
                onClick={() => setMatVisibleSeries(prev => ({ ...prev, pdOutput: !prev.pdOutput }))}
              >
                <span
                  className={`flex items-center justify-center w-3.5 h-3.5 rounded border transition-colors ${matVisibleSeries.pdOutput ? "bg-blue-600 border-blue-600 text-white" : "border-base-300 bg-base-100"
                    }`}
                >
                  {matVisibleSeries.pdOutput && <Check size={10} strokeWidth={3.5} />}
                </span>
                <span className="h-2.5 w-2.5 rounded-none bg-blue-600" />
                <span>PD_Output (Sht)</span>
              </button>

              {/* MOS Output Toggle */}
              <button
                type="button"
                className={`inline-flex items-center gap-2 cursor-pointer select-none rounded-lg px-2.5 py-1.5 border transition-all ${matVisibleSeries.mosOutput
                  ? "bg-amber-50/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-bold shadow-xs hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  : "bg-base-200/60 border-base-300 text-base-content/40 opacity-60 hover:opacity-100"
                  }`}
                onClick={() => setMatVisibleSeries(prev => ({ ...prev, mosOutput: !prev.mosOutput }))}
              >
                <span
                  className={`flex items-center justify-center w-3.5 h-3.5 rounded border transition-colors ${matVisibleSeries.mosOutput ? "bg-amber-600 border-amber-600 text-white" : "border-base-300 bg-base-100"
                    }`}
                >
                  {matVisibleSeries.mosOutput && <Check size={10} strokeWidth={3.5} />}
                </span>
                <span className="h-2.5 w-2.5 rounded-none bg-amber-500" />
                <span>MOS_Output (Sht)</span>
              </button>

              {/* PD Output Acc Toggle */}
              <button
                type="button"
                className={`inline-flex items-center gap-2 cursor-pointer select-none rounded-lg px-2.5 py-1.5 border transition-all ${matVisibleSeries.accPdOutput
                  ? "bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-800 text-blue-950 dark:text-blue-200 font-bold shadow-xs hover:bg-blue-100 dark:hover:bg-blue-900/40"
                  : "bg-base-200/60 border-base-300 text-base-content/40 opacity-60 hover:opacity-100"
                  }`}
                onClick={() => setMatVisibleSeries(prev => ({ ...prev, accPdOutput: !prev.accPdOutput }))}
              >
                <span
                  className={`flex items-center justify-center w-3.5 h-3.5 rounded border transition-colors ${matVisibleSeries.accPdOutput ? "bg-blue-600 border-blue-600 text-white" : "border-base-300 bg-base-100"
                    }`}
                >
                  {matVisibleSeries.accPdOutput && <Check size={10} strokeWidth={3.5} />}
                </span>
                <span className="h-0.5 w-4 rounded bg-blue-600" />
                <span>PD_Output (ACC)</span>
              </button>

              {/* MOS Output Acc Toggle */}
              <button
                type="button"
                className={`inline-flex items-center gap-2 cursor-pointer select-none rounded-lg px-2.5 py-1.5 border transition-all ${matVisibleSeries.accMosOutput
                  ? "bg-amber-50/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-bold shadow-xs hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  : "bg-base-200/60 border-base-300 text-base-content/40 opacity-60 hover:opacity-100"
                  }`}
                onClick={() => setMatVisibleSeries(prev => ({ ...prev, accMosOutput: !prev.accMosOutput }))}
              >
                <span
                  className={`flex items-center justify-center w-3.5 h-3.5 rounded border transition-colors ${matVisibleSeries.accMosOutput ? "bg-amber-600 border-amber-600 text-white" : "border-base-300 bg-base-100"
                    }`}
                >
                  {matVisibleSeries.accMosOutput && <Check size={10} strokeWidth={3.5} />}
                </span>
                <span className="h-0.5 w-4 rounded border-b-2 border-dashed border-amber-600" />
                <span>MOS_Output (ACC)</span>
              </button>
            </>
          ) : !isCompare ? (
            <>
              {/* Plan Toggle */}
              {!isPcnLine && hasPlanData && (
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 cursor-pointer select-none rounded-lg px-2.5 py-1.5 border transition-all ${visibleSeries.plan
                    ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300 font-bold shadow-xs hover:bg-blue-100 dark:hover:bg-blue-900/40"
                    : "bg-base-200/60 border-base-300 text-base-content/40 opacity-60 hover:opacity-100"
                    }`}
                  onClick={() => setVisibleSeries(prev => ({ ...prev, plan: !prev.plan }))}
                >
                  <span
                    className={`flex items-center justify-center w-3.5 h-3.5 rounded border transition-colors ${visibleSeries.plan ? "bg-blue-600 border-blue-600 text-white" : "border-base-300 bg-base-100"
                      }`}
                  >
                    {visibleSeries.plan && <Check size={10} strokeWidth={3.5} />}
                  </span>
                  <span className="h-2.5 w-2.5 rounded-none bg-blue-700" />
                  <span>{selectedUnitMeta.shortLabel}_Plan</span>
                </button>
              )}

              {/* Output Toggle */}
              {hasOutputData && (
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 cursor-pointer select-none rounded-lg px-2.5 py-1.5 border transition-all ${visibleSeries.output
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                    : "bg-base-200/60 border-base-300 text-base-content/40 opacity-60 hover:opacity-100"
                    }`}
                  onClick={() => setVisibleSeries(prev => ({ ...prev, output: !prev.output }))}
                >
                  <span
                    className={`flex items-center justify-center w-3.5 h-3.5 rounded border transition-colors ${visibleSeries.output ? "bg-emerald-600 border-emerald-600 text-white" : "border-base-300 bg-base-100"
                      }`}
                  >
                    {visibleSeries.output && <Check size={10} strokeWidth={3.5} />}
                  </span>
                  <span className="h-2.5 w-2.5 rounded-none bg-emerald-600" />
                  <span>{selectedUnitMeta.shortLabel}_Output</span>
                </button>
              )}

              {/* Acc Plan Toggle */}
              {!isPcnLine && hasAccPlanData && (
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 cursor-pointer select-none rounded-lg px-2.5 py-1.5 border transition-all ${visibleSeries.accPlan
                    ? "bg-orange-50 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800 text-orange-800 dark:text-orange-300 font-bold shadow-xs hover:bg-orange-100 dark:hover:bg-orange-900/40"
                    : "bg-base-200/60 border-base-300 text-base-content/40 opacity-60 hover:opacity-100"
                    }`}
                  onClick={() => setVisibleSeries(prev => ({ ...prev, accPlan: !prev.accPlan }))}
                >
                  <span
                    className={`flex items-center justify-center w-3.5 h-3.5 rounded border transition-colors ${visibleSeries.accPlan ? "bg-orange-500 border-orange-500 text-white" : "border-base-300 bg-base-100"
                      }`}
                  >
                    {visibleSeries.accPlan && <Check size={10} strokeWidth={3.5} />}
                  </span>
                  <span className="h-0.5 w-4 rounded bg-orange-500" />
                  <span>{selectedUnitMeta.shortLabel}_Plan (ACC)</span>
                </button>
              )}

              {/* Acc Output Toggle */}
              {hasAccOutputData && (
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 cursor-pointer select-none rounded-lg px-2.5 py-1.5 border transition-all ${visibleSeries.accOutput
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                    : "bg-base-200/60 border-base-300 text-base-content/40 opacity-60 hover:opacity-100"
                    }`}
                  onClick={() => setVisibleSeries(prev => ({ ...prev, accOutput: !prev.accOutput }))}
                >
                  <span
                    className={`flex items-center justify-center w-3.5 h-3.5 rounded border transition-colors ${visibleSeries.accOutput ? "bg-emerald-500 border-emerald-500 text-white" : "border-base-300 bg-base-100"
                      }`}
                  >
                    {visibleSeries.accOutput && <Check size={10} strokeWidth={3.5} />}
                  </span>
                  <span className="h-0.5 w-4 rounded bg-emerald-500" />
                  <span>{selectedUnitMeta.shortLabel}_Output (ACC)</span>
                </button>
              )}

              {/* Daily Productivity Toggle (in Output mode) */}
              {hasAccProdData && (
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 cursor-pointer select-none rounded-lg px-2.5 py-1.5 border transition-all ${visibleSeries.outputDailyProd
                    ? "bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-800 dark:text-purple-300 font-bold shadow-xs hover:bg-purple-100 dark:hover:bg-purple-900/40"
                    : "bg-base-200/60 border-base-300 text-base-content/40 opacity-60 hover:opacity-100"
                    }`}
                  onClick={() => setVisibleSeries(prev => ({ ...prev, outputDailyProd: !prev.outputDailyProd }))}
                >
                  <span
                    className={`flex items-center justify-center w-3.5 h-3.5 rounded border transition-colors ${visibleSeries.outputDailyProd ? "bg-purple-500 border-purple-500 text-white" : "border-base-300 bg-base-100"
                      }`}
                  >
                    {visibleSeries.outputDailyProd && <Check size={10} strokeWidth={3.5} />}
                  </span>
                  <span className="h-0.5 w-4 rounded border-b-2 border-dashed border-purple-500" />
                  <span>Daily Productivity ({selectedUnitMeta.shortLabel}/MH)</span>
                </button>
              )}

              {/* Timeline Guide for Hybrid Mode in Output View */}
              {isHybridMode && (
                <div className="flex items-center gap-1.5 sm:ml-auto">
                  <span className="text-xs font-bold text-base-content/70 mr-0.5">Timeline:</span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 px-2 py-0.5 text-[11px] font-bold text-sky-800 dark:text-sky-300">
                    <span className="h-2 w-2 rounded-sm bg-sky-600" />
                    MONTHLY
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                    <span className="h-2 w-2 rounded-sm bg-amber-500" />
                    WEEKLY
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 px-2 py-0.5 text-[11px] font-bold text-purple-800 dark:text-purple-300">
                    <span className="h-2 w-2 rounded-sm bg-purple-600" />
                    DAILY
                  </span>
                </div>
              )}
            </>
          ) : (
            linesToSum?.map((line, i) => {
              const color = SERIES_COLORS[i % SERIES_COLORS.length];
              const isOutVisible = visibleLineSeries[line]?.output !== false;

              return (
                <button
                  key={line}
                  type="button"
                  className={`inline-flex items-center gap-1.5 cursor-pointer select-none text-xs px-2.5 py-1.5 rounded-lg border transition-all ${isOutVisible ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-200 font-bold' : 'bg-base-200/60 border-base-300 text-base-content/40 opacity-50'
                    }`}
                  onClick={() => setVisibleLineSeries(prev => ({
                    ...prev,
                    [line]: { ...prev[line], output: !isOutVisible }
                  }))}
                >
                  <span
                    className={`flex items-center justify-center w-3.5 h-3.5 rounded border text-[9px] transition-colors ${isOutVisible ? 'bg-sky-500 border-sky-500 text-white' : 'border-base-300 bg-base-100'
                      }`}
                  >
                    {isOutVisible && <Check size={10} strokeWidth={3.5} />}
                  </span>
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color.barEnd }} />
                  <span>{line} Output</span>
                </button>
              );
            })
          )
        ) : isLineMat && !isCompare ? (
          <>
            {/* PD Productivity Toggle */}
            <button
              type="button"
              className={`inline-flex items-center gap-2 cursor-pointer select-none rounded-lg px-2.5 py-1.5 border transition-all ${matVisibleSeries.pdProd
                ? "bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-800 text-blue-950 dark:text-blue-200 font-bold shadow-xs hover:bg-blue-100 dark:hover:bg-blue-900/40"
                : "bg-base-200/60 border-base-300 text-base-content/40 opacity-60 hover:opacity-100"
                }`}
              onClick={() => setMatVisibleSeries(prev => ({ ...prev, pdProd: !prev.pdProd }))}
            >
              <span
                className={`flex items-center justify-center w-3.5 h-3.5 rounded border transition-colors ${matVisibleSeries.pdProd ? "bg-blue-600 border-blue-600 text-white" : "border-base-300 bg-base-100"
                  }`}
              >
                {matVisibleSeries.pdProd && <Check size={10} strokeWidth={3.5} />}
              </span>
              <span className="h-2.5 w-2.5 rounded-none bg-blue-600" />
              <span>PD Productivity (Sht/MH)</span>
            </button>

            {/* MOS Productivity Toggle */}
            <button
              type="button"
              className={`inline-flex items-center gap-2 cursor-pointer select-none rounded-lg px-2.5 py-1.5 border transition-all ${matVisibleSeries.mosProd
                ? "bg-amber-50/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-bold shadow-xs hover:bg-amber-100 dark:hover:bg-amber-900/40"
                : "bg-base-200/60 border-base-300 text-base-content/40 opacity-60 hover:opacity-100"
                }`}
              onClick={() => setMatVisibleSeries(prev => ({ ...prev, mosProd: !prev.mosProd }))}
            >
              <span
                className={`flex items-center justify-center w-3.5 h-3.5 rounded border transition-colors ${matVisibleSeries.mosProd ? "bg-amber-600 border-amber-600 text-white" : "border-base-300 bg-base-100"
                  }`}
              >
                {matVisibleSeries.mosProd && <Check size={10} strokeWidth={3.5} />}
              </span>
              <span className="h-2.5 w-2.5 rounded-none bg-amber-500" />
              <span>MOS Productivity (Sht/MH)</span>
            </button>

            {/* PD Target Toggle */}
            {hasMatPdTarget && (
              <button
                type="button"
                className={`inline-flex items-center gap-2 cursor-pointer select-none rounded-lg px-2.5 py-1.5 border transition-all ${matVisibleSeries.pdTarget
                  ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300 font-bold shadow-xs hover:bg-blue-100 dark:hover:bg-blue-900/40"
                  : "bg-base-200/60 border-base-300 text-base-content/40 opacity-60 hover:opacity-100"
                  }`}
                onClick={() => setMatVisibleSeries(prev => ({ ...prev, pdTarget: !prev.pdTarget }))}
              >
                <span
                  className={`flex items-center justify-center w-3.5 h-3.5 rounded border transition-colors ${matVisibleSeries.pdTarget ? "bg-blue-600 border-blue-600 text-white" : "border-base-300 bg-base-100"
                    }`}
                >
                  {matVisibleSeries.pdTarget && <Check size={10} strokeWidth={3.5} />}
                </span>
                <span className="h-0.5 w-4 rounded border-b-2 border-dashed border-blue-600" />
                <span>PD Target (Sht/MH)</span>
              </button>
            )}

            {/* MOS Target Toggle */}
            {hasMatMosTarget && (
              <button
                type="button"
                className={`inline-flex items-center gap-2 cursor-pointer select-none rounded-lg px-2.5 py-1.5 border transition-all ${matVisibleSeries.mosTarget
                  ? "bg-orange-50 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800 text-orange-800 dark:text-orange-300 font-bold shadow-xs hover:bg-orange-100 dark:hover:bg-orange-900/40"
                  : "bg-base-200/60 border-base-300 text-base-content/40 opacity-60 hover:opacity-100"
                  }`}
                onClick={() => setMatVisibleSeries(prev => ({ ...prev, mosTarget: !prev.mosTarget }))}
              >
                <span
                  className={`flex items-center justify-center w-3.5 h-3.5 rounded border transition-colors ${matVisibleSeries.mosTarget ? "bg-orange-600 border-orange-600 text-white" : "border-base-300 bg-base-100"
                    }`}
                >
                  {matVisibleSeries.mosTarget && <Check size={10} strokeWidth={3.5} />}
                </span>
                <span className="h-0.5 w-4 rounded border-b-2 border-dashed border-orange-600" />
                <span>MOS Target (Sht/MH)</span>
              </button>
            )}

            {/* Acc Prod (PD) Toggle */}
            <button
              type="button"
              className={`inline-flex items-center gap-2 cursor-pointer select-none rounded-lg px-2.5 py-1.5 border transition-all ${matVisibleSeries.accPdProd
                ? "bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-800 text-blue-950 dark:text-blue-200 font-bold shadow-xs hover:bg-blue-100 dark:hover:bg-blue-900/40"
                : "bg-base-200/60 border-base-300 text-base-content/40 opacity-60 hover:opacity-100"
                }`}
              onClick={() => setMatVisibleSeries(prev => ({ ...prev, accPdProd: !prev.accPdProd }))}
            >
              <span
                className={`flex items-center justify-center w-3.5 h-3.5 rounded border transition-colors ${matVisibleSeries.accPdProd ? "bg-blue-600 border-blue-600 text-white" : "border-base-300 bg-base-100"
                  }`}
              >
                {matVisibleSeries.accPdProd && <Check size={10} strokeWidth={3.5} />}
              </span>
              <span className="h-0.5 w-4 rounded bg-blue-700" />
              <span>Acc Prod (PD)</span>
            </button>

            {/* Acc Prod (MOS) Toggle */}
            <button
              type="button"
              className={`inline-flex items-center gap-2 cursor-pointer select-none rounded-lg px-2.5 py-1.5 border transition-all ${matVisibleSeries.accMosProd
                ? "bg-amber-50/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-bold shadow-xs hover:bg-amber-100 dark:hover:bg-amber-900/40"
                : "bg-base-200/60 border-base-300 text-base-content/40 opacity-60 hover:opacity-100"
                }`}
              onClick={() => setMatVisibleSeries(prev => ({ ...prev, accMosProd: !prev.accMosProd }))}
            >
              <span
                className={`flex items-center justify-center w-3.5 h-3.5 rounded border transition-colors ${matVisibleSeries.accMosProd ? "bg-amber-600 border-amber-600 text-white" : "border-base-300 bg-base-100"
                  }`}
              >
                {matVisibleSeries.accMosProd && <Check size={10} strokeWidth={3.5} />}
              </span>
              <span className="h-0.5 w-4 rounded border-b-2 border-dotted border-amber-600" />
              <span>Acc Prod (MOS)</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`inline-flex items-center gap-2 cursor-pointer select-none rounded-lg px-2.5 py-1.5 border transition-all ${visibleSeries.productivity
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                : "bg-base-200/60 border-base-300 text-base-content/40 opacity-60 hover:opacity-100"
                }`}
              onClick={() => setVisibleSeries(prev => ({ ...prev, productivity: !prev.productivity }))}
            >
              <span
                className={`flex items-center justify-center w-3.5 h-3.5 rounded border transition-colors ${visibleSeries.productivity ? "bg-emerald-600 border-emerald-600 text-white" : "border-base-300 bg-base-100"
                  }`}
              >
                {visibleSeries.productivity && <Check size={10} strokeWidth={3.5} />}
              </span>
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              <span>{granularity === 'weekly' ? 'Weekly' : granularity === 'monthly' ? 'Monthly' : 'Daily'} Productivity ({selectedUnitMeta.shortLabel}/MH)</span>
            </button>

            {/* Acc Prod Toggle */}
            {hasAccProdData && (
              <button
                type="button"
                className={`inline-flex items-center gap-2 cursor-pointer select-none rounded-lg px-2.5 py-1.5 border transition-all ${visibleSeries.accProd
                  ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300 font-bold shadow-xs hover:bg-blue-100 dark:hover:bg-blue-900/40"
                  : "bg-base-200/60 border-base-300 text-base-content/40 opacity-60 hover:opacity-100"
                  }`}
                onClick={() => setVisibleSeries(prev => ({ ...prev, accProd: !prev.accProd }))}
              >
                <span
                  className={`flex items-center justify-center w-3.5 h-3.5 rounded border transition-colors ${visibleSeries.accProd ? "bg-blue-600 border-blue-600 text-white" : "border-base-300 bg-base-100"
                    }`}
                >
                  {visibleSeries.accProd && <Check size={10} strokeWidth={3.5} />}
                </span>
                <span className="h-0.5 w-4 rounded bg-blue-600" />
                <span>Acc Prod ({selectedUnitMeta.shortLabel}/MH)</span>
              </button>
            )}

            {hasTargetData && (
              <button
                type="button"
                className={`inline-flex items-center gap-2 cursor-pointer select-none rounded-lg px-2.5 py-1.5 border transition-all ${visibleSeries.target
                  ? "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 font-bold shadow-xs hover:bg-rose-100 dark:hover:bg-rose-900/40"
                  : "bg-base-200/60 border-base-300 text-base-content/40 opacity-60 hover:opacity-100"
                  }`}
                onClick={() => setVisibleSeries(prev => ({ ...prev, target: !prev.target }))}
              >
                <span
                  className={`flex items-center justify-center w-3.5 h-3.5 rounded border transition-colors ${visibleSeries.target ? "bg-rose-600 border-rose-600 text-white" : "border-base-300 bg-base-100"
                    }`}
                >
                  {visibleSeries.target && <Check size={10} strokeWidth={3.5} />}
                </span>
                <span className="w-4 border-t-2 border-dashed border-rose-600" />
                <span>Target ({selectedUnitMeta.shortLabel}/MH)</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Apache ECharts Vector/Canvas */}
      <div className="p-4 sm:p-5">
        <ReactECharts
          option={echartOption}
          style={{ height: '480px', width: '100%' }}
          notMerge={true}
          lazyUpdate={true}
          opts={{ renderer: 'svg' }}
        />
      </div>

      {/* Multi-tier Quarter/Month Brackets */}
      {isHybridMode && hybridBrackets.length > 0 && (
        <div className="flex w-full items-start px-4 sm:px-5 pb-5">
          <div
            className="flex w-full items-start gap-0"
            style={{
              marginLeft: chartLeftPadding,
              marginRight: chartRightPadding,
              width: `calc(100% - ${chartLeftPadding + chartRightPadding}px)`
            }}
          >
            {hybridBrackets.map((group, i) => {
              const QTR_COLORS = [
                { bracket: '#0284c7', bg: 'rgba(2,132,199,0.08)', border: 'rgba(2,132,199,0.3)', text: '#0369a1' },
                { bracket: '#0369a1', bg: 'rgba(3,105,161,0.08)', border: 'rgba(3,105,161,0.3)', text: '#075985' },
                { bracket: '#0284c7', bg: 'rgba(2,132,199,0.08)', border: 'rgba(2,132,199,0.3)', text: '#0369a1' },
                { bracket: '#0369a1', bg: 'rgba(3,105,161,0.08)', border: 'rgba(3,105,161,0.3)', text: '#075985' },
              ];

              const isMonthBracket = group.level === 'month';
              const isWeekBracket = group.level === 'week';

              const color = isMonthBracket
                ? { bracket: '#d97706', bg: 'rgba(217,119,6,0.12)', border: 'rgba(217,119,6,0.35)', text: '#9a3412' }
                : isWeekBracket
                  ? { bracket: '#7c3aed', bg: 'rgba(124,58,237,0.12)', border: 'rgba(124,58,237,0.35)', text: '#5b21b6' }
                  : QTR_COLORS[((group.qtrNum || 1) - 1) % QTR_COLORS.length];

              return (
                <div
                  key={`hybrid-bracket-${i}`}
                  className="flex flex-col items-center gap-1.5 px-0.5 min-w-0"
                  style={{ flex: `${group.count} ${group.count} 0%` }}
                >
                  <svg
                    width="100%"
                    height="16"
                    viewBox="0 0 200 16"
                    preserveAspectRatio="none"
                    style={{ overflow: 'visible', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))' }}
                  >
                    <path
                      d="M 6 1 L 6 6 Q 6 9 9 9 L 95 9 Q 100 9 100 13 Q 100 9 105 9 L 191 9 Q 194 9 194 6 L 194 1"
                      fill="none"
                      stroke={color.bracket}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  <span
                    className="inline-flex items-center justify-center text-center rounded-full px-2.5 py-0.5 text-[11px] font-black tracking-wide shadow-xs truncate max-w-full"
                    style={{
                      background: color.bg,
                      border: `1px solid ${color.border}`,
                      color: color.text,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {group.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

ProductivityChart.displayName = 'ProductivityChart';
