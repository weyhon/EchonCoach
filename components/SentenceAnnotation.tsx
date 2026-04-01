import React from 'react';
import { WordAnalysis } from '../types';
import { shouldLink, isFunctionWord } from '../services/linkingUtils';
import { generateIntonationTokens as getTokens } from '../services/intonationUtils';

export interface AnnotationWord {
  word: string;
  ipa?: string;
  isStressed: boolean;
  intonation?: '↗' | '↘';
  linksToNext: boolean;
  status?: WordAnalysis['status'];
}

/**
 * Build annotation data for each word in the sentence.
 * Pure function — easily testable.
 */
export function buildAnnotationWords(
  text: string,
  wordBreakdown: WordAnalysis[] | undefined
): AnnotationWord[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const rawWords = trimmed.split(/\s+/);
  const tokens = getTokens(text, rawWords); // e.g. ['●', '·', '●↘']

  return rawWords.map((word, i) => {
    const token = tokens[i] ?? '·';
    const cleanedWord = word.toLowerCase().replace(/[?.!,;:'"()[\]{}]/g, '');
    const isStressed = !isFunctionWord(cleanedWord);
    const intonation = token.includes('↗') ? '↗' : token.includes('↘') ? '↘' : undefined;
    const linksToNext = i < rawWords.length - 1 ? shouldLink(word, rawWords[i + 1]) : false;

    const analysis = wordBreakdown?.[i];
    return {
      word,
      ipa: analysis?.phoneticCorrect,
      isStressed,
      intonation: intonation as '↗' | '↘' | undefined,
      linksToNext,
      status: analysis?.status,
    };
  });
}

const wordColor = (status?: WordAnalysis['status']): string => {
  if (!status) return 'var(--text-primary)';
  if (status === 'correct') return 'var(--green)';
  if (status === 'incorrect') return 'var(--red)';
  return 'var(--amber)';
};

interface Props {
  text: string;
  wordBreakdown?: WordAnalysis[];
  onWordClick?: (word: string) => void;
}

export const SentenceAnnotation: React.FC<Props> = ({ text, wordBreakdown, onWordClick }) => {
  const words = buildAnnotationWords(text, wordBreakdown);

  return (
    <div className="flex flex-wrap items-end gap-x-0 gap-y-3 select-none" style={{ lineHeight: 1 }}>
      {words.map((w, i) => (
        <React.Fragment key={i}>
          {/* Word unit: annotation above, word below */}
          <div className="flex flex-col items-center" style={{ marginLeft: i === 0 ? 0 : undefined }}>
            {/* Annotation row */}
            <div className="flex items-center justify-center gap-0.5 h-5">
              {w.isStressed && (
                <span className="font-bold leading-none" style={{ fontSize: 11, color: 'var(--rose)' }}>●</span>
              )}
              {w.ipa && (
                <span className="font-mono leading-none" style={{ fontSize: 11, color: w.status ? wordColor(w.status) : 'var(--text-muted)', opacity: 0.85 }}>
                  {w.ipa}
                </span>
              )}
              {w.intonation && (
                <span className="font-bold leading-none" style={{ fontSize: 12, color: w.intonation === '↗' ? 'var(--amber)' : 'var(--text-muted)', marginLeft: 1 }}>
                  {w.intonation}
                </span>
              )}
            </div>
            {/* Word text */}
            <span
              className={`leading-none font-display${onWordClick ? ' cursor-pointer hover:opacity-70 transition-opacity' : ''}`}
              style={{
                fontSize: 22,
                fontWeight: w.isStressed ? 700 : 400,
                color: wordBreakdown ? wordColor(w.status) : 'var(--text-primary)',
                borderBottom: w.isStressed ? '2px solid var(--rose)' : undefined,
                paddingBottom: w.isStressed ? 2 : 0,
                letterSpacing: '-0.01em',
              }}
              onClick={onWordClick ? () => onWordClick(w.word.replace(/[?.!,;:'"()[\]{}]/g, '')) : undefined}
              title={onWordClick ? 'Click to hear pronunciation' : undefined}
            >
              {w.word}
            </span>
          </div>

          {/* Linking arc between this word and next */}
          {w.linksToNext && (
            <div className="flex flex-col items-center self-end" style={{ width: 16, marginBottom: 2 }}>
              <div style={{ height: 20 }} /> {/* spacer to align with annotation row */}
              <span className="leading-none font-bold" style={{ fontSize: 24, color: 'var(--rose)', lineHeight: 1, marginBottom: 1, textShadow: '0 0 8px var(--pink-dim)' }}>‿</span>
            </div>
          )}

          {/* Space between words (when no link) */}
          {!w.linksToNext && i < words.length - 1 && (
            <div style={{ width: 8 }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
