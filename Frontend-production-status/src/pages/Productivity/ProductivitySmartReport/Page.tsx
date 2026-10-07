import React, { Suspense, lazy, useEffect, useState, useCallback } from "react";
import dayjs from "dayjs";
import { ArrowLeft } from "lucide-react";
import {
  FilterBar,
  DailyMatrixTable,
  ProductivityChart,
  SmartReportSummaryCardsSkeleton,
  ProductivityChartSkeleton,
  DailyMatrixTableSkeleton,
} from "./components";
import { AttendanceUpdateBanner } from "./components/AttendanceUpdateBanner";
import { SmartReportSummaryCards } from "./components/SmartReportSummaryCards";
import { SmartReportModals } from "./components/modals/SmartReportModals";
import { useProcessOutputData, normalizeMatrixLineGroupName } from "./hooks/useProcessOutputData";
import { useAttendanceSync } from "./hooks/useAttendanceSync";
import { useSmartReportAdmin } from "./hooks/useSmartReportAdmin";
import { useSmartReportModals } from "./hooks/useSmartReportModals";
import { useSmartReportMetrics } from "./hooks/useSmartReportMetrics";
import { fetchTableVisibility, saveTableVisibility } from "../../../utils/apiConfig";
import { OutputUnit, OUTPUT_UNITS } from "./types";

// Lazy load settings view
const LineGroupSettingsView = lazy(() => import("./components/LineGroupSettingsView"));

interface YearlySplitChartItemProps {
  lineName: string;
  idx: number;
  visibleRows: any[];
  selectedFactory: string;
  granularity: any;
  startDate: string;
  endDate: string;
  aggregatedAttendanceData: Record<string, any>;
  lineOutputMap: Record<string, Record<string, number>>;
  lineAttendanceMap: Record<string, Record<string, number>>;
  getLineYearlyUnit: (line: string) => OutputUnit;
  handleLineSelectUnit: (line: string, unit: OutputUnit) => void;
  getLinePlan: (line: string, unit?: OutputUnit) => Map<string, number>;
  isLoading: boolean;
  targetData?: any[];
  matDailyData?: any[];
  formatCompactNumber: (num: number) => string;
}

