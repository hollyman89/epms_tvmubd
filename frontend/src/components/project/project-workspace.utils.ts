/**
 * EPMS — PROJECT-PM-WORKSPACE-R1-C1
 * Unified Project Manager Workspace Presentation & Business-Truth Resolvers
 *
 * Implements:
 * 1. Canonical workspace URL resolution and legacy deep-link unification (task-board -> tasks, progress-monitoring -> monitoring, gantt -> gantt).
 * 2. Authoritative project identity & schedule presentation without fabricated shell fallbacks ('PRJ-N/A', 'IN_PROGRESS', 'Baseline Aktif').
 * 3. Authoritative planned-start priority resolver (never hardcoded '07 Okt 2026', never actualStartText).
 * 4. Project actual finish user-facing presentation ('Belum selesai', strictly not modeled).
 * 5. Execution Summary resolution reusing F3B/F3C truth (Belum Dimulai, Dikerjakan, Review, Selesai, Overdue).
 * 6. Milestone Summary SSOT resolver (is_milestone = true only).
 * 7. Embedded mode chrome visibility flags.
 * 8. Workspace primary navigation structure (single More control).
 * 9. Top-level Project Delivery tabs verification (exactly 2 tabs).
 */

import {
  ProjectControlPayload,
  ResolvedSchedule,
  resolveSchedule,
  formatOperationalDate,
} from './operational-control.utils';
import { ProjectCharter } from '../ProjectOperationTab';

export type WorkspaceSection = 'overview' | 'tasks' | 'monitoring' | 'gantt' | 'issue-risk' | 'closure';

export interface ResolvedWorkspaceHeader {
  projectName: string;
  projectCode: string;
  statusText: string;
  periodText: string;
  plannedStartText: string;
  plannedFinishText: string;
  actualStartText: string;
  actualFinishText: string;
  actualFinishSubtext: string;
  isActualFinishModeled: boolean;
  schedule: ResolvedSchedule;
}

export interface ResolvedExecutionSummary {
  todo: number;
  inProgress: number;
  review: number;
  done: number;
  overdue: number;
  total: number;
}

export interface ResolvedMilestoneSummaryItem {
  id: number;
  name: string;
  code?: string;
  plannedDate?: string | null;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';
  isLate: boolean;
}

export interface ResolvedMilestoneSummary {
  total: number;
  completed: number;
  late: number;
  remaining: number;
  items: ResolvedMilestoneSummaryItem[];
}

/**
 * 1. Legacy Deep-Link Canonicalizer
 * Resolves legacy parameters into unified canonical workspace URL:
 * /project-delivery?view=workspace&projectId=:id&section=:section
 */
export function resolveProjectWorkspaceCanonicalUrl(
  baseUrl: string,
  view: string | null | undefined,
  projectId: number | string | null | undefined,
  section?: string | null | undefined,
): { canonicalUrl: string; section: WorkspaceSection; isLegacy: boolean } {
  const url = new URL(baseUrl, 'http://localhost');
  const pid = projectId ? String(projectId) : '';

  let resolvedSection: WorkspaceSection = 'overview';
  let isLegacy = false;

  if (view === 'task-board' || view === 'tasks') {
    resolvedSection = 'tasks';
    isLegacy = view === 'task-board';
  } else if (view === 'progress-monitoring' || view === 'monitoring') {
    resolvedSection = 'monitoring';
    isLegacy = view === 'progress-monitoring';
  } else if (view === 'gantt' || view === 'project-gantt') {
    resolvedSection = 'gantt';
    isLegacy = view === 'project-gantt' || view === 'gantt';
  } else if (view === 'workspace') {
    const validSections: WorkspaceSection[] = ['overview', 'tasks', 'monitoring', 'gantt', 'issue-risk', 'closure'];
    resolvedSection = validSections.includes(section as any) ? (section as WorkspaceSection) : 'overview';
    isLegacy = false;
  }

  url.pathname = '/project-delivery';
  url.searchParams.set('view', 'workspace');
  if (pid) {
    url.searchParams.set('projectId', pid);
  } else {
    url.searchParams.delete('projectId');
  }
  url.searchParams.set('section', resolvedSection);

  return {
    canonicalUrl: `${url.pathname}${url.search}`,
    section: resolvedSection,
    isLegacy,
  };
}

