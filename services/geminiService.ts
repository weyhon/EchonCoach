
import { GoogleGenAI, Modality } from "@google/genai";
import { AnalysisResult } from "../types";
import { API_CONFIG } from "../config/constants";
import { shouldLink } from "./linkingUtils";
import {
  isPhoneticComplete,
  fixCommonPhoneticErrors,
  generateFallbackPhonetic,
  validateLinkedPhonetic
} from "./phoneticUtils";
import { generateIntonationMap } from "./intonationUtils";

// ── API mode: proxy (production) vs direct (local dev) ──────────────
// In production (Vercel), calls go through /api/* serverless functions
// so the API key never reaches the browser.
// In local dev with VITE_API_KEY set, calls go direct for convenience.

const USE_PROXY = !import.meta.env.VITE_API_KEY;

let ai: InstanceType<typeof GoogleGenAI> | null = null;
if (!USE_PROXY) {
  ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
}

// ── Proxy fetch helper with retry ──────────────────────────────────
async function proxyPost(endpoint: string, body: Record<string, any>, timeoutMs = 25000): Promise<any> {
  let lastError: any;
  for (let attempt = 0; attempt < API_CONFIG.RETRY_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        const status = res.status;
        // Don't retry on 4xx client errors (bad request, auth, rate limit)
        if (status >= 400 && status < 500) {
          throw new Error(err.error || `API ${endpoint} failed (${status})`);
        }
        // 5xx server errors — retry
        throw new Error(err.error || `API ${endpoint} server error (${status})`);
      }
      return res.json();
    } catch (e: any) {
      lastError = e;
      if (e.name === 'AbortError') {
        lastError = new Error('Request timed out. Please try again.');
        (lastError as any).code = 'REQUEST_TIMEOUT';
      }
      // Don't retry on client errors or if last attempt
      if ((e.message && /4\d{2}/.test(e.message)) || attempt === API_CONFIG.RETRY_ATTEMPTS - 1) {
        break;
      }
      // Wait before retry with exponential backoff
      await new Promise(r => setTimeout(r, API_CONFIG.RETRY_DELAY * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

// ── TTS ─────────────────────────────────────────────────────────────

export const generateSpeech = async (text: string, slow: boolean = false, voiceName: string = 'Kore'): Promise<string> => {
  if (USE_PROXY) {
    const data = await proxyPost('tts', { text, slow, voiceName });
    return data.audio || '';
  }

  try {
    const prompt = slow
      ? `Speak slowly and clearly with standard American English pronunciation: ${text}`
      : `Read with standard American English pronunciation, natural stress and intonation: ${text}`;
    const response = await ai!.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
  } catch (error) {
    console.error("TTS Generation Error:", error);
    throw error;
  }
};

export const generateTutorAudio = async (text: string, voiceName: string = 'Kore'): Promise<string> => {
  if (USE_PROXY) {
    const data = await proxyPost('tts', { text, voiceName, tutor: true });
    return data.audio || '';
  }

  try {
    const response = await ai!.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Pronounce clearly with standard American English stress and intonation: "${text}"` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
  } catch (error) {
    console.error("Tutor Audio Error:", error);
    throw error;
  }
};

// ── Pronunciation Analysis ──────────────────────────────────────────

const PRONUNCIATION_ANALYSIS_INSTRUCTION = `You are an expert English pronunciation evaluator with deep phonetics knowledge.

Your task: Listen carefully to the audio and compare EVERY word to the reference sentence. You MUST identify what the learner actually said, even when close to correct.

## MANDATORY FIELDS — never omit these

For EVERY word in wordBreakdown:
- "phoneticUser": REQUIRED — write what the learner actually produced in IPA.
  - If perfect: copy phoneticCorrect exactly.
  - If different: write the actual sounds heard (e.g. "wɛri" instead of "vɛri").
- "phonemes": REQUIRED for every word with wordScore < 90.
  - Each phoneme entry MUST include "userPhoneme" when score < 85, even if close.

## Scoring Rubric (0-100)

### 90-100: Excellent — all phonemes correct, natural rhythm, proper linking
### 75-89: Good — 1-2 minor substitutions, correct stress, slight accent
### 60-74: Fair — noticeable errors, some stress issues, choppy rhythm
### 40-59: Needs Work — frequent errors affecting clarity, wrong stress
### 0-39: Significant — most phonemes wrong, very hard to understand

## Focus Areas

1. **Vowels**: /æ/ vs /ɛ/, /ɪ/ vs /iː/, /ʊ/ vs /uː/, /ɑː/ vs /ʌ/, /ɜːr/ vs /ɔ/
2. **Consonants**: /θ/ /ð/ (often → /s/ /z/ or /t/ /d/), /r/ vs /l/, /v/ vs /w/ or /b/
3. **Final consonants**: dropped /t/ /d/ /s/ /z/ at word endings
4. **Stress**: primary stress on content words, weak forms for function words
5. **Intonation & linking**: rising yes/no questions, falling statements
6. **Common L2 errors**: adding vowels between consonant clusters, shortening long vowels

## Word Status

- "correct": sounds accurate, stress right — phoneticUser still REQUIRED
- "needs_improvement": understandable but noticeable issues
- "incorrect": phoneme substitution that obscures the word

## Output Format (strict JSON — no markdown, no extra text)

{
  "score": <0-100>,
  "overallComment": "<1-2 sentences: most impactful improvement the learner can make>",
  "speechScript": "<exact reference text>",
  "wordBreakdown": [
    {
      "word": "<word>",
      "status": "correct" | "needs_improvement" | "incorrect",
      "phoneticCorrect": "<correct IPA, no stress marks>",
      "phoneticUser": "<REQUIRED: what learner actually produced in IPA>",
      "wordScore": <0-100>,
      "phonemes": [
        {
          "phoneme": "<correct phoneme>",
          "score": <0-100>,
          "userPhoneme": "<REQUIRED when score < 85: what learner produced>"
        }
      ],
      "suggestion": "<physical tip: tongue position, lip shape, airflow — empty string if correct>"
    }
  ],
  "fullLinkedSentence": "<reference with ‿ linking>",
  "fullLinkedPhonetic": "<IPA with ˈ on content words, . at linking points>",
  "intonationMap": "<space-separated ● · tokens, last token has ↗ or ↘>"
}

CRITICAL:
- Be honest, not flattering. Do not inflate scores.
- phoneticUser is NEVER optional. Always fill it in.
- If audio is silent or unintelligible, return score 0.`;

const ANALYSIS_MODELS = ["gemini-3.1-pro-preview", "gemini-3-flash-preview"] as const;

export const analyzePronunciation = async (
  referenceText: string,
  userAudioBase64: string
): Promise<AnalysisResult> => {
  if (USE_PROXY) {
    return proxyPost('analyze', { referenceText, audioBase64: userAudioBase64 });
  }

  let lastError: any;
  for (const model of ANALYSIS_MODELS) {
    try {
      console.log(`Trying pronunciation analysis with ${model}...`);
      const response = await ai!.models.generateContent({
        model,
        contents: {
          parts: [
            { inlineData: { mimeType: "audio/webm", data: userAudioBase64 } },
            { text: `Reference sentence: "${referenceText}"\n\nListen to my recording and evaluate my pronunciation of this sentence. Score each word individually and provide overall feedback.` }
          ]
        },
        config: {
          systemInstruction: PRONUNCIATION_ANALYSIS_INSTRUCTION,
          responseMimeType: "application/json",
        }
      });
      const text = response.text || "{}";
      console.log(`Analysis succeeded with ${model}`);
      return JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch (error) {
      console.error(`${model} failed:`, error);
      lastError = error;
    }
  }
  throw lastError;
};

// ── Linking / Prosody Analysis ──────────────────────────────────────

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

// Smart fallback rules for American English pronunciation
const generateSmartFallback = (text: string): any => {
  const words = text.split(/\s+/);
  const intonationMap = generateIntonationMap(text, words);

  let linkedSentence = '';
  for (let i = 0; i < words.length; i++) {
    linkedSentence += words[i];
    if (i < words.length - 1) {
      if (shouldLink(words[i], words[i + 1])) {
        linkedSentence += '‿';
      } else {
        linkedSentence += ' ';
      }
    }
  }

  let fallbackPhonetic = generateFallbackPhonetic(linkedSentence);
  fallbackPhonetic = fixCommonPhoneticErrors(text, fallbackPhonetic);

  return {
    fullLinkedSentence: linkedSentence,
    fullLinkedPhonetic: fallbackPhonetic,
    intonationMap
  };
};

// IPA phonetics of common function words — these should NOT receive ˈ
const FUNCTION_PHONETICS = new Set([
  'ðə','ðɪ','ə','ɑn','ɔn',
  'ɪn','æt','tu','tə','fɔr','fər','wɪð','frɑm','frəm','ʌv','əv',
  'ænd','ənd','ɔr','ər','bʌt',
  'aɪ','ju','hi','ʃi','wi','ðeɪ','ɪt',
  'mi','hɪm','hɚ','ʌs','ðɛm',
  'maɪ','jɚ','jər','hɪz','ɪts','ɑr','ðɛr','ðer',
  'bi','bɪn','ɪz','wɑz','wɚ','wəz',
  'hæv','həv','hæz','həz','hæd','həd',
  'du','dʊ','dʌz','dɪd',
  'kæn','kən','kʊd','wɪl','wəl','wʊd','wəd','ʃʊd','ʃəd',
  'nɑt','nət','ðæt','ðɪs','ðoʊz','ðiz',
]);

const addPrimaryStress = (phonetic: string, linkedSentence: string, intonationMap: string): string => {
  const phoneticSegments = phonetic.split(' ');
  const wordGroups = linkedSentence.trim().split(/\s+/);
  const tokens = intonationMap.trim().split(/\s+/).filter(Boolean);

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

  return phoneticSegments.map(seg => {
    if (seg.includes('ˈ')) return seg;
    const base = seg.split('.')[0];
    return FUNCTION_PHONETICS.has(base) ? seg : 'ˈ' + seg;
  }).join(' ');
};

export const getLinkingAnalysisForText = async (text: string): Promise<any> => {
  try {
    let parsed: any;

    if (USE_PROXY) {
      parsed = await proxyPost('linking', { text });
    } else {
      const response = await ai!.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Perform prosody analysis for: "${text}"`,
        config: {
          systemInstruction: TUTOR_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
        }
      });
      const resultText = response.text || "{}";
      parsed = JSON.parse(resultText.replace(/```json|```/g, '').trim());
    }

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

    if (!parsed.fullLinkedSentence || !parsed.intonationMap || tokenCount !== wordCount) {
      console.warn("⚠️ AI response incomplete or mismatched, using smart fallback");
      const fallback = generateSmartFallback(text);
      fallback.fullLinkedPhonetic = addPrimaryStress(
        fallback.fullLinkedPhonetic, fallback.fullLinkedSentence, fallback.intonationMap
      );
      console.log("✅ Smart fallback generated:", fallback);
      return fallback;
    }

    // Clean linked sentence
    let cleanedLinkedSentence = parsed.fullLinkedSentence || text;
    cleanedLinkedSentence = cleanedLinkedSentence.replace(/[,，、]/g, '');
    cleanedLinkedSentence = cleanedLinkedSentence.split('').filter((char: string) => {
      const code = char.charCodeAt(0);
      return code !== 44 && code !== 65292 && code !== 12289;
    }).join('');

    let finalPhonetic = parsed.fullLinkedPhonetic || '';

    if (!isPhoneticComplete(text, finalPhonetic)) {
      console.warn("⚠️ AI phonetic incomplete, generating fallback");
      finalPhonetic = generateFallbackPhonetic(cleanedLinkedSentence);
    } else {
      finalPhonetic = fixCommonPhoneticErrors(text, finalPhonetic);
      finalPhonetic = validateLinkedPhonetic(cleanedLinkedSentence, finalPhonetic);
    }

    finalPhonetic = addPrimaryStress(finalPhonetic, cleanedLinkedSentence, parsed.intonationMap || '');

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
