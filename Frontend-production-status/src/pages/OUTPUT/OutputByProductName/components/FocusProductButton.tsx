import React from "react";
import { ChartColumn, X } from "lucide-react";

interface FocusProductButtonProps {
  productName: string;
  isSelected: boolean;
  setSelectedProduct: (val: string | null) => void;
}

// ปุ่มกรองให้กราฟ/สรุปทั้งหน้าแสดงเฉพาะ product นี้ (กดซ้ำเพื่อยกเลิก)
export const FocusProductButton: React.FC<FocusProductButtonProps> = ({ productName, isSelected, setSelectedProduct }) => {
  const hint = isSelected
    ? "Clear chart — show all products again"
    : `Show only ${productName} in the chart and summary`;

  return (
    <button
      type="button"
      title={hint}
      aria-label={hint}
      aria-pressed={isSelected}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedProduct(isSelected ? null : productName);
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[10px] font-semibold whitespace-nowrap shrink-0 transition-colors ${isSelected
        ? "bg-primary text-primary-content border-primary hover:bg-primary/85"
        : "bg-base-100 text-base-content/55 border-base-300 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
        }`}
    >
      {isSelected ? <X className="w-3 h-3" /> : <ChartColumn className="w-3 h-3" />}
      <span>{isSelected ? "Clear" : "View chart"}</span>
    </button>
  );
};
