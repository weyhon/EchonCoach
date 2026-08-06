import { describe, it, expect } from 'vitest';
import {
  getWordPhonetic,
  isPhoneticComplete,
  validateLinkedPhonetic,
  generateFallbackPhonetic,
  fixCommonPhoneticErrors,
} from './phoneticUtils';

// ── isPhoneticComplete: the validator that previously false-positived ───

describe('isPhoneticComplete — denylist accepts valid ASCII IPA', () => {
  it('accepts very short ASCII IPA segments (< 4 chars)', () => {
    // These all hit the short-circuit by length and should pass
    expect(isPhoneticComplete('two', 'tu')).toBe(true);
    expect(isPhoneticComplete('really', 'ri li')).toBe(true);
    expect(isPhoneticComplete('he', 'hi')).toBe(true);
    expect(isPhoneticComplete('true', 'tru')).toBe(true);
    expect(isPhoneticComplete('news', 'nuz')).toBe(true);
  });

  it('accepts longer ASCII IPA with no English-only signals', () => {
    expect(isPhoneticComplete('really', 'rili')).toBe(true); // 4 chars, no [acqxyeo], no English digraphs
    expect(isPhoneticComplete('this is news', 'ðɪs ɪz nuz')).toBe(true);
  });

  it('accepts IPA containing non-ASCII glyphs unconditionally', () => {
    expect(isPhoneticComplete('high', 'haɪ')).toBe(true);
    expect(isPhoneticComplete('book', 'bʊk')).toBe(true);
    expect(isPhoneticComplete('should', 'ʃʊd')).toBe(true);
    expect(isPhoneticComplete('that', 'ðæt')).toBe(true);
    expect(isPhoneticComplete('think', 'θɪŋk')).toBe(true);
  });
});

describe('isPhoneticComplete — denylist still catches raw English', () => {
  it('rejects clearly untranslated English words', () => {
    expect(isPhoneticComplete('really good', 'really ɡʊd')).toBe(false); // 'really' has 'ea', 'll'
    expect(isPhoneticComplete('because', 'because')).toBe(false); // has 'c', 'au', 'e'
    expect(isPhoneticComplete('announced', 'announced')).toBe(false); // 'ou', 'ce'
    expect(isPhoneticComplete('beautiful day', 'beautiful deɪ')).toBe(false); // 'ea'
  });

  it('rejects English words containing forbidden letters', () => {
    expect(isPhoneticComplete('going', 'going')).toBe(false); // has 'o' and 'ng'
    expect(isPhoneticComplete('happy', 'happy')).toBe(false); // has 'a', 'y', 'pp'
  });
});

describe('isPhoneticComplete — edge cases', () => {
  it('returns false for empty phonetic', () => {
    expect(isPhoneticComplete('hello', '')).toBe(false);
    expect(isPhoneticComplete('hello', '   ')).toBe(false);
  });

  it('returns false when segment count is far below word count', () => {
    expect(isPhoneticComplete('this is a long sentence here', 'ðɪs')).toBe(false);
  });
});

// ── transliterateToIPA via getWordPhonetic: the audit failure cases ────

