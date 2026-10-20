import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OperationalReadinessValidator } from './operational-readiness.validator';
import { CostEstimateValidator } from './cost-estimate.validator';
import { ScheduleValidator } from './schedule.validator';
import { InitialConditionValidator } from './initial-condition.validator';
import { ManagementReviewValidator } from './management-review.validator';
import { ProjectWorkflowProjectionService } from './project-workflow-projection.service';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { Project } from '../../entities/project.entity';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { Task } from '../../entities/task.entity';
import { ProjectInitialCondition } from '../../entities/project-initial-condition.entity';
import { Contract } from '../../entities/contract.entity';
import { User } from '../../entities/user.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';

describe('PM Revision Resubmit Gate & Canonical Post-Return Persistence Contract', () => {
  let validator: OperationalReadinessValidator;

  beforeEach(() => {
    validator = new OperationalReadinessValidator();
  });

  describe('OperationalReadinessValidator.evaluateRevisionPersistence', () => {
    const returnTime = new Date('2026-10-20T10:00:00.000Z');
    const beforeReturnTime = new Date('2026-10-20T09:00:00.000Z');
    const afterReturnTime = new Date('2026-10-20T11:00:00.000Z');

    const baseReview: Partial<ProjectManagementReview> = {
      id: 5,
      projectId: 5,
      status: 'NEEDS_REVISION',
      decidedAt: returnTime,
      revisionNotes: 'RUGI BOYYYYYYYYYYYYY',
    };

    const baseWorkflowInstance = {
      id: 20,
      currentNodeId: 'node_pm_revision_procurement',
      status: 'IN_PROGRESS',
      tasks: [
        {
          id: 39,
          nodeId: 'node_pm_revision_procurement',
          taskKey: 'PM Plan Revision (Procurement)',
          status: 'PENDING',
          createdAt: returnTime,
        },
      ],
      transitions: [
        {
          fromNodeId: 'node_procurement_review',
          toNodeId: 'node_pm_revision_procurement',
          action: 'RETURN',
          createdAt: returnTime,
        },
      ],
    };

    it('1. Initial Management Review / Non-revision workflow defaults to hasPersistedRevisionAfterReturn = true', () => {
      const nonRevReview: Partial<ProjectManagementReview> = {
        id: 1,
        projectId: 10,
        status: 'NOT_SUBMITTED',
      };
      const nonRevWorkflow = {
        id: 1,
        currentNodeId: 'node_pm_planning',
        status: 'IN_PROGRESS',
      };

      const result = validator.evaluateRevisionPersistence(
        nonRevReview as any,
        nonRevWorkflow as any,
        [],
        null,
        [],
        [],
        null,
      );
      expect(result).toBe(true);
    });

    it('2. Revision node + no persisted change after return -> false', () => {
      const result = validator.evaluateRevisionPersistence(
        baseReview as any,
        baseWorkflowInstance as any,
        [],
        null,
        [],
        [],
        null,
      );
      expect(result).toBe(false);
    });

    it('3. Revision node + change persisted before return only -> false', () => {
      const oldEstimate: Partial<ProjectCostEstimate> = {
        id: 1,
        projectId: 5,
        updatedAt: beforeReturnTime,
        createdAt: beforeReturnTime,
      };
      const oldWbs: Partial<WorkBreakdownStructure>[] = [
        {
          id: 1,
          projectId: 5,
          updatedAt: beforeReturnTime,
          createdAt: beforeReturnTime,
        },
      ];
      const oldTasks: Partial<Task>[] = [
        {
          id: 1,
          projectId: 5,
          updatedAt: beforeReturnTime,
          createdAt: beforeReturnTime,
        },
      ];

      const result = validator.evaluateRevisionPersistence(
        baseReview as any,
        baseWorkflowInstance as any,
        oldWbs as any,
        oldEstimate as any,
        [],
        oldTasks as any,
        null,
      );
      expect(result).toBe(false);
    });

    it('4. Revision node + Cost/RAB persisted after return -> true', () => {
      const newEstimate: Partial<ProjectCostEstimate> = {
        id: 1,
        projectId: 5,
        updatedAt: afterReturnTime,
        createdAt: beforeReturnTime,
      };

      const result = validator.evaluateRevisionPersistence(
        baseReview as any,
        baseWorkflowInstance as any,
        [],
        newEstimate as any,
        [],
        [],
        null,
      );
      expect(result).toBe(true);
    });

    it('4b. Revision node + CostItem updated after return -> true', () => {
      const oldEstimate: Partial<ProjectCostEstimate> = {
        id: 1,
        projectId: 5,
        updatedAt: beforeReturnTime,
        createdAt: beforeReturnTime,
      };
      const updatedCostItem: Partial<CostItem> = {
        id: 101,
        estimateId: 1,
        updatedAt: afterReturnTime,
        createdAt: beforeReturnTime,
      };

      const result = validator.evaluateRevisionPersistence(
        baseReview as any,
        baseWorkflowInstance as any,
        [],
        oldEstimate as any,
        [updatedCostItem as any],
        [],
        null,
      );
      expect(result).toBe(true);
    });

    it('5. Revision node + WBS persisted after return -> true', () => {
      const updatedWbs: Partial<WorkBreakdownStructure>[] = [
        {
          id: 10,
          projectId: 5,
          updatedAt: afterReturnTime,
          createdAt: beforeReturnTime,
        },
      ];

      const result = validator.evaluateRevisionPersistence(
        baseReview as any,
        baseWorkflowInstance as any,
        updatedWbs as any,
        null,
        [],
        [],
        null,
      );
      expect(result).toBe(true);
    });

    it('6. Revision node + Schedule persisted after return -> true', () => {
      const updatedTask: Partial<Task>[] = [
        {
          id: 25,
          projectId: 5,
          updatedAt: afterReturnTime,
          createdAt: beforeReturnTime,
        },
      ];

      const result = validator.evaluateRevisionPersistence(
        baseReview as any,
        baseWorkflowInstance as any,
        [],
        null,
        [],
        updatedTask as any,
        null,
      );
      expect(result).toBe(true);
    });

    it('7. Revision node + Initial Condition persisted after return -> true', () => {
      const updatedInitialCondition: Partial<ProjectInitialCondition> = {
        id: 5,
        projectId: 5,
        updatedAt: afterReturnTime,
        createdAt: beforeReturnTime,
      };

      const result = validator.evaluateRevisionPersistence(
        baseReview as any,
        baseWorkflowInstance as any,
        [],
        null,
        [],
        [],
        updatedInitialCondition as any,
      );
      expect(result).toBe(true);
    });
  });

  describe('ProjectService.submitManagementReview Resubmit Gate Integration', () => {
    let service: ProjectService;
    let mockProjectRepo: any;
    let mockManagementReviewRepo: any;
    let mockWfService: any;
    let mockManager: any;

    beforeEach(async () => {
      mockManager = {
        findOne: jest.fn().mockResolvedValue({ id: 1, projectId: 5, status: 'NEEDS_REVISION' }),
        save: jest.fn().mockResolvedValue({ id: 1, projectId: 5, status: 'REVIEW_PENDING' }),
      };
      mockProjectRepo = {
        findOne: jest.fn(),
      };
      mockManagementReviewRepo = {
        findOne: jest.fn(),
        manager: {
          transaction: jest.fn(async (cb) => cb(mockManager)),
        },
      };
      mockWfService = {
        getInstanceByEntity: jest.fn(),
        completeTask: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [ProjectController],
        providers: [
          ProjectService,
          CostEstimateValidator,
          ScheduleValidator,
          OperationalReadinessValidator,
          InitialConditionValidator,
          ManagementReviewValidator,
          { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
          { provide: getRepositoryToken(WorkBreakdownStructure), useValue: { find: jest.fn().mockResolvedValue([]) } },
          { provide: getRepositoryToken(Task), useValue: { find: jest.fn().mockResolvedValue([]) } },
          { provide: getRepositoryToken(Contract), useValue: { findOne: jest.fn().mockResolvedValue(null) } },
          { provide: getRepositoryToken(User), useValue: { findOne: jest.fn().mockResolvedValue(null), find: jest.fn().mockResolvedValue([]) } },
          { provide: getRepositoryToken(ProjectCostEstimate), useValue: { findOne: jest.fn().mockResolvedValue(null) } },
          { provide: getRepositoryToken(CostItem), useValue: { find: jest.fn().mockResolvedValue([]) } },
          { provide: getRepositoryToken(ProjectInitialCondition), useValue: { findOne: jest.fn().mockResolvedValue(null) } },
          { provide: getRepositoryToken(ProjectManagementReview), useValue: mockManagementReviewRepo },
          { provide: getRepositoryToken(PurchaseRequest), useValue: { find: jest.fn().mockResolvedValue([]) } },
          { provide: EventEmitter2, useValue: new EventEmitter2() },
        ],
      }).compile();

      service = module.get<ProjectService>(ProjectService);

      // Inject workflow engine & projection service
      (service as any).workflowEngineService = mockWfService;
      (service as any).projectWorkflowProjectionService = new ProjectWorkflowProjectionService();
    });

    it('8. 4/4 READY but no post-return save -> backend RESUBMIT rejected with clear message', async () => {
      const project = { id: 5, managerId: 38, status: 'PLANNING' };
      mockProjectRepo.findOne.mockResolvedValue(project);

      // Mock getOperationalReadiness returning 4/4 READY but hasPersistedRevisionAfterReturn = false
      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        projectId: 5,
        projectCode: 'PR26002041',
        projectName: 'Asianet',
        overallStatus: 'READY',
        completenessCount: 4,
        totalPillars: 4,
        canSubmitForReview: true,
        canCreatePr: false,
        pillars: {} as any,
        gate: { status: 'NEEDS_REVISION' } as any,
        hasPersistedRevisionAfterReturn: false,
      });

      const activeInstance = {
        id: 20,
        status: 'IN_PROGRESS',
        currentNodeId: 'node_pm_revision_procurement',
        tasks: [
          {
            id: 39,
            nodeId: 'node_pm_revision_procurement',
            taskKey: 'PM Plan Revision (Procurement)',
            status: 'PENDING',
          },
        ],
      };
      mockWfService.getInstanceByEntity.mockResolvedValue(activeInstance);

      await expect(
        service.submitManagementReview(5, 38, ['PROJECT_MANAGER']),
      ).rejects.toThrow(
        new BadRequestException('Operational Plan revision must be saved before resubmission.'),
      );

      expect(mockWfService.completeTask).not.toHaveBeenCalled();
    });

    it('9. 4/4 READY + post-return persisted revision -> backend RESUBMIT allowed to proceed to workflow transition', async () => {
      const project = { id: 5, managerId: 38, status: 'PLANNING' };
      mockProjectRepo.findOne.mockResolvedValue(project);

      // Mock getOperationalReadiness returning 4/4 READY AND hasPersistedRevisionAfterReturn = true
      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        projectId: 5,
        projectCode: 'PR26002041',
        projectName: 'Asianet',
        overallStatus: 'READY',
        completenessCount: 4,
        totalPillars: 4,
        canSubmitForReview: true,
        canCreatePr: false,
        pillars: {} as any,
        gate: { status: 'NEEDS_REVISION' } as any,
        hasPersistedRevisionAfterReturn: true,
      });

      const activeInstance = {
        id: 20,
        status: 'IN_PROGRESS',
        currentNodeId: 'node_pm_revision_procurement',
        tasks: [
          {
            id: 39,
            nodeId: 'node_pm_revision_procurement',
            taskKey: 'PM Plan Revision (Procurement)',
            status: 'PENDING',
          },
        ],
      };
      mockWfService.getInstanceByEntity.mockResolvedValue(activeInstance);

      const res = await service.submitManagementReview(5, 38, ['PROJECT_MANAGER']);
      expect(res).toBeDefined();

      // Proves completeTask was called with action: 'RESUBMIT'
      expect(mockWfService.completeTask).toHaveBeenCalledWith(
        39,
        {
          action: 'RESUBMIT',
          reason: 'Rencana operasional telah direvisi oleh PM dan diajukan ulang.',
        },
        38,
        ['PROJECT_MANAGER'],
      );
    });

    it('10. Procurement-return specimen completes the revision task with RESUBMIT (routes to Procurement, not HOO)', async () => {
      const project = { id: 5, managerId: 38, status: 'PLANNING' };
      mockProjectRepo.findOne.mockResolvedValue(project);

      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        projectId: 5,
        projectCode: 'PR26002041',
        projectName: 'Asianet',
        overallStatus: 'READY',
        completenessCount: 4,
        totalPillars: 4,
        canSubmitForReview: true,
        canCreatePr: false,
        pillars: {} as any,
        gate: { status: 'NEEDS_REVISION' } as any,
        hasPersistedRevisionAfterReturn: true,
      });

      const activeInstance = {
        id: 20,
        status: 'IN_PROGRESS',
        currentNodeId: 'node_pm_revision_procurement',
        tasks: [
          {
            id: 37,
            nodeId: 'node_hops_review',
            status: 'COMPLETED',
          },
          {
            id: 39,
            nodeId: 'node_pm_revision_procurement',
            status: 'PENDING',
          },
        ],
      };
      mockWfService.getInstanceByEntity.mockResolvedValue(activeInstance);
      mockWfService.completeTask.mockImplementation(async () => {
        activeInstance.currentNodeId = 'node_procurement_review';
        activeInstance.tasks.push({
          id: 40,
          nodeId: 'node_procurement_review',
          status: 'PENDING',
        } as any);
      });

      const res = await service.submitManagementReview(5, 38, ['PROJECT_MANAGER']);

      // 1. Invokes RESUBMIT
      expect(mockWfService.completeTask).toHaveBeenCalledWith(
        39,
        expect.objectContaining({ action: 'RESUBMIT' }),
        38,
        ['PROJECT_MANAGER'],
      );

      // 2. Workflow target remains node_procurement_review
      expect(activeInstance.currentNodeId).toBe('node_procurement_review');

      // 3. Mutation response contains authoritative workflow projection
      expect(res).toBeDefined();
      expect(res.workflow).toBeDefined();
      expect(res.workflow.current).toBeDefined();

      // 4. Returned projection reports ownerRole = PROCUREMENT and ownerName = Procurement Team
      expect(res.workflow.current.ownerRole).toBe('PROCUREMENT');
      expect(res.workflow.current.ownerName).toBe('Procurement Team');

      // 5. Returned projection reports stage = 3, totalStages = 5
      expect(res.workflow.current.stage).toBe(3);
      expect(res.workflow.current.totalStages).toBe(5);
      expect(res.workflow.current.position).toBe('Management Review (Tahap 3 dari 5)');
      expect(res.workflow.current.headerBadge).toBe('Menunggu Review (Procurement Team)');

      // 6. HOO approval remains preserved (Task 37 is COMPLETED)
      const hooTask = activeInstance.tasks.find((t) => t.nodeId === 'node_hops_review');
      expect(hooTask?.status).toBe('COMPLETED');

      // 7. No new HOO task was created
      const allHooTasks = activeInstance.tasks.filter((t) => t.nodeId === 'node_hops_review');
      expect(allHooTasks.length).toBe(1);
    });

    it('11. PM ownership enforcement remains intact (non-assigned PM rejected)', async () => {
      const project = { id: 5, managerId: 38, status: 'PLANNING' };
      mockProjectRepo.findOne.mockResolvedValue(project);

      // Caller is user 999 (not PM 38)
      await expect(
        service.submitManagementReview(5, 999, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ForbiddenException);

      expect(mockWfService.completeTask).not.toHaveBeenCalled();
    });

    it('12. Non-revision initial submission does not require hasPersistedRevisionAfterReturn', async () => {
      const project = { id: 10, managerId: 1, status: 'PLANNING' };
      mockProjectRepo.findOne.mockResolvedValue(project);

      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        projectId: 10,
        projectCode: 'PRJ-10',
        projectName: 'Initial Project',
        overallStatus: 'READY',
        completenessCount: 4,
        totalPillars: 4,
        canSubmitForReview: true,
        canCreatePr: false,
        pillars: {} as any,
        gate: { status: 'NOT_SUBMITTED' } as any,
        hasPersistedRevisionAfterReturn: true,
      });

      mockWfService.getInstanceByEntity.mockResolvedValue(null);
      mockWfService.startInstance = jest.fn().mockResolvedValue({
        id: 100,
        status: 'IN_PROGRESS',
        currentNodeId: 'node_hops_review',
      });

      const res = await service.submitManagementReview(10, 1, ['PROJECT_MANAGER']);
      expect(res).toBeDefined();
      expect(mockWfService.startInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
          entityId: 10,
        }),
        1,
      );
    });

    it('13. HOO-return resubmit routes to HOO and returns Stage 2 projection', async () => {
      const project = { id: 5, managerId: 38, status: 'PLANNING' };
      mockProjectRepo.findOne.mockResolvedValue(project);

      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        projectId: 5,
        projectCode: 'PR26002041',
        projectName: 'Asianet',
        overallStatus: 'READY',
        completenessCount: 4,
        totalPillars: 4,
        canSubmitForReview: true,
        canCreatePr: false,
        pillars: {} as any,
        gate: { status: 'NEEDS_REVISION' } as any,
        hasPersistedRevisionAfterReturn: true,
      });

      const activeInstance = {
        id: 20,
        status: 'IN_PROGRESS',
        currentNodeId: 'node_pm_revision_hops',
        tasks: [{ id: 36, nodeId: 'node_pm_revision_hops', status: 'PENDING' }],
      };
      mockWfService.getInstanceByEntity.mockResolvedValue(activeInstance);
      mockWfService.completeTask.mockImplementation(async () => {
        activeInstance.currentNodeId = 'node_hops_review';
      });

      const res = await service.submitManagementReview(5, 38, ['PROJECT_MANAGER']);
      expect(mockWfService.completeTask).toHaveBeenCalledWith(
        36,
        expect.objectContaining({ action: 'RESUBMIT' }),
        38,
        ['PROJECT_MANAGER'],
      );
      expect(res.workflow.current.ownerRole).toBe('HEAD_OF_OPERATIONS');
      expect(res.workflow.current.stage).toBe(2);
    });

    it('14. Finance-return resubmit routes to Finance and returns Stage 4 projection', async () => {
      const project = { id: 5, managerId: 38, status: 'PLANNING' };
      mockProjectRepo.findOne.mockResolvedValue(project);

      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        projectId: 5,
        projectCode: 'PR26002041',
        projectName: 'Asianet',
        overallStatus: 'READY',
        completenessCount: 4,
        totalPillars: 4,
        canSubmitForReview: true,
        canCreatePr: false,
        pillars: {} as any,
        gate: { status: 'NEEDS_REVISION' } as any,
        hasPersistedRevisionAfterReturn: true,
      });

      const activeInstance = {
        id: 20,
        status: 'IN_PROGRESS',
        currentNodeId: 'node_pm_revision_finance',
        tasks: [{ id: 41, nodeId: 'node_pm_revision_finance', status: 'PENDING' }],
      };
      mockWfService.getInstanceByEntity.mockResolvedValue(activeInstance);
      mockWfService.completeTask.mockImplementation(async () => {
        activeInstance.currentNodeId = 'node_finance_review';
      });

      const res = await service.submitManagementReview(5, 38, ['PROJECT_MANAGER']);
      expect(mockWfService.completeTask).toHaveBeenCalledWith(
        41,
        expect.objectContaining({ action: 'RESUBMIT' }),
        38,
        ['PROJECT_MANAGER'],
      );
      expect(res.workflow.current.ownerRole).toBe('FINANCE');
      expect(res.workflow.current.stage).toBe(4);
    });

    it('15. Director-return resubmit routes to Director and returns Stage 5 projection', async () => {
      const project = { id: 5, managerId: 38, status: 'PLANNING' };
      mockProjectRepo.findOne.mockResolvedValue(project);

      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        projectId: 5,
        projectCode: 'PR26002041',
        projectName: 'Asianet',
        overallStatus: 'READY',
        completenessCount: 4,
        totalPillars: 4,
        canSubmitForReview: true,
        canCreatePr: false,
        pillars: {} as any,
        gate: { status: 'NEEDS_REVISION' } as any,
        hasPersistedRevisionAfterReturn: true,
      });

      const activeInstance = {
        id: 20,
        status: 'IN_PROGRESS',
        currentNodeId: 'node_pm_revision_director',
        tasks: [{ id: 45, nodeId: 'node_pm_revision_director', status: 'PENDING' }],
      };
      mockWfService.getInstanceByEntity.mockResolvedValue(activeInstance);
      mockWfService.completeTask.mockImplementation(async () => {
        activeInstance.currentNodeId = 'node_director_approval';
      });

      const res = await service.submitManagementReview(5, 38, ['PROJECT_MANAGER']);
      expect(mockWfService.completeTask).toHaveBeenCalledWith(
        45,
        expect.objectContaining({ action: 'RESUBMIT' }),
        38,
        ['PROJECT_MANAGER'],
      );
      expect(res.workflow.current.ownerRole).toBe('DIRECTOR');
      expect(res.workflow.current.stage).toBe(5);
    });
  });
});
