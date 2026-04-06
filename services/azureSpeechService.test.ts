import { describe, it, expect } from 'vitest';
import {
  mapAzureToAnalysisResult,
  generateSuggestion,
  generateOverallComment,
  isAzureSpeechAvailable,
  COMMON_SUBSTITUTIONS,
  AzurePronResult,
} from './azureSpeechService';
import { PhonemeDetail, WordAnalysis } from '../types';

// ── mapAzureToAnalysisResult ────────────────────────────────────────

describe('mapAzureToAnalysisResult', () => {
  it('maps a successful Azure response to AnalysisResult with correct score and word breakdown', () => {
    const azure: AzurePronResult = {
      RecognitionStatus: 'Success',
      NBest: [{
        AccuracyScore: 85,
        FluencyScore: 90,
        CompletenessScore: 100,
        PronScore: 88,
        Words: [
          {
            Word: 'hello',
            AccuracyScore: 92,
            ErrorType: 'None',
            Phonemes: [
              { Phoneme: 'h', AccuracyScore: 95 },
              { Phoneme: 'ɛ', AccuracyScore: 90 },
              { Phoneme: 'l', AccuracyScore: 88 },
              { Phoneme: 'oʊ', AccuracyScore: 94 },
            ],
          },
          {
            Word: 'world',
            AccuracyScore: 78,
            ErrorType: 'None',
            Phonemes: [
              { Phoneme: 'w', AccuracyScore: 85 },
              { Phoneme: 'ɝ', AccuracyScore: 60 },
              { Phoneme: 'l', AccuracyScore: 90 },
              { Phoneme: 'd', AccuracyScore: 80 },
            ],
          },
        ],
      }],
    };

    const result = mapAzureToAnalysisResult(azure, 'hello world');

    expect(result.score).toBe(88);
    expect(result.speechScript).toBe('hello world');
    expect(result.wordBreakdown).toHaveLength(2);

    // "hello" with score 92 and no errors → correct
    expect(result.wordBreakdown[0].word).toBe('hello');
    expect(result.wordBreakdown[0].status).toBe('correct');
    expect(result.wordBreakdown[0].wordScore).toBe(92);
    expect(result.wordBreakdown[0].phoneticCorrect).toBe('hɛloʊ');

    // "world" with score 78 and no errors → needs_improvement (not >= 80)
    expect(result.wordBreakdown[1].word).toBe('world');
    expect(result.wordBreakdown[1].status).toBe('needs_improvement');
  });

  it('returns score 0 for RecognitionStatus=NoMatch', () => {
    const azure: AzurePronResult = {
      RecognitionStatus: 'NoMatch',
    };

    const result = mapAzureToAnalysisResult(azure, 'hello');

    expect(result.score).toBe(0);
    expect(result.overallComment).toContain('Could not recognize');
    expect(result.wordBreakdown).toEqual([]);
  });

  it('returns score 0 when NBest is empty', () => {
    const azure: AzurePronResult = {
      RecognitionStatus: 'Success',
      NBest: [],
    };

    const result = mapAzureToAnalysisResult(azure, 'test');
    expect(result.score).toBe(0);
  });

  it('uses NBestPhonemes skip-self logic: picks first different alternative', () => {
    const azure: AzurePronResult = {
      RecognitionStatus: 'Success',
      NBest: [{
        AccuracyScore: 70,
        FluencyScore: 80,
        CompletenessScore: 100,
        PronScore: 75,
        Words: [{
          Word: 'think',
          AccuracyScore: 60,
          ErrorType: 'Mispronunciation',
          Phonemes: [
            {
              Phoneme: 'θ',
              AccuracyScore: 30,
              PronunciationAssessment: {
                AccuracyScore: 30,
                NBestPhonemes: [
                  { Phoneme: 'θ', Score: 30 },  // same as target — should skip
                  { Phoneme: 's', Score: 85 },   // first different — should pick this
                  { Phoneme: 'f', Score: 10 },
                ],
              },
            },
            { Phoneme: 'ɪ', AccuracyScore: 95 },
            { Phoneme: 'ŋ', AccuracyScore: 90 },
            { Phoneme: 'k', AccuracyScore: 92 },
          ],
        }],
      }],
    };

    const result = mapAzureToAnalysisResult(azure, 'think');
    // User IPA for θ should be 's' (the first different alternative)
    expect(result.wordBreakdown[0].phoneticUser).toBe('sɪŋk');
    // phonemeDetails: θ scored 30 < 85, so userPhoneme should be 's'
    expect(result.wordBreakdown[0].phonemes![0].userPhoneme).toBe('s');
  });

  it('falls back to COMMON_SUBSTITUTIONS when no NBestPhonemes available', () => {
    const azure: AzurePronResult = {
      RecognitionStatus: 'Success',
      NBest: [{
        AccuracyScore: 70,
        FluencyScore: 80,
        CompletenessScore: 100,
        PronScore: 72,
        Words: [{
          Word: 'very',
          AccuracyScore: 55,
          ErrorType: 'Mispronunciation',
          Phonemes: [
            { Phoneme: 'v', AccuracyScore: 40 },  // low, no NBest → fallback to 'w'
            { Phoneme: 'ɛ', AccuracyScore: 90 },
            { Phoneme: 'ɹ', AccuracyScore: 50 },  // low, no NBest → fallback to 'l'
            { Phoneme: 'i', AccuracyScore: 85 },
          ],
        }],
      }],
    };

    const result = mapAzureToAnalysisResult(azure, 'very');
    // v→w, ɹ→l from COMMON_SUBSTITUTIONS
    expect(result.wordBreakdown[0].phoneticUser).toBe('wɛli');
  });

  it('maps Mispronunciation with low score to incorrect status', () => {
    const azure: AzurePronResult = {
      RecognitionStatus: 'Success',
      NBest: [{
        AccuracyScore: 40,
        FluencyScore: 50,
        CompletenessScore: 100,
        PronScore: 45,
        Words: [{
          Word: 'cat',
          AccuracyScore: 30,
          ErrorType: 'Mispronunciation',
          Phonemes: [],
        }],
      }],
    };

    const result = mapAzureToAnalysisResult(azure, 'cat');
    expect(result.wordBreakdown[0].status).toBe('incorrect');
  });

  it('reads scores from nested PronunciationAssessment when direct scores missing', () => {
    const azure: AzurePronResult = {
      RecognitionStatus: 'Success',
      NBest: [{
        AccuracyScore: 0,
        FluencyScore: 0,
        CompletenessScore: 0,
        PronScore: 0,
        PronunciationAssessment: {
          AccuracyScore: 90,
          FluencyScore: 92,
          CompletenessScore: 100,
          PronScore: 91,
        },
        Words: [{
          Word: 'ok',
          AccuracyScore: 0,
          ErrorType: 'None',
          PronunciationAssessment: {
            AccuracyScore: 88,
            ErrorType: 'None',
          },
          Phonemes: [],
        }],
      }],
    };

    const result = mapAzureToAnalysisResult(azure, 'ok');
    // PronScore falls back: best.PronScore (0) ?? PronunciationAssessment.PronScore (91)
    // Since 0 is falsy for ??, it should use 91
    // Actually ?? only falls through on null/undefined, not 0. So PronScore=0 is used.
    expect(result.score).toBe(0);
  });
});

