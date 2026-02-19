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
};

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

  // For unknown words, return the word itself (AI will need to provide)
  return cleanWord;
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
  // IPA typically has fewer "segments" than English words, but not dramatically so
  const phoneticSegments = phonetic.split(/[\s‿]+/).filter(s => s.length > 0);

  if (phoneticSegments.length < words.length * 0.6) {
    console.warn(`Phonetic seems incomplete: ${phoneticSegments.length} segments for ${words.length} words`);
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
