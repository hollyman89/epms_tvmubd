import { BadRequestException } from '@nestjs/common';
import { ScheduleValidator } from './schedule.validator';
import { SaveProjectScheduleDto } from './dto/save-project-schedule.dto';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { Task } from '../../entities/task.entity';
import { User } from '../../entities/user.entity';

describe('R11.1.4-C — Schedule DTO & Validator Unit Tests', () => {
  let validator: ScheduleValidator;

  const mockProjectWbs: WorkBreakdownStructure[] = [
    {
      id: 1,
      projectId: 1,
      code: '1.0',
      name: 'Project Phases (Root)',
      level: 1,
      parentWbsId: null,
    } as any,
    {
      id: 2,
      projectId: 1,
      code: '1.1',
      name: 'Planning & Survey (Parent)',
      level: 2,
      parentWbsId: 1,
    } as any,
    {
      id: 3,
      projectId: 1,
      code: '1.1.1',
      name: 'Site Field Survey (Leaf)',
      level: 3,
      parentWbsId: 2,
    } as any,
    {
      id: 4,
      projectId: 1,
      code: '1.1.2',
      name: 'Permit Approval (Leaf)',
      level: 3,
      parentWbsId: 2,
    } as any,
    {
      id: 5,
      projectId: 1,
      code: '1.2.1',
      name: 'Civil Fiber Pulling (Leaf)',
      level: 3,
      parentWbsId: 1,
    } as any,
    {
      id: 99,
      projectId: 2,
      code: '1.1.1',
      name: 'Other Project WBS',
      level: 3,
      parentWbsId: null,
    } as any,
  ];

  const mockUsers: User[] = [
    { id: 10, username: 'pm_user' } as any,
    { id: 11, username: 'tech_lead' } as any,
  ];

  beforeEach(() => {
    validator = new ScheduleValidator();
  });

  it('CASE 1: valid task under leaf WBS passes validation', () => {
    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          wbsId: 3,
          name: 'Survey Titik Fiber Optic',
          isMilestone: false,
          startDate: '2026-09-01',
          endDate: '2026-09-05',
          progress: 0,
          status: 'PLANNED',
        },
      ],
    };

    const result = validator.validateAndCompute(1, dto, mockProjectWbs, [], mockUsers);
    expect(result).toBeDefined();
    expect(result.tasks.length).toBe(1);
    expect(result.tasks[0].duration).toBe(4);
    expect(result.tasks[0].wbsCode).toBe('1.1.1');
    expect(result.summary.totalDuration).toBe(4);
  });

  it('CASE 2: missing wbsId should throw BadRequestException', () => {
    const dto: any = {
      tasks: [
        {
          name: 'Task without WBS',
          startDate: '2026-09-01',
          endDate: '2026-09-05',
        },
      ],
    };

    expect(() => validator.validateAndCompute(1, dto, mockProjectWbs, [], mockUsers)).toThrow(
      BadRequestException,
    );
  });

  it('CASE 3: task under WBS parent node (non-leaf) should be blocked', () => {
    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          wbsId: 2, // 1.1 Planning & Survey is a parent of 1.1.1 & 1.1.2
          name: 'Task under parent node',
          startDate: '2026-09-01',
          endDate: '2026-09-05',
        },
      ],
    };

    expect(() => validator.validateAndCompute(1, dto, mockProjectWbs, [], mockUsers)).toThrow(
      /bukan leaf node/i,
    );
  });

  it('CASE 4: task under WBS belonging to another project should be blocked', () => {
    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          wbsId: 99, // belongs to project 2
          name: 'Cross project WBS task',
          startDate: '2026-09-01',
          endDate: '2026-09-05',
        },
      ],
    };

    expect(() => validator.validateAndCompute(1, dto, mockProjectWbs, [], mockUsers)).toThrow(
      /bukan milik proyek/i,
    );
  });

  it('CASE 5: task under soft-deleted WBS should be blocked', () => {
    // Only pass active WBS (soft-deleted is excluded prior to passing)
    const activeWbs = mockProjectWbs.filter((w) => w.id !== 4);
    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          wbsId: 4,
          name: 'Task on deleted WBS',
          startDate: '2026-09-01',
          endDate: '2026-09-05',
        },
      ],
    };

    expect(() => validator.validateAndCompute(1, dto, activeWbs, [], mockUsers)).toThrow(
      /tidak ditemukan atau bukan milik proyek/i,
    );
  });

  it('CASE 6: startDate > endDate should be blocked with BadRequestException', () => {
    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          wbsId: 3,
          name: 'Invalid date task',
          startDate: '2026-09-10',
          endDate: '2026-09-01',
        },
      ],
    };

    expect(() => validator.validateAndCompute(1, dto, mockProjectWbs, [], mockUsers)).toThrow(
      /tidak boleh sebelum tanggal mulai/i,
    );
  });

  it('CASE 7: milestone with endDate should normalize endDate to null', () => {
    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          wbsId: 3,
          name: 'Kickoff Signoff Milestone',
          isMilestone: true,
          startDate: '2026-09-01',
          endDate: '2026-09-10', // client tried to supply endDate
        },
      ],
    };

    const result = validator.validateAndCompute(1, dto, mockProjectWbs, [], mockUsers);
    expect(result.tasks[0].isMilestone).toBe(true);
    expect(result.tasks[0].endDate).toBeNull();
  });

  it('CASE 8: milestone duration must be forced to 0 regardless of client payload', () => {
    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          wbsId: 3,
          name: 'Charter Approval Milestone',
          isMilestone: true,
          startDate: '2026-09-01',
          duration: 10, // client sent 10
        },
      ],
    };

    const result = validator.validateAndCompute(1, dto, mockProjectWbs, [], mockUsers);
    expect(result.tasks[0].duration).toBe(0);
  });

  it('CASE 9: task duration is server-derived from endDate - startDate', () => {
    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          wbsId: 3,
          name: 'Field Survey',
          isMilestone: false,
          startDate: '2026-09-01',
          endDate: '2026-09-10',
          duration: 999, // client sent fake duration
        },
      ],
    };

    const result = validator.validateAndCompute(1, dto, mockProjectWbs, [], mockUsers);
    expect(result.tasks[0].duration).toBe(9); // 2026-09-10 minus 2026-09-01 = 9 days
  });

  it('CASE 10: invalid progress (< 0 or > 100) should be blocked', () => {
    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          wbsId: 3,
          name: 'Task with invalid progress',
          progress: 150,
        },
      ],
    };

    expect(() => validator.validateAndCompute(1, dto, mockProjectWbs, [], mockUsers)).toThrow(
      /antara 0\.00 dan 100\.00/i,
    );
  });

  it('CASE 11: invalid status should be blocked', () => {
    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          wbsId: 3,
          name: 'Task with unknown status',
          status: 'SUPER_DONE',
        },
      ],
    };

    expect(() => validator.validateAndCompute(1, dto, mockProjectWbs, [], mockUsers)).toThrow(
      /Status "SUPER_DONE" tidak valid/i,
    );
  });

  it('CASE 12: invalid dependencyType (!= FS) should be blocked', () => {
    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          wbsId: 3,
          name: 'Task with SS dependency',
          dependencyType: 'SS',
        },
      ],
    };

    expect(() => validator.validateAndCompute(1, dto, mockProjectWbs, [], mockUsers)).toThrow(
      /hanya tipe "FS"/i,
    );
  });

  it('CASE 13: predecessor belonging to another project should be blocked', () => {
    const existingOtherProjectTask: Task = {
      id: 50,
      projectId: 2, // other project
      wbsId: 99,
      name: 'Other project task',
    } as any;

    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          wbsId: 3,
          name: 'Task with cross-project predecessor',
          predecessorTaskId: 50,
        },
      ],
    };

    expect(() =>
      validator.validateAndCompute(1, dto, mockProjectWbs, [existingOtherProjectTask], mockUsers),
    ).toThrow(/Predecessor Task.*bukan milik proyek/i);
  });

  it('CASE 14: self-predecessor reference should be blocked', () => {
    const existingTask: Task = {
      id: 10,
      projectId: 1,
      wbsId: 3,
      name: 'Self referencing task',
    } as any;

    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          id: 10,
          wbsId: 3,
          name: 'Self referencing task',
          predecessorTaskId: 10,
        },
      ],
    };

    expect(() =>
      validator.validateAndCompute(1, dto, mockProjectWbs, [existingTask], mockUsers),
    ).toThrow(/tidak boleh menjadi predecessor untuk dirinya sendiri/i);
  });

  it('CASE 15: circular dependency cycle (A -> B -> C -> A) should be blocked', () => {
    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          id: 101,
          wbsId: 3,
          name: 'Task A',
          startDate: '2026-09-01',
          endDate: '2026-09-05',
          predecessorTaskId: 103, // A depends on C
        },
        {
          id: 102,
          wbsId: 4,
          name: 'Task B',
          startDate: '2026-09-05',
          endDate: '2026-09-10',
          predecessorTaskId: 101, // B depends on A
        },
        {
          id: 103,
          wbsId: 5,
          name: 'Task C',
          startDate: '2026-09-10',
          endDate: '2026-09-15',
          predecessorTaskId: 102, // C depends on B
        },
      ],
    };

    const existingTasks: Task[] = [
      { id: 101, projectId: 1 } as any,
      { id: 102, projectId: 1 } as any,
      { id: 103, projectId: 1 } as any,
    ];

    expect(() =>
      validator.validateAndCompute(1, dto, mockProjectWbs, existingTasks, mockUsers),
    ).toThrow(/circular dependency/i);
  });

  it('CASE 16: FS predecessor date violation (task starts before predecessor ends) should be blocked', () => {
    const existingPredTask: Task = {
      id: 200,
      projectId: 1,
      wbsId: 3,
      name: 'Predecessor Task',
      startDate: '2026-09-01',
      endDate: '2026-09-10',
    } as any;

    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          id: 200,
          wbsId: 3,
          name: 'Predecessor Task',
          startDate: '2026-09-01',
          endDate: '2026-09-10',
        },
        {
          wbsId: 4,
          name: 'Successor Task',
          startDate: '2026-09-05', // Started before pred finished on 2026-09-10!
          endDate: '2026-09-15',
          predecessorTaskId: 200,
        },
      ],
    };

    expect(() =>
      validator.validateAndCompute(1, dto, mockProjectWbs, [existingPredTask], mockUsers),
    ).toThrow(/dimulai.*sebelum predecessor.*selesai/i);
  });

  it('CASE 17: valid FS predecessor (task starts on or after predecessor end) passes', () => {
    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          id: 200,
          wbsId: 3,
          name: 'Predecessor Task',
          startDate: '2026-09-01',
          endDate: '2026-09-10',
        },
        {
          wbsId: 4,
          name: 'Successor Task',
          startDate: '2026-09-10', // Starts on same day or after predecessor ends
          endDate: '2026-09-15',
          predecessorTaskId: 200,
        },
      ],
    };

    const existingPredTask: Task = { id: 200, projectId: 1 } as any;

    const result = validator.validateAndCompute(1, dto, mockProjectWbs, [existingPredTask], mockUsers);
    expect(result.tasks.length).toBe(2);
    expect(result.tasks[1].predecessorTaskId).toBe(200);
  });

  it('CASE 18: invalid assigneeId not in database should be blocked', () => {
    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          wbsId: 3,
          name: 'Task with ghost assignee',
          assigneeId: 999999, // user doesn't exist
        },
      ],
    };

    expect(() => validator.validateAndCompute(1, dto, mockProjectWbs, [], mockUsers)).toThrow(
      /Assignee user ID #999999 tidak ditemukan/i,
    );
  });

  it('CASE 19: valid project-level schedule derives complete metrics and WBS summaries', () => {
    const dto: SaveProjectScheduleDto = {
      pmNotes: 'Baseline jadwal disetujui',
      tasks: [
        {
          wbsId: 3,
          name: 'Field Survey',
          startDate: '2026-09-01',
          endDate: '2026-09-05',
        },
        {
          wbsId: 4,
          name: 'Permit Milestone',
          isMilestone: true,
          startDate: '2026-09-10',
        },
        {
          wbsId: 5,
          name: 'Civil Fiber Pulling',
          startDate: '2026-09-11',
          endDate: '2026-09-20',
        },
      ],
    };

    const result = validator.validateAndCompute(1, dto, mockProjectWbs, [], mockUsers);
    expect(result.summary.totalTaskCount).toBe(3);
    expect(result.summary.milestoneCount).toBe(1);
    expect(result.summary.scheduledTaskCount).toBe(3);
    expect(result.summary.earliestStart).toBe('2026-09-01');
    expect(result.summary.latestEnd).toBe('2026-09-20');
    expect(result.summary.totalDuration).toBe(19); // 2026-09-20 - 2026-09-01
    expect(result.wbsTaskSummary.length).toBe(3);
  });

  it('CASE 20: update task with invalid ID belonging to another project is blocked', () => {
    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          id: 888, // belongs to another project or non-existent
          wbsId: 3,
          name: 'Attempt to update foreign task',
        },
      ],
    };

    const existingProject1Tasks: Task[] = [{ id: 100, projectId: 1 } as any];

    expect(() =>
      validator.validateAndCompute(1, dto, mockProjectWbs, existingProject1Tasks, mockUsers),
    ).toThrow(/Task ID #888 tidak ditemukan pada proyek #1/i);
  });

  it('CASE 21: obsolete legacy status "TODO" is rejected by canonical validator', () => {
    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          wbsId: 3,
          name: 'Task with legacy TODO status',
          status: 'TODO',
        },
      ],
    };

    expect(() => validator.validateAndCompute(1, dto, mockProjectWbs, [], mockUsers)).toThrow(
      /Status "TODO" tidak valid/i,
    );
  });

  it('CASE 22: duplicate task ID in incoming payload is blocked', () => {
    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          id: 101,
          wbsId: 3,
          name: 'Task 1',
        },
        {
          id: 101, // Duplicate ID!
          wbsId: 4,
          name: 'Task 2 with same ID',
        },
      ],
    };

    const existingTasks: Task[] = [{ id: 101, projectId: 1 } as any];

    expect(() =>
      validator.validateAndCompute(1, dto, mockProjectWbs, existingTasks, mockUsers),
    ).toThrow(/duplikasi Task ID #101/i);
  });

  it('CASE 23: milestone without startDate is rejected', () => {
    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          wbsId: 3,
          name: 'Milestone Missing Start Date',
          isMilestone: true,
          // startDate missing
        },
      ],
    };

    expect(() => validator.validateAndCompute(1, dto, mockProjectWbs, [], mockUsers)).toThrow(
      /Milestone wajib memiliki startDate/i,
    );
  });

  it('CASE 24: predecessor referencing soft-deleted task is rejected', () => {
    const softDeletedTask: Task = {
      id: 300,
      projectId: 1,
      wbsId: 3,
      name: 'Old Deleted Task',
      deletedAt: new Date(),
    } as any;

    const dto: SaveProjectScheduleDto = {
      tasks: [
        {
          wbsId: 4,
          name: 'Task pointing to deleted predecessor',
          predecessorTaskId: 300,
        },
      ],
    };

    expect(() =>
      validator.validateAndCompute(1, dto, mockProjectWbs, [softDeletedTask], mockUsers),
    ).toThrow(/sudah dihapus \(soft-deleted\)/i);
  });
});
