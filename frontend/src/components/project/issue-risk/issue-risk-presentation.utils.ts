import {
  ProjectIssueSeverity,
  ProjectIssuePriority,
  ProjectRiskLevel,
  ProjectRiskStatus,
  ProjectIssueStatus,
} from '@/services/project-issue-risk.service';

/**
 * Format risk probability for presentation.
 * Unassessed returns 'Belum dinilai'.
 */
export function formatRiskProbability(prob: number | null | undefined): string {
  if (prob === null || prob === undefined) {
    return 'Belum dinilai';
  }
  return `${prob} / 5`;
}

/**
 * Format risk impact for presentation.
 * Unassessed returns 'Belum dinilai'.
 */
export function formatRiskImpact(impact: number | null | undefined): string {
  if (impact === null || impact === undefined) {
    return 'Belum dinilai';
  }
  return `${impact} / 5`;
}

/**
 * Format risk score for presentation.
 * Unassessed returns 'N/A'.
 */
export function formatRiskScore(score: number | null | undefined): string {
  if (score === null || score === undefined) {
    return 'N/A';
  }
  return String(score);
}

/**
 * Format risk level for presentation.
 * Unassessed returns 'Belum dinilai'.
 */
export function formatRiskLevel(level: string | null | undefined): string {
  if (!level) {
    return 'Belum dinilai';
  }
  return level;
}

/**
 * Materialization payload validator.
 * Invariant: Severity and Priority MUST be explicitly provided by the actor.
 * There is NO automatic default or implicit mapping from Risk Level to Issue Severity.
 */
export function validateMaterializePayload(payload: {
  severity?: string | null;
  priority?: string | null;
  targetResolutionDate?: string | null;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!payload.severity || !Object.values(ProjectIssueSeverity).includes(payload.severity as any)) {
    errors.push('Severity wajib dipilih secara eksplisit.');
  }

  if (!payload.priority || !Object.values(ProjectIssuePriority).includes(payload.priority as any)) {
    errors.push('Priority wajib dipilih secara eksplisit.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * RBAC & Owner Action Visibility Rule Matrix.
 */
export function canUserPerformAction(
  action: 'CREATE_ISSUE' | 'CREATE_RISK' | 'ASSESS_RISK' | 'MATERIALIZE_RISK' | 'RESOLVE_ISSUE' | 'CLOSE_ISSUE' | 'CLOSE_RISK',
  userRoles: string[],
  isOwner: boolean,
  isAssignedPm: boolean
): boolean {
  const upperRoles = userRoles.map((r) => r.toUpperCase());
  const isGovernance = upperRoles.some((r) =>
    ['SUPER_ADMIN', 'ADMIN', 'PMO', 'HEAD_OF_OPERATIONS', 'DIRECTOR'].includes(r)
  );

  switch (action) {
    case 'CREATE_ISSUE':
    case 'CREATE_RISK':
      return isAssignedPm || isGovernance;

    case 'ASSESS_RISK':
    case 'MATERIALIZE_RISK':
      return isAssignedPm || isGovernance;

    case 'RESOLVE_ISSUE':
      // Assigned PM, Governance, OR assigned record Owner can resolve an issue
      return isAssignedPm || isGovernance || isOwner;

    case 'CLOSE_ISSUE':
    case 'CLOSE_RISK':
      // Governance or Assigned PM can close; non-PM owner CANNOT close
      return isAssignedPm || isGovernance;

    default:
      return false;
  }
}

/**
 * Deep-link initial tab resolver.
 */
export function resolveIssueRiskInitialTab(typeParam: string | null | undefined): 'issues' | 'risks' {
  if (typeParam === 'risk' || typeParam === 'risks') {
    return 'risks';
  }
  return 'issues';
}

/**
 * Deep-link target resolution helper.
 * Extracts requested register tab and sanitized record ID.
 */
export function resolveDeepLinkTarget(
  typeParam: string | null | undefined,
  idParam: string | null | undefined
): { tab: 'issues' | 'risks'; recordId: number | null } {
  const tab = resolveIssueRiskInitialTab(typeParam);
  let recordId: number | null = null;
  if (idParam) {
    const parsed = parseInt(idParam, 10);
    if (!isNaN(parsed) && parsed > 0) {
      recordId = parsed;
    }
  }
  return { tab, recordId };
}

/**
 * Validates that an authoritative record belongs to the current project context.
 */
export function validateDeepLinkRecord(
  record: { projectId?: number } | null | undefined,
  expectedProjectId: number
): boolean {
  if (!record || !record.projectId) return false;
  return Number(record.projectId) === Number(expectedProjectId);
}

/**
 * Validates domain match (prevents opening issue record when risk was requested or vice versa).
 */
export function isRecordMatchingDomain(
  targetType: 'issue' | 'risk',
  record: any
): boolean {
  if (!record) return false;
  if (targetType === 'issue') {
    return Boolean(record.issueNumber);
  }
  if (targetType === 'risk') {
    return Boolean(record.riskNumber);
  }
  return false;
}

/**
 * Normalizes paginated API response for Issues/Risks into authoritative array and metadata.
 * Handles:
 * - Nested NestJS transform interceptor: { meta, data: { data: [...], total, page, limit } }
 * - Direct pagination payload: { data: [...], total, page, limit }
 * - Flat arrays: [...]
 * - Null / undefined / empty: []
 */
export function normalizeIssueRiskListResponse<T = any>(
  rawResponse: any
): { data: T[]; total: number; page: number; limit: number } {
  if (!rawResponse) {
    return { data: [], total: 0, page: 1, limit: 10 };
  }

  // If response is wrapped in NestJS TransformInterceptor { meta, data: ... }
  const payload = rawResponse?.data ?? rawResponse;

  let data: T[] = [];
  if (Array.isArray(payload?.data)) {
    data = payload.data;
  } else if (Array.isArray(payload)) {
    data = payload;
  } else if (Array.isArray(rawResponse)) {
    data = rawResponse;
  }

  const total =
    typeof payload?.total === 'number'
      ? payload.total
      : typeof rawResponse?.total === 'number'
      ? rawResponse.total
      : data.length;

  const page =
    typeof payload?.page === 'number'
      ? payload.page
      : typeof rawResponse?.page === 'number'
      ? rawResponse.page
      : 1;

  const limit =
    typeof payload?.limit === 'number'
      ? payload.limit
      : typeof rawResponse?.limit === 'number'
      ? rawResponse.limit
      : 10;

  return { data, total, page, limit };
}


