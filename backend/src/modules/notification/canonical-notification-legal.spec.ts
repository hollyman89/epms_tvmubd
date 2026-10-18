import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource, Repository } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { NotificationGateway } from './notification.gateway';
import { CanonicalNotificationWriter } from './canonical-notification.writer';
import { CanonicalNotificationConsumer } from './canonical-notification.consumer';
import { BusinessEvent } from '../../shared/contracts/business-event.contract';

describe('Phase N4: Legal Canonical Bell Projection & Decoupling', () => {
  let consumer: CanonicalNotificationConsumer;
  let writer: CanonicalNotificationWriter;
  let mockNotificationRepo: jest.Mocked<Partial<Repository<Notification>>>;
  let mockGateway: jest.Mocked<Partial<NotificationGateway>>;
  let mockEmailQueue: { add: jest.Mock };
  let mockDataSource: any;
  let inMemoryNotifications: Notification[];
  let socketPushes: Array<{ userId: number; notification: any }>;

  // Mock users for role resolution:
  // PMO: userId 30, SUPER_ADMIN: userId 1, PROJECT_MANAGER: userId 40
  // LEGAL: userId 20, SUPER_ADMIN: userId 1
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

    mockDataSource = {
      query: jest.fn().mockImplementation(async (query: string, params: any[]) => {
        // Query for users with roles
        if (params && params.includes('PMO') && params.includes('SUPER_ADMIN')) {
          return [{ id: 30 }, { id: 1 }];
        }
        if (params && params.includes('PROJECT_MANAGER')) {
          return [{ id: 40 }];
        }
        if (params && params.includes('LEGAL') && params.includes('SUPER_ADMIN')) {
          return [{ id: 20 }, { id: 1 }];
        }
        return [];
      }),
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
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    consumer = module.get<CanonicalNotificationConsumer>(CanonicalNotificationConsumer);
    writer = module.get<CanonicalNotificationWriter>(CanonicalNotificationWriter);
  });

  describe('1. legal.contract.approved Canonical Event', () => {
    it('projects informational Bells to PMO & Marketing PIC, strictly isolating Project Managers', async () => {
      const event: BusinessEvent = {
        eventId: 'evt-legal-appr-001',
        eventName: 'legal.contract.approved',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Contract',
        aggregateId: 101,
        routing: { roles: ['PMO'], userIds: [25] },
        payload: {
          contractId: 101,
          contractNumber: 'CONT-2026-001',
          tenderId: 55,
          tenderTitle: 'Pengadaan Server DC',
          marketingPicId: 25,
          legalStatus: 'APPROVED',
          reviewerId: 99,
          timestamp: new Date().toISOString(),
        },
      };

      const results = await consumer.handleLegalContractApproved(event);

      expect(results.length).toBe(3); // PMO (30), SUPER_ADMIN (1), Marketing PIC (25)

      // Verify PMO and SUPER_ADMIN received PMO handover Bell
      const pmoNotif = inMemoryNotifications.find((n) => n.userId === 30);
      const adminNotif = inMemoryNotifications.find((n) => n.userId === 1);
      const mktNotif = inMemoryNotifications.find((n) => n.userId === 25);
      const pmNotif = inMemoryNotifications.find((n) => n.userId === 40);

      expect(pmoNotif).toBeDefined();
      expect(pmoNotif?.title).toBe('Kontrak Disetujui Legal — Siap Penugasan PM');
      expect(pmoNotif?.actionLink).toBe('/project-delivery');
      expect(pmoNotif?.notificationType).toBe('ALERT');
      expect(pmoNotif?.dedupeKey).toBe('evt-legal-appr-001:30:LEGAL_CONTRACT_APPROVED_PMO');

      expect(adminNotif).toBeDefined();
      expect(adminNotif?.dedupeKey).toBe('evt-legal-appr-001:1:LEGAL_CONTRACT_APPROVED_PMO');

      // Project Manager is strictly isolated (never receives legal approval notification)
      expect(pmNotif).toBeUndefined();

      // Marketing PIC received sales completion confirmation
      expect(mktNotif).toBeDefined();
      expect(mktNotif?.title).toBe('SPK Disetujui Legal');
      expect(mktNotif?.actionLink).toBe('/sales/tenders/55');
      expect(mktNotif?.dedupeKey).toBe('evt-legal-appr-001:25:LEGAL_CONTRACT_APPROVED_MARKETING');

      // No TASK Bell allowed (must be informational)
      expect(inMemoryNotifications.every((n) => n.notificationType !== 'TASK')).toBe(true);
    });

    it('suppresses duplicate DB write and WebSocket on retried legal.contract.approved event', async () => {
      const event: BusinessEvent = {
        eventId: 'evt-legal-appr-retry',
        eventName: 'legal.contract.approved',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Contract',
        aggregateId: 102,
        payload: {
          contractId: 102,
          tenderId: 56,
          tenderTitle: 'Pengadaan CCTV',
          marketingPicId: 25,
          legalStatus: 'APPROVED',
        },
      };

      // First delivery
      const res1 = await consumer.handleLegalContractApproved(event);
      expect(res1.every((r) => r.status === 'PERSISTED')).toBe(true);
      const initialNotifCount = inMemoryNotifications.length;
      const initialSocketCount = socketPushes.length;

      // Duplicate delivery (Outbox retry)
      const res2 = await consumer.handleLegalContractApproved(event);
      expect(res2.every((r) => r.status === 'DUPLICATE_SUPPRESSED')).toBe(true);
      expect(inMemoryNotifications.length).toBe(initialNotifCount);
      expect(socketPushes.length).toBe(initialSocketCount);
    });
  });

  describe('2. legal.contract.revision_requested Canonical Event', () => {
    it('projects informational Bell strictly to Marketing PIC with revision reason intact', async () => {
      const event: BusinessEvent = {
        eventId: 'evt-legal-rev-001',
        eventName: 'legal.contract.revision_requested',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Contract',
        aggregateId: 103,
        routing: { userIds: [25] },
        payload: {
          contractId: 103,
          tenderId: 57,
          tenderTitle: 'Pengadaan Network Switch',
          marketingPicId: 25,
          legalStatus: 'REVISION_REQUESTED',
          reason: 'Klausul garansi SLA wajib minimal 12 bulan.',
        },
      };

      const results = await consumer.handleLegalContractRevisionRequested(event);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');

      const notif = inMemoryNotifications[0];
      expect(notif.userId).toBe(25);
      expect(notif.title).toBe('Revisi Kontrak Diminta Legal');
      expect(notif.message).toContain('Klausul garansi SLA wajib minimal 12 bulan.');
      expect(notif.actionLink).toBe('/sales/tenders/57');
      expect(notif.dedupeKey).toBe('evt-legal-rev-001:25:LEGAL_CONTRACT_REVISION_REQUESTED');
      expect(notif.notificationType).not.toBe('TASK');
    });

    it('produces ZERO notifications if tender has no Marketing PIC (no semantic guessing)', async () => {
      const event: BusinessEvent = {
        eventId: 'evt-legal-rev-no-pic',
        eventName: 'legal.contract.revision_requested',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Contract',
        aggregateId: 104,
        payload: {
          contractId: 104,
          tenderId: 58,
          tenderTitle: 'Tender Tanpa PIC',
          marketingPicId: undefined, // Missing PIC
          reason: 'Perbaiki lampiran',
        },
      };

      const results = await consumer.handleLegalContractRevisionRequested(event);
      expect(results).toEqual([]);
      expect(inMemoryNotifications).toHaveLength(0);
      expect(socketPushes).toHaveLength(0);
    });

    it('suppresses duplicate DB write and WebSocket on retried legal.contract.revision_requested', async () => {
      const event: BusinessEvent = {
        eventId: 'evt-legal-rev-retry',
        eventName: 'legal.contract.revision_requested',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Contract',
        aggregateId: 105,
        payload: {
          contractId: 105,
          tenderId: 59,
          tenderTitle: 'Pengadaan Router',
          marketingPicId: 25,
          reason: 'Revisi termin pembayaran',
        },
      };

      const res1 = await consumer.handleLegalContractRevisionRequested(event);
      expect(res1[0].status).toBe('PERSISTED');
      expect(inMemoryNotifications).toHaveLength(1);

      const res2 = await consumer.handleLegalContractRevisionRequested(event);
      expect(res2[0].status).toBe('DUPLICATE_SUPPRESSED');
      expect(inMemoryNotifications).toHaveLength(1);
      expect(socketPushes).toHaveLength(1);
    });
  });

  describe('3. marketing.spk.uploaded Canonical Event (Handover to Legal)', () => {
    it('projects informational Bell to Legal reviewers for initial SPK upload', async () => {
      const event: BusinessEvent = {
        eventId: 'evt-spk-init-001',
        eventName: 'marketing.spk.uploaded',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Contract',
        aggregateId: 201,
        payload: {
          tenderId: 70,
          contractId: 201,
          title: 'Pengadaan Fiber Optic',
          isRevision: false,
          fileName: 'spk-fiber.pdf',
        },
      };

      const results = await consumer.handleMarketingSpkUploaded(event);
      expect(results.length).toBe(2); // Legal (20) & SuperAdmin (1)

      const legalNotif = inMemoryNotifications.find((n) => n.userId === 20);
      expect(legalNotif).toBeDefined();
      expect(legalNotif?.title).toBe('Draft Kontrak Baru Siap Direview');
      expect(legalNotif?.actionLink).toBe('/legal/review?tab=WAITING');
      expect(legalNotif?.dedupeKey).toBe('evt-spk-init-001:20:LEGAL_REVIEW_CONTRACT_SUBMITTED');
    });

    it('projects informational Bell to Legal reviewers with REVISION tab target for revised SPK upload', async () => {
      const event: BusinessEvent = {
        eventId: 'evt-spk-rev-001',
        eventName: 'marketing.spk.uploaded',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Contract',
        aggregateId: 202,
        payload: {
          tenderId: 71,
          contractId: 202,
          title: 'Pengadaan Fiber Optic Revisi',
          isRevision: true,
          fileName: 'spk-fiber-rev1.pdf',
        },
      };

      const results = await consumer.handleMarketingSpkUploaded(event);
      expect(results.length).toBe(2);

      const legalNotif = inMemoryNotifications.find((n) => n.userId === 20);
      expect(legalNotif).toBeDefined();
      expect(legalNotif?.title).toBe('Dokumen Revisi SPK Diunggah');
      expect(legalNotif?.actionLink).toBe('/legal/review?tab=REVISION');
      expect(legalNotif?.dedupeKey).toBe('evt-spk-rev-001:20:LEGAL_REVIEW_CONTRACT_SUBMITTED');
    });

    it('does NOT trigger marketing.tender.won Bell when SPK is uploaded', async () => {
      const event: BusinessEvent = {
        eventId: 'evt-spk-isolation',
        eventName: 'marketing.spk.uploaded',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Contract',
        aggregateId: 203,
        payload: {
          tenderId: 72,
          contractId: 203,
          title: 'Isolation Test',
          isRevision: false,
        },
      };

      await consumer.handleMarketingSpkUploaded(event);

      // Verify no MARKETING_TENDER_WON notifications exist
      expect(
        inMemoryNotifications.some((n) => n.dedupeKey?.includes('MARKETING_TENDER_WON')),
      ).toBe(false);
    });
  });

  describe('4. Input Contract & Idempotency Safeguards', () => {
    it('safely skips non-canonical event missing eventId without throwing', async () => {
      const legacyPayload: any = { contractId: 999 };

      const resAppr = await consumer.handleLegalContractApproved(legacyPayload);
      expect(resAppr).toEqual([]);

      const resRev = await consumer.handleLegalContractRevisionRequested(legacyPayload);
      expect(resRev).toEqual([]);

      const resSpk = await consumer.handleMarketingSpkUploaded(legacyPayload);
      expect(resSpk).toEqual([]);

      expect(inMemoryNotifications).toHaveLength(0);
    });

    it('safely skips projection when notificationPolicy is SYNC_ONLY', async () => {
      const syncOnlyEvent: BusinessEvent = {
        eventId: 'evt-sync-only',
        eventName: 'legal.contract.approved',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Contract',
        aggregateId: 301,
        notificationPolicy: 'SYNC_ONLY' as any,
        payload: { contractId: 301, marketingPicId: 25 },
      };

      const results = await consumer.handleLegalContractApproved(syncOnlyEvent);
      expect(results).toEqual([]);
      expect(inMemoryNotifications).toHaveLength(0);
    });
  });
});
