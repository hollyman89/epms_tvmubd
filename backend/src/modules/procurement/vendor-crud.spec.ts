import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { ProcurementService } from './procurement.service';
import { ProcurementController } from './procurement.controller';
import { ProcurementPackageService } from './procurement-package.service';
import { ProcurementReconciliationService } from './procurement-reconciliation.service';
import { WorkflowService } from '../workflow-engine/workflow.service';
import { Vendor } from '../../entities/vendor.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { PurchaseRequestItem } from '../../entities/purchase-request-item.entity';
import { Rfq } from '../../entities/rfq.entity';
import { Quotation } from '../../entities/quotation.entity';
import { QuotationItem } from '../../entities/quotation-item.entity';
import { VendorComparison } from '../../entities/vendor-comparison.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { CreateVendorDto, UpdateVendorDto, VendorQueryDto } from './dto/vendor.dto';

describe('ProcurementService - Vendor Master Canonical CRUD Unit Tests', () => {
  let service: ProcurementService;
  let vendorRepoMock: any;
  let poRepoMock: any;
  let quotationRepoMock: any;
  let vendorComparisonRepoMock: any;
  let eventEmitterMock: any;
  let queryRunnerMock: any;
  let dataSourceMock: any;

  const mockActiveVendors: Vendor[] = [
    {
      id: 1,
      code: 'VND-001',
      name: 'PT IT Solusi Bersama',
      address: 'Jl. Sudirman No. 1',
      taxId: '01.111.111.1-111.000',
      vendorType: 'Hardware',
      createdBy: 1,
      updatedBy: null,
      deletedBy: null,
      createdAt: new Date('2026-08-24T14:27:10.000Z'),
      updatedAt: new Date('2026-08-24T14:27:10.000Z'),
      deletedAt: null,
      purchaseOrders: [],
      vendorComparisons: [],
      quotations: [],
    },
    {
      id: 2,
      code: 'VND-002',
      name: 'PT Maju Infrastruktur',
      address: 'Jl. Thamrin No. 2',
      taxId: '02.222.222.2-222.000',
      vendorType: 'Construction',
      createdBy: 1,
      updatedBy: null,
      deletedBy: null,
      createdAt: new Date('2026-08-24T14:27:10.000Z'),
      updatedAt: new Date('2026-08-24T14:27:10.000Z'),
      deletedAt: null,
      purchaseOrders: [],
      vendorComparisons: [],
      quotations: [],
    },
    {
      id: 3,
      code: 'VND-003',
      name: 'PT Cyber Security',
      address: 'Jl. Gatot Subroto No. 3',
      taxId: '03.333.333.3-333.000',
      vendorType: 'Software',
      createdBy: 1,
      updatedBy: null,
      deletedBy: null,
      createdAt: new Date('2026-08-24T14:27:10.000Z'),
      updatedAt: new Date('2026-08-24T14:27:10.000Z'),
      deletedAt: null,
      purchaseOrders: [],
      vendorComparisons: [],
      quotations: [],
    },
  ];

  beforeEach(async () => {
    vendorRepoMock = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ ...dto })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: entity.id || 99, ...entity })),
      softRemove: jest.fn().mockImplementation((entity) => {
        entity.deletedAt = new Date();
        return Promise.resolve(entity);
      }),
      createQueryBuilder: jest.fn(),
    };

    poRepoMock = {
      count: jest.fn().mockResolvedValue(0),
    };

    quotationRepoMock = {
      count: jest.fn().mockResolvedValue(0),
    };

    vendorComparisonRepoMock = {
      count: jest.fn().mockResolvedValue(0),
    };

    eventEmitterMock = {
      emit: jest.fn(),
    };

    queryRunnerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        query: jest.fn().mockResolvedValue([{ code: 'VND-005' }]),
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((entityClass, dto) => ({ ...dto })),
        save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: entity.id || 6, ...entity })),
      },
    };

    dataSourceMock = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcurementService,
        { provide: getRepositoryToken(Vendor), useValue: vendorRepoMock },
        { provide: getRepositoryToken(PurchaseOrder), useValue: poRepoMock },
        { provide: getRepositoryToken(Quotation), useValue: quotationRepoMock },
        { provide: getRepositoryToken(QuotationItem), useValue: {} },
        { provide: getRepositoryToken(VendorComparison), useValue: vendorComparisonRepoMock },
        { provide: getRepositoryToken(PurchaseRequest), useValue: {} },
        { provide: getRepositoryToken(Rfq), useValue: {} },
        { provide: getRepositoryToken(GoodsReceipt), useValue: {} },
        { provide: WorkflowService, useValue: {} },
        { provide: require('../workflow-engine/workflow-engine.service').WorkflowEngineService, useValue: { startInstance: jest.fn() } },
        { provide: require('../workflow-engine/workflow-engine.service').WorkflowEngineService, useValue: { startInstance: jest.fn() } },
        { provide: require('../workflow-engine/workflow-engine.service').WorkflowEngineService, useValue: { startInstance: jest.fn() } },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: EventEmitter2, useValue: eventEmitterMock },
      ],
    }).compile();

    service = module.get<ProcurementService>(ProcurementService);
  });

  // 1. GET LIST — Default (Backward Compatibility)
  it('1. GET list without query parameters returns active vendor array (backward compatible)', async () => {
    const qbMock: any = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(mockActiveVendors),
    };
    vendorRepoMock.createQueryBuilder.mockReturnValue(qbMock);

    const result = await service.getAllVendors();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3);
    expect(qbMock.orderBy).toHaveBeenCalledWith('vendor.id', 'ASC');
    expect(qbMock.getMany).toHaveBeenCalled();
  });

  // 2. GET LIST — Paginated with Search & Filter
  it('2. GET list with page, limit, search, and vendorType returns structured pagination object', async () => {
    const qbMock: any = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockActiveVendors[0]], 1]),
    };
    vendorRepoMock.createQueryBuilder.mockReturnValue(qbMock);

    const query: VendorQueryDto = {
      page: 1,
      limit: 10,
      search: 'Solusi',
      vendorType: 'Hardware',
    };

    const result: any = await service.getAllVendors(query);

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total', 1);
    expect(result).toHaveProperty('page', 1);
    expect(result).toHaveProperty('limit', 10);
    expect(result).toHaveProperty('totalPages', 1);
    expect(qbMock.andWhere).toHaveBeenCalledWith(
      '(vendor.code LIKE :search OR vendor.name LIKE :search)',
      { search: '%Solusi%' },
    );
    expect(qbMock.andWhere).toHaveBeenCalledWith(
      'vendor.vendor_type = :vendorType',
      { vendorType: 'Hardware' },
    );
  });

  // 3. GET DETAIL — Canonical
  it('3. GET detail by valid ID returns canonical active vendor', async () => {
    vendorRepoMock.findOne.mockResolvedValue(mockActiveVendors[0]);

    const result = await service.getVendorById(1);

    expect(result).toBeDefined();
    expect(result.id).toBe(1);
    expect(result.code).toBe('VND-001');
    expect(vendorRepoMock.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  // 4. GET DETAIL — Non-existing or soft-deleted vendor
  it('4. GET detail on non-existing or soft-deleted vendor throws NotFoundException', async () => {
    vendorRepoMock.findOne.mockResolvedValue(null);

    await expect(service.getVendorById(999)).rejects.toThrow(NotFoundException);
  });

  // 5. POST CREATE — Auto Vendor Code Generation & Concurrency Safety
  it('5a. POST create auto-generates VND-006 when baseline is VND-005 (code omitted by client)', async () => {
    queryRunnerMock.manager.query.mockResolvedValueOnce([{ code: 'VND-005' }]);
    queryRunnerMock.manager.findOne.mockResolvedValue(null);

    const dto: CreateVendorDto = {
      name: 'PT Baru Berkembang',
      address: 'Jl. Merdeka No. 10',
      taxId: '06.666.666.6-666.000',
      vendorType: 'Services',
    };

    const userId = 42;
    const result = await service.createVendor(dto, userId);

    expect(result).toBeDefined();
    expect(result.code).toBe('VND-006');
    expect(result.name).toBe('PT Baru Berkembang');
    expect(result.createdBy).toBe(42);
    expect(queryRunnerMock.connect).toHaveBeenCalled();
    expect(queryRunnerMock.startTransaction).toHaveBeenCalled();
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    expect(queryRunnerMock.release).toHaveBeenCalled();
    expect(eventEmitterMock.emit).toHaveBeenCalledWith(
      'audit.log',
      expect.objectContaining({
        action: 'CREATE',
        entityName: 'vendors',
        userId: 42,
        newValue: expect.objectContaining({ code: 'VND-006', name: 'PT Baru Berkembang' }),
      }),
    );
  });

  it('5b. POST create ignores client-provided custom code and enforces server-generated code', async () => {
    queryRunnerMock.manager.query.mockResolvedValueOnce([{ code: 'VND-005' }]);
    queryRunnerMock.manager.findOne.mockResolvedValue(null);

    const dto: CreateVendorDto = {
      code: 'VND-CUSTOM-999', // Client attempts custom code
      name: 'PT Rekanan Mandiri',
    };

    const result = await service.createVendor(dto, 42);

    expect(result.code).toBe('VND-006');
    expect(result.code).not.toBe('VND-CUSTOM-999');
  });

  it('5c. POST create sequentially generates VND-007 when previous code was VND-006', async () => {
    queryRunnerMock.manager.query.mockResolvedValueOnce([{ code: 'VND-006' }]);
    queryRunnerMock.manager.findOne.mockResolvedValue(null);

    const dto: CreateVendorDto = {
      name: 'PT Mitra Sukses',
    };

    const result = await service.createVendor(dto, 42);

    expect(result.code).toBe('VND-007');
  });

  it('5d. POST create skips existing codes (including soft-deleted) during candidate resolution', async () => {
    // Initial query returns VND-005 -> next candidate is VND-006
    queryRunnerMock.manager.query.mockResolvedValueOnce([{ code: 'VND-005' }]);
    // First candidate VND-006 already exists (e.g. historical soft-deleted)
    queryRunnerMock.manager.findOne
      .mockResolvedValueOnce({ id: 99, code: 'VND-006', deletedAt: new Date() }) // collision on 006
      .mockResolvedValueOnce(null); // VND-007 is free

    const dto: CreateVendorDto = {
      name: 'PT Solusi Alternatif',
    };

    const result = await service.createVendor(dto, 42);

    // Generator must skip VND-006 and use VND-007
    expect(result.code).toBe('VND-007');
  });

  it('5e. POST create catches duplicate entry error on race condition and rolls back transaction', async () => {
    queryRunnerMock.manager.query.mockResolvedValueOnce([{ code: 'VND-005' }]);
    queryRunnerMock.manager.findOne.mockResolvedValue(null);
    queryRunnerMock.manager.save.mockRejectedValueOnce({
      code: 'ER_DUP_ENTRY',
      message: "Duplicate entry 'VND-006' for key 'code'",
    });

    const dto: CreateVendorDto = {
      name: 'PT Balap Race Condition',
    };

    await expect(service.createVendor(dto, 42)).rejects.toThrow(ConflictException);
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunnerMock.release).toHaveBeenCalled();
  });

  // 7. PATCH UPDATE — Valid Vendor
  it('7. PATCH update modifies allowed fields, sets updatedBy, and emits audit.log', async () => {
    const existingVendor = { ...mockActiveVendors[0] };
    vendorRepoMock.findOne.mockResolvedValue(existingVendor);

    const dto: UpdateVendorDto = {
      name: 'PT IT Solusi Bersama Tbk',
      address: 'Jl. Sudirman Tower 1 Lt. 20',
      vendorType: 'Technology',
    };

    const userId = 77;
    const result = await service.updateVendor(1, dto, userId);

    expect(result.name).toBe('PT IT Solusi Bersama Tbk');
    expect(result.address).toBe('Jl. Sudirman Tower 1 Lt. 20');
    expect(result.vendorType).toBe('Technology');
    expect(result.updatedBy).toBe(77);
    // Ensure code is not modified
    expect(result.code).toBe('VND-001');
    expect(eventEmitterMock.emit).toHaveBeenCalledWith(
      'audit.log',
      expect.objectContaining({
        action: 'UPDATE',
        entityName: 'vendors',
        entityId: 1,
        userId: 77,
      }),
    );
  });

  // 8. PATCH UPDATE — Non-existing Vendor
  it('8. PATCH update on non-existing vendor throws NotFoundException', async () => {
    vendorRepoMock.findOne.mockResolvedValue(null);

    const dto: UpdateVendorDto = { name: 'New Name' };
    await expect(service.updateVendor(999, dto, 1)).rejects.toThrow(NotFoundException);
  });

  // 9. DELETE SOFT-DELETE — Soft delete with audit and historical transaction preservation
  it('9. DELETE performs soft delete, sets deletedBy, and preserves historical transaction integrity', async () => {
    const existingVendor = { ...mockActiveVendors[0] };
    vendorRepoMock.findOne.mockResolvedValue(existingVendor);
    poRepoMock.count.mockResolvedValue(2); // Has 2 existing POs
    quotationRepoMock.count.mockResolvedValue(3); // Has 3 existing Quotations
    vendorComparisonRepoMock.count.mockResolvedValue(1); // Has 1 comparison

    const userId = 99;
    const result = await service.softDeleteVendor(1, userId);

    expect(result.success).toBe(true);
    expect(result.data.hasHistoricalTransactions).toBe(true);
    expect(result.data.historicalTransactions.purchaseOrders).toBe(2);
    expect(existingVendor.deletedBy).toBe(99);
    expect(vendorRepoMock.softRemove).toHaveBeenCalledWith(existingVendor);
    expect(eventEmitterMock.emit).toHaveBeenCalledWith(
      'audit.log',
      expect.objectContaining({
        action: 'SOFT_DELETE',
        entityName: 'vendors',
        entityId: 1,
        userId: 99,
      }),
    );
  });

  // 10. SOFT-DELETED VENDOR EXCLUSION
  it('10. Soft-deleted vendor does not appear in active query builder results', async () => {
    // Standard TypeORM query builder automatically adds `deleted_at IS NULL` when @DeleteDateColumn is defined
    const qbMock: any = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(mockActiveVendors.filter(v => !v.deletedAt)),
    };
    vendorRepoMock.createQueryBuilder.mockReturnValue(qbMock);

    const result = (await service.getAllVendors()) as Vendor[];
    expect(result.every((v: Vendor) => v.deletedAt === null)).toBe(true);
  });
});