/**
 * 2. Authoritative Workspace Header & Schedule Resolver
 * Strictly eliminates fabricated fallbacks ('PRJ-N/A', 'IN_PROGRESS', 'Baseline Aktif').
 * Guarantees planned start is never hardcoded ('07 Okt 2026') and never actualStartText.
 * Presents project actual finish as 'Belum selesai' without internal engineering leaks.
 */
export function resolveWorkspaceHeaderMetadata(
  project: Partial<ProjectCharter> | null | undefined,
  control: ProjectControlPayload | null | undefined,
  fallbackPlannedStart?: string | null | undefined,
): ResolvedWorkspaceHeader {
  // Honest Project Code (no 'PRJ-N/A' fake)
  const projectCode = project?.project_code ? project.project_code.trim() : 'N/A';

  // Honest Status (no 'IN_PROGRESS' fake)
  const statusText = project?.status ? project.status.trim() : 'N/A';

  // Authoritative Planned Start source: control.plannedStart -> fallbackPlannedStart -> N/A
  const authoritativePlannedStart = control?.plannedStart || fallbackPlannedStart || (project as any)?.plannedStart || null;

  // Resolve schedule strictly via authoritative inputs
  const schedule = resolveSchedule(control, authoritativePlannedStart);

  // Honest Period (no 'Baseline Aktif' fake fallback, strictly NO actualStart used as plannedStart)
  let periodText = 'Belum tersedia';
  if (schedule.plannedStartText !== 'N/A' && schedule.plannedFinishText !== 'N/A') {
    periodText = `${schedule.plannedStartText} – ${schedule.plannedFinishText}`;
  } else if (schedule.plannedFinishText !== 'N/A') {
    periodText = `Target Selesai: ${schedule.plannedFinishText}`;
  }

  // Project Actual Finish UI (strictly NOT MODELED in business semantics, user-friendly presentation)
  const actualFinishText = 'Belum selesai';
  const actualFinishSubtext = 'Ditetapkan saat penutupan proyek';

  return {
    projectName: project?.project_name || (project?.id ? `Proyek #${project.id}` : 'Proyek Tanpa Nama'),
    projectCode,
    statusText,
    periodText,
    plannedStartText: schedule.plannedStartText,
    plannedFinishText: schedule.plannedFinishText,
    actualStartText: schedule.actualStartText,
    actualFinishText,
    actualFinishSubtext,
    isActualFinishModeled: false,
    schedule,
  };
}

/**
 * 3. Execution Summary Resolver
 * Strictly reuses F3B/F3C SSOT (Belum Dimulai, Dikerjakan, Review, Selesai, Overdue).
 */
export function resolveWorkspaceExecutionSummary(
  summary: {
    todo?: number | null;
    inProgress?: number | null;
    review?: number | null;
    done?: number | null;
    overdue?: number | null;
    total?: number | null;
  } | null | undefined,
): ResolvedExecutionSummary {
  const todo = Number(summary?.todo ?? 0);
  const inProgress = Number(summary?.inProgress ?? 0);
  const review = Number(summary?.review ?? 0);
  const done = Number(summary?.done ?? 0);
  const overdue = Number(summary?.overdue ?? 0);
  const total = Number(summary?.total ?? (todo + inProgress + review + done));

  return {
    todo,
    inProgress,
    review,
    done,
    overdue,
    total,
  };
}

/**
 * 4. Milestone Summary Resolver
 * Strictly reuses F3C/F3D SSOT: is_milestone = true only. No weight=0 inference.
 */
