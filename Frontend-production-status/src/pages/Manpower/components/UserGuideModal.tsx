/**
 * Component: UserGuideModal
 * หน้าต่างแสดงคู่มือการใช้งานระบบ Manpower Dashboard แบบละเอียด
 * - อธิบายฟังก์ชันการใช้งาน, โครงสร้างตาราง Man-Hour, การอ่านค่าสถิติกำลังคน, และเครื่องมือ Admin
 * - รองรับ 2 ภาษา (ไทย / อังกฤษ)
 */
import React, { useState } from "react";
import {
  BookOpen,
  X,
  Sparkles,
  Layers,
  TrendingUp,
  Settings2,
  Clock,
  SlidersHorizontal,
  FileSpreadsheet,
  Info,
  Lightbulb,
  ShieldCheck,
} from "lucide-react";

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserGuideModal({ isOpen, onClose }: UserGuideModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "charts" | "features">("overview");
  const [lang, setLang] = useState<"th" | "en">("th");
  const isThai = lang === "th";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-[1600px] overflow-hidden rounded-3xl border border-white/30 bg-white shadow-[0_30px_90px_rgba(0,0,0,0.45)] animate-in zoom-in-95 duration-200">
        
        {/* ส่วนหัว (Header) */}
        <div className="shrink-0 relative overflow-hidden bg-gradient-to-r from-[#193886] via-[#1F46A4] to-[#2563EB] px-7 py-4 text-white shadow-md">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute left-1/3 -bottom-10 h-32 w-32 rounded-full bg-blue-400/20 blur-xl" />

          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-md border border-white/30">
                <BookOpen size={28} className="text-white drop-shadow" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-white/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-blue-100 backdrop-blur-sm">
                    {isThai ? "คู่มือระบบกำลังคน" : "MANPOWER SYSTEM MANUAL"}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-sm mt-0.5">
                  {isThai ? "คู่มือการใช้งาน Manpower Dashboard" : "Manpower Dashboard User Manual"}
                </h2>
                <p className="text-sm text-blue-100 font-medium opacity-90">
                  {isThai
                    ? "แนะนำโครงสร้าง ฟังก์ชันการใช้งาน การวิเคราะห์กำลังคน และการจัดการข้อมูล"
                    : "Complete overview of dashboard navigation, workforce metrics, analytics features, and administrative tools."}
                </p>
              </div>
            </div>

            {/* ปุ่มควบคุมฝั่งขวา: เปลี่ยนภาษาและปิดหน้าต่าง */}
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-xl bg-black/25 p-1 border border-white/20 shadow-inner">
                <button
                  onClick={() => setLang("th")}
                  className={`px-4 py-1.5 text-sm font-black rounded-lg transition-all cursor-pointer ${
                    lang === "th"
                      ? "bg-white text-blue-700 shadow-md scale-100"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  TH
                </button>
                <button
                  onClick={() => setLang("en")}
                  className={`px-4 py-1.5 text-sm font-black rounded-lg transition-all cursor-pointer ${
                    lang === "en"
                      ? "bg-white text-blue-700 shadow-md scale-100"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  EN
                </button>
              </div>

              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/30 transition-all active:scale-90 cursor-pointer border border-white/20"
                title={isThai ? "ปิดหน้าต่าง" : "Close"}
              >
                <X size={22} />
              </button>
            </div>
          </div>
        </div>

        {/* แท็บเมนูนำทาง (Navigation Tabs) */}
        <div className="shrink-0 border-b border-slate-200 bg-slate-50/90 px-6 pt-3.5 backdrop-blur-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: "overview", label: isThai ? "1. ภาพรวมระบบ & เมนูหลัก" : "1. System Overview & Tabs", icon: Info },
              { id: "charts", label: isThai ? "2. กราฟ & ตัวกรองข้อมูล" : "2. Charts & Filters", icon: TrendingUp },
              { id: "features", label: isThai ? "3. ระบบ Admin & การจัดการข้อมูล" : "3. Admin Tools & Management", icon: Settings2 },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`group relative flex items-center justify-center gap-2.5 rounded-2xl py-3 px-3 text-base font-black transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-white text-[#193886] shadow-lg shadow-slate-200 border border-slate-200 scale-[1.01]"
                      : "text-slate-600 hover:text-[#193886] hover:bg-white/70"
                  }`}
                >
                  <Icon
                    size={20}
                    className={`shrink-0 transition-transform group-hover:scale-110 ${
                      isActive ? "text-[#193886]" : "text-slate-400 group-hover:text-blue-500"
                    }`}
                  />
                  <span className="leading-tight text-center">{item.label}</span>
                  {isActive && (
                    <div className="absolute -bottom-[14px] left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-[#193886]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ส่วนเนื้อหาหลักของหน้าต่างคู่มือ */}
        <div className="p-6 bg-gradient-to-b from-slate-50/40 via-white to-white">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 via-indigo-50/40 to-white p-5 shadow-xs">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#193886] text-white shadow-md shadow-blue-500/25">
                    <Sparkles size={26} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-[#193886]">
                      {isThai ? "ภาพรวมระบบ" : "SYSTEM OVERVIEW"}
                    </span>
                    <h3 className="text-xl font-black text-slate-900 leading-tight">
                      {isThai ? "ยินดีต้อนรับสู่ Manpower Dashboard" : "Welcome to Manpower Dashboard"}
                    </h3>
                    <p className="text-base text-slate-700 leading-relaxed font-bold">
                      {isThai
                        ? "แดชบอร์ดติดตามและวิเคราะห์กำลังคนแบบ Real-time ครอบคลุมทั้งการลงเวลาทำงาน (Attendance), การลางาน (Leave), การทำงานล่วงเวลา (OT), การยืม-โอนช่วยงานข้ามแผนก/โรงงาน พร้อมคำนวณชั่วโมงทำงาน (Man-Hour) ให้ตรงตามสูตรการผลิตโดยอัตโนมัติ"
                        : "Comprehensive manpower management & analytics dashboard showing real-time attendance, leave ratios, overtime, cross-factory loans, and aggregated man-hour formulas."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Department Tabs Explanation */}
              <div>
                <h4 className="text-base font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-[#193886]" />
                  {isThai ? "โครงสร้างเมนูแยกตามแผนก (Department Tabs)" : "Department Navigation"}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  {[
                    { name: "MACRO PCN", desc: isThai ? "ภาพรวมกำลังคนทั้งหมดของโรงงาน P1" : "Overall aggregate metrics for Plant 1" },
                    { name: "FPC DATA", desc: isThai ? "ข้อมูลกำลังคนเฉพาะแผนก FPC" : "FPC Department manpower & lines" },
                    { name: "SMT DATA", desc: isThai ? "ข้อมูลกำลังคนเฉพาะแผนก SMT" : "SMT Department manpower & lines" },
                    { name: "QA DATA", desc: isThai ? "ข้อมูลกำลังคนเฉพาะแผนก QA" : "QA team manpower" },
                    { name: "IND DATA", desc: isThai ? "ข้อมูลกำลังคนฝ่ายสนับสนุน (Indirect)" : "Indirect & support teams" },
                  ].map((dept) => (
                    <div key={dept.name} className="rounded-2xl border-2 border-slate-100 bg-white p-4 shadow-2xs hover:shadow-xs transition">
                      <div className="rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-sm font-black text-[#193886] inline-block mb-1.5 self-start">
                        {dept.name}
                      </div>
                      <p className="text-sm text-slate-700 font-bold leading-snug">{dept.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Indicators */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <h4 className="text-base font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-emerald-600" />
                  {isThai ? "ความหมายของสถานะและสีกราฟ" : "Color Codes & Status Definitions"}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="flex items-start gap-3 rounded-xl bg-sky-50/90 border border-sky-200 p-4">
                    <div className="h-5 w-5 rounded-md bg-sky-500 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-base font-black text-sky-950">{isThai ? "Working (มาทำงาน)" : "Working (Active)"}</h5>
                      <p className="text-sm text-slate-700 font-bold mt-0.5 leading-snug">{isThai ? "พนักงานที่สแกนบัตรเข้าทำงานจริงในกะนั้นๆ" : "Employees with valid swipe-card records"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl bg-rose-50/90 border border-rose-200 p-4">
                    <div className="h-5 w-5 rounded-md bg-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-base font-black text-rose-950">{isThai ? "Leave (การลางาน)" : "Leave (Absence)"}</h5>
                      <p className="text-sm text-slate-700 font-bold mt-0.5 leading-snug">{isThai ? "พนักงานที่ลางานทุกประเภท เช่น ลาป่วย ลาพักร้อน ลากิจ" : "All approved leave records"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl bg-purple-50/90 border border-purple-200 p-4">
                    <div className="h-5 w-5 rounded-md bg-purple-500 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-base font-black text-purple-950">{isThai ? "Off / Weekend (วันหยุด)" : "Weekend / Holiday"}</h5>
                      <p className="text-sm text-slate-700 font-bold mt-0.5 leading-snug">{isThai ? "วันหยุดประจำสัปดาห์หรือวันหยุดนักขัตฤกษ์" : "Scheduled factory off-days"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CHARTS & FILTERS */}
          {activeTab === "charts" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#193886]">
                      <SlidersHorizontal size={22} />
                    </div>
                    <h4 className="text-lg font-black text-slate-900">
                      {isThai ? "ตัวกรองและการแสดงผลกราฟ" : "Graph Filter Controls"}
                    </h4>
                  </div>
                  <ul className="space-y-3 text-base text-slate-700 font-bold leading-relaxed">
                    <li className="flex items-start gap-2.5">
                      <span className="font-black text-[#193886] text-lg">▪</span>
                      <span><b>All Lines / Select Line:</b> {isThai ? "สลับดูภาพรวมทุกไลน์พร้อมกัน หรือเลือกเจาะจงเฉพาะไลน์ที่ต้องการ" : "Switch between viewing all production lines or isolating single lines."}</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="font-black text-[#193886] text-lg">▪</span>
                      <span><b>Date / Week / Line:</b> {isThai ? "เปลี่ยนมุมมองกราฟตามรายวัน, รายสัปดาห์ หรือเปรียบเทียบระหว่างไลน์" : "Toggle time dimensions between daily, weekly, or line comparison."}</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="font-black text-[#193886] text-lg">▪</span>
                      <span><b>Persons vs % Rate:</b> {isThai ? "ดูจำนวนคนจริง (Headcount) หรือดูเป็นอัตราส่วนเปอร์เซ็นต์ (% Leave / % OT)" : "View absolute headcount numbers or percentage ratios."}</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <FileSpreadsheet size={22} />
                    </div>
                    <h4 className="text-lg font-black text-slate-900">
                      {isThai ? "ตารางสรุปข้อมูลประจำวัน (Daily Man-Hour Table)" : "Man-Hour Matrix Table"}
                    </h4>
                  </div>
                  <p className="text-base text-slate-700 font-bold leading-relaxed">
                    {isThai 
                      ? "ตารางด้านล่างรวบรวมตัวเลขการลงเวลาครบทั้ง 31 วัน แสดงทั้งยอดพนักงานลงทะเบียน (OP & Leader), ยอดสแกนบัตรจริง, ชั่วโมง OT, ยอดไปช่วยงานข้ามโรงงาน และการคำนวณ % Leave / % OT ตามสูตรมาตรฐาน"
                      : "The lower spreadsheet matrix shows complete 31-day daily breakdowns, including register count, swipe records, OT, cross-factory loan deductions, and accurate leave/OT ratios."}
                  </p>
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-base font-black text-amber-950 flex items-start gap-2.5">
                    <Lightbulb size={20} className="text-amber-600 shrink-0 mt-0.5" />
                    <span>{isThai ? "คำแนะนำ: คลิกที่แถวในตารางเพื่อขยายดูรายละเอียดย่อย หรือดูการตัดยอดคนไปช่วยงานได้อย่างครบถ้วน" : "Tip: You can expand rows to inspect granular direct vs indirect metrics."}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/70 p-4 flex items-center justify-between">
                <span className="text-base font-black text-[#193886]">
                  {isThai ? "📊 คำนวณแบบ Real-time:" : "📊 Real-time Calculation Engine:"}
                </span>
                <span className="text-base text-slate-700 font-bold">
                  {isThai ? "ระบบจะตัดยอดพนักงานที่ไปช่วยงาน (Loan Exclude) และคำนวณตัวเลขในกราฟและตารางให้ตรงกันโดยอัตโนมัติ" : "Calculations and loan exclusions are automatically synced across charts and matrices."}
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: ADMIN TOOLS */}
          {activeTab === "features" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 p-4">
                <h3 className="text-lg font-black text-[#193886] mb-0.5 flex items-center gap-2.5">
                  <ShieldCheck className="h-6 w-6 text-[#193886]" />
                  {isThai ? "เครื่องมือจัดการข้อมูลสำหรับ Admin (Admin Tools)" : "Administrator Toolbar & Management"}
                </h3>
                <p className="text-base text-slate-700 font-bold">
                  {isThai ? "กดเข้าใช้งานได้ผ่านปุ่ม 'Admin Login' ที่มุมขวาบนของหน้าจอ" : "Log in via the 'Admin Login' button at the top-right corner to access full edit permissions."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* เมนูจัดการข้อมูลพนักงาน (Manage Data) */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white text-base shadow-xs">📝</span>
                    <h4 className="text-base font-black text-slate-900">
                      {isThai ? "Manage Data (จัดการข้อมูลพนักงานรายวัน)" : "Manage Data (All-in-One)"}
                    </h4>
                  </div>
                  <p className="text-base text-slate-700 font-bold leading-relaxed">
                    {isThai 
                      ? "ศูนย์กลางจัดการข้อมูลพนักงาน: สามารถเลือกวันที่เพื่อค้นหาพนักงาน, ปรับสถานะการทำงาน (ทำงานปกติ, วันหยุด, ไปช่วย Factory อื่น), แก้ไขเวลาสแกนบัตร, เพิ่มพนักงานใหม่ หรือลบข้อมูลรายวัน"
                      : "Unified modal to add new employees, adjust daily attendance statuses (Work, Holiday, Cross-Factory Loan), edit clock-in/out times, and delete individual daily records."}
                  </p>
                </div>

                {/* Manage Lines */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white text-base shadow-xs">🧩</span>
                    <h4 className="text-base font-black text-slate-900">
                      {isThai ? "Manage Lines (จัดการและจับกลุ่มไลน์ผลิต)" : "Manage Lines (Line Mapping)"}
                    </h4>
                  </div>
                  <p className="text-base text-slate-700 font-bold leading-relaxed">
                    {isThai 
                      ? "สร้างไลน์ผลิตใหม่และจับคู่ไลน์ย่อยมารวมยอดเข้าด้วยกัน เช่น รวมยอด MOT/A + MOT/B เป็น AIX-MOT พร้อมกำหนดกะทำงานและแท็บแผนกที่ต้องการแสดงผล"
                      : "Create parent production lines and combine multiple child lines into unified rollup views with custom shift and tab filters."}
                  </p>
                </div>

                {/* Import / Export */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white text-base shadow-xs">📊</span>
                    <h4 className="text-base font-black text-slate-900">
                      {isThai ? "Import / Export Data (นำเข้าและส่งออกข้อมูล)" : "Import / Export Data"}
                    </h4>
                  </div>
                  <p className="text-base text-slate-700 font-bold leading-relaxed">
                    {isThai 
                      ? "นำเข้าไฟล์ข้อมูลสแกนบัตร (Excel) เข้าสู่ระบบอย่างสะดวกรวดเร็ว หรือดาวน์โหลดไฟล์สรุปรายงานประจำเดือนออกไปใช้งานต่อภายนอก"
                      : "Import raw attendance Excel files into PostgreSQL, or export complete monthly summary reports directly to Excel."}
                  </p>
                </div>

                {/* Manage Admins */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white text-base shadow-xs">👥</span>
                    <h4 className="text-base font-black text-slate-900">
                      {isThai ? "Manage Admins (จัดการสิทธิ์ผู้ดูแลระบบ)" : "Manage Admin Accounts"}
                    </h4>
                  </div>
                  <p className="text-base text-slate-700 font-bold leading-relaxed">
                    {isThai 
                      ? "สร้างและจัดการบัญชีผู้ดูแลระบบ (Username & Password) เพื่อกำหนดสิทธิ์ให้เจ้าหน้าที่เข้ามาแก้ไขข้อมูลได้ปลอดภัย"
                      : "Create and manage authorized administrator credentials for secure access control."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-7 py-3.5">
          <div className="flex items-center gap-2.5 text-sm sm:text-base text-slate-700 font-bold">
            <Lightbulb size={22} className="text-amber-500 shrink-0" />
            <span>
              {isThai 
                ? "คำแนะนำ: ข้อมูลกำลังคนและระบบตัดยอดช่วยงานจะคำนวณให้คุณแบบ Real-time เสมอ" 
                : "Tip: Manpower metrics and loan exclusions are calculated in real-time."}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#193886] to-[#2563EB] px-7 py-2.5 text-base font-black text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl active:scale-95 cursor-pointer"
          >
            <span>{isThai ? "เข้าใจแล้ว / ปิดหน้าต่าง" : "Got it / Close"}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
