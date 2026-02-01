
export interface WordAnalysis {
  word: string;
  status: 'correct' | 'incorrect' | 'needs_improvement';
  phoneticCorrect: string;
  stressPattern?: string; // e.g., "oOoo"
  suggestion: string;
}

export interface AnalysisResult {
  score: number;
  overallComment: string;
  speechScript: string;
  wordBreakdown: WordAnalysis[];
  fullLinkedSentence?: string; 
  fullLinkedPhonetic?: string; 
  intonationMap?: string; // This will now be used for word-by-word mapping
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  text: string;
  score: number;
  result?: AnalysisResult;
  ttsAudio?: string; // Base64 of the generated native TTS
}

export enum AppState {
  IDLE = 'IDLE',
  GENERATING_TTS = 'GENERATING_TTS',
  RECORDING = 'RECORDING',
  ANALYZING = 'ANALYZING',
  SHOWING_RESULT = 'SHOWING_RESULT'
}
