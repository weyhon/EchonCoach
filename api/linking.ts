import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

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

CRITICAL: For long sentences, you MUST include ALL words. Do not truncate or omit any words.
Respond ONLY in valid JSON.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Missing text' });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Perform prosody analysis for: "${text}"`,
      config: {
        systemInstruction: TUTOR_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
      },
    });

    const resultText = response.text || '{}';
    const parsed = JSON.parse(resultText.replace(/```json|```/g, '').trim());
    res.status(200).json(parsed);
  } catch (error: any) {
    console.error('Linking Analysis Error:', error);
    res.status(500).json({ error: error.message || 'Linking analysis failed' });
  }
}
