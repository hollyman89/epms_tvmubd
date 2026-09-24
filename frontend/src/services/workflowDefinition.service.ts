import { apiClient } from '@/lib/axios';

export const CANONICAL_WORKFLOW_KEYS = Object.freeze([
  'PROJECT_PLAN_REVIEW_WORKFLOW',
  'PURCHASE_REQUEST_WORKFLOW',
]);

export interface WorkflowDefinition {
  id: string | number;
  workflowKey: string;
  name: string;
  description: string | null;
  domain: string;
  activeVersion: number | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  isActive?: number | boolean;
  createdBy: string | number;
  createdAt: string;
  updatedAt: string;
  versions?: WorkflowVersion[];
}

export interface WorkflowVersion {
  id: string | number;
  workflowDefinitionId: string | number;
  version: number;
  bpmnJson: any; // { nodes: any[], edges: any[] }
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: string | null;
  createdBy: string | number;
  createdAt: string;
  updatedAt: string;
}

export class WorkflowDefinitionService {
  /**
   * Fetches all workflow definitions (excludes archived by default).
   */
  static async getDefinitions(includeArchived: boolean = false): Promise<WorkflowDefinition[]> {
    const res = await apiClient.get('/workflow/definitions', {
      params: includeArchived ? { includeArchived: 'true' } : undefined,
    });
    return res.data?.data || res.data || [];
  }

  /**
   * Fetches a specific workflow definition by key (includes versions).
   */
  static async getDefinitionByKey(workflowKey: string): Promise<WorkflowDefinition> {
    const res = await apiClient.get(`/workflow/definitions/${workflowKey}`);
    return res.data?.data || res.data;
  }

  /**
   * Creates a new workflow definition (automatically creates v1 DRAFT).
   */
  static async createDefinition(payload: { workflowKey: string; name: string; description?: string; domain?: string }): Promise<WorkflowDefinition> {
    const res = await apiClient.post('/workflow/definitions', payload);
    return res.data?.data || res.data;
  }

  /**
   * Creates a new version (clones from existing, or creates from scratch).
   */
  static async createVersion(workflowKey: string, payload?: { bpmnJson?: any }): Promise<WorkflowVersion> {
    const res = await apiClient.post(`/workflow/definitions/${workflowKey}/versions`, payload || {});
    return res.data?.data || res.data;
  }
  
  /**
   * Gets all versions of a workflow definition.
   */
  static async getVersions(workflowKey: string): Promise<WorkflowVersion[]> {
    const res = await apiClient.get(`/workflow/definitions/${workflowKey}/versions`);
    return res.data?.data || res.data || [];
  }

  /**
   * Gets a specific version of a workflow definition.
   */
  static async getVersion(workflowKey: string, version: number): Promise<WorkflowVersion> {
    const res = await apiClient.get(`/workflow/definitions/${workflowKey}/versions/${version}`);
    return res.data?.data || res.data;
  }

  /**
   * Saves a draft version.
   */
  static async updateVersion(workflowKey: string, version: number, bpmnJson: any): Promise<WorkflowVersion> {
    const res = await apiClient.put(`/workflow/definitions/${workflowKey}/versions/${version}`, { bpmnJson });
    return res.data?.data || res.data;
  }

  /**
   * Publishes a version.
   */
  static async publishVersion(workflowKey: string, version: number): Promise<WorkflowVersion> {
    const res = await apiClient.post(`/workflow/definitions/${workflowKey}/versions/${version}/publish`);
    return res.data?.data || res.data;
  }

  /**
   * Hard-deletes an unused DRAFT workflow definition (SUPER_ADMIN only).
   */
  static async deleteDefinition(keyOrId: string | number): Promise<any> {
    const res = await apiClient.delete(`/workflow/definitions/${keyOrId}`);
    return res.data?.data || res.data;
  }

  /**
   * Archives a workflow definition (SUPER_ADMIN only).
   */
  static async archiveDefinition(keyOrId: string | number): Promise<WorkflowDefinition> {
    const res = await apiClient.post(`/workflow/definitions/${keyOrId}/archive`);
    return res.data?.data || res.data;
  }
}

export default WorkflowDefinitionService;
