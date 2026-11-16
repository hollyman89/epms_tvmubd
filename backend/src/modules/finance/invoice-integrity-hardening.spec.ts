import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from './finance.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Invoice } from '../../entities/invoice.entity';
import { InvoiceItem } from '../../entities/invoice-item.entity';
import { Payment } from '../../entities/payment.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { PoPaymentTerm, PaymentTermStatus, PaymentTermType } from '../../entities/po-payment-term.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, In, Like } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { ServiceClaim, ServiceClaimStatus } from '../../entities/service-claim.entity';
import { PaymentRequest, PaymentRequestStatus } from '../../entities/payment-request.entity';
import { CompanyBankAccount, CompanyBankAccountStatus } from '../../entities/company-bank-account.entity';

describe('Invoice Financial Integrity Hardening Suite (P7.6 PART 2)', () => {
  let service: FinanceService;
  let mockQueryRunner: any;
  let savedEntities: any[];
  let savedAuditLogs: any[];

  const baselinePo = {
    id: 1,
    poNumber: 'PO-20260916-001',
    status: 'ISSUED',
    totalAmount: 100000000,
    items: [
      { id: 10, purchaseOrderId: 1, itemName: 'Server Rack 42U', quantity: 100, unitPrice: 1000000, receivedQuantity: 100 },
    ],
    paymentTerms: [],
  };

  const sampleProgressTerm = {
    id: 201,
    poId: 1,
    sequence: 1,
    termName: 'Termin 1 — Progress — 60%',
    termType: PaymentTermType.PROGRESS,
    percentage: 60.0,
    amount: 60000000,
    status: PaymentTermStatus.PENDING,
    triggerCondition: 'Kemajuan 60%',
    isRetention: false,
    deletedAt: null,
  };

  const sampleGr = {
    id: 301,
    grNumber: 'GR-20260916-001',
    poId: 1,
    deletedAt: null,
    totalReceivedAmount: 100000000,
    items: [{ id: 401, grId: 301, poItemId: 10, receivedQuantity: 100 }],
  };

  beforeEach(async () => {
    savedEntities = [];
    savedAuditLogs = [];

    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn(),
        find: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        save: jest.fn().mockImplementation((entityOrTarget: any, entity?: any) => {
          const target = entity !== undefined ? entity : entityOrTarget;
          const entityClass = entity !== undefined ? entityOrTarget : null;
          if (!target.id) {
            target.id = Math.floor(Math.random() * 10000) + 1;
          }
          savedEntities.push(target);
          if (entityClass === AuditLog || target instanceof AuditLog || target?.table_name === 'invoices') {
            savedAuditLogs.push(target);
          }
          return Promise.resolve(target);
        }),
        create: jest.fn().mockImplementation((entityClass: any, data: any) => {
          if (entityClass === AuditLog) {
            const audit = new AuditLog();
            Object.assign(audit, data);
            return audit;
          }
          return { ...data, id: data?.id || Math.floor(Math.random() * 10000) + 1 };
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
        { provide: getRepositoryToken(Invoice), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(Payment), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(PurchaseOrder), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(GoodsReceipt), useValue: {} },
        { provide: getRepositoryToken(PoPaymentTerm), useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  // INV-01: Valid Term-Based invoice creation succeeds
  it('INV-01: Valid Term-Based invoice creation succeeds with authoritative term amount and locked rows', async () => {
    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo, status: 'PARTIALLY_FULFILLED' }) // 1. PO lookup with lock
      .mockResolvedValueOnce(null) // invoice candidate unique check
      .mockResolvedValueOnce({ ...sampleProgressTerm }) // 2. PaymentTerm lookup with lock
      .mockResolvedValueOnce(sampleGr) // GR lookup
      .mockResolvedValueOnce(null); // active invoice check for term

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([sampleGr]) // allPoGrs for physical delivery capacity
      .mockResolvedValueOnce([]) // allExistingInvoices for progress billed calculation
      .mockResolvedValueOnce([]); // activeInvoices for cumulative cap & item quantity check

    const dto = {
      purchaseOrderId: 1,
      paymentTermId: 201,
      goodsReceiptId: 301,
      invoiceDate: '2026-09-16',
      items: [{ poItemId: 10, quantity: 60, unitPrice: 1000000, totalPrice: 60000000 }],
    };

    const result = await service.createInvoice(dto, 88);

    expect(result).toBeDefined();
    expect(result.totalAmount).toBe(60000000);
    expect(result.paymentTermId).toBe(201);
    expect(result.matchStatus).toBe('PENDING');
    expect(result.status).toBe('UNPAID');
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });

  // INV-02: Second invoice for same payment term is rejected
  it('INV-02: Second invoice for same payment term is rejected when active invoice exists', async () => {
    const existingActiveInvoice = {
      id: 501,
      poId: 1,
      paymentTermId: 201,
      invoiceNumber: 'INV-20260916-001',
      status: 'UNPAID',
      matchStatus: 'PENDING',
      deletedAt: null,
      paymentTerm: sampleProgressTerm,
    };

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo, status: 'PARTIALLY_FULFILLED' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...sampleProgressTerm })
      .mockResolvedValueOnce(sampleGr)
      .mockResolvedValueOnce(existingActiveInvoice); // Existing active invoice found!

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([sampleGr])
      .mockResolvedValueOnce([existingActiveInvoice]);

    const dto = {
      purchaseOrderId: 1,
      paymentTermId: 201,
      goodsReceiptId: 301,
      invoiceDate: '2026-09-16',
      items: [{ poItemId: 10, quantity: 60, unitPrice: 1000000, totalPrice: 60000000 }],
    };

    await expect(service.createInvoice(dto, 88)).rejects.toThrow(
      'Payment term sudah memiliki invoice aktif.'
    );
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  // INV-03: Concurrent same-term submission: one success, one rejection
  it('INV-03: Concurrent same-term submission simulates serialization where second attempt sees INVOICE_SUBMITTED status', async () => {
    // Attempt B sees paymentTerm already updated to INVOICE_SUBMITTED by Attempt A
    const alreadySubmittedTerm = {
      ...sampleProgressTerm,
      status: PaymentTermStatus.INVOICE_SUBMITTED,
    };

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo, status: 'PARTIALLY_FULFILLED' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(alreadySubmittedTerm); // Term already submitted by concurrent transaction

    const dto = {
      purchaseOrderId: 1,
      paymentTermId: 201,
      goodsReceiptId: 301,
      invoiceDate: '2026-09-16',
    };

    await expect(service.createInvoice(dto, 88)).rejects.toThrow(
      'Payment term belum dapat ditagihkan atau sudah memiliki proses tagihan.'
    );
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  // INV-04: Current invoice quantity <= received quantity succeeds
  it('INV-04: Current invoice quantity <= received quantity succeeds (quantity 80 <= received 100)', async () => {
    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo, status: 'PARTIALLY_FULFILLED' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...sampleProgressTerm, amount: 80000000 })
      .mockResolvedValueOnce(sampleGr)
      .mockResolvedValueOnce(null);

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([sampleGr])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]); // No prior invoiced items

    const dto = {
      purchaseOrderId: 1,
      paymentTermId: 201,
      goodsReceiptId: 301,
      invoiceDate: '2026-09-16',
      items: [{ poItemId: 10, quantity: 80, unitPrice: 1000000, totalPrice: 80000000 }],
    };

    const result = await service.createInvoice(dto, 88);
    expect(result).toBeDefined();
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });

  // INV-05: Current invoice quantity > remaining billable quantity is rejected
  it('INV-05: Current invoice quantity > remaining billable quantity is rejected (received 80, previously invoiced 50, remaining 30, invoice 31 -> reject)', async () => {
    const poWith80Received = {
      ...baselinePo,
      status: 'PARTIALLY_FULFILLED',
      items: [{ id: 10, purchaseOrderId: 1, itemName: 'Server Rack 42U', quantity: 100, unitPrice: 1000000, receivedQuantity: 80 }],
    };

    const priorInvoiceWith50 = {
      id: 501,
      poId: 1,
      paymentTermId: 199,
      status: 'PAID',
      matchStatus: 'VERIFIED',
      deletedAt: null,
      items: [{ id: 601, invoiceId: 501, poItemId: 10, quantity: 50, unitPrice: 1000000, totalPrice: 50000000, deletedAt: null }],
    };

    const grWith80 = {
      ...sampleGr,
      totalReceivedAmount: 80000000,
      items: [{ id: 401, grId: 301, poItemId: 10, receivedQuantity: 80 }],
    };

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce(poWith80Received)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...sampleProgressTerm, amount: 31000000 })
      .mockResolvedValueOnce(grWith80)
      .mockResolvedValueOnce(null);

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([grWith80])
      .mockResolvedValueOnce([]) // prior progress billed
      .mockResolvedValueOnce([priorInvoiceWith50]); // activeInvoices containing prior 50 units

    const dto = {
      purchaseOrderId: 1,
      paymentTermId: 201,
      goodsReceiptId: 301,
      invoiceDate: '2026-09-16',
      items: [{ poItemId: 10, quantity: 31, unitPrice: 1000000, totalPrice: 31000000 }], // 31 exceeds remaining 30!
    };

    await expect(service.createInvoice(dto, 88)).rejects.toThrow(
      /melebihi sisa kuantitas yang dapat ditagihkan \(30\)/
    );
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  // INV-06: Two sequential invoices cumulatively consume received quantity
  it('INV-06: Sequential invoices cumulatively consume received quantity: received 100, inv 1 = 60, inv 2 = 40, inv 3 = 1 -> reject', async () => {
    const priorInvoice1 = {
      id: 501,
      poId: 1,
      paymentTermId: 201,
      status: 'PAID',
      matchStatus: 'VERIFIED',
      deletedAt: null,
      items: [{ id: 601, invoiceId: 501, poItemId: 10, quantity: 60, unitPrice: 1000000, totalPrice: 60000000, deletedAt: null }],
    };

    const priorInvoice2 = {
      id: 502,
      poId: 1,
      paymentTermId: 202,
      status: 'PAID',
      matchStatus: 'VERIFIED',
      deletedAt: null,
      items: [{ id: 602, invoiceId: 502, poItemId: 10, quantity: 40, unitPrice: 1000000, totalPrice: 40000000, deletedAt: null }],
    };

    // Third invoice attempts to bill 1 unit when 100/100 is already invoiced
    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo, status: 'PARTIALLY_FULFILLED' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...sampleProgressTerm, id: 203, amount: 1000000 })
      .mockResolvedValueOnce(sampleGr)
      .mockResolvedValueOnce(null);

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([sampleGr])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([priorInvoice1, priorInvoice2]); // 60 + 40 = 100 already invoiced

    const dto = {
      purchaseOrderId: 1,
      paymentTermId: 203,
      goodsReceiptId: 301,
      invoiceDate: '2026-09-16',
      items: [{ poItemId: 10, quantity: 1, unitPrice: 1000000, totalPrice: 1000000 }],
    };

    await expect(service.createInvoice(dto, 88)).rejects.toThrow(
      /melebihi sisa kuantitas yang dapat ditagihkan \(0\)/
    );
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  // INV-07: Legacy invoice ignores client unitPrice
  it('INV-07: Legacy invoice ignores client unitPrice and uses authoritative PO item unitPrice', async () => {
    const completedPo = {
      ...baselinePo,
      status: 'COMPLETED',
      totalAmount: 100000000,
      items: [{ id: 10, purchaseOrderId: 1, itemName: 'Server Rack 42U', quantity: 100, unitPrice: 1000000, receivedQuantity: 100 }],
    };

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce(completedPo)
      .mockResolvedValueOnce(null);

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([]) // existing invoices for Branch B (0 prior)
      .mockResolvedValueOnce([sampleGr]); // goodsReceipts for 3-way match calculation

    const dto = {
      purchaseOrderId: 1,
      invoiceDate: '2026-09-16',
      items: [
        {
          poItemId: 10,
          quantity: 100,
          unitPrice: 999999999, // MANIPULATED client unitPrice
          totalPrice: 99999999999, // MANIPULATED client totalPrice
        },
      ],
    };

    const result = await service.createInvoice(dto, 88);

    expect(result).toBeDefined();
    // Total amount must be derived from authoritative PO item price (100 * 1,000,000 = 100,000,000)
    expect(result.totalAmount).toBe(100000000);
    // Persisted item must have PO unit price, NOT client price
    expect(result.items[0].unitPrice).toBe(1000000);
    expect(result.items[0].totalPrice).toBe(100000000);
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });

  // INV-08: Legacy invoice ignores client totalPrice
  it('INV-08: Legacy invoice ignores client totalPrice and calculates backend total', async () => {
    const completedPo = {
      ...baselinePo,
      status: 'COMPLETED',
      totalAmount: 100000000,
      items: [{ id: 10, purchaseOrderId: 1, itemName: 'Server Rack 42U', quantity: 100, unitPrice: 1000000, receivedQuantity: 100 }],
    };

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce(completedPo)
      .mockResolvedValueOnce(null);

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([sampleGr]);

    const dto = {
      purchaseOrderId: 1,
      invoiceDate: '2026-09-16',
      items: [
        {
          poItemId: 10,
          quantity: 100,
          unitPrice: 1000000,
          totalPrice: 1, // CLIENT SAYS 1 RUPIAH
        },
      ],
    };

    const result = await service.createInvoice(dto, 88);
    expect(result.items[0].totalPrice).toBe(100000000);
    expect(result.totalAmount).toBe(100000000);
  });

  // INV-09: Legacy invoice total is calculated from authoritative PO item prices
  it('INV-09: Legacy invoice total is calculated from sum of authoritative PO item totals', async () => {
    const completedPoMulti = {
      ...baselinePo,
      status: 'COMPLETED',
      totalAmount: 25000000,
      items: [
        { id: 10, purchaseOrderId: 1, itemName: 'Item A', quantity: 10, unitPrice: 1000000, receivedQuantity: 10 },
        { id: 11, purchaseOrderId: 1, itemName: 'Item B', quantity: 5, unitPrice: 3000000, receivedQuantity: 5 },
      ],
    };

    const mockGrMulti = {
      id: 301,
      grNumber: 'GR-20260916-001',
      poId: 1,
      deletedAt: null,
      items: [
        { id: 401, grId: 301, poItemId: 10, receivedQuantity: 10 },
        { id: 402, grId: 301, poItemId: 11, receivedQuantity: 5 },
      ],
    };

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce(completedPoMulti)
      .mockResolvedValueOnce(null);

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([mockGrMulti]);

    const dto = {
      purchaseOrderId: 1,
      invoiceDate: '2026-09-16',
      items: [
        { poItemId: 10, quantity: 10, unitPrice: 0, totalPrice: 0 },
        { poItemId: 11, quantity: 5, unitPrice: 0, totalPrice: 0 },
      ],
    };

    const result = await service.createInvoice(dto, 88);
    // Item 10: 10 * 1,000,000 = 10,000,000
    // Item 11: 5 * 3,000,000 = 15,000,000
    // Total: 25,000,000
    expect(result.totalAmount).toBe(25000000);
    expect(result.items.length).toBe(2);
    expect(result.items[0].totalPrice).toBe(10000000);
    expect(result.items[1].totalPrice).toBe(15000000);
  });

  // INV-10: Invoice item belonging to another PO is rejected
  it('INV-10: Invoice item belonging to another PO is rejected', async () => {
    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo, status: 'PARTIALLY_FULFILLED' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...sampleProgressTerm })
      .mockResolvedValueOnce(sampleGr)
      .mockResolvedValueOnce(null);

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([sampleGr])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const dto = {
      purchaseOrderId: 1,
      paymentTermId: 201,
      goodsReceiptId: 301,
      invoiceDate: '2026-09-16',
      items: [{ poItemId: 999, quantity: 10, unitPrice: 1000000, totalPrice: 10000000 }], // poItemId 999 not in PO #1
    };

    await expect(service.createInvoice(dto, 88)).rejects.toThrow(
      'PO Item 999 not found in this PO'
    );
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  // INV-11: Transaction rollback leaves no invoice/items/term records
  it('INV-11: Transaction rollback is called on failure, ensuring atomicity', async () => {
    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo, status: 'PARTIALLY_FULFILLED' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...sampleProgressTerm })
      .mockResolvedValueOnce(null); // GR not found -> throws error

    const dto = {
      purchaseOrderId: 1,
      paymentTermId: 201,
      goodsReceiptId: 99999,
      invoiceDate: '2026-09-16',
    };

    await expect(service.createInvoice(dto, 88)).rejects.toThrow(
      /tidak ditemukan di sistem/
    );
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  // INV-12: AuditLog is generated exactly once after successful creation
  it('INV-12: AuditLog is generated exactly once inside the transaction upon successful creation', async () => {
    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo, status: 'PARTIALLY_FULFILLED' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...sampleProgressTerm })
      .mockResolvedValueOnce(sampleGr)
      .mockResolvedValueOnce(null);

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([sampleGr])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const dto = {
      purchaseOrderId: 1,
      paymentTermId: 201,
      goodsReceiptId: 301,
      invoiceDate: '2026-09-16',
      items: [{ poItemId: 10, quantity: 60, unitPrice: 1000000, totalPrice: 60000000 }],
    };

    await service.createInvoice(dto, 88);

    const invoiceAuditLogs = savedAuditLogs.filter((a) => a.table_name === 'invoices' && a.action === 'CREATE');
    expect(invoiceAuditLogs.length).toBe(1);
    expect(invoiceAuditLogs[0].new_value.poId).toBe(1);
    expect(invoiceAuditLogs[0].new_value.paymentTermId).toBe(201);
    expect(invoiceAuditLogs[0].new_value.totalAmount).toBe(60000000);
    expect(invoiceAuditLogs[0].created_by).toBe(88);
  });
});

