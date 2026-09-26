import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MarketingService } from './marketing.service';
import { Customer } from '../../entities/customer.entity';
import { Tender, TenderStatus, TenderStage, GoNoGoStatus, RevisionStatus } from '../../entities/tender.entity';
import { Proposal } from '../../entities/proposal.entity';
import { Contract } from '../../entities/contract.entity';
import { TenderActivity } from '../../entities/tender-activity.entity';
import { TenderPriceHistory } from '../../entities/tender-price-history.entity';
import { User } from '../../entities/user.entity';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { WorkflowInstance, WorkflowInstanceStatus } from '../../entities/workflow-instance.entity';
import { WorkflowTask, WorkflowTaskStatus } from '../../entities/workflow-task.entity';
import { OutboxEvent } from '../../entities/outbox-event.entity';

describe('WF-3B: Tender Go/No-Go Domain ↔ Workflow Coordination Test Suite', () => {
  let service: MarketingService;
  let workflowEngineService: jest.Mocked<Partial<WorkflowEngineService>>;
  let eventEmitter: jest.Mocked<Partial<EventEmitter2>>;

  let userRepoMock: any;
  let tenderRepoMock: any;
  let queryRunnerMock: any;
  let dataSourceMock: any;

  let inMemoryTender: Tender;
  let inMemoryInstance: any;

  beforeEach(async () => {
    inMemoryTender = {
      id: 101,
      title: 'Pengadaan Data Center Tier 3',
      stage: TenderStage.LEAD,
      status: TenderStatus.NEW,
      go_nogo_status: null as any,
      revision_status: RevisionStatus.NOT_REQUIRED,
      marketing_pic_id: 25,
      created_by: 10,
      estimated_budget: 5000000000,
      probability_percentage: 10,
      customer: { id: 1, name: 'PT Telco Jaya' } as any,
    } as Tender;

    inMemoryInstance = null;

    userRepoMock = {
      findOne: jest.fn().mockImplementation(async (options: any) => {
        const id = options?.where?.id;
        if (id === 10) return { id: 10, fullName: 'Creator User', roles: [{ name: 'MARKETING' }] };
        if (id === 25) return { id: 25, fullName: 'Marketing PIC', roles: [{ name: 'MARKETING' }] };
        if (id === 5) return { id: 5, fullName: 'Director User', roles: [{ name: 'DIRECTOR' }] };
        if (id === 7) return { id: 7, fullName: 'GM User', roles: [{ name: 'GENERAL_MANAGER' }] };
        if (id === 1) return { id: 1, fullName: 'Super Admin', roles: [{ name: 'SUPER_ADMIN' }] };
        return { id, fullName: 'Test User', roles: [{ name: 'MARKETING' }] };
      }),
    };

    queryRunnerMock = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      isTransactionActive: true,
      manager: {
        findOne: jest.fn().mockImplementation(async (entity: any, options: any) => {
          if (entity === Tender) return inMemoryTender;
          if (entity === User) return userRepoMock.findOne(options);
          return null;
        }),
        save: jest.fn().mockImplementation(async (entityOrClass: any, entity?: any) => {
          const target = entity || entityOrClass;
          if (target instanceof Tender || target.stage !== undefined) {
            Object.assign(inMemoryTender, target);
            return inMemoryTender;
          }
          return target;
        }),
        create: jest.fn().mockImplementation((entity: any, data: any) => data),
      },
    };

    dataSourceMock = {
      getRepository: jest.fn().mockImplementation((entity: any) => {
        if (entity === User) return userRepoMock;
        return { findOne: jest.fn(), save: jest.fn() };
      }),
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
    };

    workflowEngineService = {
      getInstanceByEntity: jest.fn().mockImplementation(async (entityType: string, entityId: number) => {
        if (inMemoryInstance && inMemoryInstance.entityType === entityType && inMemoryInstance.entityId === Number(entityId)) {
          return inMemoryInstance;
        }
        return null;
      }),
      startInstance: jest.fn().mockImplementation(async (dto: any, userId: number) => {
        inMemoryInstance = {
          id: 901,
          workflowKey: dto.workflowKey,
          entityType: dto.entityType,
          entityId: dto.entityId,
          status: WorkflowInstanceStatus.IN_PROGRESS,
          currentNodeId: 'node_go_nogo_approval',
          context: dto.context,
          tasks: [
            {
              id: 1001,
              workflowInstanceId: 901,
              nodeId: 'node_go_nogo_approval',
              taskKey: 'GO_NOGO_APPROVAL',
              status: WorkflowTaskStatus.PENDING,
              assigneeRoleId: 5, // DIRECTOR
              assigneeUserId: null,
            },
          ],
        };
        return inMemoryInstance;
      }),
      completeTask: jest.fn().mockImplementation(async (taskId: number, dto: any, actorId: number, actorRoles: string[]) => {
        if (!inMemoryInstance) throw new ConflictException('No active instance');
        const task = inMemoryInstance.tasks.find((t: any) => t.id === taskId);
        if (!task || task.status !== WorkflowTaskStatus.PENDING) {
          throw new ConflictException(`Task #${taskId} is not pending`);
        }

        task.status = dto.action === 'APPROVE' ? WorkflowTaskStatus.COMPLETED : WorkflowTaskStatus.RETURNED;
        task.action = dto.action;

        if (dto.action === 'APPROVE') {
          inMemoryInstance.status = WorkflowInstanceStatus.COMPLETED;
          inMemoryInstance.currentNodeId = 'node_end';
        } else if (dto.action === 'RETURN') {
          inMemoryInstance.currentNodeId = 'node_go_nogo_revision';
          const revTask = {
            id: 1002,
            workflowInstanceId: inMemoryInstance.id,
            nodeId: 'node_go_nogo_revision',
            taskKey: 'GO_NOGO_REVISION',
            status: WorkflowTaskStatus.PENDING,
            assigneeRoleId: 6, // MARKETING
            assigneeUserId: inMemoryInstance.context?.marketing_pic_id || inMemoryInstance.context?.created_by,
          };
          inMemoryInstance.tasks.push(revTask);
        } else if (dto.action === 'RESUBMIT') {
          inMemoryInstance.currentNodeId = 'node_go_nogo_approval';
          const newApprovalTask = {
            id: 1003,
            workflowInstanceId: inMemoryInstance.id,
            nodeId: 'node_go_nogo_approval',
            taskKey: 'GO_NOGO_APPROVAL',
            status: WorkflowTaskStatus.PENDING,
            assigneeRoleId: 5,
            assigneeUserId: null,
          };
          inMemoryInstance.tasks.push(newApprovalTask);
        }

        return { task, instance: inMemoryInstance };
      }),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketingService,
        { provide: getRepositoryToken(Customer), useValue: {} },
        { provide: getRepositoryToken(Tender), useValue: { findOne: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(Proposal), useValue: { findOne: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(Contract), useValue: { findOne: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(TenderActivity), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(TenderPriceHistory), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: WorkflowEngineService, useValue: workflowEngineService },
      ],
    }).compile();

    service = module.get<MarketingService>(MarketingService);
  });

  // =========================================================================
  // SECTION 18: NORMAL FLOW TESTS
  // =========================================================================
  describe('1. NORMAL FLOW — Full Go/No-Go Lifecycle Execution', () => {
    it('INITIAL: Marketing submits -> Tender WAITING_GO_NO_GO / PENDING -> 1 active workflow -> 1 GO_NOGO_APPROVAL task', async () => {
      expect(inMemoryTender.stage).toBe(TenderStage.LEAD);

      const result = await service.submitGoNoGoReview(101, 25, ['MARKETING']);

      expect(result.status).toBe('success');
      expect(inMemoryTender.stage).toBe(TenderStage.WAITING_GO_NO_GO);
      expect(inMemoryTender.go_nogo_status).toBe(GoNoGoStatus.PENDING);
      expect(inMemoryTender.revision_status).toBe(RevisionStatus.NOT_REQUIRED);

      // Workflow instance created
      expect(workflowEngineService.startInstance).toHaveBeenCalledWith(
        {
          workflowKey: 'TENDER_GO_NOGO_WORKFLOW',
          entityType: 'TENDER',
          entityId: 101,
          context: {
            marketing_pic_id: 25,
            created_by: 10,
            tenderId: 101,
          },
        },
        25,
      );

      expect(inMemoryInstance).toBeDefined();
      expect(inMemoryInstance.status).toBe(WorkflowInstanceStatus.IN_PROGRESS);
      const pendingTasks = inMemoryInstance.tasks.filter((t: any) => t.status === WorkflowTaskStatus.PENDING);
      expect(pendingTasks).toHaveLength(1);
      expect(pendingTasks[0].taskKey).toBe('GO_NOGO_APPROVAL');

      // Phase N8.1: Submitter confirmation migrated to Transactional Outbox canonical event marketing.gonogo.submitted
      expect(queryRunnerMock.manager.save).toHaveBeenCalledWith(
        OutboxEvent,
        expect.objectContaining({
          event_name: 'marketing.gonogo.submitted',
          payload: expect.objectContaining({
            routing: { userIds: [25] },
          }),
        }),
      );
      // Phase N8.1: Legacy notification.send producer retired
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        'notification.send',
        expect.anything(),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'audit.log',
        expect.objectContaining({ action: 'GO_NOGO_SUBMITTED', entityId: 101 }),
      );
    });

    it('GO: Director/GM completes GO -> Tender QUALIFICATION / GO -> GO_NOGO_APPROVAL APPROVE -> workflow COMPLETED', async () => {
      // Setup state: Tender is WAITING_GO_NO_GO + PENDING, instance active with GO_NOGO_APPROVAL
      await service.submitGoNoGoReview(101, 25, ['MARKETING']);

      const goResult = await service.submitGoNoGo(
        101,
        { decision: 'GO', notes: 'Approved for Qualification' },
        5,
        ['DIRECTOR'],
      );

      expect(goResult.status).toBe('success');
      expect(inMemoryTender.stage).toBe(TenderStage.QUALIFICATION);
      expect(inMemoryTender.go_nogo_status).toBe(GoNoGoStatus.GO);
      expect(inMemoryTender.revision_status).toBe(RevisionStatus.NOT_REQUIRED);

      // Workflow task completed with APPROVE
      expect(workflowEngineService.completeTask).toHaveBeenCalledWith(
        1001,
        { action: 'APPROVE', reason: 'Approved for Qualification' },
        5,
        ['DIRECTOR'],
      );

      expect(inMemoryInstance.status).toBe(WorkflowInstanceStatus.COMPLETED);
      expect(inMemoryInstance.currentNodeId).toBe('node_end');

      // Phase N8.1: Marketing PIC notification migrated to Transactional Outbox canonical event marketing.gonogo.approved
      expect(queryRunnerMock.manager.save).toHaveBeenCalledWith(
        OutboxEvent,
        expect.objectContaining({
          event_name: 'marketing.gonogo.approved',
          payload: expect.objectContaining({
            routing: { userIds: [25] },
          }),
        }),
      );
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        'notification.send',
        expect.anything(),
      );
    });

    it('NO_GO: Director/GM completes NO_GO -> Tender LEAD / NO_GO / REQUIRED -> task RETURN -> 1 GO_NOGO_REVISION pending', async () => {
      await service.submitGoNoGoReview(101, 25, ['MARKETING']);

      const noGoResult = await service.submitGoNoGo(
        101,
        { decision: 'NO_GO', notes: 'Margin too low, adjust budget' },
        7,
        ['GENERAL_MANAGER'],
      );

      expect(noGoResult.status).toBe('success');
      expect(inMemoryTender.stage).toBe(TenderStage.LEAD);
      expect(inMemoryTender.go_nogo_status).toBe(GoNoGoStatus.NO_GO);
      expect(inMemoryTender.revision_status).toBe(RevisionStatus.REQUIRED);

      // Task completed with RETURN
      expect(workflowEngineService.completeTask).toHaveBeenCalledWith(
        1001,
        { action: 'RETURN', reason: 'Margin too low, adjust budget' },
        7,
        ['GENERAL_MANAGER'],
      );

      expect(inMemoryInstance.status).toBe(WorkflowInstanceStatus.IN_PROGRESS);
      expect(inMemoryInstance.currentNodeId).toBe('node_go_nogo_revision');

      const pendingTasks = inMemoryInstance.tasks.filter((t: any) => t.status === WorkflowTaskStatus.PENDING);
      expect(pendingTasks).toHaveLength(1);
      expect(pendingTasks[0].taskKey).toBe('GO_NOGO_REVISION');
      expect(pendingTasks[0].assigneeUserId).toBe(25); // Marketing PIC assigned!

      // Phase N3.1: Duplicate actionable Bell eliminated; revision is owned exclusively by WorkflowTask
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({ recipientId: 25, type: 'WARNING' }),
      );
    });

    it('RESUBMIT: Marketing revises -> resubmits -> Tender WAITING_GO_NO_GO / PENDING -> RESUBMIT -> 1 new GO_NOGO_APPROVAL', async () => {
      // Cycle: submit -> NO_GO
      await service.submitGoNoGoReview(101, 25, ['MARKETING']);
      await service.submitGoNoGo(101, { decision: 'NO_GO', notes: 'Perlu revisi anggaran' }, 5, ['DIRECTOR']);

      expect(inMemoryTender.revision_status).toBe(RevisionStatus.REQUIRED);

      // Simulate Marketing revision edit (revision_status -> COMPLETED)
      inMemoryTender.revision_status = RevisionStatus.COMPLETED;

      // Resubmit
      const resubmitResult = await service.submitGoNoGoReview(101, 25, ['MARKETING']);

      expect(resubmitResult.status).toBe('success');
      expect(inMemoryTender.stage).toBe(TenderStage.WAITING_GO_NO_GO);
      expect(inMemoryTender.go_nogo_status).toBe(GoNoGoStatus.PENDING);
      expect(inMemoryTender.revision_status).toBe(RevisionStatus.NOT_REQUIRED);

      // completeTask called with RESUBMIT on GO_NOGO_REVISION task (id 1002)
      expect(workflowEngineService.completeTask).toHaveBeenCalledWith(
        1002,
        { action: 'RESUBMIT', reason: 'Marketing resubmitted tender for GO / NO GO review' },
        25,
        ['MARKETING'],
      );

      // Only ONE active workflow instance remains
      expect(workflowEngineService.startInstance).toHaveBeenCalledTimes(1);

      // New pending GO_NOGO_APPROVAL task exists
      const pendingTasks = inMemoryInstance.tasks.filter((t: any) => t.status === WorkflowTaskStatus.PENDING);
      expect(pendingTasks).toHaveLength(1);
      expect(pendingTasks[0].taskKey).toBe('GO_NOGO_APPROVAL');
    });
  });

  // =========================================================================
  // SECTION 19: RECOVERY TESTS (SCENARIOS A - F)
  // =========================================================================
  describe('2. RECOVERY — Failure Window Recovery & Concurrency Handling', () => {
    it('Scenario A: Domain initial submit committed, workflow instance absent -> Retry creates workflow, no duplicate domain mutation', async () => {
      // Simulate state where domain committed WAITING_GO_NO_GO + PENDING, but workflow instance is absent
      inMemoryTender.stage = TenderStage.WAITING_GO_NO_GO;
      inMemoryTender.go_nogo_status = GoNoGoStatus.PENDING;
      inMemoryInstance = null;

      const saveSpy = jest.spyOn(queryRunnerMock.manager, 'save');

      const result = await service.submitGoNoGoReview(101, 25, ['MARKETING']);

      expect(result.status).toBe('success');
      // No domain mutation was re-executed
      expect(saveSpy).not.toHaveBeenCalled();

      // Workflow instance created
      expect(workflowEngineService.startInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowKey: 'TENDER_GO_NOGO_WORKFLOW',
          entityType: 'TENDER',
          entityId: 101,
        }),
        25,
      );
      expect(inMemoryInstance).toBeDefined();
    });

    it('Scenario B: GO domain state committed, approval task still pending -> Retry GO completes APPROVE; Retry NO_GO rejected', async () => {
      // Setup: Domain is QUALIFICATION + GO, workflow instance has GO_NOGO_APPROVAL pending
      inMemoryTender.stage = TenderStage.QUALIFICATION;
      inMemoryTender.go_nogo_status = GoNoGoStatus.GO;
      inMemoryInstance = {
        id: 901,
        entityType: 'TENDER',
        entityId: 101,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        tasks: [
          {
            id: 1001,
            taskKey: 'GO_NOGO_APPROVAL',
            status: WorkflowTaskStatus.PENDING,
          },
        ],
      };

      // 1. Retry GO: should succeed and complete APPROVE
      const retryResult = await service.submitGoNoGo(
        101,
        { decision: 'GO', notes: 'Retry GO' },
        5,
        ['DIRECTOR'],
      );

      expect(retryResult.status).toBe('success');
      expect(workflowEngineService.completeTask).toHaveBeenCalledWith(
        1001,
        { action: 'APPROVE', reason: 'Retry GO' },
        5,
        ['DIRECTOR'],
      );

      // 2. Retry NO_GO against QUALIFICATION + GO: must be rejected with BadRequestException
      inMemoryTender.stage = TenderStage.QUALIFICATION;
      inMemoryTender.go_nogo_status = GoNoGoStatus.GO;

      await expect(
        service.submitGoNoGo(101, { decision: 'NO_GO', notes: 'Tolak ulang' }, 5, ['DIRECTOR']),
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario C: NO_GO domain state committed, approval still pending -> Retry NO_GO completes RETURN; Retry GO rejected', async () => {
      // Setup: Domain is LEAD + NO_GO + REQUIRED, workflow instance has GO_NOGO_APPROVAL pending
      inMemoryTender.stage = TenderStage.LEAD;
      inMemoryTender.go_nogo_status = GoNoGoStatus.NO_GO;
      inMemoryTender.revision_status = RevisionStatus.REQUIRED;
      inMemoryInstance = {
        id: 901,
        entityType: 'TENDER',
        entityId: 101,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        tasks: [
          {
            id: 1001,
            taskKey: 'GO_NOGO_APPROVAL',
            status: WorkflowTaskStatus.PENDING,
          },
        ],
      };

      // 1. Retry NO_GO: completes RETURN and creates revision task
      const retryResult = await service.submitGoNoGo(
        101,
        { decision: 'NO_GO', notes: 'Retry NO GO' },
        7,
        ['GENERAL_MANAGER'],
      );

      expect(retryResult.status).toBe('success');
      expect(workflowEngineService.completeTask).toHaveBeenCalledWith(
        1001,
        { action: 'RETURN', reason: 'Retry NO GO' },
        7,
        ['GENERAL_MANAGER'],
      );

      // 2. Retry GO against LEAD + NO_GO: must be rejected
      inMemoryTender.stage = TenderStage.LEAD;
      inMemoryTender.go_nogo_status = GoNoGoStatus.NO_GO;
      inMemoryTender.revision_status = RevisionStatus.REQUIRED;

      await expect(
        service.submitGoNoGo(101, { decision: 'GO' }, 5, ['DIRECTOR']),
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario D: Resubmit domain state committed, revision task still pending -> Retry completes RESUBMIT, restores approval task', async () => {
      // Setup: Domain is WAITING_GO_NO_GO + PENDING, workflow has GO_NOGO_REVISION pending
      inMemoryTender.stage = TenderStage.WAITING_GO_NO_GO;
      inMemoryTender.go_nogo_status = GoNoGoStatus.PENDING;
      inMemoryInstance = {
        id: 901,
        entityType: 'TENDER',
        entityId: 101,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        tasks: [
          {
            id: 1002,
            taskKey: 'GO_NOGO_REVISION',
            status: WorkflowTaskStatus.PENDING,
          },
        ],
      };

      const result = await service.submitGoNoGoReview(101, 25, ['MARKETING']);

      expect(result.status).toBe('success');
      expect(workflowEngineService.completeTask).toHaveBeenCalledWith(
        1002,
        expect.objectContaining({ action: 'RESUBMIT' }),
        25,
        ['MARKETING'],
      );
    });

    it('Scenario E: Workflow already synchronized -> Retry same action -> Safe ALREADY_SYNCHRONIZED behavior, no duplicate task', async () => {
      // 1. submitGoNoGoReview retry when GO_NOGO_APPROVAL is ALREADY pending
      inMemoryTender.stage = TenderStage.WAITING_GO_NO_GO;
      inMemoryTender.go_nogo_status = GoNoGoStatus.PENDING;
      inMemoryInstance = {
        id: 901,
        entityType: 'TENDER',
        entityId: 101,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        tasks: [
          {
            id: 1001,
            taskKey: 'GO_NOGO_APPROVAL',
            status: WorkflowTaskStatus.PENDING,
          },
        ],
      };

      const result = await service.submitGoNoGoReview(101, 25, ['MARKETING']);
      expect(result.status).toBe('success');
      // Neither startInstance nor completeTask called
      expect(workflowEngineService.startInstance).not.toHaveBeenCalled();
      expect(workflowEngineService.completeTask).not.toHaveBeenCalled();

      // 2. submitGoNoGo GO retry when workflow is ALREADY COMPLETED
      inMemoryTender.stage = TenderStage.QUALIFICATION;
      inMemoryTender.go_nogo_status = GoNoGoStatus.GO;
      inMemoryInstance.status = WorkflowInstanceStatus.COMPLETED;

      const goResult = await service.submitGoNoGo(101, { decision: 'GO' }, 5, ['DIRECTOR']);
      expect(goResult.status).toBe('success');
      expect(workflowEngineService.completeTask).not.toHaveBeenCalled();

      // 3. submitGoNoGo NO_GO retry when GO_NOGO_REVISION is ALREADY pending
      inMemoryTender.stage = TenderStage.LEAD;
      inMemoryTender.go_nogo_status = GoNoGoStatus.NO_GO;
      inMemoryTender.revision_status = RevisionStatus.REQUIRED;
      inMemoryInstance.status = WorkflowInstanceStatus.IN_PROGRESS;
      inMemoryInstance.tasks = [
        {
          id: 1002,
          taskKey: 'GO_NOGO_REVISION',
          status: WorkflowTaskStatus.PENDING,
        },
      ];

      const noGoResult = await service.submitGoNoGo(101, { decision: 'NO_GO', notes: 'Retry NO GO' }, 5, ['DIRECTOR']);
      expect(noGoResult.status).toBe('success');
      expect(workflowEngineService.completeTask).not.toHaveBeenCalled();
    });

    it('Scenario F: ConflictException caused by concurrent synchronization -> Reloads state -> Matching = SUCCESS; Mismatched = Conflict', async () => {
      // 1. Concurrent startInstance conflict where another thread already created instance with pending approval
      inMemoryTender.stage = TenderStage.WAITING_GO_NO_GO;
      inMemoryTender.go_nogo_status = GoNoGoStatus.PENDING;
      inMemoryInstance = null;

      // startInstance throws ConflictException
      (workflowEngineService.startInstance as jest.Mock).mockRejectedValueOnce(
        new ConflictException('Active workflow instance already exists for TENDER #101.'),
      );

      // On reload, getInstanceByEntity returns the newly created instance with pending approval task
      (workflowEngineService.getInstanceByEntity as jest.Mock).mockImplementation(async () => {
        return {
          id: 902,
          entityType: 'TENDER',
          entityId: 101,
          status: WorkflowInstanceStatus.IN_PROGRESS,
          tasks: [
            {
              id: 2001,
              taskKey: 'GO_NOGO_APPROVAL',
              status: WorkflowTaskStatus.PENDING,
            },
          ],
        };
      });

      const res = await service.submitGoNoGoReview(101, 25, ['MARKETING']);
      expect(res.status).toBe('success'); // Resolved gracefully via ALREADY_SYNCHRONIZED

      // 2. Concurrent startInstance conflict where reloaded state is MISMATCHED -> Rethrows ConflictException
      (workflowEngineService.startInstance as jest.Mock).mockRejectedValueOnce(
        new ConflictException('Active workflow instance already exists for TENDER #101.'),
      );
      (workflowEngineService.getInstanceByEntity as jest.Mock).mockImplementation(async () => {
        return {
          id: 903,
          entityType: 'TENDER',
          entityId: 101,
          status: WorkflowInstanceStatus.COMPLETED, // Mismatched status!
          tasks: [],
        };
      });

      await expect(service.submitGoNoGoReview(101, 25, ['MARKETING'])).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================================
  // SECTION 14 & 21: FAILURE CONTRACT & ROLE AUTHORIZATION
  // =========================================================================
  describe('3. FAILURE CONTRACT & ROLES — Domain Transaction Isolation & Multi-Role Support', () => {
    it('Domain commit MUST NOT be rolled back if workflow coordination fails post-commit', async () => {
      inMemoryTender.stage = TenderStage.LEAD;

      // Make workflow coordination throw an unexpected error
      (workflowEngineService.getInstanceByEntity as jest.Mock).mockRejectedValueOnce(
        new Error('Workflow service network timeout'),
      );

      // Method should NOT throw; domain mutation was committed!
      const result = await service.submitGoNoGoReview(101, 25, ['MARKETING']);

      expect(result.status).toBe('success');
      expect(inMemoryTender.stage).toBe(TenderStage.WAITING_GO_NO_GO);
      expect(inMemoryTender.go_nogo_status).toBe(GoNoGoStatus.PENDING);
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('DIRECTOR, GENERAL_MANAGER, and SUPER_ADMIN can all execute Go/No-Go decisions', async () => {
      // 1. DIRECTOR
      await service.submitGoNoGoReview(101, 25, ['MARKETING']);
      await service.submitGoNoGo(101, { decision: 'NO_GO', notes: 'Perlu revisi harga' }, 5, ['DIRECTOR']);
      expect(inMemoryTender.go_nogo_status).toBe(GoNoGoStatus.NO_GO);

      // Reset for next test
      inMemoryTender.stage = TenderStage.WAITING_GO_NO_GO;
      inMemoryTender.go_nogo_status = GoNoGoStatus.PENDING;
      inMemoryInstance.tasks = [
        { id: 1001, taskKey: 'GO_NOGO_APPROVAL', status: WorkflowTaskStatus.PENDING },
      ];

      // 2. GENERAL_MANAGER
      await service.submitGoNoGo(101, { decision: 'GO' }, 7, ['GENERAL_MANAGER']);
      expect(inMemoryTender.go_nogo_status).toBe(GoNoGoStatus.GO);

      // Reset for next test
      inMemoryTender.stage = TenderStage.WAITING_GO_NO_GO;
      inMemoryTender.go_nogo_status = GoNoGoStatus.PENDING;
      inMemoryInstance.tasks = [
        { id: 1001, taskKey: 'GO_NOGO_APPROVAL', status: WorkflowTaskStatus.PENDING },
      ];

      // 3. SUPER_ADMIN
      await service.submitGoNoGo(101, { decision: 'GO' }, 1, ['SUPER_ADMIN']);
      expect(inMemoryTender.go_nogo_status).toBe(GoNoGoStatus.GO);
    });
  });

  // =========================================================================
  // SECTION: WORKFLOW-CONTROLLED STAGE HARDENING (WAITING_GO_NO_GO GUARD)
  // =========================================================================
  describe('4. WORKFLOW-CONTROLLED STAGE HARDENING — WAITING_GO_NO_GO Guard', () => {
    beforeEach(() => {
      inMemoryTender.stage = TenderStage.WAITING_GO_NO_GO;
      inMemoryTender.go_nogo_status = GoNoGoStatus.PENDING;
      inMemoryTender.marketing_pic_id = 25;
    });

    it('Generic PATCH: WAITING_GO_NO_GO -> LEAD is strictly rejected', async () => {
      await expect(
        service.updateTenderStatusTransactionally(101, { stage: TenderStage.LEAD } as any, 25),
      ).rejects.toThrow(BadRequestException);
    });

    it('Generic PATCH: WAITING_GO_NO_GO -> LOST is strictly rejected', async () => {
      await expect(
        service.updateTenderStatusTransactionally(101, { stage: TenderStage.LOST } as any, 25),
      ).rejects.toThrow(BadRequestException);
    });

    it('Generic PATCH: WAITING_GO_NO_GO -> QUALIFICATION is strictly rejected', async () => {
      await expect(
        service.updateTenderStatusTransactionally(101, { stage: TenderStage.QUALIFICATION } as any, 25),
      ).rejects.toThrow(BadRequestException);
    });

    it('Generic PATCH: WAITING_GO_NO_GO -> PROPOSAL is strictly rejected', async () => {
      await expect(
        service.updateTenderStatusTransactionally(101, { stage: TenderStage.PROPOSAL } as any, 25),
      ).rejects.toThrow(BadRequestException);
    });

    it('Generic PATCH: WAITING_GO_NO_GO -> NEGOTIATION is strictly rejected', async () => {
      await expect(
        service.updateTenderStatusTransactionally(101, { stage: TenderStage.NEGOTIATION } as any, 25),
      ).rejects.toThrow(BadRequestException);
    });

    it('Generic PATCH: WAITING_GO_NO_GO -> WON is strictly rejected', async () => {
      await expect(
        service.updateTenderStatusTransactionally(101, { stage: TenderStage.WON } as any, 25),
      ).rejects.toThrow(BadRequestException);
    });

    it('Generic PATCH: WAITING_GO_NO_GO -> WAITING_GO_NO_GO is permitted (no-op)', async () => {
      const result = await service.updateTenderStatusTransactionally(
        101,
        { stage: TenderStage.WAITING_GO_NO_GO } as any,
        25,
      );
      expect(result.tender.stage).toBe(TenderStage.WAITING_GO_NO_GO);
    });
  });

  // =========================================================================
  // PHASE C: NO_GO DECISION DISCIPLINE (Mandatory reason for NO_GO)
  // =========================================================================
  describe('4. Phase C: NO_GO Decision Discipline — Mandatory Reason Validation', () => {
    it('REJECT NO_GO: empty reason is rejected with exact Indonesian error message', async () => {
      await service.submitGoNoGoReview(101, 25, ['MARKETING']);

      await expect(
        service.submitGoNoGo(101, { decision: 'NO_GO' }, 5, ['DIRECTOR']),
      ).rejects.toThrow(
        new BadRequestException('Alasan NO_GO wajib diisi agar Marketing mengetahui hal yang perlu direvisi.'),
      );

      // Verify domain stage remained WAITING_GO_NO_GO and status remained PENDING
      expect(inMemoryTender.stage).toBe(TenderStage.WAITING_GO_NO_GO);
      expect(inMemoryTender.go_nogo_status).toBe(GoNoGoStatus.PENDING);
    });

    it('REJECT NO_GO: whitespace-only reason is rejected', async () => {
      await service.submitGoNoGoReview(101, 25, ['MARKETING']);

      await expect(
        service.submitGoNoGo(101, { decision: 'NO_GO', notes: '   ' }, 5, ['DIRECTOR']),
      ).rejects.toThrow(
        new BadRequestException('Alasan NO_GO wajib diisi agar Marketing mengetahui hal yang perlu direvisi.'),
      );
    });

    it('REJECT NO_GO: non-empty reason is accepted and transitions to LEAD / NO_GO / REQUIRED', async () => {
      await service.submitGoNoGoReview(101, 25, ['MARKETING']);

      const res = await service.submitGoNoGo(
        101,
        { decision: 'NO_GO', notes: 'Harga terlalu rendah, perlu negosiasi ulang margin 15%' },
        5,
        ['DIRECTOR'],
      );

      expect(res.status).toBe('success');
      expect(inMemoryTender.stage).toBe(TenderStage.LEAD);
      expect(inMemoryTender.go_nogo_status).toBe(GoNoGoStatus.NO_GO);
      expect(inMemoryTender.revision_status).toBe(RevisionStatus.REQUIRED);
      expect(inMemoryTender.go_nogo_notes).toBe('Harga terlalu rendah, perlu negosiasi ulang margin 15%');
    });

    it('APPROVE GO: can proceed with empty decision note', async () => {
      await service.submitGoNoGoReview(101, 25, ['MARKETING']);

      const res = await service.submitGoNoGo(101, { decision: 'GO' }, 5, ['DIRECTOR']);

      expect(res.status).toBe('success');
      expect(inMemoryTender.stage).toBe(TenderStage.QUALIFICATION);
      expect(inMemoryTender.go_nogo_status).toBe(GoNoGoStatus.GO);
      expect(inMemoryTender.revision_status).toBe(RevisionStatus.NOT_REQUIRED);
    });
  });

  describe('5. Executive Decision Pack V1.1 — Validation & Snapshot Persistence', () => {
    const validDecisionPackDto = {
      executiveSummary: 'Proyek strategis dengan margin sehat dan repeat customer BUMN.',
      keyConcerns: ['Timeline delivery 3 bulan cukup ketat', 'Perlu koordinasi vendor subcon'],
      readiness: {
        customerRequirement: 'CLEAR' as const,
        commercialInformation: 'READY' as const,
        timeline: 'FEASIBLE' as const,
      },
      marketingRecommendation: 'GO' as const,
      marketingRecommendationReason: 'Customer kredibel dengan komitmen anggaran pasti.',
    };

    it('Backend validation: rejects submission when executiveSummary is missing or empty', async () => {
      await expect(
        service.submitGoNoGoReview(101, { ...validDecisionPackDto, executiveSummary: '   ' }, 25, ['MARKETING']),
      ).rejects.toThrow(new BadRequestException('Ringkasan eksekutif wajib diisi'));
    });

    it('Backend validation: rejects submission when readiness is missing or invalid', async () => {
      await expect(
        service.submitGoNoGoReview(
          101,
          { ...validDecisionPackDto, readiness: { ...validDecisionPackDto.readiness, customerRequirement: 'INVALID' as any } },
          25,
          ['MARKETING'],
        ),
      ).rejects.toThrow(new BadRequestException('Customer requirement readiness harus CLEAR, PARTIAL, atau UNCLEAR'));
    });

    it('Backend validation: rejects submission when marketingRecommendation is invalid', async () => {
      await expect(
        service.submitGoNoGoReview(
          101,
          { ...validDecisionPackDto, marketingRecommendation: 'UNKNOWN' as any },
          25,
          ['MARKETING'],
        ),
      ).rejects.toThrow(new BadRequestException('Rekomendasi marketing harus berupa GO atau REVIEW'));
    });

    it('Backend validation: rejects submission when marketingRecommendationReason is empty', async () => {
      await expect(
        service.submitGoNoGoReview(
          101,
          { ...validDecisionPackDto, marketingRecommendationReason: '' },
          25,
          ['MARKETING'],
        ),
      ).rejects.toThrow(new BadRequestException('Alasan rekomendasi marketing wajib diisi'));
    });

    it('Valid Decision Pack: stores authoritative snapshot in workflow instance context', async () => {
      const res = await service.submitGoNoGoReview(101, validDecisionPackDto, 25, ['MARKETING']);
      expect(res.status).toBe('success');

      expect(workflowEngineService.startInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowKey: 'TENDER_GO_NOGO_WORKFLOW',
          entityType: 'TENDER',
          entityId: 101,
          context: expect.objectContaining({
            decisionPack: expect.objectContaining({
              executiveSummary: 'Proyek strategis dengan margin sehat dan repeat customer BUMN.',
              keyConcerns: ['Timeline delivery 3 bulan cukup ketat', 'Perlu koordinasi vendor subcon'],
              readiness: {
                customerRequirement: 'CLEAR',
                commercialInformation: 'READY',
                timeline: 'FEASIBLE',
              },
              marketingRecommendation: 'GO',
              marketingRecommendationReason: 'Customer kredibel dengan komitmen anggaran pasti.',
              submittedBy: 'Marketing PIC',
            }),
          }),
        }),
        25,
      );
    });

    it('Resubmission: updates the decision pack snapshot in task completion contextUpdate', async () => {
      // 1. Initial submission
      await service.submitGoNoGoReview(101, validDecisionPackDto, 25, ['MARKETING']);

      // 2. Director NO_GO
      await service.submitGoNoGo(101, { decision: 'NO_GO', notes: 'Koreksi timeline delivery' }, 5, ['DIRECTOR']);
      expect(inMemoryTender.revision_status).toBe(RevisionStatus.REQUIRED);

      // Simulate Marketing revision (revision_status -> COMPLETED)
      inMemoryTender.revision_status = RevisionStatus.COMPLETED;

      // 3. Marketing resubmits with updated decision pack
      const updatedDecisionPackDto = {
        ...validDecisionPackDto,
        executiveSummary: 'Ringkasan yang direvisi dengan timeline 4 bulan.',
        keyConcerns: ['Timeline disepakati menjadi 4 bulan'],
        readiness: {
          customerRequirement: 'CLEAR' as const,
          commercialInformation: 'READY' as const,
          timeline: 'FEASIBLE' as const,
        },
        marketingRecommendationReason: 'Timeline sudah disesuaikan dengan kapasitas delivery.',
      };

      const res = await service.submitGoNoGoReview(101, updatedDecisionPackDto, 25, ['MARKETING']);
      expect(res.status).toBe('success');

      expect(workflowEngineService.completeTask).toHaveBeenCalledWith(
        1002,
        expect.objectContaining({
          action: 'RESUBMIT',
          contextUpdate: expect.objectContaining({
            decisionPack: expect.objectContaining({
              executiveSummary: 'Ringkasan yang direvisi dengan timeline 4 bulan.',
              keyConcerns: ['Timeline disepakati menjadi 4 bulan'],
            }),
          }),
        }),
        25,
        ['MARKETING'],
      );
    });
  });
});

