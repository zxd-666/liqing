import { describe, expect, it } from "vitest";
import { isRecordLike, sortRecords, titleForRecord } from "./records";
import type { Mindmap, MindmapRecord } from "./types";

const mindmap: Mindmap = {
  type: "plan",
  root: {
    id: "root",
    kind: "topic",
    text: "我要不要离职",
    children: []
  }
};

function record(id: string, updatedAt: string): MindmapRecord {
  return {
    id,
    title: id,
    type: "plan",
    topic: id,
    mindmap,
    chatEntries: [],
    createdAt: "2026-06-28T08:00:00.000Z",
    updatedAt
  };
}

describe("records", () => {
  it("sorts records by last updated time descending", () => {
    const sorted = sortRecords([
      record("old", "2026-06-28T09:00:00.000Z"),
      record("new", "2026-06-28T11:00:00.000Z"),
      record("middle", "2026-06-28T10:00:00.000Z")
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["new", "middle", "old"]);
  });

  it("filters out incomplete records", () => {
    expect(isRecordLike(record("ok", "2026-06-28T09:00:00.000Z"))).toBe(true);
    expect(isRecordLike({ id: "bad", topic: "bad" })).toBe(false);
  });

  it("uses root text as the record title first", () => {
    expect(titleForRecord("换工作", mindmap)).toBe("我要不要离职");
    expect(titleForRecord("", mindmap)).toBe("我要不要离职");
  });
});
