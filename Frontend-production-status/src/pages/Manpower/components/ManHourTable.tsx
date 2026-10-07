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
    holiday?: boolean;
    holiday_name?: string;
  }>;
  selectedMonth: string;
  selectedLine: string;
  rowSums: Record<string, number>;
  calculatedRows: Record<string, Record<number, number>>;
  displayInputValue: (rowKey: string, day: number) => TableValue;
  handleCellValueChange: (rowKey: string, day: number, value: string) => void;
  displayCalculatedValue: (rowKey: string, day: number) => TableValue;
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
      <table className="w-full min-w-max table-fixed border-collapse text-[11px] font-sans font-medium text-base-content [font-variant-numeric:tabular-nums]">
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
          <tr className="border-b border-base-300 bg-base-200/60 text-[12px] font-bold">
            <th rowSpan="2" colSpan="4" className="border-r border-base-300 px-3 py-1.5 text-center text-base-content/70 uppercase tracking-wider align-middle bg-base-200">
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
                  className={`border-r border-base-300 px-0.5 py-1 text-center font-bold transition-colors ${
                    isSunday
                      ? 'bg-rose-500/15 text-rose-500'
                      : isSaturday
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : 'text-base-content/80'
                  }`}
                >
                  {weekday}
                </th>
              );
            })}
          </tr>

          {/* แถวที่ 2: ชั่วโมงทำงานประจำวัน (1, 0) */}
          <tr className="border-b border-base-300 bg-base-100 text-[10px] font-black">
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
                  className={`border-r border-base-300 px-0.5 py-1 text-center font-black ${
                    isOff ? 'bg-rose-500/15 text-rose-500 font-extrabold' : 'text-primary'
                  }`}
                >
                  {value ?? ''}
                </th>
              );
            })}
          </tr>

          {/* แถวที่ 3: ชื่อไลน์, คอลัมน์ Sum, และเลขวันที่ (1..31) */}
          <tr className="border-b border-base-300 bg-gradient-to-r from-blue-900 to-indigo-900 text-white font-black text-xs shadow-xs">
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
        <tbody className="divide-y divide-base-300 bg-base-100">
          
          {/* ================= ส่วนที่ 1: สรุปจำนวนคน (Head Count) ================= */}
          <tr className="hover:bg-primary/5 transition-colors">
            <td
              rowSpan="6"
              className="sticky left-0 border-r border-b border-base-300 bg-base-200 px-2.5 py-2 text-center align-middle font-black text-primary shadow-[2px_0_4px_rgba(0,0,0,0.03)]"
            >
              <div className="flex flex-col items-center justify-center gap-1">
                <span className="text-sm">👥</span>
                <span className="text-[11px] tracking-wide font-black">Head count</span>
              </div>
            </td>
            <td colSpan="2" className="border-r border-base-300 px-3 py-1.5 font-bold text-base-content truncate">
              OP & Leader register
            </td>
            <td className="border-r border-base-300 px-1.5 py-1.5 text-center font-black bg-primary/10 text-primary whitespace-nowrap">
              {rowSums.r1}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-base-300 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'opRegister')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'opRegister', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-bold text-base-content text-[11px] outline-none transition focus:bg-amber-500/20 focus:ring-1 focus:ring-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          <tr className="hover:bg-primary/5 transition-colors">
            <td colSpan="2" className="border-r border-base-300 px-3 py-1.5 font-bold text-base-content/80 truncate">
              จากการรูดบัตร
            </td>
            <td className="border-r border-base-300 px-1.5 py-1.5 text-center font-black bg-primary/10 text-primary whitespace-nowrap">
              {rowSums.r2}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-base-300 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'swipeCards')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'swipeCards', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-semibold text-base-content/80 text-[11px] outline-none transition focus:bg-amber-500/20 focus:ring-1 focus:ring-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          <tr className="hover:bg-rose-500/10 transition-colors">
            <td colSpan="2" className="border-r border-base-300 px-3 py-1.5 font-bold text-rose-500 truncate">
              ไม่มาทำงาน
            </td>
            <td className="border-r border-base-300 px-1.5 py-1.5 text-center font-black bg-rose-500/15 text-rose-500 whitespace-nowrap">
              {rowSums.r3}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-base-300 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'notWorking')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'notWorking', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-bold text-rose-500 text-[11px] outline-none transition focus:bg-rose-500/20 focus:ring-1 focus:ring-rose-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          <tr className="hover:bg-rose-500/10 transition-colors">
            <td className="border-r border-base-300 px-3 py-1.5 font-medium text-rose-500 truncate">
              ไปช่วย line อื่น &lt;Hr&gt;
            </td>
            <td className="border-r border-base-300 px-1 py-1.5 text-center font-black text-rose-500 bg-rose-500/15 text-[10px]">
              หัก
            </td>
            <td className="border-r border-base-300 px-1.5 py-1.5 text-center font-black bg-rose-500/15 text-rose-500 whitespace-nowrap">
              {rowSums.r4}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-base-300 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'helpOutHrs')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'helpOutHrs', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-semibold text-rose-500 text-[11px] outline-none transition focus:bg-rose-500/20 focus:ring-1 focus:ring-rose-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          <tr className="hover:bg-emerald-500/10 transition-colors">
            <td className="border-r border-base-300 px-3 py-1.5 font-medium text-emerald-500 truncate">
              line อื่นมาช่วยงาน &lt;Hr&gt;
            </td>
            <td className="border-r border-base-300 px-1 py-1.5 text-center font-black text-emerald-500 bg-emerald-500/15 text-[10px]">
              เพิ่ม
            </td>
            <td className="border-r border-base-300 px-1.5 py-1.5 text-center font-black bg-emerald-500/15 text-emerald-500 whitespace-nowrap">
              {rowSums.r5}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-base-300 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'helpInHrs')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'helpInHrs', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-semibold text-emerald-500 text-[11px] outline-none transition focus:bg-emerald-500/20 focus:ring-1 focus:ring-emerald-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          <tr className="border-b-2 border-base-300 hover:bg-amber-500/10 transition-colors">
            <td colSpan="2" className="border-r border-base-300 px-3 py-1.5 font-bold text-amber-500 truncate">
              OP ทำ OT 1(วันทำงาน)
            </td>
            <td className="border-r border-base-300 px-1.5 py-1.5 text-center font-black bg-amber-500/15 text-amber-500 whitespace-nowrap">
              {rowSums.r6}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-base-300 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'ot1Psn')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'ot1Psn', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-semibold text-amber-500 text-[11px] outline-none transition focus:bg-amber-500/20 focus:ring-1 focus:ring-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          {/* ================= SECTION 2: MANPOWER ================= */}
          <tr className="hover:bg-base-200/50 transition-colors">
            <td
              rowSpan="17"
              className="sticky left-0 border-r border-base-300 bg-base-200 px-2.5 py-2 text-center align-middle font-black text-primary shadow-[2px_0_4px_rgba(0,0,0,0.03)]"
            >
              <div className="flex flex-col items-center justify-center gap-1">
                <span className="text-sm">⚡</span>
                <span className="text-[11px] tracking-wide font-black">Manpower</span>
              </div>
            </td>
            <td className="border-r border-base-300 px-3 py-1.5 font-bold text-primary truncate">
              OP ที่ทำงานทั้งหมด + LD
            </td>
            <td className="border-r border-base-300 px-1 py-1.5 text-center font-bold text-primary bg-primary/10 text-[10px]">
              8
            </td>
            <td className="border-r border-base-300 px-1.5 py-1.5 text-center font-black bg-primary/20 text-primary whitespace-nowrap">
              {rowSums.r7}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-base-300 px-0.5 py-1.5 text-center font-bold text-primary bg-base-200/40">
                {displayCalculatedValue(day, calculatedRows[day]?.r7 ?? 0)}
              </td>
            ))}
          </tr>

          <tr className="hover:bg-amber-500/10 transition-colors">
            <td className="border-r border-base-300 px-3 py-1.5 font-medium text-amber-500 truncate">
              OT 1(วันทำงาน)
            </td>
            <td className="border-r border-base-300 px-1 py-1.5 text-center font-bold text-amber-500 bg-amber-500/15 text-[10px]">
              3
            </td>
            <td className="border-r border-base-300 px-1.5 py-1.5 text-center font-black bg-amber-500/15 text-amber-500 whitespace-nowrap">
              {rowSums.r8}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-base-300 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'manOT1')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'manOT1', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-semibold text-amber-500 text-[11px] outline-none transition focus:bg-amber-500/20 focus:ring-1 focus:ring-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          <tr className="hover:bg-rose-500/10 transition-colors">
            <td className="border-r border-base-300 px-3 py-1.5 font-medium text-rose-500 truncate">
              OT 1 (HEAD)ไปช่วย line อื่น
            </td>
            <td className="border-r border-base-300 px-1 py-1.5 text-center font-black text-rose-500 bg-rose-500/15 text-[10px]">
              หัก
            </td>
            <td className="border-r border-base-300 px-1.5 py-1.5 text-center font-black bg-rose-500/15 text-rose-500 whitespace-nowrap">
              {rowSums.r9}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-base-300 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'manOT1HelpOut')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'manOT1HelpOut', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-semibold text-rose-500 text-[11px] outline-none transition focus:bg-rose-500/20 focus:ring-1 focus:ring-rose-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          <tr className="hover:bg-emerald-500/10 transition-colors">
            <td className="border-r border-base-300 px-3 py-1.5 font-medium text-emerald-500 truncate">
              OT 1 (HEAD)line อื่นมาช่วย
            </td>
            <td className="border-r border-base-300 px-1 py-1.5 text-center font-black text-emerald-500 bg-emerald-500/15 text-[10px]">
              เพิ่ม
            </td>
            <td className="border-r border-base-300 px-1.5 py-1.5 text-center font-black bg-emerald-500/15 text-emerald-500 whitespace-nowrap">
              {rowSums.r10}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-base-300 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'manOT1HelpIn')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'manOT1HelpIn', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-semibold text-emerald-500 text-[11px] outline-none transition focus:bg-emerald-500/20 focus:ring-1 focus:ring-emerald-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          <tr className="hover:bg-emerald-500/10 transition-colors">
            <td className="border-r border-base-300 px-3 py-1.5 font-medium text-emerald-500 truncate">
              OT 2 (วันหยุด)
            </td>
            <td className="border-r border-base-300 px-1 py-1.5 text-center font-bold text-emerald-500 bg-emerald-500/15 text-[10px]">
              11
            </td>
            <td className="border-r border-base-300 px-1.5 py-1.5 text-center font-black bg-emerald-500/15 text-emerald-500 whitespace-nowrap">
              {rowSums.r11}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-base-300 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'manOT2')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'manOT2', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-semibold text-emerald-500 text-[11px] outline-none transition focus:bg-emerald-500/20 focus:ring-1 focus:ring-emerald-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          <tr className="hover:bg-rose-500/10 transition-colors">
            <td className="border-r border-base-300 px-3 py-1.5 font-medium text-rose-500 truncate">
              OT 2 (HEAD)ไปช่วย line อื่น
            </td>
            <td className="border-r border-base-300 px-1 py-1.5 text-center font-black text-rose-500 bg-rose-500/15 text-[10px]">
              หัก
            </td>
            <td className="border-r border-base-300 px-1.5 py-1.5 text-center font-black bg-rose-500/15 text-rose-500 whitespace-nowrap">
              {rowSums.r12}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-base-300 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'manOT2HelpOut')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'manOT2HelpOut', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-semibold text-rose-500 text-[11px] outline-none transition focus:bg-rose-500/20 focus:ring-1 focus:ring-rose-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          <tr className="hover:bg-emerald-500/10 transition-colors">
            <td className="border-r border-base-300 px-3 py-1.5 font-medium text-emerald-500 truncate">
              OT 2 (HEAD)line อื่นมาช่วย
            </td>
            <td className="border-r border-base-300 px-1 py-1.5 text-center font-black text-emerald-500 bg-emerald-500/15 text-[10px]">
              เพิ่ม
            </td>
            <td className="border-r border-base-300 px-1.5 py-1.5 text-center font-black bg-emerald-500/15 text-emerald-500 whitespace-nowrap">
              {rowSums.r13}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-base-300 p-0 text-center">
                <input
                  type="number"
                  value={displayInputValue(day, 'manOT2HelpIn')}
                  placeholder="-"
                  onChange={(e) => handleCellValueChange(day, 'manOT2HelpIn', e.target.value)}
                  className="w-full py-1 text-center bg-transparent font-semibold text-emerald-500 text-[11px] outline-none transition focus:bg-emerald-500/20 focus:ring-1 focus:ring-emerald-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </td>
            ))}
          </tr>

          {/* แถวสรุปกลุ่ม Man-Hour โทนสีเน้นระดับพรีเมียม */}
          <tr className="bg-base-200/80 font-black text-base-content hover:bg-base-200 transition-colors">
            <td colSpan="2" className="border-r border-base-300 px-3 py-1.5 font-black text-base-content truncate">
              Normal Man Hour OP ที่ทำงานทั้งหมด + LD
            </td>
            <td className="border-r border-base-300 px-1 py-1.5 text-center font-black bg-base-300 text-base-content whitespace-nowrap">
              {rowSums.r14}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-base-300 px-0.5 py-1.5 text-center font-bold text-base-content">
                {displayCalculatedValue(day, calculatedRows[day]?.r14 ?? 0)}
              </td>
            ))}
          </tr>

          <tr className="bg-amber-500/15 font-black text-amber-500 hover:bg-amber-500/20 transition-colors">
            <td colSpan="2" className="border-r border-base-300 px-3 py-1.5 font-black text-amber-500 truncate">
              OT Man Hour
            </td>
            <td className="border-r border-base-300 px-1 py-1.5 text-center font-black bg-amber-500/25 text-amber-500 whitespace-nowrap">
              {rowSums.r15}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-base-300 px-0.5 py-1.5 text-center font-bold text-amber-500">
                {displayCalculatedValue(day, calculatedRows[day]?.r15 ?? 0)}
              </td>
            ))}
          </tr>

          <tr className="bg-primary/20 font-black text-primary hover:bg-primary/25 transition-colors">
            <td colSpan="2" className="border-r border-base-300 px-3 py-2 font-black text-primary truncate">
              Total Man Hour
            </td>
            <td className="border-r border-base-300 px-1 py-2 text-center font-black bg-primary/30 text-primary whitespace-nowrap">
              {rowSums.r16}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-base-300 px-0.5 py-2 text-center font-black text-primary">
                {displayCalculatedValue(day, calculatedRows[day]?.r16 ?? 0)}
              </td>
            ))}
          </tr>

          <tr className="bg-sky-500/10 font-black text-sky-500 hover:bg-sky-500/15 transition-colors">
            <td colSpan="2" className="border-r border-base-300 px-3 py-1.5 font-bold text-sky-500 truncate">
              Normal Man Hour OP & Leader Register
            </td>
            <td className="border-r border-base-300 px-1 py-1.5 text-center font-black bg-sky-500/20 text-sky-500 whitespace-nowrap">
              {rowSums.r17}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-base-300 px-0.5 py-1.5 text-center font-bold text-sky-500">
                {displayCalculatedValue(day, calculatedRows[day]?.r17 ?? 0)}
              </td>
            ))}
          </tr>

          <tr className="bg-sky-500/10 font-black text-sky-500 hover:bg-sky-500/15 transition-colors">
            <td colSpan="2" className="border-r border-base-300 px-3 py-1.5 font-bold text-sky-500 truncate">
              OT Man Hour
            </td>
            <td className="border-r border-base-300 px-1 py-1.5 text-center font-black bg-sky-500/20 text-sky-500 whitespace-nowrap">
              {rowSums.r18}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-base-300 px-0.5 py-1.5 text-center font-bold text-sky-500">
                {displayCalculatedValue(day, calculatedRows[day]?.r18 ?? 0)}
              </td>
            ))}
          </tr>

          <tr className="bg-indigo-500/20 font-black text-indigo-400 hover:bg-indigo-500/25 transition-colors">
            <td colSpan="2" className="border-r border-base-300 px-3 py-2 font-black text-indigo-400 truncate">
              Total Man Hour
            </td>
            <td className="border-r border-base-300 px-1 py-2 text-center font-black bg-indigo-500/30 text-indigo-300 whitespace-nowrap">
              {rowSums.r19}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-base-300 px-0.5 py-2 text-center font-black text-indigo-400">
                {displayCalculatedValue(day, calculatedRows[day]?.r19 ?? 0)}
              </td>
            ))}
          </tr>

          {/* อัตราการลา และ OT */}
          <tr className="hover:bg-rose-500/10 transition-colors">
            <td colSpan="2" className="border-r border-base-300 px-3 py-1.5 font-bold text-rose-500 truncate">
              Leave data
            </td>
            <td className="border-r border-base-300 px-1 py-1.5 text-center font-black bg-rose-500/15 text-rose-500 whitespace-nowrap">
              {rowSums.r20}
            </td>
            {displayDays.map(day => (
              <td key={day} className="border-r border-base-300 px-0.5 py-1.5 text-center font-bold text-rose-500 bg-rose-500/5">
                {displayCalculatedValue(day, calculatedRows[day]?.r20 ?? 0)}
              </td>
            ))}
          </tr>

          <tr className="hover:bg-rose-500/10 transition-colors">
            <td colSpan="2" className="border-r border-base-300 px-3 py-1.5 font-bold text-rose-500 truncate">
              Leave rate(%)
            </td>
            <td className="border-r border-base-300 px-1.5 py-1.5 text-center font-black bg-rose-500/20 text-rose-500 whitespace-nowrap">
              {rowSums.r21}
            </td>
            {displayDays.map(day => {
              const val = calculatedRows[day]?.r21;
              const hasRegister = Number(calculatedRows[day]?.r1) > 0;
              return (
                <td key={day} className={`border-r border-base-300 px-0.5 py-1.5 text-center font-bold ${val === '#DIV/0!' ? 'text-base-content/40' : 'text-rose-500'}`}>
                  {hasRegister && val !== '#DIV/0!' && Number(val) !== 0 ? `${val}%` : '-'}
                </td>
              );
            })}
          </tr>

          <tr className="hover:bg-amber-500/10 transition-colors">
            <td colSpan="2" className="border-r border-base-300 px-3 py-1.5 font-bold text-amber-500 truncate">
              OT working day rate(%)
            </td>
            <td className="border-r border-base-300 px-1.5 py-1.5 text-center font-black bg-amber-500/20 text-amber-500 whitespace-nowrap">
              {rowSums.r22}
            </td>
            {displayDays.map(day => {
              const val = calculatedRows[day]?.r22;
              const hasRegister = Number(calculatedRows[day]?.r1) > 0;
              return (
                <td key={day} className={`border-r border-base-300 px-0.5 py-1.5 text-center font-bold ${val === '#DIV/0!' ? 'text-base-content/40' : 'text-amber-500'}`}>
                  {hasRegister && val !== '#DIV/0!' && Number(val) !== 0 ? `${val}%` : '-'}
                </td>
              );
            })}
          </tr>

          <tr className="hover:bg-emerald-500/10 transition-colors border-b border-base-300">
            <td colSpan="2" className="border-r border-base-300 px-3 py-1.5 font-bold text-emerald-500 truncate">
              OT Holiday day rate(%)
            </td>
            <td className="border-r border-base-300 px-1.5 py-1.5 text-center font-black bg-emerald-500/20 text-emerald-500 whitespace-nowrap">
              {rowSums.r23}
            </td>
            {displayDays.map(day => {
              const val = calculatedRows[day]?.r23;
              const hasRegister = Number(calculatedRows[day]?.r1) > 0;
              return (
                <td key={day} className={`border-r border-base-300 px-0.5 py-1.5 text-center font-bold ${val === '#DIV/0!' ? 'text-base-content/40' : 'text-emerald-500 bg-emerald-500/10'}`}>
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
