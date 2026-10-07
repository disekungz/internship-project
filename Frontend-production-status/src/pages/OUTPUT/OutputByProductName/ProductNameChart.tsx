import React, { useMemo, useCallback, useDeferredValue, useRef, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

interface DailyChartItem {
  date_label: string;
  raw_date: string;
  [processName: string]: any;
}

export interface MultiUnitChartData {
  pieceData: DailyChartItem[];
  sheetData: DailyChartItem[];
  lotData: DailyChartItem[];
}

interface ProductNameChartProps {
  data: DailyChartItem[];
  unit?: string;
  setUnitMode?: (unit: "Piece" | "Sheet" | "Lot") => void;
  multiUnitData?: MultiUnitChartData;
  activeProcesses: string[];
  filterProcess: string[];
  setFilterProcess: (process: string[]) => void;
  processList: string[];
  productSearchQuery: string;
  setProductSearchQuery: (query: string) => void;
  allProductNames?: string[];
  activeProductName?: string;
  activeProductType?: string;
  onBarClick?: (rawDate: string, processName: string) => void;
  selectedDate?: string | null;
  filterCustomerGroup?: string[];
  setFilterCustomerGroup?: (cg: string[]) => void;
  customerGroupList?: string[];
}

const CHART_COLORS = [
  "#2b5c8f", // Corporate Blue
  "#0d9488", // Deep Teal
  "#4f46e5", // Indigo
  "#0891b2", // Muted Cyan
  "#15803d", // Forest Green
  "#b91c1c", // Brick Red
  "#c2410c", // Rust Orange
  "#7c3aed", // Violet
  "#b45309", // Amber Gold
  "#a21caf", // Deep Fuchsia
  "#0284c7", // Sky Blue
  "#059669", // Emerald Green
  "#be123c", // Crimson Red
  "#475569", // Steel Grey
  "#6d28d9", // Dark Violet
  "#701a75", // Plum Purple
  "#ca8a04", // Ochre Yellow
  "#854d0e", // Bronze
  "#78350f", // Chocolate Brown
  "#881337", // Muted Burgundy
  "#1e3a8a", // Navy Blue
  "#064e3b", // Pine Green
  "#4c1d95", // Royal Purple
  "#115e59", // Dark Teal
  "#be185d", // Dusty Pink
  "#a16207", // Brass Gold
  "#4d7c0f", // Muted Sage
  "#1d4ed8", // Denim Blue
  "#5f9ea0", // Cadet Blue
  "#008b8b", // Dark Cyan
  "#cd5c5c", // Indian Red
  "#b8860b", // Dark Goldenrod
  "#a0522d", // Sienna Brown
  "#3cb371", // Medium Sea Green
  "#9932cc", // Dark Orchid
  "#4682b4", // Steel Blue
  "#6a5acd", // Slate Blue
  "#334155", // Charcoal
  "#1e293b", // Dark Slate
  "#6366f1"  // Slate Indigo
];

export const getProcessColor = (processName: string) => {
  if (processName === "Others" || processName === "Others (อื่นๆ)") return "#94a3b8";
  
  // Consistent hash algorithm to generate a stable color index for any process name
  let hash = 0;
  for (let i = 0; i < processName.length; i++) {
    hash = processName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash);
  return CHART_COLORS[idx % CHART_COLORS.length];
};

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

// Chart isolated in its own memo — does NOT re-render when localSearch/localProcess changes
interface ProductChartBodyProps {
  data: DailyChartItem[];
  sortedProcesses: string[];
  dynamicBarSize: number;
  unit: string;
  unitLabel: string;
  activeProductName?: string;
  activeProductType?: string;
  selectedDate?: string | null;
  onBarClick?: (rawDate: string, processName: string) => void;
  onProductClick: (name: string) => void;
}

const ProductChartBody = React.memo(({
  data,
  sortedProcesses,
  dynamicBarSize,
  unit,
  unitLabel,
  activeProductName,
  activeProductType,
  selectedDate,
  onBarClick,
  onProductClick,
}: ProductChartBodyProps) => {
  const chartRef = useRef<any>(null);
  const hoveredSeriesRef = useRef<string | null>(null);

  useEffect(() => {
    (window as any).__echarts_onProductClick = (p: string) => {
      if (onProductClick) onProductClick(p);
    };
    (window as any).__echarts_highlightSeries = (seriesName: string) => {
      chartRef.current?.getEchartsInstance()?.dispatchAction({
        type: 'highlight',
        seriesName: seriesName
      });
    };
    (window as any).__echarts_downplaySeries = (seriesName: string) => {
      chartRef.current?.getEchartsInstance()?.dispatchAction({
        type: 'downplay',
        seriesName: seriesName
      });
    };
    return () => {
      delete (window as any).__echarts_onProductClick;
      delete (window as any).__echarts_highlightSeries;
      delete (window as any).__echarts_downplaySeries;
    };
  }, [onProductClick]);

  const option = useMemo(() => {
    if (!data || data.length === 0) return {};

    const xCategories = data.map(d => d.date_label);

    // Compute cumulative accumulated output per date
    let cumulativeSum = 0;
    const accumData: number[] = [];
    data.forEach(d => {
      const dayTotal = sortedProcesses.reduce((acc, p) => acc + (Number(d[p]) || 0), 0);
      cumulativeSum += dayTotal;
      accumData.push(cumulativeSum);
    });

    const seriesList: any[] = sortedProcesses.map(proc => {
      const color = getProcessColor(proc);
      return {
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
      };
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
          if (sum >= 1000) return (sum / 1000).toFixed(1) + 'K';
          return sum.toLocaleString();
        },
        fontSize: 9.5,
        fontWeight: 700,
        color: '#334155',
        textBorderColor: '#ffffff',
        textBorderWidth: 2
      },
      data: data.map(() => 0),
      tooltip: { show: false }
    });

    // Smart collision avoidance for accumulated line labels
    const accumSeriesData = accumData.map((val, idx) => {
      const dayEntry = data[idx];
      const daySum = dayEntry ? sortedProcesses.reduce((acc, p) => acc + (Number(dayEntry[p]) || 0), 0) : 0;

      const barYRatio = daySum / niceMaxDaily;
      const lineYRatio = val / niceMaxAccum;
      const diff = lineYRatio - barYRatio; // positive = line is above bar, negative = line is below bar

      // If line is below or near bar top, position label at bottom to avoid overlapping with top bar label
      const position = diff < 0.08 ? 'bottom' : 'top';
      const distance = Math.abs(diff) < 0.12 ? 8 : 5;

      return {
        value: val,
        label: {
          show: true,
          position: position,
          distance: distance,
          formatter: (params: any) => {
            const v = Number(params.value);
            if (!v || v <= 0) return '';
            if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
            if (v >= 100000) return Math.round(v / 1000) + 'K';
            if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
            return v.toLocaleString();
          },
          fontSize: 9.5,
          fontWeight: 700,
          color: '#007a37',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderColor: '#86efac',
          borderWidth: 1,
          borderRadius: 3,
          padding: [1, 3.5],
          shadowColor: 'rgba(0, 0, 0, 0.06)',
          shadowBlur: 2
        }
      };
    });

    // Accumulated Line (on Right Y-Axis with visible collision-free labels)
    seriesList.push({
      name: 'Accumulated',
      type: 'line',
      yAxisIndex: 1,
      smooth: 0.2,
      symbol: 'circle',
      symbolSize: 6,
      showSymbol: true,
      emphasis: {
        disabled: true
      },
      itemStyle: {
        color: '#00b050',
        borderColor: '#ffffff',
        borderWidth: 1.5
      },
      lineStyle: {
        color: '#00b050',
        width: 2.5,
        shadowColor: 'rgba(0, 176, 80, 0.25)',
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
        top: 42,
        right: 15,
        bottom: xCategories.length > 10 ? 48 : 30,
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

          // Active items sorted top-to-bottom to match visual bar stack
          const activeItems = params
            .filter((p: any) => p.seriesName !== 'Total' && p.seriesName !== 'Total_Label' && p.seriesName !== 'Accumulated' && Number(p.value) > 0)
            .slice()
            .reverse();

          const total = activeItems.reduce((sum: number, p: any) => sum + Number(p.value || 0), 0);
          const accumItem = params.find((p: any) => p.seriesName === 'Accumulated');
          const currentAccum = accumItem ? Number(accumItem.value || 0) : 0;
          const products: string[] = entry.products || [];
          const currentHovered = hoveredSeriesRef.current;
          const hoveredItem = activeItems.find((item: any) => item.seriesName === currentHovered) || activeItems[0];
          const hoveredColor = hoveredItem ? getProcessColor(hoveredItem.seriesName) : null;
          const hoveredPct = hoveredItem && total > 0 ? ((Number(hoveredItem.value) / total) * 100).toFixed(1) : null;

          let html = `<div style="font-family: inherit; font-size: 12px; color: #1e293b;">`;
          html += `<div style="font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; display: flex; justify-content: space-between;">`;
          html += `<span>${formattedDate}</span>`;
          html += `</div>`;

          // Product badge
          html += `<div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">`;
          html += `<span style="font-weight: 600; font-size: 10px; text-transform: uppercase; background: #e0f2fe; color: #0284c7; padding: 2px 6px; border-radius: 4px;">${activeProductName || "All Products"}</span>`;
          if (activeProductName !== "All Products" && activeProductType) {
            const isSmt = activeProductType === 'SMT';
            html += `<span style="font-weight: 700; font-size: 10px; text-transform: uppercase; background: ${isSmt ? '#ffe4e6' : '#e0f2fe'}; color: ${isSmt ? '#e11d48' : '#0284c7'}; border: 1px solid ${isSmt ? '#fecdd3' : '#bae6fd'}; padding: 2px 6px; border-radius: 4px;">${activeProductType}</span>`;
          }
          html += `</div>`;

          // Pinned Active Hovered Process Banner (Always visible at top, 0 jitter)
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

          // Active processes list (top-to-bottom) - stable, scrollable
          html += `<div style="max-height: 150px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; padding-right: 4px;">`;
          activeItems.forEach((item: any) => {
            const color = getProcessColor(item.seriesName);

            html += `<div 
              onmouseenter="window.__echarts_highlightSeries && window.__echarts_highlightSeries('${item.seriesName}')"
              onmouseleave="window.__echarts_downplaySeries && window.__echarts_downplaySeries('${item.seriesName}')"
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

          // Products list
          if (activeProductName === "All Products" && products.length > 0) {
            html += `<div style="border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 6px;">`;
            html += `<span style="font-weight: 700; display: block; margin-bottom: 4px; font-size: 10px; color: #334155;">Products (${products.length}):</span>`;
            html += `<div style="display: flex; flex-wrap: wrap; gap: 4px; max-height: 70px; overflow-y: auto; padding-right: 4px;">`;
            [...products].sort((a, b) => a.localeCompare(b)).forEach(p => {
              html += `<span onclick="window.__echarts_onProductClick && window.__echarts_onProductClick('${p}')" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #334155; padding: 2px 5px; border-radius: 4px; font-size: 9px; font-weight: 500; cursor: pointer; white-space: nowrap;">${p}</span>`;
            });
            html += `</div>`;
            html += `</div>`;
          }

          // Total & Accum Summary
          html += `<div style="border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 6px; display: flex; flex-direction: column; gap: 3px;">`;
          html += `<div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 11px;">`;
          html += `<span style="color: #475569;">Daily Total:</span>`;
          html += `<span style="font-family: monospace; color: #0284c7;">${total.toLocaleString()} ${unitLabel}</span>`;
          html += `</div>`;
          html += `<div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 11px;">`;
          html += `<div style="display: flex; align-items: center; gap: 5px; color: #00b050;">`;
          html += `<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #00b050;"></span>`;
          html += `<span>Accumulated:</span>`;
          html += `</div>`;
          html += `<span style="font-family: monospace; color: #00b050;">${currentAccum.toLocaleString()} ${unitLabel}</span>`;
          html += `</div>`;
          html += `</div>`;

          html += `</div>`;
          return html;
        }
      },
      xAxis: {
        type: 'category',
        data: xCategories,
        axisLine: {
          lineStyle: { color: '#cbd5e1' }
        },
        axisTick: {
          alignWithLabel: true,
          lineStyle: { color: '#cbd5e1' }
        },
        axisLabel: {
          interval: 0,
          rotate: xCategories.length > 10 ? 40 : 0,
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
            color: '#00b050',
            formatter: (val: number) => {
              if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
              if (val >= 1000) return Math.round(val / 1000) + 'K';
              return val.toString();
            }
          },
          splitLine: { show: false },
          axisLine: {
            show: true,
            lineStyle: { color: '#00b050' }
          },
          axisTick: {
            lineStyle: { color: '#00b050' }
          },
          name: `Accumulated (${unit})`,
          nameLocation: 'end',
          nameGap: 12,
          nameTextStyle: {
            align: 'right',
            padding: [0, -10, 4, 0],
            fontSize: 11,
            fontWeight: 600,
            color: '#00b050'
          }
        }
      ],
      series: seriesList
    };
  }, [data, sortedProcesses, dynamicBarSize, unit, unitLabel, activeProductName, activeProductType, selectedDate]);

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

