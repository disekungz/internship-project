import React from "react";
import { Sparkles, ChevronUp, ChevronDown } from "lucide-react";
import { ListSkeleton } from "./Skeletons";
import { UnitMode, ProcessSummary } from "./types";

interface DataTableProps {
  isChartReady: boolean;
  isMcLineLoading: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  selectedProcess: string;
  selectedChartDate: string | null;
  mcLineData: any[];
  sortedMcLineData: any[];
  unitMode: UnitMode;
  getProcessColor: (processName: string) => string;
  summaryData: ProcessSummary[];
  sortedSummaryData: ProcessSummary[];
  handleSort: (field: "sequence" | "output_value") => void;
  renderSortIndicator: (field: "sequence" | "output_value") => React.ReactNode;
  detailsCurrentPage: number;
  detailsItemsPerPage: number;
  setDetailsCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  chartDataAndProcs: {
    dailyChartData: any[];
    activeProcesses: string[];
  };
  setSelectedChartDate: (date: string | null) => void;
  setSelectedProcess: (process: string) => void;
}

export const DataTable: React.FC<DataTableProps> = ({
  isChartReady,
  isMcLineLoading,
  isLoading,
  isRefreshing,
  selectedProcess,
  selectedChartDate,
  mcLineData,
  sortedMcLineData,
  unitMode,
  getProcessColor,
  summaryData,
  sortedSummaryData,
  handleSort,
  renderSortIndicator,
  detailsCurrentPage,
  detailsItemsPerPage,
  setDetailsCurrentPage,
  chartDataAndProcs,
  setSelectedChartDate,
  setSelectedProcess
}) => {
  return (
    <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 overflow-hidden flex-1 relative min-h-[350px]">
      <div className="p-4 border-b border-base-300 flex justify-between items-center bg-base-200/20">
        <h3 className="text-base font-bold text-base-content/90 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          {selectedProcess
            ? `MC Line Details - ${selectedProcess}`
            : selectedChartDate
              ? "Process Output Details"
              : "Daily Data Summary"}
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-base-content/60 font-medium bg-base-200 px-2 py-1 rounded">
            {selectedProcess
              ? `Total MC Lines: ${mcLineData.length}`
              : selectedChartDate
                ? `Total processes: ${summaryData.length}`
                : `Total Days: ${chartDataAndProcs.dailyChartData.length}`}
          </span>
          {selectedProcess && (
            <button
              onClick={() => {
                setSelectedProcess("");
              }}
              className="btn btn-xs btn-ghost border border-base-300 text-base-content/70 hover:bg-base-300/50"
            >
              Back to Processes
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto h-[calc(100%-60px)]">
        {!isChartReady || isMcLineLoading ? (
          <ListSkeleton />
        ) : (
          selectedProcess ? (
            <div className="flex flex-col gap-2 p-2 overflow-y-auto h-full scrollbar-thin">
              {sortedMcLineData.length > 0 ? (
                sortedMcLineData.map((row) => {
                  const color = getProcessColor(selectedProcess);
                  const units = [
                    { key: "Sheet", label: "SHEET", value: row.sum_sht },
                    { key: "Piece", label: "PIECE", value: row.sum_pcs },
                    { key: "Lot", label: "LOT", value: row.sum_lot }
                  ];
                  const activeUnit = units.find(u => u.key === unitMode) || units[0];
                  const otherUnits = units.filter(u => u.key !== unitMode);

                  return (
                    <div
                      key={row.mc_line}
                      className="flex items-center justify-between p-3 rounded-lg border border-base-200 bg-base-100/50 hover:bg-base-200 hover:border-primary/30 transition-all text-left shadow-sm group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                        <div className="w-2.5 h-8 rounded-full shrink-0" style={{ backgroundColor: color }}></div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-sm text-base-content/90 truncate">{row.mc_line}</span>
                          <span className="text-[10px] text-base-content/50 uppercase font-medium">MC Line</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        {otherUnits.map(u => (
                          <div key={u.key} className="flex flex-col items-center min-w-[3.5rem]">
                            <span className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider">{u.label}</span>
                            <span className="text-xs font-mono font-semibold text-base-content/80">{u.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col items-end shrink-0 w-24 pl-3 border-l border-base-300 ml-4">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-primary/70">{activeUnit.label}</span>
                        <span className="font-mono font-bold text-sm text-primary">
                          {activeUnit.value.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center h-full text-base-content/50 p-16">
                  {!isLoading && "No MC Line data available for this process."}
                </div>
              )}
            </div>
          ) : selectedChartDate ? (
            <>
              <table className="table w-full border-collapse">
                <thead className="bg-base-200/60 text-base-content/70 uppercase text-xs sticky top-0 z-10 border-b border-base-300">
                  <tr>
                    <th
                      className="px-6 py-4 font-bold text-left w-[40%] cursor-pointer hover:bg-base-300/30 select-none transition-colors"
                      onClick={() => handleSort("sequence")}
                    >
                      <div className="flex items-center">
                        Process Name {renderSortIndicator("sequence")}
                      </div>
                    </th>
                    <th
                      className={`px-4 py-4 font-bold text-right w-[20%] ${unitMode === "Lot" ? "text-primary cursor-pointer hover:bg-base-300/30" : "text-base-content/50"} select-none text-[10px] tracking-widest transition-colors`}
                      onClick={() => unitMode === "Lot" && handleSort("output_value")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        LOT {unitMode === "Lot" && renderSortIndicator("output_value")}
                      </div>
                    </th>
                    <th
                      className={`px-4 py-4 font-bold text-right w-[20%] ${unitMode === "Sheet" ? "text-primary cursor-pointer hover:bg-base-300/30" : "text-base-content/50"} select-none text-[10px] tracking-widest transition-colors`}
                      onClick={() => unitMode === "Sheet" && handleSort("output_value")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        SHEET {unitMode === "Sheet" && renderSortIndicator("output_value")}
                      </div>
                    </th>
                    <th
                      className={`px-6 py-4 font-bold text-right w-[20%] ${unitMode === "Piece" ? "text-primary cursor-pointer hover:bg-base-300/30" : "text-base-content/50"} select-none text-[10px] tracking-widest transition-colors`}
                      onClick={() => unitMode === "Piece" && handleSort("output_value")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        PIECE {unitMode === "Piece" && renderSortIndicator("output_value")}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!isChartReady || (isLoading && !isRefreshing) ? (
                    <tr>
                      <td colSpan={4} className="p-0 border-0">
                        <ListSkeleton />
                      </td>
                    </tr>
                  ) : sortedSummaryData.length > 0 ? (
                    sortedSummaryData.slice((detailsCurrentPage - 1) * detailsItemsPerPage, detailsCurrentPage * detailsItemsPerPage).map((row) => {
                      const color = getProcessColor(row.process_name);

                      return (
                        <tr key={row.process_name} className="hover:bg-base-200/50 transition-colors border-b border-base-300">
                          <td className="px-6 py-3.5 font-medium text-base-content/90">
                            <div className="flex items-center gap-3">
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: color }}
                              ></span>
                              <span className="font-semibold text-sm">{row.process_name}</span>
                            </div>
                          </td>
                          <td className={`px-4 py-3.5 text-right font-mono text-sm ${unitMode === "Lot" ? "font-bold text-primary" : "text-base-content/70"}`}>
                            {row.sum_lot.toLocaleString()}
                          </td>
                          <td className={`px-4 py-3.5 text-right font-mono text-sm ${unitMode === "Sheet" ? "font-bold text-primary" : "text-base-content/70"}`}>
                            {row.sum_sht.toLocaleString()}
                          </td>
                          <td className={`px-6 py-3.5 text-right font-mono text-sm ${unitMode === "Piece" ? "font-bold text-primary" : "text-base-content/70"}`}>
                            {row.sum_pcs.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-16 text-center text-base-content/50">
                        {!isLoading && "No output data available for the selected filters."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {sortedSummaryData.length > detailsItemsPerPage && (
                <div className="flex justify-between items-center p-4 border-t border-base-300 bg-base-100">
                  <div className="text-xs text-base-content/60">
                    Showing {(detailsCurrentPage - 1) * detailsItemsPerPage + 1} to {Math.min(detailsCurrentPage * detailsItemsPerPage, sortedSummaryData.length)} of {sortedSummaryData.length} processes
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDetailsCurrentPage(p => Math.max(1, p - 1))}
                      disabled={detailsCurrentPage === 1}
                      className="btn btn-sm btn-ghost"
                    >
                      Previous
                    </button>
                    <div className="text-xs font-semibold px-2">
                      {detailsCurrentPage} / {Math.ceil(sortedSummaryData.length / detailsItemsPerPage)}
                    </div>
                    <button
                      onClick={() => setDetailsCurrentPage(p => Math.min(Math.ceil(sortedSummaryData.length / detailsItemsPerPage), p + 1))}
                      disabled={detailsCurrentPage >= Math.ceil(sortedSummaryData.length / detailsItemsPerPage)}
                      className="btn btn-sm btn-ghost"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex justify-center w-full">
              <table className="table w-full border-collapse">
                <thead className="bg-base-200/60 text-base-content/70 uppercase text-xs sticky top-0 z-10 border-b border-base-300">
                  <tr>
                    <th className="px-6 py-4 font-bold text-center w-32 select-none">Date</th>
                    <th className="px-4 py-4 font-bold text-center w-auto whitespace-nowrap select-none">Total Output</th>
                    <th className="px-4 py-4 font-bold text-center w-32 select-none">Trend</th>
                    <th className="px-6 py-4 font-bold text-center w-32 select-none">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {chartDataAndProcs.dailyChartData.length > 0 ? (() => {
                    const reversedData = [...chartDataAndProcs.dailyChartData].reverse();
                    return reversedData.slice(0, 5).map((row, index) => {
                      const prevDayRow = reversedData[index + 1];
                      let trendValue = 0;
                      let trendPercent = 0;
                      if (prevDayRow) {
                        let currVal = 0;
                        let prevVal = 0;
                        if (unitMode === "Piece") { currVal = row.total_pcs; prevVal = prevDayRow.total_pcs; }
                        else if (unitMode === "Sheet") { currVal = row.total_sht; prevVal = prevDayRow.total_sht; }
                        else { currVal = row.total_lot; prevVal = prevDayRow.total_lot; }

                        trendValue = currVal - prevVal;
                        if (prevVal > 0) {
                          trendPercent = (trendValue / prevVal) * 100;
                        } else if (currVal > 0) {
                          trendPercent = 100;
                        }
                      }

                      return (
                        <tr key={row.raw_date} className="hover:bg-base-200/50 transition-colors border-b border-base-300">
                          <td className="px-6 py-4 font-medium text-base-content/90 text-center whitespace-nowrap">
                            {row.date_label}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-4 whitespace-nowrap">
                              {/* Other Units */}
                              <div className="flex items-center gap-4">
                                {unitMode !== "Piece" && (
                                  <div className="flex items-baseline gap-1">
                                    <span className="font-mono text-[12px] font-semibold text-base-content/60">{row.total_pcs ? row.total_pcs.toLocaleString() : 0}</span>
                                    <span className="text-[9px] uppercase font-bold text-base-content/40">PCS</span>
                                  </div>
                                )}
                                {unitMode !== "Sheet" && (
                                  <div className="flex items-baseline gap-1">
                                    <span className="font-mono text-[12px] font-semibold text-base-content/60">{row.total_sht ? row.total_sht.toLocaleString() : 0}</span>
                                    <span className="text-[9px] uppercase font-bold text-base-content/40">SHT</span>
                                  </div>
                                )}
                                {unitMode !== "Lot" && (
                                  <div className="flex items-baseline gap-1">
                                    <span className="font-mono text-[12px] font-semibold text-base-content/60">{row.total_lot ? row.total_lot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 0}</span>
                                    <span className="text-[9px] uppercase font-bold text-base-content/40">LOT</span>
                                  </div>
                                )}
                              </div>
                              {/* Active Unit */}
                              <div className="flex items-baseline gap-1.5 bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10 min-w-[110px] justify-end">
                                <span className="font-mono font-bold text-sm text-primary">
                                  {unitMode === "Lot" ? (row.total_lot ? row.total_lot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 0) :
                                    unitMode === "Sheet" ? (row.total_sht ? row.total_sht.toLocaleString() : 0) :
                                      (row.total_pcs ? row.total_pcs.toLocaleString() : 0)}
                                </span>
                                <span className="text-[9px] uppercase font-bold tracking-widest text-primary/70">{unitMode}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {prevDayRow ? (
                              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${trendValue > 0 ? 'bg-success/10 text-success border border-success/20' : trendValue < 0 ? 'bg-error/10 text-error border border-error/20' : 'bg-base-200 text-base-content/50 border border-base-300'}`}>
                                {trendValue > 0 ? (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
                                ) : trendValue < 0 ? (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                                ) : (
                                  <span className="w-3 text-center">-</span>
                                )}
                                {Math.abs(trendPercent) > 0 ? `${Math.abs(trendPercent).toFixed(1)}%` : '0%'}
                              </div>
                            ) : (
                              <span className="text-base-content/30 text-xs italic">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              className="btn btn-sm btn-outline border-base-300 hover:bg-primary hover:text-white hover:border-primary text-xs"
                              onClick={() => setSelectedChartDate(row.raw_date)}
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  })() : (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-base-content/50">
                        {!isLoading && "No daily data available."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
};
