# 理清 · AI 脑图

PC 网页端 AI 脑图 MVP。用户输入一句模糊问题后，后端调用 DeepSeek 生成结构化脑图，前端以右展开树展示，并支持节点深挖、追问、补充、编辑、折叠、导出 PNG 和复制 PlantUML。

## 本地启动

```bash
cd 代码
pnpm install
cp .env.example .env
```

在 `.env` 中填入：

```bash
DEEPSEEK_API_KEY=你的 DeepSeek API Key
```

启动开发环境：

```bash
pnpm dev
```

- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:8797`

## DeepSeek 配置

默认模型：

- 生成整图：`DEEPSEEK_MODEL_GENERATE=deepseek-v4-pro`
- 轻任务：`DEEPSEEK_MODEL_LIGHT=deepseek-v4-flash`

API key 只由 Node 后端读取，前端不会接触 key。未配置 key 时，前端会显示“未配置 DeepSeek API key”的错误。

## 常用命令

```bash
cd 代码
pnpm typecheck
pnpm test
pnpm build
```

## 原型归档

Claude 生成的单文件交互原型已保留在：

```text
docs/理清-Claude原型.html
```

它是视觉与交互参考，不再作为正式应用入口。

## 目录说明

```text
代码/                     正式开发代码、依赖配置、构建产物
docs/理清-Claude原型.html  Claude 交互原型归档
HANDOFF.md                产品与交互交接说明
README.md                 项目说明
```
