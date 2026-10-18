import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OutboxRelayService } from './outbox-relay.service';
import { OutboxEvent, OutboxStatus } from '../../entities/outbox-event.entity';
import { BusinessEvent, NotificationPolicy } from '../../shared/contracts/business-event.contract';

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

    it('15. zero EventEmitter listeners -> NOT marked PUBLISHED, published_at remains null, same eventId retained', async () => {
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

      expect(result).toBe('SKIPPED');
      // Crucial: Must NOT be marked PUBLISHED
      expect(outbox.status).toBe(OutboxStatus.PENDING);
      expect(outbox.published_at).toBeNull();
      // eventId is preserved intact
      expect(outbox.event_id).toBe('zero-listener-uuid-1');
      // Transaction was rolled back, NOT committed
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
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
});
