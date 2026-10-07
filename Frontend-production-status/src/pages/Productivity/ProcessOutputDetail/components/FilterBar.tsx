import { CalendarDays, RefreshCcw, Search, Building2, Network, Package, Check, ChevronDown, ArrowLeft } from "lucide-react";
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BASE } from "../../../../routes/config";
import { LineGroup, LineGroupFilter, OutputUnit } from "../types";
import { DatePickerField } from "./DatePickerField";
import { getCutoffYesterday } from "../hooks/useProcessOutputData";

const formatDate = (date: string) => {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;
  return `${match[3]}/${match[2]}/${match[1]}`;
};

type FilterBarProps = {
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  selectedFactory: string;
  setSelectedFactory: (v: string) => void;
  selectedLineGroup: LineGroupFilter;
  setSelectedLineGroup: (v: LineGroupFilter) => void;
  selectedUnit: OutputUnit;
  setSelectedUnit: (v: OutputUnit) => void;
  facUnit?: string;
  setFacUnit?: (v: string) => void;
  cutoffYesterday?: string;
  lineGroups: LineGroup[];
  isLoading: boolean;
  onSearch: () => void;
  isModalMode?: boolean;
};

const selectShellClass =
  "group relative flex h-10 w-full cursor-pointer items-center justify-between rounded-xl border border-base-300 bg-base-100 px-3 text-sm font-medium transition-all hover:border-primary/40 hover:bg-base-200/50 hover:shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const openSelectShellClass = "border-primary bg-base-100 shadow-md ring-2 ring-primary/20";
const dropdownPanelClass =
  "absolute left-0 top-full z-[100] mt-2 w-full overflow-hidden rounded-xl border border-base-300 bg-base-100 p-2 text-sm shadow-[0_18px_45px_rgba(15,23,42,0.18)]";

type FilterSelectProps<T extends string> = {
  label: string;
  icon: React.ReactNode;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
};

