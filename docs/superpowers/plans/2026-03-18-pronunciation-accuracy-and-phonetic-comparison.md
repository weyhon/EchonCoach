# Pronunciation Accuracy & Phonetic Comparison Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make pronunciation analysis more accurate and add inline IPA comparison (your IPA vs correct IPA) so users can see exactly where they went wrong.

**Architecture:** Two independent improvements — (1) tighten the AI prompt so it always returns user phonetics and use the more capable model first; (2) update the word card UI to show a two-line IPA comparison for incorrect/needs-improvement words, and make the modal comparison always visible.

**Tech Stack:** React 19, TypeScript, Gemini API (`gemini-2.5-pro` for audio analysis), Tailwind CSS via CDN

---

## File Map

| File | Change |
|------|--------|
| `services/geminiService.ts` | Stronger prompt + model order flip + JSON mode |
| `components/FeedbackCard.tsx` | `WordSmallItem`: add `phoneticUser` comparison row |
| `components/WordDetailModal.tsx` | Remove `phonemes.length === 0` gate on Compare section |

---

## Chunk 1: Improve AI Pronunciation Analysis Accuracy

### Root causes found

1. `phoneticUser` marked optional — AI skips it for "correct" words and often for others too
2. `phonemes.userPhoneme` says "omit if correct" — leaves comparison data gaps
3. Model order: `gemini-2.5-flash` first → less accurate audio analysis
4. `responseMimeType: "application/json"` missing on pronunciation call → AI wraps output in markdown

### Task 1: Rewrite the pronunciation analysis prompt + fix model order

**Files:**
- Modify: `services/geminiService.ts` (lines 115–224)

- [ ] **Step 1: Replace `PRONUNCIATION_ANALYSIS_INSTRUCTION` with stronger version**

Find the constant (line 115) and replace the entire string:

```typescript
const PRONUNCIATION_ANALYSIS_INSTRUCTION = `You are an expert English pronunciation evaluator with deep phonetics knowledge.

Your task: Listen carefully to the audio and compare EVERY word to the reference sentence. You MUST identify what the learner actually said, even when close to correct.

## MANDATORY FIELDS — never omit these

For EVERY word in wordBreakdown:
- "phoneticUser": REQUIRED — write what the learner actually produced in IPA.
  - If perfect: copy phoneticCorrect exactly.
  - If different: write the actual sounds heard (e.g. "wɛri" instead of "vɛri").
- "phonemes": REQUIRED for every word with wordScore < 90.
  - Each phoneme entry MUST include "userPhoneme" when score < 85, even if close.

## Scoring Rubric (0-100)

### 90-100: Excellent — all phonemes correct, natural rhythm, proper linking
### 75-89: Good — 1-2 minor substitutions, correct stress, slight accent
### 60-74: Fair — noticeable errors, some stress issues, choppy rhythm
### 40-59: Needs Work — frequent errors affecting clarity, wrong stress
### 0-39: Significant — most phonemes wrong, very hard to understand

## Focus Areas

1. **Vowels**: /æ/ vs /ɛ/, /ɪ/ vs /iː/, /ʊ/ vs /uː/, /ɑː/ vs /ʌ/, /ɜːr/ vs /ɔ/
2. **Consonants**: /θ/ /ð/ (often → /s/ /z/ or /t/ /d/), /r/ vs /l/, /v/ vs /w/ or /b/
3. **Final consonants**: dropped /t/ /d/ /s/ /z/ at word endings
4. **Stress**: primary stress on content words, weak forms for function words
5. **Intonation & linking**: rising yes/no questions, falling statements
6. **Common L2 errors**: adding vowels between consonant clusters, shortening long vowels

## Word Status

- "correct": sounds accurate, stress right — phoneticUser still REQUIRED
- "needs_improvement": understandable but noticeable issues
- "incorrect": phoneme substitution that obscures the word

## Output Format (strict JSON — no markdown, no extra text)

{
  "score": <0-100>,
  "overallComment": "<1-2 sentences: most impactful improvement the learner can make>",
  "speechScript": "<exact reference text>",
  "wordBreakdown": [
    {
      "word": "<word>",
      "status": "correct" | "needs_improvement" | "incorrect",
      "phoneticCorrect": "<correct IPA, no stress marks>",
      "phoneticUser": "<REQUIRED: what learner actually produced in IPA>",
      "wordScore": <0-100>,
      "phonemes": [
        {
          "phoneme": "<correct phoneme>",
          "score": <0-100>,
          "userPhoneme": "<REQUIRED when score < 85: what learner produced>"
        }
      ],
      "suggestion": "<physical tip: tongue position, lip shape, airflow — empty string if correct>"
    }
  ],
  "fullLinkedSentence": "<reference with ‿ linking>",
  "fullLinkedPhonetic": "<IPA with ˈ on content words, . at linking points>",
  "intonationMap": "<space-separated ● · tokens, last token has ↗ or ↘>"
}

CRITICAL:
- Be honest, not flattering. Do not inflate scores to encourage.
- phoneticUser is NEVER optional. Always fill it in.
- If audio is silent or unintelligible, return score 0.`;
```

- [ ] **Step 2: Flip model order and add `responseMimeType`**

Find (line 192–223):
```typescript
const ANALYSIS_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro"] as const;
```
Change to:
```typescript
const ANALYSIS_MODELS = ["gemini-2.5-pro", "gemini-2.5-flash"] as const;
```

