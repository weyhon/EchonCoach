# Chinese Translation — Design Spec

**Date:** 2026-06-14
**Goal:** Help A2 learners understand practice sentences by showing a Simplified Chinese translation, revealed on tap (hidden by default to encourage self-comprehension first).

## Decisions

- **Granularity:** whole sentence only (no per-word translation).
- **Reveal:** tap-to-reveal. Hidden by default; tap "显示中文" to expand, "隐藏中文" to collapse.
- **Source:** folded into the existing `getLinkingAnalysisForText` Gemini call — no extra API round-trip.

## Changes

### 1. `types.ts`
Add optional field to `AnalysisResult`:
```ts
translation?: string; // Simplified Chinese translation of speechScript
```

### 2. Prompts (3 files: `api/linking.ts`, `services/geminiService.ts`, `services/minimaxService.ts`)
Add a `translation` field to the required JSON output, with instruction:
> `translation`: a natural Simplified Chinese (简体中文) translation of the sentence. Conversational, not word-for-word.

Add `translation` to each example object.

### 3. `services/geminiService.ts` — `getLinkingAnalysisForText`
Pass `parsed.translation` through into the returned object (alongside fullLinkedSentence etc.). Fallback paths (`generateSmartFallback`) leave it `undefined`.

### 4. `App.tsx` — `playAndAnalyze`
Carry `translation` from the linking result into `enrichedRes`. (It rides the existing cache + history automatically once it's on AnalysisResult.)

### 5. `components/FeedbackCard.tsx`
Below `SentenceAnnotation`, render a centered toggle when `result.translation` is non-empty:
- Collapsed: button "显示中文" (muted, --text-muted)
- Expanded: Chinese sentence in a soft pill (--surface-muted bg), button "隐藏中文"
- Local `useState` for expanded/collapsed; reset to collapsed when the sentence changes.

## Edge cases
- No `translation` (LLM omitted it / stale cache entry) → toggle does not render. No error.
- Translation is NOT gated in the cache like IPA — an empty translation does not force re-fetch (it's an enhancement, not core).
- Reduced-motion: expansion uses existing animation utilities which already respect `prefers-reduced-motion`.

## Testing
- Unit: none needed for prompt/UI wiring (no new pure logic). Existing 124 tests must stay green.
- Manual: enter a sentence, verify toggle appears, expands to correct Chinese, collapses; verify it persists in history; verify a sentence with no translation (offline fallback) shows no toggle.
