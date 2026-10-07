import React, { useState, useEffect } from "react";
import { DayItem } from "../types";
import { TrendingUp, Edit3, Save, Check, X } from "lucide-react";
import Swal from "sweetalert2";
import { saveRecruitResignEntries } from "../api/recruitResignApi";

interface Props {
  activeGroup: string;
  month: string;
  daysData: DayItem[];
  initialBalance?: number | null;
  onReload: () => void;
}

export const RecruitResignDailyTable: React.FC<Props> = ({
  activeGroup,
  month,
  daysData,
  initialBalance,
  onReload,
}) => {
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [editValues, setEditValues] = useState<{ [day: number]: { recruit: number; resign: number } }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init: { [day: number]: { recruit: number; resign: number } } = {};
    daysData.forEach((d) => {
      init[d.day] = {
        recruit: d.recruit || 0,
        resign: d.resign || 0,
      };
    });
    setEditValues(init);
  }, [daysData]);

  const getDayName = (dateStr: string) => {
    try {
      const dt = new Date(`${dateStr}T00:00:00`);
      return dt.toLocaleDateString("en-US", { weekday: "short" });
    } catch {
      return "";
    }
  };

  const getMonthShort = (dateStr: string) => {
    try {
      const dt = new Date(`${dateStr}T00:00:00`);
      return dt.toLocaleDateString("en-US", { month: "short" });
    } catch {
      return "Sep";
    }
  };

  const handleCellChange = (day: number, field: "recruit" | "resign", val: string) => {
    // ลบเลข 0 นำหน้าอัตโนมัติ เช่น '01' -> '1'
    const digitsOnly = val.replace(/\D/g, "");
    const cleanVal = digitsOnly.replace(/^0+(?=\d)/, "");
    const num = cleanVal === "" ? 0 : Math.max(0, parseInt(cleanVal, 10) || 0);

    setEditValues((prev) => ({
      ...prev,
      [day]: {
        ...(prev[day] || { recruit: 0, resign: 0 }),
        [field]: num,
      },
    }));
  };

  const handleSaveInline = async () => {
    setSaving(true);
    try {
      let runningBalance = initialBalance ?? (daysData[0]?.accRecruit || (activeGroup === "MPS" ? 212 : 100));
      const entries = daysData
        .filter((d) => d.hasData || ((editValues[d.day]?.recruit || 0) > 0 || (editValues[d.day]?.resign || 0) > 0))
        .map((d) => {
          const cur = editValues[d.day] || { recruit: d.recruit || 0, resign: d.resign || 0 };
          runningBalance = runningBalance + cur.recruit - cur.resign;
          return {
            day: d.day,
            recruit: cur.recruit,
            resign: cur.resign,
            accRecruit: Math.max(0, runningBalance),
          };
        });

      const res = await saveRecruitResignEntries({
        month,
        group: activeGroup,
        initialBalance: initialBalance ?? (daysData[0]?.accRecruit || (activeGroup === "MPS" ? 212 : 100)),
        entries,
      });

      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: "บันทึกเรียบร้อย!",
          text: `อัปเดตข้อมูล Recruit & Resign (${activeGroup}) สำเร็จ`,
          timer: 1200,
          showConfirmButton: false,
        });
        setIsInlineEditing(false);
        onReload();
      } else {
        throw new Error(res.error || "Save failed");
      }
    } catch (err: any) {
      console.error("Error saving inline edit:", err);
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาดในการบันทึก",
        text: err.message || "ไม่สามารถบันทึกข้อมูลได้",
      });
    } finally {
      setSaving(false);
    }
  };

  // Preview live computed balances for inline editing
  let runningBal = initialBalance ?? (daysData[0]?.accRecruit || (activeGroup === "MPS" ? 212 : 100));
  const liveRowData = daysData.map((d) => {
    if (!isInlineEditing) return d;
    const cur = editValues[d.day] || { recruit: d.recruit || 0, resign: d.resign || 0 };
    runningBal = runningBal + cur.recruit - cur.resign;
    const bal = Math.max(0, runningBal);
    const ratio = bal > 0 ? (cur.resign / bal) * 100 : 0;
    return {
      ...d,
      recruit: cur.recruit,
      resign: cur.resign,
      accRecruit: bal,
      resignRatio: ratio,
    };
  });

  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-base-300 bg-base-200/60 gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-600 dark:text-blue-400" />
          <h3 className="text-xs font-black text-base-content uppercase tracking-tight">
            Recruit & Resign Daily Summary ({activeGroup})
          </h3>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isInlineEditing ? (
            <>
              <button
                type="button"
                onClick={() => setIsInlineEditing(false)}
                className="flex items-center gap-1 rounded-xl bg-base-300 px-3 py-1 text-xs font-bold text-base-content hover:bg-base-200 transition cursor-pointer"
              >
                <X size={13} />
                <span>ยกเลิก</span>
              </button>
              <button
                type="button"
                onClick={handleSaveInline}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1 text-xs font-black text-white shadow-sm hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
              >
                <Save size={13} className={saving ? "animate-spin" : ""} />
                <span>{saving ? "กำลังบันทึก..." : "บันทึกในตาราง (Save)"}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsInlineEditing(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 px-3.5 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 shadow-sm transition cursor-pointer"
              title="คลิกเพื่อแก้ไขตัวเลข Recruit / Resign ในตารางโดยตรง"
            >
              <Edit3 size={13} className="text-blue-600 dark:text-blue-400" />
              <span>แก้ไขในตาราง (Inline)</span>
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-center text-[10.5px] sm:text-xs border-collapse table-fixed border border-base-300">
          <thead>
            <tr className="border-b border-base-300">
              <th className="sticky left-0 z-20 bg-[#193886] text-white py-1 px-2 border-r-2 border-r-base-300 text-center font-black w-[90px] min-w-[85px]">
                MP
              </th>
              {liveRowData.map((d) => {
                const dayName = getDayName(d.date);
                const monthShort = getMonthShort(d.date);
                const isSun = d.dayOfWeek === 0 || d.isHoliday;
                const isSat = d.dayOfWeek === 6;

                let headerBg = "bg-blue-600/20 text-blue-800 dark:text-blue-300";
                if (isSun) headerBg = "bg-rose-500/20 text-rose-700 dark:text-rose-300 font-black";
                else if (isSat) headerBg = "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-black";

                return (
                  <th
                    key={d.day}
                    className={`py-1 px-0.5 border-r border-base-300 select-none ${headerBg}`}
                  >
                    <div className="text-[9px] font-semibold opacity-90 leading-tight">{dayName}</div>
                    <div className="text-[10px] font-bold leading-tight">{d.day}-{monthShort}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-base-300 font-bold">
            {/* Recruit (person) */}
            <tr className="hover:bg-primary/5 bg-base-100">
              <td className="sticky left-0 z-10 bg-base-200 py-1 px-2 border-r-2 border-r-base-300 text-left font-bold text-base-content text-[10.5px]">
                Recruit
              </td>
              {liveRowData.map((d) => (
                <td
                  key={d.day}
                  className={`py-1 px-0.5 border-r border-base-300 font-bold ${
                    d.recruit !== null && d.recruit > 0 ? "bg-blue-500/15 font-black text-blue-600 dark:text-blue-400" : "text-base-content/70"
                  }`}
                >
                  {isInlineEditing ? (
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="0"
                      value={editValues[d.day]?.recruit ? String(editValues[d.day]?.recruit) : ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleCellChange(d.day, "recruit", e.target.value)}
                      className="w-full text-center bg-base-100 border border-blue-500/40 rounded py-0.5 font-bold text-blue-600 dark:text-blue-400 placeholder-base-content/30 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner text-xs"
                    />
                  ) : (
                    d.hasData && d.recruit !== null ? d.recruit : "-"
                  )}
                </td>
              ))}
            </tr>

            {/* Acc. Recruit / Balance */}
            <tr className="bg-base-200/40 hover:bg-primary/5">
              <td className="sticky left-0 z-10 bg-base-200 py-1.5 px-2 border-r-2 border-r-base-300 text-left font-black text-blue-600 dark:text-blue-400 text-[11px]">
                {activeGroup}
              </td>
              {liveRowData.map((d) => (
                <td key={d.day} className="py-1 px-0.5 border-r border-base-300 font-bold text-base-content">
                  {d.hasData && d.accRecruit !== null ? d.accRecruit : "-"}
                </td>
              ))}
            </tr>

            {/* Resign (person) */}
            <tr className="bg-rose-500/5 hover:bg-rose-500/10">
              <td className="sticky left-0 z-10 bg-rose-500/15 py-1 px-2 border-r-2 border-r-base-300 text-left font-bold text-rose-700 dark:text-rose-400 text-[10.5px]">
                Resign
              </td>
              {liveRowData.map((d) => (
                <td
                  key={d.day}
                  className={`py-1 px-0.5 border-r border-base-300 ${
                    d.resign !== null && d.resign > 0 ? "bg-rose-500/20 font-black text-rose-600 dark:text-rose-400" : "text-base-content/70"
                  }`}
                >
                  {isInlineEditing ? (
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="0"
                      value={editValues[d.day]?.resign ? String(editValues[d.day]?.resign) : ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleCellChange(d.day, "resign", e.target.value)}
                      className="w-full text-center bg-base-100 border border-rose-500/40 rounded py-0.5 font-bold text-rose-600 dark:text-rose-400 placeholder-base-content/30 focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-inner text-xs"
                    />
                  ) : (
                    d.hasData && d.resign !== null ? d.resign : "-"
                  )}
                </td>
              ))}
            </tr>

            {/* Resign Ratio (%) */}
            <tr className="bg-base-200/20 hover:bg-base-200/40">
              <td className="sticky left-0 z-10 bg-base-200 py-1 px-2 border-r-2 border-r-base-300 text-left font-bold text-base-content/70 text-[10px]">
                % Turnover
              </td>
              {liveRowData.map((d) => (
                <td
                  key={d.day}
                  className={`py-1 px-0.5 border-r border-base-300 text-[10px] font-semibold ${
                    d.hasData && d.resignRatio !== null && d.resignRatio > 0 ? "font-black text-rose-600 dark:text-rose-400" : "text-base-content/60"
                  }`}
                >
                  {d.hasData && d.resignRatio !== null ? `${d.resignRatio.toFixed(1)}%` : "-"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
