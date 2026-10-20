import React, { useId } from "react";
import { Search, X } from "lucide-react";
import { formatLotOutTime, LOT_INDEX_MAX_DAYS, LOT_SUGGEST_LIMIT, type LotSearchState } from "./useLotSearch";

interface LotSearchBoxProps {
  search: LotSearchState;
  // ช่วงวันที่ที่ค้น (แสดงในข้อความ "ไม่พบ")
  rangeLabel: string;
  getProcessColor: (processName: string) => string;
  // ความกว้างของช่องค้นหา (Tailwind class) — ค่าเริ่มต้นเท่าช่อง Search Process ของกราฟ
  widthClass?: string;
  // ชิดซ้าย/ขวาของรายการแนะนำ — ช่องที่อยู่ชิดขวาของการ์ดใช้ "right" เพื่อไม่ให้ล้นจอ
  align?: "left" | "right";
  // tooltip ของช่องค้นหา
  title?: string;
}

// ช่องค้นหา Lot No. พร้อมรายการแนะนำระหว่างพิมพ์ — state ทั้งหมดมาจาก useLotSearch
// หน้าตา (font, ขนาด, ไอคอน, ปุ่มล้าง) เหมือนช่อง Search Process ใน ProcessDateChart / TopOutputChart
const LotSearchBox: React.FC<LotSearchBoxProps> = ({
  search,
  rangeLabel,
  getProcessColor,
  widthClass = "w-full sm:w-52",
  align = "left",
  title = "พิมพ์ Lot No. อย่างน้อย 3 ตัวอักษร แล้วเลือกจากรายการ หรือกด Enter เพื่อดูทุก lot ที่ตรงกัน"
}) => {
  const listId = useId();
  const trimmedInput = search.input.trim();
  const showClear = Boolean(search.input || search.term);
  const showRangeTooLong = search.suggestOpen && search.rangeTooLong;
  const showSuggestions = search.suggestOpen && !search.rangeTooLong && trimmedInput.length >= 3 &&
    search.index !== null && search.index.status !== "loading";

  return (
    <form onSubmit={search.submit} role="search" className={`relative ${widthClass}`}>
      <input
        type="text"
        placeholder="Search Lot No..."
        // padding ขวาเผื่อ spinner + ปุ่มล้างเมื่อแสดงพร้อมกัน
        className={`input input-sm input-bordered w-full pl-8 ${search.suggestLoading && showClear ? "pr-12" : "pr-7"} bg-base-100 shadow-none focus:outline-none focus:ring-0 focus:border-primary`}
        aria-label="Search Lot No."
        title={title}
        value={search.input}
        onChange={(e) => {
          search.setInput(e.target.value);
          search.setSuggestOpen(true);
          search.setSuggestIndex(-1);
        }}
        // โหลดรายการ lot ของช่วงตั้งแต่กดที่ช่อง — พิมพ์เสร็จก็พร้อมแนะนำทันที
        onFocus={() => {
          search.requestIndex();
          search.setSuggestOpen(true);
        }}
        onBlur={() => search.setSuggestOpen(false)}
        onKeyDown={search.handleKeyDown}
        autoComplete="off"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls={listId}
      />
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/40 w-3.5 h-3.5 pointer-events-none" />
      {(search.suggestLoading || showClear) && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {search.suggestLoading && <span className="loading loading-spinner loading-xs text-base-content/40"></span>}
          {showClear && (
            <button
              type="button"
              onClick={search.clear}
              className="text-base-content/40 hover:text-base-content text-xs p-0.5"
              title="Clear Search"
              aria-label="Clear lot search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {(showRangeTooLong || showSuggestions) && (
        <ul
          id={listId}
          role="listbox"
          className={`absolute ${align === "left" ? "left-0" : "right-0"} top-full mt-1 z-50 w-80 max-w-[calc(100vw-2rem)] max-h-72 overflow-y-auto scrollbar-thin rounded-xl border border-base-300 bg-base-100 shadow-2xl p-1`}
        >
          {showRangeTooLong ? (
            <li className="px-3 py-2 text-xs text-base-content/60">
              ช่วงวันที่ยาวเกิน {LOT_INDEX_MAX_DAYS} วัน — เลือก From–To ให้สั้นลงเพื่อค้นหา Lot No.
            </li>
          ) : search.suggestions.length === 0 ? (
            <li className="px-3 py-2 text-xs text-base-content/50">
              {search.index?.status === "error"
                ? "Cannot load lot data — กด Enter เพื่อลองใหม่"
                : `ไม่พบ Lot No. ที่มี "${trimmedInput}" ช่วง ${rangeLabel}`}
            </li>
          ) : (
            <>
              {search.suggestions.slice(0, LOT_SUGGEST_LIMIT).map((s, i) => (
                <li
                  key={s.lot}
                  role="option"
                  aria-selected={i === search.suggestIndex}
                  // onMouseDown: เลือกก่อน input blur ปิดรายการ
                  onMouseDown={(e) => {
                    e.preventDefault();
                    search.searchLot(s.lot);
                  }}
                  onMouseEnter={() => search.setSuggestIndex(i)}
                  className={`flex items-center justify-between gap-3 px-3 py-1.5 rounded cursor-pointer transition-colors ${i === search.suggestIndex ? "bg-primary/10" : "hover:bg-base-200"}`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-base-content/85 truncate">{s.lot}</span>
                    <span className="text-[10px] text-base-content/50 truncate">{s.product}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 shrink-0 text-[10px] text-base-content/60" title="Process ล่าสุดในช่วงวันที่ที่ค้น">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getProcessColor(s.latestProcess) }}></span>
                    <span className="font-semibold">{s.latestProcess || "-"}</span>
                    <span className="text-base-content/40">{formatLotOutTime(s.outTime)}</span>
                  </span>
                </li>
              ))}
              {search.suggestions.length > LOT_SUGGEST_LIMIT && (
                <li className="px-3 py-1.5 text-[10px] text-base-content/45 border-t border-base-200">
                  +{(search.suggestions.length - LOT_SUGGEST_LIMIT).toLocaleString()} lot — พิมพ์เพิ่มเพื่อจำกัดผล หรือกด Enter เพื่อดูทั้งหมด
                </li>
              )}
            </>
          )}
        </ul>
      )}
    </form>
  );
};

export default LotSearchBox;
