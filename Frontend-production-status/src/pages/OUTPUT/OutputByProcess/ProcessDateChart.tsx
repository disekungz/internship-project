import React, { useMemo, useState, useEffect, useRef, useCallback, useDeferredValue } from "react";
import ReactECharts from "echarts-for-react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { getProcessColor } from "./processColors";

export interface DailyChartItem {
  date_label: string;
  raw_date: string;
  target_qty?: number;
  [processName: string]: any;
}

export interface MultiUnitChartData {
  pieceData: DailyChartItem[];
  sheetData: DailyChartItem[];
  lotData: DailyChartItem[];
}

interface ProcessDateChartProps {
  data: DailyChartItem[];
  unit?: string;
  setUnitMode?: (unit: "Piece" | "Sheet" | "Lot") => void;
  multiUnitData?: MultiUnitChartData;
  activeProcesses: string[];
  onBarClick?: (rawDate: string, processName: string) => void;
  selectedDate?: string | null;
  onProcessFilterChange?: (processes: string[]) => void;
}

const ITEMS_PER_PAGE = 25;

function getNiceMax(val: number, multiplier = 1.15): number {
  if (!val || val <= 0) return 10;
  const target = val * multiplier;
  const exp = Math.floor(Math.log10(target));
  const magnitude = Math.pow(10, exp);
  const fraction = target / magnitude;
  let niceFraction: number;
  if (fraction <= 1.2) niceFraction = 1.2;
  else if (fraction <= 1.5) niceFraction = 1.5;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 2.5) niceFraction = 2.5;
  else if (fraction <= 3) niceFraction = 3;
  else if (fraction <= 4) niceFraction = 4;
  else if (fraction <= 5) niceFraction = 5;
  else if (fraction <= 6) niceFraction = 6;
  else if (fraction <= 8) niceFraction = 8;
  else niceFraction = 10;
  return Math.ceil(niceFraction * magnitude);
}

interface ProcessChartBodyProps {
  data: DailyChartItem[];
  sortedProcesses: string[];
  dynamicBarSize: number;
  unit: string;
  unitLabel: string;
  selectedDate?: string | null;
  onBarClick?: (rawDate: string, processName: string) => void;
  filteredProcessTitle?: string;
}

