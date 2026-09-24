import { Injectable, Logger } from '@nestjs/common';
import { WorkflowInstance } from '../../entities/workflow-instance.entity';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';
import { OperationalPlanStage } from './dto/operational-readiness.dto';

export type CanonicalBusinessStatus =
  | 'NOT_SUBMITTED'
  | 'REVIEW_PENDING'
  | 'READY_FOR_PROCUREMENT'
  | 'REVIEW_FINANCE'
  | 'REVIEW_DIRECTOR'
  | 'READY_FOR_KICKOFF'
  | 'NEEDS_REVISION'
  | 'UNKNOWN_WORKFLOW_STATE';

export interface WorkflowStepProjection {
  key: 'pm' | 'hoa' | 'proc' | 'fin' | 'dir';
  nodeKey: string;
  stage: number;
  role: string;
  roleTitle: string;
  stageName: string;
  status: 'COMPLETED' | 'ACTIVE' | 'WAITING' | 'REVISION_REQUESTED';
  stateLabel: string;
  actor?: string;
  completedAt?: string;
  notes?: string;
}

export interface CurrentWorkflowProjection {
  nodeKey: string;
  stage: number;
  totalStages: number;
  ownerRole: string;
  ownerName: string;
  label: string;
  position: string;
  nextStep: string;
  headerBadge: string;
  status: 'ACTIVE' | 'WAITING' | 'COMPLETED' | 'REVISION_REQUESTED' | 'UNKNOWN';
}

export interface WorkflowTransitionHistoryItem {
  id: number;
  taskId: number | null;
  fromNode: string;
  toNode: string;
  action: string;
  actorId: number | null;
  actorName: string;
  actorRole: string;
  comments: string | null;
  createdAt: string | Date;
}

export interface ProjectPlanWorkflowProjection {
  workflowInstanceId: number | null;
  runtimeStatus: string;
  businessStatus: CanonicalBusinessStatus;
  current: CurrentWorkflowProjection;
  steps: WorkflowStepProjection[];
  history: WorkflowTransitionHistoryItem[];
  lastApprovedBy: {
    id: number;
    name: string;
    role: string;
  } | null;
  lastApprovedRole: string | null;
  lastApprovedAt: string | Date | null;
  // Compatibility fields for legacy consumers
  instanceId?: number | null;
  currentNodeId?: string | null;
  status?: string | null;
}

@Injectable()
export class ProjectWorkflowProjectionService {
  private readonly logger = new Logger(ProjectWorkflowProjectionService.name);

  /**
   * Builds the single canonical projection from Workflow Engine Runtime and/or Management Review record.
   * This is the SOLE AUTHORITATIVE PROJECTION used by Kick-off Charter, Management Review Modal, and Dashboards.
   */
  public buildProjection(
    instance: WorkflowInstance | null,
    review?: ProjectManagementReview | null,
  ): ProjectPlanWorkflowProjection {
    // 1. If no workflow instance exists, project from legacy/database review record
    if (!instance) {
      return this.buildLegacyFallbackProjection(review);
    }

    const currentNodeId = instance.currentNodeId || '';
    const instanceStatus = instance.status || 'IN_PROGRESS';

    // 2. Parse transition history & last approved
    const { history, lastApprovedBy, lastApprovedRole, lastApprovedAt } =
      this.extractTransitionHistory(instance, review);

    // 3. Map canonical node properties
    const nodeMapping = this.mapNode(currentNodeId, instanceStatus, instance.id, instance.entityId);

    // 4. Build 5 canonical steps projection
    const steps = this.buildCanonicalSteps(
      currentNodeId,
      instanceStatus,
      history,
      instance.createdAt || (instance as any)?.created_at,
      (review as any)?.submittedByName || review?.submitter?.fullName || (instance.context as any)?.submittedByName,
    );

    return {
      workflowInstanceId: Number(instance.id),
      instanceId: Number(instance.id),
      runtimeStatus: instanceStatus,
      status: instanceStatus,
      currentNodeId: currentNodeId || null,
      businessStatus: nodeMapping.businessStatus,
      current: nodeMapping.current,
      steps,
      history,
      lastApprovedBy,
      lastApprovedRole,
      lastApprovedAt,
    };
  }

