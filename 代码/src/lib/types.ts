export type MindmapType = "decision" | "cause" | "concept" | "plan";

export type NodeKind =
  | "topic"
  | "node"
  | "ai_question"
  | "user_question"
  | "ai_answer";

export type MindmapNode = {
  id: string;
  text: string;
  kind: NodeKind;
  children: MindmapNode[];
};

export type Mindmap = {
  type: MindmapType;
  root: MindmapNode;
};

export type ChatEntry = {
  id: string;
  role: "user" | "ai" | "thinking" | "system";
  title?: string;
  text: string;
  steps?: string[];
};

export type MindmapRecord = {
  id: string;
  title: string;
  type: MindmapType;
  topic: string;
  mindmap: Mindmap;
  chatEntries: ChatEntry[];
  createdAt: string;
  updatedAt: string;
};

export type ExpandMode = "dig" | "ask";
export type MessageJudgement = "question" | "supplement";

export const TYPE_LABELS: Record<MindmapType, string> = {
  decision: "决策",
  cause: "找根因",
  concept: "搞懂概念",
  plan: "做规划"
};

export const TYPE_HINTS: Record<MindmapType, string[]> = {
  decision: ["支持理由", "反对理由", "风险", "真正想要的"],
  cause: ["表面现象", "可能原因", "最可疑根因", "如何验证"],
  concept: ["是什么", "为什么存在", "怎么运作", "常见误区"],
  plan: ["目标", "关键步骤", "资源", "风险点"]
};
