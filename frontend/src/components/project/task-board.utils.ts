/**
 * Task Board / Kanban Utilities (PROJECT-EXEC-F2-F3B)
 * Pure mapping, deterministic sorting, and filtering logic for Authoritative Task Board.
 */

export type TaskBoardLane = 'TO_DO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

export interface TaskBoardTask {
  id: number;
  code: string;
  name: string;
  wbsId: number;
  workPackage: { id: number; code: string; name: string } | null;
  assignee: { id: number; name: string } | null;
  progress: number;
  status: string;
  plannedStart: string | null;
  plannedFinish: string | null;
  actualStart: string | null;
  actualFinish: string | null;
  isMilestone: boolean;
  isCritical: boolean;
  weight: number | null;
  evidenceCount: number;
  reviewState: string | null;
  pendingClaim: {
    id: number;
    reportedProgress: number;
    previousProgress: number;
    eventType: string;
    reason: string;
    submittedBy: number;
    createdAt: string;
    evidenceCount: number;
  } | null;
  boardLane: TaskBoardLane;
  overdueDays: number;
  isOverdue: boolean;
  availableActions: string[];
}

export interface TaskBoardProject {
  id: number;
  code: string;
  name: string;
  customer: string | null;
  managerId: number | null;
  manager: { id: number; name: string; email: string } | null;
  status: string;
}

export interface TaskBoardControlSummary {
  plannedProgress: number;
  actualProgress: number;
  progressVariancePp: number;
  progressHealth: 'BEHIND' | 'ON_TRACK' | 'AHEAD' | string;
  planComparisonAvailable: boolean;
  actualStart: string | null;
  plannedFinish: string | null;
}

export interface TaskBoardData {
  project: TaskBoardProject;
  controlSummary: TaskBoardControlSummary;
  tasks: TaskBoardTask[];
}

export interface KanbanLaneMeta {
  key: TaskBoardLane;
  title: string;
  accentColor: string;
  badgeBg: string;
  headerBorder: string;
}

export const KANBAN_LANES: KanbanLaneMeta[] = [
  {
    key: 'TO_DO',
    title: 'BELUM DIMULAI',
    accentColor: '#475569',
    badgeBg: '#f1f5f9',
    headerBorder: '#cbd5e1',
  },
  {
    key: 'IN_PROGRESS',
    title: 'DIKERJAKAN',
    accentColor: '#0284c7',
    badgeBg: '#e0f2fe',
    headerBorder: '#7dd3fc',
  },
  {
    key: 'REVIEW',
    title: 'REVIEW',
    accentColor: '#d97706',
    badgeBg: '#fef3c7',
    headerBorder: '#fcd34d',
  },
  {
    key: 'DONE',
    title: 'SELESAI',
    accentColor: '#16a34a',
    badgeBg: '#dcfce7',
    headerBorder: '#86efac',
  },
];

/**
 * Pure mapping helper: resolves canonical TaskBoardLane from task state.
 * Priority:
 * 1. Pending claim / reviewState === 'PENDING_VERIFICATION' -> REVIEW
 * 2. status === 'COMPLETED' or (progress === 100 and actualFinish is set) -> DONE
 * 3. progress > 0 or status === 'IN_PROGRESS' or actualStart is set -> IN_PROGRESS
 * 4. Default -> TO_DO
 */
export function getTaskBoardLane(task: Partial<TaskBoardTask>): TaskBoardLane {
  if (task.pendingClaim || task.reviewState === 'PENDING_VERIFICATION') {
    return 'REVIEW';
  }
  const prog = Number(task.progress || 0);
  const hasFinished = Boolean(task.actualFinish);
  if (task.status === 'COMPLETED' || (prog === 100 && hasFinished)) {
    return 'DONE';
  }
  if (prog > 0 || task.status === 'IN_PROGRESS' || Boolean(task.actualStart)) {
    return 'IN_PROGRESS';
  }
  return 'TO_DO';
}

/**
 * Deterministic sort inside lane:
 * 1. Overdue tasks first (overdueDays > 0 descending)
 * 2. Critical tasks (isCritical true first)
 * 3. Nearest planned finish date ascending
 * 4. Task code / id stable sort
 */
