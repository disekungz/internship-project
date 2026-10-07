import React, { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, CustomChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// ลงทะเบียนคอมโพเนนต์ ECharts ที่จำเป็นเพื่อลดขนาด Bundle
echarts.use([
  BarChart,
  LineChart,
  CustomChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
  CanvasRenderer,
]);
import { ChartRow } from "../types";

export interface LeadTimeGroupColor {
  name: string;
  displayName: string;
  color: string;
}

export interface LeadTimeGroupItem {
  key: string;
  name: string;
  fullName: string;
  color: string;
}

export interface ProcessItem {
  key: string;
  name: string;
  color: string;
}

interface WipEChartProps {
  chartId: string;
  data: ChartRow[];
  yAxisMax: number;
  stackMax?: number;
  hasDualYAxis?: boolean;
  minStackValue?: number;
  barSize?: number;
  showComparisonArea?: boolean;
  leadTimeGroupColors: LeadTimeGroupColor[];
  leadTimeGroupList: LeadTimeGroupItem[];
  processList: ProcessItem[];
  selectedChartId: string | null;
  selectedDate: string | null;
  selectedStackKey: string | null;
  onSelectStack: (chartId: string, key: string, date?: string) => void;
  onSelectWholeDay: (chartId: string, date: string) => void;
  onClearSelection: () => void;
  height?: number;
  minWidth?: number;
  topMargin?: number;
  hideYAxisLabels?: boolean;
  enableScroll?: boolean;
}

const GRADIENT_MAP: Record<string, [string, string]> = {
  "0-3 Day": ["#8e7cf3", "#5c4dbd"],       // 🟣 เป๊ะตามลูกบอลม่วง: ไฮไลต์ซ้ายบนม่วงอ่อน ไล่ไปม่วงลึก
  "(1) : 0-3 Day": ["#8e7cf3", "#5c4dbd"],
  "4-9 Day": ["#4f9cf8", "#2563eb"],       // 🔵 เป๊ะตามลูกบอลน้ำเงิน: ไฮไลต์ฟ้าใส ไล่ไปน้ำเงินโคบอลต์
  "(2) : 4-9 Day": ["#4f9cf8", "#2563eb"],
  "10-29 Day": ["#5eead4", "#22c55e"],     // 🟢 เป๊ะตามลูกบอลเขียว: ไฮไลต์มินต์สว่าง ไล่ไปเขียวสด
  "(3) : 10-29 Day": ["#5eead4", "#22c55e"],
  "30-99 Day": ["#fde047", "#eab308"],     // 🟡 เป๊ะตามลูกบอลเหลือง: ไฮไลต์เหลืองนวล ไล่ไปเหลืองทอง
  "(4) : 30-99 Day": ["#fde047", "#eab308"],
  "100-364 Day": ["#fb923c", "#f97316"],   // 🟠 เป๊ะตามลูกบอลส้ม: ไฮไลต์ส้มพีช ไล่ไปส้มสด
  "(5) : 100-364 Day": ["#fb923c", "#f97316"],
  "More 365 Days": ["#fb7185", "#e11d48"], // 🔴 เป๊ะตามลูกบอลแดง: ไฮไลต์ชมพูแดง ไล่ไปแดงกุหลาบ
  "(6) : More 365 Days": ["#fb7185", "#e11d48"],
};

const getLeadTimeGradient = (name: string, fallbackColor: string) => {
  const stops = GRADIENT_MAP[name] || [fallbackColor, fallbackColor];
  // แบบที่ 2: ทรงกระบอก 3D แนวนอน - เนื้อสีแน่น อิ่มสดใส ไม่จางซีด
  return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
    { offset: 0, color: stops[0] },                                          // ขอบซ้ายเนื้อสีสด
    { offset: 0.35, color: echarts.color.lift(stops[0], 0.08) || stops[0] }, // จุดนูนไฮไลต์กำลังดี ไม่ซีดขาว
    { offset: 1, color: stops[1] },                                          // ขอบขวาเงาเข้มลึก
  ]);
};

