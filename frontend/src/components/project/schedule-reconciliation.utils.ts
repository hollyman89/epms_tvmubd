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

    // Priority 3.5: Current frontend schedule even if not yet populated (preserves user task structure)
    if (fromCurrent) {
      return syncScheduleMetadata(fromCurrent, leaf, taskIdToWbsCodeMap);
    }

    // Priority 4: Create empty template (genuinely new WBS leaf)
    return createEmptyScheduleItem(leaf);
  });
}

export interface BuildSchedulePayloadResult {
  valid: boolean;
  error?: string;
  payload?: {
    tasks: {
      id?: number;
      wbsId: number;
      name: string;
      isMilestone: boolean;
      startDate?: string;
      endDate?: string;
      predecessorTaskId?: number | null;
      predecessorWbsCode?: string;
      dependencyType: 'FS';
      progress: number;
      status: string;
    }[];
    pmNotes?: string;
  };
  reconciledTasks: ScheduleTaskItem[];
}

/**
 * Validates and transforms schedule items into an atomic, fail-closed backend save payload.
 * Maps temporary client WBS IDs to permanent database WBS IDs.
 * Never silently drops tasks; if any task cannot be reconciled to a valid WBS leaf, returns valid=false.
 */
export function buildSaveProjectSchedulePayload(
  scheduleData: ScheduleTaskItem[],
  wbsLeaves: { id: string; code: string; name: string }[],
  pmNotes?: string,
  preSaveWbsNodes?: { id: string; code: string }[]
): BuildSchedulePayloadResult {
  // If scheduleData is completely empty, payload legitimately has 0 tasks
  if (!scheduleData || scheduleData.length === 0) {
    return {
      valid: true,
      payload: {
        tasks: [],
        pmNotes: pmNotes ? pmNotes.trim() : undefined,
      },
      reconciledTasks: [],
    };
  }

  // Build fallback map for pre-save temporary WBS IDs -> WBS code
  const tempIdToCodeMap = new Map<string, string>();
  if (preSaveWbsNodes) {
    for (const node of preSaveWbsNodes) {
      if (node.id && node.code) {
        tempIdToCodeMap.set(String(node.id), normalizeWbsCode(node.code));
      }
    }
  }

  // Build lookups for active WBS leaves
  const leafByCode = new Map<string, { id: string; code: string; name: string }>();
  const leafById = new Map<string, { id: string; code: string; name: string }>();
  for (const leaf of wbsLeaves) {
    if (leaf.code) {
      leafByCode.set(normalizeWbsCode(leaf.code), leaf);
    }
    if (leaf.id) {
      leafById.set(String(leaf.id), leaf);
    }
  }

  // Pre-validate that EVERY task currently in scheduleData can be mapped to an active WBS leaf
  const unresolvableTasks: string[] = [];
  for (const item of scheduleData) {
    let matchedLeaf: { id: string; code: string; name: string } | undefined;

    const itemCode = item.wbsCode ? normalizeWbsCode(item.wbsCode) : undefined;
    if (itemCode && leafByCode.has(itemCode)) {
      matchedLeaf = leafByCode.get(itemCode);
    } else if (item.wbsNodeId && tempIdToCodeMap.has(String(item.wbsNodeId))) {
      const codeFromTemp = tempIdToCodeMap.get(String(item.wbsNodeId))!;
      if (leafByCode.has(codeFromTemp)) {
        matchedLeaf = leafByCode.get(codeFromTemp);
      }
    } else if (item.wbsNodeId && leafById.has(String(item.wbsNodeId))) {
      matchedLeaf = leafById.get(String(item.wbsNodeId));
    }

    if (!matchedLeaf) {
      unresolvableTasks.push(item.name || item.wbsCode || String(item.wbsNodeId) || 'Task tanpa nama');
      continue;
    }

    const leafDbId = Number(matchedLeaf.id);
    if (!matchedLeaf.id || isNaN(leafDbId) || leafDbId <= 0) {
      unresolvableTasks.push(item.name || item.wbsCode || String(item.wbsNodeId) || 'Task tanpa nama');
    }
  }

  // Fail-Closed Validation 1: Any unresolvable tasks blocks save
  if (unresolvableTasks.length > 0) {
    return {
      valid: false,
      error: `Terdapat ${unresolvableTasks.length} task jadwal yang tidak dapat dipetakan ke ID WBS database yang valid: ${unresolvableTasks.join(', ')}. Penyimpanan jadwal dibatalkan untuk mencegah kehilangan data.`,
      reconciledTasks: [],
    };
  }

  // Reconcile and translate schedule items to permanent WBS database IDs
  const reconciledTasks: ScheduleTaskItem[] = scheduleData.map((item) => {
    let matchedLeaf: { id: string; code: string; name: string } | undefined;
    const itemCode = item.wbsCode ? normalizeWbsCode(item.wbsCode) : undefined;
    if (itemCode && leafByCode.has(itemCode)) {
      matchedLeaf = leafByCode.get(itemCode);
    } else if (item.wbsNodeId && tempIdToCodeMap.has(String(item.wbsNodeId))) {
      const mappedCode = tempIdToCodeMap.get(String(item.wbsNodeId))!;
      matchedLeaf = leafByCode.get(mappedCode);
    } else if (item.wbsNodeId && leafById.has(String(item.wbsNodeId))) {
      matchedLeaf = leafById.get(String(item.wbsNodeId));
    }

    return {
      ...item,
      wbsNodeId: matchedLeaf ? String(matchedLeaf.id) : item.wbsNodeId,
      wbsCode: matchedLeaf ? matchedLeaf.code : item.wbsCode,
      name: matchedLeaf ? matchedLeaf.name : item.name,
    };
  });

  // Build code -> task map for predecessor task ID resolution
  const wbsCodeToTaskMap = new Map<string, ScheduleTaskItem>();
  for (const item of reconciledTasks) {
    if (item.wbsCode) {
      wbsCodeToTaskMap.set(normalizeWbsCode(item.wbsCode), item);
    }
  }

  const tasksPayload: {
    id?: number;
    wbsId: number;
    name: string;
    isMilestone: boolean;
    startDate?: string;
    endDate?: string;
    predecessorTaskId?: number | null;
    predecessorWbsCode?: string;
    dependencyType: 'FS';
    progress: number;
    status: string;
  }[] = [];

  for (const item of reconciledTasks) {
    const rawWbsId = item.wbsNodeId;
    const resolvedWbsId = Number(rawWbsId);

    let predTaskId: number | null = item.predecessorTaskId ? Number(item.predecessorTaskId) : null;
    if (!predTaskId && item.predecessorWbsCode) {
      const target = wbsCodeToTaskMap.get(normalizeWbsCode(item.predecessorWbsCode));
      if (target && target.id) {
        predTaskId = Number(target.id);
      }
    }

    const isMilestone = item.type === 'MILESTONE' || Boolean(item.isMilestone);

    tasksPayload.push({
      id: item.id && !isNaN(Number(item.id)) && Number(item.id) > 0 ? Number(item.id) : undefined,
      wbsId: resolvedWbsId,
      name: item.name,
      isMilestone,
      startDate: item.startDate || undefined,
      endDate: isMilestone ? undefined : (item.endDate || undefined),
      predecessorTaskId: predTaskId,
      predecessorWbsCode: item.predecessorWbsCode ? normalizeWbsCode(item.predecessorWbsCode) : undefined,
      dependencyType: 'FS',
      progress: Number(item.progress || 0),
      status: item.status || 'PLANNED',
    });
  }

  // Fail-Closed Validation 2: Never send 0 tasks if user had tasks in UI
  if (scheduleData.length > 0 && tasksPayload.length === 0) {
    return {
      valid: false,
      error: `Validasi gagal: Jumlah task jadwal yang akan disimpan adalah 0 padahal terdapat ${scheduleData.length} task di UI. Penyimpanan jadwal dibatalkan.`,
      reconciledTasks,
    };
  }

  // Fail-Closed Validation 3: Ensure all intended tasks are accounted for
  if (tasksPayload.length !== scheduleData.length) {
    return {
      valid: false,
      error: `Inkonsistensi jumlah task jadwal: ${scheduleData.length} task di UI, tetapi ${tasksPayload.length} task dalam payload simpan. Penyimpanan jadwal dibatalkan.`,
      reconciledTasks,
    };
  }

  return {
    valid: true,
    payload: {
      tasks: tasksPayload,
      pmNotes: pmNotes ? pmNotes.trim() : undefined,
    },
    reconciledTasks,
  };
}

