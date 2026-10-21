import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guard, tooLong } from './_guard.js';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// Keep in sync with PHRASE_SYSTEM_INSTRUCTION in services/geminiService.ts.
const PHRASE_SYSTEM_INSTRUCTION = `You mark thought groups for an English pronunciation learner.
Insert " / " where a native American speaker takes a short breath when reading the sentence aloud.
Rules:
- Copy EVERY word exactly as given, in the same order, with the same punctuation. Only add slashes.
- Break at commas and other punctuation inside the sentence.
- Without punctuation, break before a relative clause (who / which / that), before a long prepositional phrase, or after a long subject.
- Thought groups are usually 3–7 words. Do not split a sentence of 6 words or fewer unless it has punctuation.
Example: "Do you recommend it for someone who keeps a skeptical attitude toward medical aesthetics?"
→ {"phrasing":"Do you recommend it for someone / who keeps a skeptical attitude / toward medical aesthetics?"}
Return ONLY valid JSON: {"phrasing": "..."}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, { maxBodyBytes: 8_000 })) return;

  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Missing text' });
    if (tooLong(text, 2_000)) return res.status(400).json({ error: 'text too long' });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: text,
      config: {
        systemInstruction: PHRASE_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        // Phrasing is a small, mechanical edit; thinking only adds latency
        // in front of the audio, which waits for this call.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const resultText = response.text || '{}';
    const parsed = JSON.parse(resultText.replace(/```json|```/g, '').trim());
    res.status(200).json({ phrasing: typeof parsed.phrasing === 'string' ? parsed.phrasing : '' });
  } catch (error: any) {
    console.error('Phrasing Error:', error);
    res.status(500).json({ error: error.message || 'Phrasing failed' });
  }
}
