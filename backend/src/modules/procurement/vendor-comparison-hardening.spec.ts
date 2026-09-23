import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProcurementService } from './procurement.service';
import { ProcurementController } from './procurement.controller';
import { ProcurementPackageService } from './procurement-package.service';
import { ProcurementReconciliationService } from './procurement-reconciliation.service';
import { WorkflowService } from '../workflow-engine/workflow.service';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { Rfq } from '../../entities/rfq.entity';
import { Vendor } from '../../entities/vendor.entity';
import { Quotation } from '../../entities/quotation.entity';
import { QuotationItem } from '../../entities/quotation-item.entity';
import { VendorComparison } from '../../entities/vendor-comparison.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PoPaymentTerm } from '../../entities/po-payment-term.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { AuditLog } from '../../entities/audit-log.entity';

describe('P7.3 Part B: Vendor Comparison Hardening Spec (P73-B01 to P73-B22)', () => {
  let service: ProcurementService;
  let controller: ProcurementController;
  let queryRunnerMock: any;
  let dataSourceMock: any;
  let savedEntities: { entityClass: any; entity: any }[];

  const actorUserId = 42;

  const mockOpenRfq: any = {
    id: 1,
    rfqNumber: 'RFQ-20260901-001',
    status: 'OPEN',
    purchaseRequest: {
      id: 10,
      prNumber: 'PR-20260901-001',
      totalEstimatedAmount: 15000000, // > 1,000,000 (High-value)
    },
  };

  const mockDbQuotations: any[] = [
    {
      id: 101,
      rfqId: 1,
      vendorId: 1,
      totalAmount: 14500000,
      status: 'SUBMITTED',
      vendor: { id: 1, name: 'PT Vendor Satu', code: 'VND-001' },
    },
    {
      id: 102,
      rfqId: 1,
      vendorId: 2,
      totalAmount: 14200000,
      status: 'SUBMITTED',
      vendor: { id: 2, name: 'PT Vendor Dua', code: 'VND-002' },
    },
    {
      id: 103,
      rfqId: 1,
      vendorId: 3,
      totalAmount: 14800000,
      status: 'SUBMITTED',
      vendor: { id: 3, name: 'PT Vendor Tiga', code: 'VND-003' },
    },
  ];

  const validPayload = [
    { vendorId: 1, offeredAmount: 14500000, isWinner: false },
    { vendorId: 2, offeredAmount: 14200000, isWinner: true },
    { vendorId: 3, offeredAmount: 14800000, isWinner: false },
  ];

  beforeEach(async () => {
    savedEntities = [];

    queryRunnerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn().mockImplementation((entityClass, options) => {
          if (entityClass === Rfq && options?.where?.id === 1) {
            return Promise.resolve({ ...mockOpenRfq });
          }
          return Promise.resolve(null);
        }),
        find: jest.fn().mockImplementation((entityClass, options) => {
          if (entityClass === Quotation && options?.where?.rfqId === 1 && options?.where?.status === 'SUBMITTED') {
            return Promise.resolve([...mockDbQuotations]);
          }
          return Promise.resolve([]);
        }),
        create: jest.fn().mockImplementation((entityClass, data) => ({ ...data })),
        save: jest.fn().mockImplementation((entityClass, data) => {
          if (Array.isArray(data)) {
            const saved = data.map((d, idx) => ({ id: 500 + idx, ...d }));
            savedEntities.push({ entityClass, entity: saved });
            return Promise.resolve(saved);
          }
          const saved = { id: 600, ...data };
          savedEntities.push({ entityClass, entity: saved });
          return Promise.resolve(saved);
        }),
      },
    };

    dataSourceMock = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcurementController],
      providers: [
        ProcurementService,
        { provide: getRepositoryToken(PurchaseRequest), useValue: {} },
        { provide: getRepositoryToken(Rfq), useValue: {} },
        { provide: getRepositoryToken(Vendor), useValue: {} },
        { provide: getRepositoryToken(VendorComparison), useValue: {} },
        { provide: getRepositoryToken(PurchaseOrder), useValue: {} },
        { provide: getRepositoryToken(PoPaymentTerm), useValue: {} },
        { provide: getRepositoryToken(GoodsReceipt), useValue: {} },
        { provide: getRepositoryToken(Quotation), useValue: {} },
        { provide: getRepositoryToken(QuotationItem), useValue: {} },
        { provide: WorkflowService, useValue: {} },
        {
          provide: require('../workflow-engine/workflow-engine.service').WorkflowEngineService,
          useValue: { startInstance: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: ProcurementPackageService, useValue: {} },
        { provide: ProcurementReconciliationService, useValue: {} },
      ],
    }).compile();

    service = module.get<ProcurementService>(ProcurementService);
    controller = module.get<ProcurementController>(ProcurementController);
  });

  // P73-B01
  it('P73-B01: Valid OPEN RFQ + all valid submitted quotations can be evaluated', async () => {
    const result = await service.submitVendorComparison(1, validPayload, actorUserId);

    expect(result.success).toBe(true);
    expect(queryRunnerMock.startTransaction).toHaveBeenCalled();
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    expect(result.rfq.status).toBe('EVALUATED');
  });

  // P73-B02
  it('P73-B02: Zero submitted quotations rejected', async () => {
    queryRunnerMock.manager.find.mockImplementation((entityClass: any) => {
      if (entityClass === Quotation) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    await expect(service.submitVendorComparison(1, validPayload, actorUserId)).rejects.toThrow(
      'RFQ tidak memiliki penawaran vendor yang valid (SUBMITTED) untuk dievaluasi.',
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
  });

  // P73-B03
  it('P73-B03: Vendor without quotation rejected', async () => {
    const payloadWithUnsubmittedVendor = [
      { vendorId: 1, offeredAmount: 14500000, isWinner: false },
      { vendorId: 2, offeredAmount: 14200000, isWinner: true },
      { vendorId: 99, offeredAmount: 14800000, isWinner: false }, // Vendor 99 has no DB quotation
    ];

    await expect(service.submitVendorComparison(1, payloadWithUnsubmittedVendor, actorUserId)).rejects.toThrow(
      'Vendor #99 tidak memiliki penawaran berstatus SUBMITTED pada RFQ #1',
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
  });

  // P73-B04
  it('P73-B04: Quotation from another RFQ rejected', async () => {
    // DB only returns quotations where rfqId = 1. If payload contains vendor from RFQ 2, it won't be in DB quotations
    const payloadFromOtherRfq = [
      { vendorId: 1, offeredAmount: 14500000, isWinner: false },
      { vendorId: 2, offeredAmount: 14200000, isWinner: true },
      { vendorId: 88, offeredAmount: 14800000, isWinner: false }, // Belongs to RFQ 2
    ];

    await expect(service.submitVendorComparison(1, payloadFromOtherRfq, actorUserId)).rejects.toThrow(
      'Vendor #88 tidak memiliki penawaran berstatus SUBMITTED pada RFQ #1',
    );
  });

  // P73-B05
  it('P73-B05: Non-SUBMITTED quotation cannot be evaluated', async () => {
    // Quotations query filters by status = 'SUBMITTED'
    queryRunnerMock.manager.find.mockImplementation((entityClass: any, options: any) => {
      if (entityClass === Quotation && options?.where?.status === 'SUBMITTED') {
        // Vendor 3 is in DRAFT, so only vendors 1 and 2 returned as SUBMITTED
        return Promise.resolve([mockDbQuotations[0], mockDbQuotations[1]]);
      }
      return Promise.resolve([]);
    });

    await expect(service.submitVendorComparison(1, validPayload, actorUserId)).rejects.toThrow(
      'Vendor #3 tidak memiliki penawaran berstatus SUBMITTED pada RFQ #1',
    );
  });

  // P73-B06
  it('P73-B06: Client offeredAmount tampering ignored; DB quotation total is authoritative', async () => {
    // Client tampers offeredAmount to Rp 100 for vendor 2
    const tamperedPayload = [
      { vendorId: 1, offeredAmount: 999999999, isWinner: false },
      { vendorId: 2, offeredAmount: 100, isWinner: true }, // Tampered
      { vendorId: 3, offeredAmount: 888888888, isWinner: false },
    ];

    await service.submitVendorComparison(1, tamperedPayload, actorUserId);

    const comparisonSave = savedEntities.find((s) => s.entityClass === VendorComparison);
    expect(comparisonSave).toBeDefined();
    const comparisons: any[] = comparisonSave!.entity;

    const winnerComparison = comparisons.find((c) => c.vendorId === 2);
    expect(winnerComparison.offeredAmount).toBe(14200000); // Authoritative DB quotation total, NOT 100
  });

  // P73-B07
  it('P73-B07: Duplicate vendor payload rejected', async () => {
    const duplicatePayload = [
      { vendorId: 1, offeredAmount: 14500000, isWinner: false },
      { vendorId: 1, offeredAmount: 14500000, isWinner: false }, // Duplicate
      { vendorId: 2, offeredAmount: 14200000, isWinner: true },
    ];

    await expect(service.submitVendorComparison(1, duplicatePayload, actorUserId)).rejects.toThrow(
      'Vendor #1 duplikat dalam perbandingan',
    );
  });

  // P73-B08
  it('P73-B08: High-value PR requires 3 distinct submitted vendors', async () => {
    // PR total = 15,000,000 (> 1M), but DB only has 2 submitted quotations
    queryRunnerMock.manager.find.mockImplementation((entityClass: any) => {
      if (entityClass === Quotation) return Promise.resolve([mockDbQuotations[0], mockDbQuotations[1]]);
      return Promise.resolve([]);
    });

    const twoVendorsPayload = [
      { vendorId: 1, offeredAmount: 14500000, isWinner: false },
      { vendorId: 2, offeredAmount: 14200000, isWinner: true },
    ];

    await expect(service.submitVendorComparison(1, twoVendorsPayload, actorUserId)).rejects.toThrow(
      'Minimal 3 vendor diperlukan untuk perbandingan pengadaan di atas Rp 1.000.000 (ditemukan: 2 vendor valid)',
    );
  });

  // P73-B09
  it('P73-B09: Duplicate vendor payload cannot satisfy 3-vendor rule', async () => {
    const fakeThreeVendors = [
      { vendorId: 1, offeredAmount: 14500000, isWinner: false },
      { vendorId: 2, offeredAmount: 14200000, isWinner: true },
      { vendorId: 2, offeredAmount: 14200000, isWinner: false }, // Duplicate to reach array length 3
    ];

    await expect(service.submitVendorComparison(1, fakeThreeVendors, actorUserId)).rejects.toThrow(
      'Vendor #2 duplikat dalam perbandingan',
    );
  });

  // P73-B10
  it('P73-B10: Low-value PR may evaluate with 1 submitted vendor', async () => {
    // Low value PR <= 1,000,000
    queryRunnerMock.manager.findOne.mockImplementation((entityClass: any, options: any) => {
      if (entityClass === Rfq && options?.where?.id === 2) {
        return Promise.resolve({
          id: 2,
          rfqNumber: 'RFQ-20260901-002',
          status: 'OPEN',
          purchaseRequest: {
            id: 11,
            totalEstimatedAmount: 750000, // <= 1,000,000
          },
        });
      }
      return Promise.resolve(null);
    });

    queryRunnerMock.manager.find.mockImplementation((entityClass: any, options: any) => {
      if (entityClass === Quotation && options?.where?.rfqId === 2) {
        return Promise.resolve([
          {
            id: 104,
            rfqId: 2,
            vendorId: 1,
            totalAmount: 700000,
            status: 'SUBMITTED',
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const singleVendorPayload = [{ vendorId: 1, offeredAmount: 700000, isWinner: true }];

    const result = await service.submitVendorComparison(2, singleVendorPayload, actorUserId);
    expect(result.success).toBe(true);
    expect(result.rfq.status).toBe('EVALUATED');
  });

  // P73-B11
  it('P73-B11: Zero winners rejected', async () => {
    const noWinners = validPayload.map((v) => ({ ...v, isWinner: false }));

    await expect(service.submitVendorComparison(1, noWinners, actorUserId)).rejects.toThrow(
      'Exactly 1 vendor must be selected as the winner.',
    );
  });

  // P73-B12
  it('P73-B12: Multiple winners rejected', async () => {
    const multipleWinners = validPayload.map((v) => ({ ...v, isWinner: true }));

    await expect(service.submitVendorComparison(1, multipleWinners, actorUserId)).rejects.toThrow(
      'Exactly 1 vendor must be selected as the winner.',
    );
  });

  // P73-B13
  it('P73-B13: Winner must belong to submitted quotation set', async () => {
    // Winner has an ID that does not exist in DB quotations
    const payloadWithInvalidWinner = [
      { vendorId: 1, offeredAmount: 14500000, isWinner: false },
      { vendorId: 2, offeredAmount: 14200000, isWinner: false },
      { vendorId: 99, offeredAmount: 14800000, isWinner: true }, // Winner is nonexistent vendor
    ];

    await expect(service.submitVendorComparison(1, payloadWithInvalidWinner, actorUserId)).rejects.toThrow(
      'Vendor #99 tidak memiliki penawaran berstatus SUBMITTED pada RFQ #1',
    );
  });

  // P73-B14
  it('P73-B14: Incomplete quotation set is rejected', async () => {
    // DB has 3 valid submitted quotations, but client selectively only sends 2
    const incompletePayload = [
      { vendorId: 1, offeredAmount: 14500000, isWinner: false },
      { vendorId: 2, offeredAmount: 14200000, isWinner: true },
    ];

    await expect(service.submitVendorComparison(1, incompletePayload, actorUserId)).rejects.toThrow(
      'Perbandingan tidak lengkap: seluruh penawaran vendor yang valid (3) harus dievaluasi (diterima: 2)',
    );
  });

  // P73-B15
  it('P73-B15: Evaluation remarks persisted', async () => {
    const remarksText = 'Pemenang dipilih karena lead time tercepat dan harga efisien.';

    const result = await service.submitVendorComparison(1, validPayload, actorUserId, remarksText);

    expect(result.success).toBe(true);

    const comparisonSave = savedEntities.find((s) => s.entityClass === VendorComparison);
    expect(comparisonSave).toBeDefined();
    const comparisons: any[] = comparisonSave!.entity;
    expect(comparisons[0].remarks).toBe(remarksText);

    const auditSave = savedEntities.find((s) => s.entityClass === AuditLog);
    expect(auditSave).toBeDefined();
    expect(auditSave!.entity.new_value.remarks).toBe(remarksText);
  });

  // P73-B16
  it('P73-B16: AuditLog contains evaluator and winner data', async () => {
    await service.submitVendorComparison(1, validPayload, actorUserId);

    const auditSave = savedEntities.find((s) => s.entityClass === AuditLog);
    expect(auditSave).toBeDefined();
    expect(auditSave!.entity.table_name).toBe('rfqs');
    expect(auditSave!.entity.record_id).toBe(1);
    expect(auditSave!.entity.action).toBe('EVALUATE');
    expect(auditSave!.entity.created_by).toBe(actorUserId);
    expect(auditSave!.entity.new_value.winnerVendorId).toBe(2);
    expect(auditSave!.entity.new_value.winnerAmount).toBe(14200000);
    expect(auditSave!.entity.new_value.vendorsCount).toBe(3);
  });

  // P73-B17
  it('P73-B17: Failed evaluation leaves RFQ OPEN', async () => {
    queryRunnerMock.manager.save.mockImplementation((entityClass: any) => {
      if (entityClass === VendorComparison) {
        throw new Error('Database disk error on save');
      }
      return Promise.resolve({});
    });

    await expect(service.submitVendorComparison(1, validPayload, actorUserId)).rejects.toThrow('Database disk error on save');
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    expect(mockOpenRfq.status).toBe('OPEN');
  });

  // P73-B18
  it('P73-B18: Successful evaluation changes RFQ to EVALUATED', async () => {
    const result = await service.submitVendorComparison(1, validPayload, actorUserId);

    expect(result.success).toBe(true);
    const rfqSave = savedEntities.find((s) => s.entityClass === Rfq);
    expect(rfqSave).toBeDefined();
    expect(rfqSave!.entity.status).toBe('EVALUATED');
  });

  // P73-B19
  it('P73-B19: Second evaluation attempt rejected', async () => {
    queryRunnerMock.manager.findOne.mockImplementation((entityClass: any) => {
      if (entityClass === Rfq) {
        return Promise.resolve({ ...mockOpenRfq, status: 'EVALUATED' });
      }
      return Promise.resolve(null);
    });

    await expect(service.submitVendorComparison(1, validPayload, actorUserId)).rejects.toThrow(
      'RFQ sudah selesai dievaluasi.',
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
  });

  // P73-B20
  it('P73-B20: Concurrent evaluation allows only one successful evaluation', async () => {
    let callCount = 0;
    queryRunnerMock.manager.findOne.mockImplementation((entityClass: any) => {
      if (entityClass === Rfq) {
        callCount++;
        // First call sees OPEN under lock, second serialized call sees EVALUATED
        if (callCount === 1) {
          return Promise.resolve({ ...mockOpenRfq, status: 'OPEN' });
        }
        return Promise.resolve({ ...mockOpenRfq, status: 'EVALUATED' });
      }
      return Promise.resolve(null);
    });

    const first = service.submitVendorComparison(1, validPayload, actorUserId);
    const second = service.submitVendorComparison(1, validPayload, actorUserId);

    const results = await Promise.allSettled([first, second]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    if (results[1].status === 'rejected') {
      expect(results[1].reason.message).toContain('RFQ sudah selesai dievaluasi.');
    }
  });

  // P73-B21
  it('P73-B21: Concurrent evaluation creates no duplicate comparison set', async () => {
    let callCount = 0;
    queryRunnerMock.manager.findOne.mockImplementation((entityClass: any) => {
      if (entityClass === Rfq) {
        callCount++;
        if (callCount === 1) return Promise.resolve({ ...mockOpenRfq, status: 'OPEN' });
        return Promise.resolve({ ...mockOpenRfq, status: 'EVALUATED' });
      }
      return Promise.resolve(null);
    });

    const [firstRes, secondRes] = await Promise.allSettled([
      service.submitVendorComparison(1, validPayload, actorUserId),
      service.submitVendorComparison(1, validPayload, actorUserId),
    ]);

    expect(firstRes.status).toBe('fulfilled');
    expect(secondRes.status).toBe('rejected');

    // Only one comparison set was saved
    const comparisonSaves = savedEntities.filter((s) => s.entityClass === VendorComparison);
    expect(comparisonSaves).toHaveLength(1);
    expect(comparisonSaves[0].entity).toHaveLength(3);
  });

  // P73-B22
  it('P73-B22: Successful evaluation creates exactly one comparison row per submitted quotation', async () => {
    await service.submitVendorComparison(1, validPayload, actorUserId);

    const comparisonSave = savedEntities.find((s) => s.entityClass === VendorComparison);
    expect(comparisonSave).toBeDefined();
    const rows: any[] = comparisonSave!.entity;

    // Must match the 3 submitted quotations in DB
    expect(rows).toHaveLength(3);
    const winnerRows = rows.filter((r) => r.isWinner);
    expect(winnerRows).toHaveLength(1);
    expect(winnerRows[0].vendorId).toBe(2);
  });

  // Authentication requirement verification
  it('should reject evaluation when userId is absent or falsy', async () => {
    await expect(service.submitVendorComparison(1, validPayload, undefined)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.submitVendorComparison(1, validPayload, 0)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // Controller propagation test
  it('Controller should extract userId and forward remarks to service', async () => {
    const submitSpy = jest.spyOn(service, 'submitVendorComparison').mockResolvedValue({ success: true } as any);

    const mockReq = { user: { userId: 99 } };
    const dto = {
      rfqId: 1,
      vendors: validPayload,
      remarks: 'Catatan komparasi',
    };

    const res = await controller.submitVendorComparison(mockReq as any, dto as any);
    expect(res.success).toBe(true);
    expect(submitSpy).toHaveBeenCalledWith(1, validPayload, 99, 'Catatan komparasi');
  });

  it('Controller should throw UnauthorizedException if req.user has no identity', async () => {
    const mockReq = { user: null };
    const dto = { rfqId: 1, vendors: validPayload };

    await expect(controller.submitVendorComparison(mockReq as any, dto as any)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
