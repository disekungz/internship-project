import React from "react";
import { BarChart3, CalendarDays, ArrowLeft } from "lucide-react";
import { ChartSkeleton } from "./Skeletons";
import ProcessDateChart from "../ProcessDateChart";
import TopOutputChart from "../TopOutputChart";
import { UnitMode, ProcessSummary } from "./types";

interface ChartSectionProps {
  isChartReady: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  lots: any[];
  startDate: string;
  endDate: string;
  selectedChartDate: string | null;
  selectedProcess: string;
  unitMode: UnitMode;
  chartDataAndProcs: {
    dailyChartData: any[];
    activeProcesses: string[];
  };
  summaryData: ProcessSummary[];
  getProcessColor: (processName: string) => string;
  setSelectedChartDate: (date: string | null) => void;
  setSelectedProcess: (process: string) => void;
  formatDate: (dateStr: string) => string;
}

export const ChartSection: React.FC<ChartSectionProps> = ({
  isChartReady,
  isLoading,
  isRefreshing,
  lots,
  startDate,
  endDate,
  selectedChartDate,
  selectedProcess,
  unitMode,
  chartDataAndProcs,
  summaryData,
  getProcessColor,
  setSelectedChartDate,
  setSelectedProcess,
  formatDate
}) => {
  return (
    <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-4 shrink-0 flex flex-col min-h-[450px]">
      {/* Dynamic header for chart section */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-base font-semibold text-base-content/80 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="flex items-center gap-1.5 flex-wrap">
            {selectedProcess ? "MC Line Output" : selectedChartDate ? "Process Output" : "Daily Data Summary"}
            {selectedChartDate && !selectedProcess && (
              <span className="text-primary font-bold ml-1">— {formatDate(selectedChartDate)}</span>
            )}
            {selectedProcess && (
              <span className="text-primary font-bold ml-1">— {selectedProcess}</span>
            )}
          </span>
        </h3>
        <div className="flex items-center gap-3">
        </div>
        {selectedChartDate && (
          <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{formatDate(selectedChartDate)}</span>
            <button
              className="ml-1 hover:text-primary-focus transition-colors"
              onClick={() => {
                setSelectedChartDate(null);
                setSelectedProcess("");
              }}
              title="Clear date filter"
            >
              <div className="bg-primary/20 rounded-full p-0.5">
                <span className="opacity-70 font-bold hover:opacity-100 flex items-center justify-center w-3 h-3 text-[10px]">✕</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {!isChartReady || (isLoading && !isRefreshing) ? (
        <ChartSkeleton />
      ) : (Array.isArray(lots) && lots.length > 0) ? (
        startDate !== endDate && !selectedChartDate ? (
          <ProcessDateChart
            data={chartDataAndProcs.dailyChartData}
            unit={unitMode}
            activeProcesses={chartDataAndProcs.activeProcesses}
            selectedDate={selectedChartDate}
            onBarClick={(rawDate, _procName) => {
              setSelectedChartDate(rawDate);
            }}
          />
        ) : (
          <TopOutputChart
            data={summaryData.map(item => ({
              process_name: item.process_name,
              output_qty: item.output_value || 0,
              color: getProcessColor(item.process_name),
              mcline_count: item.mcline_count
            }))}
            unit={unitMode}
            selectedProcess={selectedProcess}
            onProcessSelect={setSelectedProcess}
            backButtonNode={
              (selectedChartDate || selectedProcess) ? (
                <button
                  onClick={() => {
                    if (selectedProcess) {
                      setSelectedProcess("");
                    } else {
                      setSelectedChartDate(null);
                    }
                  }}
                  className="btn btn-sm btn-primary shadow-sm hover:scale-105 transition-transform font-bold"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  {selectedProcess ? "Back to Processes" : "Back to All Days"}
                </button>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="w-full min-h-[400px] flex items-center justify-center text-base-content/50">
          No data to display
        </div>
      )}
    </div>
  );
};
