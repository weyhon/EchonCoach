import React, { useState } from 'react';
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

const statusConfig: Record<string, { color: string; bg: string; label: string; ring: string }> = {
  correct: { color: 'var(--green)', bg: 'rgba(74,222,128,0.1)', label: 'Correct', ring: 'rgba(74,222,128,0.3)' },
  needs_improvement: { color: 'var(--amber)', bg: 'rgba(251,191,36,0.1)', label: 'Needs Work', ring: 'rgba(251,191,36,0.3)' },
  incorrect: { color: 'var(--red)', bg: 'rgba(248,113,113,0.1)', label: 'Incorrect', ring: 'rgba(248,113,113,0.3)' },
};

const SpeakerSmallIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" className="shrink-0">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5.586V18.414a1 1 0 01-1.707.707L5.586 15z" />
  </svg>
);

const VideoIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" className="shrink-0">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
  </svg>
);

const ScoreRing: React.FC<{ score: number; color: string; glowColor: string }> = ({ score, color, glowColor }) => {
  const size = 96;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center score-glow" style={{ width: size, height: size }}>
      {/* Glow background */}
      <div className="absolute inset-[-8px] rounded-full" style={{ background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)` }}></div>
      <svg className="transform -rotate-90 relative" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--border-subtle)" strokeWidth="6" fill="transparent" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth="6" fill="transparent"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <span className="absolute text-2xl font-bold font-brand" style={{ color }}>{score}<span className="text-sm opacity-60">%</span></span>
    </div>
  );
};

export const WordDetailModal: React.FC<WordDetailModalProps> = ({
  item, allWords, onSelectWord, onClose, onPlayCoach, onPlayUser, onPlayPhoneme, isCoachPlaying, hasUserRecording
}) => {
  const config = statusConfig[item.status] || statusConfig.needs_improvement;
  const wordScore = item.wordScore ?? (item.status === 'correct' ? 95 : item.status === 'needs_improvement' ? 56 : 20);
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

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div
        className="glass rounded-2xl w-full max-w-md overflow-hidden animate-scale-in max-h-[85vh] flex flex-col"
        style={{ boxShadow: '0 8px 48px rgba(0,0,0,0.12), 0 0 0 1px var(--border-subtle)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Horizontal word pills (like ELSA) ─── */}
        {allWords && allWords.length > 1 && (
          <div className="word-pills-scroll flex gap-1.5 px-4 pt-4 pb-2 overflow-x-auto">
            {allWords.map((w, i) => {
              const wConfig = statusConfig[w.status] || statusConfig.needs_improvement;
              const isActive = w.word === item.word;
              return (
                <button
                  key={i}
                  onClick={() => onSelectWord?.(w)}
                  className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all active:scale-95"
                  style={{
                    backgroundColor: isActive ? wConfig.bg : 'var(--bg-elevated)',
                    border: isActive ? `1.5px solid ${wConfig.color}` : '1.5px solid var(--border-subtle)',
                    color: isActive ? wConfig.color : 'var(--text-secondary)',
                  }}
                >
                  {w.word}
                </button>
              );
            })}
          </div>
        )}

        {/* ─── Scrollable content ─── */}
        <div className="overflow-y-auto flex-1">
          {/* Close button */}
          <div className="flex justify-end px-4 pt-3 pb-0">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover-lift"
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ─── Score Ring + Word (with nebula glow) ─── */}
          <div className="flex flex-col items-center px-6 pb-5 relative">
            {/* Atmospheric glow behind score */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${config.ring} 0%, transparent 70%)`, opacity: 0.4 }}></div>

            <ScoreRing score={wordScore} color={config.color} glowColor={config.ring} />

            <h2 className="text-4xl font-bold mt-4 font-brand tracking-tight" style={{ color: config.color }}>{item.word}</h2>

            {/* Clickable IPA pill */}
            <button
              onClick={() => handlePlayPhoneme(`Pronounce the sound: /${item.phoneticCorrect}/`, 'ipa-correct')}
              className="flex items-center gap-1.5 mt-2.5 px-4 py-1.5 rounded-full transition-all active:scale-95 hover-lift"
              style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              <SpeakerSmallIcon size={13} />
              <span className="font-mono text-sm font-medium">/{item.phoneticCorrect}/</span>
              {item.status !== 'correct' && (
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: config.bg, color: config.color }}>!</span>
              )}
            </button>

            <span className="text-[10px] font-semibold uppercase tracking-widest mt-2 px-3 py-0.5 rounded-full" style={{ backgroundColor: config.bg, color: config.color }}>{config.label}</span>
          </div>

          {/* ─── Playback Buttons ─── */}
          <div className="flex items-center justify-center gap-3 px-6 py-3">
            <button
              onClick={() => onPlayCoach(item.word)}
              className="flex items-center gap-2 px-6 py-3 rounded-full text-[12px] font-semibold transition-all active:scale-95 hover-lift"
              style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5.586V18.414a1 1 0 01-1.707.707L5.586 15z" />
              </svg>
              {isCoachPlaying ? 'Playing...' : 'Coach'}
            </button>
            {hasUserRecording && (
              <button
                onClick={onPlayUser}
                className="flex items-center gap-2 px-6 py-3 rounded-full text-[12px] font-semibold transition-all active:scale-95 hover-lift"
                style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                You
              </button>
            )}
          </div>

          {/* ─── Phoneme Breakdown ─── */}
          {phonemes.length > 0 && (
            <div className="px-5 pb-4 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest px-1" style={{ color: 'var(--text-muted)' }}>Phoneme Breakdown</p>
              <div className="space-y-1.5">
                {phonemes.map((p, i) => {
                  const pColor = p.score >= 80 ? 'var(--green)' : p.score >= 50 ? 'var(--amber)' : 'var(--red)';
                  const pBg = p.score >= 80 ? 'rgba(74,222,128,0.1)' : p.score >= 50 ? 'rgba(251,191,36,0.1)' : 'rgba(248,113,113,0.1)';
                  const isCorrectPlaying = playingPhoneme === `correct-${i}`;
                  const isUserPlaying = playingPhoneme === `user-${i}`;
                  if (p.score < 80) warnMissingVideo(p.phoneme);
                  return (
                    <div key={i} className="rounded-xl px-3 py-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-center gap-3">
                        {/* Correct phoneme — clickable */}
                        <button
                          onClick={() => handlePlayPhoneme(`Pronounce the English phoneme sound: /${p.phoneme}/`, `correct-${i}`)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all active:scale-90 hover-lift shrink-0"
                          style={{ backgroundColor: isCorrectPlaying ? 'var(--pink-dim)' : 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                          title={`Hear correct: /${p.phoneme}/`}
                        >
                          <span className="font-mono text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{p.phoneme}</span>
                          <SpeakerSmallIcon size={12} />
                        </button>

                        {/* Score bar */}
                        <div className="flex-1 min-w-0">
                          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p.score}%`, backgroundColor: pColor }}></div>
                          </div>
                        </div>

                        {/* Score badge */}
                        <span className="text-[12px] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ backgroundColor: pBg, color: pColor }}>{p.score}%</span>

                        {/* Video icon — only for score < 80 with a known video */}
                        {p.score < 80 && PHONEME_VIDEOS[p.phoneme] && (
                          <button
                            onClick={() => setOpenPhonemeVideo(
                              openPhonemeVideo === p.phoneme ? null : p.phoneme
                            )}
                            title="Watch pronunciation video"
                            className="p-1.5 rounded-lg transition-all active:scale-90 hover-lift shrink-0"
                            style={{
                              backgroundColor: openPhonemeVideo === p.phoneme ? 'var(--pink-dim)' : 'var(--bg-card)',
                              color: openPhonemeVideo === p.phoneme ? 'var(--pink)' : 'var(--text-muted)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <VideoIcon size={13} />
                          </button>
                        )}
                      </div>

                      {/* User phoneme row (if different) */}
                      {p.userPhoneme && (
                        <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <span className="text-[10px] font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>You said</span>
                          <button
                            onClick={() => handlePlayPhoneme(`Pronounce the English phoneme sound: /${p.userPhoneme}/`, `user-${i}`)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all active:scale-90 hover-lift shrink-0"
                            style={{ backgroundColor: isUserPlaying ? 'rgba(248,113,113,0.2)' : 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)' }}
                            title={`Hear your sound: /${p.userPhoneme}/`}
                          >
                            <span className="font-mono text-lg font-bold" style={{ color: 'var(--red)' }}>{p.userPhoneme}</span>
                            <SpeakerSmallIcon size={12} />
                          </button>
                          <svg className="w-4 h-4 shrink-0 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          <span className="font-mono text-sm font-medium" style={{ color: pColor }}>/{p.phoneme}/</span>
                        </div>
                      )}

                      {/* Inline video — expands when video icon is clicked */}
                      {openPhonemeVideo === p.phoneme && PHONEME_VIDEOS[p.phoneme] && (
                        <div className="mt-2 rounded-xl overflow-hidden" style={{ aspectRatio: '16/9', border: '1px solid var(--border-subtle)' }}>
                          <iframe
                            src={`https://www.youtube.com/embed/${PHONEME_VIDEOS[p.phoneme]}?rel=0&modestbranding=1&autoplay=1`}
                            allow="autoplay; encrypted-media"
                            allowFullScreen
                            className="w-full h-full"
                            title={`How to pronounce /${p.phoneme}/`}
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
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--pink-dim)', border: '1px solid rgba(232,88,122,0.2)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4" style={{ color: 'var(--pink)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--pink)' }}>Tip</p>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>{item.suggestion}</p>
              </div>
            </div>
          )}

          {/* ─── IPA Comparison: always show when user said something different ─── */}
          {item.phoneticUser && item.phoneticUser !== item.phoneticCorrect && (
            <div className="px-5 pb-4">
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-3 text-center" style={{ color: 'var(--text-muted)' }}>Compare Sounds</p>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => handlePlayPhoneme(`Pronounce clearly: /${item.phoneticCorrect}/`, 'fallback-correct')}
                    className="flex flex-col items-center gap-1.5 group transition-all active:scale-95"
                  >
                    <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Correct</span>
                    <span className="font-mono text-lg font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-2 transition-all group-hover:brightness-125 hover-lift" style={{ backgroundColor: 'rgba(74,222,128,0.1)', color: 'var(--green)', border: '1px solid rgba(74,222,128,0.2)' }}>
                      /{item.phoneticCorrect}/
                      <SpeakerSmallIcon size={14} />
                    </span>
                  </button>
                  <div className="flex flex-col items-center gap-1">
                    <svg className="w-5 h-5" style={{ color: 'var(--text-muted)', opacity: 0.4 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12M8 12h12M8 17h12" />
                    </svg>
                    <span className="text-[8px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>vs</span>
                  </div>
                  <button
                    onClick={() => handlePlayPhoneme(`Pronounce clearly: /${item.phoneticUser}/`, 'fallback-user')}
                    className="flex flex-col items-center gap-1.5 group transition-all active:scale-95"
                  >
                    <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>You said</span>
                    <span className="font-mono text-lg font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-2 transition-all group-hover:brightness-125 hover-lift" style={{ backgroundColor: 'rgba(248,113,113,0.1)', color: 'var(--red)', border: '1px solid rgba(248,113,113,0.2)' }}>
                      /{item.phoneticUser}/
                      <SpeakerSmallIcon size={14} />
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
  );
};
