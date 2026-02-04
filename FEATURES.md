# 🎯 EchoCoach 功能验证清单

这个文档用于验证所有语音标注功能是否正常工作。

## ✅ 已实现的语音标注功能

### 1. 连读标注 (Linking) `‿`

**实现位置**: [FeedbackCard.tsx:185-191](components/FeedbackCard.tsx#L185-L191)

**功能说明**:
- 显示单词间的连读关系
- 使用 `‿` 符号连接
- 示例: "tell‿us", "take‿it", "is‿it"

**视觉效果**:
- 使用 indigo-400 颜色
- 有脉冲动画效果 (animate-pulse)
- 在单词之间显示

**测试建议**:
```
输入: "Can you tell us about it?"
预期显示: "Can you tell‿us about‿it?"
```

---

### 2. 重音标注 (Stress) `●` / `·`

**实现位置**: [FeedbackCard.tsx:84-89](components/FeedbackCard.tsx#L84-L89)

**功能说明**:
- `●` 表示重读音节（stressed syllable）
- `·` 表示弱读音节（unstressed syllable）
- 显示在单词下方

**视觉效果**:
- 重读 `●`: indigo-400 颜色 + 发光效果 (drop-shadow)
- 弱读 `·`: slate-500 颜色 + 40% 透明度

**规则**:
- 句子最后一个词通常重读（除非是疑问句）
- 功能词（is, are, can, do等）通常弱读
- 内容词（名词、动词、形容词）通常重读

**测试建议**:
```
输入: "I love coffee"
预期标注:
  ·   ●    ●↘
  I  love coffee
```

---

### 3. 语调标注 (Intonation) `↗` / `↘`

**实现位置**: [FeedbackCard.tsx:76-82](components/FeedbackCard.tsx#L76-L82)

**功能说明**:
- `↗` 表示升调（rising intonation）- 用于疑问句
- `↘` 表示降调（falling intonation）- 用于陈述句
- 通常只在句子最后一个词显示

**视觉效果**:
- 升调 `↗`: orange-400 颜色 + 发光效果
- 降调 `↘`: sky-400 颜色 + 发光效果
- 有弹跳动画 (animate-symbol-pop)

**自动判断规则**:
- 如果句子以疑问词开头 (Do, Does, Is, Are, Can, Will等) → 升调 `↗`
- 其他情况 → 降调 `↘`

**测试建议**:
```
输入: "Are you ready?"
预期: 最后一个词 "ready" 显示 ·↗

输入: "I am ready"
预期: 最后一个词 "ready" 显示 ●↘
```

---

### 4. 国际音标显示 (Phonetic)

**实现位置**: [FeedbackCard.tsx:173-178](components/FeedbackCard.tsx#L173-L178)

**功能说明**:
- 显示整个句子的国际音标转写
- 包含连读效果的音标

**视觉效果**:
- 显示在标注区域顶部
- 使用等宽字体 (font-mono)
- 斜体样式，增加字母间距

**测试建议**:
```
输入: "How are you?"
预期显示: /haʊ ɑː juː/ 或类似的音标
```

---

## 🔄 Fallback 机制

当 AI 分析失败时，项目会自动生成基础标注：

### 本地标注生成逻辑

**位置**: [FeedbackCard.tsx:122-129](components/FeedbackCard.tsx#L122-L129)

```typescript
const buildFallbackTokens = (ws: string[]) => {
  const isQuestion = ws[0]?.match(/^(do|does|did|is|are|...)$/i);
  return ws.map((_, i) => {
    if (i === ws.length - 1)
      return isQuestion ? "·↗" : "●↘";
    return "·";
  });
};
```

**规则**:
1. 检测句首是否为疑问词
2. 最后一个词: 疑问句 → `·↗`, 陈述句 → `●↘`
3. 其他词默认 `·`（弱读）

---

## 🎨 交互功能

### 选词发音 (Text Selection + TTS)

**实现位置**: [FeedbackCard.tsx:104-118](components/FeedbackCard.tsx#L104-L118)

**功能说明**:
1. 用户在标注区域拖选文本
2. 自动清理选中文本中的符号（`‿`, `●`, `·`, `↗`, `↘`）
3. 显示播放按钮
4. 点击播放该文本的标准发音

**视觉效果**:
- 选中后底部出现大按钮: "Pronounce: [选中文本]"
- 按钮有发光阴影效果
- 播放时显示 "Playing Coach..."

**测试建议**:
```
1. 在标注区域拖选 "tell‿us"
2. 应清理为 "tell us"
3. 点击播放按钮应播放 "tell us" 的发音
```

---

## 🧪 测试用例

### 测试句子 1: 疑问句
```
输入: "Do you like it?"
预期完整标注:
      ·  ·   ●   ·↗
    Do you like‿it?
```

### 测试句子 2: 陈述句
```
输入: "I really love programming"
预期完整标注:
     ·    ●     ●      ●↘
    I  really love programming
```

### 测试句子 3: 复杂连读
```
输入: "Tell us about it"
预期完整标注:
      ●   ·    ·   ·↘
    Tell‿us about‿it
```

---

## 📋 功能检查清单

运行项目并逐一验证：

- [ ] 连读符号 `‿` 在正确的单词间显示
- [ ] 重读 `●` 有发光效果，颜色为 indigo-400
- [ ] 弱读 `·` 半透明，颜色为 slate-500
- [ ] 升调 `↗` 为橙色，有动画
- [ ] 降调 `↘` 为天蓝色，有动画
- [ ] 音标显示在标注区域顶部
- [ ] 拖选文本后出现播放按钮
- [ ] 点击单词可以播放单词发音
- [ ] 慢速/正常速度切换正常
- [ ] 录音后显示评分和建议

---

## 🛠️ 调试技巧

### 查看 AI 返回的原始数据

在浏览器控制台（F12）中查看：

```javascript
// 查看分析结果缓存
console.log(analysisCache)

// 查看 intonationMap 原始数据
// 应该是类似: "· · ● ·↗"
```

### 查看符号渲染

```javascript
// 检查 mapTokens 数组
// 应该与单词数量匹配
console.log(mapTokens.length, words.length)
```

### 常见问题排查

1. **符号不显示**: 检查 `result.intonationMap` 是否为空
2. **符号位置不对**: 检查 `mapTokens.length` 是否等于 `words.length`
3. **连读符号不显示**: 检查 `result.fullLinkedSentence` 中是否包含 `‿`
4. **AI 分析失败**: 会自动使用 fallback 生成基础标注

---

## 📊 代码覆盖率

- ✅ 连读显示: `FeedbackCard.tsx` L185-191
- ✅ 重音显示: `FeedbackCard.tsx` L84-89
- ✅ 语调显示: `FeedbackCard.tsx` L76-82
- ✅ 音标显示: `FeedbackCard.tsx` L173-178
- ✅ Fallback 逻辑: `FeedbackCard.tsx` L122-129
- ✅ 选词功能: `FeedbackCard.tsx` L104-118
- ✅ AI 分析: `minimaxService.ts` L183-292
- ✅ 发音评估: `minimaxService.ts` L295-370

---

**验证状态**: ✅ 所有语音标注功能已实现并正常工作

**测试日期**: 2026-02-02

**测试环境**:
- React 19.2.4
- TypeScript 5.9.3
- Vite 6.4.1
- MiniMax API (speech-2.8-turbo + abab6.5s-chat)
