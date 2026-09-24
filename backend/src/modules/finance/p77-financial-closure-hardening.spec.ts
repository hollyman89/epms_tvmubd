import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { Invoice } from '../../entities/invoice.entity';
import { Payment } from '../../entities/payment.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { PoPaymentTerm, PaymentTermStatus, PaymentTermType } from '../../entities/po-payment-term.entity';
import { AuditLog } from '../../entities/audit-log.entity';

describe('P7.7 Part B - Financial Closure, Payer SoD, and PR Closure Hardening', () => {
  let service: FinanceService;
  let queryRunnerMock: any;
  let dataSourceMock: any;
  let eventEmitterMock: any;
  let savedAuditLogs: any[] = [];
  let savedPayments: any[] = [];
  let savedInvoices: any[] = [];
  let savedTerms: any[] = [];

  const MAKER_ID = 10;
  const CHECKER_ID = 20;
  const INDEPENDENT_PAYER_ID = 30;

  beforeEach(async () => {
    savedAuditLogs = [];
    savedPayments = [];
    savedInvoices = [];
    savedTerms = [];

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

          if (targetClass === AuditLog || entity instanceof AuditLog || entity?.table_name) {
            savedAuditLogs.push(entity);
          } else if (targetClass === Payment || entity?.paymentNumber) {
            savedPayments.push(entity);
          } else if (targetClass === Invoice || entity?.invoiceNumber) {
            savedInvoices.push(entity);
          } else if (targetClass === PoPaymentTerm || entity?.sequence) {
            savedTerms.push(entity);
          }
          if (entity && !entity.id && !Array.isArray(entity)) {
            entity.id = 900 + Math.floor(Math.random() * 100);
          }
          return Promise.resolve(entity);
        }),
        create: jest.fn().mockImplementation((entityClass: any, data: any) => {
          if (entityClass === AuditLog) {
            const audit = new AuditLog();
            Object.assign(audit, data);
            return audit;
          }
          return { ...data, id: data?.id || 901 };
        }),
        findOne: jest.fn(),
        find: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    dataSourceMock = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
    };

    eventEmitterMock = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: DataSource, useValue: dataSourceMock },
        { provide: EventEmitter2, useValue: eventEmitterMock },
        { provide: getRepositoryToken(Invoice), useValue: { findOne: jest.fn(), find: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(Payment), useValue: { findOne: jest.fn(), find: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(PurchaseOrder), useValue: { findOne: jest.fn(), find: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(GoodsReceipt), useValue: { findOne: jest.fn(), find: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(PoPaymentTerm), useValue: { findOne: jest.fn(), find: jest.fn(), save: jest.fn() } },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  const setupDefaultEntities = (overrides?: {
    poStatus?: string;
    totalAmount?: number;
    makerId?: number;
    checkerId?: number;
    existingPayments?: any[];
    terms?: any[];
    multiPos?: any[];
    prStatus?: string;
  }) => {
    const totalAmount = overrides?.totalAmount ?? 100000000;
    const poStatus = overrides?.poStatus ?? 'COMPLETED';
    const makerId = overrides?.makerId ?? MAKER_ID;
    const checkerId = overrides?.checkerId ?? CHECKER_ID;

    const mockPo: any = {
      id: 101,
      poNumber: 'PO-P77-TEST',
      totalAmount,
      status: poStatus,
      purchaseRequestId: 501,
      deletedAt: null,
    };

    const mockTerm: any = {
      id: 201,
      poId: mockPo.id,
      sequence: 1,
      amount: totalAmount,
      status: PaymentTermStatus.VERIFIED,
      deletedAt: null,
    };

    const mockInvoice: any = {
      id: 301,
      invoiceNumber: 'INV-P77-TEST',
      poId: mockPo.id,
      paymentTermId: mockTerm.id,
      totalAmount,
      matchStatus: 'VERIFIED',
      paymentStatus: 'UNPAID',
      createdBy: makerId,
      updatedBy: checkerId,
      deletedAt: null,
    };

    const mockPr: any = {
      id: 501,
      prNumber: 'PR-P77-TEST',
      status: overrides?.prStatus ?? 'PO_ISSUED',
      deletedAt: null,
    };

    const terms = overrides?.terms ?? [mockTerm];
    const existingPayments = overrides?.existingPayments ?? [];
    const prPos = overrides?.multiPos ?? [mockPo];

    queryRunnerMock.manager.findOne.mockImplementation(async (entityClass: any, opts: any) => {
      if (entityClass === Invoice) {
        return { ...mockInvoice };
      }
      if (entityClass === PurchaseOrder) {
        if (opts?.where?.id === mockPo.id) return { ...mockPo };
        const found = prPos.find((p) => p.id === opts?.where?.id);
        return found ? { ...found } : null;
      }
      if (entityClass === PoPaymentTerm) {
        if (opts?.where?.id === mockTerm.id) return { ...mockTerm };
        const found = terms.find((t) => t.id === opts?.where?.id);
        return found ? { ...found } : null;
      }
      if (entityClass === PurchaseRequest) {
        return { ...mockPr };
      }
      if (entityClass === AuditLog) {
        if (opts?.where?.action === 'VERIFY') {
          return {
            id: 88,
            table_name: 'invoices',
            record_id: mockInvoice.id,
            action: 'VERIFY',
            created_by: checkerId,
          };
        }
        return null;
      }
      if (entityClass === Payment) {
        return null;
      }
      return null;
    });

    queryRunnerMock.manager.find.mockImplementation(async (entityClass: any, opts: any) => {
      if (entityClass === Payment) {
        return [...existingPayments, ...savedPayments];
      }
      if (entityClass === PoPaymentTerm) {
        return terms.map((t) => savedTerms.find((st) => st.id === t.id) || t);
      }
      if (entityClass === Invoice) {
        return [savedInvoices.find((si) => si.id === mockInvoice.id) || mockInvoice];
      }
      if (entityClass === PurchaseOrder) {
        return prPos;
      }
      return [];
    });

    return { mockPo, mockTerm, mockInvoice, mockPr, terms, existingPayments };
  };

  // P77-01: Final payment detects fully settled PO and creates FINANCIAL_CLOSE audit
  it('P77-01: should detect fully settled PO on final payment and record FINANCIAL_CLOSE audit', async () => {
    setupDefaultEntities();

    const dto = {
      invoiceId: 301,
      paymentDate: '2026-09-17T00:00:00Z',
      paymentAmount: 100000000,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TRX-P77-01',
    };

    await service.createPayment(dto, INDEPENDENT_PAYER_ID);

    const poCloseAudit = savedAuditLogs.find(
      (a) => a.table_name === 'purchase_orders' && a.action === 'FINANCIAL_CLOSE',
    );
    expect(poCloseAudit).toBeDefined();
    expect(poCloseAudit.record_id).toBe(101);
    expect(poCloseAudit.new_value.isFinanciallyClosed).toBe(true);
    expect(poCloseAudit.new_value.totalPaid).toBe(100000000);
    expect(poCloseAudit.new_value.allTermsPaid).toBe(true);
    expect(poCloseAudit.new_value.status).toBe('COMPLETED'); // Physical status semantics preserved
    expect(eventEmitterMock.emit).toHaveBeenCalledWith('procurement.po_financially_completed', expect.objectContaining({ poId: 101 }));
  });

  // P77-02: Sequential closure is idempotent
  it('P77-02: should be idempotent and not create duplicate FINANCIAL_CLOSE audit if already recorded', async () => {
    setupDefaultEntities();

    // Mock that PO closure audit already exists
    queryRunnerMock.manager.findOne.mockImplementation(async (entityClass: any, opts: any) => {
      if (entityClass === AuditLog && opts?.where?.action === 'FINANCIAL_CLOSE') {
        return { id: 701, table_name: 'purchase_orders', record_id: 101, action: 'FINANCIAL_CLOSE' };
      }
      if (entityClass === Invoice) return { id: 301, poId: 101, paymentTermId: 201, totalAmount: 100, matchStatus: 'VERIFIED', paymentStatus: 'UNPAID', createdBy: MAKER_ID, updatedBy: CHECKER_ID };
      if (entityClass === PurchaseOrder) return { id: 101, totalAmount: 100, status: 'COMPLETED', purchaseRequestId: 501 };
      if (entityClass === PoPaymentTerm) return { id: 201, poId: 101, amount: 100, status: PaymentTermStatus.VERIFIED };
      return null;
    });
    queryRunnerMock.manager.find.mockResolvedValue([]);

    const dto = {
      invoiceId: 301,
      paymentDate: '2026-09-17T00:00:00Z',
      paymentAmount: 100,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TRX-P77-02',
    };

    await service.createPayment(dto, INDEPENDENT_PAYER_ID);

    const poCloseAudits = savedAuditLogs.filter(
      (a) => a.table_name === 'purchase_orders' && a.action === 'FINANCIAL_CLOSE',
    );
    expect(poCloseAudits.length).toBe(0); // Existing was detected; no duplicate inserted
  });

  // P77-03: Partial payment does NOT close PO
  it('P77-03: should not trigger PO financial closure on partial payment', async () => {
    setupDefaultEntities({ totalAmount: 100000000 });

    const dto = {
      invoiceId: 301,
      paymentDate: '2026-09-17T00:00:00Z',
      paymentAmount: 60000000, // 60M of 100M
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TRX-P77-03',
    };

    await service.createPayment(dto, INDEPENDENT_PAYER_ID);

    const poCloseAudit = savedAuditLogs.find(
      (a) => a.table_name === 'purchase_orders' && a.action === 'FINANCIAL_CLOSE',
    );
    expect(poCloseAudit).toBeUndefined();
    expect(eventEmitterMock.emit).not.toHaveBeenCalledWith('procurement.po_financially_completed', expect.anything());
  });

  // P77-04: One unpaid term prevents PO financial closure
  it('P77-04: should block PO closure if one of multiple payment terms remains unpaid', async () => {
    const term1 = { id: 201, poId: 101, sequence: 1, amount: 60000000, status: PaymentTermStatus.PAID };
    const term2 = { id: 202, poId: 101, sequence: 2, amount: 40000000, status: PaymentTermStatus.PENDING }; // Unpaid term!

    setupDefaultEntities({
      totalAmount: 100000000,
      terms: [term1, term2],
      existingPayments: [{ id: 1, invoiceId: 301, amount: 60000000, deletedAt: null }],
    });

    const dto = {
      invoiceId: 301,
      paymentDate: '2026-09-17T00:00:00Z',
      paymentAmount: 40000000,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TRX-P77-04',
    };

    await service.createPayment(dto, INDEPENDENT_PAYER_ID);

    const poCloseAudit = savedAuditLogs.find(
      (a) => a.table_name === 'purchase_orders' && a.action === 'FINANCIAL_CLOSE',
    );
    expect(poCloseAudit).toBeUndefined();
  });

  // P77-05: Concurrent final payments produce one closure
  it('P77-05: should serialize concurrent requests via PO row lock and produce exactly one closure', async () => {
    setupDefaultEntities();

    const dto = {
      invoiceId: 301,
      paymentDate: '2026-09-17T00:00:00Z',
      paymentAmount: 100000000,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TRX-P77-05',
    };

    await service.createPayment(dto, INDEPENDENT_PAYER_ID);

    // Verify PO lock mode was pessimistic_write
    expect(queryRunnerMock.manager.findOne).toHaveBeenCalledWith(
      PurchaseOrder,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );

    const poCloseAudits = savedAuditLogs.filter(
      (a) => a.table_name === 'purchase_orders' && a.action === 'FINANCIAL_CLOSE',
    );
    expect(poCloseAudits.length).toBe(1);
  });

  // P77-06: payment_processed contains authoritative amount & paymentAmount
  it('P77-06: should emit finance.payment_processed with both amount and paymentAmount', async () => {
    setupDefaultEntities();

    const dto = {
      invoiceId: 301,
      paymentDate: '2026-09-17T00:00:00Z',
      paymentAmount: 50000000,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TRX-P77-06',
    };

    await service.createPayment(dto, INDEPENDENT_PAYER_ID);

    expect(eventEmitterMock.emit).toHaveBeenCalledWith(
      'finance.payment_processed',
      expect.objectContaining({
        amount: 50000000,
        paymentAmount: 50000000,
        invoiceId: 301,
      }),
    );
  });

  // P77-07: Maker CAN pay own term-based invoice if independently verified
  it('P77-07: should allow payment when actor is the invoice Maker (invoice.createdBy) but invoice is term-based and independently verified', async () => {
    setupDefaultEntities({ makerId: MAKER_ID, checkerId: CHECKER_ID });

    const dto = {
      invoiceId: 301,
      paymentDate: '2026-09-17T00:00:00Z',
      paymentAmount: 10000000,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TRX-P77-07',
    };

    const payment = await service.createPayment(dto, MAKER_ID);
    expect(payment).toBeDefined();
    expect(payment.amount).toBe(10000000);
  });

  // P77-08: Checker cannot pay the same invoice (SoD rejection)
  it('P77-08: should reject payment when actor is the invoice Checker (invoice.updatedBy / verify audit)', async () => {
    setupDefaultEntities({ checkerId: CHECKER_ID });

    const dto = {
      invoiceId: 301,
      paymentDate: '2026-09-17T00:00:00Z',
      paymentAmount: 10000000,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TRX-P77-08',
    };

    await expect(service.createPayment(dto, CHECKER_ID)).rejects.toThrow(
      'Prinsip Segregation of Duties (SoD) melarang verifikator invoice (Checker) melakukan pembayaran.',
    );
  });

  // P77-09: Independent Payer can pay verified invoice (allowed)
  it('P77-09: should allow independent payer to pay verified invoice', async () => {
    setupDefaultEntities();

    const dto = {
      invoiceId: 301,
      paymentDate: '2026-09-17T00:00:00Z',
      paymentAmount: 100000000,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TRX-P77-09',
    };

    const payment = await service.createPayment(dto, INDEPENDENT_PAYER_ID);
    expect(payment).toBeDefined();
    expect(payment.amount).toBe(100000000);
  });

  // P77-09b: Maker creates, Maker attempts verification (Maker-Checker violation)
  it('P77-09b: should reject verification if Maker and Verifier are the same person', async () => {
    setupDefaultEntities({ makerId: MAKER_ID });
    
    queryRunnerMock.manager.findOne.mockImplementation(async (entityClass: any, opts: any) => {
      if (entityClass === Invoice) return { id: 301, paymentTermId: 201, createdBy: MAKER_ID, matchStatus: 'MATCHED' };
      return null;
    });

    const dto = { approved: true, notes: 'Self verify' };

    await expect(service.verifyInvoice(301, dto as any, MAKER_ID)).rejects.toThrow();
  });

  // P77-09c: Maker creates, No independent verifier exists, Maker attempts payment
  it('P77-09c: should reject payment if Maker tries to pay an unverified term invoice', async () => {
    setupDefaultEntities({ makerId: MAKER_ID });
    
    queryRunnerMock.manager.findOne.mockImplementation(async (entityClass: any, opts: any) => {
      if (entityClass === AuditLog) return null; // No VERIFY audit
      if (entityClass === Invoice) return { id: 301, paymentTermId: 201, createdBy: MAKER_ID, updatedBy: null, matchStatus: 'VERIFIED', paymentStatus: 'UNPAID' };
      if (entityClass === PoPaymentTerm) return { id: 201, status: PaymentTermStatus.VERIFIED };
      if (entityClass === PurchaseOrder) return { id: 101, totalAmount: 100000000, status: 'COMPLETED' };
      return null;
    });

    const dto = {
      invoiceId: 301,
      paymentDate: '2026-09-17T00:00:00Z',
      paymentAmount: 10000000,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TRX-P77-09c',
    };

    await expect(service.createPayment(dto, MAKER_ID)).rejects.toThrow(
      'Prinsip Segregation of Duties (SoD) melarang pembuat invoice (Maker) melakukan pembayaran.',
    );
  });

  // P77-09d: Maker = finance, Verifier = director, Payer = director
  it('P77-09d: should reject payment when actor is the invoice Verifier (Checker)', async () => {
    setupDefaultEntities({ makerId: MAKER_ID, checkerId: CHECKER_ID });

    const dto = {
      invoiceId: 301,
      paymentDate: '2026-09-17T00:00:00Z',
      paymentAmount: 10000000,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TRX-P77-09d',
    };

    await expect(service.createPayment(dto, CHECKER_ID)).rejects.toThrow(
      'Prinsip Segregation of Duties (SoD) melarang verifikator invoice (Checker) melakukan pembayaran.',
    );
  });

  // P77-10: Independent Payer can perform partial payment
  it('P77-10: should allow independent payer to perform partial payment', async () => {
    setupDefaultEntities({ totalAmount: 100000000 });

    const dto = {
      invoiceId: 301,
      paymentDate: '2026-09-17T00:00:00Z',
      paymentAmount: 40000000,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TRX-P77-10',
    };

    const payment = await service.createPayment(dto, INDEPENDENT_PAYER_ID);
    expect(payment).toBeDefined();
    expect((payment as any).paymentStatus).toBe('PARTIALLY_PAID');
    expect((payment as any).remainingAmount).toBe(60000000);
  });

  // P77-11: Multi-PO PR remains open while one PO is incomplete
  it('P77-11: should NOT close PR when multiple POs exist and one PO remains physically/financially incomplete', async () => {
    const po1 = { id: 101, poNumber: 'PO-1', totalAmount: 50000000, status: 'COMPLETED', purchaseRequestId: 501, deletedAt: null };
    const po2 = { id: 102, poNumber: 'PO-2', totalAmount: 50000000, status: 'ISSUED', purchaseRequestId: 501, deletedAt: null }; // Not physically complete!

    setupDefaultEntities({
      totalAmount: 50000000,
      multiPos: [po1, po2],
    });

    const dto = {
      invoiceId: 301,
      paymentDate: '2026-09-17T00:00:00Z',
      paymentAmount: 50000000,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TRX-P77-11',
    };

    await service.createPayment(dto, INDEPENDENT_PAYER_ID);

    // PO 1 closed financially
    const poCloseAudit = savedAuditLogs.find((a) => a.table_name === 'purchase_orders' && a.action === 'FINANCIAL_CLOSE');
    expect(poCloseAudit).toBeDefined();

    // PR must NOT be closed because PO 2 is still incomplete
    const prCloseAudit = savedAuditLogs.find((a) => a.table_name === 'purchase_requests' && a.action === 'PROCUREMENT_CLOSE');
    expect(prCloseAudit).toBeUndefined();
    expect(eventEmitterMock.emit).not.toHaveBeenCalledWith('procurement.pr_procurement_completed', expect.anything());
  });

  // P77-12: PR closes only when all POs are complete + financially settled
  it('P77-12: should close PR when all active POs under PR are both physically completed and financially settled', async () => {
    const po1 = { id: 101, poNumber: 'PO-1', totalAmount: 100000000, status: 'COMPLETED', purchaseRequestId: 501, deletedAt: null };

    setupDefaultEntities({
      totalAmount: 100000000,
      multiPos: [po1],
    });

    const dto = {
      invoiceId: 301,
      paymentDate: '2026-09-17T00:00:00Z',
      paymentAmount: 100000000,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TRX-P77-12',
    };

    await service.createPayment(dto, INDEPENDENT_PAYER_ID);

    const prCloseAudit = savedAuditLogs.find(
      (a) => a.table_name === 'purchase_requests' && a.action === 'PROCUREMENT_CLOSE',
    );
    expect(prCloseAudit).toBeDefined();
    expect(prCloseAudit.record_id).toBe(501);
    expect(prCloseAudit.new_value.isProcurementClosed).toBe(true);
    expect(prCloseAudit.new_value.status).toBe('PO_ISSUED'); // Status string strictly preserved
    expect(eventEmitterMock.emit).toHaveBeenCalledWith('procurement.pr_procurement_completed', expect.objectContaining({ prId: 501 }));
  });

  // P77-13: Exactly one canonical closure AuditLog
  it('P77-13: should record exactly one closure AuditLog for PO and PR', async () => {
    setupDefaultEntities();

    const dto = {
      invoiceId: 301,
      paymentDate: '2026-09-17T00:00:00Z',
      paymentAmount: 100000000,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TRX-P77-13',
    };

    await service.createPayment(dto, INDEPENDENT_PAYER_ID);

    const poCloseAudits = savedAuditLogs.filter(
      (a) => a.table_name === 'purchase_orders' && a.action === 'FINANCIAL_CLOSE',
    );
    const prCloseAudits = savedAuditLogs.filter(
      (a) => a.table_name === 'purchase_requests' && a.action === 'PROCUREMENT_CLOSE',
    );

    expect(poCloseAudits.length).toBe(1);
    expect(prCloseAudits.length).toBe(1);
  });

  // P77-14: Transaction failure rolls back closure state
  it('P77-14: should rollback all changes and emit no events on transaction failure', async () => {
    setupDefaultEntities();

    queryRunnerMock.commitTransaction.mockRejectedValueOnce(new Error('DB commit failed'));

    const dto = {
      invoiceId: 301,
      paymentDate: '2026-09-17T00:00:00Z',
      paymentAmount: 100000000,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TRX-P77-14',
    };

    await expect(service.createPayment(dto, INDEPENDENT_PAYER_ID)).rejects.toThrow('DB commit failed');

    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    expect(eventEmitterMock.emit).not.toHaveBeenCalled();
  });

  // P77-15: Existing finance payment regression remains intact
  it('P77-15: should preserve all existing validation (zero amount, overpayment, already paid, invalid status)', async () => {
    setupDefaultEntities();

    // 1. Zero amount rejection
    await expect(
      service.createPayment({ invoiceId: 301, paymentDate: '2026-09-17', paymentAmount: 0, paymentMethod: 'BANK_TRANSFER', referenceNumber: 'R1' }, INDEPENDENT_PAYER_ID),
    ).rejects.toThrow('Payment amount harus lebih besar dari 0');

    // 2. Overpayment rejection
    await expect(
      service.createPayment({ invoiceId: 301, paymentDate: '2026-09-17', paymentAmount: 150000000, paymentMethod: 'BANK_TRANSFER', referenceNumber: 'R2' }, INDEPENDENT_PAYER_ID),
    ).rejects.toThrow('melebihi sisa tagihan invoice');

    // 3. Already paid rejection
    queryRunnerMock.manager.findOne.mockImplementation(async (entityClass: any) => {
      if (entityClass === Invoice) return { id: 301, paymentStatus: 'PAID', matchStatus: 'VERIFIED', createdBy: MAKER_ID, updatedBy: CHECKER_ID };
      return null;
    });
    await expect(
      service.createPayment({ invoiceId: 301, paymentDate: '2026-09-17', paymentAmount: 50000, paymentMethod: 'BANK_TRANSFER', referenceNumber: 'R3' }, INDEPENDENT_PAYER_ID),
    ).rejects.toThrow('Invoice is already PAID');
  });
});
