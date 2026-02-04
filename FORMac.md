# EchoCoach: 项目复盘与学习笔记

## 这是什么？

EchoCoach 是一个 AI 驱动的英语发音练习工具。简单来说，它就像一个随叫随到的**私人发音教练**——你输入一句英语，它会：

1. **用标准美音朗读**（两种速度：正常 & 慢速）
2. **展示连读和语调标注**（用特殊的符号系统）
3. **录下你的发音**并给出 AI 评分和改进建议
4. **保存练习历史**，方便复习

## 技术架构全景

### 核心栈
```
React 19 + TypeScript + Vite + Tailwind CSS + MiniMax API
```

**为什么选择这个组合？**

- **React 19**: 最新的 React 版本，支持更好的并发特性和自动批处理
- **TypeScript**: 大型项目必备，类型安全让你在重构时更有底气
- **Vite**: 比 Webpack 快 10 倍的开发服务器，即时热更新
- **Tailwind CSS**: 原子化 CSS，不写一行 CSS 文件就能做出精美界面
- **MiniMax API**: 国内可用的 AI 服务，支持高质量 TTS（语音合成）、Chat Completion（智能分析）和发音评估

### 代码结构
```
├── index.html              # 入口 HTML，加载 Tailwind CDN
├── index.tsx               # React 应用挂载点
├── App.tsx                 # 主应用组件（状态管理中心）
├── types.ts                # 类型定义（TypeScript 的"合同"）
├── components/             # UI 组件
│   ├── Button.tsx          # 通用按钮（带加载/播放状态）
│   ├── FeedbackCard.tsx    # 发音分析结果卡片（最复杂的 UI）
│   ├── HistoryList.tsx     # 练习历史列表
│   └── ErrorBoundary.tsx   # 错误边界（防止应用崩溃）
└── services/               # 业务逻辑层
    ├── minimaxService.ts   # MiniMax AI 服务（TTS + 发音分析）
    └── audioUtils.ts       # 音频处理工具（Base64 解码与播放）
```

## 关键设计决策

### 1. 缓存策略：为什么重复请求不花钱

我们在 App.tsx 中维护了两个 `Map` 作为缓存：

```typescript
const ttsCache = new Map<string, string>();        // 缓存语音
const analysisCache = new Map<string, AnalysisResult>(); // 缓存分析结果
```

**为什么这样做？**

MiniMax 的 API 是按调用计费的。如果用户反复练习同一个句子，没必要每次都请求 API。缓存让第二次点击「Analyze & Listen」**瞬间响应**，还**省了 API 费用**。

**一个有趣的 bug**：

一开始我把缓存 key 设计得太简单，后来发现同一个句子的大小写不同应该被视为同一个缓存项。于是加了 `.trim().toLowerCase()` 处理。

### 2. 音频架构：MiniMax 的音频处理

MiniMax TTS API 返回 hex 编码的 MP3 音频数据。播放流程：

```
hex → base64 → Audio element → 播放
```

这个过程在 `audioUtils.ts` 的 `playBase64Audio` 函数中，使用 HTML5 Audio API 直接播放。

**关键实现**：

- **Hex 到 Base64 转换**：MiniMax 默认返回 hex 编码，需要先转换为 base64
- **多域名重试**：支持多个 MiniMax API 域名自动切换，避免单点故障
- **错误处理**：识别 API 错误码（RATE_LIMIT、INSUFFICIENT_BALANCE、INVALID_KEY）并给出友好提示

### 3. Error Boundary：应用的"安全气囊"

在 `index.tsx` 中，我们用 ErrorBoundary 包裹了 App：

```tsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

**这是什么？**

想象你开车时突然爆胎——ErrorBoundary 就是汽车的安全气囊。当 React 组件抛出错误时，它会捕获错误并显示一个友好的错误页面，而不是让整个应用白屏崩溃。

**实现细节**：

ErrorBoundary 是一个类组件（因为 React 的 error boundary 只能用类组件实现），它实现了两个特殊方法：
- `static getDerivedStateFromError`: 错误发生时更新 state
- `componentDidCatch`: 记录错误日志

### 4. 状态管理：为什么不用 Redux

这个项目的状态全部用 React 的 `useState` 管理，没有引入 Redux 或 Zustand。

**为什么？**

项目规模不大，状态主要是：
- 输入文本
- 当前应用状态（idle/recording/analyzing/showing_result）
- 分析结果
- 音频播放状态

用 `useState` 足够了。Redux 会增加复杂度，而且需要写大量的 boilerplate 代码。

**一个技巧**：我们用函数式更新来处理依赖前值的 state 更新，比如历史记录：

```typescript
setHistory(prev => {
  const filtered = prev.filter(h => h.text !== newText);
  return [newItem, ...filtered].slice(0, 50); // 只保留最近 50 条
});
```

### 5. 连读和语调的可视化设计

这是产品最有特色的地方。我们用一套符号系统来展示发音技巧：

- `‿` 表示连读（Linking），如 "tell‿us"
- `●` 表示重读（Stressed）
- `·` 表示弱读（Unstressed）
- `↗` 表示语调上扬（Rising intonation，用于疑问句）
- `↘` 表示语调下降（Falling intonation，用于陈述句）

**技术实现**：

符号渲染在 `FeedbackCard.tsx` 的 `SymbolSpan` 组件中。每个符号都有特殊的样式：
- 重读符号有发光效果（`drop-shadow`）
- 语调符号有弹跳动画（`animate-symbol-pop`）

AI 返回的数据格式是 JSON：
```json
{
  "fullLinkedSentence": "Do you like‿it?",
  "intonationMap": "· · ● ·↗",
  "fullLinkedPhonetic": "du ju laɪ kɪt"
}
```

我们把 `intonationMap` 按空格分割，每个 token 对应一个单词下方的符号。

## 遇到的 Bug 和解决方法

### Bug 1: API 密钥验证失败 ❌

**现象**：明明配置了正确的 API key，但还是报 "invalid api key" 错误

**原因**：MiniMax API 有多个不同的域名（api.minimax.chat、api.minimax.io、api.minimaxi.com），不同的密钥可能只在特定域名下有效

**解决**：实现多域名自动重试机制：

```typescript
const BASE_URL_CANDIDATES = [
  import.meta.env.VITE_MINIMAX_BASE_URL,
  "https://api.minimax.chat/v1",
  "https://api.minimax.io/v1",
  "https://api.minimaxi.com/v1",
].filter(Boolean);
```

当一个域名返回 "invalid api key" 时，自动尝试下一个域名。

**教训**：云服务的 API 域名可能有多个，要做好容错处理。

### Bug 2: JSON 解析失败导致标注不显示 ❌

**现象**：AI 返回了正确的分析结果，但界面上连读、重音标注没有显示

**原因**：LLM 返回的 JSON 可能被 markdown 代码块包裹（\`\`\`json ... \`\`\`），直接 parse 会失败

**解决**：在解析前先清理 markdown 标记：

```typescript
const jsonStr = content.replace(/```json|```/g, '').trim();
const result = JSON.parse(jsonStr);
```

**教训**：LLM 的输出格式不总是严格的 JSON，需要容错处理。

### Bug 3: 环境变量读取失败 ❌

**现象**：部署后 API 调用报错，说找不到 API key

**原因**：Vite 项目的环境变量必须以 `VITE_` 开头才能在客户端代码中访问

**解决**：使用正确的环境变量命名：

```typescript
const MINIMAX_API_KEY = import.meta.env.VITE_MINIMAX_API_KEY;
const MINIMAX_GROUP_ID = import.meta.env.VITE_MINIMAX_GROUP_ID;
```

并提供友好的错误提示：

```typescript
if (!key) {
  throw new Error(
    "❌ 缺少 MiniMax API 密钥。请在 .env 文件中添加 VITE_MINIMAX_API_KEY。\n" +
    "获取密钥：https://www.minimaxi.com/"
  );
}
```

**教训**：不同构建工具的环境变量语法不同。Vite 明确区分了客户端和服务端环境变量（客户端必须用 `VITE_` 前缀）。

### Bug 4: 历史记录重复条目

**现象**：同一个句子练习多次，历史列表里出现多个条目

**解决**：在保存前先做去重，保留最新的：

```typescript
const filtered = prev.filter(h =>
  h.text.trim().toLowerCase() !== newText.trim().toLowerCase()
);
```

注意这里做了大小写不敏感比较，这样 "Hello" 和 "hello" 被视为同一个句子。

## 性能优化技巧

### 1. useMemo 优化历史记录搜索

```typescript
const filteredHistory = useMemo(() => {
  if (!searchTerm.trim()) return history;
  return history.filter(item =>
    item.text.toLowerCase().includes(searchTerm.toLowerCase())
  );
}, [history, searchTerm]);
```

每次渲染时搜索历史记录会很慢（如果历史很长）。`useMemo` 让搜索只在 `history` 或 `searchTerm` 变化时执行。

### 2. 防抖节流

虽然项目中没有显式使用防抖（debounce），但输入框的 `onChange` 直接更新 state，而分析操作需要点击按钮触发。这就是一种隐式的节流——不会每次按键都请求 API。

### 3. 音频预加载

用户点击 "Analyze & Listen" 时，我们同时请求 TTS 和分析。TTS 完成后立即播放，不需要等待分析完成（分析是用户录音后才需要的）。

```typescript
const [base64, linking] = await Promise.all([
  generateSpeech(textToSpeak, false),      // TTS
  getLinkingAnalysisForText(textToSpeak)   // 连读分析
]);
```

## 安全考虑

### API 密钥保护

MiniMax 的 API 密钥是前端直接调用的，这意味着：

⚠️ **密钥会暴露在浏览器中**

**缓解措施**：
1. 在 MiniMax 控制台中设置 IP 白名单或域名限制
2. 监控 API 用量，发现异常立即轮换密钥
3. （最佳实践）应该通过后端代理请求，前端只调用自己的后端
4. 不要在公开的代码仓库中提交 .env 文件

**为什么没有做后端？**

这是一个纯前端的学习项目，目标是快速验证产品想法。如果用户量增大，应该增加后端层。

### XSS 防护

项目中没有使用 `dangerouslySetInnerHTML`，所有内容都是 React 组件渲染的，天然防范 XSS。

## 可改进的方向

1. **PWA 支持**：添加 Service Worker，支持离线查看历史记录
2. **语音活动检测（VAD）**：录音时自动检测用户何时说完，自动停止录音
3. **发音对比波形图**：把用户发音和标准发音的波形叠在一起对比
4. **多语言支持**：目前只支持美式英语，可以扩展到英式英语、其他语言
5. **后端服务**：把 API 密钥移到后端，添加用户认证

## 关键代码片段解析

### 录音处理流程

```typescript
const startRecording = async () => {
  // 1. 获取麦克风权限
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // 2. 创建 MediaRecorder
  const mediaRecorder = new MediaRecorder(stream);

  // 3. 收集音频数据（每次有数据时推入数组）
  mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);

  // 4. 录音停止时处理
  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

    // 5. 转换为 base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];

      // 6. 发送到 AI 分析
      const res = await analyzePronunciation(text, base64);
    };
    reader.readAsDataURL(audioBlob);
  };

  // 开始录音
  mediaRecorder.start();
};
```

这个过程涉及了 WebRTC、FileReader、Blob 等多个 Web API，是前端处理音频的标准流程。

### React 18+ 的并发特性

```typescript
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
```

`createRoot` 是 React 18 的新 API，支持并发渲染。这意味着 React 可以在渲染过程中暂停、恢复，优先响应用户交互。

## 总结

EchoCoach 是一个典型的现代前端应用：

- **框架层**：React + TypeScript
- **构建层**：Vite
- **样式层**：Tailwind CSS
- **AI 层**：Google GenAI SDK
- **存储层**：localStorage（客户端持久化）

整个项目的代码量不大（约 1000 行），但涵盖了前端开发的很多核心知识点：状态管理、音频处理、AI 集成、错误处理、缓存策略等。

最复杂的是 `FeedbackCard` 组件——它要处理符号渲染、音频播放状态、选中高亮等多个交互状态。如果你只能读一个文件来学习，那就是它了。

---

*项目反思：这是一个很好的 MVP（最小可行产品）示例。用最简单的技术栈实现核心功能，快速验证想法。如果用户喜欢，再逐步添加后端、优化性能。先做对，再做好。*