Then inside `analyzePronunciation`, find the `config` block and add `responseMimeType`:
```typescript
        config: {
          systemInstruction: PRONUNCIATION_ANALYSIS_INSTRUCTION,
          responseMimeType: "application/json",
        }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/Users/mac/40_Creative/Cursor/05 EchoCoach" && npx tsc --noEmit
```
Expected: no output (zero errors)

---

## Chunk 2: Inline Phonetic Comparison in Word Cards

### Problem

`WordSmallItem` in `FeedbackCard.tsx` only shows `phoneticCorrect`. Users can't see their IPA without clicking into the modal.

### Task 2: Add IPA comparison row to `WordSmallItem`

**Files:**
- Modify: `components/FeedbackCard.tsx` (lines 401–418, the `WordSmallItem` component)

- [ ] **Step 1: Replace `WordSmallItem` with comparison-aware version**

Find the entire `WordSmallItem` component (starts `const WordSmallItem`) and replace it:

```tsx
const WordSmallItem: React.FC<{ item: WordAnalysis; onPlay: () => void; isPlaying: boolean }> = ({ item, onPlay, isPlaying }) => {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    correct: { bg: 'rgba(74,222,128,0.1)', text: 'var(--green)', border: 'rgba(74,222,128,0.2)' },
    incorrect: { bg: 'rgba(248,113,113,0.1)', text: 'var(--red)', border: 'rgba(248,113,113,0.2)' },
    needs_improvement: { bg: 'rgba(251,191,36,0.1)', text: 'var(--amber)', border: 'rgba(251,191,36,0.2)' },
  };
  const c = colors[item.status] || colors.needs_improvement;
  const showComparison = item.status !== 'correct' && item.phoneticUser && item.phoneticUser !== item.phoneticCorrect;

  return (
    <button
      onClick={onPlay}
      className={`flex flex-col items-center px-4 py-2.5 rounded-xl border transition-all active:scale-95 hover-lift ${isPlaying ? 'ring-2 scale-105' : ''}`}
      style={{ backgroundColor: c.bg, borderColor: c.border, color: c.text, ...(isPlaying ? { ringColor: 'var(--pink)' } : {}) }}
    >
      <span className="text-[14px] font-semibold tracking-tight">{item.word}</span>

      {showComparison ? (
        <div className="flex flex-col items-center gap-0.5 mt-1">
          {/* Correct IPA */}
          <span className="text-[10px] font-mono opacity-80 flex items-center gap-1">
            <span className="text-[8px] font-semibold uppercase" style={{ color: 'var(--green)', opacity: 0.8 }}>✓</span>
            /{item.phoneticCorrect}/
          </span>
          {/* User IPA */}
          <span className="text-[10px] font-mono flex items-center gap-1" style={{ color: 'var(--red)', opacity: 0.9 }}>
            <span className="text-[8px] font-semibold uppercase" style={{ color: 'var(--red)', opacity: 0.8 }}>✗</span>
            /{item.phoneticUser}/
          </span>
        </div>
      ) : (
        <span className="text-[10px] opacity-60 mt-0.5 font-mono">/{item.phoneticCorrect}/</span>
      )}

      {item.wordScore != null && (
        <span className="text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded-full" style={{ backgroundColor: c.border, color: c.text }}>{item.wordScore}%</span>
      )}
    </button>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/mac/40_Creative/Cursor/05 EchoCoach" && npx tsc --noEmit
```
Expected: no output

- [ ] **Step 3: Verify visually in browser**

1. Go to http://localhost:5173
2. Type "How is it going?" and click Listen
3. Click Record and say it with intentional errors (e.g., say "gow-ing" instead of "goʊɪŋ")
4. After analysis, the Word Breakdown section should show:
   - Incorrect words: two IPA lines (✓ correct / ✗ yours)
   - Correct words: single IPA line as before

---

## Chunk 3: Always Show IPA Comparison in WordDetailModal

### Problem

The "Compare Sounds" section in `WordDetailModal.tsx` (line 239) only renders when `phonemes.length === 0`. When phoneme detail IS present, users can only see their IPA hidden inside each phoneme row — the word-level side-by-side comparison disappears.

### Task 3: Always render word-level IPA comparison when phoneticUser differs

**Files:**
- Modify: `components/WordDetailModal.tsx` (lines 238–273)

- [ ] **Step 1: Remove the `phonemes.length === 0` gate**

Find:
```tsx
          {/* ─── What you said vs correct (when no phoneme data) ─── */}
          {phonemes.length === 0 && item.phoneticUser && item.phoneticUser !== item.phoneticCorrect && (
```

Replace just that condition line with:
```tsx
          {/* ─── IPA Comparison: always show when user said something different ─── */}
          {item.phoneticUser && item.phoneticUser !== item.phoneticCorrect && (
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/mac/40_Creative/Cursor/05 EchoCoach" && npx tsc --noEmit
```
Expected: no output

- [ ] **Step 3: Verify visually in browser**

1. Record a sentence with intentional errors
2. Click any incorrect word in the Word Breakdown section
3. WordDetailModal should now show:
   - Score ring at top
   - Phoneme breakdown (if available)
   - **AND** the "Compare Sounds" side-by-side section below it
   - Tip suggestion at the bottom

---

## Summary

| Task | What changes | Expected outcome |
|------|-------------|-----------------|
| 1. Stronger AI prompt + model flip | `geminiService.ts` | AI always fills `phoneticUser`; `gemini-2.5-pro` used first for better audio analysis |
| 2. Inline IPA comparison | `FeedbackCard.tsx` | Word cards show ✓/✗ IPA at a glance without opening modal |
| 3. Always-visible modal comparison | `WordDetailModal.tsx` | Side-by-side IPA visible even when phoneme detail present |
