import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Search, RefreshCcw, Calendar, TrendingUp, Layers, Cpu,
  Database, AlertCircle, ArrowUpRight, BarChart3, CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { getApiBaseUrl } from '../../../../../utils/apiConfig';

const API_BASE_URL = getApiBaseUrl();

interface CheckGroupOutputModalProps {
  groupName: string;
  factory?: string;
  processNames?: string[];
  mcLines?: string[];
  prdPrefixes?: string[];
  excludePrefixes?: string[];
  onClose: () => void;
  onNavigateToReport?: (groupName: string, factory: string) => void;
}

interface OutputSummary {
  total_pieces: number;
  total_sheets: number;
  total_lots: number;
  active_days_count: number;
  records_count: number;
}

interface DailyRecord {
  output_date: string;
  pieces: number;
  sheets: number;
  lots: number;
  count: number;
}

interface ProcessRecord {
  process_name: string;
  pieces: number;
  sheets: number;
  lots: number;
  count: number;
}

interface MachineRecord {
  mc_line: string;
  pieces: number;
  sheets: number;
  lots: number;
  count: number;
}

interface DetailRecord {
  output_date: string;
  process_name: string;
  mc_line: string;
  prd_name: string;
  actual_piece_qty: number;
  actual_sht_qty: number;
  actual_lot_qty: number;
}

