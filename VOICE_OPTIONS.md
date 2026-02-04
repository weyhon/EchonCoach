# 🎤 MiniMax 音色选项

## 当前配置

**音色**: `female-yujie` (女声-御姐音)

---

## 📋 MiniMax 支持的音色列表

### 女声音色

| Voice ID | 描述 | 风格 | 推荐用途 |
|----------|------|------|----------|
| `female-shaonv` | 少女音 | 清新、活泼 | 日常对话 |
| `female-yujie` | 御姐音 | 成熟、自然 | **英语学习**（当前使用） |
| `female-chengshu` | 成熟女声 | 稳重、专业 | 正式内容 |
| `female-tianmei` | 甜美音 | 温柔、亲切 | 温馨场景 |

### 男声音色

| Voice ID | 描述 | 风格 | 推荐用途 |
|----------|------|------|----------|
| `male-qn-qingse` | 青涩男声 | 青春、阳光 | 活力内容 |
| `male-qn-jingying` | 精英男声 | 专业、稳重 | **英语学习** |
| `male-qn-badao` | 霸道总裁 | 强势、磁性 | 特殊风格 |
| `male-qn-daxuesheng` | 大学生音 | 自然、随和 | 日常对话 |

---

## 🔧 如何更换音色

### 方法 1: 编辑配置文件

打开 `services/minimaxService.ts`，找到第 117 行和 161 行：

```typescript
// 第 117 行 - 主 TTS
voice_id: "female-yujie",  // 改为你想要的音色

// 第 161 行 - 单词发音
voice_id: "female-yujie",  // 改为你想要的音色
```

### 方法 2: 推荐配置

#### 配置 1: 女声（当前）
```typescript
voice_id: "female-yujie",  // 自然、成熟
```

#### 配置 2: 男声（精英）
```typescript
voice_id: "male-qn-jingying",  // 专业、稳重
```

#### 配置 3: 女声（甜美）
```typescript
voice_id: "female-tianmei",  // 温柔、亲切
```

---

## 🎯 英语学习推荐音色

### 最推荐（清晰度优先）

1. **`female-yujie`** ✨ (当前使用)
   - ✅ 发音清晰
   - ✅ 语速适中
   - ✅ 咬字准确

2. **`male-qn-jingying`**
   - ✅ 专业稳重
   - ✅ 发音标准
   - ✅ 适合男声学习者

### 次推荐（根据个人喜好）

3. **`female-chengshu`**
   - 更成熟的女声
   - 略微低沉

4. **`male-qn-daxuesheng`**
   - 年轻男声
   - 更接近日常对话

---

## 💡 音色对比测试

### 测试句子
```
"How is it going?"
```

### 不同音色效果

**female-yujie** (御姐音) - 当前使用
- 音调：中等
- 语速：适中
- 特点：自然、清晰

**male-qn-jingying** (精英男声)
- 音调：略低
- 语速：稳定
- 特点：专业、标准

**female-shaonv** (少女音)
- 音调：较高
- 语速：略快
- 特点：活泼、清新

---

## 🔄 更换音色步骤

1. **停止服务器**
   ```bash
   # 按 Ctrl+C 停止当前运行的服务
   ```

2. **编辑文件**
   打开 `services/minimaxService.ts`

   修改两处 `voice_id`:
   - 第 117 行（主 TTS）
   - 第 161 行（单词教学）

3. **重启服务器**
   ```bash
   npm run dev
   ```

4. **测试新音色**
   输入一个句子，点击 "Analyze & Listen"

---

## ⚙️ 高级配置

### 调整语速
```typescript
speed: 0.85,  // 0.5-2.0，默认 1.0
```

### 调整音量
```typescript
vol: 1.0,  // 0.0-2.0，默认 1.0
```

### 调整音调
```typescript
pitch: 0,  // -12 到 12，默认 0
```

### 示例：更慢、更清晰
```typescript
voice_setting: {
  voice_id: "female-yujie",
  speed: 0.75,  // 更慢
  vol: 1.2,     // 更大声
  pitch: 0,
},
```

---

## 🎵 音色选择建议

### 根据学习目标

**初学者**:
- `female-yujie` (女声，清晰)
- `male-qn-jingying` (男声，标准)
- 速度: 0.85

**进阶学习者**:
- `female-chengshu` (更自然)
- `male-qn-daxuesheng` (更日常)
- 速度: 1.0

**高级练习**:
- 任意音色
- 速度: 1.0-1.2

### 根据个人偏好

**喜欢女声**:
1. `female-yujie` (推荐)
2. `female-chengshu`
3. `female-tianmei`

**喜欢男声**:
1. `male-qn-jingying` (推荐)
2. `male-qn-daxuesheng`
3. `male-qn-qingse`

---

**当前音色已设置为 `female-yujie`，重启后生效！** 🎉
