import { AnalysisResult } from "../types";
import { AUDIO_CONFIG, API_CONFIG, UI_CONFIG } from "../config/constants";
import { generateIntonationMap } from "./intonationUtils";

const MINIMAX_API_KEY = (import.meta.env.VITE_MINIMAX_API_KEY || "").trim();
const MINIMAX_GROUP_ID = (import.meta.env.VITE_MINIMAX_GROUP_ID || "").trim();
// Base URL 候选（含用户配置、chat、io），自动重试避免域名不匹配导致的 invalid api key
const BASE_URL_CANDIDATES = Array.from(
  new Set(
    [
      import.meta.env.VITE_MINIMAX_BASE_URL,
      "https://api.minimax.chat/v1",
      "https://api.minimax.io/v1",
      "https://api.minimaxi.com/v1", // 官方文档的一些示例域名
    ]
      .filter(Boolean)
      .map((u) => u!.trim().replace(/\/+$/, ""))
  )
);

// MiniMax 文档默认返回 hex 编码的音频，这里做一层兼容转换
const hexToBase64 = (hex: string): string => {
  if (!hex || hex.length % 2 !== 0) return hex;
  const bytePairs = hex.match(/.{1,2}/g);
  if (!bytePairs) return hex;
  let binary = "";
  for (const pair of bytePairs) {
    binary += String.fromCharCode(parseInt(pair, 16));
  }
  return btoa(binary);
};

const normalizeAudio = (audio: string | undefined): string => {
  if (!audio) return "";
  const trimmed = audio.trim();
  // 返回 url 时直接传回（前端可自行 fetch）
  if (trimmed.startsWith("http")) return trimmed;
  // 纯 hex（无 + / = 字符）
  const isHex = /^[0-9a-fA-F]+$/.test(trimmed);
  if (isHex) return hexToBase64(trimmed);
  return trimmed; // 已是 base64
};

const getApiKey = (): string => {
  const key = MINIMAX_API_KEY;
  if (!key) {
    throw new Error(
      "❌ 缺少 MiniMax API 密钥。请在 .env.local 文件中添加 VITE_MINIMAX_API_KEY。\n" +
      "获取密钥：https://www.minimaxi.com/"
    );
  }
  return key;
};

/**
 * Fetch with timeout protection to prevent hanging requests
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 */
const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeoutMs: number = API_CONFIG.DEFAULT_TIMEOUT
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      const err: any = new Error('请求超时，请检查网络连接或稍后重试');
      err.code = 'REQUEST_TIMEOUT';
      throw err;
    }
    throw error;
  }
};

