import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { expandMindmapNode, generateMindmap, respondToNode } from "./deepseek.js";
import { loadDotEnv } from "./env.js";
import { mindmapTypeSchema, normalizeMindmap, rawMindmapSchema } from "./schema.js";

loadDotEnv();

const app = express();
const port = Number(process.env.PORT || 8787);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

app.use(express.json({ limit: "1mb" }));

const generateBodySchema = z.object({
  text: z.string().min(1),
  forcedType: mindmapTypeSchema.optional()
});

const expandBodySchema = z.object({
  mindmap: rawMindmapSchema,
  targetPath: z.array(z.string()).min(1),
  mode: z.enum(["dig", "ask"])
});

const respondBodySchema = z.object({
  mindmap: rawMindmapSchema,
  targetPath: z.array(z.string()).min(1),
  message: z.string().min(1)
});

function toHttpError(err: unknown) {
  if (err instanceof z.ZodError) {
    return { status: 400, message: "请求数据格式不正确" };
  }
  if (err instanceof Error && err.name === "MissingDeepSeekKey") {
    return { status: 503, message: err.message };
  }
  if (err instanceof Error) {
    return { status: 502, message: err.message };
  }
  return { status: 500, message: "服务异常，请稍后再试" };
}

app.post("/api/generate", async (req, res) => {
  try {
    const body = generateBodySchema.parse(req.body);
    res.json(await generateMindmap(body.text.trim(), body.forcedType));
  } catch (err) {
    const http = toHttpError(err);
    res.status(http.status).json({ error: http.message });
  }
});

app.post("/api/expand", async (req, res) => {
  try {
    const body = expandBodySchema.parse(req.body);
    const children = await expandMindmapNode({
      ...body,
      mindmap: normalizeMindmap(body.mindmap)
    });
    res.json({ children });
  } catch (err) {
    const http = toHttpError(err);
    res.status(http.status).json({ error: http.message });
  }
});

app.post("/api/respond", async (req, res) => {
  try {
    const body = respondBodySchema.parse(req.body);
    res.json(await respondToNode({
      ...body,
      mindmap: normalizeMindmap(body.mindmap)
    }));
  } catch (err) {
    const http = toHttpError(err);
    res.status(http.status).json({ error: http.message });
  }
});

app.use(express.static(path.join(projectRoot, "dist")));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(projectRoot, "dist", "index.html"));
});

app.listen(port, "127.0.0.1", () => {
  console.log(`理清服务已启动：http://127.0.0.1:${port}`);
});
