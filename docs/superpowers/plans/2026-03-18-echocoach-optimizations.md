# EchoCoach Optimization Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 4 prioritized improvements to EchoCoach, ordered by impact-to-effort ratio.

**Architecture:** Each task is self-contained and builds on existing patterns. No new dependencies needed — all features use React state, existing CSS variables, and current Gemini API integration.

**Tech Stack:** React 19, TypeScript, Tailwind CSS (CDN), Gemini API, Web Audio API

---

## Chunk 1: Keyboard Shortcuts

Explicitly listed as a future feature in `QUICK_START.md`. Small effort, high UX value.

**Files:**
- Modify: `App.tsx` (add global `keydown` listener in a `useEffect`)

**Shortcuts to implement:**
- `Enter` → Analyze & Listen (`playAndAnalyze`)
- `Space` → Play/Pause normal TTS (only when input is not focused)
- `S` → Slow playback
- `R` → Start/Stop recording

### Task 1: Add keyboard shortcut handler

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add `useEffect` for global keydown listener in `App.tsx`**

Add after the existing cleanup `useEffect`s (around line 97):

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Skip if user is typing in an input or textarea
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.key === 'Enter' && !isAudioLoading && text.trim()) {
      e.preventDefault();
      playAndAnalyze(text);
    } else if (e.key === ' ') {
      e.preventDefault();
      if (appState !== AppState.RECORDING && appState !== AppState.ANALYZING && text.trim()) {
        handlePlayTTS(text, false);
      }
    } else if ((e.key === 's' || e.key === 'S') && text.trim()) {
      e.preventDefault();
      handlePlayTTS(text, true);
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      if (appState === AppState.RECORDING) {
        mediaRecorderRef.current?.stop();
      } else if (appState === AppState.IDLE || appState === AppState.SHOWING_RESULT) {
        startRecording();
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [text, appState, isAudioLoading]);
```

- [ ] **Step 2: Add keyboard hint UI below the action buttons in `App.tsx`**

Add after the closing `</div>` of "Action Buttons" section (around line 554), inside the `<section>`:

```tsx
<div className="flex items-center gap-3 flex-wrap" style={{ color: 'var(--text-muted)' }}>
  {[
    { key: 'Enter', label: 'Listen' },
    { key: 'Space', label: 'Play' },
    { key: 'S', label: 'Slow' },
    { key: 'R', label: 'Record' },
  ].map(({ key, label }) => (
    <span key={key} className="flex items-center gap-1 text-[10px] font-medium">
      <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold"
        style={{ backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
        {key}
      </kbd>
      {label}
    </span>
  ))}
</div>
```

- [ ] **Step 3: Verify in browser**

Open http://localhost:5173, click outside the textarea, press:
- `Enter` → should trigger "Listen" (loading state)
- `R` → should trigger recording (pulsing waveform)
- `R` again → should stop recording
- `S` → should trigger slow playback
- `Space` → should trigger normal playback
- Click inside textarea → all shortcuts should be disabled

---

## Chunk 2: Mobile History Drawer

The history sidebar is `hidden lg:block` — mobile users have no access to their practice history. This adds a bottom-anchored drawer triggered by a floating button.

**Files:**
- Modify: `App.tsx` (add floating button + drawer state)
- Modify: `components/HistoryList.tsx` (no change needed — reuse as-is)

### Task 2: Add mobile history drawer

- [ ] **Step 1: Add drawer state in `App.tsx`**

Add after the `activeBlobUrl` state (around line 30):

```tsx
const [showMobileHistory, setShowMobileHistory] = useState(false);
```

- [ ] **Step 2: Add floating history button (mobile only) in `App.tsx`**

Add inside the `return`, just before the closing `</div>` of the outermost `<div className="min-h-screen...">`:

```tsx
{/* Mobile: floating history button */}
{history.length > 0 && (
  <button
    onClick={() => setShowMobileHistory(true)}
    className="fixed bottom-6 right-6 z-40 lg:hidden w-12 h-12 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all"
    style={{ backgroundColor: 'var(--pink)', boxShadow: '0 4px 20px var(--pink-dim)' }}
    title="Practice history"
  >
    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
      style={{ backgroundColor: 'var(--red)' }}>
      {Math.min(history.length, 9)}
    </span>
  </button>
)}

{/* Mobile history drawer */}
{showMobileHistory && (
  <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setShowMobileHistory(false)}>
    <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} />
    <div
      className="absolute bottom-0 left-0 right-0 rounded-t-2xl p-6 overflow-y-auto"
      style={{ backgroundColor: 'var(--bg-surface)', maxHeight: '80vh' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Drag handle */}
      <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ backgroundColor: 'var(--border-medium)' }} />
      <HistoryList
        history={history}
        onQuickAnalyze={(t) => { setShowMobileHistory(false); setText(t); playAndAnalyze(t); }}
        onQuickRecord={(t) => { setShowMobileHistory(false); setText(t); startRecording(); }}
        onSelect={async (t) => {
          setShowMobileHistory(false);
          setText(t);
          const item = history.find(h => h.text.trim().toLowerCase() === t.trim().toLowerCase());
          if (item?.result) setResult(item.result);
        }}
        onClear={() => {
          if (confirm("Clear all practice history?")) {
            setHistory([]);
            safeRemoveItem(CACHE_CONFIG.HISTORY_KEY);
          }
        }}
      />
    </div>
  </div>
)}
```

- [ ] **Step 3: Verify on mobile viewport**

In Chrome DevTools, set viewport to iPhone SE (375px):
- History button should appear bottom-right with count badge
- Tapping it opens a bottom drawer
- Tapping backdrop closes it
- Selecting a history item closes drawer and loads the sentence
- Sidebar should remain hidden on mobile

---

## Chunk 3: Progress Score Chart

`HistoryItem` already stores `score` and `timestamp`. Adding a mini progress chart shows improvement over time.

**Files:**
- Create: `components/ScoreChart.tsx` (SVG line chart, no dependencies)
- Modify: `components/HistoryList.tsx` (add chart above the list)

### Task 3: Build score progress chart

- [ ] **Step 1: Create `components/ScoreChart.tsx`**

```tsx
import React from 'react';
import { HistoryItem } from '../types';

