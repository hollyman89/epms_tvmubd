/**
 * Operational Plan Readiness SSOT Alignment Utilities (R9.1B-OP-FIX Phase 3: OP-03)
 *
 * Enforces backend SSOT as the single authoritative source for:
 * 1. Persisted pillar readiness (Cost, WBS, Schedule, Initial Condition)
 * 2. Overall readiness count (completenessScore / completenessCount)
 * 3. 4/4 READY status
 * 4. 100% Kesiapan progress
 * 5. Management Review submission eligibility
 *
 * Local draft state (unsaved forms, client validation) is preserved strictly
 * for editing UX and must NEVER claim persisted business readiness.
 */

export type ReadinessPillarKey = 'wbs' | 'cost' | 'schedule' | 'initialCondition';

export interface BackendPillarReadiness {
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'READY' | 'BLOCKED';
  message?: string;
  [key: string]: any;
}

export interface BackendOperationalReadinessData {
  projectId?: number;
  projectCode?: string;
  projectName?: string;
  overallStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'READY' | 'BLOCKED';
  completenessCount?: number;
  totalPillars?: number;
  canSubmitForReview?: boolean;
  canCreatePr?: boolean;
  pillars?: {
    wbs?: BackendPillarReadiness;
    cost?: BackendPillarReadiness;
    schedule?: BackendPillarReadiness;
    initialCondition?: BackendPillarReadiness;
  };
  gate?: any;
  contract?: any;
  workflow?: any;
  [key: string]: any;
}

export interface EvaluateReadinessParams {
  operationalReadinessData: BackendOperationalReadinessData | null | undefined;
  isReadinessLoading?: boolean;
  hasCostInput?: boolean;
  totalPmEstimate?: number;
  isCostMappingValid?: boolean;
  isCostServerSynced?: boolean;
  isWbsComplete?: boolean;
  isWbsServerSynced?: boolean;
  isScheduleComplete?: boolean;
  isScheduleServerSynced?: boolean;
  isConditionComplete?: boolean;
  initialConditionId?: number | string | null;
  hasSavedDraftSinceRevision?: boolean;
  hasPersistedRevisionAfterReturn?: boolean;
  hasMeaningfulRevisionAfterReturn?: boolean;
  isRevisionMode?: boolean;
}

export interface OperationalPlanReadinessResult {
  // Authoritative Backend SSOT Pillar Readiness
  isCostReady: boolean;
  isWbsReady: boolean;
  isScheduleReady: boolean;
  isConditionReady: boolean;

  // Local draft status (for editing UX only)
  isCostLocalDraft: boolean;
  isWbsLocalDraft: boolean;
  isScheduleLocalDraft: boolean;
  isConditionLocalDraft: boolean;

  // Authoritative Backend SSOT Aggregate Readiness
  completenessScore: number;
  totalPillars: number;
  isOperationalPlanAuthoritativeReady: boolean;
  overallStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'READY' | 'BLOCKED' | string;

  // Authoritative Revision Persistence State
  hasPersistedRevisionAfterReturn: boolean;
  hasMeaningfulRevisionAfterReturn: boolean;

  // Management Review Eligibility
  canSubmitManagementReview: boolean;
  reviewSubmissionTooltip: string;
}

/**
 * Pure evaluation function that maps backend SSOT operational readiness DTO
 * to modal presentation flags and gates.
 *
 * Fails closed if backend readiness is missing, loading, or unavailable.
 */
