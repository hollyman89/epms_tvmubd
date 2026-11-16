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

  it('3. marketing.tender.director_escalation projects Bell to all active Directors with exact executive title & body', async () => {
    const event: BusinessEvent = {
      eventId: 'marketing-escalation:160:2026-10-19:cycle-0',
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
        daysPastDeadline: 3,
        inactivityReferenceDate: '2026-10-19',
      },
    };

    const results = await consumer.handleMarketingDirectorEscalation(event);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'PERSISTED')).toBe(true);
    expect(inMemoryNotifications).toHaveLength(2);
    expect(inMemoryNotifications.map((n) => n.userId).sort()).toEqual([1, 2]);
    expect(inMemoryNotifications[0].actionLink).toBe('/sales?tab=1&tenderId=160');
    // Requirement 1: Exact notification title
    expect(inMemoryNotifications[0].title).toBe('Perhatian: Tender Belum Mengalami Tindak Lanjut');
    // Requirement 2 & 3: Exact notification body with dynamic tender name, day values, and original PIC
    expect(inMemoryNotifications[0].message).toBe(
      'Tender "Tender Fiber Optik" belum memiliki pembaruan status maupun catatan tindak lanjut selama 3 hari kalender. Batas akhir pengajuan penawaran telah terlewati 3 hari. PIC Marketing: "Budi Marketing".',
    );
  });

  it('4. Duplicate director escalation for the same cycle is suppressed', async () => {
    const event: BusinessEvent = {
      eventId: 'marketing-escalation:160:2026-10-19:cycle-0',
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
        daysPastDeadline: 3,
      },
    };

    await consumer.handleMarketingDirectorEscalation(event);
    const retryResults = await consumer.handleMarketingDirectorEscalation(event);

    expect(retryResults[0].status).toBe('DUPLICATE_SUPPRESSED');
    expect(inMemoryNotifications).toHaveLength(1);
  });

  describe('Comprehensive Director Tender Escalation Notification Wording & PIC Attribution Verification', () => {
    it('Requirement 1 & 2: Exact notification title & body template with dynamic tender name and day values', async () => {
      const event: BusinessEvent = {
        eventId: 'marketing-escalation:301:2026-11-10:cycle-1',
        eventName: 'marketing.tender.director_escalation',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 301,
        routing: { userIds: [100] },
        payload: {
          tenderId: 301,
          title: 'Pengadaan CCTV & Access Door Bandara',
          picUserId: 15,
          picFullName: 'Lukas Kurniawan',
          calendarDaysInactive: 5,
          daysPastDeadline: 4,
        },
      };

      const results = await consumer.handleMarketingDirectorEscalation(event);
      expect(results[0].status).toBe('PERSISTED');

      const notif = inMemoryNotifications.find((n) => n.userId === 100);
      expect(notif).toBeDefined();
      expect(notif!.title).toBe('Perhatian: Tender Belum Mengalami Tindak Lanjut');
      expect(notif!.message).toBe(
        'Tender "Pengadaan CCTV & Access Door Bandara" belum memiliki pembaruan status maupun catatan tindak lanjut selama 5 hari kalender. Batas akhir pengajuan penawaran telah terlewati 4 hari. PIC Marketing: "Lukas Kurniawan".',
      );
    });

    it('Requirement 4: Last-updated-by user is never substituted for the original PIC', async () => {
      const event: BusinessEvent = {
        eventId: 'marketing-escalation:302:2026-11-10:cycle-0',
        eventName: 'marketing.tender.director_escalation',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 302,
        routing: { userIds: [100] },
        payload: {
          tenderId: 302,
          title: 'Pembangunan Menara BTS Palapa',
          picUserId: 15,
          picFullName: 'Lukas Kurniawan', // Original marketing PIC
          updatedBy: 'Admin Pengubah (SUPER_ADMIN)',
          updaterId: 999, // Another user who updated the tender
          calendarDaysInactive: 2,
          daysPastDeadline: 1,
        },
      };

      await consumer.handleMarketingDirectorEscalation(event);

      const notif = inMemoryNotifications.find((n) => n.userId === 100);
      expect(notif).toBeDefined();
      expect(notif!.message).toContain('PIC Marketing: "Lukas Kurniawan".');
      expect(notif!.message).not.toContain('Admin Pengubah');
      expect(notif!.message).not.toContain('999');
    });

    it('Requirement 5: Escalation-triggering user is never substituted for the original PIC', async () => {
      const event: BusinessEvent = {
        eventId: 'marketing-escalation:303:2026-11-10:cycle-0',
        eventName: 'marketing.tender.director_escalation',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 303,
        actor: { userId: 88, roles: ['DIRECTOR', 'GENERAL_MANAGER'] }, // Escalation triggerer
        routing: { userIds: [100] },
        payload: {
          tenderId: 303,
          title: 'Pengadaan Switch Core',
          picUserId: 22,
          picFullName: 'Rina Marketing',
          calendarDaysInactive: 3,
          daysPastDeadline: 2,
        },
      };

      await consumer.handleMarketingDirectorEscalation(event);

      const notif = inMemoryNotifications.find((n) => n.userId === 100);
      expect(notif).toBeDefined();
      expect(notif!.message).toContain('PIC Marketing: "Rina Marketing".');
      expect(notif!.message).not.toContain('88');
      expect(notif!.message).not.toContain('GENERAL_MANAGER');
    });

    it('Requirement 6: Missing or unidentifiable original PIC uses neutral fallback without quotes', async () => {
      // Test A: picFullName is undefined
      const eventWithoutPic: BusinessEvent = {
        eventId: 'marketing-escalation:304:2026-11-10:cycle-0',
        eventName: 'marketing.tender.director_escalation',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 304,
        routing: { userIds: [100] },
        payload: {
          tenderId: 304,
          title: 'Modernisasi Data Center',
          calendarDaysInactive: 4,
          daysPastDeadline: 2,
        },
      };

      await consumer.handleMarketingDirectorEscalation(eventWithoutPic);
      const notifA = inMemoryNotifications.find((n) => n.dedupeKey?.includes('304'));
      expect(notifA).toBeDefined();
      expect(notifA!.message).toBe(
        'Tender "Modernisasi Data Center" belum memiliki pembaruan status maupun catatan tindak lanjut selama 4 hari kalender. Batas akhir pengajuan penawaran telah terlewati 2 hari. PIC Marketing: Belum teridentifikasi.',
      );

      // Test B: picFullName is generic placeholder like 'Marketing PIC' or 'User #45'
      const eventWithPlaceholder: BusinessEvent = {
        eventId: 'marketing-escalation:305:2026-11-10:cycle-0',
        eventName: 'marketing.tender.director_escalation',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 305,
        routing: { userIds: [100] },
        payload: {
          tenderId: 305,
          title: 'Pengadaan Genset Cadangan',
          picFullName: 'User #45',
          calendarDaysInactive: 2,
          daysPastDeadline: 1,
        },
      };

      await consumer.handleMarketingDirectorEscalation(eventWithPlaceholder);
      const notifB = inMemoryNotifications.find((n) => n.dedupeKey?.includes('305'));
      expect(notifB).toBeDefined();
      expect(notifB!.message).toBe(
        'Tender "Pengadaan Genset Cadangan" belum memiliki pembaruan status maupun catatan tindak lanjut selama 2 hari kalender. Batas akhir pengajuan penawaran telah terlewati 1 hari. PIC Marketing: Belum teridentifikasi.',
      );
    });

    it('Requirement 7: Different tenders correctly display their respective original PICs', async () => {
      const eventTenderA: BusinessEvent = {
        eventId: 'marketing-escalation:306:2026-11-10:cycle-0',
        eventName: 'marketing.tender.director_escalation',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 306,
        routing: { userIds: [100] },
        payload: {
          tenderId: 306,
          title: 'Tender Fiber Optik Jalur Barat',
          picFullName: 'Siti Marketing',
          calendarDaysInactive: 3,
          daysPastDeadline: 2,
        },
      };

      const eventTenderB: BusinessEvent = {
        eventId: 'marketing-escalation:307:2026-11-10:cycle-0',
        eventName: 'marketing.tender.director_escalation',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 307,
        routing: { userIds: [100] },
        payload: {
          tenderId: 307,
          title: 'Tender Radio Link Jalur Timur',
          picFullName: 'Andi Sales',
          calendarDaysInactive: 6,
          daysPastDeadline: 5,
        },
      };

      await consumer.handleMarketingDirectorEscalation(eventTenderA);
      await consumer.handleMarketingDirectorEscalation(eventTenderB);

      const notifA = inMemoryNotifications.find((n) => n.dedupeKey?.includes('306'));
      const notifB = inMemoryNotifications.find((n) => n.dedupeKey?.includes('307'));

      expect(notifA!.message).toContain('Tender "Tender Fiber Optik Jalur Barat"');
      expect(notifA!.message).toContain('PIC Marketing: "Siti Marketing".');

      expect(notifB!.message).toContain('Tender "Tender Radio Link Jalur Timur"');
      expect(notifB!.message).toContain('PIC Marketing: "Andi Sales".');
    });

    it('Requirement 9: Director receives notification but no WorkflowTask/To-Do is created', async () => {
      const event: BusinessEvent = {
        eventId: 'marketing-escalation:308:2026-11-10:cycle-0',
        eventName: 'marketing.tender.director_escalation',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 308,
        routing: { userIds: [101] }, // Director user
        payload: {
          tenderId: 308,
          title: 'Proyek Relokasi Kabel Bawah Laut',
          picFullName: 'Dwi Ragil Pribadi',
          calendarDaysInactive: 2,
          daysPastDeadline: 1,
        },
      };

      const results = await consumer.handleMarketingDirectorEscalation(event);

      // Notification is projected strictly as an ALERT notification
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');

      const savedNotif = inMemoryNotifications.find((n) => n.userId === 101);
      expect(savedNotif).toBeDefined();
      expect(savedNotif!.notificationType).toBe('ALERT'); // Strictly informational ALERT, never TASK
      expect(savedNotif!.actionLink).toBe('/sales?tab=1&tenderId=308');
      // Purpose is informational MARKETING_DIRECTOR_ESCALATION
      expect(savedNotif!.dedupeKey).toContain('MARKETING_DIRECTOR_ESCALATION');
    });

    it('Requirement 10: Existing notification deduplication and delivery behavior remain intact', async () => {
      const event: BusinessEvent = {
        eventId: 'marketing-escalation:309:2026-11-10:cycle-0',
        eventName: 'marketing.tender.director_escalation',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 309,
        routing: { userIds: [102, 103] }, // Multiple Directors
        payload: {
          tenderId: 309,
          title: 'Pengadaan Server Cloud 2026',
          picFullName: 'Budi Marketing',
          calendarDaysInactive: 2,
          daysPastDeadline: 2,
        },
      };

      // First delivery: both directors receive notification
      const firstResults = await consumer.handleMarketingDirectorEscalation(event);
      expect(firstResults).toHaveLength(2);
      expect(firstResults.every((r) => r.status === 'PERSISTED')).toBe(true);

      // Sockets pushed to both directors
      expect(socketPushes.filter((s) => s.userId === 102 || s.userId === 103)).toHaveLength(2);

      // Second delivery with identical eventId: suppressed as DUPLICATE_SUPPRESSED
      const secondResults = await consumer.handleMarketingDirectorEscalation(event);
      expect(secondResults).toHaveLength(2);
      expect(secondResults.every((r) => r.status === 'DUPLICATE_SUPPRESSED')).toBe(true);

      // Database count remains 2 (no duplicate row added)
      const notifs309 = inMemoryNotifications.filter((n) => n.dedupeKey?.includes('309'));
      expect(notifs309).toHaveLength(2);
    });

    it('Requirement 3 & 4 (DB Fallback): Authoritative original prospect owner resolved from DB when payload omits it', async () => {
      const mockDataSource = {
        query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
          if (params[0] === 310) {
            return [
              {
                marketing_pic_id: 15,
                created_by: 12,
                pic_full_name: 'Lukas Kurniawan',
                creator_full_name: 'Budi Marketing',
              },
            ];
          }
          if (params[0] === 311) {
            // Null marketing_pic_id, falls back to creator
            return [
              {
                marketing_pic_id: null,
                created_by: 12,
                pic_full_name: null,
                creator_full_name: 'Budi Marketing',
              },
            ];
          }
          return [];
        }),
      } as any;

      const consumerWithDb = new CanonicalNotificationConsumer(writer, mockDataSource);

      // Event without picFullName in payload for Tender 310
      const event310: BusinessEvent = {
        eventId: 'marketing-escalation:310:2026-11-10:cycle-0',
        eventName: 'marketing.tender.director_escalation',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 310,
        routing: { userIds: [100] },
        payload: {
          tenderId: 310,
          title: 'Pengadaan Fiber Optik Segmen 2',
          calendarDaysInactive: 2,
          daysPastDeadline: 1,
        },
      };

      await consumerWithDb.handleMarketingDirectorEscalation(event310);
      const notif310 = inMemoryNotifications.find((n) => n.dedupeKey?.includes('310'));
      expect(notif310).toBeDefined();
      expect(notif310!.message).toContain('PIC Marketing: "Lukas Kurniawan".');

      // Event without picFullName in payload for Tender 311 (creator fallback)
      const event311: BusinessEvent = {
        eventId: 'marketing-escalation:311:2026-11-10:cycle-0',
        eventName: 'marketing.tender.director_escalation',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 311,
        routing: { userIds: [100] },
        payload: {
          tenderId: 311,
          title: 'Pengadaan DWDM Surabaya',
          calendarDaysInactive: 3,
          daysPastDeadline: 2,
        },
      };

      await consumerWithDb.handleMarketingDirectorEscalation(event311);
      const notif311 = inMemoryNotifications.find((n) => n.dedupeKey?.includes('311'));
      expect(notif311).toBeDefined();
      expect(notif311!.message).toContain('PIC Marketing: "Budi Marketing".');
    });
  });
});
