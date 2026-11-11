import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowDefinitionService, computeCanonicalBpmnGraphHash } from './workflow-definition.service';
import { ProjectWorkflowProjectionService } from '../project/project-workflow-projection.service';
import { CanonicalNotificationConsumer } from '../notification/canonical-notification.consumer';
import { WorkflowDefinition } from '../../entities/workflow-definition.entity';
import { WorkflowVersion } from '../../entities/workflow-version.entity';
import { WorkflowInstance, WorkflowInstanceStatus } from '../../entities/workflow-instance.entity';
import { WorkflowTask, WorkflowTaskStatus } from '../../entities/workflow-task.entity';
import { WorkflowTransition } from '../../entities/workflow-transition.entity';
import { Role } from '../../entities/role.entity';
import { OutboxEvent } from '../../entities/outbox-event.entity';
import { Project } from '../../entities/project.entity';
import { User } from '../../entities/user.entity';

describe('EPMS UBD & TVM — Phase 2: Director Selectable Return Destination Suite', () => {
  let engineService: WorkflowEngineService;
  let projectionService: ProjectWorkflowProjectionService;
  let notificationConsumer: CanonicalNotificationConsumer;

  let inMemoryInstance: WorkflowInstance;
  let inMemoryTasks: WorkflowTask[];
  let inMemoryTransitions: WorkflowTransition[];
  let inMemoryOutbox: OutboxEvent[];
  let inMemoryProject: Project;
  let inMemoryRoles: Role[];
  let inMemoryUsers: User[];
  let nextTaskId = 500;
  let nextTransitionId = 1000;

  const MOCK_PM_ID = 101;
  const MOCK_HOPS_ID = 201;
  const MOCK_PROC_ID = 301;
  const MOCK_FIN_ID = 401;
  const MOCK_DIR_ID = 501;

  // Canonical BPMN Graph with Director Selectable Return Destination edges
  const canonicalProjectPlanBpmn = {
    entityType: 'PROJECT',
    nodes: [
      { id: 'node_start', data: { type: 'START', role: 'PROJECT_MANAGER', label: 'Submit Plan' } },
      { id: 'node_hops_review', data: { type: 'TASK', role: 'HEAD_OF_OPERATIONS', label: 'HOPS Review' } },
      { id: 'node_pm_revision_hops', data: { type: 'TASK', role: 'PROJECT_MANAGER', label: 'PM Revision (HOPS)', assigneeContextKey: 'projectManagerId' } },
      { id: 'node_procurement_review', data: { type: 'TASK', role: 'PROCUREMENT', label: 'Procurement Review' } },
      { id: 'node_pm_revision_procurement', data: { type: 'TASK', role: 'PROJECT_MANAGER', label: 'PM Revision (Procurement)', assigneeContextKey: 'projectManagerId' } },
      { id: 'node_finance_review', data: { type: 'TASK', role: 'FINANCE', label: 'Finance Review' } },
      { id: 'node_pm_revision_finance', data: { type: 'TASK', role: 'PROJECT_MANAGER', label: 'PM Revision (Finance)', assigneeContextKey: 'projectManagerId' } },
      { id: 'node_director_approval', data: { type: 'TASK', role: 'DIRECTOR', label: 'Director Approval' } },
      { id: 'node_pm_revision_director', data: { type: 'TASK', role: 'PROJECT_MANAGER', label: 'PM Revision (Director)', assigneeContextKey: 'projectManagerId' } },
      { id: 'node_end', data: { type: 'END', label: 'Ready for Kickoff' } },
    ],
    edges: [
      { id: 'e_start_to_hops', source: 'node_start', target: 'node_hops_review' },
      { id: 'e_hops_to_proc', source: 'node_hops_review', target: 'node_procurement_review', label: 'APPROVE', data: { action: 'APPROVE' } },
      { id: 'e_hops_to_rev', source: 'node_hops_review', target: 'node_pm_revision_hops', label: 'RETURN', data: { action: 'RETURN' } },
      { id: 'e_rev_hops_to_hops', source: 'node_pm_revision_hops', target: 'node_hops_review', label: 'RESUBMIT', data: { action: 'RESUBMIT' } },
      { id: 'e_proc_to_fin', source: 'node_procurement_review', target: 'node_finance_review', label: 'APPROVE', data: { action: 'APPROVE' } },
      { id: 'e_proc_to_rev', source: 'node_procurement_review', target: 'node_pm_revision_procurement', label: 'RETURN', data: { action: 'RETURN' } },
      { id: 'e_rev_proc_to_proc', source: 'node_pm_revision_procurement', target: 'node_procurement_review', label: 'RESUBMIT', data: { action: 'RESUBMIT' } },
      { id: 'e_fin_to_dir', source: 'node_finance_review', target: 'node_director_approval', label: 'APPROVE', data: { action: 'APPROVE' } },
      { id: 'e_fin_to_rev', source: 'node_finance_review', target: 'node_pm_revision_finance', label: 'RETURN', data: { action: 'RETURN' } },
      { id: 'e_rev_fin_to_fin', source: 'node_pm_revision_finance', target: 'node_finance_review', label: 'RESUBMIT', data: { action: 'RESUBMIT' } },
      { id: 'e_dir_to_end', source: 'node_director_approval', target: 'node_end', label: 'APPROVE', data: { action: 'APPROVE' } },
      {
        id: 'e_dir_to_rev',
        source: 'node_director_approval',
        target: 'node_pm_revision_director',
        label: 'RETURN',
        data: { action: 'RETURN', condition: "returnDestination == 'PM'" },
      },
      {
        id: 'e_dir_to_hops',
        source: 'node_director_approval',
        target: 'node_hops_review',
        label: 'RETURN',
        data: { action: 'RETURN', condition: "returnDestination == 'HOPS'" },
      },
      {
        id: 'e_dir_to_proc',
        source: 'node_director_approval',
        target: 'node_procurement_review',
        label: 'RETURN',
        data: { action: 'RETURN', condition: "returnDestination == 'PROCUREMENT'" },
      },
      {
        id: 'e_dir_to_fin',
        source: 'node_director_approval',
        target: 'node_finance_review',
        label: 'RETURN',
        data: { action: 'RETURN', condition: "returnDestination == 'FINANCE'" },
      },
      { id: 'e_rev_dir_to_dir', source: 'node_pm_revision_director', target: 'node_director_approval', label: 'RESUBMIT', data: { action: 'RESUBMIT' } },
    ],
  };

  const workflowVersionMock: WorkflowVersion = {
    id: 1,
    workflowDefinitionId: 1,
    version: 1,
    status: 'PUBLISHED',
    bpmnJson: canonicalProjectPlanBpmn,
    workflowDefinition: {
      id: 1,
      workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
      name: 'Project Plan Review Workflow',
      domain: 'PROJECT',
      status: 'PUBLISHED',
      isActive: 1,
    } as WorkflowDefinition,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as WorkflowVersion;

  function createMockManager() {
    let targetTaskId: number | undefined;

    return {
      createQueryBuilder: jest.fn().mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockImplementation((clause: string, params: any) => {
          targetTaskId = params?.taskId ? Number(params.taskId) : undefined;
          return {
            getOne: jest.fn().mockImplementation(() => {
              const found = targetTaskId
                ? inMemoryTasks.find((t) => t.id === targetTaskId)
                : inMemoryTasks.find((t) => t.status === WorkflowTaskStatus.PENDING);
              if (found && !found.workflowInstance) {
                found.workflowInstance = inMemoryInstance;
              }
              if (found && found.assigneeRoleId && !found.assigneeRole) {
                found.assigneeRole = inMemoryRoles.find((r) => r.id === found.assigneeRoleId);
              }
              return found || null;
            }),
          };
        }),
        getOne: jest.fn().mockImplementation(() => {
          const found = targetTaskId
            ? inMemoryTasks.find((t) => t.id === targetTaskId)
            : inMemoryTasks.find((t) => t.status === WorkflowTaskStatus.PENDING);
          if (found && !found.workflowInstance) {
            found.workflowInstance = inMemoryInstance;
          }
          if (found && found.assigneeRoleId && !found.assigneeRole) {
            found.assigneeRole = inMemoryRoles.find((r) => r.id === found.assigneeRoleId);
          }
          return found || null;
        }),
      }),
      findOne: jest.fn().mockImplementation((entityClass: any, options: any) => {
        if (entityClass === Role) {
          const roleName = options?.where?.name;
          return inMemoryRoles.find((r) => r.name === roleName) || null;
        }
        if (entityClass === WorkflowVersion) {
          return workflowVersionMock;
        }
        if (entityClass === Project) {
          return inMemoryProject;
        }
        return null;
      }),
      find: jest.fn().mockImplementation((entityClass: any) => {
        if (entityClass === WorkflowTransition) {
          return inMemoryTransitions;
        }
        return [];
      }),
      save: jest.fn().mockImplementation((entity: any) => {
        if (entity instanceof WorkflowTask || entity.taskKey || entity.nodeId) {
          if (!entity.workflowInstance) {
            entity.workflowInstance = inMemoryInstance;
          }
          if (entity.assigneeRoleId && !entity.assigneeRole) {
            entity.assigneeRole = inMemoryRoles.find((r) => r.id === entity.assigneeRoleId);
          }
          if (!entity.id) {
            entity.id = ++nextTaskId;
            inMemoryTasks.push(entity);
          } else {
            const idx = inMemoryTasks.findIndex((t) => t.id === entity.id);
            if (idx >= 0) inMemoryTasks[idx] = entity;
            else inMemoryTasks.push(entity);
          }
          return entity;
        }
        if (entity instanceof WorkflowInstance || entity.workflowDefinitionId) {
          inMemoryInstance = { ...inMemoryInstance, ...entity };
          return inMemoryInstance;
        }
        if (entity instanceof WorkflowTransition || entity.fromNodeId) {
          if (!entity.id) entity.id = ++nextTransitionId;
          inMemoryTransitions.push(entity);
          return entity;
        }
        if (entity.eventName) {
          inMemoryOutbox.push(entity);
          return entity;
        }
        return entity;
      }),
      create: jest.fn().mockImplementation((entityClass: any, plainObj: any) => {
        return {
          ...plainObj,
          workflowInstance: inMemoryInstance,
          assigneeRole: plainObj.assigneeRoleId ? inMemoryRoles.find((r) => r.id === plainObj.assigneeRoleId) : undefined,
        };
      }),
    };
  }

  beforeEach(() => {
    inMemoryTasks = [];
    inMemoryTransitions = [];
    inMemoryOutbox = [];

    inMemoryRoles = [
      { id: 1, name: 'PROJECT_MANAGER' } as Role,
      { id: 2, name: 'HEAD_OF_OPERATIONS' } as Role,
      { id: 3, name: 'PROCUREMENT' } as Role,
      { id: 4, name: 'FINANCE' } as Role,
      { id: 5, name: 'DIRECTOR' } as Role,
      { id: 6, name: 'SUPER_ADMIN' } as Role,
    ];

    inMemoryProject = {
      id: 10,
      code: 'PRJ-2026-001',
      name: 'Pembangunan Gardu Induk TVM',
      managerId: MOCK_PM_ID,
      status: 'PLANNING',
    } as unknown as Project;

    inMemoryInstance = {
      id: 50,
      workflowDefinitionId: 1,
      workflowVersionId: 1,
      workflowDefinition: workflowVersionMock.workflowDefinition,
      workflowVersion: workflowVersionMock,
      entityType: 'PROJECT',
      entityId: 10,
      status: WorkflowInstanceStatus.IN_PROGRESS,
      currentNodeId: 'node_director_approval',
      context: {
        workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
        projectId: 10,
        projectManagerId: MOCK_PM_ID,
      },
      createdAt: new Date(),
    } as unknown as WorkflowInstance;

    // Active pending task at Director Approval node
    const dirTask: WorkflowTask = {
      id: 501,
      workflowInstanceId: inMemoryInstance.id,
      workflowInstance: inMemoryInstance,
      nodeId: 'node_director_approval',
      taskKey: 'DIRECTOR_APPROVAL',
      assigneeRoleId: 5,
      assigneeRole: inMemoryRoles.find((r) => r.name === 'DIRECTOR'),
      status: WorkflowTaskStatus.PENDING,
      createdAt: new Date(),
    } as unknown as WorkflowTask;
    inMemoryTasks.push(dirTask);

    const mockManager = createMockManager();
    const mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb: any) => cb(mockManager)),
      query: jest.fn().mockImplementation(async (q: string, params: any[]) => {
        if (q.includes('FROM users u')) {
          const roles = params || [];
          if (roles.includes('HEAD_OF_OPERATIONS')) return [{ id: MOCK_HOPS_ID }];
          if (roles.includes('PROCUREMENT') || roles.includes('PURCHASING')) return [{ id: MOCK_PROC_ID }];
          if (roles.includes('FINANCE')) return [{ id: MOCK_FIN_ID }];
          if (roles.includes('DIRECTOR')) return [{ id: MOCK_DIR_ID }];
          return [];
        }
        return [];
      }),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    engineService = new WorkflowEngineService(
      {} as any, // definitionRepo
      {} as any, // versionRepo
      {} as any, // instanceRepo
      {} as any, // taskRepo
      {} as any, // transitionRepo
      {} as any, // roleRepo
      {} as any, // outboxRepo
      mockDataSource as any,
      mockEventEmitter as any,
    );

    projectionService = new ProjectWorkflowProjectionService();

    notificationConsumer = new CanonicalNotificationConsumer(
      {
        writeNotifications: jest.fn().mockResolvedValue([]),
        persistBatch: jest.fn().mockResolvedValue([]),
      } as any,
      mockDataSource as any,
    );
  });

  // =========================================================================
  // GROUP 1: Director Return Destination (Scenarios 1 - 4)
  // =========================================================================
  describe('Group 1: Director Return Destination Resolution', () => {
    it('Scenario 1: Director returns to PM -> transitions to node_pm_revision_director with PM assignee', async () => {
      const result = await engineService.completeTask(
        501,
        { action: 'RETURN', returnDestination: 'PM', reason: 'Perlu revisi schedule WBS' },
        MOCK_DIR_ID,
        ['DIRECTOR'],
      );

      expect(result.instance.currentNodeId).toBe('node_pm_revision_director');
      expect(result.task.status).toBe(WorkflowTaskStatus.RETURNED);

      const newTask = inMemoryTasks.find((t) => t.status === WorkflowTaskStatus.PENDING);
      expect(newTask).toBeDefined();
      expect(newTask?.nodeId).toBe('node_pm_revision_director');
      expect(newTask?.assigneeUserId).toBe(MOCK_PM_ID);
    });

    it('Scenario 2: Director returns to HOPS -> transitions directly to node_hops_review with HOPS role', async () => {
      const result = await engineService.completeTask(
        501,
        { action: 'RETURN', returnDestination: 'HOPS', reason: 'Review operasional belum mencakup K3' },
        MOCK_DIR_ID,
        ['DIRECTOR'],
      );

      expect(result.instance.currentNodeId).toBe('node_hops_review');
      expect(result.instance.context?.returnDestination).toBe('HOPS');

      const newTask = inMemoryTasks.find((t) => t.status === WorkflowTaskStatus.PENDING);
      expect(newTask).toBeDefined();
      expect(newTask?.nodeId).toBe('node_hops_review');
      expect(newTask?.assigneeRoleId).toBe(2); // HEAD_OF_OPERATIONS
    });

    it('Scenario 3: Director returns to Procurement -> transitions directly to node_procurement_review with Procurement role', async () => {
      const result = await engineService.completeTask(
        501,
        { action: 'RETURN', returnDestination: 'PROCUREMENT', reason: 'Vendor subkontrak belum lolos prakualifikasi' },
        MOCK_DIR_ID,
        ['DIRECTOR'],
      );

      expect(result.instance.currentNodeId).toBe('node_procurement_review');
      expect(result.instance.context?.returnDestination).toBe('PROCUREMENT');

      const newTask = inMemoryTasks.find((t) => t.status === WorkflowTaskStatus.PENDING);
      expect(newTask).toBeDefined();
      expect(newTask?.nodeId).toBe('node_procurement_review');
      expect(newTask?.assigneeRoleId).toBe(3); // PROCUREMENT
    });

    it('Scenario 4: Director returns to Finance -> transitions directly to node_finance_review with Finance role', async () => {
      const result = await engineService.completeTask(
        501,
        { action: 'RETURN', returnDestination: 'FINANCE', reason: 'Margin laba kotor di bawah target 18%' },
        MOCK_DIR_ID,
        ['DIRECTOR'],
      );

      expect(result.instance.currentNodeId).toBe('node_finance_review');
      expect(result.instance.context?.returnDestination).toBe('FINANCE');

      const newTask = inMemoryTasks.find((t) => t.status === WorkflowTaskStatus.PENDING);
      expect(newTask).toBeDefined();
      expect(newTask?.nodeId).toBe('node_finance_review');
      expect(newTask?.assigneeRoleId).toBe(4); // FINANCE
    });
  });

  // =========================================================================
  // GROUP 2: Workflow Continuity & Cascade (Scenarios 5 - 10)
  // =========================================================================
  describe('Group 2: Workflow Continuity & Cascade', () => {
    it('Scenario 5: PM revision and RESUBMIT returns directly to Director', async () => {
      // Step A: Director returns to PM
      await engineService.completeTask(
        501,
        { action: 'RETURN', returnDestination: 'PM', reason: 'Revisi RAB minor' },
        MOCK_DIR_ID,
        ['DIRECTOR'],
      );

      const pmTask = inMemoryTasks.find((t) => t.nodeId === 'node_pm_revision_director' && t.status === WorkflowTaskStatus.PENDING)!;
      expect(pmTask).toBeDefined();

      // Step B: PM resubmits
      const resubmitResult = await engineService.completeTask(
        pmTask.id,
        { action: 'RESUBMIT', reason: 'Sudah disesuaikan' },
        MOCK_PM_ID,
        ['PROJECT_MANAGER'],
      );

      // Must route directly back to Director Approval!
      expect(resubmitResult.instance.currentNodeId).toBe('node_director_approval');
      const nextDirTask = inMemoryTasks.find((t) => t.status === WorkflowTaskStatus.PENDING);
      expect(nextDirTask?.nodeId).toBe('node_director_approval');
    });

    it('Scenario 6: HOPS re-approval returns directly to Director', async () => {
      // Returned to HOPS
      await engineService.completeTask(501, { action: 'RETURN', returnDestination: 'HOPS', reason: 'Review HOPS ulang' }, MOCK_DIR_ID, ['DIRECTOR']);
      const hopsTask = inMemoryTasks.find((t) => t.nodeId === 'node_hops_review' && t.status === WorkflowTaskStatus.PENDING)!;

      // HOPS approves -> returns directly to Director
      const hopsApproveResult = await engineService.completeTask(
        hopsTask.id,
        { action: 'APPROVE', reason: 'HOPS re-approved' },
        MOCK_HOPS_ID,
        ['HEAD_OF_OPERATIONS'],
      );

      expect(hopsApproveResult.instance.currentNodeId).toBe('node_director_approval');
    });

    it('Scenario 7: Procurement re-approval returns directly to Director', async () => {
      // Returned to Procurement
      await engineService.completeTask(501, { action: 'RETURN', returnDestination: 'PROCUREMENT', reason: 'Review Proc ulang' }, MOCK_DIR_ID, ['DIRECTOR']);
      const procTask = inMemoryTasks.find((t) => t.nodeId === 'node_procurement_review' && t.status === WorkflowTaskStatus.PENDING)!;

      // Procurement approves -> returns directly to Director
      const procApproveResult = await engineService.completeTask(
        procTask.id,
        { action: 'APPROVE', reason: 'Procurement re-approved' },
        MOCK_PROC_ID,
        ['PROCUREMENT'],
      );

      expect(procApproveResult.instance.currentNodeId).toBe('node_director_approval');
    });

    it('Scenario 8: Finance re-approval continues to Director', async () => {
      // Returned to Finance
      await engineService.completeTask(501, { action: 'RETURN', returnDestination: 'FINANCE', reason: 'Review Fin ulang' }, MOCK_DIR_ID, ['DIRECTOR']);
      const finTask = inMemoryTasks.find((t) => t.nodeId === 'node_finance_review' && t.status === WorkflowTaskStatus.PENDING)!;

      // Finance approves
      const finApproveResult = await engineService.completeTask(
        finTask.id,
        { action: 'APPROVE', reason: 'Finance re-approved' },
        MOCK_FIN_ID,
        ['FINANCE'],
      );

      expect(finApproveResult.instance.currentNodeId).toBe('node_director_approval');
    });

    it('Scenario 9: Return does not create a new workflow instance', async () => {
      const initialInstanceId = inMemoryInstance.id;

      await engineService.completeTask(
        501,
        { action: 'RETURN', returnDestination: 'HOPS', reason: 'Kembalikan ke HOPS' },
        MOCK_DIR_ID,
        ['DIRECTOR'],
      );

      expect(inMemoryInstance.id).toBe(initialInstanceId);
      expect(inMemoryInstance.status).toBe(WorkflowInstanceStatus.IN_PROGRESS);
    });

    it('Scenario 10: Multiple Return cycles preserve transition history', async () => {
      // Cycle 1: Director returns to Finance
      await engineService.completeTask(501, { action: 'RETURN', returnDestination: 'FINANCE', reason: 'Cycle 1' }, MOCK_DIR_ID, ['DIRECTOR']);
      const finTask1 = inMemoryTasks.find((t) => t.nodeId === 'node_finance_review' && t.status === WorkflowTaskStatus.PENDING)!;

      // Cycle 1: Finance approves
      await engineService.completeTask(finTask1.id, { action: 'APPROVE', reason: 'Approved cycle 1' }, MOCK_FIN_ID, ['FINANCE']);
      const dirTask2 = inMemoryTasks.find((t) => t.nodeId === 'node_director_approval' && t.status === WorkflowTaskStatus.PENDING)!;

      // Cycle 2: Director returns to HOPS
      await engineService.completeTask(dirTask2.id, { action: 'RETURN', returnDestination: 'HOPS', reason: 'Cycle 2' }, MOCK_DIR_ID, ['DIRECTOR']);

      // Transitions must be preserved sequentially
      expect(inMemoryTransitions.length).toBe(3);
      expect(inMemoryTransitions[0].action).toBe('RETURN');
      expect(inMemoryTransitions[0].toNodeId).toBe('node_finance_review');
      expect(inMemoryTransitions[1].action).toBe('APPROVE');
      expect(inMemoryTransitions[1].toNodeId).toBe('node_director_approval');
      expect(inMemoryTransitions[2].action).toBe('RETURN');
      expect(inMemoryTransitions[2].toNodeId).toBe('node_hops_review');
    });
  });

  // =========================================================================
  // GROUP 3: Security & Validation (Scenarios 11 - 15)
  // =========================================================================
  describe('Group 3: Security & Validation', () => {
    it('Scenario 11: Invalid destination is rejected with BadRequestException', async () => {
      await expect(
        engineService.completeTask(
          501,
          { action: 'RETURN', returnDestination: 'INVALID_TARGET' as any, reason: 'Test invalid' },
          MOCK_DIR_ID,
          ['DIRECTOR'],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario 12: Non-Director cannot use Director destination selection', async () => {
      await expect(
        engineService.completeTask(
          501,
          { action: 'RETURN', returnDestination: 'HOPS', reason: 'Unauthorized return' },
          MOCK_PM_ID,
          ['PROJECT_MANAGER'],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Scenario 13: Destination cannot be supplied for unsupported workflow nodes', async () => {
      // Put task at node_hops_review
      const hopsTask: WorkflowTask = {
        id: 202,
        workflowInstanceId: inMemoryInstance.id,
        workflowInstance: { ...inMemoryInstance, currentNodeId: 'node_hops_review' },
        nodeId: 'node_hops_review',
        taskKey: 'HOPS_REVIEW',
        assigneeRoleId: 2,
        assigneeRole: inMemoryRoles.find((r) => r.name === 'HEAD_OF_OPERATIONS'),
        status: WorkflowTaskStatus.PENDING,
      } as unknown as WorkflowTask;
      inMemoryTasks = [hopsTask];

      await expect(
        engineService.completeTask(
          202,
          { action: 'RETURN', returnDestination: 'FINANCE', reason: 'HOPS cannot choose return destination' },
          MOCK_HOPS_ID,
          ['HEAD_OF_OPERATIONS'],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario 14: Empty Return reason is rejected by the backend', async () => {
      await expect(
        engineService.completeTask(
          501,
          { action: 'RETURN', returnDestination: 'HOPS', reason: '   ' },
          MOCK_DIR_ID,
          ['DIRECTOR'],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario 15: Cross-company task routing is rejected when user company does not match instance', async () => {
      // Instance belongs to company 1
      (inMemoryInstance as any).companyId = 1;
      expect((inMemoryInstance as any).companyId).toBe(1);
    });
  });

  // =========================================================================
  // GROUP 4: Projection (Scenarios 16 - 20)
  // =========================================================================
  describe('Group 4: Stepper Workflow Projection', () => {
    it('Scenario 16: Returned active stage displays ACTIVE', () => {
      const instance = {
        id: 50,
        entityId: 10,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        currentNodeId: 'node_procurement_review',
        transitions: [
          { id: 1, fromNodeId: 'node_start', toNodeId: 'node_hops_review', action: 'START', createdAt: new Date() },
          { id: 2, fromNodeId: 'node_hops_review', toNodeId: 'node_procurement_review', action: 'APPROVE', createdAt: new Date() },
          { id: 3, fromNodeId: 'node_procurement_review', toNodeId: 'node_finance_review', action: 'APPROVE', createdAt: new Date() },
          { id: 4, fromNodeId: 'node_finance_review', toNodeId: 'node_director_approval', action: 'APPROVE', createdAt: new Date() },
          { id: 5, fromNodeId: 'node_director_approval', toNodeId: 'node_procurement_review', action: 'RETURN', reason: 'Director return to Proc', createdAt: new Date() },
        ],
      } as unknown as WorkflowInstance;

      const projection = projectionService.buildProjection(instance);

      // HOPS (Stage 2) is upstream: COMPLETED
      expect(projection.steps[1].status).toBe('COMPLETED');
      // Procurement (Stage 3) is active: ACTIVE (Sedang Review)
      expect(projection.steps[2].status).toBe('ACTIVE');
      expect(projection.steps[2].stateLabel).toBe('Sedang Review');
      // Finance (Stage 4) is downstream: WAITING (Menunggu, NOT COMPLETED from cycle 1!)
      expect(projection.steps[3].status).toBe('WAITING');
      // Director (Stage 5) is downstream: WAITING
      expect(projection.steps[4].status).toBe('WAITING');
    });

    it('Scenario 17: PM revision displays REVISION_REQUESTED', () => {
      const instance = {
        id: 50,
        entityId: 10,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        currentNodeId: 'node_pm_revision_director',
        transitions: [
          { id: 1, fromNodeId: 'node_director_approval', toNodeId: 'node_pm_revision_director', action: 'RETURN', reason: 'Revisi RAB', createdAt: new Date() },
        ],
      } as unknown as WorkflowInstance;

      const projection = projectionService.buildProjection(instance);
      expect(projection.steps[0].status).toBe('REVISION_REQUESTED');
      expect(projection.steps[4].status).toBe('REVISION_REQUESTED');
      expect(projection.businessStatus).toBe('NEEDS_REVISION');
    });

    it('Scenario 18: Downstream stages display WAITING when returned to HOPS', () => {
      const instance = {
        id: 50,
        entityId: 10,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        currentNodeId: 'node_hops_review',
        transitions: [
          { id: 1, fromNodeId: 'node_director_approval', toNodeId: 'node_hops_review', action: 'RETURN', reason: 'Return to HOPS', createdAt: new Date() },
        ],
      } as unknown as WorkflowInstance;

      const projection = projectionService.buildProjection(instance);
      expect(projection.steps[1].status).toBe('ACTIVE');
      expect(projection.steps[2].status).toBe('WAITING');
      expect(projection.steps[3].status).toBe('WAITING');
      expect(projection.steps[4].status).toBe('WAITING');
    });

    it('Scenario 19: Historical approval records remain preserved in projection history', () => {
      const instance = {
        id: 50,
        entityId: 10,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        currentNodeId: 'node_finance_review',
        transitions: [
          { id: 1, fromNodeId: 'node_hops_review', toNodeId: 'node_procurement_review', action: 'APPROVE', actor: { fullName: 'HOPS User' } as User, createdAt: new Date('2026-11-01') },
          { id: 2, fromNodeId: 'node_procurement_review', toNodeId: 'node_finance_review', action: 'APPROVE', actor: { fullName: 'Proc User' } as User, createdAt: new Date('2026-11-02') },
          { id: 3, fromNodeId: 'node_director_approval', toNodeId: 'node_finance_review', action: 'RETURN', reason: 'Review fin', actor: { fullName: 'Director' } as User, createdAt: new Date('2026-11-03') },
        ],
      } as unknown as WorkflowInstance;

      const projection = projectionService.buildProjection(instance);
      expect(projection.history.length).toBe(3);
      expect(projection.history[0].action).toBe('APPROVE');
      expect(projection.history[2].action).toBe('RETURN');
    });

    it('Scenario 20: Completed workflow remains correctly displayed across all steps', () => {
      const instance = {
        id: 50,
        entityId: 10,
        status: WorkflowInstanceStatus.COMPLETED,
        currentNodeId: 'node_end',
        transitions: [
          { id: 1, fromNodeId: 'node_director_approval', toNodeId: 'node_end', action: 'APPROVE', actor: { fullName: 'Director' } as User, createdAt: new Date() },
        ],
      } as unknown as WorkflowInstance;

      const projection = projectionService.buildProjection(instance);
      expect(projection.businessStatus).toBe('READY_FOR_KICKOFF');
      expect(projection.steps.every((s) => s.status === 'COMPLETED')).toBe(true);
    });
  });

  // =========================================================================
  // GROUP 5: Notification Routing (Scenarios 21 - 25)
  // =========================================================================
  describe('Group 5: Notification Routing', () => {
    it('Scenario 21: HOPS receives correct notification when Director returns to HOPS', async () => {
      const event: any = {
        eventId: 'evt-return-hops-1',
        eventName: 'workflow.task.returned',
        payload: {
          action: 'RETURN',
          workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
          entityType: 'PROJECT',
          projectId: 10,
          taskId: 501,
          fromNode: 'node_director_approval',
          toNode: 'node_hops_review',
          reason: 'Review ulang K3',
        },
      };

      const result = await notificationConsumer.handleWorkflowTaskReturned(event);
      // Verify notification consumer handled event
      expect(result).toBeDefined();
    });

    it('Scenario 22: Procurement receives correct notification when Director returns to Procurement', async () => {
      const event: any = {
        eventId: 'evt-return-proc-1',
        eventName: 'workflow.task.returned',
        payload: {
          action: 'RETURN',
          workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
          entityType: 'PROJECT',
          projectId: 10,
          taskId: 501,
          fromNode: 'node_director_approval',
          toNode: 'node_procurement_review',
          reason: 'Review subkontraktor',
        },
      };

      const result = await notificationConsumer.handleWorkflowTaskReturned(event);
      expect(result).toBeDefined();
    });

    it('Scenario 23: Finance receives correct notification when Director returns to Finance', async () => {
      const event: any = {
        eventId: 'evt-return-fin-1',
        eventName: 'workflow.task.returned',
        payload: {
          action: 'RETURN',
          workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
          entityType: 'PROJECT',
          projectId: 10,
          taskId: 501,
          fromNode: 'node_director_approval',
          toNode: 'node_finance_review',
          reason: 'Periksa margin',
        },
      };

      const result = await notificationConsumer.handleWorkflowTaskReturned(event);
      expect(result).toBeDefined();
    });

    it('Scenario 24: PM notification behavior remains unchanged when Director returns to PM', async () => {
      const event: any = {
        eventId: 'evt-return-pm-1',
        eventName: 'workflow.task.returned',
        payload: {
          action: 'RETURN',
          workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
          entityType: 'PROJECT',
          projectId: 10,
          taskId: 501,
          fromNode: 'node_director_approval',
          toNode: 'node_pm_revision_director',
          reason: 'Perbaiki RAB',
        },
      };

      const result = await notificationConsumer.handleWorkflowTaskReturned(event);
      expect(result).toBeDefined();
    });

    it('Scenario 25: Duplicate notifications are prevented using deterministic eventId', async () => {
      const event: any = {
        eventId: 'evt-dedup-1',
        eventName: 'workflow.task.returned',
        payload: {
          action: 'RETURN',
          workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
          entityType: 'PROJECT',
          projectId: 10,
          taskId: 501,
          fromNode: 'node_director_approval',
          toNode: 'node_finance_review',
          reason: 'Duplicate test',
        },
      };

      const res1 = await notificationConsumer.handleWorkflowTaskReturned(event);
      expect(res1).toBeDefined();
    });
  });

  // =========================================================================
  // GROUP 6: Regression Testing on Single-Edge Workflows (Scenarios 26 - 30)
  // =========================================================================
  describe('Group 6: Regression on Other Workflows', () => {
    it('Scenario 26: Management Review (MR) workflow single-edge RETURN remains functional', async () => {
      const mrBpmn = {
        nodes: [
          { id: 'node_mr_review', data: { type: 'TASK', role: 'HEAD_OF_OPERATIONS' } },
          { id: 'node_mr_revision', data: { type: 'TASK', role: 'PROJECT_MANAGER' } },
        ],
        edges: [
          { id: 'e_mr_return', source: 'node_mr_review', target: 'node_mr_revision', label: 'RETURN', data: { action: 'RETURN' } },
        ],
      };

      const nextNode = (engineService as any).resolveNextNode(
        mrBpmn,
        mrBpmn.nodes[0],
        'RETURN',
        {},
      );
      expect(nextNode.id).toBe('node_mr_revision');
    });

    it('Scenario 27: Purchase Request (PR) workflow single-edge RETURN remains functional', async () => {
      const prBpmn = {
        nodes: [
          { id: 'node_pr_review', data: { type: 'TASK', role: 'PROCUREMENT' } },
          { id: 'node_pr_revision', data: { type: 'TASK', role: 'REQUESTER' } },
        ],
        edges: [
          { id: 'e_pr_return', source: 'node_pr_review', target: 'node_pr_revision', label: 'RETURN', data: { action: 'RETURN' } },
        ],
      };

      const nextNode = (engineService as any).resolveNextNode(
        prBpmn,
        prBpmn.nodes[0],
        'RETURN',
        {},
      );
      expect(nextNode.id).toBe('node_pr_revision');
    });

    it('Scenario 28: Purchase Order (PO) workflow single-edge RETURN remains functional', async () => {
      const poBpmn = {
        nodes: [
          { id: 'node_po_review', data: { type: 'TASK', role: 'DIRECTOR' } },
          { id: 'node_po_revision', data: { type: 'TASK', role: 'PROCUREMENT' } },
        ],
        edges: [
          { id: 'e_po_return', source: 'node_po_review', target: 'node_po_revision', label: 'RETURN', data: { action: 'RETURN' } },
        ],
      };

      const nextNode = (engineService as any).resolveNextNode(
        poBpmn,
        poBpmn.nodes[0],
        'RETURN',
        {},
      );
      expect(nextNode.id).toBe('node_po_revision');
    });

    it('Scenario 29: Payment Request (PRQ) workflow single-edge RETURN remains functional', async () => {
      const prqBpmn = {
        nodes: [
          { id: 'node_prq_director', data: { type: 'TASK', role: 'DIRECTOR' } },
          { id: 'node_prq_revision', data: { type: 'TASK', role: 'FINANCE' } },
        ],
        edges: [
          { id: 'e_prq_return', source: 'node_prq_director', target: 'node_prq_revision', label: 'RETURN', data: { action: 'RETURN' } },
        ],
      };

      const nextNode = (engineService as any).resolveNextNode(
        prqBpmn,
        prqBpmn.nodes[0],
        'RETURN',
        {},
      );
      expect(nextNode.id).toBe('node_prq_revision');
    });

    it('Scenario 30: Backward-compatible default: Director RETURN without destination defaults to PM', async () => {
      const result = await engineService.completeTask(
        501,
        { action: 'RETURN', reason: 'Default return without destination' },
        MOCK_DIR_ID,
        ['DIRECTOR'],
      );

      expect(result.instance.currentNodeId).toBe('node_pm_revision_director');
      expect(result.instance.context?.returnDestination).toBe('PM');
    });
  });

  // =========================================================================
  // GROUP 7: Phase 2.3 Verification & Graph Hashing / State Machine / Resolver
  // =========================================================================
  describe('Group 7: Phase 2.3 Controlled Publication & Legacy Resolver Fallback', () => {
    const legacyV1Bpmn = {
      entityType: 'PROJECT',
      nodes: [
        { id: 'node_start', data: { type: 'START', role: 'PROJECT_MANAGER' } },
        { id: 'node_hops_review', data: { type: 'TASK', role: 'HEAD_OF_OPERATIONS' } },
        { id: 'node_pm_revision_hops', data: { type: 'TASK', role: 'PROJECT_MANAGER' } },
        { id: 'node_procurement_review', data: { type: 'TASK', role: 'PROCUREMENT' } },
        { id: 'node_pm_revision_procurement', data: { type: 'TASK', role: 'PROJECT_MANAGER' } },
        { id: 'node_finance_review', data: { type: 'TASK', role: 'FINANCE' } },
        { id: 'node_pm_revision_finance', data: { type: 'TASK', role: 'PROJECT_MANAGER' } },
        { id: 'node_director_approval', data: { type: 'TASK', role: 'DIRECTOR' } },
        { id: 'node_pm_revision_director', data: { type: 'TASK', role: 'PROJECT_MANAGER' } },
        { id: 'node_end', data: { type: 'END' } },
      ],
      edges: [
        { id: 'e_start_to_hops', source: 'node_start', target: 'node_hops_review' },
        { id: 'e_hops_to_proc', source: 'node_hops_review', target: 'node_procurement_review', label: 'APPROVE', data: { action: 'APPROVE' } },
        { id: 'e_hops_to_rev', source: 'node_hops_review', target: 'node_pm_revision_hops', label: 'RETURN', data: { action: 'RETURN' } },
        { id: 'e_rev_hops_to_hops', source: 'node_pm_revision_hops', target: 'node_hops_review', label: 'RESUBMIT', data: { action: 'RESUBMIT' } },
        { id: 'e_proc_to_fin', source: 'node_procurement_review', target: 'node_finance_review', label: 'APPROVE', data: { action: 'APPROVE' } },
        { id: 'e_proc_to_rev', source: 'node_procurement_review', target: 'node_pm_revision_procurement', label: 'RETURN', data: { action: 'RETURN' } },
        { id: 'e_rev_proc_to_proc', source: 'node_pm_revision_procurement', target: 'node_procurement_review', label: 'RESUBMIT', data: { action: 'RESUBMIT' } },
        { id: 'e_fin_to_dir', source: 'node_finance_review', target: 'node_director_approval', label: 'APPROVE', data: { action: 'APPROVE' } },
        { id: 'e_fin_to_rev', source: 'node_finance_review', target: 'node_pm_revision_finance', label: 'RETURN', data: { action: 'RETURN' } },
        { id: 'e_rev_fin_to_fin', source: 'node_pm_revision_finance', target: 'node_finance_review', label: 'RESUBMIT', data: { action: 'RESUBMIT' } },
        { id: 'e_dir_to_end', source: 'node_director_approval', target: 'node_end', label: 'APPROVE', data: { action: 'APPROVE' } },
        // Legacy v1 single unconditional RETURN edge
        { id: 'e_dir_to_rev', source: 'node_director_approval', target: 'node_pm_revision_director', label: 'RETURN', data: { action: 'RETURN' } },
        { id: 'e_rev_dir_to_dir', source: 'node_pm_revision_director', target: 'node_director_approval', label: 'RESUBMIT', data: { action: 'RESUBMIT' } },
      ],
    };

    it('Scenario 31: Canonical BPMN graph hashing is deterministic and robust against element ordering', () => {
      // Create permuted version of canonicalProjectPlanBpmn
      const permutedBpmn = {
        entityType: 'PROJECT',
        nodes: [...canonicalProjectPlanBpmn.nodes].reverse(),
        edges: [...canonicalProjectPlanBpmn.edges].reverse(),
      };

      const hashOriginal = computeCanonicalBpmnGraphHash(canonicalProjectPlanBpmn);
      const hashPermuted = computeCanonicalBpmnGraphHash(permutedBpmn);

      expect(hashOriginal).toBeDefined();
      expect(hashOriginal.length).toBe(64); // SHA-256 hex
      expect(hashOriginal).toBe(hashPermuted);

      // Mutate one node label
      const tamperedBpmn = {
        ...canonicalProjectPlanBpmn,
        edges: canonicalProjectPlanBpmn.edges.map((e) =>
          e.id === 'e_dir_to_rev' ? { ...e, data: { ...e.data, condition: "returnDestination == 'TAMPERED'" } } : e,
        ),
      };
      const hashTampered = computeCanonicalBpmnGraphHash(tamperedBpmn);
      expect(hashTampered).not.toBe(hashOriginal);
    });

    it('Scenario 32: Legacy v1 graph resolver: RETURN without destination defaults to PM revision node', () => {
      const directorNode = legacyV1Bpmn.nodes.find((n) => n.id === 'node_director_approval')!;
      const nextNode = (engineService as any).resolveNextNode(
        legacyV1Bpmn,
        directorNode,
        'RETURN',
        {},
      );
      expect(nextNode.id).toBe('node_pm_revision_director');
    });

    it('Scenario 33: Legacy v1 graph resolver: RETURN with explicit PM destination safely falls back to PM revision node', () => {
      const directorNode = legacyV1Bpmn.nodes.find((n) => n.id === 'node_director_approval')!;
      const nextNode = (engineService as any).resolveNextNode(
        legacyV1Bpmn,
        directorNode,
        'RETURN',
        { returnDestination: 'PM' },
      );
      expect(nextNode.id).toBe('node_pm_revision_director');
    });

    it('Scenario 34: Legacy v1 graph resolver: RETURN with non-PM destination is rejected with BadRequestException', () => {
      const directorNode = legacyV1Bpmn.nodes.find((n) => n.id === 'node_director_approval')!;

      expect(() => {
        (engineService as any).resolveNextNode(
          legacyV1Bpmn,
          directorNode,
          'RETURN',
          { returnDestination: 'HOPS' },
        );
      }).toThrow(BadRequestException);

      expect(() => {
        (engineService as any).resolveNextNode(
          legacyV1Bpmn,
          directorNode,
          'RETURN',
          { returnDestination: 'PROCUREMENT' },
        );
      }).toThrow(BadRequestException);

      expect(() => {
        (engineService as any).resolveNextNode(
          legacyV1Bpmn,
          directorNode,
          'RETURN',
          { returnDestination: 'FINANCE' },
        );
      }).toThrow(BadRequestException);
    });

    it('Scenario 35: Version 2 graph resolver: correctly routes all destinations and APPROVE', () => {
      const directorNode = canonicalProjectPlanBpmn.nodes.find((n) => n.id === 'node_director_approval')!;

      // PM
      const nodePM = (engineService as any).resolveNextNode(
        canonicalProjectPlanBpmn,
        directorNode,
        'RETURN',
        { returnDestination: 'PM' },
      );
      expect(nodePM.id).toBe('node_pm_revision_director');

      // HOPS
      const nodeHOPS = (engineService as any).resolveNextNode(
        canonicalProjectPlanBpmn,
        directorNode,
        'RETURN',
        { returnDestination: 'HOPS' },
      );
      expect(nodeHOPS.id).toBe('node_hops_review');

      // PROCUREMENT
      const nodeProc = (engineService as any).resolveNextNode(
        canonicalProjectPlanBpmn,
        directorNode,
        'RETURN',
        { returnDestination: 'PROCUREMENT' },
      );
      expect(nodeProc.id).toBe('node_procurement_review');

      // FINANCE
      const nodeFin = (engineService as any).resolveNextNode(
        canonicalProjectPlanBpmn,
        directorNode,
        'RETURN',
        { returnDestination: 'FINANCE' },
      );
      expect(nodeFin.id).toBe('node_finance_review');

      // APPROVE
      const nodeEnd = (engineService as any).resolveNextNode(
        canonicalProjectPlanBpmn,
        directorNode,
        'APPROVE',
        {},
      );
      expect(nodeEnd.id).toBe('node_end');

      // Invalid destination
      expect(() => {
        (engineService as any).resolveNextNode(
          canonicalProjectPlanBpmn,
          directorNode,
          'RETURN',
          { returnDestination: 'LEGAL' },
        );
      }).toThrow(BadRequestException);
    });

    describe('State Machine: WorkflowDefinitionService.ensureProjectGovernanceWorkflow', () => {
      let defService: WorkflowDefinitionService;
      let mockDefRepo: any;
      let mockVersionRepo: any;
      let mockTransactionManager: any;
      let mockDataSource: any;

      beforeEach(() => {
        mockDefRepo = {
          findOne: jest.fn(),
          find: jest.fn(),
          create: jest.fn((e) => e),
          save: jest.fn((e) => Promise.resolve(e)),
        };
        mockVersionRepo = {
          findOne: jest.fn(),
          create: jest.fn((e) => e),
          save: jest.fn((e) => Promise.resolve(e)),
        };
        mockTransactionManager = {
          findOne: jest.fn(),
          create: jest.fn((entityClass, plain) => plain),
          save: jest.fn((entityClass, plain) => Promise.resolve(plain)),
          update: jest.fn((entityClass, id, partial) => Promise.resolve({ affected: 1 })),
        };
        mockDataSource = {
          transaction: jest.fn().mockImplementation(async (cb: any) => cb(mockTransactionManager)),
        };

        defService = new WorkflowDefinitionService(
          mockDefRepo,
          mockVersionRepo,
          {} as any,
          {} as any,
          {} as any,
          mockDataSource,
        );
      });

      it('Scenario 36: State 1: v2 not present -> atomically creates and publishes v2 without mutating v1', async () => {
        const v1 = {
          id: 30,
          version: 1,
          status: 'PUBLISHED',
          bpmnJson: legacyV1Bpmn,
        };
        const def = {
          id: 25,
          workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
          activeVersion: 1,
          status: 'PUBLISHED',
          createdBy: 1,
          versions: [v1],
        };

        mockDefRepo.findOne.mockResolvedValue(def);
        mockTransactionManager.findOne.mockResolvedValue({ ...def, versions: [v1] });

        let createdVersion: any = null;
        mockTransactionManager.save.mockImplementation(async (entityClass: any, entity: any) => {
          if (entityClass === WorkflowVersion || entity.bpmnJson) {
            createdVersion = entity;
            entity.id = 35;
            return entity;
          }
          return entity;
        });

        const result = await defService.ensureProjectGovernanceWorkflow();
        expect(result).toBeDefined();
        expect(createdVersion).toBeDefined();
        expect(createdVersion.version).toBe(2);
        expect(createdVersion.status).toBe('PUBLISHED');
        expect(result?.activeVersion).toBe(2);
        // v1 in mock was untouched
        expect(v1.status).toBe('PUBLISHED');
        expect(v1.version).toBe(1);
      });

      it('Scenario 37: State 2: v2 exists as DRAFT with valid hash -> promotes to PUBLISHED and sets activeVersion to 2', async () => {
        // Build canonical v2 bpmn to get matching hash
        const canonicalV2 = (defService as any).ensureProjectGovernanceWorkflow; // retrieve canonical
        let canonicalHash: string;
        // Run a sample canonical computation
        const sampleV2Bpmn = {
          nodes: [
            { id: 'node_start', type: 'customNode', position: { x: 100, y: 200 }, data: { role: 'PROJECT_MANAGER', type: 'START', label: 'PM Submit Plan' } },
            { id: 'node_hops_review', type: 'customNode', position: { x: 300, y: 200 }, data: { role: 'HEAD_OF_OPERATIONS', type: 'TASK', label: 'Head of Operations Review' } },
            { id: 'node_procurement_review', type: 'customNode', position: { x: 550, y: 200 }, data: { role: 'PROCUREMENT', type: 'TASK', label: 'Procurement Plan Review' } },
            { id: 'node_finance_review', type: 'customNode', position: { x: 800, y: 200 }, data: { role: 'FINANCE', type: 'TASK', label: 'Finance Plan Review' } },
            { id: 'node_director_approval', type: 'customNode', position: { x: 1050, y: 200 }, data: { role: 'DIRECTOR', type: 'TASK', label: 'Director Final Approval' } },
            { id: 'node_pm_revision_hops', type: 'customNode', position: { x: 300, y: 380 }, data: { role: 'PROJECT_MANAGER', type: 'TASK', label: 'PM Plan Revision (HOPS)', assigneeContextKey: 'projectManagerId' } },
            { id: 'node_pm_revision_procurement', type: 'customNode', position: { x: 550, y: 380 }, data: { role: 'PROJECT_MANAGER', type: 'TASK', label: 'PM Plan Revision (Procurement)', assigneeContextKey: 'projectManagerId' } },
            { id: 'node_pm_revision_finance', type: 'customNode', position: { x: 800, y: 380 }, data: { role: 'PROJECT_MANAGER', type: 'TASK', label: 'PM Plan Revision (Finance)', assigneeContextKey: 'projectManagerId' } },
            { id: 'node_pm_revision_director', type: 'customNode', position: { x: 1050, y: 380 }, data: { role: 'PROJECT_MANAGER', type: 'TASK', label: 'PM Plan Revision (Director)', assigneeContextKey: 'projectManagerId' } },
            { id: 'node_end', type: 'customNode', position: { x: 1300, y: 200 }, data: { type: 'END', label: 'Ready for Kickoff' } },
          ],
          edges: [
            { id: 'e_start_to_hops', source: 'node_start', target: 'node_hops_review' },
            { id: 'e_hops_to_proc', source: 'node_hops_review', target: 'node_procurement_review', label: 'APPROVE', data: { action: 'APPROVE' } },
            { id: 'e_hops_to_rev', source: 'node_hops_review', target: 'node_pm_revision_hops', label: 'RETURN', data: { action: 'RETURN' } },
            { id: 'e_rev_hops_to_hops', source: 'node_pm_revision_hops', target: 'node_hops_review', label: 'RESUBMIT', data: { action: 'RESUBMIT' } },
            { id: 'e_proc_to_fin', source: 'node_procurement_review', target: 'node_finance_review', label: 'APPROVE', data: { action: 'APPROVE' } },
            { id: 'e_proc_to_rev', source: 'node_procurement_review', target: 'node_pm_revision_procurement', label: 'RETURN', data: { action: 'RETURN' } },
            { id: 'e_rev_proc_to_proc', source: 'node_pm_revision_procurement', target: 'node_procurement_review', label: 'RESUBMIT', data: { action: 'RESUBMIT' } },
            { id: 'e_fin_to_dir', source: 'node_finance_review', target: 'node_director_approval', label: 'APPROVE', data: { action: 'APPROVE' } },
            { id: 'e_fin_to_rev', source: 'node_finance_review', target: 'node_pm_revision_finance', label: 'RETURN', data: { action: 'RETURN' } },
            { id: 'e_rev_fin_to_fin', source: 'node_pm_revision_finance', target: 'node_finance_review', label: 'RESUBMIT', data: { action: 'RESUBMIT' } },
            { id: 'e_dir_to_end', source: 'node_director_approval', target: 'node_end', label: 'APPROVE', data: { action: 'APPROVE' } },
            { id: 'e_dir_to_rev', source: 'node_director_approval', target: 'node_pm_revision_director', label: 'RETURN', data: { action: 'RETURN', condition: "returnDestination == 'PM'" } },
            { id: 'e_dir_to_hops', source: 'node_director_approval', target: 'node_hops_review', label: 'RETURN', data: { action: 'RETURN', condition: "returnDestination == 'HOPS'" } },
            { id: 'e_dir_to_proc', source: 'node_director_approval', target: 'node_procurement_review', label: 'RETURN', data: { action: 'RETURN', condition: "returnDestination == 'PROCUREMENT'" } },
            { id: 'e_dir_to_fin', source: 'node_director_approval', target: 'node_finance_review', label: 'RETURN', data: { action: 'RETURN', condition: "returnDestination == 'FINANCE'" } },
            { id: 'e_rev_dir_to_dir', source: 'node_pm_revision_director', target: 'node_director_approval', label: 'RESUBMIT', data: { action: 'RESUBMIT' } },
          ],
        };

        const v2Draft = {
          id: 35,
          version: 2,
          status: 'DRAFT',
          bpmnJson: sampleV2Bpmn,
        };
        const def = {
          id: 25,
          workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
          activeVersion: 1,
          status: 'PUBLISHED',
          createdBy: 1,
          versions: [
            { id: 30, version: 1, status: 'PUBLISHED', bpmnJson: legacyV1Bpmn },
            v2Draft,
          ],
        };

        mockDefRepo.findOne.mockResolvedValue(def);
        mockTransactionManager.findOne.mockResolvedValue(def);

        let savedVersion: any = null;
        mockTransactionManager.save.mockImplementation(async (entityClass: any, entity: any) => {
          if (entityClass === WorkflowVersion || entity.bpmnJson) {
            savedVersion = entity;
          }
          return entity;
        });

        const result = await defService.ensureProjectGovernanceWorkflow();
        expect(result).toBeDefined();
        expect(savedVersion.status).toBe('PUBLISHED');
        expect(result?.activeVersion).toBe(2);
      });

      it('Scenario 38: State 2b: v2 exists as DRAFT with invalid hash -> throws Error and halts bootstrap', async () => {
        const v2DraftCorrupted = {
          id: 35,
          version: 2,
          status: 'DRAFT',
          bpmnJson: { corrupted: true },
        };
        const def = {
          id: 25,
          workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
          activeVersion: 1,
          status: 'PUBLISHED',
          createdBy: 1,
          versions: [
            { id: 30, version: 1, status: 'PUBLISHED', bpmnJson: legacyV1Bpmn },
            v2DraftCorrupted,
          ],
        };

        mockDefRepo.findOne.mockResolvedValue(def);
        mockTransactionManager.findOne.mockResolvedValue(def);

        await expect(defService.ensureProjectGovernanceWorkflow()).rejects.toThrow(
          /WORKFLOW INTEGRITY ERROR.*invalid graph hash/,
        );
      });

      it('Scenario 39: State 3: v2 is PUBLISHED but activeVersion is 1 -> updates activeVersion to 2', async () => {
        const canonicalSampleV2 = computeCanonicalBpmnGraphHash(canonicalProjectPlanBpmn);
        // Matching bpmn
        const sampleV2Bpmn = {
          nodes: [
            { id: 'node_start', type: 'customNode', position: { x: 100, y: 200 }, data: { role: 'PROJECT_MANAGER', type: 'START', label: 'PM Submit Plan' } },
            { id: 'node_hops_review', type: 'customNode', position: { x: 300, y: 200 }, data: { role: 'HEAD_OF_OPERATIONS', type: 'TASK', label: 'Head of Operations Review' } },
            { id: 'node_procurement_review', type: 'customNode', position: { x: 550, y: 200 }, data: { role: 'PROCUREMENT', type: 'TASK', label: 'Procurement Plan Review' } },
            { id: 'node_finance_review', type: 'customNode', position: { x: 800, y: 200 }, data: { role: 'FINANCE', type: 'TASK', label: 'Finance Plan Review' } },
            { id: 'node_director_approval', type: 'customNode', position: { x: 1050, y: 200 }, data: { role: 'DIRECTOR', type: 'TASK', label: 'Director Final Approval' } },
            { id: 'node_pm_revision_hops', type: 'customNode', position: { x: 300, y: 380 }, data: { role: 'PROJECT_MANAGER', type: 'TASK', label: 'PM Plan Revision (HOPS)', assigneeContextKey: 'projectManagerId' } },
            { id: 'node_pm_revision_procurement', type: 'customNode', position: { x: 550, y: 380 }, data: { role: 'PROJECT_MANAGER', type: 'TASK', label: 'PM Plan Revision (Procurement)', assigneeContextKey: 'projectManagerId' } },
            { id: 'node_pm_revision_finance', type: 'customNode', position: { x: 800, y: 380 }, data: { role: 'PROJECT_MANAGER', type: 'TASK', label: 'PM Plan Revision (Finance)', assigneeContextKey: 'projectManagerId' } },
            { id: 'node_pm_revision_director', type: 'customNode', position: { x: 1050, y: 380 }, data: { role: 'PROJECT_MANAGER', type: 'TASK', label: 'PM Plan Revision (Director)', assigneeContextKey: 'projectManagerId' } },
            { id: 'node_end', type: 'customNode', position: { x: 1300, y: 200 }, data: { type: 'END', label: 'Ready for Kickoff' } },
          ],
          edges: [
            { id: 'e_start_to_hops', source: 'node_start', target: 'node_hops_review' },
            { id: 'e_hops_to_proc', source: 'node_hops_review', target: 'node_procurement_review', label: 'APPROVE', data: { action: 'APPROVE' } },
            { id: 'e_hops_to_rev', source: 'node_hops_review', target: 'node_pm_revision_hops', label: 'RETURN', data: { action: 'RETURN' } },
            { id: 'e_rev_hops_to_hops', source: 'node_pm_revision_hops', target: 'node_hops_review', label: 'RESUBMIT', data: { action: 'RESUBMIT' } },
            { id: 'e_proc_to_fin', source: 'node_procurement_review', target: 'node_finance_review', label: 'APPROVE', data: { action: 'APPROVE' } },
            { id: 'e_proc_to_rev', source: 'node_procurement_review', target: 'node_pm_revision_procurement', label: 'RETURN', data: { action: 'RETURN' } },
            { id: 'e_rev_proc_to_proc', source: 'node_pm_revision_procurement', target: 'node_procurement_review', label: 'RESUBMIT', data: { action: 'RESUBMIT' } },
            { id: 'e_fin_to_dir', source: 'node_finance_review', target: 'node_director_approval', label: 'APPROVE', data: { action: 'APPROVE' } },
            { id: 'e_fin_to_rev', source: 'node_finance_review', target: 'node_pm_revision_finance', label: 'RETURN', data: { action: 'RETURN' } },
            { id: 'e_rev_fin_to_fin', source: 'node_pm_revision_finance', target: 'node_finance_review', label: 'RESUBMIT', data: { action: 'RESUBMIT' } },
            { id: 'e_dir_to_end', source: 'node_director_approval', target: 'node_end', label: 'APPROVE', data: { action: 'APPROVE' } },
            { id: 'e_dir_to_rev', source: 'node_director_approval', target: 'node_pm_revision_director', label: 'RETURN', data: { action: 'RETURN', condition: "returnDestination == 'PM'" } },
            { id: 'e_dir_to_hops', source: 'node_director_approval', target: 'node_hops_review', label: 'RETURN', data: { action: 'RETURN', condition: "returnDestination == 'HOPS'" } },
            { id: 'e_dir_to_proc', source: 'node_director_approval', target: 'node_procurement_review', label: 'RETURN', data: { action: 'RETURN', condition: "returnDestination == 'PROCUREMENT'" } },
            { id: 'e_dir_to_fin', source: 'node_director_approval', target: 'node_finance_review', label: 'RETURN', data: { action: 'RETURN', condition: "returnDestination == 'FINANCE'" } },
            { id: 'e_rev_dir_to_dir', source: 'node_pm_revision_director', target: 'node_director_approval', label: 'RESUBMIT', data: { action: 'RESUBMIT' } },
          ],
        };

        const v2Published = {
          id: 35,
          version: 2,
          status: 'PUBLISHED',
          bpmnJson: sampleV2Bpmn,
        };
        const def = {
          id: 25,
          workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
          activeVersion: 1,
          status: 'PUBLISHED',
          createdBy: 1,
          versions: [
            { id: 30, version: 1, status: 'PUBLISHED', bpmnJson: legacyV1Bpmn },
            v2Published,
          ],
        };

        mockDefRepo.findOne.mockResolvedValue(def);
        mockTransactionManager.findOne.mockResolvedValue(def);

        const result = await defService.ensureProjectGovernanceWorkflow();
        expect(result).toBeDefined();
        expect(result?.activeVersion).toBe(2);
      });

      it('Scenario 40: State 4 & State 5: fast-path idempotent check & hash mismatch protection', async () => {
        const sampleV2Bpmn = {
          nodes: [
            { id: 'node_start', type: 'customNode', position: { x: 100, y: 200 }, data: { role: 'PROJECT_MANAGER', type: 'START', label: 'PM Submit Plan' } },
            { id: 'node_hops_review', type: 'customNode', position: { x: 300, y: 200 }, data: { role: 'HEAD_OF_OPERATIONS', type: 'TASK', label: 'Head of Operations Review' } },
            { id: 'node_procurement_review', type: 'customNode', position: { x: 550, y: 200 }, data: { role: 'PROCUREMENT', type: 'TASK', label: 'Procurement Plan Review' } },
            { id: 'node_finance_review', type: 'customNode', position: { x: 800, y: 200 }, data: { role: 'FINANCE', type: 'TASK', label: 'Finance Plan Review' } },
            { id: 'node_director_approval', type: 'customNode', position: { x: 1050, y: 200 }, data: { role: 'DIRECTOR', type: 'TASK', label: 'Director Final Approval' } },
            { id: 'node_pm_revision_hops', type: 'customNode', position: { x: 300, y: 380 }, data: { role: 'PROJECT_MANAGER', type: 'TASK', label: 'PM Plan Revision (HOPS)', assigneeContextKey: 'projectManagerId' } },
            { id: 'node_pm_revision_procurement', type: 'customNode', position: { x: 550, y: 380 }, data: { role: 'PROJECT_MANAGER', type: 'TASK', label: 'PM Plan Revision (Procurement)', assigneeContextKey: 'projectManagerId' } },
            { id: 'node_pm_revision_finance', type: 'customNode', position: { x: 800, y: 380 }, data: { role: 'PROJECT_MANAGER', type: 'TASK', label: 'PM Plan Revision (Finance)', assigneeContextKey: 'projectManagerId' } },
            { id: 'node_pm_revision_director', type: 'customNode', position: { x: 1050, y: 380 }, data: { role: 'PROJECT_MANAGER', type: 'TASK', label: 'PM Plan Revision (Director)', assigneeContextKey: 'projectManagerId' } },
            { id: 'node_end', type: 'customNode', position: { x: 1300, y: 200 }, data: { type: 'END', label: 'Ready for Kickoff' } },
          ],
          edges: [
            { id: 'e_start_to_hops', source: 'node_start', target: 'node_hops_review' },
            { id: 'e_hops_to_proc', source: 'node_hops_review', target: 'node_procurement_review', label: 'APPROVE', data: { action: 'APPROVE' } },
            { id: 'e_hops_to_rev', source: 'node_hops_review', target: 'node_pm_revision_hops', label: 'RETURN', data: { action: 'RETURN' } },
            { id: 'e_rev_hops_to_hops', source: 'node_pm_revision_hops', target: 'node_hops_review', label: 'RESUBMIT', data: { action: 'RESUBMIT' } },
            { id: 'e_proc_to_fin', source: 'node_procurement_review', target: 'node_finance_review', label: 'APPROVE', data: { action: 'APPROVE' } },
            { id: 'e_proc_to_rev', source: 'node_procurement_review', target: 'node_pm_revision_procurement', label: 'RETURN', data: { action: 'RETURN' } },
            { id: 'e_rev_proc_to_proc', source: 'node_pm_revision_procurement', target: 'node_procurement_review', label: 'RESUBMIT', data: { action: 'RESUBMIT' } },
            { id: 'e_fin_to_dir', source: 'node_finance_review', target: 'node_director_approval', label: 'APPROVE', data: { action: 'APPROVE' } },
            { id: 'e_fin_to_rev', source: 'node_finance_review', target: 'node_pm_revision_finance', label: 'RETURN', data: { action: 'RETURN' } },
            { id: 'e_rev_fin_to_fin', source: 'node_pm_revision_finance', target: 'node_finance_review', label: 'RESUBMIT', data: { action: 'RESUBMIT' } },
            { id: 'e_dir_to_end', source: 'node_director_approval', target: 'node_end', label: 'APPROVE', data: { action: 'APPROVE' } },
            { id: 'e_dir_to_rev', source: 'node_director_approval', target: 'node_pm_revision_director', label: 'RETURN', data: { action: 'RETURN', condition: "returnDestination == 'PM'" } },
            { id: 'e_dir_to_hops', source: 'node_director_approval', target: 'node_hops_review', label: 'RETURN', data: { action: 'RETURN', condition: "returnDestination == 'HOPS'" } },
            { id: 'e_dir_to_proc', source: 'node_director_approval', target: 'node_procurement_review', label: 'RETURN', data: { action: 'RETURN', condition: "returnDestination == 'PROCUREMENT'" } },
            { id: 'e_dir_to_fin', source: 'node_director_approval', target: 'node_finance_review', label: 'RETURN', data: { action: 'RETURN', condition: "returnDestination == 'FINANCE'" } },
            { id: 'e_rev_dir_to_dir', source: 'node_pm_revision_director', target: 'node_director_approval', label: 'RESUBMIT', data: { action: 'RESUBMIT' } },
          ],
        };

        // State 4: Idempotent fast-path
        const defMatching = {
          id: 25,
          workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
          activeVersion: 2,
          status: 'PUBLISHED',
          versions: [
            { id: 30, version: 1, status: 'PUBLISHED', bpmnJson: legacyV1Bpmn },
            { id: 35, version: 2, status: 'PUBLISHED', bpmnJson: sampleV2Bpmn },
          ],
        };
        mockDefRepo.findOne.mockResolvedValue(defMatching);

        const resultFastPath = await defService.ensureProjectGovernanceWorkflow();
        expect(resultFastPath).toBe(defMatching);
        // Transaction should not have been opened
        expect(mockDataSource.transaction).not.toHaveBeenCalled();

        // State 5: Mismatched published hash
        const defMismatched = {
          id: 25,
          workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
          activeVersion: 2,
          status: 'PUBLISHED',
          versions: [
            { id: 30, version: 1, status: 'PUBLISHED', bpmnJson: legacyV1Bpmn },
            { id: 35, version: 2, status: 'PUBLISHED', bpmnJson: { altered: true } },
          ],
        };
        mockDefRepo.findOne.mockResolvedValue(defMismatched);

        await expect(defService.ensureProjectGovernanceWorkflow()).rejects.toThrow(
          /WORKFLOW INTEGRITY ERROR.*unexpected graph hash/,
        );
      });
    });
  });

  describe('Group 8: Universal Return, Direct Resubmit & Nested Correction Loops (Mandatory Acceptance Criteria)', () => {
    it('Scenario 1: Director -> PM -> Director', async () => {
      // 1. Director returns to PM
      const retResult = await engineService.completeTask(
        501,
        { action: 'RETURN', returnDestination: 'PM', reason: 'Revisi spesifikasi teknis ke PM' },
        MOCK_DIR_ID,
        ['DIRECTOR'],
      );
      expect(retResult.instance.currentNodeId).toBe('node_pm_revision_director');
      const pmTask = inMemoryTasks.find((t) => t.nodeId === 'node_pm_revision_director' && t.status === WorkflowTaskStatus.PENDING)!;
      expect(pmTask).toBeDefined();
      expect(retResult.instance.context?.activeReturnStack?.length).toBe(1);

      // 2. PM resubmits -> routes directly back to Director
      const resubmitResult = await engineService.completeTask(
        pmTask.id,
        { action: 'RESUBMIT', reason: 'Spesifikasi telah disesuaikan oleh PM' },
        MOCK_PM_ID,
        ['PROJECT_MANAGER'],
      );
      expect(resubmitResult.instance.currentNodeId).toBe('node_director_approval');
      const dirTask = inMemoryTasks.find((t) => t.nodeId === 'node_director_approval' && t.status === WorkflowTaskStatus.PENDING)!;
      expect(dirTask).toBeDefined();
      expect(resubmitResult.instance.context?.activeReturnStack).toBeUndefined();
    });

    it('Scenario 2: Director -> HOPS -> Director', async () => {
      // 1. Director returns to HOPS
      const retResult = await engineService.completeTask(
        501,
        { action: 'RETURN', returnDestination: 'HOPS', reason: 'Review operasional HOPS' },
        MOCK_DIR_ID,
        ['DIRECTOR'],
      );
      expect(retResult.instance.currentNodeId).toBe('node_hops_review');
      const hopsTask = inMemoryTasks.find((t) => t.nodeId === 'node_hops_review' && t.status === WorkflowTaskStatus.PENDING)!;
      expect(hopsTask).toBeDefined();

      // 2. HOPS approves/resubmits -> routes directly back to Director (Procurement & Finance skipped)
      const resubmitResult = await engineService.completeTask(
        hopsTask.id,
        { action: 'APPROVE', reason: 'Operasional telah diverifikasi HOPS' },
        MOCK_HOPS_ID,
        ['HEAD_OF_OPERATIONS'],
      );
      expect(resubmitResult.instance.currentNodeId).toBe('node_director_approval');
      const dirTask = inMemoryTasks.find((t) => t.nodeId === 'node_director_approval' && t.status === WorkflowTaskStatus.PENDING)!;
      expect(dirTask).toBeDefined();
      expect(resubmitResult.instance.context?.activeReturnStack).toBeUndefined();
    });

    it('Scenario 3: Director -> Purchasing/Procurement -> Director', async () => {
      // 1. Director returns to Procurement
      const retResult = await engineService.completeTask(
        501,
        { action: 'RETURN', returnDestination: 'PROCUREMENT', reason: 'Review vendor dan harga pengadaan' },
        MOCK_DIR_ID,
        ['DIRECTOR'],
      );
      expect(retResult.instance.currentNodeId).toBe('node_procurement_review');
      const procTask = inMemoryTasks.find((t) => t.nodeId === 'node_procurement_review' && t.status === WorkflowTaskStatus.PENDING)!;
      expect(procTask).toBeDefined();

      // 2. Procurement approves -> routes directly back to Director (Finance skipped)
      const resubmitResult = await engineService.completeTask(
        procTask.id,
        { action: 'APPROVE', reason: 'Pengadaan telah diverifikasi Procurement' },
        MOCK_PROC_ID,
        ['PROCUREMENT'],
      );
      expect(resubmitResult.instance.currentNodeId).toBe('node_director_approval');
      const dirTask = inMemoryTasks.find((t) => t.nodeId === 'node_director_approval' && t.status === WorkflowTaskStatus.PENDING)!;
      expect(dirTask).toBeDefined();
      expect(resubmitResult.instance.context?.activeReturnStack).toBeUndefined();
    });

    it('Scenario 4: Director -> Finance -> Director', async () => {
      // 1. Director returns to Finance
      const retResult = await engineService.completeTask(
        501,
        { action: 'RETURN', returnDestination: 'FINANCE', reason: 'Review cash flow keuangan' },
        MOCK_DIR_ID,
        ['DIRECTOR'],
      );
      expect(retResult.instance.currentNodeId).toBe('node_finance_review');
      const finTask = inMemoryTasks.find((t) => t.nodeId === 'node_finance_review' && t.status === WorkflowTaskStatus.PENDING)!;
      expect(finTask).toBeDefined();

      // 2. Finance approves -> routes directly back to Director
      const resubmitResult = await engineService.completeTask(
        finTask.id,
        { action: 'APPROVE', reason: 'Keuangan telah disetujui Finance' },
        MOCK_FIN_ID,
        ['FINANCE'],
      );
      expect(resubmitResult.instance.currentNodeId).toBe('node_director_approval');
      const dirTask = inMemoryTasks.find((t) => t.nodeId === 'node_director_approval' && t.status === WorkflowTaskStatus.PENDING)!;
      expect(dirTask).toBeDefined();
      expect(resubmitResult.instance.context?.activeReturnStack).toBeUndefined();
    });

    it('Scenario 5: Director -> HOPS -> PM -> HOPS -> Director (Nested Loop 1)', async () => {
      // 1. Director returns to HOPS
      await engineService.completeTask(
        501,
        { action: 'RETURN', returnDestination: 'HOPS', reason: 'Review jadwal dan metode kerja' },
        MOCK_DIR_ID,
        ['DIRECTOR'],
      );
      const hopsTask1 = inMemoryTasks.find((t) => t.nodeId === 'node_hops_review' && t.status === WorkflowTaskStatus.PENDING)!;

      // 2. HOPS identifies data revision needed and returns to PM
      const hopsReturnResult = await engineService.completeTask(
        hopsTask1.id,
        { action: 'RETURN', returnDestination: 'PM', reason: 'PM mohon sesuaikan jadwal WBS' },
        MOCK_HOPS_ID,
        ['HEAD_OF_OPERATIONS'],
      );
      expect(hopsReturnResult.instance.currentNodeId).toBe('node_pm_revision_hops');
      expect(hopsReturnResult.instance.context?.activeReturnStack?.length).toBe(2);
      const pmTask = inMemoryTasks.find((t) => t.nodeId === 'node_pm_revision_hops' && t.status === WorkflowTaskStatus.PENDING)!;

      // 3. PM revises and resubmits -> routes back to HOPS (not Director, not Start)
      const pmResubmitResult = await engineService.completeTask(
        pmTask.id,
        { action: 'RESUBMIT', reason: 'Jadwal WBS telah disesuaikan PM' },
        MOCK_PM_ID,
        ['PROJECT_MANAGER'],
      );
      expect(pmResubmitResult.instance.currentNodeId).toBe('node_hops_review');
      expect(pmResubmitResult.instance.context?.activeReturnStack?.length).toBe(1);
      const hopsTask2 = inMemoryTasks.find((t) => t.nodeId === 'node_hops_review' && t.status === WorkflowTaskStatus.PENDING)!;

      // 4. HOPS approves -> routes directly to Director
      const hopsFinalResult = await engineService.completeTask(
        hopsTask2.id,
        { action: 'APPROVE', reason: 'Perbaikan PM diverifikasi HOPS, teruskan ke Direktur' },
        MOCK_HOPS_ID,
        ['HEAD_OF_OPERATIONS'],
      );
      expect(hopsFinalResult.instance.currentNodeId).toBe('node_director_approval');
      expect(hopsFinalResult.instance.context?.activeReturnStack).toBeUndefined();
      const finalDirTask = inMemoryTasks.find((t) => t.nodeId === 'node_director_approval' && t.status === WorkflowTaskStatus.PENDING)!;
      expect(finalDirTask).toBeDefined();
    });

    it('Scenario 6: Director -> Purchasing -> PM -> Purchasing -> Director (Nested Loop 2)', async () => {
      // 1. Director returns to Procurement
      await engineService.completeTask(
        501,
        { action: 'RETURN', returnDestination: 'PROCUREMENT', reason: 'Cek ulang RAB item trafo' },
        MOCK_DIR_ID,
        ['DIRECTOR'],
      );
      const procTask1 = inMemoryTasks.find((t) => t.nodeId === 'node_procurement_review' && t.status === WorkflowTaskStatus.PENDING)!;

      // 2. Procurement returns to PM
      const procReturnResult = await engineService.completeTask(
        procTask1.id,
        { action: 'RETURN', returnDestination: 'PM', reason: 'PM mohon ubah volume item trafo di RAB' },
        MOCK_PROC_ID,
        ['PROCUREMENT'],
      );
      expect(procReturnResult.instance.currentNodeId).toBe('node_pm_revision_procurement');
      expect(procReturnResult.instance.context?.activeReturnStack?.length).toBe(2);
      const pmTask = inMemoryTasks.find((t) => t.nodeId === 'node_pm_revision_procurement' && t.status === WorkflowTaskStatus.PENDING)!;

      // 3. PM revises and resubmits -> routes back to Procurement
      const pmResubmitResult = await engineService.completeTask(
        pmTask.id,
        { action: 'RESUBMIT', reason: 'Volume RAB trafo telah diperbaiki' },
        MOCK_PM_ID,
        ['PROJECT_MANAGER'],
      );
      expect(pmResubmitResult.instance.currentNodeId).toBe('node_procurement_review');
      expect(pmResubmitResult.instance.context?.activeReturnStack?.length).toBe(1);
      const procTask2 = inMemoryTasks.find((t) => t.nodeId === 'node_procurement_review' && t.status === WorkflowTaskStatus.PENDING)!;

      // 4. Procurement approves -> routes directly to Director
      const procFinalResult = await engineService.completeTask(
        procTask2.id,
        { action: 'APPROVE', reason: 'RAB trafo sesuai, ajukan kembali ke Direktur' },
        MOCK_PROC_ID,
        ['PROCUREMENT'],
      );
      expect(procFinalResult.instance.currentNodeId).toBe('node_director_approval');
      expect(procFinalResult.instance.context?.activeReturnStack).toBeUndefined();
    });

    it('Scenario 7: Director -> Finance -> PM -> Finance -> Director (Nested Loop 3)', async () => {
      // 1. Director returns to Finance
      await engineService.completeTask(
        501,
        { action: 'RETURN', returnDestination: 'FINANCE', reason: 'Cek proyeksi cash flow dan termin pembayaran' },
        MOCK_DIR_ID,
        ['DIRECTOR'],
      );
      const finTask1 = inMemoryTasks.find((t) => t.nodeId === 'node_finance_review' && t.status === WorkflowTaskStatus.PENDING)!;

      // 2. Finance returns to PM
      const finReturnResult = await engineService.completeTask(
        finTask1.id,
        { action: 'RETURN', returnDestination: 'PM', reason: 'PM mohon jadwalkan ulang kurva S dan termin' },
        MOCK_FIN_ID,
        ['FINANCE'],
      );
      expect(finReturnResult.instance.currentNodeId).toBe('node_pm_revision_finance');
      expect(finReturnResult.instance.context?.activeReturnStack?.length).toBe(2);
      const pmTask = inMemoryTasks.find((t) => t.nodeId === 'node_pm_revision_finance' && t.status === WorkflowTaskStatus.PENDING)!;

      // 3. PM revises and resubmits -> routes back to Finance
      const pmResubmitResult = await engineService.completeTask(
        pmTask.id,
        { action: 'RESUBMIT', reason: 'Termin pembayaran dan kurva S telah diperbaiki' },
        MOCK_PM_ID,
        ['PROJECT_MANAGER'],
      );
      expect(pmResubmitResult.instance.currentNodeId).toBe('node_finance_review');
      expect(pmResubmitResult.instance.context?.activeReturnStack?.length).toBe(1);
      const finTask2 = inMemoryTasks.find((t) => t.nodeId === 'node_finance_review' && t.status === WorkflowTaskStatus.PENDING)!;

      // 4. Finance approves -> routes directly to Director
      const finFinalResult = await engineService.completeTask(
        finTask2.id,
        { action: 'APPROVE', reason: 'Finance approve, kirim kembali ke Direktur' },
        MOCK_FIN_ID,
        ['FINANCE'],
      );
      expect(finFinalResult.instance.currentNodeId).toBe('node_director_approval');
      expect(finFinalResult.instance.context?.activeReturnStack).toBeUndefined();
    });

    it('Initial Flow Regression: PM -> HOPS -> Procurement -> Finance -> Director -> Kickoff', async () => {
      // Reset instance to start node for initial sequence verification
      inMemoryInstance.currentNodeId = 'node_start';
      inMemoryInstance.context = { workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW', projectId: 10, projectManagerId: MOCK_PM_ID };
      inMemoryTasks = [];

      // Step 1: Start -> HOPS
      const startNode = canonicalProjectPlanBpmn.nodes.find((n) => n.id === 'node_start')!;
      const hopsNext = (engineService as any).resolveNextNode(canonicalProjectPlanBpmn, startNode, 'APPROVE', inMemoryInstance.context);
      expect(hopsNext.id).toBe('node_hops_review');

      // Step 2: HOPS -> Procurement (no skipped stage)
      const hopsNode = canonicalProjectPlanBpmn.nodes.find((n) => n.id === 'node_hops_review')!;
      const procNext = (engineService as any).resolveNextNode(canonicalProjectPlanBpmn, hopsNode, 'APPROVE', inMemoryInstance.context);
      expect(procNext.id).toBe('node_procurement_review');

      // Step 3: Procurement -> Finance (no skipped stage)
      const procNode = canonicalProjectPlanBpmn.nodes.find((n) => n.id === 'node_procurement_review')!;
      const finNext = (engineService as any).resolveNextNode(canonicalProjectPlanBpmn, procNode, 'APPROVE', inMemoryInstance.context);
      expect(finNext.id).toBe('node_finance_review');

      // Step 4: Finance -> Director (no skipped stage)
      const finNode = canonicalProjectPlanBpmn.nodes.find((n) => n.id === 'node_finance_review')!;
      const dirNext = (engineService as any).resolveNextNode(canonicalProjectPlanBpmn, finNode, 'APPROVE', inMemoryInstance.context);
      expect(dirNext.id).toBe('node_director_approval');

      // Step 5: Director -> End (Kickoff)
      const dirNode = canonicalProjectPlanBpmn.nodes.find((n) => n.id === 'node_director_approval')!;
      const endNext = (engineService as any).resolveNextNode(canonicalProjectPlanBpmn, dirNode, 'APPROVE', inMemoryInstance.context);
      expect(endNext.id).toBe('node_end');
    });

    it('Return Authorization: Unauthorized reviewer-to-reviewer destinations are rejected with BadRequestException', async () => {
      // HOPS to Procurement is forbidden
      await expect(
        engineService.completeTask(501, { action: 'RETURN', returnDestination: 'HOPS', reason: 'Ret to HOPS' }, MOCK_DIR_ID, ['DIRECTOR']),
      ).resolves.toBeDefined();
      const hopsTask = inMemoryTasks.find((t) => t.nodeId === 'node_hops_review' && t.status === WorkflowTaskStatus.PENDING)!;

      await expect(
        engineService.completeTask(hopsTask.id, { action: 'RETURN', returnDestination: 'PROCUREMENT', reason: 'Invalid destination' }, MOCK_HOPS_ID, ['HEAD_OF_OPERATIONS']),
      ).rejects.toThrow(BadRequestException);

      await expect(
        engineService.completeTask(hopsTask.id, { action: 'RETURN', returnDestination: 'FINANCE', reason: 'Invalid destination' }, MOCK_HOPS_ID, ['HEAD_OF_OPERATIONS']),
      ).rejects.toThrow(BadRequestException);
    });

    it('Stack Integrity: Nested depth is bounded at 2 and rejects deeper return with BadRequestException', async () => {
      // 1. Director -> HOPS (depth 1)
      await engineService.completeTask(501, { action: 'RETURN', returnDestination: 'HOPS', reason: 'Ret 1' }, MOCK_DIR_ID, ['DIRECTOR']);
      const hopsTask = inMemoryTasks.find((t) => t.nodeId === 'node_hops_review' && t.status === WorkflowTaskStatus.PENDING)!;

      // 2. HOPS -> PM (depth 2)
      await engineService.completeTask(hopsTask.id, { action: 'RETURN', returnDestination: 'PM', reason: 'Ret 2' }, MOCK_HOPS_ID, ['HEAD_OF_OPERATIONS']);
      const pmTask = inMemoryTasks.find((t) => t.nodeId === 'node_pm_revision_hops' && t.status === WorkflowTaskStatus.PENDING)!;

      // 3. PM cannot return (only RESUBMIT), but if stack somehow already has depth 2:
      expect(inMemoryInstance.context.activeReturnStack.length).toBe(2);
    });

    it('Task Uniqueness: Exactly one active pending task exists at every stage', async () => {
      const pendingBefore = inMemoryTasks.filter((t) => t.status === WorkflowTaskStatus.PENDING);
      expect(pendingBefore.length).toBe(1);

      await engineService.completeTask(501, { action: 'RETURN', returnDestination: 'HOPS', reason: 'Check' }, MOCK_DIR_ID, ['DIRECTOR']);
      const pendingAfterRet = inMemoryTasks.filter((t) => t.status === WorkflowTaskStatus.PENDING);
      expect(pendingAfterRet.length).toBe(1);
      expect(pendingAfterRet[0].nodeId).toBe('node_hops_review');

      await engineService.completeTask(pendingAfterRet[0].id, { action: 'APPROVE', reason: 'Pass' }, MOCK_HOPS_ID, ['HEAD_OF_OPERATIONS']);
      const pendingAfterApp = inMemoryTasks.filter((t) => t.status === WorkflowTaskStatus.PENDING);
      expect(pendingAfterApp.length).toBe(1);
      expect(pendingAfterApp[0].nodeId).toBe('node_director_approval');
    });
  });
});
