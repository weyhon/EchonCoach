
import React, { useState } from 'react';
import { AnalysisResult, WordAnalysis } from '../types';

interface FeedbackCardProps {
  result: AnalysisResult;
  isUpdating?: boolean;
  onPlayNormal: () => void;
  onPlaySlow: () => void;
  activeAudioSource: string | null;
  onPlayWord: (word: string) => void;
  onPlayTutor: (selectedText: string) => void;
  playingWord: string | null;
  onPlayUserRecording: () => void;
}

const ScoreRing: React.FC<{ score: number }> = ({ score = 0 }) => {
  const safeScore = Math.max(0, Math.min(100, score));
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;
  const colorClass = safeScore >= 80 ? 'text-emerald-500' : safeScore >= 60 ? 'text-indigo-500' : 'text-orange-500';
  
  return (
    <div className="relative flex items-center justify-center w-16 h-16 shrink-0">
      <svg className="transform -rotate-90 w-16 h-16">
        <circle cx="32" cy="32" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100" />
        <circle
          cx="32" cy="32" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
          className={`${colorClass} transition-all duration-700`}
        />
      </svg>
      <span className={`absolute text-sm font-black ${colorClass}`}>{safeScore > 0 ? safeScore : "--"}</span>
    </div>
  );
};

const SymbolSpan: React.FC<{ token: string }> = ({ token }) => {
  if (!token) return null;
  const chars = Array.from(token);
  
  return (
    <div className="flex gap-2 items-center justify-center pt-3">
      {chars.map((char, i) => {
        switch (char) {
          case '●': return <span key={i} className="text-indigo-400 font-black text-[18px] drop-shadow-[0_0_5px_rgba(129,140,248,0.8)]">●</span>;
          case '·': return <span key={i} className="text-slate-500 font-bold text-[14px] opacity-30">·</span>;
          case '↗': return (
            <span key={i} className="text-orange-500 font-black text-[38px] leading-[0.5] drop-shadow-[0_0_20px_rgba(249,115,22,0.9)] animate-symbol-pop">
              ↗
            </span>
          );
          case '↘': return (
            <span key={i} className="text-sky-500 font-black text-[38px] leading-[0.5] drop-shadow-[0_0_20px_rgba(14,165,233,0.9)] animate-symbol-pop">
              ↘
            </span>
          );
          default: return null;
        }
      })}
    </div>
  );
};

