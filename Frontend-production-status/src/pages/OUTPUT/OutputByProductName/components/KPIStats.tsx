import React from "react";
import { Layers, Package, Award, Building2 } from "lucide-react";
import { UnitMode, Stats } from "./types";

interface KPIStatsProps {
  stats: Stats;
  unitMode: UnitMode;
  isLoading: boolean;
  totalProductsCount: number;
  topProductCardDisplay: {
    title: string;
    name: string;
    value: number;
    share: number;
    isAdaptive: boolean;
    processType: string;
  };
  customerGroupDisplay: {
    title: string;
    value: string;
    subtitle: string;
    isSingle: boolean;
  };
  selectedProduct: string | null;
  setSelectedProduct: (val: string | null) => void;
  setProductSearchQuery: (val: string) => void;
}

export const KPIStats: React.FC<KPIStatsProps> = ({
  stats,
  unitMode,
  isLoading,
  totalProductsCount,
  topProductCardDisplay,
  customerGroupDisplay,
  selectedProduct,
  setSelectedProduct,
  setProductSearchQuery
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
      {/* Total Output Card */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 p-5 text-white shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
        <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl group-hover:scale-125 transition-transform duration-500"></div>
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">Total Output</span>
            {isLoading ? (
              <div className="h-9 w-28 bg-white/20 rounded animate-pulse mt-1"></div>
            ) : (
              <span className="text-3xl font-extrabold tracking-tight mt-1">
                {stats.total.toLocaleString()}
              </span>
            )}
          </div>
          <div className="rounded-lg bg-white/15 p-2.5 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
            <Layers className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-300">
          <span className="font-medium bg-white/10 px-2 py-0.5 rounded">Unit: {unitMode}</span>
          <span>Across all active products</span>
        </div>
      </div>

      {/* Active Products Card */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 p-5 text-white shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
        <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl group-hover:scale-125 transition-transform duration-500"></div>
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-150">Active Products</span>
            {isLoading ? (
              <div className="h-9 w-20 bg-white/20 rounded animate-pulse mt-1"></div>
            ) : (
              <span className="text-3xl font-extrabold tracking-tight mt-1">
                {stats.activeProducts.toLocaleString()}
              </span>
            )}
          </div>
          <div className="rounded-lg bg-white/15 p-2.5 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
            <Package className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-teal-200">
          <span
            className="font-medium bg-white/10 px-2 py-0.5 rounded cursor-help"
            title={`Active models: ${stats.activeProducts.toLocaleString()} / Total factory models: ${totalProductsCount.toLocaleString()}`}
          >
            Active: {totalProductsCount > 0 ? ((stats.activeProducts / totalProductsCount) * 100).toFixed(0) : 0}%
          </span>
          <span>Running models output</span>
        </div>
      </div>

      {/* Top Product Card */}
      <div
        onClick={() => {
          if (topProductCardDisplay.isAdaptive) {
            setSelectedProduct(null);
            setProductSearchQuery("");
          }
        }}
        className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 p-5 text-white shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group ${topProductCardDisplay.isAdaptive ? "cursor-pointer ring-2 ring-white/50" : ""
          }`}
        title={topProductCardDisplay.isAdaptive ? "Click to clear selection" : ""}
      >
        <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl group-hover:scale-125 transition-transform duration-500"></div>
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1 w-[80%]">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-150">
              {topProductCardDisplay.title}
            </span>
            {isLoading ? (
              <div className="h-8 w-40 bg-white/20 rounded animate-pulse mt-1"></div>
            ) : (
              <span className="text-2xl font-extrabold tracking-tight mt-1 truncate" title={topProductCardDisplay.name}>
                {topProductCardDisplay.name}
              </span>
            )}
          </div>
          <div className="rounded-lg bg-white/15 p-2.5 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
            <Award className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-indigo-200">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium bg-white/10 px-2 py-0.5 rounded">
              {topProductCardDisplay.value.toLocaleString()} {unitMode}
            </span>
            {topProductCardDisplay.processType && (
              <span className={`font-medium px-2 py-0.5 rounded text-[11px] whitespace-nowrap shadow-sm border backdrop-blur-sm ${topProductCardDisplay.processType === 'SMT'
                ? 'bg-rose-500/20 text-rose-100 border-rose-400/30'
                : 'bg-sky-500/20 text-sky-100 border-sky-400/30'
                }`}>
                {topProductCardDisplay.processType}
              </span>
            )}
          </div>
          <span className="whitespace-nowrap ml-2">
            {topProductCardDisplay.share.toFixed(1)}% share
          </span>
        </div>
      </div>

      {/* Customer Groups Card */}
      <div
        onClick={() => setSelectedProduct(null)}
        className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-sky-800 p-5 text-white shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group ${selectedProduct || customerGroupDisplay.isSingle ? "cursor-pointer ring-2 ring-white/50" : ""
          }`}
        title={selectedProduct || customerGroupDisplay.isSingle ? "Click to clear selection" : ""}
      >
        <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl group-hover:scale-125 transition-transform duration-500"></div>
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1 w-[80%]">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-150">
              {customerGroupDisplay.title}
            </span>
            {isLoading ? (
              <div className="h-9 w-24 bg-white/20 rounded animate-pulse mt-1"></div>
            ) : (
              <span className={`font-extrabold tracking-tight mt-1 truncate ${customerGroupDisplay.isSingle && customerGroupDisplay.value.length > 10 ? "text-2xl" : "text-3xl"
                }`}>
                {customerGroupDisplay.value}
              </span>
            )}
          </div>
          <div className="rounded-lg bg-white/15 p-2.5 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
            <Building2 className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-blue-200">
          <span className="font-medium bg-white/10 px-2 py-0.5 rounded truncate max-w-[65%]">
            {customerGroupDisplay.subtitle}
          </span>
          <span className="text-[10px] opacity-75">
            {selectedProduct || customerGroupDisplay.isSingle ? "Click card to clear" : "Based on active model codes"}
          </span>
        </div>
      </div>
    </div>
  );
};
