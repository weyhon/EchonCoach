# Nebula UI Redesign — Plan B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all Nebula UI components to a Clean App aesthetic (white surfaces, Inter font, SaaS clarity) plus add Ruby-style sentence annotation (IPA + stress/linking/intonation above each word) and a "Watch on YouTube" button in the feedback card.

**Architecture:** CSS variable token system in `index.html` drives the design; all components use `var(--*)` references so only token values need updating to change the whole theme. A new `SentenceAnnotation` component computes and renders the Ruby-style per-word annotation using existing `linkingUtils` + `intonationUtils` services. No backend or API changes.

**Tech Stack:** React 19, TypeScript 5.7, Tailwind CSS (CDN), Vite 6, JetBrains Mono + Inter (Google Fonts)

**Spec:** `docs/superpowers/specs/2026-03-21-ui-redesign-plan-b.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `index.html` | Modify | CSS token system, Inter font, global styles |
| `components/SentenceAnnotation.tsx` | **Create** | Ruby-style per-word IPA + stress + linking + intonation row |
| `components/FeedbackCard.tsx` | Modify | Score number, playback row + YouTube btn, integrate SentenceAnnotation, word pills |
| `App.tsx` | Modify | Header, input card, recording state UI |
| `components/HistoryList.tsx` | Modify | Sidebar restyle — search box, history items, score badges |
| `components/WordDetailModal.tsx` | Modify | Score bar, phoneme rows, action buttons |
| `components/IPALegend.tsx` | Modify | Light theme token references |
| `components/ErrorBoundary.tsx` | Modify | Light theme token references |

---

## Task 1: Design Tokens — index.html

**Files:**
- Modify: `index.html`

Replace the entire `<style>` block CSS variables and font link. All downstream components use `var(--*)` so this single change reshapes the whole palette.

- [ ] **Step 1: Replace Google Fonts link**

In `index.html`, replace the existing `<link>` for fonts with:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Replace `:root` CSS variables**

Find the existing `:root { ... }` block and replace with:
```css
:root {
  --bg:              #f9fafb;
  --surface:         #ffffff;
  --surface-muted:   #f3f4f6;
  --border:          #e5e7eb;
  --border-focus:    #E8587A;
  --text-primary:    #111827;
  --text-secondary:  #374151;
  --text-muted:      #6b7280;
  --text-placeholder:#9ca3af;
  --rose:            #E8587A;
  --rose-50:         #fce7ee;
  --green:           #22c55e;
  --green-bg:        #dcfce7;
  --amber:           #f59e0b;
  --amber-bg:        #fef3c7;
  --red:             #ef4444;
  --red-bg:          #fee2e2;
  /* Legacy aliases — keep so existing components don't break */
  --bg-deep:         var(--bg);
  --bg-surface:      #f3f4f6;
  --bg-card:         var(--surface);
  --bg-elevated:     var(--surface-muted);
  --border-subtle:   var(--border);
  --border-medium:   #d1d5db;
  --pink:            var(--rose);
  --pink-dim:        rgba(232,88,122,0.08);
  --pink-glow:       rgba(232,88,122,0.15);
}
```

- [ ] **Step 3: Update `body` style**

```css
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background-color: var(--bg);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-tap-highlight-color: transparent;
}
```

- [ ] **Step 4: Update `.glass` class**

```css
.glass {
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: 0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04);
}
```

- [ ] **Step 5: Update `.font-brand` and `.font-mono`**

```css
.font-brand { font-family: 'Inter', sans-serif; font-weight: 800; letter-spacing: -0.03em; }
.font-mono  { font-family: 'JetBrains Mono', monospace; }
```

- [ ] **Step 6: Update scrollbar colors**

```css
* { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.1) transparent; }
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.18); }
```

- [ ] **Step 7: Build and verify no TypeScript errors**

```bash
cd "/Users/mac/40_Creative/Cursor/05 EchoCoach" && npm run build 2>&1 | tail -10
```
Expected: `✓ built in ...` with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "design: update CSS tokens and fonts for Clean App theme"
```

