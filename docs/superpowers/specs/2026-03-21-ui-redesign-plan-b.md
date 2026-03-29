# Nebula UI Redesign — Plan B Design Spec

**Date:** 2026-03-21
**Status:** Approved by user
**Scope:** Full visual + interaction redesign across all components

---

## 1. Design Direction

**Style:** Clean App — pure white surfaces, distinct card borders, SaaS clarity (Notion / Linear aesthetic)
**Theme:** Light only (no dark mode required)
**Layout:** Two-panel — left history sidebar (256px fixed) + right main content area

---

## 2. Design System Tokens

### Colors

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#f9fafb` | App background |
| `--surface` | `#ffffff` | Cards, sidebar |
| `--surface-muted` | `#f3f4f6` | Input backgrounds, muted areas |
| `--border` | `#e5e7eb` | Card borders, dividers |
| `--border-focus` | `#E8587A` | Focus rings, active states |
| `--text-primary` | `#111827` | Body text, headings |
| `--text-secondary` | `#374151` | Secondary text |
| `--text-muted` | `#6b7280` | Hints, labels, timestamps |
| `--text-placeholder` | `#9ca3af` | Placeholder text |
| `--rose` | `#E8587A` | Primary accent (unchanged) |
| `--rose-50` | `#fce7ee` | Rose tint backgrounds |
| `--green` | `#22c55e` | Correct pronunciation |
| `--green-bg` | `#dcfce7` | Correct word pills |
| `--amber` | `#f59e0b` | Partial / warning |
| `--amber-bg` | `#fef3c7` | Warning word pills |
| `--red` | `#ef4444` | Incorrect pronunciation |
| `--red-bg` | `#fee2e2` | Incorrect word pills |

### Typography — Inter

| Role | Size | Weight | Letter-spacing |
|---|---|---|---|
| Display | 28px | 800 | -3% |
| Heading | 20px | 700 | -2% |
| Subhead | 15px | 600 | -1% |
| Body | 14px | 400 | 0 |
| Caption | 12px | 500 | +2% |
| Micro label | 11px | 700 | +8% uppercase |
| IPA / Mono | JetBrains Mono 13–15px | 400–600 | 0 |

Score numbers use `font-variant-numeric: tabular-nums` to prevent layout shift.

### Shadow Scale

| Level | CSS | Used for |
|---|---|---|
| xs | `0 1px 2px rgba(0,0,0,.05)` | Inline elements |
| sm | `0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04)` | Cards (default) |
| md | `0 4px 12px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.04)` | Hover / active cards |
| lg | `0 8px 24px rgba(0,0,0,.10), 0 2px 8px rgba(0,0,0,.06)` | Modals, popovers |
| focus | `0 0 0 2px #E8587A` | Focus rings |

### Spacing — 4px base grid

All padding, margin, and gap values must be multiples of 4px: `4, 8, 12, 16, 20, 24, 32, 48px`.

---

## 3. Component Specifications

### 3.1 App Shell & Header

- **Header height:** 52px, white background, 1px bottom border `#e5e7eb`
- **Logo:** Rose square mark (22×22px, r=6px) + "Nebula" (15px/800) + "Coach" micro label in rose
- **Header actions:** "IPA Guide" + settings icon — ghost buttons (11px/600, `#f3f4f6` bg)
- **Sidebar width:** 256px fixed, white bg, 1px right border

### 3.2 History Sidebar

- **Header section:** "HISTORY" micro label + always-visible search box (`#f9fafb` bg, 1px border, 8px border-radius)
- **History items:** 10px/12px padding, 8px border-radius, hover `#f9fafb`
  - Active item: `#fce7ee` background
  - Sentence text: 12px/500, ellipsis overflow
  - Timestamp: 11px, `--text-muted`
  - Score badge: pill shape, green/amber/red per score tier (≥80 / ≥60 / <60)

### 3.3 Input Card

- **Card padding:** 18px 20px
- **Label:** "PRACTICE SENTENCE" micro label
- **Textarea:** `#f9fafb` bg, 1.5px border, 8px radius, 14px/500, min-height 52px; on focus: border-color → `--rose`
- **Action row (below textarea, 10px gap):**
  - `▶ Play Reference` — rose filled button (12px/600, 9px 16px padding, 8px radius)
  - `⏺ Record` — gray secondary button
  - Speed toggle — capsule (`Normal` / `Slow`), right-aligned via `margin-left: auto`
- **Recording state:** textarea border → rose; below shows red pulsing dot + "Recording..." label + animated waveform bars (7 bars, staggered) + `■ Stop Recording` dark button

### 3.4 Feedback Card

#### Score + Sentence Display (top section)
- Score: **large number** (44px/800, letter-spacing -5%), color-coded green/amber/red
- "SCORE" micro label below number
- 1px vertical divider
- Sentence text (15px/500): words color-coded green (correct) / red+underline (incorrect) / amber (partial)

