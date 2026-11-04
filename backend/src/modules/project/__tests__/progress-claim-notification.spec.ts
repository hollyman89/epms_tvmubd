import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource, Repository } from 'typeorm';
import { Notification } from '../../../entities/notification.entity';
import { PushOutbox, PushOutboxStatus } from '../../../entities/push-outbox.entity';
import { OutboxEvent, OutboxStatus } from '../../../entities/outbox-event.entity';
import { ProjectProgressLog } from '../../../entities/project-progress-log.entity';
import { ProjectProgressEvidence } from '../../../entities/project-progress-evidence.entity';
import { Project } from '../../../entities/project.entity';
import { Task } from '../../../entities/task.entity';
import { ProjectBaseline } from '../../../entities/project-baseline.entity';
import { Document } from '../../../entities/document.entity';
import { NotificationGateway } from '../../notification/notification.gateway';
import { CanonicalNotificationWriter } from '../../notification/canonical-notification.writer';
import { CanonicalNotificationConsumer } from '../../notification/canonical-notification.consumer';
import { BusinessSyncConsumer, BusinessSyncEnvelope } from '../../notification/business-sync.consumer';
import { NotificationService } from '../../notification/notification.service';
import { ProjectService } from '../project.service';
import { InboxService } from '../../inbox/inbox.service';
import { BusinessEvent, extractOutboxReceipt, OutboxDeliveryOutcome } from '../../../shared/contracts/business-event.contract';

