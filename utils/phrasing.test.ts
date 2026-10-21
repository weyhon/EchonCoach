import { describe, it, expect } from 'vitest';
import { punctuationBreaks, breaksFromPhrasing, withPauses } from './phrasing';

const S = 'Do you recommend it for someone who keeps a skeptical attitude toward medical aesthetics?';

describe('punctuationBreaks', () => {
  it('breaks after mid-sentence punctuation, never after the last word', () => {
    // Oh,(0) loads of things,(3) boxing,(4) ... you name it.(12) What about you?
    const t = 'Oh, loads of things, boxing, swimming, reading, listening music, you name it. What about you?';
    expect(punctuationBreaks(t)).toEqual([0, 3, 4, 5, 6, 8, 11]);
  });

  it('returns nothing for a sentence without inner punctuation', () => {
    expect(punctuationBreaks(S)).toEqual([]);
  });
});

describe('breaksFromPhrasing', () => {
  it('turns the model\'s slashes into "pause after word i" indices', () => {
    const p = 'Do you recommend it for someone / who keeps a skeptical attitude / toward medical aesthetics?';
    expect(breaksFromPhrasing(S, p)).toEqual([5, 10]);
  });

  it('rejects phrasing whose words differ from the sentence (the model rewrote it)', () => {
    expect(breaksFromPhrasing(S, 'Would you recommend it / to someone skeptical?')).toBeNull();
    expect(breaksFromPhrasing(S, 'Do you recommend it for someone / who keeps')).toBeNull();
  });

  it('tolerates spacing and curly-quote differences around the slashes', () => {
    const t = "You'll love it, trust me.";
    expect(breaksFromPhrasing(t, 'You’ll love it,/ trust me.')).toEqual([2]);
  });

  it('always keeps punctuation breaks even if the model missed one', () => {
    const t = 'Oh, loads of things to do here.';
    expect(breaksFromPhrasing(t, 'Oh, loads of things / to do here.')).toEqual([0, 3]);
  });

  it('ignores a slash at the very start or end', () => {
    expect(breaksFromPhrasing('Hold on a second.', '/ Hold on / a second. /')).toEqual([1]);
  });
});

describe('withPauses', () => {
  it('inserts "..." after break words that have no punctuation of their own', () => {
    expect(withPauses(S, [5, 10])).toBe(
      'Do you recommend it for someone... who keeps a skeptical attitude... toward medical aesthetics?'
    );
  });

  it('leaves existing punctuation alone — a comma already pauses', () => {
    expect(withPauses('Oh, loads of things to do.', [0, 3])).toBe('Oh, loads of things... to do.');
  });

  it('is a no-op with no breaks', () => {
    expect(withPauses(S, [])).toBe(S);
  });
});
