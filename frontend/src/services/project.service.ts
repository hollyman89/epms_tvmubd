import { apiClient } from '@/lib/axios';

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
  status: 'PENDING_KICKOFF' | 'IN_PROGRESS' | 'COMPLETED';
  created_at: string;
  overallProgress?: number;
  siteName?: string | null;
  city?: string | null;
  province?: string | null;
  address?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  [key: string]: any;
}

export interface OperationalBoardData {
  pendingKickoff: ProjectCharterItem[];
  activeProjects: ProjectCharterItem[];
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

// --- PROJECT SERVICE SSOT ---

export class ProjectService {
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
}

export default ProjectService;
