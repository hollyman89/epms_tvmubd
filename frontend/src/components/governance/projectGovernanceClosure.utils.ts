/**
 * EPMS — PROJECT-CLOSE-R1-C5-UI-CORR
 * Project Governance Closure Task Utilities
 *
 * Provides stage resolution, strict role authority evaluation, and validation
 * for PROJECT_CLOSURE tasks integrated into Tugas Persetujuan Proyek.
 */

import { WorkflowTask } from '@/services/workflowEngine.service';

export const SUPPORTED_CLOSURE_NODES = [
  'node_hoo_review',
  'node_director_approval',
] as const;

export type SupportedClosureNode = (typeof SUPPORTED_CLOSURE_NODES)[number];

export interface ClosureStageInfo {
  label: string;
  shortLabel: string;
  tagColor: string;
  nextNodeLabel: string;
  returnNodeLabel: string;
  requiredRole: 'HEAD_OF_OPERATIONS' | 'DIRECTOR';
  requiredRoleLabel: string;
}

export const CLOSURE_STAGE_MAPPING: Record<SupportedClosureNode, ClosureStageInfo> = {
  node_hoo_review: {
    label: 'Review Closure — Head of Operations',
    shortLabel: 'HOO Closure Review',
    tagColor: 'cyan',
    nextNodeLabel: 'Persetujuan Final Direktur',
    returnNodeLabel: 'Dikembalikan ke PM untuk Revisi',
    requiredRole: 'HEAD_OF_OPERATIONS',
    requiredRoleLabel: 'Head of Operations',
  },
  node_director_approval: {
    label: 'Persetujuan Final Closure — Director',
    shortLabel: 'Director Final Approval',
    tagColor: 'purple',
    nextNodeLabel: 'Proyek Resmi Ditutup (CLOSED)',
    returnNodeLabel: 'Dikembalikan ke PM untuk Revisi',
    requiredRole: 'DIRECTOR',
    requiredRoleLabel: 'Director',
  },
};

/**
 * Checks if a workflow task belongs to the PROJECT_CLOSURE workflow.
 */
export function isClosureTask(task: WorkflowTask | any): boolean {
  if (!task) return false;
  const wKey =
    task.workflowInstance?.workflowDefinition?.workflowKey ||
    task.workflowKey ||
    task.workflowInstance?.workflowKey;
  const eType =
    task.workflowInstance?.entityType ||
    task.entityType;

  return wKey === 'PROJECT_CLOSURE' || eType === 'PROJECT_CLOSURE' || task.isClosure === true;
}

export interface ClosureActionEvaluation {
  canApprove: boolean;
  canReturn: boolean;
  isReadOnly: boolean;
  isHooAction: boolean;
  isDirectorAction: boolean;
  roleRestrictionReason?: string;
}

/**
 * Pure helper to evaluate role authority for a PROJECT_CLOSURE task.
 * 
 * Rules (Section 6, 7, 8):
 * - PM: zero approval action
 * - HOO / GM: HOO step only (node_hoo_review) -> Approve ("Setujui"), Return ("Kembalikan")
 * - DIRECTOR: Director step only (node_director_approval) -> Final Approve ("Setujui Final"), Return ("Kembalikan")
 * - ADMIN / SUPER_ADMIN: zero closure business approval action (strictly read-only)
 */
