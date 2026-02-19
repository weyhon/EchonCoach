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

  // Past tense forms (end with /d/ or /t/ sounds)
  'loved': 'd',
  'saved': 'd',
  'moved': 'd',
  'lived': 'd',
  'arrived': 'd',
  'used': 'd',    // past: /juːzd/
  'raised': 'd',
  'closed': 'd',  // past: /kloʊzd/
  'changed': 'd',
  'cared': 'd',
  'shared': 'd',
  'stored': 'd',
  'served': 'd',
  'proved': 'd',
  'breathed': 'd',

  // Third person singular forms (end with /z/, /s/, /vz/ sounds)
  'loves': 'z',
  'gives': 'z',
  'lives': 'z',   // verb: /lɪvz/
  'moves': 'z',
  'proves': 'z',
  'saves': 'z',
  'drives': 'z',
  'arrives': 'z',
  'uses': 'z',    // /juːzɪz/
  'loses': 'z',
  'chooses': 'z',
  'closes': 'z',  // /kloʊzɪz/
  'raises': 'z',
  'changes': 'dʒ', // /ˈtʃeɪn.dʒɪz/
  'breathes': 'ð',
  'serves': 'z',

  // Irregular but common forms
  'does': 'z',    // /dʌz/
  'goes': 'z',    // /goʊz/
  'says': 'z',    // /sɛz/
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

/**
 * Clean a word by removing punctuation and converting to lowercase
 * Centralized function for consistent word processing across all utilities
 */
const cleanWord = (word: string): string => {
  return word.toLowerCase().replace(/[?.!,;:'"()[\]{}]/g, '');
};

// Function words that are often reduced/linked
const FUNCTION_WORDS = new Set([
  // Articles, prepositions
  'a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from',
  // Auxiliary verbs
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'have', 'has', 'had',
  // Modal verbs
  'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must',
  // Pronouns
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'her', 'its', 'our', 'their',
  // Demonstratives
  'this', 'that', 'these', 'those',
  // Conjunctions and others
  'and', 'or', 'but', 'so', 'if', 'as', 'than', 'into', 'onto', 'up',
  // Wh-question words (important for intonation patterns)
  'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how',
]);

/**
 * Determines if a word ends with a consonant SOUND
 * Considers pronunciation, not just spelling
 */
export function endsWithConsonantSound(word: string): boolean {
  if (!word) return false;

  const cleaned = cleanWord(word);

  // Check if word is in our special pronunciation dictionary
  if (CONSONANT_ENDING_WORDS[cleaned]) {
    return true;
  }

  // For regular words, check the last letter
  const lastChar = cleaned.slice(-1);
  return /[bcdfghjklmnpqrstvwxyz]/.test(lastChar);
}

/**
 * Determines if a word starts with a vowel SOUND
 * Considers h-dropping in connected speech
 */
export function startsWithVowelSound(word: string, isAfterWord: boolean = false): boolean {
  if (!word) return false;

  const cleaned = cleanWord(word);

  // Check for h-dropping (only in connected speech, not sentence-initial)
  if (isAfterWord && H_DROPPING_WORDS.has(cleaned)) {
    return true;
  }

  // Check first letter
  const firstChar = cleaned[0];
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
  const cleaned = cleanWord(word);
  return FUNCTION_WORDS.has(cleaned);
}

/**
 * Determines if a sentence is a wh-question (special question)
 * Wh-questions use falling intonation (↘) in American English
 */
export function isWhQuestion(text: string): boolean {
  const lowerText = text.toLowerCase().trim();
  return /^(what|when|where|which|who|whom|whose|why|how)\s/.test(lowerText);
}

/**
 * Determines if a sentence is a yes/no question
 * Yes/no questions use rising intonation (↗) in American English
 */
export function isYesNoQuestion(text: string): boolean {
  const lowerText = text.toLowerCase().trim();
  return /^(do|does|did|is|are|am|was|were|can|could|will|would|shall|should|may|might|must|have|has|had|isn't|aren't|wasn't|weren't|can't|couldn't|won't|wouldn't|shouldn't|haven't|hasn't|hadn't)\s/.test(lowerText);
}

/**
 * Gets the appropriate intonation for a sentence
 * Returns '↗' for yes/no questions, '↘' for statements and wh-questions
 */
export function getSentenceIntonation(text: string): '↗' | '↘' {
  const hasQuestionMark = text.includes('?');

  if (!hasQuestionMark) {
    return '↘'; // Statement
  }

  if (isWhQuestion(text)) {
    return '↘'; // Wh-question uses falling intonation
  }

  if (isYesNoQuestion(text)) {
    return '↗'; // Yes/no question uses rising intonation
  }

  // Default for questions: check if it looks like yes/no
  // If it ends with question mark but doesn't start with wh-word, likely yes/no
  return '↗';
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
