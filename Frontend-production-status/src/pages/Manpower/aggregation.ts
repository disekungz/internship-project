/**
 * โมดูลการคำนวณและประมวลผลข้อมูลกำลังคน (Manpower Aggregation Engine)
 * - คำนวณสรุปผลตาม Line, Tab, สิทธิ์การนับคน (Present/Absent), Help In/Out, ชั่วโมง OT
 * - กำหนดฟังก์ชัน Mapping และสูตรคำนวณต่างๆ สำหรับหน้าจอ Manpower
 */
import {
  ADMIN_VDS_FORMULA_REGISTRY,
  LINE_GROUPS,
  MACRO_PCN_GROUPS,
  TAB_LINES,
  TAB_TOTAL_LINE_MAP,
} from "./config/lineGroups.ts";

export const DAYS_ARRAY = Array.from({ length: 31 }, (_, i) => i + 1);
const MINIMUM_WORK_HOURS = 4;

/**
 * ฟังก์ชันดึงส่วนของวันที่ให้อยู่ในฟอร์แมต YYYY-MM-DD
 * - รองรับ ISO String, พ.ศ. (แปลงเป็น ค.ศ. อัตโนมัติ), และ Date Object
 */
export const extractDatePart = (dateTimeString?: string | null): string => {
  if (!dateTimeString) return "";
  const text = String(dateTimeString).trim();

  // จัดการรูปแบบวันที่ YYYY-MM-DD (หรือข้อความ ISO String)
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // จัดการรูปแบบวันที่ DD/MM/YYYY หรือ D/M/YYYY (พร้อมแปลงปี พ.ศ. เป็น ค.ศ.)
  const thaiMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (thaiMatch) {
    const buddhistYear = Number(thaiMatch[3]);
    const year = buddhistYear >= 2400 ? buddhistYear - 543 : buddhistYear;
    return `${year}-${thaiMatch[2].padStart(2, "0")}-${thaiMatch[1].padStart(2, "0")}`;
  }

  // แปลงผ่าน Date Object เป็นทางเลือกสำรอง
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);

  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

/**
 * แยกองค์ประกอบวันที่ (year, month, day, monthKey, dateKey) ได้อย่างถูกต้องแม่นยำ
 * ไม่ติดบั๊กของ JavaScript new Date("D/M/YYYY")
 */
export const parseRecordDateParts = (
  raw?: any
): { year: number; month: number; day: number; monthKey: string; dateKey: string } | null => {
  if (!raw) return null;
  const text = String(raw).trim();
  if (!text) return null;

  // 1. YYYY-MM-DD
  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    return {
      year,
      month,
      day,
      monthKey: `${year}-${String(month).padStart(2, "0")}`,
      dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    };
  }

  // 2. D/M/YYYY หรือ DD/MM/YYYY
  const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) {
    const bYear = Number(dmy[3]);
    const year = bYear >= 2400 ? bYear - 543 : bYear;
    const month = Number(dmy[2]);
    const day = Number(dmy[1]);
    return {
      year,
      month,
      day,
      monthKey: `${year}-${String(month).padStart(2, "0")}`,
      dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    };
  }

  // 3. Fallback to Date object
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return {
    year,
    month,
    day,
    monthKey: `${year}-${String(month).padStart(2, "0")}`,
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
};

export const getRuntimeMappings = () => {
  if (typeof window !== "undefined") {
    try {
      return JSON.parse(window.localStorage.getItem("manhour-line-mappings") || "{}");
    } catch {
      return {};
    }
  }
  return {};
};

export const getRuntimeLineGroup = (lineName: string, passedMappings?: Record<string, any>) => {
  const builtIn = MACRO_PCN_GROUPS[lineName] || LINE_GROUPS[lineName];
  const mappings = passedMappings || getRuntimeMappings();

  try {
    // ถ้า user เคย Edit/Save ไลน์นี้โดยตรงใน UI → custom mapping จะ override built-in ทั้งหมด
    // (ไม่ใช่แค่ merge ต่อท้าย)
    if (mappings?.[lineName]?.lines && Array.isArray(mappings[lineName].lines)) {
      const directLines = mappings[lineName].lines as string[];
      // รวม lines ที่ถูก contribute เข้ามาจาก custom lines อื่นๆ ที่ระบุ macroGroups เป็น lineName
      const contributedLines = Object.values(mappings)
        .filter((mapping: any) => {
          if (mapping?.parent === lineName) return false; // ข้าม self
          return Array.isArray(mapping?.macroGroups)
            ? mapping.macroGroups.includes(lineName)
            : mapping?.macroGroup === lineName;
        })
        .flatMap((mapping: any) => Array.isArray(mapping?.lines) ? mapping.lines : []);
      return [...new Set([...(directLines.length > 0 ? directLines : [lineName]), ...contributedLines])];
    }
  } catch {
    // ละเว้นข้อผิดพลาด
  }

  try {
    // ถ้าไม่มี direct mapping สำหรับ lineName เอง
    // → หา custom lines จาก mapping อื่นที่ระบุ macroGroups = lineName แล้วผสมเข้ากับ built-in
    const contributedLines = Object.values(mappings)
      .filter((mapping: any) =>
        Array.isArray(mapping?.macroGroups)
          ? mapping.macroGroups.includes(lineName)
          : mapping?.macroGroup === lineName,
      )
      .flatMap((mapping: any) => Array.isArray(mapping?.lines) ? mapping.lines : []);
    if (contributedLines.length) return [...new Set([...(builtIn || []), ...contributedLines])];
  } catch {
    // ละเว้นข้อผิดพลาด
  }

  if (builtIn) return builtIn;

  try {
    // ตรวจสอบว่า lineName เป็นไลน์ย่อยแยกกะของ custom parent (เช่น MOMO/A, MOMO/B, MOMO/D)
    const shiftMatch = lineName.match(/^(.+)\/([ABD])$/i);
    if (shiftMatch) {
      const parentName = shiftMatch[1];
      const parentMapping = mappings?.[parentName];
      if (parentMapping) {
        return [lineName];
      }
    }
  } catch {
    // ละเว้นข้อผิดพลาด
  }

  return [lineName];
};

export const getRuntimeHiddenLines = (): string[] => {
  if (typeof window !== "undefined") {
    try {
      return JSON.parse(window.localStorage.getItem("manhour-hidden-lines") || "[]");
    } catch {
      return [];
    }
  }
  return [];
};

