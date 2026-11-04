import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkflowEngineService } from '../workflow-engine.service';
import { WorkflowDefinition } from '../../../entities/workflow-definition.entity';
import { WorkflowVersion } from '../../../entities/workflow-version.entity';
import { WorkflowInstance } from '../../../entities/workflow-instance.entity';
import { WorkflowTask, WorkflowTaskStatus } from '../../../entities/workflow-task.entity';
import { WorkflowTransition } from '../../../entities/workflow-transition.entity';
import { Role } from '../../../entities/role.entity';
import { OutboxEvent } from '../../../entities/outbox-event.entity';
import { InboxService } from '../../inbox/inbox.service';
import { NotificationService } from '../../notification/notification.service';
import { Tender } from '../../../entities/tender.entity';
import { Contract } from '../../../entities/contract.entity';
import { PaymentRequest } from '../../../entities/payment-request.entity';
import { ProjectProgressLog } from '../../../entities/project-progress-log.entity';
import { ServiceClaim } from '../../../entities/service-claim.entity';
import { ProjectClosure } from '../../../entities/project-closure.entity';
import { PurchaseRequest } from '../../../entities/purchase-request.entity';
import { Rfq } from '../../../entities/rfq.entity';

describe('Workflow Recipient Isolation & Actor Authorization (Tender 129/132 Regression)', () => {
  let service: WorkflowEngineService;
  let mockTaskRepo: any;
  let mockInstanceRepo: any;
  let mockVersionRepo: any;
  let mockDefRepo: any;
  let mockTransitionRepo: any;
  let mockRoleRepo: any;
  let mockOutboxRepo: any;
  let mockDataSource: any;
  let mockEventEmitter: any;

  beforeEach(async () => {
    mockTaskRepo = {
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    mockInstanceRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    mockVersionRepo = {
      findOne: jest.fn(),
    };
    mockDefRepo = {
      findOne: jest.fn(),
    };
    mockTransitionRepo = {
      find: jest.fn(),
      save: jest.fn(),
    };
    mockRoleRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    };
    mockOutboxRepo = {
      save: jest.fn(),
    };
    mockDataSource = {
      createQueryRunner: jest.fn(),
    };
    mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEngineService,
        { provide: getRepositoryToken(WorkflowDefinition), useValue: mockDefRepo },
        { provide: getRepositoryToken(WorkflowVersion), useValue: mockVersionRepo },
        { provide: getRepositoryToken(WorkflowInstance), useValue: mockInstanceRepo },
        { provide: getRepositoryToken(WorkflowTask), useValue: mockTaskRepo },
        { provide: getRepositoryToken(WorkflowTransition), useValue: mockTransitionRepo },
        { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
        { provide: getRepositoryToken(OutboxEvent), useValue: mockOutboxRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<WorkflowEngineService>(WorkflowEngineService);
  });

  describe('1. validateActorAuthorization (Targeted Actor Isolation)', () => {
    const serviceInternal = () => service as any;

    it('Scenario 1: Task specifically assigned to Ragil (user 9) -> Ragil is authorized', () => {
      const task = new WorkflowTask();
      task.id = 146;
      task.assigneeUserId = 9;
      task.assigneeRoleId = 7;
      task.assigneeRole = { id: 7, name: 'MARKETING' } as Role;

      expect(() => {
        serviceInternal().validateActorAuthorization(task, 9, ['MARKETING']);
      }).not.toThrow();
    });

    it('Scenario 2: Task specifically assigned to Ragil (user 9) -> Lukas (user 7, MARKETING) is strictly FORBIDDEN', () => {
      const task = new WorkflowTask();
      task.id = 146;
      task.assigneeUserId = 9;
      task.assigneeRoleId = 7;
      task.assigneeRole = { id: 7, name: 'MARKETING' } as Role;

      expect(() => {
        serviceInternal().validateActorAuthorization(task, 7, ['MARKETING']);
      }).toThrow(ForbiddenException);

      try {
        serviceInternal().validateActorAuthorization(task, 7, ['MARKETING']);
      } catch (err: any) {
        expect(err.message).toContain('Assigned exclusively to User #9');
      }
    });

    it('Scenario 3: Task specifically assigned to Ragil (user 9) -> User with multiple roles including MARKETING is strictly FORBIDDEN', () => {
      const task = new WorkflowTask();
      task.id = 148;
      task.assigneeUserId = 9;
      task.assigneeRoleId = 7;
      task.assigneeRole = { id: 7, name: 'MARKETING' } as Role;

      expect(() => {
        serviceInternal().validateActorAuthorization(task, 7, ['MARKETING', 'SALES', 'DIRECTOR']);
      }).toThrow(ForbiddenException);
    });

    it('Scenario 4: Role-queue task without specific user assignment (assigneeUserId is null) -> any user holding the role is authorized', () => {
      const task = new WorkflowTask();
      task.id = 200;
      task.assigneeUserId = null as any;
      task.assigneeRoleId = 7;
      task.assigneeRole = { id: 7, name: 'MARKETING' } as Role;

      // Both Ragil (9) and Lukas (7) can complete a general role-queue task
      expect(() => {
        serviceInternal().validateActorAuthorization(task, 9, ['MARKETING']);
      }).not.toThrow();

      expect(() => {
        serviceInternal().validateActorAuthorization(task, 7, ['MARKETING']);
      }).not.toThrow();
    });

    it('Scenario 5: Role-queue task without specific user assignment -> user with different role is FORBIDDEN', () => {
      const task = new WorkflowTask();
      task.id = 201;
      task.assigneeUserId = null as any;
      task.assigneeRoleId = 7;
      task.assigneeRole = { id: 7, name: 'MARKETING' } as Role;

      expect(() => {
        serviceInternal().validateActorAuthorization(task, 10, ['LEGAL']);
      }).toThrow(ForbiddenException);
    });

    it('Scenario 6: Candidate-roles task without specific user -> actor holding matching candidate role is authorized', () => {
      const task = new WorkflowTask();
      task.id = 202;
      task.assigneeUserId = null as any;
      task.assigneeRoleId = null as any;
      task.assigneeRole = null as any;

      expect(() => {
        serviceInternal().validateActorAuthorization(task, 7, ['MARKETING'], ['MARKETING', 'SALES']);
      }).not.toThrow();
    });

    it('Scenario 7: Candidate-roles task BUT specifically assigned to Ragil (user 9) -> Lukas (user 7) is FORBIDDEN even with candidate role', () => {
      const task = new WorkflowTask();
      task.id = 203;
      task.assigneeUserId = 9;
      task.assigneeRoleId = null as any;
      task.assigneeRole = null as any;

      expect(() => {
        serviceInternal().validateActorAuthorization(task, 7, ['MARKETING'], ['MARKETING', 'SALES']);
      }).toThrow(ForbiddenException);
    });

    it('Scenario 8: Completely unassigned task (no role, no user, no candidate roles) -> defaults to authorized', () => {
      const task = new WorkflowTask();
      task.id = 204;
      task.assigneeUserId = null as any;
      task.assigneeRoleId = null as any;
      task.assigneeRole = null as any;

      expect(() => {
        serviceInternal().validateActorAuthorization(task, 9, ['MARKETING'], []);
      }).not.toThrow();
    });
  });

  describe('2. getMyTasks (Query Predicate & Candidate Isolation)', () => {
    it('applies strict isolation predicate where role matching only applies when assignee_user_id IS NULL', async () => {
      const mockQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      const mockCandidateQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockTaskRepo.createQueryBuilder
        .mockReturnValueOnce(mockQueryBuilder)
        .mockReturnValueOnce(mockCandidateQueryBuilder);

      // Lukas (user 7) requests tasks
      await service.getMyTasks(7, ['MARKETING']);

      // Primary query MUST use guarded predicate
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(task.assignee_user_id = :userId OR (task.assignee_user_id IS NULL AND role.name IN (:...roles)) OR (task.assignee_role_id IS NULL AND task.assignee_user_id IS NULL))',
        { userId: 7, roles: ['MARKETING'] },
      );
    });

    it('does NOT leak candidate-role tasks to Lukas when the task is specifically assigned to Ragil (user 9)', async () => {
      const taskAssignedToRagil = new WorkflowTask();
      taskAssignedToRagil.id = 146;
      taskAssignedToRagil.assigneeUserId = 9;
      taskAssignedToRagil.nodeId = 'node_revision';
      taskAssignedToRagil.workflowInstance = {
        workflowVersion: {
          bpmnJson: {
            nodes: [
              {
                id: 'node_revision',
                data: { candidateRoles: ['MARKETING'] },
              },
            ],
          },
        },
      } as any;

      const taskUnassigned = new WorkflowTask();
      taskUnassigned.id = 150;
      taskUnassigned.assigneeUserId = null as any;
      taskUnassigned.nodeId = 'node_pool';
      taskUnassigned.workflowInstance = {
        workflowVersion: {
          bpmnJson: {
            nodes: [
              {
                id: 'node_pool',
                data: { candidateRoles: ['MARKETING'] },
              },
            ],
          },
        },
      } as any;

      const mockPrimaryQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]), // DB returns 0 primary tasks for Lukas
      };

      const mockCandidateQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([taskAssignedToRagil, taskUnassigned]),
      };

      mockTaskRepo.createQueryBuilder
        .mockReturnValueOnce(mockPrimaryQueryBuilder)
        .mockReturnValueOnce(mockCandidateQueryBuilder);

      // Lukas (user 7) requests tasks
      const result = await service.getMyTasks(7, ['MARKETING']);

      // taskAssignedToRagil MUST NOT be included
      expect(result.map((t) => t.id)).not.toContain(146);
      // taskUnassigned SHOULD be included
      expect(result.map((t) => t.id)).toContain(150);
      expect(result).toHaveLength(1);
    });
  });

  describe('3. InboxService (Defense-in-Depth Recipient Isolation)', () => {
    let inboxService: InboxService;
    let mockWorkflowEngine: any;
    let mockNotificationService: any;
    let mockTenderRepo: any;
    let mockContractRepo: any;

    beforeEach(async () => {
      mockWorkflowEngine = {
        getMyTasks: jest.fn(),
      };
      mockNotificationService = {
        getUnreadCount: jest.fn().mockResolvedValue(0),
      };
      mockTenderRepo = {
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
        }),
      };
      mockContractRepo = {
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
        }),
      };

      const module = await Test.createTestingModule({
        providers: [
          InboxService,
          { provide: WorkflowEngineService, useValue: mockWorkflowEngine },
          { provide: NotificationService, useValue: mockNotificationService },
          { provide: getRepositoryToken(Tender), useValue: mockTenderRepo },
          { provide: getRepositoryToken(Contract), useValue: mockContractRepo },
          { provide: getRepositoryToken(PaymentRequest), useValue: {} },
          { provide: getRepositoryToken(ProjectProgressLog), useValue: {} },
          { provide: getRepositoryToken(ServiceClaim), useValue: {} },
          { provide: getRepositoryToken(ProjectClosure), useValue: {} },
          { provide: getRepositoryToken(WorkflowTask), useValue: {} },
          { provide: getRepositoryToken(PurchaseRequest), useValue: {} },
          { provide: getRepositoryToken(Rfq), useValue: {} },
        ],
      }).compile();

      inboxService = module.get<InboxService>(InboxService);
    });

    it('filters out tasks assigned specifically to another user as defense-in-depth', async () => {
      const taskRagil = {
        id: 146,
        taskKey: 'GO_NOGO_REVISION',
        assigneeUserId: 9,
        workflowInstance: { entityType: 'TENDER', entityId: 129 },
      };
      const taskLukas = {
        id: 147,
        taskKey: 'GO_NOGO_REVISION',
        assigneeUserId: 7,
        workflowInstance: { entityType: 'TENDER', entityId: 130 },
      };
      const taskUnassigned = {
        id: 149,
        taskKey: 'GENERAL_TASK',
        assigneeUserId: null,
        workflowInstance: { entityType: 'TENDER', entityId: 131 },
      };

      mockWorkflowEngine.getMyTasks.mockResolvedValue([taskRagil, taskLukas, taskUnassigned]);

      const todos = await inboxService.getTodos(7, ['MARKETING']);

      // Lukas (user 7) sees taskLukas (entityId 130) and taskUnassigned (entityId 131), but NOT taskRagil (entityId 129)
      expect(todos.some((t) => t.actionTarget?.includes('tenderId=129'))).toBe(false);
      expect(todos.some((t) => t.actionTarget?.includes('tenderId=130'))).toBe(true);
      expect(todos.some((t) => t.taskId === 146 || t.todoId === 'wf-task-146')).toBe(false);
      expect(todos.some((t) => t.taskId === 147 || t.todoId === 'wf-task-147')).toBe(true);
      expect(todos.some((t) => t.taskId === 149 || t.todoId === 'wf-task-149')).toBe(true);
    });
  });

  describe('4. Management Review PM Isolation & WorkflowKey Guard (Post-Implementation Verification)', () => {
    it('resolveNodeAssigneeUserId on node_pm_revision_* never falls back to submittedBy when projectManagerId is absent', () => {
      const revisionNode = {
        id: 'node_pm_revision_hops',
        type: 'customNode',
        data: {
          role: 'PROJECT_MANAGER',
          type: 'TASK',
          assigneeContextKey: 'projectManagerId',
        },
      };

      const resolved = (service as any).resolveNodeAssigneeUserId(revisionNode, {
        projectId: 10,
        submittedBy: 999, // SUPER_ADMIN submitter, not PM
      });

      expect(resolved).toBeNull();
    });

    it('resolveProjectManagerId returns null when DB project has manager_id = null even if submittedBy or context has a user', async () => {
      const mockManager: any = {
        query: jest.fn().mockResolvedValue([{ manager_id: null }]),
      };
      const instance: any = {
        entityType: 'PROJECT',
        entityId: 10,
        context: {
          projectId: 10,
          submittedBy: 999,
          projectManagerId: 999,
        },
      };

      const resolved = await (service as any).resolveProjectManagerId(mockManager, instance);
      expect(resolved).toBeNull();
    });

    it('progressToNode on END with action APPROVE for another PROJECT workflow keeps notificationPolicy = SYNC_ONLY', async () => {
      const savedOutboxEvents: any[] = [];
      const mockManager: any = {
        save: jest.fn().mockImplementation(async (entityOrTarget: any, maybeEntity?: any) => {
          const obj = maybeEntity || entityOrTarget;
          if (obj && obj.event_name) {
            savedOutboxEvents.push(obj);
          }
          return obj;
        }),
        create: jest.fn().mockImplementation((_cls: any, data: any) => data),
        findOne: jest.fn().mockResolvedValue(null),
        query: jest.fn().mockResolvedValue([{ manager_id: 401 }]),
      };

      const instance: any = {
        id: 500,
        workflowDefinitionId: 99,
        entityType: 'PROJECT',
        entityId: 901,
        status: 'IN_PROGRESS',
        context: {
          workflowKey: 'OTHER_PROJECT_WORKFLOW',
          projectId: 901,
          projectManagerId: 401,
        },
      };

      const graph: any = { nodes: [], edges: [] };
      const fromNode: any = { id: 'node_director_approval', type: 'TASK' };
      const targetNode: any = { id: 'node_end', type: 'END', data: { type: 'END' } };
      const version: any = { id: 1 };

      await (service as any).progressToNode(
        mockManager,
        instance,
        graph,
        fromNode,
        targetNode,
        version,
        'APPROVE',
        504,
      );

      const completedOutbox = savedOutboxEvents.find(
        (e) => e.event_name === 'workflow.instance.completed',
      );
      expect(completedOutbox).toBeDefined();
      expect(completedOutbox.payload.notificationPolicy).toBe('SYNC_ONLY');
      expect(completedOutbox.payload.routing).toBeUndefined();
    });
  });
});
