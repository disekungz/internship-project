import React from "react";
import { Building2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { UnitMode, CustomerGroupStat } from "./types";

interface CustomerGroupsSectionProps {
  isLoading: boolean;
  comparisonPeriod: { current: string; prev: string; type: string } | null;
  topCustomerGroups: CustomerGroupStat[];
  unitMode: UnitMode;
}

export const CustomerGroupsSection: React.FC<CustomerGroupsSectionProps> = ({
  isLoading,
  comparisonPeriod,
  topCustomerGroups,
  unitMode
}) => {
  return (
    <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-4 shrink-0 w-full max-w-full overflow-hidden">
      <div className="mb-4">
        <h3 className="text-base font-bold text-base-content/90 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          Top Customer Groups (MoM / DoD Change)
        </h3>
        {comparisonPeriod && (
          <p className="text-xs text-base-content/60 mt-1 ml-6">
            Comparing <strong>{comparisonPeriod.current}</strong> vs <strong>{comparisonPeriod.prev}</strong> ({comparisonPeriod.type})
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex gap-4 animate-pulse overflow-hidden">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex-1 h-32 bg-base-200 rounded-lg"></div>
          ))}
        </div>
      ) : topCustomerGroups.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {topCustomerGroups.map((group, idx) => (
            <div key={group.name} className="relative overflow-hidden rounded-lg border border-base-200 bg-gradient-to-br from-base-100 to-base-200/50 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-center mb-3">
                <span className="font-extrabold text-sm text-base-content truncate w-[80%]" title={group.name}>
                  {idx + 1}. {group.name}
                </span>
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                  #{idx + 1}
                </div>
              </div>

              <div className="flex flex-col gap-2 text-xs">
                {/* LOT */}
                <div className="flex justify-between items-center">
                  <span className="text-base-content/60 font-medium">Lot:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-base-content/90">{group.current.lot.toLocaleString()}</span>
                    <span
                      title={`Diff: ${(group.current.lot - group.prev.lot).toLocaleString()} (Cur: ${group.current.lot.toLocaleString()}, Prev: ${group.prev.lot.toLocaleString()})`}
                      className={`cursor-help flex items-center text-[10px] px-1 rounded whitespace-nowrap min-w-[54px] justify-end ${group.changeLot > 0 ? 'text-emerald-600 bg-emerald-100' : group.changeLot < 0 ? 'text-rose-600 bg-rose-100' : 'text-slate-500 bg-slate-100'}`}
                    >
                      {group.changeLot > 0 ? <TrendingUp size={10} className="mr-0.5" /> : group.changeLot < 0 ? <TrendingDown size={10} className="mr-0.5" /> : <Minus size={10} className="mr-0.5" />}
                      {Math.abs(group.changeLot).toFixed(1)}%
                    </span>
                  </div>
                </div>
                {/* SHEET */}
                <div className="flex justify-between items-center">
                  <span className="text-base-content/60 font-medium">Sht:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-base-content/90">{group.current.sht.toLocaleString()}</span>
                    <span
                      title={`Diff: ${(group.current.sht - group.prev.sht).toLocaleString()} (Cur: ${group.current.sht.toLocaleString()}, Prev: ${group.prev.sht.toLocaleString()})`}
                      className={`cursor-help flex items-center text-[10px] px-1 rounded whitespace-nowrap min-w-[54px] justify-end ${group.changeSht > 0 ? 'text-emerald-600 bg-emerald-100' : group.changeSht < 0 ? 'text-rose-600 bg-rose-100' : 'text-slate-500 bg-slate-100'}`}
                    >
                      {group.changeSht > 0 ? <TrendingUp size={10} className="mr-0.5" /> : group.changeSht < 0 ? <TrendingDown size={10} className="mr-0.5" /> : <Minus size={10} className="mr-0.5" />}
                      {Math.abs(group.changeSht).toFixed(1)}%
                    </span>
                  </div>
                </div>
                {/* PCS */}
                <div className="flex justify-between items-center">
                  <span className="text-base-content/60 font-medium">Pcs:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-base-content/90">{group.current.pcs.toLocaleString()}</span>
                    <span
                      title={`Diff: ${(group.current.pcs - group.prev.pcs).toLocaleString()} (Cur: ${group.current.pcs.toLocaleString()}, Prev: ${group.prev.pcs.toLocaleString()})`}
                      className={`cursor-help flex items-center text-[10px] px-1 rounded whitespace-nowrap min-w-[54px] justify-end ${group.changePcs > 0 ? 'text-emerald-600 bg-emerald-100' : group.changePcs < 0 ? 'text-rose-600 bg-rose-100' : 'text-slate-500 bg-slate-100'}`}
                    >
                      {group.changePcs > 0 ? <TrendingUp size={10} className="mr-0.5" /> : group.changePcs < 0 ? <TrendingDown size={10} className="mr-0.5" /> : <Minus size={10} className="mr-0.5" />}
                      {Math.abs(group.changePcs).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-base-content/50 text-sm">
          No customer group data available for comparison.
        </div>
      )}
    </div>
  );
};
