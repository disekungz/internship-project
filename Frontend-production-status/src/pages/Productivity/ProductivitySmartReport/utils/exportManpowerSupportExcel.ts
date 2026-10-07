import dayjs from "dayjs";
import { LoanExcludeRecord } from "../types";

export interface ExportManpowerSupportOptions {
  fileName?: string;
}

export const exportManpowerSupportToExcel = async (
  records: LoanExcludeRecord[],
  options: ExportManpowerSupportOptions = {}
): Promise<void> => {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fujikura Smart Factory";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Manpower Support", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 5, showGridLines: true }],
  });

  const today = dayjs().startOf("day");
  const isExpired = (rec: LoanExcludeRecord) =>
    !!rec.end_date && dayjs(rec.end_date).isBefore(today);

  const activeCount = records.filter((r) => !isExpired(r) && r.is_active).length;
  const expiredCount = records.filter((r) => isExpired(r)).length;

  // Title Row (Row 2)
  const titleRow = worksheet.getRow(2);
  titleRow.height = 24;
  const titleCell = titleRow.getCell(2);
  titleCell.value = "รายงานรายชื่อพนักงานช่วยงานต่างสาขา (Manpower Support Master Data)";
  titleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FF1E3A8A" } };

  // Metadata Row (Row 3)
  const metaRow = worksheet.getRow(3);
  metaRow.height = 18;
  const metaCell = metaRow.getCell(2);
  metaCell.value = `พิมพ์เมื่อ: ${dayjs().format("DD/MM/YYYY HH:mm:ss")} | ทั้งหมด: ${records.length} คน | กำลังช่วยงาน: ${activeCount} คน | ครบกำหนดแล้ว: ${expiredCount} คน`;
  metaCell.font = { name: "Segoe UI", size: 9.5, italic: true, color: { argb: "FF64748B" } };

  // Header Definition (Row 5)
  const headers = [
    { header: "ลำดับ", key: "no", width: 8, align: "center" as const },
    { header: "รหัสพนักงาน", key: "employee_id", width: 15, align: "center" as const },
    { header: "ชื่อ-นามสกุล", key: "employee_name", width: 26, align: "left" as const },
    { header: "แผนก / Cost Center", key: "department", width: 22, align: "left" as const },
    { header: "สาขาที่ไปช่วยงาน", key: "destination", width: 18, align: "center" as const },
    { header: "วันที่เริ่มต้น", key: "start_date", width: 16, align: "center" as const },
    { header: "วันที่สิ้นสุด", key: "end_date", width: 16, align: "center" as const },
    { header: "สถานะ", key: "status", width: 16, align: "center" as const },
  ];

  const headerRowNum = 5;
  const headerRow = worksheet.getRow(headerRowNum);
  headerRow.height = 26;

  headers.forEach((h, idx) => {
    const colIndex = idx + 1;
    const cell = headerRow.getCell(colIndex);
    cell.value = h.header;
    cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" }, // Navy blue
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF1E3A8A" } },
      left: { style: "thin", color: { argb: "FF3B82F6" } },
      right: { style: "thin", color: { argb: "FF3B82F6" } },
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
    };
    worksheet.getColumn(colIndex).width = h.width;
  });

  // Border helper
  const thinBorder = {
    top: { style: "thin" as const, color: { argb: "FFE2E8F0" } },
    left: { style: "thin" as const, color: { argb: "FFE2E8F0" } },
    right: { style: "thin" as const, color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin" as const, color: { argb: "FFE2E8F0" } },
  };

  // Branch badge color helper
  const getBranchColors = (branch: string) => {
    const b = (branch || "").toUpperCase().trim();
    if (b.startsWith("A")) return { fg: "FFDCFCE7", text: "FF166534" }; // emerald
    if (b.startsWith("N")) return { fg: "FFDBEAFE", text: "FF1E40AF" }; // blue
    if (b.startsWith("P")) return { fg: "FFF3E8FF", text: "FF6B21A8" }; // purple
    if (b.startsWith("K")) return { fg: "FFFEF3C7", text: "FF92400E" }; // amber
    return { fg: "FFF1F5F9", text: "FF334155" }; // slate
  };

  // Populate data rows
  let currentRowNum = headerRowNum + 1;

  records.forEach((rec, idx) => {
    const row = worksheet.getRow(currentRowNum);
    row.height = 21;
    const expired = isExpired(rec);
    const isEven = idx % 2 === 1;
    const zebraBg = isEven ? "FFF8FAFC" : "FFFFFFFF";

    // 1. No.
    const c1 = row.getCell(1);
    c1.value = idx + 1;
    c1.font = { name: "Segoe UI", size: 9.5, color: { argb: "FF64748B" }, bold: true };
    c1.alignment = { vertical: "middle", horizontal: "center" };
    c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebraBg } };
    c1.border = thinBorder;

    // 2. Employee ID
    const c2 = row.getCell(2);
    c2.value = rec.employee_id;
    c2.font = {
      name: "Consolas",
      size: 10,
      bold: true,
      color: { argb: expired ? "FF94A3B8" : "FF2563EB" },
    };
    c2.alignment = { vertical: "middle", horizontal: "center" };
    c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebraBg } };
    c2.border = thinBorder;

    // 3. Employee Name
    const c3 = row.getCell(3);
    c3.value = rec.employee_name || "-";
    c3.font = {
      name: "Segoe UI",
      size: 9.5,
      bold: true,
      color: { argb: expired ? "FF94A3B8" : "FF1E293B" },
    };
    c3.alignment = { vertical: "middle", horizontal: "left" };
    c3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebraBg } };
    c3.border = thinBorder;

    // 4. Department
    const c4 = row.getCell(4);
    c4.value = rec.department || "-";
    c4.font = { name: "Segoe UI", size: 9.5, color: { argb: "FF475569" } };
    c4.alignment = { vertical: "middle", horizontal: "left" };
    c4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebraBg } };
    c4.border = thinBorder;

    // 5. Destination
    const c5 = row.getCell(5);
    const dest = rec.destination || "ช่วยงานสาขาอื่น";
    c5.value = dest;
    const branchColors = getBranchColors(dest);
    c5.font = {
      name: "Segoe UI",
      size: 9.5,
      bold: true,
      color: { argb: expired ? "FF64748B" : branchColors.text },
    };
    c5.alignment = { vertical: "middle", horizontal: "center" };
    c5.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: expired ? "FFF1F5F9" : branchColors.fg },
    };
    c5.border = thinBorder;

    // 6. Start Date
    const c6 = row.getCell(6);
    c6.value = rec.start_date ? dayjs(rec.start_date).format("DD/MM/YYYY") : "—";
    c6.font = { name: "Segoe UI", size: 9.5, color: { argb: "FF334155" } };
    c6.alignment = { vertical: "middle", horizontal: "center" };
    c6.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebraBg } };
    c6.border = thinBorder;

    // 7. End Date
    const c7 = row.getCell(7);
    c7.value = rec.end_date ? dayjs(rec.end_date).format("DD/MM/YYYY") : "ไม่มีกำหนด";
    c7.font = {
      name: "Segoe UI",
      size: 9.5,
      color: { argb: rec.end_date ? "FF334155" : "FF94A3B8" },
      italic: !rec.end_date,
    };
    c7.alignment = { vertical: "middle", horizontal: "center" };
    c7.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebraBg } };
    c7.border = thinBorder;

    // 8. Status
    const c8 = row.getCell(8);
    if (expired) {
      c8.value = "ครบกำหนดแล้ว";
      c8.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF94A3B8" } };
      c8.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    } else {
      c8.value = "กำลังช่วยงาน";
      c8.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF15803D" } };
      c8.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
    }
    c8.alignment = { vertical: "middle", horizontal: "center" };
    c8.border = thinBorder;

    currentRowNum++;
  });

  // Safe margin auto-fit for columns
  headers.forEach((h, idx) => {
    const colIndex = idx + 1;
    let maxLen = h.header.length * 1.5;
    records.forEach((rec, rIdx) => {
      let val = "";
      if (h.key === "no") val = String(rIdx + 1);
      else if (h.key === "employee_id") val = rec.employee_id || "";
      else if (h.key === "employee_name") val = rec.employee_name || "";
      else if (h.key === "department") val = rec.department || "";
      else if (h.key === "destination") val = rec.destination || "";
      else if (h.key === "start_date") val = rec.start_date || "";
      else if (h.key === "end_date") val = rec.end_date || "";
      else if (h.key === "status") val = isExpired(rec) ? "ครบกำหนดแล้ว" : "กำลังช่วยงาน";

      if (val.length > maxLen) maxLen = val.length;
    });
    worksheet.getColumn(colIndex).width = Math.min(Math.max(maxLen + 3, h.width), 45);
  });

  // Export buffer & download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const defaultFileName = `Manpower_Support_Master_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`;
  const exportName = options.fileName || defaultFileName;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportName.endsWith(".xlsx") ? exportName : `${exportName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};
