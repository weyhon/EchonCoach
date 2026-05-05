
import React, { useState, useEffect, useRef } from 'react';
import { AnalysisResult, WordAnalysis } from '../types';
import { IPALegend } from './IPALegend';
import { WordDetailModal } from './WordDetailModal';
import { SentenceAnnotation } from './SentenceAnnotation';

interface FeedbackCardProps {
  result: AnalysisResult;
  isUpdating?: boolean;
  activeAudioSource: string | null;
  onPlayWord: (word: string) => void;
  onPlayTutor: (selectedText: string) => void;
  playingWord: string | null;
  onPlayUserRecording: () => void;
  hasUserRecording?: boolean;
  onRetry?: () => void;
}

const statusBg = (s: WordAnalysis['status']) =>
  s === 'correct' ? 'var(--green-bg)' : s === 'incorrect' ? 'var(--red-bg)' : 'var(--amber-bg)';
const statusColor = (s: WordAnalysis['status']) =>
  s === 'correct' ? 'var(--green)' : s === 'incorrect' ? 'var(--red)' : 'var(--amber)';

export const FeedbackCard: React.FC<FeedbackCardProps> = ({
  result, isUpdating, activeAudioSource, onPlayWord, onPlayTutor, playingWord, onPlayUserRecording, hasUserRecording, onRetry
}) => {
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [showIPALegend, setShowIPALegend] = useState<boolean>(false);
  const [karaokeIndex, setKaraokeIndex] = useState<number>(-1);
  const [detailWord, setDetailWord] = useState<WordAnalysis | null>(null);
  const karaokeTimerRef = useRef<number | null>(null);
  const isPlayingNormal = activeAudioSource === 'input_normal';
  const isPlayingSlow = activeAudioSource === 'input_slow';
  const isKaraokePlaying = isPlayingNormal || isPlayingSlow;
  const isPlayingTutor = activeAudioSource === 'tutor';
  const isTutorLoading = activeAudioSource === 'tutor_loading';

  const handleMouseUp = () => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const rawText = sel.toString().trim();
      const cleanedText = rawText.replace(/[‿●·↗↘/]/g, '').replace(/\s+/g, ' ').trim();
      if (cleanedText && cleanedText.length > 0) {
        setSelectedText(cleanedText);
      } else {
        if (document.activeElement?.tagName !== 'BUTTON') {
           setSelectedText(null);
        }
      }
    }, 50);
  };

  // Karaoke highlight effect — advance word index during TTS playback
  const words = (result.fullLinkedSentence || result.speechScript || "").trim().split(/\s+/);
  useEffect(() => {
    if (!isKaraokePlaying) {
      setKaraokeIndex(-1);
      if (karaokeTimerRef.current) {
        clearInterval(karaokeTimerRef.current);
        karaokeTimerRef.current = null;
      }
      return;
    }

    const allWords = words;
    if (allWords.length === 0) return;

    const baseMs = isPlayingSlow ? 520 : 340;
    const avgLen = allWords.reduce((s, w) => s + w.length, 0) / allWords.length;

    const schedule: number[] = [];
    let cumulative = 120;
    for (const w of allWords) {
      schedule.push(cumulative);
      const factor = Math.max(0.6, w.replace(/[‿?.!,;]/g, '').length / Math.max(avgLen, 1));
      cumulative += baseMs * factor;
    }

    setKaraokeIndex(0);
    let wordIdx = 0;

    const startTime = Date.now();
    karaokeTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      while (wordIdx < allWords.length - 1 && elapsed >= schedule[wordIdx + 1]) {
        wordIdx++;
      }
      setKaraokeIndex(wordIdx);

      if (wordIdx >= allWords.length - 1 && elapsed > cumulative + 200) {
        clearInterval(karaokeTimerRef.current!);
        karaokeTimerRef.current = null;
      }
    }, 50);

    return () => {
      if (karaokeTimerRef.current) {
        clearInterval(karaokeTimerRef.current);
        karaokeTimerRef.current = null;
      }
    };
  }, [isKaraokePlaying, isPlayingSlow, result.fullLinkedSentence, result.speechScript]);

  return (
    <section aria-label="Pronunciation Analysis Results" aria-live="polite" className={`animate-fade-in-up relative transition-all duration-500 rounded-2xl overflow-hidden ${isUpdating ? 'opacity-50 scale-[0.97] blur-[1px]' : 'opacity-100 scale-100'}`}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

      {/* === Unified Pronunciation Guide === */}
      <div className="px-5 pt-4 pb-3 border-b animate-section stagger-1 relative" style={{ borderColor: 'var(--border)' }} onMouseUp={handleMouseUp}>
        <div className="flex items-center justify-between mb-3">
          <div className="label-micro" style={{ color: 'var(--text-placeholder)' }}>
            PRONUNCIATION GUIDE
          </div>
          {result.fullLinkedPhonetic && (
            <button
              onClick={() => setShowIPALegend(true)}
              className="text-[10px] font-semibold uppercase tracking-wider transition-colors flex items-center gap-1 hover-rose"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              IPA
            </button>
          )}
        </div>

        {/* IPA phonetic transcription pill */}
        {result.fullLinkedPhonetic && (
          <div className="flex justify-center mb-3">
            <div className="px-4 py-1.5 rounded-full" style={{ backgroundColor: 'var(--surface-muted)' }}>
              <p className="text-[12px] md:text-[13px] font-medium tracking-[0.06em] font-mono select-none pointer-events-none text-center leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                /{result.fullLinkedPhonetic.split('ˈ').map((part, i) =>
                  i === 0
                    ? <React.Fragment key={i}>{part}</React.Fragment>
                    : <React.Fragment key={i}><span className="font-bold" style={{ color: 'var(--pink)' }}>ˈ</span>{part}</React.Fragment>
                )}/
              </p>
            </div>
          </div>
        )}

        {/* Sentence with annotations + integrated pitch curve */}
        <SentenceAnnotation
          text={result.speechScript || ''}
          wordBreakdown={result.wordBreakdown}
          onWordClick={(word) => onPlayTutor(word)}
          karaokeIndex={karaokeIndex}
          isKaraokePlaying={isKaraokePlaying}
          showPitchCurve
        />

        {/* A/B Compare bar */}
        {hasUserRecording && (
          <div className="flex items-center justify-center gap-2 mt-3 mb-1">
            <button
              onClick={() => onPlayTutor(result.speechScript || '')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95"
              style={{
                border: '1.5px solid var(--rose)',
                color: isPlayingTutor ? '#fff' : 'var(--rose)',
                background: isPlayingTutor ? 'var(--rose)' : 'var(--surface)',
              }}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              {isPlayingTutor ? 'Playing...' : 'Reference'}
            </button>
            <span className="text-[10px] font-semibold" style={{ color: 'var(--text-placeholder)' }}>vs</span>
            <button
              onClick={onPlayUserRecording}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95"
              style={{
                border: `1.5px solid ${activeAudioSource === 'user_playback' ? 'var(--amber)' : 'var(--border)'}`,
                color: activeAudioSource === 'user_playback' ? '#fff' : 'var(--text-secondary)',
                background: activeAudioSource === 'user_playback' ? 'var(--amber)' : 'var(--surface)',
              }}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/></svg>
              {activeAudioSource === 'user_playback' ? 'Playing...' : 'My Voice'}
            </button>
          </div>
        )}

        {/* Hint text (only when no recording yet) */}
        {!hasUserRecording && (
          <div className="flex justify-center mt-2.5 mb-1">
            {selectedText ? (
              <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onPlayTutor(selectedText); }}
                className="text-white px-4 h-7 rounded-full text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all animate-bounce-in"
                style={{ backgroundColor: 'var(--pink)', boxShadow: '0 2px 12px var(--pink-dim)' }}
              >
                {isTutorLoading ? (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                )}
                {isTutorLoading ? "Loading..." : isPlayingTutor ? "Playing..." : `"${selectedText.length > 15 ? selectedText.slice(0, 15) + '...' : selectedText}"`}
              </button>
            ) : (
              <p className="text-[10px] font-medium select-none text-center opacity-30" style={{ color: 'var(--text-muted)' }}>
                Tap a word to hear it · Select text for phrases
              </p>
            )}
          </div>
        )}

        {/* Karaoke progress bar */}
        {isKaraokePlaying && words.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden" style={{ backgroundColor: 'var(--border-subtle)' }}>
            <div
              className="h-full transition-all duration-150 ease-linear rounded-r-full"
              style={{ backgroundColor: 'var(--pink)', width: `${Math.min(100, ((karaokeIndex + 1) / words.length) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Pitch contour is integrated into SentenceAnnotation above */}

      {/* Color Legend */}
      {result.wordBreakdown?.length > 0 && (
        <div className="flex items-center gap-4 text-[10px] font-medium justify-center flex-wrap pb-4 pt-3 animate-section stagger-2" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: 'var(--green)' }}></span>Correct</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: 'var(--amber)' }}></span>Improve</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: 'var(--red)' }}></span>Incorrect</span>
        </div>
      )}

      {/* Analysis Details — Word Breakdown pills */}
      {result.wordBreakdown?.length > 0 && (
        <div className="px-5 pb-5 space-y-4 animate-section stagger-3">
          {/* Score + heading row */}
          {result.score > 0 && (() => {
            const s = result.score;
            const color = s >= 80 ? 'var(--green)' : s >= 60 ? 'var(--amber)' : 'var(--red)';
            const bg = s >= 80 ? 'var(--green-bg)' : s >= 60 ? 'var(--amber-bg)' : 'var(--red-bg)';
            const label = s >= 90 ? 'Excellent!' : s >= 80 ? 'Great job!' : s >= 60 ? 'Keep practicing' : 'Try again';
            const grade = s >= 90 ? 'S' : s >= 80 ? 'A' : s >= 70 ? 'B' : s >= 60 ? 'C' : 'D';
            const gradeCls = s >= 90 ? 'pixel-badge-s' : s >= 80 ? 'pixel-badge-a' : s >= 70 ? 'pixel-badge-b' : s >= 60 ? 'pixel-badge-c' : 'pixel-badge-d';
            return (
              <div className={`flex items-center gap-4 p-3.5 rounded-xl mb-2 animate-score-pop ${s >= 90 ? 'celebrate-pulse' : ''}`} style={{ background: bg }}>
                <span className="num font-bold font-display" style={{ fontSize: 32, color, lineHeight: 1 }}>
                  {s}
                  <span style={{ fontSize: 16 }}>%</span>
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm" style={{ color }}>{label}</span>
                    <span className={`pixel-badge ${gradeCls}`}>{grade}</span>
                  </div>
                  <div className="pixel-bar mt-1.5" style={{ width: '100%' }}>
                    <div className="pixel-bar-fill" style={{ width: `${s}%`, background: color }} />
                  </div>
                </div>
              </div>
            );
          })()}
          <div className="flex items-center gap-3">
             <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, var(--border-subtle))' }}></div>
             <h4 className="label-micro" style={{ color: 'var(--text-muted)' }}>Word Breakdown</h4>
             <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, var(--border-subtle))' }}></div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 flex-wrap" style={{ scrollbarWidth: 'none' }}>
            {[...result.wordBreakdown].sort((a, b) => {
              const order = { incorrect: 0, needs_improvement: 1, correct: 2 };
              return (order[a.status] ?? 1) - (order[b.status] ?? 1);
            }).map((wa, i) => (
              <button
                key={i}
                onClick={() => setDetailWord(wa)}
                className="flex flex-col items-center gap-1 px-3.5 py-2.5 rounded-xl transition-all animate-pill cursor-pointer hover-lift group"
                style={{
                  background: statusBg(wa.status),
                  color: statusColor(wa.status),
                  minWidth: 48,
                  animationDelay: `${i * 50}ms`,
                  opacity: 0,
                  border: `1.5px solid color-mix(in srgb, ${statusColor(wa.status)} 20%, transparent)`,
                }}
                title="Click for details"
              >
                <span className="font-display" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>{wa.word}</span>
                {wa.phoneticCorrect && (
                  <span className="font-mono transition-opacity group-hover:opacity-100" style={{ fontSize: 11, opacity: 0.65 }}>{wa.phoneticCorrect}</span>
                )}
                <span className="w-1.5 h-0.5 rounded-full opacity-0 group-hover:opacity-50 transition-opacity" style={{ background: statusColor(wa.status) }} />
              </button>
            ))}
          </div>
          {result.wordBreakdown.length > 5 && (
            <p className="text-center text-[11px] mt-1" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>← scroll →</p>
          )}
        </div>
      )}

      {/* AI feedback annotation (overall comment) */}
      {result.overallComment && result.score > 0 && (
        <div className={`mx-5 mb-5 p-3.5 rounded-xl animate-section stagger-4 ${result.score >= 90 ? 'celebrate-pulse' : ''}`}
          style={result.score >= 90
            ? { backgroundColor: 'color-mix(in srgb, var(--green) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 18%, transparent)' }
            : { backgroundColor: 'color-mix(in srgb, var(--amber) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 18%, transparent)' }}>
          <div className="label-micro mb-1" style={{ color: result.score >= 90 ? 'var(--green)' : 'var(--amber)' }}>
            {result.score >= 90 ? 'Excellent!' : 'AI Feedback'}
          </div>
          <p className="text-[13px] leading-relaxed font-medium" style={{ color: 'var(--text-primary)' }}>
            {result.overallComment}
          </p>
        </div>
      )}

      {/* Word Detail Modal */}
      {detailWord && (
        <WordDetailModal
          item={detailWord}
          allWords={result.wordBreakdown}
          onSelectWord={(w) => setDetailWord(w)}
          onClose={() => setDetailWord(null)}
          onPlayCoach={(w) => onPlayTutor(w)}
          onPlayUser={onPlayUserRecording}
          onPlayPhoneme={(phonemeText) => onPlayTutor(phonemeText)}
          isCoachPlaying={activeAudioSource === 'tutor'}
          hasUserRecording={!!hasUserRecording}
        />
      )}

      {/* IPA Legend Modal */}
      <IPALegend show={showIPALegend} onClose={() => setShowIPALegend(false)} />
    </section>
  );
};
