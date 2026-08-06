# Word Lookup Popover — Design Spec

> Date: 2026-07-14
> Status: Approved by user
> Feature: 点击句子中的单词时，弹出卡片显示该词的 IPA 音标和结合语境的中文释义

## Goal

学习者在练习句中遇到不认识的单词时，点击即可同时：
1. 听到该词发音（保留现有行为）
2. 看到 IPA 音标 + 中文释义（新增，释义结合句子语境）

## Decisions (confirmed with user)

| 决策点 | 选择 |
|--------|------|
| 交互方式 | 点击 = 播放发音 + 弹出卡片（单击一次获得全部信息） |
| 数据源 | MiniMax AI 生成（prompt 带整句话，释义贴合语境），带缓存 |
| 生效范围 | 仅句子展示区（SentenceAnnotation），不改 WordDetailModal |

## Interaction

```
点击单词 "going"
  ├─ ♪ 播放 tutor audio（现有 onWordClick → onPlayTutor 不变）
  └─ 弹出卡片（浮于单词上方，空间不足时在下方）：
       word（Fraunces 衬线）+ /IPA/（IBM Plex Mono）
       中文释义（结合语境）
       [▶ 再听一遍] 按钮
关闭：点击卡片外部 / Esc / 点击其他单词（切换到新词）
加载中：卡片先弹出，显示"查询中…"占位
```

## Architecture

### 1. `services/minimaxService.ts` — 新增 `getWordDefinition(word, sentence)`

- 调 MiniMax chat API（复用现有多 base-URL fallback 与重试逻辑）
- Prompt 要求返回严格 JSON：`{ "ipa": "/ˈgoʊɪŋ/", "meaning": "（进展）进行得……" }`
- 解析时沿用现有 markdown code block 剥离逻辑
- 模块级缓存：`definitionCache: Map<string, WordDefinition>`，key 为 `${word.toLowerCase()}::${sentence}`
- 错误沿用现有错误码约定（`RATE_LIMIT`、`INSUFFICIENT_BALANCE` 等）

### 2. `components/WordPopover.tsx` — 新组件

- Props: `{ word, definition | null (loading), anchorRect, onReplay, onClose }`
- Ink & Paper 风格：`--surface` 底 + 1px 墨色描边 + 2px 圆角，无阴影
- 定位：绝对定位于被点单词上方居中；视口边缘检测防溢出（移动端不超屏）
- 可访问性：`role="dialog"`，Esc 关闭，点击外部关闭（useEffect + document listener）

### 3. `components/SentenceAnnotation.tsx` — 集成

- 点击单词时（现有 onClick handler 内）：照常调用 `onWordClick(word)`，同时记录 `{ word, anchorRect }` 到内部 state 并触发释义请求
- Popover 状态完全内部管理，**不改变组件对外 props 接口**（调用方 App.tsx / FeedbackCard.tsx 无需改动）

## Error Handling

- 释义请求失败 → 卡片显示"释义加载失败"，发音播放不受影响（graceful degradation）
- 请求竞态：快速点击多个词时，仅显示最后点击词的结果（对比 state 中当前词）

## Testing

- `WordPopover` 基础渲染测试（loading 态 / 有数据态 / 失败态），沿用项目现有 vitest 模式

## Out of Scope

- WordDetailModal 中不加中文释义（用户明确只要句子区）
- 词性、例句、词形变化等扩展信息（YAGNI，后续可迭代）
- 释义的 localStorage 持久化（先用会话内存缓存）