describe('EPMS: Project Progress Claim Canonical Notification & Lifecycle Spec', () => {
  let consumer: CanonicalNotificationConsumer;
  let syncConsumer: BusinessSyncConsumer;
  let writer: CanonicalNotificationWriter;
  let projectService: ProjectService;

  let inMemoryNotifications: Notification[];
  let inMemoryPushOutbox: PushOutbox[];
  let inMemoryOutboxEvents: OutboxEvent[];
  let inMemoryProgressLogs: ProjectProgressLog[];
  let socketPushes: Array<{ userId: number; notification: any }>;
  let capturedSyncRooms: string[][];
  let capturedSyncEnvelopes: BusinessSyncEnvelope[];

  let mockNotificationService: jest.Mocked<Partial<NotificationService>>;
  let mockManager: any;
  let mockDataSource: any;

  const SUBMITTING_PM_ID = 2;
  const OTHER_PM_ID = 3;
  const HOPS_USER_ID = 58;
  const PMO_USER_ID = 5;
  const PROJECT_ID = 53;
  const TASK_ID = 108;
  const PROGRESS_LOG_ID = 84;
  const PROJECT_NAME = 'Deployment Fiber Optic Network Q2';
  const TASK_NAME = 'Instalasi OTB & Splicing Core';

  beforeEach(async () => {
    inMemoryNotifications = [];
    inMemoryPushOutbox = [];
    inMemoryOutboxEvents = [];
    inMemoryProgressLogs = [];
    socketPushes = [];
    capturedSyncRooms = [];
    capturedSyncEnvelopes = [];

    const mockEmailQueue = {
      add: jest.fn().mockResolvedValue({ id: 'email-job-progress' }),
    };

    const mockNotificationRepo = {
      save: jest.fn().mockImplementation(async (entity: Notification | Notification[]) => {
        const toSave = Array.isArray(entity) ? entity : [entity];
        const results = [];
        for (const item of toSave) {
          const duplicate = inMemoryNotifications.find(
            (n) => n.userId === item.userId && n.dedupeKey && n.dedupeKey === item.dedupeKey,
          );
          if (duplicate) {
            const err: any = new Error(`Duplicate entry '${item.dedupeKey}' for key 'idx_notif_user_dedupe'`);
            err.code = 'ER_DUP_ENTRY';
            err.errno = 1062;
            throw err;
          }
          const saved = Object.assign(new Notification(), item, {
            id: inMemoryNotifications.length + 1,
          });
          inMemoryNotifications.push(saved);
          results.push(saved);
        }
        return Array.isArray(entity) ? results : results[0];
      }),
      find: jest.fn().mockImplementation(async () => inMemoryNotifications),
      findOne: jest.fn().mockImplementation(async (opt: any) => {
        if (opt?.where?.dedupeKey) {
          return inMemoryNotifications.find((n) => n.dedupeKey === opt.where.dedupeKey) || null;
        }
        return null;
      }),
    };

    const mockPushOutboxRepo = {
      save: jest.fn().mockImplementation(async (entity: PushOutbox | PushOutbox[]) => {
        const toSave = Array.isArray(entity) ? entity : [entity];
        const results = [];
        for (const item of toSave) {
          const duplicate = inMemoryPushOutbox.find(
            (p) => p.recipientId === item.recipientId && p.dedupeKey && p.dedupeKey === item.dedupeKey,
          );
          if (duplicate) {
            const err: any = new Error(`Duplicate entry '${item.dedupeKey}' for key 'uk_push_outbox_dedupe'`);
            err.code = 'ER_DUP_ENTRY';
            err.errno = 1062;
            throw err;
          }
          const saved = Object.assign(new PushOutbox(), item, {
            id: inMemoryPushOutbox.length + 1,
          });
          inMemoryPushOutbox.push(saved);
          results.push(saved);
        }
        return Array.isArray(entity) ? results : results[0];
      }),
    };

    const mockGateway = {
      sendNotificationToUser: jest.fn().mockImplementation((userId: number, notif: any) => {
        socketPushes.push({ userId, notification: notif });
      }),
      sendSyncEventToRooms: jest.fn().mockImplementation((rooms: string[], envelope: BusinessSyncEnvelope) => {
        capturedSyncRooms.push(rooms);
        capturedSyncEnvelopes.push(envelope);
      }),
    };

    mockNotificationService = {
      markRelatedNotificationsRead: jest.fn().mockResolvedValue(undefined),
    };

    mockDataSource = {
      query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes('SELECT name FROM projects WHERE id = ?')) {
          return [{ name: PROJECT_NAME }];
        }
        if (sql.includes('SELECT name FROM tasks WHERE id = ?')) {
          return [{ name: TASK_NAME }];
        }
        if (sql.includes('SELECT DISTINCT u.id')) {
          if (sql.includes('HEAD_OF_OPERATIONS') || (params && params.some((p: any) => String(p).includes('HEAD_OF_OPERATIONS')))) {
            return [{ id: HOPS_USER_ID }, { id: PMO_USER_ID }];
          }
        }
        if (sql.includes('SELECT submitted_by FROM project_progress_logs WHERE id = ?')) {
          return [{ submitted_by: SUBMITTING_PM_ID }];
        }
        return [];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanonicalNotificationWriter,
        CanonicalNotificationConsumer,
        BusinessSyncConsumer,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepo,
        },
        {
          provide: getRepositoryToken(PushOutbox),
          useValue: mockPushOutboxRepo,
        },
        {
          provide: getQueueToken('email-send'),
          useValue: mockEmailQueue,
        },
        {
          provide: NotificationGateway,
          useValue: mockGateway,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    consumer = module.get<CanonicalNotificationConsumer>(CanonicalNotificationConsumer);
    syncConsumer = module.get<BusinessSyncConsumer>(BusinessSyncConsumer);
    writer = module.get<CanonicalNotificationWriter>(CanonicalNotificationWriter);
  });

  describe('Scenario A: PM Submits Progress Claim', () => {
    it('A1: Should construct deterministic event ID and atomic OutboxEvent contract', () => {
      const claimId = 84;
      const expectedEventId = `proj-progress-sub-${claimId}`;
      expect(expectedEventId).toBe('proj-progress-sub-84');
    });

    it('A2: Canonical consumer notifies HOPS and PMO reviewers with submitter excluded', async () => {
      const businessEvent: BusinessEvent = {
        eventId: 'proj-progress-sub-84',
        eventName: 'project.progress_claim.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProjectProgressLog',
        aggregateId: PROGRESS_LOG_ID,
        projectId: PROJECT_ID,
        actor: { userId: SUBMITTING_PM_ID, roles: ['PROJECT_MANAGER'] },
        routing: { roles: ['HEAD_OF_OPERATIONS', 'PMO'] },
        payload: {
          progressLogId: PROGRESS_LOG_ID,
          projectId: PROJECT_ID,
          taskId: TASK_ID,
          taskName: TASK_NAME,
          submittedBy: SUBMITTING_PM_ID,
          previousProgress: 50,
          reportedProgress: 100,
          eventType: 'TASK_COMPLETION',
          reason: 'Semua kabel dan OTB selesai dipasang dan lolos tes',
          actionLink: `/project-delivery?view=workspace&projectId=${PROJECT_ID}&section=tasks&progressClaimId=${PROGRESS_LOG_ID}`,
        },
      };

      const results = await consumer.handleProjectProgressClaimSubmitted(businessEvent);
      expect(results.length).toBe(2);

      const recipientIds = inMemoryNotifications.map((n) => n.userId);
      expect(recipientIds).toContain(HOPS_USER_ID);
      expect(recipientIds).toContain(PMO_USER_ID);
      expect(recipientIds).not.toContain(SUBMITTING_PM_ID); // Submitter strictly excluded

      const hopsNotif = inMemoryNotifications.find((n) => n.userId === HOPS_USER_ID);
      expect(hopsNotif).toBeDefined();
      expect(hopsNotif!.title).toBe('Klaim Progres Menunggu Verifikasi');
      expect(hopsNotif!.message).toContain(TASK_NAME);
      expect(hopsNotif!.message).toContain('50% → 100%');
      expect(hopsNotif!.actionLink).toContain(`progressClaimId=${PROGRESS_LOG_ID}`);
      expect(hopsNotif!.metaData.reference_type).toBe('PROJECT_PROGRESS_CLAIM');
      expect(hopsNotif!.metaData.reference_id).toBe(PROGRESS_LOG_ID);

      // Verify PushOutbox records created for all eligible reviewers
      expect(inMemoryPushOutbox.length).toBe(2);
      const pushRecipients = inMemoryPushOutbox.map((p) => p.recipientId);
      expect(pushRecipients).toContain(HOPS_USER_ID);
      expect(pushRecipients).toContain(PMO_USER_ID);
      expect(pushRecipients).not.toContain(SUBMITTING_PM_ID);

      // Verify WebSocket emission to reviewers
      expect(socketPushes.length).toBe(2);
      expect(socketPushes.map((s) => s.userId)).toContain(HOPS_USER_ID);
    });

    it('A3: Duplicate submission event delivery is idempotent and does not create duplicate notifications', async () => {
      const businessEvent: BusinessEvent = {
        eventId: 'proj-progress-sub-84',
        eventName: 'project.progress_claim.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProjectProgressLog',
        aggregateId: PROGRESS_LOG_ID,
        projectId: PROJECT_ID,
        actor: { userId: SUBMITTING_PM_ID, roles: ['PROJECT_MANAGER'] },
        payload: {
          progressLogId: PROGRESS_LOG_ID,
          projectId: PROJECT_ID,
          taskId: TASK_ID,
          taskName: TASK_NAME,
          submittedBy: SUBMITTING_PM_ID,
          previousProgress: 50,
          reportedProgress: 100,
        },
      };

      await consumer.handleProjectProgressClaimSubmitted(businessEvent);
      expect(inMemoryNotifications.length).toBe(2);

      // Re-delivery of identical event
      await consumer.handleProjectProgressClaimSubmitted(businessEvent);
      expect(inMemoryNotifications.length).toBe(2); // Still 2, zero duplicates inserted
    });

    it('A4: BusinessSync consumer dispatches sync envelope to authorized rooms', () => {
      const businessEvent: BusinessEvent = {
        eventId: 'proj-progress-sub-84',
        eventName: 'project.progress_claim.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProjectProgressLog',
        aggregateId: PROGRESS_LOG_ID,
        projectId: PROJECT_ID,
        routing: { roles: ['HEAD_OF_OPERATIONS', 'PMO'] },
        payload: { progressLogId: PROGRESS_LOG_ID, projectId: PROJECT_ID },
      };

      const receipt = syncConsumer.handleProjectProgressClaimSync(businessEvent);
      expect(receipt.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);
      expect(receipt.channel).toBe('BUSINESS_SYNC');
      expect(capturedSyncEnvelopes.length).toBe(1);
      expect(capturedSyncEnvelopes[0].eventName).toBe('project.progress_claim.submitted');
      expect(capturedSyncRooms[0]).toContain('role:HEAD_OF_OPERATIONS');
      expect(capturedSyncRooms[0]).toContain('role:PMO');
    });
  });

  describe('Scenario B: HOPS Returns / Rejects Progress Claim', () => {
    it('B1: Return event routes strictly to the original submitting PM with actual rejection reason', async () => {
      const REJECTION_REASON = 'upload ulang evidence tim progres implementasi — format tidak terbaca';
      const returnEvent: BusinessEvent = {
        eventId: 'proj-progress-ret-84',
        eventName: 'project.progress_claim.returned',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProjectProgressLog',
        aggregateId: PROGRESS_LOG_ID,
        projectId: PROJECT_ID,
        actor: { userId: HOPS_USER_ID, roles: ['HEAD_OF_OPERATIONS'] },
        routing: { userIds: [SUBMITTING_PM_ID] },
        payload: {
          progressLogId: PROGRESS_LOG_ID,
          projectId: PROJECT_ID,
          taskId: TASK_ID,
          taskName: TASK_NAME,
          submittedBy: SUBMITTING_PM_ID,
          verifiedBy: HOPS_USER_ID,
          previousProgress: 50,
          reportedProgress: 100,
          rejectionReason: REJECTION_REASON,
          actionLink: `/project-delivery?view=workspace&projectId=${PROJECT_ID}&section=tasks&progressClaimId=${PROGRESS_LOG_ID}`,
        },
      };

      const results = await consumer.handleProjectProgressClaimReturned(returnEvent);
      expect(results.length).toBe(1);

      // Verify strictly original PM received the notification
      expect(inMemoryNotifications.length).toBe(1);
      const pmNotif = inMemoryNotifications[0];
      expect(pmNotif.userId).toBe(SUBMITTING_PM_ID);
      expect(pmNotif.title).toBe('Klaim Progres Dikembalikan');
      expect(pmNotif.message).toContain(REJECTION_REASON);
      expect(pmNotif.metaData.rejectionReason).toBe(REJECTION_REASON);
      expect(pmNotif.actionLink).toContain(`progressClaimId=${PROGRESS_LOG_ID}`);

      // Other PMs received nothing
      expect(inMemoryNotifications.find((n) => n.userId === OTHER_PM_ID)).toBeUndefined();
      expect(inMemoryNotifications.find((n) => n.userId === HOPS_USER_ID)).toBeUndefined();

      // Verify PushOutbox delivery targeted strictly to submitter
      expect(inMemoryPushOutbox.length).toBe(1);
      expect(inMemoryPushOutbox[0].recipientId).toBe(SUBMITTING_PM_ID);
      expect(inMemoryPushOutbox[0].payloadPreview?.body).toContain(REJECTION_REASON);
    });

    it('B2: Duplicate return event delivery does not create duplicate notifications', async () => {
      const returnEvent: BusinessEvent = {
        eventId: 'proj-progress-ret-84',
        eventName: 'project.progress_claim.returned',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProjectProgressLog',
        aggregateId: PROGRESS_LOG_ID,
        projectId: PROJECT_ID,
        payload: {
          progressLogId: PROGRESS_LOG_ID,
          projectId: PROJECT_ID,
          taskId: TASK_ID,
          submittedBy: SUBMITTING_PM_ID,
          rejectionReason: 'Perlu revisi',
        },
      };

      await consumer.handleProjectProgressClaimReturned(returnEvent);
      expect(inMemoryNotifications.length).toBe(1);

      await consumer.handleProjectProgressClaimReturned(returnEvent);
      expect(inMemoryNotifications.length).toBe(1); // Idempotent deduplication
    });
  });

  describe('Scenario C: HOPS Approves Progress Claim', () => {
    it('C1: Approval event routes strictly to the original submitting PM with previous and official progress', async () => {
      const approvalEvent: BusinessEvent = {
        eventId: 'proj-progress-app-84',
        eventName: 'project.progress_claim.approved',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProjectProgressLog',
        aggregateId: PROGRESS_LOG_ID,
        projectId: PROJECT_ID,
        actor: { userId: HOPS_USER_ID, roles: ['HEAD_OF_OPERATIONS'] },
        routing: { userIds: [SUBMITTING_PM_ID] },
        payload: {
          progressLogId: PROGRESS_LOG_ID,
          projectId: PROJECT_ID,
          taskId: TASK_ID,
          taskName: TASK_NAME,
          submittedBy: SUBMITTING_PM_ID,
          verifiedBy: HOPS_USER_ID,
          previousProgress: 50,
          reportedProgress: 100,
          officialProgress: 100,
          actionLink: `/project-delivery?view=workspace&projectId=${PROJECT_ID}&section=tasks`,
        },
      };

      const results = await consumer.handleProjectProgressClaimApproved(approvalEvent);
      expect(results.length).toBe(1);

      expect(inMemoryNotifications.length).toBe(1);
      const pmNotif = inMemoryNotifications[0];
      expect(pmNotif.userId).toBe(SUBMITTING_PM_ID);
      expect(pmNotif.title).toBe('Klaim Progres Disetujui');
      expect(pmNotif.message).toContain('50% → 100%');
      expect(pmNotif.metaData.previousProgress).toBe(50);
      expect(pmNotif.metaData.officialProgress).toBe(100);
      expect(pmNotif.metaData.actionType).toBe('PROGRESS_CLAIM_APPROVED');

      // Other PMs and verifier received nothing
      expect(inMemoryNotifications.find((n) => n.userId === OTHER_PM_ID)).toBeUndefined();
      expect(inMemoryNotifications.find((n) => n.userId === HOPS_USER_ID)).toBeUndefined();

      // Verify PushOutbox record created strictly for submitter
      expect(inMemoryPushOutbox.length).toBe(1);
      expect(inMemoryPushOutbox[0].recipientId).toBe(SUBMITTING_PM_ID);
    });

    it('C2: Duplicate approval event delivery does not create duplicate notifications', async () => {
      const approvalEvent: BusinessEvent = {
        eventId: 'proj-progress-app-84',
        eventName: 'project.progress_claim.approved',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProjectProgressLog',
        aggregateId: PROGRESS_LOG_ID,
        projectId: PROJECT_ID,
        payload: {
          progressLogId: PROGRESS_LOG_ID,
          projectId: PROJECT_ID,
          taskId: TASK_ID,
          submittedBy: SUBMITTING_PM_ID,
          previousProgress: 50,
          reportedProgress: 100,
          officialProgress: 100,
        },
      };

      await consumer.handleProjectProgressClaimApproved(approvalEvent);
      expect(inMemoryNotifications.length).toBe(1);

      await consumer.handleProjectProgressClaimApproved(approvalEvent);
      expect(inMemoryNotifications.length).toBe(1);
    });
  });

  describe('Integration: Outbox Receipts, Delivery Contracts and Deep Links', () => {
    it('D1: Submission notification produces valid Outbox receipt and canonical deep link target', async () => {
      const businessEvent: BusinessEvent = {
        eventId: 'proj-progress-sub-84',
        eventName: 'project.progress_claim.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProjectProgressLog',
        aggregateId: PROGRESS_LOG_ID,
        projectId: PROJECT_ID,
        actor: { userId: SUBMITTING_PM_ID, roles: ['PROJECT_MANAGER'] },
        payload: {
          progressLogId: PROGRESS_LOG_ID,
          projectId: PROJECT_ID,
          taskId: TASK_ID,
          taskName: TASK_NAME,
          submittedBy: SUBMITTING_PM_ID,
          previousProgress: 50,
          reportedProgress: 100,
        },
      };

      const results = await consumer.handleProjectProgressClaimSubmitted(businessEvent);
      const receipt = extractOutboxReceipt(results);
      expect(receipt).toBeDefined();
      expect(receipt!.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);
      expect(receipt!.channel).toBe('CANONICAL_NOTIFICATION');

      const notif = inMemoryNotifications.find((n) => n.userId === HOPS_USER_ID);
      expect(notif).toBeDefined();
      expect(notif!.actionLink).toBe(
        `/project-delivery?view=workspace&projectId=${PROJECT_ID}&section=tasks&progressClaimId=${PROGRESS_LOG_ID}`,
      );
    });

    it('D2: Return notification produces valid Outbox receipt and isolated PM deep link', async () => {
      const returnEvent: BusinessEvent = {
        eventId: 'proj-progress-ret-84',
        eventName: 'project.progress_claim.returned',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProjectProgressLog',
        aggregateId: PROGRESS_LOG_ID,
        projectId: PROJECT_ID,
        payload: {
          progressLogId: PROGRESS_LOG_ID,
          projectId: PROJECT_ID,
          taskId: TASK_ID,
          taskName: TASK_NAME,
          submittedBy: SUBMITTING_PM_ID,
          rejectionReason: 'Format salah',
        },
      };

      const results = await consumer.handleProjectProgressClaimReturned(returnEvent);
      const receipt = extractOutboxReceipt(results);
      expect(receipt).toBeDefined();
      expect(receipt!.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);

      const notif = inMemoryNotifications.find((n) => n.userId === SUBMITTING_PM_ID);
      expect(notif).toBeDefined();
      expect(notif!.actionLink).toBe(
        `/project-delivery?view=workspace&projectId=${PROJECT_ID}&section=tasks&progressClaimId=${PROGRESS_LOG_ID}`,
      );
    });
  });
});