#### Playback Row
Four buttons in a horizontal row, 1px bottom border:

| Button | Style |
|---|---|
| `♪ Reference` | Rose outline (1.5px `--rose` border, rose text) |
| `◎ Your Recording` | Gray outline |
| `▶ Watch on YouTube` | Red outline (1.5px `#ff0000` border), YouTube ▶ icon, opens `youtube.com/results?search_query=[sentence]+pronunciation` in new tab |
| `⏺ Try Again` | Ghost, `margin-left: auto` |

#### Sentence Annotation Row (NEW — Ruby 注音式 Style B)

Displayed as a row of word units. Each unit is a vertical flex column:

```
  ●ˈiːzɪər          ‿    ʌp
  easier          [arc]   up
```

- **Upper row (annotation):** `JetBrains Mono` 9px, `--rose` color
  - Stress: `●` prefix before IPA for stressed syllables
  - No stress: plain IPA, `--text-muted` color
  - Linking: `‿` arc between linked word pairs, displayed as a connector element between word units
  - Intonation: `↗` (amber) or `↘` (gray) appended to last word's annotation
- **Lower row (word text):** 18px/500 for unstressed, 18px/700 for stressed words
- Word units separated by minimal gap (3–4px), linking connector has negative margin to visually bridge words

This annotation row is shown:
1. **Before recording** — as reference guide (full annotation). Computed **client-side** from `linkingUtils.ts` + `intonationUtils.ts` as soon as text is present (no API call). Triggers on initial load and on text change.
2. **After analysis** — words additionally color-coded per pronunciation score

#### Word Breakdown Section
- "WORD BREAKDOWN" micro label + "— tap a word for detail" caption inline
- Word pills: vertical flex (word + IPA below), 7px 9px padding, 7px radius
  - Green/red/amber/muted color per score; IPA in JetBrains Mono 9px
- AI feedback annotation block: amber-tinted (`#fffbeb`), amber border, light bulb icon + suggestion text

### 3.5 Word Detail Modal

- **Overlay:** `rgba(0,0,0,.15)` + `backdrop-filter: blur(8px)`
- **Modal:** white, 16px radius, max-width 400px, shadow-lg
- **Header:** large word (36px/800), color-coded by score; ✕ close button (28px square, `#f3f4f6`)
- **Score row:** score number (28px/800) + horizontal score bar (6px height, gradient fill) + "Needs improvement" / "Good" label
- **IPA row:** "Correct: [IPA in green JetBrains Mono]"
- **Action buttons:** `♪ Coach` (rose outline) | `◎ You` (gray outline) | `⏺ Re-record word` (ghost, right-aligned — visual only, triggers the main record flow for this word; full word-level re-recording is out of scope)
- **Phoneme breakdown:** list of phoneme rows
  - Left: phoneme symbol (JetBrains Mono 15px), color by score
  - Center: score bar + "You said: [IPA] ▶" play button for user's phoneme
  - Right: score percentage

### 3.6 IPA Legend & Error Boundary

- Same card/border/typography tokens as above
- White background, consistent with Clean App style

---

## 4. Interaction Improvements

### Recording UX
- **Silence detection threshold:** 3 seconds (up from 1.5s) — beginner-friendly
- **Minimum recording time:** 1.5 seconds before silence detection activates
- Recording state visually communicated via: border glow on textarea + waveform + stop button

### Sentence Annotation Behavior
- Annotation (Ruby style) shown in feedback card at all times (before and after recording)
- Before analysis: shown as reference guide with full IPA + stress + linking + intonation
- After analysis: annotation row words additionally carry color-coding from pronunciation score
- Data source: existing `linkingUtils.ts` + `intonationUtils.ts` services (already compute these values)

### YouTube Integration
- Button appears in playback row after analysis result is shown
- Opens: `https://www.youtube.com/results?search_query=${encodeURIComponent(text + ' pronunciation')}`
- Target: `_blank` with `rel="noopener noreferrer"`

---

## 5. Files to Modify

| File | Changes |
|---|---|
| `index.html` | New CSS variables (tokens), Inter font, updated `.glass` → clean card style |
| `App.tsx` | Header redesign, input card, recording state UI, layout |
| `components/FeedbackCard.tsx` | Score number, playback row + YouTube button, Ruby annotation row, word pills |
| `components/HistoryList.tsx` | Sidebar header, search box, history items, score badges |
| `components/WordDetailModal.tsx` | Score bar, phoneme rows, action buttons |
| `components/IPALegend.tsx` | Light theme tokens |
| `components/ErrorBoundary.tsx` | Light theme tokens |

---

## 6. Out of Scope

- Word-level or phoneme-level YouTube videos (only sentence-level in this spec)
- Dark mode
- Mobile layout changes (sidebar remains as drawer on mobile — existing behavior)
- Backend / API changes
