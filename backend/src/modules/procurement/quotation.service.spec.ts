import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
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
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { Reflector } from '@nestjs/core';

describe('QuotationService - Phase 7C Backend Quotation Foundation Tests', () => {
  let service: ProcurementService;
  let controller: ProcurementController;
  let rfqRepoMock: any;
  let prRepoMock: any;
  let vendorRepoMock: any;
  let quotationRepoMock: any;
  let quotationItemRepoMock: any;
  let dataSourceMock: any;
  let queryRunnerMock: any;

  const mockPr = {
    id: 1,
    prNumber: 'PR-20260901-001',
    status: 'APPROVED',
    projectId: 2,
    items: [
      { id: 10, itemName: 'Item 1', quantity: 10, estimatedUnitPrice: 100000 },
      { id: 11, itemName: 'Item 2', quantity: 5, estimatedUnitPrice: 200000 },
    ],
    project: { id: 2, name: 'Rumah Net FKI Karawang', status: 'IN_PROGRESS' },
  };

  const mockOpenRfq = {
    id: 1,
    rfqNumber: 'RFQ-20260903-001',
    status: 'OPEN',
    closingDate: new Date(Date.now() + 86400000), // tomorrow
    prId: 1,
    purchaseRequest: mockPr,
  };

  const mockActiveVendor = {
    id: 1,
    code: 'VEN-001',
    name: 'PT Mitra Solusi',
    deletedAt: null,
  };

  beforeEach(async () => {
    rfqRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ id: 1, ...dto })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 1, ...entity })),
      count: jest.fn().mockResolvedValue(0),
    };

    prRepoMock = {
      findOne: jest.fn(),
    };

    vendorRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    quotationRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    quotationItemRepoMock = {
      create: jest.fn(),
      save: jest.fn(),
    };

    queryRunnerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([]),
      manager: {
        create: jest.fn().mockImplementation((entityClass, data) => ({ ...data })),
        save: jest.fn().mockImplementation((entityClass, data) => {
          if (Array.isArray(data)) {
            return Promise.resolve(data.map((d, i) => ({ id: i + 1, ...d })));
          }
          return Promise.resolve({ id: 1, ...data });
        }),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    dataSourceMock = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcurementController],
      providers: [
        ProcurementService,
        Reflector,
        { provide: getRepositoryToken(PurchaseRequest), useValue: prRepoMock },
        { provide: getRepositoryToken(Rfq), useValue: rfqRepoMock },
        { provide: getRepositoryToken(Vendor), useValue: vendorRepoMock },
        { provide: getRepositoryToken(Quotation), useValue: quotationRepoMock },
        { provide: getRepositoryToken(QuotationItem), useValue: quotationItemRepoMock },
        { provide: getRepositoryToken(VendorComparison), useValue: {} },
        { provide: getRepositoryToken(PurchaseOrder), useValue: {} },
        { provide: getRepositoryToken(GoodsReceipt), useValue: {} },
        { provide: WorkflowService, useValue: {} },
        { provide: require('../workflow-engine/workflow-engine.service').WorkflowEngineService, useValue: { startInstance: jest.fn() } },
        { provide: require('../workflow-engine/workflow-engine.service').WorkflowEngineService, useValue: { startInstance: jest.fn() } },
        { provide: require('../workflow-engine/workflow-engine.service').WorkflowEngineService, useValue: { startInstance: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: ProcurementPackageService, useValue: {} },
        { provide: ProcurementReconciliationService, useValue: {} },
      ],
    }).compile();

    service = module.get<ProcurementService>(ProcurementService);
    controller = module.get<ProcurementController>(ProcurementController);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(controller).toBeDefined();
  });

  // 1. RFQ not found
  it('1. should reject when RFQ is not found', async () => {
    rfqRepoMock.findOne.mockResolvedValue(null);

    const dto: CreateQuotationDto = {
      rfqId: 999,
      vendorId: 1,
      items: [{ prItemId: 10, itemName: 'Item 1', quantity: 2, uom: 'PCS', unitPrice: 100000 }],
    };

    await expect(service.createQuotation(dto, 42)).rejects.toThrow(BadRequestException);
    await expect(service.createQuotation(dto, 42)).rejects.toThrow('RFQ #999 tidak ditemukan');
  });

  // 2. RFQ not OPEN
  it('2. should reject when RFQ is not in OPEN status', async () => {
    rfqRepoMock.findOne.mockResolvedValue({
      ...mockOpenRfq,
      status: 'CLOSED',
    });

    const dto: CreateQuotationDto = {
      rfqId: 1,
      vendorId: 1,
      items: [{ prItemId: 10, itemName: 'Item 1', quantity: 2, uom: 'PCS', unitPrice: 100000 }],
    };

    await expect(service.createQuotation(dto, 42)).rejects.toThrow(BadRequestException);
    await expect(service.createQuotation(dto, 42)).rejects.toThrow('tidak dalam status OPEN');
  });

  // 2b. RFQ in EVALUATED status
  it('2b. should reject quotation submission when RFQ is in EVALUATED status', async () => {
    rfqRepoMock.findOne.mockResolvedValue({
      ...mockOpenRfq,
      status: 'EVALUATED',
    });

    const dto: CreateQuotationDto = {
      rfqId: 1,
      vendorId: 1,
      items: [{ prItemId: 10, itemName: 'Item 1', quantity: 2, uom: 'PCS', unitPrice: 100000 }],
    };

    await expect(service.createQuotation(dto, 42)).rejects.toThrow(BadRequestException);
    await expect(service.createQuotation(dto, 42)).rejects.toThrow('tidak dalam status OPEN (status: EVALUATED)');
  });

  // 3. Expired closing date
  it('3. should reject when RFQ closing_date has expired', async () => {
    rfqRepoMock.findOne.mockResolvedValue({
      ...mockOpenRfq,
      closingDate: new Date(Date.now() - 86400000), // yesterday
    });

    const dto: CreateQuotationDto = {
      rfqId: 1,
      vendorId: 1,
      items: [{ prItemId: 10, itemName: 'Item 1', quantity: 2, uom: 'PCS', unitPrice: 100000 }],
    };

    await expect(service.createQuotation(dto, 42)).rejects.toThrow(BadRequestException);
    await expect(service.createQuotation(dto, 42)).rejects.toThrow('telah melewati batas waktu pengajuan penawaran');
  });

  // 4. Vendor not found
  it('4. should reject when vendor is not found', async () => {
    rfqRepoMock.findOne.mockResolvedValue(mockOpenRfq);
    vendorRepoMock.findOne.mockResolvedValue(null);

    const dto: CreateQuotationDto = {
      rfqId: 1,
      vendorId: 888,
      items: [{ prItemId: 10, itemName: 'Item 1', quantity: 2, uom: 'PCS', unitPrice: 100000 }],
    };

    await expect(service.createQuotation(dto, 42)).rejects.toThrow(BadRequestException);
    await expect(service.createQuotation(dto, 42)).rejects.toThrow('Vendor #888 tidak ditemukan');
  });

  // 5. Inactive vendor
  it('5. should reject when vendor is inactive (deletedAt is set)', async () => {
    rfqRepoMock.findOne.mockResolvedValue(mockOpenRfq);
    vendorRepoMock.findOne.mockResolvedValue({
      ...mockActiveVendor,
      deletedAt: new Date(),
    });

    const dto: CreateQuotationDto = {
      rfqId: 1,
      vendorId: 1,
      items: [{ prItemId: 10, itemName: 'Item 1', quantity: 2, uom: 'PCS', unitPrice: 100000 }],
    };

    await expect(service.createQuotation(dto, 42)).rejects.toThrow(BadRequestException);
    await expect(service.createQuotation(dto, 42)).rejects.toThrow('tidak aktif atau telah dinonaktifkan');
  });

  // 6. Duplicate vendor quotation
  it('6. should reject duplicate submitted quotation from same vendor for same RFQ', async () => {
    rfqRepoMock.findOne.mockResolvedValue(mockOpenRfq);
    vendorRepoMock.findOne.mockResolvedValue(mockActiveVendor);
    quotationRepoMock.findOne.mockResolvedValue({
      id: 5,
      quotationNumber: 'QT-20260903-001',
      status: 'SUBMITTED',
    });

    const dto: CreateQuotationDto = {
      rfqId: 1,
      vendorId: 1,
      items: [{ prItemId: 10, itemName: 'Item 1', quantity: 2, uom: 'PCS', unitPrice: 100000 }],
    };

    await expect(service.createQuotation(dto, 42)).rejects.toThrow(BadRequestException);
    await expect(service.createQuotation(dto, 42)).rejects.toThrow('sudah mengajukan penawaran');
  });

  // 7. Invalid PR item
  it('7. should reject when quotation item has invalid or missing prItemId', async () => {
    rfqRepoMock.findOne.mockResolvedValue(mockOpenRfq);
    vendorRepoMock.findOne.mockResolvedValue(mockActiveVendor);
    quotationRepoMock.findOne.mockResolvedValueOnce(null);

    const dto: CreateQuotationDto = {
      rfqId: 1,
      vendorId: 1,
      items: [{ prItemId: 9999, itemName: 'Item Invalid', quantity: 2, uom: 'PCS', unitPrice: 100000 }],
    };

    await expect(service.createQuotation(dto, 42)).rejects.toThrow(BadRequestException);
    await expect(service.createQuotation(dto, 42)).rejects.toThrow('Item PR #9999 tidak valid untuk RFQ ini');
  });

  // 8. Cross-project injection
  it('8. should reject cross-project item injection', async () => {
    rfqRepoMock.findOne.mockResolvedValue(mockOpenRfq);
    vendorRepoMock.findOne.mockResolvedValue(mockActiveVendor);
    quotationRepoMock.findOne.mockResolvedValueOnce(null);

    // Item 77 belongs to another PR / Project
    const dto: CreateQuotationDto = {
      rfqId: 1,
      vendorId: 1,
      items: [
        { prItemId: 10, itemName: 'Valid Item', quantity: 2, uom: 'PCS', unitPrice: 100000 },
        { prItemId: 77, itemName: 'Injected Item from Project 9', quantity: 1, uom: 'PCS', unitPrice: 500000 },
      ],
    };

    await expect(service.createQuotation(dto, 42)).rejects.toThrow(BadRequestException);
    await expect(service.createQuotation(dto, 42)).rejects.toThrow('berasal dari PR/proyek lain');
  });

  // 9. Server total calculation
  it('9. should calculate server totalAmount accurately ignoring any client values', async () => {
    rfqRepoMock.findOne.mockResolvedValue(mockOpenRfq);
    vendorRepoMock.findOne.mockResolvedValue(mockActiveVendor);
    quotationRepoMock.findOne
      .mockResolvedValueOnce(null) // duplicate check
      .mockResolvedValueOnce({
        // authoritative find
        id: 1,
        quotationNumber: 'QT-20260903-001',
        totalAmount: 700000,
        status: 'SUBMITTED',
      });

    queryRunnerMock.query.mockResolvedValueOnce([]); // no existing quote today

    const dto: CreateQuotationDto = {
      rfqId: 1,
      vendorId: 1,
      items: [
        { prItemId: 10, itemName: 'Item 1', quantity: 3, uom: 'PCS', unitPrice: 100000 }, // 300,000
        { prItemId: 11, itemName: 'Item 2', quantity: 2, uom: 'PCS', unitPrice: 200000 }, // 400,000
      ],
    };

    const res = await service.createQuotation(dto, 42);
    expect(res.data.totalAmount).toBe(700000);

    // Verify entity creation had totalAmount 700000
    const createCall = queryRunnerMock.manager.create.mock.calls.find(
      (c: any[]) => c[0] === Quotation,
    );
    expect(createCall[1].totalAmount).toBe(700000);
  });

  // 10. Quotation number generated server-side
  it('10. should generate quotation number server-side with QT-YYYYMMDD-XXX format', async () => {
    rfqRepoMock.findOne.mockResolvedValue(mockOpenRfq);
    vendorRepoMock.findOne.mockResolvedValue(mockActiveVendor);
    quotationRepoMock.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 1, quotationNumber: 'QT-20260903-001' });

    queryRunnerMock.query.mockResolvedValueOnce([{ quotation_number: 'QT-20260903-004' }]);

    const dto: CreateQuotationDto = {
      rfqId: 1,
      vendorId: 1,
      items: [{ prItemId: 10, itemName: 'Item 1', quantity: 1, uom: 'PCS', unitPrice: 50000 }],
    };

    await service.createQuotation(dto, 42);

    const createCall = queryRunnerMock.manager.create.mock.calls.find(
      (c: any[]) => c[0] === Quotation,
    );
    const generatedNumber = createCall[1].quotationNumber;
    expect(generatedNumber).toMatch(/^QT-\d{8}-005$/);
  });

  // 11. Concurrent numbering collision protection (retry on duplicate entry)
  it('11. should retry and succeed when collision occurs during concurrency race', async () => {
    rfqMockSetup: {
      rfqRepoMock.findOne.mockResolvedValue(mockOpenRfq);
      vendorRepoMock.findOne.mockResolvedValue(mockActiveVendor);
      quotationRepoMock.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 2, quotationNumber: 'QT-20260903-002' });
    }

    // First attempt causes ER_DUP_ENTRY, second attempt succeeds
    let attempts = 0;
    queryRunnerMock.manager.save.mockImplementation((entityClass: any, data: any) => {
      if (entityClass === Quotation) {
        attempts++;
        if (attempts === 1) {
          const dupErr: any = new Error('Duplicate entry for key uq_quotations_quotation_number');
          dupErr.code = 'ER_DUP_ENTRY';
          throw dupErr;
        }
        return Promise.resolve({ id: 2, ...data });
      }
      return Promise.resolve(data);
    });

    const dto: CreateQuotationDto = {
      rfqId: 1,
      vendorId: 1,
      items: [{ prItemId: 10, itemName: 'Item 1', quantity: 1, uom: 'PCS', unitPrice: 50000 }],
    };

    const res = await service.createQuotation(dto, 42);
    expect(attempts).toBe(2);
    expect(res.success).toBe(true);
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
  });

  // 12. createdBy from JWT
  it('12. should assign createdBy from authenticated JWT userId', async () => {
    rfqRepoMock.findOne.mockResolvedValue(mockOpenRfq);
    vendorRepoMock.findOne.mockResolvedValue(mockActiveVendor);
    quotationRepoMock.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 1, createdBy: 77 });

    const dto: CreateQuotationDto = {
      rfqId: 1,
      vendorId: 1,
      items: [{ prItemId: 10, itemName: 'Item 1', quantity: 1, uom: 'PCS', unitPrice: 50000 }],
    };

    await service.createQuotation(dto, 77);

    const createCall = queryRunnerMock.manager.create.mock.calls.find(
      (c: any[]) => c[0] === Quotation,
    );
    expect(createCall[1].createdBy).toBe(77);
  });

  // 13. Transaction rollback on error
  it('13. should rollback transaction when saving quotation items fails', async () => {
    rfqRepoMock.findOne.mockResolvedValue(mockOpenRfq);
    vendorRepoMock.findOne.mockResolvedValue(mockActiveVendor);
    quotationRepoMock.findOne.mockResolvedValueOnce(null);

    queryRunnerMock.manager.save.mockImplementation((entityClass: any, data: any) => {
      if (entityClass === Quotation) {
        return Promise.resolve({ id: 1, ...data });
      }
      throw new Error('Database disk error during item save');
    });

    const dto: CreateQuotationDto = {
      rfqId: 1,
      vendorId: 1,
      items: [{ prItemId: 10, itemName: 'Item 1', quantity: 1, uom: 'PCS', unitPrice: 50000 }],
    };

    await expect(service.createQuotation(dto, 42)).rejects.toThrow('Database disk error');
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
  });

  // 14. Valid quotation succeeds
  it('14. should successfully persist and return authoritative quotation with items', async () => {
    rfqRepoMock.findOne.mockResolvedValue(mockOpenRfq);
    vendorRepoMock.findOne.mockResolvedValue(mockActiveVendor);
    quotationRepoMock.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 1,
        quotationNumber: 'QT-20260903-001',
        totalAmount: 100000,
        status: 'SUBMITTED',
        vendor: mockActiveVendor,
        items: [
          { id: 1, quotationId: 1, prItemId: 10, itemName: 'Item 1', quantity: 1, unitPrice: 100000, totalAmount: 100000 },
        ],
      });

    const dto: CreateQuotationDto = {
      rfqId: 1,
      vendorId: 1,
      items: [{ prItemId: 10, itemName: 'Item 1', quantity: 1, uom: 'PCS', unitPrice: 100000 }],
    };

    const res = await service.createQuotation(dto, 42);
    expect(res.success).toBe(true);
    expect(res.data.id).toBe(1);
    expect(res.data.items).toHaveLength(1);
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
  });

  // 15. RBAC enforcement verification
  it('15. should verify controller RBAC metadata for CREATE and READ', () => {
    const reflector = new Reflector();

    const createRoles = reflector.get<string[]>('roles', controller.createQuotation);
    expect(createRoles).toContain('PROCUREMENT');
    expect(createRoles).toContain('PURCHASING');
    expect(createRoles).toContain('SUPER_ADMIN');
    expect(createRoles).toContain('ADMIN');

    const getByRfqRoles = reflector.get<string[]>('roles', controller.getQuotationsByRfq);
    expect(getByRfqRoles).toContain('PROCUREMENT');
    expect(getByRfqRoles).toContain('PROJECT_MANAGER');
    expect(getByRfqRoles).toContain('FINANCE');

    const getByIdRoles = reflector.get<string[]>('roles', controller.getQuotationById);
    expect(getByIdRoles).toContain('PROCUREMENT');
    expect(getByIdRoles).toContain('SUPER_ADMIN');
  });

  // 16. RFQ closing_date persistence & read verification
  it('16. should persist closing_date in createRfq and return it', async () => {
    prRepoMock.findOne.mockResolvedValue({
      id: 1,
      prNumber: 'PR-20260901-001',
      status: 'APPROVED',
      items: [{ id: 10 }],
      project: { id: 2 },
    });
    rfqRepoMock.findOne.mockResolvedValue(null); // no active RFQ

    const closingDate = '2026-09-30T17:00:00.000Z';
    const createRfqDto: CreateRfqDto = {
      purchaseRequestId: 1,
      closingDate,
    };

    const res = await service.createRfq(createRfqDto, 42);
    expect(res.success).toBe(true);
    expect(res.data.closingDate).toEqual(new Date(closingDate));
    expect(queryRunnerMock.manager.save).toHaveBeenCalled();
  });

  // 17. Read quotation by ID and by RFQ ID
  it('17. should retrieve quotations by RFQ and by ID', async () => {
    quotationRepoMock.find.mockResolvedValueOnce([
      { id: 1, quotationNumber: 'QT-20260903-001', totalAmount: 100000 },
      { id: 2, quotationNumber: 'QT-20260903-002', totalAmount: 200000 },
    ]);

    const rfqQuotes = await service.getQuotationsByRfq(1);
    expect(rfqQuotes.success).toBe(true);
    expect(rfqQuotes.data).toHaveLength(2);

    quotationRepoMock.findOne.mockResolvedValueOnce({
      id: 1,
      quotationNumber: 'QT-20260903-001',
    });
    const singleQuote = await service.getQuotationById(1);
    expect(singleQuote.success).toBe(true);
    expect(singleQuote.data.id).toBe(1);
  });
});
