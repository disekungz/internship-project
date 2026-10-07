import React, { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import { FileSpreadsheet, Upload, CheckCircle2, X, Layers, Table, Search, Filter, Settings2, ArrowRight, History, RefreshCw, Clock, Edit3, Save, Calendar, Plus, ChevronDown, Check, Route, Building2, TrendingUp } from "lucide-react";
import { MATRIX_LINE_GROUP_NAMES, normalizeMatrixLineGroupName } from "../../hooks/useProcessOutputData";
import { getLineGroupDisplayName } from "../../types";
import { getApiBaseUrl, fetchDynamicLines, fetchCustomLineNames } from "../../../../../utils/apiConfig";

type ParsedRecord = {
  line: string;
  originalLine: string;
  sheetName: string;
  date: string;
  daily_plan: number;
  daily_output?: number;
};

type ImportHistoryItem = {
  id: number;
  file_name: string;
  record_count: number;
  sheet_count: number;
  imported_by: string;
  imported_at: string;
  status: string;
  details: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lineGroups?: any[];
  onOpenManualMatrixModal?: () => void;
};

const API_BASE_URL = getApiBaseUrl();

const TARGET_SYSTEM_LINES = [
  "IGNORE",
  // SMT lines
  "Direct SMT", "Macro SMT", "Macro SMT_F", "SMT Front_Direct",
  "Macro SMT_B", "SMT BACK_DIRECT",
  // MOT lines
  "Automotive", "LINE MOTA_A", "LINE MOTA_G", "LINE MOTB", "LINE MOTB_G", "AIX-MOT", "LINE MOTD",
  "LINE ASTP_A", "LINE ASTP_G", "LINE MAS", "LINE REW", "LINE MAS & REW", "LINE XRAY", "LINE S_TECH_F", "LINE S_TSTE_F",
  // ASSY lines
  "AIX-BLK", "LINE BLK-2", "LINE ASY1_A", "LINE ASY1_G", "LINE ASY2", "LINE ASY3", "LINE ASY4", "LINE ASY5", "LINE ASY6", "LINE ASY7",
  "LINE AELT", "LINE SMT_LAM", "MD LAM", "ASY SMT",
  // QA lines
  "QA FPC", "OQI_F-AUTO", "OQI_F-GEN", "OQI_M", "QA SMT", "OQI_S-AUTO", "OQI_S-GEN",
  // FPC lines
  "Macro PCN", "Macro FPC", "Direct FPC", "LINE NPM", "LINE A", "A_TF2", "AT_VAC", "A_LAM",
  "LINE A_FINAL", "LINE B", "LINE B_GEN", "LINE B_NON", "LINE C", "LINE D", "LINE MAT",
  "LAM_FPC", "LINE VAC & HPS", "LINE VAC", "LINE HPS", "LINE BLK", "LINE OST", "AVI_INS", "MDS"
];

const getImportTargetLines = (sheetName: string, rawLine: string): string[] => {
  const upperSheet = sheetName.trim().toUpperCase().replace(/[-_]/g, " ");
  const upperLine = rawLine.trim().toUpperCase().replace(/\s+/g, " ");
  const cleanLine = upperLine.replace(/[^A-Z0-9_\-\(\)\s]/g, "");

  // 0. AIXZ Handling by Sheet
  if (cleanLine.includes("AIXZ") || cleanLine.includes("AIX-Z") || cleanLine.includes("AIX_Z")) {
    if (upperSheet.includes("MOT") || upperSheet.includes("FRONT")) {
      return ["AIX-MOT", "LINE AIX-MOT"];
    }
    if (upperSheet.includes("ASSY") || upperSheet.includes("ASY") || upperSheet.includes("BACK")) {
      return ["AIX-ASY", "AIX-BLK"];
    }
    return ["AIX-MOT", "AIX-ASY", "AIX-BLK"];
  }

  // 1. DAILY OUTPUT / SMT Sheet
  if (upperSheet.includes("DAILY OUTPUT") || upperSheet.includes("SMT")) {
    if (cleanLine.includes("SMT-FRONT") || cleanLine.includes("SMT FRONT") || cleanLine.includes("SMT_FRONT") || cleanLine.includes("FRONT SMT")) {
      return ["Macro SMT_F", "SMT Front_Direct"];
    }
    if (cleanLine.includes("SMT OVERALL") || cleanLine.includes("SMT-OVERALL") || cleanLine.includes("SMT_OVERALL") || cleanLine.includes("SMT BACK") || cleanLine.includes("SMT-BACK")) {
      return ["Macro SMT_B", "Direct SMT", "SMT BACK_DIRECT"];
    }
  }

  // 2. Stamp / ASTP lines
  if (cleanLine.includes("STAMP") || cleanLine.includes("ASTP")) {
    if (
      cleanLine.includes("GEN") ||
      cleanLine.includes("GENERAL") ||
      cleanLine.includes("ASTP-G") ||
      cleanLine.includes("ASTP_G") ||
      cleanLine.includes("ASTP G") ||
      cleanLine.includes("STAMP-G") ||
      cleanLine.includes("STAMP G")
    ) {
      return ["LINE ASTP_G"];
    }
    if (
      cleanLine.includes("AUTO") ||
      cleanLine.includes("AUTOMOTIVE") ||
      cleanLine.includes("ASTP-A") ||
      cleanLine.includes("ASTP_A") ||
      cleanLine.includes("ASTP A") ||
      cleanLine.includes("STAMP-A") ||
      cleanLine.includes("STAMP A")
    ) {
      return ["LINE ASTP_A"];
    }
  }

  // 3. MOT Lines
  if (cleanLine.includes("SMT-MOT") || cleanLine.includes("SMT MOT") || cleanLine.includes("SMT_MOT")) {
    return ["Macro SMT"];
  }
  if (cleanLine.includes("MOT")) {
    // MOT-A
    if (cleanLine.includes("MOT-A") || cleanLine.includes("MOT_A") || cleanLine.includes("MOT A") || cleanLine.includes("MOTA")) {
      if (cleanLine.includes("GEN") || cleanLine.includes("GENERAL") || cleanLine.includes("MOTA_G") || cleanLine.includes("MOT-A_G") || cleanLine.includes("MOT A_G") || cleanLine.includes("MOT A G")) {
        return ["LINE MOTA_G"];
      }
      return ["LINE MOTA_A"];
    }
    // MOT-B
    if (cleanLine.includes("MOT-B") || cleanLine.includes("MOT_B") || cleanLine.includes("MOT B") || cleanLine.includes("MOTB")) {
      if (cleanLine.includes("GEN") || cleanLine.includes("GENERAL") || cleanLine.includes("MOTB_G") || cleanLine.includes("MOT-B_G") || cleanLine.includes("MOT B_G") || cleanLine.includes("MOT B G")) {
        return ["LINE MOTB_G"];
      }
      return ["LINE MOTB"];
    }
    // MOT-C / AIX-MOT
    if (cleanLine.includes("MOT-C") || cleanLine.includes("MOT_C") || cleanLine.includes("MOT C") || cleanLine.includes("MOTC") || cleanLine.includes("AIX-MOT") || cleanLine.includes("AIX_MOT") || cleanLine.includes("AIX MOT")) {
      return ["AIX-MOT"];
    }
    // MOT-D
    if (cleanLine.includes("MOT-D") || cleanLine.includes("MOT_D") || cleanLine.includes("MOT D") || cleanLine.includes("MOTD")) {
      return ["LINE MOTD"];
    }
  }

  // 4. MAS
  if (cleanLine.includes("MAS")) {
    return ["LINE MAS"];
  }

  // 5. REW / Rework
  if (cleanLine.includes("REW") || cleanLine.includes("REWORK")) {
    return ["LINE REW"];
  }

  // 6. X-RAY / XRAY
  if (cleanLine.includes("X-RAY") || cleanLine.includes("XRAY") || cleanLine.includes("X RAY")) {
    return ["LINE XRAY"];
  }

  // 7. S_TECH_F
  if (cleanLine.includes("S_TECH") || cleanLine.includes("S-TECH") || cleanLine.includes("STECH")) {
    return ["LINE S_TECH_F"];
  }

  // 8. ASSY Lines
  if (cleanLine.includes("ASSY") || cleanLine.includes("ASY")) {
    // ASSY 1
    if (cleanLine.includes("1") || cleanLine.includes("ASY1")) {
      if (cleanLine.includes("GEN") || cleanLine.includes("GENERAL") || cleanLine.includes("1_G") || cleanLine.includes("1 G") || cleanLine.includes("1-G")) {
        return ["LINE ASY1_G"];
      }
      return ["LINE ASY1_A"];
    }
    // ASSY 2
    if (cleanLine.includes("2") || cleanLine.includes("ASY2")) {
      return ["LINE ASY2"];
    }
    // ASSY 3
    if (cleanLine.includes("3") || cleanLine.includes("ASY3")) {
      return ["LINE ASY3"];
    }
    // ASSY 8 / Auto Feed / AELT
    if (cleanLine.includes("8") || cleanLine.includes("ASY8") || cleanLine.includes("AUTO FEED") || cleanLine.includes("AUTOFEED") || cleanLine.includes("AELT")) {
      return ["LINE AELT"];
    }
  }

  // 9. AELT standalone
  if (cleanLine.includes("AELT") || cleanLine.includes("AUTO FEED") || cleanLine.includes("AUTOFEED")) {
    return ["LINE AELT"];
  }

  // 10. BLK lines
  if (cleanLine.includes("BLK")) {
    if (cleanLine.includes("MD")) {
      return ["LINE BLK-2"];
    }
    if (cleanLine.includes("1") || cleanLine.includes("BLK-1") || cleanLine.includes("BLK1") || cleanLine.includes("AIX-BLK")) {
      return ["AIX-BLK"];
    }
    return ["LINE BLK-2"];
  }

  // 11. MD LAM standalone
  if (cleanLine.includes("MD LAM") || cleanLine.includes("MDLAM") || cleanLine.includes("MD_LAM") || cleanLine.includes("MD-LAM") || cleanLine.includes("LAM MD") || cleanLine.includes("LAM_MD")) {
    return ["MD LAM"];
  }

  // 12. SMT LAM standalone
  if (cleanLine.includes("SMT LAM") || cleanLine.includes("SMT_LAM") || cleanLine.includes("SMT-LAM") || cleanLine === "LAM") {
    return ["LINE SMT_LAM"];
  }

  // 13. Direct SMT standalone
  if (cleanLine.includes("DIRECT SMT") || cleanLine.includes("DIRECT_SMT")) {
    return ["Direct SMT"];
  }

  // Fallback to normalizeMatrixLineGroupName
  const normalized = normalizeMatrixLineGroupName(rawLine);
  if (normalized && normalized !== rawLine.trim() && TARGET_SYSTEM_LINES.includes(normalized)) {
    return [normalized];
  }

  return [];
};

export const ExcelImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  lineGroups = [],
  onOpenManualMatrixModal,
}) => {
  const [modalTab, setModalTab] = useState<"IMPORT" | "MANUAL" | "HISTORY">("IMPORT");

  // History states
  const [historyList, setHistoryList] = useState<ImportHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Excel Import states
  const [fileName, setFileName] = useState<string>("");
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([]);
  const [sheetSummary, setSheetSummary] = useState<{ name: string; count: number }[]>([]);
  const [lineMappingOverrides, setLineMappingOverrides] = useState<Record<string, string>>({});
  const [activeSheetFilter, setActiveSheetFilter] = useState<string>("ALL");
  const [previewSearch, setPreviewSearch] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingFolder, setIsSyncingFolder] = useState(false);
  const [isSyncingFpcFolder, setIsSyncingFpcFolder] = useState(false);

  const handleFpcFolderAutoSync = async () => {
    try {
      setIsSyncingFpcFolder(true);
      Swal.fire({
        title: "กำลังอ่านไฟล์จากโฟลเดอร์ Plan EFPC...",
        html: "ระบบกำลังสแกนอ่านไฟล์ Excel ทั้งหมดจาก<br/><code className='text-xs text-blue-600 font-bold'>\\\\10.17.86.37\\output</code><br/>กรุณารอสักครู่",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const res = await fetch(`${API_BASE_URL}/productivity/sync-fpc-folder`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        Swal.fire({
          icon: "success",
          title: "Sync Plan EFPC สำเร็จ!",
          text: `อัปเดตข้อมูลเป้าหมาย FPC (Daily Plan: Pcs, Sheet, Lot) สำเร็จจำนวน ${Number(data.count || 0).toLocaleString()} รายการ จาก ${data.filesCount || 0} ไฟล์`,
          confirmButtonColor: "#059669",
        });
        onSuccess();
      } else {
        Swal.fire({
          icon: "error",
          title: "Sync ล้มเหลว",
          text: data.error || data.message || "ไม่สามารถอ่านไฟล์จากโฟลเดอร์ Plan EFPC ได้",
          confirmButtonColor: "#ef4444",
        });
      }
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: err.message || "ไม่สามารถเชื่อมต่อ Server ได้",
        confirmButtonColor: "#ef4444",
      });
    } finally {
      setIsSyncingFpcFolder(false);
    }
  };

  const handleFolderAutoSync = async () => {
    try {
      setIsSyncingFolder(true);
      Swal.fire({
        title: "กำลังอ่านไฟล์จาก Network Folder...",
        html: "ระบบกำลังสแกนอ่านไฟล์ Excel ทั้งหมดจาก<br/><code className='text-xs text-blue-600 font-bold'>Network Folder</code><br/>กรุณารอสักครู่",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const res = await fetch(`${API_BASE_URL}/productivity/sync-excel-folder`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        Swal.fire({
          icon: "success",
          title: "Sync จาก Network Folder สำเร็จ!",
          text: `อัปเดตข้อมูลเป้าหมาย (Daily Plan) สำเร็จจำนวน ${Number(data.count || 0).toLocaleString()} รายการ จาก ${data.filesCount || 0} ไฟล์`,
          confirmButtonColor: "#059669",
        });
        onSuccess();
      } else {
        Swal.fire({
          icon: "error",
          title: "Sync ล้มเหลว",
          text: data.error || "ไม่สามารถอ่านไฟล์จาก Network Folder ได้",
          confirmButtonColor: "#ef4444",
        });
      }
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: err.message || "ไม่สามารถเชื่อมต่อ Server ได้",
        confirmButtonColor: "#ef4444",
      });
    } finally {
      setIsSyncingFolder(false);
    }
  };

  // Manual Entry states
  const [manualLine, setManualLine] = useState<string>("Direct SMT");
  const [manualYear, setManualYear] = useState<number>(new Date().getFullYear());
  const [manualMonth, setManualMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [manualRows, setManualRows] = useState<{ date: string; plan: string; output: string }[]>([]);
  const [isLoadingManual, setIsLoadingManual] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);

  // Dynamic & Custom Lines for Target Line dropdown
  const [customImportLines, setCustomImportLines] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("productivity_custom_import_lines");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [dynamicLinesList, setDynamicLinesList] = useState<string[]>([]);
  const [isAddingNewLine, setIsAddingNewLine] = useState(false);
  const [newLineInput, setNewLineInput] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [lineSearchTerm, setLineSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE_URL}/productivity/excel-import-history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data);
      }
    } catch (err) {
      console.error("Failed to fetch import history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const formatNumberDisplay = (val: any): string => {
    if (val === undefined || val === null || val === "") return "";
    const rawStr = String(val).replace(/,/g, "");
    const num = Number(rawStr);
    if (isNaN(num)) return String(val);
    if (num % 1 === 0) {
      return Math.round(num).toLocaleString("en-US");
    }
    const parts = rawStr.split(".");
    parts[0] = Number(parts[0]).toLocaleString("en-US");
    return parts.join(".");
  };

  const parseNumberValue = (val: string): number => {
    if (!val || val.trim() === "") return 0;
    const clean = val.replace(/,/g, "");
    const num = Number(clean);
    return isNaN(num) ? 0 : num;
  };

  const loadManualData = async () => {
    setIsLoadingManual(true);
    try {
      const yearStr = String(manualYear);
      const monthStr = String(manualMonth).padStart(2, "0");
      const daysInMonth = new Date(manualYear, manualMonth, 0).getDate();
      const startDate = `${yearStr}-${monthStr}-01`;
      const endDate = `${yearStr}-${monthStr}-${String(daysInMonth).padStart(2, "0")}`;

      const [smtRes, fpcRes] = await Promise.all([
        fetch(`${API_BASE_URL}/productivity/smt-daily-actual-output?startDate=${startDate}&endDate=${endDate}`).catch(() => null),
        fetch(`${API_BASE_URL}/productivity/fpc-daily-actual-plan?startDate=${startDate}&endDate=${endDate}`).catch(() => null)
      ]);

      let smtData: any[] = [];
      let fpcData: any[] = [];
      if (smtRes && smtRes.ok) smtData = await smtRes.json();
      if (fpcRes && fpcRes.ok) fpcData = await fpcRes.json();

      const lineMap = new Map<string, { plan: number; output: number | null }>();
      const normManual = normalizeMatrixLineGroupName(manualLine).trim().toUpperCase();
      const rawManual = manualLine.trim().toUpperCase();
      const noLineManual = rawManual.replace(/^LINE\s+/i, "");

      // Match SMT plan
      smtData.forEach((row: any) => {
        const rowNorm = normalizeMatrixLineGroupName(row.line || "").trim().toUpperCase();
        const rowRaw = (row.line || "").trim().toUpperCase();
        const rowNoLine = rowRaw.replace(/^LINE\s+/i, "");
        if (
          rowRaw === rawManual ||
          rowNorm === normManual ||
          rowNoLine === noLineManual ||
          rowRaw === normManual ||
          rowNorm === rawManual
        ) {
          const planVal = Number(row.daily_plan || 0);
          lineMap.set(row.date, { plan: planVal, output: row.daily_output });
        }
      });

      // Match FPC plan
      fpcData.forEach((row: any) => {
        const rowNorm = normalizeMatrixLineGroupName(row.line || "").trim().toUpperCase();
        const rowRaw = (row.line || "").trim().toUpperCase();
        const rowNoLine = rowRaw.replace(/^LINE\s+/i, "");
        if (
          rowRaw === rawManual ||
          rowNorm === normManual ||
          rowNoLine === noLineManual ||
          rowRaw === normManual ||
          rowNorm === rawManual
        ) {
          const planVal = Number(row.piece_plan || row.sht_plan || row.lot_plan || 0);
          lineMap.set(row.date, { plan: planVal, output: null });
        }
      });

      const rows: { date: string; plan: string; output: string }[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dStr = `${yearStr}-${monthStr}-${String(day).padStart(2, "0")}`;
        const existing = lineMap.get(dStr);
        rows.push({
          date: dStr,
          plan: existing?.plan !== undefined && existing?.plan !== null && existing?.plan !== 0
            ? formatNumberDisplay(existing.plan)
            : (existing?.plan === 0 ? "0" : ""),
          output: existing?.output !== undefined && existing?.output !== null ? formatNumberDisplay(existing.output) : ""
        });
      }

      setManualRows(rows);
    } catch (err) {
      console.error("Failed to load manual data:", err);
    } finally {
      setIsLoadingManual(false);
    }
  };

  const handleSaveManualData = async () => {
    const activeItem = formattedLineGroups.find(i => i.name === manualLine || i.displayName === manualLine);
    const isFpc = activeItem?.factory === "FPC" || [
      "LINE A", "LINE B", "LINE C", "LINE D", "AT_VAC", "LINE LAM", "LINE VAC & HPS", "LINE VAC", "LINE BLK", "LINE OST", "MDS", "Macro PCN", "Direct FPC", "Macro FPC"
    ].some(f => manualLine.toUpperCase().includes(f.toUpperCase()));

    const payload = manualRows
      .filter((r) => r.plan !== "" || r.output !== "")
      .map((r) => ({
        line: manualLine,
        date: r.date,
        daily_plan: r.plan !== "" ? parseNumberValue(r.plan) : 0,
        piece_plan: r.plan !== "" ? parseNumberValue(r.plan) : 0,
        sht_plan: 0,
        lot_plan: 0,
        daily_output: r.output !== "" ? parseNumberValue(r.output) : null
      }));

    if (payload.length === 0) {
      Swal.fire({
        icon: "info",
        title: "ไม่มีข้อมูลให้บันทึก",
        text: "โปรดระบุค่า Daily Plan หรือ Daily Output ในวันที่ต้องการบันทึก"
      });
      return;
    }

    setIsSavingManual(true);
    try {
      if (isFpc) {
        // Save to FPC Plan
        const res = await fetch(`${API_BASE_URL}/productivity/upload-fpc-daily-plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            records: payload,
            fileName: `Manual Entry - ${manualLine}`,
            details: `แก้ไขบนเว็บ (${manualLine}) จำนวน ${payload.length} รายการ เดือน ${manualMonth}/${manualYear}`
          })
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.details || errData.error || "Failed to save FPC records");
        }
      } else {
        // Save to SMT Plan
        const res = await fetch(`${API_BASE_URL}/productivity/upload-smt-daily-actual-output`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            records: payload,
            fileName: `Manual Entry - ${manualLine}`,
            sheetCount: 1,
            details: `แก้ไขบนเว็บ (${manualLine}) จำนวน ${payload.length} รายการ เดือน ${manualMonth}/${manualYear}`
          })
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.details || errData.error || "Failed to save SMT records");
        }
      }

      await Swal.fire({
        icon: "success",
        title: "บันทึกข้อมูลเรียบร้อย!",
        text: `บันทึกข้อมูล Plan สำหรับ ${manualLine} จำนวน ${payload.length} รายการสำเร็จ`,
        confirmButtonColor: "#059669"
      });

      onSuccess();
    } catch (err: any) {
      console.error("Save manual error:", err);
      Swal.fire({
        icon: "error",
        title: "บันทึกข้อมูลไม่สำเร็จ",
        text: err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูลลงฐานข้อมูล"
      });
    } finally {
      setIsSavingManual(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (modalTab === "HISTORY") fetchHistory();
      if (modalTab === "MANUAL") loadManualData();

      fetchDynamicLines().then(dynLines => {
        if (dynLines && dynLines.length > 0) {
          const names = dynLines.map(d => d.line_name || d.display_name).filter(Boolean);
          setDynamicLinesList(prev => Array.from(new Set([...prev, ...names])));
        }
      });
      fetchCustomLineNames().then(names => {
        if (names && Object.keys(names).length > 0) {
          const customKeys = Object.values(names).filter(Boolean);
          setDynamicLinesList(prev => Array.from(new Set([...prev, ...customKeys])));
        }
      });
    }
  }, [isOpen, modalTab, manualLine, manualYear, manualMonth]);

  const [manualSectorFilter, setManualSectorFilter] = useState<"ALL" | "SMT" | "FPC" | "MACRO">("ALL");

  const formattedLineGroups = useMemo(() => {
    let sourceGroups: any[] = [];
    if (lineGroups && lineGroups.length > 0) {
      sourceGroups = lineGroups;
    } else {
      sourceGroups = [
        // MACRO
        { id: "direct_smt", name: "Direct SMT", factory: "MACRO" },
        { id: "macro_smt", name: "Macro SMT", factory: "MACRO" },
        { id: "macro_smt_f", name: "Macro SMT_F", factory: "MACRO" },
        { id: "macro_smt_b", name: "Macro SMT_B", factory: "MACRO" },
        { id: "direct_fpc", name: "Direct FPC", factory: "MACRO" },
        { id: "macro_fpc", name: "Macro FPC", factory: "MACRO" },
        { id: "macro_pcn", name: "Macro PCN", factory: "MACRO" },
        { id: "mds", name: "MDS", factory: "MACRO" },

        // SMT
        { id: "line_mota_a", name: "LINE MOTA_A", factory: "SMT" },
        { id: "line_mota_g", name: "LINE MOTA_G", factory: "SMT" },
        { id: "line_motb", name: "LINE MOTB", factory: "SMT" },
        { id: "line_motb_g", name: "LINE MOTB_G", factory: "SMT" },
        { id: "line_motc", name: "LINE MOTC", factory: "SMT" },
        { id: "line_motd", name: "LINE MOTD", factory: "SMT" },
        { id: "line_astp_a", name: "LINE ASTP_A", factory: "SMT" },
        { id: "line_astp_g", name: "LINE ASTP_G", factory: "SMT" },
        { id: "line_asy1_a", name: "LINE ASY1_A", factory: "SMT" },
        { id: "line_asy1_g", name: "LINE ASY1_G", factory: "SMT" },
        { id: "line_asy2", name: "LINE ASY2", factory: "SMT" },
        { id: "line_asy3", name: "LINE ASY3", factory: "SMT" },
        { id: "line_aelt", name: "LINE AELT", factory: "SMT" },
        { id: "aix_asy", name: "AIX-ASY", factory: "SMT" },
        { id: "aix_blk", name: "AIX-BLK", factory: "SMT" },
        { id: "aix_mot", name: "AIX-MOT", factory: "SMT" },
        { id: "line_blk_2", name: "LINE BLK-2", factory: "SMT" },
        { id: "line_mas", name: "LINE MAS", factory: "SMT" },
        { id: "line_rew", name: "LINE REW", factory: "SMT" },
        { id: "line_xray", name: "LINE XRAY", factory: "SMT" },
        { id: "line_smt_lam", name: "LINE SMT_LAM", factory: "SMT" },
        { id: "md_lam", name: "MD LAM", factory: "SMT" },
        { id: "qa_smt", name: "QA SMT", factory: "SMT" },
        { id: "oqi_s_auto", name: "OQI_S-AUTO", factory: "SMT" },
        { id: "oqi_s_gen", name: "OQI_S-GEN", factory: "SMT" },
        { id: "oqi_m", name: "OQI_M", factory: "SMT" },

        // FPC
        { id: "line_a", name: "LINE A", factory: "FPC" },
        { id: "at_vac", name: "AT_VAC", factory: "FPC" },
        { id: "line_a_final", name: "LINE A_FINAL", factory: "FPC" },
        { id: "line_b", name: "LINE B", factory: "FPC" },
        { id: "line_b_gen", name: "LINE B_GEN", factory: "FPC" },
        { id: "line_b_non", name: "LINE B_NON", factory: "FPC" },
        { id: "line_c", name: "LINE C", factory: "FPC" },
        { id: "line_d", name: "LINE D", factory: "FPC" },
        { id: "line_lam", name: "LINE LAM", factory: "FPC" },
        { id: "line_vac_hps", name: "LINE VAC & HPS", factory: "FPC" },
        { id: "line_vac", name: "LINE VAC", factory: "FPC" },
        { id: "line_blk", name: "LINE BLK", factory: "FPC" },
        { id: "line_ost", name: "LINE OST", factory: "FPC" },
        { id: "qa_fpc", name: "QA FPC", factory: "FPC" },
        { id: "oqi_f_auto", name: "OQI_F-AUTO", factory: "FPC" },
        { id: "oqi_f_gen", name: "OQI_F-GEN", factory: "FPC" },
      ];
    }

    const seen = new Set<string>();
    const list: { id: string; name: string; displayName: string; factory: string }[] = [];

    sourceGroups.forEach(g => {
      const name = normalizeMatrixLineGroupName(g.name);
      if (name === "LINE S_TECH_F" || name === "LINE NPM" || name === "SUPPORT TF2" || name === "IGNORE") return;
      const key = name.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        const isMacro = name.startsWith("Macro ") || name.startsWith("Direct ") || name === "MDS";
        const factory = isMacro ? "MACRO" : (g.factory || (name.includes("FPC") || ["LINE A", "LINE B", "LINE C", "LINE D", "AT_VAC", "LINE LAM", "LINE VAC & HPS", "LINE VAC", "LINE BLK", "LINE OST", "MDS", "Macro PCN"].some(f => name.includes(f)) ? "FPC" : "SMT"));
        list.push({
          id: g.id || name,
          name: name,
          displayName: getLineGroupDisplayName(name),
          factory
        });
      }
    });

    [...dynamicLinesList, ...customImportLines].forEach(line => {
      if (!line) return;
      const key = line.trim().toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          id: line.trim(),
          name: line.trim(),
          displayName: line.trim(),
          factory: "CUSTOM"
        });
      }
    });

    return list;
  }, [lineGroups, dynamicLinesList, customImportLines]);

  const filteredLineOptions = useMemo(() => {
    const query = lineSearchTerm.trim().toLowerCase();
    return formattedLineGroups.filter(item => {
      if (manualSectorFilter !== "ALL") {
        if (manualSectorFilter === "MACRO" && item.factory !== "MACRO") return false;
        if (manualSectorFilter === "SMT" && item.factory !== "SMT") return false;
        if (manualSectorFilter === "FPC" && item.factory !== "FPC") return false;
      }
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.displayName.toLowerCase().includes(query) ||
        item.factory.toLowerCase().includes(query)
      );
    });
  }, [formattedLineGroups, manualSectorFilter, lineSearchTerm]);

  const handleAddNewLine = () => {
    const trimmed = newLineInput.trim();
    if (!trimmed) return;
    if (!customImportLines.includes(trimmed)) {
      const updated = [...customImportLines, trimmed];
      setCustomImportLines(updated);
      try {
        localStorage.setItem("productivity_custom_import_lines", JSON.stringify(updated));
      } catch (e) { }
    }
    setManualLine(trimmed);
    setNewLineInput("");
    setIsAddingNewLine(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleQuickAddTyped = (typedLine: string) => {
    const trimmed = typedLine.trim();
    if (!trimmed) return;
    if (!customImportLines.includes(trimmed)) {
      const updated = [...customImportLines, trimmed];
      setCustomImportLines(updated);
      try {
        localStorage.setItem("productivity_custom_import_lines", JSON.stringify(updated));
      } catch (e) {}
    }
    setManualLine(trimmed);
    setLineSearchTerm("");
    setIsDropdownOpen(false);
  };

  const parseExcelDate = (val: any): string | null => {
    if (!val) return null;

    // Handle JS Date object (from cellDates: true)
    if (val instanceof Date && !isNaN(val.getTime())) {
      const safeDate = new Date(val.getTime() + 12 * 3600 * 1000);
      let y = safeDate.getUTCFullYear();
      if (y > 2500) y -= 543;
      if (y < 2020 || y > 2035) return null;
      const m = String(safeDate.getUTCMonth() + 1).padStart(2, "0");
      const d = String(safeDate.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    // Handle Excel Serial Number (e.g. 46194 = 2026-07-01)
    if (typeof val === "number") {
      if (val < 43000 || val > 52000) return null;
      const dateObj = XLSX.SSF.parse_date_code(val);
      if (dateObj) {
        let y = dateObj.y < 100 ? 2000 + dateObj.y : dateObj.y;
        if (y > 2500) y -= 543;
        if (y < 2020 || y > 2035) return null;
        const m = String(dateObj.m).padStart(2, "0");
        const d = String(dateObj.d).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
      return null;
    }

    const str = String(val).trim();
    if (!str || str.length < 1) return null;

    // Format: 1-Jul-26 or 01-Jul-2026 or 1/Jul/2026 or 1-Jul or 01-Jul
    const matchMonthName = str.match(/^(\d{1,2})[-/]([A-Za-z]{3})(?:[-/](\d{2,4}))?$/i);
    if (matchMonthName) {
      const d = String(matchMonthName[1]).padStart(2, "0");
      const monthMap: Record<string, string> = {
        jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
        jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
      };
      const m = monthMap[matchMonthName[2].toLowerCase()];
      let y = matchMonthName[3] ? parseInt(matchMonthName[3], 10) : new Date().getFullYear();
      if (y < 100) y += 2000;
      if (y > 2500) y -= 543;
      if (y < 2020 || y > 2035) return null;
      if (m) return `${y}-${m}-${d}`;
    }

    // Format YYYY-MM-DD
    const match2 = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (match2) {
      let y = parseInt(match2[1], 10);
      if (y > 2500) y -= 543;
      if (y < 2020 || y > 2035) return null;
      const m = String(match2[2]).padStart(2, "0");
      const d = String(match2[3]).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    // Format DD/MM/YYYY or DD/MM/YY or DD-MM-YYYY or DD-MM-YY
    const match3 = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (match3) {
      let y = parseInt(match3[3], 10);
      if (y < 100) y += 2000;
      if (y > 2500) y -= 543;
      if (y < 2020 || y > 2035) return null;
      const d = String(match3[1]).padStart(2, "0");
      const m = String(match3[2]).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    return null;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    setParsedRecords([]);
    setSheetSummary([]);
    setLineMappingOverrides({});
    setActiveSheetFilter("ALL");
    setPreviewSearch("");

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary", cellDates: true });

        const allExtracted: ParsedRecord[] = [];
        const summaries: { name: string; count: number }[] = [];
        const initialMapping: Record<string, string> = {};

        const targetSheets = wb.SheetNames.filter((sheetName) => {
          const sLower = sheetName.trim().toLowerCase();
          const sUpperClean = sheetName.trim().toUpperCase().replace(/[-_]/g, " ");

          const isDailyOutputOk = sLower.includes("daily output") && sLower.includes("ok");
          const isAssyOutput = sUpperClean.includes("ASSY OUTPUT");
          const isMotOutput = sUpperClean.includes("MOT OUTPUT");

          return isDailyOutputOk || isAssyOutput || isMotOutput;
        });

        targetSheets.forEach((sheetName) => {
          const ws = wb.Sheets[sheetName];
          const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

          let lastSeenLineName = "";
          let extractedFromSheet = 0;

          for (let i = 0; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!row || row.length === 0) continue;

            // 1. Scan columns 0 to 4 for Line Name Headers
            for (let c = 0; c < Math.min(5, row.length); c++) {
              const cellText = String(row[c] || "").trim();
              if (!cellText || cellText.length < 2) continue;

              const directMatch = getImportTargetLines(sheetName, cellText);
              if (directMatch.length > 0) {
                lastSeenLineName = cellText;
                break;
              }

              const textLower = cellText.toLowerCase();

              const isLineKeyword =
                textLower.includes("assy") || textLower.includes("asy") ||
                textLower.includes("blk") || textLower.includes("lam") ||
                textLower.includes("mot") || textLower.includes("astp") ||
                textLower.includes("smt") || textLower.includes("stamp") ||
                textLower.includes("x-ray") || textLower.includes("xray") ||
                textLower.includes("x ray") || textLower.includes("mas") ||
                textLower.includes("rew") || textLower.includes("aelt") ||
                textLower.includes("feed") || textLower.includes("dqa") ||
                textLower.includes("oqi");

              const isNonLineKeyword =
                textLower.includes("daily master") || textLower.includes("daily actual") ||
                textLower.includes("master pln") || textLower.includes("actual plan") ||
                textLower.includes("working") || textLower.includes("holiday") ||
                textLower.includes("kpr") || textLower.includes("acc") ||
                textLower.includes("balance") || textLower.includes("target") ||
                textLower.includes("กรอก");

              if (isLineKeyword && !isNonLineKeyword) {
                lastSeenLineName = cellText;
                break;
              }
            }

            // 2. Check if this row is a target output/plan row
            const rowContentStr = row.slice(0, 5).map(v => String(v || "")).join(" ").toLowerCase();
            const isSheetDailyOk = sheetName.toLowerCase().includes("daily output") && sheetName.toLowerCase().includes("ok");
            let isTargetRow = false;

            if (isSheetDailyOk) {
              // In "Daily output JUL OK" sheet: target "daily actual plan" (excluding acc)
              isTargetRow =
                (rowContentStr.includes("daily actual plan") ||
                  rowContentStr.includes("daily actual pln") ||
                  rowContentStr.includes("daily plan")) &&
                !rowContentStr.includes("acc");
            } else {
              // In "ASSY OUTPUT" and "MOT-Output" sheets: target plan rows, plus REW Daily Actual Output
              isTargetRow =
                ((rowContentStr.includes("daily actual pln") ||
                  rowContentStr.includes("daily actual plan") ||
                  rowContentStr.includes("actual pln") ||
                  rowContentStr.includes("actual plan") ||
                  (rowContentStr.includes("daily master") && !rawRows.some(r => String(r?.slice(0, 5).join(" ") || "").toLowerCase().includes("daily actual")))) ||
                  (lastSeenLineName.toLowerCase().includes("rew") && (rowContentStr.includes("actual output") || rowContentStr.includes("actual output pln")))) &&
                !rowContentStr.includes("acc") &&
                !rowContentStr.includes("kpr") &&
                !rowContentStr.includes("balance") &&
                !rowContentStr.includes("working") &&
                !rowContentStr.includes("holiday");
            }

            if (isTargetRow) {
              // Helper to check if a row is a genuine Date Header Row with consistent YYYY-MM dates
              const getRowDateInfo = (r: any[]): { count: number; dominantYM: string } => {
                if (!r || !Array.isArray(r)) return { count: 0, dominantYM: "" };
                const parsedDates: string[] = [];
                for (const cell of r) {
                  const dStr = parseExcelDate(cell);
                  if (dStr) parsedDates.push(dStr);
                }
                if (parsedDates.length < 3) return { count: 0, dominantYM: "" };

                const ymCounts: Record<string, number> = {};
                parsedDates.forEach(d => {
                  const ym = d.substring(0, 7);
                  ymCounts[ym] = (ymCounts[ym] || 0) + 1;
                });

                let dominantYM = "";
                let maxYMCount = 0;
                for (const [ym, count] of Object.entries(ymCounts)) {
                  if (count > maxYMCount) {
                    maxYMCount = count;
                    dominantYM = ym;
                  }
                }

                if (maxYMCount >= 5) {
                  return { count: maxYMCount, dominantYM };
                }
                return { count: 0, dominantYM: "" };
              };

              // Find the date header row above row i that contains the MAXIMUM count of valid dates
              let dateHeaderRowIndex = -1;
              let maxValidDates = 0;
              let dominantYM = "";

              for (let k = i - 1; k >= 0; k--) {
                const info = getRowDateInfo(rawRows[k]);
                if (info.count > maxValidDates) {
                  maxValidDates = info.count;
                  dateHeaderRowIndex = k;
                  dominantYM = info.dominantYM;
                }
              }

              // Fallback: search full sheet from row 0 if no candidate was found above
              if (dateHeaderRowIndex === -1) {
                for (let k = 0; k < rawRows.length; k++) {
                  const info = getRowDateInfo(rawRows[k]);
                  if (info.count > maxValidDates) {
                    maxValidDates = info.count;
                    dateHeaderRowIndex = k;
                    dominantYM = info.dominantYM;
                  }
                }
              }

              if (dateHeaderRowIndex !== -1) {
                const dateRow = rawRows[dateHeaderRowIndex];
                const origLine = lastSeenLineName || sheetName;
                const targetLines = getImportTargetLines(sheetName, origLine);
                if (targetLines.length === 0) continue;

                const outputRow = rawRows.slice(i + 1, i + 5).find(candidate => {
                  const candidateStr = String(candidate?.slice(0, 5).join(" ") || "").toLowerCase();
                  return (
                    candidateStr.includes("actual output") ||
                    candidateStr.includes("daily actual output") ||
                    candidateStr.includes("actual output pln") ||
                    (candidateStr.includes("output") && !candidateStr.includes("input"))
                  ) && !candidateStr.includes("master pln") && !candidateStr.includes("plan");
                });

                for (let colIdx = 1; colIdx < dateRow.length; colIdx++) {
                  const dateStr = parseExcelDate(dateRow[colIdx]);
                  if (!dateStr) continue;

                  // Reject summary/total numbers at row ends that parse to a different YYYY-MM
                  if (dominantYM && !dateStr.startsWith(dominantYM)) {
                    continue;
                  }

                  const rawVal = row[colIdx];
                  const cleanStr = String(rawVal ?? "").trim().replace(/,/g, "");
                  let numVal = parseFloat(cleanStr);
                  if (isNaN(numVal) || numVal < 0) {
                    numVal = 0;
                  }

                  const rawOutputVal = outputRow ? outputRow[colIdx] : undefined;
                  const cleanOutputStr = rawOutputVal !== undefined ? String(rawOutputVal ?? "").trim().replace(/,/g, "") : "";
                  let outputVal: number | undefined = parseFloat(cleanOutputStr);
                  if (isNaN(outputVal) || outputVal < 0) {
                    outputVal = undefined;
                  }

                  const finalVal = Math.round(numVal);
                  targetLines.forEach(targetLine => {
                    allExtracted.push({
                      line: targetLine,
                      originalLine: origLine,
                      sheetName,
                      date: dateStr,
                      daily_plan: finalVal,
                      ...(outputVal !== undefined ? { daily_output: Math.round(outputVal) } : {}),
                    });
                    extractedFromSheet++;
                  });
                }
              }
            }
          }

          if (extractedFromSheet > 0) {
            summaries.push({ name: sheetName, count: extractedFromSheet });
          }
        });

        setParsedRecords(allExtracted);
        setSheetSummary(summaries);
        setLineMappingOverrides(initialMapping);

        if (allExtracted.length === 0) {
          Swal.fire({
            icon: "warning",
            title: "ไม่พบข้อมูล Daily Actual Output",
            text: "ไม่พบบรรทัด 'Daily Actual Output' หรือรูปแบบวันที่ที่ถูกต้อง (ปี 2020-2035) ในไฟล์ Excel",
          });
        }
      } catch (err: any) {
        console.error("Excel parse error:", err);
        Swal.fire({
          icon: "error",
          title: "เกิดข้อผิดพลาดในการอ่านไฟล์",
          text: err.message || "ไม่สามารถอ่านไฟล์ Excel ได้",
        });
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  // Get unique original line names extracted
  const uniqueOriginalLines = useMemo(() => {
    const lines = new Set<string>();
    parsedRecords.forEach(r => lines.add(r.originalLine));
    return Array.from(lines);
  }, [parsedRecords]);

  const filteredPreviewRecords = useMemo(() => {
    return parsedRecords.map(r => ({
      ...r,
      line: lineMappingOverrides[r.originalLine] || r.line
    })).filter((r) => {
      const matchSheet = activeSheetFilter === "ALL" || r.sheetName === activeSheetFilter;
      const q = previewSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        r.line.toLowerCase().includes(q) ||
        r.originalLine.toLowerCase().includes(q) ||
        r.date.includes(q);
      return matchSheet && matchSearch;
    });
  }, [parsedRecords, activeSheetFilter, previewSearch, lineMappingOverrides]);

  const handleSaveToDatabase = async () => {
    if (parsedRecords.length === 0) return;

    setIsSaving(true);
    try {
      const payload = parsedRecords
        .map(r => ({
          line: lineMappingOverrides[r.originalLine] || r.line,
          date: r.date,
          daily_plan: r.daily_plan,
          daily_output: r.daily_output
        }))
        .filter(r => r.line && r.line !== "IGNORE");

      if (payload.length === 0) {
        Swal.fire({
          icon: "info",
          title: "ไม่มีข้อมูลที่จะบันทึก",
          text: "เนื่องจากทุก Line ถูกตั้งค่าเป็น 'ไม่นำเข้าข้อมูล (IGNORE)'",
        });
        setIsSaving(false);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/productivity/upload-smt-daily-actual-output`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: payload,
          fileName: fileName || "imported_file.xlsx",
          sheetCount: sheetSummary.length,
          details: `นำเข้าสำเร็จ ${payload.length} รายการ จาก ${sheetSummary.length} ชีท`
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.details || errData.error || "Failed to save records");
      }

      const resData = await res.json();

      await Swal.fire({
        icon: "success",
        title: "นำเข้าข้อมูลสำเร็จ!",
        text: `บันทึกข้อมูล Daily Actual Output เรียบร้อยแล้วจำนวน ${resData.count || payload.length} รายการ`,
        confirmButtonColor: "#10B981"
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Save to DB error:", err);
      Swal.fire({
        icon: "error",
        title: "บันทึกข้อมูลไม่สำเร็จ",
        text: err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูลลงฐานข้อมูล",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[85vh] max-h-[900px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">ระบบนำเข้าข้อมูล Daily Actual Output</h3>
            <p className="text-xs text-slate-500">ระบบบันทึกข้อมูล Daily Actual Output</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 px-6 gap-2 pt-2.5">
          <button
            type="button"
            onClick={() => setModalTab("IMPORT")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-t border-x ${modalTab === "IMPORT"
              ? "bg-white text-emerald-700 border-slate-200 shadow-sm"
              : "text-slate-500 hover:text-slate-700 border-transparent hover:bg-slate-200/50"
              }`}
          >
            <Upload className="h-4 w-4" />
            นำเข้าไฟล์ Excel (Import)
          </button>
          <button
            type="button"
            onClick={() => setModalTab("MANUAL")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-t border-x ${modalTab === "MANUAL"
              ? "bg-white text-blue-700 border-slate-200 shadow-sm"
              : "text-slate-500 hover:text-slate-700 border-transparent hover:bg-slate-200/50"
              }`}
          >
            <Edit3 className="h-4 w-4" />
            กรอก/แก้ไข Daily Plan (Manual)
          </button>
          <button
            type="button"
            onClick={() => setModalTab("HISTORY")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-t border-x ${modalTab === "HISTORY"
              ? "bg-white text-purple-700 border-slate-200 shadow-sm"
              : "text-slate-500 hover:text-slate-700 border-transparent hover:bg-slate-200/50"
              }`}
          >
            <History className="h-4 w-4" />
            ประวัติการนำเข้า (Import History)
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {modalTab === "MANUAL" ? (
            <div className="space-y-5 max-w-4xl mx-auto">
              {/* Quick switch to full Matrix Editor */}
              {onOpenManualMatrixModal && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-blue-950">
                        ต้องการจัดการข้อมูล Target ทุกไลน์พร้อมกันในตารางกริดหรือไม่?
                      </h5>
                      <p className="text-[11px] text-blue-700">
                        ใช้งานระบบ Target Adjustment เพื่อกำหนด Target หรือ Plan พร้อมเครื่องมือ Monthly Quick Fill
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenManualMatrixModal();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ml-auto"
                  >
                    เปิด Target Adjustment
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {/* Header Controls */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Select Line with Search & Quick Add */}
                  <div className="relative min-w-[240px]" ref={dropdownRef}>
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <label className="block text-[11px] font-bold text-slate-500">เลือกลายการผลิต (Target Line)</label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingNewLine(!isAddingNewLine);
                          setIsDropdownOpen(false);
                        }}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                        {isAddingNewLine ? "เลือกจากรายการ" : "พิมพ์ชื่อไลน์ใหม่"}
                      </button>
                    </div>

                    {isAddingNewLine ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newLineInput}
                          onChange={(e) => setNewLineInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddNewLine();
                          }}
                          placeholder="พิมพ์ชื่อไลน์ใหม่..."
                          className="input input-sm input-bordered font-bold text-blue-800 bg-white w-full"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleAddNewLine}
                          className="btn btn-sm btn-primary text-xs font-bold shrink-0"
                        >
                          เพิ่ม
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingNewLine(false);
                            setNewLineInput("");
                          }}
                          className="btn btn-sm btn-ghost text-xs text-slate-500 shrink-0"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen((prev) => !prev);
                            setLineSearchTerm("");
                          }}
                          className="flex items-center justify-between w-full min-w-[240px] h-9 px-2.5 bg-white border border-slate-300 rounded-lg font-bold text-xs text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-500">
                              <Route className="h-3.5 w-3.5" />
                            </span>
                            <span className="truncate font-bold text-slate-800">
                              {manualLine ? getLineGroupDisplayName(manualLine) : "เลือกลายการผลิต..."}
                            </span>
                            {(() => {
                              const activeItem = formattedLineGroups.find(i => i.name === manualLine || i.displayName === manualLine);
                              const fac = activeItem?.factory || "SMT";
                              const badgeStyle = fac === "MACRO"
                                ? "bg-purple-100 text-purple-700 border-purple-200"
                                : fac === "FPC"
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : "bg-blue-100 text-blue-700 border-blue-200";
                              return (
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase shrink-0 ${badgeStyle}`}>
                                  {fac}
                                </span>
                              );
                            })()}
                          </div>
                          <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 ml-1 transition-transform duration-200 ${isDropdownOpen ? "rotate-180 text-blue-600" : ""}`} />
                        </button>

                        {isDropdownOpen && (
                          <div className="absolute top-full left-0 mt-1 w-full min-w-[320px] max-h-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                            {/* Sector Filter Tabs (Matching Main Page) */}
                            <div className="p-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1">
                              {(["ALL", "SMT", "FPC", "MACRO"] as const).map((sector) => (
                                <button
                                  key={sector}
                                  type="button"
                                  onClick={() => setManualSectorFilter(sector)}
                                  className={`flex-1 py-1 text-[10px] font-black rounded-md transition-all ${
                                    manualSectorFilter === sector
                                      ? sector === "MACRO"
                                        ? "bg-purple-600 text-white shadow-xs"
                                        : sector === "FPC"
                                        ? "bg-emerald-600 text-white shadow-xs"
                                        : "bg-blue-600 text-white shadow-xs"
                                      : "bg-white text-slate-600 hover:bg-slate-200 border border-slate-200"
                                  }`}
                                >
                                  {sector === "ALL" ? "All Types" : sector}
                                </button>
                              ))}
                            </div>

                            {/* Search Box Header */}
                            <div className="p-2 border-b border-slate-100 bg-white sticky top-0 z-10">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <input
                                  type="text"
                                  value={lineSearchTerm}
                                  onChange={(e) => setLineSearchTerm(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && filteredLineOptions.length === 1) {
                                      setManualLine(filteredLineOptions[0].name);
                                      setIsDropdownOpen(false);
                                    } else if (e.key === "Enter" && filteredLineOptions.length === 0 && lineSearchTerm.trim()) {
                                      handleQuickAddTyped(lineSearchTerm.trim());
                                    }
                                  }}
                                  placeholder="ค้นหาชื่อไลน์..."
                                  className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner"
                                  autoFocus
                                />
                                {lineSearchTerm && (
                                  <button
                                    type="button"
                                    onClick={() => setLineSearchTerm("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* List of items */}
                            <div className="flex-1 overflow-y-auto p-1.5 max-h-56 space-y-0.5">
                              {filteredLineOptions.map((item) => {
                                const isSelected = item.name === manualLine || item.displayName === manualLine;
                                const badgeStyle = item.factory === "MACRO"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : item.factory === "FPC"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200";

                                return (
                                  <button
                                    key={item.id || item.name}
                                    type="button"
                                    onClick={() => {
                                      setManualLine(item.name);
                                      setIsDropdownOpen(false);
                                    }}
                                    className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-left cursor-pointer ${
                                      isSelected
                                        ? "bg-blue-50 text-blue-800 ring-1 ring-blue-500/30"
                                        : "text-slate-700 hover:bg-slate-100"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span
                                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors ${
                                          isSelected ? "bg-blue-600 text-white" : "border border-slate-300"
                                        }`}
                                      >
                                        {isSelected && <Check className="h-2.5 w-2.5" />}
                                      </span>
                                      <span className="truncate font-bold">
                                        {item.displayName}
                                      </span>
                                      {item.displayName !== item.name && (
                                        <span className="text-[10px] text-slate-400 font-normal truncate">
                                          ({item.name})
                                        </span>
                                      )}
                                    </div>
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase shrink-0 ${badgeStyle}`}>
                                      {item.factory}
                                    </span>
                                  </button>
                                );
                              })}

                              {filteredLineOptions.length === 0 && (
                                <div className="p-4 text-center text-xs text-slate-400">
                                  ไม่พบไลน์ที่ตรงกับ "{lineSearchTerm}"
                                </div>
                              )}
                            </div>

                            {/* Quick add prompt if searching and not in list */}
                            {lineSearchTerm.trim() && !formattedLineGroups.some(l => l.name.toLowerCase() === lineSearchTerm.trim().toLowerCase() || l.displayName.toLowerCase() === lineSearchTerm.trim().toLowerCase()) && (
                              <div className="p-2 border-t border-slate-100 bg-blue-50/70">
                                <button
                                  type="button"
                                  onClick={() => handleQuickAddTyped(lineSearchTerm.trim())}
                                  className="flex items-center justify-center gap-1.5 w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  เพิ่มเป็นไลน์ใหม่: "{lineSearchTerm.trim()}"
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Select Month */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">เดือน</label>
                    <select
                      value={manualMonth}
                      onChange={(e) => setManualMonth(Number(e.target.value))}
                      className="select select-sm select-bordered font-semibold text-slate-700 bg-white"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          {new Date(2026, m - 1, 1).toLocaleString("th-TH", { month: "long" })} ({String(m).padStart(2, "0")})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Year */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">ปี (ค.ศ.)</label>
                    <select
                      value={manualYear}
                      onChange={(e) => setManualYear(Number(e.target.value))}
                      className="select select-sm select-bordered font-semibold text-slate-700 bg-white"
                    >
                      {[2024, 2025, 2026, 2027].map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadManualData}
                    disabled={isLoadingManual}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoadingManual ? "animate-spin text-blue-600" : ""}`} />
                    โหลดข้อมูล
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveManualData}
                    disabled={isSavingManual || isLoadingManual}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
                  >
                    {isSavingManual ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    บันทึกข้อมูลเดือนนี้
                  </button>
                </div>
              </div>

              {/* Table of Days */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="max-h-[58vh] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 font-bold text-slate-700 shadow-sm z-10">
                      <tr>
                        <th className="px-4 py-3 w-16 text-center">#</th>
                        <th className="px-4 py-3 w-48">วันที่ (Date)</th>
                        <th className="px-4 py-3 w-48">วันในสัปดาห์</th>
                        <th className="px-4 py-3">Daily Plan (เป้าหมาย)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {manualRows.map((row, idx) => {
                        const dateObj = new Date(row.date);
                        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                        const dayName = dateObj.toLocaleDateString("th-TH", { weekday: "short" });

                        return (
                          <tr key={row.date} className={`hover:bg-blue-50/50 transition-colors ${isWeekend ? "bg-amber-50/40" : ""}`}>
                            <td className="px-4 py-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="px-4 py-2.5 font-bold font-mono text-slate-800">{row.date}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${isWeekend ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                                {dayName} {dateObj.getDay() === 0 ? "(หยุด)" : isWeekend ? "(เสาร์)" : ""}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <input
                                type="text"
                                value={row.plan}
                                onChange={(e) => {
                                  const rawVal = e.target.value;
                                  setManualRows((prev) => prev.map((r, i) => (i === idx ? { ...r, plan: rawVal } : r)));
                                }}
                                onBlur={(e) => {
                                  const formatted = formatNumberDisplay(e.target.value);
                                  setManualRows((prev) => prev.map((r, i) => (i === idx ? { ...r, plan: formatted } : r)));
                                }}
                                placeholder="0"
                                className="input input-sm input-bordered w-full font-bold text-purple-700 max-w-sm"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : modalTab === "HISTORY" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <History className="h-4 w-4 text-emerald-600" />
                    ประวัติการนำเข้าไฟล์ Excel (50 รายการล่าสุด)
                  </h4>
                  <p className="text-xs text-slate-500">ตรวจสอบวันเวลา ชื่อไฟล์ ผู้ทำรายการ และจำนวนรายการที่เคยอัปโหลดลงระบบ</p>
                </div>
                <button
                  type="button"
                  onClick={fetchHistory}
                  disabled={isLoadingHistory}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingHistory ? "animate-spin text-emerald-600" : ""}`} />
                  รีเฟรชประวัติ
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="max-h-[58vh] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 font-bold text-slate-600 shadow-sm z-10">
                      <tr>
                        <th className="px-4 py-3 whitespace-nowrap">#</th>
                        <th className="px-4 py-3 whitespace-nowrap">วัน-เวลาที่นำเข้า</th>
                        <th className="px-4 py-3 whitespace-nowrap">ชื่อไฟล์</th>
                        <th className="px-4 py-3 text-center whitespace-nowrap">จำนวนรายการ</th>
                        <th className="px-4 py-3 whitespace-nowrap">ผู้ทำรายการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyList.map((item, index) => (
                        <tr key={item.id || index} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">{index + 1}</td>
                          <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                              <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                              {new Date(item.imported_at).toLocaleString("th-TH", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit"
                              })}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <FileSpreadsheet className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                              <span className="truncate max-w-md xl:max-w-xl" title={item.file_name}>{item.file_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-bold whitespace-nowrap">
                            <span className="inline-block whitespace-nowrap bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs">
                              {Number(item.record_count).toLocaleString()} รายการ
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">
                            <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-semibold text-xs whitespace-nowrap">
                              {item.imported_by || "Admin"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {historyList.length === 0 && !isLoadingHistory && (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center gap-2">
                              <History className="h-8 w-8 text-slate-300" />
                              <p className="font-semibold text-slate-500">ยังไม่มีประวัติการนำเข้าไฟล์ Excel</p>
                              <p className="text-xs text-slate-400">เมื่อท่านทำการอัปโหลดไฟล์สำเร็จ ข้อมูลประวัติจะแสดงที่นี่</p>
                            </div>
                          </td>
                        </tr>
                      )}
                      {isLoadingHistory && (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                            <div className="flex items-center justify-center gap-2 font-medium">
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                              กำลังโหลดประวัติการนำเข้า...
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Direct Auto Sync Cards: SMT & FPC */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* SMT Sync Card */}
                <div className="flex flex-col justify-between p-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-950">
                        ดึงข้อมูล Plan SMT (Auto Sync)
                      </h4>
                      <p className="text-[11px] text-emerald-700 font-mono mt-0.5">
                        10.17.88.65 (SMT Daily Output)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleFolderAutoSync}
                    disabled={isSyncingFolder || isSyncingFpcFolder || isProcessing || isSaving}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`h-4 w-4 ${isSyncingFolder ? "animate-spin" : ""}`} />
                    {isSyncingFolder ? "กำลังดึงข้อมูล SMT..." : "Sync ข้อมูล Plan SMT"}
                  </button>
                </div>

                {/* FPC Sync Card */}
                <div className="flex flex-col justify-between p-4 rounded-2xl border border-blue-200 bg-blue-50/70 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-blue-950">
                        ดึงข้อมูล Plan EFPC (Auto Sync)
                      </h4>
                      <p className="text-[11px] text-blue-700 font-mono mt-0.5">
                        Plan EFPC (Output E-FPC report)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleFpcFolderAutoSync}
                    disabled={isSyncingFolder || isSyncingFpcFolder || isProcessing || isSaving}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`h-4 w-4 ${isSyncingFpcFolder ? "animate-spin" : ""}`} />
                    {isSyncingFpcFolder ? "กำลังดึงข้อมูล FPC..." : "Sync ข้อมูล Plan EFPC"}
                  </button>
                </div>
              </div>

              {/* File Picker */}
              <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-5 text-center hover:border-emerald-500 transition-colors bg-slate-50/50">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={isProcessing || isSaving}
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    {fileName ? fileName : "คลิกหรือลากไฟล์ Excel (.xlsx) มาวางที่นี่"}
                  </p>
                  <p className="text-xs text-slate-400">ระบบจะอ่านทุกชีทและค้นหาบรรทัด 'Daily Actual Output' ให้อัตโนมัติ</p>
                </div>
              </div>

              {/* Loading status */}
              {isProcessing && (
                <div className="flex items-center justify-center gap-3 py-6 text-emerald-600 font-medium">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                  กำลังอ่านและสแกนข้อมูลจากทุกชีทในไฟล์...
                </div>
              )}

              {/* Summary & Controls */}
              {parsedRecords.length > 0 && !isProcessing && (
                <div className="space-y-6">
                  {/* Stat Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <Layers className="h-4 w-4 text-emerald-600" />
                        จำนวนชีทที่พบข้อมูล
                      </div>
                      <div className="mt-2 text-2xl font-black text-slate-800">{sheetSummary.length} ชีท</div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <Table className="h-4 w-4 text-blue-600" />
                        รายการวันที่ถูกสกัดได้
                      </div>
                      <div className="mt-2 text-2xl font-black text-slate-800">{parsedRecords.length} รายการ</div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        สถานะการตรวจสอบ
                      </div>
                      <div className="mt-2 text-sm font-bold text-emerald-600">พร้อมบันทึกลง DB</div>
                    </div>
                  </div>

                  {/* Sheet Filter Badges */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Filter className="h-3.5 w-3.5 text-emerald-600" />
                        คลิกเลือกชีทเพื่อตรวจสอบพรีวิวข้อมูลเฉพาะชีทนั้นๆ:
                      </span>
                      {activeSheetFilter !== "ALL" && (
                        <button
                          onClick={() => setActiveSheetFilter("ALL")}
                          className="text-emerald-600 hover:underline text-[11px]"
                        >
                          ดูทุกชีท ({parsedRecords.length})
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveSheetFilter("ALL")}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition-all shadow-sm ${activeSheetFilter === "ALL"
                          ? "border-emerald-600 bg-emerald-600 text-white shadow-emerald-600/20"
                          : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                      >
                        <span>ทุกชีท (ALL)</span>
                        <span className="rounded-full bg-black/15 px-2 py-0.5 text-[10px]">{parsedRecords.length}</span>
                      </button>
                      {sheetSummary.map((s) => {
                        const isSelected = activeSheetFilter === s.name;
                        return (
                          <button
                            key={s.name}
                            type="button"
                            onClick={() => setActiveSheetFilter(s.name)}
                            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition-all shadow-sm ${isSelected
                              ? "border-emerald-600 bg-emerald-600 text-white shadow-emerald-600/20"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                          >
                            <span>{s.name}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] ${isSelected ? "bg-white/20 text-white" : "bg-emerald-200/80 text-emerald-900"}`}>
                              {s.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Preview Table Container */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div className="flex items-center gap-2">
                        <span>ตารางตัวอย่างข้อมูลที่จะบันทึก</span>
                        <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[11px]">
                          {activeSheetFilter === "ALL" ? "ทุกชีท" : `ชีท: ${activeSheetFilter}`} ({filteredPreviewRecords.length} รายการ)
                        </span>
                      </div>

                      {/* Table search filter */}
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={previewSearch}
                          onChange={(e) => setPreviewSearch(e.target.value)}
                          placeholder="ค้นหา Line หรือวันที่..."
                          className="w-full pl-8 pr-3 py-1 bg-white rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="max-h-72 overflow-y-auto text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 font-bold text-slate-600 shadow-sm z-10">
                          <tr>
                            <th className="px-4 py-2.5">Line Target (DB)</th>
                            <th className="px-4 py-2.5">Line Name (Excel)</th>
                            <th className="px-4 py-2.5">Sheet</th>
                            <th className="px-4 py-2.5">Date (YYYY-MM-DD)</th>
                            <th className="px-4 py-2.5 text-right">Daily Actual Output</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredPreviewRecords.slice(0, 100).map((r, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-2 font-bold text-blue-700">{r.line}</td>
                              <td className="px-4 py-2 text-slate-500">{r.originalLine}</td>
                              <td className="px-4 py-2 text-slate-600 font-semibold">{r.sheetName}</td>
                              <td className="px-4 py-2 font-mono text-slate-800 font-medium">{r.date}</td>
                              <td className="px-4 py-2 text-right font-black text-emerald-600">{r.daily_plan.toLocaleString()}</td>
                            </tr>
                          ))}
                          {filteredPreviewRecords.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                                ไม่พบรายการข้อมูลในเงื่อนไขการค้นหานี้
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {filteredPreviewRecords.length > 100 && (
                      <div className="bg-slate-50 px-4 py-2 text-center text-[11px] text-slate-500 border-t border-slate-100">
                        แสดงตัวอย่าง 100 รายการแรกจากทั้งหมด {filteredPreviewRecords.length} รายการของเงื่อนไขนี้
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {modalTab === "HISTORY" ? (
          <div className="flex items-center justify-end border-t border-slate-100 bg-slate-50 px-6 py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-sm text-slate-600 cursor-pointer"
              disabled={isSaving}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSaveToDatabase}
              disabled={parsedRecords.length === 0 || isSaving}
              className="btn btn-primary min-h-10 h-10 px-6 rounded-xl shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 border-none text-white font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  กำลังบันทึกลง Database...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  ยืนยันบันทึก {parsedRecords.length} รายการลง Database
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
