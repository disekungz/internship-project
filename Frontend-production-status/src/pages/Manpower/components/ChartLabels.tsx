/**
 * Component: ChartLabels
 * ป้ายกำกับตัวเลขบนแท่งกราฟ (SVG Chart Labels)
 * - GraphValueLabel: ป้ายตัวเลขบนยอดแท่งกราฟเดี่ยว
 * - StackValueLabel: ป้ายตัวเลขตรงกลางแท่งกราฟซ้อน (Stacked Bar)
 * - LeaveRateLabel: ป้ายเปอร์เซ็นต์อัตราการขาด/ลา (Leave Rate %)
 */
interface ChartLabelProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number | string;
}

/** แสดงป้ายตัวเลขบนยอดแท่งกราฟ */
export function GraphValueLabel({ x = 0, y = 0, width = 0, value }: ChartLabelProps) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue === 0) return null;
  const label = numericValue.toLocaleString();
  const estimatedWidth = label.length * 6;
  const centeredX = Number(x) + Number(width) / 2;
  const plotLeftEdge = 92;
  const labelX = centeredX - estimatedWidth / 2 < plotLeftEdge ? plotLeftEdge + estimatedWidth / 2 : centeredX;
  return <text x={labelX} y={Number(y) - 8} textAnchor="middle" fill="#334155" fontSize={10} fontWeight={700}>{label}</text>;
}

/** แสดงป้ายตัวเลขตรงกลางแท่งกราฟซ้อน */
export function StackValueLabel({ x = 0, y = 0, width = 0, height = 0, value }: ChartLabelProps) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  return <text x={Number(x) + Number(width) / 2} y={Number(y) + Number(height) / 2 + 4} textAnchor="middle" fill="#ffffff" fontSize={11} fontWeight={800}>{numericValue.toLocaleString()}</text>;
}

/** แสดงป้ายเปอร์เซ็นต์อัตราการขาด/ลา */
export function LeaveRateLabel({ x = 0, y = 0, width = 0, value }: ChartLabelProps) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  const label = `Leave ${numericValue.toFixed(1)}%`;
  const centerX = Number(x) + Number(width) / 2;
  const labelWidth = Math.max(58, label.length * 6.2);
  return (
    <g>
      <rect x={centerX - labelWidth / 2} y={Number(y) - 36} width={labelWidth} height={17} rx={5} fill="#ffffff" stroke="#fecdd3" />
      <text x={centerX} y={Number(y) - 24} textAnchor="middle" fill="#be123c" fontSize={10} fontWeight={800}>{label}</text>
    </g>
  );
}