const ProcessChartBody = React.memo(({
  data,
  sortedProcesses,
  dynamicBarSize,
  unit,
  unitLabel,
  selectedDate,
  onBarClick,
  filteredProcessTitle
}: ProcessChartBodyProps) => {
  const chartRef = useRef<any>(null);
  const hoveredSeriesRef = useRef<string | null>(null);

  useEffect(() => {
    (window as any).__echarts_highlightProcessSeries = (seriesName: string) => {
      chartRef.current?.getEchartsInstance()?.dispatchAction({
        type: 'highlight',
        seriesName: seriesName
      });
    };
    (window as any).__echarts_downplayProcessSeries = (seriesName: string) => {
      chartRef.current?.getEchartsInstance()?.dispatchAction({
        type: 'downplay',
        seriesName: seriesName
      });
    };
    return () => {
      delete (window as any).__echarts_highlightProcessSeries;
      delete (window as any).__echarts_downplayProcessSeries;
    };
  }, []);

  const option = useMemo(() => {
    if (!data || data.length === 0) return {};

    const isWeekly = data.some(d =>
      d.granularity === 'weekly' ||
      (typeof d.raw_date === 'string' && (d.raw_date.includes('WK') || /^(?:WK|W)\d{4}/.test(d.raw_date)))
    );

    const xCategories = data.map(d => {
      if (d.raw_date && /^\d{4}-\d{2}-\d{2}$/.test(d.raw_date)) {
        const [yyyy, mm, dd] = d.raw_date.split('-');
        return `${dd}/${mm}/${yyyy}`;
      }
      if (d.date_label) return d.date_label;
      if (d.raw_date && d.raw_date.includes('WK')) {
        const [y, wk] = d.raw_date.split('-');
        const yy = y.slice(-2);
        const wNum = wk.replace(/^[A-Za-z]+/, '');
        return `WK${yy}${wNum}`;
      }
      return d.raw_date;
    });

    // Compute cumulative accumulated output per date
    let cumulativeSum = 0;
    const accumData: number[] = [];
    data.forEach(d => {
      const dayTotal = sortedProcesses.reduce((acc, p) => acc + (Number(d[p]) || 0), 0);
      cumulativeSum += dayTotal;
      accumData.push(cumulativeSum);
    });

    const seriesList: any[] = [];

    sortedProcesses.forEach(proc => {
      const color = getProcessColor(proc);
      seriesList.push({
        name: proc,
        type: 'bar',
        stack: 'output',
        barMaxWidth: dynamicBarSize,
        itemStyle: {
          color: (params: any) => {
            const rawDate = data[params.dataIndex]?.raw_date;
            if (selectedDate && rawDate !== selectedDate) {
              return color + '48';
            }
            return color;
          }
        },
        emphasis: {
          disabled: true
        },
        data: data.map(d => Number(d[proc]) || 0)
      });
    });

    const maxDaily = Math.max(...data.map(d =>
      sortedProcesses.reduce((sum, p) => sum + (Number(d[p]) || 0), 0)
    ), 10);
    const maxAccum = Math.max(...accumData, 10);
    const niceMaxDaily = getNiceMax(maxDaily, 1.30);
    const niceMaxAccum = getNiceMax(maxAccum, 1.25);

    // Top Total Label on top of stack
    seriesList.push({
      name: 'Total_Label',
      type: 'bar',
      stack: 'output',
      barMaxWidth: dynamicBarSize,
      itemStyle: {
        color: 'transparent',
        borderColor: 'transparent'
      },
      emphasis: {
        disabled: true
      },
      labelLayout: {
        hideOverlap: true
      },
      label: {
        show: true,
        position: 'top',
        distance: 6,
        rotate: 90,
        align: 'left',
        verticalAlign: 'middle',
        formatter: (params: any) => {
          const entry = data[params.dataIndex];
          if (!entry) return '';
          const sum = sortedProcesses.reduce((acc, p) => acc + (Number(entry[p]) || 0), 0);
          if (!sum || sum <= 0) return '';
          if (sum >= 1000000) return (sum / 1000000).toFixed(1) + 'M';
          if (sum >= 100000) return Math.round(sum / 1000) + 'K';
          if (sum >= 1000) {
            const k = sum / 1000;
            return (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'K';
          }
          return sum.toLocaleString();
        },
        fontSize: 10,
        fontWeight: 500,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: '#0f172a'
      },
      data: data.map(() => 0),
      tooltip: { show: false }
    });

    const lastIdx = data.length - 1;

    const accumSeriesData = accumData.map((val, idx) => {
      const isEndPoint = idx === lastIdx;

      return {
        value: val,
        label: {
          show: val > 0 && isEndPoint,
          position: 'top',
          distance: 14,
          offset: [22, -4],
          formatter: (params: any) => {
            const v = Number(params.value);
            if (!v || v <= 0) return '';
            return v.toLocaleString();
          },
          fontSize: 10,
          fontWeight: 700,
          color: '#047857',
          backgroundColor: '#ffffff',
          borderColor: '#047857',
          borderWidth: 1.2,
          borderRadius: 4,
          padding: [2.5, 6],
          shadowColor: 'rgba(0, 0, 0, 0.08)',
          shadowBlur: 3
        }
      };
    });

    // Accumulated Line (on Right Y-Axis)
    seriesList.push({
      name: 'Acc Output',
      type: 'line',
      yAxisIndex: 1,
      smooth: 0.2,
      symbol: 'circle',
      symbolSize: 6.5,
      showSymbol: true,
      labelLine: {
        show: true,
        showAbove: true,
        length2: 8,
        lineStyle: {
          color: '#94a3b8',
          width: 1.2
        }
      },
      emphasis: {
        disabled: true
      },
      itemStyle: {
        color: '#047857',
        borderColor: '#ffffff',
        borderWidth: 1.5
      },
      lineStyle: {
        color: '#047857',
        width: 2.8,
        shadowColor: 'rgba(4, 120, 87, 0.25)',
        shadowBlur: 5
      },
      data: accumSeriesData,
      z: 15
    });


    return {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 250,
      animationDurationUpdate: 0,
      animationEasing: 'cubicOut',
      grid: {
        top: 60,
        right: 15,
        bottom: 70,
        left: 15,
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        transitionDuration: 0,
        axisPointer: {
          type: 'shadow',
          animation: false,
          shadowStyle: {
            color: 'rgba(148, 163, 184, 0.15)'
          }
        },
        enterable: true,
        confine: true,
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        borderRadius: 8,
        padding: [10, 12],
        textStyle: { color: '#1e293b', fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif' },
        extraCssText: 'box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1); max-width: 300px; pointer-events: auto;',
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return '';
          const dataIndex = params[0].dataIndex;
          const entry = data[dataIndex];
          if (!entry) return '';

          const rawDate = entry.raw_date;
          let formattedDate = entry.tooltip_title || `Date: ${entry.date_label}`;
          if (!entry.tooltip_title && rawDate && rawDate.includes('-') && !rawDate.includes('W')) {
            const [year, month, day] = rawDate.split('-');
            if (year && month && day) formattedDate = `Date: ${day}/${month}/${year}`;
          }

          const activeItems = params
            .filter((p: any) => p.seriesName !== 'Total' && p.seriesName !== 'Total_Label' && p.seriesName !== 'Acc Output' && p.seriesName !== 'Accumulated' && Number(p.value) > 0)
            .slice()
            .reverse();

          const total = activeItems.reduce((sum: number, p: any) => sum + Number(p.value || 0), 0);
          const accumItem = params.find((p: any) => p.seriesName === 'Acc Output' || p.seriesName === 'Accumulated');
          const currentAccum = accumItem ? Number(accumItem.value || 0) : 0;
          const currentHovered = hoveredSeriesRef.current;
          const hoveredItem = activeItems.find((item: any) => item.seriesName === currentHovered) || activeItems[0];
          const hoveredColor = hoveredItem ? getProcessColor(hoveredItem.seriesName) : null;
          const hoveredPct = hoveredItem && total > 0 ? ((Number(hoveredItem.value) / total) * 100).toFixed(1) : null;

          let html = `<div style="font-family: inherit; font-size: 12px; color: #1e293b;">`;
          html += `<div style="font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; display: flex; justify-content: space-between;">`;
          html += `<span>${formattedDate}</span>`;
          html += `</div>`;

          // Process title badge
          html += `<div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">`;
          html += `<span style="font-weight: 600; font-size: 10px; text-transform: uppercase; background: #e0f2fe; color: #0284c7; padding: 2px 6px; border-radius: 4px;">${filteredProcessTitle || "All Processes"}</span>`;
          html += `</div>`;

          // Pinned Active Hovered Process Banner
          if (hoveredItem && hoveredColor) {
            html += `<div style="background-color: ${hoveredColor}18; border: 1px solid ${hoveredColor}50; border-left: 4px solid ${hoveredColor}; padding: 4px 8px; border-radius: 5px; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">`;
            html += `<div style="display: flex; align-items: center; gap: 6px; min-width: 0;">`;
            html += `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${hoveredColor}; flex-shrink: 0; box-shadow: 0 0 5px ${hoveredColor};"></span>`;
            html += `<span style="color: #0f172a; font-size: 11px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${hoveredItem.seriesName}</span>`;
            if (hoveredPct) {
              html += `<span style="font-size: 9px; color: #64748b; font-weight: 600; flex-shrink: 0;">(${hoveredPct}%)</span>`;
            }
            html += `</div>`;
            html += `<span style="font-family: monospace; font-size: 11px; font-weight: 800; color: ${hoveredColor}; flex-shrink: 0; margin-left: 8px;">${Number(hoveredItem.value).toLocaleString()} ${unitLabel}</span>`;
            html += `</div>`;
          }

          // Active processes list (top-to-bottom)
          html += `<div style="max-height: 150px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; padding-right: 4px;">`;
          activeItems.forEach((item: any) => {
            const color = getProcessColor(item.seriesName);

            html += `<div 
              onmouseenter="window.__echarts_highlightProcessSeries && window.__echarts_highlightProcessSeries('${item.seriesName.replace(/'/g, "\\'")}')"
              onmouseleave="window.__echarts_downplayProcessSeries && window.__echarts_downplayProcessSeries('${item.seriesName.replace(/'/g, "\\'")}')"
              style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 2px 6px; border-radius: 4px; cursor: pointer; transition: background-color 0.15s ease;"
              onmouseover="this.style.backgroundColor='rgba(148, 163, 184, 0.12)';"
              onmouseout="this.style.backgroundColor='transparent';"
            >`;
            
            html += `<div style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">`;
            html += `<span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background-color: ${color}; flex-shrink: 0;"></span>`;
            html += `<span style="color: #475569; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.seriesName}:</span>`;
            html += `</div>`;

            html += `<span style="font-family: monospace; font-size: 11px; font-weight: 700; color: #0f172a; flex-shrink: 0;">${Number(item.value).toLocaleString()} ${unitLabel}</span>`;
            html += `</div>`;
          });
          html += `</div>`;

          // Total & Accum Summary
          html += `<div style="border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 6px; display: flex; flex-direction: column; gap: 3px;">`;
          
          html += `<div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 11px;">`;
          html += `<span style="color: #475569;">Daily Total:</span>`;
          html += `<span style="font-family: monospace; color: #0284c7;">${total.toLocaleString()} ${unitLabel}</span>`;
          html += `</div>`;

          html += `<div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 11px;">`;
          html += `<div style="display: flex; align-items: center; gap: 5px; color: #047857;">`;
          html += `<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #047857;"></span>`;
          html += `<span>Acc Output:</span>`;
          html += `</div>`;
          html += `<span style="font-family: monospace; color: #047857;">${currentAccum.toLocaleString()} ${unitLabel}</span>`;
          html += `</div>`;
          html += `</div>`;

          html += `</div>`;
          return html;
        }
      },
      xAxis: {
        type: 'category',
        name: isWeekly ? 'Week' : 'Date',
        nameLocation: 'middle',
        nameGap: isWeekly ? 45 : 58,
        nameTextStyle: {
          color: '#64748b',
          fontSize: 11,
          fontWeight: 600
        },
        data: xCategories,
        axisLine: {
          lineStyle: { color: '#cbd5e1' }
        },
        axisTick: {
          show: true,
          alignWithLabel: true,
          length: 5,
          lineStyle: { color: '#94a3b8', width: 1.2 }
        },
        splitLine: {
          show: true,
          lineStyle: {
            type: 'dashed',
            color: '#e2e8f0'
          }
        },
        axisLabel: {
          interval: 0,
          rotate: xCategories.length > 7 ? 45 : 0,
          fontSize: 10,
          color: '#64748b',
          margin: 10
        }
      },
      yAxis: [
        {
          type: 'value',
          min: 0,
          max: (value: any) => getNiceMax(value.max, 1.15),
          axisLine: {
            show: true,
            lineStyle: { color: '#cbd5e1' }
          },
          axisTick: {
            show: true,
            length: 5,
            lineStyle: { color: '#94a3b8', width: 1.2 }
          },
          axisLabel: {
            fontSize: 11,
            color: '#64748b',
            formatter: (val: number) => {
              if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
              if (val >= 1000) return Math.round(val / 1000) + 'K';
              return val.toString();
            }
          },
          splitLine: {
            lineStyle: {
              type: 'dashed',
              color: '#e2e8f0'
            }
          },
          name: `Output Quantity (${unit})`,
          nameLocation: 'end',
          nameGap: 12,
          nameTextStyle: {
            align: 'left',
            padding: [0, 0, 4, -10],
            fontSize: 11,
            fontWeight: 600,
            color: '#475569'
          }
        },
        {
          type: 'value',
          min: 0,
          max: (value: any) => getNiceMax(value.max, 1.12),
          position: 'right',
          axisLabel: {
            fontSize: 11,
            color: '#047857',
            formatter: (val: number) => {
              if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
              if (val >= 1000) return Math.round(val / 1000) + 'K';
              return val.toString();
            }
          },
          splitLine: { show: false },
          axisLine: {
            show: true,
            lineStyle: { color: '#cbd5e1' }
          },
          axisTick: {
            show: true,
            length: 5,
            lineStyle: { color: '#94a3b8', width: 1.2 }
          },
          name: `Accumulated (${unit})`,
          nameLocation: 'end',
          nameGap: 12,
          nameTextStyle: {
            align: 'right',
            padding: [0, -10, 4, 0],
            fontSize: 11,
            fontWeight: 600,
            color: '#047857'
          }
        }
      ],
      series: seriesList
    };
  }, [data, sortedProcesses, dynamicBarSize, unit, unitLabel, filteredProcessTitle, selectedDate]);

  const onEvents = useMemo(() => ({
    click: (params: any) => {
      if (onBarClick && params && params.dataIndex !== undefined) {
        const entry = data[params.dataIndex];
        if (entry && entry.raw_date) {
          onBarClick(entry.raw_date, params.seriesName);
        }
      }
    },
    mouseover: (params: any) => {
      if (params.componentType === 'series' && params.seriesName && params.seriesName !== 'Total_Label' && params.seriesName !== 'Total' && params.seriesName !== 'Accumulated') {
        hoveredSeriesRef.current = params.seriesName;
      }
    },
    globalout: () => {
      hoveredSeriesRef.current = null;
    }
  }), [onBarClick, data]);

  return (
    <div className="w-full h-[450px]">
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height: '100%', width: '100%' }}
        onEvents={onEvents}
        notMerge={true}
        lazyUpdate={false}
      />
    </div>
  );
});