export const setRuntimeHiddenLine = (lineName: string, hidden: boolean) => {
  if (typeof window === "undefined") return;
  try {
    const current = getRuntimeHiddenLines();
    const next = hidden
      ? [...new Set([...current, lineName])]
      : current.filter((l) => l !== lineName);
    window.localStorage.setItem("manhour-hidden-lines", JSON.stringify(next));
    window.dispatchEvent(new Event("manhour-hidden-lines-changed"));
  } catch (e) {
    console.error("Failed to update hidden lines", e);
  }
};

export const getRuntimeTabLines = (tab: string, passedMappings?: Record<string, any>) => {
  const lines = [...(TAB_LINES[tab] || [])];
  const mappings = passedMappings || getRuntimeMappings();
  const hiddenLines = new Set(getRuntimeHiddenLines());

  try {
    const shiftOrder: Record<string, number> = { A: 1, B: 2, D: 3 };
    Object.entries(mappings).forEach(([parent, mapping]: [string, any]) => {
      if (mapping?.displayPages?.includes(tab)) {
        if (!lines.includes(parent)) lines.push(parent);
        // ลงทะเบียนไลน์ย่อยของแต่ละกะ เรียงลำดับตาม A, B, D อย่างเป็นมาตรฐาน
        if (Array.isArray(mapping?.shifts)) {
          const sortedShifts = [...mapping.shifts].sort(
            (a: string, b: string) => (shiftOrder[a] || 99) - (shiftOrder[b] || 99),
          );
          sortedShifts.forEach((shift: string) => {
            const shiftLine = `${parent}/${shift}`;
            if (!lines.includes(shiftLine)) lines.push(shiftLine);
          });
        }
      }
    });
  } catch {
    // ละเว้นข้อผิดพลาด
  }

  return lines.filter((line) => !hiddenLines.has(line));
};

export const EMPTY_DAY_INPUT = {
  opRegister: 0,
  swipeCards: 0,
  notWorking: 0,
  helpOutHrs: 0,
  helpInHrs: 0,
  ot1Psn: 0,
  manOT1: 0,
  manOT1HelpOut: 0,
  manOT1HelpIn: 0,
  manOT2: 0,
  manOT2HelpOut: 0,
  manOT2HelpIn: 0,
  // This is metadata only.  It lets the UI distinguish a real zero from a
  // day for which the source sent no record at all.
  sourceRecordCount: 0,
};

// A line explicitly marked VDS belongs to the VDS status, regardless of an
// outdated status value in its imported attendance record.
export const getEffectiveRecordStatus = (record: any) => {
  const line = String(
    record?.line_check ||
    record?.line_out ||
    record?.line ||
    record?.department ||
    "",
  ).trim();
  if (/(?:_|-)VDS\b/i.test(line)) return "VDS";
  const status = String(record?.status || "").trim().toUpperCase();
  if (status === "VDS") return "VDS";
  return record?.status ? String(record.status).trim() : "Training Center";
};

export const createZeroLineData = () => {
  const data = {};
  DAYS_ARRAY.forEach((day) => {
    data[day] = { ...EMPTY_DAY_INPUT };
  });
  return data;
};

export const enrichSpreadsheetWithCustomLines = (
  spreadsheetData: Record<string, any>,
  passedMappings?: Record<string, any>,
) => {
  if (!spreadsheetData || typeof spreadsheetData !== "object") return spreadsheetData;
  const mappings = passedMappings || getRuntimeMappings();
  const nextData = { ...spreadsheetData };
  const originalData = { ...spreadsheetData };

  // Helper สำหรับดึงข้อมูลวันของไลน์ย่อย (ของใครของมันอย่างเด็ดขาด)
  const getChildDayData = (childLine: string, day: number) => {
    // 1. ดึงจาก originalData ของไลน์นั้นตรงๆ
    if (originalData[childLine]?.[day] && Number(originalData[childLine][day].opRegister || 0) > 0) {
      return originalData[childLine][day];
    }
    // 2. ถ้า childLine นั้นมีข้อมูลใน nextData
    if (nextData[childLine]?.[day] && Number(nextData[childLine][day].opRegister || 0) > 0) {
      return nextData[childLine][day];
    }
    return originalData[childLine]?.[day] || nextData[childLine]?.[day] || null;
  };

  Object.entries(mappings).forEach(([parentName, mapping]: [string, any]) => {
    const rawChildLines = Array.isArray(mapping?.lines) ? mapping.lines : [];
    const normParent = parentName.trim().toUpperCase();

    // 1. ตรวจสอบและเตรียมข้อมูลไลน์ย่อยของกะ (เช่น MOMO/A, MOMO/B, MOMO/D)
    // ไลน์กะย่อยของตัวเอง ต้องแสดงเฉพาะข้อมูลที่สแกนเป็นไลน์ย่อยนั้นจริงๆ (originalData[shiftLine]) เท่านั้น
    // ไม่ใช่เอา ACC/D หรือ child lines อื่นๆ มาใส่ใน MOMO/D
    if (Array.isArray(mapping?.shifts) && mapping.shifts.length > 0) {
      mapping.shifts.forEach((shift: string) => {
        const shiftLine = `${parentName}/${shift}`;
        if (!nextData[shiftLine]) {
          nextData[shiftLine] = originalData[shiftLine] || createZeroLineData();
        }
      });
    }

    // 2. รวมยอดและคำนวณไลน์หลักแบบกำหนดเอง (เช่น MOMO หรือ ACC)
    // กรองเอาเฉพาะ Child Lines จริงๆ ที่ไม่ใช่ไลน์กะของตัวมันเอง (เช่น ตัด MOMO/A, MOMO/B, MOMO/D ออก)
    // เพื่อป้องกันการบวกเบิ้ลซ้ำสองรอบ
    const ownShiftPrefix = `${normParent}/`;
    const externalChildLines = rawChildLines.filter((cl: string) => {
      const clUpper = cl.trim().toUpperCase();
      return clUpper !== normParent && !clUpper.startsWith(ownShiftPrefix);
    });

    // ถ้า parentName ได้รับการคำนวณสูตรโดยตรงจาก attendance records ใน buildFullSpreadsheetData แล้ว ให้ใช้ค่านั้นเป็นหลัก
    const parentAlreadyCalculated = DAYS_ARRAY.some(
      (d) => Number(originalData[parentName]?.[d]?.opRegister || 0) > 0
    );

    if (!parentAlreadyCalculated) {
      // รวมข้อมูลจาก:
      // (1) ข้อมูลการสแกนบัตรที่ตรงกับกะของตัวมันเองโดยตรง (MOMO/A, MOMO/B, MOMO/D)
      // (2) ข้อมูลจาก External Child Lines ที่เลือกดึงมารวม (เช่น ACC/D)
      const parentData = createZeroLineData();
      const ownShiftLines = Array.isArray(mapping?.shifts)
        ? mapping.shifts.map((s: string) => `${parentName}/${s}`)
        : [];
      
      const linesToAggregate = [...new Set([...ownShiftLines, ...externalChildLines])];

      DAYS_ARRAY.forEach((day) => {
        linesToAggregate.forEach((childLine: string) => {
          const childDay = getChildDayData(childLine, day);
          if (childDay) {
            Object.keys(EMPTY_DAY_INPUT).forEach((field) => {
              parentData[day][field] += Number(childDay[field]) || 0;
            });
          }
        });
      });

      const hasAnyData = DAYS_ARRAY.some((d) => Number(parentData[d]?.opRegister || 0) > 0);
      if (hasAnyData) {
        nextData[parentName] = parentData;
      }
    }
  });

  return nextData;
};

