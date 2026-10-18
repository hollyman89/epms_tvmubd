import { apiClient } from '@/lib/axios';

export enum ProjectIssueStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum ProjectIssueSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ProjectIssuePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum ProjectRiskStatus {
  IDENTIFIED = 'IDENTIFIED',
  ASSESSED = 'ASSESSED',
  MITIGATING = 'MITIGATING',
  MONITORING = 'MONITORING',
  MATERIALIZED = 'MATERIALIZED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum ProjectRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ProjectIssueRiskCategory {
  TECHNICAL = 'TECHNICAL',
  SCHEDULE = 'SCHEDULE',
  COMMERCIAL = 'COMMERCIAL',
  PROCUREMENT = 'PROCUREMENT',
  FINANCIAL = 'FINANCIAL',
  RESOURCE = 'RESOURCE',
  QUALITY = 'QUALITY',
  SAFETY = 'SAFETY',
  EXTERNAL = 'EXTERNAL',
  OTHER = 'OTHER',
}

export interface ProjectIssueItem {
  id: number;
  projectId: number;
  taskId: number | null;
  issueNumber: string;
  title: string;
  description: string;
  category: ProjectIssueRiskCategory | string;
  severity: ProjectIssueSeverity | string;
  priority: ProjectIssuePriority | string;
  status: ProjectIssueStatus;
  ownerId: number;
  owner?: { id: number; fullName?: string; name?: string; email?: string };
  reportedById: number;
  reportedBy?: { id: number; fullName?: string; name?: string; email?: string };
  reportedAt: string;
  dueDate: string | null;
  resolution: string | null;
  resolvedById: number | null;
  resolvedBy?: { id: number; fullName?: string; name?: string; email?: string };
  resolvedAt: string | null;
  closedById: number | null;
  closedBy?: { id: number; fullName?: string; name?: string; email?: string };
  closedAt: string | null;
  sourceRiskId: number | null;
  task?: { id: number; name: string };
  version: number;
  createdAt: string;
  updatedAt: string;
  isOverdue?: boolean;
}

export interface ProjectRiskItem {
  id: number;
  projectId: number;
  taskId: number | null;
  riskNumber: string;
  title: string;
  description: string;
  category: ProjectIssueRiskCategory | string;
  probability: number | null;
  impact: number | null;
  riskScore: number | null;
  riskLevel: ProjectRiskLevel | string | null;
  status: ProjectRiskStatus;
  ownerId: number;
  owner?: { id: number; fullName?: string; name?: string; email?: string };
  identifiedById: number;
  identifiedBy?: { id: number; fullName?: string; name?: string; email?: string };
  identifiedAt: string;
  mitigationPlan: string | null;
  contingencyPlan: string | null;
  targetDate: string | null;
  reviewDate: string | null;
  closedById: number | null;
  closedBy?: { id: number; fullName?: string; name?: string; email?: string };
  closedAt: string | null;
  task?: { id: number; name: string };
  version: number;
  createdAt: string;
  updatedAt: string;
  isReviewOverdue?: boolean;
  materializedIssue?: {
    id: number;
    issueNumber: string;
    status: string;
    severity: string;
    priority: string;
    title: string;
  } | null;
}

export interface QueryIssuesParams {
  status?: string;
  severity?: string;
  priority?: string;
  category?: string;
  ownerId?: number;
  overdueOnly?: string;
  page?: number;
  limit?: number;
}

export interface QueryRisksParams {
  status?: string;
  riskLevel?: string;
  category?: string;
  ownerId?: number;
  reviewOverdueOnly?: string;
  page?: number;
  limit?: number;
}

