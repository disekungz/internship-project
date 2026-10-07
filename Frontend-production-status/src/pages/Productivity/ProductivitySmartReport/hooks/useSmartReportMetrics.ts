import { useMemo } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
dayjs.extend(isoWeek);

import {
  LineGroup,
  LineGroupFilter,
  LineGroupRow,
  OutputUnit
} from "../types";
import {
  MATRIX_LINE_GROUP_NAMES,
  normalizeMatrixLineGroupName
} from "./useProcessOutputData";
import { useMatrixAggregation } from "./useMatrixAggregation";
import { getMappedAttendanceValue } from "../utils/attendanceMapper";
import { getFiscalQuarter, getProductionWeekKey } from "../utils/fiscalYear";
import {
  getCachedCustomMacroLines,
  getCustomMacroOutputSources,
  getCustomMacroSubLines
} from "../utils/customMacroStore";
import { buildPlanMaps } from "../utils/planRollup";
import { useHybridRollupData } from "./useHybridRollupData";

export interface UseSmartReportMetricsProps {
  rows: LineGroupRow[];
  lineGroups: LineGroup[];
  selectedFactory: string;
  selectedLineGroup: LineGroupFilter;
  startDate?: string;
  endDate?: string;
  selectedUnit: OutputUnit;
  granularity: Granularity;
  calendarData?: Record<string, number>;
  attendanceData?: Record<string, any>;
  matDailyData?: any[];
}

