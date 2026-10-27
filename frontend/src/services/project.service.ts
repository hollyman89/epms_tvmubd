import { apiClient } from '@/lib/axios';
import {
  executeUpload,
  UPLOAD_REQUEST_TIMEOUT_MS,
  DEFAULT_MAX_FILE_SIZE_BYTES,
} from '@/lib/uploadTransport';

// --- DTOs & INTERFACES ---

export interface ProjectCharterItem {
  id: number;
  tender_id: number;
  project_code: string;
  project_name: string;
  customerName: string;
  contract_total_value: number;
  marketingName: string;
  pmName?: string;
  status: 'PENDING_KICKOFF' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED';
  created_at: string;
  overallProgress?: number;
  siteName?: string | null;
  city?: string | null;
  province?: string | null;
  address?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  operationalPlanStatus?: string;
  handoverStatus?: string;
  readiness?: any;
  [key: string]: any;
}

export interface OperationalBoardData {
  pendingKickoff: ProjectCharterItem[];
  activeProjects: ProjectCharterItem[];
  completedProjects?: ProjectCharterItem[];
}


export interface CanonicalCostItem {
  id: number;
  itemName: string;
  description?: string | null;
  quantity: number;
  uom: string;
  rateType?: string;
  unitPrice: number;
  subtotal: number;
  resourceType?: string | null;
  costSource?: string;
  assignmentScope?: 'WBS' | 'PROJECT' | 'UNASSIGNED';
  wbsId?: number | null;
  notes?: string | null;
}

export interface CanonicalCostCategory {
  categoryKey: string;
  categoryLabel: string;
  groupKey: 'DIRECT' | 'INDIRECT' | 'RISK';
  mode: 'DIRECT' | 'ITEMIZED';
  directSubtotal: number;
  categoryTotal: number;
  items: CanonicalCostItem[];
}

export interface WbsCostSummaryNode {
  wbsId: number;
  wbsCode: string;
  wbsName: string;
  level: number;
  parentWbsId: number | null;
  totalCost: number;
  itemCount: number;
}

