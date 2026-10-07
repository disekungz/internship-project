import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  Trash2,
  X,
  Plus,
  Sparkles,
  ChevronRight,
  TrendingUp,
  HelpCircle,
  Languages,
  BookOpen,
  Info,
  Check,
} from 'lucide-react';
import { CustomTargetRecord } from '../api/deptSummary';

interface CustomTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: string; // e.g. '2026-09'
  kind: 'leave' | 'ot';
  customTargets: CustomTargetRecord[];
  onMonthChange?: (newMonth: string) => void;
  onAddTarget: (target: CustomTargetRecord) => Promise<void>;
  onDeleteTarget: (id: number) => Promise<void>;
}

export const CustomTargetModal: React.FC<CustomTargetModalProps> = ({
  isOpen,
  onClose,
  month,
  kind,
  customTargets,
  onMonthChange,
  onAddTarget,
  onDeleteTarget,
}) => {
  const [lang, setLang] = useState<'th' | 'en'>('th');
  const [showGuide, setShowGuide] = useState(false);
  const [activeMonth, setActiveMonth] = useState<string>(month || new Date().toISOString().slice(0, 7));
  const [targetType, setTargetType] = useState<'ot_daily' | 'ot_acc' | 'leave'>(
    kind === 'ot' ? 'ot_daily' : 'leave'
  );
  const [dayFrom, setDayFrom] = useState<number>(1);
  const [dayTo, setDayTo] = useState<number>(19);
  const [targetValue, setTargetValue] = useState<string>(kind === 'ot' ? '60' : '4');
  const [note, setNote] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // ซิงค์ targetType และค่าเริ่มต้นตามโหมดที่เปิดอยู่ (OT หรือ Leave)
  React.useEffect(() => {
    if (kind === 'leave') {
      setTargetType('leave');
      setTargetValue('5');
    } else {
      setTargetType('ot_daily');
      setTargetValue('75');
    }
  }, [kind, isOpen]);

  React.useEffect(() => {
    if (month) setActiveMonth(month);
  }, [month]);

  // ซ่อน scrollbar ของหน้าหลัก และ main container ด้านหลังทั้งหมดทันทีที่เปิด Modal
  useEffect(() => {
    if (!isOpen) return;

    const mainEl = document.querySelector('main');
    const prevMainOverflow = mainEl ? mainEl.style.overflow : '';
    const prevBodyOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    if (mainEl) {
      mainEl.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      if (mainEl) {
        mainEl.style.overflow = prevMainOverflow;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // คำนวณจำนวนวันในเดือนที่เลือก
  const daysInMonth = activeMonth
    ? new Date(Number(activeMonth.slice(0, 4)), Number(activeMonth.slice(5, 7)), 0).getDate()
    : 31;

  const relevantTargets = customTargets.filter((t) => {
    if (kind === 'ot') return t.target_type === 'ot_daily' || t.target_type === 'ot_acc';
    return t.target_type === 'leave';
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(targetValue);
    if (isNaN(val)) return;

    const fromNum = Math.min(Math.max(1, dayFrom), daysInMonth);
    const toNum = Math.min(Math.max(fromNum, dayTo), daysInMonth);
    const dateFromStr = `${activeMonth}-${String(fromNum).padStart(2, '0')}`;
    const dateToStr = `${activeMonth}-${String(toNum).padStart(2, '0')}`;

    setSaving(true);
    try {
      await onAddTarget({
        month: activeMonth,
        date_from: dateFromStr,
        date_to: dateToStr,
        target_type: targetType,
        target_value: val,
        note: note.trim() || undefined,
      });
      setNote('');
    } finally {
      setSaving(false);
    }
  };

  // Quick Presets อำนวยความสะดวก
  const applyPreset = (from: number, to: number, defaultVal?: string) => {
    setDayFrom(from);
    setDayTo(Math.min(to, daysInMonth));
    if (defaultVal) setTargetValue(defaultVal);
  };

  const monthFormatted = (() => {
    const [y, m] = activeMonth.split('-');
    if (!y || !m) return activeMonth;
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  })();

  const isTh = lang === 'th';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200"
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-2xl max-h-[92vh] rounded-3xl bg-base-100 shadow-2xl border border-base-300 overflow-hidden flex flex-col transition-all">
        {/* 🌟 Modern Header */}
        <div className="relative px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-inner">
              <Sparkles className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  {isTh ? 'กำหนดระดับ Target ตามวัน' : 'Custom Daily Targets'}
                </h3>
                {/* Month badge selector */}
                <input
                  type="month"
                  value={activeMonth}
                  onChange={(e) => {
                    if (e.target.value) {
                      setActiveMonth(e.target.value);
                      onMonthChange?.(e.target.value);
                    }
                  }}
                  className="cursor-pointer rounded-full border border-white/20 bg-white/15 px-3 py-0.5 text-xs font-black text-white backdrop-blur-md outline-none transition hover:bg-white/25 focus:ring-2 focus:ring-white/40"
                  title={isTh ? 'คลิกเพื่อเปลี่ยนเดือน' : 'Click to change month'}
                />
              </div>
              <p className="text-xs text-slate-300 font-medium">
                {isTh
                  ? `ปรับระดับเส้น Target ตามช่วงวันในเดือน ${monthFormatted}`
                  : `Adjust target step lines across dates in ${monthFormatted}`}
              </p>
            </div>
          </div>

          {/* Action buttons: Guide, Lang Switch, Close */}
          <div className="flex items-center gap-1.5">
            {/* Guide Button */}
            <button
              type="button"
              onClick={() => setShowGuide((prev) => !prev)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer border ${
                showGuide
                  ? 'bg-amber-400 text-base-content border-amber-300 shadow'
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
              }`}
              title={isTh ? 'คู่มือการใช้งาน' : 'User Guide'}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>{isTh ? 'คู่มือ' : 'Guide'}</span>
            </button>

            {/* Language Switch */}
            <button
              type="button"
              onClick={() => setLang(isTh ? 'en' : 'th')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-white/10 text-white border border-white/20 hover:bg-white/20 transition active:scale-95 cursor-pointer"
              title={isTh ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
            >
              <Languages className="h-3.5 w-3.5 text-blue-300" />
              <span>{isTh ? 'EN' : 'ไทย'}</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-white/70 hover:bg-white/15 hover:text-white transition active:scale-95 cursor-pointer ml-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 📖 Inline User Guide Panel (เมื่อกดเปิดคู่มือ) */}
        {showGuide && (
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-3.5 sm:p-4 border-b border-amber-500/30 text-base-content animate-in slide-in-from-top-2 duration-150 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 w-full">
                <div className="flex items-center gap-2 font-black text-base-content text-sm sm:text-base">
                  <Info className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>{isTh ? '📖 วิธีใช้งานง่าย ๆ ใน 3 ขั้นตอน:' : '📖 Simple 3-Step Guide:'}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="bg-base-100 p-2.5 rounded-xl border border-amber-500/30 shadow-2xs">
                    <span className="inline-block px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-500 font-black text-xs mb-1">
                      {isTh ? 'ขั้นตอน 1' : 'Step 1'}
                    </span>
                    <p className="font-black text-base-content text-xs sm:text-sm">
                      {isTh ? (kind === 'ot' ? 'เลือกเส้นเป้าหมาย' : 'เป้าหมายการลา') : (kind === 'ot' ? 'Select Target Line' : 'Leave Target')}
                    </p>
                    <p className="text-[11px] sm:text-xs text-base-content/70 mt-0.5 leading-snug">
                      {kind === 'ot'
                        ? isTh
                          ? 'เลือกระหว่าง Target OT รายวัน (สีน้ำเงิน) หรือ OT สะสม (สีแดง)'
                          : 'Choose Daily OT (Blue) or Accumulated OT (Red)'
                        : isTh
                          ? 'กำหนดเป้าหมาย Leave Ratio (เส้นประสีแดง Target ≤ %)'
                          : 'Set Leave Ratio Target (Dashed Target line)'}
                    </p>
                  </div>
                  <div className="bg-base-100 p-2.5 rounded-xl border border-amber-500/30 shadow-2xs">
                    <span className="inline-block px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-500 font-black text-xs mb-1">
                      {isTh ? 'ขั้นตอน 2' : 'Step 2'}
                    </span>
                    <p className="font-black text-base-content text-xs sm:text-sm">
                      {isTh ? 'ระบุวันและ % เป้าหมาย' : 'Set Range & Target'}
                    </p>
                    <p className="text-[11px] sm:text-xs text-base-content/70 mt-0.5 leading-snug">
                      {kind === 'ot'
                        ? isTh
                          ? 'กดปุ่มเลือกด่วน (เช่น 1–19 หรือ 20–30) หรือพิมพ์วันที่และ %'
                          : 'Click quick preset (1–19, 20–30) or enter day range & %'
                        : isTh
                          ? 'ระบุช่วงวันและ % ที่ยอมรับได้ (เช่น 4% หรือ 3.5%)'
                          : 'Specify day range and accepted % (e.g. 4% or 3.5%)'}
                    </p>
                  </div>
                  <div className="bg-base-100 p-2.5 rounded-xl border border-amber-500/30 shadow-2xs">
                    <span className="inline-block px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 font-black text-xs mb-1">
                      {isTh ? 'ขั้นตอน 3' : 'Step 3'}
                    </span>
                    <p className="font-black text-base-content text-xs sm:text-sm">
                      {isTh ? 'กด "บันทึกช่วงนี้"' : 'Click Save'}
                    </p>
                    <p className="text-[11px] sm:text-xs text-base-content/70 mt-0.5 leading-snug">
                      {isTh
                        ? 'เส้นกราฟจะปรับเป็นขั้นบันไดตามวันที่กำหนดทันที'
                        : 'Chart step line will update immediately on save'}
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="text-amber-500 hover:text-base-content p-1 rounded-lg hover:bg-amber-500/20 transition cursor-pointer shrink-0"
                title={isTh ? 'ปิดคำแนะนำ' : 'Close Guide'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* 📝 Content Body (Scroll ได้เฉพาะด้านในตัวเนื้อหาถ้าหน้าจอเตี้ย โดย Header และปุ่มเสร็จสิ้นจะตรึงอยู่เสมอ ไม่หลุดขอบจอ) */}
        <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden bg-base-200/50">
          {/* Card: New Target Form */}
          <form
            onSubmit={handleSave}
            className="rounded-2xl border border-base-300/90 bg-base-100 p-4 sm:p-5 shadow-xs space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-base-300">
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 rounded-full bg-blue-600 ring-4 ring-blue-500/20" />
                <span className="text-sm sm:text-base font-black text-base-content tracking-tight">
                  {isTh
                    ? `เพิ่มช่วงวันใหม่ (${kind === 'ot' ? 'กำหนดเป้า OT' : 'กำหนดเป้า Leave'})`
                    : `Add New Range (${kind === 'ot' ? 'OT Target' : 'Leave Target'})`}
                </span>
              </div>
              {/* Quick Presets */}
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
                <span className="text-base-content/50 font-semibold">{isTh ? 'กดเลือกด่วน:' : 'Quick Presets:'}</span>
                <button
                  type="button"
                  onClick={() => applyPreset(1, 19, kind === 'ot' ? '60' : '4')}
                  className="rounded-xl bg-base-200 hover:bg-blue-500/15 hover:text-blue-700 px-3 py-1.5 text-base-content font-black transition cursor-pointer text-xs sm:text-sm"
                >
                  1–19
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(20, daysInMonth, kind === 'ot' ? '30' : '4')}
                  className="rounded-xl bg-base-200 hover:bg-blue-500/15 hover:text-blue-700 px-3 py-1.5 text-base-content font-black transition cursor-pointer text-xs sm:text-sm"
                >
                  20–{daysInMonth}
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(1, daysInMonth)}
                  className="rounded-xl bg-base-200 hover:bg-blue-500/15 hover:text-blue-700 px-3 py-1.5 text-base-content font-black transition cursor-pointer text-xs sm:text-sm"
                >
                  {isTh ? 'ทั้งเดือน' : 'Full Month'}
                </button>
              </div>
            </div>

            {/* Target Type Selector */}
            {kind === 'ot' && (
              <div>
                <label className="block text-xs sm:text-sm font-black uppercase text-base-content/80 mb-2">
                  {isTh ? '1. เลือกเส้นเป้าหมายที่ต้องการปรับ' : '1. Select Target Line to Configure'}
                </label>
                <div className="grid grid-cols-2 gap-2.5 p-1.5 bg-base-200/90 rounded-2xl border border-base-300/80">
                  <button
                    type="button"
                    onClick={() => setTargetType('ot_daily')}
                    className={`flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                      targetType === 'ot_daily'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-base-content/80 hover:text-base-content hover:bg-white/70'
                    }`}
                  >
                    <span className="h-3 w-3 rounded-full bg-white shadow-xs shrink-0" />
                    <span>{isTh ? 'Target OT รายวัน (เส้นสีน้ำเงิน)' : 'Target OT Daily (Blue Line)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('ot_acc')}
                    className={`flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                      targetType === 'ot_acc'
                        ? 'bg-red-600 text-white shadow'
                        : 'text-base-content/80 hover:text-base-content hover:bg-white/70'
                    }`}
                  >
                    <span className="h-3 w-3 rounded-full bg-white shadow-xs shrink-0" />
                    <span>{isTh ? 'Target OT สะสม (เส้นสีแดง)' : 'Target OT Acc. (Red Line)'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Date Range & Target Value */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              {/* ช่วงวัน */}
              <div className="sm:col-span-7 space-y-1.5">
                <label className="block text-xs sm:text-sm font-black uppercase text-base-content/80">
                  {isTh ? `2. ช่วงวันที่ (1 ถึง ${daysInMonth})` : `2. Date Range (1 to ${daysInMonth})`}
                </label>
                <div className="flex items-center gap-2 bg-base-200 rounded-2xl border border-base-300 p-2">
                  <span className="text-xs sm:text-sm font-black text-base-content/60 pl-2">{isTh ? 'วัน' : 'Day'}</span>
                  <input
                    type="number"
                    min={1}
                    max={daysInMonth}
                    value={dayFrom}
                    onChange={(e) => setDayFrom(parseInt(e.target.value, 10) || 1)}
                    className="w-full text-center rounded-xl bg-base-100 border border-base-300 py-1.5 text-base sm:text-lg font-black text-base-content outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <ChevronRight className="h-5 w-5 text-base-content/50 shrink-0" />
                  <span className="text-xs sm:text-sm font-black text-base-content/60">{isTh ? 'ถึง' : 'To'}</span>
                  <input
                    type="number"
                    min={dayFrom}
                    max={daysInMonth}
                    value={dayTo}
                    onChange={(e) => setDayTo(parseInt(e.target.value, 10) || dayFrom)}
                    className="w-full text-center rounded-xl bg-base-100 border border-base-300 py-1.5 text-base sm:text-lg font-black text-base-content outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* ค่า Target % */}
              <div className="sm:col-span-5 space-y-1.5">
                <label className="block text-xs sm:text-sm font-black uppercase text-base-content/80">
                  {isTh ? '3. ค่าเป้าหมาย (%)' : '3. Target Value (%)'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={targetValue}
                    placeholder={isTh ? 'เช่น 60' : 'e.g. 60'}
                    onChange={(e) => setTargetValue(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-base-300 bg-base-100 pl-4 pr-10 py-2 text-lg sm:text-xl font-black text-blue-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="pointer-events-none absolute right-4 top-2.5 text-base font-black text-base-content/50 select-none">%</span>
                </div>
              </div>

              {/* หมายเหตุ & ปุ่ม Save */}
              <div className="sm:col-span-12 flex flex-col sm:flex-row gap-2.5 pt-1">
                <input
                  type="text"
                  placeholder={
                    isTh
                      ? 'หมายเหตุ (ตัวเลือกเพิ่มเติม เช่น ปรับลดช่วงปลายเดือน)'
                      : 'Note (Optional, e.g., Adjusted for month-end target)'
                  }
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="flex-1 rounded-2xl border border-base-300 bg-base-200/70 px-4 py-2.5 text-xs sm:text-sm text-base-content outline-none focus:bg-base-100 focus:border-blue-500 transition"
                />
                <button
                  type="submit"
                  disabled={saving || !targetValue}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-sm sm:text-base font-black text-white shadow-md hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition active:scale-95 cursor-pointer"
                >
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span>{saving ? (isTh ? 'กำลังบันทึก...' : 'Saving...') : isTh ? 'บันทึกช่วงนี้' : 'Save Range'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* รายการที่มีผลอยู่ในเดือนนี้ */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-base-content/80" />
                <h4 className="text-sm sm:text-base font-black text-base-content">
                  {isTh
                    ? `รายการ Target ในเดือน ${monthFormatted}`
                    : `Active Targets for ${monthFormatted}`}
                </h4>
              </div>
              <span className="text-xs sm:text-sm font-black px-3 py-0.5 rounded-full bg-base-300 text-base-content/80">
                {relevantTargets.length} {isTh ? 'ช่วง' : 'ranges'}
              </span>
            </div>

            {relevantTargets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-base-300 bg-base-100/80 p-6 text-center space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-base-200 text-base-content/50">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="text-sm sm:text-base font-black text-base-content/80">
                  {isTh ? 'ยังไม่มีการกำหนดระดับ Target เฉพาะช่วงวัน' : 'No Custom Date Ranges Set'}
                </div>
                <div className="text-xs sm:text-sm text-base-content/60 max-w-md mx-auto leading-relaxed">
                  {isTh
                    ? 'เส้นเป้าหมายบนกราฟจะใช้อัตราคงที่ตลอดทั้งเดือน (สามารถคลิกปุ่มเลือกด่วน 1–19 หรือ 20–30 ด้านบนเพื่อเริ่มกำหนด)'
                    : 'Target lines currently use a fixed rate for the entire month'}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {relevantTargets.map((item) => {
                  const dayStart = parseInt(item.date_from.split('-')[2], 10);
                  const dayEnd = parseInt(item.date_to.split('-')[2], 10);
                  const isDaily = item.target_type === 'ot_daily';
                  const isAcc = item.target_type === 'ot_acc';

                  return (
                    <div
                      key={item.id}
                      className="group flex items-center justify-between rounded-2xl border border-base-300/90 bg-base-100 p-3.5 shadow-2xs hover:border-blue-300 transition-all"
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`h-9 w-2 rounded-full ${
                            isDaily ? 'bg-blue-600' : isAcc ? 'bg-red-600' : 'bg-emerald-600'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="text-sm sm:text-base font-black text-base-content">
                              {isTh ? `วันที่ ${dayStart} – ${dayEnd}` : `Day ${dayStart} – ${dayEnd}`}
                            </span>
                            <span
                              className={`text-xs font-black px-2.5 py-0.5 rounded-lg ${
                                isDaily
                                  ? 'bg-blue-500/10 text-blue-700 border border-blue-500/30'
                                  : isAcc
                                    ? 'bg-red-500/10 text-red-700 border border-red-500/30'
                                    : 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/30'
                              }`}
                            >
                              {isDaily
                                ? isTh ? 'OT รายวัน' : 'Daily OT'
                                : isAcc
                                  ? isTh ? 'OT สะสม' : 'Acc. OT'
                                  : isTh ? 'การลา' : 'Leave'}
                            </span>
                          </div>
                          {item.note ? (
                            <p className="text-xs sm:text-sm text-base-content/70 mt-0.5">{item.note}</p>
                          ) : (
                            <p className="text-xs sm:text-sm text-base-content/50 mt-0.5">{isTh ? 'ไม่มีหมายเหตุ' : 'No notes'}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-base sm:text-lg font-black text-base-content">
                            {item.target_value}%
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => item.id && onDeleteTarget(item.id)}
                          className="rounded-xl p-2 text-base-content/50 hover:bg-red-500/10 hover:text-red-600 transition active:scale-95 cursor-pointer"
                          title={isTh ? 'ลบช่วงนี้' : 'Delete this range'}
                        >
                          <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modern Footer */}
        <div className="px-5 py-3.5 border-t border-base-300 bg-base-100 flex items-center justify-between">
          <span className="text-xs sm:text-sm font-semibold text-base-content/60">
            {isTh ? '💡 ระบบจะอัปเดตกราฟทันทีเมื่อกดบันทึก' : '💡 Chart updates automatically upon save'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-slate-900 px-7 py-2.5 text-sm sm:text-base font-black text-white hover:bg-slate-800 transition active:scale-95 shadow-md cursor-pointer"
          >
            {isTh ? 'เสร็จสิ้น' : 'Done'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

