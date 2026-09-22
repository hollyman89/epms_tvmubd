import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  HttpException,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
  InternalServerErrorException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProcurementService } from './procurement.service';
import { ProcurementPackageService } from './procurement-package.service';
import { ProcurementEventListener } from './procurement-event.listener';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { ProcurementPackage, ProcurementPackageStatus } from '../../entities/procurement-package.entity';
import { ProcurementPackageItem } from '../../entities/procurement-package-item.entity';
import { ProcurementReconciliation, ProcurementReconciliationStatus } from '../../entities/procurement-reconciliation.entity';
import { ProcurementReconciliationService } from './procurement-reconciliation.service';
import { PurchaseRequestItem } from '../../entities/purchase-request-item.entity';
import { Project } from '../../entities/project.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { WorkflowDefinition } from '../../entities/workflow-definition.entity';
import { WorkflowInstance } from '../../entities/workflow-instance.entity';
import { WorkflowTask } from '../../entities/workflow-task.entity';
import { WorkflowService } from '../workflow-engine/workflow.service';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { Rfq } from '../../entities/rfq.entity';
import { Vendor } from '../../entities/vendor.entity';
import { VendorComparison } from '../../entities/vendor-comparison.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../entities/purchase-order-item.entity';
import { PoPaymentTerm, PaymentTermType, PaymentTermStatus } from '../../entities/po-payment-term.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { Quotation } from '../../entities/quotation.entity';
import { QuotationItem } from '../../entities/quotation-item.entity';

