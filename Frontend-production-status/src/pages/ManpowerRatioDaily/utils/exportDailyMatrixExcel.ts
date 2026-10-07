import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export async function exportDailyMatrixExcel({
  date,
  blocks,
  rows,
  groupSummaries,
  totalP1,
}: {
  date: string;
  blocks: string[];
  rows: any[];
  groupSummaries: Record<string, any>;
  totalP1: Record<string, any>;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Smart Factory WIP System";
  workbook.lastModifiedBy = "Smart Factory WIP System";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(`Daily_${date}`, {
    views: [{ showGridLines: true }],
  });

  // กำหนดชุดสีตามหน้าเว็บ (DailyMatrixTable)
  const BLOCK_THEMES: Record<string, { headerBg: string; headerText: string; subBg: string; sumBg: string; lightBg: string }> = {
    P1: { headerBg: "FF002060", headerText: "FFFFFFFF", subBg: "FFB8CCE4", sumBg: "FFDCE6F1", lightBg: "FFF2F7FC" },
    PER: { headerBg: "FF76933C", headerText: "FFFFFFFF", subBg: "FFD8E4BC", sumBg: "FFEAF1DD", lightBg: "FFF7F9F2" },
    SUB: { headerBg: "FF002060", headerText: "FFFFFFFF", subBg: "FFB8CCE4", sumBg: "FFDCE6F1", lightBg: "FFF2F7FC" },
    MOU: { headerBg: "FF7030A0", headerText: "FFFFFFFF", subBg: "FFCCC0DA", sumBg: "FFF2EBF7", lightBg: "FFFAF7FC" },
    DC: { headerBg: "FF2F5597", headerText: "FFFFFFFF", subBg: "FFB8CCE4", sumBg: "FFDCE6F1", lightBg: "FFF2F7FC" },
  };

  // คำนวณจำนวนคอลัมน์ทั้งหมด
  // Col 1: Group, Col 2: Dept, Col 3: COC
  let totalCols = 3;
  blocks.forEach((blk) => {
    totalCols += blk === 'P1' ? 6 : 10;
  });

  // แถวที่ 1: หัววันที่และชื่อรายงาน
  worksheet.mergeCells(1, 1, 1, totalCols);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = `MANPOWER RATIO DAILY - ${date}`;
  titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF193886" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 30;

  // แถวที่ 2 & 3: หัวตาราง 2 ระดับ
  // A2:A3 = Group, B2:B3 = Dept, C2:C3 = COC
  worksheet.mergeCells("A2:A3");
  worksheet.mergeCells("B2:B3");
  worksheet.mergeCells("C2:C3");

  const cellA2 = worksheet.getCell("A2");
  cellA2.value = "Group";
  cellA2.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  cellA2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F497D" } };
  cellA2.alignment = { horizontal: "center", vertical: "middle" };

  const cellB2 = worksheet.getCell("B2");
  cellB2.value = "Dept";
  cellB2.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  cellB2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F497D" } };
  cellB2.alignment = { horizontal: "center", vertical: "middle" };

  const cellC2 = worksheet.getCell("C2");
  cellC2.value = "COC";
  cellC2.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  cellC2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F497D" } };
  cellC2.alignment = { horizontal: "center", vertical: "middle" };

  [cellA2, cellB2, cellC2].forEach((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FF8EA9DB" } },
      bottom: { style: "thin", color: { argb: "FF8EA9DB" } },
      left: { style: "thin", color: { argb: "FF8EA9DB" } },
      right: { style: "thin", color: { argb: "FF8EA9DB" } },
    };
  });

  // หัวตารางระดับบน (Row 2: Block Names)
  let currentCol = 4;
  blocks.forEach((block) => {
    const theme = BLOCK_THEMES[block] || BLOCK_THEMES.P1;
    const colCount = block === 'P1' ? 6 : 10;
    const startCol = currentCol;
    const endCol = currentCol + colCount - 1;

    worksheet.mergeCells(2, startCol, 2, endCol);
    const cell = worksheet.getCell(2, startCol);
    cell.value = block;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: theme.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: theme.headerBg } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFB0C4DE" } },
      bottom: { style: "thin", color: { argb: "FFB0C4DE" } },
      left: { style: "thin", color: { argb: "FFB0C4DE" } },
      right: { style: "thin", color: { argb: "FFB0C4DE" } },
    };

    // Row 3: Sub-headers
    const subHeaders = block === 'P1'
      ? ["Sum MP", "Sum Work", "Sum Leave", "Sum OT", "Leave Ratio", "OT Ratio"]
      : ["MP", "Work", "Leave", "OT", "Sum MP", "Sum Work", "Sum Leave", "Sum OT", "Leave Ratio", "OT Ratio"];

    subHeaders.forEach((h, i) => {
      const subCell = worksheet.getCell(3, startCol + i);
      subCell.value = h;
      const isSumCol = h.startsWith("Sum ");
      const isLeave = h.includes("Leave");
      const isOT = h.includes("OT");

      subCell.font = {
        name: "Calibri",
        size: 9,
        bold: true,
        color: {
          argb: isLeave ? "FFC00000" : isOT ? "FF1F497D" : "FF000000",
        },
      };
      subCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isSumCol ? theme.subBg : theme.lightBg },
      };
      subCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      subCell.border = {
        top: { style: "thin", color: { argb: "FFB0C4DE" } },
        bottom: { style: "thin", color: { argb: "FFB0C4DE" } },
        left: { style: "thin", color: { argb: "FFB0C4DE" } },
        right: { style: "thin", color: { argb: "FFB0C4DE" } },
      };
    });

    currentCol = endCol + 1;
  });
  worksheet.getRow(2).height = 24;
  worksheet.getRow(3).height = 22;

  // Thin border helper
  const thinBorder = {
    top: { style: "thin" as const, color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin" as const, color: { argb: "FFE2E8F0" } },
    left: { style: "thin" as const, color: { argb: "FFE2E8F0" } },
    right: { style: "thin" as const, color: { argb: "FFE2E8F0" } },
  };

  // Group colors for the left Group column (matching web style)
  const GROUP_PILL_COLORS: Record<string, { bg: string; text: string }> = {
    INDIRECT: { bg: "FFE8EEF5", text: "FF1F497D" },
    QA: { bg: "FFE8EEF5", text: "FF1F497D" },
    FPC: { bg: "FFE8EEF5", text: "FF1F497D" },
    SMT_F: { bg: "FFE8EEF5", text: "FF1F497D" },
    SMT_B: { bg: "FFE8EEF5", text: "FF1F497D" },
    MDS: { bg: "FFE8EEF5", text: "FF1F497D" },
  };

  let rowIdx = 4;
  const groupKeys = ["INDIRECT", "QA", "FPC", "SMT_F", "SMT_B", "MDS"];

  groupKeys.forEach((grpKey) => {
    const grpRows = rows.filter((r) => r.group === grpKey);
    if (grpRows.length === 0) return;

    const startGrpRow = rowIdx;

    grpRows.forEach((r) => {
      const row = worksheet.getRow(rowIdx);

      // Col 1: Group
      row.getCell(1).value = grpKey;
      row.getCell(1).font = { name: "Calibri", size: 9, bold: true, color: { argb: GROUP_PILL_COLORS[grpKey]?.text || "FF333333" } };
      row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GROUP_PILL_COLORS[grpKey]?.bg || "FFF8FAFC" } };
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(1).border = thinBorder;

      // Col 2: Dept
      row.getCell(2).value = r.dept;
      row.getCell(2).font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF0F172A" } };
      row.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
      row.getCell(2).border = thinBorder;

      // Col 3: COC
      row.getCell(3).value = r.coc || "-";
      row.getCell(3).font = { name: "Consolas", size: 9, color: { argb: "FF475569" } };
      row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(3).border = thinBorder;

      let cIdx = 4;
      blocks.forEach((blk) => {
        const d = r.blocks[blk] || { mp: 0, work: 0, leave: 0, ot: 0, leaveRatio: 0, otRatio: 0 };
        const theme = BLOCK_THEMES[blk] || BLOCK_THEMES.P1;

        if (blk === 'P1') {
          // P1: Sum MP, Sum Work, Sum Leave, Sum OT, Leave Ratio, OT Ratio
          [d.mp, d.work, d.leave, d.ot].forEach((val, i) => {
            const cell = row.getCell(cIdx + i);
            cell.value = val;
            const isLeave = i === 2;
            const isOT = i === 3;
            cell.font = {
              name: "Calibri",
              size: 9,
              bold: true,
              color: { argb: isLeave ? "FFBE123C" : isOT ? "FFB45309" : "FF0F172A" },
            };
            cell.alignment = { horizontal: "right", vertical: "middle" };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: theme.sumBg } };
            cell.border = thinBorder;
          });

          const leaveCell = row.getCell(cIdx + 4);
          const otCell = row.getCell(cIdx + 5);
          leaveCell.value = Number(d.leaveRatio) / 100;
          otCell.value = Number(d.otRatio) / 100;
          leaveCell.numFmt = "0.0%";
          otCell.numFmt = "0.0%";
          leaveCell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FFE11D48" } };
          otCell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF1E40AF" } };
          leaveCell.alignment = { horizontal: "right", vertical: "middle" };
          otCell.alignment = { horizontal: "right", vertical: "middle" };
          leaveCell.border = thinBorder;
          otCell.border = thinBorder;

          cIdx += 6;
        } else {
          // Other blocks: MP, Work, Leave, OT, Sum MP, Sum Work, Sum Leave, Sum OT, Leave Ratio, OT Ratio
          // Sub metrics (MP, Work, Leave, OT)
          [d.mp, d.work, d.leave, d.ot].forEach((val, i) => {
            const cell = row.getCell(cIdx + i);
            cell.value = val;
            const isLeave = i === 2;
            const isOT = i === 3;
            cell.font = {
              name: "Calibri",
              size: 9,
              bold: isLeave || isOT,
              color: { argb: isLeave ? "FFE11D48" : isOT ? "FFD97706" : "FF334155" },
            };
            cell.alignment = { horizontal: "right", vertical: "middle" };
            cell.border = thinBorder;
          });

          // Sum metrics (Sum MP, Sum Work, Sum Leave, Sum OT)
          [d.mp, d.work, d.leave, d.ot].forEach((val, i) => {
            const cell = row.getCell(cIdx + 4 + i);
            cell.value = val;
            const isLeave = i === 2;
            const isOT = i === 3;
            cell.font = {
              name: "Calibri",
              size: 9,
              bold: true,
              color: { argb: isLeave ? "FFBE123C" : isOT ? "FFB45309" : "FF0F172A" },
            };
            cell.alignment = { horizontal: "right", vertical: "middle" };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: theme.sumBg } };
            cell.border = thinBorder;
          });

          const leaveCell = row.getCell(cIdx + 8);
          const otCell = row.getCell(cIdx + 9);
          leaveCell.value = Number(d.leaveRatio) / 100;
          otCell.value = Number(d.otRatio) / 100;
          leaveCell.numFmt = "0.0%";
          otCell.numFmt = "0.0%";
          leaveCell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FFE11D48" } };
          otCell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF1E40AF" } };
          leaveCell.alignment = { horizontal: "right", vertical: "middle" };
          otCell.alignment = { horizontal: "right", vertical: "middle" };
          leaveCell.border = thinBorder;
          otCell.border = thinBorder;

          cIdx += 10;
        }
      });

      row.height = 20;
      rowIdx++;
    });

    // Merge คอลัมน์ Group แนวตั้ง สำหรับแต่ละกลุ่ม
    const endGrpRow = rowIdx - 1;
    if (endGrpRow >= startGrpRow) {
      worksheet.mergeCells(startGrpRow, 1, endGrpRow, 1);
    }

    // แถวสรุปกลุ่มใหญ่ (Group Subtotal) เช่น Total INDIRECT, Total QA, etc.
    const grpSum = groupSummaries[grpKey];
    if (grpSum) {
      const sumRow = worksheet.getRow(rowIdx);

      // Col 1 & 2: Total <Group>
      worksheet.mergeCells(rowIdx, 1, rowIdx, 2);
      const totalTitleCell = sumRow.getCell(1);
      totalTitleCell.value = `Total ${grpKey}`;
      totalTitleCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF0F172A" } };
      totalTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      totalTitleCell.alignment = { horizontal: "left", vertical: "middle" };

      const totalCocCell = sumRow.getCell(3);
      totalCocCell.value = "-";
      totalCocCell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF64748B" } };
      totalCocCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      totalCocCell.alignment = { horizontal: "center", vertical: "middle" };

      const sumBorder = {
        top: { style: "medium" as const, color: { argb: "FF94A3B8" } },
        bottom: { style: "medium" as const, color: { argb: "FF94A3B8" } },
        left: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
        right: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
      };

      totalTitleCell.border = sumBorder;
      sumRow.getCell(2).border = sumBorder;
      totalCocCell.border = sumBorder;

      let cIdx = 4;
      blocks.forEach((blk) => {
        const gd = grpSum[blk] || { mp: 0, work: 0, leave: 0, ot: 0, leaveRatio: 0, otRatio: 0 };
        if (blk === 'P1') {
          [gd.mp, gd.work, gd.leave, gd.ot].forEach((val, i) => {
            const cell = sumRow.getCell(cIdx + i);
            cell.value = val;
            const isLeave = i === 2;
            const isOT = i === 3;
            cell.font = {
              name: "Calibri",
              size: 9.5,
              bold: true,
              color: { argb: isLeave ? "FF881337" : isOT ? "FF78350F" : "FF020617" },
            };
            cell.alignment = { horizontal: "right", vertical: "middle" };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBFDBFE" } };
            cell.border = sumBorder;
          });

          const leaveCell = sumRow.getCell(cIdx + 4);
          const otCell = sumRow.getCell(cIdx + 5);
          leaveCell.value = Number(gd.leaveRatio) / 100;
          otCell.value = Number(gd.otRatio) / 100;
          leaveCell.numFmt = "0.0%";
          otCell.numFmt = "0.0%";
          leaveCell.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FFBE123C" } };
          otCell.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FF1E3A8A" } };
          leaveCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
          otCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
          leaveCell.alignment = { horizontal: "right", vertical: "middle" };
          otCell.alignment = { horizontal: "right", vertical: "middle" };
          leaveCell.border = sumBorder;
          otCell.border = sumBorder;

          cIdx += 6;
        } else {
          // Non-P1 Group summary
          [gd.mp, gd.work, gd.leave, gd.ot].forEach((val, i) => {
            const cell = sumRow.getCell(cIdx + i);
            cell.value = val;
            cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF334155" } };
            cell.alignment = { horizontal: "right", vertical: "middle" };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
            cell.border = sumBorder;
          });

          [gd.mp, gd.work, gd.leave, gd.ot].forEach((val, i) => {
            const cell = sumRow.getCell(cIdx + 4 + i);
            cell.value = val;
            const isLeave = i === 2;
            const isOT = i === 3;
            cell.font = {
              name: "Calibri",
              size: 9.5,
              bold: true,
              color: { argb: isLeave ? "FF881337" : isOT ? "FF78350F" : "FF020617" },
            };
            cell.alignment = { horizontal: "right", vertical: "middle" };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBFDBFE" } };
            cell.border = sumBorder;
          });

          const leaveCell = sumRow.getCell(cIdx + 8);
          const otCell = sumRow.getCell(cIdx + 9);
          leaveCell.value = Number(gd.leaveRatio) / 100;
          otCell.value = Number(gd.otRatio) / 100;
          leaveCell.numFmt = "0.0%";
          otCell.numFmt = "0.0%";
          leaveCell.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FFBE123C" } };
          otCell.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FF1E3A8A" } };
          leaveCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
          otCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
          leaveCell.alignment = { horizontal: "right", vertical: "middle" };
          otCell.alignment = { horizontal: "right", vertical: "middle" };
          leaveCell.border = sumBorder;
          otCell.border = sumBorder;

          cIdx += 10;
        }
      });

      sumRow.height = 22;
      rowIdx++;
    }
  });

  // แถวสรุป Total P1 ด้านล่างสุด (Grand Total)
  const totalRow = worksheet.getRow(rowIdx);
  worksheet.mergeCells(rowIdx, 1, rowIdx, 3);
  const grandTitleCell = totalRow.getCell(1);
  grandTitleCell.value = "Total P1";
  grandTitleCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  grandTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF193886" } };
  grandTitleCell.alignment = { horizontal: "center", vertical: "middle" };

  const grandBorder = {
    top: { style: "medium" as const, color: { argb: "FF0F172A" } },
    bottom: { style: "double" as const, color: { argb: "FF0F172A" } },
    left: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    right: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
  };

  grandTitleCell.border = grandBorder;
  totalRow.getCell(2).border = grandBorder;
  totalRow.getCell(3).border = grandBorder;

  let cIdx = 4;
  blocks.forEach((blk) => {
    const d = totalP1[blk] || { mp: 0, work: 0, leave: 0, ot: 0, leaveRatio: 0, otRatio: 0 };
    if (blk === 'P1') {
      [d.mp, d.work, d.leave, d.ot].forEach((val, i) => {
        const cell = totalRow.getCell(cIdx + i);
        cell.value = val;
        const isLeave = i === 2;
        const isOT = i === 3;
        cell.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color: { argb: isLeave ? "FF881337" : isOT ? "FF78350F" : "FF172554" },
        };
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBFDBFE" } };
        cell.border = grandBorder;
      });

      const leaveCell = totalRow.getCell(cIdx + 4);
      const otCell = totalRow.getCell(cIdx + 5);
      leaveCell.value = Number(d.leaveRatio) / 100;
      otCell.value = Number(d.otRatio) / 100;
      leaveCell.numFmt = "0.0%";
      otCell.numFmt = "0.0%";
      leaveCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFE11D48" } };
      otCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E3A8A" } };
      leaveCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      otCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      leaveCell.alignment = { horizontal: "right", vertical: "middle" };
      otCell.alignment = { horizontal: "right", vertical: "middle" };
      leaveCell.border = grandBorder;
      otCell.border = grandBorder;

      cIdx += 6;
    } else {
      [d.mp, d.work, d.leave, d.ot].forEach((val, i) => {
        const cell = totalRow.getCell(cIdx + i);
        cell.value = val;
        cell.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FF334155" } };
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        cell.border = grandBorder;
      });

      [d.mp, d.work, d.leave, d.ot].forEach((val, i) => {
        const cell = totalRow.getCell(cIdx + 4 + i);
        cell.value = val;
        const isLeave = i === 2;
        const isOT = i === 3;
        cell.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color: { argb: isLeave ? "FF881337" : isOT ? "FF78350F" : "FF172554" },
        };
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBFDBFE" } };
        cell.border = grandBorder;
      });

      const leaveCell = totalRow.getCell(cIdx + 8);
      const otCell = totalRow.getCell(cIdx + 9);
      leaveCell.value = Number(d.leaveRatio) / 100;
      otCell.value = Number(d.otRatio) / 100;
      leaveCell.numFmt = "0.0%";
      otCell.numFmt = "0.0%";
      leaveCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFE11D48" } };
      otCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E3A8A" } };
      leaveCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      otCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      leaveCell.alignment = { horizontal: "right", vertical: "middle" };
      otCell.alignment = { horizontal: "right", vertical: "middle" };
      leaveCell.border = grandBorder;
      otCell.border = grandBorder;

      cIdx += 10;
    }
  });
  totalRow.height = 24;

  // กำหนดความกว้างคอลัมน์ให้อ่านง่าย
  worksheet.getColumn(1).width = 14; // Group
  worksheet.getColumn(2).width = 16; // Dept
  worksheet.getColumn(3).width = 10; // COC
  for (let c = 4; c <= totalCols; c++) {
    worksheet.getColumn(c).width = 11;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `MANPOWER_RATIO_DAILY_${date}.xlsx`);
}
