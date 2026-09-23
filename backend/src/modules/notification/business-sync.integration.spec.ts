import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OutboxRelayService } from '../system/outbox-relay.service';
import { BusinessSyncConsumer } from './business-sync.consumer';
import { NotificationGateway } from './notification.gateway';
import { OutboxEvent, OutboxStatus } from '../../entities/outbox-event.entity';

describe('Phase G Runtime Integration: Relay → Real EventEmitter2 → Real BusinessSyncConsumer', () => {
  let relayService: OutboxRelayService;
  let consumer: BusinessSyncConsumer;
  let eventEmitter: EventEmitter2;
  let mockGateway: Partial<NotificationGateway>;
  let capturedRooms: string[][];
  let capturedEnvelopes: any[];
  let savedEntities: OutboxEvent[];
  let queryRunner: any;

  beforeEach(async () => {
    capturedRooms = [];
    capturedEnvelopes = [];
    savedEntities = [];

    mockGateway = {
      sendSyncEventToRooms: jest.fn((rooms: string[], envelope: any) => {
        capturedRooms.push(rooms);
        capturedEnvelopes.push(envelope);
      }),
    };

    // Real EventEmitter2 instance
    eventEmitter = new EventEmitter2();

    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn(),
        save: jest.fn().mockImplementation((entityClass, entity) => {
          savedEntities.push({ ...entity });
          return Promise.resolve(entity);
        }),
      },
    };

    const dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    const outboxRepo = {
      find: jest.fn(),
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxRelayService,
        BusinessSyncConsumer,
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
        {
          provide: NotificationGateway,
          useValue: mockGateway,
        },
      ],
    }).compile();

    relayService = module.get<OutboxRelayService>(OutboxRelayService);
    consumer = module.get<BusinessSyncConsumer>(BusinessSyncConsumer);

    // Register all 15 real consumer listeners on the real EventEmitter2
    eventEmitter.on('workflow.task.assigned', (e) => consumer.handleWorkflowTaskAssigned(e));
    eventEmitter.on('workflow.task.completed', (e) => consumer.handleWorkflowTaskCompleted(e));
    eventEmitter.on('workflow.task.returned', (e) => consumer.handleWorkflowTaskReturned(e));
    eventEmitter.on('workflow.instance.completed', (e) => consumer.handleWorkflowInstanceCompleted(e));
    eventEmitter.on('project.pm.assigned', (e) => consumer.handleProjectPmAssigned(e));
    eventEmitter.on('project.kickoff.executed', (e) => consumer.handleProjectKickoffExecuted(e));
    eventEmitter.on('procurement.package.submitted', (e) => consumer.handleProcurementPackageSubmitted(e));
    eventEmitter.on('procurement.package.returned', (e) => consumer.handleProcurementPackageReturned(e));
    eventEmitter.on('procurement.rfq.created', (e) => consumer.handleProcurementRfqCreated(e));
    eventEmitter.on('procurement.po.issued', (e) => consumer.handleProcurementPoIssued(e));
    eventEmitter.on('procurement.gr.received', (e) => consumer.handleProcurementGrReceived(e));
    eventEmitter.on('finance.invoice.created', (e) => consumer.handleFinanceInvoiceCreated(e));
    eventEmitter.on('finance.invoice.verified', (e) => consumer.handleFinanceInvoiceVerified(e));
    eventEmitter.on('finance.invoice.rejected', (e) => consumer.handleFinanceInvoiceRejected(e));
    eventEmitter.on('finance.payment.recorded', (e) => consumer.handleFinancePaymentRecorded(e));
  });

  it('Scenario 1: Valid canonical event flows through Relay -> EventEmitter2 -> Consumer -> Gateway and transitions to PUBLISHED', async () => {
    const validOutbox = new OutboxEvent();
    validOutbox.id = 101;
    validOutbox.event_id = 'canonical-uuid-101';
    validOutbox.event_name = 'procurement.po.issued';
    validOutbox.event_version = '1';
    validOutbox.aggregate_type = 'PurchaseOrder';
    validOutbox.aggregate_id = 5001;
    validOutbox.status = OutboxStatus.PENDING;
    validOutbox.created_at = new Date('2026-09-23T15:00:00.000Z');
    validOutbox.payload = {
      businessPayload: {
        poNumber: 'PO-2026-001',
      },
    };

    queryRunner.manager.findOne.mockResolvedValue(validOutbox);

    const result = await relayService.relaySingleEvent(101);

    expect(result).toBe('SUCCESS');
    expect(queryRunner.commitTransaction).toHaveBeenCalled();

    // 1. Canonical event reaches consumer and emits to gateway
    expect(mockGateway.sendSyncEventToRooms).toHaveBeenCalledTimes(1);

    // 2. eventId preserved
    expect(capturedEnvelopes[0].eventId).toBe('canonical-uuid-101');
    expect(capturedEnvelopes[0].eventName).toBe('procurement.po.issued');
    expect(capturedEnvelopes[0].aggregateId).toBe(5001);

    // 3. Expected authorized rooms dispatched
    expect(capturedRooms[0]).toContain('role:PROCUREMENT');
    expect(capturedRooms[0]).toContain('role:PURCHASING');
    expect(capturedRooms[0]).toContain('role:FINANCE');
    expect(capturedRooms[0]).toContain('role:SUPER_ADMIN');

    // 4. Relay marks PUBLISHED
    const publishedSave = savedEntities.find((e) => e.status === OutboxStatus.PUBLISHED);
    expect(publishedSave).toBeDefined();
    expect(publishedSave?.status).toBe(OutboxStatus.PUBLISHED);

    // 5. published_at populated
    expect(publishedSave?.published_at).toBeInstanceOf(Date);
  });

  it('Scenario 2: Malformed canonical event -> Consumer throws synchronously -> Relay rolls back and increments retry_count without marking PUBLISHED', async () => {
    const malformedOutbox = new OutboxEvent();
    malformedOutbox.id = 102;
    malformedOutbox.event_id = ''; // Missing event_id makes it malformed
    malformedOutbox.event_name = 'finance.invoice.verified';
    malformedOutbox.event_version = '1';
    malformedOutbox.aggregate_type = 'Invoice';
    malformedOutbox.aggregate_id = 999;
    malformedOutbox.status = OutboxStatus.PENDING;
    malformedOutbox.retry_count = 0;
    malformedOutbox.payload = {};

    queryRunner.manager.findOne.mockResolvedValue(malformedOutbox);

    const result = await relayService.relaySingleEvent(102);

    expect(result).toBe('FAILED');
    expect(queryRunner.commitTransaction).toHaveBeenCalled(); // Transaction committed to save retry count and error

    // Consumer threw -> no gateway dispatch
    expect(mockGateway.sendSyncEventToRooms).not.toHaveBeenCalled();

    // NOT marked PUBLISHED
    const publishedSave = savedEntities.find((e) => e.status === OutboxStatus.PUBLISHED);
    expect(publishedSave).toBeUndefined();

    // Retry count incremented and error message recorded
    const failureSave = savedEntities.find((e) => e.retry_count === 1);
    expect(failureSave).toBeDefined();
    expect(failureSave?.status).toBe(OutboxStatus.PENDING); // Remains PENDING for retry
    expect(failureSave?.error_message).toContain('Missing or invalid \'eventId\'');
  });
});