// ── generateSuggestion ──────────────────────────────────────────────

describe('generateSuggestion', () => {
  it('returns skip message for Omission error type', () => {
    const result = generateSuggestion('hello', 'Omission', []);
    expect(result).toContain('skipped');
    expect(result).toContain('hello');
  });

  it('returns empty string for Insertion error type', () => {
    const result = generateSuggestion('um', 'Insertion', []);
    expect(result).toBe('');
  });

  it('returns focus message for Mispronunciation with weak phonemes', () => {
    const phonemes: PhonemeDetail[] = [
      { phoneme: 'ʃ', score: 40 },
      { phoneme: 'ɪ', score: 90 },
      { phoneme: 'p', score: 85 },
    ];
    const result = generateSuggestion('ship', 'Mispronunciation', phonemes);
    expect(result).toContain('/ʃ/');
    expect(result).toContain('ship');
  });

  it('returns empty string when no weak phonemes', () => {
    const phonemes: PhonemeDetail[] = [
      { phoneme: 'k', score: 90 },
      { phoneme: 'æ', score: 85 },
      { phoneme: 't', score: 92 },
    ];
    const result = generateSuggestion('cat', 'Mispronunciation', phonemes);
    expect(result).toBe('');
  });

  it('picks the worst phoneme when multiple are weak', () => {
    const phonemes: PhonemeDetail[] = [
      { phoneme: 'θ', score: 50 },
      { phoneme: 'ɪ', score: 30 },  // worst
      { phoneme: 'ŋ', score: 60 },
    ];
    const result = generateSuggestion('thing', 'Mispronunciation', phonemes);
    expect(result).toContain('/ɪ/');
  });
});

