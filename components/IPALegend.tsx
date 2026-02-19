import React from 'react';

interface IPALegendProps {
  show: boolean;
  onClose: () => void;
}

export const IPALegend: React.FC<IPALegendProps> = ({ show, onClose }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-8 py-6 flex items-center justify-between rounded-t-3xl">
          <div>
            <h2 className="text-2xl font-black text-slate-800">音标符号说明</h2>
            <p className="text-sm text-slate-500 mt-1">IPA (International Phonetic Alphabet) Guide</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-8 py-6 space-y-8">
          {/* Linking Section */}
          <section>
            <h3 className="text-lg font-black text-slate-700 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 text-xl">‿</span>
              连读符号 (Linking)
            </h3>
            <div className="bg-slate-50 rounded-2xl p-6 space-y-4">
              <div className="flex items-start gap-4">
                <span className="text-4xl text-indigo-600 font-black shrink-0">‿</span>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 mb-2">连读线 (Linking Mark)</h4>
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">
                    表示两个词之间要连读，通常发生在辅音结尾的词后面跟着元音开头的词时。连读是美式英语流利发音的关键特征。
                  </p>
                  <div className="bg-white rounded-xl p-4 border border-slate-200">
                    <p className="text-xs text-slate-500 mb-2 font-semibold">示例 (Examples):</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-indigo-600 font-bold">pick‿it</span>
                        <span className="text-slate-400">→</span>
                        <span className="font-mono text-slate-600">/pɪ kɪt/</span>
                        <span className="text-slate-500 text-xs">(听起来像 "pickit")</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-indigo-600 font-bold">turn‿on</span>
                        <span className="text-slate-400">→</span>
                        <span className="font-mono text-slate-600">/tɝ nɑn/</span>
                        <span className="text-slate-500 text-xs">(听起来像 "turnon")</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-indigo-600 font-bold">have‿a</span>
                        <span className="text-slate-400">→</span>
                        <span className="font-mono text-slate-600">/hæ və/</span>
                        <span className="text-slate-500 text-xs">(注意: "have" 发音结尾是 /v/)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Stress Section */}
          <section>
            <h3 className="text-lg font-black text-slate-700 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 text-xl">●</span>
              重音符号 (Stress)
            </h3>
            <div className="bg-slate-50 rounded-2xl p-6 space-y-4">
              <div className="flex items-start gap-4">
                <span className="text-4xl text-indigo-600 font-black shrink-0">●</span>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 mb-2">重音 (Primary Stress)</h4>
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">
                    标记需要重读的音节或单词。重读时声音更大、更清晰、时长更长。在句子中，实义词（名词、动词、形容词）通常需要重读。
                  </p>
                  <div className="bg-white rounded-xl p-4 border border-slate-200">
                    <p className="text-xs text-slate-500 mb-2 font-semibold">示例 (Example):</p>
                    <div className="text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-purple-600 font-bold">●TELL us</span>
                        <span className="text-slate-500 text-xs">(重读 "tell"，轻读 "us")</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4 pt-4 border-t border-slate-200">
                <span className="text-4xl text-slate-400 font-black shrink-0">·</span>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 mb-2">非重音/弱读 (Unstressed)</h4>
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">
                    标记轻读的音节或单词。弱读时声音更轻、更短、元音常常弱化为 /ə/（schwa）。功能词（冠词、介词、助动词）通常弱读。
                  </p>
                  <div className="bg-white rounded-xl p-4 border border-slate-200">
                    <p className="text-xs text-slate-500 mb-2 font-semibold">示例 (Example):</p>
                    <div className="text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-500 font-bold">tell ·us</span>
                        <span className="text-slate-500 text-xs">(轻读 "us"，发音接近 /əs/)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Intonation Section */}
          <section>
            <h3 className="text-lg font-black text-slate-700 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 text-xl">↗</span>
              语调符号 (Intonation)
            </h3>
            <div className="bg-slate-50 rounded-2xl p-6 space-y-4">
              <div className="flex items-start gap-4">
                <span className="text-4xl text-orange-500 font-black shrink-0">↗</span>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 mb-2">升调 (Rising Intonation)</h4>
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">
                    用于一般疑问句（Yes/No Questions）结尾。声调上扬，表示疑问、不确定或未完成的意思。
                  </p>
                  <div className="bg-white rounded-xl p-4 border border-slate-200">
                    <p className="text-xs text-slate-500 mb-2 font-semibold">示例 (Examples):</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-orange-600 font-bold">Are you ready↗</span>
                        <span className="text-slate-500 text-xs">(句尾声调上扬)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-orange-600 font-bold">Do you like it↗</span>
                        <span className="text-slate-500 text-xs">(期待 Yes/No 回答)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4 pt-4 border-t border-slate-200">
                <span className="text-4xl text-sky-500 font-black shrink-0">↘</span>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 mb-2">降调 (Falling Intonation)</h4>
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">
                    用于陈述句和特殊疑问句（Wh-Questions）结尾。声调下降，表示陈述、确定或完成的意思。
                  </p>
                  <div className="bg-white rounded-xl p-4 border border-slate-200">
                    <p className="text-xs text-slate-500 mb-2 font-semibold">示例 (Examples):</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sky-600 font-bold">What's your name↘</span>
                        <span className="text-slate-500 text-xs">(特殊疑问句用降调)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sky-600 font-bold">I'm fine↘</span>
                        <span className="text-slate-500 text-xs">(陈述句用降调)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Pro Tips Section */}
          <section className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border-2 border-indigo-100">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-black text-indigo-900 mb-3 text-lg">专业提示 (Pro Tips)</h4>
                <ul className="space-y-2 text-sm text-indigo-800">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-black shrink-0">•</span>
                    <span><strong>连读基于发音，不是拼写:</strong> "have" 虽然以 e 结尾，但实际发音是 /hæv/（辅音结尾），所以 "have a" 会连读成 "have‿a"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-black shrink-0">•</span>
                    <span><strong>连读让语速更自然:</strong> 母语者说话时会自然连读，这是流利英语的标志。不要刻意停顿，让词语自然流动</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-black shrink-0">•</span>
                    <span><strong>重音影响意思:</strong> 重音位置不同，句子含义可能完全不同。例如 "I didn't say he stole the money" 重读不同的词会有7种不同的意思</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-black shrink-0">•</span>
                    <span><strong>语调传达情感:</strong> 同样的句子，用升调或降调会传达不同的情绪和意图。掌握语调能让你的英语更地道</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Quick Reference Table */}
          <section>
            <h3 className="text-lg font-black text-slate-700 mb-4">快速参考 (Quick Reference)</h3>
            <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-6 py-3 text-xs font-black text-slate-600 uppercase tracking-wider">符号</th>
                    <th className="text-left px-6 py-3 text-xs font-black text-slate-600 uppercase tracking-wider">名称</th>
                    <th className="text-left px-6 py-3 text-xs font-black text-slate-600 uppercase tracking-wider">用途</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-2xl text-indigo-600 font-black">‿</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-700">连读线</td>
                    <td className="px-6 py-4 text-sm text-slate-600">标记两个词的连读位置</td>
                  </tr>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-2xl text-purple-600 font-black">●</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-700">重音</td>
                    <td className="px-6 py-4 text-sm text-slate-600">标记需要重读的音节</td>
                  </tr>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-2xl text-slate-400 font-black">·</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-700">非重音</td>
                    <td className="px-6 py-4 text-sm text-slate-600">标记轻读的音节</td>
                  </tr>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-2xl text-orange-500 font-black">↗</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-700">升调</td>
                    <td className="px-6 py-4 text-sm text-slate-600">一般疑问句结尾，声调上扬</td>
                  </tr>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-2xl text-sky-500 font-black">↘</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-700">降调</td>
                    <td className="px-6 py-4 text-sm text-slate-600">陈述句和特殊疑问句结尾，声调下降</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-8 py-4 rounded-b-3xl">
          <button
            onClick={onClose}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            我明白了 (Got it!)
          </button>
        </div>
      </div>
    </div>
  );
};