export const CheckGroupOutputModal: React.FC<CheckGroupOutputModalProps> = ({
  groupName,
  factory = 'ALL',
  processNames = [],
  mcLines = [],
  prdPrefixes = [],
  excludePrefixes = [],
  onClose,
  onNavigateToReport
}) => {
  // Date Presets Calculation
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Default: past 30 days
  const defaultEnd = formatDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const defaultStart = formatDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [activeTab, setActiveTab] = useState<'daily' | 'process_machine' | 'records'>('daily');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState('');

  const [summary, setSummary] = useState<OutputSummary>({
    total_pieces: 0,
    total_sheets: 0,
    total_lots: 0,
    active_days_count: 0,
    records_count: 0
  });
  const [dailyData, setDailyData] = useState<DailyRecord[]>([]);
  const [byProcess, setByProcess] = useState<ProcessRecord[]>([]);
  const [byMachine, setByMachine] = useState<MachineRecord[]>([]);
  const [recentRecords, setRecentRecords] = useState<DetailRecord[]>([]);
  const [dataSource, setDataSource] = useState<'snapshot' | 'raw_detail'>('snapshot');

  const setPreset = (type: '7d' | '15d' | '30d' | 'mtd' | 'ytd') => {
    const end = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    let start = new Date(end);

    if (type === '7d') {
      start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (type === '15d') {
      start = new Date(end.getTime() - 15 * 24 * 60 * 60 * 1000);
    } else if (type === '30d') {
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (type === 'mtd') {
      start = new Date(end.getFullYear(), end.getMonth(), 1);
    } else if (type === 'ytd') {
      start = new Date(end.getFullYear(), 0, 1);
    }

    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
  };

  const fetchOutputData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        group_name: groupName,
        factory: factory || 'ALL',
        startDate,
        endDate
      });

      if (processNames.length > 0) {
        params.append('process_names', processNames.join(','));
      }
      if (mcLines.length > 0) {
        params.append('mc_lines', mcLines.join(','));
      }
      if (prdPrefixes.length > 0) {
        params.append('prd_prefixes', prdPrefixes.join(','));
      }
      if (excludePrefixes.length > 0) {
        params.append('exclude_prefixes', excludePrefixes.join(','));
      }

      const res = await fetch(`${API_BASE_URL}/productivity/settings/check-group-output?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch output data');
      }

      const data = await res.json();
      setSummary(data.summary || {
        total_pieces: 0,
        total_sheets: 0,
        total_lots: 0,
        active_days_count: 0,
        records_count: 0
      });
      setDailyData(data.daily || []);
      setByProcess(data.by_process || []);
      setByMachine(data.by_machine || []);
      setRecentRecords(data.recent_records || []);
      setDataSource(data.source || 'snapshot');
    } catch (err: any) {
      console.error('Error fetching output preview:', err);
      setError(err.message || 'Cannot load output data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (groupName || processNames.length > 0) {
      fetchOutputData();
    }
  }, [groupName, startDate, endDate]);

  const handleSyncOutputNow = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/productivity/settings/sync-output-snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to sync output snapshot');
      }

      toast.success(`ซิงค์ข้อมูล Output สำเร็จ (${data.count || 0} รายการ)`);
      // Refresh current data
      await fetchOutputData();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาดในการซิงค์',
        text: err.message || 'Cannot sync output snapshot'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const maxDailyPieces = useMemo(() => {
    if (dailyData.length === 0) return 1;
    return Math.max(...dailyData.map(d => d.pieces), 1);
  }, [dailyData]);

  const formatNumber = (num: number) => {
    return (num || 0).toLocaleString('en-US');
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-base-100 rounded-3xl shadow-2xl border border-base-300 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-modal-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:px-6 sm:py-4 border-b border-base-200 flex justify-between items-center bg-gradient-to-r from-base-100 via-base-200/40 to-base-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shadow-xs shrink-0 ${
              factory === 'SMT' ? 'bg-amber-500/15 text-amber-600' :
              factory === 'QA' ? 'bg-purple-500/15 text-purple-600' :
              'bg-emerald-500/15 text-emerald-600'
            }`}>
              <BarChart3 size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base sm:text-lg text-base-content flex items-center gap-1.5">
                  <span>ตรวจสอบ Output</span>
                  <span className="badge badge-primary font-mono font-bold text-xs sm:text-sm px-2.5 py-1">{groupName}</span>
                </h3>
                {factory && (
                  <span className={`badge badge-sm font-bold border-none ${
                    factory === 'SMT' ? 'bg-amber-500/10 text-amber-600' :
                    factory === 'QA' ? 'bg-purple-500/10 text-purple-600' :
                    'bg-emerald-500/10 text-emerald-600'
                  }`}>
                    {factory}
                  </span>
                )}
                <span className={`badge badge-sm font-medium ${
                  dataSource === 'snapshot' ? 'badge-ghost text-base-content/70' : 'badge-warning'
                }`}>
                  {dataSource === 'snapshot' ? 'Snapshot Data' : 'Raw Detail (ยังไม่ซิงค์)'}
                </span>
              </div>
              <p className="text-xs text-base-content/60 truncate mt-0.5">
                {processNames.length > 0 && `Process: ${processNames.join(', ')}`}
                {mcLines.length > 0 && ` | Machines: ${mcLines.length} เครื่อง`}
                {prdPrefixes.length > 0 && ` | Prefix: ${prdPrefixes.join(', ')}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Controls Bar (Date Filters & Action Buttons) */}
        <div className="p-3 sm:px-6 bg-base-200/40 border-b border-base-200 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 shrink-0 text-xs">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-base-content/70 mr-1 flex items-center gap-1">
              <Calendar size={13} />
              <span>ช่วงเวลา:</span>
            </span>
            <button
              type="button"
              className="btn btn-xs btn-ghost hover:bg-base-200 rounded-lg font-semibold"
              onClick={() => setPreset('7d')}
            >
              7 วันล่าสุด
            </button>
            <button
              type="button"
              className="btn btn-xs btn-ghost hover:bg-base-200 rounded-lg font-semibold"
              onClick={() => setPreset('15d')}
            >
              15 วันล่าสุด
            </button>
            <button
              type="button"
              className="btn btn-xs btn-ghost hover:bg-base-200 rounded-lg font-semibold"
              onClick={() => setPreset('30d')}
            >
              30 วันล่าสุด
            </button>
            <button
              type="button"
              className="btn btn-xs btn-ghost hover:bg-base-200 rounded-lg font-semibold"
              onClick={() => setPreset('mtd')}
            >
              เดือนนี้ (MTD)
            </button>
            <button
              type="button"
              className="btn btn-xs btn-ghost hover:bg-base-200 rounded-lg font-semibold"
              onClick={() => setPreset('ytd')}
            >
              ทั้งปี (YTD)
            </button>
          </div>

          {/* Date Picker Range Inputs & Buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
            <div className="flex items-center gap-1 bg-base-100 p-1 rounded-xl border border-base-300">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="input input-xs border-none bg-transparent font-medium"
              />
              <span className="text-base-content/40">ถึง</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="input input-xs border-none bg-transparent font-medium"
              />
            </div>

            <button
              type="button"
              className="btn btn-xs btn-neutral rounded-xl gap-1 px-2.5 font-bold"
              onClick={fetchOutputData}
              disabled={isLoading}
              title="ค้นหาข้อมูล Output ตามช่วงวันที่"
            >
              <RefreshCcw size={12} className={isLoading ? 'animate-spin' : ''} />
              <span>ค้นหา</span>
            </button>

            <button
              type="button"
              className="btn btn-xs btn-primary btn-outline rounded-xl gap-1 font-bold"
              onClick={handleSyncOutputNow}
              disabled={isSyncing}
              title="ซิงค์ Output ล่าสุดเข้าสู่ระบบ Snapshot ทันที"
            >
              <Database size={12} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'กำลังซิงค์...' : 'ซิงค์ Snapshot'}</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {error && (
            <div className="alert alert-error text-xs p-3 rounded-2xl flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Pieces Card */}
            <div className="card bg-gradient-to-br from-emerald-500/10 via-base-100 to-base-200/50 border border-emerald-500/20 rounded-2xl p-3.5 shadow-xs">
              <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                <span>ยอดชิ้นงาน (Pieces)</span>
                <TrendingUp size={14} className="text-emerald-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono tracking-tight">
                {isLoading ? (
                  <span className="loading loading-spinner loading-sm text-emerald-600"></span>
                ) : (
                  formatNumber(summary.total_pieces)
                )}
              </div>
              <div className="text-[10px] text-base-content/50 mt-0.5">ชิ้นงานรวมที่ผลิตได้</div>
            </div>

            {/* Sheets Card */}
            <div className="card bg-gradient-to-br from-blue-500/10 via-base-100 to-base-200/50 border border-blue-500/20 rounded-2xl p-3.5 shadow-xs">
              <div className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center justify-between">
                <span>ยอดแผ่น (Sheets)</span>
                <Layers size={14} className="text-blue-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 font-mono tracking-tight">
                {isLoading ? (
                  <span className="loading loading-spinner loading-sm text-blue-600"></span>
                ) : (
                  formatNumber(summary.total_sheets)
                )}
              </div>
              <div className="text-[10px] text-base-content/50 mt-0.5">จำนวนแผ่นรวม</div>
            </div>

            {/* Lots Card */}
            <div className="card bg-gradient-to-br from-amber-500/10 via-base-100 to-base-200/50 border border-amber-500/20 rounded-2xl p-3.5 shadow-xs">
              <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center justify-between">
                <span>ยอดล็อต (Lots)</span>
                <Database size={14} className="text-amber-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono tracking-tight">
                {isLoading ? (
                  <span className="loading loading-spinner loading-sm text-amber-600"></span>
                ) : (
                  formatNumber(summary.total_lots)
                )}
              </div>
              <div className="text-[10px] text-base-content/50 mt-0.5">จำนวนล็อตที่บันทึก</div>
            </div>

            {/* Active Production Days Card */}
            <div className="card bg-gradient-to-br from-purple-500/10 via-base-100 to-base-200/50 border border-purple-500/20 rounded-2xl p-3.5 shadow-xs">
              <div className="text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider flex items-center justify-between">
                <span>วันที่มีการผลิต</span>
                <Calendar size={14} className="text-purple-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 font-mono tracking-tight">
                {isLoading ? (
                  <span className="loading loading-spinner loading-sm text-purple-600"></span>
                ) : (
                  `${summary.active_days_count} วัน`
                )}
              </div>
              <div className="text-[10px] text-base-content/50 mt-0.5">จากทั้งหมด {summary.records_count} รายการ</div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-base-300 pt-2 shrink-0">
            <div className="flex gap-2">
              <button
                type="button"
                className={`pb-2 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'daily'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-base-content/60 hover:text-base-content'
                }`}
                onClick={() => setActiveTab('daily')}
              >
                <Calendar size={13} />
                <span>ภาพรวมรายวัน ({dailyData.length} วัน)</span>
              </button>
              <button
                type="button"
                className={`pb-2 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'process_machine'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-base-content/60 hover:text-base-content'
                }`}
                onClick={() => setActiveTab('process_machine')}
              >
                <Cpu size={13} />
                <span>จำแนก Process & เครื่องจักร</span>
              </button>
              <button
                type="button"
                className={`pb-2 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'records'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-base-content/60 hover:text-base-content'
                }`}
                onClick={() => setActiveTab('records')}
              >
                <Layers size={13} />
                <span>รายการข้อมูลล่าสุด ({recentRecords.length})</span>
              </button>
            </div>
          </div>

          {/* Tab Content 1: Daily Trend Table */}
          {activeTab === 'daily' && (
            <div className="border border-base-200 rounded-2xl overflow-hidden bg-base-100 shadow-2xs">
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="table table-xs table-zebra w-full text-xs">
                  <thead className="bg-base-200/90 sticky top-0 z-10 backdrop-blur-xs font-bold">
                    <tr>
                      <th className="w-28">วันที่ผลิต</th>
                      <th>ความคืบหน้า (Output Relative)</th>
                      <th className="text-right">ชิ้นงาน (Pieces)</th>
                      <th className="text-right">แผ่น (Sheets)</th>
                      <th className="text-right">ล็อต (Lots)</th>
                      <th className="text-right w-20">รายการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-base-content/50">
                          <span className="loading loading-spinner loading-md text-primary"></span>
                        </td>
                      </tr>
                    ) : dailyData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-base-content/50">
                          ไม่พบข้อมูล Output ของกลุ่ม {groupName} ในช่วงวันที่ {startDate} ถึง {endDate}
                        </td>
                      </tr>
                    ) : (
                      dailyData.map(d => {
                        const pct = Math.min(100, Math.round((d.pieces / maxDailyPieces) * 100));
                        return (
                          <tr key={d.output_date} className="hover:bg-base-200/50">
                            <td className="font-mono font-bold text-base-content">{d.output_date}</td>
                            <td>
                              <div className="w-full bg-base-300/60 rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${pct}%` }}
                                ></div>
                              </div>
                            </td>
                            <td className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {formatNumber(d.pieces)}
                            </td>
                            <td className="text-right font-mono text-base-content/80">
                              {formatNumber(d.sheets)}
                            </td>
                            <td className="text-right font-mono text-base-content/70">
                              {formatNumber(d.lots)}
                            </td>
                            <td className="text-right text-base-content/50">
                              {d.count}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab Content 2: Process & Machine Breakdown */}
          {activeTab === 'process_machine' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Process Breakdown */}
              <div className="card bg-base-100 border border-base-200 rounded-2xl overflow-hidden p-3 shadow-2xs">
                <div className="text-xs font-bold text-base-content/70 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Layers size={14} className="text-primary" />
                    <span>จำแนกตาม Process ({byProcess.length} processes)</span>
                  </span>
                </div>
                <div className="overflow-y-auto max-h-72">
                  <table className="table table-xs w-full">
                    <thead className="bg-base-200/60">
                      <tr>
                        <th>Process</th>
                        <th className="text-right">ชิ้นงาน</th>
                        <th className="text-right">แผ่น</th>
                        <th className="text-right">ล็อต</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byProcess.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-6 text-base-content/40">ไม่มีข้อมูล</td>
                        </tr>
                      ) : (
                        byProcess.map(p => (
                          <tr key={p.process_name} className="hover:bg-base-200/40">
                            <td className="font-bold text-primary">{p.process_name}</td>
                            <td className="text-right font-mono font-bold text-emerald-600">{formatNumber(p.pieces)}</td>
                            <td className="text-right font-mono">{formatNumber(p.sheets)}</td>
                            <td className="text-right font-mono">{formatNumber(p.lots)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Machine Breakdown */}
              <div className="card bg-base-100 border border-base-200 rounded-2xl overflow-hidden p-3 shadow-2xs">
                <div className="text-xs font-bold text-base-content/70 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Cpu size={14} className="text-secondary" />
                    <span>จำแนกตาม Machine / Line ({byMachine.length} เครื่อง)</span>
                  </span>
                </div>
                <div className="overflow-y-auto max-h-72">
                  <table className="table table-xs w-full">
                    <thead className="bg-base-200/60">
                      <tr>
                        <th>Machine Line</th>
                        <th className="text-right">ชิ้นงาน</th>
                        <th className="text-right">แผ่น</th>
                        <th className="text-right">ล็อต</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byMachine.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-6 text-base-content/40">ไม่มีข้อมูล</td>
                        </tr>
                      ) : (
                        byMachine.map(m => (
                          <tr key={m.mc_line} className="hover:bg-base-200/40">
                            <td className="font-bold font-mono">{m.mc_line}</td>
                            <td className="text-right font-mono font-bold text-emerald-600">{formatNumber(m.pieces)}</td>
                            <td className="text-right font-mono">{formatNumber(m.sheets)}</td>
                            <td className="text-right font-mono">{formatNumber(m.lots)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 3: Recent Records */}
          {activeTab === 'records' && (
            <div className="border border-base-200 rounded-2xl overflow-hidden bg-base-100 shadow-2xs">
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="table table-xs table-zebra w-full text-xs">
                  <thead className="bg-base-200/90 sticky top-0 z-10 backdrop-blur-xs font-bold">
                    <tr>
                      <th className="w-24">วันที่</th>
                      <th>Process</th>
                      <th>Machine</th>
                      <th>Product</th>
                      <th className="text-right">ชิ้นงาน (Pieces)</th>
                      <th className="text-right">แผ่น (Sheets)</th>
                      <th className="text-right">ล็อต (Lots)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-base-content/50">
                          <span className="loading loading-spinner loading-md text-primary"></span>
                        </td>
                      </tr>
                    ) : recentRecords.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-base-content/50">
                          ไม่พบรายการข้อมูล Output
                        </td>
                      </tr>
                    ) : (
                      recentRecords.map((r, idx) => (
                        <tr key={`${r.output_date}-${r.process_name}-${r.mc_line}-${idx}`} className="hover:bg-base-200/40">
                          <td className="font-mono text-base-content/70">{r.output_date}</td>
                          <td><span className="badge badge-ghost badge-xs font-semibold">{r.process_name}</span></td>
                          <td className="font-mono">{r.mc_line || '-'}</td>
                          <td className="font-mono text-base-content/80">{r.prd_name || '-'}</td>
                          <td className="text-right font-mono font-bold text-emerald-600">
                            {formatNumber(r.actual_piece_qty)}
                          </td>
                          <td className="text-right font-mono text-base-content/70">
                            {formatNumber(r.actual_sht_qty)}
                          </td>
                          <td className="text-right font-mono text-base-content/60">
                            {formatNumber(r.actual_lot_qty)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:px-6 border-t border-base-200 bg-base-100 flex items-center justify-between shrink-0">
          <div className="text-xs text-base-content/50">
            <span>แสดงข้อมูล Output ของกลุ่ม </span>
            <span className="font-bold text-base-content">{groupName}</span>
            <span> ในช่วง {startDate} ถึง {endDate}</span>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToReport && (
              <button
                type="button"
                className="btn btn-sm btn-ghost text-primary font-bold gap-1 rounded-xl"
                onClick={() => onNavigateToReport(groupName, factory)}
              >
                <span>เปิดดูในรายงานเต็ม</span>
                <ArrowUpRight size={14} />
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-neutral font-bold rounded-xl px-5"
              onClick={onClose}
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckGroupOutputModal;