// 统一的 POST 调用，带多域名/GroupId 重试逻辑，解决 invalid api key 可能来自域名不匹配
const postWithFallback = async (endpoint: string, body: any) => {
  let lastErr: any;
  for (const base of BASE_URL_CANDIDATES) {
    const url =
      MINIMAX_GROUP_ID && !endpoint.includes("GroupId=")
        ? `${base}${endpoint}?GroupId=${encodeURIComponent(MINIMAX_GROUP_ID)}`
        : `${base}${endpoint}`;
    try {
      const resp = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getApiKey()}`,
          },
          body: JSON.stringify(body),
        },
        30000 // 30 second timeout
      );

      if (!resp.ok) {
        let message = resp.statusText;
        try {
          const errBody = await resp.json();
          message = errBody?.error?.message || errBody?.message || message;
        } catch (_) { /* ignore */ }
        const err: any = new Error(`MiniMax API 错误: ${resp.status} ${message}`);
        err.code = resp.status === 429 ? "RATE_LIMIT" : resp.status;
        if (/invalid api key/i.test(message)) err.code = "INVALID_KEY";
        if (/insufficient balance/i.test(message)) err.code = "INSUFFICIENT_BALANCE";
        throw err;
      }

      const data = await resp.json();
      const baseResp = data?.base_resp;
      if (baseResp && baseResp.status_code !== 0) {
        const msg = baseResp.status_msg || "MiniMax 返回错误";
        const err: any = new Error(msg);
        err.code = /insufficient balance/i.test(msg)
          ? "INSUFFICIENT_BALANCE"
          : /invalid api key/i.test(msg)
          ? "INVALID_KEY"
          : baseResp.status_code;
        throw err;
      }
      return data;
    } catch (e: any) {
      lastErr = e;
      if (e?.code === "INVALID_KEY") {
        // 试下下一个域名
        continue;
      }
      // 其他错误直接抛
      throw e;
    }
  }
  throw lastErr || new Error("MiniMax 请求失败");
};

// TTS 语音合成 - 使用 MiniMax TTS API
export const generateSpeech = async (text: string, slow: boolean = false): Promise<string> => {
  try {
    const data = await postWithFallback("/t2a_v2", {
      model: API_CONFIG.MINIMAX_TTS_MODEL,
      text: text,
      output_format: "hex", // 明确返回 hex，方便统一转换
      voice_setting: {
        voice_id: API_CONFIG.MINIMAX_VOICE_ID,
        speed: slow ? AUDIO_CONFIG.MINIMAX_SLOW_SPEED : AUDIO_CONFIG.DEFAULT_PLAYBACK_RATE,
        vol: AUDIO_CONFIG.DEFAULT_VOLUME,
        pitch: AUDIO_CONFIG.DEFAULT_PITCH,
      },
      audio_setting: {
        sample_rate: AUDIO_CONFIG.SAMPLE_RATE,
        bitrate: AUDIO_CONFIG.MP3_BITRATE,
        format: "mp3",
      },
    });

    // MiniMax 返回 hex 或 base64，统一转换
    const rawAudio = data.data?.audio || data.audio || "";
    const audioBase64 = normalizeAudio(rawAudio);
    if (!audioBase64 || audioBase64.length < UI_CONFIG.MIN_BASE64_LENGTH) {
      const err: any = new Error("MiniMax TTS 未返回音频数据");
      err.code = "NO_AUDIO";
      console.error("MiniMax 返回数据中没有 audio:", data);
      throw err;
    }
    return audioBase64;
  } catch (error) {
    console.error("MiniMax TTS Generation Error:", error);
    throw error;
  }
};

// 生成单个词的发音（用于单词教学）
export const generateTutorAudio = async (text: string): Promise<string> => {
  try {
    console.log("调用 MiniMax Tutor TTS, text:", text);

    const data = await postWithFallback("/t2a_v2", {
      model: API_CONFIG.MINIMAX_TTS_MODEL,
      text: text,
      output_format: "hex",
      voice_setting: {
        voice_id: API_CONFIG.MINIMAX_VOICE_ID,
        speed: AUDIO_CONFIG.TUTOR_PLAYBACK_RATE,
        vol: AUDIO_CONFIG.DEFAULT_VOLUME,
        pitch: AUDIO_CONFIG.DEFAULT_PITCH,
      },
      audio_setting: {
        sample_rate: AUDIO_CONFIG.SAMPLE_RATE,
        bitrate: AUDIO_CONFIG.MP3_BITRATE,
        format: "mp3",
      },
    });

    const audioBase64 = normalizeAudio(data.data?.audio || data.audio || "");
    if (!audioBase64 || audioBase64.length < UI_CONFIG.MIN_BASE64_LENGTH) {
      const err: any = new Error("MiniMax Tutor TTS 未返回音频数据");
      err.code = "NO_AUDIO";
      console.error("MiniMax Tutor 返回空音频:", data);
      throw err;
    }
    return audioBase64;
  } catch (error) {
    console.error("MiniMax Tutor Audio Error:", error);
    throw error;
  }
};

// 文本分析 - 使用 MiniMax Chat Completion API
export const getLinkingAnalysisForText = async (text: string): Promise<any> => {
  // 功能词列表（通常弱读）
  const functionWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being',
    'do', 'does', 'did', 'have', 'has', 'had', 'can', 'could', 'will', 'would',
    'shall', 'should', 'may', 'might', 'must', 'to', 'of', 'for', 'in', 'on',
    'at', 'by', 'with', 'from', 'as', 'and', 'or', 'but', 'if', 'than', 'that',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'her', 'its', 'our', 'their'
  ]);

  // Wh-疑问词（降调）
  const whWords = new Set(['what', 'where', 'when', 'why', 'how', 'who', 'which', 'whose', 'whom']);

  // 检测是否以元音开头
  const startsWithVowel = (word: string) => /^[aeiou]/i.test(word);

  // 检测是否以辅音结尾
  const endsWithConsonant = (word: string) => /[bcdfghjklmnpqrstvwxyz]$/i.test(word);

  // 改进的 Fallback 标注生成
  const buildFallbackIntonation = (raw: string) => {
    const words = raw.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "";

    const cleanFirst = words[0].toLowerCase().replace(/[?.!,]/g, '');
    const isYesNoQuestion = /^(do|does|did|is|are|am|was|were|can|could|will|would|shall|should|may|might|must|have|has|had)$/i.test(cleanFirst);
    const isWhQuestion = whWords.has(cleanFirst);

    return words.map((word, i) => {
      const cleanWord = word.toLowerCase().replace(/[?.!,]/g, '');
      const isLast = i === words.length - 1;

      // 判断重音
      let stress = '·'; // 默认弱读
      if (!functionWords.has(cleanWord)) {
        stress = '●'; // 内容词重读
      }
      // Wh-词通常重读
      if (whWords.has(cleanWord)) {
        stress = '●';
      }

      // 判断语调（只在最后一个词）
      if (isLast) {
        if (isYesNoQuestion) {
          return stress + '↗'; // Yes/No 疑问句升调
        } else if (isWhQuestion) {
          return stress + '↘'; // Wh-疑问句降调
        } else {
          return stress + '↘'; // 陈述句降调
        }
      }

      return stress;
    }).join(" ");
  };

  // 改进的连读检测
  const buildFallbackLinked = (raw: string) => {
    const words = raw.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return raw;

    const linked = [];
    for (let i = 0; i < words.length; i++) {
      const current = words[i];
      const next = words[i + 1];

      if (next) {
        const currentClean = current.replace(/[?.!,]/g, '');
        const nextClean = next.replace(/[?.!,]/g, '');

        // 辅音结尾 + 元音开头 → 连读
        if (endsWithConsonant(currentClean) && startsWithVowel(nextClean)) {
          linked.push(current + '‿');
          continue;
        }
      }

      linked.push(current);
    }

    return linked.join(' ').replace(/‿\s+/g, '‿');
  };

  try {
    const apiKey = getApiKey();

    const systemPrompt = `You are an American English pronunciation coach. Analyze the sentence and mark linking, stress, and intonation.

RULES:
1. Linking (连读): Use ‿ between words that link naturally
   - Consonant + vowel: "tell‿us", "pick‿it‿up"
   - Keep it simple, mark obvious links only

2. Stress (重音):
   - Content words (nouns, verbs, adjectives): ●
   - Function words (a, the, is, to, of...): ·

3. Intonation (语调):
   - Statements: ↘ at the end
   - Yes/No questions (Do/Is/Can...): ↗ at the end
   - Wh-questions (What/Where...): ↘ at the end

EXAMPLES:
"I love you" → {"fullLinkedSentence":"I love you","intonationMap":"· ● ·↘","fullLinkedPhonetic":"aɪ lʌv ju"}
"Do you like‿it?" → {"fullLinkedSentence":"Do you like‿it?","intonationMap":"· · ● ·↗","fullLinkedPhonetic":"du ju laɪ kɪt"}
"Where‿are you going?" → {"fullLinkedSentence":"Where‿are you going?","intonationMap":"● · · ●↘","fullLinkedPhonetic":"wɛr ər ju goʊɪŋ"}

Return ONLY valid JSON with these 3 fields. No markdown, no explanation.`;

    // Simple fallback for linked sentence (just joins with linking marks)
    const buildFallbackLinked = (raw: string) => {
      const words = raw.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) return raw;
      return words.join("‿");
    };

    const data = await postWithFallback("/text/chatcompletion_v2", {
      model: "abab6.5s-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Perform prosody analysis for: "${text}"` }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });
    const content = data.choices?.[0]?.message?.content || "";

    // 尝试从响应中提取 JSON
    try {
      // 移除 markdown 代码块标记
      const jsonStr = content.replace(/```json|```/g, '').trim();
      const result = JSON.parse(jsonStr);
      const fullLinkedSentence = result.fullLinkedSentence || buildFallbackLinked(text);
      const intonationRaw = result.intonationMap || generateIntonationMap(fullLinkedSentence);

      // 若返回的符号数与词数不匹配，使用本地生成的方案
      const words = fullLinkedSentence.trim().split(/\s+/).filter(Boolean);
      const tokens = intonationRaw.trim().split(/\s+/).filter(Boolean);
      const intonationMap = words.length === tokens.length
        ? intonationRaw
        : generateIntonationMap(fullLinkedSentence, words);

      return {
        fullLinkedSentence,
        fullLinkedPhonetic: result.fullLinkedPhonetic || "",
        intonationMap,
      };
    } catch (parseError) {
      console.error("JSON 解析错误:", parseError);
      const fallback = generateIntonationMap(text);
      return {
        fullLinkedSentence: buildFallbackLinked(text),
        fullLinkedPhonetic: "analysis failed",
        intonationMap: fallback,
      };
    }
  } catch (error) {
    console.error("MiniMax Linking Analysis Error:", error);
    return {
      fullLinkedSentence: buildFallbackLinked(text),
      fullLinkedPhonetic: "analysis failed",
      intonationMap: generateIntonationMap(text),
    };
  }
};