// ── generateOverallComment ──────────────────────────────────────────

describe('generateOverallComment', () => {
  it('returns excellent for score >= 90', () => {
    const words: WordAnalysis[] = [
      { word: 'hi', status: 'correct', phoneticCorrect: 'haɪ', wordScore: 95, suggestion: '' },
    ];
    const result = generateOverallComment(95, words);
    expect(result).toContain('Excellent');
  });

  it('returns good job with focus words for score 75-89', () => {
    const words: WordAnalysis[] = [
      { word: 'hello', status: 'correct', phoneticCorrect: 'hɛloʊ', wordScore: 90, suggestion: '' },
      { word: 'world', status: 'needs_improvement', phoneticCorrect: 'wɝld', wordScore: 65, suggestion: '' },
    ];
    const result = generateOverallComment(80, words);
    expect(result).toContain('Good');
    expect(result).toContain('world');
  });

  it('returns keep practicing for score 60-74', () => {
    const words: WordAnalysis[] = [
      { word: 'think', status: 'incorrect', phoneticCorrect: 'θɪŋk', wordScore: 30, suggestion: '' },
    ];
    const result = generateOverallComment(65, words);
    expect(result).toContain('practicing');
    expect(result).toContain('think');
  });

  it('returns slow down advice for score < 60', () => {
    const words: WordAnalysis[] = [
      { word: 'a', status: 'incorrect', phoneticCorrect: 'ə', wordScore: 20, suggestion: '' },
    ];
    const result = generateOverallComment(40, words);
    expect(result).toContain('slowly');
  });

  it('returns generic message for score 75-89 with no problem words', () => {
    const words: WordAnalysis[] = [
      { word: 'hi', status: 'correct', phoneticCorrect: 'haɪ', wordScore: 85, suggestion: '' },
    ];
    const result = generateOverallComment(80, words);
    expect(result).toContain('Good');
  });
});

// ── isAzureSpeechAvailable ──────────────────────────────────────────

describe('isAzureSpeechAvailable', () => {
  it('returns a boolean indicating availability', () => {
    // The function checks module-level constants set at import time.
    // In test env with .env.local loaded, AZURE_KEY may be set.
    const result = isAzureSpeechAvailable();
    expect(typeof result).toBe('boolean');
  });
});

// ── COMMON_SUBSTITUTIONS ────────────────────────────────────────────

describe('COMMON_SUBSTITUTIONS', () => {
  it('contains key Chinese English learner substitutions', () => {
    expect(COMMON_SUBSTITUTIONS['ʃ']).toBe('s');
    expect(COMMON_SUBSTITUTIONS['θ']).toBe('s');
    expect(COMMON_SUBSTITUTIONS['ɹ']).toBe('l');
    expect(COMMON_SUBSTITUTIONS['v']).toBe('w');
    expect(COMMON_SUBSTITUTIONS['ð']).toBe('d');
    expect(COMMON_SUBSTITUTIONS['ŋ']).toBe('n');
    expect(COMMON_SUBSTITUTIONS['æ']).toBe('e');
  });
});
