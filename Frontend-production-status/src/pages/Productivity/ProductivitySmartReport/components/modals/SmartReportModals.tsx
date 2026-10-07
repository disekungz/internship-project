import React, { Suspense, lazy } from "react";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import { LineGroup, LineGroupRow, LineGroupFilter } from "../../types";
import { UseSmartReportModalsReturn } from "../../hooks/useSmartReportModals";

// Lazy load Modals to optimize bundle size
const ExcelImportModal = lazy(() => import("./ExcelImportModal").then(module => ({ default: module.ExcelImportModal })));
const TableVisibilityModal = lazy(() => import("./TableVisibilityModal").then(module => ({ default: module.TableVisibilityModal })));
const EmployeeScanModal = lazy(() => import("./EmployeeScanModal").then(module => ({ default: module.EmployeeScanModal })));
const ManpowerAuditModal = lazy(() => import("./ManpowerAuditModal").then(module => ({ default: module.ManpowerAuditModal })));
const ManpowerLoanModal = lazy(() => import("./ManpowerLoanModal").then(module => ({ default: module.ManpowerLoanModal })));
const CostCenterManagementModal = lazy(() => import("./CostCenterManagementModal"));
const MacroLineBuilderModal = lazy(() => import("./MacroLineBuilderModal").then(module => ({ default: module.MacroLineBuilderModal })));
const LineGroupSettingsModal = lazy(() => import("./LineGroupSettingsModal").then(module => ({ default: module.LineGroupSettingsModal })));
const ToolsGuideModal = lazy(() => import("./ToolsGuideModal").then(module => ({ default: module.ToolsGuideModal })));
const ExportExcelModal = lazy(() => import("./ExportExcelModal").then(module => ({ default: module.ExportExcelModal })));
const ManualMatrixEntryModal = lazy(() => import("./ManualMatrixEntryModal").then(module => ({ default: module.ManualMatrixEntryModal })));
const ManpowerSnapshotEditorModal = lazy(() => import("./ManpowerSnapshotEditorModal").then(module => ({ default: module.ManpowerSnapshotEditorModal })));
const ProductivityOutputModal = lazy(() => import("./ProductivityOutputModal").then(module => ({ default: module.ProductivityOutputModal })));

let hasPreloadedModals = false;
export const preloadSmartReportModals = () => {
  if (hasPreloadedModals) return;
  hasPreloadedModals = true;
  import("./ExcelImportModal");
  import("./TableVisibilityModal");
  import("./EmployeeScanModal");
  import("./ManpowerAuditModal");
  import("./ManpowerLoanModal");
  import("./CostCenterManagementModal");
  import("./MacroLineBuilderModal");
  import("./LineGroupSettingsModal");
  import("./ToolsGuideModal");
  import("./ExportExcelModal");
  import("./ManualMatrixEntryModal");
  import("./ManpowerSnapshotEditorModal");
  import("./ProductivityOutputModal");
};

export interface SmartReportModalsProps {
  modals: UseSmartReportModalsReturn;
  isAdmin: boolean;
  startDate: string;
  endDate: string;
  selectedFactory: string;
  granularity: string;
  rows: LineGroupRow[];
  visibleRows: LineGroupRow[];
  lineGroups: LineGroup[];
  hiddenTables: string[];
  setHiddenTables: (tables: string[]) => void;
  dateColumns: string[];
  aggregatedAttendanceData: Record<string, any>;
  matrixData: [string, Map<string, number>][];
  planData: Map<string, Map<string, number>>;
  calendarData: Record<string, any>;
  latestDataDate: string;
  selectedLineGroup: LineGroupFilter;
  onSearch: () => void;
  targetData?: any[];
  matDailyData?: any[];
}

