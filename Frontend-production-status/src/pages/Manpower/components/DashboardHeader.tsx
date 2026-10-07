/**
 * Component: DashboardHeader
 * แถบส่วนหัวของระบบ Manpower
 * - แสดงโลโก้, เมนูเปลี่ยนเดือน, ปุ่มเครื่องมือ Admin (Import, Export, Edit, Delete, Line Manager, Cross Factory)
 * - ปุ่มเปิดคู่มือการใช้งานระบบ (User Guide)
 */
import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { UsersRound, BookOpen, HelpCircle, RefreshCw } from "lucide-react";
import FujiLogo from "../../../assets/icon/Fuji.png";
import ModalButtonIcon from "./ModalButtonIcon";
import { API_BASE_URL } from "../constants";
import { LINE_GROUPS, MACRO_PCN_GROUPS } from "../config/lineGroups";

const LineManagerModal = lazy(() => import("./LineManagerModal"));
const EditDataManager = lazy(() => import("./EditDataManager"));
const CrossFactoryManager = lazy(() => import("./CrossFactoryManager"));
const ImportExportManager = lazy(() => import("./ImportExportManager"));
const UserGuideModal = lazy(() => import("./UserGuideModal"));

const actionIconPaths = {
  import:
    "M12 3v12m0 0 4-4m-4 4-4-4M5 21h14a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2",
  export:
    "M12 15V3m0 0 4 4m-4-4L8 7M5 21h14a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2",
  edit: "M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z",
  crossFactory: "M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4",
  delete: "M3 6h18M8 6V4h8v2m-9 0 1 15h8l1-15M10 11v5m4-5v5",
  lines: "M4 4h6v5H4zM14 15h6v5h-6zM14 4h6v5h-6zM10 6.5h4M12 6.5v11h2",
  admins:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m7-2v6m-3-3h6",
  logout: "M10 17l5-5-5-5m5 5H3m11-9h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5",
};

/** แสดงไอคอน SVG ตามประเภทการกระทำของ Header Action */
function ActionIcon({ name }: { name: keyof typeof actionIconPaths }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={actionIconPaths[name]} />
    </svg>
  );
}

