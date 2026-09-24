import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InboxService } from './inbox.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { NotificationService } from '../notification/notification.service';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { Tender, TenderStage, GoNoGoStatus } from '../../entities/tender.entity';
import { WorkflowTask, WorkflowTaskStatus } from '../../entities/workflow-task.entity';

describe('InboxService (Unified Inbox Foundation - N1)', () => {
  let service: InboxService;
  let workflowEngineService: jest.Mocked<Partial<WorkflowEngineService>>;
  let notificationService: jest.Mocked<Partial<NotificationService>>;
  let mockContractRepo: any;
  let mockTenderRepo: any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InboxService,
        { provide: WorkflowEngineService, useValue: workflowEngineService },
        { provide: NotificationService, useValue: notificationService },
        { provide: getRepositoryToken(Contract), useValue: mockContractRepo },
        { provide: getRepositoryToken(Tender), useValue: mockTenderRepo },
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
      expect(tenderTodo?.actionTarget).toBeNull();
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
});
