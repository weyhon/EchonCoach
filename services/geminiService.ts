
import { GoogleGenAI, Modality } from "@google/genai";
import { AnalysisResult } from "../types";
import { API_CONFIG } from "../config/constants";
import { shouldLink, enrichLinkedSentence } from "./linkingUtils";
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
      ? `Speak slowly and clearly in standard American English, with deliberate pauses at commas and periods so each clause is easy to follow: ${text}`
      : `Read in natural standard American English with: proper flap-T (water→wader, better→bedder, "due to"→"due-duh"), rhotic r, natural word linking, AND conversational prosody — brief breath pause at commas, longer pause at periods, NOT a flat monotone: ${text}`;
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
      contents: [{ parts: [{ text: `Pronounce clearly in standard American English with natural flap-T (e.g., "water" sounds like "wader", "due to" sounds like "due-duh"): "${text}"` }] }],
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

// Slim prompt: scoring only — linking/prosody is merged from cache separately
const PRONUNCIATION_SCORING_INSTRUCTION = `You are an expert English pronunciation evaluator.

Listen to the audio and score EVERY word against the reference sentence.

## MANDATORY: For EVERY word in wordBreakdown
- "phoneticUser": REQUIRED — IPA of what the learner actually produced. Copy phoneticCorrect if perfect.
- "phonemes": REQUIRED when wordScore < 90. Each entry MUST have "userPhoneme" when score < 85.

## Scoring (0-100)
- 90-100: all phonemes correct, natural rhythm
- 75-89: 1-2 minor substitutions, correct stress
- 60-74: noticeable errors, some stress issues
- 40-59: frequent errors affecting clarity
- 0-39: most phonemes wrong

## Focus: /æ/ɛ/, /ɪ/iː/, /θ/ð/→/s/z/, /r/l/, /v/w/, dropped final consonants, stress placement

## Status: "correct" | "needs_improvement" | "incorrect"

## JSON Output (no markdown):
{
  "score": <0-100>,
  "overallComment": "<1 sentence: most impactful tip>",
  "speechScript": "<exact reference>",
  "wordBreakdown": [
    {
      "word": "<word>",
      "status": "<status>",
      "phoneticCorrect": "<correct IPA>",
      "phoneticUser": "<REQUIRED: learner IPA>",
      "wordScore": <0-100>,
      "phonemes": [{ "phoneme": "<correct>", "score": <0-100>, "userPhoneme": "<learner>" }],
      "suggestion": "<tip or empty>"
    }
  ]
}

CRITICAL: Be honest. phoneticUser is NEVER optional. Silent/unintelligible = score 0.`;

// Full prompt: includes linking/prosody fields (used when no cache available)
const PRONUNCIATION_FULL_INSTRUCTION = `${PRONUNCIATION_SCORING_INSTRUCTION.replace(
  '## JSON Output (no markdown):',
  '## JSON Output (no markdown) — include linking fields:'
).replace(
  `    }
  ]
}`,
  `    }
  ],
  "fullLinkedSentence": "<reference with ‿ linking>",
  "fullLinkedPhonetic": "<IPA with ˈ on content words, . at linking points>",
  "intonationMap": "<space-separated ● · tokens, last token has ↗ or ↘>"
}`
)}`;

// Flash model only — pronunciation scoring doesn't need pro-level reasoning
const ANALYSIS_MODEL = "gemini-3-flash-preview";

export const analyzePronunciation = async (
  referenceText: string,
  userAudioBase64: string,
  /** When true, omit linking/prosody fields from prompt for faster response */
  slim = false,
): Promise<AnalysisResult> => {
  const t0 = performance.now();
  if (USE_PROXY) {
    const result = await proxyPost('analyze', { referenceText, audioBase64: userAudioBase64, slim });
    console.log(`[perf] analyzePronunciation: ${((performance.now() - t0) / 1000).toFixed(1)}s (proxy, slim=${slim})`);
    return result;
  }

  const instruction = slim ? PRONUNCIATION_SCORING_INSTRUCTION : PRONUNCIATION_FULL_INSTRUCTION;
  const response = await ai!.models.generateContent({
    model: ANALYSIS_MODEL,
    contents: {
      parts: [
        { inlineData: { mimeType: "audio/webm", data: userAudioBase64 } },
        { text: `Reference sentence: "${referenceText}"\n\nEvaluate my pronunciation. Score each word.` }
      ]
    },
    config: {
      systemInstruction: instruction,
      responseMimeType: "application/json",
    }
  });
  const text = response.text || "{}";
  console.log(`[perf] analyzePronunciation: ${((performance.now() - t0) / 1000).toFixed(1)}s (direct, slim=${slim})`);
  return JSON.parse(text.replace(/```json|```/g, '').trim());
};

// ── Linking / Prosody Analysis ──────────────────────────────────────

