# EchoCoach UI Optimization Design

## Goal
Improve visual clarity and usability across 4 areas: input section layout, feedback card hierarchy, word breakdown cards, and dark mode.

## A — Input Section Reorganization

**Problem:** Voice selector, YouTube link, action buttons, and keyboard hints all live at the same visual level — too cluttered.

**Design:**
- **Row 1 (primary):** Listen · Slow · Record — the only things users need every session
- **Row 2 (secondary):** Voice pills + YouTube link on the same row, visually quieter (smaller, muted color)
- **Row 3 (hints):** Keyboard shortcuts condensed to a single compact line

**Files:** `App.tsx` (input section JSX, lines ~497–610)

---

## B — Feedback Card Section Label

**Problem:** The phonetics + annotation area has no visual header, so first-time users don't know what they're looking at.

**Design:**
- Add a `PRONUNCIATION GUIDE` label bar (pink tint background, uppercase, 9px) above the IPA + word annotation block inside `FeedbackCard`
- No structural change — just a thin header strip inside the existing `.analysis-box`

**Files:** `components/FeedbackCard.tsx` (analysis box section, ~line 217)

---

## C — Word Breakdown: Horizontal Scroll

**Problem:** After adding the ✓/✗ IPA comparison rows, word cards have variable heights. `flex-wrap` causes ragged multi-row layouts.

**Design:**
- Replace `flex flex-wrap gap-3 justify-center` with a horizontal scrollable row: `flex gap-3 overflow-x-auto`
- Add `flex-shrink-0` to each card so they never compress
- All cards get a consistent `min-height` so the row stays uniform
- A subtle "← scroll →" hint below when there are more than 5 words

**Files:** `components/FeedbackCard.tsx` (word breakdown flex container, ~line 372)

---

## D — Dark Mode (System-Preference)

**Problem:** No dark mode — white background is harsh at night. Mac auto-switches to dark mode at sunset.

**Design:**
- Add `@media (prefers-color-scheme: dark)` block in `index.html` overriding all CSS variables
- Dark palette:
  - `--bg-deep`: `#0f1117`
  - `--bg-surface`: `#13151f`
  - `--bg-card`: `#1a1d2e`
  - `--bg-elevated`: `#1e2135`
  - `--border-subtle`: `rgba(255,255,255,0.07)`
  - `--border-medium`: `rgba(255,255,255,0.12)`
  - `--text-primary`: `#f0f1f5`
  - `--text-secondary`: `#9ba3b8`
  - `--text-muted`: `#4b5563`
  - `--pink-dim`: `rgba(232,88,122,0.15)`
  - `--pink-glow`: `rgba(232,88,122,0.25)`
- Pink accent `#E8587A` stays the same — works on both themes
- `glass` card: darker background with subtle white border
- No toggle button needed — fully automatic via OS

**Files:** `index.html` (`:root` block + new dark media query)

---

## Scope

All 4 changes are CSS/JSX only — no new dependencies, no API changes, no state changes.
