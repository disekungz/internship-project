import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Edit2, Pencil, Trash2, Save, X, Search, AlertCircle, RefreshCcw,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Clock, Database, PlusCircle,
  CheckSquare, Square, Cpu, SlidersHorizontal, BarChart3
} from 'lucide-react';
import { CheckGroupOutputModal } from './modals/CheckGroupOutputModal';
import Swal from 'sweetalert2';
import toast from 'react-hot-toast';
import { getApiBaseUrl } from '../../../../utils/apiConfig';

const API_BASE_URL = getApiBaseUrl();

type LineGroupRecord = {
  id: number;
  group_name: string;
  process_name: string;
  mc_line: string | null;
  prd_prefix: string | null;
  exclude_prefixes?: string | null;
  factory: 'SMT' | 'FPC' | 'QA' | string;
  is_active: boolean;
};

type GroupedRecord = {
  factory: 'SMT' | 'FPC' | 'QA' | string;
  group_name: string;
  process_name: string;
  items: LineGroupRecord[];
};

const GroupRow = ({
  group,
  onRenameGroup,
  onManageMachines,
  onEditGroup,
  onDeleteGroup,
  onCheckOutput
}: {
  group: GroupedRecord;
  onRenameGroup: (g: GroupedRecord) => void;
  onManageMachines: (g: GroupedRecord) => void;
  onEditGroup?: (g: GroupedRecord) => void;
  onDeleteGroup?: (g: GroupedRecord) => void;
  onCheckOutput?: (g: GroupedRecord) => void;
}) => {
  const mcLines = Array.from(
    new Set(
      group.items
        .flatMap(i => (i.mc_line || '').split(/[\n,]+/))
        .map(m => m.trim().toUpperCase())
        .filter(Boolean)
    )
  );
  const prefixes = Array.from(
    new Set(
      group.items
        .flatMap(i => (i.prd_prefix || '').split(/[\n,]+/))
        .map(p => p.trim().toUpperCase())
        .filter(Boolean)
    )
  );
  const excludePrefixes = Array.from(
    new Set(
      group.items
        .flatMap(i => (i.exclude_prefixes || '').split(/[\n,]+/))
        .map(p => p.trim().toUpperCase())
        .filter(Boolean)
    )
  );

  return (
    <tr className="hover:bg-base-200/50 transition-colors">
      <td>
        {group.factory === 'SMT' ? (
          <span className="badge badge-sm bg-amber-500/10 text-amber-600 border-none font-bold">SMT</span>
        ) : group.factory === 'QA' ? (
          <span className="badge badge-sm bg-purple-500/10 text-purple-600 border-none font-bold">QA</span>
        ) : group.factory === 'FPC' ? (
          <span className="badge badge-sm bg-emerald-500/10 text-emerald-600 border-none font-bold">FPC</span>
        ) : (
          <span className="badge badge-sm bg-primary/10 text-primary border-none font-bold">{group.factory}</span>
        )}
      </td>
      <td className="font-semibold text-primary">
        {group.group_name}
      </td>
      <td><span className="badge badge-ghost badge-sm">{group.process_name}</span></td>
      <td>
        <div className="flex flex-wrap items-center gap-1">
          {mcLines.slice(0, 3).map(mc => (
            <span key={mc} className="badge badge-sm">{mc}</span>
          ))}
          {mcLines.length > 3 && (
            <span className="badge badge-sm bg-base-300 font-bold">
              +{mcLines.length - 3}
            </span>
          )}
          {mcLines.length === 0 && <span className="text-base-content/40">-</span>}
        </div>
      </td>
      <td>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap gap-1">
            {prefixes.slice(0, 3).map(p => (
              <span key={p} className="badge badge-sm badge-outline">{p}</span>
            ))}
            {prefixes.length > 3 && (
              <span className="badge badge-sm bg-base-300">+{prefixes.length - 3}</span>
            )}
            {prefixes.length === 0 && excludePrefixes.length === 0 && <span className="text-base-content/40">-</span>}
          </div>
          {excludePrefixes.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-[10px] text-error/80">
              <span className="font-bold">ยกเว้น:</span>
              {excludePrefixes.slice(0, 2).map(ep => (
                <span key={ep} className="badge badge-xs badge-error badge-outline">{ep}</span>
              ))}
              {excludePrefixes.length > 2 && (
                <span className="badge badge-xs badge-ghost">+{excludePrefixes.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </td>
      <td className="text-right pr-4">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            className="btn btn-xs btn-ghost btn-square text-emerald-600 hover:bg-emerald-500/10 rounded-lg"
            onClick={() => onCheckOutput ? onCheckOutput(group) : undefined}
            title="ตรวจสอบ Output ของกลุ่มนี้"
          >
            <BarChart3 size={14} />
          </button>
          <button
            type="button"
            className="btn btn-xs btn-ghost btn-square text-info hover:bg-info/10 rounded-lg"
            onClick={() => onEditGroup ? onEditGroup(group) : onRenameGroup(group)}
            title="แก้ไข Line Mapping ในฟอร์มด้านซ้าย"
          >
            <Edit2 size={14} />
          </button>
          <button
            type="button"
            className="btn btn-xs btn-ghost btn-square text-primary hover:bg-primary/10 rounded-lg"
            onClick={() => onManageMachines(group)}
            title="ตั้งค่าและจัดการเครื่องจักร"
          >
            <SlidersHorizontal size={14} />
          </button>
          <button
            type="button"
            className="btn btn-xs btn-ghost btn-square text-error hover:bg-error/10 rounded-lg"
            onClick={() => onDeleteGroup ? onDeleteGroup(group) : undefined}
            title="ลบ Line Mapping นี้"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
};

const ManageGroupMachinesModal = ({
  group,
  availableMcLines,
  onClose,
  onSuccess
}: {
  group: GroupedRecord;
  availableMcLines: string[];
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const initialMachines = useMemo(() => {
    return Array.from(new Set(group.items.map(i => (i.mc_line || '').trim().toUpperCase()).filter(Boolean)));
  }, [group]);

  const [selectedMcs, setSelectedMcs] = useState<string[]>(initialMachines);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'SELECTED' | 'UNSELECTED'>('ALL');
  const [customInput, setCustomInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Combine available machines with currently selected ones
  const allKnownMachines = useMemo(() => {
    const set = new Set<string>([...availableMcLines, ...selectedMcs]);
    return Array.from(set).sort();
  }, [availableMcLines, selectedMcs]);

  // Filter machines based on search and tab
  const filteredMachines = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return allKnownMachines.filter(mc => {
      const matchSearch = mc.toLowerCase().includes(term);
      const isSelected = selectedMcs.includes(mc);

      if (!matchSearch) return false;
      if (filterTab === 'SELECTED') return isSelected;
      if (filterTab === 'UNSELECTED') return !isSelected;
      return true;
    });
  }, [allKnownMachines, searchTerm, filterTab, selectedMcs]);

  const toggleMachine = (mc: string) => {
    setSelectedMcs(prev => {
      if (prev.includes(mc)) {
        return prev.filter(m => m !== mc);
      } else {
        return [...prev, mc].sort();
      }
    });
  };

  const selectAllFiltered = () => {
    setSelectedMcs(prev => {
      const set = new Set([...prev, ...filteredMachines]);
      return Array.from(set).sort();
    });
  };

  const deselectAllFiltered = () => {
    const toRemove = new Set(filteredMachines);
    setSelectedMcs(prev => prev.filter(m => !toRemove.has(m)));
  };

  const handleAddCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = customInput.trim().toUpperCase();
    if (!raw) return;
    const parts = raw.split(/[\n,]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
    setSelectedMcs(prev => {
      const set = new Set([...prev, ...parts]);
      return Array.from(set).sort();
    });
    setCustomInput('');
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/productivity/settings/line-groups/sync-machines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factory: group.factory,
          group_name: group.group_name,
          process_name: group.process_name,
          mc_lines: selectedMcs,
          prd_prefix: group.items[0]?.prd_prefix || null
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to sync machines');
      }

      Swal.fire({
        icon: 'success',
        title: 'บันทึกสำเร็จ',
        text: `อัปเดตรายการเครื่องจักร ${selectedMcs.length} เครื่อง สำหรับกลุ่ม ${group.group_name} เรียบร้อยแล้ว`,
        timer: 2000,
        confirmButtonColor: '#4f46e5'
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error updating machines');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box w-full max-w-4xl p-0 flex flex-col max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl border border-base-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-base-200 px-6 py-4 bg-gradient-to-r from-base-100 via-base-200/30 to-base-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-xs ${group.factory === 'SMT' ? 'bg-amber-500/15 text-amber-600' : 'bg-emerald-500/15 text-emerald-600'
              }`}>
              {group.factory}
            </div>
            <div>
              <h3 className="font-bold text-lg text-base-content flex items-center gap-2">
                <span>จัดการ Machine / Line</span>
                <span className="badge badge-primary font-bold">{group.group_name}</span>
                <span className="badge badge-ghost font-medium">{group.process_name}</span>
              </h3>
              <p className="text-xs text-base-content/60">
                เลือกเครื่องจักรจากฐานข้อมูล หรือค้นหาและเลือกเป็นชุดเพื่อป้องกันการพิมพ์ผิด
              </p>
            </div>
          </div>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="alert alert-error p-3 text-sm rounded-xl">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Selected Machines Tray */}
          <div className="rounded-xl border border-base-300 bg-base-200/30 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-2">
                <Cpu size={14} className="text-primary" />
                เครื่องจักรที่เลือกไว้ ({selectedMcs.length} เครื่อง)
              </span>
              {selectedMcs.length > 0 && (
                <button
                  type="button"
                  className="btn btn-xs btn-ghost text-error hover:bg-error/10 font-bold"
                  onClick={() => setSelectedMcs([])}
                >
                  ล้างทั้งหมด
                </button>
              )}
            </div>

            {selectedMcs.length === 0 ? (
              <div className="text-center py-3 text-xs text-base-content/40 font-medium border border-dashed border-base-300 rounded-lg bg-base-100/50">
                ยังไม่ได้เลือกเครื่องจักร (ค่าเริ่มต้นจะเป็นไม่เจาะจงเครื่องจักร)
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-base-100 rounded-lg border border-base-200">
                {selectedMcs.map(mc => (
                  <span
                    key={mc}
                    className="badge badge-primary gap-1 py-2.5 px-2.5 font-semibold text-xs shadow-xs transition-all hover:scale-105"
                  >
                    {mc}
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-circle text-primary-content hover:bg-primary-content/20"
                      onClick={() => toggleMachine(mc)}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Controls: Search, Tabs & Quick Select */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 w-4 h-4" />
                <input
                  type="text"
                  placeholder="พิมพ์ค้นหาชื่อเครื่องจักร (เช่น D-20-, MBLK, SMT)..."
                  className="input input-sm input-bordered w-full pl-9 font-medium"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  autoFocus
                />
                {searchTerm && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
                    onClick={() => setSearchTerm('')}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="join bg-base-200 p-0.5 rounded-lg shrink-0">
                <button
                  type="button"
                  className={`join-item btn btn-xs ${filterTab === 'ALL' ? 'btn-primary shadow-xs' : 'btn-ghost'}`}
                  onClick={() => setFilterTab('ALL')}
                >
                  ทั้งหมด ({allKnownMachines.length})
                </button>
                <button
                  type="button"
                  className={`join-item btn btn-xs ${filterTab === 'SELECTED' ? 'btn-primary shadow-xs' : 'btn-ghost'}`}
                  onClick={() => setFilterTab('SELECTED')}
                >
                  เลือกแล้ว ({selectedMcs.length})
                </button>
                <button
                  type="button"
                  className={`join-item btn btn-xs ${filterTab === 'UNSELECTED' ? 'btn-primary shadow-xs' : 'btn-ghost'}`}
                  onClick={() => setFilterTab('UNSELECTED')}
                >
                  ยังไม่เลือก ({Math.max(0, allKnownMachines.length - selectedMcs.length)})
                </button>
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center justify-between text-xs text-base-content/60 px-1">
              <span>แสดงผล {filteredMachines.length} เครื่องจักร</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-xs btn-ghost text-primary font-bold hover:bg-primary/10"
                  onClick={selectAllFiltered}
                  disabled={filteredMachines.length === 0}
                >
                  <CheckSquare size={13} />
                  <span>เลือกทั้งหมดที่ค้นหา ({filteredMachines.length})</span>
                </button>
                <span className="text-base-content/20">|</span>
                <button
                  type="button"
                  className="btn btn-xs btn-ghost text-base-content/60 font-bold hover:bg-base-200"
                  onClick={deselectAllFiltered}
                  disabled={filteredMachines.length === 0}
                >
                  <Square size={13} />
                  <span>ยกเลิกที่ค้นหา</span>
                </button>
              </div>
            </div>
          </div>

          {/* Machine Selection Grid */}
          <div className="border border-base-300 rounded-xl bg-base-100 p-3 max-h-64 overflow-y-auto">
            {filteredMachines.length === 0 ? (
              <div className="text-center py-8 text-base-content/50 space-y-2">
                <Search size={24} className="mx-auto opacity-30" />
                <p className="text-xs">ไม่พบเครื่องจักรที่ตรงกับคำค้นหา "{searchTerm}"</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {filteredMachines.map(mc => {
                  const isChecked = selectedMcs.includes(mc);
                  return (
                    <div
                      key={mc}
                      onClick={() => toggleMachine(mc)}
                      className={`cursor-pointer rounded-lg border p-2 text-xs font-semibold flex items-center justify-between transition-all select-none ${isChecked
                        ? 'border-primary bg-primary/10 text-primary shadow-xs font-bold'
                        : 'border-base-200 hover:border-base-300 hover:bg-base-200/50 text-base-content/80'
                        }`}
                    >
                      <span className="truncate pr-1">{mc}</span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => { }} // Handled by container onClick
                        className="checkbox checkbox-primary checkbox-xs pointer-events-none shrink-0"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Custom Machine Add Input */}
          <div className="pt-2 border-t border-base-200">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="เพิ่มชื่อเครื่องจักรใหม่เอง (หากไม่มีในรายการด้านบน สามารถคั่นด้วย comma)..."
                className="input input-sm input-bordered flex-1 text-xs uppercase font-medium"
                value={customInput}
                onChange={e => setCustomInput(e.target.value.toUpperCase())}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustom();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-sm btn-neutral gap-1 text-xs font-bold"
                onClick={() => handleAddCustom()}
                disabled={!customInput.trim()}
              >
                <Plus size={14} />
                <span>เพิ่ม</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-base-200 px-6 py-4 bg-base-100 shrink-0">
          <button
            type="button"
            className="btn btn-sm btn-ghost font-bold"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary font-bold shadow-md shadow-primary/20 gap-2"
            onClick={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              <Save size={16} />
            )}
            <span>บันทึกการเปลี่ยนแปลง ({selectedMcs.length} เครื่อง)</span>
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-base-300/40 backdrop-blur-[2px]" onClick={onClose}></div>
    </div>
  );
};

const INVALID_GROUP_NAME_REGEX = /[/\\@#$%\^&*()+=\[\]{}<>?!~`"';:|]/;

export const validateGroupName = (name: string): { isValid: boolean; error?: string } => {
  const trimmed = name.trim();
  if (!trimmed) {
    return { isValid: false, error: 'กรุณาระบุชื่อกลุ่ม (Group Name)' };
  }
  if (INVALID_GROUP_NAME_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'ชื่อ Group Name ห้ามมีอักขระพิเศษ เช่น /, \\, @, #, (, ) ฯลฯ อนุญาตเฉพาะตัวอักษร ตัวเลข ช่องว่าง ขีดกลาง (-) และขีดล่าง (_) เท่านั้น'
    };
  }
  return { isValid: true };
};

const RenameGroupModal = ({
  group,
  availableProcesses = [],
  onClose,
  onSuccess
}: {
  group: GroupedRecord;
  availableProcesses?: string[];
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [groupName, setGroupName] = useState(group.group_name.toUpperCase());
  const [processName, setProcessName] = useState(group.process_name.toUpperCase());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const processOptions = useMemo(() => {
    const set = new Set<string>();
    if (group.process_name) set.add(group.process_name.trim().toUpperCase());
    (availableProcesses || []).forEach(p => {
      if (p && p.trim()) set.add(p.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [availableProcesses, group.process_name]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const finalGroupName = groupName.trim().toUpperCase();
      const finalProcessName = processName.trim().toUpperCase();

      if (!finalGroupName || !finalProcessName) {
        throw new Error('กรุณาระบุ Group Name และ Process Name ให้ครบถ้วน');
      }

      const val = validateGroupName(finalGroupName);
      if (!val.isValid) {
        throw new Error(val.error);
      }

      await Promise.all(group.items.map(record =>
        fetch(`${API_BASE_URL}/productivity/settings/line-groups/${record.id}/${record.factory}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            group_name: finalGroupName,
            process_name: finalProcessName,
            mc_line: record.mc_line ? record.mc_line.trim().toUpperCase() : null,
            prd_prefix: record.prd_prefix ? record.prd_prefix.trim().toUpperCase() : null,
            is_active: record.is_active
          })
        }).then(res => {
          if (!res.ok) throw new Error('Failed to update record');
        })
      ));
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to rename group");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box w-full max-w-md p-0 flex flex-col rounded-2xl shadow-2xl border border-base-300">
        <div className="flex items-center justify-between border-b border-base-200 px-6 py-4 bg-base-100">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Edit2 size={20} className="text-info" />
            แก้ไขชื่อ Group / Process
          </h3>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-6">
          <form onSubmit={handleSave} className="space-y-4">
            {error && <div className="alert alert-error text-xs p-3 rounded-lg"><AlertCircle size={14} /><span>{error}</span></div>}
            <div className="alert alert-info bg-info/10 text-info text-xs p-3 rounded-lg border-none">
              การแก้ไขนี้จะเปลี่ยนชื่อให้ทุกรายการ ({group.items.length} records) ภายใต้กลุ่มนี้
            </div>

            <div className="form-control">
              <label className="label py-1">
                <span className="label-text font-bold text-sm">Group Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered font-semibold uppercase font-mono"
                value={groupName}
                onChange={e => setGroupName(e.target.value.toUpperCase())}
                required
              />
            </div>

            <div className="form-control">
              <label className="label py-1">
                <span className="label-text font-bold text-sm">Process Name</span>
              </label>
              <select
                className="select select-bordered font-semibold text-primary w-full uppercase font-mono"
                value={processName}
                onChange={(e) => setProcessName(e.target.value.toUpperCase())}
                required
              >
                <option value="" disabled>-- เลือก Process Name --</option>
                {processOptions.map((proc) => (
                  <option key={proc} value={proc}>
                    {proc}
                  </option>
                ))}
              </select>
            </div>

            <div className="modal-action border-t border-base-200 pt-4 mt-6">
              <button type="button" className="btn btn-ghost font-bold" onClick={onClose} disabled={isSubmitting}>Cancel</button>
              <button type="submit" className="btn btn-primary font-bold shadow-md shadow-primary/20" disabled={isSubmitting}>
                {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : <Save size={18} />}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop bg-base-300/40 backdrop-blur-[2px]" onClick={onClose}></div>
    </div>
  );
};

export default function LineGroupSettingsPage({ onSuccess }: { onSuccess?: () => void; onClose?: () => void } = {}) {
  const [records, setRecords] = useState<LineGroupRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterFactory, setFilterFactory] = useState<'ALL' | 'SMT' | 'FPC' | 'QA' | string>('ALL');

  const [isFormPanelOpen, setIsFormPanelOpen] = useState(true);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LineGroupRecord | null>(null);
  const [editingGroup, setEditingGroup] = useState<GroupedRecord | null>(null);
  const [renamingGroup, setRenamingGroup] = useState<GroupedRecord | null>(null);
  const [managingMachinesGroup, setManagingMachinesGroup] = useState<GroupedRecord | null>(null);
  const [checkingOutputGroup, setCheckingOutputGroup] = useState<GroupedRecord | null>(null);

  const [showCustomSector, setShowCustomSector] = useState(false);
  const [customSectorInput, setCustomSectorInput] = useState('');

  const [formData, setFormData] = useState({
    factory: 'FPC' as 'SMT' | 'FPC' | 'QA' | string,
    group_name: '',
    process_name: '',
    mc_line: '',
    prd_prefix: '',
    exclude_prefixes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [groupInput, setGroupInput] = useState('');
  const [processInput, setProcessInput] = useState('');
  const [mcInput, setMcInput] = useState('');
  const [showProcessDropdown, setShowProcessDropdown] = useState(false);
  const [showMcDropdown, setShowMcDropdown] = useState(false);

  const processContainerRef = React.useRef<HTMLDivElement>(null);
  const mcContainerRef = React.useRef<HTMLDivElement>(null);

  const [availableProcesses, setAvailableProcesses] = useState<string[]>([]);
  const [availableMcLines, setAvailableMcLines] = useState<string[]>([]);
  const [smtMcLines, setSmtMcLines] = useState<string[]>([]);
  const [fpcMcLines, setFpcMcLines] = useState<string[]>([]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (processContainerRef.current && !processContainerRef.current.contains(event.target as Node)) {
        setShowProcessDropdown(false);
      }
      if (mcContainerRef.current && !mcContainerRef.current.contains(event.target as Node)) {
        setShowMcDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchOptions = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/productivity/settings/output-options`);
      if (res.ok) {
        const data = await res.json();
        if (data.processes) setAvailableProcesses(data.processes);
        if (data.mcLines) setAvailableMcLines(data.mcLines);
        if (data.smtMcLines) setSmtMcLines(data.smtMcLines);
        if (data.fpcMcLines) setFpcMcLines(data.fpcMcLines);
      }
    } catch (err) {
      console.error('Failed to load output options:', err);
    }
  };

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/productivity/settings/line-groups`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRecords(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    fetchOptions();
  }, []);

  const parseMultiValue = (value: string) => Array.from(new Set(
    value
      .split(/[\n,]+/)
      .map(item => item.trim().toUpperCase())
      .filter(Boolean)
  ));

  const addGroupValues = (value: string) => {
    const newValues = parseMultiValue(value);
    if (newValues.length === 0) return;
    const invalidVal = newValues.find(v => INVALID_GROUP_NAME_REGEX.test(v));
    if (invalidVal) {
      setFormError(`ชื่อ Group Name "${invalidVal}" มีอักขระพิเศษที่ไม่อนุญาต เช่น /, \\, @, #, (, ) ฯลฯ`);
      return;
    }
    setFormError('');
    const currentValues = parseMultiValue(formData.group_name);
    setFormData(prev => ({
      ...prev,
      group_name: Array.from(new Set([...currentValues, ...newValues])).join(', ')
    }));
    setGroupInput('');
  };

  const removeGroupValue = (value: string) => {
    setFormData(prev => ({
      ...prev,
      group_name: parseMultiValue(prev.group_name)
        .filter(g => g !== value)
        .join(', ')
    }));
  };

  const addProcessValues = (value: string) => {
    const newValues = parseMultiValue(value);
    if (newValues.length === 0) return;
    const currentValues = parseMultiValue(formData.process_name);
    setFormData(prev => ({
      ...prev,
      process_name: Array.from(new Set([...currentValues, ...newValues])).join(', ')
    }));
    setProcessInput('');
    setShowProcessDropdown(false);
  };

  const removeProcessValue = (value: string) => {
    setFormData(prev => ({
      ...prev,
      process_name: parseMultiValue(prev.process_name)
        .filter(process => process !== value)
        .join(', ')
    }));
  };

  const addMcValues = (value: string) => {
    const newValues = parseMultiValue(value);
    if (newValues.length === 0) return;
    const currentValues = parseMultiValue(formData.mc_line);
    setFormData(prev => ({
      ...prev,
      mc_line: Array.from(new Set([...currentValues, ...newValues])).join(', ')
    }));
    setMcInput('');
    setShowMcDropdown(false);
  };

  const removeMcValue = (value: string) => {
    setFormData(prev => ({
      ...prev,
      mc_line: parseMultiValue(prev.mc_line)
        .filter(mc => mc !== value)
        .join(', ')
    }));
  };

  const resetForm = () => {
    setEditingRecord(null);
    setEditingGroup(null);
    setShowCustomSector(false);
    setCustomSectorInput('');
    setFormData({
      factory: 'FPC',
      group_name: '',
      process_name: '',
      mc_line: '',
      prd_prefix: '',
      exclude_prefixes: ''
    });
    setGroupInput('');
    setProcessInput('');
    setMcInput('');
    setFormError('');
  };

  const handleCheckFormOutput = () => {
    const groupName = formData.group_name?.trim() || groupInput.trim();
    const processName = formData.process_name?.trim() || processInput.trim();
    if (!groupName && !processName) {
      toast.error('กรุณาระบุชื่อ Line Group หรือ Process ก่อนตรวจสอบ Output');
      return;
    }
    const currentMcs = machineValues.length > 0 ? machineValues.join(',') : (formData.mc_line || mcInput || '');
    setCheckingOutputGroup({
      factory: formData.factory || 'ALL',
      group_name: groupName || processName,
      process_name: processName,
      items: [{
        id: 0,
        group_name: groupName || processName,
        process_name: processName,
        mc_line: currentMcs || null,
        prd_prefix: formData.prd_prefix || null,
        exclude_prefixes: formData.exclude_prefixes || null,
        factory: formData.factory || 'ALL',
        is_active: true
      }]
    });
  };

  const handleEditGroupInForm = (group: GroupedRecord) => {
    setIsFormPanelOpen(true);
    setEditingGroup(group);
    setEditingRecord(group.items[0] || null);
    const isCustom = !['FPC', 'SMT', 'QA'].includes(group.factory);
    setShowCustomSector(isCustom);
    setCustomSectorInput(isCustom ? group.factory : '');
    const mcLines = Array.from(
      new Set(
        group.items
          .flatMap(i => (i.mc_line || '').split(/[\n,]+/))
          .map(m => m.trim().toUpperCase())
          .filter(Boolean)
      )
    ).join(', ');
    const prefixes = Array.from(
      new Set(
        group.items
          .flatMap(i => (i.prd_prefix || '').split(/[\n,]+/))
          .map(p => p.trim().toUpperCase())
          .filter(Boolean)
      )
    ).join(', ');
    const excludePrefixes = Array.from(
      new Set(
        group.items
          .flatMap(i => (i.exclude_prefixes || '').split(/[\n,]+/))
          .map(p => p.trim().toUpperCase())
          .filter(Boolean)
      )
    ).join(', ');
    setFormData({
      factory: group.factory,
      group_name: group.group_name,
      process_name: group.process_name,
      mc_line: mcLines,
      prd_prefix: prefixes,
      exclude_prefixes: excludePrefixes
    });
    setGroupInput('');
    setProcessInput('');
    setMcInput('');
    setFormError('');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!editingRecord) {
      if (groupInput.trim()) addGroupValues(groupInput);
    }
    if (processInput.trim()) addProcessValues(processInput);
    if (mcInput.trim()) addMcValues(mcInput);

    const groupNames = editingRecord
      ? [formData.group_name.trim()].filter(Boolean)
      : parseMultiValue(formData.group_name + (groupInput ? ',' + groupInput : ''));
    const processNames = parseMultiValue(formData.process_name + (processInput ? ',' + processInput : ''));
    const mcLines = parseMultiValue(formData.mc_line + (mcInput ? ',' + mcInput : ''));

    if (groupNames.length === 0) {
      setFormError('กรุณาระบุชื่อกลุ่ม (Group Name)');
      return;
    }
    if (processNames.length === 0) {
      setFormError('กรุณาระบุชื่อ Process (Process Name)');
      return;
    }

    const invalidGroup = groupNames.find(g => INVALID_GROUP_NAME_REGEX.test(g));
    if (invalidGroup) {
      setFormError(`ชื่อ Group Name "${invalidGroup}" มีอักขระพิเศษที่ไม่อนุญาต`);
      return;
    }

    const cleanPrefix = (formData.prd_prefix || '').trim().toUpperCase();
    const cleanExclude = (formData.exclude_prefixes || '').trim().toUpperCase();

    setIsSubmitting(true);
    const isEdit = !!editingRecord;
    const url = isEdit
      ? `${API_BASE_URL}/productivity/settings/line-groups/${editingRecord.id}/${editingRecord.factory}`
      : `${API_BASE_URL}/productivity/settings/line-groups`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          prd_prefix: cleanPrefix || null,
          prd_prefixes: cleanPrefix ? cleanPrefix.split(/[\n,]+/).map(p => p.trim().toUpperCase()).filter(Boolean) : [],
          exclude_prefixes: cleanExclude || null,
          group_name: groupNames.join(', '),
          process_name: processNames.join(', '),
          mc_line: mcLines.join(', '),
          mc_lines: mcLines.length > 0 ? mcLines : [null],
          item_ids: editingGroup ? editingGroup.items.map(i => i.id) : (editingRecord ? [editingRecord.id] : []),
          ...(isEdit ? {} : {
            group_names: groupNames,
            process_names: processNames,
            mc_lines: mcLines.length > 0 ? mcLines : [null]
          }),
          is_active: true
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save');
      }

      toast.success(isEdit ? 'แก้ไขข้อมูลสำเร็จ' : 'บันทึก Line Mapping สำเร็จ', { duration: 2500 });

      resetForm();
      fetchRecords();
      fetchOptions();
      onSuccess?.();
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isSyncingOutput, setIsSyncingOutput] = useState(false);

  const handleSyncRecentOutput = async () => {
    const confirm = await Swal.fire({
      title: 'ซิงค์ Output ย้อนหลัง?',
      text: 'ระบบจะนำข้อมูล Output ย้อนหลัง 30 วันมาจัดกลุ่มและบันทึกใหม่ตาม Line Group ล่าสุด',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'เริ่มซิงค์ข้อมูล',
      cancelButtonText: 'ยกเลิก'
    });
    if (!confirm.isConfirmed) return;

    setIsSyncingOutput(true);
    try {
      const res = await fetch(`${API_BASE_URL}/productivity/settings/sync-output-snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lookbackDays: 30 })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to sync output snapshot');
      }
      toast.success(
        <div className="flex flex-col gap-0.5 text-left">
          <span className="font-semibold text-sm text-slate-800 leading-snug">ซิงค์ Output สำเร็จ</span>
          <span className="text-xs text-slate-500 leading-relaxed">อัปเดตข้อมูลจำนวน {data.count} รายการเรียบร้อยแล้ว</span>
        </div>,
        { duration: 3000 }
      );
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: err.message || 'Cannot sync output snapshot'
      });
    } finally {
      setIsSyncingOutput(false);
    }
  };

  const handleDeleteGroup = async (group: GroupedRecord) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบ Line Mapping?',
      html: `
        <div class="text-left space-y-3 text-sm">
          <p>คุณต้องการลบกลุ่ม <b>${group.group_name}</b> (Process: <b>${group.process_name}</b> - Sector: <b>${group.factory}</b>, จำนวน ${group.items.length} รายการ) หรือไม่?</p>
          <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
            <label class="flex items-center gap-2 cursor-pointer font-bold select-none">
              <input type="checkbox" id="clean-snapshot-checkbox" checked class="checkbox checkbox-xs checkbox-warning" />
              <span>ลบข้อมูล Output Snapshot ในตารางรายงานด้วย</span>
            </label>
            <p class="text-[11px] text-amber-700 pl-6 leading-relaxed">
              แนะนำให้เปิดไว้ เพื่อลบยอดที่เคยบันทึก Snap ในตาราง Productivity Matrix ออกทั้งหมดทันที
            </p>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ใช่, ลบข้อมูล',
      cancelButtonText: 'ยกเลิก',
      reverseButtons: true,
      preConfirm: () => {
        const checkbox = document.getElementById('clean-snapshot-checkbox') as HTMLInputElement | null;
        return { cleanSnapshot: checkbox ? checkbox.checked : true };
      }
    });

    if (!result.isConfirmed) return;
    const cleanSnapshot = result.value?.cleanSnapshot ?? true;

    try {
      const res = await fetch(
        `${API_BASE_URL}/productivity/settings/line-groups-by-name/${encodeURIComponent(group.group_name)}?clean_snapshot=${cleanSnapshot}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');

      const deletedCount = data.deletedSnapshotRows || 0;
      toast.success(
        cleanSnapshot && deletedCount > 0
          ? `ลบกลุ่มและล้าง Snapshot (${deletedCount} รายการ) สำเร็จ`
          : 'ลบกลุ่มสำเร็จ',
        { duration: 3000 }
      );

      if (editingRecord && group.items.some((i) => i.id === editingRecord.id)) {
        resetForm();
      }

      fetchRecords();
      fetchOptions();
      onSuccess?.();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: err.message || 'ไม่สามารถลบข้อมูลได้'
      });
    }
  };

  const handleDeleteCurrentEditing = async () => {
    if (!editingRecord) return;
    const result = await Swal.fire({
      title: 'ยืนยันการลบ Line Mapping?',
      html: `
        <div class="text-left space-y-3 text-sm">
          <p>คุณต้องการลบข้อมูลกลุ่ม <b>${editingRecord.group_name}</b> (Process: <b>${editingRecord.process_name}</b>) หรือไม่?</p>
          <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
            <label class="flex items-center gap-2 cursor-pointer font-bold select-none">
              <input type="checkbox" id="clean-snapshot-single-checkbox" checked class="checkbox checkbox-xs checkbox-warning" />
              <span>ลบข้อมูล Output Snapshot ในตารางรายงานด้วย</span>
            </label>
            <p class="text-[11px] text-amber-700 pl-6 leading-relaxed">
              แนะนำให้เปิดไว้ เพื่อลบยอดที่เคยบันทึก Snap ในตาราง Productivity Matrix ออกทันที
            </p>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ใช่, ลบข้อมูล',
      cancelButtonText: 'ยกเลิก',
      reverseButtons: true,
      preConfirm: () => {
        const checkbox = document.getElementById('clean-snapshot-single-checkbox') as HTMLInputElement | null;
        return { cleanSnapshot: checkbox ? checkbox.checked : true };
      }
    });

    if (!result.isConfirmed) return;
    const cleanSnapshot = result.value?.cleanSnapshot ?? true;

    try {
      const res = await fetch(
        `${API_BASE_URL}/productivity/settings/line-groups/${editingRecord.id}/${editingRecord.factory}?clean_snapshot=${cleanSnapshot}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');

      const deletedCount = data.deletedSnapshotRows || 0;
      toast.success(
        cleanSnapshot && deletedCount > 0
          ? `ลบข้อมูลและล้าง Snapshot (${deletedCount} รายการ) สำเร็จ`
          : 'ลบข้อมูลสำเร็จ',
        { duration: 3000 }
      );

      resetForm();
      fetchRecords();
      fetchOptions();
      onSuccess?.();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: err.message || 'ไม่สามารถลบข้อมูลได้'
      });
    }
  };

  const groupValues = parseMultiValue(formData.group_name);
  const processValues = parseMultiValue(formData.process_name);
  const machineValues = parseMultiValue(formData.mc_line);

  const filteredProcesses = useMemo(() => {
    const q = processInput.trim().toUpperCase();
    return availableProcesses.filter(p => p.toUpperCase().includes(q) && !processValues.includes(p.toUpperCase()));
  }, [availableProcesses, processInput, processValues]);

  const availableFactoryMcs = useMemo(() => {
    if (formData.factory === 'SMT') return smtMcLines.length > 0 ? smtMcLines : availableMcLines;
    if (formData.factory === 'FPC') return fpcMcLines.length > 0 ? fpcMcLines : availableMcLines;
    return availableMcLines;
  }, [formData.factory, smtMcLines, fpcMcLines, availableMcLines]);

  const filteredMcs = useMemo(() => {
    const q = mcInput.trim().toUpperCase();
    return availableFactoryMcs.filter(m => m.toUpperCase().includes(q) && !machineValues.includes(m.toUpperCase()));
  }, [availableFactoryMcs, mcInput, machineValues]);

  const distinctSectors = useMemo(() => {
    const defaultSectors = ['FPC', 'SMT', 'QA'];
    const customFromRecords = records.map(r => r.factory).filter(Boolean);
    return Array.from(new Set([...defaultSectors, ...customFromRecords]));
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchSearch = r.group_name.toLowerCase().includes(search.toLowerCase()) ||
        r.process_name.toLowerCase().includes(search.toLowerCase()) ||
        (r.mc_line || '').toLowerCase().includes(search.toLowerCase());
      const matchFactory = filterFactory === 'ALL' || r.factory === filterFactory;
      return r.is_active && matchSearch && matchFactory;
    });
  }, [records, search, filterFactory]);

  const groupedRecords = useMemo(() => {
    const groups = new Map<string, GroupedRecord>();

    filteredRecords.forEach(r => {
      const key = `${r.factory}-${r.group_name}-${r.process_name}`;
      if (!groups.has(key)) {
        groups.set(key, {
          factory: r.factory,
          group_name: r.group_name,
          process_name: r.process_name,
          items: []
        });
      }
      groups.get(key)!.items.push(r);
    });

    return Array.from(groups.values());
  }, [filteredRecords]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full h-full flex-1 min-h-0 overflow-hidden">
      {/* Left Form Panel: Animated slide open/close */}
      <div
        className={`hidden lg:flex shrink-0 relative overflow-hidden transition-all duration-300 ease-in-out h-full ${
          isFormPanelOpen ? "w-[340px]" : "w-10"
        }`}
      >
        {/* Collapsed strip - visible when closed */}
        <div
          className={`absolute inset-0 flex flex-col items-center transition-opacity duration-200 ${
            isFormPanelOpen ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
          }`}
        >
          <button
            type="button"
            onClick={() => setIsFormPanelOpen(true)}
            className="rounded-xl font-bold h-full w-full py-4 shadow-sm hover:shadow-md active:scale-95 transition-all flex flex-col justify-start items-center bg-white border border-base-content text-base-content hover:bg-base-100"
            title="ขยาย/เปิดฟอร์มเพิ่ม Line Mapping"
          >
            <ChevronRight size={18} className="text-base-content" />
            <span className="[writing-mode:vertical-lr] tracking-wider text-xs font-bold my-2 text-base-content select-none">
              เปิดฟอร์มเพิ่มข้อมูล
            </span>
            <Plus size={16} className="text-base-content" />
          </button>
        </div>

        {/* Expanded form - visible when open */}
        <div
          className={`w-[340px] h-full flex flex-col gap-3.5 bg-base-200/40 p-4 rounded-2xl border border-base-300 overflow-y-auto shadow-2xs transition-opacity duration-200 ${
            isFormPanelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex items-center justify-between border-b border-base-300 pb-2.5 shrink-0">
            <h3 className="font-bold text-sm text-base-content flex items-center gap-1.5">
              {editingRecord ? (
                <>
                  <Pencil size={16} className="text-warning" />
                  <span className="text-warning font-bold">แก้ไข Line Mapping</span>
                </>
              ) : (
                <>
                  <Plus size={16} className="text-primary" />
                  <span className="font-bold text-base-content">เพิ่ม Line Output Mapping</span>
                </>
              )}
            </h3>
            <button
              type="button"
              onClick={() => setIsFormPanelOpen(false)}
              className="btn btn-xs btn-circle btn-ghost text-base-content/60 hover:text-base-content"
              title="ซ่อน/ย่อฟอร์ม"
            >
              <ChevronLeft size={16} />
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-3 text-xs flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              {/* Sector Selector */}
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text font-bold">Sector *</span>
                </label>
                <div className="grid grid-cols-4 gap-1 p-1 bg-base-300/40 rounded-xl border border-base-300/60">
                  <button
                    type="button"
                    onClick={() => { setShowCustomSector(false); setFormData({ ...formData, factory: 'FPC' }); }}
                    className={`btn btn-xs rounded-lg font-bold border-none transition-all ${formData.factory === 'FPC' && !showCustomSector ? 'bg-emerald-600 text-white shadow-xs' : 'btn-ghost text-base-content/70 hover:bg-base-200'}`}
                  >FPC</button>
                  <button
                    type="button"
                    onClick={() => { setShowCustomSector(false); setFormData({ ...formData, factory: 'SMT' }); }}
                    className={`btn btn-xs rounded-lg font-bold border-none transition-all ${formData.factory === 'SMT' && !showCustomSector ? 'bg-amber-600 text-white shadow-xs' : 'btn-ghost text-base-content/70 hover:bg-base-200'}`}
                  >SMT</button>
                  <button
                    type="button"
                    onClick={() => { setShowCustomSector(false); setFormData({ ...formData, factory: 'QA' }); }}
                    className={`btn btn-xs rounded-lg font-bold border-none transition-all ${formData.factory === 'QA' && !showCustomSector ? 'bg-purple-600 text-white shadow-xs' : 'btn-ghost text-base-content/70 hover:bg-base-200'}`}
                  >QA</button>
                  <button
                    type="button"
                    onClick={() => { setShowCustomSector(true); if (['FPC', 'SMT', 'QA'].includes(formData.factory)) { setFormData({ ...formData, factory: customSectorInput.trim() || '' }); } }}
                    className={`btn btn-xs rounded-lg font-bold border-none gap-0.5 transition-all ${showCustomSector || (!['FPC', 'SMT', 'QA'].includes(formData.factory) && formData.factory) ? 'bg-primary text-primary-content shadow-xs' : 'btn-ghost text-base-content/70 hover:bg-base-200'}`}
                    title="ระบุ Sector อื่นๆ"
                  >
                    <Plus size={12} /><span>อื่นๆ</span>
                  </button>
                </div>
                {/* Custom / Other Sector input bar */}
                {(showCustomSector || (!['FPC', 'SMT', 'QA'].includes(formData.factory) && formData.factory)) && (
                  <div className="mt-1.5 animate-fadeIn">
                    <input
                      type="text"
                      autoFocus
                      className="input input-xs input-bordered w-full rounded-xl text-xs font-semibold placeholder:text-base-content/40 border-primary focus:outline-primary"
                      placeholder="ระบุชื่อ Sector..."
                      value={customSectorInput || (!['FPC', 'SMT', 'QA'].includes(formData.factory) ? formData.factory : '')}
                      onChange={(e) => {
                        const val = e.target.value.trim().toUpperCase();
                        setCustomSectorInput(val);
                        setFormData({ ...formData, factory: val });
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Group Name */}
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text font-bold">Group Name *</span>
                </label>
                {editingRecord ? (
                  <input
                    type="text"
                    className="input input-sm input-bordered w-full rounded-xl text-xs font-semibold uppercase font-mono"
                    placeholder="เช่น AIX-BLK, MOT-A..."
                    value={formData.group_name || ''}
                    onChange={(e) => setFormData({ ...formData, group_name: e.target.value.toUpperCase() })}
                  />
                ) : (
                  <>
                    <input
                      type="text"
                      className="input input-sm input-bordered w-full rounded-xl text-xs font-semibold"
                      placeholder="เช่น AIX-BLK, MOT-A..."
                      value={groupInput}
                      onChange={(e) => setGroupInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          addGroupValues(groupInput);
                        }
                      }}
                      onBlur={() => addGroupValues(groupInput)}
                    />
                    {groupValues.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5 max-h-20 overflow-y-auto p-1 bg-base-100/50 rounded-lg border border-base-200">
                        {groupValues.map((g) => (
                          <span key={g} className="badge badge-sm badge-primary gap-1 font-bold">
                            {g}
                            <X size={12} className="cursor-pointer hover:opacity-80" onClick={() => removeGroupValue(g)} />
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Process Name */}
              <div className="form-control relative" ref={processContainerRef}>
                <label className="label py-1">
                  <span className="label-text font-bold">Process Name *</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    className="input input-sm input-bordered w-full rounded-xl text-xs font-semibold pr-8"
                    placeholder="ค้นหาหรือพิมพ์ชื่อ Process..."
                    value={processInput}
                    onChange={(e) => {
                      setProcessInput(e.target.value);
                      setShowProcessDropdown(true);
                    }}
                    onFocus={() => setShowProcessDropdown(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addProcessValues(processInput);
                      } else if (e.key === 'Escape') {
                        setShowProcessDropdown(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    title={showProcessDropdown ? "พับเก็บ Dropdown" : "เปิด Dropdown"}
                    onClick={() => setShowProcessDropdown(!showProcessDropdown)}
                    className="absolute right-2 p-1 text-base-content/50 hover:text-base-content rounded-md hover:bg-base-200 transition-colors cursor-pointer"
                  >
                    {showProcessDropdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
                {showProcessDropdown && filteredProcesses.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto bg-base-100 border border-base-300 rounded-xl shadow-xl p-1 text-xs">
                    {filteredProcesses.slice(0, 15).map((proc) => (
                      <button
                        key={proc}
                        type="button"
                        onClick={() => addProcessValues(proc)}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-primary/10 rounded-lg font-medium transition-colors cursor-pointer"
                      >
                        {proc}
                      </button>
                    ))}
                  </div>
                )}
                {processValues.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5 max-h-20 overflow-y-auto p-1 bg-base-100/50 rounded-lg border border-base-200">
                    {processValues.map((p) => (
                      <span key={p} className="badge badge-sm badge-secondary gap-1 font-bold">
                        {p}
                        <X size={12} className="cursor-pointer hover:opacity-80" onClick={() => removeProcessValue(p)} />
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Machine / Line */}
              <div className="form-control relative" ref={mcContainerRef}>
                <label className="label py-1">
                  <span className="label-text font-bold">Machine</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    className="input input-sm input-bordered w-full rounded-xl text-xs font-semibold pr-8"
                    placeholder="เช่น Z-22-10, W-27-58..."
                    value={mcInput}
                    onChange={(e) => {
                      setMcInput(e.target.value);
                      setShowMcDropdown(true);
                    }}
                    onFocus={() => setShowMcDropdown(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addMcValues(mcInput);
                      } else if (e.key === 'Escape') {
                        setShowMcDropdown(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    title={showMcDropdown ? "พับเก็บ Dropdown" : "เปิด Dropdown"}
                    onClick={() => setShowMcDropdown(!showMcDropdown)}
                    className="absolute right-2 p-1 text-base-content/50 hover:text-base-content rounded-md hover:bg-base-200 transition-colors cursor-pointer"
                  >
                    {showMcDropdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
                {showMcDropdown && filteredMcs.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto bg-base-100 border border-base-300 rounded-xl shadow-xl p-1 text-xs">
                    {filteredMcs.slice(0, 15).map((mc) => (
                      <button
                        key={mc}
                        type="button"
                        onClick={() => addMcValues(mc)}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-primary/10 rounded-lg font-medium transition-colors cursor-pointer"
                      >
                        {mc}
                      </button>
                    ))}
                  </div>
                )}
                {machineValues.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5 max-h-20 overflow-y-auto p-1 bg-base-100/50 rounded-lg border border-base-200">
                    {machineValues.map((m) => (
                      <span key={m} className="badge badge-sm badge-accent gap-1 font-bold">
                        {m}
                        <X size={12} className="cursor-pointer hover:opacity-80" onClick={() => removeMcValue(m)} />
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Prefix */}
              <div className="form-control">
                <label className="label py-1 flex items-center justify-between">
                  <span className="label-text font-bold">Product Prefix (Optional)</span>
                  <span className="label-text-alt text-base-content/50 text-[11px]">ระบุ Prefix หรือคั่นด้วยจุลภาค</span>
                </label>
                <input
                  type="text"
                  className="input input-sm input-bordered w-full rounded-xl text-xs font-semibold uppercase font-mono tracking-wider"
                  placeholder="เช่น JDT, ICIZ, KITZ, VLOZ, KIT, VLO, VTNZ"
                  value={formData.prd_prefix || ''}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setFormData({ ...formData, prd_prefix: val });
                  }}
                />
              </div>

              {/* Exclude Product Prefix */}
              <div className="form-control">
                <label className="label py-1 flex items-center justify-between">
                  <span className="label-text font-bold text-error/90">Exclude Prefix (Optional)</span>
                  <span className="label-text-alt text-base-content/50 text-[11px]">Prefix ที่ไม่ต้องการนับรวม</span>
                </label>
                <input
                  type="text"
                  className="input input-sm input-bordered w-full rounded-xl text-xs font-semibold uppercase font-mono tracking-wider border-error/30 focus:border-error"
                  placeholder="เช่น ICIZ, VLOZ (ยกเว้นสินค้าที่มี Prefix เหล่านี้)..."
                  value={formData.exclude_prefixes || ''}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setFormData({ ...formData, exclude_prefixes: val });
                  }}
                />
              </div>

              {formError && (
                <div className="text-[11px] text-error bg-error/10 p-2.5 rounded-xl border border-error/20 font-medium">
                  {formError}
                </div>
              )}
            </div>

            <div className="pt-3 flex flex-col gap-2 shrink-0">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-sm btn-primary w-full rounded-xl font-bold shadow-md shadow-primary/20 text-xs text-white"
              >
                {isSubmitting ? (
                  <span className="loading loading-spinner loading-xs"></span>
                ) : editingRecord ? (
                  <>
                    <Save size={14} />
                    <span>อัปเดตข้อมูล Line Mapping</span>
                  </>
                ) : (
                  <>
                    <Plus size={14} />
                    <span>บันทึกข้อมูล Line Mapping</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleCheckFormOutput}
                className="btn btn-sm btn-outline btn-success w-full rounded-xl font-bold text-xs gap-1.5 shadow-2xs"
                title="ตรวจสอบยอด Output ของข้อมูลในฟอร์มปัจจุบันทันที"
              >
                <BarChart3 size={14} />
                <span>ตรวจสอบ Output ทันที (Check Output)</span>
              </button>
              {editingRecord && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn btn-sm btn-ghost border border-base-300 flex-1 rounded-xl font-bold text-xs"
                  >
                    ยกเลิกการแก้ไข
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteCurrentEditing}
                    className="btn btn-sm btn-error btn-outline flex-1 rounded-xl font-bold text-xs gap-1"
                    title="ลบ Line Mapping รายการนี้"
                  >
                    <Trash2 size={13} />
                    <span>ลบข้อมูลนี้</span>
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Right Table Panel */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 h-full overflow-hidden">
        <div className="card bg-base-100 shadow-sm border border-base-200 rounded-2xl overflow-hidden flex-1 flex flex-col min-h-0 h-full">
          <div className="card-body p-0 flex-1 flex flex-col min-h-0 h-full">
            {/* Controls Toolbar */}
            <div className="p-3 border-b border-base-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-base-100 shrink-0">
              <div className="flex flex-1 items-center gap-2 flex-wrap sm:flex-nowrap min-w-0">
                <div className="relative w-full sm:w-64 md:w-72 shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search group, process, machine..."
                    className="input input-sm input-bordered w-full pl-9 pr-8 rounded-xl text-xs bg-base-100 text-base-content placeholder:text-base-content/40 focus:ring-2 focus:ring-primary/20 shadow-2xs font-medium"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content p-0.5 rounded-full"
                      title="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <select
                  className="select select-sm select-bordered rounded-xl text-xs font-bold bg-base-100 shadow-2xs min-w-32"
                  value={filterFactory}
                  onChange={e => setFilterFactory(e.target.value)}
                >
                  <option value="ALL">All Sectors</option>
                  {distinctSectors.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  className="btn btn-sm btn-ghost btn-square border border-base-300 rounded-xl"
                  onClick={fetchRecords}
                  disabled={isLoading}
                  title="Refresh Data"
                >
                  <RefreshCcw size={15} className={isLoading ? "animate-spin text-primary" : ""} />
                </button>
              </div>

              {/* Action Buttons Integrated on the Right */}
              <div className="flex items-center gap-2 shrink-0 justify-end">
                <button
                  className="btn btn-sm shadow-xs border border-primary/30 text-primary bg-primary/5 hover:bg-primary/15 rounded-xl font-bold gap-1.5 text-xs"
                  onClick={handleSyncRecentOutput}
                  disabled={isSyncingOutput}
                  title="ซิงค์และแมปข้อมูล Output ย้อนหลัง 30 วันเข้ากับ Line Group ปัจจุบัน"
                >
                  <Database size={15} className={isSyncingOutput ? "animate-spin text-primary" : "text-primary"} />
                  <span>{isSyncingOutput ? "กำลังซิงค์ Output..." : "Sync Recent Output"}</span>
                </button>
                <button
                  className="btn btn-sm shadow-xs border border-base-300 rounded-xl font-bold gap-1.5 text-xs btn-ghost bg-base-100 hover:bg-base-200"
                  onClick={() => setIsHistoryModalOpen(true)}
                  title="View Line Mapping edit history"
                >
                  <Clock size={15} className="text-primary" />
                  <span>View History</span>
                </button>
                {!isFormPanelOpen && (
                  <button
                    className="btn btn-sm btn-primary rounded-xl font-bold shadow-md shadow-primary/20 gap-1.5 text-xs text-white"
                    onClick={() => { resetForm(); setIsFormPanelOpen(true); }}
                  >
                    <Plus size={15} />
                    <span>Add New Record</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
              <table className="table table-sm table-zebra w-full text-xs">
                <thead>
                  <tr className="bg-base-200/95 text-base-content font-bold border-b border-base-300 sticky top-0 z-10 backdrop-blur-xs">
                    <th className="w-16">Sector</th>
                    <th className="w-36">Group Name</th>
                    <th className="w-36">Process Name</th>
                    <th>Machine / Line</th>
                    <th className="w-32">Product (Optional)</th>
                    <th className="text-right pr-4 w-28">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && records.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-base-content/50">
                        <span className="loading loading-spinner loading-md text-primary"></span>
                      </td>
                    </tr>
                  ) : groupedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-base-content/50">
                        No active records found.
                      </td>
                    </tr>
                  ) : (
                    groupedRecords.map(group => (
                      <GroupRow
                        key={`${group.factory}-${group.group_name}-${group.process_name}`}
                        group={group}
                        onRenameGroup={setRenamingGroup}
                        onManageMachines={setManagingMachinesGroup}
                        onEditGroup={handleEditGroupInForm}
                        onDeleteGroup={handleDeleteGroup}
                        onCheckOutput={setCheckingOutputGroup}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {renamingGroup && (
          <RenameGroupModal
            group={renamingGroup}
            availableProcesses={availableProcesses}
            onClose={() => setRenamingGroup(null)}
            onSuccess={() => {
              setRenamingGroup(null);
              fetchRecords();
              fetchOptions();
            }}
          />
        )}

        {managingMachinesGroup && (
          <ManageGroupMachinesModal
            group={managingMachinesGroup}
            availableMcLines={
              managingMachinesGroup.factory === 'SMT'
                ? (smtMcLines.length > 0 ? smtMcLines : availableMcLines)
                : (fpcMcLines.length > 0 ? fpcMcLines : availableMcLines)
            }
            onClose={() => setManagingMachinesGroup(null)}
            onSuccess={() => {
              setManagingMachinesGroup(null);
              fetchRecords();
              fetchOptions();
            }}
          />
        )}
      </div>

      {/* History Modal Dialog Overlay */}
      {isHistoryModalOpen && (
        <HistoryModal onClose={() => setIsHistoryModalOpen(false)} />
      )}

      {/* Check Output Modal */}
      {checkingOutputGroup && (
        <CheckGroupOutputModal
          groupName={checkingOutputGroup.group_name}
          factory={checkingOutputGroup.factory}
          processNames={Array.from(new Set(
            checkingOutputGroup.items
              .flatMap(i => (i.process_name || '').split(/[\n,]+/))
              .map(p => p.trim().toUpperCase())
              .filter(Boolean)
          ))}
          mcLines={Array.from(new Set(
            checkingOutputGroup.items
              .flatMap(i => (i.mc_line || '').split(/[\n,]+/))
              .map(m => m.trim().toUpperCase())
              .filter(Boolean)
          ))}
          prdPrefixes={Array.from(new Set(
            checkingOutputGroup.items
              .flatMap(i => (i.prd_prefix || '').split(/[\n,]+/))
              .map(p => p.trim().toUpperCase())
              .filter(Boolean)
          ))}
          excludePrefixes={Array.from(new Set(
            checkingOutputGroup.items
              .flatMap(i => (i.exclude_prefixes || '').split(/[\n,]+/))
              .map(p => p.trim().toUpperCase())
              .filter(Boolean)
          ))}
          onClose={() => setCheckingOutputGroup(null)}
        />
      )}
    </div>
  );
}

interface AuditLog {
  id: number;
  record_id: number;
  factory: string;
  action_type: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: any;
  new_data: any;
  changed_by: string;
  created_at: string;
}

function HistoryModal({ onClose }: { onClose: () => void }) {
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [isLoading, React_setIsLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      React_setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/productivity/settings/line-groups/history`);
      if (!res.ok) throw new Error('Failed to fetch history');
      const data = await res.json();
      setLogs(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      React_setIsLoading(false);
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'INSERT': return <PlusCircle size={16} className="text-success" />;
      case 'UPDATE': return <Edit2 size={16} className="text-info" />;
      case 'DELETE': return <Trash2 size={16} className="text-error" />;
      default: return <Database size={16} />;
    }
  };

  const formatDataChanges = (log: AuditLog) => {
    if (log.action_type === 'INSERT') {
      return (
        <div className="text-xs">
          Added <span className="font-semibold text-primary">{log.new_data?.group_name}</span> /
          <span className="font-semibold text-secondary"> {log.new_data?.process_name}</span>
          {log.new_data?.mc_line && ` (MC: ${log.new_data.mc_line})`}
        </div>
      );
    }
    if (log.action_type === 'DELETE') {
      return (
        <div className="text-xs">
          Deleted <span className="font-semibold text-error">{log.old_data?.group_name}</span> /
          <span className="font-semibold text-error"> {log.old_data?.process_name}</span>
          {log.old_data?.mc_line && ` (MC: ${log.old_data.mc_line})`}
        </div>
      );
    }

    // UPDATE
    const changes: JSX.Element[] = [];
    const fields = ['group_name', 'process_name', 'mc_line', 'prd_prefix'];

    fields.forEach(field => {
      const oldVal = log.old_data?.[field];
      const newVal = log.new_data?.[field];
      if (oldVal !== newVal) {
        changes.push(
          <div key={field} className="text-xs flex items-center gap-2 mt-1 bg-base-200 p-1.5 rounded-lg">
            <span className="font-medium capitalize w-24">{field.replace('_', ' ')}:</span>
            <span className="line-through text-base-content/50">{oldVal || '-'}</span>
            <span className="text-base-content/50">→</span>
            <span className="font-bold text-info">{newVal || '-'}</span>
          </div>
        );
      }
    });

    if (changes.length === 0) return <div className="text-xs italic text-base-content/50">No data changed</div>;
    return <div className="flex flex-col gap-1">{changes}</div>;
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-base-100 rounded-3xl shadow-2xl border border-base-300 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-modal-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-base-200 flex justify-between items-center bg-base-200/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Clock size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-base-content">ประวัติการแก้ไขข้อมูล (Edit History)</h3>
              <p className="text-xs text-base-content/60">บันทึกการเพิ่ม แก้ไข หรือลบข้อมูล Line Mapping ทั้งหมด</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="alert alert-error text-sm py-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-md text-primary"></span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-base-content/50">
              <Clock size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">ไม่พบประวัติการแก้ไขข้อมูล</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-base-200 ml-4 pl-6 space-y-6 pb-4">
              {logs.map((log) => (
                <div key={log.id} className="relative">
                  {/* Timeline dot */}
                  <div className="absolute -left-[35px] top-1 bg-base-100 border border-base-200 p-1 rounded-full shadow-sm">
                    {getActionIcon(log.action_type)}
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-center gap-2">
                        <span className={`badge badge-sm font-bold border-none ${log.factory === 'SMT' ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                          {log.factory}
                        </span>
                        <span className="text-xs font-semibold text-base-content/70">
                          by {log.changed_by}
                        </span>
                      </div>
                      <span className="text-xs text-base-content/50 font-mono whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('en-GB', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <div className="bg-base-200/40 border border-base-300 rounded-xl p-3 shadow-2xs">
                      {formatDataChanges(log)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