describe('getWordPhonetic — audit failure cases', () => {
  // These all previously produced WRONG IPA via cascade-replace bug.
  // Now: hit dictionary directly OR transliterate via slot placeholders.
  it('handles lax /ʊ/ "oo" words correctly', () => {
    expect(getWordPhonetic('good')).toBe('ɡʊd');
    expect(getWordPhonetic('book')).toBe('bʊk');
    expect(getWordPhonetic('look')).toBe('lʊk');
    expect(getWordPhonetic('foot')).toBe('fʊt');
  });

  it('handles tense /u/ "oo" words correctly (dict hits)', () => {
    expect(getWordPhonetic('too')).toBe('tu');
    expect(getWordPhonetic('food')).toBe('fud');
    expect(getWordPhonetic('moon')).toBe('mun');
    expect(getWordPhonetic('school')).toBe('skul');
  });

  it('handles "ew"/"ue" tense vowel digraphs', () => {
    expect(getWordPhonetic('news')).toBe('nuz');
    expect(getWordPhonetic('true')).toBe('tru');
    expect(getWordPhonetic('blue')).toBe('blu');
  });

  it('handles irregular silent letters', () => {
    expect(getWordPhonetic('two')).toBe('tu');   // silent w
    expect(getWordPhonetic('who')).toBe('hu');   // silent w
    expect(getWordPhonetic('write')).toBe('raɪt'); // silent w
    expect(getWordPhonetic('eight')).toBe('eɪt'); // silent gh
  });

  it('handles "ea" → /ɛ/ irregulars', () => {
    expect(getWordPhonetic('said')).toBe('sɛd');
    expect(getWordPhonetic('head')).toBe('hɛd');
    expect(getWordPhonetic('dead')).toBe('dɛd');
    expect(getWordPhonetic('bread')).toBe('brɛd');
  });

  it('handles common flap-T words', () => {
    expect(getWordPhonetic('water')).toBe('ˈwɔɾər');
    expect(getWordPhonetic('better')).toBe('ˈbɛɾər');
    expect(getWordPhonetic('city')).toBe('ˈsɪɾi');
    expect(getWordPhonetic('party')).toBe('ˈpɑrɾi');
    expect(getWordPhonetic('later')).toBe('ˈleɪɾər');
  });

  it('handles tricky vowels in common words', () => {
    expect(getWordPhonetic('pilot')).toBe('ˈpaɪlət');
    expect(getWordPhonetic('time')).toBe('taɪm');
    expect(getWordPhonetic('home')).toBe('hoʊm');
  });
});

describe('transliterateToIPA (via getWordPhonetic, unknown words)', () => {
  // Unknown words run through the slot-protected transliterator.
  // We don't test these against exact canonical IPA (transliteration is approximate),
  // but we DO test that the output does NOT contain English-only signals
  // — that would mean the cascade-replace bug is still alive.
  it('produces output with no plain a/e/o vowels', () => {
    const got = getWordPhonetic('zorblax'); // gibberish, won't be in dict
    expect(/[aeo]/.test(got)).toBe(false);
  });

  it('does not destroy long-vowel digraphs (slot protection works)', () => {
    // "newt" → eɪ trap. Single-letter rules previously destroyed "ew" output.
    // With slot protection, "ew" → slot(20) → "u" must survive.
    const got = getWordPhonetic('newt');
    expect(got).toContain('u');
    expect(got).not.toContain('ʌ'); // the old bug would have produced ʌ here
  });

  it('flap-T fires for intervocalic /t/ in unknown words', () => {
    // "gata" (gibberish) — t between vowels → ɾ
    const got = getWordPhonetic('gata');
    expect(got).toContain('ɾ');
  });
});

// ── validateLinkedPhonetic ────────────────────────────────────────────

describe('validateLinkedPhonetic', () => {
  it('converts ‿ to . in phonetic', () => {
    expect(validateLinkedPhonetic('tell‿us', 'tɛl‿əs')).toBe('tɛl.əs');
  });

  it('collapses duplicate dots', () => {
    expect(validateLinkedPhonetic('a‿b', 'æ.. b')).toBe('æ. b');
  });
});

// ── generateFallbackPhonetic ──────────────────────────────────────────

describe('generateFallbackPhonetic — end-to-end on linked sentences', () => {
  it('handles a simple linked sentence', () => {
    const out = generateFallbackPhonetic('the‿airline');
    expect(out).toBe('ðə.ˈɛrlaɪn');
  });

  it('produces IPA for the previously-broken "news" sentence', () => {
    const out = generateFallbackPhonetic('the news is good');
    // Should contain correct IPA — not "nɛws" or "gʌːd"
    expect(out).toContain('nuz');
    expect(out).toContain('ɡʊd');
    expect(out).not.toContain('nɛws');
    expect(out).not.toContain('gʌːd');
  });

  it('produces IPA for "too good to be true"', () => {
    const out = generateFallbackPhonetic('too good to be true');
    expect(out).toContain('tu');     // not "tʌː"
    expect(out).toContain('ɡʊd');    // not "gʌːd"
    expect(out).toContain('tru');    // not "trʌɛ"
  });
});

// ── fixCommonPhoneticErrors ───────────────────────────────────────────

