import { describe, it, expect } from 'vitest';
import { parseWordDefinition } from './geminiService';

describe('parseWordDefinition', () => {
  it('parses plain JSON content', () => {
    const r = parseWordDefinition('{"ipa":"/ˈgoʊɪŋ/","meaning":"（进展）进行"}');
    expect(r).toEqual({ ipa: '/ˈgoʊɪŋ/', meaning: '（进展）进行' });
  });

  it('strips markdown code fences before parsing', () => {
    const r = parseWordDefinition('```json\n{"ipa":"/ɪt/","meaning":"它"}\n```');
    expect(r).toEqual({ ipa: '/ɪt/', meaning: '它' });
  });

  it('wraps bare ipa in slashes', () => {
    const r = parseWordDefinition('{"ipa":"ˈgoʊɪŋ","meaning":"进行"}');
    expect(r?.ipa).toBe('/ˈgoʊɪŋ/');
  });

  it('returns null when content is not JSON', () => {
    expect(parseWordDefinition('sorry, I cannot help')).toBeNull();
  });

  it('returns null when meaning is missing', () => {
    expect(parseWordDefinition('{"ipa":"/ɪt/"}')).toBeNull();
  });

  it('tolerates missing ipa (meaning-only result)', () => {
    expect(parseWordDefinition('{"meaning":"它"}')).toEqual({ ipa: '', meaning: '它' });
  });
});