/**
 * Phase C & Phase D: Extracts the persisted WBS array from various backend response envelopes.
 *
 * Supported envelope patterns:
 * 1. Direct array: [ ...nodes ]
 * 2. Axios wrapper over NestJS service envelope:
 *    { data: { statusCode: 200, message: "...", data: [ ...nodes ] } }
 * 3. NestJS service envelope (unwrapped by service or direct):
 *    { statusCode: 200, message: "...", data: [ ...nodes ] }
 * 4. Generic data envelope:
 *    { data: [ ...nodes ] }
 * 5. Generic nodes envelope:
 *    { nodes: [ ...nodes ] } or { data: { nodes: [ ...nodes ] } }
 *
 * Returns null if the extracted value is not a valid array, ensuring fail-closed behavior.
 */
export function extractPersistedWbsArray(response: any): any[] | null {
  if (!response || typeof response !== 'object') return null;

  // Case 1: Direct array
  if (Array.isArray(response)) {
    return response;
  }

  // Case 2: Double-nested: { data: { data: [...] } } or { data: { statusCode: 200, data: [...] } }
  if (response.data && typeof response.data === 'object') {
    if (Array.isArray(response.data.data)) {
      return response.data.data;
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }
    if (Array.isArray(response.data.nodes)) {
      return response.data.nodes;
    }
  }

  // Case 3: Single-level nested: { data: [...] }
  if (Array.isArray(response.data)) {
    return response.data;
  }

  // Case 4: Single-level nested: { nodes: [...] }
  if (Array.isArray(response.nodes)) {
    return response.nodes;
  }

  return null;
}

/**
 * Asserts that all nodes in a WBS tree (including recursive children)
 * have valid, positive numeric permanent database IDs.
 */
export function assertPersistedWbsNodesHaveDbIds(nodes: any[]): boolean {
  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) return false;

  const validateNode = (node: any): boolean => {
    if (!node || typeof node !== 'object') return false;
    const rawId = node.dbId ?? node.id;
    if (rawId === undefined || rawId === null) return false;
    const numId = Number(rawId);
    if (isNaN(numId) || numId <= 0) return false;

    if (node.children && Array.isArray(node.children) && node.children.length > 0) {
      return node.children.every(validateNode);
    }
    return true;
  };

  return nodes.every(validateNode);
}

