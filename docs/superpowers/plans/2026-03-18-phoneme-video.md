# Phoneme Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an inline YouTube video inside `WordDetailModal` for each phoneme the user pronounced incorrectly (score < 80), so they can see how to produce the sound correctly.

**Architecture:** Two independent tasks — a static data file mapping IPA symbols to YouTube video IDs, and UI changes to `WordDetailModal` to show a video icon and expand an iframe when clicked. Only one video is open at a time.

**Tech Stack:** React 19, TypeScript, Tailwind CSS (CDN), YouTube embed (`<iframe>`)

---

## File Map

| File | Role |
|------|------|
| `data/phonemeVideos.ts` | **Create** — static `Record<string, string>` mapping IPA symbol → YouTube video ID |
| `components/WordDetailModal.tsx` | **Modify** — add `VideoIcon`, `openPhonemeVideo` state, video icon button (score < 80), inline iframe expansion |

---

## Task 1: Create phoneme video data file

**Files:**
- Create: `data/phonemeVideos.ts`

This file maps every standard English IPA symbol to a YouTube video ID from Rachel's English (consistent quality, American English focus). Video IDs are sourced from `https://www.youtube.com/@RachelsEnglish` — search for each phoneme name.

> **To find a video ID:** Go to a Rachel's English video, e.g. `https://www.youtube.com/watch?v=XXXXXXXXXXX` — the ID is the `XXXXXXXXXXX` part after `?v=`.
>
> Suggested search per phoneme: `"Rachel's English [phoneme symbol] sound"` on YouTube. Pick a video that focuses on just that one phoneme with mouth close-up.

- [ ] **Step 1: Create `data/phonemeVideos.ts`**

```ts
// Maps IPA phoneme symbols to YouTube video IDs (Rachel's English series).
// Used by WordDetailModal to show inline pronunciation video for score < 80 phonemes.
// To update: replace the video ID string with any YouTube video ID that demonstrates the phoneme.
export const PHONEME_VIDEOS: Record<string, string> = {
  // ─── Vowels ───
  'iː': 'tMDRzZBBnBQ',  // FLEECE — Long E
  'ɪ':  'tMDRzZBBnBQ',  // KIT — Short I  (replace with specific video)
  'e':  'tMDRzZBBnBQ',  // DRESS — Short E (replace with specific video)
  'æ':  'tMDRzZBBnBQ',  // TRAP — Short A
  'ɑː': 'tMDRzZBBnBQ',  // START — Ah vowel
  'ɒ':  'tMDRzZBBnBQ',  // LOT
  'ɔː': 'tMDRzZBBnBQ',  // THOUGHT — Aw sound
  'ʊ':  'tMDRzZBBnBQ',  // FOOT — Short OO
  'uː': 'tMDRzZBBnBQ',  // GOOSE — Long OO
  'ʌ':  'tMDRzZBBnBQ',  // STRUT — Short U
  'ɜː': 'tMDRzZBBnBQ',  // NURSE — ER sound
  'ə':  'tMDRzZBBnBQ',  // schwa
  // ─── Diphthongs ───
  'eɪ': 'tMDRzZBBnBQ',  // FACE
  'aɪ': 'tMDRzZBBnBQ',  // PRICE
  'ɔɪ': 'tMDRzZBBnBQ',  // CHOICE
  'əʊ': 'tMDRzZBBnBQ',  // GOAT
  'oʊ': 'tMDRzZBBnBQ',  // GOAT (American variant)
  'aʊ': 'tMDRzZBBnBQ',  // MOUTH
  'ɪə': 'tMDRzZBBnBQ',  // NEAR
  'eə': 'tMDRzZBBnBQ',  // SQUARE
  'ʊə': 'tMDRzZBBnBQ',  // CURE
  // ─── Consonants: plosives ───
  'p':  'tMDRzZBBnBQ',
  'b':  'tMDRzZBBnBQ',
  't':  'tMDRzZBBnBQ',
  'd':  'tMDRzZBBnBQ',
  'k':  'tMDRzZBBnBQ',
  'ɡ':  'tMDRzZBBnBQ',
  'g':  'tMDRzZBBnBQ',  // ASCII g variant (same as ɡ)
  // ─── Consonants: fricatives ───
  'f':  'tMDRzZBBnBQ',
  'v':  'tMDRzZBBnBQ',
  'θ':  'tMDRzZBBnBQ',  // TH (thin)
  'ð':  'tMDRzZBBnBQ',  // TH (this)
  's':  'tMDRzZBBnBQ',
  'z':  'tMDRzZBBnBQ',
  'ʃ':  'tMDRzZBBnBQ',  // SH
  'ʒ':  'tMDRzZBBnBQ',  // ZH (measure)
  'h':  'tMDRzZBBnBQ',
  // ─── Consonants: affricates ───
  'tʃ': 'tMDRzZBBnBQ',  // CH
  'dʒ': 'tMDRzZBBnBQ',  // J
  // ─── Consonants: nasals ───
  'm':  'tMDRzZBBnBQ',
  'n':  'tMDRzZBBnBQ',
  'ŋ':  'tMDRzZBBnBQ',  // NG
  // ─── Consonants: approximants ───
  'l':  'tMDRzZBBnBQ',
  'r':  'tMDRzZBBnBQ',
  'j':  'tMDRzZBBnBQ',  // Y sound
  'w':  'tMDRzZBBnBQ',
}
```

