
import React, { useState } from 'react';
import { AnalysisResult, WordAnalysis } from '../types';
import { isYesNoQuestion } from '../services/linkingUtils';
import { generateIntonationTokens } from '../services/intonationUtils';
import { IPALegend } from './IPALegend';
import { SnailIcon, SpeakerIcon } from './Icons';

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

interface SymbolSpanProps {
  token?: string;
  isLast?: boolean;
  firstWord?: string;
  fullText?: string;
}

const SymbolSpan: React.FC<SymbolSpanProps> = ({ token, isLast, firstWord, fullText }) => {
  // 确定显示什么符号
  let stressSymbol: string | null = null;
  let toneSymbol: string | null = null;

  if (token && token.trim()) {
    // 更宽松的解析：检查字符是否存在
    const t = token.trim();
    if (t.includes('●')) stressSymbol = '●';
    else if (t.includes('·')) stressSymbol = '·';

    if (t.includes('↗')) toneSymbol = '↗';
    else if (t.includes('↘')) toneSymbol = '↘';
  }

  // 如果没有提供符号，使用默认值
  if (!stressSymbol && !toneSymbol) {
    if (isLast) {
      // 最后一个词：使用专业的语调判断逻辑
      // Wh-questions (What, Where, etc.) use falling intonation ↘
      // Yes/No questions (Do you, Are you, etc.) use rising intonation ↗
      // Statements use falling intonation ↘
      const sentenceIntonation = fullText ? getSentenceIntonation(fullText) : '↘';
      const isYesNo = firstWord ? isYesNoQuestion(fullText || firstWord) : false;

      stressSymbol = isYesNo ? '·' : '●';
      toneSymbol = sentenceIntonation;
    } else {
      // 非最后一个词：默认弱读
      stressSymbol = '·';
    }
  }

  return (
    <div className="flex flex-col items-center justify-start gap-0">
      {/* 语调符号 - 精致小巧 */}
      {toneSymbol && (
        <span className={`font-black text-[20px] leading-none drop-shadow-lg animate-symbol-pop ${
          toneSymbol === '↗' ? 'text-orange-400 drop-shadow-[0_0_12px_rgba(251,146,60,0.8)]' : 'text-sky-400 drop-shadow-[0_0_12px_rgba(56,189,248,0.8)]'
        }`}>
          {toneSymbol}
        </span>
      )}
      {/* 重读符号 */}
      {stressSymbol && (
        <span className={`font-black text-[10px] ${
          stressSymbol === '●' ? 'text-indigo-400 drop-shadow-[0_0_6px_rgba(129,140,248,0.8)]' : 'text-slate-500 opacity-40'
        }`}>
          {stressSymbol}
        </span>
      )}
    </div>
  );
};

