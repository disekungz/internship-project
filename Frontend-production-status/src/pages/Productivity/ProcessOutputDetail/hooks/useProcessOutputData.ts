import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiOutputRow,
  DEFAULT_LINE_GROUPS,
  LineGroup,
  LineGroupFilter,
  LineGroupRow,
  OutputUnit,
  UnitTotals,
} from "../types";

/**
 * Factory production cutoff logic:
 * Output of day D is finalized and cut off at 09:00 AM on D+1.
 * - If current time (Asia/Bangkok) is before 09:00 AM, yesterday's production is not yet finalized,
 *   so the latest closed production output date is D-2.
 * - If current time is on or after 09:00 AM, the latest closed production output date is yesterday (D-1).
 */
export const getCutoffYesterday = (): string => {
  const now = new Date();
  const thaiHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      hour: "numeric",
      hour12: false,
    }).format(now),
    10
  );
  const daysToSubtract = thaiHour < 9 ? 2 : 1;
  const d = new Date(now.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

import { getApiBaseUrl } from "@/utils/apiConfig";

const API_BASE_URL = getApiBaseUrl();

export interface UseProcessOutputDataParams {
  initialStartDate?: string;
  initialEndDate?: string;
  initialFactory?: string;
}

export const useProcessOutputData = (params?: UseProcessOutputDataParams) => {
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const cutoffYesterday = getCutoffYesterday();

  const initialEnd = params?.initialEndDate || searchParams.get("endDate");
  const defaultEndDate = initialEnd && initialEnd <= cutoffYesterday ? initialEnd : cutoffYesterday;

  const initialStart = params?.initialStartDate || searchParams.get("startDate");
  const defaultStartDate = initialStart
    ? (initialStart > defaultEndDate ? defaultEndDate : initialStart)
    : cutoffYesterday;

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [selectedFactory, setSelectedFactory] = useState<string>(() => params?.initialFactory || searchParams.get("factory") || "ALL");
  const [selectedLineGroup, setSelectedLineGroup] = useState<LineGroupFilter>("ALL");
  const [facUnit, setFacUnit] = useState<string>("ALL");
  const [selectedUnit, setSelectedUnit] = useState<OutputUnit>("lot");
  const [lineGroups, setLineGroups] = useState<LineGroup[]>([...DEFAULT_LINE_GROUPS]);
  const [rows, setRows] = useState<LineGroupRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const activeLineGroups = useMemo(() => {
    let result = lineGroups;
    if (selectedFactory !== "ALL") {
      result = result.filter(group => group.factory === selectedFactory);
    }
    if (selectedLineGroup !== "ALL" && selectedLineGroup.length > 0) {
      result = result.filter(group => selectedLineGroup.includes(group.name));
    }
    return result;
  }, [lineGroups, selectedLineGroup, selectedFactory]);

  const fetchLineGroups = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/productivity/line-groups`);
      if (!res.ok) throw new Error("Failed to fetch line groups");

      const data: LineGroup[] = await res.json();
      if (data.length > 0) {
        setLineGroups(data);
        if (selectedLineGroup !== "ALL") {
          const validSelections = selectedLineGroup.filter(name => data.some(g => g.name === name));
          if (validSelections.length === 0) {
            setSelectedLineGroup("ALL");
          } else if (validSelections.length !== selectedLineGroup.length) {
            setSelectedLineGroup(validSelections);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch productivity line groups", error);
    }
  }, [selectedLineGroup]);

  const fetchLineGroupOutput = useCallback(async () => {
    if (!startDate || !endDate) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const params = new URLSearchParams();
      params.append("startDate", startDate);
      params.append("endDate", endDate);
      params.append("lineGroup", selectedLineGroup === "ALL" ? "ALL" : selectedLineGroup.join(","));
      if (facUnit !== "ALL") {
        params.append("facUnit", facUnit);
      }
      if (selectedFactory !== "ALL") {
        params.append("factory", selectedFactory);
      }

      const res = await fetch(`${API_BASE_URL}/productivity/process-output-detail?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch process output detail");

      const data: ApiOutputRow[] = await res.json();
      const groupedRows = new Map<string, LineGroupRow>();

      data.forEach(item => {
        const process = item.process_name?.trim().toUpperCase() || "";
        const mcLine = item.mc_line?.trim() || "Unknown";
        const lineGroup = item.line_group?.trim();
        if (!lineGroup || lineGroup === "UNKNOWN" || !item.output_date) return;

        const key = `${item.output_date}||${lineGroup}||${mcLine}`;
        if (!groupedRows.has(key)) {
          groupedRows.set(key, {
            date: item.output_date,
            process,
            lineGroup,
            mcLine,
            lotQty: 0,
            shtQty: 0,
            pieceQty: 0,
            facUnitCode: item.fac_unit_code,
          });
        } else {
          const existing = groupedRows.get(key)!;
          if (!existing.process.split(', ').includes(process)) {
            existing.process += `, ${process}`;
          }
        }

        groupedRows.get(key)!.lotQty += Number(item.actual_lot_qty || 0);
        groupedRows.get(key)!.shtQty += Number(item.actual_sht_qty || 0);
        groupedRows.get(key)!.pieceQty += Number(item.actual_piece_qty || 0);
      });

      setRows(
        Array.from(groupedRows.values()).sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            a.lineGroup.localeCompare(b.lineGroup) ||
            a.process.localeCompare(b.process) ||
            a.mcLine.localeCompare(b.mcLine)
        )
      );
    } catch (error) {
      console.error("Failed to fetch process output detail", error);
      setRows([]);
      setErrorMessage("Cannot load process output detail right now.");
    } finally {
      setIsLoading(false);
    }
  }, [endDate, selectedLineGroup, facUnit, startDate, selectedFactory]);

  useEffect(() => {
    fetchLineGroups();
  }, [fetchLineGroups]);

  useEffect(() => {
    fetchLineGroupOutput();
  }, [fetchLineGroupOutput]);

  const totals = useMemo(() => {
    const byLineGroup = new Map<string, UnitTotals>();
    rows.forEach(row => {
      const key = row.lineGroup.toUpperCase();
      const current = byLineGroup.get(key) || { lotQty: 0, shtQty: 0, pieceQty: 0 };
      byLineGroup.set(key, {
        lotQty: current.lotQty + row.lotQty,
        shtQty: current.shtQty + row.shtQty,
        pieceQty: current.pieceQty + row.pieceQty,
      });
    });
    return byLineGroup;
  }, [rows]);

  const visibleLineGroups = useMemo(() => {
    return activeLineGroups;
  }, [activeLineGroups]);

  return {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    selectedFactory,
    setSelectedFactory,
    selectedLineGroup,
    setSelectedLineGroup,
    facUnit,
    setFacUnit,
    selectedUnit,
    setSelectedUnit,
    lineGroups,
    rows,
    isLoading,
    errorMessage,
    fetchLineGroupOutput,
    totals,
    visibleLineGroups,
    cutoffYesterday,
  };
};