> **IMPORTANT:** The video IDs above are all placeholder `tMDRzZBBnBQ`. Before committing, replace each one with a real YouTube video ID from Rachel's English. Search YouTube for `"Rachel's English [phoneme]"` for each sound. You don't need a unique video for every phoneme — it's fine to reuse the same video ID for variant spellings (e.g., `ɡ` and `g` both map to the same G video).
>
> A good starting playlist: Search `"Rachel's English complete guide IPA"` on YouTube for her full phoneme series.

- [ ] **Step 2: Verify file has no TypeScript errors**

```bash
cd "/Users/mac/40_Creative/Cursor/05 EchoCoach" && npx tsc --noEmit
```
Expected: no output

- [ ] **Step 3: Commit**

```bash
cd "/Users/mac/40_Creative/Cursor/05 EchoCoach" && git add data/phonemeVideos.ts && git commit -m "feat: add phoneme → YouTube video ID map"
```

---

## Task 2: Add video icon and inline iframe to WordDetailModal

**Files:**
- Modify: `components/WordDetailModal.tsx`

This task adds:
1. A `VideoIcon` SVG component (defined locally, like `SpeakerSmallIcon` at line 22)
2. `openPhonemeVideo` state (`useState<string | null>(null)`)
3. A video icon button on each phoneme row where `score < 80` and a video ID exists
4. An inline iframe that expands below the row when the icon is clicked

- [ ] **Step 1: Add `VideoIcon` component after `SpeakerSmallIcon` (after line 26)**

Find:
```tsx
const ScoreRing: React.FC<{ score: number; color: string; glowColor: string }> = ({ score, color, glowColor }) => {
```

Insert immediately before it:
```tsx
const VideoIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" className="shrink-0">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
  </svg>
);

```

- [ ] **Step 2: Add `PHONEME_VIDEOS` import**

Find the existing imports at the top of the file:
```tsx
import React, { useState } from 'react';
import { WordAnalysis } from '../types';
```

Replace with:
```tsx
import React, { useState } from 'react';
import { WordAnalysis } from '../types';
import { PHONEME_VIDEOS } from '../data/phonemeVideos';
```

- [ ] **Step 3: Add `openPhonemeVideo` state and dev warning helper inside the component**

Find (line 57):
```tsx
  const [playingPhoneme, setPlayingPhoneme] = useState<string | null>(null);
```

Replace with:
```tsx
  const [playingPhoneme, setPlayingPhoneme] = useState<string | null>(null);
  const [openPhonemeVideo, setOpenPhonemeVideo] = useState<string | null>(null);

  // Dev helper: warn when a low-scoring phoneme has no video entry so we can add it
  const warnMissingVideo = (phoneme: string) => {
    if (import.meta.env.DEV && !PHONEME_VIDEOS[phoneme]) {
      console.warn(`[PhonemeVideo] no video for phoneme: "${phoneme}" — add it to data/phonemeVideos.ts`);
    }
  };
```

- [ ] **Step 4: Call `warnMissingVideo` inside the phoneme map**

Inside the phoneme map, find (line ~167):
```tsx
                {phonemes.map((p, i) => {
                  const pColor = p.score >= 80 ? 'var(--green)' : p.score >= 50 ? 'var(--amber)' : 'var(--red)';
                  const pBg = p.score >= 80 ? 'rgba(74,222,128,0.1)' : p.score >= 50 ? 'rgba(251,191,36,0.1)' : 'rgba(248,113,113,0.1)';
                  const isCorrectPlaying = playingPhoneme === `correct-${i}`;
                  const isUserPlaying = playingPhoneme === `user-${i}`;
                  return (
```

Replace with:
```tsx
                {phonemes.map((p, i) => {
                  const pColor = p.score >= 80 ? 'var(--green)' : p.score >= 50 ? 'var(--amber)' : 'var(--red)';
                  const pBg = p.score >= 80 ? 'rgba(74,222,128,0.1)' : p.score >= 50 ? 'rgba(251,191,36,0.1)' : 'rgba(248,113,113,0.1)';
                  const isCorrectPlaying = playingPhoneme === `correct-${i}`;
                  const isUserPlaying = playingPhoneme === `user-${i}`;
                  if (p.score < 80) warnMissingVideo(p.phoneme);
                  return (
```

- [ ] **Step 5: Add video icon button to phoneme row**

Inside the phoneme map (around line 194), find the score badge:
```tsx
                        {/* Score badge */}
                        <span className="text-[12px] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ backgroundColor: pBg, color: pColor }}>{p.score}%</span>
                      </div>
```

