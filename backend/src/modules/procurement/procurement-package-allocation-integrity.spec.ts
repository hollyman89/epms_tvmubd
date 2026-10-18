import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { ProcurementPackageService } from './procurement-package.service';
import { ProcurementPackage, ProcurementPackageStatus } from '../../entities/procurement-package.entity';
import { ProcurementPackageItem } from '../../entities/procurement-package-item.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { PurchaseRequestItem } from '../../entities/purchase-request-item.entity';
import { Project } from '../../entities/project.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { WorkflowDefinition } from '../../entities/workflow-definition.entity';
import { WorkflowInstance } from '../../entities/workflow-instance.entity';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';

describe('EPMS — Procurement Package RAB Allocation Integrity & Closed Package Suite', () => {
  let service: ProcurementPackageService;
  let packageRepoMock: any;
  let packageItemRepoMock: any;
  let prRepoMock: any;
  let prItemRepoMock: any;
  let projectRepoMock: any;
  let costItemRepoMock: any;
  let costEstimateRepoMock: any;
  let workflowDefRepoMock: any;
  let workflowInstRepoMock: any;
  let workflowEngineMock: any;
  let dataSourceMock: any;
  let managerMock: any;

  beforeEach(async () => {
    managerMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      query: jest.fn(),
      save: jest.fn(),
      create: jest.fn((entityClass, data) => data),
    };

    dataSourceMock = {
      manager: managerMock,
      transaction: jest.fn((isolation, callback) => callback(managerMock)),
    };

    packageRepoMock = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    packageItemRepoMock = {
      find: jest.fn(),
      save: jest.fn(),
    };
    prRepoMock = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    prItemRepoMock = {
      find: jest.fn(),
      save: jest.fn(),
    };
    projectRepoMock = {
      findOne: jest.fn(),
    };
    costItemRepoMock = {
      find: jest.fn(),
      findOne: jest.fn(),
    };
    costEstimateRepoMock = {
      findOne: jest.fn(),
    };
    workflowDefRepoMock = {
      findOne: jest.fn(),
    };
    workflowInstRepoMock = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    workflowEngineMock = {
      startWorkflow: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcurementPackageService,
        { provide: getRepositoryToken(ProcurementPackage), useValue: packageRepoMock },
        { provide: getRepositoryToken(ProcurementPackageItem), useValue: packageItemRepoMock },
        { provide: getRepositoryToken(PurchaseRequest), useValue: prRepoMock },
        { provide: getRepositoryToken(PurchaseRequestItem), useValue: prItemRepoMock },
        { provide: getRepositoryToken(Project), useValue: projectRepoMock },
        { provide: getRepositoryToken(CostItem), useValue: costItemRepoMock },
        { provide: getRepositoryToken(ProjectCostEstimate), useValue: costEstimateRepoMock },
        { provide: getRepositoryToken(WorkflowDefinition), useValue: workflowDefRepoMock },
        { provide: getRepositoryToken(WorkflowInstance), useValue: workflowInstRepoMock },
        { provide: WorkflowEngineService, useValue: workflowEngineMock },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<ProcurementPackageService>(ProcurementPackageService);
  });

  // 1. New cost item with no procurement: remaining = baseline
  it('1. should calculate remaining = baseline when cost item has no procurement commitments', async () => {
    const mockCostItem = {
      id: 101,
      itemName: 'Raw Fiber Cable 48 Core',
      quantity: 500,
      subtotal: 50000000,
      uom: 'Meter',
    } as CostItem;

    managerMock.findOne.mockResolvedValueOnce(mockCostItem);
    // Tier 1: reserved
    managerMock.query.mockResolvedValueOnce([{ reserved_qty: 0, reserved_amount: 0 }]);
    // Tier 2: prCommitted
    managerMock.query.mockResolvedValueOnce([{ committed_qty: 0, committed_amount: 0 }]);
    // Tier 3: ordered
    managerMock.query.mockResolvedValueOnce([{ ordered_qty: 0, ordered_amount: 0 }]);
    // Tier 4: received
    managerMock.query.mockResolvedValueOnce([{ received_qty: 0 }]);

    const result = await service.computeCostItemConsumption(101, managerMock);

    expect(result.baselineQty).toBe(500);
    expect(result.totalCommitted).toBe(0);
    expect(result.availableQty).toBe(500);
    expect(result.rawRemainingQty).toBe(500);
  });

  // 2. Partially allocated item: remaining = baseline - committed
  it('2. should calculate remaining = baseline - committed for partially allocated cost item', async () => {
    const mockCostItem = {
      id: 102,
      itemName: 'Steel Pole 9m',
      quantity: 10,
      subtotal: 13750000,
      uom: 'Unit',
    } as CostItem;

    managerMock.findOne.mockResolvedValueOnce(mockCostItem);
    // Tier 1: reserved = 3
    managerMock.query.mockResolvedValueOnce([{ reserved_qty: 3, reserved_amount: 4125000 }]);
    // Tier 2: prCommitted = 2
    managerMock.query.mockResolvedValueOnce([{ committed_qty: 2, committed_amount: 2750000 }]);
    // Tier 3: ordered = 1
    managerMock.query.mockResolvedValueOnce([{ ordered_qty: 1, ordered_amount: 1375000 }]);
    // Tier 4: received = 1
    managerMock.query.mockResolvedValueOnce([{ received_qty: 1 }]);

    const result = await service.computeCostItemConsumption(102, managerMock);

    expect(result.baselineQty).toBe(10);
    expect(result.reservedQty).toBe(3);
    expect(result.prCommittedQty).toBe(2);
    expect(result.orderedQty).toBe(1);
    expect(result.totalCommitted).toBe(6);
    expect(result.availableQty).toBe(4);
    expect(result.rawRemainingQty).toBe(4);
  });

  // 3. CLOSED completed package: allocation remains consumed
  it('3. should ensure CLOSED package allocation remains consumed and available quantity is 0', async () => {
    const mockCostItem = {
      id: 1,
      itemName: 'Supply and Install Pole Accessories',
      quantity: 13,
      subtotal: 975000,
      uom: 'Unit',
    } as CostItem;

    managerMock.findOne.mockResolvedValueOnce(mockCostItem);
    // Package PKG-20261015-001 is CLOSED, completed through PO ordered_qty = 13
    managerMock.query.mockResolvedValueOnce([{ reserved_qty: 0, reserved_amount: 0 }]);
    managerMock.query.mockResolvedValueOnce([{ committed_qty: 0, committed_amount: 0 }]);
    managerMock.query.mockResolvedValueOnce([{ ordered_qty: 13, ordered_amount: 975000 }]);
    managerMock.query.mockResolvedValueOnce([{ received_qty: 13 }]);

    const result = await service.computeCostItemConsumption(1, managerMock);

    expect(result.baselineQty).toBe(13);
    expect(result.orderedQty).toBe(13);
    expect(result.totalCommitted).toBe(13);
    expect(result.availableQty).toBe(0);
    expect(result.rawRemainingQty).toBe(0);
  });

  // 3b. CLOSED package without PO (e.g. direct closed package reservation): allocation remains consumed via Tier 1
  it('3b. should ensure CLOSED package without active PO is preserved in reserved quantity and remains consumed', async () => {
    const mockCostItem = {
      id: 201,
      itemName: 'Direct Closed Allocation Item',
      quantity: 5,
      subtotal: 5000000,
      uom: 'Unit',
    } as CostItem;

    managerMock.findOne.mockResolvedValueOnce(mockCostItem);
    // Preserved via closed package subquery in Tier 1
    managerMock.query.mockResolvedValueOnce([{ reserved_qty: 5, reserved_amount: 5000000 }]);
    managerMock.query.mockResolvedValueOnce([{ committed_qty: 0, committed_amount: 0 }]);
    managerMock.query.mockResolvedValueOnce([{ ordered_qty: 0, ordered_amount: 0 }]);
    managerMock.query.mockResolvedValueOnce([{ received_qty: 0 }]);

    const result = await service.computeCostItemConsumption(201, managerMock);

    expect(result.baselineQty).toBe(5);
    expect(result.reservedQty).toBe(5);
    expect(result.totalCommitted).toBe(5);
    expect(result.availableQty).toBe(0);
  });

  // 4. CANCELLED package: release only if canonical rule says so
  it('4. should release quantity when package status is CANCELLED (does not consume RAB)', async () => {
    const mockCostItem = {
      id: 104,
      itemName: 'Cancelled Order Hardware',
      quantity: 20,
      subtotal: 20000000,
      uom: 'Unit',
    } as CostItem;

    managerMock.findOne.mockResolvedValueOnce(mockCostItem);
    // Cancelled package is excluded by query (pkg.status IN ('SUBMITTED') or CLOSED without PO)
    managerMock.query.mockResolvedValueOnce([{ reserved_qty: 0, reserved_amount: 0 }]);
    managerMock.query.mockResolvedValueOnce([{ committed_qty: 0, committed_amount: 0 }]);
    managerMock.query.mockResolvedValueOnce([{ ordered_qty: 0, ordered_amount: 0 }]);
    managerMock.query.mockResolvedValueOnce([{ received_qty: 0 }]);

    const result = await service.computeCostItemConsumption(104, managerMock);

    expect(result.baselineQty).toBe(20);
    expect(result.totalCommitted).toBe(0);
    expect(result.availableQty).toBe(20);
  });

  // 5. Multiple packages: commitments aggregate correctly
  it('5. should aggregate commitments correctly across multiple packages at different lifecycle stages', async () => {
    const mockCostItem = {
      id: 105,
      itemName: 'Fiber Joint Closure',
      quantity: 50,
      subtotal: 25000000,
      uom: 'Unit',
    } as CostItem;

    managerMock.findOne.mockResolvedValueOnce(mockCostItem);
    // Package A (SUBMITTED) = 10, Package B (PR approved) = 15, Package C (PO issued/closed) = 20
    managerMock.query.mockResolvedValueOnce([{ reserved_qty: 10, reserved_amount: 5000000 }]);
    managerMock.query.mockResolvedValueOnce([{ committed_qty: 15, committed_amount: 7500000 }]);
    managerMock.query.mockResolvedValueOnce([{ ordered_qty: 20, ordered_amount: 10000000 }]);
    managerMock.query.mockResolvedValueOnce([{ received_qty: 20 }]);

    const result = await service.computeCostItemConsumption(105, managerMock);

    expect(result.baselineQty).toBe(50);
    expect(result.reservedQty).toBe(10);
    expect(result.prCommittedQty).toBe(15);
    expect(result.orderedQty).toBe(20);
    expect(result.totalCommitted).toBe(45);
    expect(result.availableQty).toBe(5);
  });

  // 6. Remaining = 0: cannot create another allocation
  it('6. should reject package draft creation when remaining available quantity is 0', async () => {
    const mockProject = {
      id: 1,
      status: 'IN_PROGRESS',
      managerId: 44,
    } as Project;

    const mockRab = {
      id: 1,
      projectId: 1,
      status: 'APPROVED',
      version: 1,
    } as ProjectCostEstimate;

    const mockCostItem = {
      id: 1,
      estimateId: 1,
      itemName: 'Supply and Install Pole Accessories',
      categoryKey: 'MATERIAL',
      entryMode: 'ITEMIZED',
      quantity: 13,
      unitPrice: 75000,
      subtotal: 975000,
      uom: 'Unit',
      estimate: { projectId: 1 },
    } as any;

    managerMock.findOne.mockImplementation((entity: any) => {
      if (entity === Project) return Promise.resolve(mockProject);
      if (entity === ProjectCostEstimate) return Promise.resolve(mockRab);
      if (entity === CostItem) return Promise.resolve(mockCostItem);
      return Promise.resolve(null);
    });

    managerMock.find.mockImplementation((entity: any) => {
      if (entity === CostItem) return Promise.resolve([mockCostItem]);
      return Promise.resolve([]);
    });

    // Mock consumption: baseline 13, ordered 13 -> available 0
    managerMock.query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT id FROM cost_items WHERE id IN (?)')) {
        return Promise.resolve([{ id: 1 }]);
      }
      if (sql.includes('reserved_qty')) {
        return Promise.resolve([{ reserved_qty: 0, reserved_amount: 0 }]);
      }
      if (sql.includes('committed_qty')) {
        return Promise.resolve([{ committed_qty: 0, committed_amount: 0 }]);
      }
      if (sql.includes('ordered_qty')) {
        return Promise.resolve([{ ordered_qty: 13, ordered_amount: 975000 }]);
      }
      if (sql.includes('received_qty')) {
        return Promise.resolve([{ received_qty: 13 }]);
      }
      return Promise.resolve([]);
    });

    await expect(
      service.createDraft(44, ['PROJECT_MANAGER'], {
        projectId: 1,
        title: 'New Procurement Package Attempt',
        items: [{ costItemId: 1, requestedQty: 1 }],
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.createDraft(44, ['PROJECT_MANAGER'], {
        projectId: 1,
        title: 'New Procurement Package Attempt',
        items: [{ costItemId: 1, requestedQty: 1 }],
      }),
    ).rejects.toThrow(/Alokasi kuota untuk item 'Supply and Install Pole Accessories' terlampaui/);
  });

  // 7. Backend blocks over-allocation independent of frontend
  it('7. should strictly block over-allocation at backend level even if requested qty exceeds fractional remaining', async () => {
    const mockProject = {
      id: 1,
      status: 'IN_PROGRESS',
      managerId: 44,
    } as Project;

    const mockRab = {
      id: 1,
      projectId: 1,
      status: 'APPROVED',
      version: 1,
    } as ProjectCostEstimate;

    const mockCostItem = {
      id: 2,
      estimateId: 1,
      itemName: 'Supply Steel pole 9 meter',
      categoryKey: 'MATERIAL',
      entryMode: 'ITEMIZED',
      quantity: 2,
      unitPrice: 1375000,
      subtotal: 2750000,
      uom: 'Unit',
      estimate: { projectId: 1 },
    } as any;

    managerMock.findOne.mockImplementation((entity: any) => {
      if (entity === Project) return Promise.resolve(mockProject);
      if (entity === ProjectCostEstimate) return Promise.resolve(mockRab);
      if (entity === CostItem) return Promise.resolve(mockCostItem);
      return Promise.resolve(null);
    });

    managerMock.find.mockImplementation((entity: any) => {
      if (entity === CostItem) return Promise.resolve([mockCostItem]);
      return Promise.resolve([]);
    });

    // Mock consumption: baseline 2, ordered 1 -> available 1. Attempt to request 1.5 units
    managerMock.query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT id FROM cost_items WHERE id IN (?)')) {
        return Promise.resolve([{ id: 2 }]);
      }
      if (sql.includes('reserved_qty')) {
        return Promise.resolve([{ reserved_qty: 0, reserved_amount: 0 }]);
      }
      if (sql.includes('committed_qty')) {
        return Promise.resolve([{ committed_qty: 0, committed_amount: 0 }]);
      }
      if (sql.includes('ordered_qty')) {
        return Promise.resolve([{ ordered_qty: 1, ordered_amount: 1375000 }]);
      }
      if (sql.includes('received_qty')) {
        return Promise.resolve([{ received_qty: 1 }]);
      }
      return Promise.resolve([]);
    });

    await expect(
      service.createDraft(44, ['PROJECT_MANAGER'], {
        projectId: 1,
        title: 'Over-allocation Package Attempt',
        items: [{ costItemId: 2, requestedQty: 1.5 }],
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.createDraft(44, ['PROJECT_MANAGER'], {
        projectId: 1,
        title: 'Over-allocation Package Attempt',
        items: [{ costItemId: 2, requestedQty: 1.5 }],
      }),
    ).rejects.toThrow(/Sisa Kuota: 1 Unit, Diajukan: 1.5 Unit/);
  });
});
