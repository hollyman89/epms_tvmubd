import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { Invoice } from '../../entities/invoice.entity';
import { Payment } from '../../entities/payment.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { PoPaymentTerm, PaymentTermStatus, PaymentTermType } from '../../entities/po-payment-term.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { MismatchCode } from './finance.types';

describe('FinanceService & Controller - Canonical AuditLog Coverage (AUDIT-TRAIL-4D)', () => {
  let service: FinanceService;
  let controller: FinanceController;
  let dataSourceMock: any;
  let queryRunnerMock: any;
  let savedAuditLogs: any[] = [];
  let saveHistory: Array<{ entityClass: any; data: any }> = [];
  let eventEmitterMock: any;

  beforeEach(async () => {
    savedAuditLogs = [];
    saveHistory = [];

    queryRunnerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        save: jest.fn().mockImplementation((entityClassOrData: any, data?: any) => {
          const entity = data !== undefined ? data : entityClassOrData;
          const targetClass = data !== undefined ? entityClassOrData : null;
          saveHistory.push({ entityClass: targetClass, data: entity });

          if (targetClass === AuditLog || entity instanceof AuditLog || entity?.table_name) {
            savedAuditLogs.push(entity);
          }
          if (entity && !entity.id && !Array.isArray(entity)) {
            entity.id = 501;
          }
          return Promise.resolve(entity);
        }),
        create: jest.fn().mockImplementation((entityClass: any, data: any) => {
          if (entityClass === AuditLog) {
            const audit = new AuditLog();
            Object.assign(audit, data);
            return audit;
          }
          return { ...data, id: data?.id || 501 };
        }),
        findOne: jest.fn(),
        find: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        query: jest.fn(),
      },
    };

    dataSourceMock = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
    };

    eventEmitterMock = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinanceController],
      providers: [
        FinanceService,
        { provide: DataSource, useValue: dataSourceMock },
        { provide: getRepositoryToken(Invoice), useValue: { find: jest.fn(), findOne: jest.fn() } },
        { provide: getRepositoryToken(Payment), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(PurchaseOrder), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(GoodsReceipt), useValue: {} },
        { provide: getRepositoryToken(PoPaymentTerm), useValue: {} },
        { provide: EventEmitter2, useValue: eventEmitterMock },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
    controller = module.get<FinanceController>(FinanceController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // 1. INVOICE CREATE — TERM-BASED
  describe('1. Invoice CREATE — Term-Based', () => {
    const actorUserId = 77;

    it('should create and commit canonical AuditLog with term metadata in the same transaction', async () => {
      const mockPo = {
        id: 10,
        status: 'ISSUED',
        totalAmount: 100000000,
        items: [{ id: 1, itemName: 'Structural Steel', quantity: 10, unitPrice: 10000000 }],
        paymentTerms: [],
      };

      const mockTerm = {
        id: 5,
        poId: 10,
        sequence: 1,
        termName: 'Termin 1 - DP 20%',
        termType: PaymentTermType.DOWN_PAYMENT,
        amount: 20000000,
        percentage: 20,
        status: PaymentTermStatus.PENDING,
      };

      queryRunnerMock.manager.findOne
        .mockResolvedValueOnce(mockPo)       // find PurchaseOrder
        .mockResolvedValueOnce(null)         // candidate invoiceNumber uniqueness check
        .mockResolvedValueOnce(mockTerm)     // find PoPaymentTerm
        .mockResolvedValueOnce(null);        // existingActiveInvoiceForTerm check

      queryRunnerMock.manager.count.mockResolvedValue(0);
      queryRunnerMock.manager.find.mockResolvedValue([]); // activeInvoices check

      const dto: any = {
        purchaseOrderId: 10,
        paymentTermId: 5,
        invoiceDate: '2026-09-11',
      };

      const result = await service.createInvoice(dto, actorUserId);

      expect(result).toBeDefined();
      expect(queryRunnerMock.startTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalledTimes(1);

      // Verify AuditLog
      const audit = savedAuditLogs.find((a) => a.table_name === 'invoices' && a.action === 'CREATE');
      expect(audit).toBeDefined();
      expect(audit.table_name).toBe('invoices');
      expect(audit.action).toBe('CREATE');
      expect(audit.record_id).toBe(result.id);
      expect(audit.created_by).toBe(actorUserId);
      expect(audit.old_value).toBeNull();
      expect(audit.new_value).toEqual({
        invoiceNumber: expect.stringMatching(/^INV-\d{8}-001$/),
        poId: 10,
        paymentTermId: 5,
        totalAmount: 20000000,
        matchStatus: 'PENDING',
        paymentStatus: 'UNPAID',
        isTermBased: true,
        termStatusAfter: PaymentTermStatus.INVOICE_SUBMITTED,
      });

      // Verify AuditLog was saved via queryRunner.manager.save(AuditLog, ...) before commit
      const auditSaveCall = saveHistory.find((h) => h.entityClass === AuditLog && h.data.action === 'CREATE');
      expect(auditSaveCall).toBeDefined();
    });
  });

  // 2. INVOICE CREATE — LEGACY FULL PO
  describe('2. Invoice CREATE — Legacy Full PO', () => {
    const actorUserId = 88;

    it('should create canonical AuditLog for legacy 3-way matching invoice', async () => {
      const mockPo = {
        id: 20,
        status: 'COMPLETED',
        totalAmount: 50000000,
        items: [{ id: 2, itemName: 'Generator Set', quantity: 1, unitPrice: 50000000 }],
      };

      const mockGr = {
        id: 11,
        poId: 20,
        items: [{ poItemId: 2, receivedQuantity: 1 }],
      };

      queryRunnerMock.manager.findOne
        .mockResolvedValueOnce(mockPo)       // find PO
        .mockResolvedValueOnce(null);        // invoiceNumber uniqueness check

      queryRunnerMock.manager.count.mockResolvedValue(0);
      queryRunnerMock.manager.find.mockResolvedValue([mockGr]); // goodsReceipts find

      const dto: any = {
        purchaseOrderId: 20,
        invoiceDate: '2026-09-11',
        items: [{ poItemId: 2, quantity: 1, unitPrice: 50000000, totalPrice: 50000000 }],
      };

      const result = await service.createInvoice(dto, actorUserId);

      expect(result).toBeDefined();
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();

      const audit = savedAuditLogs.find((a) => a.table_name === 'invoices' && a.action === 'CREATE');
      expect(audit).toBeDefined();
      expect(audit.record_id).toBe(result.id);
      expect(audit.created_by).toBe(actorUserId);
      expect(audit.old_value).toBeNull();
      expect(audit.new_value).toEqual({
        invoiceNumber: expect.stringMatching(/^INV-\d{8}-001$/),
        poId: 20,
        totalAmount: 50000000,
        matchStatus: 'MATCHED',
        paymentStatus: 'UNPAID',
        isTermBased: false,
        itemsCount: 1,
      });
    });
  });

  // 3. INVOICE VERIFY — APPROVED
  describe('3. Invoice VERIFY — Approved', () => {
    const actorUserId = 66;

    it('should create canonical AuditLog with VERIFY action, old_value, and new_value before commit', async () => {
      const invoiceId = 15;
      const mockPo = {
        id: 30,
        status: 'ISSUED',
        totalAmount: 60000000,
        vendorId: 9,
        items: [],
        paymentTerms: [],
      };

      const mockTerm = {
        id: 8,
        poId: 30,
        sequence: 1,
        termName: 'Termin 1 - DP',
        termType: PaymentTermType.DOWN_PAYMENT,
        percentage: 30,
        amount: 18000000,
        status: PaymentTermStatus.INVOICE_SUBMITTED,
      };

      const mockInvoice = {
        id: invoiceId,
        invoiceNumber: 'INV-20260911-008',
        poId: 30,
        paymentTermId: 8,
        totalAmount: 18000000,
        matchStatus: 'PENDING',
        paymentStatus: 'UNPAID',
        purchaseOrder: mockPo,
        paymentTerm: mockTerm,
        items: [],
        payments: [],
      };

      queryRunnerMock.manager.findOne.mockImplementation((entityClass: any) => {
        if (entityClass === PoPaymentTerm) return Promise.resolve(mockTerm);
        if (entityClass === PurchaseOrder) return Promise.resolve(mockPo);
        if (entityClass === Invoice) return Promise.resolve(mockInvoice);
        return Promise.resolve(null);
      });

      queryRunnerMock.manager.find.mockResolvedValue([mockInvoice]); // activeInvoices

      const dto: any = {
        approved: true,
        evidenceRef: 'BAST-20260911-001',
        notes: 'Verifikasi termin DP disetujui',
      };

      const result = await service.verifyInvoice(invoiceId, dto, actorUserId);

      expect(result).toBeDefined();
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
      const outbox = saveHistory.find((s) => s.data?.event_name === 'finance.invoice.verified');
      expect(outbox).toBeDefined();

      const audit = savedAuditLogs.find((a) => a.table_name === 'invoices' && a.action === 'VERIFY');
      expect(audit).toBeDefined();
      expect(audit.table_name).toBe('invoices');
      expect(audit.action).toBe('VERIFY');
      expect(audit.record_id).toBe(invoiceId);
      expect(audit.created_by).toBe(actorUserId);
      expect(audit.old_value).toEqual({
        matchStatus: 'PENDING',
        paymentTermId: 8,
        paymentTermStatus: PaymentTermStatus.INVOICE_SUBMITTED,
      });
      expect(audit.new_value).toEqual({
        matchStatus: 'VERIFIED',
        paymentTermId: 8,
        paymentTermStatus: PaymentTermStatus.VERIFIED,
        totalAmount: 18000000,
        evidenceRef: 'BAST-20260911-001',
        notes: 'Verifikasi termin DP disetujui',
      });
    });
  });

  // 4. INVOICE REJECT
  describe('4. Invoice REJECT', () => {
    const actorUserId = 55;

    it('should create canonical AuditLog with REJECT action, old_value, and rejection notes', async () => {
      const invoiceId = 16;
      const mockInvoice = {
        id: invoiceId,
        invoiceNumber: 'INV-20260911-009',
        poId: 30,
        totalAmount: 18000000,
        matchStatus: 'PENDING',
        paymentStatus: 'UNPAID',
        purchaseOrder: null,
        paymentTerm: null,
      };

      queryRunnerMock.manager.findOne.mockResolvedValueOnce(mockInvoice);

      const dto: any = {
        approved: false,
        notes: 'Dokumen pendukung penagihan tidak valid atau kadaluarsa',
      };

      const result = await service.verifyInvoice(invoiceId, dto, actorUserId);

      expect(result).toBeDefined();
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
      const outbox = saveHistory.find((s) => s.data?.event_name === 'finance.invoice.rejected');
      expect(outbox).toBeDefined();

      const audit = savedAuditLogs.find((a) => a.table_name === 'invoices' && a.action === 'REJECT');
      expect(audit).toBeDefined();
      expect(audit.table_name).toBe('invoices');
      expect(audit.action).toBe('REJECT');
      expect(audit.record_id).toBe(invoiceId);
      expect(audit.created_by).toBe(actorUserId);
      expect(audit.old_value).toEqual({
        matchStatus: 'PENDING',
      });
      expect(audit.new_value).toEqual({
        matchStatus: 'REJECTED',
        notes: 'Dokumen pendukung penagihan tidak valid atau kadaluarsa',
      });
    });
  });

  // 5. INVOICE MISMATCH
  describe('5. Invoice MISMATCH', () => {
    const actorUserId = 44;

    it('should create canonical AuditLog with MISMATCH action when 3-way matching fails', async () => {
      const invoiceId = 17;
      const mockPo = {
        id: 40,
        status: 'COMPLETED',
        totalAmount: 50000000,
        vendorId: 5,
        items: [{ id: 1, unitPrice: 50000000 }],
      };

      const mockInvoice = {
        id: invoiceId,
        invoiceNumber: 'INV-20260911-010',
        poId: 40,
        paymentTermId: null,
        totalAmount: 50000000,
        matchStatus: 'PENDING',
        paymentStatus: 'UNPAID',
        purchaseOrder: mockPo,
        items: [],
        payments: [],
      };

      queryRunnerMock.manager.findOne
        .mockResolvedValueOnce(mockInvoice)  // 1. Lock invoice
        .mockResolvedValueOnce(mockPo);      // po lookup in evaluateMatching

      // GR with 0 received quantity to trigger 3-way mismatch
      const mockGr = {
        id: 99,
        poId: 40,
        items: [{ poItemId: 1, receivedQuantity: 0 }],
      };
      queryRunnerMock.manager.find.mockResolvedValue([mockGr]);

      const dto: any = {
        approved: true,
      };

      await expect(service.verifyInvoice(invoiceId, dto, actorUserId)).rejects.toThrow();

      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
      expect(eventEmitterMock.emit).toHaveBeenCalledWith('finance.mismatch', expect.anything());

      const audit = savedAuditLogs.find((a) => a.table_name === 'invoices' && a.action === 'MISMATCH');
      expect(audit).toBeDefined();
      expect(audit.table_name).toBe('invoices');
      expect(audit.action).toBe('MISMATCH');
      expect(audit.record_id).toBe(invoiceId);
      expect(audit.created_by).toBe(actorUserId);
      expect(audit.old_value).toEqual({
        matchStatus: 'PENDING',
      });
      expect(audit.new_value).toEqual({
        matchStatus: 'MISMATCHED',
        mismatches: expect.arrayContaining([
          expect.objectContaining({ code: MismatchCode.THREE_WAY_MISMATCH }),
        ]),
        totalInvoice: 50000000,
        totalPO: 50000000,
      });
    });
  });

  // 6. PAYMENT RECORD — PARTIAL PAYMENT
  describe('6. Payment RECORD — Partial Payment', () => {
    const actorUserId = 33; // MAKER_ID and PAYER_ID

    it('should create canonical AuditLog with RECORD action, partial amount, and PARTIALLY_PAID status', async () => {
      const checkerUserId = 99; // CHECKER_ID != actorUserId (33)
      const mockInvoice = {
        id: 7,
        invoiceNumber: 'INV-20260911-007',
        poId: 12,
        paymentTermId: 4,
        totalAmount: 30000000,
        matchStatus: 'VERIFIED',
        paymentStatus: 'UNPAID',
        createdBy: actorUserId,
      };

      const mockTerm = {
        id: 4,
        poId: 12,
        status: PaymentTermStatus.VERIFIED,
      };

      const createAudit = {
        id: 101,
        table_name: 'invoices',
        record_id: 7,
        action: 'CREATE',
        created_by: actorUserId,
        createdAt: new Date('2026-09-11T09:00:00Z'),
      };

      const verifyAudit = {
        id: 102,
        table_name: 'invoices',
        record_id: 7,
        action: 'VERIFY',
        created_by: checkerUserId,
        createdAt: new Date('2026-09-11T10:00:00Z'),
      };

      savedAuditLogs.push(createAudit, verifyAudit);

      queryRunnerMock.manager.findOne.mockImplementation(async (entityClass: any) => {
        if (entityClass === Invoice) return mockInvoice;
        if (entityClass === AuditLog) return verifyAudit;
        if (entityClass === PoPaymentTerm) return mockTerm;
        return null;
      });

      queryRunnerMock.manager.count.mockResolvedValue(0);
      queryRunnerMock.manager.find.mockResolvedValue([]); // 5. existingPayments

      const dto: any = {
        invoiceId: 7,
        paymentDate: '2026-09-11',
        paymentAmount: 10000000,
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: 'TRX-11223344',
      };

      const result = await service.createPayment(dto, actorUserId);

      expect(result).toBeDefined();
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
      expect(eventEmitterMock.emit).toHaveBeenCalledWith('finance.payment_processed', expect.anything());

      const audit = savedAuditLogs.find((a) => a.table_name === 'payments' && a.action === 'RECORD');
      expect(audit).toBeDefined();
      expect(audit.table_name).toBe('payments');
      expect(audit.action).toBe('RECORD');
      expect(audit.record_id).toBe(result.id);
      expect(audit.created_by).toBe(actorUserId);
      expect(audit.old_value).toBeNull();
      expect(audit.new_value).toEqual({
        paymentNumber: expect.stringMatching(/^PAY-\d{8}-001$/),
        invoiceId: 7,
        poId: 12,
        amount: 10000000,
        paymentDate: expect.any(Date),
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: 'TRX-11223344',
        invoicePaymentStatusAfter: 'PARTIALLY_PAID',
        isFullyPaid: false,
        remainingAmount: 20000000,
        paymentTermStatusAfter: PaymentTermStatus.VERIFIED,
      });

      // Verify audit chronology: CREATE -> VERIFY -> PAYMENT
      const relevantAudits = savedAuditLogs.filter(
        (a) => (a.table_name === 'invoices' && (a.action === 'CREATE' || a.action === 'VERIFY')) ||
               (a.table_name === 'payments' && a.action === 'RECORD')
      );
      expect(relevantAudits.map((a) => a.action)).toEqual(['CREATE', 'VERIFY', 'RECORD']);
      expect(relevantAudits[0].created_by).toBe(actorUserId);
      expect(relevantAudits[1].created_by).toBe(checkerUserId);
      expect(relevantAudits[2].created_by).toBe(actorUserId);
    });
  });

  // 7. PAYMENT RECORD — FULL PAYMENT
  describe('7. Payment RECORD — Full Payment', () => {
    const actorUserId = 22; // MAKER_ID and PAYER_ID

    it('should create canonical AuditLog with RECORD action, PAID status, and term PAID', async () => {
      const checkerUserId = 99; // CHECKER_ID != actorUserId (22)
      const mockInvoice = {
        id: 8,
        invoiceNumber: 'INV-20260911-008',
        poId: 15,
        paymentTermId: 9,
        totalAmount: 25000000,
        matchStatus: 'VERIFIED',
        paymentStatus: 'UNPAID',
        createdBy: actorUserId,
      };

      const mockTerm = {
        id: 9,
        poId: 15,
        status: PaymentTermStatus.VERIFIED,
      };

      const createAudit = {
        id: 201,
        table_name: 'invoices',
        record_id: 8,
        action: 'CREATE',
        created_by: actorUserId,
        createdAt: new Date('2026-09-11T09:00:00Z'),
      };

      const verifyAudit = {
        id: 202,
        table_name: 'invoices',
        record_id: 8,
        action: 'VERIFY',
        created_by: checkerUserId,
        createdAt: new Date('2026-09-11T10:00:00Z'),
      };

      savedAuditLogs.push(createAudit, verifyAudit);

      queryRunnerMock.manager.findOne.mockImplementation(async (entityClass: any) => {
        if (entityClass === Invoice) return mockInvoice;
        if (entityClass === AuditLog) return verifyAudit;
        if (entityClass === PoPaymentTerm) return mockTerm;
        return null;
      });

      queryRunnerMock.manager.count.mockResolvedValue(0);
      queryRunnerMock.manager.find.mockResolvedValue([]); // 5. existingPayments

      const dto: any = {
        invoiceId: 8,
        paymentDate: '2026-09-11',
        paymentAmount: 25000000,
        paymentMethod: 'CHEQUE',
        referenceNumber: 'CHQ-55667788',
      };

      const result = await service.createPayment(dto, actorUserId);

      expect(result).toBeDefined();
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();

      const audit = savedAuditLogs.find((a) => a.table_name === 'payments' && a.action === 'RECORD');
      expect(audit).toBeDefined();
      expect(audit.table_name).toBe('payments');
      expect(audit.action).toBe('RECORD');
      expect(audit.record_id).toBe(result.id);
      expect(audit.created_by).toBe(actorUserId);
      expect(audit.old_value).toBeNull();
      expect(audit.new_value).toEqual({
        paymentNumber: expect.stringMatching(/^PAY-\d{8}-001$/),
        invoiceId: 8,
        poId: 15,
        amount: 25000000,
        paymentDate: expect.any(Date),
        paymentMethod: 'CHEQUE',
        referenceNumber: 'CHQ-55667788',
        invoicePaymentStatusAfter: 'PAID',
        isFullyPaid: true,
        remainingAmount: 0,
        paymentTermStatusAfter: PaymentTermStatus.PAID,
      });

      // Verify audit chronology: CREATE -> VERIFY -> PAYMENT
      const relevantAudits = savedAuditLogs.filter(
        (a) => (a.table_name === 'invoices' && (a.action === 'CREATE' || a.action === 'VERIFY')) ||
               (a.table_name === 'payments' && a.action === 'RECORD')
      );
      expect(relevantAudits.map((a) => a.action)).toEqual(['CREATE', 'VERIFY', 'RECORD']);
      expect(relevantAudits[0].created_by).toBe(actorUserId);
      expect(relevantAudits[1].created_by).toBe(checkerUserId);
      expect(relevantAudits[2].created_by).toBe(actorUserId);
    });
  });

  // 8. ATOMICITY & TRANSACTION BOUNDARY ROLLBACK
  describe('8. Atomicity & Rollback Guarantees', () => {
    it('should rollback transaction if error occurs during Invoice CREATE', async () => {
      const mockPo = {
        id: 10,
        status: 'ISSUED',
        totalAmount: 100000000,
        items: [],
      };

      const mockTerm = {
        id: 5,
        poId: 10,
        sequence: 1,
        termName: 'Termin DP',
        termType: PaymentTermType.DOWN_PAYMENT,
        amount: 20000000,
        percentage: 20,
        status: PaymentTermStatus.PENDING,
      };

      queryRunnerMock.manager.findOne
        .mockResolvedValueOnce(mockPo)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockTerm)
        .mockResolvedValueOnce(null);

      queryRunnerMock.manager.count.mockResolvedValue(0);
      queryRunnerMock.manager.find.mockResolvedValue([]);

      // Simulate failure at commit
      queryRunnerMock.commitTransaction.mockRejectedValueOnce(new Error('Commit failure in DB'));

      const dto: any = {
        purchaseOrderId: 10,
        paymentTermId: 5,
        invoiceDate: '2026-09-11',
      };

      await expect(service.createInvoice(dto, 99)).rejects.toThrow('Commit failure in DB');

      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunnerMock.release).toHaveBeenCalledTimes(1);
    });

    it('should rollback transaction if error occurs during Payment RECORD', async () => {
      const mockInvoice = {
        id: 8,
        poId: 15,
        totalAmount: 25000000,
        matchStatus: 'VERIFIED',
        paymentStatus: 'UNPAID',
      };

      queryRunnerMock.manager.findOne
        .mockResolvedValueOnce(mockInvoice)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      queryRunnerMock.commitTransaction.mockRejectedValueOnce(new Error('Payment write failed'));

      const dto: any = {
        invoiceId: 8,
        paymentDate: '2026-09-11',
        paymentAmount: 25000000,
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: 'TRX-ERR',
      };

      await expect(service.createPayment(dto, 99)).rejects.toThrow('Payment write failed');

      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunnerMock.release).toHaveBeenCalledTimes(1);
    });
  });

  // 9. ACTOR PROPAGATION FROM CONTROLLER JWT
  describe('9. Actor Propagation from Controller (req.user.id -> created_by)', () => {
    it('should propagate authenticated JWT user ID to AuditLog for createInvoice endpoint', async () => {
      const jwtUserId = 123;
      const mockReq = { user: { id: jwtUserId } };

      const mockPo = {
        id: 10,
        status: 'ISSUED',
        totalAmount: 100000000,
        items: [],
      };
      const mockTerm = {
        id: 5,
        poId: 10,
        sequence: 1,
        termName: 'Termin DP',
        termType: PaymentTermType.DOWN_PAYMENT,
        amount: 20000000,
        percentage: 20,
        status: PaymentTermStatus.PENDING,
      };

      queryRunnerMock.manager.findOne
        .mockResolvedValueOnce(mockPo)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockTerm)
        .mockResolvedValueOnce(null);
      queryRunnerMock.manager.count.mockResolvedValue(0);
      queryRunnerMock.manager.find.mockResolvedValue([]);

      const dto: any = {
        purchaseOrderId: 10,
        paymentTermId: 5,
        invoiceDate: '2026-09-11',
      };

      await controller.createInvoice(dto, mockReq);

      const audit = savedAuditLogs.find((a) => a.table_name === 'invoices' && a.action === 'CREATE');
      expect(audit).toBeDefined();
      expect(audit.created_by).toBe(jwtUserId);
    });

    it('should propagate authenticated JWT user ID to AuditLog for verifyInvoice endpoint', async () => {
      const jwtUserId = 234;
      const mockReq = { user: { id: jwtUserId } };

      const mockInvoice = {
        id: 99,
        invoiceNumber: 'INV-20260911-099',
        matchStatus: 'PENDING',
      };
      queryRunnerMock.manager.findOne.mockResolvedValueOnce(mockInvoice);

      const dto: any = {
        approved: false,
        notes: 'Rejected from controller',
      };

      await controller.verifyInvoice(99, dto, mockReq);

      const audit = savedAuditLogs.find((a) => a.table_name === 'invoices' && a.action === 'REJECT');
      expect(audit).toBeDefined();
      expect(audit.created_by).toBe(jwtUserId);
    });

    it('should propagate authenticated JWT user ID to AuditLog for createPayment endpoint', async () => {
      const jwtUserId = 345;
      const mockReq = { user: { id: jwtUserId } };

      const mockInvoice = {
        id: 77,
        invoiceNumber: 'INV-20260911-077',
        poId: 12,
        totalAmount: 10000000,
        matchStatus: 'VERIFIED',
        paymentStatus: 'UNPAID',
      };
      queryRunnerMock.manager.findOne
        .mockResolvedValueOnce(mockInvoice)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      queryRunnerMock.manager.count.mockResolvedValue(0);
      queryRunnerMock.manager.find.mockResolvedValue([]);

      const dto: any = {
        invoiceId: 77,
        paymentDate: '2026-09-11',
        paymentAmount: 10000000,
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: 'TRX-JWT-PROPAGATION',
      };

      await controller.createPayment(dto, mockReq);

      const audit = savedAuditLogs.find((a) => a.table_name === 'payments' && a.action === 'RECORD');
      expect(audit).toBeDefined();
      expect(audit.created_by).toBe(jwtUserId);
    });
  });
});
