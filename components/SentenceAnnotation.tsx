import React, { useRef, useEffect, useState, useCallback } from 'react';
import { WordAnalysis } from '../types';
import { shouldLink, isFunctionWord } from '../services/linkingUtils';
import { generateIntonationTokens as getTokens } from '../services/intonationUtils';
import { isYesNoQuestion, isWhQuestion } from '../services/linkingUtils';

export interface AnnotationWord {
  word: string;
  ipa?: string;
  isStressed: boolean;
  intonation?: '↗' | '↘';
  linksToNext: boolean;
  status?: WordAnalysis['status'];
}

export function buildAnnotationWords(
  text: string,
  wordBreakdown: WordAnalysis[] | undefined
): AnnotationWord[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const rawWords = trimmed.split(/\s+/);
  const tokens = getTokens(text, rawWords);

  return rawWords.map((word, i) => {
    const token = tokens[i] ?? '·';
    const cleanedWord = word.toLowerCase().replace(/[?.!,;:'"()[\]{}]/g, '');
    const isStressed = !isFunctionWord(cleanedWord);
    const intonation = token.includes('↗') ? '↗' : token.includes('↘') ? '↘' : undefined;
    const linksToNext = i < rawWords.length - 1 ? shouldLink(word, rawWords[i + 1]) : false;
    const analysis = wordBreakdown?.[i];
    return { word, ipa: analysis?.phoneticCorrect, isStressed, intonation: intonation as '↗' | '↘' | undefined, linksToNext, status: analysis?.status };
  });
}

const wordColor = (status?: WordAnalysis['status']): string => {
  if (!status) return 'var(--text-primary)';
  if (status === 'correct') return 'var(--green)';
  if (status === 'incorrect') return 'var(--red)';
  return 'var(--amber)';
};

interface Props {
  text: string;
  wordBreakdown?: WordAnalysis[];
  onWordClick?: (word: string) => void;
  karaokeIndex?: number;
  isKaraokePlaying?: boolean;
  showPitchCurve?: boolean;
}

function getPitchValues(text: string): number[] {
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return [];
  const isYesNo = isYesNoQuestion(text);
  const isWh = isWhQuestion(text);
  return words.map((word, i) => {
    const cleaned = word.toLowerCase().replace(/[?.!,;:'"()[\]{}]/g, '');
    const isFunc = isFunctionWord(cleaned);
    const isLast = i === words.length - 1;
    const isFirst = i === 0;
    const pos = words.length > 1 ? i / (words.length - 1) : 0.5;
    let p = isFunc ? 0.35 : 0.65;
    if (isFirst && !isFunc) p = 0.75;
    if (isFirst && isWh) p = 0.85;
    if (isYesNo) { if (isLast) p = 0.9; else p -= pos * 0.15; }
    else if (isWh) { if (!isFirst) p -= pos * 0.3; if (isLast) p = Math.min(p, 0.2); }
    else { p -= pos * 0.2; if (isLast) p = Math.min(p, 0.15); }
    return Math.max(0.05, Math.min(0.95, p));
  });
}

function smoothCurvePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  const t = 0.3;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    d += ` C ${p1.x + (p2.x - p0.x) * t} ${p1.y + (p2.y - p0.y) * t}, ${p2.x - (p3.x - p1.x) * t} ${p2.y - (p3.y - p1.y) * t}, ${p2.x} ${p2.y}`;
  }
  return d;
}

// Pitch displacement range
const PITCH_RANGE = 18;

export const SentenceAnnotation: React.FC<Props> = ({
  text, wordBreakdown, onWordClick, karaokeIndex = -1, isKaraokePlaying = false,
  showPitchCurve = false,
}) => {
  const words = buildAnnotationWords(text, wordBreakdown);
  const pitchValues = showPitchCurve ? getPitchValues(text) : [];
  const containerRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Reset refs array to match current word count
  wordRefs.current.length = words.length;
  const [segments, setSegments] = useState<{
    curvePath: string;
    fillBelow: string;
    dots: { x: number; y: number; pitch: number }[];
  }[]>([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });

  const updateCurve = useCallback(() => {
    if (!showPitchCurve || !containerRef.current || wordRefs.current.length === 0) return;
    const cr = containerRef.current.getBoundingClientRect();
    setSvgSize({ w: cr.width, h: cr.height });

    const allData: { x: number; wordTop: number; wordBottom: number; pitch: number }[] = [];
    wordRefs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      allData.push({
        x: r.left - cr.left + r.width / 2,
        wordTop: r.top - cr.top,
        wordBottom: r.bottom - cr.top,
        pitch: pitchValues[i] ?? 0.5,
      });
    });

    // Split by visual lines
    const lines: typeof allData[] = [];
    let cur: typeof allData = [];
    allData.forEach((pt, i) => {
      if (i > 0 && Math.abs(pt.wordTop - allData[i - 1].wordTop) > 25) {
        if (cur.length > 0) lines.push(cur);
        cur = [];
      }
      cur.push(pt);
    });
    if (cur.length > 0) lines.push(cur);

    // Curve sits right on top of IPA annotations
    const CURVE_GAP = -6;
    const newSegs = lines.map(pts => {
      // Curve points: above each word, mirroring pitch displacement
      const curvePoints = pts.map(p => ({
        x: p.x,
        y: p.wordTop - CURVE_GAP, // sits above the word
        pitch: p.pitch,
      }));
      if (curvePoints.length < 2) return { curvePath: '', fillBelow: '', dots: curvePoints };

      const curvePath = smoothCurvePath(curvePoints);
      const first = curvePoints[0];
      const last = curvePoints[curvePoints.length - 1];
      // Fill from curve DOWN toward the words — soft draping canopy
      const fillBottom = Math.max(...pts.map(p => p.wordBottom)) + 4;
      const fillBelow = curvePath + ` L ${last.x} ${fillBottom} L ${first.x} ${fillBottom} Z`;

      return { curvePath, fillBelow, dots: curvePoints };
    });

    setSegments(newSegs);
  }, [showPitchCurve, pitchValues]);

  useEffect(() => {
    updateCurve();
    window.addEventListener('resize', updateCurve);
    return () => window.removeEventListener('resize', updateCurve);
  }, [updateCurve, text, wordBreakdown]);

  useEffect(() => {
    if (showPitchCurve) {
      const t = setTimeout(updateCurve, 60);
      return () => clearTimeout(t);
    }
  }, [showPitchCurve, updateCurve]);

  return (
    <div
      ref={containerRef}
      className="select-none relative"
      style={{
        lineHeight: 1,
        paddingTop: showPitchCurve ? PITCH_RANGE + 10 : 0,
        paddingBottom: showPitchCurve ? 4 : 0,
      }}
    >
      {/* === SVG: curve + fill below === */}
      {showPitchCurve && segments.length > 0 && (
        <svg
          className="absolute inset-0 pointer-events-none"
          width={svgSize.w} height={svgSize.h}
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* Gradient: curve (top) → words (bottom), canopy draping down */}
            <linearGradient id="pitch-fill-down" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--rose)" stopOpacity="0.13" />
              <stop offset="30%" stopColor="var(--rose)" stopOpacity="0.08" />
              <stop offset="65%" stopColor="var(--rose)" stopOpacity="0.03" />
              <stop offset="100%" stopColor="var(--rose)" stopOpacity="0" />
            </linearGradient>
            {/* Stroke: rose → amber for rising, rose → rose for falling */}
            <linearGradient id="pitch-line-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--rose)" stopOpacity="0.7" />
              <stop offset="60%" stopColor="var(--rose)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="var(--amber)" stopOpacity="0.55" />
            </linearGradient>
            {/* Soft glow behind the curve */}
            <filter id="pglow">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
            </filter>
          </defs>

          {segments.map((seg, si) => (
            <g key={si}>
              {/* Area fill — mountain chart style, only below curve */}
              {seg.fillBelow && <path d={seg.fillBelow} fill="url(#pitch-fill-down)" />}
              {/* Glow layer */}
              {seg.curvePath && (
                <path d={seg.curvePath} fill="none" stroke="var(--rose)" strokeWidth="4" strokeOpacity="0.06" strokeLinecap="round" filter="url(#pglow)" />
              )}
              {/* Main curve */}
              {seg.curvePath && (
                <path d={seg.curvePath} fill="none" stroke="url(#pitch-line-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              )}
              {/* Subtle dot markers on the curve */}
              {seg.dots.map((pt, di) => (
                <circle key={di} cx={pt.x} cy={pt.y} r="2.5" fill="var(--rose)" fillOpacity="0.35" />
              ))}
            </g>
          ))}
        </svg>
      )}

      {/* === Words with pitch displacement === */}
      <div
        className="flex items-end flex-wrap justify-center relative z-[1]"
        style={{ gap: showPitchCurve ? '20px 0' : '12px 0' }}
      >
        {words.map((w, i) => {
          const isKaraokeCurrent = isKaraokePlaying && karaokeIndex === i;
          const isKaraokePast = isKaraokePlaying && karaokeIndex > i;
          const isKaraokeFuture = isKaraokePlaying && karaokeIndex >= 0 && karaokeIndex < i;

          let color = wordBreakdown ? wordColor(w.status) : 'var(--text-primary)';
          if (isKaraokeCurrent) color = 'var(--rose)';
          else if (isKaraokePast) color = 'var(--text-muted)';
          else if (isKaraokeFuture) color = 'var(--border-medium)';

          const pitch = pitchValues[i] ?? 0.5;
          const yOffset = showPitchCurve ? -(pitch - 0.4) * PITCH_RANGE : 0;

          return (
            <React.Fragment key={i}>
              <div
                ref={el => { wordRefs.current[i] = el; }}
                className={`flex flex-col items-center shrink-0 transition-all duration-200 ${isKaraokeCurrent ? 'scale-[1.06] z-10' : ''}`}
                style={{ transform: showPitchCurve ? `translateY(${yOffset}px)` : undefined }}
              >
                {/* IPA + stress + intonation */}
                <div className="flex items-center justify-center gap-0.5 h-5">
                  {w.isStressed && !isKaraokePlaying && (
                    <span className="font-bold leading-none" style={{ fontSize: 9, color: 'var(--rose)' }}>●</span>
                  )}
                  {w.ipa && (
                    <span className="font-mono leading-none" style={{
                      fontSize: 11,
                      color: isKaraokeCurrent ? 'var(--rose)' : isKaraokePast ? 'var(--text-placeholder)' : w.status ? wordColor(w.status) : 'var(--text-muted)',
                      opacity: isKaraokeFuture ? 0.3 : 0.8,
                    }}>
                      {w.ipa}
                    </span>
                  )}
                  {w.intonation && !isKaraokePlaying && (
                    <span className="font-bold leading-none" style={{ fontSize: 11, color: w.intonation === '↗' ? 'var(--amber)' : 'var(--text-muted)', marginLeft: 1 }}>
                      {w.intonation}
                    </span>
                  )}
                </div>
                {/* Word */}
                <span
                  role={onWordClick ? 'button' : undefined}
                  tabIndex={onWordClick ? 0 : undefined}
                  aria-label={onWordClick ? `Hear "${w.word.replace(/[?.!,;:'"()[\]{}]/g, '')}"` : undefined}
                  className={`leading-none font-display${onWordClick ? ' cursor-pointer hover:opacity-70 active:scale-95 transition-all duration-150' : ''}`}
                  style={{
                    fontSize: 22,
                    fontWeight: w.isStressed ? 700 : 400,
                    color,
                    borderBottom: w.isStressed && !isKaraokePlaying ? '2px solid var(--rose)' : undefined,
                    paddingBottom: w.isStressed && !isKaraokePlaying ? 2 : 0,
                    letterSpacing: '-0.01em',
                  }}
                  onClick={onWordClick ? () => onWordClick(w.word.replace(/[?.!,;:'"()[\]{}]/g, '')) : undefined}
                  title={onWordClick ? 'Click to hear pronunciation' : undefined}
                >
                  {w.word}
                </span>
              </div>

              {/* Linking arc */}
              {w.linksToNext && (
                <div className="flex flex-col items-center self-end shrink-0" style={{
                  width: 14, marginBottom: 2,
                  transform: showPitchCurve ? `translateY(${yOffset}px)` : undefined,
                }}>
                  <div style={{ height: 20 }} />
                  <span className="leading-none font-bold" style={{ fontSize: 20, color: 'var(--rose)', opacity: 0.5, lineHeight: 1, marginBottom: 1 }}>‿</span>
                </div>
              )}

              {/* Spacing */}
              {!w.linksToNext && i < words.length - 1 && (
                <div className="shrink-0" style={{ width: 7 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