interface ScoreChartProps {
  history: HistoryItem[];
}

export const ScoreChart: React.FC<ScoreChartProps> = ({ history }) => {
  // Only show scored items, take last 10, oldest → newest
  const scored = history.filter(h => h.score > 0).slice(0, 10).reverse();
  if (scored.length < 2) return null;

  const W = 260, H = 60, PAD = 8;
  const scores = scored.map(h => h.score);
  const minS = Math.min(...scores);
  const maxS = Math.max(...scores);
  const range = maxS - minS || 1;

  const x = (i: number) => PAD + (i / (scored.length - 1)) * (W - PAD * 2);
  const y = (s: number) => H - PAD - ((s - minS) / range) * (H - PAD * 2);

  const points = scored.map((h, i) => `${x(i)},${y(h.score)}`).join(' ');
  const last = scored[scored.length - 1];
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const trend = scored.length >= 2
    ? scored[scored.length - 1].score - scored[0].score
    : 0;

  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Progress (last {scored.length})
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>avg {avg}</span>
          <span className="text-[9px] font-bold flex items-center gap-0.5"
            style={{ color: trend >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {trend >= 0 ? '↑' : '↓'}{Math.abs(trend)}
          </span>
        </div>
      </div>
      <svg width={W} height={H} className="w-full" viewBox={`0 0 ${W} ${H}`}>
        {/* Grid line at midpoint */}
        <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2}
          stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="3,3" />
        {/* Area fill */}
        <polygon
          points={`${x(0)},${H - PAD} ${points} ${x(scored.length - 1)},${H - PAD}`}
          fill="var(--pink)" opacity="0.08"
        />
        {/* Line */}
        <polyline points={points} fill="none" stroke="var(--pink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Last point dot */}
        <circle cx={x(scored.length - 1)} cy={y(last.score)} r="3" fill="var(--pink)" />
      </svg>
    </div>
  );
};
```

- [ ] **Step 2: Import and use `ScoreChart` in `HistoryList.tsx`**

At top of `HistoryList.tsx`, add import:

```tsx
import { ScoreChart } from './ScoreChart';
```

Inside the `return`, after the search box `</div>` and before `{/* List */}`, add:

```tsx
{/* Progress chart */}
<ScoreChart history={history} />
```

- [ ] **Step 3: Verify in browser**

Practice 2+ sentences with recording to get real scores. The chart should appear above the history list showing an SVG line chart with trend indicator.

---

## Chunk 4: Voice Selection

Currently hardcoded to `'Kore'` voice. Gemini TTS supports multiple built-in voices. Adding a simple toggle enhances user experience.

**Files:**
- Modify: `services/geminiService.ts` (accept `voiceName` param)
- Modify: `App.tsx` (add voice state + UI selector)

### Task 4: Add voice selector

- [ ] **Step 1: Modify `generateSpeech` and `generateTutorAudio` in `geminiService.ts` to accept an optional `voiceName` param**

Change the signature and usage of both functions:

```typescript
export const generateSpeech = async (
  text: string,
  slow: boolean = false,
  voiceName: string = 'Kore'
): Promise<string> => {
  // ...existing code, but replace:
  // voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
  // with:
  voiceConfig: { prebuiltVoiceConfig: { voiceName } }
```

```typescript
export const generateTutorAudio = async (
  text: string,
  voiceName: string = 'Kore'
): Promise<string> => {
  // same change
```

- [ ] **Step 2: Add voice state and available voices in `App.tsx`**

Add after the `showMobileHistory` state:

```tsx
const VOICES = [
  { id: 'Kore', label: 'Kore', desc: 'Firm' },
  { id: 'Puck', label: 'Puck', desc: 'Upbeat' },
  { id: 'Charon', label: 'Charon', desc: 'Informative' },
  { id: 'Aoede', label: 'Aoede', desc: 'Breezy' },
] as const;

const [selectedVoice, setSelectedVoice] = useState('Kore');
```

- [ ] **Step 3: Pass `selectedVoice` to TTS calls in `App.tsx`**

In `handlePlayTTS`, change:
```typescript
const base64 = await generateSpeech(textToSpeak, isSlow);
```
to:
```typescript
const base64 = await generateSpeech(textToSpeak, isSlow, selectedVoice);
```

In `playAndAnalyze`, change:
```typescript
generateSpeech(textToSpeak, false),
```
to:
```typescript
generateSpeech(textToSpeak, false, selectedVoice),
```

In `handlePlayTutor`, change:
```typescript
const base64 = await generateTutorAudio(selectedText);
```
to:
```typescript
const base64 = await generateTutorAudio(selectedText, selectedVoice);
```

- [ ] **Step 4: Invalidate TTS cache when voice changes**

Add a `useEffect` in `App.tsx`:

```tsx
useEffect(() => {
  ttsCache.clear(); // voice change = stale cache
}, [selectedVoice]);
```

- [ ] **Step 5: Add voice selector UI in `App.tsx`**

Add inside the input section, between the YouTube link `</a>` and the "Action Buttons" `<div>`:

```tsx
{/* Voice selector */}
<div className="flex items-center gap-2 flex-wrap">
  <span className="text-[10px] font-semibold uppercase tracking-widest shrink-0" style={{ color: 'var(--text-muted)' }}>Voice</span>
  {VOICES.map(v => (
    <button
      key={v.id}
      onClick={() => setSelectedVoice(v.id)}
      className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all active:scale-95"
      style={{
        backgroundColor: selectedVoice === v.id ? 'var(--pink-dim)' : 'var(--bg-deep)',
        color: selectedVoice === v.id ? 'var(--pink)' : 'var(--text-muted)',
        border: `1px solid ${selectedVoice === v.id ? 'var(--pink)' : 'var(--border-subtle)'}`,
      }}
      title={v.desc}
    >
      {v.label}
    </button>
  ))}
</div>
```

- [ ] **Step 6: Verify in browser**

- Switch to "Puck" voice, click Listen → audio should use Puck voice
- Switch back to "Kore" → audio should use Kore
- Switching voice clears the cache (next play re-fetches)

---

## Summary

| Task | Files Changed | Effort |
|------|--------------|--------|
| 1. Keyboard shortcuts | `App.tsx` | Small |
| 2. Mobile history drawer | `App.tsx` | Small |
| 3. Progress score chart | `ScoreChart.tsx` (new), `HistoryList.tsx` | Medium |
| 4. Voice selection | `geminiService.ts`, `App.tsx` | Small |