const TUTOR_SYSTEM_INSTRUCTION = `You are a world-class English Phonetics Coach specializing in American English.
Your goal is to provide complete prosody analysis for ANY sentence, no matter how long.

AMERICAN ENGLISH PRONUNCIATION (apply throughout fullLinkedPhonetic):
- Flap-T: When /t/ sits between two vowel sounds AND the following vowel is unstressed,
  transcribe as /ɾ/ instead of /t/. Applies whether or not there's a ‿ linking mark.
  • Within word: water→ˈwɔɾər, better→ˈbɛɾər, city→ˈsɪɾi, getting→ˈɡɛɾɪŋ, party→ˈpɑrɾi
  • Across words: "due to"→duː ɾə, "get up"→ɡɛɾ ʌp, "what is"→wʌɾ ɪz, "a lot of"→ə ˈlɑɾ əv
- Rhotic /r/: always show r in r-colored vowels (work→ˈwɜrk, driver→ˈdraɪvər, more→mɔr).
- American vowels: /oʊ/ for go/home (NOT British /əʊ/), /æ/ for cat/dance, /ɑ/ for lot/hot.
- Weak forms: unstressed function words use their reduced SPOKEN form — to→tə, a→ə, an→ən,
  and→ənd, of→əv, for→fər, can→kən, was→wəz. The IPA must match how the sentence is
  actually spoken, not dictionary citation forms.
- Careful: main-verb "do"→du (NOT dʊ, NOT də). "too"/"two"→tu.

STRICT RULES:
1. 'fullLinkedSentence': Mark ALL natural linking points with '‿' in American English.
   - Consonant + Vowel: "tell‿us", "take‿it", "check‿out"
   - Same-consonant merge: when a word ENDS with the same consonant sound the next word
     STARTS with, link them — natives pronounce ONE consonant, not two:
     "out‿tonight", "gas‿station", "stop‿pushing", "what‿time"
     In fullLinkedPhonetic write that consonant ONCE: out‿tonight → aʊ.təˈnaɪt
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
   d2) CRITICAL — chain linking: N words joined by ‿ must produce ONE phonetic block
       with all atoms joined by dots. NEVER break the chain with a space.
       Example: "rebook‿us‿on‿a" (4 linked words) → "riˈbʊ.kʌ.sɑ.nə" (one block, three dots).
       Wrong: "riˈbʊ.kʌs ɑ.nə" (broken into two blocks).
   d3) CONSISTENCY — fullLinkedSentence and fullLinkedPhonetic MUST have the SAME number of
       space-separated blocks. If you merge words with dots in the phonetic, you MUST mark ‿
       at the same boundaries in the sentence. E.g. phonetic "ˈhæŋɪŋ.aʊ.təˈnaɪt" (one block)
       requires sentence "hanging‿out‿tonight" (one block). Check this before responding.
   e) Do NOT use ˌ (secondary stress). Do NOT use ‿ in fullLinkedPhonetic.

4. 'translation': a natural Simplified Chinese (简体中文) translation of the sentence.
   Conversational and idiomatic, NOT word-for-word. Capture the real meaning.

Example for "Do you like it?":
{
  "fullLinkedSentence": "Do you like‿it?",
  "intonationMap": "· · ● ·↗",
  "fullLinkedPhonetic": "du ju ˈlaɪ.kɪt",
  "translation": "你喜欢吗？"
}

Example for "Just tap your phone or pay the driver in cash":
{
  "fullLinkedSentence": "Just‿ tap your phone or‿ pay the‿driver‿in cash",
  "intonationMap": "● · · ● · ● · ● · ●↘",
  "fullLinkedPhonetic": "ˈdʒʌst ˈtæp jər ˈfoʊn ɔr.ˈpeɪ ðə.ˈdraɪ.vər.ɪn ˈkæʃ",
  "translation": "刷一下手机，或者付现金给司机就行。"
}

Example for long sentence "Enter the code displayed in the app":
{
  "fullLinkedSentence": "Enter‿the code displayed‿in the‿app",
  "intonationMap": "● · ● ● · · ●↘",
  "fullLinkedPhonetic": "ˈɛn.tər ðə ˈkoʊd dɪˈspleɪd.ɪn ði.ˈæp",
  "translation": "输入 app 里显示的验证码。"
}

Example demonstrating flap-T (note /t/→/ɾ/ in "due to"):
{
  "fullLinkedSentence": "It's due to personnel‿issues this time",
  "intonationMap": "· ● · ● ● · ●↘",
  "fullLinkedPhonetic": "ɪts ˈduː ɾə pɝrsəˈnɛl ˈɪʃuz ðɪs ˈtaɪm",
  "translation": "这次是因为人事问题。"
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

    // Deterministic safety net: the LLM often merges same-consonant pairs in the
    // phonetic ("out tonight" → aʊ.təˈnaɪt) but forgets the ‿ in the sentence.
    // Add the missing ‿ ourselves so arcs match what the audio actually does.
    cleanedLinkedSentence = enrichLinkedSentence(cleanedLinkedSentence);

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