export interface CanonicalCostEstimateResponse {
  id: number;
  projectId: number;
  status: string;
  version: number;
  pmNotes?: string | null;
  directTotal: number;
  indirectTotal: number;
  riskTotal: number;
  totalPmEstimate: number;
  categories: CanonicalCostCategory[];
  wbsCostSummary?: WbsCostSummaryNode[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RejectCharterPayload {
  reason: string;
}

export interface EligiblePmItem {
  id: number;
  fullName: string;
  email: string;
}

export interface AssignPmPayload {
  projectManagerId: number;
}

export interface CharterOperationResponse {
  success?: boolean;
  message?: string;
  project_code?: string;
  id?: number;
  status?: string;
  [key: string]: any;
}

export interface UpdateTaskProgressPayload {
  progress: number;
  expectedProgress: number;
  reason?: string;
}

export interface ProgressClaimPayload {
  reportedProgress: number;
  eventType?: 'FAT_PASSED' | 'SAT_PASSED' | 'BAST_SUBMITTED' | 'COMMISSIONING' | string;
  reason: string;
  documentIds?: number[];
}

export interface VerifyProgressPayload {
  decision: 'APPROVE' | 'REJECT';
  rejectionReason?: string;
}

export interface ProgressLogItem {
  id: number;
  projectId: number;
  taskId: number;
  wbsId?: number;
  baselineId?: number;
  previousProgress?: number;
  reportedProgress: number;
  progressDelta?: number;
  effectiveDate?: string;
  eventType?: string;
  status: 'PENDING_VERIFICATION' | 'OFFICIAL' | 'REJECTED';
  reason?: string | null;
  submittedBy?: number;
  verifiedBy?: number | null;
  verifiedAt?: string | Date | null;
  rejectionReason?: string | null;
  evidenceCount?: number;
  taskProgress?: number;
  decision?: 'APPROVE' | 'REJECT';
  createdAt?: string | Date;
  [key: string]: any;
}

export interface FormalKickoffPayload {
  actualKickoffDate?: string;
  estimatedStartDate?: string;
  estimatedEndDate?: string;
  siteName?: string;
  city?: string;
  address?: string;
  province?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
}

// --- PROJECT CLOSURE DTOs & INTERFACES (R1-C5) ---

export type ProjectClosureStatus =
  | 'PENDING_HOO_REVIEW'
  | 'PENDING_DIRECTOR_APPROVAL'
  | 'RETURNED'
  | 'APPROVED';

export interface ClosureBlocker {
  domain: string;
  code: string;
  message: string;
  count?: number;
  amount?: number;
  entityIds?: number[];
}

export interface ClosureWarning {
  domain: string;
  code: string;
  message: string;
  count?: number;
}

export interface ClosureReadinessProject {
  id: number;
  code: string;
  name: string;
  status: string;
  eligible: boolean;
  contract?: {
    contractId: number | null;
    contractNumber?: string | null;
    status?: string | null;
    customer?: {
      id: number;
      name: string;
    } | null;
  };
}

export interface ClosurePhysicalReadiness {
  overallProgress: number;
  requiredProgress: number;
  isComplete: boolean;
}

export interface ClosureTaskReadiness {
  totalLeafTasks: number;
  completedLeafTasks: number;
  incompleteLeafTasks: number;
  missingActualFinishCount: number;
  pendingVerificationCount: number;
}

export interface ClosureIssueReadiness {
  totalIssues: number;
  openIssues: number;
  inProgressIssues: number;
  resolvedIssues: number;
  closedIssues: number;
  cancelledIssues: number;
  blockingIssueCount: number;
}

export interface ClosureRiskReadiness {
  totalRisks: number;
  activeRiskCount: number;
  materializedRiskCount: number;
  unresolvedMaterializedRiskCount: number;
  clearedRiskCount: number;
}

export interface ClosureMaterialProcurementReadiness {
  openPRCount: number;
  openRFQCount: number;
  unfulfilledMaterialPOCount: number;
  pendingGRCount: number;
}

export interface ClosureServiceProcurementReadiness {
  openPRCount?: number;
  openRFQCount?: number;
  servicePOCount: number;
  openServiceOrderCount: number;
  totalServiceCommitted: number;
  approvedClaimedValue: number;
  remainingServiceScope: number;
  serviceScopeClearanceSupported: boolean;
}

export interface ClosureServiceClaimReadiness {
  totalClaims: number;
  pendingClaimCount: number;
  approvedUninvoicedCount: number;
  approvedUninvoicedValue: number;
}

export interface ClosureVendorAPReadiness {
  totalVendorInvoices: number;
  unverifiedVendorInvoiceCount: number;
  unpaidVendorInvoiceCount: number;
  pendingPaymentRequestCount: number;
  outstandingVendorPayable: number;
}

export interface ClosureDocumentReadiness {
  customerBastPresent: boolean;
  customerBastDocumentId?: number | null;
  finalReportPresent: boolean;
  finalReportDocumentId?: number | null;
  internalHandoverPresent: boolean;
  internalHandoverDocumentId?: number | null;
  activeDocumentsCount: number;
  authoritativeLimitationNotes: string;
}

export interface ClosureReadinessResult {
  project: ClosureReadinessProject;
  ready: boolean;
  summary: {
    blockerCount: number;
    warningCount: number;
  };
  physical: ClosurePhysicalReadiness;
  tasks: ClosureTaskReadiness;
  issues: ClosureIssueReadiness;
  risks: ClosureRiskReadiness;
  procurement: {
    material: ClosureMaterialProcurementReadiness;
    service: ClosureServiceProcurementReadiness;
  };
  serviceClaims: ClosureServiceClaimReadiness;
  finance: {
    vendorAP: ClosureVendorAPReadiness;
    customerAR: {
      modeled: boolean;
      blocking: boolean;
    };
  };
  documents: ClosureDocumentReadiness;
  physicalActualFinishCandidate: string | null;
  blockers: ClosureBlocker[];
  warnings: ClosureWarning[];
}

export interface ProjectClosure {
  id: number;
  projectId: number;
  cycleNumber: number;
  status: ProjectClosureStatus;
  submittedById: number;
  submittedAt: string;
  submissionNotes?: string | null;
  readinessSnapshot: any;
  acceptanceDocumentId: number;
  finalReportDocumentId: number;
  hooReviewerId?: number | null;
  hooReviewedAt?: string | null;
  hooNotes?: string | null;
  directorApproverId?: number | null;
  directorApprovedAt?: string | null;
  directorNotes?: string | null;
  returnActorId?: number | null;
  returnRole?: string | null;
  returnTimestamp?: string | null;
  returnReason?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  submittedBy?: {
    id: number;
    fullName?: string;
    email?: string;
  };
  hooReviewer?: {
    id: number;
    fullName?: string;
    email?: string;
  } | null;
  directorApprover?: {
    id: number;
    fullName?: string;
    email?: string;
  } | null;
  returnActor?: {
    id: number;
    fullName?: string;
    email?: string;
  } | null;
  acceptanceDocument?: {
    id: number;
    name?: string;
    category?: string;
    created_at?: string;
  } | null;
  finalReportDocument?: {
    id: number;
    name?: string;
    category?: string;
    created_at?: string;
  } | null;
  workflow?: {
    workflowInstanceId: number;
    workflowStatus: string;
    currentStep: string;
  } | null;
}

export interface SubmitClosureDto {
  submissionNotes?: string;
}

export interface ApproveClosureDto {
  notes?: string;
}

export interface ReturnClosureDto {
  reason: string;
}

// --- PROJECT SERVICE SSOT ---

/**
 * Canonical technical file size limit for documents (20 MB).
 * Replicated from backend Multer limits to guarantee client-side pre-flight rejection.
 */
export const MAX_DOCUMENT_FILE_SIZE_BYTES = DEFAULT_MAX_FILE_SIZE_BYTES;

/**
 * Operational timeout for evidence/document uploads (60,000 ms / 60 seconds).
 * Provides sufficient transmission window for up to 20MB multipart payloads under
 * enterprise network conditions without altering the global 15-second REST timeout.
 * NOTE: This is an operational timeout safeguard, not proof of historical incident threshold.
 */
export const UPLOAD_DOCUMENT_TIMEOUT_MS = UPLOAD_REQUEST_TIMEOUT_MS;

export class ProjectService {
  static readonly MAX_FILE_SIZE = MAX_DOCUMENT_FILE_SIZE_BYTES;
  static readonly UPLOAD_TIMEOUT_MS = UPLOAD_DOCUMENT_TIMEOUT_MS;
  // --- OPERATIONAL BOARD ---
  /**
   * Fetches operational board data (pending kickoff charters & active projects).
   */
  static async getOperationalBoard(): Promise<OperationalBoardData> {
    const res = await apiClient.get('/project/operational-board');
    const rawData = res.data?.data;
    const boardData =
      rawData &&
      typeof rawData === 'object' &&
      'data' in rawData &&
      rawData.data
        ? rawData.data
        : rawData || res.data || {};
    return {
      pendingKickoff: boardData.pendingKickoff || [],
      activeProjects: boardData.activeProjects || [],
      completedProjects: boardData.completedProjects || [],
    };
  }

  // --- CHARTER WORKFLOW & KICKOFF ---
  /**
   * Fetches eligible active Project Managers for PM assignment (PMO only).
   */
  static async getEligibleProjectManagers(): Promise<EligiblePmItem[]> {
    const res = await apiClient.get('/project/eligible-pms');
    return res.data?.data || res.data || [];
  }

  /**
   * Assigns an eligible Project Manager to a project/contract (PMO only).
   */
  static async assignProjectManager(
    projectIdOrCode: string | number,
    payload: AssignPmPayload
  ): Promise<CharterOperationResponse> {
    const res = await apiClient.post(`/project/${projectIdOrCode}/assign-pm`, payload);
    return res.data?.data || res.data;
  }


  /**
   * Formal Kick-off: Transitions project from PLANNING to IN_PROGRESS (R11.1.5 Governance Gate)
   */
  static async formalKickoff(
    projectId: number,
    payload: FormalKickoffPayload = {}
  ): Promise<CharterOperationResponse> {
    const res = await apiClient.post(`/project/${projectId}/kickoff`, payload);
    return res.data?.data || res.data;
  }

  /**
   * Rejects/returns a project charter back to marketing.
   */
  static async rejectCharter(
    charterId: number,
    payload: RejectCharterPayload
  ): Promise<CharterOperationResponse> {
    const res = await apiClient.patch(`/project/charters/${charterId}/reject`, payload);
    return res.data?.data || res.data;
  }

  // --- WBS API SSOT ---
  /**
   * Fetches flat WBS records for a specific project.
   */
  static async getWbsByProject(projectId: number): Promise<any[]> {
    const res = await apiClient.get(`/project/${projectId}/wbs`);
    return res.data?.data || res.data || [];
  }

  /**
   * Atomically saves / syncs full hierarchical WBS tree for a specific project.
   */
  static async saveWbsTree(
    projectId: number,
    payload: { nodes: any[] }
  ): Promise<any> {
    const res = await apiClient.put(`/project/${projectId}/wbs-tree`, payload);
    return res.data;
  }

  // --- COST / RAB API SSOT ---
  /**
   * Fetches canonical cost estimate (RAB) for a specific project.
   */
  static async getCostEstimate(projectId: number): Promise<CanonicalCostEstimateResponse> {
    const res = await apiClient.get(`/project/${projectId}/cost-estimate`);
    return res.data?.data || res.data;
  }

  /**
   * Atomically saves / updates cost estimate (RAB) for a specific project.
   */
  static async saveCostEstimate(projectId: number, payload: any): Promise<any> {
    const res = await apiClient.put(`/project/${projectId}/cost-estimate`, payload);
    return res.data?.data || res.data;
  }

  // --- SCHEDULE / GANTT API SSOT ---
  /**
   * Fetches canonical project schedule and tasks for a specific project.
   */
  static async getProjectSchedule(projectId: number): Promise<any> {
    const res = await apiClient.get(`/project/${projectId}/schedule`);
    return res.data?.data || res.data;
  }

  /**
   * Fetches authoritative project execution summary.
   */
  static async getProjectExecutionSummary(projectId: number): Promise<any> {
    const res = await apiClient.get(`/project/${projectId}/execution-summary`);
    return res.data?.data || res.data;
  }

  /**
   * Fetches authoritative project-scoped procurement summary read model (F4).
   */
  static async getProjectProcurementSummary(projectId: number): Promise<any> {
    const res = await apiClient.get(`/project/${projectId}/procurement-summary`);
    return res.data?.data || res.data;
  }

  /**
   * Fetches authoritative Project Control read model & variance engine (R1-26, R1-27).
   */
  static async getProjectControl(projectId: number, asOf?: string): Promise<any> {
    const url = asOf ? `/project/${projectId}/control?asOf=${encodeURIComponent(asOf)}` : `/project/${projectId}/control`;
    const res = await apiClient.get(url);
    return res.data?.data || res.data;
  }

  /**
   * Fetches authoritative Project Task Board read model (PROJECT-EXEC-F2-F3B).
   */
  static async getProjectTaskBoard(projectId: number): Promise<any> {
    const res = await apiClient.get(`/project/${projectId}/task-board`);
    return res.data?.data || res.data;
  }

  /**
   * Fetches authoritative Project Progress & Monitoring read model (PROJECT-EXEC-F2-F3C).
   */
  static async getProjectProgressMonitoring(projectId: number): Promise<any> {
    const res = await apiClient.get(`/project/${projectId}/progress-monitoring`);
    return res.data?.data || res.data;
  }

  /**
   * Fetches authoritative Project Gantt Baseline vs Actual read model (PROJECT-EXEC-F2-F3D).
   */
  static async getProjectGantt(projectId: number, asOf?: string): Promise<ProjectGanttResponse> {
    const params = asOf ? { asOf } : undefined;
    const res = await apiClient.get(`/project/${projectId}/gantt`, { params });
    return res.data?.data || res.data;
  }

  /**
   * Atomically saves / updates project schedule tasks for a specific project.
   */
  static async saveProjectSchedule(
    projectId: number,
    payload: { tasks: any[]; pmNotes?: string }
  ): Promise<any> {
    const res = await apiClient.put(`/project/${projectId}/schedule`, payload);
    return res.data?.data || res.data;
  }

  // --- INITIAL CONDITION API SSOT (R11.1.5-D) ---
  /**
   * Fetches canonical Initial Condition baseline for a specific project.
   */
  static async getInitialCondition(projectId: number): Promise<any> {
    const res = await apiClient.get(`/project/${projectId}/initial-condition`);
    return res.data?.data || res.data;
  }

  /**
   * Saves or updates canonical Initial Condition baseline for a specific project.
   */
  static async saveInitialCondition(projectId: number, payload: any): Promise<any> {
    const res = await apiClient.put(`/project/${projectId}/initial-condition`, payload);
    return res.data?.data || res.data;
  }

  // --- MANAGEMENT REVIEW / PROCUREMENT GATE API SSOT (R11.1.5-D) ---
  /**
   * Fetches canonical Management Review / Procurement Gate record for a specific project.
   */
  static async getManagementReview(projectId: number): Promise<any> {
    const res = await apiClient.get(`/project/${projectId}/management-review`);
    return res.data?.data || res.data;
  }

  /**
   * Submits project operational plan for management review (requires 4/4 ready pillars in DB).
   */
  static async submitManagementReview(projectId: number): Promise<any> {
    const res = await apiClient.post(`/project/${projectId}/management-review/submit`);
    return res.data?.data || res.data;
  }

  /**
   * Decides management review: Approve (READY_FOR_PROCUREMENT) or Request Revision (NEEDS_REVISION).
   */
  static async decideManagementReview(
    projectId: number,
    payload: { decision: 'READY_FOR_PROCUREMENT' | 'NEEDS_REVISION'; revisionNotes?: string | null }
  ): Promise<any> {
    const res = await apiClient.post(`/project/${projectId}/management-review/decide`, payload);
    return res.data?.data || res.data;
  }

  // --- OPERATIONAL READINESS ENGINE (R11.1.5-D) ---
  /**
   * Fetches canonical 4-pillar Operational Plan Readiness evaluated by Backend SSOT.
   */
  static async getOperationalReadiness(projectId: number): Promise<any> {
    const res = await apiClient.get(`/project/${projectId}/operational-readiness`);
    return res.data?.data || res.data;
  }

  // --- PROGRESS CLAIMS & VERIFICATION (P6.6) ---
  /**
   * Fetches active baseline metadata and overall progress (P6.6-3)
   */
  static async getProjectBaseline(projectId: number): Promise<any> {
    const res = await apiClient.get(`/project/${projectId}/baseline`);
    return res.data?.data || res.data;
  }

  /**
   * Fetches progress history / ledger logs for a specific project.
   */
  static async getProgressLogs(projectId: number): Promise<any[]> {
    const res = await apiClient.get(`/project/${projectId}/progress-logs`);
    return res.data?.data || res.data || [];
  }
  /**
   * Updates routine task progress after formal kickoff (CP3 / CP4).
   */
  static async updateTaskProgress(
    projectId: number,
    taskId: number,
    payload: UpdateTaskProgressPayload
  ): Promise<any> {
    const res = await apiClient.patch(
      `/project/${projectId}/tasks/${taskId}/progress`,
      payload
    );
    return res.data?.data || res.data;
  }

  /**
   * Uploads real progress evidence document attached to the project (CP10).
   * Implements pre-flight size gating (<= 20MB or caller-specified limit) and operational upload timeout (60s) via shared transport.
   */
  static async uploadEvidence(
    projectId: number,
    file: File,
    category?: string,
    maxSizeBytes?: number,
    onProgress?: (progressEvent: any) => void,
  ): Promise<{ id: number; fileName: string; filePath?: string; category?: string }> {
    if (!file) {
      throw new Error('Berkas tidak ditemukan. Silakan pilih berkas dokumen.');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', 'PROJECT');
    formData.append('entityId', String(projectId));
    if (category) {
      formData.append('category', category);
    }

    const res = await executeUpload({
      url: '/documents/upload',
      formData,
      file,
      maxSizeBytes: maxSizeBytes ?? MAX_DOCUMENT_FILE_SIZE_BYTES,
      onProgress,
    });

    const body = res.data;
    const documentRecord = body?.data?.data || body?.data || body;
    return documentRecord;
  }

  /**
   * Submits a critical or downward progress claim for a task.
   */
  static async createProgressClaim(
    projectId: number,
    taskId: number,
    payload: ProgressClaimPayload
  ): Promise<ProgressLogItem> {
    const res = await apiClient.post(
      `/project/${projectId}/tasks/${taskId}/progress-claims`,
      payload
    );
    return res.data?.data || res.data;
  }

  /**
   * Verifies (APPROVE / REJECT) a pending progress claim.
   */
  static async verifyProgressLog(
    projectId: number,
    logId: number,
    payload: VerifyProgressPayload
  ): Promise<ProgressLogItem> {
    const res = await apiClient.post(
      `/project/${projectId}/progress-logs/${logId}/verify`,
      payload
    );
    return res.data?.data || res.data;
  }

  // --- PROJECT MASTER AUTHORITATIVE DIRECTORY ---
  /**
   * Fetches lightweight Project Master directory projection with live counts and dynamic filters.
   */
  static async getProjectMaster(params?: {
    search?: string;
    status?: string;
    customerId?: number | string;
    managerId?: number | string;
    page?: number;
    limit?: number;
  }): Promise<ProjectMasterResponse> {
    const res = await apiClient.get('/project/master', { params });
    return res.data?.data || res.data;
  }

  /**
   * Fetches rich on-demand Project Master detail with authoritative 4-pillar readiness.
   */
  static async getProjectMasterDetail(projectId: number): Promise<ProjectMasterDetail> {
    const res = await apiClient.get(`/project/master/${projectId}`);
    return res.data?.data || res.data;
  }

  // --- PROJECT CLOSURE AUTHORITATIVE APIS (R1-C5) ---

  /**
   * Evaluates project closure readiness (Pure Read-Only SSOT).
   */
  static async getClosureReadiness(projectId: number): Promise<ClosureReadinessResult> {
    const res = await apiClient.get(`/projects/${projectId}/closure-readiness`);
    return res.data?.data || res.data;
  }

  /**
   * Fetches current active/latest Project Closure cycle and workflow orchestration status.
   */
  static async getCurrentClosure(projectId: number): Promise<ProjectClosure | null> {
    const res = await apiClient.get(`/projects/${projectId}/closure/current`);
    const rawData = res.data?.data !== undefined ? res.data.data : res.data;
    if (!rawData || typeof rawData !== 'object' || !rawData.id || !rawData.status) {
      return null;
    }
    return rawData;
  }

  /**
   * Fetches all Project Closure historical cycles.
   */
  static async getClosureHistory(projectId: number): Promise<ProjectClosure[]> {
    const res = await apiClient.get(`/projects/${projectId}/closure/history`);
    return res.data?.data || res.data || [];
  }

  /**
   * PM submits project closure initiation.
   */
  static async submitClosure(projectId: number, dto?: SubmitClosureDto): Promise<ProjectClosure> {
    const res = await apiClient.post(`/projects/${projectId}/closure/submit`, dto || {});
    return res.data?.data || res.data;
  }

  /**
   * HOO approves project closure review.
   */
  static async hooApproveClosure(
    projectId: number,
    closureId: number,
    dto?: ApproveClosureDto
  ): Promise<ProjectClosure> {
    const res = await apiClient.post(`/projects/${projectId}/closure/${closureId}/hoo/approve`, dto || {});
    return res.data?.data || res.data;
  }

  /**
   * HOO returns project closure review with mandatory non-empty reason.
   */
  static async hooReturnClosure(
    projectId: number,
    closureId: number,
    dto: ReturnClosureDto
  ): Promise<ProjectClosure> {
    const res = await apiClient.post(`/projects/${projectId}/closure/${closureId}/hoo/return`, dto);
    return res.data?.data || res.data;
  }

  /**
   * Director final approves project closure.
   */
  static async directorApproveClosure(
    projectId: number,
    closureId: number,
    dto?: ApproveClosureDto
  ): Promise<ProjectClosure> {
    const res = await apiClient.post(`/projects/${projectId}/closure/${closureId}/director/approve`, dto || {});
    return res.data?.data || res.data;
  }

  /**
   * Director returns project closure review with mandatory non-empty reason.
   */
  static async directorReturnClosure(
    projectId: number,
    closureId: number,
    dto: ReturnClosureDto
  ): Promise<ProjectClosure> {
    const res = await apiClient.post(`/projects/${projectId}/closure/${closureId}/director/return`, dto);
    return res.data?.data || res.data;
  }
}

export interface ProjectMasterItem {
  id: number;
  code: string;
  name: string;
  status: 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED';
  startDate: string | null;
  endDate: string | null;
  city: string | null;
  province: string | null;
  siteName: string | null;
  address: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  managerId: number | null;
  managerName: string | null;
  managerEmail: string | null;
  contractId: number | null;
  contractNumber: string | null;
  contractValue: number | null;
  contractStatus: string | null;
  legalStatus: string | null;
  spkFileUrl: string | null;
  customerId: number | null;
  customerName: string | null;
  tenderId: number | null;
  tenderTitle: string | null;
  marketingPicId: number | null;
  marketingPicName: string | null;
}

export interface ProjectMasterResponse {
  items: ProjectMasterItem[];
  total: number;
  summary: {
    totalProjects: number;
    planningCount: number;
    inProgressCount: number;
    completedCount: number;
  };
  filters: {
    customers: Array<{ id: number; name: string }>;
    projectManagers: Array<{ id: number; name: string }>;
    statuses: string[];
  };
}

export interface ProjectMasterDetail extends ProjectMasterItem {
  marketingPicEmail: string | null;
  actualKickoffDate: string | null;
  readiness?: {
    overallReadiness: boolean;
    missingPillars: string[];
    pillars: {
      wbs: { status: string; message: string; [key: string]: any };
      cost: { status: string; message: string; [key: string]: any };
      schedule: { status: string; message: string; [key: string]: any };
      initialCondition: { status: string; message: string; [key: string]: any };
    };
    gate: { status: string; label: string; [key: string]: any };
  } | null;
}

export interface ProjectGanttRow {
  id: string;
  type: 'WORK_PACKAGE' | 'TASK' | 'MILESTONE';
  wbsId: number;
  taskId: number | null;
  baselineItemId: number;
  parentId: number | null;
  depth: number;
  code: string;
  name: string;
  weight: number;
  isLeaf: boolean;
  isMilestone: boolean;

  plannedStart: string | null;
  plannedFinish: string | null;
  plannedDurationDays: number | null;

  actualStart: string | null;
  actualFinish: string | null;
  actualDurationDays: number | null;

  progress: number;
  plannedProgress: number | null;
  progressVariancePp: number | null;
  status: string;

  startVarianceDays: number | null;
  startDelayDays: number;
  finishVarianceDays: number | null;
  overdueDays: number;

  plannedDate?: string | null;
  actualDate?: string | null;
  milestoneVarianceDays?: number | null;
  milestoneOverdueDays?: number;

  childrenCount: number;
}

export interface ProjectGanttResponse {
  projectId: number;
  project: {
    id: number;
    code: string;
    name: string;
    status: string;
    customerName: string | null;
    managerName: string | null;
    managerId: number | null;
  };
  asOf: string;
  planComparisonAvailable: boolean;
  planComparisonUnavailableReason?: string | null;
  summary: {
    plannedStart: string | null;
    plannedFinish: string | null;
    actualStart: string | null;
    actualFinish: null; // Strictly NOT MODELED in F3D
    formalClosureModeled: false;
    plannedProgress: number | null;
    actualProgress: number | null;
    progressVariancePp: number | null;
    progressHealth: 'AHEAD' | 'ON_PLAN' | 'BEHIND' | null;
    overdueTasksCount: number;
    lateMilestonesCount: number;
    totalTasksCount: number;
    completedTasksCount: number;
    inProgressTasksCount: number;
    notStartedTasksCount: number;
  };
  timelineRange: {
    startDate: string;
    endDate: string;
    totalDays: number;
  };
  rows: ProjectGanttRow[];
}

export default ProjectService;

