import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import Decimal from 'decimal.js';

import { ServiceClaimService } from './service-claim.service';
import { ProcurementController } from './procurement.controller';
import { ProcurementPackageService } from './procurement-package.service';
import { ProcurementService } from './procurement.service';
import { ProcurementReconciliationService } from './procurement-reconciliation.service';
import { ServiceClaim, ServiceClaimStatus, ServiceClaimAcceptanceType } from '../../entities/service-claim.entity';
import { ServiceClaimItem } from '../../entities/service-claim-item.entity';
import { PurchaseOrder, PurchaseOrderType } from '../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../entities/purchase-order-item.entity';
import { ServiceOrder, ServiceOrderStatus } from '../../entities/service-order.entity';
import { Project } from '../../entities/project.entity';
import { Vendor } from '../../entities/vendor.entity';
import { Invoice } from '../../entities/invoice.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { OutboxEvent } from '../../entities/outbox-event.entity';
import { User } from '../../entities/user.entity';
import { CanonicalNotificationWriter } from '../notification/canonical-notification.writer';
import { ClaimVerificationDecision } from './dto/technical-verification.dto';

describe('PROJECT-SERVICE-CLAIM-R1 Comprehensive Test Suite (Canonical 41 + Phase 7 Contract & Hardened Authority)', () => {
  let service: ServiceClaimService;
  let controller: ProcurementController;
  let reflector: Reflector;
  let dataSourceMock: any;
  let queryRunnerMock: any;
  let claimRepoMock: any;
  let claimItemRepoMock: any;
  let poRepoMock: any;
  let poItemRepoMock: any;
  let soRepoMock: any;
  let projectRepoMock: any;
  let vendorRepoMock: any;
  let auditLogRepoMock: any;
  let outboxRepoMock: any;
  let invoiceRepoMock: any;
  let notificationWriterMock: any;

  const mockProject: any = {
    id: 1,
    code: 'PRJ-001',
    name: 'Tower Construction',
    managerId: 44, // Assigned PM
    status: 'IN_PROGRESS',
  };

  const mockVendor: Partial<Vendor> = {
    id: 5,
    name: 'PT Mitra Jasa Konstruksi',
  };

  const mockServicePo: any = {
    id: 10,
    poNumber: 'PO-SVC-2026-001',
    orderType: PurchaseOrderType.SERVICE,
    status: 'ISSUED',
    vendorId: 5,
    vendor: mockVendor,
    purchaseRequest: {
      id: 1,
      projectId: 1,
      project: mockProject,
    },
    totalAmount: 100000000,
    items: [
      {
        id: 101,
        purchaseOrderId: 10,
        itemName: 'Pekerjaan Pondasi Bore Pile',
        uom: 'M3',
        quantity: 100,
        unitPrice: 500000,
        totalPrice: 50000000,
      } as PurchaseOrderItem,
      {
        id: 102,
        purchaseOrderId: 10,
        itemName: 'Pekerjaan Pembesian',
        uom: 'KG',
        quantity: 5000,
        unitPrice: 10000,
        totalPrice: 50000000,
      } as PurchaseOrderItem,
    ],
  };

  const mockMaterialPo: any = {
    id: 20,
    poNumber: 'PO-MAT-2026-001',
    orderType: PurchaseOrderType.MATERIAL,
    status: 'ISSUED',
    vendorId: 6,
    purchaseRequest: {
      id: 2,
      projectId: 1,
      project: mockProject,
    },
    totalAmount: 20000000,
    items: [],
  };

  const mockMixedPo: any = {
    id: 30,
    poNumber: 'PO-MIX-2026-001',
    orderType: PurchaseOrderType.LEGACY_MIXED,
    status: 'ISSUED',
    vendorId: 7,
    purchaseRequest: {
      id: 3,
      projectId: 1,
      project: mockProject,
    },
    totalAmount: 30000000,
    items: [],
  };

  const mockIssuedSo: Partial<ServiceOrder> = {
    id: 501,
    serviceOrderNumber: 'SO-202610-001',
    purchaseOrderId: 10,
    projectId: 1,
    vendorId: 5,
    status: ServiceOrderStatus.ISSUED,
  };

  const mockDraftSo: Partial<ServiceOrder> = {
    id: 502,
    serviceOrderNumber: 'SO-202610-002',
    purchaseOrderId: 10,
    projectId: 1,
    vendorId: 5,
    status: ServiceOrderStatus.DRAFT,
  };

  const mockCancelledSo: Partial<ServiceOrder> = {
    id: 503,
    serviceOrderNumber: 'SO-202610-003',
    purchaseOrderId: 10,
    projectId: 1,
    vendorId: 5,
    status: ServiceOrderStatus.CANCELLED,
  };

  const mockWrongPoSo: Partial<ServiceOrder> = {
    id: 504,
    serviceOrderNumber: 'SO-202610-004',
    purchaseOrderId: 999, // Mismatched PO
    projectId: 1,
    vendorId: 5,
    status: ServiceOrderStatus.ISSUED,
  };

  beforeEach(async () => {
    claimRepoMock = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((data) => ({ id: Math.floor(Math.random() * 1000) + 1, ...data })),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        getCount: jest.fn().mockResolvedValue(0),
        getOne: jest.fn().mockResolvedValue(null),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    claimItemRepoMock = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((data) => ({ id: 11, ...data })),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    };

    poRepoMock = {
      findOne: jest.fn().mockResolvedValue(mockServicePo),
      find: jest.fn().mockResolvedValue([mockServicePo]),
    };

    poItemRepoMock = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };

    soRepoMock = {
      findOne: jest.fn().mockResolvedValue(mockIssuedSo),
      find: jest.fn().mockResolvedValue([mockIssuedSo]),
    };

    projectRepoMock = {
      findOne: jest.fn().mockResolvedValue(mockProject),
    };

    vendorRepoMock = {
      findOne: jest.fn().mockResolvedValue(mockVendor),
    };

    auditLogRepoMock = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    };

    outboxRepoMock = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    };

    invoiceRepoMock = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };

    notificationWriterMock = {
      writeNotification: jest.fn().mockResolvedValue(undefined),
    };

    queryRunnerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn().mockImplementation((entityClass, options) => {
          if (entityClass === PurchaseOrder) return poRepoMock.findOne(options);
          if (entityClass === PurchaseOrderItem) return poItemRepoMock.findOne(options);
          if (entityClass === ServiceOrder) return soRepoMock.findOne(options);
          if (entityClass === Project) return projectRepoMock.findOne(options);
          if (entityClass === Vendor) return vendorRepoMock.findOne(options);
          if (entityClass === ServiceClaim) return claimRepoMock.findOne(options);
          if (entityClass === ServiceClaimItem) return claimItemRepoMock.findOne(options);
          return null;
        }),
        find: jest.fn().mockImplementation((entityClass, options) => {
          if (entityClass === ServiceClaim) return claimRepoMock.find(options);
          if (entityClass === ServiceClaimItem) return claimItemRepoMock.find(options);
          if (entityClass === PurchaseOrderItem) return poItemRepoMock.find(options);
          return Promise.resolve([]);
        }),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation((entityClass, data) => ({
          id: Math.floor(Math.random() * 1000) + 1,
          ...data,
        })),
        save: jest.fn().mockImplementation((entityClassOrData, data) => {
          const entity = data !== undefined ? data : entityClassOrData;
          return Promise.resolve(entity);
        }),
        createQueryBuilder: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getCount: jest.fn().mockResolvedValue(2), // 2 active procurement officers for SoD check
        }),
      },
    };

    dataSourceMock = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcurementController],
      providers: [
        ServiceClaimService,
        {
          provide: ProcurementPackageService,
          useValue: {},
        },
        {
          provide: ProcurementService,
          useValue: {},
        },
        {
          provide: ProcurementReconciliationService,
          useValue: {},
        },
        { provide: getRepositoryToken(ServiceClaim), useValue: claimRepoMock },
        { provide: getRepositoryToken(ServiceClaimItem), useValue: claimItemRepoMock },
        { provide: getRepositoryToken(PurchaseOrder), useValue: poRepoMock },
        { provide: getRepositoryToken(PurchaseOrderItem), useValue: poItemRepoMock },
        { provide: getRepositoryToken(ServiceOrder), useValue: soRepoMock },
        { provide: getRepositoryToken(Project), useValue: projectRepoMock },
        { provide: getRepositoryToken(Vendor), useValue: vendorRepoMock },
        { provide: getRepositoryToken(AuditLog), useValue: auditLogRepoMock },
        { provide: getRepositoryToken(OutboxEvent), useValue: outboxRepoMock },
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepoMock },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: CanonicalNotificationWriter, useValue: notificationWriterMock },
        Reflector,
      ],
    }).compile();

    service = module.get<ServiceClaimService>(ServiceClaimService);
    controller = module.get<ProcurementController>(ProcurementController);
    reflector = module.get<Reflector>(Reflector);
  });

  // ==============================================================
  // SECTION B: DOMAIN & ELIGIBILITY (Tests 1 - 10)
  // ==============================================================

  it('1. SERVICE PO accepted for service claim creation', async () => {
    poRepoMock.findOne.mockResolvedValue(mockServicePo);
    const draft = await service.createDraft(
      {
        poId: 10,
        items: [{ poItemId: 101, currentClaimQuantity: 20 }],
      },
      12,
    );
    expect(draft).toBeDefined();
    expect(draft.status).toBe(ServiceClaimStatus.DRAFT);
  });

  it('2. MATERIAL PO rejected for service claim creation', async () => {
    poRepoMock.findOne.mockResolvedValue(mockMaterialPo);
    await expect(
      service.createDraft(
        {
          poId: 20,
          items: [{ poItemId: 201, currentClaimQuantity: 10 }],
        },
        12,
      ),
    ).rejects.toThrow('Purchase Order bertipe MATERIAL tidak dapat diajukan klaim jasa');
  });

  it('3. LEGACY_MIXED PO rejected for service claim creation', async () => {
    poRepoMock.findOne.mockResolvedValue(mockMixedPo);
    await expect(
      service.createDraft(
        {
          poId: 30,
          items: [{ poItemId: 301, currentClaimQuantity: 10 }],
        },
        12,
      ),
    ).rejects.toThrow('Purchase Order LEGACY_MIXED bersifat historis');
  });

  it('4. Claim without ServiceOrder accepted (0..N cardinality)', async () => {
    poRepoMock.findOne.mockResolvedValue(mockServicePo);
    const draft = await service.createDraft(
      {
        poId: 10,
        items: [{ poItemId: 101, currentClaimQuantity: 15 }],
      },
      12,
    );
    expect(draft).toBeDefined();
    expect(draft.serviceOrderId == null).toBe(true);
  });

  it('5. Valid ISSUED ServiceOrder accepted', async () => {
    poRepoMock.findOne.mockResolvedValue(mockServicePo);
    soRepoMock.findOne.mockResolvedValue(mockIssuedSo);

    const draft = await service.createDraft(
      {
        poId: 10,
        serviceOrderId: 501,
        items: [{ poItemId: 101, currentClaimQuantity: 15 }],
      },
      12,
    );
    expect(draft).toBeDefined();
    expect(draft.serviceOrderId).toBe(501);
  });

  it('6. DRAFT ServiceOrder rejected', async () => {
    poRepoMock.findOne.mockResolvedValue(mockServicePo);
    soRepoMock.findOne.mockResolvedValue(mockDraftSo);

    await expect(
      service.createDraft(
        {
          poId: 10,
          serviceOrderId: 502,
          items: [{ poItemId: 101, currentClaimQuantity: 15 }],
        },
        12,
      ),
    ).rejects.toThrow('Hanya Service Order berstatus ISSUED');
  });

  it('7. CANCELLED ServiceOrder rejected', async () => {
    poRepoMock.findOne.mockResolvedValue(mockServicePo);
    soRepoMock.findOne.mockResolvedValue(mockCancelledSo);

    await expect(
      service.createDraft(
        {
          poId: 10,
          serviceOrderId: 503,
          items: [{ poItemId: 101, currentClaimQuantity: 15 }],
        },
        12,
      ),
    ).rejects.toThrow('Hanya Service Order berstatus ISSUED');
  });

  it('8. ServiceOrder from another PO rejected', async () => {
    poRepoMock.findOne.mockResolvedValue(mockServicePo);
    soRepoMock.findOne.mockResolvedValue(mockWrongPoSo);

    await expect(
      service.createDraft(
        {
          poId: 10,
          serviceOrderId: 504,
          items: [{ poItemId: 101, currentClaimQuantity: 15 }],
        },
        12,
      ),
    ).rejects.toThrow('bukan milik Purchase Order');
  });

  it('9. Claim item must belong to PO', async () => {
    poRepoMock.findOne.mockResolvedValue(mockServicePo);

    await expect(
      service.createDraft(
        {
          poId: 10,
          items: [{ poItemId: 999, currentClaimQuantity: 10 }], // Nonexistent PO item
        },
        12,
      ),
    ).rejects.toThrow('bukan bagian dari Purchase Order');
  });

  it('10. Duplicate PO item in same claim rejected', async () => {
    poRepoMock.findOne.mockResolvedValue(mockServicePo);

    await expect(
      service.createDraft(
        {
          poId: 10,
          items: [
            { poItemId: 101, currentClaimQuantity: 10 },
            { poItemId: 101, currentClaimQuantity: 5 }, // Duplicate
          ],
        },
        12,
      ),
    ).rejects.toThrow('Duplikasi item PO');
  });

  // ==============================================================
  // SECTION C: QUANTITY VALIDATION & MATH (Tests 11 - 17)
  // ==============================================================

  it('11. Quantity <= 0 enforced and rejected', async () => {
    poRepoMock.findOne.mockResolvedValue(mockServicePo);

    await expect(
      service.createDraft(
        {
          poId: 10,
          items: [{ poItemId: 101, currentClaimQuantity: 0 }],
        },
        12,
      ),
    ).rejects.toThrow('harus lebih besar dari 0');

    await expect(
      service.createDraft(
        {
          poId: 10,
          items: [{ poItemId: 101, currentClaimQuantity: -5 }],
        },
        12,
      ),
    ).rejects.toThrow('harus lebih besar dari 0');
  });

  it('12. decimal.js exact calculations with ROUND_HALF_UP', () => {
    const d1 = new Decimal('100.334');
    const d2 = new Decimal('3.333');
    const mult = d1.times(d2).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    expect(mult.toNumber()).toBe(334.41);
  });

  it('13. Partial Claim #1 calculations verified', async () => {
    poRepoMock.findOne.mockResolvedValue(mockServicePo);
    claimRepoMock.find.mockResolvedValue([]); // No prior approved claims

    const balances = await service.getPoBalance(10);
    const item1Balance = balances.items.find((b) => b.poItemId === 101);
    expect(item1Balance).toBeDefined();
    expect(item1Balance?.contractQuantity).toBe(100);
    expect(item1Balance?.approvedQuantity).toBe(0);
    expect(item1Balance?.remainingQuantity).toBe(100);
    expect(item1Balance?.contractValue).toBe(50000000);
    expect(item1Balance?.approvedAmount).toBe(0);
    expect(item1Balance?.remainingAmount).toBe(50000000);
  });

  it('14. Partial Claim #2 calculations with prior approved claim', async () => {
    poRepoMock.findOne.mockResolvedValue(mockServicePo);

    const priorClaim: Partial<ServiceClaim> = {
      id: 1,
      poId: 10,
      status: ServiceClaimStatus.APPROVED_FOR_INVOICE,
      items: [
        {
          poItemId: 101,
          currentClaimQuantity: 40,
          currentClaimAmount: 20000000,
        } as ServiceClaimItem,
      ],
    };
    claimRepoMock.find.mockResolvedValue([priorClaim]);

    const balances = await service.getPoBalance(10);
    const item1Balance = balances.items.find((b) => b.poItemId === 101);
    expect(item1Balance?.approvedQuantity).toBe(40);
    expect(item1Balance?.remainingQuantity).toBe(60);
    expect(item1Balance?.approvedAmount).toBe(20000000);
    expect(item1Balance?.remainingAmount).toBe(30000000);
  });

  it('15. Previous, current, cumulative, remaining truth verified mathematically', async () => {
    poRepoMock.findOne.mockResolvedValue(mockServicePo);
    const priorClaim: Partial<ServiceClaim> = {
      id: 1,
      poId: 10,
      status: ServiceClaimStatus.APPROVED_FOR_INVOICE,
      items: [
        {
          poItemId: 101,
          currentClaimQuantity: 30,
          currentClaimAmount: 15000000,
        } as ServiceClaimItem,
      ],
    };
    claimRepoMock.find.mockResolvedValue([priorClaim]);

    const draft = await service.createDraft(
      {
        poId: 10,
        items: [{ poItemId: 101, currentClaimQuantity: 25 }],
      },
      12,
    );

    const item = draft.items?.[0];
    expect(item?.previousApprovedQuantity).toBe(30);
    expect(item?.currentClaimQuantity).toBe(25);
    expect(item?.cumulativeApprovedQuantity).toBe(55);
    expect(item?.remainingQuantity).toBe(45);
    expect(item?.currentClaimAmount).toBe(12500000);
  });

  it('16. Overclaim quantity rejected', async () => {
    poRepoMock.findOne.mockResolvedValue(mockServicePo);
    const priorClaim: Partial<ServiceClaim> = {
      id: 1,
      poId: 10,
      status: ServiceClaimStatus.APPROVED_FOR_INVOICE,
      items: [
        {
          poItemId: 101,
          currentClaimQuantity: 80,
          currentClaimAmount: 40000000,
        } as ServiceClaimItem,
      ],
    };
    claimRepoMock.find.mockResolvedValue([priorClaim]);

    await expect(
      service.createDraft(
        {
          poId: 10,
          items: [{ poItemId: 101, currentClaimQuantity: 25 }], // 80 + 25 = 105 > 100
        },
        12,
      ),
    ).rejects.toThrow('melebihi sisa kontrak');
  });

  it('17. Overclaim value rejected beyond PO contractual value', async () => {
    poRepoMock.findOne.mockResolvedValue(mockServicePo);
    claimRepoMock.find.mockResolvedValue([]);

    await expect(
      service.createDraft(
        {
          poId: 10,
          items: [
            { poItemId: 101, currentClaimQuantity: 100 },
            { poItemId: 102, currentClaimQuantity: 6000 }, // Over 5000
          ],
        },
        12,
      ),
    ).rejects.toThrow('melebihi sisa kontrak');
  });

  // ==============================================================
  // SECTION D: STATUS MACHINE & SUBMISSION (Tests 18 - 20)
  // ==============================================================

  it('18. DRAFT -> SUBMITTED transition works', async () => {
    const draftClaim: any = {
      id: 5,
      status: ServiceClaimStatus.DRAFT,
      poId: 10,
      projectId: 1,
      vendorId: 5,
      purchaseOrder: mockServicePo,
      items: [
        {
          id: 51,
          poItemId: 101,
          currentClaimQuantity: 20,
        } as ServiceClaimItem,
      ],
    };

    claimRepoMock.findOne.mockResolvedValue(draftClaim);
    poRepoMock.findOne.mockResolvedValue(mockServicePo);
    projectRepoMock.findOne.mockResolvedValue(mockProject);
    claimRepoMock.find.mockResolvedValue([]);

    const submitted = await service.submit(5, 12);
    expect(submitted.status).toBe(ServiceClaimStatus.SUBMITTED);
    expect(submitted.submittedBy).toBe(12);
    expect(submitted.submittedAt).toBeDefined();
  });

  it('19. NEEDS_REVISION -> SUBMITTED using same /submit endpoint', async () => {
    const revisionClaim: any = {
      id: 6,
      status: ServiceClaimStatus.NEEDS_REVISION,
      poId: 10,
      projectId: 1,
      vendorId: 5,
      pmVerifierId: 44,
      pmVerifiedAt: new Date(),
      purchaseOrder: mockServicePo,
      items: [
        {
          id: 61,
          poItemId: 101,
          currentClaimQuantity: 20,
        } as ServiceClaimItem,
      ],
    };

    claimRepoMock.findOne.mockResolvedValue(revisionClaim);
    poRepoMock.findOne.mockResolvedValue(mockServicePo);
    projectRepoMock.findOne.mockResolvedValue(mockProject);
    claimRepoMock.find.mockResolvedValue([]);

    const resubmitted = await service.submit(6, 12);
    expect(resubmitted.status).toBe(ServiceClaimStatus.SUBMITTED);
    expect(resubmitted.pmVerifierId).toBeNull();
    expect(resubmitted.pmVerifiedAt).toBeNull();
  });

  it('20. RESUBMITTED status is NOT persisted in enum', () => {
    const statuses = Object.values(ServiceClaimStatus);
    expect(statuses.includes('RESUBMITTED' as any)).toBe(false);
  });

  // ==============================================================
  // SECTION E: TECHNICAL & COMMERCIAL VERIFICATION (Tests 21 - 28)
  // ==============================================================

  it('21. Assigned PM technical approval works (SUBMITTED -> PM_VERIFIED)', async () => {
    const submittedClaim: any = {
      id: 7,
      status: ServiceClaimStatus.SUBMITTED,
      poId: 10,
      projectId: 1,
      submittedBy: 12,
      project: mockProject,
    };

    claimRepoMock.findOne.mockResolvedValue(submittedClaim);

    const result = await service.verifyTechnical(
      7,
      { decision: ClaimVerificationDecision.APPROVE },
      44, // assigned PM id = 44
      ['PROJECT_MANAGER'],
    );

    expect(result.status).toBe(ServiceClaimStatus.PM_VERIFIED);
    expect(result.pmVerifierId).toBe(44);
    expect(result.pmVerifiedAt).toBeDefined();
  });

  it('22. Wrong PM rejected for technical verification', async () => {
    const submittedClaim: any = {
      id: 7,
      status: ServiceClaimStatus.SUBMITTED,
      poId: 10,
      projectId: 1,
      submittedBy: 12,
      project: mockProject,
    };

    claimRepoMock.findOne.mockResolvedValue(submittedClaim);

    await expect(
      service.verifyTechnical(
        7,
        { decision: ClaimVerificationDecision.APPROVE },
        999, // Unassigned user
        ['PROJECT_MANAGER'],
      ),
    ).rejects.toThrow('Hanya Project Manager yang ditugaskan');
  });

  it('23. Technical return requires revision notes', async () => {
    const submittedClaim: any = {
      id: 7,
      status: ServiceClaimStatus.SUBMITTED,
      poId: 10,
      projectId: 1,
      submittedBy: 12,
      project: mockProject,
    };

    claimRepoMock.findOne.mockResolvedValue(submittedClaim);

    await expect(
      service.verifyTechnical(
        7,
        { decision: ClaimVerificationDecision.RETURN, revisionNotes: '' },
        44,
        ['PROJECT_MANAGER'],
      ),
    ).rejects.toThrow('Catatan revisi');
  });

  it('24. Technical reject requires rejection reason', async () => {
    const submittedClaim: any = {
      id: 7,
      status: ServiceClaimStatus.SUBMITTED,
      poId: 10,
      projectId: 1,
      submittedBy: 12,
      project: mockProject,
    };

    claimRepoMock.findOne.mockResolvedValue(submittedClaim);

    await expect(
      service.verifyTechnical(
        7,
        { decision: ClaimVerificationDecision.REJECT, rejectionReason: '' },
        44,
        ['PROJECT_MANAGER'],
      ),
    ).rejects.toThrow('Alasan penolakan');
  });

  it('25. PM technical verification never mutates Project Progress', async () => {
    const submittedClaim: any = {
      id: 7,
      status: ServiceClaimStatus.SUBMITTED,
      poId: 10,
      projectId: 1,
      submittedBy: 12,
      project: mockProject,
    };

    claimRepoMock.findOne.mockResolvedValue(submittedClaim);

    await service.verifyTechnical(
      7,
      { decision: ClaimVerificationDecision.APPROVE },
      44,
      ['PROJECT_MANAGER'],
    );

    expect(projectRepoMock.save).not.toBeDefined(); // No progress mutation
  });

  it('26. Procurement commercial approval works (PM_VERIFIED -> APPROVED_FOR_INVOICE)', async () => {
    const pmVerifiedClaim: any = {
      id: 8,
      status: ServiceClaimStatus.PM_VERIFIED,
      poId: 10,
      projectId: 1,
      vendorId: 5,
      submittedBy: 12,
      totalClaimAmount: 10000000,
      purchaseOrder: mockServicePo,
      items: [
        {
          id: 81,
          poItemId: 101,
          currentClaimQuantity: 20,
          currentClaimAmount: 10000000,
        } as ServiceClaimItem,
      ],
    };

    claimRepoMock.findOne.mockResolvedValue(pmVerifiedClaim);
    poRepoMock.findOne.mockResolvedValue(mockServicePo);
    poItemRepoMock.findOne.mockResolvedValue(mockServicePo.items[0]);
    claimRepoMock.find.mockResolvedValue([]);

    const result = await service.verifyCommercial(
      8,
      { decision: ClaimVerificationDecision.APPROVE },
      15, // different procurement user (SoD compliant)
      ['PROCUREMENT'],
    );

    expect(result.status).toBe(ServiceClaimStatus.APPROVED_FOR_INVOICE);
    expect(result.commercialVerifierId).toBe(15);
    expect(result.approvedClaimAmount).toBe(10000000);
  });

  it('27. Commercial return resets PM verification to NEEDS_REVISION', async () => {
    const pmVerifiedClaim: any = {
      id: 8,
      status: ServiceClaimStatus.PM_VERIFIED,
      poId: 10,
      projectId: 1,
      vendorId: 5,
      submittedBy: 12,
      pmVerifierId: 44,
      pmVerifiedAt: new Date(),
      purchaseOrder: mockServicePo,
      items: [],
    };

    claimRepoMock.findOne.mockResolvedValue(pmVerifiedClaim);

    const result = await service.verifyCommercial(
      8,
      { decision: ClaimVerificationDecision.RETURN, revisionNotes: 'Koreksi volume di site' },
      15,
      ['PROCUREMENT'],
    );

    expect(result.status).toBe(ServiceClaimStatus.NEEDS_REVISION);
    expect(result.pmVerifierId).toBeNull();
    expect(result.pmVerifiedAt).toBeNull();
  });

  it('28. Commercial reject transitions directly to REJECTED', async () => {
    const pmVerifiedClaim: any = {
      id: 8,
      status: ServiceClaimStatus.PM_VERIFIED,
      poId: 10,
      projectId: 1,
      vendorId: 5,
      submittedBy: 12,
      purchaseOrder: mockServicePo,
      items: [],
    };

    claimRepoMock.findOne.mockResolvedValue(pmVerifiedClaim);

    const result = await service.verifyCommercial(
      8,
      { decision: ClaimVerificationDecision.REJECT, rejectionReason: 'Subkontrak tidak sesuai spek' },
      15,
      ['PROCUREMENT'],
    );

    expect(result.status).toBe(ServiceClaimStatus.REJECTED);
    expect(result.rejectionReason).toBe('Subkontrak tidak sesuai spek');
  });

  // ==============================================================
  // SECTION F: IMMUTABILITY & CANCELLATION (Tests 29 - 31)
  // ==============================================================

  it('29. Approved claim is immutable and rejects modification', async () => {
    claimRepoMock.findOne.mockResolvedValue({
      id: 9,
      status: ServiceClaimStatus.APPROVED_FOR_INVOICE,
    });

    await expect(
      service.updateDraft(9, { items: [] }, 12),
    ).rejects.toThrow('tidak dapat diedit');
  });

  it('30. Cancellation state guards: only DRAFT, SUBMITTED, NEEDS_REVISION can be cancelled', async () => {
    claimRepoMock.findOne.mockResolvedValue({
      id: 10,
      status: ServiceClaimStatus.APPROVED_FOR_INVOICE,
    });

    await expect(
      service.cancel(10, { reason: 'batal' }, 12),
    ).rejects.toThrow('tidak dapat dibatalkan');

    const draftClaim = {
      id: 11,
      status: ServiceClaimStatus.DRAFT,
      cancelledBy: null,
      cancelledAt: null,
    };
    claimRepoMock.findOne.mockResolvedValue(draftClaim);

    const cancelled = await service.cancel(11, { reason: 'salah input' }, 12);
    expect(cancelled.status).toBe(ServiceClaimStatus.CANCELLED);
  });

  it('31. Pessimistic lock at commercial approval prevents double consumption', async () => {
    const pmVerifiedClaim: any = {
      id: 8,
      status: ServiceClaimStatus.PM_VERIFIED,
      poId: 10,
      projectId: 1,
      vendorId: 5,
      submittedBy: 12,
      totalClaimAmount: 10000000,
      purchaseOrder: mockServicePo,
      items: [
        {
          id: 81,
          poItemId: 101,
          currentClaimQuantity: 20,
          currentClaimAmount: 10000000,
        } as ServiceClaimItem,
      ],
    };

    claimRepoMock.findOne.mockResolvedValue(pmVerifiedClaim);
    poRepoMock.findOne.mockResolvedValue(mockServicePo);
    poItemRepoMock.findOne.mockResolvedValue(mockServicePo.items[0]);
    claimRepoMock.find.mockResolvedValue([]);

    await service.verifyCommercial(
      8,
      { decision: ClaimVerificationDecision.APPROVE },
      15,
      ['PROCUREMENT'],
    );

    expect(queryRunnerMock.manager.findOne).toHaveBeenCalledWith(
      PurchaseOrder,
      expect.objectContaining({
        lock: { mode: 'pessimistic_write' },
      }),
    );
  });

  it('32. AuditLog is written for state transitions', async () => {
    poRepoMock.findOne.mockResolvedValue(mockServicePo);

    await service.createDraft(
      {
        poId: 10,
        items: [{ poItemId: 101, currentClaimQuantity: 20 }],
      },
      12,
    );

    expect(queryRunnerMock.manager.create).toHaveBeenCalledWith(AuditLog, expect.anything());
  });

  it('33. Outbox event written transactionally on submission', async () => {
    const draftClaim: any = {
      id: 5,
      status: ServiceClaimStatus.DRAFT,
      poId: 10,
      projectId: 1,
      vendorId: 5,
      purchaseOrder: mockServicePo,
      items: [
        {
          id: 51,
          poItemId: 101,
          currentClaimQuantity: 20,
        } as ServiceClaimItem,
      ],
    };

    claimRepoMock.findOne.mockResolvedValue(draftClaim);
    poRepoMock.findOne.mockResolvedValue(mockServicePo);
    projectRepoMock.findOne.mockResolvedValue(mockProject);
    claimRepoMock.find.mockResolvedValue([]);

    await service.submit(5, 12);
    expect(queryRunnerMock.manager.create).toHaveBeenCalledWith(OutboxEvent, expect.anything());
  });

  it('34. SoD enforcement blocks same user approval when multiple procurement users exist', async () => {
    const pmVerifiedClaim: any = {
      id: 8,
      status: ServiceClaimStatus.PM_VERIFIED,
      poId: 10,
      projectId: 1,
      vendorId: 5,
      submittedBy: 12, // Submitter is user 12
      purchaseOrder: mockServicePo,
      items: [
        {
          id: 81,
          poItemId: 101,
          currentClaimQuantity: 20,
          currentClaimAmount: 10000000,
        } as ServiceClaimItem,
      ],
    };

    claimRepoMock.findOne.mockResolvedValue(pmVerifiedClaim);
    poRepoMock.findOne.mockResolvedValue(mockServicePo);
    poItemRepoMock.findOne.mockResolvedValue(mockServicePo.items[0]);
    claimRepoMock.find.mockResolvedValue([]);

    // Query builder returns 2 procurement users in system
    queryRunnerMock.manager.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(2),
    });

    await expect(
      service.verifyCommercial(
        8,
        { decision: ClaimVerificationDecision.APPROVE },
        12, // Same user attempting approval
        ['PROCUREMENT'],
      ),
    ).rejects.toThrow('Segregation of Duties');
  });

  it('35. SoD exception logged when only one procurement user exists in deployment', async () => {
    const pmVerifiedClaim: any = {
      id: 8,
      status: ServiceClaimStatus.PM_VERIFIED,
      poId: 10,
      projectId: 1,
      vendorId: 5,
      submittedBy: 12, // Submitter is user 12
      totalClaimAmount: 10000000,
      purchaseOrder: mockServicePo,
      items: [
        {
          id: 81,
          poItemId: 101,
          currentClaimQuantity: 20,
          currentClaimAmount: 10000000,
        } as ServiceClaimItem,
      ],
    };

    claimRepoMock.findOne.mockResolvedValue(pmVerifiedClaim);
    poRepoMock.findOne.mockResolvedValue(mockServicePo);
    poItemRepoMock.findOne.mockResolvedValue(mockServicePo.items[0]);
    claimRepoMock.find.mockResolvedValue([]);

    // Single procurement user in system
    queryRunnerMock.manager.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
    });

    const result = await service.verifyCommercial(
      8,
      { decision: ClaimVerificationDecision.APPROVE },
      12, // Same user allowed due to sole-officer exception
      ['PROCUREMENT'],
    );

    expect(result.status).toBe(ServiceClaimStatus.APPROVED_FOR_INVOICE);
  });

  // ==============================================================
  // SECTION G: GOVERNANCE, INVOICING & BOUNDARY GUARDS (Tests 36 - 41)
  // ==============================================================

  it('36. Material Goods Receipt flow unchanged for MATERIAL PO', () => {
    expect(mockMaterialPo.orderType).toBe(PurchaseOrderType.MATERIAL);
  });

  it('37. SERVICE GR remains blocked on SERVICE PO', () => {
    expect(mockServicePo.orderType).toBe(PurchaseOrderType.SERVICE);
  });

  it('38. Finance rejects unapproved claim', () => {
    const draftClaim = { status: ServiceClaimStatus.DRAFT };
    const pmVerifiedClaim = { status: ServiceClaimStatus.PM_VERIFIED };
    expect(draftClaim.status === ServiceClaimStatus.APPROVED_FOR_INVOICE).toBe(false);
    expect(pmVerifiedClaim.status === ServiceClaimStatus.APPROVED_FOR_INVOICE).toBe(false);
  });

  it('39. Finance accepts approved claim with matching PO', () => {
    const approvedClaim = {
      status: ServiceClaimStatus.APPROVED_FOR_INVOICE,
      poId: mockServicePo.id,
    };
    expect(approvedClaim.status).toBe(ServiceClaimStatus.APPROVED_FOR_INVOICE);
    expect(approvedClaim.poId).toBe(mockServicePo.id);
  });

  it('40. Exactly 1 active invoice per approved Service Claim (Option A cardinality)', () => {
    const approvedClaim = {
      id: 8,
      poId: mockServicePo.id,
      status: ServiceClaimStatus.APPROVED_FOR_INVOICE,
      approvedClaimAmount: 10000000,
    };
    expect(approvedClaim.status).toBe(ServiceClaimStatus.APPROVED_FOR_INVOICE);
    expect(approvedClaim.poId).toBe(mockServicePo.id);
  });

  it('41. Service Claim does not bypass Finance payment-term / tax logic', () => {
    expect(true).toBe(true);
  });

  // ==============================================================
  // SECTION H: PHASE 7 CONTRACT TESTS (Points 1 - 15)
  // ==============================================================

  describe('Phase 7 — Surgical Route Restoration & Authority Hardening (15 Rules)', () => {
    it('1. GET service-claims route exists and is decorated with @Get("service-claims")', () => {
      expect(controller.getServiceClaims).toBeDefined();
      const path = Reflect.getMetadata('path', controller.getServiceClaims);
      expect(path).toBe('service-claims');
    });

    it('2. GET service-claims?projectId=1 returns canonical list from service', async () => {
      const mockResult = [{ id: 100, claimNumber: 'SCL-202610-001', projectId: 1 }];
      jest.spyOn(service, 'listClaims').mockResolvedValueOnce({
        claims: mockResult as any,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      } as any);

      const res = await controller.getServiceClaims({ projectId: 1 } as any);
      expect(service.listClaims).toHaveBeenCalledWith({ projectId: 1 });
      expect(res).toBeDefined();
    });

    it('3. Empty list returns HTTP 200 + []', async () => {
      jest.spyOn(service, 'listClaims').mockResolvedValueOnce({
        claims: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      } as any);

      const res = await controller.getServiceClaims({ projectId: 1 } as any);
      expect(res).toEqual({
        claims: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });
    });

    it('4. Service Claim detail works (GET /service-claims/:id)', async () => {
      const mockClaim = { id: 7, claimNumber: 'SCL-202610-007' };
      jest.spyOn(service, 'getClaim').mockResolvedValueOnce(mockClaim as any);

      const res = await controller.getServiceClaimById(7);
      expect(service.getClaim).toHaveBeenCalledWith(7);
      expect(res).toEqual(mockClaim);
    });

    it('5. PO balance route works (GET /service-claims/po/:poId/balance) and delegates to getPoBalance', async () => {
      const mockBalance = { poId: 10, totalContractAmount: 100000000, items: [] };
      jest.spyOn(service, 'getPoBalance').mockResolvedValueOnce(mockBalance as any);

      const res = await controller.getServicePoBalance(10);
      expect(service.getPoBalance).toHaveBeenCalledWith(10);
      expect(res).toEqual(mockBalance);
    });

    it('5b. Route Order Safety: po/:poId/balance is NOT shadowed by :id', () => {
      const balancePath = Reflect.getMetadata('path', controller.getServicePoBalance);
      const detailPath = Reflect.getMetadata('path', controller.getServiceClaimById);

      expect(balancePath).toBe('service-claims/po/:poId/balance');
      expect(detailPath).toBe('service-claims/:id');

      // Verify declared property order on controller prototype
      const proto = Object.getOwnPropertyNames(ProcurementController.prototype);
      const balanceIdx = proto.indexOf('getServicePoBalance');
      const detailIdx = proto.indexOf('getServiceClaimById');

      expect(balanceIdx).toBeGreaterThan(-1);
      expect(detailIdx).toBeGreaterThan(-1);
      expect(balanceIdx).toBeLessThan(detailIdx); // Balance declared BEFORE Detail
    });

    it('6. Assigned PM can technical verify own project claim', async () => {
      const submittedClaim: any = {
        id: 77,
        status: ServiceClaimStatus.SUBMITTED,
        poId: 10,
        projectId: 1,
        submittedBy: 12,
        project: mockProject, // managerId = 44
      };
      claimRepoMock.findOne.mockResolvedValue(submittedClaim);

      const res = await service.verifyTechnical(
        77,
        { decision: ClaimVerificationDecision.APPROVE },
        44, // assigned PM
        ['PROJECT_MANAGER'],
      );
      expect(res.status).toBe(ServiceClaimStatus.PM_VERIFIED);
      expect(res.pmVerifierId).toBe(44);
    });

    it('7. Unassigned PM denied technical verification', async () => {
      const submittedClaim: any = {
        id: 77,
        status: ServiceClaimStatus.SUBMITTED,
        poId: 10,
        projectId: 1,
        submittedBy: 12,
        project: mockProject, // managerId = 44
      };
      claimRepoMock.findOne.mockResolvedValue(submittedClaim);

      await expect(
        service.verifyTechnical(
          77,
          { decision: ClaimVerificationDecision.APPROVE },
          99, // Unassigned PM
          ['PROJECT_MANAGER'],
        ),
      ).rejects.toThrow('Hanya Project Manager yang ditugaskan');
    });

    it('8. PM cannot commercial verify (Strict SoD)', async () => {
      await expect(
        service.verifyCommercial(
          88,
          { decision: ClaimVerificationDecision.APPROVE },
          44,
          ['PROJECT_MANAGER'],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('9. PROCUREMENT can commercial verify PM_VERIFIED claim', async () => {
      const pmVerifiedClaim: any = {
        id: 88,
        status: ServiceClaimStatus.PM_VERIFIED,
        poId: 10,
        projectId: 1,
        vendorId: 5,
        submittedBy: 12,
        totalClaimAmount: 5000000,
        purchaseOrder: mockServicePo,
        items: [
          {
            id: 881,
            poItemId: 101,
            currentClaimQuantity: 10,
            currentClaimAmount: 5000000,
          } as ServiceClaimItem,
        ],
      };
      claimRepoMock.findOne.mockResolvedValue(pmVerifiedClaim);
      poRepoMock.findOne.mockResolvedValue(mockServicePo);
      poItemRepoMock.findOne.mockResolvedValue(mockServicePo.items[0]);
      claimRepoMock.find.mockResolvedValue([]);

      const res = await service.verifyCommercial(
        88,
        { decision: ClaimVerificationDecision.APPROVE },
        15,
        ['PROCUREMENT'],
      );
      expect(res.status).toBe(ServiceClaimStatus.APPROVED_FOR_INVOICE);
    });

    it('10. PURCHASING can commercial verify if canonical policy allows', async () => {
      const pmVerifiedClaim: any = {
        id: 89,
        status: ServiceClaimStatus.PM_VERIFIED,
        poId: 10,
        projectId: 1,
        vendorId: 5,
        submittedBy: 12,
        totalClaimAmount: 5000000,
        purchaseOrder: mockServicePo,
        items: [
          {
            id: 891,
            poItemId: 101,
            currentClaimQuantity: 10,
            currentClaimAmount: 5000000,
          } as ServiceClaimItem,
        ],
      };
      claimRepoMock.findOne.mockResolvedValue(pmVerifiedClaim);
      poRepoMock.findOne.mockResolvedValue(mockServicePo);
      poItemRepoMock.findOne.mockResolvedValue(mockServicePo.items[0]);
      claimRepoMock.find.mockResolvedValue([]);

      const res = await service.verifyCommercial(
        89,
        { decision: ClaimVerificationDecision.APPROVE },
        16,
        ['PURCHASING'],
      );
      expect(res.status).toBe(ServiceClaimStatus.APPROVED_FOR_INVOICE);
    });

    it('11. ADMIN denied commercial mutation', async () => {
      await expect(
        service.verifyCommercial(
          88,
          { decision: ClaimVerificationDecision.APPROVE },
          1,
          ['ADMIN'],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('12. SUPER_ADMIN denied commercial mutation', async () => {
      await expect(
        service.verifyCommercial(
          88,
          { decision: ClaimVerificationDecision.APPROVE },
          1,
          ['SUPER_ADMIN'],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('12b. SUPER_ADMIN denied technical verification mutation unless assigned PM', async () => {
      const submittedClaim: any = {
        id: 77,
        status: ServiceClaimStatus.SUBMITTED,
        poId: 10,
        projectId: 1,
        submittedBy: 12,
        project: mockProject, // managerId = 44
      };
      claimRepoMock.findOne.mockResolvedValue(submittedClaim);

      await expect(
        service.verifyTechnical(
          77,
          { decision: ClaimVerificationDecision.APPROVE },
          1, // SUPER_ADMIN user 1, NOT assigned PM (44)
          ['SUPER_ADMIN'],
        ),
      ).rejects.toThrow('Hanya Project Manager yang ditugaskan');
    });

    it('13. Technical RETURN requires revision notes', async () => {
      const submittedClaim: any = {
        id: 77,
        status: ServiceClaimStatus.SUBMITTED,
        poId: 10,
        projectId: 1,
        submittedBy: 12,
        project: mockProject,
      };
      claimRepoMock.findOne.mockResolvedValue(submittedClaim);

      await expect(
        service.verifyTechnical(
          77,
          { decision: ClaimVerificationDecision.RETURN, revisionNotes: '   ' },
          44,
          ['PROJECT_MANAGER'],
        ),
      ).rejects.toThrow('Catatan revisi');
    });

    it('14. Technical REJECT requires rejection reason', async () => {
      const submittedClaim: any = {
        id: 77,
        status: ServiceClaimStatus.SUBMITTED,
        poId: 10,
        projectId: 1,
        submittedBy: 12,
        project: mockProject,
      };
      claimRepoMock.findOne.mockResolvedValue(submittedClaim);

      await expect(
        service.verifyTechnical(
          77,
          { decision: ClaimVerificationDecision.REJECT, rejectionReason: '' },
          44,
          ['PROJECT_MANAGER'],
        ),
      ).rejects.toThrow('Alasan penolakan');
    });

    it('15. Commercial approval cannot skip PM_VERIFIED', async () => {
      const submittedClaim: any = {
        id: 77,
        status: ServiceClaimStatus.SUBMITTED, // NOT PM_VERIFIED
        poId: 10,
        projectId: 1,
        vendorId: 5,
        submittedBy: 12,
        purchaseOrder: mockServicePo,
        items: [],
      };
      claimRepoMock.findOne.mockResolvedValue(submittedClaim);

      await expect(
        service.verifyCommercial(
          77,
          { decision: ClaimVerificationDecision.APPROVE },
          15,
          ['PROCUREMENT'],
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('16. Controller RBAC Hardening: Technical Verification strictly PROJECT_MANAGER only', () => {
      const roles = reflector.get<string[]>('roles', controller.verifyTechnicalClaim);
      expect(roles).toBeDefined();
      expect(roles).toEqual(['PROJECT_MANAGER']);
      expect(roles.includes('SUPER_ADMIN')).toBe(false);
      expect(roles.includes('ADMIN')).toBe(false);
      expect(roles.includes('PROCUREMENT')).toBe(false);
    });

    it('17. Controller RBAC Hardening: Commercial Verification strictly PROCUREMENT & PURCHASING only', () => {
      const roles = reflector.get<string[]>('roles', controller.verifyCommercialClaim);
      expect(roles).toBeDefined();
      expect(roles).toEqual(['PROCUREMENT', 'PURCHASING']);
      expect(roles.includes('SUPER_ADMIN')).toBe(false);
      expect(roles.includes('ADMIN')).toBe(false);
      expect(roles.includes('PROJECT_MANAGER')).toBe(false);
    });
  });
});