export const buildCalculatedRows = (lineData, calendarByDay = null) => {
  const rows = {};

  DAYS_ARRAY.forEach((day) => {
    const inputs = lineData[day] || { ...EMPTY_DAY_INPUT };

    const r1 = inputs.opRegister;
    const r2 = inputs.swipeCards;
    const isNonWorkingDay = Number(calendarByDay?.[day]?.manhour) === 0;
    // วันหยุด (Holiday) ให้แสดงแถว "ไม่มาทำงาน" เป็น 0 ตามมาตรฐานรายงานโรงงาน
    const r3 = isNonWorkingDay ? 0 : inputs.notWorking;
    const r4 = inputs.helpOutHrs;
    const r5 = inputs.helpInHrs;
    const r6 = inputs.ot1Psn;
    const r7 = r2;
    const r8 = inputs.manOT1;
    const r9 = inputs.manOT1HelpOut;
    const r10 = inputs.manOT1HelpIn;
    const r11 = inputs.manOT2;
    const r12 = inputs.manOT2HelpOut;
    const r13 = inputs.manOT2HelpIn;

    // Holidays contribute OT only.  The source report leaves both Normal Man
    // Hour rows blank on calendar=0, even if people are present for OT.
    const r14 = isNonWorkingDay ? null : Math.max(r7 * 8 - r4 + r5, 0);
    // OT man-hours use the net OT headcount for each OT type:
    // own-line OT - Help Out + Help In. Clamp at zero to prevent negatives.
    const r15 =
      Math.max(r8 - r9 + r10, 0) * 3 + Math.max(r11 - r12 + r13, 0) * 11;
    const r16 = (r14 || 0) + r15;

    // Target man-hours follow the source report's registered headcount and
    // original OT population.  Help adjustments only belong to the actual
    // man-hour rows above, not the OP & Leader Register target rows.
    const r17 = isNonWorkingDay ? null : r1 * 8;
    // ชั่วโมง OT ของส่วนผลงานจริงและส่วนเป้าหมาย OP & Leader Register จะมีค่าเท่ากัน
    const r18 = r15;
    const r19 = (r17 || 0) + r18;

    const r20 = r3;
    const r21 = r1 > 0 ? ((r3 / r1) * 100).toFixed(1) : "#DIV/0!";
    const r22 = r1 > 0 ? ((r8 / r1) * 100).toFixed(1) : "#DIV/0!";
    const r23 = r1 > 0 ? ((r11 / r1) * 100).toFixed(1) : "#DIV/0!";

    rows[day] = {
      r1,
      r2,
      r3,
      r4,
      r5,
      r6,
      r7,
      r8,
      r9,
      r10,
      r11,
      r12,
      r13,
      r14,
      r15,
      r16,
      r17,
      r18,
      r19,
      r20,
      r21,
      r22,
      r23,
    };
  });

  return rows;
};

export const getGraphMetricValue = (rows, rowKey) => {
  const sums = { r1: 0, r1_holiday: 0, r3: 0, r8: 0, r11: 0 };
  let total = 0;

  DAYS_ARRAY.forEach((day) => {
    const row = rows[day] || {};
    const rawValue = row[rowKey];
    const value =
      typeof rawValue === "string"
        ? Number.parseFloat(rawValue) || 0
        : Number(rawValue) || 0;
    total += value;
    const isWorkingDay = row.r17 !== null && row.r17 !== undefined;
    if (isWorkingDay) {
      sums.r1 += Number(row.r1) || 0;
    } else {
      sums.r1_holiday += Number(row.r1) || 0;
    }
    sums.r3 += Number(row.r3) || 0;
    sums.r8 += Number(row.r8) || 0;
    sums.r11 += Number(row.r11) || 0;
  });

  if (rowKey === "r21")
    return sums.r1 > 0 ? Number(((sums.r3 / sums.r1) * 100).toFixed(1)) : 0;
  if (rowKey === "r22")
    return sums.r1 > 0 ? Number(((sums.r8 / sums.r1) * 100).toFixed(1)) : 0;
  if (rowKey === "r23") {
    const denom = sums.r1_holiday > 0 ? sums.r1_holiday : sums.r1;
    return denom > 0 ? Number(((sums.r11 / denom) * 100).toFixed(1)) : 0;
  }

  return total;
};

export const getGraphMetricValueForDays = (rows, rowKey, days) => {
  const scopedRows = {};
  days.forEach((day) => {
    scopedRows[day] = rows[day];
  });
  return getGraphMetricValue(scopedRows, rowKey);
};

export const buildTabInputData = (spreadsheetData, activeTab) => {
  const totalLine = TAB_TOTAL_LINE_MAP[activeTab];
  if (totalLine && spreadsheetData[totalLine]) {
    const data = createZeroLineData();
    DAYS_ARRAY.forEach((day) => {
      data[day] = {
        ...EMPTY_DAY_INPUT,
        ...(spreadsheetData[totalLine][day] || {}),
      };
    });
    return data;
  }

  const tabData = createZeroLineData();
  getRuntimeTabLines(activeTab).forEach((lineName) => {
    const lineData = spreadsheetData[lineName] || {};
    DAYS_ARRAY.forEach((day) => {
      const source = lineData[day] || {};
      Object.keys(EMPTY_DAY_INPUT).forEach((field) => {
        tabData[day][field] += Number(source[field]) || 0;
      });
    });
  });
  return tabData;
};

