import { describe, it, expect } from 'vitest';
import { withTranslationFrom } from './mergeResult';
import { AnalysisResult } from '../types';

const scored = (over: Partial<AnalysisResult> = {}): AnalysisResult => ({
  score: 82,
  overallComment: '',
  speechScript: 'Oh, loads of things.',
  wordBreakdown: [],
  ...over,
});

describe('withTranslationFrom', () => {
  it('backfills even when the result HAS its own linking data (the reported bug)', () => {
    // The old gate was `!res.fullLinkedSentence`, so this exact case — a scored
    // recording that carried its own linking data — lost the translation.
    const res = scored({ fullLinkedSentence: 'Oh,‿loads of things.', fullLinkedPhonetic: 'oʊ loʊdz əv θɪŋz' });
    const out = withTranslationFrom(res, { translation: '噢，很多东西。' });
    expect(out.translation).toBe('噢，很多东西。');
  });

  it('backfills when the result has no linking data either', () => {
    const out = withTranslationFrom(scored(), { translation: '噢，很多东西。' });
    expect(out.translation).toBe('噢，很多东西。');
  });

  it('never overwrites a translation the result already carries', () => {
    const res = scored({ translation: '结果自带的译文' });
    const out = withTranslationFrom(res, { translation: '缓存里的译文' });
    expect(out.translation).toBe('结果自带的译文');
  });

  it('is a no-op when the cache has nothing to give', () => {
    const res = scored({ fullLinkedSentence: 'x' });
    expect(withTranslationFrom(res, null)).toBe(res);
    expect(withTranslationFrom(res, undefined)).toBe(res);
    expect(withTranslationFrom(res, { translation: '' })).toBe(res);
  });

  it('does not mutate the result it was given', () => {
    const res = scored();
    withTranslationFrom(res, { translation: '译文' });
    expect(res.translation).toBeUndefined();
  });
});
