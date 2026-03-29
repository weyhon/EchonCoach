# UI Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve visual clarity across 4 areas: dark mode, input section layout, feedback card hierarchy, and word card horizontal scroll.

**Architecture:** All changes are CSS/JSX only — no new dependencies, no API changes, no state changes. Each task is fully independent and can be done in any order.

**Tech Stack:** React 19, TypeScript, Tailwind CSS (CDN), CSS custom properties (`index.html`)

---

## File Map

| File | Tasks |
|------|-------|
| `index.html` | Task 1 (dark mode CSS vars + glass override) |
| `App.tsx` | Task 2 (input section restructure) |
| `components/FeedbackCard.tsx` | Task 3 (section label) + Task 4 (horizontal scroll) |

---

## Task 1: Dark Mode (System Preference)

**Files:**
- Modify: `index.html` — after `:root { }` block (line ~28), also update `.glass` rule (line ~105)

- [ ] **Step 1: Add dark mode CSS variable overrides in `index.html`**

Find the closing `}` of the `:root` block (after `--red: #ef4444;`) and insert immediately after:

```css
      @media (prefers-color-scheme: dark) {
        :root {
          --bg-deep: #0f1117;
          --bg-surface: #13151f;
          --bg-card: #1a1d2e;
          --bg-elevated: #1e2135;
          --border-subtle: rgba(255,255,255,0.07);
          --border-medium: rgba(255,255,255,0.12);
          --text-primary: #f0f1f5;
          --text-secondary: #9ba3b8;
          --text-muted: #4b5563;
          --pink-dim: rgba(232,88,122,0.15);
          --pink-glow: rgba(232,88,122,0.25);
        }
      }
```

- [ ] **Step 2: Override `.glass` background for dark mode in `index.html`**

Find the `.glass` rule (after the `@media` block you just added) and add a dark override inside a new media query right after the `.glass { }` closing brace:

```css
      @media (prefers-color-scheme: dark) {
        .glass {
          background: rgba(255, 255, 255, 0.04);
          box-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2);
        }
      }
```

- [ ] **Step 3: Verify in browser**

Open http://localhost:5173. Go to **System Preferences → Appearance → Dark** on Mac. The app should switch to a dark navy background with the same pink accent. Switch back to Light — app returns to white.

---

## Task 2: Input Section Reorganization

**Files:**
- Modify: `App.tsx` — the `{/* Voice selector */}`, `{/* Action Buttons */}`, and `{/* Keyboard hint row */}` blocks (lines ~541–638)

**Goal:** Primary actions (Listen/Slow/Record) first. Secondary row (Voice + YouTube) below it. Keyboard hints condensed.

- [ ] **Step 1: Replace Voice selector + Action Buttons + Keyboard hints with new layout**

Find this block in `App.tsx` (starts at `{/* Voice selector */}`, ends at the closing `</section>`):

```tsx
              {/* Voice selector */}
              <div className="flex items-center gap-2 flex-wrap">
```

Replace the entire section from `{/* Voice selector */}` through the keyboard hint closing `</div>` (just before `</section>`) with:

