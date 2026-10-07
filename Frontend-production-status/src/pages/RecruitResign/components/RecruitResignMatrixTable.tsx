import React from "react";
import { DayItem } from "../types";

interface Props {
  activeGroup: string;
  daysData: DayItem[];
}

export const RecruitResignMatrixTable: React.FC<Props> = ({ activeGroup, daysData }) => {
  const getColBg = (d: DayItem) => {
    const isSun = d.dayOfWeek === 0 || d.isHoliday;
    const isSat = d.dayOfWeek === 6;
    if (isSun) return "bg-[#fce4d6]/60";
    if (isSat) return "bg-[#fce4d6]/40";
    return "";
  };

  const getMonthShort = (dateStr: string) => {
    try {
      const dt = new Date(`${dateStr}T00:00:00`);
      return dt.toLocaleDateString("en-US", { month: "short" });
    } catch {
      return "Sep";
    }
  };

  const fmt = (hasData: boolean | undefined, val: number | string | null | undefined, isPercent = false) => {
    if (!hasData) return "-";
    if (val === undefined || val === null) return "-";
    if (isPercent) {
      const num = Number(val);
      return isNaN(num) ? "-" : `${num.toFixed(1)}%`;
    }
    return val;
  };

  return (
    <div className="rounded-2xl border border-slate-300 bg-white shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-center text-[10px] sm:text-[11px] select-none table-fixed border-separate border-spacing-0 border-l border-t border-slate-300">
          <thead>
            {/* Header วันที่: พร้อมตัวอักษรสีแดง/ดำ และไฮไลท์วันหยุด */}
            <tr className="border-b border-slate-300 border-t">
              <th
                colSpan={2}
                className="sticky left-0 z-30 bg-[#002060] text-white py-1.5 px-2 text-left font-black text-xs sm:text-sm tracking-wide border-r-2 border-r-slate-500 w-[180px] min-w-[150px]"
              >
                {activeGroup} Only
              </th>
              {daysData.map((d) => {
                const monthShort = getMonthShort(d.date);
                const isSun = d.dayOfWeek === 0 || d.isHoliday;
                const isSat = d.dayOfWeek === 6;

                let headerBg = "bg-[#c6efce] text-red-600";
                if (isSun) headerBg = "bg-[#f8cbdf] text-red-700 font-black";
                else if (isSat) headerBg = "bg-[#c6efce] text-red-600 font-black";

                return (
                  <th
                    key={d.day}
                    className={`py-1 px-0.5 font-black border-r border-slate-300 ${headerBg}`}
                  >
                    <div className="leading-tight font-black text-[10px] sm:text-[11px]">{d.day}-{monthShort}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="text-slate-900 font-normal divide-y divide-slate-300">
            {/* ========================================================= */}
            {/* 1. INDIRECT 1                                             */}
            {/* ========================================================= */}
            <tr>
              <td
                rowSpan={5}
                className="sticky left-0 z-20 bg-slate-200/90 py-2 px-1 text-left align-top font-black text-slate-900 border-r border-slate-300 w-[95px] min-w-[90px]"
              >
                Indirect 1
                <span className="block text-[9px] font-semibold text-slate-500 mt-0.5 leading-tight">
                  HR,ACCT,STR<br />
                  SE,SHE,AUT,PLN,<br />
                  PTE,FPS,NPM,QA
                </span>
              </td>
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-semibold text-slate-800 border-r-2 border-r-slate-500 w-[85px] min-w-[80px]">
                Manpower
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 ${getColBg(d)}`}>
                  {fmt(d.hasData, d.categories.ind1.mp)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-semibold text-slate-800 border-r-2 border-r-slate-500">
                Man-Attend
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 ${getColBg(d)}`}>
                  {fmt(d.hasData, d.categories.ind1.attend)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-semibold text-slate-800 border-r-2 border-r-slate-500">
                Man-OT
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 ${getColBg(d)}`}>
                  {fmt(d.hasData, d.categories.ind1.ot)}
                </td>
              ))}
            </tr>
            <tr className="border-t border-slate-300">
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-bold text-blue-700 border-r-2 border-r-slate-500">
                OT%
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 font-semibold text-blue-700 ${getColBg(d)}`}>
                  {d.hasData && d.categories.ind1.attend > 0 ? fmt(d.hasData, d.categories.ind1.otPct, true) : "-"}
                </td>
              ))}
            </tr>
            <tr className="border-b-2 border-black">
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-black text-black border-r-2 border-r-slate-500">
                Acc
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 font-black text-black ${getColBg(d)}`}>
                  {d.hasData && d.categories.ind1.accOtPct !== undefined ? fmt(d.hasData, d.categories.ind1.accOtPct, true) : "-"}
                </td>
              ))}
            </tr>

            {/* ========================================================= */}
            {/* 2. INDIRECT 2                                             */}
            {/* ========================================================= */}
            <tr>
              <td
                rowSpan={5}
                className="sticky left-0 z-20 bg-slate-200/90 py-2 px-1 text-left align-top font-black text-slate-900 border-r border-slate-300 w-[95px] min-w-[90px]"
              >
                Indirect 2
                <span className="block text-[9px] font-semibold text-slate-500 mt-0.5 leading-tight">
                  LOG,DIE,FIX,MAT,<br />
                  TECH,TSTE
                </span>
              </td>
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-semibold text-slate-800 border-r-2 border-r-slate-500">
                Manpower
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 ${getColBg(d)}`}>
                  {fmt(d.hasData, d.categories.ind2.mp)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-semibold text-slate-800 border-r-2 border-r-slate-500">
                Man-Attend
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 ${getColBg(d)}`}>
                  {fmt(d.hasData, d.categories.ind2.attend)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-semibold text-slate-800 border-r-2 border-r-slate-500">
                Man-OT
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 ${getColBg(d)}`}>
                  {fmt(d.hasData, d.categories.ind2.ot)}
                </td>
              ))}
            </tr>
            <tr className="border-t border-slate-300">
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-bold text-blue-700 border-r-2 border-r-slate-500">
                OT%
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 font-semibold text-blue-700 ${getColBg(d)}`}>
                  {d.hasData && d.categories.ind2.attend > 0 ? fmt(d.hasData, d.categories.ind2.otPct, true) : "-"}
                </td>
              ))}
            </tr>
            <tr className="border-b-2 border-black">
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-black text-black border-r-2 border-r-slate-500">
                Acc
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 font-black text-black ${getColBg(d)}`}>
                  {d.hasData && d.categories.ind2.accOtPct !== undefined ? fmt(d.hasData, d.categories.ind2.accOtPct, true) : "-"}
                </td>
              ))}
            </tr>

            {/* ========================================================= */}
            {/* TOTAL INDIRECT (รวม)                                       */}
            {/* ========================================================= */}
            <tr>
              <td
                rowSpan={5}
                className="sticky left-0 z-20 bg-white py-2 px-1 text-left align-middle font-black text-black border-r border-slate-300 w-[95px] min-w-[90px]"
              >
                Total Indirect
              </td>
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-semibold text-slate-800 border-r-2 border-r-slate-500">
                Manpower
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 ${getColBg(d)}`}>
                  {fmt(d.hasData, d.categories.totInd.mp)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-semibold text-slate-800 border-r-2 border-r-slate-500">
                Man-Attend
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 ${getColBg(d)}`}>
                  {fmt(d.hasData, d.categories.totInd.attend)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-semibold text-slate-800 border-r-2 border-r-slate-500">
                Man-OT
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 ${getColBg(d)}`}>
                  {fmt(d.hasData, d.categories.totInd.ot)}
                </td>
              ))}
            </tr>
            <tr className="border-t border-slate-300">
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-bold text-blue-700 border-r-2 border-r-slate-500">
                OT%
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 font-semibold text-blue-700 ${getColBg(d)}`}>
                  {d.hasData && d.categories.totInd.attend > 0 ? fmt(d.hasData, d.categories.totInd.otPct, true) : "-"}
                </td>
              ))}
            </tr>
            <tr className="border-b-[3px] border-black">
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-black text-black border-r-2 border-r-slate-500">
                Acc
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 font-black text-black ${getColBg(d)}`}>
                  {d.hasData && d.categories.totInd.accOtPct !== undefined ? fmt(d.hasData, d.categories.totInd.accOtPct, true) : "-"}
                </td>
              ))}
            </tr>

            {/* ========================================================= */}
            {/* 3. DIRECT 1 (FPC)                                         */}
            {/* ========================================================= */}
            <tr>
              <td
                rowSpan={5}
                className="sticky left-0 z-20 bg-slate-200/90 py-2 px-1 text-left align-top font-black text-slate-900 border-r border-slate-300 w-[95px] min-w-[90px]"
              >
                Direct
                <span className="block text-[10px] font-bold text-slate-600 mt-0.5">
                  FPC
                </span>
              </td>
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-semibold text-slate-800 border-r-2 border-r-slate-500">
                Manpower
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 ${getColBg(d)}`}>
                  {fmt(d.hasData, d.categories.dir1.mp)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-semibold text-slate-800 border-r-2 border-r-slate-500">
                Man-Attend
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 ${getColBg(d)}`}>
                  {fmt(d.hasData, d.categories.dir1.attend)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-semibold text-slate-800 border-r-2 border-r-slate-500">
                Man-OT
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 ${getColBg(d)}`}>
                  {fmt(d.hasData, d.categories.dir1.ot)}
                </td>
              ))}
            </tr>
            <tr className="border-t border-slate-300">
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-bold text-blue-700 border-r-2 border-r-slate-500">
                OT%
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 font-semibold text-blue-700 ${getColBg(d)}`}>
                  {d.hasData && d.categories.dir1.attend > 0 ? fmt(d.hasData, d.categories.dir1.otPct, true) : "-"}
                </td>
              ))}
            </tr>
            <tr className="border-b-2 border-black">
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-black text-black border-r-2 border-r-slate-500">
                Acc
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 font-black text-black ${getColBg(d)}`}>
                  {d.hasData && d.categories.dir1.accOtPct !== undefined ? fmt(d.hasData, d.categories.dir1.accOtPct, true) : "-"}
                </td>
              ))}
            </tr>

            {/* ========================================================= */}
            {/* 4. DIRECT 2 (SMT_F, SMT_B)                                */}
            {/* ========================================================= */}
            <tr>
              <td
                rowSpan={5}
                className="sticky left-0 z-20 bg-slate-200/90 py-2 px-1 text-left align-top font-black text-slate-900 border-r border-slate-300 w-[95px] min-w-[90px]"
              >
                Direct
                <span className="block text-[10px] font-bold text-slate-600 mt-0.5">
                  SMT_F, SMT_B
                </span>
              </td>
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-semibold text-slate-800 border-r-2 border-r-slate-500">
                Manpower
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 ${getColBg(d)}`}>
                  {fmt(d.hasData, d.categories.dir2.mp)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-semibold text-slate-800 border-r-2 border-r-slate-500">
                Man-Attend
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 ${getColBg(d)}`}>
                  {fmt(d.hasData, d.categories.dir2.attend)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-semibold text-slate-800 border-r-2 border-r-slate-500">
                Man-OT
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 ${getColBg(d)}`}>
                  {fmt(d.hasData, d.categories.dir2.ot)}
                </td>
              ))}
            </tr>
            <tr className="border-t border-slate-300">
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-bold text-blue-700 border-r-2 border-r-slate-500">
                OT%
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 font-semibold text-blue-700 ${getColBg(d)}`}>
                  {d.hasData && d.categories.dir2.attend > 0 ? fmt(d.hasData, d.categories.dir2.otPct, true) : "-"}
                </td>
              ))}
            </tr>
            <tr className="border-b-2 border-black">
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-black text-black border-r-2 border-r-slate-500">
                Acc
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 font-black text-black ${getColBg(d)}`}>
                  {d.hasData && d.categories.dir2.accOtPct !== undefined ? fmt(d.hasData, d.categories.dir2.accOtPct, true) : "-"}
                </td>
              ))}
            </tr>

            {/* ========================================================= */}
            {/* TOTAL DIRECT (รวม)                                         */}
            {/* ========================================================= */}
            <tr>
              <td
                rowSpan={5}
                className="sticky left-0 z-20 bg-white py-2 px-1 text-left align-middle font-black text-black border-r border-slate-300 w-[95px] min-w-[90px]"
              >
                Total Direct
              </td>
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-semibold text-slate-800 border-r-2 border-r-slate-500">
                Manpower
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 ${getColBg(d)}`}>
                  {fmt(d.hasData, d.categories.totDir.mp)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-semibold text-slate-800 border-r-2 border-r-slate-500">
                Man-Attend
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 ${getColBg(d)}`}>
                  {fmt(d.hasData, d.categories.totDir.attend)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-semibold text-slate-800 border-r-2 border-r-slate-500">
                Man-OT
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 ${getColBg(d)}`}>
                  {fmt(d.hasData, d.categories.totDir.ot)}
                </td>
              ))}
            </tr>
            <tr className="border-t border-slate-300">
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-bold text-blue-700 border-r-2 border-r-slate-500">
                OT%
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 font-semibold text-blue-700 ${getColBg(d)}`}>
                  {d.hasData && d.categories.totDir.attend > 0 ? fmt(d.hasData, d.categories.totDir.otPct, true) : "-"}
                </td>
              ))}
            </tr>
            <tr className="border-b-[3px] border-black">
              <td className="sticky left-[95px] z-20 bg-white py-1 px-1 text-left font-black text-black border-r-2 border-r-slate-500">
                Acc
              </td>
              {daysData.map((d) => (
                <td key={d.day} className={`py-1 px-0.5 border-r border-slate-300 font-black text-black ${getColBg(d)}`}>
                  {d.hasData && d.categories.totDir.accOtPct !== undefined ? fmt(d.hasData, d.categories.totDir.accOtPct, true) : "-"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
