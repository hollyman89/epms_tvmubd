import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, In } from 'typeorm';

import { ProcurementService } from './procurement.service';
import { ProcurementController } from './procurement.controller';
import { ProcurementPackageService } from './procurement-package.service';
import { ServiceClaimService } from './service-claim.service';
import { WorkflowService } from '../workflow-engine/workflow.service';

import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { PurchaseRequestItem } from '../../entities/purchase-request-item.entity';
import { Rfq } from '../../entities/rfq.entity';
import { Vendor } from '../../entities/vendor.entity';
import { VendorComparison } from '../../entities/vendor-comparison.entity';
import { Quotation } from '../../entities/quotation.entity';
import { QuotationItem } from '../../entities/quotation-item.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../entities/purchase-order-item.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { GoodsReceiptItem } from '../../entities/goods-receipt-item.entity';
import { PoPaymentTerm, PaymentTermType, PaymentTermStatus } from '../../entities/po-payment-term.entity';

describe('EPMS — PO Payment Terms Recovery & Contract Specification (Phases 1-6)', () => {
  let service: ProcurementService;
  let prRepoMock: any;
  let poRepoMock: any;
  let grRepoMock: any;
  let rfqRepoMock: any;
  let vendorRepoMock: any;
  let quotationRepoMock: any;
  let quotationItemRepoMock: any;
  let vendorComparisonRepoMock: any;
  let queryRunnerMock: any;
  let dataSourceMock: any;
  let eventEmitterMock: any;

  const mockPr = {
    id: 1,
    prNumber: 'PR-20261015-001',
    status: 'APPROVED',
  };

  const mockRfq = {
    id: 1,
    prId: 1,
    status: 'EVALUATED',
  };

  const mockWinnerComparison = {
    id: 1,
    rfqId: 1,
    vendorId: 4,
    isWinner: true,
  };

  const mockItems = [
    { item_name: 'Material A', quantity: 10, unit_price: 5000, total_price: 50000 },
    { item_name: 'Material B', quantity: 5, unit_price: 10000, total_price: 50000 },
  ]; // Total = 100,000

  beforeEach(async () => {
    prRepoMock = {
      findOne: jest.fn().mockResolvedValue({ ...mockPr }),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
    };

    poRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    grRepoMock = {};
    rfqRepoMock = {
      find: jest.fn().mockResolvedValue([mockRfq]),
    };
    vendorRepoMock = {};
    quotationRepoMock = {};
    quotationItemRepoMock = {};

    vendorComparisonRepoMock = {
      findOne: jest.fn().mockResolvedValue(mockWinnerComparison),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockWinnerComparison),
      }),
    };

    queryRunnerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation((entityClass, data) => ({ ...data })),
        save: jest.fn().mockImplementation((entityClassOrData, maybeData) => {
          const data = maybeData !== undefined ? maybeData : entityClassOrData;
          if (Array.isArray(data)) {
            return Promise.resolve(data.map((item, idx) => ({ id: idx + 1, ...item })));
          }
          return Promise.resolve({ id: data.id || 1, ...data });
        }),
        findOne: jest.fn(),
        find: jest.fn(),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
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
        ProcurementService,
        Reflector,
        { provide: 'PurchaseRequestRepository', useValue: prRepoMock },
        { provide: 'RfqRepository', useValue: rfqRepoMock },
        { provide: 'VendorRepository', useValue: vendorRepoMock },
        { provide: 'QuotationRepository', useValue: quotationRepoMock },
        { provide: 'QuotationItemRepository', useValue: quotationItemRepoMock },
        { provide: 'VendorComparisonRepository', useValue: vendorComparisonRepoMock },
        { provide: 'PurchaseOrderRepository', useValue: poRepoMock },
        { provide: 'GoodsReceiptRepository', useValue: grRepoMock },
        { provide: WorkflowService, useValue: {} },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: EventEmitter2, useValue: eventEmitterMock },
      ],
    }).compile();

    service = module.get<ProcurementService>(ProcurementService);
  });

  // 1. PO creation with valid payment terms persists terms
  it('1. PO creation with valid payment terms persists terms into po_payment_terms', async () => {
    const dto: any = {
      purchase_request_id: 1,
      vendor_id: 4,
      po_items: mockItems,
      payment_terms: [
        { sequence: 1, term_name: 'Uang Muka / DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 30, trigger_condition: 'PO Diterbitkan' },
        { sequence: 2, term_name: 'Progress 1', term_type: PaymentTermType.PROGRESS, percentage: 40, trigger_condition: 'BAST 1' },
        { sequence: 3, term_name: 'Pelunasan', term_type: PaymentTermType.FINAL_DELIVERY, percentage: 30, trigger_condition: 'BAST Final' },
      ],
    };

    const result = await service.createPurchaseOrder(42, dto);

    expect(result.success).toBe(true);
    expect(result.data.paymentTerms).toBeDefined();
    expect(result.data.paymentTerms).toHaveLength(3);
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    expect(eventEmitterMock.emit).toHaveBeenCalledWith(
      'procurement.po.issued',
      expect.objectContaining({
        eventName: 'procurement.po.issued',
        eventVersion: 1,
        aggregateType: 'PurchaseOrder',
        routing: expect.objectContaining({
          roles: expect.arrayContaining(['PROCUREMENT', 'PURCHASING', 'FINANCE', 'SUPER_ADMIN']),
        }),
      }),
    );
    expect(eventEmitterMock.emit).toHaveBeenCalledWith('po.created', expect.any(Object));
  });

  // 2. Percentages must total 100%
  it('2. Accepts payment terms when percentage total strictly equals 100.00%', async () => {
    const dto: any = {
      purchase_request_id: 1,
      vendor_id: 4,
      po_items: mockItems,
      payment_terms: [
        { sequence: 1, term_name: 'DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 25 },
        { sequence: 2, term_name: 'Progress', term_type: PaymentTermType.PROGRESS, percentage: 50 },
        { sequence: 3, term_name: 'Final', term_type: PaymentTermType.FINAL_DELIVERY, percentage: 25 },
      ],
    };

    const result = await service.createPurchaseOrder(42, dto);
    expect(result.success).toBe(true);
    const sumPct = result.data.paymentTerms.reduce((sum: number, t: any) => sum + t.percentage, 0);
    expect(sumPct).toBe(100);
  });

  // 3. Invalid total rejected
  it('3. Rejects payment terms when percentage total does not equal 100.00%', async () => {
    const dtoUnder: any = {
      purchase_request_id: 1,
      vendor_id: 4,
      po_items: mockItems,
      payment_terms: [
        { sequence: 1, term_name: 'DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 30 },
        { sequence: 2, term_name: 'Progress', term_type: PaymentTermType.PROGRESS, percentage: 50 },
      ], // 80%
    };

    await expect(service.createPurchaseOrder(42, dtoUnder)).rejects.toThrow(
      'Total persentase payment terms harus tepat 100%.',
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();

    const dtoOver: any = {
      purchase_request_id: 1,
      vendor_id: 4,
      po_items: mockItems,
      payment_terms: [
        { sequence: 1, term_name: 'DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 60 },
        { sequence: 2, term_name: 'Progress', term_type: PaymentTermType.PROGRESS, percentage: 50 },
      ], // 110%
    };

    await expect(service.createPurchaseOrder(42, dtoOver)).rejects.toThrow(
      'Total persentase payment terms harus tepat 100%.',
    );
  });

  // 4. Amounts calculated correctly
  it('4. Calculates authoritative amounts for each term proportional to totalAmount', async () => {
    const dto: any = {
      purchase_request_id: 1,
      vendor_id: 4,
      po_items: mockItems, // Total 100,000
      payment_terms: [
        { sequence: 1, term_name: 'DP 20%', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 20 },
        { sequence: 2, term_name: 'Term 1 40%', term_type: PaymentTermType.PROGRESS, percentage: 40 },
        { sequence: 3, term_name: 'Term 2 30%', term_type: PaymentTermType.PROGRESS, percentage: 30 },
        { sequence: 4, term_name: 'Retention 10%', term_type: PaymentTermType.RETENTION, percentage: 10, is_retention: true, retention_days: 90 },
      ],
    };

    const result = await service.createPurchaseOrder(42, dto);
    const terms = result.data.paymentTerms;

    expect(terms[0].amount).toBe(20000); // 20% of 100,000
    expect(terms[1].amount).toBe(40000); // 40% of 100,000
    expect(terms[2].amount).toBe(30000); // 30% of 100,000
    expect(terms[3].amount).toBe(10000); // 10% of 100,000
  });

  // 5. Rounding remainder handled canonically
  it('5. Handles rounding remainder canonically on the final term so total strictly matches PO total', async () => {
    // Total = 100,000 with 33.33%, 33.33%, 33.34%
    const dto: any = {
      purchase_request_id: 1,
      vendor_id: 4,
      po_items: mockItems, // Total 100,000
      payment_terms: [
        { sequence: 1, term_name: 'Term 1', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 33.33 },
        { sequence: 2, term_name: 'Term 2', term_type: PaymentTermType.PROGRESS, percentage: 33.33 },
        { sequence: 3, term_name: 'Term 3', term_type: PaymentTermType.FINAL_DELIVERY, percentage: 33.34 },
      ],
    };

    const result = await service.createPurchaseOrder(42, dto);
    const terms = result.data.paymentTerms;

    expect(terms[0].amount).toBe(33330);
    expect(terms[1].amount).toBe(33330);
    expect(terms[2].amount).toBe(33340); // 100,000 - 66,660 = 33,340

    const sumAmounts = terms.reduce((sum: number, t: any) => sum + t.amount, 0);
    expect(sumAmounts).toBe(100000);
  });

  // 6. Retention rule preserved
  it('6. Validates retention semantics and preserves retention_days > 0', async () => {
    // Missing retention_days
    const invalidRetentionDto: any = {
      purchase_request_id: 1,
      vendor_id: 4,
      po_items: mockItems,
      payment_terms: [
        { sequence: 1, term_name: 'DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 90 },
        { sequence: 2, term_name: 'Retensi', term_type: PaymentTermType.RETENTION, percentage: 10, is_retention: true },
      ],
    };

    await expect(service.createPurchaseOrder(42, invalidRetentionDto)).rejects.toThrow(
      'Termin retensi "Retensi" wajib memiliki retention_days lebih besar dari 0 hari',
    );

    // Valid retention
    const validRetentionDto: any = {
      purchase_request_id: 1,
      vendor_id: 4,
      po_items: mockItems,
      payment_terms: [
        { sequence: 1, term_name: 'DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 90 },
        { sequence: 2, term_name: 'Retensi', term_type: PaymentTermType.RETENTION, percentage: 10, is_retention: true, retention_days: 180 },
      ],
    };

    const result = await service.createPurchaseOrder(42, validRetentionDto);
    expect(result.success).toBe(true);
    expect(result.data.paymentTerms[1].isRetention).toBe(true);
    expect(result.data.paymentTerms[1].retentionDays).toBe(180);
  });

  // 7. Payment terms linked to correct PO
  it('7. Links every PoPaymentTerm row to the created PO id', async () => {
    const dto: any = {
      purchase_request_id: 1,
      vendor_id: 4,
      po_items: mockItems,
      payment_terms: [
        { sequence: 1, term_name: 'Pelunasan', term_type: PaymentTermType.FINAL_DELIVERY, percentage: 100 },
      ],
    };

    const result = await service.createPurchaseOrder(42, dto);
    const createdPoId = result.data.id;
    const term = result.data.paymentTerms[0];

    expect(term.poId).toBe(createdPoId);
    expect(term.createdBy).toBe(42);
    expect(term.status).toBe(PaymentTermStatus.PENDING);
  });

  // 8. Failure rolls back full PO transaction
  it('8. Atomic Transaction: failure during payment term save rolls back full PO transaction', async () => {
    queryRunnerMock.manager.save.mockImplementation((entityClassOrData: any, maybeData: any) => {
      if (entityClassOrData === PoPaymentTerm) {
        return Promise.reject(new Error('Simulated Database Crash on PoPaymentTerm write'));
      }
      const data = maybeData !== undefined ? maybeData : entityClassOrData;
      return Promise.resolve({ id: 1, ...data });
    });

    const dto: any = {
      purchase_request_id: 1,
      vendor_id: 4,
      po_items: mockItems,
      payment_terms: [
        { sequence: 1, term_name: 'Full', term_type: PaymentTermType.FINAL_DELIVERY, percentage: 100 },
      ],
    };

    await expect(service.createPurchaseOrder(42, dto)).rejects.toThrow(
      'Simulated Database Crash on PoPaymentTerm write',
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunnerMock.release).toHaveBeenCalled();
  });

  // 9. getPurchaseOrderById returns paymentTerms
  it('9. getPurchaseOrderById projects paymentTerms relation and orders by sequence ASC', async () => {
    const mockTermsUnordered = [
      { id: 3, sequence: 3, termName: 'Final', percentage: 20 },
      { id: 1, sequence: 1, termName: 'DP', percentage: 30 },
      { id: 2, sequence: 2, termName: 'Progress', percentage: 50 },
    ];

    poRepoMock.findOne.mockResolvedValue({
      id: 1,
      poNumber: 'PO-20261015-001',
      items: [],
      paymentTerms: mockTermsUnordered,
    });

    const res = await service.getPurchaseOrderById(1);

    expect(poRepoMock.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
      relations: ['items', 'paymentTerms', 'vendor', 'purchaseRequest', 'purchaseRequest.project'],
      order: {
        paymentTerms: {
          sequence: 'ASC',
        },
      },
    });

    expect(res.success).toBe(true);
    expect(res.data.paymentTerms).toBeDefined();
    expect(res.data.paymentTerms.map((t: any) => t.sequence)).toEqual([1, 2, 3]);
    expect(res.data.paymentTerms.map((t: any) => t.termName)).toEqual(['DP', 'Progress', 'Final']);
  });

  // 10. term-based Finance invoice can resolve persisted paymentTermId
  it('10. Persisted payment terms satisfy term-based Finance invoice prerequisites (status PENDING, poId bound, sequence ordered)', async () => {
    const dto: any = {
      purchase_request_id: 1,
      vendor_id: 4,
      po_items: mockItems,
      payment_terms: [
        { sequence: 1, term_name: 'DP 30%', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 30 },
        { sequence: 2, term_name: 'Final 70%', term_type: PaymentTermType.FINAL_DELIVERY, percentage: 70 },
      ],
    };

    const result = await service.createPurchaseOrder(10, dto);
    const [dpTerm, finalTerm] = result.data.paymentTerms;

    // Finance Invoice Branch A Prerequisite Checks
    expect(dpTerm.id).toBeDefined();
    expect(dpTerm.poId).toBe(result.data.id);
    expect(dpTerm.status).toBe(PaymentTermStatus.PENDING);
    expect(dpTerm.termType).toBe(PaymentTermType.DOWN_PAYMENT);
    expect(dpTerm.sequence).toBe(1);

    expect(finalTerm.id).toBeDefined();
    expect(finalTerm.poId).toBe(result.data.id);
    expect(finalTerm.status).toBe(PaymentTermStatus.PENDING);
    expect(finalTerm.sequence).toBe(2);

    // Verification that Finance Branch A lookup criteria match
    const financeLookupCriteria = {
      where: { id: dpTerm.id },
      poIdMatch: dpTerm.poId === result.data.id,
      canInvoice: dpTerm.status === PaymentTermStatus.PENDING,
    };

    expect(financeLookupCriteria.poIdMatch).toBe(true);
    expect(financeLookupCriteria.canInvoice).toBe(true);
  });

  // 11. Multi-RFQ Safety: When a PR has multiple RFQs, issuing PO terminalizes ONLY the winning evaluated RFQ and leaves sibling RFQs untouched
  it('11. Multi-RFQ Safety: issuing PO terminalizes ONLY the winning evaluated RFQ and leaves sibling RFQs untouched', async () => {
    const mockRfqSibling = {
      id: 2,
      prId: 1,
      status: 'OPEN',
    };
    rfqRepoMock.find.mockResolvedValue([mockRfq, mockRfqSibling]);

    const dto: any = {
      purchase_request_id: 1,
      vendor_id: 4,
      po_items: mockItems,
      payment_terms: [
        { sequence: 1, term_name: 'Pelunasan 100%', term_type: PaymentTermType.FINAL_DELIVERY, percentage: 100 },
      ],
    };

    await service.createPurchaseOrder(10, dto);

    // Verify update was called specifically for Rfq #1 (the winning evaluated RFQ) with status OPEN guard
    expect(queryRunnerMock.manager.update).toHaveBeenCalledWith(
      Rfq,
      { id: 1, status: 'OPEN' },
      { status: 'EVALUATED' },
    );
    // Verify sibling Rfq #2 was NEVER updated
    expect(queryRunnerMock.manager.update).not.toHaveBeenCalledWith(
      Rfq,
      expect.objectContaining({ id: 2 }),
      expect.anything(),
    );
  });
});
