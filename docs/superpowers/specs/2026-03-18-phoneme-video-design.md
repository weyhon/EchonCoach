# Phoneme Video Feature Design

## Goal

In the pronunciation correction section (`WordDetailModal`), show an inline YouTube video for each phoneme the user pronounced incorrectly (score < 80). The video demonstrates how to produce that sound, helping users visually understand correct mouth position and articulation.

## Approach

Static map of IPA phoneme symbols → YouTube video IDs (Rachel's English series). Embedded as an `<iframe>` that expands inline below the phoneme row on click.

---

## A — Data Layer

**New file:** `data/phonemeVideos.ts`

A `PHONEME_VIDEOS` constant mapping each IPA phoneme symbol to a YouTube video ID. Covers all 44 standard English phonemes. Videos are from Rachel's English (consistent style and quality).

```ts
export const PHONEME_VIDEOS: Record<string, string> = {
  // Vowels
  'iː': '...',  // FLEECE vowel
  'ɪ':  '...',  // KIT vowel
  'e':  '...',  // DRESS vowel
  'æ':  '...',  // TRAP vowel
  'ɑː': '...',  // START vowel
  'ɒ':  '...',  // LOT vowel
  'ɔː': '...',  // THOUGHT vowel
  'ʊ':  '...',  // FOOT vowel
  'uː': '...',  // GOOSE vowel
  'ʌ':  '...',  // STRUT vowel
  'ɜː': '...',  // NURSE vowel
  'ə':  '...',  // schwa
  // Diphthongs
  'eɪ': '...',  // FACE
  'aɪ': '...',  // PRICE
  'ɔɪ': '...',  // CHOICE
  'əʊ': '...',  // GOAT
  'aʊ': '...',  // MOUTH
  'ɪə': '...',  // NEAR
  'eə': '...',  // SQUARE
  'ʊə': '...',  // CURE
  // Consonants — plosives
  'p':  '...',
  'b':  '...',
  't':  '...',
  'd':  '...',
  'k':  '...',
  'ɡ':  '...',
  // Consonants — fricatives
  'f':  '...',
  'v':  '...',
  'θ':  '...',  // thin
  'ð':  '...',  // this
  's':  '...',
  'z':  '...',
  'ʃ':  '...',  // she
  'ʒ':  '...',  // measure
  'h':  '...',
  // Consonants — affricates
  'tʃ': '...',  // church
  'dʒ': '...',  // judge
  // Consonants — nasals
  'm':  '...',
  'n':  '...',
  'ŋ':  '...',  // sing
  // Consonants — approximants
  'l':  '...',
  'r':  '...',
  'j':  '...',  // yes
  'w':  '...',
}
```

Video IDs are filled in during implementation by finding appropriate Rachel's English YouTube videos for each phoneme.

---

## B — UI Changes (`WordDetailModal`)

### State

Add one state variable to `WordDetailModal`:

```ts
const [openPhonemeVideo, setOpenPhonemeVideo] = useState<string | null>(null)
```

`openPhonemeVideo` holds the IPA symbol of the currently expanded phoneme video (or `null` if none open). Only one video is open at a time — clicking a new phoneme closes the previous one.

### Video icon trigger

For each phoneme row where `score < 80` AND `PHONEME_VIDEOS[phoneme]` exists, render a small camera icon button to the right of the score badge:

```tsx
{score < 80 && PHONEME_VIDEOS[phoneme] && (
  <button
    onClick={() => setOpenPhonemeVideo(
      openPhonemeVideo === phoneme ? null : phoneme
    )}
    title="Watch pronunciation video"
    className="ml-2 p-1 rounded transition-all hover:opacity-80"
    style={{ color: openPhonemeVideo === phoneme ? 'var(--pink)' : 'var(--text-muted)' }}
  >
    <VideoIcon size={14} />
  </button>
)}
```

Toggle behavior: clicking the icon again collapses the video.

### Inline iframe expansion

Immediately after the phoneme row div, conditionally render the iframe:

```tsx
{openPhonemeVideo === phoneme && (
  <div className="mt-2 mb-3 rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
    <iframe
      src={`https://www.youtube.com/embed/${PHONEME_VIDEOS[phoneme]}?rel=0&modestbranding=1&autoplay=1`}
      allow="autoplay; encrypted-media"
      allowFullScreen
      className="w-full h-full"
      title={`How to pronounce ${phoneme}`}
    />
  </div>
)}
```

Parameters:
- `rel=0` — suppress related videos
- `modestbranding=1` — minimize YouTube branding
- `autoplay=1` — start playing immediately on open

### VideoIcon

A small inline SVG camera/video icon defined locally in `WordDetailModal.tsx` alongside the existing `SpeakerSmallIcon` — consistent with the file's existing convention.

### IPA key fidelity note

The `phoneme` field comes from the MiniMax API. During implementation, add a `console.warn` for any phoneme that has no matching entry in `PHONEME_VIDEOS`, to detect any API symbol variants that differ from standard IPA Unicode. A missed lookup is safe (no icon shown), but the warning helps identify gaps during testing.

---

## C — Scope

| File | Change |
|------|--------|
| `data/phonemeVideos.ts` | **Create** — static phoneme → video ID map (44 entries) |
| `components/WordDetailModal.tsx` | **Modify** — add `openPhonemeVideo` state, video icon button, iframe expansion |

No API changes. No new dependencies. No state management changes outside `WordDetailModal`.

---

## Visual Layout

```
WordDetailModal — Phoneme Breakdown section

┌────────────────────────────────────────┐
│  /ɪ/   ████░░░░  62%   [🎥]           │  score < 80 → show icon
├────────────────────────────────────────┤
│  ┌──────────────────────────────────┐  │
│  │  [YouTube iframe — 16:9]         │  │  expanded on click
│  └──────────────────────────────────┘  │
│  /t/   ██████░░  74%   [🎥]           │  score < 80 → show icon
│  /s/   ████████  91%                  │  score ≥ 80 → no icon
└────────────────────────────────────────┘
```
