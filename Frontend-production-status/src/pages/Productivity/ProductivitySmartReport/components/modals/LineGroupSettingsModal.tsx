import React from "react";
import { X, Network } from "lucide-react";
import LineGroupSettingsView from "../LineGroupSettingsView";

interface LineGroupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const LineGroupSettingsModal: React.FC<LineGroupSettingsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-base-100 rounded-3xl shadow-2xl border border-base-300 w-full max-w-[96vw] xl:max-w-7xl h-[90vh] max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-base-200 flex items-center justify-between bg-gradient-to-r from-base-100 via-base-200/40 to-base-100 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-base-content">
              Line Group & Output Mapping Settings
            </h2>
            <p className="text-xs text-base-content/60">
              จัดการการแมป Process Name และ Machine Line เข้ากับ Line Group สำหรับการคำนวณ Productivity Output
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content (No outer scroll, children scroll internally) */}
        <div className="flex-1 overflow-hidden p-3 sm:p-4 bg-base-200/30 flex flex-col min-h-0">
          <LineGroupSettingsView onSuccess={onSuccess} onClose={onClose} />
        </div>
      </div>
    </div>
  );
};
