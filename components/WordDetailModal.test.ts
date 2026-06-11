import { describe, it, expect } from 'vitest';
import { buildMispronunciation, phonemeToSpeakable } from './WordDetailModal';
import { WordAnalysis } from '../types';

// ── buildMispronunciation ───────────────────────────────────────────

describe('buildMispronunciation', () => {
  it('returns original word when no weak phonemes', () => {
    const item: WordAnalysis = {
      word: 'hello',
      status: 'correct',
      phoneticCorrect: 'hɛloʊ',
      suggestion: '',
      phonemes: [
        { phoneme: 'h', score: 95 },
        { phoneme: 'ɛ', score: 90 },
        { phoneme: 'l', score: 88 },
        { phoneme: 'oʊ', score: 92 },
      ],
    };
    expect(buildMispronunciation(item)).toBe('hello');
  });

  it('substitutes weak /ʃ/ (score 40) and respells', () => {
    const item: WordAnalysis = {
      word: 'ship',
      status: 'incorrect',
      phoneticCorrect: 'ʃɪp',
      suggestion: '',
      phonemes: [
        { phoneme: 'ʃ', score: 40 },   // weak → maps to 's' via WRONG_SOUND
        { phoneme: 'ɪ', score: 90 },
        { phoneme: 'p', score: 85 },
      ],
    };
    const result = buildMispronunciation(item);
    // ʃ→s, then IPA_TO_SPELL: s→'s', ɪ→'ih', p→'p'  =>  'sihp'
    expect(result).toBe('sihp');
  });

  it('returns original word when no phonemes array', () => {
    const item: WordAnalysis = {
      word: 'test',
      status: 'correct',
      phoneticCorrect: 'tɛst',
      suggestion: '',
    };
    expect(buildMispronunciation(item)).toBe('test');
  });

  it('returns original word when phonemes array is empty', () => {
    const item: WordAnalysis = {
      word: 'test',
      status: 'correct',
      phoneticCorrect: 'tɛst',
      suggestion: '',
      phonemes: [],
    };
    expect(buildMispronunciation(item)).toBe('test');
  });

  it('returns original word when phoneticCorrect is empty', () => {
    const item: WordAnalysis = {
      word: 'test',
      status: 'correct',
      phoneticCorrect: '',
      suggestion: '',
      phonemes: [{ phoneme: 't', score: 40 }],
    };
    expect(buildMispronunciation(item)).toBe('test');
  });

  it('substitutes weak /θ/ and respells', () => {
    const item: WordAnalysis = {
      word: 'think',
      status: 'incorrect',
      phoneticCorrect: 'θɪŋk',
      suggestion: '',
      phonemes: [
        { phoneme: 'θ', score: 30 },   // weak → maps to 's'
        { phoneme: 'ɪ', score: 90 },
        { phoneme: 'ŋ', score: 85 },
        { phoneme: 'k', score: 92 },
      ],
    };
    const result = buildMispronunciation(item);
    // θ→s, then IPA_TO_SPELL: s→'s', ɪ→'ih', ŋ→'ng', k→'k'  =>  'sihngk'
    expect(result).toBe('sihngk');
  });
});

// ── phonemeToSpeakable ──────────────────────────────────────────────

describe('phonemeToSpeakable', () => {
  it('maps ʃ to "sh"', () => {
    expect(phonemeToSpeakable('ʃ')).toBe('sh');
  });

  it('maps θ to "th"', () => {
    expect(phonemeToSpeakable('θ')).toBe('th');
  });

  it('maps oʊ to "oh"', () => {
    expect(phonemeToSpeakable('oʊ')).toBe('oh');
  });

  it('maps ɹ to "r"', () => {
    expect(phonemeToSpeakable('ɹ')).toBe('r');
  });

  it('maps ɪ to "ih"', () => {
    expect(phonemeToSpeakable('ɪ')).toBe('ih');
  });

  it('passes through unknown phonemes', () => {
    expect(phonemeToSpeakable('xyz')).toBe('xyz');
  });
});
