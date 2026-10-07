import { ChartRow } from "../types";

/* ==========================================================================
   CustomTooltip - กล่องแสดงรายละเอียดเมื่อ hover บนกราฟ
   ========================================================================== */
export const CustomTooltip = ({ active, payload, label, processList, leadTimeGroupList, selectedStackKey }: any) => {
    if (!active || !payload || !payload.length) return null;
    const row: ChartRow = payload[0]?.payload;

    // ดึง Lead Time Group items จาก lead_* keys
    const leadTimeItems = Object.keys(row)
        .filter((key) => key.startsWith("lead_") && Number(row[key]) > 0 && (!selectedStackKey || key === selectedStackKey))
        .map((key) => {
            const group = leadTimeGroupList?.find((g: any) => g.key === key);
            return {
                key,
                name: group ? group.name : key.replace("lead_", ""),
                color: group ? group.color : "#cbd5e1",
                value: Number(row[key])
            };
        })
        // เรียงตาม order ใน leadTimeGroupList
        .sort((a: any, b: any) => {
            const ai = (leadTimeGroupList || []).findIndex((g: any) => g.key === a.key);
            const bi = (leadTimeGroupList || []).findIndex((g: any) => g.key === b.key);
            return ai - bi;
        });

    // ดึง Process items จาก proc_* keys
    const selectedProcessPrefix = selectedStackKey ? `leadproc:${selectedStackKey}:` : null;
    const processItems = Object.keys(row)
        .filter((key) => selectedProcessPrefix
            ? key.startsWith(selectedProcessPrefix) && Number(row[key]) > 0
            : key.startsWith("proc_") && Number(row[key]) > 0)
        .map((key) => {
            const selectedProcessName = selectedProcessPrefix
                ? decodeURIComponent(key.slice(selectedProcessPrefix.length))
                : null;
            const process = selectedProcessName
                ? processList?.find((p: any) => p.name === selectedProcessName)
                : processList?.find((p: any) => p.key === key);
            return {
                key,
                name: process ? process.name : (selectedProcessName || key.replace("proc_", "").replace(/_/g, " ")),
                color: process ? process.color : "#94a3b8",
                value: Number(row[key])
            };
        })
        .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));

    const processChunks = [];
    for (let i = 0; i < processItems.length; i += 10) {
        processChunks.push(processItems.slice(i, i + 10));
    }

    return (
        <div
            className="bg-white/95 backdrop-blur-sm border border-indigo-100 rounded-2xl shadow-xl p-3 text-xs flex flex-col gap-1 pointer-events-none"
            style={{ maxWidth: "1000px", minWidth: "350px", width: "auto" }}
        >
            {/* ส่วนหัว Tooltip: วันที่ + ยอดรวม + เป้าหมาย Target */}
            <div className="flex flex-col gap-1 border-b border-slate-100 pb-1.5 mb-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <span className="text-[12px] text-slate-700 uppercase">Date:</span>
                    <span>{label}</span>
                </div>
                <div className="flex flex-row gap-2 mt-0.5">
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-100/50 font-bold text-indigo-700 shrink-0">
                        <span>Total:</span>
                        <span>{row?.total?.toLocaleString()}</span>
                    </div>
                    {row?.target !== undefined && row?.target !== null && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-100/50 font-bold text-rose-600 shrink-0">
                            <span>Target:</span>
                            <span>{row.target.toLocaleString()}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* สรุปแยกตามกลุ่ม Lead Time */}
            {leadTimeItems.length > 0 && (
                <div className="flex flex-col gap-[2px]">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Lead Time Group</div>
                    <div className="flex flex-row flex-wrap gap-[2px] items-center">
                        {leadTimeItems.map((item) => (
                            <div
                                key={item.key}
                                className="flex items-center gap-[2px] px-1 py-[1px] rounded bg-slate-50 border border-slate-100 text-xs shrink-0"
                            >
                                <span
                                    className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: item.color }}
                                />
                                <span className="text-slate-700 font-medium">{item.name}:</span>
                                <span className="font-bold text-slate-700">{item.value.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* สรุปแยกตาม Process */}
            {processItems.length > 0 && (
                <div className="flex flex-col gap-[2px] border-t border-slate-100 pt-1.5 mt-0.5">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Process</div>
                    <div className="flex flex-col gap-[2px]">
                        {processChunks.map((chunk, chunkIdx) => (
                            <div key={chunkIdx} className="flex flex-row flex-wrap gap-[2px] items-center">
                                {chunk.map((item) => (
                                    <div
                                        key={item.key}
                                        className="flex items-center gap-[2px] px-1 py-[1px] rounded bg-slate-50 border border-slate-100 text-xs shrink-0"
                                    >
                                        <span
                                            className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                                            style={{ backgroundColor: item.color }}
                                        />
                                        <span className="text-slate-700 font-medium">{item.name}:</span>
                                        <span className="font-bold text-slate-700">{item.value.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
