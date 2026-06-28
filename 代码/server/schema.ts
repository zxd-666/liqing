import { z } from "zod";
import type { MessageJudgement, Mindmap, MindmapNode, MindmapType, NodeKind } from "../src/lib/types.js";

export const mindmapTypeSchema = z.enum(["decision", "cause", "concept", "plan"]);
export const nodeKindSchema = z.enum(["topic", "node", "ai_question", "user_question", "ai_answer"]);

export const rawNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    id: z.string().optional(),
    text: z.string().min(1),
    kind: nodeKindSchema.optional(),
    children: z.array(rawNodeSchema).optional()
  })
);

export const rawMindmapSchema = z.object({
  type: mindmapTypeSchema,
  root: rawNodeSchema
});

export const rawChildrenSchema = z.object({
  children: z.array(rawNodeSchema).min(1)
});

export const rawRespondSchema = z.object({
  judged: z.enum(["question", "supplement"]),
  nodes: z.array(rawNodeSchema).min(1)
});

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 48);
}

export function normalizeNode(raw: unknown, fallbackKind: NodeKind = "node"): MindmapNode {
  const parsed = rawNodeSchema.parse(raw) as {
    id?: string;
    text: string;
    kind?: NodeKind;
    children?: unknown[];
  };
  const kind = parsed.kind && (fallbackKind === "topic" || parsed.kind !== "topic") ? parsed.kind : fallbackKind;
  return {
    id: parsed.id || makeId(),
    text: normalizeText(parsed.text),
    kind,
    children: (parsed.children || []).map((child) => normalizeNode(child, "node"))
  };
}

export function normalizeMindmap(raw: unknown, forcedType?: MindmapType): Mindmap {
  const parsed = rawMindmapSchema.parse(raw) as { type: MindmapType; root: unknown };
  const root = normalizeNode(parsed.root, "topic");
  return {
    type: forcedType || parsed.type,
    root: {
      ...root,
      kind: "topic"
    }
  };
}

export function normalizeChildren(raw: unknown): MindmapNode[] {
  const parsed = rawChildrenSchema.parse(raw) as { children: unknown[] };
  return parsed.children.map((child) => normalizeNode(child, "node"));
}

export function normalizeRespond(raw: unknown): { judged: MessageJudgement; nodes: MindmapNode[] } {
  const parsed = rawRespondSchema.parse(raw) as { judged: MessageJudgement; nodes: unknown[] };
  return {
    judged: parsed.judged,
    nodes: parsed.nodes.map((node) => normalizeNode(node, "node"))
  };
}
