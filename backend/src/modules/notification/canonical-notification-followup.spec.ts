import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { NotificationGateway } from './notification.gateway';
import { CanonicalNotificationWriter } from './canonical-notification.writer';
import { CanonicalNotificationConsumer } from './canonical-notification.consumer';
import { BusinessEvent } from '../../shared/contracts/business-event.contract';

describe('Phase FOLLOWUP-P1: Marketing Follow-Up Reminder & Escalation Canonical Bell Projection', () => {
  let consumer: CanonicalNotificationConsumer;
  let writer: CanonicalNotificationWriter;
  let mockNotificationRepo: jest.Mocked<Partial<Repository<Notification>>>;
  let mockGateway: jest.Mocked<Partial<NotificationGateway>>;
  let inMemoryNotifications: Notification[];
  let socketPushes: Array<{ userId: number; notification: any }>;

  beforeEach(async () => {
    inMemoryNotifications = [];
    socketPushes = [];

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
          useValue: { add: jest.fn().mockResolvedValue({ id: 'job-1' }) },
        },
      ],
    }).compile();

    consumer = module.get<CanonicalNotificationConsumer>(CanonicalNotificationConsumer);
    writer = module.get<CanonicalNotificationWriter>(CanonicalNotificationWriter);
  });

  it('1. marketing.tender.followup_reminder projects exactly 1 Bell for Marketing PIC with canonical deep link', async () => {
    const event: BusinessEvent = {
      eventId: 'marketing-followup:160:12:2026-10-22',
      eventName: 'marketing.tender.followup_reminder',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateType: 'Tender',
      aggregateId: 160,
      routing: { userIds: [12] },
      payload: {
        tenderId: 160,
        title: 'Tender Fiber Optik',
        customerName: 'PT Telco Jaya',
        reason: 'Batas waktu pengajuan penawaran telah lewat 3 hari.',
        conditionType: 'OVERDUE',
      },
    };

    const results = await consumer.handleMarketingFollowUpReminder(event);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('PERSISTED');
    expect(inMemoryNotifications).toHaveLength(1);
    expect(inMemoryNotifications[0].userId).toBe(12);
    expect(inMemoryNotifications[0].actionLink).toBe('/sales?tab=1&tenderId=160');
    expect(inMemoryNotifications[0].title).toBe('Pengingat Tindak Lanjut: Tender Fiber Optik');
    expect(inMemoryNotifications[0].message).toContain('[PT Telco Jaya]');
    expect(inMemoryNotifications[0].dedupeKey).toBe(
      'marketing-followup:160:12:2026-10-22:12:MARKETING_FOLLOWUP_REMINDER',
    );
  });

  it('2. Duplicate delivery of marketing.tender.followup_reminder suppresses duplicate DB insert', async () => {
    const event: BusinessEvent = {
      eventId: 'marketing-followup:160:12:2026-10-22',
      eventName: 'marketing.tender.followup_reminder',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateType: 'Tender',
      aggregateId: 160,
      routing: { userIds: [12] },
      payload: {
        tenderId: 160,
        title: 'Tender Fiber Optik',
        customerName: 'PT Telco Jaya',
        reason: 'Batas waktu pengajuan penawaran telah lewat 3 hari.',
      },
    };

    const firstRun = await consumer.handleMarketingFollowUpReminder(event);
    expect(firstRun[0].status).toBe('PERSISTED');

    // Duplicate delivery
    const secondRun = await consumer.handleMarketingFollowUpReminder(event);
    expect(secondRun[0].status).toBe('DUPLICATE_SUPPRESSED');
    expect(inMemoryNotifications).toHaveLength(1); // Still exactly 1 row
  });

  it('3. marketing.tender.director_escalation projects Bell to all active Directors', async () => {
    const event: BusinessEvent = {
      eventId: 'marketing-escalation:160:2026-10-19',
      eventName: 'marketing.tender.director_escalation',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateType: 'Tender',
      aggregateId: 160,
      routing: { userIds: [1, 2] }, // Two active Directors
      payload: {
        tenderId: 160,
        title: 'Tender Fiber Optik',
        customerName: 'PT Telco Jaya',
        picUserId: 12,
        picFullName: 'Budi Marketing',
        reason: 'Batas waktu pengajuan penawaran telah lewat 3 hari.',
        calendarDaysInactive: 3,
        inactivityReferenceDate: '2026-10-19',
      },
    };

    const results = await consumer.handleMarketingDirectorEscalation(event);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'PERSISTED')).toBe(true);
    expect(inMemoryNotifications).toHaveLength(2);
    expect(inMemoryNotifications.map((n) => n.userId).sort()).toEqual([1, 2]);
    expect(inMemoryNotifications[0].actionLink).toBe('/sales?tab=1&tenderId=160');
    expect(inMemoryNotifications[0].title).toBe('Eskalasi Tender: Tidak Ada Kemajuan (3 Hari)');
    expect(inMemoryNotifications[0].message).toContain('Budi Marketing');
  });

  it('4. Duplicate director escalation for the same cycle is suppressed', async () => {
    const event: BusinessEvent = {
      eventId: 'marketing-escalation:160:2026-10-19',
      eventName: 'marketing.tender.director_escalation',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateType: 'Tender',
      aggregateId: 160,
      routing: { userIds: [1] },
      payload: {
        tenderId: 160,
        title: 'Tender Fiber Optik',
        picFullName: 'Budi Marketing',
        calendarDaysInactive: 3,
      },
    };

    await consumer.handleMarketingDirectorEscalation(event);
    const retryResults = await consumer.handleMarketingDirectorEscalation(event);

    expect(retryResults[0].status).toBe('DUPLICATE_SUPPRESSED');
    expect(inMemoryNotifications).toHaveLength(1);
  });
});
