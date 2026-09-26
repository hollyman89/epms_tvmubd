import { ForbiddenException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  WorkflowDefinitionService,
  PROTECTED_CANONICAL_WORKFLOW_KEYS,
} from './workflow-definition.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowDefinition } from '../../entities/workflow-definition.entity';
import { WorkflowVersion } from '../../entities/workflow-version.entity';
import {
  WorkflowInstance,
  WorkflowInstanceStatus,
} from '../../entities/workflow-instance.entity';
import { WorkflowTask, WorkflowTaskStatus } from '../../entities/workflow-task.entity';
import { WorkflowTransition } from '../../entities/workflow-transition.entity';
import { Role } from '../../entities/role.entity';
import { OutboxEvent } from '../../entities/outbox-event.entity';

describe('WF-3A: TENDER_GO_NOGO_WORKFLOW Definition & Lifecycle Test Suite', () => {
  let definitionService: WorkflowDefinitionService;
  let engineService: WorkflowEngineService;

  // Mock repos and store
  let definitionsMap: Map<string, any>;
  let createdTasks: WorkflowTask[];

  let mockDefinitionRepo: any;
  let mockVersionRepo: any;
  let mockInstanceRepo: any;
  let mockTaskRepo: any;
  let mockTransitionRepo: any;
  let mockRoleRepo: any;
  let mockOutboxRepo: any;
  let mockDataSource: any;
  let mockEventEmitter: any;
  let mockEntityManager: any;

  beforeEach(async () => {
    definitionsMap = new Map();
    createdTasks = [];

    mockEntityManager = {
      save: jest.fn().mockImplementation(async (entityOrClass, entity) => {
        const target = entity || entityOrClass;
        if (target.workflowKey) {
          const existing = definitionsMap.get(target.workflowKey) || {};
          const merged = { ...existing, ...target };
          merged.versions = merged.versions || existing.versions || [];
          definitionsMap.set(target.workflowKey, merged);
          return merged;
        }
        if (target.workflowDefinitionId) {
          for (const [key, def] of definitionsMap.entries()) {
            if (def.id === target.workflowDefinitionId) {
              def.versions = def.versions || [];
              const idx = def.versions.findIndex(
                (v: any) => v.id === target.id || v.version === target.version,
              );
              if (idx >= 0) def.versions[idx] = target;
              else def.versions.push(target);
              definitionsMap.set(key, def);
            }
          }
          return target;
        }
        if (target instanceof WorkflowTask || target?.taskKey) {
          createdTasks.push(target);
        }
        return target;
      }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn().mockImplementation((cls, data) => ({
        ...data,
        id: data.id || Math.floor(Math.random() * 1000) + 1,
      })),
      findOne: jest.fn().mockImplementation(async (entityClass, options) => {
        if (entityClass === Role) {
          const roleName = options?.where?.name;
          if (roleName === 'DIRECTOR') return { id: 5, name: 'DIRECTOR' };
          if (roleName === 'MARKETING') return { id: 6, name: 'MARKETING' };
          if (roleName === 'SUPER_ADMIN') return { id: 1, name: 'SUPER_ADMIN' };
          if (roleName === 'GENERAL_MANAGER') return { id: 7, name: 'GENERAL_MANAGER' };
        }
        return null;
      }),
      createQueryBuilder: jest.fn(),
    };

    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => cb(mockEntityManager)),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    mockDefinitionRepo = {
      findOne: jest.fn().mockImplementation(async (opts) => {
        const key =
          opts?.where?.workflowKey ||
          (Array.isArray(opts?.where) ? opts.where[1]?.workflowKey : null);
        if (key && definitionsMap.has(key)) {
          return definitionsMap.get(key);
        }
        return null;
      }),
      find: jest.fn().mockImplementation(async () => Array.from(definitionsMap.values())),
      createQueryBuilder: jest.fn(),
    };

    mockVersionRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 101 })),
      save: jest.fn().mockImplementation(async (v) => {
        for (const [key, def] of definitionsMap.entries()) {
          if (def.id === v.workflowDefinitionId) {
            def.versions = def.versions || [];
            const idx = def.versions.findIndex(
              (item: any) => item.id === v.id || item.version === v.version,
            );
            if (idx >= 0) def.versions[idx] = v;
            else def.versions.push(v);
            definitionsMap.set(key, def);
          }
        }
        return v;
      }),
    };

    mockInstanceRepo = {
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(),
    };

    mockTaskRepo = {
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn(),
    };

    mockTransitionRepo = {
      count: jest.fn().mockResolvedValue(0),
    };

    mockRoleRepo = {
      findOne: jest.fn().mockImplementation((options) => {
        const roleName = options?.where?.name;
        if (roleName === 'DIRECTOR') return Promise.resolve({ id: 5, name: 'DIRECTOR' });
        if (roleName === 'MARKETING') return Promise.resolve({ id: 6, name: 'MARKETING' });
        if (roleName === 'SUPER_ADMIN') return Promise.resolve({ id: 1, name: 'SUPER_ADMIN' });
        if (roleName === 'GENERAL_MANAGER') return Promise.resolve({ id: 7, name: 'GENERAL_MANAGER' });
        return Promise.resolve(null);
      }),
    };

    mockOutboxRepo = {
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowDefinitionService,
        WorkflowEngineService,
        { provide: getRepositoryToken(WorkflowDefinition), useValue: mockDefinitionRepo },
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

    definitionService = module.get<WorkflowDefinitionService>(WorkflowDefinitionService);
    engineService = module.get<WorkflowEngineService>(WorkflowEngineService);

    (engineService as any).saveOutboxEvent = jest.fn().mockResolvedValue(undefined);
    (engineService as any).syncBusinessEntity = jest.fn().mockResolvedValue(undefined);
  });

  describe('1. Definition Creation, Metadata & Publication Safeguards', () => {
    it('should create, version, and publish TENDER_GO_NOGO_WORKFLOW when not existing', async () => {
      const result = await definitionService.ensureTenderGoNoGoWorkflow();

      expect(result).toBeDefined();
      expect(result?.workflowKey).toBe('TENDER_GO_NOGO_WORKFLOW');
      expect(result?.domain).toBe('MARKETING');
      expect(result?.status).toBe('PUBLISHED');
      expect(result?.activeVersion).toBe(1);

      // Verify versions array
      const def = definitionsMap.get('TENDER_GO_NOGO_WORKFLOW');
      expect(def).toBeDefined();
      expect(def.versions.length).toBe(1);
      expect(def.versions[0].version).toBe(1);
      expect(def.versions[0].status).toBe('PUBLISHED');
    });

    it('should be idempotent and return existing definition when already published', async () => {
      const published = await definitionService.ensureTenderGoNoGoWorkflow();
      expect(published).toBeDefined();

      const secondCall = await definitionService.ensureTenderGoNoGoWorkflow();
      expect(secondCall?.id).toBe(published?.id);
      expect(secondCall?.status).toBe('PUBLISHED');
      expect(secondCall?.activeVersion).toBe(1);
    });
  });

  describe('2. Graph Structure & Canonical TaskKeys Contract', () => {
    let capturedBpmn: any;

    beforeEach(async () => {
      await definitionService.ensureTenderGoNoGoWorkflow();
      const def = definitionsMap.get('TENDER_GO_NOGO_WORKFLOW');
      capturedBpmn = def.versions[0].bpmnJson;
    });

    it('should declare runtime entity contract as TENDER in bpmnJson', () => {
      expect(capturedBpmn).toBeDefined();
      expect(capturedBpmn.entityType).toBe('TENDER');
    });

    it('should have exact required nodes: START, GO_NOGO_APPROVAL, GO_NOGO_REVISION, END', () => {
      const nodes = capturedBpmn.nodes;
      expect(nodes.length).toBe(4);

      const startNode = nodes.find((n: any) => n.id === 'node_start');
      expect(startNode).toBeDefined();
      expect(startNode.data.type).toBe('START');

      const approvalNode = nodes.find((n: any) => n.id === 'node_go_nogo_approval');
      expect(approvalNode).toBeDefined();
      expect(approvalNode.data.type).toBe('TASK');
      expect(approvalNode.data.taskKey).toBe('GO_NOGO_APPROVAL');
      expect(approvalNode.data.role).toBe('DIRECTOR');
      expect(approvalNode.data.candidateRoles).toEqual(['DIRECTOR', 'GENERAL_MANAGER']);

      const revisionNode = nodes.find((n: any) => n.id === 'node_go_nogo_revision');
      expect(revisionNode).toBeDefined();
      expect(revisionNode.data.type).toBe('TASK');
      expect(revisionNode.data.taskKey).toBe('GO_NOGO_REVISION');
      expect(revisionNode.data.role).toBe('MARKETING');
      expect(revisionNode.data.assigneeContextKey).toBe('marketing_pic_id');
      expect(revisionNode.data.assigneeFallbackContextKey).toBe('created_by');

      const endNode = nodes.find((n: any) => n.id === 'node_end');
      expect(endNode).toBeDefined();
      expect(endNode.data.type).toBe('END');
    });

    it('should pass Workflow Engine graph validation without error', () => {
      const graph = (engineService as any).parseGraph(capturedBpmn);
      expect(() => (engineService as any).validateGraph(graph)).not.toThrow();
    });

    it('should contain all required edges matching the locked business graph', () => {
      const edges = capturedBpmn.edges;
      expect(edges.length).toBe(4);

      // START -> GO_NOGO_APPROVAL
      const startEdge = edges.find((e: any) => e.source === 'node_start');
      expect(startEdge).toBeDefined();
      expect(startEdge.target).toBe('node_go_nogo_approval');

      // GO_NOGO_APPROVAL --(APPROVE)--> END
      const approveEdge = edges.find(
        (e: any) => e.source === 'node_go_nogo_approval' && (e.label === 'APPROVE' || e.data?.action === 'APPROVE'),
      );
      expect(approveEdge).toBeDefined();
      expect(approveEdge.target).toBe('node_end');

      // GO_NOGO_APPROVAL --(RETURN)--> GO_NOGO_REVISION
      const returnEdge = edges.find(
        (e: any) => e.source === 'node_go_nogo_approval' && (e.label === 'RETURN' || e.data?.action === 'RETURN'),
      );
      expect(returnEdge).toBeDefined();
      expect(returnEdge.target).toBe('node_go_nogo_revision');

      // GO_NOGO_REVISION --(RESUBMIT)--> GO_NOGO_APPROVAL
      const resubmitEdge = edges.find(
        (e: any) => e.source === 'node_go_nogo_revision' && (e.label === 'RESUBMIT' || e.data?.action === 'RESUBMIT'),
      );
      expect(resubmitEdge).toBeDefined();
      expect(resubmitEdge.target).toBe('node_go_nogo_approval');
    });
  });

  describe('3. Dynamic Assignee Resolution Contract on Revision Node', () => {
    it('should resolve primary assignee from marketing_pic_id context', () => {
      const targetNode = {
        id: 'node_go_nogo_revision',
        type: 'customNode',
        data: {
          taskKey: 'GO_NOGO_REVISION',
          role: 'MARKETING',
          assigneeContextKey: 'marketing_pic_id',
          assigneeFallbackContextKey: 'created_by',
        },
      };

      const context = { marketing_pic_id: 42, created_by: 10 };
      const resolvedUserId = (engineService as any).resolveNodeAssigneeUserId(targetNode, context);
      expect(resolvedUserId).toBe(42);
    });

    it('should resolve numeric string marketing_pic_id context', () => {
      const targetNode = {
        id: 'node_go_nogo_revision',
        type: 'customNode',
        data: {
          taskKey: 'GO_NOGO_REVISION',
          role: 'MARKETING',
          assigneeContextKey: 'marketing_pic_id',
          assigneeFallbackContextKey: 'created_by',
        },
      };

      const context = { marketing_pic_id: '88' };
      const resolvedUserId = (engineService as any).resolveNodeAssigneeUserId(targetNode, context);
      expect(resolvedUserId).toBe(88);
    });

    it('should fall back to created_by when marketing_pic_id is not provided in context', () => {
      const targetNode = {
        id: 'node_go_nogo_revision',
        type: 'customNode',
        data: {
          taskKey: 'GO_NOGO_REVISION',
          role: 'MARKETING',
          assigneeContextKey: 'marketing_pic_id',
          assigneeFallbackContextKey: 'created_by',
        },
      };

      const context = { created_by: 15 };
      const resolvedUserId = (engineService as any).resolveNodeAssigneeUserId(targetNode, context);
      expect(resolvedUserId).toBe(15);
    });

    it('should leave assigneeUserId null when neither context key exists (falls back to role)', () => {
      const targetNode = {
        id: 'node_go_nogo_revision',
        type: 'customNode',
        data: {
          taskKey: 'GO_NOGO_REVISION',
          role: 'MARKETING',
          assigneeContextKey: 'marketing_pic_id',
          assigneeFallbackContextKey: 'created_by',
        },
      };

      const context = {};
      const resolvedUserId = (engineService as any).resolveNodeAssigneeUserId(targetNode, context);
      expect(resolvedUserId).toBeNull();
    });
  });

  describe('4. Full Transition Execution & Cyclic Return/Resubmit Loops', () => {
    let publishedDef: any;

    beforeEach(async () => {
      publishedDef = await definitionService.ensureTenderGoNoGoWorkflow();
    });

    it('Cycle 1: START -> APPROVAL (taskKey: GO_NOGO_APPROVAL, role: DIRECTOR)', async () => {
      const instance = await engineService.startInstance(
        {
          workflowKey: 'TENDER_GO_NOGO_WORKFLOW',
          entityType: 'TENDER',
          entityId: 101,
          context: {
            marketing_pic_id: 25,
            created_by: 10,
          },
        },
        10,
      );

      expect(instance).toBeDefined();
      expect(instance.currentNodeId).toBe('node_go_nogo_approval');

      const approvalTask = createdTasks.find((t) => t.nodeId === 'node_go_nogo_approval');
      expect(approvalTask).toBeDefined();
      expect(approvalTask?.taskKey).toBe('GO_NOGO_APPROVAL');
      expect(approvalTask?.assigneeRoleId).toBe(5); // DIRECTOR role ID
      expect(approvalTask?.assigneeUserId).toBeNull(); // Static role assignment
    });

    it('Cycle 2: APPROVAL --(RETURN)--> REVISION with dynamic assignee marketing_pic_id', async () => {
      const bpmnJson = publishedDef.versions[0].bpmnJson;
      const graph = (engineService as any).parseGraph(bpmnJson);
      const approvalNode = graph.nodes.find((n: any) => n.id === 'node_go_nogo_approval');

      const nextNode = (engineService as any).resolveNextNode(
        graph,
        approvalNode,
        'RETURN',
        { marketing_pic_id: 25 },
      );
      expect(nextNode.id).toBe('node_go_nogo_revision');
      expect(nextNode.data.taskKey).toBe('GO_NOGO_REVISION');

      const instance = {
        id: 1,
        entityType: 'TENDER',
        entityId: 101,
        context: { marketing_pic_id: 25, created_by: 10 },
      } as WorkflowInstance;

      await (engineService as any).progressToNode(
        mockEntityManager,
        instance,
        graph,
        null,
        nextNode,
        publishedDef.versions[0],
        'RETURN',
        5, // Director actor ID
      );

      const revTask = createdTasks.find((t) => t.nodeId === 'node_go_nogo_revision');
      expect(revTask).toBeDefined();
      expect(revTask?.taskKey).toBe('GO_NOGO_REVISION');
      expect(revTask?.assigneeRoleId).toBe(6); // MARKETING role ID
      expect(revTask?.assigneeUserId).toBe(25); // Dynamic assignee resolved from marketing_pic_id
    });

    it('Cycle 3: REVISION --(RESUBMIT)--> APPROVAL again', async () => {
      const bpmnJson = publishedDef.versions[0].bpmnJson;
      const graph = (engineService as any).parseGraph(bpmnJson);
      const revisionNode = graph.nodes.find((n: any) => n.id === 'node_go_nogo_revision');

      const nextNode = (engineService as any).resolveNextNode(
        graph,
        revisionNode,
        'RESUBMIT',
        { marketing_pic_id: 25 },
      );
      expect(nextNode.id).toBe('node_go_nogo_approval');
      expect(nextNode.data.taskKey).toBe('GO_NOGO_APPROVAL');

      const instance = {
        id: 1,
        entityType: 'TENDER',
        entityId: 101,
        context: { marketing_pic_id: 25, created_by: 10 },
      } as WorkflowInstance;

      await (engineService as any).progressToNode(
        mockEntityManager,
        instance,
        graph,
        null,
        nextNode,
        publishedDef.versions[0],
        'RESUBMIT',
        25, // Marketing PIC actor ID
      );

      const approvalTask = createdTasks.find((t) => t.nodeId === 'node_go_nogo_approval');
      expect(approvalTask).toBeDefined();
      expect(approvalTask?.taskKey).toBe('GO_NOGO_APPROVAL');
      expect(approvalTask?.assigneeRoleId).toBe(5); // DIRECTOR role ID
    });

    it('Cycle 4: Repeated RETURN and RESUBMIT cycle', async () => {
      const bpmnJson = publishedDef.versions[0].bpmnJson;
      const graph = (engineService as any).parseGraph(bpmnJson);
      const approvalNode = graph.nodes.find((n: any) => n.id === 'node_go_nogo_approval');
      const revisionNode = graph.nodes.find((n: any) => n.id === 'node_go_nogo_revision');

      // Second return
      const revNodeAgain = (engineService as any).resolveNextNode(graph, approvalNode, 'RETURN', {});
      expect(revNodeAgain.id).toBe('node_go_nogo_revision');

      // Second resubmit
      const appNodeAgain = (engineService as any).resolveNextNode(graph, revisionNode, 'RESUBMIT', {});
      expect(appNodeAgain.id).toBe('node_go_nogo_approval');
    });

    it('Cycle 5: APPROVAL --(APPROVE)--> END (Completion)', async () => {
      const bpmnJson = publishedDef.versions[0].bpmnJson;
      const graph = (engineService as any).parseGraph(bpmnJson);
      const approvalNode = graph.nodes.find((n: any) => n.id === 'node_go_nogo_approval');

      const nextNode = (engineService as any).resolveNextNode(
        graph,
        approvalNode,
        'APPROVE',
        {},
      );
      expect(nextNode.id).toBe('node_end');
      expect(nextNode.data.type).toBe('END');

      const instance = {
        id: 1,
        entityType: 'TENDER',
        entityId: 101,
        context: {},
        status: WorkflowInstanceStatus.IN_PROGRESS,
      } as WorkflowInstance;

      await (engineService as any).progressToNode(
        mockEntityManager,
        instance,
        graph,
        null,
        nextNode,
        publishedDef.versions[0],
        'APPROVE',
        5, // Director actor ID
      );

      expect(instance.status).toBe(WorkflowInstanceStatus.COMPLETED);
    });
  });

  describe('5. Canonical Workflows Protection Unaffected', () => {
    it('should keep PROTECTED_CANONICAL_WORKFLOW_KEYS strictly containing exactly 2 keys', () => {
      expect(PROTECTED_CANONICAL_WORKFLOW_KEYS.length).toBe(2);
      expect(PROTECTED_CANONICAL_WORKFLOW_KEYS).toContain('PROJECT_PLAN_REVIEW_WORKFLOW');
      expect(PROTECTED_CANONICAL_WORKFLOW_KEYS).toContain('PURCHASE_REQUEST_WORKFLOW');
      expect(PROTECTED_CANONICAL_WORKFLOW_KEYS).not.toContain('TENDER_GO_NOGO_WORKFLOW');
    });
  });

  describe('6. WF-3A.2 GO_NOGO_APPROVAL Multi-Role Candidate Authorization Matrix', () => {
    let publishedDef: WorkflowDefinition;
    let publishedVersion: WorkflowVersion;
    let singleInstance: WorkflowInstance;
    let approvalTask: WorkflowTask;

    const setupTasksForGetMyTasks = (tasks: WorkflowTask[]) => {
      mockTaskRepo.createQueryBuilder = jest.fn(() => {
        let isFiltered = false;
        let filterUserId: number | null = null;
        let filterRoles: string[] = [];

        const qb: any = {
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn((condition: string, params: any) => {
            isFiltered = true;
            filterUserId = params?.userId;
            filterRoles = params?.roles || [];
            return qb;
          }),
          orderBy: jest.fn().mockReturnThis(),
          getMany: jest.fn(async () => {
            if (!isFiltered) {
              return tasks.filter((t) => t.status === WorkflowTaskStatus.PENDING);
            }
            return tasks.filter((t) => {
              if (t.status !== WorkflowTaskStatus.PENDING) return false;
              if (filterRoles.includes('SUPER_ADMIN')) return true;
              if (t.assigneeUserId && t.assigneeUserId === filterUserId) return true;
              if (t.assigneeRole && filterRoles.includes(t.assigneeRole.name)) return true;
              if (!t.assigneeRoleId && !t.assigneeUserId) return true;
              return false;
            });
          }),
        };
        return qb;
      });
    };

    const setupTaskForCompleteTask = (task: WorkflowTask, version: WorkflowVersion) => {
      mockEntityManager.createQueryBuilder = jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(task),
      }));

      mockEntityManager.findOne = jest.fn(async (entityClass: any) => {
        if (entityClass === WorkflowVersion) {
          return version;
        }
        return null;
      });
    };

    beforeEach(async () => {
      publishedDef = (await definitionService.ensureTenderGoNoGoWorkflow())!;
      publishedVersion = publishedDef.versions[0];

      singleInstance = {
        id: 10,
        workflowDefinitionId: publishedDef.id,
        workflowVersionId: publishedVersion.id,
        workflowVersion: publishedVersion,
        workflowDefinition: publishedDef,
        entityType: 'TENDER',
        entityId: 101,
        currentNodeId: 'node_go_nogo_approval',
        status: WorkflowInstanceStatus.IN_PROGRESS,
        context: { tenderId: 101, marketing_pic_id: 20 },
      } as WorkflowInstance;

      approvalTask = {
        id: 201,
        workflowInstanceId: singleInstance.id,
        workflowInstance: singleInstance,
        nodeId: 'node_go_nogo_approval',
        taskKey: 'GO_NOGO_APPROVAL',
        assigneeRoleId: 5,
        assigneeRole: { id: 5, name: 'DIRECTOR' } as Role,
        assigneeUserId: null,
        status: WorkflowTaskStatus.PENDING,
      } as WorkflowTask;
    });

    it('DIRECTOR only: getMyTasks -> VISIBLE & completeTask -> ALLOWED', async () => {
      setupTasksForGetMyTasks([approvalTask]);
      const myTasks = await engineService.getMyTasks(501, ['DIRECTOR']);
      expect(myTasks).toHaveLength(1);
      expect(myTasks[0].id).toBe(201);
      expect(myTasks[0].taskKey).toBe('GO_NOGO_APPROVAL');

      setupTaskForCompleteTask(approvalTask, publishedVersion);
      const result = await engineService.completeTask(
        201,
        { action: 'APPROVE', reason: 'Approved by Director' },
        501,
        ['DIRECTOR'],
      );
      expect(result.task.status).toBe(WorkflowTaskStatus.COMPLETED);
      expect(result.task.decidedBy).toBe(501);
    });

    it('GENERAL_MANAGER only: getMyTasks -> VISIBLE & completeTask -> ALLOWED via candidateRoles', async () => {
      setupTasksForGetMyTasks([approvalTask]);
      const myTasks = await engineService.getMyTasks(502, ['GENERAL_MANAGER']);
      expect(myTasks).toHaveLength(1);
      expect(myTasks[0].id).toBe(201);
      expect(myTasks[0].taskKey).toBe('GO_NOGO_APPROVAL');

      setupTaskForCompleteTask(approvalTask, publishedVersion);
      const result = await engineService.completeTask(
        201,
        { action: 'APPROVE', reason: 'Approved by General Manager' },
        502,
        ['GENERAL_MANAGER'],
      );
      expect(result.task.status).toBe(WorkflowTaskStatus.COMPLETED);
      expect(result.task.decidedBy).toBe(502);
    });

    it('SUPER_ADMIN only: getMyTasks -> VISIBLE & completeTask -> ALLOWED via super admin bypass', async () => {
      setupTasksForGetMyTasks([approvalTask]);
      const myTasks = await engineService.getMyTasks(503, ['SUPER_ADMIN']);
      expect(myTasks).toHaveLength(1);
      expect(myTasks[0].id).toBe(201);

      setupTaskForCompleteTask(approvalTask, publishedVersion);
      const result = await engineService.completeTask(
        201,
        { action: 'APPROVE', reason: 'Bypass by Super Admin' },
        503,
        ['SUPER_ADMIN'],
      );
      expect(result.task.status).toBe(WorkflowTaskStatus.COMPLETED);
      expect(result.task.decidedBy).toBe(503);
    });

    it('MARKETING only: getMyTasks -> NOT VISIBLE & completeTask -> FORBIDDEN', async () => {
      setupTasksForGetMyTasks([approvalTask]);
      const myTasks = await engineService.getMyTasks(504, ['MARKETING']);
      expect(myTasks).toHaveLength(0);

      setupTaskForCompleteTask(approvalTask, publishedVersion);
      await expect(
        engineService.completeTask(
          201,
          { action: 'APPROVE', reason: 'Unauthorized marketing attempt' },
          504,
          ['MARKETING'],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('LEGAL only: getMyTasks -> NOT VISIBLE & completeTask -> FORBIDDEN', async () => {
      setupTasksForGetMyTasks([approvalTask]);
      const myTasks = await engineService.getMyTasks(505, ['LEGAL']);
      expect(myTasks).toHaveLength(0);

      setupTaskForCompleteTask(approvalTask, publishedVersion);
      await expect(
        engineService.completeTask(
          201,
          { action: 'APPROVE', reason: 'Unauthorized legal attempt' },
          505,
          ['LEGAL'],
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('7. WF-3A.2 Concurrency, Immutability & Single Task Row Enforcement', () => {
    let publishedDef: WorkflowDefinition;
    let publishedVersion: WorkflowVersion;
    let singleInstance: WorkflowInstance;
    let approvalTask: WorkflowTask;

    beforeEach(async () => {
      publishedDef = (await definitionService.ensureTenderGoNoGoWorkflow())!;
      publishedVersion = publishedDef.versions[0];

      singleInstance = {
        id: 10,
        workflowDefinitionId: publishedDef.id,
        workflowVersionId: publishedVersion.id,
        workflowVersion: publishedVersion,
        workflowDefinition: publishedDef,
        entityType: 'TENDER',
        entityId: 101,
        currentNodeId: 'node_go_nogo_approval',
        status: WorkflowInstanceStatus.IN_PROGRESS,
        context: { tenderId: 101, marketing_pic_id: 20 },
      } as WorkflowInstance;

      approvalTask = {
        id: 201,
        workflowInstanceId: singleInstance.id,
        workflowInstance: singleInstance,
        nodeId: 'node_go_nogo_approval',
        taskKey: 'GO_NOGO_APPROVAL',
        assigneeRoleId: 5,
        assigneeRole: { id: 5, name: 'DIRECTOR' } as Role,
        assigneeUserId: null,
        status: WorkflowTaskStatus.PENDING,
      } as WorkflowTask;

      mockEntityManager.createQueryBuilder = jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(approvalTask),
      }));

      mockEntityManager.findOne = jest.fn(async (entityClass: any) => {
        if (entityClass === WorkflowVersion) return publishedVersion;
        return null;
      });
    });

    it('proves exactly ONE WorkflowTask row exists and DIRECTOR & GENERAL_MANAGER see the SAME task ID', async () => {
      // Mock task repo to return the single pending task
      mockTaskRepo.createQueryBuilder = jest.fn(() => {
        let isFiltered = false;
        let filterRoles: string[] = [];
        const qb: any = {
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn((condition: string, params: any) => {
            isFiltered = true;
            filterRoles = params?.roles || [];
            return qb;
          }),
          orderBy: jest.fn().mockReturnThis(),
          getMany: jest.fn(async () => {
            if (!isFiltered) return [approvalTask];
            if (filterRoles.includes('DIRECTOR')) return [approvalTask];
            return [];
          }),
        };
        return qb;
      });

      const directorTasks = await engineService.getMyTasks(501, ['DIRECTOR']);
      const gmTasks = await engineService.getMyTasks(502, ['GENERAL_MANAGER']);

      expect(directorTasks).toHaveLength(1);
      expect(gmTasks).toHaveLength(1);
      expect(directorTasks[0].id).toBe(gmTasks[0].id);
      expect(directorTasks[0].id).toBe(201);
    });

    it('first valid completion makes task immutable; second actor cannot complete already completed task (ConflictException)', async () => {
      // 1. GENERAL_MANAGER completes task first
      const firstResult = await engineService.completeTask(
        201,
        { action: 'APPROVE', reason: 'GM first to approve' },
        502,
        ['GENERAL_MANAGER'],
      );
      expect(firstResult.task.status).toBe(WorkflowTaskStatus.COMPLETED);
      expect(approvalTask.status).toBe(WorkflowTaskStatus.COMPLETED);

      // 2. DIRECTOR attempts to complete the same task
      await expect(
        engineService.completeTask(
          201,
          { action: 'APPROVE', reason: 'Director trying to complete already completed task' },
          501,
          ['DIRECTOR'],
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('8. WF-3A.2 Backward Compatibility & Legacy Workflows', () => {
    it('proves task without candidateRoles allows assigned role and rejects unrelated roles', () => {
      const legacyDirectorTask = {
        id: 301,
        taskKey: 'DIRECTOR_APPROVAL',
        nodeId: 'node_director_approval',
        assigneeRoleId: 5,
        assigneeRole: { id: 5, name: 'DIRECTOR' } as Role,
        assigneeUserId: null,
      } as WorkflowTask;

      // DIRECTOR -> ALLOWED
      expect(() => {
        (engineService as any).validateActorAuthorization(legacyDirectorTask, 501, ['DIRECTOR']);
      }).not.toThrow();

      // GENERAL_MANAGER -> DENIED (no candidateRoles configured on this legacy node)
      expect(() => {
        (engineService as any).validateActorAuthorization(legacyDirectorTask, 502, ['GENERAL_MANAGER']);
      }).toThrow(ForbiddenException);

      // MARKETING -> DENIED
      expect(() => {
        (engineService as any).validateActorAuthorization(legacyDirectorTask, 504, ['MARKETING']);
      }).toThrow(ForbiddenException);

      // SUPER_ADMIN -> ALLOWED via bypass
      expect(() => {
        (engineService as any).validateActorAuthorization(legacyDirectorTask, 503, ['SUPER_ADMIN']);
      }).not.toThrow();
    });

    it('proves explicit assigneeUserId allows assigned user and rejects other users', () => {
      const explicitUserTask = {
        id: 302,
        taskKey: 'PIC_REVISION',
        nodeId: 'node_revision',
        assigneeRoleId: null,
        assigneeRole: null,
        assigneeUserId: 25,
      } as WorkflowTask;

      // Assigned user 25 -> ALLOWED
      expect(() => {
        (engineService as any).validateActorAuthorization(explicitUserTask, 25, ['MARKETING']);
      }).not.toThrow();

      // Other marketing user 99 -> DENIED
      expect(() => {
        (engineService as any).validateActorAuthorization(explicitUserTask, 99, ['MARKETING']);
      }).toThrow(ForbiddenException);

      // Other role user 501 -> DENIED
      expect(() => {
        (engineService as any).validateActorAuthorization(explicitUserTask, 501, ['DIRECTOR']);
      }).toThrow(ForbiddenException);

      // SUPER_ADMIN -> ALLOWED via bypass
      expect(() => {
        (engineService as any).validateActorAuthorization(explicitUserTask, 99, ['SUPER_ADMIN']);
      }).not.toThrow();
    });

    it('proves candidateRoles resolution uses EXACT workflow version snapshot from task instance', async () => {
      // Instance pinned to version 1 with candidateRoles: ['DIRECTOR', 'GENERAL_MANAGER']
      const version1: WorkflowVersion = {
        id: 1,
        version: 1,
        bpmnJson: {
          nodes: [
            {
              id: 'node_test',
              data: { candidateRoles: ['DIRECTOR', 'GENERAL_MANAGER'] },
            },
          ],
        },
      } as any;

      // Unrelated version 2 where candidateRoles is only ['DIRECTOR']
      const version2: WorkflowVersion = {
        id: 2,
        version: 2,
        bpmnJson: {
          nodes: [
            {
              id: 'node_test',
              data: { candidateRoles: ['DIRECTOR'] },
            },
          ],
        },
      } as any;

      const pinnedTask = {
        id: 401,
        nodeId: 'node_test',
        taskKey: 'TEST_TASK',
        assigneeRoleId: 5,
        assigneeRole: { id: 5, name: 'DIRECTOR' } as Role,
        workflowInstance: {
          id: 50,
          workflowVersionId: 1,
          workflowVersion: version1,
        },
      } as any;

      // Under version 1: GENERAL_MANAGER is authorized
      expect(() => {
        (engineService as any).validateActorAuthorization(pinnedTask, 502, ['GENERAL_MANAGER']);
      }).not.toThrow();

      // If task were linked to version 2: GENERAL_MANAGER would be denied
      pinnedTask.workflowInstance.workflowVersion = version2;
      pinnedTask.workflowInstance.workflowVersionId = 2;
      expect(() => {
        (engineService as any).validateActorAuthorization(pinnedTask, 502, ['GENERAL_MANAGER']);
      }).toThrow(ForbiddenException);
    });
  });
});