Replace with:
```tsx
                        {/* Score badge */}
                        <span className="text-[12px] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ backgroundColor: pBg, color: pColor }}>{p.score}%</span>

                        {/* Video icon — only for score < 80 with a known video */}
                        {p.score < 80 && PHONEME_VIDEOS[p.phoneme] && (
                          <button
                            onClick={() => setOpenPhonemeVideo(
                              openPhonemeVideo === p.phoneme ? null : p.phoneme
                            )}
                            title="Watch pronunciation video"
                            className="p-1.5 rounded-lg transition-all active:scale-90 hover-lift shrink-0"
                            style={{
                              backgroundColor: openPhonemeVideo === p.phoneme ? 'var(--pink-dim)' : 'var(--bg-card)',
                              color: openPhonemeVideo === p.phoneme ? 'var(--pink)' : 'var(--text-muted)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <VideoIcon size={13} />
                          </button>
                        )}
                      </div>
```

- [ ] **Step 6: Add inline iframe expansion after the user phoneme row**

Find (the closing of the phoneme card div, after the user phoneme conditional block):
```tsx
                      {/* User phoneme row (if different) */}
                      {p.userPhoneme && (
                        <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <span className="text-[10px] font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>You said</span>
                          <button
                            onClick={() => handlePlayPhoneme(`Pronounce the English phoneme sound: /${p.userPhoneme}/`, `user-${i}`)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all active:scale-90 hover-lift shrink-0"
                            style={{ backgroundColor: isUserPlaying ? 'rgba(248,113,113,0.2)' : 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)' }}
                            title={`Hear your sound: /${p.userPhoneme}/`}
                          >
                            <span className="font-mono text-lg font-bold" style={{ color: 'var(--red)' }}>{p.userPhoneme}</span>
                            <SpeakerSmallIcon size={12} />
                          </button>
                          <svg className="w-4 h-4 shrink-0 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          <span className="font-mono text-sm font-medium" style={{ color: pColor }}>/{p.phoneme}/</span>
                        </div>
                      )}
                    </div>
```

Replace with:
```tsx
                      {/* User phoneme row (if different) */}
                      {p.userPhoneme && (
                        <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <span className="text-[10px] font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>You said</span>
                          <button
                            onClick={() => handlePlayPhoneme(`Pronounce the English phoneme sound: /${p.userPhoneme}/`, `user-${i}`)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all active:scale-90 hover-lift shrink-0"
                            style={{ backgroundColor: isUserPlaying ? 'rgba(248,113,113,0.2)' : 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)' }}
                            title={`Hear your sound: /${p.userPhoneme}/`}
                          >
                            <span className="font-mono text-lg font-bold" style={{ color: 'var(--red)' }}>{p.userPhoneme}</span>
                            <SpeakerSmallIcon size={12} />
                          </button>
                          <svg className="w-4 h-4 shrink-0 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          <span className="font-mono text-sm font-medium" style={{ color: pColor }}>/{p.phoneme}/</span>
                        </div>
                      )}

                      {/* Inline video — expands when video icon is clicked */}
                      {openPhonemeVideo === p.phoneme && PHONEME_VIDEOS[p.phoneme] && (
                        <div className="mt-2 rounded-xl overflow-hidden" style={{ aspectRatio: '16/9', border: '1px solid var(--border-subtle)' }}>
                          <iframe
                            src={`https://www.youtube.com/embed/${PHONEME_VIDEOS[p.phoneme]}?rel=0&modestbranding=1&autoplay=1`}
                            allow="autoplay; encrypted-media"
                            allowFullScreen
                            className="w-full h-full"
                            title={`How to pronounce /${p.phoneme}/`}
                          />
                        </div>
                      )}
                    </div>
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd "/Users/mac/40_Creative/Cursor/05 EchoCoach" && npx tsc --noEmit
```
Expected: no output. Fix any errors before committing.

- [ ] **Step 8: Commit**

```bash
cd "/Users/mac/40_Creative/Cursor/05 EchoCoach" && git add components/WordDetailModal.tsx && git commit -m "feat: add inline phoneme video in WordDetailModal"
```

---

## Verification

After both tasks:

1. `npm run dev` in the project folder, open http://localhost:5173
2. Record a sentence (e.g. "I think this is difficult")
3. Click a word with low-scoring phonemes in the Word Breakdown section
4. In the `WordDetailModal`, phonemes with score < 80 should show a small video camera icon on the right
5. Click the icon → a YouTube video expands inline below that phoneme row
6. Click the icon again → video collapses
7. Click a different phoneme's icon → previous video closes, new one opens
8. Phonemes with score ≥ 80 should have no video icon

Check the browser console for any `[PhonemeVideo] no video for phoneme:` warnings — these indicate API phoneme symbols that don't match map keys. If you see them, add the missing symbols to `PHONEME_VIDEOS`.