export function evaluateOperationalPlanReadiness(
  params: EvaluateReadinessParams
): OperationalPlanReadinessResult {
  const {
    operationalReadinessData,
    isReadinessLoading = false,
    hasCostInput = false,
    totalPmEstimate = 0,
    isCostMappingValid = false,
    isCostServerSynced = false,
    isWbsComplete = false,
    isWbsServerSynced = false,
    isScheduleComplete = false,
    isScheduleServerSynced = false,
    isConditionComplete = false,
    initialConditionId = null,
    hasSavedDraftSinceRevision = false,
    hasPersistedRevisionAfterReturn,
    hasMeaningfulRevisionAfterReturn,
    isRevisionMode = false,
  } = params;

  // 1. Authoritative Backend SSOT Pillar Readiness
  // Strictly derived from backend SSOT, never from client booleans.
  const isCostReady = Boolean(operationalReadinessData?.pillars?.cost?.status === 'READY');
  const isWbsReady = Boolean(operationalReadinessData?.pillars?.wbs?.status === 'READY');
  const isScheduleReady = Boolean(operationalReadinessData?.pillars?.schedule?.status === 'READY');
  const isConditionReady = Boolean(operationalReadinessData?.pillars?.initialCondition?.status === 'READY');

  // 2. Local Draft Completeness (for editing UX and unsaved draft tags)
  const isCostComplete = Boolean(hasCostInput && totalPmEstimate > 0 && isCostMappingValid);
  const isCostLocalDraft = !isCostReady && isCostComplete && !isCostServerSynced;
  const isWbsLocalDraft = !isWbsReady && Boolean(isWbsComplete) && !isWbsServerSynced;
  const isScheduleLocalDraft = !isScheduleReady && Boolean(isScheduleComplete) && !isScheduleServerSynced;
  const isConditionLocalDraft = !isConditionReady && Boolean(isConditionComplete) && !initialConditionId;

  // 3. Authoritative Completeness Score & Total Pillars
  // Fails closed to 0 if backend readiness data is unavailable.
  const completenessScore =
    operationalReadinessData && typeof operationalReadinessData.completenessCount === 'number'
      ? operationalReadinessData.completenessCount
      : 0;

  const totalPillars =
    operationalReadinessData && typeof operationalReadinessData.totalPillars === 'number'
      ? operationalReadinessData.totalPillars
      : 4;

  const overallStatus = operationalReadinessData?.overallStatus || 'NOT_STARTED';

  // 4. Authoritative 4/4 READY State
  // Modal may display 4/4 READY ONLY when backend SSOT confirms overallStatus === 'READY'
  // AND completenessCount === totalPillars.
  const isOperationalPlanAuthoritativeReady =
    !isReadinessLoading &&
    overallStatus === 'READY' &&
    completenessScore === totalPillars;

  // 5. Authoritative Revision Persistence Evaluation
  const isRevisionSaved =
    hasMeaningfulRevisionAfterReturn !== undefined
      ? hasMeaningfulRevisionAfterReturn
      : hasPersistedRevisionAfterReturn !== undefined
        ? hasPersistedRevisionAfterReturn
        : operationalReadinessData?.hasMeaningfulRevisionAfterReturn !== undefined
          ? Boolean(operationalReadinessData.hasMeaningfulRevisionAfterReturn)
          : operationalReadinessData?.hasPersistedRevisionAfterReturn !== undefined
            ? Boolean(operationalReadinessData.hasPersistedRevisionAfterReturn)
            : operationalReadinessData?.gate?.hasMeaningfulRevisionAfterReturn !== undefined
              ? Boolean(operationalReadinessData.gate.hasMeaningfulRevisionAfterReturn)
              : operationalReadinessData?.gate?.hasPersistedRevisionAfterReturn !== undefined
                ? Boolean(operationalReadinessData.gate.hasPersistedRevisionAfterReturn)
                : Boolean(hasSavedDraftSinceRevision);

  // 6. Management Review UI Gate Alignment
  let canSubmitManagementReview = false;
  let reviewSubmissionTooltip = '';

  if (isRevisionMode) {
    if (!isRevisionSaved) {
      canSubmitManagementReview = false;
      reviewSubmissionTooltip = 'Perbaiki dan simpan Operational Plan terlebih dahulu.';
    } else if (!isOperationalPlanAuthoritativeReady) {
      canSubmitManagementReview = false;
      reviewSubmissionTooltip = `Lengkapi 4/4 pilar (${completenessScore}/${totalPillars} selesai) untuk mengajukan review.`;
    } else {
      canSubmitManagementReview = true;
      reviewSubmissionTooltip = 'Ajukan kembali Operational Plan yang telah direvisi kepada Head of Operations untuk ditinjau.';
    }
  } else {
    if (!isOperationalPlanAuthoritativeReady) {
      canSubmitManagementReview = false;
      reviewSubmissionTooltip = `Lengkapi 4/4 pilar (${completenessScore}/${totalPillars} selesai) untuk mengajukan review.`;
    } else {
      canSubmitManagementReview = true;
      reviewSubmissionTooltip = 'Ajukan Operational Plan kepada Head of Operations untuk ditinjau.';
    }
  }

  return {
    isCostReady,
    isWbsReady,
    isScheduleReady,
    isConditionReady,
    isCostLocalDraft,
    isWbsLocalDraft,
    isScheduleLocalDraft,
    isConditionLocalDraft,
    completenessScore,
    totalPillars,
    isOperationalPlanAuthoritativeReady,
    overallStatus,
    hasPersistedRevisionAfterReturn: isRevisionSaved,
    hasMeaningfulRevisionAfterReturn: isRevisionSaved,
    canSubmitManagementReview,
    reviewSubmissionTooltip,
  };
}
