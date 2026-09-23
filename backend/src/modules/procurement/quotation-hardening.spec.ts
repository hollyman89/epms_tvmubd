import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProcurementService } from './procurement.service';
import { ProcurementController } from './procurement.controller';
import { WorkflowService } from '../workflow-engine/workflow.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
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
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { ProcurementPackageService } from './procurement-package.service';
import { ProcurementReconciliationService } from './procurement-reconciliation.service';

describe('P7.2 Part D: Vendor Quotation Hardening Spec (P72-D01 to P72-D10)', () => {
  let service: ProcurementService;
  let controller: ProcurementController;
  let prRepoMock: any;
  let rfqRepoMock: any;
  let vendorRepoMock: any;
  let quotationRepoMock: any;
  let queryRunnerMock: any;
  let dataSourceMock: any;
  let savedEntities: any[];

  const validPr = {
    id: 10,
    prNumber: 'PR-20260901-001',
    status: 'APPROVED',
    projectId: 100,
    project: { id: 100, name: 'Project Alpha' },
    items: [
      { id: 101, itemName: 'Item 1', quantity: 10, estimatedUnitPrice: 100000 },
      { id: 102, itemName: 'Item 2', quantity: 5, estimatedUnitPrice: 200000 },
    ],
  };

  const validOpenRfq = {
    id: 5,
    rfqNumber: 'RFQ-20260916-001',
    status: 'OPEN',
    closingDate: new Date(Date.now() + 86400000), // tomorrow
    prId: 10,
    purchaseRequest: validPr,
  };

  const validActiveVendor = {
    id: 7,
    code: 'VND-007',
    name: 'PT Mitra Sukses',
    deletedAt: null,
  };

  const baseQuotationDto: CreateQuotationDto = {
    rfqId: 5,
    vendorId: 7,
    leadTimeDays: 14,
    notes: 'Frangko gudang',
    items: [
      { prItemId: 101, itemName: 'Item 1', quantity: 2, uom: 'PCS', unitPrice: 120000 },
      { prItemId: 102, itemName: 'Item 2', quantity: 3, uom: 'UNIT', unitPrice: 210000 },
    ],
  };

  beforeEach(async () => {
    savedEntities = [];

    queryRunnerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([]),
      manager: {
        query: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockImplementation((entityClass, options) => {
          if (entityClass === Rfq) return Promise.resolve(validOpenRfq);
          if (entityClass === Vendor) return Promise.resolve(validActiveVendor);
          if (entityClass === Quotation) return Promise.resolve(null);
          return Promise.resolve(null);
        }),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation((entityClass, data) => ({ ...data })),
        save: jest.fn().mockImplementation((entityClass, data) => {
          if (Array.isArray(data)) {
            const savedList = data.map((d, i) => ({ id: 500 + i, ...d }));
            savedEntities.push({ entityClass, entity: savedList });
            return Promise.resolve(savedList);
          }
          const saved = { id: 201, ...data };
          savedEntities.push({ entityClass, entity: saved });
          return Promise.resolve(saved);
        }),
      },
    };

    prRepoMock = {
      findOne: jest.fn().mockResolvedValue(validPr),
      find: jest.fn().mockResolvedValue([validPr]),
    };

    rfqRepoMock = {
      findOne: jest.fn().mockResolvedValue(validOpenRfq),
      find: jest.fn().mockResolvedValue([validOpenRfq]),
    };

    vendorRepoMock = {
      findOne: jest.fn().mockResolvedValue(validActiveVendor),
      find: jest.fn().mockResolvedValue([validActiveVendor]),
    };

    quotationRepoMock = {
      findOne: jest.fn().mockImplementation((options) => {
        // Return saved quotation if queried by ID
        if (options?.where?.id) {
          return Promise.resolve({
            id: options.where.id,
            quotationNumber: 'QT-20260916-001',
            rfqId: 5,
            vendorId: 7,
            totalAmount: 870000,
            status: 'SUBMITTED',
            items: [],
          });
        }
        return Promise.resolve(null);
      }),
      find: jest.fn().mockResolvedValue([]),
    };

    dataSourceMock = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcurementController],
      providers: [
        ProcurementService,
        { provide: getRepositoryToken(PurchaseRequest), useValue: prRepoMock },
        { provide: getRepositoryToken(Rfq), useValue: rfqRepoMock },
        { provide: getRepositoryToken(Vendor), useValue: vendorRepoMock },
        { provide: getRepositoryToken(Quotation), useValue: quotationRepoMock },
        { provide: getRepositoryToken(QuotationItem), useValue: {} },
        { provide: getRepositoryToken(VendorComparison), useValue: {} },
        { provide: getRepositoryToken(PurchaseOrder), useValue: {} },
        { provide: getRepositoryToken(PoPaymentTerm), useValue: {} },
        { provide: getRepositoryToken(GoodsReceipt), useValue: {} },
        { provide: WorkflowService, useValue: {} },
        { provide: WorkflowEngineService, useValue: { startInstance: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: ProcurementPackageService, useValue: {} },
        { provide: ProcurementReconciliationService, useValue: {} },
      ],
    }).compile();

    service = module.get<ProcurementService>(ProcurementService);
    controller = module.get<ProcurementController>(ProcurementController);
  });

  // P72-D01: Quotation succeeds for valid OPEN RFQ + valid active vendor
  it('P72-D01: Quotation succeeds for valid OPEN RFQ + valid active vendor', async () => {
    const res = await service.createQuotation(baseQuotationDto, 42);

    expect(res).toBeDefined();
    expect(res.success).toBe(true);
    expect(res.data.status).toBe('SUBMITTED');
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    expect(queryRunnerMock.rollbackTransaction).not.toHaveBeenCalled();

    // Verify RFQ row-level lock was acquired inside transaction
    expect(queryRunnerMock.manager.query).toHaveBeenCalledWith(
      `SELECT id FROM rfqs WHERE id = ? FOR UPDATE`,
      [5],
    );
  });

  // P72-D02: Duplicate sequential quotation for same (rfqId, vendorId) is rejected
  it('P72-D02: Duplicate sequential quotation for same (rfqId, vendorId) is rejected', async () => {
    queryRunnerMock.manager.findOne.mockImplementation((entityClass, options) => {
      if (entityClass === Rfq) return Promise.resolve(validOpenRfq);
      if (entityClass === Vendor) return Promise.resolve(validActiveVendor);
      if (entityClass === Quotation) {
        return Promise.resolve({
          id: 99,
          quotationNumber: 'QT-20260916-001',
          status: 'SUBMITTED',
        });
      }
      return Promise.resolve(null);
    });

    await expect(service.createQuotation(baseQuotationDto, 42)).rejects.toThrow(BadRequestException);
    await expect(service.createQuotation(baseQuotationDto, 42)).rejects.toThrow(
      'sudah mengajukan penawaran (QT-20260916-001) untuk RFQ #RFQ-20260916-001',
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
  });

  // P72-D03: Duplicate prItemId within a single quotation payload is rejected
  it('P72-D03: Duplicate prItemId within a single quotation payload is rejected', async () => {
    const duplicateItemDto: CreateQuotationDto = {
      ...baseQuotationDto,
      items: [
        { prItemId: 101, itemName: 'Item 1 - Line 1', quantity: 2, uom: 'PCS', unitPrice: 100000 },
        { prItemId: 101, itemName: 'Item 1 - Line 2 (Duplicate)', quantity: 3, uom: 'PCS', unitPrice: 110000 },
      ],
    };

    await expect(service.createQuotation(duplicateItemDto, 42)).rejects.toThrow(BadRequestException);
    await expect(service.createQuotation(duplicateItemDto, 42)).rejects.toThrow(
      'Item PR #101 duplikat dalam daftar penawaran',
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
  });

  // P72-D04: Unknown/cross-RFQ PR item remains rejected
  it('P72-D04: Unknown/cross-RFQ PR item remains rejected', async () => {
    const foreignItemDto: CreateQuotationDto = {
      ...baseQuotationDto,
      items: [
        { prItemId: 9999, itemName: 'Foreign Injected Item', quantity: 1, uom: 'PCS', unitPrice: 500000 },
      ],
    };

    await expect(service.createQuotation(foreignItemDto, 42)).rejects.toThrow(BadRequestException);
    await expect(service.createQuotation(foreignItemDto, 42)).rejects.toThrow(
      'Item PR #9999 tidak valid untuk RFQ ini atau berasal dari PR/proyek lain',
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
  });

  // P72-D05: Zero/negative quantity remains rejected
  it('P72-D05: Zero/negative quantity remains rejected', async () => {
    const zeroQtyDto: CreateQuotationDto = {
      ...baseQuotationDto,
      items: [
        { prItemId: 101, itemName: 'Item 1', quantity: 0, uom: 'PCS', unitPrice: 100000 },
      ],
    };

    await expect(service.createQuotation(zeroQtyDto, 42)).rejects.toThrow(BadRequestException);
    await expect(service.createQuotation(zeroQtyDto, 42)).rejects.toThrow(
      'Kuantitas item "Item 1" harus lebih besar dari 0',
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
  });

  // P72-D06: Negative price remains rejected
  it('P72-D06: Negative price remains rejected', async () => {
    const negativePriceDto: CreateQuotationDto = {
      ...baseQuotationDto,
      items: [
        { prItemId: 101, itemName: 'Item 1', quantity: 2, uom: 'PCS', unitPrice: -5000 },
      ],
    };

    await expect(service.createQuotation(negativePriceDto, 42)).rejects.toThrow(BadRequestException);
    await expect(service.createQuotation(negativePriceDto, 42)).rejects.toThrow(
      'Harga satuan item "Item 1" tidak boleh negatif',
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
  });

  // P72-D07: Server-side line total remains authoritative
  it('P72-D07: Server-side line total remains authoritative', async () => {
    const res = await service.createQuotation(baseQuotationDto, 42);
    expect(res.success).toBe(true);

    const savedItemsEntry = savedEntities.find(s => s.entityClass === QuotationItem);
    expect(savedItemsEntry).toBeDefined();
    const items = savedItemsEntry.entity;

    // Item 1: 2 * 120,000 = 240,000
    expect(items[0].totalAmount).toBe(240000);
    // Item 2: 3 * 210,000 = 630,000
    expect(items[1].totalAmount).toBe(630000);
  });

  // P72-D08: Server-side quotation total remains authoritative
  it('P72-D08: Server-side quotation total remains authoritative', async () => {
    const res = await service.createQuotation(baseQuotationDto, 42);
    expect(res.success).toBe(true);

    const savedQuotationEntry = savedEntities.find(s => s.entityClass === Quotation);
    expect(savedQuotationEntry).toBeDefined();
    // 240,000 + 630,000 = 870,000
    expect(savedQuotationEntry.entity.totalAmount).toBe(870000);
  });

  // P72-D09: Existing quotation numbering and collision retry remain unchanged
  it('P72-D09: Existing quotation numbering and collision retry remain unchanged', async () => {
    let attempts = 0;
    queryRunnerMock.manager.save.mockImplementation((entityClass: any, data: any) => {
      if (entityClass === Quotation) {
        attempts++;
        if (attempts === 1) {
          const dupErr: any = new Error('Duplicate entry for key uq_quotations_quotation_number');
          dupErr.code = 'ER_DUP_ENTRY';
          throw dupErr;
        }
        return Promise.resolve({ id: 202, ...data });
      }
      return Promise.resolve(data);
    });

    const res = await service.createQuotation(baseQuotationDto, 42);
    expect(res.success).toBe(true);
    expect(attempts).toBe(2);
  });

  // P72-D10: Transaction rollback leaves no partial quotation/quotation-item data after a forced failure
  it('P72-D10: Transaction rollback leaves no partial quotation/quotation-item data after a forced failure', async () => {
    queryRunnerMock.manager.save.mockImplementation((entityClass: any, data: any) => {
      if (entityClass === QuotationItem) {
        throw new Error('Forced DB failure while saving quotation items');
      }
      return Promise.resolve({ id: 201, ...data });
    });

    await expect(service.createQuotation(baseQuotationDto, 42)).rejects.toThrow(
      'Forced DB failure while saving quotation items',
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunnerMock.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunnerMock.release).toHaveBeenCalled();
  });
});
