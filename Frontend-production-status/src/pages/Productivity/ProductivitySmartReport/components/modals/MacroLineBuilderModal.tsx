import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  X, Layers, Plus, Trash2, CheckCircle2, AlertCircle, Save, ChevronRight,
  Search, Check, RefreshCcw, Table2, Layers2, Sparkles, Filter
} from "lucide-react";
import axios from "axios";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import { getApiBaseUrl, saveDynamicLine, deleteDynamicLine, fetchDynamicLines, DynamicLineDefinition } from "../../../../../utils/apiConfig";
import { normalizeMatrixLineGroupName } from "../../hooks/useProcessOutputData";
import { getSubLineAttendancePrefix, getDynamicAttendanceValue } from "../../utils/attendanceMapper";
import { fetchCustomMacroLines } from "../../utils/customMacroStore";

export type CustomMacroLine = {
  id?: number;
  macro_name: string;
  sub_lines: string[];
  output_source_line?: string | null;
  position_before?: string | null;
  show_ot_rows: boolean;
  show_leave_rows: boolean;
  is_active?: boolean;
};

const FACTORY_OPTIONS = [
  { key: "SMT", label: "SMT" },
  { key: "FPC", label: "FPC" },
  { key: "QA", label: "QA" },
];

export interface StandardTableDef {
  label: string;
  factory: string;
  outputSources: string[];
  manpowerSources: string[];
}

export const STANDARD_TABLE_DEFINITIONS: Record<string, StandardTableDef> = {
  // SMT MOT
  "MOTA_A": { label: "MOTA_A", factory: "SMT", outputSources: ["MOTA_A"], manpowerSources: ["MOTA_A"] },
  "MOTA_G": { label: "MOTA_G", factory: "SMT", outputSources: ["MOTA_G"], manpowerSources: ["MOTA_G"] },
  "MOTB": { label: "MOTB", factory: "SMT", outputSources: ["MOTB"], manpowerSources: ["MOTB"] },
  "MOTB_G": { label: "MOTB_G", factory: "SMT", outputSources: ["MOTB_G"], manpowerSources: ["MOTB_G"] },
  "AIX-MOT": { label: "AIX-MOT", factory: "SMT", outputSources: ["AIX-MOT"], manpowerSources: ["AIX-MOT"] },
  "MOTD": { label: "MOTD", factory: "SMT", outputSources: ["MOTD"], manpowerSources: ["MOTD"] },
  "ASTP_A": { label: "ASTP_A", factory: "SMT", outputSources: ["ASTP_A"], manpowerSources: ["ASTP_A"] },
  "ASTP_G": { label: "ASTP_G", factory: "SMT", outputSources: ["ASTP_G"], manpowerSources: ["ASTP_G"] },
  "MAS": { label: "MAS", factory: "SMT", outputSources: ["MAS"], manpowerSources: ["MAS"] },
  "REW": { label: "REW", factory: "SMT", outputSources: ["REW"], manpowerSources: ["REW"] },
  "XRAY": { label: "XRAY", factory: "SMT", outputSources: ["XRAY"], manpowerSources: ["XRAY"] },
  "LINE S_TECH_F": { label: "LINE S_TECH_F", factory: "SMT", outputSources: ["LINE S_TECH_F"], manpowerSources: ["LINE S_TECH_F"] },
  "LINE S_TSTE_F": { label: "LINE S_TSTE_F", factory: "SMT", outputSources: ["LINE S_TSTE_F"], manpowerSources: ["LINE S_TSTE_F"] },
  "MAS & REW": { label: "MAS & REW", factory: "SMT", outputSources: ["MAS & REW"], manpowerSources: ["MAS & REW"] },

  // SMT ASSY
  "AIX-BLK": { label: "AIX-BLK", factory: "SMT", outputSources: ["AIX-BLK"], manpowerSources: ["AIX-BLK"] },
  "BLK-2": { label: "BLK-2", factory: "SMT", outputSources: ["BLK-2"], manpowerSources: ["BLK-2"] },
  "ASY1_A": { label: "ASY1_A", factory: "SMT", outputSources: ["ASY1_A"], manpowerSources: ["ASY1_A"] },
  "ASY1_G": { label: "ASY1_G", factory: "SMT", outputSources: ["ASY1_G"], manpowerSources: ["ASY1_G"] },
  "ASY2": { label: "ASY2", factory: "SMT", outputSources: ["ASY2"], manpowerSources: ["ASY2"] },
  "ASY3": { label: "ASY3", factory: "SMT", outputSources: ["ASY3"], manpowerSources: ["ASY3"] },
  "AIX-ASY": { label: "AIX-ASY", factory: "SMT", outputSources: ["AIX-ASY"], manpowerSources: ["AIX-ASY"] },
  "ASY5": { label: "ASY5", factory: "SMT", outputSources: ["ASY5"], manpowerSources: ["ASY5"] },
  "ASY6": { label: "ASY6", factory: "SMT", outputSources: ["ASY6"], manpowerSources: ["ASY6"] },
  "ASY7": { label: "ASY7", factory: "SMT", outputSources: ["ASY7"], manpowerSources: ["ASY7"] },
  "AELT": { label: "AELT", factory: "SMT", outputSources: ["AELT"], manpowerSources: ["AELT"] },
  "SMT_LAM": { label: "SMT_LAM", factory: "SMT", outputSources: ["SMT_LAM"], manpowerSources: ["SMT_LAM"] },
  "MD LAM": { label: "MD LAM", factory: "SMT", outputSources: ["MD LAM"], manpowerSources: ["MD LAM"] },
  "ASY SMT": { label: "ASY SMT", factory: "SMT", outputSources: ["ASY SMT"], manpowerSources: ["ASY SMT"] },

  // FPC Lines
  "LINE A": { label: "LINE A", factory: "FPC", outputSources: ["LINE A"], manpowerSources: ["LINE A"] },
  "AT_Front": { label: "AT_Front", factory: "FPC", outputSources: ["AT_Front"], manpowerSources: ["AT_Front"] },
  "AT_VAC": { label: "AT_VAC", factory: "FPC", outputSources: ["AT_VAC"], manpowerSources: ["AT_VAC"] },
  "AT_LAM": { label: "AT_LAM", factory: "FPC", outputSources: ["AT_LAM"], manpowerSources: ["AT_LAM"] },
  "LINE A_FINAL": { label: "LINE A_FINAL", factory: "FPC", outputSources: ["LINE A_FINAL"], manpowerSources: ["LINE A_FINAL"] },
  "LINE B": { label: "LINE B", factory: "FPC", outputSources: ["LINE B"], manpowerSources: ["LINE B"] },
  "LINE B_GEN": { label: "LINE B_GEN", factory: "FPC", outputSources: ["LINE B_GEN"], manpowerSources: ["LINE B_GEN"] },
  "LINE B_NON": { label: "LINE B_NON", factory: "FPC", outputSources: ["LINE B_NON"], manpowerSources: ["LINE B_NON"] },
  "LINE C": { label: "LINE C", factory: "FPC", outputSources: ["LINE C"], manpowerSources: ["LINE C"] },
  "LINE D": { label: "LINE D", factory: "FPC", outputSources: ["LINE D"], manpowerSources: ["LINE D"] },
  "LINE MAT": { label: "LINE MAT", factory: "FPC", outputSources: ["LINE MAT"], manpowerSources: ["LINE MAT"] },
  "LINE LAM": { label: "LINE LAM", factory: "FPC", outputSources: ["LINE LAM"], manpowerSources: ["LINE LAM"] },
  "LINE VAC": { label: "LINE VAC", factory: "FPC", outputSources: ["LINE VAC"], manpowerSources: ["LINE VAC"] },
  "LINE HPS": { label: "LINE HPS", factory: "FPC", outputSources: ["LINE HPS"], manpowerSources: ["LINE HPS"] },
  "LINE VAC & HPS": { label: "LINE VAC & HPS", factory: "FPC", outputSources: ["LINE VAC & HPS"], manpowerSources: ["LINE VAC & HPS"] },
  "LINE BLK": { label: "LINE BLK", factory: "FPC", outputSources: ["LINE BLK"], manpowerSources: ["LINE BLK"] },
  "LINE OST": { label: "LINE OST", factory: "FPC", outputSources: ["LINE OST"], manpowerSources: ["LINE OST"] },
  "NPM_FPC": { label: "NPM_FPC", factory: "FPC", outputSources: ["NPM_FPC"], manpowerSources: ["NPM_FPC"] },
  "AVI/K2": { label: "AVI/K2", factory: "FPC", outputSources: ["AVI/K2"], manpowerSources: ["AVI/K2"] },
  "MDS": { label: "LINE MDS (MDS)", factory: "FPC", outputSources: ["MDS"], manpowerSources: ["MDS"] },

  // QA Lines
  "QA FPC": { label: "QA FPC", factory: "QA", outputSources: ["QA FPC"], manpowerSources: ["QA FPC"] },
  "OQI_F-AUTO": { label: "OQI_F-AUTO", factory: "QA", outputSources: ["OQI_F-AUTO"], manpowerSources: ["OQI_F-AUTO"] },
  "OQI_F-GEN": { label: "OQI_F-GEN", factory: "QA", outputSources: ["OQI_F-GEN"], manpowerSources: ["OQI_F-GEN"] },
  "OQI_M": { label: "OQI_M", factory: "QA", outputSources: ["OQI_M"], manpowerSources: ["OQI_M"] },
  "QA SMT": { label: "QA SMT", factory: "QA", outputSources: ["QA SMT"], manpowerSources: ["QA SMT"] },
  "OQI_S-AUTO": { label: "OQI_S-AUTO", factory: "QA", outputSources: ["OQI_S-AUTO"], manpowerSources: ["OQI_S-AUTO"] },
  "OQI_S-GEN": { label: "OQI_S-GEN", factory: "QA", outputSources: ["OQI_S-GEN"], manpowerSources: ["OQI_S-GEN"] },
};

