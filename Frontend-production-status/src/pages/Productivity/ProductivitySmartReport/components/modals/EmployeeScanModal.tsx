import React, { useEffect, useState, useMemo } from "react";
import { Users, X, Search, Clock, CheckCircle2, AlertCircle, RefreshCcw, UserCheck } from "lucide-react";
import dayjs from "dayjs";

type EmployeeScan = {
  empCode: string;
  empName: string;
  department: string;
  shift: string;
  line: string;
  lineGroup: string;
  workStatus: string;
  scanTimeIn: string;
  scanTimeOut: string;
  supportType?: string;
};

type EmployeeScanModalProps = {
  isOpen: boolean;
  onClose: () => void;
  date?: string;
  lineGroup?: string;
};

import { getApiBaseUrl } from "../../../../../utils/apiConfig";

const API_BASE_URL = getApiBaseUrl();

export const EmployeeScanModal: React.FC<EmployeeScanModalProps> = ({
  isOpen,
  onClose,
  date = dayjs().format("YYYY-MM-DD"),
  lineGroup = "ALL",
}) => {
  const [employees, setEmployees] = useState<EmployeeScan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(date);
  const [filterLoanedOut, setFilterLoanedOut] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    if (isOpen && date) {
      setSelectedDate(date);
    }
  }, [isOpen, date]);

  useEffect(() => {
    if (isOpen && selectedDate) {
      setFilterLoanedOut(false);
      setStatusFilter('ALL');
      setSearchInput("");
      setAppliedSearchQuery("");
      fetchScans(selectedDate);
    }
  }, [isOpen, selectedDate, lineGroup]);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAppliedSearchQuery(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setAppliedSearchQuery("");
  };

  const fetchScans = async (targetDate = selectedDate) => {
    setIsLoading(true);
    try {
      const queryDate = targetDate || "LATEST";
      const res = await fetch(`${API_BASE_URL}/productivity/attendance/employee-scans?date=${queryDate}&lineGroup=${encodeURIComponent(lineGroup)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.employees) && data.employees.length > 0) {
          setEmployees(data.employees);
          if (data.date && data.date !== selectedDate) {
            setSelectedDate(data.date);
          }
        } else {
          // If 0 employees on requested date, query latest scan date
          try {
            const latestRes = await fetch(`${API_BASE_URL}/productivity/attendance/latest-scan-date`);
            if (latestRes.ok) {
              const latestData = await latestRes.json();
              if (latestData.latestDate && latestData.latestDate !== queryDate) {
                const secondRes = await fetch(`${API_BASE_URL}/productivity/attendance/employee-scans?date=${latestData.latestDate}&lineGroup=${encodeURIComponent(lineGroup)}`);
                if (secondRes.ok) {
                  const secondData = await secondRes.json();
                  if (Array.isArray(secondData.employees) && secondData.employees.length > 0) {
                    setEmployees(secondData.employees);
                    setSelectedDate(latestData.latestDate);
                    return;
                  }
                }
              }
            }
          } catch (e) {
            // Fallback fail silently
          }
          setEmployees([]);
        }
      }
    } catch (err) {
      console.error("Failed to load employee scan details:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loanedOutCount = useMemo(() => {
    return employees.filter((emp) => emp.supportType === "LOANED_OUT").length;
  }, [employees]);

  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((emp) => {
      if (emp.workStatus) set.add(emp.workStatus);
    });
    const priority = ["Normal", "Absent", "Abnormal", "Late", "Leave"];
    return Array.from(set).sort((a, b) => {
      const idxA = priority.indexOf(a);
      const idxB = priority.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const q = appliedSearchQuery.toLowerCase().trim();
    return employees.filter((emp) => {
      if (filterLoanedOut && emp.supportType !== "LOANED_OUT") {
        return false;
      }
      if (statusFilter !== 'ALL' && emp.workStatus !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        emp.empCode.toLowerCase().includes(q) ||
        emp.empName.toLowerCase().includes(q) ||
        emp.department.toLowerCase().includes(q) ||
        emp.lineGroup.toLowerCase().includes(q) ||
        emp.line.toLowerCase().includes(q)
      );
    });
  }, [employees, filterLoanedOut, statusFilter, appliedSearchQuery]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedSearchQuery, statusFilter, filterLoanedOut, selectedDate]);

  const totalPages = Math.ceil(filteredEmployees.length / pageSize) || 1;
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, currentPage, pageSize]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-base-100 rounded-2xl shadow-2xl border border-base-300 w-full max-w-5xl lg:max-w-6xl h-[85vh] min-h-[580px] max-h-[900px] flex flex-col overflow-hidden text-base-content">
        {/* Header */}
        <div className="p-5 border-b border-base-300 flex items-center justify-between bg-base-200/50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-base-content flex items-center gap-2">
              รายชื่อพนักงานรูดบัตรเข้าทำงานจริง (Attendance Scans)
            </h2>
            <div className="text-xs text-base-content/60 mt-1 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-base-100 border border-base-300 rounded-lg px-2 py-0.5 shadow-sm">
                <span className="font-semibold text-base-content/70">เลือกวันที่:</span>
                <input
                  type="date"
                  className="bg-transparent border-none text-xs font-bold text-primary focus:outline-none cursor-pointer"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <span>•</span>
              <span>Line: <strong className="text-base-content font-bold">{lineGroup}</strong></span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content hover:bg-base-200 cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-4 py-2.5 border-b border-base-300 flex items-center justify-between gap-2 bg-base-100 text-xs shrink-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="badge badge-primary text-xs font-bold px-2.5 py-1.5 h-auto whitespace-nowrap">
              สแกนทั้งหมด: {employees.length.toLocaleString()} คน
            </span>
            {loanedOutCount > 0 && (
              <button
                onClick={() => setFilterLoanedOut(!filterLoanedOut)}
                className={`badge text-white text-xs font-bold px-2.5 py-1.5 h-auto cursor-pointer transition-all border-none whitespace-nowrap ${filterLoanedOut
                    ? "bg-info ring-2 ring-info ring-offset-1 scale-105"
                    : "bg-info/80 hover:bg-info hover:scale-105"
                  }`}
                title="คลิกเพื่อกรองเฉพาะคนกลุ่มนี้"
              >
                ไปช่วยงาน: {loanedOutCount} คน
              </button>
            )}
            {appliedSearchQuery && (
              <span className="text-base-content/70 text-xs font-semibold bg-base-200 px-2 py-1 rounded-md border border-base-300 flex items-center gap-1.5 whitespace-nowrap">
                <span>(พบ {filteredEmployees.length.toLocaleString()} คน)</span>
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="text-primary hover:underline font-bold cursor-pointer"
                  title="ล้างคำค้นหา"
                >
                  ล้าง
                </button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Status Filter Dropdown */}
            <select
              className="select select-sm select-bordered text-xs font-semibold rounded-lg bg-base-100 focus:outline-none cursor-pointer w-32 sm:w-36 px-2"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              title="กรองตามสถานะการเข้างาน"
            >
              <option value="ALL">สถานะทั้งหมด ({employees.length})</option>
              {availableStatuses.map((status) => {
                const count = employees.filter((e) => e.workStatus === status).length;
                return (
                  <option key={status} value={status}>
                    {status} ({count})
                  </option>
                );
              })}
            </select>


            {/* Search Form with Search Button */}
            <form onSubmit={handleSearch} className="flex items-center gap-1.5 shrink-0">
              <div className="relative w-36 sm:w-44 lg:w-48">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
                <input
                  type="text"
                  className="input input-sm input-bordered w-full pl-7 pr-6 rounded-lg text-xs"
                  placeholder="ค้นหาชื่อ, รหัส..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content p-0.5 rounded cursor-pointer"
                    title="ล้างข้อความ"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="btn btn-sm btn-primary px-2.5 gap-1 font-bold text-xs rounded-lg shadow-sm whitespace-nowrap"
                title="กดค้นหา (หรือกดปุ่ม Enter)"
              >
                <Search size={13} />
                <span>ค้นหา</span>
              </button>
            </form>

            <button
              onClick={() => fetchScans(selectedDate)}
              className="btn btn-sm btn-square btn-ghost border border-base-300 shrink-0"
              title="Refresh Scans"
            >
              <RefreshCcw size={14} className={isLoading ? "animate-spin text-primary" : ""} />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-base-100">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-base-content/50 gap-2">
              <RefreshCcw className="w-8 h-8 animate-spin text-primary" />
              <span className="text-sm font-semibold">กำลังโหลดข้อมูลการรูดบัตร...</span>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-base-content/50 gap-2">
              <AlertCircle className="w-10 h-10 opacity-40 text-warning" />
              <span className="text-sm font-semibold">ไม่พบข้อมูลการรูดบัตรเข้าทำงานในวันที่เลือก</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm table-zebra w-full text-xs">
                <thead>
                  <tr className="bg-base-200/60 text-base-content/70">
                    <th className="w-10">#</th>
                    <th>รหัสพนักงาน</th>
                    <th>ชื่อ-นามสกุล</th>
                    <th>แผนก / Cost Center</th>
                    <th>กะ (Shift)</th>
                    <th>เวลาเข้า (In)</th>
                    <th>เวลาออก (Out)</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEmployees.map((emp, idx) => {
                    const globalIdx = (currentPage - 1) * pageSize + idx;
                    return (
                      <tr key={`${emp.empCode}-${globalIdx}`} className="hover:bg-sky-50 transition-colors">
                        <td className="font-mono text-base-content/40">{globalIdx + 1}</td>
                        <td className="font-mono font-bold text-primary">{emp.empCode}</td>
                        <td className="py-2.5">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs tracking-wide">
                                {emp.empName || "-"}
                              </span>
                              {emp.supportType === "LOANED_OUT" && (
                                <span className="badge badge-info text-white font-semibold px-2 py-0.5 rounded text-[11px] leading-tight h-auto shadow-2xs">
                                  ไปช่วยงานต่างสาขา
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="text-base-content/70 truncate max-w-[180px]" title={emp.department}>
                          {emp.department}
                        </td>
                        <td>
                          {(() => {
                            let isNight = emp.shift === "Night" || emp.shift === "N" || emp.shift === "B";
                            if (emp.scanTimeIn && emp.scanTimeIn !== "-") {
                              const h = parseInt(emp.scanTimeIn.split(":")[0], 10);
                              if (!isNaN(h)) {
                                isNight = h >= 17 || h < 5;
                              }
                            }
                            return (
                              <span
                                className={`inline-flex items-center justify-center w-[52px] h-[22px] rounded-md text-[11px] font-bold tracking-wide shadow-2xs border text-center ${
                                  isNight
                                    ? "bg-slate-900 text-indigo-200 border-indigo-700/80"
                                    : "bg-amber-400 text-amber-950 border-amber-500"
                                }`}
                              >
                                {isNight ? "Night" : "Day"}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="font-mono text-emerald-600 font-semibold">{emp.scanTimeIn}</td>
                        <td className="font-mono text-amber-600 font-semibold">{emp.scanTimeOut}</td>
                        <td>
                          <span
                            className={`badge badge-xs font-semibold ${
                              emp.workStatus === "Normal"
                                ? "badge-success text-white"
                                : emp.workStatus === "Absent"
                                  ? "badge-ghost text-base-content/70 font-bold bg-base-200"
                                  : emp.workStatus === "Abnormal" || emp.workStatus === "Late"
                                    ? "badge-warning font-bold"
                                    : "badge-ghost"
                            }`}
                          >
                            {emp.workStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-base-300 bg-base-200/60 flex flex-wrap justify-between items-center gap-3 text-xs text-base-content/70 shrink-0">
          <div className="flex items-center gap-2">
            <span>แสดง <strong>{filteredEmployees.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} - {Math.min(currentPage * pageSize, filteredEmployees.length)}</strong> จาก <strong>{filteredEmployees.length.toLocaleString()}</strong> คน</span>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1 bg-base-100 p-1 rounded-lg border border-base-300 shadow-2xs">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="btn btn-xs btn-ghost disabled:opacity-30 px-2 font-mono"
                title="หน้าแรก"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="btn btn-xs btn-ghost disabled:opacity-30 px-2"
                title="หน้าก่อนหน้า"
              >
                ‹ ก่อนหน้า
              </button>
              <span className="px-2 font-mono font-bold text-xs text-primary">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="btn btn-xs btn-ghost disabled:opacity-30 px-2"
                title="หน้าถัดไป"
              >
                ถัดไป ›
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="btn btn-xs btn-ghost disabled:opacity-30 px-2 font-mono"
                title="หน้าสุดท้าย"
              >
                »
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="btn btn-sm btn-primary px-5 rounded-lg font-bold shadow-md shadow-primary/20 cursor-pointer"
            >
              ปิดหน้าต่าง (Close)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
