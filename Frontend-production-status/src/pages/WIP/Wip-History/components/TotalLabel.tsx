/* ==========================================================================
   TotalLabel - แสดงตัวเลขรวม (Total) เหนือแท่งกราฟแบบหมุน 90 องศา
   hasUpperLabel: เมื่อ true จะอยู่ใกล้แท่งกราฟ (มี TotalAllLabel อยู่ข้างบน)
   ========================================================================== */
export const TotalLabel = (props: any) => {
    const { x, y, width, value, index, hasUpperLabel } = props;
    if (value === undefined || value === null || Number(value) === 0) return null;

    const valStr = Number(value).toLocaleString();
    const charCount = valStr.length;

    const rectWidth = 18;
    const rectHeight = Math.max(35, charCount * 6 + 8);
    const cx = x + width / 2;
    const rx = cx - rectWidth / 2;
    const isEven = index % 2 === 0;
    const offset = isEven ? 8 : 20;
    const topPadding = 4;
    const targetRy = y - rectHeight - offset;
    const ry = Math.max(targetRy, topPadding);
    const textY = ry + rectHeight / 2;

    return (
        <g>
            {!isEven && (
                <line
                    x1={cx}
                    y1={ry + rectHeight}
                    x2={cx}
                    y2={y - 2}
                    stroke="#E5D9A3"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                />
            )}
            <rect
                x={rx}
                y={ry}
                width={rectWidth}
                height={rectHeight}
                rx={4}
                fill="#FBF3D5"
                stroke="#E5D9A3"
            />
            <text
                x={cx}
                y={textY}
                textAnchor="middle"
                dominantBaseline="middle"
                dy="0.3em"
                fontSize={9}
                fontWeight={700}
                fill="#333"
                transform={`rotate(-90, ${cx}, ${textY})`}
            >
                {valStr}
            </text>
        </g>
    );
};
