
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './components/Button';
import { FeedbackCard } from './components/FeedbackCard';
import { HistoryList } from './components/HistoryList';
import { generateSpeech, analyzePronunciation, getLinkingAnalysisForText, generateTutorAudio } from './services/geminiService';
import { playBase64Audio, speakWithWebSpeech } from './services/audioUtils';
import { shouldLink, isFunctionWord } from './services/linkingUtils';
import { AnalysisResult, AppState, HistoryItem } from './types';

const ttsCache = new Map<string, string>();
const analysisCache = new Map<string, AnalysisResult>();

const App: React.FC = () => {
  const [text, setText] = useState<string>('How is it going?');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeAudioSource, setActiveAudioSource] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [userAudioBlob, setUserAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showError = (message: string) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  };

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('echocoach_history_v3');
      if (saved) {
        const parsed: HistoryItem[] = JSON.parse(saved);
        parsed.forEach(h => {
          if (h.result) analysisCache.set(h.text, h.result);
          if (h.ttsAudio) ttsCache.set(`${h.text}_normal`, h.ttsAudio);
        });
        return parsed;
      }
    } catch (e) { console.error("History load error", e); }
    return [];
  });

  const saveToHistory = (newText: string, res: AnalysisResult) => {
    setHistory(prev => {
      // Remove old entries for the same text to keep it fresh
      const filtered = prev.filter(h => h.text.trim().toLowerCase() !== newText.trim().toLowerCase());
      const newItem: HistoryItem = { 
        id: Date.now().toString(), 
        text: newText, 
        score: res.score, 
        timestamp: Date.now(), 
        result: res, 
        ttsAudio: ttsCache.get(`${newText}_normal`) 
      };
      const updated = [newItem, ...filtered].slice(0, 50);
      localStorage.setItem('echocoach_history_v3', JSON.stringify(updated));
      return updated;
    });
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const ensureAudioContext = async (): Promise<AudioContext> => {
    let ctx = audioContext;
    if (!ctx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      ctx = new Ctx();
      setAudioContext(ctx);
    }
    if (ctx.state === 'suspended') await ctx.resume();
    return ctx;
  };

  const playAudio = async (base64Audio: string, sourceKey: string) => {
    try {
      console.log("playAudio called, sourceKey:", sourceKey, "audio length:", base64Audio?.length);

      // Prevent overlapping audio playback
      if (activeAudioSource && activeAudioSource !== 'tutor_loading') {
        console.log("⚠️ Audio already playing, ignoring new playback request");
        return;
      }

      if (!base64Audio || base64Audio.length < 100) {
        console.error("Audio data too short or empty:", base64Audio);
        showError("音频数据无效，请重试");
        return;
      }
      setActiveAudioSource(sourceKey);
      await playBase64Audio(base64Audio, 'audio/mpeg');
      setActiveAudioSource(null);
    } catch (e) {
      console.error("Audio playback error:", e);
      showError("音频播放失败: " + (e as Error).message);
      setActiveAudioSource(null);
    }
  };

  const handlePlayTutor = async (selectedText: string) => {
    if (!selectedText.trim()) return;

    // Prevent overlapping playback - early check
    if (activeAudioSource && activeAudioSource !== 'tutor_loading') {
      console.log("⚠️ Playback in progress, ignoring tutor request");
      return;
    }

    const cacheKey = `tutor_${selectedText}`;
    const cached = ttsCache.get(cacheKey);
    if (cached && cached.length > 100) {
      await playAudio(cached, 'tutor');
      return;
    }
    ttsCache.delete(cacheKey);
    setActiveAudioSource('tutor_loading'); 
    try {
      const base64 = await generateTutorAudio(selectedText);
      ttsCache.set(cacheKey, base64);
      await playAudio(base64, 'tutor');
    } catch (e) { 
      console.error("Tutor playback error", e);
      setActiveAudioSource(null); 
    }
  };

  const handlePlayTTS = async (textToSpeak: string, isSlow: boolean = false) => {
    if (!textToSpeak.trim()) return;

    // Prevent overlapping playback - early check
    if (activeAudioSource && activeAudioSource !== 'tutor_loading') {
      console.log("⚠️ Playback in progress, ignoring TTS request");
      return;
    }

    const cacheKey = `${textToSpeak}_${isSlow ? 'slow' : 'normal'}`;
    const sourceKey = isSlow ? 'input_slow' : 'input_normal';
    const cached = ttsCache.get(cacheKey);
    if (cached && cached.length > 100) {
      await playAudio(cached, sourceKey);
      return;
    }
    ttsCache.delete(cacheKey);
    setAppState(AppState.GENERATING_TTS);
    setActiveAudioSource(sourceKey);
    try {
      const base64 = await generateSpeech(textToSpeak, isSlow);
      ttsCache.set(cacheKey, base64);
      await playAudio(base64, sourceKey);
    } catch (e: any) { 
      console.error("TTS playback error", e);
      if (e?.code === 'RATE_LIMIT') {
        showError("今日 MiniMax 额度已用完，请更换密钥或稍后重试");
      } else if (e?.code === 'INSUFFICIENT_BALANCE') {
        // 静默切换到本地朗读，不再弹出提示
        try { await speakWithWebSpeech(textToSpeak, isSlow ? 0.8 : 1); } catch (_) {}
      } else if (e?.code === 'NO_AUDIO') {
        showError("MiniMax 未返回音频，请稍后重试");
      } else if (typeof e?.message === 'string') {
        showError(e.message);
      } else {
        showError("语音合成失败，请稍后重试");
      }
      setActiveAudioSource(null); 
    }
    finally { setAppState(AppState.IDLE); }
  };

  const playAndAnalyze = async (textToSpeak: string) => {
    if (!textToSpeak.trim()) return;
    
    // Check cache first for instant feedback
    const cachedAnalysis = analysisCache.get(textToSpeak);
    if (cachedAnalysis) {
      setResult(cachedAnalysis);
      setAppState(AppState.SHOWING_RESULT);
      await handlePlayTTS(textToSpeak, false);
      return;
    }

    setIsAudioLoading(true);
    setAppState(AppState.GENERATING_TTS);
    
    try {
      // 分开请求，链接分析失败时用本地兜底
      const [ttsResult, linkingResult] = await Promise.allSettled([
        generateSpeech(textToSpeak, false),
        getLinkingAnalysisForText(textToSpeak)
      ]);

      console.log("🔍 App.tsx Analysis Results:", {
        ttsStatus: ttsResult.status,
        linkingStatus: linkingResult.status,
        linkingValue: linkingResult.status === 'fulfilled' ? linkingResult.value : null,
        linkingReason: linkingResult.status === 'rejected' ? linkingResult.reason : null
      });

      if (ttsResult.status !== 'fulfilled') {
        throw ttsResult.reason;
      }

      // Smart fallback for linking analysis (should never be needed as geminiService has its own fallback)
      const linking = linkingResult.status === 'fulfilled'
        ? linkingResult.value
        : (() => {
            console.warn("⚠️ App.tsx fallback triggered (shouldn't happen)");
            const words = textToSpeak.trim().split(/\s+/);
            const hasQuestion = textToSpeak.includes('?');
            const tokens = words.map(w => w.replace(/[?.!,;]/g, '').toLowerCase());

            // Use pronunciation-based function word detection
            const intonationTokens = tokens.map((token, i) => {
              const isLast = i === tokens.length - 1;
              const isFunction = isFunctionWord(token);
              if (isLast) return (isFunction ? '·' : '●') + (hasQuestion ? '↗' : '↘');
              return isFunction ? '·' : '●';
            });

            // Use pronunciation-based linking detection
            let linkedSentence = '';
            for (let i = 0; i < words.length; i++) {
              linkedSentence += words[i];
              if (i < words.length - 1) {
                linkedSentence += shouldLink(words[i], words[i + 1]) ? '‿' : ' ';
              }
            }

            return {
              fullLinkedSentence: linkedSentence,
              fullLinkedPhonetic: tokens.join(' '),
              intonationMap: intonationTokens.join(' ')
            };
          })();

      const base64 = ttsResult.value;
      ttsCache.set(`${textToSpeak}_normal`, base64);
      
      const res: AnalysisResult = {
        score: 0,
        overallComment: "",
        speechScript: textToSpeak,
        wordBreakdown: [],
        fullLinkedSentence: linking.fullLinkedSentence,
        fullLinkedPhonetic: linking.fullLinkedPhonetic,
        intonationMap: linking.intonationMap
      };
      
      setResult(res);
      analysisCache.set(textToSpeak, res);
      saveToHistory(textToSpeak, res); // IMMEDIATELY SAVE TO HISTORY
      
      setIsAudioLoading(false);
      setAppState(AppState.SHOWING_RESULT);
      await playAudio(base64, 'input_normal');
    } catch (e: any) {
      console.error("PlayAndAnalyze major failure", e);
      if (e?.code === 'RATE_LIMIT') {
        showError("今日 MiniMax 额度已用完，请更换密钥或稍后重试");
      } else if (e?.code === 'INSUFFICIENT_BALANCE') {
        // 静默切换到本地朗读，不再弹出提示
        try { await speakWithWebSpeech(textToSpeak, 1); } catch (_) {}
      } else if (e?.code === 'NO_AUDIO') {
        showError("MiniMax 未返回音频，请稍后重试");
      } else if (typeof e?.message === 'string') {
        showError(e.message);
      } else {
        showError("生成语音失败，请检查网络连接");
      }
      setIsAudioLoading(false);
      setAppState(AppState.IDLE);
    }
  };

  const startRecording = async () => {
    try {
      await ensureAudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        setAppState(AppState.ANALYZING);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setUserAudioBlob(audioBlob);
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          try {
            const res = await analyzePronunciation(text, base64);
            setResult(res);
            setAppState(AppState.SHOWING_RESULT);
            analysisCache.set(text, res);
            saveToHistory(text, res);
          } catch (err: any) {
            console.error("Recording evaluation failure", err);
            showError(err?.message || "分析失败，请重试");
            setAppState(AppState.IDLE);
          }
        };
        reader.readAsDataURL(audioBlob);
      };
      mediaRecorder.start();
      setAppState(AppState.RECORDING);
    } catch (e: any) {
      console.error("Microphone access failure", e);
      showError("无法访问麦克风，请检查权限设置");
      setAppState(AppState.IDLE);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 selection:bg-indigo-100 font-sans antialiased">
      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-semibold">{error}</span>
            <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Main Content Area */}
        <div className="flex-1 px-4">
          <header className="max-w-2xl mx-auto py-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black shadow-xl shadow-indigo-100 transform -rotate-3 transition-transform hover:rotate-0">E</div>
              <div>
                <h1 className="font-black text-2xl tracking-tighter text-slate-800 leading-none">EchoCoach</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pronunciation Mastery</p>
              </div>
            </div>
          </header>

          <main className="max-w-2xl mx-auto space-y-10 pb-10">
        <section className="bg-white p-8 rounded-[3rem] shadow-2xl shadow-slate-200/60 border border-slate-100 flex flex-col gap-8 transition-all hover:shadow-indigo-100/40">
          <textarea 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            className="w-full text-xl font-bold bg-transparent outline-none resize-none min-h-[120px] placeholder:text-slate-200 text-slate-700 leading-relaxed" 
            placeholder="在此输入你想练习的英语句子..." 
          />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-8 border-t border-slate-50 gap-6">
             <div className="flex items-center gap-5">
               <Button onClick={() => playAndAnalyze(text)} isLoading={isAudioLoading} className="h-14 !px-10 !rounded-full !text-[13px] uppercase tracking-widest font-black shadow-xl">Analyze & Listen</Button>
               <div className="flex bg-slate-100/80 rounded-full p-1.5 border border-slate-200/50 backdrop-blur-sm">
                  <button onClick={() => handlePlayTTS(text, true)} className={`h-10 px-6 rounded-full text-[11px] font-black uppercase transition-all ${activeAudioSource === 'input_slow' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-orange-500 hover:bg-white'}`}>Slow</button>
                  <button onClick={() => handlePlayTTS(text, false)} className={`h-10 px-6 rounded-full text-[11px] font-black uppercase transition-all ${activeAudioSource === 'input_normal' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-emerald-500 hover:bg-white'}`}>Normal</button>
               </div>
             </div>

             {appState === AppState.RECORDING ? (
                <button onClick={() => mediaRecorderRef.current?.stop()} className="h-14 px-10 rounded-full bg-red-50 text-[13px] font-black text-red-500 uppercase flex items-center justify-center gap-4 animate-pulse border-2 border-red-100 shadow-xl shadow-red-100">
                  <span className="w-3 h-3 bg-red-500 rounded-full animate-ping"></span> Stop
                </button>
             ) : (
                <button onClick={startRecording} className="h-14 px-10 rounded-full bg-indigo-50 text-[13px] font-black text-indigo-600 uppercase flex items-center justify-center gap-3 border-2 border-indigo-100 hover:bg-indigo-100 transition-all shadow-lg shadow-indigo-100/50 active:scale-95">
                   Start Practice
                </button>
             )}
          </div>
        </section>

        {result && (
          <FeedbackCard 
            result={result} 
            isUpdating={appState === AppState.ANALYZING}
            onPlayNormal={() => handlePlayTTS(text, false)}
            onPlaySlow={() => handlePlayTTS(text, true)}
            activeAudioSource={activeAudioSource}
            onPlayWord={(w) => handlePlayTutor(w)}
            onPlayTutor={(s) => handlePlayTutor(s)}
            playingWord={null}
            onPlayUserRecording={() => {
              if (userAudioBlob) { 
                const audio = new Audio(URL.createObjectURL(userAudioBlob)); 
                audio.play(); 
              }
            }}
          />
        )}
          </main>
        </div>

        {/* Right Sidebar - History */}
        <aside className="w-96 h-screen sticky top-0 overflow-y-auto bg-white border-l border-slate-200 px-6 py-10">
          <HistoryList
            history={history}
            onSelect={async (t) => {
              setText(t);
              const item = history.find(h => h.text.trim().toLowerCase() === t.trim().toLowerCase());

              if (item?.result) {
                // Check if the result has valid intonationMap
                const wordCount = (item.result.fullLinkedSentence || item.result.speechScript || "").trim().split(/\s+/).length;
                const tokenCount = (item.result.intonationMap || "").trim().split(/\s+/).filter(Boolean).length;

                if (!item.result.intonationMap || tokenCount !== wordCount || tokenCount === 0) {
                  console.warn("⚠️ History data incomplete, regenerating...");
                  // Regenerate linking analysis for old data
                  try {
                    const linking = await getLinkingAnalysisForText(t);
                    const fixedResult = {
                      ...item.result,
                      fullLinkedSentence: linking.fullLinkedSentence,
                      fullLinkedPhonetic: linking.fullLinkedPhonetic,
                      intonationMap: linking.intonationMap
                    };
                    setResult(fixedResult);
                    // Update cache and history
                    analysisCache.set(t, fixedResult);
                    const newHistory = history.map(h =>
                      h.text.trim().toLowerCase() === t.trim().toLowerCase()
                        ? { ...h, result: fixedResult }
                        : h
                    );
                    setHistory(newHistory);
                    localStorage.setItem('echocoach_history_v3', JSON.stringify(newHistory));
                    console.log("✅ History data fixed");
                  } catch (e) {
                    console.error("Failed to fix history data:", e);
                    setResult(item.result); // Use original even if incomplete
                  }
                } else {
                  setResult(item.result);
                }
              }
            }}
            onClear={() => {
              if(confirm("确定清空练习历史吗？")) {
                setHistory([]);
                localStorage.removeItem('echocoach_history_v3');
              }
            }}
          />
        </aside>
      </div>
    </div>
  );
};

export default App;
