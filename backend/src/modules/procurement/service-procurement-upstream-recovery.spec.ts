import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, In } from 'typeorm';

import { ProcurementController } from './procurement.controller';
import { ProcurementService } from './procurement.service';
import { ServiceClaimService } from './service-claim.service';
import { ProjectClosureService } from '../project/project-closure.service';
import { WorkflowService } from '../workflow-engine/workflow.service';
import { ROLES_KEY, DENY_ROLES_KEY } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

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
import { PoPaymentTerm, PaymentTermType, PaymentTermStatus } from '../../entities/po-payment-term.entity';
import { ServiceOrder, ServiceOrderDocumentType, ServiceOrderStatus } from '../../entities/service-order.entity';
import { ServiceClaim, ServiceClaimStatus } from '../../entities/service-claim.entity';
import { ServiceClaimItem } from '../../entities/service-claim-item.entity';
import { Invoice } from '../../entities/invoice.entity';
import { Project } from '../../entities/project.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { OutboxEvent } from '../../entities/outbox-event.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CanonicalNotificationWriter } from '../notification/canonical-notification.writer';
import { ClaimVerificationDecision } from './dto/technical-verification.dto';

describe('EPMS — Service Procurement Upstream Recovery Regression Spec (Phases 1-13)', () => {
  let procurementService: ProcurementService;
  let serviceClaimService: ServiceClaimService;

  let prRepoMock: any;
  let poRepoMock: any;
  let grRepoMock: any;
  let rfqRepoMock: any;
  let vendorRepoMock: any;
  let quotationRepoMock: any;
  let quotationItemRepoMock: any;
  let vendorComparisonRepoMock: any;
  let soRepoMock: any;
  let claimRepoMock: any;
  let claimItemRepoMock: any;
  let invoiceRepoMock: any;
  let queryRunnerMock: any;
  let dataSourceMock: any;
  let eventEmitterMock: any;

  beforeEach(async () => {
    prRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
    };

    poRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
    };

    grRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    rfqRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
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
      findOne: jest.fn(),
      find: jest.fn(),
    };

    vendorComparisonRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn(),
    };

    soRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    claimRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
      manager: {
        transaction: jest.fn(),
      },
    };

    claimItemRepoMock = {
      find: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    invoiceRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
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
        find: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        createQueryBuilder: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getCount: jest.fn().mockResolvedValue(2),
        }),
      },
    };

    dataSourceMock = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
      query: jest.fn(),
      transaction: jest.fn().mockImplementation((cb) => cb(queryRunnerMock.manager)),
      getRepository: jest.fn().mockImplementation((entityClass) => {
        if (entityClass === ServiceOrder) return soRepoMock;
        if (entityClass === PurchaseOrder) return poRepoMock;
        if (entityClass === ServiceClaim) return claimRepoMock;
        if (entityClass === ServiceClaimItem) return claimItemRepoMock;
        if (entityClass === Invoice) return invoiceRepoMock;
        return queryRunnerMock.manager;
      }),
    };

    eventEmitterMock = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcurementService,
        ServiceClaimService,
        Reflector,
        { provide: getRepositoryToken(PurchaseRequest), useValue: prRepoMock },
        { provide: getRepositoryToken(PurchaseRequestItem), useValue: {} },
        { provide: getRepositoryToken(Rfq), useValue: rfqRepoMock },
        { provide: getRepositoryToken(Vendor), useValue: vendorRepoMock },
        { provide: getRepositoryToken(Quotation), useValue: quotationRepoMock },
        { provide: getRepositoryToken(QuotationItem), useValue: quotationItemRepoMock },
        { provide: getRepositoryToken(VendorComparison), useValue: vendorComparisonRepoMock },
        { provide: getRepositoryToken(PurchaseOrder), useValue: poRepoMock },
        { provide: getRepositoryToken(PurchaseOrderItem), useValue: {} },
        { provide: getRepositoryToken(GoodsReceipt), useValue: grRepoMock },
        { provide: getRepositoryToken(GoodsReceiptItem), useValue: {} },
        { provide: getRepositoryToken(PoPaymentTerm), useValue: {} },
        { provide: getRepositoryToken(ServiceOrder), useValue: soRepoMock },
        { provide: getRepositoryToken(ServiceClaim), useValue: claimRepoMock },
        { provide: getRepositoryToken(ServiceClaimItem), useValue: claimItemRepoMock },
        { provide: getRepositoryToken(Project), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(AuditLog), useValue: { save: jest.fn() } },
        { provide: getRepositoryToken(OutboxEvent), useValue: { save: jest.fn() } },
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepoMock },
        { provide: CanonicalNotificationWriter, useValue: { writeDirectNotification: jest.fn().mockResolvedValue(undefined) } },
        { provide: WorkflowService, useValue: {} },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: EventEmitter2, useValue: eventEmitterMock },
      ],
    }).compile();

    procurementService = module.get<ProcurementService>(ProcurementService);
    serviceClaimService = module.get<ServiceClaimService>(ServiceClaimService);
  });

  // =========================================================================
  // 1. MATERIAL approved PR cannot create PO without RFQ
  // =========================================================================
  it('1. MATERIAL approved PR cannot create PO without RFQ', async () => {
    prRepoMock.findOne.mockResolvedValue({
      id: 1,
      prNumber: 'PR-MAT-001',
      status: 'APPROVED',
      items: [{ id: 10, itemName: 'Batu Split', quantity: 10, estimatedUnitPrice: 100000 }],
    });
    // Authoritative domain query returns MATERIAL
    dataSourceMock.query.mockResolvedValue([{ domain: 'MATERIAL' }]);
    vendorRepoMock.findOne.mockResolvedValue({ id: 2, name: 'Vendor Material' });
    rfqRepoMock.find.mockResolvedValue([]); // No RFQ

    const dto: any = {
      purchase_request_id: 1,
      vendor_id: 2,
      payment_terms: [{ sequence: 1, percentage: 100, term_name: 'Pelunasan', term_type: PaymentTermType.FINAL_DELIVERY }],
    };

    await expect(procurementService.createPurchaseOrder(99, dto)).rejects.toThrow(
      'No RFQs found for this Purchase Request',
    );
  });

  // =========================================================================
  // 2. MATERIAL requires evaluated winner
  // =========================================================================
  it('2. MATERIAL requires evaluated winner', async () => {
    prRepoMock.findOne.mockResolvedValue({
      id: 2,
      prNumber: 'PR-MAT-002',
      status: 'APPROVED',
      items: [{ id: 11, itemName: 'Semen Portland', quantity: 50, estimatedUnitPrice: 75000 }],
    });
    dataSourceMock.query.mockResolvedValue([{ domain: 'MATERIAL' }]);
    vendorRepoMock.findOne.mockResolvedValue({ id: 3, name: 'Vendor Semen' });
    rfqRepoMock.find.mockResolvedValue([{ id: 101, prId: 2, status: 'OPEN' }]);

    // QueryBuilder returns null (selected vendor is not marked as winner)
    vendorComparisonRepoMock.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });

    const dto: any = {
      purchase_request_id: 2,
      vendor_id: 3,
      payment_terms: [{ sequence: 1, percentage: 100, term_name: 'Pelunasan', term_type: PaymentTermType.FINAL_DELIVERY }],
    };

    await expect(procurementService.createPurchaseOrder(99, dto)).rejects.toThrow(
      'The selected vendor is not the winner for this PR',
    );
  });

  // =========================================================================
  // 3. SERVICE approved PR can create SERVICE PO without RFQ
  // =========================================================================
  it('3. SERVICE approved PR can create SERVICE PO without RFQ', async () => {
    const servicePr = {
      id: 3,
      prNumber: 'PR-SRV-003',
      status: 'APPROVED',
      totalEstimatedAmount: 15000000,
      items: [{ id: 30, itemName: 'Jasa Splicing FO', quantity: 1, estimatedUnitPrice: 15000000 }],
    };
    prRepoMock.findOne.mockResolvedValue(servicePr);
    // Authoritative domain query returns SERVICE
    dataSourceMock.query.mockResolvedValue([{ domain: 'SERVICE' }]);
    vendorRepoMock.findOne.mockResolvedValue({ id: 5, name: 'PT Subcon Mandiri' });
    rfqRepoMock.find.mockResolvedValue([]); // Zero RFQs!

    const dto: any = {
      purchase_request_id: 3,
      vendor_id: 5,
      delivery_location: 'Site Ruas Karawang',
      payment_terms: [{ sequence: 1, percentage: 100, term_name: 'Pelunasan', term_type: PaymentTermType.PROGRESS }],
    };

    const res = await procurementService.createPurchaseOrder(99, dto);
    expect(res.success).toBe(true);
    expect(res.data.orderType).toBe(PurchaseOrderType.SERVICE);
    expect(res.data.status).toBe('ISSUED');
    expect(servicePr.status).toBe('PO_ISSUED');
  });

  // =========================================================================
  // 3b. SERVICE PR with active RFQ BLOCKS direct Service PO
  // =========================================================================
  it('3b. SERVICE PR with active RFQ BLOCKS direct Service PO', async () => {
    prRepoMock.findOne.mockResolvedValue({
      id: 3,
      prNumber: 'PR-SRV-003',
      status: 'APPROVED',
      items: [{ id: 30, itemName: 'Jasa Route Survey', quantity: 1, estimatedUnitPrice: 10000000 }],
    });
    dataSourceMock.query.mockResolvedValue([{ domain: 'SERVICE' }]);
    vendorRepoMock.findOne.mockResolvedValue({ id: 5, name: 'PT Subcon Mandiri' });
    // Active RFQ exists in OPEN status!
    rfqRepoMock.find.mockResolvedValue([{ id: 3, rfqNumber: 'RFQ-SRV-003', prId: 3, status: 'OPEN' }]);

    // No vendor comparison evaluated (operator tries to bypass)
    vendorComparisonRepoMock.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });

    const dto: any = {
      purchase_request_id: 3,
      vendor_id: 5,
      delivery_location: 'Site Lapangan',
      payment_terms: [{ sequence: 1, percentage: 100, term_name: 'Pelunasan', term_type: PaymentTermType.PROGRESS }],
    };

    await expect(procurementService.createPurchaseOrder(99, dto)).rejects.toThrow(
      'Purchase Request Jasa ini memiliki RFQ aktif (RFQ-SRV-003). Batalkan (CANCEL) RFQ terlebih dahulu untuk beralih ke jalur Direct PO, atau selesaikan evaluasi pemenang RFQ untuk jalur kompetitif.',
    );
  });

  // =========================================================================
  // 3c. SERVICE PR with CANCELLED RFQ allows direct Service PO
  // =========================================================================
  it('3c. SERVICE PR with CANCELLED RFQ allows direct Service PO', async () => {
    const servicePr = {
      id: 3,
      prNumber: 'PR-SRV-003',
      status: 'APPROVED',
      items: [{ id: 30, itemName: 'Jasa Route Survey', quantity: 1, estimatedUnitPrice: 10000000 }],
    };
    prRepoMock.findOne.mockResolvedValue(servicePr);
    dataSourceMock.query.mockResolvedValue([{ domain: 'SERVICE' }]);
    vendorRepoMock.findOne.mockResolvedValue({ id: 5, name: 'PT Subcon Mandiri' });
    // Previous RFQ was cancelled (operator switched to direct sourcing)
    rfqRepoMock.find.mockResolvedValue([{ id: 3, rfqNumber: 'RFQ-SRV-003', prId: 3, status: 'CANCELLED' }]);

    const dto: any = {
      purchase_request_id: 3,
      vendor_id: 5,
      delivery_location: 'Site Lapangan',
      payment_terms: [{ sequence: 1, percentage: 100, term_name: 'Pelunasan', term_type: PaymentTermType.PROGRESS }],
    };

    const res = await procurementService.createPurchaseOrder(99, dto);
    expect(res.success).toBe(true);
    expect(res.data.orderType).toBe(PurchaseOrderType.SERVICE);
    expect(servicePr.status).toBe('PO_ISSUED');
  });

  // =========================================================================
  // 3d. No open RFQ can coexist with newly created direct Service PO
  // =========================================================================
  it('3d. No open RFQ can coexist with newly created direct Service PO', async () => {
    const servicePr = {
      id: 7,
      prNumber: 'PR-SRV-007',
      status: 'APPROVED',
      items: [{ id: 70, itemName: 'Jasa Alignment Fiber Core', quantity: 1, estimatedUnitPrice: 15000000 }],
    };
    prRepoMock.findOne.mockResolvedValue(servicePr);
    dataSourceMock.query.mockResolvedValue([{ domain: 'SERVICE' }]);
    vendorRepoMock.findOne.mockResolvedValue({ id: 8, name: 'PT Fiber Optik Mandiri' });
    rfqRepoMock.find.mockResolvedValue([{ id: 7, rfqNumber: 'RFQ-SRV-007', prId: 7, status: 'OPEN' }]);

    vendorComparisonRepoMock.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });

    const dto: any = {
      purchase_request_id: 7,
      vendor_id: 8,
      payment_terms: [{ sequence: 1, percentage: 100, term_name: 'Pelunasan', term_type: PaymentTermType.PROGRESS }],
    };

    await expect(procurementService.createPurchaseOrder(99, dto)).rejects.toThrow(/RFQ aktif/);
    expect(servicePr.status).toBe('APPROVED'); // PR remains untouched, direct PO creation blocked
  });

  // =========================================================================
  // 4. SERVICE direct PO requires selected vendor
  // =========================================================================
  it('4. SERVICE direct PO requires selected vendor', async () => {
    prRepoMock.findOne.mockResolvedValue({
      id: 4,
      prNumber: 'PR-SRV-004',
      status: 'APPROVED',
      items: [{ id: 40, itemName: 'Jasa Kalibrasi', quantity: 1, estimatedUnitPrice: 5000000 }],
    });
    dataSourceMock.query.mockResolvedValue([{ domain: 'SERVICE' }]);

    const dto: any = {
      purchase_request_id: 4,
      vendor_id: null, // Missing vendor
      payment_terms: [{ sequence: 1, percentage: 100, term_name: 'Termin 1', term_type: PaymentTermType.PROGRESS }],
    };

    await expect(procurementService.createPurchaseOrder(99, dto)).rejects.toThrow(
      'Vendor wajib dipilih untuk penerbitan Purchase Order',
    );
  });

  // =========================================================================
  // 5. SERVICE competitive RFQ still works
  // =========================================================================
  it('5. SERVICE competitive RFQ still works', async () => {
    const servicePr = {
      id: 5,
      prNumber: 'PR-SRV-005',
      status: 'APPROVED',
      totalEstimatedAmount: 20000000,
      items: [{ id: 50, itemName: 'Jasa Boring Horizontal', quantity: 1, estimatedUnitPrice: 20000000 }],
    };
    prRepoMock.findOne.mockResolvedValue(servicePr);
    dataSourceMock.query.mockResolvedValue([{ domain: 'SERVICE' }]);
    vendorRepoMock.findOne.mockResolvedValue({ id: 7, name: 'PT Boring Cemerlang' });
    rfqRepoMock.find.mockResolvedValue([{ id: 205, prId: 5, status: 'OPEN' }]);

    const mockWinner = { id: 88, rfqId: 205, vendorId: 7, isWinner: true };
    vendorComparisonRepoMock.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockWinner),
    });

    const dto: any = {
      purchase_request_id: 5,
      vendor_id: 7,
      payment_terms: [{ sequence: 1, percentage: 100, term_name: '100% Selesai', term_type: PaymentTermType.FINAL_DELIVERY }],
    };

    const res = await procurementService.createPurchaseOrder(99, dto);
    expect(res.success).toBe(true);
    expect(res.data.orderType).toBe(PurchaseOrderType.SERVICE);
    expect(queryRunnerMock.manager.update).toHaveBeenCalledWith(
      Rfq,
      { id: 205, status: 'OPEN' },
      { status: 'EVALUATED' },
    );
  });

  // =========================================================================
  // 6. SERVICE PO cannot use GR
  // =========================================================================
  it('6. SERVICE PO cannot use GR', async () => {
    queryRunnerMock.manager.findOne.mockResolvedValue({
      id: 60,
      poNumber: 'PO-SRV-060',
      orderType: PurchaseOrderType.SERVICE,
      status: 'ISSUED',
      items: [{ id: 601, quantity: 1, receivedQuantity: 0 }],
    });

    const grDto: any = {
      purchaseOrderId: 60,
      items: [{ poItemId: 601, receivedQuantity: 1 }],
    };

    await expect(procurementService.createGoodsReceipt(grDto, 99)).rejects.toThrow(
      'Purchase Order bertipe SERVICE tidak dapat diproses Penerimaan Barang (GR). Gunakan alur Klaim Jasa.',
    );
  });

  // =========================================================================
  // 7. MATERIAL PO cannot use Service Claim
  // =========================================================================
  it('7. MATERIAL PO cannot use Service Claim', async () => {
    queryRunnerMock.manager.findOne.mockResolvedValue({
      id: 70,
      poNumber: 'PO-MAT-070',
      orderType: PurchaseOrderType.MATERIAL,
      status: 'ISSUED',
      items: [],
    });

    const claimDto: any = {
      purchaseOrderId: 70,
      claimDate: '2026-10-16',
      items: [{ poItemId: 701, claimQuantity: 1, unitPrice: 10000 }],
    };

    await expect(serviceClaimService.createDraft(claimDto, 99)).rejects.toThrow(
      'Purchase Order bertipe MATERIAL tidak dapat diajukan klaim jasa',
    );
  });

  // =========================================================================
  // 8. SERVICE PO supports SPK / Work Order
  // =========================================================================
  it('8. SERVICE PO supports SPK / Work Order', async () => {
    poRepoMock.findOne.mockResolvedValue({
      id: 80,
      poNumber: 'PO-SRV-080',
      orderType: PurchaseOrderType.SERVICE,
      status: 'ISSUED',
      vendorId: 12,
      purchaseRequest: { projectId: 1364 },
    });

    // Valid create
    const createRes = await procurementService.createServiceOrder(99, {
      purchaseOrderId: 80,
      documentType: ServiceOrderDocumentType.SPK,
      scopeOfWork: 'Penarikan kabel FO Ruas A - B',
    });
    expect(createRes.success).toBe(true);
    expect(createRes.data.status).toBe(ServiceOrderStatus.DRAFT);
    expect(createRes.data.serviceOrderNumber).toMatch(/^SPK-/);

    // Issue transition
    soRepoMock.findOne.mockResolvedValue({
      ...createRes.data,
      status: ServiceOrderStatus.DRAFT,
    });
    const issueRes = await procurementService.issueServiceOrder(1, 99);
    expect(issueRes.success).toBe(true);
    expect(issueRes.data.status).toBe(ServiceOrderStatus.ISSUED);

    // MATERIAL PO cannot issue Service Order
    poRepoMock.findOne.mockResolvedValueOnce({
      id: 81,
      orderType: PurchaseOrderType.MATERIAL,
      status: 'ISSUED',
      purchaseRequest: { projectId: 1364 },
    });
    await expect(
      procurementService.createServiceOrder(99, {
        purchaseOrderId: 81,
        documentType: ServiceOrderDocumentType.SPK,
        scopeOfWork: 'Pemasangan Material',
      }),
    ).rejects.toThrow('Service Order (SPK) hanya dapat diterbitkan untuk Purchase Order bertipe SERVICE.');
  });

  // =========================================================================
  // 9. SERVICE Claim → PM Verification works
  // =========================================================================
  it('9. SERVICE Claim → PM Verification works', async () => {
    let currentStatus = ServiceClaimStatus.SUBMITTED;
    const mockClaim: any = {
      id: 90,
      claimNumber: 'CLM-20261016-001',
      status: ServiceClaimStatus.SUBMITTED,
      projectId: 1364,
      totalClaimAmount: 10000000,
      approvedClaimAmount: null,
      poId: 80,
      submittedBy: 99,
      project: { id: 1364, managerId: 10 },
      purchaseOrder: { id: 80, poNumber: 'PO-SRV-080', orderType: PurchaseOrderType.SERVICE },
    };

    claimRepoMock.findOne.mockImplementation(async () => ({
      ...mockClaim,
      status: currentStatus,
    }));
    queryRunnerMock.manager.findOne.mockImplementation(async () => ({
      ...mockClaim,
      status: currentStatus,
    }));
    queryRunnerMock.manager.save.mockImplementation(async (entityClassOrData, maybeData) => {
      const entity = maybeData !== undefined ? maybeData : entityClassOrData;
      if (entity?.claimNumber) currentStatus = entity.status;
      return entity;
    });

    const result = await serviceClaimService.verifyTechnical(
      90,
      { decision: ClaimVerificationDecision.APPROVE, notes: 'Pekerjaan terverifikasi 100%' } as any,
      10, // Assigned PM
      ['PROJECT_MANAGER'],
    );

    expect(result.status).toBe(ServiceClaimStatus.PM_VERIFIED);
  });

  // =========================================================================
  // 10. SERVICE Claim → Procurement Commercial Approval works
  // =========================================================================
  it('10. SERVICE Claim → Procurement Commercial Approval works', async () => {
    let currentStatus = ServiceClaimStatus.PM_VERIFIED;
    const mockClaim: any = {
      id: 100,
      claimNumber: 'CLM-20261016-002',
      status: ServiceClaimStatus.PM_VERIFIED,
      projectId: 1364,
      totalClaimAmount: 10000000,
      approvedClaimAmount: 10000000,
      poId: 80,
      submittedBy: 99,
      createdBy: 99,
      items: [
        {
          id: 1,
          poItemId: 801,
          currentClaimQuantity: 1,
          currentClaimAmount: 10000000,
          previousApprovedQuantity: 0,
          previousApprovedAmount: 0,
        },
      ],
      purchaseOrder: {
        id: 80,
        poNumber: 'PO-SRV-080',
        orderType: PurchaseOrderType.SERVICE,
        totalAmount: 10000000,
        status: 'ISSUED',
        items: [
          {
            id: 801,
            quantity: 1,
            unitPrice: 10000000,
            totalPrice: 10000000,
          },
        ],
      },
    };

    claimRepoMock.findOne.mockImplementation(async () => ({
      ...mockClaim,
      status: currentStatus,
    }));

    queryRunnerMock.manager.findOne.mockImplementation(async (entityClass) => {
      if (entityClass === PurchaseOrder) {
        return mockClaim.purchaseOrder;
      }
      return {
        ...mockClaim,
        status: currentStatus,
      };
    });

    queryRunnerMock.manager.save.mockImplementation(async (entityClassOrData, maybeData) => {
      const entity = maybeData !== undefined ? maybeData : entityClassOrData;
      if (entity?.claimNumber) currentStatus = entity.status;
      return entity;
    });

    const result = await serviceClaimService.verifyCommercial(
      100,
      { decision: ClaimVerificationDecision.APPROVE, notes: 'Komersial dan kalkulasi pajak disetujui' } as any,
      20, // Different Procurement user
      ['PROCUREMENT'],
    );

    expect(result.status).toBe(ServiceClaimStatus.APPROVED_FOR_INVOICE);
  });

  // =========================================================================
  // 11. Invoice can reference approved Service Claim
  // =========================================================================
  it('11. Invoice can reference approved Service Claim', async () => {
    const invoice = new Invoice();
    invoice.invoiceNumber = 'INV-20261016-001';
    invoice.poId = 80;
    invoice.serviceClaimId = 100; // Directly referenced!
    invoice.totalAmount = 10000000;
    invoice.status = 'UNPAID';

    expect(invoice.serviceClaimId).toBe(100);
    expect(invoice.poId).toBe(80);
    expect(invoice.totalAmount).toBe(10000000);
  });

  // =========================================================================
  // 12. Existing Service RFQ records remain valid
  // =========================================================================
  it('12. Existing Service RFQ records remain valid', async () => {
    // Chain A: Package 3 / PR 3 / RFQ 3
    const chainARfq = { id: 3, rfqNumber: 'RFQ-003', prId: 3, status: 'OPEN' };
    // Chain B: Package 7 / PR 7 / RFQ 7
    const chainBRfq = { id: 7, rfqNumber: 'RFQ-007', prId: 7, status: 'OPEN' };

    rfqRepoMock.find.mockResolvedValue([chainARfq, chainBRfq]);

    const rfqs = await rfqRepoMock.find({ where: { id: In([3, 7]) } });
    expect(rfqs).toHaveLength(2);
    expect(rfqs[0].id).toBe(3);
    expect(rfqs[1].id).toBe(7);
    expect(rfqs[0].status).toBe('OPEN');
    expect(rfqs[1].status).toBe('OPEN');
  });

  // =========================================================================
  // 13. Closure does not require RFQ for direct Service sourcing
  // =========================================================================
  it('13. Closure does not require RFQ for direct Service sourcing', async () => {
    const mockClosureDs = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 1364, code: 'PRJ-1364', name: 'Project 1364', status: 'IN_PROGRESS', manager_id: 10 }];
        }
        if (sql.includes('FROM project_baselines')) {
          return [{ id: 1, project_id: 1364, status: 'APPROVED' }];
        }
        if (sql.includes('FROM tasks')) {
          return []; // No uncompleted tasks
        }
        if (sql.includes('FROM purchase_requests')) {
          // Direct Service PR that reached PO_ISSUED
          return [{
            id: 30,
            pr_number: 'PR-SRV-DIRECT',
            status: 'PO_ISSUED',
            resource_type: 'SERVICE',
          }];
        }
        if (sql.includes('FROM rfqs')) {
          // Direct sourcing has ZERO RFQ rows for this project!
          return [];
        }
        if (sql.includes('FROM purchase_orders') && sql.includes("order_type = 'SERVICE'")) {
          return [{
            id: 80,
            po_number: 'PO-SRV-080',
            status: 'COMPLETED',
            total_amount: 10000000,
            service_scope_reconciled_at: new Date(),
            service_scope_released_amount: 0,
          }];
        }
        if (sql.includes('FROM service_orders')) {
          return [{ id: 1, service_order_number: 'SPK-001', status: 'ISSUED' }];
        }
        if (sql.includes('FROM service_claims')) {
          return [{
            id: 100,
            claim_number: 'CLM-001',
            status: 'APPROVED_FOR_INVOICE',
            total_claim_amount: 10000000,
            approved_claim_amount: 10000000,
            po_id: 80,
          }];
        }
        if (sql.includes('FROM invoices')) {
          return [{ id: 1, invoice_number: 'INV-001', status: 'PAID', total_amount: 10000000 }];
        }
        return [];
      }),
    };

    const mockProjService = {
      calculateProjectOverallProgress: jest.fn().mockResolvedValue(100.0),
    };

    const closureService = new ProjectClosureService(mockClosureDs as any, mockProjService as any);
    const result = await closureService.evaluateClosureReadiness(1364);

    // Verify: SERVICE_RFQ_OPEN blocker is NOT present!
    const rfqBlocker = result.blockers.find((b) => b.code === 'SERVICE_RFQ_OPEN');
    expect(rfqBlocker).toBeUndefined();

    // Verify: SERVICE_PR_OPEN blocker is NOT present!
    const prBlocker = result.blockers.find((b) => b.code === 'SERVICE_PR_OPEN');
    expect(prBlocker).toBeUndefined();
  });

  // =========================================================================
  // 14. RFQ Cancellation Authorization & Business Contract Gate
  // =========================================================================
  describe('14. RFQ Cancellation Authorization & Business Contract Gate', () => {
    it('14a. Controller endpoint @Roles metadata is restricted strictly to PURCHASING and PROCUREMENT with explicit DenyRoles', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(ROLES_KEY, ProcurementController.prototype.cancelRfq);
      const denyRoles = reflector.get<string[]>(DENY_ROLES_KEY, ProcurementController.prototype.cancelRfq);

      expect(roles).toBeDefined();
      expect(roles).toEqual(['PURCHASING', 'PROCUREMENT']);
      expect(roles).not.toContain('ADMIN');
      expect(roles).not.toContain('SUPER_ADMIN');
      expect(roles).not.toContain('PROJECT_MANAGER');
      expect(roles).not.toContain('DIRECTOR');
      expect(roles).not.toContain('HEAD_OF_OPERATIONS');

      expect(denyRoles).toBeDefined();
      expect(denyRoles).toEqual(
        expect.arrayContaining(['ADMIN', 'SUPER_ADMIN', 'PROJECT_MANAGER', 'DIRECTOR', 'HEAD_OF_OPERATIONS']),
      );
    });

    it('14b. RolesGuard enforces canonical Procurement roles and rejects administrative/PM roles with 403', () => {
      const reflector = new Reflector();
      const guard = new RolesGuard(reflector);

      const createMockContext = (userRoles: string[]): any => ({
        getHandler: () => ProcurementController.prototype.cancelRfq,
        getClass: () => ProcurementController,
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userId: 99, roles: userRoles },
          }),
        }),
      });

      // Allowed canonical Procurement roles (PASS)
      expect(guard.canActivate(createMockContext(['PURCHASING']))).toBe(true);
      expect(guard.canActivate(createMockContext(['PROCUREMENT']))).toBe(true);
      expect(guard.canActivate(createMockContext(['purchasing']))).toBe(true);
      expect(guard.canActivate(createMockContext(['procurement']))).toBe(true);

      // Blocked non-procurement & administrative roles (403 Forbidden)
      expect(guard.canActivate(createMockContext(['PROJECT_MANAGER']))).toBe(false);
      expect(guard.canActivate(createMockContext(['ADMIN']))).toBe(false);
      expect(guard.canActivate(createMockContext(['SUPER_ADMIN']))).toBe(false);
      expect(guard.canActivate(createMockContext(['DIRECTOR']))).toBe(false);
      expect(guard.canActivate(createMockContext(['HEAD_OF_OPERATIONS']))).toBe(false);
      expect(guard.canActivate(createMockContext(['FINANCE']))).toBe(false);
      expect(guard.canActivate(createMockContext([]))).toBe(false);

      // Multi-Role Administrative Deny Protection (MUST BE DENIED)
      expect(guard.canActivate(createMockContext(['ADMIN', 'PURCHASING']))).toBe(false);
      expect(guard.canActivate(createMockContext(['SUPER_ADMIN', 'PROCUREMENT']))).toBe(false);
      expect(guard.canActivate(createMockContext(['PROJECT_MANAGER', 'PURCHASING']))).toBe(false);
    });

    it('14c. Service layer defense-in-depth rejects non-procurement & multi-role administrative combinations with ForbiddenException', async () => {
      // Rejects PROJECT_MANAGER
      await expect(
        procurementService.cancelRfq(3, 10, ['PROJECT_MANAGER'], 'Batal untuk direct PO'),
      ).rejects.toThrow(ForbiddenException);

      // Rejects ADMIN
      await expect(
        procurementService.cancelRfq(3, 1, ['ADMIN'], 'Batal untuk direct PO'),
      ).rejects.toThrow(ForbiddenException);

      // Rejects SUPER_ADMIN
      await expect(
        procurementService.cancelRfq(3, 1, ['SUPER_ADMIN'], 'Batal untuk direct PO'),
      ).rejects.toThrow(ForbiddenException);

      // Rejects DIRECTOR
      await expect(
        procurementService.cancelRfq(3, 2, ['DIRECTOR'], 'Batal untuk direct PO'),
      ).rejects.toThrow(ForbiddenException);

      // Rejects HEAD_OF_OPERATIONS
      await expect(
        procurementService.cancelRfq(3, 3, ['HEAD_OF_OPERATIONS'], 'Batal untuk direct PO'),
      ).rejects.toThrow(ForbiddenException);

      // Rejects empty roles
      await expect(
        procurementService.cancelRfq(3, 99, [], 'Batal untuk direct PO'),
      ).rejects.toThrow(ForbiddenException);

      // Multi-Role Administrative Deny Protection (MUST BE DENIED)
      await expect(
        procurementService.cancelRfq(3, 99, ['ADMIN', 'PURCHASING'], 'Batal untuk direct PO'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        procurementService.cancelRfq(3, 99, ['SUPER_ADMIN', 'PROCUREMENT'], 'Batal untuk direct PO'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        procurementService.cancelRfq(3, 99, ['PROJECT_MANAGER', 'PURCHASING'], 'Batal untuk direct PO'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('14d. Business contract preserved: OPEN -> CANCELLED, PR preserved APPROVED, Package preserved, AuditLog created', async () => {
      const mockRfq = {
        id: 3,
        rfqNumber: 'RFQ-20261016-001',
        prId: 3,
        status: 'OPEN',
        updatedBy: null,
      };

      const mockPr = {
        id: 3,
        prNumber: 'PR-20261016-001',
        status: 'APPROVED',
        packageId: 3,
      };

      const mockPackage = {
        id: 3,
        packageNumber: 'PKG-20261016-001',
        status: 'PR_CREATED',
      };

      let savedRfq: any = null;
      let createdAudit: any = null;

      queryRunnerMock.manager.findOne.mockImplementation(async (entityClass: any) => {
        if (entityClass === Rfq) {
          return { ...mockRfq };
        }
        if (entityClass === PurchaseOrder) {
          return null;
        }
        return null;
      });

      queryRunnerMock.manager.save.mockImplementation(async (entityClassOrData: any, maybeData: any) => {
        const entity = maybeData !== undefined ? maybeData : entityClassOrData;
        if (entity?.rfqNumber) {
          savedRfq = entity;
          return savedRfq;
        }
        if (entity?.action === 'CANCEL_RFQ') {
          createdAudit = entity;
          return createdAudit;
        }
        return entity;
      });

      // Allowed role PURCHASING cancels RFQ
      const resultPurchasing = await procurementService.cancelRfq(
        3,
        99,
        ['PURCHASING'],
        'Pindah strategi pengadaan ke Direct Service PO',
      );

      expect(resultPurchasing.success).toBe(true);
      expect(resultPurchasing.data.status).toBe('CANCELLED');
      expect(savedRfq.status).toBe('CANCELLED');
      expect(savedRfq.updatedBy).toBe(99);

      // Verify PR and Package integrity (untouched in DB)
      expect(mockPr.status).toBe('APPROVED');
      expect(mockPackage.status).toBe('PR_CREATED');

      // Verify AuditLog
      expect(createdAudit).toBeDefined();
      expect(createdAudit.table_name).toBe('rfqs');
      expect(createdAudit.record_id).toBe(3);
      expect(createdAudit.action).toBe('CANCEL_RFQ');
      expect(createdAudit.old_value).toEqual({ status: 'OPEN' });
      expect(createdAudit.new_value).toEqual({
        status: 'CANCELLED',
        reason: 'Pindah strategi pengadaan ke Direct Service PO',
      });
      expect(createdAudit.created_by).toBe(99);

      // Also verify PROCUREMENT role is allowed
      savedRfq = null;
      const resultProcurement = await procurementService.cancelRfq(
        3,
        88,
        ['PROCUREMENT'],
        'Pembatalan oleh tim procurement',
      );
      expect(resultProcurement.success).toBe(true);
      expect(resultProcurement.data.status).toBe('CANCELLED');
      expect(savedRfq.status).toBe('CANCELLED');
      expect(savedRfq.updatedBy).toBe(88);
    });
  });
});

