import React, { useState, useEffect, useMemo } from "react";
import {
  Eye,
  EyeOff,
  X,
  RotateCcw,
  Edit2,
  Save,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  ListOrdered,
  Search,
  Check,
  GripVertical
} from "lucide-react";
import {
  fetchCustomLineNames,
  saveCustomLineNames,
  fetchCustomLineOrder,
  saveCustomLineOrder,
  fetchTableVisibility,
  saveTableVisibility
} from "../../../../../utils/apiConfig";
import { getCachedCustomMacroLines, fetchCustomMacroLines } from "../../utils/customMacroStore";
import { fetchLineGroupsData } from "../../services/productivityApi";

const DEFAULT_TOGGLEABLE_TABLES = [
  // FPC Lines (Original sequence)
  { id: "Macro PCN", label: "Macro PCN", group: "FPC" },
  { id: "Macro FPC", label: "Macro FPC", group: "FPC" },
  { id: "Direct FPC", label: "Direct FPC", group: "FPC" },
  { id: "NPM_FPC", label: "NPM_FPC", group: "FPC" },
  { id: "LINE A", label: "LINE A", group: "FPC" },
  { id: "AT_Front", label: "AT_Front", group: "FPC" },
  { id: "AT_VAC", label: "AT_VAC", group: "FPC" },
  { id: "AT_LAM", label: "AT_LAM", group: "FPC" },
  { id: "LINE A_FINAL", label: "LINE A_FINAL", group: "FPC" },
  { id: "LINE B", label: "LINE B", group: "FPC" },
  { id: "LINE B_GEN", label: "LINE B_GEN", group: "FPC" },
  { id: "LINE B_NON", label: "LINE B_NON", group: "FPC" },
  { id: "LINE C", label: "LINE C", group: "FPC" },
  { id: "LINE D", label: "LINE D", group: "FPC" },
  { id: "LINE MAT", label: "LINE MAT", group: "FPC" },
  { id: "LINE LAM", label: "LINE LAM", group: "FPC" },
  { id: "LINE VAC & HPS", label: "LINE VAC & HPS", group: "FPC" },
  { id: "LINE VAC", label: "LINE VAC", group: "FPC" },
  { id: "LINE HPS", label: "LINE HPS", group: "FPC" },
  { id: "LINE BLK", label: "LINE BLK", group: "FPC" },
  { id: "LINE OST", label: "LINE OST", group: "FPC" },
  { id: "AVI/K2", label: "AVI/K2", group: "FPC" },
  { id: "MDS", label: "MDS", group: "FPC" },
  // SMT Lines
  { id: "Macro SMT", label: "Macro SMT", group: "SMT" },
  { id: "Macro SMT_F", label: "Macro SMT_F", group: "SMT" },
  { id: "Macro SMT_B", label: "Macro SMT_B", group: "SMT" },
  { id: "Direct SMT", label: "Direct SMT", group: "SMT" },
  { id: "SMT Front_Direct", label: "SMT FRONT_DIRECT", group: "SMT" },
  { id: "SMT BACK_DIRECT", label: "SMT BACK_DIRECT", group: "SMT" },
  // MOT Lines
  { id: "Automotive", label: "Automotive", group: "MOT" },
  { id: "MOTA_A", label: "MOTA_A", group: "MOT" },
  { id: "MOTA_G", label: "MOTA_G", group: "MOT" },
  { id: "MOTB", label: "MOTB", group: "MOT" },
  { id: "AIX-MOT", label: "AIX-MOT", group: "MOT" },
  { id: "MOTD", label: "MOTD", group: "MOT" },
  { id: "ASTP_A", label: "ASTP_A", group: "MOT" },
  { id: "ASTP_G", label: "ASTP_G", group: "MOT" },
  { id: "MAS", label: "MAS", group: "MOT" },
  { id: "REW", label: "REW", group: "MOT" },
  { id: "XRAY", label: "XRAY", group: "MOT" },
  { id: "LINE S_TECH_F", label: "LINE S_TECH_F", group: "MOT" },
  { id: "LINE S_TSTE_F", label: "LINE S_TSTE_F", group: "MOT" },
  { id: "MAS & REW", label: "MAS & REW", group: "MOT" },
  // ASSY Lines
  { id: "AIX-BLK", label: "AIX-BLK", group: "ASSY" },
  { id: "BLK-2", label: "BLK-2", group: "ASSY" },
  { id: "ASY1_A", label: "ASY1_A", group: "ASSY" },
  { id: "ASY1_G", label: "ASY1_G", group: "ASSY" },
  { id: "ASY2", label: "ASY2", group: "ASSY" },
  { id: "ASY3", label: "ASY3", group: "ASSY" },
  { id: "AIX-ASY", label: "AIX-ASY", group: "ASSY" },
  { id: "ASY5", label: "ASY5", group: "ASSY" },
  { id: "ASY6", label: "ASY6", group: "ASSY" },
  { id: "ASY7", label: "ASY7", group: "ASSY" },
  { id: "AELT", label: "AELT", group: "ASSY" },
  { id: "SMT_LAM", label: "SMT_LAM", group: "ASSY" },
  { id: "MD LAM", label: "MD LAM", group: "ASSY" },
  { id: "ASY SMT", label: "ASY SMT", group: "ASSY" },
  // INDIRECT Lines
  { id: "LINE S_IND", label: "LINE S_IND", group: "INDIRECT" },
  // QA Lines
  { id: "QA FPC", label: "QA FPC", group: "QA" },
  { id: "OQI_F-AUTO", label: "OQI_F-AUTO", group: "QA" },
  { id: "OQI_F-GEN", label: "OQI_F-GEN", group: "QA" },
  { id: "OQI_M", label: "OQI_M", group: "QA" },
  { id: "QA SMT", label: "QA SMT", group: "QA" },
  { id: "OQI_S-AUTO", label: "OQI_S-AUTO", group: "QA" },
  { id: "OQI_S-GEN", label: "OQI_S-GEN", group: "QA" },
];

