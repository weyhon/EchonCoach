
import React, { useState, useRef, useEffect } from 'react';
import { FeedbackCard } from './components/FeedbackCard';
import { HistoryList } from './components/HistoryList';
import { generateSpeech, analyzePronunciation, getLinkingAnalysisForText, generateTutorAudio } from './services/geminiService';
import { playBase64Audio, speakWithWebSpeech, cleanupAudioResources } from './services/audioUtils';
import { azurePronunciationScore, isAzureSpeechAvailable } from './services/azureSpeechService';
import { shouldLink } from './services/linkingUtils';
import { generateIntonationMap } from './services/intonationUtils';
import { IPALegend } from './components/IPALegend';
import { AnalysisResult, AppState, HistoryItem } from './types';
import { CACHE_CONFIG, UI_CONFIG, SILENCE_DETECTION } from './config/constants';
import { safeGetJSON, safeSetJSON, safeRemoveItem } from './services/storageUtils';
import { lruGet, lruSet } from './utils/lru';

// LRU-style cache: evict oldest entries when over limit to prevent unbounded memory growth
const MAX_TTS_CACHE = 20;  // ~20 * 50KB = ~1MB max
const MAX_RESULT_CACHE = 50;

const ttsCache = new Map<string, string>();
const referenceCache = new Map<string, AnalysisResult>(); // For playAndAnalyze (linking/phonetics, score=0)
const recordingCache = new Map<string, AnalysisResult>(); // For recording evaluation (has real score)

// Demo data for UI screenshot scoring
const DEMO_RESULT: AnalysisResult = {
  score: 78,
  overallComment: 'Good effort! Focus on the vowel sounds in "going" — try rounding your lips more for the /oʊ/ diphthong.',
  speechScript: 'How is it going?',
  wordBreakdown: [
    { word: 'How', status: 'correct', phoneticCorrect: 'haʊ', phoneticUser: 'haʊ', wordScore: 95, suggestion: '' },
    { word: 'is', status: 'correct', phoneticCorrect: 'ɪz', phoneticUser: 'ɪz', wordScore: 90, suggestion: '' },
    { word: 'it', status: 'needs_improvement', phoneticCorrect: 'ɪt', phoneticUser: 'ɪtʰ', wordScore: 65, suggestion: 'Avoid aspirating the final /t/' },
    { word: 'going', status: 'incorrect', phoneticCorrect: 'ˈɡoʊɪŋ', phoneticUser: 'ˈɡɔɪŋ', wordScore: 45, suggestion: 'Round your lips for /oʊ/ instead of /ɔ/' },
  ],
  fullLinkedSentence: 'How‿is it going?',
  fullLinkedPhonetic: 'haʊ‿ɪz ɪt ˈɡoʊɪŋ',
  intonationMap: '· · ● ↘',
  translation: '最近怎么样？',
};

