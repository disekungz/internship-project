import React, { useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { CHART_COLORS } from './chartColors';

const formatValue = (value) => {
  if (value === null || value === undefined || value === 0) return '';
  const num = Number(value);
  if (isNaN(num) || num === 0) return '';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return Math.round(num / 1000) + 'K';
  }
  return num.toLocaleString();
};

export default function EFPCChartViewWithUnit({
  data = [],
  setSelectedDateData,
  selectedUnit = 'Piece',
  height = 400,
  isExpanded = false
}) {
  const chartRef = useRef(null);

  // Field resolution based on selectedUnit
  const { actualKey, targetKey, accActualKey, accTargetKey } = useMemo(() => {
    if (selectedUnit === 'Sheet') {
      return {
        actualKey: 'sht_qty',
        targetKey: 'target_sht_qty',
        accActualKey: 'accumulated_sht',
        accTargetKey: 'accumulated_target_sht'
      };
    } else if (selectedUnit === 'Lot') {
      return {
        actualKey: 'lot_qty',
        targetKey: 'target_lot_qty',
        accActualKey: 'accumulated_lot',
        accTargetKey: 'accumulated_target_lot'
      };
    }
    return {
      actualKey: 'pcs_qty',
      targetKey: 'target_qty',
      accActualKey: 'accumulated_pcs',
      accTargetKey: 'accumulated_target'
    };
  }, [selectedUnit]);

  // Build Apache ECharts options
  const option = useMemo(() => {
    if (!data || data.length === 0) return {};

    const dates = data.map(item => item.name || item.date || '');
    const dailyTargetData = data.map(item => Number(item[targetKey] || 0));
    const dailyActualData = data.map(item => Number(item[actualKey] || 0));
    const accTargetData = data.map(item => Number(item[accTargetKey] || 0));
    const accActualData = data.map(item => (item[accActualKey] !== null && item[accActualKey] !== undefined ? Number(item[accActualKey]) : null));

    const tickFontSize = isExpanded ? 13 : 11;
    const labelFontSize = isExpanded ? 11 : 9.5;

    return {
      backgroundColor: 'transparent',
      animationDuration: 400,
      animationEasing: 'cubicOut',
      animationDurationUpdate: 400,
      animationEasingUpdate: 'cubicOut',
      grid: {
        top: isExpanded ? 75 : 65,
        left: '2.5%',
        right: '2.5%',
        bottom: isExpanded ? 50 : 35,
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          crossStyle: { color: '#94a3b8' },
          lineStyle: { color: '#6366f1', type: 'dashed' }
        },
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: { color: '#1e293b', fontFamily: 'Inter, sans-serif' },
        extraCssText: 'box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); border-radius: 10px;',
        formatter: (params) => {
          if (!params || params.length === 0) return '';
          const idx = params[0].dataIndex;
          const rowData = data[idx] || {};
          const dateStr = dates[idx];

          const dTarget = Number(rowData[targetKey] || 0);
          const dActual = Number(rowData[actualKey] || 0);
          const aTarget = Number(rowData[accTargetKey] || 0);
          const rawActual = rowData[accActualKey];
          const hasAccActual = rawActual !== null && rawActual !== undefined;
          const aActual = hasAccActual ? Number(rawActual) : null;
          const lotQty = Number(rowData.lot_qty || 0);

          const dailyDiff = dTarget > 0 ? ((dActual - dTarget) / dTarget) * 100 : 0;
          const accDiff = (aTarget > 0 && aActual !== null) ? ((aActual - aTarget) / aTarget) * 100 : 0;

          const diffBadge = (diff) => {
            if (diff >= 0) {
              return `<span style="color: #16a34a; font-weight: 600;">+${diff.toFixed(1)}%</span>`;
            }
            return `<span style="color: #dc2626; font-weight: 600;">${diff.toFixed(1)}%</span>`;
          };

          return `
            <div style="font-family: Inter, sans-serif; min-width: 220px;">
              <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">
                Date: ${dateStr}
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px;">
                <span style="color: ${CHART_COLORS.target_qty_label || CHART_COLORS.target_qty};"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${CHART_COLORS.target_qty};margin-right:6px;"></span>Target:</span>
                <span style="font-weight: 600; color: #0f172a;">${dTarget.toLocaleString()} ${selectedUnit}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px;">
                <span style="color: ${CHART_COLORS.pcs_qty_label || CHART_COLORS.pcs_qty};"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${CHART_COLORS.pcs_qty};margin-right:6px;"></span>Actual:</span>
                <span style="font-weight: 600; color: #0f172a;">${dActual.toLocaleString()} ${selectedUnit} ${dTarget > 0 ? `(${diffBadge(dailyDiff)})` : ''}</span>
              </div>
              <div style="border-top: 1px dashed #e2e8f0; margin: 6px 0;"></div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px;">
                <span style="color: ${CHART_COLORS.accumulated_target};"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${CHART_COLORS.accumulated_target};margin-right:6px;"></span>Acc Target:</span>
                <span style="font-weight: 600; color: #0f172a;">${aTarget.toLocaleString()} ${selectedUnit}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px;">
                <span style="color: ${CHART_COLORS.accumulated_pcs};"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${CHART_COLORS.accumulated_pcs};margin-right:6px;"></span>Acc Actual:</span>
                <span style="font-weight: 700; color: #0f172a;">${aActual !== null ? `${aActual.toLocaleString()} ${selectedUnit} ${aTarget > 0 ? `(${diffBadge(accDiff)})` : ''}` : '-'}</span>
              </div>
              ${lotQty > 0 && selectedUnit !== 'Lot' ? `
                <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #64748b;">
                  Actual Lot: <strong style="color: ${CHART_COLORS.lot_qty || '#003366'};">${lotQty.toLocaleString()} Lot</strong>
                </div>
              ` : ''}
            </div>
          `;
        }
      },
      legend: {
        top: isExpanded ? 15 : 10,
        icon: 'roundRect',
        itemGap: 18,
        textStyle: {
          color: 'currentColor',
          fontSize: isExpanded ? 14 : 12,
          fontFamily: 'Inter, sans-serif'
        },
        data: [
          `Daily Target (${selectedUnit})`,
          `Daily Actual (${selectedUnit})`,
          `Accumulated Target (${selectedUnit})`,
          `Accumulated Actual (${selectedUnit})`
        ]
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisTick: { alignWithLabel: true, lineStyle: { color: '#cbd5e1' } },
        axisLabel: {
          interval: 0,
          rotate: 45,
          color: '#64748b',
          fontSize: tickFontSize,
          fontFamily: 'Inter, sans-serif'
        }
      },
      yAxis: [
        {
          type: 'value',
          name: `Daily (${selectedUnit})`,
          nameTextStyle: { color: '#64748b', fontSize: 11, padding: [0, 0, 4, 0] },
          position: 'left',
          max: (value) => (value.max > 0 ? Math.ceil(value.max * 1.18) : 100),
          splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
          axisLabel: {
            color: '#64748b',
            fontSize: tickFontSize,
            formatter: (v) => formatValue(v) || '0'
          }
        },
        {
          type: 'value',
          name: `Accumulated (${selectedUnit})`,
          nameTextStyle: { color: '#7030a0', fontSize: 11, padding: [0, 0, 4, 0] },
          position: 'right',
          max: (value) => (value.max > 0 ? Math.ceil(value.max * 1.08) : 100),
          splitLine: { show: false },
          axisLabel: {
            color: '#7030a0',
            fontSize: tickFontSize,
            formatter: (v) => formatValue(v) || '0'
          }
        }
      ],
      series: [
        {
          name: `Daily Target (${selectedUnit})`,
          type: 'bar',
          barGap: '15%',
          barCategoryGap: '30%',
          yAxisIndex: 0,
          data: dailyTargetData,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: CHART_COLORS.target_qty_gradient_start || CHART_COLORS.target_qty },
              { offset: 1, color: CHART_COLORS.target_qty_gradient_end || CHART_COLORS.target_qty }
            ]),
            borderRadius: [3, 3, 0, 0]
          },
          labelLayout: {
            hideOverlap: true
          },
          label: {
            show: true,
            position: 'top',
            distance: 6,
            rotate: 90,
            align: 'left',
            verticalAlign: 'middle',
            color: CHART_COLORS.target_qty_label || CHART_COLORS.target_qty,
            fontSize: labelFontSize,
            fontWeight: '600',
            formatter: (p) => (p.value > 0 ? formatValue(p.value) : '')
          }
        },
        {
          name: `Daily Actual (${selectedUnit})`,
          type: 'bar',
          yAxisIndex: 0,
          data: dailyActualData,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: CHART_COLORS.pcs_qty_gradient_start || CHART_COLORS.pcs_qty },
              { offset: 1, color: CHART_COLORS.pcs_qty_gradient_end || CHART_COLORS.pcs_qty }
            ]),
            borderRadius: [3, 3, 0, 0]
          },
          labelLayout: {
            hideOverlap: true
          },
          label: {
            show: true,
            position: 'top',
            distance: 6,
            rotate: 90,
            align: 'left',
            verticalAlign: 'middle',
            color: CHART_COLORS.pcs_qty_label || CHART_COLORS.pcs_qty,
            fontSize: labelFontSize,
            fontWeight: '600',
            formatter: (p) => (p.value > 0 ? formatValue(p.value) : '')
          }
        },
        {
          name: `Accumulated Target (${selectedUnit})`,
          type: 'line',
          yAxisIndex: 1,
          data: accTargetData,
          smooth: true,
          symbol: 'circle',
          symbolSize: isExpanded ? 7 : 5,
          lineStyle: { width: 2.5, color: CHART_COLORS.accumulated_target },
          itemStyle: { color: CHART_COLORS.accumulated_target, borderWidth: 2, borderColor: '#ffffff' },
          labelLayout: {
            hideOverlap: true,
            moveOverlap: 'shiftY'
          },
          label: {
            show: true,
            position: 'top',
            distance: 7,
            color: CHART_COLORS.accumulated_target,
            fontSize: labelFontSize,
            fontWeight: '700',
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderColor: '#fecaca',
            borderWidth: 1,
            padding: [2, 4],
            borderRadius: 4,
            formatter: (p) => {
              const val = Number(p.value);
              const idx = p.dataIndex;
              if (!val || val === 0) return '';
              if (idx > 0 && accTargetData[idx - 1] === val) return '';
              return formatValue(val);
            }
          }
        },
        {
          name: `Accumulated Actual (${selectedUnit})`,
          type: 'line',
          yAxisIndex: 1,
          data: accActualData,
          smooth: true,
          symbol: 'circle',
          symbolSize: isExpanded ? 7 : 5,
          lineStyle: { width: 3, color: CHART_COLORS.accumulated_pcs },
          itemStyle: { color: CHART_COLORS.accumulated_pcs, borderWidth: 2, borderColor: '#ffffff' },
          labelLayout: {
            hideOverlap: true,
            moveOverlap: 'shiftY'
          },
          label: {
            show: true,
            position: 'bottom',
            distance: 7,
            color: CHART_COLORS.accumulated_pcs,
            fontSize: labelFontSize,
            fontWeight: '700',
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderColor: '#bbf7d0',
            borderWidth: 1,
            padding: [2, 4],
            borderRadius: 4,
            formatter: (p) => {
              const val = Number(p.value);
              const idx = p.dataIndex;
              if (!val || val === 0) return '';
              if (idx > 0 && accActualData[idx - 1] === val) return '';
              return formatValue(val);
            }
          }
        }
      ]
    };
  }, [data, actualKey, targetKey, accActualKey, accTargetKey, selectedUnit, isExpanded]);

  const handleEvents = useMemo(() => ({
    click: (params) => {
      if (params && params.dataIndex !== undefined && setSelectedDateData) {
        const clickedData = data[params.dataIndex];
        setSelectedDateData(prev => prev && prev.name === clickedData?.name ? null : clickedData);
      }
    }
  }), [data, setSelectedDateData]);

  return (
    <div style={{ height: height, width: '100%' }}>
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height: '100%', width: '100%' }}
        onEvents={handleEvents}
        notMerge={false}
        lazyUpdate={true}
      />
    </div>
  );
}
