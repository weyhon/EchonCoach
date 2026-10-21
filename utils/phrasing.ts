/**
 * Thought groups (意群) — where a native speaker takes a breath.
 *
 * A break is stored as "pause after word i", where words are the sentence
 * split on whitespace — the same split SentenceAnnotation renders, so a break
 * index lines up with the word on screen and with the word sent to TTS.
 *
 * The model proposes the phrasing; these functions decide whether to trust it.
 * It only ever gets to ADD slashes: if its words differ from the sentence in
 * any way, its phrasing is thrown away and we fall back to punctuation.
 */

const splitWords = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);

// Compare words ignoring case, punctuation and quote style (’ vs ').
const norm = (w: string): string => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Pause after every word that carries its own mid-sentence punctuation. */
export function punctuationBreaks(text: string): number[] {
  const words = splitWords(text);
  const out: number[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    if (/[,;:.!?…]["'”’)\]]*$/.test(words[i])) out.push(i);
  }
  return out;
}

/**
 * Turn the model's slash-phrased sentence into break indices, or null if the
 * phrasing does not reproduce the sentence word for word. Punctuation breaks
 * are always included — a comma is a pause whether or not the model marked it.
 */
export function breaksFromPhrasing(text: string, phrasing: string): number[] | null {
  const words = splitWords(text);
  const groups = phrasing
    .split('/')
    .map(splitWords)
    .filter(g => g.length > 0);
  const flat = groups.flat();
  if (flat.length !== words.length) return null;
  if (flat.some((w, i) => norm(w) !== norm(words[i]))) return null;

  const breaks = new Set(punctuationBreaks(text));
  let idx = -1;
  for (let g = 0; g < groups.length - 1; g++) {
    idx += groups[g].length;
    breaks.add(idx);
  }
  return [...breaks].sort((a, b) => a - b);
}

/**
 * The text sent to TTS: "..." after each break word that has no punctuation
 * of its own. Measured on gemini-2.5-flash-preview-tts: a prompt asking for
 * thought-group pauses alone gave 0 pauses in 3/3 runs; commas gave 0–1;
 * "..." with an explicit "short breath, not a hesitation" instruction gave
 * pauses of 0.22–0.46s at 4 of 6 boundaries. Best effort, not a guarantee.
 */
export function withPauses(text: string, breaks: number[]): string {
  if (breaks.length === 0) return text;
  const at = new Set(breaks);
  return splitWords(text)
    .map((w, i) => (at.has(i) && !/[,;:.!?…]["'”’)\]]*$/.test(w) ? `${w}...` : w))
    .join(' ');
}