export function evaluateClosureTaskActionability(
  task: WorkflowTask | any,
  userRoles: string[] = [],
): ClosureActionEvaluation {
  if (!task || task.status !== 'PENDING') {
    return {
      canApprove: false,
      canReturn: false,
      isReadOnly: true,
      isHooAction: false,
      isDirectorAction: false,
      roleRestrictionReason: 'Tugas tidak dalam status menunggu persetujuan (PENDING)',
    };
  }

  const normalizedRoles = userRoles.map((r) => String(r).toUpperCase());
  const isAdminOrSuperAdmin =
    normalizedRoles.includes('SUPER_ADMIN') || normalizedRoles.includes('ADMIN');

  // ADMIN / SUPER_ADMIN have ZERO Closure business authority
  if (isAdminOrSuperAdmin) {
    return {
      canApprove: false,
      canReturn: false,
      isReadOnly: true,
      isHooAction: false,
      isDirectorAction: false,
      roleRestrictionReason:
        'Administrator / Super Admin hanya memiliki hak pemantauan (Read-Only) pada penutupan proyek.',
    };
  }

  const nodeId = task.nodeId;

  if (nodeId === 'node_hoo_review') {
    const isHoo =
      normalizedRoles.includes('HEAD_OF_OPERATIONS') ||
      normalizedRoles.includes('GENERAL_MANAGER');

    if (isHoo) {
      return {
        canApprove: true,
        canReturn: true,
        isReadOnly: false,
        isHooAction: true,
        isDirectorAction: false,
      };
    }

    return {
      canApprove: false,
      canReturn: false,
      isReadOnly: true,
      isHooAction: false,
      isDirectorAction: false,
      roleRestrictionReason:
        'Hanya Head of Operations yang berwenang meninjau dan memutuskan penutupan proyek pada tahap ini.',
    };
  }

  if (nodeId === 'node_director_approval') {
    const isDirector = normalizedRoles.includes('DIRECTOR');

    if (isDirector) {
      return {
        canApprove: true,
        canReturn: true,
        isReadOnly: false,
        isHooAction: false,
        isDirectorAction: true,
      };
    }

    return {
      canApprove: false,
      canReturn: false,
      isReadOnly: true,
      isHooAction: false,
      isDirectorAction: false,
      roleRestrictionReason:
        'Hanya Direktur yang berwenang menyetujui final penutupan proyek pada tahap ini.',
    };
  }

  return {
    canApprove: false,
    canReturn: false,
    isReadOnly: true,
    isHooAction: false,
    isDirectorAction: false,
    roleRestrictionReason: 'Tahap alur kerja tidak dikenal.',
  };
}

/**
 * Validates mandatory return reason (minimum 10 characters).
 */
export function validateClosureReturnReason(reason: string | null | undefined): {
  isValid: boolean;
  message?: string;
} {
  const trimmed = (reason || '').trim();
  if (!trimmed) {
    return { isValid: false, message: 'Alasan perbaikan/pengembalian wajib diisi.' };
  }
  if (trimmed.length < 10) {
    return {
      isValid: false,
      message: 'Alasan perbaikan/pengembalian wajib diisi minimal 10 karakter.',
    };
  }
  return { isValid: true };
}

// ── APPROVAL CENTER CLASSIFICATION (EPMS — PROJECT-CLOSE-R1-C5-UI-FINAL) ─────

export type ApprovalClassification = 'MANAGEMENT_REVIEW' | 'PROJECT_CLOSURE' | 'OTHER';

export interface ApprovalClassificationInfo {
  code: ApprovalClassification;
  label: string;
  tagColor: string;
}

export const APPROVAL_CLASSIFICATION_MAP: Record<ApprovalClassification, ApprovalClassificationInfo> = {
  MANAGEMENT_REVIEW: {
    code: 'MANAGEMENT_REVIEW',
    label: 'Management Review',
    tagColor: 'blue',
  },
  PROJECT_CLOSURE: {
    code: 'PROJECT_CLOSURE',
    label: 'Project Closure',
    tagColor: 'purple',
  },
  OTHER: {
    code: 'OTHER',
    label: 'Lainnya',
    tagColor: 'default',
  },
};

/**
 * Authoritatively resolves the approval classification of a governance task
 * based on workflowKey and entity metadata (SSOT, strictly no display-text guessing).
 */
export function resolveTaskApprovalClassification(task: WorkflowTask | any): ApprovalClassificationInfo {
  if (isClosureTask(task)) {
    return APPROVAL_CLASSIFICATION_MAP.PROJECT_CLOSURE;
  }

  const wKey =
    task?.workflowInstance?.workflowDefinition?.workflowKey ||
    task?.workflowKey ||
    task?.workflowInstance?.workflowKey;

  const eType =
    task?.workflowInstance?.entityType ||
    task?.entityType;

  if (
    wKey === 'PROJECT_PLAN_REVIEW_WORKFLOW' ||
    eType === 'PROJECT_PLAN_REVIEW' ||
    (!task?.isClosure && typeof task?.nodeId === 'string' && task.nodeId.startsWith('node_'))
  ) {
    return APPROVAL_CLASSIFICATION_MAP.MANAGEMENT_REVIEW;
  }

  return APPROVAL_CLASSIFICATION_MAP.MANAGEMENT_REVIEW;
}

