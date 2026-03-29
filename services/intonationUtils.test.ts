import { describe, it, expect } from 'vitest';
import {
  generateIntonationMap,
  generateIntonationTokens,
  validateIntonationMap,
  ensureValidIntonationMap,
} from './intonationUtils';

describe('generateIntonationMap', () => {
  it('marks function words as unstressed and content words as stressed', () => {
    const result = generateIntonationMap('I like cats.');
    const tokens = result.split(' ');
    expect(tokens[0]).toBe('·');  // I = function word
    expect(tokens[1]).toBe('●');  // like = content word
  });

  it('adds falling intonation to last word of statements', () => {
    const result = generateIntonationMap('I like cats.');
    expect(result).toContain('↘');
    expect(result.endsWith('↘')).toBe(true);
  });

  it('adds rising intonation for yes/no questions', () => {
    const result = generateIntonationMap('Do you like it?');
    expect(result).toContain('↗');
  });

  it('adds falling intonation for wh-questions', () => {
    const result = generateIntonationMap('What time is it?');
    expect(result).toContain('↘');
  });

  it('handles empty input by returning a single token', () => {
    // empty string splits to [''] (length 1), so generates one token
    const result = generateIntonationMap('');
    expect(result.length).toBeGreaterThan(0);
  });

  it('token count matches word count', () => {
    const text = 'How are you doing today';
    const result = generateIntonationMap(text);
    const tokens = result.split(' ');
    expect(tokens.length).toBe(5);
  });
});

describe('generateIntonationTokens', () => {
  it('returns array of tokens', () => {
    const tokens = generateIntonationTokens('How are you?');
    expect(Array.isArray(tokens)).toBe(true);
    expect(tokens.length).toBe(3);
  });
});

describe('validateIntonationMap', () => {
  it('returns true for matching token count', () => {
    expect(validateIntonationMap('· · ●↘', 3)).toBe(true);
  });

  it('returns false for mismatched token count', () => {
    expect(validateIntonationMap('· ·', 3)).toBe(false);
  });

  it('returns false for empty map', () => {
    expect(validateIntonationMap('', 3)).toBe(false);
  });
});

describe('ensureValidIntonationMap', () => {
  it('returns provided map if valid', () => {
    const map = '· ● ·↘';
    expect(ensureValidIntonationMap('I like cats.', map)).toBe(map);
  });

  it('regenerates map if provided is invalid', () => {
    const result = ensureValidIntonationMap('I like cats.', '· ·');
    const tokens = result.split(' ');
    expect(tokens.length).toBe(3);
  });

  it('regenerates map if undefined', () => {
    const result = ensureValidIntonationMap('I like cats.', undefined);
    const tokens = result.split(' ');
    expect(tokens.length).toBe(3);
  });
});
