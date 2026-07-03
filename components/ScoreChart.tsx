
import React from 'react';
import { HistoryItem } from '../types';

interface ScoreChartProps {
  history: HistoryItem[];
}

export const ScoreChart: React.FC<ScoreChartProps> = ({ history }) => {
  // Only show scored items, take last 10, oldest → newest
  const scored = history.filter(h => h.score > 0).slice(0, 10).reverse();
  if (scored.length < 2) return null;

  const W = 260, H = 60, PAD = 8;
  const scores = scored.map(h => h.score);
  const minS = Math.min(...scores);
  const maxS = Math.max(...scores);
  const range = maxS - minS || 1;

  const x = (i: number) => PAD + (i / (scored.length - 1)) * (W - PAD * 2);
  const y = (s: number) => H - PAD - ((s - minS) / range) * (H - PAD * 2);

  const points = scored.map((h, i) => `${x(i)},${y(h.score)}`).join(' ');
  const last = scored[scored.length - 1];
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const trend = scored[scored.length - 1].score - scored[0].score;

  return (
    <div className="py-3" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="label-micro" style={{ color: 'var(--text-muted)' }}>
          Progress · last {scored.length}
        </span>
        <div className="flex items-center gap-2">
          <span className="num" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 500 }}>avg {avg}</span>
          <span className="num flex items-center gap-0.5" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: trend >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {trend >= 0 ? '↑' : '↓'}{Math.abs(trend)}
          </span>
        </div>
      </div>
      <svg width={W} height={H} className="w-full" viewBox={`0 0 ${W} ${H}`}>
        {/* Grid line at midpoint */}
        <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2}
          stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="3,3" />
        {/* Area fill */}
        <polygon
          points={`${x(0)},${H - PAD} ${points} ${x(scored.length - 1)},${H - PAD}`}
          fill="var(--pink)" opacity="0.06"
        />
        {/* Line — ink stroke, accent marks the latest point */}
        <polyline points={points} fill="none" stroke="var(--text-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Last point dot */}
        <circle cx={x(scored.length - 1)} cy={y(last.score)} r="3" fill="var(--pink)" />
      </svg>
    </div>
  );
};
