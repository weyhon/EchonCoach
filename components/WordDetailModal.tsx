import React, { useState, useEffect, useRef } from 'react';
import { WordAnalysis } from '../types';
import { PHONEME_VIDEOS } from '../data/phonemeVideos';

interface WordDetailModalProps {
  item: WordAnalysis;
  allWords?: WordAnalysis[];
  onSelectWord?: (word: WordAnalysis) => void;
  onClose: () => void;
  onPlayCoach: (word: string) => void;
  onPlayUser: () => void;
  onPlayPhoneme: (phonemeText: string) => void;
  isCoachPlaying: boolean;
  hasUserRecording: boolean;
}

// Maps IPA phonemes to "wrong" English words/sounds that TTS will pronounce differently.
// Key: correct IPA phoneme, Value: a confusable word snippet that sounds wrong.
const WRONG_SOUND: Record<string, string> = {
  // Consonants
  'ʃ': 's',      // sh → s: "sure" → "soor"
  'ʒ': 'z',      // zh → z: "measure" → "mezure"
  'θ': 's',      // th → s: "think" → "sink"
  'ð': 'd',      // th → d: "the" → "duh"
  'ɹ': 'l',      // r → l: "red" → "led"
  'v': 'w',      // v → w: "very" → "wery"
  'ŋ': 'n',      // ng → n: "sing" → "sin"
  'tʃ': 'ts',    // ch → ts: "church" → "tsurtsh"
  'dʒ': 'z',     // j → z: "judge" → "zuz"
  // Vowels & diphthongs
  'æ': 'ɛ',      // cat → "ket"
  'ɪ': 'i',      // bit → "beat"
  'ʊ': 'u',      // book → "buke"
  'oʊ': 'ɔ',     // go → "gaw"
  'aɪ': 'a',     // my → "mah"
  'aʊ': 'ɑ',     // how → "hah"
  'eɪ': 'ɛ',     // day → "deh"
  'ɝ': 'ɜ',      // bird → non-rhotic
};

// Map each IPA phoneme to a TTS-friendly English spelling
const IPA_TO_SPELL: [string, string][] = [
  ['aɪ', 'eye'], ['aʊ', 'ow'], ['ɔɪ', 'oy'], ['eɪ', 'ay'], ['oʊ', 'oh'],
  ['tʃ', 'ch'], ['dʒ', 'j'],
  ['ʃ', 'sh'], ['ʒ', 'zh'], ['θ', 'th'], ['ð', 'th'], ['ŋ', 'ng'],
  ['ɹ', 'r'], ['j', 'y'],
  ['b', 'b'], ['d', 'd'], ['f', 'f'], ['g', 'g'], ['h', 'h'],
  ['k', 'k'], ['l', 'l'], ['m', 'm'], ['n', 'n'], ['p', 'p'],
  ['s', 's'], ['t', 't'], ['v', 'v'], ['w', 'w'], ['z', 'z'],
  ['i', 'ee'], ['ɪ', 'ih'], ['ɛ', 'eh'], ['e', 'eh'],
  ['æ', 'a'], ['ɑ', 'ah'], ['ɔ', 'aw'],
  ['ʊ', 'oo'], ['u', 'oo'], ['ʌ', 'uh'], ['ə', 'uh'],
  ['ɝ', 'er'], ['ɜ', 'ur'],
];

/**
 * Build a TTS-speakable mispronunciation of the word.
 * Strategy: take the correct IPA, swap low-scoring phonemes with common errors,
 * then convert to English respelling so TTS reads it differently.
 */
function buildMispronunciation(item: WordAnalysis): string {
  if (!item.phoneticCorrect || !item.phonemes?.length) return item.word;

  // Find which phonemes scored poorly
  const weakPhonemes = new Set(
    item.phonemes.filter(p => p.score < 70).map(p => p.phoneme)
  );

  if (weakPhonemes.size === 0) return item.word;

  // Build the user's IPA by swapping weak phonemes
  let ipa = item.phoneticCorrect.replace(/[ˈˌ.]/g, '');
  // Sort WRONG_SOUND keys by length descending so longer matches go first
  const sortedKeys = Object.keys(WRONG_SOUND).sort((a, b) => b.length - a.length);
  for (const phoneme of sortedKeys) {
    if (weakPhonemes.has(phoneme)) {
      ipa = ipa.replace(phoneme, WRONG_SOUND[phoneme]);
    }
  }

  // Convert IPA to English respelling
  let result = '';
  let i = 0;
  while (i < ipa.length) {
    let matched = false;
    for (const [ipaStr, spelling] of IPA_TO_SPELL) {
      if (ipa.startsWith(ipaStr, i)) {
        result += spelling;
        i += ipaStr.length;
        matched = true;
        break;
      }
    }
    if (!matched) { result += ipa[i]; i++; }
  }

  // If respelling equals the original word, something didn't work — use fallback
  if (result.toLowerCase() === item.word.toLowerCase()) return item.word;

  return result;
}