---

## Task 2: SentenceAnnotation Component (New)

**Files:**
- Create: `components/SentenceAnnotation.tsx`

This component renders the Ruby-style sentence annotation. It uses `shouldLink` and `generateIntonationTokens` from existing services — no new business logic needed. One word unit = vertical flex column: annotation row (IPA + ●/· + ↗/↘) on top, word text below.

- [ ] **Step 1: Write the test**

Create `components/SentenceAnnotation.test.tsx`:
```tsx
import { buildAnnotationWords } from './SentenceAnnotation';

describe('buildAnnotationWords', () => {
  it('marks content words as stressed', () => {
    const words = buildAnnotationWords('pick up luggage', undefined);
    expect(words[0].isStressed).toBe(true);  // pick — content word
    expect(words[1].isStressed).toBe(false); // up — function word
    expect(words[2].isStressed).toBe(true);  // luggage — content word
  });

  it('marks linking between consonant-ending and vowel-starting words', () => {
    const words = buildAnnotationWords('pick up', undefined);
    expect(words[0].linksToNext).toBe(true); // pick‿up
  });

  it('adds intonation marker to last word only', () => {
    const words = buildAnnotationWords('do you like it', undefined);
    const last = words[words.length - 1];
    expect(last.intonation).toBe('↘'); // statement
    words.slice(0, -1).forEach(w => expect(w.intonation).toBeUndefined());
  });

  it('includes ipa from wordBreakdown when provided', () => {
    const breakdown = [{ word: 'pick', phoneticCorrect: 'pɪk', status: 'correct', suggestion: '' }] as any;
    const words = buildAnnotationWords('pick', breakdown);
    expect(words[0].ipa).toBe('pɪk');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd "/Users/mac/40_Creative/Cursor/05 EchoCoach" && npx vitest run components/SentenceAnnotation.test.tsx 2>&1 | tail -10
```
Expected: FAIL — `buildAnnotationWords` not found.

- [ ] **Step 3: Create `components/SentenceAnnotation.tsx`**