```tsx
              {/* Action Buttons — primary row */}
              <div className="flex items-center justify-between pt-3 gap-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => playAndAnalyze(text)}
                    disabled={isAudioLoading}
                    className="h-10 px-6 rounded-full text-white text-[13px] font-semibold hover:brightness-110 active:scale-[0.96] transition-all flex items-center gap-2 disabled:opacity-40"
                    style={{ backgroundColor: 'var(--pink)', boxShadow: '0 2px 12px var(--pink-dim)' }}
                  >
                    <SpeakerIcon size={15} />
                    {isAudioLoading ? 'Loading...' : 'Listen'}
                  </button>
                  <button
                    onClick={() => handlePlayTTS(text, true)}
                    className="h-10 px-4 rounded-full text-[13px] font-medium transition-all flex items-center gap-1.5 active:scale-[0.96]"
                    style={{
                      backgroundColor: activeAudioSource === 'input_slow' ? 'var(--pink-dim)' : 'var(--bg-elevated)',
                      color: activeAudioSource === 'input_slow' ? 'var(--pink)' : 'var(--text-secondary)'
                    }}
                    title="Slow playback"
                  >
                    <SnailIcon size={15} />
                    Slow
                  </button>
                </div>

                {appState === AppState.RECORDING ? (
                  <button
                    onClick={() => mediaRecorderRef.current?.stop()}
                    className="relative h-10 px-5 rounded-full text-[13px] font-semibold flex items-center gap-2.5 active:scale-[0.96] transition-all"
                    style={{ backgroundColor: 'rgba(248,113,113,0.1)', color: 'var(--red)', border: '1px solid rgba(248,113,113,0.2)' }}
                  >
                    <span className="absolute inset-0 rounded-full rec-ring" style={{ border: '2px solid var(--red)' }}></span>
                    <span className="flex items-center gap-[3px] h-5">
                      {[0, 0.15, 0.3, 0.1, 0.25].map((d, i) => (
                        <span key={i} className="rec-bar w-[3px] rounded-full" style={{ height: '100%', backgroundColor: 'var(--red)', animationDelay: `${d}s` }}></span>
                      ))}
                    </span>
                    Stop
                  </button>
                ) : appState === AppState.ANALYZING ? (
                  <div className="h-10 px-5 rounded-full flex items-center gap-2.5" style={{ backgroundColor: 'var(--pink-dim)', border: '1px solid rgba(232,88,122,0.15)' }}>
                    <div className="w-4 h-4 border-2 rounded-full animate-spin shrink-0" style={{ borderColor: 'rgba(232,88,122,0.2)', borderTopColor: 'var(--pink)' }}></div>
                    <span className="text-[13px] font-medium" style={{ color: 'var(--pink)' }}>Analyzing...</span>
                  </div>
                ) : (
                  <button
                    onClick={startRecording}
                    className="h-10 px-5 rounded-full text-[13px] font-medium flex items-center gap-2 transition-all active:scale-[0.96] hover-lift"
                    style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                  >
                    <MicrophoneIcon size={15} />
                    Record
                  </button>
                )}
              </div>

              {/* Secondary row: Voice + YouTube + keyboard hints */}
              <div className="flex items-center gap-2 flex-wrap" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
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
                <a
                  href={`https://youglish.com/pronounce/${encodeURIComponent(text.replace(/[?.!,;:'"]/g, '').trim())}/english`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--pink)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                  title="Watch native speakers say this on YouTube"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  YouTube
                </a>
              </div>

              {/* Keyboard hints — compact single line */}
              <div className="flex items-center gap-3">
                {(['Enter','Space','S','R'] as const).map((key) => (
                  <span key={key} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                    <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                      style={{ backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                      {key}
                    </kbd>
                  </span>
                ))}
              </div>
```

- [ ] **Step 2: Remove the old standalone YouTube `<a>` link** (now moved to secondary row)

Find and delete this block (it's now duplicated since we moved it):
```tsx
              {/* YouTube link */}
              <a
                href={`https://youglish.com/pronounce/${encodeURIComponent(text.replace(/[?.!,;:'"]/g, '').trim())}/english`}
```
through its closing `</a>`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/Users/mac/40_Creative/Cursor/05 EchoCoach" && npx tsc --noEmit
```
Expected: no output

---

## Task 3: Feedback Card — Pronunciation Guide Label

**Files:**
- Modify: `components/FeedbackCard.tsx` — inside the `analysis-box` div (line ~222)

- [ ] **Step 1: Add section label strip inside the analysis box**

Find in `FeedbackCard.tsx`:
```tsx
          <div className="flex flex-col items-center w-full z-10 pb-10">
            {/* Phonics at top */}
            {result.fullLinkedPhonetic && (
```

Replace with:
```tsx
          <div className="flex flex-col items-center w-full z-10 pb-10">
            {/* Section label */}
            <div className="self-stretch mb-3 px-3 py-1.5 rounded-lg flex items-center gap-2" style={{ backgroundColor: 'rgba(232,88,122,0.07)' }}>
              <svg className="w-3 h-3 shrink-0" style={{ color: 'var(--pink)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5.586V18.414a1 1 0 01-1.707.707L5.586 15z" />
              </svg>
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--pink)' }}>Pronunciation Guide</span>
            </div>
            {/* Phonics at top */}
            {result.fullLinkedPhonetic && (
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/mac/40_Creative/Cursor/05 EchoCoach" && npx tsc --noEmit
```
Expected: no output

---

## Task 4: Word Cards — Horizontal Scroll

**Files:**
- Modify: `components/FeedbackCard.tsx` — word breakdown container (line ~372) and `WordSmallItem` button

- [ ] **Step 1: Change flex-wrap to horizontal scroll on the word list container**

Find:
```tsx
          <div className="flex flex-wrap gap-3 justify-center">
```

Replace with:
```tsx
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
```

- [ ] **Step 2: Add `flex-shrink-0` to `WordSmallItem` button so cards never compress**

In `WordSmallItem`, find:
```tsx
    <button onClick={onPlay} className={`flex flex-col items-center px-4 py-2.5 rounded-xl border transition-all active:scale-95 hover-lift ${isPlaying ? 'ring-2 scale-105' : ''}`}
```

Replace with:
```tsx
    <button onClick={onPlay} className={`flex-shrink-0 flex flex-col items-center px-4 py-2.5 rounded-xl border transition-all active:scale-95 hover-lift ${isPlaying ? 'ring-2 scale-105' : ''}`}
```

- [ ] **Step 3: Add scroll hint when word count > 5**

Find (just before the `WordSmallItem` map):
```tsx
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {result.wordBreakdown.map((item, idx) => (
              <WordSmallItem key={idx} item={item} onPlay={() => setDetailWord(item)} isPlaying={playingWord === item.word} />
            ))}
          </div>
```

Replace with:
```tsx
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {result.wordBreakdown.map((item, idx) => (
              <WordSmallItem key={idx} item={item} onPlay={() => setDetailWord(item)} isPlaying={playingWord === item.word} />
            ))}
          </div>
          {result.wordBreakdown.length > 5 && (
            <p className="text-center text-[9px] mt-1" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>← scroll →</p>
          )}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "/Users/mac/40_Creative/Cursor/05 EchoCoach" && npx tsc --noEmit
```
Expected: no output

- [ ] **Step 5: Verify visually in browser**

1. Record a sentence with 6+ words (e.g. "I want to go out tonight")
2. Word Breakdown should now scroll horizontally — no wrapping
3. A faint `← scroll →` hint should appear below when >5 words
4. Switch Mac to Dark mode — app background should go dark navy
5. Input section: Voice pills + YouTube icon on secondary row below Listen/Slow/Record
6. Feedback card: pink "Pronunciation Guide" label strip at top of analysis box
