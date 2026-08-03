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
}

export interface OperationalBoardData {
  pendingKickoff: ProjectCharterItem[];
  activeProjects: ProjectCharterItem[];
}

export interface ClaimCharterPayload {
  estimatedStartDate: string;
  estimatedEndDate: string;
  initialWbsTasks?: Array<{ taskName: string; weightPercentage: number }>;
}

export interface RejectCharterPayload {
  reason: string;
}

export interface CharterOperationResponse {
  success?: boolean;
  message?: string;
  project_code?: string;
  id?: number;
  status?: string;
  [key: string]: any;
}

// --- PROJECT SERVICE SSOT ---

export class ProjectService {
  // --- OPERATIONAL BOARD ---
  /**
   * Fetches operational board data (pending kickoff charters & active projects).
   */
  static async getOperationalBoard(): Promise<OperationalBoardData> {
    const res = await apiClient.get('/project/operational-board');
    const boardData = res.data?.data?.data || res.data?.data || res.data;
    return {
      pendingKickoff: boardData.pendingKickoff || [],
      activeProjects: boardData.activeProjects || [],
    };
  }

  // --- CHARTER WORKFLOW & KICKOFF ---
  /**
   * Claims and kicks off a project charter.
   */
  static async claimCharter(
    charterCodeOrId: string | number,
    payload: ClaimCharterPayload
  ): Promise<CharterOperationResponse> {
    const res = await apiClient.patch(`/project/charters/${charterCodeOrId}/claim`, payload);
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
}

export default ProjectService;
