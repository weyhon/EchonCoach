/**
 * Azure Speech Pronunciation Assessment — dedicated acoustic model scoring.
 *
 * Why Azure instead of LLM?
 * - LLM (Gemini) "guesses" pronunciation quality from audio semantics → 3-8s, can hallucinate
 * - Azure uses forced alignment + phoneme-level GOP scoring → 0.5-1.5s, deterministic
 * - Native IPA output — no ARPAbet-to-IPA mapping needed
 *
 * Flow: webm blob → WAV conversion → Azure REST API → AnalysisResult
 */

import { AnalysisResult, WordAnalysis, PhonemeDetail } from '../types';
import { convertToWav } from './audioUtils';

// ── Config ──────────────────────────────────────────────────────────

const AZURE_REGION = import.meta.env.VITE_AZURE_SPEECH_REGION || 'eastasia';
const AZURE_KEY = import.meta.env.VITE_AZURE_SPEECH_KEY || '';

// When deployed on Vercel, use the token proxy instead of exposing the key
const USE_TOKEN_PROXY = !AZURE_KEY;

// ── Token management ────────────────────────────────────────────────

let cachedToken: { token: string; region: string; expires: number } | null = null;

async function getAuthToken(): Promise<{ token: string; region: string }> {
  // Direct key mode (local dev with VITE_AZURE_SPEECH_KEY)
  if (AZURE_KEY) {
    return { token: '', region: AZURE_REGION };
  }

  // Token proxy mode (production)
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken;
  }

  const res = await fetch('/api/speech-token');
  if (!res.ok) throw new Error('Failed to get speech token');
  const data = await res.json();
  cachedToken = { ...data, expires: Date.now() + 8 * 60 * 1000 }; // cache 8 min (token lasts 10)
  return data;
}

// Common phoneme substitutions for Chinese English learners (fallback when Azure
// doesn't return NBestPhonemes). Maps target phoneme → likely mispronunciation.
const COMMON_SUBSTITUTIONS: Record<string, string> = {
  'ʃ': 's',     // sure → "soor"
  'ʒ': 'dʒ',    // measure → "medjure"
  'θ': 's',     // think → "sink"
  'ð': 'd',     // the → "de"
  'ɹ': 'l',     // red → "led"
  'v': 'w',     // very → "wery"
  'æ': 'e',     // cat → "ket"
  'ɪ': 'i',     // bit → "beat"
  'ʊ': 'u',     // book → "buke"
  'ɝ': 'ɜ',     // bird (rhotic → non-rhotic)
  'ŋ': 'n',     // sing → "sin"
};

// ── Azure Pronunciation Assessment API ──────────────────────────────

// Azure response puts scores directly on objects (not nested under PronunciationAssessment)
interface AzurePronResult {
  RecognitionStatus: string;
  DisplayText?: string;
  NBest?: Array<{
    // Scores are directly on NBest item
    AccuracyScore: number;
    FluencyScore: number;
    CompletenessScore: number;
    PronScore: number;
    // Some API versions nest under PronunciationAssessment
    PronunciationAssessment?: {
      AccuracyScore: number;
      FluencyScore: number;
      CompletenessScore: number;
      PronScore: number;
    };
    Words: Array<{
      Word: string;
      AccuracyScore: number;
      ErrorType: string;
      PronunciationAssessment?: {
        AccuracyScore: number;
        ErrorType: string;
      };
      Phonemes?: Array<{
        Phoneme: string;
        AccuracyScore?: number;
        PronunciationAssessment?: {
          AccuracyScore: number;
          NBestPhonemes?: Array<{ Phoneme: string; Score: number }>;
        };
      }>;
    }>;
  }>;
}

export async function azurePronunciationScore(
  referenceText: string,
  audioBlob: Blob,
): Promise<AnalysisResult> {
  const t0 = performance.now();

  // 1. Convert webm → WAV (Azure requires WAV)
  const wavBlob = await convertToWav(audioBlob);
  console.log(`[perf] WAV conversion: ${((performance.now() - t0)).toFixed(0)}ms, size: ${(wavBlob.size / 1024).toFixed(1)}KB`);

  // 2. Build pronunciation assessment config
  const pronConfig = btoa(JSON.stringify({
    ReferenceText: referenceText,
    GradingSystem: 'HundredMark',
    Granularity: 'Phoneme',
    Dimension: 'Comprehensive',
    EnableMiscue: true,
    PhonemeAlphabet: 'IPA',
    NBestPhonemeCount: 3, // Return top-3 alternative phonemes so we know what user actually said
  }));

  // 3. Get auth
  const { token, region } = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'audio/wav',
    'Pronunciation-Assessment': pronConfig,
    'Accept': 'application/json',
  };
  if (AZURE_KEY) {
    headers['Ocp-Apim-Subscription-Key'] = AZURE_KEY;
  } else {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 4. Call Azure Speech API
  const apiUrl = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`;

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: wavBlob,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Azure Speech API error (${res.status}): ${errText}`);
  }

  const azure: AzurePronResult = await res.json();
  console.log(`[perf] Azure pronunciation: ${((performance.now() - t0) / 1000).toFixed(1)}s total`);

  // 5. Map to AnalysisResult
  return mapAzureToAnalysisResult(azure, referenceText);
}

// ── Response mapper ─────────────────────────────────────────────────

