import React, { useMemo, useRef } from "react";
import * as echarts from "echarts";
import { Camera } from "lucide-react";
import { BaseEChart, BaseEChartHandle } from "@/components/common/BaseEChart";

interface DailyChartsProps {
  date: string;
  rows: any[];
  groupSummaries: Record<string, any>;
  totalP1: Record<string, any>;
}

export const DailyComboCharts: React.FC<DailyChartsProps> = ({
  date,
  rows,
  groupSummaries,
}) => {
  const leaveChartRef = useRef<BaseEChartHandle>(null);
  const otChartRef = useRef<BaseEChartHandle>(null);

  // แผนกและกลุ่ม
  const categories = useMemo(() => rows.map((r) => r.dept), [rows]);
  const p1Data = useMemo(() => rows.map((r) => r.blocks?.P1 || { mp: 0, work: 0, leave: 0, ot: 0, leaveRatio: 0, otRatio: 0 }), [rows]);

  const mpValues = useMemo(() => p1Data.map((d) => d.mp), [p1Data]);
  const leaveValues = useMemo(() => p1Data.map((d) => d.leave), [p1Data]);
  const otValues = useMemo(() => p1Data.map((d) => d.ot), [p1Data]);
  const leaveRatioValues = useMemo(() => p1Data.map((d) => d.leaveRatio), [p1Data]);
  const otRatioValues = useMemo(() => p1Data.map((d) => d.otRatio), [p1Data]);

  // คำนวณ Scale สูงสุดของแกนคน (People) แบบ Dynamic
  const maxMp = useMemo(() => Math.max(...mpValues, 0), [mpValues]);
  const maxPeople = useMemo(() => (maxMp > 0 ? Math.ceil((maxMp * 1.15) / 25) * 25 : 100), [maxMp]);
  const peopleInterval = useMemo(() => (maxPeople > 100 ? Math.ceil(maxPeople / 8 / 25) * 25 : 25), [maxPeople]);

  // คำนวณตำแหน่ง index ของแต่ละกลุ่มเพื่อปักหมุด Header และเส้นแบ่งแนวตั้ง
  const groupBounds = useMemo(() => {
    const bounds: { key: string; name: string; start: number; end: number; center: number }[] = [];
    let curStart = 0;
    [
      { key: "INDIRECT", name: "Indirect" },
      { key: "QA", name: "QA" },
      { key: "FPC", name: "FPC" },
      { key: "SMT_F", name: "SMT_F" },
      { key: "SMT_B", name: "SMT_B" },
      { key: "MDS", name: "MDS" },
    ].forEach((grp) => {
      const count = rows.filter((r) => r.group === grp.key).length;
      if (count > 0) {
        const end = curStart + count - 1;
        bounds.push({
          key: grp.key,
          name: grp.name,
          start: curStart,
          end,
          center: (curStart + end) / 2,
        });
        curStart += count;
      }
    });
    return bounds;
  }, [rows]);

  // 1. Leave Option
  const leaveOption = useMemo<echarts.EChartsOption>(() => {
    const option: echarts.EChartsOption = {
      animation: true,
      animationDuration: 1000,
      animationEasing: "cubicOut",
      backgroundColor: "#ffffff",
      grid: {
        top: 75,
        left: 55,
        right: 55,
        bottom: 135,
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: "#94a3b8", type: "dashed" } },
        backgroundColor: "#ffffff",
        borderColor: "#94a3b8",
        borderWidth: 1,
        padding: [8, 12],
        extraCssText: "box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); border-radius: 8px;",
        textStyle: { color: "#0f172a", fontSize: 13, fontFamily: "Arial, sans-serif" },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const idx = params[0].dataIndex;
          const item = rows[idx];
          const d = item?.blocks?.P1 || {};
          return `
            <div style="font-weight: 800; font-size: 14px; margin-bottom: 6px; color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
              ${item?.dept} (${item?.group}) ${item?.coc ? `[${item.coc}]` : ""}
            </div>
            <div style="color: #334155; line-height: 1.6;">
              <div>MP: <b style="color: #0f172a;">${d.mp || 0}</b> คน</div>
              <div>Work: <b style="color: #0f172a;">${d.work || 0}</b> คน</div>
              <div>Leave: <b style="color: #dc2626;">${d.leave || 0}</b> คน (${Number(d.leaveRatio || 0).toFixed(1)}%)</div>
            </div>
          `;
        },
      },
      legend: {
        bottom: 10,
        left: "center",
        data: [
          { name: "MP", icon: "rect" },
          { name: "Leave", icon: "rect" },
          { name: "Ratio Leave", icon: "circle" },
        ],
        itemWidth: 24,
        itemHeight: 12,
        textStyle: { fontSize: 12, fontWeight: "700", color: "#334155" },
      },
      xAxis: [
        {
          type: "category",
          data: categories,
          axisLine: { lineStyle: { color: "#94a3b8" } },
          axisTick: { alignWithLabel: true, lineStyle: { color: "#94a3b8" } },
          axisLabel: {
            interval: 0,
            rotate: 90,
            fontSize: 11,
            fontWeight: "800",
            color: "#0f172a",
            margin: 6,
            fontFamily: "Inter Variable, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
          },
          splitLine: { show: false },
        },
        {
          type: "category",
          position: "bottom",
          offset: 52,
          axisLine: { show: true, lineStyle: { color: "#64748b", width: 1.5 } },
          axisTick: {
            show: true,
            length: 22,
            inside: false,
            alignWithLabel: false,
            interval: (index: number) => {
              return groupBounds.some((g) => g.end + 1 === index);
            },
            lineStyle: { color: "#64748b", width: 1.5 },
          },
          splitLine: { show: false },
          data: categories.map((_, i) => {
            const gb = groupBounds.find((g) => Math.round(g.center) === i);
            return gb ? gb.name.toUpperCase() : "";
          }),
          axisLabel: {
            interval: 0,
            fontSize: 12,
            fontWeight: "bold",
            color: "#0f172a",
            margin: 6,
          },
        },
      ],
      yAxis: [
        {
          type: "value",
          min: 0,
          max: maxPeople,
          interval: peopleInterval,
          axisLine: { show: true, lineStyle: { color: "#94a3b8" } },
          axisTick: { show: true, lineStyle: { color: "#94a3b8" } },
          axisLabel: { fontSize: 11, fontWeight: "600", color: "#333333" },
          splitLine: { show: false },
        },
        {
          type: "value",
          min: 0,
          max: 115,
          interval: 20,
          axisLine: { show: true, lineStyle: { color: "#94a3b8" } },
          axisTick: { show: true, lineStyle: { color: "#94a3b8" } },
          axisLabel: {
            formatter: (v: number) => (v <= 100 ? `${v}.0%` : ""),
            fontSize: 11,
            fontWeight: "600",
            color: "#333333",
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "MP",
          type: "bar",
          data: mpValues,
          barWidth: 8,
          barGap: "20%",
          itemStyle: {
            color: "#6BA4D8",
            borderColor: "#4A82B5",
            borderWidth: 1,
          },
        },
        {
          name: "Leave",
          type: "bar",
          data: leaveValues,
          barWidth: 8,
          itemStyle: {
            color: "#E50000",
            borderColor: "#B30000",
            borderWidth: 1,
          },
        },
        {
          name: "Ratio Leave",
          type: "line",
          yAxisIndex: 1,
          data: leaveRatioValues,
          symbol: "circle",
          symbolSize: 6,
          itemStyle: {
            color: "#ffffff",
            borderColor: "#DC2626",
            borderWidth: 2,
          },
          lineStyle: {
            color: "#DC2626",
            width: 2.2,
          },
          label: {
            show: true,
            position: "top",
            distance: 4,
            formatter: (p: any) => `${Number(p.value || 0).toFixed(1)}%`,
            fontSize: 9,
            fontWeight: "900",
            color: "#991B1B",
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            borderRadius: 3,
            padding: [1.5, 2],
            fontFamily: "Inter Variable, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
          },
        },
      ],
    };

    (option as any).graphic = groupBounds.map((gb) => {
      const sum = groupSummaries[gb.key]?.P1 || {};
      const ratio = sum.leaveRatio ?? 0;
      return {
        type: "group",
        left: `${((gb.center + 0.5) / categories.length) * 88 + 5}%`,
        top: 6,
        children: [
          {
            type: "rect",
            shape: {
              x: -34,
              y: 0,
              width: 68,
              height: 48,
              r: 16,
            },
            style: {
              fill: "#FFFFFF",
              stroke: "#CBD5E1",
              lineWidth: 1.2,
              shadowBlur: 6,
              shadowColor: "rgba(15, 23, 42, 0.06)",
              shadowOffsetY: 2,
            },
          },
          {
            type: "text",
            top: 7,
            style: {
              text: gb.name,
              font: "bold 11px Inter, system-ui, -apple-system, sans-serif",
              fill: "#334155",
              textAlign: "center",
            },
          },
          {
            type: "text",
            top: 24,
            style: {
              text: `${Number(ratio).toFixed(1)}%`,
              font: "900 13.5px Inter, system-ui, -apple-system, sans-serif",
              fill: "#E11D48",
              textAlign: "center",
            },
          },
        ],
      };
    });

    return option;
  }, [rows, categories, groupBounds, groupSummaries, mpValues, leaveValues, leaveRatioValues, maxPeople, peopleInterval]);

  // 2. OT Option
  const otOption = useMemo<echarts.EChartsOption>(() => {
    const option: echarts.EChartsOption = {
      animation: true,
      animationDuration: 1000,
      animationEasing: "cubicOut",
      backgroundColor: "#ffffff",
      grid: {
        top: 75,
        left: 55,
        right: 55,
        bottom: 135,
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: "#94a3b8", type: "dashed" } },
        backgroundColor: "#ffffff",
        borderColor: "#94a3b8",
        borderWidth: 1,
        padding: [8, 12],
        extraCssText: "box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); border-radius: 8px;",
        textStyle: { color: "#0f172a", fontSize: 13, fontFamily: "Arial, sans-serif" },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const idx = params[0].dataIndex;
          const item = rows[idx];
          const d = item?.blocks?.P1 || {};
          return `
            <div style="font-weight: 800; font-size: 14px; margin-bottom: 6px; color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
              ${item?.dept} (${item?.group}) ${item?.coc ? `[${item.coc}]` : ""}
            </div>
            <div style="color: #334155; line-height: 1.6;">
              <div>MP: <b style="color: #0f172a;">${d.mp || 0}</b> คน</div>
              <div>Work: <b style="color: #0f172a;">${d.work || 0}</b> คน</div>
              <div>OT: <b style="color: #16a34a;">${d.ot || 0}</b> คน (${Number(d.otRatio || 0).toFixed(1)}%)</div>
            </div>
          `;
        },
      },
      legend: {
        bottom: 10,
        left: "center",
        data: [
          { name: "MP", icon: "rect" },
          { name: "OT", icon: "rect" },
          { name: "Ratio OT", icon: "circle" },
        ],
        itemWidth: 24,
        itemHeight: 12,
        textStyle: { fontSize: 12, fontWeight: "700", color: "#334155" },
      },
      xAxis: [
        {
          type: "category",
          data: categories,
          axisLine: { lineStyle: { color: "#94a3b8" } },
          axisTick: { alignWithLabel: true, lineStyle: { color: "#94a3b8" } },
          axisLabel: {
            interval: 0,
            rotate: 90,
            fontSize: 11,
            fontWeight: "800",
            color: "#0f172a",
            margin: 6,
            fontFamily: "Inter Variable, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
          },
          splitLine: { show: false },
        },
        {
          type: "category",
          position: "bottom",
          offset: 52,
          axisLine: { show: true, lineStyle: { color: "#64748b", width: 1.5 } },
          axisTick: {
            show: true,
            length: 22,
            inside: false,
            alignWithLabel: false,
            interval: (index: number) => {
              return groupBounds.some((g) => g.end + 1 === index);
            },
            lineStyle: { color: "#64748b", width: 1.5 },
          },
          splitLine: { show: false },
          data: categories.map((_, i) => {
            const gb = groupBounds.find((g) => Math.round(g.center) === i);
            return gb ? gb.name.toUpperCase() : "";
          }),
          axisLabel: {
            interval: 0,
            fontSize: 12,
            fontWeight: "bold",
            color: "#0f172a",
            margin: 6,
          },
        },
      ],
      yAxis: [
        {
          type: "value",
          min: 0,
          max: maxPeople,
          interval: peopleInterval,
          axisLine: { show: true, lineStyle: { color: "#94a3b8" } },
          axisTick: { show: true, lineStyle: { color: "#94a3b8" } },
          axisLabel: { fontSize: 11, fontWeight: "600", color: "#333333" },
          splitLine: { show: false },
        },
        {
          type: "value",
          min: 0,
          max: 115,
          interval: 20,
          axisLine: { show: true, lineStyle: { color: "#94a3b8" } },
          axisTick: { show: true, lineStyle: { color: "#94a3b8" } },
          axisLabel: {
            formatter: (v: number) => (v <= 100 ? `${v}.0%` : ""),
            fontSize: 11,
            fontWeight: "600",
            color: "#333333",
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "MP",
          type: "bar",
          data: mpValues,
          barWidth: 8,
          barGap: "20%",
          itemStyle: {
            color: "#6BA4D8",
            borderColor: "#4A82B5",
            borderWidth: 1,
          },
        },
        {
          name: "OT",
          type: "bar",
          data: otValues,
          barWidth: 8,
          itemStyle: {
            color: "#16A34A",
            borderColor: "#15803D",
            borderWidth: 1,
          },
        },
        {
          name: "Ratio OT",
          type: "line",
          yAxisIndex: 1,
          data: otRatioValues,
          symbol: "circle",
          symbolSize: 6,
          itemStyle: {
            color: "#ffffff",
            borderColor: "#16A34A",
            borderWidth: 2,
          },
          lineStyle: {
            color: "#16A34A",
            width: 2.2,
          },
          label: {
            show: true,
            position: "top",
            distance: 4,
            formatter: (p: any) => `${Number(p.value || 0).toFixed(1)}%`,
            fontSize: 9,
            fontWeight: "900",
            color: "#14532D",
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            borderRadius: 3,
            padding: [1.5, 2],
            fontFamily: "Inter Variable, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
          },
        },
      ],
    };

    (option as any).graphic = groupBounds.map((gb) => {
      const sum = groupSummaries[gb.key]?.P1 || {};
      const ratio = sum.otRatio ?? 0;
      return {
        type: "group",
        left: `${((gb.center + 0.5) / categories.length) * 88 + 5}%`,
        top: 6,
        children: [
          {
            type: "rect",
            shape: {
              x: -34,
              y: 0,
              width: 68,
              height: 48,
              r: 16,
            },
            style: {
              fill: "#FFFFFF",
              stroke: "#CBD5E1",
              lineWidth: 1.2,
              shadowBlur: 6,
              shadowColor: "rgba(15, 23, 42, 0.06)",
              shadowOffsetY: 2,
            },
          },
          {
            type: "text",
            top: 7,
            style: {
              text: gb.name,
              font: "bold 11px Inter, system-ui, -apple-system, sans-serif",
              fill: "#334155",
              textAlign: "center",
            },
          },
          {
            type: "text",
            top: 24,
            style: {
              text: `${Number(ratio).toFixed(1)}%`,
              font: "900 13.5px Inter, system-ui, -apple-system, sans-serif",
              fill: "#16A34A",
              textAlign: "center",
            },
          },
        ],
      };
    });

    return option;
  }, [rows, categories, groupBounds, groupSummaries, mpValues, otValues, otRatioValues, maxPeople, peopleInterval]);

  const downloadChart = (type: "leave" | "ot") => {
    const chartHandle = type === "leave" ? leaveChartRef.current : otChartRef.current;
    if (!chartHandle) return;
    const instance = chartHandle.getInstance();
    if (!instance) return;
    const dataUrl = instance.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: "#ffffff",
    });
    const link = document.createElement("a");
    link.download = `${type.toUpperCase()}_RATIO_DAILY_${date}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="space-y-4">
      {/* 1. Leave Ratio Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_6px_24px_-4px_rgba(0,0,0,0.08)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full bg-rose-500 shadow-xs shadow-rose-300" />
                  Leave Ratio Daily
                </h2>
                {date && (
                  <span className="rounded-xl bg-blue-50/80 border border-blue-200 px-3 py-0.5 text-xs font-black text-blue-700 shadow-xs">
                    📅 {date.split("-").reverse().join("/")}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                เปรียบเทียบอัตราส่วนการลางาน (Leave Ratio %) และจำนวนคน (MP vs Leave) รายแผนก
              </p>
            </div>
          </div>

          {/* Save PNG Button */}
          <button
            onClick={() => downloadChart("leave")}
            className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700 transition cursor-pointer shadow-2xs"
            title="ดาวน์โหลดรูปภาพกราฟความละเอียดสูง (PNG)"
          >
            <Camera size={14} />
            <span>Save PNG</span>
          </button>
        </div>

        {/* แสดงเต็มความกว้างจอ ไม่ต้องเลื่อน (Full Width View) */}
        <div className="w-full">
          <div className="h-[620px] w-full">
            <BaseEChart
              ref={leaveChartRef}
              option={leaveOption}
              style={{ width: "100%", height: "620px" }}
              notMerge={true}
              lazyUpdate={true}
            />
          </div>
        </div>
      </div>

      {/* 2. OT Ratio Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_6px_24px_-4px_rgba(0,0,0,0.08)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-300" />
                  OT Ratio Daily
                </h2>
                {date && (
                  <span className="rounded-xl bg-blue-50/80 border border-blue-200 px-3 py-0.5 text-xs font-black text-blue-700 shadow-xs">
                    📅 {date.split("-").reverse().join("/")}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                เปรียบเทียบอัตราส่วนการทำงานล่วงเวลา (OT Ratio %) และจำนวนคน (MP vs OT) รายแผนก
              </p>
            </div>
          </div>

          {/* Save PNG Button */}
          <button
            onClick={() => downloadChart("ot")}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 transition cursor-pointer shadow-2xs"
            title="ดาวน์โหลดรูปภาพกราฟความละเอียดสูง (PNG)"
          >
            <Camera size={14} />
            <span>Save PNG</span>
          </button>
        </div>

        {/* แสดงเต็มความกว้างจอ ไม่ต้องเลื่อน (Full Width View) */}
        <div className="w-full">
          <div className="h-[620px] w-full">
            <BaseEChart
              ref={otChartRef}
              option={otOption}
              style={{ width: "100%", height: "620px" }}
              notMerge={true}
              lazyUpdate={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
