import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource, Repository } from 'typeorm';
import { Notification } from '../../../entities/notification.entity';
import { NotificationGateway } from '../notification.gateway';
import { CanonicalNotificationWriter } from '../canonical-notification.writer';
import { CanonicalNotificationConsumer } from '../canonical-notification.consumer';
import { BusinessEvent, NotificationPolicy } from '../../../shared/contracts/business-event.contract';

describe('Phase 1.7 — F-HIGH-04: Legacy Notification & Deep Link Remediation (Tender & Contract)', () => {
  let consumer: CanonicalNotificationConsumer;
  let writer: CanonicalNotificationWriter;
  let mockNotificationRepo: jest.Mocked<Partial<Repository<Notification>>>;
  let mockGateway: jest.Mocked<Partial<NotificationGateway>>;
  let mockEmailQueue: { add: jest.Mock };
  let mockDataSource: any;
  let inMemoryNotifications: Notification[];
  let socketPushes: Array<{ userId: number; notification: any }>;

  beforeEach(async () => {
    inMemoryNotifications = [];
    socketPushes = [];
    mockEmailQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-fhigh04' }),
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
        if (params && params.includes('PMO') && params.includes('SUPER_ADMIN')) {
          return [{ id: 30 }, { id: 1 }];
        }
        if (params && params.includes('PROJECT_MANAGER')) {
          return [{ id: 40 }];
        }
        if (params && params.includes('LEGAL') && params.includes('SUPER_ADMIN')) {
          return [{ id: 20 }, { id: 1 }];
        }
        if (params && params.includes('DIRECTOR') && params.includes('GENERAL_MANAGER')) {
          return [{ id: 5 }, { id: 10 }];
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

  // =========================================================================
  // 1. TENDER DOMAIN CANONICAL EVENTS & DETERMINISTIC DEDUPLICATION
  // =========================================================================
  describe('1. Tender Domain Canonical Notifications', () => {
    it('marketing.tender.won uses deterministic eventId tnd-won-{id} and creates exactly 1 Bell for Marketing PIC', async () => {
      const event: BusinessEvent = {
        eventId: 'tnd-won-101',
        eventName: 'marketing.tender.won',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 101,
        actor: { userId: 5 },
        routing: { userIds: [25] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          tenderId: 101,
          title: 'Pengadaan CCTV Command Center',
          customerId: 12,
          customerName: 'Dinas Perhubungan',
          stage: 'WON',
          status: 'WON',
          estimatedBudget: 500000000,
          negotiatedPrice: 480000000,
          marketingPicId: 25,
        },
      };

      const results = await consumer.handleMarketingTenderWon(event);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');

      const notif = inMemoryNotifications[0];
      expect(notif.userId).toBe(25);
      expect(notif.title).toBe('Tender Menang (WON)');
      expect(notif.actionLink).toBe('/sales');
      expect(notif.dedupeKey).toBe('tnd-won-101:25:MARKETING_TENDER_WON');

      // Replay suppression: duplicate eventId must be silently caught
      const replay = await consumer.handleMarketingTenderWon(event);
      expect(replay[0].status).toBe('DUPLICATE_SUPPRESSED');
      expect(inMemoryNotifications).toHaveLength(1);
    });

    it('marketing.tender.lost uses deterministic eventId tnd-lost-{id} and creates exactly 1 Bell for Marketing PIC', async () => {
      const event: BusinessEvent = {
        eventId: 'tnd-lost-102',
        eventName: 'marketing.tender.lost',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 102,
        actor: { userId: 25 },
        routing: { userIds: [25] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          tenderId: 102,
          title: 'Pembangunan Jaringan Kampus',
          marketingPicId: 25,
        },
      };

      const results = await consumer.handleMarketingTenderLost(event);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');

      const notif = inMemoryNotifications[0];
      expect(notif.userId).toBe(25);
      expect(notif.title).toBe('Tender Kalah (LOST)');
      expect(notif.dedupeKey).toBe('tnd-lost-102:25:MARKETING_TENDER_LOST');

      const replay = await consumer.handleMarketingTenderLost(event);
      expect(replay[0].status).toBe('DUPLICATE_SUPPRESSED');
    });

    it('marketing.gonogo.submitted routes to Approvers (/sales?tab=1&tenderId=...&action=go-nogo) and Submitter', async () => {
      const event: BusinessEvent = {
        eventId: 'tnd-gng-sub-103',
        eventName: 'marketing.gonogo.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 103,
        actor: { userId: 25 },
        routing: { userIds: [25] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          tenderId: 103,
          tenderTitle: 'Modernisasi Server',
          isResubmission: false,
        },
      };

      const results = await consumer.handleMarketingGoNoGoSubmitted(event);
      expect(results.length).toBeGreaterThanOrEqual(2);

      // Approver notification has actionable deep link with action=go-nogo
      const approverNotif = inMemoryNotifications.find((n) => n.userId === 5);
      expect(approverNotif).toBeDefined();
      expect(approverNotif?.actionLink).toBe('/sales?tab=1&tenderId=103&action=go-nogo');
      expect(approverNotif?.dedupeKey).toBe('tnd-gng-sub-103:5:MARKETING_GONOGO_APPROVAL_REQUIRED');

      // Submitter tracking notification
      const submitterNotif = inMemoryNotifications.find((n) => n.userId === 25);
      expect(submitterNotif).toBeDefined();
      expect(submitterNotif?.dedupeKey).toBe('tnd-gng-sub-103:25:MARKETING_GONOGO_SUBMITTED');

      // Submitter self-exclusion from approvers
      expect(submitterNotif?.title).toBe('GO/NO GO Berhasil Diajukan');
    });

    it('marketing.gonogo.approved uses deterministic eventId tnd-gng-app-{id} and routes to Marketing PIC', async () => {
      const event: BusinessEvent = {
        eventId: 'tnd-gng-app-104',
        eventName: 'marketing.gonogo.approved',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 104,
        actor: { userId: 5 },
        routing: { userIds: [25] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          tenderId: 104,
          tenderTitle: 'Proyek Router Backbone',
          decision: 'GO',
        },
      };

      const results = await consumer.handleMarketingGoNoGoApproved(event);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');

      const notif = inMemoryNotifications[0];
      expect(notif.userId).toBe(25);
      expect(notif.title).toBe('Tender Disetujui (GO)');
      expect(notif.dedupeKey).toBe('tnd-gng-app-104:25:MARKETING_GONOGO_APPROVED');
    });

    it('marketing.discount.critical_warning routes to Directors with action=discount-approval', async () => {
      const event: BusinessEvent = {
        eventId: 'tnd-dsc-warn-105',
        eventName: 'marketing.discount.critical_warning',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 105,
        actor: { userId: 25 },
        routing: { roles: ['DIRECTOR', 'GENERAL_MANAGER'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          tenderId: 105,
          tenderTitle: 'Smart Office Upgrade',
          discountPercentage: 25,
          maxDiscount: 20,
        },
      };

      const results = await consumer.handleMarketingDiscountCriticalWarning(event);
      expect(results.length).toBeGreaterThanOrEqual(1);

      const directorNotif = inMemoryNotifications.find((n) => n.userId === 5);
      expect(directorNotif).toBeDefined();
      expect(directorNotif?.actionLink).toBe('/sales?tab=1&tenderId=105&action=discount-approval');
      expect(directorNotif?.dedupeKey).toBe('tnd-dsc-warn-105:5:MARKETING_DISCOUNT_CRITICAL_WARNING');
    });

    it('marketing.discount.rejected uses deterministic eventId tnd-dsc-rej-{id}', async () => {
      const event: BusinessEvent = {
        eventId: 'tnd-dsc-rej-106',
        eventName: 'marketing.discount.rejected',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 106,
        actor: { userId: 5 },
        routing: { userIds: [25] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          tenderId: 106,
          tenderTitle: 'Smart Office Upgrade',
          notes: 'Margin terlalu rendah.',
        },
      };

      const results = await consumer.handleMarketingDiscountRejected(event);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');

      const notif = inMemoryNotifications[0];
      expect(notif.userId).toBe(25);
      expect(notif.title).toBe('Diskon Ditolak');
      expect(notif.dedupeKey).toBe('tnd-dsc-rej-106:25:MARKETING_DISCOUNT_REJECTED');
    });

    it('marketing.discount.approved uses deterministic eventId tnd-dsc-app-{id}', async () => {
      const event: BusinessEvent = {
        eventId: 'tnd-dsc-app-107',
        eventName: 'marketing.discount.approved',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 107,
        actor: { userId: 5 },
        routing: { userIds: [25] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          tenderId: 107,
          tenderTitle: 'Smart Office Upgrade',
          notes: 'Disetujui untuk strategic partner.',
        },
      };

      const results = await consumer.handleMarketingDiscountApproved(event);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');

      const notif = inMemoryNotifications[0];
      expect(notif.userId).toBe(25);
      expect(notif.title).toBe('Diskon Disetujui');
      expect(notif.dedupeKey).toBe('tnd-dsc-app-107:25:MARKETING_DISCOUNT_APPROVED');
    });
  });

  // =========================================================================
  // 2. CONTRACT DOMAIN CANONICAL EVENTS & RECIPIENT ISOLATION
  // =========================================================================
  describe('2. Contract Domain Canonical Notifications', () => {
    it('marketing.spk.uploaded routes to Legal with deterministic eventId spk-up-{contractId}', async () => {
      const event: BusinessEvent = {
        eventId: 'spk-up-201',
        eventName: 'marketing.spk.uploaded',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Contract',
        aggregateId: 201,
        actor: { userId: 25 },
        routing: { roles: ['LEGAL'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          tenderId: 101,
          contractId: 201,
          contractNumber: 'CONT-2026-001',
          title: 'Pengadaan CCTV Command Center',
          isRevision: false,
        },
      };

      const results = await consumer.handleMarketingSpkUploaded(event);
      expect(results.length).toBeGreaterThanOrEqual(1);

      const legalNotif = inMemoryNotifications.find((n) => n.userId === 20);
      expect(legalNotif).toBeDefined();
      expect(legalNotif?.actionLink).toBe('/legal/review?tab=WAITING');
      expect(legalNotif?.dedupeKey).toBe('spk-up-201:20:LEGAL_REVIEW_CONTRACT_SUBMITTED');

      // Duplicate replay suppression
      const replay = await consumer.handleMarketingSpkUploaded(event);
      expect(replay[0].status).toBe('DUPLICATE_SUPPRESSED');
    });

    it('legal.contract.approved projects to PMO & Marketing PIC, isolating Project Manager', async () => {
      const event: BusinessEvent = {
        eventId: 'cont-app-202',
        eventName: 'legal.contract.approved',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Contract',
        aggregateId: 202,
        actor: { userId: 20 },
        routing: { roles: ['PMO'], userIds: [25] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          contractId: 202,
          tenderId: 102,
          tenderTitle: 'Pengadaan Fiber Optik',
          marketingPicId: 25,
          legalStatus: 'APPROVED',
          reviewerId: 20,
        },
      };

      const results = await consumer.handleLegalContractApproved(event);
      expect(results.length).toBe(3); // PMO (30), SUPER_ADMIN (1), Marketing PIC (25)

      const pmoNotif = inMemoryNotifications.find((n) => n.userId === 30);
      expect(pmoNotif).toBeDefined();
      expect(pmoNotif?.actionLink).toBe('/project-delivery');
      expect(pmoNotif?.dedupeKey).toBe('cont-app-202:30:LEGAL_CONTRACT_APPROVED_PMO');

      const pmNotif = inMemoryNotifications.find((n) => n.userId === 40);
      expect(pmNotif).toBeUndefined(); // Strictly isolated!

      const mktNotif = inMemoryNotifications.find((n) => n.userId === 25);
      expect(mktNotif).toBeDefined();
      expect(mktNotif?.dedupeKey).toBe('cont-app-202:25:LEGAL_CONTRACT_APPROVED_MARKETING');
    });

    it('legal.contract.revision_requested uses deterministic eventId cont-rev-{id}-{count}', async () => {
      const event: BusinessEvent = {
        eventId: 'cont-rev-203-1',
        eventName: 'legal.contract.revision_requested',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Contract',
        aggregateId: 203,
        actor: { userId: 20 },
        routing: { userIds: [25] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          contractId: 203,
          tenderId: 103,
          tenderTitle: 'Proyek Switch Core',
          marketingPicId: 25,
          reason: 'Perbaiki masa garansi menjadi 3 tahun.',
        },
      };

      const results = await consumer.handleLegalContractRevisionRequested(event);
      expect(results).toHaveLength(1);

      const notif = inMemoryNotifications[0];
      expect(notif.userId).toBe(25);
      expect(notif.dedupeKey).toBe('cont-rev-203-1:25:LEGAL_CONTRACT_REVISION_REQUESTED');
      expect(notif.message).toContain('Perbaiki masa garansi');
    });

    it('legal.contract.rejected uses deterministic eventId cont-rej-{id} with actor self-exclusion', async () => {
      const event: BusinessEvent = {
        eventId: 'cont-rej-204',
        eventName: 'legal.contract.rejected',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Contract',
        aggregateId: 204,
        actor: { userId: 20 },
        routing: { userIds: [25] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          contractId: 204,
          tenderId: 104,
          tenderTitle: 'Proyek Cloud Hosting',
          marketingPicId: 25,
          reviewerId: 20,
          reason: 'Dokumen legalitas vendor sudah kadaluarsa.',
        },
      };

      const results = await consumer.handleLegalContractRejected(event);
      expect(results).toHaveLength(1);

      const notif = inMemoryNotifications[0];
      expect(notif.userId).toBe(25);
      expect(notif.title).toBe('Kontrak Ditolak Legal');
      expect(notif.dedupeKey).toBe('cont-rej-204:25:LEGAL_CONTRACT_REJECTED');
    });
  });

  // =========================================================================
  // 3. ZERO REGRESSION SAFETY & DIRECT PERSISTENCE DECOUPLING
  // =========================================================================
  describe('3. Zero Direct Persistence & Delivery Verification', () => {
    it('all notifications generate valid dedupeKey and explicit delivery status', async () => {
      const event: BusinessEvent = {
        eventId: 'tnd-won-999',
        eventName: 'marketing.tender.won',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 999,
        routing: { userIds: [25] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          tenderId: 999,
          title: 'Direct Persistence Elimination Verification',
        },
      };

      const results = await consumer.handleMarketingTenderWon(event);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[0].dedupeKey).toBeDefined();
      expect(results[0].recipientId).toBe(25);

      // Verify socket push occurred
      expect(socketPushes).toHaveLength(1);
      expect(socketPushes[0].userId).toBe(25);
    });
  });

  // =========================================================================
  // 4. COLLISION PREVENTION & MULTI-CYCLE RESUBMISSION VALIDATION
  // =========================================================================
  describe('4. Multi-Cycle Resubmission & Collision Prevention Suite', () => {
    it('Go/No-Go resubmission cycles produce distinct eventIds and deliver notifications on each cycle', async () => {
      // Cycle 1: Initial submission
      const cycle1Event: BusinessEvent = {
        eventId: 'tnd-gng-sub-501',
        eventName: 'marketing.gonogo.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 501,
        actor: { userId: 25 },
        routing: { userIds: [25] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: { tenderId: 501, tenderTitle: 'Tender Cycle Test', isResubmission: false },
      };

      const res1 = await consumer.handleMarketingGoNoGoSubmitted(cycle1Event);
      expect(res1.some((r) => r.status === 'PERSISTED')).toBe(true);
      const approverNotif1 = inMemoryNotifications.find(
        (n) => n.userId === 5 && n.dedupeKey === 'tnd-gng-sub-501:5:MARKETING_GONOGO_APPROVAL_REQUIRED',
      );
      expect(approverNotif1).toBeDefined();

      // Retry of Cycle 1 -> MUST be suppressed!
      const retryRes = await consumer.handleMarketingGoNoGoSubmitted(cycle1Event);
      expect(retryRes.find((r) => r.recipientId === 5)?.status).toBe('DUPLICATE_SUPPRESSED');

      // Cycle 2: First resubmission (after NO_GO rejection)
      const cycle2Event: BusinessEvent = {
        eventId: 'tnd-gng-sub-501-resub-1',
        eventName: 'marketing.gonogo.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 501,
        actor: { userId: 25 },
        routing: { userIds: [25] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: { tenderId: 501, tenderTitle: 'Tender Cycle Test', isResubmission: true },
      };

      const res2 = await consumer.handleMarketingGoNoGoSubmitted(cycle2Event);
      expect(res2.some((r) => r.status === 'PERSISTED')).toBe(true);
      const approverNotif2 = inMemoryNotifications.find(
        (n) => n.userId === 5 && n.dedupeKey === 'tnd-gng-sub-501-resub-1:5:MARKETING_GONOGO_APPROVAL_REQUIRED',
      );
      expect(approverNotif2).toBeDefined();

      // Cycle 3: Second resubmission (after second rejection)
      const cycle3Event: BusinessEvent = {
        eventId: 'tnd-gng-sub-501-resub-2',
        eventName: 'marketing.gonogo.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 501,
        actor: { userId: 25 },
        routing: { userIds: [25] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: { tenderId: 501, tenderTitle: 'Tender Cycle Test', isResubmission: true },
      };

      const res3 = await consumer.handleMarketingGoNoGoSubmitted(cycle3Event);
      expect(res3.some((r) => r.status === 'PERSISTED')).toBe(true);
      const approverNotif3 = inMemoryNotifications.find(
        (n) => n.userId === 5 && n.dedupeKey === 'tnd-gng-sub-501-resub-2:5:MARKETING_GONOGO_APPROVAL_REQUIRED',
      );
      expect(approverNotif3).toBeDefined();

      // Total notifications for Director 5 must be 3 (one per valid business cycle)
      const directorNotifs = inMemoryNotifications.filter((n) => n.userId === 5);
      expect(directorNotifs).toHaveLength(3);
    });

    it('Discount proposals with distinct history IDs generate separate alerts without collision', async () => {
      // Proposal 1: 25% discount -> history ID 10
      const warn1: BusinessEvent = {
        eventId: 'tnd-dsc-warn-601-10',
        eventName: 'marketing.discount.critical_warning',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 601,
        actor: { userId: 25 },
        routing: { roles: ['DIRECTOR', 'GENERAL_MANAGER'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: { tenderId: 601, tenderTitle: 'Discount Test', discountPercentage: 25, maxDiscount: 20 },
      };

      const res1 = await consumer.handleMarketingDiscountCriticalWarning(warn1);
      expect(res1[0].status).toBe('PERSISTED');

      // Proposal 2: 22% discount -> history ID 12 (after previous was rejected)
      const warn2: BusinessEvent = {
        eventId: 'tnd-dsc-warn-601-12',
        eventName: 'marketing.discount.critical_warning',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 601,
        actor: { userId: 25 },
        routing: { roles: ['DIRECTOR', 'GENERAL_MANAGER'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: { tenderId: 601, tenderTitle: 'Discount Test', discountPercentage: 22, maxDiscount: 20 },
      };

      const res2 = await consumer.handleMarketingDiscountCriticalWarning(warn2);
      expect(res2[0].status).toBe('PERSISTED');

      // Director receives both alerts because they represent distinct proposals
      const dirNotifs = inMemoryNotifications.filter(
        (n) => n.userId === 5 && n.title === 'Peringatan Diskon Kritis',
      );
      expect(dirNotifs).toHaveLength(2);
      expect(dirNotifs[0].dedupeKey).toBe('tnd-dsc-warn-601-10:5:MARKETING_DISCOUNT_CRITICAL_WARNING');
      expect(dirNotifs[1].dedupeKey).toBe('tnd-dsc-warn-601-12:5:MARKETING_DISCOUNT_CRITICAL_WARNING');
    });

    it('SPK and Contract revision cycles increment deterministically and maintain idempotency on retry', async () => {
      // SPK Revision 1
      const spkRev1: BusinessEvent = {
        eventId: 'spk-up-701-rev-1',
        eventName: 'marketing.spk.uploaded',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Contract',
        aggregateId: 701,
        actor: { userId: 25 },
        routing: { roles: ['LEGAL'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: { contractId: 701, tenderId: 101, isRevision: true },
      };

      const resSpk1 = await consumer.handleMarketingSpkUploaded(spkRev1);
      expect(resSpk1.some((r) => r.status === 'PERSISTED')).toBe(true);

      // SPK Revision 2
      const spkRev2: BusinessEvent = {
        eventId: 'spk-up-701-rev-2',
        eventName: 'marketing.spk.uploaded',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Contract',
        aggregateId: 701,
        actor: { userId: 25 },
        routing: { roles: ['LEGAL'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: { contractId: 701, tenderId: 101, isRevision: true },
      };

      const resSpk2 = await consumer.handleMarketingSpkUploaded(spkRev2);
      expect(resSpk2.some((r) => r.status === 'PERSISTED')).toBe(true);

      // Legal reviewer receives both revisions
      const legalNotifs = inMemoryNotifications.filter(
        (n) => n.userId === 20 && n.title === 'Dokumen Revisi SPK Diunggah',
      );
      expect(legalNotifs).toHaveLength(2);
      expect(legalNotifs[0].dedupeKey).toBe('spk-up-701-rev-1:20:LEGAL_REVIEW_CONTRACT_SUBMITTED');
      expect(legalNotifs[1].dedupeKey).toBe('spk-up-701-rev-2:20:LEGAL_REVIEW_CONTRACT_SUBMITTED');

      // Retry of SPK Revision 2 suppresses duplicate
      const retrySpk2 = await consumer.handleMarketingSpkUploaded(spkRev2);
      expect(retrySpk2.find((r) => r.recipientId === 20)?.status).toBe('DUPLICATE_SUPPRESSED');
    });

    it('GAP-01 & GAP-02: Multi-upload in same cycle and 3rd resubmission cycle maintain deterministic collision-free notifications', async () => {
      // 1. SPK Upload: Multiple uploads in same revision cycle (e.g. rev 1 upload 2)
      const spkRev1U2: BusinessEvent = {
        eventId: 'spk-up-701-rev-1-u2',
        eventName: 'marketing.spk.uploaded',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Contract',
        aggregateId: 701,
        actor: { userId: 25 },
        routing: { roles: ['LEGAL'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: { contractId: 701, tenderId: 101, isRevision: true },
      };

      const resSpk1U2 = await consumer.handleMarketingSpkUploaded(spkRev1U2);
      expect(resSpk1U2.some((r) => r.status === 'PERSISTED')).toBe(true);

      const legalNotifU2 = inMemoryNotifications.find(
        (n) => n.userId === 20 && n.dedupeKey === 'spk-up-701-rev-1-u2:20:LEGAL_REVIEW_CONTRACT_SUBMITTED',
      );
      expect(legalNotifU2).toBeDefined();

      // Retry of rev 1 upload 2 suppresses duplicate
      const retrySpk1U2 = await consumer.handleMarketingSpkUploaded(spkRev1U2);
      expect(retrySpk1U2.find((r) => r.recipientId === 20)?.status).toBe('DUPLICATE_SUPPRESSED');

      // 2. Go/No-Go: 3rd resubmission cycle (after 3rd rejection)
      const cycle4Event: BusinessEvent = {
        eventId: 'tnd-gng-sub-501-resub-3',
        eventName: 'marketing.gonogo.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Tender',
        aggregateId: 501,
        actor: { userId: 25 },
        routing: { userIds: [25] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: { tenderId: 501, tenderTitle: 'Tender Cycle Test', isResubmission: true },
      };

      const res4 = await consumer.handleMarketingGoNoGoSubmitted(cycle4Event);
      expect(res4.some((r) => r.status === 'PERSISTED')).toBe(true);

      const approverNotif4 = inMemoryNotifications.find(
        (n) => n.userId === 5 && n.dedupeKey === 'tnd-gng-sub-501-resub-3:5:MARKETING_GONOGO_APPROVAL_REQUIRED',
      );
      expect(approverNotif4).toBeDefined();

      // Retry of 3rd resubmission suppresses duplicate
      const retryRes4 = await consumer.handleMarketingGoNoGoSubmitted(cycle4Event);
      expect(retryRes4.find((r) => r.recipientId === 5)?.status).toBe('DUPLICATE_SUPPRESSED');
    });
  });
});
