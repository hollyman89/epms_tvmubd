import { apiClient } from '@/lib/axios';

export interface WorkflowTask {
  id: number;
  workflowInstanceId: number;
  nodeId: string;
  taskKey: string;
  assigneeRoleId?: number | null;
  assigneeRole?: {
    id: number;
    name: string;
    description?: string;
  };
  assigneeUserId?: number | null;
  status: 'PENDING' | 'COMPLETED' | 'REJECTED' | 'RETURNED' | 'CANCELLED';
  action?: string | null;
  decidedBy?: number | null;
  decidedByUser?: {
    id: number;
    fullName?: string;
    email?: string;
  };
  decidedAt?: string | null;
  comments?: string | null;
  createdAt: string;
  updatedAt?: string;
  workflowInstance?: WorkflowInstance;
}

export interface WorkflowTransition {
  id: number;
  instanceId: number;
  taskId?: number | null;
  fromNodeId: string;
  toNodeId: string;
  action: string;
  actorId?: number | null;
  actor?: {
    id: number;
    fullName?: string;
    email?: string;
  };
  reason?: string | null;
  versionId: number;
  contextSnapshot?: any;
  createdAt: string;
}

export interface WorkflowInstance {
  id: number;
  workflowDefinitionId: number;
  workflowVersionId: number;
  entityType: string;
  entityId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'CANCELLED' | 'SUSPENDED';
  currentNodeId: string;
  context?: Record<string, any>;
  currentStateData?: Record<string, any>;
  completedAt?: string | null;
  createdAt: string;
  workflowDefinition?: {
    id: number;
    workflowKey: string;
    name: string;
    domain: string;
  };
  workflowVersion?: {
    id: number;
    version: number;
    status: string;
    bpmnJson?: any;
  };
  tasks?: WorkflowTask[];
  transitions?: WorkflowTransition[];
}

export interface StartWorkflowInstancePayload {
  workflowKey: string;
  entityType: string;
  entityId: string | number;
  context?: Record<string, any>;
}

export interface CompleteWorkflowTaskPayload {
  action: 'APPROVE' | 'REJECT' | 'RETURN' | string;
  reason?: string;
  contextUpdate?: Record<string, any>;
}

function extractData<T>(res: any): T {
  if (!res || !res.data) return res;
  let d = res.data;
  // Unwrap global TransformInterceptor { meta: ..., data: ... }
  if (d && typeof d === 'object' && 'data' in d && d.data !== undefined) {
    // If double wrapped by controller { statusCode, message, data: { ... } }
    if (d.data && typeof d.data === 'object' && 'data' in d.data && d.data.data !== undefined) {
      d = d.data.data;
    } else {
      d = d.data;
    }
  }
  return d as T;
}

export class WorkflowEngineService {
  /**
   * Start a new workflow instance from active published version
   */
  static async startInstance(payload: StartWorkflowInstancePayload): Promise<WorkflowInstance> {
    const res = await apiClient.post('/workflow/instances', payload);
    return extractData<WorkflowInstance>(res);
  }

  /**
   * Get workflow instance by ID with tasks and transitions
   */
  static async getInstance(id: number): Promise<WorkflowInstance> {
    const res = await apiClient.get(`/workflow/instances/${id}`);
    return extractData<WorkflowInstance>(res);
  }

  /**
   * Get all pending tasks assigned to current user or their roles
   */
  static async getMyTasks(): Promise<WorkflowTask[]> {
    const res = await apiClient.get('/workflow/tasks/mine');
    return extractData<WorkflowTask[]>(res) || [];
  }

  /**
   * Complete a workflow task with decision (APPROVE / REJECT / RETURN)
   */
  static async completeTask(
    instanceId: number,
    taskId: number,
    payload: CompleteWorkflowTaskPayload,
  ): Promise<{ task: WorkflowTask; instance: WorkflowInstance }> {
    const res = await apiClient.post(`/workflow/instances/${instanceId}/tasks/${taskId}/complete`, payload);
    return extractData<{ task: WorkflowTask; instance: WorkflowInstance }>(res);
  }

  /**
   * Get workflow instance transition history
   */
  static async getTransitions(instanceId: number): Promise<WorkflowTransition[]> {
    const res = await apiClient.get(`/workflow/instances/${instanceId}/transitions`);
    return extractData<WorkflowTransition[]>(res) || [];
  }

  /**
   * Get active workflow instance by entity type and ID
   */
  static async getInstanceByEntity(
    entityType: string,
    entityId: string | number,
    workflowKey?: string,
  ): Promise<WorkflowInstance | null> {
    const url = workflowKey
      ? `/workflow/instances/entity/${entityType}/${entityId}?workflowKey=${encodeURIComponent(workflowKey)}`
      : `/workflow/instances/entity/${entityType}/${entityId}`;
    const res = await apiClient.get(url);
    const data = extractData<any>(res);
    return (data && typeof data === 'object' && 'id' in data) ? (data as WorkflowInstance) : null;
  }
}

export default WorkflowEngineService;
