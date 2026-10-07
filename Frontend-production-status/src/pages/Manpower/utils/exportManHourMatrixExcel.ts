import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export interface SingleLineExportData {
  lineName: string;
  rowSums: Record<string, number | string>;
  calculatedRows: Record<number, Record<string, number | string>>;
  displayInputValue: (day: number, field: string) => number | string;
  displayCalculatedValue: (day: number, value: number | string) => number | string;
}

export interface ExportManHourMatrixParams {
  selectedLine: string;
  selectedMonth: string;
  displayDays: number[];
  manhourCalendar: Record<number, { date?: string; manhour?: number }>;
  rowSums: Record<string, number | string>;
  calculatedRows: Record<number, Record<string, number | string>>;
  displayInputValue: (day: number, field: string) => number | string;
  displayCalculatedValue: (day: number, value: number | string) => number | string;
}

export interface ExportAllManHourMatrixParams {
  selectedMonth: string;
  fileNamePrefix?: string;
  displayDays: number[];
  manhourCalendar: Record<number, { date?: string; manhour?: number }>;
  linesData: SingleLineExportData[];
}

/**
 * สร้างและจัดแต่งแผ่นงาน (Worksheet) ของ Line แต่ละไลน์ลงใน Workbook
 */
export function addManHourWorksheet(
  workbook: ExcelJS.Workbook,
  {
    lineName,
    selectedMonth,
    displayDays,
    manhourCalendar,
    rowSums,
    calculatedRows,
    displayInputValue,
    displayCalculatedValue,
  }: {
    lineName: string;
    selectedMonth: string;
    displayDays: number[];
    manhourCalendar: Record<number, { date?: string; manhour?: number }>;
    rowSums: Record<string, number | string>;
    calculatedRows: Record<number, Record<string, number | string>>;
    displayInputValue: (day: number, field: string) => number | string;
    displayCalculatedValue: (day: number, value: number | string) => number | string;
  }
) {
  const [year, month] = selectedMonth.split('-').map(Number);
  // ตั้งชื่อ Sheet ให้ปลอดภัย ไม่เกิน 31 ตัวอักษร และไม่ซ้ำ
  let baseSheetName = (lineName || 'ManHour').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 31);
  if (!baseSheetName) baseSheetName = 'ManHour';
  
  let safeSheetName = baseSheetName;
  let counter = 1;
  while (workbook.getWorksheet(safeSheetName)) {
    const suffix = `_${counter}`;
    safeSheetName = `${baseSheetName.slice(0, 31 - suffix.length)}${suffix}`;
    counter++;
  }

  const worksheet = workbook.addWorksheet(safeSheetName, {
    views: [{ showGridLines: true }],
  });

  // ==========================================
  // กำหนดสไตล์และสีตารางตรงกับหน้าเว็บ ManHourTable
  // ==========================================
  // ขอบตาราง: Slate-200 / Slate-300
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },    // Slate-200
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };

  const baseFont: Partial<ExcelJS.Font> = {
    name: 'Segoe UI',
    size: 9.5,
    bold: true,
  };

  // ==========================================
  // 1. แถวที่ 1: Weekday Header (📅 Day, Tue, Wed, Thu...)
  // ==========================================
  const row1Values: (string | number)[] = ['📅 Day', '', '', ''];
  const weekendInfo: Record<number, { isSun: boolean; isSat: boolean; weekday: string }> = {};

  displayDays.forEach((day) => {
    const item = manhourCalendar[day];
    const fallbackDate = new Date(Date.UTC(year, month - 1, day, 5));
    const isValidDay = fallbackDate.getUTCMonth() === month - 1;
    const itemDate = String(item?.date || '').slice(0, 10);
    const expectedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const parsedItemDate = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(itemDate)
      ? new Date(`${itemDate}T12:00:00+07:00`)
      : null;
    const hasValidItemDate =
      itemDate === expectedDate && parsedItemDate !== null && !Number.isNaN(parsedItemDate.getTime());
    const weekday = hasValidItemDate
      ? new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Bangkok' }).format(parsedItemDate)
      : isValidDay
        ? new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(fallbackDate)
        : '';
    const isSun = weekday === 'Sun';
    const isSat = weekday === 'Sat';
    weekendInfo[day] = { isSun, isSat, weekday };
    row1Values.push(weekday);
  });
  const row1 = worksheet.addRow(row1Values);

  // ==========================================
  // 2. แถวที่ 2: Calendar Hours (1, 0, 1, 1...)
  // ==========================================
  const row2Values: (string | number)[] = ['', '', '', ''];
  displayDays.forEach((day) => {
    const date = new Date(Date.UTC(year, month - 1, day));
    const isValidDay = date.getUTCMonth() === month - 1;
    const expectedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const calendarItem = manhourCalendar[day];
    const itemMatchesCurrentDate = String(calendarItem?.date || '').slice(0, 10) === expectedDate;
    const value = itemMatchesCurrentDate ? (calendarItem?.manhour ?? 1) : (isValidDay ? 1 : '');
    row2Values.push(value);
  });
  const row2 = worksheet.addRow(row2Values);

  // ==========================================
  // 3. แถวที่ 3: Header หลัก (Line Name colSpan=3, Sum, 1, 2, 3...)
  // ==========================================
  const row3Values: (string | number)[] = [lineName, '', '', 'Sum', ...displayDays];
  const row3 = worksheet.addRow(row3Values);

  // ==========================================
  // 4. แถวข้อมูลทั้งหมด 23 แถว
  // ==========================================
  const formatCell = (val: any) => {
    if (val === '' || val === null || val === undefined || val === '-') return '-';
    if (typeof val === 'number') return val;
    const num = Number(val);
    return !isNaN(num) && val !== '' ? num : val;
  };

  const rowsDefinition: Array<{
    category: string;
    label: string;
    factor: string;
    hasFactor: boolean;
    sumKey: string;
    textColor: string;
    rowBgColor?: string;
    sumBgColor: string;
    sumTextColor: string;
    factorBgColor?: string;
    factorTextColor?: string;
    isPercent?: boolean;
    getValue: (day: number) => any;
  }> = [
    // ---------------- Head count (แถว 4-9) ----------------
    {
      category: 'Head count',
      label: 'OP & Leader register',
      factor: '',
      hasFactor: false,
      sumKey: 'r1',
      textColor: 'FF1E293B', // slate-800
      sumBgColor: 'FFEFF6FF', // blue-50
      sumTextColor: 'FF172554', // blue-950
      getValue: (day: number) => displayInputValue(day, 'opRegister'),
    },
    {
      category: 'Head count',
      label: 'จากการรูดบัตร',
      factor: '',
      hasFactor: false,
      sumKey: 'r2',
      textColor: 'FF334155', // slate-700
      sumBgColor: 'FFEFF6FF', // blue-50
      sumTextColor: 'FF172554', // blue-950
      getValue: (day: number) => displayInputValue(day, 'swipeCards'),
    },
    {
      category: 'Head count',
      label: 'ไม่มาทำงาน',
      factor: '',
      hasFactor: false,
      sumKey: 'r3',
      textColor: 'FFE11D48', // rose-600
      sumBgColor: 'FFFFF1F2', // rose-50
      sumTextColor: 'FFBE123C', // rose-700
      getValue: (day: number) => displayInputValue(day, 'notWorking'),
    },
    {
      category: 'Head count',
      label: 'ไปช่วย line อื่น <Hr>',
      factor: 'หัก',
      hasFactor: true,
      sumKey: 'r4',
      textColor: 'FFBE123C', // rose-700
      factorBgColor: 'FFFFF1F2',
      factorTextColor: 'FFBE123C',
      sumBgColor: 'FFFFF1F2',
      sumTextColor: 'FFBE123C',
      getValue: (day: number) => displayInputValue(day, 'helpOutHrs'),
    },
    {
      category: 'Head count',
      label: 'line อื่นมาช่วยงาน <Hr>',
      factor: 'เพิ่ม',
      hasFactor: true,
      sumKey: 'r5',
      textColor: 'FF047857', // emerald-700
      factorBgColor: 'FFECFDF5',
      factorTextColor: 'FF047857',
      sumBgColor: 'FFECFDF5',
      sumTextColor: 'FF065F46',
      getValue: (day: number) => displayInputValue(day, 'helpInHrs'),
    },
    {
      category: 'Head count',
      label: 'OP ทำ OT 1(วันทำงาน)',
      factor: '',
      hasFactor: false,
      sumKey: 'r6',
      textColor: 'FF92400E', // amber-800
      sumBgColor: 'FFFFFBEB', // amber-50
      sumTextColor: 'FF78350F', // amber-900
      getValue: (day: number) => displayInputValue(day, 'ot1Psn'),
    },

    // ---------------- Manpower (แถว 10-26) ----------------
    {
      category: 'Manpower',
      label: 'OP ที่ทำงานทั้งหมด + LD',
      factor: '8',
      hasFactor: true,
      sumKey: 'r7',
      textColor: 'FF1E3A8A', // blue-900
      factorBgColor: 'FFEFF6FF',
      factorTextColor: 'FF1E40AF',
      sumBgColor: 'FFDBEAFE', // blue-100
      sumTextColor: 'FF172554',
      getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r7 ?? 0),
    },
    {
      category: 'Manpower',
      label: 'OT 1(วันทำงาน)',
      factor: '3',
      hasFactor: true,
      sumKey: 'r8',
      textColor: 'FF92400E', // amber-800
      factorBgColor: 'FFFFFBEB',
      factorTextColor: 'FF92400E',
      sumBgColor: 'FFFFFBEB',
      sumTextColor: 'FF78350F',
      getValue: (day: number) => displayInputValue(day, 'manOT1'),
    },
    {
      category: 'Manpower',
      label: 'OT 1 (HEAD)ไปช่วย line อื่น',
      factor: 'หัก',
      hasFactor: true,
      sumKey: 'r9',
      textColor: 'FFBE123C', // rose-700
      factorBgColor: 'FFFFF1F2',
      factorTextColor: 'FFBE123C',
      sumBgColor: 'FFFFF1F2',
      sumTextColor: 'FFBE123C',
      getValue: (day: number) => displayInputValue(day, 'manOT1HelpOut'),
    },
    {
      category: 'Manpower',
      label: 'OT 1 (HEAD)line อื่นมาช่วย',
      factor: 'เพิ่ม',
      hasFactor: true,
      sumKey: 'r10',
      textColor: 'FF047857', // emerald-700
      factorBgColor: 'FFECFDF5',
      factorTextColor: 'FF047857',
      sumBgColor: 'FFECFDF5',
      sumTextColor: 'FF065F46',
      getValue: (day: number) => displayInputValue(day, 'manOT1HelpIn'),
    },
    {
      category: 'Manpower',
      label: 'OT 2 (วันหยุด)',
      factor: '11',
      hasFactor: true,
      sumKey: 'r11',
      textColor: 'FF065F46', // emerald-800
      factorBgColor: 'FFECFDF5',
      factorTextColor: 'FF065F46',
      sumBgColor: 'FFECFDF5',
      sumTextColor: 'FF064E3B',
      getValue: (day: number) => displayInputValue(day, 'manOT2'),
    },
    {
      category: 'Manpower',
      label: 'OT 2 (HEAD)ไปช่วย line อื่น',
      factor: 'หัก',
      hasFactor: true,
      sumKey: 'r12',
      textColor: 'FFBE123C', // rose-700
      factorBgColor: 'FFFFF1F2',
      factorTextColor: 'FFBE123C',
      sumBgColor: 'FFFFF1F2',
      sumTextColor: 'FFBE123C',
      getValue: (day: number) => displayInputValue(day, 'manOT2HelpOut'),
    },
    {
      category: 'Manpower',
      label: 'OT 2 (HEAD)line อื่นมาช่วย',
      factor: 'เพิ่ม',
      hasFactor: true,
      sumKey: 'r13',
      textColor: 'FF047857', // emerald-700
      factorBgColor: 'FFECFDF5',
      factorTextColor: 'FF047857',
      sumBgColor: 'FFECFDF5',
      sumTextColor: 'FF065F46',
      getValue: (day: number) => displayInputValue(day, 'manOT2HelpIn'),
    },

    // แถวสรุปกลุ่ม Man Hour
    {
      category: 'Manpower',
      label: 'Normal Man Hour OP ที่ทำงานทั้งหมด + LD',
      factor: '',
      hasFactor: false,
      sumKey: 'r14',
      textColor: 'FF1E293B',
      rowBgColor: 'FFF1F5F9', // slate-100
      sumBgColor: 'FFE2E8F0', // slate-200
      sumTextColor: 'FF0F172A',
      getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r14 ?? 0),
    },
    {
      category: 'Manpower',
      label: 'OT Man Hour',
      factor: '',
      hasFactor: false,
      sumKey: 'r15',
      textColor: 'FF92400E',
      rowBgColor: 'FFFFFBEB', // amber-50
      sumBgColor: 'FFFEF3C7', // amber-100
      sumTextColor: 'FF78350F',
      getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r15 ?? 0),
    },
    {
      category: 'Manpower',
      label: 'Total Man Hour',
      factor: '',
      hasFactor: false,
      sumKey: 'r16',
      textColor: 'FF1E3A8A',
      rowBgColor: 'FFDBEAFE', // blue-100
      sumBgColor: 'FFBFDBFE', // blue-200
      sumTextColor: 'FF172554',
      getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r16 ?? 0),
    },

    // แถวสรุปกลุ่ม Register Man Hour
    {
      category: 'Manpower',
      label: 'Normal Man Hour OP & Leader Register',
      factor: '',
      hasFactor: false,
      sumKey: 'r17',
      textColor: 'FF0C4A6E', // sky-900
      rowBgColor: 'FFF0F9FF', // sky-50
      sumBgColor: 'FFE0F2FE', // sky-100
      sumTextColor: 'FF082F49',
      getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r17 ?? 0),
    },
    {
      category: 'Manpower',
      label: 'OT Man Hour',
      factor: '',
      hasFactor: false,
      sumKey: 'r18',
      textColor: 'FF0C4A6E',
      rowBgColor: 'FFF0F9FF',
      sumBgColor: 'FFE0F2FE',
      sumTextColor: 'FF082F49',
      getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r18 ?? 0),
    },
    {
      category: 'Manpower',
      label: 'Total Man Hour',
      factor: '',
      hasFactor: false,
      sumKey: 'r19',
      textColor: 'FF312E81', // indigo-900
      rowBgColor: 'FFE0E7FF', // indigo-100
      sumBgColor: 'FFC7D2FE', // indigo-200
      sumTextColor: 'FF1E1B4B',
      getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r19 ?? 0),
    },

    // แถวสถิติ
    {
      category: 'Manpower',
      label: 'Leave data',
      factor: '',
      hasFactor: false,
      sumKey: 'r20',
      textColor: 'FFBE123C', // rose-700
      sumBgColor: 'FFFFF1F2',
      sumTextColor: 'FFBE123C',
      getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r20 ?? 0),
    },
    {
      category: 'Manpower',
      label: 'Leave rate(%)',
      factor: '',
      hasFactor: false,
      sumKey: 'r21',
      textColor: 'FFE11D48',
      sumBgColor: 'FFFFE4E6', // rose-100
      sumTextColor: 'FF9F1239', // rose-800
      isPercent: true,
      getValue: (day: number) => {
        const val = calculatedRows[day]?.r21;
        const hasReg = Number(calculatedRows[day]?.r1) > 0;
        return hasReg && val !== '#DIV/0!' && Number(val) !== 0 ? `${val}%` : '-';
      },
    },
    {
      category: 'Manpower',
      label: 'OT working day rate(%)',
      factor: '',
      hasFactor: false,
      sumKey: 'r22',
      textColor: 'FF92400E',
      sumBgColor: 'FFFEF3C7', // amber-100
      sumTextColor: 'FF78350F',
      isPercent: true,
      getValue: (day: number) => {
        const val = calculatedRows[day]?.r22;
        const hasReg = Number(calculatedRows[day]?.r1) > 0;
        return hasReg && val !== '#DIV/0!' && Number(val) !== 0 ? `${val}%` : '-';
      },
    },
    {
      category: 'Manpower',
      label: 'OT Holiday day rate(%)',
      factor: '',
      hasFactor: false,
      sumKey: 'r23',
      textColor: 'FF065F46',
      sumBgColor: 'FFD1FAE5', // emerald-100
      sumTextColor: 'FF064E3B',
      isPercent: true,
      getValue: (day: number) => {
        const val = calculatedRows[day]?.r23;
        const hasReg = Number(calculatedRows[day]?.r1) > 0;
        return hasReg && val !== '#DIV/0!' && Number(val) !== 0 ? `${val}%` : '-';
      },
    },
  ];

  rowsDefinition.forEach((rowDef) => {
    const rowValues = displayDays.map((day) => formatCell(rowDef.getValue(day)));
    const sumVal = formatCell(rowSums[rowDef.sumKey]);
    worksheet.addRow([rowDef.category, rowDef.label, rowDef.factor, sumVal, ...rowValues]);
  });

  // ==========================================
  // 5. จัดความกว้างคอลัมน์ (ตรงตาม colgroup ของหน้าเว็บ)
  // ==========================================
  worksheet.getColumn(1).width = 13; // Category (90px)
  worksheet.getColumn(2).width = 28; // Description (180px)
  worksheet.getColumn(3).width = 8;  // Factor (52px)
  worksheet.getColumn(4).width = 11; // Sum (64px)
  displayDays.forEach((_, idx) => {
    worksheet.getColumn(idx + 5).width = 6.8; // Day 1..31 (38px)
  });

  // ==========================================
  // 6. ตกแต่ง Header (Rows 1-3)
  // ==========================================
  // Row 1: Weekday Header
  row1.height = 22;
  row1.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.border = thinBorder;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; // slate-50
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.font = { ...baseFont, bold: true, size: 9, color: { argb: 'FF475569' } }; // slate-600

    if (colNumber >= 5) {
      const day = displayDays[colNumber - 5];
      const wInfo = weekendInfo[day];
      if (wInfo?.isSun) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } }; // rose-50
        cell.font = { ...baseFont, bold: true, size: 9, color: { argb: 'FFE11D48' } }; // rose-600
      } else if (wInfo?.isSat) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }; // emerald-50
        cell.font = { ...baseFont, bold: true, size: 9, color: { argb: 'FF047857' } }; // emerald-700
      }
    }
  });

  // Row 2: Working/Holiday status (1, 0)
  row2.height = 20;
  row2.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.border = thinBorder;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // white
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.font = { ...baseFont, bold: true, size: 9 };

    if (colNumber >= 5) {
      const val = cell.value;
      if (val === 0 || val === '0') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
        cell.font = { ...baseFont, bold: true, size: 9, color: { argb: 'FFE11D48' } };
      } else {
        cell.font = { ...baseFont, bold: true, size: 9, color: { argb: 'FF2563EB' } }; // blue-600
      }
    }
  });

  // Row 3: Main Line & Day Numbers - Navy / Indigo Header
  row3.height = 25;
  row3.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1E3A8A' } },
      left: { style: 'thin', color: { argb: 'FF1E3A8A' } },
      bottom: { style: 'thin', color: { argb: 'FF1E3A8A' } },
      right: { style: 'thin', color: { argb: 'FF1E3A8A' } },
    };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Deep Navy / Blue-900
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.font = { ...baseFont, bold: true, size: 9.5, color: { argb: 'FFF1F5F9' } }; // slate-100

    if (colNumber === 1) {
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      cell.font = { ...baseFont, size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    } else if (colNumber === 4) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF172554' } }; // blue-950
      cell.font = { ...baseFont, size: 10, bold: true, color: { argb: 'FFFDE047' } }; // amber-300
    }
  });

  // ==========================================
  // 7. จัดรูปแบบแถวข้อมูล (Data Rows 4-26)
  // ==========================================
  for (let r = 4; r <= 26; r++) {
    const row = worksheet.getRow(r);
    const def = rowsDefinition[r - 4];
    row.height = 21;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = thinBorder;
      // Default cell fill
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: def?.rowBgColor || 'FFFFFFFF' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.font = {
        ...baseFont,
        bold: true,
        size: 9,
        color: { argb: def?.textColor || 'FF334155' },
      };

      // Col 2: Description
      if (colNumber === 2) {
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      }
      // Col 3: Factor
      else if (colNumber === 3) {
        if (def.hasFactor) {
          if (def.factorBgColor) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: def.factorBgColor } };
          }
          if (def.factorTextColor) {
            cell.font = { ...baseFont, bold: true, size: 8.5, color: { argb: def.factorTextColor } };
          }
        }
      }
      // Col 4: Sum
      else if (colNumber === 4) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: def.sumBgColor } };
        cell.font = { ...baseFont, bold: true, size: 9.5, color: { argb: def.sumTextColor } };
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0';
        }
      }
      // Col 5+: Day values
      else if (colNumber >= 5) {
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0';
        }
      }
    });

    // ถ้าแถวไหนไม่มี factor ให้ merge คอลัมน์ 2 และ 3 (Description + Factor) ให้ตรงกับหน้าเว็บ
    if (!def.hasFactor) {
      worksheet.mergeCells(`B${r}:C${r}`);
      const mergedDesc = worksheet.getCell(`B${r}`);
      mergedDesc.value = def.label;
      mergedDesc.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      mergedDesc.font = { ...baseFont, bold: true, size: 9, color: { argb: def.textColor } };
      if (def.rowBgColor) {
        mergedDesc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: def.rowBgColor } };
      }
    }
  }

  // ==========================================
  // 8. Merge Cells หมวดหมู่และส่วนหัว
  // ==========================================
  // เซลล์ซ้ายบน 📅 Day (A1:D2)
  worksheet.mergeCells('A1:D2');
  const dayCell = worksheet.getCell('A1');
  dayCell.value = '📅 Day';
  dayCell.alignment = { vertical: 'middle', horizontal: 'center' };
  dayCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF64748B' } }; // slate-500
  dayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // slate-100

  // เซลล์ชื่อไลน์แถวที่ 3 (A3:C3)
  worksheet.mergeCells('A3:C3');
  const lineCell = worksheet.getCell('A3');
  lineCell.value = lineName;
  lineCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  lineCell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
  lineCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // blue-900

  // ธีมพื้นหลัง Head count และ Manpower เป็นสีเดียวกัน (Sky-50 / Blue-50 โทนฟ้าอ่อน)
  const categoryHeaderFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF0F9FF' }, // sky-50 / blue-50
  };

  // หมวดหมู่ Head count (A4:A9)
  worksheet.mergeCells('A4:A9');
  const headCountCell = worksheet.getCell('A4');
  headCountCell.value = '👥 Head count';
  headCountCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headCountCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E3A8A' } }; // blue-900
  headCountCell.fill = categoryHeaderFill;

  // หมวดหมู่ Manpower (A10:A26) - ใช้สีเดียวกันเป๊ะกับ Head count
  worksheet.mergeCells('A10:A26');
  const manpowerCell = worksheet.getCell('A10');
  manpowerCell.value = '⚡ Manpower';
  manpowerCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  manpowerCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E3A8A' } }; // blue-900
  manpowerCell.fill = categoryHeaderFill;

  // ==========================================
  // 8.1 วนใส่ Border ให้ทุกเซลล์ครบถ้วน
  // ==========================================
  const totalCols = displayDays.length + 4;
  for (let r = 1; r <= 26; r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      if (!cell.border) {
        cell.border = thinBorder;
      }
    }
  }

  return worksheet;
}

