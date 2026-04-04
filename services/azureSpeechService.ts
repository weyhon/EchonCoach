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

// ── Azure Pronunciation Assessment API ──────────────────────────────

interface AzurePronResult {
  RecognitionStatus: string;
  DisplayText?: string;
  NBest?: Array<{
    PronunciationAssessment: {
      AccuracyScore: number;
      FluencyScore: number;
      CompletenessScore: number;
      PronScore: number;
    };
    Words: Array<{
      Word: string;
      PronunciationAssessment: {
        AccuracyScore: number;
        ErrorType: string; // None, Omission, Insertion, Mispronunciation
      };
      Phonemes: Array<{
        Phoneme: string; // IPA when PhonemeAlphabet=IPA
        PronunciationAssessment: {
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
  const score = Math.round(best.PronunciationAssessment.PronScore);

  const wordBreakdown: WordAnalysis[] = best.Words.map(w => {
    const wordScore = Math.round(w.PronunciationAssessment.AccuracyScore);
    const errorType = w.PronunciationAssessment.ErrorType;

    // Map error type to status
    const status: WordAnalysis['status'] =
      errorType === 'None' && wordScore >= 80 ? 'correct'
      : errorType === 'Mispronunciation' || wordScore < 50 ? 'incorrect'
      : 'needs_improvement';

    // Build IPA strings from phonemes
    const correctIPA = w.Phonemes.map(p => p.Phoneme).join('');
    const userIPA = w.Phonemes.map(p => {
      const nBest = p.PronunciationAssessment.NBestPhonemes;
      // If score is low and there's an alternative phoneme, use that
      if (p.PronunciationAssessment.AccuracyScore < 70 && nBest && nBest.length > 1) {
        return nBest[0].Phoneme; // top candidate is what user most likely produced
      }
      return p.Phoneme; // matched the target
    }).join('');

    // Phoneme details
    const phonemes: PhonemeDetail[] = w.Phonemes.map(p => {
      const phScore = Math.round(p.PronunciationAssessment.AccuracyScore);
      const nBest = p.PronunciationAssessment.NBestPhonemes;
      const userPhoneme = phScore < 85 && nBest && nBest.length > 1
        ? nBest[0].Phoneme
        : undefined;

      return {
        phoneme: p.Phoneme,
        score: phScore,
        userPhoneme,
      };
    });

    // Generate suggestion based on error type and low-scoring phonemes
    const suggestion = generateSuggestion(w.Word, errorType, phonemes);

    return {
      word: w.Word,
      status,
      phoneticCorrect: correctIPA,
      phoneticUser: userIPA !== correctIPA ? userIPA : correctIPA,
      wordScore,
      phonemes: phonemes.some(p => p.score < 90) ? phonemes : undefined,
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
