# EchoCoach — Design Rules for AI Judge

> 本文件是 UI 自动优化 Skill 的评分标准。LLM Judge 根据此文件对截图逐项打分。
> 设计灵感来源：iA Writer（文字即主角）+ Apple Books（阅读质感）+ 精装印刷书（细线排版）
> 2026-07 起采用 "Ink & Paper" 方向，取代旧的 Cozy Retro-Modern（像素风）规则。

---

## 设计身份：Ink & Paper（墨与纸）

一句话定义：**一本精心排版的发音教材** — 安静、文气、精确，句子和分数是页面的绝对主角。

---

## 评分维度（每项 0-20 分，满分 100）

### 1. Color Harmony 色彩和谐（20分）

**调色盘**

| Token | 值 | 用途 |
|-------|-----|------|
| --bg | #fcfcfa | 页面底色（paper white） |
| --surface | #fffffe | 弹窗/浮层 |
| --surface-muted | #f4f3ee | 次级容器（少用） |
| --text-primary | #111110 | 主文字（ink） |
| --text-secondary | #4a4a46 | 辅助文字 |
| --text-muted | #6e6e68 | 弱化文字（对比度 ≥ 4.5:1） |
| --rose | #c2410c | 唯一强调色（burnt orange：录音键、分数、链接标记） |
| --green | #2f6b3f | 正确（墨绿，压暗） |
| --amber | #92610a | 待改进（赭黄，压暗） |
| --red | #a52a2a | 错误（砖红，压暗） |
| --border | #d9d9d2 | 细线（rule） |

**规则**
- ✅ 强调色只有一个：焦橙 #c2410c。绿/黄/红只作单词评分语义色，且全部压暗贴近墨色气质
- ✅ 背景是纸白 #fcfcfa，近乎单色的版面
- ✅ 文字与背景对比度 ≥ 4.5:1（WCAG AA）
- ❌ 扣分：出现第二个装饰性强调色、明亮饱和色（荧光、糖果色）、大面积色块背景

### 2. Typography 字体层级（20分）

**字体栈**

| 用途 | 字体 | 特征 |
|------|------|------|
| 句子/分数/标题/单词 | Fraunces (serif) | 大字号、编辑感，页面主角 |
| 按钮/标签/时间戳/IPA | IBM Plex Mono (mono) | 打字机质感，全部 UI 杂项 |

**规则**
- ✅ 内容（句子、分数、单词、教练评语）用 Fraunces 衬线；UI 杂项（按钮、标签、meta）用 mono
- ✅ 练习句是页面最大的文字（≥ 24px）；总分数字要巨大（≥ 60px）且用衬线
- ✅ 标签用 mono + uppercase + letter-spacing ≥ 0.1em
- ✅ 正文字号 ≥ 14px、弱化文字 ≥ 11px
- ✅ 教练评语用衬线斜体（margin note 气质）
- ❌ 扣分：内容用了无衬线、句子字号不突出、引入第三种字体

### 3. Depth & Layout 层级与布局（20分）

**Rule-Line Rule（细线规则）**
层级通过 1px 细线（hairline rules）表达，像书页的分隔线；禁止用阴影和色块卡片制造层级。

```
纸面 #fcfcfa
  ├─ 区块级分隔：1px solid var(--text-primary)（重规则线）
  ├─ 条目级分隔：1px solid var(--border)（轻规则线）
  └─ 弹窗浮层：--surface + 1px ink border（无阴影或极轻）
```

**规则**
- ✅ 主内容直接排在纸面上，无卡片包裹
- ✅ 圆角 ≤ 4px（按钮 2px），气质是"印刷"不是"软件"
- ✅ 阴影基本禁用（浮层可用极轻投影兜底）
- ✅ 元素间距 ≥ 12px，关键区块间距 ≥ 24px；关键信息首屏可见
- ❌ 扣分：出现浮起的白卡片、圆角 > 8px 的大容器、明显投影

### 4. Interaction & Tactile 交互质感（20分）

**按钮和可点击元素**
- 主操作（Record）：焦橙实心 + mono 大写字母 + 2px 圆角
- 次级操作：mono 大写文字按钮（透明底）或 1px 细线描边按钮
- hover 反馈：变色/加深；active 时 scale(0.98)
- 过渡动画 200-300ms，ease-out

**Word Rows（单词得分行）**
- 书页索引式行：衬线单词 + 3px 细横条得分 + mono 数字
- 行间用 1px 细线分隔，点击展开详情

**规则**
- ✅ 所有可点击元素都有 hover + active 反馈
- ✅ 移动端点击目标 ≥ 44px × 44px
- ✅ 过渡动画 200-300ms
- ❌ 扣分：扁平无反馈、胶囊大圆角按钮、彩色药丸块

### 5. Editorial Restraint 编辑克制（20分）

**装饰的原则：少即是多。任何装饰必须是"排版元素"（线、点、字符），不是图形贴纸。**

允许的装饰：
- 细规则线（hairline rules）作分隔
- mono 小字符提示（如 "SPACE TO PLAY · R TO RECORD"）
- 音高曲线（pitch curve）— 功能性可视化，保留
- 纸张噪点纹理（grain overlay，不透明度 ≤ 0.02）

不允许的装饰：
- ❌ 像素块、像素徽章贴图、游戏血条
- ❌ 渐变光晕、玻璃拟态、彩色 blob
- ❌ 与内容无关的插画和 emoji 装饰

**规则**
- ✅ 装饰总量趋近于零；每个视觉元素都能说出功能理由
- ✅ 波形/加载动画用细线条呈现，颜色只用 ink 或焦橙
- ❌ 扣分：出现像素风元素、发光效果、大面积装饰

---

## 综合评分公式

```
总分 = Color(0-20) + Typography(0-20) + Depth(0-20) + Interaction(0-20) + Restraint(0-20)

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
  "restraint": { "score": 0-20, "issues": ["..."] },
  "total": 0-100,
  "grade": "S/A/B/C/D",
  "top_suggestion": "最值得改进的一件事"
}
```

---

## 附：不可变约束

以下是任何优化都不能改变的底线：

1. **强调色 --rose (#c2410c 焦橙)** 是唯一强调色，不能被替换或增加
2. **字体组合 Fraunces + IBM Plex Mono** 不能被替换
3. **paper white 基调（#fcfcfa）+ 细线分隔** 不能变成卡片+阴影体系
4. **功能完整性** — 所有按钮（YouGlish、PlayPhrase、Record、My Voice、速度切换）必须保留
5. **可访问性** — 对比度不能低于 WCAG AA；触控目标 ≥ 44px

> 历史注记：2026-07 之前的规则是 Cozy Retro-Modern（#E8587A 玫瑰粉 + 暖米色 + 像素装饰），
> 经设计探索（design-shotgun practice-screen-20260703）用户选定 Ink & Paper 方向后废止。
