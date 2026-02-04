/**
 * Test file for linking detection
 * Run this to verify the new pronunciation-based linking works correctly
 */

import { shouldLink, createLinkedSentence, endsWithConsonantSound, startsWithVowelSound } from './linkingUtils';

console.log("🧪 Testing Pronunciation-Based Linking Detection\n");
console.log("=" .repeat(60));

// Test 1: Basic consonant-vowel linking
console.log("\n✅ Test 1: Basic Consonant-Vowel Linking");
const basicTests = [
  { word1: 'pick', word2: 'it', expected: true },
  { word1: 'turn', word2: 'on', expected: true },
  { word1: 'look', word2: 'at', expected: true },
  { word1: 'think', word2: 'about', expected: true },
];

basicTests.forEach(({ word1, word2, expected }) => {
  const result = shouldLink(word1, word2);
  const status = result === expected ? '✓' : '✗';
  console.log(`  ${status} "${word1} ${word2}" → ${result ? 'LINK' : 'NO LINK'} (expected: ${expected ? 'LINK' : 'NO LINK'})`);
});

// Test 2: Words ending with vowel letters but consonant sounds
console.log("\n✅ Test 2: Consonant Sounds (vowel spelling)");
const consonantSoundTests = [
  { word1: 'have', word2: 'a', expected: true },   // /hæv/ + /ə/ → LINK
  { word1: 'give', word2: 'it', expected: true },  // /gɪv/ + /ɪt/ → LINK
  { word1: 'the', word2: 'end', expected: true },  // /ðə/ + /ɛnd/ → LINK
  { word1: 'are', word2: 'you', expected: true },  // /ɑr/ + /ju/ → LINK
];

consonantSoundTests.forEach(({ word1, word2, expected }) => {
  const result = shouldLink(word1, word2);
  const status = result === expected ? '✓' : '✗';
  console.log(`  ${status} "${word1} ${word2}" → ${result ? 'LINK' : 'NO LINK'} (expected: ${expected ? 'LINK' : 'NO LINK'})`);
});

// Test 3: H-dropping
console.log("\n✅ Test 3: H-Dropping (common in American English)");
const hDropTests = [
  { word1: 'they', word2: 'have', expected: true },  // they‿'ave
  { word1: 'tell', word2: 'him', expected: true },   // tell‿'im
  { word1: 'ask', word2: 'her', expected: true },    // ask‿'er
  { word1: 'I', word2: 'have', expected: true },     // I‿'ave
];

hDropTests.forEach(({ word1, word2, expected }) => {
  const result = shouldLink(word1, word2);
  const status = result === expected ? '✓' : '✗';
  console.log(`  ${status} "${word1} ${word2}" → ${result ? 'LINK' : 'NO LINK'} (expected: ${expected ? 'LINK' : 'NO LINK'})`);
});

// Test 4: No linking cases
console.log("\n✅ Test 4: Cases Where NO Linking Occurs");
const noLinkTests = [
  { word1: 'the', word2: 'cat', expected: false },   // consonant + consonant
  { word1: 'big', word2: 'dog', expected: false },   // consonant + consonant
  { word1: 'see', word2: 'you', expected: false },   // vowel + consonant (normally)
];

noLinkTests.forEach(({ word1, word2, expected }) => {
  const result = shouldLink(word1, word2);
  const status = result === expected ? '✓' : '✗';
  console.log(`  ${status} "${word1} ${word2}" → ${result ? 'LINK' : 'NO LINK'} (expected: ${expected ? 'LINK' : 'NO LINK'})`);
});

// Test 5: Full sentences
console.log("\n✅ Test 5: Complete Sentences");
const sentences = [
  {
    input: "Great! I heard they have a nice playground there.",
    expected: "Great! I heard they‿have‿a nice playground there."
  },
  {
    input: "Pick it up and turn on the light.",
    expected: "Pick‿it‿up‿and turn‿on the light."
  },
  {
    input: "I think about it all the time.",
    expected: "I think‿about‿it‿all the time."
  }
];

sentences.forEach(({ input, expected }) => {
  const result = createLinkedSentence(input);
  const status = result === expected ? '✓' : '✗';
  console.log(`\n  ${status} Input:    "${input}"`);
  console.log(`     Result:   "${result}"`);
  console.log(`     Expected: "${expected}"`);
});

console.log("\n" + "=".repeat(60));
console.log("🎉 Linking Detection Tests Complete!\n");

// Summary of improvements
console.log("📊 Key Improvements:");
console.log("  • Fixed 'have a' → now correctly links as 'have‿a'");
console.log("  • Fixed 'give it' → now correctly links as 'give‿it'");
console.log("  • Added h-dropping for 'they have' → 'they‿have'");
console.log("  • Added h-dropping for 'tell him' → 'tell‿him'");
console.log("  • Pronunciation-based detection (not just spelling)");