const YearlySplitChartItem: React.FC<YearlySplitChartItemProps> = ({
  lineName,
  idx,
  visibleRows,
  selectedFactory,
  granularity,
  startDate,
  endDate,
  aggregatedAttendanceData,
  lineOutputMap,
  lineAttendanceMap,
  getLineYearlyUnit,
  handleLineSelectUnit,
  getLinePlan,
  isLoading,
  targetData,
  matDailyData,
  formatCompactNumber,
}) => {
  const currentLineUnit = getLineYearlyUnit(lineName);
  const currentUnitMeta = OUTPUT_UNITS.find(u => u.key === currentLineUnit) || {
    key: currentLineUnit,
    label: `${currentLineUnit} Output`,
    shortLabel: currentLineUnit === 'sht' ? 'Sht' : 'Piece'
  };
  const [liveTotals, setLiveTotals] = React.useState<{ output: number; manHours: number; accProd: number } | null>(null);

  React.useEffect(() => {
    setLiveTotals(null);
  }, [currentLineUnit, lineName]);

  const handleTotalsCalculated = React.useCallback((totals: { output: number; manHours: number; accProd: number }) => {
    setLiveTotals(prev => {
      if (prev && prev.output === totals.output && prev.manHours === totals.manHours && prev.accProd === totals.accProd) {
        return prev;
      }
      return totals;
    });
  }, []);

  const lineAttMap: Record<string, any> = {};
  const lineOutMap: Record<string, number> = {};
  const normTarget = normalizeMatrixLineGroupName(lineName).toUpperCase();

  let lineOutTotal = 0;
  visibleRows.forEach(row => {
    const normRow = normalizeMatrixLineGroupName(row.lineGroup).toUpperCase();
    if (normRow === normTarget || row.lineGroup.toUpperCase() === lineName.toUpperCase()) {
      let val = row.pieceQty;
      if (currentLineUnit === 'sht') val = row.shtQty;
      else if (currentLineUnit === 'lot') val = row.lotQty;

      const dateKey = row.date;
      lineOutMap[dateKey] = (lineOutMap[dateKey] || 0) + val;
      lineOutTotal += val;
    }
  });

  if (Object.keys(lineOutMap).length === 0 && lineOutputMap[lineName]) {
    Object.assign(lineOutMap, lineOutputMap[lineName]);
    lineOutTotal = Object.values(lineOutMap).reduce((sum, val) => sum + val, 0);
  }

  let lineMHTotal = 0;
  let validMH = 0;
  let outForValidMH = 0;
  const dateKeys = Object.keys(aggregatedAttendanceData || {});
  for (const date of dateKeys) {
    const dataForDate = aggregatedAttendanceData[date];
    if (!dataForDate) continue;
    const mh = lineAttendanceMap[lineName]?.[date] || 0;
    lineAttMap[date] = {
      ...dataForDate,
      total_man_hour: mh,
    };

    const numMH = Number(mh || 0);
    lineMHTotal += numMH;
    const dayOut = Number(lineOutMap[date] || 0);
    if (numMH > 0 && dayOut > 0) {
      validMH += numMH;
      outForValidMH += dayOut;
    }
  }

  const lineAccProd = validMH > 0 ? (outForValidMH / validMH) : (lineMHTotal > 0 ? lineOutTotal / lineMHTotal : 0);

  const lineGrandTotals = liveTotals || {
    output: lineOutTotal,
    manHours: lineMHTotal,
    accProd: lineAccProd,
  };

  const linePlanObj = Object.fromEntries(getLinePlan(lineName, currentLineUnit));

  return (
    <div key={`stacked-chart-${lineName}-${idx}`} className="flex flex-col gap-4">
      <SmartReportSummaryCards
        grandTotals={lineGrandTotals}
        selectedUnitMeta={currentUnitMeta}
        lineBreakdowns={null}
        formatCompactNumber={formatCompactNumber}
        isLineMat={lineName.toUpperCase().includes('MAT')}
        isYearly={granularity === 'yearly'}
      />
      <ProductivityChart
        rows={visibleRows}
        selectedUnit={currentLineUnit}
        onSelectUnit={(newUnit) => handleLineSelectUnit(lineName, newUnit)}
        selectedFactory={selectedFactory}
        granularity={granularity}
        startDate={startDate}
        endDate={endDate}
        attendanceData={lineAttMap}
        outputData={lineOutMap}
        planData={linePlanObj}
        linePlanMap={{ [lineName]: linePlanObj }}
        title={`Productivity Trend - ${lineName}`}
        lineOutputMap={{ [lineName]: lineOutMap }}
        lineAttendanceMap={{ [lineName]: lineAttendanceMap[lineName] || {} }}
        linesToSum={[lineName]}
        selectedLineGroup={[lineName]}
        isLoading={isLoading}
        targetData={targetData}
        matDailyData={matDailyData}
        onTotalsCalculated={handleTotalsCalculated}
      />
    </div>
  );
};

