import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const DEFINE_SYSTEM_INSTRUCTION = `You are an English-Chinese dictionary inside a pronunciation learning app.
Given a word and the sentence it appears in, return:
- "ipa": American English IPA for the word, wrapped in slashes
- "meaning": concise Simplified Chinese meaning (≤ 20 characters) that fits THIS sentence's context

Example: word "going" in "How is it going?" → {"ipa":"/ˈgoʊɪŋ/","meaning":"（近况）进展"}

Return ONLY valid JSON with exactly these 2 fields. No markdown, no explanation.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { word, sentence } = req.body;
    if (!word || !sentence) return res.status(400).json({ error: 'Missing word or sentence' });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Word: "${word}"\nSentence: "${sentence}"`,
      config: {
        systemInstruction: DEFINE_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
      },
    });

    const resultText = response.text || '{}';
    const parsed = JSON.parse(resultText.replace(/```json|```/g, '').trim());
    res.status(200).json(parsed);
  } catch (error: any) {
    console.error('Word Definition Error:', error);
    res.status(500).json({ error: error.message || 'Word definition failed' });
  }
}
