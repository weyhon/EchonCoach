/**
 * Linking Detection Utilities
 *
 * Provides pronunciation-based linking detection for American English.
 * Implements Level 1 (Foundation) linking rules from LINKING_STRATEGY.md
 */

// Words that end with consonant SOUNDS despite ending with vowel LETTERS
// Based on actual pronunciation, not spelling
const CONSONANT_ENDING_WORDS: Record<string, string> = {
  // -ve endings (end with /v/ sound)
  'have': 'v',
  'gave': 'v',
  'give': 'v',
  'live': 'v',
  'love': 'v',
  'move': 'v',
  'prove': 'v',
  'save': 'v',
  'serve': 'v',
  'drive': 'v',
  'arrive': 'v',

  // -the endings (end with /ð/ sound)
  'the': 'ð',
  'breathe': 'ð',
  'bathe': 'ð',

  // -se endings (end with /z/ or /s/ sound)
  'use': 'z',     // verb: /juːz/
  'lose': 'z',
  'choose': 'z',
  'close': 'z',   // verb: /kloʊz/
  'please': 'z',
  'because': 'z',
  'whose': 'z',
  'noise': 'z',
  'raise': 'z',

  // -re endings (end with /r/ sound)
  'are': 'r',
  'were': 'r',
  'where': 'r',
  'there': 'r',
  'here': 'r',
  'care': 'r',
  'share': 'r',
  'more': 'r',
  'before': 'r',
  'store': 'r',

  // -ge endings (end with /dʒ/ sound)
  'age': 'dʒ',
  'change': 'dʒ',
  'large': 'dʒ',
  'orange': 'dʒ',

  // -le endings (end with /l/ sound)
  'able': 'l',
  'table': 'l',
  'people': 'l',
  'little': 'l',
  'simple': 'l',
  'possible': 'l',
};

// Words where H is commonly dropped in connected speech (h-dropping)
// These behave as if they start with a vowel sound
const H_DROPPING_WORDS = new Set([
  // Pronouns
  'he',
  'him',
  'his',
  'her',

  // Auxiliary verbs (most common!)
  'have',
  'has',
  'had',
  'having',

  // Other function words
  'here',
  'how',
]);

// Function words that are often reduced/linked
const FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'have', 'has', 'had',
  'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'her', 'its', 'our', 'their',
  'this', 'that', 'these', 'those',
  'and', 'or', 'but', 'so', 'if', 'as', 'than', 'into', 'onto', 'up',
]);

/**
 * Determines if a word ends with a consonant SOUND
 * Considers pronunciation, not just spelling
 */
export function endsWithConsonantSound(word: string): boolean {
  if (!word) return false;

  const cleanWord = word.toLowerCase().replace(/[?.!,;]/g, '');

  // Check if word is in our special pronunciation dictionary
  if (CONSONANT_ENDING_WORDS[cleanWord]) {
    return true;
  }

  // For regular words, check the last letter
  const lastChar = cleanWord.slice(-1);
  return /[bcdfghjklmnpqrstvwxyz]/.test(lastChar);
}

/**
 * Determines if a word starts with a vowel SOUND
 * Considers h-dropping in connected speech
 */
export function startsWithVowelSound(word: string, isAfterWord: boolean = false): boolean {
  if (!word) return false;

  const cleanWord = word.toLowerCase().replace(/[?.!,;]/g, '');

  // Check for h-dropping (only in connected speech, not sentence-initial)
  if (isAfterWord && H_DROPPING_WORDS.has(cleanWord)) {
    return true;
  }

  // Check first letter
  const firstChar = cleanWord[0];
  return /[aeiou]/.test(firstChar);
}

/**
 * Determines if linking should occur between two words
 * Implements Level 1 (Foundation) linking rules
 */
export function shouldLink(currentWord: string, nextWord: string): boolean {
  if (!currentWord || !nextWord) return false;

  const endsConsonant = endsWithConsonantSound(currentWord);
  const startsVowel = startsWithVowelSound(nextWord, true); // true = in connected speech

  return endsConsonant && startsVowel;
}

/**
 * Creates a linked sentence with ‿ symbols
 * Used as fallback when AI analysis is unavailable
 */
export function createLinkedSentence(sentence: string): string {
  const words = sentence.trim().split(/\s+/);
  let result = '';

  for (let i = 0; i < words.length; i++) {
    result += words[i];

    if (i < words.length - 1) {
      const shouldLinkWords = shouldLink(words[i], words[i + 1]);
      result += shouldLinkWords ? '‿' : ' ';
    }
  }

  return result;
}

/**
 * Gets the display word for h-dropping cases
 * Returns the word with h replaced by apostrophe for visual feedback
 */
export function getHDroppedForm(word: string): string {
  const cleanWord = word.toLowerCase().replace(/[?.!,;]/g, '');

  if (H_DROPPING_WORDS.has(cleanWord) && cleanWord.startsWith('h')) {
    return `'${cleanWord.slice(1)}`;
  }

  return word;
}

/**
 * Determines if a word is a function word (for stress pattern detection)
 */
export function isFunctionWord(word: string): boolean {
  const cleanWord = word.toLowerCase().replace(/[?.!,;]/g, '');
  return FUNCTION_WORDS.has(cleanWord);
}

/**
 * Example usage and test cases
 */
export const LINKING_EXAMPLES = {
  basic: [
    { phrase: 'have a', should: true, result: 'have‿a' },
    { phrase: 'pick it up', should: true, result: 'pick‿it‿up' },
    { phrase: 'turn on', should: true, result: 'turn‿on' },
  ],
  hDropping: [
    { phrase: 'they have', should: true, result: 'they‿have (→ they‿\'ave)' },
    { phrase: 'tell him', should: true, result: 'tell‿him (→ tell‿\'im)' },
    { phrase: 'ask her', should: true, result: 'ask‿her (→ ask‿\'er)' },
  ],
  noLinking: [
    { phrase: 'good day', should: false, result: 'good day (same consonant, no link)' },
    { phrase: 'the cat', should: false, result: 'the cat (consonant + consonant)' },
  ],
};
