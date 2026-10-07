import { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import { OutputUnit } from '../types';
import { API_BASE_URL } from '../../../../utils/apiConfig';
import { normalizeMatrixLineGroupName } from './useProcessOutputData';
import { getFiscalQuarterInfo, getProductionWeekKey } from '../utils/fiscalYear';

dayjs.extend(isoWeek);
dayjs.extend(quarterOfYear);

export interface HybridChartItem {
  key: string;
  rawDate: string;
  date: string; // Formatted label (e.g. "Jul 2026", "W31", "17 Aug")
  level: 'month' | 'week' | 'day' | 'divider';
  output: number;
  plan?: number;
  manHours: number;
  productivity: number;
  target: number | null;
  accProd: number | null;
  accOutput?: number | null;
  accPlan?: number | null;
  parentMonth?: string;
  parentWeek?: string;
  fiscalQuarter?: string;
  qtrNum?: number;
  qtrYear?: number;
  isCompleted?: boolean;
  isDivider?: boolean;
}

export interface HybridBracketGroup {
  label: string;
  count: number;
  level: 'quarter' | 'month' | 'week';
  qtrNum?: number;
  colorType?: 'quarter' | 'month' | 'week';
}

interface UseHybridRollupDataProps {
  startDate: string;
  endDate: string;
  selectedUnit: OutputUnit;
  selectedLineGroup?: string;
  linesToSum?: string[];
  enabled: boolean;
}

export const useHybridRollupData = ({
  startDate,
  endDate,
  selectedUnit,
  selectedLineGroup,
  linesToSum,
  enabled,
}: UseHybridRollupDataProps) => {
  const [rawData, setRawData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !startDate || !endDate) return;

    let isMounted = true;
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE_URL}/productivity/period-summary?startDate=${startDate}&endDate=${endDate}`
        );
        if (!res.ok) throw new Error('Failed to fetch period summaries for hybrid view');
        const rows = await res.json();
        if (isMounted) {
          setRawData(rows);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Error fetching hybrid rollup data');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [enabled, startDate, endDate]);

  const { hybridChartData, hybridBrackets } = useMemo(() => {
    if (!enabled || rawData.length === 0) {
      return { hybridChartData: [], hybridBrackets: [] };
    }

    // Filter by selected line(s)
    const targetLines = new Set<string>();
    if (linesToSum && linesToSum.length > 0) {
      linesToSum.forEach(l => targetLines.add(normalizeMatrixLineGroupName(l).toUpperCase()));
    } else if (selectedLineGroup) {
      targetLines.add(normalizeMatrixLineGroupName(selectedLineGroup).toUpperCase());
    }

    if (targetLines.size === 0) {
      targetLines.add("MACRO PCN");
    }

    // Filter relevant rows (exact match on target line group(s) or known aliases)
    const matchingRows = rawData.filter(r => {
      const normLine = normalizeMatrixLineGroupName(r.line_group).toUpperCase();
      if (targetLines.has(normLine)) return true;
      if (targetLines.has("QA SMT") && normLine === "MQA") return true;
      if (targetLines.has("MQA") && normLine === "QA SMT") return true;
      return false;
    });

    // Helper to sum rows for a period
    const aggregateRows = (rows: any[]) => {
      let totOutput = 0;
      let totMH = 0;
      let totPlan = 0;
      let totTarget = 0;

      rows.forEach(r => {
        const mh = Number(r.total_man_hour || 0);
        totMH += mh;

        if (selectedUnit === 'sht') {
          totOutput += Number(r.sht_output || 0);
          totPlan += Number(r.sht_plan || 0);
          totTarget += Number(r.sht_prod_target || 0);
        } else if (selectedUnit === 'lot') {
          totOutput += Number(r.lot_output || 0);
        } else {
          totOutput += Number(r.piece_output || 0);
          totPlan += Number(r.piece_plan || 0);
          totTarget += Number(r.piece_prod_target || 0);
        }
      });

      const prod = totMH > 0 ? totOutput / totMH : 0;
      const firstRow = rows[0] || {};
      const accProd = selectedUnit === 'sht'
        ? Number(firstRow.sht_sum_productivity || 0)
        : selectedUnit === 'lot'
        ? Number((firstRow as any).lot_sum_productivity || 0)
        : Number(firstRow.sum_productivity || 0);

      const effectiveAcc = rows.length > 1
        ? (prod > 0 ? Number(prod.toFixed(2)) : null)
        : (accProd > 0 ? Number(accProd.toFixed(2)) : (prod > 0 ? Number(prod.toFixed(2)) : null));

      return {
        output: totOutput,
        plan: totPlan,
        manHours: totMH,
        productivity: Number(prod.toFixed(2)),
        target: totTarget > 0 ? Number(totTarget.toFixed(2)) : null,
        accProd: effectiveAcc,
      };
    };

    // Group rows by period_type and period_key
    const monthlyGroups = new Map<string, any[]>();
    const weeklyGroups = new Map<string, any[]>();
    const dailyGroups = new Map<string, any[]>();

    matchingRows.forEach(r => {
      const type = (r.period_type || '').toUpperCase();
      const key = r.period_key;
      if (type === 'MONTHLY') {
        if (!monthlyGroups.has(key)) monthlyGroups.set(key, []);
        monthlyGroups.get(key)!.push(r);
      } else if (type === 'WEEKLY') {
        if (!weeklyGroups.has(key)) weeklyGroups.set(key, []);
        weeklyGroups.get(key)!.push(r);
      } else if (type === 'DAILY') {
        if (!dailyGroups.has(key)) dailyGroups.set(key, []);
        dailyGroups.get(key)!.push(r);
      }
    });

    // Sort period keys
    const sortedMonthKeys = Array.from(monthlyGroups.keys()).sort();
    const sortedWeekKeys = Array.from(weeklyGroups.keys()).sort();
    const sortedDayKeys = Array.from(dailyGroups.keys()).sort();

    if (sortedMonthKeys.length === 0) {
      return { hybridChartData: [], hybridBrackets: [] };
    }

    // Identify active month (the latest month with data)
    const activeMonthKey = sortedMonthKeys[sortedMonthKeys.length - 1]; // e.g. '2026-08'
    const activeMonthLabel = dayjs(`${activeMonthKey}-01`).format('MMM YYYY');

    // 1. Completed Months (all months before active month, excluding incomplete past months with < 15 days of data)
    const completedMonthKeys = sortedMonthKeys.filter(k => {
      if (k >= activeMonthKey) return false;
      const daysInMonth = sortedDayKeys.filter(dKey => dKey.startsWith(k));
      if (daysInMonth.length > 0 && daysInMonth.length < 15) return false;
      if (k === '2026-01') return false;
      return true;
    });

    // 2. Weeks belonging to active month (derived from daily keys in active month or overlapping weekly summaries)
    const activeMonthDays = sortedDayKeys.filter(dKey => dKey.startsWith(activeMonthKey));
    const activeMonthWeekKeysSet = new Set<string>();
    activeMonthDays.forEach(dKey => {
      const d = dayjs(dKey);
      if (d.isValid()) {
        activeMonthWeekKeysSet.add(getProductionWeekKey(d));
      }
    });
    sortedWeekKeys.forEach(wKey => {
      const wRows = weeklyGroups.get(wKey) || [];
      const overlaps = wRows.some(r => (r.start_date || '').startsWith(activeMonthKey) || (r.end_date || '').startsWith(activeMonthKey));
      if (overlaps) activeMonthWeekKeysSet.add(wKey);
    });

    const activeMonthWeekKeys = Array.from(activeMonthWeekKeysSet).sort();

    // Active week is the latest week in active month
    const activeWeekKey = activeMonthWeekKeys[activeMonthWeekKeys.length - 1]; // e.g. '2026-W35'
    const activeWeekLabel = activeWeekKey ? `W${activeWeekKey.split('-W')[1]}` : '';

    // Completed weeks in active month (all weeks before active week)
    const completedWeekKeys = activeMonthWeekKeys.filter(k => k < activeWeekKey);

    // Helper to get rows for a week in active month (summing daily data strictly within activeMonthKey)
    const getWeekRows = (wKey: string) => {
      const weekDays = activeMonthDays.filter(dKey => {
        const d = dayjs(dKey);
        return getProductionWeekKey(d) === wKey;
      });
      const dayRows: any[] = [];
      weekDays.forEach(dKey => {
        const rowsForDay = dailyGroups.get(dKey) || [];
        dayRows.push(...rowsForDay);
      });
      if (dayRows.length > 0) return dayRows;
      return weeklyGroups.get(wKey) || [];
    };

    // 3. Days belonging to active week
    let activeWeekDayKeys: string[] = [];
    if (activeWeekKey) {
      activeWeekDayKeys = activeMonthDays.filter(dKey => {
        const d = dayjs(dKey);
        return getProductionWeekKey(d) === activeWeekKey;
      });
    }

    const items: HybridChartItem[] = [];

    // Add Completed Months
    completedMonthKeys.forEach(mKey => {
      const mRows = monthlyGroups.get(mKey) || [];
      const agg = aggregateRows(mRows);
      const mDate = dayjs(`${mKey}-01`);
      const qtrInfo = getFiscalQuarterInfo(mDate);

      items.push({
        key: mKey,
        rawDate: mKey,
        date: mDate.format('MMM YYYY'),
        level: 'month',
        isCompleted: true,
        output: agg.output,
        plan: agg.plan,
        manHours: agg.manHours,
        productivity: agg.productivity,
        target: agg.target,
        accProd: agg.accProd,
        fiscalQuarter: qtrInfo.key,
        qtrNum: qtrInfo.qtr,
        qtrYear: qtrInfo.fyYear,
      });
    });

    // Add In-Progress Weeks (in active month)
    completedWeekKeys.forEach(wKey => {
      const wRows = getWeekRows(wKey);
      const agg = aggregateRows(wRows);
      const wNum = wKey.split('-W')[1] || wKey;

      items.push({
        key: wKey,
        rawDate: wKey,
        date: `W${wNum}`,
        level: 'week',
        isCompleted: false,
        parentMonth: activeMonthLabel,
        output: agg.output,
        plan: agg.plan,
        manHours: agg.manHours,
        productivity: agg.productivity,
        target: agg.target,
        accProd: agg.accProd,
      });
    });

    // Add In-Progress Days (in active week)
    activeWeekDayKeys.forEach(dKey => {
      const dRows = dailyGroups.get(dKey) || [];
      const agg = aggregateRows(dRows);
      const dDate = dayjs(dKey);

      items.push({
        key: dKey,
        rawDate: dKey,
        date: dDate.format('DD MMM'),
        level: 'day',
        isCompleted: false,
        parentWeek: activeWeekLabel,
        parentMonth: activeMonthLabel,
        output: agg.output,
        plan: agg.plan,
        manHours: agg.manHours,
        productivity: agg.productivity,
        target: agg.target,
        accProd: agg.accProd,
      });
    });

    // Calculate true continuous rolling cumulative Acc Productivity, Output, and Plan across the hybrid timeline
    let runningOutput = 0;
    let runningPlan = 0;
    let runningMH = 0;
    items.forEach(item => {
      runningOutput += Number(item.output || 0);
      runningPlan += Number(item.plan || 0);
      runningMH += Number(item.manHours || 0);
      item.accProd = runningMH > 0 ? Number((runningOutput / runningMH).toFixed(2)) : (item.productivity || null);
      item.accOutput = runningOutput > 0 ? runningOutput : null;
      item.accPlan = runningPlan > 0 ? runningPlan : null;
    });

    // Construct Multi-tier Brackets:
    // Level 1: Fiscal Quarter brackets for Completed Months
    const brackets: HybridBracketGroup[] = [];

    // 1. Fiscal Quarter groups for 'month' items
    let curQtr = '';
    let curQtrCount = 0;
    let curQtrNum = 1;

    items.forEach(item => {
      if (item.level === 'month') {
        const qtrKey = `Q${item.qtrNum} ${item.qtrYear}`;
        if (qtrKey === curQtr) {
          curQtrCount++;
        } else {
          if (curQtr && curQtrCount > 0) {
            brackets.push({
              label: curQtr,
              count: curQtrCount,
              level: 'quarter',
              qtrNum: curQtrNum,
              colorType: 'quarter',
            });
          }
          curQtr = qtrKey;
          curQtrCount = 1;
          curQtrNum = item.qtrNum || 1;
        }
      }
    });
    if (curQtr && curQtrCount > 0) {
      brackets.push({
        label: curQtr,
        count: curQtrCount,
        level: 'quarter',
        qtrNum: curQtrNum,
        colorType: 'quarter',
      });
    }

    // 2. Month group for 'week' items
    const weekItemsCount = items.filter(i => i.level === 'week').length;
    if (weekItemsCount > 0) {
      brackets.push({
        label: `${activeMonthLabel} (Weekly)`,
        count: weekItemsCount,
        level: 'month',
        colorType: 'month',
      });
    }

    // 3. Week group for 'day' items
    const dayItemsCount = items.filter(i => i.level === 'day').length;
    if (dayItemsCount > 0) {
      brackets.push({
        label: `${activeWeekLabel} (Daily)`,
        count: dayItemsCount,
        level: 'week',
        colorType: 'week',
      });
    }

    return { hybridChartData: items, hybridBrackets: brackets };
  }, [enabled, rawData, selectedUnit, selectedLineGroup, linesToSum]);

  return {
    hybridChartData,
    hybridBrackets,
    isLoading,
    error,
  };
};
