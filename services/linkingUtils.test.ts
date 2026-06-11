import { describe, it, expect } from 'vitest';
import {
  endsWithConsonantSound,
  startsWithVowelSound,
  shouldLink,
  createLinkedSentence,
  isFunctionWord,
  isWhQuestion,
  isYesNoQuestion,
  getSentenceIntonation,
  getHDroppedForm,
  sameConsonantMerge,
  enrichLinkedSentence,
} from './linkingUtils';

describe('endsWithConsonantSound', () => {
  it('returns true for regular consonant endings', () => {
    expect(endsWithConsonantSound('pick')).toBe(true);
    expect(endsWithConsonantSound('turn')).toBe(true);
    expect(endsWithConsonantSound('tell')).toBe(true);
  });

  it('returns true for special pronunciation words (vowel letter, consonant sound)', () => {
    expect(endsWithConsonantSound('have')).toBe(true);
    expect(endsWithConsonantSound('the')).toBe(true);
    expect(endsWithConsonantSound('are')).toBe(true);
    expect(endsWithConsonantSound('use')).toBe(true);
  });

  it('returns false for vowel-ending words', () => {
    expect(endsWithConsonantSound('go')).toBe(false);
    expect(endsWithConsonantSound('see')).toBe(false);
  });

  it('handles empty input', () => {
    expect(endsWithConsonantSound('')).toBe(false);
  });
});

describe('startsWithVowelSound', () => {
  it('returns true for vowel-starting words', () => {
    expect(startsWithVowelSound('apple')).toBe(true);
    expect(startsWithVowelSound('it')).toBe(true);
    expect(startsWithVowelSound('up')).toBe(true);
  });

  it('returns true for h-dropping words in connected speech', () => {
    expect(startsWithVowelSound('him', true)).toBe(true);
    expect(startsWithVowelSound('her', true)).toBe(true);
    expect(startsWithVowelSound('have', true)).toBe(true);
  });

  it('returns false for h-dropping words at sentence start', () => {
    expect(startsWithVowelSound('him', false)).toBe(false);
  });

  it('returns false for consonant-starting words', () => {
    expect(startsWithVowelSound('cat')).toBe(false);
  });
});

describe('shouldLink', () => {
  it('links consonant-ending to vowel-starting', () => {
    expect(shouldLink('pick', 'it')).toBe(true);
    expect(shouldLink('turn', 'on')).toBe(true);
  });

  it('links with h-dropping', () => {
    expect(shouldLink('tell', 'him')).toBe(true);
    expect(shouldLink('ask', 'her')).toBe(true);
  });

  it('does not link consonant to consonant', () => {
    expect(shouldLink('good', 'day')).toBe(false);
  });

  it('handles empty inputs', () => {
    expect(shouldLink('', 'test')).toBe(false);
    expect(shouldLink('test', '')).toBe(false);
  });
});

describe('createLinkedSentence', () => {
  it('creates linked sentences', () => {
    expect(createLinkedSentence('pick it up')).toBe('pick‿it‿up');
    expect(createLinkedSentence('turn on')).toBe('turn‿on');
  });

  it('does not link where inappropriate', () => {
    expect(createLinkedSentence('good day')).toBe('good day');
  });
});

describe('isFunctionWord', () => {
  it('identifies function words', () => {
    expect(isFunctionWord('the')).toBe(true);
    expect(isFunctionWord('is')).toBe(true);
    expect(isFunctionWord('can')).toBe(true);
  });

  it('rejects content words', () => {
    expect(isFunctionWord('cat')).toBe(false);
    expect(isFunctionWord('happy')).toBe(false);
  });
});

describe('getSentenceIntonation', () => {
  it('returns falling for statements', () => {
    expect(getSentenceIntonation('I like cats.')).toBe('↘');
  });

  it('returns falling for wh-questions', () => {
    expect(getSentenceIntonation('What time is it?')).toBe('↘');
  });

  it('returns rising for yes/no questions', () => {
    expect(getSentenceIntonation('Do you like cats?')).toBe('↗');
    expect(getSentenceIntonation('Is it ready?')).toBe('↗');
  });
});

describe('getHDroppedForm', () => {
  it('drops h for common function words', () => {
    expect(getHDroppedForm('him')).toBe("'im");
    expect(getHDroppedForm('her')).toBe("'er");
  });

  it('keeps non-h-dropping words unchanged', () => {
    expect(getHDroppedForm('house')).toBe('house');
  });
});

describe('sameConsonantMerge', () => {
  it('detects same-consonant boundaries (gemination)', () => {
    expect(sameConsonantMerge('out', 'tonight')).toBe(true);   // t + t
    expect(sameConsonantMerge('what', 'time')).toBe(true);     // t + t
    expect(sameConsonantMerge('this', 'side')).toBe(true);     // s + s
  });

  it('rejects different-consonant boundaries', () => {
    expect(sameConsonantMerge('at', 'that')).toBe(false);      // t + ð
    expect(sameConsonantMerge('big', 'time')).toBe(false);     // g + t
  });

  it('rejects consonant + vowel boundaries (handled by C+V rule, not merge)', () => {
    expect(sameConsonantMerge('tell', 'us')).toBe(false);
    expect(sameConsonantMerge('hanging', 'out')).toBe(false);
  });

  it('handles empty input', () => {
    expect(sameConsonantMerge('', 'tonight')).toBe(false);
    expect(sameConsonantMerge('out', '')).toBe(false);
  });
});

describe('enrichLinkedSentence', () => {
  it('adds missing ‿ at same-consonant boundaries the LLM forgot', () => {
    expect(enrichLinkedSentence('hanging‿out tonight')).toBe('hanging‿out‿tonight');
  });

  it('keeps existing ‿ marks untouched', () => {
    const input = 'hanging‿out‿tonight';
    expect(enrichLinkedSentence(input)).toBe(input);
  });

  it('does not link across clause punctuation', () => {
    // "tonight? at" — sentence boundary, must NOT merge despite t+t... wait t/æ.
    // Use a t+t pair with punctuation: "out, tonight" style
    expect(enrichLinkedSentence('I went out, tonight was fun')).toBe('I went out, tonight was fun');
  });

  it('leaves single-word sentences alone', () => {
    expect(enrichLinkedSentence('hello')).toBe('hello');
  });

  it('does not force C+V links (left to the LLM)', () => {
    // "tell us" is C+V — enrich must NOT add it (narrow scope: same-consonant only)
    expect(enrichLinkedSentence('tell us')).toBe('tell us');
  });
});