  /**
   * Thin DTO adapter converting canonical projection to legacy OperationalPlanStage enum.
   * Strictly transforms already-computed businessStatus/nodeKey without executing new workflow logic.
   */
  public toOperationalPlanStage(projection: ProjectPlanWorkflowProjection): OperationalPlanStage {
    switch (projection.businessStatus) {
      case 'READY_FOR_KICKOFF':
        return 'READY_FOR_KICKOFF';
      case 'NEEDS_REVISION':
        return 'NEEDS_REVISION';
      case 'REVIEW_FINANCE':
        return 'REVIEW_FINANCE';
      case 'REVIEW_DIRECTOR':
        return 'REVIEW_DIRECTOR';
      case 'READY_FOR_PROCUREMENT':
        return 'REVIEW_PROCUREMENT';
      case 'REVIEW_PENDING':
        return projection.current?.nodeKey === 'PM_PLANNING' ? 'READY_TO_SUBMIT' : 'REVIEW_HOPS';
      default:
        return 'NOT_STARTED';
    }
  }

  /**
   * Maps current node to business status and UI presentation attributes.
   */
  private mapNode(
    currentNodeId: string,
    instanceStatus: string,
    instanceId: number | string,
    projectId: number | string,
  ): { businessStatus: CanonicalBusinessStatus; current: CurrentWorkflowProjection } {
    // Terminal / Completed
    if (currentNodeId === 'node_end' || instanceStatus === 'COMPLETED') {
      return {
        businessStatus: 'READY_FOR_KICKOFF',
        current: {
          nodeKey: 'COMPLETED',
          stage: 5,
          totalStages: 5,
          ownerRole: 'PROJECT_MANAGER',
          ownerName: 'Project Manager',
          label: 'Ready for Kickoff',
          position: 'Ready for Kickoff (5 dari 5 Tahap Selesai)',
          nextStep: 'Kickoff Resmi oleh Project Manager (Handover ke PM)',
          headerBadge: 'READY FOR KICKOFF — DISETUJUI DIRECTOR',
          status: 'COMPLETED',
        },
      };
    }

    // Revision
    if (currentNodeId.startsWith('node_pm_revision')) {
      return {
        businessStatus: 'NEEDS_REVISION',
        current: {
          nodeKey: 'PM_REVISION',
          stage: 1,
          totalStages: 5,
          ownerRole: 'PROJECT_MANAGER',
          ownerName: 'Project Manager',
          label: 'Perbaikan Rencana Operasional',
          position: 'Perbaikan Operasional (Tahap 1 dari 5)',
          nextStep: 'Ajukan Ulang ke Management Review',
          headerBadge: 'NEEDS REVISION',
          status: 'REVISION_REQUESTED',
        },
      };
    }

    // Stage 1: PM Planning / Start
    if (currentNodeId === 'node_start' || currentNodeId === 'node_pm_planning') {
      return {
        businessStatus: 'REVIEW_PENDING',
        current: {
          nodeKey: 'PM_PLANNING',
          stage: 1,
          totalStages: 5,
          ownerRole: 'PROJECT_MANAGER',
          ownerName: 'Project Manager',
          label: 'Penyusunan Plan',
          position: 'Penyusunan Plan (Tahap 1 dari 5)',
          nextStep: 'Ajukan ke Management Review (Head of Operations)',
          headerBadge: 'DRAFT PM',
          status: 'ACTIVE',
        },
      };
    }

    // Stage 2: HOPS Review
    if (currentNodeId === 'node_hops_review') {
      return {
        businessStatus: 'REVIEW_PENDING',
        current: {
          nodeKey: 'HOPS_REVIEW',
          stage: 2,
          totalStages: 5,
          ownerRole: 'HEAD_OF_OPERATIONS',
          ownerName: 'Head of Operations',
          label: 'HOPS Review',
          position: 'Management Review (Tahap 2 dari 5)',
          nextStep: 'Keputusan Review dari Head of Operations',
          headerBadge: 'Menunggu Review (Head of Operations)',
          status: 'ACTIVE',
        },
      };
    }

    // Stage 3: Procurement Review
    if (currentNodeId === 'node_procurement_review') {
      return {
        businessStatus: 'READY_FOR_PROCUREMENT',
        current: {
          nodeKey: 'PROCUREMENT_REVIEW',
          stage: 3,
          totalStages: 5,
          ownerRole: 'PROCUREMENT',
          ownerName: 'Procurement Team',
          label: 'Procurement Review',
          position: 'Management Review (Tahap 3 dari 5)',
          nextStep: 'Keputusan Review dari Procurement Team',
          headerBadge: 'Menunggu Review (Procurement Team)',
          status: 'ACTIVE',
        },
      };
    }

    // Stage 4: Finance Review
    if (currentNodeId === 'node_finance_review') {
      return {
        businessStatus: 'REVIEW_FINANCE',
        current: {
          nodeKey: 'FINANCE_REVIEW',
          stage: 4,
          totalStages: 5,
          ownerRole: 'FINANCE',
          ownerName: 'Finance Team',
          label: 'Finance Review',
          position: 'Management Review (Tahap 4 dari 5)',
          nextStep: 'Keputusan Review dari Finance Team',
          headerBadge: 'Menunggu Review (Finance Team)',
          status: 'ACTIVE',
        },
      };
    }

    // Stage 5: Director Approval
    if (currentNodeId === 'node_director_approval') {
      return {
        businessStatus: 'REVIEW_DIRECTOR',
        current: {
          nodeKey: 'DIRECTOR_APPROVAL',
          stage: 5,
          totalStages: 5,
          ownerRole: 'DIRECTOR',
          ownerName: 'Director',
          label: 'Director Approval',
          position: 'Management Review (Tahap 5 dari 5)',
          nextStep: 'Persetujuan Akhir oleh Director',
          headerBadge: 'Menunggu Persetujuan Director',
          status: 'ACTIVE',
        },
      };
    }

    // Unknown node: Log explicitly, never silently default to HOPS
    this.logger.warn(
      `[ProjectWorkflowProjectionService] Unknown workflow node '${currentNodeId}' for Instance #${instanceId} (Project #${projectId}). Marking as UNKNOWN_WORKFLOW_STATE.`,
    );

    return {
      businessStatus: 'UNKNOWN_WORKFLOW_STATE',
      current: {
        nodeKey: currentNodeId || 'UNKNOWN_NODE',
        stage: 0,
        totalStages: 5,
        ownerRole: 'UNKNOWN',
        ownerName: 'Unknown',
        label: `Unknown State (${currentNodeId})`,
        position: `Unknown Workflow Node: ${currentNodeId}`,
        nextStep: 'Periksa alur kerja di Workflow Engine',
        headerBadge: `UNKNOWN NODE (${currentNodeId})`,
        status: 'UNKNOWN',
      },
    };
  }

