import React, { useEffect, useState } from "react";
import { X, Layers, Table2, CalendarDays, LayoutGrid } from "lucide-react";
import { DailyDetailList, FilterBar, SummaryTable } from "../../../ProcessOutputDetail/components";
import { useProcessOutputData } from "../../../ProcessOutputDetail/hooks/useProcessOutputData";

export interface ProductivityOutputModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStartDate?: string;
  initialEndDate?: string;
  initialFactory?: string;
}

export const ProductivityOutputModal: React.FC<ProductivityOutputModalProps> = ({
  isOpen,
  onClose,
  initialStartDate,
  initialEndDate,
  initialFactory,
}) => {
  const [viewMode, setViewMode] = useState<"all" | "summary" | "daily">("all");

  const {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    selectedFactory,
    setSelectedFactory,
    selectedLineGroup,
    setSelectedLineGroup,
    facUnit,
    setFacUnit,
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
  } = useProcessOutputData({
    initialStartDate,
    initialEndDate,
    initialFactory,
  });

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-base-100 rounded-2xl shadow-2xl border border-base-300 w-full max-w-[96vw] 2xl:max-w-7xl h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-base-100 border-b border-base-200 flex items-center justify-between shrink-0 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100/80 text-indigo-600 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-base-content whitespace-nowrap">
                  Productivity Output
                </h3>
                <span className="badge badge-sm badge-outline text-[11px] font-semibold text-slate-500 shrink-0">
                  Process & Machine Detail
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-mono font-bold text-slate-700 shrink-0">
                  <CalendarDays size={12} className="text-slate-400" />
                  {startDate === endDate ? startDate : `${startDate} - ${endDate}`}
                </span>
              </div>
              <p className="text-xs text-base-content/60 truncate mt-0.5">
                Breakdown by Line Group, Process Name, Machine Line and Date
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* View Mode Tabs */}
            <div className="hidden md:flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode("all")}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "all"
                    ? "bg-white text-indigo-700 shadow-2xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LayoutGrid size={13} />
                <span>All Views</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("summary")}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "summary"
                    ? "bg-white text-indigo-700 shadow-2xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Table2 size={13} />
                <span>Line Summary</span>
                <span className={`badge badge-xs text-[10px] font-bold px-1.5 ${
                  viewMode === "summary" ? "bg-indigo-100 text-indigo-700 border-none" : "bg-slate-200 text-slate-600 border-none"
                }`}>
                  {visibleLineGroups.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("daily")}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "daily"
                    ? "bg-white text-indigo-700 shadow-2xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CalendarDays size={13} />
                <span>Daily Breakdown</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-sm btn-circle text-base-content/50 hover:text-base-content hover:bg-base-200"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 bg-gradient-to-br from-base-200/60 via-base-100 to-base-300/60 flex flex-col gap-4">
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
            isModalMode={true}
          />

          {/* Section: Summary Table */}
          {(viewMode === "all" || viewMode === "summary") && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <div className="text-xs font-bold text-base-content/70 flex items-center gap-2">
                  <span>Line Group Summary Overview</span>
                  <span className="badge badge-sm border-none bg-base-200 text-[11px] font-semibold">
                    {visibleLineGroups.length} Lines
                  </span>
                </div>
              </div>

              <SummaryTable
                visibleLineGroups={visibleLineGroups}
                totals={totals}
                selectedUnit={selectedUnit}
                rows={rows}
                isLoading={isLoading}
              />
            </div>
          )}

          {/* Section: Daily Detail List */}
          {(viewMode === "all" || viewMode === "daily") && (
            <DailyDetailList
              rows={rows}
              isLoading={isLoading}
              selectedUnit={selectedUnit}
              errorMessage={errorMessage}
            />
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-2.5 bg-base-100 border-t border-base-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-xs text-base-content/60">
            <span>
              Total Records: <strong className="font-mono text-base-content font-bold">{rows.length.toLocaleString()}</strong>
            </span>
            <span className="opacity-40">|</span>
            <span>
              Sector: <strong className="text-base-content font-semibold">{selectedFactory}</strong>
            </span>
            <span className="opacity-40">|</span>
            <span>
              Unit: <strong className="text-base-content font-semibold uppercase">{selectedUnit}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm btn-ghost border border-base-300 text-xs px-5 rounded-xl font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductivityOutputModal;
