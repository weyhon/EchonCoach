/**
 * Which IPA block does each word live in?
 *
 * The pronunciation guide's IPA is grouped by LINKED CHUNK, not by word:
 * "recommend‿it" is one block, `rɛkəˈmɛn.dɪt`. Dots inside a block mark both
 * syllables and link points, so a block cannot be cut back into single words
 * reliably — and pedagogically the chunk is the right unit anyway: linked
 * words are said as one sound.
 *
 * fullLinkedSentence is the bridge: its space-separated blocks line up 1:1
 * with the IPA's, and each block's ‿-joined words give the word count. When
 * the two do not reconcile we return null and the UI highlights nothing —
 * no highlight beats a wrong one.
 */

const splitWords = (s: string): string[] => s.trim().split(/\s+/).filter(Boolean);
const norm = (w: string): string => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// "Just‿ tap" — a link mark followed by a space — is ambiguous in model
// output: sometimes one IPA block, sometimes two. Try every reading.
const MAX_AMBIGUOUS = 6;

function readings(linked: string): string[][] {
  const parts = linked.trim().split(/(‿\s+)/);
  const seams = parts.filter((_, i) => i % 2 === 1).length;
  if (seams > MAX_AMBIGUOUS) return [];
  const out: string[][] = [];
  for (let mask = 0; mask < 1 << seams; mask++) {
    let seam = 0;
    const text = parts
      .map((p, i) => (i % 2 === 1 ? ((mask >> seam++) & 1 ? '‿' : ' ') : p))
      .join('');
    out.push(splitWords(text));
  }
  return out;
}

export function wordToPhoneticBlock(
  script: string,
  linked: string | undefined,
  phonetic: string | undefined,
): number[] | null {
  if (!linked || !phonetic) return null;
  const words = splitWords(script);
  const phBlocks = splitWords(phonetic);
  if (words.length === 0 || phBlocks.length === 0) return null;

  // Several readings can fit the counts. The IPA breaks the tie: words linked
  // into one block leave a link dot in it (`ɔr.ˈpeɪ`), so a multi-word block
  // whose IPA has no dot (`ˈdʒʌst`) is evidence against that reading.
  let best: number[] | null = null;
  let bestScore = Infinity;
  let tied = false;
  for (const blocks of readings(linked)) {
    if (blocks.length !== phBlocks.length) continue;
    const blockWords = blocks.map(b => b.split('‿').filter(Boolean));
    const flat = blockWords.flat();
    if (flat.length !== words.length) continue;
    if (flat.some((w, i) => norm(w) !== norm(words[i]))) continue;
    const score = blockWords.filter((ws, b) => ws.length > 1 && !phBlocks[b].includes('.')).length;
    if (score < bestScore) {
      best = blockWords.flatMap((ws, b) => ws.map(() => b));
      bestScore = score;
      tied = false;
    } else if (score === bestScore) {
      tied = true;
    }
  }
  return tied ? null : best;
}

/** Inclusive IPA block range covering words [start..end], or null. */
export function blockRangeForWords(
  map: number[] | null,
  start: number,
  end: number,
): [number, number] | null {
  if (!map || start < 0 || end >= map.length || start > end) return null;
  return [map[start], map[end]];
}
