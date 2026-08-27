import { AnalysisResult } from '../types';

/**
 * Carry a sentence translation across from the reference analysis onto a
 * scored recording result.
 *
 * Why this exists: the pronunciation-scoring prompt never produces a
 * `translation`, so a recording result always arrives without one. The
 * original backfills were gated on `!res.fullLinkedSentence` — i.e. they
 * only ran when the analysis returned NO linking data of its own. On the
 * common path the analysis DOES return linking data, so the gate was false
 * and the translation was silently dropped, making "Show Chinese" vanish
 * after recording a sentence the user had already played.
 *
 * The rule is therefore deliberately independent of any linking field:
 * take the cached translation whenever this result lacks one, and never
 * overwrite a translation the result already carries.
 */
export function withTranslationFrom(
  res: AnalysisResult,
  cached: Pick<AnalysisResult, 'translation'> | null | undefined,
): AnalysisResult {
  if (res.translation) return res;
  if (!cached?.translation) return res;
  return { ...res, translation: cached.translation };
}
