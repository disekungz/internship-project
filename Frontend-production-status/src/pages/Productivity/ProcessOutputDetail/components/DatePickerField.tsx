import { CalendarDays } from "lucide-react";
import React, { useRef } from "react";

const formatDate = (date: string) => {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;
  return `${match[3]}/${match[2]}/${match[1]}`;
};

type DatePickerFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: string;
};

export const DatePickerField: React.FC<DatePickerFieldProps> = ({ label, value, onChange, max }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch (e) {
        // Fallback to click if showPicker fails
      }
    }

    input.click();
  };

  return (
    <div className="relative min-w-[145px]">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-base-content/50 select-none">
        {label}
      </span>
      <div className="relative group">
        <button
          type="button"
          className="flex h-10 w-full cursor-pointer items-center justify-between rounded-xl border border-base-300 bg-base-100 px-3 text-sm font-medium transition-all group-hover:border-primary/40 group-hover:bg-base-200/50 group-hover:shadow-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          onClick={openPicker}
        >
          <span className="font-mono text-xs font-semibold text-base-content select-none">
            {formatDate(value)}
          </span>
          <CalendarDays className="h-4 w-4 text-base-content/45 group-hover:text-primary transition-colors pointer-events-none" />
        </button>
        <input
          ref={inputRef}
          type="date"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 z-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
          value={value}
          max={max}
          onChange={e => onChange(e.target.value)}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker();
            } catch (err) {}
          }}
          aria-label={label}
        />
      </div>
    </div>
  );
};
