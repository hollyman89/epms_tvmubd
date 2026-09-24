import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { CostEstimateValidator } from './cost-estimate.validator';
import { Project } from '../../entities/project.entity';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { Task } from '../../entities/task.entity';
import { Contract } from '../../entities/contract.entity';
import { User } from '../../entities/user.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { SaveCostEstimateDto } from './dto/save-cost-estimate.dto';

describe('ProjectService & ProjectController — Cost/RAB Phase R11.1.3-C', () => {
  let service: ProjectService;
  let controller: ProjectController;
  let mockWbsRepo: any;
  let mockProjectRepo: any;
  let mockCostEstimateRepo: any;
  let mockCostItemRepo: any;
  let mockManager: any;

  const mockProject: Partial<Project> = {
    id: 10,
    name: 'Rollout FTTH Jakarta Timur',
    code: 'PRJ-2026-FTTH-01',
    managerId: 1,
  };

  const mockActiveWbsNodes: Partial<WorkBreakdownStructure>[] = [
    {
      id: 101,
      projectId: 10,
      parentWbsId: null as any,
      code: '1.0',
      name: 'Pekerjaan Persiapan',
      level: 1,
      deletedAt: null as any,
    },
    {
      id: 102,
      projectId: 10,
      parentWbsId: 101,
      code: '1.1',
      name: 'Survey & Perizinan',
      level: 2,
      deletedAt: null as any,
    },
    {
      id: 103,
      projectId: 10,
      parentWbsId: null as any,
      code: '2.0',
      name: 'Penggelaran Kabel',
      level: 1,
      deletedAt: null as any,
    },
    {
      id: 104,
      projectId: 10,
      parentWbsId: 103,
      code: '2.1',
      name: 'Penarikan Kabel FO 48C',
      level: 2,
      deletedAt: null as any,
    },
  ];

  let inMemoryEstimates: any[] = [];
  let inMemoryCostItems: any[] = [];
  let nextEstimateId = 501;
  let nextItemId = 1001;

  beforeEach(async () => {
    inMemoryEstimates = [];
    inMemoryCostItems = [];
    nextEstimateId = 501;
    nextItemId = 1001;

    mockManager = {
      findOne: jest.fn().mockImplementation((entityClass, options) => {
        if (entityClass === ProjectCostEstimate) {
          const projId = options?.where?.projectId;
          return inMemoryEstimates.find((e) => e.projectId === projId) || null;
        }
        return null;
      }),
      find: jest.fn().mockImplementation((entityClass, options) => {
        if (entityClass === CostItem) {
          const estId = options?.where?.estimateId;
          return inMemoryCostItems.filter((i) => i.estimateId === estId);
        }
        return [];
      }),
      create: jest.fn().mockImplementation((entityClass, dto) => {
        return { ...dto };
      }),
      save: jest.fn().mockImplementation((entityClass, entity) => {
        if (entityClass === ProjectCostEstimate) {
          if (!entity.id) {
            entity.id = nextEstimateId++;
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            inMemoryEstimates.push(entity);
          } else {
            const idx = inMemoryEstimates.findIndex((e) => e.id === entity.id);
            if (idx >= 0) inMemoryEstimates[idx] = entity;
            else inMemoryEstimates.push(entity);
            entity.updatedAt = new Date();
          }
          return entity;
        }
        if (entityClass === CostItem) {
          if (!entity.id) {
            entity.id = nextItemId++;
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            inMemoryCostItems.push(entity);
          } else {
            const idx = inMemoryCostItems.findIndex((i) => i.id === entity.id);
            if (idx >= 0) inMemoryCostItems[idx] = entity;
            else inMemoryCostItems.push(entity);
            entity.updatedAt = new Date();
          }
          return entity;
        }
        return entity;
      }),
    };

    mockProjectRepo = {
      findOne: jest.fn().mockImplementation((options) => {
        if (options?.where?.id === 10) return mockProject;
        return null;
      }),
    };

    mockWbsRepo = {
      find: jest.fn().mockImplementation((options) => {
        if (options?.where?.projectId === 10) return mockActiveWbsNodes;
        return [];
      }),
    };

    mockCostEstimateRepo = {
      findOne: jest.fn().mockImplementation((options) => {
        const projId = options?.where?.projectId;
        return inMemoryEstimates.find((e) => e.projectId === projId) || null;
      }),
      manager: {
        transaction: jest.fn().mockImplementation(async (callback) => {
          return await callback(mockManager);
        }),
      },
    };

    mockCostItemRepo = {
      find: jest.fn().mockImplementation((options) => {
        const estId = options?.where?.estimateId;
        return inMemoryCostItems.filter((i) => i.estimateId === estId);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        ProjectService,
        CostEstimateValidator,
        { provide: getRepositoryToken(WorkBreakdownStructure), useValue: mockWbsRepo },
        { provide: getRepositoryToken(Task), useValue: {} },
        { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
        { provide: getRepositoryToken(Contract), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(ProjectCostEstimate), useValue: mockCostEstimateRepo },
        { provide: getRepositoryToken(CostItem), useValue: mockCostItemRepo },
        { provide: getRepositoryToken(PurchaseRequest), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    controller = module.get<ProjectController>(ProjectController);
  });

  // CASE 1: GET existing estimate -> 200 canonical data
  it('CASE 1: GET existing estimate should return 200 canonical data with derived totals', async () => {
    // Setup existing estimate and items
    inMemoryEstimates.push({
      id: 501,
      projectId: 10,
      status: 'DRAFT',
      version: 1,
      pmNotes: 'Initial RAB Draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    inMemoryCostItems.push({
      id: 1001,
      estimateId: 501,
      categoryKey: 'MATERIAL',
      entryMode: 'ITEMIZED',
      itemName: 'Kabel FO 48 Core',
      quantity: 10,
      unitPrice: 2500000,
      subtotal: 25000000,
      assignmentScope: 'WBS',
      wbsId: 104,
      deletedAt: null,
    });

    const res = await service.getCostEstimate(10);
    expect(res.id).toBe(501);
    expect(res.projectId).toBe(10);
    expect(res.status).toBe('DRAFT');
    expect(res.directTotal).toBe(25000000);
    expect(res.totalPmEstimate).toBe(25000000);
    expect(res.categories[0].items[0].subtotal).toBe(25000000);
  });

  // CASE 2: GET nonexistent project -> 404
  it('CASE 2: GET nonexistent project should throw NotFoundException', async () => {
    await expect(service.getCostEstimate(999)).rejects.toThrow(NotFoundException);
  });

  // CASE 3: PUT first estimate -> estimate + items created
  it('CASE 3: PUT first estimate should create new estimate and item rows', async () => {
    const dto: SaveCostEstimateDto = {
      pmNotes: 'First estimate creation',
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            {
              itemName: 'Kabel Drop Core',
              quantity: 100,
              unitPrice: 5000,
              assignmentScope: 'WBS',
              wbsId: 104,
            },
          ],
        },
      ],
    };

    const res = await service.saveCostEstimate(10, dto, 1);
    expect(res.id).toBe(501);
    expect(res.totalPmEstimate).toBe(500000);
    expect(inMemoryEstimates.length).toBe(1);
    expect(inMemoryCostItems.length).toBe(1);
  });

  // CASE 4: PUT same estimate -> estimate ID stable
  it('CASE 4: Subsequent PUT should preserve the same estimate ID', async () => {
    const dto1: SaveCostEstimateDto = {
      pmNotes: 'Draft 1',
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ itemName: 'Item A', quantity: 1, unitPrice: 1000, assignmentScope: 'PROJECT' }],
        },
      ],
    };
    const res1 = await service.saveCostEstimate(10, dto1, 1);
    const initialEstimateId = res1.id;

    const dto2: SaveCostEstimateDto = {
      pmNotes: 'Draft 1 Updated',
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ id: res1.categories[0].items[0].id, itemName: 'Item A Mod', quantity: 2, unitPrice: 1000, assignmentScope: 'PROJECT' }],
        },
      ],
    };
    const res2 = await service.saveCostEstimate(10, dto2, 1);
    expect(res2.id).toBe(initialEstimateId);
  });

  // CASE 5: Edit existing cost item -> item ID stable
  it('CASE 5: Editing existing cost item should preserve item ID', async () => {
    const dto1: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'LABOR',
          mode: 'ITEMIZED',
          items: [{ itemName: 'Splicer FO', quantity: 2, unitPrice: 300000, assignmentScope: 'WBS', wbsId: 104 }],
        },
      ],
    };
    const res1 = await service.saveCostEstimate(10, dto1, 1);
    const itemId = res1.categories[1].items[0].id;

    const dto2: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'LABOR',
          mode: 'ITEMIZED',
          items: [{ id: itemId, itemName: 'Splicer FO Senior', quantity: 3, unitPrice: 350000, assignmentScope: 'WBS', wbsId: 104 }],
        },
      ],
    };
    const res2 = await service.saveCostEstimate(10, dto2, 1);
    expect(res2.categories[1].items[0].id).toBe(itemId);
    expect(res2.categories[1].items[0].subtotal).toBe(1050000);
  });

  // CASE 6: Add new cost item -> new item ID only
  it('CASE 6: Adding a new cost item to existing estimate assigns a new ID', async () => {
    const dto1: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ itemName: 'Item 1', quantity: 1, unitPrice: 1000, assignmentScope: 'PROJECT' }],
        },
      ],
    };
    const res1 = await service.saveCostEstimate(10, dto1, 1);
    const id1 = res1.categories[0].items[0].id;

    const dto2: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            { id: id1, itemName: 'Item 1', quantity: 1, unitPrice: 1000, assignmentScope: 'PROJECT' },
            { itemName: 'Item 2 (New)', quantity: 2, unitPrice: 2000, assignmentScope: 'PROJECT' },
          ],
        },
      ],
    };
    const res2 = await service.saveCostEstimate(10, dto2, 1);
    expect(res2.categories[0].items.length).toBe(2);
    expect(res2.categories[0].items[0].id).toBe(id1);
    expect(res2.categories[0].items[1].id).toBe(1002);
  });

  // CASE 7: Remove cost item -> soft deleted
  it('CASE 7: Removing a cost item from payload soft-deletes it in the database', async () => {
    const dto1: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            { itemName: 'Item Keep', quantity: 1, unitPrice: 1000, assignmentScope: 'PROJECT' },
            { itemName: 'Item Delete', quantity: 1, unitPrice: 2000, assignmentScope: 'PROJECT' },
          ],
        },
      ],
    };
    const res1 = await service.saveCostEstimate(10, dto1, 1);
    const keepId = res1.categories[0].items[0].id;
    const deleteId = res1.categories[0].items[1].id;

    const dto2: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ id: keepId, itemName: 'Item Keep', quantity: 1, unitPrice: 1000, assignmentScope: 'PROJECT' }],
        },
      ],
    };
    const res2 = await service.saveCostEstimate(10, dto2, 1);
    expect(res2.categories[0].items.length).toBe(1);

    const deletedRow = inMemoryCostItems.find((i) => i.id === deleteId);
    expect(deletedRow.deletedAt).toBeDefined();
    expect(deletedRow.deletedBy).toBe(1);
  });

  // CASE 8: Cross-project cost item ID -> blocked
  it('CASE 8: Should reject modifying a cost item ID belonging to another project/estimate', async () => {
    // Other project has item #9999
    inMemoryCostItems.push({
      id: 9999,
      estimateId: 888, // Other estimate
      categoryKey: 'MATERIAL',
      itemName: 'Stolen Item',
      deletedAt: null,
    });

    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ id: 9999, itemName: 'Hacked Item', quantity: 1, unitPrice: 1000, assignmentScope: 'PROJECT' }],
        },
      ],
    };

    await expect(service.saveCostEstimate(10, dto, 1)).rejects.toThrow(BadRequestException);
  });

  // CASE 9: Cross-project WBS -> blocked
  it('CASE 9: Should reject WBS node belonging to another project', async () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ itemName: 'Item', quantity: 1, unitPrice: 1000, assignmentScope: 'WBS', wbsId: 777 }],
        },
      ],
    };

    await expect(service.saveCostEstimate(10, dto, 1)).rejects.toThrow(BadRequestException);
  });

  // CASE 10: Parent WBS -> blocked
  it('CASE 10: Should reject cost allocation to a parent WBS package', async () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ itemName: 'Item', quantity: 1, unitPrice: 1000, assignmentScope: 'WBS', wbsId: 101 }], // 101 has child 102
        },
      ],
    };

    await expect(service.saveCostEstimate(10, dto, 1)).rejects.toThrow(BadRequestException);
    await expect(service.saveCostEstimate(10, dto, 1)).rejects.toThrow(/bukan leaf node/);
  });

  // CASE 11: Soft-deleted WBS -> blocked
  it('CASE 11: Should reject cost allocation to a soft-deleted WBS', async () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ itemName: 'Item', quantity: 1, unitPrice: 1000, assignmentScope: 'WBS', wbsId: 888 }],
        },
      ],
    };

    await expect(service.saveCostEstimate(10, dto, 1)).rejects.toThrow(BadRequestException);
  });

  // CASE 12: PROJECT scope -> wbsId NULL
  it('CASE 12: Scope PROJECT correctly sets wbsId to NULL', async () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'OPERATIONAL',
          mode: 'ITEMIZED',
          items: [{ itemName: 'Sewa Direksi Keet', quantity: 1, unitPrice: 15000000, assignmentScope: 'PROJECT' }],
        },
      ],
    };

    const res = await service.saveCostEstimate(10, dto, 1);
    expect(res.categories[5].items[0].wbsId).toBeNull();
  });

  // CASE 13: UNASSIGNED scope -> wbsId NULL
  it('CASE 13: Scope UNASSIGNED correctly sets wbsId to NULL', async () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ itemName: 'Spare Material', quantity: 5, unitPrice: 20000, assignmentScope: 'UNASSIGNED' }],
        },
      ],
    };

    const res = await service.saveCostEstimate(10, dto, 1);
    expect(res.categories[0].items[0].wbsId).toBeNull();
  });

  // CASE 14: WBS scope -> valid leaf accepted
  it('CASE 14: Scope WBS with valid leaf node is accepted', async () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ itemName: 'Kabel FO', quantity: 10, unitPrice: 1000000, assignmentScope: 'WBS', wbsId: 104 }],
        },
      ],
    };

    const res = await service.saveCostEstimate(10, dto, 1);
    expect(res.categories[0].items[0].wbsId).toBe(104);
  });

  // CASE 15: Client subtotal incorrect -> server recalculates
  it('CASE 15: Server ignores client subtotal and persists canonical quantity * unitPrice', async () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            {
              itemName: 'Item Hack',
              quantity: 10,
              unitPrice: 2500,
              subtotal: 99999999, // Fake client subtotal
              assignmentScope: 'PROJECT',
            },
          ],
        },
      ],
    };

    const res = await service.saveCostEstimate(10, dto, 1);
    expect(res.categories[0].items[0].subtotal).toBe(25000);
    expect(res.totalPmEstimate).toBe(25000);
  });

  // CASE 16: Category total -> correctly derived
  it('CASE 16: Category totals are computed from item subtotals on save & retrieval', async () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            { itemName: 'M1', quantity: 2, unitPrice: 10000, assignmentScope: 'PROJECT' },
            { itemName: 'M2', quantity: 3, unitPrice: 20000, assignmentScope: 'PROJECT' },
          ],
        },
      ],
    };

    const res = await service.saveCostEstimate(10, dto, 1);
    expect(res.categories[0].categoryTotal).toBe(80000);
  });

  // CASE 17: Project total -> correctly derived
  it('CASE 17: Project total is derived across direct, indirect, and risk groups', async () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ itemName: 'Mat', quantity: 1, unitPrice: 1000000, assignmentScope: 'PROJECT' }],
        },
        {
          categoryKey: 'PERMIT',
          mode: 'DIRECT',
          directSubtotal: 500000,
        },
        {
          categoryKey: 'CONTINGENCY',
          mode: 'DIRECT',
          directSubtotal: 200000,
        },
      ],
    };

    const res = await service.saveCostEstimate(10, dto, 1);
    expect(res.directTotal).toBe(1000000);
    expect(res.indirectTotal).toBe(500000);
    expect(res.riskTotal).toBe(200000);
    expect(res.totalPmEstimate).toBe(1700000);
  });

  // CASE 18: Budget exceeds ceiling -> save remains allowed for DRAFT
  it('CASE 18: DRAFT save remains allowed when total exceeds project contract amount', async () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ itemName: 'Heavy Material', quantity: 1, unitPrice: 500000000, assignmentScope: 'PROJECT' }],
        },
      ],
    };

    const res = await service.saveCostEstimate(10, dto, 1);
    expect(res.totalPmEstimate).toBe(500000000);
    expect(res.status).toBe('DRAFT');
  });

  // CASE 19: Partial DB failure -> complete rollback
  it('CASE 19: Transaction rolls back completely if a database error occurs during save', async () => {
    mockManager.save.mockImplementationOnce(() => {
      throw new Error('Database disk I/O failure');
    });

    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ itemName: 'Fail Item', quantity: 1, unitPrice: 1000, assignmentScope: 'PROJECT' }],
        },
      ],
    };

    await expect(service.saveCostEstimate(10, dto, 1)).rejects.toThrow('Database disk I/O failure');
  });

  // CASE 20: Controller method calls service and extracts user
  it('CASE 20: Controller should route getCostEstimate and saveCostEstimate with user context', async () => {
    const req = { user: { userId: 1, roles: ['PROJECT_MANAGER'] } };
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ itemName: 'Item C', quantity: 1, unitPrice: 100, assignmentScope: 'PROJECT' }],
        },
      ],
    };

    const putRes = await controller.saveCostEstimate(10, dto, req);
    expect(putRes.id).toBe(501);

    const getRes = await controller.getCostEstimate(10);
    expect(getRes.id).toBe(501);
  });

  // CASE 21: No authenticated user for mutation -> 401
  it('CASE 21: Controller throws UnauthorizedException if token user identity is missing', async () => {
    const req = { user: null };
    const dto: SaveCostEstimateDto = {
      categories: [{ categoryKey: 'MATERIAL', mode: 'DIRECT', directSubtotal: 100 }],
    };

    await expect(controller.saveCostEstimate(10, dto, req)).rejects.toThrow(UnauthorizedException);
  });

  // CASE 22: WBS reconciliation hierarchy calculation
  it('CASE 22: WBS summary rolls up leaf costs to parent packages accurately', async () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            { itemName: 'Survey Tools', quantity: 1, unitPrice: 1000000, assignmentScope: 'WBS', wbsId: 102 },
            { itemName: 'FO 48C', quantity: 2, unitPrice: 2000000, assignmentScope: 'WBS', wbsId: 104 },
          ],
        },
      ],
    };

    const res = await service.saveCostEstimate(10, dto, 1);
    const parent1 = res.wbsCostSummary.find((w: any) => w.wbsId === 101);
    const leaf1 = res.wbsCostSummary.find((w: any) => w.wbsId === 102);
    const parent2 = res.wbsCostSummary.find((w: any) => w.wbsId === 103);
    const leaf2 = res.wbsCostSummary.find((w: any) => w.wbsId === 104);

    expect(leaf1.totalCost).toBe(1000000);
    expect(parent1.totalCost).toBe(1000000); // Rolled up from leaf 102
    expect(leaf2.totalCost).toBe(4000000);
    expect(parent2.totalCost).toBe(4000000); // Rolled up from leaf 104
  });

  // CASE 23: Soft-deleted cost item omitted -> no resurrection
  it('CASE 23: Soft deleted items are omitted from active calculations and not resurrected', async () => {
    inMemoryEstimates.push({
      id: 501,
      projectId: 10,
      status: 'DRAFT',
      version: 1,
      createdAt: new Date(),
    });
    inMemoryCostItems.push({
      id: 1001,
      estimateId: 501,
      categoryKey: 'MATERIAL',
      entryMode: 'ITEMIZED',
      itemName: 'Deleted Item',
      quantity: 1,
      unitPrice: 5000,
      subtotal: 5000,
      assignmentScope: 'PROJECT',
      deletedAt: new Date(), // Soft-deleted
    });

    const res = await service.getCostEstimate(10);
    expect(res.categories[0].items.length).toBe(0);
    expect(res.totalPmEstimate).toBe(0);
  });

  // CASE 24: Duplicate cost item names allowed
  it('CASE 24: Duplicate cost item names in different categories or scopes are allowed', async () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            { itemName: 'Kabel Ties', quantity: 10, unitPrice: 1000, assignmentScope: 'PROJECT' },
            { itemName: 'Kabel Ties', quantity: 5, unitPrice: 1000, assignmentScope: 'WBS', wbsId: 104 },
          ],
        },
      ],
    };

    const res = await service.saveCostEstimate(10, dto, 1);
    expect(res.categories[0].items.length).toBe(2);
  });

  // CASE 25: Decimal quantity persisted correctly
  it('CASE 25: Fractional quantities (DECIMAL 12,4) are persisted accurately', async () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ itemName: 'Kabel Roll', quantity: 3.7525, unitPrice: 10000, assignmentScope: 'PROJECT' }],
        },
      ],
    };

    const res = await service.saveCostEstimate(10, dto, 1);
    expect(res.categories[0].items[0].quantity).toBe(3.7525);
    expect(res.categories[0].items[0].subtotal).toBe(37525.0);
  });

  // CASE 26: Currency rounding -> 2 decimals canonical
  it('CASE 26: Decimal multiplication rounds deterministically to 2 decimal places', async () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ itemName: 'Precision Test', quantity: 2.5, unitPrice: 1234.56, assignmentScope: 'PROJECT' }],
        },
      ],
    };

    const res = await service.saveCostEstimate(10, dto, 1);
    expect(res.categories[0].items[0].subtotal).toBe(3086.4);
    expect(res.totalPmEstimate).toBe(3086.4);
  });

  // HARDENING 1: DRAFT Save Semantics - Version Stability Across Edits
  it('HARDENING 1: Initial estimate is created with version 1 and status DRAFT', async () => {
    const dto: SaveCostEstimateDto = {
      pmNotes: 'Initial Draft',
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ itemName: 'Item 1', quantity: 1, unitPrice: 1000, assignmentScope: 'PROJECT' }],
        },
      ],
    };

    const res = await service.saveCostEstimate(10, dto, 1);
    expect(res.version).toBe(1);
    expect(res.status).toBe('DRAFT');
  });

  it('HARDENING 2: Editing DRAFT quantity, price, adding, or removing items preserves version 1 and DRAFT status', async () => {
    // Initial save
    const dto1: SaveCostEstimateDto = {
      pmNotes: 'Draft Version 1',
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ itemName: 'Item 1', quantity: 10, unitPrice: 5000, assignmentScope: 'PROJECT' }],
        },
      ],
    };
    const res1 = await service.saveCostEstimate(10, dto1, 1);
    expect(res1.version).toBe(1);
    expect(res1.status).toBe('DRAFT');
    const itemId = res1.categories[0].items[0].id;

    // Subsequent edit: change quantity and unit price
    const dto2: SaveCostEstimateDto = {
      pmNotes: 'Draft Version 1 Edited',
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ id: itemId, itemName: 'Item 1', quantity: 20, unitPrice: 6000, assignmentScope: 'PROJECT' }],
        },
      ],
    };
    const res2 = await service.saveCostEstimate(10, dto2, 1);
    expect(res2.version).toBe(1);
    expect(res2.status).toBe('DRAFT');
    expect(res2.id).toBe(res1.id);

    // Subsequent edit: add second item
    const dto3: SaveCostEstimateDto = {
      pmNotes: 'Draft Version 1 with New Item',
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            { id: itemId, itemName: 'Item 1', quantity: 20, unitPrice: 6000, assignmentScope: 'PROJECT' },
            { itemName: 'Item 2', quantity: 5, unitPrice: 1000, assignmentScope: 'PROJECT' },
          ],
        },
      ],
    };
    const res3 = await service.saveCostEstimate(10, dto3, 1);
    expect(res3.version).toBe(1);
    expect(res3.status).toBe('DRAFT');
    expect(res3.categories[0].items.length).toBe(2);

    // Subsequent edit: remove first item
    const newItemId = res3.categories[0].items[1].id;
    const dto4: SaveCostEstimateDto = {
      pmNotes: 'Draft Version 1 with Item 1 Removed',
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ id: newItemId, itemName: 'Item 2', quantity: 5, unitPrice: 1000, assignmentScope: 'PROJECT' }],
        },
      ],
    };
    const res4 = await service.saveCostEstimate(10, dto4, 1);
    expect(res4.version).toBe(1);
    expect(res4.status).toBe('DRAFT');
    expect(res4.categories[0].items.length).toBe(1);
  });

  // HARDENING 3: APPROVED Baseline Immutability Guard
  it('HARDENING 3: Direct PUT mutation on an APPROVED cost estimate is strictly blocked', async () => {
    // Setup APPROVED estimate in DB
    inMemoryEstimates.push({
      id: 501,
      projectId: 10,
      status: 'APPROVED',
      version: 1,
      pmNotes: 'Official Approved Baseline RAB',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    inMemoryCostItems.push({
      id: 1001,
      estimateId: 501,
      categoryKey: 'MATERIAL',
      entryMode: 'ITEMIZED',
      itemName: 'Approved Baseline Material',
      quantity: 100,
      unitPrice: 10000,
      subtotal: 1000000,
      assignmentScope: 'PROJECT',
      deletedAt: null,
    });

    const dto: SaveCostEstimateDto = {
      pmNotes: 'Attempted Direct Mutation',
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [{ id: 1001, itemName: 'Mutated Name', quantity: 200, unitPrice: 20000, assignmentScope: 'PROJECT' }],
        },
      ],
    };

    await expect(service.saveCostEstimate(10, dto, 1)).rejects.toThrow(BadRequestException);
    await expect(service.saveCostEstimate(10, dto, 1)).rejects.toThrow(/berstatus APPROVED tidak dapat diubah/);

    // Verify database state remains uncorrupted
    const estimateInDb = inMemoryEstimates.find((e) => e.id === 501);
    expect(estimateInDb.status).toBe('APPROVED');
    const itemInDb = inMemoryCostItems.find((i) => i.id === 1001);
    expect(itemInDb.quantity).toBe(100);
    expect(itemInDb.itemName).toBe('Approved Baseline Material');
  });

  // HARDENING 4: LocalStorage Migration Contract & SSOT Precedence
  it('HARDENING 4: When backend estimate exists, it takes absolute precedence over client state', async () => {
    inMemoryEstimates.push({
      id: 501,
      projectId: 10,
      status: 'DRAFT',
      version: 1,
      pmNotes: 'Server SSOT Note',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    inMemoryCostItems.push({
      id: 1001,
      estimateId: 501,
      categoryKey: 'MATERIAL',
      entryMode: 'ITEMIZED',
      itemName: 'Server SSOT Material',
      quantity: 10,
      unitPrice: 50000,
      subtotal: 500000,
      assignmentScope: 'PROJECT',
      deletedAt: null,
    });

    const serverState = await service.getCostEstimate(10);
    expect(serverState.id).toBe(501);
    expect(serverState.pmNotes).toBe('Server SSOT Note');
    expect(serverState.totalPmEstimate).toBe(500000);
  });
});
