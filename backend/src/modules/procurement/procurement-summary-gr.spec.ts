import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Like } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ProcurementController } from './procurement.controller';
import { ProcurementService } from './procurement.service';
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
import { PurchaseOrder, PurchaseOrderType } from '../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../entities/purchase-order-item.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { GoodsReceiptItem } from '../../entities/goods-receipt-item.entity';
import { ProcurementPackage, ProcurementPackageStatus } from '../../entities/procurement-package.entity';
import { ProcurementReconciliation, ProcurementReconciliationStatus } from '../../entities/procurement-reconciliation.entity';

describe('EPMS — Procurement Summary & Goods Receipt Recovery Suite (Phases 1-10)', () => {
  let controller: ProcurementController;
  let service: ProcurementService;
  let reflector: Reflector;

  let prRepoMock: any;
  let poRepoMock: any;
  let grRepoMock: any;
  let rfqRepoMock: any;
  let vendorRepoMock: any;
  let quotationRepoMock: any;
  let quotationItemRepoMock: any;
  let vendorComparisonRepoMock: any;
  let packageRepoMock: any;
  let prItemRepoMock: any;
  let dataSourceMock: any;
  let queryRunnerMock: any;
  let eventEmitterMock: any;
  let workflowServiceMock: any;

  beforeEach(async () => {
    prRepoMock = {
      count: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    poRepoMock = {
      count: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    grRepoMock = {
      count: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    rfqRepoMock = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    vendorRepoMock = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    quotationRepoMock = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    quotationItemRepoMock = {
      find: jest.fn(),
    };

    vendorComparisonRepoMock = {
      find: jest.fn(),
    };

    packageRepoMock = {
      count: jest.fn(),
    };

    prItemRepoMock = {
      createQueryBuilder: jest.fn(),
    };

    queryRunnerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn(),
        count: jest.fn(),
        create: jest.fn().mockImplementation((entityClass, data) => ({ ...data })),
        save: jest.fn().mockImplementation((entity) => {
          if (Array.isArray(entity)) {
            return Promise.resolve(entity.map((e, idx) => ({ id: idx + 1, ...e })));
          }
          return Promise.resolve({ id: entity.id || 1, ...entity });
        }),
      },
    };

    dataSourceMock = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
      getRepository: jest.fn().mockImplementation((target) => {
        if (target === ProcurementPackage) return packageRepoMock;
        if (target === PurchaseRequestItem) return prItemRepoMock;
        if (target === ProcurementReconciliation) return { count: jest.fn().mockResolvedValue(0) };
        return {};
      }),
    };

    eventEmitterMock = {
      emit: jest.fn(),
    };

    workflowServiceMock = {};

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcurementController],
      providers: [
        ProcurementService,
        Reflector,
        {
          provide: ProcurementPackageService,
          useValue: {},
        },
        {
          provide: ServiceClaimService,
          useValue: {},
        },
        {
          provide: getRepositoryToken(PurchaseRequest),
          useValue: prRepoMock,
        },
        {
          provide: getRepositoryToken(Rfq),
          useValue: rfqRepoMock,
        },
        {
          provide: getRepositoryToken(Vendor),
          useValue: vendorRepoMock,
        },
        {
          provide: getRepositoryToken(Quotation),
          useValue: quotationRepoMock,
        },
        {
          provide: getRepositoryToken(QuotationItem),
          useValue: quotationItemRepoMock,
        },
        {
          provide: getRepositoryToken(VendorComparison),
          useValue: vendorComparisonRepoMock,
        },
        {
          provide: getRepositoryToken(PurchaseOrder),
          useValue: poRepoMock,
        },
        {
          provide: getRepositoryToken(GoodsReceipt),
          useValue: grRepoMock,
        },
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitterMock,
        },
        {
          provide: WorkflowService,
          useValue: workflowServiceMock,
        },
      ],
    }).compile();

    controller = module.get<ProcurementController>(ProcurementController);
    service = module.get<ProcurementService>(ProcurementService);
    reflector = module.get<Reflector>(Reflector);
  });

  // =========================================================================
  // GROUP 1: PROCUREMENT SUMMARY (Tests 1-5)
  // =========================================================================
  describe('Group 1: Procurement Summary API (Tests 1-5)', () => {
    it('1. summary endpoint exists and is mounted on controller', async () => {
      expect(controller.getDashboardSummary).toBeDefined();
      const spy = jest.spyOn(service, 'getDashboardSummary').mockResolvedValue({
        packageQueueCount: 0,
        reconciliationCount: 0,
        purchaseRequestCount: 1,
        purchaseOrderCount: 1,
        goodsReceiptCount: 0,
      });

      const res = await controller.getDashboardSummary();
      expect(spy).toHaveBeenCalled();
      expect(res.purchaseRequestCount).toBe(1);
      expect(res.purchaseOrderCount).toBe(1);
    });

    it('2. PR count is correct in getDashboardSummary', async () => {
      prRepoMock.count.mockResolvedValue(5);
      poRepoMock.count.mockResolvedValue(3);
      grRepoMock.count.mockResolvedValue(2);
      packageRepoMock.count.mockResolvedValue(0);

      const qbMock: any = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      prItemRepoMock.createQueryBuilder.mockReturnValue(qbMock);

      const summary = await service.getDashboardSummary();
      expect(summary.purchaseRequestCount).toBe(5);
    });

    it('3. PO count is correct in getDashboardSummary', async () => {
      prRepoMock.count.mockResolvedValue(1);
      poRepoMock.count.mockResolvedValue(4);
      grRepoMock.count.mockResolvedValue(1);
      packageRepoMock.count.mockResolvedValue(0);

      const qbMock: any = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      prItemRepoMock.createQueryBuilder.mockReturnValue(qbMock);

      const summary = await service.getDashboardSummary();
      expect(summary.purchaseOrderCount).toBe(4);
    });

    it('4. package queue count is correct in getDashboardSummary (filters status: SUBMITTED)', async () => {
      prRepoMock.count.mockResolvedValue(1);
      poRepoMock.count.mockResolvedValue(1);
      grRepoMock.count.mockResolvedValue(0);
      packageRepoMock.count.mockResolvedValue(3);

      const qbMock: any = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      prItemRepoMock.createQueryBuilder.mockReturnValue(qbMock);

      const summary = await service.getDashboardSummary();
      expect(packageRepoMock.count).toHaveBeenCalledWith({
        where: { status: ProcurementPackageStatus.SUBMITTED },
      });
      expect(summary.packageQueueCount).toBe(3);
    });

    it('5. reconciliation count is correct in getDashboardSummary', async () => {
      prRepoMock.count.mockResolvedValue(1);
      poRepoMock.count.mockResolvedValue(1);
      grRepoMock.count.mockResolvedValue(0);
      packageRepoMock.count.mockResolvedValue(0);

      const qbMock: any = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(7),
      };
      prItemRepoMock.createQueryBuilder.mockReturnValue(qbMock);

      const summary = await service.getDashboardSummary();
      expect(summary.reconciliationCount).toBe(7);
    });
  });

  // =========================================================================
  // GROUP 2: PURCHASE ORDER PROJECTION (Tests 6-8)
  // =========================================================================
  describe('Group 2: Purchase Order Projection (Tests 6-8)', () => {
    it('6. list PO includes vendor relation', async () => {
      poRepoMock.find.mockResolvedValue([]);
      await service.getAllPurchaseOrders();

      expect(poRepoMock.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: expect.arrayContaining(['vendor']),
        }),
      );
    });

    it('7. list PO includes purchaseRequest relation', async () => {
      poRepoMock.find.mockResolvedValue([]);
      await service.getAllPurchaseOrders();

      expect(poRepoMock.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: expect.arrayContaining(['purchaseRequest']),
        }),
      );
    });

    it('8. list PO and getPurchaseOrderById include purchaseRequest.project relation', async () => {
      poRepoMock.find.mockResolvedValue([]);
      await service.getAllPurchaseOrders();

      expect(poRepoMock.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: expect.arrayContaining(['purchaseRequest.project']),
        }),
      );

      poRepoMock.findOne.mockResolvedValue({ id: 1, poNumber: 'PO-001' });
      await service.getPurchaseOrderById(1);

      expect(poRepoMock.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: expect.arrayContaining([
            'items',
            'vendor',
            'purchaseRequest',
            'purchaseRequest.project',
          ]),
        }),
      );
    });
  });

  // =========================================================================
  // GROUP 3: GOODS RECEIPT CREATION & CALCULATIONS (Tests 9-17)
  // =========================================================================
  describe('Group 3: Goods Receipt Logic (Tests 9-17)', () => {
    const mockPo: any = {
      id: 1,
      poNumber: 'PO-20261015-001',
      orderType: PurchaseOrderType.MATERIAL,
      status: 'ISSUED',
      items: [
        { id: 1, quantity: 1513, receivedQuantity: 0, unitPrice: 70000 },
        { id: 2, quantity: 1, receivedQuantity: 0, unitPrice: 700000 },
        { id: 3, quantity: 2, receivedQuantity: 0, unitPrice: 3750000 },
        { id: 4, quantity: 2, receivedQuantity: 0, unitPrice: 1305000 },
        { id: 5, quantity: 13, receivedQuantity: 0, unitPrice: 60000 },
      ],
    };

    const getFreshMockPo = () => JSON.parse(JSON.stringify(mockPo));

    it('9. creates GR for valid MATERIAL PO', async () => {
      queryRunnerMock.manager.findOne.mockResolvedValue(getFreshMockPo());
      queryRunnerMock.manager.count.mockResolvedValue(0);

      const dto = {
        purchaseOrderId: 1,
        receiptDate: '2026-10-15T14:00:00.000Z',
        remarks: 'Batch 1 Received',
        items: [
          { poItemId: 1, receivedQuantity: 100, remarks: '' },
        ],
      };

      const result = await service.createGoodsReceipt(dto as any, 41);
      expect(result.success).toBe(true);
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
      expect(eventEmitterMock.emit).toHaveBeenCalledWith('gr.created', expect.any(Object));
    });

    it('10. totalReceivedAmount calculated correctly as sum of qty * unitPrice', async () => {
      queryRunnerMock.manager.findOne.mockResolvedValue({
        ...getFreshMockPo(),
        items: [
          { id: 1, quantity: 10, receivedQuantity: 0, unitPrice: 50000 },
          { id: 2, quantity: 5, receivedQuantity: 0, unitPrice: 20000 },
        ],
      });
      queryRunnerMock.manager.count.mockResolvedValue(0);

      const dto = {
        purchaseOrderId: 1,
        receiptDate: '2026-10-15T14:00:00.000Z',
        remarks: 'Testing formula',
        items: [
          { poItemId: 1, receivedQuantity: 4, remarks: '' }, // 4 * 50000 = 200000
          { poItemId: 2, receivedQuantity: 3, remarks: '' }, // 3 * 20000 =  60000
        ],
      };

      await service.createGoodsReceipt(dto as any, 41);

      // Verify that queryRunner.manager.create was called for GoodsReceipt with totalReceivedAmount = 260000
      expect(queryRunnerMock.manager.create).toHaveBeenCalledWith(
        GoodsReceipt,
        expect.objectContaining({
          totalReceivedAmount: 260000,
        }),
      );
    });

    it('11. partial receipt amount is correct', async () => {
      queryRunnerMock.manager.findOne.mockResolvedValue(getFreshMockPo());
      queryRunnerMock.manager.count.mockResolvedValue(0);

      // Receive only item 1 partially: 500 units @ 70000 = 35,000,000
      const dto = {
        purchaseOrderId: 1,
        receiptDate: '2026-10-15T14:00:00.000Z',
        remarks: 'Partial',
        items: [
          { poItemId: 1, receivedQuantity: 500, remarks: '' },
        ],
      };

      await service.createGoodsReceipt(dto as any, 41);

      expect(queryRunnerMock.manager.create).toHaveBeenCalledWith(
        GoodsReceipt,
        expect.objectContaining({
          totalReceivedAmount: 35000000,
        }),
      );
    });

    it('12. full receipt amount is correct (117,500,000)', async () => {
      queryRunnerMock.manager.findOne.mockResolvedValue(getFreshMockPo());
      queryRunnerMock.manager.count.mockResolvedValue(0);

      // Full receipt for all 5 items
      const dto = {
        purchaseOrderId: 1,
        receiptDate: '2026-10-15T14:00:00.000Z',
        remarks: 'Full',
        items: [
          { poItemId: 1, receivedQuantity: 1513, remarks: '' }, // 105,910,000
          { poItemId: 2, receivedQuantity: 1, remarks: '' },    //    700,000
          { poItemId: 3, receivedQuantity: 2, remarks: '' },    //  7,500,000
          { poItemId: 4, receivedQuantity: 2, remarks: '' },    //  2,610,000
          { poItemId: 5, receivedQuantity: 13, remarks: '' },   //    780,000
        ],
      };

      await service.createGoodsReceipt(dto as any, 41);

      expect(queryRunnerMock.manager.create).toHaveBeenCalledWith(
        GoodsReceipt,
        expect.objectContaining({
          totalReceivedAmount: 117500000,
        }),
      );
    });

    it('13. over-receipt is rejected with BadRequestException', async () => {
      queryRunnerMock.manager.findOne.mockResolvedValue({
        ...mockPo,
        items: [
          { id: 1, quantity: 10, receivedQuantity: 8, unitPrice: 1000 },
        ],
      });

      // Remaining is 2, trying to receive 3
      const dto = {
        purchaseOrderId: 1,
        receiptDate: '2026-10-15T14:00:00.000Z',
        remarks: 'Over-receipt',
        items: [
          { poItemId: 1, receivedQuantity: 3, remarks: '' },
        ],
      };

      await expect(service.createGoodsReceipt(dto as any, 41)).rejects.toThrow(
        BadRequestException,
      );
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    });

    it('14. receivedQuantity increment is correct on PO item', async () => {
      const livePoItem = { id: 1, quantity: 100, receivedQuantity: 20, unitPrice: 1000 };
      queryRunnerMock.manager.findOne.mockResolvedValue({
        ...mockPo,
        items: [livePoItem],
      });
      queryRunnerMock.manager.count.mockResolvedValue(0);

      const dto = {
        purchaseOrderId: 1,
        receiptDate: '2026-10-15T14:00:00.000Z',
        remarks: '',
        items: [
          { poItemId: 1, receivedQuantity: 30, remarks: '' },
        ],
      };

      await service.createGoodsReceipt(dto as any, 41);

      expect(livePoItem.receivedQuantity).toBe(50); // 20 + 30
      expect(queryRunnerMock.manager.save).toHaveBeenCalledWith(livePoItem);
    });

    it('15. PO fulfillment status updates to PARTIALLY_FULFILLED on partial, COMPLETED on full', async () => {
      // Case A: Partial fulfillment
      const poCaseA = {
        ...mockPo,
        status: 'ISSUED',
        items: [
          { id: 1, quantity: 10, receivedQuantity: 0, unitPrice: 100 },
          { id: 2, quantity: 10, receivedQuantity: 0, unitPrice: 100 },
        ],
      };
      queryRunnerMock.manager.findOne.mockResolvedValueOnce(poCaseA);
      queryRunnerMock.manager.count.mockResolvedValueOnce(0);

      await service.createGoodsReceipt({
        purchaseOrderId: 1,
        receiptDate: '2026-10-15T14:00:00.000Z',
        remarks: '',
        items: [{ poItemId: 1, receivedQuantity: 5, remarks: '' }],
      } as any, 41);

      expect(poCaseA.status).toBe('PARTIALLY_FULFILLED');

      // Case B: Full fulfillment
      const poCaseB = {
        ...mockPo,
        status: 'PARTIALLY_FULFILLED',
        items: [
          { id: 1, quantity: 10, receivedQuantity: 5, unitPrice: 100 },
          { id: 2, quantity: 10, receivedQuantity: 10, unitPrice: 100 },
        ],
      };
      queryRunnerMock.manager.findOne.mockResolvedValueOnce(poCaseB);
      queryRunnerMock.manager.count.mockResolvedValueOnce(0);

      await service.createGoodsReceipt({
        purchaseOrderId: 1,
        receiptDate: '2026-10-15T14:00:00.000Z',
        remarks: '',
        items: [{ poItemId: 1, receivedQuantity: 5, remarks: '' }],
      } as any, 41);

      expect(poCaseB.status).toBe('COMPLETED');
    });

    it('16. transaction rollback is atomic on failure', async () => {
      queryRunnerMock.manager.findOne.mockResolvedValue(getFreshMockPo());
      queryRunnerMock.manager.count.mockResolvedValue(0);
      // Simulate save failure on GR header
      queryRunnerMock.manager.save.mockRejectedValueOnce(new Error('DB failure'));

      const dto = {
        purchaseOrderId: 1,
        receiptDate: '2026-10-15T14:00:00.000Z',
        remarks: '',
        items: [{ poItemId: 1, receivedQuantity: 10, remarks: '' }],
      };

      await expect(service.createGoodsReceipt(dto as any, 41)).rejects.toThrow('DB failure');
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.release).toHaveBeenCalled();
    });

    it('17. non-existent PO or invalid PO status is blocked', async () => {
      // Non-existent PO
      queryRunnerMock.manager.findOne.mockResolvedValueOnce(null);
      await expect(service.createGoodsReceipt({ purchaseOrderId: 999, receiptDate: '2026-10-15T14:00:00.000Z', items: [] } as any, 41))
        .rejects.toThrow(BadRequestException);

      // Completed PO
      queryRunnerMock.manager.findOne.mockResolvedValueOnce({
        ...mockPo,
        status: 'COMPLETED',
      });
      await expect(service.createGoodsReceipt({ purchaseOrderId: 1, receiptDate: '2026-10-15T14:00:00.000Z', items: [] } as any, 41))
        .rejects.toThrow('Cannot receive goods for PO with status COMPLETED');
    });

    it('17b. EVT-01 emits both legacy gr.created and canonical procurement.gr.received BusinessEvent', async () => {
      queryRunnerMock.manager.findOne.mockResolvedValue(getFreshMockPo());
      queryRunnerMock.manager.count.mockResolvedValue(0);

      const dto = {
        purchaseOrderId: 1,
        receiptDate: '2026-10-15T14:00:00.000Z',
        remarks: 'Receipt with dual events',
        items: [
          { poItemId: 1, receivedQuantity: 10, remarks: '' },
        ],
      };

      await service.createGoodsReceipt(dto as any, 41);

      // 1. Legacy domain event preserved for package closure listener
      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'gr.created',
        expect.objectContaining({
          po_id: 1,
        }),
      );

      // 2. Canonical BusinessEvent emitted for BusinessSyncConsumer
      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'procurement.gr.received',
        expect.objectContaining({
          eventName: 'procurement.gr.received',
          aggregateType: 'GoodsReceipt',
          eventVersion: 1,
          payload: expect.objectContaining({
            poId: 1,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // GROUP 4: GOODS RECEIPT AUTHORITY HARDENING (Tests 18-24)
  // =========================================================================
  describe('Group 4: Goods Receipt Authority Hardening (Tests 18-24)', () => {
    let roles: string[];

    beforeEach(() => {
      roles = reflector.get<string[]>('roles', controller.createGoodsReceipt) || [];
    });

    it('18. PROCUREMENT allowed on POST goods-receipts', () => {
      expect(roles).toContain('PROCUREMENT');
    });

    it('19. PURCHASING allowed on POST goods-receipts', () => {
      expect(roles).toContain('PURCHASING');
    });

    it('20. PROJECT_MANAGER denied on POST goods-receipts', () => {
      expect(roles).not.toContain('PROJECT_MANAGER');
    });

    it('21. PMO denied on POST goods-receipts', () => {
      expect(roles).not.toContain('PMO');
    });

    it('22. HEAD_OF_OPERATIONS denied on POST goods-receipts', () => {
      expect(roles).not.toContain('HEAD_OF_OPERATIONS');
    });

    it('23. ADMIN denied on POST goods-receipts', () => {
      expect(roles).not.toContain('ADMIN');
    });

    it('24. SUPER_ADMIN denied on POST goods-receipts', () => {
      expect(roles).not.toContain('SUPER_ADMIN');
    });
  });
});
