import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { NotificationGateway } from './notification.gateway';
import { CanonicalNotificationWriter } from './canonical-notification.writer';
import { CanonicalNotificationConsumer } from './canonical-notification.consumer';
import { BusinessEvent } from '../../shared/contracts/business-event.contract';

describe('Phase N3: Marketing Canonical Bell Projection & Decoupling', () => {
  let consumer: CanonicalNotificationConsumer;
  let writer: CanonicalNotificationWriter;
  let mockNotificationRepo: jest.Mocked<Partial<Repository<Notification>>>;
  let mockGateway: jest.Mocked<Partial<NotificationGateway>>;
  let mockEmailQueue: { add: jest.Mock };
  let inMemoryNotifications: Notification[];
  let socketPushes: Array<{ userId: number; notification: any }>;

  beforeEach(async () => {
    inMemoryNotifications = [];
    socketPushes = [];
    mockEmailQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    mockNotificationRepo = {
      save: jest.fn().mockImplementation(async (entity: Notification) => {
        const duplicate = inMemoryNotifications.find(
          (n) => n.userId === entity.userId && n.dedupeKey && n.dedupeKey === entity.dedupeKey,
        );
        if (duplicate) {
          const err: any = new Error(
            `Duplicate entry '${entity.dedupeKey}' for key 'idx_notif_user_dedupe'`,
          );
          err.code = 'ER_DUP_ENTRY';
          err.errno = 1062;
          throw err;
        }

        const saved = Object.assign(new Notification(), entity, {
          id: inMemoryNotifications.length + 1,
        });
        inMemoryNotifications.push(saved);
        return saved;
      }),
      find: jest.fn().mockImplementation(async () => inMemoryNotifications),
      count: jest.fn().mockImplementation(async () => inMemoryNotifications.length),
    };

    mockGateway = {
      sendNotificationToUser: jest.fn().mockImplementation((userId: number, notif: any) => {
        socketPushes.push({ userId, notification: notif });
      }),
      sendSyncEventToRooms: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanonicalNotificationWriter,
        CanonicalNotificationConsumer,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepo,
        },
        {
          provide: NotificationGateway,
          useValue: mockGateway,
        },
        {
          provide: getQueueToken('email-send'),
          useValue: mockEmailQueue,
        },
      ],
    }).compile();

    writer = module.get<CanonicalNotificationWriter>(CanonicalNotificationWriter);
    consumer = module.get<CanonicalNotificationConsumer>(CanonicalNotificationConsumer);
  });

  it('1. marketing.tender.won canonical event creates exactly 1 Bell for Marketing PIC', async () => {
    const canonicalWonEvent: BusinessEvent<{
      tenderId: number;
      title: string;
      customerName: string;
      marketingPicId: number;
    }> = {
      eventId: 'evt-won-canonical-001',
      eventName: 'marketing.tender.won',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateType: 'Tender',
      aggregateId: 101,
      actor: { userId: 5 }, // Actor who marked it WON (e.g. Director or Admin)
      routing: {
        userIds: [25], // Marketing PIC
      },
      payload: {
        tenderId: 101,
        title: 'Project Pengadaan Fiber Optik',
        customerName: 'PT Telco Jaya',
        marketingPicId: 25,
      },
    };

    const results = await consumer.handleMarketingTenderWon(canonicalWonEvent);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('PERSISTED');
    expect(results[0].recipientId).toBe(25);
    expect(inMemoryNotifications).toHaveLength(1);
    expect(inMemoryNotifications[0].userId).toBe(25);
    expect(inMemoryNotifications[0].title).toBe('Tender Menang (WON)');
    expect(inMemoryNotifications[0].message).toContain('Project Pengadaan Fiber Optik');
    expect(inMemoryNotifications[0].actionLink).toBe('/sales');
    expect(inMemoryNotifications[0].dedupeKey).toBe('evt-won-canonical-001:25:MARKETING_TENDER_WON');

    // 1 socket emission
    expect(mockGateway.sendNotificationToUser).toHaveBeenCalledTimes(1);
    expect(mockGateway.sendNotificationToUser).toHaveBeenCalledWith(25, expect.any(Object));
  });

  it('2. marketing.tender.lost canonical event creates exactly 1 Bell for Marketing PIC', async () => {
    const canonicalLostEvent: BusinessEvent<{
      tenderId: number;
      title: string;
      customerName: string;
      marketingPicId: number;
    }> = {
      eventId: 'evt-lost-canonical-002',
      eventName: 'marketing.tender.lost',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateType: 'Tender',
      aggregateId: 102,
      actor: { userId: 25 },
      routing: {
        userIds: [25], // Marketing PIC
      },
      payload: {
        tenderId: 102,
        title: 'Project Data Center BSD',
        customerName: 'PT Mega Data',
        marketingPicId: 25,
      },
    };

    const results = await consumer.handleMarketingTenderLost(canonicalLostEvent);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('PERSISTED');
    expect(results[0].recipientId).toBe(25);
    expect(inMemoryNotifications).toHaveLength(1);
    expect(inMemoryNotifications[0].userId).toBe(25);
    expect(inMemoryNotifications[0].title).toBe('Tender Kalah (LOST)');
    expect(inMemoryNotifications[0].message).toContain('Project Data Center BSD');
    expect(inMemoryNotifications[0].actionLink).toBe('/sales');
    expect(inMemoryNotifications[0].dedupeKey).toBe('evt-lost-canonical-002:25:MARKETING_TENDER_LOST');

    expect(mockGateway.sendNotificationToUser).toHaveBeenCalledTimes(1);
    expect(mockGateway.sendNotificationToUser).toHaveBeenCalledWith(25, expect.any(Object));
  });

  it('3. Duplicate delivery of marketing.tender.won suppresses duplicate DB insert and WebSocket emit', async () => {
    const event: BusinessEvent = {
      eventId: 'evt-won-dup-test',
      eventName: 'marketing.tender.won',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateType: 'Tender',
      aggregateId: 103,
      routing: { userIds: [30] },
      payload: { title: 'Project Duplikasi Test' },
    };

    const res1 = await consumer.handleMarketingTenderWon(event);
    expect(res1[0].status).toBe('PERSISTED');
    expect(inMemoryNotifications).toHaveLength(1);
    expect(mockGateway.sendNotificationToUser).toHaveBeenCalledTimes(1);

    // Duplicate delivery (e.g. outbox retry)
    const res2 = await consumer.handleMarketingTenderWon(event);
    expect(res2[0].status).toBe('DUPLICATE_SUPPRESSED');
    expect(inMemoryNotifications).toHaveLength(1); // STILL 1
    expect(mockGateway.sendNotificationToUser).toHaveBeenCalledTimes(1); // STILL 1
    expect(mockEmailQueue.add).not.toHaveBeenCalled(); // 0 email
  });

  it('4. Unrelated directors/roles do NOT receive accidental Bell on marketing canonical event', async () => {
    const event: BusinessEvent = {
      eventId: 'evt-won-isolation',
      eventName: 'marketing.tender.won',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateType: 'Tender',
      aggregateId: 104,
      routing: { userIds: [25] }, // PIC only
      payload: { title: 'Tender A' },
    };

    await consumer.handleMarketingTenderWon(event);

    // Verify only user 25 received notification
    expect(inMemoryNotifications.every((n) => n.userId === 25)).toBe(true);
    expect(inMemoryNotifications.some((n) => n.userId === 1 || n.userId === 2)).toBe(false);
  });

  it('5. When tender has no Marketing PIC (empty routing), ZERO notifications are created', async () => {
    const event: BusinessEvent = {
      eventId: 'evt-won-no-pic',
      eventName: 'marketing.tender.won',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateType: 'Tender',
      aggregateId: 105,
      routing: {}, // Zero recipients
      payload: { title: 'Tender Tanpa PIC' },
    };

    const results = await consumer.handleMarketingTenderWon(event);

    expect(results).toHaveLength(0);
    expect(inMemoryNotifications).toHaveLength(0);
    expect(mockGateway.sendNotificationToUser).not.toHaveBeenCalled();
  });

  it('6. Non-canonical event without eventId is safely skipped without throwing', async () => {
    const legacyEvent: any = {
      tenderId: 106,
      title: 'Legacy Tender Event',
    };

    const wonResults = await consumer.handleMarketingTenderWon(legacyEvent);
    expect(wonResults).toEqual([]);
    expect(inMemoryNotifications).toHaveLength(0);

    const lostResults = await consumer.handleMarketingTenderLost(legacyEvent);
    expect(lostResults).toEqual([]);
    expect(inMemoryNotifications).toHaveLength(0);
  });

  it('7. ActionTarget is clean "/sales" without drawer query-string pollution', async () => {
    const event: BusinessEvent = {
      eventId: 'evt-target-check',
      eventName: 'marketing.tender.won',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateType: 'Tender',
      aggregateId: 107,
      routing: { userIds: [25] },
      payload: { title: 'Clean URL Test' },
    };

    await consumer.handleMarketingTenderWon(event);

    expect(inMemoryNotifications[0].actionLink).toBe('/sales');
    expect(inMemoryNotifications[0].actionLink).not.toContain('?');
  });
});
