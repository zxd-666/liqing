import type { MindmapNode } from "./types";

export type LayoutNode = {
  id: string;
  x: number;
  y: number;
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

export const ROW = 74;
export const HGAP = 300;

type WorkNode = MindmapNode & {
  _h?: number;
  _x?: number;
  _y?: number;
  _depth?: number;
};

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

function place(node: WorkNode, depth: number, top: number, collapsedIds: Set<string>) {
  node._depth = depth;
  node._x = depth * HGAP;
  if (collapsedIds.has(node.id) || node.children.length === 0) {
    node._y = top + (node._h ?? ROW) / 2;
    return;
  }
  let childTop = top;
  node.children.forEach((child) => {
    const workChild = child as WorkNode;
    place(workChild, depth + 1, childTop, collapsedIds);
    childTop += workChild._h ?? ROW;
  });
  const first = node.children[0] as WorkNode;
  const last = node.children[node.children.length - 1] as WorkNode;
  node._y = ((first._y ?? 0) + (last._y ?? 0)) / 2;
}

export function layoutMindmap(root: MindmapNode, collapsedIds: Set<string> = new Set()): LayoutResult {
  const workRoot = root as WorkNode;
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
    place(workChild, 1, childTop, collapsedIds);
    childTop += workChild._h ?? ROW;
  });

  const nodes = new Map<string, LayoutNode>();
  const edges: LayoutEdge[] = [];

  const collect = (node: WorkNode) => {
    const current: LayoutNode = {
      id: node.id,
      x: node._x ?? 0,
      y: node._y ?? 0,
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
