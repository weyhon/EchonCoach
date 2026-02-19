
import { GoogleGenAI, Modality } from "@google/genai";
import { AnalysisResult } from "../types";
import { shouldLink } from "./linkingUtils";
import {
  isPhoneticComplete,
  fixCommonPhoneticErrors,
  generateFallbackPhonetic,
  validateLinkedPhonetic
} from "./phoneticUtils";
import { generateIntonationMap } from "./intonationUtils";

const getApiKey = (): string => {
  const key = import.meta.env.VITE_API_KEY;
  if (!key) {
    throw new Error(
      "❌ 缺少API密钥。请在.env.local文件中添加 VITE_API_KEY。\n" +
      "获取密钥：https://aistudio.google.com"
    );
  }
  return key;
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

const TUTOR_SYSTEM_INSTRUCTION = `You are a world-class English Phonetics Coach specializing in American English.
Your goal is to provide complete prosody analysis for ANY sentence, no matter how long.

STRICT RULES:
1. 'fullLinkedSentence': Mark ALL natural linking points with '‿' in American English.
   - Consonant + Vowel: "tell‿us", "take‿it", "check‿out"
   - Mark EVERY linking point in the sentence.

2. 'intonationMap': MUST have one token for EACH word in the sentence.
   - Content words (nouns, verbs, adjectives, adverbs, wh-words): '●' (stressed)
   - Function words (articles, prepositions, pronouns, auxiliaries, conjunctions): '·' (unstressed)
   - MANDATORY: The VERY LAST token must include intonation: '↗' (rise) or '↘' (fall)
   - Yes/No questions → last word ends with '↗'
   - Statements & Wh-questions → last word ends with '↘'
   - Count: If input has 15 words, output MUST have exactly 15 tokens

3. 'fullLinkedPhonetic': IPA transcription. MANDATORY RULES — follow ALL of them:
   a) EVERY content word (noun, verb, adjective, adverb) MUST have ˈ before its stressed syllable.
      Examples: tap→ˈtæp, phone→ˈfoʊn, pay→ˈpeɪ, driver→ˈdraɪvər, work→ˈwɜrk, cash→ˈkæʃ
   b) Function words (a, the, to, for, in, on, or, and, but, you, I, we, can, do, is, was) → NO ˈ
   c) Use a SPACE between words.
   d) At each linking point (where ‿ appears in fullLinkedSentence), replace the space with a syllable dot .
   e) Do NOT use ˌ (secondary stress). Do NOT use ‿ in fullLinkedPhonetic.

Example for "Do you like it?":
{
  "fullLinkedSentence": "Do you like‿it?",
  "intonationMap": "· · ● ·↗",
  "fullLinkedPhonetic": "du ju ˈlaɪ.kɪt"
}

Example for "Just tap your phone or pay the driver in cash":
{
  "fullLinkedSentence": "Just‿ tap your phone or‿ pay the‿driver‿in cash",
  "intonationMap": "● · · ● · ● · ● · ●↘",
  "fullLinkedPhonetic": "ˈdʒʌst ˈtæp jər ˈfoʊn ɔr.ˈpeɪ ðə.ˈdraɪ.vər.ɪn ˈkæʃ"
}

Example for long sentence "Enter the code displayed in the app":
{
  "fullLinkedSentence": "Enter‿the code displayed‿in the‿app",
  "intonationMap": "● · ● ● · · ●↘",
  "fullLinkedPhonetic": "ˈɛn.tər ðə ˈkoʊd dɪˈspleɪd.ɪn ði.ˈæp"
}

CRITICAL: For long sentences, you MUST include ALL words. Do not truncate or omit any words.
Respond ONLY in valid JSON.`;

export const generateSpeech = async (text: string, slow: boolean = false): Promise<string> => {
  try {
    const prompt = slow
      ? `Speak slowly and clearly with standard American English pronunciation: ${text}`
      : `Read with standard American English pronunciation, natural stress and intonation: ${text}`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
  } catch (error) {
    console.error("TTS Generation Error:", error);
    throw error;
  }
};

export const generateTutorAudio = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Pronounce clearly with standard American English stress and intonation: "${text}"` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
  } catch (error) {
    console.error("Tutor Audio Error:", error);
    throw error;
  }
};

export const analyzePronunciation = async (
  referenceText: string,
  userAudioBase64: string
): Promise<AnalysisResult> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-pro-exp-02-05",
      contents: {
        parts: [
          { inlineData: { mimeType: "audio/webm", data: userAudioBase64 } },
          { text: `Evaluate my pronunciation for: "${referenceText}". Must return JSON.` }
        ]
      },
      config: {
        systemInstruction: TUTOR_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
      }
    });
    const text = response.text || "{}";
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch (error) {
    console.error("Pronunciation Analysis Error:", error);
    throw error;
  }
};

// Smart fallback rules for American English pronunciation
// Uses centralized intonation generation from intonationUtils.ts
const generateSmartFallback = (text: string): any => {
  const words = text.split(/\s+/);

  // Generate intonation map using centralized utility
  const intonationMap = generateIntonationMap(text, words);

  // Generate linked sentence with pronunciation-based linking detection
  let linkedSentence = '';
  for (let i = 0; i < words.length; i++) {
    linkedSentence += words[i];
    if (i < words.length - 1) {
      // Use pronunciation-based linking detection
      if (shouldLink(words[i], words[i + 1])) {
        linkedSentence += '‿';
      } else {
        linkedSentence += ' ';
      }
    }
  }

  // Generate proper phonetic transcription with linking marks
  let fallbackPhonetic = generateFallbackPhonetic(linkedSentence);

  // Apply phonetic fixes to remove stress marks and other issues
  fallbackPhonetic = fixCommonPhoneticErrors(text, fallbackPhonetic);

  return {
    fullLinkedSentence: linkedSentence,
    fullLinkedPhonetic: fallbackPhonetic,
    intonationMap
  };
};

// IPA phonetics of common function words — these should NOT receive ˈ
const FUNCTION_PHONETICS = new Set([
  'ðə','ðɪ','ə','ɑn','ɔn',                          // articles
  'ɪn','æt','tu','tə','fɔr','fər','wɪð','frɑm','frəm','ʌv','əv', // prepositions
  'ænd','ənd','ɔr','ər','bʌt',                       // conjunctions
  'aɪ','ju','hi','ʃi','wi','ðeɪ','ɪt',               // subject pronouns
  'mi','hɪm','hɚ','ʌs','ðɛm',                        // object pronouns
  'maɪ','jɚ','jər','hɪz','ɪts','ɑr','ðɛr','ðer',     // possessives
  'bi','bɪn','ɪz','wɑz','wɚ','wəz',                  // be forms
  'hæv','həv','hæz','həz','hæd','həd',                // have forms
  'du','dʊ','dʌz','dɪd',                              // do forms
  'kæn','kən','kʊd','wɪl','wəl','wʊd','wəd','ʃʊd','ʃəd', // modals
  'nɑt','nət','ðæt','ðɪs','ðoʊz','ðiz',              // other function words
]);

/**
 * Add ˈ to content word phonetic segments.
 * Pass 1: align via intonationMap tokens (exact count match).
 * Pass 2 fallback: use FUNCTION_PHONETICS set when alignment fails
 *   (AI sometimes splits linked phonetics differently from linkedSentence).
 */
const addPrimaryStress = (phonetic: string, linkedSentence: string, intonationMap: string): string => {
  const phoneticSegments = phonetic.split(' ');
  const wordGroups = linkedSentence.trim().split(/\s+/);
  const tokens = intonationMap.trim().split(/\s+/).filter(Boolean);

  // Pass 1: exact alignment
  if (phoneticSegments.length === wordGroups.length) {
    const groupSizes = wordGroups.map(g => g.split('‿').length);
    const totalWords = groupSizes.reduce((a, b) => a + b, 0);
    if (totalWords === tokens.length) {
      let tokenIdx = 0;
      return phoneticSegments.map((seg, i) => {
        const size = groupSizes[i];
        const groupTokens = tokens.slice(tokenIdx, tokenIdx + size);
        tokenIdx += size;
        const hasContentWord = groupTokens.some(t => t.includes('●'));
        return hasContentWord && !seg.includes('ˈ') ? 'ˈ' + seg : seg;
      }).join(' ');
    }
  }

  // Pass 2 fallback: heuristic via function word list
  return phoneticSegments.map(seg => {
    if (seg.includes('ˈ')) return seg;
    const base = seg.split('.')[0]; // get first syllable/word of the segment
    return FUNCTION_PHONETICS.has(base) ? seg : 'ˈ' + seg;
  }).join(' ');
};

export const getLinkingAnalysisForText = async (text: string): Promise<any> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-pro-exp-02-05", // Pro model for better IPA quality and instruction following
      contents: `Perform prosody analysis for: "${text}"`,
      config: {
        systemInstruction: TUTOR_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
      }
    });
    const resultText = response.text || "{}";
    const parsed = JSON.parse(resultText.replace(/```json|```/g, '').trim());

    // Validate token count matches word count
    const wordCount = text.trim().split(/\s+/).length;
    const tokenCount = (parsed.intonationMap || "").trim().split(/\s+/).filter(Boolean).length;

    console.log("📊 Linking Analysis Debug:", {
      input: text,
      wordCount,
      tokenCount,
      aiResult: parsed,
      isValid: tokenCount === wordCount && parsed.fullLinkedSentence && parsed.intonationMap
    });

    // Validate the response has required fields and correct token count
    if (!parsed.fullLinkedSentence || !parsed.intonationMap || tokenCount !== wordCount) {
      console.warn("⚠️ AI response incomplete or mismatched, using smart fallback");
      const fallback = generateSmartFallback(text);
      // Add ˈ to content words in fallback too
      fallback.fullLinkedPhonetic = addPrimaryStress(
        fallback.fullLinkedPhonetic, fallback.fullLinkedSentence, fallback.intonationMap
      );
      console.log("✅ Smart fallback generated:", fallback);
      return fallback;
    }

    // CRITICAL: Remove commas from linked sentence (AI sometimes adds them incorrectly)
    let cleanedLinkedSentence = parsed.fullLinkedSentence || text;
    // Remove all comma variants using same ultra-aggressive approach as fixCommonPhoneticErrors
    cleanedLinkedSentence = cleanedLinkedSentence.replace(/[,，、]/g, '');
    cleanedLinkedSentence = cleanedLinkedSentence.split('').filter(char => {
      const code = char.charCodeAt(0);
      return code !== 44 && code !== 65292 && code !== 12289;
    }).join('');

    // Validate and fix phonetic transcription
    let finalPhonetic = parsed.fullLinkedPhonetic || '';

    // Check if phonetic is complete
    if (!isPhoneticComplete(text, finalPhonetic)) {
      console.warn("⚠️ AI phonetic incomplete, generating fallback");
      finalPhonetic = generateFallbackPhonetic(cleanedLinkedSentence);
    } else {
      // Fix common AI errors (missing /s/ in "this", etc.)
      finalPhonetic = fixCommonPhoneticErrors(text, finalPhonetic);

      // Ensure linking marks match between text and phonetic
      finalPhonetic = validateLinkedPhonetic(cleanedLinkedSentence, finalPhonetic);
    }

    // ALWAYS add ˈ to content words — runs on ALL paths (AI, fallback, etc.)
    finalPhonetic = addPrimaryStress(finalPhonetic, cleanedLinkedSentence, parsed.intonationMap || '');

    console.log("✅ Using AI result with validated phonetics:", {
      originalSentence: parsed.fullLinkedSentence,
      cleanedSentence: cleanedLinkedSentence,
      originalPhonetic: parsed.fullLinkedPhonetic,
      fixedPhonetic: finalPhonetic
    });

    return {
      ...parsed,
      fullLinkedSentence: cleanedLinkedSentence,
      fullLinkedPhonetic: finalPhonetic
    };
  } catch (error) {
    console.error("❌ Linking Analysis Error:", error);
    const fallback = generateSmartFallback(text);
    fallback.fullLinkedPhonetic = addPrimaryStress(
      fallback.fullLinkedPhonetic, fallback.fullLinkedSentence, fallback.intonationMap
    );
    console.log("✅ Smart fallback generated:", fallback);
    return fallback;
  }
};