export interface ResolvedClosureModalReadiness {
  isReady: boolean;
  verdictLabel: 'SIAP DITUTUP' | 'BELUM SIAP UNTUK DITUTUP';
  overallProgress: number;
  isPhysicalComplete: boolean;
  bastPresent: boolean;
  finalReportPresent: boolean;
  customerName: string;
  cycleNumber: number;
  pmSubmitter: string;
  submittedAt: string | null;
  submissionNotes: string;
  returnedReason: string;
  bastDocName: string;
  finalReportDocName: string;
  effectiveBastDoc: { id?: number | null; fileName: string; name?: string } | null;
  effectiveFinalReportDoc: { id?: number | null; fileName: string; name?: string } | null;
  openMaterialPRCount: number;
  unfulfilledMaterialPOCount: number;
  isProcurementClear: boolean;
  pendingServiceClaimCount: number;
  isClaimsClear: boolean;
  unpaidVendorInvoiceCount: number;
  isInvoicesClear: boolean;
  pendingPaymentRequestCount: number;
  isPaymentsClear: boolean;
  blockingIssueCount: number;
  unresolvedMaterializedRiskCount: number;
  openIssuesCount: number;
  activeRisksCount: number;
  isIssuesRisksClear: boolean;
  blockers: Array<{ domain?: string; code?: string; message?: string }>;
  warnings: Array<{ domain?: string; code?: string; message?: string }>;
}

export interface ResolveClosureModalOptions {
  closureReadiness?: any;
  closureData?: any;
  task?: any;
}

/**
 * Pure authoritative projection of live/snapshot closure readiness data for
 * Approval Center review modals (HOO & Director).
 *
 * Rules:
 * - Maps authoritative backend ClosureReadinessResult (ready, physical, documents, etc.)
 * - Falls back to closure.readinessSnapshot or task.readinessSnapshot if live is not passed
 * - Never returns false-negative readiness when authoritative ready === true
 * - Safely handles missing/null payloads without crashing or throwing
 */
