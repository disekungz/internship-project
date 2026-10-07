import React from 'react';
import { Info, X } from 'lucide-react';

export default function InfoBar({ showingText, isSelected, setSelectedDateData }) {
  return (
    <div style={{
      background: 'rgba(239, 246, 255, 0.8)',
      border: '1px solid rgba(191, 219, 254, 0.9)',
      borderRadius: '10px',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '18px',
      fontSize: '12.5px',
      color: '#1e40af',
      fontWeight: '600'
    }}>
      <Info size={16} color="#3b82f6" />
      <span>{showingText}</span>
      {isSelected && (
        <button
          onClick={() => setSelectedDateData(null)}
          style={{
            marginLeft: 'auto',
            background: '#dbeafe',
            border: 'none',
            color: '#1d4ed8',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: '700',
            padding: '4px 10px',
            borderRadius: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'background 0.2s'
          }}
        >
          <X size={12} />
          Clear Selection
        </button>
      )}
    </div>
  );
}
