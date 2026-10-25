# 理清 · Liqing

把一团模糊的事「理清」的 AI 脑图工具。输入一句模糊的问题，AI 自动判断类型并生成一张右展开树脑图，然后你可以点任意节点继续深挖、追问、补充——逐步把事情理清楚。

```text
一句话 → AI 生成整图 → 点节点深挖 / 追问 / 补充 → 理清
```

与 XMind 的区别：**AI 主动拆解**，不用从空白画布开始；与聊天的区别：输出是**可俯瞰的空间化脑图**，不是一屏屏滚走的文字。

## 能用到什么程度（当前能力）

实测通过的能力：

- **一句话生成整图**：AI 自动判断 4 种类型（决策 / 找根因 / 搞懂概念 / 做规划），顶栏标签可手动纠正
- **节点深挖**（`⤵`）与**追问**（围绕选中节点生成关联内容）
- **补充信息**：在生成后追加补充，AI 融入已有结构
- **编辑**：双击改节点文字、增删节点、拖拽移动节点换父级或排序
- **折叠/展开**子树
- **导出 PNG 图片**、**复制 PlantUML** 代码
- **历史记录**：脑图存 localStorage，刷新不丢
- **自定义模型**：设置面板可切换 provider / 模型 / baseUrl / API key（兼容 OpenAI 兼容接口，如 OpenRouter、GLM 系列），key 保存在当前浏览器 localStorage，请求经本机后端发往所选模型服务，模型服务会接收所需凭据。不要在共享浏览器上保存私人 key。
- **测试**：12 个单元测试覆盖 schema 归一化、PlantUML 生成、布局等核心逻辑

MVP 边界（明确没做）：登录、多设备同步、协作、移动端。数据只存本机浏览器 localStorage。

## 快速开始

环境要求：Node.js ≥ 20，pnpm ≥ 10（实测 Node 22 / pnpm 11）。

```bash
git clone https://github.com/zxd-666/liqing.git
cd liqing/代码
pnpm install
cp .env.example .env   # .env 中填 DEEPSEEK_API_KEY
pnpm dev
```

打开 http://127.0.0.1:5173 即可使用。后端 API 在 http://127.0.0.1:8797（由 Vite 代理 `/api`）。

API key 获取：[DeepSeek 开放平台](https://platform.deepseek.com/)。默认模型为 DeepSeek v4 系列（生成整图 v4-pro，轻任务 v4-flash）；没有 DeepSeek key 也可以在页面设置里填任意 OpenAI 兼容接口使用。

## 常用命令

```bash
cd 代码
pnpm typecheck   # 类型检查
pnpm test        # 12 个单元测试
pnpm build       # tsc -b && vite build
```

## 更多文档

- [HANDOFF.md](HANDOFF.md) — 产品决策与交互交接文档
- [docs/理清-Claude原型.html](docs/理清-Claude原型.html) — 交互原型归档（视觉与交互参考，非正式应用）

## 致谢

本项目在开发过程中使用了 AI 编程工具（Claude / Codex / Brave on Hermes）辅助原型与实现。
