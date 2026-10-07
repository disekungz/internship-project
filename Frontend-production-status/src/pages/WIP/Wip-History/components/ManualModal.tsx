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
  CheckCircle2,
  AlertTriangle,
  MousePointerClick,
  Filter,
  RotateCcw,
  Sparkles,
  Download,
  BookOpen,
  TrendingUp,
  Lightbulb,
} from "lucide-react";

type Language = "th" | "en";

export const ManualModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [lang, setLang] = useState<Language>("th");
  const [activeTab, setActiveTab] = useState<
    "overview" | "filter" | "interactive" | "legend" | "views" | "export"
  >("overview");

  const t = {
    th: {
      btnOpen: "คู่มือการใช้งาน",
      btnOpenSub: "User Manual",
      headerBadge: "ระบบวิเคราะห์ข้อมูล WIP",
      headerTitle: "คู่มือการใช้งาน WIP History Dashboard",
      headerSubtitle: "WIP P1 Lot Qty by Effective Date and Process - วิเคราะห์แนวโน้มงานค้างย้อนหลัง",
      tabOverview: "1. ภาพรวม & วิธีดูกราฟ",
      tabFilter: "2. ตัวกรองข้อมูล",
      tabInteractive: "3. คลิกดูข้อมูลเจาะลึก",
      tabLegend: "4. ความหมายของสี Lead Time",
      tabViews: "5. มุมมองแสดงผล",
      tabExport: "6. ส่งออกข้อมูล Excel",
      btnClose: "เข้าใจแล้ว / ปิดหน้าต่าง",
      tipFooter: "กดเปิดคู่มือนี้ หรือสลับภาษา TH / EN ได้ตลอดเวลา",

      // แท็บ 1: ภาพรวมระบบ
      overviewBadge: "วัตถุประสงค์และการใช้งาน",
      overviewTitle: "ระบบนี้ช่วยอะไรคุณได้บ้าง?",
      overviewDesc:
        "แดชบอร์ดนี้ออกแบบมาสำหรับติดตามปริมาณงาน WIP ของโรงงาน P1 แบบย้อนหลัง ช่วยให้คุณเช็กยอด Lot งานสะสมในแต่ละวันเทียบกับเป้าหมายควบคุม (Target) และตรวจสอบได้ว่างานส่วนใหญ่ค้างสะสมอยู่ในขั้นตอนใดและค้างมากี่วัน เพื่อช่วยวางแผนเคลียร์งานและแก้ปัญหาคอขวดได้อย่างตรงจุด",
      chartStructureTitle: "วิธีอ่านกราฟแท่งสะสม (Stacked Bar)",
      chartStructurePoints: [
        { label: "แกน X (แนวนอน)", desc: "แสดงวันที่ตามลำดับเวลา (Effective Date)" },
        { label: "แกน Y (แนวตั้ง)", desc: "แสดงจำนวน Lot รวมสะสมในแต่ละวัน" },
        { label: "ตัวเลขบนยอดแท่ง", desc: "แสดงยอดรวม Lot ของวันนั้น และมีเส้นประแสดงเป้าหมายควบคุม (Target)" },
        { label: "ชั้นสีในแต่ละแท่ง", desc: "แสดงสัดส่วนอายุงานที่ค้างในระบบ (ตั้งแต่ 0-3 วัน ไปจนถึงมากกว่า 365 วัน)" },
      ],
      targetAnalysisTitle: "เกณฑ์การเทียบกับเป้าหมาย (Target Control)",
      normalTargetTitle: "แท่งกราฟอยู่ต่ำกว่าเส้นประแดง (ปกติ - Normal)",
      normalTargetDesc: "ปริมาณงาน WIP อยู่ในเกณฑ์ที่ควบคุมได้ดี ยอดงานสะสมไม่เกินเป้าหมาย",
      overTargetTitle: "แท่งกราฟสูงเกินเส้นประแดง (งานสะสมเกินเกณฑ์ - Over WIP)",
      overTargetDesc: "มีงานค้างสะสมเกินเป้าหมาย อาจเกิดจากปัญหาคอขวด กำลังคนไม่พอ หรือเครื่องจักรขัดข้อง",

      // แท็บ 2: การใช้ตัวกรองข้อมูล
      filterHeader: "แถบตัวกรองข้อมูล (Filters)",
      filterDesc: "ใช้ค้นหาหรือเลือกดูเฉพาะข้อมูลที่คุณต้องการวิเคราะห์:",
      f1Title: "WIP Date (ช่วงวันที่)",
      f1Desc: "เลือกวันที่เริ่มต้น - สิ้นสุด เพื่อดูข้อมูลย้อนหลังตามช่วงเวลาที่ต้องการ",
      f2Title: "Process (ขั้นตอนการผลิต)",
      f2Desc: "เลือกเฉพาะขั้นตอนที่ต้องการดู เช่น SMT, TEST, PACKING (เลือกพร้อมกันได้หลายรายการ)",
      f3Title: "Lot Status (สถานะ Lot)",
      f3Desc: "• WIP: งานที่กำลังผลิตตามปกติ\n• PENDING: งานที่พักรอ/Hold เช่น รออะไหล่ หรือรอการตัดสินใจ",
      f4Title: "Group & Group WIP",
      f4Desc: "กรองดูตามกลุ่มงานหลัก หรือกลุ่มย่อยของขั้นตอน เพื่อสรุปยอดรายแผนก",
      f5Title: "Product Name & Lot No",
      f5Desc: "ค้นหาเจาะจงตามชื่อโมเดลสินค้า หรือพิมพ์หมายเลข Lot ที่ต้องการติดตาม",
      f6Title: "Clear (ล้างค่าตัวกรอง)",
      f6Desc: "ปุ่มสีส้ม-แดงจะแสดงขึ้นมาเมื่อมีการเลือกตัวกรอง กดปุ่มนี้เพื่อรีเซ็ตกลับเป็นค่าเริ่มต้น",

      // แท็บ 3: การโต้ตอบกับกราฟและคลิกเลือก Stack
      interactiveHeader: "การคลิกดูข้อมูลเจาะลึกบนกราฟ (Interactive Drilldown)",
      interactiveDesc: "คุณสามารถคลิกบนกราฟเพื่อดูรายละเอียดเชิงลึกได้ทันที 3 รูปแบบ:",
      i1Title: "1. คลิกที่แท่งของวันนั้น (ดูสรุปรายวัน)",
      i1Desc: "ระบบจะเปิดแผงสรุปยอดของวันนั้นขึ้นมาด้านบนกราฟทันที แจกแจงยอด Lot รวม, ยอดตามช่วงอายุงาน และยอดแยกทุก Process ให้อย่างครบถ้วน",
      i2Title: "2. คลิกที่ชั้นสี Lead Time (ดูเฉพาะช่วงอายุงาน)",
      i2Desc: "เมื่อคลิกที่ชั้นสีใดสีหนึ่ง (เช่น สีส้ม 10-29 วัน) ระบบจะคัดกรองให้เห็นทันทีว่างวดงานช่วงอายุนี้ไปกองอยู่ที่ขั้นตอน (Process) ใดบ้าง",
      i3Title: "3. ปุ่ม Clear Selection (กลับสู่มุมมองเดิม)",
      i3Desc: "กดปุ่ม 'Clear Selection ×' ที่มุมขวาบนของกราฟ เพื่อปิดแผงเจาะลึกและกลับมาดูกราฟภาพรวมตามปกติ",

      // แท็บ 4: คำอธิบายสีและสถานะ
      legendHeader: "คำอธิบายสีระยะเวลาค้างของงาน (Lead Time / Aging)",
      legendDesc: "สีของแท่งกราฟช่วยให้แยกแยะระดับความเร่งด่วนและอายุของงานในระบบได้อย่างชัดเจน:",
      l03Title: "0 - 3 วัน (สีม่วง)",
      l03Desc: "งานใหม่ที่เพิ่งเข้าสู่ระบบ การไหลเวียนของงานปกติและดีเยี่ยม",
      l49Title: "4 - 9 วัน (สีชมพูบานเย็น)",
      l49Desc: "งานเริ่มสะสมในขั้นตอน ยังอยู่ในเกณฑ์มาตรฐานการผลิต",
      l1029Title: "10 - 29 วัน (สีส้มทอง)",
      l1029Desc: "งานค้างระดับปานกลาง ควรเริ่มติดตามความคืบหน้าเพื่อป้องกันงานล่าช้า",
      l3099Title: "30 - 99 วัน (สีฟ้า)",
      l3099Desc: "งานค้างเป็นเวลานาน ควรตรวจสอบหาสาเหตุของปัญหาในกระบวนการ",
      l100364Title: "100 - 364 วัน (สีเขียวมรกต)",
      l100364Desc: "งานค้างสะสมสูงมาก เสี่ยงต่อสต๊อกจมและกระทบต้นทุนการผลิต",
      l365Title: "มากกว่า 365 วัน (สีชมพูอ่อน)",
      l365Desc: "งานค้างสะสมเกิน 1 ปี (ระดับวิกฤต - Critical WIP) ต้องได้รับการพิจารณาจัดการทันที",
      targetTitle: "- - - Total Target (เส้นประสีแดง)",
      targetDesc: "ขีดจำกัดปริมาณงาน WIP สูงสุดที่ฝ่ายบริหารกำหนดไว้ควบคุมในแต่ละวัน",

      // Tab 5: Views
      viewsHeader: "โหมดมุมมองการแสดงผล (View Modes)",
      viewsDesc: "สามารถกดสลับมุมมองได้ที่ปุ่มเหนือพื้นที่กราฟด้านขวา:",
      v1Title: "1. WIP History (มุมมองภาพรวมทั้งหมด)",
      v1Desc: "แสดงข้อมูลแนวโน้มงาน WIP รวมของทั้งสายการผลิตตามลำดับวันที่ เหมาะสำหรับดูภาพรวมและแนวโน้มรายวัน",
      v2Title: "2. Semi Group (มุมมองแยก 4 สายงานหลัก)",
      v2Desc: "แบ่งกราฟออกเป็น 4 สายงานหลัก (E-FPC-AUTO, E-FPC-GEN, SMT-AUTO, SMT-GEN) เหมาะสำหรับหัวหน้างานที่ต้องการติดตามเฉพาะสายงานที่รับผิดชอบ",

      // Tab 6: Export
      exportHeader: "วิธีส่งออกข้อมูลเป็นไฟล์ Excel (.xlsx)",
      exportDesc: "ดาวน์โหลดข้อมูลดิบและตารางสรุปเพื่อนำไปทำรายงานต่อนอกระบบได้สะดวก:",
      eStep1: "1. กดปุ่ม 'Export Data' สีเขียวที่แถบตัวกรอง",
      eStep2Title: "2. เลือกเงื่อนไขที่ต้องการส่งออกในหน้าต่าง:",
      eStep2Sub: [
        "Graph: เลือกส่งออกกราฟหลัก (Main), E-FPC, SMT หรือกลุ่มสายงานที่ต้องการ",
        "Period: เลือกระยะเวลาตามตัวกรองปัจจุบัน, ระบุเฉพาะวัน หรือส่งออกทั้งเดือน",
      ],
      eStep3: "3. กดปุ่ม 'Export Excel' เพื่อดาวน์โหลดไฟล์ลงเครื่องของคุณทันที",
    },
    en: {
      btnOpen: "User Guide",
      btnOpenSub: "Manual",
      headerBadge: "WIP History Analytics",
      headerTitle: "WIP History Dashboard Manual",
      headerSubtitle: "WIP P1 Lot Qty by Effective Date and Process - Historical Backlog & Trend Analysis",
      tabOverview: "1. Overview & Guide",
      tabFilter: "2. Data Filters",
      tabInteractive: "3. Interactive Drilldown",
      tabLegend: "4. Lead Time Colors",
      tabViews: "5. View Modes",
      tabExport: "6. Export Excel",
      btnClose: "Got it / Close",
      tipFooter: "You can open this guide or toggle TH / EN anytime during use.",

      // แท็บ 1: ภาพรวมระบบ
      overviewBadge: "Purpose & Key Benefits",
      overviewTitle: "How Does This Dashboard Help You?",
      overviewDesc:
        "This dashboard tracks historical WIP lot volume for Factory P1. It allows you to monitor daily cumulative lots against Target thresholds and inspect which process steps hold aged lots, helping you plan backlog clearing and eliminate bottlenecks effectively.",
      chartStructureTitle: "How to Read the Stacked Bar Chart",
      chartStructurePoints: [
        { label: "X-Axis (Horizontal)", desc: "Shows timeline progression (Effective Date)." },
        { label: "Y-Axis (Vertical)", desc: "Shows total cumulative WIP lots for each day." },
        { label: "Top Numbers & Line", desc: "Shows total lot counts per day alongside a dashed Target threshold line." },
        { label: "Color Stacks", desc: "Displays lot age proportions (from 0-3 days up to over 365 days)." },
      ],
      targetAnalysisTitle: "Target Threshold Criteria",
      normalTargetTitle: "Below Red Line (Normal Flow)",
      normalTargetDesc: "WIP volume is well controlled within healthy limits without exceeding targets.",
      overTargetTitle: "Above Red Line (Backlog Alert - Over WIP)",
      overTargetDesc: "Accumulated WIP exceeds target limits, signaling bottlenecks, machine downtime, or staffing shortages.",

      // แท็บ 2: การใช้ตัวกรองข้อมูล
      filterHeader: "Data Filter Controls (Filters)",
      filterDesc: "Find and analyze specific data segments with ease:",
      f1Title: "WIP Date (Date Range)",
      f1Desc: "Select start and end dates to retrieve historical records over a custom period.",
      f2Title: "Process (Production Steps)",
      f2Desc: "Filter specific stages such as SMT, TEST, PACKING (multi-select supported).",
      f3Title: "Lot Status",
      f3Desc: "• WIP: Active production lots\n• PENDING: Paused or on-hold lots (e.g., waiting for parts or engineering review)",
      f4Title: "Group & Group WIP",
      f4Desc: "Filter by primary divisions or WIP subcategories to view department rollups.",
      f5Title: "Product Name & Lot No",
      f5Desc: "Search specifically by product model names or type exact Lot numbers.",
      f6Title: "Clear (Reset Filters)",
      f6Desc: "Appears when filters are applied. Click to reset all filters back to default values.",

      // แท็บ 3: การโต้ตอบกับกราฟและคลิกเลือก Stack
      interactiveHeader: "Interactive Chart Drilldowns",
      interactiveDesc: "Click directly on the chart to inspect deeper details in 3 ways:",
      i1Title: "1. Click Whole Day Column (Daily Summary)",
      i1Desc: "Instantly opens a summary card above the chart, breaking down total lots, aging tiers, and individual process quantities for that specific date.",
      i2Title: "2. Click Specific Color Stack (Aging Breakdown)",
      i2Desc: "Clicking a specific color stack (e.g. Amber 10-29 Days) isolates exactly which process steps hold lots of that age group.",
      i3Title: "3. Clear Selection (×)",
      i3Desc: "Click 'Clear Selection ×' at the top-right of the chart to close the drilldown panel and return to the main view.",

      // แท็บ 4: คำอธิบายสีและสถานะ
      legendHeader: "Lead Time Aging Color Guide",
      legendDesc: "Color coding highlights lot age and handling urgency:",
      l03Title: "0 - 3 Days (Violet)",
      l03Desc: "Fresh lots newly introduced to the line. Optimal and healthy flow.",
      l49Title: "4 - 9 Days (Rose / Pink)",
      l49Desc: "Initial aging lots. Within standard operating cycle.",
      l1029Title: "10 - 29 Days (Amber / Gold)",
      l1029Desc: "Moderate holding duration. Supervisors should monitor queues to avoid delays.",
      l3099Title: "30 - 99 Days (Sky Blue)",
      l3099Desc: "Long-standing WIP. Investigate line delays or on-hold reasons.",
      l100364Title: "100 - 364 Days (Emerald Green)",
      l100364Desc: "Very high accumulation. High risk of dead inventory and tied-up capital.",
      l365Title: "Over 365 Days (Soft Pink)",
      l365Desc: "Over 1 year old (Critical WIP). Requires immediate disposition.",
      targetTitle: "- - - Total Target (Red Dashed Line)",
      targetDesc: "The maximum acceptable daily WIP threshold set by management.",

      // Tab 5: Views
      viewsHeader: "Display View Modes",
      viewsDesc: "Toggle between view modes using the switch buttons above the chart:",
      v1Title: "1. WIP History (Overall Factory View)",
      v1Desc: "Displays overall factory WIP trends chronologically. Best for tracking day-to-day macro volume.",
      v2Title: "2. Semi Group (4 Major Divisions)",
      v2Desc: "Separates data into 4 distinct production lines (E-FPC-AUTO, E-FPC-GEN, SMT-AUTO, SMT-GEN) for departmental supervisors.",

      // Tab 6: Export
      exportHeader: "How to Export Data to Excel (.xlsx)",
      exportDesc: "Download raw datasets and summary tables for offline reporting:",
      eStep1: "1. Click the green 'Export Data' button on the filter bar.",
      eStep2Title: "2. Configure your export settings in the dialog:",
      eStep2Sub: [
        "Graph: Choose Main WIP History, E-FPC Summary, SMT Summary, or specific divisions.",
        "Period: Select Current Filter Range, Specific Day, or Full Month.",
      ],
      eStep3: "3. Click 'Export Excel' to download your spreadsheet immediately.",
    },
  };

  const cur = t[lang];

  return (
    <>
      {/* ปุ่มเปิดคู่มือ ดีไซน์กลาสมอร์ฟิซึมเรียบหรู */}
      <button
        onClick={() => setIsOpen(true)}
        className="group relative ml-auto flex items-center gap-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md px-3.5 py-1.5 text-white shadow-sm border border-white/30 transition-all duration-200 hover:border-white/60 hover:scale-105 active:scale-95 cursor-pointer"
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
                  { id: "interactive", label: cur.tabInteractive, icon: MousePointerClick },
                  { id: "legend", label: cur.tabLegend, icon: Clock3 },
                  { id: "views", label: cur.tabViews, icon: Layers },
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
                  {/* Hero Banner */}
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

                  {/* 2 Column Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left: Structure */}
                    <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-all hover:shadow-md">
                      <div>
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
                    </div>

                    {/* Right: Target Criteria */}
                    <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-all hover:shadow-md">
                      <div>
                        <div className="flex items-center gap-3.5 mb-5">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                            <TrendingUp size={24} />
                          </div>
                          <h4 className="font-black text-slate-800 text-lg">
                            {cur.targetAnalysisTitle}
                          </h4>
                        </div>
                        <div className="space-y-4">
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 flex items-start gap-4">
                            <CheckCircle2 size={24} className="text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <div className="font-black text-emerald-950 text-base">
                                {cur.normalTargetTitle}
                              </div>
                              <p className="text-emerald-800 text-base mt-1 leading-relaxed font-semibold">
                                {cur.normalTargetDesc}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 flex items-start gap-4">
                            <AlertTriangle size={24} className="text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              <div className="font-black text-rose-950 text-base">
                                {cur.overTargetTitle}
                              </div>
                              <p className="text-rose-800 text-base mt-1 leading-relaxed font-semibold">
                                {cur.overTargetDesc}
                              </p>
                            </div>
                          </div>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[
                      { icon: CalendarDays, color: "text-blue-600 bg-blue-50", title: cur.f1Title, desc: cur.f1Desc },
                      { icon: Workflow, color: "text-indigo-600 bg-indigo-50", title: cur.f2Title, desc: cur.f2Desc },
                      { icon: Tags, color: "text-amber-600 bg-amber-50", title: cur.f3Title, desc: cur.f3Desc },
                      { icon: Warehouse, color: "text-emerald-600 bg-emerald-50", title: cur.f4Title, desc: cur.f4Desc },
                      { icon: PackageSearch, color: "text-cyan-600 bg-cyan-50", title: cur.f5Title, desc: cur.f5Desc },
                      { icon: RotateCcw, color: "text-rose-600 bg-rose-50", title: cur.f6Title, desc: cur.f6Desc },
                    ].map((card, idx) => {
                      const Icon = card.icon;
                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-4 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
                        >
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${card.color}`}>
                            <Icon size={24} />
                          </div>
                          <div>
                            <h4 className="text-base font-black text-slate-900">{card.title}</h4>
                            <p className="mt-1 text-sm sm:text-base text-slate-600 leading-relaxed whitespace-pre-line font-medium">
                              {card.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: INTERACTIVE DRILLDOWN */}
              {activeTab === "interactive" && (
                <div className="space-y-6 animate-in fade-in-50 duration-200">
                  <div className="rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-blue-50 to-white p-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25">
                        <MousePointerClick size={24} />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-800 text-lg">{cur.interactiveHeader}</h3>
                        <p className="text-base text-slate-600 mt-0.5 font-medium">{cur.interactiveDesc}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {[
                      { step: "1", title: cur.i1Title, desc: cur.i1Desc, badge: "Whole Day Selection", bg: "from-blue-50 to-white", border: "border-blue-200" },
                      { step: "2", title: cur.i2Title, desc: cur.i2Desc, badge: "Layer Isolation", bg: "from-indigo-50 to-white", border: "border-indigo-200" },
                      { step: "3", title: cur.i3Title, desc: cur.i3Desc, badge: "Reset Drilldown", bg: "from-amber-50 to-white", border: "border-amber-200" },
                    ].map((step, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col justify-between rounded-3xl border ${step.border} bg-gradient-to-b ${step.bg} p-6 shadow-sm`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-base font-black text-white shadow">
                              {step.step}
                            </span>
                            <span className="rounded-lg bg-white/90 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200 shadow-2xs">
                              {step.badge}
                            </span>
                          </div>
                          <h4 className="text-base font-black text-slate-900 mb-2">{step.title}</h4>
                          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-medium">{step.desc}</p>
                        </div>
                      </div>
                    ))}
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    {[
                      { gradient: "from-[#c7d2fe] to-[#8b5cf6]", title: cur.l03Title, desc: cur.l03Desc },
                      { gradient: "from-[#fbcfe8] to-[#ec4899]", title: cur.l49Title, desc: cur.l49Desc },
                      { gradient: "from-[#fde68a] to-[#f59e0b]", title: cur.l1029Title, desc: cur.l1029Desc },
                      { gradient: "from-[#bae6fd] to-[#38bdf8]", title: cur.l3099Title, desc: cur.l3099Desc },
                      { gradient: "from-[#bbf7d0] to-[#10b981]", title: cur.l100364Title, desc: cur.l100364Desc },
                      { gradient: "from-[#f9a8d4] to-[#f472b6]", title: cur.l365Title, desc: cur.l365Desc, alert: true },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-4 rounded-3xl border p-5 shadow-sm transition-all ${
                          item.alert
                            ? "border-rose-300 bg-rose-50/70"
                            : "border-slate-200/90 bg-white hover:shadow-md"
                        }`}
                      >
                        <div className={`h-8 w-8 shrink-0 rounded-2xl bg-gradient-to-b ${item.gradient} shadow-md`} />
                        <div>
                          <div className={`text-base font-black ${item.alert ? "text-rose-700" : "text-slate-900"}`}>
                            {item.title}
                          </div>
                          <p className="mt-1 text-sm sm:text-base text-slate-600 leading-normal font-medium">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Target Line Description */}
                  <div className="flex items-center gap-5 rounded-3xl border border-rose-200 bg-gradient-to-r from-rose-50 via-red-50/50 to-white p-5 shadow-sm">
                    <div className="flex h-10 w-16 items-center justify-center rounded-xl bg-white border border-rose-200 shadow-2xs">
                      <span className="w-12 border-t-2 border-dashed border-rose-500" />
                    </div>
                    <div>
                      <div className="text-base font-black text-rose-950">{cur.targetTitle}</div>
                      <p className="text-sm sm:text-base text-rose-800 mt-0.5 font-semibold">{cur.targetDesc}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: VIEW MODES */}
              {activeTab === "views" && (
                <div className="space-y-6 animate-in fade-in-50 duration-200">
                  <div>
                    <h3 className="font-black text-slate-800 text-lg flex items-center gap-2.5">
                      <Layers size={20} className="text-blue-600" />
                      {cur.viewsHeader}
                    </h3>
                    <p className="text-base text-slate-600 mt-1 font-medium">{cur.viewsDesc}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col justify-between rounded-3xl border border-blue-200 bg-gradient-to-b from-blue-50/50 via-white to-white p-7 shadow-sm">
                      <div>
                        <div className="flex items-center gap-4 mb-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/25">
                            <BarChart3 size={24} />
                          </div>
                          <h4 className="font-black text-slate-900 text-lg">{cur.v1Title}</h4>
                        </div>
                        <p className="text-base text-slate-700 leading-relaxed font-medium">{cur.v1Desc}</p>
                      </div>
                    </div>

                    <div className="flex flex-col justify-between rounded-3xl border border-indigo-200 bg-gradient-to-b from-indigo-50/50 via-white to-white p-7 shadow-sm">
                      <div>
                        <div className="flex items-center gap-4 mb-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25">
                            <Layers size={24} />
                          </div>
                          <h4 className="font-black text-slate-900 text-lg">{cur.v2Title}</h4>
                        </div>
                        <p className="text-base text-slate-700 leading-relaxed font-medium">{cur.v2Desc}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: EXPORT */}
              {activeTab === "export" && (
                <div className="space-y-6 animate-in fade-in-50 duration-200">
                  <div className="rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50/60 to-white p-6">
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
                      <h4 className="font-black text-slate-900 text-base mb-2">{cur.eStep2Title}</h4>
                      <ul className="space-y-2 text-sm sm:text-base text-slate-700 font-medium">
                        {cur.eStep2Sub.map((sub, idx) => (
                          <li key={idx} className="flex items-start gap-2.5">
                            <span className="text-emerald-500 font-bold">•</span>
                            <span>{sub}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-base font-black text-emerald-900 mb-3.5">
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