const getDisplayedStackValue = (
  row: ChartRow,
  key: string,
  minimum = 0
) => {
  const value = Number(row[key] || 0);
  if (value <= 0) return 0;
  return minimum > 0 ? Math.max(value, minimum) : value;
};

const generateTooltipHtml = (
  row: ChartRow,
  label: string,
  processList: ProcessItem[],
  leadTimeGroupList: LeadTimeGroupItem[],
  selectedStackKey: string | null
) => {
  const selectedGroup = selectedStackKey
    ? leadTimeGroupList?.find((g) => g.key === selectedStackKey)
    : null;

  const leadTimeItems = Object.keys(row)
    .filter(
      (key) =>
        key.startsWith("lead_") &&
        Number(row[key]) > 0 &&
        (!selectedStackKey || key === selectedStackKey)
    )
    .map((key) => {
      const group = leadTimeGroupList?.find((g) => g.key === key);
      return {
        key,
        name: group ? group.name : key.replace("lead_", ""),
        color: group ? group.color : "#cbd5e1",
        value: Number(row[key]),
      };
    })
    .sort((a, b) => {
      const ai = (leadTimeGroupList || []).findIndex((g) => g.key === a.key);
      const bi = (leadTimeGroupList || []).findIndex((g) => g.key === b.key);
      return ai - bi;
    });

  const selectedProcessPrefix = selectedStackKey
    ? `leadproc:${selectedStackKey}:`
    : null;

  const processItems = Object.keys(row)
    .filter((key) =>
      selectedProcessPrefix
        ? key.startsWith(selectedProcessPrefix) && Number(row[key]) > 0
        : key.startsWith("proc_") && Number(row[key]) > 0
    )
    .map((key) => {
      const selectedProcessName = selectedProcessPrefix
        ? decodeURIComponent(key.slice(selectedProcessPrefix.length))
        : null;
      const process = selectedProcessName
        ? processList?.find((p) => p.name === selectedProcessName)
        : processList?.find((p) => p.key === key);
      return {
        key,
        name: process
          ? process.name
          : selectedProcessName ||
          key.replace("proc_", "").replace(/_/g, " "),
        color: selectedGroup?.color || (process ? process.color : "#6366f1"),
        value: Number(row[key]),
      };
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const processChunks = [];
  for (let i = 0; i < processItems.length; i += 15) {
    processChunks.push(processItems.slice(i, i + 15));
  }

  const targetHtml =
    row?.target !== undefined && row?.target !== null
      ? `<div style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:8px;background:#fff1f2;border:1px solid rgba(254,205,211,0.5);font-weight:bold;color:#e11d48;font-size:11px;">
          <span>Target:</span>
          <span>${row.target.toLocaleString()}</span>
        </div>`
      : "";

  const leadTimeHtml =
    leadTimeItems.length > 0
      ? `<div style="display:flex;flex-direction:column;gap:4px;margin-top:4px;">
        <div style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:1px;">
          ${selectedStackKey ? "Selected Lead Time Group" : "Lead Time Breakdown (All Groups)"}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
          ${leadTimeItems
        .map(
          (item) => `
            <div style="display:inline-flex;align-items:center;gap:6px;padding:3.5px 10px;border-radius:8px;background:${item.color}0D;border:1.5px solid ${item.color}45;box-shadow:0 1px 2px 0 rgba(0,0,0,0.03);font-size:11.5px;transition:all 0.15s ease;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${item.color};box-shadow:0 0 0 2px ${item.color}25;"></span>
              <span style="color:#334155;font-weight:600;">${item.name}:</span>
              <span style="font-weight:900;color:#0f172a;">${item.value.toLocaleString()}</span>
            </div>
          `
        )
        .join("")}
        </div>
      </div>`
      : "";

  const processHtml =
    processItems.length > 0
      ? `<div style="display:flex;flex-direction:column;gap:4px;border-top:1px solid #f1f5f9;padding-top:8px;margin-top:6px;">
        <div style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px;">
          ${selectedStackKey ? `Process in ${selectedGroup?.name || "Group"}` : "Process Breakdown"}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;max-height:280px;overflow-y:auto;padding-right:4px;">
          ${processItems
        .map(
          (item) => `
            <div style="display:inline-flex;align-items:center;gap:6px;padding:3.5px 10px;border-radius:8px;background:${item.color}10;border:1.5px solid ${item.color}55;box-shadow:0 1px 2px 0 rgba(0,0,0,0.03);font-size:11px;white-space:nowrap;flex-shrink:0;">
              <span style="display:inline-block;width:7.5px;height:7.5px;border-radius:50%;background-color:${item.color};box-shadow:0 0 0 2px ${item.color}25;"></span>
              <span style="color:#334155;font-weight:600;">${item.name}:</span>
              <span style="font-weight:900;color:#0f172a;">${item.value.toLocaleString()}</span>
            </div>
          `
        )
        .join("")}
        </div>
      </div>`
      : "";

  const totalValue = selectedStackKey && leadTimeItems.length === 1
    ? leadTimeItems[0].value
    : (row?.total ?? 0);

  return `
    <div style="display:flex;flex-direction:column;gap:4px;font-family:inherit;font-size:12px;color:#1e293b;width:100%;max-width:85vw;user-select:none;pointer-events:none;box-sizing:border-box;">
      <div style="display:flex;flex-direction:column;gap:4px;border-bottom:1px solid #f1f5f9;padding-bottom:6px;margin-bottom:2px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
          <div style="display:flex;align-items:center;gap:6px;font-weight:bold;color:#1e293b;">
            <span style="font-size:12px;color:#334155;text-transform:uppercase;">Date:</span>
            <span style="font-size:13px;color:#0f172a;font-weight:800;">${label}</span>
          </div>
          ${selectedGroup ? `
            <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;background:${selectedGroup.color}15;border:1px solid ${selectedGroup.color}40;color:${selectedGroup.color};font-size:11px;font-weight:800;">
              <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${selectedGroup.color};"></span>
              ${selectedGroup.name}
            </span>
          ` : `
            <span style="font-size:11px;font-weight:700;color:#64748b;background:#f1f5f9;padding:2px 8px;border-radius:6px;">
              All Stacks (Whole Day)
            </span>
          `}
        </div>
        <div style="display:flex;flex-direction:row;gap:8px;margin-top:2px;">
          <div style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:8px;background:#eef2ff;border:1px solid rgba(224,231,255,0.5);font-weight:bold;color:#4338ca;font-size:11px;">
            <span>${selectedStackKey ? "Stack Total:" : "Day Total:"}</span>
            <span style="font-weight:900;">${totalValue.toLocaleString()}</span>
          </div>
          ${targetHtml}
        </div>
      </div>
      ${leadTimeHtml}
      ${processHtml}
    </div>
  `;
};

const WipEChartComponent: React.FC<WipEChartProps> = ({
  chartId,
  data,
  yAxisMax,
  stackMax,
  hasDualYAxis = false,
  minStackValue = 5,
  barSize = 40,
  showComparisonArea = false,
  leadTimeGroupColors,
  leadTimeGroupList,
  processList,
  selectedChartId,
  selectedDate,
  selectedStackKey,
  onSelectStack,
  onSelectWholeDay,
  onClearSelection,
  height = 600,
  minWidth = 600,
  topMargin = 92,
  hideYAxisLabels = false,
  enableScroll = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // เก็บ Callback ล่าสุดไว้ใน ref เพื่อหลีกเลี่ยงการสร้าง Event Listener ใหม่ซ้ำๆ
  const onSelectStackRef = useRef(onSelectStack);
  onSelectStackRef.current = onSelectStack;
  const onSelectWholeDayRef = useRef(onSelectWholeDay);
  onSelectWholeDayRef.current = onSelectWholeDay;
  const onClearSelectionRef = useRef(onClearSelection);
  onClearSelectionRef.current = onClearSelection;

  const dates = useMemo(() => data.map((d) => d.date), [data]);
  const labels = useMemo(() => data.map((d) => d.label), [data]);

  // ตรวจสอบว่ากลุ่ม Lead Time ใดบ้างที่มีข้อมูลจริงในชุดข้อมูลนี้
  const activeGroups = useMemo(() => {
    return leadTimeGroupColors.filter((group) => {
      const key = `lead_${group.name.replace(/[^a-zA-Z0-9]/g, "_")}`;
      return data.some((d) => Number(d[key] || 0) > 0);
    });
  }, [leadTimeGroupColors, data]);

  const showDeferredLabels = true;

  // สร้างอ็อบเจ็กต์ Option สำหรับ ECharts
  const option = useMemo<echarts.EChartsOption>(() => {
    const isThisChartSelected = selectedChartId === chartId;

    // รายการ Series ข้อมูลกราฟ
    const seriesList: echarts.SeriesOption[] = [];

    // 1. Comparison Area Series (ยอดรวมทั้งหมด total_all) - ใช้แกน Y ฝั่งซ้าย (Index 0)
    if (showComparisonArea) {
      seriesList.push({
        name: "total_all",
        type: "line",
        yAxisIndex: 0,
        smooth: true,
        symbol: "none",
        large: true,
        largeThreshold: 2000,
        sampling: "lttb",
        lineStyle: {
          color: "rgba(148, 163, 184, 0.35)",
          width: 1.5,
        },
        areaStyle: {
          color: "rgba(148, 163, 184, 0.13)",
        },
        connectNulls: true,
        silent: true,
        z: 1,
        data: data.map((row) => row.total_all ?? row.total ?? 0),
      });
    }

    // 2. Stacked Bar Series สำหรับแต่ละกลุ่ม Lead Time - ในกรณีกราฟย่อยจะใช้แกน Y ฝั่งขวา (Index 1)
    activeGroups.forEach((group) => {
      const key = `lead_${group.name.replace(/[^a-zA-Z0-9]/g, "_")}`;
      const gradient = getLeadTimeGradient(group.name, group.color);

      seriesList.push({
        id: key,
        name: group.name,
        type: "bar",
        stack: "lot",
        yAxisIndex: hasDualYAxis ? 1 : 0,
        barWidth: barSize,
        barMaxWidth: barSize,
        barCategoryGap: 2,
        barGap: "0%",
        large: true,
        largeThreshold: 2000,
        sampling: "lttb",
        z: 3,
        itemStyle: {
          borderRadius: 0,
        },
        data: data.map((row) => {
          const rawVal = Number(row[key] || 0);
          const dispVal = getDisplayedStackValue(row, key, minStackValue);

          // คำนวณความโปร่งใส (Opacity) ตามเงื่อนไขการเลือก Highlight
          let opacity = 1;
          if (isThisChartSelected && selectedDate) {
            const isSelectedDay = row.date === selectedDate;
            if (selectedStackKey) {
              const isSelected = isSelectedDay && key === selectedStackKey;
              opacity = isSelected ? 1 : 0.35;
            } else {
              opacity = isSelectedDay ? 1 : 0.35;
            }
          }

          return {
            value: dispVal,
            rawVal,
            itemStyle: {
              color: gradient,
              opacity,
            },
          };
        }),
      });
    });

    // 3. เส้นกราฟเป้าหมาย (Total Target) - ใช้แกน Y ฝั่งซ้าย
    const hasTarget = data.some(
      (d) => d.target !== undefined && d.target !== null
    );
    if (hasTarget) {
      seriesList.push({
        name: "Total Target",
        type: "line",
        yAxisIndex: 0,
        smooth: true,
        connectNulls: true,
        large: true,
        largeThreshold: 2000,
        sampling: "lttb",
        lineStyle: {
          color: "#dc2626",
          width: 2,
          type: [5, 5],
        },
        symbol: "circle",
        symbolSize: 8,
        itemStyle: {
          color: "#dc2626",
          borderColor: "#dc2626",
          borderWidth: 0,
        },
        emphasis: {
          scale: 1.5,
          itemStyle: {
            color: "#dc2626",
          },
        },
        z: 5,
        data: data.map((row) =>
          row.target !== undefined && row.target !== null ? row.target : null
        ),
      });
    }

    // 4. ป้ายแสดงยอดรวมแท่งกราฟ (TotalLabel หมุน 90 องศาบนหัวแท่ง)
    if (showDeferredLabels) {
      seriesList.push({
        name: "TotalLabel",
        type: "custom",
        yAxisIndex: hasDualYAxis ? 1 : 0,
        z: 10,
        renderItem: (params: any, api: any) => {
          const dataIndex = params.dataIndex;
          const row = data[dataIndex];
          if (!row) return null;
          const value = row.total;
          if (value === undefined || value === null || Number(value) === 0)
            return null;

          const valStr = Number(value).toLocaleString();
          const rectWidth = Math.max(38, valStr.length * 6.8 + 8);
          const rectHeight = 18;

          const displayedTotal = leadTimeGroupList.reduce((sum, g) => {
            return sum + getDisplayedStackValue(row, g.key, minStackValue);
          }, 0) || value;

          // พิกัดด้านบนสุดของแท่ง Stack Bar บนกราฟ
          const pt = api.coord([dataIndex, displayedTotal]);
          const cx = pt[0];
          const barTopY = pt[1];

          // สลับฟันปลา (Staggering) แนวนอนเพื่อไม่ให้ป้ายวันติดกันชนกัน
          const isEven = dataIndex % 2 === 0;
          const offset = isEven ? 8 : 28;
          const topPadding = 6;
          const targetRy = barTopY - rectHeight - offset;
          const ry = Math.max(targetRy, topPadding);
          const rx = cx - rectWidth / 2;
          const textY = ry + rectHeight / 2;

          const children: any[] = [];

          // เส้นประโยงจากหัวแท่ง Bar ไปยังป้าย Label
          children.push({
            type: "line",
            shape: {
              x1: cx,
              y1: ry + rectHeight,
              x2: cx,
              y2: barTopY - 2,
            },
            style: {
              stroke: "#d97706",
              lineWidth: 1.2,
              lineDash: [2, 2],
              opacity: 0.7,
            },
          });

          // กรอบแคปซูลแสดงยอดรวมแนวนอน
          children.push({
            type: "rect",
            shape: {
              x: rx,
              y: ry,
              width: rectWidth,
              height: rectHeight,
              r: 4,
            },
            style: {
              fill: "#FEF3C7",
              stroke: "#F59E0B",
              lineWidth: 1.2,
              shadowColor: "rgba(0,0,0,0.06)",
              shadowBlur: 3,
              shadowOffsetY: 1,
            },
          });

          // ข้อความตัวเลขแนวนอนปกติ อ่านง่าย สบายตา ไม่ต้องเอียงคอ
          children.push({
            type: "text",
            x: cx,
            y: textY,
            rotation: 0,
            style: {
              text: valStr,
              textAlign: "center",
              textVerticalAlign: "middle",
              font: "bold 10px Inter, 'Segoe UI', Roboto, sans-serif",
              fill: "#78350f",
            },
          });

          return {
            type: "group",
            children,
          };
        },
        data: data.map((d, idx) => [idx, d.total]),
      });
    }

    // 5. ป้ายแสดงยอดรวมพื้นที่ทั้งหมด (TotalAllLabel ของ Area Chart)
    if (showDeferredLabels && showComparisonArea) {
      seriesList.push({
        name: "TotalAllLabel",
        type: "custom",
        yAxisIndex: 0,
        z: 11,
        renderItem: (params: any, api: any) => {
          const dataIndex = params.dataIndex;
          const row = data[dataIndex];
          if (!row) return null;
          const value = row.total_all;
          if (value === undefined || value === null || Number(value) === 0)
            return null;
          // เมื่อยอดรวมทั้งหมดเท่ากับยอดแท่งกราฟ ป้ายเดิมจะแสดงผลอย่างชัดเจนอยู่แล้ว
          if (Number(row.total_all) === Number(row.total)) {
            return null;
          }

          const valStr = Number(value).toLocaleString();
          const rectWidth = Math.max(38, valStr.length * 6.8 + 8);
          const rectHeight = 18;

          const pt = api.coord([dataIndex, value]);
          const cx = pt[0];
          const areaTopY = pt[1];

          // คำนวณพิกัดตำแหน่งแท่งกราฟ
          const barVal = Number(row.total || 0);
          const barPt = api.coord([dataIndex, barVal]);
          const barTopY = barPt[1];

          const isEven = dataIndex % 2 === 0;

          // คำนวณตำแหน่งด้านบนของป้าย TotalLabel เพื่อป้องกันการซ้อนทับกัน
          const displayedTotal = leadTimeGroupList.reduce((sum, g) => {
            return sum + getDisplayedStackValue(row, g.key, minStackValue);
          }, 0) || barVal;
          const displayedBarPt = api.coord([dataIndex, displayedTotal]);
          const displayedBarTopY = displayedBarPt[1];

          const barLabelOffset = isEven ? 8 : 28;
          const barLabelTop = displayedBarTopY - rectHeight - barLabelOffset;

          // ตำแหน่งปกติของป้าย TotalAllLabel สีน้ำเงิน
          const normalOffset = isEven ? 10 : 30;
          let targetRy = areaTopY - rectHeight - normalOffset;

          // หากตำแหน่งปกติซ้อนทับหรือใกล้กับป้าย TotalLabel ให้ดันตำแหน่งขึ้นด้านบนเพื่อความชัดเจน
          if (barVal > 0 && targetRy > barLabelTop - rectHeight - 6) {
            targetRy = barLabelTop - rectHeight - 6;
          }

          const topPadding = 6;
          const ry = Math.max(targetRy, topPadding);
          const rx = cx - rectWidth / 2;
          const textY = ry + rectHeight / 2;

          const children: any[] = [];

          // เส้นประเชื่อมโยงจากจุดกราฟพื้นที่ขึ้นไปยังป้ายข้อมูล
          children.push({
            type: "line",
            shape: {
              x1: cx,
              y1: ry + rectHeight,
              x2: cx,
              y2: areaTopY - 2,
            },
            style: {
              stroke: "#0284c7",
              lineWidth: 1.2,
              lineDash: [2, 2],
              opacity: 0.7,
            },
          });

          // กรอบแคปซูลสีฟ้าแสดงยอด Total All แนวนอน
          children.push({
            type: "rect",
            shape: {
              x: rx,
              y: ry,
              width: rectWidth,
              height: rectHeight,
              r: 4,
            },
            style: {
              fill: "#F0F9FF",
              stroke: "#38BDF8",
              lineWidth: 1.2,
              shadowColor: "rgba(0,0,0,0.06)",
              shadowBlur: 3,
              shadowOffsetY: 1,
            },
          });

          // ข้อความตัวเลขแนวนอนปกติ
          children.push({
            type: "text",
            x: cx,
            y: textY,
            rotation: 0,
            style: {
              text: valStr,
              textAlign: "center",
              textVerticalAlign: "middle",
              font: "bold 10px Inter, 'Segoe UI', Roboto, sans-serif",
              fill: "#0369a1",
            },
          });

          return {
            type: "group",
            children,
          };
        },
        data: data.map((d, idx) => [idx, d.total_all]),
      });
    }

    // กำหนดระยะขอบ Grid ของกราฟ
    const grid: echarts.GridComponentOption = {
      top: topMargin,
      bottom: 20,
      left: hideYAxisLabels ? 10 : 10,
      right: hasDualYAxis ? 20 : 30,
      containLabel: !hideYAxisLabels,
    };

    // กำหนดแกน Y
    const yAxis: echarts.YAxisComponentOption[] = [
      {
        type: "value",
        min: 0,
        max: yAxisMax,
        axisLine: {
          show: !hideYAxisLabels,
          lineStyle: { color: "#e2e8f0", width: 1 },
        },
        axisTick: { show: false },
        axisLabel: {
          show: !hideYAxisLabels,
          color: "#64748b",
          fontSize: 11,
          margin: 8,
          formatter: (val: number) => val.toLocaleString(),
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: "#e2e8f0",
            type: "dashed",
            dashOffset: 3,
          },
        },
      },
    ];

    if (hasDualYAxis) {
      yAxis.push({
        type: "value",
        position: "right",
        min: 0,
        max: Math.ceil((stackMax || yAxisMax) * 1.15),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#64748b",
          fontSize: 11,
          margin: 8,
          formatter: (val: number) => val.toLocaleString(),
        },
        splitLine: { show: false },
      });
    }

    return {
      animation: false,
      grid,
      tooltip: {
        show: false, // ปิด tooltip popup — ข้อมูลแสดงใน panel ด้านบนอยู่แล้ว
        axisPointer: {
          type: "shadow",
          shadowStyle: {
            color: "rgba(99, 102, 241, 0.1)",
          },
        },
      },
      xAxis: {
        type: "category",
        data: labels,
        triggerEvent: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          rotate: 90,
          color: "#64748b",
          fontSize: 11,
          interval: 0,
          margin: 12,
        },
        splitLine: { show: false },
      },
      yAxis,
      series: seriesList,
    };
  }, [
    chartId,
    data,
    labels,
    yAxisMax,
    stackMax,
    hasDualYAxis,
    minStackValue,
    barSize,
    showComparisonArea,
    activeGroups,
    leadTimeGroupList,
    processList,
    selectedChartId,
    selectedDate,
    selectedStackKey,
    topMargin,
    showDeferredLabels,
    hideYAxisLabels,
    enableScroll,
  ]);

  const [activeTooltip, setActiveTooltip] = useState<{
    x: number;
    y: number;
    html: string;
  } | null>(null);

  const [isVisible, setIsVisible] = useState(false);

  // IntersectionObserver: เรนเดอร์กราฟเมื่อเลื่อนเข้ามาใกล้หน้าจอเพื่อประหยัดหน่วยความจำ
  useEffect(() => {
    if (!containerRef.current) return;
    if (chartId === "main") {
      const frame = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "150px" }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [chartId]);

  const dataRef = useRef(data);
  dataRef.current = data;
  const labelsRef = useRef(labels);
  labelsRef.current = labels;
  const datesRef = useRef(dates);
  datesRef.current = dates;
  const processListRef = useRef(processList);
  processListRef.current = processList;
  const leadTimeGroupListRef = useRef(leadTimeGroupList);
  leadTimeGroupListRef.current = leadTimeGroupList;
  const showComparisonAreaRef = useRef(showComparisonArea);
  showComparisonAreaRef.current = showComparisonArea;

  // Init chart instance once visible
  useEffect(() => {
    if (!containerRef.current || !isVisible) return;

    const chart = echarts.init(containerRef.current, null, {
      renderer: "canvas",
      devicePixelRatio: Math.max(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2),
    });
    chartInstance.current = chart;

    // จัดการเมื่อผู้ใช้คลิกเลือกแท่งกราฟหรือจุดข้อมูล
    chart.on("click", (params: any) => {
      let dataIndex = -1;
      const currentData = dataRef.current;
      const currentLabels = labelsRef.current;
      const currentDates = datesRef.current;
      const currentProcList = processListRef.current;
      const currentLeadList = leadTimeGroupListRef.current;
      const currentShowComparison = showComparisonAreaRef.current;

      if (params.componentType === "series") {
        dataIndex = Array.isArray(params.value) ? params.value[0] : params.dataIndex;
      } else if (params.componentType === "xAxis") {
        dataIndex =
          params.dataIndex !== undefined
            ? params.dataIndex
            : currentDates.findIndex((d, idx) => currentLabels[idx] === params.value);
      }

      if (dataIndex >= 0 && currentData[dataIndex]) {
        const row = currentData[dataIndex];
        const date = row.date;
        let stackKey: string | null = null;
        if (params.seriesType === "bar") {
          stackKey = params.seriesId || params.seriesName;
          onSelectStackRef.current(chartId, stackKey, date);
        } else {
          onSelectWholeDayRef.current(chartId, date);
        }

        const point = chart.convertToPixel({ seriesIndex: currentShowComparison ? 1 : 0 }, [dataIndex, row.total || 0]) || [params.event?.offsetX || 150, 150];
        const html = generateTooltipHtml(
          row,
          row.label,
          currentProcList,
          currentLeadList,
          stackKey
        );

        setActiveTooltip({
          x: point[0],
          y: Math.max(20, point[1] - 10),
          html,
        });
      }
    });

    // จัดการเมื่อผู้ใช้คลิกพื้นที่ว่างเพื่อยกเลิกการเลือก
    chart.getZr().on("click", (event: any) => {
      if (!event.target) {
        onClearSelectionRef.current();
        setActiveTooltip(null);
      }
    });

    return () => {
      chart.dispose();
      chartInstance.current = null;
    };
  }, [chartId, isVisible]);

  // อัปเดตออปชันกราฟด้วยความเร็ว 60fps ผ่าน requestAnimationFrame
  useEffect(() => {
    if (!chartInstance.current || !isVisible) return;
    const chart = chartInstance.current;
    const rafId = requestAnimationFrame(() => {
      chart.setOption(option, { notMerge: true, lazyUpdate: true });
    });
    return () => cancelAnimationFrame(rafId);
  }, [option, isVisible]);

  // ซิงค์การแสดง Tooltip กับ State ภายนอก
  useEffect(() => {
    if (!selectedDate || selectedChartId !== chartId) {
      setActiveTooltip(null);
    }
  }, [selectedDate, selectedChartId, chartId]);

  // จัดการปรับขนาดกราฟอัตโนมัติอย่างมีประสิทธิภาพ
  useEffect(() => {
    if (!isVisible) return;
    let resizeTimer: any = null;
    const debouncedResize = () => {
      if (resizeTimer) cancelAnimationFrame(resizeTimer);
      resizeTimer = requestAnimationFrame(() => {
        chartInstance.current?.resize();
      });
    };

    const resizeObserver = new ResizeObserver(debouncedResize);

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    window.addEventListener("resize", debouncedResize, { passive: true });

    return () => {
      if (resizeTimer) cancelAnimationFrame(resizeTimer);
      window.removeEventListener("resize", debouncedResize);
      resizeObserver.disconnect();
    };
  }, [isVisible]);

  // คืนหน่วยความจำและล้าง Event Listener เมื่อปิดกราฟ
  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  const containerWidth = minWidth;

  return (
    <div style={{ position: "relative", width: containerWidth, height }}>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height,
        }}
      />
    </div>
  );
};

export const WipEChart = React.memo(WipEChartComponent);
