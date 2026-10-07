import { useState, useCallback, useMemo } from "react";

export interface UseSmartReportModalsReturn {
  showSettings: boolean;
  setShowSettings: (val: boolean) => void;
  showLineMappingModal: boolean;
  setShowLineMappingModal: (val: boolean) => void;
  showImportExcel: boolean;
  setShowImportExcel: (val: boolean) => void;
  showExportExcelModal: boolean;
  setShowExportExcelModal: (val: boolean) => void;
  showTableVisibilityModal: boolean;
  setShowTableVisibilityModal: (val: boolean) => void;
  showEmployeeScanModal: boolean;
  setShowEmployeeScanModal: (val: boolean) => void;
  showManpowerAuditModal: boolean;
  setShowManpowerAuditModal: (val: boolean) => void;
  showManpowerLoanModal: boolean;
  setShowManpowerLoanModal: (val: boolean) => void;
  showCostCenterModal: boolean;
  setShowCostCenterModal: (val: boolean) => void;
  showMacroLineModal: boolean;
  setShowMacroLineModal: (val: boolean) => void;
  showToolsGuideModal: boolean;
  setShowToolsGuideModal: (val: boolean) => void;
  showManualMatrixModal: boolean;
  setShowManualMatrixModal: (val: boolean) => void;
  showManpowerSnapshotModal: boolean;
  setShowManpowerSnapshotModal: (val: boolean) => void;
  showProductivityOutputModal: boolean;
  setShowProductivityOutputModal: (val: boolean) => void;

  scanModalDate: string;
  setScanModalDate: (val: string) => void;
  openEmployeeScanModal: (date: string) => void;
}

export const useSmartReportModals = (): UseSmartReportModalsReturn => {
  const [showSettings, setShowSettings] = useState(false);
  const [showLineMappingModal, setShowLineMappingModal] = useState(false);
  const [showImportExcel, setShowImportExcel] = useState(false);
  const [showExportExcelModal, setShowExportExcelModal] = useState(false);
  const [showTableVisibilityModal, setShowTableVisibilityModal] = useState(false);
  const [showEmployeeScanModal, setShowEmployeeScanModal] = useState(false);
  const [showManpowerAuditModal, setShowManpowerAuditModal] = useState(false);
  const [showManpowerLoanModal, setShowManpowerLoanModal] = useState(false);
  const [showCostCenterModal, setShowCostCenterModal] = useState(false);
  const [showMacroLineModal, setShowMacroLineModal] = useState(false);
  const [showToolsGuideModal, setShowToolsGuideModal] = useState(false);
  const [showManualMatrixModal, setShowManualMatrixModal] = useState(false);
  const [showManpowerSnapshotModal, setShowManpowerSnapshotModal] = useState(false);
  const [showProductivityOutputModal, setShowProductivityOutputModal] = useState(false);

  const [scanModalDate, setScanModalDate] = useState<string>("");

  const openEmployeeScanModal = useCallback((date: string) => {
    setScanModalDate(date);
    setShowEmployeeScanModal(true);
  }, []);

  return useMemo(
    () => ({
      showSettings,
      setShowSettings,
      showLineMappingModal,
      setShowLineMappingModal,
      showImportExcel,
      setShowImportExcel,
      showExportExcelModal,
      setShowExportExcelModal,
      showTableVisibilityModal,
      setShowTableVisibilityModal,
      showEmployeeScanModal,
      setShowEmployeeScanModal,
      showManpowerAuditModal,
      setShowManpowerAuditModal,
      showManpowerLoanModal,
      setShowManpowerLoanModal,
      showCostCenterModal,
      setShowCostCenterModal,
      showMacroLineModal,
      setShowMacroLineModal,
      showToolsGuideModal,
      setShowToolsGuideModal,
      showManualMatrixModal,
      setShowManualMatrixModal,
      showManpowerSnapshotModal,
      setShowManpowerSnapshotModal,
      showProductivityOutputModal,
      setShowProductivityOutputModal,
      scanModalDate,
      setScanModalDate,
      openEmployeeScanModal,
    }),
    [
      showSettings,
      showLineMappingModal,
      showImportExcel,
      showExportExcelModal,
      showTableVisibilityModal,
      showEmployeeScanModal,
      showManpowerAuditModal,
      showManpowerLoanModal,
      showCostCenterModal,
      showMacroLineModal,
      showToolsGuideModal,
      showManualMatrixModal,
      showManpowerSnapshotModal,
      showProductivityOutputModal,
      scanModalDate,
      openEmployeeScanModal,
    ]
  );
};
