import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OutboxRelayService, OutboxDeliveryOutcome } from './outbox-relay.service';
import { OutboxEvent, OutboxStatus } from '../../entities/outbox-event.entity';
import {
  BusinessEvent,
  NotificationPolicy,
  OutboxPermanentFailureError,
  attachOutboxReceipt,
} from '../../shared/contracts/business-event.contract';
import { CanonicalNotificationWriter } from '../notification/canonical-notification.writer';
import { NotificationGateway } from '../notification/notification.gateway';
import { Notification } from '../../entities/notification.entity';
import { PushOutbox } from '../../entities/push-outbox.entity';

describe('OutboxRelayService', () => {
  let service: OutboxRelayService;
  let outboxRepo: any;
  let dataSource: any;
  let queryRunner: any;
  let eventEmitter: any;

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn(),
        create: jest.fn().mockImplementation((_entityClass, data) => data),
        save: jest.fn().mockImplementation((entityClass, entity) => Promise.resolve(entity)),
      },
    };

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    outboxRepo = {
      find: jest.fn(),
      count: jest.fn(),
    };

    eventEmitter = {
      emit: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxRelayService,
        {
          provide: getRepositoryToken(OutboxEvent),
          useValue: outboxRepo,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitter,
        },
      ],
    }).compile();

    service = module.get<OutboxRelayService>(OutboxRelayService);
  });

  describe('Scenario 1, 2, 3: Canonical Reconstruction & Invariant Preservation', () => {
    it('1. PENDING reconstructed correctly: unwraps businessPayload and extracts all envelope fields', () => {
      const outbox = new OutboxEvent();
      outbox.id = 1;
      outbox.event_id = 'test-uuid-1234';
      outbox.event_name = 'project.pm.assigned';
      outbox.event_version = '1.0';
      outbox.aggregate_type = 'Project';
      outbox.aggregate_id = 42;
      outbox.correlation_id = 'corr-99';
      outbox.created_at = new Date('2026-09-23T20:00:00.000Z');
      outbox.status = OutboxStatus.PENDING;
      outbox.payload = {
        occurredAt: '2026-09-23T20:00:00.000Z',
        projectId: 42,
        actor: { userId: 7 },
        routing: { userIds: [10], projectId: 42 },
        notificationPolicy: NotificationPolicy.SYNC_ONLY,
        businessPayload: {
          projectId: 42,
          projectCode: 'PRJ-001',
          projectManagerId: 10,
        },
      };

      const event = service.reconstructBusinessEvent(outbox);

      expect(event.aggregateType).toBe('Project');
      expect(event.aggregateId).toBe(42);
      expect(event.projectId).toBe(42);
      expect(event.actor).toEqual({ userId: 7 });
      expect(event.correlationId).toBe('corr-99');
      expect(event.routing).toEqual({ userIds: [10], projectId: 42 });
      expect(event.notificationPolicy).toBe(NotificationPolicy.SYNC_ONLY);
      // Envelope wrapper metadata is NOT leaked as BusinessEvent.payload
      expect(event.payload).toEqual({
        projectId: 42,
        projectCode: 'PRJ-001',
        projectManagerId: 10,
      });
    });

    it('2. canonical eventName preserved exactly', () => {
      const outbox = new OutboxEvent();
      outbox.id = 2;
      outbox.event_id = 'evt-abc-999';
      outbox.event_name = 'procurement.po.issued';
      outbox.event_version = '1';
      outbox.aggregate_type = 'PurchaseOrder';
      outbox.aggregate_id = 101;
      outbox.payload = { businessPayload: { poNumber: 'PO-2026-001' } };

      const event = service.reconstructBusinessEvent(outbox);
      expect(event.eventName).toBe('procurement.po.issued');
    });

    it('3. eventId preserved end-to-end (NO new UUID generated)', () => {
      const originalEventId = 'immutable-uuid-555';
      const outbox = new OutboxEvent();
      outbox.id = 3;
      outbox.event_id = originalEventId;
      outbox.event_name = 'finance.invoice.created';
      outbox.event_version = '1';
      outbox.aggregate_type = 'Invoice';
      outbox.aggregate_id = 202;
      outbox.payload = { businessPayload: { invoiceNumber: 'INV-001' } };

      const event = service.reconstructBusinessEvent(outbox);
      expect(event.eventId).toBe(originalEventId);
    });
  });

  describe('Scenario 4 & 5: Successful Publish Transition', () => {
    it('4. successful publish -> transitions status to PUBLISHED', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 10;
      outbox.event_id = 'uuid-success-1';
      outbox.event_name = 'procurement.gr.received';
      outbox.event_version = '1';
      outbox.aggregate_type = 'GoodsReceipt';
      outbox.aggregate_id = 301;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = 0;
      outbox.payload = { businessPayload: { grNumber: 'GR-001' } };

      queryRunner.manager.findOne.mockResolvedValue(outbox);

      const result = await service.relaySingleEvent(10);

      expect(result).toBe('SUCCESS');
      expect(eventEmitter.emit).toHaveBeenCalledWith('procurement.gr.received', expect.objectContaining({
        eventId: 'uuid-success-1',
        eventName: 'procurement.gr.received',
      }));
      expect(outbox.status).toBe(OutboxStatus.PUBLISHED);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('5. published_at populated after successful publish', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 11;
      outbox.event_id = 'uuid-success-2';
      outbox.event_name = 'finance.payment.recorded';
      outbox.event_version = '1';
      outbox.aggregate_type = 'Payment';
      outbox.aggregate_id = 401;
      outbox.status = OutboxStatus.PENDING;
      outbox.published_at = null as any;
      outbox.payload = { businessPayload: { paymentNumber: 'PAY-001' } };

      queryRunner.manager.findOne.mockResolvedValue(outbox);

      await service.relaySingleEvent(11);

      expect(outbox.published_at).toBeInstanceOf(Date);
      expect(outbox.error_message).toBeNull();
    });
  });

  describe('Scenario 6, 7, 8, 9, 10: Failure & Retry Semantics', () => {
    it('6. failed publish -> NOT marked PUBLISHED', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 20;
      outbox.event_id = 'uuid-fail-1';
      outbox.event_name = 'project.kickoff.executed';
      outbox.event_version = '1';
      outbox.aggregate_type = 'Project';
      outbox.aggregate_id = 55;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = 0;
      outbox.payload = { businessPayload: {} };

      queryRunner.manager.findOne.mockResolvedValue(outbox);
      eventEmitter.emit.mockImplementation(() => {
        throw new Error('Connection refused / internal listener crashed');
      });

      const result = await service.relaySingleEvent(20);

      expect(result).toBe('FAILED');
      expect(outbox.status).not.toBe(OutboxStatus.PUBLISHED);
      expect(outbox.status).toBe(OutboxStatus.PENDING);
    });

    it('7. retry_count increments on failure', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 21;
      outbox.event_id = 'uuid-fail-2';
      outbox.event_name = 'procurement.package.submitted';
      outbox.event_version = '1';
      outbox.aggregate_type = 'ProcurementPackage';
      outbox.aggregate_id = 77;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = 1;
      outbox.payload = { businessPayload: {} };

      queryRunner.manager.findOne.mockResolvedValue(outbox);
      eventEmitter.emit.mockImplementation(() => {
        throw new Error('Consumer timeout');
      });

      await service.relaySingleEvent(21);

      expect(outbox.retry_count).toBe(2);
    });

    it('8. error_message recorded on failure', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 22;
      outbox.event_id = 'uuid-fail-3';
      outbox.event_name = 'finance.invoice.rejected';
      outbox.event_version = '1';
      outbox.aggregate_type = 'Invoice';
      outbox.aggregate_id = 88;
      outbox.status = OutboxStatus.PENDING;
      outbox.error_message = null as any;
      outbox.payload = { businessPayload: {} };

      queryRunner.manager.findOne.mockResolvedValue(outbox);
      eventEmitter.emit.mockImplementation(() => {
        throw new Error('Deadlock in consumer handler');
      });

      await service.relaySingleEvent(22);

      expect(outbox.error_message).toContain('Deadlock in consumer handler');
    });

    it('9. failed event remains eligible for retry (status remains PENDING)', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 23;
      outbox.event_id = 'uuid-retry-1';
      outbox.event_name = 'finance.invoice.verified';
      outbox.event_version = '1';
      outbox.aggregate_type = 'Invoice';
      outbox.aggregate_id = 99;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = 3;
      outbox.payload = { businessPayload: {} };

      queryRunner.manager.findOne.mockResolvedValue(outbox);
      eventEmitter.emit.mockImplementation(() => {
        throw new Error('Temporary glitch');
      });

      await service.relaySingleEvent(23);

      expect(outbox.status).toBe(OutboxStatus.PENDING);
    });

    it('10. no new eventId generated during retry; immutable eventId preserved', async () => {
      const immutableEventId = 'fixed-uuid-retry-10';
      const outbox = new OutboxEvent();
      outbox.id = 24;
      outbox.event_id = immutableEventId;
      outbox.event_name = 'procurement.package.returned';
      outbox.event_version = '1';
      outbox.aggregate_type = 'ProcurementPackage';
      outbox.aggregate_id = 12;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = 2;
      outbox.payload = { businessPayload: { reason: 'Missing doc' } };

      queryRunner.manager.findOne.mockResolvedValue(outbox);
      eventEmitter.emit.mockImplementation(() => {});

      await service.relaySingleEvent(24);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'procurement.package.returned',
        expect.objectContaining({ eventId: immutableEventId }),
      );
      expect(outbox.event_id).toBe(immutableEventId);
    });
  });

  describe('Scenario 11: Ignore already PUBLISHED events', () => {
    it('11. PUBLISHED rows are skipped and not re-emitted', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 30;
      outbox.event_id = 'uuid-published-already';
      outbox.event_name = 'procurement.rfq.created';
      outbox.status = OutboxStatus.PUBLISHED; // Already published concurrently

      queryRunner.manager.findOne.mockResolvedValue(outbox);

      const result = await service.relaySingleEvent(30);

      expect(result).toBe('SKIPPED');
      expect(eventEmitter.emit).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('Scenario 12: Bounded Batch and Concurrency Protection', () => {
    it('12. batch query is bounded by batchSize and ordered by id ASC', async () => {
      outboxRepo.find.mockResolvedValue([
        { id: 101 },
        { id: 102 },
      ]);

      const mockSingle = jest.spyOn(service, 'relaySingleEvent').mockResolvedValue('SUCCESS');

      const result = await service.processPendingEvents();

      expect(outboxRepo.find).toHaveBeenCalledWith({
        select: ['id'],
        where: { status: OutboxStatus.PENDING },
        order: { id: 'ASC' },
        take: service.batchSize,
      });

      expect(mockSingle).toHaveBeenCalledTimes(2);
      expect(mockSingle).toHaveBeenNthCalledWith(1, 101);
      expect(mockSingle).toHaveBeenNthCalledWith(2, 102);
      expect(result).toEqual({ processed: 2, succeeded: 2, failed: 0 });
    });

    it('13. poison event in batch does not prevent later events from being processed', async () => {
      outboxRepo.find.mockResolvedValue([
        { id: 201 },
        { id: 202 },
      ]);

      jest.spyOn(service, 'relaySingleEvent')
        .mockResolvedValueOnce('FAILED') // First event fails
        .mockResolvedValueOnce('SUCCESS'); // Second event succeeds

      const result = await service.processPendingEvents();

      expect(result).toEqual({ processed: 2, succeeded: 1, failed: 1 });
    });

    it('14. pollAndRelay reentrancy guard prevents concurrent execution on overlapping ticks', async () => {
      (service as any).isProcessing = true;

      const result = await service.pollAndRelay();

      expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
      expect(outboxRepo.find).not.toHaveBeenCalled();
    });

    it('15. zero EventEmitter listeners (NO_SUBSCRIBER) -> NOT marked PUBLISHED, quarantined as FAILED to prevent Head-of-Line Blocking', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 40;
      outbox.event_id = 'zero-listener-uuid-1';
      outbox.event_name = 'procurement.package.submitted';
      outbox.event_version = '1';
      outbox.aggregate_type = 'ProcurementPackage';
      outbox.aggregate_id = 999;
      outbox.status = OutboxStatus.PENDING;
      outbox.published_at = null as any;
      outbox.retry_count = 0;
      outbox.payload = { businessPayload: { packageNumber: 'PKG-001' } };

      queryRunner.manager.findOne.mockResolvedValue(outbox);
      // Simulate zero listeners registered for this canonical event
      eventEmitter.emit.mockReturnValue(false);

      const result = await service.relaySingleEvent(40);

      expect(result).toBe('FAILED');
      // Crucial: Must NOT be marked PUBLISHED, and MUST be quarantined as FAILED so it never blocks subsequent PENDING events
      expect(outbox.status).not.toBe(OutboxStatus.PUBLISHED);
      expect(outbox.status).toBe(OutboxStatus.FAILED);
      expect(outbox.published_at).toBeNull();
      expect(outbox.retry_count).toBe(1);
      expect(outbox.error_message).toContain('[NO_SUBSCRIBER]');
      // eventId is preserved intact
      expect(outbox.event_id).toBe('zero-listener-uuid-1');
      // Quarantine state is committed to DB so future batches do not re-fetch this row
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('16. CLM-01: canonical service claim events are successfully published when listeners exist', async () => {
      const claimEvents = [
        'procurement.service_claim.submitted',
        'procurement.service_claim.pm_verified',
        'procurement.service_claim.approved_for_invoice',
      ];

      for (let i = 0; i < claimEvents.length; i++) {
        const outbox = new OutboxEvent();
        outbox.id = 50 + i;
        outbox.event_id = `claim-event-uuid-${i + 1}`;
        outbox.event_name = claimEvents[i];
        outbox.event_version = '1';
        outbox.aggregate_type = 'ServiceClaim';
        outbox.aggregate_id = 200 + i;
        outbox.status = OutboxStatus.PENDING;
        outbox.published_at = null as any;
        outbox.retry_count = 0;
        outbox.payload = { businessPayload: { claimNumber: `SC-00${i + 1}` } };

        queryRunner.manager.findOne.mockResolvedValue(outbox);
        eventEmitter.emit.mockReturnValue(true); // Listener accepted the event

        const result = await service.relaySingleEvent(50 + i);

        expect(result).toBe('SUCCESS');
        expect(outbox.status).toBe(OutboxStatus.PUBLISHED);
        expect(outbox.published_at).toBeInstanceOf(Date);
        expect(eventEmitter.emit).toHaveBeenCalledWith(
          claimEvents[i],
          expect.objectContaining({
            eventName: claimEvents[i],
            aggregateType: 'ServiceClaim',
            aggregateId: 200 + i,
          }),
        );
      }
    });
  });

  describe('F-CRIT-01: Outbox Reliability & Head-of-Line Blocking Remediation (14 Scenarios)', () => {
    it('17. PERMANENT_FAILURE transitions immediately to OutboxStatus.FAILED without repeated retries', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 60;
      outbox.event_id = 'perm-fail-uuid-60';
      outbox.event_name = 'legal.contract.rejected';
      outbox.event_version = '1';
      outbox.aggregate_type = 'Contract';
      outbox.aggregate_id = 600;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = 0;
      outbox.payload = { businessPayload: { contractId: 600 } };

      queryRunner.manager.findOne.mockResolvedValue(outbox);
      eventEmitter.emit.mockImplementation(() => {
        throw new OutboxPermanentFailureError('Schema contract violation: missing aggregate context');
      });

      const result = await service.relaySingleEvent(60);

      expect(result).toBe('FAILED');
      expect(outbox.status).toBe(OutboxStatus.FAILED);
      expect(outbox.retry_count).toBe(1);
      expect(outbox.published_at).toBeNull();
      expect(outbox.error_message).toContain('[PERMANENT_FAILURE]');
      expect(outbox.error_message).toContain('Schema contract violation');
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('18. RETRYABLE_FAILURE increments retry_count and transitions to terminal OutboxStatus.FAILED when maxRetries is reached', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 61;
      outbox.event_id = 'max-retry-uuid-61';
      outbox.event_name = 'project.issue.created';
      outbox.event_version = '1';
      outbox.aggregate_type = 'PROJECT_ISSUE';
      outbox.aggregate_id = 601;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = service.maxRetries - 1; // 4 of 5
      outbox.payload = { businessPayload: { issueId: 601 } };

      queryRunner.manager.findOne.mockResolvedValue(outbox);
      eventEmitter.emit.mockImplementation(() => {
        throw new Error('DB connection pool exhausted');
      });

      const result = await service.relaySingleEvent(61);

      expect(result).toBe('FAILED');
      expect(outbox.retry_count).toBe(service.maxRetries);
      expect(outbox.status).toBe(OutboxStatus.FAILED);
      expect(outbox.published_at).toBeNull();
      expect(outbox.error_message).toContain(`[MAX_RETRIES_EXCEEDED:${service.maxRetries}/${service.maxRetries}]`);
      expect(outbox.error_message).toContain('DB connection pool exhausted');
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('19. INTENTIONALLY_IGNORED consumer receipt marks event PUBLISHED cleanly without error', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 62;
      outbox.event_id = 'ignored-uuid-62';
      outbox.event_name = 'project.issue.started';
      outbox.event_version = '1';
      outbox.aggregate_type = 'PROJECT_ISSUE';
      outbox.aggregate_id = 602;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = 0;
      outbox.payload = { businessPayload: { issueId: 602 } };

      queryRunner.manager.findOne.mockResolvedValue(outbox);
      eventEmitter.emit.mockReturnValue(
        attachOutboxReceipt([], {
          __outboxContract: true,
          channel: 'CANONICAL_NOTIFICATION',
          outcome: OutboxDeliveryOutcome.INTENTIONALLY_IGNORED,
          reason: 'Routine issue status change is sync-only by policy',
        }),
      );

      const result = await service.relaySingleEvent(62);

      expect(result).toBe('SUCCESS');
      expect(outbox.status).toBe(OutboxStatus.PUBLISHED);
      expect(outbox.published_at).toBeInstanceOf(Date);
      expect(outbox.error_message).toBeNull();
    });

    it('20. BusinessSync-only receipt is REJECTED as NO_SUBSCRIBER when notificationPolicy is NOT SYNC_ONLY, but ACCEPTED when SYNC_ONLY', async () => {
      // Case A: notificationPolicy is NOTIFICATION_AND_SYNC (not SYNC_ONLY) -> rejected as NO_SUBSCRIBER
      const outboxNonSyncOnly = new OutboxEvent();
      outboxNonSyncOnly.id = 63;
      outboxNonSyncOnly.event_id = 'sync-only-mismatch-63';
      outboxNonSyncOnly.event_name = 'legal.contract.rejected';
      outboxNonSyncOnly.event_version = '1';
      outboxNonSyncOnly.aggregate_type = 'Contract';
      outboxNonSyncOnly.aggregate_id = 603;
      outboxNonSyncOnly.status = OutboxStatus.PENDING;
      outboxNonSyncOnly.retry_count = 0;
      outboxNonSyncOnly.payload = {
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        businessPayload: { contractId: 603 },
      };

      queryRunner.manager.findOne.mockResolvedValueOnce(outboxNonSyncOnly);
      eventEmitter.emit.mockReturnValueOnce([
        {
          __outboxContract: true,
          channel: 'BUSINESS_SYNC',
          outcome: OutboxDeliveryOutcome.DELIVERED,
          deliveredCount: 2,
        },
      ]);

      const resultA = await service.relaySingleEvent(63);
      expect(resultA).toBe('FAILED');
      expect(outboxNonSyncOnly.status).toBe(OutboxStatus.FAILED);
      expect(outboxNonSyncOnly.error_message).toContain('[NO_SUBSCRIBER]');
      expect(outboxNonSyncOnly.error_message).toContain('only handled by BusinessSyncConsumer');

      // Case B: notificationPolicy === SYNC_ONLY -> accepted as DELIVERED
      const outboxSyncOnly = new OutboxEvent();
      outboxSyncOnly.id = 64;
      outboxSyncOnly.event_id = 'sync-only-valid-64';
      outboxSyncOnly.event_name = 'workflow.task.completed';
      outboxSyncOnly.event_version = '1';
      outboxSyncOnly.aggregate_type = 'WORKFLOW_TASK';
      outboxSyncOnly.aggregate_id = 604;
      outboxSyncOnly.status = OutboxStatus.PENDING;
      outboxSyncOnly.retry_count = 0;
      outboxSyncOnly.payload = {
        notificationPolicy: NotificationPolicy.SYNC_ONLY,
        businessPayload: { taskId: 604 },
      };

      queryRunner.manager.findOne.mockResolvedValueOnce(outboxSyncOnly);
      eventEmitter.emit.mockReturnValueOnce([
        {
          __outboxContract: true,
          channel: 'BUSINESS_SYNC',
          outcome: OutboxDeliveryOutcome.DELIVERED,
          deliveredCount: 3,
        },
      ]);

      const resultB = await service.relaySingleEvent(64);
      expect(resultB).toBe('SUCCESS');
      expect(outboxSyncOnly.status).toBe(OutboxStatus.PUBLISHED);
      expect(outboxSyncOnly.published_at).toBeInstanceOf(Date);
    });

    it('21. 50 unknown/unregistered events at head of queue are quarantined as FAILED and DO NOT block valid event #51 (No Head-of-Line Blocking)', async () => {
      const simulatedTable: OutboxEvent[] = [];
      for (let i = 1; i <= 50; i++) {
        const orphan = new OutboxEvent();
        orphan.id = i;
        orphan.event_id = `orphan-evt-${i}`;
        orphan.event_name = `unknown.unregistered.event.${i}`;
        orphan.event_version = '1';
        orphan.aggregate_type = 'Unknown';
        orphan.aggregate_id = i;
        orphan.status = OutboxStatus.PENDING;
        orphan.retry_count = 0;
        orphan.payload = { businessPayload: {} };
        simulatedTable.push(orphan);
      }

      const validEvent = new OutboxEvent();
      validEvent.id = 51;
      validEvent.event_id = 'valid-evt-51';
      validEvent.event_name = 'legal.contract.rejected';
      validEvent.event_version = '1';
      validEvent.aggregate_type = 'Contract';
      validEvent.aggregate_id = 510;
      validEvent.status = OutboxStatus.PENDING;
      validEvent.retry_count = 0;
      validEvent.payload = { businessPayload: { contractId: 510 } };
      simulatedTable.push(validEvent);

      outboxRepo.find.mockImplementation(() => {
        return Promise.resolve(
          simulatedTable
            .filter((row) => row.status === OutboxStatus.PENDING)
            .sort((a, b) => a.id - b.id)
            .slice(0, service.batchSize)
            .map((row) => ({ id: row.id })),
        );
      });

      queryRunner.manager.findOne.mockImplementation((_cls: any, opts: any) => {
        const found = simulatedTable.find((r) => r.id === opts.where.id);
        return Promise.resolve(found || null);
      });

      eventEmitter.emit.mockImplementation((eventName: string) => {
        if (eventName === 'legal.contract.rejected') {
          return attachOutboxReceipt([{ status: 'CREATED', dedupeKey: 'k1' } as any], {
            __outboxContract: true,
            channel: 'CANONICAL_NOTIFICATION',
            outcome: OutboxDeliveryOutcome.DELIVERED,
            deliveredCount: 1,
          });
        }
        return false; // No subscriber for unknown events 1..50
      });

      // Tick 1: Processes events 1..50, quarantining all 50 as FAILED
      const tick1 = await service.processPendingEvents();
      expect(tick1).toEqual({ processed: 50, succeeded: 0, failed: 50 });
      expect(simulatedTable.slice(0, 50).every((r) => r.status === OutboxStatus.FAILED)).toBe(true);

      // Tick 2: Event #51 is immediately picked up and PUBLISHED (zero starvation!)
      const tick2 = await service.processPendingEvents();
      expect(tick2).toEqual({ processed: 1, succeeded: 1, failed: 0 });
      expect(validEvent.status).toBe(OutboxStatus.PUBLISHED);
      expect(validEvent.published_at).toBeInstanceOf(Date);
    });

    it('22. Retry idempotency: retrying an event does NOT duplicate Bell Notification or PushOutbox rows (dedupeKey preserved)', async () => {
      const savedNotifications: Notification[] = [];
      const savedPushOutbox: PushOutbox[] = [];

      const mockNotificationRepo: any = {
        save: jest.fn().mockImplementation(async (entity: Notification) => {
          const duplicate = savedNotifications.find(
            (n) => n.userId === entity.userId && n.dedupeKey && n.dedupeKey === entity.dedupeKey,
          );
          if (duplicate) {
            const err: any = new Error(`Duplicate entry '${entity.dedupeKey}' for key 'idx_notif_user_dedupe'`);
            err.code = 'ER_DUP_ENTRY';
            err.errno = 1062;
            throw err;
          }
          const saved = Object.assign(new Notification(), entity, { id: savedNotifications.length + 1 });
          savedNotifications.push(saved);
          return saved;
        }),
      };

      const mockPushOutboxRepo: any = {
        save: jest.fn().mockImplementation(async (entity: PushOutbox) => {
          const duplicate = savedPushOutbox.find((p) => p.dedupeKey && p.dedupeKey === entity.dedupeKey);
          if (duplicate) {
            const err: any = new Error(`Duplicate entry '${entity.dedupeKey}' for key 'uk_push_outbox_dedupe'`);
            err.code = 'ER_DUP_ENTRY';
            err.errno = 1062;
            throw err;
          }
          const saved = Object.assign(new PushOutbox(), entity, { id: savedPushOutbox.length + 1 });
          savedPushOutbox.push(saved);
          return saved;
        }),
      };

      const writer = new CanonicalNotificationWriter(
        mockNotificationRepo,
        { sendNotificationToUser: jest.fn() } as unknown as NotificationGateway,
        mockPushOutboxRepo,
      );

      const outbox = new OutboxEvent();
      outbox.id = 70;
      outbox.event_id = 'retry-idempotent-evt-70';
      outbox.event_name = 'legal.contract.rejected';
      outbox.event_version = '1';
      outbox.aggregate_type = 'Contract';
      outbox.aggregate_id = 700;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = 0;
      outbox.payload = { businessPayload: { contractId: 700 } };

      queryRunner.manager.findOne.mockResolvedValue(outbox);

      let attempt = 0;
      eventEmitter.emit.mockImplementation(async (_eventName: string, canonicalEvt: BusinessEvent) => {
        attempt++;
        // Persist Bell + PushOutbox via CanonicalNotificationWriter on every attempt
        const resList = await writer.persistBatch([
          {
            eventId: canonicalEvt.eventId,
            recipientId: 77,
            purpose: 'LEGAL_CONTRACT_REJECTED',
            title: 'Kontrak Ditolak Legal',
            message: 'Kontrak ditolak',
            type: 'ALERT',
            actionTarget: '/sales/tenders/700',
          },
        ]);

        if (attempt === 1) {
          // Simulate transient failure in another listener or post-step on attempt 1
          throw new Error('Transient downstream error after writer persist');
        }

        return attachOutboxReceipt(resList, {
          __outboxContract: true,
          channel: 'CANONICAL_NOTIFICATION',
          outcome: OutboxDeliveryOutcome.DELIVERED,
          deliveredCount: 1,
        });
      });

      // Attempt 1 fails transiently -> remains PENDING with retry_count = 1
      const firstRun = await service.relaySingleEvent(70);
      expect(firstRun).toBe('FAILED');
      expect(outbox.status).toBe(OutboxStatus.PENDING);
      expect(outbox.retry_count).toBe(1);
      expect(savedNotifications).toHaveLength(1);
      expect(savedPushOutbox).toHaveLength(1);

      // Attempt 2 succeeds -> transitions to PUBLISHED, ZERO duplicate Bell or PushOutbox rows!
      const secondRun = await service.relaySingleEvent(70);
      expect(secondRun).toBe('SUCCESS');
      expect(outbox.status).toBe(OutboxStatus.PUBLISHED);
      expect(savedNotifications).toHaveLength(1);
      expect(savedPushOutbox).toHaveLength(1);
      expect(savedNotifications[0].dedupeKey).toBe('retry-idempotent-evt-70:77:LEGAL_CONTRACT_REJECTED');
      expect(savedPushOutbox[0].dedupeKey).toBe('retry-idempotent-evt-70:77:LEGAL_CONTRACT_REJECTED:PUSH');
    });
  });

  describe('FASE 1.1-R1: Controlled Replay (PARTIAL-REC-01) & Receipt Hardening (PARTIAL-RCP-01)', () => {
    describe('PARTIAL-REC-01: requeueFailedEvent', () => {
      it('rejects with BadRequestException if id or operatorUserId is missing/invalid', async () => {
        await expect(service.requeueFailedEvent(0, 1)).rejects.toThrow('ID outbox event tidak valid');
        await expect(service.requeueFailedEvent(10, 0)).rejects.toThrow('ID operator tidak valid');
      });

      it('rejects with NotFoundException if outbox event does not exist', async () => {
        queryRunner.manager.findOne.mockResolvedValue(null);
        await expect(service.requeueFailedEvent(999, 1)).rejects.toThrow('tidak ditemukan');
      });

      it('rejects with ConflictException if outbox event is not in FAILED status (e.g. PUBLISHED or PENDING)', async () => {
        const outbox = new OutboxEvent();
        outbox.id = 55;
        outbox.status = OutboxStatus.PUBLISHED;
        queryRunner.manager.findOne.mockResolvedValue(outbox);

        await expect(service.requeueFailedEvent(55, 1)).rejects.toThrow('Hanya outbox event berstatus FAILED');
      });

      it('successfully requeues FAILED event to PENDING with retry_count=0, preserves error history, and writes AuditLog', async () => {
        const outbox = new OutboxEvent();
        outbox.id = 77;
        outbox.status = OutboxStatus.FAILED;
        outbox.retry_count = 5;
        outbox.error_message = '[MAX_RETRIES_EXCEEDED] Network timeout';

        queryRunner.manager.findOne.mockResolvedValue(outbox);
        let savedAudit: any = null;
        queryRunner.manager.create.mockImplementation((_entityClass: any, data: any) => {
          return data;
        });
        queryRunner.manager.save.mockImplementation((entityClassOrEntity: any, entity?: any) => {
          if (entity) {
            savedAudit = entity;
            return Promise.resolve(entity);
          }
          return Promise.resolve(entityClassOrEntity);
        });

        const result = await service.requeueFailedEvent(77, 999, 'Operator manual retry after bugfix');

        // Verifications
        expect(queryRunner.manager.findOne).toHaveBeenCalledWith(OutboxEvent, {
          where: { id: 77 },
          lock: { mode: 'pessimistic_write' },
        });
        expect(result.success).toBe(true);
        expect(outbox.status).toBe(OutboxStatus.PENDING);
        expect(outbox.retry_count).toBe(0);
        expect(outbox.error_message).toContain('REQUEUED at');
        expect(outbox.error_message).toContain('user:999');
        expect(outbox.error_message).toContain('reason: Operator manual retry after bugfix');
        expect(outbox.error_message).toContain('Previous error: [MAX_RETRIES_EXCEEDED] Network timeout');
        expect(queryRunner.commitTransaction).toHaveBeenCalled();
        expect(savedAudit).toBeDefined();
        expect(savedAudit.action).toBe('OUTBOX_EVENT_REQUEUED');
        expect(savedAudit.record_id).toBe(77);
        expect(savedAudit.created_by).toBe(999);
      });

      it('rejects with BadRequestException if event experienced [PERMANENT_FAILURE]', async () => {
        const outbox = new OutboxEvent();
        outbox.id = 88;
        outbox.status = OutboxStatus.FAILED;
        outbox.retry_count = 1;
        outbox.error_message = '[PERMANENT_FAILURE] Schema contract violation: missing aggregate context';
        queryRunner.manager.findOne.mockResolvedValue(outbox);

        await expect(service.requeueFailedEvent(88, 1)).rejects.toThrow(
          'mengalami PERMANENT_FAILURE',
        );
        expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      });

      it('rejects with BadRequestException if event experienced [NO_SUBSCRIBER]', async () => {
        const outbox = new OutboxEvent();
        outbox.id = 89;
        outbox.status = OutboxStatus.FAILED;
        outbox.retry_count = 1;
        outbox.error_message = '[NO_SUBSCRIBER] Zero canonical listeners accepted event';
        queryRunner.manager.findOne.mockResolvedValue(outbox);

        await expect(service.requeueFailedEvent(89, 1)).rejects.toThrow(
          'tidak memiliki listener terdaftar (NO_SUBSCRIBER)',
        );
        expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      });

      it('rolls back transaction atomically if saving Outbox fails (zero audit log created)', async () => {
        const outbox = new OutboxEvent();
        outbox.id = 90;
        outbox.status = OutboxStatus.FAILED;
        outbox.retry_count = 5;
        outbox.error_message = '[MAX_RETRIES_EXCEEDED] Network timeout';
        queryRunner.manager.findOne.mockResolvedValue(outbox);
        queryRunner.manager.save.mockRejectedValueOnce(new Error('DB write lock timeout'));

        await expect(service.requeueFailedEvent(90, 1)).rejects.toThrow('DB write lock timeout');
        expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
        expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      });

      it('rolls back transaction atomically if saving AuditLog fails (outbox remains FAILED)', async () => {
        const outbox = new OutboxEvent();
        outbox.id = 91;
        outbox.status = OutboxStatus.FAILED;
        outbox.retry_count = 5;
        outbox.error_message = '[MAX_RETRIES_EXCEEDED] Network timeout';
        queryRunner.manager.findOne.mockResolvedValue(outbox);
        queryRunner.manager.create.mockImplementation((_cls: any, data: any) => data);
        // Save outbox succeeds, save audit log fails
        queryRunner.manager.save
          .mockResolvedValueOnce(outbox)
          .mockRejectedValueOnce(new Error('Audit table disk full'));

        await expect(service.requeueFailedEvent(91, 1)).rejects.toThrow('Audit table disk full');
        expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
        expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      });

      it('prevents concurrent double replay by locking row with pessimistic_write and rejecting non-FAILED status', async () => {
        const outboxOp1 = new OutboxEvent();
        outboxOp1.id = 92;
        outboxOp1.status = OutboxStatus.FAILED;
        outboxOp1.retry_count = 5;
        outboxOp1.error_message = '[MAX_RETRIES_EXCEEDED] Network timeout';

        // Operator 1 reads FAILED and commits
        queryRunner.manager.findOne.mockResolvedValueOnce(outboxOp1);
        queryRunner.manager.save.mockImplementation((_cls: any, ent: any) => Promise.resolve(ent));
        const resOp1 = await service.requeueFailedEvent(92, 1);
        expect(resOp1.success).toBe(true);

        // Operator 2 reads row after Op 1 commit (status is now PENDING)
        const outboxOp2 = new OutboxEvent();
        outboxOp2.id = 92;
        outboxOp2.status = OutboxStatus.PENDING;
        queryRunner.manager.findOne.mockResolvedValueOnce(outboxOp2);

        await expect(service.requeueFailedEvent(92, 2)).rejects.toThrow(
          'Hanya outbox event berstatus FAILED',
        );
      });

      it('rejects with BadRequestException if event has unrecognized or invalid error prefix', async () => {
        const outbox = new OutboxEvent();
        outbox.id = 89;
        outbox.status = OutboxStatus.FAILED;
        outbox.retry_count = 5;
        outbox.error_message = 'Corrupted error string without recognized prefix';

        queryRunner.manager.findOne.mockResolvedValue(outbox);
        await expect(service.requeueFailedEvent(89, 1)).rejects.toThrow(
          'format error tidak dikenal',
        );
      });
    });

    describe('PARTIAL-RCP-01: Receipt Contract Hardening', () => {
      it('treats empty array without receipt metadata as NO_SUBSCRIBER (rejects false-positive delivery)', () => {
        const canonicalEvt: BusinessEvent = {
          eventId: 'evt-test-rcp-01',
          eventName: 'test.unknown.event',
          eventVersion: 1,
          occurredAt: new Date().toISOString(),
          aggregateType: 'Test',
          aggregateId: 1,
          payload: {},
        };

        // Simulated listener returns empty array [] without receipt
        const evalResult = (service as any).interpretListenerResults(canonicalEvt, [[]]);
        expect(evalResult.outcome).toBe(OutboxDeliveryOutcome.NO_SUBSCRIBER);
      });

      it('accepts array with attached receipt even if results are empty (INTENTIONALLY_IGNORED)', () => {
        const canonicalEvt: BusinessEvent = {
          eventId: 'evt-test-rcp-02',
          eventName: 'test.ignored.event',
          eventVersion: 1,
          occurredAt: new Date().toISOString(),
          aggregateType: 'Test',
          aggregateId: 1,
          payload: {},
        };

        const ignoredReceipt = attachOutboxReceipt([], {
          __outboxContract: true,
          channel: 'CANONICAL_NOTIFICATION',
          outcome: OutboxDeliveryOutcome.INTENTIONALLY_IGNORED,
          deliveredCount: 0,
          reason: 'Sync-only canonical policy',
        });

        const evalResult = (service as any).interpretListenerResults(canonicalEvt, [ignoredReceipt]);
        expect(evalResult.outcome).toBe(OutboxDeliveryOutcome.INTENTIONALLY_IGNORED);
      });

      it('rejects non-empty array without receipt metadata as NO_SUBSCRIBER (non-empty array does not prove canonical delivery)', () => {
        const canonicalEvt: BusinessEvent = {
          eventId: 'evt-test-rcp-03',
          eventName: 'test.legacy.event',
          eventVersion: 1,
          occurredAt: new Date().toISOString(),
          aggregateType: 'Test',
          aggregateId: 1,
          payload: {},
        };

        const evalResult = (service as any).interpretListenerResults(canonicalEvt, [[{ legacy: 'result' }]]);
        expect(evalResult.outcome).toBe(OutboxDeliveryOutcome.NO_SUBSCRIBER);
      });

      it('rejects non-array unrecognized object without receipt metadata as NO_SUBSCRIBER (no generic fallback)', () => {
        const canonicalEvt: BusinessEvent = {
          eventId: 'evt-test-rcp-04',
          eventName: 'test.unknown.event',
          eventVersion: 1,
          occurredAt: new Date().toISOString(),
          aggregateType: 'Test',
          aggregateId: 1,
          payload: {},
        };

        const result = (service as any).interpretListenerResults(canonicalEvt, { arbitraryKey: 123 });
        expect(result.outcome).toBe(OutboxDeliveryOutcome.NO_SUBSCRIBER);
        expect(result.reason).toContain('without outbox receipt contract');
      });
    });
  });
});
