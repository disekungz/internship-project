/* ==========================================================================
   TotalAllLabel - แสดงตัวเลข total_all (ไม่ filter lot_status) เหนือแท่งกราฟ
   ใช้สำหรับแสดงตัวเลขรวมทั้งหมดเมื่อมีการ filter lot_status
   ========================================================================== */
export const TotalAllLabel = (props: any) => {
    const { x, y, width, value, index } = props;
    if (value === undefined || value === null || Number(value) === 0) return null;

    const valStr = Number(value).toLocaleString();
    const charCount = valStr.length;

    const rectWidth = 16;
    const rectHeight = Math.max(32, charCount * 5.5 + 8);
    const cx = x + width / 2;
    const rx = cx - rectWidth / 2;

    // สลับตำแหน่ง เหมือน TotalLabel แต่เพิ่ม offset เพื่อให้อยู่เหนือ TotalLabel
    const isEven = index % 2 === 0;
    const baseOffset = isEven ? 8 : 20;
    const topPadding = 4;
    const targetRy = y - rectHeight - baseOffset;
    const ry = Math.max(targetRy, topPadding);
    const textY = ry + rectHeight / 2;

    return (
        <g>
            {/* เส้นเชื่อมลงมา */}
            <line
                x1={cx}
                y1={ry + rectHeight}
                x2={cx}
                y2={y - rectHeight - baseOffset - 2}
                stroke="#94a3b8"
                strokeWidth={1}
                strokeDasharray="2 2"
                strokeOpacity={0.6}
            />
            {/* กล่อง */}
            <rect
                x={rx}
                y={ry}
                width={rectWidth}
                height={rectHeight}
                rx={4}
                fill="#f1f5f9"
                stroke="#cbd5e1"
                strokeWidth={1}
            />
            <text
                x={cx}
                y={textY}
                textAnchor="middle"
                dominantBaseline="middle"
                dy="0.3em"
                fontSize={8.5}
                fontWeight={600}
                fill="#475569"
                transform={`rotate(-90, ${cx}, ${textY})`}
            >
                {valStr}
            </text>
        </g>
    );
};