const FilterSelect = <T extends string>({
  label,
  icon,
  value,
  onChange,
  options,
  className = "min-w-[130px]",
}: FilterSelectProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(option => option.value === value) ?? options[0];

  return (
    <div className={`relative ${className}`}>
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-base-content/50">
        {label}
      </span>
      <button
        type="button"
        className={`${selectShellClass} ${isOpen ? openSelectShellClass : ""} w-full px-0 text-left`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(open => !open)}
      >
        <span className="flex h-full w-9 items-center justify-center text-base-content/45 transition-colors group-focus-within:text-primary">
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-base-content">
          {selectedOption?.label}
        </span>
        <ChevronDown
          className={`mr-3 h-4 w-4 text-base-content/45 transition-transform ${isOpen ? "rotate-180 text-primary" : ""
            }`}
        />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            className={dropdownPanelClass}
            role="listbox"
          >
            {options.map(option => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left font-semibold transition-colors ${selected
                    ? "bg-primary/5 text-base-content"
                    : "text-base-content hover:bg-primary/5"
                    }`}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${selected ? "bg-primary text-primary-content" : "border border-base-300"
                      }`}
                  >
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export const FilterBar: React.FC<FilterBarProps> = ({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedFactory,
  setSelectedFactory,
  selectedLineGroup,
  setSelectedLineGroup,
  selectedUnit,
  setSelectedUnit,
  facUnit,
  setFacUnit,
  cutoffYesterday,
  lineGroups,
  isLoading,
  onSearch,
  isModalMode = false,
}) => {
  const [lineDropdownOpen, setLineDropdownOpen] = useState(false);
  const effectiveCutoff = cutoffYesterday || getCutoffYesterday();

  const dateRangeLabel = useMemo(() => {
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  }, [startDate, endDate]);

  const sectorOptions = useMemo(() => {
    const base = [
      { value: "ALL", label: "All Types" },
      { value: "SMT", label: "SMT" },
      { value: "FPC", label: "FPC" },
      { value: "QA", label: "QA" },
    ];
    const knownKeys = new Set(base.map(b => b.value.toUpperCase()));

    (lineGroups || []).forEach(g => {
      if (g.factory && !knownKeys.has(g.factory.toUpperCase())) {
        knownKeys.add(g.factory.toUpperCase());
        base.push({ value: g.factory.toUpperCase(), label: g.factory.toUpperCase() });
      }
    });

    return base;
  }, [lineGroups]);

  const availableLineGroups = useMemo(() => {
    if (selectedFactory === "ALL") return lineGroups;
    return lineGroups.filter(g => g.factory === selectedFactory);
  }, [lineGroups, selectedFactory]);

  return (
    <section className={isModalMode
      ? "bg-base-100 p-3.5 rounded-2xl shadow-xs border border-base-200 relative z-20 overflow-visible"
      : "bg-base-100 p-4 sm:p-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5 xl:gap-8 rounded-3xl shadow-xl shadow-base-content/5 border border-base-200/60 relative z-20 overflow-visible"
    }>
      {!isModalMode && (
        <div className="shrink-0 whitespace-nowrap">
          <h1 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-tight flex items-center gap-2">
            Productivity Output
          </h1>
          <div className="flex items-center gap-2 mt-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 shadow-sm text-xs font-bold text-primary tracking-wide">
              <CalendarDays size={14} className="opacity-80" />
              {dateRangeLabel}
            </span>
          </div>
        </div>
      )}

      <div className={isModalMode
        ? "flex flex-wrap items-end gap-2.5 w-full"
        : "flex flex-col xl:flex-row items-stretch xl:items-end gap-3 w-full lg:w-auto"
      }>
        <div className="flex flex-wrap items-end gap-2">
          <DatePickerField label="From" value={startDate} onChange={setStartDate} max={effectiveCutoff} />
          <DatePickerField label="To" value={endDate} onChange={setEndDate} max={effectiveCutoff} />
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => {
                setStartDate(effectiveCutoff);
                setEndDate(effectiveCutoff);
              }}
              className={`btn btn-xs h-10 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                startDate === effectiveCutoff && endDate === effectiveCutoff
                  ? "btn-primary text-white shadow-xs"
                  : "bg-base-100 hover:bg-base-200 border-base-300 text-base-content/80"
              }`}
              title="Select Yesterday's output (Snapshot Output cutoff at 09:00 AM)"
            >
              Yesterday
            </button>
          </div>
        </div>

        <div className="hidden sm:block h-7 w-px bg-base-300 my-auto self-end mb-2" />

        <div className="flex flex-wrap items-end gap-2.5 flex-1 min-w-0">
          <FilterSelect
            label="Sector"
            icon={<Building2 size={16} />}
            value={selectedFactory}
            onChange={value => {
              setSelectedFactory(value);
              setSelectedLineGroup("ALL");
              if (value === "FPC" && selectedUnit === "lot") {
                setSelectedUnit("piece");
              }
            }}
            options={sectorOptions}
          />

          <div className="relative min-w-[160px] overflow-visible">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-base-content/50">
              Line
            </span>
            <button
              type="button"
              className={`${selectShellClass} ${lineDropdownOpen ? openSelectShellClass : ""} w-full px-0 text-left`}
              onClick={() => setLineDropdownOpen(!lineDropdownOpen)}
            >
              <span className="flex h-full w-9 items-center justify-center text-base-content/45 transition-colors group-focus-within:text-primary">
                <Network size={16} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-base-content">
                {selectedLineGroup === "ALL" || selectedLineGroup.length === 0
                  ? "All Lines"
                  : selectedLineGroup.length === 1
                    ? selectedLineGroup[0]
                    : `${selectedLineGroup.length} Lines Selected`}
              </span>
              <ChevronDown
                className={`mr-3 h-4 w-4 text-base-content/45 transition-transform ${lineDropdownOpen ? "rotate-180 text-primary" : ""
                  }`}
              />
            </button>
            {lineDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setLineDropdownOpen(false)} />
                <div className={dropdownPanelClass}>
                  <div className="max-h-[300px] overflow-y-auto">
                    <button
                      type="button"
                      className={`flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left font-semibold transition-colors ${selectedLineGroup === "ALL" || selectedLineGroup.length === 0
                        ? "bg-primary/5 text-base-content"
                        : "text-base-content hover:bg-primary/5"
                        }`}
                      onClick={() => setSelectedLineGroup("ALL")}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${selectedLineGroup === "ALL" || selectedLineGroup.length === 0 ? "bg-primary text-primary-content" : "border border-base-300"
                          }`}
                      >
                        {(selectedLineGroup === "ALL" || selectedLineGroup.length === 0) && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">All Lines</span>
                    </button>
                    {availableLineGroups.map(group => {
                      const selected = selectedLineGroup !== "ALL" && selectedLineGroup.includes(group.name);
                      return (
                        <button
                          key={group.name}
                          type="button"
                          className={`flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left font-semibold transition-colors ${selected
                            ? "bg-primary/5 text-base-content"
                            : "text-base-content hover:bg-primary/5"
                            }`}
                          onClick={(e) => {
                            if (!selected) {
                              if (selectedLineGroup === "ALL") {
                                setSelectedLineGroup([group.name]);
                              } else {
                                setSelectedLineGroup([...selectedLineGroup, group.name]);
                              }
                            } else {
                              if (selectedLineGroup !== "ALL") {
                                const newSelection = selectedLineGroup.filter((n) => n !== group.name);
                                setSelectedLineGroup(newSelection.length > 0 ? newSelection : "ALL");
                              }
                            }
                          }}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors ${selected ? "bg-primary text-primary-content" : "border border-base-300"
                              }`}
                          >
                            {selected && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{group.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>


          <FilterSelect
            label="Output Unit"
            icon={<Package size={16} />}
            value={selectedUnit}
            onChange={setSelectedUnit}
            options={
              selectedFactory === "FPC" && selectedLineGroup !== "ALL" && selectedLineGroup.length > 0 && !selectedLineGroup.some(name => {
                const upper = name.trim().toUpperCase();
                return upper === "LINE BLK" || upper === "LINE OST" || upper === "BLK" || upper === "OST";
              })
                ? [
                    { value: "piece", label: "Piece Output" },
                    { value: "sht", label: "Sht Output" },
                  ]
                : [
                    { value: "piece", label: "Piece Output" },
                    { value: "sht", label: "Sht Output" },
                    { value: "lot", label: "Lot Output" },
                  ]
            }
          />
        </div>

        {!isModalMode && <div className="hidden xl:block h-8 w-px bg-base-300" />}

        <div className={isModalMode ? "flex items-center gap-2 h-10 ml-auto" : "flex items-center gap-2 h-10"}>
          <button
            type="button"
            className="btn btn-primary h-10 min-h-10 px-4 rounded-xl shadow-md shadow-primary/20 transition-all font-semibold flex items-center gap-1.5 cursor-pointer"
            onClick={onSearch}
            disabled={isLoading}
          >
            {isLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span className="text-xs">{isLoading ? "Loading..." : "Search"}</span>
          </button>
        </div>
      </div>
    </section>
  );
};
