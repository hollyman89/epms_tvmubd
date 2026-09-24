import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ManagementReviewSyncService } from './management-review-sync.service';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { ProjectService } from './project.service';

describe('ManagementReviewSyncService & ProjectService Integration Tests', () => {
  let syncService: ManagementReviewSyncService;
  let projectService: ProjectService;

  let mockReviewRepo: any;
  let mockProjectRepo: any;
  let mockAuditRepo: any;
  let mockUserRepo: any;
  let mockInstanceRepo: any;
  let mockTaskRepo: any;
  let mockTransitionRepo: any;
  let mockDataSource: any;
  let mockManager: any;

  let inMemoryReviews: Map<number, any>;
  let inMemoryAudits: any[];

  beforeEach(async () => {
    inMemoryReviews = new Map();
    inMemoryAudits = [];

    mockManager = {
      findOne: jest.fn().mockImplementation((cls: any, opts: any) => {
        if (cls === ProjectManagementReview) {
          const pid = opts?.where?.projectId;
          return inMemoryReviews.get(pid) || null;
        }
        return null;
      }),
      find: jest.fn().mockImplementation((cls: any, opts: any) => {
        if (cls === AuditLog) {
          const recId = opts?.where?.record_id;
          return inMemoryAudits.filter((a) => a.record_id === recId);
        }
        return [];
      }),
      create: jest.fn().mockImplementation((cls: any, data: any) => {
        return { id: inMemoryAudits.length + 1, ...data };
      }),
      save: jest.fn().mockImplementation((cls: any, entity: any) => {
        if (cls === ProjectManagementReview || entity?.projectId !== undefined) {
          const id = entity.id || 101;
          const saved = { ...entity, id };
          inMemoryReviews.set(saved.projectId, saved);
          return saved;
        }
        if (cls === AuditLog || entity?.table_name === 'project_management_reviews') {
          const id = inMemoryAudits.length + 1;
          const saved = { ...entity, id };
          inMemoryAudits.push(saved);
          return saved;
        }
        return entity;
      }),
    };

    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb: (mgr: any) => Promise<any>) => {
        return await cb(mockManager);
      }),
    };

    mockReviewRepo = {
      findOne: jest.fn().mockImplementation((opts: any) => {
        const pid = opts?.where?.projectId;
        return inMemoryReviews.get(pid) || null;
      }),
      save: jest.fn().mockImplementation((entity: any) => {
        inMemoryReviews.set(entity.projectId, entity);
        return entity;
      }),
      create: jest.fn().mockImplementation((data: any) => data),
    };

    mockProjectRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 6, code: 'PRJ-006', name: 'Test Project 6' }),
    };

    mockAuditRepo = {
      find: jest.fn().mockImplementation(() => inMemoryAudits),
    };

    mockUserRepo = {
      findOne: jest.fn().mockImplementation((opts: any) => {
        const uid = opts?.where?.id;
        if (uid === 58) {
          return { id: 58, fullName: 'Hoa', roles: [{ name: 'HEAD_OF_OPERATIONS' }] };
        }
        return { id: uid, fullName: `User #${uid}`, roles: [] };
      }),
    };

    mockInstanceRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 2,
        entityType: 'PROJECT',
        entityId: 6,
        currentNodeId: 'node_procurement_review',
        status: 'IN_PROGRESS',
        tasks: [
          { id: 5, nodeId: 'node_hops_review', status: 'COMPLETED' },
          { id: 6, nodeId: 'node_procurement_review', status: 'PENDING' },
        ],
        transitions: [
          {
            id: 10,
            taskId: 5,
            fromNodeId: 'node_hops_review',
            toNodeId: 'node_procurement_review',
            action: 'APPROVE',
            actorId: 58,
            actor: { id: 58, fullName: 'Hoa' },
            createdAt: new Date('2026-09-21T08:33:48Z'),
          },
        ],
      }),
    };

    mockTaskRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    mockTransitionRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 10,
          taskId: 5,
          fromNodeId: 'node_hops_review',
          toNodeId: 'node_procurement_review',
          action: 'APPROVE',
          actorId: 58,
          actor: { id: 58, fullName: 'Hoa' },
          createdAt: new Date('2026-09-21T08:33:48Z'),
        },
      ]),
    };

    syncService = new ManagementReviewSyncService(
      mockReviewRepo,
      mockProjectRepo,
      mockAuditRepo,
      mockUserRepo,
      mockInstanceRepo,
      mockTaskRepo,
      mockTransitionRepo,
      mockDataSource,
      {} as any,
    );

    projectService = new ProjectService(
      {} as any,
      {} as any,
      mockProjectRepo,
      {} as any,
      mockUserRepo,
      {} as any,
      undefined,
      {} as any,
      {} as any,
      {} as any,
      mockReviewRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        getInstanceByEntity: jest.fn().mockResolvedValue({
          id: 2,
          entityType: 'PROJECT',
          entityId: 6,
          currentNodeId: 'node_procurement_review',
          status: 'IN_PROGRESS',
          tasks: [
            { id: 5, nodeId: 'node_hops_review', status: 'COMPLETED' },
            { id: 6, nodeId: 'node_procurement_review', status: 'PENDING' },
          ],
          transitions: [
            {
              id: 10,
              taskId: 5,
              fromNodeId: 'node_hops_review',
              toNodeId: 'node_procurement_review',
              action: 'APPROVE',
              actorId: 58,
              actor: { id: 58, fullName: 'Hoa' },
              createdAt: new Date('2026-09-21T08:33:48Z'),
            },
          ],
        }),
      } as any,
      undefined,
    );
  });

  describe('1. HOPS Approval Synchronization', () => {
    it('synchronizes project_management_reviews when HOPS approves task', async () => {
      inMemoryReviews.set(6, {
        id: 2,
        projectId: 6,
        status: 'REVIEW_PENDING',
        decidedBy: null,
        decidedAt: null,
        reviewerRole: null,
      });

      const payload = {
        workflowInstanceId: 2,
        taskId: 5,
        projectId: 6,
        entityType: 'PROJECT',
        fromNode: 'node_hops_review',
        toNode: 'node_procurement_review',
        action: 'APPROVE',
        decidedBy: 58,
        decidedAt: new Date('2026-09-21T08:33:48Z'),
        comments: 'Operational plan approved by HOPS',
      };

      const result = await syncService.syncManagementReviewFromWorkflow(payload);

      expect(result.synchronized).toBe(true);
      expect(result.status).toBe('READY_FOR_PROCUREMENT');
      expect(result.alreadySynced).toBe(false);

      const updated = inMemoryReviews.get(6);
      expect(updated).toBeDefined();
      expect(updated.status).toBe('READY_FOR_PROCUREMENT');
      expect(updated.decidedBy).toBe(58);
      expect(updated.reviewerRole).toBe('HEAD_OF_OPERATIONS');
      expect(updated.decidedAt).toEqual(new Date('2026-09-21T08:33:48Z'));

      expect(inMemoryAudits.length).toBe(1);
      expect(inMemoryAudits[0].action).toBe('PROJECT_PLAN_APPROVED');
      expect(inMemoryAudits[0].new_value.status).toBe('READY_FOR_PROCUREMENT');
      expect(inMemoryAudits[0].new_value.taskId).toBe(5);
    });
  });

  describe('2. Idempotency Protection on Duplicate Event', () => {
    it('ignores duplicate event: 1 projection update, 1 audit record, no duplicate history', async () => {
      inMemoryReviews.set(6, {
        id: 2,
        projectId: 6,
        status: 'REVIEW_PENDING',
        decidedBy: null,
        decidedAt: null,
      });

      const payload = {
        workflowInstanceId: 2,
        taskId: 5,
        projectId: 6,
        entityType: 'PROJECT',
        fromNode: 'node_hops_review',
        toNode: 'node_procurement_review',
        action: 'APPROVE',
        decidedBy: 58,
        decidedAt: new Date('2026-09-21T08:33:48Z'),
      };

      // First delivery
      const res1 = await syncService.syncManagementReviewFromWorkflow(payload);
      expect(res1.synchronized).toBe(true);
      expect(res1.alreadySynced).toBe(false);
      expect(inMemoryAudits.length).toBe(1);

      // Duplicate delivery (re-tried event)
      const res2 = await syncService.syncManagementReviewFromWorkflow(payload);
      expect(res2.synchronized).toBe(true);
      expect(res2.alreadySynced).toBe(true);

      // Audit logs MUST strictly stay at 1
      expect(inMemoryAudits.length).toBe(1);
    });
  });

  describe('3. PM API GET /project/:projectId/management-review', () => {
    it('returns authoritative Workflow Engine state combined with projection and approval history', async () => {
      inMemoryReviews.set(6, {
        id: 2,
        projectId: 6,
        status: 'READY_FOR_PROCUREMENT',
        submittedBy: 879,
        decidedBy: 58,
        decidedAt: new Date('2026-09-21T08:33:48Z'),
        reviewerRole: 'HEAD_OF_OPERATIONS',
      });

      const res = await projectService.getManagementReview(6);

      expect(res.status).toBe('READY_FOR_PROCUREMENT');
      expect(res.currentStep).toBe('PROCUREMENT_REVIEW');
      expect(res.currentOwner).toBe('Procurement Team');
      expect(res.lastApprovedBy).toEqual({
        id: 58,
        name: 'Hoa',
        role: 'HEAD_OF_OPERATIONS',
      });
      expect(res.lastApprovedAt).toBeDefined();
      expect(res.workflow).toMatchObject({
        instanceId: 2,
        currentNodeId: 'node_procurement_review',
        status: 'IN_PROGRESS',
      });
      expect(res.workflow.businessStatus).toBe('READY_FOR_PROCUREMENT');
      expect(Array.isArray(res.approvalHistory)).toBe(true);
      expect(res.approvalHistory.length).toBeGreaterThan(0);
      expect(res.approvalHistory[0].action).toBe('APPROVE');
      expect(res.approvalHistory[0].actorRole).toBe('HEAD_OF_OPERATIONS');
    });

    it('displays authoritative Workflow Engine state even if projection was stuck at REVIEW_PENDING', async () => {
      inMemoryReviews.set(6, {
        id: 2,
        projectId: 6,
        status: 'REVIEW_PENDING', // stale!
        submittedBy: 879,
        decidedBy: null,
        decidedAt: null,
      });

      const res = await projectService.getManagementReview(6);

      // Must show READY_FOR_PROCUREMENT from authoritative Workflow Engine node
      expect(res.status).toBe('READY_FOR_PROCUREMENT');
      expect(res.currentStep).toBe('PROCUREMENT_REVIEW');
      expect(res.currentOwner).toBe('Procurement Team');
      expect(res.lastApprovedBy?.role).toBe('HEAD_OF_OPERATIONS');
    });
  });

  describe('4. Stale Draft Protection', () => {
    it('blocks submitManagementReview when plan is already READY_FOR_PROCUREMENT (409 Conflict)', async () => {
      inMemoryReviews.set(6, {
        id: 2,
        projectId: 6,
        status: 'READY_FOR_PROCUREMENT',
      });

      jest.spyOn(projectService as any, 'getOperationalReadiness').mockResolvedValue({
        overallStatus: 'READY',
        completenessCount: 4,
      });
      jest.spyOn(projectService as any, 'validateProjectManagerOwnership').mockResolvedValue(true);

      await expect(
        projectService.submitManagementReview(6, 879, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('5. Phase 2B.11 — ManagementReviewSyncService Runtime SSOT Tests', () => {
    it('mirrors REVIEW_FINANCE when current runtime is node_finance_review regardless of transition payload', async () => {
      inMemoryReviews.set(6, {
        id: 2,
        projectId: 6,
        status: 'REVIEW_PENDING',
      });

      mockInstanceRepo.findOne.mockResolvedValueOnce({
        id: 2,
        entityType: 'PROJECT',
        entityId: 6,
        currentNodeId: 'node_finance_review',
        status: 'IN_PROGRESS',
        tasks: [{ id: 7, nodeId: 'node_finance_review', status: 'PENDING' }],
        transitions: [],
      });

      const payload = {
        workflowInstanceId: 2,
        taskId: 7,
        projectId: 6,
        entityType: 'PROJECT',
        fromNode: 'node_procurement_review',
        toNode: 'node_finance_review',
        action: 'APPROVE',
        decidedBy: 41,
        decidedAt: new Date(),
      };

      const result = await syncService.syncManagementReviewFromWorkflow(payload);
      expect(result.synchronized).toBe(true);
      expect(result.status).toBe('REVIEW_FINANCE');

      const updated = inMemoryReviews.get(6);
      expect(updated.status).toBe('REVIEW_FINANCE');
    });

    it('mirrors REVIEW_DIRECTOR when current runtime is node_director_approval', async () => {
      inMemoryReviews.set(6, {
        id: 2,
        projectId: 6,
        status: 'REVIEW_FINANCE',
      });

      mockInstanceRepo.findOne.mockResolvedValueOnce({
        id: 2,
        entityType: 'PROJECT',
        entityId: 6,
        currentNodeId: 'node_director_approval',
        status: 'IN_PROGRESS',
        tasks: [{ id: 8, nodeId: 'node_director_approval', status: 'PENDING' }],
        transitions: [],
      });

      const payload = {
        workflowInstanceId: 2,
        taskId: 8,
        projectId: 6,
        entityType: 'PROJECT',
        fromNode: 'node_finance_review',
        toNode: 'node_director_approval',
        action: 'APPROVE',
        decidedBy: 99,
        decidedAt: new Date(),
      };

      const result = await syncService.syncManagementReviewFromWorkflow(payload);
      expect(result.synchronized).toBe(true);
      expect(result.status).toBe('REVIEW_DIRECTOR');

      const updated = inMemoryReviews.get(6);
      expect(updated.status).toBe('REVIEW_DIRECTOR');
    });

    it('mirrors READY_FOR_KICKOFF when instance status is COMPLETED and node_end', async () => {
      inMemoryReviews.set(6, {
        id: 2,
        projectId: 6,
        status: 'REVIEW_DIRECTOR',
      });

      mockInstanceRepo.findOne.mockResolvedValueOnce({
        id: 2,
        entityType: 'PROJECT',
        entityId: 6,
        currentNodeId: 'node_end',
        status: 'COMPLETED',
        tasks: [{ id: 9, nodeId: 'node_director_approval', status: 'COMPLETED' }],
        transitions: [],
      });

      const payload = {
        workflowInstanceId: 2,
        taskId: 9,
        projectId: 6,
        entityType: 'PROJECT',
        fromNode: 'node_director_approval',
        toNode: 'node_end',
        action: 'APPROVE',
        decidedBy: 1,
        decidedAt: new Date(),
      };

      const result = await syncService.syncManagementReviewFromWorkflow(payload);
      expect(result.synchronized).toBe(true);
      expect(result.status).toBe('READY_FOR_KICKOFF');

      const updated = inMemoryReviews.get(6);
      expect(updated.status).toBe('READY_FOR_KICKOFF');
    });

    it('repairProjectManagementReviewProjection repairs stale mirror directly from current runtime', async () => {
      inMemoryReviews.set(6, {
        id: 2,
        projectId: 6,
        status: 'REVIEW_PENDING', // Stale!
      });

      mockInstanceRepo.findOne.mockResolvedValueOnce({
        id: 2,
        entityType: 'PROJECT',
        entityId: 6,
        currentNodeId: 'node_finance_review',
        status: 'IN_PROGRESS',
        tasks: [{ id: 7, nodeId: 'node_finance_review', status: 'PENDING' }],
        transitions: [],
      });

      const repaired = await syncService.repairProjectManagementReviewProjection(6);
      expect(repaired.status).toBe('REVIEW_FINANCE');
      expect(inMemoryReviews.get(6).status).toBe('REVIEW_FINANCE');
    });

    it('CASE 1 (Issue 1): event.action = REJECT with runtime at PM revision mirrors NEEDS_REVISION, NOT REJECTED', async () => {
      inMemoryReviews.set(6, {
        id: 2,
        projectId: 6,
        status: 'REVIEW_PENDING',
      });

      mockInstanceRepo.findOne.mockResolvedValueOnce({
        id: 2,
        entityType: 'PROJECT',
        entityId: 6,
        currentNodeId: 'node_pm_revision_hops',
        status: 'IN_PROGRESS',
        tasks: [{ id: 11, nodeId: 'node_pm_revision_hops', status: 'PENDING' }],
        transitions: [],
      });

      const payload = {
        workflowInstanceId: 2,
        taskId: 5,
        projectId: 6,
        entityType: 'PROJECT',
        fromNode: 'node_hops_review',
        toNode: 'node_pm_revision_hops',
        action: 'REJECT',
        decidedBy: 58,
        decidedAt: new Date(),
        comments: 'Revision requested by HOPS',
      };

      const result = await syncService.syncManagementReviewFromWorkflow(payload);
      expect(result.synchronized).toBe(true);
      expect(result.status).toBe('NEEDS_REVISION');
      expect(result.status).not.toBe('REJECTED');

      const updated = inMemoryReviews.get(6);
      expect(updated.status).toBe('NEEDS_REVISION');
    });

    it('CASE 2 (Issue 1): event.action = REJECT but runtime at node_finance_review mirrors REVIEW_FINANCE (runtime wins)', async () => {
      inMemoryReviews.set(6, {
        id: 2,
        projectId: 6,
        status: 'REVIEW_PENDING',
      });

      mockInstanceRepo.findOne.mockResolvedValueOnce({
        id: 2,
        entityType: 'PROJECT',
        entityId: 6,
        currentNodeId: 'node_finance_review',
        status: 'IN_PROGRESS',
        tasks: [{ id: 12, nodeId: 'node_finance_review', status: 'PENDING' }],
        transitions: [],
      });

      const payload = {
        workflowInstanceId: 2,
        taskId: 6,
        projectId: 6,
        entityType: 'PROJECT',
        fromNode: 'node_procurement_review',
        toNode: 'node_finance_review',
        action: 'REJECT',
        decidedBy: 41,
        decidedAt: new Date(),
        comments: 'Rejected by procurement but runtime is at finance',
      };

      const result = await syncService.syncManagementReviewFromWorkflow(payload);
      expect(result.synchronized).toBe(true);
      expect(result.status).toBe('REVIEW_FINANCE');

      const updated = inMemoryReviews.get(6);
      expect(updated.status).toBe('REVIEW_FINANCE');
    });
  });
});