```tsx
import React from 'react';
import { WordAnalysis } from '../types';
import { shouldLink, isFunctionWord } from '../services/linkingUtils';
import { generateIntonationTokens as getTokens } from '../services/intonationUtils';

export interface AnnotationWord {
  word: string;
  ipa?: string;
  isStressed: boolean;
  intonation?: '↗' | '↘';
  linksToNext: boolean;
  status?: WordAnalysis['status'];
}

/**
 * Build annotation data for each word in the sentence.
 * Pure function — easily testable.
 */
export function buildAnnotationWords(
  text: string,
  wordBreakdown: WordAnalysis[] | undefined
): AnnotationWord[] {
  const rawWords = text.trim().split(/\s+/);
  const tokens = getTokens(text, rawWords); // e.g. ['●', '·', '●↘']

  return rawWords.map((word, i) => {
    const token = tokens[i] ?? '·';
    const cleanedWord = word.toLowerCase().replace(/[?.!,;:'"""()[\]{}]/g, '');
    const isStressed = !isFunctionWord(cleanedWord);
    const intonation = token.includes('↗') ? '↗' : token.includes('↘') ? '↘' : undefined;
    const linksToNext = i < rawWords.length - 1 ? shouldLink(word, rawWords[i + 1]) : false;

    const analysis = wordBreakdown?.[i];
    return {
      word,
      ipa: analysis?.phoneticCorrect,
      isStressed,
      intonation: intonation as '↗' | '↘' | undefined,
      linksToNext,
      status: analysis?.status,
    };
  });
}

const wordColor = (status?: WordAnalysis['status']): string => {
  if (!status) return 'var(--text-primary)';
  if (status === 'correct') return 'var(--green)';
  if (status === 'incorrect') return 'var(--red)';
  return 'var(--amber)';
};

interface Props {
  text: string;
  wordBreakdown?: WordAnalysis[];
}

export const SentenceAnnotation: React.FC<Props> = ({ text, wordBreakdown }) => {
  const words = buildAnnotationWords(text, wordBreakdown);

  return (
    <div className="flex flex-wrap items-end gap-x-0 gap-y-3 select-none" style={{ lineHeight: 1 }}>
      {words.map((w, i) => (
        <React.Fragment key={i}>
          {/* Word unit: annotation above, word below */}
          <div className="flex flex-col items-center" style={{ marginLeft: i === 0 ? 0 : undefined }}>
            {/* Annotation row */}
            <div className="flex items-center justify-center gap-0.5 h-5">
              {w.isStressed && (
                <span className="font-bold leading-none" style={{ fontSize: 10, color: 'var(--rose)' }}>●</span>
              )}
              {w.ipa && (
                <span className="font-mono leading-none" style={{ fontSize: 9, color: w.status ? wordColor(w.status) : 'var(--text-muted)', opacity: 0.85 }}>
                  {w.ipa}
                </span>
              )}
              {w.intonation && (
                <span className="font-bold leading-none" style={{ fontSize: 12, color: w.intonation === '↗' ? 'var(--amber)' : 'var(--text-muted)', marginLeft: 1 }}>
                  {w.intonation}
                </span>
              )}
            </div>
            {/* Word text */}
            <span
              className="leading-none"
              style={{
                fontSize: 17,
                fontWeight: w.isStressed ? 700 : 500,
                color: wordBreakdown ? wordColor(w.status) : 'var(--text-secondary)',
                borderBottom: w.isStressed ? '2px solid var(--rose)' : undefined,
                paddingBottom: w.isStressed ? 1 : 0,
              }}
            >
              {w.word}
            </span>
          </div>

          {/* Linking arc between this word and next */}
          {w.linksToNext && (
            <div className="flex flex-col items-center self-end" style={{ width: 14, marginBottom: 2 }}>
              <div style={{ height: 20 }} /> {/* spacer to align with annotation row */}
              <span className="leading-none" style={{ fontSize: 20, color: 'var(--rose)', lineHeight: 1, marginBottom: 1 }}>‿</span>
            </div>
          )}

          {/* Space between words (when no link) */}
          {!w.linksToNext && i < words.length - 1 && (
            <div style={{ width: 8 }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify passing**

```bash
cd "/Users/mac/40_Creative/Cursor/05 EchoCoach" && npx vitest run components/SentenceAnnotation.test.tsx 2>&1 | tail -15
```
Expected: all 4 tests PASS.

- [ ] **Step 5: Build to verify TypeScript**

```bash
npm run build 2>&1 | tail -8
```
Expected: `✓ built in ...`

- [ ] **Step 6: Commit**

```bash
git add components/SentenceAnnotation.tsx components/SentenceAnnotation.test.tsx
git commit -m "feat: add SentenceAnnotation component — Ruby-style IPA + stress + linking + intonation"
```

---

## Task 3: FeedbackCard Redesign

**Files:**
- Modify: `components/FeedbackCard.tsx`

Key changes: remove `ScoreRing`, replace with large score number; add `SentenceAnnotation`; add YouTube button to playback row; restyle word pills to include IPA below each word.

- [ ] **Step 1: Add YouTube URL helper at top of file**

After the import block in `FeedbackCard.tsx`, add:
```tsx
function youTubeSearchUrl(text: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(text + ' pronunciation')}`;
}
```

- [ ] **Step 2: Add SentenceAnnotation import**

```tsx
import { SentenceAnnotation } from './SentenceAnnotation';
```

- [ ] **Step 3: Replace `ScoreRing` with `ScoreNumber`**

