import React, { useState, useEffect, useRef } from 'react';
import { RotateCw, Activity } from 'lucide-react';

export default function Header({ selectedProcess, handleRefresh, title, subtitle }) {
  const displayTitle = title || (selectedProcess ? `${selectedProcess} Production Dashboard` : 'Overall Production Dashboard');
  const displaySubtitle = subtitle || `Monitor and track ${selectedProcess ? selectedProcess : 'overall factory'} production performance in real-time`;

  const REFRESH_INTERVAL = 300; // 5 minutes in seconds
  const [timeLeft, setTimeLeft] = useState(REFRESH_INTERVAL);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefreshRef = useRef(handleRefresh);

  useEffect(() => {
    handleRefreshRef.current = handleRefresh;
  }, [handleRefresh]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleRefreshRef.current();
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await handleRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
      setTimeLeft(REFRESH_INTERVAL);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
      <div className="page-title-block">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--color-base-content, #0f172a)', letterSpacing: '-0.4px', margin: 0 }}>
            {displayTitle}
          </h1>
        </div>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', marginBottom: '6px' }}>
          {displaySubtitle}
        </p>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '3px 10px',
          background: 'rgba(34, 197, 94, 0.08)',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          color: '#16a34a',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: '600'
        }}>
          <span style={{
            width: '7px',
            height: '7px',
            background: '#22c55e',
            borderRadius: '50%',
            boxShadow: '0 0 8px #22c55e',
            display: 'inline-block'
          }}></span>
          Live Data (Refreshes in {timeString})
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            fontFamily: 'Inter, sans-serif',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
            transition: 'all 0.2s ease',
            opacity: isRefreshing ? 0.8 : 1
          }}
        >
          <RotateCw size={15} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
          Refresh Data
        </button>
      </div>
    </div>
  );
}
