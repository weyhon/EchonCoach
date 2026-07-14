# Word Lookup Popover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 点击句子中的单词时，在播放发音的同时弹出小卡片，显示该词的 IPA 音标和结合语境的中文释义。

**Architecture:** 新增 `getWordDefinition()` 服务函数（MiniMax chat API + 模块级缓存），新建 `WordPopover` 展示组件（Ink & Paper 风格），在 `SentenceAnnotation` 内部集成点击弹卡逻辑（不改变组件对外 props 接口）。

**Tech Stack:** React 19 + TypeScript 5.7 + Vite 6 + vitest (jsdom + @testing-library/react) + MiniMax chat API

**Spec:** `docs/superpowers/specs/2026-07-14-word-lookup-popover-design.md`

## Global Constraints

- 设计规范遵守 `design-rules.md`（Ink & Paper）：`--surface` 底 + 1px 墨色描边 + 2px 圆角、**无阴影**；内容用 Fraunces（class `font-display`），UI 杂项用 IBM Plex Mono（class `font-mono`）+ uppercase + letter-spacing ≥ 0.1em
- 唯一强调色 `var(--rose)`（焦橙 #c2410c）
- 不修改 `services/*` 的既有函数、`types.ts` 的既有类型、App.tsx 的音频/录音逻辑
- 点击播放发音的现有行为（`onWordClick` → tutor audio）必须保留
- 每个任务小步提交；测试命令 `npx vitest run <file>`；全量检查 `npm run check`

---

### Task 1: 服务层 — `getWordDefinition` + JSON 解析器 + 缓存

**Files:**
- Modify: `types.ts`（追加 `WordDefinition` 接口，不改既有类型）
- Modify: `services/minimaxService.ts`（文件末尾追加两个 export）
- Test: `services/parseWordDefinition.test.ts`（新建）

**Interfaces:**
- Consumes: `postWithFallback(endpoint, body)`（minimaxService.ts:88 已有的私有函数，多域名 fallback + 错误码）
- Produces:
  - `interface WordDefinition { ipa: string; meaning: string }`（types.ts）
  - `parseWordDefinition(content: string): WordDefinition | null`（纯函数，导出仅为测试）
  - `getWordDefinition(word: string, sentence: string): Promise<WordDefinition>`（失败时 throw，错误码沿用 postWithFallback 的约定）

- [ ] **Step 1: 写失败测试**

创建 `services/parseWordDefinition.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { parseWordDefinition } from './minimaxService';

describe('parseWordDefinition', () => {
  it('parses plain JSON content', () => {
    const r = parseWordDefinition('{"ipa":"/ˈgoʊɪŋ/","meaning":"（进展）进行"}');
    expect(r).toEqual({ ipa: '/ˈgoʊɪŋ/', meaning: '（进展）进行' });
  });

  it('strips markdown code fences before parsing', () => {
    const r = parseWordDefinition('```json\n{"ipa":"/ɪt/","meaning":"它"}\n```');
    expect(r).toEqual({ ipa: '/ɪt/', meaning: '它' });
  });

  it('wraps bare ipa in slashes', () => {
    const r = parseWordDefinition('{"ipa":"ˈgoʊɪŋ","meaning":"进行"}');
    expect(r?.ipa).toBe('/ˈgoʊɪŋ/');
  });

  it('returns null when content is not JSON', () => {
    expect(parseWordDefinition('sorry, I cannot help')).toBeNull();
  });

  it('returns null when meaning is missing', () => {
    expect(parseWordDefinition('{"ipa":"/ɪt/"}')).toBeNull();
  });

  it('tolerates missing ipa (meaning-only result)', () => {
    expect(parseWordDefinition('{"meaning":"它"}')).toEqual({ ipa: '', meaning: '它' });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run services/parseWordDefinition.test.ts`
Expected: FAIL — `parseWordDefinition` is not exported

- [ ] **Step 3: 实现**

`types.ts` 末尾追加：

```ts
export interface WordDefinition {
  ipa: string;     // e.g. "/ˈgoʊɪŋ/"，可能为空串
  meaning: string; // 结合语境的简体中文释义
}
```

`services/minimaxService.ts`：顶部 import 行改为 `import { AnalysisResult, WordDefinition } from "../types";`，文件末尾追加：

