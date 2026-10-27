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
    division?: {
      id: string;
      name: string;
      code: string;
      scope: string;
      allocationStatus: string;
      marketingUser?: string;
      marketingEmail?: string;
    };
    unclassified?: {
      tendersCount: number;
      tendersValue: number;
      contractsCount: number;
      contractsValue: number;
      projectsCount: number;
      posCount: number;
      posValue: number;
      paymentsCount: number;
      paymentsValue: number;
    } | null;
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
      closedProjectsCount?: number;
      closedProjectsContractValue?: number;
      onHoldProjects: number;
      cancelledProjects: number;
      readyForKickoff: number; // True Ready Count (0)
      preKickoffContracts: number; // Pre-kickoff contracts (55)
      assignedProjectManagers: number;
      unassignedProjectManagers: number;
    };
    approvals: {
      scope?: string;
      isSharedWorkflow?: boolean;
      governanceNote?: string;
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
  analyticalCharts?: {
    contractsWonTrend: Array<{ month: string; monthNum: number; value: number; count: number }>;
    vendorPaymentsTrend: Array<{ month: string; monthNum: number; value: number; count: number }>;
    procurementCommitmentsTrend: Array<{ month: string; monthNum: number; value: number; count: number }>;
  };
  operationalTables?: {
    activeProjects: Array<{ id: number; name: string; contractNumber: string; status: string; progress: number }>;
    recentTenders: Array<{ id: number; title: string; customerName: string; val: number; stage: string }>;
    recentPurchaseOrders: Array<{ id: number; poNumber: string; vendorName: string; totalAmount: number; status: string }>;
    recentInvoices: Array<{ id: number; invoiceNumber: string; vendorName: string; totalAmount: number; paymentStatus: string }>;
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

export interface AuthorizedDivision {
  id: string;
  name: string;
  code: string;
  isDefault?: boolean;
  scope?: string;
}

export interface AuthorizedDivisionsResponse {
  availableDivisions: AuthorizedDivision[];
  subDivisionEnabled: boolean;
  governanceStatus: string;
  message?: string;
}

export class DashboardService {
  /**
   * Fetches authoritative executive management summary
   */
  static async getExecutiveSummary(params?: {
    period?: DashboardPeriodType | string;
    startDate?: string;
    endDate?: string;
    divisionId?: string;
  }): Promise<ExecutiveSummaryResponse> {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.divisionId) query.append('divisionId', params.divisionId);

    const queryString = query.toString();
    const url = `/dashboard/executive-summary${queryString ? `?${queryString}` : ''}`;
    const res = await apiClient.get(url);
    const data = res.data?.data?.data || res.data?.data || res.data;
    return data;
  }

  /**
   * Fetches authorized divisions for executive filtering
   */
  static async getAuthorizedDivisions(): Promise<AuthorizedDivisionsResponse> {
    try {
      const res = await apiClient.get('/dashboard/divisions');
      const data = res.data?.data?.data || res.data?.data || res.data;
      return data;
    } catch {
      return {
        availableDivisions: [
          { id: 'ALL', name: 'Semua Divisi', code: 'ALL', isDefault: true, scope: 'INSTALLATION' },
        ],
        subDivisionEnabled: false,
        governanceStatus: 'DIVISION ALLOCATION RULE NOT VERIFIED',
      };
    }
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
