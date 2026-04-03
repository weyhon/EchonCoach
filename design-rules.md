# EchoCoach (Nebula) — Design Rules for AI Judge

> 本文件是 UI 自动优化 Skill 的评分标准。LLM Judge 根据此文件对截图逐项打分。
> 设计灵感来源：Spotify（极简层级）+ Preply（教育温度）+ 像素风（个性趣味）

---

## 设计身份：Cozy Retro-Modern（温暖复古现代）

一句话定义：**像一个温暖的像素风咖啡馆里的英语教练** — 专业但不冰冷，有趣但不幼稚。

---

## 评分维度（每项 0-20 分，满分 100）

### 1. Color Harmony 色彩和谐（20分）

**调色盘**

| Token | 值 | 用途 |
|-------|-----|------|
| --bg | #faf9f7 | 页面底色（warm cream） |
| --surface | #ffffff | 卡片/容器 |
| --surface-low | #f4f3f1 | 次级容器 |
| --text | #2D2D2D | 主文字 |
| --text-muted | #574144 | 辅助文字 |
| --rose | #E8587A | 主强调色（CTA、重点） |
| --rose-deep | #aa284d | 深色变体（hover/active） |
| --green | #006b30 | 正确/通过 |
| --red | #ba1a1a | 错误/需改进 |
| --amber-bg | #FFF4E0 | 提示/建议背景 |
| --pixel-accent | #FFD700 | 像素装饰专用金色 |

**规则**
- ✅ 强调色最多 3 种（rose + green + red），其余用灰度色阶
- ✅ 背景永远是 warm tone（偏暖的米白），不用纯白 #fff 做页面底色
- ✅ 文字与背景对比度 ≥ 4.5:1（WCAG AA）
- ❌ 扣分：出现纯黑 #000000 做背景、出现荧光色、超过 3 种强调色、冷灰色调

**Spotify 借鉴**：单一强调色策略 — rose 是唯一"跳"出来的颜色，其他全部低调
**Preply 借鉴**：粉色系强调色传达温暖和亲和力，不用冷色做主色

### 2. Typography 字体层级（20分）

**字体栈**

| 用途 | 字体 | 特征 |
|------|------|------|
| 标题/分数 | Newsreader (serif) | 优雅、编辑感 |
| 正文/标签/按钮 | Manrope (sans-serif) | 清晰、现代 |
| 像素装饰文字 | "Press Start 2P" 或等宽像素字体 | 复古趣味（仅用于装饰） |

**规则**
- ✅ 标题用 serif（Newsreader），正文用 sans-serif（Manrope）
- ✅ 分数数字要大且显眼（≥ 48px），用 serif 字体
- ✅ 标签文字用 uppercase + letter-spacing ≥ 0.1em，营造精致感
- ✅ 正文字号 ≥ 14px，确保移动端可读
- ✅ 像素字体仅用于小标签、成就徽章等装饰性元素，不用于正文
- ❌ 扣分：标题用了 sans-serif、正文用了 serif、字号 < 13px、像素字体用于大段正文

**Spotify 借鉴**：字体粗细（weight）创造层级，不靠字体数量
**Preply 借鉴**：多种 text variant（caption → large），每种有明确用途

### 3. Depth & Layout 层级与布局（20分）

**No-Line Rule（无边框规则）**
层级通过背景色变化和阴影表达，不用 border 分割。

```
页面底色 #faf9f7
  └─ 卡片 #ffffff（微阴影提升）
      └─ 次级区域 #f4f3f1（内嵌降低）
          └─ 交互元素（圆角 + 轻阴影）
```

**规则**
- ✅ 层级用背景色递进，不用 border 线条
- ✅ 卡片圆角 ≥ 12px（大组件 16px）
- ✅ 卡片阴影：`0 1px 3px rgba(0,0,0,0.04)` — 极轻，若有若无
- ✅ 元素间距 ≥ 12px，关键区块间距 ≥ 24px
- ✅ 关键信息（分数、单词、反馈）首屏可见，无需滚动
- ❌ 扣分：出现 border/线条分割、元素挤在一起、阴影过重（opacity > 0.1）
- ❌ 扣分：信息需要滚动才能看到核心内容

