import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text, slow, voiceName, tutor } = req.body;
    if (!text) return res.status(400).json({ error: 'Missing text' });

    const prompt = tutor
      ? `Pronounce clearly in standard American English with natural flap-T (e.g., "water" sounds like "wader", "due to" sounds like "due-duh"): "${text}"`
      : slow
        ? `Speak slowly and clearly in standard American English, with deliberate pauses at commas and periods so each clause is easy to follow: ${text}`
        : `Read in natural standard American English with: proper flap-T (water→wader, better→bedder, "due to"→"due-duh"), rhotic r, natural word linking, AND conversational prosody — brief breath pause at commas, longer pause at periods, NOT a flat monotone: ${text}`;

    const callTTS = () => {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(Object.assign(new Error('TTS timeout'), { code: 'TIMEOUT' })), 20000)
      );
      const generate = ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' } },
          },
        },
      });
      return Promise.race([generate, timeout]);
    };

    // Try once, retry once on timeout
    let response;
    try {
      response = await callTTS();
    } catch (e: any) {
      if (e.code === 'TIMEOUT') {
        console.warn('TTS first attempt timed out, retrying...');
        response = await callTTS();
      } else {
        throw e;
      }
    }

    const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
    res.status(200).json({ audio: data });
  } catch (error: any) {
    console.error('TTS Error:', error);
    const status = (error as any).code === 'TIMEOUT' ? 504 : 500;
    res.status(status).json({ error: error.message || 'TTS generation failed' });
  }
}
