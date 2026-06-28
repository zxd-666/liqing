import { describe, expect, it } from "vitest";
import { normalizeMindmap, normalizeRespond } from "./schema.js";

describe("server schema normalization", () => {
  it("normalizes a mindmap and forces root kind", () => {
    const mindmap = normalizeMindmap({
      type: "decision",
      root: {
        text: "我要不要离职",
        children: [{ text: "成长空间", children: [] }]
      }
    });
    expect(mindmap.root.kind).toBe("topic");
    expect(mindmap.root.children[0].kind).toBe("node");
    expect(mindmap.root.children[0].id).toBeTruthy();
  });

  it("normalizes responses as mindmap nodes", () => {
    const result = normalizeRespond({
      judged: "question",
      nodes: [{ text: "我该怎么判断？", children: [{ text: "先列变量" }] }]
    });
    expect(result.nodes[0].kind).toBe("node");
    expect(result.nodes[0].children[0].kind).toBe("node");
  });
});