export const FeedbackCard: React.FC<FeedbackCardProps> = ({ 
  result, isUpdating, onPlayNormal, onPlaySlow, activeAudioSource, onPlayWord, onPlayTutor, playingWord, onPlayUserRecording 
}) => {
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const isPlayingNormal = activeAudioSource === 'input_normal';
  const isPlayingSlow = activeAudioSource === 'input_slow';
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

  const words = (result.fullLinkedSentence || result.speechScript || "").trim().split(/\s+/);
  const mapTokens = (result.intonationMap || "").trim().split(/\s+/);

  return (
    <div className={`bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-6 md:p-8 space-y-8 animate-fade-in-up relative transition-all duration-500 ${isUpdating ? 'opacity-50 scale-[0.97] blur-[1px]' : 'opacity-100 scale-100'}`}>
      <style>{`
        @keyframes symbol-pop {
          0%, 100% { transform: translateY(0) scale(1); filter: brightness(1.1); }
          50% { transform: translateY(-3px) scale(1.1); filter: brightness(1.3); }
        }
        .animate-symbol-pop { animation: symbol-pop 2s infinite ease-in-out; }
      `}</style>

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row gap-6 items-center">
        <div className="flex items-center gap-6 flex-1 w-full">
           <ScoreRing score={result.score} />
           <div className="flex-1 bg-slate-50 p-5 rounded-[1.5rem] border border-slate-100 relative min-h-[64px] flex items-center shadow-inner">
             <div className="absolute -top-3 left-6 bg-indigo-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase shadow-lg ring-4 ring-white">Expert Advice</div>
             <p className="text-slate-600 text-[13px] leading-relaxed font-bold italic">
               {result.overallComment || "正在生成你的发音报告..."}
             </p>
           </div>
        </div>
        <div className="flex flex-row sm:flex-col gap-3 shrink-0 items-center sm:items-end w-full sm:w-auto justify-between sm:justify-center">
           <button onClick={onPlayUserRecording} className="text-[11px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-all hover:scale-105">Replay Mine</button>
           <div className="flex gap-2">
             <button onClick={onPlaySlow} className={`text-[11px] font-black px-4 py-2 rounded-xl border transition-all uppercase tracking-tighter shadow-sm ${isPlayingSlow ? 'bg-orange-500 text-white border-orange-500 scale-105' : 'text-orange-500 border-orange-100 hover:bg-orange-50'}`}>Slow</button>
             <button onClick={onPlayNormal} className={`text-[11px] font-black px-4 py-2 rounded-xl border transition-all uppercase tracking-tighter shadow-sm ${isPlayingNormal ? 'bg-emerald-500 text-white border-emerald-500 scale-105' : 'text-emerald-500 border-emerald-100 hover:bg-emerald-50'}`}>Normal</button>
           </div>
        </div>
      </div>

      {/* Analysis Display */}
      <div 
        className="analysis-box bg-slate-900 rounded-[3rem] p-10 md:p-14 shadow-2xl relative border-8 border-slate-800/50 min-h-[380px] overflow-hidden group" 
        onMouseUp={handleMouseUp}
      >
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none transition-opacity duration-1000 group-hover:opacity-20"></div>
          
          <div className="flex flex-col items-center w-full z-10 pb-28">
            {/* Phonics at top */}
            {result.fullLinkedPhonetic && (
              <div className="mb-14 px-8 py-3 bg-white/5 rounded-full border border-white/10 backdrop-blur-xl shadow-2xl">
                <p className="text-[13px] md:text-[16px] font-bold text-slate-400 tracking-[0.6em] font-mono select-none pointer-events-none text-center">
                  /{result.fullLinkedPhonetic}/
                </p>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-x-12 md:gap-x-16 gap-y-24 select-text w-full">
              {words.map((word, i) => (
                <div key={i} className="flex flex-col items-center min-w-fit group/word transition-transform duration-300 hover:scale-110">
                  <span className="text-white text-4xl md:text-6xl font-black leading-none mb-4 break-words text-center tracking-tighter transition-all group-hover/word:text-indigo-300 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative">
                    {word.split('‿').map((part, idx, arr) => (
                      <React.Fragment key={idx}>
                        {part}
                        {idx < arr.length - 1 && (
                          <span className="text-indigo-400 font-black mx-1 opacity-80 animate-pulse">‿</span>
                        )}
                      </React.Fragment>
                    ))}
                  </span>
                  
                  {/* Symbols exactly under the word/phrase */}
                  <div className="h-12 flex items-center justify-center select-none pointer-events-none">
                    <SymbolSpan token={mapTokens[i] || (i === words.length - 1 ? (words[0].toLowerCase().match(/^(do|does|did|is|are|am|can|could|will|would|have|has|had|isnt|cant|couldnt)/) ? '·↗' : '●↘') : '·')} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tutorial UI for selections */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full flex justify-center pointer-events-none px-10 z-20">
             {selectedText ? (
               <button 
                 onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onPlayTutor(selectedText); }}
                 className={`pointer-events-auto bg-indigo-600/95 backdrop-blur-2xl text-white px-12 h-16 rounded-full text-[13px] font-black uppercase tracking-[0.2em] shadow-[0_25px_70px_rgba(79,70,229,0.8)] flex items-center gap-4 hover:bg-indigo-500 border-2 border-white/40 active:scale-95 transition-all animate-bounce-in`}
               >
                 {isTutorLoading ? (
                   <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                 ) : (
                   <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                 )}
                 {isTutorLoading ? "Cooking Audio..." : isPlayingTutor ? "Playing Coach..." : `Pronounce: "${selectedText.length > 20 ? selectedText.slice(0, 20) + '...' : selectedText}"`}
               </button>
             ) : (
               <div className="flex flex-col items-center gap-3 opacity-20 transition-opacity hover:opacity-40">
                 <p className="text-[11px] font-black text-white uppercase tracking-[0.6em] select-none text-center">Drag-select words to hear specific coaching</p>
                 <div className="w-32 h-1 bg-gradient-to-r from-transparent via-white/60 to-transparent rounded-full"></div>
               </div>
             )}
          </div>
      </div>

      {/* Analysis Details */}
      {result.wordBreakdown?.length > 0 && (
        <div className="pt-6 space-y-8">
          <div className="flex items-center gap-6">
             <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-200"></div>
             <h4 className="font-black text-slate-300 text-[12px] uppercase tracking-[0.5em]">Evaluated Words</h4>
             <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-200"></div>
          </div>
          <div className="flex flex-wrap gap-5 justify-center">
            {result.wordBreakdown.map((item, idx) => (
              <WordSmallItem key={idx} item={item} onPlay={() => onPlayWord(item.word)} isPlaying={playingWord === item.word} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const WordSmallItem: React.FC<{ item: WordAnalysis; onPlay: () => void; isPlaying: boolean; }> = ({ item, onPlay, isPlaying }) => {
  const colors = {
    correct: "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 hover:border-emerald-200 shadow-emerald-50",
    incorrect: "bg-red-50 text-red-700 border-red-100 hover:bg-red-100 hover:border-red-200 shadow-red-50",
    needs_improvement: "bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100 hover:border-orange-200 shadow-orange-50"
  };
  const colorClass = (colors as any)[item.status] || colors.needs_improvement;
  return (
    <button onClick={onPlay} className={`flex flex-col items-center px-6 py-4 rounded-[1.75rem] border-2 transition-all active:scale-95 shadow-lg ${colorClass} ${isPlaying ? 'ring-4 ring-indigo-500/30 shadow-2xl scale-110' : ''}`}>
      <span className="text-[17px] font-black tracking-tighter">{item.word}</span>
      <span className="text-[12px] opacity-75 mt-1 font-mono font-bold">/{item.phoneticCorrect}/</span>
    </button>
  );
};
