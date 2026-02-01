
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './components/Button';
import { FeedbackCard } from './components/FeedbackCard';
import { HistoryList } from './components/HistoryList';
import { generateSpeech, analyzePronunciation, getLinkingAnalysisForText, generateTutorAudio } from './services/geminiService';
import { decodePCM } from './services/audioUtils';
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

  const playBuffer = async (base64Audio: string, sourceKey: string) => {
    try {
      const ctx = await ensureAudioContext();
      if (audioSourceRef.current) {
        try { audioSourceRef.current.stop(); } catch(e) {}
      }
      const audioBuffer = decodePCM(base64Audio, ctx, 24000);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      audioSourceRef.current = source;
      setActiveAudioSource(sourceKey);
      source.start(0);
      source.onended = () => { setActiveAudioSource(null); };
    } catch (e) {
      setActiveAudioSource(null);
    }
  };

  const handlePlayTutor = async (selectedText: string) => {
    if (!selectedText.trim()) return;
    const cacheKey = `tutor_${selectedText}`;
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      await playBuffer(cached, 'tutor');
      return;
    }
    setActiveAudioSource('tutor_loading'); 
    try {
      const base64 = await generateTutorAudio(selectedText);
      ttsCache.set(cacheKey, base64);
      await playBuffer(base64, 'tutor');
    } catch (e) { 
      console.error("Tutor playback error", e);
      setActiveAudioSource(null); 
    }
  };

  const handlePlayTTS = async (textToSpeak: string, isSlow: boolean = false) => {
    if (!textToSpeak.trim()) return;
    const cacheKey = `${textToSpeak}_${isSlow ? 'slow' : 'normal'}`;
    const sourceKey = isSlow ? 'input_slow' : 'input_normal';
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      await playBuffer(cached, sourceKey);
      return;
    }
    setAppState(AppState.GENERATING_TTS);
    setActiveAudioSource(sourceKey);
    try {
      const base64 = await generateSpeech(textToSpeak, isSlow);
      ttsCache.set(cacheKey, base64);
      await playBuffer(base64, sourceKey);
    } catch (e) { 
      console.error("TTS playback error", e);
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
      const [base64, linking] = await Promise.all([
        generateSpeech(textToSpeak, false),
        getLinkingAnalysisForText(textToSpeak)
      ]);
      
      ttsCache.set(`${textToSpeak}_normal`, base64);
      
      const res: AnalysisResult = {
        score: 0,
        overallComment: "标注已准备就绪。点击下方录音按钮，开始你的发音挑战吧！",
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
      await playBuffer(base64, 'input_normal');
    } catch (e) {
      console.error("PlayAndAnalyze major failure", e);
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
            saveToHistory(text, res); // PERSIST EVALUATED RESULT
          } catch (err) { 
            console.error("Recording evaluation failure", err);
            setAppState(AppState.IDLE); 
          }
        };
        reader.readAsDataURL(audioBlob);
      };
      mediaRecorder.start();
      setAppState(AppState.RECORDING);
    } catch (e) { 
      console.error("Microphone access failure", e);
      setAppState(AppState.IDLE); 
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 px-4 selection:bg-indigo-100 font-sans antialiased">
      <header className="max-w-2xl mx-auto py-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black shadow-xl shadow-indigo-100 transform -rotate-3 transition-transform hover:rotate-0">E</div>
          <div>
            <h1 className="font-black text-2xl tracking-tighter text-slate-800 leading-none">EchoCoach</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pronunciation Mastery</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto space-y-10">
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
        
        <HistoryList 
          history={history} 
          onSelect={(t) => { 
            setText(t); 
            const item = history.find(h => h.text.trim().toLowerCase() === t.trim().toLowerCase()); 
            if(item?.result) setResult(item.result); 
          }} 
          onClear={() => {
            if(confirm("确定清空练习历史吗？")) {
              setHistory([]);
              localStorage.removeItem('echocoach_history_v3');
            }
          }} 
        />
      </main>
    </div>
  );
};

export default App;
