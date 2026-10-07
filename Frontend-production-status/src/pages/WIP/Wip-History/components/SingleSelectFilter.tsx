"use client";

import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";

/* ==========================================================================
   คอมโพเนนต์ SingleSelectFilter (เพิ่มประสิทธิภาพด้วยการจำกัดการเรนเดอร์)
   ========================================================================== */
export function SingleSelectFilter({
    label,
    options,
    selected,
    onChange,
    icon,
}: {
    label: string;
    options: string[];
    selected: string;
    onChange: (val: string) => void;
    icon?: ReactNode;
}) {
    const [searchTerm, setSearchTerm] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDetailsElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                dropdownRef.current.open = false;
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        const lower = searchTerm.toLowerCase();
        return options.filter((opt) => opt.toLowerCase().includes(lower));
    }, [options, searchTerm]);

    const displayedOptions = useMemo(() => {
        return filteredOptions.slice(0, 100);
    }, [filteredOptions]);

    const handleSelect = (val: string) => {
        onChange(val);
        if (dropdownRef.current) {
            dropdownRef.current.open = false;
            setIsOpen(false);
        }
    };

    return (
        <details
            ref={dropdownRef}
            className="relative inline-block"
            onToggle={(e) => setIsOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
            <summary className="cursor-pointer select-none list-none px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-sm flex items-center gap-2 transition-colors">
                {icon && <span className="text-slate-400">{icon}</span>}
                <span className="font-semibold text-slate-700">
                    {selected !== "all"
                        ? <>{label}: <span className="text-blue-600 font-bold ml-0.5">{selected}</span></>
                        : label
                    }
                </span>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-3.5 h-3.5 text-slate-400"
                >
                    <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                    />
                </svg>
            </summary>

            {isOpen && (
                <div
                    className="absolute z-50 top-full mt-2 p-2 bg-white border border-slate-200 rounded-2xl shadow-xl w-max min-w-[170px] left-0 box-border"
                >
                    <div className="mb-2 w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus-within:ring-2 focus-within:ring-indigo-400/60 focus-within:border-indigo-400 focus-within:bg-white transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-slate-400 shrink-0">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                        <input
                            type="text"
                            className="w-full text-xs bg-transparent border-none outline-none focus:outline-none p-0 text-slate-700 placeholder:text-slate-400 min-w-0"
                            placeholder="ค้นหา..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-[2px] max-h-56 overflow-y-auto pr-1">
                        {!searchTerm && (
                            <div
                                onClick={() => handleSelect("all")}
                                className={`flex items-center justify-between text-xs font-bold cursor-pointer rounded-lg px-2.5 py-2 transition-colors select-none ${selected === "all"
                                    ? "bg-indigo-50/60 text-blue-700 hover:bg-indigo-50"
                                    : "text-slate-600 hover:bg-slate-50"
                                    }`}
                            >
                                <span>All</span>
                                {selected === "all" && (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-blue-600 shrink-0">
                                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                        )}

                        {displayedOptions.length > 0 ? (
                            <>
                                {displayedOptions.map((opt) => {
                                    const isItemSelected = selected === opt;
                                    return (
                                        <div
                                            key={opt}
                                            onClick={() => handleSelect(opt)}
                                            className={`flex items-center justify-between text-xs font-medium cursor-pointer rounded-lg px-2.5 py-2 transition-colors select-none ${isItemSelected
                                                ? "bg-indigo-50/60 text-blue-700 hover:bg-indigo-50"
                                                : "text-slate-600 hover:bg-slate-50"
                                                }`}
                                        >
                                            <span className="truncate">{opt}</span>
                                            {isItemSelected && (
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-blue-600 shrink-0">
                                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                    );
                                })}
                                {filteredOptions.length > 100 && (
                                    <div className="text-center py-2 text-[11px] text-slate-400 font-medium">
                                        แสดง 100 จาก {filteredOptions.length} รายการ (พิมพ์เพื่อค้นหาเพิ่ม)
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-4 text-xs text-slate-400">ไม่พบรายการที่ค้นหา</div>
                        )}
                    </div>
                </div>
            )}
        </details>
    );
}