```ts
// ============ 点词查义（Word Lookup） ============

// 纯解析函数，导出仅为单元测试
export const parseWordDefinition = (content: string): WordDefinition | null => {
  try {
    const jsonStr = content.replace(/```json|```/g, '').trim();
    const obj = JSON.parse(jsonStr);
    const rawIpa = typeof obj.ipa === 'string' ? obj.ipa.trim() : '';
    const meaning = typeof obj.meaning === 'string' ? obj.meaning.trim() : '';
    if (!meaning) return null;
    const ipa = rawIpa && !rawIpa.startsWith('/') ? `/${rawIpa}/` : rawIpa;
    return { ipa, meaning };
  } catch {
    return null;
  }
};

// 会话内缓存：同一 (词, 句子) 只请求一次
const definitionCache = new Map<string, WordDefinition>();

export const getWordDefinition = async (
  word: string,
  sentence: string
): Promise<WordDefinition> => {
  const cacheKey = `${word.toLowerCase()}::${sentence}`;
  const cached = definitionCache.get(cacheKey);
  if (cached) return cached;

  const systemPrompt = `You are an English-Chinese dictionary inside a pronunciation learning app.
Given a word and the sentence it appears in, return:
- "ipa": American English IPA for the word, wrapped in slashes
- "meaning": concise Simplified Chinese meaning (≤ 20 characters) that fits THIS sentence's context

Example: word "going" in "How is it going?" → {"ipa":"/ˈgoʊɪŋ/","meaning":"（近况）进展"}

Return ONLY valid JSON with exactly these 2 fields. No markdown, no explanation.`;

  const data = await postWithFallback("/text/chatcompletion_v2", {
    model: "abab6.5s-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Word: "${word}"\nSentence: "${sentence}"` },
    ],
    temperature: 0.2,
    max_tokens: 120,
  });
  const content = data.choices?.[0]?.message?.content || "";
  const parsed = parseWordDefinition(content);
  if (!parsed) {
    const err: any = new Error("释义解析失败");
    err.code = "PARSE_ERROR";
    throw err;
  }
  definitionCache.set(cacheKey, parsed);
  return parsed;
};
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run services/parseWordDefinition.test.ts`
Expected: PASS（6 个测试）

- [ ] **Step 5: 提交**

```bash
git add types.ts services/minimaxService.ts services/parseWordDefinition.test.ts
git commit -m "feat: getWordDefinition service with context-aware Chinese meaning"
```

---

### Task 2: `WordPopover` 展示组件

**Files:**
- Create: `components/WordPopover.tsx`
- Test: `components/WordPopover.test.tsx`（新建）

**Interfaces:**
- Consumes: `WordDefinition`（types.ts，Task 1 定义）
- Produces:

```ts
interface WordPopoverProps {
  word: string;                        // 干净词形（无标点）
  definition: WordDefinition | null;   // null = 加载中
  error: boolean;                      // true = 查询失败
  left: number;                        // 容器内绝对定位 x（卡片水平中心）
  top: number;                         // 容器内绝对定位 y（锚点）
  placement: 'above' | 'below';        // above: 卡片在锚点上方; below: 下方
  onReplay: () => void;                // 再听一遍
  onClose: () => void;                 // Esc 触发
}
export const WordPopover: React.FC<WordPopoverProps>
```

- 组件带 `data-word-popover` 属性（父组件用它做"点外部关闭"的命中判断）

- [ ] **Step 1: 写失败测试**

创建 `components/WordPopover.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WordPopover } from './WordPopover';

const base = {
  word: 'going',
  left: 100,
  top: 50,
  placement: 'above' as const,
  onReplay: vi.fn(),
  onClose: vi.fn(),
};