export function resolveClosureModalReadiness(
  options: ResolveClosureModalOptions,
): ResolvedClosureModalReadiness {
  const r =
    options.closureReadiness ||
    options.closureData?.readinessSnapshot ||
    options.task?.closureReadiness ||
    options.task?.readinessSnapshot ||
    null;
  const c = options.closureData || options.task?.closureData || null;
  const t = options.task || null;

  const isReady = Boolean(r?.ready ?? r?.isReadyForClosure ?? false);
  const verdictLabel = isReady ? 'SIAP DITUTUP' : 'BELUM SIAP UNTUK DITUTUP';

  const physical = r?.physical || r?.operational;
  const overallProgress =
    typeof physical?.overallProgress === 'number'
      ? physical.overallProgress
      : typeof physical?.progress === 'number'
        ? physical.progress
        : 0;
  const requiredProgress =
    typeof physical?.requiredProgress === 'number' ? physical.requiredProgress : 100;
  const isPhysicalComplete = Boolean(
    physical?.isComplete ?? (overallProgress >= requiredProgress && overallProgress > 0),
  );

  const bastPresent = Boolean(
    r?.documents?.customerBastPresent ??
      r?.deliverables?.hasApprovedBast ??
      c?.acceptanceDocumentId ??
      c?.acceptanceDocument ??
      t?.acceptanceDocumentId ??
      false,
  );

  const finalReportPresent = Boolean(
    r?.documents?.finalReportPresent ??
      r?.documentation?.hasApprovedFinalReport ??
      c?.finalReportDocumentId ??
      c?.finalReportDocument ??
      t?.finalReportDocumentId ??
      false,
  );

  const customerName =
    t?.customerName ||
    r?.project?.contract?.customer?.name ||
    r?.customerName ||
    c?.project?.customerName ||
    'N/A';

  const cycleNumber = Number(c?.cycleNumber || t?.cycleNumber || 1);

  const pmSubmitter =
    c?.submittedBy?.fullName ||
    c?.submittedBy?.name ||
    c?.submittedByName ||
    t?.submittedByName ||
    'Project Manager';

  const submittedAt = c?.submittedAt || t?.submittedAt || t?.createdAt || null;
  const submissionNotes = c?.submissionNotes || t?.submissionNotes || '';
  const returnedReason = c?.returnReason || c?.returnedReason || '';

  const bastDocObj = c?.acceptanceDocument || t?.closureData?.acceptanceDocument || null;
  const bastDocName =
    bastDocObj?.fileName ||
    bastDocObj?.name ||
    (bastPresent
      ? r?.documents?.customerBastDocumentId
        ? `Dokumen BAST Pelanggan (#${r.documents.customerBastDocumentId})`
        : 'Dokumen BAST Pelanggan (Tersedia)'
      : 'Dokumen belum diunggah');

  const effectiveBastDoc = bastPresent
    ? bastDocObj || {
        id: r?.documents?.customerBastDocumentId || null,
        fileName: bastDocName,
        name: bastDocName,
      }
    : null;

  const finalReportDocObj = c?.finalReportDocument || t?.closureData?.finalReportDocument || null;
  const finalReportDocName =
    finalReportDocObj?.fileName ||
    finalReportDocObj?.name ||
    (finalReportPresent
      ? r?.documents?.finalReportDocumentId
        ? `Dokumen Laporan Akhir (#${r.documents.finalReportDocumentId})`
        : 'Dokumen Laporan Akhir (Tersedia)'
      : 'Dokumen belum diunggah');

  const effectiveFinalReportDoc = finalReportPresent
    ? finalReportDocObj || {
        id: r?.documents?.finalReportDocumentId || null,
        fileName: finalReportDocName,
        name: finalReportDocName,
      }
    : null;

  const matProc = r?.procurement?.material;
  const openMaterialPRCount = matProc?.openPRCount ?? 0;
  const unfulfilledMaterialPOCount =
    matProc?.unfulfilledMaterialPOCount ?? (r?.procurementPo?.openCount ?? 0);
  const isProcurementClear = Boolean(
    r?.procurementPo?.allClosed ??
      (openMaterialPRCount === 0 && unfulfilledMaterialPOCount === 0),
  );

  const pendingServiceClaimCount =
    r?.serviceClaims?.pendingClaimCount ?? (r?.serviceClaims?.openCount ?? 0);
  const isClaimsClear = Boolean(
    r?.serviceClaims?.allSettled ?? (pendingServiceClaimCount === 0),
  );

  const unpaidVendorInvoiceCount =
    r?.finance?.vendorAP?.unpaidVendorInvoiceCount ??
    (r?.vendorInvoices?.unpaidCount ?? 0);
  const isInvoicesClear = Boolean(
    r?.vendorInvoices?.allPaid ?? (unpaidVendorInvoiceCount === 0),
  );

  const pendingPaymentRequestCount =
    r?.finance?.vendorAP?.pendingPaymentRequestCount ??
    (r?.vendorPayments?.pendingCount ?? 0);
  const isPaymentsClear = Boolean(
    r?.vendorPayments?.allSettled ?? (pendingPaymentRequestCount === 0),
  );

  const blockingIssueCount = r?.issues?.blockingIssueCount ?? 0;
  const unresolvedMaterializedRiskCount =
    r?.risks?.unresolvedMaterializedRiskCount ?? 0;
  const openIssuesCount =
    (r?.issues?.openIssues ?? 0) +
    (r?.issues?.inProgressIssues ?? 0) +
    (r?.issuesAndRisks?.openIssuesCount ?? 0);
  const activeRisksCount =
    (r?.risks?.activeRiskCount ?? 0) + (r?.issuesAndRisks?.openRisksCount ?? 0);
  const isIssuesRisksClear = Boolean(
    r?.issuesAndRisks?.allResolved ??
      (blockingIssueCount === 0 && unresolvedMaterializedRiskCount === 0),
  );

  const blockers = Array.isArray(r?.blockers) ? r.blockers : [];
  const warnings = Array.isArray(r?.warnings) ? r.warnings : [];

  return {
    isReady,
    verdictLabel,
    overallProgress,
    isPhysicalComplete,
    bastPresent,
    finalReportPresent,
    customerName,
    cycleNumber,
    pmSubmitter,
    submittedAt,
    submissionNotes,
    returnedReason,
    bastDocName,
    finalReportDocName,
    effectiveBastDoc,
    effectiveFinalReportDoc,
    openMaterialPRCount,
    unfulfilledMaterialPOCount,
    isProcurementClear,
    pendingServiceClaimCount,
    isClaimsClear,
    unpaidVendorInvoiceCount,
    isInvoicesClear,
    pendingPaymentRequestCount,
    isPaymentsClear,
    blockingIssueCount,
    unresolvedMaterializedRiskCount,
    openIssuesCount,
    activeRisksCount,
    isIssuesRisksClear,
    blockers,
    warnings,
  };
}