describe('fixCommonPhoneticErrors — preserves flap-T and silent-e fixes', () => {
  it('preserves /ɾ/ symbol through the cleanup pipeline', () => {
    const out = fixCommonPhoneticErrors(
      "It's due to personnel issues this time",
      'ɪts ˈduː ɾə pɝrsəˈnɛl ˈɪʃuz ðɪs ˈtaɪm'
    );
    expect(out).toContain('ɾ');
  });

  it('removes secondary stress mark (ˌ → "")', () => {
    const out = fixCommonPhoneticErrors('test', 'ˌpɝrsəˈnɛl');
    expect(out).not.toContain('ˌ');
    expect(out).toContain('ˈ');
  });

  it('removes commas of all variants', () => {
    const out = fixCommonPhoneticErrors('test', 'a,b，c、d');
    expect(out).not.toMatch(/[,，、]/);
  });
});

// ── fixCommonPhoneticErrors: deterministic American-English corrections ──
// Raw outputs below were observed live from Gemini for
// "What are your plans for the afternoon?" (2026-07-15 investigation)

describe('fixCommonPhoneticErrors — the → /ði/ before vowel sounds', () => {
  it('fixes ðə before a linked vowel block', () => {
    expect(fixCommonPhoneticErrors('for the afternoon', 'fər ðə.æftərˈnun'))
      .toBe('fər ði.æftərˈnun');
  });

  it('fixes ðə before a stressed vowel block', () => {
    expect(fixCommonPhoneticErrors('the evening', 'ðə ˈivnɪŋ'))
      .toBe('ði ˈivnɪŋ');
  });

  it('keeps ðə before consonant sounds', () => {
    expect(fixCommonPhoneticErrors('the driver', 'ðə ˈdraɪvər'))
      .toBe('ðə ˈdraɪvər');
  });
});

describe('fixCommonPhoneticErrors — one primary stress per block', () => {
  it('collapses double primary stress, keeping the last (afternoon pattern)', () => {
    expect(fixCommonPhoneticErrors('the afternoon', 'ðə.ˈæftərˈnun'))
      .toBe('ði.æftərˈnun');
  });

  it('leaves single-stress blocks untouched', () => {
    expect(fixCommonPhoneticErrors('tap your phone', 'ˈtæp jər ˈfoʊn'))
      .toBe('ˈtæp jər ˈfoʊn');
  });
});

describe('fixCommonPhoneticErrors — flap-T corrections', () => {
  it('restores t after obstruents where flap is impossible (afternoon)', () => {
    expect(fixCommonPhoneticErrors('the afternoon', 'ðə.ˈæf.ɾər.nun'))
      .toBe('ði.ˈæf.tər.nun');
  });

  it('enforces flap for intervocalic t before unstressed vowel (What are)', () => {
    expect(fixCommonPhoneticErrors('What are your', 'ˈwʌ.tər jər'))
      .toBe('ˈwʌ.ɾər jər');
  });

  it('does not flap t before a stressed syllable (hotel)', () => {
    expect(fixCommonPhoneticErrors('hotel', 'hoʊˈtɛl'))
      .toBe('hoʊˈtɛl');
  });

  it('keeps legitimate flap after r (party)', () => {
    expect(fixCommonPhoneticErrors('party', 'ˈpɑrɾi'))
      .toBe('ˈpɑrɾi');
  });
});

describe('fixCommonPhoneticErrors — "all" keeps its /l/ in chain linking', () => {
  it('restores dropped l before a linked vowel (user-reported: join you all after)', () => {
    expect(fixCommonPhoneticErrors("Perhaps I'll join you all after my training.", 'pərˈhæps ˈaɪl ˈdʒɔɪn.ju.ˈɔ.ˈæftər maɪ ˈtreɪnɪŋ'))
      .toBe('pərˈhæps ˈaɪl ˈdʒɔɪn.ju.ˈɔ.ˈlæftər maɪ ˈtreɪnɪŋ');
  });

  it('restores dropped l at block end before a consonant word', () => {
    expect(fixCommonPhoneticErrors('you all did it', 'ju.ɔ dɪd ɪt'))
      .toBe('ju.ɔl dɪd ɪt');
  });

  it('leaves intact ɔl untouched', () => {
    expect(fixCommonPhoneticErrors('join you all after', 'ˈdʒɔɪn ju.ɔl.æftər'))
      .toBe('ˈdʒɔɪn ju.ɔl.æftər');
  });

  it('does nothing when the sentence has no "all" (awe stays bare)', () => {
    expect(fixCommonPhoneticErrors('the awe of nature', 'ðə ˈɔ əv ˈneɪtʃər'))
      .toBe('ði ˈɔ əv ˈneɪtʃər');
  });
});
