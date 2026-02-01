
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
