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
1. **Recording**: MediaRecorder API captures audio as webm blob (32kbps Opus)
2. **TTS**: Gemini TTS returns PCM audio
3. **Playback**: Base64 MP3 played via HTML5 Audio API
4. **Fallback chain**: Gemini TTS → Web Speech API (browser native)

### Pronunciation Scoring (dual-engine)
- **Primary: Azure Speech** — dedicated acoustic model, phoneme-level IPA scoring, ~1-2s
  - webm→WAV conversion via OfflineAudioContext (16kHz mono)
  - REST API with token proxy (api/speech-token.ts)
  - Falls back to Gemini if Azure key not configured
- **Secondary: Gemini Flash** — generates coaching tips (overallComment, suggestion) asynchronously
  - Only used for natural language feedback, not scoring
  - Runs in background after Azure scores are shown

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

# Azure Speech (optional — enables fast pronunciation scoring via dedicated ASR)
VITE_AZURE_SPEECH_KEY=your_azure_speech_key
VITE_AZURE_SPEECH_REGION=eastasia   # pick region closest to your users

# For Vercel deployment, set server-side vars (used by api/speech-token.ts):
# AZURE_SPEECH_KEY=your_azure_speech_key
# AZURE_SPEECH_REGION=eastasia
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

## 沟通偏好

- 用户是技术小白，对话时需要**用通俗语言解释相关技术概念和原理**（比如 Dev server、API、组件等），多用类比和生活化的比喻
- 遇到专业术语时，先用中文解释含义，再简单说明它在项目中的作用

### 英语学习助手（English Learning Buddy）

用户英语水平：A2（初级）。在对话中自然融入英语学习：

- **纠正英语**：当用户用英语表达时，如果有语法或用词错误，温和地纠正并解释
- **中英混搭**：回复中适当穿插简单英语短句或关键词，附上中文释义
  - 例：这个 bug 已经 **fixed**（修复了）✅，你可以 **refresh the page**（刷新页面）看看效果
- **技术词汇教学**：遇到编程术语时，顺带教对应的英语表达和发音提示
  - 例：组件（**component** /kəmˈpoʊnənt/）就像乐高积木……
- **难度控制**：保持 A2 友好——用短句、常见词、避免复杂从句。随着用户进步可逐步提升
- **不喧宾夺主**：英语学习是调味料，不是主菜。编程任务永远优先，英语穿插要自然不刻意

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
