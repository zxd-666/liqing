import type { Mindmap, MindmapRecord } from "./types";

export const RECORDS_STORAGE_KEY = "liqing.records.v1";
export const ACTIVE_RECORD_STORAGE_KEY = "liqing.activeRecordId.v1";

export function loadRecords(): MindmapRecord[] {
  try {
    const raw = window.localStorage.getItem(RECORDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortRecords(parsed.filter(isRecordLike));
  } catch {
    return [];
  }
}

export function saveRecords(records: MindmapRecord[]) {
  window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
}

export function loadActiveRecordId() {
  return window.localStorage.getItem(ACTIVE_RECORD_STORAGE_KEY);
}

export function saveActiveRecordId(recordId: string | null) {
  if (recordId) window.localStorage.setItem(ACTIVE_RECORD_STORAGE_KEY, recordId);
  else window.localStorage.removeItem(ACTIVE_RECORD_STORAGE_KEY);
}

export function sortRecords(records: MindmapRecord[]) {
  return [...records].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function isRecordLike(value: unknown): value is MindmapRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as MindmapRecord;
  return Boolean(record.id && record.topic && record.mindmap?.root && record.createdAt && record.updatedAt);
}

export function titleForRecord(topic: string, mindmap: Mindmap) {
  return (mindmap.root.text || topic || "未命名理清").trim();
}

export function formatRecordTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const pad = (num: number) => String(num).padStart(2, "0");
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (isToday) return time;
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${time}`;
}
