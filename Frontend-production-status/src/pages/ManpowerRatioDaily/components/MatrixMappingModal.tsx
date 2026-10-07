import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  Search,
  Settings2,
  BookOpen,
  Languages,
  HelpCircle,
  ArrowUpDown,
  Info,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import Swal from "sweetalert2";
import { API_BASE_URL } from "../../Manpower/constants";

interface MatrixMappingItem {
  id: number;
  group_name: string;
  dept_name: string;
  coc_code: string;
  keywords: string[];
  order_seq: number;
  is_active: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const GROUPS = ["INDIRECT", "QA", "FPC", "SMT_F", "SMT_B", "MDS"];

type Lang = "th" | "en";

export const MatrixMappingModal: React.FC<Props> = ({ isOpen, onClose, onSaved }) => {
  const [lang, setLang] = useState<Lang>("th");
  const [showGuide, setShowGuide] = useState(false);
  const [items, setItems] = useState<MatrixMappingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");

  // State สำหรับแถวที่กำลังแก้ไข
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editGroup, setEditGroup] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editCoc, setEditCoc] = useState("");
  const [editOrderSeq, setEditOrderSeq] = useState<number>(0);
  const [editKeywords, setEditKeywords] = useState<string[]>([]);
  const [newKeywordInput, setNewKeywordInput] = useState("");

  // State สำหรับสร้างแถวใหม่
  const [showAddForm, setShowAddForm] = useState(false);
  const [newGroup, setNewGroup] = useState("SMT_B");
  const [newDept, setNewDept] = useState("");
  const [newCoc, setNewCoc] = useState("");
  const [newKeywords, setNewKeywords] = useState<string[]>([]);
  const [addKeywordInput, setAddKeywordInput] = useState("");

  const t = {
    th: {
      title: "ตั้งค่า Mapping แผนกและไลน์ (Daily Matrix)",
      subtitle: "เพิ่ม/แก้ไขคำค้นหาชื่อไลน์ หรือเพิ่มแถวไลน์ใหม่ โดยระบบจะบันทึกในฐานข้อมูลอัตโนมัติ",
      guideBtn: "คู่มือการใช้งาน",
      guideTitle: "📖 คู่มือการตั้งค่า Keyword และลำดับการจับคู่ไลน์ (Mapping Guide)",
      searchPlaceholder: "ค้นหาแผนก, COC, หรือ Keyword...",
      allGroups: "ทั้งหมด",
      addNewBtn: "เพิ่มแถวใหม่",
      closeForm: "ปิดฟอร์ม",
      newRowTitle: "➕ เพิ่มแถวแผนกใหม่ในตาราง",
      groupLabel: "กลุ่มหลัก (Group)",
      deptLabel: "ชื่อแผนก/แถว (Dept)",
      cocLabel: "Cost Center (COC)",
      saveNewBtn: "บันทึกแถวใหม่",
      orderSeqLabel: "ลำดับการประเมิน (Order Seq):",
      keywordsLabel: "คำค้นหา (Keywords):",
      addKeywordPlaceholder: "พิมพ์ Keyword แล้วกด Enter",
      addBtn: "เพิ่ม",
      cancelBtn: "ยกเลิก",
      saveChangesBtn: "บันทึกการเปลี่ยนแปลง",
      editBtn: "แก้ไข",
      deleteBtn: "ลบ",
      totalRows: (count: number) => `พบทั้งหมด ${count} แถวในตาราง Daily Matrix`,
      closeBtn: "ปิดหน้าต่าง",
      loading: "กำลังโหลดข้อมูล Mapping...",
      noData: "ไม่พบข้อมูลที่ตรงกับการค้นหา",
      confirmDeleteTitle: "ยืนยันการลบ?",
      confirmDeleteText: (dept: string) => `คุณต้องการลบแถว "${dept}" ออกจากตาราง Daily Matrix ใช่หรือไม่?`,
      confirmDeleteBtn: "ใช่, ลบเลย",
      cancelDeleteBtn: "ยกเลิก",
      saveSuccess: "บันทึกสำเร็จ",
      deleteSuccess: "ลบแถวสำเร็จ",
      addSuccess: "เพิ่มแถวใหม่สำเร็จ",
      errorTitle: "ข้อผิดพลาด",
      rule1Title: "1. ลำดับการประเมิน (Order Sequence)",
      rule1Desc: "ระบบจะตรวจจับแถวที่มีตัวเลขลำดับ (Order Seq) น้อยก่อนเสมอ แถวที่มีชื่อเฉพาะเจาะจง (เช่น AIX-MOT, LAM MD, LINE A) ควรมีลำดับก่อนแถวกว้างๆ (เช่น MOT, LAM, BLK) เพื่อป้องกันคนหลุดเข้าผิดแถว",
      rule2Title: "2. คำค้นหา (Keywords)",
      rule2Desc: "สามารถใส่คำหรือข้อความที่ปรากฏใน Department, Line หรือ Cost Center (ระบบไม่สนตัวพิมพ์เล็ก-ใหญ่) แนะนำให้ใช้รหัส COC เช่น P282, P540 หรือชื่อไลน์ เช่น ASY1_A",
      rule3Title: "3. ระบบบันทึกสดลง Database Test",
      rule3Desc: "ทุกการแก้ไขจะถูกเซฟลงตาราง daily_matrix_line_mappings ในฐานข้อมูลกลางของโรงงานทันที ทำให้ทุกคนที่เปิดดูเห็นข้อมูลตรงกัน",
    },
    en: {
      title: "Department & Line Mappings Configuration (Daily Matrix)",
      subtitle: "Add/edit line keywords or create new lines. Changes are saved to Database Test automatically.",
      guideBtn: "User Guide",
      guideTitle: "📖 Line Mapping & Keyword Configuration Guide",
      searchPlaceholder: "Search department, COC, or keyword...",
      allGroups: "ALL",
      addNewBtn: "Add New Row",
      closeForm: "Close Form",
      newRowTitle: "➕ Add New Department / Machine Line",
      groupLabel: "Main Group",
      deptLabel: "Dept / Line Name",
      cocLabel: "Cost Center (COC)",
      saveNewBtn: "Save New Line",
      orderSeqLabel: "Evaluation Priority (Order Seq):",
      keywordsLabel: "Matching Keywords:",
      addKeywordPlaceholder: "Type keyword & press Enter",
      addBtn: "Add",
      cancelBtn: "Cancel",
      saveChangesBtn: "Save Changes",
      editBtn: "Edit",
      deleteBtn: "Delete",
      totalRows: (count: number) => `Total ${count} rows found in Daily Matrix table`,
      closeBtn: "Close",
      loading: "Loading line mappings...",
      noData: "No mapping items found matching search.",
      confirmDeleteTitle: "Confirm Delete?",
      confirmDeleteText: (dept: string) => `Are you sure you want to remove "${dept}" from Daily Matrix?`,
      confirmDeleteBtn: "Yes, delete",
      cancelDeleteBtn: "Cancel",
      saveSuccess: "Saved successfully",
      deleteSuccess: "Deleted successfully",
      addSuccess: "Added new line successfully",
      errorTitle: "Error",
      rule1Title: "1. Evaluation Priority (Order Sequence)",
      rule1Desc: "Rows with smaller Order Seq numbers are evaluated first. Specific line names (e.g. AIX-MOT, LAM MD, LINE A) should be placed before generic names (e.g. MOT, LAM, BLK) to prevent misattribution.",
      rule2Title: "2. Matching Keywords",
      rule2Desc: "Add any substring matching employee Department, Line name, or Cost Center Code (case-insensitive). It is recommended to use COC codes (e.g. P282) or specific line names (e.g. ASY1_A).",
      rule3Title: "3. Live Storage in Database Test",
      rule3Desc: "All adjustments are persisted in daily_matrix_line_mappings table in PostgreSQL Test database immediately for all users.",
    }
  }[lang];

  const loadMappings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/mh/dept_summary/matrix_mapping`);
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        setItems(json.data);
      }
    } catch (err) {
      console.error("Failed to load mappings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMappings();
      setEditingId(null);
      setShowAddForm(false);
    }
  }, [isOpen]);

  // เริ่มแก้ไขแถว
  const startEdit = (item: MatrixMappingItem) => {
    setEditingId(item.id);
    setEditGroup(item.group_name);
    setEditDept(item.dept_name);
    setEditCoc(item.coc_code || "");
    setEditOrderSeq(item.order_seq || 0);
    setEditKeywords([...(item.keywords || [])]);
    setNewKeywordInput("");
  };

  // บันทึกแถวที่กำลังแก้ไข
  const saveEdit = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/mh/dept_summary/matrix_mapping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          group_name: editGroup,
          dept_name: editDept,
          coc_code: editCoc,
          order_seq: editOrderSeq,
          keywords: editKeywords,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        Swal.fire({ icon: "success", title: t.saveSuccess, timer: 1200, showConfirmButton: false });
        setEditingId(null);
        await loadMappings();
        onSaved();
      } else {
        Swal.fire(t.errorTitle, json.error || "Failed", "error");
      }
    } catch (e: any) {
      Swal.fire(t.errorTitle, e.message, "error");
    }
  };

  // ลบแถว
  const deleteItem = async (item: MatrixMappingItem) => {
    const result = await Swal.fire({
      title: t.confirmDeleteTitle,
      text: t.confirmDeleteText(item.dept_name),
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: t.confirmDeleteBtn,
      cancelButtonText: t.cancelDeleteBtn,
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`${API_BASE_URL}/mh/dept_summary/matrix_mapping/${item.id}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (json.ok) {
          Swal.fire({ icon: "success", title: t.deleteSuccess, timer: 1200, showConfirmButton: false });
          await loadMappings();
          onSaved();
        }
      } catch (e: any) {
        Swal.fire(t.errorTitle, e.message, "error");
      }
    }
  };

  // เพิ่มแถวใหม่
  const handleAddNew = async () => {
    if (!newDept.trim()) {
      Swal.fire(t.errorTitle, lang === "th" ? "กรุณาระบุชื่อแผนก/ไลน์" : "Please specify line name", "warning");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/mh/dept_summary/matrix_mapping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_name: newGroup,
          dept_name: newDept.trim(),
          coc_code: newCoc.trim(),
          keywords: newKeywords,
          order_seq: items.length + 1,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        Swal.fire({ icon: "success", title: t.addSuccess, timer: 1200, showConfirmButton: false });
        setShowAddForm(false);
        setNewDept("");
        setNewCoc("");
        setNewKeywords([]);
        await loadMappings();
        onSaved();
      }
    } catch (e: any) {
      Swal.fire(t.errorTitle, e.message, "error");
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.dept_name.toLowerCase().includes(search.toLowerCase()) ||
        item.coc_code.toLowerCase().includes(search.toLowerCase()) ||
        item.group_name.toLowerCase().includes(search.toLowerCase()) ||
        (item.keywords || []).some((k) => k.toLowerCase().includes(search.toLowerCase()));

      const matchesGroup = selectedGroup === "ALL" || item.group_name === selectedGroup;
      return matchesSearch && matchesGroup;
    });
  }, [items, search, selectedGroup]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-800 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/20 p-2.5 backdrop-blur-md shadow-inner">
              <Settings2 size={22} className="text-blue-100" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">{t.title}</h2>
              <p className="text-xs text-blue-200 mt-0.5">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <button
              onClick={() => setLang(lang === "th" ? "en" : "th")}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/25 border border-white/20 px-3 py-1.5 text-xs font-black text-white transition cursor-pointer"
              title="สลับภาษา ไทย / English"
            >
              <Languages size={15} />
              <span>{lang === "th" ? "TH 🇹🇭" : "EN 🇺🇸"}</span>
            </button>

            {/* Guide Button */}
            <button
              onClick={() => setShowGuide(!showGuide)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer border ${
                showGuide
                  ? "bg-amber-400 text-slate-950 border-amber-300 shadow-md font-extrabold"
                  : "bg-white/10 hover:bg-white/25 border-white/20 text-white"
              }`}
            >
              <BookOpen size={15} />
              <span>{t.guideBtn}</span>
              {showGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            <button
              onClick={onClose}
              className="rounded-full p-2 text-white/80 hover:bg-white/20 hover:text-white transition cursor-pointer ml-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Collapsible User Guide */}
        {showGuide && (
          <div className="border-b border-amber-200/60 bg-gradient-to-br from-amber-50 via-orange-50/40 to-yellow-50/50 p-5 text-slate-800 animate-in slide-in-from-top-3 duration-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-amber-950 flex items-center gap-2">
                <Sparkles size={16} className="text-amber-600" />
                {t.guideTitle}
              </h3>
              <button
                onClick={() => setShowGuide(false)}
                className="text-xs font-bold text-amber-700 hover:text-amber-900 cursor-pointer"
              >
                ✕ ปิดคู่มือ
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
              <div className="rounded-2xl border border-amber-200/80 bg-white/80 p-3.5 shadow-xs">
                <div className="font-black text-amber-900 mb-1 flex items-center gap-1.5">
                  <ArrowUpDown size={15} className="text-amber-600" />
                  {t.rule1Title}
                </div>
                <p className="text-slate-600 leading-relaxed">{t.rule1Desc}</p>
              </div>

              <div className="rounded-2xl border border-amber-200/80 bg-white/80 p-3.5 shadow-xs">
                <div className="font-black text-amber-900 mb-1 flex items-center gap-1.5">
                  <Layers size={15} className="text-amber-600" />
                  {t.rule2Title}
                </div>
                <p className="text-slate-600 leading-relaxed">{t.rule2Desc}</p>
              </div>

              <div className="rounded-2xl border border-amber-200/80 bg-white/80 p-3.5 shadow-xs">
                <div className="font-black text-amber-900 mb-1 flex items-center gap-1.5">
                  <Check size={15} className="text-emerald-600" />
                  {t.rule3Title}
                </div>
                <p className="text-slate-600 leading-relaxed">{t.rule3Desc}</p>
              </div>
            </div>
          </div>
        )}

        {/* Toolbar: Search, Filters, Add button */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-6 py-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Filter by Group */}
            <div className="flex items-center gap-1 overflow-x-auto py-1">
              {["ALL", ...GROUPS].map((grp) => (
                <button
                  key={grp}
                  onClick={() => setSelectedGroup(grp)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-black transition cursor-pointer ${
                    selectedGroup === grp
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200"
                  }`}
                >
                  {grp === "ALL" ? t.allGroups : grp}
                </button>
              ))}
            </div>
          </div>

          {/* Add New Row Button */}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            <span>{showAddForm ? t.closeForm : t.addNewBtn}</span>
          </button>
        </div>

        {/* Form เพิ่มแถวใหม่ */}
        {showAddForm && (
          <div className="border-b border-emerald-100 bg-emerald-50/50 p-4 animate-in slide-in-from-top-2 duration-200">
            <h3 className="text-xs font-black text-emerald-900 mb-2">{t.newRowTitle}</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">{t.groupLabel}</label>
                <select
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold"
                >
                  {GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">{t.deptLabel}</label>
                <input
                  type="text"
                  placeholder="เช่น ASY4 หรือ MAT2"
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">{t.cocLabel}</label>
                <input
                  type="text"
                  placeholder="เช่น P500 หรือเว้นว่าง"
                  value={newCoc}
                  onChange={(e) => setNewCoc(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAddNew}
                  className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-1.5 text-xs font-black text-white shadow-xs transition cursor-pointer"
                >
                  {t.saveNewBtn}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-slate-400 font-bold text-sm">
              {t.loading}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-slate-400 font-bold text-sm">
              {t.noData}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              {filteredItems.map((item) => {
                const isEditing = editingId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`p-3.5 transition-colors ${
                      isEditing ? "bg-blue-50/80 border-l-4 border-l-blue-600" : "hover:bg-slate-50/80"
                    }`}
                  >
                    {!isEditing ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-[210px]">
                          <span className="w-7 text-center font-mono text-[10px] font-bold text-slate-400">
                            #{item.order_seq || item.id}
                          </span>
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-700">
                            {item.group_name}
                          </span>
                          <span className="text-sm font-black text-slate-900">{item.dept_name}</span>
                          {item.coc_code && (
                            <span className="rounded bg-sky-100 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-800">
                              {item.coc_code}
                            </span>
                          )}
                        </div>

                        {/* Keyword Chips */}
                        <div className="flex-1 flex flex-wrap items-center gap-1.5">
                          {(item.keywords || []).map((kw, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700 font-mono"
                            >
                              {kw}
                            </span>
                          ))}
                          {(!item.keywords || item.keywords.length === 0) && (
                            <span className="text-[11px] text-slate-400 italic">
                              {lang === "th" ? "ใช้ชื่อแผนกหลักในการจับคู่" : "Matching with default department name"}
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => startEdit(item)}
                            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition cursor-pointer"
                            title="แก้ไขคำค้นหาและชื่อไลน์"
                          >
                            <Edit2 size={13} />
                            <span>{t.editBtn}</span>
                          </button>
                          <button
                            onClick={() => deleteItem(item)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                            title="ลบแถวนี้"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Editing Mode */
                      <div className="flex flex-col gap-3 animate-in fade-in duration-150">
                        <div className="flex flex-wrap items-center gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">{t.groupLabel}</label>
                            <select
                              value={editGroup}
                              onChange={(e) => setEditGroup(e.target.value)}
                              className="rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-xs font-black text-blue-900"
                            >
                              {GROUPS.map((g) => (
                                <option key={g} value={g}>
                                  {g}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">{t.deptLabel}</label>
                            <input
                              type="text"
                              value={editDept}
                              onChange={(e) => setEditDept(e.target.value)}
                              className="rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-xs font-black text-slate-900"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">{t.cocLabel}</label>
                            <input
                              type="text"
                              value={editCoc}
                              placeholder="COC"
                              onChange={(e) => setEditCoc(e.target.value)}
                              className="rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-xs font-mono text-slate-900 w-24"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Order Seq</label>
                            <input
                              type="number"
                              value={editOrderSeq}
                              onChange={(e) => setEditOrderSeq(Number(e.target.value) || 0)}
                              className="rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-xs font-mono text-slate-900 w-20"
                            />
                          </div>
                        </div>

                        {/* Edit Keywords */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold text-slate-600">{t.keywordsLabel}</label>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {editKeywords.map((kw, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 rounded-md bg-blue-100 border border-blue-200 px-2 py-0.5 text-xs font-bold text-blue-800 font-mono"
                              >
                                {kw}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditKeywords(editKeywords.filter((_, idx) => idx !== i));
                                  }}
                                  className="text-blue-500 hover:text-rose-600 transition cursor-pointer"
                                >
                                  ×
                                </button>
                              </span>
                            ))}

                            {/* Input add new keyword */}
                            <input
                              type="text"
                              placeholder={t.addKeywordPlaceholder}
                              value={newKeywordInput}
                              onChange={(e) => setNewKeywordInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && newKeywordInput.trim()) {
                                  e.preventDefault();
                                  const val = newKeywordInput.trim().toUpperCase();
                                  if (!editKeywords.includes(val)) {
                                    setEditKeywords([...editKeywords, val]);
                                  }
                                  setNewKeywordInput("");
                                }
                              }}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-0.5 text-xs font-mono text-slate-800 placeholder-slate-400 w-44 focus:border-blue-500 focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (newKeywordInput.trim()) {
                                  const val = newKeywordInput.trim().toUpperCase();
                                  if (!editKeywords.includes(val)) {
                                    setEditKeywords([...editKeywords, val]);
                                  }
                                  setNewKeywordInput("");
                                }
                              }}
                              className="rounded-lg bg-blue-600 text-white px-2.5 py-0.5 text-xs font-bold hover:bg-blue-500 cursor-pointer"
                            >
                              {t.addBtn}
                            </button>
                          </div>
                        </div>

                        {/* Action buttons for Edit */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-blue-200/50">
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                          >
                            {t.cancelBtn}
                          </button>
                          <button
                            onClick={() => saveEdit(item.id)}
                            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-black text-white shadow-sm transition cursor-pointer"
                          >
                            <Check size={14} />
                            <span>{t.saveChangesBtn}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3 text-xs text-slate-500">
          <span>{t.totalRows(filteredItems.length)}</span>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-black text-white transition cursor-pointer"
          >
            {t.closeBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
