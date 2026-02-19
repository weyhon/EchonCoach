
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './components/Button';
import { FeedbackCard } from './components/FeedbackCard';
import { HistoryList } from './components/HistoryList';
import { SnailIcon, SpeakerIcon, MicrophoneIcon, WaveformIcon } from './components/Icons';
import { generateSpeech, analyzePronunciation, getLinkingAnalysisForText, generateTutorAudio } from './services/geminiService';
import { playBase64Audio, speakWithWebSpeech, cleanupAudioResources } from './services/audioUtils';
import { shouldLink } from './services/linkingUtils';
import { generateIntonationMap } from './services/intonationUtils';
import { AnalysisResult, AppState, HistoryItem } from './types';
import { CACHE_CONFIG, UI_CONFIG } from './config/constants';
import { safeGetJSON, safeSetJSON, safeRemoveItem } from './services/storageUtils';

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
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [activeBlobUrl, setActiveBlobUrl] = useState<string | null>(null);

  const showError = (message: string) => {
    setError(message);
    setTimeout(() => setError(null), UI_CONFIG.ERROR_DISPLAY_DURATION);
  };

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const parsed = safeGetJSON<HistoryItem[]>(CACHE_CONFIG.HISTORY_KEY, []);
    // Populate caches from history
    parsed.forEach(h => {
      if (h.result) analysisCache.set(h.text, h.result);
      if (h.ttsAudio) ttsCache.set(`${h.text}_normal`, h.ttsAudio);
    });
    return parsed;
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
      const updated = [newItem, ...filtered].slice(0, CACHE_CONFIG.MAX_HISTORY_ITEMS);

      // Safely save to localStorage (handles quota exceeded, disabled storage, etc.)
      if (!safeSetJSON(CACHE_CONFIG.HISTORY_KEY, updated)) {
        console.warn('Failed to save history to localStorage, keeping in memory only');
      }

      return updated;
    });
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Cleanup audio resources on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      cleanupAudioResources();
      // Stop MediaRecorder stream if active
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      // Revoke Blob URL to prevent memory leak
      if (activeBlobUrl) {
        URL.revokeObjectURL(activeBlobUrl);
      }
    };
  }, [activeStream, activeBlobUrl]);

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

      if (!base64Audio || base64Audio.length < UI_CONFIG.MIN_AUDIO_LENGTH) {
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
    if (cached && cached.length > UI_CONFIG.MIN_BASE64_LENGTH) {
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
    if (cached && cached.length > UI_CONFIG.MIN_BASE64_LENGTH) {
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
      if (e?.code === 'REQUEST_TIMEOUT') {
        showError("请求超时，请检查网络连接或稍后重试");
      } else if (e?.code === 'RATE_LIMIT') {
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

            // Use centralized intonation generation
            const intonationMap = generateIntonationMap(textToSpeak, words);

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
              fullLinkedPhonetic: words.map(w => w.replace(/[?.!,;]/g, '').toLowerCase()).join(' '),
              intonationMap
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
      if (e?.code === 'REQUEST_TIMEOUT') {
        showError("请求超时，请检查网络连接或稍后重试");
      } else if (e?.code === 'RATE_LIMIT') {
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
      setActiveStream(stream); // Track stream for cleanup
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        // Stop all stream tracks immediately to release microphone
        if (activeStream) {
          activeStream.getTracks().forEach(track => track.stop());
          setActiveStream(null);
        }

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
      // Cleanup stream if it was created but recording failed
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
        setActiveStream(null);
      }
      showError("无法访问麦克风，请检查权限设置");
      setAppState(AppState.IDLE);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50 pb-20 selection:bg-indigo-100 font-sans antialiased">
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
          <header className="max-w-2xl mx-auto py-10 flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-[18px] flex items-center justify-center text-white font-black shadow-lg shadow-indigo-200/50 transform -rotate-2 transition-all hover:rotate-0 hover:shadow-xl hover:shadow-indigo-300/50">
                <span className="relative z-10">E</span>
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-[18px]"></div>
              </div>
              <div>
                <h1 className="font-black text-3xl tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent leading-none">EchoCoach</h1>
                <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-[0.12em] mt-1.5">AI-Powered Pronunciation Master</p>
              </div>
            </div>
          </header>

          <main className="max-w-2xl mx-auto space-y-12 pb-10">
        <section className="bg-white p-12 rounded-[32px] shadow-xl shadow-slate-200/60 border border-slate-200/80 flex flex-col gap-9 transition-all hover:shadow-2xl">
          <label className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.15em]">Practice Sentence</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full text-xl font-semibold bg-gradient-to-br from-slate-50 to-slate-100/50 outline-none resize-none min-h-[140px] placeholder:text-slate-300 text-slate-700 leading-relaxed p-6 rounded-[20px] border-2 border-slate-200 focus:border-indigo-300 focus:bg-white focus:shadow-inner transition-all"
            placeholder="Type your English sentence here..."
          />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-6 border-t border-slate-100 gap-6">
             <div className="flex items-center gap-4">
               <button
                 onClick={() => playAndAnalyze(text)}
                 disabled={isAudioLoading}
                 className="h-[60px] px-10 rounded-[18px] bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[13px] font-black uppercase tracking-[0.1em] shadow-lg shadow-indigo-300/50 hover:shadow-xl hover:shadow-indigo-400/50 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-60"
               >
                 <WaveformIcon size={20} />
                 {isAudioLoading ? 'Analyzing...' : 'Analyze'}
               </button>
               <div className="flex bg-gradient-to-br from-white to-slate-50 rounded-[18px] p-2.5 gap-2.5 border-2 border-slate-200">
                  <button
                    onClick={() => handlePlayTTS(text, true)}
                    className={`h-12 px-6 rounded-[14px] text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                      activeAudioSource === 'input_slow'
                        ? 'bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 shadow-md border-[1.5px] border-amber-400'
                        : 'text-slate-500 hover:text-amber-600 hover:bg-amber-50/50'
                    }`}
                  >
                    <SnailIcon size={20} />
                  </button>
                  <button
                    onClick={() => handlePlayTTS(text, false)}
                    className={`h-12 px-6 rounded-[14px] text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                      activeAudioSource === 'input_normal'
                        ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 shadow-md border-[1.5px] border-emerald-400'
                        : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50/50'
                    }`}
                  >
                    <SpeakerIcon size={20} />
                  </button>
               </div>
             </div>

             {appState === AppState.RECORDING ? (
                <button onClick={() => mediaRecorderRef.current?.stop()} className="h-[60px] px-10 rounded-[18px] bg-gradient-to-br from-red-50 to-red-100 text-[13px] font-black text-red-600 uppercase flex items-center justify-center gap-3 animate-pulse border-2 border-red-300 shadow-lg shadow-red-200/50 active:scale-95 transition-all">
                  <span className="w-3 h-3 bg-red-600 rounded-full animate-ping"></span> Stop
                </button>
             ) : (
                <button onClick={startRecording} className="h-[60px] px-10 rounded-[18px] bg-gradient-to-br from-white to-amber-50 text-[13px] font-black text-amber-600 uppercase flex items-center justify-center gap-3 border-2 border-amber-400 hover:bg-gradient-to-br hover:from-amber-50 hover:to-amber-100 hover:border-amber-500 transition-all shadow-md shadow-amber-200/50 active:scale-95">
                   <MicrophoneIcon size={20} />
                   Record
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
                // Revoke previous Blob URL to prevent memory leak
                if (activeBlobUrl) {
                  URL.revokeObjectURL(activeBlobUrl);
                }

                // Create new Blob URL and track it
                const blobUrl = URL.createObjectURL(userAudioBlob);
                setActiveBlobUrl(blobUrl);

                const audio = new Audio(blobUrl);

                // Revoke Blob URL after playback ends
                audio.onended = () => {
                  URL.revokeObjectURL(blobUrl);
                  setActiveBlobUrl(null);
                };

                // Also revoke on error
                audio.onerror = () => {
                  URL.revokeObjectURL(blobUrl);
                  setActiveBlobUrl(null);
                };

                audio.play();
              }
            }}
          />
        )}
          </main>
        </div>

        {/* Right Sidebar - History */}
        <aside className="w-[400px] h-screen sticky top-0 overflow-y-auto bg-gradient-to-b from-white to-slate-50 border-l border-slate-200 px-9 py-12">
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
                    // Safely save updated history
                    if (!safeSetJSON(CACHE_CONFIG.HISTORY_KEY, newHistory)) {
                      console.warn('Failed to save updated history to localStorage');
                    }
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
                // Safely remove history from localStorage
                if (!safeRemoveItem(CACHE_CONFIG.HISTORY_KEY)) {
                  console.warn('Failed to remove history from localStorage');
                }
              }
            }}
          />
        </aside>
      </div>
    </div>
  );
};

export default App;
