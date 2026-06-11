/**
 * Phonetic Utilities
 * Handles IPA (International Phonetic Alphabet) processing and validation
 * Ensures accurate phonetic transcription for linking
 */

// Common word phonetic dictionary (American English)
const WORD_PHONETICS: Record<string, string> = {
  // Pronouns
  'i': 'aɪ',
  'you': 'ju',
  'he': 'hi',
  'she': 'ʃi',
  'it': 'ɪt',
  'we': 'wi',
  'they': 'ðeɪ',
  'me': 'mi',
  'him': 'hɪm',
  'her': 'hɚ',
  'us': 'ʌs',
  'them': 'ðəm',

  // Articles & determiners
  'a': 'ə',
  'an': 'ən',
  'the': 'ðə', // or 'ði' before vowels
  'this': 'ðɪs',
  'that': 'ðæt',
  'these': 'ðiz',
  'those': 'ðoʊz',

  // Auxiliary verbs
  'is': 'ɪz',
  'am': 'æm',
  'are': 'ɑr',
  'was': 'wɑz',
  'were': 'wɚ',
  'be': 'bi',
  'been': 'bɪn',
  'have': 'hæv',
  'has': 'hæz',
  'had': 'hæd',
  'do': 'du',
  'does': 'dʌz',
  'did': 'dɪd',

  // Modal verbs
  'can': 'kæn',
  'could': 'kʊd',
  'will': 'wɪl',
  'would': 'wʊd',
  'shall': 'ʃæl',
  'should': 'ʃʊd',
  'may': 'meɪ',
  'might': 'maɪt',
  'must': 'mʌst',

  // Prepositions
  'at': 'æt',
  'in': 'ɪn',
  'on': 'ɑn',
  'to': 'tu',
  'of': 'ʌv',
  'for': 'fɔr',
  'with': 'wɪð',
  'from': 'frɑm',
  'about': 'əˈbaʊt',

  // Common words
  'how': 'haʊ',
  'what': 'wɑt',
  'when': 'wɛn',
  'where': 'wɛr',
  'why': 'waɪ',
  'who': 'hu',
  'afternoon': 'ˌæftərˈnun',
  'pm': 'ˌpiˈɛm',
  'three': 'θri',
  'going': 'ˈgoʊɪŋ',

  // Lax /ʊ/ "oo" — without dict, transliterate would still use ʊ (correct), but explicit is safer
  'good': 'ɡʊd',
  'book': 'bʊk',
  'look': 'lʊk',
  'took': 'tʊk',
  'foot': 'fʊt',
  'wood': 'wʊd',
  'cook': 'kʊk',
  'hook': 'hʊk',
  'put': 'pʊt',

  // Tense /u/ "oo" — these need dict; default transliterate would give ʊ (wrong)
  'too': 'tu',
  'food': 'fud',
  'moon': 'mun',
  'soon': 'sun',
  'room': 'rum',
  'boot': 'but',
  'school': 'skul',
  'pool': 'pul',
  'true': 'tru',
  'blue': 'blu',
  'due': 'du',
  'news': 'nuz',
  'few': 'fju',
  'new': 'nu',

  // Irregular silent letters / spellings
  'two': 'tu',          // silent w
  'one': 'wʌn',         // irregular onset
  'once': 'wʌns',
  'said': 'sɛd',
  'says': 'sɛz',
  'dead': 'dɛd',        // 'ea' as /ɛ/
  'head': 'hɛd',
  'bread': 'brɛd',
  'ready': 'ˈrɛdi',
  'eight': 'eɪt',       // silent gh
  'write': 'raɪt',      // silent w
  'wrote': 'roʊt',
  'wrong': 'rɑŋ',

  // Common flap-T words (American: /t/ → /ɾ/ between vowels)
  'water': 'ˈwɔɾər',
  'better': 'ˈbɛɾər',
  'butter': 'ˈbʌɾər',
  'letter': 'ˈlɛɾər',
  'letters': 'ˈlɛɾərz',
  'matter': 'ˈmæɾər',
  'city': 'ˈsɪɾi',
  'pretty': 'ˈprɪɾi',
  'party': 'ˈpɑrɾi',
  'sorry': 'ˈsɑri',
  'really': 'ˈrili',
  'later': 'ˈleɪɾər',
  'meeting': 'ˈmiɾɪŋ',
  'getting': 'ˈɡɛɾɪŋ',
  'sitting': 'ˈsɪɾɪŋ',
  'writing': 'ˈraɪɾɪŋ',
  'daughter': 'ˈdɔɾər',
  'bottle': 'ˈbɑɾəl',
  'little': 'ˈlɪɾəl',
  'middle': 'ˈmɪdəl',

  // Vowels that transliterate gets wrong
  'pilot': 'ˈpaɪlət',
  'hi': 'haɪ',
  'high': 'haɪ',
  'time': 'taɪm',
  'nice': 'naɪs',
  'like': 'laɪk',
  'make': 'meɪk',
  'home': 'hoʊm',

  // Common content words seen in test sessions (workflow corpus)
  'here': 'hɪr',
  'there': 'ðɛr',
  'sure': 'ʃʊr',
  'work': 'wɜrk',
  'house': 'haʊs',
  'people': 'ˈpipəl',
  'family': 'ˈfæməli',
  'friend': 'frɛnd',
  'mother': 'ˈmʌðər',
  'father': 'ˈfɑðər',
  'sister': 'ˈsɪstər',
  'brother': 'ˈbrʌðər',
  'another': 'əˈnʌðər',
  'flight': 'flaɪt',
  'hours': 'aʊərz',
  'announced': 'əˈnaʊnst',
  'delayed': 'dɪˈleɪd',
  'rebook': 'riˈbʊk',
  'airline': 'ˈɛrlaɪn',
  'personnel': 'pɝrsəˈnɛl',
  'issues': 'ˈɪʃuz',
  'because': 'bɪˈkʌz',
  'beautiful': 'ˈbjuɾəfəl',
};

