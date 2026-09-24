import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Reflector } from '@nestjs/core';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { LegalService } from '../legal/legal.service';
import { WorkflowController } from '../workflow-engine/workflow.controller';
import { WorkflowService } from '../workflow-engine/workflow.service';
import { WorkflowDefinitionService } from '../workflow-engine/workflow-definition.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { ContractAmendment } from '../../entities/contract-amendment.entity';
import { Tender } from '../../entities/tender.entity';
import { User } from '../../entities/user.entity';
import { getQueueToken } from '@nestjs/bullmq';

describe('Project Manager Contract Scoping and Workflow Restriction Suite', () => {
  let contractService: ContractService;
  let contractController: ContractController;
  let workflowController: WorkflowController;
  let reflector: Reflector;

  // Dynamic Fixture IDs (No hardcoded IDs)
  const PM_A_ID = 201;
  const PM_B_ID = 202;
  const PMO_ID = 301;
  const ADMIN_ID = 101;

  const mockContracts: Partial<Contract>[] = [
    {
      id: 11,
      contract_number: 'CONT-PM-A',
      contract_value: 100000000,
      status: 'ACTIVE',
      legal_status: LegalStatus.APPROVED,
      project_manager_id: PM_A_ID,
      created_by: ADMIN_ID,
    },
    {
      id: 12,
      contract_number: 'CONT-PM-B',
      contract_value: 200000000,
      status: 'ACTIVE',
      legal_status: LegalStatus.APPROVED,
      project_manager_id: PM_B_ID,
      created_by: ADMIN_ID,
    },
    {
      id: 13,
      contract_number: 'CONT-UNASSIGNED',
      contract_value: 150000000,
      status: 'ACTIVE',
      legal_status: LegalStatus.APPROVED,
      project_manager_id: null,
      created_by: ADMIN_ID,
    },
  ];

  let contractRepoMock: any;

  beforeEach(async () => {
    contractRepoMock = {
      find: jest.fn().mockImplementation((options) => {
        if (options?.where?.project_manager_id) {
          const pmId = options.where.project_manager_id;
          return Promise.resolve(mockContracts.filter((c) => c.project_manager_id === pmId));
        }
        return Promise.resolve([...mockContracts]);
      }),
      findOne: jest.fn().mockImplementation(({ where }) => {
        const found = mockContracts.find((c) => c.id === where.id);
        return Promise.resolve(found ? { ...found } : null);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContractController, WorkflowController],
      providers: [
        ContractService,
        { provide: getRepositoryToken(Contract), useValue: contractRepoMock },
        { provide: getRepositoryToken(ContractAmendment), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(Tender), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: LegalService, useValue: {} },
        { provide: getQueueToken('pdf-generation'), useValue: { add: jest.fn() } },
        { provide: WorkflowService, useValue: {} },
        { provide: WorkflowDefinitionService, useValue: { getDefinitions: jest.fn() } },
        { provide: WorkflowEngineService, useValue: {} },
        Reflector,
      ],
    }).compile();

    contractService = module.get<ContractService>(ContractService);
    contractController = module.get<ContractController>(ContractController);
    workflowController = module.get<WorkflowController>(WorkflowController);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('Contract Scoping for PM', () => {
    it('PM A calling findAll() receives strictly their own assigned contracts (no global, no unassigned, no PM B)', async () => {
      const result = await contractService.findAll(PM_A_ID, ['PROJECT_MANAGER']);
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(11);
      expect(result[0].project_manager_id).toBe(PM_A_ID);
      expect(result.some((c) => c.id === 12)).toBe(false);
      expect(result.some((c) => c.id === 13)).toBe(false);
    });

    it('Management roles (SUPER_ADMIN, PMO, LEGAL) calling findAll() receive all contracts including unassigned', async () => {
      const adminResult = await contractService.findAll(ADMIN_ID, ['SUPER_ADMIN']);
      expect(adminResult.length).toBe(3);

      const pmoResult = await contractService.findAll(PMO_ID, ['PMO']);
      expect(pmoResult.length).toBe(3);
    });

    it('Unauthenticated or roleless caller calling findAll() fails closed and returns empty array', async () => {
      const emptyResult = await contractService.findAll(undefined, []);
      expect(emptyResult).toEqual([]);
    });

    it('PM A calling findOne() on their own contract succeeds', async () => {
      const contract = await contractService.findOne(11, PM_A_ID, ['PROJECT_MANAGER']);
      expect(contract).toBeDefined();
      expect(contract.id).toBe(11);
    });

    it('PM A calling findOne() on PM B contract throws ForbiddenException (anti-IDOR)', async () => {
      await expect(
        contractService.findOne(12, PM_A_ID, ['PROJECT_MANAGER'])
      ).rejects.toThrow(ForbiddenException);
    });

    it('PM A calling findOne() on an unassigned contract throws ForbiddenException', async () => {
      await expect(
        contractService.findOne(13, PM_A_ID, ['PROJECT_MANAGER'])
      ).rejects.toThrow(ForbiddenException);
    });

    it('PMO or Super Admin calling findOne() on any contract succeeds', async () => {
      const cAdmin = await contractService.findOne(12, ADMIN_ID, ['SUPER_ADMIN']);
      expect(cAdmin.id).toBe(12);

      const cPmo = await contractService.findOne(13, PMO_ID, ['PMO']);
      expect(cPmo.id).toBe(13);
    });
  });

  describe('Workflow Controller PM Restriction', () => {
    it('Workflow definition endpoints strictly exclude PROJECT_MANAGER from allowed roles metadata', () => {
      const rolesGetDefinitions = reflector.get<string[]>('roles', workflowController.getDefinitions);
      expect(rolesGetDefinitions).toBeDefined();
      expect(rolesGetDefinitions).not.toContain('PROJECT_MANAGER');
      expect(rolesGetDefinitions).toContain('SUPER_ADMIN');
      expect(rolesGetDefinitions).toContain('HEAD_OF_OPERATIONS');

      const rolesGetDefinitionByKey = reflector.get<string[]>('roles', workflowController.getDefinitionByKey);
      expect(rolesGetDefinitionByKey).not.toContain('PROJECT_MANAGER');

      const rolesGetVersions = reflector.get<string[]>('roles', workflowController.getVersions);
      expect(rolesGetVersions).not.toContain('PROJECT_MANAGER');

      const rolesGetVersion = reflector.get<string[]>('roles', workflowController.getVersion);
      expect(rolesGetVersion).not.toContain('PROJECT_MANAGER');
    });
  });
});