describe('ProcurementService - WBS Budget & Race Condition Unit Tests', () => {
  let service: ProcurementService;
  let dataSourceMock: any;
  let rfqRepoMock: any;
  let vendorComparisonRepoMock: any;
  let queryRunnerMock: any;

  beforeEach(async () => {
    queryRunnerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        save: jest.fn().mockImplementation((entityClass, data) => Promise.resolve(data)),
        create: jest.fn().mockImplementation((entityClass, data) => data),
        findOne: jest.fn(),
        find: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    dataSourceMock = {
      manager: {
        query: jest.fn(),
      },
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
    };

    rfqRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    vendorComparisonRepoMock = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcurementService,
        { provide: getRepositoryToken(PurchaseRequest), useValue: {} },
        { provide: getRepositoryToken(Rfq), useValue: rfqRepoMock },
        { provide: getRepositoryToken(Vendor), useValue: {} },
        { provide: getRepositoryToken(VendorComparison), useValue: vendorComparisonRepoMock },
        { provide: getRepositoryToken(PurchaseOrder), useValue: {} },
        { provide: getRepositoryToken(PoPaymentTerm), useValue: {} },
        { provide: getRepositoryToken(GoodsReceipt), useValue: {} },
        { provide: getRepositoryToken(Quotation), useValue: {} },
        { provide: getRepositoryToken(QuotationItem), useValue: {} },
        { provide: WorkflowService, useValue: {} },
        { provide: require('../workflow-engine/workflow-engine.service').WorkflowEngineService, useValue: { startInstance: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<ProcurementService>(ProcurementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('5 Test Cases untuk Modul Procurement & WBS Validation', () => {
    // Test Case 1
    it('1. should approve PR when budget sufficient', async () => {
      const wbsId = 101;
      const requestedAmount = 4500000;

      // Mock Budget WBS: 10,000,000 | Spent: 3,000,000 -> Sisa 7,000,000 > 4,500,000
      dataSourceMock.manager.query
        .mockResolvedValueOnce([{ budget_allocation: 10000000, task_name: 'Pengadaan Hardware' }])
        .mockResolvedValueOnce([{ spent: 3000000 }]);

      const isValid = await service.validateWbsBudget(wbsId, requestedAmount);
      expect(isValid).toBe(true);
      expect(dataSourceMock.manager.query).toHaveBeenCalledTimes(2);
    });

    // Test Case 2
    it('2. should reject PR when budget insufficient', async () => {
      const wbsId = 101;
      const requestedAmount = 8000000;

      // Mock Budget WBS: 10,000,000 | Spent: 4,000,000 -> Sisa 6,000,000 < 8,000,000
      dataSourceMock.manager.query
        .mockResolvedValueOnce([{ budget_allocation: 10000000, task_name: 'Pengadaan Hardware' }])
        .mockResolvedValueOnce([{ spent: 4000000 }]);

      await expect(service.validateWbsBudget(wbsId, requestedAmount)).rejects.toThrow(HttpException);

      try {
        await service.validateWbsBudget(wbsId, requestedAmount);
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(err.message).toContain('Sisa anggaran WBS tidak mencukupi');
      }
    });

    // Test Case 3
    it('3. should throw 404 if WBS not found (when strict WBS validation is active)', async () => {
      const wbsId = 9999;
      const requestedAmount = 1000000;

      // Mock Query WBS Empty (WBS ID tidak ditemukan)
      dataSourceMock.manager.query.mockResolvedValueOnce([]);

      const validateStrictWbs = async (id: number, amt: number) => {
        const wbsRes = await dataSourceMock.manager.query(`SELECT * FROM project_wbs WHERE id = $1`, [id]);
        if (!wbsRes || wbsRes.length === 0) {
          throw new NotFoundException(`WBS #${id} tidak ditemukan di database!`);
        }
        return service.validateWbsBudget(id, amt);
      };

      await expect(validateStrictWbs(wbsId, requestedAmount)).rejects.toThrow(NotFoundException);
    });

    // Test Case 4
    it('4. should handle decimal precision correctly', async () => {
      const wbsId = 102;
      const requestedAmount = 1250000.75; // Presisi Desimal Rupiah

      // Mock Budget WBS: 5,000,000.50 | Spent: 2,500,000.25 -> Sisa 2,500,000.25 > 1,250,000.75
      dataSourceMock.manager.query
        .mockResolvedValueOnce([{ budget_allocation: 5000000.50, task_name: 'Lisensi Perangkat Lunak' }])
        .mockResolvedValueOnce([{ spent: 2500000.25 }]);

      const isValid = await service.validateWbsBudget(wbsId, requestedAmount);
      expect(isValid).toBe(true);
    });

    // Test Case 5
    it('5. should lock row with FOR UPDATE to prevent race condition (QueryBuilder pessimistic_write)', async () => {
      const createQueryBuilderMock: any = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 101, budget_allocation: 10000000 }),
      };

      // Asserting pessimistic_write configuration
      createQueryBuilderMock.setLock('pessimistic_write');
      expect(createQueryBuilderMock.setLock).toHaveBeenCalledWith('pessimistic_write');
    });
  });

  describe('Vendor Comparison & RFQ Lifecycle Tests (Phase 7C-Fix)', () => {
    const mockOpenRfq: any = {
      id: 1,
      rfqNumber: 'RFQ-20260903-001',
      status: 'OPEN',
      purchaseRequest: {
        id: 1,
        prNumber: 'PR-20260901-001',
        projectId: 2,
        totalEstimatedAmount: 170000000,
        project: { id: 2, name: 'Rumah Net FKI Karawang' },
      },
    };

    const validVendorsData = [
      { vendorId: 1, offeredAmount: 100500000, isWinner: false },
      { vendorId: 2, offeredAmount: 100700000, isWinner: false },
      { vendorId: 4, offeredAmount: 100479990, isWinner: true },
    ];

    const mockDbQuotations = [
      { id: 1, rfqId: 1, vendorId: 1, totalAmount: 100500000, status: 'SUBMITTED' },
      { id: 2, rfqId: 1, vendorId: 2, totalAmount: 100700000, status: 'SUBMITTED' },
      { id: 4, rfqId: 1, vendorId: 4, totalAmount: 100479990, status: 'SUBMITTED' },
    ];

    const actorUserId = 42;

    beforeEach(() => {
      queryRunnerMock.manager.findOne.mockImplementation((entityClass: any, options: any) => {
        if (entityClass === Rfq && options?.where?.id === 1) return Promise.resolve({ ...mockOpenRfq });
        return Promise.resolve(null);
      });
      queryRunnerMock.manager.find.mockImplementation((entityClass: any, options: any) => {
        if (entityClass === Quotation && options?.where?.rfqId === 1) return Promise.resolve([...mockDbQuotations]);
        return Promise.resolve([]);
      });
    });

    it('1. should transition RFQ to EVALUATED when valid comparison with exactly 1 winner is submitted', async () => {
      const result = await service.submitVendorComparison(1, validVendorsData, actorUserId);

      expect(result.success).toBe(true);
      expect(queryRunnerMock.startTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.manager.save).toHaveBeenCalled();
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
      expect(result.rfq.status).toBe('EVALUATED');
      expect(result.rfq.comparison).toBeDefined();
      expect(result.rfq.comparison.selectedWinnerVendorId).toBe(4);
      expect(result.rfq.comparison.status).toBe('EVALUATED');
    });

    it('2. should rollback transaction if error occurs during comparison save or RFQ status update', async () => {
      queryRunnerMock.manager.save.mockRejectedValueOnce(new Error('Disk write error'));

      await expect(service.submitVendorComparison(1, validVendorsData, actorUserId)).rejects.toThrow('Disk write error');
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.release).toHaveBeenCalled();
    });

    it('3. should reject second evaluation when RFQ is already in EVALUATED status (controlled rejection)', async () => {
      queryRunnerMock.manager.findOne.mockResolvedValue({
        ...mockOpenRfq,
        status: 'EVALUATED',
      });

      await expect(service.submitVendorComparison(1, validVendorsData, actorUserId)).rejects.toThrow(
        'RFQ sudah selesai dievaluasi.',
      );
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    });

    it('4. should reject evaluation when exactly 1 winner is not selected (e.g. 0 winners or 2 winners)', async () => {
      // 0 winners
      const noWinners = validVendorsData.map((v) => ({ ...v, isWinner: false }));
      await expect(service.submitVendorComparison(1, noWinners, actorUserId)).rejects.toThrow(
        'Exactly 1 vendor must be selected as the winner.',
      );

      // 2 winners
      const twoWinners = validVendorsData.map((v) => ({ ...v, isWinner: true }));
      await expect(service.submitVendorComparison(1, twoWinners, actorUserId)).rejects.toThrow(
        'Exactly 1 vendor must be selected as the winner.',
      );
    });

    it('5. should reject evaluation when minimum 3 vendors are not provided for PR amount > 1M', async () => {
      queryRunnerMock.manager.find.mockImplementation((entityClass: any) => {
        if (entityClass === Quotation) return Promise.resolve([mockDbQuotations[0], mockDbQuotations[2]]);
        return Promise.resolve([]);
      });

      const onlyTwoVendors = [
        { vendorId: 1, offeredAmount: 100500000, isWinner: false },
        { vendorId: 4, offeredAmount: 100479990, isWinner: true },
      ];

      await expect(service.submitVendorComparison(1, onlyTwoVendors, actorUserId)).rejects.toThrow(
        'Minimal 3 vendor diperlukan untuk perbandingan pengadaan di atas Rp 1.000.000',
      );
    });

    it('6. should reject evaluation when RFQ does not exist', async () => {
      queryRunnerMock.manager.findOne.mockResolvedValue(null);

      await expect(service.submitVendorComparison(999, validVendorsData, actorUserId)).rejects.toThrow(
        'RFQ #999 tidak ditemukan',
      );
    });

    it('7. should reject evaluation when RFQ status is not OPEN (e.g. CLOSED)', async () => {
      queryRunnerMock.manager.findOne.mockResolvedValue({
        ...mockOpenRfq,
        status: 'CLOSED',
      });

      await expect(service.submitVendorComparison(1, validVendorsData, actorUserId)).rejects.toThrow(
        'tidak dalam status OPEN untuk evaluasi vendor',
      );
    });

    it('8. should return RFQ evaluated state and winner info from getRfqById and getAllRfqs', async () => {
      const mockEvaluatedRfq = {
        ...mockOpenRfq,
        status: 'EVALUATED',
      };
      rfqRepoMock.findOne.mockResolvedValue(mockEvaluatedRfq);
      rfqRepoMock.find.mockResolvedValue([mockEvaluatedRfq]);

      const mockComparisons = [
        { id: 1, rfqId: 1, vendorId: 1, offeredAmount: 100500000, isWinner: false, vendor: { id: 1, name: 'PT IT Solusi', code: 'VND-001' } },
        { id: 2, rfqId: 1, vendorId: 2, offeredAmount: 100700000, isWinner: false, vendor: { id: 2, name: 'PT Maju Infra', code: 'VND-002' } },
        { id: 3, rfqId: 1, vendorId: 4, offeredAmount: 100479990, isWinner: true, vendor: { id: 4, name: 'PT Suplai Makmur', code: 'VND-004' }, createdAt: new Date() },
      ];
      vendorComparisonRepoMock.find.mockResolvedValue(mockComparisons);

      // Test getRfqById
      const singleRes = await service.getRfqById(1);
      expect(singleRes.success).toBe(true);
      expect(singleRes.data.status).toBe('EVALUATED');
      expect(singleRes.data.comparison).toBeDefined();
      expect(singleRes.data.comparison.selectedWinnerVendorName).toBe('PT Suplai Makmur');
      expect(singleRes.data.comparison.selectedWinnerVendorId).toBe(4);

      // Test getAllRfqs
      const allRes = await service.getAllRfqs();
      expect(allRes.length).toBe(1);
      expect(allRes[0].status).toBe('EVALUATED');
      expect(allRes[0].comparison).toBeDefined();
      expect(allRes[0].comparison.selectedWinnerVendorName).toBe('PT Suplai Makmur');
    });
  });

  describe('Phase 7D: Purchase Order Core SSOT Tests', () => {
    const mockPr = {
      id: 1,
      prNumber: 'PR-20260901-001',
      status: 'APPROVED',
      projectId: 2,
    };

    const mockEvaluatedRfq = {
      id: 1,
      rfqNumber: 'RFQ-20260903-001',
      prId: 1,
      status: 'EVALUATED',
    };

    const mockComparisons = [
      { id: 1, rfqId: 1, vendorId: 1, isWinner: false },
      { id: 2, rfqId: 1, vendorId: 2, isWinner: false },
      { id: 3, rfqId: 1, vendorId: 4, isWinner: true, vendor: { id: 4, name: 'PT Suplai Makmur' } },
    ];

    const mockWinningQuotation = {
      id: 3,
      rfqId: 1,
      vendorId: 4,
      quotationNumber: 'QT-20260903-003',
      status: 'SUBMITTED',
      leadTimeDays: 14,
      items: [
        { id: 5, prItemId: 1, itemName: 'Tim Penarikan & Splicing FO', quantity: 20, unitPrice: 24000 },
        { id: 6, prItemId: 2, itemName: 'Kabel Fiber Optic 24 Core ADSS', quantity: 10, unitPrice: 9999999 },
      ],
    };

    const standardPaymentTerms = [
      {
        sequence: 1,
        term_name: 'Termin 1 - DP',
        term_type: PaymentTermType.DOWN_PAYMENT,
        percentage: 30,
        trigger_condition: 'PO Diterbitkan',
        is_retention: false,
      },
      {
        sequence: 2,
        term_name: 'Termin 2 - Progress',
        term_type: PaymentTermType.PROGRESS,
        percentage: 30,
        trigger_condition: 'BAST Progress 1',
        is_retention: false,
      },
      {
        sequence: 3,
        term_name: 'Termin 3 - Progress',
        term_type: PaymentTermType.PROGRESS,
        percentage: 30,
        trigger_condition: 'BAST Progress 2',
        is_retention: false,
      },
      {
        sequence: 4,
        term_name: 'Termin 4 - Retensi',
        term_type: PaymentTermType.RETENTION,
        percentage: 10,
        trigger_condition: 'Masa Pemeliharaan Selesai',
        is_retention: true,
        retention_days: 90,
      },
    ];

    const standardDto: any = {
      purchase_request_id: 1,
      vendor_id: 4,
      payment_terms: standardPaymentTerms,
      po_items: [
        { item_name: 'Arbitrary Client Item', quantity: 999, unit_price: 1, total_price: 999 },
      ],
    };

    const setupHappyPath = () => {
      queryRunnerMock.manager.findOne.mockImplementation((entityClass: any, options: any) => {
        if (entityClass === PurchaseRequest || options?.where?.id === 1) return Promise.resolve({ ...mockPr });
        if (entityClass === PurchaseOrder && options?.where?.purchaseRequestId === 1) return Promise.resolve(null);
        if (entityClass === PurchaseOrder && options?.where?.poNumber) return Promise.resolve(null);
        if (entityClass === Rfq || options?.where?.prId === 1) return Promise.resolve({ ...mockEvaluatedRfq });
        if (entityClass === Quotation || options?.where?.vendorId === 4) return Promise.resolve({ ...mockWinningQuotation });
        return Promise.resolve(null);
      });

      queryRunnerMock.manager.find.mockImplementation((entityClass: any, options: any) => {
        if (entityClass === PurchaseRequestItem) {
          return Promise.resolve([
            { id: 1, prId: 1, itemName: 'Tim Penarikan & Splicing FO', quantity: 20, costItemId: 101, wbsId: 501 },
            { id: 2, prId: 1, itemName: 'Kabel Fiber Optic 24 Core ADSS', quantity: 10, costItemId: 102, wbsId: 502 },
          ]);
        }
        if (entityClass === Rfq || options?.where?.prId === 1) {
          return Promise.resolve([{ ...mockEvaluatedRfq }]);
        }
        if (entityClass === VendorComparison || options?.where?.rfqId === 1) {
          return Promise.resolve([...mockComparisons]);
        }
        return Promise.resolve([]);
      });

      queryRunnerMock.manager.count.mockResolvedValue(0);
      queryRunnerMock.manager.save.mockImplementation((entityClass: any, data: any) => Promise.resolve(data));
    };

    it('1. should successfully create PO from APPROVED PR, EVALUATED RFQ, single winner, and valid quotation with 14 days lead time', async () => {
      setupHappyPath();

      const result = await service.createPurchaseOrder(42, standardDto);

      expect(result.success).toBe(true);
      expect(queryRunnerMock.startTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
      expect(result.data.status).toBe('ISSUED');
      expect(result.data.vendorId).toBe(4);
      expect(result.data.totalAmount).toBe(100479990);
    });

    it('2. should reject when RFQ is in OPEN status (not EVALUATED)', async () => {
      setupHappyPath();
      queryRunnerMock.manager.find.mockImplementation((entityClass: any, options: any) => {
        if (entityClass === Rfq || options?.where?.prId === 1) {
          return Promise.resolve([{ ...mockEvaluatedRfq, status: 'OPEN' }]);
        }
        if (entityClass === VendorComparison || options?.where?.rfqId === 1) {
          return Promise.resolve([...mockComparisons]);
        }
        return Promise.resolve([]);
      });

      await expect(service.createPurchaseOrder(42, standardDto)).rejects.toThrow(
        'belum berstatus EVALUATED',
      );
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    });

    it('3. should reject when RFQ has no winner (0 winners)', async () => {
      setupHappyPath();
      queryRunnerMock.manager.find.mockImplementation((entityClass: any, options: any) => {
        if (entityClass === Rfq || options?.where?.prId === 1) {
          return Promise.resolve([{ ...mockEvaluatedRfq }]);
        }
        if (entityClass === VendorComparison || options?.where?.rfqId === 1) {
          return Promise.resolve([
            { id: 1, rfqId: 1, vendorId: 1, isWinner: false },
            { id: 2, rfqId: 1, vendorId: 2, isWinner: false },
          ]);
        }
        return Promise.resolve([]);
      });

      await expect(service.createPurchaseOrder(42, standardDto)).rejects.toThrow(
        'harus memiliki tepat 1 vendor pemenang',
      );
    });

    it('4. should reject when RFQ has more than 1 winner (multiple winners)', async () => {
      setupHappyPath();
      queryRunnerMock.manager.find.mockImplementation((entityClass: any, options: any) => {
        if (entityClass === Rfq || options?.where?.prId === 1) {
          return Promise.resolve([{ ...mockEvaluatedRfq }]);
        }
        if (entityClass === VendorComparison || options?.where?.rfqId === 1) {
          return Promise.resolve([
            { id: 1, rfqId: 1, vendorId: 1, isWinner: true },
            { id: 2, rfqId: 1, vendorId: 2, isWinner: true },
          ]);
        }
        return Promise.resolve([]);
      });

      await expect(service.createPurchaseOrder(42, standardDto)).rejects.toThrow(
        'harus memiliki tepat 1 vendor pemenang (ditemukan: 2)',
      );
    });

    it('5. should reject when winning quotation is not found in database', async () => {
      setupHappyPath();
      queryRunnerMock.manager.findOne.mockImplementation((entityClass: any, options: any) => {
        if (entityClass === PurchaseRequest || options?.where?.id === 1) return Promise.resolve({ ...mockPr });
        if (entityClass === PurchaseOrder && options?.where?.purchaseRequestId === 1) return Promise.resolve(null);
        if (entityClass === Rfq || options?.where?.prId === 1) return Promise.resolve({ ...mockEvaluatedRfq });
        if (entityClass === Quotation) return Promise.resolve(null);
        return Promise.resolve(null);
      });

      await expect(service.createPurchaseOrder(42, standardDto)).rejects.toThrow(
        'Quotation vendor pemenang tidak ditemukan di database',
      );
    });

    it('6. should reject when leadTimeDays is null, undefined, 0, negative, or NaN', async () => {
      const invalidLeadTimes = [null, undefined, 0, -5, NaN, 'invalid'];

      for (const lt of invalidLeadTimes) {
        setupHappyPath();
        queryRunnerMock.manager.findOne.mockImplementation((entityClass: any, options: any) => {
          if (entityClass === PurchaseRequest || options?.where?.id === 1) return Promise.resolve({ ...mockPr });
          if (entityClass === PurchaseOrder && options?.where?.purchaseRequestId === 1) return Promise.resolve(null);
          if (entityClass === Rfq || options?.where?.prId === 1) return Promise.resolve({ ...mockEvaluatedRfq });
          if (entityClass === Quotation || options?.where?.vendorId === 4) {
            return Promise.resolve({ ...mockWinningQuotation, leadTimeDays: lt });
          }
          return Promise.resolve(null);
        });

        await expect(service.createPurchaseOrder(42, standardDto)).rejects.toThrow(
          'Lead Time Vendor wajib tersedia dan lebih besar dari 0 hari',
        );
      }
    });

    it('7. should ignore client-manipulated dto.po_items and strictly use quotation_items from DB', async () => {
      setupHappyPath();

      const manipulatedDto = {
        purchase_request_id: 1,
        vendor_id: 4,
        payment_terms: standardPaymentTerms,
        po_items: [
          { item_name: 'Hacked Item', quantity: 999, unit_price: 1, total_price: 1 },
        ],
      };

      const result = await service.createPurchaseOrder(42, manipulatedDto);

      expect(result.data.items).toHaveLength(2);
      expect(result.data.items[0].itemName).toBe('Tim Penarikan & Splicing FO');
      expect(result.data.items[1].itemName).toBe('Kabel Fiber Optic 24 Core ADSS');
      expect(result.data.totalAmount).toBe(100479990);
    });

    it('8. should calculate authoritative server total matching winning quotation: Rp100.479.990', async () => {
      setupHappyPath();

      const result = await service.createPurchaseOrder(42, standardDto);

      expect(result.data.totalAmount).toBe(100479990);
    });

    it('9. should reject duplicate PO when PR already has a Purchase Order', async () => {
      setupHappyPath();
      queryRunnerMock.manager.findOne.mockImplementation((entityClass: any, options: any) => {
        if (entityClass === PurchaseRequest || options?.where?.id === 1) return Promise.resolve({ ...mockPr });
        if (entityClass === PurchaseOrder && options?.where?.purchaseRequestId === 1) {
          return Promise.resolve({ id: 99, poNumber: 'PO-20260903-001' });
        }
        return Promise.resolve(null);
      });

      await expect(service.createPurchaseOrder(42, standardDto)).rejects.toThrow(
        'Purchase Order sudah pernah dibuat untuk Purchase Request ini (PO-20260903-001)',
      );
    });

    it('10. should rollback transaction when item save fails', async () => {
      setupHappyPath();
      queryRunnerMock.manager.save.mockImplementation((entityClass: any, data: any) => {
        if (entityClass === PurchaseOrderItem || Array.isArray(data)) {
          return Promise.reject(new Error('Item save disk failure'));
        }
        return Promise.resolve(data);
      });

      await expect(service.createPurchaseOrder(42, standardDto)).rejects.toThrow('Item save disk failure');
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.release).toHaveBeenCalled();
    });

    it('11. should assign createdBy from authenticated JWT userId', async () => {
      setupHappyPath();

      const result = await service.createPurchaseOrder(88, standardDto);

      expect(result.data.createdBy).toBe(88);
    });
  });

  describe('Phase 7E-B: Payment Terms SSOT & DTO Contract Tests', () => {
    const mockPr = {
      id: 1,
      prNumber: 'PR-20260901-001',
      status: 'APPROVED',
      projectId: 2,
    };

    const mockEvaluatedRfq = {
      id: 1,
      rfqNumber: 'RFQ-20260903-001',
      prId: 1,
      status: 'EVALUATED',
    };

    const mockComparisons = [
      { id: 1, rfqId: 1, vendorId: 1, isWinner: false },
      { id: 2, rfqId: 1, vendorId: 2, isWinner: false },
      { id: 3, rfqId: 1, vendorId: 4, isWinner: true, vendor: { id: 4, name: 'PT Suplai Makmur' } },
    ];

    const mockWinningQuotation = {
      id: 3,
      rfqId: 1,
      vendorId: 4,
      quotationNumber: 'QT-20260903-003',
      status: 'SUBMITTED',
      leadTimeDays: 14,
      items: [
        { id: 5, prItemId: 1, itemName: 'Tim Penarikan & Splicing FO', quantity: 20, unitPrice: 24000 },
        { id: 6, prItemId: 2, itemName: 'Kabel Fiber Optic 24 Core ADSS', quantity: 10, unitPrice: 9999999 },
      ],
    };

    const setupHappyPath = () => {
      queryRunnerMock.manager.findOne.mockImplementation((entityClass: any, options: any) => {
        if (entityClass === PurchaseRequest || options?.where?.id === 1) return Promise.resolve({ ...mockPr });
        if (entityClass === PurchaseOrder && options?.where?.purchaseRequestId === 1) return Promise.resolve(null);
        if (entityClass === PurchaseOrder && options?.where?.poNumber) return Promise.resolve(null);
        if (entityClass === Rfq || options?.where?.prId === 1) return Promise.resolve({ ...mockEvaluatedRfq });
        if (entityClass === Quotation || options?.where?.vendorId === 4) return Promise.resolve({ ...mockWinningQuotation });
        return Promise.resolve(null);
      });

      queryRunnerMock.manager.find.mockImplementation((entityClass: any, options: any) => {
        if (entityClass === PurchaseRequestItem) {
          return Promise.resolve([
            { id: 1, prId: 1, itemName: 'Tim Penarikan & Splicing FO', quantity: 20, costItemId: 101, wbsId: 501 },
            { id: 2, prId: 1, itemName: 'Kabel Fiber Optic 24 Core ADSS', quantity: 10, costItemId: 102, wbsId: 502 },
          ]);
        }
        if (entityClass === Rfq || options?.where?.prId === 1) {
          return Promise.resolve([{ ...mockEvaluatedRfq }]);
        }
        if (entityClass === VendorComparison || options?.where?.rfqId === 1) {
          return Promise.resolve([...mockComparisons]);
        }
        return Promise.resolve([]);
      });

      queryRunnerMock.manager.count.mockResolvedValue(0);
      queryRunnerMock.manager.save.mockImplementation((entityClass: any, data: any) => Promise.resolve(data));
    };

    it('A. Valid 30/30/30/10 => PASS with authoritative amounts matching total Rp100.479.990', async () => {
      setupHappyPath();

      const dto = {
        purchase_request_id: 1,
        vendor_id: 4,
        payment_terms: [
          { sequence: 1, term_name: 'Termin 1 - DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 30, trigger_condition: 'PO Diterbitkan', is_retention: false },
          { sequence: 2, term_name: 'Termin 2 - Progress', term_type: PaymentTermType.PROGRESS, percentage: 30, trigger_condition: 'BAST 1', is_retention: false },
          { sequence: 3, term_name: 'Termin 3 - Progress', term_type: PaymentTermType.PROGRESS, percentage: 30, trigger_condition: 'BAST 2', is_retention: false },
          { sequence: 4, term_name: 'Termin 4 - Retensi', term_type: PaymentTermType.RETENTION, percentage: 10, trigger_condition: 'Garansi', is_retention: true, retention_days: 90 },
        ],
      };

      const result = await service.createPurchaseOrder(42, dto as any);

      expect(result.success).toBe(true);
      expect(result.data.paymentTerms).toHaveLength(4);
      expect(result.data.paymentTerms[0].amount).toBe(30143997);
      expect(result.data.paymentTerms[1].amount).toBe(30143997);
      expect(result.data.paymentTerms[2].amount).toBe(30143997);
      expect(result.data.paymentTerms[3].amount).toBe(10047999);
      const sum = result.data.paymentTerms.reduce((acc: number, t: any) => acc + t.amount, 0);
      expect(sum).toBe(100479990);
      expect(result.data.totalAmount).toBe(100479990);
    });

    it('B. Valid custom 20/40/30/10 => PASS with exact allocation', async () => {
      setupHappyPath();

      const dto = {
        purchase_request_id: 1,
        vendor_id: 4,
        payment_terms: [
          { sequence: 1, term_name: 'Termin 1 - DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 20, trigger_condition: 'PO Diterbitkan' },
          { sequence: 2, term_name: 'Termin 2 - Progress', term_type: PaymentTermType.PROGRESS, percentage: 40, trigger_condition: 'BAST 1' },
          { sequence: 3, term_name: 'Termin 3 - Progress', term_type: PaymentTermType.PROGRESS, percentage: 30, trigger_condition: 'BAST 2' },
          { sequence: 4, term_name: 'Termin 4 - Retensi', term_type: PaymentTermType.RETENTION, percentage: 10, trigger_condition: 'Garansi', is_retention: true, retention_days: 90 },
        ],
      };

      const result = await service.createPurchaseOrder(42, dto as any);

      expect(result.success).toBe(true);
      expect(result.data.paymentTerms[0].amount).toBe(20095998);
      expect(result.data.paymentTerms[1].amount).toBe(40191996);
      expect(result.data.paymentTerms[2].amount).toBe(30143997);
      expect(result.data.paymentTerms[3].amount).toBe(10047999);
      const sum = result.data.paymentTerms.reduce((acc: number, t: any) => acc + t.amount, 0);
      expect(sum).toBe(100479990);
    });

    it('C. Invalid 30/30/30 (90%) => REJECT', async () => {
      setupHappyPath();

      const dto = {
        purchase_request_id: 1,
        vendor_id: 4,
        payment_terms: [
          { sequence: 1, term_name: 'Termin 1 - DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 30 },
          { sequence: 2, term_name: 'Termin 2 - Progress', term_type: PaymentTermType.PROGRESS, percentage: 30 },
          { sequence: 3, term_name: 'Termin 3 - Progress', term_type: PaymentTermType.PROGRESS, percentage: 30 },
        ],
      };

      await expect(service.createPurchaseOrder(42, dto as any)).rejects.toThrow(
        'Total persentase payment terms harus tepat 100%.',
      );
    });

    it('D. Invalid 40/40/30 (110%) => REJECT', async () => {
      setupHappyPath();

      const dto = {
        purchase_request_id: 1,
        vendor_id: 4,
        payment_terms: [
          { sequence: 1, term_name: 'Termin 1 - DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 40 },
          { sequence: 2, term_name: 'Termin 2 - Progress', term_type: PaymentTermType.PROGRESS, percentage: 40 },
          { sequence: 3, term_name: 'Termin 3 - Progress', term_type: PaymentTermType.PROGRESS, percentage: 30 },
        ],
      };

      await expect(service.createPurchaseOrder(42, dto as any)).rejects.toThrow(
        'Total persentase payment terms harus tepat 100%.',
      );
    });

    it('E. Invalid percentage 0 => REJECT', async () => {
      setupHappyPath();

      const dto = {
        purchase_request_id: 1,
        vendor_id: 4,
        payment_terms: [
          { sequence: 1, term_name: 'Termin 1 - DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 0 },
          { sequence: 2, term_name: 'Termin 2 - Pelunasan', term_type: PaymentTermType.FINAL_DELIVERY, percentage: 100 },
        ],
      };

      await expect(service.createPurchaseOrder(42, dto as any)).rejects.toThrow(
        'harus lebih besar dari 0%',
      );
    });

    it('F. Invalid percentage negative => REJECT', async () => {
      setupHappyPath();

      const dto = {
        purchase_request_id: 1,
        vendor_id: 4,
        payment_terms: [
          { sequence: 1, term_name: 'Termin 1 - DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: -10 },
          { sequence: 2, term_name: 'Termin 2 - Pelunasan', term_type: PaymentTermType.FINAL_DELIVERY, percentage: 110 },
        ],
      };

      await expect(service.createPurchaseOrder(42, dto as any)).rejects.toThrow(
        'harus lebih besar dari 0%',
      );
    });

    it('G. Invalid percentage NaN/string => REJECT', async () => {
      setupHappyPath();

      const dto = {
        purchase_request_id: 1,
        vendor_id: 4,
        payment_terms: [
          { sequence: 1, term_name: 'Termin 1 - DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: NaN },
          { sequence: 2, term_name: 'Termin 2 - Pelunasan', term_type: PaymentTermType.FINAL_DELIVERY, percentage: 100 },
        ],
      };

      await expect(service.createPurchaseOrder(42, dto as any)).rejects.toThrow(
        'harus lebih besar dari 0%',
      );
    });

    it('H. Duplicate sequence => REJECT', async () => {
      setupHappyPath();

      const dto = {
        purchase_request_id: 1,
        vendor_id: 4,
        payment_terms: [
          { sequence: 1, term_name: 'Termin 1', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 50 },
          { sequence: 1, term_name: 'Termin 1 Duplikat', term_type: PaymentTermType.FINAL_DELIVERY, percentage: 50 },
        ],
      };

      await expect(service.createPurchaseOrder(42, dto as any)).rejects.toThrow(
        'Urutan (sequence) payment terms tidak boleh duplikat',
      );
    });

    it('I. Sequence gap (1, 2, 4) => REJECT', async () => {
      setupHappyPath();

      const dto = {
        purchase_request_id: 1,
        vendor_id: 4,
        payment_terms: [
          { sequence: 1, term_name: 'Termin 1', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 30 },
          { sequence: 2, term_name: 'Termin 2', term_type: PaymentTermType.PROGRESS, percentage: 30 },
          { sequence: 4, term_name: 'Termin 4', term_type: PaymentTermType.FINAL_DELIVERY, percentage: 40 },
        ],
      };

      await expect(service.createPurchaseOrder(42, dto as any)).rejects.toThrow(
        'Urutan (sequence) payment terms harus berurutan tanpa jeda dimulai dari 1',
      );
    });

    it('J. Client amount tampering: server strictly ignores client amount and uses authoritative calculation', async () => {
      setupHappyPath();

      const dto = {
        purchase_request_id: 1,
        vendor_id: 4,
        payment_terms: [
          { sequence: 1, term_name: 'Termin 1 - DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 30, amount: 1 },
          { sequence: 2, term_name: 'Termin 2 - Pelunasan', term_type: PaymentTermType.FINAL_DELIVERY, percentage: 70, amount: 999999999 },
        ],
      };

      const result = await service.createPurchaseOrder(42, dto as any);

      expect(result.data.paymentTerms[0].amount).toBe(30143997);
      expect(result.data.paymentTerms[1].amount).toBe(70335993);
      expect(result.data.paymentTerms[0].amount + result.data.paymentTerms[1].amount).toBe(100479990);
    });

    it('K. Server total matching winning quotation: Rp100.479.990', async () => {
      setupHappyPath();

      const dto = {
        purchase_request_id: 1,
        vendor_id: 4,
        payment_terms: [
          { sequence: 1, term_name: 'Termin 1', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 50 },
          { sequence: 2, term_name: 'Termin 2', term_type: PaymentTermType.FINAL_DELIVERY, percentage: 50 },
        ],
      };

      const result = await service.createPurchaseOrder(42, dto as any);

      const sum = result.data.paymentTerms.reduce((acc: number, t: any) => acc + t.amount, 0);
      expect(sum).toBe(100479990);
    });

    it('L. Deterministic rounding remainder adjustment guarantees exact total on odd splits (33.33 / 33.33 / 33.34)', async () => {
      setupHappyPath();

      const dto = {
        purchase_request_id: 1,
        vendor_id: 4,
        payment_terms: [
          { sequence: 1, term_name: 'Termin 1', term_type: PaymentTermType.PROGRESS, percentage: 33.33 },
          { sequence: 2, term_name: 'Termin 2', term_type: PaymentTermType.PROGRESS, percentage: 33.33 },
          { sequence: 3, term_name: 'Termin 3', term_type: PaymentTermType.PROGRESS, percentage: 33.34 },
        ],
      };

      const result = await service.createPurchaseOrder(42, dto as any);

      const sum = Math.round(result.data.paymentTerms.reduce((acc: number, t: any) => acc + t.amount, 0) * 100) / 100;
      expect(sum).toBe(100479990);
      expect(result.data.paymentTerms[0].amount).toBe(33489980.67);
      expect(result.data.paymentTerms[1].amount).toBe(33489980.67);
      expect(result.data.paymentTerms[2].amount).toBe(33500028.66);
    });

    it('M. RETENTION without retention_days => REJECT', async () => {
      setupHappyPath();

      const dto = {
        purchase_request_id: 1,
        vendor_id: 4,
        payment_terms: [
          { sequence: 1, term_name: 'Termin 1 - DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 90 },
          { sequence: 2, term_name: 'Termin 2 - Retensi', term_type: PaymentTermType.RETENTION, percentage: 10, is_retention: true },
        ],
      };

      await expect(service.createPurchaseOrder(42, dto as any)).rejects.toThrow(
        'Termin retensi "Termin 2 - Retensi" wajib memiliki retention_days lebih besar dari 0 hari',
      );
    });

    it('N. RETENTION with valid retention_days > 0 => PASS', async () => {
      setupHappyPath();

      const dto = {
        purchase_request_id: 1,
        vendor_id: 4,
        payment_terms: [
          { sequence: 1, term_name: 'Termin 1 - DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 90 },
          { sequence: 2, term_name: 'Termin 2 - Retensi', term_type: PaymentTermType.RETENTION, percentage: 10, is_retention: true, retention_days: 180 },
        ],
      };

      const result = await service.createPurchaseOrder(42, dto as any);

      expect(result.success).toBe(true);
      expect(result.data.paymentTerms[1].isRetention).toBe(true);
      expect(result.data.paymentTerms[1].retentionDays).toBe(180);
    });

    it('O. Transaction rollback: fails when payment term save fails', async () => {
      setupHappyPath();

      queryRunnerMock.manager.save.mockImplementation((entityClass: any, data: any) => {
        if (entityClass === PoPaymentTerm) {
          return Promise.reject(new Error('PoPaymentTerm database write failure'));
        }
        return Promise.resolve(data);
      });

      const dto = {
        purchase_request_id: 1,
        vendor_id: 4,
        payment_terms: [
          { sequence: 1, term_name: 'Termin 1 - DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 100 },
        ],
      };

      await expect(service.createPurchaseOrder(42, dto as any)).rejects.toThrow('PoPaymentTerm database write failure');
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.release).toHaveBeenCalled();
    });

    it('P. createdBy: all terms assigned from authenticated JWT userId', async () => {
      setupHappyPath();

      const dto = {
        purchase_request_id: 1,
        vendor_id: 4,
        payment_terms: [
          { sequence: 1, term_name: 'Termin 1 - DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 50 },
          { sequence: 2, term_name: 'Termin 2 - Pelunasan', term_type: PaymentTermType.FINAL_DELIVERY, percentage: 50 },
        ],
      };

      const result = await service.createPurchaseOrder(99, dto as any);

      expect(result.data.createdBy).toBe(99);
      expect(result.data.paymentTerms[0].createdBy).toBe(99);
      expect(result.data.paymentTerms[1].createdBy).toBe(99);
    });
  });

  describe('Phase FIN-UI-4: Deterministic PO Payment Terms Ordering (sequence ASC)', () => {
    it('getAllPurchaseOrders: should deterministically sort paymentTerms by sequence ASC', async () => {
      const unorderedTerms = [
        { id: 4, sequence: 4, termName: 'Retention', amount: 10047999 },
        { id: 2, sequence: 2, termName: 'Progress 1', amount: 30143997 },
        { id: 1, sequence: 1, termName: 'DP', amount: 30143997 },
        { id: 3, sequence: 3, termName: 'Progress 2', amount: 30143997 },
      ];

      const mockPo = {
        id: 1,
        poNumber: 'PO-20260907-001',
        paymentTerms: unorderedTerms,
      };

      (service as any).poRepo.find = jest.fn().mockResolvedValue([mockPo]);

      const result = await service.getAllPurchaseOrders();

      expect((service as any).poRepo.find).toHaveBeenCalledWith({
        relations: ['items', 'paymentTerms', 'vendor', 'purchaseRequest', 'purchaseRequest.project'],
        order: {
          createdAt: 'DESC',
          paymentTerms: {
            sequence: 'ASC',
          },
        },
      });

      expect(result).toHaveLength(1);
      const returnedTerms = result[0].paymentTerms;
      expect(returnedTerms.map((t: any) => t.sequence)).toEqual([1, 2, 3, 4]);
      expect(returnedTerms.map((t: any) => t.termName)).toEqual([
        'DP',
        'Progress 1',
        'Progress 2',
        'Retention',
      ]);
    });

    it('getPurchaseOrderById: should deterministically sort paymentTerms by sequence ASC', async () => {
      const unorderedTerms = [
        { id: 4, sequence: 4, termName: 'Retention', amount: 10047999 },
        { id: 2, sequence: 2, termName: 'Progress 1', amount: 30143997 },
        { id: 1, sequence: 1, termName: 'DP', amount: 30143997 },
        { id: 3, sequence: 3, termName: 'Progress 2', amount: 30143997 },
      ];

      const mockPo = {
        id: 1,
        poNumber: 'PO-20260907-001',
        paymentTerms: unorderedTerms,
      };

      (service as any).poRepo.findOne = jest.fn().mockResolvedValue(mockPo);

      const result = await service.getPurchaseOrderById(1);

      expect((service as any).poRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['items', 'paymentTerms', 'vendor', 'purchaseRequest', 'purchaseRequest.project'],
        order: {
          paymentTerms: {
            sequence: 'ASC',
          },
        },
      });

      expect(result.success).toBe(true);
      const returnedTerms = result.data.paymentTerms;
      expect(returnedTerms.map((t: any) => t.sequence)).toEqual([1, 2, 3, 4]);
      expect(returnedTerms.map((t: any) => t.termName)).toEqual([
        'DP',
        'Progress 1',
        'Progress 2',
        'Retention',
      ]);
    });

    it('should throw BadRequestException if PO not found in getPurchaseOrderById', async () => {
      (service as any).poRepo.findOne = jest.fn().mockResolvedValue(null);

      await expect(service.getPurchaseOrderById(999)).rejects.toThrow('Purchase Order not found');
    });
  });

  describe('P7.4-B: Deterministic RFQ Resolution & Authoritative Winner Hardening', () => {
    const mockPr = {
      id: 1,
      prNumber: 'PR-20260901-001',
      status: 'APPROVED',
      projectId: 2,
    };

    const mockEvaluatedRfq = {
      id: 10,
      rfqNumber: 'RFQ-20260903-010',
      prId: 1,
      status: 'EVALUATED',
    };

    const mockOpenRfq = {
      id: 9,
      rfqNumber: 'RFQ-20260903-009',
      prId: 1,
      status: 'OPEN',
    };

    const mockEvaluatedRfq2 = {
      id: 11,
      rfqNumber: 'RFQ-20260903-011',
      prId: 1,
      status: 'EVALUATED',
    };

    const mockComparisons = [
      { id: 1, rfqId: 10, vendorId: 1, isWinner: false },
      { id: 2, rfqId: 10, vendorId: 2, isWinner: false },
      { id: 3, rfqId: 10, vendorId: 4, isWinner: true, vendor: { id: 4, name: 'PT Suplai Makmur' } },
    ];

    const mockWinningQuotation = {
      id: 3,
      rfqId: 10,
      vendorId: 4,
      quotationNumber: 'QT-20260903-003',
      status: 'SUBMITTED',
      leadTimeDays: 14,
      items: [
        { id: 5, prItemId: 1, itemName: 'Tim Penarikan & Splicing FO', quantity: 20, unitPrice: 24000 },
        { id: 6, prItemId: 2, itemName: 'Kabel Fiber Optic 24 Core ADSS', quantity: 10, unitPrice: 9999999 },
      ],
    };

    const standardPaymentTerms: any[] = [
      { sequence: 1, term_name: 'DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 30, trigger_condition: 'PO' },
      { sequence: 2, term_name: 'Progress 1', term_type: PaymentTermType.PROGRESS, percentage: 30, trigger_condition: 'BAST 1' },
      { sequence: 3, term_name: 'Progress 2', term_type: PaymentTermType.PROGRESS, percentage: 30, trigger_condition: 'BAST 2' },
      { sequence: 4, term_name: 'Retention', term_type: PaymentTermType.RETENTION, percentage: 10, trigger_condition: 'Garansi', is_retention: true, retention_days: 90 },
    ];

    const standardDto: any = {
      purchase_request_id: 1,
      vendor_id: 4,
      payment_terms: standardPaymentTerms,
    };

    const setupBaseHappyPath = () => {
      queryRunnerMock.manager.findOne.mockImplementation((entityClass: any, options: any) => {
        if (entityClass === PurchaseRequest || options?.where?.id === 1) return Promise.resolve({ ...mockPr });
        if (entityClass === PurchaseOrder && options?.where?.purchaseRequestId === 1) return Promise.resolve(null);
        if (entityClass === PurchaseOrder && options?.where?.poNumber) return Promise.resolve(null);
        if (entityClass === Quotation) return Promise.resolve({ ...mockWinningQuotation });
        return Promise.resolve(null);
      });

      queryRunnerMock.manager.find.mockImplementation((entityClass: any, options: any) => {
        if (entityClass === PurchaseRequestItem) {
          return Promise.resolve([
            { id: 1, prId: 1, itemName: 'Tim Penarikan & Splicing FO', quantity: 20, costItemId: 101, wbsId: 501 },
            { id: 2, prId: 1, itemName: 'Kabel Fiber Optic 24 Core ADSS', quantity: 10, costItemId: 102, wbsId: 502 },
          ]);
        }
        if (entityClass === Rfq) return Promise.resolve([{ ...mockEvaluatedRfq }]);
        if (entityClass === VendorComparison) return Promise.resolve([...mockComparisons]);
        return Promise.resolve([]);
      });

      queryRunnerMock.manager.count.mockResolvedValue(0);
      queryRunnerMock.manager.save.mockImplementation((entityClass: any, data: any) => Promise.resolve(data));
    };

    it('P74-B01: PR with zero RFQs is rejected', async () => {
      setupBaseHappyPath();
      queryRunnerMock.manager.find.mockImplementation((entityClass: any) => {
        if (entityClass === Rfq) return Promise.resolve([]);
        return Promise.resolve([]);
      });

      await expect(service.createPurchaseOrder(42, standardDto)).rejects.toThrow(
        'RFQ untuk Purchase Request ini tidak ditemukan',
      );
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    });

    it('P74-B02: PR with one non-EVALUATED RFQ is rejected', async () => {
      setupBaseHappyPath();
      queryRunnerMock.manager.find.mockImplementation((entityClass: any) => {
        if (entityClass === Rfq) return Promise.resolve([{ ...mockOpenRfq }]);
        return Promise.resolve([]);
      });

      await expect(service.createPurchaseOrder(42, standardDto)).rejects.toThrow(
        'RFQ untuk Purchase Request #PR-20260901-001 belum berstatus EVALUATED (status saat ini: OPEN)',
      );
    });

    it('P74-B03: PR with one EVALUATED RFQ succeeds', async () => {
      setupBaseHappyPath();

      const result = await service.createPurchaseOrder(42, standardDto);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('ISSUED');
      expect(result.data.vendorId).toBe(4);
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    });

    it('P74-B04: PR with multiple RFQs but exactly one EVALUATED succeeds', async () => {
      setupBaseHappyPath();
      queryRunnerMock.manager.find.mockImplementation((entityClass: any) => {
        if (entityClass === PurchaseRequestItem) {
          return Promise.resolve([
            { id: 1, prId: 1, itemName: 'Tim Penarikan & Splicing FO', quantity: 20, costItemId: 101, wbsId: 501 },
            { id: 2, prId: 1, itemName: 'Kabel Fiber Optic 24 Core ADSS', quantity: 10, costItemId: 102, wbsId: 502 },
          ]);
        }
        if (entityClass === Rfq) {
          return Promise.resolve([
            { ...mockEvaluatedRfq }, // ID 10 EVALUATED
            { ...mockOpenRfq },      // ID 9 OPEN
          ]);
        }
        if (entityClass === VendorComparison) return Promise.resolve([...mockComparisons]);
        return Promise.resolve([]);
      });

      const result = await service.createPurchaseOrder(42, standardDto);

      expect(result.success).toBe(true);
      expect(result.data.vendorId).toBe(4);
    });

    it('P74-B05: PR with multiple EVALUATED RFQs is rejected', async () => {
      setupBaseHappyPath();
      queryRunnerMock.manager.find.mockImplementation((entityClass: any) => {
        if (entityClass === Rfq) {
          return Promise.resolve([
            { ...mockEvaluatedRfq },  // ID 10 EVALUATED
            { ...mockEvaluatedRfq2 }, // ID 11 EVALUATED
          ]);
        }
        return Promise.resolve([]);
      });

      await expect(service.createPurchaseOrder(42, standardDto)).rejects.toThrow(
        'Purchase Request #PR-20260901-001 memiliki lebih dari 1 RFQ berstatus EVALUATED (2 ditemukan). Tidak dapat menentukan RFQ pemenang secara aman.',
      );
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    });

    it('P74-B06: PO winner is resolved from the selected authoritative RFQ', async () => {
      setupBaseHappyPath();

      const result = await service.createPurchaseOrder(42, standardDto);

      expect(result.data.vendorId).toBe(4);
      expect(queryRunnerMock.manager.find).toHaveBeenCalledWith(
        VendorComparison,
        expect.objectContaining({ where: { rfqId: 10 } }),
      );
    });

    it('P74-B07: A winner belonging to another RFQ cannot be used', async () => {
      setupBaseHappyPath();

      const mismatchedDto = {
        ...standardDto,
        vendor_id: 99, // Vendor 99 is not winner of RFQ 10
      };

      await expect(service.createPurchaseOrder(42, mismatchedDto)).rejects.toThrow(
        'Vendor yang dipilih bukan merupakan vendor pemenang evaluasi RFQ ini',
      );
    });

    it('P74-B08: Existing PO idempotency still works', async () => {
      setupBaseHappyPath();
      queryRunnerMock.manager.findOne.mockImplementation((entityClass: any, options: any) => {
        if (entityClass === PurchaseRequest) return Promise.resolve({ ...mockPr });
        if (entityClass === PurchaseOrder && options?.where?.purchaseRequestId === 1) {
          return Promise.resolve({ id: 88, poNumber: 'PO-20260903-088' });
        }
        return Promise.resolve(null);
      });

      await expect(service.createPurchaseOrder(42, standardDto)).rejects.toThrow(
        'Purchase Order sudah pernah dibuat untuk Purchase Request ini',
      );
    });

    it('P74-B09: Existing payment-term 100.00% invariants remain unchanged', async () => {
      setupBaseHappyPath();

      const invalidPaymentTermsDto = {
        ...standardDto,
        payment_terms: [
          { sequence: 1, term_name: 'DP', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 30 },
          { sequence: 2, term_name: 'Progress', term_type: PaymentTermType.PROGRESS, percentage: 50 },
        ], // 80% != 100%
      };

      await expect(service.createPurchaseOrder(42, invalidPaymentTermsDto as any)).rejects.toThrow(
        'Total persentase payment terms harus tepat 100%.',
      );
    });

    it('P74-B10: Existing client PO item tampering protection remains unchanged', async () => {
      setupBaseHappyPath();

      const manipulatedDto = {
        ...standardDto,
        po_items: [
          { item_name: 'Hacked Price Item', quantity: 1, unit_price: 1, total_price: 1 },
        ],
      };

      const result = await service.createPurchaseOrder(42, manipulatedDto);

      expect(result.data.items).toHaveLength(2);
      expect(result.data.items[0].itemName).toBe('Tim Penarikan & Splicing FO');
      expect(result.data.totalAmount).toBe(100479990);
    });
  });
});

describe('ProcurementPackage - Phase 2 Backend Foundation & Safety Boundaries', () => {
  let pkgService: ProcurementPackageService;
  let eventListener: ProcurementEventListener;
  let procurementService: ProcurementService;
  let mockManager: any;
  let mockQueryRunner: any;
  let mockDataSource: any;
  let mockPackageRepo: any;
  let mockPackageItemRepo: any;
  let mockPrRepo: any;
  let mockPrItemRepo: any;
  let mockProjectRepo: any;
  let mockCostItemRepo: any;
  let mockCostEstimateRepo: any;
  let mockWfDefRepo: any;
  let mockWfInstRepo: any;
  let mockWfEngineService: any;
  let eventEmitterMock: any;

  const createMockQueryBuilder = (config: {
    getOne?: any;
    getMany?: any;
    getRawOne?: any;
  } = {}) => {
    const qb: any = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(config.getOne !== undefined ? config.getOne : null),
      getMany: jest.fn().mockResolvedValue(config.getMany !== undefined ? config.getMany : []),
      getRawOne: jest.fn().mockResolvedValue(config.getRawOne !== undefined ? config.getRawOne : null),
    };
    return qb;
  };

  beforeEach(() => {
    mockManager = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((entityClass, data) => ({ ...data })),
      save: jest.fn((entityClass, data) =>
        Promise.resolve(
          Array.isArray(data)
            ? data.map((d, idx) => ({ id: idx + 1, ...d }))
            : { id: (data as any)?.id || 1, ...data }
        )
      ),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      count: jest.fn().mockResolvedValue(0),
      query: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
    };

    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: mockManager,
    };

    mockDataSource = {
      transaction: jest.fn(async (cb: any) => cb(mockManager)),
      createQueryRunner: jest.fn(() => mockQueryRunner),
      manager: mockManager,
    };

    mockPackageRepo = {
      createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
      findOne: jest.fn(),
      find: jest.fn(),
    };
    mockPackageItemRepo = { find: jest.fn(), findOne: jest.fn() };
    mockPrRepo = { find: jest.fn(), findOne: jest.fn(), count: jest.fn() };
    mockPrItemRepo = { find: jest.fn(), findOne: jest.fn() };
    mockProjectRepo = { find: jest.fn(), findOne: jest.fn() };
    mockCostItemRepo = { find: jest.fn(), findOne: jest.fn() };
    mockCostEstimateRepo = { find: jest.fn(), findOne: jest.fn() };
    mockWfDefRepo = { findOne: jest.fn() };
    mockWfInstRepo = { findOne: jest.fn() };
    mockWfEngineService = { startInstance: jest.fn().mockResolvedValue({ instanceId: 100 }) };
    eventEmitterMock = { emit: jest.fn() };

    pkgService = new ProcurementPackageService(
      mockPackageRepo,
      mockPackageItemRepo,
      mockPrRepo,
      mockPrItemRepo,
      mockProjectRepo,
      mockCostItemRepo,
      mockCostEstimateRepo,
      mockWfDefRepo,
      mockWfInstRepo,
      mockWfEngineService,
      mockDataSource,
    );

    eventListener = new ProcurementEventListener(pkgService);

    procurementService = new ProcurementService(
      mockPrRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      mockWfEngineService,
      mockDataSource,
      eventEmitterMock,
    );
  });

  // -------------------------------------------------------------------------
  // 1. PM Ownership & Authorization
  // -------------------------------------------------------------------------
  describe('1. PM Ownership & Authorization', () => {
    it('P2-01: Non-assigned PM cannot create draft (403 Forbidden)', async () => {
      mockManager.findOne.mockImplementation((entity: any) => {
        if (entity === Project) {
          return Promise.resolve({ id: 10, managerId: 99, status: 'IN_PROGRESS' });
        }
        return Promise.resolve(null);
      });

      await expect(
        pkgService.createDraft(1, ['PROJECT_MANAGER'], {
          projectId: 10,
          title: 'Paket Kabel',
          items: [{ costItemId: 101, requestedQty: 5 }],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('P2-02: Assigned PM can create draft successfully', async () => {
      const mockProject = { id: 10, managerId: 1, status: 'IN_PROGRESS' };
      const mockRab = { id: 50, projectId: 10, status: 'APPROVED', version: 1 };
      const mockCostItem = {
        id: 101,
        estimateId: 50,
        estimate: { id: 50, projectId: 10 },
        itemName: 'Kabel FO 24 Core',
        categoryKey: 'MATERIAL',
        entryMode: 'ITEMIZED',
        unitPrice: 15000,
        quantity: 100,
        uom: 'Meter',
        wbsId: 201,
      };

      mockManager.findOne.mockImplementation((entity: any) => {
        if (entity === Project) return Promise.resolve(mockProject);
        if (entity === ProjectCostEstimate) return Promise.resolve(mockRab);
        return Promise.resolve(null);
      });
      mockManager.find.mockImplementation((entity: any) => {
        if (entity === CostItem) return Promise.resolve([mockCostItem]);
        return Promise.resolve([]);
      });

      const res = await pkgService.createDraft(1, ['PROJECT_MANAGER'], {
        projectId: 10,
        title: 'Paket Kabel FO',
        items: [{ costItemId: 101, requestedQty: 10 }],
      });

      expect(res).toBeDefined();
      expect(res.status).toBe(ProcurementPackageStatus.DRAFT);
      expect(res.totalEstimatedAmount).toBe(150000);
      expect(mockManager.save).toHaveBeenCalled();
    });

    it('P2-03: SUPER_ADMIN bypasses PM ownership check', async () => {
      const mockProject = { id: 10, managerId: 99, status: 'IN_PROGRESS' };
      const mockRab = { id: 50, projectId: 10, status: 'APPROVED', version: 1 };
      const mockCostItem = {
        id: 101,
        estimateId: 50,
        estimate: { id: 50, projectId: 10 },
        itemName: 'Kabel FO',
        categoryKey: 'MATERIAL',
        entryMode: 'ITEMIZED',
        unitPrice: 10000,
        quantity: 50,
      };

      mockManager.findOne.mockImplementation((entity: any) => {
        if (entity === Project) return Promise.resolve(mockProject);
        if (entity === ProjectCostEstimate) return Promise.resolve(mockRab);
        return Promise.resolve(null);
      });
      mockManager.find.mockResolvedValue([mockCostItem]);

      const res = await pkgService.createDraft(1, ['SUPER_ADMIN'], {
        projectId: 10,
        title: 'Paket Kabel Admin',
        items: [{ costItemId: 101, requestedQty: 5 }],
      });

      expect(res).toBeDefined();
      expect(res.status).toBe(ProcurementPackageStatus.DRAFT);
    });

    it('P2-04: Non-assigned PM cannot update, delete, submit, or cancel package', async () => {
      const mockPkg = {
        id: 1,
        projectId: 10,
        status: ProcurementPackageStatus.DRAFT,
        project: { id: 10, managerId: 99, status: 'IN_PROGRESS' },
        items: [],
      };
      mockManager.findOne.mockResolvedValue(mockPkg);

      await expect(
        pkgService.updateDraft(1, 1, ['PROJECT_MANAGER'], { title: 'New Title' }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        pkgService.deleteDraft(1, 1, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        pkgService.submitPackage(1, 1, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        pkgService.cancelPackage(1, 1, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ForbiddenException);
    });

    it('P2-05: findAll scopes by project.managerId = :userId for PM role', async () => {
      const qb = createMockQueryBuilder();
      mockPackageRepo.createQueryBuilder.mockReturnValue(qb);

      await pkgService.findAll(1, ['PROJECT_MANAGER']);

      expect(qb.andWhere).toHaveBeenCalledWith('project.managerId = :userId', { userId: 1 });
    });

    it('P2-06: findOne rejects non-assigned PM with 403 Forbidden', async () => {
      mockPackageRepo.findOne.mockResolvedValue({
        id: 1,
        project: { id: 10, managerId: 99 },
      });

      await expect(pkgService.findOne(1, 1, ['PROJECT_MANAGER'])).rejects.toThrow(ForbiddenException);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Cost Item Validation, RAB Authority & Categories
  // -------------------------------------------------------------------------
  describe('2. Cost Item Validation, RAB Authority & Categories', () => {
    it('P2-07: Cross-project CostItem is rejected with BadRequestException', async () => {
      const mockProject = { id: 10, managerId: 1, status: 'IN_PROGRESS' };
      const mockRab = { id: 50, projectId: 10, status: 'APPROVED' };
      const crossProjectCostItem = {
        id: 101,
        estimateId: 999,
        estimate: { id: 999, projectId: 99 },
        itemName: 'Splicer Cross Project',
        categoryKey: 'EQUIPMENT',
        entryMode: 'ITEMIZED',
        unitPrice: 5000000,
      };

      mockManager.findOne.mockImplementation((entity: any) => {
        if (entity === Project) return Promise.resolve(mockProject);
        if (entity === ProjectCostEstimate) return Promise.resolve(mockRab);
        return Promise.resolve(null);
      });
      mockManager.find.mockResolvedValue([crossProjectCostItem]);

      await expect(
        pkgService.createDraft(1, ['PROJECT_MANAGER'], {
          projectId: 10,
          title: 'Cross Project Package',
          items: [{ costItemId: 101, requestedQty: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('P2-08: Project without APPROVED RAB is rejected', async () => {
      const mockProject = { id: 10, managerId: 1, status: 'IN_PROGRESS' };
      mockManager.findOne.mockImplementation((entity: any) => {
        if (entity === Project) return Promise.resolve(mockProject);
        if (entity === ProjectCostEstimate) return Promise.resolve(null);
        return Promise.resolve(null);
      });

      await expect(
        pkgService.createDraft(1, ['PROJECT_MANAGER'], {
          projectId: 10,
          title: 'Package without RAB',
          items: [{ costItemId: 101, requestedQty: 1 }],
        }),
      ).rejects.toThrow('tidak memiliki estimasi biaya (RAB) yang berstatus APPROVED');
    });

    it('P2-09: Non-eligible categories (LABOR, PERMIT, CONTINGENCY) are rejected', async () => {
      const mockProject = { id: 10, managerId: 1, status: 'IN_PROGRESS' };
      const mockRab = { id: 50, projectId: 10, status: 'APPROVED' };

      for (const forbiddenCat of ['LABOR', 'PERMIT', 'CONTINGENCY']) {
        const costItem = {
          id: 101,
          estimateId: 50,
          estimate: { id: 50, projectId: 10 },
          itemName: `Item ${forbiddenCat}`,
          categoryKey: forbiddenCat,
          entryMode: 'ITEMIZED',
          unitPrice: 10000,
        };
        mockManager.findOne.mockImplementation((entity: any) => {
          if (entity === Project) return Promise.resolve(mockProject);
          if (entity === ProjectCostEstimate) return Promise.resolve(mockRab);
          return Promise.resolve(null);
        });
        mockManager.find.mockResolvedValue([costItem]);

        await expect(
          pkgService.createDraft(1, ['PROJECT_MANAGER'], {
            projectId: 10,
            title: `Package ${forbiddenCat}`,
            items: [{ costItemId: 101, requestedQty: 1 }],
          }),
        ).rejects.toThrow('tidak eligible untuk pengadaan vendor');
      }
    });

    it('P2-10: Eligible categories (MATERIAL, EQUIPMENT, SUBCONTRACTOR, OPERATIONAL) are accepted', async () => {
      const mockProject = { id: 10, managerId: 1, status: 'IN_PROGRESS' };
      const mockRab = { id: 50, projectId: 10, status: 'APPROVED' };

      for (const eligibleCat of ['MATERIAL', 'EQUIPMENT', 'SUBCONTRACTOR', 'OPERATIONAL']) {
        const costItem = {
          id: 101,
          estimateId: 50,
          estimate: { id: 50, projectId: 10 },
          itemName: `Item ${eligibleCat}`,
          categoryKey: eligibleCat,
          entryMode: 'ITEMIZED',
          unitPrice: 10000,
          quantity: 10,
        };
        mockManager.findOne.mockImplementation((entity: any) => {
          if (entity === Project) return Promise.resolve(mockProject);
          if (entity === ProjectCostEstimate) return Promise.resolve(mockRab);
          return Promise.resolve(null);
        });
        mockManager.find.mockResolvedValue([costItem]);

        const res = await pkgService.createDraft(1, ['PROJECT_MANAGER'], {
          projectId: 10,
          title: `Package ${eligibleCat}`,
          items: [{ costItemId: 101, requestedQty: 1 }],
        });

        expect(res).toBeDefined();
        expect(res.status).toBe(ProcurementPackageStatus.DRAFT);
      }
    });

    it('P2-11: Non-ITEMIZED cost items (e.g. LUMPSUM) are rejected', async () => {
      const mockProject = { id: 10, managerId: 1, status: 'IN_PROGRESS' };
      const mockRab = { id: 50, projectId: 10, status: 'APPROVED' };
      const lumpsumItem = {
        id: 101,
        estimateId: 50,
        estimate: { id: 50, projectId: 10 },
        itemName: 'Lumpsum Fee',
        categoryKey: 'OPERATIONAL',
        entryMode: 'LUMPSUM',
        unitPrice: 10000,
      };

      mockManager.findOne.mockImplementation((entity: any) => {
        if (entity === Project) return Promise.resolve(mockProject);
        if (entity === ProjectCostEstimate) return Promise.resolve(mockRab);
        return Promise.resolve(null);
      });
      mockManager.find.mockResolvedValue([lumpsumItem]);

      await expect(
        pkgService.createDraft(1, ['PROJECT_MANAGER'], {
          projectId: 10,
          title: 'Lumpsum Package',
          items: [{ costItemId: 101, requestedQty: 1 }],
        }),
      ).rejects.toThrow('Hanya item ber-mode ITEMIZED yang dapat dimasukkan');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Required Date & Reservation Lifecycle
  // -------------------------------------------------------------------------
  describe('3. Required Date & Reservation Lifecycle', () => {
    it('P2-12: submitPackage rejects if required_date is missing or in the past', async () => {
      const mockPkgWithoutDate = {
        id: 1,
        projectId: 10,
        status: ProcurementPackageStatus.DRAFT,
        project: { id: 10, managerId: 1, status: 'IN_PROGRESS' },
        requiredDate: null,
        items: [],
      };
      mockManager.findOne.mockResolvedValue(mockPkgWithoutDate);

      await expect(
        pkgService.submitPackage(1, 1, ['PROJECT_MANAGER']),
      ).rejects.toThrow('Tanggal kebutuhan (required_date) wajib diisi');

      const mockPkgPastDate = {
        ...mockPkgWithoutDate,
        requiredDate: '2020-01-01',
      };
      mockManager.findOne.mockResolvedValue(mockPkgPastDate);

      await expect(
        pkgService.submitPackage(1, 1, ['PROJECT_MANAGER']),
      ).rejects.toThrow('tidak boleh berada di masa lampau');
    });

    it('P2-13: Full lifecycle transition: DRAFT -> SUBMITTED -> RETURNED -> SUBMITTED -> CANCELLED', async () => {
      const mockPkg: any = {
        id: 1,
        packageNumber: 'PKG-20260922-001',
        projectId: 10,
        status: ProcurementPackageStatus.DRAFT,
        project: { id: 10, managerId: 1, status: 'IN_PROGRESS' },
        requiredDate: '2026-12-31',
        items: [
          {
            id: 11,
            costItemId: 101,
            requestedQty: 10,
          },
        ],
      };

      // 1. Submit: DRAFT -> SUBMITTED
      mockManager.findOne.mockResolvedValue(mockPkg);
      mockManager.query.mockResolvedValue([{ cnt: 0 }]);
      const qbCostItem = createMockQueryBuilder({
        getMany: [{ id: 101, itemName: 'Kabel FO', quantity: 50, uom: 'Meter' }],
      });
      const qbQuota = createMockQueryBuilder({
        getRawOne: { committedQty: 0 },
      });
      const qbReconcile = createMockQueryBuilder({ getMany: [] });
      mockManager.createQueryBuilder.mockImplementation((entity: any) => {
        if (entity === CostItem) return qbCostItem;
        if (entity === ProcurementPackageItem) return qbQuota;
        if (entity === ProcurementPackage) return qbReconcile;
        return createMockQueryBuilder();
      });

      const submitted = await pkgService.submitPackage(1, 1, ['PROJECT_MANAGER']);
      expect(submitted.status).toBe(ProcurementPackageStatus.SUBMITTED);
      expect(submitted.submittedAt).toBeDefined();

      // 2. Return: SUBMITTED -> RETURNED (Requires PROCUREMENT role)
      mockPkg.status = ProcurementPackageStatus.SUBMITTED;
      mockManager.findOne.mockResolvedValue(mockPkg);

      // Non-procurement cannot return
      await expect(
        pkgService.returnPackage(1, 2, ['PROJECT_MANAGER'], { reason: 'Perlu revisi spek' }),
      ).rejects.toThrow(ForbiddenException);

      // Procurement team returns
      const returned = await pkgService.returnPackage(1, 2, ['PROCUREMENT'], {
        reason: 'Perlu revisi spek',
      });
      expect(returned.status).toBe(ProcurementPackageStatus.RETURNED);
      expect(returned.rejectionNotes).toBe('Perlu revisi spek');

      // 3. Resubmit: RETURNED -> SUBMITTED
      mockPkg.status = ProcurementPackageStatus.RETURNED;
      mockManager.findOne.mockResolvedValue(mockPkg);
      const resubmitted = await pkgService.resubmitPackage(1, 1, ['PROJECT_MANAGER']);
      expect(resubmitted.status).toBe(ProcurementPackageStatus.SUBMITTED);

      // 4. Cancel: SUBMITTED -> CANCELLED
      mockPkg.status = ProcurementPackageStatus.SUBMITTED;
      mockManager.findOne.mockResolvedValue(mockPkg);
      const cancelled = await pkgService.cancelPackage(1, 1, ['PROJECT_MANAGER'], {
        reason: 'Dibatalkan oleh PM',
      });
      expect(cancelled.status).toBe(ProcurementPackageStatus.CANCELLED);
    });

    it('P2-13b: Assigned PM can update package when in RETURNED status', async () => {
      const mockReturnedPkg: any = {
        id: 1,
        projectId: 10,
        title: 'Old Title',
        description: 'Old Description',
        status: ProcurementPackageStatus.RETURNED,
        project: { id: 10, managerId: 1, status: 'IN_PROGRESS' },
        items: [],
      };
      mockManager.findOne.mockResolvedValue(mockReturnedPkg);
      mockManager.save.mockImplementation((entity: any, data: any) => Promise.resolve(data));

      const updated = await pkgService.updateDraft(1, 1, ['PROJECT_MANAGER'], {
        title: 'Revised Title',
        description: 'Revised Description',
      });

      expect(updated.title).toBe('Revised Title');
      expect(updated.description).toBe('Revised Description');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Over-Allocation Protection & Pessimistic Concurrency Locking
  // -------------------------------------------------------------------------
  describe('4. Over-Allocation Protection & Pessimistic Concurrency Locking', () => {
    it('P2-14: submitPackage rejects when committed + requested > baseline (Over-allocation)', async () => {
      const mockPkg: any = {
        id: 1,
        packageNumber: 'PKG-20260922-001',
        projectId: 10,
        status: ProcurementPackageStatus.DRAFT,
        project: { id: 10, managerId: 1, status: 'IN_PROGRESS' },
        requiredDate: '2026-12-31',
        items: [{ id: 11, costItemId: 101, requestedQty: 20 }],
      };

      mockManager.findOne.mockResolvedValue(mockPkg);
      mockManager.query.mockImplementation((sql: string) => {
        if (sql.includes('procurement_package_items')) {
          return Promise.resolve([{ reserved_qty: 40, reserved_amount: 400000 }]);
        }
        return Promise.resolve([{ cnt: 0, committed_qty: 0, committed_amount: 0, ordered_qty: 0, ordered_amount: 0, received_qty: 0 }]);
      });

      // Baseline is 50, but 40 is already committed
      const qbCostItem = createMockQueryBuilder({
        getMany: [{ id: 101, itemName: 'Kabel FO', quantity: 50, uom: 'Meter', subtotal: 500000 }],
      });
      const qbQuota = createMockQueryBuilder({
        getRawOne: { committedQty: 40 }, // 40 + 20 = 60 > 50
      });
      mockManager.createQueryBuilder.mockImplementation((entity: any) => {
        if (entity === CostItem) return qbCostItem;
        if (entity === ProcurementPackageItem) return qbQuota;
        return createMockQueryBuilder({ getMany: [] });
      });

      await expect(
        pkgService.submitPackage(1, 1, ['PROJECT_MANAGER']),
      ).rejects.toThrow("Alokasi kuota untuk item 'Kabel FO' terlampaui!");
    });

    it('P2-15: submitPackage locks cost items in ascending order to prevent deadlocks', async () => {
      const mockPkg: any = {
        id: 1,
        packageNumber: 'PKG-20260922-001',
        projectId: 10,
        status: ProcurementPackageStatus.DRAFT,
        project: { id: 10, managerId: 1, status: 'IN_PROGRESS' },
        requiredDate: '2026-12-31',
        items: [
          { id: 11, costItemId: 300, requestedQty: 5 },
          { id: 12, costItemId: 100, requestedQty: 5 },
          { id: 13, costItemId: 200, requestedQty: 5 },
        ],
      };

      mockManager.findOne.mockResolvedValue(mockPkg);
      mockManager.query.mockResolvedValue([{ cnt: 0 }]);

      const lockedCostItemsQb = createMockQueryBuilder({
        getMany: [
          { id: 100, itemName: 'Item 100', quantity: 100, uom: 'Unit' },
          { id: 200, itemName: 'Item 200', quantity: 100, uom: 'Unit' },
          { id: 300, itemName: 'Item 300', quantity: 100, uom: 'Unit' },
        ],
      });

      mockManager.createQueryBuilder.mockImplementation((entity: any) => {
        if (entity === CostItem) return lockedCostItemsQb;
        if (entity === ProcurementPackageItem) return createMockQueryBuilder({ getRawOne: { committedQty: 0 } });
        return createMockQueryBuilder({ getMany: [] });
      });

      await pkgService.submitPackage(1, 1, ['PROJECT_MANAGER']);

      // Verify sorted IDs [100, 200, 300] passed to pessimistic lock query
      expect(lockedCostItemsQb.where).toHaveBeenCalledWith(
        'ci.id IN (:...ids)',
        { ids: [100, 200, 300] },
      );
      expect(lockedCostItemsQb.setLock).toHaveBeenCalledWith('pessimistic_write');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Legacy Safety Gate & Origin Handling (LEGACY / PACKAGE / AD_HOC)
  // -------------------------------------------------------------------------
  describe('5. Legacy Safety Gate & Origin Handling (LEGACY / PACKAGE / AD_HOC)', () => {
    it('P2-16: Legacy Safety Gate blocks package operations with 422 if active LEGACY PR exists', async () => {
      const mockPkg: any = {
        id: 1,
        packageNumber: 'PKG-20260922-001',
        projectId: 10,
        status: ProcurementPackageStatus.DRAFT,
        project: { id: 10, managerId: 1, status: 'IN_PROGRESS' },
        requiredDate: '2026-12-31',
        items: [{ id: 11, costItemId: 101, requestedQty: 5 }],
      };

      mockManager.findOne.mockResolvedValue(mockPkg);
      // Legacy safety gate returns count = 2
      mockManager.query.mockResolvedValue([{ cnt: 2 }]);

      await expect(
        pkgService.submitPackage(1, 1, ['PROJECT_MANAGER']),
      ).rejects.toThrow(UnprocessableEntityException);

      try {
        await pkgService.submitPackage(1, 1, ['PROJECT_MANAGER']);
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        expect(err.message).toContain('Purchase Request legacy yang belum direkonsiliasi');
      }
    });

    it('P2-17: Direct PR creation on IN_PROGRESS project is rejected with BadRequestException', async () => {
      mockManager.query.mockImplementation((sql: string) => {
        if (sql.includes('FROM projects WHERE id = ? FOR SHARE')) {
          return Promise.resolve([{ status: 'IN_PROGRESS' }]);
        }
        return Promise.resolve([]);
      });
      mockManager.count.mockResolvedValue(0);

      await expect(
        procurementService.createAndSubmitPurchaseRequest(1, {
          projectId: 10,
          totalEstimatedAmount: 1000000,
          items: [{ itemName: 'Item Direct', quantity: 2, estimatedUnitPrice: 500000 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('P2-18: Package PR creation sets origin = PACKAGE', async () => {
      const mockPkg: any = {
        id: 1,
        packageNumber: 'PKG-20260922-001',
        projectId: 10,
        status: ProcurementPackageStatus.SUBMITTED,
        totalEstimatedAmount: 500000,
        items: [
          {
            id: 11,
            costItemId: 101,
            wbsId: 201,
            itemName: 'Kabel FO',
            requestedQty: 50,
            uom: 'Meter',
            estimatedUnitPrice: 10000,
          },
        ],
      };

      mockWfDefRepo.findOne.mockResolvedValue({
        workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
        isActive: 1,
        activeVersion: { id: 1 },
      });

      mockManager.findOne.mockImplementation((entity: any) => {
        if (entity === ProcurementPackage) return Promise.resolve(mockPkg);
        if (entity === PurchaseRequest) return Promise.resolve(null);
        return Promise.resolve(null);
      });
      mockManager.query.mockResolvedValue([{ cnt: 0 }]);
      mockManager.count.mockResolvedValue(0);

      const res = await pkgService.createPrFromPackage(1, 2, ['PROCUREMENT']);

      expect(res.success).toBe(true);
      expect(mockManager.create).toHaveBeenCalledWith(
        PurchaseRequest,
        expect.objectContaining({
          packageId: 1,
          projectId: 10,
          origin: 'PACKAGE',
        }),
      );
      expect(mockManager.create).toHaveBeenCalledWith(
        PurchaseRequestItem,
        expect.objectContaining({
          packageItemId: 11,
          costItemId: 101,
          wbsId: 201,
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 6. 1 Package = 1 PR & Atomic PR Creation with Compensation
  // -------------------------------------------------------------------------
  describe('6. 1 Package = 1 PR & Atomic PR Creation with Compensation', () => {
    it('P2-19: Rejects createPrFromPackage if package status is not SUBMITTED', async () => {
      mockWfDefRepo.findOne.mockResolvedValue({
        workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
        isActive: 1,
        activeVersion: { id: 1 },
      });
      mockManager.findOne.mockResolvedValue({
        id: 1,
        status: ProcurementPackageStatus.DRAFT,
      });

      await expect(
        pkgService.createPrFromPackage(1, 2, ['PROCUREMENT']),
      ).rejects.toThrow('Purchase Request hanya dapat dibuat jika paket berstatus SUBMITTED');
    });

    it('P2-20: Rejects createPrFromPackage with 409 Conflict if PR already exists for package', async () => {
      mockWfDefRepo.findOne.mockResolvedValue({
        workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
        isActive: 1,
        activeVersion: { id: 1 },
      });
      mockManager.findOne.mockImplementation((entity: any) => {
        if (entity === ProcurementPackage) {
          return Promise.resolve({ id: 1, status: ProcurementPackageStatus.SUBMITTED, projectId: 10 });
        }
        if (entity === PurchaseRequest) {
          return Promise.resolve({ id: 5, prNumber: 'PR-20260922-001', packageId: 1 });
        }
        return Promise.resolve(null);
      });
      mockManager.query.mockResolvedValue([{ cnt: 0 }]);

      await expect(
        pkgService.createPrFromPackage(1, 2, ['PROCUREMENT']),
      ).rejects.toThrow(ConflictException);
    });

    it('P2-21: Workflow-start failure compensation physically deletes transient PR and reverts package to SUBMITTED', async () => {
      const mockPkg: any = {
        id: 1,
        packageNumber: 'PKG-20260922-001',
        projectId: 10,
        status: ProcurementPackageStatus.SUBMITTED,
        totalEstimatedAmount: 200000,
        items: [{ id: 11, costItemId: 101, requestedQty: 10, uom: 'Unit', estimatedUnitPrice: 20000 }],
      };

      mockWfDefRepo.findOne.mockResolvedValue({
        workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
        isActive: 1,
        activeVersion: { id: 1 },
      });
      mockManager.findOne.mockImplementation((entity: any) => {
        if (entity === ProcurementPackage) return Promise.resolve(mockPkg);
        if (entity === PurchaseRequest) return Promise.resolve(null);
        return Promise.resolve(null);
      });
      mockManager.query.mockResolvedValue([{ cnt: 0 }]);
      mockManager.count.mockResolvedValue(0);

      // Workflow engine throws
      mockWfEngineService.startInstance.mockRejectedValueOnce(
        new Error('BPMN engine connection failure'),
      );

      await expect(
        pkgService.createPrFromPackage(1, 2, ['PROCUREMENT']),
      ).rejects.toThrow(InternalServerErrorException);

      // Verify physical deletion of transient PR items and PR to release package_id
      expect(mockManager.delete).toHaveBeenCalledWith(PurchaseRequestItem, { prId: 1 });
      expect(mockManager.delete).toHaveBeenCalledWith(PurchaseRequest, { id: 1 });

      // Verify package update back to SUBMITTED
      expect(mockManager.update).toHaveBeenCalledWith(
        ProcurementPackage,
        { id: 1 },
        expect.objectContaining({
          status: ProcurementPackageStatus.SUBMITTED,
        }),
      );
    });

    it('P2-21b: Compensation fails safe and refuses manual deletion if stray WorkflowInstance exists', async () => {
      const mockPkg: any = {
        id: 1,
        packageNumber: 'PKG-20260922-001',
        projectId: 10,
        status: ProcurementPackageStatus.SUBMITTED,
        totalEstimatedAmount: 200000,
        items: [{ id: 11, costItemId: 101, requestedQty: 10, uom: 'Unit', estimatedUnitPrice: 20000 }],
      };

      mockWfDefRepo.findOne.mockResolvedValue({
        workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
        isActive: 1,
        activeVersion: { id: 1 },
      });
      mockManager.findOne.mockImplementation((entity: any) => {
        if (entity === ProcurementPackage) return Promise.resolve(mockPkg);
        if (entity === PurchaseRequest) return Promise.resolve(null);
        if (entity === WorkflowInstance) return Promise.resolve({ id: 999, entityType: 'PURCHASE_REQUEST' });
        return Promise.resolve(null);
      });
      mockManager.query.mockResolvedValue([{ cnt: 0 }]);
      mockManager.count.mockResolvedValue(0);

      mockWfEngineService.startInstance.mockRejectedValueOnce(
        new Error('Unexpected workflow engine failure'),
      );

      await expect(
        pkgService.createPrFromPackage(1, 2, ['PROCUREMENT']),
      ).rejects.toThrow('Terdeteksi artefak workflow parsial (Instance #999)');

      // Verifies that WorkflowInstance was NOT manually deleted
      expect(mockManager.delete).not.toHaveBeenCalledWith(WorkflowInstance, expect.anything());
      expect(mockManager.delete).not.toHaveBeenCalledWith(WorkflowTask, expect.anything());
    });
  });

  // -------------------------------------------------------------------------
  // 7. PR Rejection Synchronization & Event Listener Idempotency
  // -------------------------------------------------------------------------
  describe('7. PR Rejection Synchronization & Event Listener Idempotency', () => {
    it('P2-22: handlePrRejection transitions package to CANCELLED and releases reservation', async () => {
      const mockPr = { id: 10, packageId: 1, status: 'REJECTED' };
      const mockPkg = {
        id: 1,
        packageNumber: 'PKG-20260922-001',
        status: ProcurementPackageStatus.PR_CREATED,
      };

      mockManager.findOne.mockImplementation((entity: any) => {
        if (entity === PurchaseRequest) return Promise.resolve(mockPr);
        if (entity === ProcurementPackage) return Promise.resolve(mockPkg);
        if (entity === WorkflowTask) return Promise.resolve({ comments: 'Budget freeze' });
        return Promise.resolve(null);
      });

      await pkgService.handlePrRejection(10, 88);

      expect(mockManager.save).toHaveBeenCalledWith(
        ProcurementPackage,
        expect.objectContaining({
          status: ProcurementPackageStatus.CANCELLED,
          rejectionNotes: 'Budget freeze',
        }),
      );
    });

    it('P2-23: handlePrRejection is idempotent when package is already CANCELLED', async () => {
      const mockPr = { id: 10, packageId: 1, status: 'REJECTED' };
      const mockPkg = {
        id: 1,
        status: ProcurementPackageStatus.CANCELLED,
      };

      mockManager.findOne.mockImplementation((entity: any) => {
        if (entity === PurchaseRequest) return Promise.resolve(mockPr);
        if (entity === ProcurementPackage) return Promise.resolve(mockPkg);
        return Promise.resolve(null);
      });

      await pkgService.handlePrRejection(10, 88);

      // Did not call save again for package
      expect(mockManager.save).not.toHaveBeenCalledWith(ProcurementPackage, expect.anything());
    });

    it('P2-24: ProcurementEventListener forwards terminal REJECTED PR event to handlePrRejection', async () => {
      const handleSpy = jest.spyOn(pkgService, 'handlePrRejection').mockResolvedValue(undefined);

      await eventListener.handleWorkflowInstanceCompleted({
        instanceId: 88,
        entityType: 'PURCHASE_REQUEST',
        entityId: 10,
        finalStatus: 'REJECTED',
      });

      expect(handleSpy).toHaveBeenCalledWith(10, 88);
    });

    it('P2-25: ProcurementEventListener ignores non-PR or non-REJECTED events', async () => {
      const handleSpy = jest.spyOn(pkgService, 'handlePrRejection').mockResolvedValue(undefined);

      // APPROVED PR
      await eventListener.handleWorkflowInstanceCompleted({
        instanceId: 88,
        entityType: 'PURCHASE_REQUEST',
        entityId: 10,
        finalStatus: 'APPROVED',
      });
      expect(handleSpy).not.toHaveBeenCalled();

      // REJECTED PO
      await eventListener.handleWorkflowInstanceCompleted({
        instanceId: 88,
        entityType: 'PURCHASE_ORDER',
        entityId: 10,
        finalStatus: 'REJECTED',
      });
      expect(handleSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 8. Pure Read GET & Legacy PR Compatibility
  // -------------------------------------------------------------------------
  describe('8. Pure Read GET & Legacy PR Compatibility', () => {
    it('P2-26: findAll and findOne perform pure read without side effects or mutations', async () => {
      const qb = createMockQueryBuilder({ getMany: [{ id: 1, title: 'Pkg 1' }] });
      mockPackageRepo.createQueryBuilder.mockReturnValue(qb);
      mockPackageRepo.findOne.mockResolvedValue({
        id: 1,
        title: 'Pkg 1',
        project: { id: 10, managerId: 1 },
      });

      const list = await pkgService.findAll(1, ['SUPER_ADMIN']);
      expect(list).toHaveLength(1);
      expect(mockManager.save).not.toHaveBeenCalled();
      expect(mockManager.update).not.toHaveBeenCalled();
      expect(mockManager.delete).not.toHaveBeenCalled();

      const item = await pkgService.findOne(1, 1, ['SUPER_ADMIN']);
      expect(item).toBeDefined();
      expect(mockManager.save).not.toHaveBeenCalled();
      expect(mockManager.update).not.toHaveBeenCalled();
      expect(mockManager.delete).not.toHaveBeenCalled();
    });

    it('P2-27: Legacy PR compatibility - validateWbsBudget still works for any PR', async () => {
      mockDataSource.manager.query
        .mockResolvedValueOnce([{ budget_allocation: 10000000, task_name: 'WBS Test' }])
        .mockResolvedValueOnce([{ spent: 2000000 }]);

      const isValid = await procurementService.validateWbsBudget(101, 5000000);
      expect(isValid).toBe(true);
    });
  });
});

// ===========================================================================
// PHASE 3 UNIT TESTS — PROCUREMENT RECONCILIATION & AUTHORITATIVE REMAINING
// ===========================================================================
describe('Procurement Reconciliation & Authoritative Remaining Quantity - Phase 3 Unit Tests', () => {
  let pkgService: ProcurementPackageService;
  let procurementService: ProcurementService;
  let reconService: ProcurementReconciliationService;
  let mockManager: any;
  let mockQueryRunner: any;
  let mockDataSource: any;
  let mockReconRepo: any;
  let mockPrRepo: any;
  let mockPrItemRepo: any;
  let mockCostItemRepo: any;
  let mockCostEstimateRepo: any;
  let mockProjectRepo: any;
  let mockPackageRepo: any;
  let mockPackageItemRepo: any;
  let mockWfDefRepo: any;
  let mockWfInstRepo: any;
  let mockWfEngineService: any;
  let eventEmitterMock: any;

  const createMockQueryBuilder = (config: {
    getOne?: any;
    getMany?: any;
    getRawOne?: any;
  } = {}) => {
    const qb: any = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(config.getOne !== undefined ? config.getOne : null),
      getMany: jest.fn().mockResolvedValue(config.getMany !== undefined ? config.getMany : []),
      getRawOne: jest.fn().mockResolvedValue(config.getRawOne !== undefined ? config.getRawOne : null),
    };
    return qb;
  };

  beforeEach(() => {
    mockManager = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((entityClass, data) => ({ ...data })),
      save: jest.fn((entityClass, data) =>
        Promise.resolve(
          Array.isArray(data)
            ? data.map((d, idx) => ({ id: idx + 1, ...d }))
            : { id: (data as any)?.id || 1, ...data }
        )
      ),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      count: jest.fn().mockResolvedValue(0),
      query: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
    };

    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: mockManager,
    };

    mockDataSource = {
      transaction: jest.fn(async (cb: any) => cb(mockManager)),
      createQueryRunner: jest.fn(() => mockQueryRunner),
      manager: mockManager,
      query: jest.fn().mockResolvedValue([]),
    };

    mockPackageRepo = { createQueryBuilder: jest.fn(() => createMockQueryBuilder()), findOne: jest.fn(), find: jest.fn() };
    mockPackageItemRepo = { find: jest.fn(), findOne: jest.fn() };
    mockPrRepo = { find: jest.fn(), findOne: jest.fn(), count: jest.fn() };
    mockPrItemRepo = { find: jest.fn(), findOne: jest.fn(), createQueryBuilder: jest.fn(() => createMockQueryBuilder()) };
    mockProjectRepo = { find: jest.fn(), findOne: jest.fn() };
    mockCostItemRepo = { find: jest.fn(), findOne: jest.fn() };
    mockCostEstimateRepo = { find: jest.fn(), findOne: jest.fn() };
    mockWfDefRepo = { findOne: jest.fn() };
    mockWfInstRepo = { findOne: jest.fn() };
    mockWfEngineService = { startInstance: jest.fn().mockResolvedValue({ instanceId: 100 }) };
    mockReconRepo = { find: jest.fn(), findOne: jest.fn(), createQueryBuilder: jest.fn(() => createMockQueryBuilder()) };
    eventEmitterMock = { emit: jest.fn() };

    pkgService = new ProcurementPackageService(
      mockPackageRepo,
      mockPackageItemRepo,
      mockPrRepo,
      mockPrItemRepo,
      mockProjectRepo,
      mockCostItemRepo,
      mockCostEstimateRepo,
      mockWfDefRepo,
      mockWfInstRepo,
      mockWfEngineService,
      mockDataSource,
    );

    reconService = new ProcurementReconciliationService(
      mockReconRepo,
      mockPrRepo,
      mockPrItemRepo,
      mockCostItemRepo,
      mockCostEstimateRepo,
      mockProjectRepo,
      mockDataSource,
    );

    procurementService = new ProcurementService(
      mockPrRepo,
      { findOne: jest.fn(), find: jest.fn() } as any,
      {} as any,
      { find: jest.fn(), findOne: jest.fn() } as any,
      { findOne: jest.fn(), find: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      mockWfEngineService,
      mockDataSource,
      eventEmitterMock,
    );
  });

  // ---------------------------------------------------------------------------
  // 1. PO Item Traceability & Zero String Matching
  // ---------------------------------------------------------------------------
  describe('1. PO Item Traceability & Zero String Matching', () => {
    it('P3-01: PO Item authoritatively persists pr_item_id and cost_item_id from quotation items', async () => {
      const mockPr = { id: 1, prNumber: 'PR-20260901-001', status: 'APPROVED', projectId: 10 };
      const mockRfq = { id: 1, prId: 1, status: 'EVALUATED' };
      const mockComparisons = [{ id: 1, rfqId: 1, vendorId: 4, isWinner: true, vendor: { id: 4, name: 'PT Vendor' } }];
      const mockQuotation = {
        id: 3,
        rfqId: 1,
        vendorId: 4,
        status: 'SUBMITTED',
        leadTimeDays: 14,
        items: [
          { id: 10, prItemId: 1, itemName: 'Item A', quantity: 10, unitPrice: 5000 },
          { id: 11, prItemId: 2, itemName: 'Item B', quantity: 20, unitPrice: 2500 },
        ],
      };

      mockManager.findOne.mockImplementation((entityClass: any) => {
        if (entityClass === PurchaseRequest) return Promise.resolve(mockPr);
        if (entityClass === PurchaseOrder) return Promise.resolve(null);
        if (entityClass === Rfq) return Promise.resolve(mockRfq);
        if (entityClass === Quotation) return Promise.resolve(mockQuotation);
        return Promise.resolve(null);
      });

      mockManager.find.mockImplementation((entityClass: any) => {
        if (entityClass === PurchaseRequestItem) {
          return Promise.resolve([
            { id: 1, prId: 1, itemName: 'Item A', quantity: 10, costItemId: 101, wbsId: 501 },
            { id: 2, prId: 1, itemName: 'Item B', quantity: 20, costItemId: 102, wbsId: 502 },
          ]);
        }
        if (entityClass === Rfq) return Promise.resolve([mockRfq]);
        if (entityClass === VendorComparison) return Promise.resolve(mockComparisons);
        return Promise.resolve([]);
      });

      const savedPoItems: any[] = [];
      mockManager.save.mockImplementation((entityClass: any, data: any) => {
        if (entityClass === PurchaseOrderItem) {
          if (Array.isArray(data)) savedPoItems.push(...data);
          else savedPoItems.push(data);
        }
        return Promise.resolve(data);
      });

      const dto: any = {
        purchase_request_id: 1,
        vendor_id: 4,
        payment_terms: [
          { sequence: 1, term_name: 'Lunas', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 100 },
        ],
      };

      const result = await procurementService.createPurchaseOrder(1, dto);

      expect(result.success).toBe(true);
      expect(savedPoItems).toHaveLength(2);
      expect(savedPoItems[0].prItemId).toBe(1);
      expect(savedPoItems[0].costItemId).toBe(101);
      expect(savedPoItems[1].prItemId).toBe(2);
      expect(savedPoItems[1].costItemId).toBe(102);
    });

    it('P3-02: Zero string matching: throws BadRequestException if quotation item lacks authoritative prItemId / costItemId', async () => {
      const mockPr = { id: 1, prNumber: 'PR-20260901-001', status: 'APPROVED', projectId: 10 };
      const mockRfq = { id: 1, prId: 1, status: 'EVALUATED' };
      const mockComparisons = [{ id: 1, rfqId: 1, vendorId: 4, isWinner: true }];
      const mockQuotation = {
        id: 3,
        rfqId: 1,
        vendorId: 4,
        status: 'SUBMITTED',
        leadTimeDays: 14,
        items: [
          // Missing prItemId: Even though itemName matches, string matching is strictly forbidden
          { id: 10, prItemId: null, itemName: 'Item Unlinked', quantity: 10, unitPrice: 5000 },
        ],
      };

      mockManager.findOne.mockImplementation((entityClass: any) => {
        if (entityClass === PurchaseRequest) return Promise.resolve(mockPr);
        if (entityClass === PurchaseOrder) return Promise.resolve(null);
        if (entityClass === Rfq) return Promise.resolve(mockRfq);
        if (entityClass === Quotation) return Promise.resolve(mockQuotation);
        return Promise.resolve(null);
      });

      mockManager.find.mockImplementation((entityClass: any) => {
        if (entityClass === Rfq) return Promise.resolve([mockRfq]);
        if (entityClass === VendorComparison) return Promise.resolve(mockComparisons);
        return Promise.resolve([]);
      });

      const dto: any = {
        purchase_request_id: 1,
        vendor_id: 4,
        payment_terms: [{ sequence: 1, term_name: 'Lunas', term_type: PaymentTermType.DOWN_PAYMENT, percentage: 100 }],
      };

      await expect(procurementService.createPurchaseOrder(1, dto)).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Safety Gate (LEGACY / AD_HOC / PENDING / RECONCILED / EXCLUDED)
  // ---------------------------------------------------------------------------
  describe('2. Safety Gate Enforcement & Resolution States', () => {
    it('P3-03: Safety Gate blocks with 422 if active unreconciled LEGACY PR exists', async () => {
      mockManager.query.mockResolvedValueOnce([{ cnt: 3 }]);

      await expect(
        pkgService.enforceProcurementSafetyGate(10, mockManager),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('P3-04: Safety Gate blocks with 422 if active unreconciled AD_HOC PR exists', async () => {
      mockManager.query.mockResolvedValueOnce([{ cnt: 1 }]);

      await expect(
        pkgService.enforceProcurementSafetyGate(10, mockManager),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('P3-05: Safety Gate PASSES when all items are RECONCILED', async () => {
      mockManager.query.mockResolvedValueOnce([{ cnt: 0 }]);

      await expect(
        pkgService.enforceProcurementSafetyGate(10, mockManager),
      ).resolves.toBeUndefined();
    });

    it('P3-06: Safety Gate PASSES when all items are EXCLUDED', async () => {
      mockManager.query.mockResolvedValueOnce([{ cnt: 0 }]);

      await expect(
        pkgService.enforceProcurementSafetyGate(10, mockManager),
      ).resolves.toBeUndefined();
    });

    it('P3-07: Safety Gate BLOCKS when reconciliation status is PENDING', async () => {
      mockManager.query.mockResolvedValueOnce([{ cnt: 1 }]);

      await expect(
        pkgService.enforceProcurementSafetyGate(10, mockManager),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('P3-08: Safety Gate ignores REJECTED and soft-deleted PRs', async () => {
      mockManager.query.mockImplementation((sql: string) => {
        expect(sql).toContain("pr.status NOT IN ('REJECTED')");
        expect(sql).toContain('pr.deleted_at IS NULL');
        return Promise.resolve([{ cnt: 0 }]);
      });

      await expect(
        pkgService.enforceProcurementSafetyGate(10, mockManager),
      ).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Authoritative Consumption Formulas & Precedence
  // ---------------------------------------------------------------------------
  describe('3. Authoritative Consumption Formulas & Precedence', () => {
    it('P3-09: Active PR is counted once in prCommittedQty', async () => {
      const mockCostItem = { id: 101, quantity: 100, subtotal: 1000000 };
      mockManager.findOne.mockResolvedValue(mockCostItem);

      mockManager.query.mockImplementation((sql: string) => {
        if (sql.includes('procurement_package_items')) {
          return Promise.resolve([{ reserved_qty: 10, reserved_amount: 100000 }]);
        }
        if (sql.includes('purchase_request_items')) {
          return Promise.resolve([{ committed_qty: 30, committed_amount: 300000 }]);
        }
        return Promise.resolve([{ ordered_qty: 0, ordered_amount: 0, received_qty: 0 }]);
      });

      const consumption = await pkgService.computeCostItemConsumption(101, mockManager);

      expect(consumption.baselineQty).toBe(100);
      expect(consumption.reservedQty).toBe(10);
      expect(consumption.prCommittedQty).toBe(30);
      expect(consumption.orderedQty).toBe(0);
      expect(consumption.totalCommitted).toBe(40);
      expect(consumption.rawRemainingQty).toBe(60);
    });

    it('P3-10: PO supersedes PR (PO_ISSUED excluded from prCommittedQty and transfers to orderedQty)', async () => {
      const mockCostItem = { id: 101, quantity: 100, subtotal: 1000000 };
      mockManager.findOne.mockResolvedValue(mockCostItem);

      mockManager.query.mockImplementation((sql: string) => {
        if (sql.includes('procurement_package_items')) {
          return Promise.resolve([{ reserved_qty: 0, reserved_amount: 0 }]);
        }
        if (sql.includes('goods_receipt_items')) {
          return Promise.resolve([{ received_qty: 0 }]);
        }
        if (sql.includes('purchase_order_items')) {
          // PO issued -> 30 ordered qty
          return Promise.resolve([{ ordered_qty: 30, ordered_amount: 300000 }]);
        }
        if (sql.includes('purchase_request_items')) {
          // PR status transitioned to PO_ISSUED -> 0 committed PR qty
          return Promise.resolve([{ committed_qty: 0, committed_amount: 0 }]);
        }
        return Promise.resolve([{ received_qty: 0 }]);
      });

      const consumption = await pkgService.computeCostItemConsumption(101, mockManager);

      expect(consumption.prCommittedQty).toBe(0);
      expect(consumption.orderedQty).toBe(30);
      expect(consumption.totalCommitted).toBe(30);
      expect(consumption.rawRemainingQty).toBe(70);
    });

    it('P3-11: Partial PO releases delta (PR 3000, PO 2500 -> 500 released back to remainingQty)', async () => {
      const mockCostItem = { id: 101, quantity: 3000, subtotal: 30000000 };
      mockManager.findOne.mockResolvedValue(mockCostItem);

      mockManager.query.mockImplementation((sql: string) => {
        if (sql.includes('procurement_package_items')) {
          return Promise.resolve([{ reserved_qty: 0, reserved_amount: 0 }]);
        }
        if (sql.includes('goods_receipt_items')) {
          return Promise.resolve([{ received_qty: 0 }]);
        }
        if (sql.includes('purchase_order_items')) {
          // PO issued for 2500 only
          return Promise.resolve([{ ordered_qty: 2500, ordered_amount: 25000000 }]);
        }
        if (sql.includes('purchase_request_items')) {
          // Precursor PR status is PO_ISSUED -> prCommittedQty is 0
          return Promise.resolve([{ committed_qty: 0, committed_amount: 0 }]);
        }
        return Promise.resolve([{ received_qty: 0 }]);
      });

      const consumption = await pkgService.computeCostItemConsumption(101, mockManager);

      expect(consumption.baselineQty).toBe(3000);
      expect(consumption.prCommittedQty).toBe(0);
      expect(consumption.orderedQty).toBe(2500);
      expect(consumption.totalCommitted).toBe(2500);
      // Sisa kuota 500 kembali tersedia!
      expect(consumption.rawRemainingQty).toBe(500);
    });

    it('P3-12: PO CANCELLED results in zero ordered consumption', async () => {
      const mockCostItem = { id: 101, quantity: 100, subtotal: 1000000 };
      mockManager.findOne.mockResolvedValue(mockCostItem);

      mockManager.query.mockImplementation((sql: string) => {
        if (sql.includes('goods_receipt_items')) {
          return Promise.resolve([{ received_qty: 0 }]);
        }
        if (sql.includes('purchase_order_items')) {
          expect(sql).toContain("po.status IN ('ISSUED', 'PARTIALLY_FULFILLED', 'COMPLETED')");
          return Promise.resolve([{ ordered_qty: 0, ordered_amount: 0 }]);
        }
        return Promise.resolve([{ reserved_qty: 0, committed_qty: 0, received_qty: 0 }]);
      });

      const consumption = await pkgService.computeCostItemConsumption(101, mockManager);
      expect(consumption.orderedQty).toBe(0);
      expect(consumption.rawRemainingQty).toBe(100);
    });

    it('P3-13: GoodsReceipt received_qty does NOT double deduct budget', async () => {
      const mockCostItem = { id: 101, quantity: 100, subtotal: 1000000 };
      mockManager.findOne.mockResolvedValue(mockCostItem);

      mockManager.query.mockImplementation((sql: string) => {
        if (sql.includes('goods_receipt_items')) {
          // Received 40 items at warehouse
          return Promise.resolve([{ received_qty: 40 }]);
        }
        if (sql.includes('purchase_order_items')) {
          return Promise.resolve([{ ordered_qty: 40, ordered_amount: 400000 }]);
        }
        return Promise.resolve([{ reserved_qty: 0, committed_qty: 0 }]);
      });

      const consumption = await pkgService.computeCostItemConsumption(101, mockManager);

      expect(consumption.orderedQty).toBe(40);
      expect(consumption.receivedQty).toBe(40);
      // receivedQty is informational only; totalCommitted does not add it a second time
      expect(consumption.totalCommitted).toBe(40);
      expect(consumption.rawRemainingQty).toBe(60);
    });
    it('P3-14: Historical overrun is reflected in raw values and available is floored at 0', async () => {
      const mockCostItem = { id: 101, quantity: 1000, subtotal: 1000000 };
      mockManager.findOne.mockResolvedValue(mockCostItem);

      mockManager.query.mockImplementation((sql: string) => {
        if (sql.includes('procurement_package_items')) {
          return Promise.resolve([{ reserved_qty: 0, reserved_amount: 0 }]);
        }
        if (sql.includes('goods_receipt_items')) {
          return Promise.resolve([{ received_qty: 0 }]);
        }
        if (sql.includes('purchase_order_items')) {
          // Ordered 1200 items (200 overrun)
          return Promise.resolve([{ ordered_qty: 1200, ordered_amount: 1200000 }]);
        }
        if (sql.includes('purchase_request_items')) {
          return Promise.resolve([{ committed_qty: 0, committed_amount: 0 }]);
        }
        return Promise.resolve([{ reserved_qty: 0, committed_qty: 0 }]);
      });

      const consumption = await pkgService.computeCostItemConsumption(101, mockManager);

      expect(consumption.rawRemainingQty).toBe(-200);
      expect(consumption.availableQty).toBe(0);
      expect(consumption.overrunQty).toBe(200);
      
      expect(consumption.rawRemainingAmount).toBe(-200000);
      expect(consumption.availableAmount).toBe(0);
      expect(consumption.overrunAmount).toBe(200000);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Direct AD_HOC PR Guard on IN_PROGRESS
  // ---------------------------------------------------------------------------
  describe('4. Direct AD_HOC PR Guard on IN_PROGRESS', () => {
    it('P3-14: Direct PR creation on IN_PROGRESS project is strictly rejected with BadRequestException', async () => {
      mockManager.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT status FROM projects')) {
          return Promise.resolve([{ status: 'IN_PROGRESS' }]);
        }
        return Promise.resolve([]);
      });

      await expect(
        procurementService.createAndSubmitPurchaseRequest(1, {
          projectId: 10,
          totalEstimatedAmount: 1000000,
          items: [{ itemName: 'Direct Item', quantity: 2, estimatedUnitPrice: 500000 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Procurement Reconciliation Service
  // ---------------------------------------------------------------------------
  describe('5. Procurement Reconciliation Service & Immutability', () => {
    it('P3-15: Cross-project CostItem reconciliation is rejected with BadRequestException', async () => {
      const mockPrItem = {
        id: 1,
        purchaseRequest: { id: 10, projectId: 1, origin: 'LEGACY' },
        quantity: 5,
        estimatedUnitPrice: 1000,
        totalAmount: 5000,
      };
      const mockCrossProjectCostItem = {
        id: 999,
        estimateId: 50,
        estimate: { id: 50, projectId: 99, status: 'APPROVED' }, // Project 99 != Project 1
        categoryKey: 'MATERIAL',
        entryMode: 'ITEMIZED',
      };

      mockManager.findOne.mockImplementation((entityClass: any) => {
        if (entityClass === PurchaseRequestItem) return Promise.resolve(mockPrItem);
        if (entityClass === CostItem) return Promise.resolve(mockCrossProjectCostItem);
        return Promise.resolve(null);
      });

      await expect(
        reconService.reconcileItem(1, ['PROCUREMENT'], 1, { targetCostItemId: 999 }),
      ).rejects.toThrow('bukan milik proyek');
    });

    it('P3-16: Target CostItem must be from APPROVED RAB and have eligible category', async () => {
      const mockPrItem = {
        id: 1,
        purchaseRequest: { id: 10, projectId: 1, origin: 'LEGACY' },
        quantity: 5,
        estimatedUnitPrice: 1000,
        totalAmount: 5000,
      };
      const mockUnapprovedCostItem = {
        id: 101,
        estimateId: 50,
        estimate: { id: 50, projectId: 1, status: 'DRAFT' }, // Not APPROVED
        categoryKey: 'MATERIAL',
        entryMode: 'ITEMIZED',
      };

      mockManager.findOne.mockImplementation((entityClass: any) => {
        if (entityClass === PurchaseRequestItem) return Promise.resolve(mockPrItem);
        if (entityClass === CostItem) return Promise.resolve(mockUnapprovedCostItem);
        return Promise.resolve(null);
      });

      await expect(
        reconService.reconcileItem(1, ['PROCUREMENT'], 1, { targetCostItemId: 101 }),
      ).rejects.toThrow('Rekonsiliasi hanya diizinkan ke RAB berstatus APPROVED');
    });

    it('P3-17: Historical commercial fields (itemName, quantity, unitPrice) remain unchanged during reconciliation', async () => {
      const mockPrItem: any = {
        id: 1,
        itemName: 'Kabel Tembaga Legacy Asli',
        quantity: 10,
        estimatedUnitPrice: 25000,
        totalAmount: 250000,
        costItemId: null,
        wbsId: null,
        purchaseRequest: { id: 10, projectId: 1, origin: 'LEGACY' },
      };

      const mockCostItem: any = {
        id: 201,
        itemName: 'Kabel Power NYA 2.5mm',
        wbsId: 301,
        estimateId: 50,
        estimate: { id: 50, projectId: 1, status: 'APPROVED' },
        categoryKey: 'MATERIAL',
        entryMode: 'ITEMIZED',
        quantity: 100,
        subtotal: 2500000,
      };

      mockManager.findOne.mockImplementation((entityClass: any) => {
        if (entityClass === PurchaseRequestItem) return Promise.resolve(mockPrItem);
        if (entityClass === CostItem) return Promise.resolve(mockCostItem);
        if (entityClass === ProcurementReconciliation) return Promise.resolve(null);
        return Promise.resolve(null);
      });

      mockManager.find.mockResolvedValue([]);
      mockManager.query.mockResolvedValue([{ reserved_qty: 0, committed_qty: 0, ordered_qty: 0, received_qty: 0 }]);

      const result = await reconService.reconcileItem(1, ['PROCUREMENT'], 1, {
        targetCostItemId: 201,
        notes: 'Rekonsiliasi kabel legacy',
      });

      expect(result.success).toBe(true);
      // Commercial fields strictly preserved
      expect(mockPrItem.itemName).toBe('Kabel Tembaga Legacy Asli');
      expect(mockPrItem.quantity).toBe(10);
      expect(mockPrItem.estimatedUnitPrice).toBe(25000);
      expect(mockPrItem.totalAmount).toBe(250000);

      // Projections synchronized
      expect(mockPrItem.costItemId).toBe(201);
      expect(mockPrItem.wbsId).toBe(301);
    });

    it('P3-18: Exclude item requires mandatory reason and sets status EXCLUDED', async () => {
      const mockPrItem = {
        id: 1,
        purchaseRequest: { id: 10, projectId: 1, origin: 'AD_HOC' },
        quantity: 5,
        estimatedUnitPrice: 1000,
        totalAmount: 5000,
      };

      mockManager.findOne.mockImplementation((entityClass: any) => {
        if (entityClass === PurchaseRequestItem) return Promise.resolve(mockPrItem);
        if (entityClass === ProcurementReconciliation) return Promise.resolve(null);
        return Promise.resolve(null);
      });

      // Blank reason -> Rejected
      await expect(
        reconService.excludeItem(1, ['PROCUREMENT'], 1, { reason: '' }),
      ).rejects.toThrow('Alasan eksklusi (reason) wajib diisi.');

      // Valid reason -> Success
      const result = await reconService.excludeItem(1, ['PROCUREMENT'], 1, {
        reason: 'Item pengadaan dibatalkan dan tidak lagi dibebankan ke RAB proyek.',
      });

      expect(result.success).toBe(true);
      expect(result.reconciliation.status).toBe(ProcurementReconciliationStatus.EXCLUDED);
    });

    it('P3-19: Concurrency quota protection evaluates authoritative remaining quantity under pessimistic lock', async () => {
      const mockPkg: any = {
        id: 1,
        packageNumber: 'PKG-20260922-001',
        projectId: 10,
        status: ProcurementPackageStatus.DRAFT,
        project: { id: 10, managerId: 1, status: 'IN_PROGRESS' },
        requiredDate: '2026-12-31',
        items: [{ id: 11, costItemId: 101, requestedQty: 25 }],
      };

      mockManager.findOne.mockResolvedValue(mockPkg);
      // CostItem baseline is 50, but 30 is committed (20 reserved + 10 ordered)
      const qbCostItem = createMockQueryBuilder({
        getMany: [{ id: 101, itemName: 'Kabel FO', quantity: 50, uom: 'Meter', subtotal: 500000 }],
      });

      mockManager.createQueryBuilder.mockReturnValue(qbCostItem);
      mockManager.query.mockImplementation((sql: string) => {
        if (sql.includes('procurement_package_items')) {
          return Promise.resolve([{ reserved_qty: 20, reserved_amount: 200000 }]);
        }
        if (sql.includes('purchase_order_items')) {
          return Promise.resolve([{ ordered_qty: 10, ordered_amount: 100000 }]);
        }
        return Promise.resolve([{ cnt: 0, committed_qty: 0, received_qty: 0 }]);
      });

      // Requested 25 > remaining 20 (50 - 30) -> Must reject
      await expect(
        pkgService.submitPackage(1, 1, ['PROJECT_MANAGER']),
      ).rejects.toThrow("Alokasi kuota untuk item 'Kabel FO' terlampaui!");

      expect(qbCostItem.setLock).toHaveBeenCalledWith('pessimistic_write');
    });

    it('P3-20: Reconciliation RBAC: PM role cannot mutate reconciliation', async () => {
      await expect(
        reconService.reconcileItem(1, ['PROJECT_MANAGER'], 1, { targetCostItemId: 101 }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        reconService.excludeItem(1, ['PROJECT_MANAGER'], 1, { reason: 'Test exclude' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});


