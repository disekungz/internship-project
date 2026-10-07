import React, { useState } from "react";
import { Download, FileSpreadsheet, Search } from "lucide-react";
import { DailyStatusItem } from "../types";

interface P1StatusTableProps {
  days: DailyStatusItem[];
  target: number;
  month: string;
}

export const P1StatusTable: React.FC<P1StatusTableProps> = ({ days, target, month }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredDays = days.filter((d) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      String(d.day).includes(term) ||
      d.date.includes(term) ||
      (d.isHoliday ? "holiday วันหยุด" : "working วันทำงาน").includes(term)
    );
  });

  // คำนวณค่าเฉลี่ยเฉพาะวันทำงาน
  const workingDays = days.filter((d) => d.isWorkingDay && d.total > 0);
  const avgDirect = workingDays.length > 0 ? Math.round(workingDays.reduce((s, d) => s + d.direct, 0) / workingDays.length) : 0;
  const avgIndirect = workingDays.length > 0 ? Math.round(workingDays.reduce((s, d) => s + d.indirect, 0) / workingDays.length) : 0;
  const avgContract = workingDays.length > 0 ? Math.round(workingDays.reduce((s, d) => s + d.contract, 0) / workingDays.length) : 0;
  const avgSubcontract = workingDays.length > 0 ? Math.round(workingDays.reduce((s, d) => s + d.subcontract, 0) / workingDays.length) : 0;
  const avgMou = workingDays.length > 0 ? Math.round(workingDays.reduce((s, d) => s + d.mou, 0) / workingDays.length) : 0;
  const avgTotal = workingDays.length > 0 ? Math.round(workingDays.reduce((s, d) => s + d.total, 0) / workingDays.length) : 0;

  const handleExport = async () => {
    const { exportStyledExcel } = await import("../../../utility/Service/xlxs/exportStyledExcel");

    const exportRows = days.map((d) => ({
      day: d.day,
      date: d.date,
      type: d.isHoliday ? "Holiday" : "Working Day",
      direct: d.direct,
      indirect: d.indirect,
      contract: d.contract,
      subcontract: d.subcontract,
      mou: d.mou,
      total: d.total,
      target: target,
      variance: d.total > 0 ? d.total - target : 0,
      present: d.present,
      absent: d.absent,
    }));

    await exportStyledExcel({
      data: exportRows,
      fileName: `P1_Manpower_Status_${month}`,
      sheetName: `P1_Status_${month}`,
      title: `P1 MANPOWER STATUS (${month})`,
      subtitle: `Target: ${target} persons | Exported: ${new Date().toLocaleString()}`,
      themeColor: "blue",
      showTotalRow: true,
      columnsConfig: [
        { header: "Day", key: "day", width: 8, align: "center" },
        { header: "Date", key: "date", width: 14, align: "center" },
        { header: "Status", key: "type", width: 14, align: "center" },
        { header: "Direct Workers (PRD)", key: "direct", width: 22, align: "center" },
        { header: "In-Direct Workers", key: "indirect", width: 20, align: "center" },
        { header: "Employee Contract (DC)", key: "contract", width: 22, align: "center" },
        { header: "Subcontract (VDS/PIMB)", key: "subcontract", width: 22, align: "center" },
        { header: "MOU", key: "mou", width: 12, align: "center" },
        { header: "Total Manpower", key: "total", width: 18, align: "center" },
        { header: "Target", key: "target", width: 12, align: "center" },
        { header: "Variance (+/-)", key: "variance", width: 14, align: "center" },
        { header: "Present", key: "present", width: 12, align: "center" },
        { header: "Absent", key: "absent", width: 12, align: "center" },
      ],
    });
  };

  const dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="w-full rounded-2xl bg-base-100 p-4 shadow-md border border-base-300 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-200 pb-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-sm sm:text-base font-black text-base-content">
            Daily Manpower Breakdown Matrix
          </h2>
          <span className="rounded-full bg-base-200 px-2.5 py-0.5 text-xs font-bold text-base-content/70">
            {filteredDays.length} Days
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-base-content/40" />
            <input
              type="text"
              placeholder="Search day / status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-44 rounded-xl border border-base-300 bg-base-200 pl-8 pr-3 text-xs font-medium text-base-content outline-none focus:border-blue-500 focus:bg-base-100 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white hover:bg-emerald-700 shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Download size={14} />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center text-xs">
          <thead>
            <tr className="border-b border-base-300 bg-base-200/80 font-black text-base-content/80">
              <th className="py-2.5 px-3 text-center align-middle">Day</th>
              <th className="py-2.5 px-3 text-center align-middle">Date</th>
              <th className="py-2.5 px-3 text-center align-middle">Type</th>
              <th className="py-2.5 px-3 text-center align-middle text-purple-600 dark:text-purple-400">Direct Workers</th>
              <th className="py-2.5 px-3 text-center align-middle text-rose-600 dark:text-rose-400">In-Direct</th>
              <th className="py-2.5 px-3 text-center align-middle text-emerald-600 dark:text-emerald-400">Contract (DC)</th>
              <th className="py-2.5 px-3 text-center align-middle text-amber-600 dark:text-amber-400">Subcontract</th>
              <th className="py-2.5 px-3 text-center align-middle text-pink-600 dark:text-pink-400">MOU</th>
              <th className="py-2.5 px-3 text-center align-middle font-black text-base-content bg-base-300/40">Total</th>
              <th className="py-2.5 px-3 text-center align-middle text-blue-600 dark:text-blue-400">Target</th>
              <th className="py-2.5 px-3 text-center align-middle">Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-200">
            {filteredDays.map((d) => {
              const dayName = dayNamesShort[d.dayOfWeek];
              const isHol = d.isHoliday;
              const variance = d.total > 0 ? d.total - target : 0;

              return (
                <tr
                  key={d.day}
                  className={`hover:bg-primary/5 transition-colors ${
                    isHol ? "bg-rose-500/5 text-base-content/50" : "text-base-content"
                  }`}
                >
                  <td className="py-2 px-3 text-center align-middle font-black">{d.day}</td>
                  <td className="py-2 px-3 text-center align-middle font-medium whitespace-nowrap">
                    {d.date} <span className="text-[10px] text-base-content/40">({dayName})</span>
                  </td>
                  <td className="py-2 px-3 text-center align-middle">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isHol
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                      }`}
                    >
                      {isHol ? "Holiday" : "Working"}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center align-middle font-semibold text-purple-600 dark:text-purple-300">
                    {d.direct > 0 ? d.direct.toLocaleString() : "-"}
                  </td>
                  <td className="py-2 px-3 text-center align-middle font-semibold text-rose-600 dark:text-rose-300">
                    {d.indirect > 0 ? d.indirect.toLocaleString() : "-"}
                  </td>
                  <td className="py-2 px-3 text-center align-middle font-semibold text-emerald-600 dark:text-emerald-300">
                    {d.contract > 0 ? d.contract.toLocaleString() : "-"}
                  </td>
                  <td className="py-2 px-3 text-center align-middle font-semibold text-amber-600 dark:text-amber-300">
                    {d.subcontract > 0 ? d.subcontract.toLocaleString() : "-"}
                  </td>
                  <td className="py-2 px-3 text-center align-middle font-semibold text-pink-600 dark:text-pink-300">
                    {d.mou > 0 ? d.mou.toLocaleString() : "-"}
                  </td>
                  <td className="py-2 px-3 text-center align-middle font-black text-base-content bg-base-300/20">
                    {d.total > 0 ? (
                      <span className="rounded px-2 py-0.5 bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold border border-teal-500/30 inline-block">
                        {d.total.toLocaleString()}
                      </span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className="py-2 px-3 text-center align-middle font-semibold text-blue-600 dark:text-blue-400">
                    {target.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-center align-middle font-bold whitespace-nowrap">
                    {d.total > 0 ? (
                      <span
                        className={
                          variance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }
                      >
                        {variance >= 0 ? `+${variance}` : variance}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-base-300 bg-base-200/90 font-black text-base-content">
              <td colSpan={3} className="py-3 px-3 text-center align-middle">
                Average (Working Days)
              </td>
              <td className="py-3 px-3 text-center align-middle text-purple-600 dark:text-purple-300 font-black">
                {avgDirect.toLocaleString()}
              </td>
              <td className="py-3 px-3 text-center align-middle text-rose-600 dark:text-rose-300 font-black">
                {avgIndirect.toLocaleString()}
              </td>
              <td className="py-3 px-3 text-center align-middle text-emerald-600 dark:text-emerald-300 font-black">
                {avgContract.toLocaleString()}
              </td>
              <td className="py-3 px-3 text-center align-middle text-amber-600 dark:text-amber-300 font-black">
                {avgSubcontract.toLocaleString()}
              </td>
              <td className="py-3 px-3 text-center align-middle text-pink-600 dark:text-pink-300 font-black">
                {avgMou.toLocaleString()}
              </td>
              <td className="py-3 px-3 text-center align-middle font-black text-teal-700 dark:text-teal-300 bg-teal-500/15">
                {avgTotal.toLocaleString()}
              </td>
              <td className="py-3 px-3 text-center align-middle text-blue-600 dark:text-blue-400 font-black">
                {target.toLocaleString()}
              </td>
              <td className="py-3 px-3 text-center align-middle font-black">
                {avgTotal > 0 ? (
                  <span
                    className={
                      avgTotal - target >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }
                  >
                    {avgTotal - target >= 0 ? `+${avgTotal - target}` : avgTotal - target}
                  </span>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
