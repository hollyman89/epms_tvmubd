/**
 * EPMS — PROJECT-EXEC-F2-F3A
 * Operational Project Control Presentation & Business Logic Resolvers
 *
 * Implements:
 * 1. Progress (Plan vs Actual) presentation consumed directly from backend read model.
 * 2. Schedule presentation (Actual Start, Target Selesai, Overdue Task Count).
 * 3. Health chip resolution adhering strictly to PROJECT-CONTROL-R1 (LEBIH CEPAT, SESUAI RENCANA, TERLAMBAT, BELUM TERSEDIA).
 * 4. Contextual Next Action resolution with strict RBAC gating.
 */

import { resolvePmIdentity, ProjectCharterLike } from './kickoff-queue.utils';
export { formatCurrency } from '@/lib/formatters';

export interface ProjectControlPayload {
  planComparisonAvailable?: boolean;
  planComparisonUnavailableReason?: string | null;
  plannedProgress?: number | null;
  actualProgress?: number | null;
  progressVariancePp?: number | null;
  progressHealth?: 'AHEAD' | 'ON_PLAN' | 'BEHIND' | null;
  plannedStart?: string | null;
  actualStart?: string | null;
  plannedFinish?: string | null;
  overdueTaskCount?: number | null;
}

export interface ResolvedPlanVsActual {
  plannedText: string;
  plannedPercent: number | null;
  actualText: string;
  actualPercent: number | null;
  varianceText: string;
  varianceTone: 'red' | 'green' | 'slate';
  isComparisonAvailable: boolean;
}

export interface ResolvedSchedule {
  plannedStartText: string;
  actualStartText: string;
  plannedFinishText: string;
  overdueCount: number | null;
  overdueText: string;
  overdueTone: 'red' | 'green' | 'slate';
}

export interface ResolvedHealth {
  label: 'LEBIH CEPAT' | 'SESUAI RENCANA' | 'TERLAMBAT' | 'BELUM TERSEDIA';
  subtext: string;
  tone: 'blue' | 'green' | 'red' | 'slate';
  iconType: 'ahead' | 'on_plan' | 'behind' | 'unavailable';
}

export type ActiveNextActionMode =
  | 'UPDATE_PROGRESS_BUTTON'
  | 'REVIEW_PROGRESS_BUTTON'
  | 'ASSIGN_PM_BUTTON'
  | 'WAITING_VERIFICATION'
  | 'MONITORING_TEXT';

export interface ResolvedActiveNextAction {
  mode: ActiveNextActionMode;
  buttonLabel?: string;
  text?: string;
  isAssignedPm: boolean;
}

/**
 * Month names in Indonesian format (e.g. 06 Okt 2026)
 */
const ID_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

export function formatOperationalDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = ID_MONTHS[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return 'N/A';
  }
}

/**
 * 1. Progress (Plan vs Actual) Resolver
 * Consumes backend Project Control output without recalculating formulas.
 * Handles comparison unavailable gracefully without fabricating fake 0.
 */
export function resolvePlanVsActual(
  control: ProjectControlPayload | null | undefined,
  fallbackOverallProgress?: number | null,
): ResolvedPlanVsActual {
  const isAvailable = Boolean(control?.planComparisonAvailable);

  let plannedText = 'N/A';
  let plannedPercent: number | null = null;
  let varianceText = 'N/A';
  let varianceTone: 'red' | 'green' | 'slate' = 'slate';

  if (isAvailable && control?.plannedProgress !== null && control?.plannedProgress !== undefined) {
    const pVal = Math.round(Number(control.plannedProgress));
    plannedPercent = Math.max(0, Math.min(100, pVal));
    plannedText = `${pVal}%`;
  }

  // Actual progress: prefer control.actualProgress if available;
  // if comparison unavailable, preserve authoritative actual if provided
  let actualText = 'N/A';
  let actualPercent: number | null = null;

  const rawActual = control?.actualProgress ?? fallbackOverallProgress;
  if (rawActual !== null && rawActual !== undefined && !isNaN(Number(rawActual))) {
    const aVal = Math.round(Number(rawActual));
    actualPercent = Math.max(0, Math.min(100, aVal));
    actualText = `${aVal}%`;
  }

  // Variance: strictly backend derived
  if (isAvailable && control?.progressVariancePp !== null && control?.progressVariancePp !== undefined) {
    const varNum = Math.round(Number(control.progressVariancePp));
    if (varNum > 0) {
      varianceText = `+${varNum} pp`;
      varianceTone = 'green';
    } else if (varNum < 0) {
      varianceText = `${varNum} pp`;
      varianceTone = 'red';
    } else {
      varianceText = `0 pp`;
      varianceTone = 'slate';
    }
  }

  return {
    plannedText,
    plannedPercent,
    actualText,
    actualPercent,
    varianceText,
    varianceTone,
    isComparisonAvailable: isAvailable,
  };
}

/**
 * 2. Schedule Resolver
 * Extracts actual start, planned finish, and overdue task count.
 * Never fabricates actual project finish.
 */
