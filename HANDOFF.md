# 理清（Liqing）· 开发交接文档

> 给接手开发的同学（含 Codex）：`docs/理清-Claude原型.html` 是一个**纯前端 + 假数据**的交互原型，用来确定**产品形态、交互流程和视觉**。
> **它定义的是"长什么样、怎么交互"，不是"代码怎么写"。** 请按下面的说明区分「要保留的」和「要替换的」，不要照搬原型里的临时实现。
> 正式 React + DeepSeek MVP 开发代码放在 `代码/` 目录下，根目录只保留说明文档和原型归档。

---

## 1. 产品是什么

PC 网页端的 **AI 脑图工具**，帮用户把一团模糊的事「理清」。核心循环：

```
用户一句话  →  AI 判断类型并生成结构化脑图  →  用户点节点深挖/追问/改  →  逐步理清
```

与 XMind 的区别：**AI 主动拆解**；与聊天的区别：**输出是可俯瞰的空间化脑图**。

## 2. 已敲定的产品决策（不要推翻）

| 项 | 决策 |
|---|---|
| 理清对象 | 4 类：**决策 / 找根因 / 搞懂概念 / 做规划**。用户不选，**AI 自动判断**，顶栏标签可手动切换纠正 |
| 核心交互 | **先一次性生成整张图，再点节点逐步展开**（不是逐句问答） |
| 布局 | **单向右展开树**（根在最左，逐层向右），文字**单行横向**显示 |
| 视觉 | 清爽极简：白底、细线条点阵网格、曲线连线、圆角卡片，中心主题用深色强调 |
| MVP 边界 | 先做核心主线。**暂不做**：登录、多脑图保存、协作、移动端 |

## 3. 原型里「保留」vs「替换」

### ✅ 要 1:1 保留的（这些是规格）
- **布局算法**：`measure/place/layout`（右展开、子树高度居中），层间距 `HGAP`、行高 `ROW`
- **全部交互**：单击选中、`深挖/追问/补充/删除` 操作条、双击行内改名、右上角圆点折叠/展开、画布拖拽平移 + 滚轮缩放 + 自适应、入场动画（从中心按层级 stagger 展开）
- **底部输入的上下文逻辑**：选中节点时 = 针对该节点；未选中 = 追加新分支
- **节点类型与配色**：root / 一级 / `AI 追问`(q) / `你问`(ask) / `AI 答`(ans)
- **导出**：导出 PNG、复制 PlantUML mindmap（`*` 层级语法，见原型 `toPlantUML`）
- **整体视觉**：配色变量、卡片样式、顶栏、底部 dock、起始页

### ♻️ 必须替换为真实 AI 的（这些是假数据，别当需求）
| 原型里的占位 | 真实实现应替换为 |
|---|---|
| `detectType()` 关键词规则 | DeepSeek 判断类型 |
| `RICH[]` 写死的演示数据 | DeepSeek 生成的脑图树 |
| `DIG_POOL` / `ASK_POOL` / `ANS_POOL` | DeepSeek 的深挖 / 追问 / 回答 |
| `isQuestionMsg()` 关键词正则 | DeepSeek 判断「追问 or 补充」 |
| `setTimeout(...,650)` 假延迟 | 真实接口调用 |
| `alert()` / `prompt()`（补充、报错） | 正式的输入/提示 UI |
| `location.reload()`（理清新事） | 正常的状态重置 |

## 4. AI 集成约定（关键，决定前后端契约）

- **模型**：使用 DeepSeek OpenAI-compatible API。生成脑图默认用 `deepseek-v4-pro` 保证质量；纯类型分类、深挖、追问、回答等轻任务默认用 `deepseek-v4-flash` 控成本。
- **API key 绝不能放前端**：必须有后端代理（Node/Python 均可），前端只调自己的后端。
- **用结构化输出**（tool use / JSON mode）让模型直接返回节点树，前端拿到即可渲染，保持现有数据模型不变。
- **约束输出风格**：节点文字要**短**（词组/短句，不超过约 15 字），否则横向单行卡片会很难看。
- **建议流式**：配合"从中心逐层长出"的动画，边生成边渲染体验最好。

### 建议的数据模型（前后端统一）
原型节点（去掉 `_` 开头的布局临时字段）即可作为传输/持久化模型：
```ts
type Node = {
  id: string;
  text: string;
  kind: "topic" | "node" | "ai_question" | "user_question" | "ai_answer";
  children: Node[];
};
type Mindmap = { type: "decision"|"cause"|"concept"|"plan"; root: Node };
```

### 建议的接口
```
POST /api/generate   { text, forcedType? }              → { type, root }            // 判类型 + 生成整图
POST /api/expand     { type, path[], mode:"dig"|"ask" } → { children: Node[] }      // 深挖 / AI 追问
POST /api/respond    { type, path[], message }         → { judged:"question"|"supplement", nodes: Node[] }
```
`path[]` 为从根到目标节点的文字路径，给模型足够上下文。

## 5. 技术栈建议
- 原型是 **vanilla JS + SVG**，生产建议迁到 **React + TypeScript**；脑图渲染可继续 SVG/绝对定位（原型的布局算法可直接移植），数据量大再考虑 canvas 库。
- **导出 PNG** 原型用手绘 Canvas（读 `getComputedStyle`/`getBoundingClientRect`）。迁框架后这套坐标换算要重写，逻辑见 `exportImage()`。
- 后续要做持久化时，`Mindmap` 结构直接可存。

## 6. 已知原型局限（生产要补，但当前不阻塞）
- 长文字节点在深层可能横向轻微重叠（`HGAP` 固定）→ 真实实现可按内容宽度动态算间距
- 节点不支持拖拽换位置（仅画布平移）
- `fit()` 仅在生成时调用，窗口 resize 不自动重排
- 无撤销/重做、无键盘快捷键
- 折叠状态、视图缩放等未持久化

## 7. 一句话给 Codex
> 把 `docs/理清-Claude原型.html` 当成**带可运行交互的设计稿**：交互、布局、视觉照着做；凡是 `detectType / RICH / *_POOL / isQuestionMsg / setTimeout / alert / prompt / reload` 这些占位，全部替换成「前端调后端、后端调 DeepSeek（结构化输出）」。第 4 节的数据模型和接口是前后端契约的起点。