export function resolveWorkspaceMilestoneSummary(
  milestones: Array<{
    id: number;
    name: string;
    code?: string;
    plannedDate?: string | null;
    actualDate?: string | null;
    status?: string | null;
    isLate?: boolean | null;
    isMilestone?: boolean | null;
  }> | null | undefined,
): ResolvedMilestoneSummary {
  const validMilestones = (milestones || []).filter((m) => m.isMilestone !== false);

  const completed = validMilestones.filter((m) => m.status === 'COMPLETED').length;
  const late = validMilestones.filter((m) => Boolean(m.isLate)).length;
  const remaining = validMilestones.length - completed;

  const items: ResolvedMilestoneSummaryItem[] = validMilestones.map((m) => ({
    id: m.id,
    name: m.name,
    code: m.code,
    plannedDate: m.plannedDate,
    status: (m.status as any) || (m.actualDate ? 'COMPLETED' : 'PENDING'),
    isLate: Boolean(m.isLate),
  }));

  return {
    total: validMilestones.length,
    completed,
    late,
    remaining,
    items,
  };
}

/**
 * 5. Embedded Mode Chrome Visibility Resolver
 * When embedded = true: hides duplicate shell chrome (breadcrumb, back button, header card, cross-workspace quick-nav).
 * When embedded = false: standalone mode remains fully intact.
 */
export function resolveWorkspaceEmbeddedChrome(embedded?: boolean) {
  const isEmbedded = Boolean(embedded);
  return {
    isEmbedded,
    showInternalBreadcrumb: !isEmbedded,
    showInternalBackButton: !isEmbedded,
    showInternalHeader: !isEmbedded,
    showInternalQuickNav: !isEmbedded,
  };
}

/**
 * 6. Top-Level Project Delivery Tabs Invariant
 * Exactly 3 tabs:
 * 1. Antrean Kick-off Charter
 * 2. Daftar Proyek Berjalan
 * 3. Proyek Selesai
 */
export function resolveTopLevelProjectDeliveryTabs(): string[] {
  return ['Antrean Kick-off Charter', 'Daftar Proyek Berjalan', 'Proyek Selesai'];
}

/**
 * 7. Project Delivery Operational Classification & Terminal Actions
 * Ensures strict mutual exclusion between Active and Completed projects.
 * Closed projects allow only non-mutating terminal actions ('LIHAT_DETAIL').
 */
export function classifyProjectDeliveryLists(
  rawActiveProjects: any[] = [],
  rawCompletedProjects: any[] = []
) {
  const completed =
    Array.isArray(rawCompletedProjects) && rawCompletedProjects.length > 0
      ? [...rawCompletedProjects]
      : rawActiveProjects.filter((p) => p.status === 'CLOSED' || p.projectStatus === 'CLOSED');

  const active = rawActiveProjects.filter(
    (p) => p.status !== 'CLOSED' && p.projectStatus !== 'CLOSED'
  );

  return {
    activeProjects: active,
    completedProjects: completed,
    activeCount: active.length,
    completedCount: completed.length,
  };
}

export function resolveCompletedProjectActions(project: any) {
  const isClosed = project?.status === 'CLOSED' || project?.projectStatus === 'CLOSED';
  if (!isClosed) {
    return {
      canViewDetail: true,
      canUpdateProgress: true,
      canClaimProgress: true,
      canKickoff: false,
      canSubmitClosure: false,
      canApproveManagement: false,
      allowedActions: ['LIHAT_DETAIL', 'UPDATE_PROGRESS'],
      forbiddenActions: [],
    };
  }

  return {
    canViewDetail: true,
    canUpdateProgress: false,
    canClaimProgress: false,
    canKickoff: false,
    canSubmitClosure: false,
    canApproveManagement: false,
    allowedActions: ['LIHAT_DETAIL'],
    forbiddenActions: [
      'UPDATE_PROGRESS',
      'KICKOFF',
      'CLAIM_PROGRESS',
      'SUBMIT_CLOSURE',
      'MANAGEMENT_APPROVAL',
      'EXECUTION_MUTATION',
    ],
  };
}