export function sortTasksInLane(tasks: TaskBoardTask[]): TaskBoardTask[] {
  return [...tasks].sort((a, b) => {
    // 1. Overdue
    const aOverdue = a.isOverdue || a.overdueDays > 0;
    const bOverdue = b.isOverdue || b.overdueDays > 0;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    if (aOverdue && bOverdue && a.overdueDays !== b.overdueDays) {
      return b.overdueDays - a.overdueDays;
    }

    // 2. Critical
    if (a.isCritical && !b.isCritical) return -1;
    if (!a.isCritical && b.isCritical) return 1;

    // 3. Nearest planned finish
    if (a.plannedFinish && b.plannedFinish) {
      const cmp = a.plannedFinish.localeCompare(b.plannedFinish);
      if (cmp !== 0) return cmp;
    } else if (a.plannedFinish && !b.plannedFinish) {
      return -1;
    } else if (!a.plannedFinish && b.plannedFinish) {
      return 1;
    }

    // 4. Code / ID
    if (a.code && b.code) {
      const codeCmp = a.code.localeCompare(b.code, undefined, { numeric: true });
      if (codeCmp !== 0) return codeCmp;
    }
    return a.id - b.id;
  });
}

/**
 * Filter tasks in board by user filters.
 */
export interface TaskBoardFilterState {
  search?: string;
  overdueOnly?: boolean;
  criticalOnly?: boolean;
  assigneeId?: number | null;
  wbsId?: number | null;
}

export function filterTaskBoard(tasks: TaskBoardTask[], filters: TaskBoardFilterState): TaskBoardTask[] {
  return tasks.filter((t) => {
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      const codeMatch = (t.code || '').toLowerCase().includes(q);
      const nameMatch = (t.name || '').toLowerCase().includes(q);
      const wpMatch = (t.workPackage?.name || '').toLowerCase().includes(q) || (t.workPackage?.code || '').toLowerCase().includes(q);
      const assigneeMatch = (t.assignee?.name || '').toLowerCase().includes(q);
      if (!codeMatch && !nameMatch && !wpMatch && !assigneeMatch) {
        return false;
      }
    }

    if (filters.overdueOnly && !(t.isOverdue || t.overdueDays > 0)) {
      return false;
    }

    if (filters.criticalOnly && !t.isCritical) {
      return false;
    }

    if (filters.assigneeId !== undefined && filters.assigneeId !== null) {
      if (filters.assigneeId === -1) {
        // Unassigned filter
        if (t.assignee !== null) return false;
      } else {
        if (t.assignee?.id !== filters.assigneeId) return false;
      }
    }

    if (filters.wbsId !== undefined && filters.wbsId !== null) {
      if (t.wbsId !== filters.wbsId) return false;
    }

    return true;
  });
}

/**
 * Formats health label and token
 */
export function getHealthDisplay(health: string): { label: string; color: string; bg: string; border: string } {
  switch (health) {
    case 'BEHIND':
      return { label: 'TERLAMBAT', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' };
    case 'AHEAD':
      return { label: 'LEBIH CEPAT', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' };
    case 'ON_TRACK':
    default:
      return { label: 'SESUAI JADWAL', color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' };
  }
}

/**
 * Canonical task progress formatter for UI presentation (PROJECT-EXEC-F2-F3B-C1).
 * Preserves business truth:
 * - 0 -> "0%"
 * - 100 (when strictly completed/100) -> "100%"
 * - Numbers with decimals (e.g. 99.99) NEVER round up to "100%".
 *   For example, 99.99 -> "99.99%", 99.9 -> "99.9%".
 */
export function formatTaskProgress(progress: number | null | undefined): string {
  const p = Number(progress || 0);
  if (p <= 0) return '0%';
  if (p >= 100) return '100%';
  if (Number.isInteger(p)) {
    return `${p}%`;
  }
  const formatted = parseFloat(p.toFixed(2));
  if (formatted >= 100) {
    return '99.99%';
  }
  return `${formatted}%`;
}

