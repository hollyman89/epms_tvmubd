import { validate } from 'class-validator';
import { CreateWorkflowDefinitionDto } from './dto/workflow-definition.dto';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowInstance, WorkflowInstanceStatus } from '../../entities/workflow-instance.entity';
import { WorkflowTask } from '../../entities/workflow-task.entity';
import { Role } from '../../entities/role.entity';

describe('Workflow Marketing Capability & TaskKey Precedence', () => {
  describe('Domain DTO Validation', () => {
    it('should accept MARKETING domain in CreateWorkflowDefinitionDto', async () => {
      const dto = new CreateWorkflowDefinitionDto();
      dto.workflowKey = 'TENDER_GO_NOGO_WORKFLOW';
      dto.name = 'Tender Go/No-Go Approval Workflow';
      dto.domain = 'MARKETING';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should continue to accept existing canonical and standard domains', async () => {
      const domains = ['PROCUREMENT', 'FINANCE', 'PROJECT', 'LEGAL', 'GENERAL'];
      for (const domain of domains) {
        const dto = new CreateWorkflowDefinitionDto();
        dto.workflowKey = `WORKFLOW_${domain}`;
        dto.name = `Workflow for ${domain}`;
        dto.domain = domain;

        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('TaskKey Precedence and Role Resolution Runtime Contract', () => {
    let service: WorkflowEngineService;
    let mockEntityManager: any;
    let createdTasks: any[];

    beforeEach(() => {
      createdTasks = [];
      mockEntityManager = {
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
        findOne: jest.fn().mockImplementation((entityClass, options) => {
          if (entityClass === Role && options?.where?.name === 'DIRECTOR') {
            return Promise.resolve({ id: 5, name: 'DIRECTOR' });
          }
          if (entityClass === Role && options?.where?.name === 'PROJECT_MANAGER') {
            return Promise.resolve({ id: 2, name: 'PROJECT_MANAGER' });
          }
          return Promise.resolve(null);
        }),
        create: jest.fn().mockImplementation((entityClass, data) => {
          if (entityClass === WorkflowTask) {
            const task = { id: 101, ...data };
            createdTasks.push(task);
            return task;
          }
          return { ...data };
        }),
      };

      service = new WorkflowEngineService(
        {} as any, // definitionRepo
        {} as any, // versionRepo
        {} as any, // instanceRepo
        {} as any, // taskRepo
        {} as any, // transitionRepo
        {} as any, // roleRepo
        {} as any, // outboxRepo
        {} as any, // dataSource
        {} as any, // eventEmitter
      );

      // Mock saveOutboxEvent and syncBusinessEntity to avoid external side-effects
      (service as any).saveOutboxEvent = jest.fn().mockResolvedValue(undefined);
      (service as any).syncBusinessEntity = jest.fn().mockResolvedValue(undefined);
    });

    it('1. should use explicit taskKey when provided in BPMN node data (e.g. GO_NOGO_APPROVAL)', async () => {
      const instance = {
        id: 1,
        entityType: 'TENDER',
        entityId: 42,
        status: WorkflowInstanceStatus.IN_PROGRESS,
      } as WorkflowInstance;

      const targetNode = {
        id: 'node_random_123',
        type: 'customNode',
        data: {
          taskKey: 'GO_NOGO_APPROVAL',
          label: 'Go/No-Go Approval',
          assignedRole: 'DIRECTOR',
        },
      };

      const version = { id: 1 } as any;
      const graph = { nodes: [targetNode], edges: [] };

      await (service as any).progressToNode(
        mockEntityManager,
        instance,
        graph,
        null,
        targetNode,
        version,
        'AUTO',
        1,
      );

      expect(createdTasks.length).toBe(1);
      const created = createdTasks[0];
      expect(created.taskKey).toBe('GO_NOGO_APPROVAL');
      expect(created.assigneeRoleId).toBe(5); // DIRECTOR resolved from assignedRole
      expect(created.nodeId).toBe('node_random_123');
    });

    it('2. should fall back to label when taskKey is absent (backward compatibility for legacy workflows)', async () => {
      const instance = {
        id: 2,
        entityType: 'PROJECT',
        entityId: 10,
        status: WorkflowInstanceStatus.IN_PROGRESS,
      } as WorkflowInstance;

      const targetNode = {
        id: 'node_hops_review',
        type: 'customNode',
        data: {
          // No taskKey, only legacy label & role
          label: 'Head of Operations Review',
          role: 'PROJECT_MANAGER',
        },
      };

      const version = { id: 1 } as any;
      const graph = { nodes: [targetNode], edges: [] };

      await (service as any).progressToNode(
        mockEntityManager,
        instance,
        graph,
        null,
        targetNode,
        version,
        'AUTO',
        1,
      );

      expect(createdTasks.length).toBe(1);
      const created = createdTasks[0];
      expect(created.taskKey).toBe('Head of Operations Review');
      expect(created.assigneeRoleId).toBe(2);
    });

    it('3. should fall back to node.id when neither taskKey nor label is present', async () => {
      const instance = {
        id: 3,
        entityType: 'PURCHASE_REQUEST',
        entityId: 99,
        status: WorkflowInstanceStatus.IN_PROGRESS,
      } as WorkflowInstance;

      const targetNode = {
        id: 'node_raw_step',
        type: 'customNode',
        data: {},
      };

      const version = { id: 1 } as any;
      const graph = { nodes: [targetNode], edges: [] };

      await (service as any).progressToNode(
        mockEntityManager,
        instance,
        graph,
        null,
        targetNode,
        version,
        'AUTO',
        1,
      );

      expect(createdTasks.length).toBe(1);
      const created = createdTasks[0];
      expect(created.taskKey).toBe('node_raw_step');
    });
  });
});
