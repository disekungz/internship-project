import React, { useMemo } from "react";
import * as echarts from "echarts";
import { DayItem } from "../types";
import { BaseEChart } from "@/components/common/BaseEChart";

interface Props {
  activeGroup: string;
  month: string;
  daysData: DayItem[];
  loading?: boolean;
}

export const RecruitResignChart: React.FC<Props> = ({ activeGroup, month, daysData, loading }) => {
  const option = useMemo<echarts.EChartsOption>(() => {
    if (daysData.length === 0) return {};

    const categories = daysData.map((d) => {
      try {
        const dt = new Date(`${d.date}T00:00:00`);
        const mShort = dt.toLocaleDateString("en-US", { month: "short" });
        return `${d.day}-${mShort}`;
      } catch {
        return `${d.day}-Sep`;
      }
    });

    const recruitData = daysData.map((d) => (d.hasData && d.recruit !== null && d.recruit > 0 ? d.recruit : null));
    const resignData = daysData.map((d) => (d.hasData && d.resign !== null ? d.resign : null));
    const accRecruitData = daysData.map((d) => (d.hasData && d.accRecruit !== null && d.accRecruit > 0 ? d.accRecruit : null));

    const maxVal = Math.max(
      ...daysData
        .filter((d) => d.hasData)
        .map((d) => Math.max(d.accRecruit || 0, d.recruit || 0, d.resign || 0)),
      10
    );

    let yMax = 300;
    let interval = 50;

    if (maxVal > 1000) {
      yMax = Math.ceil((maxVal * 1.15) / 200) * 200;
      interval = 200;
    } else if (maxVal > 400) {
      yMax = Math.ceil((maxVal * 1.15) / 100) * 100;
      interval = 100;
    } else if (maxVal > 150) {
      yMax = Math.ceil((maxVal * 1.15) / 50) * 50;
      interval = 50;
    } else if (maxVal > 50) {
      yMax = Math.ceil((maxVal * 1.2) / 20) * 20;
      interval = 20;
    } else {
      yMax = Math.max(30, Math.ceil((maxVal * 1.2) / 10) * 10);
      interval = 10;
    }

    const mDate = new Date(`${month}-01T00:00:00`);
    const mStr = mDate.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
    const yrStr = month.slice(2, 4);

    return {
      title: {
        text: `Recruit & Resign ${activeGroup}: ${mStr}.${yrStr}`,
        left: "center",
        top: 8,
        textStyle: {
          fontSize: 16,
          fontWeight: "bold",
          color: "#1e293b",
          fontFamily: "Inter, Roboto, sans-serif",
        },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(255, 255, 255, 0.98)",
        borderColor: "#cbd5e1",
        borderWidth: 1,
        padding: [10, 14],
        textStyle: {
          color: "#0f172a",
          fontSize: 12,
        },
      },
      legend: {
        top: 36,
        data: ["Recruit (person)", "Acc. Recruit (person)", "Resign (person)"],
        textStyle: { fontWeight: "600", color: "#334155", fontSize: 12 },
      },
      grid: {
        left: "3%",
        right: "3%",
        bottom: "10%",
        top: "20%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: categories,
        axisLabel: {
          interval: 0,
          rotate: 45,
          fontSize: 10,
          fontWeight: "600",
          color: "#475569",
        },
        axisTick: { alignWithLabel: true },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: yMax,
        interval: interval,
        name: "PS",
        nameTextStyle: { fontWeight: "bold", color: "#334155", padding: [0, 20, 0, 0] },
        axisLabel: {
          fontSize: 11,
          fontWeight: "500",
          color: "#475569",
          formatter: (val: number) => val.toLocaleString(),
        },
        splitLine: { lineStyle: { type: "solid", color: "#e2e8f0" } },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
      },
      series: [
        {
          name: "Recruit (person)",
          type: "bar",
          data: recruitData,
          barMaxWidth: 22,
          itemStyle: {
            color: "#8cb4e2",
            borderColor: "#41719c",
            borderWidth: 1,
            borderRadius: [2, 2, 0, 0],
          },
          label: {
            show: true,
            position: "top",
            distance: 4,
            align: "center",
            verticalAlign: "bottom",
            fontSize: 11,
            fontWeight: "bold",
            color: "#002060",
            formatter: (p: any) => (p.value > 0 ? p.value : ""),
          },
          z: 3,
        },
        {
          name: "Acc. Recruit (person)",
          type: "line",
          data: accRecruitData,
          showSymbol: true,
          symbol: "diamond",
          symbolSize: 8,
          connectNulls: false,
          lineStyle: { color: "#c55a11", width: 2 },
          itemStyle: { color: "#c55a11" },
          label: {
            show: true,
            position: "top",
            distance: 6,
            align: "center",
            verticalAlign: "bottom",
            fontSize: 11,
            fontWeight: "bold",
            color: "#833c0c",
            formatter: (p: any) => (p.value !== null && p.value !== undefined ? p.value : ""),
          },
          z: 4,
        },
        {
          name: "Resign (person)",
          type: "line",
          data: resignData,
          showSymbol: true,
          symbol: "circle",
          symbolSize: 6,
          connectNulls: false,
          lineStyle: { color: "#c00000", width: 1.5 },
          itemStyle: { color: "#ffffff", borderColor: "#c00000", borderWidth: 1.5 },
          label: {
            show: true,
            position: "top",
            distance: 5,
            align: "center",
            verticalAlign: "bottom",
            fontSize: 11,
            fontWeight: "bold",
            color: "#c00000",
            formatter: (p: any) => (p.value !== null && p.value !== undefined && p.value > 0 ? p.value : ""),
          },
          z: 5,
        },
      ],
    };
  }, [daysData, month, activeGroup]);

  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm overflow-hidden">
      <div className="w-full h-[380px]">
        <BaseEChart
          option={option}
          loading={loading}
          style={{ width: "100%", height: "380px" }}
          notMerge={true}
          lazyUpdate={true}
        />
      </div>
    </div>
  );
};
