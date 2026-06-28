import { describe, expect, it } from "vitest";
import { layoutMindmap, ROW } from "./layout";
import type { MindmapNode } from "./types";

const tree: MindmapNode = {
  id: "root",
  text: "主题",
  kind: "topic",
  children: [
    { id: "a", text: "A", kind: "node", children: [] },
    {
      id: "b",
      text: "B",
      kind: "node",
      children: [
        { id: "b1", text: "B1", kind: "node", children: [] },
        { id: "b2", text: "B2", kind: "node", children: [] }
      ]
    }
  ]
};

describe("layoutMindmap", () => {
  it("places nodes as a right-expanding tree", () => {
    const layout = layoutMindmap(tree);
    expect(layout.nodes.get("root")?.x).toBe(0);
    expect(layout.nodes.get("a")?.x).toBeGreaterThan(0);
    expect(layout.nodes.get("b1")?.x).toBeGreaterThan(layout.nodes.get("b")?.x ?? 0);
    expect(layout.edges).toHaveLength(4);
  });

  it("treats collapsed subtrees as one row", () => {
    const layout = layoutMindmap(tree, new Set(["b"]));
    expect(layout.nodes.has("b1")).toBe(false);
    expect(layout.nodes.get("b")?.subtreeHeight).toBe(ROW);
  });
});