Remove the entire `ScoreRing` component and replace with:
```tsx
const ScoreNumber: React.FC<{ score: number }> = ({ score }) => {
  const safe = Math.max(0, Math.min(100, score));
  const color = safe >= 80 ? 'var(--green)' : safe >= 60 ? 'var(--amber)' : 'var(--red)';
  return (
    <div className="flex flex-col items-center shrink-0">
      <span className="font-brand num leading-none" style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.05em', color }}>
        {safe > 0 ? safe : '--'}
      </span>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-placeholder)', marginTop: 3 }}>
        SCORE
      </span>
    </div>
  );
};
```

- [ ] **Step 4: Replace the score + sentence header section**

Find the section that renders the score ring and sentence text. Replace with:
```tsx
{/* Score + sentence row */}
<div className="flex items-start gap-4 p-5 border-b" style={{ borderColor: 'var(--border)' }}>
  <ScoreNumber score={result.score} />
  <div className="w-px self-stretch shrink-0" style={{ background: 'var(--border)' }} />
  <div className="flex-1 min-w-0">
    {/* Sentence with color-coding only (full annotation is below) */}
    <div className="flex flex-wrap gap-x-1" style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.7 }}>
      {result.wordBreakdown.map((w, i) => {
        const color = w.status === 'correct' ? 'var(--green)' : w.status === 'incorrect' ? 'var(--red)' : 'var(--amber)';
        return (
          <span key={i} style={{ color, fontWeight: w.status === 'correct' ? 500 : 600,
            textDecoration: w.status === 'incorrect' ? 'underline' : 'none',
            textDecorationColor: 'rgba(239,68,68,0.3)' }}>
            {w.word}
          </span>
        );
      })}
    </div>
  </div>
</div>
```

- [ ] **Step 5: Replace playback buttons row**

Find the section with playback/action buttons and replace with:
```tsx
{/* Playback row */}
<div className="flex items-center gap-2 px-5 py-3 flex-wrap border-b" style={{ borderColor: 'var(--border)' }}>
  {/* Reference playback */}
  <button
    onClick={() => onPlayWord(result.speechScript || '')}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
    style={{ border: '1.5px solid var(--rose)', color: 'var(--rose)', background: 'var(--surface)' }}
  >
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
    Reference
  </button>

  {/* User recording playback */}
  {hasUserRecording && (
    <button
      onClick={onPlayUserRecording}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
      style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth={2}/><polygon points="10,8 16,12 10,16" fill="currentColor"/></svg>
      Your Recording
    </button>
  )}

  {/* YouTube button */}
  <a
    href={youTubeSearchUrl(result.speechScript || '')}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
    style={{ border: '1.5px solid #ff0000', color: '#cc0000', background: '#fff7f7', textDecoration: 'none' }}
  >
    {/* YouTube play icon */}
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 11, background: '#ff0000', borderRadius: 2, flexShrink: 0 }}>
      <span style={{ width: 0, height: 0, borderStyle: 'solid', borderWidth: '3.5px 0 3.5px 7px', borderColor: 'transparent transparent transparent #fff' }} />
    </span>
    Watch on YouTube
  </a>

  {/* Try again */}
  <button
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ml-auto transition-all"
    style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'var(--surface-muted)' }}
    onClick={onRetry}
  >
    ⏺ Try Again
  </button>
</div>
```

**Before rendering this button, add `onRetry` to `FeedbackCardProps`:**
```tsx
// In FeedbackCard.tsx, add to the interface:
onRetry?: () => void;
```
**In `App.tsx`, pass the prop:**
```tsx
<FeedbackCard
  ...
  onRetry={() => setAppState(AppState.IDLE)}
/>
```

- [ ] **Step 6: Add Sentence Annotation section**

After the playback row and before the word breakdown, add:
```tsx
{/* Ruby annotation row */}
<div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-placeholder)', marginBottom: 12 }}>
    PRONUNCIATION GUIDE
  </div>
  <SentenceAnnotation
    text={result.speechScript || ''}
    wordBreakdown={result.wordBreakdown}
  />
</div>
```

