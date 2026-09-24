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
import { SaveWbsTreeDto } from './dto/save-wbs-tree.dto';
import { CostEstimateValidator } from './cost-estimate.validator';
import { ScheduleValidator } from './schedule.validator';
import { InitialConditionValidator } from './initial-condition.validator';
import { ManagementReviewValidator } from './management-review.validator';
import { OperationalReadinessValidator } from './operational-readiness.validator';

describe('PHASE 1B.1 — WBS Pre-Approval Planning Persistence Unit Tests', () => {
  let service: ProjectService;
  let projectRepo: jest.Mocked<Repository<Project>>;
  let wbsRepo: jest.Mocked<Repository<WorkBreakdownStructure>>;
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

  beforeEach(async () => {
    inMemoryWbsTable = [];
    nextAutoId = 100;

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
              return Promise.resolve(inMemoryWbsTable.filter((w) => w.projectId === pId && !w.deletedAt));
            }),
            manager: {
              transaction: jest.fn(async (cb) => {
                const fakeManager = {
                  find: jest.fn().mockImplementation((entityClass, { where }) => {
                    const pId = where.projectId;
                    return Promise.resolve(inMemoryWbsTable.filter((w) => w.projectId === pId));
                  }),
                  create: jest.fn((entityClass, data) => {
                    if (entityClass === AuditLog) return { ...data, id: ++nextAutoId };
                    const obj = {
                      id: ++nextAutoId,
                      ...data,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    };
                    return obj;
                  }),
                  save: jest.fn((entityClass, entity) => {
                    if (entityClass === AuditLog || entity.action) return Promise.resolve(entity);
                    const existingIdx = inMemoryWbsTable.findIndex((w) => w.id === entity.id);
                    if (existingIdx >= 0) {
                      inMemoryWbsTable[existingIdx] = { ...inMemoryWbsTable[existingIdx], ...entity, updatedAt: new Date() };
                      return Promise.resolve(inMemoryWbsTable[existingIdx]);
                    } else {
                      inMemoryWbsTable.push(entity);
                      return Promise.resolve(entity);
                    }
                  }),
                };
                return await cb(fakeManager);
              }),
            },
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
          provide: getRepositoryToken(ProjectCostEstimate),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(CostItem),
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
    projectRepo = module.get(getRepositoryToken(Project));
    wbsRepo = module.get(getRepositoryToken(WorkBreakdownStructure));
  });

  describe('1. WBS Load & Legitimate Empty State', () => {
    it('should return legitimate empty array when Project #2 in PLANNING has 0 WBS', async () => {
      const result = await service.getWbsByProject(2);
      expect(result).toEqual([]);
      expect(wbsRepo.find).toHaveBeenCalledWith({
        where: { projectId: 2 },
        order: { code: 'ASC', id: 'ASC' },
      });
    });

    it('should return deterministically and naturally sorted WBS nodes (handling 1.0, 2.0, 9.0, 10.0, 1.1, 1.2, 1.10)', async () => {
      const unorderedDbRows = [
        { id: 1, code: '1.0', name: 'Pkg 1', level: 1 },
        { id: 2, code: '10.0', name: 'Pkg 10', level: 1 },
        { id: 3, code: '2.0', name: 'Pkg 2', level: 1 },
        { id: 4, code: '9.0', name: 'Pkg 9', level: 1 },
        { id: 5, code: '1.10', name: 'Sub 1.10', level: 2 },
        { id: 6, code: '1.1', name: 'Sub 1.1', level: 2 },
        { id: 7, code: '1.2', name: 'Sub 1.2', level: 2 },
      ];
      wbsRepo.find.mockResolvedValueOnce(unorderedDbRows as any);

      const result = await service.getWbsByProject(1);
      expect(result.map((r: any) => r.code)).toEqual([
        '1.0',
        '1.1',
        '1.2',
        '1.10',
        '2.0',
        '9.0',
        '10.0',
      ]);
    });
  });

  describe('2. WBS Save & Pre-Approval Planning Persistence', () => {
    const validKarawangWbsPayload: SaveWbsTreeDto = {
      nodes: [
        {
          code: '1.0',
          name: 'Persiapan & Survey',
          level: 1,
          weightPercentage: 30,
          children: [
            {
              code: '1.1',
              name: 'Survey Site',
              level: 2,
              weightPercentage: 15,
            },
            {
              code: '1.2',
              name: 'Perizinan',
              level: 2,
              weightPercentage: 15,
            },
          ],
        },
        {
          code: '2.0',
          name: 'Implementasi Infrastruktur FO',
          level: 1,
          weightPercentage: 50,
          children: [
            {
              code: '2.1',
              name: 'Pengadaan Material',
              level: 2,
              weightPercentage: 25,
            },
            {
              code: '2.2',
              name: 'Instalasi FO',
              level: 2,
              weightPercentage: 25,
            },
          ],
        },
        {
          code: '3.0',
          name: 'Testing & Handover',
          level: 1,
          weightPercentage: 20,
        },
      ],
    };

    it('should successfully save WBS tree for Project #2 with status PLANNING', async () => {
      const saveRes = await service.saveWbsTree(2, validKarawangWbsPayload, 5);

      expect(saveRes).toBeDefined();
      expect(saveRes.statusCode).toBe(200);
      expect(saveRes.data).toHaveLength(3); // 3 root nodes
      expect(mockPlanningProject2.status).toBe('PLANNING'); // Status MUST remain PLANNING

      // Verify all 7 saved records in inMemory table belong to projectId = 2
      expect(inMemoryWbsTable).toHaveLength(7);
      for (const row of inMemoryWbsTable) {
        expect(row.projectId).toBe(2);
        expect(row.id).toBeGreaterThan(0);
        expect(row.deletedAt).toBeUndefined();
      }

      // Verify hierarchy & weights
      const root1 = inMemoryWbsTable.find((w) => w.code === '1.0');
      const child11 = inMemoryWbsTable.find((w) => w.code === '1.1');
      const child12 = inMemoryWbsTable.find((w) => w.code === '1.2');

      expect(root1).toBeDefined();
      expect(root1.level).toBe(1);
      expect(root1.weightPercentage).toBe(30);
      expect(child11.parentWbsId).toBe(root1.id);
      expect(child12.parentWbsId).toBe(root1.id);
    });

    it('should preserve database IDs on subsequent updates without duplicating rows', async () => {
      // Step 1: Initial Save
      const firstSave = await service.saveWbsTree(2, validKarawangWbsPayload, 5);
      const root1Id = firstSave.data[0].id;
      const child11Id = firstSave.data[0].children[0].id;

      // Step 2: Edit Child 1.1 Name & Weight
      const editPayload: SaveWbsTreeDto = {
        nodes: [
          {
            id: root1Id,
            code: '1.0',
            name: 'Persiapan & Survey (Updated)',
            level: 1,
            weightPercentage: 30,
            children: [
              {
                id: child11Id,
                code: '1.1',
                name: 'Survey Site & Rencana Jalur',
                level: 2,
                weightPercentage: 15,
              },
              {
                id: firstSave.data[0].children[1].id,
                code: '1.2',
                name: 'Perizinan',
                level: 2,
                weightPercentage: 15,
              },
            ],
          },
          {
            id: firstSave.data[1].id,
            code: '2.0',
            name: 'Implementasi Infrastruktur FO',
            level: 1,
            weightPercentage: 50,
            children: [
              {
                id: firstSave.data[1].children[0].id,
                code: '2.1',
                name: 'Pengadaan Material',
                level: 2,
                weightPercentage: 25,
              },
              {
                id: firstSave.data[1].children[1].id,
                code: '2.2',
                name: 'Instalasi FO',
                level: 2,
                weightPercentage: 25,
              },
            ],
          },
          {
            id: firstSave.data[2].id,
            code: '3.0',
            name: 'Testing & Handover',
            level: 1,
            weightPercentage: 20,
          },
        ],
      };

      const secondSave = await service.saveWbsTree(2, editPayload, 5);

      expect(secondSave.data[0].id).toBe(root1Id);
      expect(secondSave.data[0].name).toBe('Persiapan & Survey (Updated)');
      expect(secondSave.data[0].children[0].id).toBe(child11Id);
      expect(secondSave.data[0].children[0].name).toBe('Survey Site & Rencana Jalur');

      // Still exactly 7 active rows
      expect(inMemoryWbsTable.filter((w) => !w.deletedAt)).toHaveLength(7);
    });

    it('should soft-delete removed nodes when a node is deleted from the tree', async () => {
      // Step 1: Initial Save
      const firstSave = await service.saveWbsTree(2, validKarawangWbsPayload, 5);
      const deletedChildId = firstSave.data[0].children[1].id; // 1.2 Perizinan

      // Step 2: Remove 1.2 and adjust 1.1 to 30%
      const deletePayload: SaveWbsTreeDto = {
        nodes: [
          {
            id: firstSave.data[0].id,
            code: '1.0',
            name: 'Persiapan & Survey',
            level: 1,
            weightPercentage: 30,
            children: [
              {
                id: firstSave.data[0].children[0].id,
                code: '1.1',
                name: 'Survey Site',
                level: 2,
                weightPercentage: 30,
              },
            ],
          },
          {
            id: firstSave.data[1].id,
            code: '2.0',
            name: 'Implementasi Infrastruktur FO',
            level: 1,
            weightPercentage: 50,
            children: [
              {
                id: firstSave.data[1].children[0].id,
                code: '2.1',
                name: 'Pengadaan Material',
                level: 2,
                weightPercentage: 25,
              },
              {
                id: firstSave.data[1].children[1].id,
                code: '2.2',
                name: 'Instalasi FO',
                level: 2,
                weightPercentage: 25,
              },
            ],
          },
          {
            id: firstSave.data[2].id,
            code: '3.0',
            name: 'Testing & Handover',
            level: 1,
            weightPercentage: 20,
          },
        ],
      };

      await service.saveWbsTree(2, deletePayload, 5);

      const deletedNode = inMemoryWbsTable.find((w) => w.id === deletedChildId);
      expect(deletedNode).toBeDefined();
      expect(deletedNode.deletedAt).toBeInstanceOf(Date);

      // Active remaining nodes count = 6
      expect(inMemoryWbsTable.filter((w) => !w.deletedAt)).toHaveLength(6);
    });
  });

  describe('3. Validation Rules & Project Isolation Guardrails', () => {
    it('should reject save if root weight sum is not equal to 100%', async () => {
      const invalidWeightPayload: SaveWbsTreeDto = {
        nodes: [
          { code: '1.0', name: 'Task 1', level: 1, weightPercentage: 40 },
          { code: '2.0', name: 'Task 2', level: 1, weightPercentage: 50 }, // Total = 90%
        ],
      };

      await expect(service.saveWbsTree(2, invalidWeightPayload, 5)).rejects.toThrow(BadRequestException);
      await expect(service.saveWbsTree(2, invalidWeightPayload, 5)).rejects.toThrow(/Total bobot Work Package tingkat 1 \(Root\) harus bernilai 100.00%/);
    });

    it('should reject save if depth exceeds 3 levels', async () => {
      const deepPayload: SaveWbsTreeDto = {
        nodes: [
          {
            code: '1.0',
            name: 'Level 1',
            level: 1,
            weightPercentage: 100,
            children: [
              {
                code: '1.1',
                name: 'Level 2',
                level: 2,
                weightPercentage: 100,
                children: [
                  {
                    code: '1.1.1',
                    name: 'Level 3',
                    level: 3,
                    weightPercentage: 100,
                    children: [
                      {
                        code: '1.1.1.1',
                        name: 'Level 4 (Invalid)',
                        level: 4,
                        weightPercentage: 100,
                      } as any,
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      await expect(service.saveWbsTree(2, deepPayload, 5)).rejects.toThrow(BadRequestException);
      await expect(service.saveWbsTree(2, deepPayload, 5)).rejects.toThrow(/Kedalaman WBS maksimal adalah 3 tingkat/);
    });

    it('should reject node IDs belonging to another project (Cross-Project Isolation)', async () => {
      // Put a node in project 1
      inMemoryWbsTable.push({
        id: 999,
        projectId: 1,
        code: '1.0',
        name: 'Project 1 Task',
        level: 1,
        weightPercentage: 100,
      });

      const maliciousPayload: SaveWbsTreeDto = {
        nodes: [
          {
            id: 999, // Belongs to Project #1!
            code: '1.0',
            name: 'Attacking Node',
            level: 1,
            weightPercentage: 100,
          },
        ],
      };

      await expect(service.saveWbsTree(2, maliciousPayload, 5)).rejects.toThrow(BadRequestException);
      await expect(service.saveWbsTree(2, maliciousPayload, 5)).rejects.toThrow(/Invalid WBS node ownership/);
    });

    it('should reject invalid projectId (e.g. 404 project not found)', async () => {
      const validPayload: SaveWbsTreeDto = {
        nodes: [{ code: '1.0', name: 'Task', level: 1, weightPercentage: 100 }],
      };

      await expect(service.saveWbsTree(9999, validPayload, 5)).rejects.toThrow(NotFoundException);
    });
  });
});
