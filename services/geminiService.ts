
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const TUTOR_SYSTEM_INSTRUCTION = `You are a world-class English Phonetics Coach.
Your goal is to break down a sentence for a beginner, focusing on Linking (连读) and Intonation (语调).

STRICT RULES:
1. 'fullLinkedSentence': Use '‿' between words that naturally link in American English (e.g., "tell‿us", "take‿it").
2. 'intonationMap': Space-separated tokens for EACH word.
   - Use '●' for stressed words, '·' for unstressed.
   - MANDATORY: The VERY LAST word must include a direction symbol: '↗' (Rise) or '↘' (Fall).
   - Questions (Do/Is/Are...?) usually end with '↗'. Statements end with '↘'.
3. 'fullLinkedPhonetic': Provide the phonetic transcription of the WHOLE sentence, including linking effects.

Example for "Do you like it?":
{
  "fullLinkedSentence": "Do you like‿it?",
  "intonationMap": "· · ● ·↗",
  "fullLinkedPhonetic": "du ju laɪ kɪt"
}

Respond ONLY in valid JSON.`;

export const generateSpeech = async (text: string, slow: boolean = false): Promise<string> => {
  try {
    const prompt = slow ? `Speak slowly and clearly: ${text}` : `Natural American English: ${text}`;
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
      contents: [{ parts: [{ text: `Pronounce carefully: "${text}"` }] }],
      config: {
        responseModalalities: [Modality.AUDIO],
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
      model: "gemini-3-pro-preview",
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

export const getLinkingAnalysisForText = async (text: string): Promise<any> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // Use Flash for instant linking analysis
      contents: `Perform prosody analysis for: "${text}"`,
      config: {
        systemInstruction: TUTOR_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
      }
    });
    const resultText = response.text || "{}";
    return JSON.parse(resultText.replace(/```json|```/g, '').trim());
  } catch (error) {
    console.error("Linking Analysis Error:", error);
    return {
      fullLinkedSentence: text,
      fullLinkedPhonetic: "analysis failed",
      intonationMap: text.split(' ').map(() => "●").join(' ') + "↘"
    };
  }
};
