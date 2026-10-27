import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InboxService } from '../inbox.service';
import { FinanceService, EligibleInvoiceObligation } from '../../finance/finance.service';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import { NotificationService } from '../../notification/notification.service';
import { Contract } from '../../../entities/contract.entity';
import { Tender } from '../../../entities/tender.entity';
import { PaymentRequest, PaymentRequestStatus } from '../../../entities/payment-request.entity';
import { ProjectProgressLog } from '../../../entities/project-progress-log.entity';
import { ServiceClaim } from '../../../entities/service-claim.entity';
import { ProjectClosure } from '../../../entities/project-closure.entity';
import { WorkflowTask } from '../../../entities/workflow-task.entity';
import { PurchaseRequest } from '../../../entities/purchase-request.entity';
import { Rfq } from '../../../entities/rfq.entity';
import { PurchaseOrder, PurchaseOrderType } from '../../../entities/purchase-order.entity';
import { GoodsReceipt } from '../../../entities/goods-receipt.entity';
import { PoPaymentTerm, PaymentTermStatus, PaymentTermType } from '../../../entities/po-payment-term.entity';
import { Invoice } from '../../../entities/invoice.entity';

describe('EPMS — PURCHASING → FINANCE TO-DO HANDOFF (Unit Tests)', () => {
  let inboxService: InboxService;
  let financeService: FinanceService;
  let mockPaymentRequestRepo: any;
  let mockClaimRepo: any;

  const mockFinanceService = {
    getEligibleInvoiceObligations: jest.fn(),
    isMaterialTermEligible: jest.fn(),
    isServiceClaimEligible: jest.fn(),
  };

  beforeEach(async () => {
    mockPaymentRequestRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    mockClaimRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const emptyRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
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
        {
          provide: WorkflowEngineService,
          useValue: { getMyTasks: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: NotificationService,
          useValue: { getUnreadCount: jest.fn().mockResolvedValue(0) },
        },
        { provide: FinanceService, useValue: mockFinanceService },
        { provide: getRepositoryToken(Contract), useValue: emptyRepo },
        { provide: getRepositoryToken(Tender), useValue: emptyRepo },
        { provide: getRepositoryToken(PaymentRequest), useValue: mockPaymentRequestRepo },
        { provide: getRepositoryToken(ProjectProgressLog), useValue: emptyRepo },
        { provide: getRepositoryToken(ServiceClaim), useValue: mockClaimRepo },
        { provide: getRepositoryToken(ProjectClosure), useValue: emptyRepo },
        { provide: getRepositoryToken(WorkflowTask), useValue: emptyRepo },
        { provide: getRepositoryToken(PurchaseRequest), useValue: emptyRepo },
        { provide: getRepositoryToken(Rfq), useValue: emptyRepo },
      ],
    }).compile();

    inboxService = module.get<InboxService>(InboxService);
    financeService = module.get<FinanceService>(FinanceService);
    jest.clearAllMocks();
  });

  describe('1. Material PO Invoice Projection', () => {
    it('1. Material PO with no GR -> no CREATE_INVOICE To-Do', async () => {
      mockFinanceService.getEligibleInvoiceObligations.mockResolvedValue([]);
      const todos = await inboxService.getTodos(3, ['FINANCE']);
      const invoiceTodos = todos.filter((t) => t.actionType === 'CREATE_INVOICE');
      expect(invoiceTodos).toHaveLength(0);
    });

    it('2. Material PO with GR below milestone -> no To-Do', async () => {
      mockFinanceService.getEligibleInvoiceObligations.mockResolvedValue([]);
      const todos = await inboxService.getTodos(3, ['FINANCE']);
      expect(todos.filter((t) => t.actionType === 'CREATE_INVOICE')).toHaveLength(0);
    });

    it('3. Material PO with valid fulfillment meeting payment term -> CREATE_INVOICE To-Do', async () => {
      const materialObligation: EligibleInvoiceObligation = {
        obligationId: 'mat-po-11-term-11',
        orderType: 'MATERIAL',
        poId: 11,
        poNumber: 'PO-20261023-002',
        vendorName: 'PT Vendor Material',
        paymentTermId: 11,
        paymentTermName: 'Pelunasan Penuh',
        paymentTermSequence: 1,
        amount: 225000000,
        eligibleAt: new Date('2026-10-23T10:55:50.000Z'),
        actionTarget: '/finance/invoices?tab=ready_pos&poId=11&paymentTermId=11',
      };
      mockFinanceService.getEligibleInvoiceObligations.mockResolvedValue([materialObligation]);

      const todos = await inboxService.getTodos(3, ['FINANCE']);
      const invoiceTodos = todos.filter((t) => t.actionType === 'CREATE_INVOICE');

      expect(invoiceTodos).toHaveLength(1);
      const todo = invoiceTodos[0];
      expect(todo.todoId).toBe('finance-invoice-po-11-term-11');
      expect(todo.actionType).toBe('CREATE_INVOICE');
      expect(todo.assignedRole).toBe('FINANCE');
      expect(todo.entityType).toBe('PURCHASE_ORDER');
      expect(todo.entityId).toBe(11);
      expect(todo.actionTarget).toBe('/finance/invoices?tab=ready_pos&poId=11&paymentTermId=11');
      expect(todo.title).toBe('Buat Invoice PO PO-20261023-002');
      expect(todo.ctaLabel).toBe('Buat Invoice');
    });

    it('4. Role scoping: Non-Finance roles should NOT receive CREATE_INVOICE To-Do', async () => {
      const materialObligation: EligibleInvoiceObligation = {
        obligationId: 'mat-po-11-term-11',
        orderType: 'MATERIAL',
        poId: 11,
        poNumber: 'PO-20261023-002',
        paymentTermId: 11,
        amount: 225000000,
        eligibleAt: new Date(),
        actionTarget: '/finance/invoices?tab=ready_pos&poId=11&paymentTermId=11',
      };
      mockFinanceService.getEligibleInvoiceObligations.mockResolvedValue([materialObligation]);

      const pmTodos = await inboxService.getTodos(2, ['PROJECT_MANAGER']);
      expect(pmTodos.filter((t) => t.actionType === 'CREATE_INVOICE')).toHaveLength(0);

      const procTodos = await inboxService.getTodos(5, ['PROCUREMENT']);
      expect(procTodos.filter((t) => t.actionType === 'CREATE_INVOICE')).toHaveLength(0);

      expect(mockFinanceService.getEligibleInvoiceObligations).not.toHaveBeenCalled();
    });

    it('5. SUPER_ADMIN without FINANCE receives 0 CREATE_INVOICE To-Dos (SoD); multi-role SUPER_ADMIN+FINANCE receives it', async () => {
      const materialObligation: EligibleInvoiceObligation = {
        obligationId: 'mat-po-11-term-11',
        orderType: 'MATERIAL',
        poId: 11,
        poNumber: 'PO-20261023-002',
        paymentTermId: 11,
        amount: 225000000,
        eligibleAt: new Date(),
        actionTarget: '/finance/invoices?tab=ready_pos&poId=11&paymentTermId=11',
      };
      mockFinanceService.getEligibleInvoiceObligations.mockResolvedValue([materialObligation]);

      // SUPER_ADMIN alone: SoD enforced -> 0 invoice todos
      const adminOnlyTodos = await inboxService.getTodos(1, ['SUPER_ADMIN']);
      expect(adminOnlyTodos.filter((t) => t.actionType === 'CREATE_INVOICE')).toHaveLength(0);

      // Multi-role: SUPER_ADMIN + FINANCE -> authorized via legitimate FINANCE role
      const multiRoleTodos = await inboxService.getTodos(1, ['SUPER_ADMIN', 'FINANCE']);
      expect(multiRoleTodos.filter((t) => t.actionType === 'CREATE_INVOICE')).toHaveLength(1);
    });

    it('6. Multiple eligible payment terms on same PO -> separate distinct obligations', async () => {
      const term1: EligibleInvoiceObligation = {
        obligationId: 'mat-po-15-term-1',
        orderType: 'MATERIAL',
        poId: 15,
        poNumber: 'PO-20261023-015',
        paymentTermId: 1,
        paymentTermName: 'Termin 1 (50%)',
        amount: 50000000,
        eligibleAt: new Date(),
        actionTarget: '/finance/invoices?tab=ready_pos&poId=15&paymentTermId=1',
      };
      const term2: EligibleInvoiceObligation = {
        obligationId: 'mat-po-15-term-2',
        orderType: 'MATERIAL',
        poId: 15,
        poNumber: 'PO-20261023-015',
        paymentTermId: 2,
        paymentTermName: 'Termin 2 (50%)',
        amount: 50000000,
        eligibleAt: new Date(),
        actionTarget: '/finance/invoices?tab=ready_pos&poId=15&paymentTermId=2',
      };
      mockFinanceService.getEligibleInvoiceObligations.mockResolvedValue([term1, term2]);

      const todos = await inboxService.getTodos(3, ['FINANCE']);
      const invoiceTodos = todos.filter((t) => t.actionType === 'CREATE_INVOICE');
      expect(invoiceTodos).toHaveLength(2);
      expect(invoiceTodos.map((t) => t.todoId)).toEqual([
        'finance-invoice-po-15-term-1',
        'finance-invoice-po-15-term-2',
      ]);
    });
  });

  describe('2. Service Claim Invoice Projection', () => {
    it('1. ServiceClaim in APPROVED_FOR_INVOICE -> CREATE_INVOICE To-Do for Finance', async () => {
      const serviceObligation: EligibleInvoiceObligation = {
        obligationId: 'srv-claim-5',
        orderType: 'SERVICE',
        poId: 10,
        poNumber: 'PO-20261023-001',
        vendorName: 'PT Jasa Konstruksi',
        serviceClaimId: 5,
        serviceClaimNumber: 'SCL-20261023-001',
        amount: 17029000,
        eligibleAt: new Date('2026-10-23T09:42:47.000Z'),
        actionTarget: '/finance/invoices?tab=ready_pos&poId=10&serviceClaimId=5',
      };
      mockFinanceService.getEligibleInvoiceObligations.mockResolvedValue([serviceObligation]);

      const todos = await inboxService.getTodos(3, ['FINANCE']);
      const invoiceTodos = todos.filter((t) => t.actionType === 'CREATE_INVOICE');

      expect(invoiceTodos).toHaveLength(1);
      const todo = invoiceTodos[0];
      expect(todo.todoId).toBe('finance-invoice-claim-5');
      expect(todo.actionType).toBe('CREATE_INVOICE');
      expect(todo.assignedRole).toBe('FINANCE');
      expect(todo.entityType).toBe('SERVICE_CLAIM');
      expect(todo.entityId).toBe(5);
      expect(todo.actionTarget).toBe('/finance/invoices?tab=ready_pos&poId=10&serviceClaimId=5');
      expect(todo.title).toBe('Buat Invoice Klaim Jasa SCL-20261023-001');
      expect(todo.ctaLabel).toBe('Buat Invoice');
    });

    it('2. Multiple independent approved claims -> separate legitimate To-Dos', async () => {
      const claim1: EligibleInvoiceObligation = {
        obligationId: 'srv-claim-5',
        orderType: 'SERVICE',
        poId: 10,
        poNumber: 'PO-20261023-001',
        serviceClaimId: 5,
        serviceClaimNumber: 'SCL-20261023-001',
        amount: 17029000,
        eligibleAt: new Date(),
        actionTarget: '/finance/invoices?tab=ready_pos&poId=10&serviceClaimId=5',
      };
      const claim2: EligibleInvoiceObligation = {
        obligationId: 'srv-claim-6',
        orderType: 'SERVICE',
        poId: 14,
        poNumber: 'PO-20261023-004',
        serviceClaimId: 6,
        serviceClaimNumber: 'SCL-20261023-002',
        amount: 8500000,
        eligibleAt: new Date(),
        actionTarget: '/finance/invoices?tab=ready_pos&poId=14&serviceClaimId=6',
      };
      mockFinanceService.getEligibleInvoiceObligations.mockResolvedValue([claim1, claim2]);

      const todos = await inboxService.getTodos(3, ['FINANCE']);
      const invoiceTodos = todos.filter((t) => t.actionType === 'CREATE_INVOICE');
      expect(invoiceTodos).toHaveLength(2);
      expect(invoiceTodos.map((t) => t.todoId)).toEqual([
        'finance-invoice-claim-5',
        'finance-invoice-claim-6',
      ]);
    });
  });

  describe('3. Regression Safety for Existing Finance & Procurement To-Dos', () => {
    it('Preserves PAYMENT_REQUEST_REVISION and PROCESS_PAYMENT for Finance', async () => {
      mockPaymentRequestRepo.find.mockResolvedValue([
        {
          id: 101,
          requestNumber: 'PRQ-001',
          status: PaymentRequestStatus.NEEDS_REVISION,
          revisionNotes: 'Perbaiki kwitansi',
          returnedAt: new Date(),
        },
        {
          id: 102,
          requestNumber: 'PRQ-002',
          status: PaymentRequestStatus.APPROVED_FOR_PAYMENT,
          approvedAt: new Date(),
        },
      ]);
      mockFinanceService.getEligibleInvoiceObligations.mockResolvedValue([]);

      const todos = await inboxService.getTodos(3, ['FINANCE']);
      const revisionTodo = todos.find((t) => t.actionType === 'PAYMENT_REQUEST_REVISION');
      const processPaymentTodo = todos.find((t) => t.actionType === 'PROCESS_PAYMENT');

      expect(revisionTodo).toBeDefined();
      expect(revisionTodo?.todoId).toBe('prq-rev-101');
      expect(processPaymentTodo).toBeDefined();
      expect(processPaymentTodo?.todoId).toBe('prq-pay-102');
    });

    it('Preserves PAYMENT_REQUEST_APPROVAL for Director', async () => {
      mockPaymentRequestRepo.find.mockResolvedValue([
        {
          id: 201,
          requestNumber: 'PRQ-201',
          status: PaymentRequestStatus.PENDING_DIRECTOR_APPROVAL,
          submittedAt: new Date(),
        },
      ]);

      const dirTodos = await inboxService.getTodos(4, ['DIRECTOR']);
      const approvalTodo = dirTodos.find((t) => t.actionType === 'PAYMENT_REQUEST_APPROVAL');
      expect(approvalTodo).toBeDefined();
      expect(approvalTodo?.todoId).toBe('prq-201');
    });
  });
});
