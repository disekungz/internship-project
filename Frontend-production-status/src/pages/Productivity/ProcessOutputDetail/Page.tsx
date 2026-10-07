import React from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BASE } from "../../../routes/config";
import { DailyDetailList, FilterBar, SummaryTable } from "./components";

import { useProcessOutputData } from "./hooks/useProcessOutputData";

const ProcessOutputDetail: React.FC = () => {
  const navigate = useNavigate();
  const {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    selectedFactory,
    setSelectedFactory,
    selectedLineGroup,
    setSelectedLineGroup,
    selectedUnit,
    setSelectedUnit,
    lineGroups,
    rows,
    isLoading,
    errorMessage,
    fetchLineGroupOutput,
    totals,
    visibleLineGroups,
    cutoffYesterday,
  } = useProcessOutputData();

  return (
    <div className="w-full h-full p-4 lg:p-6 overflow-y-auto overflow-x-hidden bg-gradient-to-br from-base-200/80 via-base-100 to-base-300/80 flex flex-col gap-5 relative">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="btn btn-sm rounded-xl bg-base-100 hover:bg-base-200 border border-base-300/80 shadow-md hover:shadow-lg transition-all font-bold text-base-content text-xs px-4 h-10 gap-2 flex items-center"
          onClick={() => {
            navigate(`${BASE}/productivity/productivity-smart-report`);
          }}
        >
          <ArrowLeft size={16} className="text-primary" />
          <span>Back to Productivity Smart Report</span>
          <span className="badge badge-sm badge-primary badge-outline text-[10px] font-bold ml-1">Main Report</span>
        </button>
      </div>

      <FilterBar
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        selectedFactory={selectedFactory}
        setSelectedFactory={setSelectedFactory}
        selectedLineGroup={selectedLineGroup}
        setSelectedLineGroup={setSelectedLineGroup}
        selectedUnit={selectedUnit}
        setSelectedUnit={setSelectedUnit}
        cutoffYesterday={cutoffYesterday}
        lineGroups={lineGroups}
        isLoading={isLoading}
        onSearch={fetchLineGroupOutput}
      />


      <SummaryTable
        visibleLineGroups={visibleLineGroups}
        totals={totals}
        selectedUnit={selectedUnit}
        rows={rows}
        isLoading={isLoading}
      />
      <DailyDetailList
        rows={rows}
        isLoading={isLoading}
        selectedUnit={selectedUnit}
        errorMessage={errorMessage}
      />
    </div>
  );
};

export default ProcessOutputDetail;
