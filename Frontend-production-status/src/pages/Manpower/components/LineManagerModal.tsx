/**
 * Component: LineManagerModal
 * หน้าต่างจัดการโครงสร้าง Line การผลิตและ Line Groups
 * - สร้าง, แก้ไข, ลบกลุ่มไลน์ (Parent Line) และแมปปิ้งไลน์ย่อย (Child Lines / Shifts)
 * - กำหนดหน้าที่ต้องการให้แสดงผล (Display Pages) และสลับโหมด Line Manager / VDS Formula Manager
 */
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  ADMIN_VDS_FORMULA_REGISTRY,
  LINE_GROUPS,
  MACRO_PCN_GROUPS,
  TAB_LINES,
  TAB_TOTAL_LINE_MAP,
  tabMenuList,
} from "../config/lineGroups";
import { MANHOUR_VDS_FORMULA_ENDPOINT, MANHOUR_CUSTOM_MAPPINGS_ENDPOINT } from "../constants";
import { getRuntimeHiddenLines, setRuntimeHiddenLine } from "../aggregation";
import ModalButtonIcon from "./ModalButtonIcon";
import VdsFormulaManager from "./VdsFormulaManager";

type Props = { onClose: () => void };

const formulaMap = LINE_GROUPS as Record<string, string[]>;
const macroFormulaMap = MACRO_PCN_GROUPS as Record<string, string[]>;
const tabLinesMap = TAB_LINES as Record<string, string[]>;
const tabTotalLineMap = TAB_TOTAL_LINE_MAP as Record<string, string>;

/**
 * นับจำนวน Base Line (ตัดกะ /A, /B, /D ออก) ของกลุ่มสูตร
 */
const getFormulaBaseLineCount = (group: string) => {
  const members = macroFormulaMap[group] || formulaMap[group] || [group];
  return new Set(
    members
      .map((member) =>
        String(member)
          .trim()
          .replace(/\/[ABD]\s*$/i, "")
          .trim()
          .toUpperCase(),
      )
      .filter(Boolean),
  ).size;
};

// ตรวจสอบว่าเป็นกลุ่มไลน์หลัก (Major Group) หรือกลุ่มไลน์ย่อยแยกกะ (Minor Group)
const isMajorFormulaGroup = (group: string) =>
  getFormulaBaseLineCount(group) > 2 || /VDS/i.test(group);
const isMinorFormulaGroup = (group: string) => /\/[ABD]\s*$/i.test(group);

