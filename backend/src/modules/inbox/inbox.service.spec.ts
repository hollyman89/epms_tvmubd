import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InboxService } from './inbox.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { NotificationService } from '../notification/notification.service';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { Tender, TenderStage, GoNoGoStatus } from '../../entities/tender.entity';
import { PaymentRequest } from '../../entities/payment-request.entity';
import { ProjectProgressLog } from '../../entities/project-progress-log.entity';
import { WorkflowTask, WorkflowTaskStatus } from '../../entities/workflow-task.entity';
import { ServiceClaim, ServiceClaimStatus } from '../../entities/service-claim.entity';
import { ProjectClosure, ProjectClosureStatus } from '../../entities/project-closure.entity';

describe('InboxService (Unified Inbox Foundation - N1)', () => {
  let service: InboxService;
  let workflowEngineService: jest.Mocked<Partial<WorkflowEngineService>>;
  let notificationService: jest.Mocked<Partial<NotificationService>>;
  let mockContractRepo: any;
  let mockTenderRepo: any;
  let mockPaymentRequestRepo: any;
  let mockProgressLogRepo: any;
  let mockClaimRepo: any;
  let mockClosureRepo: any;
  let mockTaskRepo: any;

  beforeEach(async () => {
    workflowEngineService = {
      getMyTasks: jest.fn().mockResolvedValue([]),
    };

    notificationService = {
      getUnreadCount: jest.fn().mockResolvedValue(5),
    };

    mockContractRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    mockTenderRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    mockPaymentRequestRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    mockProgressLogRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    mockClaimRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    mockClosureRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    mockTaskRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InboxService,
        { provide: WorkflowEngineService, useValue: workflowEngineService },
        { provide: NotificationService, useValue: notificationService },
        { provide: getRepositoryToken(Contract), useValue: mockContractRepo },
        { provide: getRepositoryToken(Tender), useValue: mockTenderRepo },
        { provide: getRepositoryToken(PaymentRequest), useValue: mockPaymentRequestRepo },
        { provide: getRepositoryToken(ProjectProgressLog), useValue: mockProgressLogRepo },
        { provide: getRepositoryToken(ServiceClaim), useValue: mockClaimRepo },
        { provide: getRepositoryToken(ProjectClosure), useValue: mockClosureRepo },
        { provide: getRepositoryToken(WorkflowTask), useValue: mockTaskRepo },
      ],
    }).compile();

    service = module.get<InboxService>(InboxService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Current user receives own directly-assigned To-Do', () => {
    it('should map directly assigned pending workflow task to TodoReadModel', async () => {
      const pendingTask: Partial<WorkflowTask> = {
        id: 101,
        nodeId: 'node_hops_review',
        taskKey: 'HOPS_REVIEW',
        status: WorkflowTaskStatus.PENDING,
        assigneeUserId: 42,
        assigneeRole: { id: 1, name: 'HEAD_OF_OPERATIONS' } as any,
        dueAt: new Date('2026-10-01T10:00:00Z'),
        createdAt: new Date('2026-09-24T08:00:00Z'),
        workflowInstance: {
          id: 50,
          entityType: 'PROJECT',
          entityId: 20,
          context: { projectId: 20 },
        } as any,
      };

      (workflowEngineService.getMyTasks as jest.Mock).mockResolvedValue([pendingTask]);

      const todos = await service.getTodos(42, ['HEAD_OF_OPERATIONS']);

      expect(workflowEngineService.getMyTasks).toHaveBeenCalledWith(42, ['HEAD_OF_OPERATIONS']);
      expect(todos).toHaveLength(1);
      expect(todos[0]).toEqual({
        todoId: 'wf-101',
        sourceType: 'WORKFLOW_TASK',
        sourceId: '101',
        taskId: 101,
        assignedUserId: 42,
        assignedRole: 'HEAD_OF_OPERATIONS',
        entityType: 'PROJECT',
        entityId: 20,
        projectId: 20,
        actionType: 'MANAGEMENT_REVIEW',
        actionTarget: '/governance/tasks?taskId=101&projectId=20',
        title: 'Review Rencana Operasional Proyek #20',
        description: undefined,
        status: 'PENDING',
        dueAt: '2026-10-01T10:00:00.000Z',
        createdAt: '2026-09-24T08:00:00.000Z',
        updatedAt: undefined,
      });
    });
  });

  describe('2. Role-assigned To-Do resolves correctly', () => {
    it('should map purchase request approval task for PROCUREMENT role', async () => {
      const prTask: Partial<WorkflowTask> = {
        id: 202,
        taskKey: 'PROCUREMENT_REVIEW',
        status: WorkflowTaskStatus.PENDING,
        assigneeRoleId: 3,
        assigneeRole: { id: 3, name: 'PROCUREMENT' } as any,
        createdAt: new Date('2026-09-24T07:30:00Z'),
        workflowInstance: {
          id: 60,
          entityType: 'PURCHASE_REQUEST',
          entityId: 15,
          context: { projectId: 20 },
        } as any,
      };

      (workflowEngineService.getMyTasks as jest.Mock).mockResolvedValue([prTask]);

      const todos = await service.getTodos(99, ['PROCUREMENT']);

      expect(todos).toHaveLength(1);
      expect(todos[0].entityType).toBe('PURCHASE_REQUEST');
      expect(todos[0].actionType).toBe('PURCHASE_REQUEST_APPROVAL');
      expect(todos[0].actionTarget).toBe('/procurement?tab=pr&prId=15');
      expect(todos[0].projectId).toBe(20);
    });
  });

  describe('3. Unrelated user cannot see tasks', () => {
    it('should return empty todos when user has no matching tasks and no domain roles', async () => {
      (workflowEngineService.getMyTasks as jest.Mock).mockResolvedValue([]);

      const todos = await service.getTodos(888, ['GUEST']);

      expect(todos).toHaveLength(0);
      expect(mockContractRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(mockTenderRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('4. Completed tasks absent from To-Do', () => {
    it('should not include completed or rejected workflow tasks', async () => {
      // getMyTasks only queries PENDING tasks; verify that empty return yields zero todos
      (workflowEngineService.getMyTasks as jest.Mock).mockResolvedValue([]);

      const todos = await service.getTodos(42, ['HEAD_OF_OPERATIONS']);
      expect(todos).toHaveLength(0);
    });
  });

  describe('5. Returned tasks appear for correct assignee', () => {
    it('should include returned workflow task re-assigned as PENDING to revision actor', async () => {
      const revisionTask: Partial<WorkflowTask> = {
        id: 303,
        nodeId: 'node_pm_revision_hops',
        taskKey: 'node_pm_revision_hops',
        status: WorkflowTaskStatus.PENDING,
        assigneeUserId: 15,
        assigneeRole: { id: 2, name: 'PROJECT_MANAGER' } as any,
        comments: 'Mohon perbaiki anggaran WBS item 3',
        createdAt: new Date('2026-09-24T08:15:00Z'),
        workflowInstance: {
          id: 70,
          entityType: 'PROJECT',
          entityId: 20,
        } as any,
      };

      (workflowEngineService.getMyTasks as jest.Mock).mockResolvedValue([revisionTask]);

      const todos = await service.getTodos(15, ['PROJECT_MANAGER']);

      expect(todos).toHaveLength(1);
      expect(todos[0].taskId).toBe(303);
      expect(todos[0].assignedUserId).toBe(15);
      expect(todos[0].actionType).toBe('PM_REVISION');
      expect(todos[0].description).toBe('Mohon perbaiki anggaran WBS item 3');
      expect(todos[0].actionTarget).toBe('/project-delivery?projectId=20&action=operational-plan');
    });
  });

  describe('6. Notifications remain separate; no notification row becomes To-Do implicitly', () => {
    it('should retrieve informational unread count without injecting notification rows into todos', async () => {
      (workflowEngineService.getMyTasks as jest.Mock).mockResolvedValue([]);
      (notificationService.getUnreadCount as jest.Mock).mockResolvedValue(12);

      const summary = await service.getSummary(42, ['USER']);

      expect(summary.todoCount).toBe(0);
      expect(summary.unreadNotificationCount).toBe(12);
      expect(notificationService.getUnreadCount).toHaveBeenCalledWith(42);
    });
  });

  describe('7. Domain queue isolation (Legal & Tender Go/No-Go)', () => {
    it('should include pending contracts for LEGAL role with correct deep link', async () => {
      const mockContract: Partial<Contract> = {
        id: 77,
        contract_number: 'CTR-2026-001',
        status: 'PENDING_LEGAL_REVIEW',
        legal_status: LegalStatus.DRAFT,
        legal_notes: 'Draft SPK siap verifikasi',
        grace_deadline: new Date('2026-10-05T00:00:00Z'),
        created_at: new Date('2026-09-24T06:00:00Z'),
      };

      mockContractRepo.createQueryBuilder().getMany.mockResolvedValue([mockContract]);

      const todos = await service.getTodos(10, ['LEGAL']);

      expect(mockContractRepo.createQueryBuilder).toHaveBeenCalled();
      const legalTodo = todos.find((t) => t.todoId === 'contract-77');
      expect(legalTodo).toBeDefined();
      expect(legalTodo?.actionType).toBe('LEGAL_REVIEW');
      expect(legalTodo?.actionTarget).toBe('/legal/review?contractId=77');
      expect(legalTodo?.assignedRole).toBe('LEGAL');
    });

    it('should NOT query pending contracts if user does NOT have legal/admin roles', async () => {
      const todos = await service.getTodos(10, ['MARKETING', 'SALES']);

      expect(mockContractRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(todos.some((t) => t.sourceType === 'DOMAIN_CONTRACT')).toBe(false);
    });

    it('should NOT include pending contracts for DIRECTOR role (Legal review operational To-Do excluded for Director)', async () => {
      const todos = await service.getTodos(5, ['DIRECTOR']);

      expect(mockContractRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(todos.some((t) => t.sourceType === 'DOMAIN_CONTRACT')).toBe(false);
      expect(todos.some((t) => t.actionType === 'LEGAL_REVIEW')).toBe(false);
    });

    it('should include pending tender Go/No-Go decisions for DIRECTOR role', async () => {
      const mockTender: Partial<Tender> = {
        id: 88,
        title: 'Pengadaan Server Cloud',
        stage: TenderStage.WAITING_GO_NO_GO,
        go_nogo_status: GoNoGoStatus.PENDING,
        submission_deadline: new Date('2026-09-30T17:00:00Z'),
        created_at: new Date('2026-09-24T07:00:00Z'),
      };

      mockTenderRepo.createQueryBuilder().getMany.mockResolvedValue([mockTender]);

      const todos = await service.getTodos(5, ['DIRECTOR']);

      expect(mockTenderRepo.createQueryBuilder).toHaveBeenCalled();
      const tenderTodo = todos.find((t) => t.todoId === 'tender-88');
      expect(tenderTodo).toBeDefined();
      expect(tenderTodo?.actionType).toBe('GO_NOGO_APPROVAL');
      expect(tenderTodo?.actionTarget).toBe('/sales?tab=1&tenderId=88&action=go-nogo');
    });

    it('should map WorkflowTask with entityType TENDER and taskKey GO_NOGO_APPROVAL to sales deep-link', async () => {
      const tenderTask: Partial<WorkflowTask> = {
        id: 202,
        taskKey: 'GO_NOGO_APPROVAL',
        status: WorkflowTaskStatus.PENDING,
        assigneeUserId: 10,
        assigneeRole: { id: 2, name: 'DIRECTOR' } as any,
        dueAt: new Date('2026-10-02T10:00:00Z'),
        createdAt: new Date('2026-09-24T08:00:00Z'),
        workflowInstance: {
          id: 60,
          entityType: 'TENDER',
          entityId: 99,
        } as any,
      };

      (workflowEngineService.getMyTasks as jest.Mock).mockResolvedValue([tenderTask]);

      const todos = await service.getTodos(10, ['DIRECTOR']);

      const wfTodo = todos.find((t) => t.todoId === 'wf-202');
      expect(wfTodo).toBeDefined();
      expect(wfTodo?.entityType).toBe('TENDER');
      expect(wfTodo?.actionType).toBe('GO_NOGO_APPROVAL');
      expect(wfTodo?.actionTarget).toBe('/sales?tab=1&tenderId=99&action=go-nogo');
      expect(wfTodo?.title).toBe('Persetujuan GO / NO-GO');
    });

    it('should enrich GO_NOGO_APPROVAL with Project Name, Customer, and actual Submitter Name', async () => {
      const tenderTask: Partial<WorkflowTask> = {
        id: 203,
        taskKey: 'GO_NOGO_APPROVAL',
        status: WorkflowTaskStatus.PENDING,
        assigneeRole: { id: 2, name: 'DIRECTOR' } as any,
        createdAt: new Date('2026-09-24T08:00:00Z'),
        workflowInstance: {
          id: 75,
          entityType: 'TENDER',
          entityId: 33,
        } as any,
      };

      mockTenderRepo.findOne = jest.fn().mockResolvedValue({
        id: 33,
        title: 'Project Gudang Jakarta Selatan',
        customer: { id: 14, name: 'J&T Express' },
      });

      mockTenderRepo.manager = {
        createQueryBuilder: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ actorId: 7, fullName: 'Lukas Kurniawan' }),
        }),
      };

      (workflowEngineService.getMyTasks as jest.Mock).mockResolvedValue([tenderTask]);

      const todos = await service.getTodos(10, ['DIRECTOR']);

      const todo = todos.find((t) => t.todoId === 'wf-203');
      expect(todo).toBeDefined();
      expect(todo?.title).toBe('Persetujuan GO / NO-GO');
      expect(todo?.title).not.toContain('Tender #33');
      expect(todo?.projectName).toBe('Project Gudang Jakarta Selatan');
      expect(todo?.customerName).toBe('J&T Express');
      expect(todo?.submittedByName).toBe('Lukas Kurniawan');
      expect(todo?.actionTarget).toBe('/sales?tab=1&tenderId=33&action=go-nogo');
    });

    it('should NOT query pending tenders if user does NOT have director/gm/super_admin roles', async () => {
      const todos = await service.getTodos(5, ['LEGAL', 'PROCUREMENT']);

      expect(mockTenderRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(todos.some((t) => t.sourceType === 'DOMAIN_TENDER')).toBe(false);
    });
  });

  describe('8. Deterministic ordering: Overdue -> Nearest dueAt -> Newest createdAt', () => {
    it('should order todos with overdue first, then nearest due, then newest created', async () => {
      const now = Date.now();
      const overdueDate = new Date(now - 1000 * 60 * 60 * 24); // 1 day ago
      const upcomingNear = new Date(now + 1000 * 60 * 60 * 2); // 2 hours ahead
      const upcomingFar = new Date(now + 1000 * 60 * 60 * 48); // 2 days ahead

      const taskNoDueNew: Partial<WorkflowTask> = {
        id: 1,
        taskKey: 'NO_DUE_NEW',
        status: WorkflowTaskStatus.PENDING,
        createdAt: new Date('2026-09-24T09:00:00Z'),
        workflowInstance: { id: 1, entityType: 'OTHER', entityId: 1 } as any,
      };

      const taskNoDueOld: Partial<WorkflowTask> = {
        id: 2,
        taskKey: 'NO_DUE_OLD',
        status: WorkflowTaskStatus.PENDING,
        createdAt: new Date('2026-09-24T01:00:00Z'),
        workflowInstance: { id: 2, entityType: 'OTHER', entityId: 2 } as any,
      };

      const taskUpcomingFar: Partial<WorkflowTask> = {
        id: 3,
        taskKey: 'UPCOMING_FAR',
        status: WorkflowTaskStatus.PENDING,
        dueAt: upcomingFar,
        createdAt: new Date('2026-09-24T05:00:00Z'),
        workflowInstance: { id: 3, entityType: 'OTHER', entityId: 3 } as any,
      };

      const taskUpcomingNear: Partial<WorkflowTask> = {
        id: 4,
        taskKey: 'UPCOMING_NEAR',
        status: WorkflowTaskStatus.PENDING,
        dueAt: upcomingNear,
        createdAt: new Date('2026-09-24T04:00:00Z'),
        workflowInstance: { id: 4, entityType: 'OTHER', entityId: 4 } as any,
      };

      const taskOverdue: Partial<WorkflowTask> = {
        id: 5,
        taskKey: 'OVERDUE',
        status: WorkflowTaskStatus.PENDING,
        dueAt: overdueDate,
        createdAt: new Date('2026-09-23T10:00:00Z'),
        workflowInstance: { id: 5, entityType: 'OTHER', entityId: 5 } as any,
      };

      (workflowEngineService.getMyTasks as jest.Mock).mockResolvedValue([
        taskNoDueOld,
        taskNoDueNew,
        taskUpcomingFar,
        taskUpcomingNear,
        taskOverdue,
      ]);

      const todos = await service.getTodos(1, ['USER']);

      // Expected order:
      // 1. OVERDUE (id 5)
      // 2. UPCOMING_NEAR (id 4)
      // 3. UPCOMING_FAR (id 3)
      // 4. NO_DUE_NEW (id 1)
      // 5. NO_DUE_OLD (id 2)
      expect(todos.map((t) => t.taskId)).toEqual([5, 4, 3, 1, 2]);
    });
  });

  describe('9. Unknown/unmapped workflow task returns actionTarget: null (no /inbox fallback)', () => {
    it('should set actionTarget to null for unknown entityType or unmapped node', async () => {
      const genericTask: Partial<WorkflowTask> = {
        id: 777,
        taskKey: 'UNKNOWN_CUSTOM_STEP',
        status: WorkflowTaskStatus.PENDING,
        createdAt: new Date('2026-09-24T08:00:00Z'),
        workflowInstance: {
          id: 999,
          entityType: 'HR_LEAVE_REQUEST',
          entityId: 123,
        } as any,
      };

      (workflowEngineService.getMyTasks as jest.Mock).mockResolvedValue([genericTask]);

      const todos = await service.getTodos(1, ['USER']);

      expect(todos).toHaveLength(1);
      expect(todos[0].actionType).toBe('UNKNOWN_CUSTOM_STEP');
      expect(todos[0].actionTarget).toBeNull();
    });
  });

  describe('10. Missing required identity cannot construct actionTarget (yields null)', () => {
    it('returns null actionTarget when PR has missing or 0 entityId', async () => {
      const invalidPrTask: Partial<WorkflowTask> = {
        id: 888,
        taskKey: 'PR_APPROVAL',
        status: WorkflowTaskStatus.PENDING,
        workflowInstance: {
          id: 111,
          entityType: 'PURCHASE_REQUEST',
          entityId: 0,
        } as any,
      };

      (workflowEngineService.getMyTasks as jest.Mock).mockResolvedValue([invalidPrTask]);

      const todos = await service.getTodos(1, ['PROCUREMENT']);

      expect(todos).toHaveLength(1);
      expect(todos[0].actionTarget).toBeNull();
    });

    it('returns null actionTarget when project task lacks projectId', async () => {
      const invalidProjectTask: Partial<WorkflowTask> = {
        id: 889,
        nodeId: 'node_hops_review',
        taskKey: 'HOPS_REVIEW',
        status: WorkflowTaskStatus.PENDING,
        workflowInstance: {
          id: 112,
          entityType: 'PROJECT',
          entityId: 0,
          context: {},
        } as any,
      };

      (workflowEngineService.getMyTasks as jest.Mock).mockResolvedValue([invalidProjectTask]);

      const todos = await service.getTodos(1, ['HEAD_OF_OPERATIONS']);

      expect(todos).toHaveLength(1);
      expect(todos[0].actionTarget).toBeNull();
    });
  });

  describe('11. WF-3B Section 20: Transitional Deduplication: Tender Go/No-Go DOMAIN_TENDER vs WORKFLOW_TASK', () => {
    it('WorkflowTask exists -> WORKFLOW_TASK returned & DOMAIN_TENDER suppressed (DIRECTOR)', async () => {
      const wfTask: Partial<WorkflowTask> = {
        id: 501,
        taskKey: 'GO_NOGO_APPROVAL',
        status: WorkflowTaskStatus.PENDING,
        createdAt: new Date('2026-09-24T10:00:00Z'),
        workflowInstance: {
          id: 301,
          entityType: 'TENDER',
          entityId: 99,
        } as any,
      };

      (workflowEngineService.getMyTasks as jest.Mock).mockResolvedValue([wfTask]);

      const mockTender = {
        id: 99,
        title: 'Pengadaan Server DC',
        stage: TenderStage.WAITING_GO_NO_GO,
        go_nogo_status: GoNoGoStatus.PENDING,
        submission_deadline: new Date('2026-10-15T00:00:00Z'),
        created_at: new Date('2026-09-24T09:00:00Z'),
      };

      mockTenderRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockTender]),
      });

      const todos = await service.getTodos(10, ['DIRECTOR']);

      // Exactly 1 todo returned (no duplicate card)
      expect(todos).toHaveLength(1);
      expect(todos[0].sourceType).toBe('WORKFLOW_TASK');
      expect(todos[0].entityType).toBe('TENDER');
      expect(todos[0].entityId).toBe(99);
      expect(todos[0].actionType).toBe('GO_NOGO_APPROVAL');
      expect(todos[0].actionTarget).toBe('/sales?tab=1&tenderId=99&action=go-nogo');
    });

    it('WorkflowTask exists -> WORKFLOW_TASK returned & DOMAIN_TENDER suppressed (GENERAL_MANAGER)', async () => {
      const wfTask: Partial<WorkflowTask> = {
        id: 502,
        taskKey: 'GO_NOGO_APPROVAL',
        status: WorkflowTaskStatus.PENDING,
        createdAt: new Date('2026-09-24T10:00:00Z'),
        workflowInstance: {
          id: 302,
          entityType: 'TENDER',
          entityId: 100,
        } as any,
      };

      (workflowEngineService.getMyTasks as jest.Mock).mockResolvedValue([wfTask]);

      const mockTender = {
        id: 100,
        title: 'Pengadaan Switch Core',
        stage: TenderStage.WAITING_GO_NO_GO,
        go_nogo_status: GoNoGoStatus.PENDING,
        submission_deadline: new Date('2026-10-15T00:00:00Z'),
        created_at: new Date('2026-09-24T09:00:00Z'),
      };

      mockTenderRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockTender]),
      });

      const todos = await service.getTodos(20, ['GENERAL_MANAGER']);

      expect(todos).toHaveLength(1);
      expect(todos[0].sourceType).toBe('WORKFLOW_TASK');
      expect(todos[0].entityType).toBe('TENDER');
      expect(todos[0].entityId).toBe(100);
      expect(todos[0].actionType).toBe('GO_NOGO_APPROVAL');
    });

    it('WorkflowTask absent -> DOMAIN_TENDER returned (migration safety net)', async () => {
      // Empty workflow tasks (e.g. startInstance failed)
      (workflowEngineService.getMyTasks as jest.Mock).mockResolvedValue([]);

      const mockTender = {
        id: 105,
        title: 'Tender Cadangan',
        stage: TenderStage.WAITING_GO_NO_GO,
        go_nogo_status: GoNoGoStatus.PENDING,
        submission_deadline: new Date('2026-10-15T00:00:00Z'),
        created_at: new Date('2026-09-24T09:00:00Z'),
      };

      mockTenderRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockTender]),
      });

      const todos = await service.getTodos(10, ['DIRECTOR']);

      expect(todos).toHaveLength(1);
      expect(todos[0].sourceType).toBe('DOMAIN_TENDER');
      expect(todos[0].entityType).toBe('TENDER');
      expect(todos[0].entityId).toBe(105);
      expect(todos[0].actionType).toBe('GO_NOGO_APPROVAL');
      expect(todos[0].actionTarget).toBe('/sales?tab=1&tenderId=105&action=go-nogo');
    });

    it('maps GO_NOGO_REVISION workflow task to sales actionTarget with action=go-nogo', async () => {
      const revTask: Partial<WorkflowTask> = {
        id: 503,
        taskKey: 'GO_NOGO_REVISION',
        status: WorkflowTaskStatus.PENDING,
        createdAt: new Date('2026-09-24T10:00:00Z'),
        workflowInstance: {
          id: 303,
          entityType: 'TENDER',
          entityId: 101,
        } as any,
      };

      (workflowEngineService.getMyTasks as jest.Mock).mockResolvedValue([revTask]);

      const todos = await service.getTodos(30, ['MARKETING']);

      expect(todos).toHaveLength(1);
      expect(todos[0].sourceType).toBe('WORKFLOW_TASK');
      expect(todos[0].actionType).toBe('GO_NOGO_REVISION');
      expect(todos[0].actionTarget).toBe('/sales?tab=1&tenderId=101&action=go-nogo');
      expect(todos[0].title).toBe('Revisi GO / NO-GO');
    });

    it('enriches GO_NOGO_REVISION with projectName, customerName, returnedByName, and returnReason', async () => {
      const revTask: Partial<WorkflowTask> = {
        id: 504,
        taskKey: 'GO_NOGO_REVISION',
        status: WorkflowTaskStatus.PENDING,
        createdAt: new Date('2026-09-24T10:00:00Z'),
        workflowInstance: {
          id: 304,
          entityType: 'TENDER',
          entityId: 102,
        } as any,
      };

      (workflowEngineService.getMyTasks as jest.Mock).mockResolvedValue([revTask]);

      mockTenderRepo.findOne = jest.fn().mockResolvedValue({
        id: 102,
        title: 'Renovasi Kantor HQ J&T Indonesia',
        customer: { name: 'J&T Express' },
      });

      const qbMock = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          actorId: 4,
          fullName: 'Budi Director',
          reason: 'masih salah nominalnya',
        }),
      };

      mockTenderRepo.manager = {
        createQueryBuilder: jest.fn().mockReturnValue(qbMock),
      };

      const todos = await service.getTodos(30, ['MARKETING']);

      expect(todos).toHaveLength(1);
      expect(todos[0].title).toBe('Revisi GO / NO-GO');
      expect(todos[0].projectName).toBe('Renovasi Kantor HQ J&T Indonesia');
      expect(todos[0].customerName).toBe('J&T Express');
      expect(todos[0].returnedByName).toBe('Budi Director');
      expect(todos[0].returnReason).toBe('masih salah nominalnya');
    });

    it('maps CONTRACT LEGAL_DOCUMENT_REVISION task to Sales drawer actionTarget and enriches context', async () => {
      const contractRevTask: Partial<WorkflowTask> = {
        id: 28,
        taskKey: 'LEGAL_DOCUMENT_REVISION',
        nodeId: 'node_marketing_revision',
        status: WorkflowTaskStatus.PENDING,
        assigneeUserId: 7,
        createdAt: new Date('2026-10-14T20:00:00Z'),
        workflowInstance: {
          id: 17,
          entityType: 'CONTRACT',
          entityId: 4,
          context: {
            contractId: 4,
            tenderId: 4,
            contractNumber: 'CONT-20261014-0004',
            marketing_pic_id: 7,
          },
        } as any,
      };

      (workflowEngineService.getMyTasks as jest.Mock).mockResolvedValue([contractRevTask]);

      mockTenderRepo.findOne = jest.fn().mockResolvedValue({
        id: 4,
        title: 'Pengadaan Network Hardware J&T Express',
        customer: { name: 'J&T Express' },
      });

      const qbMock = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          actorId: 10,
          fullName: 'Legal Officer',
          reason: 'salah upload SPK kamu ya ',
        }),
      };

      mockTenderRepo.manager = {
        createQueryBuilder: jest.fn().mockReturnValue(qbMock),
      };

      const todos = await service.getTodos(7, ['MARKETING']);

      expect(todos).toHaveLength(1);
      expect(todos[0].sourceType).toBe('WORKFLOW_TASK');
      expect(todos[0].actionType).toBe('LEGAL_DOCUMENT_REVISION');
      expect(todos[0].actionTarget).toBe('/sales?tab=1&tenderId=4');
      expect(todos[0].title).toBe('Revisi Dokumen SPK / Kontrak #CONT-20261014-0004');
      expect(todos[0].projectName).toBe('Pengadaan Network Hardware J&T Express');
      expect(todos[0].customerName).toBe('J&T Express');
      expect(todos[0].returnedByName).toBe('Legal Officer');
      expect(todos[0].returnReason).toBe('salah upload SPK kamu ya ');
    });
  });

  describe('11. Progress Claim Verification Domain Queue (HEAD_OF_OPERATIONS & PMO)', () => {
    it('should surface pending progress claim as actionable To-Do for HEAD_OF_OPERATIONS', async () => {
      const mockClaim = {
        id: 267,
        project_id: 1,
        task_id: 1,
        submitted_by: 2,
        reported_progress: '100.00',
        previous_progress: '99.99',
        status: 'PENDING_VERIFICATION',
        reason: 'Pekerjaan perizinan selesai 100%',
        created_at: new Date('2026-10-16T03:00:00Z'),
        updated_at: new Date('2026-10-16T03:00:00Z'),
        project: { id: 1, name: 'Project Fiber Optic' },
        task: { id: 1, name: 'PERIZINAN' },
        submitter: { id: 2, fullName: 'Project Manager' },
      };

      mockProgressLogRepo.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockClaim]),
      });

      const todos = await service.getTodos(58, ['HEAD_OF_OPERATIONS']);

      expect(todos).toHaveLength(1);
      expect(todos[0]).toEqual(
        expect.objectContaining({
          todoId: 'progress-claim-267',
          sourceType: 'DOMAIN_PROGRESS_CLAIM',
          sourceId: '267',
          taskId: 1,
          assignedRole: 'HEAD_OF_OPERATIONS',
          entityType: 'PROJECT_PROGRESS_CLAIM',
          entityId: 267,
          projectId: 1,
          actionType: 'PROGRESS_CLAIM_VERIFICATION',
          actionTarget: '/project-delivery?view=workspace&projectId=1&section=tasks&progressClaimId=267',
          title: 'Verifikasi Klaim Progres: PERIZINAN (99.99% → 100%)',
          description: 'Pekerjaan perizinan selesai 100%',
          status: 'PENDING_VERIFICATION',
          projectName: 'Project Fiber Optic',
          submittedByName: 'Project Manager',
        }),
      );
    });

    it('should enforce Segregation of Duties: Submitter PM cannot see own claim in To-Do', async () => {
      const mockClaim = {
        id: 267,
        project_id: 1,
        task_id: 1,
        submitted_by: 2,
        reported_progress: '100.00',
        previous_progress: '99.99',
        status: 'PENDING_VERIFICATION',
        project: { id: 1, name: 'Project Fiber Optic' },
        task: { id: 1, name: 'PERIZINAN' },
        submitter: { id: 2, fullName: 'Project Manager' },
      };

      mockProgressLogRepo.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockClaim]),
      });

      const todos = await service.getTodos(2, ['PMO']);
      expect(todos).toHaveLength(0);
    });

    it('should NOT surface progress claims for unrelated roles (e.g. MARKETING, LEGAL)', async () => {
      const todos = await service.getTodos(15, ['MARKETING', 'LEGAL']);
      expect(mockProgressLogRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(todos).toHaveLength(0);
    });
  });

  describe('12. Service Claim Domain Queue (SUBMITTED, PM_VERIFIED, NEEDS_REVISION)', () => {
    const claimSubmitted = {
      id: 101,
      claimNumber: 'CLM-2026-001',
      status: ServiceClaimStatus.SUBMITTED,
      poId: 50,
      projectId: 1,
      totalClaimAmount: 5000000,
      submittedAt: new Date('2026-10-15T10:00:00Z'),
      project: { id: 1, name: 'Project Fiber Surabaya', managerId: 4 },
      purchaseOrder: { id: 50, poNumber: 'PO-2026-050' },
    };

    const claimVerified = {
      id: 102,
      claimNumber: 'CLM-2026-002',
      status: ServiceClaimStatus.PM_VERIFIED,
      poId: 51,
      projectId: 1,
      totalClaimAmount: 7500000,
      pmVerifiedAt: new Date('2026-10-15T11:00:00Z'),
      project: { id: 1, name: 'Project Fiber Surabaya', managerId: 4 },
      purchaseOrder: { id: 51, poNumber: 'PO-2026-051' },
    };

    const claimRevision = {
      id: 103,
      claimNumber: 'CLM-2026-003',
      status: ServiceClaimStatus.NEEDS_REVISION,
      poId: 52,
      projectId: 1,
      totalClaimAmount: 2000000,
      submittedBy: 41,
      notes: 'Klaim melebihi batas progres fisik.',
      updatedAt: new Date('2026-10-15T12:00:00Z'),
      project: { id: 1, name: 'Project Fiber Surabaya', managerId: 4 },
      purchaseOrder: { id: 52, poNumber: 'PO-2026-052' },
    };

    it('SUBMITTED projects to assigned PM only (not unrelated PM or roles)', async () => {
      mockClaimRepo.find.mockResolvedValue([claimSubmitted]);

      // Assigned PM (id=4)
      const pmTodos = await service.getTodos(4, ['PROJECT_MANAGER']);
      expect(pmTodos.some((t) => t.sourceType === 'DOMAIN_SERVICE_CLAIM' && t.entityId === 101)).toBe(true);
      expect(pmTodos.find((t) => t.entityId === 101)?.actionTarget).toBe('/project-delivery?projectId=1&serviceClaimId=101');

      // Unrelated PM (id=99)
      const otherPmTodos = await service.getTodos(99, ['PROJECT_MANAGER']);
      expect(otherPmTodos.some((t) => t.sourceType === 'DOMAIN_SERVICE_CLAIM' && t.entityId === 101)).toBe(false);

      // Unrelated role (LEGAL)
      const legalTodos = await service.getTodos(10, ['LEGAL']);
      expect(legalTodos.some((t) => t.sourceType === 'DOMAIN_SERVICE_CLAIM' && t.entityId === 101)).toBe(false);
    });

    it('PM_VERIFIED projects to PROCUREMENT role only', async () => {
      mockClaimRepo.find.mockResolvedValue([claimVerified]);

      // PROCUREMENT user
      const procTodos = await service.getTodos(41, ['PROCUREMENT']);
      expect(procTodos.some((t) => t.sourceType === 'DOMAIN_SERVICE_CLAIM' && t.entityId === 102)).toBe(true);
      expect(procTodos.find((t) => t.entityId === 102)?.actionTarget).toBe('/procurement?tab=po&poId=51&action=service-claim');

      // PM user (not procurement)
      const pmTodos = await service.getTodos(4, ['PROJECT_MANAGER']);
      expect(pmTodos.some((t) => t.sourceType === 'DOMAIN_SERVICE_CLAIM' && t.entityId === 102)).toBe(false);
    });

    it('NEEDS_REVISION projects to submitter only', async () => {
      mockClaimRepo.find.mockResolvedValue([claimRevision]);

      // Submitter (id=41)
      const submitterTodos = await service.getTodos(41, ['PROCUREMENT']);
      expect(submitterTodos.some((t) => t.sourceType === 'DOMAIN_SERVICE_CLAIM' && t.entityId === 103)).toBe(true);

      // Other user (id=42)
      const otherTodos = await service.getTodos(42, ['PROCUREMENT']);
      expect(otherTodos.some((t) => t.sourceType === 'DOMAIN_SERVICE_CLAIM' && t.entityId === 103)).toBe(false);
    });

    it('deduplicates DOMAIN_SERVICE_CLAIM if matching WORKFLOW_TASK exists', async () => {
      mockClaimRepo.find.mockResolvedValue([claimSubmitted]);
      workflowEngineService.getMyTasks.mockResolvedValue([
        {
          id: 501,
          workflowInstance: {
            entityType: 'SERVICE_CLAIM',
            entityId: 101,
            project: { id: 1, name: 'Project Fiber Surabaya' },
          },
          nodeId: 'node_pm_verification',
          taskKey: 'SERVICE_CLAIM_VERIFICATION',
          title: 'Verifikasi Teknis Klaim Jasa',
          status: WorkflowTaskStatus.PENDING,
          assignedRole: 'PROJECT_MANAGER',
          createdAt: new Date(),
        } as any,
      ]);

      const todos = await service.getTodos(4, ['PROJECT_MANAGER']);
      const matchingClaims = todos.filter((t) => t.entityType === 'SERVICE_CLAIM' && Number(t.entityId) === 101);
      expect(matchingClaims).toHaveLength(1);
      expect(matchingClaims[0].sourceType).toBe('WORKFLOW_TASK');
    });
  });

  describe('13. Project Closure Domain Queue (PENDING_HOO_REVIEW, PENDING_DIRECTOR_APPROVAL, RETURNED)', () => {
    const closureHoo = {
      id: 201,
      projectId: 1,
      cycleNumber: 1,
      status: ProjectClosureStatus.PENDING_HOO_REVIEW,
      submittedById: 4,
      submittedAt: new Date('2026-10-15T09:00:00Z'),
      project: { id: 1, name: 'Project Fiber Surabaya', managerId: 4 },
      submittedBy: { fullName: 'Project Manager' },
    };

    const closureDirector = {
      id: 202,
      projectId: 1,
      cycleNumber: 1,
      status: ProjectClosureStatus.PENDING_DIRECTOR_APPROVAL,
      submittedById: 4,
      hooReviewedAt: new Date('2026-10-15T11:00:00Z'),
      project: { id: 1, name: 'Project Fiber Surabaya', managerId: 4 },
      submittedBy: { fullName: 'Project Manager' },
    };

    const closureReturned = {
      id: 203,
      projectId: 1,
      cycleNumber: 1,
      status: ProjectClosureStatus.RETURNED,
      submittedById: 4,
      returnTimestamp: new Date('2026-10-15T13:00:00Z'),
      returnReason: 'Dokumen BAST belum lengkap.',
      project: { id: 1, name: 'Project Fiber Surabaya', managerId: 4 },
      returnActor: { fullName: 'Head of Operations' },
    };

    it('PENDING_HOO_REVIEW projects to HEAD_OF_OPERATIONS only', async () => {
      mockClosureRepo.find.mockResolvedValue([closureHoo]);

      const hooTodos = await service.getTodos(58, ['HEAD_OF_OPERATIONS']);
      expect(hooTodos.some((t) => t.sourceType === 'DOMAIN_PROJECT_CLOSURE' && t.entityId === 201)).toBe(true);
      expect(hooTodos.find((t) => t.entityId === 201)?.actionTarget).toBe('/governance/tasks?projectId=1');

      const directorTodos = await service.getTodos(3, ['DIRECTOR']);
      expect(directorTodos.some((t) => t.sourceType === 'DOMAIN_PROJECT_CLOSURE' && t.entityId === 201)).toBe(false);
    });

    it('PENDING_DIRECTOR_APPROVAL projects to DIRECTOR only', async () => {
      mockClosureRepo.find.mockResolvedValue([closureDirector]);

      const dirTodos = await service.getTodos(3, ['DIRECTOR']);
      expect(dirTodos.some((t) => t.sourceType === 'DOMAIN_PROJECT_CLOSURE' && t.entityId === 202)).toBe(true);

      const hooTodos = await service.getTodos(58, ['HEAD_OF_OPERATIONS']);
      expect(hooTodos.some((t) => t.sourceType === 'DOMAIN_PROJECT_CLOSURE' && t.entityId === 202)).toBe(false);
    });

    it('RETURNED projects to assigned PM only', async () => {
      mockClosureRepo.find.mockResolvedValue([closureReturned]);

      // Assigned PM
      const pmTodos = await service.getTodos(4, ['PROJECT_MANAGER']);
      expect(pmTodos.some((t) => t.sourceType === 'DOMAIN_PROJECT_CLOSURE' && t.entityId === 203)).toBe(true);
      expect(pmTodos.find((t) => t.entityId === 203)?.actionTarget).toBe('/project-delivery?view=workspace&projectId=1&section=closure');

      // Unrelated PM
      const otherPmTodos = await service.getTodos(99, ['PROJECT_MANAGER']);
      expect(otherPmTodos.some((t) => t.sourceType === 'DOMAIN_PROJECT_CLOSURE' && t.entityId === 203)).toBe(false);
    });

    it('deduplicates DOMAIN_PROJECT_CLOSURE if matching WORKFLOW_TASK exists', async () => {
      mockClosureRepo.find.mockResolvedValue([closureHoo]);
      workflowEngineService.getMyTasks.mockResolvedValue([
        {
          id: 601,
          workflowInstance: {
            entityType: 'PROJECT_CLOSURE',
            entityId: 201,
            project: { id: 1, name: 'Project Fiber Surabaya' },
          },
          nodeId: 'node_hoo_review',
          taskKey: 'PROJECT_CLOSURE_HOO_REVIEW',
          title: 'Review Penutupan Proyek',
          status: WorkflowTaskStatus.PENDING,
          assignedRole: 'HEAD_OF_OPERATIONS',
          createdAt: new Date(),
        } as any,
      ]);

      const todos = await service.getTodos(58, ['HEAD_OF_OPERATIONS']);
      const matching = todos.filter((t) => t.entityType === 'PROJECT_CLOSURE' && Number(t.entityId) === 201);
      expect(matching).toHaveLength(1);
      expect(matching[0].sourceType).toBe('WORKFLOW_TASK');
    });
  });

  describe('14. Riwayat / Completed History (GET /inbox/history)', () => {
    it('returns completed, returned, and rejected historical tasks and excludes pending tasks', async () => {
      const completedTask = {
        id: 701,
        status: WorkflowTaskStatus.COMPLETED,
        action: 'APPROVE',
        decidedBy: 4,
        decidedByName: 'Budi Santoso',
        decidedAt: new Date('2026-10-16T10:00:00Z'),
        createdAt: new Date('2026-10-15T08:00:00Z'),
        title: 'Review Rencana Operasional',
        taskKey: 'MANAGEMENT_REVIEW',
        workflowInstance: {
          entityType: 'PROJECT',
          entityId: 1,
          project: { id: 1, name: 'Project Fiber Surabaya', managerId: 4 },
        },
      };

      const returnedTask = {
        id: 702,
        status: WorkflowTaskStatus.RETURNED,
        action: 'RETURN',
        decidedBy: 58,
        decidedByName: 'Head of Operations',
        decidedAt: new Date('2026-10-16T12:00:00Z'),
        createdAt: new Date('2026-10-15T09:00:00Z'),
        title: 'Review Rencana Operasional',
        taskKey: 'MANAGEMENT_REVIEW',
        workflowInstance: {
          entityType: 'PROJECT',
          entityId: 1,
          project: { id: 1, name: 'Project Fiber Surabaya', managerId: 4 },
        },
      };

      mockTaskRepo.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([returnedTask, completedTask]),
      });

      const history = await service.getHistory(4, ['PROJECT_MANAGER']);
      expect(history).toHaveLength(2);
      expect(history[0].taskId).toBe(702);
      expect(history[0].status).toBe('RETURNED');
      expect(history[1].taskId).toBe(701);
      expect(history[1].status).toBe('COMPLETED');
    });

    it('scopes history to authenticated role: PROJECT_MANAGER only sees assigned project tasks', async () => {
      const pmTask = {
        id: 703,
        status: WorkflowTaskStatus.COMPLETED,
        action: 'APPROVE',
        decidedBy: 4,
        workflowInstance: {
          entityType: 'PROJECT',
          entityId: 1,
          project: { id: 1, name: 'Project Fiber Surabaya', managerId: 4 },
        },
      };

      const otherPmTask = {
        id: 704,
        status: WorkflowTaskStatus.COMPLETED,
        action: 'APPROVE',
        decidedBy: 99,
        workflowInstance: {
          entityType: 'PROJECT',
          entityId: 2,
          project: { id: 2, name: 'Project Other', managerId: 99 },
        },
      };

      mockTaskRepo.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([pmTask, otherPmTask]),
      });

      const history = await service.getHistory(4, ['PROJECT_MANAGER']);
      expect(history.every((h) => h.projectId === 1 || h.decidedBy === 4)).toBe(true);
      expect(history.some((h) => h.taskId === 704)).toBe(false);
    });

    it('deterministic ordering: sorted newest completedAt / decidedAt first', async () => {
      const olderTask = {
        id: 705,
        status: WorkflowTaskStatus.COMPLETED,
        action: 'APPROVE',
        decidedBy: 3,
        decidedAt: new Date('2026-10-14T10:00:00Z'),
        createdAt: new Date('2026-10-14T08:00:00Z'),
        workflowInstance: { entityType: 'PROJECT', entityId: 1, project: { id: 1, name: 'P1' } },
      };

      const newerTask = {
        id: 706,
        status: WorkflowTaskStatus.COMPLETED,
        action: 'APPROVE',
        decidedBy: 3,
        decidedAt: new Date('2026-10-16T15:00:00Z'),
        createdAt: new Date('2026-10-16T12:00:00Z'),
        workflowInstance: { entityType: 'PROJECT', entityId: 1, project: { id: 1, name: 'P1' } },
      };

      mockTaskRepo.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([olderTask, newerTask]),
      });

      const history = await service.getHistory(3, ['DIRECTOR']);
      expect(history[0].taskId).toBe(706);
      expect(history[1].taskId).toBe(705);
    });
  });
});



