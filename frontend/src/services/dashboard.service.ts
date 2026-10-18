import { apiClient } from '@/lib/axios';

export type DashboardPeriodType =
  | 'YEAR_TO_DATE'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_QUARTER'
  | 'LAST_QUARTER'
  | 'ALL_TIME'
  | 'CUSTOM';

export interface ExecutiveSummaryResponse {
  meta: {
    generatedAt: string;
    period: {
      type: string;
      startDate: string;
      endDate: string;
    };
  };
  periodMetrics: {
    marketing: {
      totalPipeline: number;
      totalDeals: number;
      wonDeals: number;
      winRate: number; // percentage (e.g. 78.81)
      pipelineByStage: Array<{ stage: string; count: number }>;
      marketingTrend: Array<{ month: string; value: number }>;
    };
    accountsPayable: {
      invoiceCount: number;
      invoiceTotal: number;
      verifiedInvoiceCount: number;
      verifiedInvoiceValue: number;
      paidInvoiceCount: number;
      paidInvoiceValue: number;
    };
    vendorPayments: {
      paymentCount: number;
      paymentValue: number;
    };
    procurement: {
      prCount: number;
      pendingPrCount: number;
      approvedPrCount: number;
      poCount: number;
      poCommittedValue: number;
      goodsReceiptCount: number;
      goodsReceiptValue: number;
      completedPoCount: number;
      prToPoConversionRate: number; // percentage
      poToGrCompletionRate: number; // percentage
    };
  };
  currentSnapshot: {
    projects: {
      totalProjects: number;
      activeProjects: number;
      planningProjects: number;
      inProgressProjects: number;
      completedProjects: number;
      onHoldProjects: number;
      cancelledProjects: number;
      readyForKickoff: number; // True Ready Count (0)
      preKickoffContracts: number; // Pre-kickoff contracts (55)
      assignedProjectManagers: number;
      unassignedProjectManagers: number;
    };
    approvals: {
      totalPendingTasks: number;
      pendingByTaskKey: Array<{ taskKey: string; count: number }>;
      pendingByRole: {
        PMO: number;
        MARKETING: number;
        FINANCE: number;
        HEAD_OF_OPERATIONS: number;
        LEGAL: number;
        PROCUREMENT: number;
        PROJECT_MANAGER: number;
      };
    };
    accountsPayable: {
      outstandingInvoiceCount: number;
      outstandingInvoiceValue: number;
    };
    legal?: {
      pendingLegalReview: number;
      revisionExpired: number;
      activeContracts: number;
      revisionNeeded: number;
      totalContracts: number;
    };
  };
}

export interface RecentActivityItem {
  id: string | number;
  title: string;
  description?: string;
  category?: string;
  timestamp: string;
  actorName?: string;
  status?: string;
}

export class DashboardService {
  /**
   * Fetches authoritative executive management summary
   */
  static async getExecutiveSummary(params?: {
    period?: DashboardPeriodType | string;
    startDate?: string;
    endDate?: string;
  }): Promise<ExecutiveSummaryResponse> {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);

    const queryString = query.toString();
    const url = `/dashboard/executive-summary${queryString ? `?${queryString}` : ''}`;
    const res = await apiClient.get(url);
    const data = res.data?.data?.data || res.data?.data || res.data;
    return data;
  }

  /**
   * Fetches real recent activity feed.
   * Returns empty array directly since no canonical backend recent-activity endpoint
   * is deployed, eliminating the dead 404 HTTP request on dashboard entry.
   */
  static async getRecentActivity(): Promise<RecentActivityItem[]> {
    return [];
  }
}
