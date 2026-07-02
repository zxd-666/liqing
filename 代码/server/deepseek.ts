import type { Mindmap, MindmapType } from "../src/lib/types.js";
import { TYPE_HINTS, TYPE_LABELS } from "../src/lib/types.js";
import { normalizeChildren, normalizeMindmap, normalizeRespond } from "./schema.js";
import { formatSearchContext, searchWeb } from "./search.js";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

const API_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_TIMEOUT_MS = 45_000;

function getApiKey() {
  return process.env.DEEPSEEK_API_KEY?.trim();
}

function generateModel() {
  return process.env.DEEPSEEK_MODEL_GENERATE || "deepseek-v4-pro";
}

function lightModel() {
  return process.env.DEEPSEEK_MODEL_LIGHT || "deepseek-v4-flash";
}

export function assertDeepSeekConfigured() {
  if (!getApiKey()) {
    const err = new Error("未配置 DeepSeek API key，请在 .env 中设置 DEEPSEEK_API_KEY");
    err.name = "MissingDeepSeekKey";
    throw err;
  }
}

async function callDeepSeekJson(model: string, messages: ChatMessage[], signal?: AbortSignal) {
  assertDeepSeekConfigured();
  const res = await fetchWithTimeout(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.4
    })
  }, signal, DEEPSEEK_TIMEOUT_MS, "AI 请求超时，请稍后重试");

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `DeepSeek 请求失败：HTTP ${res.status}`;
    throw new Error(msg);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("DeepSeek 没有返回可解析的 JSON 内容");
  }
  return JSON.parse(content);
}

async function callWithRetry<T>(model: string, messages: ChatMessage[], parser: (raw: unknown) => T, signal?: AbortSignal) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await callDeepSeekJson(model, messages, signal);
      return parser(raw);
    } catch (err) {
      if (isAbortError(err)) throw err;
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("DeepSeek 输出解析失败");
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  parentSignal: AbortSignal | undefined,
  timeoutMs: number,
  timeoutMessage: string
) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = windowlessSetTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abort = () => controller.abort();
  parentSignal?.addEventListener("abort", abort, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (timedOut) throw new Error(timeoutMessage);
    throw err;
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abort);
  }
}

function windowlessSetTimeout(callback: () => void, timeoutMs: number) {
  return setTimeout(callback, timeoutMs);
}

const baseSystemPrompt = [
  "你是「理清」AI 脑图工具的结构化思考引擎。",
  "只输出 JSON，不输出 Markdown，不输出解释。",
  "节点文字必须短，尽量是中文词组或短句，单个节点不超过 15 个中文字符。",
  "树结构必须右展开可读：每层分支 2 到 5 个，避免长段落。",
  "不要编造具体事实；可以给出思考维度、判断变量、验证方式。",
  "初始脑图应尽量完整，而不是只给大纲；后续人工与 AI 是在完整图上继续优化。"
].join("\n");

export async function generateMindmap(input: {
  text: string;
  forcedType?: MindmapType;
  webSearch?: boolean;
  signal?: AbortSignal;
}): Promise<Mindmap> {
  assertDeepSeekConfigured();
  const { text, forcedType, webSearch, signal } = input;
  const typeInstruction = forcedType
    ? `用户已手动指定类型为 ${TYPE_LABELS[forcedType]}，必须返回 type="${forcedType}"。`
    : "请自动判断 type，只能是 decision、cause、concept、plan 之一。";
  const searchContext = webSearch ? formatSearchContext(await searchWeb(text, signal)) : "";

  return callWithRetry(generateModel(), [
    { role: "system", content: baseSystemPrompt },
    {
      role: "user",
      content: [
        typeInstruction,
        "请一次性生成一张完整可用的初始脑图，不要只输出三级大纲。",
        "深度要求：整体建议 3 到 5 层；每个一级分支至少有 2 到 4 个子节点；关键子节点继续展开到可判断、可验证或可行动的层级。",
        "完整性要求：把用户真正需要考虑的变量、判断标准、风险、验证方式、下一步行动都尽量放进图里。",
        "交互预期：用户后续会和 AI 一起优化调整，但初始图应已经能独立帮助用户看清问题。",
        "控制规模：总节点建议 24 到 48 个；不要为了凑数量重复表达。",
        "返回格式：{\"type\":\"decision|cause|concept|plan\",\"root\":{\"text\":\"中心主题\",\"kind\":\"topic\",\"children\":[...]}}",
        webSearch
          ? "联网搜索已开启。必须优先参考下方搜索结果；搜索结果没有明确支持的信息，不要当作事实写入。涉及政策、价格、时间、产品能力等变化信息时，用“需核验”“待确认”等短节点表达不确定性。"
          : "联网搜索未开启。不要声称已查询最新资料。",
        searchContext ? `搜索上下文：\n${searchContext}` : "",
        `四类参考骨架：${JSON.stringify(TYPE_HINTS, null, 2)}`,
        `用户输入：${text}`
      ].join("\n")
    }
  ], (raw) => normalizeMindmap(raw, forcedType), signal);
}

export async function expandMindmapNode(input: {
  mindmap: Mindmap;
  targetPath: string[];
  mode: "dig" | "ask";
  signal?: AbortSignal;
}) {
  const modeText =
    input.mode === "dig"
      ? "深挖该节点，补充 2 到 4 个更细的子节点。"
      : "生成 1 个能促进用户继续思考的 AI 追问节点，kind 必须是 ai_question。";

  return callWithRetry(lightModel(), [
    { role: "system", content: baseSystemPrompt },
    {
      role: "user",
      content: [
        modeText,
        "返回格式：{\"children\":[{\"text\":\"短节点\",\"kind\":\"node|ai_question\",\"children\":[]}]}",
        `脑图类型：${input.mindmap.type}`,
        `目标路径：${input.targetPath.join(" > ")}`,
        `当前脑图：${JSON.stringify(input.mindmap)}`
      ].join("\n")
    }
  ], normalizeChildren, input.signal);
}

export async function respondToNode(input: {
  mindmap: Mindmap;
  targetPath: string[];
  message: string;
  signal?: AbortSignal;
}) {
  return callWithRetry(lightModel(), [
    { role: "system", content: baseSystemPrompt },
    {
      role: "user",
      content: [
        "判断用户 message 是 question 还是 supplement，但无论哪种，都要直接返回可加入脑图的完善节点。",
        "若是 question：先在心里回答用户问题，再把答案提炼为 2 到 4 个普通 node 子节点；不要只创建问答记录。",
        "若是 supplement：把补充内容整理为 1 到 3 个普通 node 子节点。",
        "返回格式：{\"judged\":\"question|supplement\",\"nodes\":[{\"text\":\"短节点\",\"kind\":\"node\",\"children\":[]}]}",
        `脑图类型：${input.mindmap.type}`,
        `目标路径：${input.targetPath.join(" > ")}`,
        `用户 message：${input.message}`,
        `当前脑图：${JSON.stringify(input.mindmap)}`
      ].join("\n")
    }
  ], normalizeRespond, input.signal);
}
