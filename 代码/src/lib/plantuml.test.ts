import { describe, expect, it } from "vitest";
import { toPlantUML } from "./plantuml";

describe("toPlantUML", () => {
  it("serializes nodes with mindmap star depth", () => {
    const code = toPlantUML({
      id: "r",
      text: "主题",
      kind: "topic",
      children: [{ id: "c", text: "分支", kind: "node", children: [] }]
    });
    expect(code).toContain("@startmindmap");
    expect(code).toContain("* 主题");
    expect(code).toContain("** 分支");
    expect(code).toContain("@endmindmap");
  });
});
