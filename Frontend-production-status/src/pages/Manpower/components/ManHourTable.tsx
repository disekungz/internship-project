/**
 * Component: ManHourTable
 * ตารางสรุปรายละเอียดข้อมูลกำลังคนและ Man-Hour ประจำเดือน
 * - สไตล์ Excel Sheet สะอาดตา มินิมอล ระดับมืออาชีพ
 * - ขอบตารางสีเทาอ่อน สบายตา ไม่ทึบตัน
 * - แบ่งหมวดหมู่ด้วยโทนสีนุ่มนวล:
 *   - Head count: โทนฟ้า/Slate สบายตา
 *   - Manpower: โทนเขียว/ส้ม/น้ำเงินพรีเมียม
 *   - แถวสรุปและผลรวมเน้นเด่นชัด
 */
type TableValue = number | string;

type Props = {
  displayDays: number[];
  manhourCalendar: Record<number, {
    date?: string;
    manhour?: number;
  }>;
  selectedMonth: string;
  selectedLine: string;
  rowSums: Record<string, TableValue>;
  calculatedRows: Record<number, Record<string, TableValue>>;
  displayInputValue: (day: number, field: string) => TableValue;
  handleCellValueChange: (day: number, field: string, value: string) => void;
  displayCalculatedValue: (day: number, value: TableValue) => TableValue;
};

