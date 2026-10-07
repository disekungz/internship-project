import React, { useState, useEffect } from "react";
import {
  X,
  BookOpen,
  Search,
  ChevronRight,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Maximize2,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";
import {
  ToolCategory,
  CategoryTheme,
  CATEGORY_THEMES,
  getAssetUrl,
  CATEGORIES_CONFIG,
  ToolGuideItem,
  TOOLS_GUIDE_DATA,
} from "./toolsGuideData";

interface ToolsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTool?: (toolId: string) => void;
  isAdmin?: boolean;
}


interface ImageZoomLightboxProps {
  image: {
    url: string;
    title: string;
    caption?: string;
  };
  onClose: () => void;
}

const ImageZoomLightbox: React.FC<ImageZoomLightboxProps> = ({ image, onClose }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 4));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.25, 0.5);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 0.2 : -0.2;
    setScale((prev) => {
      const next = Math.min(Math.max(prev + zoomDelta, 0.5), 4);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return parseFloat(next.toFixed(2));
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    if (scale > 1) {
      resetZoom();
    } else {
      setScale(2);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-") {
        handleZoomOut();
      } else if (e.key === "0") {
        resetZoom();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/90 backdrop-blur-md animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        className="relative max-w-6xl w-full h-[94vh] flex flex-col gap-3 bg-base-100 rounded-3xl p-4 sm:p-6 border border-base-300 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title & Zoom Controls */}
        <div className="flex items-center justify-between pb-3 border-b border-base-300 flex-wrap gap-2 shrink-0">
          <div className="min-w-0 flex-1 mr-2">
            <h3 className="text-base sm:text-lg font-bold text-base-content truncate">
              {image.title}
            </h3>
            {image.caption && (
              <p className="text-xs text-base-content/70 mt-0.5 truncate">{image.caption}</p>
            )}
          </div>

          {/* Zoom Controls Toolbar */}
          <div className="flex items-center gap-1.5 bg-base-200/80 p-1.5 rounded-2xl border border-base-300 shadow-xs">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              className="btn btn-xs btn-ghost btn-circle text-base-content/80 hover:text-base-content disabled:opacity-30"
              title="ซูมออก (-)"
            >
              <ZoomOut size={16} />
            </button>

            <button
              type="button"
              onClick={resetZoom}
              className="btn btn-xs btn-ghost px-2 font-mono font-bold text-xs text-base-content rounded-lg min-w-[54px]"
              title="รีเซ็ตเป็น 100% (0)"
            >
              {Math.round(scale * 100)}%
            </button>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={scale >= 4}
              className="btn btn-xs btn-ghost btn-circle text-base-content/80 hover:text-base-content disabled:opacity-30"
              title="ซูมเข้า (+)"
            >
              <ZoomIn size={16} />
            </button>

            <div className="w-px h-4 bg-base-300 mx-0.5" />

            <button
              type="button"
              onClick={resetZoom}
              className="btn btn-xs btn-ghost btn-circle text-base-content/70 hover:text-base-content"
              title="รีเซ็ตมุมมอง"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm btn-circle btn-ghost text-base-content/80 hover:text-base-content hover:bg-base-200"
            title="ปิด (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Viewport Canvas */}
        <div
          className={`flex-1 relative overflow-hidden bg-base-200/50 rounded-2xl border border-base-300 flex items-center justify-center ${
            scale > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
          }`}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
        >
          <div
            className="transition-transform duration-75 will-change-transform flex items-center justify-center"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: "center center",
            }}
          >
            <img
              src={image.url}
              alt={image.title}
              draggable={false}
              className="max-w-[85vw] max-h-[75vh] object-contain rounded-xl shadow-lg pointer-events-none select-none"
            />
          </div>

          {/* Floating Instructions Helper */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-base-100/90 backdrop-blur-md text-base-content/80 text-[11px] font-medium px-4 py-1.5 rounded-full border border-base-300 shadow-md pointer-events-none flex items-center gap-2">
            <Move size={12} className="text-amber-500" />
            <span>เลื่อน Scroll เพื่อซูม • คลิกลากเพื่อเลื่อนดูภาพ • ดับเบิลคลิกเพื่อซูม 2 เท่า</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ToolsGuideModal: React.FC<ToolsGuideModalProps> = ({
  isOpen,
  onClose,
  onOpenTool,
  isAdmin = false,
}) => {
  const [selectedToolId, setSelectedToolId] = useState<string>("table_visibility");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
    caption?: string;
  } | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && previewImage) {
        setPreviewImage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewImage]);

  if (!isOpen) return null;

  const filteredTools = TOOLS_GUIDE_DATA.filter((tool) => {
    const matchesCat = selectedCategory === "ALL" || tool.category === selectedCategory;
    const matchesSearch =
      searchTerm.trim() === "" ||
      tool.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.subtitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.steps.some(
        (s) =>
          s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.desc.toLowerCase().includes(searchTerm.toLowerCase())
      );
    return matchesCat && matchesSearch;
  });

  const activeTool = TOOLS_GUIDE_DATA.find((t) => t.id === selectedToolId) || TOOLS_GUIDE_DATA[0];
  const activeTheme = CATEGORY_THEMES[activeTool.category];
  const IconComponent = activeTool.icon;

  return (
    <>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/75 backdrop-blur-md animate-fadeIn">
        <div className="bg-base-100 text-base-content rounded-2xl sm:rounded-3xl shadow-2xl border border-base-300 w-[96vw] max-w-6xl xl:max-w-7xl h-[92vh] max-h-[920px] flex flex-col overflow-hidden">

          {/* 1. MODAL HEADER */}
          <div className="px-6 py-4 border-b border-base-300 flex items-center justify-between bg-base-200/60 shrink-0">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-base-content">
                  คู่มือการใช้งาน Management Tools
                </h2>
                <span className="badge badge-sm font-bold bg-amber-500 text-white border-none shadow-xs">
                  User Guide
                </span>
              </div>
              <p className="text-xs font-normal text-base-content/70 mt-0.5">
                คำอธิบายฟังก์ชัน ขั้นตอนการทำงาน สูตรคำนวณเบื้องหลัง และข้อแนะนำสำหรับเครื่องมือจัดการทั้งหมดในระบบ
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">


              <button
                type="button"
                onClick={onClose}
                className="btn btn-sm btn-ghost btn-circle text-base-content/70 hover:text-base-content hover:bg-base-200"
                title="ปิดหน้าต่าง"
              >
                <X size={22} />
              </button>
            </div>
          </div>

          {/* MAIN BODY: 2 COLUMNS (FLEXIBLE EXPANSIVE LAYOUT) */}
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">

            {/* 2. LEFT SIDEBAR: TOOL SELECTOR */}
            <div className="w-full md:w-[330px] lg:w-[360px] shrink-0 border-r border-base-300 bg-base-200/50 p-4 flex flex-col gap-3.5 overflow-hidden">

              {/* Search & Category Filter */}
              <div className="flex flex-col gap-2.5 shrink-0">
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/50" />
                  <input
                    type="text"
                    className="input input-sm input-bordered bg-base-100 text-base-content placeholder:text-base-content/40 border-base-300 w-full pl-9 rounded-xl text-xs focus:outline-none focus:border-amber-500 shadow-2xs font-medium"
                    placeholder="ค้นหาเครื่องมือ หรือคำค้นหา..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Category Tabs (Full Width Grid) */}
                <div className="flex flex-col gap-1.5 pt-0.5 w-full">
                  <div className="grid grid-cols-3 gap-1.5 w-full">
                    {CATEGORIES_CONFIG.slice(0, 3).map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`btn btn-xs rounded-lg font-bold text-[11px] transition-all w-full text-center px-1 truncate ${selectedCategory === cat.id
                          ? "bg-amber-500 text-white shadow-xs border-none"
                          : "btn-ghost border border-base-300 bg-base-100 text-base-content/75 hover:bg-base-200"
                          }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 w-full">
                    {CATEGORIES_CONFIG.slice(3, 5).map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`btn btn-xs rounded-lg font-bold text-[11px] transition-all w-full text-center px-1 truncate ${selectedCategory === cat.id
                          ? "bg-amber-500 text-white shadow-xs border-none"
                          : "btn-ghost border border-base-300 bg-base-100 text-base-content/75 hover:bg-base-200"
                          }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tools List */}
              <div className="flex-1 overflow-y-auto -mx-1.5 px-1.5 py-1.5 flex flex-col gap-2">
                {filteredTools.length === 0 ? (
                  <div className="p-8 text-center text-xs font-medium text-base-content/50 bg-base-100 rounded-2xl border border-dashed border-base-300 mt-2">
                    ไม่พบเครื่องมือที่ตรงกับคำค้นหา
                  </div>
                ) : (
                  filteredTools.map((tool) => {
                    const isSelected = selectedToolId === tool.id;
                    const ToolIcon = tool.icon;
                    const theme = CATEGORY_THEMES[tool.category];
                    return (
                      <div
                        key={tool.id}
                        onClick={() => setSelectedToolId(tool.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between select-none ${isSelected
                          ? `bg-base-100 shadow-md ${theme.activeRing}`
                          : "bg-base-100 border-base-300/80 hover:border-base-300 hover:shadow-xs text-base-content"
                          }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                          {/* Category-based Icon Color */}
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all shadow-xs ${theme.iconBg} ${isSelected
                              ? "ring-2 ring-current ring-offset-1 shadow-md scale-105"
                              : "hover:scale-105 opacity-95"
                              }`}
                          >
                            <ToolIcon size={19} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span
                              className={`text-xs truncate ${isSelected
                                ? "font-bold text-base-content text-[13px]"
                                : "font-semibold text-base-content/85"
                                }`}
                            >
                              {tool.title.split("(")[0].trim()}
                            </span>
                            <span className="text-[10px] font-medium text-base-content/50 truncate mt-0.5">
                              {tool.categoryLabel}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center">
                          <ChevronRight
                            size={16}
                            className={`transition-transform ${isSelected ? `${theme.activeText} translate-x-0.5 font-bold` : "text-base-content/30"
                              }`}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT DETAIL PANEL */}
            <div className="flex-1 p-5 sm:p-7 md:p-8 overflow-y-auto bg-base-100 flex flex-col gap-6">

              {/* TOOL HEADER BANNER */}
              <div className="p-4 sm:p-5 rounded-2xl border border-base-300 bg-base-100 shadow-xs flex flex-col gap-2.5">
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs ${activeTheme.iconBg} shrink-0 mt-0.5`}
                  >
                    <IconComponent size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-base-content leading-tight">
                        {activeTool.title.split("(")[0].trim()}
                      </h3>
                      {activeTool.title.includes("(") && (
                        <span className="text-xs sm:text-sm font-medium text-base-content/60">
                          ({activeTool.title.split("(")[1]}
                        </span>
                      )}
                      <span
                        className={`badge badge-sm font-bold text-[10px] px-2 py-0.5 border-none shadow-2xs ${activeTheme.badgeBg}`}
                      >
                        {activeTool.categoryLabel}
                      </span>
                    </div>
                    <p className="text-xs font-normal text-base-content/70 mt-1 leading-normal">
                      {activeTool.subtitle}
                    </p>
                  </div>
                </div>

                {/* Purpose text */}
                <div className="pt-2.5 border-t border-base-200/90 text-xs text-base-content/80 leading-relaxed flex items-start gap-1.5">
                  <span className="font-bold text-base-content shrink-0">วัตถุประสงค์:</span>
                  <span className="font-normal text-base-content/85">{activeTool.purpose}</span>
                </div>
              </div>

              {/* ANNOTATED UI SCREENSHOT SECTION */}
              {activeTool.guideImageUrl && !imageErrors[activeTool.id] && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-base-content">
                      <ImageIcon size={17} className="text-amber-500" />
                      <span>ภาพประกอบและคำอธิบาย</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewImage({
                          url: getAssetUrl(activeTool.guideImageUrl!),
                          title: activeTool.title,
                          caption: activeTool.imageCaption,
                        })
                      }
                      className="btn btn-xs btn-ghost gap-1.5 font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg"
                    >
                      <Maximize2 size={13} />
                      <span>ขยายดูภาพใหญ่</span>
                    </button>
                  </div>

                  <div
                    onClick={() =>
                      setPreviewImage({
                        url: getAssetUrl(activeTool.guideImageUrl!),
                        title: activeTool.title,
                        caption: activeTool.imageCaption,
                      })
                    }
                    className="group relative rounded-2xl border-2 border-base-300 bg-base-200/50 overflow-hidden cursor-zoom-in hover:border-amber-500/60 transition-all shadow-xs hover:shadow-md"
                  >
                    <img
                      src={getAssetUrl(activeTool.guideImageUrl)}
                      alt={activeTool.title}
                      onError={() =>
                        setImageErrors((prev) => ({ ...prev, [activeTool.id]: true }))
                      }
                      className="w-full h-auto max-h-[380px] object-contain rounded-xl transition-transform duration-300 group-hover:scale-[1.01]"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center pointer-events-none">
                      <div className="opacity-0 group-hover:opacity-100 transition-all bg-base-100/90 backdrop-blur-md text-base-content font-bold text-xs px-3.5 py-2 rounded-xl shadow-lg border border-base-300 flex items-center gap-2">
                        <ZoomIn size={15} className="text-amber-500" />
                        <span>คลิกเพื่อขยายดูภาพขนาดเต็ม (Zoom In)</span>
                      </div>
                    </div>
                  </div>

                  {activeTool.imageCaption && (
                    <p className="text-[11px] sm:text-xs text-base-content/70 px-1">
                      {activeTool.imageCaption}
                    </p>
                  )}
                </div>
              )}

              {/* STEP BY STEP GUIDE */}
              <div className="flex flex-col gap-3.5">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wider text-base-content">
                  <div className="w-5 h-5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <BookOpen size={13} />
                  </div>
                  <span>ขั้นตอนการใช้งาน (Step-by-Step Guide)</span>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {activeTool.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl border border-base-300 bg-base-100 hover:border-primary/50 hover:shadow-xs transition-all flex items-start gap-3.5 shadow-2xs"
                    >
                      <span className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-2xs border border-amber-500/25">
                        {idx + 1}
                      </span>
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="font-bold text-xs sm:text-sm text-base-content">
                          {step.title.replace(/^\d+\.\s*/, "")}
                        </span>
                        <p className="text-xs font-normal text-base-content/70 whitespace-pre-line leading-relaxed mt-0.5">
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* TIP & HIGHLIGHT BOXES (CLEAN SOLID CARD DESIGN WITH COLORED BORDERS) */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

                {/* Highlights Box */}
                <div className="p-5 rounded-2xl border-2 border-emerald-500/60 bg-base-100 flex flex-col gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-xs shrink-0">
                      <CheckCircle2 size={16} />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-base-content">
                      จุดเด่น & คุณสมบัติสำคัญ
                    </span>
                  </div>
                  <ul className="flex flex-col gap-2 text-xs sm:text-sm text-base-content/80">
                    {activeTool.keyHighlights.map((hl, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-2" />
                        <span className="leading-relaxed">{hl}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Tips Box */}
                <div className="p-5 rounded-2xl border-2 border-amber-500/60 bg-base-100 flex flex-col gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                      <Lightbulb size={16} />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-base-content">
                      ข้อแนะนำ & ทริคการใช้งาน
                    </span>
                  </div>
                  <ul className="flex flex-col gap-2 text-xs sm:text-sm text-base-content/80">
                    {activeTool.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-2" />
                        <span className="leading-relaxed">{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

              </div>

            </div>

          </div>

          {/* MODAL FOOTER */}
          <div className="px-6 py-3.5 border-t border-base-300 bg-base-200/50 flex items-center justify-end shrink-0 text-xs">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-sm btn-ghost font-bold px-6 rounded-xl text-base-content hover:bg-base-300"
            >
              ปิดหน้าต่าง (Close)
            </button>
          </div>

        </div>
      </div>

      {/* INTERACTIVE FULL-SCREEN ZOOM & PAN LIGHTBOX MODAL */}
      {previewImage && (
        <ImageZoomLightbox
          image={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}


    </>
  );
};

export default ToolsGuideModal;
