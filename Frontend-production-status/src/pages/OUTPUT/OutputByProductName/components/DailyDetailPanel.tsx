import React from "react";
import { CalendarDays, X, Sparkles } from "lucide-react";
import { UnitMode, ProductOutput } from "./types";
import { getCustomerGroup, getProductProcessType } from "./utils";

interface DailyDetailPanelProps {
  selectedDayDetail: {
    date: string;
    total: number;
    rows: ProductOutput[];
    productCount: number;
  } | null;
  setSelectedChartDate: (val: string | null) => void;
  selectedProduct: string | null;
  setSelectedProduct: (val: string | null) => void;
  unitMode: UnitMode;
  getProductColor: (productName: string) => string;
}

export const DailyDetailPanel: React.FC<DailyDetailPanelProps> = ({
  selectedDayDetail,
  setSelectedChartDate,
  selectedProduct,
  setSelectedProduct,
  unitMode,
  getProductColor
}) => {
  if (!selectedDayDetail) return null;

  return (
    <div className="bg-base-100 rounded-xl shadow-sm border border-primary/30 ring-1 ring-primary/10 p-4 shrink-0 w-full max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 shrink-0">
            <CalendarDays className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-bold text-base-content/90">
              Daily Detail — {new Date(selectedDayDetail.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </h3>
            <p className="text-xs text-base-content/60 mt-0.5">
              {selectedDayDetail.productCount} products · {selectedDayDetail.rows.length} entries · Total{' '}
              <span className="font-semibold text-base-content/80">{selectedDayDetail.total.toLocaleString()} {unitMode}</span>
            </p>
          </div>
        </div>
        <button
          onClick={() => setSelectedChartDate(null)}
          className="btn btn-sm btn-ghost gap-1 text-base-content/60 hover:text-base-content shrink-0"
        >
          <X className="w-4 h-4" /> Close
        </button>
      </div>

      {selectedDayDetail.rows.length > 0 ? (
        <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
          {selectedDayDetail.rows.map((row) => {
            const color = getProductColor(row.product_name);
            const isSel = selectedProduct === row.product_name;
            const pType = getProductProcessType(row.product_name);
            return (
              <button
                key={`${row.product_name}_${row.process_name}`}
                type="button"
                onClick={() => setSelectedProduct(isSel ? null : row.product_name)}
                title="Click to focus this product"
                className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${isSel ? "bg-primary/10 border-primary/40" : "bg-base-200/30 border-base-200 hover:bg-base-200/60"
                  }`}
              >
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                <div className="flex flex-col min-w-0 w-[28%]">
                  <span className="font-semibold text-sm truncate text-base-content/90">{row.product_name}</span>
                  <span className="text-[11px] text-base-content/50 truncate">{getCustomerGroup(row.product_name)}</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${pType === "SMT" ? "bg-rose-500/15 text-rose-600 border-rose-500/20" : "bg-sky-500/15 text-sky-600 border-sky-500/20"
                  }`}>
                  {pType}
                </span>
                <div className="text-xs font-medium text-base-content/70 shrink-0 w-[16%] truncate hidden sm:flex flex-col justify-center">
                  <span className="truncate">{row.process_name}</span>
                  {row.mc_line && (
                    <span className="text-[10px] text-base-content/50 font-normal truncate mt-0.5">
                      MC: {row.mc_line}
                    </span>
                  )}
                </div>
                <div className="flex-1 flex items-center justify-end gap-4 min-w-0 pr-2">
                  {unitMode !== "Lot" && (
                    <div className="flex flex-col items-end hidden sm:flex">
                      <span className="text-[9px] uppercase font-bold text-base-content/40 tracking-wider">Lot</span>
                      <span className="text-[11px] font-mono text-base-content/70">{(row.actual_lot_qty || 0).toLocaleString()}</span>
                    </div>
                  )}
                  {unitMode !== "Sheet" && (
                    <div className="flex flex-col items-end hidden md:flex">
                      <span className="text-[9px] uppercase font-bold text-base-content/40 tracking-wider">Sheet</span>
                      <span className="text-[11px] font-mono text-base-content/70">{(row.actual_sht_qty || 0).toLocaleString()}</span>
                    </div>
                  )}
                  {unitMode !== "Piece" && (
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] uppercase font-bold text-base-content/40 tracking-wider">Piece</span>
                      <span className="text-[11px] font-mono text-base-content/70">{(row.actual_pcs_qty || 0).toLocaleString()}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end shrink-0 w-24 pl-3 border-l border-base-300">
                  <span className="text-[9px] uppercase font-bold text-primary/70 tracking-wider">{unitMode}</span>
                  <span className="font-mono font-bold text-sm text-primary">
                    {(row.output_value || 0).toLocaleString()}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-base-content/50 text-sm">No output recorded for this day.</div>
      )}

      <p className="text-[11px] text-base-content/50 mt-3 flex items-center gap-1.5">
        <Sparkles className="w-3 h-3 text-primary/70" />
        คลิกรายการเพื่อโฟกัส product นั้นในกราฟ การ์ด และตารางพร้อมกัน
      </p>
    </div>
  );
};
