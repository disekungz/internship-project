import React from "react";

interface DailyMatrixTableProps {
  blocks: string[];
  rows: any[];
  groupSummaries: Record<string, any>;
  totalP1: Record<string, any>;
}

export const DailyMatrixTable: React.FC<DailyMatrixTableProps> = ({
  blocks,
  rows,
  groupSummaries,
  totalP1,
}) => {
  const BLOCK_COLORS: Record<string, { headerBg: string; text: string; bgLight: string; bgSum: string }> = {
    P1: { headerBg: "bg-[#002060]", text: "text-white", bgLight: "bg-blue-50/50", bgSum: "bg-[#B8CCE4]/60" },
    PER: { headerBg: "bg-[#76933C]", text: "text-white", bgLight: "bg-emerald-50/40", bgSum: "bg-[#D8E4BC]/70" },
    SUB: { headerBg: "bg-[#002060]", text: "text-white", bgLight: "bg-sky-50/40", bgSum: "bg-[#B8CCE4]/70" },
    MOU: { headerBg: "bg-[#7030A0]", text: "text-white", bgLight: "bg-purple-50/30", bgSum: "bg-[#CCC0DA]/60" },
    DC: { headerBg: "bg-[#2F5597]", text: "text-white", bgLight: "bg-slate-50/50", bgSum: "bg-[#B8CCE4]/70" },
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h2 className="text-base sm:text-lg font-black text-slate-800">
         Summary Table of Manpower and Proportions by Department
        </h2>
        <p className="text-xs text-slate-500 font-medium">
          แจกแจงยอดพนักงาน (MP, Work, Leave, OT) และสัดส่วน % แยกตามกลุ่มโรงงาน (P1, PER, SUB, MOU, DC)
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-xs text-right border-collapse whitespace-nowrap">
          {/* Header Rows */}
          <thead className="sticky top-0 z-20 shadow-xs">
            {/* Row 1: Block Names */}
            <tr>
              <th rowSpan={2} className="sticky left-0 z-30 min-w-[110px] bg-[#1F497D] text-white font-black py-2.5 px-3 text-left border-r border-slate-300">
                Dept
              </th>
              <th rowSpan={2} className="sticky left-[110px] z-30 min-w-[70px] bg-[#1F497D] text-white font-black py-2.5 px-2 text-center border-r border-slate-300">
                COC
              </th>

              {blocks.map((blk) => {
                const conf = BLOCK_COLORS[blk] || BLOCK_COLORS.P1;
                return (
                  <th
                    key={blk}
                    colSpan={blk === 'P1' ? 6 : 10}
                    className={`${conf.headerBg} ${conf.text} font-black py-2 px-2 text-center border-r border-white/20`}
                  >
                    {blk}
                  </th>
                );
              })}
            </tr>

            {/* Row 2: Metric Names */}
            <tr className="border-b border-slate-300">
              {blocks.map((blk) => {
                const conf = BLOCK_COLORS[blk] || BLOCK_COLORS.P1;
                if (blk === 'P1') {
                  return (
                    <React.Fragment key={`${blk}-sub`}>
                      <th className={`${conf.bgSum} font-black py-1.5 px-2 text-slate-900 border-r border-slate-200`}>Sum MP</th>
                      <th className={`${conf.bgSum} font-black py-1.5 px-2 text-slate-900 border-r border-slate-200`}>Sum Work</th>
                      <th className={`${conf.bgSum} font-black py-1.5 px-2 text-rose-700 border-r border-slate-200`}>Sum Leave</th>
                      <th className={`${conf.bgSum} font-black py-1.5 px-2 text-amber-700 border-r border-slate-200`}>Sum OT</th>
                      <th className={`${conf.bgLight} font-black py-1.5 px-2 text-rose-700`}>Leave Ratio</th>
                      <th className={`${conf.bgLight} font-black py-1.5 px-2 text-blue-900 border-r border-slate-300`}>OT Ratio</th>
                    </React.Fragment>
                  );
                }
                return (
                  <React.Fragment key={`${blk}-sub`}>
                    <th className={`${conf.bgLight} font-bold py-1.5 px-2 text-slate-700`}>MP</th>
                    <th className={`${conf.bgLight} font-bold py-1.5 px-2 text-slate-700`}>Work</th>
                    <th className={`${conf.bgLight} font-bold py-1.5 px-2 text-rose-700`}>Leave</th>
                    <th className={`${conf.bgLight} font-bold py-1.5 px-2 text-amber-700`}>OT</th>
                    <th className={`${conf.bgSum} font-black py-1.5 px-2 text-slate-900`}>Sum MP</th>
                    <th className={`${conf.bgSum} font-black py-1.5 px-2 text-slate-900`}>Sum Work</th>
                    <th className={`${conf.bgSum} font-black py-1.5 px-2 text-rose-700`}>Sum Leave</th>
                    <th className={`${conf.bgSum} font-black py-1.5 px-2 text-amber-700 border-r border-slate-200`}>Sum OT</th>
                    <th className={`${conf.bgLight} font-black py-1.5 px-2 text-rose-700`}>Leave Ratio</th>
                    <th className={`${conf.bgLight} font-black py-1.5 px-2 text-blue-900 border-r border-slate-300`}>OT Ratio</th>
                  </React.Fragment>
                );
              })}
            </tr>
          </thead>

          {/* Body Rows */}
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {(() => {
              const elements: React.ReactNode[] = [];
              const groupKeys = ["INDIRECT", "QA", "FPC", "SMT_F", "SMT_B", "MDS"];

              groupKeys.forEach((grpKey) => {
                const grpRows = rows.filter((r) => r.group === grpKey);
                if (grpRows.length === 0) return;

                grpRows.forEach((r, rIdx) => {
                  const isFirst = rIdx === 0;
                  elements.push(
                    <tr key={`${grpKey}-${rIdx}`} className="hover:bg-blue-50/30 transition-colors">
                      {/* Dept Name */}
                      <td className="sticky left-0 z-10 min-w-[120px] bg-white font-black text-slate-900 py-1.5 px-3 text-left border-r border-slate-200">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{grpKey}</span>
                          {r.dept}
                        </span>
                      </td>
                      {/* COC Code */}
                      <td className="sticky left-[120px] z-10 min-w-[70px] bg-slate-50 font-mono text-[11px] text-slate-600 font-semibold py-1.5 px-2 text-center border-r border-slate-200">
                        {r.coc || "-"}
                      </td>

                      {/* Blocks metrics */}
                      {blocks.map((blk) => {
                        const d = r.blocks[blk] || { mp: 0, work: 0, leave: 0, ot: 0, leaveRatio: 0, otRatio: 0 };
                        const conf = BLOCK_COLORS[blk] || BLOCK_COLORS.P1;
                        if (blk === 'P1') {
                          return (
                            <React.Fragment key={`${blk}-${rIdx}`}>
                              <td className={`py-1.5 px-2.5 font-black text-slate-900 border-r border-slate-200 min-w-[55px] ${conf.bgSum}`}>
                                {d.mp}
                              </td>
                              <td className={`py-1.5 px-2.5 font-bold text-slate-800 border-r border-slate-200 min-w-[55px] ${conf.bgSum}`}>
                                {d.work}
                              </td>
                              <td className={`py-1.5 px-2.5 font-bold text-rose-700 border-r border-slate-200 min-w-[55px] ${conf.bgSum}`}>
                                {d.leave}
                              </td>
                              <td className={`py-1.5 px-2.5 font-bold text-amber-700 border-r border-slate-200 min-w-[55px] ${conf.bgSum}`}>
                                {d.ot}
                              </td>
                              <td className="py-1.5 px-2.5 font-bold text-rose-600 min-w-[65px]">{d.leaveRatio}%</td>
                              <td className="py-1.5 px-2.5 font-bold text-blue-800 border-r border-slate-300 min-w-[65px]">{d.otRatio}%</td>
                            </React.Fragment>
                          );
                        }
                        return (
                          <React.Fragment key={`${blk}-${rIdx}`}>
                            <td className="py-1.5 px-2.5 font-semibold text-slate-800 min-w-[45px]">{d.mp}</td>
                            <td className="py-1.5 px-2.5 text-slate-600 min-w-[45px]">{d.work}</td>
                            <td className="py-1.5 px-2.5 text-rose-600 font-bold min-w-[45px]">{d.leave}</td>
                            <td className="py-1.5 px-2.5 text-amber-600 font-bold min-w-[45px]">{d.ot}</td>
                            <td className={`py-1.5 px-2.5 font-black text-slate-900 min-w-[50px] ${conf.bgSum}`}>
                              {d.mp}
                            </td>
                            <td className={`py-1.5 px-2.5 font-bold text-slate-800 min-w-[50px] ${conf.bgSum}`}>
                              {d.work}
                            </td>
                            <td className={`py-1.5 px-2.5 font-bold text-rose-700 min-w-[50px] ${conf.bgSum}`}>
                              {d.leave}
                            </td>
                            <td className={`py-1.5 px-2.5 font-bold text-amber-700 border-r border-slate-200 min-w-[50px] ${conf.bgSum}`}>
                              {d.ot}
                            </td>
                            <td className="py-1.5 px-2.5 font-bold text-rose-600 min-w-[65px]">{d.leaveRatio}%</td>
                            <td className="py-1.5 px-2.5 font-bold text-blue-800 border-r border-slate-300 min-w-[65px]">{d.otRatio}%</td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                });

                // สรุปยอดรวมกลุ่มใหญ่ (Group Subtotal) ตามโครงสร้างตาราง
                const grpSum = groupSummaries[grpKey];
                if (grpSum) {
                  elements.push(
                    <tr key={`${grpKey}-summary`} className="bg-slate-100/90 font-black border-y-2 border-slate-400">
                      <td className="sticky left-0 z-10 min-w-[120px] bg-slate-200 font-black text-slate-900 py-1.5 px-3 text-left border-r border-slate-300">
                        Total {grpKey}
                      </td>
                      <td className="sticky left-[120px] z-10 min-w-[70px] bg-slate-200 font-mono text-[11px] text-slate-700 py-1.5 px-2 text-center border-r border-slate-300">
                        -
                      </td>
                      {blocks.map((blk) => {
                        const gd = grpSum[blk] || { mp: 0, work: 0, leave: 0, ot: 0, leaveRatio: 0, otRatio: 0 };
                        if (blk === 'P1') {
                          return (
                            <React.Fragment key={`sum-${grpKey}-${blk}`}>
                              <td className="py-1.5 px-2.5 bg-blue-200/90 text-slate-950 font-black border-r border-slate-300 min-w-[55px]">{gd.mp}</td>
                              <td className="py-1.5 px-2.5 bg-blue-200/90 text-slate-950 font-black border-r border-slate-300 min-w-[55px]">{gd.work}</td>
                              <td className="py-1.5 px-2.5 bg-blue-200/90 text-rose-950 font-black border-r border-slate-300 min-w-[55px]">{gd.leave}</td>
                              <td className="py-1.5 px-2.5 bg-blue-200/90 text-amber-950 font-black border-r border-slate-300 min-w-[55px]">{gd.ot}</td>
                              <td className="py-1.5 px-2.5 text-rose-700 font-black min-w-[65px]">{gd.leaveRatio}%</td>
                              <td className="py-1.5 px-2.5 text-blue-900 font-black border-r border-slate-400 min-w-[65px]">{gd.otRatio}%</td>
                            </React.Fragment>
                          );
                        }
                        return (
                          <React.Fragment key={`sum-${grpKey}-${blk}`}>
                            <td className="py-1.5 px-2.5 text-slate-900 min-w-[45px]">{gd.mp}</td>
                            <td className="py-1.5 px-2.5 text-slate-700 min-w-[45px]">{gd.work}</td>
                            <td className="py-1.5 px-2.5 text-rose-700 min-w-[45px]">{gd.leave}</td>
                            <td className="py-1.5 px-2.5 text-amber-700 min-w-[45px]">{gd.ot}</td>
                            <td className="py-1.5 px-2.5 bg-blue-200/90 text-slate-950 font-black min-w-[50px]">{gd.mp}</td>
                            <td className="py-1.5 px-2.5 bg-blue-200/90 text-slate-950 font-black min-w-[50px]">{gd.work}</td>
                            <td className="py-1.5 px-2.5 bg-blue-200/90 text-rose-950 font-black min-w-[50px]">{gd.leave}</td>
                            <td className="py-1.5 px-2.5 bg-blue-200/90 text-amber-950 font-black border-r border-slate-300 min-w-[50px]">{gd.ot}</td>
                            <td className="py-1.5 px-2.5 text-rose-700 font-black min-w-[65px]">{gd.leaveRatio}%</td>
                            <td className="py-1.5 px-2.5 text-blue-900 font-black border-r border-slate-400 min-w-[65px]">{gd.otRatio}%</td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                }
              });

              return elements;
            })()}
          </tbody>

          {/* Footer Total Row */}
          <tfoot className="sticky bottom-0 z-20 shadow-md font-black bg-slate-100 border-t-2 border-slate-300">
            <tr>
              <td colSpan={2} className="sticky left-0 z-30 min-w-[190px] bg-[#193886] text-white py-2 px-3 text-center border-r border-slate-300">
                Total P1
              </td>
              {blocks.map((blk) => {
                const d = totalP1[blk] || { mp: 0, work: 0, leave: 0, ot: 0, leaveRatio: 0, otRatio: 0 };
                if (blk === 'P1') {
                  return (
                    <React.Fragment key={`tot-${blk}`}>
                      <td className="py-2 px-2.5 bg-blue-200/80 text-blue-950 border-r border-slate-300 min-w-[55px]">{d.mp}</td>
                      <td className="py-2 px-2.5 bg-blue-200/80 text-blue-950 border-r border-slate-300 min-w-[55px]">{d.work}</td>
                      <td className="py-2 px-2.5 bg-blue-200/80 text-rose-950 border-r border-slate-300 min-w-[55px]">{d.leave}</td>
                      <td className="py-2 px-2.5 bg-blue-200/80 text-amber-950 border-r border-slate-300 min-w-[55px]">{d.ot}</td>
                      <td className="py-2 px-2.5 text-rose-600 font-bold min-w-[65px]">{d.leaveRatio}%</td>
                      <td className="py-2 px-2.5 text-blue-900 font-bold border-r border-slate-300 min-w-[65px]">{d.otRatio}%</td>
                    </React.Fragment>
                  );
                }
                return (
                  <React.Fragment key={`tot-${blk}`}>
                    <td className="py-2 px-2.5 text-slate-900 min-w-[45px]">{d.mp}</td>
                    <td className="py-2 px-2.5 text-slate-700 min-w-[45px]">{d.work}</td>
                    <td className="py-2 px-2.5 text-rose-600 min-w-[45px]">{d.leave}</td>
                    <td className="py-2 px-2.5 text-amber-600 min-w-[45px]">{d.ot}</td>
                    <td className="py-2 px-2.5 bg-blue-200/80 text-blue-950 min-w-[50px]">{d.mp}</td>
                    <td className="py-2 px-2.5 bg-blue-200/80 text-blue-950 min-w-[50px]">{d.work}</td>
                    <td className="py-2 px-2.5 bg-blue-200/80 text-rose-950 min-w-[50px]">{d.leave}</td>
                    <td className="py-2 px-2.5 bg-blue-200/80 text-amber-950 border-r border-slate-300 min-w-[50px]">{d.ot}</td>
                    <td className="py-2 px-2.5 text-rose-600 font-bold min-w-[65px]">{d.leaveRatio}%</td>
                    <td className="py-2 px-2.5 text-blue-900 font-bold border-r border-slate-300 min-w-[65px]">{d.otRatio}%</td>
                  </React.Fragment>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