export const buildLinesInputData = (spreadsheetData, lineNames) => {
  const combined = createZeroLineData();
  lineNames.forEach((lineName) => {
    const lineData = spreadsheetData[lineName] || {};
    DAYS_ARRAY.forEach((day) => {
      const source = lineData[day] || {};
      Object.keys(EMPTY_DAY_INPUT).forEach((field) => {
        combined[day][field] += Number(source[field]) || 0;
      });
    });
  });
  return combined;
};

export const cleanLineKey = (val) =>
  String(val || "")
    .replace(/[-_/||\s]/g, "")
    .toUpperCase();

export const applyLineAlias = (val) => String(val || "").trim();

export const extractLineSegment = (val) => {
  const str = String(val || "").trim();
  if (!str) return "";
  const idx = str.lastIndexOf("/");
  return idx >= 0 ? str.slice(idx + 1).trim() : str;
};

export const extractLinePrefix = (val) => {
  const str = String(val || "").trim();
  if (!str) return "";
  const idx = str.lastIndexOf("/");
  return idx >= 0 ? str.slice(0, idx).trim() : str;
};

export const getLineCompareKeys = (val) => {
  const aliased = applyLineAlias(val);
  const keys = [
    cleanLineKey(aliased),
    cleanLineKey(extractLinePrefix(aliased)),
    cleanLineKey(extractLineSegment(aliased)),
  ].filter(Boolean);
  return [...new Set(keys)];
};

export const doesLineValueMatchGroup = (value, groupLines) => {
  const valueKey = cleanLineKey(applyLineAlias(value));
  if (!valueKey) return false;
  const groupKeys = new Set(
    (groupLines || [])
      .map((line) => cleanLineKey(applyLineAlias(line)))
      .filter(Boolean),
  );
  return groupKeys.has(valueKey);
};

export const extractShiftCode = (val) => {
  const str = String(val || "").trim();
  if (!str) return "";
  const idx = str.lastIndexOf("/");
  const prefix = idx >= 0 ? str.slice(0, idx) : "";
  const match = prefix.match(/([A-Za-z])\s*$/);
  return match ? match[1].toUpperCase() : "";
};

export function isRecordMatchingLine(record, lineName) {
  const targetClean = cleanLineKey(applyLineAlias(lineName));
  if (!targetClean) return false;

  const lineCheckAliased = applyLineAlias(record.line_check);
  const lineCheckFullClean = cleanLineKey(lineCheckAliased);
  if (lineCheckFullClean) return lineCheckFullClean === targetClean;

  const lineOutAliased = applyLineAlias(record.line_out);
  const lineOutFullClean = cleanLineKey(lineOutAliased);
  if (lineOutFullClean) return lineOutFullClean === targetClean;

  const lineClean = cleanLineKey(applyLineAlias(record.line));
  const shiftClean = cleanLineKey(extractShiftCode(record.department));

  if (lineClean && shiftClean && `${lineClean}${shiftClean}` === targetClean)
    return true;
  if (lineClean === targetClean) return true;

  const deptClean = cleanLineKey(extractLineSegment(record.department));
  if (deptClean === targetClean) return true;
  if (deptClean && shiftClean && `${deptClean}${shiftClean}` === targetClean)
    return true;

  return false;
}

export function findDominantMonthKey(records) {
  const counts = {};
  records.forEach((rec) => {
    if (!rec.dlh_effective_date_time) return;
    const parts = parseRecordDateParts(rec.dlh_effective_date_time);
    if (!parts) return;
    const key = parts.monthKey;
    counts[key] = (counts[key] || 0) + 1;
  });
  let bestKey = null;
  let bestCount = -1;
  Object.entries(counts).forEach(([key, count]) => {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  });
  return bestKey;
}

export function createDayTrackers() {
  return {
    holidayCount: 0,
    workCount: 0,
    opRegister: new Set(),
    swipeCards: new Set(),
    notWorking: new Set(),
    ot1Psn: new Set(),
    manOT1: new Set(),
    manOT1HelpOut: new Set(),
    manOT1HelpIn: new Set(),
    manOT2: new Set(),
    manOT2HelpOut: new Set(),
    manOT2HelpIn: new Set(),
  };
}

export function shouldCountAsPresent(record) {
  const hasAnyScan = Boolean(record.scan_time_in || record.scan_time_out);
  if (!hasAnyScan) return false;
  return !hasLessThanMinimumWorkHours(record);
}

export function isOtherFactoryRecord(record) {
  if (!record) return false;
  if (record.is_loan_exclude || record.loan_destination) return true;
  const workDayStatus = String(record.work_day_status || "")
    .trim()
    .toUpperCase();
  return workDayStatus.startsWith("1N");
}

