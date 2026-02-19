/**
 * Intonation Pattern Generation Utilities
 * Centralized logic for generating stress and intonation patterns
 * Eliminates duplication across geminiService, App, FeedbackCard, and minimaxService
 */

import { isFunctionWord, getSentenceIntonation } from './linkingUtils';

/**
 * Generate intonation map for a sentence
 * Returns space-separated tokens with stress (●/·) and intonation (↗/↘) markers
 *
 * @param text - The input sentence (can include punctuation)
 * @param words - Optional pre-split words array (if already processed)
 * @returns Space-separated intonation tokens (e.g., "· · ● ·↗")
 *
 * @example
 * generateIntonationMap("Do you like it?")
 * // Returns: "· · ● ·↗"
 *
 * generateIntonationMap("What time is it?")
 * // Returns: "● · · ·↘"
 */
export function generateIntonationMap(text: string, words?: string[]): string {
  // Use provided words or split from text
  const wordList = words || text.trim().split(/\s+/);

  if (wordList.length === 0) {
    return '';
  }

  // Determine sentence-level intonation (↗ for yes/no questions, ↘ for statements and wh-questions)
  const sentenceIntonation = getSentenceIntonation(text);

  // Generate tokens for each word
  const tokens = wordList.map((word, index) => {
    const isLast = index === wordList.length - 1;

    // Clean word for function word detection
    const cleanedWord = word.toLowerCase().replace(/[?.!,;:'\"()[\\]{}]/g, '');

    // Determine stress: · for function words, ● for content words
    const isFunction = isFunctionWord(cleanedWord);
    const stressMarker = isFunction ? '·' : '●';

    // Add intonation marker to last word only
    if (isLast) {
      return stressMarker + sentenceIntonation;
    }

    return stressMarker;
  });

  return tokens.join(' ');
}

/**
 * Generate intonation tokens as an array (useful for word-by-word processing)
 *
 * @param text - The input sentence
 * @param words - Optional pre-split words array
 * @returns Array of intonation tokens
 *
 * @example
 * generateIntonationTokens("How are you?")
 * // Returns: ['●', '·', '·↘']
 */
export function generateIntonationTokens(text: string, words?: string[]): string[] {
  const map = generateIntonationMap(text, words);
  return map.split(/\s+/).filter(Boolean);
}

/**
 * Validate that an intonation map matches the word count
 *
 * @param intonationMap - The intonation map string
 * @param wordCount - Expected number of words
 * @returns true if valid, false otherwise
 */
export function validateIntonationMap(intonationMap: string, wordCount: number): boolean {
  if (!intonationMap || !intonationMap.trim()) {
    return false;
  }

  const tokens = intonationMap.trim().split(/\s+/).filter(Boolean);
  return tokens.length === wordCount;
}

/**
 * Fix/regenerate intonation map if it's invalid
 *
 * @param text - The original sentence text
 * @param providedMap - The potentially invalid intonation map
 * @param words - Optional pre-split words array
 * @returns Valid intonation map (either the provided one if valid, or regenerated)
 */
export function ensureValidIntonationMap(
  text: string,
  providedMap: string | undefined,
  words?: string[]
): string {
  const wordList = words || text.trim().split(/\s+/);
  const wordCount = wordList.length;

  // If provided map is valid, use it
  if (providedMap && validateIntonationMap(providedMap, wordCount)) {
    return providedMap;
  }

  // Otherwise, generate a new one
  console.warn('Invalid intonation map detected, regenerating...');
  return generateIntonationMap(text, wordList);
}
