import React, { useMemo } from "react";
import * as echarts from "echarts";
import { BaseEChart } from "@/components/common/BaseEChart";

/** โครงสร้างข้อมูลแต่ละ Process ในกราฟ */
interface ChartDataItem {
  name: string;
  group: string;
  less1: number;
  range1to3: number;
  more3: number;
  total: number;
}

/** โครงสร้างระบุขอบเขตและจำนวนสมาชิกของแต่ละกลุ่ม */
interface GroupBoundary {
  group: string;
  count: number;
}

interface WipOverallEChartProps {
  data: ChartDataItem[];
  groupBoundaries: GroupBoundary[];
  selectedProcesses: string[];
  onProcessToggle: (processName: string) => void;
  maxAxisY: number;
}

/**
 * คอมโพเนนต์กราฟแท่งแสดงข้อมูล WIP รวม (WIP Overall EChart)
 * - รองรับ Stacked Bar (<1 วัน, 1-3 วัน, >3 วัน)
 * - ปรับ dynamic bar width ตามจำนวน Process
 * - มี Group boundary เส้นแบ่งกลุ่มชัดเจน
 */
export const WipOverallEChart: React.FC<WipOverallEChartProps> = ({
  data,
  groupBoundaries,
  selectedProcesses,
  onProcessToggle,
  maxAxisY,
}) => {
  const option = useMemo(() => {
    const processNames = data.map((d) => d.name);
    const less1Data = data.map((d) => d.less1);
    // แปลงค่าความสูงขั้นต่ำ 5px ให้อยู่ในหน่วยข้อมูล เพื่อให้แท่งขนาดเล็กยังมองเห็นได้
    const MIN_VISIBLE_VALUE = Math.max(1, (maxAxisY * 5) / 350);

    const displayLess1 = data.map((d) => (d.less1 > 0 ? Math.max(d.less1, MIN_VISIBLE_VALUE) : 0));
    const displayRange1to3 = data.map((d) => (d.range1to3 > 0 ? Math.max(d.range1to3, MIN_VISIBLE_VALUE) : 0));
    const displayMore3 = data.map((d) => (d.more3 > 0 ? Math.max(d.more3, MIN_VISIBLE_VALUE) : 0));

    // คำนวณความกว้างแท่งกราฟ (Bar Width) อัตโนมัติตามจำนวนแท่งที่มี เพื่อความสวยงามและไม่ทับซ้อน
    const barCount = Math.max(1, data.length);
    let dynamicBarWidth = 10;
    if (barCount === 1) {
      dynamicBarWidth = 220; // แท่งเดี่ยว ขนาดเด่นชัด
    } else if (barCount === 2) {
      dynamicBarWidth = 140;
    } else if (barCount === 3) {
      dynamicBarWidth = 100;
    } else if (barCount === 4) {
      dynamicBarWidth = 80;
    } else if (barCount <= 6) {
      dynamicBarWidth = 60;
    } else if (barCount <= 10) {
      dynamicBarWidth = 42;
    } else if (barCount <= 18) {
      dynamicBarWidth = 28;
    } else if (barCount <= 30) {
      dynamicBarWidth = 18;
    } else if (barCount <= 50) {
      dynamicBarWidth = 12;
    } else if (barCount <= 75) {
      dynamicBarWidth = 9;
    } else {
      dynamicBarWidth = Math.max(5, Math.min(8, Math.round(580 / barCount)));
    }

    return {

      animation: false, // ปิด Animation ตอนโหลดเริ่มต้นเพื่อการเรนเดอร์ทันทีไม่มีกระตุก
      animationDurationUpdate: 100, // ความเร็วอัปเดตแอนิเมชันให้สมูท
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
          shadowStyle: {
            color: "rgba(99, 102, 241, 0.08)",
          },
        },
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "#334155",
        borderWidth: 1,
        padding: [10, 14],
        textStyle: {
          color: "#ffffff",
          fontSize: 12,
        },
        formatter: (params: any[]) => {
          if (!params || !params.length) return "";
          const dataIndex = params[0].dataIndex;
          const item = data[dataIndex];
          if (!item) return "";

          return `
            <div style="font-weight: 800; border-bottom: 1px solid #334155; padding-bottom: 4px; margin-bottom: 6px; color: #f1f5f9;">
              ${item.name} <span style="font-size: 11px; font-weight: normal; color: #94a3b8;">(${item.group})</span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 3px;">
              <span style="display: flex; align-items: center; gap: 6px; color: #bae6fd;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: #0284c7;"></span>
                Less 1 Day:
              </span>
              <b>${item.less1} lots</b>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 3px;">
              <span style="display: flex; align-items: center; gap: 6px; color: #e9d5ff;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: #9333ea;"></span>
                More 1 Day:
              </span>
              <b>${item.range1to3} lots</b>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px;">
              <span style="display: flex; align-items: center; gap: 6px; color: #fed7aa;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: #f97316;"></span>
                More 3 Days:
              </span>
              <b>${item.more3} lots</b>
            </div>
            <div style="border-top: 1px solid #334155; padding-top: 5px; font-weight: 800; color: #fbbf24; display: flex; justify-content: space-between;">
              <span>Total:</span>
              <span>${item.total.toLocaleString()}</span>
            </div>
          `;
        },
      },
      grid: {
        top: 35,
        left: 45,
        right: 0,
        bottom: 135, // เว้นระยะด้านล่างเพื่อให้ชื่อ Process ที่หมุนแนวตั้งไม่ชนกับแถบแบ่งกลุ่ม
        containLabel: false,
      },
      xAxis: {
        type: "category",
        data: processNames,
        boundaryGap: true,
        axisLine: {
          lineStyle: {
            color: "#e2e8f0",
          },
        },
        axisTick: {
          alignWithLabel: true,
          lineStyle: {
            color: "#cbd5e1",
          },
        },
        axisLabel: {
          interval: 0,
          rotate: 90,
          margin: 8,
          fontSize: 10.5,
          fontWeight: 800,
          color: (value: string) =>
            selectedProcesses.includes(value) ? "#4338ca" : "#334155",
          formatter: (value: string) => value,
        },
      },
      yAxis: {
        type: "value",
        max: maxAxisY,
        name: "TOTAL LOT",
        nameLocation: "middle",
        nameGap: 45,
        nameTextStyle: {
          color: "#334155",
          fontWeight: 900,
          fontSize: 11,
          letterSpacing: 1,
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: "#cbd5e1",
          },
        },
        splitLine: {
          lineStyle: {
            type: "dashed",
            color: "#e2e8f0",
          },
        },
        axisLabel: {
          fontSize: 11,
          fontWeight: 800,
          color: "#334155",
        },
      },
      series: [
        // ล่างสุด: Less 1 Day (Gradient สีน้ำเงินทรงกระบอก)
        {
          name: "Less 1 Day",
          type: "bar",
          stack: "total",
          barMaxWidth: 100,
          barMinWidth: 6,
          barCategoryGap: "18%",
          large: true,
          largeThreshold: 2000,
          sampling: "lttb",
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "#2563eb" },
              { offset: 0.35, color: "#60a5fa" },
              { offset: 1, color: "#1d4ed8" },
            ]),
          },
          data: displayLess1,
        },
        // ตรงกลาง: More 1 Day (Gradient สีม่วงทรงกระบอก)
        {
          name: "More 1 Day",
          type: "bar",
          stack: "total",
          barMaxWidth: 100,
          barMinWidth: 6,
          barCategoryGap: "18%",
          large: true,
          largeThreshold: 2000,
          sampling: "lttb",
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "#7c3aed" },
              { offset: 0.35, color: "#a78bfa" },
              { offset: 1, color: "#5b21b6" },
            ]),
          },
          data: displayRange1to3,
        },
        // บนสุด: More 3 Days (Gradient สีส้มทรงกระบอก)
        {
          name: "More 3 Days",
          type: "bar",
          stack: "total",
          barMaxWidth: 100,
          barMinWidth: 6,
          barCategoryGap: "18%",
          large: true,
          largeThreshold: 2000,
          sampling: "lttb",
          itemStyle: {
            borderRadius: 0,
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "#ea580c" },
              { offset: 0.35, color: "#fb923c" },
              { offset: 1, color: "#c2410c" },
            ]),
          },
          data: displayMore3,
        },
        // ป้ายแสดงยอด Total ด้านบนของแต่ละแท่ง Stack
        {
          name: "TotalLabel",
          type: "custom",
          renderItem: (params: any, api: any) => {
            const rawTotal = data[params.dataIndex]?.total || 0;
            if (rawTotal <= 0) return null;

            const visualTotal =
              displayLess1[params.dataIndex] +
              displayRange1to3[params.dataIndex] +
              displayMore3[params.dataIndex];

            const point = api.coord([params.dataIndex, visualTotal]);
            const isSelected = selectedProcesses.includes(processNames[params.dataIndex]);

            return {
              type: "text",
              x: point[0],
              y: point[1] - 6,
              style: {
                text: rawTotal.toLocaleString(),
                fill: isSelected ? "#4338ca" : "#1e293b",
                font: `900 11px system-ui, -apple-system, sans-serif`,
                textAlign: "center",
                textVerticalAlign: "bottom",
              },
            };
          },
          data: data.map((d) => d.total),
          z: 10,
        },
        // แถบและเส้นแบ่งกลุ่ม Group Header ด้านล่างพิกัดกราฟ
        {
          name: "GroupDivider",
          type: "custom",
          renderItem: (params: any, api: any) => {
            if (params.dataIndex !== 0) return null; // วาดเพียงครั้งเดียว
            if (!data.length) return null;

            const children: any[] = [];
            const gridBottom = api.getHeight() - 40; // ขอบล่างของพื้นที่กราฟ
            const gridLeft = 45;
            const gridRight = api.getWidth();
            const totalWidth = gridRight - gridLeft;

            // แถบพื้นหลังความกว้างเต็ม
            children.push({
              type: "rect",
              shape: {
                x: gridLeft,
                y: gridBottom,
                width: totalWidth,
                height: 36,
              },
              style: {
                fill: "rgba(248, 250, 252, 0.9)",
                stroke: "#cbd5e1",
                lineWidth: 1,
              },
            });

            let accumulatedCount = 0;
            const totalCount = data.length;

            groupBoundaries.forEach((gb, idx) => {
              if (gb.count === 0) return;
              const startIdx = accumulatedCount;
              const endIdx = accumulatedCount + gb.count;
              accumulatedCount += gb.count;

              const segLeft = gridLeft + (startIdx / totalCount) * totalWidth;
              const segRight = gridLeft + (endIdx / totalCount) * totalWidth;
              const center = (segLeft + segRight) / 2;

              // เส้นแนวตั้งแบ่งระหว่างกลุ่ม
              if (idx > 0) {
                children.push({
                  type: "line",
                  shape: {
                    x1: segLeft,
                    y1: gridBottom,
                    x2: segLeft,
                    y2: gridBottom + 36,
                  },
                  style: {
                    stroke: "#94a3b8",
                    lineWidth: 1.5,
                  },
                });
              }

              // ป้ายชื่อกลุ่มตรงกึ่งกลาง
              children.push({
                type: "text",
                x: center,
                y: gridBottom + 18,
                style: {
                  text: gb.group,
                  fill: "#475569",
                  font: "bold 11px Inter, sans-serif",
                  textAlign: "center",
                  textVerticalAlign: "middle",
                },
              });
            });

            return {
              type: "group",
              children,
            };
          },
          data: [0],
          z: 5,
        },
      ],
    };
  }, [data, selectedProcesses, maxAxisY, groupBoundaries]);

  const onEvents = useMemo(
    () => ({
      click: (params: any) => {
        if (params && params.name) {
          onProcessToggle(params.name);
        }
      },
    }),
    [onProcessToggle]
  );

  return (
    <div className="w-full relative">
      <div className="w-full h-[56vh] min-h-[500px] max-h-[660px] relative">
        <BaseEChart
          option={option}
          onEvents={onEvents}
          style={{ height: "100%", width: "100%" }}
          notMerge={true}
          lazyUpdate={true}
        />
      </div>
      <div className="w-full text-center font-bold text-slate-500 text-sm mt-3">
        Process
      </div>
    </div>
  );
};
