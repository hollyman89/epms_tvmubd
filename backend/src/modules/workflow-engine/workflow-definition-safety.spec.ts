import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ForbiddenException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  WorkflowDefinitionService,
  PROTECTED_CANONICAL_WORKFLOW_KEYS,
} from './workflow-definition.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowDefinition } from '../../entities/workflow-definition.entity';
import { WorkflowVersion } from '../../entities/workflow-version.entity';
import {
  WorkflowInstance,
  WorkflowInstanceStatus,
} from '../../entities/workflow-instance.entity';
import { WorkflowTask } from '../../entities/workflow-task.entity';
import { WorkflowTransition } from '../../entities/workflow-transition.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { Role } from '../../entities/role.entity';
import { OutboxEvent } from '../../entities/outbox-event.entity';

describe('WorkflowDefinitionService - Safety Layer (WD-1)', () => {
  let service: WorkflowDefinitionService;
  let engineService: WorkflowEngineService;

  // Mock repos
  let mockDefinitionRepo: any;
  let mockVersionRepo: any;
  let mockInstanceRepo: any;
  let mockTaskRepo: any;
  let mockTransitionRepo: any;
  let mockRoleRepo: any;
  let mockOutboxRepo: any;
  let mockDataSource: any;
  let mockEventEmitter: any;
  let mockEntityManager: any;

  beforeEach(async () => {
    mockEntityManager = {
      save: jest.fn().mockImplementation((entityOrClass, entity) => {
        return Promise.resolve(entity || entityOrClass);
      }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn().mockImplementation((cls, data) => ({ ...data, id: 999 })),
    };

    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => cb(mockEntityManager)),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    mockDefinitionRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockVersionRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    mockInstanceRepo = {
      count: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockTaskRepo = {
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockTransitionRepo = {
      count: jest.fn(),
    };

    mockRoleRepo = {
      findOne: jest.fn(),
    };

    mockOutboxRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowDefinitionService,
        WorkflowEngineService,
        {
          provide: getRepositoryToken(WorkflowDefinition),
          useValue: mockDefinitionRepo,
        },
        {
          provide: getRepositoryToken(WorkflowVersion),
          useValue: mockVersionRepo,
        },
        {
          provide: getRepositoryToken(WorkflowInstance),
          useValue: mockInstanceRepo,
        },
        {
          provide: getRepositoryToken(WorkflowTask),
          useValue: mockTaskRepo,
        },
        {
          provide: getRepositoryToken(WorkflowTransition),
          useValue: mockTransitionRepo,
        },
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepo,
        },
        {
          provide: getRepositoryToken(OutboxEvent),
          useValue: mockOutboxRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<WorkflowDefinitionService>(WorkflowDefinitionService);
    engineService = module.get<WorkflowEngineService>(WorkflowEngineService);
  });

  // CONTROLLED DELETE TESTS
  describe('Controlled Delete', () => {
    it('1. draft unused -> DELETE SUCCESS with AuditLog & event', async () => {
      const draftDef: Partial<WorkflowDefinition> = {
        id: 10,
        workflowKey: 'UNUSED_DRAFT_WF',
        name: 'Unused Draft Workflow',
        status: 'DRAFT',
        activeVersion: null,
        isActive: 1,
        versions: [
          { id: 101, version: 1, status: 'DRAFT', publishedAt: null } as any,
        ],
      };

      mockDefinitionRepo.findOne.mockResolvedValue(draftDef);

      // 0 instances
      const instanceQb = {
        withDeleted: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      mockInstanceRepo.createQueryBuilder.mockReturnValue(instanceQb);

      // 0 tasks
      const taskQb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      mockTaskRepo.createQueryBuilder.mockReturnValue(taskQb);

      // 0 transitions
      mockTransitionRepo.count.mockResolvedValue(0);

      const result = await service.deleteDefinition('UNUSED_DRAFT_WF', 1);

      expect(result).toEqual({ id: 10, workflowKey: 'UNUSED_DRAFT_WF', deleted: true });
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockEntityManager.delete).toHaveBeenCalledWith(WorkflowDefinition, { id: 10 });
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        AuditLog,
        expect.objectContaining({
          table_name: 'workflow_definitions',
          record_id: 10,
          action: 'DELETE',
        }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'audit.log',
        expect.objectContaining({
          action: 'WORKFLOW_DEFINITION_DELETED',
          entityId: 10,
        }),
      );
    });

    it('2. published definition -> 409 Conflict', async () => {
      const pubDef: Partial<WorkflowDefinition> = {
        id: 11,
        workflowKey: 'PUBLISHED_WF',
        status: 'PUBLISHED',
        activeVersion: 1,
        versions: [{ id: 102, version: 1, status: 'PUBLISHED', publishedAt: new Date() } as any],
      };

      mockDefinitionRepo.findOne.mockResolvedValue(pubDef);

      await expect(service.deleteDefinition('PUBLISHED_WF')).rejects.toThrow(ConflictException);
    });

    it('3. activeVersion exists on draft -> 409 Conflict', async () => {
      const def: Partial<WorkflowDefinition> = {
        id: 12,
        workflowKey: 'ACTIVE_VER_WF',
        status: 'DRAFT',
        activeVersion: 1,
        versions: [],
      };

      mockDefinitionRepo.findOne.mockResolvedValue(def);

      await expect(service.deleteDefinition('ACTIVE_VER_WF')).rejects.toThrow(ConflictException);
    });

    it('4. canonical project workflow -> 403 Forbidden', async () => {
      const projectDef: Partial<WorkflowDefinition> = {
        id: 25,
        workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
        status: 'DRAFT',
        activeVersion: null,
      };

      mockDefinitionRepo.findOne.mockResolvedValue(projectDef);

      await expect(service.deleteDefinition('PROJECT_PLAN_REVIEW_WORKFLOW')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('5. canonical PR workflow -> 403 Forbidden', async () => {
      const prDef: Partial<WorkflowDefinition> = {
        id: 22,
        workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
        status: 'DRAFT',
        activeVersion: null,
      };

      mockDefinitionRepo.findOne.mockResolvedValue(prDef);

      await expect(service.deleteDefinition('PURCHASE_REQUEST_WORKFLOW')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('6. instance exists -> 409 Conflict', async () => {
      const def: Partial<WorkflowDefinition> = {
        id: 13,
        workflowKey: 'WITH_INSTANCES_WF',
        status: 'DRAFT',
        activeVersion: null,
        versions: [{ id: 103, version: 1, status: 'DRAFT', publishedAt: null } as any],
      };

      mockDefinitionRepo.findOne.mockResolvedValue(def);

      const instanceQb = {
        withDeleted: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(3), // 3 instances exist!
      };
      mockInstanceRepo.createQueryBuilder.mockReturnValue(instanceQb);

      await expect(service.deleteDefinition('WITH_INSTANCES_WF')).rejects.toThrow(ConflictException);
    });

    it('7. task exists -> 409 Conflict', async () => {
      const def: Partial<WorkflowDefinition> = {
        id: 14,
        workflowKey: 'WITH_TASKS_WF',
        status: 'DRAFT',
        activeVersion: null,
        versions: [{ id: 104, version: 1, status: 'DRAFT', publishedAt: null } as any],
      };

      mockDefinitionRepo.findOne.mockResolvedValue(def);

      const instanceQb = {
        withDeleted: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      mockInstanceRepo.createQueryBuilder.mockReturnValue(instanceQb);

      const taskQb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(2), // 2 tasks exist!
      };
      mockTaskRepo.createQueryBuilder.mockReturnValue(taskQb);

      await expect(service.deleteDefinition('WITH_TASKS_WF')).rejects.toThrow(ConflictException);
    });

    it('8. transition exists -> 409 Conflict', async () => {
      const def: Partial<WorkflowDefinition> = {
        id: 15,
        workflowKey: 'WITH_TRANSITIONS_WF',
        status: 'DRAFT',
        activeVersion: null,
        versions: [{ id: 105, version: 1, status: 'DRAFT', publishedAt: null } as any],
      };

      mockDefinitionRepo.findOne.mockResolvedValue(def);

      const instanceQb = {
        withDeleted: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      mockInstanceRepo.createQueryBuilder.mockReturnValue(instanceQb);

      const taskQb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      mockTaskRepo.createQueryBuilder.mockReturnValue(taskQb);

      mockTransitionRepo.count.mockResolvedValue(5); // 5 transitions exist!

      await expect(service.deleteDefinition('WITH_TRANSITIONS_WF')).rejects.toThrow(
        ConflictException,
      );
    });

    it('9. non-existent workflow -> 404 NotFoundException', async () => {
      mockDefinitionRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteDefinition('NON_EXISTENT')).rejects.toThrow(NotFoundException);
    });
  });

  // CONTROLLED ARCHIVE TESTS
  describe('Controlled Archive', () => {
    it('10. published unused -> ARCHIVE SUCCESS', async () => {
      const def: Partial<WorkflowDefinition> = {
        id: 16,
        workflowKey: 'CUSTOM_PUBLISHED_WF',
        status: 'PUBLISHED',
        activeVersion: 1,
        isActive: 1,
        versions: [{ id: 106, version: 1, status: 'PUBLISHED', publishedAt: new Date() } as any],
      };

      mockDefinitionRepo.findOne.mockResolvedValue(def);
      mockInstanceRepo.count.mockResolvedValue(0); // 0 active instances

      const result = await service.archiveDefinition('CUSTOM_PUBLISHED_WF', 2);

      expect(result.status).toBe('ARCHIVED');
      expect(result.isActive).toBe(0);
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        AuditLog,
        expect.objectContaining({
          table_name: 'workflow_definitions',
          record_id: 16,
          action: 'ARCHIVE',
        }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'audit.log',
        expect.objectContaining({
          action: 'WORKFLOW_DEFINITION_ARCHIVED',
          entityId: 16,
        }),
      );
    });

    it('11. completed history (0 IN_PROGRESS) -> ARCHIVE SUCCESS', async () => {
      const def: Partial<WorkflowDefinition> = {
        id: 17,
        workflowKey: 'COMPLETED_HISTORY_WF',
        status: 'PUBLISHED',
        activeVersion: 1,
        isActive: 1,
      };

      mockDefinitionRepo.findOne.mockResolvedValue(def);
      // No active IN_PROGRESS instances
      mockInstanceRepo.count.mockResolvedValue(0);

      const result = await service.archiveDefinition(17, 1);

      expect(result.status).toBe('ARCHIVED');
      expect(result.isActive).toBe(0);
    });

    it('12. active instance (status = IN_PROGRESS) -> 409 Conflict', async () => {
      const def: Partial<WorkflowDefinition> = {
        id: 18,
        workflowKey: 'ACTIVE_RUNNING_WF',
        status: 'PUBLISHED',
        activeVersion: 1,
        isActive: 1,
      };

      mockDefinitionRepo.findOne.mockResolvedValue(def);
      mockInstanceRepo.count.mockResolvedValue(1); // 1 instance IN_PROGRESS!

      await expect(service.archiveDefinition('ACTIVE_RUNNING_WF')).rejects.toThrow(
        ConflictException,
      );
    });

    it('13. canonical project workflow -> 403 Forbidden on archive', async () => {
      const projectDef: Partial<WorkflowDefinition> = {
        id: 25,
        workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
        status: 'PUBLISHED',
      };

      mockDefinitionRepo.findOne.mockResolvedValue(projectDef);

      await expect(
        service.archiveDefinition('PROJECT_PLAN_REVIEW_WORKFLOW'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('14. canonical PR workflow -> 403 Forbidden on archive', async () => {
      const prDef: Partial<WorkflowDefinition> = {
        id: 22,
        workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
        status: 'PUBLISHED',
      };

      mockDefinitionRepo.findOne.mockResolvedValue(prDef);

      await expect(service.archiveDefinition('PURCHASE_REQUEST_WORKFLOW')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('15. already archived -> 409 Conflict', async () => {
      const archivedDef: Partial<WorkflowDefinition> = {
        id: 19,
        workflowKey: 'ALREADY_ARCHIVED_WF',
        status: 'ARCHIVED',
        isActive: 0,
      };

      mockDefinitionRepo.findOne.mockResolvedValue(archivedDef);

      await expect(service.archiveDefinition('ALREADY_ARCHIVED_WF')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // QUERY FILTERING TESTS
  describe('Query Filtering', () => {
    it('16. getDefinitions(false) -> hides archived/inactive workflows by default', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { workflowKey: 'ACTIVE_WF_1', status: 'PUBLISHED', isActive: 1 },
          { workflowKey: 'ACTIVE_WF_2', status: 'DRAFT', isActive: 1 },
        ]),
      };
      mockDefinitionRepo.createQueryBuilder.mockReturnValue(qb);

      const results = await service.getDefinitions(false);

      expect(mockDefinitionRepo.createQueryBuilder).toHaveBeenCalledWith('def');
      expect(qb.where).toHaveBeenCalledWith('def.status != :archivedStatus', {
        archivedStatus: 'ARCHIVED',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('(def.isActive = 1 OR def.isActive IS NULL)');
      expect(results).toHaveLength(2);
    });

    it('17. getDefinitions(true) -> includes archived definitions', async () => {
      mockDefinitionRepo.find.mockResolvedValue([
        { workflowKey: 'ACTIVE_WF_1', status: 'PUBLISHED', isActive: 1 },
        { workflowKey: 'ARCHIVED_WF_1', status: 'ARCHIVED', isActive: 0 },
      ]);

      const results = await service.getDefinitions(true);

      expect(mockDefinitionRepo.find).toHaveBeenCalledWith({
        relations: ['versions'],
        order: { createdAt: 'DESC' },
      });
      expect(results).toHaveLength(2);
    });
  });

  // ENGINE GUARD & MUTATION GUARD ON ARCHIVED WORKFLOWS
  describe('Engine & Mutation Guard on Archived Workflows', () => {
    it('18. WorkflowEngineService.startInstance -> rejects archived workflow with BadRequestException', async () => {
      const archivedDef: Partial<WorkflowDefinition> = {
        id: 20,
        workflowKey: 'ARCHIVED_ENGINE_WF',
        status: 'ARCHIVED',
        isActive: 0,
        activeVersion: 1,
        versions: [{ id: 110, version: 1, status: 'PUBLISHED' } as any],
      };

      mockDefinitionRepo.findOne.mockResolvedValue(archivedDef);

      await expect(
        engineService.startInstance({
          workflowKey: 'ARCHIVED_ENGINE_WF',
          entityType: 'PURCHASE_REQUEST',
          entityId: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('19. WorkflowEngineService.startInstance -> rejects inactive workflow with BadRequestException', async () => {
      const inactiveDef: Partial<WorkflowDefinition> = {
        id: 21,
        workflowKey: 'INACTIVE_ENGINE_WF',
        status: 'PUBLISHED',
        isActive: 0,
        activeVersion: 1,
        versions: [{ id: 111, version: 1, status: 'PUBLISHED' } as any],
      };

      mockDefinitionRepo.findOne.mockResolvedValue(inactiveDef);

      await expect(
        engineService.startInstance({
          workflowKey: 'INACTIVE_ENGINE_WF',
          entityType: 'PURCHASE_REQUEST',
          entityId: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('20. WorkflowDefinitionService mutation methods -> reject mutations on archived workflow', async () => {
      const archivedDef: Partial<WorkflowDefinition> = {
        id: 22,
        workflowKey: 'ARCHIVED_MUTATION_WF',
        status: 'ARCHIVED',
        isActive: 0,
        activeVersion: 1,
        versions: [
          { id: 112, version: 1, status: 'PUBLISHED', bpmnJson: {} } as any,
        ],
      };

      mockDefinitionRepo.findOne.mockResolvedValue(archivedDef);

      // createVersion rejects
      await expect(
        service.createVersion('ARCHIVED_MUTATION_WF', { bpmnJson: {} }),
      ).rejects.toThrow(BadRequestException);

      // updateVersion rejects
      await expect(
        service.updateVersion('ARCHIVED_MUTATION_WF', 1, {}),
      ).rejects.toThrow(BadRequestException);

      // publishVersion rejects
      await expect(
        service.publishVersion('ARCHIVED_MUTATION_WF', 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // CANONICAL DEFINITIONS IMMUTABILITY / CONSTANTS
  describe('Canonical Workflow Constants & Version Protection', () => {
    it('21. should protect exact canonical workflow keys', () => {
      expect(PROTECTED_CANONICAL_WORKFLOW_KEYS).toContain('PROJECT_PLAN_REVIEW_WORKFLOW');
      expect(PROTECTED_CANONICAL_WORKFLOW_KEYS).toContain('PURCHASE_REQUEST_WORKFLOW');
      expect(PROTECTED_CANONICAL_WORKFLOW_KEYS).toHaveLength(2);
    });

    it('22. canonical workflow -> createVersion rejects with 403 Forbidden (WV-10)', async () => {
      const canonicalDef = {
        id: 25,
        workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
        name: 'Project Plan Review Workflow',
        domain: 'PROJECT',
        activeVersion: 1,
        status: 'PUBLISHED',
        isActive: 1,
        versions: [{ id: 1, version: 1, status: 'PUBLISHED', bpmnJson: {} }],
      };
      mockDefinitionRepo.findOne.mockResolvedValue(canonicalDef);

      await expect(
        service.createVersion('PROJECT_PLAN_REVIEW_WORKFLOW', { bpmnJson: {} }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('23. canonical workflow -> updateVersion rejects with 403 Forbidden', async () => {
      const canonicalDef = {
        id: 25,
        workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
        name: 'Project Plan Review Workflow',
        domain: 'PROJECT',
        activeVersion: 1,
        status: 'PUBLISHED',
        isActive: 1,
        versions: [{ id: 1, version: 1, status: 'PUBLISHED', bpmnJson: {} }],
      };
      mockDefinitionRepo.findOne.mockResolvedValue(canonicalDef);

      await expect(
        service.updateVersion('PROJECT_PLAN_REVIEW_WORKFLOW', 1, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('24. canonical workflow -> publishVersion rejects with 403 Forbidden', async () => {
      const canonicalDef = {
        id: 22,
        workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
        name: 'Purchase Request Approval Workflow',
        domain: 'PROCUREMENT',
        activeVersion: 2,
        status: 'PUBLISHED',
        isActive: 1,
        versions: [{ id: 2, version: 2, status: 'PUBLISHED', bpmnJson: {} }],
      };
      mockDefinitionRepo.findOne.mockResolvedValue(canonicalDef);

      await expect(
        service.publishVersion('PURCHASE_REQUEST_WORKFLOW', 2),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