- [ ] **Step 7: Restyle word pills to include IPA**

Find `WordSmallItem` or equivalent word pill rendering. Restyle each pill to be a vertical flex column:
```tsx
// Word pill with IPA below
<button
  key={i}
  onClick={() => setSelectedWord(wa)}
  className="flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-lg transition-all"
  style={{
    background: statusBg(wa.status),
    color: statusColor(wa.status),
    minWidth: 40,
  }}
>
  <span style={{ fontSize: 12, fontWeight: 600 }}>{wa.word}</span>
  {wa.phoneticCorrect && (
    <span className="font-mono" style={{ fontSize: 9, opacity: 0.7 }}>{wa.phoneticCorrect}</span>
  )}
</button>
```

Where `statusBg` / `statusColor` are:
```tsx
const statusBg = (s: WordAnalysis['status']) =>
  s === 'correct' ? 'var(--green-bg)' : s === 'incorrect' ? 'var(--red-bg)' : 'var(--amber-bg)';
const statusColor = (s: WordAnalysis['status']) =>
  s === 'correct' ? '#15803d' : s === 'incorrect' ? '#be185d' : '#92400e';
```

- [ ] **Step 8: Build and verify**

```bash
npm run build 2>&1 | tail -8
```
Expected: `✓ built in ...`

- [ ] **Step 9: Commit**

```bash
git add components/FeedbackCard.tsx
git commit -m "feat: redesign FeedbackCard — score number, YouTube button, Ruby annotation row, word pills with IPA"
```

---

## Task 4: App.tsx — Header + Input Card + Recording State

**Files:**
- Modify: `App.tsx` (return JSX section, roughly lines 473–816)

- [ ] **Step 1: Redesign header**

Replace the fixed header section with:
```tsx
<header className="fixed top-0 w-full z-50 flex items-center justify-between px-5 h-[52px]"
  style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
  <div className="flex items-center gap-2">
    <div className="flex items-center justify-center rounded-lg shrink-0"
      style={{ width: 22, height: 22, background: 'var(--rose)', borderRadius: 6 }}>
      <NebulaLogo size={12} />
    </div>
    <span className="font-brand font-extrabold tracking-tight" style={{ fontSize: 15, color: 'var(--text-primary)' }}>Nebula</span>
    <span className="hidden sm:block font-semibold uppercase tracking-widest" style={{ fontSize: 10, color: 'var(--rose)', marginLeft: 4 }}>Coach</span>
  </div>
  <div className="flex items-center gap-2">
    <button onClick={() => setShowIPALegend(true)}
      className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
      style={{ background: 'var(--surface-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
      IPA Guide
    </button>
    {history.length > 0 && (
      <button onClick={() => setShowMobileHistory(true)}
        className="lg:hidden px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5"
        style={{ background: 'var(--surface-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
        History
        <span className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{ background: 'var(--rose)' }}>
          {Math.min(history.length, 9)}
        </span>
      </button>
    )}
  </div>
</header>
```

- [ ] **Step 2: Redesign sidebar**

The sidebar outer div (currently `w-[300px]`):
```tsx
<aside className="hidden lg:flex flex-col w-[256px] shrink-0 h-[calc(100vh-52px)] sticky top-[52px] overflow-y-auto"
  style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
  <HistoryList ... />
</aside>
```

- [ ] **Step 3: Redesign input card**