function parseAttendanceTime(value) {
  if (!value) return null;
  const text = String(value).trim();
  const thaiDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (thaiDate) {
    const [, day, month, buddhistYear, hour = "0", minute = "0", second = "0"] = thaiDate;
    return new Date(Number(buddhistYear) - 543, Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hasLessThanMinimumWorkHours(record) {
  const timeIn = parseAttendanceTime(record.scan_time_in);
  const timeOut = parseAttendanceTime(record.scan_time_out);
  if (!timeIn || !timeOut) return false;

  // ✅ กะเช้าเริ่มนับตั้งแต่ 08:00 / กะดึกเริ่มนับตั้งแต่ 20:00
  const hourIn = timeIn.getHours();
  const shiftStr = String(record.shift || record.shift_type || "").trim().toUpperCase();
  const isNightShift =
    shiftStr === "N" ||
    shiftStr === "NIGHT" ||
    hourIn >= 17 ||
    hourIn < 5;

  const shiftStart = new Date(timeIn.getTime());
  if (isNightShift) {
    if (hourIn < 5) {
      shiftStart.setDate(shiftStart.getDate() - 1);
    }
    shiftStart.setHours(20, 0, 0, 0);
  } else {
    shiftStart.setHours(8, 0, 0, 0);
  }

  // ถ้าสแกนเข้าก่อนเวลาเริ่มกะ ให้นับตั้งแต่เวลาเริ่มกะ (8:00 หรือ 20:00)
  const effectiveIn = timeIn.getTime() < shiftStart.getTime() ? shiftStart : timeIn;

  let durationMs = timeOut.getTime() - effectiveIn.getTime();
  if (durationMs < 0) durationMs += 24 * 60 * 60 * 1000;

  return durationMs < MINIMUM_WORK_HOURS * 60 * 60 * 1000;
}

export function isHolidayOtEligible(record: any): boolean {
  const timeIn = parseAttendanceTime(record?.scan_time_in);
  const timeOut = parseAttendanceTime(record?.scan_time_out);
  // ถ้าไม่มีการสแกนเลยทั้งเข้าและออก -> ไม่นับ
  if (!timeIn && !timeOut) return false;
  // ถ้ามีสแกนแค่ข้างใดข้างหนึ่ง (เช่น สแกนออก 20:04 หรือสแกนเข้าอย่างเดียว) -> ถือว่ามาทำงาน (นับ)
  if (!timeIn || !timeOut) return true;
  // ถ้ามีทั้งสแกนเข้าและสแกนออกครบ -> ต้องทำงานมากกว่า 4 ชม. (> 4 ชม.) ถ้าทำไม่ถึง (<= 4 ชม.) ไม่นับ
  let durationMs = timeOut.getTime() - timeIn.getTime();
  if (durationMs < 0) durationMs += 24 * 60 * 60 * 1000;
  return durationMs > 4 * 60 * 60 * 1000;
}

export function shouldCountAsAbsent(record, isWorkingCalendarDay = true) {
  if (!isWorkingCalendarDay) return false;
  const hasAnyScan = Boolean(record.scan_time_in || record.scan_time_out);
  return !hasAnyScan;
}

export function applyDayTrackers(dayMap, trackers, workingDateKeys = null, dominantMonthKey = null) {
  DAYS_ARRAY.forEach((day) => {
    const bucket = dayMap[day];
    const track = trackers[day];
    if (!bucket || !track) return;
    bucket.opRegister = track.opRegister.size;
    bucket.swipeCards = track.swipeCards.size;
    
    let isHoliday = false;
    if (workingDateKeys && workingDateKeys.size > 0 && dominantMonthKey) {
      const dateKey = `${dominantMonthKey}-${String(day).padStart(2, "0")}`;
      isHoliday = !workingDateKeys.has(dateKey);
    } else if (workingDateKeys && (workingDateKeys.has(day) || workingDateKeys.has(String(day)))) {
      isHoliday = false;
    } else if (workingDateKeys && workingDateKeys.size > 0) {
      isHoliday = true;
    } else {
      isHoliday = track.holidayCount > 0 && track.holidayCount >= track.workCount;
    }

    // ยอดไม่มาทำงาน (ขาด) = ยอดลงทะเบียน - ยอดรูดบัตรมาทำงาน (วันหยุดตาม tbl_date ให้เป็น 0)
    bucket.notWorking = isHoliday ? 0 : Math.max(0, track.opRegister.size - track.swipeCards.size);
    bucket.ot1Psn = track.ot1Psn.size;
    bucket.manOT1 = track.ot1Psn.size;
    bucket.manOT1HelpOut = track.manOT1HelpOut.size;
    bucket.manOT1HelpIn = track.manOT1HelpIn.size;
    bucket.manOT2 = [...track.manOT2].filter(
      (empId) => !track.manOT2HelpOut.has(empId),
    ).length;
    bucket.manOT2HelpOut = track.manOT2HelpOut.size;
    bucket.manOT2HelpIn = track.manOT2HelpIn.size;
  });
}

export function aggregateRecordsForLine(
  records,
  lineName,
  dominantMonthKey,
  workingDateKeys = null,
) {
  const dayMap = {};
  const trackers = {};
  DAYS_ARRAY.forEach((day) => {
    dayMap[day] = { ...EMPTY_DAY_INPUT };
    trackers[day] = createDayTrackers();
  });

  let fallbackCounter = 0;

  records.forEach((rec) => {
    if (isOtherFactoryRecord(rec)) return;
    if (!rec.dlh_effective_date_time) return;

    const parts = parseRecordDateParts(rec.dlh_effective_date_time);
    if (!parts) return;

    const monthKey = parts.monthKey;
    if (dominantMonthKey && monthKey !== dominantMonthKey) return;

    const day = parts.day;
    const bucket = dayMap[day];
    const track = trackers[day];
    if (!bucket || !track) return;

    const rawEmpId = rec.dlh_employee_id !== undefined && rec.dlh_employee_id !== null ? String(rec.dlh_employee_id).trim() : '';
    if (!rawEmpId) return;
    const empId = rawEmpId;

    const hasHelpEvent = !!rec.line_in;
    const helpHour = Number(rec.help_hour) || 0;

    const isOwnLine = isRecordMatchingLine(rec, lineName);

    const helpDestKeys = getLineCompareKeys(rec.line_in);
    const isHelpingThisLine = helpDestKeys.includes(cleanLineKey(lineName));

    if (isOwnLine || isHelpingThisLine) bucket.sourceRecordCount += 1;

    if (isOwnLine) {
      const workDayStatus = String(rec.work_day_status || "").trim().toUpperCase();
      if (workDayStatus === "H" || workDayStatus === "HOLIDAY") {
        track.holidayCount++;
      } else {
        track.workCount++;
      }
      track.opRegister.add(empId);

      if (shouldCountAsPresent(rec)) {
        track.swipeCards.add(empId);
      }
      const recordDateKey = parts.dateKey;
      const isWorkingCalendarDay =
        !workingDateKeys || workingDateKeys.has(recordDateKey);
      if (shouldCountAsAbsent(rec, isWorkingCalendarDay)) {
        track.notWorking.add(empId);
      }
      if (hasHelpEvent) {
        bucket.helpOutHrs += helpHour;
      }
      if (rec.OT && Number(rec.OT) > 0) {
        const otTypeStr = String(rec.OT_Type || "");
        const isOT1 = otTypeStr.includes("1");
        let isOT2 = otTypeStr.includes("2") || otTypeStr.toLowerCase().includes("holiday");

        // กฎ MANPOWER DASHBOARD: OT Holiday คือต้องทำงานมากกว่า 4 ชม. (> 4 ชม.) ถ้าทำไม่ถึง (<= 4 ชม.) ไม่นับ
        // แต่ถ้าสแกนไม่ครบ (เช่น ออก 20:04 หรือเข้าอย่างเดียว) ให้ถือว่ามาทำงานและนับ
        const isHolidayDate = !isWorkingCalendarDay || workDayStatus === "H" || workDayStatus === "HOLIDAY" || isOT2;
        if (isHolidayDate && isOT2) {
          if (!isHolidayOtEligible(rec)) {
            isOT2 = false;
          }
        }

        if (isOT1) {
          track.ot1Psn.add(empId);
          if (hasHelpEvent) {
            track.manOT1HelpOut.add(empId);
          } else {
            track.manOT1.add(empId);
          }
        } else if (isOT2) {
          if (hasHelpEvent) {
            track.manOT2HelpOut.add(empId);
          } else {
            track.manOT2.add(empId);
          }
        }
      }
    }

    if (isHelpingThisLine) {
      bucket.helpInHrs += helpHour;

      if (rec.OT && Number(rec.OT) > 0) {
        const otTypeStr = String(rec.OT_Type || "");
        const isOT1 = otTypeStr.includes("1");
        let isOT2 = otTypeStr.includes("2") || otTypeStr.toLowerCase().includes("holiday");
        const recordDateKey = parts.dateKey;
        const isWorkingCalendarDay = !workingDateKeys || workingDateKeys.has(recordDateKey);
        const isHolidayDate = !isWorkingCalendarDay || isOT2;
        if (isHolidayDate && isOT2) {
          if (!isHolidayOtEligible(rec)) {
            isOT2 = false;
          }
        }

        if (isOT1) track.manOT1HelpIn.add(empId);
        else if (isOT2) track.manOT2HelpIn.add(empId);
      }
    }
  });

  applyDayTrackers(dayMap, trackers, workingDateKeys, dominantMonthKey);

  return dayMap;
}

export function aggregateRecordsForGroup(
  records,
  groupLines,
  dominantMonthKey,
  matchAllRecords = false,
  workingDateKeys = null,
) {
  const dayMap = {};
  const trackers = {};
  DAYS_ARRAY.forEach((day) => {
    dayMap[day] = { ...EMPTY_DAY_INPUT };
    trackers[day] = createDayTrackers();
  });

  let fallbackCounter = 0;

  records.forEach((rec) => {
    if (isOtherFactoryRecord(rec)) return;
    if (!rec.dlh_effective_date_time) return;

    const parts = parseRecordDateParts(rec.dlh_effective_date_time);
    if (!parts) return;

    const monthKey = parts.monthKey;
    if (dominantMonthKey && monthKey !== dominantMonthKey) return;

    const day = parts.day;
    const bucket = dayMap[day];
    const track = trackers[day];
    if (!bucket || !track) return;

    const rawEmpId = rec.dlh_employee_id !== undefined && rec.dlh_employee_id !== null ? String(rec.dlh_employee_id).trim() : '';
    if (!rawEmpId) return;
    const empId = rawEmpId;

    const hasHelpEvent = !!rec.line_in;
    const helpHour = Number(rec.help_hour) || 0;

    const isOwnLine = matchAllRecords
      ? true
      : groupLines.some((ln) => isRecordMatchingLine(rec, ln));

    const isHelpingThisGroup = doesLineValueMatchGroup(rec.line_in, groupLines);

    if (isOwnLine || isHelpingThisGroup) bucket.sourceRecordCount += 1;

    if (isOwnLine) {
      const workDayStatus = String(rec.work_day_status || "").trim().toUpperCase();
      if (workDayStatus === "H" || workDayStatus === "HOLIDAY") {
        track.holidayCount++;
      } else {
        track.workCount++;
      }
      track.opRegister.add(empId);

      if (shouldCountAsPresent(rec)) {
        track.swipeCards.add(empId);
      }
      const recordDateKey = parts.dateKey;
      const isWorkingCalendarDay =
        !workingDateKeys || workingDateKeys.has(recordDateKey);
      if (shouldCountAsAbsent(rec, isWorkingCalendarDay)) {
        track.notWorking.add(empId);
      }
      if (hasHelpEvent) {
        bucket.helpOutHrs += helpHour;
      }
      if (rec.OT && Number(rec.OT) > 0) {
        const otTypeStr = String(rec.OT_Type || "");
        const isOT1 = otTypeStr.includes("1");
        let isOT2 = otTypeStr.includes("2") || otTypeStr.toLowerCase().includes("holiday");

        // กฎ MANPOWER DASHBOARD: OT Holiday คือต้องทำงานมากกว่า 4 ชม. (> 4 ชม.) ถ้าทำไม่ถึง (<= 4 ชม.) ไม่นับ
        // แต่ถ้าสแกนไม่ครบ (เช่น ออก 20:04 หรือเข้าอย่างเดียว) ให้ถือว่ามาทำงานและนับ
        const isHolidayDate = !isWorkingCalendarDay || workDayStatus === "H" || workDayStatus === "HOLIDAY" || isOT2;
        if (isHolidayDate && isOT2) {
          if (!isHolidayOtEligible(rec)) {
            isOT2 = false;
          }
        }

        if (isOT1) {
          track.ot1Psn.add(empId);
          if (hasHelpEvent) {
            track.manOT1HelpOut.add(empId);
          } else {
            track.manOT1.add(empId);
          }
        } else if (isOT2) {
          if (hasHelpEvent) {
            track.manOT2HelpOut.add(empId);
          } else {
            track.manOT2.add(empId);
          }
        }
      }
    }

    if (isHelpingThisGroup) {
      bucket.helpInHrs += helpHour;

      if (rec.OT && Number(rec.OT) > 0) {
        const otTypeStr = String(rec.OT_Type || "");
        const isOT1 = otTypeStr.includes("1");
        let isOT2 = otTypeStr.includes("2") || otTypeStr.toLowerCase().includes("holiday");
        const recordDateKey = parts.dateKey;
        const isWorkingCalendarDay = !workingDateKeys || workingDateKeys.has(recordDateKey);
        const isHolidayDate = !isWorkingCalendarDay || isOT2;
        if (isHolidayDate && isOT2) {
          if (!isHolidayOtEligible(rec)) {
            isOT2 = false;
          }
        }

        if (isOT1) track.manOT1HelpIn.add(empId);
        else if (isOT2) track.manOT2HelpIn.add(empId);
      }
    }
  });

  applyDayTrackers(dayMap, trackers, workingDateKeys, dominantMonthKey);

  return dayMap;
}

export function buildFullSpreadsheetData(records: any[], mappings?: Record<string, any>, calendarWorkingDateKeys?: Set<string>) {
  const customMappings = mappings || getRuntimeMappings();
  const dominantMonthKey = findDominantMonthKey(records);
  const vdsCostCenterPrefixes: Record<string, string[]> = {
    "Direct FPC_VDS (P461,P462,P463,P464,P465,P466,P468)": [
      "P461",
      "P462",
      "P463",
      "P464",
      "P465",
      "P466",
      "P468",
    ],
    "Indirect FPC_VDS (P460) DCC,TECH,EXC,MAT": ["P460"],
    ...Object.fromEntries(
      Object.entries(ADMIN_VDS_FORMULA_REGISTRY).map(([formula, rule]) => [
        formula,
        rule.costCenterPrefixes || [],
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(customMappings || {})
        .filter(([line, cfg]: [string, any]) => line.includes("VDS") && Array.isArray(cfg?.costCenterPrefixes))
        .map(([line, cfg]: [string, any]) => [line, cfg.costCenterPrefixes]),
    ),
  };
  const vdsGroupsMatchedByCostCenterOnly = new Set<string>([]);
  const workingDateKeys = calendarWorkingDateKeys && calendarWorkingDateKeys.size > 0
    ? calendarWorkingDateKeys
    : new Set(
        records
          .filter(
            (record) => {
              const s = String(record.work_day_status || "").trim().toUpperCase();
              return s === "W" || s === "WORKING DAY" || s === "NORMAL";
            },
          )
          .map((record) =>
            extractDatePart(record.dlh_effective_date_time),
          )
          .filter(Boolean),
      );

  // Pre-process all records ONCE (O(N)) to eliminate repeated date parsing, regexes, and status checks
  const prepared: Array<{
    monthKey: string;
    day: number;
    empId: string;
    wds: string;
    candidateKeys: string[];
    helpDestKeys: string[];
    isPresent: boolean;
    isAbsent: boolean;
    otNum: number;
    isOT1: boolean;
    isOT2: boolean;
    hasHelpEvent: boolean;
    helpHour: number;
    vdsStatus: boolean;
    deptUpper: string;
  }> = [];

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (!rec) continue;
    const wds = String(rec.work_day_status || "").trim().toUpperCase();
    if (wds.startsWith("1N")) continue; // ตัดเฉพาะพนักงานจากโรงงานอื่นออก
    if (!rec.dlh_effective_date_time) continue;
    const parts = parseRecordDateParts(rec.dlh_effective_date_time);
    if (!parts) continue;

    const rawEmpId = rec.dlh_employee_id !== undefined && rec.dlh_employee_id !== null ? String(rec.dlh_employee_id).trim() : "";
    if (!rawEmpId) continue;

    const isLoanOut = Boolean(rec.loan_destination || rec.is_loan_exclude);
    const lineCheckAliased = applyLineAlias(rec.line_check);
    const lineCheckFullClean = cleanLineKey(lineCheckAliased);
    const candidateKeys: string[] = [];
    if (lineCheckFullClean) {
      candidateKeys.push(lineCheckFullClean);
    } else {
      const lineOutAliased = applyLineAlias(rec.line_out);
      const lineOutFullClean = cleanLineKey(lineOutAliased);
      if (lineOutFullClean) candidateKeys.push(lineOutFullClean);

      const lineClean = cleanLineKey(applyLineAlias(rec.line));
      const shiftClean = cleanLineKey(extractShiftCode(rec.department));
      if (lineClean) {
        candidateKeys.push(lineClean);
        if (shiftClean) candidateKeys.push(lineClean + shiftClean);
      }
      const deptClean = cleanLineKey(extractLineSegment(rec.department));
      if (deptClean) {
        candidateKeys.push(deptClean);
        if (shiftClean) candidateKeys.push(deptClean + shiftClean);
      }
    }

    const helpDestKeys = rec.line_in ? getLineCompareKeys(rec.line_in) : [];
    const isWorkingCalendarDay = !workingDateKeys || workingDateKeys.has(parts.dateKey);
    // คนที่ถูก loan ออก ไม่นับเป็น present และ OT แต่ให้นับเป็น absent (ไม่มาทำงานของฝ่ายตัวเอง ตามมาตรฐานรายงาน Macro PCN)
    const isPresent = !isLoanOut && shouldCountAsPresent(rec);
    const isAbsent = isWorkingCalendarDay && (isLoanOut ? shouldCountAsAbsent(rec, isWorkingCalendarDay) : (!rec.line_in && !(Number(rec.help_hour) > 0) && shouldCountAsAbsent(rec, isWorkingCalendarDay)));
    const otNum = (!isLoanOut && rec.OT) ? Number(rec.OT) : 0;
    const otTypeStr = otNum > 0 ? String(rec.OT_Type || "") : "";
    const isOT1 = otTypeStr.includes("1");
    let isOT2 = otTypeStr.includes("2") || otTypeStr.toLowerCase().includes("holiday");

    // กฎ MANPOWER DASHBOARD: OT Holiday คือต้องทำงานมากกว่า 4 ชม. (> 4 ชม.) ถ้าทำไม่ถึง (<= 4 ชม.) ไม่นับ
    // แต่ถ้าสแกนไม่ครบ (เช่น ออก 20:04 หรือเข้าอย่างเดียว) ให้ถือว่ามาทำงานและนับ
    const isHolidayDate = !isWorkingCalendarDay || wds === "H" || wds === "HOLIDAY" || isOT2;
    if (isHolidayDate && isOT2) {
      if (!isHolidayOtEligible(rec)) {
        isOT2 = false;
      }
    }
    const hasHelpEvent = Boolean(rec.line_in);
    const helpHour = Number(rec.help_hour) || 0;
    const effectiveStatus = getEffectiveRecordStatus(rec).toUpperCase();
    const rawStatus = String(rec.status || "").trim().toUpperCase();
    const vdsStatus = effectiveStatus === "VDS" || rawStatus === "VDS" || rawStatus === "PIMB";
    const deptUpper = String(rec.cost_center_name || rec.department || "").trim().toUpperCase();

    prepared.push({
      monthKey: parts.monthKey,
      day: parts.day,
      empId: rawEmpId,
      wds,
      candidateKeys,
      helpDestKeys,
      isPresent,
      isAbsent,
      otNum,
      isOT1,
      isOT2,
      hasHelpEvent,
      helpHour,
      vdsStatus,
      deptUpper,
    });
  }

  const runAggregation = (monthKeyToUse: string | null) => {
    const fullMap: Record<string, Record<number, any>> = {};
    let totalMatched = 0;

    const filteredPrepared = monthKeyToUse
      ? prepared.filter((p) => p.monthKey === monthKeyToUse)
      : prepared;

    const tabEntries: Array<{ tab: string; line: string }> = [];
    Object.keys(TAB_LINES).forEach((tab) => {
      const lines = getRuntimeTabLines(tab, customMappings);
      lines.forEach((line) => {
        tabEntries.push({ tab, line });
      });
    });

    const uniqueLines = [...new Set(tabEntries.map((e) => e.line))];

    uniqueLines.forEach((line) => {
      const group = getRuntimeLineGroup(line, customMappings);
      const isVdsGroup = line.includes("VDS");
      const costCenterPrefixes = vdsCostCenterPrefixes[line] || [];
      const matchAllRecords = vdsGroupsMatchedByCostCenterOnly.has(line) || line === "Macro PCN";
      const groupCleanSet = new Set(group.map((ln) => cleanLineKey(applyLineAlias(ln))).filter(Boolean));

      const dayMap: Record<number, any> = {};
      const trackers: Record<number, any> = {};
      for (let d = 1; d <= 31; d++) {
        dayMap[d] = { ...EMPTY_DAY_INPUT };
        trackers[d] = createDayTrackers();
      }

      for (let i = 0; i < filteredPrepared.length; i++) {
        const p = filteredPrepared[i];
        const hasExplicitSourceLines = groupCleanSet.size > 0 && !matchAllRecords;
        if (isVdsGroup) {
          if (costCenterPrefixes.length > 0 && !costCenterPrefixes.some((prefix) => p.deptUpper.startsWith(prefix))) {
            continue;
          }
          if (!p.vdsStatus) {
            continue;
          }
        }

        let isOwnLine = matchAllRecords;
        if (!isOwnLine) {
          for (let j = 0; j < p.candidateKeys.length; j++) {
            if (groupCleanSet.has(p.candidateKeys[j])) {
              isOwnLine = true;
              break;
            }
          }
        }

        let isHelpingThisGroup = false;
        if (p.helpDestKeys.length > 0) {
          for (let j = 0; j < p.helpDestKeys.length; j++) {
            if (groupCleanSet.has(p.helpDestKeys[j])) {
              isHelpingThisGroup = true;
              break;
            }
          }
        }

        if (!isOwnLine && !isHelpingThisGroup) continue;

        const bucket = dayMap[p.day];
        const track = trackers[p.day];
        bucket.sourceRecordCount += 1;

        if (isOwnLine) {
          if (p.wds === "H" || p.wds === "HOLIDAY") {
            track.holidayCount++;
          } else {
            track.workCount++;
          }
          track.opRegister.add(p.empId);
          if (p.isPresent) track.swipeCards.add(p.empId);
          if (p.isAbsent) track.notWorking.add(p.empId);
          if (p.hasHelpEvent) bucket.helpOutHrs += p.helpHour;
          if (p.otNum > 0) {
            if (p.isOT1) {
              track.ot1Psn.add(p.empId);
              if (p.hasHelpEvent) track.manOT1HelpOut.add(p.empId);
              else track.manOT1.add(p.empId);
            } else if (p.isOT2) {
              if (p.hasHelpEvent) track.manOT2HelpOut.add(p.empId);
              else track.manOT2.add(p.empId);
            }
          }
        }

        if (isHelpingThisGroup) {
          bucket.helpInHrs += p.helpHour;
          if (p.otNum > 0) {
            if (p.isOT1) track.manOT1HelpIn.add(p.empId);
            else if (p.isOT2) track.manOT2HelpIn.add(p.empId);
          }
        }
      }

      applyDayTrackers(dayMap, trackers, workingDateKeys, monthKeyToUse);
      fullMap[line] = dayMap;
      for (let d = 1; d <= 31; d++) {
        totalMatched += dayMap[d].opRegister;
      }
    });

    return { fullMap, totalMatched };
  };

  let { fullMap, totalMatched } = runAggregation(dominantMonthKey);

  if (totalMatched === 0 && records.length > 0) {
    console.warn(
      "⚠️ ไม่พบข้อมูลที่ตรงกับเดือนหลัก (" +
      dominantMonthKey +
      ") ลองคำนวณใหม่โดยไม่กรองเดือน",
    );
    ({ fullMap, totalMatched } = runAggregation(null));
  }

  const sampleLineChecks = [
    ...new Set(
      records
        .slice(0, 300)
        .map((r) => r.line_check)
        .filter(Boolean),
    ),
  ];
  const configuredLines = [
    ...new Set(
      Object.values(TAB_LINES).flatMap((lines) =>
        lines.flatMap(
          (line) => getRuntimeLineGroup(line),
        ),
      ),
    ),
  ];
  const unmatchedLineChecks = [
    ...new Set(
      records
        .map((record) => record.line_check)
        .filter(Boolean)
        .filter(
          (lineCheck) =>
            !configuredLines.some(
              (line) =>
                cleanLineKey(applyLineAlias(lineCheck)) ===
                cleanLineKey(applyLineAlias(line)),
            ),
        ),
    ),
  ];
  if (unmatchedLineChecks.length > 0) {
    console.warn(
      `⚠️ [Manhour] พบ line_check ที่ไม่มีในสูตร ${unmatchedLineChecks.length} ค่า:`,
      unmatchedLineChecks,
    );
  }
  if (totalMatched === 0 && records.length > 0) {
    console.warn(
      "⚠️ [Manhour] จับคู่ Line ไม่ได้เลยแม้แต่รายการเดียว ตรวจสอบว่าค่า line_check ใน API ตรงกับชื่อใน TAB_LINES/LINE_GROUPS หรือไม่",
    );
  }

  return enrichSpreadsheetWithCustomLines(fullMap, customMappings);
}
