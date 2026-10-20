import React, { useState, useEffect, useMemo, useRef } from "react";
import { getApiBaseUrl } from "../../../utils/apiConfig";

// แถวจาก /outputbyprocess/lot-index — เฉพาะคอลัมน์ที่ช่องค้นหา Lot No. ใช้
export interface LotIndexRow {
  lot: string;
  product_name: string | null;
  process_name?: string | null;
  out_time: string;
  input_qty: number | string | null;
}

export interface LotIndexState {
  status: "loading" | "ok" | "error";
  rows: LotIndexRow[];
}

// ผลค้นหา Lot No. (rows เรียงตาม lot แล้ว out_time)
export interface LotSearchResult {
  status: "loading" | "ok" | "error";
  rows: LotIndexRow[];
}

export interface LotSuggestion {
  lot: string;
  product: string;
  latestProcess: string;
  outTime: string;
}

// จำนวนวันสูงสุดที่ /lot-index รับได้ (ตรงกับ LOT_INDEX_MAX_DAYS ฝั่ง backend)
export const LOT_INDEX_MAX_DAYS = 31;

// จำนวนรายการแนะนำที่แสดงใต้ช่องค้นหา
export const LOT_SUGGEST_LIMIT = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

// แถวที่เรียงตาม lot แล้ว out_time → [{ lot, rows }] — แถวสุดท้ายของแต่ละ lot คือ process ล่าสุด
export const groupLotRows = (rows: LotIndexRow[]) => {
  const groupMap = new Map<string, LotIndexRow[]>();
  rows.forEach(row => {
    const lotNo = (row.lot || "").trim();
    if (!groupMap.has(lotNo)) groupMap.set(lotNo, []);
    groupMap.get(lotNo)!.push(row);
  });
  return Array.from(groupMap, ([lot, lotRows]) => ({ lot, rows: lotRows }));
};

// "14/10/2026 09:12" → "14/10 09:12"
export const formatLotOutTime = (outTime?: string | null) =>
  (outTime || "-").trim().replace(/^(\d{2}\/\d{2})\/\d{4}/, "$1");

// out_time "DD/MM/YYYY HH:MI" → วันผลิต YYYY-MM-DD (ตัดรอบ 08:00 — ก่อน 08:00 นับเป็นวันก่อนหน้า)
export const getLotProductionDate = (outTime?: string | null): string | null => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/.exec((outTime || "").trim());
  if (!match) return null;
  const [, dd, mm, yyyy, hh] = match;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  if (Number(hh) < 8) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().split("T")[0];
};