Replace the textarea + button section with:
```tsx
<div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
  {/* Label */}
  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-placeholder)', marginBottom: 10 }}>
    PRACTICE SENTENCE
  </div>
  {/* Textarea */}
  <textarea
    value={text}
    onChange={e => setText(e.target.value)}
    placeholder="Type or paste a sentence to practice..."
    className="w-full resize-none outline-none"
    style={{
      minHeight: 56, padding: '11px 13px',
      background: 'var(--surface-muted)', border: '1.5px solid var(--border)', borderRadius: 8,
      fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)',
      lineHeight: 1.55,
    }}
    onFocus={e => e.target.style.borderColor = 'var(--rose)'}
    onBlur={e => e.target.style.borderColor = 'var(--border)'}
    disabled={appState !== AppState.IDLE && appState !== AppState.SHOWING_RESULT}
  />
  {/* Action row */}
  <div className="flex items-center gap-2 mt-3 flex-wrap">
    {/* Play Reference */}
    <button onClick={handlePlayReference} disabled={!text.trim() || appState === AppState.RECORDING || appState === AppState.ANALYZING}
      className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
      style={{ background: 'var(--rose)', color: '#fff', border: 'none' }}>
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      Play Reference
    </button>
    {/* Record */}
    {appState !== AppState.RECORDING ? (
      <button onClick={startRecording} disabled={!text.trim() || appState === AppState.ANALYZING || appState === AppState.GENERATING_TTS}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
        style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/></svg>
        Record
      </button>
    ) : (
      <button onClick={() => mediaRecorderRef.current?.stop()}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold"
        style={{ background: '#111827', color: '#fff', border: 'none' }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, background: '#fff', display: 'inline-block' }} />
        Stop Recording
      </button>
    )}
    {/* Speed toggle */}
    <div className="flex ml-auto rounded-md overflow-hidden" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', padding: 2 }}>
      {(['normal', 'slow'] as const).map(speed => (
        <button key={speed} onClick={() => setTtsMode(speed)}
          className="px-3 py-1 text-xs font-semibold rounded capitalize transition-all"
          style={ttsMode === speed
            ? { background: 'var(--surface)', color: 'var(--text-primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
            : { color: 'var(--text-muted)', background: 'transparent' }}>
          {speed.charAt(0).toUpperCase() + speed.slice(1)}
        </button>
      ))}
    </div>
  </div>

  {/* Recording state: waveform */}
  {appState === AppState.RECORDING && (
    <div className="flex items-center gap-3 mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: 'var(--red)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Recording...</span>
      </div>
      <div className="flex items-center gap-0.5 h-6">
        {[1,2,3,4,5,6,7].map(n => (
          <div key={n} className="rec-bar" style={{ width: 3, background: 'var(--rose)', borderRadius: 2, height: `${12 + (n % 3) * 8}px` }} />
        ))}
      </div>
    </div>
  )}

  {/* Analyzing state */}
  {appState === AppState.ANALYZING && (
    <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="w-3.5 h-3.5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--rose)', borderTopColor: 'transparent' }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Analyzing pronunciation...</span>
    </div>
  )}
</div>
```

- [ ] **Step 4: Add `onRetry` prop wiring in App.tsx**

Add to `FeedbackCard` usage:
```tsx
onRetry={() => setAppState(AppState.IDLE)}
```

Add to `FeedbackCardProps` interface in `FeedbackCard.tsx`:
```tsx
onRetry?: () => void;
```

- [ ] **Step 5: Build and verify**

```bash
npm run build 2>&1 | tail -8
```
Expected: `✓ built in ...`

- [ ] **Step 6: Commit**

```bash
git add App.tsx
git commit -m "design: redesign App header, input card, and recording state UI"
```

---

## Task 5: HistoryList Redesign

**Files:**
- Modify: `components/HistoryList.tsx`

- [ ] **Step 1: Update container and header**

Replace the sidebar wrapper styles:
- Background: `var(--surface)`
- Title: 10px/700 uppercase `var(--text-placeholder)`
- Search box: `var(--surface-muted)` bg, `var(--border)` border, 8px radius

- [ ] **Step 2: Update history items**

