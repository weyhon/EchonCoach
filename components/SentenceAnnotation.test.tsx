import { describe, it, expect } from 'vitest';
import { buildAnnotationWords } from './SentenceAnnotation';

describe('buildAnnotationWords', () => {
  it('marks content words as stressed', () => {
    const words = buildAnnotationWords('pick up luggage', undefined);
    expect(words[0].isStressed).toBe(true);  // pick — content word
    expect(words[1].isStressed).toBe(false); // up — function word
    expect(words[2].isStressed).toBe(true);  // luggage — content word
  });

  it('marks linking between consonant-ending and vowel-starting words', () => {
    const words = buildAnnotationWords('pick up', undefined);
    expect(words[0].linksToNext).toBe(true); // pick‿up
  });

  it('adds intonation marker to last word only', () => {
    const words = buildAnnotationWords('do you like it', undefined);
    const last = words[words.length - 1];
    expect(last.intonation).toBe('↘'); // statement
    words.slice(0, -1).forEach(w => expect(w.intonation).toBeUndefined());
  });

  it('includes ipa from wordBreakdown when provided', () => {
    const breakdown = [{ word: 'pick', phoneticCorrect: 'pɪk', status: 'correct', suggestion: '' }] as any;
    const words = buildAnnotationWords('pick', breakdown);
    expect(words[0].ipa).toBe('pɪk');
  });
});