/**
 * ส่งออกตารางไลน์เดียวเป็นไฟล์ Excel (.xlsx)
 */
export async function exportManHourMatrixExcel({
  selectedLine,
  selectedMonth,
  displayDays,
  manhourCalendar,
  rowSums,
  calculatedRows,
  displayInputValue,
  displayCalculatedValue,
}: ExportManHourMatrixParams) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Fujikura Manpower System';
  workbook.created = new Date();

  addManHourWorksheet(workbook, {
    lineName: selectedLine,
    selectedMonth,
    displayDays,
    manhourCalendar,
    rowSums,
    calculatedRows,
    displayInputValue,
    displayCalculatedValue,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const fileName = `ManHour_${selectedLine.replace(/[\\/:*?"<>|]/g, '_')}_${selectedMonth}.xlsx`;
  saveAs(blob, fileName);
}

/**
 * ส่งออกตารางทุกไลน์ / ทุกหน้า (Multi-sheet workbook) รวมอยู่ในไฟล์ Excel เดียวกัน
 */
export async function exportAllManHourMatrixExcel({
  selectedMonth,
  fileNamePrefix = 'ManHour_All_Lines',
  displayDays,
  manhourCalendar,
  linesData,
}: ExportAllManHourMatrixParams) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Fujikura Manpower System';
  workbook.created = new Date();

  linesData.forEach((line) => {
    addManHourWorksheet(workbook, {
      lineName: line.lineName,
      selectedMonth,
      displayDays,
      manhourCalendar,
      rowSums: line.rowSums,
      calculatedRows: line.calculatedRows,
      displayInputValue: line.displayInputValue,
      displayCalculatedValue: line.displayCalculatedValue,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const cleanPrefix = fileNamePrefix.replace(/[\\/:*?"<>|]/g, '_');
  const fileName = `${cleanPrefix}_${selectedMonth}.xlsx`;
  saveAs(blob, fileName);
}

/**
 * ฟังก์ชันสร้างและจัดแต่งแผ่นงาน (Worksheet) โดยรวมหลายๆ ไลน์มาต่อกันลงมาในแนวตั้ง (Single Sheet Stacked)
 * เว้นช่องว่างระหว่างตาราง 3 ช่อง (3 แถว)
 */
export function addStackedLinesWorksheet(
  workbook: ExcelJS.Workbook,
  {
    sheetName,
    selectedMonth,
    displayDays,
    manhourCalendar,
    linesData,
  }: {
    sheetName: string;
    selectedMonth: string;
    displayDays: number[];
    manhourCalendar: Record<number, { date?: string; manhour?: number }>;
    linesData: SingleLineExportData[];
  }
) {
  const [year, month] = selectedMonth.split('-').map(Number);
  let baseSheetName = (sheetName || 'ManHour').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 31);
  if (!baseSheetName) baseSheetName = 'ManHour';

  let safeSheetName = baseSheetName;
  let counter = 1;
  while (workbook.getWorksheet(safeSheetName)) {
    const suffix = `_${counter}`;
    safeSheetName = `${baseSheetName.slice(0, 31 - suffix.length)}${suffix}`;
    counter++;
  }

  const worksheet = workbook.addWorksheet(safeSheetName, {
    views: [{ showGridLines: true }],
  });

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };

  const baseFont: Partial<ExcelJS.Font> = {
    name: 'Segoe UI',
    size: 9.5,
    bold: true,
  };

  const formatCell = (val: any) => {
    if (val === '' || val === null || val === undefined || val === '-') return '-';
    if (typeof val === 'number') return val;
    const num = Number(val);
    return !isNaN(num) && val !== '' ? num : val;
  };

  // 1. กำหนดความกว้างคอลัมน์
  worksheet.getColumn(1).width = 14;
  worksheet.getColumn(2).width = 30;
  worksheet.getColumn(3).width = 8;
  worksheet.getColumn(4).width = 11;
  displayDays.forEach((_, idx) => {
    worksheet.getColumn(idx + 5).width = 6.8;
  });

  // 2. แถวบนสุด Calendar Day & Hours (Row 1-2)
  const row1Values: (string | number)[] = ['📅 Day', '', '', ''];
  const weekendInfo: Record<number, { isSun: boolean; isSat: boolean; weekday: string }> = {};

  displayDays.forEach((day) => {
    const item = manhourCalendar[day];
    const fallbackDate = new Date(Date.UTC(year, month - 1, day, 5));
    const isValidDay = fallbackDate.getUTCMonth() === month - 1;
    const itemDate = String(item?.date || '').slice(0, 10);
    const expectedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const parsedItemDate = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(itemDate)
      ? new Date(`${itemDate}T12:00:00+07:00`)
      : null;
    const hasValidItemDate =
      itemDate === expectedDate && parsedItemDate !== null && !Number.isNaN(parsedItemDate.getTime());
    const weekday = hasValidItemDate
      ? new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Bangkok' }).format(parsedItemDate)
      : isValidDay
        ? new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(fallbackDate)
        : '';
    const isSun = weekday === 'Sun';
    const isSat = weekday === 'Sat';
    weekendInfo[day] = { isSun, isSat, weekday };
    row1Values.push(weekday);
  });
  const row1 = worksheet.addRow(row1Values);
  row1.height = 22;
  row1.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.border = thinBorder;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.font = { ...baseFont, bold: true, size: 9, color: { argb: 'FF475569' } };

    if (colNumber >= 5) {
      const day = displayDays[colNumber - 5];
      const wInfo = weekendInfo[day];
      if (wInfo?.isSun) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
        cell.font = { ...baseFont, bold: true, size: 9, color: { argb: 'FFE11D48' } };
      } else if (wInfo?.isSat) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
        cell.font = { ...baseFont, bold: true, size: 9, color: { argb: 'FF047857' } };
      }
    }
  });

  const row2Values: (string | number)[] = ['', '', '', ''];
  displayDays.forEach((day) => {
    const date = new Date(Date.UTC(year, month - 1, day));
    const isValidDay = date.getUTCMonth() === month - 1;
    const expectedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const calendarItem = manhourCalendar[day];
    const itemMatchesCurrentDate = String(calendarItem?.date || '').slice(0, 10) === expectedDate;
    const value = itemMatchesCurrentDate ? (calendarItem?.manhour ?? 1) : (isValidDay ? 1 : '');
    row2Values.push(value);
  });
  const row2 = worksheet.addRow(row2Values);
  row2.height = 20;
  row2.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.border = thinBorder;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.font = { ...baseFont, bold: true, size: 9 };

    if (colNumber >= 5) {
      const val = cell.value;
      if (val === 0 || val === '0') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
        cell.font = { ...baseFont, bold: true, size: 9, color: { argb: 'FFE11D48' } };
      } else {
        cell.font = { ...baseFont, bold: true, size: 9, color: { argb: 'FF2563EB' } };
      }
    }
  });

  worksheet.mergeCells('A1:D2');
  const dayCell = worksheet.getCell('A1');
  dayCell.value = '📅 Day';
  dayCell.alignment = { vertical: 'middle', horizontal: 'center' };
  dayCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF64748B' } };
  dayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

  // 3. วนลูปแสดงข้อมูลทีละ Line ต่อกันลงมาเรื่อยๆ ใน Worksheet
  const categoryHeaderFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF0F9FF' },
  };

  linesData.forEach((line) => {
    const { lineName, rowSums, calculatedRows, displayInputValue, displayCalculatedValue } = line;

    const lineHeaderRowValues: (string | number)[] = [lineName, '', '', 'Sum', ...displayDays];
    const headerRow = worksheet.addRow(lineHeaderRowValues);
    const headerRowNum = headerRow.number;
    headerRow.height = 25;

    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF1E3A8A' } },
        left: { style: 'thin', color: { argb: 'FF1E3A8A' } },
        bottom: { style: 'thin', color: { argb: 'FF1E3A8A' } },
        right: { style: 'thin', color: { argb: 'FF1E3A8A' } },
      };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.font = { ...baseFont, bold: true, size: 9.5, color: { argb: 'FFF1F5F9' } };

      if (colNumber === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        cell.font = { ...baseFont, size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber === 4) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF172554' } };
        cell.font = { ...baseFont, size: 10, bold: true, color: { argb: 'FFFDE047' } };
      }
    });

    worksheet.mergeCells(`A${headerRowNum}:C${headerRowNum}`);
    const lineCellMerge = worksheet.getCell(`A${headerRowNum}`);
    lineCellMerge.value = lineName;
    lineCellMerge.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    lineCellMerge.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    lineCellMerge.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };

    const rowsDef = [
      // Head count (6 rows)
      { category: 'Head count', label: 'OP & Leader register', factor: '', hasFactor: false, sumKey: 'r1', textColor: 'FF1E293B', sumBgColor: 'FFEFF6FF', sumTextColor: 'FF172554', getValue: (day: number) => displayInputValue(day, 'opRegister') },
      { category: 'Head count', label: 'จากการรูดบัตร', factor: '', hasFactor: false, sumKey: 'r2', textColor: 'FF334155', sumBgColor: 'FFEFF6FF', sumTextColor: 'FF172554', getValue: (day: number) => displayInputValue(day, 'swipeCards') },
      { category: 'Head count', label: 'ไม่มาทำงาน', factor: '', hasFactor: false, sumKey: 'r3', textColor: 'FFE11D48', sumBgColor: 'FFFFF1F2', sumTextColor: 'FFBE123C', getValue: (day: number) => displayInputValue(day, 'notWorking') },
      { category: 'Head count', label: 'ไปช่วย line อื่น <Hr>', factor: 'หัก', hasFactor: true, sumKey: 'r4', textColor: 'FFBE123C', factorBgColor: 'FFFFF1F2', factorTextColor: 'FFBE123C', sumBgColor: 'FFFFF1F2', sumTextColor: 'FFBE123C', getValue: (day: number) => displayInputValue(day, 'helpOutHrs') },
      { category: 'Head count', label: 'line อื่นมาช่วยงาน <Hr>', factor: 'เพิ่ม', hasFactor: true, sumKey: 'r5', textColor: 'FF047857', factorBgColor: 'FFECFDF5', factorTextColor: 'FF047857', sumBgColor: 'FFECFDF5', sumTextColor: 'FF065F46', getValue: (day: number) => displayInputValue(day, 'helpInHrs') },
      { category: 'Head count', label: 'OP ทำ OT 1(วันทำงาน)', factor: '', hasFactor: false, sumKey: 'r6', textColor: 'FF92400E', sumBgColor: 'FFFFFBEB', sumTextColor: 'FF78350F', getValue: (day: number) => displayInputValue(day, 'ot1Psn') },

      // Manpower (17 rows)
      { category: 'Manpower', label: 'OP ที่ทำงานทั้งหมด + LD', factor: '8', hasFactor: true, sumKey: 'r7', textColor: 'FF1E3A8A', factorBgColor: 'FFEFF6FF', factorTextColor: 'FF1E40AF', sumBgColor: 'FFDBEAFE', sumTextColor: 'FF172554', getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r7 ?? 0) },
      { category: 'Manpower', label: 'OT 1(วันทำงาน)', factor: '3', hasFactor: true, sumKey: 'r8', textColor: 'FF1E3A8A', factorBgColor: 'FFEFF6FF', factorTextColor: 'FF1E40AF', sumBgColor: 'FFDBEAFE', sumTextColor: 'FF172554', getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r8 ?? 0) },
      { category: 'Manpower', label: 'OT 1 (HEAD)ไปช่วย line อื่น', factor: 'หัก', hasFactor: true, sumKey: 'r9', textColor: 'FFBE123C', factorBgColor: 'FFFFF1F2', factorTextColor: 'FFBE123C', sumBgColor: 'FFFFF1F2', sumTextColor: 'FFBE123C', getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r9 ?? 0) },
      { category: 'Manpower', label: 'OT 1 (HEAD)line อื่นมาช่วย', factor: 'เพิ่ม', hasFactor: true, sumKey: 'r10', textColor: 'FF047857', factorBgColor: 'FFECFDF5', factorTextColor: 'FF047857', sumBgColor: 'FFECFDF5', sumTextColor: 'FF065F46', getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r10 ?? 0) },
      { category: 'Manpower', label: 'OT 2 (วันหยุด)', factor: '11', hasFactor: true, sumKey: 'r11', textColor: 'FF1E3A8A', factorBgColor: 'FFEFF6FF', factorTextColor: 'FF1E40AF', sumBgColor: 'FFDBEAFE', sumTextColor: 'FF172554', getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r11 ?? 0) },
      { category: 'Manpower', label: 'OT 2 (HEAD)ไปช่วย line อื่น', factor: 'หัก', hasFactor: true, sumKey: 'r12', textColor: 'FFBE123C', factorBgColor: 'FFFFF1F2', factorTextColor: 'FFBE123C', sumBgColor: 'FFFFF1F2', sumTextColor: 'FFBE123C', getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r12 ?? 0) },
      { category: 'Manpower', label: 'OT 2 (HEAD)line อื่นมาช่วย', factor: 'เพิ่ม', hasFactor: true, sumKey: 'r13', textColor: 'FF047857', factorBgColor: 'FFECFDF5', factorTextColor: 'FF047857', sumBgColor: 'FFECFDF5', sumTextColor: 'FF065F46', getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r13 ?? 0) },
      { category: 'Manpower', label: 'Normal Man Hour (OP+LD)', factor: '', hasFactor: false, sumKey: 'r14', textColor: 'FF1E3A8A', rowBgColor: 'FFEFF6FF', sumBgColor: 'FFDBEAFE', sumTextColor: 'FF172554', getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r14 ?? 0) },
      { category: 'Manpower', label: 'OT Man Hour', factor: '', hasFactor: false, sumKey: 'r15', textColor: 'FF92400E', rowBgColor: 'FFFFFBEB', sumBgColor: 'FFFEF3C7', sumTextColor: 'FF78350F', getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r15 ?? 0) },
      { category: 'Manpower', label: 'Total Man Hour', factor: '', hasFactor: false, sumKey: 'r16', textColor: 'FF1E3A8A', rowBgColor: 'FFDBEAFE', sumBgColor: 'FFBFDBFE', sumTextColor: 'FF172554', getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r16 ?? 0) },
      { category: 'Manpower', label: 'Normal Man Hour OP & Leader Register', factor: '', hasFactor: false, sumKey: 'r17', textColor: 'FF0C4A6E', rowBgColor: 'FFF0F9FF', sumBgColor: 'FFE0F2FE', sumTextColor: 'FF082F49', getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r17 ?? 0) },
      { category: 'Manpower', label: 'OT Man Hour', factor: '', hasFactor: false, sumKey: 'r18', textColor: 'FF0C4A6E', rowBgColor: 'FFF0F9FF', sumBgColor: 'FFE0F2FE', sumTextColor: 'FF082F49', getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r18 ?? 0) },
      { category: 'Manpower', label: 'Total Man Hour', factor: '', hasFactor: false, sumKey: 'r19', textColor: 'FF312E81', rowBgColor: 'FFE0E7FF', sumBgColor: 'FFC7D2FE', sumTextColor: 'FF1E1B4B', getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r19 ?? 0) },
      { category: 'Manpower', label: 'Leave data', factor: '', hasFactor: false, sumKey: 'r20', textColor: 'FFBE123C', sumBgColor: 'FFFFF1F2', sumTextColor: 'FFBE123C', getValue: (day: number) => displayCalculatedValue(day, calculatedRows[day]?.r20 ?? 0) },
      {
        category: 'Manpower',
        label: 'Leave rate(%)',
        factor: '',
        hasFactor: false,
        sumKey: 'r21',
        textColor: 'FFE11D48',
        sumBgColor: 'FFFFE4E6',
        sumTextColor: 'FF9F1239',
        isPercent: true,
        getValue: (day: number) => {
          const val = calculatedRows[day]?.r21;
          const hasReg = Number(calculatedRows[day]?.r1) > 0;
          return hasReg && val !== '#DIV/0!' && Number(val) !== 0 ? `${val}%` : '-';
        },
      },
      {
        category: 'Manpower',
        label: 'OT working day rate(%)',
        factor: '',
        hasFactor: false,
        sumKey: 'r22',
        textColor: 'FF92400E',
        sumBgColor: 'FFFEF3C7',
        sumTextColor: 'FF78350F',
        isPercent: true,
        getValue: (day: number) => {
          const val = calculatedRows[day]?.r22;
          const hasReg = Number(calculatedRows[day]?.r1) > 0;
          return hasReg && val !== '#DIV/0!' && Number(val) !== 0 ? `${val}%` : '-';
        },
      },
      {
        category: 'Manpower',
        label: 'OT Holiday day rate(%)',
        factor: '',
        hasFactor: false,
        sumKey: 'r23',
        textColor: 'FF065F46',
        sumBgColor: 'FFD1FAE5',
        sumTextColor: 'FF064E3B',
        isPercent: true,
        getValue: (day: number) => {
          const val = calculatedRows[day]?.r23;
          const hasReg = Number(calculatedRows[day]?.r1) > 0;
          return hasReg && val !== '#DIV/0!' && Number(val) !== 0 ? `${val}%` : '-';
        },
      },
    ];

    const startDataRowNum = headerRowNum + 1;

    rowsDef.forEach((rowDef) => {
      const rowValues = displayDays.map((day) => formatCell(rowDef.getValue(day)));
      const sumVal = formatCell(rowSums[rowDef.sumKey]);
      const addedRow = worksheet.addRow([rowDef.category, rowDef.label, rowDef.factor, sumVal, ...rowValues]);
      const r = addedRow.number;
      addedRow.height = 21;

      addedRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = thinBorder;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowDef?.rowBgColor || 'FFFFFFFF' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = {
          ...baseFont,
          bold: true,
          size: 9,
          color: { argb: rowDef?.textColor || 'FF334155' },
        };

        if (colNumber === 2) {
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        } else if (colNumber === 3) {
          if (rowDef.hasFactor) {
            if (rowDef.factorBgColor) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowDef.factorBgColor } };
            }
            if (rowDef.factorTextColor) {
              cell.font = { ...baseFont, bold: true, size: 8.5, color: { argb: rowDef.factorTextColor } };
            }
          }
        } else if (colNumber === 4) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowDef.sumBgColor } };
          cell.font = { ...baseFont, bold: true, size: 9.5, color: { argb: rowDef.sumTextColor } };
          if (typeof cell.value === 'number') {
            cell.numFmt = '#,##0';
          }
        } else if (colNumber >= 5) {
          if (typeof cell.value === 'number') {
            cell.numFmt = '#,##0';
          }
        }
      });

      if (!rowDef.hasFactor) {
        worksheet.mergeCells(`B${r}:C${r}`);
        const mergedDesc = worksheet.getCell(`B${r}`);
        mergedDesc.value = rowDef.label;
        mergedDesc.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        mergedDesc.font = { ...baseFont, bold: true, size: 9, color: { argb: rowDef.textColor } };
        if (rowDef.rowBgColor) {
          mergedDesc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowDef.rowBgColor } };
        }
      }
    });

    // Merge หมวดหมู่ Head count (แถวที่ 1-6 ของข้อมูล)
    const headCountStart = startDataRowNum;
    const headCountEnd = startDataRowNum + 5;
    worksheet.mergeCells(`A${headCountStart}:A${headCountEnd}`);
    const headCountCell = worksheet.getCell(`A${headCountStart}`);
    headCountCell.value = '👥 Head count';
    headCountCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headCountCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E3A8A' } };
    headCountCell.fill = categoryHeaderFill;

    // Merge หมวดหมู่ Manpower (แถวที่ 7-23 ของข้อมูล)
    const manpowerStart = startDataRowNum + 6;
    const manpowerEnd = startDataRowNum + 22;
    worksheet.mergeCells(`A${manpowerStart}:A${manpowerEnd}`);
    const manpowerCell = worksheet.getCell(`A${manpowerStart}`);
    manpowerCell.value = '⚡ Manpower';
    manpowerCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    manpowerCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E3A8A' } };
    manpowerCell.fill = categoryHeaderFill;

    // เติมขอบให้เซลล์ทั้งหมดในบล็อกของ Line นี้
    const totalCols = displayDays.length + 4;
    for (let r = headerRowNum; r <= manpowerEnd; r++) {
      const row = worksheet.getRow(r);
      for (let c = 1; c <= totalCols; c++) {
        const cell = row.getCell(c);
        if (!cell.border) {
          cell.border = thinBorder;
        }
      }
    }

    // เพิ่มช่องว่างคั่นระหว่างตารางแต่ละไลน์ 3 ช่อง (3 แถว) ตามคำขอ
    for (let s = 0; s < 3; s++) {
      const spacerRow = worksheet.addRow([]);
      spacerRow.height = 16;
    }
  });

  return worksheet;
}

