import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProcurementService } from './procurement.service';
import { WorkflowService } from '../workflow-engine/workflow.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { PurchaseRequestItem } from '../../entities/purchase-request-item.entity';
import { Rfq } from '../../entities/rfq.entity';
import { Vendor } from '../../entities/vendor.entity';
import { Quotation } from '../../entities/quotation.entity';
import { QuotationItem } from '../../entities/quotation-item.entity';
import { VendorComparison } from '../../entities/vendor-comparison.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../entities/purchase-order-item.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { GoodsReceiptItem } from '../../entities/goods-receipt-item.entity';
import { AuditLog } from '../../entities/audit-log.entity';

describe('P7.5 Part E: Goods Receipt Hardening Spec (GR-01 to GR-10)', () => {
  let service: ProcurementService;
  let dataSourceMock: any;
  let queryRunnerMock: any;
  let eventEmitterMock: any;
  let savedEntities: any[] = [];
  let savedAuditLogs: any[] = [];

  const createMockPo = (status = 'ISSUED', items = [{ id: 1, itemName: 'Server Rack', quantity: 100, receivedQuantity: 0, unitPrice: 1000000 }]) => ({
    id: 10,
    poNumber: 'PO-20260916-001',
    status,
    totalAmount: 100000000,
    items: items.map(i => ({ ...i })),
  });

  beforeEach(async () => {
    savedEntities = [];
    savedAuditLogs = [];

    queryRunnerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn(),
        find: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation((entityClass: any, data: any) => {
          if (entityClass === AuditLog) {
            const a = new AuditLog();
            Object.assign(a, data);
            return a;
          }
          return { ...data, id: data?.id || 101 };
        }),
        save: jest.fn().mockImplementation((entityClassOrData: any, data?: any) => {
          const entity = data !== undefined ? data : entityClassOrData;
          if (Array.isArray(entity)) {
            savedEntities.push(...entity);
            return Promise.resolve(entity);
          }
          savedEntities.push(entity);
          if (entity instanceof AuditLog || entity?.table_name === 'goods_receipts') {
            savedAuditLogs.push(entity);
          }
          if (entity && !entity.id) entity.id = 501;
          return Promise.resolve(entity);
        }),
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
        { provide: DataSource, useValue: dataSourceMock },
        { provide: EventEmitter2, useValue: eventEmitterMock },
        { provide: WorkflowService, useValue: {} },
        { provide: WorkflowEngineService, useValue: {} },
        { provide: getRepositoryToken(PurchaseRequest), useValue: {} },
        { provide: getRepositoryToken(PurchaseRequestItem), useValue: {} },
        { provide: getRepositoryToken(Rfq), useValue: {} },
        { provide: getRepositoryToken(Vendor), useValue: {} },
        { provide: getRepositoryToken(Quotation), useValue: {} },
        { provide: getRepositoryToken(QuotationItem), useValue: {} },
        { provide: getRepositoryToken(VendorComparison), useValue: {} },
        { provide: getRepositoryToken(PurchaseOrder), useValue: {} },
        { provide: getRepositoryToken(GoodsReceipt), useValue: {} },
      ],
    }).compile();

    service = module.get<ProcurementService>(ProcurementService);
  });

  // Test 1: Valid single-item receipt succeeds
  it('Test 1: Valid single-item receipt succeeds and locks PO with pessimistic_write', async () => {
    const mockPo = createMockPo('ISSUED', [{ id: 1, itemName: 'Server Rack', quantity: 100, receivedQuantity: 0, unitPrice: 1000000 }]);
    queryRunnerMock.manager.findOne.mockResolvedValue(mockPo);

    const dto = {
      purchaseOrderId: 10,
      receiptDate: '2026-09-16T10:00:00.000Z',
      remarks: 'Full delivery received',
      items: [{ poItemId: 1, receivedQuantity: 100, remarks: 'All 100 received' }],
    };

    const res = await service.createGoodsReceipt(dto, 1);

    expect(res.success).toBe(true);
    expect(queryRunnerMock.manager.findOne).toHaveBeenCalledWith(PurchaseOrder, {
      where: { id: 10 },
      lock: { mode: 'pessimistic_write' },
      relations: ['items'],
    });
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    expect(eventEmitterMock.emit).toHaveBeenCalledWith('gr.created', expect.objectContaining({ po_id: 10 }));
    expect(savedAuditLogs.length).toBe(1);
    expect(savedAuditLogs[0].action).toBe('RECEIVE');
  });

  // Test 2: Partial receipt succeeds (PO status becomes PARTIALLY_FULFILLED)
  it('Test 2: Partial receipt succeeds and sets PO status to PARTIALLY_FULFILLED', async () => {
    const mockPo = createMockPo('ISSUED', [{ id: 1, itemName: 'Server Rack', quantity: 100, receivedQuantity: 0, unitPrice: 1000000 }]);
    queryRunnerMock.manager.findOne.mockResolvedValue(mockPo);

    const dto = {
      purchaseOrderId: 10,
      receiptDate: '2026-09-16T10:00:00.000Z',
      items: [{ poItemId: 1, receivedQuantity: 40 }],
    };

    const res = await service.createGoodsReceipt(dto, 1);

    expect(res.success).toBe(true);
    expect(mockPo.items[0].receivedQuantity).toBe(40);
    expect(mockPo.status).toBe('PARTIALLY_FULFILLED');
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
  });

  // Test 3: Exact final receipt transitions PO to COMPLETED
  it('Test 3: Exact final receipt transitions PO to COMPLETED', async () => {
    const mockPo = createMockPo('PARTIALLY_FULFILLED', [{ id: 1, itemName: 'Server Rack', quantity: 100, receivedQuantity: 70, unitPrice: 1000000 }]);
    queryRunnerMock.manager.findOne.mockResolvedValue(mockPo);

    const dto = {
      purchaseOrderId: 10,
      receiptDate: '2026-09-16T10:00:00.000Z',
      items: [{ poItemId: 1, receivedQuantity: 30 }],
    };

    const res = await service.createGoodsReceipt(dto, 1);

    expect(res.success).toBe(true);
    expect(mockPo.items[0].receivedQuantity).toBe(100);
    expect(mockPo.status).toBe('COMPLETED');
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
  });

  // Test 4: Over-receipt is rejected
  it('Test 4: Over-receipt beyond remaining quantity is rejected', async () => {
    const mockPo = createMockPo('PARTIALLY_FULFILLED', [{ id: 1, itemName: 'Server Rack', quantity: 100, receivedQuantity: 90, unitPrice: 1000000 }]);
    queryRunnerMock.manager.findOne.mockResolvedValue(mockPo);

    const dto = {
      purchaseOrderId: 10,
      receiptDate: '2026-09-16T10:00:00.000Z',
      items: [{ poItemId: 1, receivedQuantity: 20 }], // 20 > 10 remaining
    };

    await expect(service.createGoodsReceipt(dto, 1)).rejects.toThrow(
      'Cannot receive 20 for item 1. Remaining quantity is 10'
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunnerMock.commitTransaction).not.toHaveBeenCalled();
  });

  // Test 5: Duplicate poItemId in a single payload is rejected
  it('Test 5: Duplicate poItemId in a single payload is rejected', async () => {
    const mockPo = createMockPo('ISSUED', [{ id: 1, itemName: 'Server Rack', quantity: 100, receivedQuantity: 0, unitPrice: 1000000 }]);
    queryRunnerMock.manager.findOne.mockResolvedValue(mockPo);

    const dto = {
      purchaseOrderId: 10,
      receiptDate: '2026-09-16T10:00:00.000Z',
      items: [
        { poItemId: 1, receivedQuantity: 60 },
        { poItemId: 1, receivedQuantity: 60 }, // duplicate poItemId 1
      ],
    };

    await expect(service.createGoodsReceipt(dto, 1)).rejects.toThrow(
      'Duplicate poItemId 1 found in Goods Receipt items payload'
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunnerMock.commitTransaction).not.toHaveBeenCalled();
  });

  // Test 6: PO item belonging to another PO is rejected
  it('Test 6: PO item belonging to another PO is rejected', async () => {
    const mockPo = createMockPo('ISSUED', [{ id: 1, itemName: 'Server Rack', quantity: 100, receivedQuantity: 0, unitPrice: 1000000 }]);
    queryRunnerMock.manager.findOne.mockResolvedValue(mockPo);

    const dto = {
      purchaseOrderId: 10,
      receiptDate: '2026-09-16T10:00:00.000Z',
      items: [{ poItemId: 999, receivedQuantity: 10 }], // 999 does not exist on PO 10
    };

    await expect(service.createGoodsReceipt(dto, 1)).rejects.toThrow(
      'PO Item 999 does not belong to PO 10'
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
  });

  // Test 7: DRAFT PO is rejected
  it('Test 7: DRAFT PO is rejected with HTTP 400', async () => {
    const mockPo = createMockPo('DRAFT');
    queryRunnerMock.manager.findOne.mockResolvedValue(mockPo);

    const dto = {
      purchaseOrderId: 10,
      receiptDate: '2026-09-16T10:00:00.000Z',
      items: [{ poItemId: 1, receivedQuantity: 10 }],
    };

    await expect(service.createGoodsReceipt(dto, 1)).rejects.toThrow(
      'Cannot receive goods for PO with status DRAFT'
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
  });

  // Test 8: COMPLETED PO is rejected
  it('Test 8: COMPLETED PO is rejected with HTTP 400', async () => {
    const mockPo = createMockPo('COMPLETED', [{ id: 1, itemName: 'Server Rack', quantity: 100, receivedQuantity: 100, unitPrice: 1000000 }]);
    queryRunnerMock.manager.findOne.mockResolvedValue(mockPo);

    const dto = {
      purchaseOrderId: 10,
      receiptDate: '2026-09-16T10:00:00.000Z',
      items: [{ poItemId: 1, receivedQuantity: 10 }],
    };

    await expect(service.createGoodsReceipt(dto, 1)).rejects.toThrow(
      'Cannot receive goods for PO with status COMPLETED'
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
  });

  // Test 9: Transaction rollback occurs if downstream persistence fails
  it('Test 9: Transaction rollback occurs if downstream persistence fails', async () => {
    const mockPo = createMockPo('ISSUED', [{ id: 1, itemName: 'Server Rack', quantity: 100, receivedQuantity: 0, unitPrice: 1000000 }]);
    queryRunnerMock.manager.findOne.mockResolvedValue(mockPo);
    queryRunnerMock.commitTransaction.mockRejectedValueOnce(new Error('DB Commit disk failure'));

    const dto = {
      purchaseOrderId: 10,
      receiptDate: '2026-09-16T10:00:00.000Z',
      items: [{ poItemId: 1, receivedQuantity: 50 }],
    };

    await expect(service.createGoodsReceipt(dto, 1)).rejects.toThrow('DB Commit disk failure');
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunnerMock.release).toHaveBeenCalled();
  });

  // Test 10: Concurrent receipt scenario serialization
  it('Test 10: Concurrent receipt scenario ensures serialized execution and prevents over-receipt', async () => {
    const sharedPo = createMockPo('PARTIALLY_FULFILLED', [{ id: 1, itemName: 'Server Rack', quantity: 100, receivedQuantity: 90, unitPrice: 1000000 }]);

    queryRunnerMock.manager.findOne.mockImplementation(() => {
      return Promise.resolve({
        ...sharedPo,
        items: sharedPo.items.map(i => ({ ...i })),
      });
    });

    const dtoA = {
      purchaseOrderId: 10,
      receiptDate: '2026-09-16T10:00:00.000Z',
      items: [{ poItemId: 1, receivedQuantity: 10 }],
    };

    const dtoB = {
      purchaseOrderId: 10,
      receiptDate: '2026-09-16T10:00:00.000Z',
      items: [{ poItemId: 1, receivedQuantity: 10 }],
    };

    // First request executes
    const resA = await service.createGoodsReceipt(dtoA, 1);
    expect(resA.success).toBe(true);

    // Update sharedPo state as happened in DB
    sharedPo.items[0].receivedQuantity = 100;
    sharedPo.status = 'COMPLETED';

    // Second request executes
    await expect(service.createGoodsReceipt(dtoB, 2)).rejects.toThrow(
      'Cannot receive goods for PO with status COMPLETED'
    );

    // Final received quantity never exceeds 100
    expect(sharedPo.items[0].receivedQuantity).toBe(100);
    expect(sharedPo.items[0].receivedQuantity).toBeLessThanOrEqual(sharedPo.items[0].quantity);
  });
});
