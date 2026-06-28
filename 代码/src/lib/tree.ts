import type { MindmapNode, NodeKind } from "./types";

export function createNode(text: string, kind: NodeKind = "node"): MindmapNode {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    text,
    kind,
    children: []
  };
}

export function walkNodes(root: MindmapNode, visitor: (node: MindmapNode, depth: number) => void) {
  const walk = (node: MindmapNode, depth: number) => {
    visitor(node, depth);
    node.children.forEach((child) => walk(child, depth + 1));
  };
  walk(root, 0);
}

export function visibleNodes(root: MindmapNode, collapsedIds: Set<string>): MindmapNode[] {
  const nodes: MindmapNode[] = [];
  const walk = (node: MindmapNode) => {
    nodes.push(node);
    if (!collapsedIds.has(node.id)) node.children.forEach(walk);
  };
  walk(root);
  return nodes;
}

export function findNode(root: MindmapNode, id: string): MindmapNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function updateNode(
  root: MindmapNode,
  id: string,
  updater: (node: MindmapNode) => MindmapNode
): MindmapNode {
  if (root.id === id) return updater(root);
  return {
    ...root,
    children: root.children.map((child) => updateNode(child, id, updater))
  };
}

export function removeNode(root: MindmapNode, id: string): MindmapNode {
  return {
    ...root,
    children: root.children
      .filter((child) => child.id !== id)
      .map((child) => removeNode(child, id))
  };
}

export function pathToNode(root: MindmapNode, id: string): string[] {
  const path: string[] = [];
  const walk = (node: MindmapNode): boolean => {
    path.push(node.text);
    if (node.id === id) return true;
    for (const child of node.children) {
      if (walk(child)) return true;
    }
    path.pop();
    return false;
  };
  return walk(root) ? path : [root.text];
}
