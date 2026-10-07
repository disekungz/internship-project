import React, { useRef } from "react";
import { RefreshCcw, CalendarDays, Download } from "lucide-react";
import { UnitMode } from "./types";
import { formatDate } from "./utils";

interface FilterBarProps {
  startDate: string;
  endDate: string;
  tempStartDate: string;
  tempEndDate: string;
  setTempStartDate: (date: string) => void;
  setTempEndDate: (date: string) => void;
  unitMode: UnitMode;
  setUnitMode: (mode: UnitMode) => void;
  handleRefresh: () => void;
  handleApplyDates: () => void;
  isLoading: boolean;
  isRefreshing: boolean;
  onExport?: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  startDate,
  endDate,
  tempStartDate,
  tempEndDate,
  setTempStartDate,
  setTempEndDate,
  unitMode,
  setUnitMode,
  handleRefresh,
  handleApplyDates,
  isLoading,
  isRefreshing,
  onExport
}) => {
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 overflow-hidden shrink-0">
      <div className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-base-content">Output By Product</h2>
          <p className="text-sm text-base-content/60">Actual output summary grouped by product.</p>
          <div className="flex items-center gap-2 mt-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 shadow-sm text-xs font-bold text-primary tracking-wide">
              <CalendarDays size={14} className="opacity-80" />
              {formatDate(startDate)}
              <span className="text-primary/50 mx-1 font-medium">to</span>
              {formatDate(endDate)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="btn btn-sm btn-outline shadow-sm"
          >
            <RefreshCcw size={14} className={isRefreshing || isLoading ? "animate-spin" : ""} />
            Refresh
          </button>

          <div className="flex items-center bg-base-100 border border-base-300 rounded-lg shadow-sm h-8">
            <div
              className="relative flex items-center h-full px-3 cursor-pointer hover:bg-base-200 rounded-l-lg transition-colors border-r border-base-300/50"
              onClick={() => {
                try { startDateRef.current?.showPicker(); } catch (e) { }
              }}
            >
              <span className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mr-2">From Date</span>
              <span className="text-sm select-none mr-6">{formatDate(tempStartDate)}</span>
              <CalendarDays size={14} className="opacity-50 absolute right-3 pointer-events-none text-base-content/70" />
              <input
                ref={startDateRef}
                type="date"
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                value={tempStartDate}
                onChange={(e) => setTempStartDate(e.target.value)}
                min="2026-01-01"
                max={tempEndDate > "2026-12-31" ? "2026-12-31" : tempEndDate}
                onClick={(e) => {
                  e.stopPropagation();
                  try { e.currentTarget.showPicker(); } catch (err) { }
                }}
              />
            </div>

            <div
              className="relative flex items-center h-full px-3 cursor-pointer hover:bg-base-200 rounded-r-lg transition-colors"
              onClick={() => {
                try { endDateRef.current?.showPicker(); } catch (e) { }
              }}
            >
              <span className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mr-2">To Date</span>
              <span className="text-sm select-none mr-6">{formatDate(tempEndDate)}</span>
              <CalendarDays size={14} className="opacity-50 absolute right-3 pointer-events-none text-base-content/70" />
              <input
                ref={endDateRef}
                type="date"
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                value={tempEndDate}
                onChange={(e) => setTempEndDate(e.target.value)}
                min={tempStartDate < "2026-01-01" ? "2026-01-01" : tempStartDate}
                max="2026-12-31"
                onClick={(e) => {
                  e.stopPropagation();
                  try { e.currentTarget.showPicker(); } catch (err) { }
                }}
              />
            </div>
          </div>

          <button
            onClick={handleApplyDates}
            disabled={isLoading}
            className="btn btn-sm btn-primary shadow-sm"
          >
            Search
          </button>

          {onExport && (
            <button
              onClick={onExport}
              disabled={isLoading}
              className="btn btn-sm btn-outline btn-success shadow-sm"
            >
              <Download size={14} />
              Export Excel
            </button>
          )}

          <div className="flex items-center gap-2 border-l border-base-300 pl-3">
            <span className="text-sm text-base-content/70 whitespace-nowrap">Output Unit:</span>
            <select
              className="select select-sm select-bordered w-full md:w-28 bg-base-100"
              value={unitMode}
              onChange={(e) => setUnitMode(e.target.value as UnitMode)}
            >
              <option value="Lot">Lot</option>
              <option value="Sheet">Sheet</option>
              <option value="Piece">Piece</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
