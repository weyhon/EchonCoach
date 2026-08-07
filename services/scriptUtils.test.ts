import { describe, it, expect } from 'vitest';
import { containsNonEnglishScript } from './scriptUtils';

describe('containsNonEnglishScript', () => {
  it('flags Chinese — the reported case that rendered as IPA', () => {
    expect(containsNonEnglishScript('今天天气真好，我们去公园吧。')).toBe(true);
  });

  it('flags Japanese, Korean, Cyrillic, Arabic', () => {
    expect(containsNonEnglishScript('こんにちは')).toBe(true);
    expect(containsNonEnglishScript('안녕하세요')).toBe(true);
    expect(containsNonEnglishScript('Привет')).toBe(true);
    expect(containsNonEnglishScript('مرحبا')).toBe(true);
  });

  it('flags a sentence that is mostly English but has CJK in it', () => {
    expect(containsNonEnglishScript('How do you say 你好 in English?')).toBe(true);
  });

  it('flags fullwidth punctuation pasted from a Chinese editor', () => {
    expect(containsNonEnglishScript('Hello，world')).toBe(true);
  });

  it('passes ordinary English, including punctuation and numbers', () => {
    expect(containsNonEnglishScript('How is it going?')).toBe(false);
    expect(containsNonEnglishScript("Let's meet at 8:30 — don't be late!")).toBe(false);
    expect(containsNonEnglishScript('')).toBe(false);
  });

  it('passes Latin-1 accents that appear in English loanwords', () => {
    expect(containsNonEnglishScript('We went to a café in Zürich.')).toBe(false);
    expect(containsNonEnglishScript('That was naïve of me.')).toBe(false);
  });

  it('passes the app’s own IPA and annotation glyphs', () => {
    expect(containsNonEnglishScript('haʊ‿ɪz ɪt ˈɡoʊɪŋ')).toBe(false);
    expect(containsNonEnglishScript('● · ↗ ↘')).toBe(false);
  });
});
