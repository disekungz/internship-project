import React, { useState, useMemo } from "react";
import {
  Building2,
  Users,
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  Calendar,
  Filter,
  FileSpreadsheet,
} from "lucide-react";
import { isAggregateLine, isShiftLine } from "../utils/lineClassification";

interface DepartmentMatrixViewProps {
  activeTab: string;
  selectedMonth: string;
  tabLines: string[];
  spreadsheetData: Record<string, any>;
  displayDays: number[];
  manhourCalendar: Record<number, any>;
  onSelectLine: (lineName: string) => void;
  selectedLine: string;
  onExportTabLines?: () => void;
  onExportAllTabs?: () => void;
}

// Memoized Matrix Row Component for maximum render performance
const MatrixTableRow = React.memo(
  ({
    item,
    isCurrent,
    onSelectLine,
  }: {
    item: any;
    isCurrent: boolean;
    onSelectLine: (line: string) => void;
  }) => {
    return (
      <tr
        className={`transition-colors hover:bg-primary/5 ${
          isCurrent ? "bg-primary/15 font-bold" : ""
        }`}
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                item.attendanceRate >= 95
                  ? "bg-emerald-500"
                  : item.attendanceRate >= 90
                    ? "bg-amber-500"
                    : "bg-rose-500"
              }`}
            />
            <span className="text-sm font-bold text-base-content">{item.line}</span>
            {item.isAggregate ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-950 px-2 py-0.5 text-[10px] font-mono font-bold text-indigo-300 border border-indigo-700/60 shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                SUMMARY
              </span>
            ) : isShiftLine(item.line) ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-950 px-2 py-0.5 text-[10px] font-mono font-semibold text-sky-200 border border-blue-700/60">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                SHIFT
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-base-200 px-2 py-0.5 text-[10px] font-mono font-bold text-base-content/80 border border-base-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                LINE
              </span>
            )}
          </div>
        </td>
        <td className="py-3 px-3 text-center font-bold text-base-content/70">
          {item.avgRegister}
        </td>
        <td className="py-3 px-3 text-center font-bold text-base-content">
          {item.avgPresent}
        </td>
        <td className="py-3 px-4 text-center">
          <div className="inline-flex items-center justify-center gap-1.5">
            <div className="w-16 h-2 rounded-full bg-base-300 overflow-hidden">
              <div
                className={`h-full ${
                  item.attendanceRate >= 95
                    ? "bg-emerald-500"
                    : item.attendanceRate >= 90
                      ? "bg-amber-500"
                      : "bg-rose-500"
                }`}
                style={{ width: `${Math.min(item.attendanceRate, 100)}%` }}
              />
            </div>
            <span
              className={`font-black text-xs ${
                item.attendanceRate >= 95
                  ? "text-emerald-500"
                  : item.attendanceRate >= 90
                    ? "text-amber-500"
                    : "text-rose-500"
              }`}
            >
              {item.attendanceRate}%
            </span>
          </div>
        </td>
        <td className="py-3 px-3 text-center">
          <span
            className={`font-bold ${
              item.absentRate > 5 ? "text-rose-500" : "text-base-content/50"
            }`}
          >
            {item.absentRate}%
          </span>
        </td>
        <td className="py-3 px-3 text-center font-mono font-bold text-base-content/80">
          {item.totalNormalHours.toLocaleString()}
        </td>
        <td className="py-3 px-3 text-center font-mono font-bold text-amber-500">
          {item.totalOtHours.toLocaleString()}
        </td>
        <td className="py-3 px-3 text-center font-mono font-black text-primary">
          {item.totalManHours.toLocaleString()}
        </td>
        <td className="py-3 px-3 text-center">
          <span
            className={`font-bold px-2 py-0.5 rounded text-[11px] ${
              item.netHelp > 0
                ? "bg-emerald-500/15 text-emerald-500"
                : item.netHelp < 0
                  ? "bg-rose-500/15 text-rose-500"
                  : "bg-base-200 text-base-content/70"
            }`}
          >
            {item.netHelp > 0 ? `+${item.netHelp}h` : `${item.netHelp}h`}
          </span>
        </td>
        <td className="py-3 px-4 text-center">
          <button
            type="button"
            onClick={() => onSelectLine(item.line)}
            className="inline-flex items-center gap-1 rounded-lg border border-base-300 bg-base-100 px-2.5 py-1 text-xs font-bold text-primary shadow-xs hover:bg-primary hover:text-primary-content transition-all cursor-pointer"
            title="เลือกดูรายละเอียดไลน์นี้"
          >
            <span>เจาะลึก</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </td>
      </tr>
    );
  }
);
MatrixTableRow.displayName = "MatrixTableRow";

export default function DepartmentMatrixView({
  activeTab,
  selectedMonth,
  tabLines,
  spreadsheetData,
  displayDays,
  manhourCalendar,
  onSelectLine,
  selectedLine,
  onExportTabLines,
  onExportAllTabs,
}: DepartmentMatrixViewProps) {
  // วันที่เลือกดู ("all" = รวมทั้งเดือน, 1..31 = เจาะจงวัน)
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | "all">("all");
  // ตัวกรองประเภทไลน์: "all" = ทั้งหมด, "summary" = แบบรวมคน, "subline" = ไลน์ย่อยตัวมันเอง, "shift" = แยกกะ
  const [lineCategoryFilter, setLineCategoryFilter] = useState<"all" | "summary" | "subline" | "shift">("all");

  // Aggregate Line Metrics
  const lineSummaries = useMemo(() => {
    return tabLines.map((line) => {
      const lineObj = spreadsheetData[line] || {};

      // กรณีเลือกดูวันใดวันหนึ่ง
      if (selectedDayFilter !== "all") {
        const d = lineObj[selectedDayFilter] || {};
        const reg = Number(d.opRegister) || 0;
        const present = Number(d.swipeCards) || 0;
        const absent = Number(d.notWorking) || 0;
        const helpOut = Number(d.helpOutHrs) || 0;
        const helpIn = Number(d.helpInHrs) || 0;
        const ot1 = Number(d.manOT1) || 0;
        const ot1Out = Number(d.manOT1HelpOut) || 0;
        const ot1In = Number(d.manOT1HelpIn) || 0;
        const ot2 = Number(d.manOT2) || 0;
        const ot2Out = Number(d.manOT2HelpOut) || 0;
        const ot2In = Number(d.manOT2HelpIn) || 0;

        const isHoliday = Number(manhourCalendar?.[selectedDayFilter]?.manhour) === 0;
        const normalHr = isHoliday ? 0 : Math.max(present * 8 - helpOut + helpIn, 0);
        const otHr = Math.max(ot1 - ot1Out + ot1In, 0) * 3 + Math.max(ot2 - ot2Out + ot2In, 0) * 11;

        const attendanceRate = reg > 0 ? Number(((present / reg) * 100).toFixed(1)) : 0;
        const absentRate = reg > 0 ? Number(((absent / reg) * 100).toFixed(1)) : 0;

        const isAggregate = isAggregateLine(line, activeTab);

        return {
          line,
          isAggregate,
          avgPresent: present,
          avgRegister: reg,
          totalPresent: present,
          totalAbsent: absent,
          attendanceRate,
          absentRate,
          totalNormalHours: Math.round(normalHr),
          totalOtHours: Math.round(otHr),
          totalManHours: Math.round(normalHr + otHr),
          netHelp: Math.round(helpIn - helpOut),
        };
      }

      // กรณีเลือกดูภาพรวมทั้งเดือน
      let totalRegister = 0;
      let totalPresent = 0;
      let totalAbsent = 0;
      let totalOtHours = 0;
      let totalNormalHours = 0;
      let totalHelpIn = 0;
      let totalHelpOut = 0;
      let workingDays = 0;

      displayDays.forEach((day) => {
        const d = lineObj[day] || {};
        const reg = Number(d.opRegister) || 0;
        const present = Number(d.swipeCards) || 0;
        const absent = Number(d.notWorking) || 0;
        const helpOut = Number(d.helpOutHrs) || 0;
        const helpIn = Number(d.helpInHrs) || 0;
        const ot1 = Number(d.manOT1) || 0;
        const ot1Out = Number(d.manOT1HelpOut) || 0;
        const ot1In = Number(d.manOT1HelpIn) || 0;
        const ot2 = Number(d.manOT2) || 0;
        const ot2Out = Number(d.manOT2HelpOut) || 0;
        const ot2In = Number(d.manOT2HelpIn) || 0;

        const isHoliday = Number(manhourCalendar?.[day]?.manhour) === 0;
        const normalHr = isHoliday ? 0 : Math.max(present * 8 - helpOut + helpIn, 0);
        const otHr = Math.max(ot1 - ot1Out + ot1In, 0) * 3 + Math.max(ot2 - ot2Out + ot2In, 0) * 11;

        if (reg > 0 || present > 0) {
          workingDays++;
          totalRegister += reg;
          totalPresent += present;
          totalAbsent += absent;
          totalNormalHours += normalHr;
          totalOtHours += otHr;
          totalHelpIn += helpIn;
          totalHelpOut += helpOut;
        }
      });

      const avgPresent = workingDays > 0 ? Math.round(totalPresent / workingDays) : 0;
      const avgRegister = workingDays > 0 ? Math.round(totalRegister / workingDays) : 0;
      const attendanceRate = totalRegister > 0 ? Number(((totalPresent / totalRegister) * 100).toFixed(1)) : 0;
      const absentRate = totalRegister > 0 ? Number(((totalAbsent / totalRegister) * 100).toFixed(1)) : 0;
      const isAggregate = isAggregateLine(line, activeTab);

      return {
        line,
        isAggregate,
        avgPresent,
        avgRegister,
        totalPresent,
        totalAbsent,
        attendanceRate,
        absentRate,
        totalNormalHours: Math.round(totalNormalHours),
        totalOtHours: Math.round(totalOtHours),
        totalManHours: Math.round(totalNormalHours + totalOtHours),
        netHelp: Math.round(totalHelpIn - totalHelpOut),
      };
    });
  }, [tabLines, spreadsheetData, displayDays, manhourCalendar, selectedDayFilter, activeTab]);

  // แยกจำนวนไลน์รวมคน vs ไลน์ย่อย (ตัวมันเอง) vs รายการแยกกะ
  const { summaryCount, sublineCount, shiftCount } = useMemo(() => {
    let sCount = 0;
    let subCount = 0;
    let shCount = 0;
    lineSummaries.forEach((item) => {
      if (item.isAggregate) {
        sCount++;
      } else if (isShiftLine(item.line)) {
        shCount++;
      } else {
        subCount++;
      }
    });
    return { summaryCount: sCount, sublineCount: subCount, shiftCount: shCount };
  }, [lineSummaries]);

  // กรองข้อมูลตามประเภทที่เลือก (ทั้งหมด, แบบรวมคน, ไลน์ย่อยตัวมันเอง, แยกกะ)
  const displayedLineSummaries = useMemo(() => {
    if (lineCategoryFilter === "summary") {
      return lineSummaries.filter((item) => item.isAggregate);
    }
    if (lineCategoryFilter === "subline") {
      // ไลน์ย่อยคือ "ตัวมันเอง" (เช่น HOT PRESS, VAC, BLK) ไม่ใช่แยกชิฟต์ A B D
      return lineSummaries.filter((item) => !item.isAggregate && !isShiftLine(item.line));
    }
    if (lineCategoryFilter === "shift") {
      return lineSummaries.filter((item) => isShiftLine(item.line));
    }
    return lineSummaries;
  }, [lineSummaries, lineCategoryFilter]);

  // Overall Department Sums (คำนวณตามรายการที่กำลังแสดงผล)
  const deptTotal = useMemo(() => {
    return displayedLineSummaries.reduce(
      (acc, curr) => {
        acc.totalPresent += curr.totalPresent;
        acc.totalAbsent += curr.totalAbsent;
        acc.totalNormalHours += curr.totalNormalHours;
        acc.totalOtHours += curr.totalOtHours;
        acc.totalManHours += curr.totalManHours;
        return acc;
      },
      {
        totalPresent: 0,
        totalAbsent: 0,
        totalNormalHours: 0,
        totalOtHours: 0,
        totalManHours: 0,
      }
    );
  }, [displayedLineSummaries]);

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-200">
      {/* Overview Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-800/40 bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 p-5 text-white shadow-md shadow-blue-950/20">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-800/60 px-3 py-0.5 text-xs font-black text-sky-300 border border-blue-600/40">
              <Building2 className="h-3.5 w-3.5" /> DEPARTMENT CROSS-LINE BENCHMARK
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-800/70 px-2.5 py-0.5 text-xs font-bold text-white border border-blue-600/40">
              <Calendar className="h-3.5 w-3.5 text-sky-300" />
              {selectedDayFilter === "all"
                ? `ภาพรวมทั้งเดือน (${selectedMonth})`
                : `ข้อมูลวันที่ ${selectedDayFilter} ${selectedMonth}`}
            </span>
          </div>

          <h2 className="mt-1 text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
            <span>{activeTab} All Production Lines Comparison</span>
            <span className="rounded bg-blue-800/80 px-2 py-0.5 text-xs font-bold text-sky-200 border border-blue-700/50">
              {lineSummaries.length} Lines Total
            </span>
          </h2>
          <p className="text-xs text-blue-200/80">
            วิเคราะห์เปรียบเทียบประสิทธิภาพ อัตราการมาทำงาน และภาระชั่วโมงการทำงาน (Man-Hours) แยกตามไลน์ในแผนก
          </p>
        </div>

        {/* Right: Date Selector & High-Level Dept Aggregates */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 rounded-xl border border-blue-700/60 bg-blue-950/60 px-2.5 py-1 text-xs text-blue-200 shadow-sm">
            <span className="text-[11px] font-bold text-blue-300">เลือกดูวัน:</span>
            <select
              aria-label="เลือกวันที่เปรียบเทียบ"
              value={selectedDayFilter}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedDayFilter(val === "all" ? "all" : Number(val));
              }}
              className="cursor-pointer rounded-lg border-0 bg-blue-900 px-2.5 py-1 text-xs font-black text-sky-200 outline-none hover:bg-blue-800 focus:ring-1 focus:ring-sky-400"
            >
              <option value="all">ทั้งเดือน ({displayDays.length} วัน)</option>
              {displayDays.map((d) => (
                <option key={d} value={d}>
                  วันที่ {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4 border-l border-blue-700/40 pl-4">
            <div className="text-right">
              <span className="block text-[10px] uppercase font-bold text-blue-200/70">
                {selectedDayFilter === "all" ? "Total Man-Hours" : "Man-Hours (วัน)"}
              </span>
              <span className="text-xl font-black text-sky-300">
                {selectedDayFilter === "all"
                  ? `${(deptTotal.totalManHours / 1000).toFixed(1)}k`
                  : deptTotal.totalManHours.toLocaleString()}
              </span>
            </div>
            <div className="text-right">
              <span className="block text-[10px] uppercase font-bold text-blue-200/70">
                {selectedDayFilter === "all" ? "Total OT Hours" : "OT Hours (วัน)"}
              </span>
              <span className="text-xl font-black text-amber-300">
                {deptTotal.totalOtHours.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Segmented Controls & Quick Summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="inline-flex items-center gap-1 rounded-xl bg-base-200 p-1 border border-base-300">
          <button
            type="button"
            onClick={() => setLineCategoryFilter("all")}
            className={`px-3 py-1 text-xs font-black rounded-lg transition-all cursor-pointer ${
              lineCategoryFilter === "all"
                ? "bg-base-100 text-primary shadow-sm"
                : "text-base-content/70 hover:text-base-content"
            }`}
          >
            All ({tabLines.length})
          </button>
          <button
            type="button"
            onClick={() => setLineCategoryFilter("summary")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer ${
              lineCategoryFilter === "summary"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-base-content/70 hover:text-indigo-400 hover:bg-base-100/60"
            }`}
          >
            <span>⬡ Summary</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${lineCategoryFilter === "summary" ? "bg-indigo-900 text-white" : "bg-base-300 text-base-content"}`}>
              {summaryCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setLineCategoryFilter("subline")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer ${
              lineCategoryFilter === "subline"
                ? "bg-base-content text-base-100 shadow-sm"
                : "text-base-content/70 hover:text-base-content hover:bg-base-100/60"
            }`}
          >
            <span>⬢ Main Lines</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${lineCategoryFilter === "subline" ? "bg-base-200 text-base-content" : "bg-base-300 text-base-content"}`}>
              {sublineCount}
            </span>
          </button>
          {shiftCount > 0 && (
            <button
              type="button"
              onClick={() => setLineCategoryFilter("shift")}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer ${
                lineCategoryFilter === "shift"
                  ? "bg-sky-600 text-white shadow-sm"
                : "text-base-content/70 hover:text-sky-400 hover:bg-base-100/60"
              }`}
            >
              <span>⏱️ Shifts (A/B/D)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${lineCategoryFilter === "shift" ? "bg-sky-900 text-white" : "bg-base-300 text-base-content"}`}>
                {shiftCount}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-base-content/60 font-semibold mr-1">
            Showing {displayedLineSummaries.length} of {tabLines.length} lines
          </span>
          {onExportTabLines && (
            <button
              type="button"
              onClick={onExportTabLines}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:from-emerald-600 hover:to-teal-700 hover:shadow-md active:scale-95 cursor-pointer"
              title={`ส่งออกข้อมูลตาราง Man-Hour ทั้งหมดในแท็บ ${activeTab} เป็นไฟล์ Excel`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-white" />
              <span>Export {activeTab} (Excel)</span>
            </button>
          )}
        </div>
      </div>

      {/* Modern High-End Line Comparison Matrix Table */}
      <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-base-200 text-base-content font-black uppercase text-[11px] border-b border-base-300">
                <th className="py-3 px-4">Line Name</th>
                <th className="py-3 px-3 text-center">
                  {selectedDayFilter === "all" ? "Avg Register" : "Register"}
                </th>
                <th className="py-3 px-3 text-center">
                  {selectedDayFilter === "all" ? "Avg Present" : "Present"}
                </th>
                <th className="py-3 px-4 text-center">Attendance Rate</th>
                <th className="py-3 px-3 text-center">Leave Rate</th>
                <th className="py-3 px-3 text-center">Normal Hours</th>
                <th className="py-3 px-3 text-center">OT Hours</th>
                <th className="py-3 px-3 text-center">Total Man-Hours</th>
                <th className="py-3 px-3 text-center">Help Net</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300 font-medium text-base-content">
              {displayedLineSummaries.map((item) => (
                <MatrixTableRow
                  key={item.line}
                  item={item}
                  isCurrent={item.line === selectedLine}
                  onSelectLine={onSelectLine}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