export const SmartReportModals: React.FC<SmartReportModalsProps> = React.memo(({
  modals,
  isAdmin,
  startDate,
  endDate,
  selectedFactory,
  granularity,
  rows,
  visibleRows,
  lineGroups,
  hiddenTables,
  setHiddenTables,
  dateColumns,
  aggregatedAttendanceData,
  matrixData,
  planData,
  calendarData,
  latestDataDate,
  selectedLineGroup,
  onSearch,
  targetData,
  matDailyData,
}) => {
  return (
    <Suspense fallback={null}>
      {/* 1. Export Excel Modal */}
      {modals.showExportExcelModal && (
        <ExportExcelModal
          isOpen={modals.showExportExcelModal}
          onClose={() => modals.setShowExportExcelModal(false)}
          currentStartDate={startDate}
          currentEndDate={endDate}
          currentFactory={selectedFactory}
          currentMatrixData={matrixData}
          currentDateColumns={dateColumns}
          currentAggregatedAttendance={aggregatedAttendanceData}
          currentPlanData={planData}
          currentTargetData={targetData}
          currentMatDailyData={matDailyData}
          currentCalendarData={calendarData}
          currentRows={visibleRows}
          lineGroups={lineGroups}
          hiddenTables={hiddenTables}
          granularity={granularity as any}
        />
      )}

      {/* 2. Excel Import Modal */}
      {modals.showImportExcel && (
        <ExcelImportModal
          isOpen={modals.showImportExcel}
          onClose={() => modals.setShowImportExcel(false)}
          onSuccess={onSearch}
          lineGroups={lineGroups}
          onOpenManualMatrixModal={() => modals.setShowManualMatrixModal(true)}
        />
      )}

      {/* 2.1 Manual Matrix Entry Modal */}
      {modals.showManualMatrixModal && (
        <ManualMatrixEntryModal
          isOpen={modals.showManualMatrixModal}
          onClose={() => modals.setShowManualMatrixModal(false)}
          onSuccess={onSearch}
          lineGroups={lineGroups}
          initialYear={dayjs(startDate).year()}
          initialMonth={dayjs(startDate).month() + 1}
        />
      )}

      {/* 3. Table Visibility Modal */}
      {modals.showTableVisibilityModal && (
        <TableVisibilityModal
          isOpen={modals.showTableVisibilityModal}
          onClose={() => modals.setShowTableVisibilityModal(false)}
          hiddenTables={hiddenTables}
          setHiddenTables={setHiddenTables}
          availableLines={matrixData ? matrixData.map(([name]) => name) : undefined}
        />
      )}

      {/* 4. Employee Scan Modal */}
      {modals.showEmployeeScanModal && (
        <EmployeeScanModal
          isOpen={modals.showEmployeeScanModal}
          onClose={() => {
            modals.setShowEmployeeScanModal(false);
            modals.setScanModalDate("");
          }}
          date={modals.scanModalDate || latestDataDate}
          lineGroup={Array.isArray(selectedLineGroup) ? selectedLineGroup.join(",") : selectedLineGroup}
        />
      )}

      {/* 5. Manpower Audit Modal */}
      {modals.showManpowerAuditModal && (
        <ManpowerAuditModal
          isOpen={modals.showManpowerAuditModal}
          onClose={() => modals.setShowManpowerAuditModal(false)}
          startDate={startDate}
          endDate={endDate}
          attendanceData={aggregatedAttendanceData}
          granularity={granularity}
          lineGroups={lineGroups}
          onOpenEmployeeScanForDate={modals.openEmployeeScanModal}
        />
      )}

      {/* 6. Manpower Loan Modal */}
      {modals.showManpowerLoanModal && (
        <ManpowerLoanModal
          isOpen={modals.showManpowerLoanModal}
          selectedDate={
            (() => {
              const today = dayjs().format("YYYY-MM-DD");
              const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
              if (latestDataDate && latestDataDate <= today) return latestDataDate;
              if (endDate && endDate <= today) return endDate;
              return yesterday;
            })()
          }
          onClose={() => modals.setShowManpowerLoanModal(false)}
          onSuccess={onSearch}
        />
      )}

      {/* 6.1 Manpower Snapshot Editor Modal */}
      {modals.showManpowerSnapshotModal && (
        <ManpowerSnapshotEditorModal
          isOpen={modals.showManpowerSnapshotModal}
          onClose={() => modals.setShowManpowerSnapshotModal(false)}
          onSuccess={onSearch}
          initialDate={
            (() => {
              const today = dayjs().format("YYYY-MM-DD");
              const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
              if (latestDataDate && latestDataDate <= today) return latestDataDate;
              if (endDate && endDate <= today) return endDate;
              return yesterday;
            })()
          }
        />
      )}

      {/* 7. Cost Center Management Modal */}
      {modals.showCostCenterModal && (
        <CostCenterManagementModal
          isOpen={modals.showCostCenterModal}
          onClose={() => modals.setShowCostCenterModal(false)}
          onSuccess={onSearch}
        />
      )}

      {/* 8. Macro Line Builder Modal */}
      {modals.showMacroLineModal && (
        <MacroLineBuilderModal
          isOpen={modals.showMacroLineModal}
          onClose={() => modals.setShowMacroLineModal(false)}
          onSuccess={onSearch}
          dateColumns={dateColumns}
          aggregatedAttendanceData={aggregatedAttendanceData}
          matrixData={matrixData}
          rawRows={rows}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {/* 9. Line Group Settings Modal */}
      {modals.showLineMappingModal && (
        <LineGroupSettingsModal
          isOpen={modals.showLineMappingModal}
          onClose={() => modals.setShowLineMappingModal(false)}
          onSuccess={onSearch}
        />
      )}


      {/* 11. Tools Guide Modal */}
      {modals.showToolsGuideModal && (
        <ToolsGuideModal
          isOpen={modals.showToolsGuideModal}
          onClose={() => modals.setShowToolsGuideModal(false)}
          isAdmin={isAdmin}
          onOpenTool={(toolId) => {
            modals.setShowToolsGuideModal(false);
            if (!isAdmin) {
              const adminLabel = document.getElementById("admin-login-dropdown-btn");
              if (adminLabel) {
                adminLabel.click();
                adminLabel.focus();
              } else {
                Swal.fire({
                  icon: "info",
                  title: "ต้องใช้สิทธิ์ Admin",
                  text: "โปรดเข้าสู่ระบบ Admin เพื่อใช้งานเครื่องมือนี้",
                  confirmButtonText: "ตกลง",
                  confirmButtonColor: "#3b82f6",
                  customClass: {
                    popup: "!rounded-2xl !shadow-2xl !border !border-base-300",
                    confirmButton: "btn btn-primary px-6"
                  }
                });
              }
              return;
            }
            if (toolId === "table_visibility") modals.setShowTableVisibilityModal(true);
            else if (toolId === "attendance") modals.openEmployeeScanModal(latestDataDate);
            else if (toolId === "manpower_support") modals.setShowManpowerLoanModal(true);
            else if (toolId === "manpower_snapshot") modals.setShowManpowerSnapshotModal(true);
            else if (toolId === "manpower_audit") modals.setShowManpowerAuditModal(true);
            else if (toolId === "cost_center") modals.setShowCostCenterModal(true);
            else if (toolId === "custom_line") modals.setShowMacroLineModal(true);
            else if (toolId === "line_mapping") modals.setShowLineMappingModal(true);
            else if (toolId === "import_excel") modals.setShowImportExcel(true);
            else if (toolId === "target_adjustment") modals.setShowManualMatrixModal(true);
          }}
        />
      )}

      {/* 14. Productivity Output Modal */}
      {modals.showProductivityOutputModal && (
        <ProductivityOutputModal
          isOpen={modals.showProductivityOutputModal}
          onClose={() => modals.setShowProductivityOutputModal(false)}
          initialFactory={selectedFactory}
        />
      )}
    </Suspense>
  );
});
