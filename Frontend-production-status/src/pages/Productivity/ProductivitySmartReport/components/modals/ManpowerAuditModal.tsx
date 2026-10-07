import React, { useState, useEffect, useMemo, useRef } from "react";
import { X, Users, Calculator, Clock, TrendingUp, AlertCircle, Info, Shield, CheckCircle2, ChevronDown, UserCheck, Search, Check } from "lucide-react";
import dayjs from "dayjs";
import { getMappedAttendanceValue } from "../../utils/attendanceMapper";
import { getLineGroupDisplayName, LineGroup } from "../../types";
import { getCachedCustomMacroLines } from "../../utils/customMacroStore";
import { fetchCustomLineNames } from "../../../../../utils/apiConfig";

type ManpowerAuditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
  attendanceData?: Record<string, any>;
  granularity?: string;
  lineGroups?: LineGroup[];
  onOpenEmployeeScanForDate?: (date: string, lineGroup: string) => void;
};

const SUB_LINES = [
  // FPC Lines
  { id: "Macro PCN", label: "Macro PCN", group: "FPC" },
  { id: "Macro FPC", label: "Macro FPC", group: "FPC" },
  { id: "Direct FPC", label: "Direct FPC", group: "FPC" },
  { id: "LINE A", label: "LINE A", group: "FPC" },
  { id: "A_TF2", label: "A_TF2 (AT Front)", group: "FPC" },
  { id: "AT_VAC", label: "AT_VAC", group: "FPC" },
  { id: "A_LAM", label: "A_LAM (AT Lam)", group: "FPC" },
  { id: "LINE A_FINAL", label: "LINE A_FINAL", group: "FPC" },
  { id: "LINE B", label: "LINE B", group: "FPC" },
  { id: "LINE B_GEN", label: "LINE B_GEN", group: "FPC" },
  { id: "LINE B_NON", label: "LINE B_NON", group: "FPC" },
  { id: "LINE C", label: "LINE C", group: "FPC" },
  { id: "LINE D", label: "LINE D", group: "FPC" },
  { id: "LINE MAT", label: "LINE MAT", group: "FPC" },
  { id: "LINE LAM", label: "LINE LAM (LAM FPC)", group: "FPC" },
  { id: "LINE VAC", label: "LINE VAC", group: "FPC" },
  { id: "LINE HPS", label: "LINE HPS", group: "FPC" },
  { id: "LINE VAC & HPS", label: "LINE VAC & HPS", group: "FPC" },
  { id: "LINE BLK", label: "LINE BLK", group: "FPC" },
  { id: "LINE OST", label: "LINE OST", group: "FPC" },
  { id: "AVI_INS", label: "AVI_INS", group: "FPC" },

  // SMT Lines
  { id: "Macro SMT", label: "Macro SMT", group: "SMT" },
  { id: "Direct SMT", label: "Direct SMT", group: "SMT" },
  { id: "Macro SMT_F", label: "Macro SMT_F", group: "SMT" },
  { id: "SMT Front_Direct", label: "SMT FRONT_DIRECT", group: "SMT" },
  { id: "Macro SMT_B", label: "Macro SMT_B", group: "SMT" },
  { id: "SMT BACK_DIRECT", label: "SMT BACK_DIRECT", group: "SMT" },

  // MOT Lines
  { id: "Automotive", label: "Automotive", group: "MOT" },
  { id: "LINE MOTA_A", label: "LINE MOTA_A", group: "MOT" },
  { id: "LINE MOTA_G", label: "LINE MOTA_G", group: "MOT" },
  { id: "LINE MOTB", label: "LINE MOTB", group: "MOT" },
  { id: "LINE MOTB_G", label: "LINE MOTB_G", group: "MOT" },
  { id: "AIX-MOT", label: "AIX-MOT", group: "MOT" },
  { id: "LINE MOTD", label: "LINE MOTD", group: "MOT" },
  { id: "LINE ASTP_A", label: "LINE ASTP_A", group: "MOT" },
  { id: "LINE ASTP_G", label: "LINE ASTP_G", group: "MOT" },
  { id: "LINE MAS", label: "LINE MAS", group: "MOT" },
  { id: "LINE REW", label: "LINE REW", group: "MOT" },
  { id: "LINE MAS & REW", label: "LINE MAS & REW", group: "MOT" },
  { id: "LINE XRAY", label: "LINE XRAY", group: "MOT" },

  // ASSY Lines
  { id: "AIX-BLK", label: "AIX-BLK", group: "ASSY" },
  { id: "LINE BLK-2", label: "LINE BLK-2", group: "ASSY" },
  { id: "LINE ASY1_A", label: "LINE ASY1_A", group: "ASSY" },
  { id: "LINE ASY1_G", label: "LINE ASY1_G", group: "ASSY" },
  { id: "LINE ASY2", label: "LINE ASY2", group: "ASSY" },
  { id: "LINE ASY3", label: "LINE ASY3", group: "ASSY" },
  { id: "LINE AELT", label: "LINE AELT", group: "ASSY" },
  { id: "LINE SMT_LAM", label: "LINE SMT_LAM", group: "ASSY" },
  { id: "MD LAM", label: "MD LAM", group: "ASSY" },

  // QA Lines
  { id: "QA FPC", label: "QA FPC", group: "QA" },
  { id: "OQI_F-AUTO", label: "OQI_F-AUTO", group: "QA" },
  { id: "OQI_F-GEN", label: "OQI_F-GEN", group: "QA" },
  { id: "OQI_M", label: "OQI_M", group: "QA" },
  { id: "QA SMT", label: "QA SMT", group: "QA" },
  { id: "OQI_S-AUTO", label: "OQI_S-AUTO", group: "QA" },
  { id: "OQI_S-GEN", label: "OQI_S-GEN", group: "QA" },

  // INDIRECT Lines
  { id: "LINE S_IND", label: "LINE S_IND", group: "INDIRECT" },
];

