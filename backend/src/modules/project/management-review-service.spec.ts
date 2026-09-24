import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { InitialConditionValidator } from './initial-condition.validator';
import { ManagementReviewValidator } from './management-review.validator';
import { OperationalReadinessValidator } from './operational-readiness.validator';
import { CostEstimateValidator } from './cost-estimate.validator';
import { ScheduleValidator } from './schedule.validator';
import { Project } from '../../entities/project.entity';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { Task } from '../../entities/task.entity';
import { Contract } from '../../entities/contract.entity';
import { User } from '../../entities/user.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { ProjectInitialCondition } from '../../entities/project-initial-condition.entity';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { SaveInitialConditionDto } from './dto/save-initial-condition.dto';
import { DecideManagementReviewDto } from './dto/decide-management-review.dto';

describe('ProjectService & ProjectController — Phase R11.1.5-C2 (Initial Condition & Management Review)', () => {
  let service: ProjectService;
  let controller: ProjectController;
  let eventEmitter: EventEmitter2;

  let mockProjectRepo: any;
  let mockWbsRepo: any;
  let mockTaskRepo: any;
  let mockCostEstimateRepo: any;
  let mockCostItemRepo: any;
  let mockInitialConditionRepo: any;
  let mockManagementReviewRepo: any;
  let mockContractRepo: any;
  let mockUserRepo: any;
  let mockManager: any;

  const mockProject: Partial<Project> = {
    id: 10,
    name: 'FTTH Rollout Project',
    code: 'PRJ-2026-FTTH-01',
    managerId: 1,
  };

  const validInitialConditionDto: SaveInitialConditionDto = {
    conditionStatus: 'NORMAL',
    locationCondition: 'Lokasi siap dan akses jalan beton tersedia 24 jam.',
    existingInfrastructure: 'Tiang PLN dan FO backbone berjarak 50 meter.',
    accessLogistics: 'Kendaraan roda 4 dan truk logistik dapat masuk langsung ke site.',
    initialConstraints: 'Izin warga RT/RW lokal harus diselesaikan sebelum penarikan kabel.',
    initialRisks: 'Potensi hujan lebat pada sore hari.',
    pmRecommendation: 'Lakukan instalasi tiang pada pagi hingga siang hari.',
  };

  beforeEach(async () => {
    mockManager = {
      findOne: jest.fn(),
      save: jest.fn((entityClass, entity) => Promise.resolve({ id: entity.id || 501, ...entity })),
      create: jest.fn((entityClass, dto) => ({ id: 501, ...dto })),
    };

    mockProjectRepo = {
      findOne: jest.fn((options: any) => {
        if (options?.where?.id === 10) return Promise.resolve(mockProject);
        return Promise.resolve(null);
      }),
    };

    mockWbsRepo = {
      find: jest.fn(() =>
        Promise.resolve([
          { id: 1, projectId: 10, code: '1.0', name: 'Scope 1', level: 1, weightPercentage: 100, parentWbsId: null, deletedAt: null },
          { id: 2, projectId: 10, code: '1.1', name: 'Deliverable 1', level: 2, weightPercentage: 100, parentWbsId: 1, deletedAt: null },
        ]),
      ),
    };

    mockCostEstimateRepo = {
      findOne: jest.fn(() =>
        Promise.resolve({
          id: 201,
          projectId: 10,
          version: 1,
          totalCost: 10000000,
          deletedAt: null,
        }),
      ),
    };

    mockCostItemRepo = {
      find: jest.fn(() =>
        Promise.resolve([
          {
            id: 301,
            estimateId: 201,
            wbsId: 2,
            quantity: 10,
            unitPrice: 1000000,
            subtotal: 10000000,
            assignmentScope: 'WBS_DELIVERABLE',
            deletedAt: null,
          },
        ]),
      ),
    };

    mockTaskRepo = {
      find: jest.fn(() =>
        Promise.resolve([
          {
            id: 401,
            projectId: 10,
            wbsId: 2,
            name: 'Installation Task',
            startDate: '2026-09-01',
            endDate: '2026-09-10',
            durationDays: 10,
            isMilestone: false,
            deletedAt: null,
          },
        ]),
      ),
    };

    mockInitialConditionRepo = {
      findOne: jest.fn(() => Promise.resolve(null)),
      create: jest.fn((dto) => ({ id: 501, ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: entity.id || 501, ...entity })),
    };

    mockManagementReviewRepo = {
      findOne: jest.fn(() => Promise.resolve(null)),
      create: jest.fn((dto) => ({ id: 601, ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: entity.id || 601, ...entity })),
      manager: {
        transaction: jest.fn(async (cb) => cb(mockManager)),
      },
    };

    mockContractRepo = { findOne: jest.fn() };
    mockUserRepo = { findOne: jest.fn() };

    eventEmitter = new EventEmitter2();
    jest.spyOn(eventEmitter, 'emit');

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        ProjectService,
        CostEstimateValidator,
        ScheduleValidator,
        OperationalReadinessValidator,
        InitialConditionValidator,
        ManagementReviewValidator,
        { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
        { provide: getRepositoryToken(WorkBreakdownStructure), useValue: mockWbsRepo },
        { provide: getRepositoryToken(Task), useValue: mockTaskRepo },
        { provide: getRepositoryToken(Contract), useValue: mockContractRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(ProjectCostEstimate), useValue: mockCostEstimateRepo },
        { provide: getRepositoryToken(CostItem), useValue: mockCostItemRepo },
        { provide: getRepositoryToken(ProjectInitialCondition), useValue: mockInitialConditionRepo },
        { provide: getRepositoryToken(ProjectManagementReview), useValue: mockManagementReviewRepo },
        { provide: getRepositoryToken(PurchaseRequest), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    controller = module.get<ProjectController>(ProjectController);
  });

  // SECTION 36: TESTS — INITIAL CONDITION (Cases 1 - 14)
  describe('Initial Condition API & Service (Test Cases 1 - 14)', () => {
    it('1. GET absent → returns NOT_STARTED without throwing 404', async () => {
      mockInitialConditionRepo.findOne.mockResolvedValue(null);
      const res = await service.getInitialCondition(10);
      expect(res.projectId).toBe(10);
      expect(res.status).toBe('NOT_STARTED');
      expect(res.conditionStatus).toBeNull();
      expect(res.isComplete).toBe(false);
    });

    it('2. GET existing → returns complete baseline record', async () => {
      mockInitialConditionRepo.findOne.mockResolvedValue({
        id: 501,
        projectId: 10,
        conditionStatus: 'NORMAL',
        locationCondition: 'Lokasi normal',
        initialConstraints: 'Kendala izin',
        initialRisks: 'Risiko cuaca',
        pmRecommendation: 'Lanjutkan',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 1,
        deletedAt: null,
      });

      const res = await service.getInitialCondition(10);
      expect(res.id).toBe(501);
      expect(res.status).toBe('READY');
      expect(res.isComplete).toBe(true);
      expect(res.conditionStatus).toBe('NORMAL');
    });

    it('3. PUT create → creates new record and returns READY', async () => {
      mockInitialConditionRepo.findOne.mockResolvedValue(null);
      mockInitialConditionRepo.create.mockReturnValue({ id: 501, projectId: 10, ...validInitialConditionDto });
      mockInitialConditionRepo.save.mockResolvedValue({ id: 501, projectId: 10, ...validInitialConditionDto });

      const res = await service.saveInitialCondition(10, validInitialConditionDto, 1);
      expect(res.id).toBe(501);
      expect(res.status).toBe('READY');
      expect(res.isComplete).toBe(true);
      expect(mockInitialConditionRepo.create).toHaveBeenCalled();
    });

    it('4. PUT update same ID → preserves existing ID (in-place update)', async () => {
      const existing = {
        id: 501,
        projectId: 10,
        conditionStatus: 'NORMAL',
        locationCondition: 'Old condition',
        initialConstraints: 'Old constraints',
        initialRisks: 'Old risks',
      };
      mockInitialConditionRepo.findOne.mockResolvedValue(existing);
      mockInitialConditionRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

      const res = await service.saveInitialCondition(10, {
        ...validInitialConditionDto,
        locationCondition: 'Updated location condition',
      }, 1);

      expect(res.id).toBe(501);
      expect(res.locationCondition).toBe('Updated location condition');
      expect(mockInitialConditionRepo.create).not.toHaveBeenCalled();
    });

    it('5. required field validation → throws BadRequestException if mandatory fields missing', async () => {
      const invalidDto: any = {
        conditionStatus: 'NORMAL',
        locationCondition: '',
        initialConstraints: 'Kendala',
        initialRisks: 'Risiko',
      };
      await expect(service.saveInitialCondition(10, invalidDto, 1)).rejects.toThrow(BadRequestException);
    });

    it('6. invalid conditionStatus → throws BadRequestException', async () => {
      const invalidDto: any = {
        ...validInitialConditionDto,
        conditionStatus: 'UNKNOWN_STATUS',
      };
      await expect(service.saveInitialCondition(10, invalidDto, 1)).rejects.toThrow(BadRequestException);
    });

    it('7. whitespace validation → empty/space-only fields are rejected', async () => {
      const invalidDto: any = {
        ...validInitialConditionDto,
        locationCondition: '   ',
      };
      await expect(service.saveInitialCondition(10, invalidDto, 1)).rejects.toThrow(BadRequestException);
    });

    it('8. edit allowed when Gate is NOT_SUBMITTED', async () => {
      mockManagementReviewRepo.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'NOT_SUBMITTED',
      });
      mockInitialConditionRepo.findOne.mockResolvedValue(null);
      mockInitialConditionRepo.save.mockResolvedValue({ id: 501, projectId: 10, ...validInitialConditionDto });

      const res = await service.saveInitialCondition(10, validInitialConditionDto, 1);
      expect(res.status).toBe('READY');
    });

    it('9. edit allowed when Gate is NEEDS_REVISION', async () => {
      mockManagementReviewRepo.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'NEEDS_REVISION',
      });
      mockInitialConditionRepo.findOne.mockResolvedValue({ id: 501, projectId: 10 });
      mockInitialConditionRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

      const res = await service.saveInitialCondition(10, validInitialConditionDto, 1);
      expect(res.status).toBe('READY');
    });

    it('10. edit blocked when Gate is REVIEW_PENDING → throws 409 Conflict', async () => {
      mockManagementReviewRepo.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'REVIEW_PENDING',
      });

      await expect(service.saveInitialCondition(10, validInitialConditionDto, 1)).rejects.toThrow(ConflictException);
    });

    it('11. edit blocked when Gate is READY_FOR_PROCUREMENT → throws 409 Conflict', async () => {
      mockManagementReviewRepo.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'READY_FOR_PROCUREMENT',
      });

      await expect(service.saveInitialCondition(10, validInitialConditionDto, 1)).rejects.toThrow(ConflictException);
    });

    it('12. project isolation → throws NotFoundException if projectId does not exist', async () => {
      await expect(service.getInitialCondition(999)).rejects.toThrow(NotFoundException);
      await expect(service.saveInitialCondition(999, validInitialConditionDto, 1)).rejects.toThrow(NotFoundException);
    });

    it('13. actor from JWT → uses authenticated user ID for audit columns', async () => {
      mockInitialConditionRepo.findOne.mockResolvedValue(null);
      mockInitialConditionRepo.create.mockReturnValue({ id: 501, projectId: 10, createdBy: 42, updatedBy: 42 });
      mockInitialConditionRepo.save.mockResolvedValue({ id: 501, projectId: 10, createdBy: 42, updatedBy: 42 });

      const res = await service.saveInitialCondition(10, validInitialConditionDto, 42, ['SUPER_ADMIN']);
      expect(res.createdBy).toBe(42);
    });

    it('14. audit log created → emits INITIAL_CONDITION_UPDATED event', async () => {
      mockInitialConditionRepo.findOne.mockResolvedValue(null);
      mockInitialConditionRepo.create.mockReturnValue({ id: 501, projectId: 10, ...validInitialConditionDto });
      mockInitialConditionRepo.save.mockResolvedValue({ id: 501, projectId: 10, ...validInitialConditionDto });

      await service.saveInitialCondition(10, validInitialConditionDto, 1);
      expect(eventEmitter.emit).toHaveBeenCalledWith('audit.log', expect.objectContaining({
        action: 'INITIAL_CONDITION_UPDATED',
        entityName: 'ProjectInitialCondition',
        entityId: 501,
        projectId: 10,
      }));
    });
  });

  // SECTION 37: TESTS — MANAGEMENT REVIEW (Cases 15 - 34)
  describe('Management Review API & Service (Test Cases 15 - 34)', () => {
    it('15. GET absent → returns NOT_SUBMITTED without throwing 404', async () => {
      mockManagementReviewRepo.findOne.mockResolvedValue(null);
      const res = await service.getManagementReview(10);
      expect(res.projectId).toBe(10);
      expect(res.status).toBe('NOT_SUBMITTED');
      expect(res.submittedAt).toBeNull();
      expect(res.decidedAt).toBeNull();
    });

    it('16. submit with 4/4 ready → successfully transitions to REVIEW_PENDING', async () => {
      // Mock initial condition ready
      mockInitialConditionRepo.findOne.mockResolvedValue({
        id: 501,
        projectId: 10,
        conditionStatus: 'NORMAL',
        locationCondition: 'Siap',
        initialConstraints: 'Kendala',
        initialRisks: 'Risiko',
        deletedAt: null,
      });

      mockManager.findOne.mockResolvedValue(null);
      mockManager.create.mockReturnValue({
        id: 601,
        projectId: 10,
        status: 'REVIEW_PENDING',
        submittedBy: 1,
        submittedAt: new Date(),
      });
      mockManager.save.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'REVIEW_PENDING',
        submittedBy: 1,
        submittedAt: new Date(),
      });

      const res = await service.submitManagementReview(10, 1, ['PROJECT_MANAGER']);
      expect(res.status).toBe('REVIEW_PENDING');
      expect(res.submittedBy).toBe(1);
    });

    it('17. submit with incomplete pillars → throws BadRequestException (400)', async () => {
      // Mock Initial condition absent (0/4 ready)
      mockInitialConditionRepo.findOne.mockResolvedValue(null);

      await expect(service.submitManagementReview(10, 1, ['PROJECT_MANAGER'])).rejects.toThrow(BadRequestException);
    });

    it('18. unauthorized submit → controller guards enforce PROJECT_MANAGER / SUPER_ADMIN roles', async () => {
      // Controller has @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
      expect(Reflect.getMetadata('roles', ProjectController.prototype.submitManagementReview)).toEqual([
        'PROJECT_MANAGER',
        'SUPER_ADMIN',
      ]);
    });

    it('19. duplicate submit when REVIEW_PENDING or READY_FOR_PROCUREMENT → throws 409 Conflict', async () => {
      mockInitialConditionRepo.findOne.mockResolvedValue({
        id: 501,
        projectId: 10,
        conditionStatus: 'NORMAL',
        locationCondition: 'Siap',
        initialConstraints: 'Kendala',
        initialRisks: 'Risiko',
      });
      mockManager.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'REVIEW_PENDING',
      });

      await expect(service.submitManagementReview(10, 1, ['PROJECT_MANAGER'])).rejects.toThrow(ConflictException);
    });

    it('20. approve from REVIEW_PENDING → transitions to READY_FOR_PROCUREMENT', async () => {
      mockManager.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'REVIEW_PENDING',
        submittedBy: 1, // Submitter is user 1
      });
      mockInitialConditionRepo.findOne.mockResolvedValue({
        id: 501,
        projectId: 10,
        conditionStatus: 'NORMAL',
        locationCondition: 'Siap',
        initialConstraints: 'Kendala',
        initialRisks: 'Risiko',
      });

      const res = await service.decideManagementReview(
        10,
        { decision: 'READY_FOR_PROCUREMENT' },
        2, // Decided by user 2 (Director)
        ['DIRECTOR'],
      );

      expect(res.status).toBe('READY_FOR_PROCUREMENT');
      expect(res.decidedBy).toBe(2);
      expect(res.reviewerRole).toBe('DIRECTOR');
    });

    it('21. revise from REVIEW_PENDING → transitions to NEEDS_REVISION with notes', async () => {
      mockManager.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'REVIEW_PENDING',
        submittedBy: 1,
      });
      mockInitialConditionRepo.findOne.mockResolvedValue({
        id: 501,
        projectId: 10,
        conditionStatus: 'NORMAL',
        locationCondition: 'Siap',
        initialConstraints: 'Kendala',
        initialRisks: 'Risiko',
      });

      const res = await service.decideManagementReview(
        10,
        {
          decision: 'NEEDS_REVISION',
          revisionNotes: 'Mohon rincikan item biaya pada WBS 1.1 lebih detail.',
        },
        2,
        ['GENERAL_MANAGER'],
      );

      expect(res.status).toBe('NEEDS_REVISION');
      expect(res.revisionNotes).toContain('Mohon rincikan item biaya');
      expect(res.reviewerRole).toBe('GENERAL_MANAGER');
    });

    it('22. unauthorized approve → controller guards enforce management reviewer roles', async () => {
      expect(Reflect.getMetadata('roles', ProjectController.prototype.decideManagementReview)).toEqual([
        'HEAD_OF_OPERATIONS',
        'GENERAL_MANAGER',
        'DIRECTOR',
        'SUPER_ADMIN',
      ]);
    });

    it('23. PM self-approve blocked → throws ForbiddenException (403)', async () => {
      mockManager.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'REVIEW_PENDING',
        submittedBy: 1, // Submitter is user 1
      });

      // User 1 tries to approve own submission without SUPER_ADMIN override
      await expect(
        service.decideManagementReview(
          10,
          { decision: 'READY_FOR_PROCUREMENT' },
          1, // Same user
          ['PROJECT_MANAGER', 'GENERAL_MANAGER'],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('24. revision notes < 10 characters blocked when requesting revision → throws BadRequestException', async () => {
      await expect(
        service.decideManagementReview(
          10,
          { decision: 'NEEDS_REVISION', revisionNotes: 'revisi ya' }, // 9 chars
          2,
          ['DIRECTOR'],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('25. revision notes > 2000 characters blocked → throws BadRequestException', async () => {
      const longNote = 'a'.repeat(2001);
      await expect(
        service.decideManagementReview(
          10,
          { decision: 'NEEDS_REVISION', revisionNotes: longNote },
          2,
          ['DIRECTOR'],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('26. approve with revision notes optional → works when revisionNotes is omitted', async () => {
      mockManager.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'REVIEW_PENDING',
        submittedBy: 1,
      });
      mockInitialConditionRepo.findOne.mockResolvedValue({
        id: 501,
        projectId: 10,
        conditionStatus: 'NORMAL',
        locationCondition: 'Siap',
        initialConstraints: 'Kendala',
        initialRisks: 'Risiko',
      });

      const res = await service.decideManagementReview(
        10,
        { decision: 'READY_FOR_PROCUREMENT' },
        2,
        ['DIRECTOR'],
      );
      expect(res.status).toBe('READY_FOR_PROCUREMENT');
      expect(res.revisionNotes).toBeNull();
    });

    it('27. invalid workflow transition → throws ConflictException (409) if not REVIEW_PENDING', async () => {
      mockManager.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'NOT_SUBMITTED', // Cannot decide if not pending
      });

      await expect(
        service.decideManagementReview(
          10,
          { decision: 'READY_FOR_PROCUREMENT' },
          2,
          ['DIRECTOR'],
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('28. double approval protection → throws ConflictException (409) if already decided', async () => {
      mockManager.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'READY_FOR_PROCUREMENT', // Already approved
      });

      await expect(
        service.decideManagementReview(
          10,
          { decision: 'READY_FOR_PROCUREMENT' },
          2,
          ['DIRECTOR'],
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('29. project isolation → throws NotFoundException on non-existent project', async () => {
      await expect(service.getManagementReview(999)).rejects.toThrow(NotFoundException);
      await expect(service.submitManagementReview(999, 1)).rejects.toThrow(NotFoundException);
      await expect(service.decideManagementReview(999, { decision: 'READY_FOR_PROCUREMENT' }, 2)).rejects.toThrow(NotFoundException);
    });

    it('30. actor from JWT → uses authenticated user ID for submitter and decider', async () => {
      mockManager.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'REVIEW_PENDING',
        submittedBy: 1,
      });
      mockInitialConditionRepo.findOne.mockResolvedValue({
        id: 501,
        projectId: 10,
        conditionStatus: 'NORMAL',
        locationCondition: 'Siap',
        initialConstraints: 'Kendala',
        initialRisks: 'Risiko',
      });

      const res = await service.decideManagementReview(
        10,
        { decision: 'READY_FOR_PROCUREMENT' },
        88, // Decider 88
        ['DIRECTOR'],
      );
      expect(res.decidedBy).toBe(88);
    });

    it('31. checklist snapshot server-generated → stores JSON snapshot of operational readiness', async () => {
      mockManager.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'REVIEW_PENDING',
        submittedBy: 1,
      });
      mockInitialConditionRepo.findOne.mockResolvedValue({
        id: 501,
        projectId: 10,
        conditionStatus: 'NORMAL',
        locationCondition: 'Siap',
        initialConstraints: 'Kendala',
        initialRisks: 'Risiko',
      });

      const res = await service.decideManagementReview(
        10,
        { decision: 'READY_FOR_PROCUREMENT' },
        2,
        ['DIRECTOR'],
      );
      expect(res.checklistSnapshot).toBeDefined();
      const parsed = JSON.parse(res.checklistSnapshot);
      expect(parsed.overallStatus).toBe('READY');
      expect(parsed.completenessCount).toBe(4);
    });

    it('32. audit log submit → emits PROJECT_PLAN_SUBMITTED event', async () => {
      mockInitialConditionRepo.findOne.mockResolvedValue({
        id: 501,
        projectId: 10,
        conditionStatus: 'NORMAL',
        locationCondition: 'Siap',
        initialConstraints: 'Kendala',
        initialRisks: 'Risiko',
      });
      mockManager.findOne.mockResolvedValue(null);
      mockManager.create.mockReturnValue({
        id: 601,
        projectId: 10,
        status: 'REVIEW_PENDING',
      });
      mockManager.save.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'REVIEW_PENDING',
      });

      await service.submitManagementReview(10, 1, ['PROJECT_MANAGER']);
      expect(eventEmitter.emit).toHaveBeenCalledWith('audit.log', expect.objectContaining({
        action: 'PROJECT_PLAN_SUBMITTED',
        entityName: 'ProjectManagementReview',
        projectId: 10,
        userId: 1,
      }));
    });

    it('33. audit log approve → emits PROJECT_PLAN_APPROVED event', async () => {
      mockManager.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'REVIEW_PENDING',
        submittedBy: 1,
      });
      mockInitialConditionRepo.findOne.mockResolvedValue({
        id: 501,
        projectId: 10,
        conditionStatus: 'NORMAL',
        locationCondition: 'Siap',
        initialConstraints: 'Kendala',
        initialRisks: 'Risiko',
      });

      await service.decideManagementReview(
        10,
        { decision: 'READY_FOR_PROCUREMENT' },
        2,
        ['DIRECTOR'],
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('audit.log', expect.objectContaining({
        action: 'PROJECT_PLAN_APPROVED',
        entityName: 'ProjectManagementReview',
        projectId: 10,
        userId: 2,
      }));
    });

    it('34. audit log revision → emits PROJECT_PLAN_REVISION_REQUESTED event', async () => {
      mockManager.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'REVIEW_PENDING',
        submittedBy: 1,
      });
      mockInitialConditionRepo.findOne.mockResolvedValue({
        id: 501,
        projectId: 10,
        conditionStatus: 'NORMAL',
        locationCondition: 'Siap',
        initialConstraints: 'Kendala',
        initialRisks: 'Risiko',
      });

      await service.decideManagementReview(
        10,
        {
          decision: 'NEEDS_REVISION',
          revisionNotes: 'Harap lengkapi detail estimasi biaya pada WBS 1.1.',
        },
        2,
        ['DIRECTOR'],
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('audit.log', expect.objectContaining({
        action: 'PROJECT_PLAN_REVISION_REQUESTED',
        entityName: 'ProjectManagementReview',
        projectId: 10,
        userId: 2,
      }));
    });
  });

  // SECTION 38: TESTS — READINESS INTEGRATION (Cases 35 - 44)
  describe('Readiness Integration with Database SSOT (Test Cases 35 - 44)', () => {
    it('35. Initial Condition READY reflected in readiness evaluation', async () => {
      mockInitialConditionRepo.findOne.mockResolvedValue({
        id: 501,
        projectId: 10,
        conditionStatus: 'NORMAL',
        locationCondition: 'Siap',
        initialConstraints: 'Kendala',
        initialRisks: 'Risiko',
      });

      const readiness = await service.getOperationalReadiness(10);
      expect(readiness.pillars.initialCondition.status).toBe('READY');
      expect(readiness.completenessCount).toBe(4);
      expect(readiness.overallStatus).toBe('READY');
    });

    it('36. Initial Condition incomplete reflected as IN_PROGRESS', async () => {
      mockInitialConditionRepo.findOne.mockResolvedValue({
        id: 501,
        projectId: 10,
        conditionStatus: 'NORMAL',
        locationCondition: 'Siap',
        initialConstraints: '', // Incomplete
        initialRisks: 'Risiko',
      });

      const readiness = await service.getOperationalReadiness(10);
      expect(readiness.pillars.initialCondition.status).toBe('IN_PROGRESS');
      expect(readiness.completenessCount).toBe(3);
      expect(readiness.overallStatus).toBe('IN_PROGRESS');
    });

    it('37. Gate NOT_SUBMITTED reflected in readiness evaluation', async () => {
      mockManagementReviewRepo.findOne.mockResolvedValue(null);
      const readiness = await service.getOperationalReadiness(10);
      expect(readiness.gate.status).toBe('NOT_SUBMITTED');
    });

    it('38. Gate REVIEW_PENDING reflected in readiness evaluation', async () => {
      mockManagementReviewRepo.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'REVIEW_PENDING',
        submittedAt: new Date('2026-08-28T00:00:00Z'),
      });
      const readiness = await service.getOperationalReadiness(10);
      expect(readiness.gate.status).toBe('REVIEW_PENDING');
      expect(readiness.gate.submittedAt).toBeDefined();
    });

    it('39. Gate NEEDS_REVISION reflected in readiness evaluation', async () => {
      mockManagementReviewRepo.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'NEEDS_REVISION',
        revisionNotes: 'Perbaiki RAB',
      });
      const readiness = await service.getOperationalReadiness(10);
      expect(readiness.gate.status).toBe('NEEDS_REVISION');
      expect(readiness.gate.revisionNotes).toBe('Perbaiki RAB');
    });

    it('40. Gate READY_FOR_PROCUREMENT reflected in readiness evaluation', async () => {
      mockManagementReviewRepo.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'READY_FOR_PROCUREMENT',
        reviewerRole: 'DIRECTOR',
      });
      const readiness = await service.getOperationalReadiness(10);
      expect(readiness.gate.status).toBe('READY_FOR_PROCUREMENT');
      expect(readiness.gate.decidedBy).toBe('DIRECTOR');
    });

    it('41. canSubmitForReview correct → true only when 4/4 ready and NOT pending/approved', async () => {
      // 4/4 ready, Gate NOT_SUBMITTED -> true
      mockInitialConditionRepo.findOne.mockResolvedValue({
        id: 501,
        projectId: 10,
        conditionStatus: 'NORMAL',
        locationCondition: 'Siap',
        initialConstraints: 'Kendala',
        initialRisks: 'Risiko',
      });
      mockManagementReviewRepo.findOne.mockResolvedValue(null);
      let readiness = await service.getOperationalReadiness(10);
      expect(readiness.canSubmitForReview).toBe(true);

      // Gate REVIEW_PENDING -> false
      mockManagementReviewRepo.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'REVIEW_PENDING',
      });
      readiness = await service.getOperationalReadiness(10);
      expect(readiness.canSubmitForReview).toBe(false);

      // Gate READY_FOR_PROCUREMENT -> false
      mockManagementReviewRepo.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'READY_FOR_PROCUREMENT',
      });
      readiness = await service.getOperationalReadiness(10);
      expect(readiness.canSubmitForReview).toBe(false);
    });

    it('42. canCreatePr correct → true ONLY when Gate status is READY_FOR_PROCUREMENT', async () => {
      mockInitialConditionRepo.findOne.mockResolvedValue({
        id: 501,
        projectId: 10,
        conditionStatus: 'NORMAL',
        locationCondition: 'Siap',
        initialConstraints: 'Kendala',
        initialRisks: 'Risiko',
      });

      // When Gate is REVIEW_PENDING -> canCreatePr is false
      mockManagementReviewRepo.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'REVIEW_PENDING',
      });
      let readiness = await service.getOperationalReadiness(10);
      expect(readiness.canCreatePr).toBe(false);

      // When Gate is READY_FOR_PROCUREMENT -> canCreatePr is true
      mockManagementReviewRepo.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'READY_FOR_PROCUREMENT',
      });
      readiness = await service.getOperationalReadiness(10);
      expect(readiness.canCreatePr).toBe(true);
    });

    it('43. technical readiness independent from gate status', async () => {
      mockInitialConditionRepo.findOne.mockResolvedValue({
        id: 501,
        projectId: 10,
        conditionStatus: 'NORMAL',
        locationCondition: 'Siap',
        initialConstraints: 'Kendala',
        initialRisks: 'Risiko',
      });
      mockManagementReviewRepo.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'NEEDS_REVISION',
      });

      const readiness = await service.getOperationalReadiness(10);
      expect(readiness.overallStatus).toBe('READY'); // 4 technical pillars are still READY
      expect(readiness.gate.status).toBe('NEEDS_REVISION');
    });

    it('44. 4/4 technical pillars unlock submit, NOT PR directly', async () => {
      mockInitialConditionRepo.findOne.mockResolvedValue({
        id: 501,
        projectId: 10,
        conditionStatus: 'NORMAL',
        locationCondition: 'Siap',
        initialConstraints: 'Kendala',
        initialRisks: 'Risiko',
      });
      mockManagementReviewRepo.findOne.mockResolvedValue(null);

      const readiness = await service.getOperationalReadiness(10);
      expect(readiness.completenessCount).toBe(4);
      expect(readiness.canSubmitForReview).toBe(true);
      expect(readiness.canCreatePr).toBe(false);
    });
  });

  // SECTION 39: TESTS — HOPS WORKFLOW INTEGRATION (P1)
  describe('HOps Workflow Engine Integration (P1)', () => {
    it('45. HOps approval uses Workflow Engine and completes active task (APPROVE)', async () => {
      mockManagementReviewRepo.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'REVIEW_PENDING',
        submittedBy: 1,
      });

      const mockWfService = {
        getInstanceByEntity: jest.fn().mockResolvedValue({
          id: 13,
          status: 'IN_PROGRESS',
          currentNodeId: 'node_hops_review',
          tasks: [{ id: 99, status: 'PENDING', nodeId: 'node_hops_review' }],
        }),
        completeTask: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(service as any, 'getWorkflowEngineService').mockReturnValue(mockWfService);

      // We need to return an updated review after workflow transition
      mockManagementReviewRepo.findOne
        .mockResolvedValueOnce({
          id: 601,
          projectId: 10,
          status: 'REVIEW_PENDING',
          submittedBy: 1,
        }) // First findOne for SoD
        .mockResolvedValueOnce({
          id: 601,
          projectId: 10,
          status: 'REVIEW_PENDING',
          submittedBy: 1,
        }) // Second findOne for getOperationalReadiness
        .mockResolvedValueOnce({
          id: 601,
          projectId: 10,
          status: 'REVIEW_PENDING', // Task completion handles the status internally, it shouldn't be READY_FOR_PROCUREMENT directly
          submittedBy: 1,
          decidedBy: 2,
          reviewerRole: 'HEAD_OF_OPERATIONS',
        }); // Third findOne after task complete

      const res = await service.decideManagementReview(
        10,
        { decision: 'READY_FOR_PROCUREMENT' },
        2,
        ['HEAD_OF_OPERATIONS'],
      );

      expect(mockWfService.getInstanceByEntity).toHaveBeenCalledWith('PROJECT', 10);
      expect(mockWfService.completeTask).toHaveBeenCalledWith(
        99,
        { action: 'APPROVE', reason: null },
        2,
        ['HEAD_OF_OPERATIONS'],
      );
      
      // Ensures the fallback manual DB transaction does not run, and the result is returned directly
      expect(mockManagementReviewRepo.manager.transaction).not.toHaveBeenCalled();
      expect(res.decidedBy).toBe(2);
    });

    it('46. HOps revision uses Workflow Engine and completes active task (RETURN)', async () => {
      const mockWfService = {
        getInstanceByEntity: jest.fn().mockResolvedValue({
          id: 13,
          status: 'IN_PROGRESS',
          currentNodeId: 'node_hops_review',
          tasks: [{ id: 99, status: 'PENDING', nodeId: 'node_hops_review' }],
        }),
        completeTask: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(service as any, 'getWorkflowEngineService').mockReturnValue(mockWfService);

      mockManagementReviewRepo.findOne
        .mockResolvedValueOnce({
          id: 601,
          projectId: 10,
          status: 'REVIEW_PENDING',
          submittedBy: 1,
        }) // First findOne for SoD
        .mockResolvedValueOnce({
          id: 601,
          projectId: 10,
          status: 'REVIEW_PENDING',
          submittedBy: 1,
        }) // Second findOne for getOperationalReadiness
        .mockResolvedValueOnce({
          id: 601,
          projectId: 10,
          status: 'NEEDS_REVISION',
          submittedBy: 1,
          decidedBy: 2,
          reviewerRole: 'HEAD_OF_OPERATIONS',
          revisionNotes: 'Perbaiki RAB'
        }); // Third findOne after task complete

      const res = await service.decideManagementReview(
        10,
        { decision: 'NEEDS_REVISION', revisionNotes: 'Perbaiki RAB' },
        2,
        ['HEAD_OF_OPERATIONS'],
      );

      expect(mockWfService.completeTask).toHaveBeenCalledWith(
        99,
        { action: 'RETURN', reason: 'Perbaiki RAB' },
        2,
        ['HEAD_OF_OPERATIONS'],
      );
      expect(res.status).toBe('NEEDS_REVISION');
    });

    it('47. HOps self-approve is blocked by SoD enforcement', async () => {
      const mockWfService = {
        getInstanceByEntity: jest.fn().mockResolvedValue({
          id: 13,
          status: 'IN_PROGRESS',
          currentNodeId: 'node_hops_review',
          tasks: [{ id: 99, status: 'PENDING', nodeId: 'node_hops_review' }],
        }),
        completeTask: jest.fn().mockResolvedValue({}),
      };
      jest.spyOn(service as any, 'getWorkflowEngineService').mockReturnValue(mockWfService);

      mockManagementReviewRepo.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'REVIEW_PENDING',
        submittedBy: 2, // Submitter is the same as the HOps
      });

      await expect(
        service.decideManagementReview(
          10,
          { decision: 'READY_FOR_PROCUREMENT' },
          2, // Same user
          ['HEAD_OF_OPERATIONS'],
        )
      ).rejects.toThrow(ForbiddenException);

      expect(mockWfService.completeTask).not.toHaveBeenCalled();
    });
    
    it('48. Other roles (or no active HOps workflow) preserve legacy manager.transaction', async () => {
      const mockWfService = {
        getInstanceByEntity: jest.fn().mockResolvedValue(null),
        completeTask: jest.fn(),
      };
      jest.spyOn(service as any, 'getWorkflowEngineService').mockReturnValue(mockWfService);

      mockManager.findOne.mockResolvedValue({
        id: 601,
        projectId: 10,
        status: 'REVIEW_PENDING',
        submittedBy: 1,
      });

      await service.decideManagementReview(
        10,
        { decision: 'READY_FOR_PROCUREMENT' },
        2,
        ['DIRECTOR'], // DIRECTOR instead of HOps
      );

      // completeTask should not be called
      expect(mockWfService.completeTask).not.toHaveBeenCalled();
      // Should fall back to traditional manager.transaction update
      expect(mockManagementReviewRepo.manager.transaction).toHaveBeenCalled();
    });

    it('49. Active workflow at node_hops_review uses workflow task even when user has GENERAL_MANAGER and HEAD_OF_OPERATIONS (no role precedence bug)', async () => {
      const mockWfService = {
        getInstanceByEntity: jest.fn().mockResolvedValue({
          id: 13,
          status: 'IN_PROGRESS',
          currentNodeId: 'node_hops_review',
          tasks: [{ id: 99, status: 'PENDING', nodeId: 'node_hops_review' }],
        }),
        completeTask: jest.fn().mockResolvedValue({}),
      };
      jest.spyOn(service as any, 'getWorkflowEngineService').mockReturnValue(mockWfService);

      mockManagementReviewRepo.findOne
        .mockResolvedValueOnce({
          id: 601,
          projectId: 10,
          status: 'REVIEW_PENDING',
          submittedBy: 1,
        })
        .mockResolvedValueOnce({
          id: 601,
          projectId: 10,
          status: 'REVIEW_PENDING',
          submittedBy: 1,
        })
        .mockResolvedValueOnce({
          id: 601,
          projectId: 10,
          status: 'REVIEW_PENDING',
          submittedBy: 1,
          decidedBy: 58,
          reviewerRole: 'HEAD_OF_OPERATIONS',
        });

      const res = await service.decideManagementReview(
        10,
        { decision: 'READY_FOR_PROCUREMENT' },
        58,
        ['GENERAL_MANAGER', 'HEAD_OF_OPERATIONS'], // User has both roles
      );

      expect(mockWfService.completeTask).toHaveBeenCalledWith(
        99,
        { action: 'APPROVE', reason: null },
        58,
        ['GENERAL_MANAGER', 'HEAD_OF_OPERATIONS'],
      );
      expect(mockManagementReviewRepo.manager.transaction).not.toHaveBeenCalled();
      expect(res.decidedBy).toBe(58);
    });

    it('50. Active workflow at node_hops_review throws ConflictException when active HOPS task is not found (NO fallback to legacy mutation)', async () => {
      const mockWfService = {
        getInstanceByEntity: jest.fn().mockResolvedValue({
          id: 13,
          status: 'IN_PROGRESS',
          currentNodeId: 'node_hops_review',
          tasks: [], // Inconsistent: no active task!
        }),
        completeTask: jest.fn(),
      };
      jest.spyOn(service as any, 'getWorkflowEngineService').mockReturnValue(mockWfService);

      await expect(
        service.decideManagementReview(
          10,
          { decision: 'READY_FOR_PROCUREMENT' },
          58,
          ['HEAD_OF_OPERATIONS'],
        ),
      ).rejects.toThrow(ConflictException);

      // Must NOT fallback to legacy mutation
      expect(mockManagementReviewRepo.manager.transaction).not.toHaveBeenCalled();
      expect(mockWfService.completeTask).not.toHaveBeenCalled();
    });

    it('51. Active workflow at node_hops_review throws ForbiddenException when caller lacks HEAD_OF_OPERATIONS', async () => {
      const mockWfService = {
        getInstanceByEntity: jest.fn().mockResolvedValue({
          id: 13,
          status: 'IN_PROGRESS',
          currentNodeId: 'node_hops_review',
          tasks: [{ id: 99, status: 'PENDING', nodeId: 'node_hops_review' }],
        }),
        completeTask: jest.fn(),
      };
      jest.spyOn(service as any, 'getWorkflowEngineService').mockReturnValue(mockWfService);

      await expect(
        service.decideManagementReview(
          10,
          { decision: 'READY_FOR_PROCUREMENT' },
          58,
          ['GENERAL_MANAGER'], // Only GENERAL_MANAGER, no HEAD_OF_OPERATIONS
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockManagementReviewRepo.manager.transaction).not.toHaveBeenCalled();
      expect(mockWfService.completeTask).not.toHaveBeenCalled();
    });
  });
});

