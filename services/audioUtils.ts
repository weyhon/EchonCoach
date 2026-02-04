
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const decodePCM = (
  base64String: string,
  audioContext: AudioContext,
  sampleRate: number = 24000
): AudioBuffer => {
  const bytes = base64ToUint8Array(base64String);

  // Robust byte alignment: PCM 16-bit requires 2 bytes per sample.
  const byteLength = bytes.byteLength;
  const alignedLength = byteLength - (byteLength % 2);

  // Create a view using the aligned portion of the buffer
  const dataInt16 = new Int16Array(bytes.buffer, 0, alignedLength / 2);

  const numChannels = 1;
  const frameCount = dataInt16.length;

  const buffer = audioContext.createBuffer(numChannels, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);

  for (let i = 0; i < frameCount; i++) {
    // Normalize 16-bit signed integer to float [-1.0, 1.0]
    channelData[i] = dataInt16[i] / 32768.0;
  }

  return buffer;
};

// 播放 base64 音频 - 智能检测格式（MP3 或 PCM）
export const playBase64Audio = async (
  base64Audio: string,
  mimeType: string = 'audio/mpeg'
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      // 尝试作为 MP3 播放（MiniMax）
      const dataUrl = `data:${mimeType};base64,${base64Audio}`;
      console.log("Playing audio, dataUrl length:", dataUrl.length);

      const audio = new Audio(dataUrl);
      let playbackStarted = false;

      audio.oncanplay = () => {
        console.log("Audio can play as MP3");
        playbackStarted = true;
      };

      audio.onended = () => {
        console.log("Audio playback ended");
        resolve();
      };

      audio.onerror = async (e) => {
        console.warn("MP3 playback failed, trying PCM format:", e);

        // 如果 MP3 播放失败，尝试作为 PCM 播放（Gemini）
        try {
          await playPCMAudio(base64Audio);
          resolve();
        } catch (pcmError) {
          console.error("PCM playback also failed:", pcmError);
          reject(new Error(`Audio playback error: ${audio.error?.message || 'unknown'}`));
        }
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => console.log("Audio play started"))
          .catch(async (err) => {
            console.warn("Audio play failed, trying PCM:", err);
            // 尝试 PCM 播放
            try {
              await playPCMAudio(base64Audio);
              resolve();
            } catch (pcmError) {
              reject(err);
            }
          });
      }
    } catch (error) {
      console.error("playBase64Audio error:", error);
      reject(error);
    }
  });
};

// 播放 PCM 音频 - 用于 Gemini TTS
export const playPCMAudio = async (base64Audio: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      console.log("Playing PCM audio");
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();

      const pcmBuffer = decodePCM(base64Audio, audioContext, 24000);
      const source = audioContext.createBufferSource();
      source.buffer = pcmBuffer;
      source.connect(audioContext.destination);

      source.onended = () => {
        console.log("PCM playback ended");
        audioContext.close();
        resolve();
      };

      source.start(0);
    } catch (error) {
      console.error("PCM playback error:", error);
      reject(error);
    }
  });
};

// 浏览器内置 Web Speech API 兜底朗读（无返回音频，但可保证有声音）
export const speakWithWebSpeech = async (text: string, rate: number = 1): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) throw new Error("当前浏览器不支持语音合成");
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.rate = rate;
      utter.onend = () => resolve();
      utter.onerror = (e) => reject(e.error || e);
      synth.speak(utter);
    } catch (e) {
      reject(e);
    }
  });
};
