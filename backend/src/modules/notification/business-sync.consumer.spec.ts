import { Test, TestingModule } from '@nestjs/testing';
import { BusinessSyncConsumer, BusinessSyncEnvelope } from './business-sync.consumer';
import { NotificationGateway } from './notification.gateway';
import { BusinessEvent } from '../../shared/contracts/business-event.contract';

describe('BusinessSyncConsumer (Phase G Canonical Sync)', () => {
  let consumer: BusinessSyncConsumer;
  let mockGateway: Partial<NotificationGateway>;
  let capturedRooms: string[][];
  let capturedEnvelopes: BusinessSyncEnvelope[];

  beforeEach(async () => {
    capturedRooms = [];
    capturedEnvelopes = [];

    mockGateway = {
      sendSyncEventToRooms: jest.fn((rooms: string[], envelope: BusinessSyncEnvelope) => {
        capturedRooms.push(rooms);
        capturedEnvelopes.push(envelope);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessSyncConsumer,
        {
          provide: NotificationGateway,
          useValue: mockGateway,
        },
      ],
    }).compile();

    consumer = module.get<BusinessSyncConsumer>(BusinessSyncConsumer);
  });

  const ALL_15_EVENTS = [
    { name: 'workflow.task.assigned', routing: { userIds: [10], roles: ['PM'] }, aggregateType: 'WORKFLOW_TASK', aggregateId: 101 },
    { name: 'workflow.task.completed', aggregateType: 'WORKFLOW_TASK', aggregateId: 102 },
    { name: 'workflow.task.returned', routing: { userIds: [12], roles: ['PM'] }, aggregateType: 'WORKFLOW_TASK', aggregateId: 103 },
    { name: 'workflow.instance.completed', aggregateType: 'WORKFLOW_INSTANCE', aggregateId: 201 },
    { name: 'project.pm.assigned', routing: { userIds: [5] }, aggregateType: 'Project', aggregateId: 301, projectId: 301 },
    { name: 'project.kickoff.executed', aggregateType: 'Project', aggregateId: 302, projectId: 302, payload: { managerId: 5 } },
    { name: 'procurement.package.submitted', aggregateType: 'ProcurementPackage', aggregateId: 401 },
    { name: 'procurement.package.returned', aggregateType: 'ProcurementPackage', aggregateId: 402 },
    { name: 'procurement.rfq.created', aggregateType: 'Rfq', aggregateId: 501 },
    { name: 'procurement.po.issued', aggregateType: 'PurchaseOrder', aggregateId: 601 },
    { name: 'procurement.gr.received', aggregateType: 'GoodsReceipt', aggregateId: 701 },
    { name: 'finance.invoice.created', aggregateType: 'Invoice', aggregateId: 801 },
    { name: 'finance.invoice.verified', aggregateType: 'Invoice', aggregateId: 802 },
    { name: 'finance.invoice.rejected', routing: { userIds: [9] }, aggregateType: 'Invoice', aggregateId: 803 },
    { name: 'finance.payment.recorded', aggregateType: 'Payment', aggregateId: 901 },
  ];

  it('1. each registered canonical event reaches BusinessSyncConsumer', () => {
    for (const evt of ALL_15_EVENTS) {
      const canonicalEvent: BusinessEvent = {
        eventId: `evt-${evt.name}`,
        eventName: evt.name,
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: evt.aggregateType,
        aggregateId: evt.aggregateId,
        projectId: (evt as any).projectId,
        routing: evt.routing,
        payload: (evt as any).payload || {},
      };

      consumer.processCanonicalSync(canonicalEvent, evt.name);
    }

    expect(capturedRooms.length).toBe(15);
    expect(capturedEnvelopes.length).toBe(15);
  });

  it('2. eventId preserved end-to-end', () => {
    const canonicalEvent: BusinessEvent = {
      eventId: 'unique-uuid-999-canonical',
      eventName: 'procurement.po.issued',
      eventVersion: 1,
      occurredAt: '2026-09-23T12:00:00.000Z',
      aggregateType: 'PurchaseOrder',
      aggregateId: 601,
      payload: {},
    };

    consumer.handleProcurementPoIssued(canonicalEvent);

    expect(capturedEnvelopes[0].eventId).toBe('unique-uuid-999-canonical');
  });

  it('3. eventName preserved exactly', () => {
    const canonicalEvent: BusinessEvent = {
      eventId: 'evt-1',
      eventName: 'finance.invoice.verified',
      eventVersion: 1,
      occurredAt: '2026-09-23T12:00:00.000Z',
      aggregateType: 'Invoice',
      aggregateId: 802,
      payload: {},
    };

    consumer.handleFinanceInvoiceVerified(canonicalEvent);

    expect(capturedEnvelopes[0].eventName).toBe('finance.invoice.verified');
  });

  it('4. direct user room routing (preserves producer routing)', () => {
    const canonicalEvent: BusinessEvent = {
      eventId: 'evt-pm-assign',
      eventName: 'project.pm.assigned',
      eventVersion: 1,
      occurredAt: '2026-09-23T12:00:00.000Z',
      aggregateType: 'Project',
      aggregateId: 301,
      projectId: 301,
      routing: { userIds: [42] },
      payload: {},
    };

    consumer.handleProjectPmAssigned(canonicalEvent);

    const rooms = capturedRooms[0];
    expect(rooms).toContain('user:42');
  });

  it('5. role room routing (approved sync audience policy)', () => {
    const canonicalEvent: BusinessEvent = {
      eventId: 'evt-po',
      eventName: 'procurement.po.issued',
      eventVersion: 1,
      occurredAt: '2026-09-23T12:00:00.000Z',
      aggregateType: 'PurchaseOrder',
      aggregateId: 601,
      payload: {},
    };

    consumer.handleProcurementPoIssued(canonicalEvent);

    const rooms = capturedRooms[0];
    expect(rooms).toContain('role:PROCUREMENT');
    expect(rooms).toContain('role:PURCHASING');
    expect(rooms).toContain('role:FINANCE');
    expect(rooms).toContain('role:SUPER_ADMIN');
  });

  it('6. no global broadcast (only explicit user/role rooms targeted)', () => {
    const canonicalEvent: BusinessEvent = {
      eventId: 'evt-gr',
      eventName: 'procurement.gr.received',
      eventVersion: 1,
      occurredAt: '2026-09-23T12:00:00.000Z',
      aggregateType: 'GoodsReceipt',
      aggregateId: 701,
      payload: {},
    };

    consumer.handleProcurementGrReceived(canonicalEvent);

    expect(mockGateway.sendSyncEventToRooms).toHaveBeenCalledTimes(1);
    const rooms = capturedRooms[0];
    for (const r of rooms) {
      expect(r.startsWith('user:') || r.startsWith('role:')).toBe(true);
    }
  });

  it('7. malformed canonical event throws synchronously', () => {
    expect(() => {
      consumer.processCanonicalSync(null as any, 'procurement.po.issued');
    }).toThrow(/Malformed canonical event/);

    expect(() => {
      consumer.processCanonicalSync({ eventName: 'procurement.po.issued' } as any, 'procurement.po.issued');
    }).toThrow(/Missing or invalid 'eventId'/);

    expect(() => {
      consumer.processCanonicalSync(
        { eventId: '123', eventName: 'wrong.event', eventVersion: 1, occurredAt: 'now', aggregateType: 'PO', aggregateId: 1 } as any,
        'procurement.po.issued',
      );
    }).toThrow(/Event name mismatch/);

    expect(() => {
      consumer.processCanonicalSync(
        { eventId: '123', eventName: 'procurement.po.issued', eventVersion: 1, occurredAt: 'now', aggregateType: 'PO' } as any,
        'procurement.po.issued',
      );
    }).toThrow(/Missing or invalid 'aggregateId'/);
  });

  it('8. known canonical event missing policy throws synchronously', () => {
    const unconfiguredEvent: BusinessEvent = {
      eventId: 'evt-unconfigured',
      eventName: 'unconfigured.event.name' as any,
      eventVersion: 1,
      occurredAt: '2026-09-23T12:00:00.000Z',
      aggregateType: 'Unknown',
      aggregateId: 1,
      payload: {},
    };

    expect(() => {
      consumer.processCanonicalSync(unconfiguredEvent, 'unconfigured.event.name');
    }).toThrow(/No approved sync-audience policy/);
  });

  it('9. offline/no connected sockets does NOT cause consumer failure', () => {
    // Gateway sendSyncEventToRooms returns void even if 0 sockets are connected
    const canonicalEvent: BusinessEvent = {
      eventId: 'evt-kickoff',
      eventName: 'project.kickoff.executed',
      eventVersion: 1,
      occurredAt: '2026-09-23T12:00:00.000Z',
      aggregateType: 'Project',
      aggregateId: 302,
      projectId: 302,
      payload: { managerId: 8 },
    };

    expect(() => {
      consumer.handleProjectKickoffExecuted(canonicalEvent);
    }).not.toThrow();

    expect(capturedRooms[0]).toContain('user:8');
    expect(capturedRooms[0]).toContain('role:PMO');
  });

  it('10. internal sensitive payload not forwarded', () => {
    const canonicalEvent: BusinessEvent = {
      eventId: 'evt-inv',
      eventName: 'finance.invoice.created',
      eventVersion: 1,
      occurredAt: '2026-09-23T12:00:00.000Z',
      aggregateType: 'Invoice',
      aggregateId: 801,
      actor: { userId: 99, roles: ['INTERNAL_ROLE'] },
      routing: { userIds: [99], roles: ['ADMIN'] },
      notificationPolicy: undefined,
      payload: {
        sensitiveContractPrice: 999999999,
        internalTaxSecret: 'ABC-SECRET',
      },
    };

    consumer.handleFinanceInvoiceCreated(canonicalEvent);

    const envelope = capturedEnvelopes[0];
    expect((envelope as any).actor).toBeUndefined();
    expect((envelope as any).routing).toBeUndefined();
    expect((envelope as any).notificationPolicy).toBeUndefined();
    expect((envelope as any).payload).toBeUndefined();
    expect((envelope as any).sensitiveContractPrice).toBeUndefined();
    expect(envelope.aggregateId).toBe(801); // Canonical type preserved
  });
});
