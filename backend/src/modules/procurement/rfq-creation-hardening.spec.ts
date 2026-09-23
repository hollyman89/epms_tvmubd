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
import { CreateRfqDto } from './dto/create-rfq.dto';
import { ProcurementPackageService } from './procurement-package.service';
import { ProcurementReconciliationService } from './procurement-reconciliation.service';

describe('P7.2 Part B: RFQ Creation Hardening Spec (P72-B01 to P72-B10)', () => {
  let service: ProcurementService;
  let controller: ProcurementController;
  let prRepoMock: any;
  let rfqRepoMock: any;
  let queryRunnerMock: any;
  let dataSourceMock: any;
  let savedEntities: any[];

  beforeEach(async () => {
    savedEntities = [];

    queryRunnerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        query: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation((entityClass, data) => ({ ...data })),
        save: jest.fn().mockImplementation((entityClass, data) => {
          const entity = data || entityClass;
          const saved = { id: 101, ...entity };
          savedEntities.push({ entityClass, entity: saved });
          return Promise.resolve(saved);
        }),
      },
    };

    prRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    rfqRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
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
        { provide: getRepositoryToken(Vendor), useValue: {} },
        { provide: getRepositoryToken(Quotation), useValue: {} },
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

  const validApprovedPr = {
    id: 1,
    prNumber: 'PR-20260901-001',
    status: 'APPROVED',
    projectId: 10,
    project: { id: 10, name: 'Project Apex' },
    items: [{ id: 1, itemName: 'Server Blade' }],
  };

  const createRfqDto: CreateRfqDto = {
    purchaseRequestId: 1,
    closingDate: '2026-10-15T00:00:00.000Z',
  };

  // P72-B01: RFQ creation succeeds for APPROVED PR with valid project
  it('P72-B01: RFQ creation succeeds for APPROVED PR with valid project', async () => {
    prRepoMock.findOne.mockResolvedValue(validApprovedPr);
    rfqRepoMock.findOne.mockResolvedValue(null);

    const result = await service.createRfq(createRfqDto, 42);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.status).toBe('OPEN');
    expect(result.data.prId).toBe(1);
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    expect(queryRunnerMock.rollbackTransaction).not.toHaveBeenCalled();
  });

  // P72-B02: RFQ creation rejected when PR = SUBMITTED
  it('P72-B02: RFQ creation rejected when PR = SUBMITTED', async () => {
    prRepoMock.findOne.mockResolvedValue({
      ...validApprovedPr,
      status: 'SUBMITTED',
    });

    await expect(service.createRfq(createRfqDto, 42)).rejects.toThrow(
      'Hanya Purchase Request dengan status APPROVED yang dapat diterbitkan menjadi RFQ. Status saat ini: SUBMITTED',
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
  });

  // P72-B03: RFQ creation rejected when PR = DIRECTOR_APPROVAL
  it('P72-B03: RFQ creation rejected when PR = DIRECTOR_APPROVAL', async () => {
    prRepoMock.findOne.mockResolvedValue({
      ...validApprovedPr,
      status: 'DIRECTOR_APPROVAL',
    });

    await expect(service.createRfq(createRfqDto, 42)).rejects.toThrow(
      'Hanya Purchase Request dengan status APPROVED yang dapat diterbitkan menjadi RFQ. Status saat ini: DIRECTOR_APPROVAL',
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
  });

  // P72-B04: RFQ creation rejected when PR = REJECTED_TO_PROCUREMENT
  it('P72-B04: RFQ creation rejected when PR = REJECTED_TO_PROCUREMENT', async () => {
    prRepoMock.findOne.mockResolvedValue({
      ...validApprovedPr,
      status: 'REJECTED_TO_PROCUREMENT',
    });

    await expect(service.createRfq(createRfqDto, 42)).rejects.toThrow(
      'Hanya Purchase Request dengan status APPROVED yang dapat diterbitkan menjadi RFQ. Status saat ini: REJECTED_TO_PROCUREMENT',
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
  });

  // P72-B05: RFQ creation rejected when PR does not exist
  it('P72-B05: RFQ creation rejected when PR does not exist', async () => {
    prRepoMock.findOne.mockResolvedValue(null);

    await expect(service.createRfq(createRfqDto, 42)).rejects.toThrow('Purchase Request tidak ditemukan');
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
  });

  // P72-B06: RFQ creation rejected when PR has no valid project relation
  it('P72-B06: RFQ creation rejected when PR has no valid project relation', async () => {
    prRepoMock.findOne.mockResolvedValue({
      ...validApprovedPr,
      projectId: null,
      project: null,
    });

    await expect(service.createRfq(createRfqDto, 42)).rejects.toThrow(
      'Purchase Request tidak memiliki relasi project yang valid',
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
  });

  // P72-B07: Duplicate OPEN RFQ for the same PR is rejected
  it('P72-B07: Duplicate OPEN RFQ for the same PR is rejected', async () => {
    prRepoMock.findOne.mockResolvedValue(validApprovedPr);
    rfqRepoMock.findOne.mockResolvedValue({
      id: 99,
      rfqNumber: 'RFQ-20260916-001',
      prId: 1,
      status: 'OPEN',
    });

    await expect(service.createRfq(createRfqDto, 42)).rejects.toThrow(
      'Purchase Request #PR-20260901-001 sudah memiliki RFQ aktif (RFQ-20260916-001)',
    );
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
  });

  // P72-B08: Existing RFQ number generation remains unchanged
  it('P72-B08: Existing RFQ number generation produces canonical RFQ-YYYYMMDD-SEQ format', async () => {
    prRepoMock.findOne.mockResolvedValue(validApprovedPr);
    rfqRepoMock.findOne.mockResolvedValue(null);
    queryRunnerMock.manager.count.mockResolvedValue(4); // 4 today -> seq 005

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const result = await service.createRfq(createRfqDto, 42);

    expect(result.data.rfqNumber).toBe(`RFQ-${dateStr}-005`);
  });

  // P72-B09: Audit log is still created for successful RFQ creation
  it('P72-B09: Audit log is created in the same transaction manager for successful RFQ creation', async () => {
    prRepoMock.findOne.mockResolvedValue(validApprovedPr);
    rfqRepoMock.findOne.mockResolvedValue(null);

    await service.createRfq(createRfqDto, 77);

    const auditSave = savedEntities.find(s => s.entityClass === AuditLog || s.entity.table_name === 'rfqs');
    expect(auditSave).toBeDefined();
    expect(auditSave.entity.action).toBe('CREATE');
    expect(auditSave.entity.table_name).toBe('rfqs');
    expect(auditSave.entity.created_by).toBe(77);
    expect(auditSave.entity.new_value.status).toBe('OPEN');
    expect(auditSave.entity.new_value.prId).toBe(1);
  });

  // P72-B10: Transaction rollback leaves no RFQ artifact when creation fails
  it('P72-B10: Transaction rollback is called and release executed if save fails', async () => {
    prRepoMock.findOne.mockResolvedValue(validApprovedPr);
    rfqRepoMock.findOne.mockResolvedValue(null);
    queryRunnerMock.manager.save.mockRejectedValueOnce(new Error('Disk write failure'));

    await expect(service.createRfq(createRfqDto, 42)).rejects.toThrow('Disk write failure');
    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunnerMock.release).toHaveBeenCalled();
  });
});
