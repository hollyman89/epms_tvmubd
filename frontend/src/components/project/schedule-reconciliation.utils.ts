/**
 * Schedule Reconciliation Utilities
 *
 * Pure logic functions extracted from ScheduleGanttTab for testability.
 * These functions contain NO React/JSX dependencies.
 */
import dayjs from 'dayjs';

export interface ScheduleTaskItem {
  id?: number;
  wbsNodeId: string;
  wbsCode: string;
  name: string;
  type?: 'TASK' | 'MILESTONE';
  startDate?: string;
  endDate?: string;
  duration?: number;
  predecessorTaskId?: number | null;
  predecessorWbsCode?: string;
  dependencyType?: 'FS';
  isMilestone?: boolean;
  progress?: number;
  status?: string;
  assigneeId?: number | null;
}

/** Calculate elapsed duration in calendar days (End - Start) */
export function calculateElapsedDuration(startStr?: string, endStr?: string): number {
  if (!startStr || !endStr) return 0;
  const start = dayjs(startStr);
  const end = dayjs(endStr);
  if (!start.isValid() || !end.isValid()) return 0;
  if (end.isBefore(start, 'day')) return 0;
  return end.diff(start, 'day');
}

/**
 * Check if a schedule item has meaningful populated data beyond just metadata.
 * Used by reconciliation to prevent replacing populated schedule with empty template.
 */
export function isSchedulePopulated(item: ScheduleTaskItem): boolean {
  if (item.startDate) return true;
  if (item.endDate) return true;
  if (item.duration && item.duration > 0) return true;
  if (item.predecessorTaskId) return true;
  if (item.predecessorWbsCode) return true;
  if (item.isMilestone || item.type === 'MILESTONE') return true;
  if (item.progress && item.progress > 0) return true;
  if (item.status && item.status !== 'PLANNED') return true;
  if (item.assigneeId) return true;
  return false;
}

/** Normalize WBS code for fallback matching */
export function normalizeWbsCode(code?: string): string {
  return (code || '').trim();
}

/** Create an empty schedule template for a new WBS leaf */
export function createEmptyScheduleItem(leaf: { id: string; code: string; name: string }): ScheduleTaskItem {
  return {
    wbsNodeId: leaf.id,
    wbsCode: leaf.code,
    name: leaf.name,
    type: 'TASK' as const,
    startDate: undefined,
    endDate: undefined,
    duration: 0,
    predecessorWbsCode: undefined,
    predecessorTaskId: null,
    dependencyType: 'FS',
    isMilestone: false,
    progress: 0,
    status: 'PLANNED',
    assigneeId: null,
  };
}

/**
 * Sync WBS metadata (wbsNodeId, wbsCode, name) from leaf node to schedule item,
 * preserving all schedule data.
 */
export function syncScheduleMetadata(
  item: ScheduleTaskItem,
  leaf: { id: string; code: string; name: string },
  taskIdToWbsCodeMap?: Map<number, string>,
): ScheduleTaskItem {
  let resolvedType: 'TASK' | 'MILESTONE' = 'TASK';
  let resolvedIsMilestone = false;

  if (item.type) {
    resolvedType = item.type === 'MILESTONE' ? 'MILESTONE' : 'TASK';
    resolvedIsMilestone = resolvedType === 'MILESTONE';
  } else if (item.isMilestone !== undefined) {
    resolvedIsMilestone = Boolean(item.isMilestone);
    resolvedType = resolvedIsMilestone ? 'MILESTONE' : 'TASK';
  }

  const duration = resolvedIsMilestone ? 0 : calculateElapsedDuration(item.startDate, item.endDate);

  let predWbsCode = item.predecessorWbsCode;
  if (!predWbsCode && item.predecessorTaskId && taskIdToWbsCodeMap?.has(Number(item.predecessorTaskId))) {
    predWbsCode = taskIdToWbsCodeMap.get(Number(item.predecessorTaskId));
  }

  return {
    ...item,
    id: item.id ? Number(item.id) : undefined,
    wbsNodeId: leaf.id,
    wbsCode: leaf.code,
    name: leaf.name,
    type: resolvedType,
    isMilestone: resolvedIsMilestone,
    endDate: resolvedIsMilestone ? undefined : item.endDate,
    duration,
    predecessorWbsCode: predWbsCode,
    predecessorTaskId: item.predecessorTaskId ? Number(item.predecessorTaskId) : null,
    progress: item.progress !== undefined ? Number(item.progress) : 0,
    status: item.status || 'PLANNED',
    assigneeId: item.assigneeId ? Number(item.assigneeId) : null,
  };
}

/**
 * 4-Level Reconciliation: Reconcile WBS leaves with schedule data.
 * Priority: 1. Saved populated → 2. Current populated → 3. Saved empty → 4. New empty
 */
export function reconcileScheduleWithWbs(
  wbsLeaves: { id: string; code: string; name: string }[],
  savedDraft: ScheduleTaskItem[],
  currentItems: ScheduleTaskItem[],
): ScheduleTaskItem[] {
  const savedByNodeId = new Map<string, ScheduleTaskItem>();
  const savedByCode = new Map<string, ScheduleTaskItem>();
  const taskIdToWbsCodeMap = new Map<number, string>();

  for (const item of savedDraft) {
    if (item.wbsNodeId) savedByNodeId.set(String(item.wbsNodeId), item);
    if (item.wbsCode) savedByCode.set(normalizeWbsCode(item.wbsCode), item);
    if (item.id && item.wbsCode) taskIdToWbsCodeMap.set(Number(item.id), item.wbsCode);
  }

  const currentByNodeId = new Map<string, ScheduleTaskItem>();
  const currentByCode = new Map<string, ScheduleTaskItem>();

  for (const item of currentItems) {
    if (item.wbsNodeId) currentByNodeId.set(String(item.wbsNodeId), item);
    if (item.wbsCode) currentByCode.set(normalizeWbsCode(item.wbsCode), item);
    if (item.id && item.wbsCode) taskIdToWbsCodeMap.set(Number(item.id), item.wbsCode);
  }

  return wbsLeaves.map((leaf) => {
    const fromSaved =
      (leaf.id ? savedByNodeId.get(String(leaf.id)) : undefined)
      ?? savedByCode.get(normalizeWbsCode(leaf.code));

    const fromCurrent =
      (leaf.id ? currentByNodeId.get(String(leaf.id)) : undefined)
      ?? currentByCode.get(normalizeWbsCode(leaf.code));

    // Priority 1: Server/saved schedule with populated data
    if (fromSaved && isSchedulePopulated(fromSaved)) {
      return syncScheduleMetadata(fromSaved, leaf, taskIdToWbsCodeMap);
    }

    // Priority 2: Current frontend schedule with populated data
    if (fromCurrent && isSchedulePopulated(fromCurrent)) {
      return syncScheduleMetadata(fromCurrent, leaf, taskIdToWbsCodeMap);
    }

    // Priority 3: Server/saved schedule even if empty (preserves database ID)
    if (fromSaved) {
      return syncScheduleMetadata(fromSaved, leaf, taskIdToWbsCodeMap);
    }

    // Priority 4: Create empty template (genuinely new WBS leaf)
    return createEmptyScheduleItem(leaf);
  });
}
