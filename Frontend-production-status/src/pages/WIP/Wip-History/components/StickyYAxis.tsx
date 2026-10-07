import React from "react";

interface StickyYAxisProps {
  yAxisMax: number;
  height?: number;
  width?: number;
  topMargin?: number;
}

export const StickyYAxis: React.FC<StickyYAxisProps> = ({
  yAxisMax,
  height = 600,
  width = 58,
  topMargin = 92,
}) => {
  const bottomMargin = 20; // ตรงกับ WipEChart grid.bottom: 20
  const plotHeight = Math.max(0, height - topMargin - bottomMargin);

  // คำนวณช่วง Tick สเกลให้สวยงามและตรงกับค่าสเกลของ ECharts
  const max = Math.max(1, Math.ceil(yAxisMax));
  
  // สร้าง nice ticks 5-6 ขั้น
  const roughStep = max / 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep || 1)));
  const normalized = roughStep / magnitude;
  let step = magnitude;
  if (normalized > 5) step = 10 * magnitude;
  else if (normalized > 2) step = 5 * magnitude;
  else if (normalized > 1) step = 2 * magnitude;

  const ticks: number[] = [];
  for (let val = 0; val <= max; val += step) {
    ticks.push(val);
  }
  if (ticks[ticks.length - 1] < max) {
    ticks.push(max);
  }

  return (
    <div
      style={{
        position: "sticky",
        left: 44,
        top: 0,
        zIndex: 20,
        width,
        height,
        flex: "none",
        background: "#ffffff",
        borderRight: "1px solid #e2e8f0",
        boxShadow: "2px 0 6px -2px rgba(0,0,0,0.08)",
        userSelect: "none",
      }}
    >
      <svg
        width={width}
        height={height}
        style={{ display: "block", overflow: "visible" }}
      >
        {ticks.map((val) => {
          // คำนวณตำแหน่ง Y พิกัดจากบนลงล่าง
          const ratio = val / max;
          const y = topMargin + plotHeight * (1 - ratio);

          return (
            <g key={val}>
              {/* ขีด Tick Line สั้นๆ ด้านขวา */}
              <line
                x1={width - 5}
                y1={y}
                x2={width}
                y2={y}
                stroke="#cbd5e1"
                strokeWidth={1.5}
              />
              {/* ป้ายตัวเลขสเกล Y */}
              <text
                x={width - 8}
                y={y}
                dy="0.32em"
                textAnchor="end"
                fill="#64748b"
                fontSize={11}
                fontWeight={600}
                fontFamily="Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
              >
                {val.toLocaleString()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

