/**
 * Component: ImportSummaryModal
 * หน้าต่างแสดงรายงานสรุปผลลัพธ์หลังจากการนำเข้าไฟล์ Excel เสร็จสมบูรณ์
 * - แสดงจำนวนแถวทั้งหมด, นำเข้าสำเร็จ, รายชื่อพนักงาน, และจำนวนที่ซ้ำซ้อน
 * - สรุปยอดมาทำงานปกติ (Normal) และขาด/ลา (Absent)
 */
export default function ImportSummaryModal({ data, onClose }) {
  if (!data) return null;
  const stats = [['Excel rows', data.sourceRows], ['Imported', data.importedRows], ['Employees', data.employeeCount], ['Duplicates', data.duplicateRows]];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-900 to-blue-600 px-5 py-4 text-white"><div><p className="text-xs font-bold uppercase text-blue-200">Import completed</p><h2 className="mt-1 text-lg font-black">Import description</h2></div><button onClick={onClose} className="px-3 text-xl">×</button></div>
        <div className="space-y-4 p-5 text-sm">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="text-xs font-bold text-slate-500">File</p><p className="mt-1 break-all font-bold">{data.fileName}</p><p className="mt-1 text-xs">Month {data.month} · {data.mode === 'replace' ? 'Replace entire month' : data.mode === 'replace_day' ? 'Replace selected day(s)' : 'Daily data updates'}</p></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{stats.map(([label, value]) => <div key={label} className="rounded-xl border p-3 text-center"><p className="text-xl font-black text-blue-700">{Number(value).toLocaleString()}</p><p className="text-[11px] font-bold text-slate-500">{label}</p></div>)}</div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border p-3"><p className="text-xs font-bold text-slate-500">Date range</p><p className="font-bold">{data.startDate} to {data.endDate}</p></div><div className="rounded-xl border p-3"><p className="text-xs font-bold text-slate-500">Scan IN / OUT</p><p className="font-bold">{data.scanInCount.toLocaleString()} / {data.scanOutCount.toLocaleString()}</p></div><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-bold text-emerald-700">Normal: {data.normalCount.toLocaleString()}</div><div className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">Absent: {data.absentCount.toLocaleString()}</div></div>
          <button onClick={onClose} className="w-full rounded-xl bg-blue-700 px-4 py-2.5 font-bold text-white">Close</button>
        </div>
      </div>
    </div>
  );
}
