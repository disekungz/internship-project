/**
 * ยูทิลิตี้สำหรับจัดประเภท Line การผลิต:
 * - "แบบรวมคน" (Summary / Aggregate / Macro / Process Groups): ไลน์ที่รวมหลายกระบวนการเข้าด้วยกัน
 * - "ไลน์ย่อย" (Sub-lines / Production Lines): ตัวมันเองที่เป็นสายการผลิตหรือสถานีงานเดี่ยว (เช่น HOT PRESS, VAC, BLK)
 * - "แยกตามกะ" (Shift Lines): รายการแยกลงท้ายด้วย /A, /B, /D
 */
import {
  LINE_GROUPS,
  MACRO_PCN_GROUPS,
  TAB_TOTAL_LINE_MAP,
} from "../config/lineGroups";

/**
 * ตรวจสอบว่า Line นี้เป็นรายการแยกตามกะ (/A, /B, /D) หรือไม่
 */
export function isShiftLine(lineName: string): boolean {
  if (!lineName) return false;
  return /\/[ABD]\s*$/i.test(lineName.trim());
}

/**
 * ดึงชื่อ Base Line (ตัวมันเอง) โดยตัดส่วนลงท้ายกะ /A, /B, /D ออก
 */
export function getBaseLineName(lineName: string): string {
  if (!lineName) return "";
  return lineName.replace(/\/[ABD]\s*$/i, "").trim();
}

/**
 * ตรวจสอบว่า Line นี้เป็น "ไลน์แบบรวมคน" (Aggregate / Summary / Macro / Total Line) หรือไม่
 * กฎเหล็ก: ไลน์ย่อยคือ "ตัวมันเอง" (เช่น HOT PRESS, VAC, BLK) แม้จะรวมคนจากกะ A, B, D ก็ยังคงเป็นไลน์ย่อยตัวมันเอง
 * จะถือว่าเป็น "ไลน์แบบรวมคน" ก็ต่อเมื่อเกิดจากการรวมหลายสายการผลิต/หลายกระบวนการที่ต่างกันเข้าด้วยกันเท่านั้น
 */
export function isAggregateLine(lineName: string, activeTab?: string): boolean {
  if (!lineName) return false;
  const trimmed = lineName.trim();

  // 1. ถ้าเป็นรายการระบุกะชัดเจน (/A, /B, /D) -> เป็นรายการกะย่อย ไม่ใช่ไลน์แบบรวมคน
  if (isShiftLine(trimmed)) {
    return false;
  }

  // 2. ชื่อมาตรฐานของไลน์รวมสูงสุดประจำแท็บ (TAB_TOTAL_LINE_MAP)
  if (Object.values(TAB_TOTAL_LINE_MAP).includes(trimmed)) {
    return true;
  }

  // 3. ชื่อที่มีคำสำคัญบ่งบอกการรวมระดับโรงงาน หรือสูตรคำนวณข้ามกลุ่มกระบวนการ
  if (
    /^(Macro|Direct|Indirect|Total)/i.test(trimmed) ||
    /(\+|VDS|_FRONT|_FIN|_GEN|_AUTO)/i.test(trimmed) ||
    trimmed.includes("(") || // e.g. "FPC_FRONT ( MATERIAL + HOT PRESS...)"
    trimmed.includes("&")   // e.g. "HPS & VAC", "MAS & REW"
  ) {
    return true;
  }

  // 4. ชื่อกลุ่มกระบวนการรวมที่ระบุชัดเจน
  const knownGroupSummaries = new Set([
    "Line B",
    "LINE A_Automotive",
    "LINE A_FRONT",
    "SMT FRONT_DIRECT",
    "SMT FRONT_INDIRECT",
    "SMT BACK_DIRECT",
    "SMT BACK_INDIRECT",
    "ASY SMT",
    "AIX-SMT",
    "QA",
    "QA_FPC",
    "QA_SMT",
    "QA_IND",
    "LOG",
    "PLN",
    "PTE",
    "NPM",
    "GFPS",
  ]);
  if (knownGroupSummaries.has(trimmed)) {
    return true;
  }

  // 5. ตรวจสอบใน LINE_GROUPS หรือ MACRO_PCN_GROUPS:
  // ต้องมีสมาชิกที่เป็น "คนละกระบวนการกัน" (Distinct Base Lines > 1) จึงจะถือว่าเป็นไลน์รวมคน
  // หากมีสมาชิกแค่กะ A, B, D ของตัวมันเอง เช่น HOT PRESS -> ["HOT PRESS/A", "HOT PRESS/B", "HOT PRESS/D"]
  // ถือว่า HOT PRESS เป็น "ไลน์ย่อย (ตัวมันเอง)" ไม่ใช่ไลน์แบบรวมคน
  const lgMembers = (LINE_GROUPS as Record<string, string[]>)[trimmed];
  if (Array.isArray(lgMembers) && lgMembers.length > 1) {
    const distinctBaseLines = new Set(
      lgMembers.map((m) => getBaseLineName(m)).filter(Boolean)
    );
    if (distinctBaseLines.size > 1) {
      return true;
    }
  }

  const pcnMembers = (MACRO_PCN_GROUPS as Record<string, string[]>)[trimmed];
  if (Array.isArray(pcnMembers) && pcnMembers.length > 1) {
    const distinctBaseLines = new Set(
      pcnMembers.map((m) => getBaseLineName(m)).filter(Boolean)
    );
    if (distinctBaseLines.size > 1) {
      return true;
    }
  }

  return false;
}

/**
 * แยกประเภทไลน์: 'summary' (แบบรวมคน) หรือ 'subline' (ไลน์ย่อยตัวมันเอง) หรือ 'shift' (แยกตามกะ)
 */
export function getLineCategory(
  lineName: string,
  activeTab?: string
): "summary" | "subline" | "shift" {
  if (isAggregateLine(lineName, activeTab)) return "summary";
  if (isShiftLine(lineName)) return "shift";
  return "subline";
}

/**
 * จัดกลุ่มรายชื่อ Lines ออกเป็น 3 กลุ่มชัดเจน:
 * - summaryLines: ไลน์แบบรวมคน (Macro / Multi-Process Summaries)
 * - subLines: ไลน์ย่อยการผลิต (ตัวมันเอง เช่น HOT PRESS, VAC, BLK, OST, LINE C, LINE D)
 * - shiftLines: รายการแยกตามกะการผลิต (/A, /B, /D)
 */
export function partitionLines(
  lines: string[],
  activeTab?: string
): {
  summaryLines: string[];
  subLines: string[];
  shiftLines: string[];
} {
  const summaryLines: string[] = [];
  const subLines: string[] = [];
  const shiftLines: string[] = [];

  lines.forEach((line) => {
    if (isAggregateLine(line, activeTab)) {
      summaryLines.push(line);
    } else if (isShiftLine(line)) {
      shiftLines.push(line);
    } else {
      subLines.push(line);
    }
  });

  return { summaryLines, subLines, shiftLines };
}
