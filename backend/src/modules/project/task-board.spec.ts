import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectService } from './project.service';
import { Project } from '../../entities/project.entity';
import { Contract } from '../../entities/contract.entity';
import { User } from '../../entities/user.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { Task } from '../../entities/task.entity';
import { ProjectBaseline } from '../../entities/project-baseline.entity';
import { ProjectBaselineWbsItem } from '../../entities/project-baseline-wbs-item.entity';
import { ProjectProgressLog } from '../../entities/project-progress-log.entity';
import { ProjectProgressEvidence } from '../../entities/project-progress-evidence.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { ProjectInitialCondition } from '../../entities/project-initial-condition.entity';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';

describe('ProjectTaskBoard (PROJECT-EXEC-F2-F3B)', () => {
  let service: ProjectService;
  let mockProjectRepo: any;
  let mockTaskRepo: any;
  let mockBaselineRepo: any;
  let mockWbsRepo: any;
  let mockUserRepo: any;
  let mockProgressLogRepo: any;
  let mockProgressEvidenceRepo: any;
  let mockContractRepo: any;

  beforeEach(async () => {
    mockProjectRepo = {
      findOne: jest.fn(),
    };
    mockTaskRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockBaselineRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    mockWbsRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockUserRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    mockProgressLogRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockProgressEvidenceRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockContractRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
        { provide: getRepositoryToken(Contract), useValue: mockContractRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(PurchaseRequest), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(WorkBreakdownStructure), useValue: mockWbsRepo },
        { provide: getRepositoryToken(Task), useValue: mockTaskRepo },
        { provide: getRepositoryToken(ProjectBaseline), useValue: mockBaselineRepo },
        { provide: getRepositoryToken(ProjectBaselineWbsItem), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(ProjectProgressLog), useValue: mockProgressLogRepo },
        { provide: getRepositoryToken(ProjectProgressEvidence), useValue: mockProgressEvidenceRepo },
        { provide: getRepositoryToken(ProjectCostEstimate), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(CostItem), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(ProjectInitialCondition), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(ProjectManagementReview), useValue: { findOne: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  it('throws BadRequestException for invalid projectId', async () => {
    await expect(service.getProjectTaskBoard(0)).rejects.toThrow(BadRequestException);
    await expect(service.getProjectTaskBoard(NaN as any)).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException if project not found', async () => {
    mockProjectRepo.findOne.mockResolvedValue(null);
    await expect(service.getProjectTaskBoard(999)).rejects.toThrow(NotFoundException);
  });

  it('enforces RBAC: non-assigned PM receives ForbiddenException', async () => {
    mockProjectRepo.findOne.mockResolvedValue({
      id: 100,
      code: 'PRJ-100',
      name: 'Project 100',
      managerId: 42,
      status: 'IN_PROGRESS',
    });

    await expect(
      service.getProjectTaskBoard(100, 99, ['PROJECT_MANAGER']),
    ).rejects.toThrow(ForbiddenException);
  });

  it('maps tasks correctly into 4 canonical lanes (TO_DO, IN_PROGRESS, REVIEW, DONE)', async () => {
    const project = {
      id: 100,
      code: 'PRJ-100',
      name: 'Test Project',
      managerId: 42,
      status: 'IN_PROGRESS',
      contractId: 10,
    };
    mockProjectRepo.findOne.mockResolvedValue(project);

    // Active baseline with leaf items
    mockBaselineRepo.findOne.mockResolvedValue({
      id: 1,
      project_id: 100,
      status: 'ACTIVE',
      wbs_items: [
        { id: 1, task_id: 10, is_leaf: true, planned_start_date: '2026-10-01', planned_end_date: '2026-10-10', weight_percentage: 25 },
        { id: 2, task_id: 20, is_leaf: true, planned_start_date: '2026-10-01', planned_end_date: '2026-10-10', weight_percentage: 25 },
        { id: 3, task_id: 30, is_leaf: true, planned_start_date: '2026-10-01', planned_end_date: '2026-10-10', weight_percentage: 25 },
        { id: 4, task_id: 40, is_leaf: true, planned_start_date: '2026-10-01', planned_end_date: '2026-10-10', weight_percentage: 25 },
      ],
    });

    mockTaskRepo.find.mockResolvedValue([
      { id: 10, projectId: 100, name: 'Task Not Started', progress: 0, status: 'PLANNED', actualStartAt: null, actualFinishAt: null },
      { id: 20, projectId: 100, name: 'Task Running', progress: 50, status: 'IN_PROGRESS', actualStartAt: new Date('2026-10-02'), actualFinishAt: null },
      { id: 30, projectId: 100, name: 'Task Pending Review', progress: 99.99, status: 'IN_PROGRESS', actualStartAt: new Date('2026-10-02'), actualFinishAt: null },
      { id: 40, projectId: 100, name: 'Task Completed', progress: 100, status: 'COMPLETED', actualStartAt: new Date('2026-10-02'), actualFinishAt: new Date('2026-10-05') },
    ]);

    mockProgressLogRepo.find.mockResolvedValue([
      {
        id: 999,
        project_id: 100,
        task_id: 30,
        status: 'PENDING_VERIFICATION',
        event_type: 'CRITICAL_CLAIM',
        reported_progress: 100,
        previous_progress: 99.99,
        submitted_by: 42,
      },
    ]);

    mockUserRepo.findOne.mockResolvedValue({ id: 42, fullName: 'Assigned PM', email: 'pm@epms.com' });

    // Call as assigned PM (userId: 42)
    const resultPm = await service.getProjectTaskBoard(100, 42, ['PROJECT_MANAGER']);

    expect(resultPm.project.id).toBe(100);
    expect(resultPm.tasks.length).toBe(4);

    const t10 = resultPm.tasks.find((t) => t.id === 10);
    const t20 = resultPm.tasks.find((t) => t.id === 20);
    const t30 = resultPm.tasks.find((t) => t.id === 30);
    const t40 = resultPm.tasks.find((t) => t.id === 40);

    // Verify critical task rule: weight >= 20% does NOT infer critical; only active critical claim workflow marks critical
    expect(t10?.isCritical).toBe(false);
    expect(t20?.isCritical).toBe(false);
    expect(t30?.isCritical).toBe(true); // Has active CRITICAL_CLAIM pending verification
    expect(t40?.isCritical).toBe(false);

    expect(t10?.boardLane).toBe('TO_DO');
    expect(t10?.availableActions).toContain('UPDATE_PROGRESS');

    expect(t20?.boardLane).toBe('IN_PROGRESS');
    expect(t20?.availableActions).toContain('UPDATE_PROGRESS');

    expect(t30?.boardLane).toBe('REVIEW');
    expect(t30?.availableActions).toContain('VIEW_CLAIM');

    expect(t40?.boardLane).toBe('DONE');
    expect(t40?.availableActions).toEqual(['VIEW_DETAIL']);

    // Call as PMO (userId: 10)
    const resultPmo = await service.getProjectTaskBoard(100, 10, ['PMO']);
    const t30Pmo = resultPmo.tasks.find((t) => t.id === 30);
    expect(t30Pmo?.boardLane).toBe('REVIEW');
    expect(t30Pmo?.availableActions).toContain('REVIEW_CLAIM');

    const t10Pmo = resultPmo.tasks.find((t) => t.id === 10);
    expect(t10Pmo?.availableActions).toEqual(['VIEW_DETAIL']);
  });
});
