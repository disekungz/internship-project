/**
 * Component: ManHourChart
 * แสดงผลกราฟ ECharts สรุปข้อมูลกำลังคนและ Man-Hour
 * - กราฟแท่ง 3D Cylinder สำหรับ OP Register, Working, Leave, Hours
 * - รองรับการแยกสีตาม Line ผลิต และ Tooltip แสดงสถานะพนักงานเมื่อ Hover
 */
import { useEffect, useRef, useState, useMemo } from 'react';
import * as echarts from 'echarts';

// ชุดสีสำหรับการแสดงผลแยกไลน์ และวันหยุด
export const MULTI_LINE_WORKING_COLORS = ['#0ea5e9', '#14b8a6', '#22c55e', '#f59e0b', '#06b6d4', '#84cc16'];
const HOLIDAY_STACK_COLORS = ['#5b21b6', '#6d28d9', '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd'];

/**
 * สร้างสี Gradient เลียนแบบแท่งทรงกระบอก 3D แนวนอน
 */
function makeCylinderGradient(baseColor: string) {
  return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
    { offset: 0, color: baseColor },
    { offset: 0.45, color: echarts.color.lift(baseColor, 0.18) || baseColor },
    { offset: 1, color: echarts.color.lift(baseColor, -0.2) || baseColor },
  ]);
}

interface GraphOption {
  label: string;
  color: string;
  unit: string;
  chart: string;
}

interface StatusSummary {
  status: string;
  present: number;
  absent: number;
  count: number;
}

interface ManHourChartProps {
  graphChartWidth: number;
  displayedGraphData: any[];
  graphGroup: string;
  graphAxis: string;
  isSplitWorkingByLine: boolean;
  selectedGraphLines: string[];
  selectedGraphOption?: GraphOption;
  selectedStatuses: string[];
  manhourRecordsCount: number;
  loadTooltipStatusDay: (label: string | number) => void;
  getTooltipStatusSummary: (label: string | number) => StatusSummary[];
}

/**
 * ตัดทอนข้อความชื่อ Line ให้สั้นลงหากมีความยาวเกินไป
 */
const shortenGraphLineLabel = (value: unknown) => {
  const label = String(value || '');
  const parts = label.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length > 2) return `${parts.slice(0, 2).join(', ')}, …`;
  return label.length > 30 ? `${label.slice(0, 27).trimEnd()}…` : label;
};