const AVAILABLE_SUB_LINES = Object.keys(STANDARD_TABLE_DEFINITIONS);

export interface ManpowerItemOption {
  code: string;
  displayName: string;
  type: "COST_CENTER" | "SUB_LINE";
  rawSearch: string;
}

export interface AvailableChildLineOption {
  id: string;
  name: string;
  sourceType: "DATABASE" | "STANDARD";
  outputSources: string[];
  manpowerSources: string[];
  factory?: string;
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  dateColumns?: string[];
  aggregatedAttendanceData?: Record<string, any>;
  matrixData?: [string, Map<string, number>][];
  rawRows?: any[];
  startDate?: string;
  endDate?: string;
};

export const MacroLineBuilderModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  dateColumns = [],
  aggregatedAttendanceData = {},
  matrixData = [],
  rawRows = [],
}) => {
  const [macroList, setMacroList] = useState<DynamicLineDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Line Type Mode: SINGLE (สร้างไลน์เดี่ยว) vs MACRO (รวมกลุ่มไลน์)
  const [lineType, setLineType] = useState<"SINGLE" | "MACRO">("SINGLE");

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [macroName, setMacroName] = useState("");
  const [selectedFactory, setSelectedFactory] = useState<string>("SMT");
  const [selectedSubLines, setSelectedSubLines] = useState<string[]>([]);
  const [outputSourceLines, setOutputSourceLines] = useState<string[]>([]);
  const [showPlanRow, setShowPlanRow] = useState(true);
  const [showTargetRow, setShowTargetRow] = useState(true);
  const [showOtRows, setShowOtRows] = useState(true);
  const [showLeaveRows, setShowLeaveRows] = useState(true);
  const [selectedUnits, setSelectedUnits] = useState<string[]>(["piece"]);

  // Macro Mode: Selected Child Lines from System & Database
  const [selectedChildLines, setSelectedChildLines] = useState<string[]>([]);
  const [childLineSearch, setChildLineSearch] = useState("");
  const [showAdvancedTuning, setShowAdvancedTuning] = useState(false);

  // Data Options
  const [costCenterList, setCostCenterList] = useState<ManpowerItemOption[]>([]);
  const [outputLineList, setOutputLineList] = useState<string[]>([]);
  const [ccToLineMap, setCcToLineMap] = useState<Record<string, string>>({});
  const [modalRows, setModalRows] = useState<any[]>([]);

  // Search Queries & Sidebar Filter
  const [outputSearch, setOutputSearch] = useState("");
  const [manpowerSearch, setManpowerSearch] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [sidebarFilter, setSidebarFilter] = useState<"ALL" | "SINGLE" | "MACRO">("ALL");
  const [customOutputInput, setCustomOutputInput] = useState("");
  const [customManpowerInput, setCustomManpowerInput] = useState("");

  // Filters for showing only selected items
  const [showOnlySelectedOut, setShowOnlySelectedOut] = useState(false);
  const [showOnlySelectedMp, setShowOnlySelectedMp] = useState(false);
  const [showOnlySelectedChild, setShowOnlySelectedChild] = useState(false);

  const handleAddCustomOutputLine = () => {
    if (!customOutputInput.trim()) return;
    const clean = customOutputInput.trim().toUpperCase();
    if (!outputLineList.includes(clean)) {
      setOutputLineList(prev => [...prev, clean].sort());
    }
    if (!outputSourceLines.includes(clean)) {
      setOutputSourceLines(prev => [...prev, clean]);
    }
    setCustomOutputInput("");
  };

  const handleAddCustomManpower = () => {
    if (!customManpowerInput.trim()) return;
    const clean = customManpowerInput.trim().toUpperCase();
    if (!selectedSubLines.includes(clean)) {
      setSelectedSubLines(prev => [...prev, clean]);
    }
    setCustomManpowerInput("");
  };

  const staticSubLineList: ManpowerItemOption[] = useMemo(() => {
    return AVAILABLE_SUB_LINES.map(line => ({
      code: line,
      displayName: line,
      type: "SUB_LINE" as const,
      rawSearch: line.toLowerCase()
    }));
  }, []);

  const fetchCostCenters = async () => {
    try {
      const res = await axios.get(`${getApiBaseUrl()}/productivity/settings/cost-centers`);
      if (res.data) {
        const allCC = [...(res.data.direct || []), ...(res.data.indirect || []), ...(res.data.indirect_production || []), ...(res.data.unmapped || [])];
        const ccMap = new Map<string, ManpowerItemOption>();
        const ccLineMapping: Record<string, string> = {};
        allCC.forEach((c: any) => {
          const code = (c.cost_center_code || '').trim();
          const name = (c.cost_center_name || '').trim();
          const line = (c.line || '').trim();
          const lineOut = (c.line_out || '').trim();
          if (code) {
            let label = name || code;
            if (lineOut && !label.includes(lineOut)) label = `${label} (${lineOut})`;
            if (!ccMap.has(code)) {
              ccMap.set(code, { code, displayName: label, type: "COST_CENTER", rawSearch: `${code} ${name} ${lineOut}`.toLowerCase() });
            }
            const targetLine = line || (lineOut ? lineOut.split('/')[0].trim() : '');
            if (targetLine) {
              ccLineMapping[code] = targetLine;
              ccLineMapping[code.toUpperCase()] = targetLine;
              if (name) {
                ccLineMapping[name] = targetLine;
                ccLineMapping[name.toUpperCase()] = targetLine;
              }
              if (label) {
                ccLineMapping[label] = targetLine;
                ccLineMapping[label.toUpperCase()] = targetLine;
              }
            }
          }
        });
        setCcToLineMap(ccLineMapping);
        setCostCenterList(Array.from(ccMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName)));
        const officialOutputGroups: string[] = Array.isArray(res.data.availableLineGroups) ? res.data.availableLineGroups : [];
        const combined = new Set<string>();
        [...AVAILABLE_SUB_LINES, ...officialOutputGroups].forEach(line => {
          const norm = line.trim();
          if (norm === "LINE NPM" || norm === "MPM_FPC" || norm === "NPM") {
            combined.add("NPM_FPC");
          } else {
            combined.add(norm);
          }
        });
        setOutputLineList(Array.from(combined).sort());
      }
    } catch (e) {
      console.warn("Failed to fetch cost centers", e);
    }
  };

  const fetchLines = async () => {
    try {
      setLoading(true);
      const dynLines = await fetchDynamicLines();
      setMacroList(dynLines || []);
    } catch (err) {
      console.error("Failed to fetch dynamic lines", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLines();
      fetchCostCenters();
      resetForm();
    }
  }, [isOpen]);

  // Combine available child lines for Macro Mode from System & Database
  const availableChildLines: AvailableChildLineOption[] = useMemo(() => {
    const list: AvailableChildLineOption[] = [];
    const seen = new Set<string>();

    // 1. Lines saved in Database (Custom Macros)
    macroList.forEach(line => {
      const id = `DB_${line.id}`;
      const name = line.display_name || line.line_name || line.id;
      seen.add(name.toUpperCase());
      list.push({
        id,
        name,
        sourceType: "DATABASE",
        outputSources: Array.isArray(line.output_sources) ? line.output_sources : [],
        manpowerSources: [
          ...(Array.isArray(line.cost_center_sources) ? line.cost_center_sources : []),
          ...(Array.isArray(line.sub_line_sources) ? line.sub_line_sources : [])
        ],
        factory: line.factory || "SMT"
      });
    });

    // 2. Standard lines from System configuration (Exact Table Names from Matrix Table)
    Object.entries(STANDARD_TABLE_DEFINITIONS).forEach(([lineName, def]) => {
      if (!seen.has(lineName.toUpperCase())) {
        list.push({
          id: `SYS_${lineName}`,
          name: def.label || lineName,
          sourceType: "STANDARD",
          outputSources: def.outputSources,
          manpowerSources: def.manpowerSources,
          factory: def.factory
        });
      }
    });

    return list;
  }, [macroList]);

  const resetForm = () => {
    setEditingId(null);
    setMacroName("");
    setLineType("SINGLE");
    setSelectedFactory("SMT");
    setSelectedSubLines([]);
    setOutputSourceLines([]);
    setSelectedChildLines([]);
    setShowPlanRow(true);
    setShowTargetRow(true);
    setShowOtRows(true);
    setShowLeaveRows(true);
    setSelectedUnits(["piece"]);
    setOutputSearch("");
    setManpowerSearch("");
    setChildLineSearch("");
    setShowAdvancedTuning(false);
    setShowOnlySelectedOut(false);
    setShowOnlySelectedMp(false);
    setShowOnlySelectedChild(false);
    setCustomManpowerInput("");
    setNotification(null);
  };

  const handleEditSelect = (line: DynamicLineDefinition) => {
    setEditingId(line.id);
    setMacroName(line.display_name || line.line_name || line.id);

    const rawFac = (line.factory || "SMT").toUpperCase();
    const isKnown = FACTORY_OPTIONS.some(f => f.key === rawFac);
    setSelectedFactory(isKnown ? rawFac : "SMT");

    const outs = Array.isArray(line.output_sources) ? line.output_sources : [];
    const combinedManpower = [
      ...(Array.isArray(line.cost_center_sources) ? line.cost_center_sources : []),
      ...(Array.isArray(line.sub_line_sources) ? line.sub_line_sources : [])
    ];

    setOutputSourceLines(outs);
    setSelectedSubLines(combinedManpower);

    // Auto-detect if this was a Macro Line (multiple output sources or factory is MACRO)
    const isMacro = line.factory === "MACRO" || outs.length > 1;
    setLineType(isMacro ? "MACRO" : "SINGLE");

    setShowPlanRow(line.show_plan_row !== false);
    setShowTargetRow(line.show_target_row !== false);
    setShowOtRows(line.show_ot_rows !== false);
    setShowLeaveRows(line.show_leave_rows !== false);
    setSelectedUnits(Array.isArray(line.units) && line.units.length > 0 ? line.units : ["piece"]);
    setShowOnlySelectedOut(false);
    setShowOnlySelectedMp(false);
    setShowOnlySelectedChild(false);
    setCustomManpowerInput("");
    setNotification(null);
  };

  // Toggle child line selection in Macro Mode
  const toggleChildLine = (child: AvailableChildLineOption) => {
    const isSelected = selectedChildLines.includes(child.id);
    let updatedChildIds: string[];

    if (isSelected) {
      updatedChildIds = selectedChildLines.filter(id => id !== child.id);
    } else {
      updatedChildIds = [...selectedChildLines, child.id];
    }

    setSelectedChildLines(updatedChildIds);

    // Auto calculate aggregated output sources and manpower sources
    const newOuts = new Set<string>();
    const newMps = new Set<string>();

    updatedChildIds.forEach(id => {
      const found = availableChildLines.find(c => c.id === id);
      if (found) {
        found.outputSources.forEach(s => newOuts.add(s));
        found.manpowerSources.forEach(s => newMps.add(s));
      }
    });

    setOutputSourceLines(Array.from(newOuts));
    setSelectedSubLines(Array.from(newMps));
  };

  const resetAggregatedSourcesToDefault = () => {
    const newOuts = new Set<string>();
    const newMps = new Set<string>();

    selectedChildLines.forEach(id => {
      const found = availableChildLines.find(c => c.id === id);
      if (found) {
        found.outputSources.forEach(s => newOuts.add(s));
        found.manpowerSources.forEach(s => newMps.add(s));
      }
    });

    setOutputSourceLines(Array.from(newOuts));
    setSelectedSubLines(Array.from(newMps));
  };

  const toggleOutputLine = (line: string) => {
    setOutputSourceLines((prev) => prev.includes(line) ? prev.filter((l) => l !== line) : [...prev, line]);
  };

  const toggleManpowerSource = (item: string) => {
    setSelectedSubLines((prev) => prev.includes(item) ? prev.filter((l) => l !== item) : [...prev, item]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!macroName.trim()) {
      setNotification({ type: 'error', message: "กรุณาระบุชื่อไลน์ผลิต" });
      return;
    }
    if (outputSourceLines.length === 0 && selectedSubLines.length === 0) {
      setNotification({ type: 'error', message: "กรุณาเลือกแหล่งข้อมูลอย่างน้อย 1 แหล่ง (ยอดผลิต หรือ กำลังคน)" });
      return;
    }

    try {
      setSaveLoading(true);
      const cleanId = (editingId || macroName.trim()).toUpperCase();
      const resolvedFactory = lineType === "MACRO" ? "MACRO" : selectedFactory;

      const payload: Partial<DynamicLineDefinition> = {
        id: cleanId,
        line_name: macroName.trim(),
        display_name: macroName.trim(),
        factory: resolvedFactory,
        output_sources: outputSourceLines,
        cost_center_sources: selectedSubLines.filter(s => costCenterList.some(c => c.code === s)),
        sub_line_sources: selectedSubLines.filter(s => !costCenterList.some(c => c.code === s)),
        show_plan_row: showPlanRow,
        show_target_row: showTargetRow,
        show_ot_rows: showOtRows,
        show_leave_rows: showLeaveRows,
        units: selectedUnits,
      };

      const result = await saveDynamicLine(payload);
      if (result) {
        setNotification({ type: 'success', message: `บันทึก${lineType === "MACRO" ? " Macro Line" : "ไลน์ผลิต"} "${macroName.trim()}" สำเร็จเรียบร้อย` });
        await fetchCustomMacroLines();
        fetchLines();
        resetForm();
        if (onSuccess) onSuccess();
      } else {
        setNotification({ type: 'error', message: "ไม่สามารถบันทึกไลน์ผลิตได้ กรุณาลองใหม่อีกครั้ง" });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || "เกิดข้อผิดพลาดในการบันทึก" });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirm = await Swal.fire({
      title: `ลบไลน์ผลิต "${name}"?`,
      text: `คุณต้องการลบไลน์ผลิต "${name}" ออกจากระบบใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'ลบรายการ',
      cancelButtonText: 'ยกเลิก',
      customClass: { popup: 'rounded-2xl shadow-2xl border border-base-300' }
    });

    if (!confirm.isConfirmed) return;

    try {
      setSaveLoading(true);
      const success = await deleteDynamicLine(id);
      if (success) {
        await fetchCustomMacroLines();
        Swal.fire({
          icon: 'success',
          title: `ลบไลน์ผลิต "${name}" สำเร็จเรียบร้อย`,
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: 'rounded-2xl shadow-2xl border border-base-300' }
        });
        setNotification({ type: 'success', message: `ลบไลน์ผลิต "${name}" สำเร็จเรียบร้อย` });
        resetForm();
        fetchLines();
        if (onSuccess) onSuccess();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: 'ไม่สามารถลบไลน์ผลิตได้',
          customClass: { popup: 'rounded-2xl shadow-2xl border border-base-300' }
        });
      }
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: err.message || 'ไม่สามารถลบไลน์ผลิตได้',
        customClass: { popup: 'rounded-2xl shadow-2xl border border-base-300' }
      });
      setNotification({ type: 'error', message: "ไม่สามารถลบไลน์ผลิตได้" });
    } finally {
      setSaveLoading(false);
    }
  };

  // Preview dates: เลือก 8 วันล่าสุดที่มีข้อมูลจริง (ไม่นำวันที่ในอนาคตมาแสดง)
  const previewDates = useMemo(() => {
    const todayStr = dayjs().format('YYYY-MM-DD');

    if (dateColumns && dateColumns.length > 0) {
      // 1. กรองวันที่ที่ผ่านไปแล้ว (ก่อนหรือเท่ากับเมื่อวาน)
      const pastDates = dateColumns.filter(d => d < todayStr);
      if (pastDates.length >= 8) {
        return pastDates.slice(-8);
      }
      // หากมีน้อยกว่า 8 วัน ให้รวมวันนี้ด้วย
      const upToToday = dateColumns.filter(d => d <= todayStr);
      if (upToToday.length >= 8) {
        return upToToday.slice(-8);
      }
      if (upToToday.length > 0) {
        // หากเพิ่งต้นเดือน ให้ดึง 8 วันแรกของเดือน
        return dateColumns.slice(0, Math.min(8, dateColumns.length));
      }
      // หากเลือกเดือนในอนาคต ให้ดึง 8 วันแรกของเดือนนั้น
      return dateColumns.slice(0, Math.min(8, dateColumns.length));
    }

    // Fallback เมื่อไม่มี dateColumns: 8 วันย้อนหลังจากเมื่อวาน
    const dates: string[] = [];
    for (let i = 8; i >= 1; i--) {
      dates.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'));
    }
    return dates;
  }, [dateColumns]);

  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchPreviewOutput = useCallback(async () => {
    if (!previewDates || previewDates.length === 0) return;
    setPreviewLoading(true);
    try {
      const start = previewDates[0];
      const end = previewDates[previewDates.length - 1];
      const res = await axios.get(`${getApiBaseUrl()}/productivity/productivity-smart-report`, {
        params: { startDate: start, endDate: end, lineGroup: "ALL" }
      });
      if (Array.isArray(res.data)) {
        setModalRows(res.data);
      }
    } catch (err) {
      console.warn("Failed to fetch modal preview output rows", err);
    } finally {
      setPreviewLoading(false);
    }
  }, [previewDates]);

  useEffect(() => {
    if (isOpen && previewDates.length > 0) {
      fetchPreviewOutput();
    }
  }, [isOpen, previewDates, fetchPreviewOutput]);

  // Matrix Simulation calculation
  const simulation = useMemo(() => {
    const opRegister: Record<string, number> = {};
    const manHours: Record<string, number> = {};
    const piecePlan: Record<string, number> = {};
    const pieceOutput: Record<string, number> = {};
    const productivity: Record<string, number> = {};
    const otPsn: Record<string, number> = {};
    const leavePsn: Record<string, number> = {};

    let sumOutput = 0, sumPlan = 0, sumManHours = 0, sumRegister = 0, daysWithManpower = 0, sumOt = 0, sumLeave = 0;

    previewDates.forEach(date => {
      let dayOut = 0;
      let dayPlan = 0;
      const matchedMatrixKeys = new Set<string>();

      outputSourceLines.forEach(src => {
        const srcUpper = src.trim().toUpperCase();
        const norm = normalizeMatrixLineGroupName(src).toUpperCase();
        let foundInMatrix = false;

        if (matrixData && matrixData.length > 0) {
          const entry = matrixData.find(([k]) => {
            const kUpper = k.trim().toUpperCase();
            const kNorm = normalizeMatrixLineGroupName(k).toUpperCase();
            return kUpper === srcUpper || kNorm === srcUpper || kUpper === norm || kNorm === norm;
          });
          if (entry) {
            const entryKey = entry[0].trim().toUpperCase();
            if (!matchedMatrixKeys.has(entryKey)) {
              matchedMatrixKeys.add(entryKey);
              if (entry[1]?.has(date)) {
                const val = entry[1].get(date) || 0;
                dayOut += val;
              }
            }
            foundInMatrix = true;
          }
        }

        // Check modalRows (live 8-day snapshot across all factories/lines)
        if (!foundInMatrix && modalRows && modalRows.length > 0) {
          const matchedModal = modalRows.filter((r: any) => {
            const rDate = dayjs(r.output_date || r.date).format('YYYY-MM-DD');
            const rLg = (r.line_group || r.lineGroup || '').trim().toUpperCase();
            const rNorm = normalizeMatrixLineGroupName(rLg).toUpperCase();
            return rDate === date && (rLg === srcUpper || rNorm === srcUpper || rLg === norm || rNorm === norm);
          });
          if (matchedModal.length > 0) {
            matchedModal.forEach((r: any) => {
              if (r.mcLine !== 'MANUAL_EXCEL') dayOut += Number(r.actual_piece_qty || r.pieceQty || 0);
            });
            foundInMatrix = true;
          }
        }

        // Check rawRows as fallback
        if (!foundInMatrix && rawRows && rawRows.length > 0) {
          const matched = rawRows.filter((r: any) => {
            const rDate = dayjs(r.date || r.output_date).format('YYYY-MM-DD');
            const rLg = (r.lineGroup || r.line_group || '').trim().toUpperCase();
            const rNorm = normalizeMatrixLineGroupName(rLg).toUpperCase();
            return rDate === date && (rLg === srcUpper || rNorm === srcUpper || rLg === norm || rNorm === norm);
          });
          matched.forEach((r: any) => {
            if (r.mcLine !== 'MANUAL_EXCEL') dayOut += Number(r.pieceQty || r.actual_piece_qty || 0);
            if (r.planQty !== undefined && Number(r.planQty) > 0) dayPlan += Number(r.planQty || 0);
          });
        }
      });

      pieceOutput[date] = dayOut;
      piecePlan[date] = dayPlan;
      sumOutput += dayOut;
      sumPlan += dayPlan;

      let dayReg = 0, dayMh = 0, dayOt = 0, dayLv = 0;
      const dateAtt = aggregatedAttendanceData?.[date];
      if (dateAtt) {
        selectedSubLines.forEach(src => {
          const cleanSrc = src.trim();
          const mappedLine = ccToLineMap[cleanSrc] || ccToLineMap[cleanSrc.toUpperCase()] || ccToLineMap[cleanSrc.split('/')[0].trim().toUpperCase()];
          const lookupKey = mappedLine || cleanSrc;

          const r = getDynamicAttendanceValue(lookupKey, dateAtt, 'fpc_total_register', 'total_register');
          const m = getDynamicAttendanceValue(lookupKey, dateAtt, 'fpc_total_man_hour', 'total_man_hour');
          const o = getDynamicAttendanceValue(lookupKey, dateAtt, 'fpc_ot_psn', 'ot_psn');
          const l = getDynamicAttendanceValue(lookupKey, dateAtt, 'fpc_leave', 'leave');

          dayReg += r;
          dayMh += m;
          dayOt += o;
          dayLv += l;
        });
      }

      opRegister[date] = dayReg;
      manHours[date] = dayMh;
      otPsn[date] = dayOt;
      leavePsn[date] = dayLv;

      sumManHours += dayMh;
      sumOt += dayOt;
      sumLeave += dayLv;
      if (dayReg > 0) {
        sumRegister += dayReg;
        daysWithManpower++;
      }

      productivity[date] = dayMh > 0 ? (dayOut / dayMh) : 0;
    });

    return {
      opRegister,
      manHours,
      piecePlan,
      pieceOutput,
      productivity,
      otPsn,
      leavePsn,
      summary: {
        totalOutput: sumOutput,
        totalPlan: sumPlan,
        avgRegister: daysWithManpower > 0 ? (sumRegister / daysWithManpower) : 0,
        totalManHour: sumManHours,
        overallProductivity: sumManHours > 0 ? (sumOutput / sumManHours) : 0,
        totalOt: sumOt,
        totalLeave: sumLeave,
      }
    };
  }, [previewDates, outputSourceLines, selectedSubLines, matrixData, rawRows, aggregatedAttendanceData, ccToLineMap, modalRows]);

  // Unified manpower options combining API Cost Centers + Standard Sub-lines + any saved selectedSubLines
  const allManpowerOptions: ManpowerItemOption[] = useMemo(() => {
    const map = new Map<string, ManpowerItemOption>();

    // 1. API Cost Centers
    costCenterList.forEach(c => {
      map.set(c.code, c);
    });

    // 2. Standard Sub-lines from system table definitions
    AVAILABLE_SUB_LINES.forEach(line => {
      if (!map.has(line)) {
        map.set(line, {
          code: line,
          displayName: line,
          type: "SUB_LINE",
          rawSearch: line.toLowerCase()
        });
      }
      const withLine = `LINE ${line}`;
      if (!map.has(withLine)) {
        map.set(withLine, {
          code: withLine,
          displayName: withLine,
          type: "SUB_LINE",
          rawSearch: withLine.toLowerCase()
        });
      }
    });

    // 3. Ensure any currently selected sub-lines are ALWAYS included so they never disappear
    selectedSubLines.forEach(sub => {
      if (!map.has(sub)) {
        map.set(sub, {
          code: sub,
          displayName: sub,
          type: "SUB_LINE",
          rawSearch: sub.toLowerCase()
        });
      }
    });

    return Array.from(map.values());
  }, [costCenterList, selectedSubLines]);

  // Unified output options combining outputLineList + any currently selected output lines
  const allOutputOptions: string[] = useMemo(() => {
    const set = new Set<string>(outputLineList);
    outputSourceLines.forEach(l => set.add(l));
    return Array.from(set).sort();
  }, [outputLineList, outputSourceLines]);

  if (!isOpen) return null;

  const filteredOutputLines = allOutputOptions
    .filter(l => {
      if (showOnlySelectedOut && !outputSourceLines.includes(l)) return false;
      if (outputSearch.trim() && !l.toLowerCase().includes(outputSearch.toLowerCase().trim())) return false;
      return true;
    })
    .sort((a, b) => {
      const aSel = outputSourceLines.includes(a);
      const bSel = outputSourceLines.includes(b);
      if (aSel && !bSel) return -1;
      if (!aSel && bSel) return 1;
      return a.localeCompare(b);
    });

  const filteredManpowerList = allManpowerOptions
    .filter(item => {
      if (showOnlySelectedMp && !selectedSubLines.includes(item.code)) return false;
      if (manpowerSearch.trim()) {
        const q = manpowerSearch.toLowerCase().trim();
        const match = item.rawSearch.includes(q) ||
          item.displayName.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aSel = selectedSubLines.includes(a.code);
      const bSel = selectedSubLines.includes(b.code);
      if (aSel && !bSel) return -1;
      if (!aSel && bSel) return 1;
      return a.displayName.localeCompare(b.displayName);
    });

  const filteredChildLines = availableChildLines
    .filter(c => {
      if (showOnlySelectedChild && !selectedChildLines.includes(c.id)) return false;
      if (childLineSearch.trim()) {
        const q = childLineSearch.toLowerCase().trim();
        const match = c.name.toLowerCase().includes(q) ||
          c.outputSources.some(s => s.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aSel = selectedChildLines.includes(a.id);
      const bSel = selectedChildLines.includes(b.id);
      if (aSel && !bSel) return -1;
      if (!aSel && bSel) return 1;
      return a.name.localeCompare(b.name);
    });

  const filteredSavedList = macroList.filter(m => {
    const matchSearch = m.line_name.toLowerCase().includes(listSearch.toLowerCase().trim()) || m.id.toLowerCase().includes(listSearch.toLowerCase().trim());
    if (!matchSearch) return false;
    const isMacro = m.factory === "MACRO" || (Array.isArray(m.output_sources) && m.output_sources.length > 1);
    if (sidebarFilter === "SINGLE") return !isMacro;
    if (sidebarFilter === "MACRO") return isMacro;
    return true;
  });

  const isHealthy = useMemo(() => {
    const hasOutConfig = outputSourceLines.length > 0;
    const hasMpConfig = selectedSubLines.length > 0;
    if (hasOutConfig && hasMpConfig) {
      return simulation.summary.totalOutput > 0 && simulation.summary.totalManHour > 0;
    }
    if (hasOutConfig) {
      return simulation.summary.totalOutput > 0;
    }
    if (hasMpConfig) {
      return simulation.summary.totalManHour > 0;
    }
    return false;
  }, [outputSourceLines.length, selectedSubLines.length, simulation.summary.totalOutput, simulation.summary.totalManHour]);

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-base-100 rounded-3xl shadow-2xl border border-base-300 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden text-base-content">

        {/* Modal Header */}
        <div className="p-4 px-6 border-b border-base-300 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div>
            <h2 className="text-lg font-bold text-white">
              Custom Line & Macro Builder
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              กำหนดไลน์เดี่ยว (Single Line) หรือ รวมกลุ่มไลน์ (Macro Line) เพื่อคำนวณ Productivity
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-sm btn-ghost btn-circle text-white/70 hover:text-white hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">

          {/* LEFT SIDEBAR: Saved Lines List */}
          <div className="lg:col-span-4 border-r border-base-300 bg-base-200/40 p-4 flex flex-col gap-3 overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-base-content/60 tracking-wider">
                รายการไลน์ที่บันทึกไว้ ({macroList.length})
              </span>
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-xs btn-primary gap-1 font-bold rounded-lg"
              >
                <Plus size={13} />
                <span>สร้างใหม่</span>
              </button>
            </div>

            {/* Sidebar Filter Tabs */}
            <div className="join w-full grid grid-cols-3">
              <button
                type="button"
                onClick={() => setSidebarFilter("ALL")}
                className={`join-item btn btn-xs font-bold text-[10px] ${sidebarFilter === "ALL" ? "btn-neutral" : "btn-ghost border border-base-300"}`}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => setSidebarFilter("SINGLE")}
                className={`join-item btn btn-xs font-bold text-[10px] ${sidebarFilter === "SINGLE" ? "bg-blue-500 hover:bg-blue-600 text-white border-none" : "btn-ghost border border-base-300"}`}
              >
                ไลน์เดี่ยว
              </button>
              <button
                type="button"
                onClick={() => setSidebarFilter("MACRO")}
                className={`join-item btn btn-xs font-bold text-[10px] ${sidebarFilter === "MACRO" ? "bg-purple-500 hover:bg-purple-600 text-white border-none" : "btn-ghost border border-base-300"}`}
              >
                Macro Group
              </button>
            </div>

            {/* List Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input
                type="text"
                className="input input-xs input-bordered w-full pl-8 rounded-lg text-xs focus:outline-none"
                placeholder="ค้นหาไลน์ที่สร้างไว้..."
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
              />
            </div>

            {/* Saved Items */}
            <div className="flex-1 overflow-y-auto -mx-1.5 px-1.5 py-1.5 flex flex-col gap-2">
              {loading ? (
                <div className="flex items-center justify-center p-8 text-xs text-base-content/50 gap-2">
                  <RefreshCcw size={14} className="animate-spin text-primary" />
                  <span>กำลังโหลดรายการ...</span>
                </div>
              ) : filteredSavedList.length === 0 ? (
                <div className="p-8 text-center text-xs text-base-content/40 bg-base-100/50 rounded-2xl border border-dashed border-base-300">
                  ไม่พบรายการไลน์ผลิต
                </div>
              ) : (
                filteredSavedList.map((line) => {
                  const isSelected = editingId === line.id;
                  const isLineMacro = line.factory === "MACRO" || (Array.isArray(line.output_sources) && line.output_sources.length > 1);
                  const outCount = Array.isArray(line.output_sources) ? line.output_sources.length : 0;
                  const mpCount = (Array.isArray(line.cost_center_sources) ? line.cost_center_sources.length : 0) +
                    (Array.isArray(line.sub_line_sources) ? line.sub_line_sources.length : 0);

                  return (
                    <div
                      key={line.id}
                      onClick={() => handleEditSelect(line)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${isSelected
                        ? isLineMacro
                          ? "bg-purple-50 border-purple-400 shadow-md text-base-content ring-2 ring-purple-300/30"
                          : "bg-blue-50 border-blue-400 shadow-md text-base-content ring-2 ring-blue-300/30"
                        : "bg-base-100 border-base-200 hover:border-base-content/30 text-base-content/80 hover:bg-base-100"
                        }`}
                    >
                      <div className="flex flex-col gap-1 min-w-0 flex-1 mr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-sm text-base-content truncate">
                            {line.display_name || line.line_name}
                          </span>
                          <span className={`badge badge-xs font-black text-[9px] border-none px-2 py-0.5 ${isLineMacro ? "bg-purple-500 text-white" : "bg-blue-100 text-blue-700"}`}>
                            {isLineMacro ? "Macro Line" : (line.factory || "Single")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-base-content/60">
                          <span>Output: <strong>{outCount}</strong> ไลน์</span>
                          <span>•</span>
                          <span>Manpower: <strong>{mpCount}</strong> แผนก</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(line.id, line.line_name);
                          }}
                          className="btn btn-ghost btn-xs btn-square text-error hover:bg-error/10 rounded-lg"
                          title="ลบไลน์ผลิต"
                        >
                          <Trash2 size={14} />
                        </button>
                        <ChevronRight size={16} className={`transition-transform ${isSelected ? "text-primary translate-x-0.5" : "text-base-content/30"}`} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT MAIN PANEL: Wizard Form & Verify Table */}
          <div className="lg:col-span-8 p-5 overflow-y-auto flex flex-col gap-5 bg-base-100">

            {/* Notification Alert */}
            {notification && (
              <div className={`p-3 px-4 rounded-2xl flex items-center gap-2.5 text-xs font-bold animate-fadeIn ${notification.type === 'success'
                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-800"
                : "bg-rose-500/15 border border-rose-500/30 text-rose-800"
                }`}>
                {notification.type === 'success' ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> : <AlertCircle size={16} className="shrink-0 text-rose-600" />}
                <span>{notification.message}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="flex flex-col gap-5">

              {/* STEP 1: LINE PROFILE & MODE SELECTOR */}
              <div className={`p-4 rounded-2xl border-l-4 border border-base-200 bg-base-100 transition-all flex flex-col gap-3.5 ${lineType === "MACRO"
                ? "border-l-purple-500"
                : "border-l-blue-500"
                }`}>

                {/* Mode Selector */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-base-300/60">
                  <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider ${lineType === "MACRO" ? "text-purple-600" : "text-blue-600"
                    }`}>
                    <span className={`w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] ${lineType === "MACRO" ? "bg-purple-500" : "bg-blue-500"
                      }`}>1</span>
                    <span>STEP 1: ตั้งชื่อไลน์</span>
                  </div>

                  {/* Mode Buttons */}
                  <div className="join rounded-xl border border-base-300 p-0.5 bg-base-200/60">
                    <button
                      type="button"
                      onClick={() => {
                        setLineType("SINGLE");
                        setSelectedChildLines([]);
                      }}
                      className={`join-item btn btn-xs font-black text-xs rounded-lg transition-all ${lineType === "SINGLE"
                        ? "bg-blue-500 hover:bg-blue-600 text-white shadow-sm border-none"
                        : "btn-ghost text-base-content/60 hover:text-base-content border-none"
                        }`}
                    >
                      สร้างไลน์เดี่ยว (Single Line)
                    </button>
                    <button
                      type="button"
                      onClick={() => setLineType("MACRO")}
                      className={`join-item btn btn-xs font-black text-xs rounded-lg transition-all ${lineType === "MACRO"
                        ? "bg-purple-500 hover:bg-purple-600 text-white shadow-sm border-none"
                        : "btn-ghost text-base-content/60 hover:text-base-content border-none"
                        }`}
                    >
                      รวมกลุ่มไลน์ (Macro Line)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-base-content/70 mb-1">
                      {lineType === "MACRO" ? "Macro Name*" : "LINE NAME*"}
                    </label>
                    <input
                      type="text"
                      className={`input input-sm input-bordered w-full rounded-xl font-bold text-base-content focus:outline-none ${lineType === "MACRO" ? "focus:border-purple-500" : "focus:border-blue-500"
                        }`}
                      placeholder={lineType === "MACRO" ? "เช่น TOTAL ASSY, AUTOMOTIVE GROUP, SMT OVERVIEW" : "เช่น LINE AIX-ASY, LINE ASY4, Automotive"}
                      value={macroName}
                      onChange={(e) => setMacroName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-base-content/70 mb-1">
                      Sectors
                    </label>
                    <select
                      className="select select-sm select-bordered w-full rounded-xl font-bold focus:outline-none"
                      value={selectedFactory}
                      onChange={(e) => setSelectedFactory(e.target.value)}
                    >
                      {FACTORY_OPTIONS.map(f => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Display Toggles */}
                <div className="pt-2.5 border-t border-base-300/40 flex flex-col gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <span className="font-bold text-base-content/60 text-[11px] uppercase tracking-wider">เปิด/ปิดแถวแสดงผล:</span>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className={`checkbox checkbox-xs rounded-md ${lineType === "MACRO" ? "checkbox-accent" : "checkbox-primary"}`}
                        checked={showPlanRow}
                        onChange={(e) => setShowPlanRow(e.target.checked)}
                      />
                      <span className="font-semibold text-base-content/80">Plan</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className={`checkbox checkbox-xs rounded-md ${lineType === "MACRO" ? "checkbox-accent" : "checkbox-primary"}`}
                        checked={showTargetRow}
                        onChange={(e) => setShowTargetRow(e.target.checked)}
                      />
                      <span className="font-semibold text-base-content/80">Target</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className={`checkbox checkbox-xs rounded-md ${lineType === "MACRO" ? "checkbox-accent" : "checkbox-primary"}`}
                        checked={showOtRows}
                        onChange={(e) => setShowOtRows(e.target.checked)}
                      />
                      <span className="font-semibold text-base-content/80">OT</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className={`checkbox checkbox-xs rounded-md ${lineType === "MACRO" ? "checkbox-accent" : "checkbox-primary"}`}
                        checked={showLeaveRows}
                        onChange={(e) => setShowLeaveRows(e.target.checked)}
                      />
                      <span className="font-semibold text-base-content/80">การลา (Leave)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* BRANCH A: MACRO LINE MODE (FUCHSIA THEME)                                */}
              {/* ========================================================================= */}
              {lineType === "MACRO" ? (
                <div className="bg-base-100 p-4 rounded-2xl border border-base-200 border-l-4 border-l-purple-500 flex flex-col gap-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-xs font-black text-purple-600 uppercase tracking-wider">
                      <span className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center text-[10px]">2</span>
                      <span>STEP 2: เลือกไลน์ที่มีอยู่ในตาราง Productivity</span>
                    </div>
                    <span className="badge font-bold text-xs bg-purple-500 text-white border-none">
                      เลือกแล้ว {selectedChildLines.length} ไลน์ย่อย
                    </span>
                  </div>

                    {/* Output Units Selector */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-purple-50/70 border border-purple-200/60 text-xs">
                      <span className="font-bold text-purple-900 text-[11px] uppercase tracking-wider">
                        หน่วยของยอดผลิต (Output Units):
                      </span>
                      <div className="inline-flex rounded-xl p-0.5 bg-white border border-purple-200 gap-1 shadow-sm">
                        {[
                          { id: "piece", label: "Piece (PCS)" },
                          { id: "sheet", label: "Sheet (SHT)" },
                          { id: "lot", label: "Lot (LOT)" }
                        ].map(u => {
                          const isChecked = selectedUnits.includes(u.id);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                if (isChecked) {
                                  if (selectedUnits.length > 1) {
                                    setSelectedUnits(selectedUnits.filter(x => x !== u.id));
                                  }
                                } else {
                                  setSelectedUnits([...selectedUnits, u.id]);
                                }
                              }}
                              className={`btn btn-xs px-3 font-bold text-xs rounded-lg transition-all border-none ${isChecked
                                ? "bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                                : "btn-ghost text-base-content/60 hover:text-base-content"
                                }`}
                            >
                              {isChecked ? "✓ " : ""}{u.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selected Child Lines Chip Banner */}
                    <div className="p-3 bg-purple-50/80 rounded-xl border border-purple-200 flex flex-col gap-2">
                      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-purple-900">
                          <span>ไลน์ย่อยที่เลือกไว้:</span>
                          <span className="badge badge-sm bg-purple-600 text-white font-black">{selectedChildLines.length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedChildLines.length > 0 && (
                            <>
                              <button
                                type="button"
                                onClick={() => setShowOnlySelectedChild(!showOnlySelectedChild)}
                                className={`btn btn-xs rounded-lg font-bold border-none transition-all flex items-center gap-1 ${
                                  showOnlySelectedChild ? "bg-purple-600 text-white shadow-sm" : "bg-white text-purple-700 hover:bg-purple-100"
                                }`}
                              >
                                <Filter size={11} />
                                {showOnlySelectedChild ? "แสดงทั้งหมด" : `ดูเฉพาะที่เลือก (${selectedChildLines.length})`}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedChildLines([]);
                                  setOutputSourceLines([]);
                                  setSelectedSubLines([]);
                                }}
                                className="text-[11px] font-bold text-rose-600 hover:underline hover:text-rose-700 cursor-pointer"
                              >
                                ล้างทั้งหมด
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {selectedChildLines.length === 0 ? (
                        <div className="text-xs text-purple-700/70 italic py-0.5">
                          ยังไม่ได้เลือกไลน์ย่อย (คลิกเลือกไลน์ด้านล่าง)
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                          {selectedChildLines.map(id => {
                            const child = availableChildLines.find(c => c.id === id);
                            const name = child ? child.name : id;
                            return (
                              <span
                                key={`chip-child-${id}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-600 text-white shadow-sm"
                              >
                                <span>{name}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (child) toggleChildLine(child);
                                  }}
                                  className="hover:bg-purple-700 rounded-full p-0.5 transition-colors"
                                  title={`ยกเลิกเลือก ${name}`}
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  {/* Search Existing Lines */}
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                    <input
                      type="text"
                      className="input input-xs input-bordered w-full pl-8 rounded-lg text-xs focus:outline-none focus:border-purple-500"
                      placeholder="ค้นหาไลน์ที่มีอยู่ในระบบหรือตารางที่บันทึกไว้..."
                      value={childLineSearch}
                      onChange={(e) => setChildLineSearch(e.target.value)}
                    />
                  </div>

                  {/* Child Lines Grid */}
                  <div className="max-h-52 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pr-1 pt-1">
                    {filteredChildLines.map((child) => {
                      const active = selectedChildLines.includes(child.id);
                      return (
                        <div
                          key={child.id}
                          onClick={() => toggleChildLine(child)}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between select-none ${active
                            ? "bg-purple-500 text-white border-purple-500 shadow-md ring-2 ring-purple-300/50"
                            : "bg-base-100 border-base-300 hover:border-purple-400 text-base-content/90"
                            }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-extrabold truncate">{child.name}</span>
                            {active && <Check size={14} className="shrink-0" />}
                          </div>
                          <div className="flex items-center justify-between text-[9px] opacity-80">
                            <span>{child.sourceType === "DATABASE" ? "จาก Database" : "ไลน์ระบบ"}</span>
                            <span>{child.outputSources.length} Out • {child.manpowerSources.length} MP</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Aggregated Sources Summary Banner */}
                  <div className="bg-base-100 p-3 rounded-xl border border-base-200 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Layers2 size={15} className="text-purple-500" />
                      <span className="font-bold text-base-content/80">
                        ผลรวมแหล่งข้อมูล: <strong>{outputSourceLines.length}</strong> แหล่งยอดผลิต • <strong>{selectedSubLines.length}</strong> แหล่งกำลังคน
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedChildLines.length > 0 && (
                        <button
                          type="button"
                          onClick={resetAggregatedSourcesToDefault}
                          className="btn btn-xs btn-outline border-purple-300 hover:bg-purple-100 text-purple-700 font-bold gap-1"
                          title="คืนค่าแหล่งข้อมูลยอดผลิตและกำลังคนทั้งหมดตามไลน์ย่อยที่เลือก"
                        >
                          <RefreshCcw size={11} />
                          รีเซ็ตคืนค่าเริ่มต้น
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowAdvancedTuning(!showAdvancedTuning)}
                        className="btn btn-xs btn-ghost text-purple-600 font-bold"
                      >
                        {showAdvancedTuning ? "ซ่อนการปรับแต่งละเอียด" : "ปรับแต่งแหล่งข้อมูลละเอียด"}
                      </button>
                    </div>
                  </div>

                  {/* Optional Advanced Tuning */}
                  {showAdvancedTuning && (
                    <div className="p-3 bg-base-100/60 rounded-xl border border-dashed border-base-300 flex flex-col gap-3 animate-fadeIn text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-base-content/70 text-[11px]">ปรับแต่งแหล่งข้อมูลย่อยเฉพาะสำหรับ Macro Line นี้</span>
                        <button
                          type="button"
                          onClick={resetAggregatedSourcesToDefault}
                          className="text-purple-600 hover:underline flex items-center gap-1 font-bold text-[11px]"
                        >
                          <RefreshCcw size={11} />
                          กู้คืนแหล่งข้อมูลทั้งหมด
                        </button>
                      </div>
                      <div>
                        <div className="font-bold text-purple-600 mb-1">แหล่งยอดผลิตที่ถูกรวม (Output Sources):</div>
                        <div className="flex flex-wrap gap-1.5">
                          {outputSourceLines.length === 0 ? (
                            <span className="text-slate-400 italic text-[11px]">ไม่มีแหล่งยอดผลิต (คลิก &quot;กู้คืนแหล่งข้อมูลทั้งหมด&quot; เพื่อคืนค่า)</span>
                          ) : (
                            outputSourceLines.map(s => (
                              <span key={s} className="badge badge-sm bg-purple-100 text-purple-700 border border-purple-200 gap-1 font-semibold">
                                {s}
                                <button type="button" onClick={() => toggleOutputLine(s)}><X size={11} /></button>
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="font-bold text-purple-600 mb-1">แหล่งกำลังคนที่ถูกรวม (Manpower Sources):</div>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {selectedSubLines.length === 0 ? (
                            <span className="text-slate-400 italic text-[11px]">ไม่มีแหล่งกำลังคน (คลิก &quot;กู้คืนแหล่งข้อมูลทั้งหมด&quot; เพื่อคืนค่า)</span>
                          ) : (
                            selectedSubLines.map(s => (
                              <span key={s} className="badge badge-sm bg-purple-500 text-white gap-1 font-semibold border-none">
                                {s}
                                <button type="button" onClick={() => toggleManpowerSource(s)}><X size={11} /></button>
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ========================================================================= */
                /* BRANCH B: SINGLE LINE MODE (BLUE FOR OUTPUT & SKY FOR MANPOWER)          */
                /* ========================================================================= */
                <>
                  {/* STEP 2: PRODUCTION OUTPUT SOURCES (ROYAL BLUE THEME) */}
                  <div className="bg-base-100 p-4 rounded-2xl border border-base-200 border-l-4 border-l-blue-500 flex flex-col gap-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-xs font-black text-blue-600 uppercase tracking-wider">
                        <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px]">2</span>
                        <span>STEP 2: เลือกแหล่งยอดผลิต (PRODUCTION OUTPUT SOURCES)</span>
                      </div>
                      <span className="badge font-bold text-xs bg-blue-500 text-white border-none">
                        เลือกแล้ว {outputSourceLines.length} ไลน์ยอดผลิต
                      </span>
                    </div>

                      {/* Output Units Selector */}
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/60 text-xs">
                        <span className="font-bold text-blue-900 text-[11px] uppercase tracking-wider">
                          หน่วยของยอดผลิต (Output Units):
                        </span>
                        <div className="inline-flex rounded-xl p-0.5 bg-white border border-blue-200 gap-1 shadow-sm">
                          {[
                            { id: "piece", label: "Piece (PCS)" },
                            { id: "sheet", label: "Sheet (SHT)" },
                            { id: "lot", label: "Lot (LOT)" }
                          ].map(u => {
                            const isChecked = selectedUnits.includes(u.id);
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  if (isChecked) {
                                    if (selectedUnits.length > 1) {
                                      setSelectedUnits(selectedUnits.filter(x => x !== u.id));
                                    }
                                  } else {
                                    setSelectedUnits([...selectedUnits, u.id]);
                                  }
                                }}
                                className={`btn btn-xs px-3 font-bold text-xs rounded-lg transition-all border-none ${isChecked
                                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                  : "btn-ghost text-base-content/60 hover:text-base-content"
                                  }`}
                              >
                                {isChecked ? "✓ " : ""}{u.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Selected Items Chip Banner for Output */}
                      <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 flex flex-col gap-2">
                        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-blue-900">
                            <span>ไลน์ยอดผลิตที่เลือกไว้:</span>
                            <span className="badge badge-sm bg-blue-600 text-white font-black">{outputSourceLines.length}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {outputSourceLines.length > 0 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setShowOnlySelectedOut(!showOnlySelectedOut)}
                                  className={`btn btn-xs rounded-lg font-bold border-none transition-all flex items-center gap-1 ${
                                    showOnlySelectedOut ? "bg-blue-600 text-white shadow-sm" : "bg-white text-blue-700 hover:bg-blue-100"
                                  }`}
                                >
                                  <Filter size={11} />
                                  {showOnlySelectedOut ? "แสดงทั้งหมด" : `ดูเฉพาะที่เลือก (${outputSourceLines.length})`}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setOutputSourceLines([])}
                                  className="text-[11px] font-bold text-rose-600 hover:underline hover:text-rose-700 cursor-pointer"
                                >
                                  ล้างทั้งหมด
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {outputSourceLines.length === 0 ? (
                          <div className="text-xs text-blue-700/70 italic py-0.5">
                            ยังไม่ได้เลือกแหล่งยอดผลิต (คลิกเลือกไลน์ด้านล่าง หรือพิมพ์เพิ่มเอง)
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                            {outputSourceLines.map(line => (
                              <span
                                key={`chip-out-${line}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white shadow-sm"
                              >
                                <span>{line}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleOutputLine(line);
                                  }}
                                  className="hover:bg-blue-700 rounded-full p-0.5 transition-colors"
                                  title={`ยกเลิกเลือก ${line}`}
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                    <div className="flex flex-col sm:flex-row items-center gap-2 mt-1">
                      <div className="relative flex-1 w-full">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                        <input
                          type="text"
                          className="input input-xs input-bordered w-full pl-8 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                          placeholder="ค้นหาชื่อไลน์ยอดผลิต..."
                          value={outputSearch}
                          onChange={(e) => setOutputSearch(e.target.value)}
                        />
                      </div>

                      <div className="flex items-center gap-1.5 w-full sm:w-auto">
                        <input
                          type="text"
                          className="input input-xs input-bordered rounded-lg text-xs flex-1 sm:w-44 font-semibold uppercase focus:outline-none focus:border-blue-500"
                          placeholder="+ เพิ่มชื่อไลน์ใหม่เอง..."
                          value={customOutputInput}
                          onChange={(e) => setCustomOutputInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddCustomOutputLine();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomOutputLine}
                          className="btn btn-xs bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold shrink-0 border-none"
                        >
                          + เพิ่ม
                        </button>
                      </div>
                    </div>

                    {/* Output Grid */}
                    <div className="max-h-40 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pr-1 pt-1">
                      {filteredOutputLines.map((line) => {
                        const active = outputSourceLines.includes(line);
                        return (
                          <div
                            key={`out-${line}`}
                            onClick={() => toggleOutputLine(line)}
                            className={`p-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all flex items-center justify-between select-none ${active
                              ? "bg-blue-500 text-white border-blue-500 shadow-sm ring-2 ring-blue-300/50"
                              : "bg-base-100 border-base-300 hover:border-blue-400 text-base-content/80"
                              }`}
                          >
                            <span className="truncate mr-1">{line}</span>
                            {active && <Check size={14} className="shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* STEP 3: MANPOWER & COST CENTER SOURCES (SKY / CYAN THEME) */}
                  <div className="bg-base-100 p-4 rounded-2xl border border-base-200 border-l-4 border-l-emerald-500 flex flex-col gap-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-xs font-black text-emerald-600 uppercase tracking-wider">
                        <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">3</span>
                        <span>STEP 3: เลือกแหล่งคนทำงาน (MANPOWER & COST CENTER SOURCES)</span>
                      </div>
                      <span className="badge font-bold text-xs bg-emerald-500 text-white border-none">
                        เลือกแล้ว {selectedSubLines.length} แผนกกำลังคน
                      </span>
                    </div>

                    {/* Selected Items Chip Banner for Manpower */}
                    <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 flex flex-col gap-2">
                      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                          <span>แผนก/ไลน์คนทำงานที่เลือกไว้:</span>
                          <span className="badge badge-sm bg-emerald-600 text-white font-black">{selectedSubLines.length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedSubLines.length > 0 && (
                            <>
                              <button
                                type="button"
                                onClick={() => setShowOnlySelectedMp(!showOnlySelectedMp)}
                                className={`btn btn-xs rounded-lg font-bold border-none transition-all flex items-center gap-1 ${
                                  showOnlySelectedMp ? "bg-emerald-600 text-white shadow-sm" : "bg-white text-emerald-700 hover:bg-emerald-100"
                                }`}
                              >
                                <Filter size={11} />
                                {showOnlySelectedMp ? "แสดงทั้งหมด" : `ดูเฉพาะที่เลือก (${selectedSubLines.length})`}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedSubLines([])}
                                className="text-[11px] font-bold text-rose-600 hover:underline hover:text-rose-700 cursor-pointer"
                              >
                                ล้างทั้งหมด
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {selectedSubLines.length === 0 ? (
                        <div className="text-xs text-emerald-700/70 italic py-0.5">
                          ยังไม่ได้เลือกแหล่งคนทำงาน (คลิกเลือกแผนกหรือไลน์ด้านล่าง)
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                          {selectedSubLines.map(code => {
                            const item = allManpowerOptions.find(o => o.code === code);
                            const label = item ? item.displayName : code;
                            return (
                              <span
                                key={`chip-mp-${code}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-sm"
                              >
                                <span className="max-w-[220px] truncate" title={label}>{label}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleManpowerSource(code);
                                  }}
                                  className="hover:bg-emerald-700 rounded-full p-0.5 transition-colors shrink-0"
                                  title={`ยกเลิกเลือก ${label}`}
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Search Bar and Custom Input */}
                    <div className="flex flex-col sm:flex-row items-center gap-2 mt-1">
                      <div className="relative flex-1 w-full">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                        <input
                          type="text"
                          className="input input-xs input-bordered w-full pl-8 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
                          placeholder="ค้นหารหัสแผนกหรือชื่อ Cost Center / Line..."
                          value={manpowerSearch}
                          onChange={(e) => setManpowerSearch(e.target.value)}
                        />
                      </div>

                      <div className="flex items-center gap-1.5 w-full sm:w-auto">
                        <input
                          type="text"
                          className="input input-xs input-bordered rounded-lg text-xs flex-1 sm:w-48 font-semibold uppercase focus:outline-none focus:border-emerald-500"
                          placeholder="+ เพิ่มชื่อไลน์/Cost Center เอง..."
                          value={customManpowerInput}
                          onChange={(e) => setCustomManpowerInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddCustomManpower();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomManpower}
                          className="btn btn-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shrink-0 border-none"
                        >
                          + เพิ่ม
                        </button>
                      </div>
                    </div>

                    {/* Manpower Grid */}
                    <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pr-1 pt-1">
                      {filteredManpowerList.map((item) => {
                        const active = selectedSubLines.includes(item.code);
                        return (
                          <div
                            key={`mp-${item.code}`}
                            onClick={() => toggleManpowerSource(item.code)}
                            className={`p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all flex items-center justify-between select-none ${active
                              ? "bg-emerald-500 text-white border-emerald-500 shadow-sm ring-2 ring-emerald-300/50"
                              : "bg-base-100 border-base-300 hover:border-emerald-400 text-base-content/80"
                              }`}
                            title={item.displayName}
                          >
                            <span className="truncate mr-1.5 font-medium">{item.displayName}</span>
                            {active && <Check size={14} className="shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* STEP 3 / 4: LIVE MATRIX SIMULATION & VERIFY PREVIEW (8 DAYS) */}
              <div className={`p-3.5 rounded-2xl border border-base-200 bg-base-100 border-l-4 flex flex-col gap-2.5 ${lineType === "MACRO"
                ? "border-l-purple-500"
                : "border-l-blue-500"
                }`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider ${lineType === "MACRO" ? "text-purple-600" : "text-blue-600"
                    }`}>
                    <span className={`w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] ${lineType === "MACRO" ? "bg-purple-500" : "bg-blue-500"
                      }`}>
                      {lineType === "MACRO" ? "3" : "4"}
                    </span>
                    <span>
                      {lineType === "MACRO" ? "STEP 3: ตรวจสอบผลลัพธ์ MACRO ROLLUP" : "STEP 4: ตรวจสอบผลลัพธ์ (VERIFY PREVIEW)"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={fetchPreviewOutput}
                      disabled={previewLoading}
                      className="btn btn-xs btn-outline border-base-300 gap-1.5 hover:bg-base-200 text-[11px] font-bold cursor-pointer"
                      title="กดเพื่อรีเฟรชตรวจสอบข้อมูล 8 วันล่าสุด"
                    >
                      <RefreshCcw size={12} className={previewLoading ? "animate-spin text-primary" : ""} />
                      ตรวจสอบข้อมูล
                    </button>
                    <span className={`badge badge-sm font-bold text-[10px] whitespace-nowrap ${isHealthy ? 'badge-success text-white' : 'badge-warning text-amber-950'}`}>
                      {isHealthy ? 'Verified พร้อมใช้งาน' : 'ยังไม่พบข้อมูล'}
                    </span>
                  </div>
                </div>

                {/* Compact Essential Mini Matrix Table */}
                <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100 shadow-sm">
                  <table className="table table-xs w-full text-[11px]">
                    <thead>
                      <tr className="bg-base-200/80 text-base-content border-b border-base-300 font-bold">
                        <th className="sticky left-0 bg-base-200 z-10 py-1.5 px-3 font-bold min-w-[130px]">PARAMETER</th>
                        {previewDates.map(d => (
                          <th key={d} className="text-center py-1.5 px-2 border-l border-base-300/60 min-w-[55px] font-semibold">
                            <div className="text-[9px] text-base-content/60">{dayjs(d).format('ddd')}</div>
                            <div>{dayjs(d).format('DD/MM')}</div>
                          </th>
                        ))}
                        <th className={`sticky right-0 bg-base-200 z-10 text-center py-1.5 px-2.5 font-black min-w-[75px] border-l-2 ${lineType === "MACRO" ? "text-purple-600 border-purple-300" : "text-blue-600 border-blue-300"
                          }`}>Total / Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 1. Output */}
                      <tr className="border-b border-base-200/70 hover:bg-base-200/40 transition-colors">
                        <td className="sticky left-0 bg-base-100 font-bold text-rose-600 py-1 px-3">Piece_Output</td>
                        {previewDates.map(d => (
                          <td key={d} className="text-center font-medium text-base-content border-l border-base-200/50">
                            {simulation.pieceOutput[d] ? simulation.pieceOutput[d].toLocaleString() : "-"}
                          </td>
                        ))}
                        <td className="sticky right-0 bg-base-100 text-center font-black text-rose-600 border-l-2 border-base-300">
                          {simulation.summary.totalOutput ? simulation.summary.totalOutput.toLocaleString() : "-"}
                        </td>
                      </tr>

                      {/* 2. Man Hour */}
                      <tr className="border-b border-base-200/70 hover:bg-base-200/40 transition-colors">
                        <td className="sticky left-0 bg-base-100 font-bold text-sky-600 py-1 px-3">Total Man Hour</td>
                        {previewDates.map(d => (
                          <td key={d} className="text-center font-medium text-base-content border-l border-base-200/50">
                            {simulation.manHours[d] ? simulation.manHours[d].toFixed(1) : "-"}
                          </td>
                        ))}
                        <td className="sticky right-0 bg-base-100 text-center font-bold text-sky-600 border-l-2 border-base-300">
                          {simulation.summary.totalManHour ? simulation.summary.totalManHour.toFixed(1) : "-"}
                        </td>
                      </tr>

                      {/* 3. OP Register */}
                      <tr className="border-b border-base-200/70 hover:bg-base-200/40 transition-colors">
                        <td className="sticky left-0 bg-base-100 font-bold text-emerald-600 py-1 px-3">OP Register</td>
                        {previewDates.map(d => (
                          <td key={d} className="text-center font-medium text-base-content/80 border-l border-base-200/50">
                            {simulation.opRegister[d] || "-"}
                          </td>
                        ))}
                        <td className="sticky right-0 bg-base-100 text-center font-bold text-emerald-600 border-l-2 border-base-300">
                          {simulation.summary.avgRegister ? simulation.summary.avgRegister.toFixed(1) : "-"}
                        </td>
                      </tr>

                      {/* 4. Productivity */}
                      <tr className="hover:bg-primary/5 transition-colors bg-primary/[0.02]">
                        <td className={`sticky left-0 bg-base-100 font-black py-1.5 px-3 ${lineType === "MACRO" ? "text-purple-600" : "text-blue-600"
                          }`}>Productivity</td>
                        {previewDates.map(d => (
                          <td key={d} className={`text-center font-extrabold border-l border-base-200/50 ${lineType === "MACRO" ? "text-purple-600" : "text-blue-600"
                            }`}>
                            {simulation.productivity[d] ? simulation.productivity[d].toFixed(2) : "-"}
                          </td>
                        ))}
                        <td className={`sticky right-0 bg-base-100 text-center font-black border-l-2 ${lineType === "MACRO" ? "text-purple-600 border-purple-300" : "text-blue-600 border-blue-300"
                          }`}>
                          {simulation.summary.overallProductivity ? simulation.summary.overallProductivity.toFixed(2) : "-"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* FOOTER ACTIONS */}
              <div className="flex items-center justify-between pt-2 border-t border-base-300">
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn btn-sm btn-ghost text-base-content/60 font-semibold"
                >
                  ล้างฟอร์ม (Clear)
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-sm btn-ghost font-semibold px-4"
                  >
                    ยกเลิก (Cancel)
                  </button>
                  <button
                    type="submit"
                    disabled={saveLoading}
                    className={`btn btn-sm rounded-xl font-bold shadow-lg gap-2 border-none text-white ${lineType === "MACRO"
                      ? "bg-purple-500 hover:bg-purple-600 shadow-purple-400/25"
                      : "bg-blue-500 hover:bg-blue-600 shadow-blue-400/25"
                      }`}
                  >
                    {saveLoading ? (
                      <RefreshCcw size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    <span>{lineType === "MACRO" ? "บันทึก Macro Line" : "บันทึกไลน์ผลิต"}</span>
                  </button>
                </div>
              </div>

            </form>
          </div>

        </div>
      </div>
    </div>
  );
};

export default MacroLineBuilderModal;
