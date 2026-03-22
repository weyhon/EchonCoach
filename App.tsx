
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './components/Button';
import { FeedbackCard } from './components/FeedbackCard';
import { HistoryList } from './components/HistoryList';
import { SnailIcon, SpeakerIcon, MicrophoneIcon, WaveformIcon } from './components/Icons';
import { NebulaLogo } from './components/NebulaLogo';
import { generateSpeech, analyzePronunciation, getLinkingAnalysisForText, generateTutorAudio } from './services/geminiService';
import { playBase64Audio, speakWithWebSpeech, cleanupAudioResources } from './services/audioUtils';
import { shouldLink } from './services/linkingUtils';
import { generateIntonationMap } from './services/intonationUtils';
import { AnalysisResult, AppState, HistoryItem } from './types';
import { CACHE_CONFIG, UI_CONFIG, SILENCE_DETECTION } from './config/constants';
import { safeGetJSON, safeSetJSON, safeRemoveItem } from './services/storageUtils';

const ttsCache = new Map<string, string>();
const referenceCache = new Map<string, AnalysisResult>(); // For playAndAnalyze (linking/phonetics, score=0)
const recordingCache = new Map<string, AnalysisResult>(); // For recording evaluation (has real score)

const App: React.FC = () => {
  const [text, setText] = useState<string>('How is it going?');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeAudioSource, setActiveAudioSource] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [userAudioBlob, setUserAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [activeBlobUrl, setActiveBlobUrl] = useState<string | null>(null);
  const [showMobileHistory, setShowMobileHistory] = useState(false);

  const VOICES = [
    { id: 'Kore', label: 'Kore', desc: 'Firm' },
    { id: 'Puck', label: 'Puck', desc: 'Upbeat' },
    { id: 'Charon', label: 'Charon', desc: 'Informative' },
    { id: 'Aoede', label: 'Aoede', desc: 'Breezy' },
  ] as const;
  const [selectedVoice, setSelectedVoice] = useState('Kore');

  const showError = (message: string) => {
    setError(message);
    setTimeout(() => setError(null), UI_CONFIG.ERROR_DISPLAY_DURATION);
  };

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const parsed = safeGetJSON<HistoryItem[]>(CACHE_CONFIG.HISTORY_KEY, []);
    // Populate caches from history
    parsed.forEach(h => {
      if (h.result && h.result.score > 0) recordingCache.set(h.text, h.result);
      else if (h.result) referenceCache.set(h.text, h.result);
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
  const isPlayingRef = useRef(false); // Synchronous mutex - prevents race condition from React state lag
  const silenceTimerRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Cleanup audio resources when stream/blob changes
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

  // Separate cleanup for silence detection — only on unmount
  useEffect(() => {
    return () => {
      stopSilenceDetection();
    };
  }, []);

  // Clear TTS cache when voice changes — cached audio is voice-specific
  useEffect(() => {
    ttsCache.clear();
  }, [selectedVoice]);

  // Keyboard shortcuts: Enter=Listen, Space=Play, S=Slow, R=Record/Stop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Enter' && !isAudioLoading && text.trim()) {
        e.preventDefault();
        playAndAnalyze(text);
      } else if (e.key === ' ') {
        e.preventDefault();
        if (appState !== AppState.RECORDING && appState !== AppState.ANALYZING && text.trim()) {
          handlePlayTTS(text, false);
        }
      } else if ((e.key === 's' || e.key === 'S') && text.trim()) {
        e.preventDefault();
        handlePlayTTS(text, true);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (appState === AppState.RECORDING) {
          mediaRecorderRef.current?.stop();
        } else if (appState === AppState.IDLE || appState === AppState.SHOWING_RESULT) {
          startRecording();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [text, appState, isAudioLoading]);

  const ensureAudioContext = async (): Promise<AudioContext> => {
    let ctx = audioContextRef.current;
    if (!ctx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      ctx = new Ctx();
      audioContextRef.current = ctx;
    }
    if (ctx.state === 'suspended') await ctx.resume();
    return ctx;
  };

  const playAudio = async (base64Audio: string, sourceKey: string) => {
    try {
      if (!base64Audio || base64Audio.length < UI_CONFIG.MIN_AUDIO_LENGTH) {
        console.error("Audio data too short or empty:", base64Audio);
        showError("Invalid audio data. Please try again.");
        return;
      }
      setActiveAudioSource(sourceKey);
      await playBase64Audio(base64Audio, 'audio/mpeg');
      setActiveAudioSource(null);
    } catch (e) {
      console.error("Audio playback error:", e);
      showError("Audio playback failed: " + (e as Error).message);
      setActiveAudioSource(null);
    }
  };

  const handlePlayTutor = async (selectedText: string) => {
    if (!selectedText.trim()) return;
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    try {
      const cacheKey = `tutor_${selectedText}`;
      const cached = ttsCache.get(cacheKey);
      if (cached && cached.length > UI_CONFIG.MIN_BASE64_LENGTH) {
        await playAudio(cached, 'tutor');
        return;
      }
      ttsCache.delete(cacheKey);
      setActiveAudioSource('tutor_loading');
      try {
        const base64 = await generateTutorAudio(selectedText, selectedVoice);
        ttsCache.set(cacheKey, base64);
        await playAudio(base64, 'tutor');
      } catch (e) {
        console.error("Tutor playback error", e);
        setActiveAudioSource(null);
      }
    } finally {
      isPlayingRef.current = false;
    }
  };

  const handlePlayTTS = async (textToSpeak: string, isSlow: boolean = false) => {
    if (!textToSpeak.trim()) return;
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    try {
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
        const base64 = await generateSpeech(textToSpeak, isSlow, selectedVoice);
        ttsCache.set(cacheKey, base64);
        await playAudio(base64, sourceKey);
      } catch (e: any) {
        console.error("TTS playback error", e);
        if (e?.code === 'REQUEST_TIMEOUT') {
          showError("Request timed out. Check your connection and try again.");
        } else if (e?.code === 'RATE_LIMIT') {
          showError("API rate limit reached. Please try again later.");
        } else if (e?.code === 'INSUFFICIENT_BALANCE') {
          try { await speakWithWebSpeech(textToSpeak, isSlow ? 0.8 : 1); } catch (_) {}
        } else if (e?.code === 'NO_AUDIO') {
          showError("No audio returned from API. Please try again.");
        } else if (typeof e?.message === 'string') {
          showError(e.message);
        } else {
          showError("Speech synthesis failed. Please try again.");
        }
        setActiveAudioSource(null);
      } finally {
        setAppState(AppState.IDLE);
      }
    } finally {
      isPlayingRef.current = false;
    }
  };

  const playAndAnalyze = async (textToSpeak: string) => {
    if (!textToSpeak.trim()) return;

    // Check reference cache first (linking/phonetics analysis)
    const cachedRef = referenceCache.get(textToSpeak);
    if (cachedRef) {
      // If user has a recording result, merge linking data with it
      const cachedRecording = recordingCache.get(textToSpeak);
      setResult(cachedRecording || cachedRef);
      setAppState(AppState.SHOWING_RESULT);
      await handlePlayTTS(textToSpeak, false);
      return;
    }

    setIsAudioLoading(true);
    setAppState(AppState.GENERATING_TTS);
    
    try {
      // Run TTS and linking analysis in parallel, fallback to local heuristics if linking fails
      const [ttsResult, linkingResult] = await Promise.allSettled([
        generateSpeech(textToSpeak, false, selectedVoice),
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
      referenceCache.set(textToSpeak, res);
      saveToHistory(textToSpeak, res);
      
      setIsAudioLoading(false);
      setAppState(AppState.SHOWING_RESULT);
      await playAudio(base64, 'input_normal');
    } catch (e: any) {
      console.error("PlayAndAnalyze major failure", e);
      if (e?.code === 'REQUEST_TIMEOUT') {
        showError("Request timed out. Check your connection and try again.");
      } else if (e?.code === 'RATE_LIMIT') {
        showError("API rate limit reached. Please try again later.");
      } else if (e?.code === 'INSUFFICIENT_BALANCE') {
        try { await speakWithWebSpeech(textToSpeak, 1); } catch (_) {}
      } else if (e?.code === 'NO_AUDIO') {
        showError("No audio returned from API. Please try again.");
      } else if (typeof e?.message === 'string') {
        showError(e.message);
      } else {
        showError("Speech generation failed. Check your connection.");
      }
      setIsAudioLoading(false);
      setAppState(AppState.IDLE);
    }
  };

  const stopSilenceDetection = () => {
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (mediaSourceRef.current) {
      mediaSourceRef.current.disconnect();
      mediaSourceRef.current = null;
    }
    analyserRef.current = null;
  };

  const startSilenceDetection = (stream: MediaStream, ctx: AudioContext) => {
    console.log('🎙️ startSilenceDetection called, ctx.state:', ctx.state);
    // Store source in ref to prevent garbage collection — GC kills the audio pipeline
    const source = ctx.createMediaStreamSource(stream);
    mediaSourceRef.current = source;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = SILENCE_DETECTION.FFT_SIZE;
    source.connect(analyser);
    analyserRef.current = analyser;

    // Use Uint8Array with getByteTimeDomainData — more reliable across browsers
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const recordingStartTime = Date.now();
    let silenceStartTime: number | null = null;
    let hasSpoken = false;
    let noiseFloor = 0;
    let calibrationSamples = 0;
    const CALIBRATION_COUNT = 5;
    let tickCount = 0;

    const getRMS = (): number => {
      analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      return Math.sqrt(sum / bufferLength);
    };

    silenceTimerRef.current = window.setInterval(() => {
      tickCount++;

      if (!analyserRef.current || !mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
        stopSilenceDetection();
        return;
      }

      const rms = getRMS();
      const elapsed = Date.now() - recordingStartTime;

      // Calibration phase
      if (calibrationSamples < CALIBRATION_COUNT) {
        noiseFloor = Math.max(noiseFloor, rms);
        calibrationSamples++;
        return;
      }

      if (elapsed < SILENCE_DETECTION.MIN_RECORDING_TIME) return;

      const speechThreshold = Math.max(noiseFloor * 3, SILENCE_DETECTION.THRESHOLD);

      if (rms > speechThreshold) {
        hasSpoken = true;
        silenceStartTime = null;
      } else if (hasSpoken) {
        if (!silenceStartTime) {
          silenceStartTime = Date.now();
        } else if (Date.now() - silenceStartTime >= SILENCE_DETECTION.DURATION) {
          stopSilenceDetection();
          mediaRecorderRef.current?.stop();
        }
      }
    }, SILENCE_DETECTION.CHECK_INTERVAL);

    console.log('🎙️ Silence detection interval started, timerId:', silenceTimerRef.current);
  };

  const startRecording = async () => {
    try {
      const ctx = await ensureAudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setActiveStream(stream);
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        stopSilenceDetection();
        // Stop all stream tracks immediately to release microphone
        stream.getTracks().forEach(track => track.stop());
        setActiveStream(null);

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
            recordingCache.set(text, res);
            saveToHistory(text, res);
          } catch (err: any) {
            console.error("Recording evaluation failure", err);
            showError(err?.message || "Analysis failed. Please try again.");
            setAppState(AppState.IDLE);
          }
        };
        reader.readAsDataURL(audioBlob);
      };
      mediaRecorder.start();
      setAppState(AppState.RECORDING);
      // Start monitoring for silence to auto-stop
      startSilenceDetection(stream, ctx);
    } catch (e: any) {
      console.error("Microphone access failure", e);
      stopSilenceDetection();
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
        setActiveStream(null);
      }
      showError("Microphone access denied. Please check your browser permissions.");
      setAppState(AppState.IDLE);
    }
  };

  return (
    <div className="min-h-screen pb-16 antialiased">
      {/* Fixed Top Header */}
      <header className="fixed top-0 w-full flex items-center justify-between px-6 h-14 z-50 backdrop-blur-xl"
        style={{ backgroundColor: 'rgba(15,17,23,0.85)', borderBottom: '1px solid var(--border-subtle)', boxShadow: '0 1px 20px rgba(0,0,0,0.12)' }}>
        <div className="flex items-center gap-3">
          <NebulaLogo size={24} />
          <div className="flex items-baseline gap-2">
            <span className="font-brand font-bold text-lg tracking-tight" style={{ color: 'var(--pink)' }}>Nebula</span>
            <span className="text-[10px] font-medium uppercase tracking-widest hidden sm:block" style={{ color: 'var(--gold)', opacity: 0.8 }}>Pronunciation Coach</span>
          </div>
        </div>
        {history.length > 0 && (
          <button
            onClick={() => setShowMobileHistory(true)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
            <span className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: 'var(--pink)' }}>
              {Math.min(history.length, 9)}
            </span>
          </button>
        )}
      </header>

      {/* Error Toast */}
      {error && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="glass px-5 py-3 rounded-2xl flex items-center gap-3" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
            <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--red)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{error}</span>
            <button onClick={() => setError(null)} className="ml-1 transition-colors" style={{ color: 'var(--text-muted)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="flex pt-14">
        {/* Main Content Area */}
        <div className="flex-1 px-6 lg:px-8">
          <main className="max-w-[660px] mx-auto space-y-5 pt-7 pb-16">
            {/* Input Section */}
            <section className="glass p-6 rounded-2xl flex flex-col gap-4 animate-fade-in-up stagger-2">
              <label className="label-micro" style={{ color: 'var(--text-muted)' }}>Practice Sentence</label>

              {/* Hero text input — display-scale typography, no box */}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (e.metaKey) return;
                    e.preventDefault();
                    if (text.trim() && !isAudioLoading) playAndAnalyze(text);
                  }
                }}
                className="font-brand font-bold outline-none resize-none w-full transition-colors duration-200"
                style={{
                  fontSize: 'clamp(1.6rem, 4.5vw, 2.4rem)',
                  lineHeight: '1.2',
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  minHeight: '2.6em',
                  padding: '0',
                }}
                onFocus={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                onBlur={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                placeholder="Type a sentence…"
              />

              {/* Action Bar — Stitch-style centered glass pill */}
              <div className="flex flex-col items-center gap-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-1 p-1.5 rounded-2xl action-bar-glow ghost-border"
                  style={{ backgroundColor: 'var(--bg-elevated)' }}>

                  {/* Record / Stop / Analyzing */}
                  {appState === AppState.RECORDING ? (
                    <button
                      onClick={() => mediaRecorderRef.current?.stop()}
                      className="relative flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition-all active:scale-95"
                      style={{ backgroundColor: 'rgba(248,113,113,0.1)', color: 'var(--red)' }}
                    >
                      <span className="absolute inset-0 rounded-xl rec-ring" style={{ border: '1px solid var(--red)' }}></span>
                      <span className="flex items-center gap-[2px] h-5">
                        {[0, 0.15, 0.3, 0.1, 0.25].map((d, i) => (
                          <span key={i} className="rec-bar w-[2px] rounded-full" style={{ height: '100%', backgroundColor: 'var(--red)', animationDelay: `${d}s` }}></span>
                        ))}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-tighter">Stop</span>
                    </button>
                  ) : appState === AppState.ANALYZING ? (
                    <div className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl"
                      style={{ backgroundColor: 'var(--pink-dim)', color: 'var(--pink)' }}>
                      <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(232,88,122,0.2)', borderTopColor: 'var(--pink)' }}></div>
                      <span className="text-[10px] font-bold uppercase tracking-tighter">Analyzing</span>
                    </div>
                  ) : (
                    <button
                      onClick={startRecording}
                      className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition-all hover-lift active:scale-95"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-card)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--pink)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
                    >
                      <MicrophoneIcon size={20} />
                      <span className="text-[10px] font-bold uppercase tracking-tighter">Record</span>
                    </button>
                  )}

                  {/* Slow */}
                  <button
                    onClick={() => handlePlayTTS(text, true)}
                    className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition-all active:scale-95"
                    style={{
                      backgroundColor: activeAudioSource === 'input_slow' ? 'var(--pink-dim)' : 'transparent',
                      color: activeAudioSource === 'input_slow' ? 'var(--pink)' : 'var(--text-muted)'
                    }}
                    onMouseEnter={(e) => { if (activeAudioSource !== 'input_slow') { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-card)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--pink)'; } }}
                    onMouseLeave={(e) => { if (activeAudioSource !== 'input_slow') { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; } }}
                    title="Slow playback (S)"
                  >
                    <SnailIcon size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Slow</span>
                  </button>

                  {/* Video / YouTube */}
                  <a
                    href={`https://youglish.com/pronounce/${encodeURIComponent(text.replace(/[?.!,;:'"]/g, '').trim())}/english`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition-all active:scale-95"
                    style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'var(--bg-card)'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--pink)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)'; }}
                    title="Watch native speakers on YouTube"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Video</span>
                  </a>
                </div>

                {/* Listen — Full-width hero CTA */}
                <button
                  onClick={() => playAndAnalyze(text)}
                  disabled={isAudioLoading || !text.trim()}
                  className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-white font-bold transition-all active:scale-[0.97] disabled:opacity-40"
                  style={{
                    fontSize: 'var(--text-md)',
                    letterSpacing: '-0.01em',
                    background: 'linear-gradient(135deg, #E8587A 0%, #d43d63 50%, #c0285a 100%)',
                    boxShadow: '0 6px 28px rgba(232,88,122,0.35), 0 2px 8px rgba(232,88,122,0.2)',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 36px rgba(232,88,122,0.5), 0 2px 8px rgba(232,88,122,0.25)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 28px rgba(232,88,122,0.35), 0 2px 8px rgba(232,88,122,0.2)'; }}
                  title="Listen (Enter)"
                >
                  {isAudioLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <SpeakerIcon size={22} />
                  )}
                  {isAudioLoading ? 'Loading…' : 'Listen'}
                </button>

                {/* Voice selector row */}
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  <span className="text-[9px] font-bold uppercase tracking-widest mr-1" style={{ color: 'var(--text-muted)' }}>Voice</span>
                  {VOICES.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVoice(v.id)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all active:scale-95"
                      style={{
                        backgroundColor: selectedVoice === v.id ? 'var(--pink-dim)' : 'var(--bg-deep)',
                        color: selectedVoice === v.id ? 'var(--pink)' : 'var(--text-muted)',
                        border: `1px solid ${selectedVoice === v.id ? 'var(--pink)' : 'var(--border-subtle)'}`,
                      }}
                      title={v.desc}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>

                {/* Keyboard hints */}
                <div className="flex items-center gap-3 opacity-40">
                  {[['Enter', 'Listen'], ['Space', 'Play'], ['S', 'Slow'], ['R', 'Record']].map(([key, label]) => (
                    <span key={key} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                        style={{ backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                        {key}
                      </kbd>
                      <span>{label}</span>
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* Loading State */}
            {appState === AppState.ANALYZING && !result && (
              <div className="glass rounded-2xl p-12 flex flex-col items-center gap-6 animate-fade-in-up nebula-glow">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 border-[3px] rounded-full" style={{ borderColor: 'var(--border-subtle)' }}></div>
                  <div className="absolute inset-0 border-[3px] rounded-full animate-spin" style={{ borderTopColor: 'var(--pink)', borderRightColor: 'rgba(232,88,122,0.3)', borderBottomColor: 'transparent', borderLeftColor: 'transparent' }}></div>
                </div>
                <div className="text-center space-y-2">
                  <p className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Analyzing your pronunciation</p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Comparing phonemes, rhythm, and intonation...</p>
                </div>
              </div>
            )}

            {/* Results */}
            {result && (
              <FeedbackCard
                result={result}
                isUpdating={appState === AppState.ANALYZING}
                activeAudioSource={activeAudioSource}
                onPlayWord={(w) => handlePlayTutor(w)}
                onPlayTutor={(s) => handlePlayTutor(s)}
                playingWord={null}
                hasUserRecording={!!userAudioBlob}
                onPlayUserRecording={() => {
                  if (userAudioBlob) {
                    if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl);
                    const blobUrl = URL.createObjectURL(userAudioBlob);
                    setActiveBlobUrl(blobUrl);
                    const audio = new Audio(blobUrl);
                    audio.onended = () => { URL.revokeObjectURL(blobUrl); setActiveBlobUrl(null); };
                    audio.onerror = () => { URL.revokeObjectURL(blobUrl); setActiveBlobUrl(null); };
                    audio.play();
                  }
                }}
                onRetry={() => setAppState(AppState.IDLE)}
              />
            )}
          </main>
        </div>

        {/* Right Sidebar - History */}
        <aside className="w-[300px] h-[calc(100vh-56px)] sticky top-14 overflow-y-auto px-5 py-7 hidden lg:block" style={{ backgroundColor: 'var(--bg-surface)', borderLeft: '1px solid var(--border-subtle)' }}>
          <HistoryList
            history={history}
            onQuickAnalyze={(t) => { setText(t); playAndAnalyze(t); }}
            onQuickRecord={(t) => { setText(t); startRecording(); }}
            onSelect={async (t) => {
              setText(t);
              const item = history.find(h => h.text.trim().toLowerCase() === t.trim().toLowerCase());
              if (item?.result) {
                const wordCount = (item.result.fullLinkedSentence || item.result.speechScript || "").trim().split(/\s+/).length;
                const tokenCount = (item.result.intonationMap || "").trim().split(/\s+/).filter(Boolean).length;
                if (!item.result.intonationMap || tokenCount !== wordCount || tokenCount === 0) {
                  try {
                    const linking = await getLinkingAnalysisForText(t);
                    const fixedResult = { ...item.result, fullLinkedSentence: linking.fullLinkedSentence, fullLinkedPhonetic: linking.fullLinkedPhonetic, intonationMap: linking.intonationMap };
                    setResult(fixedResult);
                    referenceCache.set(t, fixedResult);
                    const newHistory = history.map(h => h.text.trim().toLowerCase() === t.trim().toLowerCase() ? { ...h, result: fixedResult } : h);
                    setHistory(newHistory);
                    safeSetJSON(CACHE_CONFIG.HISTORY_KEY, newHistory);
                  } catch (e) {
                    setResult(item.result);
                  }
                } else {
                  setResult(item.result);
                }
              }
            }}
            onClear={() => {
              if (confirm("Clear all practice history?")) {
                setHistory([]);
                safeRemoveItem(CACHE_CONFIG.HISTORY_KEY);
              }
            }}
          />
        </aside>
      </div>

      {/* Mobile: floating history button */}
      {history.length > 0 && (
        <button
          onClick={() => setShowMobileHistory(true)}
          className="fixed bottom-6 right-6 z-40 lg:hidden w-12 h-12 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--pink)', boxShadow: '0 4px 20px var(--pink-dim)' }}
          title="Practice history"
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
            style={{ backgroundColor: 'var(--red)' }}>
            {Math.min(history.length, 9)}
          </span>
        </button>
      )}

      {/* Mobile history drawer */}
      {showMobileHistory && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setShowMobileHistory(false)}>
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl p-6 overflow-y-auto"
            style={{ backgroundColor: 'var(--bg-surface)', maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ backgroundColor: 'var(--border-medium)' }} />
            <HistoryList
              history={history}
              onQuickAnalyze={(t) => { setShowMobileHistory(false); setText(t); playAndAnalyze(t); }}
              onQuickRecord={(t) => { setShowMobileHistory(false); setText(t); startRecording(); }}
              onSelect={async (t) => {
                setShowMobileHistory(false);
                setText(t);
                const item = history.find(h => h.text.trim().toLowerCase() === t.trim().toLowerCase());
                if (item?.result) setResult(item.result);
              }}
              onClear={() => {
                if (confirm("Clear all practice history?")) {
                  setHistory([]);
                  safeRemoveItem(CACHE_CONFIG.HISTORY_KEY);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
