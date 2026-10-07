import { fetchDynamicLines } from "../../../../utils/apiConfig";
import { fetchMacroLinesData } from "../services/productivityApi";

export type CustomMacroLine = {
  id?: number | string;
  macro_name: string;
  sub_lines: string[] | string;
  output_source_line?: string | string[] | null;
  position_before?: string | null;
  show_plan_row?: boolean;
  show_target_row?: boolean;
  show_ot_rows: boolean;
  show_leave_rows: boolean;
  units?: string[];
  factory?: string;
  is_active?: boolean;
};

const STORAGE_KEY = "productivity_cached_macros";

let cachedMacros: CustomMacroLine[] = (() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
})();

export const setCachedCustomMacroLines = (macros: CustomMacroLine[]) => {
  cachedMacros = macros;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(macros));
  } catch (e) {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("custom-macros-updated", { detail: macros }));
  }
};

export const fetchCustomMacroLines = async (): Promise<CustomMacroLine[]> => {
  try {
    const dynLines = await fetchDynamicLines();
    if (Array.isArray(dynLines) && dynLines.length > 0) {
      const activeLines = dynLines
        .filter(dl => dl.is_active !== false)
        .map((dl, idx) => ({
          id: dl.id || idx + 1,
          macro_name: dl.line_name,
          sub_lines: [...(dl.sub_line_sources || []), ...(dl.cost_center_sources || [])],
          output_source_line: dl.output_sources,
          show_plan_row: dl.show_plan_row !== false,
          show_target_row: dl.show_target_row !== false,
          show_ot_rows: dl.show_ot_rows !== false,
          show_leave_rows: dl.show_leave_rows !== false,
          units: dl.units || ["piece"],
          factory: dl.factory || "SMT",
          is_active: dl.is_active !== false,
        }));
      setCachedCustomMacroLines(activeLines);
      return activeLines;
    }

    // Fallback fetch macro lines if dynamic lines empty
    const json = await fetchMacroLinesData();
    if (json && json.success && Array.isArray(json.data)) {
      const activeLines = json.data.filter((m: any) => m.is_active !== false).map((m: any) => ({
        ...m,
        factory: m.factory || "SMT"
      }));
      setCachedCustomMacroLines(activeLines);
      return activeLines;
    }
  } catch (e) {
    console.warn("Failed to fetch custom macro lines:", e);
  }
  return cachedMacros;
};

export const getCachedCustomMacroLines = (): CustomMacroLine[] => {
  if (cachedMacros.length === 0) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) cachedMacros = JSON.parse(saved);
    } catch (e) {}
  }
  return cachedMacros;
};

export const findCustomMacro = (lineName: string): CustomMacroLine | undefined => {
  if (!lineName) return undefined;
  const raw = lineName.trim().toUpperCase();
  const clean = raw.replace(/^LINE\s+/i, "").trim();
  const macros = getCachedCustomMacroLines();
  return macros.find(m => {
    const mRaw = m.macro_name.trim().toUpperCase();
    const mClean = mRaw.replace(/^LINE\s+/i, "").trim();
    return mRaw === raw || mClean === clean || mRaw === clean || mClean === raw;
  });
};

export const isCustomMacroName = (lineName: string): boolean => {
  return findCustomMacro(lineName) !== undefined;
};

export const getCustomMacroSubLines = (macro: CustomMacroLine): string[] => {
  if (!macro || !macro.sub_lines) return [];
  if (Array.isArray(macro.sub_lines)) return macro.sub_lines.filter(Boolean);
  if (typeof macro.sub_lines === "string") {
    try {
      const parsed = JSON.parse(macro.sub_lines);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
      return [macro.sub_lines];
    } catch (e) {
      return [macro.sub_lines];
    }
  }
  return [];
};

export const getCustomMacroOutputSources = (macro: CustomMacroLine): string[] => {
  if (!macro) return [];
  const src = macro.output_source_line;
  if (!src) return [];
  if (Array.isArray(src)) {
    return src.filter(Boolean);
  }
  if (typeof src === "string") {
    try {
      const parsed = JSON.parse(src);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }
      if (src.trim()) return [src.trim()];
    } catch (e) {
      if (src.trim()) return [src.trim()];
    }
  }
  return [];
};