/**
 * ส่งออกตารางทุกไลน์ต่อกันในหน้าเดียว (Single-sheet stacked workbook)
 */
export async function exportStackedManHourMatrixExcel({
  selectedMonth,
  fileNamePrefix = 'ManHour_Stacked',
  sheetName = 'ManHour_All',
  displayDays,
  manhourCalendar,
  linesData,
}: ExportAllManHourMatrixParams & { sheetName?: string }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Fujikura Manpower System';
  workbook.created = new Date();

  addStackedLinesWorksheet(workbook, {
    sheetName,
    selectedMonth,
    displayDays,
    manhourCalendar,
    linesData,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const cleanPrefix = fileNamePrefix.replace(/[\\/:*?"<>|]/g, '_');
  const fileName = `${cleanPrefix}_${selectedMonth}.xlsx`;
  saveAs(blob, fileName);
}

export interface TabStackedExportGroup {
  tabName: string;
  linesData: SingleLineExportData[];
}

/**
 * ส่งออกครบ 5 แผนกตามแท็บ (Macro PCN, FPC, SMT, QA, IND) โดยแต่ละแท็บรวมต่อกันใน 1 หน้า (รวม 5 แผ่นงานใน 1 ไฟล์)
 */
export async function exportTabsStackedManHourMatrixExcel({
  selectedMonth,
  fileNamePrefix = 'ManHour_All_Tabs_5Sheets',
  displayDays,
  manhourCalendar,
  tabsData,
}: {
  selectedMonth: string;
  fileNamePrefix?: string;
  displayDays: number[];
  manhourCalendar: Record<number, { date?: string; manhour?: number }>;
  tabsData: TabStackedExportGroup[];
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Fujikura Manpower System';
  workbook.created = new Date();

  tabsData.forEach((tabGroup) => {
    if (tabGroup.linesData && tabGroup.linesData.length > 0) {
      addStackedLinesWorksheet(workbook, {
        sheetName: tabGroup.tabName,
        selectedMonth,
        displayDays,
        manhourCalendar,
        linesData: tabGroup.linesData,
      });
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const cleanPrefix = fileNamePrefix.replace(/[\\/:*?"<>|]/g, '_');
  const fileName = `${cleanPrefix}_${selectedMonth}.xlsx`;
  saveAs(blob, fileName);
}