export const FeedbackCard: React.FC<FeedbackCardProps> = ({
  result, isUpdating, onPlayNormal, onPlaySlow, activeAudioSource, onPlayWord, onPlayTutor, playingWord, onPlayUserRecording
}) => {
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [showIPALegend, setShowIPALegend] = useState<boolean>(false);
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
  const sentenceText = result.fullLinkedSentence || result.speechScript || "";

  const rawTokens = (result.intonationMap || "").trim().split(/\s+/).filter(Boolean);
  console.log("🎯 FeedbackCard token matching:", {
    words: words.length,
    rawTokens: rawTokens.length,
    usingFallback: rawTokens.length !== words.length,
    result: result.intonationMap
  });

  // Use centralized intonation generation for fallback
  const mapTokens = rawTokens.length === words.length
    ? rawTokens
    : generateIntonationTokens(sentenceText, words);

  return (
    <div className={`bg-gradient-to-br from-white to-purple-50/30 rounded-[32px] shadow-xl border-2 border-purple-100/50 p-10 md:p-12 space-y-8 animate-fade-in-up relative transition-all duration-500 ${isUpdating ? 'opacity-50 scale-[0.97] blur-[1px]' : 'opacity-100 scale-100'}`}>
      <style>{`
        @keyframes symbol-pop {
          0%, 100% { transform: translateY(0) scale(1); filter: brightness(1.1); }
          50% { transform: translateY(-3px) scale(1.1); filter: brightness(1.3); }
        }
        .animate-symbol-pop { animation: symbol-pop 2s infinite ease-in-out; }
      `}</style>

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        {result.overallComment && result.score > 0 && (
          <div className="flex items-center gap-5 flex-1 w-full">
            <ScoreRing score={result.score} />
            <div className="flex-1 bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-6 rounded-[20px] border-[1.5px] border-emerald-300/60 relative min-h-[70px] flex flex-col gap-3 shadow-sm">
              <div className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.15em]">✨ Expert Advice</div>
              <p className="text-emerald-800 text-[14px] leading-relaxed font-semibold">
                {result.overallComment}
              </p>
            </div>
          </div>
        )}
        <div className="flex flex-row sm:flex-col gap-3 shrink-0 items-center sm:items-end w-full sm:w-auto justify-between sm:justify-center">
           <button onClick={onPlayUserRecording} className="text-[11px] font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-wider transition-all hover:scale-105">Replay Mine</button>
           <div className="flex gap-2.5 bg-gradient-to-br from-slate-100 to-slate-50 p-2.5 rounded-[12px] border border-slate-200">
             <button
               onClick={onPlaySlow}
               className={`px-5 py-2 rounded-[10px] transition-all flex items-center gap-2 ${
                 isPlayingSlow
                   ? 'bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 shadow-md border-[1.5px] border-amber-400'
                   : 'text-slate-500 hover:text-amber-600 hover:bg-amber-50/50'
               }`}
             >
               <SnailIcon size={18} />
             </button>
             <button
               onClick={onPlayNormal}
               className={`px-5 py-2 rounded-[10px] transition-all flex items-center gap-2 ${
                 isPlayingNormal
                   ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 shadow-md border-[1.5px] border-emerald-400'
                   : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50/50'
               }`}
             >
               <SpeakerIcon size={18} />
             </button>
           </div>
        </div>
      </div>

      {/* Analysis Display */}
      <div
        className="analysis-box bg-gradient-to-br from-slate-900 to-slate-800 rounded-[24px] p-7 md:p-8 shadow-2xl relative border border-slate-700 min-h-[220px] overflow-hidden group"
        onMouseUp={handleMouseUp}
      >
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none transition-opacity duration-1000 group-hover:opacity-40"></div>

          <div className="flex flex-col items-center w-full z-10 pb-12">
            {/* Phonics at top */}
            {result.fullLinkedPhonetic && (
              <div className="mb-4 flex flex-col items-center gap-2">
                <div className="px-5 py-2 bg-white/5 rounded-full border border-white/10 backdrop-blur-xl shadow-lg">
                  <p className="text-[12px] md:text-[14px] font-medium text-slate-400 tracking-[0.08em] font-mono select-none pointer-events-none text-center leading-relaxed">
                    /{result.fullLinkedPhonetic.split('ˈ').map((part, i) =>
                      i === 0
                        ? <React.Fragment key={i}>{part}</React.Fragment>
                        : <React.Fragment key={i}><span className="text-indigo-300 font-bold">ˈ</span>{part}</React.Fragment>
                    )}/
                  </p>
                </div>
                <button
                  onClick={() => setShowIPALegend(true)}
                  className="text-[9px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-wider transition-colors flex items-center gap-1 pointer-events-auto"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  查看音标说明
                </button>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-x-2 md:gap-x-3 gap-y-2 w-full">
              {words.map((word, i) => {
                // Clean word for pronunciation (remove punctuation and linking symbols)
                const cleanWord = word.replace(/[‿?.!,;]/g, '').trim();
                const isPlaying = playingWord === cleanWord || (isPlayingTutor && selectedText === cleanWord);

                return (
                  <div
                    key={i}
                    className="flex flex-col items-center min-w-fit group/word transition-all duration-200"
                  >
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (cleanWord) {
                          onPlayTutor(cleanWord);
                        }
                      }}
                      className={`text-white text-lg md:text-xl font-black leading-none mb-1 break-words text-center tracking-tight transition-all drop-shadow-[0_3px_10px_rgba(0,0,0,0.4)] relative cursor-pointer
                        ${isPlaying
                          ? 'text-emerald-400 scale-110 animate-pulse'
                          : 'hover:text-indigo-300 hover:scale-110 active:scale-95'
                        }`}
                      title={`Click to hear: "${cleanWord}"`}
                    >
                      {word.split('‿').map((part, idx, arr) => (
                        <React.Fragment key={idx}>
                          {part}
                          {idx < arr.length - 1 && (
                            <span className="text-indigo-400 font-black mx-1 opacity-80 animate-pulse pointer-events-none">‿</span>
                          )}
                        </React.Fragment>
                      ))}
                    </button>

                    {/* Symbols exactly under the word/phrase */}
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

          {/* Tutorial UI for selections */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full flex justify-center pointer-events-none px-10 z-20">
             {selectedText ? (
               <button
                 onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onPlayTutor(selectedText); }}
                 className={`pointer-events-auto bg-indigo-600/95 backdrop-blur-xl text-white px-4 h-8 rounded-full text-[9px] font-bold uppercase tracking-[0.1em] shadow-[0_4px_16px_rgba(79,70,229,0.4)] flex items-center gap-1.5 hover:bg-indigo-500 border border-white/30 active:scale-95 transition-all`}
               >
                 {isTutorLoading ? (
                   <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                 ) : (
                   <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                 )}
                 {isTutorLoading ? "Loading..." : isPlayingTutor ? "Playing..." : `"${selectedText.length > 15 ? selectedText.slice(0, 15) + '...' : selectedText}"`}
               </button>
             ) : (
               <div className="flex flex-col items-center gap-1.5 opacity-20 transition-opacity hover:opacity-40">
                 <p className="text-[9px] font-black text-white uppercase tracking-[0.4em] select-none text-center">Click word to hear</p>
                 <p className="text-[8px] font-bold text-white/50 tracking-[0.2em] select-none text-center">Or drag for phrases</p>
                 <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-white/50 to-transparent rounded-full"></div>
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

      {/* IPA Legend Modal */}
      <IPALegend show={showIPALegend} onClose={() => setShowIPALegend(false)} />
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