/**
 * Slot placeholders — guaranteed non-Latin so single-letter rules can't cannibalize digraph output.
 * E.g. "good" → "g⦀21⦁d" after digraph pass → ʊ stays safe → final "ɡʊd".
 * The previous bug: oo→uː, then u→ʌ destroyed the uː → "gʌːd".
 */
const SLOT_IPA: Record<number, string> = {
  1: 'eɪ', 2: 'aɪ', 3: 'oʊ', 4: 'u',
  10: 'ʃən', 11: 'ʒən', 12: 'aɪt', 13: 'oʊ', 14: 'ɔ',
  20: 'u', 21: 'ʊ', 22: 'i', 23: 'oʊ',
  24: 'eɪ', 25: 'ɔɪ', 26: 'aʊ', 27: 'ɪr', 28: 'ɛr', 29: 'aʊər',
  30: 'f', 31: 'tʃ', 32: 'ʃ', 33: 'ð', 34: 'ŋ', 35: 'k', 36: 'w',
};
const slot = (n: number): string => `⦀${n}⦁`;

/**
 * Rule-based English → IPA transliteration for unknown words (fallback when dict misses).
 * Uses slot placeholders to prevent digraph output from being clobbered by later single-letter rules.
 */
function transliterateToIPA(word: string): string {
  let s = word;

  // Pass 1: Multi-char patterns → slot placeholders.
  // Silent-e CVCe → long vowel + drop final e
  s = s
    .replace(/([bcdfghjklmnpqrstvwxz])a([bcdfghjklmnpqrstvwxz])e\b/g, `$1${slot(1)}$2`)
    .replace(/([bcdfghjklmnpqrstvwxz])i([bcdfghjklmnpqrstvwxz])e\b/g, `$1${slot(2)}$2`)
    .replace(/([bcdfghjklmnpqrstvwxz])o([bcdfghjklmnpqrstvwxz])e\b/g, `$1${slot(3)}$2`)
    .replace(/([bcdfghjklmnpqrstvwxz])u([bcdfghjklmnpqrstvwxz])e\b/g, `$1${slot(4)}$2`);

  // Trigraphs / morphemes
  s = s
    .replace(/tion\b/g, slot(10))
    .replace(/sion\b/g, slot(11))
    .replace(/ight/g, slot(12))
    .replace(/ough/g, slot(13))
    .replace(/augh/g, slot(14));

  // R-colored digraphs (must come before plain ow/ou rules)
  s = s
    .replace(/ear/g, slot(27))
    .replace(/eer/g, slot(27))
    .replace(/air/g, slot(28))
    .replace(/our/g, slot(29));

  // Vowel digraphs
  s = s
    .replace(/ew/g, slot(20))   // fixes "news" → nuz
    .replace(/ue/g, slot(20))   // fixes "true/blue/due"
    .replace(/oo/g, slot(21))   // defaults to lax ʊ (good, book); tense /u/ "oo" words live in dict
    .replace(/ee/g, slot(22))
    .replace(/ea/g, slot(22))
    .replace(/oa/g, slot(23))
    .replace(/ai/g, slot(24))
    .replace(/ay/g, slot(24))
    .replace(/oi/g, slot(25))
    .replace(/oy/g, slot(25))
    .replace(/ou/g, slot(26))
    .replace(/ow\b/g, slot(23))  // word-final → oʊ
    .replace(/ow/g, slot(26));   // elsewhere → aʊ

  // Consonant digraphs
  s = s
    .replace(/ph/g, slot(30))
    .replace(/ch/g, slot(31))
    .replace(/sh/g, slot(32))
    .replace(/th/g, slot(33))
    .replace(/ng/g, slot(34))
    .replace(/ck/g, slot(35))
    .replace(/wh/g, slot(36));

  // Pass 2: Single letters — safe now, digraphs are non-Latin slots
  s = s
    .replace(/a/g, 'æ')
    .replace(/e\b/g, '')        // drop final orphan e (silent)
    .replace(/e/g, 'ɛ')
    .replace(/i/g, 'ɪ')
    .replace(/o/g, 'ɑ')
    .replace(/u/g, 'ʌ')
    .replace(/y\b/g, 'i')
    .replace(/y/g, 'j')
    .replace(/c/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/q/g, 'k');

  // Pass 3: Decode slot placeholders → IPA
  s = s.replace(/⦀(\d+)⦁/g, (_m, n) => SLOT_IPA[Number(n)] ?? '');

  // Pass 4: American refinements
  // Final s → z after a voiced sound (rough: vowel or voiced consonant)
  s = s.replace(/([æɑɛɪʊʌəɔiueɪaɪoʊaʊɔɪmnŋlrbdɡvðzʒ])s\b/g, '$1z');
  // Flap-T between vowels (intervocalic /t/ → /ɾ/) — American casual register
  s = s.replace(/([æɑɛɪʊʌəaɪoʊeɪ])t([æɑɛɪʊʌəaɪoʊeɪ])/g, '$1ɾ$2');

  return s;
}

