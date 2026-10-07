import React from 'react';
import { Filter, Search, Layers, Calendar, Cpu } from 'lucide-react';

export default function ControlBar({
  selectedProcess,
  setSelectedProcess,
  selectedMonth,
  setSelectedMonth,
  months,
  selectedUnit,
  setSelectedUnit
}) {
  return (
    <div className="filter-bar" style={{
      background: 'var(--color-base-100, #ffffff)',
      border: '1px solid var(--color-base-300, #e2e8f0)',
      borderRadius: '12px',
      padding: '12px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      marginBottom: '18px',
      boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.05)',
      flexWrap: 'wrap'
    }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        fontWeight: '700',
        color: '#475569',
        textTransform: 'uppercase',
        letterSpacing: '0.6px',
        paddingRight: '6px'
      }}>
        <Filter size={15} color="#6366f1" />
        Filters
      </div>

      <div style={{ width: '1px', height: '24px', background: '#e2e8f0' }}></div>

      {/* Process Filter */}
      <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Process</label>
        <select
          className="filter-select"
          value={selectedProcess}
          onChange={(e) => setSelectedProcess(e.target.value)}
          style={{
            height: '34px',
            padding: '0 30px 0 12px',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            color: '#0f172a',
            backgroundColor: '#f8fafc',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          <option value="E-FPC">E-FPC</option>
          <option value="SMT">SMT_B</option>
          <option value="SMT_F">SMT_F</option>
        </select>
      </div>

      {/* Unit Filter */}
      <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Unit (Sort/View by)</label>
        <select
          className="filter-select"
          value={selectedUnit}
          onChange={(e) => setSelectedUnit(e.target.value)}
          disabled={selectedProcess === 'SMT' || selectedProcess === 'SMT_F'}
          style={{
            height: '34px',
            padding: '0 30px 0 12px',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            color: selectedProcess === 'SMT' || selectedProcess === 'SMT_F' ? '#94a3b8' : '#0f172a',
            backgroundColor: selectedProcess === 'SMT' || selectedProcess === 'SMT_F' ? '#f1f5f9' : '#f8fafc',
            fontWeight: '600',
            cursor: selectedProcess === 'SMT' || selectedProcess === 'SMT_F' ? 'not-allowed' : 'pointer'
          }}
        >
          <option value="Piece">Piece</option>
          {selectedProcess !== 'SMT' && selectedProcess !== 'SMT_F' && (
            <>
              <option value="Sheet">Sheet</option>
              <option value="Lot">Lot</option>
            </>
          )}
        </select>
      </div>

      {/* Month Filter */}
      <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Month</label>
        <select
          className="filter-select"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{
            height: '34px',
            padding: '0 30px 0 12px',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            color: '#0f172a',
            backgroundColor: '#f8fafc',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          {months.map(month => (
            <option key={month} value={month}>{month}</option>
          ))}
        </select>
      </div>

      <div style={{ flex: 1 }}></div>

      <button
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 16px',
          background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '12.5px',
          fontWeight: '600',
          fontFamily: 'Inter, sans-serif',
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
          transition: 'all 0.2s'
        }}
      >
        <Search size={14} />
        Apply
      </button>
    </div>
  );
}