export const useSmartReportMetrics = ({
  rows,
  lineGroups,
  selectedFactory,
  selectedLineGroup,
  startDate = "",
  endDate = "",
  selectedUnit,
  granularity,
  calendarData,
  attendanceData,
  matDailyData,
}: UseSmartReportMetricsProps) => {

  // 1. Filter rows by factory and lineGroup
  const visibleRows = useMemo(() => {
    if (selectedFactory === "ALL" && (selectedLineGroup === "ALL" || selectedLineGroup.length === 0)) {
      return rows;
    }
    const customMacroNames = new Set(getCachedCustomMacroLines().map(cm => cm.macro_name.toUpperCase()));
    const selectedList = Array.isArray(selectedLineGroup) ? selectedLineGroup : (selectedLineGroup === "ALL" ? [] : [selectedLineGroup]);
    if (selectedLineGroup !== "ALL" && selectedList.some(name =>
      MATRIX_LINE_GROUP_NAMES.includes(normalizeMatrixLineGroupName(name)) ||
      name.toUpperCase() === "AUTOMOTIVE" ||
      customMacroNames.has(name.toUpperCase())
    )) {
      return rows;
    }
    if (selectedFactory === "MACRO") {
      return rows;
    }

    let selectedGroups: LineGroup[] = lineGroups;
    if (selectedFactory !== "ALL") {
      selectedGroups = selectedGroups.filter(group => group.factory === selectedFactory);
    }

    if (selectedLineGroup !== "ALL" && selectedList.length > 0) {
      const selectedNames = new Set(
        selectedList.map(name => normalizeMatrixLineGroupName(name).toUpperCase())
      );
      selectedGroups = selectedGroups.filter(group =>
        selectedNames.has(normalizeMatrixLineGroupName(group.name).toUpperCase())
      );
    }

    if (selectedGroups.length === 0) return rows;

    const selectedGroupNames = new Set(selectedGroups.map(group => normalizeMatrixLineGroupName(group.name).toUpperCase()));
    const customMacros = getCachedCustomMacroLines();
    selectedGroups.forEach(group => {
      const macro = customMacros.find(cm => cm.macro_name.toUpperCase() === group.name.toUpperCase());
      if (macro) {
        getCustomMacroSubLines(macro).forEach(sub => selectedGroupNames.add(normalizeMatrixLineGroupName(sub).toUpperCase()));
        getCustomMacroOutputSources(macro).forEach(src => selectedGroupNames.add(normalizeMatrixLineGroupName(src).toUpperCase()));
      }
    });
    return rows.filter(row => selectedGroupNames.has(normalizeMatrixLineGroupName(row.lineGroup).toUpperCase()));
  }, [lineGroups, rows, selectedFactory, selectedLineGroup]);

  // 2. Matrix aggregation hook
  const { dateColumns, aggregatedAttendanceData, matrixData } = useMatrixAggregation({
    rows: visibleRows,
    startDate,
    endDate,
    selectedUnit,
    granularity,
    calendarData,
    attendanceData
  });

  // 3. Chart title
  const chartTitle = useMemo(() => {
    let targetName = "Macro PCN";
    if (selectedLineGroup !== "ALL" && selectedLineGroup.length > 0) {
      targetName = Array.isArray(selectedLineGroup) ? selectedLineGroup.join(', ') : selectedLineGroup;
    } else if (selectedFactory === "SMT") {
      targetName = "Sector SMT";
    } else if (selectedFactory === "FPC") {
      targetName = "Sector FPC";
    }
    return `Output Trend - ${targetName}`;
  }, [selectedLineGroup, selectedFactory]);

  // 3.5. Plan aggregation & macro rollups (matching table & export)
  const { pPlanMap, sPlanMap, lPlanMap, getLinePlan } = useMemo(() => {
    return buildPlanMaps(visibleRows, granularity, aggregatedAttendanceData);
  }, [visibleRows, granularity, aggregatedAttendanceData]);

  // 4. Chart output, plan & attendance mappings
  const { chartAttendanceData, chartOutputData, chartPlanData, lineOutputMap, linePlanMap, lineAttendanceMap, linesToSum } = useMemo(() => {
    const attendanceDataMap: Record<string, any> = {};
    const outputDataMap: Record<string, number> = {};
    const planDataMap: Record<string, number> = {};
    const dateKeys = Object.keys(aggregatedAttendanceData || {});

    let linesToSum: string[] = [];
    if (selectedLineGroup === "ALL" || selectedLineGroup.length === 0) {
      if (selectedFactory === "SMT") linesToSum = ["Macro SMT"];
      else if (selectedFactory === "FPC") linesToSum = ["Macro FPC"];
      else linesToSum = ["Macro PCN"];
    } else {
      linesToSum = Array.isArray(selectedLineGroup) ? selectedLineGroup : [selectedLineGroup];
    }

    const _lineOutputMap: Record<string, Record<string, number>> = {};
    const _lineAttendanceMap: Record<string, Record<string, number>> = {};
    const _linePlanMap: Record<string, Record<string, number>> = {};

    const linesToTrack = Array.from(new Set([...linesToSum, "Macro PCN", "Macro FPC", "Macro SMT"]));

    linesToTrack.forEach(line => {
      _lineOutputMap[line] = {};
      _lineAttendanceMap[line] = {};
      _linePlanMap[line] = {};

      const linePlan = getLinePlan(line, selectedUnit);
      linePlan.forEach((val, dateKey) => {
        _linePlanMap[line][dateKey] = val;
        if (linesToSum.includes(line)) {
          planDataMap[dateKey] = (planDataMap[dateKey] || 0) + val;
        }
      });
    });

    for (const date of dateKeys) {
      const dataForDate = aggregatedAttendanceData[date];
      if (!dataForDate) continue;

      let dailyManHour = 0;
      linesToTrack.forEach(line => {
        const mh = getMappedAttendanceValue(line, dataForDate, 'fpc_total_man_hour', 'total_man_hour', granularity);
        if (linesToSum.includes(line)) {
          dailyManHour += mh;
        }
        _lineAttendanceMap[line][date] = mh;
      });

      attendanceDataMap[date] = {
        ...dataForDate,
        total_man_hour: dailyManHour
      };
    }

    // Compute outputData from matrixData or matDailyData
    linesToTrack.forEach(line => {
      const normLine = normalizeMatrixLineGroupName(line).toUpperCase();
      const isMatLine = normLine.includes("MAT") || line.toUpperCase().includes("MAT");

      if (isMatLine && Array.isArray(matDailyData) && matDailyData.length > 0) {
        matDailyData.forEach(item => {
          if (!item.date) return;
          const pd = Math.round(Number(item.pd_output || 0));
          const mos = Math.round(Number(item.mos_output || 0));
          const total = pd + mos;

          const rawDate = String(item.date).split("T")[0];
          const parsed = dayjs(rawDate);

          let dateKey = rawDate;
          if (parsed.isValid()) {
            if (granularity === "weekly") dateKey = getProductionWeekKey(parsed);
            else if (granularity === "monthly") dateKey = parsed.format("YYYY-MM");
            else if (granularity === "quarterly") dateKey = getFiscalQuarter(parsed);
            else if (granularity === "yearly") dateKey = parsed.format("YYYY");
            else dateKey = parsed.format("YYYY-MM-DD");
          }

          _lineOutputMap[line][dateKey] = (_lineOutputMap[line][dateKey] || 0) + total;
          if (linesToSum.includes(line)) {
            outputDataMap[dateKey] = (outputDataMap[dateKey] || 0) + total;
          }
        });
        return;
      }

      const matrixRow = matrixData.find(m => {
        const m0Upper = m[0].toUpperCase();
        const normM0 = normalizeMatrixLineGroupName(m[0]).toUpperCase();
        return m0Upper === line.toUpperCase() || normM0 === normLine || m0Upper === normLine || normM0 === line.toUpperCase();
      });
      if (matrixRow) {
        const [_, dateMap] = matrixRow;
        dateMap.forEach((val, dateKey) => {
          if (linesToSum.includes(line)) {
            outputDataMap[dateKey] = (outputDataMap[dateKey] || 0) + val;
          }
          _lineOutputMap[line][dateKey] = val;
        });
      }
    });

    return {
      chartAttendanceData: attendanceDataMap,
      chartOutputData: outputDataMap,
      chartPlanData: planDataMap,
      lineOutputMap: _lineOutputMap,
      linePlanMap: _linePlanMap,
      lineAttendanceMap: _lineAttendanceMap,
      linesToSum
    };
  }, [aggregatedAttendanceData, matrixData, selectedLineGroup, selectedFactory, granularity, matDailyData, getLinePlan, selectedUnit]);

  // 4.5. Hybrid rollup data (for yearly view)
  const { hybridChartData, hybridBrackets } = useHybridRollupData({
    startDate: startDate || "",
    endDate: endDate || "",
    selectedUnit,
    selectedLineGroup: Array.isArray(selectedLineGroup) ? selectedLineGroup[0] : (selectedLineGroup || "ALL"),
    linesToSum,
    enabled: granularity === "yearly",
  });

  // 5. Grand Totals (KPIs)
  const grandTotals = useMemo(() => {
    if (granularity === "yearly" && hybridChartData && hybridChartData.length > 0) {
      let output = 0;
      let manHours = 0;
      let latestAccProd: number | null = null;
      hybridChartData.forEach(d => {
        if (d.isDivider) return;
        output += Number(d.output || 0);
        manHours += Number(d.manHours || 0);
        if (typeof d.accProd === "number" && d.accProd > 0) {
          latestAccProd = d.accProd;
        }
      });
      const accProd = latestAccProd !== null ? latestAccProd : (manHours > 0 ? output / manHours : 0);
      return { output, manHours, accProd };
    }

    const output = Object.values(chartOutputData).reduce((sum, val) => sum + val, 0);

    let manHours = 0;
    let validManHours = 0;
    let outputForManHours = 0;

    Object.entries(chartAttendanceData).forEach(([date, data]: [string, any]) => {
      const dailyMH = Number(data?.total_man_hour || 0);
      const dailyOutput = Number(chartOutputData[date] || 0);
      manHours += dailyMH;
      if (dailyMH > 0 && dailyOutput > 0) {
        validManHours += dailyMH;
        outputForManHours += dailyOutput;
      }
    });

    const accProd = validManHours > 0 ? (outputForManHours / validManHours) : 0;

    return { output, manHours, accProd };
  }, [chartOutputData, chartAttendanceData, granularity, hybridChartData]);

  // 6. Line breakdown pills
  const lineBreakdowns = useMemo(() => {
    const isLineMatOnly = (typeof selectedLineGroup === "string" && selectedLineGroup.toUpperCase().includes("MAT")) ||
      (Array.isArray(selectedLineGroup) && selectedLineGroup.length === 1 && selectedLineGroup[0].toUpperCase().includes("MAT"));

    if (isLineMatOnly && Array.isArray(matDailyData) && matDailyData.length > 0) {
      let pdOut = 0;
      let mosOut = 0;
      let validPdMH = 0;
      let validMosMH = 0;
      let totalMH = 0;

      matDailyData.forEach(item => {
        const pd = Math.round(Number(item.pd_output || 0));
        const mos = Math.round(Number(item.mos_output || 0));
        const d = item.date;
        const mh = Number(chartAttendanceData[d]?.total_man_hour || 0);
        pdOut += pd;
        mosOut += mos;
        if (pd > 0 && mh > 0) validPdMH += mh;
        if (mos > 0 && mh > 0) validMosMH += mh;
      });

      Object.values(chartAttendanceData).forEach((data: any) => {
        totalMH += Number(data?.total_man_hour || 0);
      });

      const pdProd = validPdMH > 0 ? (pdOut / validPdMH) : 0;
      const mosProd = validMosMH > 0 ? (mosOut / validMosMH) : 0;

      return [
        { lineName: "PD", output: pdOut, manHours: totalMH, prod: pdProd },
        { lineName: "MOS", output: mosOut, manHours: totalMH, prod: mosProd },
      ];
    }

    let breakdownLines: string[] = [];
    if (Array.isArray(selectedLineGroup) && selectedLineGroup.length >= 2) {
      breakdownLines = selectedLineGroup;
    } else if (selectedFactory === "ALL" && (selectedLineGroup === "ALL" || selectedLineGroup.length === 0)) {
      breakdownLines = ["Macro FPC", "Macro SMT"];
    } else {
      return null;
    }

    return breakdownLines.map(lineName => {
      const lineOut = Object.values(lineOutputMap[lineName] || {}).reduce((sum, val) => sum + val, 0);
      let lineMH = 0;
      let validMH = 0;
      let outForMH = 0;

      Object.entries(lineAttendanceMap[lineName] || {}).forEach(([date, mh]) => {
        const numMH = Number(mh || 0);
        const out = Number(lineOutputMap[lineName]?.[date] || 0);
        lineMH += numMH;
        if (numMH > 0 && out > 0) {
          validMH += numMH;
          outForMH += out;
        }
      });

      const lineProd = validMH > 0 ? (outForMH / validMH) : 0;
      return {
        lineName: lineName === "Macro FPC" ? "FPC" : lineName === "Macro SMT" ? "SMT" : lineName,
        output: lineOut,
        manHours: lineMH,
        prod: lineProd
      };
    });
  }, [selectedLineGroup, selectedFactory, lineOutputMap, lineAttendanceMap, matDailyData, chartAttendanceData]);

  // 7. Latest data date detection
  const latestDataDate = useMemo(() => {
    if (aggregatedAttendanceData) {
      const dates = Object.keys(aggregatedAttendanceData).sort();
      for (let i = dates.length - 1; i >= 0; i--) {
        const d = dates[i];
        const data = aggregatedAttendanceData[d];
        if (data) {
          const hasAtt = Object.entries(data).some(([k, v]) =>
            typeof v === 'number' && v > 0 && !k.includes('id') && !k.includes('shift')
          );
          if (hasAtt) return d;
        }
      }
    }
    if (visibleRows && visibleRows.length > 0) {
      const datesWithOutput = visibleRows
        .filter(r => Number(r.pieceQty || 0) > 0 && r.date)
        .map(r => r.date)
        .sort();
      if (datesWithOutput.length > 0) return datesWithOutput[datesWithOutput.length - 1];
    }
    if (dateColumns && dateColumns.length > 0) {
      return dateColumns[dateColumns.length - 1];
    }
    return endDate || startDate || dayjs().format("YYYY-MM-DD");
  }, [aggregatedAttendanceData, visibleRows, dateColumns, endDate, startDate]);

  // 8. SMT & FPC Plan aggregation
  const planData = useMemo(() => {
    return selectedUnit === "sht" ? sPlanMap : selectedUnit === "lot" ? lPlanMap : pPlanMap;
  }, [selectedUnit, sPlanMap, lPlanMap, pPlanMap]);

  // Selected unit metadata for summary cards and badges
  const selectedUnitMeta = useMemo(() => {
    return [
      { key: "lot", label: "Lot Output", shortLabel: "Lot" },
      { key: "sht", label: "Sht Output", shortLabel: "Sht" },
      { key: "piece", label: "Piece Output", shortLabel: "Piece" },
    ].find(u => u.key === selectedUnit) ?? { key: "piece", label: "Piece Output", shortLabel: "Piece" };
  }, [selectedUnit]);

  const formatCompactNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  return {
    visibleRows,
    dateColumns,
    aggregatedAttendanceData,
    matrixData,
    chartTitle,
    chartAttendanceData,
    chartOutputData,
    chartPlanData,
    lineOutputMap,
    linePlanMap,
    lineAttendanceMap,
    linesToSum,
    grandTotals,
    lineBreakdowns,
    latestDataDate,
    planData,
    getLinePlan,
    hybridChartData,
    hybridBrackets,
    selectedUnitMeta,
    formatCompactNumber
  };
};
