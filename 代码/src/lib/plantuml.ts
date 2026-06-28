import type { MindmapNode } from "./types";

export function toPlantUML(root: MindmapNode): string {
  const lines = ["@startmindmap"];
  const walk = (node: MindmapNode, depth: number) => {
    lines.push(`${"*".repeat(depth)} ${node.text.replace(/\n/g, " ")}`);
    node.children.forEach((child) => walk(child, depth + 1));
  };
  walk(root, 1);
  lines.push("@endmindmap");
  return lines.join("\n");
}
