import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { ScheduleValidator } from './schedule.validator';
import { CostEstimateValidator } from './cost-estimate.validator';
import { Project } from '../../entities/project.entity';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { Task } from '../../entities/task.entity';
import { Contract } from '../../entities/contract.entity';
import { User } from '../../entities/user.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { SaveProjectScheduleDto } from './dto/save-project-schedule.dto';

describe('ProjectService & ProjectController — Schedule Phase R11.1.4-C', () => {
  let service: ProjectService;
  let controller: ProjectController;
  let mockWbsRepo: any;
  let mockProjectRepo: any;
  let mockTaskRepo: any;
  let mockUserRepo: any;
  let mockManager: any;

  const mockProjectA: Partial<Project> = {
    id: 10,
    name: 'Rollout FTTH Jakarta Timur',
    code: 'PRJ-2026-FTTH-01',
    managerId: 1,
  };

  const mockProjectB: Partial<Project> = {
    id: 20,
    name: 'Rollout FTTH Surabaya',
    code: 'PRJ-2026-FTTH-02',
    managerId: 1,
  };

  const mockActiveWbsNodes: Partial<WorkBreakdownStructure>[] = [
    {
      id: 101,
      projectId: 10,
      parentWbsId: null as any,
      code: '1.0',
      name: 'Pekerjaan Persiapan (Parent)',
      level: 1,
      deletedAt: null as any,
    },
    {
      id: 102,
      projectId: 10,
      parentWbsId: 101,
      code: '1.1',
      name: 'Survey & Perizinan (Leaf)',
      level: 2,
      deletedAt: null as any,
    },
    {
      id: 103,
      projectId: 10,
      parentWbsId: null as any,
      code: '2.0',
      name: 'Penggelaran Kabel (Parent)',
      level: 1,
      deletedAt: null as any,
    },
    {
      id: 104,
      projectId: 10,
      parentWbsId: 103,
      code: '2.1',
      name: 'Penarikan Kabel FO 48C (Leaf)',
      level: 2,
      deletedAt: null as any,
    },
    {
      id: 201,
      projectId: 20,
      parentWbsId: null as any,
      code: '1.1',
      name: 'Surabaya Survey (Leaf)',
      level: 2,
      deletedAt: null as any,
    },
  ];

  let inMemoryTasks: any[] = [];
  let nextTaskId = 1001;

  beforeEach(async () => {
    inMemoryTasks = [];
    nextTaskId = 1001;

    mockManager = {
      findOne: jest.fn().mockImplementation((entityClass, options) => {
        if (entityClass === Task) {
          const id = options?.where?.id;
          return inMemoryTasks.find((t) => t.id === id && !t.deletedAt) || null;
        }
        return null;
      }),
      find: jest.fn().mockImplementation((entityClass, options) => {
        if (entityClass === Task) {
          const projId = options?.where?.projectId;
          return inMemoryTasks.filter((t) => t.projectId === projId && !t.deletedAt);
        }
        return [];
      }),
      create: jest.fn().mockImplementation((entityClass, dto) => {
        return { ...dto };
      }),
      save: jest.fn().mockImplementation((entityClass, entity) => {
        if (entity.id) {
          const idx = inMemoryTasks.findIndex((t) => t.id === entity.id);
          if (idx >= 0) {
            inMemoryTasks[idx] = { ...inMemoryTasks[idx], ...entity };
            return inMemoryTasks[idx];
          }
        }
        const maxId = inMemoryTasks.reduce((max, t) => Math.max(max, t.id || 0), 1000);
        const newId = Math.max(nextTaskId++, maxId + 1);
        const created = {
          ...entity,
          id: newId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        inMemoryTasks.push(created);
        return created;
      }),
    };

    mockProjectRepo = {
      findOne: jest.fn().mockImplementation((options) => {
        const id = options?.where?.id;
        if (id === 10) return Promise.resolve(mockProjectA);
        if (id === 20) return Promise.resolve(mockProjectB);
        return Promise.resolve(null);
      }),
    };

    mockWbsRepo = {
      find: jest.fn().mockImplementation((options) => {
        const projId = options?.where?.projectId;
        return Promise.resolve(mockActiveWbsNodes.filter((w) => w.projectId === projId));
      }),
    };

    mockTaskRepo = {
      find: jest.fn().mockImplementation((options) => {
        const projId = options?.where?.projectId;
        return Promise.resolve(inMemoryTasks.filter((t) => t.projectId === projId && !t.deletedAt));
      }),
      findOne: jest.fn().mockImplementation((options) => {
        const id = options?.where?.id;
        return Promise.resolve(inMemoryTasks.find((t) => t.id === id && !t.deletedAt) || null);
      }),
      manager: {
        transaction: jest.fn().mockImplementation((cb) => cb(mockManager)),
      },
    };

    mockUserRepo = {
      find: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        ProjectService,
        ScheduleValidator,
        CostEstimateValidator,
        { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
        { provide: getRepositoryToken(WorkBreakdownStructure), useValue: mockWbsRepo },
        { provide: getRepositoryToken(Task), useValue: mockTaskRepo },
        { provide: getRepositoryToken(Contract), useValue: {} },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(ProjectCostEstimate), useValue: {} },
        { provide: getRepositoryToken(CostItem), useValue: {} },
        { provide: getRepositoryToken(PurchaseRequest), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    controller = module.get<ProjectController>(ProjectController);
  });

  describe('GET /api/v1/project/:projectId/schedule', () => {
    it('CASE 21: GET returns canonical format with WBS code/name and summary', async () => {
      inMemoryTasks.push({
        id: 101,
        projectId: 10,
        wbsId: 102,
        name: 'Survey Lapangan',
        isMilestone: false,
        startDate: '2026-09-01',
        endDate: '2026-09-05',
        duration: 4,
        progress: 0,
        status: 'PLANNED',
        deletedAt: null,
      });

      const res = await service.getProjectSchedule(10);
      expect(res.projectId).toBe(10);
      expect(res.tasks.length).toBe(1);
      expect(res.tasks[0].name).toBe('Survey Lapangan');
      expect(res.tasks[0].wbsCode).toBe('1.1');
      expect(res.tasks[0].wbsName).toBe('Survey & Perizinan (Leaf)');
      expect(res.summary.totalTaskCount).toBe(1);
      expect(res.summary.totalDuration).toBe(4);
    });

    it('CASE 22: project isolation in GET (project A returns only project A tasks)', async () => {
      inMemoryTasks.push(
        { id: 101, projectId: 10, wbsId: 102, name: 'Project 10 Task', deletedAt: null },
        { id: 201, projectId: 20, wbsId: 201, name: 'Project 20 Task', deletedAt: null },
      );

      const resA = await service.getProjectSchedule(10);
      expect(resA.tasks.length).toBe(1);
      expect(resA.tasks[0].name).toBe('Project 10 Task');

      const resB = await service.getProjectSchedule(20);
      expect(resB.tasks.length).toBe(1);
      expect(resB.tasks[0].name).toBe('Project 20 Task');
    });
  });

  describe('PUT /api/v1/project/:projectId/schedule & Identity Preservation', () => {
    it('CASE 23: first PUT creates tasks with auto-generated IDs', async () => {
      const dto: SaveProjectScheduleDto = {
        pmNotes: 'Initial Schedule Baseline',
        tasks: [
          {
            wbsId: 102,
            name: 'Survey Lapangan',
            startDate: '2026-09-01',
            endDate: '2026-09-05',
          },
        ],
      };

      const res = await service.saveProjectSchedule(10, dto, 1);
      expect(res.tasks.length).toBe(1);
      expect(res.tasks[0].id).toBe(1001);
      expect(res.tasks[0].duration).toBe(4);
      expect(res.pmNotes).toBe('Initial Schedule Baseline');
    });

    it('CASE 24: second PUT preserves existing task ID (stable identity)', async () => {
      // Pre-seed task #1001
      inMemoryTasks.push({
        id: 1001,
        projectId: 10,
        wbsId: 102,
        name: 'Survey Lapangan',
        isMilestone: false,
        startDate: '2026-09-01',
        endDate: '2026-09-05',
        duration: 4,
        status: 'PLANNED',
        deletedAt: null,
      });

      const dto: SaveProjectScheduleDto = {
        tasks: [
          {
            id: 1001, // sending existing ID
            wbsId: 102,
            name: 'Survey Lapangan (Updated Name)',
            startDate: '2026-09-01',
            endDate: '2026-09-06',
          },
        ],
      };

      const res = await service.saveProjectSchedule(10, dto, 1);
      expect(res.tasks.length).toBe(1);
      expect(res.tasks[0].id).toBe(1001); // ID preserved!
      expect(res.tasks[0].name).toBe('Survey Lapangan (Updated Name)');
      expect(res.tasks[0].duration).toBe(5);
    });

    it('CASE 25 & 26: editing existing task preserves ID and adding new task creates fresh ID', async () => {
      inMemoryTasks.push({
        id: 1001,
        projectId: 10,
        wbsId: 102,
        name: 'Task 1',
        startDate: '2026-09-01',
        endDate: '2026-09-05',
        duration: 4,
        deletedAt: null,
      });

      const dto: SaveProjectScheduleDto = {
        tasks: [
          {
            id: 1001,
            wbsId: 102,
            name: 'Task 1 Updated',
            startDate: '2026-09-01',
            endDate: '2026-09-05',
          },
          {
            // new task without ID
            wbsId: 104,
            name: 'Task 2 New',
            startDate: '2026-09-06',
            endDate: '2026-09-10',
          },
        ],
      };

      const res = await service.saveProjectSchedule(10, dto, 1);
      expect(res.tasks.length).toBe(2);
      expect(res.tasks[0].id).toBe(1001);
      expect(res.tasks[1].id).toBe(1002);
    });

    it('CASE 27: omitted active task from payload is soft-deleted', async () => {
      inMemoryTasks.push(
        {
          id: 1001,
          projectId: 10,
          wbsId: 102,
          name: 'Task 1 to Keep',
          deletedAt: null,
        },
        {
          id: 1002,
          projectId: 10,
          wbsId: 104,
          name: 'Task 2 to Remove',
          deletedAt: null,
        },
      );

      const dto: SaveProjectScheduleDto = {
        tasks: [
          {
            id: 1001,
            wbsId: 102,
            name: 'Task 1 to Keep',
          },
        ],
      };

      const res = await service.saveProjectSchedule(10, dto, 1);
      expect(res.tasks.length).toBe(1);
      expect(res.tasks[0].id).toBe(1001);

      // Verify task 1002 has deletedAt set in inMemoryTasks
      const deleted = inMemoryTasks.find((t) => t.id === 1002);
      expect(deleted.deletedAt).toBeDefined();
    });

    it('CASE 28: cross-project task update is blocked', async () => {
      // Task 2001 belongs to project 20
      inMemoryTasks.push({
        id: 2001,
        projectId: 20,
        wbsId: 201,
        name: 'Surabaya Task',
        deletedAt: null,
      });

      const dto: SaveProjectScheduleDto = {
        tasks: [
          {
            id: 2001, // Attacking Project 10 with Project 20's Task ID
            wbsId: 102,
            name: 'Malicious Update',
          },
        ],
      };

      await expect(service.saveProjectSchedule(10, dto, 1)).rejects.toThrow(
        /Task ID #2001 tidak ditemukan pada proyek #10/i,
      );
    });

    it('CASE 29: cross-project WBS is blocked', async () => {
      const dto: SaveProjectScheduleDto = {
        tasks: [
          {
            wbsId: 201, // WBS 201 belongs to project 20
            name: 'Task with cross project WBS',
          },
        ],
      };

      await expect(service.saveProjectSchedule(10, dto, 1)).rejects.toThrow(
        /WBS ID #201 tidak ditemukan atau bukan milik proyek #10/i,
      );
    });

    it('CASE 30: atomic rollback on failure', async () => {
      const dto: SaveProjectScheduleDto = {
        tasks: [
          {
            wbsId: 102,
            name: 'Task with invalid dates',
            startDate: '2026-09-10',
            endDate: '2026-09-01', // Invalid!
          },
        ],
      };

      await expect(service.saveProjectSchedule(10, dto, 1)).rejects.toThrow(BadRequestException);
      // No tasks saved
      expect(inMemoryTasks.length).toBe(0);
    });

    it('CASE 31: duration is recalculated server-side upon save', async () => {
      const dto: SaveProjectScheduleDto = {
        tasks: [
          {
            wbsId: 102,
            name: 'Civil Works',
            startDate: '2026-09-01',
            endDate: '2026-09-11',
            duration: 999, // Client fake duration
          },
        ],
      };

      const res = await service.saveProjectSchedule(10, dto, 1);
      expect(res.tasks[0].duration).toBe(10); // 2026-09-11 - 2026-09-01 = 10
    });

    it('CASE 32: milestone duration is always 0 upon save', async () => {
      const dto: SaveProjectScheduleDto = {
        tasks: [
          {
            wbsId: 102,
            name: 'Kickoff Signoff Milestone',
            isMilestone: true,
            startDate: '2026-09-01',
            duration: 25,
          },
        ],
      };

      const res = await service.saveProjectSchedule(10, dto, 1);
      expect(res.tasks[0].isMilestone).toBe(true);
      expect(res.tasks[0].duration).toBe(0);
      expect(res.tasks[0].endDate).toBeNull();
    });

    it('CASE 33: predecessor cycle is rejected during save', async () => {
      inMemoryTasks.push(
        { id: 101, projectId: 10, wbsId: 102, name: 'Task A', deletedAt: null },
        { id: 102, projectId: 10, wbsId: 104, name: 'Task B', deletedAt: null },
      );

      const dto: SaveProjectScheduleDto = {
        tasks: [
          {
            id: 101,
            wbsId: 102,
            name: 'Task A',
            predecessorTaskId: 102, // A -> B
          },
          {
            id: 102,
            wbsId: 104,
            name: 'Task B',
            predecessorTaskId: 101, // B -> A (Cycle!)
          },
        ],
      };

      await expect(service.saveProjectSchedule(10, dto, 1)).rejects.toThrow(/circular dependency/i);
    });

    it('CASE 34: FS date rule is enforced during save', async () => {
      inMemoryTasks.push({
        id: 101,
        projectId: 10,
        wbsId: 102,
        name: 'Task A',
        startDate: '2026-09-01',
        endDate: '2026-09-10',
        deletedAt: null,
      });

      const dto: SaveProjectScheduleDto = {
        tasks: [
          {
            id: 101,
            wbsId: 102,
            name: 'Task A',
            startDate: '2026-09-01',
            endDate: '2026-09-10',
          },
          {
            wbsId: 104,
            name: 'Task B',
            startDate: '2026-09-05', // Started before Task A ends!
            endDate: '2026-09-15',
            predecessorTaskId: 101,
          },
        ],
      };

      await expect(service.saveProjectSchedule(10, dto, 1)).rejects.toThrow(
        /dimulai.*sebelum predecessor.*selesai/i,
      );
    });

    it('CASE 35: soft-deleted tasks are excluded from GET project schedule', async () => {
      inMemoryTasks.push(
        {
          id: 101,
          projectId: 10,
          wbsId: 102,
          name: 'Active Task',
          deletedAt: null,
        },
        {
          id: 102,
          projectId: 10,
          wbsId: 104,
          name: 'Deleted Task',
          deletedAt: new Date(), // Soft deleted
        },
      );

      const res = await service.getProjectSchedule(10);
      expect(res.tasks.length).toBe(1);
      expect(res.tasks[0].id).toBe(101);
    });

    it('CASE 36: Concurrency model (Last-Write-Wins atomic save replaces baseline cleanly)', async () => {
      // First PM saves schedule
      const dto1: SaveProjectScheduleDto = {
        pmNotes: 'PM 1 Baseline',
        tasks: [
          {
            wbsId: 102,
            name: 'Task PM 1',
            startDate: '2026-09-01',
            endDate: '2026-09-05',
          },
        ],
      };
      const res1 = await service.saveProjectSchedule(10, dto1, 1);
      expect(res1.tasks.length).toBe(1);
      expect(res1.tasks[0].name).toBe('Task PM 1');

      // Second PM saves schedule (Last-Write-Wins)
      const dto2: SaveProjectScheduleDto = {
        pmNotes: 'PM 2 Updated Baseline',
        tasks: [
          {
            wbsId: 104,
            name: 'Task PM 2 Replaced',
            startDate: '2026-09-02',
            endDate: '2026-09-08',
          },
        ],
      };
      const res2 = await service.saveProjectSchedule(10, dto2, 2, ['SUPER_ADMIN']);
      expect(res2.tasks.length).toBe(1);
      expect(res2.tasks[0].name).toBe('Task PM 2 Replaced');
      expect(res2.pmNotes).toBe('PM 2 Updated Baseline');
    });

    it('CASE 37: Audit user identity is correctly stamped on createdBy, updatedBy, and deletedBy', async () => {
      // Step 1: Create Task with User 77
      const dto1: SaveProjectScheduleDto = {
        tasks: [
          { wbsId: 102, name: 'Task A' },
          { wbsId: 104, name: 'Task B' },
        ],
      };
      await service.saveProjectSchedule(10, dto1, 77, ['SUPER_ADMIN']);

      const taskA = inMemoryTasks.find((t) => t.name === 'Task A');
      const taskB = inMemoryTasks.find((t) => t.name === 'Task B');
      expect(taskA.createdBy).toBe(77);
      expect(taskB.createdBy).toBe(77);

      // Step 2: User 88 updates Task A and omits Task B
      const dto2: SaveProjectScheduleDto = {
        tasks: [
          { id: taskA.id, wbsId: 102, name: 'Task A Modified' },
        ],
      };
      await service.saveProjectSchedule(10, dto2, 88, ['SUPER_ADMIN']);

      expect(taskA.updatedBy).toBe(88);
      expect(taskB.deletedBy).toBe(88);
      expect(taskB.deletedAt).toBeDefined();
    });
  });

  describe('Controller RBAC and Auth Identity', () => {
    it('should throw UnauthorizedException if req.user has no identity', async () => {
      await expect(
        controller.saveProjectSchedule(10, { tasks: [] }, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should route saveProjectSchedule with authenticated user ID', async () => {
      const dto: SaveProjectScheduleDto = {
        tasks: [
          {
            wbsId: 102,
            name: 'Survey Task',
            startDate: '2026-09-01',
            endDate: '2026-09-05',
          },
        ],
      };

      const res = await controller.saveProjectSchedule(10, dto, {
        user: { id: 1, role: 'PROJECT_MANAGER' },
      });
      expect(res.tasks.length).toBe(1);
      expect(res.tasks[0].id).toBe(1001);
    });
  });
});