// ช่องค้นหา Lot No.: lot ออกจาก gate process ไหนบ้างในช่วง startDate–endDate
// โหลด lot ทั้งช่วงครั้งเดียว (/lot-index) เมื่อเริ่มใช้ช่องค้นหา แล้วค้นและแนะนำ lot ในเบราว์เซอร์ทันทีระหว่างพิมพ์
// โหลดใหม่เมื่อเปลี่ยนช่วงวันที่, refreshTrigger เปลี่ยน (กด Refresh — ข้าม cache ฝั่ง backend)
// หรือ reloadTick เปลี่ยน (auto refresh — ใช้ cache ฝั่ง backend ได้)
export function useLotSearch(startDate: string | undefined, endDate: string | undefined, refreshTrigger: number, reloadTick = 0) {
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const [wanted, setWanted] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [index, setIndex] = useState<LotIndexState | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestIndex, setSuggestIndex] = useState(-1);
  // refreshTrigger ที่ใช้โหลดครั้งล่าสุด — กด Refresh แล้วให้ข้าม cache ฝั่ง backend
  const refreshRef = useRef(refreshTrigger);
  // ช่วงวันที่ของรายการ lot ที่แสดงอยู่ (โหลดสำเร็จแล้ว) — โหลดซ้ำช่วงเดิมจะเก็บรายการเดิมไว้ระหว่างโหลด
  const loadedRangeRef = useRef<string | null>(null);

  const rangeTooLong = Boolean(startDate && endDate) &&
    (new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) / DAY_MS + 1 > LOT_INDEX_MAX_DAYS;

  useEffect(() => {
    if (!wanted) return;
    if (!startDate || !endDate || rangeTooLong) {
      // ไม่มีช่วงวันที่ หรือช่วงยาวเกิน — ล้างรายการ lot ของช่วงก่อน ไม่ให้แนะนำ lot ผิดช่วง
      loadedRangeRef.current = null;
      setIndex(null);
      return;
    }
    // ยกเลิก request ที่ค้างเมื่อเปลี่ยนช่วง/ออกจากหน้า หรือเกิน 60 วินาที
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    let disposed = false;

    // โหลดซ้ำช่วงเดิม (auto refresh / Refresh): เก็บรายการเดิมไว้ระหว่างโหลด ผลค้นหาไม่กระพริบ
    // และถ้าโหลดไม่สำเร็จก็ใช้รายการเดิมต่อ — ช่วงใหม่จึงจะล้างเป็นสถานะ loading
    const rangeKey = `${startDate}|${endDate}`;
    const background = loadedRangeRef.current === rangeKey;
    if (!background) {
      loadedRangeRef.current = null;
      setIndex({ status: "loading", rows: [] });
    }
    const params = new URLSearchParams({ startDate, endDate });
    if (refreshRef.current !== refreshTrigger) {
      refreshRef.current = refreshTrigger;
      params.append("_t", String(Date.now()));
    }
    fetch(`${getApiBaseUrl()}/outputbyprocess/lot-index?${params.toString()}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { lots?: LotIndexRow[] }) => {
        if (disposed) return;
        loadedRangeRef.current = rangeKey;
        setIndex({ status: "ok", rows: Array.isArray(data?.lots) ? data.lots : [] });
      })
      .catch(error => {
        if (disposed) return;
        console.error("Failed to load lot index", error);
        if (!background) setIndex({ status: "error", rows: [] });
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      disposed = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [wanted, startDate, endDate, rangeTooLong, retryCount, refreshTrigger, reloadTick]);

  // lot ที่มีคำค้นอยู่ในเลข lot (ไม่สนตัวพิมพ์) — เรียงตาม lot, ภายใน lot เรียงตาม out_time (sort แบบ stable)
  const result = useMemo<LotSearchResult | null>(() => {
    if (!term || !index) return null;
    if (index.status !== "ok") return { status: index.status, rows: [] };
    const upper = term.toUpperCase();
    const rows = index.rows
      .filter(row => (row.lot || "").toUpperCase().includes(upper))
      .sort((a, b) => (a.lot || "").localeCompare(b.lot || ""));
    return { status: "ok", rows };
  }, [term, index]);

  // Lot No. ที่ตรงกับคำค้น — ใช้เน้นป้าย Lot No.
  const hits = useMemo(
    () => new Set((result?.status === "ok" ? result.rows : []).map(row => (row.lot || "").trim())),
    [result]
  );

  // รายการแนะนำ Lot No. ระหว่างพิมพ์ (เช่น พิมพ์ 2604 → 2604xxxx1, 2604xxxx2)
  const suggestions = useMemo<LotSuggestion[]>(() => {
    const upper = input.trim().toUpperCase();
    if (upper.length < 3 || index?.status !== "ok") return [];
    // แถวเรียงตาม out_time — แถวหลังสุดของแต่ละ lot คือ process ล่าสุด
    const byLot = new Map<string, LotIndexRow>();
    index.rows.forEach(row => {
      const lot = (row.lot || "").trim();
      if (lot.toUpperCase().includes(upper)) byLot.set(lot, row);
    });
    return Array.from(byLot, ([lot, row]) => ({
      lot,
      product: row.product_name || "-",
      latestProcess: (row.process_name || "").trim(),
      outTime: row.out_time || ""
    }))
      // lot ที่ขึ้นต้นด้วยคำค้นแสดงก่อน
      .sort((a, b) => Number(!a.lot.toUpperCase().startsWith(upper)) - Number(!b.lot.toUpperCase().startsWith(upper)) || a.lot.localeCompare(b.lot));
  }, [input, index]);

  const suggestLoading = index?.status === "loading" && input.trim().length >= 3;

  // ค้น lot นี้ทันที — ใช้ทั้งตอนเลือกจากรายการแนะนำ และตอนส่งต่อ lot จากช่องค้นหาอื่น
  const searchLot = (lot: string) => {
    setWanted(true);
    setInput(lot);
    setTerm(lot);
    setSuggestOpen(false);
    setSuggestIndex(-1);
  };

  const retry = () => setRetryCount(n => n + 1);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = input.trim();
    if (value.length < 3) return;
    setWanted(true);
    setTerm(value);
    if (index?.status === "error") retry();
    setSuggestOpen(false);
  };

  const clear = () => {
    setInput("");
    setTerm("");
    setSuggestOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = Math.min(suggestions.length, LOT_SUGGEST_LIMIT);
    if (e.key === "Escape") {
      setSuggestOpen(false);
    } else if (e.key === "ArrowDown" && count > 0) {
      e.preventDefault();
      setSuggestOpen(true);
      setSuggestIndex(i => (i + 1) % count);
    } else if (e.key === "ArrowUp" && count > 0) {
      e.preventDefault();
      setSuggestIndex(i => (i <= 0 ? count - 1 : i - 1));
    } else if (e.key === "Enter" && suggestOpen && suggestIndex >= 0 && suggestIndex < count) {
      e.preventDefault();
      searchLot(suggestions[suggestIndex].lot);
    }
  };

  return {
    input,
    setInput,
    term,
    index,
    result,
    hits,
    suggestions,
    suggestLoading,
    suggestOpen,
    setSuggestOpen,
    suggestIndex,
    setSuggestIndex,
    rangeTooLong,
    requestIndex: () => setWanted(true),
    retry,
    submit,
    clear,
    searchLot,
    handleKeyDown
  };
}

export type LotSearchState = ReturnType<typeof useLotSearch>;