export default function LineManagerModal({ onClose }: Props) {
  const [managerMode, setManagerMode] = useState<"line" | "vds">("line");
  const [editingVdsFormula, setEditingVdsFormula] = useState<string | null>(null);
  const [parent, setParent] = useState("");
  const [shifts, setShifts] = useState<string[]>([]);
  const [displayPages, setDisplayPages] = useState<string[]>([]);
  const [formulaGroups, setFormulaGroups] = useState<string[]>([]);
  const [childLines, setChildLines] = useState<string[]>([]);
  const [lineSearch, setLineSearch] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [language, setLanguage] = useState<"en" | "th">("en");
  const isThai = language === "th";
  const [lineTypes, setLineTypes] = useState<string[]>([]);
  const [formulaSearch, setFormulaSearch] = useState("");
  const [formulaLevel, setFormulaLevel] = useState<"major" | "minor">("major");
  const [formulaOpen, setFormulaOpen] = useState(false);
  const hasChanges = Boolean(
    parent.trim() ||
      displayPages.length ||
      formulaGroups.length ||
      childLines.length ||
      lineTypes.length ||
      shifts.length,
  );
  const lines = useMemo(
    () => (parent ? shifts.map((shift) => `${parent}/${shift}`) : []),
    [parent, shifts],
  );
  const toggleShift = (shift: string) =>
    setShifts((current) =>
      current.includes(shift)
        ? current.filter((item) => item !== shift)
        : [...current, shift],
    );
  const pageFormulaGroups = useMemo(
    () => [
      ...new Set(
        displayPages.flatMap((page) =>
          (tabLinesMap[page] || []).filter(
            (group) => group !== tabTotalLineMap[page],
          ),
        ),
      ),
    ],
    [displayPages],
  );
  const lineOptions = useMemo(
    () =>
      [...new Set([
        ...Object.values(formulaMap).flat(),
        ...Object.values(macroFormulaMap).flat(),
      ])]
        .filter((line) => line && line !== parent && /\/[^/]+$/.test(line) && (!lineSearch.trim() || line.toLowerCase().includes(lineSearch.trim().toLowerCase())))
        .sort((a, b) => a.localeCompare(b)),
    [lineSearch, parent],
  );
  const formulaOptions = useMemo(() => {
    const search = formulaSearch.trim().toLowerCase();
    return pageFormulaGroups
      .filter((group) =>
        formulaLevel === "minor"
          ? isMinorFormulaGroup(group)
          : isMajorFormulaGroup(group),
      )
      .filter((group) => !search || group.toLowerCase().includes(search))
      .sort((a, b) => a.localeCompare(b));
  }, [formulaLevel, formulaSearch, pageFormulaGroups]);
  useEffect(() => {
    const allowedGroups = new Set(pageFormulaGroups);
    setFormulaGroups((current) => {
      const next = current.filter((group) => allowedGroups.has(group));
      return next.length === current.length ? current : next;
    });
  }, [pageFormulaGroups]);
  const toggleFormulaGroup = (group: string) =>
    setFormulaGroups((current) =>
      current.includes(group)
        ? current.filter((item) => item !== group)
        : [...current, group],
    );
  const removeChildLine = (line: string) =>
    setChildLines((current) => current.filter((item) => item !== line));
  const [savedMappings, setSavedMappings] = useState<Record<string, any>>(() => {
    try {
      return JSON.parse(localStorage.getItem("manhour-line-mappings") || "{}");
    } catch {
      return {};
    }
  });
  const [vdsFormulas, setVdsFormulas] = useState<Record<string, any>>(() => ({ ...ADMIN_VDS_FORMULA_REGISTRY }));
  const [editingParentName, setEditingParentName] = useState<string | null>(null);
  const [hiddenLines, setHiddenLines] = useState<string[]>(() => getRuntimeHiddenLines());

  const toggleHideLine = (lineName: string) => {
    const isCurrentlyHidden = hiddenLines.includes(lineName);
    setRuntimeHiddenLine(lineName, !isCurrentlyHidden);
    setHiddenLines(getRuntimeHiddenLines());
  };

  const reloadMappings = async () => {
    try {
      const res = await fetch(MANHOUR_CUSTOM_MAPPINGS_ENDPOINT, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.data) {
          setSavedMappings(json.data);
          localStorage.setItem("manhour-line-mappings", JSON.stringify(json.data));
        }
      }
    } catch (err) {
      console.warn("Could not fetch line mappings from DB Test, falling back to localStorage:", err);
      try {
        setSavedMappings(JSON.parse(localStorage.getItem("manhour-line-mappings") || "{}"));
      } catch {
        setSavedMappings({});
      }
    }

    try {
      const vdsRes = await fetch(MANHOUR_VDS_FORMULA_ENDPOINT, { cache: "no-store" });
      if (vdsRes.ok) {
        const vdsJson = await vdsRes.json();
        if (vdsJson?.formulas) {
          setVdsFormulas({ ...ADMIN_VDS_FORMULA_REGISTRY, ...vdsJson.formulas });
        }
      }
    } catch (vdsErr) {
      console.warn("Could not fetch VDS formulas:", vdsErr);
    }
  };

  useEffect(() => {
    reloadMappings();
  }, []);

  // รายการไลน์ทั้งหมด (ทั้งไลน์มาตรฐานของระบบ, ไลน์ที่ผู้ใช้บันทึกเอง, และสูตร VDS)
  // รวมแบบ Case-insensitive เพื่อป้องกันชื่อซ้ำ เช่น "Macro SMT" กับ "MACRO SMT"
  const allAvailableLineNames = useMemo(() => {
    const builtInKeys = Object.keys(LINE_GROUPS);
    const macroKeys = Object.keys(MACRO_PCN_GROUPS);
    const vdsKeys = Object.keys(vdsFormulas);
    // รวม keys ทั้งหมด และสำหรับ custom mapping ที่มี shifts ให้เพิ่มแถวกะย่อย (เช่น MOMO/A, MOMO/B, MOMO/D) ด้วย
    const customWithShifts: string[] = [];
    Object.entries(savedMappings).forEach(([name, cfg]: [string, any]) => {
      customWithShifts.push(name);
      if (Array.isArray(cfg?.shifts)) {
        cfg.shifts.forEach((s: string) => {
          customWithShifts.push(`${name}/${s}`);
        });
      }
    });

    // เก็บรายการแบบ Case-insensitive: ถ้ามีชื่อที่มีตัวพิมพ์เล็กใหญ่ต่างกัน ให้ยุบเหลือตัวเดียว
    const lineMap = new Map<string, string>();
    [...builtInKeys, ...macroKeys, ...vdsKeys, ...customWithShifts].forEach((name) => {
      const lower = name.trim().toLowerCase();
      // ให้สิทธิ์ custom name หรือชื่อที่มีอยู่แล้ว
      if (!lineMap.has(lower) || customWithShifts.includes(name) || vdsKeys.includes(name)) {
        lineMap.set(lower, name.trim());
      }
    });

    return [...lineMap.values()].sort((a, b) => a.localeCompare(b));
  }, [savedMappings, vdsFormulas]);

  // รายการไลน์ดิบที่ตรวจพบจากฐานข้อมูล / API
  const [apiRawLines, setApiRawLines] = useState<string[]>([]);
  const [isLoadingApiLines, setIsLoadingApiLines] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchApiLines = async () => {
      setIsLoadingApiLines(true);
      try {
        const res = await fetch(`${MANHOUR_VDS_FORMULA_ENDPOINT.replace("/lines/vds-formulas", "/employees/search")}?q=&limit=1000`);
        if (res.ok) {
          const data = await res.json();
          const linesFound = new Set<string>();
          if (Array.isArray(data?.employees)) {
            data.employees.forEach((emp: any) => {
              if (emp?.line) linesFound.add(String(emp.line).trim());
            });
          }
          if (isMounted && linesFound.size > 0) {
            setApiRawLines([...linesFound].filter(Boolean));
          }
        }
      } catch (err) {
        console.warn("Could not auto-fetch lines from employees API:", err);
      } finally {
        if (isMounted) setIsLoadingApiLines(false);
      }
    };
    fetchApiLines();
    return () => {
      isMounted = false;
    };
  }, []);

  // คำนวณหาไลน์ใหม่ที่ตรวจพบแต่ยังไม่ได้แมปเข้ากลุ่ม
  const detectedNewLines = useMemo(() => {
    const allRegisteredChildren = new Set([
      ...Object.values(LINE_GROUPS).flat(),
      ...Object.values(MACRO_PCN_GROUPS).flat(),
      ...Object.values(savedMappings).flatMap((m: any) => m.lines || []),
    ]);

    return apiRawLines.filter(
      (rawLine) =>
        rawLine &&
        !allRegisteredChildren.has(rawLine) &&
        !allAvailableLineNames.includes(rawLine.replace(/\/[ABD]$/i, ""))
    ).sort((a, b) => a.localeCompare(b));
  }, [apiRawLines, savedMappings, allAvailableLineNames]);

  const quickAddNewLine = (rawLineName: string) => {
    const cleanParent = rawLineName.replace(/\/[ABD]$/i, "").trim().toUpperCase();
    const shiftMatch = rawLineName.match(/\/([ABD])$/i);
    const shift = shiftMatch ? shiftMatch[1].toUpperCase() : "A";

    setParent(cleanParent);
    setShifts((prev) => [...new Set([...prev, shift])]);
    setChildLines((prev) => [...new Set([...prev, rawLineName])]);
    setManagerMode("line");
  };

  const loadMappingForEdit = (parentName: string) => {
    const item = savedMappings[parentName];
    setEditingParentName(parentName);
    setParent(parentName);

    if (item) {
      // ✅ Edit Custom: โหลดเฉพาะค่าที่ user เคย save ไว้ก่อนหน้า
      const rawLines = Array.isArray(item.lines) ? item.lines : [];
      const normParent = parentName.trim().toUpperCase();

      // แยกกะที่เคยระบุ
      const detectedShifts = (Array.isArray(item.shifts) && item.shifts.length > 0)
        ? item.shifts
        : rawLines
            .filter((l: string) => l.trim().toUpperCase().startsWith(`${normParent}/`))
            .map((l: string) => { const m = l.match(/\/([ABD])$/i); return m ? m[1].toUpperCase() : null; })
            .filter(Boolean);
      setShifts([...new Set(detectedShifts as string[])]);

      // หากมี childLines อื่นที่ไม่ใช่ ${normParent}/[ABD] ให้แสดงเฉพาะ childLines นั้น
      const externalLines = rawLines.filter(
        (l: string) => !new RegExp(`^${normParent}/[ABD]$`, "i").test(l.trim())
      );
      setChildLines(externalLines.length > 0 ? externalLines : rawLines);

      setFormulaGroups(Array.isArray(item.formulaGroups) ? item.formulaGroups : []);
      setDisplayPages(Array.isArray(item.displayPages) ? item.displayPages : []);
      setLineTypes(Array.isArray(item.macroGroups) ? item.macroGroups : []);
    } else {
      // ✅ Edit Built-in: โหลด Child Lines, Work Shifts และ Display Pages จาก config อัตโนมัติ
      const builtInLines = MACRO_PCN_GROUPS[parentName] || LINE_GROUPS[parentName] || [parentName];
      setChildLines(Array.isArray(builtInLines) ? builtInLines : [parentName]);

      const builtInPages = ADMIN_VDS_FORMULA_REGISTRY[parentName]?.pages ||
        tabMenuList.filter((tab) => {
          const list = tabLinesMap[tab] || [];
          return list.some((item) => item === parentName || item.replace(/\/[ABD]$/i, "") === parentName);
        });
      setDisplayPages(builtInPages);
      setFormulaGroups([]);
      setLineTypes([]);

      // Auto-detect Shifts เฉพาะกรณีที่หน้าจอเดิม (TAB_LINES) มีการแสดงไลน์ย่อยแยกกะของ parent ไลน์นี้อยู่จริงเท่านั้น
      // (ป้องกันไม่ให้ไลน์อย่าง ACC, HR ซึ่งแสดงแค่แถวเดียว ถูก auto-create กะย่อย ACC/D โผล่ขึ้นมาใน dropdown)
      const normParent = parentName.trim().toUpperCase();
      const existingTabLines = Object.values(tabLinesMap).flat();
      const hasExplicitShiftRowsInTabs = existingTabLines.some((tl) =>
        new RegExp(`^${normParent}/[ABD]$`, "i").test(tl.trim()),
      );

      if (hasExplicitShiftRowsInTabs) {
        const detectedShifts = (builtInLines as string[])
          .filter((l: string) => l.trim().toUpperCase().startsWith(`${normParent}/`))
          .map((l: string) => { const m = l.match(/\/([ABD])$/i); return m ? m[1].toUpperCase() : null; })
          .filter(Boolean);
        setShifts([...new Set(detectedShifts as string[])]);
      } else {
        setShifts([]);
      }
    }

    setManagerMode("line");
  };

  /**
   * รีเซ็ตการตั้งค่าของ Line ที่กำลังแก้ไข ให้กลับไปเป็นค่าเริ่มต้นเดิมจาก config (lineGroups.ts)
   */
  const resetToDefaultConfig = (targetName?: string) => {
    const nameToReset = targetName || parent || editingParentName;
    if (!nameToReset) return;

    const builtInLines = MACRO_PCN_GROUPS[nameToReset] || LINE_GROUPS[nameToReset] || [nameToReset];
    setChildLines(Array.isArray(builtInLines) ? builtInLines : [nameToReset]);

    const builtInPages = ADMIN_VDS_FORMULA_REGISTRY[nameToReset]?.pages ||
      tabMenuList.filter((tab) => {
        const list = tabLinesMap[tab] || [];
        return list.some((item) => item === nameToReset || item.replace(/\/[ABD]$/i, "") === nameToReset);
      });
    setDisplayPages(builtInPages);
    setFormulaGroups([]);
    setLineTypes([]);

    const normParent = nameToReset.trim().toUpperCase();
    const existingTabLines = Object.values(tabLinesMap).flat();
    const hasExplicitShiftRowsInTabs = existingTabLines.some((tl) =>
      new RegExp(`^${normParent}/[ABD]$`, "i").test(tl.trim()),
    );

    if (hasExplicitShiftRowsInTabs) {
      const detectedShifts = (builtInLines as string[])
        .filter((l: string) => l.trim().toUpperCase().startsWith(`${normParent}/`))
        .map((l: string) => { const m = l.match(/\/([ABD])$/i); return m ? m[1].toUpperCase() : null; })
        .filter(Boolean);
      setShifts([...new Set(detectedShifts as string[])]);
    } else {
      setShifts([]);
    }

    Swal.fire({
      icon: "success",
      title: isThai ? "รีเซ็ตเป็นค่าเริ่มต้นแล้ว" : "Restored default config",
      text: isThai
        ? `ดึงค่า Child Lines, Shifts และ Display Pages เดิมของ "${nameToReset}" จาก config เรียบร้อยแล้ว`
        : `Restored initial configuration from lineGroups for "${nameToReset}"`,
      timer: 1500,
      showConfirmButton: false,
    });
  };

  const restoreToBuiltinDefault = async (parentName: string) => {
    const confirm = await Swal.fire({
      icon: "question",
      title: isThai ? `คืนค่าเริ่มต้น "${parentName}"?` : `Restore "${parentName}" to default?`,
      text: isThai
        ? "ต้องการยกเลิกการตั้งค่าแบบกำหนดเอง (Custom) และคืนค่าสูตร Child Lines กลับไปใช้ค่ามาตรฐานจาก config เริ่มต้นหรือไม่?"
        : "Do you want to discard custom settings and restore standard child lines from default config?",
      showCancelButton: true,
      confirmButtonText: isThai ? "คืนค่าเริ่มต้น" : "Restore",
      confirmButtonColor: "#f59e0b",
      cancelButtonText: isThai ? "ยกเลิก" : "Cancel",
    });
    if (!confirm.isConfirmed) return;

    try {
      await fetch(`${MANHOUR_CUSTOM_MAPPINGS_ENDPOINT}/${encodeURIComponent(parentName)}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.warn("Could not delete custom line mapping from DB Test:", err);
    }

    const key = "manhour-line-mappings";
    const current = JSON.parse(localStorage.getItem(key) || "{}");
    delete current[parentName];
    localStorage.setItem(key, JSON.stringify(current));
    await reloadMappings();
    window.dispatchEvent(new Event("manhour-line-mappings-updated"));

    if (editingParentName === parentName) {
      clearAll();
      setEditingParentName(null);
    }

    await Swal.fire({
      icon: "success",
      title: isThai ? "คืนค่าเริ่มต้นสำเร็จ" : "Restored successfully",
      text: isThai ? `ไลน์ "${parentName}" กลับไปใช้ค่ามาตรฐานจาก config แล้ว` : `"${parentName}" has been restored to default config.`,
      timer: 1500,
      showConfirmButton: false,
    });
  };

  const deleteMapping = async (parentName: string) => {
    const isCustom = Boolean(savedMappings[parentName]);
    const confirm = await Swal.fire({
      icon: "warning",
      title: isThai ? `ลบ Line "${parentName}"?` : `Delete Line "${parentName}"?`,
      text: isCustom
        ? isThai
          ? "คุณแน่ใจหรือไม่ว่าต้องการลบการตั้งค่า Line mapping นี้?"
          : "Are you sure you want to remove this line mapping?"
        : isThai
          ? "ไลน์นี้เป็นไลน์มาตรฐานของระบบ (Built-in) หากต้องการซ่อนหรือไม่นำมาคำนวณ สามารถกำหนดค่าว่างทับได้"
          : "This is a built-in line. Deleting will override it with empty mapping.",
      showCancelButton: true,
      confirmButtonText: isThai ? "ลบ" : "Delete",
      confirmButtonColor: "#e11d48",
      cancelButtonText: isThai ? "ยกเลิก" : "Cancel",
    });
    if (!confirm.isConfirmed) return;

    // ตรวจสอบว่าเป็นไลน์ย่อยกะของ Parent หรือไม่ เช่น MOMO/B หรือ MOMO/D
    const shiftMatch = parentName.match(/^(.+)\/([ABD])$/i);
    const parentOfShift = shiftMatch ? shiftMatch[1] : null;
    const shiftCode = shiftMatch ? shiftMatch[2].toUpperCase() : null;

    if (parentOfShift && savedMappings[parentOfShift] && !savedMappings[parentName]) {
      // กรณีกดลบที่แถวกะย่อย (เช่น ลบ MOMO/B หรือ MOMO/D ออกจาก MOMO)
      const parentCfg = { ...savedMappings[parentOfShift] };
      const updatedShifts = Array.isArray(parentCfg.shifts)
        ? parentCfg.shifts.filter((s: string) => s.toUpperCase() !== shiftCode)
        : [];
      const updatedLines = Array.isArray(parentCfg.lines)
        ? parentCfg.lines.filter((l: string) => l.trim().toUpperCase() !== parentName.toUpperCase())
        : [];

      const payload = {
        ...parentCfg,
        parent: parentOfShift,
        shifts: updatedShifts,
        lines: updatedLines,
      };

      try {
        await fetch(MANHOUR_CUSTOM_MAPPINGS_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.warn("Could not update parent mapping in DB Test:", err);
      }

      const key = "manhour-line-mappings";
      const current = JSON.parse(localStorage.getItem(key) || "{}");
      current[parentOfShift] = payload;
      localStorage.setItem(key, JSON.stringify(current));
      await reloadMappings();
      window.dispatchEvent(new Event("manhour-line-mappings-updated"));
    } else {
      // กรณีลบไลน์หลัก (หรือไลน์ custom ทั่วไป)
      try {
        await fetch(`${MANHOUR_CUSTOM_MAPPINGS_ENDPOINT}/${encodeURIComponent(parentName)}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.warn("Could not delete line mapping from DB Test:", err);
      }

      const key = "manhour-line-mappings";
      const current = JSON.parse(localStorage.getItem(key) || "{}");
      delete current[parentName];
      localStorage.setItem(key, JSON.stringify(current));
      await reloadMappings();
      window.dispatchEvent(new Event("manhour-line-mappings-updated"));
    }

    if (editingParentName === parentName) {
      clearAll();
      setEditingParentName(null);
    }

    await Swal.fire({
      icon: "success",
      title: isThai ? "ลบสำเร็จ" : "Deleted",
      timer: 1200,
      showConfirmButton: false,
    });
  };

  const saveLineMapping = async () => {
    if (!parent.trim()) return;

    // จัดเรียงลำดับกะอย่างเป็นมาตรฐาน: กะ A, กะ B, กะ D
    const shiftOrder: Record<string, number> = { A: 1, B: 2, D: 3 };
    const sortedShifts = [...shifts].sort(
      (a, b) => (shiftOrder[a] || 99) - (shiftOrder[b] || 99),
    );

    // รวมทั้งไลน์กะของตัวเอง (เช่น MOMO/A, MOMO/B, MOMO/D) และ Child Lines อื่นที่เลือกเพิ่มเติม
    const ownShiftLines = sortedShifts.map((s) => `${parent}/${s}`);
    const effectiveLines = [...new Set([...ownShiftLines, ...childLines])];

    if (effectiveLines.length === 0) return;

    const payload = {
      parent,
      lines: effectiveLines,
      shifts: sortedShifts,
      formulaGroups,
      displayPages,
      macroGroups: lineTypes,
    };

    try {
      // 1. กรณีเปลี่ยนชื่อไลน์ ให้ลบชื่อเดิมออกจากฐานข้อมูลก่อน
      if (editingParentName && editingParentName !== parent) {
        await fetch(`${MANHOUR_CUSTOM_MAPPINGS_ENDPOINT}/${encodeURIComponent(editingParentName)}`, {
          method: "DELETE",
        });
      }

      // 2. บันทึกข้อมูลใหม่ไปยัง API
      const res = await fetch(MANHOUR_CUSTOM_MAPPINGS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || "Save failed");
      }
    } catch (err) {
      console.warn("Could not save line mapping to DB Test, saving to localStorage as fallback:", err);
    }

    const key = "manhour-line-mappings";
    const current = JSON.parse(localStorage.getItem(key) || "{}");

    // กรณีแก้ไขไลน์เดิมและมีการเปลี่ยนชื่อไลน์หลัก
    if (editingParentName && editingParentName !== parent) {
      delete current[editingParentName];
    }

    current[parent] = payload;

    localStorage.setItem(key, JSON.stringify(current));
    await reloadMappings();
    setEditingParentName(null);
    window.dispatchEvent(new Event("manhour-line-mappings-updated"));

    await Swal.fire({
      icon: "success",
      title: isThai ? "บันทึกสำเร็จ" : "Saved successfully",
      text: isThai
        ? `บันทึก Line Mapping สำหรับ ${parent} เรียบร้อยแล้ว (บันทึกลง Database Test)`
        : `Line mapping for ${parent} has been saved to Database Test.`,
      timer: 1500,
      showConfirmButton: false,
    });
  };

  const clearAll = () => {
    setParent("");
    setEditingParentName(null);
    setShifts([]);
    setDisplayPages([]);
    setFormulaGroups([]);
    setChildLines([]);
    setLineTypes([]);
    setLineSearch("");
    setFormulaSearch("");
  };
  const toggleDisplayPage = (page: string) =>
    setDisplayPages((current) =>
      current.includes(page)
        ? current.filter((item) => item !== page)
        : [...current, page],
    );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 sm:p-6 backdrop-blur-sm">
      <section className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-none flex-col rounded-3xl bg-white p-5 sm:p-6 text-slate-800 shadow-2xl overflow-hidden">
        <div className="shrink-0">
          <p className="text-xs font-black uppercase tracking-wider text-blue-600">
            Line mapping
          </p>
        <div className="relative flex items-start justify-between gap-4">
          <h2 className="mt-1 text-xl font-black">
            {isThai ? "จัดการ Line & สูตรคำนวณ" : "Add / manage line"}
          </h2>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setLanguage((current) => (current === "en" ? "th" : "en"))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              {isThai ? "TH" : "EN"}
            </button>
            {hasChanges && (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-600 hover:bg-red-50"
              >
                <ModalButtonIcon name="reset" /> Clear
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowGuide((current) => !current)}
            className="absolute left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
          >
            <span aria-hidden="true">📖</span>
            {isThai ? "คู่มือการใช้งาน" : "User guide"}
          </button>
        </div>

        {showGuide && (
          <div className="mt-4 rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50/90 via-indigo-50/40 to-slate-50 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-blue-200/60">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white text-lg shadow-sm">
                  {managerMode === "vds" ? "🧪" : managerMode === ("saved" as any) ? "📋" : "📖"}
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {managerMode === "vds"
                      ? (isThai ? "คู่มือการใช้งาน: วิธีสร้างสูตรคำนวณ VDS (Add VDS Guide)" : "User Guide: VDS Formula Configuration")
                      : managerMode === ("saved" as any)
                        ? (isThai ? "คู่มือการใช้งาน: รายการ Line & VDS ทั้งหมด (Manage All Lines Guide)" : "User Guide: Manage All Lines & VDS Registry")
                        : (isThai ? "คู่มือการใช้งาน: วิธีสร้าง Line & จัดกลุ่มกะ (Add Line Guide)" : "User Guide: Line Mapping & Shift Configuration")}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {managerMode === "vds"
                      ? (isThai ? "เข้าใจวิธีสร้างสูตร VDS, การกรอง Cost Center และการเลือก Member Lines" : "How to configure VDS formulas, cost center filters, and member lines.")
                      : managerMode === ("saved" as any)
                        ? (isThai ? "วิธีซ่อน/แสดงไลน์บนหน้า Dashboard, การแก้ไขสูตรเดิม และการลบไลน์" : "How to hide/show lines on Dashboard, edit existing mappings, and remove lines.")
                        : (isThai ? "เข้าใจง่ายใน 4 ขั้นตอน พร้อมระบบสร้างกะย่อย A, B, D และรวมยอด Child Lines อัตโนมัติ" : "4 simple steps to aggregate child lines, auto-create shifts A/B/D, and save.")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition shadow-xs"
              >
                {isThai ? "✕ ปิดคู่มือ" : "✕ Close Guide"}
              </button>
            </div>

            {/* Content switch by active tab */}
            {managerMode === "vds" ? (
              /* คู่มือของแท็บ: ➕ สร้าง VDS */
              <div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-2xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-black">1</span>
                      <h4 className="text-xs font-black text-slate-800">
                        {isThai ? "1. ตั้งชื่อสูตร VDS" : "1. VDS Formula Name"}
                      </h4>
                    </div>
                    <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
                      {isThai ? (
                        <>กรอกชื่อสูตรโดย<b className="text-blue-700">ต้องมีคำว่า VDS เสมอ</b> เช่น <code className="rounded bg-blue-50 px-1.5 py-0.5 font-black text-blue-700">MOMO_VDS</code> หรือ <code className="rounded bg-blue-50 px-1.5 py-0.5 font-black text-blue-700">MAT_VDS</code></>
                      ) : (
                        <>Name must contain <code className="rounded bg-blue-50 px-1.5 py-0.5 font-black text-blue-700">VDS</code>, e.g. <code className="rounded bg-blue-50 px-1.5 py-0.5 font-black text-blue-700">MOMO_VDS</code>.</>
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-2xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-black">2</span>
                      <h4 className="text-xs font-black text-slate-800">
                        {isThai ? "2. เลือกหน้าแสดงผล" : "2. Display in Pages"}
                      </h4>
                    </div>
                    <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
                      {isThai ? (
                        <>เลือกหน้าที่ต้องการให้สูตรนี้ไปแสดงผล เช่น <code className="font-bold text-indigo-700">Macro PCN</code> หรือ <code className="font-bold text-indigo-700">SMT DATA</code> เพื่อกรองไลน์ทางขวา</>
                      ) : (
                        <>Select target dashboard pages to show this VDS metric row and filter lines.</>
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-2xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white text-xs font-black">3</span>
                      <h4 className="text-xs font-black text-slate-800">
                        {isThai ? "3. ระบุ Cost Center (ถ้ามี)" : "3. Cost Center Filters"}
                      </h4>
                    </div>
                    <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
                      {isThai ? (
                        <>เลือก Cost Center ที่เจาะจง เช่น <code className="rounded bg-emerald-50 px-1.5 py-0.5 font-black text-emerald-800">P310</code> เพื่อคำนวณเฉพาะกลุ่มพนักงานสังกัดแผนกนั้น</>
                      ) : (
                        <>Optional: pick cost centers like <code className="rounded bg-emerald-50 px-1.5 py-0.5 font-black text-emerald-800">P310</code> to filter specific cost centers.</>
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-2xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-600 text-white text-xs font-black">4</span>
                      <h4 className="text-xs font-black text-slate-800">
                        {isThai ? "4. เลือก Member Lines & บันทึก" : "4. Member Lines & Save"}
                      </h4>
                    </div>
                    <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
                      {isThai ? (
                        <>ติ๊กเลือกไลน์สมาชิกทางขวา ตรวจสอบชิปที่เลือกด้านล่าง แล้วกด <b>"บันทึกสูตร VDS"</b> เพื่ออัปเดตลงระบบทันที</>
                      ) : (
                        <>Select member lines on the right, review chips below, and click <b>"Save VDS Formula"</b>.</>
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-200/80 bg-white px-4 py-3 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-black text-blue-700 uppercase tracking-wider">
                      {isThai ? "💡 หลักการคำนวณ VDS:" : "💡 VDS Principle:"}
                    </span>
                    <span className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-1 font-black text-blue-900">
                      MOMO_VDS = รวมยอดของไลน์สมาชิกทั้งหมด ภายใต้ Cost Center ที่กำหนด
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    {isThai ? "* สูตร VDS ที่บันทึกแล้วจะ sync เข้า Backend API ทันที" : "* Saved formulas are synchronized to Backend API immediately."}
                  </div>
                </div>
              </div>
            ) : managerMode === ("saved" as any) ? (
              /* คู่มือของแท็บ: 📋 รายการ Line & VDS ทั้งหมด */
              <div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-2xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white text-xs font-black">1</span>
                      <h4 className="text-xs font-black text-slate-800">
                        {isThai ? "👁️ แสดง / 🙈 ซ่อนตาราง Dashboard" : "Hide / Show on Dashboard"}
                      </h4>
                    </div>
                    <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
                      {isThai ? (
                        <>กดปุ่ม <code className="rounded bg-slate-100 px-1.5 py-0.5 font-black text-slate-700">ซ่อนตาราง</code> เพื่อไม่ให้แถวไลน์นั้นแสดงบนตาราง Dashboard โดยไม่ทำให้ข้อมูลสูตรหาย</>
                      ) : (
                        <>Click <code className="rounded bg-slate-100 px-1.5 py-0.5 font-black text-slate-700">Hide</code> to hide the row from Dashboard without deleting data.</>
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-2xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-black">2</span>
                      <h4 className="text-xs font-black text-slate-800">
                        {isThai ? "✏️ แก้ไขสูตร (Quick Edit)" : "Edit Mapping"}
                      </h4>
                    </div>
                    <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
                      {isThai ? (
                        <>กดปุ่ม <code className="rounded bg-blue-50 px-1.5 py-0.5 font-black text-blue-700">✏️ แก้ไข</code> ระบบจะโหลดชื่อไลน์ กะ และ Child Lines กลับเข้าฟอร์มทันที</>
                      ) : (
                        <>Click <code className="rounded bg-blue-50 px-1.5 py-0.5 font-black text-blue-700">✏️ Edit</code> to load parent name, shifts, and member lines back into the editor.</>
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-2xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-600 text-white text-xs font-black">3</span>
                      <h4 className="text-xs font-black text-slate-800">
                        {isThai ? "🗑️ ลบ / 🔄 คืนค่าเริ่มต้น (Delete / Reset)" : "Delete / Reset Config"}
                      </h4>
                    </div>
                    <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
                      {isThai ? (
                        <>กดปุ่ม <code className="rounded bg-rose-50 px-1.5 py-0.5 font-black text-rose-700">🗑️ ลบ</code> เพื่อนำไลน์ที่สร้างเองออก หรือกด <b>"รีเซ็ตค่าเดิม"</b> เพื่อย้อนกลับไปใช้สูตรมาตรฐาน</>
                      ) : (
                        <>Click <code className="rounded bg-rose-50 px-1.5 py-0.5 font-black text-rose-700">Delete</code> to remove custom lines, or <b>"Reset Config"</b> to restore built-in settings.</>
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-200/80 bg-white px-4 py-3 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-black text-blue-700 uppercase tracking-wider">
                      {isThai ? "💡 แนะนำ:" : "💡 Tip:"}
                    </span>
                    <span className="text-slate-700 font-medium">
                      {isThai
                        ? "สามารถใช้ช่องค้นหาด้านบนตาราง เพื่อพิมพ์กรองหาชื่อ Line หรือสูตร VDS ที่ต้องการได้อย่างรวดเร็ว"
                        : "Use the search box above the table to quickly find any Line or VDS formula."}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* คู่มือของแท็บ: ➕ สร้าง Line */
              <div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Step 1 */}
                  <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-2xs hover:shadow-xs transition">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-black">1</span>
                      <h4 className="text-xs font-black text-slate-800">
                        {isThai ? "1. ตั้งชื่อไลน์หลัก (Parent Line)" : "1. Parent Line Name"}
                      </h4>
                    </div>
                    <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
                      {isThai ? (
                        <>กรอกชื่อไลน์หลัก เช่น <code className="rounded bg-blue-50 px-1.5 py-0.5 font-black text-blue-700">MOMO</code> หรือ <code className="rounded bg-blue-50 px-1.5 py-0.5 font-black text-blue-700">AIX-MOT</code> เพื่อใช้เป็นแถวรวมบนตาราง</>
                      ) : (
                        <>Enter the parent line name, e.g. <code className="rounded bg-blue-50 px-1.5 py-0.5 font-black text-blue-700">MOMO</code> to display as a master row on dashboard.</>
                      )}
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-2xs hover:shadow-xs transition">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-black">2</span>
                      <h4 className="text-xs font-black text-slate-800">
                        {isThai ? "2. เลือกกะ & หน้าแสดงผล" : "2. Shifts & Pages"}
                      </h4>
                    </div>
                    <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
                      {isThai ? (
                        <>เลือกกะ <code className="font-black text-slate-800">A, B, D</code> (ระบบจะสร้าง <code className="text-indigo-600 font-bold">MOMO/A, MOMO/B, MOMO/D</code> ให้อัตโนมัติ) และเลือกหน้าแนวตั้ง</>
                      ) : (
                        <>Select active shifts <code className="font-black text-slate-800">A, B, D</code> (auto-creates <code className="text-indigo-600 font-bold">MOMO/A, MOMO/B</code>) and target pages.</>
                      )}
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-2xs hover:shadow-xs transition">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white text-xs font-black">3</span>
                      <h4 className="text-xs font-black text-slate-800">
                        {isThai ? "3. เลือกไลน์ย่อย (Child Lines)" : "3. Select Child Lines"}
                      </h4>
                    </div>
                    <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
                      {isThai ? (
                        <>ติ๊กเลือกไลน์ลูกที่ต้องการดึงยอดมารวม เช่น <code className="rounded bg-emerald-50 px-1 py-0.5 font-black text-emerald-800">AELT/A</code>, <code className="rounded bg-emerald-50 px-1 py-0.5 font-black text-emerald-800">MOTA_A/A</code></>
                      ) : (
                        <>Check child lines to aggregate headcounts, e.g. <code className="rounded bg-emerald-50 px-1 py-0.5 font-black text-emerald-800">AELT/A</code>, <code className="rounded bg-emerald-50 px-1 py-0.5 font-black text-emerald-800">MOTA_A/A</code></>
                      )}
                    </p>
                  </div>

                  {/* Step 4 */}
                  <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-2xs hover:shadow-xs transition">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-600 text-white text-xs font-black">4</span>
                      <h4 className="text-xs font-black text-slate-800">
                        {isThai ? "4. ตรวจสอบ & บันทึก" : "4. Review & Save"}
                      </h4>
                    </div>
                    <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
                      {isThai ? (
                        <>ตรวจสอบสูตรในกล่อง <b className="text-amber-800">Live Preview</b> แล้วกดปุ่ม <b>"บันทึก Line Mapping"</b> ระบบจะคำนวณขึ้น Dashboard ทันที</>
                      ) : (
                        <>Verify the formula in <b className="text-amber-800">Live Preview</b>, then click <b>"Save Line Mapping"</b> to instantly calculate.</>
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-200/80 bg-white px-4 py-3 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-black text-blue-700 uppercase tracking-wider">
                      {isThai ? "💡 ตัวอย่างสูตรการรวม:" : "💡 Example Formula:"}
                    </span>
                    <span className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-1 font-black text-blue-900">
                      AIX-MOT = MOT/A + MOT/B + MOT/D
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    {isThai ? (
                      <>* ไลน์ที่บันทึกแล้วสามารถแก้ไข หรือลบทิ้งได้ตลอดเวลาที่แท็บ <b>"📋 รายการ Line & VDS ทั้งหมด"</b></>
                    ) : (
                      <>* Saved lines can be edited or deleted anytime in the <b>"📋 All Lines & VDS"</b> tab.</>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 🔔 แถบแจ้งเตือนไลน์ใหม่ที่ระบบตรวจพบอัตโนมัติจาก API */}
        {detectedNewLines.length > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50/70 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white text-sm font-black shadow-xs">
                  🔔
                </span>
                <div>
                  <h4 className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    <span>
                      {isThai
                        ? `ตรวจพบ Line ใหม่จากฐานข้อมูล API (${detectedNewLines.length} ไลน์ที่ยังไม่ได้ตั้งค่าสูตร)`
                        : `New Lines Auto-Detected from API (${detectedNewLines.length} unmapped)`}
                    </span>
                    <span className="inline-block h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  </h4>
                  <p className="text-[11px] text-amber-800 font-medium">
                    {isThai
                      ? "คลิกที่ชื่อไลน์ด้านล่างเพื่อกรอกข้อมูลและสร้างสูตรคำนวณเข้าสู่ระบบทันที (1-Click Quick Setup)"
                      : "Click any line chip below to quick-fill and map formula instantly."}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 max-h-24 overflow-y-auto">
              {detectedNewLines.map((newLine) => (
                <button
                  key={newLine}
                  type="button"
                  onClick={() => quickAddNewLine(newLine)}
                  className="group inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-black text-amber-900 shadow-2xs hover:border-amber-500 hover:bg-amber-100/80 hover:text-amber-950 transition"
                  title={isThai ? `คลิกเพื่อเพิ่ม ${newLine}` : `Click to add ${newLine}`}
                >
                  <span>{newLine}</span>
                  <span className="rounded-md bg-amber-200/80 px-1.5 py-0.2 text-[10px] font-extrabold text-amber-900 group-hover:bg-amber-300">
                    ➕ {isThai ? "เพิ่ม" : "Add"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mode Tabs */}
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-100 p-1.5">
          <button
            type="button"
            onClick={() => {
              clearAll();
              setManagerMode("line");
            }}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition ${
              managerMode === "line"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ModalButtonIcon name="add" />
            {editingParentName
              ? isThai
                ? `กำลังแก้ไข: ${editingParentName}`
                : `Editing: ${editingParentName}`
              : isThai
                ? "➕ สร้าง Line"
                : "➕ Add Line"}
          </button>
          <button
            type="button"
            onClick={() => setManagerMode("vds")}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition ${
              managerMode === "vds"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ModalButtonIcon name="filter" />
            <span>{isThai ? "➕ สร้าง VDS" : "➕ Add VDS"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              reloadMappings();
              setManagerMode("saved" as any);
            }}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition ${
              managerMode === ("saved" as any)
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>📋</span>
            <span>
              {isThai ? "รายการ Line & VDS ทั้งหมด" : "All Lines & VDS"}{" "}
              ({new Set([...Object.keys(savedMappings), ...Object.keys(vdsFormulas)]).size})
            </span>
          </button>
        </div>
        </div>

        {/* Content Area */}
        <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1">
          {managerMode === "vds" ? (
            <VdsFormulaManager
              language={language}
              isThai={isThai}
              initialFormulaToEdit={editingVdsFormula}
              onClearInitialFormula={() => setEditingVdsFormula(null)}
            />
        ) : managerMode === ("saved" as any) ? (
          /* รายการไลน์ที่บันทึกไว้และไลน์มาตรฐาน พร้อมปุ่มแก้ไข / ลบ */
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-base font-black text-slate-800">
                  {isThai ? "รายการไลน์ทั้งหมดในระบบ (All Lines in System)" : "All Lines in System"}
                </h3>
                <p className="text-xs text-slate-500">
                  {isThai
                    ? "เลือกไลน์ที่ต้องการแก้ไขเพื่อเปลี่ยนชื่อ, แก้ไขสูตร หรือลบ/ซ่อนไลน์ออกจากการคำนวณ"
                    : "Select any line to edit formula, rename, or customize mapping."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={lineSearch}
                  onChange={(e) => setLineSearch(e.target.value)}
                  placeholder={isThai ? "ค้นหาชื่อ Line..." : "Search lines..."}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    clearAll();
                    setManagerMode("line");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-blue-700 transition"
                >
                  <span>➕</span>
                  <span>{isThai ? "สร้าง Line ใหม่" : "Create New Line"}</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full border-collapse text-left text-xs border border-slate-200">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold border-b border-slate-300 shadow-xs z-10">
                  <tr>
                    <th className="p-3 w-48 border-r border-slate-200">
                      {isThai ? "ชื่อ Line" : "Line Name"}
                    </th>
                    <th className="p-3 w-36 text-center border-r border-slate-200">
                      {isThai ? "ประเภท" : "Type"}
                    </th>
                    <th className="p-3 border-r border-slate-200">
                      {isThai ? "สูตรและไลน์ย่อย (Child Lines)" : "Calculation / Child Lines"}
                    </th>
                    <th className="p-3 w-40 border-r border-slate-200">
                      {isThai ? "หน้าที่แสดงผล" : "Display Pages"}
                    </th>
                    <th className="p-3 text-center min-w-[280px]">
                      {isThai ? "จัดการ" : "Actions"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {allAvailableLineNames
                    .filter((name) => !lineSearch.trim() || name.toLowerCase().includes(lineSearch.trim().toLowerCase()))
                    .map((name) => {
                      const isCustom = Boolean(savedMappings[name]);
                      const isVdsFormula = Boolean(vdsFormulas[name]);
                      const config = savedMappings[name];
                      const isHidden = hiddenLines.includes(name);

                      // เช็คว่าเป็นไลน์ย่อยกะของ custom parent หรือไม่ เช่น MOMO/A, MOMO/B, MOMO/D
                      const shiftMatch = name.match(/^(.+)\/([ABD])$/i);
                      const parentOfShift = shiftMatch ? shiftMatch[1] : null;
                      const parentConfig = parentOfShift ? savedMappings[parentOfShift] : null;
                      const isCustomShiftSubline = Boolean(parentConfig && Array.isArray(parentConfig.shifts) && parentConfig.shifts.includes(shiftMatch![2].toUpperCase()));

                      const childList = isCustom
                        ? Array.isArray(config?.lines) ? config.lines : []
                        : isCustomShiftSubline
                        ? [name]
                        : (vdsFormulas[name]?.lines || MACRO_PCN_GROUPS[name] || LINE_GROUPS[name] || [name]);

                      const pages = isCustom
                        ? (Array.isArray(config?.displayPages) ? config.displayPages : [])
                        : isCustomShiftSubline
                        ? (Array.isArray(parentConfig?.displayPages) ? parentConfig.displayPages : [])
                        : (vdsFormulas[name]?.pages || tabMenuList.filter((tab) => (tabLinesMap[tab] || []).includes(name)));

                      return (
                        <tr key={name} className={`transition-colors ${isHidden ? "bg-slate-100/70 opacity-60" : "hover:bg-blue-50/30"}`}>
                          <td className="p-3 font-black text-blue-700 text-sm border-r border-slate-200">
                            <div className="flex items-center gap-1.5">
                              {isHidden && <span title={isThai ? "ซ่อนอยู่จากตาราง" : "Hidden from table"}>👁️‍🗨️</span>}
                              <span className={isHidden ? "line-through text-slate-500" : ""}>{name}</span>
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap text-center border-r border-slate-200">
                            {isVdsFormula ? (
                              <span className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-purple-100 border border-purple-300 px-2.5 py-0.5 text-[10px] font-black text-purple-900 shadow-2xs">
                                {isThai ? "⚡ VDS กำหนดเอง" : "⚡ Custom VDS"}
                              </span>
                            ) : isCustom || isCustomShiftSubline ? (
                              <span className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[10px] font-black text-amber-900 shadow-2xs">
                                {isThai ? "⭐ กำหนดเอง" : "⭐ Custom"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 shadow-2xs">
                                {isThai ? "🏢 เริ่มต้น" : "🏢 Default"}
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-slate-600 border-r border-slate-200">
                            {childList.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {childList.slice(0, 10).map((c: string) => (
                                  <span key={c} className="rounded bg-slate-100 border px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                                    {c}
                                  </span>
                                ))}
                                {childList.length > 10 && (
                                  <span className="text-slate-400 font-bold text-[10px] self-center">
                                    +{childList.length - 10} more
                                  </span>
                                )}
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="p-3 text-slate-600 font-semibold border-r border-slate-200">
                            {pages.length > 0 ? pages.join(", ") : "-"}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-nowrap whitespace-nowrap">
                              {/* 1. ปุ่มแก้ไข (Edit) */}
                              {isVdsFormula ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingVdsFormula(name);
                                    setManagerMode("vds");
                                  }}
                                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-2xs"
                                >
                                  <span>✏️</span>
                                  <span>{isThai ? "แก้ไข" : "Edit"}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => loadMappingForEdit(name)}
                                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-2xs"
                                  title="แก้ไขชื่อหรือสูตรของไลน์นี้"
                                >
                                  <span>✏️</span>
                                  <span>{isThai ? "แก้ไข" : "Edit"}</span>
                                </button>
                              )}

                              {/* 2. ปุ่มซ่อนตาราง / แสดงตาราง (Hide / Show) */}
                              <button
                                type="button"
                                onClick={() => toggleHideLine(name)}
                                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-bold transition shadow-2xs ${
                                  isHidden
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                                }`}
                                title={isHidden ? (isThai ? "คลิกเพื่อแสดงไลน์นี้บนตาราง Dashboard" : "Click to show on dashboard") : (isThai ? "คลิกเพื่อซ่อนไลน์นี้จากตาราง Dashboard" : "Click to hide from dashboard")}
                              >
                                <span>{isHidden ? "👁️" : "🙈"}</span>
                                <span>{isHidden ? (isThai ? "แสดงตาราง" : "Show") : (isThai ? "ซ่อนตาราง" : "Hide")}</span>
                              </button>

                              {/* 3. ปุ่มลบ (Delete) */}
                              {isVdsFormula ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const confirm = await Swal.fire({
                                      title: `Delete ${name}?`,
                                      text: isThai ? `ต้องการลบสูตร ${name} หรือไม่?` : "Are you sure you want to remove this VDS formula?",
                                      icon: "warning",
                                      showCancelButton: true,
                                      confirmButtonColor: "#ef4444",
                                      cancelButtonColor: "#64748b",
                                      confirmButtonText: isThai ? "ลบ" : "Delete",
                                      cancelButtonText: isThai ? "ยกเลิก" : "Cancel",
                                    });
                                    if (!confirm.isConfirmed) return;
                                    try {
                                      const res = await fetch(`${MANHOUR_VDS_FORMULA_ENDPOINT}/${encodeURIComponent(name)}`, {
                                        method: "DELETE",
                                      });
                                      if (!res.ok) throw new Error("Failed to delete VDS");
                                      try {
                                        const mappings = JSON.parse(localStorage.getItem("manhour-line-mappings") || "{}");
                                        delete mappings[name];
                                        localStorage.setItem("manhour-line-mappings", JSON.stringify(mappings));
                                        Object.keys(localStorage).forEach((key) => {
                                          if (key.startsWith("manhour-summary-") || key.startsWith("manhour-fast-")) {
                                            localStorage.removeItem(key);
                                          }
                                        });
                                      } catch {}
                                      await Swal.fire("Deleted!", `${name} has been removed.`, "success");
                                      window.location.reload();
                                    } catch (err: any) {
                                      Swal.fire("Error", err.message || "Failed", "error");
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition shadow-2xs"
                                >
                                  <span>🗑️</span>
                                  <span>{isThai ? "ลบ" : "Delete"}</span>
                                </button>
                              ) : (
                                <>
                                  {isCustom && (MACRO_PCN_GROUPS[name] || LINE_GROUPS[name]) && (
                                    <button
                                      type="button"
                                      onClick={() => restoreToBuiltinDefault(name)}
                                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition shadow-2xs"
                                      title={isThai ? "คืนค่าเดิมจาก lineGroups.ts" : "Restore default"}
                                    >
                                      <span>🔄</span>
                                      <span>{isThai ? "คืนค่าเดิม" : "Restore"}</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => deleteMapping(name)}
                                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition shadow-2xs"
                                    title={isThai ? "ลบไลน์นี้ออกจากระบบ" : "Delete this line"}
                                  >
                                    <span>🗑️</span>
                                    <span>{isThai ? "ลบ" : "Delete"}</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col overflow-hidden">
            {editingParentName && (
              <div className="shrink-0 mb-3 flex items-center justify-between rounded-2xl bg-amber-50 border border-amber-300 p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-base">✏️</span>
                  <div>
                    <p className="text-xs font-bold text-amber-800">
                      {isThai ? "กำลังแก้ไข Line เดิม" : "Editing Existing Line"}
                    </p>
                    <p className="text-sm font-black text-amber-950">
                      {editingParentName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearAll();
                    setEditingParentName(null);
                  }}
                  className="rounded-xl bg-white border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition shadow-xs"
                >
                  {isThai ? "✕ ยกเลิกการแก้ไข" : "✕ Cancel Edit"}
                </button>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-12 flex-1 min-h-0 items-stretch">
            {/* Left Column: Line Information Card (5 cols) */}
            <div className="lg:col-span-5 space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col overflow-y-auto">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <span className="text-base">🏷️</span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  {isThai ? "ข้อมูลไลน์หลัก (Parent Line Info)" : "Parent Line Information"}
                </h3>
              </div>

              {/* Step 1: Line Name */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">1</span>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    {isThai ? "ชื่อไลน์หลัก (Line Name)" : "Parent Line Name"}
                  </label>
                </div>
                <input
                  value={parent}
                  onChange={(event) =>
                    setParent(event.target.value)
                  }
                  placeholder="EX: MOMO, AIX-MOT"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
                <p className="mt-1 text-[11px] text-slate-400 font-medium">
                  {isThai ? "💡 กรอกชื่อไลน์ เช่น MOMO หรือไลน์รวมใหญ่" : "💡 Enter parent line name, e.g. MOMO"}
                </p>
              </div>

              {/* Step 2: Shifts */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">2</span>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    {isThai ? "กะทำงานย่อย (Shifts)" : "Work Shifts"}
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["A", "B", "D"].map((shift) => {
                    const isSelected = shifts.includes(shift);
                    return (
                      <button
                        key={shift}
                        type="button"
                        onClick={() => toggleShift(shift)}
                        className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-black transition ${
                          isSelected
                            ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-200"
                            : "border-slate-200 bg-slate-50/50 text-slate-600 hover:border-blue-300 hover:bg-white"
                        }`}
                      >
                        <span>{isSelected ? "✓" : "+"}</span>
                        <span>Shift {shift}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] text-slate-400 font-medium">
                  {isThai ? "💡 ระบบจะสร้างไลน์ย่อย เช่น MOMO/A, MOMO/B ให้อัตโนมัติ" : "💡 Automatically generates child lines like MOMO/A, MOMO/B"}
                </p>
              </div>

              {/* Step 3: Display Pages */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">3</span>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    {isThai ? "หน้าที่ต้องการให้แสดงผล (Display Pages)" : "Display Pages"}
                  </label>
                </div>
                <div className="flex flex-col space-y-1.5">
                  {tabMenuList.map((page) => {
                    const selected = displayPages.includes(page);
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => toggleDisplayPage(page)}
                        aria-pressed={selected}
                        className={`flex items-center justify-between w-full rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
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
              </div>

              {/* Step 4: Category */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-400 text-[10px] font-black text-white">4</span>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    {isThai ? "ประเภทไลน์ (Main Category)" : "Main Category"}
                  </label>
                </div>
                <div className="grid gap-2 grid-cols-3">
                  {["Direct", "Indirect", "Indirect Production"].map((type) => {
                    const selected = lineTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setLineTypes((current) => selected ? current.filter((item) => item !== type) : [...current, type])}
                        className={`rounded-xl border px-2 py-2 text-[11px] font-bold transition ${
                          selected
                            ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                            : "border-slate-200 bg-slate-50/50 text-slate-600 hover:border-slate-300 hover:bg-white"
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Child Lines Selector + Preview & Save (7 cols) */}
            <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col min-h-0 space-y-3">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">5</span>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    {isThai ? "เลือกไลน์ย่อยที่จะนำมารวม (Child Lines Included)" : "Child Lines Included"}
                  </h3>
                </div>
                <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-black text-blue-700">
                  {childLines.length} {isThai ? "ไลน์ที่เลือก" : "selected"}
                </span>
              </div>

              {/* Search & Quick Action Buttons */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    value={lineSearch}
                    onChange={(event) => setLineSearch(event.target.value)}
                    placeholder={isThai ? "🔍 พิมพ์ค้นหาไลน์ย่อย เช่น VAC, OST..." : "🔍 Search child lines..."}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
                  />
                  {lineSearch && (
                    <button
                      type="button"
                      onClick={() => setLineSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-black text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {childLines.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setChildLines([])}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
                  >
                    {isThai ? "ล้างที่เลือก" : "Clear"}
                  </button>
                )}
                {Boolean(parent && (MACRO_PCN_GROUPS[parent] || LINE_GROUPS[parent])) && (
                  <button
                    type="button"
                    onClick={() => resetToDefaultConfig(parent)}
                    className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 transition"
                    title={isThai ? "รีเซ็ต Child Lines และค่าต่างๆ กลับเป็นค่าเริ่มต้นจาก lineGroups.ts" : "Reset to default config from lineGroups.ts"}
                  >
                    <span>🔄</span>
                    <span>{isThai ? "รีเซ็ตค่าเดิมจาก config" : "Reset Config"}</span>
                  </button>
                )}
              </div>

              {/* Child Lines Grid */}
              <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/30 p-2 space-y-1">
                {lineOptions.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-400 font-semibold">
                    {isThai ? "ไม่พบไลน์ที่ตรงกับคำค้นหา" : "No matching lines found"}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {lineOptions.map((line) => {
                      const isSelected = childLines.includes(line);
                      return (
                        <label
                          key={line}
                          className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                            isSelected
                              ? "bg-blue-50 text-blue-900 border border-blue-200"
                              : "text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              setChildLines((current) =>
                                isSelected
                                  ? current.filter((item) => item !== line)
                                  : [...current, line],
                              )
                            }
                            className="h-4 w-4 rounded accent-blue-600"
                          />
                          <span className="truncate">{line}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Badges */}
              {childLines.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto rounded-xl bg-blue-50/60 p-2.5 border border-blue-200">
                  <span className="text-[11px] font-black text-blue-900 mr-1">
                    {isThai ? "เลือกแล้ว:" : "Selected:"}
                  </span>
                  {childLines.map((line) => (
                    <span
                      key={line}
                      className="inline-flex items-center gap-1 rounded-lg bg-white border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-blue-900 shadow-2xs"
                    >
                      {line}
                      <button
                        type="button"
                        onClick={() => removeChildLine(line)}
                        className="text-slate-400 hover:text-rose-600 font-black ml-0.5"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Live Preview Box */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-3.5 text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-black text-blue-900">
                    {isThai ? "📋 ตัวอย่างผลลัพธ์ (Preview)" : "📋 Configuration Preview"}
                  </span>
                  <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">Live</span>
                </div>
                <div className="font-mono text-[11px] text-slate-800 bg-white p-2 rounded-xl border border-blue-200/60 truncate">
                  {(() => {
                    const ownShiftLines = shifts.map((s) => `${parent}/${s}`);
                    const allCombined = [...new Set([...ownShiftLines, ...childLines])];
                    return parent && allCombined.length ? `${parent} = ${allCombined.join(" + ")}` : (isThai ? "ยังไม่ได้กำหนดสูตร" : "Formula not configured");
                  })()}
                </div>
              </div>

              {/* ปุ่มบันทึกข้อมูล */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={saveLineMapping}
                  disabled={!parent.trim() || (childLines.length === 0 && shifts.length === 0)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black text-white shadow-md shadow-blue-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 transition"
                >
                  <ModalButtonIcon name="apply" />
                  <span>{isThai ? "💾 บันทึก Line Mapping" : "💾 Save Line Mapping"}</span>
                </button>
              </div>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Modal Footer with fixed Close button */}
        <div className="mt-3 flex shrink-0 justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <ModalButtonIcon name="close" />
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