Each item row:
```tsx
<div className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
  style={{ background: isActive ? 'var(--rose-50)' : 'transparent' }}
  onMouseEnter={e => !isActive && (e.currentTarget.style.background = 'var(--surface-muted)')}
  onMouseLeave={e => !isActive && (e.currentTarget.style.background = 'transparent')}>
  {/* text */}
  <div className="flex-1 min-w-0">
    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {item.text}
    </div>
    <div style={{ fontSize: 11, color: 'var(--text-placeholder)', marginTop: 1 }}>
      {formatTimestamp(item.timestamp)}
    </div>
  </div>
  {/* score badge */}
  <span style={{
    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, flexShrink: 0,
    background: item.score >= 80 ? 'var(--green-bg)' : item.score >= 60 ? 'var(--amber-bg)' : 'var(--red-bg)',
    color: item.score >= 80 ? '#15803d' : item.score >= 60 ? '#92400e' : '#991b1b',
  }}>
    {item.score}%
  </span>
</div>
```

- [ ] **Step 3: Update tooltip/popover**

Set tooltip bg to `var(--surface)`, border `var(--border)`, text `var(--text-primary)`, shadow `0 4px 24px rgba(0,0,0,0.1)`.

- [ ] **Step 4: Build and verify**

```bash
npm run build 2>&1 | tail -8
```

- [ ] **Step 5: Commit**

```bash
git add components/HistoryList.tsx
git commit -m "design: redesign HistoryList sidebar to Clean App style"
```

---

## Task 6: WordDetailModal Redesign

**Files:**
- Modify: `components/WordDetailModal.tsx`

- [ ] **Step 1: Update modal overlay and container**

```tsx
{/* Overlay */}
<div className="fixed inset-0 z-50 flex items-center justify-center p-4"
  style={{ background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(8px)' }}
  onClick={onClose}>
  <div className="rounded-2xl overflow-hidden w-full max-w-md max-h-[85vh] flex flex-col animate-scale-in"
    style={{ background: 'var(--surface)', boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)' }}
    onClick={e => e.stopPropagation()}>
```

- [ ] **Step 2: Update score display — replace ring with score bar**

```tsx
{/* Header */}
<div className="flex items-start justify-between px-5 pt-5">
  <span className="font-brand" style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', color: scoreColor }}>
    {word.word}
  </span>
  <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-sm"
    style={{ background: 'var(--surface-muted)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
    ✕
  </button>
</div>

{/* Score row */}
<div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
  <div>
    <span className="font-brand num" style={{ fontSize: 28, fontWeight: 800, color: scoreColor, letterSpacing: '-0.03em' }}>
      {word.wordScore ?? '--'}%
    </span>
    <div className="font-mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
      Correct: <span style={{ color: 'var(--green)' }}>{word.phoneticCorrect}</span>
    </div>
  </div>
  <div className="flex-1">
    <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'var(--surface-muted)' }}>
      <div className="rounded-full h-full transition-all duration-700"
        style={{ width: `${word.wordScore ?? 0}%`, background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}dd)` }} />
    </div>
    <div style={{ fontSize: 11, color: 'var(--text-placeholder)', marginTop: 4 }}>
      {(word.wordScore ?? 0) >= 80 ? 'Excellent' : (word.wordScore ?? 0) >= 60 ? 'Good' : 'Needs improvement'}
    </div>
  </div>
</div>
```

- [ ] **Step 3: Update action buttons row**

```tsx
<div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
  <button onClick={handleCoachPlay}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
    style={{ border: '1.5px solid var(--rose)', color: 'var(--rose)', background: 'var(--surface)' }}>
    ♪ Coach
  </button>
  <button onClick={handleYouPlay}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
    style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }}>
    ◎ You
  </button>
  <button
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ml-auto"
    style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'var(--surface-muted)' }}
    onClick={onClose}>
    ⏺ Re-record word
  </button>