export default function ManHourTable({
  displayDays,
  manhourCalendar,
  selectedMonth,
  selectedLine,
  rowSums,
  calculatedRows,
  displayInputValue,
  handleCellValueChange,
  displayCalculatedValue,
}: Props) {
  return (
    <div className="w-full overflow-hidden">
      <table className="w-full min-w-max table-fixed border-collapse text-[11px] font-sans font-medium text-slate-700 [font-variant-numeric:tabular-nums]">
        <colgroup>
          <col style={{ width: '90px' }} />
          <col style={{ width: '180px' }} />
          <col style={{ width: '52px' }} />
          <col style={{ width: '64px' }} />
          {displayDays.map(day => (
            <col key={day} style={{ width: '38px' }} />
          ))}
        </colgroup>

        {/* ------------------ ส่วนหัวตาราง (Table Header) ------------------ */}
        <thead>
          {/* แถวที่ 1: วันในสัปดาห์ (Mon, Tue, ...) */}
          <tr className="border-b border-slate-200 bg-slate-50/80 text-[12px] font-bold">
            <th rowSpan="2" colSpan="4" className="border-r border-slate-200 px-3 py-1.5 text-center text-slate-500 uppercase tracking-wider align-middle bg-slate-100/70">
              <span className="inline-flex items-center gap-1">📅 Day</span>
            </th>
            {displayDays.map(day => {
              const item = manhourCalendar[day];
              const [year, month] = selectedMonth.split('-').map(Number);
              const fallbackDate = new Date(Date.UTC(year, month - 1, day, 5));
              const isValidDay = fallbackDate.getUTCMonth() === month - 1;
              const itemDate = String(item?.date || '').slice(0, 10);
              const expectedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const parsedItemDate = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(itemDate)
                ? new Date(`${itemDate}T12:00:00+07:00`)
                : null;
              const hasValidItemDate = itemDate === expectedDate
                && parsedItemDate !== null
                && !Number.isNaN(parsedItemDate.getTime());
              const weekday = hasValidItemDate
                ? new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Bangkok' }).format(parsedItemDate)
                : isValidDay
                  ? new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(fallbackDate)
                  : '';
              const isSunday = weekday === 'Sun';
              const isSaturday = weekday === 'Sat';
              return (
                <th
                  key={day}
                  className={`border-r border-slate-200 px-0.5 py-1 text-center font-bold transition-colors ${
                    isSunday
                      ? 'bg-rose-50 text-rose-600'
                      : isSaturday
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-600'
                  }`}
                >
                  {weekday}
                </th>
              );
            })}
          </tr>

          {/* แถวที่ 2: ชั่วโมงทำงานประจำวัน (1, 0) */}
          <tr className="border-b border-slate-200 bg-white text-[10px] font-black">
            {displayDays.map(day => {
              const [year, month] = selectedMonth.split('-').map(Number);
              const date = new Date(Date.UTC(year, month - 1, day));
              const isValidDay = date.getUTCMonth() === month - 1;
              const expectedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const calendarItem = manhourCalendar[day];
              const itemMatchesCurrentDate = String(calendarItem?.date || '').slice(0, 10) === expectedDate;
              const value = itemMatchesCurrentDate
                ? (calendarItem?.manhour ?? 1)
                : (isValidDay ? 1 : '');
              const isOff = value === 0;
              return (
                <th
                  key={day}
                  className={`border-r border-slate-200 px-0.5 py-1 text-center font-black ${
                    isOff ? 'bg-rose-50/70 text-rose-600 font-extrabold' : 'text-blue-600'
                  }`}
                >
                  {value ?? ''}
                </th>
              );
            })}
          </tr>

          {/* แถวที่ 3: ชื่อไลน์, คอลัมน์ Sum, และเลขวันที่ (1..31) */}
          <tr className="border-b border-slate-300 bg-gradient-to-r from-blue-900 to-indigo-900 text-white font-black text-xs shadow-xs">
            <th colSpan="3" className="border-r border-blue-800/60 px-3.5 py-2 text-left tracking-wide">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-300 animate-pulse shrink-0"></span>
                <span className="truncate">{selectedLine}</span>
              </div>
            </th>
            <th className="border-r border-blue-800/60 px-1 py-2 text-center bg-blue-950/60 text-amber-300 font-black tracking-wider uppercase">
              Sum
            </th>
            {displayDays.map(day => (
              <th
                key={day}
                className="border-r border-blue-800/40 px-0.5 py-2 text-center text-[11px] font-black text-slate-100"
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>

        {/* ------------------ ส่วนเนื้อหาตาราง (Table Body) ------------------ */}
        <tbody className="divide-y divide-slate-200 bg-white">
          
          {/* ================= ส่วนที่ 1: สรุปจำนวนคน (Head Count) ================= */}
          <tr className="hover:bg-blue-50/20 transition-colors">
            <td
              rowSpan="6"
              className="sticky left-0 border-r border-b border-slate-300 bg-gradient-to-b from-sky-50 to-blue-50/70 px-2.5 py-2 text-center align-middle font-black text-blue-900 shadow-[2px_0_4px_rgba(0,0,0,0.03)]"
            >
              <div className="flex flex-col items-center justify-center gap-1">
                <span className="text-sm">👥</span>
                <span className="text-[11px] tracking-wide font-black">Head count</span>
              </div>
            </td>
            <td colSpan="2" className="border-r border-slate-200 px-3 py-1.5 font-bold text-slate-800 truncate">
              OP & Leader register
            </td>
            <td className="border-r border-slate-300 px-1.5 py-1.5 text-center font-black bg-blue-50/50 text-blue-950 whitespace-nowrap">
              {rowSums.r1}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-slate-200 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'opRegister')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'opRegister', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-bold text-slate-800 text-[11px] outline-none transition focus:bg-amber-50 focus:ring-1 focus:ring-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          <tr className="hover:bg-blue-50/20 transition-colors">
            <td colSpan="2" className="border-r border-slate-200 px-3 py-1.5 font-bold text-slate-700 truncate">
              จากการรูดบัตร
            </td>
            <td className="border-r border-slate-300 px-1.5 py-1.5 text-center font-black bg-blue-50/50 text-blue-950 whitespace-nowrap">
              {rowSums.r2}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-slate-200 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'swipeCards')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'swipeCards', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-semibold text-slate-700 text-[11px] outline-none transition focus:bg-amber-50 focus:ring-1 focus:ring-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          <tr className="hover:bg-rose-50/20 transition-colors">
            <td colSpan="2" className="border-r border-slate-200 px-3 py-1.5 font-bold text-rose-600 truncate">
              ไม่มาทำงาน
            </td>
            <td className="border-r border-slate-300 px-1.5 py-1.5 text-center font-black bg-rose-50/60 text-rose-700 whitespace-nowrap">
              {rowSums.r3}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-slate-200 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'notWorking')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'notWorking', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-bold text-rose-600 text-[11px] outline-none transition focus:bg-rose-50 focus:ring-1 focus:ring-rose-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          <tr className="hover:bg-rose-50/20 transition-colors">
            <td className="border-r border-slate-200 px-3 py-1.5 font-medium text-rose-700 truncate">
              ไปช่วย line อื่น &lt;Hr&gt;
            </td>
            <td className="border-r border-slate-200 px-1 py-1.5 text-center font-black text-rose-700 bg-rose-50/70 text-[10px]">
              หัก
            </td>
            <td className="border-r border-slate-300 px-1.5 py-1.5 text-center font-black bg-rose-50/40 text-rose-700 whitespace-nowrap">
              {rowSums.r4}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-slate-200 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'helpOutHrs')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'helpOutHrs', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-semibold text-rose-600 text-[11px] outline-none transition focus:bg-rose-50 focus:ring-1 focus:ring-rose-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          <tr className="hover:bg-emerald-50/20 transition-colors">
            <td className="border-r border-slate-200 px-3 py-1.5 font-medium text-emerald-700 truncate">
              line อื่นมาช่วยงาน &lt;Hr&gt;
            </td>
            <td className="border-r border-slate-200 px-1 py-1.5 text-center font-black text-emerald-700 bg-emerald-50/70 text-[10px]">
              เพิ่ม
            </td>
            <td className="border-r border-slate-300 px-1.5 py-1.5 text-center font-black bg-emerald-50/40 text-emerald-800 whitespace-nowrap">
              {rowSums.r5}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-slate-200 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'helpInHrs')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'helpInHrs', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-semibold text-emerald-700 text-[11px] outline-none transition focus:bg-emerald-50 focus:ring-1 focus:ring-emerald-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          <tr className="border-b-2 border-slate-300 hover:bg-amber-50/20 transition-colors">
            <td colSpan="2" className="border-r border-slate-200 px-3 py-1.5 font-bold text-amber-800 truncate">
              OP ทำ OT 1(วันทำงาน)
            </td>
            <td className="border-r border-slate-300 px-1.5 py-1.5 text-center font-black bg-amber-50/60 text-amber-900 whitespace-nowrap">
              {rowSums.r6}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-slate-200 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'ot1Psn')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'ot1Psn', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-semibold text-amber-800 text-[11px] outline-none transition focus:bg-amber-50 focus:ring-1 focus:ring-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          {/* ================= SECTION 2: MANPOWER ================= */}
          <tr className="hover:bg-slate-50/60 transition-colors">
            <td
              rowSpan="17"
              className="sticky left-0 border-r border-slate-300 bg-gradient-to-b from-sky-50 to-blue-50/70 px-2.5 py-2 text-center align-middle font-black text-blue-900 shadow-[2px_0_4px_rgba(0,0,0,0.03)]"
            >
              <div className="flex flex-col items-center justify-center gap-1">
                <span className="text-sm">⚡</span>
                <span className="text-[11px] tracking-wide font-black">Manpower</span>
              </div>
            </td>
            <td className="border-r border-slate-200 px-3 py-1.5 font-bold text-blue-900 truncate">
              OP ที่ทำงานทั้งหมด + LD
            </td>
            <td className="border-r border-slate-200 px-1 py-1.5 text-center font-bold text-blue-800 bg-blue-50/60 text-[10px]">
              8
            </td>
            <td className="border-r border-slate-300 px-1.5 py-1.5 text-center font-black bg-blue-100/70 text-blue-950 whitespace-nowrap">
              {rowSums.r7}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-slate-200 px-0.5 py-1.5 text-center font-bold text-blue-900 bg-slate-50/30">
                {displayCalculatedValue(day, calculatedRows[day]?.r7 ?? 0)}
              </td>
            ))}
          </tr>

          <tr className="hover:bg-amber-50/20 transition-colors">
            <td className="border-r border-slate-200 px-3 py-1.5 font-medium text-amber-800 truncate">
              OT 1(วันทำงาน)
            </td>
            <td className="border-r border-slate-200 px-1 py-1.5 text-center font-bold text-amber-800 bg-amber-50/70 text-[10px]">
              3
            </td>
            <td className="border-r border-slate-300 px-1.5 py-1.5 text-center font-black bg-amber-50/60 text-amber-900 whitespace-nowrap">
              {rowSums.r8}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-slate-200 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'manOT1')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'manOT1', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-semibold text-amber-800 text-[11px] outline-none transition focus:bg-amber-50 focus:ring-1 focus:ring-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          <tr className="hover:bg-rose-50/20 transition-colors">
            <td className="border-r border-slate-200 px-3 py-1.5 font-medium text-rose-700 truncate">
              OT 1 (HEAD)ไปช่วย line อื่น
            </td>
            <td className="border-r border-slate-200 px-1 py-1.5 text-center font-black text-rose-700 bg-rose-50/70 text-[10px]">
              หัก
            </td>
            <td className="border-r border-slate-300 px-1.5 py-1.5 text-center font-black bg-rose-50/50 text-rose-700 whitespace-nowrap">
              {rowSums.r9}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-slate-200 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'manOT1HelpOut')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'manOT1HelpOut', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-semibold text-rose-600 text-[11px] outline-none transition focus:bg-rose-50 focus:ring-1 focus:ring-rose-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          <tr className="hover:bg-emerald-50/20 transition-colors">
            <td className="border-r border-slate-200 px-3 py-1.5 font-medium text-emerald-700 truncate">
              OT 1 (HEAD)line อื่นมาช่วย
            </td>
            <td className="border-r border-slate-200 px-1 py-1.5 text-center font-black text-emerald-700 bg-emerald-50/70 text-[10px]">
              เพิ่ม
            </td>
            <td className="border-r border-slate-300 px-1.5 py-1.5 text-center font-black bg-emerald-50/50 text-emerald-800 whitespace-nowrap">
              {rowSums.r10}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-slate-200 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'manOT1HelpIn')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'manOT1HelpIn', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-semibold text-emerald-700 text-[11px] outline-none transition focus:bg-emerald-50 focus:ring-1 focus:ring-emerald-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          <tr className="hover:bg-emerald-50/20 transition-colors">
            <td className="border-r border-slate-200 px-3 py-1.5 font-medium text-emerald-800 truncate">
              OT 2 (วันหยุด)
            </td>
            <td className="border-r border-slate-200 px-1 py-1.5 text-center font-bold text-emerald-800 bg-emerald-50/70 text-[10px]">
              11
            </td>
            <td className="border-r border-slate-300 px-1.5 py-1.5 text-center font-black bg-emerald-50/60 text-emerald-900 whitespace-nowrap">
              {rowSums.r11}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-slate-200 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'manOT2')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'manOT2', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-semibold text-emerald-800 text-[11px] outline-none transition focus:bg-emerald-50 focus:ring-1 focus:ring-emerald-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          <tr className="hover:bg-rose-50/20 transition-colors">
            <td className="border-r border-slate-200 px-3 py-1.5 font-medium text-rose-700 truncate">
              OT 2 (HEAD)ไปช่วย line อื่น
            </td>
            <td className="border-r border-slate-200 px-1 py-1.5 text-center font-black text-rose-700 bg-rose-50/70 text-[10px]">
              หัก
            </td>
            <td className="border-r border-slate-300 px-1.5 py-1.5 text-center font-black bg-rose-50/50 text-rose-700 whitespace-nowrap">
              {rowSums.r12}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-slate-200 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'manOT2HelpOut')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'manOT2HelpOut', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-semibold text-rose-600 text-[11px] outline-none transition focus:bg-rose-50 focus:ring-1 focus:ring-rose-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          <tr className="hover:bg-emerald-50/20 transition-colors">
            <td className="border-r border-slate-200 px-3 py-1.5 font-medium text-emerald-700 truncate">
              OT 2 (HEAD)line อื่นมาช่วย
            </td>
            <td className="border-r border-slate-200 px-1 py-1.5 text-center font-black text-emerald-700 bg-emerald-50/70 text-[10px]">
              เพิ่ม
            </td>
            <td className="border-r border-slate-300 px-1.5 py-1.5 text-center font-black bg-emerald-50/50 text-emerald-800 whitespace-nowrap">
              {rowSums.r13}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-slate-200 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'manOT2HelpIn')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'manOT2HelpIn', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-semibold text-emerald-700 text-[11px] outline-none transition focus:bg-emerald-50 focus:ring-1 focus:ring-emerald-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          {/* แถวสรุปกลุ่ม Man-Hour โทนสีเน้นระดับพรีเมียม */}
          <tr className="bg-slate-100/80 font-black text-slate-800 hover:bg-slate-200/60 transition-colors">
            <td colSpan="2" className="border-r border-slate-200 px-3 py-1.5 font-black text-slate-800 truncate">
              Normal Man Hour OP ที่ทำงานทั้งหมด + LD
            </td>
            <td className="border-r border-slate-300 px-1 py-1.5 text-center font-black bg-slate-200/80 text-slate-900 whitespace-nowrap">
              {rowSums.r14}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-slate-200 px-0.5 py-1.5 text-center font-bold text-slate-800">
                {displayCalculatedValue(day, calculatedRows[day]?.r14 ?? 0)}
              </td>
            ))}
          </tr>

          <tr className="bg-amber-50/70 font-black text-amber-900 hover:bg-amber-100/60 transition-colors">
            <td colSpan="2" className="border-r border-slate-200 px-3 py-1.5 font-black text-amber-800 truncate">
              OT Man Hour
            </td>
            <td className="border-r border-slate-300 px-1 py-1.5 text-center font-black bg-amber-100/80 text-amber-950 whitespace-nowrap">
              {rowSums.r15}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-slate-200 px-0.5 py-1.5 text-center font-bold text-amber-800">
                {displayCalculatedValue(day, calculatedRows[day]?.r15 ?? 0)}
              </td>
            ))}
          </tr>

          <tr className="bg-blue-100/60 font-black text-blue-950 hover:bg-blue-100/90 transition-colors">
            <td colSpan="2" className="border-r border-slate-200 px-3 py-2 font-black text-blue-900 truncate">
              Total Man Hour
            </td>
            <td className="border-r border-slate-300 px-1 py-2 text-center font-black bg-blue-200/80 text-blue-950 whitespace-nowrap">
              {rowSums.r16}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-slate-200 px-0.5 py-2 text-center font-black text-blue-900">
                {displayCalculatedValue(day, calculatedRows[day]?.r16 ?? 0)}
              </td>
            ))}
          </tr>

          <tr className="bg-sky-50/50 font-black text-sky-900 hover:bg-sky-100/50 transition-colors">
            <td colSpan="2" className="border-r border-slate-200 px-3 py-1.5 font-bold text-sky-900 truncate">
              Normal Man Hour OP & Leader Register
            </td>
            <td className="border-r border-slate-300 px-1 py-1.5 text-center font-black bg-sky-100/70 text-sky-950 whitespace-nowrap">
              {rowSums.r17}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-slate-200 px-0.5 py-1.5 text-center font-bold text-sky-800">
                {displayCalculatedValue(day, calculatedRows[day]?.r17 ?? 0)}
              </td>
            ))}
          </tr>

          <tr className="bg-sky-50/50 font-black text-sky-900 hover:bg-sky-100/50 transition-colors">
            <td colSpan="2" className="border-r border-slate-200 px-3 py-1.5 font-bold text-sky-900 truncate">
              OT Man Hour
            </td>
            <td className="border-r border-slate-300 px-1 py-1.5 text-center font-black bg-sky-100/70 text-sky-950 whitespace-nowrap">
              {rowSums.r18}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-slate-200 px-0.5 py-1.5 text-center font-bold text-sky-700">
                {displayCalculatedValue(day, calculatedRows[day]?.r18 ?? 0)}
              </td>
            ))}
          </tr>

          <tr className="bg-indigo-100/60 font-black text-indigo-950 hover:bg-indigo-100/90 transition-colors">
            <td colSpan="2" className="border-r border-slate-200 px-3 py-2 font-black text-indigo-900 truncate">
              Total Man Hour
            </td>
            <td className="border-r border-slate-300 px-1 py-2 text-center font-black bg-indigo-200/80 text-indigo-950 whitespace-nowrap">
              {rowSums.r19}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-slate-200 px-0.5 py-2 text-center font-black text-indigo-900">
                {displayCalculatedValue(day, calculatedRows[day]?.r19 ?? 0)}
              </td>
            ))}
          </tr>

          {/* อัตราการลา และ OT */}
          <tr className="hover:bg-rose-50/20 transition-colors">
            <td colSpan="2" className="border-r border-slate-200 px-3 py-1.5 font-bold text-rose-700 truncate">
              Leave data
            </td>
            <td className="border-r border-slate-300 px-1 py-1.5 text-center font-black bg-rose-50/60 text-rose-700 whitespace-nowrap">
              {rowSums.r20}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-slate-200 px-0.5 py-1.5 text-center font-bold text-rose-600 bg-rose-50/10">
                {displayCalculatedValue(day, calculatedRows[day]?.r20 ?? 0)}
              </td>
            ))}
          </tr>

          <tr className="hover:bg-rose-50/20 transition-colors">
            <td colSpan="2" className="border-r border-slate-200 px-3 py-1.5 font-bold text-rose-600 truncate">
              Leave rate(%)
            </td>
            <td className="border-r border-slate-300 px-1 py-1.5 text-center font-black bg-rose-100/70 text-rose-800 whitespace-nowrap">
              {rowSums.r21}
            </td>
            {displayDays.map(day => {
              const val = calculatedRows[day]?.r21;
              const hasRegister = Number(calculatedRows[day]?.r1) > 0;
              return (
                <td key={day} className={`border-r border-slate-200 px-0.5 py-1.5 text-center font-bold ${val === '#DIV/0!' ? 'text-slate-400' : 'text-rose-600'}`}>
                  {hasRegister && val !== '#DIV/0!' && Number(val) !== 0 ? `${val}%` : '-'}
                </td>
              );
            })}
          </tr>

          <tr className="hover:bg-amber-50/20 transition-colors">
            <td colSpan="2" className="border-r border-slate-200 px-3 py-1.5 font-bold text-amber-800 truncate">
              OT working day rate(%)
            </td>
            <td className="border-r border-slate-300 px-1 py-1.5 text-center font-black bg-amber-100/70 text-amber-900 whitespace-nowrap">
              {rowSums.r22}
            </td>
            {displayDays.map(day => {
              const val = calculatedRows[day]?.r22;
              const hasRegister = Number(calculatedRows[day]?.r1) > 0;
              return (
                <td key={day} className={`border-r border-slate-200 px-0.5 py-1.5 text-center font-bold ${val === '#DIV/0!' ? 'text-slate-400' : 'text-amber-800'}`}>
                  {hasRegister && val !== '#DIV/0!' && Number(val) !== 0 ? `${val}%` : '-'}
                </td>
              );
            })}
          </tr>

          <tr className="hover:bg-emerald-50/20 transition-colors border-b border-slate-300">
            <td colSpan="2" className="border-r border-slate-200 px-3 py-1.5 font-bold text-emerald-800 truncate">
              OT Holiday day rate(%)
            </td>
            <td className="border-r border-slate-300 px-1 py-1.5 text-center font-black bg-emerald-100/70 text-emerald-900 whitespace-nowrap">
              {rowSums.r23}
            </td>
            {displayDays.map(day => {
              const val = calculatedRows[day]?.r23;
              const hasRegister = Number(calculatedRows[day]?.r1) > 0;
              return (
                <td key={day} className={`border-r border-slate-200 px-0.5 py-1.5 text-center font-bold ${val === '#DIV/0!' ? 'text-slate-400' : 'text-emerald-800 bg-emerald-50/20'}`}>
                  {hasRegister && val !== '#DIV/0!' && Number(val) !== 0 ? `${val}%` : '-'}
                </td>
              );
            })}
          </tr>

        </tbody>
      </table>
    </div>
  );
}