describe('WordPopover', () => {
  it('shows loading placeholder while definition is null', () => {
    render(<WordPopover {...base} definition={null} error={false} />);
    expect(screen.getByText('LOOKING UP…')).toBeTruthy();
  });

  it('shows word, ipa and meaning when loaded', () => {
    render(
      <WordPopover
        {...base}
        definition={{ ipa: '/ˈgoʊɪŋ/', meaning: '（近况）进展' }}
        error={false}
      />
    );
    expect(screen.getByText('going')).toBeTruthy();
    expect(screen.getByText('/ˈgoʊɪŋ/')).toBeTruthy();
    expect(screen.getByText('（近况）进展')).toBeTruthy();
  });

  it('shows failure label on error', () => {
    render(<WordPopover {...base} definition={null} error={true} />);
    expect(screen.getByText('LOOKUP FAILED')).toBeTruthy();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<WordPopover {...base} definition={null} error={false} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onReplay when replay button is clicked', () => {
    const onReplay = vi.fn();
    render(
      <WordPopover
        {...base}
        definition={{ ipa: '/ˈgoʊɪŋ/', meaning: '进展' }}
        error={false}
        onReplay={onReplay}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /replay/i }));
    expect(onReplay).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run components/WordPopover.test.tsx`
Expected: FAIL — Cannot find module './WordPopover'

- [ ] **Step 3: 实现组件**

创建 `components/WordPopover.tsx`：

```tsx
import React, { useEffect } from 'react';
import { WordDefinition } from '../types';

interface WordPopoverProps {
  word: string;
  definition: WordDefinition | null;
  error: boolean;
  left: number;
  top: number;
  placement: 'above' | 'below';
  onReplay: () => void;
  onClose: () => void;
}

// Ink & Paper：surface 底 + 1px 墨色描边 + 2px 圆角，无阴影（design-rules.md 细线规则）
export const WordPopover: React.FC<WordPopoverProps> = ({
  word, definition, error, left, top, placement, onReplay, onClose,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const monoLabel: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.12em',
    color: 'var(--text-muted)',
  };

  return (
    <div
      role="dialog"
      aria-label={`Definition of ${word}`}
      data-word-popover
      className="absolute z-20"
      style={{
        left,
        top,
        transform: placement === 'above' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
        width: 220,
        background: 'var(--surface)',
        border: '1px solid var(--text-primary)',
        borderRadius: 2,
        padding: '10px 12px',
        textAlign: 'left',
      }}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-display" style={{ fontSize: 18, color: 'var(--text-primary)' }}>
          {word}
        </span>
        {definition?.ipa && (
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {definition.ipa}
          </span>
        )}
      </div>
      <div style={{ marginTop: 6, minHeight: 18 }}>
        {error ? (
          <span className="font-mono" style={monoLabel}>LOOKUP FAILED</span>
        ) : definition ? (
          <span className="font-display" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {definition.meaning}
          </span>
        ) : (
          <span className="font-mono" style={monoLabel}>LOOKING UP…</span>
        )}
      </div>
      <button
        type="button"
        aria-label={`Replay "${word}"`}
        onClick={onReplay}
        className="font-mono cursor-pointer hover:opacity-70 active:scale-95 transition-all duration-200"
        style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          color: 'var(--rose)',
          background: 'none',
          border: 'none',
          padding: '12px 0 2px',
          minHeight: 32,
        }}
      >
        ▶ REPLAY
      </button>
    </div>
  );
};
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run components/WordPopover.test.tsx`
Expected: PASS（5 个测试）

- [ ] **Step 5: 提交**

```bash
git add components/WordPopover.tsx components/WordPopover.test.tsx
git commit -m "feat: WordPopover card — IPA + Chinese meaning, Ink & Paper style"
```

---

### Task 3: 集成到 `SentenceAnnotation` + 端到端验证

**Files:**
- Modify: `components/SentenceAnnotation.tsx`（约 124-145 行的组件体 + 331-337 行的点击处理 + 362 行前的渲染）

**Interfaces:**
- Consumes:
  - `getWordDefinition(word, sentence)`（Task 1）
  - `WordPopover`（Task 2）
  - 既有 `containerRef`（SentenceAnnotation.tsx:133，容器 div 已是 `relative` 定位）
- Produces: 无新对外接口 — **组件 props 不变**，调用方（App.tsx / FeedbackCard.tsx）零改动

- [ ] **Step 1: 添加 imports 和内部状态**

`components/SentenceAnnotation.tsx` 顶部追加 import：

```tsx
import { WordPopover } from './WordPopover';
import { getWordDefinition } from '../services/minimaxService';
import { WordDefinition } from '../types';
```

组件体内（`const [svgSize, setSvgSize] = ...` 之后）追加状态：

```tsx
// === 点词查义 popover ===
const [popover, setPopover] = useState<{
  word: string; left: number; top: number; placement: 'above' | 'below';
} | null>(null);
const [definition, setDefinition] = useState<WordDefinition | null>(null);
const [defError, setDefError] = useState(false);
// 竞态守卫：快速连点多个词时，只显示最后点击词的结果
const lookupRef = useRef<string>('');

