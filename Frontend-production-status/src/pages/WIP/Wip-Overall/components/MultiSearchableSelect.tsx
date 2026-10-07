import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { MultiSelectProps } from '../types';

export const MultiSearchableSelect: React.FC<MultiSelectProps> = ({ label, icon, options, selectedValues, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt => opt !== 'All' && opt.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleToggle = (value: string) => {
        if (selectedValues.includes(value)) {
            const updated = selectedValues.filter(v => v !== value);
            onChange(updated);
        } else {
            onChange([...selectedValues, value]);
        }
    };

    const handleClearAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange([]);
    };

    const displayTitle = selectedValues.length === 0 ? 'All' : `Selected (${selectedValues.length})`;

    return (
        <div className="space-y-1.5 relative" ref={dropdownRef}>
            <label className="text-xs font-bold text-slate-600 flex items-center justify-between">
                <span className="flex items-center gap-1.5">{icon} {label}</span>
                {selectedValues.length > 0 && (
                    <button onClick={handleClearAll} className="text-[10px] text-red-500 hover:underline flex items-center gap-0.5"></button>
                )}
            </label>
            <div
                onClick={() => { setIsOpen(!isOpen); setSearchTerm(''); }}
                className={`w-full border border-slate-300 bg-white rounded-lg px-2.5 py-1.5 text-xs text-slate-700 flex justify-between items-center cursor-pointer hover:border-slate-400 select-none ${isOpen ? 'ring-2 ring-blue-200 border-blue-500' : ''} ${selectedValues.length > 0 ? 'border-blue-500 bg-blue-50/20 font-bold' : ''}`}
            >
                <span className="truncate max-w-[85%]">{displayTitle}</span>
                <ChevronDown size={14} className={`text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
            </div>
            {isOpen && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
                    <div className="p-1.5 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5 sticky top-0">
                        <Search size={12} className="text-slate-400 ml-1 flex-shrink-0" />
                        <input
                            type="text"
                            placeholder="ค้นหา..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full text-xs bg-transparent focus:outline-none text-slate-700 py-0.5"
                            autoFocus
                        />
                    </div>
                    <div className="overflow-y-auto flex-1 max-h-48 divide-y divide-slate-50">
                        {filteredOptions.length === 0 ? (
                            <div className="p-2 text-center text-xs text-slate-400">ไม่พบข้อมูล</div>
                        ) : (
                            filteredOptions.map((opt) => {
                                const isChecked = selectedValues.includes(opt);
                                return (
                                    <div
                                        key={opt}
                                        onClick={() => handleToggle(opt)}
                                        className={`p-2 text-xs cursor-pointer transition-colors flex items-center justify-between gap-2 hover:bg-slate-50 ${isChecked ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600'}`}
                                    >
                                        <span className="truncate">{opt}</span>
                                        {isChecked && <Check size={12} className="text-blue-600 flex-shrink-0" />}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