const ProcessCheckboxItem = React.memo(({ name, checked, onToggle }: {
  name: string;
  checked: boolean;
  onToggle: (name: string) => void;
}) => {
  return (
    <div
      onClick={() => onToggle(name)}
      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-base-200 cursor-pointer rounded-md text-xs transition-colors group select-none"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => {}}
        className="checkbox checkbox-xs checkbox-primary !rounded-sm pointer-events-none"
      />
      <span className={`truncate text-xs ${checked ? "font-bold text-base-content" : "font-medium text-base-content/80"}`} title={name}>
        {name}
      </span>
    </div>
  );
});

const ProcessDateChart: React.FC<ProcessDateChartProps> = ({
  data,
  unit = "Piece",
  setUnitMode,
  multiUnitData,
  activeProcesses,
  onBarClick,
  selectedDate,
  onProcessFilterChange
}) => {
  const [activeUnitTab, setActiveUnitTab] = useState<"ALL" | "Piece" | "Sheet" | "Lot">("ALL");

  const handleUnitTabClick = useCallback((tab: "ALL" | "Piece" | "Sheet" | "Lot") => {
    setActiveUnitTab(tab);
    if (tab === "ALL") {
      setUnitMode?.("Piece");
    } else {
      setUnitMode?.(tab);
    }
  }, [setUnitMode]);

  useEffect(() => {
    if (unit && (unit === "Piece" || unit === "Sheet" || unit === "Lot")) {
      if (activeUnitTab !== "ALL" && activeUnitTab !== unit) {
        setActiveUnitTab(unit);
      }
    }
  }, [unit, activeUnitTab]);
  const [legendPage, setLegendPage] = useState<number>(0);
  const [localSearch, setLocalSearch] = useState<string>("");
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  const deferredSearch = useDeferredValue(localSearch);

  // Confirmed processes drive the actual chart rendering
  const [confirmedProcesses, setConfirmedProcesses] = useState<string[]>(activeProcesses);
  // Temporary selection inside the dropdown until user clicks "Confirm"
  const [tempSelectedProcesses, setTempSelectedProcesses] = useState<string[]>(activeProcesses);

  useEffect(() => {
    setConfirmedProcesses(activeProcesses);
    setTempSelectedProcesses(activeProcesses);
    setLocalSearch("");
  }, [activeProcesses]);

  const matches = useMemo(() => {
    if (!deferredSearch.trim()) return activeProcesses;
    const q = deferredSearch.toLowerCase();
    return activeProcesses.filter(p => p.toLowerCase().includes(q));
  }, [activeProcesses, deferredSearch]);

  const visibleMatches = useMemo(() => matches.slice(0, 100), [matches]);
  const hiddenCount = Math.max(0, matches.length - 100);

  const tempSelectedSet = useMemo(() => new Set(tempSelectedProcesses), [tempSelectedProcesses]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleProcess = useCallback((proc: string) => {
    setTempSelectedProcesses(prev =>
      prev.includes(proc) ? prev.filter(p => p !== proc) : [...prev, proc]
    );
  }, []);

  const selectAllMatches = () => {
    setTempSelectedProcesses(prev => {
      const newSelected = new Set(prev);
      matches.forEach(m => newSelected.add(m));
      return Array.from(newSelected);
    });
  };

  const clearAllMatches = () => {
    setTempSelectedProcesses([]);
  };

  const handleConfirm = () => {
    setConfirmedProcesses(tempSelectedProcesses);
    onProcessFilterChange?.(tempSelectedProcesses);
    setShowSuggestions(false);
    setLegendPage(0);
    if (tempSelectedProcesses.length === 1) {
      setLocalSearch(tempSelectedProcesses[0]);
    } else if (tempSelectedProcesses.length === activeProcesses.length) {
      setLocalSearch("");
    }
  };

  const handleSelectOnly = (name: string) => {
    setTempSelectedProcesses([name]);
    setConfirmedProcesses([name]);
    onProcessFilterChange?.([name]);
    setLocalSearch(name);
    setShowSuggestions(false);
    setLegendPage(0);
  };

  const { sortedProcesses, legendItems } = useMemo(() => {
    const procs = [...confirmedProcesses];
    const sorted = procs.sort((a, b) => a.localeCompare(b));
    const items = sorted.map(proc => ({
      value: proc,
      color: getProcessColor(proc)
    }));
    return { sortedProcesses: sorted, legendItems: items };
  }, [confirmedProcesses]);

  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.map(item => {
      let newTotal = 0;
      sortedProcesses.forEach(proc => {
        if (item[proc]) newTotal += item[proc];
      });
      return { ...item, total: newTotal, target_qty: item.target_qty };
    });
  }, [data, sortedProcesses]);

  // Multi-unit prepared data
  const multiUnitPreparedData = useMemo(() => {
    if (!multiUnitData) return undefined;
    const filterUnitData = (unitRows: DailyChartItem[]) => {
      return unitRows.map(item => {
        let newTotal = 0;
        sortedProcesses.forEach(proc => {
          if (item[proc]) newTotal += item[proc];
        });
        return { ...item, total: newTotal, target_qty: item.target_qty };
      });
    };

    return {
      pieceData: filterUnitData(multiUnitData.pieceData),
      sheetData: filterUnitData(multiUnitData.sheetData),
      lotData: filterUnitData(multiUnitData.lotData)
    };
  }, [multiUnitData, sortedProcesses]);

  useEffect(() => {
    setLegendPage(0);
  }, [legendItems.length]);

  const totalPages = Math.ceil(legendItems.length / ITEMS_PER_PAGE);
  const safeLegendPage = Math.min(legendPage, Math.max(0, totalPages - 1));
  const currentLegendItems = useMemo(() => {
    return legendItems.slice(
      safeLegendPage * ITEMS_PER_PAGE,
      (safeLegendPage + 1) * ITEMS_PER_PAGE
    );
  }, [legendItems, safeLegendPage]);


  const isProcessFiltered = confirmedProcesses.length > 0 && confirmedProcesses.length < activeProcesses.length;
  const filteredProcessTitle = isProcessFiltered
    ? (confirmedProcesses.length === 1 ? confirmedProcesses[0] : `${confirmedProcesses.length} Processes`)
    : "All Processes";

  const dynamicBarSize = useMemo(() => {
    if (!filteredData) return 32;
    if (filteredData.length === 1) return 80;
    if (filteredData.length <= 7) return 50;
    if (filteredData.length <= 15) return 36;
    return 26;
  }, [filteredData]);

  const unitLabel = unit.toLowerCase() === "piece" ? "pcs" : unit.toLowerCase() === "sheet" ? "sheets" : "lots";

  return (
    <div className="flex flex-col gap-3">
      {/* Top Toolbar: Search + Legend + Unit Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-base-200">
        <div className="flex flex-wrap items-center gap-3">
          {/* Autocomplete Search for Process */}
          <div className="relative w-full sm:w-52" ref={suggestionRef}>
            <input
              type="text"
              placeholder="Search Process..."
              className="input input-sm input-bordered w-full pl-8 pr-7 bg-base-100 shadow-none focus:outline-none focus:ring-0 focus:border-primary"
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowSuggestions(false);
                }
                if (e.key === "Enter") {
                  const q = localSearch.trim().toLowerCase();
                  if (q) {
                    const exactMatch = matches.find(m => m.toLowerCase() === q);
                    const selected = exactMatch ? [exactMatch] : (matches.length > 0 ? matches : activeProcesses);
                    setTempSelectedProcesses(selected);
                    setConfirmedProcesses(selected);
                    onProcessFilterChange?.(selected);
                    if (selected.length === 1) {
                      setLocalSearch(selected[0]);
                    }
                  }
                  setShowSuggestions(false);
                }
              }}
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/40 w-3.5 h-3.5 pointer-events-none" />
            {localSearch && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch("");
                  setTempSelectedProcesses(activeProcesses);
                  setConfirmedProcesses(activeProcesses);
                  onProcessFilterChange?.(activeProcesses);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content text-xs p-0.5"
                title="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Dropdown Suggestions */}
            {showSuggestions && (
              <div className="absolute left-0 right-0 z-50 mt-1 w-full bg-base-100 border border-base-300 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="p-2 border-b border-base-200 bg-base-200/50 flex items-center justify-between">
                  <span className="text-xs font-bold text-base-content/70">
                    Processes ({tempSelectedProcesses.length}/{activeProcesses.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllMatches}
                      className="text-[11px] text-primary hover:underline font-semibold"
                    >
                      All
                    </button>
                    <span className="text-base-300">|</span>
                    <button
                      type="button"
                      onClick={clearAllMatches}
                      className="text-[11px] text-base-content/50 hover:underline font-semibold"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="overflow-y-auto max-h-60 p-1 scrollbar-thin">
                  {visibleMatches.length > 0 ? visibleMatches.map((name) => (
                    <ProcessCheckboxItem
                      key={name}
                      name={name}
                      checked={tempSelectedSet.has(name)}
                      onToggle={toggleProcess}
                    />
                  )) : (
                    <div className="p-3 text-center text-xs text-base-content/50">No matches</div>
                  )}
                  {hiddenCount > 0 && (
                    <div className="px-3 py-2 text-center text-[10px] text-base-content/40 italic border-t border-base-200 mt-1">
                      Type to search all {matches.length} processes...
                    </div>
                  )}
                </div>
                <div className="p-2 border-t border-base-200 bg-base-100">
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="btn btn-primary btn-sm w-full h-8 min-h-8 text-xs font-bold"
                  >
                    Confirm Filter
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Unit Toggle Tabs */}
          {multiUnitData && (
            <div className="join border border-base-300 bg-base-100 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => handleUnitTabClick("ALL")}
                className={`join-item btn btn-xs font-bold ${activeUnitTab === "ALL" ? "bg-slate-900 text-white shadow-xs" : "btn-ghost text-base-content/70 hover:text-base-content"}`}
              >
                All Units
              </button>
              <button
                type="button"
                onClick={() => handleUnitTabClick("Piece")}
                className={`join-item btn btn-xs font-bold ${activeUnitTab === "Piece" ? "bg-slate-900 text-white shadow-xs" : "btn-ghost text-base-content/70 hover:text-base-content"}`}
              >
                Piece
              </button>
              <button
                type="button"
                onClick={() => handleUnitTabClick("Sheet")}
                className={`join-item btn btn-xs font-bold ${activeUnitTab === "Sheet" ? "bg-slate-900 text-white shadow-xs" : "btn-ghost text-base-content/70 hover:text-base-content"}`}
              >
                Sheet
              </button>
              <button
                type="button"
                onClick={() => handleUnitTabClick("Lot")}
                className={`join-item btn btn-xs font-bold ${activeUnitTab === "Lot" ? "bg-slate-900 text-white shadow-xs" : "btn-ghost text-base-content/70 hover:text-base-content"}`}
              >
                Lot
              </button>
            </div>
          )}
        </div>

        {/* Legend / Process Selector (exact OutputByProduct design) */}
        <div className="flex flex-1 items-center justify-end min-w-0 max-w-full gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-bold shrink-0">
            <span className="w-2.5 h-0.5 bg-[#047857] inline-block"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#047857] inline-block -ml-1.5"></span>
            <span>Acc Output</span>
          </div>

          <div className="flex items-center justify-end gap-2 max-w-[500px] overflow-hidden">
            <span className="text-xs font-semibold whitespace-nowrap text-base-content/70 shrink-0">
              Process:
            </span>

            {totalPages > 1 && (
              <button
                type="button"
                className="btn btn-xs btn-circle btn-ghost shrink-0"
                onClick={() => setLegendPage(Math.max(0, safeLegendPage - 1))}
                disabled={safeLegendPage === 0}
                title="Previous Legend Page"
              >
                <ChevronLeft size={16} />
              </button>
            )}

            <div className="flex flex-nowrap overflow-hidden gap-x-3 py-1 flex-1 justify-center">
              {currentLegendItems.map((entry) => (
                <div
                  key={entry.value}
                  className="flex items-center gap-1.5 text-[10px] p-1 rounded shrink-0 whitespace-nowrap"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: entry.color }}
                  ></span>
                  <span className="text-base-content/80 font-medium">
                    {entry.value}
                  </span>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <button
                type="button"
                className="btn btn-xs btn-circle btn-ghost shrink-0"
                onClick={() => setLegendPage(Math.min(totalPages - 1, safeLegendPage + 1))}
                disabled={safeLegendPage === totalPages - 1}
                title="Next Legend Page"
              >
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Unit Charts or Single Unit Chart */}
      {multiUnitPreparedData ? (
        <div className="flex flex-col gap-4 w-full mt-2">
          {(activeUnitTab === "ALL" || activeUnitTab === "Piece") && (
            <div className="bg-base-100 rounded-xl border border-base-300/80 shadow-sm p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between px-1 pb-1 border-b border-base-200/60">
                <span className="text-xs font-bold text-base-content/90 flex items-center gap-2">
                  <span className="badge badge-sm bg-slate-900 text-white font-bold border-none">Piece</span>
                  Output Chart (Piece) — {filteredProcessTitle}
                </span>
                <span className="text-[11px] text-base-content/50 font-medium">Unit: Piece</span>
              </div>
              <ProcessChartBody
                data={multiUnitPreparedData.pieceData}
                sortedProcesses={sortedProcesses}
                dynamicBarSize={dynamicBarSize}
                unit="Piece"
                unitLabel="pcs"
                selectedDate={selectedDate}
                onBarClick={onBarClick}
                filteredProcessTitle={filteredProcessTitle}
              />
            </div>
          )}

          {(activeUnitTab === "ALL" || activeUnitTab === "Sheet") && (
            <div className="bg-base-100 rounded-xl border border-base-300/80 shadow-sm p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between px-1 pb-1 border-b border-base-200/60">
                <span className="text-xs font-bold text-base-content/90 flex items-center gap-2">
                  <span className="badge badge-sm bg-slate-900 text-white font-bold border-none">Sheet</span>
                  Output Chart (Sheet) — {filteredProcessTitle}
                </span>
                <span className="text-[11px] text-base-content/50 font-medium">Unit: Sheet</span>
              </div>
              <ProcessChartBody
                data={multiUnitPreparedData.sheetData}
                sortedProcesses={sortedProcesses}
                dynamicBarSize={dynamicBarSize}
                unit="Sheet"
                unitLabel="sheets"
                selectedDate={selectedDate}
                onBarClick={onBarClick}
                filteredProcessTitle={filteredProcessTitle}
              />
            </div>
          )}

          {(activeUnitTab === "ALL" || activeUnitTab === "Lot") && (
            <div className="bg-base-100 rounded-xl border border-base-300/80 shadow-sm p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between px-1 pb-1 border-b border-base-200/60">
                <span className="text-xs font-bold text-base-content/90 flex items-center gap-2">
                  <span className="badge badge-sm bg-slate-900 text-white font-bold border-none">Lot</span>
                  Output Chart (Lot) — {filteredProcessTitle}
                </span>
                <span className="text-[11px] text-base-content/50 font-medium">Unit: Lot</span>
              </div>
              <ProcessChartBody
                data={multiUnitPreparedData.lotData}
                sortedProcesses={sortedProcesses}
                dynamicBarSize={dynamicBarSize}
                unit="Lot"
                unitLabel="lots"
                selectedDate={selectedDate}
                onBarClick={onBarClick}
                filteredProcessTitle={filteredProcessTitle}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="bg-base-100 rounded-xl border border-base-300/80 shadow-sm p-4 flex flex-col gap-2">
          <ProcessChartBody
            data={filteredData}
            sortedProcesses={sortedProcesses}
            dynamicBarSize={dynamicBarSize}
            unit={unit}
            unitLabel={unitLabel}
            selectedDate={selectedDate}
            onBarClick={onBarClick}
            filteredProcessTitle={filteredProcessTitle}
          />
        </div>
      )}
    </div>
  );
};

export default ProcessDateChart;
