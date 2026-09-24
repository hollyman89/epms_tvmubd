import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowDefinitionService } from './workflow-definition.service';
import { WorkflowEngineService } from './workflow-engine.service';

describe('WorkflowController - RBAC Role Metadata Tests (P0-1)', () => {
  let controller: WorkflowController;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkflowController],
      providers: [
        {
          provide: WorkflowService,
          useValue: {
            getWorkflowVisualizerData: jest.fn(),
            rollbackWorkflow: jest.fn(),
            reassignTask: jest.fn(),
            adminOverrideApprove: jest.fn(),
          },
        },
        {
          provide: WorkflowDefinitionService,
          useValue: {
            createDefinition: jest.fn(),
            getDefinitions: jest.fn(),
            getDefinitionByKey: jest.fn(),
            createVersion: jest.fn(),
            getVersions: jest.fn(),
            getVersion: jest.fn(),
            publishVersion: jest.fn(),
            updateVersion: jest.fn(),
            deleteDefinition: jest.fn(),
            archiveDefinition: jest.fn(),
          },
        },
        {
          provide: WorkflowEngineService,
          useValue: {
            startInstance: jest.fn(),
            getInstance: jest.fn(),
            getTransitions: jest.fn(),
            getInstanceByEntity: jest.fn(),
            completeTask: jest.fn(),
            getMyTasks: jest.fn(),
          },
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<WorkflowController>(WorkflowController);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getDefinitions should require canonical PROCUREMENT and FINANCE roles and NO phantom roles', () => {
    const roles = reflector.get<string[]>('roles', controller.getDefinitions);
    expect(roles).toBeDefined();
    expect(roles).toContain('PROCUREMENT');
    expect(roles).toContain('FINANCE');
    expect(roles).not.toContain('PROCUREMENT_MANAGER');
    expect(roles).not.toContain('FINANCE_MANAGER');
  });

  it('getDefinitionByKey should require canonical PROCUREMENT and FINANCE roles and NO phantom roles', () => {
    const roles = reflector.get<string[]>('roles', controller.getDefinitionByKey);
    expect(roles).toBeDefined();
    expect(roles).toContain('PROCUREMENT');
    expect(roles).toContain('FINANCE');
    expect(roles).not.toContain('PROCUREMENT_MANAGER');
    expect(roles).not.toContain('FINANCE_MANAGER');
  });

  it('getVersions should require canonical PROCUREMENT and FINANCE roles and NO phantom roles', () => {
    const roles = reflector.get<string[]>('roles', controller.getVersions);
    expect(roles).toBeDefined();
    expect(roles).toContain('PROCUREMENT');
    expect(roles).toContain('FINANCE');
    expect(roles).not.toContain('PROCUREMENT_MANAGER');
    expect(roles).not.toContain('FINANCE_MANAGER');
  });

  it('getVersion should require canonical PROCUREMENT and FINANCE roles and NO phantom roles', () => {
    const roles = reflector.get<string[]>('roles', controller.getVersion);
    expect(roles).toBeDefined();
    expect(roles).toContain('PROCUREMENT');
    expect(roles).toContain('FINANCE');
    expect(roles).not.toContain('PROCUREMENT_MANAGER');
    expect(roles).not.toContain('FINANCE_MANAGER');
  });

  it('deleteDefinition should strictly require SUPER_ADMIN authority only', () => {
    const roles = reflector.get<string[]>('roles', controller.deleteDefinition);
    expect(roles).toBeDefined();
    expect(roles).toEqual(['SUPER_ADMIN']);
    expect(roles).not.toContain('HEAD_OF_OPERATIONS');
    expect(roles).not.toContain('PROJECT_MANAGER');
    expect(roles).not.toContain('PROCUREMENT');
    expect(roles).not.toContain('FINANCE');
  });

  it('archiveDefinition should strictly require SUPER_ADMIN authority only', () => {
    const roles = reflector.get<string[]>('roles', controller.archiveDefinition);
    expect(roles).toBeDefined();
    expect(roles).toEqual(['SUPER_ADMIN']);
    expect(roles).not.toContain('HEAD_OF_OPERATIONS');
    expect(roles).not.toContain('PROJECT_MANAGER');
    expect(roles).not.toContain('PROCUREMENT');
    expect(roles).not.toContain('FINANCE');
  });
});
