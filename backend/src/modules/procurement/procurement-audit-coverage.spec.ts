import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';
import { ProcurementService } from './procurement.service';
import { ProcurementController } from './procurement.controller';
import { ProcurementPackageService } from './procurement-package.service';
import { WorkflowService } from '../workflow-engine/workflow.service';
import { ProcurementPackage, ProcurementPackageStatus } from '../../entities/procurement-package.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { PurchaseRequestItem } from '../../entities/purchase-request-item.entity';
import { Rfq } from '../../entities/rfq.entity';
import { Vendor } from '../../entities/vendor.entity';
import { Quotation } from '../../entities/quotation.entity';
import { QuotationItem } from '../../entities/quotation-item.entity';
import { VendorComparison } from '../../entities/vendor-comparison.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../entities/purchase-order-item.entity';
import { PoPaymentTerm, PaymentTermType, PaymentTermStatus } from '../../entities/po-payment-term.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { GoodsReceiptItem } from '../../entities/goods-receipt-item.entity';
import { AuditLog } from '../../entities/audit-log.entity';

describe('ProcurementService - Canonical AuditLog Coverage (AUDIT-TRAIL-4A & 4B)', () => {
  let service: ProcurementService;
  let controller: ProcurementController;
  let packageService: ProcurementPackageService;
  let dataSourceMock: any;
  let queryRunnerMock: any;
  let prRepoMock: any;
  let rfqRepoMock: any;
  let vendorRepoMock: any;
  let quotationRepoMock: any;
  let quotationItemRepoMock: any;
  let vendorComparisonRepoMock: any;
  let poRepoMock: any;
  let grRepoMock: any;
  let eventEmitterMock: any;
  let workflowServiceMock: any;
  let packageRepoMock: any;
  let packageItemRepoMock: any;
  let prItemRepoMock: any;
  let projectRepoMock: any;
  let costItemRepoMock: any;
  let costEstimateRepoMock: any;
  let wfDefRepoMock: any;
  let wfInstRepoMock: any;
  let wfEngineServiceMock: any;

  let savedAuditLogs: any[] = [];
  let saveHistory: Array<{ entityClass: any; data: any }> = [];

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
            entity.id = 999;
          }
          return Promise.resolve(entity);
        }),
        create: jest.fn().mockImplementation((entityClass: any, data: any) => {
          if (entityClass === AuditLog) {
            const audit = new AuditLog();
            Object.assign(audit, data);
            return audit;
          }
          return { ...data, id: data?.id || 101 };
        }),
        findOne: jest.fn(),
        find: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        query: jest.fn().mockImplementation((q) => {
          if (q.includes('SELECT status FROM projects')) {
            return Promise.resolve([{ status: 'IN_PROGRESS' }]);
          }
          if (q.includes('COUNT(pri.id) as cnt')) {
            return Promise.resolve([{ cnt: 0 }]);
          }
          return Promise.resolve([]);
        }),
      },
      query: jest.fn(),
    };

    dataSourceMock = {
      manager: {
        query: jest.fn(),
      },
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
    };

    prRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((d) => ({ ...d, id: 10 })),
      save: jest.fn().mockImplementation((d) => Promise.resolve({ ...d, id: d.id || 10 })),
      count: jest.fn().mockResolvedValue(0),
    };

    rfqRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((d) => ({ ...d, id: 20 })),
      save: jest.fn().mockImplementation((d) => Promise.resolve({ ...d, id: d.id || 20 })),
      count: jest.fn().mockResolvedValue(0),
    };

    vendorRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };

    quotationRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };

    quotationItemRepoMock = {
      find: jest.fn(),
    };

    vendorComparisonRepoMock = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((d) => ({ ...d, id: 30 })),
      save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
    };

    poRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };

    grRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };

    eventEmitterMock = {
      emit: jest.fn(),
    };

    workflowServiceMock = {
      triggerWorkflow: jest.fn(),
    };

    packageRepoMock = { find: jest.fn(), findOne: jest.fn(), save: jest.fn() };
    packageItemRepoMock = { find: jest.fn(), findOne: jest.fn(), save: jest.fn() };
    prItemRepoMock = { find: jest.fn(), findOne: jest.fn(), save: jest.fn() };
    projectRepoMock = { find: jest.fn(), findOne: jest.fn() };
    costItemRepoMock = { find: jest.fn(), findOne: jest.fn() };
    costEstimateRepoMock = { find: jest.fn(), findOne: jest.fn() };
    wfDefRepoMock = {
      findOne: jest.fn().mockResolvedValue({
        workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
        isActive: 1,
        activeVersion: { id: 1 },
      }),
    };
    wfInstRepoMock = { findOne: jest.fn() };
    wfEngineServiceMock = { startInstance: jest.fn().mockResolvedValue({ instanceId: 100 }) };

    packageService = new ProcurementPackageService(
      packageRepoMock,
      packageItemRepoMock,
      prRepoMock,
      prItemRepoMock,
      projectRepoMock,
      costItemRepoMock,
      costEstimateRepoMock,
      wfDefRepoMock,
      wfInstRepoMock,
      wfEngineServiceMock,
      dataSourceMock,
    );

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcurementController],
      providers: [
        ProcurementService,
        { provide: ProcurementPackageService, useValue: packageService },
        { provide: require('./procurement-reconciliation.service').ProcurementReconciliationService, useValue: {} },
        { provide: getRepositoryToken(PurchaseRequest), useValue: prRepoMock },
        { provide: getRepositoryToken(Rfq), useValue: rfqRepoMock },
        { provide: getRepositoryToken(Vendor), useValue: vendorRepoMock },
        { provide: getRepositoryToken(Quotation), useValue: quotationRepoMock },
        { provide: getRepositoryToken(QuotationItem), useValue: quotationItemRepoMock },
        { provide: getRepositoryToken(VendorComparison), useValue: vendorComparisonRepoMock },
        { provide: getRepositoryToken(PurchaseOrder), useValue: poRepoMock },
        { provide: getRepositoryToken(PoPaymentTerm), useValue: {} },
        { provide: getRepositoryToken(GoodsReceipt), useValue: grRepoMock },
        { provide: WorkflowService, useValue: workflowServiceMock },
        { provide: require('../workflow-engine/workflow-engine.service').WorkflowEngineService, useValue: { startInstance: jest.fn() } },
        { provide: require('../workflow-engine/workflow-engine.service').WorkflowEngineService, useValue: { startInstance: jest.fn() } },
        { provide: EventEmitter2, useValue: eventEmitterMock },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<ProcurementService>(ProcurementService);
    controller = module.get<ProcurementController>(ProcurementController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Purchase Request -> SUBMIT', () => {
    const actorUserId = 77;
    const createPrDto: any = {
      projectId: 5,
      totalEstimatedAmount: 15000000,
      items: [
        { itemName: 'Concrete Mix', quantity: 10, estimatedUnitPrice: 1000000 },
        { itemName: 'Steel Rebar', quantity: 5, estimatedUnitPrice: 1000000 },
      ],
    };

    it('A. Direct PR Guard: should reject direct PR creation for IN_PROGRESS project with BadRequestException', async () => {
      queryRunnerMock.manager.count.mockResolvedValue(0);

      await expect(
        service.createAndSubmitPurchaseRequest(actorUserId, createPrDto),
      ).rejects.toThrow(
        'Pembuatan Purchase Request langsung tidak diizinkan untuk proyek IN_PROGRESS. Seluruh pengadaan proyek wajib melalui Paket Pengadaan (Procurement Package).',
      );
    });

    it('B. Canonical Package PR Audit: should create canonical AuditLog SUBMIT_FROM_PACKAGE via package flow', async () => {
      const mockPkg: any = {
        id: 1,
        packageNumber: 'PKG-20260924-001',
        projectId: 5,
        status: ProcurementPackageStatus.SUBMITTED,
        totalEstimatedAmount: 15000000,
        items: [
          { id: 11, costItemId: 101, requestedQty: 10, uom: 'M3', estimatedUnitPrice: 1000000, itemName: 'Concrete Mix' },
          { id: 12, costItemId: 102, requestedQty: 5, uom: 'TON', estimatedUnitPrice: 1000000, itemName: 'Steel Rebar' },
        ],
        project: { id: 5, name: 'Project 5' },
      };

      queryRunnerMock.manager.findOne.mockImplementation((entity: any) => {
        if (entity === ProcurementPackage) return Promise.resolve(mockPkg);
        if (entity === PurchaseRequest) return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const result = await packageService.createPrFromPackage(1, actorUserId, ['PROCUREMENT']);

      expect(result.success).toBe(true);
      expect(queryRunnerMock.startTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();

      // Find the audit log in savedAuditLogs
      const audit = savedAuditLogs.find((a) => a.table_name === 'purchase_requests');
      expect(audit).toBeDefined();
      expect(audit.table_name).toBe('purchase_requests');
      expect(audit.record_id).toBeDefined();
      expect(audit.action).toBe('SUBMIT_FROM_PACKAGE');
      expect(audit.old_value).toBeNull();
      expect(audit.created_by).toBe(actorUserId);
      expect(audit.new_value).toEqual({
        prNumber: expect.stringMatching(/^PR-\d{8}-001$/),
        packageId: 1,
        packageNumber: 'PKG-20260924-001',
        totalEstimatedAmount: 15000000,
        origin: 'PACKAGE',
      });

      // Assert saved via queryRunner.manager.save(AuditLog, ...) before commitTransaction
      const auditSaveCall = saveHistory.find((h) => h.entityClass === AuditLog && h.data.table_name === 'purchase_requests');
      expect(auditSaveCall).toBeDefined();
    });

    it('I. PR Detail & RBAC: should retrieve PR detail with relations and match controller roles', async () => {
      const mockPr = {
        id: 5,
        prNumber: 'PR-20260916-001',
        projectId: 5,
        items: [{ id: 1, itemName: 'Server Alpha' }],
        project: { id: 5, name: 'Project 5' },
      };
      prRepoMock.findOne.mockResolvedValue(mockPr);

      const res = await service.getPurchaseRequestById(5);
      expect(prRepoMock.findOne).toHaveBeenCalledWith({
        where: { id: 5 },
        relations: ['items', 'project'],
      });
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockPr);

      const reflector = new (require('@nestjs/core').Reflector)();
      const listRoles = reflector.get('roles', controller.getAllPurchaseRequests);
      const detailRoles = reflector.get('roles', controller.getPurchaseRequestById);
      expect(listRoles).toEqual(detailRoles);
      expect(detailRoles).toContain('PROCUREMENT');
      expect(detailRoles).toContain('PURCHASING');
      expect(detailRoles).toContain('PROJECT_MANAGER');
      expect(detailRoles).not.toContain('MARKETING');
    });

    it('J. PR Detail 404: should throw NotFoundException when PR does not exist', async () => {
      prRepoMock.findOne.mockResolvedValue(null);
      await expect(service.getPurchaseRequestById(9999)).rejects.toThrow('Purchase Request #9999 tidak ditemukan');
    });
  });

  describe('2. RFQ -> CREATE (Atomic Transaction Boundary)', () => {
    const actorUserId = 88;
    const createRfqDto: any = {
      purchaseRequestId: 12,
      closingDate: new Date('2026-10-01T00:00:00.000Z').toISOString(),
    };

    const mockApprovedPr = {
      id: 12,
      prNumber: 'PR-20260911-001',
      status: 'APPROVED',
      projectId: 3,
      items: [],
      project: { id: 3, name: 'Project Alpha' },
    };

    it('A-G: should wrap RFQ creation and AuditLog in ONE atomic transaction with canonical payload', async () => {
      prRepoMock.findOne.mockResolvedValue(mockApprovedPr);
      rfqRepoMock.findOne.mockResolvedValue(null); // No duplicate active RFQ
      queryRunnerMock.manager.count.mockResolvedValue(0);

      const result = await service.createRfq(createRfqDto, actorUserId);

      expect(result.success).toBe(true);
      expect(queryRunnerMock.startTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();

      const audit = savedAuditLogs.find((a) => a.table_name === 'rfqs' && a.action === 'CREATE');
      expect(audit).toBeDefined();
      expect(audit.table_name).toBe('rfqs');
      expect(audit.action).toBe('CREATE');
      expect(audit.old_value).toBeNull();
      expect(audit.created_by).toBe(actorUserId);
      expect(audit.new_value).toEqual({
        rfqNumber: expect.stringMatching(/^RFQ-\d{8}-001$/),
        prId: 12,
        status: 'OPEN',
        closingDate: expect.any(String),
      });

      const auditSaveCall = saveHistory.find((h) => h.entityClass === AuditLog && h.data.action === 'CREATE');
      expect(auditSaveCall).toBeDefined();
    });

    it('H. Rollback: should rollback atomic transaction when audit save fails', async () => {
      prRepoMock.findOne.mockResolvedValue(mockApprovedPr);
      rfqRepoMock.findOne.mockResolvedValue(null);

      // Simulate failure on AuditLog save
      queryRunnerMock.manager.save.mockImplementation((entityClass: any, data: any) => {
        if (entityClass === AuditLog) {
          return Promise.reject(new Error('Audit table disk full'));
        }
        return Promise.resolve(data);
      });

      await expect(service.createRfq(createRfqDto, actorUserId)).rejects.toThrow('Audit table disk full');
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.release).toHaveBeenCalled();
    });
  });

  describe('3. Vendor Quotation -> SUBMIT', () => {
    const actorUserId = 99;
    const createQuotationDto: any = {
      rfqId: 25,
      vendorId: 4,
      leadTimeDays: 14,
      items: [
        { prItemId: 101, itemName: 'Server Rack', quantity: 2, unitPrice: 5000000 },
      ],
    };

    const mockRfq = {
      id: 25,
      rfqNumber: 'RFQ-20260911-001',
      status: 'OPEN',
      closingDate: new Date('2026-12-31'),
      purchaseRequest: {
        id: 12,
        projectId: 3,
        items: [{ id: 101, itemName: 'Server Rack' }],
      },
    };

    const mockVendor = {
      id: 4,
      name: 'PT Mitra Solusi',
      deletedAt: null,
    };

    it('A-G: should create canonical AuditLog for quotation SUBMIT within queryRunner transaction', async () => {
      rfqRepoMock.findOne.mockResolvedValue(mockRfq);
      vendorRepoMock.findOne.mockResolvedValue(mockVendor);
      quotationRepoMock.findOne
        .mockResolvedValueOnce(null) // No existing duplicate quotation
        .mockResolvedValueOnce({ id: 999, quotationNumber: 'QT-20260911-001', totalAmount: 10000000, status: 'SUBMITTED' }); // Return for getQuotationById
      queryRunnerMock.query.mockResolvedValue([]); // Pessimistic lock sequence query

      const result = await service.createQuotation(createQuotationDto, actorUserId);

      expect(result).toBeDefined();
      expect(queryRunnerMock.startTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();

      const audit = savedAuditLogs.find((a) => a.table_name === 'quotations');
      expect(audit).toBeDefined();
      expect(audit.table_name).toBe('quotations');
      expect(audit.action).toBe('SUBMIT');
      expect(audit.old_value).toBeNull();
      expect(audit.created_by).toBe(actorUserId);
      expect(audit.new_value).toEqual({
        quotationNumber: expect.stringMatching(/^QT-\d{8}-001$/),
        rfqId: 25,
        vendorId: 4,
        totalAmount: 10000000,
        leadTimeDays: 14,
        status: 'SUBMITTED',
      });

      const auditSaveCall = saveHistory.find((h) => h.entityClass === AuditLog && h.data.table_name === 'quotations');
      expect(auditSaveCall).toBeDefined();
    });

    it('H. Rollback: should rollback quotation transaction if error occurs before commit', async () => {
      rfqRepoMock.findOne.mockResolvedValue(mockRfq);
      vendorRepoMock.findOne.mockResolvedValue(mockVendor);
      quotationRepoMock.findOne.mockResolvedValue(null);
      queryRunnerMock.query.mockResolvedValue([]);

      queryRunnerMock.commitTransaction.mockRejectedValueOnce(new Error('Quotation transaction abort'));

      await expect(service.createQuotation(createQuotationDto, actorUserId)).rejects.toThrow('Quotation transaction abort');
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.release).toHaveBeenCalled();
    });
  });

  describe('4. Vendor Comparison -> EVALUATE', () => {
    const actorUserId = 66;
    const rfqId = 33;
    const vendorsData = [
      { vendorId: 1, offeredAmount: 12000000, isWinner: false },
      { vendorId: 2, offeredAmount: 11500000, isWinner: false },
      { vendorId: 3, offeredAmount: 11000000, isWinner: true },
    ];

    const mockOpenRfq = {
      id: rfqId,
      rfqNumber: 'RFQ-20260911-002',
      status: 'OPEN',
      purchaseRequest: {
        id: 15,
        totalEstimatedAmount: 15000000,
      },
    };

    const mockDbQuotations = [
      { id: 1, rfqId: 33, vendorId: 1, totalAmount: 12000000, status: 'SUBMITTED' },
      { id: 2, rfqId: 33, vendorId: 2, totalAmount: 11500000, status: 'SUBMITTED' },
      { id: 3, rfqId: 33, vendorId: 3, totalAmount: 11000000, status: 'SUBMITTED' },
    ];

    beforeEach(() => {
      queryRunnerMock.manager.findOne.mockImplementation((entityClass: any, options: any) => {
        if (entityClass === Rfq && options?.where?.id === rfqId) return Promise.resolve({ ...mockOpenRfq });
        return Promise.resolve(null);
      });
      queryRunnerMock.manager.find.mockImplementation((entityClass: any, options: any) => {
        if (entityClass === Quotation && options?.where?.rfqId === rfqId) return Promise.resolve([...mockDbQuotations]);
        return Promise.resolve([]);
      });
    });

    it('A-G: should record EVALUATE AuditLog with old_value OPEN and new_value details', async () => {
      const result = await service.submitVendorComparison(rfqId, vendorsData, actorUserId);

      expect(result.success).toBe(true);
      expect(queryRunnerMock.startTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();

      const audit = savedAuditLogs.find((a) => a.table_name === 'rfqs' && a.action === 'EVALUATE');
      expect(audit).toBeDefined();
      expect(audit.table_name).toBe('rfqs');
      expect(audit.record_id).toBe(rfqId);
      expect(audit.action).toBe('EVALUATE');
      expect(audit.old_value).toEqual({ status: 'OPEN' });
      expect(audit.created_by).toBe(actorUserId);
      expect(audit.new_value).toEqual({
        status: 'EVALUATED',
        winnerVendorId: 3,
        winnerAmount: 11000000,
        vendorsCount: 3,
      });

      const auditSaveCall = saveHistory.find((h) => h.entityClass === AuditLog && h.data.action === 'EVALUATE');
      expect(auditSaveCall).toBeDefined();
    });

    it('H. Rollback: should rollback transaction when comparison evaluation fails', async () => {
      queryRunnerMock.manager.save.mockRejectedValueOnce(new Error('Vendor comparison save failed'));

      await expect(service.submitVendorComparison(rfqId, vendorsData, actorUserId)).rejects.toThrow('Vendor comparison save failed');
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.release).toHaveBeenCalled();
    });

    it('I. Actor Propagation: Controller should extract userId from JWT request and forward to service', async () => {
      const mockReq = {
        user: {
          userId: 777,
          email: 'procurement.lead@epms.com',
          role: 'PROCUREMENT',
        },
      };

      const dto = {
        rfqId,
        vendors: vendorsData,
      };

      const submitSpy = jest.spyOn(service, 'submitVendorComparison');

      const response = await controller.submitVendorComparison(mockReq as any, dto as any);

      expect(response.success).toBe(true);
      expect(submitSpy).toHaveBeenCalledWith(rfqId, vendorsData, 777, undefined);

      // Verify AuditLog.created_by matches dynamic JWT userId
      const audit = savedAuditLogs.find((a) => a.table_name === 'rfqs' && a.action === 'EVALUATE');
      expect(audit).toBeDefined();
      expect(audit.created_by).toBe(777);
      expect(audit.new_value.winnerVendorId).toBe(3);
    });

    it('J. Actor Propagation Fallback: Controller should support req.user.id and req.user.sub without hardcoding', async () => {
      const submitSpy = jest.spyOn(service, 'submitVendorComparison');

      // Test with req.user.id
      const mockReqId = { user: { id: 888 } };
      await controller.submitVendorComparison(mockReqId as any, { rfqId, vendors: vendorsData } as any);
      expect(submitSpy).toHaveBeenCalledWith(rfqId, vendorsData, 888, undefined);

      // Test with req.user.sub
      const mockReqSub = { user: { sub: 999 } };
      await controller.submitVendorComparison(mockReqSub as any, { rfqId, vendors: vendorsData } as any);
      expect(submitSpy).toHaveBeenCalledWith(rfqId, vendorsData, 999, undefined);
    });
  });

  describe('5. Purchase Order -> ISSUE', () => {
    const actorUserId = 55;
    const poDto: any = {
      purchase_request_id: 10,
      vendor_id: 2,
      delivery_location: 'Jakarta Warehouse',
      payment_terms: [
        { sequence: 1, term_name: 'DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 50 },
        { sequence: 2, term_name: 'Final', term_type: PaymentTermType.FINAL_DELIVERY, percentage: 50 },
      ],
    };

    const mockPr = {
      id: 10,
      prNumber: 'PR-20260911-003',
      status: 'APPROVED',
    };

    const mockRfq = {
      id: 40,
      rfqNumber: 'RFQ-20260911-003',
      status: 'EVALUATED',
      prId: 10,
    };

    const mockComparisons = [
      { rfqId: 40, vendorId: 2, offeredAmount: 20000000, isWinner: true },
    ];

    const mockQuotation = {
      id: 70,
      quotationNumber: 'QT-20260911-001',
      rfqId: 40,
      vendorId: 2,
      status: 'SUBMITTED',
      leadTimeDays: 10,
      items: [
        { prItemId: 1, itemName: 'Industrial Pump', quantity: 2, unitPrice: 10000000 },
      ],
    };

    it('A-G: should create canonical AuditLog for PO ISSUE with paymentTermsCount and authoritative amount', async () => {
      queryRunnerMock.manager.findOne.mockImplementation((entityClass: any) => {
        if (entityClass === PurchaseRequest) return Promise.resolve({ ...mockPr });
        if (entityClass === PurchaseOrder) return Promise.resolve(null);
        if (entityClass === Rfq) return Promise.resolve({ ...mockRfq });
        if (entityClass === Quotation) return Promise.resolve({ ...mockQuotation });
        return Promise.resolve(null);
      });

      queryRunnerMock.manager.find.mockImplementation((entityClass: any) => {
        if (entityClass === PurchaseRequestItem) {
          return Promise.resolve([
            { id: 1, prId: 10, itemName: 'Industrial Pump', quantity: 2, costItemId: 101 },
          ]);
        }
        if (entityClass === Rfq) return Promise.resolve([{ ...mockRfq }]);
        if (entityClass === VendorComparison) return Promise.resolve([...mockComparisons]);
        return Promise.resolve([]);
      });

      queryRunnerMock.manager.count.mockResolvedValue(0);

      const result = await service.createPurchaseOrder(actorUserId, poDto);

      expect(result.success).toBe(true);
      expect(queryRunnerMock.startTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();

      const audit = savedAuditLogs.find((a) => a.table_name === 'purchase_orders');
      expect(audit).toBeDefined();
      expect(audit.table_name).toBe('purchase_orders');
      expect(audit.action).toBe('ISSUE');
      expect(audit.old_value).toBeNull();
      expect(audit.created_by).toBe(actorUserId);
      expect(audit.new_value).toEqual({
        poNumber: expect.stringMatching(/^PO-\d{8}-001$/),
        prId: 10,
        vendorId: 2,
        totalAmount: 20000000,
        status: 'ISSUED',
        paymentTermsCount: 2,
      });

      const auditSaveCall = saveHistory.find((h) => h.entityClass === AuditLog && h.data.table_name === 'purchase_orders');
      expect(auditSaveCall).toBeDefined();
    });

    it('H. Rollback: should rollback PO transaction if error occurs during creation', async () => {
      queryRunnerMock.manager.findOne.mockImplementation((entityClass: any) => {
        if (entityClass === PurchaseRequest) return Promise.resolve({ ...mockPr });
        if (entityClass === PurchaseOrder) return Promise.resolve(null);
        if (entityClass === Rfq) return Promise.resolve({ ...mockRfq });
        if (entityClass === Quotation) return Promise.resolve({ ...mockQuotation });
        return Promise.resolve(null);
      });

      queryRunnerMock.manager.find.mockImplementation((entityClass: any) => {
        if (entityClass === PurchaseRequestItem) {
          return Promise.resolve([
            { id: 1, prId: 10, itemName: 'Industrial Pump', quantity: 2, costItemId: 101 },
          ]);
        }
        if (entityClass === Rfq) return Promise.resolve([{ ...mockRfq }]);
        if (entityClass === VendorComparison) return Promise.resolve([...mockComparisons]);
        return Promise.resolve([]);
      });

      queryRunnerMock.commitTransaction.mockRejectedValueOnce(new Error('PO commit error'));

      await expect(service.createPurchaseOrder(actorUserId, poDto)).rejects.toThrow('PO commit error');
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.release).toHaveBeenCalled();
    });
  });

  describe('6. Goods Receipt -> RECEIVE', () => {
    const actorUserId = 44;
    const grDto: any = {
      purchaseOrderId: 50,
      receiptDate: new Date('2026-09-12').toISOString(),
      remarks: 'Goods received in good condition',
      items: [
        { poItemId: 201, receivedQuantity: 2, remarks: 'Full delivery' },
      ],
    };

    const mockPo = {
      id: 50,
      poNumber: 'PO-20260911-001',
      status: 'ISSUED',
      items: [
        { id: 201, itemName: 'Generator', quantity: 2, receivedQuantity: 0, unitPrice: 15000000 },
      ],
    };

    it('A-G: should create canonical AuditLog for GR RECEIVE with calculated amounts and itemsCount', async () => {
      queryRunnerMock.manager.findOne.mockImplementation((entityClass: any) => {
        if (entityClass === PurchaseOrder) return Promise.resolve({ ...mockPo, items: [{ ...mockPo.items[0] }] });
        return Promise.resolve(null);
      });
      queryRunnerMock.manager.count.mockResolvedValue(0);

      const result = await service.createGoodsReceipt(grDto, actorUserId);

      expect(result.success).toBe(true);
      expect(queryRunnerMock.startTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();

      const audit = savedAuditLogs.find((a) => a.table_name === 'goods_receipts');
      expect(audit).toBeDefined();
      expect(audit.table_name).toBe('goods_receipts');
      expect(audit.action).toBe('RECEIVE');
      expect(audit.old_value).toBeNull();
      expect(audit.created_by).toBe(actorUserId);
      expect(audit.new_value).toEqual({
        grNumber: expect.stringMatching(/^GR-\d{8}-001$/),
        poId: 50,
        totalReceivedAmount: 30000000,
        poStatusAfter: 'COMPLETED',
        itemsCount: 1,
      });

      const auditSaveCall = saveHistory.find((h) => h.entityClass === AuditLog && h.data.table_name === 'goods_receipts');
      expect(auditSaveCall).toBeDefined();
    });

    it('H. Rollback: should rollback GR transaction if commit fails', async () => {
      queryRunnerMock.manager.findOne.mockImplementation((entityClass: any) => {
        if (entityClass === PurchaseOrder) return Promise.resolve({ ...mockPo, items: [{ ...mockPo.items[0] }] });
        return Promise.resolve(null);
      });
      queryRunnerMock.manager.count.mockResolvedValue(0);

      queryRunnerMock.commitTransaction.mockRejectedValueOnce(new Error('GR commit failure'));

      await expect(service.createGoodsReceipt(grDto, actorUserId)).rejects.toThrow('GR commit failure');
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.release).toHaveBeenCalled();
    });
  });
});
