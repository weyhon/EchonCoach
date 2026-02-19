/**
 * Application-wide configuration constants
 * Centralizes all magic numbers for easier tuning and maintenance
 */

export const AUDIO_CONFIG = {
  /** Sample rate for PCM audio decoding */
  SAMPLE_RATE: 24000,
  /** Bytes per sample for PCM 16-bit audio */
  PCM_BYTES_PER_SAMPLE: 2,
  /** Default playback speed (normal) */
  DEFAULT_PLAYBACK_RATE: 1.0,
  /** Slow playback speed for learning */
  SLOW_PLAYBACK_RATE: 0.75,
  /** Tutor audio playback speed (slightly slower for clarity) */
  TUTOR_PLAYBACK_RATE: 0.9,
  /** MiniMax API slow speed */
  MINIMAX_SLOW_SPEED: 0.85,
  /** Volume level */
  DEFAULT_VOLUME: 1.0,
  /** Pitch adjustment */
  DEFAULT_PITCH: 0,
  /** Bitrate for MP3 encoding */
  MP3_BITRATE: 128000,
} as const;

export const CACHE_CONFIG = {
  /** Maximum number of history items to store */
  MAX_HISTORY_ITEMS: 50,
  /** Time-to-live for TTS cache (1 hour) */
  TTS_CACHE_TTL: 1000 * 60 * 60,
  /** Time-to-live for analysis cache (30 minutes) */
  ANALYSIS_CACHE_TTL: 1000 * 60 * 30,
  /** LocalStorage key for history */
  HISTORY_KEY: 'echocoach_history_v3',
} as const;

export const API_CONFIG = {
  /** Default timeout for API requests (30 seconds) */
  DEFAULT_TIMEOUT: 30000,
  /** Number of retry attempts for failed requests */
  RETRY_ATTEMPTS: 3,
  /** Delay between retry attempts (1 second) */
  RETRY_DELAY: 1000,
  /** MiniMax TTS model */
  MINIMAX_TTS_MODEL: 'speech-2.8-turbo',
  /** MiniMax voice ID */
  MINIMAX_VOICE_ID: 'female-yujie',
} as const;

export const UI_CONFIG = {
  /** Error message display duration (5 seconds) */
  ERROR_DISPLAY_DURATION: 5000,
  /** Selection delay for text highlight (50ms) */
  SELECTION_DELAY: 50,
  /** Minimum audio data length for validation */
  MIN_AUDIO_LENGTH: 100,
  /** Minimum base64 audio length */
  MIN_BASE64_LENGTH: 50,
} as const;
