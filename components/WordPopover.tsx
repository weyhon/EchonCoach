import React, { useEffect } from 'react';
import { WordDefinition } from '../types';

interface WordPopoverProps {
  word: string;
  definition: WordDefinition | null;
  error: boolean;
  left: number;
  top: number;
  placement: 'above' | 'below';
  onReplay: () => void;
  onClose: () => void;
}

// Ink & Paper：surface 底 + 1px 墨色描边 + 2px 圆角，无阴影（design-rules.md 细线规则）
export const WordPopover: React.FC<WordPopoverProps> = ({
  word, definition, error, left, top, placement, onReplay, onClose,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const monoLabel: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.12em',
    color: 'var(--text-muted)',
  };

  return (
    <div
      role="dialog"
      aria-label={`Definition of ${word}`}
      data-word-popover
      className="absolute z-20"
      style={{
        left,
        top,
        transform: placement === 'above' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
        width: 220,
        background: 'var(--surface)',
        border: '1px solid var(--text-primary)',
        borderRadius: 2,
        padding: '10px 12px',
        textAlign: 'left',
      }}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-display" style={{ fontSize: 18, color: 'var(--text-primary)' }}>
          {word}
        </span>
        {definition?.ipa && (
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {definition.ipa}
          </span>
        )}
      </div>
      <div style={{ marginTop: 6, minHeight: 18 }}>
        {error ? (
          <span className="font-mono" style={monoLabel}>LOOKUP FAILED</span>
        ) : definition ? (
          <span className="font-display" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {definition.meaning}
          </span>
        ) : (
          <span className="font-mono" style={monoLabel}>LOOKING UP…</span>
        )}
      </div>
      <button
        type="button"
        aria-label={`Replay "${word}"`}
        onClick={onReplay}
        className="font-mono cursor-pointer hover:opacity-70 active:scale-95 transition-all duration-200"
        style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          color: 'var(--rose)',
          background: 'none',
          border: 'none',
          padding: '12px 0 2px',
          minHeight: 32,
        }}
      >
        ▶ REPLAY
      </button>
    </div>
  );
};
