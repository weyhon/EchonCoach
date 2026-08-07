/**
 * Script detection for the practice input.
 *
 * The coach only scores English. Fed other scripts, the pronunciation guide
 * prints the source characters where the IPA belongs (observed: Chinese input
 * rendered as `/'今天天气真好…/`), so the UI needs to say "English only"
 * before the user reads that as a transcription.
 */

// Scripts that have no place in an English sentence. Latin-1 accents
// (café, naïve) and punctuation are deliberately absent — those are fine.
const NON_ENGLISH_SCRIPT = new RegExp(
  [
    '[\\u3040-\\u30ff]',      // Hiragana, Katakana
    '[\\u3400-\\u4dbf]',      // CJK Extension A
    '[\\u4e00-\\u9fff]',      // CJK Unified Ideographs
    '[\\uf900-\\ufaff]',      // CJK Compatibility Ideographs
    '[\\uac00-\\ud7af]',      // Hangul
    '[\\u0400-\\u04ff]',      // Cyrillic
    '[\\u0590-\\u05ff]',      // Hebrew
    '[\\u0600-\\u06ff]',      // Arabic
    '[\\u0e00-\\u0e7f]',      // Thai
    '[\\u3000-\\u303f]',      // CJK punctuation （，。、）
    '[\\uff00-\\uffef]',      // Fullwidth forms
  ].join('|')
);

export function containsNonEnglishScript(text: string): boolean {
  return NON_ENGLISH_SCRIPT.test(text);
}
