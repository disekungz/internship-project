import React, { useState, useEffect } from 'react';
import { Maximize2, Minimize2, BarChart2 } from 'lucide-react';
import ControlBar from './ControlBar';
import SummaryCards from './SummaryCards';
import SMTChartViewWithUnit from "./SMTChartViewWithUnit";
import EFPCChartViewWithUnit from "./EFPCChartViewWithUnit";
import Header from './Header';
import InfoBar from './InfoBar';
import { getApiBaseUrl } from '@/utils/apiConfig';

export default function ChartTemplate() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');

  const [selectedProcess, setSelectedProcess] = useState('E-FPC');
  const [selectedUnit, setSelectedUnit] = useState('Piece'); // 'Piece', 'Sheet', 'Lot'

  const [selectedDateData, setSelectedDateData] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // 1. โหลดรายชื่อเดือนเมื่อเปิดหน้าเว็บครั้งแรก
  useEffect(() => {
    const fetchMonths = async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/outputoverall/output/available-months`);
        if (response.ok) {
          const result = await response.json();
          setMonths(result);
          if (result.length > 0) setSelectedMonth(result[0]);
        }
      } catch (e) {
        console.error('Error fetching months: ', e);
      }
    };
    fetchMonths();
  }, []);

  // 2. โหลดข้อมูลกราฟทุกครั้งที่เปิดหน้าเว็บ หรือเมื่อเปลี่ยนเดือน/Process
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setSelectedDateData(null);

      let url = `${getApiBaseUrl()}/outputoverall/output/fpc-output`;
      const params = new URLSearchParams();
      if (selectedMonth) params.append('month', selectedMonth);
      if (selectedProcess) params.append('process', selectedProcess);
      params.append('_t', String(Date.now())); // bust cache to guarantee real-time data
      url += `?${params.toString()}`;

      try {
        const response = await fetch(url);
        const result = await response.json();

        if (!isMounted) return;

        if (!response.ok) {
          throw new Error(result.error || `HTTP error! status: ${response.status}`);
        }

        const now = new Date();
        const todayStr = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Bangkok',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(now);

        let cumulativeTarget = 0;
        let cumulativeTargetSht = 0;
        let cumulativeTargetLot = 0;
        let cumulativePcs = 0;
        let cumulativeSht = 0;
        let cumulativeLot = 0;
        const formattedData = result.map(item => {
          let rawDate = item.output_date || item.id || '';
          let formattedDate = rawDate || 'Unknown';
          if (formattedDate && formattedDate !== 'Unknown' && formattedDate.includes('-')) {
            const parts = formattedDate.split('-');
            if (parts.length === 3) {
              formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
          }

          const targetQty = Number(item.target_qty) || 0;
          const targetShtQty = Number(item.target_sht_qty) || 0;
          const targetLotQty = Number(item.target_lot_qty) || 0;
          const pcsQty = Number(item.pcs_qty) || 0;
          const shtQty = Number(item.sht_qty) || 0;
          const lotQty = Number(item.lot_qty) || 0;

          // Target is planned for the entire month
          cumulativeTarget += targetQty;
          cumulativeTargetSht += targetShtQty;
          cumulativeTargetLot += targetLotQty;

          cumulativePcs += pcsQty;
          cumulativeSht += shtQty;
          cumulativeLot += lotQty;

          return {
            name: formattedDate,
            raw_date: rawDate,
            lot_qty: lotQty,
            pcs_qty: pcsQty,
            sht_qty: shtQty,
            target_qty: targetQty,
            target_sht_qty: targetShtQty,
            target_lot_qty: targetLotQty,
            accumulated_target: cumulativeTarget,
            accumulated_target_sht: cumulativeTargetSht,
            accumulated_target_lot: cumulativeTargetLot,
            accumulated_pcs: cumulativePcs,
            accumulated_sht: cumulativeSht,
            accumulated_lot: cumulativeLot
          };
        });

        setData(formattedData);
        setSelectedDateData(null);
      } catch (e) {
        if (!isMounted) return;
        console.error('Error fetching data: ', e);
        setError(e.message || 'ไม่สามารถเชื่อมต่อกับ Backend ได้');
        setData([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [selectedMonth, selectedProcess, refreshTrigger]);

  // Effect to lock SMT / SMT_F to Piece unit
  useEffect(() => {
    if (selectedProcess === 'SMT' || selectedProcess === 'SMT_F') {
      setSelectedUnit('Piece');
    }
  }, [selectedProcess]);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // ============================================================
  // คำนวณค่าสำหรับการ์ด
  // ============================================================
  const isSelected = !!selectedDateData;

  // Target และ Actual สะสมถึง "วันนี้" แบบ Real-time (ใช้คำนวณ Balance และ KPR)
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const totalsUpToToday = data.reduce((acc, item) => {
    let itemDate;
    if (item.name.includes('/')) {
      const [day, month, year] = item.name.split('/');
      itemDate = new Date(year, month - 1, day);
    } else {
      itemDate = new Date(item.name);
    }
    itemDate.setHours(0, 0, 0, 0);

    if (itemDate <= today) {
      acc.target += item.target_qty || 0;
      acc.targetSht += item.target_sht_qty || 0;
      acc.targetLot += item.target_lot_qty || 0;
      acc.pcs += item.pcs_qty || 0;
      acc.lot += item.lot_qty || 0;
      acc.sht += item.sht_qty || 0;
    }
    return acc;
  }, { target: 0, targetSht: 0, targetLot: 0, pcs: 0, lot: 0, sht: 0 });

  // ค่าที่แสดงในการ์ด: รายวัน (ถ้าคลิก) หรือยอดรวมทั้งเดือนถึงปัจจุบัน
  let activeTargetQty = isSelected ? selectedDateData.target_qty : totalsUpToToday.target;
  if (selectedUnit === 'Sheet') activeTargetQty = isSelected ? selectedDateData.target_sht_qty : totalsUpToToday.targetSht;
  if (selectedUnit === 'Lot') activeTargetQty = isSelected ? selectedDateData.target_lot_qty : totalsUpToToday.targetLot;

  const displayTargetQty = activeTargetQty;
  const displayLotQty = isSelected
    ? selectedDateData.lot_qty
    : totalsUpToToday.lot;

  let activeQty = isSelected ? selectedDateData.pcs_qty : totalsUpToToday.pcs;
  if (selectedUnit === 'Sheet') activeQty = isSelected ? selectedDateData.sht_qty : totalsUpToToday.sht;
  if (selectedUnit === 'Lot') activeQty = isSelected ? selectedDateData.lot_qty : totalsUpToToday.lot;

  const displayPcsQty = activeQty;

  // Balance
  const diffPcs = (displayPcsQty || 0) - (displayTargetQty || 0);
  const balanceNew = (diffPcs > 0 ? '+' : '') + diffPcs.toLocaleString();

  const balanceColor = diffPcs < 0 ? '#9333ea' : '#0d9488';
  const balanceBgColor = diffPcs < 0 ? '#faf5ff' : '#f0fdfa';

  // KPR
  const kprValue = displayTargetQty ? (displayPcsQty / displayTargetQty) * 100 : 0;
  const kprDisplay = Math.round(kprValue) + '%';
  const kprColor = kprValue >= 100 ? '#0d9488' : '#9333ea';
  const kprBgColor = kprValue >= 100 ? '#f0fdfa' : '#faf5ff';

  const showingText = isSelected
    ? `Showing data for: ${selectedDateData.name}`
    : `Showing: All Days (Monthly Total) — ${selectedProcess} Process | ${selectedMonth || 'All Months'}`;

  // ============================================================
  // Render
  // ============================================================
  return (
    <>

      {/* Header Section */}
      <Header
        selectedProcess={selectedProcess}
        handleRefresh={handleRefresh}
        title="Overall Production Dashboard"
        subtitle="Monitor and track overall factory production performance in real-time"
      />

      <ControlBar
        selectedProcess={selectedProcess}
        setSelectedProcess={setSelectedProcess}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        months={months}
        selectedUnit={selectedUnit}
        setSelectedUnit={setSelectedUnit}
      />

      <InfoBar
        showingText={showingText}
        isSelected={isSelected}
        setSelectedDateData={setSelectedDateData}
      />

      <SummaryCards
        isSelected={isSelected}
        selectedDateData={selectedDateData}
        setSelectedDateData={setSelectedDateData}
        displayTargetQty={displayTargetQty}
        displayPcsQty={displayPcsQty}
        displayLotQty={displayLotQty}
        diffPcs={diffPcs}
        balanceNew={balanceNew}
        balanceColor={balanceColor}
        balanceBgColor={balanceBgColor}
        kprDisplay={kprDisplay}
        kprColor={kprColor}
        kprBgColor={kprBgColor}
        selectedProcess={selectedProcess}
        unitLabel={selectedUnit}
      />

      {error && (
        <div style={{ color: '#d9534f', marginBottom: '15px', fontSize: '13px', fontFamily: 'sans-serif', backgroundColor: '#fdf7f7', padding: '10px', borderLeft: '4px solid #d9534f' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading ? (
        <div className="section-card">
          <div className="section-header">
            <div className="section-title">
                <div className="section-title-icon" style={{ background: 'rgba(79, 70, 229, 0.1)', borderRadius: '8px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart2 size={18} color="#4f46e5" />
                </div>
              <div>
                <h3>Production Detail Records</h3>
                <span>{selectedProcess} Process — {selectedMonth || 'All Months'}</span>
              </div>
            </div>
          </div>
          <div className="section-body" style={{ padding: 0 }}>
            <div className="loading-area">
              <div className="loading-spinner"></div>
              <div className="loading-text">Loading production data...</div>
              <div style={{ fontSize: '11px', color: '#8993a4' }}>Please wait while data is being fetched</div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <style>
            {`
              @keyframes expandFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes expandScaleIn {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
              }
            `}
          </style>

          {/* Normal View */}
          <div className="section-card">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="section-title">
                <div className="section-title-icon" style={{ background: 'rgba(79, 70, 229, 0.1)', borderRadius: '8px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart2 size={18} color="#4f46e5" />
                </div>
                <div>
                  <h3>Production Detail Records</h3>
                  <span>{selectedProcess} Process — {selectedMonth || 'All Months'}</span>
                </div>
              </div>
              <button
                onClick={() => setIsExpanded(true)}
                className="btn btn-ghost btn-sm"
                title="Expand"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Maximize2 size={20} />
              </button>
            </div>
            <div className="section-body">
              {selectedProcess === 'SMT' || selectedProcess === 'SMT_F' ? (
                <SMTChartViewWithUnit data={data} setSelectedDateData={setSelectedDateData} selectedUnit={selectedUnit} selectedProcess={selectedProcess} height={600} isExpanded={false} />
              ) : (
                <EFPCChartViewWithUnit data={data} setSelectedDateData={setSelectedDateData} selectedUnit={selectedUnit} height={600} isExpanded={false} />
              )}
            </div>
          </div>

          {/* Expanded Modal View */}
          {isExpanded && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
              animation: 'expandFadeIn 0.2s ease-out forwards'
            }}>
              <div className="section-card" style={{
                width: '100%', height: '100%', maxWidth: '98vw', maxHeight: '95vh', margin: 0,
                display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-base-100)',
                borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                animation: 'expandScaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
              }}>
                <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="section-title">
                    <div className="section-title-icon" style={{ background: 'rgba(79, 70, 229, 0.1)', borderRadius: '8px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BarChart2 size={18} color="#4f46e5" />
                    </div>
                    <div>
                      <h3>Production Detail Records</h3>
                      <span>{selectedProcess} Process — {selectedMonth || 'All Months'}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="btn btn-ghost btn-sm"
                    title="Collapse"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Minimize2 size={20} />
                  </button>
                </div>
                <div className="section-body" style={{ flex: 1, padding: '1rem', minHeight: 0 }}>
                  {selectedProcess === 'SMT' || selectedProcess === 'SMT_F' ? (
                    <SMTChartViewWithUnit data={data} setSelectedDateData={setSelectedDateData} selectedUnit={selectedUnit} selectedProcess={selectedProcess} height="100%" isExpanded={true} />
                  ) : (
                    <EFPCChartViewWithUnit data={data} setSelectedDateData={setSelectedDateData} selectedUnit={selectedUnit} height="100%" isExpanded={true} />
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
