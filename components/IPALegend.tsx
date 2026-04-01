import React from 'react';

interface IPALegendProps {
  show: boolean;
  onClose: () => void;
}

export const IPALegend: React.FC<IPALegendProps> = ({ show, onClose }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div role="dialog" aria-label="IPA Symbol Guide" className="glass rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto relative" style={{ boxShadow: '0 8px 48px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
        {/* Fixed close button — always visible */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="sticky top-3 float-right mr-4 mt-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm"
          style={{ backgroundColor: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="px-6 pt-5 pb-2">
          <h2 className="text-lg font-bold font-brand" style={{ color: 'var(--text-primary)' }}>IPA Symbol Guide</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>International Phonetic Alphabet reference</p>
        </div>
        <div style={{ borderBottom: '1px solid var(--border-subtle)' }}></div>

        <div className="px-6 py-5 space-y-6">
          {/* Linking */}
          <section>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span className="w-7 h-7 rounded-md flex items-center justify-center text-lg" style={{ backgroundColor: 'var(--pink-dim)', color: 'var(--pink)' }}>‿</span>
              Linking
            </h3>
            <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Marks where two words flow together in natural speech. Typically occurs when a consonant-ending word is followed by a vowel-starting word.
              </p>
              <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[10px] mb-2 font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Examples</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold" style={{ color: 'var(--pink)' }}>pick‿it</span>
                    <span style={{ color: 'var(--text-muted)' }}>/pɪ.kɪt/</span>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>sounds like "pickit"</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold" style={{ color: 'var(--pink)' }}>turn‿on</span>
                    <span style={{ color: 'var(--text-muted)' }}>/tɝ.nɑn/</span>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>sounds like "turnon"</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold" style={{ color: 'var(--pink)' }}>have‿a</span>
                    <span style={{ color: 'var(--text-muted)' }}>/hæ.və/</span>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>"have" ends with /v/ sound</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Stress */}
          <section>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span className="w-7 h-7 rounded-md flex items-center justify-center text-lg" style={{ backgroundColor: 'var(--pink-dim)', color: 'var(--pink)' }}>●</span>
              Stress
            </h3>
            <div className="rounded-xl p-4 space-y-4" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <div>
                <h4 className="font-semibold text-sm mb-1.5 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--pink)' }}>●</span> Stressed
                </h4>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Content words (nouns, verbs, adjectives) are spoken louder, longer, and clearer. They carry the main meaning.
                </p>
              </div>
              <div className="pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <h4 className="font-semibold text-sm mb-1.5 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>·</span> Unstressed
                </h4>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Function words (articles, prepositions, auxiliaries) are reduced. Vowels often weaken to schwa /ə/.
                </p>
              </div>
            </div>
          </section>

          {/* Intonation */}
          <section>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span className="w-7 h-7 rounded-md flex items-center justify-center text-lg" style={{ backgroundColor: 'rgba(251,191,36,0.1)', color: 'var(--amber)' }}>↗</span>
              Intonation
            </h3>
            <div className="rounded-xl p-4 space-y-4" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <div>
                <h4 className="font-semibold text-sm mb-1.5 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--amber)' }}>↗</span> Rising
                </h4>
                <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Used at the end of yes/no questions. Pitch goes up.</p>
                <div className="flex gap-3 text-sm">
                  <span className="font-mono" style={{ color: 'var(--amber)' }}>Are you ready↗</span>
                  <span className="font-mono" style={{ color: 'var(--amber)' }}>Do you like it↗</span>
                </div>
              </div>
              <div className="pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <h4 className="font-semibold text-sm mb-1.5 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--pink)' }}>↘</span> Falling
                </h4>
                <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Used for statements and wh-questions. Pitch goes down.</p>
                <div className="flex gap-3 text-sm">
                  <span className="font-mono" style={{ color: 'var(--pink)' }}>What's your name↘</span>
                  <span className="font-mono" style={{ color: 'var(--pink)' }}>I'm fine↘</span>
                </div>
              </div>
            </div>
          </section>

          {/* Quick Reference */}
          <section>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Quick Reference</h3>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Symbol</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Name</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}><td className="px-4 py-3 text-xl font-bold" style={{ color: 'var(--pink)' }}>‿</td><td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Link</td><td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>Words flow together</td></tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}><td className="px-4 py-3 text-xl font-bold" style={{ color: 'var(--pink)' }}>●</td><td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Stress</td><td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>Emphasized syllable</td></tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}><td className="px-4 py-3 text-xl font-bold" style={{ color: 'var(--text-muted)' }}>·</td><td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Unstressed</td><td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>Reduced syllable</td></tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}><td className="px-4 py-3 text-xl font-bold" style={{ color: 'var(--amber)' }}>↗</td><td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Rise</td><td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>Yes/no questions</td></tr>
                  <tr><td className="px-4 py-3 text-xl font-bold" style={{ color: 'var(--pink)' }}>↘</td><td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Fall</td><td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>Statements, wh-questions</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Pro Tips */}
          <section className="rounded-xl p-4" style={{ backgroundColor: 'var(--pink-dim)', border: '1px solid rgba(232,88,122,0.2)' }}>
            <h4 className="font-semibold mb-3 text-sm" style={{ color: 'var(--pink)' }}>Pro Tips</h4>
            <ul className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <li className="flex items-start gap-2">
                <span style={{ color: 'var(--pink)' }} className="shrink-0 mt-0.5">-</span>
                <span><strong style={{ color: 'var(--text-primary)' }}>Linking is based on sound, not spelling.</strong> "Have" ends with the sound /v/, so "have a" links as "have‿a".</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: 'var(--pink)' }} className="shrink-0 mt-0.5">-</span>
                <span><strong style={{ color: 'var(--text-primary)' }}>Stress changes meaning.</strong> "I didn't say HE stole it" vs "I didn't SAY he stole it" convey different things.</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: 'var(--pink)' }} className="shrink-0 mt-0.5">-</span>
                <span><strong style={{ color: 'var(--text-primary)' }}>Intonation conveys intent.</strong> The same words with different intonation can express surprise, certainty, or doubt.</span>
              </li>
            </ul>
          </section>
        </div>

        <div className="sticky bottom-0 px-6 py-4 rounded-b-2xl" style={{ backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={onClose}
            className="w-full text-white font-semibold py-2.5 px-6 rounded-full transition-colors text-sm hover:opacity-90"
            style={{ backgroundColor: 'var(--pink)', boxShadow: '0 2px 12px var(--pink-dim)' }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
