/**
 * Component: VdsFormulaManager
 * หน้าต่างจัดการสูตรและกฎการคำนวณ VDS Formula สำหรับระบบ Manpower
 * - กำหนดการคำนวณของกลุ่มไลน์ VDS ตาม Cost Center และสมาชิก Member Lines
 * - เพิ่ม, แก้ไข และบันทึกสูตรลงใน lineGroups.ts ผ่าน Backend API
 */
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  ADMIN_VDS_FORMULA_REGISTRY,
  AdminVdsFormulaRule,
  LINE_GROUPS,
  MACRO_PCN_GROUPS,
  TAB_LINES,
  TAB_TOTAL_LINE_MAP,
  tabMenuList,
} from "../config/lineGroups";
import {
  MANHOUR_COST_CENTER_OPTIONS_ENDPOINT,
  MANHOUR_VDS_FORMULA_ENDPOINT,
} from "../constants";
import ModalButtonIcon from "./ModalButtonIcon";

const formulaMap = LINE_GROUPS as Record<string, string[]>;
const macroFormulaMap = MACRO_PCN_GROUPS as Record<string, string[]>;
const tabLinesMap = TAB_LINES as Record<string, string[]>;
const tabTotalLineMap = TAB_TOTAL_LINE_MAP as Record<string, string>;

type VdsProps = {
  language?: "en" | "th";
  isThai?: boolean;
  initialFormulaToEdit?: string | null;
  onClearInitialFormula?: () => void;
};

