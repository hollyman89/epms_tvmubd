export type PillarStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'READY' | 'BLOCKED';
export type OverallReadinessStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'READY' | 'BLOCKED';
export type ProcurementGateStatus =
  | 'NOT_SUBMITTED'
  | 'REVIEW_PENDING'
  | 'READY_FOR_PROCUREMENT'
  | 'REVIEW_FINANCE'
  | 'REVIEW_DIRECTOR'
  | 'READY_FOR_KICKOFF'
  | 'NEEDS_REVISION'
  | 'UNKNOWN_WORKFLOW_STATE';


export interface WbsReadinessResult {
  status: PillarStatus;
  majorPackagesCount: number;
  leafDeliverablesCount: number;
  rootWeightSum: number;
  message: string;
}

export interface CostReadinessResult {
  status: PillarStatus;
  totalEstimate: number;
  itemizedItemsCount: number;
  unassignedItemsCount: number;
  orphanedItemsCount: number;
  message: string;
}

export interface ScheduleReadinessResult {
  status: PillarStatus;
  totalTasks: number;
  leafDeliverablesCount: number;
  scheduledDeliverablesCount: number;
  hasCircularDependencies: boolean;
  message: string;
}

export interface InitialConditionReadinessResult {
  status: PillarStatus;
  conditionStatus: string | null;
  isComplete: boolean;
  message: string;
}

export interface CanonicalContractSummary {
  id: number;
  contractNumber: string;
  contractValue: number;
  legalStatus: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

export type OperationalPlanStage =
  | 'NOT_STARTED'
  | 'INCOMPLETE'
  | 'READY_TO_SUBMIT'
  | 'REVIEW_HOPS'
  | 'REVIEW_PROCUREMENT'
  | 'REVIEW_FINANCE'
  | 'REVIEW_DIRECTOR'
  | 'NEEDS_REVISION'
  | 'READY_FOR_KICKOFF'
  | 'ACTIVE';

export interface ProcurementGateReadinessResult {
  status: ProcurementGateStatus;
  submittedAt: string | null;
  submittedBy: string | null;
  submittedByName?: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  decidedByName?: string | null;
  revisionNotes: string | null;
  currentNodeId?: string | null;
  activeRole?: string | null;
  activeTaskName?: string | null;
  currentStage?: OperationalPlanStage | string | null;
  hasPersistedRevisionAfterReturn?: boolean;
}

export interface PillarsReadiness {
  wbs: WbsReadinessResult;
  cost: CostReadinessResult;
  schedule: ScheduleReadinessResult;
  initialCondition: InitialConditionReadinessResult;
}

export interface OperationalWorkflowInfo {
  instanceId: number | null;
  status: string | null;
  currentNodeId: string | null;
  activeRole: string | null;
  activeTaskName: string | null;
  currentStage: OperationalPlanStage | string | null;
}

export interface OperationalReadinessData {
  projectId: number;
  projectCode: string;
  projectName: string;
  overallStatus: OverallReadinessStatus;
  completenessCount: number;
  totalPillars: number;
  canSubmitForReview: boolean;
  canCreatePr: boolean;
  pillars: PillarsReadiness;
  gate: ProcurementGateReadinessResult;
  contract?: CanonicalContractSummary | null;
  workflow?: OperationalWorkflowInfo | null;
  actualKickoffDate?: string | null;
  hasPersistedRevisionAfterReturn: boolean;
}
