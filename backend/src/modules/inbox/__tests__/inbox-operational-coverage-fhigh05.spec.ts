import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InboxService } from '../inbox.service';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import { NotificationService } from '../../notification/notification.service';
import { FinanceService } from '../../finance/finance.service';
import { Contract } from '../../../entities/contract.entity';
import { Tender } from '../../../entities/tender.entity';
import { PaymentRequest, PaymentRequestStatus } from '../../../entities/payment-request.entity';
import { ProjectProgressLog } from '../../../entities/project-progress-log.entity';
import { ServiceClaim, ServiceClaimStatus } from '../../../entities/service-claim.entity';
import { ProjectClosure } from '../../../entities/project-closure.entity';
import { WorkflowTask } from '../../../entities/workflow-task.entity';
import { PurchaseRequest } from '../../../entities/purchase-request.entity';
import { Rfq } from '../../../entities/rfq.entity';
import { ProcurementPackage, ProcurementPackageStatus } from '../../../entities/procurement-package.entity';
import { Invoice } from '../../../entities/invoice.entity';
import { Project } from '../../../entities/project.entity';

describe('EPMS — FASE 1.8 (F-HIGH-05) OPERATIONAL TO-DO COVERAGE', () => {
  let inboxService: InboxService;
  let mockPackageRepo: any;
  let mockInvoiceRepo: any;
  let mockProjectRepo: any;
  let mockClaimRepo: any;
  let mockPaymentRequestRepo: any;
  let mockWorkflowEngineService: any;

  beforeEach(async () => {
    mockPackageRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    mockInvoiceRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    mockProjectRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    mockClaimRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    mockPaymentRequestRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    mockWorkflowEngineService = {
      getMyTasks: jest.fn().mockResolvedValue([]),
    };

    const emptyRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getRawOne: jest.fn().mockResolvedValue(null),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InboxService,
        { provide: WorkflowEngineService, useValue: mockWorkflowEngineService },
        { provide: NotificationService, useValue: { getUnreadCount: jest.fn().mockResolvedValue(0) } },
        { provide: FinanceService, useValue: { getEligibleInvoiceObligations: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(Contract), useValue: emptyRepo },
        { provide: getRepositoryToken(Tender), useValue: emptyRepo },
        { provide: getRepositoryToken(PaymentRequest), useValue: mockPaymentRequestRepo },
        { provide: getRepositoryToken(ProjectProgressLog), useValue: emptyRepo },
        { provide: getRepositoryToken(ServiceClaim), useValue: mockClaimRepo },
        { provide: getRepositoryToken(ProjectClosure), useValue: emptyRepo },
        { provide: getRepositoryToken(WorkflowTask), useValue: emptyRepo },
        { provide: getRepositoryToken(PurchaseRequest), useValue: emptyRepo },
        { provide: getRepositoryToken(Rfq), useValue: emptyRepo },
        { provide: getRepositoryToken(ProcurementPackage), useValue: mockPackageRepo },
        { provide: getRepositoryToken(Invoice), useValue: mockInvoiceRepo },
        { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
      ],
    }).compile();

    inboxService = module.get<InboxService>(InboxService);
  });

  describe('1. Procurement Package Operational Tasks', () => {
    it('1.1 SUBMITTED package -> Procurement/Purchasing receives REVIEW_PROCUREMENT_PACKAGE', async () => {
      mockPackageRepo.find.mockResolvedValue([
        {
          id: 10,
          packageNumber: 'PKG-202610-001',
          title: 'Paket Besi Beton & Semen',
          totalEstimatedAmount: 75000000,
          status: ProcurementPackageStatus.SUBMITTED,
          projectId: 101,
          project: { id: 101, name: 'Pembangunan RSUD' },
          requester: { id: 7, fullName: 'Budi PM' },
          submittedAt: new Date('2026-10-30T10:00:00Z'),
        },
      ]);

      const procurementTodos = await inboxService.getTodos(5, ['PROCUREMENT']);
      const pkgTodo = procurementTodos.find((t) => t.actionType === 'REVIEW_PROCUREMENT_PACKAGE');

      expect(pkgTodo).toBeDefined();
      expect(pkgTodo?.entityType).toBe('PROCUREMENT_PACKAGE');
      expect(pkgTodo?.entityId).toBe(10);
      expect(pkgTodo?.sourceType).toBe('DOMAIN_PROCUREMENT_PACKAGE');
      expect(pkgTodo?.actionTarget).toBe('/procurement?tab=packages&packageId=10');
      expect(pkgTodo?.title).toContain('PKG-202610-001');
      expect(pkgTodo?.ctaLabel).toBe('Tinjau Paket');
      expect(pkgTodo?.monetaryExposure).toBe(75000000);
    });

    it('1.2 SUBMITTED package -> PM user does NOT receive review task', async () => {
      mockPackageRepo.find.mockResolvedValue([
        {
          id: 10,
          packageNumber: 'PKG-202610-001',
          title: 'Paket Besi Beton & Semen',
          status: ProcurementPackageStatus.SUBMITTED,
          projectId: 101,
          project: { id: 101, name: 'Pembangunan RSUD', managerId: 7 },
        },
      ]);

      const pmTodos = await inboxService.getTodos(7, ['PROJECT_MANAGER']);
      expect(pmTodos.find((t) => t.actionType === 'REVIEW_PROCUREMENT_PACKAGE')).toBeUndefined();
    });

    it('1.3 RETURNED package -> Assigned PM receives REVISE_PROCUREMENT_PACKAGE', async () => {
      mockPackageRepo.find.mockResolvedValue([
        {
          id: 12,
          packageNumber: 'PKG-202610-002',
          title: 'Paket Plumbing & Sanitasi',
          totalEstimatedAmount: 30000000,
          status: ProcurementPackageStatus.RETURNED,
          projectId: 102,
          project: { id: 102, name: 'Renovasi Gedung B', managerId: 8 },
          requestedBy: 8,
          rejectionNotes: 'Spesifikasi pipa PVC tidak sesuai standar teknis.',
          reviewer: { id: 5, fullName: 'Procurement Officer' },
          reviewedAt: new Date('2026-10-30T11:00:00Z'),
        },
      ]);

      const assignedPmTodos = await inboxService.getTodos(8, ['PROJECT_MANAGER']);
      const reviseTodo = assignedPmTodos.find((t) => t.actionType === 'REVISE_PROCUREMENT_PACKAGE');

      expect(reviseTodo).toBeDefined();
      expect(reviseTodo?.entityId).toBe(12);
      expect(reviseTodo?.actionTarget).toBe('/project-delivery?projectId=102');
      expect(reviseTodo?.returnReason).toBe('Spesifikasi pipa PVC tidak sesuai standar teknis.');
      expect(reviseTodo?.returnedByName).toBe('Procurement Officer');
      expect(reviseTodo?.ctaLabel).toBe('Perbaiki Paket');
    });

    it('1.4 RETURNED package -> Non-assigned PM does NOT receive revision task', async () => {
      mockPackageRepo.find.mockResolvedValue([
        {
          id: 12,
          packageNumber: 'PKG-202610-002',
          status: ProcurementPackageStatus.RETURNED,
          projectId: 102,
          project: { id: 102, name: 'Renovasi Gedung B', managerId: 8 },
          requestedBy: 8,
        },
      ]);

      // User 9 is another PM, not assigned to project 102
      const otherPmTodos = await inboxService.getTodos(9, ['PROJECT_MANAGER']);
      expect(otherPmTodos.find((t) => t.actionType === 'REVISE_PROCUREMENT_PACKAGE')).toBeUndefined();
    });
  });

  describe('2. Invoice Verification Operational Tasks', () => {
    it('2.1 PENDING/MISMATCHED Invoice -> Finance receives VERIFY_INVOICE', async () => {
      mockInvoiceRepo.find.mockResolvedValue([
        {
          id: 42,
          invoiceNumber: 'INV-202610-042',
          totalAmount: 50000000,
          matchStatus: 'PENDING',
          status: 'UNPAID',
          poId: 88,
          purchaseOrder: {
            id: 88,
            poNumber: 'PO-202610-088',
            vendor: { id: 15, name: 'PT Semen Perkasa' },
            purchaseRequest: { id: 30, projectId: 201, project: { id: 201, name: 'Pembangunan Jembatan' } },
          },
          createdAt: new Date('2026-10-30T12:00:00Z'),
        },
      ]);

      const financeTodos = await inboxService.getTodos(3, ['FINANCE']);
      const verifyTodo = financeTodos.find((t) => t.actionType === 'VERIFY_INVOICE');

      expect(verifyTodo).toBeDefined();
      expect(verifyTodo?.entityType).toBe('INVOICE');
      expect(verifyTodo?.entityId).toBe(42);
      expect(verifyTodo?.sourceType).toBe('DOMAIN_INVOICE');
      expect(verifyTodo?.actionTarget).toBe('/finance/invoices?tab=invoices_list&invoiceId=42');
      expect(verifyTodo?.title).toContain('INV-202610-042');
      expect(verifyTodo?.ctaLabel).toBe('Verifikasi Tagihan');
      expect(verifyTodo?.monetaryExposure).toBe(50000000);
      expect(verifyTodo?.customerName).toBe('PT Semen Perkasa');
      expect(verifyTodo?.projectName).toBe('Pembangunan Jembatan');
    });

    it('2.2 Non-Finance user does NOT receive VERIFY_INVOICE task', async () => {
      mockInvoiceRepo.find.mockResolvedValue([
        {
          id: 42,
          invoiceNumber: 'INV-202610-042',
          matchStatus: 'PENDING',
          status: 'UNPAID',
        },
      ]);

      const pmTodos = await inboxService.getTodos(7, ['PROJECT_MANAGER']);
      expect(pmTodos.find((t) => t.actionType === 'VERIFY_INVOICE')).toBeUndefined();
    });

    it('2.3 Already VERIFIED or REJECTED or CANCELLED Invoice does NOT generate task', async () => {
      mockInvoiceRepo.find.mockResolvedValue([
        {
          id: 43,
          invoiceNumber: 'INV-202610-043',
          matchStatus: 'VERIFIED',
          status: 'UNPAID',
        },
        {
          id: 44,
          invoiceNumber: 'INV-202610-044',
          matchStatus: 'REJECTED',
          status: 'UNPAID',
        },
        {
          id: 45,
          invoiceNumber: 'INV-202610-045',
          matchStatus: 'PENDING',
          status: 'CANCELLED',
        },
      ]);

      const financeTodos = await inboxService.getTodos(3, ['FINANCE']);
      expect(financeTodos.filter((t) => t.actionType === 'VERIFY_INVOICE')).toHaveLength(0);
    });
  });

  describe('3. Ready-for-Kickoff (Project Formal Kickoff)', () => {
    it('3.1 Project PLANNING with completed Management Review -> Assigned PM receives EXECUTE_KICKOFF', async () => {
      mockProjectRepo.createQueryBuilder.mockReturnValue({
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 202,
            code: 'PRJ-2026-002',
            name: 'Pembangunan Fasilitas Air Bersih',
            status: 'PLANNING',
            managerId: 7,
            updatedAt: new Date('2026-10-30T14:00:00Z'),
          },
        ]),
      });

      const pmTodos = await inboxService.getTodos(7, ['PROJECT_MANAGER']);
      const kickoffTodo = pmTodos.find((t) => t.actionType === 'EXECUTE_KICKOFF');

      expect(kickoffTodo).toBeDefined();
      expect(kickoffTodo?.entityType).toBe('PROJECT');
      expect(kickoffTodo?.entityId).toBe(202);
      expect(kickoffTodo?.sourceType).toBe('DOMAIN_PROJECT');
      expect(kickoffTodo?.actionTarget).toBe('/project-delivery?projectId=202&action=kickoff');
      expect(kickoffTodo?.title).toContain('Pembangunan Fasilitas Air Bersih');
      expect(kickoffTodo?.status).toBe('READY_FOR_KICKOFF');
      expect(kickoffTodo?.ctaLabel).toBe('Formal Kick-Off');
    });

    it('3.2 Non-PM user does NOT receive EXECUTE_KICKOFF', async () => {
      mockProjectRepo.createQueryBuilder.mockReturnValue({
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 202,
            name: 'Pembangunan Fasilitas Air Bersih',
            status: 'PLANNING',
            managerId: 7,
          },
        ]),
      });

      const financeTodos = await inboxService.getTodos(3, ['FINANCE']);
      expect(financeTodos.find((t) => t.actionType === 'EXECUTE_KICKOFF')).toBeUndefined();
    });
  });

  describe('4. Service Claim Segregation of Duties (SoD)', () => {
    it('4.1 PM who submitted the claim is EXCLUDED from technical verification (SoD enforcement)', async () => {
      mockClaimRepo.find.mockResolvedValue([
        {
          id: 55,
          claimNumber: 'CLM-202610-055',
          totalClaimAmount: 15000000,
          status: ServiceClaimStatus.SUBMITTED,
          submittedBy: 7, // User 7 submitted this claim
          poId: 90,
          projectId: 101,
          project: { id: 101, name: 'Pembangunan RSUD', managerId: 7 }, // User 7 is also assigned PM
          purchaseOrder: { id: 90, poNumber: 'PO-90' },
        },
      ]);

      // Self-submitting PM (User 7) must NOT receive verification task
      const selfSubmittingPmTodos = await inboxService.getTodos(7, ['PROJECT_MANAGER']);
      expect(selfSubmittingPmTodos.find((t) => t.actionType === 'SERVICE_CLAIM_VERIFICATION')).toBeUndefined();
    });

    it('4.2 Non-submitter assigned PM DOES receive technical verification task', async () => {
      mockClaimRepo.find.mockResolvedValue([
        {
          id: 56,
          claimNumber: 'CLM-202610-056',
          totalClaimAmount: 20000000,
          status: ServiceClaimStatus.SUBMITTED,
          submittedBy: 12, // Submitter is User 12 (vendor/staff)
          poId: 91,
          projectId: 101,
          project: { id: 101, name: 'Pembangunan RSUD', managerId: 7 }, // Assigned PM is User 7
          purchaseOrder: { id: 91, poNumber: 'PO-91' },
          submittedAt: new Date('2026-10-30T13:00:00Z'),
        },
      ]);

      const assignedPmTodos = await inboxService.getTodos(7, ['PROJECT_MANAGER']);
      const verificationTodo = assignedPmTodos.find((t) => t.actionType === 'SERVICE_CLAIM_VERIFICATION');

      expect(verificationTodo).toBeDefined();
      expect(verificationTodo?.entityId).toBe(56);
      expect(verificationTodo?.ctaLabel).toBe('Verifikasi Teknis');
    });

    it('4.3 PM_VERIFIED claim -> Procurement receives SERVICE_CLAIM_COMMERCIAL_APPROVAL', async () => {
      mockClaimRepo.find.mockResolvedValue([
        {
          id: 57,
          claimNumber: 'CLM-202610-057',
          totalClaimAmount: 25000000,
          status: ServiceClaimStatus.PM_VERIFIED,
          poId: 92,
          projectId: 101,
          project: { id: 101, name: 'Pembangunan RSUD' },
          purchaseOrder: { id: 92, poNumber: 'PO-92' },
          pmVerifiedAt: new Date('2026-10-30T14:00:00Z'),
        },
      ]);

      const procurementTodos = await inboxService.getTodos(5, ['PROCUREMENT']);
      const commTodo = procurementTodos.find((t) => t.actionType === 'SERVICE_CLAIM_COMMERCIAL_APPROVAL');

      expect(commTodo).toBeDefined();
      expect(commTodo?.entityId).toBe(57);
      expect(commTodo?.ctaLabel).toBe('Persetujuan Komersial');
    });

    it('4.4 NEEDS_REVISION claim -> Submitter receives SERVICE_CLAIM_REVISION routing to /procurement', async () => {
      mockClaimRepo.find.mockResolvedValue([
        {
          id: 58,
          claimNumber: 'CLM-202610-058',
          totalClaimAmount: 18000000,
          status: ServiceClaimStatus.NEEDS_REVISION,
          submittedBy: 12,
          poId: 93,
          projectId: 101,
          project: { id: 101, name: 'Pembangunan RSUD' },
          purchaseOrder: { id: 93, poNumber: 'PO-93' },
          notes: 'Mohon revisi volume opname item 2.',
          updatedAt: new Date('2026-10-30T15:00:00Z'),
        },
      ]);

      const submitterTodos = await inboxService.getTodos(12, ['PROCUREMENT']);
      const revTodo = submitterTodos.find((t) => t.actionType === 'SERVICE_CLAIM_REVISION');

      expect(revTodo).toBeDefined();
      expect(revTodo?.entityId).toBe(58);
      expect(revTodo?.ctaLabel).toBe('Perbaiki Klaim');
      expect(revTodo?.actionTarget).toBe('/procurement?tab=po&poId=93&claimId=58&action=service-claim');
    });
  });

  describe('5. Payment Request Lifecycle & Role Separation', () => {
    it('5.1 Director receives PAYMENT_REQUEST_APPROVAL for PENDING_DIRECTOR_APPROVAL', async () => {
      mockPaymentRequestRepo.find.mockResolvedValue([
        {
          id: 70,
          requestNumber: 'PRQ-202610-070',
          requestedAmount: 100000000,
          status: PaymentRequestStatus.PENDING_DIRECTOR_APPROVAL,
          requestedBy: 3,
          invoiceId: 50,
          invoice: { id: 50, invoiceNumber: 'INV-50', purchaseOrder: { poNumber: 'PO-50' } },
          submittedAt: new Date('2026-10-30T15:00:00Z'),
        },
      ]);

      const directorTodos = await inboxService.getTodos(2, ['DIRECTOR']);
      const approvalTodo = directorTodos.find((t) => t.actionType === 'PAYMENT_REQUEST_APPROVAL');

      expect(approvalTodo).toBeDefined();
      expect(approvalTodo?.entityId).toBe(70);
      expect(approvalTodo?.assignedRole).toBe('DIRECTOR');
      expect(approvalTodo?.ctaLabel).toBe('Setujui / Tolak');
    });

    it('5.2 Finance receives PAYMENT_REQUEST_REVISION for NEEDS_REVISION with assignedUserId', async () => {
      mockPaymentRequestRepo.find.mockResolvedValue([
        {
          id: 71,
          requestNumber: 'PRQ-202610-071',
          requestedAmount: 40000000,
          status: PaymentRequestStatus.NEEDS_REVISION,
          requestedBy: 3,
          revisionNotes: 'Lampiran faktur pajak belum lengkap.',
          approver: { id: 2, fullName: 'Direktur Utama' },
          returnedAt: new Date('2026-10-30T16:00:00Z'),
        },
      ]);

      const financeTodos = await inboxService.getTodos(3, ['FINANCE']);
      const revisionTodo = financeTodos.find((t) => t.actionType === 'PAYMENT_REQUEST_REVISION');

      expect(revisionTodo).toBeDefined();
      expect(revisionTodo?.entityId).toBe(71);
      expect(revisionTodo?.assignedUserId).toBe(3);
      expect(revisionTodo?.returnReason).toBe('Lampiran faktur pajak belum lengkap.');
      expect(revisionTodo?.returnedByName).toBe('Direktur Utama');
      expect(revisionTodo?.ctaLabel).toBe('Perbaiki Pengajuan');
    });

    it('5.3 Finance receives PROCESS_PAYMENT for APPROVED_FOR_PAYMENT; Director does NOT receive it', async () => {
      mockPaymentRequestRepo.find.mockResolvedValue([
        {
          id: 72,
          requestNumber: 'PRQ-202610-072',
          requestedAmount: 60000000,
          status: PaymentRequestStatus.APPROVED_FOR_PAYMENT,
          approvedAt: new Date('2026-10-30T17:00:00Z'),
        },
      ]);

      const financeTodos = await inboxService.getTodos(3, ['FINANCE']);
      const payTodo = financeTodos.find((t) => t.actionType === 'PROCESS_PAYMENT');
      expect(payTodo).toBeDefined();
      expect(payTodo?.ctaLabel).toBe('Bayar Tagihan');

      const directorTodos = await inboxService.getTodos(2, ['DIRECTOR']);
      expect(directorTodos.find((t) => t.actionType === 'PROCESS_PAYMENT')).toBeUndefined();
    });
  });

  describe('6. Transitional Deduplication with WORKFLOW_TASK', () => {
    it('6.1 Suppresses domain queue projection when matching WORKFLOW_TASK already exists', async () => {
      // Workflow engine already has task for package 10
      mockWorkflowEngineService.getMyTasks.mockResolvedValue([
        {
          id: 999,
          taskKey: 'REVIEW_PROCUREMENT_PACKAGE',
          status: 'PENDING',
          workflowInstance: {
            id: 888,
            entityType: 'PROCUREMENT_PACKAGE',
            entityId: 10,
          },
        },
      ]);

      mockPackageRepo.find.mockResolvedValue([
        {
          id: 10,
          packageNumber: 'PKG-202610-001',
          status: ProcurementPackageStatus.SUBMITTED,
        },
      ]);

      const todos = await inboxService.getTodos(5, ['PROCUREMENT']);
      const pkgTodos = todos.filter((t) => Number(t.entityId) === 10);

      // Exactly ONE task should exist (the authoritative WORKFLOW_TASK), domain projection suppressed
      expect(pkgTodos).toHaveLength(1);
      expect(pkgTodos[0].sourceType).toBe('WORKFLOW_TASK');
    });
  });
});