/** Convert a single IPA phoneme to a TTS-speakable syllable */
function phonemeToSpeakable(ipa: string): string {
  for (const [ipaStr, spelling] of IPA_TO_SPELL) {
    if (ipa === ipaStr) return spelling;
  }
  return ipa; // pass through if unknown
}

const VideoIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" className="shrink-0">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
  </svg>
);

/**
 * Highlight the parts of `b` that differ from `a`.
 * Returns JSX spans: shared chars are plain, extra/different chars get a highlight.
 */
function diffPhonetics(a: string, b: string, highlightColor: string): React.ReactNode {
  // Use a simple LCS-based diff to find matching vs differing characters
  const aChars = [...a];
  const bChars = [...b];

  // Build LCS table
  const m = aChars.length, n = bChars.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = aChars[i - 1] === bChars[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);

  // Backtrack to find which chars in b are in the LCS (shared) vs not (different)
  const bMatched = new Set<number>();
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (aChars[i - 1] === bChars[j - 1]) { bMatched.add(j - 1); i--; j--; }
    else if (dp[i - 1][j] > dp[i][j - 1]) i--;
    else j--;
  }

  // Build spans: group consecutive matched/unmatched chars
  const spans: React.ReactNode[] = [];
  let run = '';
  let runIsHighlight = false;
  bChars.forEach((ch, idx) => {
    const isDiff = !bMatched.has(idx);
    if (isDiff !== runIsHighlight && run) {
      spans.push(runIsHighlight
        ? <mark key={idx} style={{ background: highlightColor, borderRadius: 3, padding: '0 1px' }}>{run}</mark>
        : <span key={idx}>{run}</span>);
      run = '';
    }
    runIsHighlight = isDiff;
    run += ch;
  });
  if (run) {
    spans.push(runIsHighlight
      ? <mark key="end" style={{ background: highlightColor, borderRadius: 3, padding: '0 1px' }}>{run}</mark>
      : <span key="end">{run}</span>);
  }
  return <>{spans}</>;
}

