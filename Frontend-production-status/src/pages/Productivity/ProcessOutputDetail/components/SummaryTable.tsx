import React, { useState, useMemo, useEffect } from "react";
import { Layers, Activity, Monitor, Box, Package, Layers as LayersIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { LineGroup, LineGroupRow, OutputUnit, UnitTotals } from "../types";

type SummaryTableProps = {
  visibleLineGroups: LineGroup[];
  totals: Map<string, UnitTotals>;
  selectedUnit: OutputUnit;
  rows: LineGroupRow[];
  isLoading?: boolean;
};

const getUnitValue = (values: UnitTotals | LineGroupRow | undefined, unit: OutputUnit) => {
  if (!values) return 0;
  if (unit === "lot") return values.lotQty;
  if (unit === "sht") return values.shtQty;
  return values.pieceQty;
};

const SummaryTableRow: React.FC<{
  group: LineGroup;
  totals: Map<string, UnitTotals>;
  rows: LineGroupRow[];
  selectedUnit: OutputUnit;
}> = ({ group, totals, rows, selectedUnit }) => {
  const [expanded, setExpanded] = useState(false);
  const MAX_VISIBLE = 6;

  const groupTotals = totals.get(group.name.toUpperCase());
  const lotQty = getUnitValue(groupTotals, "lot");
  const shtQty = getUnitValue(groupTotals, "sht");
  const pieceQty = getUnitValue(groupTotals, "piece");
  const groupRows = rows.filter(r => r.lineGroup.toUpperCase() === group.name.toUpperCase());
  const actualProcesses = Array.from(new Set(groupRows.flatMap(r => r.process.split(', ').filter(Boolean))));
  const actualMcLines = Array.from(new Set(groupRows.map(r => r.mcLine).filter(m => m && m !== 'Unknown' && m.trim() !== '')));

  const processesList = actualProcesses.length > 0 
    ? actualProcesses 
    : (group.processes && group.processes.length > 0 ? group.processes : ["-"]);
    
  const mcLinesList = actualMcLines.length > 0 
    ? actualMcLines 
    : (group.mcLines && group.mcLines.length > 0 ? group.mcLines : ["-"]);

  const showMcToggle = mcLinesList.length > MAX_VISIBLE;
  const isExpandable = showMcToggle;

  const visibleMcLines = expanded ? mcLinesList : mcLinesList.slice(0, MAX_VISIBLE);

  return (
    <tr 
      className={`border-b border-base-300 transition-all duration-300 hover:bg-base-200/80 ${isExpandable ? 'cursor-pointer' : ''}`}
      onClick={() => isExpandable && setExpanded(!expanded)}
    >
      <td className="font-bold whitespace-nowrap align-middle py-4 pl-4 lg:pl-6">
        <div className="flex items-center gap-2.5">
          {group.factory === 'SMT' ? (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-500">
              SMT
            </span>
          ) : group.factory === 'FPC' ? (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-500">
              FPC
            </span>
          ) : group.factory === 'QA' ? (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-500">
              QA
            </span>
          ) : group.factory ? (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-500">
              {group.factory}
            </span>
          ) : (
            <Layers className="w-4 h-4 text-primary/50" />
          )}
          <span className="text-base-content text-[14px]">
            {group.name}
          </span>
        </div>
      </td>
      <td className="align-middle py-4 max-w-[200px]">
        <div className="flex flex-wrap items-center gap-1.5">
          {processesList.map(proc => (
            <span key={proc} className="badge badge-sm border-none bg-primary/10 text-primary font-medium px-2 shadow-sm">
              {proc}
            </span>
          ))}
        </div>
      </td>
      <td className="align-middle py-4">
        <div className={`flex items-center gap-1.5 ${expanded ? 'flex-wrap max-w-lg' : 'overflow-hidden'}`}>
          {visibleMcLines.map(mc => (
            <span key={mc} className="badge badge-sm badge-outline border-base-300 text-base-content/70 font-medium bg-base-100/50 shrink-0 px-2 shadow-sm">
              {mc}
            </span>
          ))}
          {showMcToggle && (
            <span 
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="badge badge-sm shrink-0 border-none bg-base-200 text-base-content/60 hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer shadow-sm"
            >
              {expanded ? "Collapse" : `+ ${mcLinesList.length - MAX_VISIBLE}`}
            </span>
          )}
        </div>
      </td>
      <td className={`text-right font-mono align-middle py-4 ${selectedUnit === 'lot' ? 'text-primary font-bold text-[15px]' : 'text-base-content/40 text-sm'}`}>
        {lotQty.toLocaleString()}
      </td>
      <td className={`text-right font-mono align-middle py-4 ${selectedUnit === 'sht' ? 'text-primary font-bold text-[15px]' : 'text-base-content/40 text-sm'}`}>
        {shtQty.toLocaleString()}
      </td>
      <td className={`text-right font-mono align-middle py-4 pr-4 lg:pr-6 ${selectedUnit === 'piece' ? 'text-primary font-bold text-[15px]' : 'text-base-content/40 text-sm'}`}>
        {pieceQty.toLocaleString()}
      </td>
    </tr>
  );
};

export const SummaryTable: React.FC<SummaryTableProps> = ({ visibleLineGroups, totals, selectedUnit, rows, isLoading }) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [visibleLineGroups.length]);

  const totalItems = visibleLineGroups.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const validPage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (validPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);

  const paginatedLineGroups = useMemo(() => {
    return visibleLineGroups.slice(startIndex, endIndex);
  }, [visibleLineGroups, startIndex, endIndex]);

  if (visibleLineGroups.length === 0 && !isLoading) return null;

  return (
    <div className="bg-base-100 rounded-2xl shadow-xs border border-base-200 overflow-hidden flex flex-col min-h-[250px] transition-all duration-300">
      <div className="overflow-x-auto overflow-y-hidden flex-1">
        <table className="table table-sm w-full">
          <thead className="bg-base-200/50 text-base-content/70 uppercase text-[10px] tracking-wider border-b border-base-300">
            <tr>
              <th className="py-3 pl-4 lg:pl-6 font-bold"><div className="flex items-center gap-1.5"><LayersIcon size={14} className="text-primary"/> Line Group</div></th>
              <th className="py-3 font-bold"><div className="flex items-center gap-1.5"><Activity size={14} className="text-primary"/> Processes</div></th>
              <th className="py-3 font-bold"><div className="flex items-center gap-1.5"><Monitor size={14} className="text-primary"/> Machine / Lines</div></th>
              <th className={`py-3 text-right font-bold ${selectedUnit === 'lot' ? 'text-primary text-xs' : ''}`}><div className="flex items-center justify-end gap-1.5"><Box size={14} className={selectedUnit === 'lot' ? 'text-primary' : 'opacity-60'}/> Lot Qty</div></th>
              <th className={`py-3 text-right font-bold ${selectedUnit === 'sht' ? 'text-primary text-xs' : ''}`}><div className="flex items-center justify-end gap-1.5"><Layers size={14} className={selectedUnit === 'sht' ? 'text-primary' : 'opacity-60'}/> Sht Qty</div></th>
              <th className={`py-3 pr-4 lg:pr-6 text-right font-bold ${selectedUnit === 'piece' ? 'text-primary text-xs' : ''}`}><div className="flex items-center justify-end gap-1.5"><Package size={14} className={selectedUnit === 'piece' ? 'text-primary' : 'opacity-60'}/> Piece Qty</div></th>
            </tr>
          </thead>
          <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skeleton-${i}`} className="border-b border-base-200/50">
                <td className="py-4"><div className="h-4 bg-base-300 rounded w-24 animate-pulse"></div></td>
                <td className="py-4"><div className="h-4 bg-base-300 rounded w-32 animate-pulse"></div></td>
                <td className="py-4"><div className="h-4 bg-base-300 rounded w-48 animate-pulse"></div></td>
                <td className="py-4"><div className="h-4 bg-base-300 rounded w-16 ml-auto animate-pulse"></div></td>
                <td className="py-4"><div className="h-4 bg-base-300 rounded w-16 ml-auto animate-pulse"></div></td>
                <td className="py-4"><div className="h-4 bg-base-300 rounded w-16 ml-auto animate-pulse"></div></td>
              </tr>
            ))
          ) : (
            paginatedLineGroups.map(group => (
              <SummaryTableRow 
                key={group.name}
                group={group}
                totals={totals}
                rows={rows}
                selectedUnit={selectedUnit}
              />
            ))
          )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {totalItems > 0 && (
        <div className="px-4 py-2.5 bg-base-200/40 border-t border-base-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-base-content/70 whitespace-nowrap">
            <span>Showing</span>
            <span className="font-bold text-base-content font-mono">{totalItems === 0 ? 0 : `${startIndex + 1} - ${endIndex}`}</span>
            <span>of</span>
            <span className="font-bold text-base-content font-mono">{totalItems}</span>
            <span>records</span>
          </div>

          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <button
              type="button"
              className="btn btn-xs btn-ghost btn-square rounded-lg border border-base-300/50"
              disabled={validPage <= 1}
              onClick={() => setCurrentPage(1)}
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              type="button"
              className="btn btn-xs btn-ghost btn-square rounded-lg border border-base-300/50"
              disabled={validPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="px-2 font-medium text-base-content/70">
              Page <span className="font-bold text-base-content font-mono">{validPage}</span> of {totalPages}
            </span>

            <button
              type="button"
              className="btn btn-xs btn-ghost btn-square rounded-lg border border-base-300/50"
              disabled={validPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              className="btn btn-xs btn-ghost btn-square rounded-lg border border-base-300/50"
              disabled={validPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              title="Last Page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