export default function VdsFormulaManager({
  isThai = false,
  initialFormulaToEdit,
  onClearInitialFormula,
}: VdsProps) {
  const [subTab, setSubTab] = useState<"create" | "list">("create");
  const [formula, setFormula] = useState("");
  const [editingOriginalFormula, setEditingOriginalFormula] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [costCenters, setCostCenters] = useState<string[]>([]);
  const [costCenterOptions, setCostCenterOptions] = useState<string[]>([]);
  const [costCenterLinesMap, setCostCenterLinesMap] = useState<Record<string, string[]>>({});
  const [costCenterSearch, setCostCenterSearch] = useState("");
  const [costCenterOpen, setCostCenterOpen] = useState(false);
  const [costCentersLoading, setCostCentersLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [vdsRegistry, setVdsRegistry] = useState<Record<string, AdminVdsFormulaRule>>(
    () => ({ ...ADMIN_VDS_FORMULA_REGISTRY })
  );

  /**
   * รายการ Member Lines ที่เลือกได้ตามหน้าที่เลือกไว้ และกรองตาม Cost Centers ที่เลือก (ถ้ามีการเลือก)
   */
  const memberOptions = useMemo(() => {
    // 1. หากมีการเลือกหน้า (Pages) ให้ดึงเฉพาะ Line ในหน้านั้นๆ มิฉะนั้นจะดึง Line ทั้งหมด
    const targetPages = pages.length ? pages : tabMenuList;
    const pageGroups = targetPages.flatMap((page) =>
      (tabLinesMap[page] || []).filter(
        (group) => group !== tabTotalLineMap[page],
      ),
    );
    const candidates = pageGroups.flatMap(
      (group) => macroFormulaMap[group] || formulaMap[group] || [group],
    );

    // 2. หากมีการติ๊กเลือก Cost Centers (เช่น P764) ให้กรองเอาเฉพาะ Line ที่สังกัด Cost Center นั้นๆ
    let filteredCandidates = candidates;
    if (costCenters.length > 0) {
      const allowedLines = new Set<string>();
      costCenters.forEach((cc) => {
        const linesForCc = costCenterLinesMap[cc] || [];
        linesForCc.forEach((ln) => {
          allowedLines.add(ln.trim().toUpperCase());
          // หากเป็น base line เช่น MDS ให้ยอมรับ MDS/A, MDS/B, MDS/D ด้วย
          allowedLines.add(`${ln.trim().toUpperCase()}/A`);
          allowedLines.add(`${ln.trim().toUpperCase()}/B`);
          allowedLines.add(`${ln.trim().toUpperCase()}/D`);
        });
      });

      if (allowedLines.size > 0) {
        filteredCandidates = candidates.filter((line) => {
          const lUpper = line.trim().toUpperCase();
          const baseName = lUpper.replace(/\/[ABD]$/i, "");
          return allowedLines.has(lUpper) || allowedLines.has(baseName);
        });
      }
    }

    const search = memberSearch.trim().toLowerCase();
    return [...new Set(filteredCandidates)]
      .filter(Boolean)
      .filter((line) => !search || line.toLowerCase().includes(search))
      .sort((a, b) => a.localeCompare(b));
  }, [memberSearch, pages, costCenters, costCenterLinesMap]);

  const filteredCostCenters = useMemo(() => {
    let availableCc = costCenterOptions;

    // หากมีการเลือก Member Lines ในช่อง 4 ให้กรอง Cost Center ในช่อง 3 ให้แสดงเฉพาะ Cost Center ที่เป็นเจ้าของ Member Lines นั้น
    if (members.length > 0) {
      const selectedMemberSet = new Set(members.map((m) => m.trim().toUpperCase()));
      availableCc = costCenterOptions.filter((cc) => {
        const linesForCc = costCenterLinesMap[cc] || [];
        return linesForCc.some((ln) => {
          const lUpper = ln.trim().toUpperCase();
          const baseName = lUpper.replace(/\/[ABD]$/i, "");
          return (
            selectedMemberSet.has(lUpper) ||
            selectedMemberSet.has(baseName) ||
            selectedMemberSet.has(`${baseName}/A`) ||
            selectedMemberSet.has(`${baseName}/B`) ||
            selectedMemberSet.has(`${baseName}/D`)
          );
        });
      });
    }

    const search = costCenterSearch.trim().toLowerCase();
    return availableCc.filter(
      (value) => !search || value.toLowerCase().includes(search),
    );
  }, [costCenterOptions, costCenterSearch, members, costCenterLinesMap]);

  const customCostCenterCandidate = costCenterSearch.trim().toUpperCase();
  const canAddCustomCostCenter =
    /^P\d+$/.test(customCostCenterCandidate) &&
    !costCenterOptions.includes(customCostCenterCandidate) &&
    !costCenters.includes(customCostCenterCandidate);

  const fetchVdsRegistry = async () => {
    try {
      const response = await fetch(MANHOUR_VDS_FORMULA_ENDPOINT, {
        cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.formulas) {
          setVdsRegistry(data.formulas);
        }
      }
    } catch {
      // ข้ามกรณีเกิดข้อผิดพลาดในการดึงข้อมูล
    }
  };

  useEffect(() => {
    fetchVdsRegistry();
  }, []);

  useEffect(() => {
    if (!initialFormulaToEdit) return;
    const rule = vdsRegistry[initialFormulaToEdit] || ADMIN_VDS_FORMULA_REGISTRY[initialFormulaToEdit];
    if (rule) {
      setFormula(initialFormulaToEdit);
      setEditingOriginalFormula(initialFormulaToEdit);
      setPages(Array.isArray(rule.pages) ? [...rule.pages] : []);
      setMembers(Array.isArray(rule.lines) ? [...rule.lines] : []);
      setCostCenters(Array.isArray(rule.costCenterPrefixes) ? [...rule.costCenterPrefixes] : []);
      setSubTab("create");
    } else {
      setFormula(initialFormulaToEdit);
      setEditingOriginalFormula(initialFormulaToEdit);
      setSubTab("create");
    }
  }, [initialFormulaToEdit, vdsRegistry]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(MANHOUR_COST_CENTER_OPTIONS_ENDPOINT, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || "Load failed");
        const received = Array.isArray(result.costCenters)
          ? result.costCenters
          : [];
        if (result.costCenterLines) {
          setCostCenterLinesMap(result.costCenterLines);
        }
        if (result.fallback) {
          let previouslyLoaded: string[] = [];
          try {
            previouslyLoaded = JSON.parse(
              localStorage.getItem("manhour-cost-center-options") || "[]",
            );
          } catch {
            previouslyLoaded = [];
          }
          setCostCenterOptions([
            ...new Set([...previouslyLoaded, ...received]),
          ]);
        } else {
          setCostCenterOptions(received);
          try {
            localStorage.setItem(
              "manhour-cost-center-options",
              JSON.stringify(received),
            );
          } catch {
            // การเก็บ LocalStorage Browser Cache เป็นเพียงส่วนเสริม
          }
        }
      })
      .catch((loadError) => {
        if (loadError?.name !== "AbortError") {
          setError(isThai ? "ไม่สามารถโหลดตัวเลือก Cost Center ได้" : "Unable to load Cost Center options");
        }
      })
      .finally(() => setCostCentersLoading(false));
    return () => controller.abort();
  }, [isThai]);

  const togglePage = (page: string) =>
    setPages((current) =>
      current.includes(page)
        ? current.filter((item) => item !== page)
        : [...current, page],
    );

  const toggleMember = (line: string) =>
    setMembers((current) =>
      current.includes(line)
        ? current.filter((item) => item !== line)
        : [...current, line],
    );

  const selectAllVisibleMembers = () => {
    setMembers((current) => [...new Set([...current, ...memberOptions])]);
  };

  const clearAllMembers = () => {
    setMembers([]);
  };

  const toggleCostCenter = (value: string) =>
    setCostCenters((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );

  const resetForm = () => {
    setFormula("");
    setEditingOriginalFormula(null);
    setPages([]);
    setMembers([]);
    setCostCenters([]);
    setError("");
    setMessage("");
  };

  const save = async () => {
    setError("");
    setMessage("");
    const normalizedFormula = formula.trim().toUpperCase();
    if (!normalizedFormula.includes("VDS")) {
      return setError(isThai ? "ชื่อสูตรต้องมีคำว่า 'VDS' อยู่ด้วยเสมอ (เช่น MOMO_VDS, MAT_VDS)" : "Formula name must contain VDS, for example MAT_VDS");
    }
    if (pages.length === 0) return setError(isThai ? "กรุณาเลือกหน้าที่จะแสดงผลอย่างน้อย 1 หน้า" : "Select at least one display page");
    if (members.length === 0)
      return setError(isThai ? "กรุณาเลือกไลน์ย่อย (Member lines) อย่างน้อย 1 ไลน์" : "Select at least one member line");

    setIsSaving(true);
    try {
      const response = await fetch(MANHOUR_VDS_FORMULA_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("manhour-admin-token") || ""}`,
        },
        body: JSON.stringify({
          formula: normalizedFormula,
          pages,
          lines: members,
          costCenterPrefixes: costCenters,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          result?.error || `Save failed (HTTP ${response.status})`,
        );
      }
      // อัปเดต localStorage manhour-line-mappings ทันที เพื่อให้ตารางหน้า Dashboard และโมดอลรับรู้
      try {
        const mappings = JSON.parse(localStorage.getItem("manhour-line-mappings") || "{}");
        mappings[normalizedFormula] = {
          parent: normalizedFormula,
          shifts: [],
          lines: members,
          displayPages: pages,
          macroGroups: [],
          formulaGroups: [],
          costCenterPrefixes: costCenters,
        };
        localStorage.setItem("manhour-line-mappings", JSON.stringify(mappings));
        
        // ล้าง browser fast & daily summary cache ทุกเดือนเพื่อคำนวณใหม่
        Object.keys(localStorage).forEach((key) => {
          if (
            key.startsWith("manhour-summary-") ||
            key.startsWith("manhour-fast-") ||
            key.startsWith("manhour-cache-")
          ) {
            localStorage.removeItem(key);
          }
        });
      } catch {
        // ละเว้นข้อผิดพลาด localStorage
      }

      window.dispatchEvent(new Event("manhour-line-mappings-updated"));
      setMessage(isThai ? `✅ บันทึกสูตร ${result.formula} สำเร็จ กำลังโหลดข้อมูลใหม่...` : `✅ ${result.formula} saved. Reloading dashboard...`);
      window.setTimeout(() => window.location.reload(), 700);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : (isThai ? "ไม่สามารถบันทึก VDS Formula ได้" : "Unable to save VDS"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {editingOriginalFormula && (
        <div className="shrink-0 mb-3 flex items-center justify-between rounded-2xl bg-amber-50 border border-amber-300 p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-base">✏️</span>
            <div>
              <p className="text-xs font-bold text-amber-800">{isThai ? "กำลังแก้ไขสูตร VDS เดิม" : "Editing Existing VDS Formula"}</p>
              <p className="text-sm font-black text-amber-950">{editingOriginalFormula}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetForm}
            className="rounded-xl bg-white border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition shadow-xs"
          >
            {isThai ? "✕ ยกเลิกการแก้ไข" : "✕ Cancel Edit"}
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12 flex-1 min-h-0 items-stretch">
        {/* ฟอร์มด้านซ้าย: ตั้งค่าสูตร (5 คอลัมน์) */}
        <div className="lg:col-span-5 space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col overflow-y-auto">
          {/* ขั้นตอนที่ 1: กำหนดชื่อ VDS */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">1</span>
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                {isThai ? "ชื่อสูตร VDS (Formula Name)" : "VDS Formula Name"}
              </label>
            </div>
            <input
              value={formula}
              onChange={(event) => setFormula(event.target.value.toUpperCase())}
              placeholder={isThai ? "ตัวอย่าง: MOMO_VDS, MAT_VDS" : "EX: MOMO_VDS, MAT_VDS"}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
            <p className="mt-1 text-[11px] text-slate-400 font-medium">
              {isThai ? "💡 ต้องมีคำว่า VDS อยู่ในชื่อเสมอ" : "💡 Must contain 'VDS' in the name"}
            </p>
          </div>

          {/* ขั้นตอนที่ 2: เลือกแท็บหน้าที่แสดงผล */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">2</span>
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                {isThai ? "แสดงผลในหน้าใดบ้าง (Display in Pages)" : "Display in Pages"}
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {tabMenuList.map((page) => {
                const selected = pages.includes(page);
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => togglePage(page)}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                      selected
                        ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-200"
                        : "border-slate-200 bg-slate-50/50 text-slate-600 hover:border-blue-300 hover:bg-white"
                    }`}
                  >
                    <span>{page}</span>
                    <span className={`text-xs ${selected ? "text-white" : "text-slate-300"}`}>
                      {selected ? "✓" : "+"}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-slate-400 font-medium">
              {isThai
                ? (pages.length ? `เลือกไว้ ${pages.length} หน้า` : "💡 เลือกหน้าเพื่อกรองรายชื่อไลน์ย่อยทางขวา")
                : (pages.length ? `${pages.length} pages selected` : "💡 Select pages to filter member lines on the right")}
            </p>
          </div>

          {/* Step 3: Cost Center Prefixes */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-400 text-[10px] font-black text-white">3</span>
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                {isThai ? "Cost Center ที่เจาะจง (ไม่บังคับ)" : "Cost Center Prefixes (Optional)"}
              </label>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setCostCenterOpen((current) => !current)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-left text-xs font-bold text-slate-700 transition hover:bg-white hover:border-blue-300"
              >
                <span>
                  {costCentersLoading
                    ? (isThai ? "กำลังโหลด..." : "Loading Cost Centers...")
                    : costCenters.length
                      ? (isThai ? `เลือกไว้ ${costCenters.length} Cost Centers` : `${costCenters.length} Cost Centers selected`)
                      : (isThai ? "เลือก Cost Center (ถ้ามี)..." : "Choose Cost Centers (optional)...")}
                </span>
                <span className="text-slate-400">▼</span>
              </button>

              {costCenterOpen && (
                <div className="absolute z-30 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
                  <input
                    value={costCenterSearch}
                    onChange={(event) => setCostCenterSearch(event.target.value)}
                    placeholder={isThai ? "ค้นหา Cost Center เช่น P310..." : "Search Cost Center, e.g. P310..."}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
                    autoFocus
                  />
                  <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                    {filteredCostCenters.map((value) => (
                      <label
                        key={value}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-blue-50"
                      >
                        <input
                          type="checkbox"
                          checked={costCenters.includes(value)}
                          onChange={() => toggleCostCenter(value)}
                          className="h-3.5 w-3.5 accent-blue-600"
                        />
                        <span>{value}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {costCenters.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {costCenters.map((value) => (
                  <span
                    key={value}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-blue-700"
                  >
                    {value}
                    <button
                      type="button"
                      onClick={() => toggleCostCenter(value)}
                      className="text-blue-400 hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Form: Member Lines Picker (7 cols) */}
        <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">4</span>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                {isThai ? "เลือกไลน์ย่อยที่จะนำมารวม (Member Lines)" : "Member Lines Included"}
              </h3>
            </div>
            <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-black text-blue-700">
              {members.length} {isThai ? "ไลน์ที่เลือก" : "selected"}
            </span>
          </div>

          {/* Search & Quick Action Buttons */}
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <input
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
                placeholder={isThai ? "🔍 พิมพ์ค้นหาไลน์ย่อย เช่น VAC, OST..." : "🔍 Search member line, e.g. VAC, OST..."}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
            <button
              type="button"
              onClick={selectAllVisibleMembers}
              className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition"
              title={isThai ? "เลือกทั้งหมดที่แสดง" : "Select all visible"}
            >
              {isThai ? "เลือกทั้งหมด" : "Select All"}
            </button>
            {members.length > 0 && (
              <button
                type="button"
                onClick={clearAllMembers}
                className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
              >
                {isThai ? "ล้างที่เลือก" : "Clear"}
              </button>
            )}
          </div>

          {/* Member lines checkbox grid */}
          <div className="mt-3 flex-1 min-h-0 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/30 p-2 space-y-1">
            {memberOptions.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {memberOptions.map((line) => {
                  const isChecked = members.includes(line);
                  return (
                    <label
                      key={line}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                        isChecked
                          ? "bg-blue-50 text-blue-900 border border-blue-200"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleMember(line)}
                        className="h-4 w-4 rounded accent-blue-600"
                      />
                      <span className="truncate">{line}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-xs font-semibold text-slate-400">
                {isThai ? "ไม่พบรายชื่อไลน์ย่อย" : "No member lines found"}
              </div>
            )}
          </div>

          {/* Selected Member Lines Badges */}
          {members.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto rounded-xl bg-blue-50/60 p-2.5 border border-blue-200">
              <span className="text-[11px] font-black text-blue-900 mr-1">
                {isThai ? "เลือกแล้ว:" : "Selected:"}
              </span>
              {members.map((line) => (
                <span
                  key={line}
                  className="inline-flex items-center gap-1 rounded-lg bg-white border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-blue-900 shadow-2xs"
                >
                  {line}
                  <button
                    type="button"
                    onClick={() => toggleMember(line)}
                    className="text-slate-400 hover:text-rose-600 font-black ml-0.5"
                    title={isThai ? `ลบ ${line}` : `Remove ${line}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* แถบแจ้งเตือนสถานะ สำเร็จ / ข้อผิดพลาด */}
          {(error || message) && (
            <div
              className={`mt-3 rounded-xl p-3 text-xs font-bold ${
                error
                  ? "bg-rose-50 border border-rose-200 text-rose-700"
                  : "bg-emerald-50 border border-emerald-200 text-emerald-700"
              }`}
            >
              {error || message}
            </div>
          )}

          {/* Save Action Footer */}
          <div className="mt-4 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            {editingOriginalFormula && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                {isThai ? "ยกเลิก" : "Cancel"}
              </button>
            )}
            <button
              type="button"
              onClick={save}
              disabled={isSaving || !formula.trim() || !pages.length || !members.length}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-black text-white shadow-md shadow-blue-200 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <span>{isSaving ? "⏳ กำลังบันทึก..." : editingOriginalFormula ? "💾 อัปเดตสูตร VDS" : "💾 บันทึกสูตร VDS"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
