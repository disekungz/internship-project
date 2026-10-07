import React, { useState } from "react";
import {
  HelpCircle,
  X,
  CalendarDays,
  Workflow,
  Tags,
  Warehouse,
  PackageSearch,
  Clock3,
  BarChart3,
  Layers,
  Info,
  Filter,
  RotateCcw,
  Sparkles,
  Download,
  BookOpen,
  TrendingUp,
  Lightbulb,
  Building2,
  UsersRound,
} from "lucide-react";

type Language = "th" | "en";

export const ManualOverallModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [lang, setLang] = useState<Language>("th");
  const [activeTab, setActiveTab] = useState<
    "overview" | "filter" | "factory" | "legend" | "chart" | "export"
  >("overview");

  const t = {
    th: {
      btnOpen: "คู่มือการใช้งาน",
      btnOpenSub: "User Manual",
      headerBadge: "ระบบติดตามงานระหว่างผลิต (WIP)",
      headerTitle: "คู่มือการใช้งาน WIP Monitoring By Process Overall",
      headerSubtitle: "แดชบอร์ดตรวจสอบและติดตามปริมาณงาน WIP แยกตามขั้นตอนการผลิตและระยะเวลาค้างสะสม",
      tabOverview: "1. ภาพรวม & วิธีดูกราฟ",
      tabFilter: "2. ตัวกรองข้อมูล",
      tabFactory: "3. สลับโรงงาน (P1 / K1)",
      tabLegend: "4. ความหมายของสี Lead Time",
      tabChart: "5. กลุ่มกระบวนการผลิต",
      tabExport: "6. ส่งออกข้อมูล Excel",
      btnClose: "เข้าใจแล้ว / ปิดหน้าต่าง",
      tipFooter: "กดเปิดคู่มือนี้ หรือสลับภาษา TH / EN ได้ตลอดเวลาขณะใช้งาน",

      // แท็บ 1: ภาพรวมระบบ
      overviewBadge: "วัตถุประสงค์และการใช้งาน",
      overviewTitle: "ระบบนี้ช่วยอะไรคุณได้บ้าง?",
      overviewDesc:
        "แดชบอร์ดนี้ช่วยให้คุณมองเห็นภาพรวมงานระหว่างผลิต (WIP) ทั้งหมดของโรงงาน P1 และ K1 ได้แบบทันท่วงที โดยระบบจะรวมยอด Lot งานตามขั้นตอนการผลิต (Process) และแบ่งตามกลุ่มกระบวนการหลัก (EFPC_AUTO, EFPC_GEN, SMT) พร้อมแสดงระยะเวลาที่งานค้างในแต่ละจุด ทำให้คุณรู้ได้ทันทีว่ามีงานติดขัดหรือเกิดคอขวดที่ขั้นตอนใด",
      chartStructureTitle: "วิธีอ่านกราฟแท่งแจกแจงขั้นตอน (Grouped Process Stacked Bar)",
      chartStructurePoints: [
        { label: "แกน X (แนวนอน)", desc: "แสดงรายชื่อขั้นตอนการผลิตทั้งหมด เรียงตามกลุ่มสายงาน (EFPC_AUTO, EFPC_GEN, SMT)" },
        { label: "แกน Y (แนวตั้ง)", desc: "แสดงจำนวน Lot รวมของแต่ละขั้นตอน (TOTAL LOT)" },
        { label: "ตัวเลขบนยอดแท่ง", desc: "จำนวน Lot ทั้งหมดในขั้นตอนนั้น เพื่อให้เห็นยอดรวมทันทีโดยไม่ต้องบวกเอง" },
        { label: "สีในแท่งกราฟ", desc: "บอกอายุงานที่ค้างอยู่ในขั้นตอนนี้ แบ่งเป็น 3 ระดับ: น้อยกว่า 1 วัน, มากกว่า 1 วัน และมากกว่า 3 วัน" },
      ],
      kpiCardTitle: "การ์ดสรุปยอดรวมงานทั้งหมด (Count of lot WIP)",
      kpiCardDesc: "การ์ดสีน้ำเงินมุมบนขวา จะแสดงยอดรวม Lot ของงานระหว่างทำทั้งหมดตามเงื่อนไขที่คุณเลือกไว้ในตัวกรอง",

      // แท็บ 2: การใช้ตัวกรองข้อมูล
      filterHeader: "แถบตัวกรองข้อมูล (Filters)",
      filterDesc: "ใช้ค้นหาหรือเลือกดูเฉพาะข้อมูลที่ต้องการได้อย่างสะดวกรวดเร็ว:",
      f1Title: "Lot ID (หมายเลข Lot)",
      f1Desc: "พิมพ์ค้นหาหรือเลือกหมายเลข Lot ที่ต้องการติดตามเป็นพิเศษ",
      f2Title: "Product Name (ชื่อสินค้า)",
      f2Desc: "เลือกเฉพาะโมเดลสินค้าหรือรหัสชิ้นงานที่ต้องการ (เลือกพร้อมกันได้หลายรายการ)",
      f3Title: "Process (ขั้นตอนการผลิต)",
      f3Desc: "เลือกดูเฉพาะขั้นตอนการผลิตที่สนใจ",
      f4Title: "Customer Group (กลุ่มลูกค้า)",
      f4Desc: "กรองดูงานตามกลุ่มลูกค้าหลักของผลิตภัณฑ์",
      f5Title: "Lot Status (สถานะ Lot)",
      f5Desc: "เลือกดูเฉพาะงานที่กำลังผลิตอยู่ (WIP) หรือ งานที่พักรอ/Hold อยู่ (PENDING)",
      f6Title: "Group & Lead Time WIP",
      f6Desc: "เลือกดูตามกลุ่มสายงาน (EFPC_AUTO, EFPC_GEN, SMT) หรือเลือกดูตามช่วงอายุงานค้าง",
      f7Title: "WIP Scan In (ช่วงวันที่สแกนเข้า)",
      f7Desc: "กำหนดช่วงวันที่สแกนงานเข้าสู่ระบบ เพื่อดูงานที่เข้ามาในช่วงเวลาที่ต้องการ",
      f8Title: "Clear (ล้างค่าตัวกรอง)",
      f8Desc: "กดปุ่มนี้เพื่อรีเซ็ตตัวกรองทั้งหมดกลับเป็นค่าเริ่มต้น",

      // แท็บ 3: การสลับมุมมองโรงงาน
      factoryHeader: "การสลับเลือกดูข้อมูลโรงงาน (P1 / K1)",
      factoryDesc: "กดปุ่มสลับโรงงานที่แถบหัวเรื่องด้านบน:",
      p1Title: "โรงงาน P1",
      p1Desc: "แสดงข้อมูลงาน WIP ของสายการผลิตโรงงาน P1 (ค่าเริ่มต้นของระบบ)",
      k1Title: "โรงงาน K1",
      k1Desc: "สลับไปดูข้อมูลงาน WIP ของสายการผลิตโรงงาน K1",
      liveBadgeTitle: "ไฟสีเขียวกะพริบ (อัปเดตอัตโนมัติ)",
      liveBadgeDesc: "ระบบจะดึงข้อมูลล่าสุดให้คุณโดยอัตโนมัติตลอดเวลา เพื่อให้ได้ข้อมูลที่เป็นปัจจุบันเสมอ",

      // แท็บ 4: คำอธิบายสีและสถานะ
      legendHeader: "คำอธิบายสีระยะเวลาค้างของงาน (Lead Time WIP)",
      legendDesc: "แถบสีในกราฟช่วยให้คุณประเมินความเร่งด่วนของงานได้ทันที:",
      l1Title: "ไม่เกิน 1 วัน (สีฟ้า / Less 1 Day)",
      l1Desc: "งานใหม่ที่เพิ่งเข้าสู่ขั้นตอนนี้ไม่เกิน 24 ชั่วโมง การไหลของงานอยู่ในเกณฑ์ปกติ",
      l2Title: "มากกว่า 1 วัน (สีม่วง / More 1 Day)",
      l2Desc: "งานที่อยู่ในขั้นตอนนี้ 1 - 3 วัน หัวหน้างานควรเริ่มติดตามเพื่อไม่ให้งานสะสม",
      l3Title: "มากกว่า 3 วัน (สีส้ม / More 3 Days)",
      l3Desc: "งานที่ค้างนานเกิน 3 วัน ถือเป็นจุดคอขวดที่ต้องเร่งตรวจสอบสาเหตุและผลักดันงานต่อทันที",

      // Tab 5: Chart & Process Groups
      chartGroupHeader: "การจัดกลุ่มสายการผลิต (Process Groups)",
      chartGroupDesc: "กราฟจะจัดเรียงขั้นตอนการผลิตออกเป็น 3 กลุ่มหลัก เพื่อให้ดูง่ายเป็นสัดส่วน:",
      g1Title: "1. EFPC_AUTO",
      g1Desc: "กลุ่มขั้นตอนการผลิตสำหรับชิ้นงานยานยนต์ (เช่น AT-FADL, AT-FBAK, AT-FIN ฯลฯ)",
      g2Title: "2. EFPC_GEN",
      g2Desc: "กลุ่มขั้นตอนการผลิตสำหรับชิ้นงานทั่วไป (เช่น FADL, FFPC, FIN, FPIC, QA ฯลฯ)",
      g3Title: "3. SMT",
      g3Desc: "กลุ่มขั้นตอนงานประกอบชิ้นส่วน SMT (เช่น MADL, MFPC, MFIN, MXRA ฯลฯ)",
      chartTip: "💡 คำแนะนำ: นำเมาส์ไปชี้ที่แท่งกราฟ จะมีกล่องข้อความแสดงจำนวน Lot ของแต่ละช่วงวันและยอดรวมให้อย่างละเอียด",

      // Tab 6: Export
      exportHeader: "วิธีส่งออกข้อมูลเป็นไฟล์ Excel (.xlsx)",
      exportDesc: "ดาวน์โหลดข้อมูลเพื่อนำไปทำรายงานหรือวิเคราะห์ต่อนอกระบบได้ง่ายๆ:",
      eStep1: "1. เลือกโรงงาน (P1/K1) และปรับตัวกรองข้อมูลตามที่ต้องการ",
      eStep2: "2. กดปุ่ม 'Export Data' สีเขียวที่มุมขวาบน",
      eStep3: "3. ระบบจะสร้างไฟล์และดาวน์โหลด Excel (.xlsx) ลงเครื่องของคุณทันที",
    },
    en: {
      btnOpen: "User Guide",
      btnOpenSub: "Manual",
      headerBadge: "WIP Tracking System",
      headerTitle: "WIP Monitoring By Process Overall Manual",
      headerSubtitle: "Real-time dashboard to monitor WIP volume by production stages and aging duration",
      tabOverview: "1. Overview & Guide",
      tabFilter: "2. Data Filters",
      tabFactory: "3. Factory (P1 / K1)",
      tabLegend: "4. Lead Time Colors",
      tabChart: "5. Process Groups",
      tabExport: "6. Export Excel",
      btnClose: "Got it / Close",
      tipFooter: "You can open this guide or toggle TH / EN anytime during use.",

      // แท็บ 1: ภาพรวมระบบ
      overviewBadge: "Purpose & Key Benefits",
      overviewTitle: "How Does This Dashboard Help You?",
      overviewDesc:
        "This dashboard provides complete visibility of Work in Process (WIP) across Factory P1 and K1 in real time. Lots are categorized by manufacturing process steps (EFPC_AUTO, EFPC_GEN, SMT) and segmented by holding duration, helping you identify bottlenecks and backlog risks immediately.",
      chartStructureTitle: "How to Read the Stacked Process Bar Chart",
      chartStructurePoints: [
        { label: "X-Axis (Horizontal)", desc: "Lists all manufacturing process steps grouped by line divisions (EFPC_AUTO, EFPC_GEN, SMT)." },
        { label: "Y-Axis (Vertical)", desc: "Shows total WIP lots for each process (TOTAL LOT)." },
        { label: "Top Numbers", desc: "Displays exact total lots in that process step for quick summary without manual addition." },
        { label: "Bar Colors", desc: "Indicates how long lots have stayed in that process: Less than 1 Day, Over 1 Day, and Over 3 Days." },
      ],
      kpiCardTitle: "Total WIP Summary Card (Count of lot WIP)",
      kpiCardDesc: "The blue card at the top right displays the total active WIP lots currently matching your filter criteria.",

      // แท็บ 2: การใช้ตัวกรองข้อมูล
      filterHeader: "Data Filter Bar (Filters)",
      filterDesc: "Quickly find and focus on specific production data:",
      f1Title: "Lot ID",
      f1Desc: "Search or select specific Lot numbers to trace.",
      f2Title: "Product Name",
      f2Desc: "Filter by specific product models or part numbers (multi-select supported).",
      f3Title: "Process",
      f3Desc: "Filter by specific production process steps of interest.",
      f4Title: "Customer Group",
      f4Desc: "Filter WIP lots by key customer accounts.",
      f5Title: "Lot Status",
      f5Desc: "Filter active production lots (WIP) or on-hold/paused lots (PENDING).",
      f6Title: "Group & Lead Time WIP",
      f6Desc: "Filter by process division (EFPC_AUTO, EFPC_GEN, SMT) or by aging duration.",
      f7Title: "WIP Scan In (Date Range)",
      f7Desc: "Filter lots by the date they entered the production system.",
      f8Title: "Clear (Reset Filters)",
      f8Desc: "Click to reset all filters back to default values instantly.",

      // แท็บ 3: การสลับมุมมองโรงงาน
      factoryHeader: "Factory Switcher (P1 / K1)",
      factoryDesc: "Switch between factory datasets via the header toggle:",
      p1Title: "Factory P1",
      p1Desc: "Displays WIP data for Factory P1 production lines (Default).",
      k1Title: "Factory K1",
      k1Desc: "Switches to view WIP data for Factory K1 production lines.",
      liveBadgeTitle: "Pulsing Green Light (Auto-Sync)",
      liveBadgeDesc: "Data is automatically synchronized in the background to keep insights fresh and up-to-date.",

      // แท็บ 4: คำอธิบายสีและสถานะ
      legendHeader: "Lead Time Aging Color Guide",
      legendDesc: "Color stacks help you assess production urgency at a glance:",
      l1Title: "Under 1 Day (Sky Blue / Less 1 Day)",
      l1Desc: "Fresh lots entered within the past 24 hours. Normal and smooth workflow.",
      l2Title: "Over 1 Day (Purple / More 1 Day)",
      l2Desc: "Lots held between 1 to 3 days. Supervisors should follow up to maintain flow.",
      l3Title: "Over 3 Days (Orange / More 3 Days)",
      l3Desc: "Lots held longer than 3 days. High priority bottleneck requiring immediate resolution.",

      // Tab 5: Chart & Process Groups
      chartGroupHeader: "Production Line Grouping (Process Groups)",
      chartGroupDesc: "Processes are systematically organized into 3 primary divisions:",
      g1Title: "1. EFPC_AUTO",
      g1Desc: "Automotive FPC production line (e.g. AT-FADL, AT-FBAK, AT-FIN etc.)",
      g2Title: "2. EFPC_GEN",
      g2Desc: "General FPC production line (e.g. FADL, FFPC, FIN, FPIC, QA etc.)",
      g3Title: "3. SMT",
      g3Desc: "Surface Mount Technology assembly line (e.g. MADL, MFPC, MFIN, MXRA etc.)",
      chartTip: "💡 Tip: Hover over any bar column to view a detailed popup breakdown with lot quantities.",

      // Tab 6: Export
      exportHeader: "How to Export Data to Excel (.xlsx)",
      exportDesc: "Download filtered WIP datasets for reporting and offline analysis:",
      eStep1: "1. Select target factory (P1 / K1) and configure your filters as desired.",
      eStep2: "2. Click the green 'Export Data' button at the top right.",
      eStep3: "3. Your Excel file (.xlsx) will be generated and downloaded immediately.",
    },
  };

  const cur = t[lang];

  return (
    <>
      {/* ปุ่มเปิดคู่มือ ดีไซน์กลาสมอร์ฟิซึมเรียบหรู */}
      <button
        onClick={() => setIsOpen(true)}
        className="group relative flex items-center gap-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md px-3.5 py-1.5 text-white shadow-sm border border-white/30 transition-all duration-200 hover:border-white/60 hover:scale-105 active:scale-95 cursor-pointer"
        title={lang === "th" ? "เปิดคู่มือการใช้งานระบบ" : "Open User Manual"}
      >
        <HelpCircle size={16} className="text-white drop-shadow-xs transition-transform duration-200 group-hover:rotate-12" />
        <span className="text-xs sm:text-sm font-bold tracking-wide text-white drop-shadow-xs">
          {cur.btnOpen}
        </span>
        <span className="relative flex h-2 w-2 ml-0.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-xs"></span>
        </span>
      </button>

      {/* แบล็กดรอปพื้นหลังพร้อมขยายความกว้างเต็มจอ */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative flex max-h-[96vh] w-full max-w-[1600px] flex-col overflow-hidden rounded-3xl border border-white/30 bg-white shadow-[0_30px_90px_rgba(0,0,0,0.45)] animate-in zoom-in-95 duration-200">
            
            {/* ส่วนหัว (Header) */}
            <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 px-7 py-5 text-white shadow-md">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div className="pointer-events-none absolute left-1/3 -bottom-10 h-32 w-32 rounded-full bg-indigo-400/20 blur-xl" />

              <div className="relative flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-md border border-white/30">
                    <BookOpen size={28} className="text-white drop-shadow" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-white/20 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-blue-100 backdrop-blur-sm">
                        {cur.headerBadge}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-sm mt-0.5">
                      {cur.headerTitle}
                    </h2>
                    <p className="text-sm sm:text-base text-blue-100 font-medium opacity-90">
                      {cur.headerSubtitle}
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
                    onClick={() => setIsOpen(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/30 transition-all active:scale-90 cursor-pointer border border-white/20"
                    title={cur.btnClose}
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>
            </div>

            {/* Navigation Tabs - Fully Visible without Truncation */}
            <div className="border-b border-slate-200 bg-slate-50/90 px-4 sm:px-6 pt-3 backdrop-blur-sm">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { id: "overview", label: cur.tabOverview, icon: Info },
                  { id: "filter", label: cur.tabFilter, icon: Filter },
                  { id: "factory", label: cur.tabFactory, icon: Building2 },
                  { id: "legend", label: cur.tabLegend, icon: Clock3 },
                  { id: "chart", label: cur.tabChart, icon: Layers },
                  { id: "export", label: cur.tabExport, icon: Download },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as any)}
                      className={`group relative flex items-center justify-center gap-1.5 rounded-2xl py-2.5 px-2 text-xs sm:text-sm font-black transition-all duration-200 cursor-pointer text-center ${
                        isActive
                          ? "bg-white text-blue-700 shadow-lg shadow-slate-200 border border-slate-200 scale-[1.02]"
                          : "text-slate-600 hover:text-blue-700 hover:bg-white/70"
                      }`}
                    >
                      <Icon
                        size={17}
                        className={`shrink-0 transition-transform group-hover:scale-110 ${
                          isActive ? "text-blue-600" : "text-slate-400 group-hover:text-blue-500"
                        }`}
                      />
                      <span className="leading-tight break-words whitespace-normal text-center">{item.label}</span>
                      {isActive && (
                        <div className="absolute -bottom-[12px] left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-blue-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ส่วนเนื้อหาคู่มือพร้อมจัดขนาดตัวอักษรให้อ่านง่าย */}
            <div className="flex-1 overflow-y-auto p-7 space-y-7 bg-gradient-to-b from-slate-50/50 via-white to-white">
              
              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div className="space-y-6 animate-in fade-in-50 duration-200">
                  <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-indigo-50/60 to-white p-7 shadow-sm">
                    <div className="flex items-start gap-5">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/25">
                        <Sparkles size={28} />
                      </div>
                      <div className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-wider text-blue-700">
                          {cur.overviewBadge}
                        </span>
                        <h3 className="text-xl font-black text-slate-900">
                          {cur.overviewTitle}
                        </h3>
                        <p className="text-base sm:text-lg text-slate-700 leading-relaxed font-semibold">
                          {cur.overviewDesc}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                      <div className="flex items-center gap-3.5 mb-5">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                          <BarChart3 size={24} />
                        </div>
                        <h4 className="font-black text-slate-800 text-lg">
                          {cur.chartStructureTitle}
                        </h4>
                      </div>
                      <div className="space-y-4">
                        {cur.chartStructurePoints.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-3.5 text-base">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-800">
                              {idx + 1}
                            </span>
                            <div className="text-slate-700 leading-normal font-medium">
                              <strong className="text-slate-900 font-bold">{item.label}:</strong>{" "}
                              {item.desc}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50/60 to-white p-7 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3.5 mb-5">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                            <TrendingUp size={24} />
                          </div>
                          <h4 className="font-black text-slate-800 text-lg">
                            {cur.kpiCardTitle}
                          </h4>
                        </div>
                        <p className="text-base text-slate-700 leading-relaxed mb-5 font-semibold">
                          {cur.kpiCardDesc}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-gradient-to-br from-blue-700 via-indigo-600 to-blue-900 p-6 text-center text-white shadow-xl border border-blue-400/30">
                        <div className="text-4xl font-black text-white tracking-tight">
                          XXXX
                        </div>
                        <div className="text-xs font-black uppercase tracking-widest text-blue-100 mt-1">
                          COUNT OF LOT (WIP)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: FILTERS */}
              {activeTab === "filter" && (
                <div className="space-y-6 animate-in fade-in-50 duration-200">
                  <div>
                    <h3 className="font-black text-slate-800 text-lg flex items-center gap-2.5">
                      <Filter size={20} className="text-blue-600" />
                      {cur.filterHeader}
                    </h3>
                    <p className="text-base text-slate-600 mt-1 font-medium">{cur.filterDesc}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    {[
                      { icon: PackageSearch, color: "text-blue-600 bg-blue-50", title: cur.f1Title, desc: cur.f1Desc },
                      { icon: Layers, color: "text-indigo-600 bg-indigo-50", title: cur.f2Title, desc: cur.f2Desc },
                      { icon: Workflow, color: "text-violet-600 bg-violet-50", title: cur.f3Title, desc: cur.f3Desc },
                      { icon: UsersRound, color: "text-emerald-600 bg-emerald-50", title: cur.f4Title, desc: cur.f4Desc },
                      { icon: Tags, color: "text-amber-600 bg-amber-50", title: cur.f5Title, desc: cur.f5Desc },
                      { icon: Warehouse, color: "text-cyan-600 bg-cyan-50", title: cur.f6Title, desc: cur.f6Desc },
                      { icon: CalendarDays, color: "text-rose-600 bg-rose-50", title: cur.f7Title, desc: cur.f7Desc },
                      { icon: RotateCcw, color: "text-orange-600 bg-orange-50", title: cur.f8Title, desc: cur.f8Desc },
                    ].map((card, idx) => {
                      const Icon = card.icon;
                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-4 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm hover:border-blue-300 transition-all"
                        >
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${card.color}`}>
                            <Icon size={24} />
                          </div>
                          <div>
                            <h4 className="text-base font-black text-slate-900">{card.title}</h4>
                            <p className="mt-1 text-sm sm:text-base text-slate-600 leading-normal whitespace-pre-line font-medium">
                              {card.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: FACTORY SWITCH */}
              {activeTab === "factory" && (
                <div className="space-y-6 animate-in fade-in-50 duration-200">
                  <div className="rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-blue-50 to-white p-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25">
                        <Building2 size={24} />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-800 text-lg">{cur.factoryHeader}</h3>
                        <p className="text-base text-slate-600 mt-0.5 font-medium">{cur.factoryDesc}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="rounded-3xl border border-indigo-200 bg-white p-6 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="rounded-xl bg-gradient-to-br from-indigo-600 to-blue-800 px-4 py-1.5 text-sm font-black text-white shadow">
                          P1
                        </span>
                        <span className="text-sm font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg">
                          Plant 1
                        </span>
                      </div>
                      <h4 className="text-lg font-black text-slate-900">{cur.p1Title}</h4>
                      <p className="text-base text-slate-600 font-medium leading-relaxed">{cur.p1Desc}</p>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="rounded-xl bg-slate-200 px-4 py-1.5 text-sm font-black text-slate-800">
                          K1
                        </span>
                        <span className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
                          Plant 2
                        </span>
                      </div>
                      <h4 className="text-lg font-black text-slate-900">{cur.k1Title}</h4>
                      <p className="text-base text-slate-600 font-medium leading-relaxed">{cur.k1Desc}</p>
                    </div>

                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-sm space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="relative flex h-4 w-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                        </span>
                        <span className="text-base font-black text-emerald-950">{cur.liveBadgeTitle}</span>
                      </div>
                      <p className="text-base text-emerald-800 font-semibold leading-relaxed">{cur.liveBadgeDesc}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: LEGEND */}
              {activeTab === "legend" && (
                <div className="space-y-6 animate-in fade-in-50 duration-200">
                  <div>
                    <h3 className="font-black text-slate-800 text-lg flex items-center gap-2.5">
                      <Clock3 size={20} className="text-blue-600" />
                      {cur.legendHeader}
                    </h3>
                    <p className="text-base text-slate-600 mt-1 font-medium">{cur.legendDesc}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="rounded-3xl border border-sky-200 bg-gradient-to-b from-sky-50 to-white p-6 shadow-sm">
                      <div className="flex items-center gap-3.5 mb-3">
                        <span className="h-8 w-8 rounded-full bg-[#0284c7] shadow-md shadow-sky-500/30" />
                        <h4 className="text-lg font-black text-sky-950">{cur.l1Title}</h4>
                      </div>
                      <p className="text-base text-slate-700 leading-relaxed font-medium">{cur.l1Desc}</p>
                    </div>

                    <div className="rounded-3xl border border-purple-200 bg-gradient-to-b from-purple-50 to-white p-6 shadow-sm">
                      <div className="flex items-center gap-3.5 mb-3">
                        <span className="h-8 w-8 rounded-full bg-[#9333ea] shadow-md shadow-purple-500/30" />
                        <h4 className="text-lg font-black text-purple-950">{cur.l2Title}</h4>
                      </div>
                      <p className="text-base text-slate-700 leading-relaxed font-medium">{cur.l2Desc}</p>
                    </div>

                    <div className="rounded-3xl border border-orange-200 bg-gradient-to-b from-orange-50 to-white p-6 shadow-sm">
                      <div className="flex items-center gap-3.5 mb-3">
                        <span className="h-8 w-8 rounded-full bg-[#f97316] shadow-md shadow-orange-500/30" />
                        <h4 className="text-lg font-black text-orange-950">{cur.l3Title}</h4>
                      </div>
                      <p className="text-base text-slate-700 leading-relaxed font-medium">{cur.l3Desc}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: PROCESS GROUPS */}
              {activeTab === "chart" && (
                <div className="space-y-6 animate-in fade-in-50 duration-200">
                  <div>
                    <h3 className="font-black text-slate-800 text-lg flex items-center gap-2.5">
                      <Layers size={20} className="text-blue-600" />
                      {cur.chartGroupHeader}
                    </h3>
                    <p className="text-base text-slate-600 mt-1 font-medium">{cur.chartGroupDesc}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm">
                      <span className="text-xs font-black text-blue-700 bg-blue-50 px-3 py-1 rounded-lg uppercase">
                        Group 1
                      </span>
                      <h4 className="text-base font-black text-slate-900 mt-3">{cur.g1Title}</h4>
                      <p className="text-sm sm:text-base text-slate-600 mt-1 font-medium leading-relaxed">{cur.g1Desc}</p>
                    </div>

                    <div className="rounded-3xl border border-indigo-200 bg-white p-6 shadow-sm">
                      <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg uppercase">
                        Group 2
                      </span>
                      <h4 className="text-base font-black text-slate-900 mt-3">{cur.g2Title}</h4>
                      <p className="text-sm sm:text-base text-slate-600 mt-1 font-medium leading-relaxed">{cur.g2Desc}</p>
                    </div>

                    <div className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
                      <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg uppercase">
                        Group 3
                      </span>
                      <h4 className="text-base font-black text-slate-900 mt-3">{cur.g3Title}</h4>
                      <p className="text-sm sm:text-base text-slate-600 mt-1 font-medium leading-relaxed">{cur.g3Desc}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-base text-amber-950 font-semibold leading-relaxed">
                    {cur.chartTip}
                  </div>
                </div>
              )}

              {/* TAB 6: EXPORT */}
              {activeTab === "export" && (
                <div className="space-y-6 animate-in fade-in-50 duration-200">
                  <div className="rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-white p-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/25">
                        <Download size={24} />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 text-lg">{cur.exportHeader}</h3>
                        <p className="text-base text-slate-600 font-medium">{cur.exportDesc}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-base font-black text-emerald-900 mb-3.5">
                        1
                      </span>
                      <h4 className="font-black text-slate-900 text-base leading-normal">{cur.eStep1}</h4>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-base font-black text-emerald-900 mb-3.5">
                        2
                      </span>
                      <h4 className="font-black text-slate-900 text-base mb-2">{cur.eStep2}</h4>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-base font-black text-emerald-900 mb-3.5">
                        3
                      </span>
                      <h4 className="font-black text-slate-900 text-base leading-normal">{cur.eStep3}</h4>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-7 py-4.5">
              <div className="flex items-center gap-2.5 text-sm sm:text-base text-slate-600 font-semibold">
                <Lightbulb size={20} className="text-amber-500" />
                <span>{cur.tipFooter}</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-3 text-base font-black text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl active:scale-95 cursor-pointer"
              >
                <span>{cur.btnClose}</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