const SearchableDropdown = ({ value, onChange, options, placeholder }: { value: string, onChange: (val: string) => void, options: string[], placeholder: string }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    return options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
  }, [search, options]);

  return (
    <div className="relative w-full sm:w-44 shrink-0" ref={dropdownRef}>
      <div 
        className="select select-sm select-bordered w-full bg-base-100 flex items-center cursor-pointer text-xs font-medium focus:outline-none focus:border-primary pr-8"
        onClick={() => { setIsOpen(!isOpen); setSearch(""); }}
      >
        <span className="truncate">{value || placeholder}</span>
      </div>
      
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-base-300 bg-base-100 shadow-lg flex flex-col">
          <div className="p-2 border-b border-base-200">
            <input 
              type="text" 
              className="input input-xs input-bordered w-full focus:outline-none focus:ring-0 focus:border-primary" 
              placeholder="Search..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-60 overflow-y-auto scrollbar-thin">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div 
                  key={opt} 
                  className={`px-3 py-2 text-xs cursor-pointer hover:bg-base-200 ${value === opt ? "bg-primary/10 text-primary font-medium" : "text-base-content/85"}`}
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                  }}
                >
                  {opt}
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-base-content/50 italic">No options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const MultiSelectDropdown = ({ value, onChange, options, placeholder }: { value: string[], onChange: (val: string[]) => void, options: string[], placeholder: string }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [tempValue, setTempValue] = React.useState<string[]>(value);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setTempValue(value);
  }, [value]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    return options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
  }, [search, options]);

  const toggleOption = (opt: string) => {
    if (tempValue.includes(opt)) {
      setTempValue(tempValue.filter(item => item !== opt));
    } else {
      setTempValue([...tempValue, opt]);
    }
  };

  const selectAll = () => {
    const allMatching = filteredOptions;
    const newSet = new Set(tempValue);
    allMatching.forEach(opt => newSet.add(opt));
    setTempValue(Array.from(newSet));
  };

  const clearAll = () => {
    setTempValue([]);
  };

  const handleConfirm = () => {
    onChange(tempValue);
    setIsOpen(false);
  };

  const displayText = value.length === 0 ? placeholder : value.length === 1 ? value[0] : `${value.length} selected`;

  return (
    <div className="relative w-full sm:w-44 shrink-0 z-[100]" ref={dropdownRef}>
      <div 
        className="select select-sm select-bordered w-full bg-base-100 flex items-center cursor-pointer text-xs font-medium focus:outline-none focus:border-primary pr-8"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{displayText}</span>
      </div>
      
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-[100] flex flex-col rounded-lg border border-base-300 bg-base-100 shadow-xl overflow-hidden">
          <div className="p-2 border-b border-base-200">
            <input 
              type="text" 
              placeholder="Search Process..." 
              className="input input-sm input-bordered w-full bg-base-100 shadow-none focus:outline-none focus:ring-0 focus:border-primary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          <div className="p-2 border-b border-base-200 flex justify-between items-center bg-base-200/30">
            <div className="text-xs font-semibold text-base-content/70">
              {tempValue.length} Selected
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={(e) => { e.stopPropagation(); selectAll(); }} className="text-[10px] btn btn-xs btn-ghost px-1.5 h-6 min-h-6">All</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); clearAll(); }} className="text-[10px] btn btn-xs btn-ghost px-1.5 h-6 min-h-6 text-error">Clear</button>
            </div>
          </div>
          
          <div className="overflow-y-auto max-h-60 p-1 scrollbar-thin">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const checked = tempValue.includes(opt);
                return (
                  <label key={opt} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200 cursor-pointer rounded transition-colors">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs checkbox-primary rounded-sm"
                      checked={checked}
                      onChange={() => toggleOption(opt)}
                    />
                    <span className="truncate">{opt}</span>
                  </label>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-base-content/50">No matches</div>
            )}
          </div>
          
          <div className="p-2 border-t border-base-200 bg-base-100">
            <button 
              type="button" 
              onClick={(e) => { e.stopPropagation(); handleConfirm(); }}
              className="btn btn-primary btn-sm w-full h-8 min-h-8 text-xs font-bold"
            >
              Confirm Filter
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ProductNameChart: React.FC<ProductNameChartProps> = ({ 
  data, 
  unit = "", 
  setUnitMode,
  multiUnitData,
  activeProcesses,
  filterProcess,
  setFilterProcess,
  processList,
  productSearchQuery,
  setProductSearchQuery,
  allProductNames = [],
  activeProductName = "All Products",
  activeProductType,
  onBarClick,
  selectedDate = null,
  filterCustomerGroup,
  setFilterCustomerGroup,
  customerGroupList = []
}) => {
  const [localSearch, setLocalSearch] = React.useState(productSearchQuery);
  const [legendPage, setLegendPage] = React.useState(0);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [activeUnitTab, setActiveUnitTab] = React.useState<"ALL" | "Piece" | "Sheet" | "Lot">("ALL");
  const suggestionRef = React.useRef<HTMLDivElement>(null);
  const deferredSearch = useDeferredValue(localSearch);

  const ITEMS_PER_PAGE = 12;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setProductSearchQuery(deferredSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [deferredSearch]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const matches = React.useMemo(() => {
    if (!allProductNames || allProductNames.length === 0) return [];
    if (!deferredSearch) {
      return [...allProductNames].sort((a, b) => a.localeCompare(b));
    }
    const qLower = deferredSearch.toLowerCase();
    return allProductNames
      .filter(name => name.toLowerCase().includes(qLower))
      .sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        const aStarts = aLower.startsWith(qLower);
        const bStarts = bLower.startsWith(qLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      });
  }, [allProductNames, deferredSearch]);

  // Stable callback so ProductChartBody memo doesn't re-render when localSearch changes
  const handleProductClick = useCallback((p: string) => setLocalSearch(p), []);

  // Sort processes alphabetically and build legend items in a single block to ensure correct initialization order
  const { sortedProcesses, legendItems } = useMemo(() => {
    const sorted = [...activeProcesses].sort((a, b) => a.localeCompare(b));
    const items = sorted.map(proc => ({
      value: proc,
      color: getProcessColor(proc)
    }));
    return { sortedProcesses: sorted, legendItems: items };
  }, [activeProcesses]);

  React.useEffect(() => {
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

  const unitLabel = useMemo(() => {
    if (!unit) return "";
    const u = unit.toLowerCase();
    if (u === "piece") return "pcs";
    if (u === "sheet") return "sheets";
    if (u === "lot") return "lots";
    return u;
  }, [unit]);

  const dynamicBarSize = React.useMemo(() => {
    if (!data) return 32;
    if (data.length === 1) return 100;
    if (data.length <= 7) return 60;
    if (data.length <= 15) return 40;
    return 32;
  }, [data]);

  return (
    <div className="w-full max-w-full overflow-hidden flex flex-col gap-4">
      {/* Shared Master Controls (Search, Filters, Unit Switch, Legend) */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Search Box */}
          <div className="relative w-full sm:w-64" ref={suggestionRef}>
            <input 
              type="text" 
              placeholder="Search Product..."
              className="input input-sm input-bordered w-full pl-8 pr-7 bg-base-100 shadow-none focus:outline-none focus:ring-0 focus:border-primary"
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowSuggestions(false);
              }}
            />
            <Search className="w-4 h-4 absolute left-2.5 top-2 text-base-content/50" />
            
            {localSearch && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch("");
                  setProductSearchQuery("");
                  setShowSuggestions(false);
                }}
                className="absolute right-2.5 top-2 text-base-content/40 hover:text-base-content text-xs font-bold leading-none cursor-pointer"
                title="Clear search"
              >
                ✕
              </button>
            )}

            {showSuggestions && matches.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-60 overflow-y-auto rounded-lg border border-base-300 bg-base-100 py-1 shadow-lg scrollbar-thin">
                {matches.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="w-full text-left px-3.5 py-2 text-xs hover:bg-base-200 cursor-pointer flex items-center justify-between text-base-content/85 transition-colors font-medium border-b border-base-100 last:border-b-0"
                    onClick={() => {
                      setLocalSearch(name);
                      setProductSearchQuery(name);
                      setShowSuggestions(false);
                    }}
                  >
                    <span className="truncate">{name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Process Dropdown (Multi-Select) */}
          <MultiSelectDropdown 
            value={filterProcess}
            onChange={(val) => setFilterProcess(val)}
            options={processList}
            placeholder="Select process..."
          />
          
          {/* Customer Group Dropdown (Multi-Select) */}
          {setFilterCustomerGroup && (
            <MultiSelectDropdown 
              value={filterCustomerGroup || []}
              onChange={(val) => setFilterCustomerGroup(val)}
              options={customerGroupList}
              placeholder="All Customers"
            />
          )}

          {/* Unit Dropdown inside the Chart Controls (when viewing All Products) */}
          {activeProductName === "All Products" && setUnitMode && (
            <div className="flex items-center gap-1.5 border-l border-base-300 pl-2 sm:pl-3">
              <span className="text-xs font-semibold text-base-content/70 whitespace-nowrap">Output Unit:</span>
              <select
                className="select select-sm select-bordered bg-base-100 text-xs font-medium focus:outline-none focus:border-primary"
                value={unit}
                onChange={(e) => setUnitMode(e.target.value as "Piece" | "Sheet" | "Lot")}
              >
                <option value="Piece">Piece</option>
                <option value="Sheet">Sheet</option>
                <option value="Lot">Lot</option>
              </select>
            </div>
          )}

          {/* Unit Toggle Tabs when viewing a specific product */}
          {activeProductName !== "All Products" && multiUnitData && (
            <div className="join border border-base-300 rounded-lg p-0.5 bg-base-200/50 shadow-xs">
              <button 
                type="button" 
                onClick={() => setActiveUnitTab("ALL")}
                className={`join-item btn btn-xs font-bold ${activeUnitTab === "ALL" ? "btn-primary shadow-xs" : "btn-ghost text-base-content/70 hover:text-base-content"}`}
              >
                All Units
              </button>
              <button 
                type="button" 
                onClick={() => setActiveUnitTab("Piece")}
                className={`join-item btn btn-xs font-bold ${activeUnitTab === "Piece" ? "btn-primary shadow-xs" : "btn-ghost text-base-content/70 hover:text-base-content"}`}
              >
                Piece
              </button>
              <button 
                type="button" 
                onClick={() => setActiveUnitTab("Sheet")}
                className={`join-item btn btn-xs font-bold ${activeUnitTab === "Sheet" ? "btn-primary shadow-xs" : "btn-ghost text-base-content/70 hover:text-base-content"}`}
              >
                Sheet
              </button>
              <button 
                type="button" 
                onClick={() => setActiveUnitTab("Lot")}
                className={`join-item btn btn-xs font-bold ${activeUnitTab === "Lot" ? "btn-primary shadow-xs" : "btn-ghost text-base-content/70 hover:text-base-content"}`}
              >
                Lot
              </button>
            </div>
          )}
        </div>

        {/* Legend / Process Selector */}
        <div className="flex flex-1 items-center justify-end min-w-0 max-w-full gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0">
            <span className="w-2.5 h-0.5 bg-[#00b050] inline-block"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#00b050] inline-block -ml-1.5"></span>
            <span>Accumulated</span>
          </div>

          <div className="flex items-center justify-end gap-2 max-w-[500px] overflow-hidden">
            <span className="text-xs font-semibold whitespace-nowrap text-base-content/70 shrink-0">
              Process:
            </span>
            
            {totalPages > 1 && (
              <button 
                className="btn btn-xs btn-circle btn-ghost shrink-0" 
                onClick={() => setLegendPage(Math.max(0, safeLegendPage - 1))}
                disabled={safeLegendPage === 0}
                title="Previous Legend Page"
              >
                <ChevronLeft size={16} />
              </button>
            )}

            <div className="flex flex-nowrap overflow-hidden gap-x-3 py-1 flex-1 justify-center">
              {currentLegendItems.map((entry) => {
                const isActive = filterProcess.length === 0 || filterProcess.includes(entry.value);
                return (
                  <div 
                    key={entry.value} 
                    className="flex items-center gap-1.5 text-[10px] cursor-pointer hover:bg-base-200 transition-colors p-1 rounded shrink-0 whitespace-nowrap"
                    onClick={() => {
                        if (filterProcess.includes(entry.value)) {
                            setFilterProcess(filterProcess.filter(p => p !== entry.value));
                        } else {
                            setFilterProcess([...filterProcess, entry.value]);
                        }
                    }}
                    style={{ opacity: isActive ? 1 : 0.4 }}
                    title={isActive ? "Click to isolate" : "Click to view"}
                  >
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: entry.color }}
                    ></span>
                    <span className={`text-base-content/80 font-medium ${isActive ? 'font-semibold' : ''}`}>
                      {entry.value}
                    </span>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <button 
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
      {activeProductName !== "All Products" && multiUnitData ? (
        <div className="flex flex-col gap-6 w-full mt-2">
          {(activeUnitTab === "ALL" || activeUnitTab === "Piece") && (
            <div className="flex flex-col gap-2 pt-2 border-t border-base-200">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-base-content/90 flex items-center gap-2">
                  <span className="badge badge-sm badge-primary font-bold">Piece</span>
                  Output Chart (Piece) — {activeProductName}
                </span>
                <span className="text-[11px] text-base-content/50 font-medium">Unit: Piece</span>
              </div>
              <ProductChartBody
                data={multiUnitData.pieceData}
                sortedProcesses={sortedProcesses}
                dynamicBarSize={dynamicBarSize}
                unit="Piece"
                unitLabel="pcs"
                activeProductName={activeProductName}
                activeProductType={activeProductType}
                selectedDate={selectedDate}
                onBarClick={onBarClick}
                onProductClick={handleProductClick}
              />
            </div>
          )}

          {(activeUnitTab === "ALL" || activeUnitTab === "Sheet") && (
            <div className="flex flex-col gap-2 pt-4 border-t border-base-200">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-base-content/90 flex items-center gap-2">
                  <span className="badge badge-sm badge-secondary font-bold">Sheet</span>
                  Output Chart (Sheet) — {activeProductName}
                </span>
                <span className="text-[11px] text-base-content/50 font-medium">Unit: Sheet</span>
              </div>
              <ProductChartBody
                data={multiUnitData.sheetData}
                sortedProcesses={sortedProcesses}
                dynamicBarSize={dynamicBarSize}
                unit="Sheet"
                unitLabel="sheets"
                activeProductName={activeProductName}
                activeProductType={activeProductType}
                selectedDate={selectedDate}
                onBarClick={onBarClick}
                onProductClick={handleProductClick}
              />
            </div>
          )}

          {(activeUnitTab === "ALL" || activeUnitTab === "Lot") && (
            <div className="flex flex-col gap-2 pt-4 border-t border-base-200">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-base-content/90 flex items-center gap-2">
                  <span className="badge badge-sm badge-accent font-bold">Lot</span>
                  Output Chart (Lot) — {activeProductName}
                </span>
                <span className="text-[11px] text-base-content/50 font-medium">Unit: Lot</span>
              </div>
              <ProductChartBody
                data={multiUnitData.lotData}
                sortedProcesses={sortedProcesses}
                dynamicBarSize={dynamicBarSize}
                unit="Lot"
                unitLabel="lots"
                activeProductName={activeProductName}
                activeProductType={activeProductType}
                selectedDate={selectedDate}
                onBarClick={onBarClick}
                onProductClick={handleProductClick}
              />
            </div>
          )}
        </div>
      ) : (
        <ProductChartBody
          data={data}
          sortedProcesses={sortedProcesses}
          dynamicBarSize={dynamicBarSize}
          unit={unit}
          unitLabel={unitLabel}
          activeProductName={activeProductName}
          activeProductType={activeProductType}
          selectedDate={selectedDate}
          onBarClick={onBarClick}
          onProductClick={handleProductClick}
        />
      )}
    </div>
  );
};

export default ProductNameChart;
