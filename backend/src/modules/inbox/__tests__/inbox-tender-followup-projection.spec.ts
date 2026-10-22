import { InboxService } from '../inbox.service';

describe('EPMS — InboxService Marketing Follow-Up To-Do Dynamic Projection Tests', () => {
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
      createQueryBuilder: jest.fn(),
    };
    mockPaymentRequestRepo = { find: jest.fn().mockResolvedValue([]) };
    mockProgressLogRepo = { find: jest.fn().mockResolvedValue([]) };
    mockClaimRepo = { find: jest.fn().mockResolvedValue([]) };
    mockClosureRepo = { find: jest.fn().mockResolvedValue([]) };
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

  it('1. Projects exactly ONE deterministic To-Do for actionable tender assigned to Marketing PIC', async () => {
    const mockTender: any = {
      id: 160,
      title: 'Pengadaan Server DC',
      stage: 'PROPOSAL',
      status: 'IN_PROGRESS',
      marketing_pic_id: 12,
      bid_submission_deadline: '2026-10-19',
      created_at: new Date('2026-10-01T00:00:00Z'),
      customer: { name: 'PT Data Utama' },
    };

    const mockQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockTender]),
    };
    mockTenderRepo.createQueryBuilder.mockReturnValue(mockQb);

    const todos = await inboxService.getTodos(12, ['MARKETING']);

    const followUpTodo = todos.find((t) => t.actionType === 'MARKETING_FOLLOWUP');
    expect(followUpTodo).toBeDefined();
    expect(followUpTodo!.todoId).toBe('tender-followup-160');
    expect(followUpTodo!.sourceType).toBe('DOMAIN_TENDER');
    expect(followUpTodo!.entityType).toBe('TENDER');
    expect(followUpTodo!.entityId).toBe(160);
    expect(followUpTodo!.assignedUserId).toBe(12);
    expect(followUpTodo!.actionTarget).toBe('/sales?tab=1&tenderId=160');
    expect(followUpTodo!.title).toBe('Tindak Lanjut Tender: Pengadaan Server DC');
    expect(followUpTodo!.customerName).toBe('PT Data Utama');
    expect(followUpTodo!.status).toBe('OVERDUE');
    expect(followUpTodo!.createdAt).toBe(new Date('2026-10-01T00:00:00Z').toISOString());

    // ZERO WorkflowTask rows created
    expect(mockTaskRepo.save).not.toHaveBeenCalled();
    expect(mockTaskRepo.create).not.toHaveBeenCalled();
  });

  it('2. Unrelated marketing user query restricts visibility to responsible user only', async () => {
    // When called for user 99, query builder enforces (tender.marketing_pic_id = 99 OR ...)
    const mockQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]), // No tenders assigned to user 99
    };
    mockTenderRepo.createQueryBuilder.mockReturnValue(mockQb);

    const todos = await inboxService.getTodos(99, ['MARKETING']);

    expect(mockQb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('(tender.marketing_pic_id = :userId OR (tender.marketing_pic_id IS NULL AND tender.created_by = :userId))'),
      { userId: 99 },
    );
    const followUpTodo = todos.find((t) => t.actionType === 'MARKETING_FOLLOWUP');
    expect(followUpTodo).toBeUndefined();
  });

  it('3. Null PIC tender falls back to created_by Marketing user', async () => {
    const mockTenderNoPic: any = {
      id: 165,
      title: 'Tender null PIC',
      stage: 'PROPOSAL',
      status: 'IN_PROGRESS',
      marketing_pic_id: null,
      created_by: 12,
      bid_submission_deadline: '2026-10-19',
      created_at: new Date('2026-10-01T00:00:00Z'),
      customer: { name: 'PT Mitra Sukses' },
    };

    const mockQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockTenderNoPic]),
    };
    mockTenderRepo.createQueryBuilder.mockReturnValue(mockQb);

    const todos = await inboxService.getTodos(12, ['MARKETING']);

    const followUpTodo = todos.find((t) => t.actionType === 'MARKETING_FOLLOWUP');
    expect(followUpTodo).toBeDefined();
    expect(followUpTodo!.todoId).toBe('tender-followup-165');
    expect(followUpTodo!.assignedUserId).toBe(12);
  });

  it('4. Terminal tender (WON / LOST) does not produce projected To-Do', async () => {
    const mockWonTender: any = {
      id: 170,
      title: 'Tender Telah Menang',
      stage: 'WON',
      status: 'WON',
      marketing_pic_id: 12,
      bid_submission_deadline: '2026-10-10',
      created_at: new Date('2026-10-01T00:00:00Z'),
    };

    const mockQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockWonTender]),
    };
    mockTenderRepo.createQueryBuilder.mockReturnValue(mockQb);

    const todos = await inboxService.getTodos(12, ['MARKETING']);

    const followUpTodo = todos.find((t) => t.actionType === 'MARKETING_FOLLOWUP');
    expect(followUpTodo).toBeUndefined();
  });
});
