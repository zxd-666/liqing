import type { ExpandMode, MessageJudgement, Mindmap, MindmapNode, MindmapType } from "./types";

async function requestJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "请求失败，请稍后再试");
  }
  return data as T;
}

export function generateMindmap(text: string, forcedType?: MindmapType) {
  return requestJson<Mindmap>("/api/generate", { text, forcedType });
}

export function expandNode(mindmap: Mindmap, targetPath: string[], mode: ExpandMode) {
  return requestJson<{ children: MindmapNode[] }>("/api/expand", { mindmap, targetPath, mode });
}

export function respondToNode(mindmap: Mindmap, targetPath: string[], message: string) {
  return requestJson<{ judged: MessageJudgement; nodes: MindmapNode[] }>("/api/respond", {
    mindmap,
    targetPath,
    message
  });
}