export default function DashboardHeader({
  importMode,
  onImportModeChange,
  isImporting,
  importFileRef,
  onImportFile,
  deleteDate,
  onDeleteDateChange,
  isDeletingDay,
  onDeleteDay,
  availableMonths = [],
  selectedMonth,
  onMonthChange,
  onEditSaved,
  onRefresh,
  isLoading = false,
  onExportDataClick,
}: {
  isLoading?: boolean;
  importMode?: any;
  onImportModeChange?: any;
  isImporting?: any;
  importFileRef?: any;
  onImportFile?: any;
  deleteDate?: any;
  onDeleteDateChange?: any;
  isDeletingDay?: any;
  onDeleteDay?: any;
  availableMonths?: any;
  selectedMonth?: any;
  onMonthChange?: any;
  onEditSaved?: (date: string) => void;
  onRefresh?: () => void;
  onExportDataClick?: () => void;
}) {
  const [isAdmin, setIsAdmin] = useState(
    Boolean(sessionStorage.getItem("manhour-admin-token")),
  );
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showAdminManager, setShowAdminManager] = useState(false);
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [showLineManager, setShowLineManager] = useState(false);
  const [showEditDataManager, setShowEditDataManager] = useState(false);
  const [showCrossFactoryManager, setShowCrossFactoryManager] = useState(false);
  const [showDeleteDataManager, setShowDeleteDataManager] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [importExportAction, setImportExportAction] = useState<
    "import" | "export" | null
  >(null);
  const login = async (event) => {
    event.preventDefault();
    setLoginError("");
    const response = await fetch(
      `${API_BASE_URL}/mh/auth/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      },
    );
    const result = await response.json();
    if (!response.ok || !result.token)
      return setLoginError(result.error || "Admin login failed");
    sessionStorage.setItem("manhour-admin-token", result.token);
    setIsAdmin(true);
    setShowLogin(false);
    setPassword("");
  };
  const addAdmin = async (event) => {
    event.preventDefault();
    setAdminMessage("");
    if (!newAdminUsername.trim() || newAdminPassword.length < 4)
      return setAdminMessage("กรอก Username และ Password อย่างน้อย 4 ตัวอักษร");
    const response = await fetch(
      `${API_BASE_URL}/mh/auth/admins`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("manhour-admin-token") || ""}`,
        },
        body: JSON.stringify({
          username: newAdminUsername.trim(),
          password: newAdminPassword,
        }),
      },
    );
    const result = await response.json();
    if (!response.ok)
      return setAdminMessage(result.error || "Unable to create admin");
    setAdminMessage(`สร้าง Admin ${result.username} เรียบร้อยแล้ว`);
    setNewAdminUsername("");
    setNewAdminPassword("");
  };

  const [unmappedLineCount, setUnmappedLineCount] = useState(0);

  // ตรวจสอบไลน์ใหม่ที่ยังไม่ได้แมปเฉพาะเมื่อผู้ใช้ล็อกอินสถานะ Admin
  useEffect(() => {
    if (!isAdmin) return;
    let isMounted = true;
    const checkUnmapped = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/mh/employees/search?q=&limit=1000`);
        if (!res.ok) return;
        const data = await res.json();
        const linesFound = new Set<string>();
        if (Array.isArray(data?.employees)) {
          data.employees.forEach((emp: any) => {
            if (emp?.line) linesFound.add(String(emp.line).trim());
          });
        }
        
        const savedMappings = JSON.parse(localStorage.getItem("manhour-line-mappings") || "{}");
        const allRegisteredChildren = new Set([
          ...Object.values(LINE_GROUPS).flat(),
          ...Object.values(MACRO_PCN_GROUPS).flat(),
          ...Object.values(savedMappings).flatMap((m: any) => (m as any)?.lines || []),
        ]);
        const builtInParents = new Set([...Object.keys(LINE_GROUPS), ...Object.keys(MACRO_PCN_GROUPS), ...Object.keys(savedMappings)]);

        const unmapped = [...linesFound].filter(
          (line) =>
            line &&
            !allRegisteredChildren.has(line) &&
            !builtInParents.has(line.replace(/\/[ABD]$/i, ""))
        );

        if (isMounted) setUnmappedLineCount(unmapped.length);
      } catch {
        /* ละเว้นข้อผิดพลาดกรณีดึงข้อมูลไม่สำเร็จ */
      }
    };
    checkUnmapped();

    const handleUpdate = () => checkUnmapped();
    window.addEventListener("manhour-line-mappings-updated", handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener("manhour-line-mappings-updated", handleUpdate);
    };
  }, [isAdmin]);

  return (
    <header className="shrink-0 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 text-white shadow-md border-b border-blue-100/20 w-full">
      {/* 🔹 แถบชั้นบน: โลโก้, ชื่อระบบ, ตัวเลือกเดือน และปุ่มเข้าสู่ระบบ/สถานะ */}
      <div className="w-full px-4 md:px-8 pt-2.5 pb-1.5 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3 [&>span.text-2xl]:hidden">
          <img src={FujiLogo} alt="Fuji" width="32" height="32" className="h-8 w-8 rounded-md bg-white object-contain p-1 shadow-sm" />
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg md:text-xl font-black tracking-tight">
              MANPOWER DASHBOARD
            </h1>
            {isLoading && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-400/20 px-3 py-0.5 text-xs font-semibold text-blue-100 backdrop-blur-sm border border-blue-300/30">
                <span className="h-2 w-2 rounded-full bg-blue-300 animate-ping" />
                Loading Data...
              </span>
            )}
          </div>
          {availableMonths.length > 0 && (
            <label className="group relative flex items-center ml-2">
              <span className="pointer-events-none absolute left-3 text-sm">
                📅
              </span>
              <select
                aria-label="Select month"
                value={selectedMonth}
                onChange={(event) => onMonthChange?.(event.target.value)}
                className="cursor-pointer appearance-none rounded-xl border border-white/70 bg-gradient-to-r from-white via-sky-50 to-blue-100 py-1.5 pl-9 pr-8 text-xs font-black text-blue-800 shadow-sm outline-none transition hover:-translate-y-px hover:shadow focus:ring-2 focus:ring-white/80"
              >
                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {new Intl.DateTimeFormat("en", {
                      month: "long",
                      year: "numeric",
                    }).format(new Date(`${month}-01T00:00:00`))}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 text-[10px] text-blue-600">
                ▼
              </span>
            </label>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {/* ปุ่ม Refresh ข้อมูล */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs sm:text-sm font-black text-white hover:bg-white/25 border border-white/30 backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
              title="โหลดข้อมูลใหม่"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          )}

          {/* ปุ่มส่งออกข้อมูล (Export Data) - ให้ผู้ใช้ทุกคนเข้าถึงได้ */}
          <button
            type="button"
            onClick={() => setImportExportAction("export")}
            className="group relative flex items-center gap-1.5 rounded-xl border border-emerald-300/60 bg-gradient-to-r from-emerald-500 to-teal-600 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-950/20 transition-all duration-200 hover:from-emerald-600 hover:to-teal-700 hover:shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
            title="ส่งออกข้อมูลรายชื่อพนักงาน (Export Data)"
          >
            <ActionIcon name="export" />
            <span className="tracking-wide text-white drop-shadow-xs">
              Export Data
            </span>
          </button>

          {/* ปุ่มคู่มือการใช้งานระบบ (User Guide) - ดีไซน์แบบ Glassmorphism สวยงาม */}
          <button
            type="button"
            onClick={() => setShowUserGuide(true)}
            className="group relative flex items-center gap-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md px-3.5 py-1.5 text-white shadow-sm border border-white/30 transition-all duration-200 hover:border-white/60 hover:scale-105 active:scale-95 cursor-pointer"
            title="เปิดคู่มือการใช้งานระบบ"
          >
            <HelpCircle size={16} className="text-white drop-shadow-xs transition-transform duration-200 group-hover:rotate-12" />
            <span className="text-xs sm:text-sm font-bold tracking-wide text-white drop-shadow-xs">
              คู่มือการใช้งาน
            </span>
            <span className="relative flex h-2 w-2 ml-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-xs"></span>
            </span>
          </button>

          {!isAdmin ? (
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="group inline-flex items-center gap-2 rounded-xl border border-white/60 bg-gradient-to-r from-white via-sky-50 to-blue-100 px-3.5 py-1.5 shadow-md shadow-blue-950/20 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <img src={FujiLogo} alt="" width="16" height="16" className="h-4 w-4 object-contain" />
              <span className="text-xs font-black tracking-wide text-blue-800">
                Admin Login
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/25 border border-emerald-300/40 px-2.5 py-1 text-[11px] font-extrabold text-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Admin Mode Active
              </span>
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem("manhour-admin-token");
                  setIsAdmin(false);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-300/50 bg-rose-500/20 px-2.5 py-1 text-xs font-bold text-rose-100 transition hover:bg-rose-500 hover:text-white"
              >
                <ActionIcon name="logout" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 🔹 Bottom Layer: Admin Toolbar Bar (เมื่อ Login แล้ว) */}
      {isAdmin && (
        <div className="w-full bg-blue-950/40 border-t border-white/10 px-4 md:px-8 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-extrabold tracking-wider text-blue-200 uppercase text-[10px] bg-blue-900/60 px-2 py-0.5 rounded border border-blue-400/20">
              Admin Tools
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* เมนูโยกย้ายข้อมูล (Transfer Data) */}
            <button
              type="button"
              onClick={() => setImportExportAction("import")}
              disabled={isImporting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200/80 bg-white px-3 py-1.5 font-bold text-blue-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-50 disabled:opacity-60"
            >
              <ActionIcon name="import" />
              {isImporting ? "Importing..." : "Import data"}
            </button>

            <span className="h-4 w-px bg-white/20 mx-1" />

            {/* เมนูจัดการข้อมูลแบบครบวงจร (Manage Data: เพิ่ม, แก้ไข, ลบ) */}
            <button
              type="button"
              onClick={() => setShowEditDataManager(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200/80 bg-white px-3 py-1.5 font-bold text-blue-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-50"
              title="จัดการข้อมูลการทำงานแบบครบวงจร: เพิ่มคนใหม่, แก้ไขข้อมูล (W/H/O/1N/เวลาสแกน/แผนก), และลบข้อมูล"
            >
              <ActionIcon name="edit" />
              Manage Data (เพิ่ม / แก้ไข / ลบ)
            </button>

            <span className="h-4 w-px bg-white/20 mx-1" />

            {/* เมนูจัดการไลน์ผลิตและผู้ดูแลระบบ */}
            <button
              type="button"
              onClick={() => setShowLineManager(true)}
              className="relative inline-flex items-center gap-1.5 rounded-lg border border-indigo-200/80 bg-white px-3 py-1.5 font-bold text-indigo-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-50"
            >
              <ActionIcon name="lines" />
              <span>Manage Lines</span>
              {unmappedLineCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-black text-white shadow-xs animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                  <span>{unmappedLineCount}</span>
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowAdminManager(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200/80 bg-white px-3 py-1.5 font-bold text-violet-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-violet-50"
            >
              <ActionIcon name="admins" />
              Manage Admins
            </button>
          </div>
        </div>
      )}
      {showLogin && (
        <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_50%_15%,#dbeafe,transparent_35%),linear-gradient(135deg,#f8fafc,#eff6ff,#f5f3ff)] p-5 text-slate-800">
          <form
            onSubmit={login}
            className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white/85 p-8 text-center shadow-2xl shadow-blue-950/15 backdrop-blur md:p-10"
          >
            <div className="mx-auto mb-7 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-50 to-sky-100 shadow-inner">
              <img
                src={FujiLogo}
                alt="Fujikura"
                className="h-16 w-16 object-contain"
              />
            </div>
            <p className="mb-1 text-xs font-black uppercase tracking-[0.22em] text-blue-600">
              Fujikura
            </p>
            <h2 className="mb-8 text-3xl font-black text-slate-900">
              Admin Login
            </h2>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoFocus
              className="mb-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-base font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              className="mb-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-base font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
            {loginError && (
              <p className="mb-3 text-sm font-bold text-rose-600">
                {loginError}
              </p>
            )}
            <button className="w-full rounded-2xl bg-gradient-to-r from-blue-700 to-sky-500 py-4 text-lg font-black text-white shadow-lg shadow-blue-500/25 transition hover:brightness-105">
              Log in
            </button>
            <button
              type="button"
              onClick={() => setShowLogin(false)}
              className="mt-5 text-sm font-bold text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </form>
        </div>
      )}
      {importExportAction && (
        <Suspense fallback={null}>
          <ImportExportManager
            action={importExportAction}
            isImporting={isImporting}
            importFileRef={importFileRef}
            onImportFile={onImportFile}
            onImportModeChange={onImportModeChange}
            defaultSelectedMonth={selectedMonth}
            onClose={() => setImportExportAction(null)}
          />
        </Suspense>
      )}
      {showEditDataManager && (
        <Suspense fallback={null}>
          <EditDataManager onClose={() => setShowEditDataManager(false)} />
        </Suspense>
      )}
      {showDeleteDataManager && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <section className="w-full max-w-md rounded-3xl bg-white p-6 text-slate-800 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-wider text-rose-500">
              Delete data
            </p>
            <h2 className="mt-1 text-xl font-black">
              Delete attendance by date
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Select a work date. The records will be loaded for review before
              anything is deleted.
            </p>
            <label className="mt-5 block text-sm font-bold text-slate-700">
              Work date
            </label>
            <input
              type="date"
              value={deleteDate}
              onChange={(e) => onDeleteDateChange(e.target.value)}
              disabled={isDeletingDay}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-900 outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
              autoFocus
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteDataManager(false)}
                disabled={isDeletingDay}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                <ModalButtonIcon name="close" />
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteDay();
                  setShowDeleteDataManager(false);
                }}
                disabled={!deleteDate || isDeletingDay}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ModalButtonIcon name="load" />
                {isDeletingDay ? "Loading..." : "Load data"}
              </button>
            </div>
          </section>
        </div>
      )}
      {showLineManager && (
        <Suspense fallback={null}>
          <LineManagerModal onClose={() => setShowLineManager(false)} />
        </Suspense>
      )}
      {showAdminManager && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-5 backdrop-blur-sm">
          <form
            onSubmit={addAdmin}
            className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100">
                <img src={FujiLogo} alt="" className="h-7 w-7 object-contain" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-violet-600">
                  Admin Management
                </p>
                <h2 className="text-xl font-black text-slate-900">
                  Create new Admin
                </h2>
              </div>
            </div>
            <label className="mb-2 block text-sm font-bold text-slate-700">
              Username
            </label>
            <input
              value={newAdminUsername}
              onChange={(e) => setNewAdminUsername(e.target.value)}
              className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              autoFocus
            />
            <label className="mb-2 block text-sm font-bold text-slate-700">
              Password
            </label>
            <input
              type="password"
              value={newAdminPassword}
              onChange={(e) => setNewAdminPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
            {adminMessage && (
              <p className="mt-3 text-sm font-bold text-rose-600">
                {adminMessage}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAdminManager(false)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                <ModalButtonIcon name="close" />
                Cancel
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-violet-200">
                <ModalButtonIcon name="add" />
                Add Admin
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 🔹 หน้าต่างคู่มือการใช้งานระบบ Manpower */}
      <Suspense fallback={null}>
        <UserGuideModal
          isOpen={showUserGuide}
          onClose={() => setShowUserGuide(false)}
        />
      </Suspense>
    </header>
  );
}