</div>
```

- [ ] **Step 4: Update phoneme breakdown rows**

```tsx
{/* Phoneme row */}
<div className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--surface-muted)' }}>
  {/* Symbol */}
  <span className="font-mono text-center" style={{ fontSize: 15, fontWeight: 600, width: 32, color: ph.score >= 70 ? 'var(--green)' : 'var(--red)' }}>
    {ph.phoneme}
  </span>
  {/* Bar + you said */}
  <div className="flex-1">
    <div className="rounded-full overflow-hidden" style={{ height: 5, background: 'var(--surface-muted)' }}>
      <div className="rounded-full h-full"
        style={{ width: `${ph.score}%`, background: ph.score >= 70 ? 'var(--green)' : 'var(--red)' }} />
    </div>
    {ph.userPhoneme && (
      <div className="flex items-center gap-1 mt-1">
        <span style={{ fontSize: 11, color: 'var(--text-placeholder)' }}>You said:</span>
        <span className="font-mono" style={{ fontSize: 12, color: 'var(--red)' }}>{ph.userPhoneme}</span>
        <button onClick={() => playPhoneme(ph.userPhoneme!)}
          style={{ fontSize: 11, color: 'var(--text-placeholder)', border: 'none', background: 'none', cursor: 'pointer' }}>▶</button>
      </div>
    )}
  </div>
  {/* Score */}
  <span style={{ fontSize: 11, fontWeight: 700, width: 32, textAlign: 'right', color: ph.score >= 70 ? 'var(--green)' : 'var(--red)' }}>
    {ph.score}%
  </span>
</div>
```

- [ ] **Step 5: Build and verify**

```bash
npm run build 2>&1 | tail -8
```

- [ ] **Step 6: Commit**

```bash
git add components/WordDetailModal.tsx
git commit -m "design: redesign WordDetailModal with score bar, phoneme rows, and clean action buttons"
```

---

## Task 7: IPALegend + ErrorBoundary Token Update

**Files:**
- Modify: `components/IPALegend.tsx`
- Modify: `components/ErrorBoundary.tsx`

- [ ] **Step 1: Update IPALegend**

Replace all hardcoded dark bg colors with token references:
- Any `#0a0b10` / `#12131c` / `#181924` → `var(--surface)` or `var(--surface-muted)`
- Any `#e8e8f0` → `var(--text-primary)`
- Any `#8b8ca0` → `var(--text-muted)`
- Modal overlay: `rgba(0,0,0,0.2)` backdrop

- [ ] **Step 2: Update ErrorBoundary**

Replace dark bg with `var(--surface)`, text with `var(--text-primary)`, error color with `var(--red)`.

- [ ] **Step 3: Build and verify**

```bash
npm run build 2>&1 | tail -8
```

- [ ] **Step 4: Commit**

```bash
git add components/IPALegend.tsx components/ErrorBoundary.tsx
git commit -m "design: update IPALegend and ErrorBoundary to Clean App tokens"
```

---

## Task 8: Final Build + Smoke Test

- [ ] **Step 1: Full build**

```bash
cd "/Users/mac/40_Creative/Cursor/05 EchoCoach" && npm run build 2>&1
```
Expected: `✓ built in ...` with zero TypeScript errors.

- [ ] **Step 2: Dev server smoke test**

```bash
npm run dev
```
Open http://localhost:5173 (or next available port). Verify:
- [ ] White/light background throughout
- [ ] Inter font renders correctly
- [ ] Score displays as large number (not ring) in feedback
- [ ] Ruby annotation row visible with IPA + stress dots + linking arcs
- [ ] "Watch on YouTube" button visible in playback row, opens correct YouTube search URL
- [ ] Word pills show IPA below word text
- [ ] History sidebar shows clean items with score badges
- [ ] Word detail modal shows score bar (not ring)
- [ ] All text legible (sufficient contrast on white bg)

- [ ] **Step 3: Run all tests**

```bash
npx vitest run 2>&1 | tail -20
```
Expected: all tests pass including the new `SentenceAnnotation` tests.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Nebula UI redesign — Clean App theme, Ruby annotation, YouTube button"
```
