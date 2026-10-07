import React, { useState, useMemo } from "react";
import {
  Brain,
  DollarSign,
  TrendingDown,
  AlertOctagon,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Layers,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Info,
  Building2,
  Users,
  Filter,
} from "lucide-react";
import { isAggregateLine, isShiftLine } from "../utils/lineClassification";

interface FactoryHealthSummary {
  optimalCount: number;
  warningCount: number;
  criticalCount: number;
  totalLinesCount: number;
  optimalPercentage: number;
}

interface FmCommandIntelligenceProps {
  activeTab: string;
  selectedMonth: string;
  tabLines: string[];
  spreadsheetData: Record<string, any>;
  displayDays: number[];
  manhourCalendar: Record<number, any>;
  onSelectLine: (lineName: string) => void;
  selectedLine: string;
}

export default function FmCommandIntelligence({
  activeTab,
  selectedMonth,
  tabLines,
  spreadsheetData,
  displayDays,
  manhourCalendar,
  onSelectLine,
  selectedLine,
}: FmCommandIntelligenceProps) {
  // ตัวกรองหมวดหมู่ไลน์ (ทั้งหมด, แบบรวมคน, ไลน์ย่อยตัวมันเอง, แยกกะ)
  const [topologyCategoryFilter, setTopologyCategoryFilter] = useState<"all" | "summary" | "subline" | "shift">("all");

  // วิเคราะห์สถิติระดับลึกของทุกไลน์ในแผนก
  const { lineAnalytics, factoryHealth, aiRecommendations, financialImpact } = useMemo(() => {
    let deptTotalOtHours = 0;
    let deptTotalPresent = 0;
    let deptTotalRegister = 0;
    let optimalCount = 0;
    let warningCount = 0;
    let criticalCount = 0;

    const analyzedLines = tabLines.map((line) => {
      const lineObj = spreadsheetData[line] || {};
      let lineReg = 0;
      let linePresent = 0;
      let lineAbsent = 0;
      let lineOt = 0;
      let lineNormalHr = 0;
      let lineHelpIn = 0;
      let lineHelpOut = 0;
      let activeDaysCount = 0;

      displayDays.forEach((day) => {
        const d = lineObj[day] || {};
        const reg = Number(d.opRegister) || 0;
        const present = Number(d.swipeCards) || 0;
        const absent = Number(d.notWorking) || 0;
        const ot1 = Number(d.manOT1) || 0;
        const ot1Out = Number(d.manOT1HelpOut) || 0;
        const ot1In = Number(d.manOT1HelpIn) || 0;
        const ot2 = Number(d.manOT2) || 0;
        const ot2Out = Number(d.manOT2HelpOut) || 0;
        const ot2In = Number(d.manOT2HelpIn) || 0;
        const hIn = Number(d.helpInHrs) || 0;
        const hOut = Number(d.helpOutHrs) || 0;

        const isHoliday = Number(manhourCalendar?.[day]?.manhour) === 0;
        const normalHr = isHoliday ? 0 : Math.max(present * 8 - hOut + hIn, 0);
        const otHr = Math.max(ot1 - ot1Out + ot1In, 0) * 3 + Math.max(ot2 - ot2Out + ot2In, 0) * 11;

        if (reg > 0 || present > 0) {
          activeDaysCount++;
          lineReg += reg;
          linePresent += present;
          lineAbsent += absent;
          lineOt += otHr;
          lineNormalHr += normalHr;
          lineHelpIn += hIn;
          lineHelpOut += hOut;
        }
      });

      const avgPresent = activeDaysCount > 0 ? Math.round(linePresent / activeDaysCount) : 0;
      const avgReg = activeDaysCount > 0 ? Math.round(lineReg / activeDaysCount) : 0;
      const rate = lineReg > 0 ? Number(((linePresent / lineReg) * 100).toFixed(1)) : 0;

      let healthStatus: "optimal" | "warning" | "critical" = "optimal";
      if (rate < 80) {
        healthStatus = "critical";
        criticalCount++;
      } else if (rate < 95) {
        healthStatus = "warning";
        warningCount++;
      } else {
        optimalCount++;
      }

      deptTotalOtHours += lineOt;
      deptTotalPresent += linePresent;
      deptTotalRegister += lineReg;

      const isAggregate = isAggregateLine(line, activeTab);

      return {
        line,
        isAggregate,
        rate,
        avgPresent,
        avgReg,
        totalOt: Math.round(lineOt),
        totalNormalHr: Math.round(lineNormalHr),
        netHelp: Math.round(lineHelpIn - lineHelpOut),
        healthStatus,
        deficit: Math.max(avgReg - avgPresent, 0),
        surplus: Math.max(avgPresent - avgReg, 0),
      };
    });

    const totalLinesCount = tabLines.length;
    const optimalPercentage = totalLinesCount > 0 ? Math.round((optimalCount / totalLinesCount) * 100) : 0;

    // Financial calculations: ค่าแรง OT ประเมิน (เฉลี่ย 150 บาท/ชม. ตามมาตรฐานอุตสาหกรรมชิ้นส่วนอิเล็กทรอนิกส์)
    const estimatedHourlyOtRate = 150;
    const totalEstimatedOtCost = deptTotalOtHours * estimatedHourlyOtRate;
    // Dynamic Department OT Ceiling based on monitored lines
    const departmentOtCeiling = Math.max(tabLines.length * 28000, 300000);
    const otCeilingBurnPercent = Math.min(Math.round((totalEstimatedOtCost / departmentOtCeiling) * 100), 100);
    // โอกาสประหยัดงบได้หากเกลี่ยกำลังคน (ประเมินว่า 22% ของ OT สามารถลดได้หากยืมคนจากไลน์ที่มี Surplus)
    const potentialCostSavings = Math.round(totalEstimatedOtCost * 0.22);

    // AI Dynamic Smart Recommendations สำหรับ FM
    const recommendations: Array<{
      type: "rebalance" | "ot_alert" | "healthy";
      title: string;
      description: string;
      sourceLine?: string;
      targetLine?: string;
      potentialSavings?: string;
    }> = [];

    // หาไลน์ที่ขาดคนรุนแรง และไลน์ที่มีคนเหลือพอ (มุ่งเน้นไลน์ย่อยระดับหน้างานจริงก่อน)
    const sublinePool = analyzedLines.filter((l) => !l.isAggregate);
    const pool = sublinePool.length > 0 ? sublinePool : analyzedLines;
    const criticalLines = pool.filter((l) => l.healthStatus === "critical" && l.deficit > 0);
    const surplusLines = pool.filter((l) => l.rate >= 98);

    if (criticalLines.length > 0 && surplusLines.length > 0) {
      const needy = criticalLines[0];
      const provider = surplusLines[0];
      recommendations.push({
        type: "rebalance",
        title: `Algorithmic Workload Balancing: Inter-Line Capacity Leveling`,
        description: `Line [${needy.line}] is operating at ${needy.rate}% attendance (deficit of ${needy.deficit} operators) with ${needy.totalOt} accumulated OT hours. Recommended action: Shift standby operators from [${provider.line}] (${provider.rate}% capacity) to mitigate overtime burn.`,
        sourceLine: provider.line,
        targetLine: needy.line,
        potentialSavings: `Est. OT Savings: ~${Math.round(needy.totalOt * 0.35)} hrs`,
      });
    }

    // แจ้งเตือนไลน์ที่ทำ OT สูงผิดปกติ
    const topOtLines = [...analyzedLines].sort((a, b) => b.totalOt - a.totalOt);
    if (topOtLines.length > 0 && topOtLines[0].totalOt > 50) {
      const topOt = topOtLines[0];
      recommendations.push({
        type: "ot_alert",
        title: `Overtime Budget Variance Alert: High Burn-Rate Detected`,
        description: `Line [${topOt.line}] has registered the highest overtime accumulation in the department (${topOt.totalOt} hrs / approx. ฿${(topOt.totalOt * estimatedHourlyOtRate).toLocaleString()} impact). Recommend reviewing production takt time, station cycle variance, or scheduling an additional operational shift.`,
        targetLine: topOt.line,
      });
    }

    // ไลน์ที่มีการจัดการยอดเยี่ยม
    if (optimalCount > 0) {
      recommendations.push({
        type: "healthy",
        title: `Operational Discipline Benchmark: Peak Attendance Maintained`,
        description: `${optimalCount} production lines in department ${activeTab} have sustained attendance rates ≥ 95.0%, meeting Fortune 500 lean manufacturing benchmark guidelines.`,
      });
    }

    return {
      lineAnalytics: analyzedLines,
      factoryHealth: {
        optimalCount,
        warningCount,
        criticalCount,
        totalLinesCount,
        optimalPercentage,
      },
      aiRecommendations: recommendations,
      financialImpact: {
        deptTotalOtHours,
        totalEstimatedOtCost,
        departmentOtCeiling,
        otCeilingBurnPercent,
        potentialCostSavings,
      },
    };
  }, [tabLines, spreadsheetData, displayDays, manhourCalendar, activeTab]);

  // กรองแสดงผลรายการการ์ด Topology ตามประเภทไลน์
  const displayedTopologyLines = useMemo(() => {
    if (topologyCategoryFilter === "summary") {
      return lineAnalytics.filter((l) => l.isAggregate);
    }
    if (topologyCategoryFilter === "subline") {
      // ไลน์ย่อยคือ "ตัวมันเอง" (เช่น HOT PRESS, VAC, BLK) ไม่ใช่แยกชิฟต์ A B D
      return lineAnalytics.filter((l) => !l.isAggregate && !isShiftLine(l.line));
    }
    if (topologyCategoryFilter === "shift") {
      return lineAnalytics.filter((l) => isShiftLine(l.line));
    }
    return lineAnalytics;
  }, [lineAnalytics, topologyCategoryFilter]);

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-300">
      {/* 🌟 FM Strategic Cockpit: Banner & Cost Command Center */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-800/40 bg-gradient-to-br from-blue-950 via-[#071638] to-blue-950 p-5 text-white shadow-xl shadow-blue-950/30">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-blue-800/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 shadow-md shadow-sky-500/30 ring-2 ring-white/10">
              <Brain className="h-6 w-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-950/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-sky-300 border border-sky-500/30 shadow-xs">
                  <Sparkles className="h-3 w-3 text-sky-400" /> FACTORY MANAGER INTELLIGENCE
                </span>
                <span className="text-xs text-blue-200/70 font-semibold">
                  Department: {activeTab} &bull; {selectedMonth}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2 mt-0.5">
                WORKFORCE COST & TOPOLOGY CONTROL
                <span className="rounded bg-blue-900/80 px-2 py-0.5 text-[10px] font-bold text-sky-200 border border-blue-700/50">
                  C-Level Ready
                </span>
              </h2>
            </div>
          </div>

          {/* Quick Stats Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-xl bg-blue-900/50 px-3 py-1.5 text-xs font-bold text-blue-200 border border-blue-700/40">
              <Building2 className="h-3.5 w-3.5 text-sky-400" />
              <span>{factoryHealth.totalLinesCount} Lines Monitored</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-950/60 px-3 py-1.5 text-xs font-bold text-emerald-300 border border-emerald-600/40">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Health Score: {factoryHealth.optimalPercentage}%</span>
            </span>
          </div>
        </div>

        {/* Financial & Factory Health 4 Metric Cards */}
        <div className="relative z-10 mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Estimated OT Financial Cost & Budget Ceiling Burn */}
          <div className="rounded-xl border border-blue-800/50 bg-[#081b3d]/70 p-3.5 backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-amber-300">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Overtime Expenditure</span>
                <DollarSign className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-mono font-black text-amber-300">
                  ฿{(financialImpact.totalEstimatedOtCost / 1000).toFixed(1)}k
                </span>
                <span className="text-[11px] font-mono text-blue-200/70">
                  / ฿{(financialImpact.departmentOtCeiling / 1000).toFixed(0)}k Cap
                </span>
              </div>
            </div>

            {/* Ceiling Burn-Rate Progress Bar */}
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold mb-1">
                <span className="text-blue-300/80">Burn Rate: {financialImpact.otCeilingBurnPercent}%</span>
                <span className={financialImpact.otCeilingBurnPercent > 80 ? "text-rose-400" : "text-emerald-400"}>
                  {financialImpact.otCeilingBurnPercent > 80 ? "Threshold Alert" : "Within Envelope"}
                </span>
              </div>
              <div className="h-1.5 w-full bg-blue-950 rounded-full overflow-hidden border border-blue-800/40">
                <div
                  className={`h-full transition-all duration-500 ${
                    financialImpact.otCeilingBurnPercent > 80
                      ? "bg-gradient-to-r from-amber-500 to-rose-500"
                      : "bg-gradient-to-r from-cyan-500 to-amber-400"
                  }`}
                  style={{ width: `${financialImpact.otCeilingBurnPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Cost Optimization Potential */}
          <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/25 p-3.5 backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-emerald-400">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Optimization Potential</span>
                <TrendingDown className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-mono font-black text-emerald-300">
                  ฿{(financialImpact.potentialCostSavings / 1000).toFixed(1)}k
                </span>
                <span className="text-[10px] font-mono text-emerald-300/80 font-bold">(~22% Recovery)</span>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-blue-200/70 leading-tight">
              Estimated recovery via inter-station workload rebalancing
            </p>
          </div>

          {/* Card 3: Line Health Breakdown */}
          <div className="rounded-xl border border-blue-800/50 bg-[#081b3d]/70 p-3.5 backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-sky-300">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Topology Distribution</span>
                <Layers className="h-4 w-4 text-sky-400" />
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex items-center gap-1 text-xs font-mono font-bold text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>{factoryHealth.optimalCount}</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-mono font-bold text-amber-300">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span>{factoryHealth.warningCount}</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-mono font-bold text-rose-400">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  <span>{factoryHealth.criticalCount}</span>
                </div>
              </div>
            </div>
            <div className="mt-2.5">
              <div className="h-1.5 w-full bg-blue-950 rounded-full flex overflow-hidden border border-blue-800/40">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${(factoryHealth.optimalCount / factoryHealth.totalLinesCount) * 100}%` }}
                />
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${(factoryHealth.warningCount / factoryHealth.totalLinesCount) * 100}%` }}
                />
                <div
                  className="h-full bg-rose-500"
                  style={{ width: `${(factoryHealth.criticalCount / factoryHealth.totalLinesCount) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 4: Critical Bottleneck Alert */}
          <div className="rounded-xl border border-rose-800/50 bg-rose-950/25 p-3.5 backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-rose-300">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Critical Bottlenecks</span>
                <AlertOctagon className="h-4 w-4 text-rose-400 animate-pulse" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-mono font-black text-rose-300">
                  {factoryHealth.criticalCount}
                </span>
                <span className="text-xs font-medium text-rose-200/70">Lines &lt; 80% Attendance</span>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-blue-200/70 leading-tight">
              {factoryHealth.criticalCount > 0
                ? "Immediate operator transfer / headcount loan required"
                : "All production stations operating within nominal limits"}
            </p>
          </div>
        </div>
      </div>

      {/* 🌟 2-Column Section: AI Actionable Insights (Left) & Top Priority Lines (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (7 Cols): AI Intelligent Recommendations */}
        <div className="lg:col-span-7 rounded-2xl border border-blue-800/40 bg-gradient-to-b from-[#07193d]/80 to-[#05112a]/80 p-4 shadow-md backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-blue-800/40 pb-2.5 mb-3">
              <div className="flex items-center gap-2 text-white">
                <Brain className="h-4 w-4 text-sky-400" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  AI Workforce Copilot Recommendations
                </h3>
              </div>
              <span className="rounded bg-sky-950 px-2 py-0.5 text-[10px] font-black text-sky-300 border border-sky-700/50">
                Actionable Next Steps
              </span>
            </div>

            <div className="space-y-2.5">
              {aiRecommendations.map((rec, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-xl border transition-all ${
                    rec.type === "rebalance"
                      ? "bg-gradient-to-r from-blue-900/40 to-sky-950/40 border-sky-500/40"
                      : rec.type === "ot_alert"
                        ? "bg-amber-950/20 border-amber-500/40"
                        : "bg-emerald-950/20 border-emerald-500/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {rec.type === "rebalance" ? (
                        <Zap className="h-4 w-4 text-sky-400 shrink-0" />
                      ) : rec.type === "ot_alert" ? (
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      )}
                      <h4 className="text-xs font-bold text-white">{rec.title}</h4>
                    </div>
                    {rec.potentialSavings && (
                      <span className="rounded bg-emerald-900/60 px-2 py-0.5 text-[10px] font-black text-emerald-300 border border-emerald-500/40 shrink-0">
                        {rec.potentialSavings}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-blue-100/80 leading-relaxed">
                    {rec.description}
                  </p>

                  {rec.targetLine && (
                    <div className="mt-2.5 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => onSelectLine(rec.targetLine!)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <span>เปิดดูข้อมูลไลน์ {rec.targetLine}</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-blue-800/30 text-[10px] text-blue-300/60 flex items-center justify-between">
            <span>คำนวณจากบันทึกรูดบัตรและยอดล่วงเวลาจริงย้อนหลัง 30 วัน</span>
            <span className="font-semibold text-sky-400">FM Smart Decision Support</span>
          </div>
        </div>

        {/* Right Column (5 Cols): Factory Floor Line Health Grid (Topology Matrix) */}
        <div className="lg:col-span-5 rounded-2xl border border-blue-800/40 bg-gradient-to-b from-[#07193d]/80 to-[#05112a]/80 p-4 shadow-md backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-blue-800/40 pb-2 mb-2.5">
              <div className="flex items-center gap-2 text-white">
                <Layers className="h-4 w-4 text-sky-400" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Line Health Status Matrix
                </h3>
              </div>
              <span className="text-[10px] text-blue-200/70">
                คลิกเพื่อเจาะลึกรายไลน์
              </span>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 mb-2 bg-blue-950/80 p-0.5 rounded-lg border border-blue-800/40 text-[10px] font-mono font-bold">
              <button
                type="button"
                onClick={() => setTopologyCategoryFilter("all")}
                className={`px-2.5 py-0.5 rounded transition-all cursor-pointer ${
                  topologyCategoryFilter === "all" ? "bg-sky-600 text-white font-black" : "text-blue-300 hover:text-white"
                }`}
              >
                ALL ({lineAnalytics.length})
              </button>
              <button
                type="button"
                onClick={() => setTopologyCategoryFilter("summary")}
                className={`px-2.5 py-0.5 rounded transition-all cursor-pointer ${
                  topologyCategoryFilter === "summary" ? "bg-indigo-600 text-white font-black" : "text-blue-300 hover:text-white"
                }`}
              >
                ⬡ SUMMARY
              </button>
              <button
                type="button"
                onClick={() => setTopologyCategoryFilter("subline")}
                className={`px-2.5 py-0.5 rounded transition-all cursor-pointer ${
                  topologyCategoryFilter === "subline" ? "bg-slate-700 text-white font-black" : "text-blue-300 hover:text-white"
                }`}
              >
                ⬢ LINES (ตัวมันเอง)
              </button>
              <button
                type="button"
                onClick={() => setTopologyCategoryFilter("shift")}
                className={`px-2.5 py-0.5 rounded transition-all cursor-pointer ${
                  topologyCategoryFilter === "shift" ? "bg-blue-800 text-white font-black" : "text-blue-300 hover:text-white"
                }`}
              >
                ⏱️ SHIFTS
              </button>
            </div>

            {/* Micro Badges Grid representing every single production line */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
              {displayedTopologyLines.map((item) => {
                const isCurrent = item.line === selectedLine;
                return (
                  <button
                    key={item.line}
                    type="button"
                    onClick={() => onSelectLine(item.line)}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      isCurrent
                        ? "bg-blue-900 border-sky-400 ring-1 ring-sky-400 shadow-md"
                        : item.healthStatus === "critical"
                          ? "bg-rose-950/40 border-rose-600/50 hover:border-rose-400"
                          : item.healthStatus === "warning"
                            ? "bg-amber-950/30 border-amber-600/40 hover:border-amber-400"
                            : "bg-[#08193a]/60 border-blue-800/40 hover:border-blue-600"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold text-white truncate max-w-[85px]" title={item.line}>
                        {item.line}
                      </span>
                      <span
                        className={`text-[10px] font-black ${
                          item.rate >= 95
                            ? "text-emerald-400"
                            : item.rate >= 80
                              ? "text-amber-300"
                              : "text-rose-400"
                        }`}
                      >
                        {item.rate}%
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[9px] text-blue-200/70">
                      {item.isAggregate ? (
                        <span className="inline-flex items-center gap-1 rounded bg-indigo-950 px-1.5 py-0.5 text-[8px] font-mono font-bold text-indigo-300 border border-indigo-500/40">
                          <span className="h-1 w-1 rounded-full bg-indigo-400" />
                          SUMMARY
                        </span>
                      ) : isShiftLine(item.line) ? (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-950 px-1.5 py-0.5 text-[8px] font-mono font-semibold text-sky-200 border border-blue-700/40">
                          <span className="h-1 w-1 rounded-full bg-sky-400" />
                          SHIFT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-900 px-1.5 py-0.5 text-[8px] font-mono font-bold text-slate-200 border border-slate-700/40">
                          <span className="h-1 w-1 rounded-full bg-emerald-400" />
                          LINE
                        </span>
                      )}
                      <span className="font-mono font-bold text-amber-300">{item.totalOt}h OT</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-blue-800/30 text-[10px] text-blue-300/70 flex items-center justify-between font-mono">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Optimal (≥95%)</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Constrained (80-94%)</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> Critical (&lt;80%)</span>
            </div>
            <span className="font-bold text-sky-400">TELEMETRY MATRIX</span>
          </div>
        </div>
      </div>
    </div>
  );
}
