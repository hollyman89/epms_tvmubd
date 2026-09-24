import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectService } from './project.service';
import { Project } from '../../entities/project.entity';
import { Contract } from '../../entities/contract.entity';
import { User } from '../../entities/user.entity';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { Task } from '../../entities/task.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { ProjectInitialCondition } from '../../entities/project-initial-condition.entity';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SaveCostEstimateDto } from './dto/save-cost-estimate.dto';
import { CostEstimateValidator } from './cost-estimate.validator';
import { ScheduleValidator } from './schedule.validator';
import { InitialConditionValidator } from './initial-condition.validator';
import { ManagementReviewValidator } from './management-review.validator';
import { OperationalReadinessValidator } from './operational-readiness.validator';

describe('PHASE 1B.2 — Cost / RAB Pre-Approval Planning Persistence & WBS Mapping Unit Tests', () => {
  let service: ProjectService;
  let inMemoryCostEstimates: any[];
  let inMemoryCostItems: any[];
  let inMemoryWbsTable: any[];
  let nextAutoId: number;

  const mockProject1: any = {
    id: 1,
    code: 'CONT-20260722-1127',
    name: 'Project Yofc Sleman',
    status: 'IN_PROGRESS',
    managerId: 5,
  };

  const mockPlanningProject2: any = {
    id: 2,
    code: 'CONT-20260819-0012',
    name: 'Rumah Net FKI Karawang',
    status: 'PLANNING',
    managerId: 5,
  };

  const mockProject2WbsNodes: any[] = [
    {
      id: 33,
      projectId: 2,
      parentWbsId: null,
      code: '1.0',
      name: 'Persiapan & Survey',
      level: 1,
      weightPercentage: 30,
      deletedAt: null,
    },
    {
      id: 34,
      projectId: 2,
      parentWbsId: 33,
      code: '1.1',
      name: 'Survey Site',
      level: 2,
      weightPercentage: 15,
      deletedAt: null,
    },
    {
      id: 35,
      projectId: 2,
      parentWbsId: 33,
      code: '1.2',
      name: 'Perizinan Kawasan',
      level: 2,
      weightPercentage: 15,
      deletedAt: null,
    },
    {
      id: 36,
      projectId: 2,
      parentWbsId: null,
      code: '2.0',
      name: 'Implementasi Infrastruktur FO',
      level: 1,
      weightPercentage: 50,
      deletedAt: null,
    },
    {
      id: 37,
      projectId: 2,
      parentWbsId: 36,
      code: '2.1',
      name: 'Pengadaan Tiang & Kabel',
      level: 2,
      weightPercentage: 25,
      deletedAt: null,
    },
    {
      id: 38,
      projectId: 2,
      parentWbsId: 36,
      code: '2.2',
      name: 'Penarikan Kabel & Splicing',
      level: 2,
      weightPercentage: 25,
      deletedAt: null,
    },
    {
      id: 39,
      projectId: 2,
      parentWbsId: null,
      code: '3.0',
      name: 'Testing & Handover',
      level: 1,
      weightPercentage: 20,
      deletedAt: null,
    },
  ];

  beforeEach(async () => {
    inMemoryCostEstimates = [];
    inMemoryCostItems = [];
    inMemoryWbsTable = [...mockProject2WbsNodes];
    nextAutoId = 200;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        CostEstimateValidator,
        ScheduleValidator,
        InitialConditionValidator,
        ManagementReviewValidator,
        OperationalReadinessValidator,
        {
          provide: getRepositoryToken(Project),
          useValue: {
            find: jest.fn().mockResolvedValue([mockProject1, mockPlanningProject2]),
            findOne: jest.fn().mockImplementation(({ where }) => {
              if (where.id === 1) return Promise.resolve(mockProject1);
              if (where.id === 2) return Promise.resolve(mockPlanningProject2);
              return Promise.resolve(null);
            }),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WorkBreakdownStructure),
          useValue: {
            find: jest.fn().mockImplementation(({ where }) => {
              const pId = where.projectId;
              return Promise.resolve(inMemoryWbsTable.filter((w) => w.projectId === pId));
            }),
          },
        },
        {
          provide: getRepositoryToken(ProjectCostEstimate),
          useValue: {
            find: jest.fn().mockImplementation(({ where }) => {
              const pId = where.projectId;
              return Promise.resolve(inMemoryCostEstimates.filter((e) => e.projectId === pId && !e.deletedAt));
            }),
            findOne: jest.fn().mockImplementation(({ where }) => {
              const pId = where.projectId;
              return Promise.resolve(inMemoryCostEstimates.find((e) => e.projectId === pId && !e.deletedAt) || null);
            }),
            manager: {
              transaction: jest.fn(async (cb) => {
                const fakeManager = {
                  findOne: jest.fn().mockImplementation((entityClass, { where }) => {
                    if (entityClass === ProjectCostEstimate) {
                      const pId = where.projectId;
                      return Promise.resolve(inMemoryCostEstimates.find((e) => e.projectId === pId && !e.deletedAt) || null);
                    }
                    return Promise.resolve(null);
                  }),
                  find: jest.fn().mockImplementation((entityClass, { where }) => {
                    if (entityClass === CostItem) {
                      const estId = where.estimateId;
                      return Promise.resolve(inMemoryCostItems.filter((i) => i.estimateId === estId));
                    }
                    return Promise.resolve([]);
                  }),
                  create: jest.fn((entityClass, data) => {
                    if (entityClass === AuditLog) return { ...data, id: ++nextAutoId };
                    return {
                      id: ++nextAutoId,
                      ...data,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    };
                  }),
                  save: jest.fn((entityClass, entity) => {
                    if (entityClass === AuditLog) return Promise.resolve(entity);
                    if (entityClass === ProjectCostEstimate) {
                      const existingIdx = inMemoryCostEstimates.findIndex((e) => e.id === entity.id);
                      if (existingIdx >= 0) {
                        inMemoryCostEstimates[existingIdx] = { ...inMemoryCostEstimates[existingIdx], ...entity, updatedAt: new Date() };
                        return Promise.resolve(inMemoryCostEstimates[existingIdx]);
                      } else {
                        inMemoryCostEstimates.push(entity);
                        return Promise.resolve(entity);
                      }
                    }
                    if (entityClass === CostItem) {
                      const existingIdx = inMemoryCostItems.findIndex((i) => i.id === entity.id);
                      if (existingIdx >= 0) {
                        inMemoryCostItems[existingIdx] = { ...inMemoryCostItems[existingIdx], ...entity, updatedAt: new Date() };
                        return Promise.resolve(inMemoryCostItems[existingIdx]);
                      } else {
                        inMemoryCostItems.push(entity);
                        return Promise.resolve(entity);
                      }
                    }
                    return Promise.resolve(entity);
                  }),
                };
                return await cb(fakeManager);
              }),
            },
          },
        },
        {
          provide: getRepositoryToken(CostItem),
          useValue: {
            find: jest.fn().mockImplementation(({ where }) => {
              const estId = where.estimateId;
              return Promise.resolve(inMemoryCostItems.filter((i) => i.estimateId === estId && !i.deletedAt));
            }),
          },
        },
        {
          provide: getRepositoryToken(Contract),
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(Task),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(ProjectInitialCondition),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(ProjectManagementReview),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(PurchaseRequest),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  describe('1. Cost Load & Legitimate Empty State', () => {
    it('should throw NotFoundException (legitimate empty state) when Project #2 has no cost estimate', async () => {
      await expect(service.getCostEstimate(2)).rejects.toThrow(NotFoundException);
      await expect(service.getCostEstimate(2)).rejects.toThrow(/Estimasi biaya \(RAB\) untuk proyek #2 belum dibuat/);
    });

    it('should reject invalid projectId (e.g. 404 project not found)', async () => {
      await expect(service.getCostEstimate(9999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('2. Cost Save & Pre-Approval Planning Persistence with WBS Mapping', () => {
    const validKarawangCostPayload: SaveCostEstimateDto = {
      pmNotes: 'Estimasi biaya pelaksanaan rollout jaringan Karawang (Phase 1B.2)',
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            {
              itemName: 'Kabel Fiber Optic 24 Core ADSS',
              quantity: 10,
              uom: 'Km',
              unitPrice: 12000000,
              assignmentScope: 'WBS',
              wbsId: 37, // Leaf WBS 2.1: Pengadaan Tiang & Kabel
            },
            {
              itemName: 'Tiang Besi 7 Meter 4.5 Inch',
              quantity: 50,
              uom: 'Batang',
              unitPrice: 1500000,
              assignmentScope: 'WBS',
              wbsId: 37, // Leaf WBS 2.1: Pengadaan Tiang & Kabel
            },
          ],
        },
        {
          categoryKey: 'LABOR',
          mode: 'ITEMIZED',
          items: [
            {
              itemName: 'Tim Penarikan & Splicing Kabel FO',
              quantity: 20,
              uom: 'Hari',
              unitPrice: 2500000,
              assignmentScope: 'WBS',
              wbsId: 38, // Leaf WBS 2.2: Penarikan Kabel & Splicing
            },
            {
              itemName: 'Tim Survey & Pengukuran Jalur',
              quantity: 5,
              uom: 'Hari',
              unitPrice: 1500000,
              assignmentScope: 'WBS',
              wbsId: 34, // Leaf WBS 1.1: Survey Site
            },
          ],
        },
        {
          categoryKey: 'PERMIT',
          mode: 'DIRECT',
          directSubtotal: 15000000,
        },
        {
          categoryKey: 'OPERATIONAL',
          mode: 'ITEMIZED',
          items: [
            {
              itemName: 'Mobilisasi Armada & Direksi Keet Lapangan',
              quantity: 1,
              uom: 'Lot',
              unitPrice: 10000000,
              assignmentScope: 'PROJECT', // Project-Level overhead
              wbsId: null,
            },
          ],
        },
        {
          categoryKey: 'CONTINGENCY',
          mode: 'DIRECT',
          directSubtotal: 20000000,
        },
      ],
    };

    it('should successfully save Cost/RAB for Project #2 with status PLANNING', async () => {
      const res = await service.saveCostEstimate(2, validKarawangCostPayload, 5);

      expect(res).toBeDefined();
      expect(mockPlanningProject2.status).toBe('PLANNING'); // MUST remain PLANNING

      // Verify calculation totals
      // Material: 10 * 12M + 50 * 1.5M = 120M + 75M = 195M
      // Labor: 20 * 2.5M + 5 * 1.5M = 50M + 7.5M = 57.5M
      // Permit: 15M (Direct)
      // Operational: 10M (Itemized Project-Level)
      // Contingency: 20M (Direct Risk)
      // Total = 195M + 57.5M + 15M + 10M + 20M = 297.5M
      expect(res.directTotal).toBe(252500000); // 195M + 57.5M
      expect(res.indirectTotal).toBe(25000000); // 15M + 10M
      expect(res.riskTotal).toBe(20000000); // 20M
      expect(res.totalPmEstimate).toBe(297500000);

      // Verify inMemory DB tables
      expect(inMemoryCostEstimates).toHaveLength(1);
      expect(inMemoryCostEstimates[0].projectId).toBe(2);
      expect(inMemoryCostEstimates[0].status).toBe('DRAFT');

      // Verify active cost items
      const activeItems = inMemoryCostItems.filter((i) => !i.deletedAt);
      expect(activeItems.length).toBeGreaterThanOrEqual(5);

      // Verify WBS mappings
      const foCableItem = activeItems.find((i) => i.itemName.includes('Kabel Fiber Optic'));
      expect(foCableItem).toBeDefined();
      expect(foCableItem.wbsId).toBe(37);
      expect(foCableItem.assignmentScope).toBe('WBS');

      const surveyItem = activeItems.find((i) => i.itemName.includes('Survey'));
      expect(surveyItem).toBeDefined();
      expect(surveyItem.wbsId).toBe(34);

      const opItem = activeItems.find((i) => i.itemName.includes('Mobilisasi'));
      expect(opItem).toBeDefined();
      expect(opItem.assignmentScope).toBe('PROJECT');
      expect(opItem.wbsId).toBeNull();
    });

    it('should preserve item IDs and update existing items on subsequent updates', async () => {
      // First save
      const firstSave = await service.saveCostEstimate(2, validKarawangCostPayload, 5);
      const materialCat = firstSave.categories.find((c: any) => c.categoryKey === 'MATERIAL');
      const firstItemId = materialCat.items[0].id;

      // Edit item quantity from 10 to 12
      const editPayload: SaveCostEstimateDto = {
        pmNotes: 'Revisi volume kabel',
        categories: [
          {
            categoryKey: 'MATERIAL',
            mode: 'ITEMIZED',
            items: [
              {
                id: firstItemId,
                itemName: 'Kabel Fiber Optic 24 Core ADSS (Updated)',
                quantity: 12,
                uom: 'Km',
                unitPrice: 12000000,
                assignmentScope: 'WBS',
                wbsId: 37,
              },
            ],
          },
        ],
      };

      const secondSave = await service.saveCostEstimate(2, editPayload, 5);
      const secondMaterialCat = secondSave.categories.find((c: any) => c.categoryKey === 'MATERIAL');

      expect(secondMaterialCat.items[0].id).toBe(firstItemId);
      expect(secondMaterialCat.items[0].itemName).toBe('Kabel Fiber Optic 24 Core ADSS (Updated)');
      expect(secondMaterialCat.items[0].quantity).toBe(12);
      expect(secondMaterialCat.items[0].subtotal).toBe(144000000);
    });

    it('should soft-delete removed items without leaking data', async () => {
      // First save with 2 items in material
      const firstSave = await service.saveCostEstimate(2, validKarawangCostPayload, 5);
      const materialCat = firstSave.categories.find((c: any) => c.categoryKey === 'MATERIAL');
      const keptItemId = materialCat.items[0].id;
      const removedItemId = materialCat.items[1].id;

      // Second save with only 1 item in material
      const deleteItemPayload: SaveCostEstimateDto = {
        categories: [
          {
            categoryKey: 'MATERIAL',
            mode: 'ITEMIZED',
            items: [
              {
                id: keptItemId,
                itemName: 'Kabel Fiber Optic 24 Core ADSS',
                quantity: 10,
                uom: 'Km',
                unitPrice: 12000000,
                assignmentScope: 'WBS',
                wbsId: 37,
              },
            ],
          },
        ],
      };

      await service.saveCostEstimate(2, deleteItemPayload, 5);

      const removedDbItem = inMemoryCostItems.find((i) => i.id === removedItemId);
      expect(removedDbItem).toBeDefined();
      expect(removedDbItem.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('3. Validation Guardrails & Project Isolation', () => {
    it('should reject mapping to a non-leaf WBS node (Parent Package)', async () => {
      const invalidParentMappingPayload: SaveCostEstimateDto = {
        categories: [
          {
            categoryKey: 'MATERIAL',
            mode: 'ITEMIZED',
            items: [
              {
                itemName: 'Material Paket Utama',
                quantity: 1,
                uom: 'Lot',
                unitPrice: 50000000,
                assignmentScope: 'WBS',
                wbsId: 36, // Node 36 is Parent Package "2.0 Implementasi Infrastruktur FO" (non-leaf!)
              },
            ],
          },
        ],
      };

      await expect(service.saveCostEstimate(2, invalidParentMappingPayload, 5)).rejects.toThrow(BadRequestException);
      await expect(service.saveCostEstimate(2, invalidParentMappingPayload, 5)).rejects.toThrow(/bukan leaf node/);
    });

    it('should reject mapping to a WBS node belonging to another project (Cross-Project Isolation)', async () => {
      // Node 99 belongs to Project 1
      inMemoryWbsTable.push({
        id: 99,
        projectId: 1,
        code: '1.0',
        name: 'Project 1 Task',
        level: 1,
        parentWbsId: null,
      });

      const crossProjectPayload: SaveCostEstimateDto = {
        categories: [
          {
            categoryKey: 'MATERIAL',
            mode: 'ITEMIZED',
            items: [
              {
                itemName: 'Material Stealing Cross Project',
                quantity: 1,
                uom: 'Unit',
                unitPrice: 1000000,
                assignmentScope: 'WBS',
                wbsId: 99, // Belongs to Project 1!
              },
            ],
          },
        ],
      };

      await expect(service.saveCostEstimate(2, crossProjectPayload, 5)).rejects.toThrow(BadRequestException);
      await expect(service.saveCostEstimate(2, crossProjectPayload, 5)).rejects.toThrow(/tidak ditemukan, bukan milik project #2/);
    });

    it('should reject cost item ID belonging to another project estimate', async () => {
      inMemoryCostItems.push({
        id: 999,
        estimateId: 888, // belongs to estimate 888 of project 1
        categoryKey: 'MATERIAL',
        itemName: 'Project 1 Item',
      });

      const maliciousItemPayload: SaveCostEstimateDto = {
        categories: [
          {
            categoryKey: 'MATERIAL',
            mode: 'ITEMIZED',
            items: [
              {
                id: 999, // malicious ID
                itemName: 'Hacked Item',
                quantity: 1,
                uom: 'Unit',
                unitPrice: 1000,
                assignmentScope: 'PROJECT',
              },
            ],
          },
        ],
      };

      await expect(service.saveCostEstimate(2, maliciousItemPayload, 5)).rejects.toThrow(BadRequestException);
      await expect(service.saveCostEstimate(2, maliciousItemPayload, 5)).rejects.toThrow(/Invalid cost item ownership/);
    });
  });
});
