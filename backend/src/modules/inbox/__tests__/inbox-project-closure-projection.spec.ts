import { InboxService } from '../inbox.service';
import { ProjectClosureStatus } from '../../../entities/project-closure.entity';

describe('EPMS — InboxService Project Closure Workflow Task Projection Tests', () => {
  let inboxService: InboxService;
  let mockWorkflowEngineService: any;
  let mockNotificationService: any;
  let mockContractRepo: any;
  let mockTenderRepo: any;
  let mockPaymentRequestRepo: any;
  let mockProgressLogRepo: any;
  let mockClaimRepo: any;
  let mockClosureRepo: any;
  let mockTaskRepo: any;

  beforeEach(() => {
    mockWorkflowEngineService = {
      getMyTasks: jest.fn().mockResolvedValue([]),
    };
    mockNotificationService = {};
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
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };
    mockPaymentRequestRepo = { find: jest.fn().mockResolvedValue([]) };
    mockProgressLogRepo = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };
    mockClaimRepo = { find: jest.fn().mockResolvedValue([]) };
    mockClosureRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    mockTaskRepo = {
      save: jest.fn(),
      create: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };

    inboxService = new InboxService(
      mockWorkflowEngineService,
      mockNotificationService,
      mockContractRepo,
      mockTenderRepo,
      mockPaymentRequestRepo,
      mockProgressLogRepo,
      mockClaimRepo,
      mockClosureRepo,
      mockTaskRepo,
    );
  });

  it('1. HOPS PROJECT_CLOSURE workflow task projects exact canonical actionType and actionTarget with taskId & projectId', async () => {
    mockWorkflowEngineService.getMyTasks.mockResolvedValue([
      {
        id: 701,
        workflowInstance: {
          entityType: 'PROJECT_CLOSURE',
          entityId: 45,
          context: {
            projectId: 12,
            projectCode: 'CONT-20261020-0012',
            projectName: 'Project Fiber Optic Surabaya',
          },
        },
        nodeId: 'node_hoo_review',
        taskKey: 'HOO_REVIEW',
        status: 'PENDING',
        assigneeRole: { name: 'HEAD_OF_OPERATIONS' },
      },
    ]);

    const todos = await inboxService.getTodos(58, ['HEAD_OF_OPERATIONS']);
    const closureTodo = todos.find((t) => t.entityType === 'PROJECT_CLOSURE');

    expect(closureTodo).toBeDefined();
    expect(closureTodo?.sourceType).toBe('WORKFLOW_TASK');
    expect(closureTodo?.taskId).toBe(701);
    expect(closureTodo?.entityId).toBe(45);
    expect(closureTodo?.projectId).toBe(12);
    expect(closureTodo?.actionType).toBe('PROJECT_CLOSURE_HOO_REVIEW');
    expect(closureTodo?.actionTarget).toBe('/governance/tasks?taskId=701&projectId=12');
    expect(closureTodo?.title).toBe('Penutupan Proyek Menunggu Peninjauan');
    expect(closureTodo?.description).toBe(
      'PM telah mengajukan penutupan proyek "Project Fiber Optic Surabaya". Silakan tinjau kelengkapan pengajuan sebelum diteruskan ke Direktur.'
    );
    expect(closureTodo?.ctaLabel).toBe('Tinjau Pengajuan');
  });

  it('2. Director PROJECT_CLOSURE task projects exact canonical actionType and actionTarget with taskId & projectId', async () => {
    mockWorkflowEngineService.getMyTasks.mockResolvedValue([
      {
        id: 802,
        workflowInstance: {
          entityType: 'PROJECT_CLOSURE',
          entityId: 45,
          context: {
            projectId: 12,
            projectCode: 'CONT-20261020-0012',
            projectName: 'Project Fiber Optic Surabaya',
          },
        },
        nodeId: 'node_director_approval',
        taskKey: 'DIRECTOR_APPROVAL',
        status: 'PENDING',
        assigneeRole: { name: 'DIRECTOR' },
      },
    ]);

    const todos = await inboxService.getTodos(4, ['DIRECTOR']);
    const closureTodo = todos.find((t) => t.entityType === 'PROJECT_CLOSURE');

    expect(closureTodo).toBeDefined();
    expect(closureTodo?.sourceType).toBe('WORKFLOW_TASK');
    expect(closureTodo?.taskId).toBe(802);
    expect(closureTodo?.entityId).toBe(45);
    expect(closureTodo?.projectId).toBe(12);
    expect(closureTodo?.actionType).toBe('PROJECT_CLOSURE_DIRECTOR_APPROVAL');
    expect(closureTodo?.actionTarget).toBe('/governance/tasks?taskId=802&projectId=12');
    expect(closureTodo?.title).toBe('Penutupan Proyek Menunggu Persetujuan Anda');
    expect(closureTodo?.description).toBe(
      'Head of Operations telah menyelesaikan peninjauan penutupan proyek "Project Fiber Optic Surabaya" dan meneruskannya kepada Anda untuk keputusan akhir.'
    );
    expect(closureTodo?.ctaLabel).toBe('Tinjau & Beri Keputusan');
  });

  it('3. Generic unrelated WorkflowTask projections remain completely unchanged', async () => {
    mockWorkflowEngineService.getMyTasks.mockResolvedValue([
      {
        id: 903,
        workflowInstance: {
          entityType: 'UNKNOWN_ENTITY_CUSTOM',
          entityId: 99,
        },
        nodeId: 'node_custom',
        taskKey: 'CUSTOM_TASK',
        status: 'PENDING',
        assigneeRole: { name: 'ADMIN' },
      },
    ]);

    const todos = await inboxService.getTodos(1, ['ADMIN']);
    const customTodo = todos.find((t) => t.taskId === 903);

    expect(customTodo).toBeDefined();
    expect(customTodo?.sourceType).toBe('WORKFLOW_TASK');
    expect(customTodo?.entityType).toBe('UNKNOWN_ENTITY_CUSTOM');
    expect(customTodo?.actionType).toBe('CUSTOM_TASK');
    expect(customTodo?.actionTarget).toBeNull();
  });

  it('4. Matching DOMAIN_PROJECT_CLOSURE projection is deduplicated when WORKFLOW_TASK exists', async () => {
    // Both workflow task and domain table closure exist
    mockWorkflowEngineService.getMyTasks.mockResolvedValue([
      {
        id: 701,
        workflowInstance: {
          entityType: 'PROJECT_CLOSURE',
          entityId: 45,
          context: { projectId: 12 },
        },
        nodeId: 'node_hoo_review',
        taskKey: 'PROJECT_CLOSURE_HOO_REVIEW',
        status: 'PENDING',
      },
    ]);

    mockClosureRepo.find.mockResolvedValue([
      {
        id: 45,
        projectId: 12,
        status: ProjectClosureStatus.PENDING_HOO_REVIEW,
        cycleNumber: 1,
        project: { name: 'Project Surabaya' },
      },
    ]);

    const todos = await inboxService.getTodos(58, ['HEAD_OF_OPERATIONS']);
    const closureTodos = todos.filter((t) => t.entityType === 'PROJECT_CLOSURE' && Number(t.entityId) === 45);

    expect(closureTodos).toHaveLength(1);
    expect(closureTodos[0].sourceType).toBe('WORKFLOW_TASK');
    expect(closureTodos[0].taskId).toBe(701);
    expect(closureTodos[0].actionTarget).toBe('/governance/tasks?taskId=701&projectId=12');
  });

  it('5. Standalone DOMAIN_PROJECT_CLOSURE projection is returned if WORKFLOW_TASK does not exist', async () => {
    mockWorkflowEngineService.getMyTasks.mockResolvedValue([]);
    mockClosureRepo.find.mockResolvedValue([
      {
        id: 45,
        projectId: 12,
        status: ProjectClosureStatus.PENDING_HOO_REVIEW,
        cycleNumber: 1,
        project: { name: 'Project Surabaya' },
      },
    ]);

    const todos = await inboxService.getTodos(58, ['HEAD_OF_OPERATIONS']);
    const closureTodos = todos.filter((t) => t.entityType === 'PROJECT_CLOSURE');

    expect(closureTodos).toHaveLength(1);
    expect(closureTodos[0].sourceType).toBe('DOMAIN_PROJECT_CLOSURE');
    expect(closureTodos[0].entityId).toBe(45);
    expect(closureTodos[0].actionType).toBe('PROJECT_CLOSURE_HOO_REVIEW');
  });

  it('6. Missing/invalid projectId context does not produce a fabricated deep-link', async () => {
    mockWorkflowEngineService.getMyTasks.mockResolvedValue([
      {
        id: 702,
        workflowInstance: {
          entityType: 'PROJECT_CLOSURE',
          entityId: 46,
          context: {}, // missing projectId
        },
        nodeId: 'node_hoo_review',
        taskKey: 'HOO_REVIEW',
        status: 'PENDING',
      },
    ]);

    const todos = await inboxService.getTodos(58, ['HEAD_OF_OPERATIONS']);
    const closureTodo = todos.find((t) => t.taskId === 702);

    expect(closureTodo).toBeDefined();
    expect(closureTodo?.projectId).toBeUndefined();
    expect(closureTodo?.actionTarget).toBeNull();
  });

  describe('DASH-REC-001: Project Closure Current-Cycle Deduplication Acceptance Tests', () => {
    it('1. one project, one RETURNED closure -> exactly one revision action for PM', async () => {
      mockWorkflowEngineService.getMyTasks.mockResolvedValue([]);
      mockClosureRepo.find.mockResolvedValue([
        {
          id: 101,
          projectId: 3,
          cycleNumber: 1,
          status: ProjectClosureStatus.RETURNED,
          submittedById: 2,
          project: { id: 3, name: 'Project Alpha', managerId: 2 },
          returnReason: 'Harap perbaiki dokumen BAST',
          returnActor: { fullName: 'Head of Operations' },
        },
      ]);

      const todos = await inboxService.getTodos(2, ['PROJECT_MANAGER']);
      const revisionTodos = todos.filter(
        (t) => t.entityType === 'PROJECT_CLOSURE' && t.actionType === 'PROJECT_CLOSURE_REVISION',
      );

      expect(revisionTodos).toHaveLength(1);
      expect(revisionTodos[0].entityId).toBe(101);
      expect(revisionTodos[0].projectId).toBe(3);
      expect(revisionTodos[0].title).toBe('Pengajuan Penutupan Proyek Perlu Diperbaiki: Project Alpha');
    });

    it('2. one project, two closure cycles: older RETURNED, latest PENDING_HOO_REVIEW -> only latest cycle action projected', async () => {
      mockWorkflowEngineService.getMyTasks.mockResolvedValue([]);
      mockClosureRepo.find.mockResolvedValue([
        {
          id: 101,
          projectId: 3,
          cycleNumber: 1,
          status: ProjectClosureStatus.RETURNED,
          submittedById: 2,
          project: { id: 3, name: 'Project Alpha', managerId: 2 },
          returnReason: 'Harap lengkapi laporan',
        },
        {
          id: 102,
          projectId: 3,
          cycleNumber: 2,
          status: ProjectClosureStatus.PENDING_HOO_REVIEW,
          submittedById: 2,
          project: { id: 3, name: 'Project Alpha', managerId: 2 },
        },
      ]);

      // For PM: latest is PENDING_HOO_REVIEW, so PM has 0 revision actions
      const pmTodos = await inboxService.getTodos(2, ['PROJECT_MANAGER']);
      const pmClosureTodos = pmTodos.filter((t) => t.entityType === 'PROJECT_CLOSURE');
      expect(pmClosureTodos).toHaveLength(0);

      // For HOPS: only latest cycle 2 action projected
      const hopsTodos = await inboxService.getTodos(58, ['HEAD_OF_OPERATIONS']);
      const hopsClosureTodos = hopsTodos.filter((t) => t.entityType === 'PROJECT_CLOSURE');
      expect(hopsClosureTodos).toHaveLength(1);
      expect(hopsClosureTodos[0].entityId).toBe(102);
      expect(hopsClosureTodos[0].actionType).toBe('PROJECT_CLOSURE_HOO_REVIEW');
    });

    it('3. one project, multiple historical RETURNED cycles, latest PENDING_DIRECTOR_APPROVAL -> zero historical revision actions', async () => {
      mockWorkflowEngineService.getMyTasks.mockResolvedValue([]);
      mockClosureRepo.find.mockResolvedValue([
        { id: 4, projectId: 3, cycleNumber: 1, status: ProjectClosureStatus.RETURNED, submittedById: 2, project: { id: 3, managerId: 2 } },
        { id: 6, projectId: 3, cycleNumber: 2, status: ProjectClosureStatus.RETURNED, submittedById: 2, project: { id: 3, managerId: 2 } },
        { id: 7, projectId: 3, cycleNumber: 3, status: ProjectClosureStatus.RETURNED, submittedById: 2, project: { id: 3, managerId: 2 } },
        { id: 8, projectId: 3, cycleNumber: 4, status: ProjectClosureStatus.RETURNED, submittedById: 2, project: { id: 3, managerId: 2 } },
        { id: 9, projectId: 3, cycleNumber: 5, status: ProjectClosureStatus.RETURNED, submittedById: 2, project: { id: 3, managerId: 2 } },
        { id: 10, projectId: 3, cycleNumber: 6, status: ProjectClosureStatus.RETURNED, submittedById: 2, project: { id: 3, managerId: 2 } },
        { id: 11, projectId: 3, cycleNumber: 7, status: ProjectClosureStatus.RETURNED, submittedById: 2, project: { id: 3, managerId: 2 } },
        { id: 12, projectId: 3, cycleNumber: 8, status: ProjectClosureStatus.PENDING_DIRECTOR_APPROVAL, submittedById: 2, project: { id: 3, managerId: 2 } },
      ]);

      // PM has 0 actions (no historical revision actions leaked)
      const pmTodos = await inboxService.getTodos(2, ['PROJECT_MANAGER']);
      const pmRevisionTodos = pmTodos.filter((t) => t.entityType === 'PROJECT_CLOSURE');
      expect(pmRevisionTodos).toHaveLength(0);

      // Director has exactly 1 action (Cycle 8)
      const dirTodos = await inboxService.getTodos(4, ['DIRECTOR']);
      const dirClosureTodos = dirTodos.filter((t) => t.entityType === 'PROJECT_CLOSURE');
      expect(dirClosureTodos).toHaveLength(1);
      expect(dirClosureTodos[0].entityId).toBe(12);
      expect(dirClosureTodos[0].actionType).toBe('PROJECT_CLOSURE_DIRECTOR_APPROVAL');
    });

    it('4. one project, multiple historical cycles, latest RETURNED -> exactly one revision action', async () => {
      mockWorkflowEngineService.getMyTasks.mockResolvedValue([]);
      mockClosureRepo.find.mockResolvedValue([
        { id: 4, projectId: 3, cycleNumber: 1, status: ProjectClosureStatus.RETURNED, submittedById: 2, project: { id: 3, managerId: 2 } },
        { id: 6, projectId: 3, cycleNumber: 2, status: ProjectClosureStatus.RETURNED, submittedById: 2, project: { id: 3, managerId: 2 } },
        { id: 11, projectId: 3, cycleNumber: 7, status: ProjectClosureStatus.RETURNED, submittedById: 2, project: { id: 3, managerId: 2 }, returnReason: 'Catatan revisi cycle 7' },
      ]);

      const todos = await inboxService.getTodos(2, ['PROJECT_MANAGER']);
      const closureTodos = todos.filter((t) => t.entityType === 'PROJECT_CLOSURE');

      expect(closureTodos).toHaveLength(1);
      expect(closureTodos[0].entityId).toBe(11);
      expect(closureTodos[0].actionType).toBe('PROJECT_CLOSURE_REVISION');
      expect(closureTodos[0].returnReason).toBe('Catatan revisi cycle 7');
    });

    it('5. two different projects -> each may independently produce one current action', async () => {
      mockWorkflowEngineService.getMyTasks.mockResolvedValue([]);
      mockClosureRepo.find.mockResolvedValue([
        // Project 3: Cycle 2 is latest (RETURNED)
        { id: 10, projectId: 3, cycleNumber: 1, status: ProjectClosureStatus.RETURNED, submittedById: 2, project: { id: 3, managerId: 2 } },
        { id: 11, projectId: 3, cycleNumber: 2, status: ProjectClosureStatus.RETURNED, submittedById: 2, project: { id: 3, managerId: 2 } },
        // Project 5: Cycle 1 is latest (RETURNED)
        { id: 20, projectId: 5, cycleNumber: 1, status: ProjectClosureStatus.RETURNED, submittedById: 2, project: { id: 5, managerId: 2 } },
      ]);

      const todos = await inboxService.getTodos(2, ['PROJECT_MANAGER']);
      const closureTodos = todos.filter((t) => t.entityType === 'PROJECT_CLOSURE');

      expect(closureTodos).toHaveLength(2);
      expect(closureTodos.map((t) => t.projectId).sort()).toEqual([3, 5]);
      expect(closureTodos.map((t) => t.entityId).sort()).toEqual([11, 20]);
    });

    it('6. existing non-closure Inbox projection unaffected', async () => {
      mockWorkflowEngineService.getMyTasks.mockResolvedValue([
        {
          id: 501,
          workflowInstance: {
            entityType: 'PURCHASE_REQUEST',
            entityId: 99,
            context: { projectId: 7 },
          },
          nodeId: 'node_pr_approval',
          taskKey: 'PURCHASE_REQUEST_APPROVAL',
          status: 'PENDING',
          assigneeRole: { name: 'FINANCE' },
        },
      ]);
      mockClosureRepo.find.mockResolvedValue([]);

      const todos = await inboxService.getTodos(15, ['FINANCE']);
      const prTodo = todos.find((t) => t.entityType === 'PURCHASE_REQUEST');

      expect(prTodo).toBeDefined();
      expect(prTodo?.taskId).toBe(501);
      expect(prTodo?.actionType).toBe('PURCHASE_REQUEST_APPROVAL');
    });

    it('7. no duplicate current Project Closure action per project', async () => {
      // Both Section 1 (WORKFLOW_TASK) and Section 7 have the current closure
      mockWorkflowEngineService.getMyTasks.mockResolvedValue([
        {
          id: 801,
          workflowInstance: {
            entityType: 'PROJECT_CLOSURE',
            entityId: 12,
            context: { projectId: 3 },
          },
          nodeId: 'node_director_approval',
          taskKey: 'DIRECTOR_APPROVAL',
          status: 'PENDING',
          assigneeRole: { name: 'DIRECTOR' },
        },
      ]);
      mockClosureRepo.find.mockResolvedValue([
        {
          id: 12,
          projectId: 3,
          cycleNumber: 8,
          status: ProjectClosureStatus.PENDING_DIRECTOR_APPROVAL,
          submittedById: 2,
          project: { id: 3, managerId: 2 },
        },
      ]);

      const todos = await inboxService.getTodos(4, ['DIRECTOR']);
      const closureTodosForProject3 = todos.filter(
        (t) => t.entityType === 'PROJECT_CLOSURE' && Number(t.projectId) === 3,
      );

      // Exactly 1 action for Project 3, not 2
      expect(closureTodosForProject3).toHaveLength(1);
      expect(closureTodosForProject3[0].sourceType).toBe('WORKFLOW_TASK');
    });
  });
});

