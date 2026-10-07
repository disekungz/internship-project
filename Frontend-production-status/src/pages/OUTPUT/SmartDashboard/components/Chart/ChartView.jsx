import React from 'react';
import EFPCChartViewWithUnit from "./EFPCChartViewWithUnit";
import SMTChartViewWithUnit from "./SMTChartViewWithUnit";

export default function ChartView(props) {
  if (props.selectedProcess === 'SMT' || props.selectedProcess === 'SMT_F') {
    return <SMTChartViewWithUnit {...props} />;
  }
  return <EFPCChartViewWithUnit {...props} />;
}