  /**
   * Constructs the 5 canonical UI steps with provable statuses, timestamps, and actors.
   */
  private buildCanonicalSteps(
    currentNodeId: string,
    instanceStatus: string,
    history: WorkflowTransitionHistoryItem[],
    submissionTime?: Date | string,
    submitterName?: string,
  ): WorkflowStepProjection[] {
    const isCompleted = currentNodeId === 'node_end' || instanceStatus === 'COMPLETED';

    // Find approval transitions for each node
    const hopsApproval = history.find((h) => h.fromNode === 'node_hops_review' && h.action === 'APPROVE');
    const procApproval = history.find((h) => h.fromNode === 'node_procurement_review' && h.action === 'APPROVE');
    const finApproval = history.find((h) => h.fromNode === 'node_finance_review' && h.action === 'APPROVE');
    const dirApproval = history.find((h) => h.fromNode === 'node_director_approval' && h.action === 'APPROVE');

    // Find revision returns for each node
    const hopsRevision = history.find((h) => h.fromNode === 'node_hops_review' && h.action === 'RETURN');
    const procRevision = history.find((h) => h.fromNode === 'node_procurement_review' && h.action === 'RETURN');
    const finRevision = history.find((h) => h.fromNode === 'node_finance_review' && h.action === 'RETURN');
    const dirRevision = history.find((h) => h.fromNode === 'node_director_approval' && h.action === 'RETURN');

    // 1. PM Step
    const isPmRevision = currentNodeId.startsWith('node_pm_revision');
    const pmStep: WorkflowStepProjection = {
      key: 'pm',
      nodeKey: 'PM_PLANNING',
      stage: 1,
      role: 'PROJECT_MANAGER',
      roleTitle: 'Project Manager',
      stageName: 'Penyusunan Plan',
      status: isPmRevision ? 'REVISION_REQUESTED' : 'COMPLETED',
      stateLabel: isPmRevision ? 'Perbaikan' : 'Diajukan',
      actor: submitterName || 'Project Manager',
      completedAt: submissionTime ? new Date(submissionTime).toISOString() : undefined,
    };

    // 2. HOPS Step
    let hoaStatus: WorkflowStepProjection['status'] = 'WAITING';
    let hoaLabel = 'Menunggu';
    let hoaActor = hopsApproval?.actorName;
    let hoaTime = hopsApproval?.createdAt ? new Date(hopsApproval.createdAt).toISOString() : undefined;

    if (hopsApproval || procApproval || finApproval || dirApproval || isCompleted) {
      hoaStatus = 'COMPLETED';
      hoaLabel = 'Disetujui';
    } else if (currentNodeId === 'node_hops_review') {
      hoaStatus = 'ACTIVE';
      hoaLabel = 'Sedang Review';
    } else if (currentNodeId === 'node_pm_revision_hops' || hopsRevision) {
      hoaStatus = 'REVISION_REQUESTED';
      hoaLabel = 'Revision Requested';
      hoaActor = hopsRevision?.actorName;
      hoaTime = hopsRevision?.createdAt ? new Date(hopsRevision.createdAt).toISOString() : undefined;
    }

    const hoaStep: WorkflowStepProjection = {
      key: 'hoa',
      nodeKey: 'HOPS_REVIEW',
      stage: 2,
      role: 'HEAD_OF_OPERATIONS',
      roleTitle: 'Head of Operations',
      stageName: 'HOPS Review',
      status: hoaStatus,
      stateLabel: hoaLabel,
      actor: hoaActor,
      completedAt: hoaTime,
      notes: hopsRevision?.comments || undefined,
    };

    // 3. Procurement Step
    let procStatus: WorkflowStepProjection['status'] = 'WAITING';
    let procLabel = 'Menunggu';
    let procActor = procApproval?.actorName;
    let procTime = procApproval?.createdAt ? new Date(procApproval.createdAt).toISOString() : undefined;

    if (procApproval || finApproval || dirApproval || isCompleted) {
      procStatus = 'COMPLETED';
      procLabel = 'Disetujui';
    } else if (currentNodeId === 'node_procurement_review') {
      procStatus = 'ACTIVE';
      procLabel = 'Sedang Review';
    } else if (currentNodeId === 'node_pm_revision_procurement' || procRevision) {
      procStatus = 'REVISION_REQUESTED';
      procLabel = 'Revision Requested';
      procActor = procRevision?.actorName;
      procTime = procRevision?.createdAt ? new Date(procRevision.createdAt).toISOString() : undefined;
    }

    const procStep: WorkflowStepProjection = {
      key: 'proc',
      nodeKey: 'PROCUREMENT_REVIEW',
      stage: 3,
      role: 'PROCUREMENT',
      roleTitle: 'Procurement Team',
      stageName: 'Procurement Review',
      status: procStatus,
      stateLabel: procLabel,
      actor: procActor,
      completedAt: procTime,
      notes: procRevision?.comments || undefined,
    };

    // 4. Finance Step
    let finStatus: WorkflowStepProjection['status'] = 'WAITING';
    let finLabel = 'Menunggu';
    let finActor = finApproval?.actorName;
    let finTime = finApproval?.createdAt ? new Date(finApproval.createdAt).toISOString() : undefined;

    if (finApproval || dirApproval || isCompleted) {
      finStatus = 'COMPLETED';
      finLabel = 'Disetujui';
    } else if (currentNodeId === 'node_finance_review') {
      finStatus = 'ACTIVE';
      finLabel = 'Sedang Review';
    } else if (currentNodeId === 'node_pm_revision_finance' || finRevision) {
      finStatus = 'REVISION_REQUESTED';
      finLabel = 'Revision Requested';
      finActor = finRevision?.actorName;
      finTime = finRevision?.createdAt ? new Date(finRevision.createdAt).toISOString() : undefined;
    }

    const finStep: WorkflowStepProjection = {
      key: 'fin',
      nodeKey: 'FINANCE_REVIEW',
      stage: 4,
      role: 'FINANCE',
      roleTitle: 'Finance Team',
      stageName: 'Finance Review',
      status: finStatus,
      stateLabel: finLabel,
      actor: finActor,
      completedAt: finTime,
      notes: finRevision?.comments || undefined,
    };

    // 5. Director Step
    let dirStatus: WorkflowStepProjection['status'] = 'WAITING';
    let dirLabel = 'Menunggu';
    let dirActor = dirApproval?.actorName;
    let dirTime = dirApproval?.createdAt ? new Date(dirApproval.createdAt).toISOString() : undefined;

    if (dirApproval || isCompleted) {
      dirStatus = 'COMPLETED';
      dirLabel = 'Disetujui Final';
    } else if (currentNodeId === 'node_director_approval') {
      dirStatus = 'ACTIVE';
      dirLabel = 'Final Approval';
    } else if (currentNodeId === 'node_pm_revision_director' || dirRevision) {
      dirStatus = 'REVISION_REQUESTED';
      dirLabel = 'Revision Requested';
      dirActor = dirRevision?.actorName;
      dirTime = dirRevision?.createdAt ? new Date(dirRevision.createdAt).toISOString() : undefined;
    }

    const dirStep: WorkflowStepProjection = {
      key: 'dir',
      nodeKey: 'DIRECTOR_APPROVAL',
      stage: 5,
      role: 'DIRECTOR',
      roleTitle: 'Director',
      stageName: 'Director Approval',
      status: dirStatus,
      stateLabel: dirLabel,
      actor: dirActor,
      completedAt: dirTime,
      notes: dirRevision?.comments || undefined,
    };

    return [pmStep, hoaStep, procStep, finStep, dirStep];
  }

