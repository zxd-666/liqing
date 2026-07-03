import type { ExpandMode, MessageJudgement, Mindmap, MindmapNode, MindmapType } from "./types";
import type { AiRequestSettings } from "./aiSettings";

async function requestJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "请求失败，请稍后再试");
  }
  return data as T;
}

export function generateMindmap(text: string, forcedType?: MindmapType, settings?: AiRequestSettings, signal?: AbortSignal) {
  return requestJson<Mindmap>("/api/generate", { text, forcedType, ...settings }, signal);
}

export function expandNode(mindmap: Mindmap, targetPath: string[], mode: ExpandMode, settings?: AiRequestSettings, signal?: AbortSignal) {
  return requestJson<{ children: MindmapNode[] }>("/api/expand", { mindmap, targetPath, mode, ...settings }, signal);
}

export function rebuildNodeChildren(mindmap: Mindmap, targetPath: string[], settings?: AiRequestSettings, signal?: AbortSignal) {
  return requestJson<{ children: MindmapNode[] }>("/api/rebuild-children", { mindmap, targetPath, ...settings }, signal);
}

export function respondToNode(mindmap: Mindmap, targetPath: string[], message: string, settings?: AiRequestSettings, signal?: AbortSignal) {
  return requestJson<{ judged: MessageJudgement; nodes: MindmapNode[] }>("/api/respond", {
    mindmap,
    targetPath,
    message,
    ...settings
  }, signal);
}
