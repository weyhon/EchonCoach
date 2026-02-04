# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EchoCoach is an AI-powered English pronunciation assistant. It helps users practice pronunciation through real-time feedback, speech synthesis, and visual scoring. The app records user speech, analyzes it against reference text, and provides detailed phonetic feedback.

## Technology Stack

- **React 19** + **TypeScript 5.7**
- **Vite 6.0** for build tooling
- **Tailwind CSS** (loaded via CDN in index.html)
- **MiniMax API** for TTS and pronunciation analysis
- **Web Audio API** and **MediaRecorder API** for audio handling

## Common Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture

### State Management
- Uses React `useState` with module-level Maps for caching:
  - `ttsCache`: Maps `text_mode` → base64 audio (avoids redundant TTS API calls)
  - `analysisCache`: Maps text → AnalysisResult
- History persisted to `localStorage` (`echocoach_history_v3`) with 50-item limit

### Audio Pipeline
1. **Recording**: MediaRecorder API captures audio as webm blob
2. **TTS**: MiniMax API (`speech-2.8-turbo` model) returns hex-encoded audio
3. **Playback**: Base64 MP3 played via HTML5 Audio API
4. **Fallback chain**: MiniMax TTS → Web Speech API (browser native)

### AI Integration (MiniMax)
All AI features use MiniMax API with multi-base-URL fallback:
- `generateSpeech()` - TTS with speed control (normal/slow)
- `generateTutorAudio()` - Single word pronunciation
- `getLinkingAnalysisForText()` - Linking and intonation analysis
- `analyzePronunciation()` - Compare user recording to reference

API endpoints tried in order: `VITE_MINIMAX_BASE_URL` → `api.minimax.chat` → `api.minimax.io` → `api.minimaxi.com`

### Visual Feedback Notation
The app uses special symbols in feedback display:
- `‿` - Linking between words (e.g., "tell‿us")
- `●` - Stressed syllable
- `·` - Unstressed syllable
- `↗` - Rising intonation (questions)
- `↘` - Falling intonation (statements)

### Error Handling
- Error codes thrown by services: `RATE_LIMIT`, `INSUFFICIENT_BALANCE`, `NO_AUDIO`, `INVALID_KEY`
- `ErrorBoundary` component catches React errors
- `Promise.allSettled` used for parallel API requests with graceful degradation

## Environment Variables

Create `.env.local` file:

```
VITE_MINIMAX_API_KEY=your_key_here
VITE_MINIMAX_GROUP_ID=your_group_id
VITE_MINIMAX_BASE_URL=https://api.minimax.chat/v1  # optional custom base URL
```

## File Organization

- `App.tsx` - Main state container, coordinates between services and UI
- `types.ts` - Shared TypeScript interfaces
- `components/` - React UI components
- `services/minimaxService.ts` - MiniMax API integration with retry logic
- `services/audioUtils.ts` - Audio encoding/decoding and playback utilities

## Key Implementation Notes

- Hex-to-base64 conversion required for MiniMax audio responses
- Byte alignment fix applied in PCM decoding (handles odd-length buffers)
- Linking analysis parses JSON from LLM responses with markdown code block stripping
- Audio playback uses `Promise.allSettled` to handle independent API calls
