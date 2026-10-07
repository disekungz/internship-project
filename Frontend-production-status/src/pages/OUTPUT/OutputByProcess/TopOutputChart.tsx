import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { getProcessColor } from "./processColors";

interface DataItem {
  process_name: string;
  output_qty: number;
  color?: string;
  mcline_count?: number;
}

interface TopOutputChartProps {
  data: DataItem[];
  unit?: string;
  selectedProcess?: string;
  onProcessSelect?: (processName: string) => void;
  backButtonNode?: React.ReactNode;
}

const ITEMS_PER_PAGE = 12;

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

const TopOutputChart: React.FC<TopOutputChartProps> = ({
  data,
  unit = "",
  selectedProcess = "",
  onProcessSelect,
  backButtonNode
}) => {
  const chartRef = useRef<any>(null);
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const searchQuery = selectedProcess || internalSearchQuery;

  const handleSetSearchQuery = (val: string) => {
    if (onProcessSelect) onProcessSelect(val);
    else setInternalSearchQuery(val);
  };

  const [legendPage, setLegendPage] = useState(0);

  // Autocomplete UI States
  const [localSearch, setLocalSearch] = useState("");
  const [tempSelectedProcesses, setTempSelectedProcesses] = useState<string[]>([]);
  const [confirmedProcesses, setConfirmedProcesses] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  const allProcessNames = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.map(d => d.process_name))).sort();
  }, [data]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setTempSelectedProcesses(confirmedProcesses);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [confirmedProcesses]);

  const getMatchingProcesses = () => {
    if (!localSearch) return allProcessNames;
    return allProcessNames.filter(name =>
      name.toLowerCase().includes(localSearch.toLowerCase())
    );
  };

  const matches = getMatchingProcesses();

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
    setShowSuggestions(false);
  };

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      handleSetSearchQuery(localSearch);
    }, 400);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [localSearch]);

  const unitLabel = useMemo(() => {
    if (!unit) return "";
    const u = unit.toLowerCase();
    if (u === "piece") return "pcs";
    if (u === "sheet") return "sheets";
    if (u === "lot") return "lots";
    return u;
  }, [unit]);

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const sortedData = [...data].sort((a, b) => b.output_qty - a.output_qty);

    if (selectedProcess) {
      const exactMatch = sortedData.find(item => item.process_name === selectedProcess);
      if (exactMatch) return [exactMatch];
    }

    if (confirmedProcesses.length > 0) {
      return sortedData.filter(item => confirmedProcesses.includes(item.process_name));
    }

    return sortedData;
  }, [data, selectedProcess, confirmedProcesses]);

  const dynamicBarSize = useMemo(() => {
    if (chartData.length === 1) return 80;
    if (chartData.length <= 5) return 60;
    if (chartData.length <= 15) return 40;
    return 32;
  }, [chartData.length]);

  const chartDataWithColors = useMemo(() => {
    return chartData.map((entry) => ({
      ...entry,
      color: entry.color || getProcessColor(entry.process_name)
    }));
  }, [chartData]);

  const totalPages = Math.ceil(chartDataWithColors.length / ITEMS_PER_PAGE);
  const safeLegendPage = Math.min(legendPage, Math.max(0, totalPages - 1));
  const currentLegendItems = chartDataWithColors.slice(
    safeLegendPage * ITEMS_PER_PAGE,
    (safeLegendPage + 1) * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setLegendPage(0);
  }, [chartDataWithColors.length]);

  const option = useMemo(() => {
    if (!chartDataWithColors || chartDataWithColors.length === 0) return {};

    const xCategories = chartDataWithColors.map(d => d.process_name);
    const maxVal = Math.max(...chartDataWithColors.map(d => d.output_qty), 10);

    return {
      backgroundColor: 'transparent',
      animationDuration: 300,
      grid: {
        top: 40,
        right: 20,
        bottom: 45,
        left: 20,
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
          shadowStyle: {
            color: 'rgba(148, 163, 184, 0.15)'
          }
        },
        confine: true,
        extraCssText: 'border-radius: 8px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2); padding: 0;',
        formatter: (params: any) => {
          if (!params || !params.length) return '';
          const idx = params[0].dataIndex;
          const entry = chartDataWithColors[idx];
          if (!entry) return '';

          return `
            <div style="font-family: inherit; font-size: 12px; background: #ffffff; color: #0f172a; border: 1px solid #e2e8f0; border-radius: 8px; width: 220px; box-sizing: border-box;">
              <div style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; font-weight: 700; color: #1e293b;">
                ${entry.process_name}
              </div>
              <div style="padding: 10px 12px; display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${entry.color}; flex-shrink: 0;"></span>
                    <span style="color: #64748b;">Output:</span>
                  </div>
                  <span style="font-family: monospace; font-weight: 700; color: #0f172a;">${entry.output_qty.toLocaleString()} ${unitLabel}</span>
                </div>
                ${entry.mcline_count !== undefined ? `
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="width: 8px; height: 8px; border-radius: 50%; background-color: #94a3b8; flex-shrink: 0;"></span>
                      <span style="color: #64748b;">MC Lines:</span>
                    </div>
                    <span style="font-family: monospace; font-weight: 700; color: #0f172a;">${entry.mcline_count.toLocaleString()}</span>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }
      },
      xAxis: {
        type: 'category',
        data: xCategories,
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisTick: { alignWithLabel: true, lineStyle: { color: '#cbd5e1' } },
        axisLabel: {
          fontSize: 11,
          color: '#64748b',
          interval: 0,
          rotate: chartDataWithColors.length > 10 ? 30 : 0,
          margin: 10
        }
      },
      yAxis: {
        type: 'value',
        name: `Output (${unit || 'Piece'})`,
        nameTextStyle: {
          color: '#64748b',
          fontSize: 11,
          fontWeight: 600,
          padding: [0, 0, 4, 0]
        },
        splitLine: {
          lineStyle: {
            type: 'dashed',
            color: '#f1f5f9'
          }
        },
        axisLabel: {
          fontSize: 10,
          color: '#64748b',
          formatter: (v: number) => {
            if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
            if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
            return String(v);
          }
        },
        max: getNiceMax(maxVal, 1.15)
      },
      dataZoom: chartDataWithColors.length > 20 ? [
        {
          type: 'slider',
          show: true,
          xAxisIndex: 0,
          start: 0,
          end: Math.min(100, (20 / chartDataWithColors.length) * 100),
          height: 18,
          bottom: 5,
          borderColor: 'transparent',
          fillerColor: 'rgba(59, 130, 246, 0.15)',
          handleStyle: { color: '#3b82f6' }
        },
        {
          type: 'inside',
          xAxisIndex: 0
        }
      ] : undefined,
      series: [
        {
          name: 'Output',
          type: 'bar',
          barMaxWidth: dynamicBarSize,
          data: chartDataWithColors.map(d => ({
            value: d.output_qty,
            itemStyle: {
              color: d.color,
              borderRadius: [4, 4, 0, 0]
            }
          })),
          label: {
            show: true,
            position: 'top',
            distance: 4,
            formatter: (params: any) => {
              const val = Number(params.value);
              if (!val || val <= 0) return '';
              if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
              if (val >= 100000) return Math.round(val / 1000) + 'K';
              if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
              return val.toLocaleString();
            },
            fontSize: 10,
            fontWeight: 700,
            color: '#475569'
          }
        }
      ]
    };
  }, [chartDataWithColors, dynamicBarSize, unit, unitLabel]);

  const onChartClick = useCallback((params: any) => {
    if (!params || !params.name) return;
    const proc = params.name;
    if (onProcessSelect) {
      onProcessSelect(selectedProcess === proc ? "" : proc);
    }
  }, [onProcessSelect, selectedProcess]);

  const onEvents = useMemo(() => ({
    click: onChartClick
  }), [onChartClick]);

  return (
    <div className="w-full max-w-full overflow-hidden flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto z-50">
          {backButtonNode}

          <div className="relative w-full sm:w-52" ref={suggestionRef}>
            <input
              type="text"
              placeholder="Search Process..."
              className="input input-sm input-bordered w-full pl-8 bg-base-100 shadow-none focus:outline-none focus:ring-0 focus:border-primary"
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                setShowSuggestions(true);
                setTempSelectedProcesses(confirmedProcesses);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowSuggestions(false);
              }}
            />
            <Search className="w-4 h-4 absolute left-2.5 top-2 text-base-content/50" />

            {showSuggestions && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 flex flex-col rounded-lg border border-base-300 bg-base-100 shadow-xl overflow-hidden">
                <div className="p-2 border-b border-base-200 flex justify-between items-center bg-base-200/30">
                  <div className="text-xs font-semibold text-base-content/70">
                    {tempSelectedProcesses.length} Selected
                  </div>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={selectAllMatches} className="text-[10px] btn btn-xs btn-ghost px-1.5 h-6 min-h-6">All</button>
                    <button type="button" onClick={clearAllMatches} className="text-[10px] btn btn-xs btn-ghost px-1.5 h-6 min-h-6 text-error">Clear</button>
                  </div>
                </div>
                <div className="overflow-y-auto max-h-60 p-1 scrollbar-thin">
                  {matches.length > 0 ? (
                    matches.map((name) => {
                      const tempSelectedSet = new Set(tempSelectedProcesses);
                      return (
                        <label key={name} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200 cursor-pointer rounded transition-colors">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-xs checkbox-primary !rounded-sm"
                            checked={tempSelectedSet.has(name)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTempSelectedProcesses(prev => [...prev, name]);
                              } else {
                                setTempSelectedProcesses(prev => prev.filter(p => p !== name));
                              }
                            }}
                          />
                          <span className="truncate text-base-content/85">{name}</span>
                        </label>
                      );
                    })
                  ) : (
                    <div className="p-3 text-center text-xs text-base-content/50">No matches found</div>
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
        </div>

        <div className="flex flex-1 items-center justify-end min-w-0 max-w-full">
          <div className="flex items-center justify-end gap-2 w-full max-w-[600px] overflow-hidden">
            <span className="text-xs font-semibold whitespace-nowrap text-base-content/70 shrink-0">
              Process:
            </span>

            {totalPages > 1 && (
              <button
                className="btn btn-xs btn-circle btn-ghost shrink-0"
                onClick={() => setLegendPage(Math.max(0, safeLegendPage - 1))}
                disabled={safeLegendPage === 0}
              >
                <ChevronLeft size={16} />
              </button>
            )}

            <div className="flex flex-nowrap overflow-hidden gap-x-3 py-1 flex-1 justify-center">
              {currentLegendItems.map((entry) => (
                <div
                  key={entry.process_name}
                  className="flex items-center gap-1.5 text-[10px] p-1 rounded shrink-0 whitespace-nowrap"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: entry.color }}
                  ></span>
                  <span className="text-base-content/80 font-medium">
                    {entry.process_name}
                  </span>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <button
                className="btn btn-xs btn-circle btn-ghost shrink-0"
                onClick={() => setLegendPage(Math.min(totalPages - 1, safeLegendPage + 1))}
                disabled={safeLegendPage === totalPages - 1}
              >
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="w-full h-[450px]">
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ width: '100%', height: '100%' }}
          onEvents={onEvents}
          notMerge={true}
          lazyUpdate={true}
        />
      </div>
    </div>
  );
};

export default TopOutputChart;
