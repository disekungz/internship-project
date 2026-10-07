import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  RefreshCw,
  Check,
  ChevronDown,
  Layers,
  Building2,
  Filter,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  History,
  Clock,
  Activity,
  AlertTriangle
} from 'lucide-react';
import Swal from 'sweetalert2';
import { getApiBaseUrl } from '../../../../../utils/apiConfig';

export type CostCenterRecord = {
  id: number;
  cost_center_code: string;
  cost_center_name: string;
  type: 'DIRECT' | 'INDIRECT' | 'INDIRECT PRODUCTION';
  process?: string;
  line?: string;
  ship?: string;
  line_out: string;
  source_table?: string;
  is_unmapped?: boolean;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function CostCenterManagementModal({ isOpen, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState<boolean>(false);
  const [directList, setDirectList] = useState<CostCenterRecord[]>([]);
  const [indirectList, setIndirectList] = useState<CostCenterRecord[]>([]);
  const [indirectProdList, setIndirectProdList] = useState<CostCenterRecord[]>([]);
  const [unmappedList, setUnmappedList] = useState<CostCenterRecord[]>([]);
  const [availableLineGroups, setAvailableLineGroups] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DIRECT' | 'INDIRECT' | 'INDIRECT PRODUCTION' | 'UNMAPPED'>('ALL');
  const [lineFilter, setLineFilter] = useState<string>('ALL');
  const [shipFilter, setShipFilter] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const pageSize = 12;

  // Form Modal State
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<CostCenterRecord | null>(null);
  const [formCode, setFormCode] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formType, setFormType] = useState<'DIRECT' | 'INDIRECT' | 'INDIRECT PRODUCTION'>('DIRECT');
  const [formProcess, setFormProcess] = useState<string>('IND');
  const [formLine, setFormLine] = useState<string>('IND');
  const [formShip, setFormShip] = useState<string>('D');
  const [formLineOut, setFormLineOut] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Code & Line Out Combobox State
  const [showCodeDropdown, setShowCodeDropdown] = useState<boolean>(false);
  const [showLineOutDropdown, setShowLineOutDropdown] = useState<boolean>(false);

  const selectCodeRecord = (rec: CostCenterRecord) => {
    setFormCode(rec.cost_center_code);
    setFormName(rec.cost_center_name || '');
    setFormType(rec.type || 'DIRECT');
    setFormProcess(rec.process || 'IND');
    setFormLine(rec.line || 'IND');
    setFormShip(rec.ship || 'D');
    setFormLineOut(rec.line_out || '');
    setShowCodeDropdown(false);
  };

  const handleCodeChange = (inputVal: string) => {
    const val = inputVal.toUpperCase();
    setFormCode(val);
    setShowCodeDropdown(true);

    // Check if exact match exists in allRecords
    const exactMatch = allRecords.find(r => r.cost_center_code === val);
    if (exactMatch) {
      setFormName(exactMatch.cost_center_name || '');
      setFormType(exactMatch.type || 'DIRECT');
      setFormProcess(exactMatch.process || 'IND');
      setFormLine(exactMatch.line || 'IND');
      setFormShip(exactMatch.ship || 'D');
      setFormLineOut(exactMatch.line_out || '');
    }
  };

  // Line Help Checker State
  const [checkingHelp, setCheckingHelp] = useState<boolean>(false);
  const [helpResult, setHelpResult] = useState<any>(null);

  const handleCheckLineHelp = async () => {
    setCheckingHelp(true);
    setHelpResult(null);
    try {
      const queryParams = new URLSearchParams({
        line_out: formLineOut.trim() || `${formLine}/${formShip}`,
        cost_center_code: formCode.trim(),
        line: formLine.trim(),
        process: formProcess.trim(),
        ship: formShip.trim()
      });
      const res = await fetch(`${getApiBaseUrl()}/productivity/settings/check-line-help?${queryParams}`);
      if (!res.ok) throw new Error('Cannot check Line Help connection');
      const data = await res.json();
      setHelpResult(data);
    } catch (err: any) {
      console.error(err);
      setHelpResult({ error: err.message || 'Cannot check Line Help connection' });
    } finally {
      setCheckingHelp(false);
    }
  };

  // Audit Log State
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  const adminDisplayName = typeof window !== 'undefined'
    ? (localStorage.getItem('pdt_admin_display_name') || localStorage.getItem('pdt_admin_user') || 'Admin')
    : 'Admin';

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/productivity/settings/cost-centers`);
      if (!res.ok) throw new Error('Failed to fetch cost center data');
      const data = await res.json();
      setDirectList(data.direct || []);
      setIndirectList(data.indirect || []);
      setIndirectProdList(data.indirect_production || []);
      setUnmappedList(data.unmapped || []);
      setAvailableLineGroups(data.availableLineGroups || []);
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message || 'Cannot load cost center data'
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch Audit Logs
  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/productivity/settings/cost-center-audit-logs`);
      if (!res.ok) throw new Error('Cannot fetch audit logs');
      const data = await res.json();
      setAuditLogs(data || []);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  // Combined Records (Unmapped first, then valid Codes A-Z, then empty Codes at the end)
  const allRecords = useMemo(() => {
    const list = [...unmappedList, ...directList, ...indirectProdList, ...indirectList];
    return list.sort((a, b) => {
      // 1. Unmapped items first
      if (a.is_unmapped && !b.is_unmapped) return -1;
      if (!a.is_unmapped && b.is_unmapped) return 1;

      const codeA = (a.cost_center_code || '').trim();
      const codeB = (b.cost_center_code || '').trim();

      const isEmptyA = codeA === '';
      const isEmptyB = codeB === '';

      // 2. Empty codes pushed to the very end
      if (isEmptyA && !isEmptyB) return 1;
      if (!isEmptyA && isEmptyB) return -1;

      // 3. Alphabetical sort by code
      return codeA.localeCompare(codeB);
    });
  }, [directList, indirectList, unmappedList]);

  // Available Line Options for Filter Dropdown
  const availableLines = useMemo(() => {
    const set = new Set<string>();
    allRecords.forEach(r => {
      if (r.line && r.line.trim()) set.add(r.line.trim());
    });
    return Array.from(set).sort();
  }, [allRecords]);

  // Available Shift (Ship) Options for Filter Dropdown
  const availableShips = useMemo(() => {
    const set = new Set<string>();
    allRecords.forEach(r => {
      if (r.ship && r.ship.trim()) set.add(r.ship.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [allRecords]);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return allRecords.filter(rec => {
      // Type Filter
      if (typeFilter === 'DIRECT' && rec.type !== 'DIRECT') return false;
      if (typeFilter === 'INDIRECT' && rec.type !== 'INDIRECT') return false;
      if (typeFilter === 'UNMAPPED' && !rec.is_unmapped && rec.line_out !== '') return false;

      // Line Filter
      if (lineFilter !== 'ALL' && (rec.line || '').trim() !== lineFilter) return false;

      // Shift (Ship) Filter
      if (shipFilter !== 'ALL' && (rec.ship || '').trim().toUpperCase() !== shipFilter) return false;

      // Search Filter
      if (searchTerm.trim() !== '') {
        const query = searchTerm.trim().toLowerCase();
        const code = (rec.cost_center_code || '').toLowerCase();
        const name = (rec.cost_center_name || '').toLowerCase();
        const lineOut = (rec.line_out || '').toLowerCase();
        const proc = (rec.process || '').toLowerCase();
        const line = (rec.line || '').toLowerCase();
        const ship = (rec.ship || '').toLowerCase();
        return code.includes(query) || name.includes(query) || lineOut.includes(query) || proc.includes(query) || line.includes(query) || ship.includes(query);
      }
      return true;
    });
  }, [allRecords, typeFilter, lineFilter, shipFilter, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, page]);

  // Open Form for Create
  const handleOpenCreate = (prefillCode: string = '') => {
    const existing = prefillCode ? allRecords.find(r => r.cost_center_code?.trim().toUpperCase() === prefillCode.trim().toUpperCase()) : null;
    if (existing) {
      handleOpenEdit(existing);
      return;
    }
    setEditingRecord(null);
    setFormCode(prefillCode.toUpperCase());
    setFormName(prefillCode ? `${prefillCode} Line` : '');
    setFormType('DIRECT');
    setFormProcess('IND');
    setFormLine('IND');
    setFormShip('D');
    setFormLineOut('');
    setFormError('');
    setIsFormOpen(true);
  };

  // Open Form for Edit
  const handleOpenEdit = (rec: CostCenterRecord) => {
    setEditingRecord(rec);
    setFormCode(rec.cost_center_code || '');
    setFormName(rec.cost_center_name || '');
    setFormType(rec.type || 'DIRECT');
    setFormProcess(rec.process || 'IND');
    setFormLine(rec.line || 'IND');
    setFormShip(rec.ship || 'D');
    setFormLineOut(rec.line_out || '');
    setFormError('');
    setIsFormOpen(true);
  };

  // Save Record
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim()) {
      setFormError('กรุณากรอกรหัส Cost Center');
      return;
    }
    if (!formName.trim()) {
      setFormError('กรุณากรอกชื่อ Cost Center');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const payload = {
        cost_center_code: formCode.trim().toUpperCase(),
        cost_center_name: formName.trim(),
        type: formType,
        process: formProcess.trim(),
        line: formLine.trim(),
        ship: formShip.trim().toUpperCase(),
        line_out: formLineOut.trim(),
        current_type: editingRecord?.type,
        performed_by: adminDisplayName
      };

      const url = editingRecord && !editingRecord.is_unmapped
        ? `${getApiBaseUrl()}/productivity/settings/cost-centers/${editingRecord.id}`
        : `${getApiBaseUrl()}/productivity/settings/cost-centers`;

      const method = editingRecord && !editingRecord.is_unmapped ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save record');

      Swal.fire({
        icon: 'success',
        title: 'บันทึกสำเร็จ',
        text: 'บันทึกการตั้งค่า Cost Center เรียบร้อยแล้ว',
        timer: 1500,
        showConfirmButton: false
      });

      if (editingRecord && !editingRecord.is_unmapped) {
        setIsFormOpen(false);
      } else {
        // Keep form open for continuous adding, but reset fields
        setFormCode('');
        setFormName('');
        setFormType('DIRECT');
        setFormProcess('IND');
        setFormLine('IND');
        setFormShip('D');
        setFormLineOut('');
        setEditingRecord(null);
      }

      fetchData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setFormError(err.message || 'Cannot save record');
    } finally {
      setSaving(false);
    }
  };

  // Delete Record
  const handleDelete = async (rec: CostCenterRecord) => {
    const confirm = await Swal.fire({
      title: `ลบ Cost Center ${rec.cost_center_code}?`,
      text: `ต้องการลบรายการ ${rec.cost_center_name} ออกจากระบบใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'ลบรายการ',
      cancelButtonText: 'ยกเลิก'
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`${getApiBaseUrl()}/productivity/settings/cost-centers/${rec.id}?type=${rec.type}&performed_by=${encodeURIComponent(adminDisplayName)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete record');

      Swal.fire({
        icon: 'success',
        title: 'ลบรายการเรียบร้อย',
        timer: 1500,
        showConfirmButton: false
      });

      fetchData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: err.message || 'Cannot delete record'
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-base-100 rounded-3xl shadow-2xl border border-base-300 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-base-200 flex items-center justify-between bg-gradient-to-r from-base-100 via-base-200/40 to-base-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-base-content flex items-center gap-2">
              Cost Center Management Settings
              <span className="badge badge-primary badge-sm font-semibold">
                {allRecords.length} Items
              </span>
            </h2>
            <p className="text-xs text-base-content/60">
              จัดการการแมป Cost Center และ Line Out สำหรับการคำนวณกำลังคน (Manpower)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Unmapped HR Banner Alert */}
        {unmappedList.length > 0 && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between text-amber-700 dark:text-amber-300 text-xs shrink-0">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle size={16} className="text-amber-500 shrink-0" />
              <span>
                พบ {unmappedList.length} Cost Center ในข้อมูลรูดบัตร HR ที่ยังไม่ได้ผูก Line Out
              </span>
            </div>
            <button
              onClick={() => setTypeFilter('UNMAPPED')}
              className="btn btn-xs bg-amber-500 text-white hover:bg-amber-600 border-none font-bold rounded-lg px-2.5 shadow-xs flex items-center gap-1"
            >
              <span>ดูรายการที่ยังไม่ได้ผูก ({unmappedList.length})</span>
              <ArrowRight size={12} />
            </button>
          </div>
        )}

        {/* Controls Bar (Single Horizontal Row Layout) */}
        <div className="p-3.5 border-b border-base-200 bg-base-100 flex items-center justify-between gap-2 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Search Box (Compact) */}
            <div className="relative w-48 sm:w-56 shrink-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input
                type="text"
                className="input input-sm input-bordered w-full pl-8 pr-3 rounded-xl text-xs focus:ring-2 focus:ring-primary/20"
                placeholder="Search Cost Center, Line..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* 1. Type Dropdown */}
            <select
              className="select select-sm select-bordered rounded-xl text-xs font-bold bg-base-100 shadow-2xs max-w-[170px] truncate"
              value={typeFilter}
              onChange={e => {
                setTypeFilter(e.target.value as any);
                setPage(1);
              }}
            >
              <option value="ALL">Type: All ({allRecords.length})</option>
              <option value="DIRECT">Direct ({directList.length})</option>
              <option value="INDIRECT PRODUCTION">Indirect Prod ({indirectProdList.length})</option>
              <option value="INDIRECT">Indirect ({indirectList.length})</option>
              {unmappedList.length > 0 && (
                <option value="UNMAPPED">Unmapped ({unmappedList.length})</option>
              )}
            </select>

            {/* 2. Line Dropdown */}
            <select
              className="select select-sm select-bordered rounded-xl text-xs font-bold bg-base-100 shadow-2xs max-w-[140px] truncate"
              value={lineFilter}
              onChange={e => {
                setLineFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Line: All ({availableLines.length})</option>
              {availableLines.map(line => (
                <option key={line} value={line}>
                  Line: {line}
                </option>
              ))}
            </select>

            {/* 3. Shift (Ship) Dropdown */}
            <select
              className="select select-sm select-bordered rounded-xl text-xs font-bold bg-base-100 shadow-2xs max-w-[120px] truncate"
              value={shipFilter}
              onChange={e => {
                setShipFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Shift: All ({availableShips.length})</option>
              {availableShips.map(ship => (
                <option key={ship} value={ship}>
                  Shift {ship}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                fetchAuditLogs();
                setShowHistoryModal(true);
              }}
              className="btn btn-sm btn-outline border-base-300 gap-1 font-bold rounded-xl text-xs px-2.5"
              title="View Cost Center edit history"
            >
              <History size={14} className="text-info" />
              <span className="hidden sm:inline">History</span>
            </button>

            <button
              onClick={() => handleOpenCreate('')}
              className="btn btn-sm btn-primary gap-1 font-bold rounded-xl shadow-sm text-xs px-3"
            >
              <Plus size={14} />
              <span>Add Cost Center</span>
            </button>
          </div>
        </div>

        {/* Prompt when Search query has 0 exact match */}
        {searchTerm.trim() !== '' && filteredRecords.length === 0 && (
          <div className="px-6 py-4 bg-primary/5 border-b border-primary/10 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              <span>ไม่พบรหัส Cost Center <strong>"{searchTerm.trim()}"</strong> ในระบบ</span>
            </div>
            <button
              onClick={() => handleOpenCreate(searchTerm.trim())}
              className="btn btn-xs btn-primary font-bold gap-1 rounded-lg shadow-xs"
            >
              <Plus size={13} />
              <span>คลิกเพื่อเพิ่ม Cost Center "{searchTerm.trim().toUpperCase()}"</span>
            </button>
          </div>
        )}

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-base-content/50 gap-2">
              <RefreshCw size={24} className="animate-spin text-primary" />
              <span className="text-xs font-semibold">กำลังโหลดข้อมูล Cost Center...</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-base-content/50 gap-2">
              <AlertCircle size={28} className="opacity-40" />
              <span className="text-xs font-semibold">ไม่พบข้อมูล Cost Center ตามเงื่อนไขที่ค้นหา</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-base-200 bg-base-100 shadow-xs">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="bg-base-200/50 text-base-content/70 text-xs border-b border-base-200">
                    <th className="font-bold py-3 pl-4">Cost Center Code</th>
                    <th className="font-bold py-3">Cost Center Name</th>
                    <th className="font-bold py-3 text-center">Type</th>
                    <th className="font-bold py-3 text-center">Process</th>
                    <th className="font-bold py-3 text-center">Line / Ship</th>
                    <th className="font-bold py-3">Mapped Line (line_out)</th>
                    <th className="font-bold py-3 text-right pr-4">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-200/60 text-xs">
                  {paginatedRecords.map(rec => (
                    <tr
                      key={`${rec.source_table || 'cc'}-${rec.id || rec.cost_center_code}`}
                      className="hover:bg-base-200/40 transition-colors"
                    >
                      <td className="font-bold font-mono text-primary py-3 pl-4">
                        {rec.cost_center_code?.trim() ? (
                          rec.cost_center_code
                        ) : (
                          <span className="text-base-content/40 italic font-normal text-[11px]">(ไม่มีรหัส)</span>
                        )}
                      </td>
                      <td className="font-medium text-base-content max-w-[240px] truncate" title={rec.cost_center_name}>
                        {rec.cost_center_name?.trim() ? (
                          rec.cost_center_name
                        ) : (
                          <span className="text-base-content/40 italic font-normal text-[11px]">(ไม่มีชื่อ)</span>
                        )}
                      </td>
                      <td className="text-center py-3">
                        <span className={`badge badge-sm font-bold text-[10px] ${rec.type === 'DIRECT'
                            ? 'badge-primary'
                            : (rec.type === 'INDIRECT PRODUCTION' ? 'badge-accent' : 'badge-secondary')
                          }`}>
                          {rec.type}
                        </span>
                      </td>
                      <td className="text-center font-mono py-3 text-base-content/70">
                        {rec.process || 'IND'}
                      </td>
                      <td className="text-center font-mono py-3 text-base-content/70">
                        {rec.line || 'IND'} / {rec.ship || 'D'}
                      </td>
                      <td className="py-3">
                        {rec.line_out ? (
                          <span className="badge badge-outline badge-primary font-bold text-xs gap-1 py-2 px-2.5 shadow-2xs">
                            <Layers size={12} />
                            {rec.line_out}
                          </span>
                        ) : (
                          <span className="text-amber-500 font-semibold italic text-[11px] bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            ยังไม่ได้ผูก Line
                          </span>
                        )}
                      </td>
                      <td className="text-right py-3 pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(rec)}
                            className="btn btn-xs btn-ghost btn-square text-info hover:bg-info/10 rounded-lg"
                            title="แก้ไข"
                          >
                            <Edit2 size={14} />
                          </button>
                          {!rec.is_unmapped && (
                            <button
                              onClick={() => handleDelete(rec)}
                              className="btn btn-xs btn-ghost btn-square text-error hover:bg-error/10 rounded-lg"
                              title="ลบ"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer & Pagination */}
        <div className="px-6 py-3 border-t border-base-200 bg-base-200/30 flex items-center justify-between shrink-0 text-xs">
          <div className="text-base-content/60 font-semibold">
            แสดงข้อมูล {paginatedRecords.length} จากทั้งหมด {filteredRecords.length} รายการ
          </div>

          {totalPages > 1 && (
            <div className="join bg-base-100 rounded-xl border border-base-300 shadow-xs">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="join-item btn btn-xs btn-ghost disabled:opacity-40"
              >
                ก่อนหน้า
              </button>
              <span className="join-item btn btn-xs btn-ghost no-animation font-bold text-primary">
                {page} / {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="join-item btn btn-xs btn-ghost disabled:opacity-40"
              >
                ถัดไป
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-base-100 rounded-3xl shadow-2xl border border-base-300 w-full max-w-xl flex flex-col relative">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-base-200 flex items-center justify-between bg-gradient-to-r from-base-100 via-base-200/40 to-base-100 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shadow-xs">
                  {editingRecord ? <Edit2 size={18} /> : <Plus size={20} />}
                </div>
                <div>
                  <h3 className="font-bold text-base text-base-content">
                    {editingRecord ? 'Edit Cost Center Mapping' : 'Add New Cost Center'}
                  </h3>
                  <p className="text-xs text-base-content/60">
                    ตั้งค่าคุณลักษณะ Cost Center และผูกเข้ากับ Line Output Group
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsFormOpen(false)}
                className="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {formError && (
                <div className="alert alert-error p-3 text-xs rounded-xl flex items-center gap-2 font-semibold">
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              {/* Row 1: Code & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cost Center Code */}
                <div className="w-full relative">
                  <label className="block text-xs font-bold text-base-content mb-1.5 flex items-center justify-between">
                    <span>Cost Center Code <span className="text-error">*</span></span>
                    {allRecords.some(r => r.cost_center_code === formCode.trim()) && (
                      <span className="text-[10px] text-success font-bold flex items-center gap-1">
                        <Check size={11} /> Auto-filled from record
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                    <input
                      type="text"
                      className="input input-sm input-bordered w-full pl-9 pr-8 font-mono font-bold uppercase rounded-xl focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g. P530-1A"
                      value={formCode}
                      onFocus={() => setShowCodeDropdown(true)}
                      onChange={e => handleCodeChange(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-xs btn-ghost btn-circle"
                      onClick={() => setShowCodeDropdown(!showCodeDropdown)}
                    >
                      <ChevronDown size={14} className={showCodeDropdown ? 'rotate-180 text-primary' : ''} />
                    </button>
                  </div>

                  {/* Combobox Suggestions for Code */}
                  {showCodeDropdown && formCode.trim() !== '' && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-[110] max-h-48 overflow-y-auto bg-base-100 border border-base-300 rounded-2xl shadow-2xl p-1.5 text-xs animate-fadeIn">
                      <div className="px-2 py-1 text-[10px] font-bold text-base-content/50 uppercase border-b border-base-200 mb-1">
                        Existing Cost Center Codes
                      </div>
                      {allRecords
                        .filter(r => r.cost_center_code && r.cost_center_code.includes(formCode.trim()))
                        .slice(0, 10)
                        .map(rec => (
                          <div
                            key={rec.id || rec.cost_center_code}
                            className="px-2.5 py-1.5 hover:bg-primary/10 rounded-lg cursor-pointer font-semibold flex items-center justify-between transition-colors"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectCodeRecord(rec);
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="font-mono font-bold text-primary">{rec.cost_center_code}</span>
                              <span className="text-[11px] text-base-content/60 truncate max-w-[200px]">
                                {rec.cost_center_name} ({rec.line_out || 'Unmapped'})
                              </span>
                            </div>
                            <Check size={12} className={formCode === rec.cost_center_code ? 'text-primary font-bold' : 'opacity-0'} />
                          </div>
                        ))}
                      {allRecords.filter(r => r.cost_center_code && r.cost_center_code.includes(formCode.trim())).length === 0 && (
                        <div className="px-2.5 py-2 text-base-content/50 italic text-[11px]">
                          No matching record. Type new details below.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Type */}
                <div className="w-full">
                  <label className="block text-xs font-bold text-base-content mb-1.5">
                    Type <span className="text-error">*</span>
                  </label>
                  <select
                    className="select select-sm select-bordered w-full font-bold rounded-xl focus:ring-2 focus:ring-primary/20"
                    value={formType}
                    onChange={e => setFormType(e.target.value as 'DIRECT' | 'INDIRECT' | 'INDIRECT PRODUCTION')}
                  >
                    <option value="DIRECT">DIRECT (Direct Production)</option>
                    <option value="INDIRECT PRODUCTION">INDIRECT PRODUCTION (ฝ่ายสนับสนุนการผลิต)</option>
                    <option value="INDIRECT">INDIRECT (Support / Indirect)</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Cost Center Name */}
              <div className="w-full">
                <label className="block text-xs font-bold text-base-content mb-1.5">
                  Cost Center Name <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  className="input input-sm input-bordered w-full px-3.5 rounded-xl font-medium focus:ring-2 focus:ring-primary/20 text-xs"
                  placeholder="e.g. P530-1A/SMT-INT"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  required
                />
              </div>

              {/* Row 3: Process, Line, Shift */}
              <div className="grid grid-cols-3 gap-3">
                {/* Process */}
                <div className="w-full">
                  <label className="block text-xs font-semibold text-base-content/70 mb-1">Process</label>
                  <input
                    type="text"
                    className="input input-sm input-bordered w-full px-3 rounded-xl uppercase text-xs"
                    placeholder="e.g. IND"
                    value={formProcess}
                    onChange={e => setFormProcess(e.target.value.toUpperCase())}
                  />
                </div>

                {/* Line */}
                <div className="w-full">
                  <label className="block text-xs font-semibold text-base-content/70 mb-1">Line</label>
                  <input
                    type="text"
                    className="input input-sm input-bordered w-full px-3 rounded-xl text-xs font-medium"
                    placeholder="e.g. AIX-BLK"
                    value={formLine}
                    onChange={e => {
                      const newLine = e.target.value;
                      setFormLine(newLine);
                      if (newLine.trim()) {
                        setFormLineOut(`${newLine.trim()}/${formShip}`);
                      } else {
                        setFormLineOut('');
                      }
                    }}
                  />
                </div>

                {/* Shift */}
                <div className="w-full">
                  <label className="block text-xs font-semibold text-base-content/70 mb-1">Shift</label>
                  <select
                    className="select select-sm select-bordered w-full rounded-xl font-bold text-xs"
                    value={formShip}
                    onChange={e => {
                      const newShip = e.target.value;
                      setFormShip(newShip);
                      if (formLine.trim()) {
                        setFormLineOut(`${formLine.trim()}/${newShip}`);
                      }
                    }}
                  >
                    <option value="A">Shift A</option>
                    <option value="B">Shift B</option>
                    <option value="D">Shift D</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Mapped Line Group (line_out) Card Container */}
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <Layers size={15} />
                    Mapped Line Group (line_out)
                  </label>
                  <span className="text-[10px] text-base-content/50 font-medium">
                    Select from list or type custom
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    className="input input-sm input-bordered w-full rounded-xl pr-8 font-bold text-primary text-xs focus:ring-2 focus:ring-primary/20 bg-base-100"
                    placeholder="e.g. ASY1_A/A, Line A_GEN, S_TSTE-F/A"
                    value={formLineOut}
                    onFocus={() => setShowLineOutDropdown(true)}
                    onChange={e => {
                      setFormLineOut(e.target.value);
                      setShowLineOutDropdown(true);
                    }}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-xs btn-ghost btn-circle"
                    onClick={() => setShowLineOutDropdown(!showLineOutDropdown)}
                  >
                    <ChevronDown size={14} className={showLineOutDropdown ? 'rotate-180 text-primary' : ''} />
                  </button>
                </div>

                {/* Combobox Dropdown Suggestions (Opens Downwards below input) */}
                {showLineOutDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-[100] max-h-48 overflow-y-auto bg-base-100 border border-base-300 rounded-2xl shadow-2xl p-1.5 text-xs animate-fadeIn">
                    <div className="px-2 py-1 text-[10px] font-bold text-base-content/50 uppercase border-b border-base-200 mb-1">
                      Active Line Output Groups
                    </div>
                    {availableLineGroups
                      .filter(g => g.toLowerCase().includes(formLineOut.toLowerCase()))
                      .map(group => (
                        <div
                          key={group}
                          className="px-2.5 py-1.5 hover:bg-primary/10 rounded-lg cursor-pointer font-semibold flex items-center justify-between transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setFormLineOut(group);
                            setShowLineOutDropdown(false);
                          }}
                        >
                          <span>{group}</span>
                          <Check size={12} className={formLineOut === group ? 'text-primary font-bold' : 'opacity-0'} />
                        </div>
                      ))}
                    {formLineOut.trim() !== '' && !availableLineGroups.includes(formLineOut.trim()) && (
                      <div
                        className="px-2.5 py-1.5 text-primary hover:bg-primary/10 rounded-lg cursor-pointer font-bold flex items-center justify-between border-t border-base-200 mt-1"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setShowLineOutDropdown(false);
                        }}
                      >
                        <span>Use custom name "{formLineOut.trim()}"</span>
                        <Plus size={12} />
                      </div>
                    )}
                  </div>
                )}

                {/* Live Preview & Line Help Verification Box */}
                <div className="pt-2 border-t border-primary/10 flex flex-col gap-2">
                  {/* Live Mapping Preview Badge */}
                  <div className="flex items-center justify-between bg-base-100 p-2.5 rounded-xl border border-primary/15 text-xs">
                    <div className="flex items-center gap-1.5 text-base-content/70 font-semibold text-[11px]">
                      <Sparkles size={13} className="text-primary shrink-0" />
                      <span>Live Mapping Preview:</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono font-bold text-xs text-primary">
                      <span>{formCode || 'CC'}</span>
                      <span className="text-base-content/40">➔</span>
                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20">
                        {formLineOut.trim() || `${formLine}/${formShip}`}
                      </span>
                    </div>
                  </div>

                  {/* Line Help Verification Button & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={checkingHelp}
                      onClick={handleCheckLineHelp}
                      className="btn btn-xs btn-outline btn-primary gap-1 font-bold rounded-lg text-[11px]"
                    >
                      {checkingHelp ? <RefreshCw size={12} className="animate-spin" /> : <Activity size={12} />}
                      <span>Verify Mapping</span>
                    </button>

                    {helpResult && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${helpResult.lineMismatch
                          ? 'bg-error/15 text-error'
                          : helpResult.status === 'READY'
                            ? 'bg-success/15 text-success'
                            : 'bg-warning/15 text-warning-content'
                        }`}>
                        {helpResult.lineMismatch ? (
                          <>
                            <AlertCircle size={12} />
                            Line Name Mismatch
                          </>
                        ) : helpResult.status === 'READY' ? (
                          <>
                            <Check size={12} />
                            Line Matched
                          </>
                        ) : (
                          <>
                            <AlertCircle size={12} />
                            New Mapping
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Red Warning Banner for Line Name Mismatch */}
                  {helpResult && helpResult.lineMismatch && helpResult.detectedLine && (
                    <div className="p-2.5 rounded-xl bg-error/10 border border-error/30 text-[11px] text-error space-y-1.5">
                      <div className="font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1 font-extrabold text-xs">
                          <AlertTriangle size={14} />
                          ตรวจพบการเปลี่ยนชื่อไลน์ (Line Name Mismatch Detected)
                        </span>
                        <span className="font-mono text-[10px] bg-error/20 text-error font-bold px-1.5 py-0.5 rounded">
                          Code: {helpResult.cost_center_code}
                        </span>
                      </div>
                      <div className="text-[11px] text-error font-medium leading-relaxed">
                        รหัส Cost Center <strong>{helpResult.cost_center_code}</strong> ตรงกับระบบ HR แต่ชื่อไลน์ถูกย้าย/เปลี่ยนจาก{' '}
                        <span className="font-mono font-bold line-through px-1.5 py-0.5 bg-error/20 rounded">
                          {helpResult.line_out}
                        </span>{' '}
                        เป็น{' '}
                        <span className="font-mono font-bold text-emerald-700 px-1.5 py-0.5 bg-emerald-100 rounded">
                          {helpResult.detectedLine}
                        </span>
                      </div>
                      <div className="pt-0.5 flex items-center justify-between">
                        <span className="text-[10px] text-error/80">คลิกเพื่ออัปเดตชื่อไลน์ให้ตรงกับ HR อัตโนมัติ:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newMappedLine = helpResult.detectedLine;
                            setFormLineOut(newMappedLine);
                            if (newMappedLine.includes('/')) {
                              const baseL = newMappedLine.split('/')[0].trim();
                              setFormLine(baseL);
                            } else {
                              setFormLine(newMappedLine);
                            }
                          }}
                          className="btn btn-xs btn-error text-white font-bold rounded-lg text-[10px]"
                        >
                          อัปเดตเป็น {helpResult.detectedLine}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Line Help Result Details Banner */}
                  {helpResult && !helpResult.error && (
                    <div className="p-2.5 rounded-xl bg-base-100 border border-base-200 text-[11px] space-y-1.5">
                      <div className="font-bold text-base-content/80 flex items-center justify-between">
                        <span>Line Help Match Results:</span>
                        <span className="font-mono text-primary">{helpResult.line_out || helpResult.cost_center_code}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 pt-1 text-center font-medium">
                        <div className="bg-base-200/50 p-1 rounded-lg">
                          <span className="block text-[10px] text-base-content/50">HR Employees</span>
                          <span className="font-bold text-xs text-primary">{helpResult.employeeCount}</span>
                        </div>
                        <div className="bg-base-200/50 p-1 rounded-lg">
                          <span className="block text-[10px] text-base-content/50">Help In Logs</span>
                          <span className="font-bold text-xs text-emerald-600">{helpResult.helpInMatches || 0}</span>
                        </div>
                        <div className="bg-base-200/50 p-1 rounded-lg">
                          <span className="block text-[10px] text-base-content/50">Help Out Loans</span>
                          <span className="font-bold text-xs text-info">{helpResult.helpOutMatches || 0}</span>
                        </div>
                        <div className="bg-base-200/50 p-1 rounded-lg">
                          <span className="block text-[10px] text-base-content/50">Line Output</span>
                          <span className={`font-bold text-xs ${helpResult.outputGroupFound ? 'text-success' : 'text-base-content/40'}`}>
                            {helpResult.outputGroupFound ? 'Found' : 'Custom'}
                          </span>
                        </div>
                      </div>

                      {/* Display Matched HR Department details */}
                      {helpResult.matchedDepts && helpResult.matchedDepts.length > 0 && (
                        <div className="pt-1 border-t border-base-200/60 text-[10px] text-base-content/70">
                          <strong>Matched HR Dept:</strong>{' '}
                          <span className="font-mono text-primary font-semibold">{helpResult.matchedDepts.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-base-200">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="btn btn-sm btn-ghost rounded-xl font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-sm btn-primary rounded-xl font-bold px-5 gap-1.5 shadow-sm text-xs"
                >
                  {saving && <RefreshCw size={14} className="animate-spin" />}
                  <span>{editingRecord ? 'Save Changes' : 'Add Cost Center'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Log History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-base-100 rounded-3xl shadow-2xl border border-base-300 w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-base-200 flex items-center justify-between bg-base-200/40">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-info/10 text-info flex items-center justify-center font-bold">
                  <History size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-base-content flex items-center gap-2">
                    ประวัติการแก้ไข Cost Center (Audit Logs)
                    <span className="badge badge-info badge-sm font-semibold">
                      {auditLogs.length} Records
                    </span>
                  </h3>
                  <p className="text-xs text-base-content/60">
                    ประวัติการเพิ่ม แก้ไข หรือลบการตั้งค่า Cost Center
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="btn btn-xs btn-circle btn-ghost"
              >
                <X size={16} />
              </button>
            </div>

            {/* Logs List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingLogs ? (
                <div className="h-48 flex flex-col items-center justify-center text-base-content/50 gap-2">
                  <RefreshCw size={24} className="animate-spin text-info" />
                  <span className="text-xs font-semibold">กำลังดึงประวัติการแก้ไข...</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-base-content/50 gap-2">
                  <AlertCircle size={24} className="opacity-40" />
                  <span className="text-xs font-semibold">ยังไม่มีประวัติการแก้ไขในระบบ</span>
                </div>
              ) : (
                auditLogs.map((log: any) => {
                  const action = (log.action_type || '').toUpperCase();
                  const actionBadge =
                    action === 'CREATE'
                      ? 'badge-success text-white'
                      : action === 'UPDATE'
                        ? 'badge-info text-white'
                        : 'badge-error text-white';

                  const oldObj = log.old_data || {};
                  const newObj = log.new_data || {};

                  return (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-2xl border border-base-200 bg-base-100 hover:border-base-300 transition-colors shadow-2xs text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`badge badge-sm font-bold text-[10px] ${actionBadge}`}>
                            {action}
                          </span>
                          <span className="font-bold font-mono text-primary text-sm">
                            {log.cost_center_code || 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-base-content/50 text-[11px]">
                          <span className="font-semibold text-base-content/70">
                            โดย: <strong>{log.performed_by || 'Admin'}</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(log.created_at).toLocaleString('th-TH')}
                          </span>
                        </div>
                      </div>

                      {/* Diff Details */}
                      <div className="bg-base-200/50 p-2.5 rounded-xl border border-base-200 text-[11px] font-mono space-y-1">
                        {action === 'CREATE' && (
                          <div className="text-emerald-600 font-semibold">
                            + เพิ่ม Cost Center: <strong>{newObj.cost_center_name || log.cost_center_code}</strong> | Type: <strong>{newObj.type}</strong> | Mapped Line (line_out): <strong>{newObj.line_out || 'ยังไม่ได้ผูก'}</strong>
                          </div>
                        )}

                        {action === 'DELETE' && (
                          <div className="text-red-500 font-semibold">
                            - ลบ Cost Center: <strong>{oldObj.cost_center_name || log.cost_center_code}</strong> (line_out: {oldObj.line_out || 'ไม่มี'})
                          </div>
                        )}

                        {action === 'UPDATE' && (
                          <div className="space-y-1">
                            {oldObj.line_out !== newObj.line_out && (
                              <div>
                                <span className="text-base-content/50">Line Out:</span>{' '}
                                <span className="line-through text-red-500">{oldObj.line_out || '(ว่าง)'}</span>{' '}
                                <span className="text-emerald-600 font-bold">➔ {newObj.line_out || '(ว่าง)'}</span>
                              </div>
                            )}
                            {oldObj.cost_center_name !== newObj.cost_center_name && (
                              <div>
                                <span className="text-base-content/50">Name:</span>{' '}
                                <span className="line-through text-red-500">{oldObj.cost_center_name || '(ว่าง)'}</span>{' '}
                                <span className="text-emerald-600 font-bold">➔ {newObj.cost_center_name}</span>
                              </div>
                            )}
                            {oldObj.type !== newObj.type && (
                              <div>
                                <span className="text-base-content/50">Type:</span>{' '}
                                <span className="line-through text-red-500">{oldObj.type}</span>{' '}
                                <span className="text-emerald-600 font-bold">➔ {newObj.type}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-base-200 bg-base-200/30 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="btn btn-sm btn-ghost rounded-xl font-bold text-xs"
              >
                ปิดหน้าต่างประวัติ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