export const ManpowerAuditModal: React.FC<ManpowerAuditModalProps> = ({
  isOpen,
  onClose,
  startDate,
  endDate,
  attendanceData = {},
  granularity = "daily",
  lineGroups = [],
  onOpenEmployeeScanForDate,
}) => {
  const [selectedLine, setSelectedLine] = useState<string>("Macro PCN");
  const [customHelpData, setCustomHelpData] = useState<Record<string, { helpIn?: number; helpOut?: number }>>({});
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [customLineNames, setCustomLineNames] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("productivity_custom_line_names");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (isOpen) {
      fetchCustomLineNames().then((data) => {
        if (data && Object.keys(data).length > 0) {
          setCustomLineNames(data);
        }
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const availableSubLines = useMemo(() => {
    const linesMap = new Map<string, { id: string; label: string; group: string }>();

    // 1. Add base SUB_LINES
    SUB_LINES.forEach(item => {
      const customName = customLineNames[item.id] || customLineNames[item.id.toUpperCase()];
      linesMap.set(item.id.toUpperCase(), {
        id: item.id,
        label: customName || item.label,
        group: item.group
      });
    });

    // 2. Add dynamic lineGroups from database
    if (lineGroups && Array.isArray(lineGroups)) {
      lineGroups.forEach(lg => {
        const uName = lg.name.toUpperCase();
        if (uName === "LINE S_TECH_F" || uName === "LINE NPM" || uName === "SUPPORT TF2" || uName === "ALL") return;

        let groupCat = lg.factory || "OTHER";
        if (uName.includes("MOT") || uName.includes("MAS") || uName.includes("REW") || uName.includes("ASTP") || uName.includes("XRAY")) {
          groupCat = "MOT";
        } else if (uName.includes("ASY") || uName.includes("BLK-2") || uName.includes("AIX-BLK") || uName.includes("AELT") || uName.includes("MD LAM") || uName.includes("SMT_LAM")) {
          groupCat = "ASSY";
        } else if (uName.includes("QA") || uName.includes("OQI") || uName.includes("DQA") || uName.includes("MQA")) {
          groupCat = "QA";
        } else if (uName.includes("IND")) {
          groupCat = "INDIRECT";
        } else if (lg.factory === "SMT" || uName.includes("SMT")) {
          groupCat = "SMT";
        } else if (lg.factory === "FPC" || uName.includes("FPC")) {
          groupCat = "FPC";
        }

        const customName = customLineNames[lg.name] || customLineNames[uName];
        const dispName = customName || getLineGroupDisplayName(lg.name);

        if (!linesMap.has(uName)) {
          linesMap.set(uName, {
            id: lg.name,
            label: dispName,
            group: groupCat
          });
        }
      });
    }

    // 3. Add Custom Macro Lines
    const customMacros = getCachedCustomMacroLines();
    if (customMacros && customMacros.length > 0) {
      customMacros.forEach(macro => {
        const uMacro = macro.macro_name.toUpperCase();
        const customName = customLineNames[macro.macro_name] || customLineNames[uMacro];
        linesMap.set(uMacro, {
          id: macro.macro_name,
          label: customName || macro.macro_name,
          group: macro.factory ? `CUSTOM (${macro.factory})` : "CUSTOM MACRO"
        });
      });
    }

    return Array.from(linesMap.values());
  }, [lineGroups, customLineNames]);

  const filteredSubLines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return availableSubLines;
    return availableSubLines.filter(s =>
      s.label.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.group.toLowerCase().includes(q)
    );
  }, [availableSubLines, searchQuery]);

  const filteredGroups = useMemo(() => {
    const set = new Set(filteredSubLines.map(s => s.group));
    const order = ["FPC", "SMT", "MOT", "ASSY", "QA", "INDIRECT", "CUSTOM (FPC)", "CUSTOM (SMT)", "CUSTOM MACRO", "OTHER"];
    return Array.from(set).sort((a, b) => {
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [filteredSubLines]);

  if (!isOpen) return null;

  const dateKeys = Object.keys(attendanceData).sort();
  const currentSubLine = availableSubLines.find(s => s.id === selectedLine) || availableSubLines[0] || { id: selectedLine, label: selectedLine, group: "FPC" };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-base-100 rounded-2xl shadow-2xl border border-base-300 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden text-base-content">
        {/* Header */}
        <div className="p-5 border-b border-base-300 flex items-center justify-between bg-base-200/50">
          <div>
            <h2 className="text-lg font-bold text-base-content">
              ตารางการคำนวณ (Daily Manpower)
            </h2>
            <p className="text-xs text-base-content/60 mt-0.5">
              เลือกไลน์ย่อยเพื่อดูตัวเลขการคำนวณคน สแกนบัตร Man Hour, OT และตรวจสอบรายชื่อคนรูดบัตรเข้าทำงานจริง
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content hover:bg-base-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sub-line Selector Toolbar */}
        <div className="px-5 py-3 border-b border-base-300 bg-base-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base-content/70">เลือกไลน์ (Line):</span>

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(prev => !prev);
                  setSearchQuery("");
                }}
                className="btn btn-sm h-9 min-h-9 px-3.5 border border-base-300 bg-base-100 hover:bg-base-200 text-primary font-bold rounded-xl flex items-center justify-between gap-2 shadow-xs w-64"
              >
                <span className="truncate flex-1 text-left">{currentSubLine.label}</span>
                <ChevronDown size={14} className={`text-base-content/50 shrink-0 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-64 max-h-80 bg-base-100 border border-base-300 rounded-2xl shadow-2xl z-[200] flex flex-col overflow-hidden animate-fadeIn">
                  {/* Search Header */}
                  <div className="p-2 border-b border-base-200 bg-base-200/40">
                    <div className="relative flex items-center">
                      <Search size={14} className="absolute left-2.5 text-base-content/40 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="ค้นหาไลน์ (Search line)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                        className="w-full pl-8 pr-7 py-1.5 text-xs bg-base-100 border border-base-300 rounded-lg outline-none focus:border-primary font-medium"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="absolute right-2 text-base-content/40 hover:text-base-content"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Options List */}
                  <div className="flex-1 overflow-y-auto max-h-60 p-1.5 space-y-2">
                    {filteredGroups.length === 0 ? (
                      <div className="py-6 text-center text-xs text-base-content/40 font-medium">
                        ไม่พบไลน์ที่ค้นหา
                      </div>
                    ) : (
                      filteredGroups.map(grp => (
                        <div key={grp} className="space-y-0.5">
                          <div className="text-[10px] font-bold text-primary/70 uppercase tracking-wider px-2 pt-1.5 pb-1 sticky top-0 bg-base-100/95 backdrop-blur-xs">
                            หมวดหมู่: {grp}
                          </div>
                          {filteredSubLines.filter(s => s.group === grp).map(item => {
                            const isSelected = selectedLine === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setSelectedLine(item.id);
                                  setIsDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors ${isSelected
                                  ? "bg-primary text-primary-content font-bold shadow-xs"
                                  : "text-base-content hover:bg-primary/10 hover:text-primary"
                                }`}
                              >
                                <span className="truncate">{item.label}</span>
                                {isSelected && <Check size={14} className="shrink-0 ml-1.5" />}
                              </button>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-base-content/60">
            <span>หมวดหมู่: <strong className="text-base-content font-bold">{currentSubLine.group}</strong></span>
            <span>•</span>
            <span>ช่วงเวลา: <strong className="text-primary font-bold">{dayjs(startDate).format("DD/MM/YYYY")} - {dayjs(endDate).format("DD/MM/YYYY")}</strong></span>
          </div>
        </div>



        {/* Content Table Body (Transposed Layout: Dates as Columns, Parameters as Rows) */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="overflow-x-auto">
            {dateKeys.length === 0 ? (
              <div className="text-center py-12 text-base-content/40 font-mono text-sm">
                ไม่พบข้อมูลการคำนวณ Manpower สำหรับไลน์ย่อย <strong>{selectedLine}</strong> ในช่วงเวลาที่เลือก
              </div>
            ) : (() => {
              // Pre-calculate metrics per date
              const parsedDays = dateKeys.map((dateKey) => {
                const dayData = attendanceData[dateKey] || {};
                const linePrefix = selectedLine.toLowerCase().replace(/[\s-]/g, '_');
                const isMacroLine = selectedLine === "Macro SMT" || selectedLine === "Macro FPC" || selectedLine === "Macro PCN";

                const reg = getMappedAttendanceValue(selectedLine, dayData, "fpc_total_register", "total_register", granularity) || 0;
                const rawHelpIn = getMappedAttendanceValue(selectedLine, dayData, "fpc_help_in_normal", "help_in_normal", granularity);
                const helpIn = (rawHelpIn !== undefined && rawHelpIn !== null && rawHelpIn !== false)
                  ? Number(rawHelpIn)
                  : (dayData[`${linePrefix}_help_in_normal`] || dayData[`${linePrefix}_help_in`] || (isMacroLine ? (dayData.help_in_normal || dayData.fpc_help_in_normal || 0) : 0));

                const rawHelpOut = getMappedAttendanceValue(selectedLine, dayData, "fpc_help_out_normal", "help_out_normal", granularity);
                const helpOut = (rawHelpOut !== undefined && rawHelpOut !== null && rawHelpOut !== false)
                  ? Number(rawHelpOut)
                  : (dayData[`${linePrefix}_help_out_normal`] || dayData[`${linePrefix}_help_out`] || (isMacroLine ? (dayData.help_out_normal || dayData.fpc_help_out_normal || 0) : 0));

                const rawHelpInPsn = getMappedAttendanceValue(selectedLine, dayData, "fpc_help_in_psn", "help_in_psn", granularity);
                const helpInPsn = (rawHelpInPsn !== undefined && rawHelpInPsn !== null && rawHelpInPsn !== false && Number(rawHelpInPsn) > 0) ? Number(rawHelpInPsn) : (dayData[`${linePrefix}_help_in_psn`] ?? helpIn);

                const rawHelpOutPsn = getMappedAttendanceValue(selectedLine, dayData, "fpc_help_out_psn", "help_out_psn", granularity);
                const helpOutPsn = (rawHelpOutPsn !== undefined && rawHelpOutPsn !== null && rawHelpOutPsn !== false && Number(rawHelpOutPsn) > 0) ? Number(rawHelpOutPsn) : (dayData[`${linePrefix}_help_out_psn`] ?? helpOut);

                const isWorkingDay = dayData.is_working_day !== undefined
                  ? Number(dayData.is_working_day) === 1
                  : dayjs(dateKey).day() !== 0;

                const otKeyPrefix = isWorkingDay ? "ot1" : "ot2";
                const fpcOtInKey = isWorkingDay ? "fpc_help_in_ot1" : "fpc_help_in_ot2";
                const fpcOtOutKey = isWorkingDay ? "fpc_help_out_ot1" : "fpc_help_out_ot2";

                const rawHelpInOt = getMappedAttendanceValue(selectedLine, dayData, fpcOtInKey, `help_in_${otKeyPrefix}`, granularity);
                const helpInOt = (rawHelpInOt !== undefined && rawHelpInOt !== null && rawHelpInOt !== false && Number(rawHelpInOt) > 0)
                  ? Number(rawHelpInOt)
                  : (dayData[`${linePrefix}_help_in_${otKeyPrefix}`] || dayData[`${linePrefix}_help_in_ot1`] || dayData[`${linePrefix}_help_in_ot2`] || (isMacroLine ? (dayData[`help_in_${otKeyPrefix}`] || dayData[`fpc_help_in_${otKeyPrefix}`] || dayData.help_in_ot1 || dayData.fpc_help_in_ot1 || dayData.help_in_ot2 || dayData.fpc_help_in_ot2 || 0) : 0));

                const rawHelpOutOt = getMappedAttendanceValue(selectedLine, dayData, fpcOtOutKey, `help_out_${otKeyPrefix}`, granularity);
                const helpOutOt = (rawHelpOutOt !== undefined && rawHelpOutOt !== null && rawHelpOutOt !== false && Number(rawHelpOutOt) > 0)
                  ? Number(rawHelpOutOt)
                  : (dayData[`${linePrefix}_help_out_${otKeyPrefix}`] || dayData[`${linePrefix}_help_out_ot1`] || dayData[`${linePrefix}_help_out_ot2`] || (isMacroLine ? (dayData[`help_out_${otKeyPrefix}`] || dayData[`fpc_help_out_${otKeyPrefix}`] || dayData.help_out_ot1 || dayData.fpc_help_out_ot1 || dayData.help_out_ot2 || dayData.fpc_help_out_ot2 || 0) : 0));

                const ot = getMappedAttendanceValue(selectedLine, dayData, "fpc_ot_psn", "ot_psn", granularity) || 0;
                const mappedActual = getMappedAttendanceValue(selectedLine, dayData, "fpc_total_actual", "total_actual", granularity);
                const rawLeave = getMappedAttendanceValue(selectedLine, dayData, "fpc_leave", "leave", granularity);
                const absentCount = rawLeave > 0 ? rawLeave : (isWorkingDay && reg > mappedActual ? Math.max(0, reg - mappedActual) : 0);
                const mappedTotalMH = getMappedAttendanceValue(selectedLine, dayData, "fpc_total_man_hour", "total_man_hour", granularity);

                const workingHeadcount = mappedActual > 0 ? mappedActual : (reg > 0 ? Math.max(0, reg - absentCount) : 0);
                const scannedCount = workingHeadcount;
                const netWorkingCount = scannedCount > 0 ? (scannedCount + helpIn - helpOut) : 0;

                const mappedOtWkRate = getMappedAttendanceValue(selectedLine, dayData, "fpc_ot_working_day_rate", "ot_working_day_rate", granularity);
                const mappedOtHolRate = getMappedAttendanceValue(selectedLine, dayData, "fpc_ot_holiday_day_rate", "ot_holiday_day_rate", granularity);
                const otWkRate = isWorkingDay ? (mappedOtWkRate > 0 ? mappedOtWkRate : (reg > 0 && ot > 0 ? (ot / reg) * 100 : (scannedCount > 0 && ot > 0 ? (ot / scannedCount) * 100 : 0))) : 0;
                const otHolRate = !isWorkingDay ? (mappedOtHolRate > 0 ? mappedOtHolRate : (reg > 0 && ot > 0 ? (ot / reg) * 100 : (scannedCount > 0 && ot > 0 ? (ot / scannedCount) * 100 : 0))) : 0;

                const netOtCount = ot > 0 ? Math.max(0, ot + helpInOt - helpOutOt) : 0;

                let calcNormalMH = 0;
                let otMH = 0;

                if (!isWorkingDay) {
                  // On Holiday / Sunday: 0 Normal MH, and OT is 11 hours per person
                  calcNormalMH = 0;
                  otMH = netOtCount > 0 ? Math.round(netOtCount * 11) : 0;
                } else {
                  // On Working Day: 8 Normal MH per person, and OT is 3 hours per person
                  calcNormalMH = netWorkingCount > 0 ? Math.round(netWorkingCount * 8) : 0;
                  otMH = netOtCount > 0 ? Math.round(netOtCount * 3) : 0;
                }

                const totalMH = !isWorkingDay ? otMH : (calcNormalMH + otMH);
                const normalMH = !isWorkingDay ? 0 : calcNormalMH;

                return {
                  dateKey,
                  isWorking: isWorkingDay ? 1 : 0,
                  reg,
                  scannedCount,
                  helpIn,
                  helpOut,
                  helpInPsn,
                  helpOutPsn,
                  helpInOt,
                  helpOutOt,
                  absentCount,
                  ot,
                  otWkRate,
                  otHolRate,
                  normalMH,
                  otMH,
                  totalMH,
                };
              });

              return (
                <div className="overflow-x-auto border border-base-200 rounded-xl shadow-xs">
                  <table className="table table-compact w-full text-xs">
                    <thead>
                      <tr className="bg-base-200/50 text-base-content/70">
                        <th className="py-2.5 px-4 text-left font-bold sticky left-0 bg-base-200/90 z-10 w-48 shadow-sm">
                          PARAMETER (ตัวแปร)
                        </th>
                        {parsedDays.map((d) => {
                          const dayData = attendanceData[d.dateKey] || {};
                          const isWorkingDay = dayData.is_working_day !== undefined
                            ? Number(dayData.is_working_day) === 1
                            : dayjs(d.dateKey).day() !== 0;
                          const dayName = dayjs(d.dateKey).format("ddd");
                          const dateFormatted = dayjs(d.dateKey).format("DD/MM/YYYY");

                          const headerBgClass = isWorkingDay
                            ? "bg-emerald-500/15 text-emerald-900 border-emerald-300"
                            : "bg-rose-500/15 text-rose-900 border-rose-300";

                          return (
                            <th key={d.dateKey} className={`text-right py-2.5 px-3 font-semibold min-w-[110px] align-bottom border-l ${headerBgClass}`}>
                              <div className="flex flex-col items-end gap-0.5">
                                <div className={`text-[10px] font-bold uppercase tracking-wider ${isWorkingDay ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {dayName}
                                </div>
                                <div className={`text-xs font-bold ${isWorkingDay ? 'text-emerald-900' : 'text-rose-900'}`}>
                                  {dateFormatted}
                                </div>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-200/50">
                      {/* 1. Register */}
                      <tr className="hover:bg-base-200/40 transition-colors">
                        <td className="py-2 px-4 sticky left-0 bg-base-100 z-10 shadow-sm font-bold text-indigo-700 whitespace-nowrap">Register (คน)</td>
                        {parsedDays.map((d) => (
                          <td key={d.dateKey} className={`text-right py-2 px-3 font-bold text-indigo-700 border-l border-gray-300 whitespace-nowrap ${d.isWorking === 0 ? 'bg-rose-50/60' : ''}`}>
                            {d.reg > 0 ? `${d.reg.toLocaleString()} คน` : "-"}
                          </td>
                        ))}
                      </tr>

                      {/* 2. Actual Total */}
                      <tr className="hover:bg-sky-100/60 transition-colors border-y border-sky-300 bg-sky-50/70">
                        <td className="py-2 px-4 sticky left-0 bg-sky-50 z-10 shadow-sm font-black text-sky-900 whitespace-nowrap">Actual Total (คน)</td>
                        {parsedDays.map((d) => (
                          <td key={d.dateKey} className={`text-right py-2 px-3 font-black text-sky-900 bg-sky-50/70 border-l border-sky-300 whitespace-nowrap ${d.isWorking === 0 ? 'bg-rose-50/60' : ''}`}>
                            {d.scannedCount > 0 ? `${d.scannedCount.toLocaleString()} คน` : "-"}
                          </td>
                        ))}
                      </tr>

                      {/* 2.1 Day Shift */}
                      <tr className="hover:bg-base-200/30 transition-colors text-base-content/60">
                        <td className="py-1.5 px-4 sticky left-0 bg-base-100 z-10 shadow-sm pl-8 text-xs whitespace-nowrap">Day Shift (คน)</td>
                        {parsedDays.map((d) => (
                          <td key={d.dateKey} className={`text-right py-1.5 px-3 border-l border-gray-300 whitespace-nowrap ${d.isWorking === 0 ? 'bg-rose-50/60' : ''}`}>
                            {d.scannedCount > 0 ? `${Math.round(d.scannedCount * 0.7).toLocaleString()} คน` : "-"}
                          </td>
                        ))}
                      </tr>

                      {/* 2.2 Night Shift */}
                      <tr className="hover:bg-base-200/30 transition-colors text-base-content/60">
                        <td className="py-1.5 px-4 sticky left-0 bg-base-100 z-10 shadow-sm pl-8 text-xs whitespace-nowrap">Night Shift (คน)</td>
                        {parsedDays.map((d) => (
                          <td key={d.dateKey} className={`text-right py-1.5 px-3 border-l border-gray-300 whitespace-nowrap ${d.isWorking === 0 ? 'bg-rose-50/60' : ''}`}>
                            {d.scannedCount > 0 ? `${Math.round(d.scannedCount * 0.3).toLocaleString()} คน` : "-"}
                          </td>
                        ))}
                      </tr>

                      {/* 3. Leave */}
                      <tr className="hover:bg-amber-100/50 transition-colors border-b border-gray-300 bg-amber-500/10">
                        <td className="py-2 px-4 sticky left-0 bg-amber-50/90 z-10 shadow-sm font-bold text-amber-800 whitespace-nowrap">Leave (คน)</td>
                        {parsedDays.map((d) => (
                          <td key={d.dateKey} className={`text-right py-2 px-3 font-bold text-amber-800 bg-amber-500/10 border-l border-amber-300 whitespace-nowrap ${d.isWorking === 0 ? 'bg-rose-50/60' : ''}`}>
                            {d.absentCount > 0 ? `${d.absentCount.toLocaleString()} คน` : "0 คน"}
                          </td>
                        ))}
                      </tr>

                      {/* 4. Help Out Normal (ชม.) */}
                      <tr className="hover:bg-base-200/50 transition-colors border-b border-gray-300 bg-white">
                        <td className="py-2 px-4 sticky left-0 bg-white z-10 shadow-sm font-bold text-rose-600 whitespace-nowrap">Help Out Normal (ชม.)</td>
                        {parsedDays.map((d) => {
                          const helpOutHours = d.helpOut * 8;
                          const isNormal = d.isWorking === 1;
                          return (
                            <td key={d.dateKey} className={`text-right py-2 px-3 font-bold text-rose-500 border-l border-gray-300 whitespace-nowrap ${d.isWorking === 0 ? 'bg-rose-50/60' : ''}`}>
                              {isNormal && helpOutHours > 0 ? `-${Math.round(helpOutHours).toLocaleString()} ชม.` : (isNormal ? `0 ชม.` : <span className="text-base-content/30">-</span>)}
                            </td>
                          );
                        })}
                      </tr>

                      {/* 5. Help In Normal (ชม.) */}
                      <tr className="hover:bg-base-200/50 transition-colors border-b border-gray-300 bg-white">
                        <td className="py-2 px-4 sticky left-0 bg-white z-10 shadow-sm font-bold text-emerald-600 whitespace-nowrap">Help In Normal (ชม.)</td>
                        {parsedDays.map((d) => {
                          const helpInHours = d.helpIn * 8;
                          const isNormal = d.isWorking === 1;
                          return (
                            <td key={d.dateKey} className={`text-right py-2 px-3 font-bold text-emerald-500 border-l border-gray-300 whitespace-nowrap ${d.isWorking === 0 ? 'bg-rose-50/60' : ''}`}>
                              {isNormal && helpInHours > 0 ? `+${Math.round(helpInHours).toLocaleString()} ชม.` : (isNormal ? `0 ชม.` : <span className="text-base-content/30">-</span>)}
                            </td>
                          );
                        })}
                      </tr>

                      {/* 6. OT1 (คน) */}
                      <tr className="hover:bg-base-200/50 transition-colors border-b border-gray-300 bg-white border-t-2 border-t-gray-400">
                        <td className="py-2 px-4 sticky left-0 bg-white z-10 shadow-sm font-bold text-purple-700 whitespace-nowrap">OT1 (คน)</td>
                        {parsedDays.map((d) => (
                          <td key={d.dateKey} className={`text-right py-2 px-3 font-bold text-purple-600 border-l border-gray-300 whitespace-nowrap ${d.isWorking === 0 ? 'bg-rose-50/60' : ''}`}>
                            {d.isWorking === 1 ? (d.ot > 0 ? `${d.ot.toLocaleString()} คน` : "0 คน") : <span className="text-base-content/30">-</span>}
                          </td>
                        ))}
                      </tr>

                      {/* 7. Help Out OT1 (คน) */}
                      <tr className="hover:bg-base-200/50 transition-colors border-b border-gray-300 bg-white">
                        <td className="py-2 px-4 sticky left-0 bg-white z-10 shadow-sm font-bold text-rose-600 whitespace-nowrap">Help Out OT1 (คน)</td>
                        {parsedDays.map((d) => {
                          const helpOutPeople = d.helpOutOt > 0 ? d.helpOutOt : (d.helpOutPsn > 0 ? d.helpOutPsn : (d.helpOut > 0 ? Math.round(d.helpOut) : 0));
                          const isOt1 = d.isWorking === 1;
                          return (
                            <td key={d.dateKey} className={`text-right py-2 px-3 font-bold text-rose-500 border-l border-gray-300 whitespace-nowrap ${d.isWorking === 0 ? 'bg-rose-50/60' : ''}`}>
                              {isOt1 && helpOutPeople > 0 ? `-${helpOutPeople} คน` : (isOt1 ? `0 คน` : <span className="text-base-content/30">-</span>)}
                            </td>
                          );
                        })}
                      </tr>

                      {/* 8. Help In OT1 (คน) */}
                      <tr className="hover:bg-base-200/50 transition-colors border-b border-gray-300 bg-white">
                        <td className="py-2 px-4 sticky left-0 bg-white z-10 shadow-sm font-bold text-emerald-600 whitespace-nowrap">Help In OT1 (คน)</td>
                        {parsedDays.map((d) => {
                          const helpInPeople = d.helpInOt > 0 ? d.helpInOt : (d.helpInPsn > 0 ? d.helpInPsn : (d.helpIn > 0 ? Math.round(d.helpIn) : 0));
                          const isOt1 = d.isWorking === 1;
                          return (
                            <td key={d.dateKey} className={`text-right py-2 px-3 font-bold text-emerald-500 border-l border-gray-300 whitespace-nowrap ${d.isWorking === 0 ? 'bg-rose-50/60' : ''}`}>
                              {isOt1 && helpInPeople > 0 ? `+${helpInPeople} คน` : (isOt1 ? `0 คน` : <span className="text-base-content/30">-</span>)}
                            </td>
                          );
                        })}
                      </tr>

                      {/* 9. OT2 (คน) */}
                      <tr className="hover:bg-base-200/50 transition-colors border-b border-gray-300 bg-white border-t-2 border-t-gray-400">
                        <td className="py-2 px-4 sticky left-0 bg-white z-10 shadow-sm font-bold text-purple-700 whitespace-nowrap">OT2 (คน)</td>
                        {parsedDays.map((d) => (
                          <td key={d.dateKey} className={`text-right py-2 px-3 font-bold text-purple-600 border-l border-gray-300 whitespace-nowrap ${d.isWorking === 0 ? 'bg-rose-50/60' : ''}`}>
                            {d.isWorking === 0 ? (d.ot > 0 ? `${d.ot.toLocaleString()} คน` : "0 คน") : <span className="text-base-content/30">-</span>}
                          </td>
                        ))}
                      </tr>

                      {/* 10. Help Out OT2 (คน) */}
                      <tr className="hover:bg-base-200/50 transition-colors border-b border-gray-300 bg-white">
                        <td className="py-2 px-4 sticky left-0 bg-white z-10 shadow-sm font-bold text-rose-600 whitespace-nowrap">Help Out OT2 (คน)</td>
                        {parsedDays.map((d) => {
                          const helpOutPeople = d.helpOutOt > 0 ? d.helpOutOt : (d.helpOutPsn > 0 ? d.helpOutPsn : (d.helpOut > 0 ? Math.round(d.helpOut) : 0));
                          const isOt2 = d.isWorking === 0;
                          return (
                            <td key={d.dateKey} className={`text-right py-2 px-3 font-bold text-rose-500 border-l border-gray-300 whitespace-nowrap ${d.isWorking === 0 ? 'bg-rose-50/60' : ''}`}>
                              {isOt2 && helpOutPeople > 0 ? `-${helpOutPeople} คน` : (isOt2 ? `0 คน` : <span className="text-base-content/30">-</span>)}
                            </td>
                          );
                        })}
                      </tr>

                      {/* 11. Help In OT2 (คน) */}
                      <tr className="hover:bg-base-200/50 transition-colors border-b border-gray-300 bg-white">
                        <td className="py-2 px-4 sticky left-0 bg-white z-10 shadow-sm font-bold text-emerald-600 whitespace-nowrap">Help In OT2 (คน)</td>
                        {parsedDays.map((d) => {
                          const helpInPeople = d.helpInOt > 0 ? d.helpInOt : (d.helpInPsn > 0 ? d.helpInPsn : (d.helpIn > 0 ? Math.round(d.helpIn) : 0));
                          const isOt2 = d.isWorking === 0;
                          return (
                            <td key={d.dateKey} className={`text-right py-2 px-3 font-bold text-emerald-500 border-l border-gray-300 whitespace-nowrap ${d.isWorking === 0 ? 'bg-rose-50/60' : ''}`}>
                              {isOt2 && helpInPeople > 0 ? `+${helpInPeople} คน` : (isOt2 ? `0 คน` : <span className="text-base-content/30">-</span>)}
                            </td>
                          );
                        })}
                      </tr>

                      {/* 12. OT1 Work Rate % */}
                      <tr className="hover:bg-base-200/50 transition-colors border-b border-gray-300 bg-white border-t-2 border-t-gray-400">
                        <td className="py-2 px-4 sticky left-0 bg-white z-10 shadow-sm font-bold text-purple-700 whitespace-nowrap">OT1 Work Rate (%)</td>
                        {parsedDays.map((d) => (
                          <td key={d.dateKey} className={`text-right py-2 px-3 font-bold text-purple-600 border-l border-gray-300 whitespace-nowrap ${d.isWorking === 0 ? 'bg-rose-50/60' : ''}`}>
                            {d.isWorking === 1 ? (d.otWkRate > 0 ? `${d.otWkRate.toFixed(1)}%` : "0.0%") : <span className="text-base-content/30">-</span>}
                          </td>
                        ))}
                      </tr>

                      {/* 13. OT2 Holiday Rate % */}
                      <tr className="hover:bg-base-200/50 transition-colors border-b border-gray-300 bg-white">
                        <td className="py-2 px-4 sticky left-0 bg-white z-10 shadow-sm font-bold text-purple-700 whitespace-nowrap">OT2 Holiday Rate (%)</td>
                        {parsedDays.map((d) => (
                          <td key={d.dateKey} className={`text-right py-2 px-3 font-bold text-purple-600 border-l border-gray-300 whitespace-nowrap ${d.isWorking === 0 ? 'bg-rose-50/60' : ''}`}>
                            {d.isWorking === 0 ? (d.otHolRate > 0 ? `${d.otHolRate.toFixed(1)}%` : "0.0%") : <span className="text-base-content/30">-</span>}
                          </td>
                        ))}
                      </tr>

                      {/* 8. Normal MH */}
                      <tr className="hover:bg-teal-100/60 transition-colors border-b border-teal-300 bg-teal-500/10">
                        <td className="py-2 px-4 sticky left-0 bg-teal-50/90 z-10 shadow-sm font-bold text-teal-900 whitespace-nowrap">Normal MH (ชม.)</td>
                        {parsedDays.map((d) => (
                          <td key={d.dateKey} className={`text-right py-2 px-3 font-bold text-teal-900 bg-teal-500/10 border-l border-teal-300 whitespace-nowrap ${d.isWorking === 0 ? 'bg-rose-50/60' : ''}`}>
                            {d.normalMH > 0 ? `${d.normalMH.toLocaleString()} ชม.` : "-"}
                          </td>
                        ))}
                      </tr>

                      {/* 9. OT MH */}
                      <tr className="hover:bg-teal-100/60 transition-colors border-b border-teal-300 bg-teal-500/10">
                        <td className="py-2 px-4 sticky left-0 bg-teal-50/90 z-10 shadow-sm font-bold text-teal-900 whitespace-nowrap">OT MH (ชม.)</td>
                        {parsedDays.map((d) => (
                          <td key={d.dateKey} className={`text-right py-2 px-3 font-bold text-teal-900 bg-teal-500/10 border-l border-teal-300 whitespace-nowrap ${d.isWorking === 0 ? 'bg-rose-50/60' : ''}`}>
                            {d.otMH > 0 ? `${d.otMH.toLocaleString()} ชม.` : "0 ชม."}
                          </td>
                        ))}
                      </tr>

                      {/* 10. Total MH */}
                      <tr className="hover:bg-teal-200/80 transition-colors bg-teal-500/25 border-t-2 border-teal-500">
                        <td className="py-2.5 px-4 sticky left-0 bg-teal-100 z-10 shadow-sm font-black text-teal-950 text-xs whitespace-nowrap">Total MH (ชม.)</td>
                        {parsedDays.map((d) => (
                          <td key={d.dateKey} className={`text-right py-2.5 px-3 font-black text-teal-950 text-xs bg-teal-500/25 border-l border-teal-400 whitespace-nowrap ${d.isWorking === 0 ? 'bg-rose-50/60' : ''}`}>
                            {d.totalMH > 0 ? `${d.totalMH.toLocaleString()} ชม.` : "-"}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-base-300 bg-base-200/50 flex justify-between items-center text-xs text-base-content/60">
          <div className="flex items-center gap-1.5">
            <Shield size={14} className="text-sky-600" />
            <span>* รายงานสรุปการคำนวณรายไลน์ย่อยและรายชื่อคนรูดบัตร (Admin Sub-Line & Attendance Scan Audit)</span>
          </div>
          <button
            onClick={onClose}
            className="btn btn-sm btn-primary px-6 rounded-xl font-bold shadow-lg shadow-primary/20"
          >
            ปิดหน้าต่าง (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
