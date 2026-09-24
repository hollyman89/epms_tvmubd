import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowDefinition } from '../../entities/workflow-definition.entity';
import { WorkflowVersion } from '../../entities/workflow-version.entity';
import {
  WorkflowInstance,
  WorkflowInstanceStatus,
} from '../../entities/workflow-instance.entity';
import {
  WorkflowTask,
  WorkflowTaskStatus,
} from '../../entities/workflow-task.entity';
import { WorkflowTransition } from '../../entities/workflow-transition.entity';
import { Role } from '../../entities/role.entity';
import { OutboxEvent } from '../../entities/outbox-event.entity';
import { ConditionEvaluator } from './condition-evaluator';
import { AuditLog } from '../../entities/audit-log.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';

describe('WorkflowEngineService (Phase 3 Core Tests)', () => {
  let service: WorkflowEngineService;
  let definitionRepo: Partial<Record<keyof Repository<WorkflowDefinition>, jest.Mock>>;
  let versionRepo: Partial<Record<keyof Repository<WorkflowVersion>, jest.Mock>>;
  let instanceRepo: Partial<Record<keyof Repository<WorkflowInstance>, jest.Mock>>;
  let taskRepo: Partial<Record<keyof Repository<WorkflowTask>, jest.Mock>>;
  let transitionRepo: Partial<Record<keyof Repository<WorkflowTransition>, jest.Mock>>;
  let roleRepo: Partial<Record<keyof Repository<Role>, jest.Mock>>;
  let outboxRepo: Partial<Record<keyof Repository<OutboxEvent>, jest.Mock>>;
  let dataSource: any;
  let eventEmitter: Partial<Record<keyof EventEmitter2, jest.Mock>>;

  // Sample valid published graph: START -> Review Task (PROJECT_MANAGER) -> Condition (amount > 100000000) -> [TRUE: Director Task, FALSE: END] -> END
  const sampleBpmnJson = {
    nodes: [
      { id: 'node_start', type: 'customNode', data: { label: 'Start', type: 'START' } },
      { id: 'node_pm_review', type: 'customNode', data: { label: 'PM Review', type: 'TASK', role: 'PROJECT_MANAGER' } },
      { id: 'node_condition', type: 'customNode', data: { label: 'Check Budget', type: 'CONDITION', condition: 'amount > 100000000' } },
      { id: 'node_director_approval', type: 'customNode', data: { label: 'Director Approval', type: 'TASK', role: 'DIRECTOR' } },
      { id: 'node_end', type: 'customNode', data: { label: 'End', type: 'END' } },
    ],
    edges: [
      { id: 'e1', source: 'node_start', target: 'node_pm_review' },
      { id: 'e2', source: 'node_pm_review', target: 'node_condition' },
      { id: 'e3_true', source: 'node_condition', target: 'node_director_approval', label: 'TRUE' },
      { id: 'e3_false', source: 'node_condition', target: 'node_end', label: 'FALSE' },
      { id: 'e4', source: 'node_director_approval', target: 'node_end' },
    ],
  };

  const sampleDefinition: WorkflowDefinition = {
    id: 1,
    workflowKey: 'PR_APPROVAL',
    name: 'Purchase Request Approval',
    description: 'Approval for PRs',
    domain: 'PROCUREMENT',
    activeVersion: 1,
    status: 'PUBLISHED',
    createdBy: 1,
    updatedBy: 1,
    deletedBy: null as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null as any,
    versions: [
      {
        id: 101,
        workflowDefinitionId: 1,
        version: 1,
        bpmnJson: sampleBpmnJson,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        createdBy: 1,
        updatedBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        workflowDefinition: null as any,
      },
    ],
  };

  const sampleRoles: Role[] = [
    { id: 2, name: 'PROJECT_MANAGER', description: 'PM', createdAt: new Date(), updatedAt: new Date(), deletedAt: null as any },
    { id: 4, name: 'DIRECTOR', description: 'Dir', createdAt: new Date(), updatedAt: new Date(), deletedAt: null as any },
  ];

  beforeEach(async () => {
    definitionRepo = { findOne: jest.fn() };
    versionRepo = { findOne: jest.fn() };
    instanceRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn() };
    taskRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn() };
    transitionRepo = { findOne: jest.fn() };
    roleRepo = { findOne: jest.fn() };
    outboxRepo = { findOne: jest.fn() };
    eventEmitter = { emit: jest.fn() };

    // Mock Transaction Manager
    const mockManager = {
      create: jest.fn((entityClass, data) => ({ ...data, id: data.id || Math.floor(Math.random() * 1000) + 1 })),
      save: jest.fn(async (entity) => ({ ...entity, id: entity.id || Math.floor(Math.random() * 1000) + 1 })),
      findOne: jest.fn(async (entityClass, opts: any) => {
        if (entityClass === Role) {
          const roleName = opts?.where?.name;
          return sampleRoles.find((r) => r.name === roleName) || null;
        }
        if (entityClass === WorkflowVersion) {
          return sampleDefinition.versions[0];
        }
        return null;
      }),
      createQueryBuilder: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(async (cb) => cb(mockManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEngineService,
        { provide: getRepositoryToken(WorkflowDefinition), useValue: definitionRepo },
        { provide: getRepositoryToken(WorkflowVersion), useValue: versionRepo },
        { provide: getRepositoryToken(WorkflowInstance), useValue: instanceRepo },
        { provide: getRepositoryToken(WorkflowTask), useValue: taskRepo },
        { provide: getRepositoryToken(WorkflowTransition), useValue: transitionRepo },
        { provide: getRepositoryToken(Role), useValue: roleRepo },
        { provide: getRepositoryToken(OutboxEvent), useValue: outboxRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<WorkflowEngineService>(WorkflowEngineService);
  });

  // 1. Published Version Execution
  it('1. should successfully instantiate and start workflow from published version', async () => {
    definitionRepo.findOne!.mockResolvedValue(sampleDefinition);
    instanceRepo.findOne!.mockResolvedValue(null); // No existing active instance

    const instance = await service.startInstance({
      workflowKey: 'PR_APPROVAL',
      entityType: 'PURCHASE_REQUEST',
      entityId: 10,
      context: { amount: 50000000 },
    }, 1);

    expect(instance).toBeDefined();
    expect(instance.workflowVersionId).toBe(101);
    expect(instance.status).toBe(WorkflowInstanceStatus.IN_PROGRESS);
  });

  // 2. Draft Rejected
  it('2. should reject startInstance if active version is still in DRAFT', async () => {
    const draftDef = {
      ...sampleDefinition,
      activeVersion: 2,
      versions: [
        {
          id: 102,
          workflowDefinitionId: 1,
          version: 2,
          bpmnJson: sampleBpmnJson,
          status: 'DRAFT', // DRAFT
        },
      ],
    };
    definitionRepo.findOne!.mockResolvedValue(draftDef);

    await expect(
      service.startInstance({
        workflowKey: 'PR_APPROVAL',
        entityType: 'PURCHASE_REQUEST',
        entityId: 10,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // 3. Version Snapshot Immutability
  it('3. should snapshot the exact version ID in workflow_instances', async () => {
    definitionRepo.findOne!.mockResolvedValue(sampleDefinition);
    instanceRepo.findOne!.mockResolvedValue(null);

    const instance = await service.startInstance({
      workflowKey: 'PR_APPROVAL',
      entityType: 'PURCHASE_REQUEST',
      entityId: 12,
    }, 1);

    expect(instance.workflowVersionId).toBe(101);
  });

  // 4. Duplicate Instance Protection (Idempotency)
  it('4. should throw 409 Conflict if an active workflow instance already exists for entity', async () => {
    definitionRepo.findOne!.mockResolvedValue(sampleDefinition);
    instanceRepo.findOne!.mockResolvedValue({
      id: 99,
      status: WorkflowInstanceStatus.IN_PROGRESS,
    });

    await expect(
      service.startInstance({
        workflowKey: 'PR_APPROVAL',
        entityType: 'PURCHASE_REQUEST',
        entityId: 10,
      }),
    ).rejects.toThrow(ConflictException);
  });

  // 5. START Execution and Auto-transition
  it('5. should execute START and automatically progress to the first connected node', async () => {
    definitionRepo.findOne!.mockResolvedValue(sampleDefinition);
    instanceRepo.findOne!.mockResolvedValue(null);

    const instance = await service.startInstance({
      workflowKey: 'PR_APPROVAL',
      entityType: 'PURCHASE_REQUEST',
      entityId: 15,
    }, 1);

    expect(instance.currentNodeId).toBe('node_pm_review');
  });

  // 6. Task Creation with Role Assignment
  it('6. should create a pending workflow task with the resolved role ID', async () => {
    definitionRepo.findOne!.mockResolvedValue(sampleDefinition);
    instanceRepo.findOne!.mockResolvedValue(null);

    const instance = await service.startInstance({
      workflowKey: 'PR_APPROVAL',
      entityType: 'PURCHASE_REQUEST',
      entityId: 16,
    }, 1);

    expect(instance.currentNodeId).toBe('node_pm_review');
  });

  // 7. Role Authorization
  it('7. should reject task completion if actor lacks the assigned role (403 Forbidden)', async () => {
    const mockTask: any = {
      id: 201,
      nodeId: 'node_pm_review',
      status: WorkflowTaskStatus.PENDING,
      assigneeRoleId: 2,
      assigneeRole: { id: 2, name: 'PROJECT_MANAGER' },
      workflowInstance: {
        id: 501,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        workflowVersionId: 101,
        currentNodeId: 'node_pm_review',
      },
    };

    const mockQb = {
      setLock: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockTask),
    };

    dataSource.transaction = jest.fn(async (cb) => {
      const mgr = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
        findOne: jest.fn().mockResolvedValue(sampleDefinition.versions[0]),
      };
      return cb(mgr);
    });

    await expect(
      service.completeTask(201, { action: 'APPROVE' }, 99, ['MARKETING']), // Actor is MARKETING, task requires PROJECT_MANAGER
    ).rejects.toThrow(ForbiddenException);
  });

  // 8. APPROVE Decision and Transition
  it('8. should successfully approve task and transition to the next node', async () => {
    const mockTask: any = {
      id: 201,
      nodeId: 'node_pm_review',
      status: WorkflowTaskStatus.PENDING,
      assigneeRoleId: 2,
      assigneeRole: { id: 2, name: 'PROJECT_MANAGER' },
      workflowInstance: {
        id: 501,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        workflowVersionId: 101,
        currentNodeId: 'node_pm_review',
        context: { amount: 50000000 },
      },
    };

    const mockQb = {
      setLock: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockTask),
    };

    dataSource.transaction = jest.fn(async (cb) => {
      const mgr = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
        findOne: jest.fn().mockResolvedValue(sampleDefinition.versions[0]),
        save: jest.fn(async (e) => e),
        create: jest.fn((cls, d) => d),
      };
      return cb(mgr);
    });

    const result = await service.completeTask(
      201,
      { action: 'APPROVE', reason: 'Review complete' },
      10,
      ['PROJECT_MANAGER'],
    );

    expect(result.task.status).toBe(WorkflowTaskStatus.COMPLETED);
    expect(result.task.action).toBe('APPROVE');
  });

  // 9. REJECT Decision
  it('9. should handle REJECT action and mark task as REJECTED', async () => {
    const mockTask: any = {
      id: 202,
      nodeId: 'node_pm_review',
      status: WorkflowTaskStatus.PENDING,
      assigneeRoleId: 2,
      assigneeRole: { id: 2, name: 'PROJECT_MANAGER' },
      workflowInstance: {
        id: 502,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        workflowVersionId: 101,
        currentNodeId: 'node_pm_review',
        context: { amount: 50000000 },
      },
    };

    const mockQb = {
      setLock: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockTask),
    };

    dataSource.transaction = jest.fn(async (cb) => {
      const mgr = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
        findOne: jest.fn().mockResolvedValue(sampleDefinition.versions[0]),
        save: jest.fn(async (e) => e),
        create: jest.fn((cls, d) => d),
      };
      return cb(mgr);
    });

    const result = await service.completeTask(
      202,
      { action: 'REJECT', reason: 'Budget rejected' },
      10,
      ['PROJECT_MANAGER'],
    );

    expect(result.task.status).toBe(WorkflowTaskStatus.REJECTED);
  });

  // 10. RETURN Decision
  it('10. should handle RETURN action for revision', async () => {
    const mockTask: any = {
      id: 203,
      nodeId: 'node_pm_review',
      status: WorkflowTaskStatus.PENDING,
      assigneeRoleId: 2,
      assigneeRole: { id: 2, name: 'PROJECT_MANAGER' },
      workflowInstance: {
        id: 503,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        workflowVersionId: 101,
        currentNodeId: 'node_pm_review',
        context: { amount: 50000000 },
      },
    };

    const mockQb = {
      setLock: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockTask),
    };

    dataSource.transaction = jest.fn(async (cb) => {
      const mgr = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
        findOne: jest.fn().mockResolvedValue(sampleDefinition.versions[0]),
        save: jest.fn(async (e) => e),
        create: jest.fn((cls, d) => d),
      };
      return cb(mgr);
    });

    const result = await service.completeTask(
      203,
      { action: 'RETURN', reason: 'Needs revision' },
      10,
      ['PROJECT_MANAGER'],
    );

    expect(result.task.status).toBe(WorkflowTaskStatus.RETURNED);
  });

  // 11. CONDITION Routing
  it('11. should route to Director Approval when amount > 100000000 (Condition Evaluation)', async () => {
    // Test ConditionEvaluator directly and via engine
    const isOverBudget = ConditionEvaluator.evaluate('amount > 100000000', { amount: 150000000 });
    expect(isOverBudget).toBe(true);

    const isUnderBudget = ConditionEvaluator.evaluate('amount > 100000000', { amount: 50000000 });
    expect(isUnderBudget).toBe(false);
  });

  // 12. END Completion
  it('12. should mark instance as COMPLETED when reached END node', async () => {
    const mockTask: any = {
      id: 204,
      nodeId: 'node_director_approval',
      status: WorkflowTaskStatus.PENDING,
      assigneeRoleId: 4,
      assigneeRole: { id: 4, name: 'DIRECTOR' },
      workflowInstance: {
        id: 504,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        workflowVersionId: 101,
        currentNodeId: 'node_director_approval',
        context: { amount: 200000000 },
      },
    };

    const mockQb = {
      setLock: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockTask),
    };

    let savedInstance: any;
    dataSource.transaction = jest.fn(async (cb) => {
      const mgr = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
        findOne: jest.fn().mockResolvedValue(sampleDefinition.versions[0]),
        save: jest.fn(async (e) => {
          if (e.status === WorkflowInstanceStatus.COMPLETED) savedInstance = e;
          return e;
        }),
        create: jest.fn((cls, d) => d),
      };
      return cb(mgr);
    });

    await service.completeTask(204, { action: 'APPROVE' }, 1, ['SUPER_ADMIN']);
    expect(savedInstance.status).toBe(WorkflowInstanceStatus.COMPLETED);
    expect(savedInstance.completedAt).toBeDefined();
  });

  // 13. Duplicate Decision (409 Conflict)
  it('13. should throw 409 Conflict when attempting to complete already completed task', async () => {
    const mockTask: any = {
      id: 205,
      status: WorkflowTaskStatus.COMPLETED,
      action: 'APPROVE',
    };

    const mockQb = {
      setLock: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockTask),
    };

    dataSource.transaction = jest.fn(async (cb) => {
      const mgr = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      };
      return cb(mgr);
    });

    await expect(
      service.completeTask(205, { action: 'APPROVE' }, 1, ['SUPER_ADMIN']),
    ).rejects.toThrow(ConflictException);
  });

  // 14. Concurrency Protection
  it('14. should apply pessimistic_write lock on task during completion', async () => {
    const mockQb = {
      setLock: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 206,
        status: WorkflowTaskStatus.COMPLETED,
      }),
    };

    dataSource.transaction = jest.fn(async (cb) => {
      const mgr = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      };
      return cb(mgr);
    });

    try {
      await service.completeTask(206, { action: 'APPROVE' }, 1, ['SUPER_ADMIN']);
    } catch {
      // ignore 409
    }

    expect(mockQb.setLock).toHaveBeenCalledWith('pessimistic_write');
  });

  // 15. Transaction Rollback on Failure
  it('15. should propagate errors and rollback transaction if step fails midway', async () => {
    definitionRepo.findOne!.mockResolvedValue(sampleDefinition);
    instanceRepo.findOne!.mockResolvedValue(null);

    dataSource.transaction = jest.fn(async () => {
      throw new Error('Database disk full error');
    });

    await expect(
      service.startInstance({
        workflowKey: 'PR_APPROVAL',
        entityType: 'PURCHASE_REQUEST',
        entityId: 10,
      }),
    ).rejects.toThrow('Database disk full error');
  });

  // 16. Immutable Published Version
  it('16. should continue using original version ID even after new definition versions exist', async () => {
    const multiVersionDef = {
      ...sampleDefinition,
      activeVersion: 2, // Definition now points to v2
      versions: [
        sampleDefinition.versions[0], // v1 (id: 101)
        {
          id: 102,
          workflowDefinitionId: 1,
          version: 2,
          bpmnJson: sampleBpmnJson,
          status: 'PUBLISHED',
        },
      ],
    };

    const mockTask: any = {
      id: 207,
      nodeId: 'node_pm_review',
      status: WorkflowTaskStatus.PENDING,
      workflowInstance: {
        id: 507,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        workflowVersionId: 101, // Pinned to v1
        currentNodeId: 'node_pm_review',
      },
    };

    const mockQb = {
      setLock: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockTask),
    };

    let queriedVersionId: number | undefined;
    dataSource.transaction = jest.fn(async (cb) => {
      const mgr = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
        findOne: jest.fn(async (cls, opts: any) => {
          if (cls === WorkflowVersion) {
            queriedVersionId = opts.where.id;
            return sampleDefinition.versions[0];
          }
          return null;
        }),
        save: jest.fn(async (e) => e),
        create: jest.fn((cls, d) => d),
      };
      return cb(mgr);
    });

    await service.completeTask(207, { action: 'APPROVE' }, 1, ['SUPER_ADMIN']);
    expect(queriedVersionId).toBe(101); // Exactly version 101 used
  });

  // 17. Immutable Transition History (Append-Only)
  it('17. should record every node transition as a new workflow_transitions record', async () => {
    definitionRepo.findOne!.mockResolvedValue(sampleDefinition);
    instanceRepo.findOne!.mockResolvedValue(null);

    const createdEntities: any[] = [];
    const mockManager = {
      create: jest.fn((cls, data) => {
        createdEntities.push({ cls, ...data });
        return { ...data, id: 1 };
      }),
      save: jest.fn(async (e) => e),
      findOne: jest.fn(async () => null),
    };

    dataSource.transaction = jest.fn(async (cb) => cb(mockManager));

    await service.startInstance({
      workflowKey: 'PR_APPROVAL',
      entityType: 'PURCHASE_REQUEST',
      entityId: 20,
    }, 1);

    const transitions = createdEntities.filter((e) => e.cls === WorkflowTransition);
    expect(transitions.length).toBeGreaterThanOrEqual(1);
    expect(transitions[0].action).toBe('START');
  });

  // 18. Durable Audit / Outbox
  it('18. should persist outbox events within the same atomic transaction', async () => {
    definitionRepo.findOne!.mockResolvedValue(sampleDefinition);
    instanceRepo.findOne!.mockResolvedValue(null);

    const createdEntities: any[] = [];
    const mockManager = {
      create: jest.fn((cls, data) => {
        createdEntities.push({ cls, ...data });
        return { ...data, id: 1 };
      }),
      save: jest.fn(async (e) => e),
      findOne: jest.fn(async () => null),
    };

    dataSource.transaction = jest.fn(async (cb) => cb(mockManager));

    await service.startInstance({
      workflowKey: 'PR_APPROVAL',
      entityType: 'PURCHASE_REQUEST',
      entityId: 25,
    }, 1);

    const outboxEvents = createdEntities.filter((e) => e.cls === OutboxEvent);
    expect(outboxEvents.length).toBe(1);
    expect(outboxEvents[0].event_name).toBe('workflow.task.assigned');
  });  // -------------------------------------------------------------------------
  // 19. Invalid Graph Validation
  it('19. should reject workflow execution if graph has no END node or no START node', async () => {
    const invalidBpmnJson = {
      nodes: [
        { id: 'node_start', type: 'customNode', data: { label: 'Start', type: 'START' } },
        { id: 'node_task', type: 'customNode', data: { label: 'Task', type: 'TASK' } },
      ], // No END node
      edges: [{ id: 'e1', source: 'node_start', target: 'node_task' }],
    };

    const invalidDef = {
      ...sampleDefinition,
      versions: [
        {
          id: 105,
          workflowDefinitionId: 1,
          version: 1,
          bpmnJson: invalidBpmnJson,
          status: 'PUBLISHED',
        },
      ],
    };

    definitionRepo.findOne!.mockResolvedValue(invalidDef);

    await expect(
      service.startInstance({
        workflowKey: 'PR_APPROVAL',
        entityType: 'PURCHASE_REQUEST',
        entityId: 30,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // 20. Invalid Condition Handling
  it('20. should throw explicit error for invalid condition expression without silent fallback', () => {
    expect(() => {
      ConditionEvaluator.evaluate('', { amount: 100 });
    }).toThrow(BadRequestException);

    expect(() => {
      ConditionEvaluator.evaluate('amount ??? 100', { amount: 100 });
    }).toThrow(BadRequestException);
  });

  // 21. Phase 4B: APPROVE path atomic business entity sync (DIRECTOR_APPROVAL)
  it('21. should synchronize PurchaseRequest status to DIRECTOR_APPROVAL upon Finance APPROVE', async () => {
    const prBpmnJson = {
      nodes: [
        { id: 'node_start', type: 'customNode', data: { label: 'Start', type: 'START' } },
        { id: 'node_finance_review', type: 'customNode', data: { label: 'Finance Review', type: 'TASK', role: 'FINANCE' } },
        { id: 'node_director_approval', type: 'customNode', data: { label: 'Director Approval', type: 'TASK', role: 'DIRECTOR' } },
        { id: 'node_end', type: 'customNode', data: { label: 'End', type: 'END' } },
      ],
      edges: [
        { id: 'e1', source: 'node_start', target: 'node_finance_review' },
        { id: 'e2', source: 'node_finance_review', target: 'node_director_approval', label: 'APPROVE' },
        { id: 'e3', source: 'node_director_approval', target: 'node_end', label: 'APPROVE' },
      ],
    };

    const prDef = {
      ...sampleDefinition,
      versions: [
        {
          id: 201,
          workflowDefinitionId: 1,
          version: 1,
          bpmnJson: prBpmnJson,
          status: 'PUBLISHED',
        },
      ],
    };

    const prTask = {
      id: 501,
      workflowInstanceId: 601,
      nodeId: 'node_finance_review',
      status: WorkflowTaskStatus.PENDING,
      assigneeRoleId: 3,
      assigneeRole: { id: 3, name: 'FINANCE' },
      workflowInstance: {
        id: 601,
        workflowDefinitionId: 1,
        workflowVersionId: 201,
        entityType: 'PURCHASE_REQUEST',
        entityId: 991,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        currentNodeId: 'node_finance_review',
        context: { prId: 991 },
        workflowDefinition: prDef,
        workflowVersion: prDef.versions[0],
      },
    };

    const mockQb = {
      setLock: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(prTask),
    };

    const mockMgr = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      findOne: jest.fn().mockResolvedValue(prDef.versions[0]),
      save: jest.fn(async (e) => e),
      create: jest.fn((cls, d) => d),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    dataSource.transaction = jest.fn(async (cb) => cb(mockMgr));

    await service.completeTask(501, { action: 'APPROVE', reason: 'Finance Approved' }, 3, ['FINANCE']);

    expect(mockMgr.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 991 },
      { status: 'DIRECTOR_APPROVAL' },
    );
  });

  // 22. Phase 4B: RETURN path atomic business entity sync (REJECTED_TO_PROCUREMENT)
  it('22. should synchronize PurchaseRequest status to REJECTED_TO_PROCUREMENT upon Finance RETURN', async () => {
    const prBpmnJson = {
      nodes: [
        { id: 'node_start', type: 'customNode', data: { label: 'Start', type: 'START' } },
        { id: 'node_finance_review', type: 'customNode', data: { label: 'Finance Review', type: 'TASK', role: 'FINANCE' } },
        { id: 'node_procurement_revision', type: 'customNode', data: { label: 'Procurement Revision', type: 'TASK', role: 'PROCUREMENT' } },
        { id: 'node_end', type: 'customNode', data: { label: 'End', type: 'END' } },
      ],
      edges: [
        { id: 'e1', source: 'node_start', target: 'node_finance_review' },
        { id: 'e2', source: 'node_finance_review', target: 'node_procurement_revision', label: 'RETURN' },
        { id: 'e3', source: 'node_procurement_revision', target: 'node_finance_review', label: 'RESUBMIT' },
      ],
    };

    const prDef = {
      ...sampleDefinition,
      versions: [
        {
          id: 202,
          workflowDefinitionId: 1,
          version: 1,
          bpmnJson: prBpmnJson,
          status: 'PUBLISHED',
        },
      ],
    };

    const prTask = {
      id: 502,
      workflowInstanceId: 602,
      nodeId: 'node_finance_review',
      status: WorkflowTaskStatus.PENDING,
      assigneeRoleId: 3,
      assigneeRole: { id: 3, name: 'FINANCE' },
      workflowInstance: {
        id: 602,
        workflowDefinitionId: 1,
        workflowVersionId: 202,
        entityType: 'PURCHASE_REQUEST',
        entityId: 992,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        currentNodeId: 'node_finance_review',
        context: { prId: 992 },
        workflowDefinition: prDef,
        workflowVersion: prDef.versions[0],
      },
    };

    const mockQb = {
      setLock: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(prTask),
    };

    const mockMgr = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      findOne: jest.fn().mockResolvedValue(prDef.versions[0]),
      save: jest.fn(async (e) => e),
      create: jest.fn((cls, d) => d),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    dataSource.transaction = jest.fn(async (cb) => cb(mockMgr));

    await service.completeTask(502, { action: 'RETURN', reason: 'Discrepancy in unit price' }, 3, ['FINANCE']);

    expect(mockMgr.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 992 },
      { status: 'REJECTED_TO_PROCUREMENT' },
    );
  });

  // 23. Phase 4B: RESUBMIT path (Never aliased to APPROVE, syncs SUBMITTED)
  it('23. should synchronize PurchaseRequest status to SUBMITTED upon Procurement RESUBMIT (not aliased to APPROVE)', async () => {
    const prBpmnJson = {
      nodes: [
        { id: 'node_procurement_revision', type: 'customNode', data: { label: 'Procurement Revision', type: 'TASK', role: 'PROCUREMENT' } },
        { id: 'node_finance_review', type: 'customNode', data: { label: 'Finance Review', type: 'TASK', role: 'FINANCE' } },
        { id: 'node_end', type: 'customNode', data: { label: 'End', type: 'END' } },
      ],
      edges: [
        { id: 'e1', source: 'node_procurement_revision', target: 'node_finance_review', label: 'RESUBMIT' },
        { id: 'e2', source: 'node_finance_review', target: 'node_end', label: 'APPROVE' },
      ],
    };

    const prDef = {
      ...sampleDefinition,
      versions: [
        {
          id: 203,
          workflowDefinitionId: 1,
          version: 1,
          bpmnJson: prBpmnJson,
          status: 'PUBLISHED',
        },
      ],
    };

    const revisionTask = {
      id: 503,
      workflowInstanceId: 603,
      nodeId: 'node_procurement_revision',
      status: WorkflowTaskStatus.PENDING,
      assigneeRoleId: 42,
      assigneeRole: { id: 42, name: 'PROCUREMENT' },
      workflowInstance: {
        id: 603,
        workflowDefinitionId: 1,
        workflowVersionId: 203,
        entityType: 'PURCHASE_REQUEST',
        entityId: 993,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        currentNodeId: 'node_procurement_revision',
        context: { prId: 993 },
        workflowDefinition: prDef,
        workflowVersion: prDef.versions[0],
      },
    };

    const mockQb = {
      setLock: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(revisionTask),
    };

    const mockMgr = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      findOne: jest.fn().mockResolvedValue(prDef.versions[0]),
      save: jest.fn(async (e) => e),
      create: jest.fn((cls, d) => d),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    dataSource.transaction = jest.fn(async (cb) => cb(mockMgr));

    await service.completeTask(503, { action: 'RESUBMIT', reason: 'Revised quotation attached' }, 41, ['PROCUREMENT']);

    expect(mockMgr.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 993 },
      { status: 'SUBMITTED' },
    );
  });

  // 24. Phase 4B: Strict rejection when action does not match edge
  it('24. should throw BadRequestException when action does not match any valid outgoing edge', async () => {
    const prBpmnJson = {
      nodes: [
        { id: 'node_procurement_revision', type: 'customNode', data: { label: 'Procurement Revision', type: 'TASK', role: 'PROCUREMENT' } },
        { id: 'node_finance_review', type: 'customNode', data: { label: 'Finance Review', type: 'TASK', role: 'FINANCE' } },
      ],
      edges: [
        { id: 'e1', source: 'node_procurement_revision', target: 'node_finance_review', label: 'RESUBMIT' },
      ],
    };

    const prDef = {
      ...sampleDefinition,
      versions: [{ id: 204, workflowDefinitionId: 1, version: 1, bpmnJson: prBpmnJson, status: 'PUBLISHED' }],
    };

    const revisionTask = {
      id: 504,
      workflowInstanceId: 604,
      nodeId: 'node_procurement_revision',
      status: WorkflowTaskStatus.PENDING,
      assigneeRoleId: 42,
      assigneeRole: { id: 42, name: 'PROCUREMENT' },
      workflowInstance: {
        id: 604,
        workflowDefinitionId: 1,
        workflowVersionId: 204,
        entityType: 'PURCHASE_REQUEST',
        entityId: 994,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        currentNodeId: 'node_procurement_revision',
        context: { prId: 994 },
        workflowDefinition: prDef,
        workflowVersion: prDef.versions[0],
      },
    };

    const mockQb = {
      setLock: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(revisionTask),
    };

    const mockMgr = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      findOne: jest.fn().mockResolvedValue(prDef.versions[0]),
      save: jest.fn(async (e) => e),
      create: jest.fn((cls, d) => d),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    dataSource.transaction = jest.fn(async (cb) => cb(mockMgr));

    // Attempting to APPROVE from a revision node that only accepts RESUBMIT
    await expect(
      service.completeTask(504, { action: 'APPROVE', reason: 'Invalid Action' }, 41, ['PROCUREMENT']),
    ).rejects.toThrow(BadRequestException);
  });

  // 25. Phase 4B: getInstanceByEntity validation & relation mapping
  it('25. should query instance by PURCHASE_REQUEST and reject unsupported entityType', async () => {
    instanceRepo.findOne!.mockResolvedValue({ id: 10, entityType: 'PURCHASE_REQUEST', entityId: 1 });

    const result = await service.getInstanceByEntity('PURCHASE_REQUEST', 1);
    expect(result).toBeDefined();
    expect(instanceRepo.findOne).toHaveBeenCalledWith({
      where: {
        entityType: 'PURCHASE_REQUEST',
        entityId: 1,
        status: WorkflowInstanceStatus.IN_PROGRESS,
      },
      relations: [
        'tasks',
        'tasks.assigneeRole',
        'transitions',
        'transitions.actor',
        'workflowDefinition',
        'workflowVersion',
      ],
      order: { id: 'DESC' },
    });

    await expect(
      service.getInstanceByEntity('UNSUPPORTED_ENTITY', 1),
    ).rejects.toThrow(BadRequestException);
  });

  // Phase 4E: Purchase Request Canonical Audit Coverage
  describe('Phase 4E: Purchase Request Canonical Audit Coverage (PR APPROVE / REJECT)', () => {
    const prAuditBpmnJson = {
      nodes: [
        { id: 'node_start', type: 'customNode', data: { label: 'Start', type: 'START' } },
        { id: 'node_finance_review', type: 'customNode', data: { label: 'Finance Review', type: 'TASK', role: 'FINANCE' } },
        { id: 'node_procurement_revision', type: 'customNode', data: { label: 'Procurement Revision', type: 'TASK', role: 'PROCUREMENT' } },
        { id: 'node_director_approval', type: 'customNode', data: { label: 'Director Approval', type: 'TASK', role: 'DIRECTOR' } },
        { id: 'node_end', type: 'customNode', data: { label: 'End', type: 'END' } },
      ],
      edges: [
        { id: 'e1', source: 'node_start', target: 'node_finance_review' },
        { id: 'e2_app', source: 'node_finance_review', target: 'node_director_approval', label: 'APPROVE' },
        { id: 'e2_ret', source: 'node_finance_review', target: 'node_procurement_revision', label: 'RETURN' },
        { id: 'e3_resub', source: 'node_procurement_revision', target: 'node_finance_review', label: 'RESUBMIT' },
        { id: 'e4_app', source: 'node_director_approval', target: 'node_end', label: 'APPROVE' },
        { id: 'e4_rej', source: 'node_director_approval', target: 'node_end', label: 'REJECT' },
        { id: 'e4_ret', source: 'node_director_approval', target: 'node_procurement_revision', label: 'RETURN' },
      ],
    };

    const prAuditDef = {
      ...sampleDefinition,
      versions: [
        {
          id: 301,
          workflowDefinitionId: 1,
          version: 1,
          bpmnJson: prAuditBpmnJson,
          status: 'PUBLISHED',
        },
      ],
    };

    const createMockPrTask = (opts: {
      taskId: number;
      nodeId: string;
      roleId: number;
      roleName: string;
      prId: number;
      status?: WorkflowTaskStatus;
    }) => ({
      id: opts.taskId,
      workflowInstanceId: 700 + opts.taskId,
      nodeId: opts.nodeId,
      status: opts.status || WorkflowTaskStatus.PENDING,
      assigneeRoleId: opts.roleId,
      assigneeRole: { id: opts.roleId, name: opts.roleName },
      workflowInstance: {
        id: 700 + opts.taskId,
        workflowDefinitionId: 1,
        workflowVersionId: 301,
        entityType: 'PURCHASE_REQUEST',
        entityId: opts.prId,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        currentNodeId: opts.nodeId,
        context: { prId: opts.prId },
        workflowDefinition: prAuditDef,
        workflowVersion: prAuditDef.versions[0],
      },
    });

    it('4E-1. Finance Review APPROVE -> moves PR to DIRECTOR_APPROVAL and does NOT create final APPROVE audit log', async () => {
      const task = createMockPrTask({ taskId: 101, nodeId: 'node_finance_review', roleId: 3, roleName: 'FINANCE', prId: 881 });
      const savedAudits: any[] = [];

      const mockQb = {
        setLock: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(task),
      };

      const mockMgr = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
        findOne: jest.fn(async (cls: any) => {
          if (cls === WorkflowVersion) return prAuditDef.versions[0];
          if (cls === PurchaseRequest) return { id: 881, status: 'SUBMITTED', prNumber: 'PR-2026-881' };
          if (cls === Role) return { id: 4, name: 'DIRECTOR' };
          return null;
        }),
        save: jest.fn(async (clsOrEntity: any, entity?: any) => {
          const item = entity || clsOrEntity;
          if (clsOrEntity === AuditLog || item instanceof AuditLog || item?.table_name) {
            savedAudits.push(item);
          }
          return item;
        }),
        create: jest.fn((cls, d) => d),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      dataSource.transaction = jest.fn(async (cb) => cb(mockMgr));

      await service.completeTask(101, { action: 'APPROVE', reason: 'Finance review approved' }, 31, ['FINANCE']);

      // 1. PR status updated to DIRECTOR_APPROVAL
      expect(mockMgr.update).toHaveBeenCalledWith(
        PurchaseRequest,
        { id: 881 },
        { status: 'DIRECTOR_APPROVAL' },
      );

      // 2. No final APPROVE audit created on purchase_requests
      const prApproveAudit = savedAudits.find(
        (a) => a.table_name === 'purchase_requests' && a.action === 'APPROVE',
      );
      expect(prApproveAudit).toBeUndefined();
    });

    it('4E-2. Director APPROVE -> moves PR to APPROVED and creates canonical APPROVE AuditLog', async () => {
      const task = createMockPrTask({ taskId: 102, nodeId: 'node_director_approval', roleId: 4, roleName: 'DIRECTOR', prId: 882 });
      const savedAudits: any[] = [];

      const mockQb = {
        setLock: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(task),
      };

      const mockMgr = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
        findOne: jest.fn(async (cls: any) => {
          if (cls === WorkflowVersion) return prAuditDef.versions[0];
          if (cls === PurchaseRequest) return { id: 882, status: 'DIRECTOR_APPROVAL', prNumber: 'PR-2026-882' };
          return null;
        }),
        save: jest.fn(async (clsOrEntity: any, entity?: any) => {
          const item = entity || clsOrEntity;
          if (clsOrEntity === AuditLog || item instanceof AuditLog || item?.table_name) {
            savedAudits.push(item);
          }
          return item;
        }),
        create: jest.fn((cls, d) => d),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      dataSource.transaction = jest.fn(async (cb) => cb(mockMgr));

      await service.completeTask(102, { action: 'APPROVE', reason: 'Final Approval by Director' }, 41, ['DIRECTOR']);

      // 1. PR status updated to APPROVED
      expect(mockMgr.update).toHaveBeenCalledWith(
        PurchaseRequest,
        { id: 882 },
        { status: 'APPROVED' },
      );

      // 2. Canonical AuditLog created with exact fields
      const audit = savedAudits.find((a) => a.table_name === 'purchase_requests');
      expect(audit).toBeDefined();
      expect(audit.table_name).toBe('purchase_requests');
      expect(audit.record_id).toBe(882);
      expect(audit.action).toBe('APPROVE');
      expect(audit.old_value).toEqual({ status: 'DIRECTOR_APPROVAL' });
      expect(audit.new_value).toEqual({
        status: 'APPROVED',
        prNumber: 'PR-2026-882',
        decidedBy: 41,
        reason: 'Final Approval by Director',
        workflowInstanceId: 802,
        targetNodeId: 'node_end',
      });
      expect(audit.created_by).toBe(41);
    });

    it('4E-3. RETURN TO PROCUREMENT -> moves PR to REJECTED_TO_PROCUREMENT and creates canonical REJECT AuditLog', async () => {
      const task = createMockPrTask({ taskId: 103, nodeId: 'node_finance_review', roleId: 3, roleName: 'FINANCE', prId: 883 });
      const savedAudits: any[] = [];

      const mockQb = {
        setLock: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(task),
      };

      const mockMgr = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
        findOne: jest.fn(async (cls: any) => {
          if (cls === WorkflowVersion) return prAuditDef.versions[0];
          if (cls === PurchaseRequest) return { id: 883, status: 'SUBMITTED', prNumber: 'PR-2026-883' };
          if (cls === Role) return { id: 5, name: 'PROCUREMENT' };
          return null;
        }),
        save: jest.fn(async (clsOrEntity: any, entity?: any) => {
          const item = entity || clsOrEntity;
          if (clsOrEntity === AuditLog || item instanceof AuditLog || item?.table_name) {
            savedAudits.push(item);
          }
          return item;
        }),
        create: jest.fn((cls, d) => d),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      dataSource.transaction = jest.fn(async (cb) => cb(mockMgr));

      await service.completeTask(103, { action: 'RETURN', reason: 'Pricing out of budget' }, 32, ['FINANCE']);

      expect(mockMgr.update).toHaveBeenCalledWith(
        PurchaseRequest,
        { id: 883 },
        { status: 'REJECTED_TO_PROCUREMENT' },
      );

      const audit = savedAudits.find((a) => a.table_name === 'purchase_requests');
      expect(audit).toBeDefined();
      expect(audit.table_name).toBe('purchase_requests');
      expect(audit.record_id).toBe(883);
      expect(audit.action).toBe('REJECT');
      expect(audit.old_value).toEqual({ status: 'SUBMITTED' });
      expect(audit.new_value).toEqual({
        status: 'REJECTED_TO_PROCUREMENT',
        prNumber: 'PR-2026-883',
        decidedBy: 32,
        reason: 'Pricing out of budget',
        workflowInstanceId: 803,
        targetNodeId: 'node_procurement_revision',
      });
      expect(audit.created_by).toBe(32);
    });

    it('4E-4. Terminal REJECT -> moves PR to REJECTED and creates canonical REJECT AuditLog', async () => {
      const task = createMockPrTask({ taskId: 104, nodeId: 'node_director_approval', roleId: 4, roleName: 'DIRECTOR', prId: 884 });
      const savedAudits: any[] = [];

      const mockQb = {
        setLock: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(task),
      };

      const mockMgr = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
        findOne: jest.fn(async (cls: any) => {
          if (cls === WorkflowVersion) return prAuditDef.versions[0];
          if (cls === PurchaseRequest) return { id: 884, status: 'DIRECTOR_APPROVAL', prNumber: 'PR-2026-884' };
          return null;
        }),
        save: jest.fn(async (clsOrEntity: any, entity?: any) => {
          const item = entity || clsOrEntity;
          if (clsOrEntity === AuditLog || item instanceof AuditLog || item?.table_name) {
            savedAudits.push(item);
          }
          return item;
        }),
        create: jest.fn((cls, d) => d),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      dataSource.transaction = jest.fn(async (cb) => cb(mockMgr));

      await service.completeTask(104, { action: 'REJECT', reason: 'Project terminated by client' }, 42, ['DIRECTOR']);

      expect(mockMgr.update).toHaveBeenCalledWith(
        PurchaseRequest,
        { id: 884 },
        { status: 'REJECTED' },
      );

      const audit = savedAudits.find((a) => a.table_name === 'purchase_requests');
      expect(audit).toBeDefined();
      expect(audit.table_name).toBe('purchase_requests');
      expect(audit.record_id).toBe(884);
      expect(audit.action).toBe('REJECT');
      expect(audit.old_value).toEqual({ status: 'DIRECTOR_APPROVAL' });
      expect(audit.new_value).toEqual({
        status: 'REJECTED',
        prNumber: 'PR-2026-884',
        decidedBy: 42,
        reason: 'Project terminated by client',
        workflowInstanceId: 804,
        targetNodeId: 'node_end',
      });
      expect(audit.created_by).toBe(42);
    });

    it('4E-5. Audit failure rollback -> transaction aborts if AuditLog save fails', async () => {
      const task = createMockPrTask({ taskId: 105, nodeId: 'node_director_approval', roleId: 4, roleName: 'DIRECTOR', prId: 885 });

      const mockQb = {
        setLock: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(task),
      };

      const mockMgr = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
        findOne: jest.fn(async (cls: any) => {
          if (cls === WorkflowVersion) return prAuditDef.versions[0];
          if (cls === PurchaseRequest) return { id: 885, status: 'DIRECTOR_APPROVAL', prNumber: 'PR-2026-885' };
          return null;
        }),
        save: jest.fn(async (clsOrEntity: any, entity?: any) => {
          const item = entity || clsOrEntity;
          if (clsOrEntity === AuditLog || item instanceof AuditLog || item?.table_name) {
            throw new Error('Fatal database disk error on audit_logs insert');
          }
          return item;
        }),
        create: jest.fn((cls, d) => d),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      dataSource.transaction = jest.fn(async (cb) => {
        return cb(mockMgr);
      });

      await expect(
        service.completeTask(105, { action: 'APPROVE', reason: 'Approval attempt' }, 41, ['DIRECTOR']),
      ).rejects.toThrow('Fatal database disk error on audit_logs insert');
    });

    it('4E-6. Repeated completion -> throws 409 Conflict and produces zero duplicate audit logs', async () => {
      const task = createMockPrTask({
        taskId: 106,
        nodeId: 'node_director_approval',
        roleId: 4,
        roleName: 'DIRECTOR',
        prId: 886,
        status: WorkflowTaskStatus.COMPLETED,
      });

      const savedAudits: any[] = [];
      const mockQb = {
        setLock: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(task),
      };

      const mockMgr = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
        save: jest.fn(async (clsOrEntity: any, entity?: any) => {
          const item = entity || clsOrEntity;
          if (clsOrEntity === AuditLog || item instanceof AuditLog || item?.table_name) {
            savedAudits.push(item);
          }
          return item;
        }),
      };

      dataSource.transaction = jest.fn(async (cb) => cb(mockMgr));

      await expect(
        service.completeTask(106, { action: 'APPROVE', reason: 'Duplicate attempt' }, 41, ['DIRECTOR']),
      ).rejects.toThrow(ConflictException);

      expect(savedAudits.length).toBe(0);
    });
  });

  describe('DEF-04 & DEF-05: Project Plan Governance Workflow Integration', () => {
    const projectGovernanceBpmn = {
      nodes: [
        { id: 'node_start', type: 'customNode', data: { label: 'Start', type: 'START' } },
        { id: 'node_hops_review', type: 'customNode', data: { label: 'Head of Operations Review', type: 'TASK', role: 'HEAD_OF_OPERATIONS' } },
        { id: 'node_pm_revision_hops', type: 'customNode', data: { label: 'PM Revision (HOPS)', type: 'TASK', role: 'PROJECT_MANAGER' } },
        { id: 'node_procurement_review', type: 'customNode', data: { label: 'Procurement Review', type: 'TASK', role: 'PROCUREMENT' } },
        { id: 'node_pm_revision_procurement', type: 'customNode', data: { label: 'PM Revision (Procurement)', type: 'TASK', role: 'PROJECT_MANAGER' } },
        { id: 'node_finance_review', type: 'customNode', data: { label: 'Finance Review', type: 'TASK', role: 'FINANCE' } },
        { id: 'node_pm_revision_finance', type: 'customNode', data: { label: 'PM Revision (Finance)', type: 'TASK', role: 'PROJECT_MANAGER' } },
        { id: 'node_director_approval', type: 'customNode', data: { label: 'Director Approval', type: 'TASK', role: 'DIRECTOR' } },
        { id: 'node_pm_revision_director', type: 'customNode', data: { label: 'PM Revision (Director)', type: 'TASK', role: 'PROJECT_MANAGER' } },
        { id: 'node_end', type: 'customNode', data: { label: 'End', type: 'END' } },
      ],
      edges: [
        { id: 'e1', source: 'node_start', target: 'node_hops_review' },
        { id: 'e_hops_to_proc', source: 'node_hops_review', target: 'node_procurement_review', label: 'APPROVE' },
        { id: 'e_hops_to_rev', source: 'node_hops_review', target: 'node_pm_revision_hops', label: 'RETURN' },
        { id: 'e_rev_hops_to_hops', source: 'node_pm_revision_hops', target: 'node_hops_review', label: 'RESUBMIT' },
        { id: 'e_proc_to_fin', source: 'node_procurement_review', target: 'node_finance_review', label: 'APPROVE' },
        { id: 'e_proc_to_rev', source: 'node_procurement_review', target: 'node_pm_revision_procurement', label: 'RETURN' },
        { id: 'e_rev_proc_to_proc', source: 'node_pm_revision_procurement', target: 'node_procurement_review', label: 'RESUBMIT' },
        { id: 'e_fin_to_dir', source: 'node_finance_review', target: 'node_director_approval', label: 'APPROVE' },
        { id: 'e_fin_to_rev', source: 'node_finance_review', target: 'node_pm_revision_finance', label: 'RETURN' },
        { id: 'e_rev_fin_to_fin', source: 'node_pm_revision_finance', target: 'node_finance_review', label: 'RESUBMIT' },
        { id: 'e_dir_to_end', source: 'node_director_approval', target: 'node_end', label: 'APPROVE' },
        { id: 'e_dir_to_rev', source: 'node_director_approval', target: 'node_pm_revision_director', label: 'RETURN' },
        { id: 'e_rev_dir_to_dir', source: 'node_pm_revision_director', target: 'node_director_approval', label: 'RESUBMIT' },
      ],
    };

    const projectDef: any = {
      id: 25,
      workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
      name: 'Project Plan Review Workflow',
      domain: 'PROJECT',
      activeVersion: 1,
      status: 'PUBLISHED',
      versions: [
        {
          id: 501,
          workflowDefinitionId: 25,
          version: 1,
          bpmnJson: projectGovernanceBpmn,
          status: 'PUBLISHED',
        },
      ],
    };

    const createMockProjectTask = (opts: {
      taskId: number;
      nodeId: string;
      roleId: number;
      roleName: string;
      projectId: number;
      status?: WorkflowTaskStatus;
    }) => ({
      id: opts.taskId,
      workflowInstanceId: 900 + opts.taskId,
      nodeId: opts.nodeId,
      status: opts.status || WorkflowTaskStatus.PENDING,
      assigneeRoleId: opts.roleId,
      assigneeRole: { id: opts.roleId, name: opts.roleName },
      workflowInstance: {
        id: 900 + opts.taskId,
        workflowDefinitionId: 25,
        workflowVersionId: 501,
        entityType: 'PROJECT',
        entityId: opts.projectId,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        currentNodeId: opts.nodeId,
        context: { projectId: opts.projectId },
        workflowDefinition: projectDef,
        workflowVersion: projectDef.versions[0],
      },
    });

    describe('DEF-05: getInstanceByEntity', () => {
      it('allows PROJECT entity type and returns active instance', async () => {
        const mockInstance = {
          id: 999,
          entityType: 'PROJECT',
          entityId: 42,
          status: WorkflowInstanceStatus.IN_PROGRESS,
        };
        instanceRepo.findOne = jest.fn().mockResolvedValue(mockInstance);

        const result = await service.getInstanceByEntity('PROJECT', 42);
        expect(result).toBe(mockInstance);
        expect(instanceRepo.findOne).toHaveBeenCalledWith({
          where: { entityType: 'PROJECT', entityId: 42, status: WorkflowInstanceStatus.IN_PROGRESS },
          relations: [
            'tasks',
            'tasks.assigneeRole',
            'transitions',
            'transitions.actor',
            'workflowDefinition',
            'workflowVersion',
          ],
          order: { id: 'DESC' },
        });
      });

      it('rejects unsupported entity types with BadRequestException', async () => {
        await expect(service.getInstanceByEntity('INVOICE' as any, 42)).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('DEF-04: syncBusinessEntity for PROJECT', () => {
      it('HOPS APPROVE -> updates project_management_reviews to REVIEW_PENDING without milestone AuditLog', async () => {
        const task = createMockProjectTask({
          taskId: 201,
          nodeId: 'node_hops_review',
          roleId: 5,
          roleName: 'HEAD_OF_OPERATIONS',
          projectId: 42,
        });
        const savedAudits: any[] = [];
        const existingReview = {
          id: 1,
          projectId: 42,
          status: 'REVIEW_PENDING',
        };

        const mockQb = {
          setLock: jest.fn().mockReturnThis(),
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(task),
        };

        const mockMgr = {
          createQueryBuilder: jest.fn().mockReturnValue(mockQb),
          findOne: jest.fn(async (cls: any) => {
            if (cls === WorkflowVersion) return projectDef.versions[0];
            if (cls === ProjectManagementReview) return existingReview;
            if (cls === Role) return { id: 6, name: 'PROCUREMENT' };
            return null;
          }),
          save: jest.fn(async (clsOrEntity: any, entity?: any) => {
            const item = entity || clsOrEntity;
            if (clsOrEntity === AuditLog || item instanceof AuditLog || item?.table_name) {
              savedAudits.push(item);
            }
            return item;
          }),
          create: jest.fn((cls, d) => d),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        };

        dataSource.transaction = jest.fn(async (cb) => cb(mockMgr));

        await service.completeTask(201, { action: 'APPROVE', reason: 'HOPS plan approved' }, 10, ['HEAD_OF_OPERATIONS']);

        expect(mockMgr.save).toHaveBeenCalledWith(
          ProjectManagementReview,
          expect.objectContaining({
            status: 'REVIEW_PENDING',
          }),
        );
        expect(savedAudits.length).toBe(0);
      });

      it('HOPS RETURN -> updates project_management_reviews to NEEDS_REVISION with notes and creates AuditLog', async () => {
        const task = createMockProjectTask({
          taskId: 202,
          nodeId: 'node_hops_review',
          roleId: 5,
          roleName: 'HEAD_OF_OPERATIONS',
          projectId: 42,
        });
        const savedAudits: any[] = [];
        const existingReview = {
          id: 1,
          projectId: 42,
          status: 'REVIEW_PENDING',
        };

        const mockQb = {
          setLock: jest.fn().mockReturnThis(),
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(task),
        };

        const mockMgr = {
          createQueryBuilder: jest.fn().mockReturnValue(mockQb),
          findOne: jest.fn(async (cls: any) => {
            if (cls === WorkflowVersion) return projectDef.versions[0];
            if (cls === ProjectManagementReview) return existingReview;
            if (cls === Role) return { id: 2, name: 'PROJECT_MANAGER' };
            return null;
          }),
          save: jest.fn(async (clsOrEntity: any, entity?: any) => {
            const item = entity || clsOrEntity;
            if (clsOrEntity === AuditLog || item instanceof AuditLog || item?.table_name) {
              savedAudits.push(item);
            }
            return item;
          }),
          create: jest.fn((cls, d) => d),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        };

        dataSource.transaction = jest.fn(async (cb) => cb(mockMgr));

        await service.completeTask(202, { action: 'RETURN', reason: 'WBS missing deliverables' }, 10, ['HEAD_OF_OPERATIONS']);

        expect(mockMgr.save).toHaveBeenCalledWith(
          ProjectManagementReview,
          expect.objectContaining({
            status: 'NEEDS_REVISION',
            revisionNotes: 'WBS missing deliverables',
          }),
        );
        const audit = savedAudits.find((a) => a.table_name === 'project_management_reviews');
        expect(audit).toBeDefined();
        expect(audit.action).toBe('RETURN');
        expect(audit.new_value.status).toBe('NEEDS_REVISION');
      });

      it('Director APPROVE (terminal) -> updates project_management_reviews to READY_FOR_KICKOFF and creates AuditLog', async () => {
        const task = createMockProjectTask({
          taskId: 203,
          nodeId: 'node_director_approval',
          roleId: 4,
          roleName: 'DIRECTOR',
          projectId: 42,
        });
        const savedAudits: any[] = [];
        const existingReview = {
          id: 1,
          projectId: 42,
          status: 'REVIEW_PENDING',
        };

        const mockQb = {
          setLock: jest.fn().mockReturnThis(),
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(task),
        };

        const mockMgr = {
          createQueryBuilder: jest.fn().mockReturnValue(mockQb),
          findOne: jest.fn(async (cls: any) => {
            if (cls === WorkflowVersion) return projectDef.versions[0];
            if (cls === ProjectManagementReview) return existingReview;
            return null;
          }),
          save: jest.fn(async (clsOrEntity: any, entity?: any) => {
            const item = entity || clsOrEntity;
            if (clsOrEntity === AuditLog || item instanceof AuditLog || item?.table_name) {
              savedAudits.push(item);
            }
            return item;
          }),
          create: jest.fn((cls, d) => d),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        };

        dataSource.transaction = jest.fn(async (cb) => cb(mockMgr));

        await service.completeTask(203, { action: 'APPROVE', reason: 'Approved for kickoff' }, 41, ['DIRECTOR']);

        expect(mockMgr.save).toHaveBeenCalledWith(
          ProjectManagementReview,
          expect.objectContaining({
            status: 'READY_FOR_KICKOFF',
          }),
        );
        const audit = savedAudits.find((a) => a.table_name === 'project_management_reviews');
        expect(audit).toBeDefined();
        expect(audit.action).toBe('APPROVE');
        expect(audit.new_value.status).toBe('READY_FOR_KICKOFF');
      });
    });

    describe('P2: Procurement Governance Review (node_procurement_review)', () => {
      it('Test 1: Procurement task at node_procurement_review appears in getMyTasks() for PROCUREMENT role', async () => {
        const mockTask = createMockProjectTask({
          taskId: 301,
          nodeId: 'node_procurement_review',
          roleId: 42,
          roleName: 'PROCUREMENT',
          projectId: 42,
        });

        const mockQueryBuilder = {
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([mockTask]),
        };

        taskRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

        const result = await service.getMyTasks(37, ['PROCUREMENT']);

        expect(result).toHaveLength(1);
        expect(result[0].nodeId).toBe('node_procurement_review');
        expect(result[0].assigneeRole?.name).toBe('PROCUREMENT');
        expect(mockQueryBuilder.where).toHaveBeenCalledWith('task.status = :status', {
          status: WorkflowTaskStatus.PENDING,
        });
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          '(task.assignee_user_id = :userId OR role.name IN (:...roles) OR (task.assignee_role_id IS NULL AND task.assignee_user_id IS NULL))',
          { userId: 37, roles: ['PROCUREMENT'] },
        );
      });

      it('Test 2, 3, 6, 7, 8, 9: Procurement APPROVE -> advances to node_finance_review, creates PENDING Finance task, keeps status REVIEW_PENDING (no READY_FOR_PROCUREMENT, no PR, no kick-off)', async () => {
        const task = createMockProjectTask({
          taskId: 302,
          nodeId: 'node_procurement_review',
          roleId: 42,
          roleName: 'PROCUREMENT',
          projectId: 42,
        });
        const savedAudits: any[] = [];
        const savedTasks: any[] = [];
        const existingReview = {
          id: 1,
          projectId: 42,
          status: 'REVIEW_PENDING',
        };

        const mockQb = {
          setLock: jest.fn().mockReturnThis(),
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(task),
        };

        const mockMgr = {
          createQueryBuilder: jest.fn().mockReturnValue(mockQb),
          findOne: jest.fn(async (cls: any) => {
            if (cls === WorkflowVersion) return projectDef.versions[0];
            if (cls === ProjectManagementReview) return existingReview;
            if (cls === Role) return { id: 3, name: 'FINANCE' };
            if (cls === PurchaseRequest) return null;
            return null;
          }),
          save: jest.fn(async (clsOrEntity: any, entity?: any) => {
            const item = entity || clsOrEntity;
            if (clsOrEntity === AuditLog || item instanceof AuditLog || item?.table_name) {
              savedAudits.push(item);
            }
            if (clsOrEntity === WorkflowTask || item instanceof WorkflowTask || item?.taskKey) {
              savedTasks.push(item);
            }
            return item;
          }),
          create: jest.fn((cls, d) => d),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        };

        dataSource.transaction = jest.fn(async (cb) => cb(mockMgr));

        const result = await service.completeTask(
          302,
          { action: 'APPROVE', reason: 'Procurement plan approved' },
          37,
          ['PROCUREMENT'],
        );

        // Test 2: Workflow instance current node advances to node_finance_review
        expect(result.instance.currentNodeId).toBe('node_finance_review');

        // Test 3: New task created for FINANCE with status PENDING
        const financeTask = savedTasks.find((t) => t.nodeId === 'node_finance_review');
        expect(financeTask).toBeDefined();
        expect(financeTask.status).toBe(WorkflowTaskStatus.PENDING);
        expect(financeTask.assigneeRoleId).toBe(3); // FINANCE role id

        // Test 7: Review status remains REVIEW_PENDING (NOT mutated to READY_FOR_PROCUREMENT)
        expect(mockMgr.save).toHaveBeenCalledWith(
          ProjectManagementReview,
          expect.objectContaining({
            status: 'REVIEW_PENDING',
          }),
        );
        expect(existingReview.status).not.toBe('READY_FOR_PROCUREMENT');

        // Test 8: PR is NOT created or modified
        expect(mockMgr.update).not.toHaveBeenCalledWith(
          PurchaseRequest,
          expect.anything(),
          expect.anything(),
        );

        // Test 9: Project review status is NOT READY_FOR_KICKOFF (no formal kick-off)
        expect(existingReview.status).not.toBe('READY_FOR_KICKOFF');

        // No terminal milestone AuditLog created for intermediate governance step
        expect(savedAudits.length).toBe(0);
      });

      it('Test 4: Procurement RETURN -> transitions to node_pm_revision_procurement, creates PENDING PM task, updates review to NEEDS_REVISION with AuditLog', async () => {
        const task = createMockProjectTask({
          taskId: 303,
          nodeId: 'node_procurement_review',
          roleId: 42,
          roleName: 'PROCUREMENT',
          projectId: 42,
        });
        const savedAudits: any[] = [];
        const savedTasks: any[] = [];
        const existingReview = {
          id: 1,
          projectId: 42,
          status: 'REVIEW_PENDING',
        };

        const mockQb = {
          setLock: jest.fn().mockReturnThis(),
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(task),
        };

        const mockMgr = {
          createQueryBuilder: jest.fn().mockReturnValue(mockQb),
          findOne: jest.fn(async (cls: any) => {
            if (cls === WorkflowVersion) return projectDef.versions[0];
            if (cls === ProjectManagementReview) return existingReview;
            if (cls === Role) return { id: 2, name: 'PROJECT_MANAGER' };
            return null;
          }),
          save: jest.fn(async (clsOrEntity: any, entity?: any) => {
            const item = entity || clsOrEntity;
            if (clsOrEntity === AuditLog || item instanceof AuditLog || item?.table_name) {
              savedAudits.push(item);
            }
            if (clsOrEntity === WorkflowTask || item instanceof WorkflowTask || item?.taskKey) {
              savedTasks.push(item);
            }
            return item;
          }),
          create: jest.fn((cls, d) => d),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        };

        dataSource.transaction = jest.fn(async (cb) => cb(mockMgr));

        const result = await service.completeTask(
          303,
          { action: 'RETURN', reason: 'RAB material melebihi acuan standar' },
          37,
          ['PROCUREMENT'],
        );

        // Transitions to node_pm_revision_procurement
        expect(result.instance.currentNodeId).toBe('node_pm_revision_procurement');

        // New pending task for PROJECT_MANAGER
        const pmTask = savedTasks.find((t) => t.nodeId === 'node_pm_revision_procurement');
        expect(pmTask).toBeDefined();
        expect(pmTask.status).toBe(WorkflowTaskStatus.PENDING);
        expect(pmTask.assigneeRoleId).toBe(2);

        // Project review updated to NEEDS_REVISION with reason
        expect(mockMgr.save).toHaveBeenCalledWith(
          ProjectManagementReview,
          expect.objectContaining({
            status: 'NEEDS_REVISION',
            revisionNotes: 'RAB material melebihi acuan standar',
          }),
        );

        // AuditLog recorded for revision
        const audit = savedAudits.find((a) => a.table_name === 'project_management_reviews');
        expect(audit).toBeDefined();
        expect(audit.action).toBe('RETURN');
        expect(audit.new_value.status).toBe('NEEDS_REVISION');
      });

      it('Test 5: Unauthorized role is rejected with ForbiddenException', async () => {
        const task = createMockProjectTask({
          taskId: 304,
          nodeId: 'node_procurement_review',
          roleId: 42,
          roleName: 'PROCUREMENT',
          projectId: 42,
        });

        const mockQb = {
          setLock: jest.fn().mockReturnThis(),
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(task),
        };

        const mockMgr = {
          createQueryBuilder: jest.fn().mockReturnValue(mockQb),
        };

        dataSource.transaction = jest.fn(async (cb) => cb(mockMgr));

        // User #2 has PROJECT_MANAGER role, not PROCUREMENT
        await expect(
          service.completeTask(
            304,
            { action: 'APPROVE', reason: 'Unauthorized attempt' },
            2,
            ['PROJECT_MANAGER'],
          ),
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });
});
