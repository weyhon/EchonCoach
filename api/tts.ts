import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text, slow, voiceName, tutor } = req.body;
    if (!text) return res.status(400).json({ error: 'Missing text' });

    const prompt = tutor
      ? `Pronounce clearly with standard American English stress and intonation: "${text}"`
      : slow
        ? `Speak slowly and clearly with standard American English pronunciation: ${text}`
        : `Read with standard American English pronunciation, natural stress and intonation: ${text}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' } },
        },
      },
    });

    const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
    res.status(200).json({ audio: data });
  } catch (error: any) {
    console.error('TTS Error:', error);
    res.status(500).json({ error: error.message || 'TTS generation failed' });
  }
}
