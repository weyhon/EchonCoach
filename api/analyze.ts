import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

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

const ANALYSIS_MODELS = ['gemini-3.1-pro-preview', 'gemini-3-flash-preview'] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { referenceText, audioBase64 } = req.body;
    if (!referenceText || !audioBase64) return res.status(400).json({ error: 'Missing referenceText or audioBase64' });

    let lastError: any;
    for (const model of ANALYSIS_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [
              { inlineData: { mimeType: 'audio/webm', data: audioBase64 } },
              { text: `Reference sentence: "${referenceText}"\n\nListen to my recording and evaluate my pronunciation of this sentence. Score each word individually and provide overall feedback.` },
            ],
          },
          config: {
            systemInstruction: PRONUNCIATION_ANALYSIS_INSTRUCTION,
            responseMimeType: 'application/json',
          },
        });
        const text = response.text || '{}';
        const result = JSON.parse(text.replace(/```json|```/g, '').trim());
        return res.status(200).json(result);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  } catch (error: any) {
    console.error('Analysis Error:', error);
    res.status(500).json({ error: error.message || 'Analysis failed' });
  }
}
