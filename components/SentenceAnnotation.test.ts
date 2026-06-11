import { describe, it, expect } from 'vitest';
import { getPitchValues, buildAnnotationWords } from './SentenceAnnotation';

// ── getPitchValues ──────────────────────────────────────────────────

describe('getPitchValues', () => {
  it('statement: last word has lowest pitch', () => {
    const values = getPitchValues('I am fine.');
    expect(values).toHaveLength(3);
    // Last word should be low (statement falls at end)
    const last = values[values.length - 1];
    expect(last).toBeLessThan(0.3);
    // First content word should be higher than last
    expect(values[0]).toBeGreaterThan(last);
  });

  it('statement: pitch generally descends', () => {
    const values = getPitchValues('The weather is nice today.');
    expect(values).toHaveLength(5);
    // Last word should be the lowest
    const last = values[values.length - 1];
    for (let i = 0; i < values.length - 1; i++) {
      // Not strictly descending per word, but last should be min
      expect(last).toBeLessThanOrEqual(values[i]);
    }
  });

  it('yes/no question: last word has high pitch (~0.9)', () => {
    const values = getPitchValues('Are you ready?');
    expect(values).toHaveLength(3);
    const last = values[values.length - 1];
    expect(last).toBeCloseTo(0.9, 1);
  });

  it('wh-question: first word high, last word low', () => {
    const values = getPitchValues('What is your name?');
    expect(values).toHaveLength(4);
    // First word (wh-word) should be high
    expect(values[0]).toBeGreaterThan(0.7);
    // Last word should be low
    const last = values[values.length - 1];
    expect(last).toBeLessThanOrEqual(0.2);
  });

  it('returns single value for empty/whitespace string (split produces one empty token)', () => {
    // ''.trim().split(/\s+/) produces [''], so getPitchValues returns [value] not []
    const emptyResult = getPitchValues('');
    expect(emptyResult).toHaveLength(1);
    const spaceResult = getPitchValues('   ');
    expect(spaceResult).toHaveLength(1);
  });

  it('single word returns a value', () => {
    const values = getPitchValues('Hello');
    expect(values).toHaveLength(1);
    expect(values[0]).toBeGreaterThan(0);
    expect(values[0]).toBeLessThan(1);
  });
});

// ── buildAnnotationWords ────────────────────────────────────────────

describe('buildAnnotationWords', () => {
  it('detects stress: content words stressed, function words unstressed', () => {
    const words = buildAnnotationWords('I love you', undefined);
    expect(words).toHaveLength(3);
    // "I" is a function word → not stressed
    expect(words[0].isStressed).toBe(false);
    // "love" is a content word → stressed
    expect(words[1].isStressed).toBe(true);
    // "you" is a function word → not stressed
    expect(words[2].isStressed).toBe(false);
  });

  it('detects linking between consonant-ending and vowel-starting words', () => {
    const words = buildAnnotationWords('turn on', undefined);
    expect(words).toHaveLength(2);
    // "turn" ends with consonant, "on" starts with vowel → link
    expect(words[0].linksToNext).toBe(true);
  });

  it('no linking between vowel-ending and consonant-starting words', () => {
    const words = buildAnnotationWords('the cat', undefined);
    expect(words).toHaveLength(2);
    // "the" → "cat": shouldLink depends on consonant + vowel rule
    // "the" ends with vowel sound? Actually "the" is in CONSONANT_ENDING_WORDS (ð).
    // "cat" starts with consonant. So no link.
    expect(words[0].linksToNext).toBe(false);
  });

  it('returns empty array for empty string', () => {
    expect(buildAnnotationWords('', undefined)).toEqual([]);
    expect(buildAnnotationWords('   ', undefined)).toEqual([]);
  });

  it('assigns intonation to last word of yes/no question', () => {
    const words = buildAnnotationWords('Do you agree?', undefined);
    const last = words[words.length - 1];
    expect(last.intonation).toBe('↗');
  });

  it('assigns falling intonation to last word of statement', () => {
    const words = buildAnnotationWords('I am happy.', undefined);
    const last = words[words.length - 1];
    expect(last.intonation).toBe('↘');
  });

  it('assigns falling intonation to last word of wh-question', () => {
    const words = buildAnnotationWords('Where are you?', undefined);
    const last = words[words.length - 1];
    expect(last.intonation).toBe('↘');
  });

  it('merges word breakdown status when provided', () => {
    const breakdown = [
      { word: 'hi', status: 'correct' as const, phoneticCorrect: 'haɪ', wordScore: 95, suggestion: '' },
    ];
    const words = buildAnnotationWords('hi', breakdown);
    expect(words[0].status).toBe('correct');
    expect(words[0].ipa).toBe('haɪ');
  });
});