**Spotify 借鉴**：spacing 是第一分割手段，不是线条。250ms 过渡动画
**Preply 借鉴**：卡片式布局，信息密度与留白平衡

### 4. Interaction & Tactile 交互质感（20分）

**按钮和可点击元素**
- 圆角 ≥ 12px
- hover 时有视觉反馈（颜色变化或微缩放）
- active 时 scale(0.97) 按压感
- 过渡动画 200-300ms，ease-out

**Word Pills（单词药丸）**
- 圆角、彩色背景（green/amber/red 按评分）
- 有轻微阴影和 hover 状态
- 点击展开详情

**规则**
- ✅ 所有可点击元素都有 hover + active 反馈
- ✅ 按钮有足够的 padding（≥ 10px 12px）
- ✅ 移动端点击目标 ≥ 44px × 44px
- ✅ 过渡动画 200-300ms，不能太快也不能太慢
- ❌ 扣分：扁平无反馈、尖锐直角（< 8px）、没有 hover 状态

**Spotify 借鉴**：设备感知的圆角（移动 4-8px，桌面 8-12px），6px focus outline
**Preply 借鉴**：`touch-action: manipulation` 移动优化

### 5. Pixel Personality 像素个性（20分）

**像素风不是整体风格，而是点缀调味料。**

像素元素使用场景：
- 🏆 成就/徽章图标 — 8-bit 风格的小星星、奖杯
- 📊 进度指示 — 像素风进度条（类似游戏血条）
- 🎯 分数展示旁的小装饰 — 像素心心、小火焰
- 🏷️ 小标签文字 — "LEVEL UP!" "COMBO!" 等用像素字体
- 🎨 loading/空状态 — 像素风小动画或插画

像素元素**不**使用的场景：
- ❌ 正文和主要信息展示
- ❌ 导航和核心按钮
- ❌ 大面积背景
- ❌ 图标系统的主体

**规则**
- ✅ 像素元素总面积 ≤ 页面的 10%（调味料，不是主菜）
- ✅ 像素装饰与主 UI 有统一的配色（用 --rose、--green 等 token 的像素版本）
- ✅ 像素元素要有实际含义（表示成就、进度），不是纯装饰
- ✅ 像素图标尺寸统一（16×16 或 32×32 的整数倍）
- ❌ 扣分：像素元素占比 > 20%、配色与主UI脱节、纯装饰无功能意义
- ❌ 扣分：像素元素模糊（需要 image-rendering: pixelated）

**灵感**：游戏成就系统 — 完成练习 = 获得像素徽章，连续练习 = combo 火焰

---

## 综合评分公式

```
总分 = Color(0-20) + Typography(0-20) + Depth(0-20) + Interaction(0-20) + Pixel(0-20)

评级:
  90-100: S  (Exceptional)
  80-89:  A  (Great)
  70-79:  B  (Good, minor issues)
  60-69:  C  (Needs improvement)
  < 60:   D  (Major redesign needed)
```

---

## LLM Judge Prompt 模板

给 LLM 评分时使用此 prompt：

```
你是一位 UI 设计评审专家。请根据以下设计规范对截图打分。

## 评分标准
[粘贴上面5个维度的规则]

## 输出格式（严格 JSON）
{
  "color": { "score": 0-20, "issues": ["..."] },
  "typography": { "score": 0-20, "issues": ["..."] },
  "depth": { "score": 0-20, "issues": ["..."] },
  "interaction": { "score": 0-20, "issues": ["..."] },
  "pixel": { "score": 0-20, "issues": ["..."] },
  "total": 0-100,
  "grade": "S/A/B/C/D",
  "top_suggestion": "最值得改进的一件事"
}
```

---

## 附：不可变约束

以下是任何优化都不能改变的底线：

1. **品牌色 --rose (#E8587A)** 不能被替换
2. **字体组合 Newsreader + Manrope** 不能被替换
3. **warm cream 基调** 不能变成冷灰或纯白
4. **功能完整性** — 所有按钮（YouGlish、PlayPhrase、Record、My Voice、速度切换）必须保留
5. **可访问性** — 对比度不能低于 WCAG AA