export const WordDetailModal: React.FC<WordDetailModalProps> = ({
  item, allWords, onSelectWord, onClose, onPlayCoach, onPlayUser, onPlayPhoneme, isCoachPlaying, hasUserRecording
}) => {
  const wordScore = item.wordScore ?? (item.status === 'correct' ? 95 : item.status === 'needs_improvement' ? 56 : 20);
  const scoreColor = wordScore >= 80 ? 'var(--green)' : wordScore >= 60 ? 'var(--amber)' : 'var(--red)';
  const phonemes = item.phonemes || [];
  const [playingPhoneme, setPlayingPhoneme] = useState<string | null>(null);
  const [openPhonemeVideo, setOpenPhonemeVideo] = useState<string | null>(null);

  // Dev helper: warn when a low-scoring phoneme has no video entry so we can add it
  const warnMissingVideo = (phoneme: string) => {
    if (import.meta.env.DEV && !PHONEME_VIDEOS[phoneme]) {
      console.warn(`[PhonemeVideo] no video for phoneme: "${phoneme}" — add it to data/phonemeVideos.ts`);
    }
  };

  const handlePlayPhoneme = (phonemeText: string, id: string) => {
    setPlayingPhoneme(id);
    onPlayPhoneme(phonemeText);
    setTimeout(() => setPlayingPhoneme(null), 1500);
  };

  const handleCoachPlay = () => onPlayCoach(item.word);
  const [youPlaying, setYouPlaying] = useState(false);
  const handleYouPlay = () => {
    const mispronounced = buildMispronunciation(item);
    setYouPlaying(true);
    onPlayPhoneme(mispronounced);
    setTimeout(() => setYouPlaying(false), 3000);
  };

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus management: capture previous focus, auto-focus dialog, restore on close
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    // Small delay to ensure the dialog is rendered
    requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });
    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4"
      style={{ background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div className="min-h-full flex items-center justify-center">
      <div ref={dialogRef} role="dialog" aria-label="Word detail" aria-modal="true" tabIndex={-1}
        className="rounded-2xl overflow-hidden w-full max-w-md max-h-[90vh] flex flex-col animate-modal-in my-4 focus:outline-none"
        style={{ background: 'var(--surface)', boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)' }}
        onClick={e => e.stopPropagation()}>

        {/* ─── Horizontal word pills ─── */}
        {allWords && allWords.length > 1 && (
          <div className="word-pills-scroll flex gap-1.5 px-4 pt-4 pb-2 overflow-x-auto">
            {allWords.map((w, i) => {
              const wScore = w.wordScore ?? (w.status === 'correct' ? 95 : w.status === 'needs_improvement' ? 56 : 20);
              const wColor = wScore >= 80 ? 'var(--green)' : wScore >= 60 ? 'var(--amber)' : 'var(--red)';
              const isActive = w.word === item.word;
              return (
                <button
                  key={i}
                  onClick={() => onSelectWord?.(w)}
                  className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all active:scale-95"
                  style={{
                    backgroundColor: isActive ? 'var(--surface-muted)' : 'var(--surface)',
                    border: isActive ? `1.5px solid ${wColor}` : '1.5px solid var(--border)',
                    color: isActive ? wColor : 'var(--text-secondary)',
                  }}
                >
                  {w.word}
                </button>
              );
            })}
          </div>
        )}

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1">

          {/* Header */}
          <div className="flex items-start justify-between px-5 pt-5">
            <span className="font-brand" style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', color: scoreColor }}>
              {item.word}
            </span>
            <button onClick={onClose} aria-label="Close" className="w-7 h-7 rounded-md flex items-center justify-center text-sm"
              style={{ background: 'var(--surface-muted)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
              ✕
            </button>
          </div>

          {/* Score row */}
          <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <span className="font-brand num" style={{ fontSize: 28, fontWeight: 800, color: scoreColor, letterSpacing: '-0.03em' }}>
                {item.wordScore ?? '--'}%
              </span>
              <div className="font-mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Correct: <span style={{ color: 'var(--green)' }}>{item.phoneticCorrect}</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'var(--surface-muted)' }}>
                <div className="rounded-full h-full transition-all duration-700"
                  style={{ width: `${wordScore}%`, background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}dd)` }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-placeholder)', marginTop: 4 }}>
                {wordScore >= 80 ? 'Excellent' : wordScore >= 60 ? 'Good' : 'Needs improvement'}
              </div>
            </div>
          </div>

          {/* Action buttons row */}
          <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <button onClick={handleCoachPlay}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ border: '1.5px solid var(--rose)', color: 'var(--rose)', background: 'var(--surface)' }}>
              ♪ {isCoachPlaying ? 'Playing...' : 'Coach'}
            </button>
            {hasUserRecording && (
              <button onClick={handleYouPlay}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ border: '1px solid var(--border)', color: youPlaying ? 'var(--amber)' : 'var(--text-secondary)', background: 'var(--surface)' }}>
                ◎ {youPlaying ? 'Playing...' : 'You'}
              </button>
            )}
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ml-auto"
              style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'var(--surface-muted)' }}
              onClick={onClose}>
              ⏺ Re-record word
            </button>
          </div>

          {/* ─── Phoneme Breakdown ─── */}
          {phonemes.length > 0 && (
            <div className="px-5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--text-muted)' }}>Phoneme Breakdown</p>
              <div>
                {phonemes.map((ph, i) => {
                  if (ph.score < 80) warnMissingVideo(ph.phoneme);
                  return (
                    <div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--surface-muted)' }}>
                      {/* Symbol + correct play button */}
                      <span className="font-mono text-center flex items-center gap-0.5" style={{ fontSize: 15, fontWeight: 600, width: 44, color: ph.score >= 70 ? 'var(--green)' : 'var(--red)' }}>
                        {ph.phoneme}
                        <button onClick={() => handlePlayPhoneme(phonemeToSpeakable(ph.phoneme), `correct-${i}`)}
                          className="shrink-0"
                          style={{ fontSize: 10, color: 'var(--green)', border: 'none', background: 'none', cursor: 'pointer', padding: '0 1px', opacity: playingPhoneme === `correct-${i}` ? 1 : 0.6 }}>▶</button>
                      </span>
                      {/* Bar + you said */}
                      <div className="flex-1">
                        <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'var(--surface-muted)' }}>
                          <div className="rounded-full h-full"
                            style={{ width: `${ph.score}%`, background: ph.score >= 70 ? 'var(--green)' : 'var(--red)' }} />
                        </div>
                        {ph.userPhoneme && (
                          <div className="flex items-center gap-1 mt-1">
                            <span style={{ fontSize: 11, color: 'var(--text-placeholder)' }}>You said:</span>
                            <span className="font-mono" style={{ fontSize: 12, color: 'var(--red)' }}>{ph.userPhoneme}</span>
                            <button onClick={() => handlePlayPhoneme(phonemeToSpeakable(ph.userPhoneme!), `user-${i}`)}
                              style={{ fontSize: 10, color: 'var(--red)', border: 'none', background: 'none', cursor: 'pointer', opacity: playingPhoneme === `user-${i}` ? 1 : 0.6 }}>▶</button>
                          </div>
                        )}
                      </div>
                      {/* Score */}
                      <span style={{ fontSize: 11, fontWeight: 700, width: 32, textAlign: 'right', color: ph.score >= 70 ? 'var(--green)' : 'var(--red)' }}>
                        {ph.score}%
                      </span>
                      {/* Video icon — only for score < 80 with a known video */}
                      {ph.score < 80 && PHONEME_VIDEOS[ph.phoneme] && (
                        <button
                          onClick={() => setOpenPhonemeVideo(openPhonemeVideo === ph.phoneme ? null : ph.phoneme)}
                          title="Watch pronunciation video"
                          className="p-1.5 rounded-lg transition-all active:scale-90 shrink-0"
                          style={{
                            backgroundColor: openPhonemeVideo === ph.phoneme ? 'var(--surface-muted)' : 'var(--surface)',
                            color: openPhonemeVideo === ph.phoneme ? 'var(--rose)' : 'var(--text-muted)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          <VideoIcon size={13} />
                        </button>
                      )}
                      {/* Inline video */}
                      {openPhonemeVideo === ph.phoneme && PHONEME_VIDEOS[ph.phoneme] && (
                        <div className="mt-2 rounded-xl overflow-hidden" style={{ aspectRatio: '16/9', border: '1px solid var(--border)' }}>
                          <iframe
                            src={`https://www.youtube.com/embed/${PHONEME_VIDEOS[ph.phoneme]}?rel=0&modestbranding=1&autoplay=1&cc_load_policy=0&cc_lang_pref=en&hl=en`}
                            allow="autoplay; encrypted-media"
                            allowFullScreen
                            className="w-full h-full"
                            title={`How to pronounce /${ph.phoneme}/`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── Suggestion ─── */}
          {item.suggestion && (
            <div className="px-5 pb-4">
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4" style={{ color: 'var(--rose)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--rose)' }}>Tip</p>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>{item.suggestion}</p>
              </div>
            </div>
          )}

          {/* ─── IPA Comparison ─── */}
          {item.phoneticUser && item.phoneticUser !== item.phoneticCorrect && (
            <div className="px-5 pb-4">
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-3 text-center" style={{ color: 'var(--text-muted)' }}>Compare Sounds</p>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => handlePlayPhoneme(
                      `${item.word}`,
                      'fallback-correct'
                    )}
                    className="flex flex-col items-center gap-1.5 group transition-all active:scale-95"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Correct</span>
                    <span className="font-mono font-semibold px-5 py-2.5 rounded-xl inline-flex items-center gap-2 transition-all"
                      style={{ fontSize: 22, backgroundColor: 'var(--surface-muted)', color: 'var(--green)', border: '1px solid var(--border)' }}>
                      /{diffPhonetics(item.phoneticUser!, item.phoneticCorrect!, 'var(--green-bg)')}/
                    </span>
                  </button>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>vs</span>
                  </div>
                  <button
                    onClick={() => {
                      const prompt = buildMispronunciation(item);
                      handlePlayPhoneme(prompt, 'fallback-user');
                    }}
                    className="flex flex-col items-center gap-1.5 group transition-all active:scale-95"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>You said</span>
                    <span className="font-mono font-semibold px-5 py-2.5 rounded-xl inline-flex items-center gap-2 transition-all"
                      style={{ fontSize: 22, backgroundColor: 'var(--surface-muted)', color: 'var(--red)', border: '1px solid var(--border)' }}>
                      /{diffPhonetics(item.phoneticCorrect!, item.phoneticUser!, 'var(--red-bg)')}/
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bottom padding */}
          <div className="h-5"></div>
        </div>
      </div>
      </div>
    </div>
  );
};