export default function ManHourChart({
  graphChartWidth,
  displayedGraphData,
  graphGroup,
  graphAxis,
  isSplitWorkingByLine,
  selectedGraphLines,
  selectedGraphOption,
  selectedStatuses,
  manhourRecordsCount,
  loadTooltipStatusDay,
  getTooltipStatusSummary,
}: ManHourChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const [tooltipX, setTooltipX] = useState(72);
  const [isTooltipActive, setIsTooltipActive] = useState(false);
  const [activeDataIndex, setActiveDataIndex] = useState<number | null>(null);

  const tooltipLabelRef = useRef<string | null>(null);
  const tooltipHoveredRef = useRef(false);

  const hideTooltip = () => {
    tooltipHoveredRef.current = false;
    tooltipLabelRef.current = null;
    setIsTooltipActive(false);
    setActiveDataIndex(null);
  };

  const displayedDataRef = useRef(displayedGraphData);
  displayedDataRef.current = displayedGraphData;

  const loadTooltipStatusDayRef = useRef(loadTooltipStatusDay);
  loadTooltipStatusDayRef.current = loadTooltipStatusDay;

  // สร้างอินสแตนซ์ ECharts
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current, null, {
      renderer: 'canvas',
      devicePixelRatio: Math.max(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2),
    });
    chartInstance.current = chart;

    const updateTooltipPosition = (dataIndex: number, clientX?: number) => {
      const data = displayedDataRef.current;
      const point = data[dataIndex];
      if (!point) return;
      const nextLabel = String(point.label ?? '');
      setIsTooltipActive(true);
      setActiveDataIndex(dataIndex);
      loadTooltipStatusDayRef.current(nextLabel);

      if (tooltipLabelRef.current === nextLabel && clientX === undefined) return;
      tooltipLabelRef.current = nextLabel;

      let nextX = 0;
      if (clientX !== undefined && chartRef.current) {
        const rect = chartRef.current.getBoundingClientRect();
        nextX = clientX - rect.left;
      } else {
        const coord = chart.convertToPixel({ gridIndex: 0 }, [dataIndex, 0]);
        nextX = coord ? coord[0] : 100;
      }

      const tooltipWidth = 360;
      const gap = 14;
      const viewport = document.querySelector<HTMLElement>('.manhour-graph-scroll');
      const visibleLeft = viewport?.scrollLeft || 0;
      const visibleRight = visibleLeft + (viewport?.clientWidth || graphChartWidth);
      const fitsRight = nextX + gap + tooltipWidth <= visibleRight;
      const preferredX = fitsRight ? nextX + gap : nextX - tooltipWidth - gap;
      const maximumX = Math.max(visibleLeft + 8, visibleRight - tooltipWidth - 8);
      setTooltipX(Math.max(visibleLeft + 8, Math.min(preferredX, maximumX)));
    };

    chart.on('mousemove', (params: any) => {
      if (tooltipHoveredRef.current) return;
      if (typeof params.dataIndex === 'number' && params.dataIndex >= 0) {
        updateTooltipPosition(params.dataIndex, params.event?.event?.clientX);
      }
    });

    chart.getZr().on('mousemove', (event: any) => {
      if (tooltipHoveredRef.current) return;
      const pointInPixel = [event.offsetX, event.offsetY];
      if (chart.containPixel({ gridIndex: 0 }, pointInPixel)) {
        const pointInGrid = chart.convertFromPixel({ gridIndex: 0 }, pointInPixel);
        if (pointInGrid && typeof pointInGrid[0] === 'number') {
          const dataIndex = Math.round(pointInGrid[0]);
          if (dataIndex >= 0 && dataIndex < displayedDataRef.current.length) {
            updateTooltipPosition(dataIndex, event.event?.clientX);
          }
        }
      }
    });

    const handleResize = () => {
      chart.resize();
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartRef.current);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      chart.dispose();
      chartInstance.current = null;
    };
  }, [graphChartWidth]);

  // ประกอบออปชันการตั้งค่าของกราฟ
  const option = useMemo<echarts.EChartsOption>(() => {
    const labels = displayedGraphData.map(d => d.label);

    const isPersons = graphGroup === 'persons';
    const isLine = graphAxis === 'line';

    const series: echarts.SeriesOption[] = [];

    if (isPersons) {
      if (isSplitWorkingByLine) {
        selectedGraphLines.forEach((lineName, lineIndex) => {
          const colorNormal = MULTI_LINE_WORKING_COLORS[lineIndex % MULTI_LINE_WORKING_COLORS.length];
          const colorHoliday = HOLIDAY_STACK_COLORS[lineIndex % HOLIDAY_STACK_COLORS.length];

          series.push({
            name: lineName,
            type: 'bar',
            stack: 'persons',
            barMaxWidth: 60,
            data: displayedGraphData.map((point) => {
              const val = point[`workingLine${lineIndex}`] ?? 0;
              const displayVal = point[`workingLine${lineIndex}Display`] ?? val;
              const baseColor = point.isHoliday ? colorHoliday : colorNormal;
              return {
                value: displayVal,
                realVal: val,
                itemStyle: {
                  color: makeCylinderGradient(baseColor),
                },
              };
            }),
            label: {
              show: true,
              position: 'inside',
              formatter: (params: any) => {
                const realVal = params.data?.realVal ?? params.value;
                return Number(realVal) > 0 ? Number(realVal).toLocaleString() : '';
              },
              color: '#ffffff',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: 12,
              fontWeight: 700,
              textShadowColor: 'rgba(0, 0, 0, 0.75)',
              textShadowBlur: 4,
              textShadowOffsetX: 0,
              textShadowOffsetY: 1,
            },
          });
        });
      } else {
        series.push({
          name: 'Working',
          type: 'bar',
          stack: 'persons',
          barMaxWidth: 60,
          data: displayedGraphData.map((point) => {
            const val = point.working ?? 0;
            const displayVal = point.workingDisplay ?? val;
            const baseColor = point.isHoliday ? '#8b5cf6' : '#0ea5e9';
            return {
              value: displayVal,
              realVal: val,
              itemStyle: {
                color: makeCylinderGradient(baseColor),
              },
            };
          }),
          label: {
            show: true,
            position: 'inside',
            formatter: (params: any) => {
              const realVal = params.data?.realVal ?? params.value;
              return Number(realVal) > 0 ? Number(realVal).toLocaleString() : '';
            },
            color: '#ffffff',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: 12,
            fontWeight: 700,
            textShadowColor: 'rgba(0, 0, 0, 0.75)',
            textShadowBlur: 4,
            textShadowOffsetX: 0,
            textShadowOffsetY: 1,
          },
        });
      }

      // แท่งแสดงจำนวนคนลา (ซ้อนทับด้านบน)
      series.push({
        name: 'Leave',
        type: 'bar',
        stack: 'persons',
        barMaxWidth: 60,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
        },
        data: displayedGraphData.map((point) => {
          const val = point.leave ?? 0;
          const displayVal = point.leaveDisplay ?? val;
          const baseColor = point.isHoliday ? '#f97316' : '#f43f5e';
          return {
            value: displayVal,
            realVal: val,
            leaveRate: point.leaveRate,
            itemStyle: {
              color: makeCylinderGradient(baseColor),
            },
          };
        }),
        label: {
          show: true,
          position: 'inside',
          formatter: (params: any) => {
            const realVal = params.data?.realVal ?? params.value;
            return Number(realVal) > 0 ? Number(realVal).toLocaleString() : '';
          },
          color: '#ffffff',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: 11,
          fontWeight: 700,
          textShadowColor: 'rgba(0, 0, 0, 0.75)',
          textShadowBlur: 4,
          textShadowOffsetX: 0,
          textShadowOffsetY: 1,
        },
      });

      // ป้ายเปอร์เซ็นต์การลา (% Leave) ลอยอยู่เหนือแท่งกราฟ
      series.push({
        name: 'LeaveRateBadge',
        type: 'bar',
        stack: 'persons',
        data: displayedGraphData.map((point) => ({
          value: 0,
          leaveRate: point.leaveRate,
        })),
        label: {
          show: true,
          position: 'top',
          distance: 6,
          formatter: (params: any) => {
            const lr = Number(params.data?.leaveRate || 0);
            return lr > 0 ? `{badge|Leave ${lr.toFixed(1)}%}` : '';
          },
          rich: {
            badge: {
              backgroundColor: '#ffffff',
              borderColor: '#fecdd3',
              borderWidth: 1,
              borderRadius: 5,
              padding: [3, 6],
              color: '#be123c',
              fontSize: 10,
              fontWeight: 800,
              align: 'center',
            },
          },
        },
      });
    } else if (selectedGraphOption?.chart === 'line') {
      const color = selectedGraphOption.color || '#2563eb';
      series.push({
        name: selectedGraphOption.label || 'Value',
        type: 'line',
        smooth: true,
        data: displayedGraphData.map(point => point.value ?? 0),
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          color,
          width: 3,
        },
        itemStyle: {
          color,
        },
        areaStyle: {
          color,
          opacity: 0.14,
        },
        label: {
          show: true,
          position: 'top',
          distance: 8,
          formatter: (params: any) => {
            const val = Number(params.value);
            return Number.isFinite(val) && val > 0 ? val.toLocaleString() : '';
          },
          color: '#334155',
          fontSize: 10,
          fontWeight: 700,
        },
      });
    } else {
      const color = selectedGraphOption?.color || '#2563eb';
      series.push({
        name: selectedGraphOption?.label || 'Value',
        type: 'bar',
        barMaxWidth: 60,
        data: displayedGraphData.map(point => point.value ?? 0),
        itemStyle: {
          color,
          borderRadius: [6, 6, 0, 0],
        },
        label: {
          show: true,
          position: 'top',
          distance: 8,
          formatter: (params: any) => {
            const val = Number(params.value);
            return Number.isFinite(val) && val > 0 ? val.toLocaleString() : '';
          },
          color: '#334155',
          fontSize: 10,
          fontWeight: 700,
        },
      });
    }

    return {
      animation: false,
      grid: {
        top: isPersons ? 48 : 34,
        right: isLine ? 60 : 36,
        left: isLine ? 40 : 44,
        bottom: isLine ? 105 : 40,
        containLabel: false,
      },
      tooltip: {
        show: false, // ใช้ Tooltip ลอยแบบ Custom HTML สวยงาม
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: {
          lineStyle: { color: '#94a3b8' },
        },
        axisTick: { show: false },
        axisLabel: {
          formatter: (val: string) => isLine ? shortenGraphLineLabel(val) : val,
          color: '#94a3b8',
          fontSize: isLine ? 10 : 11,
          interval: 0,
          rotate: isLine ? -28 : 0,
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        axisLine: {
          show: true,
          lineStyle: { color: '#94a3b8' },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 11,
        },
      },
      series: series.map((s) => ({
        ...s,
        large: true,
        largeThreshold: 2000,
        sampling: 'lttb' as const,
      })),
    };
  }, [
    displayedGraphData,
    graphGroup,
    graphAxis,
    isSplitWorkingByLine,
    selectedGraphLines,
    selectedGraphOption,
  ]);

  // อัปเดต Option ของกราฟ
  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.setOption(option, true);
      chartInstance.current.resize();
    }
  }, [option, graphChartWidth]);

  // คำนวณข้อมูลสำหรับแสดงผลใน Tooltip
  const activePoint = activeDataIndex !== null ? displayedGraphData[activeDataIndex] : null;
  const activeLabel = activePoint?.label ?? '';

  const statusSummary = useMemo(() => {
    if (!activeLabel) return [];
    return getTooltipStatusSummary(activeLabel).map(item =>
      activePoint?.isHoliday
        ? { ...item, absent: 0, count: item.present }
        : item
    );
  }, [activeLabel, activePoint, getTooltipStatusSummary]);

  const statuses = useMemo(() => {
    if (statusSummary.length > 0 || selectedStatuses.length !== 1) {
      return statusSummary;
    }
    return [{
      status: selectedStatuses[0],
      present: Number(activePoint?.working || 0),
      absent: Number(activePoint?.leave || 0),
      count: Number(activePoint?.working || 0) + Number(activePoint?.leave || 0),
    }];
  }, [statusSummary, selectedStatuses, activePoint]);

  const heading = activePoint?.isHoliday ? `${activeLabel} (Holiday)` : activeLabel;

  return (
    <div
      className="relative h-[490px]"
      style={{ width: graphChartWidth }}
      onPointerLeave={hideTooltip}
    >
      <div
        ref={chartRef}
        style={{ width: graphChartWidth, height: 490 }}
      />

      {isTooltipActive && activePoint && (
        <div
          className="pointer-events-auto absolute z-50 flex max-h-[450px] w-[360px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100 p-3 text-xs shadow-xl transition-all duration-75 text-base-content"
          style={{
            left: tooltipX,
            top: 16,
          }}
          onPointerEnter={() => { tooltipHoveredRef.current = true; }}
          onPointerLeave={() => {
            tooltipHoveredRef.current = false;
            hideTooltip();
          }}
          onPointerMove={event => event.stopPropagation()}
          onMouseMove={event => event.stopPropagation()}
          onWheel={event => event.stopPropagation()}
        >
          <div className="mb-2 font-black text-base-content">{heading}</div>
          {graphGroup === 'persons' ? (
            <div className="mb-2 space-y-1">
              <div className="flex justify-between gap-4 text-sky-500 font-bold">
                <span>{selectedStatuses.length === 1 ? `${selectedStatuses[0]} Present` : 'Working'}</span>
                <span className="font-black">{Number(activePoint.working || 0).toLocaleString()} Persons</span>
              </div>
              <div className="flex justify-between gap-4 text-rose-500 font-bold">
                <span>{selectedStatuses.length === 1 ? `${selectedStatuses[0]} Absent` : 'Leave'}</span>
                <span className="font-black">{Number(activePoint.leave || 0).toLocaleString()} Persons</span>
              </div>
              {Number(activePoint.leaveRate || 0) > 0 && (
                <div className="flex justify-between gap-4 text-rose-500 font-bold">
                  <span>{selectedStatuses.length === 1 ? `${selectedStatuses[0]} absent rate` : 'Leave rate'}</span>
                  <span className="font-black">{Number(activePoint.leaveRate).toFixed(1)}%</span>
                </div>
              )}
              {isSplitWorkingByLine && (
                <div className="space-y-1 border-t border-base-200 pt-2">
                  {selectedGraphLines.map((lineName, index) => (
                    <div
                      key={lineName}
                      className="flex min-w-0 justify-between gap-3 font-semibold"
                      style={{ color: MULTI_LINE_WORKING_COLORS[index % MULTI_LINE_WORKING_COLORS.length] }}
                    >
                      <span className="min-w-0 truncate" title={lineName}>{lineName}</span>
                      <span className="shrink-0 font-black">
                        {Number(activePoint[`workingLine${index}`] || 0).toLocaleString()} Persons
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mb-2 flex justify-between gap-4" style={{ color: selectedGraphOption?.color }}>
              <span>{selectedGraphOption?.label || 'Value'}</span>
              <span className="font-black">
                {Number(activePoint.value || 0).toLocaleString()} {selectedGraphOption?.unit || ''}
              </span>
            </div>
          )}
          <div className="flex min-h-0 flex-1 flex-col border-t border-base-200 pt-2">
            <div className="mb-1 shrink-0 font-black text-base-content">Status (Persons)</div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
              {statuses.length > 0 ? (
                statuses.map(item => (
                  <div key={item.status} className="text-base-content/80">
                    <div className="flex justify-between gap-4">
                      <span>{item.status}</span>
                      <span className="font-black text-primary">{item.count.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-[11px] font-semibold">
                      <span className="text-sky-500">Present {item.present.toLocaleString()}</span>
                      <span className="text-rose-500">Absent {item.absent.toLocaleString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-base-content/40">
                  {manhourRecordsCount === 0 ? 'Loading status details...' : 'No status details for this selection'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

