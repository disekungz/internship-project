import React from "react";
import { BarChart3, MousePointerClick, ArrowLeft } from "lucide-react";
import ProductNameChart from "../ProductNameChart";
import { UnitMode, ProductOutput } from "./types";
import { getProductProcessType } from "./utils";

const ChartSkeleton: React.FC = () => {
  return (
    <div className="w-full min-h-[400px] flex flex-col gap-6 p-2">
      {/* Legend Skeleton */}
      <div className="flex justify-center items-center gap-3 w-full animate-pulse">
        <div className="h-3.5 w-12 bg-base-300 rounded"></div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-4.5 w-16 bg-base-300 rounded-full"></div>
          ))}
        </div>
      </div>

      {/* Bars Skeleton */}
      <div className="flex-1 flex items-end gap-3 md:gap-5 h-[350px] border-b border-l border-base-300 pb-2 pl-2 animate-pulse">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(i => {
          const heights = ["60%", "85%", "40%", "75%", "90%", "50%", "65%", "80%", "35%", "70%", "55%", "45%"];
          return (
            <div key={i} className="flex-1 flex flex-col justify-end gap-1.5 h-full">
              <div className="w-full bg-base-300/40 rounded-t" style={{ height: heights[(i - 1) % heights.length] }}>
                <div className="w-full bg-base-300/60 h-[30%] rounded-t"></div>
                <div className="w-full bg-base-300/40 h-[40%]"></div>
              </div>
              <div className="h-3 w-8 bg-base-200 rounded self-center mt-1"></div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ChartSectionProps {
  unitMode: UnitMode;
  activeProductName: string;
  topProductCardDisplay: { processType: string };
  isChartReady: boolean;
  isLoading: boolean;
  processedData: ProductOutput[];
  chartDataAndProcs: { dailyChartData: any[]; activeProcesses: string[] };
  filterProcess: string[];
  setFilterProcess: (val: string[]) => void;
  processList: string[];
  productSearchQuery: string;
  setProductSearchQuery: (val: string) => void;
  allProductNames: string[];
  handleBarClick: (rawDate: string) => void;
  selectedChartDate: string | null;
  filterCustomerGroup: string;
  setFilterCustomerGroup: (val: string) => void;
  customerGroupList: string[];
  selectedProduct: string | null;
  setSelectedProduct: (val: string | null) => void;
  chartGroupBy: "Process" | "Customer";
  setChartGroupBy: (val: "Process" | "Customer") => void;
}

export const ChartSection: React.FC<ChartSectionProps> = ({
  unitMode,
  activeProductName,
  topProductCardDisplay,
  isChartReady,
  isLoading,
  processedData,
  chartDataAndProcs,
  filterProcess,
  setFilterProcess,
  processList,
  productSearchQuery,
  setProductSearchQuery,
  allProductNames,
  handleBarClick,
  selectedChartDate,
  filterCustomerGroup,
  setFilterCustomerGroup,
  customerGroupList,
  selectedProduct,
  setSelectedProduct,
  chartGroupBy,
  setChartGroupBy
}) => {
  return (
    <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-4 shrink-0 w-full max-w-full overflow-hidden">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-base font-semibold text-base-content/80 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="flex items-center flex-wrap gap-1.5">
            Output Chart ({unitMode})
            {activeProductName !== "All Products" && (
              <>
                <span className="text-primary font-bold">— {activeProductName}</span>
                {topProductCardDisplay.processType && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shadow-sm ${topProductCardDisplay.processType === 'SMT'
                    ? 'bg-rose-500/15 text-rose-600 border-rose-500/20'
                    : 'bg-sky-500/15 text-sky-600 border-sky-500/20'
                    }`}>
                    {topProductCardDisplay.processType}
                  </span>
                )}
              </>
            )}
          </span>
        </h3>

        <div className="flex items-center gap-2">
          {(selectedProduct || (productSearchQuery && activeProductName !== "All Products") || selectedChartDate) && (
            <button
              onClick={() => {
                if (selectedProduct) {
                  setSelectedProduct(null);
                } else if (productSearchQuery) {
                  setProductSearchQuery("");
                } else {
                  handleBarClick(selectedChartDate!);
                }
              }}
              className="btn btn-xs btn-primary shadow-xs font-bold flex items-center gap-1.5 shrink-0 hover:scale-105 transition-transform"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {selectedChartDate ? "Back to All Days" : "Back to All Products"}
            </button>
          )}
          <div className="join border border-base-300 rounded-md shadow-sm bg-base-100">
            <button
              className={`join-item btn btn-xs ${chartGroupBy === "Process" ? "btn-primary" : "btn-ghost text-base-content/60 hover:text-base-content hover:bg-base-200"}`}
              onClick={() => setChartGroupBy("Process")}
            >
              Group By Process
            </button>
            <button
              className={`join-item btn btn-xs ${chartGroupBy === "Customer" ? "btn-primary" : "btn-ghost text-base-content/60 hover:text-base-content hover:bg-base-200"}`}
              onClick={() => setChartGroupBy("Customer")}
            >
              Group By Customer
            </button>
          </div>
        </div>
      </div>

      {!isChartReady || isLoading ? (
        <ChartSkeleton />
      ) : processedData.length > 0 ? (
        <ProductNameChart
          data={chartDataAndProcs.dailyChartData}
          unit={unitMode}
          activeProcesses={chartDataAndProcs.activeProcesses}
          filterProcess={filterProcess}
          setFilterProcess={setFilterProcess}
          processList={processList}
          productSearchQuery={productSearchQuery}
          setProductSearchQuery={setProductSearchQuery}
          allProductNames={allProductNames}
          activeProductName={activeProductName}
          activeProductType={getProductProcessType(activeProductName)}
          onBarClick={handleBarClick}
          selectedDate={selectedChartDate}
          filterCustomerGroup={filterCustomerGroup}
          setFilterCustomerGroup={setFilterCustomerGroup}
          customerGroupList={customerGroupList}
        />
      ) : (
        <div className="w-full min-h-[400px] flex items-center justify-center text-base-content/50">
          No data to display
        </div>
      )}
    </div>
  );
};