  /**
   * Extracts chronological transition history and resolves lastApprovedBy.
   */
  private extractTransitionHistory(
    instance: WorkflowInstance,
    review?: ProjectManagementReview | null,
  ): {
    history: WorkflowTransitionHistoryItem[];
    lastApprovedBy: { id: number; name: string; role: string } | null;
    lastApprovedRole: string | null;
    lastApprovedAt: string | Date | null;
  } {
    const history: WorkflowTransitionHistoryItem[] = [];
    let lastApprovedBy: { id: number; name: string; role: string } | null = null;
    let lastApprovedRole: string | null = null;
    let lastApprovedAt: string | Date | null = null;

    if (Array.isArray(instance.transitions)) {
      const sorted = [...instance.transitions].sort((a, b) => {
        const tA = new Date(a.createdAt || (a as any).created_at).getTime();
        const tB = new Date(b.createdAt || (b as any).created_at).getTime();
        return tA !== tB ? tA - tB : Number(a.id) - Number(b.id);
      });

      for (const t of sorted) {
        let roleName = 'USER';
        if (t.fromNodeId === 'node_hops_review') roleName = 'HEAD_OF_OPERATIONS';
        else if (t.fromNodeId === 'node_procurement_review') roleName = 'PROCUREMENT';
        else if (t.fromNodeId === 'node_finance_review') roleName = 'FINANCE';
        else if (t.fromNodeId === 'node_director_approval') roleName = 'DIRECTOR';
        else if (t.fromNodeId === 'node_pm_planning' || t.fromNodeId?.startsWith('node_pm_revision') || t.fromNodeId === 'INIT') {
          roleName = 'PROJECT_MANAGER';
        }

        const actorName = t.actor?.fullName || (t.actorId ? `User #${t.actorId}` : 'System');

        history.push({
          id: Number(t.id),
          taskId: t.taskId ? Number(t.taskId) : null,
          fromNode: t.fromNodeId,
          toNode: t.toNodeId,
          action: t.action,
          actorId: t.actorId ? Number(t.actorId) : null,
          actorName,
          actorRole: roleName,
          comments: t.reason || null,
          createdAt: t.createdAt || (t as any).created_at,
        });

        if (t.action === 'APPROVE') {
          lastApprovedBy = {
            id: Number(t.actorId),
            name: actorName,
            role: roleName,
          };
          lastApprovedRole = roleName;
          lastApprovedAt = t.createdAt || (t as any).created_at;
        }
      }
    }

    // Fallback if transitions has no APPROVE record yet review record has decidedBy
    if (!lastApprovedBy && review?.decidedBy && review?.decidedAt) {
      lastApprovedBy = {
        id: Number(review.decidedBy),
        name: review.decider?.fullName || `User #${review.decidedBy}`,
        role: review.reviewerRole || 'HEAD_OF_OPERATIONS',
      };
      lastApprovedRole = review.reviewerRole || 'HEAD_OF_OPERATIONS';
      lastApprovedAt = review.decidedAt;
    }

    return { history, lastApprovedBy, lastApprovedRole, lastApprovedAt };
  }

