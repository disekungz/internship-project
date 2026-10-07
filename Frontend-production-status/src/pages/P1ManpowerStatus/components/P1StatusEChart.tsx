import React, { useMemo, useState, useEffect } from "react";
import * as echarts from "echarts";
import { DailyStatusItem } from "../types";
import { BaseEChart } from "@/components/common/BaseEChart";

interface P1StatusEChartProps {
  days: DailyStatusItem[];
  target: number;
  month: string;
}

export const P1StatusEChart: React.FC<P1StatusEChartProps> = ({ days, target }) => {
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

  const option = useMemo<echarts.EChartsOption>(() => {
    if (!days || days.length === 0) return {};

    const xData = days.map((d) => String(d.day));

    // หมวดหมู่ทั้ง 5
    const directData = days.map((d) => d.direct);
    const indirectData = days.map((d) => d.indirect);
    const contractData = days.map((d) => d.contract);
    const subcontractData = days.map((d) => d.subcontract);
    const mouData = days.map((d) => d.mou);

    // เส้น Target
    const targetLineData = days.map(() => target);

    // คำนวณขอบเขตแกน Y และตำแหน่งป้าย Badge ให้ไม่ทับซ้อนกับเส้น Target และหัวแท่งกราฟ
    const yMax = Math.max(1600, Math.ceil((target + 140) / 100) * 100);
    const badgeTopY = Math.max(1525, target + 75);
    const badgeBottomY = 48; // ลอยอยู่เหนือเส้นแกน X ด้านล่างอย่างพอเหมาะ ไม่ทับเส้นแกน

    const titleColor = isDark ? "#f1f5f9" : "#1e293b";
    const legendColor = isDark ? "#cbd5e1" : "#475569";
    const axisColor = isDark ? "#94a3b8" : "#475569";
    const splitColor = isDark ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0";

    return {
      title: {
        text: `P1 Manpower Status (excluded support N1 K1 A1)   Today =>Target ${target.toLocaleString()} persons`,
        left: "center",
        top: 8,
        textStyle: {
          fontSize: 14,
          fontWeight: "bold",
          color: titleColor,
          fontFamily: "Inter, Roboto, sans-serif",
        },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
          shadowStyle: {
            color: "rgba(59, 130, 246, 0.08)",
          },
        },
        backgroundColor: isDark ? "rgba(15, 23, 42, 0.96)" : "rgba(255, 255, 255, 0.98)",
        borderColor: isDark ? "#334155" : "#cbd5e1",
        borderWidth: 1,
        padding: [12, 16],
        extraCssText: isDark 
          ? "box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); border-radius: 10px; min-width: 290px;"
          : "box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08); border-radius: 10px; min-width: 290px;",
        textStyle: {
          color: isDark ? "#f8fafc" : "#0f172a",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const dataIndex = params[0].dataIndex;
          const item = days[dataIndex];
          if (!item) return "";

          const dayNames = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
          const dayName = dayNames[item.dayOfWeek];
          const isHol = item.isHoliday;
          const borderCol = isDark ? "#334155" : "#e2e8f0";
          const subTextCol = isDark ? "#94a3b8" : "#64748b";
          const titleTextCol = isDark ? "#f8fafc" : "#0f172a";

          let html = `
            <div style="font-weight: 800; font-size: 13.5px; margin-bottom: 8px; border-bottom: 1.5px solid ${borderCol}; padding-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
              <span style="color: ${titleTextCol};">วันที่ ${item.day} (${item.date}) - วัน${dayName}</span>
              <span style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 9999px; background: ${isHol ? (isDark ? '#4c0519; color: #f43f5e;' : '#ffe4e6; color: #be123c;') : (isDark ? '#1e3a8a; color: #93c5fd;' : '#dbeafe; color: #1d4ed8;')};">
                ${isHol ? 'วันหยุด (Holiday)' : 'วันทำงาน (Working)'}
              </span>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 2px;">
              <tbody>
                <tr style="border-bottom: 1px solid ${borderCol};">
                  <td style="padding: 4px 8px 4px 0; color: ${isDark ? '#c084fc' : '#6b21a8'}; font-weight: 600; vertical-align: middle;">
                    <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #9333ea; margin-right: 6px; vertical-align: middle;"></span>
                    Direct Workers (100% PRD)
                  </td>
                  <td style="padding: 4px 0; text-align: right; white-space: nowrap; vertical-align: middle;">
                    <span style="font-weight: 800; font-size: 14px; color: ${isDark ? '#e9d5ff' : '#1e1b4b'}; font-variant-numeric: tabular-nums;">${item.direct.toLocaleString()}</span>
                    <span style="font-size: 11px; color: ${subTextCol}; font-weight: 500; margin-left: 4px;">คน</span>
                  </td>
                </tr>

                <tr style="border-bottom: 1px solid ${borderCol};">
                  <td style="padding: 4px 8px 4px 0; color: ${isDark ? '#f87171' : '#b91c1c'}; font-weight: 600; vertical-align: middle;">
                    <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #ef4444; margin-right: 6px; vertical-align: middle;"></span>
                    In-Direct Workers (All level)
                  </td>
                  <td style="padding: 4px 0; text-align: right; white-space: nowrap; vertical-align: middle;">
                    <span style="font-weight: 800; font-size: 14px; color: ${isDark ? '#fca5a5' : '#450a0a'}; font-variant-numeric: tabular-nums;">${item.indirect.toLocaleString()}</span>
                    <span style="font-size: 11px; color: ${subTextCol}; font-weight: 500; margin-left: 4px;">คน</span>
                  </td>
                </tr>

                <tr style="border-bottom: 1px solid ${borderCol};">
                  <td style="padding: 4px 8px 4px 0; color: ${isDark ? '#4ade80' : '#15803d'}; font-weight: 600; vertical-align: middle;">
                    <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #22c55e; margin-right: 6px; vertical-align: middle;"></span>
                    Employee Contract (DC)
                  </td>
                  <td style="padding: 4px 0; text-align: right; white-space: nowrap; vertical-align: middle;">
                    <span style="font-weight: 800; font-size: 14px; color: ${isDark ? '#86efac' : '#052e16'}; font-variant-numeric: tabular-nums;">${item.contract.toLocaleString()}</span>
                    <span style="font-size: 11px; color: ${subTextCol}; font-weight: 500; margin-left: 4px;">คน</span>
                  </td>
                </tr>

                <tr style="border-bottom: 1px solid ${borderCol};">
                  <td style="padding: 4px 8px 4px 0; color: ${isDark ? '#fbbf24' : '#b45309'}; font-weight: 600; vertical-align: middle;">
                    <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #f59e0b; margin-right: 6px; vertical-align: middle;"></span>
                    Subcontract (VDS/PIMB)
                  </td>
                  <td style="padding: 4px 0; text-align: right; white-space: nowrap; vertical-align: middle;">
                    <span style="font-weight: 800; font-size: 14px; color: ${isDark ? '#fde68a' : '#451a03'}; font-variant-numeric: tabular-nums;">${item.subcontract.toLocaleString()}</span>
                    <span style="font-size: 11px; color: ${subTextCol}; font-weight: 500; margin-left: 4px;">คน</span>
                  </td>
                </tr>

                <tr style="border-bottom: 1.5px solid ${borderCol};">
                  <td style="padding: 4px 8px 4px 0; color: ${isDark ? '#f472b6' : '#be185d'}; font-weight: 600; vertical-align: middle;">
                    <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #ec4899; margin-right: 6px; vertical-align: middle;"></span>
                    MOU
                  </td>
                  <td style="padding: 4px 0; text-align: right; white-space: nowrap; vertical-align: middle;">
                    <span style="font-weight: 800; font-size: 14px; color: ${isDark ? '#fbcfe8' : '#500724'}; font-variant-numeric: tabular-nums;">${item.mou.toLocaleString()}</span>
                    <span style="font-size: 11px; color: ${subTextCol}; font-weight: 500; margin-left: 4px;">คน</span>
                  </td>
                </tr>

                <tr style="border-bottom: 1px solid ${borderCol};">
                  <td style="padding: 7px 8px 5px 0; font-weight: 800; font-size: 13px; color: ${titleTextCol}; vertical-align: middle;">
                    ยอดรวม (Total Manpower)
                  </td>
                  <td style="padding: 7px 0 5px 0; text-align: right; white-space: nowrap; vertical-align: middle;">
                    <span style="font-weight: 900; font-size: 16px; color: ${isDark ? '#2dd4bf' : '#0f766e'}; font-variant-numeric: tabular-nums;">${item.total.toLocaleString()}</span>
                    <span style="font-size: 11px; color: ${isDark ? '#2dd4bf' : '#0f766e'}; font-weight: 700; margin-left: 4px;">คน</span>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 4px 8px 4px 0; font-size: 11.5px; color: ${subTextCol}; vertical-align: middle;">
                    เป้าหมาย (Target)
                  </td>
                  <td style="padding: 4px 0; text-align: right; font-size: 11.5px; white-space: nowrap; vertical-align: middle;">
                    <span style="font-weight: 700; color: #38bdf8;">${target.toLocaleString()} คน</span>
                    ${
                      item.total > 0
                        ? `<span style="margin-left: 5px; font-weight: 700; color: ${item.total - target >= 0 ? '#22c55e' : '#f43f5e'};">
                            (${item.total - target >= 0 ? '+' : ''}${(item.total - target).toLocaleString()})
                          </span>`
                        : ''
                    }
                  </td>
                </tr>
              </tbody>
            </table>

            ${
              item.present > 0
                ? `<div style="margin-top: 6px; padding: 4px 8px; background: ${isDark ? '#1e293b' : '#f8fafc'}; border: 1px solid ${borderCol}; border-radius: 6px; display: flex; justify-content: space-around; font-size: 10.5px;">
                    <span style="color: ${isDark ? '#4ade80' : '#15803d'}; font-weight: 700;">● มาทำงาน: ${item.present.toLocaleString()} คน</span>
                    <span style="color: ${subTextCol};">|</span>
                    <span style="color: ${isDark ? '#f87171' : '#b91c1c'}; font-weight: 700;">● ขาด/ลา: ${item.absent.toLocaleString()} คน</span>
                  </div>`
                : isHol
                ? `<div style="margin-top: 6px; padding: 4px 8px; background: ${isDark ? '#4c0519' : '#fff1f2'}; border: 1px solid ${isDark ? '#881337' : '#fecdd3'}; border-radius: 6px; text-align: center; font-size: 11px; color: ${isDark ? '#fb7185' : '#be123c'}; font-weight: 700;">
                    วันหยุดโรงงานตามปฏิทิน (tbl_date)
                  </div>`
                : ''
            }
          `;
          return html;
        },
      },
      legend: {
        bottom: 8,
        left: "center",
        itemWidth: 16,
        itemHeight: 10,
        textStyle: {
          fontSize: 11,
          color: legendColor,
        },
        data: [
          "Direct Workers - TO/TT 1-7 ( 100% PRD) Balance",
          "In-Direct Workers - Employee all level...",
          "employee contract Balance",
          "Subcontract Balance",
          "MOU Balance",
          "Target",
        ],
      },
      grid: {
        top: 55,
        left: 50,
        right: 25,
        bottom: 45,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: xData,
        axisLine: {
          lineStyle: {
            color: isDark ? "#475569" : "#94a3b8",
          },
        },
        axisLabel: {
          color: (_value: string, index: number) => {
            const item = days[index];
            if (item?.isHoliday) return "#f43f5e"; // สีแดงสำหรับวันหยุด
            return axisColor;
          },
          fontSize: 11,
          fontWeight: (_value: string, index: number) => {
            const item = days[index];
            return item?.isHoliday ? 700 : 500;
          },
          interval: 0,
        },
        axisTick: {
          alignWithLabel: true,
        },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: yMax,
        interval: 200,
        axisLabel: {
          formatter: "{value}",
          color: axisColor,
          fontSize: 11,
        },
        splitLine: {
          lineStyle: {
            color: splitColor,
            type: "solid",
          },
        },
      },
      series: [
        // 1. Direct Workers (ชั้นล่างสุด - สีม่วงลาเวนเดอร์)
        {
          name: "Direct Workers - TO/TT 1-7 ( 100% PRD) Balance",
          type: "bar",
          stack: "total",
          barMaxWidth: 36,
          barCategoryGap: "20%",
          itemStyle: {
            color: "#c4b5fd", // lavender
          },
          label: {
            show: true,
            position: "inside",
            formatter: (params: any) => (params.value > 0 ? params.value : ""),
            fontSize: 10,
            fontWeight: 800,
            color: "#3b0764",
          },
          data: directData,
          z: 3,
        },
        // 2. In-Direct Workers (ชั้นที่ 2 - สีชมพูคอรัล)
        {
          name: "In-Direct Workers - Employee all level...",
          type: "bar",
          stack: "total",
          barMaxWidth: 36,
          barCategoryGap: "20%",
          itemStyle: {
            color: "#fca5a5", // soft coral
          },
          label: {
            show: true,
            position: "inside",
            formatter: (params: any) => (params.value > 0 ? params.value : ""),
            fontSize: 10,
            fontWeight: 800,
            color: "#7f1d1d",
          },
          data: indirectData,
          z: 3,
        },
        // 3. employee contract Balance (ชั้นที่ 3 - สีเขียวอ่อน)
        {
          name: "employee contract Balance",
          type: "bar",
          stack: "total",
          barMaxWidth: 36,
          barCategoryGap: "20%",
          itemStyle: {
            color: "#86efac", // soft green
          },
          label: {
            show: true,
            position: "inside",
            formatter: (params: any) => (params.value > 0 ? params.value : ""),
            fontSize: 9,
            fontWeight: 800,
            color: "#052e16",
            lineHeight: 9,
            padding: 0,
            align: "center",
            verticalAlign: "middle",
          },
          data: contractData,
          z: 3,
        },
        // 4. Subcontract Balance (ชั้นที่ 4 - สีส้มคาราเมล)
        {
          name: "Subcontract Balance",
          type: "bar",
          stack: "total",
          barMaxWidth: 36,
          barCategoryGap: "20%",
          itemStyle: {
            color: "#fbbf24", // amber
          },
          label: {
            show: true,
            position: "inside",
            formatter: (params: any) => (params.value > 0 ? params.value : ""),
            fontSize: 10,
            fontWeight: 800,
            color: "#451a03",
            align: "center",
            verticalAlign: "middle",
          },
          data: subcontractData,
          z: 3,
        },
        // 5. MOU Balance (ชั้นที่ 5 บนสุด - สีชมพูบานเย็น)
        {
          name: "MOU Balance",
          type: "bar",
          stack: "total",
          barMaxWidth: 36,
          barCategoryGap: "20%",
          itemStyle: {
            color: "#f472b6", // magenta pink
          },
          label: {
            show: true,
            position: "inside",
            formatter: (params: any) => (params.value > 0 ? params.value : ""),
            fontSize: 9,
            fontWeight: 800,
            color: "#500724",
            lineHeight: 9,
            padding: 0,
            align: "center",
            verticalAlign: "middle",
          },
          data: mouData,
          z: 3,
        },
        // 6. ป้าย Badge ด้านบนสุดของแท่งกราฟ
        {
          name: "Total Badge",
          type: "scatter",
          symbol: "rect",
          symbolSize: (_value: any, params: any) => {
            const isZero = params?.data?.total === 0;
            return isZero ? [22, 16] : [34, 18];
          },
          itemStyle: {
            color: isDark ? "#0891b2" : "#0e7490", // dark teal
            borderColor: isDark ? "#06b6d4" : "#083344",
            borderWidth: 1,
            borderRadius: 3,
          },
          label: {
            show: true,
            formatter: (params: any) => {
              const total = Number(params.data?.total ?? 0);
              return total > 0 ? total.toLocaleString() : "0";
            },
            position: "inside",
            color: "#ffffff",
            fontSize: 9.5,
            fontWeight: "bold",
            fontFamily: "Inter, Roboto, sans-serif",
          },
          data: days.map((d, idx) => ({
            value: [idx, d.total > 0 ? badgeTopY : badgeBottomY],
            total: d.total,
            itemStyle: {
              opacity: 1,
            },
          })),
          tooltip: {
            show: false,
          },
          z: 10,
        },
        // 7. เส้น Target (1,440 คน)
        {
          name: "Target",
          type: "line",
          showSymbol: true,
          symbol: "circle",
          symbolSize: 6,
          itemStyle: {
            color: isDark ? "#0f172a" : "#ffffff",
            borderColor: "#0284c7",
            borderWidth: 2,
          },
          lineStyle: {
            color: "#0284c7",
            width: 2,
          },
          data: targetLineData,
          z: 2,
        },
      ],
    };
  }, [days, target, isDark]);

  return (
    <div className="w-full rounded-2xl bg-base-100 p-4 shadow-md border border-base-300 overflow-hidden">
      <div className="w-full h-[640px]">
        <BaseEChart
          option={option}
          style={{ width: "100%", height: "640px" }}
          notMerge={true}
          lazyUpdate={true}
        />
      </div>
    </div>
  );
};

