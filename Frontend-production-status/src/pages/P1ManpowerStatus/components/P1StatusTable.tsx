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
    <div className="w-full rounded-2xl bg-white p-4 shadow-md border border-slate-200 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-blue-600" />
          <h2 className="text-sm sm:text-base font-black text-slate-800">
            Daily Manpower Breakdown Matrix
          </h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
            {filteredDays.length} Days
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search day / status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-44 rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500"
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
            <tr className="border-b border-slate-200 bg-slate-50/80 font-black text-slate-600">
              <th className="py-2.5 px-3 text-center align-middle">Day</th>
              <th className="py-2.5 px-3 text-center align-middle">Date</th>
              <th className="py-2.5 px-3 text-center align-middle">Type</th>
              <th className="py-2.5 px-3 text-center align-middle text-purple-700">Direct Workers</th>
              <th className="py-2.5 px-3 text-center align-middle text-rose-700">In-Direct</th>
              <th className="py-2.5 px-3 text-center align-middle text-emerald-700">Contract (DC)</th>
              <th className="py-2.5 px-3 text-center align-middle text-amber-700">Subcontract</th>
              <th className="py-2.5 px-3 text-center align-middle text-pink-700">MOU</th>
              <th className="py-2.5 px-3 text-center align-middle font-black text-slate-900 bg-slate-100/70">Total</th>
              <th className="py-2.5 px-3 text-center align-middle text-blue-600">Target</th>
              <th className="py-2.5 px-3 text-center align-middle">Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredDays.map((d) => {
              const dayName = dayNamesShort[d.dayOfWeek];
              const isHol = d.isHoliday;
              const variance = d.total > 0 ? d.total - target : 0;

              return (
                <tr
                  key={d.day}
                  className={`hover:bg-blue-50/40 transition-colors ${
                    isHol ? "bg-slate-50/50 text-slate-400" : "text-slate-700"
                  }`}
                >
                  <td className="py-2 px-3 text-center align-middle font-black">{d.day}</td>
                  <td className="py-2 px-3 text-center align-middle font-medium whitespace-nowrap">
                    {d.date} <span className="text-[10px] text-slate-400">({dayName})</span>
                  </td>
                  <td className="py-2 px-3 text-center align-middle">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isHol
                          ? "bg-rose-100 text-rose-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {isHol ? "Holiday" : "Working"}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center align-middle font-semibold text-purple-900">
                    {d.direct > 0 ? d.direct.toLocaleString() : "-"}
                  </td>
                  <td className="py-2 px-3 text-center align-middle font-semibold text-rose-900">
                    {d.indirect > 0 ? d.indirect.toLocaleString() : "-"}
                  </td>
                  <td className="py-2 px-3 text-center align-middle font-semibold text-emerald-900">
                    {d.contract > 0 ? d.contract.toLocaleString() : "-"}
                  </td>
                  <td className="py-2 px-3 text-center align-middle font-semibold text-amber-900">
                    {d.subcontract > 0 ? d.subcontract.toLocaleString() : "-"}
                  </td>
                  <td className="py-2 px-3 text-center align-middle font-semibold text-pink-900">
                    {d.mou > 0 ? d.mou.toLocaleString() : "-"}
                  </td>
                  <td className="py-2 px-3 text-center align-middle font-black text-slate-900 bg-slate-100/50">
                    {d.total > 0 ? (
                      <span className="rounded px-2 py-0.5 bg-teal-50 text-teal-800 font-bold border border-teal-200 inline-block">
                        {d.total.toLocaleString()}
                      </span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className="py-2 px-3 text-center align-middle font-semibold text-blue-700">
                    {target.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-center align-middle font-bold whitespace-nowrap">
                    {d.total > 0 ? (
                      <span
                        className={
                          variance >= 0 ? "text-emerald-600" : "text-rose-600"
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
            <tr className="border-t-2 border-slate-300 bg-slate-100/90 font-black text-slate-800">
              <td colSpan={3} className="py-3 px-3 text-center align-middle">
                Average (Working Days)
              </td>
              <td className="py-3 px-3 text-center align-middle text-purple-900 font-black">
                {avgDirect.toLocaleString()}
              </td>
              <td className="py-3 px-3 text-center align-middle text-rose-900 font-black">
                {avgIndirect.toLocaleString()}
              </td>
              <td className="py-3 px-3 text-center align-middle text-emerald-900 font-black">
                {avgContract.toLocaleString()}
              </td>
              <td className="py-3 px-3 text-center align-middle text-amber-900 font-black">
                {avgSubcontract.toLocaleString()}
              </td>
              <td className="py-3 px-3 text-center align-middle text-pink-900 font-black">
                {avgMou.toLocaleString()}
              </td>
              <td className="py-3 px-3 text-center align-middle font-black text-teal-900 bg-teal-100/60">
                {avgTotal.toLocaleString()}
              </td>
              <td className="py-3 px-3 text-center align-middle text-blue-700 font-black">
                {target.toLocaleString()}
              </td>
              <td className="py-3 px-3 text-center align-middle font-black">
                {avgTotal > 0 ? (
                  <span
                    className={
                      avgTotal - target >= 0 ? "text-emerald-600" : "text-rose-600"
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
