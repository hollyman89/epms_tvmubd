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
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

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