const openPopover = (cleanWord: string, el: HTMLElement) => {
  if (!containerRef.current) return;
  const cr = containerRef.current.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const half = 110; // 卡片宽 220 的一半，用于视口内钳位
  const left = Math.min(
    Math.max(r.left - cr.left + r.width / 2, half),
    Math.max(cr.width - half, half)
  );
  // 上方空间不足 110px 时放到单词下方
  const placement: 'above' | 'below' = r.top - cr.top < 110 ? 'below' : 'above';
  const top = placement === 'above' ? r.top - cr.top - 8 : r.bottom - cr.top + 8;

  setPopover({ word: cleanWord, left, top, placement });
  setDefinition(null);
  setDefError(false);
  lookupRef.current = cleanWord;
  getWordDefinition(cleanWord, text)
    .then((def) => {
      if (lookupRef.current === cleanWord) setDefinition(def);
    })
    .catch(() => {
      if (lookupRef.current === cleanWord) setDefError(true);
    });
};

// 点击卡片外部任意处关闭
useEffect(() => {
  if (!popover) return;
  const onDown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-word-popover]')) return;
    setPopover(null);
  };
  document.addEventListener('mousedown', onDown);
  return () => document.removeEventListener('mousedown', onDown);
}, [popover]);
```

- [ ] **Step 2: 改造单词点击处理**

把现有的 onClick / onKeyDown（SentenceAnnotation.tsx:331-337）改为同时弹卡：

```tsx
onClick={onWordClick ? (e) => {
  const clean = w.word.replace(/[?.!,;:'"()[\]{}]/g, '');
  onWordClick(clean);                                   // 现有行为：播放发音
  openPopover(clean, e.currentTarget as HTMLElement);   // 新增：弹出释义卡片
} : undefined}
onKeyDown={onWordClick ? (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    const clean = w.word.replace(/[?.!,;:'"()[\]{}]/g, '');
    onWordClick(clean);
    openPopover(clean, e.currentTarget as HTMLElement);
  }
} : undefined}
```

同时把该 span 的 `title` 文案从 `'Click to hear pronunciation'` 改为 `'Click to hear & see meaning'`。

- [ ] **Step 3: 渲染 popover**

在容器 div 收尾前（`</div>` 之前、words map 的兄弟位置，SentenceAnnotation.tsx:362 附近）追加：

```tsx
{popover && (
  <WordPopover
    word={popover.word}
    definition={definition}
    error={defError}
    left={popover.left}
    top={popover.top}
    placement={popover.placement}
    onReplay={() => onWordClick?.(popover.word)}
    onClose={() => setPopover(null)}
  />
)}
```

- [ ] **Step 4: 全量检查**

Run: `npm run check`
Expected: tsc 无错误 + 全部 vitest 通过（含既有测试）+ vite build 成功

- [ ] **Step 5: 浏览器手动验证**

```bash
# dev server 若未运行：npm run dev（后台）
open "http://localhost:5173/?demo=results"
```

验证清单：
1. 点击句子标注区的 "going" → 听到发音 + 卡片弹出，先显示 LOOKING UP… 再变为音标 + 中文
2. 再次点击 "going" → 秒开（缓存生效）
3. 点击另一个词 → 旧卡关闭、新卡打开
4. Esc / 点击空白处 → 卡片关闭
5. 点 "▶ REPLAY" → 重播发音
6. 首个单词（靠左）和末尾单词（靠右）→ 卡片不超出容器边缘
7. 无录音的初始页（`http://localhost:5173/`，需先输入句子）→ 同样可用
8. 断网或 API key 置空 → 卡片显示 LOOKUP FAILED，发音播放不受影响（用 DevTools Network 面板 Offline 模拟）

- [ ] **Step 6: 提交**

```bash
git add components/SentenceAnnotation.tsx
git commit -m "feat: click word to see IPA + Chinese meaning popover"
```

---

## Self-Review Notes

- Spec 覆盖：交互（播放+弹卡 ✓ Task 3）、数据源（AI+缓存 ✓ Task 1）、范围（仅 SentenceAnnotation ✓）、错误处理（LOOKUP FAILED + 竞态守卫 ✓）、测试（parser 6 例 + popover 5 例 ✓）
- 类型一致性：`WordDefinition` 在 types.ts 定义，Task 1/2/3 的引用签名一致；`placement: 'above' | 'below'` 贯穿 Task 2/3
- 无占位符；每步含完整代码与预期输出