describe('EPMS CP1.2-04: Term-Based Invoice Header-Detail Reconciliation Hardening Suite', () => {
  let service: FinanceService;
  let mockQueryRunner: any;
  let savedEntities: any[];
  let savedAuditLogs: any[];

  const baselinePo = {
    id: 1,
    poNumber: 'PO-20260916-001',
    status: 'ISSUED',
    orderType: 'MATERIAL',
    totalAmount: 100000000,
    vendorId: 5,
    items: [
      { id: 10, purchaseOrderId: 1, itemName: 'Server Rack 42U', quantity: 100, unitPrice: 1000000, receivedQuantity: 100 },
    ],
    paymentTerms: [],
  };

  beforeEach(async () => {
    savedEntities = [];
    savedAuditLogs = [];

    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn(),
        find: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        save: jest.fn().mockImplementation((entityOrTarget: any, entity?: any) => {
          const target = entity !== undefined ? entity : entityOrTarget;
          const entityClass = entity !== undefined ? entityOrTarget : null;
          if (!target.id) {
            target.id = Math.floor(Math.random() * 10000) + 1;
          }
          savedEntities.push(target);
          if (entityClass === AuditLog || target instanceof AuditLog || target?.table_name === 'invoices') {
            savedAuditLogs.push(target);
          }
          return Promise.resolve(target);
        }),
        create: jest.fn().mockImplementation((entityClass: any, data: any) => {
          if (entityClass === AuditLog) {
            const audit = new AuditLog();
            Object.assign(audit, data);
            return audit;
          }
          return { ...data, id: data?.id || Math.floor(Math.random() * 10000) + 1 };
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
        { provide: getRepositoryToken(Invoice), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(Payment), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(PurchaseOrder), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(GoodsReceipt), useValue: {} },
        { provide: getRepositoryToken(PoPaymentTerm), useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  // Scenario 1: DP standalone invoice detail without PO Item allocation
  it('Scenario 1: DP standalone invoice detail without PO Item allocation (poItemId: null, exact amount)', async () => {
    const dpTerm = {
      id: 201,
      poId: 1,
      sequence: 1,
      termName: 'Down Payment 20%',
      termType: PaymentTermType.DOWN_PAYMENT,
      percentage: 20.0,
      amount: 20000000,
      status: PaymentTermStatus.PENDING,
      isRetention: false,
      deletedAt: null,
    };

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(dpTerm)
      .mockResolvedValueOnce(null);

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([]);

    const dto = {
      purchaseOrderId: 1,
      paymentTermId: 201,
      invoiceDate: '2026-09-16',
    };

    const result = await service.createInvoice(dto, 88);

    expect(result).toBeDefined();
    expect(result.totalAmount).toBe(20000000);
    expect(result.paymentTermId).toBe(201);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].poItemId).toBeNull();
    expect(result.items[0].itemName).toBe('Down Payment 20%');
    expect(result.items[0].quantity).toBe(1);
    expect(result.items[0].unitPrice).toBe(20000000);
    expect(result.items[0].totalPrice).toBe(20000000);
    expect(result.totalAmount).toBe(result.items[0].totalPrice);
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });

  // Scenario 2: Retention standalone invoice detail without PO Item allocation
  it('Scenario 2: Retention standalone invoice detail without PO Item allocation (poItemId: null, exact amount)', async () => {
    const retentionTerm = {
      id: 205,
      poId: 1,
      sequence: 5,
      termName: 'Retensi Pemeliharaan 5%',
      termType: PaymentTermType.RETENTION,
      percentage: 5.0,
      amount: 5000000,
      status: PaymentTermStatus.PENDING,
      isRetention: true,
      deletedAt: null,
    };

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo, status: 'COMPLETED' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(retentionTerm)
      .mockResolvedValueOnce(null);

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([]);

    const dto = {
      purchaseOrderId: 1,
      paymentTermId: 205,
      invoiceDate: '2026-09-16',
    };

    const result = await service.createInvoice(dto, 88);

    expect(result).toBeDefined();
    expect(result.totalAmount).toBe(5000000);
    expect(result.paymentTermId).toBe(205);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].poItemId).toBeNull();
    expect(result.items[0].itemName).toBe('Retensi Pemeliharaan 5%');
    expect(result.items[0].quantity).toBe(1);
    expect(result.items[0].unitPrice).toBe(5000000);
    expect(result.items[0].totalPrice).toBe(5000000);
    expect(result.totalAmount).toBe(result.items[0].totalPrice);
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });

  // Scenario 3: DP and Retention header-detail equality
  it('Scenario 3: DP and Retention header-detail equality (rejects mismatch, accepts exact equality)', async () => {
    const dpTerm = {
      id: 201,
      poId: 1,
      termName: 'Down Payment 20%',
      termType: PaymentTermType.DOWN_PAYMENT,
      amount: 20000000,
      status: PaymentTermStatus.PENDING,
      isRetention: false,
      deletedAt: null,
    };

    // 3a. Mismatched custom items provided for DP -> rejects
    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(dpTerm)
      .mockResolvedValueOnce(null);

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([]);

    const mismatchedDto = {
      purchaseOrderId: 1,
      paymentTermId: 201,
      invoiceDate: '2026-09-16',
      items: [{ poItemId: 10, quantity: 10, unitPrice: 1000000, totalPrice: 10000000 }],
    };

    await expect(service.createInvoice(mismatchedDto, 88)).rejects.toThrow(
      /Total rincian item invoice .* tidak sesuai dengan nominal termin pembayaran/
    );
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();

    // 3b. Matching custom items provided for DP -> succeeds
    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(dpTerm)
      .mockResolvedValueOnce(null);

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([]);

    const matchedDto = {
      purchaseOrderId: 1,
      paymentTermId: 201,
      invoiceDate: '2026-09-16',
      items: [{ poItemId: 10, quantity: 20, unitPrice: 1000000, totalPrice: 20000000 }],
    };

    const matchedResult = await service.createInvoice(matchedDto, 88);
    expect(matchedResult.totalAmount).toBe(20000000);
    const sumDetails = matchedResult.items.reduce((acc, it) => acc + Number(it.totalPrice), 0);
    expect(matchedResult.totalAmount).toBe(sumDetails);
  });

  // Scenario 4: Material progress invoice with valid GR allocation
  it('Scenario 4: Material progress invoice with valid GR allocation (sum(items) === paymentTerm.amount)', async () => {
    const progressTerm = {
      id: 202,
      poId: 1,
      termName: 'Termin 1 — Progress 50%',
      termType: PaymentTermType.PROGRESS,
      amount: 50000000,
      status: PaymentTermStatus.PENDING,
      isRetention: false,
      deletedAt: null,
    };

    const gr50 = {
      id: 301,
      grNumber: 'GR-20260916-001',
      poId: 1,
      deletedAt: null,
      totalReceivedAmount: 50000000,
      items: [{ id: 401, grId: 301, poItemId: 10, receivedQuantity: 50 }],
    };

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo, status: 'PARTIALLY_FULFILLED' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(progressTerm)
      .mockResolvedValueOnce(gr50)
      .mockResolvedValueOnce(null);

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([gr50])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const dto = {
      purchaseOrderId: 1,
      paymentTermId: 202,
      goodsReceiptId: 301,
      invoiceDate: '2026-09-16',
      items: [{ poItemId: 10, quantity: 50, unitPrice: 1000000, totalPrice: 50000000 }],
    };

    const result = await service.createInvoice(dto, 88);

    expect(result).toBeDefined();
    expect(result.totalAmount).toBe(50000000);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].poItemId).toBe(10);
    expect(result.items[0].totalPrice).toBe(50000000);
    expect(result.totalAmount).toBe(result.items.reduce((s, it) => s + Number(it.totalPrice), 0));
  });

  // Scenario 5: Material progress invoice with mismatched milestone amount
  it('Scenario 5: Material progress invoice with mismatched milestone amount (rejects with BadRequestException)', async () => {
    const progressTerm = {
      id: 202,
      poId: 1,
      termName: 'Termin 1 — Progress 50%',
      termType: PaymentTermType.PROGRESS,
      amount: 50000000,
      status: PaymentTermStatus.PENDING,
      isRetention: false,
      deletedAt: null,
    };

    const poWithReceived = {
      ...baselinePo,
      status: 'PARTIALLY_FULFILLED',
      items: [{ id: 10, purchaseOrderId: 1, itemName: 'Server Rack 42U', quantity: 100, unitPrice: 1000000, receivedQuantity: 50 }],
    };

    const gr50 = {
      id: 301,
      grNumber: 'GR-20260916-001',
      poId: 1,
      deletedAt: null,
      totalReceivedAmount: 50000000,
      items: [{ id: 401, grId: 301, poItemId: 10, receivedQuantity: 50 }],
    };

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce(poWithReceived)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(progressTerm)
      .mockResolvedValueOnce(gr50)
      .mockResolvedValueOnce(null);

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([gr50])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const mismatchedDto = {
      purchaseOrderId: 1,
      paymentTermId: 202,
      goodsReceiptId: 301,
      invoiceDate: '2026-09-16',
      items: [{ poItemId: 10, quantity: 40, unitPrice: 1000000, totalPrice: 40000000 }],
    };

    await expect(service.createInvoice(mismatchedDto, 88)).rejects.toThrow(
      /Total rincian item invoice .* tidak sesuai dengan nominal termin pembayaran/
    );
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  // Scenario 6: Service progress invoice with approved Service Claim
  it('Scenario 6: Service progress invoice with approved Service Claim derives items and reconciles header-detail', async () => {
    const servicePo = {
      id: 2,
      poNumber: 'PO-SVC-2026-001',
      status: 'PARTIALLY_FULFILLED',
      orderType: 'SERVICE',
      totalAmount: 100000000,
      vendorId: 7,
      purchaseRequest: { projectId: 12 },
      items: [
        { id: 20, purchaseOrderId: 2, itemName: 'Jasa Implementasi Server', quantity: 1, unitPrice: 100000000 },
      ],
    };

    const serviceClaim = {
      id: 401,
      poId: 2,
      vendorId: 7,
      projectId: 12,
      claimNumber: 'SC-2026-001',
      status: ServiceClaimStatus.APPROVED_FOR_INVOICE,
      approvedClaimAmount: 30000000,
      deletedAt: null,
      items: [
        {
          poItemId: 20,
          itemNameSnapshot: 'Jasa Implementasi Server - Fase 1',
          currentClaimQuantity: 0.3,
          contractUnitRateSnapshot: 100000000,
        },
      ],
    };

    const serviceTerm = {
      id: 301,
      poId: 2,
      termName: 'Termin Jasa 30%',
      termType: PaymentTermType.PROGRESS,
      amount: 30000000,
      status: PaymentTermStatus.PENDING,
      deletedAt: null,
    };

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce(servicePo)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(serviceTerm)
      .mockResolvedValueOnce(null) // active invoice check at line 270
      .mockResolvedValueOnce(serviceClaim); // ServiceClaim lookup at line 300

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const dto = {
      purchaseOrderId: 2,
      paymentTermId: 301,
      serviceClaimId: 401,
      invoiceDate: '2026-09-16',
    };

    const result = await service.createInvoice(dto, 88);

    expect(result).toBeDefined();
    expect(result.totalAmount).toBe(30000000);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].poItemId).toBe(20);
    expect(result.items[0].totalPrice).toBe(30000000);
    expect(result.totalAmount).toBe(result.items.reduce((s, it) => s + Number(it.totalPrice), 0));
  });

  // Scenario 7: Final delivery regression (preserves residual rules)
  it('Scenario 7: Final delivery regression preserves residual and fulfillment rules', async () => {
    const finalTerm = {
      id: 204,
      poId: 1,
      termName: 'Pelunasan Final Delivery 20%',
      termType: PaymentTermType.FINAL_DELIVERY,
      amount: 20000000,
      status: PaymentTermStatus.PENDING,
      deletedAt: null,
    };

    const priorInvoice80 = {
      id: 501,
      poId: 1,
      paymentTermId: 201,
      status: 'PAID',
      matchStatus: 'VERIFIED',
      deletedAt: null,
      items: [{ id: 601, invoiceId: 501, poItemId: 10, quantity: 80, unitPrice: 1000000, totalPrice: 80000000, deletedAt: null }],
    };

    // 7a. Exceeding remaining billable quantity -> rejects
    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo, status: 'PARTIALLY_FULFILLED' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(finalTerm)
      .mockResolvedValueOnce(null);

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([priorInvoice80]);

    const excessiveDto = {
      purchaseOrderId: 1,
      paymentTermId: 204,
      invoiceDate: '2026-09-16',
      items: [{ poItemId: 10, quantity: 25, unitPrice: 1000000, totalPrice: 25000000 }],
    };

    await expect(service.createInvoice(excessiveDto, 88)).rejects.toThrow(
      /melebihi sisa kuantitas yang dapat ditagihkan \(20\)/
    );

    // 7b. Exactly remaining 20 units -> succeeds
    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo, status: 'PARTIALLY_FULFILLED' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(finalTerm)
      .mockResolvedValueOnce(null);

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([priorInvoice80]);

    const validFinalDto = {
      purchaseOrderId: 1,
      paymentTermId: 204,
      invoiceDate: '2026-09-16',
      items: [{ poItemId: 10, quantity: 20, unitPrice: 1000000, totalPrice: 20000000 }],
    };

    const finalResult = await service.createInvoice(validFinalDto, 88);
    expect(finalResult.totalAmount).toBe(20000000);
    expect(finalResult.items[0].quantity).toBe(20);
    expect(finalResult.items[0].totalPrice).toBe(20000000);
    expect(finalResult.totalAmount).toBe(finalResult.items.reduce((s, it) => s + Number(it.totalPrice), 0));
  });

  // Scenario 8: Existing non-term invoice regression (Branch B header equals item sum)
  it('Scenario 8: Existing non-term invoice regression (Branch B header equals item sum)', async () => {
    const nonTermPo = {
      ...baselinePo,
      status: 'COMPLETED',
      totalAmount: 25000000,
      items: [
        { id: 10, purchaseOrderId: 1, itemName: 'Item A', quantity: 10, unitPrice: 1000000, receivedQuantity: 10 },
        { id: 11, purchaseOrderId: 1, itemName: 'Item B', quantity: 5, unitPrice: 3000000, receivedQuantity: 5 },
      ],
    };

    const grNonTerm = {
      id: 301,
      grNumber: 'GR-20260916-001',
      poId: 1,
      deletedAt: null,
      items: [
        { id: 401, grId: 301, poItemId: 10, receivedQuantity: 10 },
        { id: 402, grId: 301, poItemId: 11, receivedQuantity: 5 },
      ],
    };

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce(nonTermPo)
      .mockResolvedValueOnce(null);

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([grNonTerm]);

    const dto = {
      purchaseOrderId: 1,
      invoiceDate: '2026-09-16',
      items: [
        { poItemId: 10, quantity: 10, unitPrice: 1000000, totalPrice: 10000000 },
        { poItemId: 11, quantity: 5, unitPrice: 3000000, totalPrice: 15000000 },
      ],
    };

    const result = await service.createInvoice(dto, 88);

    expect(result).toBeDefined();
    expect(result.paymentTermId).toBeUndefined();
    expect(result.totalAmount).toBe(25000000);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].totalPrice).toBe(10000000);
    expect(result.items[1].totalPrice).toBe(15000000);
    expect(result.totalAmount).toBe(result.items.reduce((s, it) => s + Number(it.totalPrice), 0));
  });

  // Scenario 9: Existing payment and PaymentTerm lifecycle regression
  it('Scenario 9: Existing payment and PaymentTerm lifecycle regression (enforces term amount and updates status to PAID)', async () => {
    const verifiedInvoice = {
      id: 10,
      poId: 1,
      companyCode: 'UBD',
      paymentTermId: 201,
      totalAmount: 30000000,
      matchStatus: 'VERIFIED',
      paymentStatus: 'UNPAID',
      deletedAt: null,
    };

    const paymentTerm = {
      id: 201,
      poId: 1,
      amount: 30000000,
      status: PaymentTermStatus.VERIFIED,
      deletedAt: null,
    };

    const prqApproved = {
      id: 100,
      invoiceId: 10,
      companyCode: 'UBD',
      paymentTermId: 201,
      status: PaymentRequestStatus.APPROVED_FOR_PAYMENT,
      approvedBy: 999,
      requestedAmount: 30000000,
      approvedAmount: 30000000,
      deletedAt: null,
    };

    const mockCba = {
      id: 1,
      companyCode: 'UBD',
      bankName: 'Bank Mandiri',
      bankCode: '008',
      accountNumber: '1234567890',
      accountHolderName: 'PT Utama Bangun Dananjaya',
      accountType: 'GIRO',
      accountPurpose: 'OPERATIONAL',
      currency: 'IDR',
      status: CompanyBankAccountStatus.ACTIVE,
      isDefault: true,
      effectiveDate: '2026-01-01',
      expiryDate: null,
      deletedAt: null,
    };

    const setupMocks = () => {
      mockQueryRunner.manager.findOne.mockImplementation(async (entityClass: any, options: any) => {
        if (entityClass === Invoice) return verifiedInvoice;
        if (entityClass === PaymentRequest) return prqApproved;
        if (entityClass === PurchaseOrder) return { id: 1, companyCode: 'UBD', totalAmount: 100000000, deletedAt: null };
        if (entityClass === PoPaymentTerm) return paymentTerm;
        if (entityClass === CompanyBankAccount) return mockCba;
        if (entityClass === Payment) return null;
        return null;
      });

      mockQueryRunner.manager.find.mockImplementation(async (entityClass: any, options: any) => {
        if (entityClass === Payment) return [];
        if (entityClass === Invoice) return [verifiedInvoice];
        if (entityClass === PoPaymentTerm) return [paymentTerm];
        if (entityClass === GoodsReceipt) return [];
        return [];
      });

      mockQueryRunner.manager.count.mockResolvedValue(0);
    };

    // 9a. Mismatched payment amount -> rejected
    setupMocks();
    const mismatchedPayDto = {
      invoiceId: 10,
      paymentRequestId: 100,
      companyBankAccountId: 1,
      paymentAmount: 20000000,
      paymentDate: '2026-09-16',
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'REF-20260916-001',
    };

    await expect(service.createPayment(mismatchedPayDto, 3)).rejects.toThrow(
      /harus sesuai dengan nilai termin pembayaran Procurement/
    );

    // 9b. Authoritative term payment -> succeeds, updates term to PAID
    setupMocks();
    const validPayDto = {
      invoiceId: 10,
      paymentRequestId: 100,
      companyBankAccountId: 1,
      paymentAmount: 30000000,
      paymentDate: '2026-09-16',
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'REF-20260916-002',
    };

    const result = await service.createPayment(validPayDto, 3);
    expect(result).toBeDefined();
    expect(result.paymentNumber).toBeDefined();
    expect(paymentTerm.status).toBe(PaymentTermStatus.PAID);
    expect(verifiedInvoice.paymentStatus).toBe('PAID');
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });

  // Scenario 10: Prevention of duplicate billing and overbilling
  it('Scenario 10: Prevention of duplicate billing and overbilling (rejects when activeInvoicedSum + total > po.totalAmount)', async () => {
    const cappedPo = {
      ...baselinePo,
      totalAmount: 100000000,
    };

    const newTerm = {
      id: 203,
      poId: 1,
      termName: 'Termin 3 — Pelunasan 25%',
      termType: PaymentTermType.FINAL_DELIVERY,
      amount: 25000000,
      status: PaymentTermStatus.PENDING,
      deletedAt: null,
    };

    const priorInvoice1 = {
      id: 501,
      poId: 1,
      paymentTermId: 201,
      totalAmount: 50000000,
      status: 'PAID',
      matchStatus: 'VERIFIED',
      deletedAt: null,
      items: [],
    };

    const priorInvoice2 = {
      id: 502,
      poId: 1,
      paymentTermId: 202,
      totalAmount: 30000000,
      status: 'PAID',
      matchStatus: 'VERIFIED',
      deletedAt: null,
      items: [],
    };

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce(cappedPo)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(newTerm)
      .mockResolvedValueOnce(null);

    mockQueryRunner.manager.find
      .mockResolvedValueOnce([priorInvoice1, priorInvoice2]);

    const dto = {
      purchaseOrderId: 1,
      paymentTermId: 203,
      invoiceDate: '2026-09-16',
      items: [{ poItemId: 10, quantity: 25, unitPrice: 1000000, totalPrice: 25000000 }],
    };

    await expect(service.createInvoice(dto, 88)).rejects.toThrow(
      'Akumulasi nilai invoice melebihi total Purchase Order.'
    );
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
  });
});