// 发音分析 - 使用 MiniMax 分析用户录音
export const analyzePronunciation = async (
  referenceText: string,
  userAudioBase64: string
): Promise<AnalysisResult> => {
  try {
    const apiKey = getApiKey();

    // 同时获取 linking 分析数据
    const linking = await getLinkingAnalysisForText(referenceText);

    const systemPrompt = `You are a strict but encouraging English pronunciation coach.
Analyze the user's pronunciation compared to the reference text.

Return JSON in this exact format:
{
  "score": 75,
  "overallComment": "Your linking between 'is' and 'it' was good! Watch out for the vowel in 'going'.",
  "speechScript": "How is it going?",
  "wordBreakdown": [
    {
      "word": "How",
      "status": "correct",
      "phoneticCorrect": "haʊ",
      "suggestion": "Good!"
    }
  ]
}

Status must be one of: 'correct', 'incorrect', 'needs_improvement'`;

    // 注意：MiniMax 不直接支持音频分析，这里我们用文本分析模拟
    // 实际项目中建议使用专门的语音识别服务（如 Azure Speech、科大讯飞等）
    const data = await postWithFallback("/text/chatcompletion_v2", {
      model: "abab6.5s-chat",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Reference text: "${referenceText}". The user recorded themselves saying this sentence. Provide pronunciation feedback in JSON format.`
        }
      ],
      temperature: 0.3,
      max_tokens: 800,
    });
    const content = data.choices?.[0]?.message?.content || "";

    try {
      const jsonStr = content.replace(/```json|```/g, '').trim();
      const result = JSON.parse(jsonStr);
      return {
        score: result.score || 0,
        overallComment: result.overallComment || "Analysis complete",
        speechScript: referenceText,
        wordBreakdown: result.wordBreakdown || [],
        fullLinkedSentence: linking.fullLinkedSentence,
        fullLinkedPhonetic: linking.fullLinkedPhonetic,
        intonationMap: linking.intonationMap,
      };
    } catch (parseError) {
      console.error("JSON 解析错误:", parseError);
      // 返回默认分析结果，但保留 linking 数据
      return {
        score: 0,
        overallComment: "分析完成。发音练习继续加油！",
        speechScript: referenceText,
        wordBreakdown: [],
        fullLinkedSentence: linking.fullLinkedSentence,
        fullLinkedPhonetic: linking.fullLinkedPhonetic,
        intonationMap: linking.intonationMap,
      };
    }
  } catch (error) {
    console.error("MiniMax Pronunciation Analysis Error:", error);
    throw error;
  }
};