const App: React.FC = () => {
  const isDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === 'results';
  const [text, setText] = useState<string>('How is it going?');
  const [appState, setAppState] = useState<AppState>(isDemo ? AppState.SHOWING_RESULT : AppState.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(isDemo ? DEMO_RESULT : null);
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
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const VOICES = [
    { id: 'Kore', label: 'Kore', desc: 'Firm' },
    { id: 'Puck', label: 'Puck', desc: 'Upbeat' },
    { id: 'Charon', label: 'Charon', desc: 'Informative' },
    { id: 'Aoede', label: 'Aoede', desc: 'Breezy' },
  ] as const;
  const [selectedVoice, setSelectedVoice] = useState(() => {
    try { return localStorage.getItem('echocoach_voice') || 'Kore'; } catch { return 'Kore'; }
  });

  const showError = (message: string) => {
    setError(message);
    setTimeout(() => setError(null), UI_CONFIG.ERROR_DISPLAY_DURATION);
  };

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const parsed = safeGetJSON<HistoryItem[]>(CACHE_CONFIG.HISTORY_KEY, []);
    // Populate caches from history
    parsed.forEach(h => {
      if (h.result && h.result.score > 0) lruSet(recordingCache, h.text, h.result, MAX_RESULT_CACHE);
      // Only rehydrate reference cache for entries with valid IPA (skip stale/incomplete)
      else if (h.result && h.result.fullLinkedPhonetic) lruSet(referenceCache, h.text, h.result, MAX_RESULT_CACHE);
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
        showError('Storage full — history kept in memory only. Clear old entries to save.');
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
  const enrichAbortRef = useRef<AbortController | null>(null);
  // Synchronous mutexes — React state lags a click, these do not.
  const startingRecordingRef = useRef(false); // blocks a 2nd MediaRecorder
  const analyzingRef = useRef(false);         // blocks duplicate TTS/linking fetches

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

  // Online/offline detection
  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  // Clear TTS cache and persist preference when voice changes
  useEffect(() => {
    ttsCache.clear();
    try { localStorage.setItem('echocoach_voice', selectedVoice); } catch {}
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
    // Safety timeout: clear "Playing..." after 15s max in case of stuck state
    const safetyTimer = setTimeout(() => {
      setActiveAudioSource(null);
      isPlayingRef.current = false;
    }, 15000);
    try {
      const cacheKey = `tutor_${selectedText}`;
      const cached = lruGet(ttsCache, cacheKey);
      if (cached && cached.length > UI_CONFIG.MIN_BASE64_LENGTH) {
        await playAudio(cached, 'tutor');
        return;
      }
      ttsCache.delete(cacheKey);
      setActiveAudioSource('tutor_loading');
      try {
        const base64 = await generateTutorAudio(selectedText, selectedVoice);
        lruSet(ttsCache, cacheKey, base64, MAX_TTS_CACHE);
        await playAudio(base64, 'tutor');
      } catch (e) {
        console.error("Tutor playback error", e);
        setActiveAudioSource(null);
      }
    } finally {
      clearTimeout(safetyTimer);
      isPlayingRef.current = false;
    }
  };

  const handlePlayTTS = async (textToSpeak: string, isSlow: boolean = false) => {
    if (!textToSpeak.trim()) return;
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    const stateBeforePlay = appState;
    try {
      const cacheKey = `${textToSpeak}_${isSlow ? 'slow' : 'normal'}`;
      const sourceKey = isSlow ? 'input_slow' : 'input_normal';
      const cached = lruGet(ttsCache, cacheKey);
      if (cached && cached.length > UI_CONFIG.MIN_BASE64_LENGTH) {
        await playAudio(cached, sourceKey);
        return;
      }
      ttsCache.delete(cacheKey);
      setAppState(AppState.GENERATING_TTS);
      setActiveAudioSource(sourceKey);
      try {
        const base64 = await generateSpeech(textToSpeak, isSlow, selectedVoice);
        lruSet(ttsCache, cacheKey, base64, MAX_TTS_CACHE);
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
        // Restore previous state instead of always resetting to IDLE
        // so analysis results remain visible after playing
        setAppState(stateBeforePlay === AppState.SHOWING_RESULT ? AppState.SHOWING_RESULT : AppState.IDLE);
      }
    } finally {
      isPlayingRef.current = false;
    }
  };

  const playAndAnalyze = async (textToSpeak: string) => {
    if (!textToSpeak.trim()) return;
    // The button re-enables before these fetches settle (appState goes to
    // SHOWING_RESULT immediately), so without a synchronous mutex every extra
    // click fires another TTS + linking pair — 3 clicks measured as 6 requests,
    // enough to trip Gemini's 10/min TTS quota.
    if (analyzingRef.current) return;
    analyzingRef.current = true;
    try {
      await runPlayAndAnalyze(textToSpeak);
    } finally {
      analyzingRef.current = false;
    }
  };

  const runPlayAndAnalyze = async (textToSpeak: string) => {

    // Check reference cache first (linking/phonetics analysis).
    // Skip stale cache entries with empty IPA — they came from incomplete prior runs.
    const cachedRef = lruGet(referenceCache, textToSpeak);
    if (cachedRef && cachedRef.fullLinkedPhonetic) {
      // If user has a recording result, merge linking data with it
      const cachedRecording = lruGet(recordingCache, textToSpeak);
      setResult(cachedRecording || cachedRef);
      setAppState(AppState.SHOWING_RESULT);
      await handlePlayTTS(textToSpeak, false);
      return;
    }

    // 1) Show result IMMEDIATELY using local heuristics (no wait)
    const words = textToSpeak.trim().split(/\s+/);
    const intonationMap = generateIntonationMap(textToSpeak, words);
    let linkedSentence = '';
    for (let i = 0; i < words.length; i++) {
      linkedSentence += words[i];
      if (i < words.length - 1) {
        linkedSentence += shouldLink(words[i], words[i + 1]) ? '‿' : ' ';
      }
    }
    const localRes: AnalysisResult = {
      score: 0,
      overallComment: "",
      speechScript: textToSpeak,
      wordBreakdown: [],
      fullLinkedSentence: linkedSentence,
      fullLinkedPhonetic: '',
      intonationMap
    };
    setResult(localRes);
    setAppState(AppState.SHOWING_RESULT);
    // Note: don't cache or save-to-history yet — wait for linking to enrich the result,
    // otherwise an incomplete (empty IPA) entry poisons the cache.

    // 2) Fire TTS + remote linking in parallel (audio plays when ready)
    setIsAudioLoading(true);
    try {
      const [ttsResult, linkingResult] = await Promise.allSettled([
        generateSpeech(textToSpeak, false, selectedVoice),
        getLinkingAnalysisForText(textToSpeak)
      ]);

      // Update result with richer remote linking data if available
      if (linkingResult.status === 'fulfilled') {
        const linking = linkingResult.value;
        const enrichedRes: AnalysisResult = {
          ...localRes,
          fullLinkedSentence: linking.fullLinkedSentence,
          fullLinkedPhonetic: linking.fullLinkedPhonetic,
          intonationMap: linking.intonationMap,
          translation: linking.translation
        };
        setResult(enrichedRes);
        lruSet(referenceCache, textToSpeak, enrichedRes, MAX_RESULT_CACHE);
        saveToHistory(textToSpeak, enrichedRes);
      } else {
        // Linking failed — still save the local result so the entry shows in history,
        // but it won't be cached (so next attempt will retry the API).
        saveToHistory(textToSpeak, localRes);
      }

      if (ttsResult.status === 'fulfilled') {
        const base64 = ttsResult.value;
        lruSet(ttsCache, `${textToSpeak}_normal`, base64, MAX_TTS_CACHE);
        setIsAudioLoading(false);
        await playAudio(base64, 'input_normal');
      } else {
        throw ttsResult.reason;
      }
    } catch (e: any) {
      console.error("PlayAndAnalyze TTS failure", e);
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
    // A double-click (or key-repeat on R) lands a 2nd call before getUserMedia
    // resolves. Two MediaRecorders would then share mediaRecorderRef/
    // audioChunksRef: recorder #1's onstop clears recorder #2's silence timer
    // and hides the Stop button, leaving the mic live with no way to stop it.
    if (startingRecordingRef.current || mediaRecorderRef.current?.state === 'recording') return;
    startingRecordingRef.current = true;
    try {
      // Cancel any pending Gemini enrichment from a previous recording
      enrichAbortRef.current?.abort();
      // Dismiss mobile keyboard to avoid UI shift during recording
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      const ctx = await ensureAudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setActiveStream(stream);
      // Lower bitrate (32kbps) — sufficient for speech analysis, ~75% smaller upload
      const recorderOptions: MediaRecorderOptions = { audioBitsPerSecond: 32000 };
      try { recorderOptions.mimeType = 'audio/webm;codecs=opus'; } catch {}
      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        stopSilenceDetection();
        // Stop all stream tracks immediately to release microphone
        stream.getTracks().forEach(track => track.stop());
        setActiveStream(null);

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setUserAudioBlob(audioBlob);

        // Auto-play user recording immediately so they can hear themselves
        const playbackUrl = URL.createObjectURL(audioBlob);
        if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl);
        setActiveBlobUrl(playbackUrl);
        const playbackAudio = new Audio(playbackUrl);
        playbackAudio.onended = () => URL.revokeObjectURL(playbackUrl);
        playbackAudio.play().catch(() => URL.revokeObjectURL(playbackUrl));

        // Start analysis in parallel with playback
        setAppState(AppState.ANALYZING);
        try {
          let res: AnalysisResult;

          if (isAzureSpeechAvailable()) {
            // ── Azure path: dedicated acoustic model (~1-2s) ──
            try {
              res = await azurePronunciationScore(text, audioBlob);
            } catch (azureErr) {
              // Azure failed — fall back to Gemini
              console.warn('Azure scoring failed, falling back to Gemini:', azureErr);
              const buffer = await audioBlob.arrayBuffer();
              const bytes = new Uint8Array(buffer);
              let binary = '';
              for (let i = 0; i < bytes.length; i += 8192) {
                binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
              }
              const base64 = btoa(binary);
              const hasLinkingCache = referenceCache.has(text);
              res = await analyzePronunciation(text, base64, hasLinkingCache);
              if (hasLinkingCache && !res.fullLinkedSentence) {
                const cached = lruGet(referenceCache, text)!;
                res.fullLinkedSentence = cached.fullLinkedSentence;
                res.fullLinkedPhonetic = cached.fullLinkedPhonetic;
                res.intonationMap = cached.intonationMap;
                res.translation = cached.translation;
              }
            }

            // Enrich with Gemini coaching tips asynchronously (non-blocking)
            const capturedText = text; // capture before async to avoid stale closure
            const capturedRes = res; // snapshot for enrichment
            const controller = new AbortController();
            enrichAbortRef.current = controller;
            const enrichWithGemini = async () => {
              try {
                if (controller.signal.aborted) return;
                const buffer = await audioBlob.arrayBuffer();
                const bytes = new Uint8Array(buffer);
                let binary = '';
                for (let i = 0; i < bytes.length; i += 8192) {
                  binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
                }
                const base64 = btoa(binary);
                const geminiRes = await analyzePronunciation(capturedText, base64, true);
                if (controller.signal.aborted) return;
                // Only take coaching fields from Gemini, keep Azure's accurate scores
                if (geminiRes.overallComment) {
                  const enriched = { ...capturedRes, overallComment: geminiRes.overallComment, wordBreakdown: [...capturedRes.wordBreakdown] };
                  // Merge per-word suggestions from Gemini where Azure had none
                  geminiRes.wordBreakdown?.forEach(gw => {
                    const match = enriched.wordBreakdown.find(w => w.word.toLowerCase() === gw.word.toLowerCase());
                    if (match && !match.suggestion && gw.suggestion) {
                      match.suggestion = gw.suggestion;
                    }
                  });
                  setResult(enriched);
                  lruSet(recordingCache, capturedText, enriched, MAX_RESULT_CACHE);
                }
              } catch { /* Gemini enrichment is optional */ }
            };
            enrichWithGemini();

          } else {
            // ── Gemini fallback: LLM-based analysis ──
            const buffer = await audioBlob.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i += 8192) {
              binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
            }
            const base64 = btoa(binary);
            const hasLinkingCache = referenceCache.has(text);
            res = await analyzePronunciation(text, base64, hasLinkingCache);

            // Merge linking data from cache if slim
            if (hasLinkingCache && !res.fullLinkedSentence) {
              const cached = lruGet(referenceCache, text)!;
              res.fullLinkedSentence = cached.fullLinkedSentence;
              res.fullLinkedPhonetic = cached.fullLinkedPhonetic;
              res.intonationMap = cached.intonationMap;
              res.translation = cached.translation;
            }
          }

          // Merge linking/prosody from reference cache
          if (!res.fullLinkedSentence && referenceCache.has(text)) {
            const cached = lruGet(referenceCache, text)!;
            res.fullLinkedSentence = cached.fullLinkedSentence;
            res.fullLinkedPhonetic = cached.fullLinkedPhonetic;
            res.intonationMap = cached.intonationMap;
          }

          setResult(res);
          setAppState(AppState.SHOWING_RESULT);
          lruSet(recordingCache, text, res, MAX_RESULT_CACHE);
          saveToHistory(text, res);

          // If no linking data yet, fetch in background
          if (!res.fullLinkedSentence) {
            getLinkingAnalysisForText(text).then(linking => {
              const enriched = { ...res, ...linking };
              setResult(enriched);
              lruSet(recordingCache, text, enriched, MAX_RESULT_CACHE);
            }).catch(() => {});
          }
        } catch (err: any) {
          console.error("Recording evaluation failure", err);
          showError(err?.message || "Analysis failed. Please try again.");
          setAppState(AppState.IDLE);
        }
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
    } finally {
      startingRecordingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen pb-16 antialiased">
      {/* Fixed Top Header */}
      <header className="fixed top-0 w-full z-50 flex items-center justify-between px-5 h-[52px]"
        style={{ background: 'rgba(252,252,250,0.92)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderBottom: '1px solid var(--text-primary)' }}>
        <div className="flex items-center gap-2.5">
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: 0 }}>
            EchoCoach<span aria-hidden="true" style={{ color: 'var(--rose)' }}>°</span>
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowIPALegend(true)}
            className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors min-h-[44px] flex items-center hover-rose"
            style={{ background: 'transparent', color: 'var(--text-secondary)' }}>
            IPA Guide
          </button>
          {history.length > 0 && (
            <button onClick={() => setShowMobileHistory(true)}
              className="lg:hidden px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] flex items-center gap-1.5 min-h-[44px] hover-rose"
              style={{ background: 'transparent', color: 'var(--text-secondary)' }}>
              History
              <span className="w-4 h-4 rounded-[1px] text-[9px] font-bold flex items-center justify-center text-white" style={{ background: 'var(--rose)' }}>
                {Math.min(history.length, 9)}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* Offline Banner */}
      {isOffline && (
        <div className="fixed top-16 left-0 right-0 z-40 flex justify-center animate-fade-in">
          <div className="px-4 py-2 rounded-b-lg text-xs font-semibold flex items-center gap-2"
            style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12h.01" />
            </svg>
            You're offline — some features won't work
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="glass px-5 py-3 rounded-[2px] flex items-center gap-3">
            <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--red)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss error" className="ml-1 transition-colors" style={{ color: 'var(--text-muted)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="flex pt-[52px]">
        {/* Main Content Area */}
        <div className="flex-1 px-6 lg:px-8 relative">
          <main className={`max-w-[660px] mx-auto space-y-5 pt-7 pb-16${appState === AppState.IDLE && !result ? ' lg:min-h-[calc(100svh-140px)] lg:flex lg:flex-col lg:justify-center lg:pb-[9vh]' : ''}`}>
            {/* Input Section — open page, no card */}
            <div className="pt-3">
              {/* Label */}
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <label htmlFor="practice-sentence" className="label-micro" style={{ color: 'var(--text-muted)' }}>
                  PRACTICE SENTENCE
                </label>
                <span className="font-mono" style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', color: 'var(--rose)' }}>LVL 1</span>
              </div>
              {/* Textarea — set like a book pull-quote over a hairline rule */}
              <textarea
                id="practice-sentence"
                value={text}
                onChange={e => { setText(e.target.value); setResult(null); setUserAudioBlob(null); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (e.metaKey) return;
                    e.preventDefault();
                    if (text.trim() && !isAudioLoading) playAndAnalyze(text);
                  }
                }}
                placeholder="Type or paste a sentence to practice..."
                className="w-full resize-none outline-none input-focus practice-input"
                style={{
                  padding: '12px 0 16px',
                  background: 'transparent', borderRadius: 0,
                  fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, color: 'var(--text-primary)',
                  lineHeight: 1.35, letterSpacing: '-0.01em',
                }}
                disabled={appState !== AppState.IDLE && appState !== AppState.SHOWING_RESULT}
              />
              {/* Action row — typewriter controls over the sentence rule.
                  Listening is the user's primary action, so Play Reference
                  carries the accent; Record is a quiet text control. */}
              <div className="flex items-center gap-2 mt-4 flex-wrap gap-y-2">
                {/* Play Reference — THE accent action */}
                {(() => {
                  const isBusy = appState === AppState.GENERATING_TTS || activeAudioSource?.startsWith('input_');
                  return (
                    <button
                      onClick={() => { result ? handlePlayTTS(text, ttsSpeed === 'slow') : playAndAnalyze(text); }}
                      disabled={!text.trim() || isBusy || appState === AppState.RECORDING || appState === AppState.ANALYZING}
                      aria-label={appState === AppState.GENERATING_TTS ? 'Loading audio' : 'Play reference pronunciation'}
                      title="Play reference (Space)"
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-[2px] text-[11px] font-semibold uppercase tracking-[0.1em] disabled:opacity-60 min-h-[44px] ${isBusy ? '' : 'btn-press'}`}
                      style={isBusy
                        ? { background: 'transparent', color: 'var(--rose)', border: '1px solid var(--rose)' }
                        : { background: 'var(--rose)', color: '#fff' }}>
                      {isBusy ? (
                        appState === AppState.GENERATING_TTS
                          ? <span className="pixel-spinner-sm"><span className="dot" /><span className="dot" /><span className="dot" /></span>
                          : <span className="eq-mini" aria-hidden="true"><span /><span /><span /></span>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      )}
                      {appState === AppState.GENERATING_TTS ? 'Loading...' : activeAudioSource?.startsWith('input_') ? 'Playing...' : 'Play Reference'}
                    </button>
                  );
                })()}
                {/* Record — secondary text control */}
                {appState !== AppState.RECORDING ? (
                  <button onClick={startRecording} disabled={!text.trim() || appState === AppState.ANALYZING || appState === AppState.GENERATING_TTS}
                    aria-label="Record your pronunciation"
                    title="Record (R)"
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-[2px] text-[11px] font-medium uppercase tracking-[0.08em] transition-all disabled:opacity-40 min-h-[44px] hover-rose"
                    style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                    Record
                  </button>
                ) : (
                  <button onClick={() => mediaRecorderRef.current?.stop()}
                    aria-label="Stop recording"
                    title="Stop recording (R)"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-[2px] text-[11px] font-semibold uppercase tracking-[0.08em] min-h-[44px]"
                    style={{ background: 'var(--text-primary)', color: 'var(--bg)', border: 'none' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 1, background: 'var(--bg)', display: 'inline-block' }} />
                    Stop
                  </button>
                )}
                {/* Video reference links — outlined so they read as buttons; visible on all viewports (flex-wrap handles narrow screens) */}
                {text.trim() && (<>
                  <a
                    href={`https://youglish.com/pronounce/${text.trim().replace(/\s+/g, '+')}/english`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-[2px] text-[11px] font-medium uppercase tracking-[0.08em] transition-all min-h-[44px] hover-rose"
                    style={{ color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border-medium)', textDecoration: 'none' }}
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                    </svg>
                    YouGlish
                  </a>
                  <a
                    href={`https://www.playphrase.me/#/search?q=${encodeURIComponent(text.trim())}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-[2px] text-[11px] font-medium uppercase tracking-[0.08em] transition-all min-h-[44px] hover-rose"
                    style={{ color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border-medium)', textDecoration: 'none' }}
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                    </svg>
                    PlayPhrase
                  </a>
                </>)}
                {/* Replay my recording */}
                {userAudioBlob && appState !== AppState.RECORDING && (
                  <button
                    onClick={() => {
                      if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl);
                      const url = URL.createObjectURL(userAudioBlob);
                      setActiveBlobUrl(url);
                      setActiveAudioSource('user_playback');
                      const audio = new Audio(url);
                      audio.onended = () => { setActiveAudioSource(null); };
                      audio.onerror = () => { setActiveAudioSource(null); };
                      audio.play().catch(() => setActiveAudioSource(null));
                    }}
                    aria-label="Replay your recording"
                    className="flex items-center gap-1.5 px-2.5 py-2.5 rounded-[2px] text-[11px] font-medium uppercase tracking-[0.08em] transition-all min-h-[44px] hover-rose"
                    style={{ color: activeAudioSource === 'user_playback' ? 'var(--rose)' : 'var(--text-muted)', background: 'transparent' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/></svg>
                    {activeAudioSource === 'user_playback' ? 'Playing...' : 'My Voice'}
                  </button>
                )}
                {/* Speed toggle — underlined ink, like a book footnote marker */}
                <div className="flex ml-auto items-center gap-1">
                  {([{ key: 'normal', label: '1×' }, { key: 'slow', label: '0.8×' }] as const).map(({ key, label }) => (
                    <button key={key} onClick={() => setTtsSpeed(key as 'normal' | 'slow')}
                      aria-pressed={ttsSpeed === key}
                      aria-label={`Playback speed ${label}`}
                      className="px-2 py-1.5 text-xs transition-all"
                      style={ttsSpeed === key
                        ? { background: 'transparent', color: 'var(--text-primary)', fontWeight: 600, borderBottom: '2px solid var(--rose)', borderRadius: 0 }
                        : { color: 'var(--text-muted)', background: 'transparent', fontWeight: 400, borderBottom: '2px solid transparent', borderRadius: 0 }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Idle hint — a quiet footnote between hairline rules */}
              {appState === AppState.IDLE && !result && (
                <div className="mt-6 flex items-center gap-3" aria-hidden="true">
                  <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
                  <span className="font-mono" style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-placeholder)', letterSpacing: '0.18em' }}>
                    SPACE TO PLAY · R TO RECORD
                  </span>
                  <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
                </div>
              )}

              {/* Recording state: ink waveform over a rule */}
              {appState === AppState.RECORDING && (
                <div className="flex items-center gap-3 mt-4 animate-fade-in" style={{ borderTop: '1px solid var(--border)', padding: '12px 2px 2px' }}>
                  <span className="pixel-badge pixel-badge-a" style={{ fontSize: 8, padding: '2px 6px', animation: 'pixel-blink 1s steps(1) infinite' }}>REC</span>
                  <span className="font-mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>Recording…</span>
                  <div className="pixel-wave ml-auto">
                    {[0,1,2,3,4,5,6,7,8].map(n => (
                      <div key={n} className="pixel-wave-bar" style={{ background: 'var(--rose)', animationDelay: `${n * 100}ms` }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Analyzing state */}
              {appState === AppState.ANALYZING && (
                <div className="mt-4 animate-fade-in" style={{ borderTop: '1px solid var(--border)', padding: '12px 2px 2px' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="pixel-spinner">
                      <span className="dot active" /><span className="dot" />
                      <span className="dot" /><span className="dot active" />
                    </span>
                    <span className="font-mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>Analyzing…</span>
                  </div>
                  <div className="pixel-loading-bar">
                    <div className="pixel-loading-fill" />
                  </div>
                </div>
              )}
            </div>

            {/* Loading State: dot matrix over an ink rule */}
            {appState === AppState.ANALYZING && !result && (
              <div className="p-10 flex flex-col items-center gap-5 animate-fade-in-up" style={{ borderTop: '1px solid var(--text-primary)' }} role="status" aria-busy="true" aria-label="Analyzing pronunciation">
                <div className="pixel-analyze-icon">
                  {[...Array(25)].map((_, i) => {
                    const row = Math.floor(i / 5);
                    const col = i % 5;
                    const isLit = (row + col) % 2 === 0 || row === 2 || col === 2;
                    return <div key={i} className={`cell ${isLit ? 'lit' : ''}`} style={isLit ? { animationDelay: `${i * 80}ms` } : undefined} />;
                  })}
                </div>
                <div className="text-center space-y-1.5">
                  <p className="font-mono" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '0.14em' }}>ANALYZING</p>
                  <p className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>phonemes · rhythm · intonation</p>
                </div>
                <div className="pixel-loading-bar" style={{ maxWidth: 200 }}>
                  <div className="pixel-loading-fill" />
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
                hasUserRecording={!!userAudioBlob || isDemo}
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

            {/* New Session button — shown after results */}
            {result && appState === AppState.SHOWING_RESULT && (
              <button
                onClick={() => { setText(''); setResult(null); setUserAudioBlob(null); setAppState(AppState.IDLE); }}
                className="w-full py-3.5 rounded-[2px] text-[11px] font-medium uppercase tracking-[0.12em] transition-all active:scale-[0.98] animate-fade-in flex items-center justify-center gap-2 hover-rose"
                style={{ background: 'transparent', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Session
              </button>
            )}
          </main>
        </div>

        {/* Right Sidebar - History (hidden entirely when empty so the ink rule doesn't hang in space) */}
        {history.length > 0 && (
        <aside className="hidden lg:flex flex-col w-[280px] shrink-0 h-[calc(100vh-52px)] sticky top-[52px] overflow-y-auto px-4 py-5"
          style={{ background: 'transparent', borderLeft: '1px solid var(--text-primary)' }}>
          <HistoryList
            history={history}
            // Switching sentences mid-recording orphans the live MediaRecorder:
            // the Stop button disappears while it keeps recording, then its
            // onstop overwrites whatever the user moved on to. Stop first.
            onQuickAnalyze={(t) => { if (appState === AppState.RECORDING) return; setText(t); playAndAnalyze(t); }}
            onQuickRecord={(t) => { if (appState === AppState.RECORDING) return; setText(t); startRecording(); }}
            onSelect={async (t) => {
              if (appState === AppState.RECORDING) return;
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
                    lruSet(referenceCache, t, fixedResult, MAX_RESULT_CACHE);
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
            onClear={() => setShowClearConfirm(true)}
          />
        </aside>
        )}
      </div>

      {/* Mobile: floating history button */}
      {history.length > 0 && (
        <button
          onClick={() => setShowMobileHistory(true)}
          className="fixed bottom-6 right-6 z-40 lg:hidden w-12 h-12 rounded-[4px] flex items-center justify-center active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--pink)', boxShadow: '0 2px 12px rgba(17,17,16,0.18)' }}
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
      {/* IPA Legend modal */}
      <IPALegend show={showIPALegend} onClose={() => setShowIPALegend(false)} />

      {showMobileHistory && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setShowMobileHistory(false)}>
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-[2px] p-6 overflow-y-auto animate-float-up"
            style={{ backgroundColor: 'var(--bg)', borderTop: '1px solid var(--text-primary)', maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-0.5 mx-auto mb-5" style={{ backgroundColor: 'var(--border-medium)' }} />
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
              onClear={() => setShowClearConfirm(true)}
            />
          </div>
        </div>
      )}

      {/* Clear History Confirm Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowClearConfirm(false)}>
          <div className="rounded-[2px] p-6 w-full max-w-xs animate-fade-in-up"
            style={{ background: 'var(--surface)', border: '1px solid var(--text-primary)' }}
            onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Clear all history?</p>
            <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>This can't be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-[2px] text-xs font-medium uppercase tracking-[0.06em]"
                style={{ background: 'transparent', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => { setHistory([]); safeRemoveItem(CACHE_CONFIG.HISTORY_KEY); setShowClearConfirm(false); }}
                className="px-4 py-2 rounded-[2px] text-xs font-medium uppercase tracking-[0.06em]"
                style={{ background: 'var(--red)', color: '#fff' }}>Clear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
