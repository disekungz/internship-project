import React from 'react';
import { Target, Layers, Scale, TrendingUp, TrendingDown, Minus, Clock, Package } from 'lucide-react';

export default function SummaryCards({
  isSelected,
  displayTargetQty = 0,
  displayPcsQty = 0,
  displayLotQty = 0,
  diffPcs = 0,
  balanceNew = '0',
  kprDisplay = '0%',
  selectedProcess = '',
  unitLabel = 'Piece'
}) {
  let unitProducedLabel = 'pieces produced';
  if (unitLabel === 'Sheet') unitProducedLabel = 'sheets produced';
  if (unitLabel === 'Lot') unitProducedLabel = 'lots produced';

  const isBalanceNegative = diffPcs < 0;
  const isBalancePositive = diffPcs > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
      {/* Card 1: Target Quantity */}
      <div className="group relative overflow-hidden rounded-2xl border border-rose-200/80 bg-gradient-to-b from-rose-50/60 via-white to-white p-4.5 shadow-xs transition-all duration-200 hover:border-rose-400 hover:shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1 bg-rose-500" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-800/80">
              {isSelected ? 'Daily Target' : 'Total Target Quantity'}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
              <h3 className="text-2xl lg:text-[28px] font-black tracking-tight text-slate-900 font-mono">
                {displayTargetQty.toLocaleString()}
              </h3>
              <span className="text-xs font-bold text-rose-700 bg-rose-100/90 px-2 py-0.5 rounded-md border border-rose-200 shadow-2xs">
                {unitLabel}
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5 border-t border-rose-100 pt-2 text-[11px] font-semibold text-rose-700/90">
              <Target size={13} className="text-rose-500" />
              <span>target set</span>
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 shadow-xs shrink-0">
            <Target size={20} />
          </div>
        </div>
      </div>

      {/* Card 2: Actual Quantity Produced */}
      <div className="group relative overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-b from-sky-50/60 via-white to-white p-4.5 shadow-xs transition-all duration-200 hover:border-sky-400 hover:shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1 bg-sky-500" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-800/80">
              {isSelected ? `Daily ${unitLabel}` : `Total ${unitLabel} Quantity`}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
              <h3 className="text-2xl lg:text-[28px] font-black tracking-tight text-slate-900 font-mono">
                {displayPcsQty.toLocaleString()}
              </h3>
              <span className="text-xs font-bold text-sky-700 bg-sky-100/90 px-2 py-0.5 rounded-md border border-sky-200 shadow-2xs">
                {unitLabel}
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5 border-t border-sky-100 pt-2 text-[11px] font-semibold text-sky-700/90">
              <Layers size={13} className="text-sky-500" />
              <span>{unitProducedLabel}</span>
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-white text-sky-600 shadow-xs shrink-0">
            <Package size={20} />
          </div>
        </div>
      </div>

      {/* Card 3: Balance */}
      <div className={`group relative overflow-hidden rounded-2xl border p-4.5 shadow-xs transition-all duration-200 hover:shadow-sm ${
        isBalanceNegative 
          ? 'border-amber-200/80 bg-gradient-to-b from-amber-50/60 via-white to-white hover:border-amber-400' 
          : 'border-emerald-200/80 bg-gradient-to-b from-emerald-50/60 via-white to-white hover:border-emerald-400'
      }`}>
        <div className={`absolute inset-x-0 top-0 h-1 ${isBalanceNegative ? 'bg-amber-500' : 'bg-emerald-500'}`} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className={`text-[11px] font-bold uppercase tracking-wider ${isBalanceNegative ? 'text-amber-800/80' : 'text-emerald-800/80'}`}>
              {selectedProcess ? `Balance ${selectedProcess}` : 'Total Balance'}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
              <h3 className={`text-2xl lg:text-[28px] font-black tracking-tight font-mono ${
                isBalanceNegative ? 'text-amber-900' : 'text-emerald-900'
              }`}>
                {balanceNew}
              </h3>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md border shadow-2xs ${
                isBalanceNegative 
                  ? 'text-amber-800 bg-amber-100/90 border-amber-200' 
                  : 'text-emerald-800 bg-emerald-100/90 border-emerald-200'
              }`}>
                {unitLabel}
              </span>
            </div>
            <div className={`mt-2.5 flex items-center gap-1.5 border-t pt-2 text-[11px] font-semibold ${
              isBalanceNegative ? 'border-amber-100 text-amber-700/90' : 'border-emerald-100 text-emerald-700/90'
            }`}>
              {isBalanceNegative ? <TrendingDown size={13} className="text-amber-600" /> : <TrendingUp size={13} className="text-emerald-600" />}
              <span>{isBalanceNegative ? 'remaining to target' : 'surplus over target'}</span>
            </div>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl border bg-white shadow-xs shrink-0 ${
            isBalanceNegative ? 'border-amber-200 text-amber-600' : 'border-emerald-200 text-emerald-600'
          }`}>
            <Scale size={20} />
          </div>
        </div>
      </div>

      {/* Card 4: KPR Achievement */}
      <div className="group relative overflow-hidden rounded-2xl border border-purple-200/80 bg-gradient-to-b from-purple-50/60 via-white to-white p-4.5 shadow-xs transition-all duration-200 hover:border-purple-400 hover:shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1 bg-purple-500" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-purple-800/80">
              {selectedProcess ? `KPR ${selectedProcess}` : 'KPR (%)'}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
              <h3 className="text-2xl lg:text-[28px] font-black tracking-tight text-slate-900 font-mono">
                {kprDisplay}
              </h3>
              <span className="text-xs font-bold text-purple-700 bg-purple-100/90 px-2 py-0.5 rounded-md border border-purple-200 shadow-2xs">
                Rate
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5 border-t border-purple-100 pt-2 text-[11px] font-semibold text-purple-700/90">
              <TrendingUp size={13} className="text-purple-500" />
              <span>achievement rate</span>
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-200 bg-white text-purple-600 shadow-xs shrink-0">
            <TrendingUp size={20} />
          </div>
        </div>
      </div>
    </div>
  );
}
