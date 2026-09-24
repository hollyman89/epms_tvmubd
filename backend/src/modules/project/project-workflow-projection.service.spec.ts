import { Test, TestingModule } from '@nestjs/testing';
import { ProjectWorkflowProjectionService } from './project-workflow-projection.service';
import { WorkflowInstance, WorkflowInstanceStatus } from '../../entities/workflow-instance.entity';
import { WorkflowTransition } from '../../entities/workflow-transition.entity';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';
import { User } from '../../entities/user.entity';

describe('ProjectWorkflowProjectionService', () => {
  let service: ProjectWorkflowProjectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectWorkflowProjectionService],
    }).compile();

    service = module.get<ProjectWorkflowProjectionService>(ProjectWorkflowProjectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('PHASE 4 & 5 — Canonical Node Mapping & Business Status', () => {
    it('1. PM Planning / Start -> PM_PLANNING, Stage 1/5, REVIEW_PENDING', () => {
      const instance = {
        id: 1,
        entityId: 10,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        currentNodeId: 'node_pm_planning',
        transitions: [],
      } as unknown as WorkflowInstance;

      const projection = service.buildProjection(instance);

      expect(projection.businessStatus).toBe('REVIEW_PENDING');
      expect(projection.current.nodeKey).toBe('PM_PLANNING');
      expect(projection.current.stage).toBe(1);
      expect(projection.current.totalStages).toBe(5);
      expect(projection.current.ownerRole).toBe('PROJECT_MANAGER');
      expect(projection.steps[0].status).toBe('COMPLETED');
      expect(projection.steps[1].status).toBe('WAITING');
    });

    it('2. HOPS Review -> HOPS_REVIEW, Stage 2/5, REVIEW_PENDING, HOPS active', () => {
      const instance = {
        id: 2,
        entityId: 10,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        currentNodeId: 'node_hops_review',
        transitions: [
          {
            id: 1,
            fromNodeId: 'INIT',
            toNodeId: 'node_hops_review',
            action: 'START',
            actorId: 100,
            actor: { fullName: 'Faza Afina' } as User,
            createdAt: new Date('2026-09-20T10:00:00Z'),
          } as WorkflowTransition,
        ],
      } as unknown as WorkflowInstance;

      const projection = service.buildProjection(instance);

      expect(projection.businessStatus).toBe('REVIEW_PENDING');
      expect(projection.current.nodeKey).toBe('HOPS_REVIEW');
      expect(projection.current.stage).toBe(2);
      expect(projection.current.ownerRole).toBe('HEAD_OF_OPERATIONS');
      expect(projection.current.ownerName).toBe('Head of Operations');
      expect(projection.steps[0].status).toBe('COMPLETED');
      expect(projection.steps[1].status).toBe('ACTIVE');
      expect(projection.steps[2].status).toBe('WAITING');
    });

    it('3. Procurement Review -> PROCUREMENT_REVIEW, Stage 3/5, READY_FOR_PROCUREMENT', () => {
      const instance = {
        id: 3,
        entityId: 10,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        currentNodeId: 'node_procurement_review',
        transitions: [
          {
            id: 1,
            fromNodeId: 'INIT',
            toNodeId: 'node_hops_review',
            action: 'START',
            actorId: 100,
            actor: { fullName: 'Faza Afina' } as User,
            createdAt: new Date('2026-09-20T10:00:00Z'),
          } as WorkflowTransition,
          {
            id: 2,
            fromNodeId: 'node_hops_review',
            toNodeId: 'node_procurement_review',
            action: 'APPROVE',
            actorId: 58,
            actor: { fullName: 'Hoa Approver' } as User,
            createdAt: new Date('2026-09-20T11:00:00Z'),
          } as WorkflowTransition,
        ],
      } as unknown as WorkflowInstance;

      const projection = service.buildProjection(instance);

      expect(projection.businessStatus).toBe('READY_FOR_PROCUREMENT');
      expect(projection.current.nodeKey).toBe('PROCUREMENT_REVIEW');
      expect(projection.current.stage).toBe(3);
      expect(projection.current.ownerRole).toBe('PROCUREMENT');
      expect(projection.current.ownerName).toBe('Procurement Team');
      expect(projection.steps[0].status).toBe('COMPLETED');
      expect(projection.steps[1].status).toBe('COMPLETED');
      expect(projection.steps[2].status).toBe('ACTIVE');
      expect(projection.steps[3].status).toBe('WAITING');
      expect(projection.lastApprovedBy?.name).toBe('Hoa Approver');
      expect(projection.lastApprovedRole).toBe('HEAD_OF_OPERATIONS');
    });

    it('4. Finance Review -> FINANCE_REVIEW, Stage 4/5, REVIEW_FINANCE, Finance active', () => {
      const instance = {
        id: 8,
        entityId: 20,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        currentNodeId: 'node_finance_review',
        transitions: [
          {
            id: 24,
            fromNodeId: 'INIT',
            toNodeId: 'node_hops_review',
            action: 'START',
            actorId: 879,
            actor: { fullName: 'Faza Afina' } as User,
            createdAt: new Date('2026-09-21T11:58:23Z'),
          } as WorkflowTransition,
          {
            id: 25,
            fromNodeId: 'node_hops_review',
            toNodeId: 'node_procurement_review',
            action: 'APPROVE',
            actorId: 58,
            actor: { fullName: 'Hoa' } as User,
            createdAt: new Date('2026-09-21T11:58:55Z'),
          } as WorkflowTransition,
          {
            id: 26,
            fromNodeId: 'node_procurement_review',
            toNodeId: 'node_finance_review',
            action: 'APPROVE',
            actorId: 41,
            actor: { fullName: 'purchasing' } as User,
            createdAt: new Date('2026-09-21T11:59:21Z'),
          } as WorkflowTransition,
        ],
      } as unknown as WorkflowInstance;

      const projection = service.buildProjection(instance);

      // Verify Canonical Output
      expect(projection.businessStatus).toBe('REVIEW_FINANCE');
      expect(projection.current.nodeKey).toBe('FINANCE_REVIEW');
      expect(projection.current.stage).toBe(4);
      expect(projection.current.totalStages).toBe(5);
      expect(projection.current.ownerRole).toBe('FINANCE');
      expect(projection.current.ownerName).toBe('Finance Team');
      expect(projection.current.position).toBe('Management Review (Tahap 4 dari 5)');
      expect(projection.current.nextStep).toBe('Keputusan Review dari Finance Team');

      // 5 Stage Cards
      expect(projection.steps[0].key).toBe('pm');
      expect(projection.steps[0].status).toBe('COMPLETED');
      expect(projection.steps[1].key).toBe('hoa');
      expect(projection.steps[1].status).toBe('COMPLETED');
      expect(projection.steps[1].actor).toBe('Hoa');
      expect(projection.steps[2].key).toBe('proc');
      expect(projection.steps[2].status).toBe('COMPLETED');
      expect(projection.steps[2].actor).toBe('purchasing');
      expect(projection.steps[3].key).toBe('fin');
      expect(projection.steps[3].status).toBe('ACTIVE');
      expect(projection.steps[4].key).toBe('dir');
      expect(projection.steps[4].status).toBe('WAITING');

      // Last Approved SSOT
      expect(projection.lastApprovedBy?.id).toBe(41);
      expect(projection.lastApprovedBy?.name).toBe('purchasing');
      expect(projection.lastApprovedRole).toBe('PROCUREMENT');
      expect(new Date(projection.lastApprovedAt!).toISOString()).toBe('2026-09-21T11:59:21.000Z');
    });

    it('5. Director Approval -> DIRECTOR_APPROVAL, Stage 5/5, REVIEW_DIRECTOR', () => {
      const instance = {
        id: 9,
        entityId: 20,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        currentNodeId: 'node_director_approval',
        transitions: [
          {
            id: 1,
            fromNodeId: 'node_finance_review',
            toNodeId: 'node_director_approval',
            action: 'APPROVE',
            actorId: 30,
            actor: { fullName: 'Finance Officer' } as User,
            createdAt: new Date('2026-09-21T12:30:00Z'),
          } as WorkflowTransition,
        ],
      } as unknown as WorkflowInstance;

      const projection = service.buildProjection(instance);

      expect(projection.businessStatus).toBe('REVIEW_DIRECTOR');
      expect(projection.current.nodeKey).toBe('DIRECTOR_APPROVAL');
      expect(projection.current.stage).toBe(5);
      expect(projection.current.ownerRole).toBe('DIRECTOR');
      expect(projection.steps[3].status).toBe('COMPLETED');
      expect(projection.steps[4].status).toBe('ACTIVE');
      expect(projection.lastApprovedBy?.name).toBe('Finance Officer');
      expect(projection.lastApprovedRole).toBe('FINANCE');
    });

    it('6. Completed / Terminal -> READY_FOR_KICKOFF, all 5 COMPLETED', () => {
      const instance = {
        id: 10,
        entityId: 20,
        status: WorkflowInstanceStatus.COMPLETED,
        currentNodeId: 'node_end',
        transitions: [
          {
            id: 5,
            fromNodeId: 'node_director_approval',
            toNodeId: 'node_end',
            action: 'APPROVE',
            actorId: 1,
            actor: { fullName: 'Director Main' } as User,
            createdAt: new Date('2026-09-21T14:00:00Z'),
          } as WorkflowTransition,
        ],
      } as unknown as WorkflowInstance;

      const projection = service.buildProjection(instance);

      expect(projection.businessStatus).toBe('READY_FOR_KICKOFF');
      expect(projection.current.nodeKey).toBe('COMPLETED');
      expect(projection.current.status).toBe('COMPLETED');
      expect(projection.steps.every((s) => s.status === 'COMPLETED')).toBe(true);
      expect(projection.lastApprovedBy?.name).toBe('Director Main');
      expect(projection.lastApprovedRole).toBe('DIRECTOR');
    });

    it('7. Revision Node -> NEEDS_REVISION, Stage 1/5, PM_REVISION', () => {
      const instance = {
        id: 11,
        entityId: 20,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        currentNodeId: 'node_pm_revision_finance',
        transitions: [
          {
            id: 10,
            fromNodeId: 'node_finance_review',
            toNodeId: 'node_pm_revision_finance',
            action: 'RETURN',
            reason: 'Budget over limit',
            actorId: 30,
            actor: { fullName: 'Finance Officer' } as User,
            createdAt: new Date('2026-09-21T13:00:00Z'),
          } as WorkflowTransition,
        ],
      } as unknown as WorkflowInstance;

      const projection = service.buildProjection(instance);

      expect(projection.businessStatus).toBe('NEEDS_REVISION');
      expect(projection.current.nodeKey).toBe('PM_REVISION');
      expect(projection.current.status).toBe('REVISION_REQUESTED');
      expect(projection.steps[0].status).toBe('REVISION_REQUESTED');
      expect(projection.steps[3].status).toBe('REVISION_REQUESTED');
      expect(projection.steps[3].notes).toBe('Budget over limit');
    });
  });

  describe('PHASE 10 — Unknown Node Handling', () => {
    it('MUST return UNKNOWN_WORKFLOW_STATE and never silently fallback to HOPS', () => {
      const instance = {
        id: 99,
        entityId: 999,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        currentNodeId: 'node_unsupported_future_step',
        transitions: [],
      } as unknown as WorkflowInstance;

      const projection = service.buildProjection(instance);

      expect(projection.businessStatus).toBe('UNKNOWN_WORKFLOW_STATE');
      expect(projection.current.status).toBe('UNKNOWN');
      expect(projection.current.nodeKey).toBe('node_unsupported_future_step');
      expect(projection.current.ownerRole).toBe('UNKNOWN');
      expect(projection.current.position).toContain('Unknown Workflow Node');
    });
  });

  describe('PHASE 12 — Strict Fallback Rule', () => {
    it('Should project from legacy review record when instance is null', () => {
      const review = {
        id: 5,
        projectId: 15,
        status: 'READY_FOR_PROCUREMENT',
        submittedAt: new Date('2026-09-20T08:00:00Z'),
        decidedAt: new Date('2026-09-20T09:00:00Z'),
        decidedBy: 58,
        reviewerRole: 'HEAD_OF_OPERATIONS',
        decider: { fullName: 'Hoa Legacy' } as User,
      } as unknown as ProjectManagementReview;

      const projection = service.buildProjection(null, review);

      expect(projection.workflowInstanceId).toBeNull();
      expect(projection.businessStatus).toBe('READY_FOR_PROCUREMENT');
      expect(projection.current.stage).toBe(3);
      expect(projection.steps[1].status).toBe('COMPLETED');
      expect(projection.steps[2].status).toBe('ACTIVE');
      expect(projection.lastApprovedBy?.name).toBe('Hoa Legacy');
    });
  });
});
