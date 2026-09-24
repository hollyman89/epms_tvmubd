import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
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
import { SaveProjectScheduleDto } from './dto/save-project-schedule.dto';
import { ScheduleValidator } from './schedule.validator';
import { CostEstimateValidator } from './cost-estimate.validator';
import { InitialConditionValidator } from './initial-condition.validator';
import { ManagementReviewValidator } from './management-review.validator';
import { OperationalReadinessValidator } from './operational-readiness.validator';

describe('PHASE 1B.3 — Schedule / Gantt Pre-Approval Planning Persistence & WBS Mapping Unit Tests', () => {
  let service: ProjectService;
  let inMemoryTasksTable: any[];
  let inMemoryWbsTable: any[];
  let nextAutoTaskId: number;

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
    inMemoryTasksTable = [];
    inMemoryWbsTable = [...mockProject2WbsNodes];
    nextAutoTaskId = 100;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        ScheduleValidator,
        CostEstimateValidator,
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
          provide: getRepositoryToken(Task),
          useValue: {
            find: jest.fn().mockImplementation(({ where }) => {
              const pId = where.projectId;
              return Promise.resolve(inMemoryTasksTable.filter((t) => t.projectId === pId && !t.deletedAt));
            }),
            findOne: jest.fn().mockImplementation(({ where }) => {
              const pId = where.projectId;
              const id = where.id;
              return Promise.resolve(inMemoryTasksTable.find((t) => (t.projectId === pId || !pId) && t.id === id && !t.deletedAt) || null);
            }),
            manager: {
              transaction: jest.fn(async (cb) => {
                const fakeManager = {
                  find: jest.fn().mockImplementation((entityClass, { where }) => {
                    if (entityClass === Task) {
                      const pId = where.projectId;
                      return Promise.resolve(inMemoryTasksTable.filter((t) => t.projectId === pId && !t.deletedAt));
                    }
                    return Promise.resolve([]);
                  }),
                  create: jest.fn((entityClass, data) => {
                    return {
                      id: ++nextAutoTaskId,
                      ...data,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    };
                  }),
                  save: jest.fn((entityClass, entity) => {
                    if (entityClass === Task) {
                      const existingIdx = inMemoryTasksTable.findIndex((t) => t.id === entity.id);
                      if (existingIdx >= 0) {
                        inMemoryTasksTable[existingIdx] = { ...inMemoryTasksTable[existingIdx], ...entity, updatedAt: new Date() };
                        return Promise.resolve(inMemoryTasksTable[existingIdx]);
                      } else {
                        inMemoryTasksTable.push(entity);
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
          provide: getRepositoryToken(ProjectCostEstimate),
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(CostItem),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(Contract),
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn().mockResolvedValue([{ id: 1 }, { id: 5 }]),
          },
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

  describe('1. Schedule Load & Empty State', () => {
    it('should return legitimate empty schedule structure for Project #2 with no tasks', async () => {
      const res = await service.getProjectSchedule(2);
      expect(res).toBeDefined();
      expect(res.projectId).toBe(2);
      expect(res.tasks).toEqual([]);
      expect(res.summary.scheduledTaskCount).toBe(0);
      expect(mockPlanningProject2.status).toBe('PLANNING'); // Preserved PLANNING
    });

    it('should throw NotFoundException for non-existent project', async () => {
      await expect(service.getProjectSchedule(9999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('2. Schedule Save & WBS Leaf Mapping Persistence', () => {
    const validScheduleDto: SaveProjectScheduleDto = {
      pmNotes: 'Jadwal operasional awal rollout Karawang',
      tasks: [
        {
          wbsId: 34, // Leaf 1.1: Survey Site
          name: 'Survey Site Lapangan',
          startDate: '2026-09-01',
          endDate: '2026-09-05',
          dependencyType: 'FS',
        },
        {
          wbsId: 35, // Leaf 1.2: Perizinan Kawasan
          name: 'Perizinan Kawasan Industri',
          startDate: '2026-09-06',
          endDate: '2026-09-12',
          dependencyType: 'FS',
        },
        {
          wbsId: 37, // Leaf 2.1: Pengadaan Tiang & Kabel
          name: 'Pengadaan Material & Logistik FO',
          startDate: '2026-09-13',
          endDate: '2026-09-20',
          dependencyType: 'FS',
        },
        {
          wbsId: 38, // Leaf 2.2: Penarikan Kabel & Splicing
          name: 'Penarikan Kabel & Splicing FO',
          startDate: '2026-09-21',
          endDate: '2026-09-30',
          dependencyType: 'FS',
        },
        {
          wbsId: 39, // Leaf 3.0: Testing & Handover
          name: 'Milestone Uji Terima (Handover)',
          type: 'MILESTONE',
          startDate: '2026-10-01',
          dependencyType: 'FS',
        },
      ],
    };

    it('should successfully save schedule tasks for Project #2 with status PLANNING', async () => {
      const res = await service.saveProjectSchedule(2, validScheduleDto, 5);

      expect(res).toBeDefined();
      expect(res.projectId).toBe(2);
      expect(res.tasks).toHaveLength(5);
      expect(mockPlanningProject2.status).toBe('PLANNING'); // Preserved PLANNING

      // Verify task fields
      const task1 = res.tasks.find((t: any) => t.wbsId === 34);
      expect(task1).toBeDefined();
      expect(task1.id).toBeDefined();
      expect(task1.wbsCode).toBe('1.1');
      expect(task1.duration).toBe(4); // 2026-09-05 - 2026-09-01 = 4 days difference

      const milestone = res.tasks.find((t: any) => t.wbsId === 39);
      expect(milestone).toBeDefined();
      expect(milestone.isMilestone).toBe(true);
      expect(milestone.duration).toBe(0);

      // Verify inMemory table
      expect(inMemoryTasksTable).toHaveLength(5);
      expect(inMemoryTasksTable.every((t) => t.projectId === 2)).toBe(true);
    });

    it('should preserve task database IDs and update in-place on subsequent saves', async () => {
      // First save
      const firstSave = await service.saveProjectSchedule(2, validScheduleDto, 5);
      const originalTaskIds = firstSave.tasks.map((t: any) => t.id);

      // Edit task dates with same IDs
      const editScheduleDto: SaveProjectScheduleDto = {
        tasks: firstSave.tasks.map((t: any, idx: number) => ({
          id: t.id,
          wbsId: t.wbsId,
          name: `${t.name} (Updated)`,
          startDate: t.startDate,
          endDate: t.isMilestone ? undefined : t.endDate,
          isMilestone: t.isMilestone,
          dependencyType: 'FS',
        })),
      };

      const secondSave = await service.saveProjectSchedule(2, editScheduleDto, 5);
      const updatedTaskIds = secondSave.tasks.map((t: any) => t.id);

      expect(updatedTaskIds).toEqual(originalTaskIds);
      expect(secondSave.tasks[0].name).toContain('(Updated)');
    });

    it('should establish and preserve Finish-to-Start predecessor dependencies', async () => {
      // Save Task A
      const initialSave = await service.saveProjectSchedule(2, validScheduleDto, 5);
      const surveyTaskId = initialSave.tasks.find((t: any) => t.wbsId === 34).id;

      // Save Task B with predecessor = Task A
      const depScheduleDto: SaveProjectScheduleDto = {
        tasks: [
          {
            id: surveyTaskId,
            wbsId: 34,
            name: 'Survey Site Lapangan',
            startDate: '2026-09-01',
            endDate: '2026-09-05',
          },
          {
            id: initialSave.tasks.find((t: any) => t.wbsId === 35).id,
            wbsId: 35,
            name: 'Perizinan Kawasan Industri',
            startDate: '2026-09-06',
            endDate: '2026-09-12',
            predecessorTaskId: surveyTaskId, // Predecessor to Task A
          },
        ],
      };

      const depSave = await service.saveProjectSchedule(2, depScheduleDto, 5);
      const taskB = depSave.tasks.find((t: any) => t.wbsId === 35);
      expect(taskB.predecessorTaskId).toBe(surveyTaskId);
    });

    it('should soft-delete omitted tasks when updating schedule', async () => {
      // First save with 5 tasks
      const initialSave = await service.saveProjectSchedule(2, validScheduleDto, 5);
      const keptTaskId = initialSave.tasks[0].id;
      const removedTaskId = initialSave.tasks[1].id;

      // Second save with only 1 task
      const reducedDto: SaveProjectScheduleDto = {
        tasks: [
          {
            id: keptTaskId,
            wbsId: 34,
            name: 'Survey Site Lapangan',
            startDate: '2026-09-01',
            endDate: '2026-09-05',
          },
        ],
      };

      await service.saveProjectSchedule(2, reducedDto, 5);

      const removedDbTask = inMemoryTasksTable.find((t) => t.id === removedTaskId);
      expect(removedDbTask).toBeDefined();
      expect(removedDbTask.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('3. Validation Guardrails & Isolation', () => {
    it('should reject mapping a task to a non-leaf WBS node (Parent Package)', async () => {
      const invalidParentMappingDto: SaveProjectScheduleDto = {
        tasks: [
          {
            wbsId: 36, // Node 36 is Parent Package "2.0 Implementasi Infrastruktur FO"
            name: 'Paket Utama Infrastruktur',
            startDate: '2026-09-01',
            endDate: '2026-09-10',
          },
        ],
      };

      await expect(service.saveProjectSchedule(2, invalidParentMappingDto, 5)).rejects.toThrow(BadRequestException);
      await expect(service.saveProjectSchedule(2, invalidParentMappingDto, 5)).rejects.toThrow(/bukan leaf node/);
    });

    it('should reject mapping a task to a WBS node belonging to another project', async () => {
      inMemoryWbsTable.push({
        id: 99,
        projectId: 1, // Project 1
        code: '1.0',
        name: 'Project 1 Scope',
        level: 1,
        parentWbsId: null,
      });

      const crossProjectDto: SaveProjectScheduleDto = {
        tasks: [
          {
            wbsId: 99,
            name: 'Cross Project Scope Task',
            startDate: '2026-09-01',
            endDate: '2026-09-10',
          },
        ],
      };

      await expect(service.saveProjectSchedule(2, crossProjectDto, 5)).rejects.toThrow(BadRequestException);
      await expect(service.saveProjectSchedule(2, crossProjectDto, 5)).rejects.toThrow(/tidak ditemukan atau bukan milik proyek #2/);
    });

    it('should reject updating a task ID belonging to another project', async () => {
      inMemoryTasksTable.push({
        id: 999,
        projectId: 1, // Project 1
        wbsId: 99,
        name: 'Project 1 Task',
      });

      const crossProjectTaskDto: SaveProjectScheduleDto = {
        tasks: [
          {
            id: 999, // Task belongs to Project 1
            wbsId: 34,
            name: 'Hacked Task',
            startDate: '2026-09-01',
            endDate: '2026-09-10',
          },
        ],
      };

      await expect(service.saveProjectSchedule(2, crossProjectTaskDto, 5)).rejects.toThrow(BadRequestException);
      await expect(service.saveProjectSchedule(2, crossProjectTaskDto, 5)).rejects.toThrow(/tidak ditemukan pada proyek #2/);
    });

    it('should reject invalid date range (startDate > endDate)', async () => {
      const invalidDateDto: SaveProjectScheduleDto = {
        tasks: [
          {
            wbsId: 34,
            name: 'Invalid Date Task',
            startDate: '2026-09-10',
            endDate: '2026-09-01', // Before start date!
          },
        ],
      };

      await expect(service.saveProjectSchedule(2, invalidDateDto, 5)).rejects.toThrow(BadRequestException);
      await expect(service.saveProjectSchedule(2, invalidDateDto, 5)).rejects.toThrow(/tidak boleh sebelum tanggal mulai/);
    });

    it('should reject self-referencing dependency (predecessorTaskId === id)', async () => {
      const selfRefDto: SaveProjectScheduleDto = {
        tasks: [
          {
            id: 101,
            wbsId: 34,
            name: 'Self Dep Task',
            startDate: '2026-09-01',
            endDate: '2026-09-05',
            predecessorTaskId: 101, // Self predecessor
          },
        ],
      };

      inMemoryTasksTable.push({
        id: 101,
        projectId: 2,
        wbsId: 34,
        name: 'Self Dep Task',
      });

      await expect(service.saveProjectSchedule(2, selfRefDto, 5)).rejects.toThrow(BadRequestException);
      await expect(service.saveProjectSchedule(2, selfRefDto, 5)).rejects.toThrow(/tidak boleh menjadi predecessor untuk dirinya sendiri/);
    });
  });
});
