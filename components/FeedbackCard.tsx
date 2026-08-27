
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

const statusColor = (s: WordAnalysis['status']) =>
  s === 'correct' ? 'var(--green)' : s === 'incorrect' ? 'var(--red)' : 'var(--amber)';

export const FeedbackCard: React.FC<FeedbackCardProps> = ({
  result, isUpdating, activeAudioSource, onPlayWord, onPlayTutor, playingWord, onPlayUserRecording, hasUserRecording, onRetry
}) => {
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [showIPALegend, setShowIPALegend] = useState<boolean>(false);
  const [karaokeIndex, setKaraokeIndex] = useState<number>(-1);
  const [detailWord, setDetailWord] = useState<WordAnalysis | null>(null);
  const [showTranslation, setShowTranslation] = useState<boolean>(false);
  const karaokeTimerRef = useRef<number | null>(null);
  const isPlayingNormal = activeAudioSource === 'input_normal';
  const isPlayingSlow = activeAudioSource === 'input_slow';
  const isKaraokePlaying = isPlayingNormal || isPlayingSlow;
  const isPlayingTutor = activeAudioSource === 'tutor';
  const isTutorLoading = activeAudioSource === 'tutor_loading';

  // Collapse the translation whenever the sentence changes, so each new
  // sentence starts hidden (learners try to understand before revealing).
  useEffect(() => { setShowTranslation(false); }, [result.speechScript]);

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
    <section aria-label="Pronunciation Analysis Results" aria-live="polite" className={`animate-fade-in-up relative transition-all duration-500 ${isUpdating ? 'opacity-50 blur-[1px]' : 'opacity-100'}`}
      style={{ background: 'transparent', borderTop: '1px solid var(--text-primary)' }}>

      {/* === Unified Pronunciation Guide === */}
      <div className="px-1 pt-5 pb-4 border-b animate-section stagger-1 relative" style={{ borderColor: 'var(--border)' }} onMouseUp={handleMouseUp}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="label-micro" style={{ color: 'var(--text-muted)', margin: 0 }}>
            PRONUNCIATION GUIDE
          </h2>
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

        {/* IPA phonetic transcription — a bare mono footnote */}
        {result.fullLinkedPhonetic && (
          <div className="flex justify-center mb-3">
            <div className="px-4 py-1">
              <p className="text-[12px] md:text-[13px] font-medium tracking-[0.08em] font-mono select-none pointer-events-none text-center leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
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

        {/* Chinese translation — still collapsed by default, so the learner
            reads the English before reaching for the answer. The toggle now
            borrows the A/B Reference button's vocabulary (rose hairline when
            idle, filled when active): as muted grey 11px text it was the
            quietest thing on the page and went unfound. */}
        {result.translation && (
          <div className="flex flex-col items-center mt-3">
            {showTranslation && (
              <div
                className="px-4 py-1.5 text-center animate-fade-in"
                style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.5, maxWidth: '90%' }}
              >
                {result.translation}
              </div>
            )}
            <button
              onClick={() => setShowTranslation(v => !v)}
              aria-expanded={showTranslation}
              title="Show the Chinese meaning"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-[2px] text-[11px] font-medium uppercase tracking-[0.06em] transition-all active:scale-95${showTranslation ? ' mt-1.5' : ''}`}
              style={{
                border: '1px solid var(--rose)',
                color: showTranslation ? '#fff' : 'var(--rose)',
                background: showTranslation ? 'var(--rose)' : 'transparent',
              }}
            >
              {showTranslation ? 'Hide Chinese ▴' : 'Show Chinese ▾'}
            </button>
          </div>
        )}

        {/* A/B Compare bar */}
        {hasUserRecording && (
          <div className="flex items-center justify-center gap-2 mt-3 mb-1">
            <button
              onClick={() => onPlayTutor(result.speechScript || '')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[2px] text-[11px] font-medium uppercase tracking-[0.06em] transition-all active:scale-95"
              style={{
                border: '1px solid var(--rose)',
                color: isPlayingTutor ? '#fff' : 'var(--rose)',
                background: isPlayingTutor ? 'var(--rose)' : 'transparent',
              }}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              {isPlayingTutor ? 'Playing...' : 'Reference'}
            </button>
            <span className="text-[10px] font-semibold" style={{ color: 'var(--text-placeholder)' }}>vs</span>
            <button
              onClick={onPlayUserRecording}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[2px] text-[11px] font-medium uppercase tracking-[0.06em] transition-all active:scale-95"
              style={{
                border: `1px solid ${activeAudioSource === 'user_playback' ? 'var(--amber)' : 'var(--border-medium)'}`,
                color: activeAudioSource === 'user_playback' ? '#fff' : 'var(--text-secondary)',
                background: activeAudioSource === 'user_playback' ? 'var(--amber)' : 'transparent',
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
                className="text-white px-4 h-7 rounded-[2px] text-[11px] font-medium uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all animate-bounce-in"
                style={{ backgroundColor: 'var(--pink)' }}
              >
                {isTutorLoading ? (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                )}
                {isTutorLoading ? "Loading..." : isPlayingTutor ? "Playing..." : `"${selectedText.length > 15 ? selectedText.slice(0, 15) + '...' : selectedText}"`}
              </button>
            ) : (
              <p className="text-[12px] font-medium select-none text-center opacity-60" style={{ color: 'var(--text-muted)' }}>
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

      {/* Scoring sections below only appear after the user has recorded
          in this session — pure listening stays a quiet reading page. */}

      {/* Color Legend */}
      {hasUserRecording && result.wordBreakdown?.length > 0 && (
        <div className="flex items-center gap-4 text-[11px] font-medium justify-center flex-wrap pb-4 pt-3 animate-section stagger-2" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: 'var(--green)' }}></span>Correct</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: 'var(--amber)' }}></span>Improve</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: 'var(--red)' }}></span>Incorrect</span>
        </div>
      )}

      {/* Analysis Details — Word Breakdown, set like a book's index */}
      {hasUserRecording && result.wordBreakdown?.length > 0 && (
        <div className="px-1 pb-5 space-y-4 animate-section stagger-3">
          {/* Score — a huge serif numeral in accent ink */}
          {result.score > 0 && (() => {
            const s = result.score;
            const color = s >= 80 ? 'var(--green)' : s >= 60 ? 'var(--amber)' : 'var(--red)';
            const label = s >= 90 ? 'Excellent!' : s >= 80 ? 'Great job!' : s >= 60 ? 'Keep practicing' : 'Try again';
            const grade = s >= 90 ? 'S' : s >= 80 ? 'A' : s >= 70 ? 'B' : s >= 60 ? 'C' : 'D';
            const gradeCls = s >= 90 ? 'pixel-badge-s' : s >= 80 ? 'pixel-badge-a' : s >= 70 ? 'pixel-badge-b' : s >= 60 ? 'pixel-badge-c' : 'pixel-badge-d';
            return (
              <div className="flex items-end gap-5 mb-1 pt-2 animate-score-pop">
                <span className="num font-display" style={{ fontSize: 72, fontWeight: 500, color: 'var(--rose)', lineHeight: 0.85, letterSpacing: '-0.04em' }}>
                  {s}
                </span>
                <div className="flex-1 pb-0.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono" style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Overall / 100</span>
                    <span className={`pixel-badge ${gradeCls}`}>{grade}</span>
                    <span className="font-display" style={{ fontSize: 14, fontStyle: 'italic', color }}>{label}</span>
                  </div>
                  <div className="pixel-bar mt-2.5" style={{ width: '100%' }}>
                    <div className="pixel-bar-fill" style={{ width: `${s}%`, background: color }} />
                  </div>
                </div>
              </div>
            );
          })()}
          <div className="flex items-center gap-3">
             <h4 className="label-micro" style={{ color: 'var(--text-muted)' }}>Word Breakdown</h4>
             <div className="h-px flex-1" style={{ background: 'var(--border-subtle)' }}></div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)' }}>
            {[...result.wordBreakdown].sort((a, b) => {
              const sa = a.wordScore ?? (a.status === 'correct' ? 95 : a.status === 'needs_improvement' ? 56 : 20);
              const sb = b.wordScore ?? (b.status === 'correct' ? 95 : b.status === 'needs_improvement' ? 56 : 20);
              return sa - sb;
            }).map((wa, i) => {
              const wScore = wa.wordScore ?? (wa.status === 'correct' ? 95 : wa.status === 'needs_improvement' ? 56 : 20);
              return (
                <button
                  key={i}
                  onClick={() => setDetailWord(wa)}
                  className="w-full grid items-center gap-4 py-2.5 px-0.5 transition-all animate-pill cursor-pointer text-left group"
                  style={{
                    gridTemplateColumns: 'minmax(84px, 120px) 1fr 40px',
                    animationDelay: `${i * 50}ms`,
                    opacity: 0,
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    borderRadius: 0,
                  }}
                  title="Click for details"
                >
                  <span className="min-w-0">
                    <span className="font-display block truncate" style={{ fontSize: 19, fontWeight: 500, color: statusColor(wa.status), letterSpacing: '-0.01em' }}>{wa.word}</span>
                    {wa.phoneticCorrect && (
                      <span className="font-mono block truncate" style={{ fontSize: 10, letterSpacing: '0.04em', color: 'var(--text-muted)', opacity: 0.8, marginTop: 1 }}>{wa.phoneticCorrect}</span>
                    )}
                  </span>
                  <span className="relative block" style={{ height: 3, background: 'var(--surface-muted)' }}>
                    <span className="absolute left-0 top-0 bottom-0 transition-all duration-700" style={{ width: `${wScore}%`, background: statusColor(wa.status) }} />
                  </span>
                  <span className="font-mono num text-right" style={{ fontSize: 12, fontWeight: 600, color: statusColor(wa.status) }}>{wScore}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Coach's note — italic serif against an accent rule, like a margin annotation */}
      {hasUserRecording && result.overallComment && result.score > 0 && (
        <div className="mx-1 mb-6 animate-section stagger-4"
          style={{ borderLeft: `2px solid ${result.score >= 90 ? 'var(--green)' : 'var(--rose)'}`, paddingLeft: 16, paddingTop: 2, paddingBottom: 2 }}>
          <div className="label-micro mb-1.5" style={{ color: result.score >= 90 ? 'var(--green)' : 'var(--rose)' }}>
            {result.score >= 90 ? 'Excellent!' : "Coach's Note"}
          </div>
          <p className="font-display" style={{ fontSize: 15, fontStyle: 'italic', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
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
