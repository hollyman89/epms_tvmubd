import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperationalReadinessValidator } from './operational-readiness.validator';
import { ProjectService } from './project.service';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { Task } from '../../entities/task.entity';
import { Project } from '../../entities/project.entity';
import { Contract } from '../../entities/contract.entity';
import { User } from '../../entities/user.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';

describe('OperationalReadinessValidator & ProjectService (R11.1.5-B SSOT)', () => {
  let validator: OperationalReadinessValidator;
  let service: ProjectService;

  let mockWbsRepo: Partial<Repository<WorkBreakdownStructure>>;
  let mockTaskRepo: Partial<Repository<Task>>;
  let mockProjectRepo: Partial<Repository<Project>>;
  let mockContractRepo: Partial<Repository<Contract>>;
  let mockUserRepo: Partial<Repository<User>>;
  let mockCostEstimateRepo: Partial<Repository<ProjectCostEstimate>>;
  let mockCostItemRepo: Partial<Repository<CostItem>>;

  beforeEach(async () => {
    validator = new OperationalReadinessValidator();

    mockWbsRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockTaskRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockProjectRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    mockContractRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    mockUserRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockCostEstimateRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    mockCostItemRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: OperationalReadinessValidator, useValue: validator },
        { provide: getRepositoryToken(WorkBreakdownStructure), useValue: mockWbsRepo },
        { provide: getRepositoryToken(Task), useValue: mockTaskRepo },
        { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
        { provide: getRepositoryToken(Contract), useValue: mockContractRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(ProjectCostEstimate), useValue: mockCostEstimateRepo },
        { provide: getRepositoryToken(CostItem), useValue: mockCostItemRepo },
        { provide: getRepositoryToken(PurchaseRequest), useValue: { find: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  // 1. WBS READINESS TESTS
  describe('WBS Readiness Evaluation', () => {
    it('1. should return NOT_STARTED when 0 WBS nodes exist', () => {
      const res = validator.evaluateWbsReadiness([]);
      expect(res.status).toBe('NOT_STARTED');
      expect(res.majorPackagesCount).toBe(0);
      expect(res.leafDeliverablesCount).toBe(0);
      expect(res.rootWeightSum).toBe(0);
      expect(res.message).toContain('Belum ada paket pekerjaan WBS');
    });

    it('2. should return READY when root weights sum to 100% and hierarchy is valid', () => {
      const nodes = [
        { id: 1, level: 1, weightPercentage: 40.0, parentWbsId: null, deletedAt: null } as any,
        { id: 2, level: 2, weightPercentage: 40.0, parentWbsId: 1, deletedAt: null } as any, // leaf
        { id: 3, level: 1, weightPercentage: 60.0, parentWbsId: null, deletedAt: null } as any, // leaf
      ];
      const res = validator.evaluateWbsReadiness(nodes);
      expect(res.status).toBe('READY');
      expect(res.majorPackagesCount).toBe(2);
      expect(res.leafDeliverablesCount).toBe(2); // node 2 and node 3
      expect(res.rootWeightSum).toBe(100.0);
      expect(res.message).toContain('Struktur WBS seimbang');
    });

    it('3. should return IN_PROGRESS when root weight sum is not 100%', () => {
      const nodes = [
        { id: 1, level: 1, weightPercentage: 50.0, parentWbsId: null, deletedAt: null } as any,
        { id: 2, level: 1, weightPercentage: 30.0, parentWbsId: null, deletedAt: null } as any,
      ];
      const res = validator.evaluateWbsReadiness(nodes);
      expect(res.status).toBe('IN_PROGRESS');
      expect(res.rootWeightSum).toBe(80.0);
      expect(res.message).toContain('Bobot Root WBS belum seimbang');
    });

    it('4. should return BLOCKED when circular parent reference is detected', () => {
      const nodes = [
        { id: 1, level: 1, weightPercentage: 100.0, parentWbsId: 2, deletedAt: null } as any,
        { id: 2, level: 2, weightPercentage: 100.0, parentWbsId: 1, deletedAt: null } as any,
      ];
      const res = validator.evaluateWbsReadiness(nodes);
      expect(res.status).toBe('BLOCKED');
      expect(res.message).toContain('circular dependency');
    });

    it('5. should ignore soft-deleted WBS nodes', () => {
      const nodes = [
        { id: 1, level: 1, weightPercentage: 100.0, parentWbsId: null, deletedAt: null } as any,
        { id: 2, level: 1, weightPercentage: 50.0, parentWbsId: null, deletedAt: new Date() } as any,
      ];
      const res = validator.evaluateWbsReadiness(nodes);
      expect(res.status).toBe('READY');
      expect(res.majorPackagesCount).toBe(1);
      expect(res.rootWeightSum).toBe(100.0);
    });
  });

  // 2. COST READINESS TESTS
  describe('Cost / RAB Readiness Evaluation', () => {
    const validWbsLeaf = [
      { id: 10, level: 1, weightPercentage: 100.0, parentWbsId: null, deletedAt: null } as any,
    ];

    it('6. should return NOT_STARTED when no estimate record exists', () => {
      const res = validator.evaluateCostReadiness(null, [], validWbsLeaf);
      expect(res.status).toBe('NOT_STARTED');
      expect(res.totalEstimate).toBe(0);
      expect(res.message).toContain('Belum ada estimasi biaya');
    });

    it('7. should return READY for valid estimate with non-zero total and valid WBS leaf mapping', () => {
      const estimate = { id: 1, status: 'DRAFT', deletedAt: null } as any;
      const items = [
        {
          id: 101,
          quantity: 2,
          unitPrice: 500000,
          subtotal: 1000000,
          wbsId: 10,
          assignmentScope: 'WBS',
          deletedAt: null,
        } as any,
      ];
      const res = validator.evaluateCostReadiness(estimate, items, validWbsLeaf);
      expect(res.status).toBe('READY');
      expect(res.totalEstimate).toBe(1000000);
      expect(res.itemizedItemsCount).toBe(1);
      expect(res.orphanedItemsCount).toBe(0);
      expect(res.unassignedItemsCount).toBe(0);
      expect(res.message).toContain('Estimasi biaya siap');
    });

    it('8. should return IN_PROGRESS when estimate exists but total is 0 or 0 items', () => {
      const estimate = { id: 1, status: 'DRAFT', deletedAt: null } as any;
      const res = validator.evaluateCostReadiness(estimate, [], validWbsLeaf);
      expect(res.status).toBe('IN_PROGRESS');
      expect(res.totalEstimate).toBe(0);
      expect(res.message).toContain('belum memiliki rincian item biaya');
    });

    it('9. should return IN_PROGRESS when item references an orphaned WBS node or non-leaf', () => {
      const estimate = { id: 1, status: 'DRAFT', deletedAt: null } as any;
      const items = [
        {
          id: 101,
          quantity: 1,
          unitPrice: 100000,
          subtotal: 100000,
          wbsId: 999, // non-existent WBS
          assignmentScope: 'WBS',
          deletedAt: null,
        } as any,
      ];
      const res = validator.evaluateCostReadiness(estimate, items, validWbsLeaf);
      expect(res.status).toBe('IN_PROGRESS');
      expect(res.orphanedItemsCount).toBe(1);
      expect(res.message).toContain('merujuk ke WBS yang tidak valid');
    });

    it('10. should return BLOCKED when subtotal math is corrupted (subtotal != qty * unitPrice)', () => {
      const estimate = { id: 1, status: 'DRAFT', deletedAt: null } as any;
      const items = [
        {
          id: 101,
          quantity: 10,
          unitPrice: 50000,
          subtotal: 9999999, // Corrupted subtotal!
          wbsId: 10,
          assignmentScope: 'WBS',
          deletedAt: null,
        } as any,
      ];
      const res = validator.evaluateCostReadiness(estimate, items, validWbsLeaf);
      expect(res.status).toBe('BLOCKED');
      expect(res.message).toContain('Inkonsistensi kalkulasi matematis subtotal');
    });

    it('11. should return BLOCKED when price or quantity is negative', () => {
      const estimate = { id: 1, status: 'DRAFT', deletedAt: null } as any;
      const items = [
        {
          id: 101,
          quantity: -5,
          unitPrice: 1000,
          subtotal: -5000,
          wbsId: 10,
          deletedAt: null,
        } as any,
      ];
      const res = validator.evaluateCostReadiness(estimate, items, validWbsLeaf);
      expect(res.status).toBe('BLOCKED');
      expect(res.message).toContain('Terdapat nilai kuantitas atau harga satuan negatif');
    });
  });

  // 3. SCHEDULE READINESS TESTS
  describe('Schedule / Gantt Readiness Evaluation', () => {
    const validWbsLeaf = [
      { id: 10, level: 1, weightPercentage: 50.0, parentWbsId: null, deletedAt: null } as any,
      { id: 20, level: 1, weightPercentage: 50.0, parentWbsId: null, deletedAt: null } as any,
    ];

    it('12. should return NOT_STARTED when 0 tasks exist', () => {
      const res = validator.evaluateScheduleReadiness([], validWbsLeaf);
      expect(res.status).toBe('NOT_STARTED');
      expect(res.totalTasks).toBe(0);
      expect(res.message).toContain('Belum ada jadwal pekerjaan');
    });

    it('13. should return READY when 100% leaf deliverables are scheduled and dates are valid', () => {
      const tasks = [
        {
          id: 1,
          name: 'Pondasi Gardu',
          wbsId: 10,
          startDate: '2026-09-01',
          endDate: '2026-09-15',
          duration: 14,
          isMilestone: false,
          predecessorTaskId: null,
          deletedAt: null,
        } as any,
        {
          id: 2,
          name: 'Instalasi Trafo',
          wbsId: 20,
          startDate: '2026-09-16',
          endDate: '2026-09-30',
          duration: 14,
          isMilestone: false,
          predecessorTaskId: 1,
          deletedAt: null,
        } as any,
      ];
      const res = validator.evaluateScheduleReadiness(tasks, validWbsLeaf);
      expect(res.status).toBe('READY');
      expect(res.totalTasks).toBe(2);
      expect(res.scheduledDeliverablesCount).toBe(2);
      expect(res.leafDeliverablesCount).toBe(2);
      expect(res.hasCircularDependencies).toBe(false);
      expect(res.message).toContain('Seluruh 2 deliverable terjadwal valid');
    });

    it('14. should return IN_PROGRESS when not all leaf deliverables are covered', () => {
      const tasks = [
        {
          id: 1,
          name: 'Pondasi Gardu',
          wbsId: 10,
          startDate: '2026-09-01',
          endDate: '2026-09-15',
          isMilestone: false,
          deletedAt: null,
        } as any,
        // WBS 20 is not scheduled!
      ];
      const res = validator.evaluateScheduleReadiness(tasks, validWbsLeaf);
      expect(res.status).toBe('IN_PROGRESS');
      expect(res.scheduledDeliverablesCount).toBe(1);
      expect(res.leafDeliverablesCount).toBe(2);
      expect(res.message).toContain('1 dari 2 leaf deliverable belum memiliki jadwal');
    });

    it('15. should return IN_PROGRESS when task dates are missing or invalid', () => {
      const tasks = [
        {
          id: 1,
          name: 'Pondasi Gardu',
          wbsId: 10,
          startDate: 'invalid-date',
          endDate: null,
          isMilestone: false,
          deletedAt: null,
        } as any,
        {
          id: 2,
          name: 'Instalasi Trafo',
          wbsId: 20,
          startDate: '2026-09-16',
          endDate: '2026-09-30',
          isMilestone: false,
          deletedAt: null,
        } as any,
      ];
      const res = validator.evaluateScheduleReadiness(tasks, validWbsLeaf);
      expect(res.status).toBe('IN_PROGRESS');
      expect(res.message).toContain('belum memiliki jadwal lengkap');
    });

    it('16. should return BLOCKED when circular predecessor dependency is detected', () => {
      const tasks = [
        {
          id: 1,
          name: 'Task 1',
          wbsId: 10,
          startDate: '2026-09-01',
          endDate: '2026-09-10',
          predecessorTaskId: 2,
          deletedAt: null,
        } as any,
        {
          id: 2,
          name: 'Task 2',
          wbsId: 20,
          startDate: '2026-09-11',
          endDate: '2026-09-20',
          predecessorTaskId: 1,
          deletedAt: null,
        } as any,
      ];
      const res = validator.evaluateScheduleReadiness(tasks, validWbsLeaf);
      expect(res.status).toBe('BLOCKED');
      expect(res.hasCircularDependencies).toBe(true);
      expect(res.message).toContain('circular dependency');
    });

    it('17. should return BLOCKED when Finish-to-Start chronology is violated (start < predecessor end)', () => {
      const tasks = [
        {
          id: 1,
          name: 'Task 1',
          wbsId: 10,
          startDate: '2026-09-01',
          endDate: '2026-09-15',
          predecessorTaskId: null,
          deletedAt: null,
        } as any,
        {
          id: 2,
          name: 'Task 2',
          wbsId: 20,
          startDate: '2026-09-10', // Violated! Starts before Task 1 ends on 09-15
          endDate: '2026-09-20',
          predecessorTaskId: 1,
          deletedAt: null,
        } as any,
      ];
      const res = validator.evaluateScheduleReadiness(tasks, validWbsLeaf);
      expect(res.status).toBe('BLOCKED');
      expect(res.message).toContain('Pelanggaran dependensi Finish-to-Start');
    });

    it('18. should return BLOCKED when non-milestone task has endDate < startDate', () => {
      const tasks = [
        {
          id: 1,
          name: 'Task 1',
          wbsId: 10,
          startDate: '2026-09-20',
          endDate: '2026-09-10', // End before start!
          isMilestone: false,
          deletedAt: null,
        } as any,
      ];
      const res = validator.evaluateScheduleReadiness(tasks, validWbsLeaf);
      expect(res.status).toBe('BLOCKED');
      expect(res.message).toContain('memiliki tanggal selesai sebelum tanggal mulai');
    });

    it('19. should allow multiple tasks on the same leaf node', () => {
      const singleLeafWbs = [
        { id: 10, level: 1, weightPercentage: 100.0, parentWbsId: null, deletedAt: null } as any,
      ];
      const tasks = [
        {
          id: 1,
          name: 'Task 1A',
          wbsId: 10,
          startDate: '2026-09-01',
          endDate: '2026-09-10',
          isMilestone: false,
          deletedAt: null,
        } as any,
        {
          id: 2,
          name: 'Task 1B',
          wbsId: 10,
          startDate: '2026-09-11',
          endDate: '2026-09-20',
          isMilestone: false,
          predecessorTaskId: 1,
          deletedAt: null,
        } as any,
      ];
      const res = validator.evaluateScheduleReadiness(tasks, singleLeafWbs);
      expect(res.status).toBe('READY');
      expect(res.totalTasks).toBe(2);
      expect(res.scheduledDeliverablesCount).toBe(1);
      expect(res.leafDeliverablesCount).toBe(1);
    });
  });

  // 4. INITIAL CONDITION & PROCUREMENT GATE BOUNDARY TESTS
  describe('Initial Condition & Procurement Gate Boundary (Phase B Contract)', () => {
    it('20. should always return NOT_STARTED for Initial Condition in Phase B (zero localStorage dependency)', () => {
      const data = validator.aggregateReadiness(
        10,
        'PRJ-10',
        'Test Proyek',
        { status: 'READY', majorPackagesCount: 1, leafDeliverablesCount: 1, rootWeightSum: 100, message: '' },
        { status: 'READY', totalEstimate: 100, itemizedItemsCount: 1, unassignedItemsCount: 0, orphanedItemsCount: 0, message: '' },
        { status: 'READY', totalTasks: 1, leafDeliverablesCount: 1, scheduledDeliverablesCount: 1, hasCircularDependencies: false, message: '' },
      );
      expect(data.pillars.initialCondition.status).toBe('NOT_STARTED');
      expect(data.pillars.initialCondition.isComplete).toBe(false);
      expect(data.pillars.initialCondition.conditionStatus).toBeNull();
      expect(data.pillars.initialCondition.message).toContain('menunggu persistensi R11.1.5-C');
    });

    it('21. should always return NOT_SUBMITTED for Procurement Gate in Phase B and lock PR creation', () => {
      const data = validator.aggregateReadiness(
        10,
        'PRJ-10',
        'Test Proyek',
        { status: 'READY', majorPackagesCount: 1, leafDeliverablesCount: 1, rootWeightSum: 100, message: '' },
        { status: 'READY', totalEstimate: 100, itemizedItemsCount: 1, unassignedItemsCount: 0, orphanedItemsCount: 0, message: '' },
        { status: 'READY', totalTasks: 1, leafDeliverablesCount: 1, scheduledDeliverablesCount: 1, hasCircularDependencies: false, message: '' },
      );
      expect(data.gate.status).toBe('NOT_SUBMITTED');
      expect(data.gate.decidedAt).toBeNull();
      expect(data.gate.decidedBy).toBeNull();
      expect(data.canCreatePr).toBe(false); // PR creation strictly locked!
    });
  });

  // 5. OVERALL READINESS AGGREGATION TESTS
  describe('Overall Readiness Aggregation', () => {
    it('22. should return NOT_STARTED when 0 pillars are READY', () => {
      const data = validator.aggregateReadiness(
        1,
        'PRJ-1',
        'Test',
        { status: 'NOT_STARTED', majorPackagesCount: 0, leafDeliverablesCount: 0, rootWeightSum: 0, message: '' },
        { status: 'NOT_STARTED', totalEstimate: 0, itemizedItemsCount: 0, unassignedItemsCount: 0, orphanedItemsCount: 0, message: '' },
        { status: 'NOT_STARTED', totalTasks: 0, leafDeliverablesCount: 0, scheduledDeliverablesCount: 0, hasCircularDependencies: false, message: '' },
      );
      expect(data.overallStatus).toBe('NOT_STARTED');
      expect(data.completenessCount).toBe(0);
      expect(data.canSubmitForReview).toBe(false);
    });

    it('23. should return IN_PROGRESS when 1 to 3 pillars are READY', () => {
      const data = validator.aggregateReadiness(
        1,
        'PRJ-1',
        'Test',
        { status: 'READY', majorPackagesCount: 1, leafDeliverablesCount: 1, rootWeightSum: 100, message: '' },
        { status: 'READY', totalEstimate: 100, itemizedItemsCount: 1, unassignedItemsCount: 0, orphanedItemsCount: 0, message: '' },
        { status: 'READY', totalTasks: 1, leafDeliverablesCount: 1, scheduledDeliverablesCount: 1, hasCircularDependencies: false, message: '' },
      );
      // 3 technical pillars READY, but Initial Condition is NOT_STARTED -> 3/4 Complete -> IN_PROGRESS
      expect(data.overallStatus).toBe('IN_PROGRESS');
      expect(data.completenessCount).toBe(3);
      expect(data.totalPillars).toBe(4);
      expect(data.canSubmitForReview).toBe(false); // Can only submit when 4/4 READY
    });

    it('24. should return BLOCKED if any pillar is BLOCKED', () => {
      const data = validator.aggregateReadiness(
        1,
        'PRJ-1',
        'Test',
        { status: 'READY', majorPackagesCount: 1, leafDeliverablesCount: 1, rootWeightSum: 100, message: '' },
        { status: 'BLOCKED', totalEstimate: 0, itemizedItemsCount: 0, unassignedItemsCount: 0, orphanedItemsCount: 0, message: 'Math error' },
        { status: 'READY', totalTasks: 1, leafDeliverablesCount: 1, scheduledDeliverablesCount: 1, hasCircularDependencies: false, message: '' },
      );
      expect(data.overallStatus).toBe('BLOCKED');
      expect(data.canSubmitForReview).toBe(false);
    });
  });

  // 6. SERVICE INTEGRATION & PROJECT ISOLATION TESTS
  describe('ProjectService.getOperationalReadiness Integration', () => {
    it('25. should throw NotFoundException (404) when project does not exist', async () => {
      (mockProjectRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.getOperationalReadiness(999)).rejects.toThrow(NotFoundException);
    });

    it('26. should throw BadRequestException (400) when projectId is invalid (<= 0 or NaN)', async () => {
      await expect(service.getOperationalReadiness(0)).rejects.toThrow(BadRequestException);
      await expect(service.getOperationalReadiness(NaN)).rejects.toThrow(BadRequestException);
    });

    it('27. should query and isolate data strictly for the specified projectId', async () => {
      const mockProject = { id: 10, code: 'PRJ-2026-0010', name: 'Gardu Induk UBD' };
      (mockProjectRepo.findOne as jest.Mock).mockResolvedValue(mockProject);
      (mockWbsRepo.find as jest.Mock).mockResolvedValue([
        { id: 1, projectId: 10, level: 1, weightPercentage: 100, parentWbsId: null, deletedAt: null },
      ]);
      (mockCostEstimateRepo.findOne as jest.Mock).mockResolvedValue({
        id: 5,
        projectId: 10,
        status: 'DRAFT',
        deletedAt: null,
      });
      (mockCostItemRepo.find as jest.Mock).mockResolvedValue([
        {
          id: 50,
          estimateId: 5,
          quantity: 2,
          unitPrice: 250000,
          subtotal: 500000,
          wbsId: 1,
          assignmentScope: 'WBS',
          deletedAt: null,
        },
      ]);
      (mockTaskRepo.find as jest.Mock).mockResolvedValue([
        {
          id: 100,
          projectId: 10,
          wbsId: 1,
          name: 'Task Utama',
          startDate: '2026-09-01',
          endDate: '2026-09-10',
          duration: 9,
          isMilestone: false,
          predecessorTaskId: null,
          deletedAt: null,
        },
      ]);

      const res = await service.getOperationalReadiness(10);

      expect(mockWbsRepo.find).toHaveBeenCalledWith({ where: { projectId: 10 } });
      expect(mockTaskRepo.find).toHaveBeenCalledWith({ where: { projectId: 10 } });
      expect(mockCostEstimateRepo.findOne).toHaveBeenCalledWith({
        where: { projectId: 10 },
        order: { version: 'DESC' },
      });

      expect(res.projectId).toBe(10);
      expect(res.projectCode).toBe('PRJ-2026-0010');
      expect(res.projectName).toBe('Gardu Induk UBD');
      expect(res.pillars.wbs.status).toBe('READY');
      expect(res.pillars.cost.status).toBe('READY');
      expect(res.pillars.schedule.status).toBe('READY');
      expect(res.pillars.initialCondition.status).toBe('NOT_STARTED');
      expect(res.gate.status).toBe('NOT_SUBMITTED');
      expect(res.overallStatus).toBe('IN_PROGRESS');
      expect(res.completenessCount).toBe(3);
      expect(res.canSubmitForReview).toBe(false);
      expect(res.canCreatePr).toBe(false);
    });

    it('28. should load canonical contract data when project.contractId exists (P2.1-B2)', async () => {
      (mockProjectRepo.findOne as jest.Mock).mockResolvedValue({
        id: 11,
        code: 'PRJ-11',
        name: 'Project 11',
        contractId: 48,
        status: 'PLANNING',
      });

      (mockContractRepo.findOne as jest.Mock).mockResolvedValue({
        id: 48,
        contract_number: 'CONT-2026-0048',
        contract_value: 150000000,
        legal_status: 'APPROVED',
        status: 'ACTIVE',
        start_date: '2026-09-01',
        end_date: '2026-12-31',
      });

      const res = await service.getOperationalReadiness(11);

      expect(mockContractRepo.findOne).toHaveBeenCalledWith({ where: { id: 48 } });
      expect(res.contract).toBeDefined();
      expect(res.contract?.contractNumber).toBe('CONT-2026-0048');
      expect(res.contract?.contractValue).toBe(150000000);
      expect(res.contract?.legalStatus).toBe('APPROVED');
      expect(res.contract?.status).toBe('ACTIVE');
    });
  });
});