export function resolveSchedule(
  control: ProjectControlPayload | null | undefined,
  fallbackPlannedStart?: string | null,
): ResolvedSchedule {
  const plannedStartText = formatOperationalDate(control?.plannedStart || fallbackPlannedStart);
  const actualStartText = formatOperationalDate(control?.actualStart);
  const plannedFinishText = formatOperationalDate(control?.plannedFinish);

  const isAvailable = Boolean(control?.planComparisonAvailable);
  const overdueCount = isAvailable && control?.overdueTaskCount !== null && control?.overdueTaskCount !== undefined
    ? Number(control.overdueTaskCount)
    : null;

  let overdueText = 'N/A';
  let overdueTone: 'red' | 'green' | 'slate' = 'slate';

  if (overdueCount !== null) {
    if (overdueCount > 0) {
      overdueText = `${overdueCount} Task Terlambat`;
      overdueTone = 'red';
    } else {
      overdueText = '0 Task Terlambat';
      overdueTone = 'green';
    }
  }

  return {
    plannedStartText,
    actualStartText,
    plannedFinishText,
    overdueCount,
    overdueText,
    overdueTone,
  };
}

/**
 * 3. Health Resolver
 * Adheres strictly to PROJECT-CONTROL-R1 semantics:
 * AHEAD -> LEBIH CEPAT
 * ON_PLAN -> SESUAI RENCANA
 * BEHIND -> TERLAMBAT
 * Unavailable -> BELUM TERSEDIA
 */
export function resolveOperationalHealth(
  control: ProjectControlPayload | null | undefined,
): ResolvedHealth {
  if (!control?.planComparisonAvailable) {
    const reason = control?.planComparisonUnavailableReason;
    const subtext =
      reason === 'NO_ACTIVE_BASELINE'
        ? 'Baseline belum aktif'
        : reason === 'INVALID_BASELINE'
        ? 'Struktur baseline tidak valid'
        : reason === 'TASK_MAPPING_INTEGRITY_ERROR'
        ? 'Mapping task tidak valid'
        : 'Belum tersedia';

    return {
      label: 'BELUM TERSEDIA',
      subtext,
      tone: 'slate',
      iconType: 'unavailable',
    };
  }

  const overdue = control.overdueTaskCount !== null && control.overdueTaskCount !== undefined
    ? Number(control.overdueTaskCount)
    : 0;

  switch (control.progressHealth) {
    case 'AHEAD':
      return {
        label: 'LEBIH CEPAT',
        subtext: 'Ahead of schedule',
        tone: 'blue',
        iconType: 'ahead',
      };
    case 'BEHIND':
      return {
        label: 'TERLAMBAT',
        subtext: overdue > 0 ? `${overdue} task overdue` : 'Behind schedule',
        tone: 'red',
        iconType: 'behind',
      };
    case 'ON_PLAN':
    default:
      return {
        label: 'SESUAI RENCANA',
        subtext: 'On track',
        tone: 'green',
        iconType: 'on_plan',
      };
  }
}

/**
 * 4. Next Action Resolver for Active Projects
 * Enforces:
 * - Assigned PM on IN_PROGRESS project: [ Update Progress ] (or 'Menunggu verifikasi' if claim pending).
 * - Non-PM (PMO/HOO): [ Review Progress ] if pending claim, [ Tugaskan PM ] if unassigned, otherwise 'Monitoring'.
 * - Tech/Admin roles (Admin/SuperAdmin/Finance/Procurement/Director/Other PM): 'Monitoring' (no unauthorized mutation leak).
 */
export function resolveActiveNextAction(options: {
  project: ProjectCharterLike;
  user: { sub?: number | string; id?: number | string } | null;
  userRoles: string[];
  hasPendingClaim?: boolean;
}): ResolvedActiveNextAction {
  const { project, user, userRoles, hasPendingClaim = false } = options;
  const pm = resolvePmIdentity(project);
  const currentUserId = user?.sub ?? (user as any)?.id ?? null;
  const isAssignedPm = Boolean(
    pm.isAssigned &&
    pm.id !== null &&
    currentUserId !== null &&
    Number(pm.id) === Number(currentUserId)
  );

  const rolesUpper = userRoles.map((r) => String(r).toUpperCase());
  const isPmo = rolesUpper.includes('PMO');
  const isHoo = rolesUpper.includes('HEAD_OF_OPERATIONS');

  // Case 1: Unassigned Project in active list (edge case)
  if (!pm.isAssigned) {
    if (isPmo) {
      return {
        mode: 'ASSIGN_PM_BUTTON',
        buttonLabel: 'Tugaskan PM',
        isAssignedPm: false,
      };
    }
    return {
      mode: 'MONITORING_TEXT',
      text: 'Menunggu penugasan PM',
      isAssignedPm: false,
    };
  }

  // Case 2: Pending Claim awaiting verification
  if (hasPendingClaim) {
    if (isAssignedPm) {
      return {
        mode: 'WAITING_VERIFICATION',
        text: 'Menunggu verifikasi',
        isAssignedPm: true,
      };
    }
    if (isPmo || isHoo) {
      return {
        mode: 'REVIEW_PROGRESS_BUTTON',
        buttonLabel: 'Review Progress',
        isAssignedPm: false,
      };
    }
    return {
      mode: 'MONITORING_TEXT',
      text: 'Menunggu verifikasi PMO/HOO',
      isAssignedPm: false,
    };
  }

  // Case 3: Normal active project routine execution
  if (isAssignedPm) {
    return {
      mode: 'UPDATE_PROGRESS_BUTTON',
      buttonLabel: 'Update Progress',
      isAssignedPm: true,
    };
  }

  // Non-assigned PM, Admin, SuperAdmin, Finance, Procurement, Director, etc.
  return {
    mode: 'MONITORING_TEXT',
    text: 'Monitoring',
    isAssignedPm: false,
  };
}
