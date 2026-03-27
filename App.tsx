
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
  const [showIPALegend, setShowIPALegend] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState<'normal' | 'slow'>('normal');

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
      <header className="fixed top-0 w-full z-50 flex items-center justify-between px-5 h-[52px]"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center rounded-lg shrink-0"
            style={{ width: 22, height: 22, background: 'var(--rose)', borderRadius: 6 }}>
            <NebulaLogo size={12} />
          </div>
          <span className="font-brand font-extrabold tracking-tight" style={{ fontSize: 15, color: 'var(--text-primary)' }}>Nebula</span>
          <span className="hidden sm:block font-semibold uppercase tracking-widest" style={{ fontSize: 10, color: 'var(--rose)', marginLeft: 4 }}>Coach</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowIPALegend(true)}
            className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
            style={{ background: 'var(--surface-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            IPA Guide
          </button>
          {history.length > 0 && (
            <button onClick={() => setShowMobileHistory(true)}
              className="lg:hidden px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5"
              style={{ background: 'var(--surface-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              History
              <span className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{ background: 'var(--rose)' }}>
                {Math.min(history.length, 9)}
              </span>
            </button>
          )}
        </div>
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

      <div className="flex pt-[52px]">
        {/* Main Content Area */}
        <div className="flex-1 px-6 lg:px-8">
          <main className="max-w-[660px] mx-auto space-y-5 pt-7 pb-16">
            {/* Input Section */}
            <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              {/* Label */}
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-placeholder)', marginBottom: 10 }}>
                PRACTICE SENTENCE
              </div>
              {/* Textarea */}
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (e.metaKey) return;
                    e.preventDefault();
                    if (text.trim() && !isAudioLoading) playAndAnalyze(text);
                  }
                }}
                placeholder="Type or paste a sentence to practice..."
                className="w-full resize-none outline-none"
                style={{
                  minHeight: 56, padding: '11px 13px',
                  background: 'var(--surface-muted)', border: '1.5px solid var(--border)', borderRadius: 8,
                  fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)',
                  lineHeight: 1.55,
                }}
                onFocus={e => e.target.style.borderColor = 'var(--rose)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
                disabled={appState !== AppState.IDLE && appState !== AppState.SHOWING_RESULT}
              />
              {/* Action row */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {/* Play Reference */}
                <button onClick={() => handlePlayTTS(text, ttsSpeed === 'slow')} disabled={!text.trim() || appState === AppState.RECORDING || appState === AppState.ANALYZING}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                  style={{ background: 'var(--rose)', color: '#fff', border: 'none' }}>
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  Play Reference
                </button>
                {/* Record */}
                {appState !== AppState.RECORDING ? (
                  <button onClick={startRecording} disabled={!text.trim() || appState === AppState.ANALYZING || appState === AppState.GENERATING_TTS}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                    style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/></svg>
                    Record
                  </button>
                ) : (
                  <button onClick={() => mediaRecorderRef.current?.stop()}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold"
                    style={{ background: '#111827', color: '#fff', border: 'none' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: '#fff', display: 'inline-block' }} />
                    Stop Recording
                  </button>
                )}
                {/* Speed toggle */}
                <div className="flex ml-auto rounded-md overflow-hidden" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', padding: 2 }}>
                  {(['normal', 'slow'] as const).map(speed => (
                    <button key={speed} onClick={() => setTtsSpeed(speed)}
                      className="px-3 py-1 text-xs font-semibold rounded capitalize transition-all"
                      style={ttsSpeed === speed
                        ? { background: 'var(--surface)', color: 'var(--text-primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
                        : { color: 'var(--text-muted)', background: 'transparent' }}>
                      {speed.charAt(0).toUpperCase() + speed.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recording state: waveform */}
              {appState === AppState.RECORDING && (
                <div className="flex items-center gap-3 mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: 'var(--red)' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Recording...</span>
                  </div>
                  <div className="flex items-center gap-0.5 h-6">
                    {[1,2,3,4,5,6,7].map(n => (
                      <div key={n} className="rec-bar" style={{ width: 3, background: 'var(--rose)', borderRadius: 2, height: `${12 + (n % 3) * 8}px` }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Analyzing state */}
              {appState === AppState.ANALYZING && (
                <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="w-3.5 h-3.5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--rose)', borderTopColor: 'transparent' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Analyzing pronunciation...</span>
                </div>
              )}
            </div>

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
        <aside className="hidden lg:flex flex-col w-[256px] shrink-0 h-[calc(100vh-52px)] sticky top-[52px] overflow-y-auto"
          style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}>
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
