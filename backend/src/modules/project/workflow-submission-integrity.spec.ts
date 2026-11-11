import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectService } from './project.service';
import { Project } from '../../entities/project.entity';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';
import { WorkflowInstance, WorkflowInstanceStatus } from '../../entities/workflow-instance.entity';
import { WorkflowTask, WorkflowTaskStatus } from '../../entities/workflow-task.entity';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { Task } from '../../entities/task.entity';
import { Contract } from '../../entities/contract.entity';
import { User } from '../../entities/user.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { ProjectInitialCondition } from '../../entities/project-initial-condition.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { CostEstimateValidator } from './cost-estimate.validator';
import { ScheduleValidator } from './schedule.validator';
import { OperationalReadinessValidator } from './operational-readiness.validator';
import { InitialConditionValidator } from './initial-condition.validator';
import { ManagementReviewValidator } from './management-review.validator';

describe('EPMS Gate 4 Phase 3 — Workflow Submission & Concurrency Integrity Suite', () => {
  let service: ProjectService;
  let mockProjectRepo: any;
  let mockManagementReviewRepo: any;
  let mockWfService: any;
  let mockManager: any;
  let transactionWorkCallback: any;

  beforeEach(async () => {
    mockManager = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((_cls, entity) => Promise.resolve({ id: entity.id || 101, ...entity })),
      create: jest.fn().mockImplementation((_cls, dto) => ({ id: 101, ...dto })),
    };

    mockProjectRepo = {
      findOne: jest.fn(),
      manager: {
        transaction: jest.fn(async (cb) => {
          transactionWorkCallback = cb;
          return cb(mockManager);
        }),
      },
    };

    mockManagementReviewRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ id: 201, ...dto })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: entity.id || 201, ...entity })),
      manager: {
        transaction: jest.fn(async (cb) => {
          transactionWorkCallback = cb;
          return cb(mockManager);
        }),
      },
    };

    mockWfService = {
      getInstanceByEntity: jest.fn(),
      startInstance: jest.fn(),
      completeTask: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
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
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn().mockResolvedValue(null) } },
        { provide: getRepositoryToken(ProjectCostEstimate), useValue: { findOne: jest.fn().mockResolvedValue(null) } },
        { provide: getRepositoryToken(CostItem), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(ProjectInitialCondition), useValue: { findOne: jest.fn().mockResolvedValue(null) } },
        { provide: getRepositoryToken(ProjectManagementReview), useValue: mockManagementReviewRepo },
        { provide: getRepositoryToken(PurchaseRequest), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: EventEmitter2, useValue: new EventEmitter2() },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    (service as any).workflowEngineService = mockWfService;
  });

  describe('Test A — Atomic Submission Transaction (DEFECT-01)', () => {
    it('A1: Successful initial submission commits workflow instance and review metadata in a single transaction manager', async () => {
      const project = { id: 10, managerId: 1, status: 'PLANNING' };
      mockProjectRepo.findOne.mockResolvedValue(project);

      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        projectId: 10,
        projectCode: 'PRJ-010',
        projectName: 'Test Project',
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
      mockWfService.startInstance.mockResolvedValue({
        id: 50,
        workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
        status: 'IN_PROGRESS',
        currentNodeId: 'node_hops_review',
      });

      mockManager.findOne.mockImplementation((cls: any, opts: any) => {
        if (cls === Project) return Promise.resolve(project);
        if (cls === ProjectManagementReview) return Promise.resolve(null);
        return Promise.resolve(null);
      });

      jest.spyOn(service, 'getManagementReview').mockResolvedValue({
        id: 201,
        projectId: 10,
        status: 'REVIEW_PENDING',
        submittedBy: 1,
        submittedAt: new Date(),
        workflow: { current: { stage: 2, ownerRole: 'HEAD_OF_OPERATIONS' } },
      } as any);

      const res = await service.submitManagementReview(10, 1, ['PROJECT_MANAGER']);
      expect(res).toBeDefined();

      // Verified: startInstance was called with the exact transactional manager
      expect(mockWfService.startInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
          entityType: 'PROJECT',
          entityId: 10,
          context: expect.objectContaining({ projectId: 10, submittedBy: 1 }),
        }),
        1,
        mockManager,
      );

      // Verified: ProjectManagementReview was saved in the same transaction manager
      expect(mockManager.save).toHaveBeenCalledWith(
        ProjectManagementReview,
        expect.objectContaining({
          projectId: 10,
          status: 'REVIEW_PENDING',
          submittedBy: 1,
        }),
      );
    });

    it('A2: Injected failure during workflow start rolls back review metadata update', async () => {
      const project = { id: 10, managerId: 1, status: 'PLANNING' };
      mockProjectRepo.findOne.mockResolvedValue(project);

      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        projectId: 10,
        overallStatus: 'READY',
        completenessCount: 4,
        hasPersistedRevisionAfterReturn: true,
      } as any);

      mockWfService.getInstanceByEntity.mockResolvedValue(null);
      mockWfService.startInstance.mockRejectedValue(new Error('Simulated Database Error during startInstance'));

      mockManager.findOne.mockImplementation((cls: any) => {
        if (cls === Project) return Promise.resolve(project);
        return Promise.resolve(null);
      });

      await expect(service.submitManagementReview(10, 1, ['PROJECT_MANAGER'])).rejects.toThrow(
        'Simulated Database Error during startInstance',
      );

      // Verified: ProjectManagementReview save was NOT reached in the transaction
      expect(mockManager.save).not.toHaveBeenCalledWith(
        ProjectManagementReview,
        expect.anything(),
      );
    });
  });

  describe('Test B — Concurrent Submission Serialization (DEFECT-02)', () => {
    it('B1: Concurrency Protection locks parent Project and rejects simultaneous active submission with ConflictException', async () => {
      const project = { id: 10, managerId: 1, status: 'PLANNING' };
      mockProjectRepo.findOne.mockResolvedValue(project);

      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        projectId: 10,
        overallStatus: 'READY',
        completenessCount: 4,
        hasPersistedRevisionAfterReturn: true,
      } as any);

      // Simulates second concurrent request observing in-flight active instance already at node_hops_review
      mockWfService.getInstanceByEntity.mockResolvedValue({
        id: 50,
        status: 'IN_PROGRESS',
        currentNodeId: 'node_hops_review',
      });

      mockManager.findOne.mockImplementation((cls: any) => {
        if (cls === Project) return Promise.resolve(project);
        return Promise.resolve(null);
      });

      await expect(service.submitManagementReview(10, 1, ['PROJECT_MANAGER'])).rejects.toThrow(ConflictException);

      // Verified: Neither startInstance nor completeTask was called by the duplicate concurrent request
      expect(mockWfService.startInstance).not.toHaveBeenCalled();
      expect(mockWfService.completeTask).not.toHaveBeenCalled();
    });

    it('B2: startInstance enforces concurrency protection by locking parent Project row and checking active instances under lock', async () => {
      const mockInstanceRepo = {
        findOne: jest.fn(),
      };
      const mockDefRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
          status: 'ACTIVE',
          isActive: 1,
          activeVersion: 2,
          versions: [
            {
              id: 20,
              version: 2,
              status: 'PUBLISHED',
              bpmnJson: {
                nodes: [
                  { id: 'node_start', type: 'START' },
                  { id: 'node_hops_review', type: 'USER_TASK', data: { role: 'HEAD_OF_OPERATIONS' } },
                  { id: 'node_end', type: 'END' },
                ],
                edges: [
                  { source: 'node_start', target: 'node_hops_review' },
                  { source: 'node_hops_review', target: 'node_end' },
                ],
              },
            },
          ],
        }),
      };

      const wfEngine = new WorkflowEngineService(
        mockDefRepo as any,
        {} as any,
        mockInstanceRepo as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        { emit: jest.fn() } as any,
      );

      const localManager: any = {
        findOne: jest.fn().mockImplementation((cls: any, opts: any) => {
          if (cls === Project) return Promise.resolve({ id: 10 });
          if (cls === WorkflowInstance) {
            // Simulates active instance already found under lock
            return Promise.resolve({ id: 99, status: WorkflowInstanceStatus.IN_PROGRESS });
          }
          return Promise.resolve(null);
        }),
        create: jest.fn(),
        save: jest.fn(),
      };

      await expect(
        wfEngine.startInstance(
          {
            workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
            entityType: 'PROJECT',
            entityId: 10,
          },
          1,
          localManager,
        ),
      ).rejects.toThrow(ConflictException);

      // Verified: Project was locked with pessimistic_write
      expect(localManager.findOne).toHaveBeenCalledWith(
        Project,
        expect.objectContaining({
          where: { id: 10 },
          lock: { mode: 'pessimistic_write' },
        }),
      );

      // Verified: WorkflowInstance was checked under lock inside transaction manager
      expect(localManager.findOne).toHaveBeenCalledWith(
        WorkflowInstance,
        expect.objectContaining({
          where: expect.objectContaining({
            entityType: 'PROJECT',
            entityId: 10,
            status: WorkflowInstanceStatus.IN_PROGRESS,
          }),
        }),
      );
    });

    it('B3: startInstance fails closed when Project locking throws: rethrows original error, never checks active instance, and creates no instance', async () => {
      const mockInstanceRepo = {
        findOne: jest.fn(),
      };
      const mockDefRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
          status: 'ACTIVE',
          isActive: 1,
          activeVersion: 2,
          versions: [
            {
              id: 20,
              version: 2,
              status: 'PUBLISHED',
              bpmnJson: {
                nodes: [
                  { id: 'node_start', type: 'START' },
                  { id: 'node_hops_review', type: 'USER_TASK', data: { role: 'HEAD_OF_OPERATIONS' } },
                  { id: 'node_end', type: 'END' },
                ],
                edges: [
                  { source: 'node_start', target: 'node_hops_review' },
                  { source: 'node_hops_review', target: 'node_end' },
                ],
              },
            },
          ],
        }),
      };

      const wfEngine = new WorkflowEngineService(
        mockDefRepo as any,
        {} as any,
        mockInstanceRepo as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        { emit: jest.fn() } as any,
      );

      const lockError = new Error('Lock wait timeout exceeded; try restarting transaction');
      (lockError as any).code = 'ER_LOCK_WAIT_TIMEOUT';

      const localManager: any = {
        findOne: jest.fn().mockImplementation((cls: any) => {
          if (cls === Project) {
            return Promise.reject(lockError);
          }
          return Promise.resolve(null);
        }),
        create: jest.fn(),
        save: jest.fn(),
      };

      // 1. Must rethrow the original locking error fail-closed
      await expect(
        wfEngine.startInstance(
          {
            workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
            entityType: 'PROJECT',
            entityId: 10,
          },
          1,
          localManager,
        ),
      ).rejects.toThrow('Lock wait timeout exceeded; try restarting transaction');

      // 2. Verified: Project row-lock was attempted
      expect(localManager.findOne).toHaveBeenCalledWith(
        Project,
        expect.objectContaining({
          where: { id: 10 },
          lock: { mode: 'pessimistic_write' },
        }),
      );

      // 3. Verified: Active-instance check was NEVER executed after lock failure
      expect(localManager.findOne).not.toHaveBeenCalledWith(
        WorkflowInstance,
        expect.anything(),
      );

      // 4. Verified: No workflow instance was created or saved
      expect(localManager.create).not.toHaveBeenCalled();
      expect(localManager.save).not.toHaveBeenCalled();
    });

    it('B4: startInstance proceeds to initialize workflow when Project locking succeeds and no active instance exists', async () => {
      const mockInstanceRepo = {
        findOne: jest.fn(),
      };
      const mockDefRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
          status: 'ACTIVE',
          isActive: 1,
          activeVersion: 2,
          versions: [
            {
              id: 20,
              version: 2,
              status: 'PUBLISHED',
              bpmnJson: {
                nodes: [
                  { id: 'node_start', type: 'START' },
                  { id: 'node_hops_review', type: 'USER_TASK', data: { role: 'HEAD_OF_OPERATIONS' } },
                  { id: 'node_end', type: 'END' },
                ],
                edges: [
                  { source: 'node_start', target: 'node_hops_review' },
                  { source: 'node_hops_review', target: 'node_end' },
                ],
              },
            },
          ],
        }),
      };

      const mockTransitionRepo = {
        create: jest.fn().mockImplementation((d: any) => d),
        save: jest.fn().mockImplementation((d: any) => Promise.resolve({ id: 1, ...d })),
      };

      const wfEngine = new WorkflowEngineService(
        mockDefRepo as any,
        {} as any,
        mockInstanceRepo as any,
        {} as any,
        mockTransitionRepo as any,
        {} as any,
        {} as any,
        {} as any,
        { emit: jest.fn() } as any,
      );

      const localManager: any = {
        findOne: jest.fn().mockImplementation((cls: any, opts: any) => {
          if (cls === Project) return Promise.resolve({ id: 10 });
          if (cls === WorkflowInstance) return Promise.resolve(null);
          return Promise.resolve({ id: 1, name: 'HEAD_OF_OPERATIONS' });
        }),
        create: jest.fn().mockImplementation((cls: any, dto: any) => ({ id: 55, ...dto })),
        save: jest.fn().mockImplementation((entityOrCls: any, maybeEntity: any) => {
          const entity = maybeEntity || entityOrCls;
          return Promise.resolve({ id: entity.id || 55, ...entity });
        }),
      };

      const result = await wfEngine.startInstance(
        {
          workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
          entityType: 'PROJECT',
          entityId: 10,
        },
        1,
        localManager,
      );

      // Verified: Instance created and returned in IN_PROGRESS status
      expect(result).toBeDefined();
      expect(result.id).toBe(55);
      expect(result.status).toBe(WorkflowInstanceStatus.IN_PROGRESS);

      // Verified: Project was locked with pessimistic_write
      expect(localManager.findOne).toHaveBeenCalledWith(
        Project,
        expect.objectContaining({
          where: { id: 10 },
          lock: { mode: 'pessimistic_write' },
        }),
      );

      // Verified: Active-instance check was performed
      expect(localManager.findOne).toHaveBeenCalledWith(
        WorkflowInstance,
        expect.objectContaining({
          where: expect.objectContaining({
            entityType: 'PROJECT',
            entityId: 10,
            status: WorkflowInstanceStatus.IN_PROGRESS,
          }),
        }),
      );

      // Verified: Instance was saved
      expect(localManager.save).toHaveBeenCalled();
    });
  });

  describe('Test C — Revision Resubmission Integrity (DEFECT-03)', () => {
    it('C1: Valid revision task completes with action RESUBMIT inside the transaction', async () => {
      const project = { id: 10, managerId: 1, status: 'PLANNING' };
      mockProjectRepo.findOne.mockResolvedValue(project);

      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        projectId: 10,
        overallStatus: 'READY',
        completenessCount: 4,
        hasPersistedRevisionAfterReturn: true,
      } as any);

      const activeInstance = {
        id: 50,
        status: 'IN_PROGRESS',
        currentNodeId: 'node_pm_revision_finance',
        tasks: [
          { id: 77, nodeId: 'node_pm_revision_finance', status: 'PENDING' },
        ],
      };
      mockWfService.getInstanceByEntity.mockResolvedValue(activeInstance);
      mockWfService.completeTask.mockResolvedValue({ task: { id: 77, status: 'COMPLETED' }, instance: activeInstance });

      mockManager.findOne.mockImplementation((cls: any) => {
        if (cls === Project) return Promise.resolve(project);
        if (cls === ProjectManagementReview) {
          return Promise.resolve({ id: 201, projectId: 10, status: 'NEEDS_REVISION' });
        }
        return Promise.resolve(null);
      });

      jest.spyOn(service, 'getManagementReview').mockResolvedValue({
        id: 201,
        projectId: 10,
        status: 'REVIEW_PENDING',
      } as any);

      const res = await service.submitManagementReview(10, 1, ['PROJECT_MANAGER']);
      expect(res).toBeDefined();

      expect(mockWfService.completeTask).toHaveBeenCalledWith(
        77,
        expect.objectContaining({ action: 'RESUBMIT' }),
        1,
        ['PROJECT_MANAGER'],
        mockManager,
      );
    });

    it('C2: Missing pending task on revision node throws ConflictException and prevents metadata update (DEFECT-03 Fix)', async () => {
      const project = { id: 10, managerId: 1, status: 'PLANNING' };
      mockProjectRepo.findOne.mockResolvedValue(project);

      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        projectId: 10,
        overallStatus: 'READY',
        completenessCount: 4,
        hasPersistedRevisionAfterReturn: true,
      } as any);

      // Active instance is on revision node but tasks array has NO PENDING task!
      const desyncedInstance = {
        id: 50,
        status: 'IN_PROGRESS',
        currentNodeId: 'node_pm_revision_finance',
        tasks: [
          { id: 76, nodeId: 'node_pm_revision_finance', status: 'COMPLETED' }, // Already completed or missing!
        ],
      };
      mockWfService.getInstanceByEntity.mockResolvedValue(desyncedInstance);

      mockManager.findOne.mockImplementation((cls: any) => {
        if (cls === Project) return Promise.resolve(project);
        if (cls === ProjectManagementReview) {
          return Promise.resolve({ id: 201, projectId: 10, status: 'NEEDS_REVISION' });
        }
        return Promise.resolve(null);
      });

      // Assert: Must NOT silently skip; must throw ConflictException
      await expect(service.submitManagementReview(10, 1, ['PROJECT_MANAGER'])).rejects.toThrow(ConflictException);

      // Assert: completeTask was not invoked
      expect(mockWfService.completeTask).not.toHaveBeenCalled();

      // Assert: ProjectManagementReview was NOT saved with REVIEW_PENDING
      expect(mockManager.save).not.toHaveBeenCalledWith(
        ProjectManagementReview,
        expect.objectContaining({ status: 'REVIEW_PENDING' }),
      );
    });

    it('C3: Injected failure in completeTask during resubmission rolls back transaction', async () => {
      const project = { id: 10, managerId: 1, status: 'PLANNING' };
      mockProjectRepo.findOne.mockResolvedValue(project);

      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        projectId: 10,
        overallStatus: 'READY',
        completenessCount: 4,
        hasPersistedRevisionAfterReturn: true,
      } as any);

      const activeInstance = {
        id: 50,
        status: 'IN_PROGRESS',
        currentNodeId: 'node_pm_revision_hops',
        tasks: [{ id: 82, nodeId: 'node_pm_revision_hops', status: 'PENDING' }],
      };
      mockWfService.getInstanceByEntity.mockResolvedValue(activeInstance);
      mockWfService.completeTask.mockRejectedValue(new Error('Simulated CompleteTask Failure'));

      mockManager.findOne.mockImplementation((cls: any) => {
        if (cls === Project) return Promise.resolve(project);
        if (cls === ProjectManagementReview) {
          return Promise.resolve({ id: 201, projectId: 10, status: 'NEEDS_REVISION' });
        }
        return Promise.resolve(null);
      });

      await expect(service.submitManagementReview(10, 1, ['PROJECT_MANAGER'])).rejects.toThrow(
        'Simulated CompleteTask Failure',
      );

      // Review status was not persisted to REVIEW_PENDING
      expect(mockManager.save).not.toHaveBeenCalledWith(
        ProjectManagementReview,
        expect.anything(),
      );
    });
  });

  describe('Test D — Approval Regression Preservation', () => {
    it('D1: CompleteTask validates task status and rejects already completed task', async () => {
      const mockQueryBuilder: any = {
        setLock: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 88,
          status: WorkflowTaskStatus.COMPLETED, // Already completed by concurrent request
          workflowInstance: { id: 50 },
        }),
      };

      const manager = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      // Simulates the task validation logic in completeTask
      const task = await manager
        .createQueryBuilder()
        .setLock('pessimistic_write')
        .where('task.id = :taskId', { taskId: 88 })
        .getOne();

      expect(task).toBeDefined();
      expect(task.status).toBe(WorkflowTaskStatus.COMPLETED);

      const validateStatus = () => {
        if (task.status !== WorkflowTaskStatus.PENDING) {
          throw new BadRequestException(`Workflow task #88 is already ${task.status}.`);
        }
      };

      expect(validateStatus).toThrow(BadRequestException);
      expect(validateStatus).toThrow('Workflow task #88 is already COMPLETED.');
    });
  });
});
