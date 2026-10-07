import React, { useState } from "react";
import {
  HelpCircle,
  X,
  CalendarDays,
  BarChart3,
  Layers,
  Info,
  Sparkles,
  BookOpen,
  TrendingUp,
  Lightbulb,
  UsersRound,
  Percent,
} from "lucide-react";

type Language = "th" | "en";

export const ManualManpowerRatioModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [lang, setLang] = useState<Language>("th");
  const [activeTab, setActiveTab] = useState<
    "overview" | "modes" | "periods" | "targets" | "depts" | "charts"
  >("overview");

  const t = {
    th: {
      btnOpen: "คู่มือการใช้งาน",
      btnOpenSub: "User Manual",
      headerBadge: "ระบบวิเคราะห์กำลังคน & อัตราส่วน",
      headerTitle: "คู่มือการใช้งาน MANPOWER RATIO",
      headerSubtitle: "Leave Ratio and OT Ratio by Department - ระบบติดตามสัดส่วนการลางานและชั่วโมงทำงานล่วงเวลา",
      tabOverview: "1. ภาพรวม & วัตถุประสงค์",
      tabModes: "2. โหมด OT & การลา",
      tabPeriods: "3. ช่วงเวลา (วัน / สัปดาห์ / เดือน)",
      tabTargets: "4. กำหนดเป้าหมาย Target (%)",
      tabDepts: "5. แผนก & สัญลักษณ์สี",
      tabCharts: "6. วิธีอ่านกราฟ & เส้นสะสม",
      btnClose: "เข้าใจแล้ว / ปิดหน้าต่าง",
      tipFooter: "กดเปิดคู่มือนี้ หรือสลับภาษา TH / EN ได้ตลอดเวลาขณะใช้งาน",

      // แท็บ 1: ภาพรวมระบบ
      overviewBadge: "วัตถุประสงค์และการใช้งาน",
      overviewTitle: "ระบบนี้ช่วยอะไรคุณได้บ้าง?",
      overviewDesc:
        "ระบบ MANPOWER RATIO ช่วยให้คุณติดตามและวิเคราะห์ประสิทธิภาพการใช้กำลังคนของแต่ละแผนกได้อย่างชัดเจน โดยเน้น 2 ตัวชี้วัดหลัก คือ อัตราส่วนการทำงานล่วงเวลา (OT Ratio) และ อัตราส่วนการลางาน (Leave Ratio) เพื่อควบคุมต้นทุนค่าแรงให้อยู่ในงบประมาณ (Target) และจัดสรรกำลังคนให้สมดุลกับปริมาณงานจริง",
      kpiDirectTitle: "1. ภาพรวมระดับโรงงาน (Overview All P1)",
      kpiDirectDesc: "กราฟด้านบนแสดงแนวโน้มสัดส่วนรวมของโรงงาน P1 ทั้งพนักงานสายการผลิต (Direct) และฝ่ายสนับสนุน (Indirect) พร้อมเส้นแนวโน้มสะสมเฉลี่ย (Acc. Total)",
      kpiDeptTitle: "2. เจาะลึกรายแผนก (By Dept. Direct / All)",
      kpiDeptDesc: "กราฟด้านล่างแจกแจงสัดส่วนของแต่ละแผนก (QA, FPC, SMT_F, SMT_B, MDS) ช่วยให้เห็นทันทีว่าแผนกไหนมีการทำงานล่วงเวลาหรืออัตราการลาสูงผิดปกติ",

      // แท็บ 2: โหมดอัตราส่วน (% OT เทียบกับ % Leave)
      modesHeader: "โหมดการวิเคราะห์ข้อมูล (OT Ratio / Leave Ratio)",
      modesDesc: "สามารถกดสลับโหมดได้ที่ปุ่มด้านซ้ายบนใต้แถบหัวเรื่อง:",
      otTitle: "1. โหมด OT Ratio (อัตราส่วนการทำงานล่วงเวลา)",
      otDesc: "คำนวณจาก: (ชั่วโมง OT รวม ÷ ชั่วโมงทำงานปกติ) × 100%\nใช้สำหรับติดตามภาระงานล้นมือและควบคุมงบประมาณค่าล่วงเวลา",
      leaveTitle: "2. โหมด Leave Ratio (อัตราส่วนการลางาน)",
      leaveDesc: "คำนวณจาก: (จำนวนคนลา ÷ จำนวนพนักงานทั้งหมด) × 100%\nใช้สำหรับติดตามสถิติการขาด/ลา เพื่อวางแผนจัดสรรคนมาทำงานทดแทนได้ทันเวลา",

      // แท็บ 3: ช่วงเวลาและมิติมุมมอง
      periodsHeader: "การเลือกช่วงเวลาแสดงผล (Time Horizon)",
      periodsDesc: "ปุ่มเลือกมุมมองเวลาที่แถบหัวเรื่องด้านขวา:",
      pDayTitle: "• Day (มุมมองรายวัน):",
      pDayDesc: "แสดงข้อมูลละเอียดเป็นรายวัน สามารถเลือกดูเฉพาะเดือนนั้น (Monthly) หรือดูรายวันต่อเนื่องทั้งปี (Yearly)",
      pWeekTitle: "• Week (มุมมองรายสัปดาห์):",
      pWeekDesc: "รวมยอดและหาค่าเฉลี่ยเป็นรายสัปดาห์ (W1, W2, W3, ...) ตลอดทั้งปี เหมาะสำหรับดูแนวโน้มระยะกลาง",
      pMonthTitle: "• Month (มุมมองรายเดือน):",
      pMonthDesc: "เปรียบเทียบสัดส่วนของทั้ง 12 เดือน (ม.ค. - ธ.ค.) เหมาะสำหรับทำรายงานสรุปประจำไตรมาสและประจำปี",
      pPickerTitle: "• ตัวเลือกเดือน / ปี (Month & Year Selector):",
      pPickerDesc: "กดเลือกเดือนและปีที่ต้องการเรียกดูข้อมูลย้อนหลังได้อย่างอิสระ",

      // Tab 4: Targets
      targetsHeader: "การปรับแต่งเส้นเป้าหมายควบคุม (Dynamic Targets)",
      targetsDesc: "กล่องกรอกเป้าหมาย Target (%) ที่มุมบนขวาของกราฟ:",
      tDailyTitle: "Target OT / Leave (เส้นประสีน้ำเงิน)",
      tDailyDesc: "เป้าหมายควบคุมรายวัน เช่น 75% หากแท่งกราฟวันใดสูงเกินเส้นประนี้ แสดงว่าเกินเกณฑ์ที่กำหนด",
      tAccTitle: "Target Acc. (เส้นประสีแดง)",
      tAccDesc: "เป้าหมายควบคุมค่าเฉลี่ยสะสม เช่น 65% ใช้เปรียบเทียบกับเส้นกราฟสะสมสีส้ม-น้ำตาล (Acc. Line)",
      tEditTip: "💡 คำแนะนำ: คุณสามารถคลิกพิมพ์เปลี่ยนตัวเลข Target ในกล่อง % ได้โดยตรง กราฟจะขยับเส้นประให้ทันทีแบบ Real-time",

      // Tab 5: Depts & Colors
      deptsHeader: "สัญลักษณ์สีประจำแผนก (Department Colors)",
      deptsDesc: "กราฟจำแนกสัดส่วนตามสีประจำแต่ละฝ่ายอย่างชัดเจน:",
      dQA: "QA (สีชมพู) - ฝ่ายตรวจสอบและควบคุมคุณภาพ",
      dFPC: "FPC (สีเหลืองทอง) - สายการผลิต Flexible Printed Circuit",
      dSMT_F: "SMT_F (สีฟ้า) - แผนก Surface Mount Front Process",
      dSMT_B: "SMT_B (สีเขียว) - แผนก Surface Mount Back Process",
      dMDS: "MDS (สีม่วง) - แผนก Module Assembly / Support",
      dIndirect: "Indirect (สีเทา) - พนักงานฝ่ายสนับสนุนและออฟฟิศ",
      dAccLine: "Acc. Line (เส้นสีส้ม-น้ำตาล) - เส้นค่าเฉลี่ยสะสมต่อเนื่องตั้งแต่ต้นเดือน/ต้นปี",

      // Tab 6: Charts & Reading
      chartsHeader: "วิธีอ่านและวิเคราะห์กราฟอย่างเข้าใจง่าย",
      chartsDesc: "จุดสังเกตสำคัญเพื่อช่วยในการตัดสินใจ:",
      cPoint1: "1. วันหยุดสุดสัปดาห์ / วันหยุดนักขัตฤกษ์:",
      cPoint1Desc: "วันที่เป็นวันหยุด ตัวเลขวันที่ใต้แกน X จะแสดงเป็น 'สีแดง' เพื่อให้คุณแยกวันทำงานกับวันหยุดได้ทันที",
      cPoint2: "2. ตัวเลขเปอร์เซ็นต์เหนือแท่งกราฟ (% Value):",
      cPoint2Desc: "แสดงยอดรวมเปอร์เซ็นต์ของวันนั้นๆ ชัดเจน ช่วยให้อ่านค่าได้ทันทีโดยไม่ต้องเทียบสเกล",
      cPoint3: "3. เส้นสะสม Acc. Trend Line:",
      cPoint3Desc: "ช่วยบอกว่าตั้งแต่ต้นเดือนมาจนถึงปัจจุบัน ค่าเฉลี่ยรวมยังอยู่ในเกณฑ์ควบคุมของเส้น Target Acc. สีแดงหรือไม่",
    },
    en: {
      btnOpen: "User Guide",
      btnOpenSub: "Manual",
      headerBadge: "Manpower & Ratio Analytics",
      headerTitle: "MANPOWER RATIO User Manual",
      headerSubtitle: "Leave Ratio and OT Ratio by Department - Overtime & Absenteeism Monitoring",
      tabOverview: "1. Overview & Purpose",
      tabModes: "2. OT & Leave Modes",
      tabPeriods: "3. Time Horizon (Day/Wk/Mo)",
      tabTargets: "4. Target Limits (%)",
      tabDepts: "5. Depts & Colors",
      tabCharts: "6. How to Read Charts",
      btnClose: "Got it / Close",
      tipFooter: "You can open this guide or toggle TH / EN anytime during use.",

      // แท็บ 1: ภาพรวมระบบ
      overviewBadge: "Purpose & Key Benefits",
      overviewTitle: "How Does This System Help You?",
      overviewDesc:
        "The MANPOWER RATIO system tracks and analyzes departmental workforce efficiency across two key metrics: Overtime Ratio (OT Ratio) and Absenteeism Ratio (Leave Ratio). It helps management maintain labor cost control within budgeted targets and ensure balanced headcount against production demand.",
      kpiDirectTitle: "1. Plant-Wide Overview (All P1)",
      kpiDirectDesc: "The top chart displays total plant-level trends combining Direct and Indirect manpower with a cumulative average trend line (Acc. Total).",
      kpiDeptTitle: "2. Departmental Breakdown (Direct / All)",
      kpiDeptDesc: "The bottom chart details proportions by individual departments (QA, FPC, SMT_F, SMT_B, MDS), making it easy to spot unusual overtime or leave spikes.",

      // แท็บ 2: โหมดอัตราส่วน (% OT เทียบกับ % Leave)
      modesHeader: "Analysis Modes (OT Ratio / Leave Ratio)",
      modesDesc: "Toggle between metrics using the buttons on the top left:",
      otTitle: "1. OT Ratio Mode (Overtime Ratio)",
      otDesc: "Formula: (Total OT Hours ÷ Regular Work Hours) × 100%\nUsed to monitor workload intensity and control overtime budget expenditure.",
      leaveTitle: "2. Leave Ratio Mode (Absenteeism Ratio)",
      leaveDesc: "Formula: (Employees on Leave ÷ Total Headcount) × 100%\nUsed to track unplanned absenteeism and arrange staffing replacements promptly.",

      // แท็บ 3: ช่วงเวลาและมิติมุมมอง
      periodsHeader: "Time Horizon & Aggregation",
      periodsDesc: "Time range controls located on the top-right header:",
      pDayTitle: "• Day (Daily View):",
      pDayDesc: "Displays detailed day-by-day records. You can switch between viewing a single month (Monthly) or continuous full-year days (Yearly).",
      pWeekTitle: "• Week (Weekly View):",
      pWeekDesc: "Aggregates and averages data by production week (W1, W2, ...) across the year for medium-term trend tracking.",
      pMonthTitle: "• Month (Monthly View):",
      pMonthDesc: "Compares 12 monthly macro summaries (Jan - Dec) for quarterly and annual management reviews.",
      pPickerTitle: "• Month & Year Selector (Calendar):",
      pPickerDesc: "Quickly select target year and month to retrieve historical datasets.",

      // Tab 4: Targets
      targetsHeader: "Dynamic Target Thresholds (%)",
      targetsDesc: "Target input boxes located at the top-right of each chart:",
      tDailyTitle: "Target OT / Leave (Blue Dashed Line)",
      tDailyDesc: "Daily control limit (e.g. 75%). Bars exceeding this line signify over-limit conditions for that day.",
      tAccTitle: "Target Acc. (Red Dashed Line)",
      tAccDesc: "Cumulative average control threshold (e.g. 65%), compared against the running orange/brown curve (Acc. Line).",
      tEditTip: "💡 Tip: You can type a new target percentage directly into the % box, and the dashed limit line will adjust on the chart in real time.",

      // Tab 5: Depts & Colors
      deptsHeader: "Department Color Indicators",
      deptsDesc: "Clear color indicators representing respective departments:",
      dQA: "QA (Pink) - Quality Assurance & Inspection",
      dFPC: "FPC (Gold / Amber) - Flexible Printed Circuit Manufacturing Line",
      dSMT_F: "SMT_F (Sky Blue) - Surface Mount Technology Front Process",
      dSMT_B: "SMT_B (Green) - Surface Mount Technology Back Process",
      dMDS: "MDS (Purple) - Module Assembly & Support",
      dIndirect: "Indirect (Gray) - Supporting staff and office administration",
      dAccLine: "Acc. Line (Orange/Brown Curve) - Cumulative running average from the beginning of the period",

      // Tab 6: Charts & Reading
      chartsHeader: "How to Interpret Charts Accurately",
      chartsDesc: "Key interpretation tips for precise decision-making:",
      cPoint1: "1. Weekends & Public Holidays:",
      cPoint1Desc: "Weekend dates (Saturdays, Sundays) and public holidays are highlighted in Red text on the X-axis for instant distinction.",
      cPoint2: "2. Percentage Labels (%):",
      cPoint2Desc: "Exact percentage figures are shown above each bar for immediate reading without guessing scale lines.",
      cPoint3: "3. Cumulative Acc. Trend Line:",
      cPoint3Desc: "Shows whether the period-to-date average remains safely below the red Target Acc. line over time.",
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
          <div className="relative flex max-h-[96vh] w-full max-w-[1600px] flex-col overflow-hidden rounded-3xl border border-base-300 bg-base-100 shadow-[0_30px_90px_rgba(0,0,0,0.45)] animate-in zoom-in-95 duration-200">
            
            {/* ส่วนหัว (Header) */}
            <div className="relative overflow-hidden bg-gradient-to-r from-[#193886] via-[#1F46A4] to-[#2563EB] px-7 py-5 text-white shadow-md">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div className="pointer-events-none absolute left-1/3 -bottom-10 h-32 w-32 rounded-full bg-blue-400/20 blur-xl" />

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

            {/* Navigation Tabs - Full Visibility without Clipping */}
            <div className="border-b border-base-300 bg-base-200/90 px-4 sm:px-6 pt-3.5 backdrop-blur-sm">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3">
                {[
                  { id: "overview", label: cur.tabOverview, icon: Info },
                  { id: "modes", label: cur.tabModes, icon: Percent },
                  { id: "periods", label: cur.tabPeriods, icon: CalendarDays },
                  { id: "targets", label: cur.tabTargets, icon: TrendingUp },
                  { id: "depts", label: cur.tabDepts, icon: UsersRound },
                  { id: "charts", label: cur.tabCharts, icon: BarChart3 },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as any)}
                      className={`group relative flex items-center justify-center gap-1.5 sm:gap-2 rounded-2xl py-3 px-2 text-xs sm:text-sm font-black transition-all duration-200 cursor-pointer text-center ${
                        isActive
                          ? "bg-base-100 text-primary shadow-lg shadow-base-300 border border-base-300 scale-[1.02]"
                          : "text-base-content/70 hover:text-primary hover:bg-base-100/70"
                      }`}
                    >
                      <Icon
                        size={17}
                        className={`shrink-0 transition-transform group-hover:scale-110 ${
                          isActive ? "text-primary" : "text-base-content/50 group-hover:text-blue-500"
                        }`}
                      />
                      <span className="leading-tight text-center">{item.label}</span>
                      {isActive && (
                        <div className="absolute -bottom-[14px] left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ส่วนเนื้อหาคู่มือพร้อมจัดขนาดตัวอักษรให้อ่านง่าย */}
            <div className="flex-1 overflow-y-auto p-7 space-y-7 bg-gradient-to-b from-base-200/50 via-base-100 to-base-100">
              
              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div className="space-y-6 animate-in fade-in-50 duration-200">
                  <div className="relative overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-base-100 p-7 shadow-sm">
                    <div className="flex items-start gap-5">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#193886] text-white shadow-lg shadow-blue-500/25">
                        <Sparkles size={28} />
                      </div>
                      <div className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-wider text-primary">
                          {cur.overviewBadge}
                        </span>
                        <h3 className="text-xl font-black text-base-content">
                          {cur.overviewTitle}
                        </h3>
                        <p className="text-base sm:text-lg text-base-content/80 leading-relaxed font-semibold">
                          {cur.overviewDesc}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-3xl border border-blue-500/30 bg-gradient-to-b from-blue-500/10 to-base-100 p-7 shadow-sm space-y-3">
                      <div className="flex items-center gap-3.5 mb-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                          <BarChart3 size={24} />
                        </div>
                        <h4 className="font-black text-base-content text-lg">{cur.kpiDirectTitle}</h4>
                      </div>
                      <p className="text-base text-base-content/80 leading-relaxed font-medium">{cur.kpiDirectDesc}</p>
                    </div>

                    <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-indigo-500/10 to-base-100 p-7 shadow-sm space-y-3">
                      <div className="flex items-center gap-3.5 mb-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                          <Layers size={24} />
                        </div>
                        <h4 className="font-black text-base-content text-lg">{cur.kpiDeptTitle}</h4>
                      </div>
                      <p className="text-base text-base-content/80 leading-relaxed font-medium">{cur.kpiDeptDesc}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MODES */}
              {activeTab === "modes" && (
                <div className="space-y-6 animate-in fade-in-50 duration-200">
                  <div>
                    <h3 className="font-black text-base-content text-lg flex items-center gap-2.5">
                      <Percent size={20} className="text-blue-600" />
                      {cur.modesHeader}
                    </h3>
                    <p className="text-base text-base-content/70 mt-1 font-medium">{cur.modesDesc}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-3xl border border-blue-500/30 bg-gradient-to-b from-blue-500/10 via-base-100 to-base-100 p-7 shadow-sm space-y-3">
                      <div className="flex items-center gap-3.5">
                        <span className="rounded-xl bg-blue-600 px-4 py-1.5 text-sm font-black text-white shadow">
                          OT Ratio
                        </span>
                        <h4 className="text-lg font-black text-base-content">{cur.otTitle}</h4>
                      </div>
                      <p className="text-base text-base-content/80 leading-relaxed font-medium mt-3">{cur.otDesc}</p>
                    </div>

                    <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-indigo-500/10 via-base-100 to-base-100 p-7 shadow-sm space-y-3">
                      <div className="flex items-center gap-3.5">
                        <span className="rounded-xl bg-base-300 px-4 py-1.5 text-sm font-black text-base-content">
                          Leave Ratio
                        </span>
                        <h4 className="text-lg font-black text-base-content">{cur.leaveTitle}</h4>
                      </div>
                      <p className="text-base text-base-content/80 leading-relaxed font-medium mt-3">{cur.leaveDesc}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PERIODS */}
              {activeTab === "periods" && (
                <div className="space-y-6 animate-in fade-in-50 duration-200">
                  <div className="rounded-3xl border border-blue-500/20 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-base-100 p-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#193886] text-white shadow-lg shadow-blue-500/25">
                        <CalendarDays size={24} />
                      </div>
                      <div>
                        <h3 className="font-black text-base-content text-lg">{cur.periodsHeader}</h3>
                        <p className="text-base text-base-content/70 mt-0.5 font-medium">{cur.periodsDesc}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <div className="rounded-3xl border border-base-300 bg-base-100 p-6 shadow-sm">
                      <h4 className="text-base font-black text-primary">{cur.pDayTitle}</h4>
                      <p className="text-base text-base-content/80 mt-2 font-medium leading-relaxed">{cur.pDayDesc}</p>
                    </div>

                    <div className="rounded-3xl border border-base-300 bg-base-100 p-6 shadow-sm">
                      <h4 className="text-base font-black text-primary">{cur.pWeekTitle}</h4>
                      <p className="text-base text-base-content/80 mt-2 font-medium leading-relaxed">{cur.pWeekDesc}</p>
                    </div>

                    <div className="rounded-3xl border border-base-300 bg-base-100 p-6 shadow-sm">
                      <h4 className="text-base font-black text-primary">{cur.pMonthTitle}</h4>
                      <p className="text-base text-base-content/80 mt-2 font-medium leading-relaxed">{cur.pMonthDesc}</p>
                    </div>

                    <div className="rounded-3xl border border-base-300 bg-base-100 p-6 shadow-sm">
                      <h4 className="text-base font-black text-primary">{cur.pPickerTitle}</h4>
                      <p className="text-base text-base-content/80 mt-2 font-medium leading-relaxed">{cur.pPickerDesc}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: TARGETS */}
              {activeTab === "targets" && (
                <div className="space-y-6 animate-in fade-in-50 duration-200">
                  <div>
                    <h3 className="font-black text-base-content text-lg flex items-center gap-2.5">
                      <TrendingUp size={20} className="text-blue-600" />
                      {cur.targetsHeader}
                    </h3>
                    <p className="text-base text-base-content/70 mt-1 font-medium">{cur.targetsDesc}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-3xl border border-blue-500/30 bg-blue-500/10 p-6 shadow-sm">
                      <div className="flex items-center gap-3.5 mb-3">
                        <span className="w-12 border-t-2 border-dashed border-blue-600" />
                        <h4 className="text-base font-black text-base-content">{cur.tDailyTitle}</h4>
                      </div>
                      <p className="text-base text-base-content/80 leading-relaxed font-medium">{cur.tDailyDesc}</p>
                    </div>

                    <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 shadow-sm">
                      <div className="flex items-center gap-3.5 mb-3">
                        <span className="w-12 border-t-2 border-dashed border-rose-600" />
                        <h4 className="text-base font-black text-base-content">{cur.tAccTitle}</h4>
                      </div>
                      <p className="text-base text-base-content/80 leading-relaxed font-medium">{cur.tAccDesc}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-base text-base-content font-semibold leading-relaxed">
                    {cur.tEditTip}
                  </div>
                </div>
              )}

              {/* TAB 5: DEPTS & COLORS */}
              {activeTab === "depts" && (
                <div className="space-y-6 animate-in fade-in-50 duration-200">
                  <div>
                    <h3 className="font-black text-base-content text-lg flex items-center gap-2.5">
                      <UsersRound size={20} className="text-blue-600" />
                      {cur.deptsHeader}
                    </h3>
                    <p className="text-base text-base-content/70 mt-1 font-medium">{cur.deptsDesc}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    {[
                      { color: "bg-[#ec4899]", text: cur.dQA },
                      { color: "bg-[#f59e0b]", text: cur.dFPC },
                      { color: "bg-[#38bdf8]", text: cur.dSMT_F },
                      { color: "bg-[#10b981]", text: cur.dSMT_B },
                      { color: "bg-[#a855f7]", text: cur.dMDS },
                      { color: "bg-[#64748b]", text: cur.dIndirect },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-4 rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm"
                      >
                        <span className={`h-6 w-6 rounded-full ${item.color} shrink-0 shadow-md`} />
                        <span className="text-base font-black text-base-content">{item.text}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-5 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 shadow-sm">
                    <span className="h-3 w-12 rounded-full bg-[#c2410c] shrink-0" />
                    <span className="text-base font-black text-base-content">{cur.dAccLine}</span>
                  </div>
                </div>
              )}

              {/* TAB 6: CHART READING */}
              {activeTab === "charts" && (
                <div className="space-y-6 animate-in fade-in-50 duration-200">
                  <div>
                    <h3 className="font-black text-base-content text-lg flex items-center gap-2.5">
                      <BarChart3 size={20} className="text-blue-600" />
                      {cur.chartsHeader}
                    </h3>
                    <p className="text-base text-base-content/70 mt-1 font-medium">{cur.chartsDesc}</p>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-3xl border border-base-300 bg-base-100 p-6 shadow-sm">
                      <h4 className="text-base font-black text-base-content">{cur.cPoint1}</h4>
                      <p className="text-base text-base-content/80 mt-2 font-medium leading-relaxed">{cur.cPoint1Desc}</p>
                    </div>

                    <div className="rounded-3xl border border-base-300 bg-base-100 p-6 shadow-sm">
                      <h4 className="text-base font-black text-base-content">{cur.cPoint2}</h4>
                      <p className="text-base text-base-content/80 mt-2 font-medium leading-relaxed">{cur.cPoint2Desc}</p>
                    </div>

                    <div className="rounded-3xl border border-base-300 bg-base-100 p-6 shadow-sm">
                      <h4 className="text-base font-black text-base-content">{cur.cPoint3}</h4>
                      <p className="text-base text-base-content/80 mt-2 font-medium leading-relaxed">{cur.cPoint3Desc}</p>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-base-300 bg-base-200 px-7 py-4.5">
              <div className="flex items-center gap-2.5 text-sm sm:text-base text-base-content/70 font-semibold">
                <Lightbulb size={20} className="text-amber-500" />
                <span>{cur.tipFooter}</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#193886] to-[#2563EB] px-7 py-3 text-base font-black text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl active:scale-95 cursor-pointer"
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
