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
    P1: { headerBg: "bg-[#002060]", text: "text-white", bgLight: "bg-blue-500/10 dark:bg-blue-500/15", bgSum: "bg-blue-500/20 dark:bg-blue-500/25" },
    PER: { headerBg: "bg-[#4d6323]", text: "text-white", bgLight: "bg-emerald-500/10 dark:bg-emerald-500/15", bgSum: "bg-emerald-500/20 dark:bg-emerald-500/25" },
    SUB: { headerBg: "bg-[#002060]", text: "text-white", bgLight: "bg-sky-500/10 dark:bg-sky-500/15", bgSum: "bg-sky-500/20 dark:bg-sky-500/25" },
    MOU: { headerBg: "bg-[#582680]", text: "text-white", bgLight: "bg-purple-500/10 dark:bg-purple-500/15", bgSum: "bg-purple-500/20 dark:bg-purple-500/25" },
    DC: { headerBg: "bg-[#1f3a6b]", text: "text-white", bgLight: "bg-slate-500/10 dark:bg-slate-500/15", bgSum: "bg-slate-500/20 dark:bg-slate-500/25" },
  };

  return (
    <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
      <div className="mb-3">
        <h2 className="text-base sm:text-lg font-black text-base-content">
         Summary Table of Manpower and Proportions by Department
        </h2>
        <p className="text-xs text-base-content/60 font-medium">
          แจกแจงยอดพนักงาน (MP, Work, Leave, OT) และสัดส่วน % แยกตามกลุ่มโรงงาน (P1, PER, SUB, MOU, DC)
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-base-300">
        <table className="w-full text-xs text-right border-collapse whitespace-nowrap">
          {/* Header Rows */}
          <thead className="sticky top-0 z-20 shadow-xs">
            {/* Row 1: Block Names */}
            <tr>
              <th rowSpan={2} className="sticky left-0 z-30 min-w-[110px] bg-[#1F497D] text-white font-black py-2.5 px-3 text-left border-r border-base-300">
                Dept
              </th>
              <th rowSpan={2} className="sticky left-[110px] z-30 min-w-[70px] bg-[#1F497D] text-white font-black py-2.5 px-2 text-center border-r border-base-300">
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
            <tr className="border-b border-base-300">
              {blocks.map((blk) => {
                const conf = BLOCK_COLORS[blk] || BLOCK_COLORS.P1;
                if (blk === 'P1') {
                  return (
                    <React.Fragment key={`${blk}-sub`}>
                      <th className={`${conf.bgSum} font-black py-1.5 px-2 text-base-content border-r border-base-300/60`}>Sum MP</th>
                      <th className={`${conf.bgSum} font-black py-1.5 px-2 text-base-content border-r border-base-300/60`}>Sum Work</th>
                      <th className={`${conf.bgSum} font-black py-1.5 px-2 text-rose-600 dark:text-rose-400 border-r border-base-300/60`}>Sum Leave</th>
                      <th className={`${conf.bgSum} font-black py-1.5 px-2 text-amber-600 dark:text-amber-400 border-r border-base-300/60`}>Sum OT</th>
                      <th className={`${conf.bgLight} font-black py-1.5 px-2 text-rose-600 dark:text-rose-400`}>Leave Ratio</th>
                      <th className={`${conf.bgLight} font-black py-1.5 px-2 text-blue-600 dark:text-blue-400 border-r border-base-300`}>OT Ratio</th>
                    </React.Fragment>
                  );
                }
                return (
                  <React.Fragment key={`${blk}-sub`}>
                    <th className={`${conf.bgLight} font-bold py-1.5 px-2 text-base-content/80`}>MP</th>
                    <th className={`${conf.bgLight} font-bold py-1.5 px-2 text-base-content/80`}>Work</th>
                    <th className={`${conf.bgLight} font-bold py-1.5 px-2 text-rose-600 dark:text-rose-400`}>Leave</th>
                    <th className={`${conf.bgLight} font-bold py-1.5 px-2 text-amber-600 dark:text-amber-400`}>OT</th>
                    <th className={`${conf.bgSum} font-black py-1.5 px-2 text-base-content`}>Sum MP</th>
                    <th className={`${conf.bgSum} font-black py-1.5 px-2 text-base-content`}>Sum Work</th>
                    <th className={`${conf.bgSum} font-black py-1.5 px-2 text-rose-600 dark:text-rose-400`}>Sum Leave</th>
                    <th className={`${conf.bgSum} font-black py-1.5 px-2 text-amber-600 dark:text-amber-400 border-r border-base-300/60`}>Sum OT</th>
                    <th className={`${conf.bgLight} font-black py-1.5 px-2 text-rose-600 dark:text-rose-400`}>Leave Ratio</th>
                    <th className={`${conf.bgLight} font-black py-1.5 px-2 text-blue-600 dark:text-blue-400 border-r border-base-300`}>OT Ratio</th>
                  </React.Fragment>
                );
              })}
            </tr>
          </thead>

          {/* Body Rows */}
          <tbody className="divide-y divide-base-300/50 font-medium text-base-content">
            {(() => {
              const elements: React.ReactNode[] = [];
              const groupKeys = ["INDIRECT", "QA", "FPC", "SMT_F", "SMT_B", "MDS"];

              groupKeys.forEach((grpKey) => {
                const grpRows = rows.filter((r) => r.group === grpKey);
                if (grpRows.length === 0) return;

                grpRows.forEach((r, rIdx) => {
                  elements.push(
                    <tr key={`${grpKey}-${rIdx}`} className="hover:bg-base-200/50 transition-colors">
                      {/* Dept Name */}
                      <td className="sticky left-0 z-10 min-w-[120px] bg-base-100 font-black text-base-content py-1.5 px-3 text-left border-r border-base-300">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-base-200 text-base-content/70">{grpKey}</span>
                          {r.dept}
                        </span>
                      </td>
                      {/* COC Code */}
                      <td className="sticky left-[120px] z-10 min-w-[70px] bg-base-200/60 font-mono text-[11px] text-base-content/80 font-semibold py-1.5 px-2 text-center border-r border-base-300">
                        {r.coc || "-"}
                      </td>

                      {/* Blocks metrics */}
                      {blocks.map((blk) => {
                        const d = r.blocks[blk] || { mp: 0, work: 0, leave: 0, ot: 0, leaveRatio: 0, otRatio: 0 };
                        const conf = BLOCK_COLORS[blk] || BLOCK_COLORS.P1;
                        if (blk === 'P1') {
                          return (
                            <React.Fragment key={`${blk}-${rIdx}`}>
                              <td className={`py-1.5 px-2.5 font-black text-base-content border-r border-base-300/60 min-w-[55px] ${conf.bgSum}`}>
                                {d.mp}
                              </td>
                              <td className={`py-1.5 px-2.5 font-bold text-base-content border-r border-base-300/60 min-w-[55px] ${conf.bgSum}`}>
                                {d.work}
                              </td>
                              <td className={`py-1.5 px-2.5 font-bold text-rose-600 dark:text-rose-400 border-r border-base-300/60 min-w-[55px] ${conf.bgSum}`}>
                                {d.leave}
                              </td>
                              <td className={`py-1.5 px-2.5 font-bold text-amber-600 dark:text-amber-400 border-r border-base-300/60 min-w-[55px] ${conf.bgSum}`}>
                                {d.ot}
                              </td>
                              <td className="py-1.5 px-2.5 font-bold text-rose-600 dark:text-rose-400 min-w-[65px]">{d.leaveRatio}%</td>
                              <td className="py-1.5 px-2.5 font-bold text-blue-600 dark:text-blue-400 border-r border-base-300 min-w-[65px]">{d.otRatio}%</td>
                            </React.Fragment>
                          );
                        }
                        return (
                          <React.Fragment key={`${blk}-${rIdx}`}>
                            <td className="py-1.5 px-2.5 font-semibold text-base-content min-w-[45px]">{d.mp}</td>
                            <td className="py-1.5 px-2.5 text-base-content/75 min-w-[45px]">{d.work}</td>
                            <td className="py-1.5 px-2.5 text-rose-600 dark:text-rose-400 font-bold min-w-[45px]">{d.leave}</td>
                            <td className="py-1.5 px-2.5 text-amber-600 dark:text-amber-400 font-bold min-w-[45px]">{d.ot}</td>
                            <td className={`py-1.5 px-2.5 font-black text-base-content min-w-[50px] ${conf.bgSum}`}>
                              {d.mp}
                            </td>
                            <td className={`py-1.5 px-2.5 font-bold text-base-content min-w-[50px] ${conf.bgSum}`}>
                              {d.work}
                            </td>
                            <td className={`py-1.5 px-2.5 font-bold text-rose-600 dark:text-rose-400 min-w-[50px] ${conf.bgSum}`}>
                              {d.leave}
                            </td>
                            <td className={`py-1.5 px-2.5 font-bold text-amber-600 dark:text-amber-400 border-r border-base-300/60 min-w-[50px] ${conf.bgSum}`}>
                              {d.ot}
                            </td>
                            <td className="py-1.5 px-2.5 font-bold text-rose-600 dark:text-rose-400 min-w-[65px]">{d.leaveRatio}%</td>
                            <td className="py-1.5 px-2.5 font-bold text-blue-600 dark:text-blue-400 border-r border-base-300 min-w-[65px]">{d.otRatio}%</td>
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
                    <tr key={`${grpKey}-summary`} className="bg-base-200/90 font-black border-y-2 border-base-300">
                      <td className="sticky left-0 z-10 min-w-[120px] bg-base-200 font-black text-base-content py-1.5 px-3 text-left border-r border-base-300">
                        Total {grpKey}
                      </td>
                      <td className="sticky left-[120px] z-10 min-w-[70px] bg-base-200 font-mono text-[11px] text-base-content/80 py-1.5 px-2 text-center border-r border-base-300">
                        -
                      </td>
                      {blocks.map((blk) => {
                        const gd = grpSum[blk] || { mp: 0, work: 0, leave: 0, ot: 0, leaveRatio: 0, otRatio: 0 };
                        if (blk === 'P1') {
                          return (
                            <React.Fragment key={`sum-${grpKey}-${blk}`}>
                              <td className="py-1.5 px-2.5 bg-blue-500/20 text-base-content font-black border-r border-base-300/70 min-w-[55px]">{gd.mp}</td>
                              <td className="py-1.5 px-2.5 bg-blue-500/20 text-base-content font-black border-r border-base-300/70 min-w-[55px]">{gd.work}</td>
                              <td className="py-1.5 px-2.5 bg-blue-500/20 text-rose-600 dark:text-rose-400 font-black border-r border-base-300/70 min-w-[55px]">{gd.leave}</td>
                              <td className="py-1.5 px-2.5 bg-blue-500/20 text-amber-600 dark:text-amber-400 font-black border-r border-base-300/70 min-w-[55px]">{gd.ot}</td>
                              <td className="py-1.5 px-2.5 text-rose-600 dark:text-rose-400 font-black min-w-[65px]">{gd.leaveRatio}%</td>
                              <td className="py-1.5 px-2.5 text-blue-600 dark:text-blue-400 font-black border-r border-base-300 min-w-[65px]">{gd.otRatio}%</td>
                            </React.Fragment>
                          );
                        }
                        return (
                          <React.Fragment key={`sum-${grpKey}-${blk}`}>
                            <td className="py-1.5 px-2.5 text-base-content min-w-[45px]">{gd.mp}</td>
                            <td className="py-1.5 px-2.5 text-base-content/75 min-w-[45px]">{gd.work}</td>
                            <td className="py-1.5 px-2.5 text-rose-600 dark:text-rose-400 font-bold min-w-[45px]">{gd.leave}</td>
                            <td className="py-1.5 px-2.5 text-amber-600 dark:text-amber-400 font-bold min-w-[45px]">{gd.ot}</td>
                            <td className="py-1.5 px-2.5 bg-blue-500/20 text-base-content font-black min-w-[50px]">{gd.mp}</td>
                            <td className="py-1.5 px-2.5 bg-blue-500/20 text-base-content font-black min-w-[50px]">{gd.work}</td>
                            <td className="py-1.5 px-2.5 bg-blue-500/20 text-rose-600 dark:text-rose-400 font-black min-w-[50px]">{gd.leave}</td>
                            <td className="py-1.5 px-2.5 bg-blue-500/20 text-amber-600 dark:text-amber-400 font-black border-r border-base-300/70 min-w-[50px]">{gd.ot}</td>
                            <td className="py-1.5 px-2.5 text-rose-600 dark:text-rose-400 font-black min-w-[65px]">{gd.leaveRatio}%</td>
                            <td className="py-1.5 px-2.5 text-blue-600 dark:text-blue-400 font-black border-r border-base-300 min-w-[65px]">{gd.otRatio}%</td>
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
          <tfoot className="sticky bottom-0 z-20 shadow-md font-black bg-base-200 border-t-2 border-base-300">
            <tr>
              <td colSpan={2} className="sticky left-0 z-30 min-w-[190px] bg-primary text-primary-content py-2 px-3 text-center border-r border-base-300">
                Total P1
              </td>
              {blocks.map((blk) => {
                const d = totalP1[blk] || { mp: 0, work: 0, leave: 0, ot: 0, leaveRatio: 0, otRatio: 0 };
                if (blk === 'P1') {
                  return (
                    <React.Fragment key={`tot-${blk}`}>
                      <td className="py-2 px-2.5 bg-primary/20 text-base-content border-r border-base-300/70 min-w-[55px]">{d.mp}</td>
                      <td className="py-2 px-2.5 bg-primary/20 text-base-content border-r border-base-300/70 min-w-[55px]">{d.work}</td>
                      <td className="py-2 px-2.5 bg-primary/20 text-rose-600 dark:text-rose-400 border-r border-base-300/70 min-w-[55px]">{d.leave}</td>
                      <td className="py-2 px-2.5 bg-primary/20 text-amber-600 dark:text-amber-400 border-r border-base-300/70 min-w-[55px]">{d.ot}</td>
                      <td className="py-2 px-2.5 text-rose-600 dark:text-rose-400 font-bold min-w-[65px]">{d.leaveRatio}%</td>
                      <td className="py-2 px-2.5 text-blue-600 dark:text-blue-400 font-bold border-r border-base-300 min-w-[65px]">{d.otRatio}%</td>
                    </React.Fragment>
                  );
                }
                return (
                  <React.Fragment key={`tot-${blk}`}>
                    <td className="py-2 px-2.5 text-base-content min-w-[45px]">{d.mp}</td>
                    <td className="py-2 px-2.5 text-base-content/75 min-w-[45px]">{d.work}</td>
                    <td className="py-2 px-2.5 text-rose-600 dark:text-rose-400 min-w-[45px]">{d.leave}</td>
                    <td className="py-2 px-2.5 text-amber-600 dark:text-amber-400 min-w-[45px]">{d.ot}</td>
                    <td className="py-2 px-2.5 bg-primary/20 text-base-content min-w-[50px]">{d.mp}</td>
                    <td className="py-2 px-2.5 bg-primary/20 text-base-content min-w-[50px]">{d.work}</td>
                    <td className="py-2 px-2.5 bg-primary/20 text-rose-600 dark:text-rose-400 min-w-[50px]">{d.leave}</td>
                    <td className="py-2 px-2.5 bg-primary/20 text-amber-600 dark:text-amber-400 border-r border-base-300/70 min-w-[50px]">{d.ot}</td>
                    <td className="py-2 px-2.5 text-rose-600 dark:text-rose-400 font-bold min-w-[65px]">{d.leaveRatio}%</td>
                    <td className="py-2 px-2.5 text-blue-600 dark:text-blue-400 font-bold border-r border-base-300 min-w-[65px]">{d.otRatio}%</td>
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
