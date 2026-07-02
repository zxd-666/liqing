import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { expandNode, generateMindmap, respondToNode } from "./lib/api";
import { layoutMindmap } from "./lib/layout";
import { toPlantUML } from "./lib/plantuml";
import { formatRecordTime, loadActiveRecordId, loadRecords, saveActiveRecordId, saveRecords, sortRecords, titleForRecord } from "./lib/records";
import type { ChatEntry, Mindmap, MindmapNode, MindmapRecord, MindmapType } from "./lib/types";
import { TYPE_LABELS } from "./lib/types";
import { createNode, findNode, pathToNode, removeNode, updateNode, visibleNodes, walkNodes } from "./lib/tree";

type ViewState = { x: number; y: number; s: number };
type Toast = { id: number; text: string };
type SelectionBox = { startX: number; startY: number; currentX: number; currentY: number };

const mindmapTypes: MindmapType[] = ["decision", "cause", "concept", "plan"];
const DEFAULT_ROOT_OFFSET_X = -600;

export default function App() {
  const [mindmap, setMindmap] = useState<Mindmap | null>(null);
  const [topic, setTopic] = useState("");
  const [heroText, setHeroText] = useState("");
  const [heroType, setHeroType] = useState<MindmapType | null>(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [dockText, setDockText] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, s: 1 });
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [loadingText, setLoadingText] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [focusedAddTarget, setFocusedAddTarget] = useState<string | null>(null);
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([]);
  const [records, setRecords] = useState<MindmapRecord[]>(() => loadRecords());
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [deleteConfirmRecord, setDeleteConfirmRecord] = useState<MindmapRecord | null>(null);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [isViewAnimating, setIsViewAnimating] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dockInputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const selectEditTextRef = useRef<string | null>(null);
  const shouldFitOnMindmapChangeRef = useRef(false);
  const activeRequestRef = useRef<AbortController | null>(null);
  const viewRef = useRef<ViewState>({ x: 0, y: 0, s: 1 });
  const pendingFocusNodeRef = useRef<string | null>(null);
  const suppressCanvasClickRef = useRef(false);
  const selectionBoxRef = useRef<SelectionBox | null>(null);

  const root = mindmap?.root ?? null;
  const layout = useMemo(() => (root ? layoutMindmap(root, collapsedIds) : null), [root, collapsedIds]);
  const nodes = useMemo(() => (root ? visibleNodes(root, collapsedIds) : []), [root, collapsedIds]);
  const selected = root && selectedId ? findNode(root, selectedId) : null;
  const selectedLayout = selectedId ? layout?.nodes.get(selectedId) : null;
  const multiSelectedCount = multiSelectedIds.size;

  const flash = useCallback((text: string) => {
    const id = Date.now();
    setToast({ id, text });
    window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 2200);
  }, []);

  const addChat = useCallback((entry: Omit<ChatEntry, "id">) => {
    setChatEntries((current) => [...current, { ...entry, id: crypto.randomUUID() }]);
  }, []);

  const applyView = useCallback((next: ViewState, commit = true) => {
    viewRef.current = next;
    if (worldRef.current) {
      worldRef.current.style.transform = viewTransform(next);
    }
    if (commit) setView(next);
  }, []);

  const animateViewTo = useCallback((next: ViewState) => {
    setIsViewAnimating(true);
    applyView(next);
    window.setTimeout(() => setIsViewAnimating(false), 320);
  }, [applyView]);

  const cancelAiRequest = useCallback(() => {
    if (!activeRequestRef.current) return;
    activeRequestRef.current.abort();
    activeRequestRef.current = null;
    addChat({
      role: "system",
      title: "已取消",
      text: loadingText ? `已停止「${loadingText}」。` : "已停止当前 AI 请求。"
    });
    setLoadingText("");
    flash("已取消");
  }, [addChat, flash, loadingText]);

  useEffect(() => {
    chatListRef.current?.scrollTo({ top: chatListRef.current.scrollHeight, behavior: "smooth" });
  }, [chatEntries, loadingText]);

  useEffect(() => {
    const recordId = loadActiveRecordId();
    if (!recordId) return;
    const record = records.find((item) => item.id === recordId);
    if (!record) {
      saveActiveRecordId(null);
      return;
    }
    shouldFitOnMindmapChangeRef.current = true;
    setActiveRecordId(record.id);
    setMindmap(record.mindmap);
    setTopic(record.topic);
    setHeroText(record.topic);
    setHeroType(record.type);
    setChatEntries(record.chatEntries ?? []);
    setSelectedId(null);
    setMultiSelectedIds(new Set());
    setCollapsedIds(new Set());
    setView({ x: 0, y: 0, s: 1 });
    setFocusedAddTarget(null);
    setFocusMode(true);
  }, []);

  useEffect(() => {
    saveActiveRecordId(activeRecordId);
  }, [activeRecordId]);

  useEffect(() => {
    if (!mindmap || !topic || !activeRecordId) return;
    const now = new Date().toISOString();
    setRecords((current) => {
      const existing = current.find((record) => record.id === activeRecordId);
      const record: MindmapRecord = {
        id: activeRecordId,
        title: titleForRecord(topic, mindmap),
        type: mindmap.type,
        topic,
        mindmap,
        chatEntries,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
      const next = sortRecords([record, ...current.filter((item) => item.id !== activeRecordId)]);
      saveRecords(next);
      return next;
    });
  }, [activeRecordId, chatEntries, mindmap, topic]);

  const applyMindmap = useCallback((next: Mindmap, nextTopic: string, recordId?: string) => {
    shouldFitOnMindmapChangeRef.current = true;
    setActiveRecordId(recordId ?? activeRecordId ?? crypto.randomUUID());
    setMindmap(next);
    setTopic(nextTopic);
    setSelectedId(null);
    setMultiSelectedIds(new Set());
    setCollapsedIds(new Set());
    setFocusMode(true);
  }, [activeRecordId]);

  const runGenerate = useCallback(
    async (text: string, forcedType?: MindmapType) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (activeRequestRef.current) {
        flash("AI 正在处理，先取消当前任务");
        return;
      }
      const controller = new AbortController();
      activeRequestRef.current = controller;
      setLoadingText(webSearchEnabled ? "联网搜索中…" : forcedType ? "AI 理清中" : "正在理清…");
      addChat({
        role: "user",
        text: [
          forcedType ? `按「${TYPE_LABELS[forcedType]}」重新理清：${trimmed}` : trimmed,
          webSearchEnabled ? "已开启联网搜索" : ""
        ].filter(Boolean).join("\n")
      });
      addChat({
        role: "thinking",
        title: webSearchEnabled ? "AI 联网整理中" : forcedType ? "AI 重新整理中" : "AI 正在理清",
        text: webSearchEnabled ? "我会先联网搜索，再把可参考的信息整理进脑图。" : "我会先判断问题类型，再拆出一张可俯瞰的脑图。",
        steps: [
          webSearchEnabled ? "联网搜索相关资料" : "",
          forcedType ? `采用你指定的类型：${TYPE_LABELS[forcedType]}` : "判断属于决策 / 找根因 / 概念 / 规划中的哪一类",
          "提取中心主题和一级结构",
          "补齐关键分支，控制节点为短句"
        ].filter(Boolean)
      });
      try {
        const next = await generateMindmap(trimmed, forcedType, webSearchEnabled, controller.signal);
        applyMindmap(next, trimmed);
        addChat({
          role: "ai",
          title: `已生成「${TYPE_LABELS[next.type]}」脑图`,
          text: `我已${webSearchEnabled ? "结合搜索结果" : ""}把「${trimmed}」整理成 ${next.root.children.length} 个主分支。你可以点右侧任意节点深挖、追问或补充。`
        });
      } catch (err) {
        if (isAbortError(err)) return;
        flash(err instanceof Error ? err.message : "生成失败，请稍后再试");
        addChat({
          role: "system",
          title: "生成失败",
          text: err instanceof Error ? err.message : "生成失败，请稍后再试"
        });
      } finally {
        if (activeRequestRef.current === controller) activeRequestRef.current = null;
        setLoadingText("");
      }
    },
    [addChat, applyMindmap, flash, webSearchEnabled]
  );

  const regenerate = useCallback(
    async (forcedType?: MindmapType) => {
      if (!topic) return;
      await runGenerate(topic, forcedType);
    },
    [runGenerate, topic]
  );

  function startBlankMindmap(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const next: Mindmap = {
      type: heroType ?? "concept",
      root: createNode(trimmed, "topic")
    };
    applyMindmap(next, trimmed);
    setChatEntries([
      {
        id: crypto.randomUUID(),
        role: "system",
        title: "手动创建脑图",
        text: `已将「${trimmed}」作为中心主题。你可以选中节点后按 Tab 或点“补充”继续完善。`
      }
    ]);
  }

  const fit = useCallback(() => {
    if (!layout || nodes.length === 0) return;
    let minY = Infinity;
    let maxY = -Infinity;
    nodes.forEach((node) => {
      const point = layout.nodes.get(node.id);
      if (!point) return;
      minY = Math.min(minY, point.y - 42);
      maxY = Math.max(maxY, point.y + 42);
    });
    const scale = 1;
    animateViewTo({
      s: scale,
      x: DEFAULT_ROOT_OFFSET_X,
      y: -((minY + maxY) / 2) * scale + 6
    });
  }, [animateViewTo, layout, nodes]);

  useEffect(() => {
    if (!mindmap || !shouldFitOnMindmapChangeRef.current) return;
    shouldFitOnMindmapChangeRef.current = false;
    requestAnimationFrame(fit);
  }, [mindmap]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const focusNodeInView = useCallback((nodeId: string) => {
    const point = layout?.nodes.get(nodeId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!point || !rect) return;
    const scale = viewRef.current.s;
    animateViewTo({
      s: scale,
      x: rect.width * 0.12 - point.x * scale,
      y: -point.y * scale
    });
  }, [animateViewTo, layout]);

  const idsInSelectionBox = useCallback((box: SelectionBox) => {
    const left = Math.min(box.startX, box.currentX);
    const right = Math.max(box.startX, box.currentX);
    const top = Math.min(box.startY, box.currentY);
    const bottom = Math.max(box.startY, box.currentY);
    const next = new Set<string>();
    nodes.forEach((node) => {
      if (node.kind === "topic") return;
      const el = nodeRefs.current[node.id];
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.right >= left && rect.left <= right && rect.bottom >= top && rect.top <= bottom) {
        next.add(node.id);
      }
    });
    return next;
  }, [nodes]);

  useEffect(() => {
    const nodeId = pendingFocusNodeRef.current;
    if (!nodeId || !layout?.nodes.has(nodeId)) return;
    pendingFocusNodeRef.current = null;
    requestAnimationFrame(() => focusNodeInView(nodeId));
  }, [focusNodeInView, layout]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!selectionBox) return;
      const currentBox = selectionBoxRef.current ?? selectionBox;
      const nextBox = { ...currentBox, currentX: event.clientX, currentY: event.clientY };
      selectionBoxRef.current = nextBox;
      setSelectionBox(nextBox);
      const nextIds = idsInSelectionBox(nextBox);
      setMultiSelectedIds(nextIds);
      setSelectedId(null);
    };
    const onUp = () => {
      if (!selectionBox) return;
      const finalBox = selectionBoxRef.current ?? selectionBox;
      const distance = Math.hypot(finalBox.currentX - finalBox.startX, finalBox.currentY - finalBox.startY);
      const nextIds = distance < 4 ? new Set<string>() : idsInSelectionBox(finalBox);
      if (nextIds.size === 1) {
        setSelectedId([...nextIds][0]);
        setMultiSelectedIds(new Set());
      } else {
        setMultiSelectedIds(nextIds);
        setSelectedId(null);
      }
      suppressCanvasClickRef.current = true;
      selectionBoxRef.current = null;
      setSelectionBox(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [idsInSelectionBox, selectionBox]);

  const selectedScreen = useMemo(() => {
    if (!selectedLayout || !canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 + view.x + selectedLayout.x * view.s,
      y: rect.top + rect.height / 2 + view.y + selectedLayout.y * view.s
    };
  }, [selectedLayout, view]);

  const multiActionbarScreen = useMemo(() => {
    if (multiSelectedIds.size < 2) return null;
    const rects = [...multiSelectedIds]
      .map((id) => nodeRefs.current[id]?.getBoundingClientRect())
      .filter((rect): rect is DOMRect => Boolean(rect));
    if (rects.length === 0) return null;
    const left = Math.min(...rects.map((rect) => rect.left));
    const right = Math.max(...rects.map((rect) => rect.right));
    const top = Math.min(...rects.map((rect) => rect.top));
    return { x: (left + right) / 2, y: top };
  }, [multiSelectedIds, view]);

  function appendChildren(targetId: string, children: MindmapNode[]) {
    const lastChild = children.at(-1);
    if (lastChild) pendingFocusNodeRef.current = lastChild.id;
    setMindmap((current) => {
      if (!current) return current;
      return {
        ...current,
        root: updateNode(current.root, targetId, (node) => ({
          ...node,
          children: [...node.children, ...children]
        }))
      };
    });
    setCollapsedIds((current) => {
      const next = new Set(current);
      next.delete(targetId);
      return next;
    });
  }

  async function handleExpand(mode: "dig" | "ask") {
    if (!mindmap || !selected) return;
    if (activeRequestRef.current) {
      flash("AI 正在处理，先取消当前任务");
      return;
    }
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setLoadingText(mode === "dig" ? "正在深挖…" : "正在追问…");
    addChat({
      role: "thinking",
      title: mode === "dig" ? `深挖「${selected.text}」` : `围绕「${selected.text}」追问`,
      text: mode === "dig" ? "我会把这个节点继续拆小，补成可行动/可判断的子分支。" : "我会提出一个能推动你继续想清楚的问题。",
      steps: [
        `读取路径：${pathToNode(mindmap.root, selected.id).join(" > ")}`,
        mode === "dig" ? "寻找更细的影响因素和下一层结构" : "寻找当前节点最值得确认的关键变量",
        "把结果追加到右侧脑图"
      ]
    });
    try {
      const targetPath = pathToNode(mindmap.root, selected.id);
      const result = await expandNode(mindmap, targetPath, mode, controller.signal);
      appendChildren(selected.id, result.children);
      addChat({
        role: "ai",
        title: mode === "dig" ? "已完成深挖" : "已生成追问",
        text: `我已在「${selected.text}」下新增 ${result.children.length} 个节点。`
      });
    } catch (err) {
      if (isAbortError(err)) return;
      flash(err instanceof Error ? err.message : "操作失败，请稍后再试");
      addChat({
        role: "system",
        title: "操作失败",
        text: err instanceof Error ? err.message : "操作失败，请稍后再试"
      });
    } finally {
      if (activeRequestRef.current === controller) activeRequestRef.current = null;
      setLoadingText("");
    }
  }

  function addManualChild() {
    if (!selected) return;
    const child = createNode("新补充");
    appendChildren(selected.id, [child]);
    setSelectedId(child.id);
    setEditingId(child.id);
    setEditingText(child.text);
    selectEditTextRef.current = child.id;
    setFocusedAddTarget(null);
    addChat({
      role: "system",
      title: "手动补充节点",
      text: `已在「${selected.text}」下新增子节点，可直接在右侧脑图中改名。`
    });
    flash("已新增子节点，可直接编辑内容");
  }

  const deleteSelected = useCallback(() => {
    if (!mindmap || !selected) return;
    if (selected.kind === "topic") {
      flash("中心主题不能删除");
      return;
    }
    setMindmap({ ...mindmap, root: removeNode(mindmap.root, selected.id) });
    addChat({
      role: "system",
      title: "已删除节点",
      text: `已从脑图中删除「${selected.text}」。`
    });
    setSelectedId(null);
  }, [addChat, flash, mindmap, selected]);

  const deleteMultiSelected = useCallback(() => {
    if (!mindmap || multiSelectedIds.size === 0) return;
    let nextRoot = mindmap.root;
    const labels: string[] = [];
    multiSelectedIds.forEach((id) => {
      const node = findNode(nextRoot, id);
      if (!node || node.kind === "topic") return;
      labels.push(node.text);
      nextRoot = removeNode(nextRoot, id);
    });
    if (labels.length === 0) return;
    setMindmap({ ...mindmap, root: nextRoot });
    setMultiSelectedIds(new Set());
    setSelectedId(null);
    addChat({
      role: "system",
      title: "已批量删除节点",
      text: `已从脑图中删除 ${labels.length} 个节点。`
    });
  }, [addChat, mindmap, multiSelectedIds]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (multiSelectedIds.size > 0 && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        deleteMultiSelected();
        return;
      }
      if (!selected) return;
      if (event.key === "Tab") {
        event.preventDefault();
        addManualChild();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addManualChild, deleteMultiSelected, deleteSelected, multiSelectedIds, selected]);

  async function submitDockText() {
    const text = dockText.trim();
    if (!text || !mindmap) return;
    const target = selected || (focusedAddTarget ? findNode(mindmap.root, focusedAddTarget) : null);
    if (target && activeRequestRef.current) {
      flash("AI 正在处理，先取消当前任务");
      return;
    }
    setDockText("");
    addChat({
      role: "user",
      title: target ? `针对「${target.text}」` : "追加新分支",
      text
    });
    if (!target) {
      const branch = createNode(text);
      setMindmap({ ...mindmap, root: { ...mindmap.root, children: [...mindmap.root.children, branch] } });
      addChat({
        role: "ai",
        title: "已追加分支",
        text: `我已把「${text}」作为新的一级分支加入脑图。`
      });
      return;
    }
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setLoadingText("AI 正在完善脑图…");
    addChat({
      role: "thinking",
      title: "AI 正在完善选中节点",
      text: "我会理解你的输入，并把回答整理成可直接加入脑图的子节点。",
      steps: [
        `目标节点：${target.text}`,
        "理解你的补充或问题",
        "提炼答案里的关键结论、变量或行动项",
        "把结果追加到目标节点下"
      ]
    });
    try {
      const targetPath = pathToNode(mindmap.root, target.id);
      const result = await respondToNode(mindmap, targetPath, text, controller.signal);
      appendChildren(target.id, result.nodes);
      flash("AI 已完善该节点");
      addChat({
        role: "ai",
        title: result.judged === "question" ? "已根据问题完善脑图" : "已根据补充完善脑图",
        text: `我已把内容整理成 ${result.nodes.length} 个子节点，追加到「${target.text}」下。`
      });
    } catch (err) {
      if (isAbortError(err)) return;
      flash(err instanceof Error ? err.message : "提交失败，请稍后再试");
      addChat({
        role: "system",
        title: "提交失败",
        text: err instanceof Error ? err.message : "提交失败，请稍后再试"
      });
    } finally {
      if (activeRequestRef.current === controller) activeRequestRef.current = null;
      setLoadingText("");
      setFocusedAddTarget(null);
    }
  }

  function commitEdit(id: string) {
    const nextText = editingText.trim();
    if (!mindmap) return;
    if (nextText) {
      setMindmap({ ...mindmap, root: updateNode(mindmap.root, id, (node) => ({ ...node, text: nextText })) });
    }
    setEditingId(null);
    setEditingText("");
  }

  function copyPlantUML() {
    if (!mindmap) return;
    const code = toPlantUML(mindmap.root);
    navigator.clipboard
      ?.writeText(code)
      .then(() => flash("已复制 PlantUML 代码"))
      .catch(() => flash("复制失败，请检查浏览器剪贴板权限"));
  }

  function exportImage() {
    if (!mindmap || !layout) return;
    const shownNodes = nodes;
    const metas = shownNodes.map((node) => {
      const point = layout.nodes.get(node.id)!;
      const card = nodeRefs.current[node.id]?.querySelector(".card") as HTMLElement | null;
      const width = card ? card.getBoundingClientRect().width / view.s : 140;
      const height = card ? card.getBoundingClientRect().height / view.s : 42;
      const style = card ? getComputedStyle(card) : null;
      return {
        node,
        point,
        x: point.x - width / 2,
        y: point.y - height / 2,
        width,
        height,
        bg: style?.backgroundColor || "#fff",
        border: style?.borderTopColor || "#e3e4e8",
        color: style?.color || "#1c1d1f",
        weight: style && Number(style.fontWeight) >= 600 ? "600" : "400",
        size: style ? Number.parseFloat(style.fontSize) : 13.5
      };
    });
    const minX = Math.min(...metas.map((m) => m.x));
    const minY = Math.min(...metas.map((m) => m.y));
    const maxX = Math.max(...metas.map((m) => m.x + m.width));
    const maxY = Math.max(...metas.map((m) => m.y + m.height));
    const pad = 44;
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((maxX - minX + pad * 2) * scale);
    canvas.height = Math.round((maxY - minY + pad * 2) * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.translate(-minX + pad, -minY + pad);
    ctx.fillStyle = "#fff";
    ctx.fillRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
    ctx.strokeStyle = "#c9cbd1";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    layout.edges.forEach((edge) => {
      drawElbowEdge(ctx, edge.from.x, edge.from.y, edge.to.x, edge.to.y);
      ctx.stroke();
    });
    metas.forEach((meta) => {
      roundRect(ctx, meta.x, meta.y, meta.width, meta.height, meta.node.kind === "topic" ? 14 : 12);
      ctx.fillStyle = meta.bg;
      ctx.fill();
      ctx.strokeStyle = meta.border;
      ctx.stroke();
      const label = labelForKind(meta.node.kind);
      ctx.fillStyle = meta.color;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const padX = meta.node.kind === "topic" ? 18 : 13;
      if (label) {
        ctx.globalAlpha = 0.68;
        ctx.font = `10px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
        ctx.fillText(label, meta.x + padX, meta.y + meta.height * 0.33);
        ctx.globalAlpha = 1;
        ctx.font = `${meta.weight} ${meta.size}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
        ctx.fillText(meta.node.text, meta.x + padX, meta.y + meta.height * 0.68);
      } else {
        ctx.font = `${meta.weight} ${meta.size}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
        ctx.fillText(meta.node.text, meta.x + padX, meta.y + meta.height / 2);
      }
    });
    const link = document.createElement("a");
    link.download = "理清-脑图.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    flash("已导出图片");
  }

  function reset() {
    setMindmap(null);
    setTopic("");
    setHeroText("");
    setHeroType(null);
    setDockText("");
    setSelectedId(null);
    setMultiSelectedIds(new Set());
    setCollapsedIds(new Set());
    setView({ x: 0, y: 0, s: 1 });
    setChatEntries([]);
    setFocusedAddTarget(null);
    setActiveRecordId(null);
  }

  function openRecord(record: MindmapRecord) {
    shouldFitOnMindmapChangeRef.current = true;
    setActiveRecordId(record.id);
    setMindmap(record.mindmap);
    setTopic(record.topic);
    setHeroText(record.topic);
    setHeroType(record.type);
    setChatEntries(record.chatEntries ?? []);
    setSelectedId(null);
    setMultiSelectedIds(new Set());
    setCollapsedIds(new Set());
    setView({ x: 0, y: 0, s: 1 });
    setFocusedAddTarget(null);
    setFocusMode(true);
    setRecordsOpen(false);
  }

  function deleteRecord(record: MindmapRecord) {
    setRecords((current) => {
      const next = current.filter((item) => item.id !== record.id);
      saveRecords(next);
      return next;
    });
    if (record.id === activeRecordId) {
      reset();
    }
    setDeleteConfirmRecord(null);
    flash("记录已删除");
  }

  function collapseAllNodes() {
    if (!root) return;
    const next = new Set<string>();
    walkNodes(root, (node) => {
      if (node.children.length > 0) next.add(node.id);
    });
    setCollapsedIds(next);
  }

  function expandAllNodes() {
    setCollapsedIds(new Set());
  }

  const worldStyle = {
    transform: viewTransform(view)
  };

  return (
    <>
      <div className={`topbar ${mindmap ? "" : "hidden"}`}>
        <button className="logo logo-button" onClick={reset}>
          <span className="logo-dot" />
          理清
        </button>
        {mindmap && (
          <div className="type-tag" onClick={(event) => { event.stopPropagation(); setTypeMenuOpen((v) => !v); }}>
            <span>{TYPE_LABELS[mindmap.type]}</span>
            <span className="caret">▼</span>
            <div className={`type-menu ${typeMenuOpen ? "open" : ""}`}>
              {mindmapTypes.map((type) => (
                <button
                  key={type}
                  className={type === mindmap.type ? "on" : ""}
                  onClick={(event) => {
                    event.stopPropagation();
                    setTypeMenuOpen(false);
                    if (type !== mindmap.type) void regenerate(type);
                  }}
                >
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="search-switch search-switch-top">
          <input
            type="checkbox"
            checked={webSearchEnabled}
            onChange={(event) => setWebSearchEnabled(event.target.checked)}
          />
          <span>联网搜索</span>
        </label>
        <div className="topic-text">{mindmap?.root.text ? `“${mindmap.root.text}”` : ""}</div>
        <div className="spacer" />
        <button className="tbtn" onClick={exportImage}>⬇ 导出图片</button>
        <button className="tbtn" onClick={copyPlantUML}>⧉ 复制 PlantUML</button>
        <button className="tbtn" disabled={Boolean(loadingText)} onClick={() => void regenerate()}>⟲ 重新生成</button>
        <button className="tbtn" onClick={() => setFocusMode((value) => !value)}>
          {focusMode ? "展开记录" : "专注脑图"}
        </button>
        <button className="tbtn" onClick={reset}>＋ 理清新事</button>
      </div>

      {mindmap && !focusMode && (
        <aside className="chat-panel">
          <div className="chat-head">
            <div>
              <div className="chat-title">共创记录</div>
              <div className="chat-subtitle">和 AI 一起完善右侧脑图</div>
            </div>
            <span className="chat-type">{TYPE_LABELS[mindmap.type]}</span>
          </div>

          <div className="chat-list" ref={chatListRef}>
            {chatEntries.map((entry) => (
              <div key={entry.id} className={`chat-entry ${entry.role}`}>
                <div className="chat-entry-head">
                  <span>{entry.role === "user" ? "你" : entry.role === "thinking" ? "AI 思考" : entry.role === "system" ? "系统" : "AI"}</span>
                  {entry.title && <b>{entry.title}</b>}
                </div>
                <div className="chat-entry-text">{entry.text}</div>
                {entry.steps && (
                  <ol className="thinking-steps">
                    {entry.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
            {loadingText && (
              <div className="chat-entry thinking active">
                <div className="chat-entry-head"><span>AI 思考</span><b>{loadingText}</b></div>
                <div className="mini-pulse"><span /><span /><span /></div>
              </div>
            )}
          </div>

          <div className="selected-context">
            {multiSelectedCount > 1 ? (
              <>
                已选择 <b>{multiSelectedCount} 个节点</b>
                <button onClick={() => setMultiSelectedIds(new Set())}>取消</button>
              </>
            ) : selected ? (
              <>
                当前节点 <b>{selected.text}</b>
                <button onClick={() => setSelectedId(null)}>取消</button>
              </>
            ) : (
              <>未选中节点，输入内容会手动追加为新的一级分支。</>
            )}
          </div>

          <div className="chat-composer">
            <textarea
              ref={dockInputRef}
              value={dockText}
              disabled={multiSelectedCount > 1}
              placeholder={multiSelectedCount > 1 ? "已多选节点，只能删除…" : selected ? "输入问题或补充，AI 会完善当前节点…" : "追加新分支，或换个角度继续理清…"}
              onChange={(event) => setDockText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submitDockText();
                }
              }}
            />
            <button className="send" disabled={multiSelectedCount > 1 || !dockText.trim()} onClick={() => void submitDockText()}>↑</button>
          </div>
        </aside>
      )}

      <div
        ref={canvasRef}
        className={`canvas ${mindmap && !focusMode ? "canvas-with-panel" : ""} ${selectionBox ? "selecting" : ""}`}
        onClick={() => {
          if (suppressCanvasClickRef.current) {
            suppressCanvasClickRef.current = false;
            return;
          }
          setSelectedId(null);
          setMultiSelectedIds(new Set());
        }}
        onMouseDown={(event) => {
          if ((event.target as HTMLElement).closest(".node")) return;
          if (event.button !== 0) return;
          setSelectedId(null);
          setMultiSelectedIds(new Set());
          const nextBox = {
            startX: event.clientX,
            startY: event.clientY,
            currentX: event.clientX,
            currentY: event.clientY
          };
          selectionBoxRef.current = nextBox;
          setSelectionBox(nextBox);
        }}
        onWheel={(event) => {
          event.preventDefault();
          const oldView = viewRef.current;
          if (event.ctrlKey || event.metaKey) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const cx = event.clientX - rect.left - rect.width / 2;
            const cy = event.clientY - rect.top - rect.height / 2;
            const old = oldView.s;
            const nextScale = Math.min(2.2, Math.max(0.35, old * (event.deltaY < 0 ? 1.1 : 0.9)));
            applyView({
              s: nextScale,
              x: cx - (cx - oldView.x) * (nextScale / old),
              y: cy - (cy - oldView.y) * (nextScale / old)
            });
            return;
          }
          applyView({
            ...oldView,
            x: oldView.x - event.deltaX,
            y: oldView.y - event.deltaY
          });
        }}
      >
        <div ref={worldRef} className={`world ${isViewAnimating ? "view-animated" : ""}`} style={worldStyle}>
          <svg className="edges">
            <g>
              {layout?.edges.map((edge) => {
                return (
                  <path
                    key={`${edge.from.id}-${edge.to.id}`}
                    className="edge show"
                    style={{ animationDelay: `${edge.to.depth * 70}ms` }}
                    d={elbowEdgePath(edge.from.x, edge.from.y, edge.to.x, edge.to.y)}
                  />
                );
              })}
            </g>
          </svg>
          <div className="nodes">
            {nodes.map((node) => {
              const point = layout?.nodes.get(node.id);
              if (!point) return null;
                  const isSelected = selectedId === node.id;
                  const isMultiSelected = multiSelectedIds.has(node.id);
              const hasKids = node.children.length > 0;
              const isCollapsed = collapsedIds.has(node.id);
              return (
                <div
                  key={node.id}
                  ref={(el) => { nodeRefs.current[node.id] = el; }}
                  className={[
                    "node",
                    "show",
                    node.kind,
                    point.depth === 1 ? "d1" : "",
                    isSelected ? "sel" : "",
                    isMultiSelected ? "multi-sel" : "",
                    editingId === node.id ? "editing" : "",
                    hasKids ? "haskids" : "",
                    isCollapsed ? "collapsed" : ""
                  ].filter(Boolean).join(" ")}
                  style={{ left: point.x, top: point.y, animationDelay: `${point.depth * 70}ms` }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (suppressCanvasClickRef.current) {
                      suppressCanvasClickRef.current = false;
                      return;
                    }
                    setMultiSelectedIds(new Set());
                    setSelectedId(node.id);
                  }}
                  onMouseDown={(event) => {
                    if (node.kind !== "topic" || editingId === node.id) return;
                    if ((event.target as HTMLElement).closest(".badge, input")) return;
                    event.stopPropagation();
                    setMultiSelectedIds(new Set());
                    setSelectedId(node.id);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    setEditingId(node.id);
                    setEditingText(node.text);
                  }}
                >
                  <div className="card">
                    {editingId === node.id ? (
                      <textarea
                        className="edit-input"
                        value={editingText}
                        autoFocus
                        rows={Math.min(6, Math.max(2, editingText.split("\n").length))}
                        onClick={(event) => event.stopPropagation()}
                        onFocus={(event) => {
                          if (selectEditTextRef.current === node.id) {
                            event.currentTarget.select();
                            selectEditTextRef.current = null;
                          }
                        }}
                        onChange={(event) => setEditingText(event.target.value)}
                        onBlur={() => commitEdit(node.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                            event.preventDefault();
                            commitEdit(node.id);
                          }
                          if (event.key === "Escape") {
                            setEditingId(null);
                            setEditingText("");
                          }
                        }}
                      />
                    ) : (
                      <>
                        <span className="node-label" title={node.text}>{node.text}</span>
                        {hasKids && (
                          <span
                            className={`badge ${isCollapsed ? "plus" : "minus"}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setCollapsedIds((current) => {
                                const next = new Set(current);
                                if (next.has(node.id)) next.delete(node.id);
                                else next.add(node.id);
                                return next;
                              });
                            }}
                          >
                            {isCollapsed ? "+" : "−"}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {selectionBox && <div className="selection-box" style={selectionBoxStyle(selectionBox)} />}
      </div>

      {multiSelectedCount > 1 && selectionBox === null && multiActionbarScreen && (
        <div className="actionbar show multi-actionbar" style={{ left: multiActionbarScreen.x, top: multiActionbarScreen.y - 14 }}>
          <button className="danger" onClick={deleteMultiSelected}>✕ 删除 {multiSelectedCount} 个</button>
        </div>
      )}

      {selected && selectedScreen && (
        <div className="actionbar show" style={{ left: selectedScreen.x, top: selectedScreen.y - 30 * view.s - 14 }}>
          <button disabled={Boolean(loadingText)} onClick={() => void handleExpand("dig")}>⤵ 深挖</button>
          <button disabled={Boolean(loadingText)} onClick={() => void handleExpand("ask")}>？ 追问</button>
          <button onClick={addManualChild}>＋ 补充</button>
          <span className="sep" />
          <button className="danger" onClick={deleteSelected}>✕ 删除</button>
        </div>
      )}

      {mindmap && focusMode && (
        <div className="mini-composer">
          <button className="mini-history" onClick={() => setFocusMode(false)}>共创记录</button>
          <div className="mini-context">
            {multiSelectedCount > 1 ? `已选择 ${multiSelectedCount} 个节点` : selected ? `针对：${selected.text}` : "追加新分支"}
          </div>
          <textarea
            value={dockText}
            disabled={multiSelectedCount > 1}
            placeholder={multiSelectedCount > 1 ? "已多选节点，只能删除…" : selected ? "输入问题或补充…" : "追加新分支…"}
            onChange={(event) => setDockText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submitDockText();
              }
            }}
          />
          <button className="send" disabled={multiSelectedCount > 1 || !dockText.trim()} onClick={() => void submitDockText()}>↑</button>
        </div>
      )}

      <div className={`zoomctl ${mindmap ? "show" : ""}`}>
        <button onClick={() => {
          const current = viewRef.current;
          animateViewTo({ ...current, s: Math.min(2.2, current.s * 1.15) });
        }}>＋</button>
        <button onClick={fit}>⊡</button>
        <button onClick={() => {
          const current = viewRef.current;
          animateViewTo({ ...current, s: Math.max(0.35, current.s * 0.87) });
        }}>－</button>
      </div>

      <div className={`treectl ${mindmap ? "show" : ""}`}>
        <button onClick={collapseAllNodes} title="收起全部节点" aria-label="收起全部节点">⊖</button>
        <button onClick={expandAllNodes} title="展开全部节点" aria-label="展开全部节点">⊕</button>
      </div>

      <div className={`hero ${mindmap ? "gone" : ""}`}>
        <div className="hero-logo">理清<span /></div>
        <div className="hero-sub">把一团模糊的事，一句话交给 AI，理成一张看得清的脑图</div>
        <div className="hero-workbench">
          <div className="hero-input-area">
            <div className="hero-input">
              <div className="dock-inner">
                <select
                  className="hero-type-select"
                  value={heroType ?? ""}
                  onChange={(event) => setHeroType(event.target.value ? event.target.value as MindmapType : null)}
                  aria-label="理清类型"
                >
                  <option value="">自动判断</option>
                  {mindmapTypes.map((type) => (
                    <option key={type} value={type}>{TYPE_LABELS[type]}</option>
                  ))}
                </select>
                <input
                  value={heroText}
                  autoFocus
                  placeholder="你想理清什么？"
                  onChange={(event) => setHeroText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void runGenerate(heroText, heroType || undefined);
                  }}
                />
                <button className="send hero-ai-send" disabled={!heroText.trim() || Boolean(loadingText)} onClick={() => void runGenerate(heroText, heroType || undefined)}>AI</button>
                <button className="hero-plus-send" disabled={!heroText.trim()} onClick={() => startBlankMindmap(heroText)}>＋</button>
              </div>
            </div>
            <div className="hero-tools">
              <label className="search-switch">
                <input
                  type="checkbox"
                  checked={webSearchEnabled}
                  onChange={(event) => setWebSearchEnabled(event.target.checked)}
                />
                <span>联网搜索</span>
              </label>
              <button className="records-entry" onClick={() => setRecordsOpen(true)}>
                理清记录
              </button>
            </div>
          </div>
        </div>
      </div>

      {recordsOpen && (
        <div className="records-modal" onClick={() => setRecordsOpen(false)}>
          <div className="records-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="records-head">
              <div>
                <div className="records-title">理清记录</div>
                <div className="records-subtitle">按最后更新时间倒序排列</div>
              </div>
              <button className="records-close" onClick={() => setRecordsOpen(false)} aria-label="关闭">×</button>
            </div>
            <div className="records-list">
              {records.length === 0 ? (
                <div className="records-empty">还没有记录。先理清一件事，这里会自动保存。</div>
              ) : (
                records.map((record) => (
                  <div key={record.id} className="record-row">
                    <button className="record-open" onClick={() => openRecord(record)}>
                      <span className="record-main">
                        <span className="record-title">{record.title}</span>
                        <span className="record-meta">{record.mindmap.root.children.length} 个主分支</span>
                      </span>
                      <span className="record-side">
                        <span className="record-type">{TYPE_LABELS[record.type]}</span>
                        <span className="record-time">{formatRecordTime(record.updatedAt)}</span>
                      </span>
                    </button>
                    <button
                      className="record-delete"
                      onClick={() => setDeleteConfirmRecord(record)}
                      aria-label={`删除记录：${record.title}`}
                    >
                      删除
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {deleteConfirmRecord && (
        <div className="confirm-modal" onClick={() => setDeleteConfirmRecord(null)}>
          <div className="confirm-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="confirm-title">删除这条理清记录？</div>
            <div className="confirm-text">
              删除后无法从本地记录中恢复。记录：{deleteConfirmRecord.title}
            </div>
            <div className="confirm-actions">
              <button onClick={() => setDeleteConfirmRecord(null)}>取消</button>
              <button className="danger" onClick={() => deleteRecord(deleteConfirmRecord)}>确认删除</button>
            </div>
          </div>
        </div>
      )}

      <div className={`loading ${loadingText ? "show" : ""}`}>
        <div className="pulse"><span /><span /><span /></div>
        <div className="txt">{loadingText}</div>
        <button className="loading-cancel" onClick={cancelAiRequest}>取消生成</button>
      </div>
      <div className={`toast ${toast ? "show" : ""}`}>{toast?.text}</div>
    </>
  );
}

function labelForKind(kind: MindmapNode["kind"]) {
  if (kind === "ai_question") return "AI 追问";
  if (kind === "user_question") return "你问";
  if (kind === "ai_answer") return "AI 答";
  return "";
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function elbowEdgePath(fromX: number, fromY: number, toX: number, toY: number) {
  const midX = fromX + Math.max(44, (toX - fromX) * 0.42);
  const radius = Math.min(12, Math.abs(toY - fromY) / 2, Math.abs(toX - fromX) / 4);
  if (Math.abs(toY - fromY) < 1) return `M${fromX},${fromY} H${toX}`;
  const yDir = toY > fromY ? 1 : -1;
  return [
    `M${fromX},${fromY}`,
    `H${midX - radius}`,
    `Q${midX},${fromY} ${midX},${fromY + radius * yDir}`,
    `V${toY - radius * yDir}`,
    `Q${midX},${toY} ${midX + radius},${toY}`,
    `H${toX}`
  ].join(" ");
}

function drawElbowEdge(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number) {
  const midX = fromX + Math.max(44, (toX - fromX) * 0.42);
  const radius = Math.min(12, Math.abs(toY - fromY) / 2, Math.abs(toX - fromX) / 4);
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  if (Math.abs(toY - fromY) < 1) {
    ctx.lineTo(toX, toY);
    return;
  }
  const yDir = toY > fromY ? 1 : -1;
  ctx.lineTo(midX - radius, fromY);
  ctx.quadraticCurveTo(midX, fromY, midX, fromY + radius * yDir);
  ctx.lineTo(midX, toY - radius * yDir);
  ctx.quadraticCurveTo(midX, toY, midX + radius, toY);
  ctx.lineTo(toX, toY);
}

function viewTransform(view: ViewState) {
  return `translate(${view.x}px, ${view.y}px) scale(${view.s})`;
}

function selectionBoxStyle(box: SelectionBox) {
  const left = Math.min(box.startX, box.currentX);
  const top = Math.min(box.startY, box.currentY);
  const width = Math.abs(box.currentX - box.startX);
  const height = Math.abs(box.currentY - box.startY);
  return { left, top, width, height };
}
