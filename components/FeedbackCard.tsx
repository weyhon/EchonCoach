
import React, { useState, useEffect, useRef } from 'react';
import { AnalysisResult, WordAnalysis } from '../types';
import { isYesNoQuestion, getSentenceIntonation } from '../services/linkingUtils';
import { generateIntonationTokens } from '../services/intonationUtils';
import { IPALegend } from './IPALegend';
import { WordDetailModal } from './WordDetailModal';
import { SentenceAnnotation } from './SentenceAnnotation';

function youTubeSearchUrl(text: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(text + ' pronunciation')}`;
}

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

const ScoreNumber: React.FC<{ score: number }> = ({ score }) => {
  const safe = Math.max(0, Math.min(100, score));
  const color = safe >= 80 ? 'var(--green)' : safe >= 60 ? 'var(--amber)' : 'var(--red)';
  return (
    <div className="flex flex-col items-center shrink-0">
      <span className="font-brand num leading-none" style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.05em', color }}>
        {safe > 0 ? safe : '--'}
      </span>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-placeholder)', marginTop: 3 }}>
        SCORE
      </span>
    </div>
  );
};

const statusBg = (s: WordAnalysis['status']) =>
  s === 'correct' ? 'var(--green-bg)' : s === 'incorrect' ? 'var(--red-bg)' : 'var(--amber-bg)';
const statusColor = (s: WordAnalysis['status']) =>
  s === 'correct' ? '#15803d' : s === 'incorrect' ? '#be185d' : '#92400e';

interface SymbolSpanProps {
  token?: string;
  isLast?: boolean;
  firstWord?: string;
  fullText?: string;
}

const SymbolSpan: React.FC<SymbolSpanProps> = ({ token, isLast, firstWord, fullText }) => {
  let stressSymbol: string | null = null;
  let toneSymbol: string | null = null;

  if (token && token.trim()) {
    const t = token.trim();
    if (t.includes('●')) stressSymbol = '●';
    else if (t.includes('·')) stressSymbol = '·';

    if (t.includes('↗')) toneSymbol = '↗';
    else if (t.includes('↘')) toneSymbol = '↘';
  }

  if (!stressSymbol && !toneSymbol) {
    if (isLast) {
      const sentenceIntonation = fullText ? getSentenceIntonation(fullText) : '↘';
      const isYesNo = firstWord ? isYesNoQuestion(fullText || firstWord) : false;
      stressSymbol = isYesNo ? '·' : '●';
      toneSymbol = sentenceIntonation;
    } else {
      stressSymbol = '·';
    }
  }

  return (
    <div className="flex flex-col items-center justify-start gap-0">
      {toneSymbol && (
        <span className="font-bold text-[16px] leading-none animate-symbol-pop"
          style={{ color: toneSymbol === '↗' ? 'var(--amber)' : 'var(--pink)' }}>
          {toneSymbol}
        </span>
      )}
      {stressSymbol && (
        <span className="font-bold text-[10px]"
          style={{ color: stressSymbol === '●' ? 'var(--pink)' : 'var(--text-muted)' }}>
          {stressSymbol}
        </span>
      )}
    </div>
  );
};

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
  useEffect(() => {
    if (!isKaraokePlaying) {
      setKaraokeIndex(-1);
      if (karaokeTimerRef.current) {
        clearInterval(karaokeTimerRef.current);
        karaokeTimerRef.current = null;
      }
      return;
    }

    const allWords = (result.fullLinkedSentence || result.speechScript || "").trim().split(/\s+/);
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

  const words = (result.fullLinkedSentence || result.speechScript || "").trim().split(/\s+/);
  const sentenceText = result.fullLinkedSentence || result.speechScript || "";

  const wordStatusMap = new Map<string, WordAnalysis['status']>(
    (result.wordBreakdown || []).map(w => [w.word.toLowerCase().replace(/[^a-z]/g, ''), w.status])
  );

  const rawTokens = (result.intonationMap || "").trim().split(/\s+/).filter(Boolean);

  const mapTokens = rawTokens.length === words.length
    ? rawTokens
    : generateIntonationTokens(sentenceText, words);

  return (
    <div className={`animate-fade-in-up relative transition-all duration-500 rounded-2xl overflow-hidden ${isUpdating ? 'opacity-50 scale-[0.97] blur-[1px]' : 'opacity-100 scale-100'}`}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <style>{`
        @keyframes symbol-pop {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-1px) scale(1.03); }
        }
        .animate-symbol-pop { animation: symbol-pop 2s infinite ease-in-out; }
      `}</style>

      {/* Score + sentence row */}
      <div className="flex items-start gap-4 p-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <ScoreNumber score={result.score} />
        <div className="w-px self-stretch shrink-0" style={{ background: 'var(--border)' }} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-x-1" style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.7 }}>
            {result.wordBreakdown.map((w, i) => {
              const color = w.status === 'correct' ? 'var(--green)' : w.status === 'incorrect' ? 'var(--red)' : 'var(--amber)';
              return (
                <span key={i} style={{ color, fontWeight: w.status === 'correct' ? 500 : 600,
                  textDecoration: w.status === 'incorrect' ? 'underline' : 'none',
                  textDecorationColor: 'rgba(239,68,68,0.3)' }}>
                  {w.word}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Playback row */}
      <div className="flex items-center gap-2 px-5 py-3 flex-wrap border-b" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => onPlayWord(result.speechScript || '')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{ border: '1.5px solid var(--rose)', color: 'var(--rose)', background: 'var(--surface)' }}
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          Reference
        </button>

        {hasUserRecording && (
          <button
            onClick={onPlayUserRecording}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth={2}/><polygon points="10,8 16,12 10,16" fill="currentColor"/></svg>
            Your Recording
          </button>
        )}

        <a
          href={youTubeSearchUrl(result.speechScript || '')}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{ border: '1.5px solid #ff0000', color: '#cc0000', background: '#fff7f7', textDecoration: 'none' }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 11, background: '#ff0000', borderRadius: 2, flexShrink: 0 }}>
            <span style={{ width: 0, height: 0, borderStyle: 'solid', borderWidth: '3.5px 0 3.5px 7px', borderColor: 'transparent transparent transparent #fff' }} />
          </span>
          Watch on YouTube
        </a>

        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ml-auto transition-all"
          style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'var(--surface-muted)' }}
          onClick={onRetry}
        >
          ⏺ Try Again
        </button>
      </div>

      {/* Ruby annotation row */}
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-placeholder)', marginBottom: 12 }}>
          PRONUNCIATION GUIDE
        </div>
        <SentenceAnnotation
          text={result.speechScript || ''}
          wordBreakdown={result.wordBreakdown}
        />
      </div>

      {/* Analysis Display */}
      <div
        className="analysis-box rounded-xl p-5 relative min-h-[150px] overflow-hidden"
        style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', margin: '0 16px 16px' }}
        onMouseUp={handleMouseUp}
      >
          <div className="flex flex-col items-center w-full z-10 pb-10">
            {/* Section label */}
            <div className="self-stretch mb-3 px-3 py-1.5 rounded-lg flex items-center gap-2" style={{ backgroundColor: 'rgba(232,88,122,0.07)' }}>
              <svg className="w-3 h-3 shrink-0" style={{ color: 'var(--pink)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5.586V18.414a1 1 0 01-1.707.707L5.586 15z" />
              </svg>
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--pink)' }}>Intonation & Linking</span>
            </div>
            {/* Phonics at top */}
            {result.fullLinkedPhonetic && (
              <div className="mb-3 flex flex-col items-center gap-1.5">
                <div className="px-4 py-1.5 rounded-full" style={{ backgroundColor: 'var(--pink-dim)' }}>
                  <p className="text-[12px] md:text-[14px] font-medium tracking-[0.06em] font-mono select-none pointer-events-none text-center leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    /{result.fullLinkedPhonetic.split('ˈ').map((part, i) =>
                      i === 0
                        ? <React.Fragment key={i}>{part}</React.Fragment>
                        : <React.Fragment key={i}><span className="font-bold" style={{ color: 'var(--pink)' }}>ˈ</span>{part}</React.Fragment>
                    )}/
                  </p>
                </div>
                <button
                  onClick={() => setShowIPALegend(true)}
                  className="text-[9px] font-semibold uppercase tracking-wider transition-colors flex items-center gap-1 pointer-events-auto"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--pink)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  IPA Guide
                </button>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-x-2 md:gap-x-3 gap-y-2 w-full">
              {words.map((word, i) => {
                const cleanWord = word.replace(/[‿?.!,;]/g, '').trim();
                const cleanKey = cleanWord.toLowerCase().replace(/[^a-z]/g, '');
                const status = wordStatusMap.get(cleanKey);
                const isPlaying = playingWord === cleanWord || (isPlayingTutor && selectedText === cleanWord);
                const isKaraokeCurrent = isKaraokePlaying && karaokeIndex === i;
                const isKaraokePast = isKaraokePlaying && karaokeIndex > i;
                const isKaraokeFuture = isKaraokePlaying && karaokeIndex < i;

                const statusColorClass = isPlaying
                  ? 'scale-105 animate-pulse'
                  : isKaraokeCurrent
                    ? 'scale-[1.08]'
                    : 'hover:scale-105 active:scale-95';

                const statusInlineColor = isPlaying
                  ? 'var(--green)'
                  : isKaraokeCurrent
                    ? 'var(--pink)'
                    : isKaraokePast
                      ? 'var(--text-muted)'
                      : isKaraokeFuture
                        ? 'var(--border-medium)'
                        : status === 'incorrect'
                          ? 'var(--red)'
                          : status === 'needs_improvement'
                            ? 'var(--amber)'
                            : 'var(--text-primary)';

                return (
                  <div
                    key={i}
                    className={`flex flex-col items-center min-w-fit group/word transition-all duration-200 ${isKaraokeCurrent ? 'z-10' : ''}`}
                  >
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (cleanWord) {
                          onPlayTutor(cleanWord);
                        }
                      }}
                      className={`text-xl md:text-2xl font-bold leading-none mb-1 break-words text-center tracking-tight relative cursor-pointer transition-all duration-150 ${statusColorClass}`}
                      style={{ color: statusInlineColor }}
                      title={`Click to hear: "${cleanWord}"`}
                    >
                      {word.split('‿').map((part, idx, arr) => (
                        <React.Fragment key={idx}>
                          {part}
                          {idx < arr.length - 1 && (
                            <span className="font-bold mx-1 pointer-events-none" style={{ color: 'var(--pink)', opacity: 0.7 }}>‿</span>
                          )}
                        </React.Fragment>
                      ))}
                    </button>

                    <div className="h-7 flex items-start justify-center select-none pointer-events-none mt-0.5">
                      <SymbolSpan
                        token={mapTokens[i]}
                        isLast={i === words.length - 1}
                        firstWord={words[0]}
                        fullText={result.fullLinkedSentence || result.speechScript || ""}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Karaoke progress bar */}
          {isKaraokePlaying && words.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl overflow-hidden" style={{ backgroundColor: 'var(--border-subtle)' }}>
              <div
                className="h-full transition-all duration-150 ease-linear rounded-r-full"
                style={{ backgroundColor: 'var(--pink)', width: `${Math.min(100, ((karaokeIndex + 1) / words.length) * 100)}%` }}
              />
            </div>
          )}

          {/* Tutorial UI for selections */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full flex justify-center pointer-events-none px-10 z-20">
             {selectedText ? (
               <button
                 onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onPlayTutor(selectedText); }}
                 className="pointer-events-auto text-white px-4 h-8 rounded-full text-[9px] font-semibold uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all animate-bounce-in"
                 style={{ backgroundColor: 'var(--pink)', boxShadow: '0 2px 12px var(--pink-dim)' }}
               >
                 {isTutorLoading ? (
                   <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                 ) : (
                   <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                 )}
                 {isTutorLoading ? "Loading..." : isPlayingTutor ? "Playing..." : `"${selectedText.length > 15 ? selectedText.slice(0, 15) + '...' : selectedText}"`}
               </button>
             ) : (
               <div className="flex flex-col items-center gap-1 opacity-30 transition-opacity hover:opacity-50">
                 <p className="text-[9px] font-medium uppercase tracking-widest select-none text-center" style={{ color: 'var(--text-muted)' }}>Click word to hear</p>
                 <p className="text-[8px] font-medium tracking-wider select-none text-center" style={{ color: 'var(--text-muted)' }}>Select text for phrases</p>
               </div>
             )}
          </div>
      </div>

      {/* Color Legend */}
      {result.wordBreakdown?.length > 0 && (
        <div className="flex items-center gap-4 text-[10px] font-medium justify-center flex-wrap pb-4" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: 'var(--green)' }}></span>Correct</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: 'var(--amber)' }}></span>Improve</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: 'var(--red)' }}></span>Incorrect</span>
        </div>
      )}

      {/* Analysis Details — Word Breakdown pills */}
      {result.wordBreakdown?.length > 0 && (
        <div className="px-5 pb-5 space-y-4">
          <div className="flex items-center gap-4">
             <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, var(--border-subtle))' }}></div>
             <h4 className="font-semibold text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Word Breakdown</h4>
             <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, var(--border-subtle))' }}></div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 flex-wrap" style={{ scrollbarWidth: 'none' }}>
            {result.wordBreakdown.map((wa, i) => (
              <button
                key={i}
                onClick={() => setDetailWord(wa)}
                className="flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-lg transition-all"
                style={{
                  background: statusBg(wa.status),
                  color: statusColor(wa.status),
                  minWidth: 40,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600 }}>{wa.word}</span>
                {wa.phoneticCorrect && (
                  <span className="font-mono" style={{ fontSize: 9, opacity: 0.7 }}>{wa.phoneticCorrect}</span>
                )}
              </button>
            ))}
          </div>
          {result.wordBreakdown.length > 5 && (
            <p className="text-center text-[9px] mt-1" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>← scroll →</p>
          )}
        </div>
      )}

      {/* AI feedback annotation (overall comment) */}
      {result.overallComment && result.score > 0 && (
        <div className="mx-5 mb-5 p-3.5 rounded-xl" style={{ backgroundColor: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.18)' }}>
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--amber)' }}>AI Feedback</div>
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
    </div>
  );
};