export const ProjectIssueRiskService = {
  // =============================================================
  // ISSUE API
  // =============================================================
  async getIssues(
    projectId: number,
    params?: QueryIssuesParams
  ): Promise<{ data: ProjectIssueItem[]; total: number; page: number; limit: number }> {
    const res = await apiClient.get(`/project/${projectId}/issues`, { params });
    const payload = res.data?.data ?? res.data;
    const items = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
      ? payload
      : [];
    const total =
      typeof payload?.total === 'number'
        ? payload.total
        : items.length;
    const page = typeof payload?.page === 'number' ? payload.page : (params?.page || 1);
    const limit = typeof payload?.limit === 'number' ? payload.limit : (params?.limit || 10);
    return { data: items, total, page, limit };
  },

  async getIssueById(projectId: number, issueId: number): Promise<ProjectIssueItem> {
    const res = await apiClient.get(`/project/${projectId}/issues/${issueId}`);
    return res.data?.data ?? res.data;
  },

  async createIssue(projectId: number, data: any): Promise<ProjectIssueItem> {
    const res = await apiClient.post(`/project/${projectId}/issues`, data);
    return res.data?.data ?? res.data;
  },

  async updateIssue(projectId: number, issueId: number, data: any): Promise<ProjectIssueItem> {
    const res = await apiClient.patch(`/project/${projectId}/issues/${issueId}`, data);
    return res.data?.data ?? res.data;
  },

  async startIssue(projectId: number, issueId: number, expectedVersion: number): Promise<ProjectIssueItem> {
    const res = await apiClient.post(`/project/${projectId}/issues/${issueId}/start`, { expectedVersion });
    return res.data?.data ?? res.data;
  },

  async resolveIssue(projectId: number, issueId: number, expectedVersion: number, resolution: string): Promise<ProjectIssueItem> {
    const res = await apiClient.post(`/project/${projectId}/issues/${issueId}/resolve`, { expectedVersion, resolution });
    return res.data?.data ?? res.data;
  },

  async closeIssue(projectId: number, issueId: number, expectedVersion: number): Promise<ProjectIssueItem> {
    const res = await apiClient.post(`/project/${projectId}/issues/${issueId}/close`, { expectedVersion });
    return res.data?.data ?? res.data;
  },

  async reopenIssue(projectId: number, issueId: number, expectedVersion: number, reason: string): Promise<ProjectIssueItem> {
    const res = await apiClient.post(`/project/${projectId}/issues/${issueId}/reopen`, { expectedVersion, reason });
    return res.data?.data ?? res.data;
  },

  async cancelIssue(projectId: number, issueId: number, expectedVersion: number, reason: string): Promise<ProjectIssueItem> {
    const res = await apiClient.post(`/project/${projectId}/issues/${issueId}/cancel`, { expectedVersion, reason });
    return res.data?.data ?? res.data;
  },

  // =============================================================
  // RISK API
  // =============================================================
  async getRisks(
    projectId: number,
    params?: QueryRisksParams
  ): Promise<{ data: ProjectRiskItem[]; total: number; page: number; limit: number }> {
    const res = await apiClient.get(`/project/${projectId}/risks`, { params });
    const payload = res.data?.data ?? res.data;
    const items = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
      ? payload
      : [];
    const total =
      typeof payload?.total === 'number'
        ? payload.total
        : items.length;
    const page = typeof payload?.page === 'number' ? payload.page : (params?.page || 1);
    const limit = typeof payload?.limit === 'number' ? payload.limit : (params?.limit || 10);
    return { data: items, total, page, limit };
  },

  async getRiskById(projectId: number, riskId: number): Promise<ProjectRiskItem> {
    const res = await apiClient.get(`/project/${projectId}/risks/${riskId}`);
    return res.data?.data ?? res.data;
  },

  async createRisk(projectId: number, data: any): Promise<ProjectRiskItem> {
    const res = await apiClient.post(`/project/${projectId}/risks`, data);
    return res.data?.data ?? res.data;
  },

  async updateRisk(projectId: number, riskId: number, data: any): Promise<ProjectRiskItem> {
    const res = await apiClient.patch(`/project/${projectId}/risks/${riskId}`, data);
    return res.data?.data ?? res.data;
  },

  async assessRisk(projectId: number, riskId: number, expectedVersion: number, probability: number, impact: number): Promise<ProjectRiskItem> {
    const res = await apiClient.post(`/project/${projectId}/risks/${riskId}/assess`, {
      expectedVersion,
      probability,
      impact,
    });
    return res.data?.data ?? res.data;
  },

  async mitigateRisk(projectId: number, riskId: number, expectedVersion: number): Promise<ProjectRiskItem> {
    const res = await apiClient.post(`/project/${projectId}/risks/${riskId}/mitigate`, { expectedVersion });
    return res.data?.data ?? res.data;
  },

  async monitorRisk(projectId: number, riskId: number, expectedVersion: number): Promise<ProjectRiskItem> {
    const res = await apiClient.post(`/project/${projectId}/risks/${riskId}/monitor`, { expectedVersion });
    return res.data?.data ?? res.data;
  },

  async materializeRisk(projectId: number, riskId: number, data: { expectedVersion: number; severity: string; priority: string; dueDate?: string; ownerId?: number }): Promise<{ issue: ProjectIssueItem; risk: ProjectRiskItem }> {
    const res = await apiClient.post(`/project/${projectId}/risks/${riskId}/materialize`, data);
    return res.data?.data ?? res.data;
  },

  async closeRisk(projectId: number, riskId: number, expectedVersion: number): Promise<ProjectRiskItem> {
    const res = await apiClient.post(`/project/${projectId}/risks/${riskId}/close`, { expectedVersion });
    return res.data?.data ?? res.data;
  },

  async cancelRisk(projectId: number, riskId: number, expectedVersion: number, reason: string): Promise<ProjectRiskItem> {
    const res = await apiClient.post(`/project/${projectId}/risks/${riskId}/cancel`, { expectedVersion, reason });
    return res.data?.data ?? res.data;
  },

  async getEligibleOwners(projectId: number): Promise<{ id: number; name: string; email: string; roles: string[] }[]> {
    const res = await apiClient.get(`/project/${projectId}/eligible-owners`);
    const payload = res.data?.data ?? res.data;
    return Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
  },
};
