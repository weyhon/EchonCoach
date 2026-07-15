import React, { useEffect } from 'react';
import { WordDefinition } from '../types';

interface WordPopoverProps {
  word: string;
  definition: WordDefinition | null;
  error: boolean;
  left: number;
  top: number;
  placement: 'above' | 'below';
  /** 卡片被视口钳位后，小纸角相对卡片中心的水平偏移（px），保证始终指向单词 */
  caretShift?: number;
  onReplay: () => void;
  onClose: () => void;
}

// Ink & Paper：一条精装词典词条。
// 顶部 2px 墨色重规则线（印刷词典的栏目头），词头行 + 细线 + 释义行，
// 小纸角指向单词，无阴影（design-rules.md 细线规则）。
export const WordPopover: React.FC<WordPopoverProps> = ({
  word, definition, error, left, top, placement, caretShift = 0, onReplay, onClose,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isAbove = placement === 'above';

  const statusLabel: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: '0.14em',
    color: 'var(--text-muted)',
  };

  return (
    <div
      role="dialog"
      aria-label={`Definition of ${word}`}
      data-word-popover
      className="absolute z-20 word-popover-enter"
      style={{
        left,
        top,
        transform: isAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
        minWidth: 148,
        maxWidth: 260,
        width: 'max-content',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderTop: '2px solid var(--text-primary)',
        borderRadius: 2,
        textAlign: 'left',
      }}
    >
      {/* 词头行：word + IPA + 复读 —— 词典条目的第一行 */}
      <div className="flex items-baseline gap-2" style={{ padding: '9px 12px 7px' }}>
        <span className="font-display" style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.1 }}>
          {word}
        </span>
        {definition?.ipa && (
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {definition.ipa}
          </span>
        )}
        <button
          type="button"
          aria-label={`Replay "${word}"`}
          title="Replay pronunciation"
          onClick={onReplay}
          className="font-mono cursor-pointer hover:opacity-70 active:scale-95 transition-all duration-200 ml-auto"
          style={{
            fontSize: 11,
            color: 'var(--rose)',
            background: 'none',
            border: 'none',
            // 视觉紧凑但保住点击热区
            padding: '8px 2px 8px 10px',
            margin: '-8px -2px -8px 0',
            lineHeight: 1,
            alignSelf: 'center',
          }}
        >
          ▶
        </button>
      </div>

      {/* 细规则线：词头与释义之间的条目分隔（hairline rule） */}
      <div style={{ borderTop: '1px solid var(--border)', margin: '0 12px' }} />

      {/* 释义行 */}
      <div style={{ padding: '7px 12px 9px', minHeight: 20 }}>
        {error ? (
          <span className="font-mono" style={statusLabel}>LOOKUP FAILED</span>
        ) : definition ? (
          <span className="font-display" style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            {definition.meaning}
          </span>
        ) : (
          <span className="font-mono word-popover-pulse" style={statusLabel}>LOOKING UP…</span>
        )}
      </div>

      {/* 小纸角：指向被点的单词（paper + hairline，旋转 45° 的小方块） */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 8,
          height: 8,
          background: 'var(--surface)',
          left: `calc(50% + ${caretShift}px)`,
          ...(isAbove
            ? {
                bottom: -5,
                transform: 'translateX(-50%) rotate(45deg)',
                borderRight: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
              }
            : {
                top: -5.5,
                transform: 'translateX(-50%) rotate(45deg)',
                borderLeft: '2px solid var(--text-primary)',
                borderTop: '2px solid var(--text-primary)',
              }),
        }}
      />
    </div>
  );
};