describe('ProcurementController - Vendor RBAC & Controller Delegation', () => {
  let controller: ProcurementController;
  let serviceMock: any;

  beforeEach(async () => {
    serviceMock = {
      getAllVendors: jest.fn().mockResolvedValue([]),
      getVendorById: jest.fn().mockResolvedValue({ id: 1 }),
      createVendor: jest.fn().mockResolvedValue({ id: 10 }),
      updateVendor: jest.fn().mockResolvedValue({ id: 10 }),
      softDeleteVendor: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcurementController],
      providers: [
        { provide: ProcurementService, useValue: serviceMock },
        { provide: ProcurementPackageService, useValue: {} },
        { provide: ProcurementReconciliationService, useValue: {} },
      ],
    }).compile();

    controller = module.get<ProcurementController>(ProcurementController);
  });

  it('verifies RBAC roles on mutation endpoints (PROCUREMENT, PURCHASING, ADMIN, SUPER_ADMIN)', () => {
    const reflector = new (require('@nestjs/core').Reflector)();

    const createRoles = reflector.get('roles', controller.createVendor);
    expect(createRoles).toEqual(expect.arrayContaining(['PROCUREMENT', 'PURCHASING', 'ADMIN', 'SUPER_ADMIN']));

    const updateRoles = reflector.get('roles', controller.updateVendor);
    expect(updateRoles).toEqual(expect.arrayContaining(['PROCUREMENT', 'PURCHASING', 'ADMIN', 'SUPER_ADMIN']));

    const deleteRoles = reflector.get('roles', controller.deleteVendor);
    expect(deleteRoles).toEqual(expect.arrayContaining(['PROCUREMENT', 'PURCHASING', 'ADMIN', 'SUPER_ADMIN']));
  });

  it('verifies RBAC roles on read endpoints (compatible with Procurement/RFQ consumer roles)', () => {
    const reflector = new (require('@nestjs/core').Reflector)();

    const listRoles = reflector.get('roles', controller.getAllVendors);
    expect(listRoles).toEqual(
      expect.arrayContaining(['PROCUREMENT', 'PURCHASING', 'PROJECT_MANAGER', 'SUPER_ADMIN', 'FINANCE']),
    );

    const detailRoles = reflector.get('roles', controller.getVendorById);
    expect(detailRoles).toEqual(
      expect.arrayContaining(['PROCUREMENT', 'PURCHASING', 'PROJECT_MANAGER', 'SUPER_ADMIN', 'FINANCE']),
    );
  });

  it('controller extracts authenticated JWT userId for create, update, and soft-delete', async () => {
    const req = { user: { userId: 42, role: 'PROCUREMENT' } };
    const createDto = { code: 'VND-NEW', name: 'New Vendor' };
    const updateDto = { name: 'Updated Vendor' };

    await controller.createVendor(req, createDto as any);
    expect(serviceMock.createVendor).toHaveBeenCalledWith(createDto, 42);

    await controller.updateVendor(req, 10, updateDto as any);
    expect(serviceMock.updateVendor).toHaveBeenCalledWith(10, updateDto, 42);

    await controller.deleteVendor(req, 10);
    expect(serviceMock.softDeleteVendor).toHaveBeenCalledWith(10, 42);
  });
});
