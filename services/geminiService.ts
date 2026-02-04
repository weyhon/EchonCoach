
import { GoogleGenAI, Modality } from "@google/genai";
import { AnalysisResult } from "../types";

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

3. 'fullLinkedPhonetic': IPA transcription of the complete sentence with linking effects.

Example for "Do you like it?":
{
  "fullLinkedSentence": "Do you like‿it?",
  "intonationMap": "· · ● ·↗",
  "fullLinkedPhonetic": "du ju laɪ kɪt"
}

Example for long sentence "Enter the code displayed in the app":
{
  "fullLinkedSentence": "Enter‿the code displayed‿in the‿app",
  "intonationMap": "● · ● ● · · ●↘",
  "fullLinkedPhonetic": "ɛn tər ðə koʊd dɪˈspleɪd ɪn ði æp"
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
const FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'have', 'has', 'had',
  'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'her', 'its', 'our', 'their',
  'this', 'that', 'these', 'those',
  'and', 'or', 'but', 'so', 'if', 'as', 'than'
]);

const generateSmartFallback = (text: string): any => {
  const words = text.split(/\s+/);
  const tokens = words.map(w => w.replace(/[?.!,;]/g, ''));

  // Generate intonation map
  const intonationTokens = tokens.map((token, i) => {
    const isLast = i === tokens.length - 1;
    const isFunction = FUNCTION_WORDS.has(token.toLowerCase());

    if (isLast) {
      // Last word: add intonation direction
      const hasQuestion = text.includes('?');
      return (isFunction ? '·' : '●') + (hasQuestion ? '↗' : '↘');
    }
    return isFunction ? '·' : '●';
  });

  // Generate linked sentence with connecting marks
  let linkedSentence = '';
  for (let i = 0; i < words.length; i++) {
    linkedSentence += words[i];
    if (i < words.length - 1) {
      const currentEndsWithConsonant = /[bcdfghjklmnpqrstvwxyz]$/i.test(words[i].replace(/[?.!,;]/g, ''));
      const nextStartsWithVowel = /^[aeiou]/i.test(words[i + 1]);
      if (currentEndsWithConsonant && nextStartsWithVowel) {
        linkedSentence += '‿';
      } else {
        linkedSentence += ' ';
      }
    }
  }

  return {
    fullLinkedSentence: linkedSentence,
    fullLinkedPhonetic: tokens.map(t => t.toLowerCase()).join(' '),
    intonationMap: intonationTokens.join(' ')
  };
};

export const getLinkingAnalysisForText = async (text: string): Promise<any> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", // Use Flash for instant linking analysis
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
      console.log("✅ Smart fallback generated:", fallback);
      return fallback;
    }

    console.log("✅ Using AI result");
    return parsed;
  } catch (error) {
    console.error("❌ Linking Analysis Error:", error);
    const fallback = generateSmartFallback(text);
    console.log("✅ Smart fallback generated:", fallback);
    return fallback;
  }
};
