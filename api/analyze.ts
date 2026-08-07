import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guard, tooLong } from './_guard.js';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// Slim prompt: scoring only — no linking/prosody fields
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

// Full prompt with linking fields
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

// Flash model only — scoring doesn't need pro reasoning depth
const ANALYSIS_MODEL = 'gemini-3-flash-preview';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, { maxBodyBytes: 12_000_000 })) return;

  try {
    const { referenceText, audioBase64, slim } = req.body;
    if (!referenceText || !audioBase64) return res.status(400).json({ error: 'Missing referenceText or audioBase64' });
    if (tooLong(referenceText, 2_000)) return res.status(400).json({ error: 'referenceText too long' });

    const instruction = slim ? PRONUNCIATION_SCORING_INSTRUCTION : PRONUNCIATION_FULL_INSTRUCTION;
    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType: 'audio/webm', data: audioBase64 } },
          { text: `Reference sentence: "${referenceText}"\n\nEvaluate my pronunciation. Score each word.` },
        ],
      },
      config: {
        systemInstruction: instruction,
        responseMimeType: 'application/json',
      },
    });
    const text = response.text || '{}';
    const result = JSON.parse(text.replace(/```json|```/g, '').trim());
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Analysis Error:', error);
    res.status(500).json({ error: error.message || 'Analysis failed' });
  }
}
