import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { getApiBaseUrl } from "../../../../utils/apiConfig";

// One lot found by /outputbyproduct/lot-search, merged over the processes it passed through
export interface LotSearchHit {
  lot: string;
  product_name: string;
  prod_date: string;
  processes: string[];
}

interface LotSearchRow {
  lot: string;
  product_name: string;
  process_name: string;
  prod_date: string;
}

interface LotSearchBoxProps {
  startDate: string;
  endDate: string;
  onSelect: (hit: LotSearchHit) => void;
}

const MIN_LENGTH = 3;

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
};

// Lot No. search next to the product search: finds lots in startDate..endDate
// and lets the user jump to the product + production day of a lot
export const LotSearchBox: React.FC<LotSearchBoxProps> = ({ startDate, endDate, onSelect }) => {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [rows, setRows] = useState<LotSearchRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search; a newer keystroke cancels the pending request result
  useEffect(() => {
    const term = input.trim();
    if (term.length < MIN_LENGTH || !startDate || !endDate) {
      setStatus("idle");
      setRows([]);
      setTruncated(false);
      return;
    }

    let cancelled = false;
    setStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ lot: term, startDate, endDate });
        const res = await fetch(`${getApiBaseUrl()}/outputbyproduct/lot-search?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { lots?: LotSearchRow[]; truncated?: boolean } = await res.json();
        if (cancelled) return;
        setRows(data.lots || []);
        setTruncated(!!data.truncated);
        setStatus("ok");
      } catch (error) {
        console.error("Failed to search lot numbers", error);
        if (!cancelled) setStatus("error");
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [input, startDate, endDate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setShowResults(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // One result per lot + product + production day (the API returns one row per process)
  const hits = useMemo(() => {
    const map = new Map<string, LotSearchHit>();
    rows.forEach(row => {
      const key = `${row.lot}|${row.product_name}|${row.prod_date}`;
      const hit = map.get(key);
      if (hit) {
        if (!hit.processes.includes(row.process_name)) hit.processes.push(row.process_name);
      } else {
        map.set(key, { lot: row.lot, product_name: row.product_name, prod_date: row.prod_date, processes: [row.process_name] });
      }
    });
    return Array.from(map.values());
  }, [rows]);

  const isActive = input.trim().length >= MIN_LENGTH;

  return (
    <div className="relative w-full sm:w-44 shrink-0" ref={boxRef}>
      <input
        type="text"
        placeholder="Search Lot No..."
        maxLength={50}
        className="input input-sm input-bordered w-full pl-8 pr-7 bg-base-100 shadow-none focus:outline-none focus:ring-0 focus:border-primary"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setShowResults(true);
        }}
        onFocus={() => setShowResults(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setShowResults(false);
          if (e.key === "Enter" && hits.length === 1) {
            onSelect(hits[0]);
            setShowResults(false);
          }
        }}
      />
      <Search className="w-4 h-4 absolute left-2.5 top-2 text-base-content/50" />

      {input && (
        <button
          type="button"
          onClick={() => {
            setInput("");
            setShowResults(false);
          }}
          className="absolute right-2.5 top-2 text-base-content/40 hover:text-base-content text-xs font-bold leading-none cursor-pointer"
          title="Clear lot search"
        >
          ✕
        </button>
      )}

      {showResults && input.trim() !== "" && (
        <div className="absolute left-0 top-full mt-1 z-50 w-full sm:w-80 max-h-72 overflow-y-auto rounded-lg border border-base-300 bg-base-100 py-1 shadow-lg scrollbar-thin">
          {!isActive ? (
            <div className="px-3.5 py-2 text-xs text-base-content/50">Type at least {MIN_LENGTH} characters</div>
          ) : status === "loading" || status === "idle" ? (
            <div className="px-3.5 py-2 text-xs text-base-content/60 flex items-center gap-2">
              <span className="loading loading-spinner loading-xs"></span>
              Searching lots...
            </div>
          ) : status === "error" ? (
            <div className="px-3.5 py-2 text-xs text-error">Cannot search lot data</div>
          ) : hits.length === 0 ? (
            <div className="px-3.5 py-2 text-xs text-base-content/50">
              No lot found between {formatDate(startDate)} and {formatDate(endDate)}
            </div>
          ) : (
            <>
              {hits.map(hit => (
                <button
                  key={`${hit.lot}_${hit.product_name}_${hit.prod_date}`}
                  type="button"
                  className="w-full text-left px-3.5 py-2 text-xs hover:bg-base-200 cursor-pointer flex flex-col gap-0.5 text-base-content/85 transition-colors border-b border-base-200/60 last:border-b-0"
                  title={hit.processes.join(", ")}
                  onClick={() => {
                    setInput(hit.lot);
                    setShowResults(false);
                    onSelect(hit);
                  }}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold">{hit.lot}</span>
                    <span className="text-[10px] text-base-content/50 shrink-0">{formatDate(hit.prod_date)}</span>
                  </span>
                  <span className="text-[11px] text-base-content/60 truncate">
                    {hit.product_name} · {hit.processes.length} process{hit.processes.length > 1 ? "es" : ""}
                  </span>
                </button>
              ))}
              {truncated && (
                <div className="px-3.5 py-2 text-[11px] text-warning">Too many results, type more digits to narrow down</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
