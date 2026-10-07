import React from "react";
import { Layers, Cpu, Package, Award } from "lucide-react";
import { UnitMode, Stats, ProcessSummary } from "./types";

interface StatCardsProps {
  stats: Stats;
  unitMode: UnitMode;
  totalProcesses: number;
}

export const StatCards: React.FC<StatCardsProps> = ({ stats, unitMode, totalProcesses }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
      {/* Total Output Card - Steel Navy */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 p-5 text-white shadow-md shadow-slate-900/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
        <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl group-hover:scale-125 transition-transform duration-500"></div>
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">Total Output</span>
            <span className="text-3xl font-extrabold tracking-tight mt-1">
              {stats.total.toLocaleString()}
            </span>
          </div>
          <div className="rounded-lg bg-white/15 p-2.5 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
            <Layers className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-300">
          <span className="font-medium bg-white/10 px-2 py-0.5 rounded">Unit: {unitMode}</span>
          <span>Across all processes</span>
        </div>
      </div>

      {/* Active Processes Card - Deep Emerald/Teal */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 p-5 text-white shadow-md shadow-teal-700/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
        <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl group-hover:scale-125 transition-transform duration-500"></div>
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-150">Active Processes</span>
            <span className="text-3xl font-extrabold tracking-tight mt-1">
              {stats.activeCount} <span className="text-lg font-medium text-teal-200">/ {totalProcesses}</span>
            </span>
          </div>
          <div className="rounded-lg bg-white/15 p-2.5 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
            <Cpu className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-teal-200">
          <span className="font-medium bg-white/10 px-2 py-0.5 rounded">Active: {totalProcesses > 0 ? ((stats.activeCount / totalProcesses) * 100).toFixed(0) : 0}%</span>
          <span>Currently running output</span>
        </div>
      </div>

      {/* Active Products Count Card - Corporate Blue */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-sky-800 p-5 text-white shadow-md shadow-blue-700/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
        <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl group-hover:scale-125 transition-transform duration-500"></div>
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-150">
              Active Products
            </span>
            <span className="text-3xl font-extrabold tracking-tight mt-1">
              {stats.activeProducts.toLocaleString()}
            </span>
          </div>
          <div className="rounded-lg bg-white/15 p-2.5 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
            <Package className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-blue-200">
          <span className="font-medium bg-white/10 px-2 py-0.5 rounded">
            Active Models
          </span>
          <span>Distinct product parts processed</span>
        </div>
      </div>

      {/* Top Process Card - Deep Indigo */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 p-5 text-white shadow-md shadow-indigo-700/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
        <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl group-hover:scale-125 transition-transform duration-500"></div>
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-150">Top Performing Process</span>
            <span className="text-3xl font-extrabold tracking-tight mt-1">
              {stats.topProcess ? stats.topProcess.process_name : "N/A"}
            </span>
          </div>
          <div className="rounded-lg bg-white/15 p-2.5 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
            <Award className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-indigo-200">
          <div className="flex items-center gap-1.5">
            <span className="font-medium bg-white/10 px-2 py-0.5 rounded">
              {stats.topProcess ? (stats.topProcess.output_value || 0).toLocaleString() : 0} {unitMode}
            </span>
          </div>
          <span>
            {stats.topProcess && stats.total > 0
              ? `${((stats.topProcess.output_value || 0) / stats.total * 100).toFixed(1)}% share`
              : "0%"}
          </span>
        </div>
      </div>
    </div>
  );
};