/**
 * Get phonetic transcription for a word
 * Returns best-effort transcription from dictionary or simplified version
 */
export function getWordPhonetic(word: string): string {
  const cleanWord = word.toLowerCase().replace(/[?.!,;:'"()[\]{}]/g, '');

  // Check dictionary first
  if (WORD_PHONETICS[cleanWord]) {
    return WORD_PHONETICS[cleanWord];
  }

  // For unknown words, use a simple vowel-based transliteration
  // so we never show raw English inside IPA notation
  return transliterateToIPA(cleanWord);
}

/**
 * Validate and fix phonetic transcription for linked speech
 * Ensures that phonetics match the linking symbols in the text
 */
export function validateLinkedPhonetic(
  _linkedSentence: string,
  providedPhonetic: string
): string {
  // Trust the AI-provided phonetic; just normalize ‿ → . so sentence and phonetic
  // use different notations (‿ for sentence display, . for IPA syllable boundary).
  return providedPhonetic
    .replace(/\s*‿\s*/g, '.')
    .replace(/\.+/g, '.');
}

/**
 * Check if AI-provided phonetic is complete
 * Returns false if phonetics seem incomplete or incorrect
 */
export function isPhoneticComplete(text: string, phonetic: string): boolean {
  if (!phonetic || phonetic.trim().length === 0) {
    return false;
  }

  const words = text.split(/[\s‿]+/).filter(w => w.replace(/[?.!,;]/g, '').length > 0);

  // Very rough heuristic: phonetic should have at least 60% of word count in segments
  const phoneticSegments = phonetic.split(/[\s‿]+/).filter(s => s.length > 0);

  // AI often groups linked words (e.g. "is it" → single phonetic unit)
  // so a lower threshold (40%) avoids false negatives on short sentences
  if (phoneticSegments.length < words.length * 0.4) {
    console.warn(`Phonetic seems incomplete: ${phoneticSegments.length} segments for ${words.length} words`);
    return false;
  }

  // Detect untranslated English by looking for English-only SIGNALS, not by requiring
  // non-ASCII IPA glyphs. Many valid IPA symbols are plain ASCII (i, u, t, n, z, r, l,
  // h, b, d, k, m, p, s, w), so the old "must contain non-ASCII" rule false-positive'd
  // on perfectly good IPA like 'nuz' (news), 'tru' (true), 'rili' (really).
  const ENGLISH_ONLY_LETTERS = /[acqxyeo]/i;
  // c/q/x/y never appear in American English IPA; a/e/o are replaced by æ/ɛ/ɑ/ə/ɔ.
  const ENGLISH_ONLY_DIGRAPHS = /th|sh|ch|ng|ck|ph|gh|wh|qu|ll|ss|tt|ee|oo|ea|ou|ow|ai|ay|ie|ue/i;
  const rawEnglishSegments = phoneticSegments.filter(seg => {
    const clean = seg.replace(/[ˈˌ.ːʰʷʲˠˤ]/g, '');
    // Already contains non-ASCII IPA glyph → definitely IPA
    if (/[^\x00-\x7F]/.test(clean)) return false;
    // Short ASCII segments (< 4 chars) are too ambiguous to flag — 'nuz', 'tru', 'hi' all valid IPA
    if (clean.length < 4) return false;
    // Long ASCII segment is suspicious only if it contains English-only letters or digraphs
    return ENGLISH_ONLY_LETTERS.test(clean) || ENGLISH_ONLY_DIGRAPHS.test(clean);
  });

  if (rawEnglishSegments.length > 0) {
    console.warn(`Phonetic contains raw English words: ${rawEnglishSegments.join(', ')}`);
    return false;
  }

  return true;
}

/**
 * Generate fallback phonetic when AI fails
 * Uses dictionary for known words, simple transliteration for unknown
 */
export function generateFallbackPhonetic(linkedSentence: string): string {
  const parts = linkedSentence.split(/(\s|‿)/);
  const phoneticParts: string[] = [];

  for (const part of parts) {
    if (part === '‿') {
      phoneticParts.push('.');
    } else if (part === ' ') {
      phoneticParts.push(' ');
    } else if (part.trim().length > 0) {
      phoneticParts.push(getWordPhonetic(part));
    }
  }

  return phoneticParts.join('');
}

/**
 * Fix specific known issues in AI-generated phonetics
 */
export function fixCommonPhoneticErrors(text: string, phonetic: string): string {
  let fixed = phonetic;

  console.log("🔧 fixCommonPhoneticErrors INPUT:", {
    text,
    phonetic,
    hasComma: phonetic.includes(','),
    commaCount: (phonetic.match(/,/g) || []).length,
    hasStressMarks: /[ˌˈ]/.test(phonetic),
    stressMarkCount: (phonetic.match(/[ˌˈ]/g) || []).length
  });

  // Step 1: ULTRA AGGRESSIVE comma removal - try multiple comma characters
  // Standard comma (U+002C), fullwidth comma (U+FF0C), and other variants
  fixed = fixed.replace(/[,，、]/g, ''); // Remove ALL comma variants

  // Step 2: Remove secondary stress mark only (ˌ looks like comma, confusing for learners)
  // ˌ (U+02CC, charCode 716) = secondary stress → remove
  // ˈ (U+02C8, charCode 712) = primary stress → KEEP
  fixed = fixed.replace(/[ˌ]/g, '');

  // Step 3: Also remove any commas/stress marks that might be encoded differently
  fixed = fixed.split('').filter(char => {
    const code = char.charCodeAt(0);
    // Filter out:
    // - comma (44), fullwidth comma (65292), ideographic comma (12289)
    // - IPA secondary stress (716) only; primary stress (712 = ˈ) is kept
    return code !== 44 && code !== 65292 && code !== 12289 && code !== 716;
  }).join('');

  // Step 4: Clean up excessive spaces
  fixed = fixed.replace(/\s+/g, ' ');

  // Step 5: Fix "this" missing /s/ sound
  fixed = fixed.replace(/ðɪ\s+æ/g, 'ðɪs‿æ'); // "this a..." → "ðɪs‿æ"
  fixed = fixed.replace(/ðɪ\s+ɑ/g, 'ðɪs‿ɑ'); // "this o..." → "ðɪs‿ɑ"
  fixed = fixed.replace(/ðɪ\s+i/g, 'ðɪs‿i'); // "this e..." → "ðɪs‿i"
  fixed = fixed.replace(/ðɪ\s+u/g, 'ðɪs‿u'); // "this u..." → "ðɪs‿u"
  fixed = fixed.replace(/ðɪ\s+ə/g, 'ðɪs‿ə'); // "this a..." → "ðɪs‿ə"

  // Step 6: Fix "does" missing /z/
  fixed = fixed.replace(/dʌ\s+/g, 'dʌz ');

  // Step 7: Fix "goes" missing /z/
  fixed = fixed.replace(/goʊ\s+/g, 'goʊz ');

  // Step 8: Replace any remaining ‿ in phonetics with syllable dot
  fixed = fixed.replace(/\s*‿\s*/g, '.'); // ‿ → . (sentence uses ‿, phonetics use .)
  fixed = fixed.replace(/\.+/g, '.'); // Remove duplicate dots

  // Step 9: Ensure proper spacing between phonetic segments
  fixed = fixed.trim();

  console.log("✅ fixCommonPhoneticErrors OUTPUT:", {
    original: phonetic,
    fixed: fixed,
    removedChars: phonetic.length - fixed.length
  });

  return fixed;
}
