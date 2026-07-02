import type { MindmapNode } from "./types";

export type LayoutNode = {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  subtreeHeight: number;
};

export type LayoutEdge = {
  from: LayoutNode;
  to: LayoutNode;
};

export type LayoutResult = {
  nodes: Map<string, LayoutNode>;
  edges: LayoutEdge[];
};

export const ROW = 88;
export const HGAP = 116;

const MIN_NODE_WIDTH = 92;
const MAX_NODE_WIDTH = 260;
const TOPIC_MIN_WIDTH = 124;
const TOPIC_MAX_WIDTH = 320;

type WorkNode = MindmapNode & {
  _h?: number;
  _x?: number;
  _y?: number;
  _w?: number;
  _depth?: number;
};

function textUnits(text: string): number {
  return Array.from(text).reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 1 : 0.56), 0);
}

function estimateNodeWidth(node: MindmapNode): number {
  const base = node.kind === "topic" ? 38 : 28;
  const label = node.kind === "ai_question" || node.kind === "user_question" || node.kind === "ai_answer" ? 42 : 0;
  const min = node.kind === "topic" ? TOPIC_MIN_WIDTH : MIN_NODE_WIDTH;
  const max = node.kind === "topic" ? TOPIC_MAX_WIDTH : MAX_NODE_WIDTH;
  return Math.min(max, Math.max(min, base + label + textUnits(node.text) * 14));
}

function collectDepthWidths(node: WorkNode, depth: number, collapsedIds: Set<string>, widths: number[]) {
  node._w = estimateNodeWidth(node);
  widths[depth] = Math.max(widths[depth] ?? 0, node._w);
  if (collapsedIds.has(node.id)) return;
  node.children.forEach((child) => collectDepthWidths(child as WorkNode, depth + 1, collapsedIds, widths));
}

function measure(node: WorkNode, collapsedIds: Set<string>): number {
  if (collapsedIds.has(node.id) || node.children.length === 0) {
    node._h = ROW;
    return ROW;
  }
  let height = 0;
  node.children.forEach((child) => {
    height += measure(child as WorkNode, collapsedIds);
  });
  node._h = height;
  return height;
}

function place(node: WorkNode, depth: number, top: number, collapsedIds: Set<string>, xOffsets: number[]) {
  node._depth = depth;
  node._x = xOffsets[depth] ?? depth * 300;
  if (collapsedIds.has(node.id) || node.children.length === 0) {
    node._y = top + (node._h ?? ROW) / 2;
    return;
  }
  let childTop = top;
  node.children.forEach((child) => {
    const workChild = child as WorkNode;
    place(workChild, depth + 1, childTop, collapsedIds, xOffsets);
    childTop += workChild._h ?? ROW;
  });
  const first = node.children[0] as WorkNode;
  const last = node.children[node.children.length - 1] as WorkNode;
  node._y = ((first._y ?? 0) + (last._y ?? 0)) / 2;
}

export function layoutMindmap(root: MindmapNode, collapsedIds: Set<string> = new Set()): LayoutResult {
  const workRoot = root as WorkNode;
  const depthWidths: number[] = [];
  collectDepthWidths(workRoot, 0, collapsedIds, depthWidths);
  const xOffsets = depthWidths.reduce<number[]>((offsets, width, depth) => {
    if (depth === 0) return [0];
    const prevWidth = depthWidths[depth - 1] ?? MAX_NODE_WIDTH;
    const prevX = offsets[depth - 1] ?? 0;
    offsets[depth] = prevX + prevWidth / 2 + width / 2 + HGAP;
    return offsets;
  }, []);

  workRoot._x = 0;
  workRoot._y = 0;
  workRoot._depth = 0;

  let totalHeight = 0;
  root.children.forEach((child) => {
    totalHeight += measure(child as WorkNode, collapsedIds);
  });

  let childTop = -totalHeight / 2;
  root.children.forEach((child) => {
    const workChild = child as WorkNode;
    place(workChild, 1, childTop, collapsedIds, xOffsets);
    childTop += workChild._h ?? ROW;
  });

  const nodes = new Map<string, LayoutNode>();
  const edges: LayoutEdge[] = [];

  const collect = (node: WorkNode) => {
    const current: LayoutNode = {
      id: node.id,
      x: node._x ?? 0,
      y: node._y ?? 0,
      width: node._w ?? estimateNodeWidth(node),
      depth: node._depth ?? 0,
      subtreeHeight: node._h ?? ROW
    };
    nodes.set(node.id, current);
    if (collapsedIds.has(node.id)) return;
    node.children.forEach((child) => {
      collect(child as WorkNode);
      const target = nodes.get(child.id);
      if (target) edges.push({ from: current, to: target });
    });
  };

  collect(workRoot);
  return { nodes, edges };
}
