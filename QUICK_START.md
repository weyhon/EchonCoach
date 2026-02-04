# 🚀 EchoCoach 快速上手指南

## 第一步：配置 API 密钥

1. 访问 [MiniMax 官网](https://www.minimaxi.com) 注册账号
2. 获取你的 API Key 和 Group ID
3. 复制 `.env.example` 为 `.env`:
   ```bash
   cp .env.example .env
   ```
4. 编辑 `.env` 文件，填入你的凭证：
   ```env
   VITE_MINIMAX_API_KEY=eyJ...你的密钥
   VITE_MINIMAX_GROUP_ID=你的Group_ID
   ```

## 第二步：启动项目

```bash
npm install
npm run dev
```

浏览器会自动打开 http://localhost:5173

## 第三步：开始练习

### 示例 1: 基础陈述句

**输入**:
```
I love programming
```

**AI 会显示**:
```
      ·   ●      ●↘
      I  love programming
     /aɪ lʌv proʊɡræmɪŋ/
```

**标注说明**:
- `·` - "I" 是代词，弱读
- `●` - "love" 和 "programming" 是重点词，重读
- `↘` - 陈述句结尾下降语调

---

### 示例 2: 疑问句

**输入**:
```
Do you like coffee?
```

**AI 会显示**:
```
     ·  ·   ●     ●↗
    Do you like coffee?
   /du ju laɪk kɒfi/
```

**标注说明**:
- `·` - "Do" 和 "you" 通常弱读
- `●` - "like" 和 "coffee" 重读
- `↗` - 疑问句结尾上升语调

---

### 示例 3: 连读练习

**输入**:
```
Tell us about it
```

**AI 会显示**:
```
      ●   ·    ·   ·↘
    Tell‿us about‿it
    /te lə səˈbaʊ tɪt/
```

**标注说明**:
- `‿` - 连读符号
  - "Tell‿us" - "Tell" 的 /l/ 连到 "us" 的 /ʌ/
  - "about‿it" - "about" 的 /t/ 连到 "it" 的 /ɪ/
- `●` - "Tell" 重读
- `·` - 其他词弱读
- `↘` - 陈述句降调

---

## 语音标注符号速查

| 符号 | 名称 | 含义 | 示例 |
|-----|------|------|------|
| `‿` | 连读 | 两个词自然连读发音 | tell‿us |
| `●` | 重读 | 该词/音节需要强调 | **love** |
| `·` | 弱读 | 该词/音节轻轻带过 | I |
| `↗` | 升调 | 语调上扬（疑问句） | ready`↗`? |
| `↘` | 降调 | 语调下降（陈述句） | ready`↘`. |

---

## 完整练习流程

### 1️⃣ 点击 "Analyze & Listen"
- ✅ AI 自动生成标注
- ✅ 播放标准发音
- ✅ 显示国际音标

### 2️⃣ 调整播放速度
- 🟠 **Slow** - 慢速播放（0.8x）适合初学
- 🟢 **Normal** - 正常速度（1.0x）模拟真实对话

### 3️⃣ 选词发音教学
- 在标注区域**拖选任意文本**
- 底部出现 "Pronounce: [选中文本]" 按钮
- 点击播放该段的标准发音

### 4️⃣ 录制你的发音
- 点击 **Start Practice** 开始录音
- 朗读完成后点击 **Stop**
- AI 会评分并给出建议

### 5️⃣ 查看详细反馈
- **分数**: 0-100 分
- **总体评价**: AI 教练的建议
- **逐词分析**: 每个词的发音状态
  - 🟢 绿色 = 发音正确
  - 🟠 橙色 = 需要改进
  - 🔴 红色 = 发音错误

---

## 练习建议

### 🎯 初学者
从短句开始，重点练习：
```
1. How are you?
2. Nice to meet you
3. Thank you very much
```

### 🚀 进阶学习
练习连读密集的句子：
```
1. Tell us about it
2. Pick it up and put it away
3. I want to go out tonight
```

### 💪 挑战自己
尝试长句和复杂语调：
```
1. Could you please tell me where the nearest subway station is?
2. I've been working on this project for three months
3. What are you going to do this weekend?
```

---

## 🐛 遇到问题？

### API 调用失败
```
❌ 缺少 MiniMax API 密钥
```
**解决**: 检查 `.env` 文件是否正确配置

### 语音标注不显示
**解决**:
1. 打开浏览器控制台（F12）查看错误
2. 项目有自动 fallback，会生成基础标注
3. 检查网络连接

### 录音没有声音
**解决**:
1. 允许浏览器访问麦克风权限
2. 使用 Chrome/Edge 浏览器（推荐）
3. 确保在 localhost 或 HTTPS 环境

---

## 📱 键盘快捷键（未来功能）

- `Space` - 播放/暂停
- `S` - 慢速播放
- `N` - 正常速度
- `R` - 开始/停止录音
- `Enter` - 分析并播放

---

## 💡 学习技巧

### 1. 重复练习
同一个句子多次练习，直到评分达到 90+ 分

### 2. 模仿节奏
不仅要发音准确，还要模仿标注显示的节奏和语调

### 3. 录音对比
使用 "Replay Mine" 功能对比自己的发音和标准发音

### 4. 积累句库
历史记录会保存你的练习，定期回顾复习

---

## 📊 进度追踪

项目会自动保存：
- ✅ 最近 50 条练习历史
- ✅ 每个句子的最高分数
- ✅ 完整的标注和反馈
- ✅ TTS 音频缓存（无需重复下载）

---

**开始你的发音提升之旅吧！** 🎤✨

有问题？查看 [README.md](README.md) 或 [FEATURES.md](FEATURES.md)
