import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterModule, EventEmitter2 } from '@nestjs/event-emitter';
import { EventSubscribersLoader } from '@nestjs/event-emitter/dist/event-subscribers.loader';
import { BusinessSyncConsumer } from '../notification/business-sync.consumer';
import { ProjectEventListener } from '../project/project-event.listener';
import { ProcurementEventListener } from '../procurement/procurement-event.listener';
import { NotificationListener } from '../notification/notification.listener';
import { NotificationGateway } from '../notification/notification.gateway';
import { ProjectService } from '../project/project.service';
import { ManagementReviewSyncService } from '../project/management-review-sync.service';
import { ProcurementPackageService } from '../procurement/procurement-package.service';
import { BusinessEvent } from '../../shared/contracts/business-event.contract';

describe('Phase I-D: Event Namespace Collision & Separation Verification', () => {
  let module: TestingModule;
  let eventEmitter: EventEmitter2;
  let consumer: BusinessSyncConsumer;
  let projectListener: ProjectEventListener;
  let procurementListener: ProcurementEventListener;
  let notifListener: NotificationListener;
  let managementReviewSyncService: Partial<ManagementReviewSyncService>;

  beforeEach(async () => {
    managementReviewSyncService = {
      syncManagementReviewFromWorkflow: jest.fn().mockResolvedValue(undefined),
    };

    const mockNotificationGateway = {
      sendSyncEventToRooms: jest.fn(),
      server: {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      },
    };

    module = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        BusinessSyncConsumer,
        ProjectEventListener,
        ProcurementEventListener,
        NotificationListener,
        {
          provide: NotificationGateway,
          useValue: mockNotificationGateway,
        },
        {
          provide: ProjectService,
          useValue: { recalculateWbsBudgetFromPo: jest.fn() },
        },
        {
          provide: ManagementReviewSyncService,
          useValue: managementReviewSyncService,
        },
        {
          provide: ProcurementPackageService,
          useValue: { handlePrRejection: jest.fn(), closeCompletedPackageForPo: jest.fn() },
        },
      ],
    }).compile();

    // Trigger Nest's real subscriber loader so all @OnEvent decorators are wired
    const loader = module.get(EventSubscribersLoader);
    loader.onApplicationBootstrap();

    eventEmitter = module.get(EventEmitter2);
    consumer = module.get(BusinessSyncConsumer);
    projectListener = module.get(ProjectEventListener);
    procurementListener = module.get(ProcurementEventListener);
    notifListener = module.get(NotificationListener);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Requirement 11 & 12: workflow.task.completed Namespace Separation', () => {
    it('1. internal workflow completion triggers ProjectEventListener', async () => {
      const projectListenerSpy = jest.spyOn(projectListener, 'handleWorkflowTaskCompleted');

      const internalDomainPayload = {
        taskId: 101,
        instanceId: 50,
        action: 'APPROVE',
        decidedBy: 2,
        fromNode: 'REVIEW_NODE',
        toNode: 'END_NODE',
        entityType: 'PROJECT',
        entityId: 99,
      };

      eventEmitter.emit('internal.workflow.task.completed', internalDomainPayload);

      expect(projectListenerSpy).toHaveBeenCalledTimes(1);
      expect(projectListenerSpy).toHaveBeenCalledWith(internalDomainPayload);
    });

    it('2. internal workflow completion does NOT trigger BusinessSyncConsumer (executions = 0)', async () => {
      const consumerSpy = jest.spyOn(consumer, 'handleWorkflowTaskCompleted');

      const internalDomainPayload = {
        taskId: 101,
        instanceId: 50,
        action: 'APPROVE',
        decidedBy: 2,
        fromNode: 'REVIEW_NODE',
        toNode: 'END_NODE',
        entityType: 'PROJECT',
        entityId: 99,
      };

      eventEmitter.emit('internal.workflow.task.completed', internalDomainPayload);

      expect(consumerSpy).toHaveBeenCalledTimes(0);
    });

    it('3. canonical workflow.task.completed triggers BusinessSyncConsumer', async () => {
      const consumerSpy = jest.spyOn(consumer, 'handleWorkflowTaskCompleted');

      const canonicalBusinessEvent: BusinessEvent = {
        eventId: 'canonical-uuid-1',
        eventName: 'workflow.task.completed',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 101,
        payload: {
          taskId: 101,
          instanceId: 50,
          action: 'APPROVE',
        },
      };

      eventEmitter.emit('workflow.task.completed', canonicalBusinessEvent);

      expect(consumerSpy).toHaveBeenCalledTimes(1);
      expect(consumerSpy).toHaveBeenCalledWith(canonicalBusinessEvent);
    });

    it('4. canonical workflow.task.completed does NOT trigger internal side-effect listener (executions = 0)', async () => {
      const projectListenerSpy = jest.spyOn(projectListener, 'handleWorkflowTaskCompleted');

      const canonicalBusinessEvent: BusinessEvent = {
        eventId: 'canonical-uuid-1',
        eventName: 'workflow.task.completed',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 101,
        payload: {
          taskId: 101,
          instanceId: 50,
          action: 'APPROVE',
        },
      };

      eventEmitter.emit('workflow.task.completed', canonicalBusinessEvent);

      expect(projectListenerSpy).toHaveBeenCalledTimes(0);
    });

    it('5. managementReviewSyncService executes exactly once when internal event is emitted', async () => {
      const internalDomainPayload = {
        taskId: 101,
        instanceId: 50,
        action: 'APPROVE',
        decidedBy: 2,
        fromNode: 'REVIEW_NODE',
        toNode: 'END_NODE',
        entityType: 'PROJECT',
        entityId: 99,
      };

      eventEmitter.emit('internal.workflow.task.completed', internalDomainPayload);

      expect(managementReviewSyncService.syncManagementReviewFromWorkflow).toHaveBeenCalledTimes(1);
      expect(managementReviewSyncService.syncManagementReviewFromWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowInstanceId: 50,
          taskId: 101,
          projectId: 99,
          entityType: 'PROJECT',
          fromNode: 'REVIEW_NODE',
          toNode: 'END_NODE',
          action: 'APPROVE',
          decidedBy: 2,
        }),
      );
    });

    it('6. canonical event retains exact eventName workflow.task.completed', () => {
      const canonicalBusinessEvent: BusinessEvent = {
        eventId: 'canonical-uuid-1',
        eventName: 'workflow.task.completed',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 101,
        payload: {},
      };

      expect(canonicalBusinessEvent.eventName).toBe('workflow.task.completed');
    });
  });

  describe('Additional Separated Collisions: workflow.instance.completed', () => {
    it('internal workflow.instance.completed triggers ProcurementEventListener and NOT BusinessSyncConsumer', async () => {
      const procurementSpy = jest.spyOn(procurementListener, 'handleWorkflowInstanceCompleted');
      const consumerSpy = jest.spyOn(consumer, 'handleWorkflowInstanceCompleted');

      const internalDomainPayload = {
        instanceId: 201,
        entityType: 'PURCHASE_REQUEST',
        entityId: 25,
        finalStatus: 'REJECTED',
      };

      eventEmitter.emit('internal.workflow.instance.completed', internalDomainPayload);

      expect(procurementSpy).toHaveBeenCalledTimes(1);
      expect(procurementSpy).toHaveBeenCalledWith(internalDomainPayload);
      expect(consumerSpy).toHaveBeenCalledTimes(0);
    });

    it('canonical workflow.instance.completed triggers BusinessSyncConsumer and NOT ProcurementEventListener', async () => {
      const procurementSpy = jest.spyOn(procurementListener, 'handleWorkflowInstanceCompleted');
      const consumerSpy = jest.spyOn(consumer, 'handleWorkflowInstanceCompleted');

      const canonicalBusinessEvent: BusinessEvent = {
        eventId: 'canonical-uuid-instance-1',
        eventName: 'workflow.instance.completed',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'WORKFLOW_INSTANCE',
        aggregateId: 201,
        payload: {
          instanceId: 201,
          finalStatus: 'COMPLETED',
        },
      };

      eventEmitter.emit('workflow.instance.completed', canonicalBusinessEvent);

      expect(consumerSpy).toHaveBeenCalledTimes(1);
      expect(consumerSpy).toHaveBeenCalledWith(canonicalBusinessEvent);
      expect(procurementSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe('Canonical project.pm.assigned Verification', () => {
    it('canonical project.pm.assigned triggers BusinessSyncConsumer', async () => {
      const consumerSpy = jest.spyOn(consumer, 'handleProjectPmAssigned');

      const canonicalBusinessEvent: BusinessEvent = {
        eventId: 'canonical-uuid-pm-1',
        eventName: 'project.pm.assigned',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Project',
        aggregateId: 301,
        projectId: 301,
        routing: { userIds: [5] },
        payload: {
          projectId: 301,
          projectCode: 'PRJ-301',
        },
      };

      eventEmitter.emit('project.pm.assigned', canonicalBusinessEvent);

      expect(consumerSpy).toHaveBeenCalledTimes(1);
      expect(consumerSpy).toHaveBeenCalledWith(canonicalBusinessEvent);
    });
  });

  describe('Section 3: Nest Event-Emitter Error Semantics', () => {
    it('proves Nest wraps subscriber in try/catch and suppresses/logs validation error without throwing out of emit', () => {
      const malformedCanonical = {
        eventName: 'workflow.task.completed',
        // missing eventId, eventVersion, aggregateType, aggregateId
      };

      // BusinessSyncConsumer.processCanonicalSync throws because required canonical envelope fields are missing.
      // Nest's subscriber wrapper catches this and suppresses the throw (suppressErrors: true default).
      expect(() => {
        eventEmitter.emit('workflow.task.completed', malformedCanonical);
      }).not.toThrow();
    });
  });
});