const ProductivitySmartReport: React.FC = () => {
  const admin = useSmartReportAdmin();
  const modals = useSmartReportModals(admin.isAdmin);

  const [hiddenTables, setHiddenTables] = React.useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("pdt_hidden_tables");
      return saved ? JSON.parse(saved) : ["LINE S_IND"];
    } catch {
      return ["LINE S_IND"];
    }
  });

  React.useEffect(() => {
    fetchTableVisibility().then((tables) => {
      if (tables && Array.isArray(tables)) {
        setHiddenTables(tables);
      }
    });

    const handleVisibilitySync = (e: any) => {
      const updated = e?.detail || [];
      if (Array.isArray(updated)) {
        setHiddenTables(updated);
      }
    };
    window.addEventListener("table-visibility-updated", handleVisibilitySync);
    return () => window.removeEventListener("table-visibility-updated", handleVisibilitySync);
  }, []);

  const handleSetHiddenTables = (tables: string[]) => {
    setHiddenTables(tables);
    saveTableVisibility(tables);
  };

  const {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    selectedFactory,
    setSelectedFactory,
    selectedLineGroup,
    setSelectedLineGroup,
    facUnit,
    setFacUnit,
    selectedUnit,
    setSelectedUnit,
    lineGroups,
    rows,
    isLoading,
    fetchLineGroupOutput,
    fetchPeriodSummary,
    granularity,
    setGranularity,
    calendarData,
    attendanceData,
    targetData,
    matDailyData,
    fetchAttendance,
  } = useProcessOutputData();

  const {
    visibleRows,
    dateColumns,
    aggregatedAttendanceData,
    matrixData,
    chartTitle,
    chartAttendanceData,
    chartOutputData,
    chartPlanData,
    lineOutputMap,
    linePlanMap,
    lineAttendanceMap,
    linesToSum,
    grandTotals,
    lineBreakdowns,
    formatCompactNumber,
    latestDataDate,
    planData,
    getLinePlan,
    hybridChartData,
    hybridBrackets,
    selectedUnitMeta,
  } = useSmartReportMetrics({
    rows,
    lineGroups,
    selectedFactory,
    selectedLineGroup,
    startDate,
    endDate,
    selectedUnit,
    granularity,
    calendarData,
    attendanceData,
    matDailyData,
  });

  const [singleLiveTotals, setSingleLiveTotals] = React.useState<{ output: number; manHours: number; accProd: number } | null>(null);

  React.useEffect(() => {
    setSingleLiveTotals(null);
  }, [granularity, selectedLineGroup, selectedUnit]);

  const handleSingleTotalsCalculated = React.useCallback((totals: { output: number; manHours: number; accProd: number }) => {
    setSingleLiveTotals(prev => {
      if (prev && prev.output === totals.output && prev.manHours === totals.manHours && prev.accProd === totals.accProd) {
        return prev;
      }
      return totals;
    });
  }, []);

  const [isExporting] = React.useState(false);

  const handleSearch = React.useCallback(async () => {
    const isPastMonth = endDate < dayjs().startOf('month').format('YYYY-MM-DD');
    const isAugust = (startDate >= '2026-08-01' && endDate <= '2026-08-31');

    if (granularity === "daily") {
      if (isAugust || isPastMonth) {
        await fetchPeriodSummary("daily");
      } else {
        await Promise.all([fetchLineGroupOutput(), fetchAttendance()]);
      }
    } else {
      await Promise.all([fetchPeriodSummary(granularity), fetchAttendance()]);
    }
  }, [granularity, startDate, endDate, fetchLineGroupOutput, fetchPeriodSummary, fetchAttendance]);

  const {
    hasNewUpdate,
    rawHasNewUpdate,
    changedDates,
    totalDaysChanged,
    latestAttendanceUpdate,
    isSyncing: isSyncingAttendance,
    syncSelective: handleSyncAttendance,
    dismissNotification: handleDismissAttendanceBanner,
  } = useAttendanceSync({
    startDate,
    endDate,
    onSyncSuccess: handleSearch,
  });

  // Auto-switch unit to 'sht' if LINE MAT is selected
  useEffect(() => {
    const isLineMat = Array.isArray(selectedLineGroup)
      ? selectedLineGroup.some(l => l.toUpperCase().includes('MAT'))
      : typeof selectedLineGroup === 'string' && selectedLineGroup.toUpperCase().includes('MAT');
    if (isLineMat && selectedUnit !== 'sht') {
      setSelectedUnit('sht');
    }
  }, [selectedLineGroup, selectedUnit, setSelectedUnit]);

  // Independent unit state per line for Yearly multi-chart view (defaults: Direct SMT -> piece, Direct FPC -> sht)
  const [yearlyLineUnits, setYearlyLineUnits] = useState<Record<string, OutputUnit>>({
    'Direct SMT': 'piece',
    'Direct FPC': 'sht',
  });

  const getLineYearlyUnit = useCallback((lineName: string): OutputUnit => {
    if (yearlyLineUnits[lineName]) return yearlyLineUnits[lineName];
    const upper = lineName.toUpperCase();
    if (upper.includes('SMT')) return 'piece';
    if (upper.includes('FPC') || upper.includes('MAT')) return 'sht';
    return selectedUnit || 'piece';
  }, [yearlyLineUnits, selectedUnit]);

  const handleLineSelectUnit = useCallback((lineName: string, unit: OutputUnit) => {
    setYearlyLineUnits(prev => ({
      ...prev,
      [lineName]: unit,
    }));
  }, []);

  // In Yearly mode with a single line selected, auto-set default unit (SMT -> piece, FPC/MAT -> sht)
  useEffect(() => {
    if (granularity === 'yearly') {
      const singleLine = Array.isArray(selectedLineGroup)
        ? (selectedLineGroup.length === 1 ? selectedLineGroup[0] : null)
        : (typeof selectedLineGroup === 'string' && selectedLineGroup !== 'ALL' ? selectedLineGroup : null);

      if (singleLine) {
        const upper = singleLine.toUpperCase();
        if (upper.includes('SMT') && selectedUnit !== 'piece') {
          setSelectedUnit('piece');
        } else if ((upper.includes('FPC') || upper.includes('MAT')) && selectedUnit !== 'sht') {
          setSelectedUnit('sht');
        }
      }
    }
  }, [granularity, selectedLineGroup, selectedUnit, setSelectedUnit]);

  if (modals.showSettings) {
    const handleCloseSettings = () => {
      modals.setShowSettings(false);
      if (granularity === 'daily') {
        fetchLineGroupOutput();
      } else {
        fetchPeriodSummary();
      }
    };

    return (
      <div className="w-full h-full bg-base-200 flex flex-col relative overflow-hidden">
        <div className="p-4 border-b border-base-300 bg-base-100 flex items-center shadow-sm z-10 shrink-0">
          <button
            className="btn btn-sm btn-ghost gap-2"
            onClick={handleCloseSettings}
          >
            <ArrowLeft size={16} />
            กลับไปยังหน้ารายงาน Smart Report
          </button>
        </div>
        <div className="flex-1 overflow-hidden relative">
          <Suspense fallback={<div className="p-8 text-center text-base-content/60">Loading Settings...</div>}>
            <LineGroupSettingsView onSuccess={() => {
              if (granularity === 'daily') {
                fetchLineGroupOutput();
              } else {
                fetchPeriodSummary();
              }
            }} />
          </Suspense>
        </div>
      </div>
    );
  }

  const {
    setShowSettings,
    setShowImportExcel,
    setShowManualMatrixModal,
    setShowExportExcelModal,
    setShowTableVisibilityModal,
    openEmployeeScanModal,
    setShowManpowerAuditModal,
    setShowManpowerLoanModal,
    setShowManpowerSnapshotModal,
    setShowCostCenterModal,
    setShowMacroLineModal,
    setShowLineMappingModal,
    setShowToolsGuideModal,
  } = modals;

  const handleOpenSettings = useCallback(() => setShowSettings(true), [setShowSettings]);
  const handleOpenImportExcel = useCallback(() => setShowImportExcel(true), [setShowImportExcel]);
  const handleOpenManualMatrixModal = useCallback(() => setShowManualMatrixModal(true), [setShowManualMatrixModal]);
  const handleExportExcel = useCallback(() => setShowExportExcelModal(true), [setShowExportExcelModal]);
  const handleOpenTableVisibilityModal = useCallback(() => setShowTableVisibilityModal(true), [setShowTableVisibilityModal]);
  const handleOpenEmployeeScanModal = useCallback((date?: string) => openEmployeeScanModal(date || latestDataDate), [openEmployeeScanModal, latestDataDate]);
  const handleOpenManpowerAuditModal = useCallback(() => setShowManpowerAuditModal(true), [setShowManpowerAuditModal]);
  const handleOpenManpowerLoanModal = useCallback(() => setShowManpowerLoanModal(true), [setShowManpowerLoanModal]);
  const handleOpenManpowerSnapshotModal = useCallback(() => setShowManpowerSnapshotModal(true), [setShowManpowerSnapshotModal]);
  const handleOpenCostCenterModal = useCallback(() => setShowCostCenterModal(true), [setShowCostCenterModal]);
  const handleOpenMacroLineModal = useCallback(() => setShowMacroLineModal(true), [setShowMacroLineModal]);
  const handleOpenLineMappingModal = useCallback(() => setShowLineMappingModal(true), [setShowLineMappingModal]);
  const handleOpenToolsGuideModal = useCallback(() => setShowToolsGuideModal(true), [setShowToolsGuideModal]);
  const handleSyncAttendanceAction = useCallback(() => handleSyncAttendance(), [handleSyncAttendance]);

  return (
    <div className="w-full h-full p-4 lg:p-6 overflow-y-auto overflow-x-hidden bg-gradient-to-br from-base-200/80 via-base-100 to-base-300/80 flex flex-col gap-6 relative">
      <FilterBar
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        selectedFactory={selectedFactory}
        setSelectedFactory={setSelectedFactory}
        selectedLineGroup={selectedLineGroup}
        setSelectedLineGroup={setSelectedLineGroup}
        facUnit={facUnit}
        setFacUnit={setFacUnit}
        selectedUnit={selectedUnit}
        setSelectedUnit={setSelectedUnit}
        granularity={granularity}
        setGranularity={setGranularity}
        lineGroups={lineGroups}
        isLoading={isLoading}
        onSearch={handleSearch}
        onOpenSettings={handleOpenSettings}
        onOpenImportExcel={handleOpenImportExcel}
        onOpenManualMatrixModal={handleOpenManualMatrixModal}
        onExportExcel={handleExportExcel}
        isExporting={isExporting}
        isAdmin={admin.isAdmin}
        setIsAdmin={admin.handleAdminToggle}
        hiddenTables={hiddenTables}
        setHiddenTables={handleSetHiddenTables}
        onOpenTableVisibilityModal={handleOpenTableVisibilityModal}
        onOpenEmployeeScanModal={handleOpenEmployeeScanModal}
        onOpenManpowerAuditModal={handleOpenManpowerAuditModal}
        onOpenManpowerLoanModal={handleOpenManpowerLoanModal}
        onOpenManpowerSnapshotModal={handleOpenManpowerSnapshotModal}
        onOpenCostCenterModal={handleOpenCostCenterModal}
        onOpenMacroLineModal={handleOpenMacroLineModal}
        onOpenLineMappingModal={handleOpenLineMappingModal}
        onOpenToolsGuideModal={handleOpenToolsGuideModal}
        onOpenProductivityOutputModal={() => modals.setShowProductivityOutputModal(true)}
        onSyncAttendance={handleSyncAttendanceAction}
        isSyncingAttendance={isSyncingAttendance}
        hasAttendanceUpdate={rawHasNewUpdate}
        changedDates={changedDates}
        totalDaysChanged={totalDaysChanged}
        latestAttendanceUpdate={latestAttendanceUpdate}
      />

      {/* Attendance Update Notification Banner */}
      <AttendanceUpdateBanner
        hasNewUpdate={hasNewUpdate}
        changedDates={changedDates}
        totalDaysChanged={totalDaysChanged}
        latestAttendanceUpdate={latestAttendanceUpdate}
        isSyncing={isSyncingAttendance}
        onSync={() => handleSyncAttendance()}
        onDismiss={handleDismissAttendanceBanner}
      />

      {/* KPI Summary Cards */}
      {isLoading ? (
        <SmartReportSummaryCardsSkeleton />
      ) : !(granularity === "yearly" && Array.isArray(selectedLineGroup) && selectedLineGroup.length === 2) ? (
        <SmartReportSummaryCards
          grandTotals={singleLiveTotals || grandTotals}
          selectedUnitMeta={selectedUnitMeta}
          lineBreakdowns={lineBreakdowns}
          formatCompactNumber={formatCompactNumber}
          isLineMat={Array.isArray(selectedLineGroup) ? selectedLineGroup.some(l => l.toUpperCase().includes('MAT')) : typeof selectedLineGroup === 'string' && selectedLineGroup.toUpperCase().includes('MAT')}
          isYearly={granularity === "yearly"}
        />
      ) : null}

      {/* Charts */}
      {isLoading ? (
        <ProductivityChartSkeleton />
      ) : granularity === "yearly" && Array.isArray(selectedLineGroup) && selectedLineGroup.length === 2 ? (
        <div className="space-y-10">
          {selectedLineGroup.map((lineName, idx) => (
            <YearlySplitChartItem
              key={`stacked-chart-${lineName}-${idx}`}
              lineName={lineName}
              idx={idx}
              visibleRows={visibleRows}
              selectedFactory={selectedFactory}
              granularity={granularity}
              startDate={startDate}
              endDate={endDate}
              aggregatedAttendanceData={aggregatedAttendanceData}
              lineOutputMap={lineOutputMap}
              lineAttendanceMap={lineAttendanceMap}
              getLineYearlyUnit={getLineYearlyUnit}
              handleLineSelectUnit={handleLineSelectUnit}
              getLinePlan={getLinePlan}
              isLoading={isLoading}
              targetData={targetData}
              matDailyData={matDailyData}
              formatCompactNumber={formatCompactNumber}
            />
          ))}
        </div>
      ) : (
        <ProductivityChart
          rows={visibleRows}
          selectedUnit={selectedUnit}
          onSelectUnit={setSelectedUnit}
          selectedFactory={selectedFactory}
          granularity={granularity}
          startDate={startDate}
          endDate={endDate}
          attendanceData={chartAttendanceData}
          outputData={chartOutputData}
          planData={chartPlanData}
          linePlanMap={linePlanMap}
          title={chartTitle}
          lineOutputMap={lineOutputMap}
          lineAttendanceMap={lineAttendanceMap}
          linesToSum={linesToSum}
          selectedLineGroup={selectedLineGroup}
          isLoading={isLoading}
          targetData={targetData}
          matDailyData={matDailyData}
          hybridChartData={hybridChartData}
          hybridBrackets={hybridBrackets}
          onTotalsCalculated={handleSingleTotalsCalculated}
        />
      )}

      {/* Daily Matrix Table */}
      {granularity !== "yearly" && (
        isLoading ? (
          <DailyMatrixTableSkeleton />
        ) : (
          <DailyMatrixTable
            rows={visibleRows}
            startDate={startDate}
            endDate={endDate}
            selectedUnit={selectedUnit}
            granularity={granularity}
            calendarData={calendarData}
            attendanceData={attendanceData}
            selectedLineGroup={selectedLineGroup}
            lineGroups={lineGroups}
            selectedFactory={selectedFactory}
            hiddenTables={hiddenTables}
            matrixData={matrixData}
            dateColumns={dateColumns}
            aggregatedAttendanceData={aggregatedAttendanceData}
            isLoading={isLoading}
            onOpenExportModal={handleExportExcel}
            targetData={targetData}
            matDailyData={matDailyData}
          />
        )
      )}

      {/* Modals Container */}
      <SmartReportModals
        modals={modals}
        isAdmin={admin.isAdmin}
        startDate={startDate}
        endDate={endDate}
        selectedFactory={selectedFactory}
        granularity={granularity}
        rows={rows}
        visibleRows={visibleRows}
        lineGroups={lineGroups}
        hiddenTables={hiddenTables}
        setHiddenTables={handleSetHiddenTables}
        dateColumns={dateColumns}
        aggregatedAttendanceData={aggregatedAttendanceData}
        matrixData={matrixData}
        planData={planData}
        targetData={targetData}
        matDailyData={matDailyData}
        calendarData={calendarData}
        latestDataDate={latestDataDate}
        selectedLineGroup={selectedLineGroup}
        onSearch={handleSearch}
      />
    </div>
  );
};

export default ProductivitySmartReport;