function mapAzureToAnalysisResult(azure: AzurePronResult, referenceText: string): AnalysisResult {
  if (azure.RecognitionStatus !== 'Success' || !azure.NBest?.length) {
    return {
      score: 0,
      overallComment: 'Could not recognize speech. Please try again.',
      speechScript: referenceText,
      wordBreakdown: [],
    };
  }

  const best = azure.NBest[0];
  // Scores may be directly on best or nested under PronunciationAssessment
  const pronScore = best.PronScore ?? best.PronunciationAssessment?.PronScore ?? 0;
  const score = Math.round(pronScore);

  const wordBreakdown: WordAnalysis[] = (best.Words || []).map(w => {
    const wordScore = Math.round(w.AccuracyScore ?? w.PronunciationAssessment?.AccuracyScore ?? 0);
    const errorType = w.ErrorType ?? w.PronunciationAssessment?.ErrorType ?? 'None';

    // Map error type to status
    const status: WordAnalysis['status'] =
      errorType === 'None' && wordScore >= 80 ? 'correct'
      : errorType === 'Mispronunciation' || wordScore < 50 ? 'incorrect'
      : 'needs_improvement';

    // Build IPA strings from phonemes
    const phonemes = w.Phonemes || [];
    const correctIPA = phonemes.map(p => p.Phoneme).join('');
    const userIPA = phonemes.map(p => {
      const nBest = (p as any).NBestPhonemes ?? p.PronunciationAssessment?.NBestPhonemes;
      const pScore = p.AccuracyScore ?? p.PronunciationAssessment?.AccuracyScore ?? 0;
      // If score is low, find what user actually said
      if (pScore < 70) {
        // Skip the target phoneme — find the first *different* alternative
        const alt = nBest?.find((nb: { Phoneme: string }) => nb.Phoneme !== p.Phoneme);
        if (alt) return alt.Phoneme;
        // Fallback: common substitution for this phoneme
        const sub = COMMON_SUBSTITUTIONS[p.Phoneme];
        if (sub) return sub;
      }
      return p.Phoneme; // matched the target
    }).join('');

    // Phoneme details
    const phonemeDetails: PhonemeDetail[] = phonemes.map(p => {
      const phScore = Math.round(p.AccuracyScore ?? p.PronunciationAssessment?.AccuracyScore ?? 0);
      const nBest = (p as any).NBestPhonemes ?? p.PronunciationAssessment?.NBestPhonemes;
      let userPhoneme: string | undefined;
      if (phScore < 85) {
        // Skip the target phoneme — find the first *different* alternative
        const alt = nBest?.find((nb: { Phoneme: string }) => nb.Phoneme !== p.Phoneme);
        if (alt) {
          userPhoneme = alt.Phoneme;
        } else if (phScore < 70) {
          userPhoneme = COMMON_SUBSTITUTIONS[p.Phoneme];
        }
      }

      return {
        phoneme: p.Phoneme,
        score: phScore,
        userPhoneme,
      };
    });

    // Generate suggestion based on error type and low-scoring phonemes
    const suggestion = generateSuggestion(w.Word, errorType, phonemeDetails);

    return {
      word: w.Word,
      status,
      phoneticCorrect: correctIPA,
      phoneticUser: userIPA !== correctIPA ? userIPA : correctIPA,
      wordScore,
      phonemes: phonemeDetails.some(p => p.score < 90) ? phonemeDetails : undefined,
      suggestion,
    };
  });

  return {
    score,
    overallComment: generateOverallComment(score, wordBreakdown),
    speechScript: referenceText,
    wordBreakdown,
    // linking/prosody fields will be merged from cache or fetched async
  };
}

function generateSuggestion(word: string, errorType: string, phonemes: PhonemeDetail[]): string {
  if (errorType === 'Omission') return `You skipped "${word}" — try saying the full sentence.`;
  if (errorType === 'Insertion') return '';

  const weak = phonemes.filter(p => p.score < 70);
  if (weak.length === 0) return '';

  const worstPhoneme = weak.reduce((a, b) => a.score < b.score ? a : b);
  return `Focus on the /${worstPhoneme.phoneme}/ sound in "${word}".`;
}

function generateOverallComment(score: number, words: WordAnalysis[]): string {
  const incorrect = words.filter(w => w.status === 'incorrect');
  const needsWork = words.filter(w => w.status === 'needs_improvement');

  if (score >= 90) return 'Excellent pronunciation! Keep it up.';
  if (score >= 75) {
    const focus = [...incorrect, ...needsWork].slice(0, 2).map(w => `"${w.word}"`).join(' and ');
    return focus ? `Good job! Focus on ${focus} for even better results.` : 'Good pronunciation overall.';
  }
  if (score >= 60) {
    const focus = incorrect.slice(0, 2).map(w => `"${w.word}"`).join(' and ');
    return focus ? `Keep practicing — pay attention to ${focus}.` : 'Keep practicing — focus on clearer pronunciation.';
  }
  return 'Try speaking more slowly and clearly. Focus on one word at a time.';
}

// ── Feature detection ───────────────────────────────────────────────

/** Check if Azure Speech is configured (either direct key or proxy available) */
export function isAzureSpeechAvailable(): boolean {
  return !!AZURE_KEY || USE_TOKEN_PROXY;
}
