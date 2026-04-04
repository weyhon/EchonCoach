
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HistoryItem } from '../types';
import { ScoreChart } from './ScoreChart';

interface HistoryListProps {
  history: HistoryItem[];
  onSelect: (text: string) => void;
  onClear: () => void;
  onQuickAnalyze?: (text: string) => void;
  onQuickRecord?: (text: string) => void;
}

type TooltipState = { id: string; top: number; left: number } | null;

const SearchIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const TOOLTIP_WIDTH = 260;
const TOOLTIP_GAP = 14;
const HIDE_DELAY = 120;

const formatTimestamp = (ts: number) => {
  const d = new Date(ts);
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  );
};

export const HistoryList: React.FC<HistoryListProps> = ({
  history, onSelect, onClear, onQuickAnalyze,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const hideTimerRef = useRef<number | null>(null);

  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) return history;
    return history.filter(item =>
      item.text.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [history, searchTerm]);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => setTooltip(null), HIDE_DELAY);
  }, [clearHideTimer]);

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>, id: string) => {
    clearHideTimer();
    const rect = e.currentTarget.getBoundingClientRect();
    const left = Math.max(8, rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP);
    const top = Math.min(
      Math.max(80, rect.top + rect.height / 2),
      window.innerHeight - 100,
    );
    setTooltip({ id, top, left });
  };

  if (history.length === 0) return null;

  const hoveredItem = tooltip ? history.find(h => h.id === tooltip.id) : null;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="label-micro" style={{ color: 'var(--text-placeholder)' }}>
          History
        </span>
        <button
          onClick={onClear}
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-placeholder)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
          className="hover-red"
        >
          Clear
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none" style={{ color: 'var(--text-placeholder)' }}>
          <SearchIcon />
        </div>
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg text-[12px] font-medium focus:outline-none transition-colors input-focus"
          style={{
            background: 'var(--surface-muted)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* Progress chart */}
      <ScoreChart history={history} />

      {/* List */}
      <div className="space-y-0.5">
        {filteredHistory.map((item) => {
          const isActive = tooltip?.id === item.id;

          return (
            <div
              key={item.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors min-h-[48px]"
              style={{ background: isActive ? 'var(--rose-50)' : 'transparent' }}
              onMouseEnter={(e) => {
                handleMouseEnter(e, item.id);
                if (!isActive) e.currentTarget.style.background = 'var(--surface-muted)';
              }}
              onMouseLeave={(e) => {
                scheduleHide();
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
              onClick={() => {
                setTooltip(null);
                if (onQuickAnalyze) {
                  onQuickAnalyze(item.text);
                } else {
                  onSelect(item.text);
                }
              }}
            >
              {/* Text */}
              <div className="flex-1 min-w-0">
                <div style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {item.text}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-placeholder)', marginTop: 1 }}>
                  {formatTimestamp(item.timestamp)}
                </div>
              </div>

              {/* Score badge */}
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 20,
                flexShrink: 0,
                background: item.score >= 80 ? 'var(--green-bg)' : item.score >= 60 ? 'var(--amber-bg)' : 'var(--red-bg)',
                color: item.score >= 80 ? 'var(--green)' : item.score >= 60 ? 'var(--amber)' : 'var(--red)',
              }}>
                {item.score > 0 ? `${item.score}%` : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tooltip portal */}
      {tooltip && hoveredItem && createPortal(
        <div
          style={{
            position: 'fixed',
            top: tooltip.top,
            left: tooltip.left,
            width: TOOLTIP_WIDTH,
            transform: 'translateY(-50%)',
            zIndex: 99999,
            pointerEvents: 'none',
          }}
        >
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 14px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
            position: 'relative',
          }}>
            <p style={{
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 500,
              lineHeight: 1.5,
              margin: 0,
              wordBreak: 'break-word',
            }}>
              {hoveredItem.text}
            </p>
            {/* Arrow */}
            <div style={{
              position: 'absolute',
              right: -6,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 0,
              height: 0,
              borderTop: '6px solid transparent',
              borderBottom: '6px solid transparent',
              borderLeft: '6px solid var(--border)',
            }} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