  /**
   * Fallback projection strictly for projects without an active workflow instance.
   */
  private buildLegacyFallbackProjection(
    review?: ProjectManagementReview | null,
  ): ProjectPlanWorkflowProjection {
    const rawStatus = (review?.status || 'NOT_SUBMITTED') as CanonicalBusinessStatus;
    let stage = 1;
    let nodeKey = 'PM_PLANNING';
    let ownerRole = 'PROJECT_MANAGER';
    let ownerName = 'Project Manager';
    let label = 'Penyusunan Plan';
    let position = 'Penyusunan Plan (Tahap 1 dari 5)';
    let nextStep = 'Ajukan ke Management Review (Head of Operations)';
    let headerBadge = 'DRAFT PM';

    if (rawStatus === 'READY_FOR_KICKOFF') {
      stage = 5;
      nodeKey = 'COMPLETED';
      ownerRole = 'PROJECT_MANAGER';
      ownerName = 'Project Manager';
      label = 'Ready for Kickoff';
      position = 'Governance Selesai (5 dari 5 Tahap)';
      nextStep = 'Kickoff Resmi oleh Project Manager (Handover ke PM)';
      headerBadge = 'READY FOR KICKOFF — DISETUJUI DIRECTOR';
    } else if (rawStatus === 'READY_FOR_PROCUREMENT') {
      stage = 3;
      nodeKey = 'PROCUREMENT_REVIEW';
      ownerRole = 'PROCUREMENT';
      ownerName = 'Procurement Team';
      label = 'Procurement Review';
      position = 'Management Review (Tahap 3 dari 5)';
      nextStep = 'Keputusan Review dari Procurement Team';
      headerBadge = 'Menunggu Review (Procurement Team)';
    } else if (rawStatus === 'REVIEW_PENDING') {
      stage = 2;
      nodeKey = 'HOPS_REVIEW';
      ownerRole = 'HEAD_OF_OPERATIONS';
      ownerName = 'Head of Operations';
      label = 'HOPS Review';
      position = 'Management Review (Tahap 2 dari 5)';
      nextStep = 'Keputusan Review dari Head of Operations';
      headerBadge = 'Menunggu Review (Head of Operations)';
    } else if (rawStatus === 'NEEDS_REVISION') {
      stage = 1;
      nodeKey = 'PM_REVISION';
      ownerRole = 'PROJECT_MANAGER';
      ownerName = 'Project Manager';
      label = 'Perbaikan Operasional';
      position = 'Perbaikan Operasional (Tahap 1 dari 5)';
      nextStep = 'Ajukan Ulang ke Head of Operations';
      headerBadge = 'NEEDS REVISION';
    }

    const steps: WorkflowStepProjection[] = [
      {
        key: 'pm',
        nodeKey: 'PM_PLANNING',
        stage: 1,
        role: 'PROJECT_MANAGER',
        roleTitle: 'Project Manager',
        stageName: 'Penyusunan Plan',
        status: stage > 1 ? 'COMPLETED' : 'ACTIVE',
        stateLabel: stage > 1 ? 'Diajukan' : 'Penyusunan',
        completedAt: review?.submittedAt ? new Date(review.submittedAt).toISOString() : undefined,
      },
      {
        key: 'hoa',
        nodeKey: 'HOPS_REVIEW',
        stage: 2,
        role: 'HEAD_OF_OPERATIONS',
        roleTitle: 'Head of Operations',
        stageName: 'HOPS Review',
        status: stage > 2 ? 'COMPLETED' : stage === 2 ? 'ACTIVE' : 'WAITING',
        stateLabel: stage > 2 ? 'Disetujui' : stage === 2 ? 'Sedang Review' : 'Menunggu',
        completedAt: stage > 2 && review?.decidedAt ? new Date(review.decidedAt).toISOString() : undefined,
      },
      {
        key: 'proc',
        nodeKey: 'PROCUREMENT_REVIEW',
        stage: 3,
        role: 'PROCUREMENT',
        roleTitle: 'Procurement Team',
        stageName: 'Procurement Review',
        status: stage > 3 ? 'COMPLETED' : stage === 3 ? 'ACTIVE' : 'WAITING',
        stateLabel: stage > 3 ? 'Disetujui' : stage === 3 ? 'Sedang Review' : 'Menunggu',
      },
      {
        key: 'fin',
        nodeKey: 'FINANCE_REVIEW',
        stage: 4,
        role: 'FINANCE',
        roleTitle: 'Finance Team',
        stageName: 'Finance Review',
        status: stage > 4 ? 'COMPLETED' : stage === 4 ? 'ACTIVE' : 'WAITING',
        stateLabel: stage > 4 ? 'Disetujui' : stage === 4 ? 'Sedang Review' : 'Menunggu',
      },
      {
        key: 'dir',
        nodeKey: 'DIRECTOR_APPROVAL',
        stage: 5,
        role: 'DIRECTOR',
        roleTitle: 'Director',
        stageName: 'Director Approval',
        status: stage === 5 && rawStatus === 'READY_FOR_KICKOFF' ? 'COMPLETED' : stage === 5 ? 'ACTIVE' : 'WAITING',
        stateLabel: stage === 5 && rawStatus === 'READY_FOR_KICKOFF' ? 'Disetujui Final' : stage === 5 ? 'Final Approval' : 'Menunggu',
      },
    ];

    const lastApprovedBy =
      review?.decidedBy && review?.decidedAt
        ? {
            id: Number(review.decidedBy),
            name: review.decider?.fullName || `User #${review.decidedBy}`,
            role: review.reviewerRole || 'HEAD_OF_OPERATIONS',
          }
        : null;

    return {
      workflowInstanceId: null,
      instanceId: null,
      runtimeStatus: 'NOT_STARTED',
      status: 'NOT_STARTED',
      currentNodeId: null,
      businessStatus: rawStatus,
      current: {
        nodeKey,
        stage,
        totalStages: 5,
        ownerRole,
        ownerName,
        label,
        position,
        nextStep,
        headerBadge,
        status: stage === 5 && rawStatus === 'READY_FOR_KICKOFF' ? 'COMPLETED' : 'ACTIVE',
      },
      steps,
      history: [],
      lastApprovedBy,
      lastApprovedRole: review?.reviewerRole || null,
      lastApprovedAt: review?.decidedAt || null,
    };
  }
}
