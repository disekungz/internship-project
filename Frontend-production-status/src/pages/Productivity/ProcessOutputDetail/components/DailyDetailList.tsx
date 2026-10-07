import React, { useState, useMemo } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Layers } from "lucide-react";
import { LineGroupRow, OutputUnit, OUTPUT_UNITS } from "../types";

const formatDate = (date: string) => {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;
  return `${match[3]}/${match[2]}/${match[1]}`;
};

type DailyDetailListProps = {
  rows: LineGroupRow[];
  selectedUnit: OutputUnit;
  isLoading: boolean;
  errorMessage: string;
};

export const DailyDetailList: React.FC<DailyDetailListProps> = ({ rows, selectedUnit, isLoading, errorMessage }) => {
  const selectedUnitMeta = OUTPUT_UNITS.find(unit => unit.key === selectedUnit) || OUTPUT_UNITS[0];
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const groupedByDate = useMemo(() => {
    const map = new Map<string, { date: string; rows: LineGroupRow[]; totalLot: number; totalSht: number; totalPiece: number }>();
    rows.forEach(row => {
      if (!map.has(row.date)) {
        map.set(row.date, { date: row.date, rows: [], totalLot: 0, totalSht: 0, totalPiece: 0 });
      }
      const group = map.get(row.date)!;
      group.rows.push(row);
      group.totalLot += row.lotQty;
      group.totalSht += row.shtQty;
      group.totalPiece += row.pieceQty;
    });

    // Sort dates descending
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [rows]);

  const toggleDate = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const getUnitValue = (lot: number, sht: number, piece: number) => {
    if (selectedUnit === 'lot') return lot;
    if (selectedUnit === 'sht') return sht;
    return piece;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex justify-center items-center h-64 text-base-content/50">
        Loading daily details...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
        {errorMessage}
      </div>
    );
  }

  if (groupedByDate.length === 0) {
    return (
      <div className="flex-1 flex justify-center items-center h-64 text-base-content/50">
        No output data available for this period.
      </div>
    );
  }

  const expandAll = () => {
    setExpandedDates(new Set(groupedByDate.map(d => d.date)));
  };

  const collapseAll = () => {
    setExpandedDates(new Set());
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header controls for Daily list */}
      <div className="flex items-center justify-between px-1">
        <div className="text-xs font-bold text-base-content/70 flex items-center gap-2">
          <span>Daily Production Breakdown</span>
          <span className="badge badge-sm border-none bg-base-200 text-[11px] font-semibold">
            {groupedByDate.length} Days Recorded
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={expandAll}
            className="btn btn-xs btn-ghost text-xs text-base-content/70 hover:text-primary"
          >
            Expand All
          </button>
          <span className="text-base-content/30">|</span>
          <button
            type="button"
            onClick={collapseAll}
            className="btn btn-xs btn-ghost text-xs text-base-content/70 hover:text-primary"
          >
            Collapse All
          </button>
        </div>
      </div>

      {groupedByDate.map(day => {
        const isExpanded = expandedDates.has(day.date);
        const dayTotal = getUnitValue(day.totalLot, day.totalSht, day.totalPiece);

        return (
          <div key={day.date} className="bg-base-100 rounded-xl shadow-xs border border-base-200 overflow-hidden transition-all">
            {/* Header / Summary */}
            <div 
              className={`px-4 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer hover:bg-base-200/50 transition-colors ${isExpanded ? 'bg-base-200/40 border-b border-base-200' : ''}`}
              onClick={() => toggleDate(day.date)}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-50 border border-indigo-100/80 p-2 shrink-0 text-indigo-600">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-base-content">
                    {formatDate(day.date)}
                  </h4>
                  <p className="text-[11px] text-base-content/50">
                    {day.rows.length} entries recorded
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-5 w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase font-bold text-base-content/50 tracking-wider">
                    Total {selectedUnitMeta.shortLabel}
                  </span>
                  <span className="font-mono font-bold text-base text-primary">
                    {dayTotal.toLocaleString()}
                  </span>
                </div>
                <div className="p-1 rounded-lg text-base-content/40 hover:text-base-content">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </div>

            {/* Expanded Detail Rows */}
            {isExpanded && (
              <div className="p-3 bg-base-200/20">
                <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
                  {day.rows.map((row, idx) => (
                    <div 
                      key={`${row.lineGroup}_${row.process}_${row.mcLine}_${idx}`}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-base-100/70 border-base-200 hover:bg-base-100 hover:shadow-sm hover:-translate-y-[1px] transition-all duration-300"
                    >
                      <div className="flex flex-col min-w-0 w-[25%] sm:w-[20%] shrink-0">
                        <span className="font-semibold text-sm truncate text-base-content/90">{row.lineGroup}</span>
                        <span className="text-[11px] text-base-content/50 truncate">Line Group</span>
                      </div>
                      
                      <div className="text-xs font-medium text-base-content/70 shrink-0 w-[20%] sm:w-[15%] truncate hidden sm:flex flex-col justify-center border-l border-base-300 pl-3">
                        <span className="truncate">{row.process}</span>
                        <span className="text-[10px] text-base-content/50 font-normal truncate mt-0.5">Process</span>
                      </div>

                      <div className="text-xs font-medium text-base-content/70 shrink-0 w-[25%] sm:w-[20%] truncate flex flex-col justify-center border-l border-base-300 pl-3">
                        <span className="truncate font-mono">{row.mcLine}</span>
                        <span className="text-[10px] text-base-content/50 font-normal truncate mt-0.5">MC / Line</span>
                      </div>

                      <div className="flex-1 flex items-center justify-end gap-4 min-w-0 pr-2">
                        {selectedUnit !== "lot" && (
                          <div className="flex flex-col items-end hidden md:flex">
                            <span className="text-[9px] uppercase font-bold text-base-content/40 tracking-wider">Lot</span>
                            <span className="text-[11px] font-mono text-base-content/70">{(row.lotQty || 0).toLocaleString()}</span>
                          </div>
                        )}
                        {selectedUnit !== "sht" && (
                          <div className="flex flex-col items-end hidden sm:flex">
                            <span className="text-[9px] uppercase font-bold text-base-content/40 tracking-wider">Sheet</span>
                            <span className="text-[11px] font-mono text-base-content/70">{(row.shtQty || 0).toLocaleString()}</span>
                          </div>
                        )}
                        {selectedUnit !== "piece" && (
                          <div className="flex flex-col items-end hidden lg:flex">
                            <span className="text-[9px] uppercase font-bold text-base-content/40 tracking-wider">Piece</span>
                            <span className="text-[11px] font-mono text-base-content/70">{(row.pieceQty || 0).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end shrink-0 ml-auto border-l border-base-300 pl-3">
                        <span className={`font-mono font-bold text-sm ${selectedUnit === 'lot' ? 'text-primary' : 'text-base-content/60'}`}>
                          {row.lotQty.toLocaleString()}
                        </span>
                        <span className={`font-mono font-bold text-xs mt-0.5 ${selectedUnit === 'sht' ? 'text-primary' : 'text-base-content/50'}`}>
                          {row.shtQty.toLocaleString()} <span className="text-[10px] font-normal opacity-70">sht</span>
                        </span>
                        <span className={`font-mono font-bold text-xs mt-0.5 ${selectedUnit === 'piece' ? 'text-primary' : 'text-base-content/50'}`}>
                          {row.pieceQty.toLocaleString()} <span className="text-[10px] font-normal opacity-70">pcs</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