type TableVisibilityModalProps = {
  isOpen: boolean;
  onClose: () => void;
  hiddenTables: string[];
  setHiddenTables: (tables: string[]) => void;
  availableLines?: string[];
};

export const TableVisibilityModal: React.FC<TableVisibilityModalProps> = ({
  isOpen,
  onClose,
  hiddenTables,
  setHiddenTables,
  availableLines,
}) => {
  const [activeTab, setActiveTab] = useState<"visibility" | "reorder">("visibility");
  const [customLineNames, setCustomLineNames] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("productivity_custom_line_names");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [lineOrder, setLineOrder] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("ALL");
  const [isSaving, setIsSaving] = useState(false);
  const [customMacros, setCustomMacros] = useState(getCachedCustomMacroLines);
  const [dynamicLineGroups, setDynamicLineGroups] = useState<any[]>([]);

  useEffect(() => {
    fetchCustomMacroLines().then(lines => {
      if (lines && lines.length > 0) setCustomMacros(lines);
    });

    const handleMacrosUpdated = (e: any) => {
      const updated = e?.detail || getCachedCustomMacroLines();
      setCustomMacros(updated);
    };

    window.addEventListener("custom-macros-updated", handleMacrosUpdated);
    return () => window.removeEventListener("custom-macros-updated", handleMacrosUpdated);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchLineGroupsData()
        .then(groups => {
          if (Array.isArray(groups)) {
            setDynamicLineGroups(groups.filter((g: any) => g.is_active !== false));
          }
        })
        .catch(err => console.error("Failed to fetch line groups for visibility modal:", err));
    }
  }, [isOpen]);

  // Combine default tables, custom macros, and dynamic line output mapping groups
  const allTables = useMemo(() => {
    const list = [...DEFAULT_TOGGLEABLE_TABLES];
    const macros = customMacros && customMacros.length > 0 ? customMacros : getCachedCustomMacroLines();
    const existingIds = new Set(list.map(t => t.id.trim().toUpperCase()));

    // 1. Add Custom Macro Lines
    macros.forEach(cm => {
      const upper = cm.macro_name.trim().toUpperCase();
      if (!existingIds.has(upper)) {
        existingIds.add(upper);
        list.push({
          id: cm.macro_name,
          label: cm.macro_name,
          group: "CUSTOM"
        });
      }
    });

    // 2. Add Dynamic Line Groups from Line Output Mapping (e.g. TF-2)
    dynamicLineGroups.forEach(g => {
      const gName = (g.group_name || "").trim();
      if (!gName) return;
      const upper = gName.toUpperCase();
      if (!existingIds.has(upper)) {
        existingIds.add(upper);
        list.push({
          id: gName,
          label: gName,
          group: g.factory || "FPC"
        });
      }
    });

    // 3. Add any active lines from availableLines / matrixData
    if (availableLines && availableLines.length > 0) {
      availableLines.forEach(line => {
        const trimmed = (line || "").trim();
        if (!trimmed) return;
        const upper = trimmed.toUpperCase();
        if (!existingIds.has(upper)) {
          existingIds.add(upper);
          list.push({
            id: trimmed,
            label: trimmed,
            group: "CUSTOM"
          });
        }
      });
    }

    return list;
  }, [customMacros, dynamicLineGroups, availableLines]);

  // Initialize line order
  useEffect(() => {
    if (isOpen) {
      fetchCustomLineNames().then((data) => {
        if (data && Object.keys(data).length > 0) {
          setCustomLineNames(data);
          try {
            localStorage.setItem("productivity_custom_line_names", JSON.stringify(data));
            window.dispatchEvent(new Event("line-names-updated"));
          } catch (e) {}
        }
      });

      fetchCustomLineOrder().then((savedOrder) => {
        if (savedOrder && savedOrder.length > 0) {
          // Merge with any new tables
          const orderSet = new Set(savedOrder.map(s => s.trim().toUpperCase()));
          const missing = allTables
            .filter(t => !orderSet.has(t.id.trim().toUpperCase()))
            .map(t => t.id);
          setLineOrder([...savedOrder, ...missing]);
        } else {
          setLineOrder(allTables.map(t => t.id));
        }
      });
    }
  }, [isOpen, allTables]);

  const handleSaveCustomName = async (id: string) => {
    const updated = { ...customLineNames };
    if (editingValue.trim() && editingValue.trim() !== id) {
      updated[id] = editingValue.trim();
    } else {
      delete updated[id];
    }
    setCustomLineNames(updated);
    try {
      localStorage.setItem("productivity_custom_line_names", JSON.stringify(updated));
      window.dispatchEvent(new Event("line-names-updated"));
    } catch (e) {}
    setEditingId(null);

    await saveCustomLineNames(updated);
  };

  const handleResetAllNames = async () => {
    setCustomLineNames({});
    try {
      localStorage.removeItem("productivity_custom_line_names");
      window.dispatchEvent(new Event("line-names-updated"));
    } catch (e) {}

    await saveCustomLineNames({});
  };

  const handleMoveUp = (id: string) => {
    setLineOrder(prev => {
      const idx = prev.findIndex(item => item.trim().toUpperCase() === id.trim().toUpperCase());
      if (idx <= 0) return prev;
      const next = [...prev];
      const temp = next[idx - 1];
      next[idx - 1] = next[idx];
      next[idx] = temp;
      return next;
    });
  };

  const handleMoveDown = (id: string) => {
    setLineOrder(prev => {
      const idx = prev.findIndex(item => item.trim().toUpperCase() === id.trim().toUpperCase());
      if (idx === -1 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      const temp = next[idx + 1];
      next[idx + 1] = next[idx];
      next[idx] = temp;
      return next;
    });
  };

  const handleMoveToTop = (id: string) => {
    setLineOrder(prev => {
      const idx = prev.findIndex(item => item.trim().toUpperCase() === id.trim().toUpperCase());
      if (idx <= 0) return prev;
      const item = prev[idx];
      const next = prev.filter((_, i) => i !== idx);
      return [item, ...next];
    });
  };

  const handleMoveToBottom = (id: string) => {
    setLineOrder(prev => {
      const idx = prev.findIndex(item => item.trim().toUpperCase() === id.trim().toUpperCase());
      if (idx === -1 || idx >= prev.length - 1) return prev;
      const item = prev[idx];
      const next = prev.filter((_, i) => i !== idx);
      return [...next, item];
    });
  };

  // Drag & Drop State and Handlers (Insert Above / Below)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"above" | "below" | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItemId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos: "above" | "below" = e.clientY < midY ? "above" : "below";
    setDropPosition(pos);
    if (dragOverItemId !== targetId) {
      setDragOverItemId(targetId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const pos = dropPosition || "above";
    setDragOverItemId(null);
    setDropPosition(null);

    if (!draggedItemId || draggedItemId.trim().toUpperCase() === targetId.trim().toUpperCase()) {
      setDraggedItemId(null);
      return;
    }

    setLineOrder(prev => {
      const currentList = allOrderedItems.map(x => x.id);
      const sourceIdx = currentList.findIndex(x => x.trim().toUpperCase() === draggedItemId.trim().toUpperCase());
      if (sourceIdx === -1) return prev;

      const nextList = [...currentList];
      const [moved] = nextList.splice(sourceIdx, 1);

      const targetIdx = nextList.findIndex(x => x.trim().toUpperCase() === targetId.trim().toUpperCase());
      if (targetIdx === -1) return prev;

      const insertIndex = pos === "above" ? targetIdx : targetIdx + 1;
      nextList.splice(insertIndex, 0, moved);
      return nextList;
    });

    setDraggedItemId(null);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDragOverItemId(null);
    setDropPosition(null);
  };

  const handleResetOrder = async () => {
    const defaultOrder = allTables.map(t => t.id);
    setLineOrder(defaultOrder);
    await saveCustomLineOrder(defaultOrder);
  };

  const handleSaveAndClose = async () => {
    setIsSaving(true);
    try {
      if (editingId) {
        const updated = { ...customLineNames };
        if (editingValue.trim() && editingValue.trim() !== editingId) {
          updated[editingId] = editingValue.trim();
        } else {
          delete updated[editingId];
        }
        setCustomLineNames(updated);
        try {
          localStorage.setItem("productivity_custom_line_names", JSON.stringify(updated));
          window.dispatchEvent(new Event("line-names-updated"));
        } catch (e) {}
        setEditingId(null);
        await saveCustomLineNames(updated);
      } else {
        await saveCustomLineNames(customLineNames);
      }

      if (lineOrder.length > 0) {
        await saveCustomLineOrder(lineOrder);
      }

      await saveTableVisibility(hiddenTables);
    } finally {
      setIsSaving(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  const isTableHidden = (id: string) => hiddenTables.includes(id);

  const toggleTable = (id: string) => {
    if (isTableHidden(id)) {
      setHiddenTables(hiddenTables.filter(t => t !== id));
    } else {
      setHiddenTables([...hiddenTables, id]);
    }
  };

  const handleShowAll = () => {
    setHiddenTables([]);
  };

  const handleResetDefault = () => {
    setHiddenTables(["LINE S_IND"]);
    handleResetAllNames();
    handleResetOrder();
  };

  // Build sorted items based on current lineOrder
  const orderedItemList = () => {
    const tableMap = new Map(allTables.map(t => [t.id.trim().toUpperCase(), t]));
    const list: typeof allTables = [];

    lineOrder.forEach(id => {
      const match = tableMap.get(id.trim().toUpperCase());
      if (match) {
        list.push(match);
        tableMap.delete(id.trim().toUpperCase());
      }
    });

    // Add remaining
    tableMap.forEach(item => list.push(item));
    return list;
  };

  const allOrderedItems = orderedItemList();

  const filteredOrderedItems = allOrderedItems.filter(item => {
    const customName = customLineNames[item.id] || customLineNames[item.id.toUpperCase()] || "";
    const matchesSearch = searchQuery === "" ||
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGroup = selectedGroupFilter === "ALL" || item.group === selectedGroupFilter;
    return matchesSearch && matchesGroup;
  });

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-base-100 rounded-2xl shadow-2xl border border-base-300 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-base-content">
        
        {/* Header */}
        <div className="p-5 border-b border-base-300 flex items-center justify-between bg-base-200/50">
          <div>
            <h2 className="text-lg font-bold text-base-content">
              จัดการตารางและจัดลำดับไลน์ (Table Visibility & Reorder)
            </h2>
            <p className="text-xs text-base-content/60 mt-0.5">
              {activeTab === "visibility"
                ? "เลือกซ่อน/แสดงตาราง หรือกดแก้ไขเพื่อเปลี่ยนชื่อเรียก"
                : "ลากเลื่อน (Drag & Drop) หรือกดลูกศรขึ้น-ลง เพื่อปรับลำดับแถวในตารางและไฟล์ Export Excel"}
            </p>
          </div>
          <button
            onClick={handleSaveAndClose}
            className="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content hover:bg-base-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher & Action Toolbar */}
        <div className="px-5 py-2.5 border-b border-base-300 flex flex-wrap items-center justify-between gap-3 bg-base-100 text-xs">
          {/* Tabs */}
          <div className="flex bg-base-200/80 p-1 rounded-xl border border-base-300 gap-1">
            <button
              onClick={() => setActiveTab("visibility")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                activeTab === "visibility"
                  ? "bg-base-100 text-primary shadow-sm border border-base-300/50"
                  : "text-base-content/70 hover:text-base-content hover:bg-base-200"
              }`}
            >
              <Eye size={14} />
              Table Visibility
            </button>
            <button
              onClick={() => setActiveTab("reorder")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                activeTab === "reorder"
                  ? "bg-base-100 text-primary shadow-sm border border-base-300/50"
                  : "text-base-content/70 hover:text-base-content hover:bg-base-200"
              }`}
            >
              <ListOrdered size={14} />
              Reorder Lines
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {activeTab === "visibility" ? (
              <>
                <span className="text-base-content/70 font-medium hidden sm:inline mr-2">
                  ซ่อนอยู่: <strong className="text-primary font-bold">{hiddenTables.length}</strong> ตาราง
                </span>
                <button
                  onClick={handleShowAll}
                  className="btn btn-xs btn-primary btn-outline gap-1.5 rounded-lg font-semibold"
                >
                  <Eye size={13} />
                  แสดงทั้งหมด
                </button>
              </>
            ) : (
              <button
                onClick={handleResetOrder}
                className="btn btn-xs btn-ghost gap-1.5 rounded-lg text-base-content/70 hover:bg-base-200 font-semibold"
                title="คืนค่าการจัดเรียงเป็นลำดับเริ่มต้น"
              >
                <RotateCcw size={13} />
                รีเซ็ตลำดับเริ่มต้น
              </button>
            )}

            <button
              onClick={handleResetDefault}
              className="btn btn-xs btn-ghost gap-1.5 rounded-lg text-base-content/70 hover:bg-base-200 font-semibold"
            >
              <RotateCcw size={13} />
              รีเซ็ตทั้งหมด
            </button>
          </div>
        </div>

        {/* Filter Toolbar (Search & Group Filter) */}
        <div className="px-5 py-2.5 border-b border-base-200 flex flex-wrap items-center justify-between gap-3 bg-base-200/30">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input
              type="text"
              placeholder="ค้นหาชื่อไลน์..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-xs input-bordered w-full pl-8 rounded-lg bg-base-100 focus:input-primary text-xs"
            />
          </div>

          {/* Group Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
            {["ALL", "SMT", "MOT", "ASSY", "FPC", "QA", "CUSTOM"].map(groupKey => (
              <button
                key={groupKey}
                onClick={() => setSelectedGroupFilter(groupKey)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  selectedGroupFilter === groupKey
                    ? "bg-primary text-primary-content"
                    : "bg-base-200 hover:bg-base-300 text-base-content/70"
                }`}
              >
                {groupKey}
              </button>
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === "visibility" ? (
            /* TAB 1: VISIBILITY & RENAME */
            <div className="space-y-6">
              {["SMT", "MOT", "ASSY", "QA", "INDIRECT", "FPC", "CUSTOM"].map(groupKey => {
                const groupTables = allOrderedItems.filter(t => {
                  const matchesGroup = t.group === groupKey;
                  if (!matchesGroup) return false;
                  if (selectedGroupFilter !== "ALL" && selectedGroupFilter !== groupKey) return false;

                  const customName = customLineNames[t.id] || customLineNames[t.id.toUpperCase()] || "";
                  return searchQuery === "" ||
                    t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    customName.toLowerCase().includes(searchQuery.toLowerCase());
                });

                if (groupTables.length === 0) return null;

                return (
                  <div key={groupKey} className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/50">
                        หมวดหมู่: {groupKey} ({groupTables.length})
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {groupTables.map(item => {
                        const hidden = isTableHidden(item.id);
                        const customName = customLineNames[item.id] || customLineNames[item.id.toUpperCase()];
                        const displayLabel = customName || item.label;
                        const isEditing = editingId === item.id;

                        return (
                          <div
                            key={item.id}
                            onClick={(e) => {
                              if (isEditing) return;
                              toggleTable(item.id);
                            }}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${hidden
                              ? "bg-base-200/40 border-base-300 text-base-content/40 hover:bg-base-200/80 hover:text-base-content/70"
                              : "bg-primary/5 border-primary/30 text-base-content shadow-sm hover:border-primary/50"
                              }`}
                          >
                            <div className="flex items-center gap-2.5 flex-1 mr-2 min-w-0">
                              <span
                                className={`p-1.5 rounded-lg transition-colors shrink-0 ${hidden
                                  ? "bg-base-300 text-base-content/40"
                                  : "bg-primary text-primary-content"
                                  }`}
                              >
                                {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                              </span>

                              {isEditing ? (
                                <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    className="input input-xs input-bordered w-full font-semibold focus:input-primary text-base-content"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSaveCustomName(item.id);
                                      if (e.key === "Escape") setEditingId(null);
                                    }}
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveCustomName(item.id)}
                                    className="btn btn-xs btn-primary shrink-0 gap-1 font-bold text-white px-2"
                                    title="บันทึก"
                                  >
                                    <Save size={14} className="text-white stroke-[2.5]" />
                                    <span>บันทึก</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <span className={`text-sm font-semibold truncate ${hidden ? "line-through opacity-50" : "text-base-content"}`}>
                                    {displayLabel}
                                  </span>
                                  {customName && (
                                    <span className="text-[10px] font-normal opacity-50 shrink-0">({item.id})</span>
                                  )}
                                  {customName && (
                                    <span className="badge badge-xs bg-primary/20 text-primary border-none font-bold shrink-0">custom</span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingId(item.id);
                                      setEditingValue(displayLabel);
                                    }}
                                    className="btn btn-xs btn-ghost btn-circle text-base-content/40 hover:text-primary hover:bg-base-200 shrink-0"
                                    title="แก้ไขชื่อแสดงผล"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                </div>
                              )}
                            </div>

                            <input
                              type="checkbox"
                              className="toggle toggle-primary toggle-sm pointer-events-none shrink-0"
                              checked={!hidden}
                              readOnly
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* TAB 2: REORDER ROWS */
            <div className="space-y-2">
              <div className="text-xs text-base-content/60 pb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <GripVertical size={14} className="text-primary" />
                  <span>สามารถ<strong>คลิกลากแถว (Drag & Drop)</strong> หรือกดลูกศร เพื่อสลับตำแหน่ง:</span>
                </span>
                <span className="font-semibold text-primary">{filteredOrderedItems.length} รายการ</span>
              </div>

              <div className="space-y-1.5">
                {filteredOrderedItems.map((item) => {
                  const globalIndex = allOrderedItems.findIndex(x => x.id === item.id);
                  const hidden = isTableHidden(item.id);
                  const customName = customLineNames[item.id] || customLineNames[item.id.toUpperCase()];
                  const displayLabel = customName || item.label;
                  const isDragging = draggedItemId?.trim().toUpperCase() === item.id.trim().toUpperCase();
                  const isDragOver = dragOverItemId?.trim().toUpperCase() === item.id.trim().toUpperCase();

                  return (
                    <div
                      key={item.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onDragOver={(e) => handleDragOver(e, item.id)}
                      onDragLeave={() => {
                        if (dragOverItemId?.trim().toUpperCase() === item.id.trim().toUpperCase()) {
                          setDragOverItemId(null);
                          setDropPosition(null);
                        }
                      }}
                      onDrop={(e) => handleDrop(e, item.id)}
                      onDragEnd={handleDragEnd}
                      className={`relative flex items-center justify-between p-2.5 px-3.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${
                        isDragging
                          ? "opacity-30 scale-[0.98] border-dashed border-primary bg-primary/10 shadow-inner"
                          : isDragOver
                          ? dropPosition === "above"
                            ? "border-t-4 border-t-primary border-base-300 bg-primary/10 shadow-md scale-[1.01]"
                            : "border-b-4 border-b-primary border-base-300 bg-primary/10 shadow-md scale-[1.01]"
                          : hidden
                          ? "bg-base-200/30 border-base-300/60 opacity-60"
                          : "bg-base-100 border-base-300 hover:border-primary/40 shadow-xs"
                      }`}
                    >
                      {/* Insertion Indicator Badge */}
                      {isDragOver && (
                        <div
                          className={`absolute left-8 z-30 badge badge-xs bg-primary text-primary-content font-bold shadow-md animate-pulse ${
                            dropPosition === "above" ? "-top-2.5" : "-bottom-2.5"
                          }`}
                        >
                          {dropPosition === "above" ? "แทรกด้านบน ↑" : "แทรกด้านล่าง ↓"}
                        </div>
                      )}

                      {/* Left: Drag Handle, Position Badge & Label */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="text-base-content/30 hover:text-primary transition-colors cursor-grab active:cursor-grabbing shrink-0" title="คลิกค้างแล้วลากเพื่อเปลี่ยนลำดับ">
                          <GripVertical size={16} />
                        </div>
                        <span className="w-7 h-7 rounded-lg bg-base-200 flex items-center justify-center text-xs font-mono font-bold text-base-content/70 shrink-0 border border-base-300">
                          {globalIndex + 1}
                        </span>

                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`text-xs font-bold truncate ${hidden ? "line-through opacity-50" : "text-base-content"}`}>
                            {displayLabel}
                          </span>
                          {customName && (
                            <span className="text-[10px] opacity-40 truncate">({item.id})</span>
                          )}
                          <span className="badge badge-xs badge-ghost text-[10px] font-semibold uppercase px-1.5 py-0.5 shrink-0">
                            {item.group}
                          </span>
                          {hidden && (
                            <span className="badge badge-xs bg-rose-500/10 text-rose-600 border-none font-bold text-[10px] shrink-0">
                              ซ่อนอยู่
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Move Controls */}
                      <div className="flex items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleMoveToTop(item.id)}
                          disabled={globalIndex === 0}
                          className="btn btn-xs btn-ghost btn-square rounded-lg text-base-content/60 hover:text-primary hover:bg-base-200 disabled:opacity-20"
                          title="เลื่อนขึ้นบนสุด"
                        >
                          <ChevronsUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveUp(item.id)}
                          disabled={globalIndex === 0}
                          className="btn btn-xs btn-ghost btn-square rounded-lg text-base-content/60 hover:text-primary hover:bg-base-200 disabled:opacity-20"
                          title="เลื่อนขึ้น 1 ตำแหน่ง"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(item.id)}
                          disabled={globalIndex === allOrderedItems.length - 1}
                          className="btn btn-xs btn-ghost btn-square rounded-lg text-base-content/60 hover:text-primary hover:bg-base-200 disabled:opacity-20"
                          title="เลื่อนลง 1 ตำแหน่ง"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveToBottom(item.id)}
                          disabled={globalIndex === allOrderedItems.length - 1}
                          className="btn btn-xs btn-ghost btn-square rounded-lg text-base-content/60 hover:text-primary hover:bg-base-200 disabled:opacity-20"
                          title="เลื่อนลงล่างสุด"
                        >
                          <ChevronsDown size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-base-300 bg-base-200/50 flex items-center justify-between">
          <span className="text-xs text-base-content/60">
            บันทึกการจัดเรียงและการเปิด-ปิดตารางลงฐานข้อมูลกลางทั้งระบบอัตโนมัติ
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="btn btn-sm btn-ghost rounded-xl"
            >
              ยกเลิก (Cancel)
            </button>
            <button
              onClick={handleSaveAndClose}
              disabled={isSaving}
              className="btn btn-sm btn-primary px-6 rounded-xl font-bold shadow-lg shadow-primary/20 gap-1.5"
            >
              <Check size={16} />
              บันทึกและปิด (Done)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
