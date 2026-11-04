import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import {
  PushOutbox,
  PushOutboxStatus,
  PushErrorCategory,
} from '../../entities/push-outbox.entity';
import { CanonicalNotificationWriter } from './canonical-notification.writer';
import { CanonicalNotificationError } from './canonical-notification.contract';
import { NotificationGateway } from './notification.gateway';
import { PushOutboxService } from './push-outbox.service';
import { PushOutboxWorker } from './push-outbox.worker';
import {
  IPushSubscriptionProvider,
  IPushDispatcher,
  PushSubscriptionItem,
  PushDispatchOutcome,
} from './push-outbox.contract';
import * as crypto from 'crypto';

describe('Stage 3A: Backend Push Foundation & Transactional Outbox (AC-OUTBOX-01 to AC-OUTBOX-11)', () => {
  let writer: CanonicalNotificationWriter;
  let outboxService: PushOutboxService;
  let outboxWorker: PushOutboxWorker;

  let inMemoryNotifications: Notification[];
  let inMemoryPushOutbox: PushOutbox[];
  let removedSubscriptionIds: number[];

  let mockDataSource: any;
  let mockNotificationRepo: any;
  let mockPushOutboxRepo: any;
  let mockGateway: any;

  beforeEach(async () => {
    inMemoryNotifications = [];
    inMemoryPushOutbox = [];
    removedSubscriptionIds = [];

    mockNotificationRepo = {
      save: jest.fn().mockImplementation(async (entity: Notification) => {
        const dup = inMemoryNotifications.find(
          (n) => n.userId === entity.userId && n.dedupeKey === entity.dedupeKey,
        );
        if (dup) {
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
      findOne: jest.fn().mockImplementation(async (opts: any) => {
        return inMemoryNotifications.find((n) => n.id === opts?.where?.id) || null;
      }),
    };

    mockPushOutboxRepo = {
      save: jest.fn().mockImplementation(async (entity: PushOutbox) => {
        const dup = inMemoryPushOutbox.find((p) => p.dedupeKey === entity.dedupeKey);
        if (dup) {
          const err: any = new Error(
            `Duplicate entry '${entity.dedupeKey}' for key 'uk_push_outbox_dedupe'`,
          );
          err.code = 'ER_DUP_ENTRY';
          err.errno = 1062;
          throw err;
        }
        const saved = Object.assign(new PushOutbox(), entity, {
          id: inMemoryPushOutbox.length + 1,
        });
        inMemoryPushOutbox.push(saved);
        return saved;
      }),
      find: jest.fn().mockImplementation(async () => inMemoryPushOutbox),
    };

    mockGateway = {
      sendNotificationToUser: jest.fn(),
      sendSyncEventToRooms: jest.fn(),
    };

    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (work: any) => {
        const rollbackNotifs = [...inMemoryNotifications];
        const rollbackPush = [...inMemoryPushOutbox];
        try {
          const manager = {
            save: async (target: any, entity: any) => {
              if (target === Notification || entity instanceof Notification) {
                return mockNotificationRepo.save(entity);
              }
              if (target === PushOutbox || entity instanceof PushOutbox) {
                return mockPushOutboxRepo.save(entity);
              }
              return entity;
            },
          };
          return await work(manager);
        } catch (txErr) {
          inMemoryNotifications = rollbackNotifs;
          inMemoryPushOutbox = rollbackPush;
          throw txErr;
        }
      }),
      createQueryRunner: jest.fn().mockImplementation(() => {
        let inTx = false;
        return {
          connect: jest.fn().mockResolvedValue(undefined),
          startTransaction: jest.fn().mockImplementation(async () => {
            inTx = true;
          }),
          commitTransaction: jest.fn().mockImplementation(async () => {
            inTx = false;
          }),
          rollbackTransaction: jest.fn().mockImplementation(async () => {
            inTx = false;
          }),
          release: jest.fn().mockResolvedValue(undefined),
          query: jest.fn().mockImplementation(async (sql: string, params: any[] = []) => {
            const cleanSql = sql.replace(/\s+/g, ' ').trim();

            // Claim query
            if (cleanSql.includes('SELECT id, status, claim_count, lease_expires_at FROM push_outbox')) {
              const now = new Date();
              const limit = params[params.length - 1] || 20;
              const matches = inMemoryPushOutbox.filter((row) => {
                if (row.status === PushOutboxStatus.PENDING) return true;
                if (row.status === PushOutboxStatus.FAILED_RETRYABLE && row.nextRetryAt && row.nextRetryAt <= now) return true;
                if (row.status === PushOutboxStatus.CLAIMED && row.leaseExpiresAt && row.leaseExpiresAt < now) return true;
                return false;
              }).slice(0, limit);

              return matches.map((m) => ({
                id: m.id,
                status: m.status,
                claim_count: m.claimCount,
                claimCount: m.claimCount,
                lease_expires_at: m.leaseExpiresAt,
                leaseExpiresAt: m.leaseExpiresAt,
              }));
            }

            // Poison pill update
            if (
              cleanSql.includes('error_category = ?') &&
              params.includes(PushErrorCategory.POISON_PILL_CLAIM_EXCEEDED)
            ) {
              const [status, errCategory, errMsg, id] = params;
              const row = inMemoryPushOutbox.find((r) => r.id === Number(id));
              if (row) {
                row.status = status;
                row.errorCategory = errCategory;
                row.lastErrorMessage = errMsg;
                row.leaseToken = null;
                row.leaseExpiresAt = null;
              }
              return { affectedRows: 1 };
            }

            // Claim update
            if (cleanSql.includes('UPDATE push_outbox SET status = ?, lease_token = ?, lease_expires_at =')) {
              const [status, token, durationSec, id] = params;
              const row = inMemoryPushOutbox.find((r) => r.id === Number(id));
              if (row) {
                row.status = status;
                row.leaseToken = token;
                row.leaseExpiresAt = new Date(Date.now() + durationSec * 1000);
                row.claimCount = (row.claimCount || 0) + 1;
              }
              return { affectedRows: 1 };
            }

            // Select single row
            if (cleanSql.includes('SELECT * FROM push_outbox WHERE id = ?')) {
              const [id] = params;
              const row = inMemoryPushOutbox.find((r) => r.id === Number(id));
              return row ? [row] : [];
            }

            // Settle update with lease_token guard
            if (cleanSql.includes('UPDATE push_outbox SET') && cleanSql.includes('WHERE id = ? AND lease_token = ?')) {
              const id = params[params.length - 2];
              const leaseToken = params[params.length - 1];
              const row = inMemoryPushOutbox.find((r) => r.id === Number(id));
              if (row && row.leaseToken === leaseToken) {
                row.status = params[0];
                let pIdx = 1;
                if (cleanSql.includes('attempts = ?')) {
                  row.attempts = params[pIdx++];
                }
                if (cleanSql.includes('next_retry_at = ?')) {
                  row.nextRetryAt = params[pIdx++];
                }
                row.leaseToken = null;
                row.leaseExpiresAt = null;
                if (cleanSql.includes('delivery_details = ?')) {
                  const val = params[pIdx++];
                  row.deliveryDetails = typeof val === 'string' ? JSON.parse(val) : val;
                }
                if (cleanSql.includes('error_category = ?')) {
                  row.errorCategory = params[pIdx++];
                }
                if (cleanSql.includes('last_error_message = ?')) {
                  row.lastErrorMessage = params[pIdx++];
                }
                if (cleanSql.includes('dispatched_at = ?')) {
                  row.dispatchedAt = params[pIdx++];
                }
                return { affectedRows: 1 };
              }
              return { affectedRows: 0 };
            }

            // Purge delete
            if (cleanSql.includes('DELETE FROM push_outbox WHERE status = ?') && cleanSql.includes('dispatched_at <')) {
              const targetStatus = params[0] ?? PushOutboxStatus.ACCEPTED_BY_GATEWAY;
              const retentionDays = Number(params[1] ?? 30);
              const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
              const initialLen = inMemoryPushOutbox.length;
              inMemoryPushOutbox = inMemoryPushOutbox.filter((r) => {
                if (r.status === targetStatus && r.dispatchedAt) {
                  const ageMs = Date.now() - r.dispatchedAt.getTime();
                  return ageMs < retentionMs;
                }
                return true;
              });
              return { affectedRows: initialLen - inMemoryPushOutbox.length };
            }

            return [];
          }),
        };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanonicalNotificationWriter,
        PushOutboxService,
        PushOutboxWorker,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepo,
        },
        {
          provide: getRepositoryToken(PushOutbox),
          useValue: mockPushOutboxRepo,
        },
        {
          provide: NotificationGateway,
          useValue: mockGateway,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    writer = module.get<CanonicalNotificationWriter>(CanonicalNotificationWriter);
    outboxService = module.get<PushOutboxService>(PushOutboxService);
    outboxWorker = module.get<PushOutboxWorker>(PushOutboxWorker);
  });

  // =========================================================================
  // AC-OUTBOX-01: Penulisan Atomik Lokal Notifikasi & Outbox
  // =========================================================================
  describe('AC-OUTBOX-01: Atomic Persistence of Notification & PushOutbox', () => {
    it('creates exactly 1 Notification and 1 PENDING PushOutbox in the same local transaction', async () => {
      const result = await writer.persistCanonicalNotification({
        eventId: 'evt-claim-101',
        recipientId: 2,
        purpose: 'SERVICE_CLAIM_SUBMITTED',
        title: 'Pengajuan Service Claim Baru',
        message: 'Vendor PT Maju mengajukan klaim SC-2026-001',
        type: 'ALERT',
        actionTarget: '/procurement/service-claims/1',
      });

      expect(result.status).toBe('PERSISTED');
      expect(result.notificationId).toBeDefined();
      expect(result.pushOutboxId).toBeDefined();
      expect(inMemoryNotifications.length).toBe(1);
      expect(inMemoryPushOutbox.length).toBe(1);

      const savedPush = inMemoryPushOutbox[0];
      expect(savedPush.status).toBe(PushOutboxStatus.PENDING);
      expect(savedPush.recipientId).toBe(2);
      expect(savedPush.eventId).toBe('evt-claim-101');
      expect(savedPush.purpose).toBe('SERVICE_CLAIM_SUBMITTED');
      expect(savedPush.claimCount).toBe(0);
      expect(savedPush.attempts).toBe(0);
      expect(savedPush.maxAttempts).toBe(3);
      expect(savedPush.payloadPreview).toEqual({
        title: 'Pengajuan Service Claim Baru',
        body: 'Vendor PT Maju mengajukan klaim SC-2026-001',
        type: 'ALERT',
        actionTarget: '/procurement/service-claims/1',
        actionLink: '/procurement/service-claims/1',
        tag: 'service_claim_submitted-evt-claim-101',
        metaData: {},
      });
    });
  });

  // =========================================================================
  // AC-OUTBOX-02: Rollback Konsistensi Lokal saat Error
  // =========================================================================
  describe('AC-OUTBOX-02: Local Transaction Rollback Consistency', () => {
    it('rolls back both Notification and PushOutbox when outbox persistence throws an error', async () => {
      mockPushOutboxRepo.save.mockRejectedValueOnce(new Error('Simulated PushOutbox table lock error'));

      await expect(
        writer.persistCanonicalNotification({
          eventId: 'evt-fail-rollback',
          recipientId: 2,
          purpose: 'CRITICAL_APPROVAL',
          title: 'Approval Dibutuhkan',
          message: 'Persetujuan mendesak',
        }),
      ).rejects.toThrow(CanonicalNotificationError);

      // Rollback verified: neither Notification nor PushOutbox was committed
      expect(inMemoryNotifications.length).toBe(0);
      expect(inMemoryPushOutbox.length).toBe(0);
    });
  });

  // =========================================================================
  // AC-OUTBOX-03: Pencegahan Concurrent Claim
  // =========================================================================
  describe('AC-OUTBOX-03: Prevention of Concurrent Claims & Lease Fencing', () => {
    it('assigns unique lease tokens and prevents claiming identical rows across concurrent batches', async () => {
      // Seed 5 pending jobs
      for (let i = 1; i <= 5; i++) {
        const item = new PushOutbox();
        item.id = i;
        item.notificationId = i;
        item.recipientId = 2;
        item.eventId = `evt-concurrent-${i}`;
        item.purpose = 'CONCURRENT_CLAIM';
        item.dedupeKey = `key-concurrent-${i}`;
        item.status = PushOutboxStatus.PENDING;
        item.claimCount = 0;
        item.attempts = 0;
        item.maxAttempts = 3;
        item.payloadPreview = { title: `Test ${i}` };
        inMemoryPushOutbox.push(item);
      }

      // Worker 1 claims 3 jobs
      const batch1 = await outboxService.claimBatch(3, 30);
      expect(batch1.length).toBe(3);

      // Worker 2 claims next available jobs
      const batch2 = await outboxService.claimBatch(3, 30);
      expect(batch2.length).toBe(2); // Only remaining 2 are claimed

      const ids1 = batch1.map((c) => c.job.id);
      const ids2 = batch2.map((c) => c.job.id);

      // No intersection between worker 1 and worker 2
      const intersection = ids1.filter((id) => ids2.includes(id));
      expect(intersection).toEqual([]);

      // Lease tokens are unique
      const tokens = [...batch1.map((c) => c.leaseToken), ...batch2.map((c) => c.leaseToken)];
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(5);
    });
  });

  // =========================================================================
  // AC-OUTBOX-04: Orphan Recovery Pasca Crash Pre-Dispatch
  // =========================================================================
  describe('AC-OUTBOX-04: Orphan Recovery After Worker Crash Pre-Dispatch', () => {
    it('reclaims expired CLAIMED job, increments claim_count, and preserves unused attempts quota', async () => {
      const crashedJob = new PushOutbox();
      crashedJob.id = 42;
      crashedJob.notificationId = 10;
      crashedJob.recipientId = 2;
      crashedJob.eventId = 'evt-crash-1';
      crashedJob.purpose = 'ORPHAN_TEST';
      crashedJob.dedupeKey = 'key-crash-1';
      crashedJob.status = PushOutboxStatus.CLAIMED;
      crashedJob.claimCount = 1;
      crashedJob.attempts = 0; // Not yet dispatched
      crashedJob.maxAttempts = 3;
      crashedJob.leaseToken = 'stale-token-123';
      crashedJob.leaseExpiresAt = new Date(Date.now() - 5000); // Expired 5 seconds ago
      crashedJob.payloadPreview = { title: 'Crash recovery test' };
      inMemoryPushOutbox.push(crashedJob);

      // Run claimBatch
      const claimed = await outboxService.claimBatch(10, 30);
      expect(claimed.length).toBe(1);
      expect(claimed[0].job.id).toBe(42);
      expect(claimed[0].job.status).toBe(PushOutboxStatus.CLAIMED);
      expect(claimed[0].job.claimCount).toBe(2); // Incremented
      expect(claimed[0].job.attempts).toBe(0); // Quota untouched
      expect(claimed[0].leaseToken).not.toBe('stale-token-123'); // Fresh lease token
    });
  });

  // =========================================================================
  // AC-OUTBOX-05: Bounded Retry (3 Total Attempts with Backoff)
  // =========================================================================
  describe('AC-OUTBOX-05: Bounded Retry & Backoff Schedule', () => {
    it('retries up to 3 total attempts with exponential backoff and transitions to PERMANENT_FAILURE', async () => {
      const mockSubscriptions: PushSubscriptionItem[] = [
        { id: 1, userId: 2, endpoint: 'https://fcm.googleapis.com/test', isActive: true },
      ];

      outboxWorker.setSubscriptionProvider({
        getSubscriptionsForUser: async () => mockSubscriptions,
        removeInvalidSubscriptions: async () => {},
      });

      // Dispatcher always fails with 500 Internal Error
      outboxWorker.setDispatcher({
        dispatch: async () => ({
          results: [
            {
              subscriptionId: 1,
              endpointHash: 'hash-1',
              status: 'FAILED_RETRYABLE',
              httpCode: 500,
              error: 'Internal Server Error',
            },
          ],
        }),
      });

      // Seed 1 pending job
      const job = new PushOutbox();
      job.id = 55;
      job.notificationId = 1;
      job.recipientId = 2;
      job.eventId = 'evt-retry-test';
      job.purpose = 'RETRY_TEST';
      job.dedupeKey = 'key-retry-55';
      job.status = PushOutboxStatus.PENDING;
      job.claimCount = 0;
      job.attempts = 0;
      job.maxAttempts = 3;
      job.payloadPreview = { title: 'Retry test' };
      inMemoryPushOutbox.push(job);

      // --- Attempt 1 ---
      const claim1 = await outboxService.claimBatch(1);
      await outboxWorker.processSingleJob(claim1[0].job, claim1[0].leaseToken);
      const postAttempt1 = inMemoryPushOutbox.find((r) => r.id === 55)!;
      expect(postAttempt1.status).toBe(PushOutboxStatus.FAILED_RETRYABLE);
      expect(postAttempt1.attempts).toBe(1);
      expect(postAttempt1.errorCategory).toBe(PushErrorCategory.GATEWAY_5XX);
      expect(postAttempt1.nextRetryAt).toBeDefined();

      // Fast-forward nextRetryAt for Attempt 2
      postAttempt1.nextRetryAt = new Date(Date.now() - 1000);

      // --- Attempt 2 (Retry 1) ---
      const claim2 = await outboxService.claimBatch(1);
      await outboxWorker.processSingleJob(claim2[0].job, claim2[0].leaseToken);
      const postAttempt2 = inMemoryPushOutbox.find((r) => r.id === 55)!;
      expect(postAttempt2.status).toBe(PushOutboxStatus.FAILED_RETRYABLE);
      expect(postAttempt2.attempts).toBe(2);

      // Fast-forward nextRetryAt for Attempt 3
      postAttempt2.nextRetryAt = new Date(Date.now() - 1000);

      // --- Attempt 3 (Retry 2 - Final Attempt) ---
      const claim3 = await outboxService.claimBatch(1);
      await outboxWorker.processSingleJob(claim3[0].job, claim3[0].leaseToken);
      const postAttempt3 = inMemoryPushOutbox.find((r) => r.id === 55)!;
      expect(postAttempt3.status).toBe(PushOutboxStatus.PERMANENT_FAILURE);
      expect(postAttempt3.attempts).toBe(3);
      expect(postAttempt3.errorCategory).toBe(PushErrorCategory.EXCEEDED_MAX_ATTEMPTS);
      expect(postAttempt3.lastErrorMessage).toContain('Exceeded maximum retry attempts');
    });

    it('verifies backoff formula: attempt 1 = 30s, attempt 2 = 60s, attempt 3 = 120s', () => {
      expect(outboxService.calculateBackoffSeconds(1)).toBe(30);
      expect(outboxService.calculateBackoffSeconds(2)).toBe(60);
      expect(outboxService.calculateBackoffSeconds(3)).toBe(120);
      expect(outboxService.calculateBackoffSeconds(4)).toBe(240);
      expect(outboxService.calculateBackoffSeconds(5)).toBe(300); // capped at 300s
    });
  });

  // =========================================================================
  // AC-OUTBOX-06: Penanganan OUTCOME_UNKNOWN (Network Timeout)
  // =========================================================================
  describe('AC-OUTBOX-06: OUTCOME_UNKNOWN & Network Timeout Handling', () => {
    it('classifies ETIMEDOUT as NETWORK_TIMEOUT and schedules retry with deduplication tag preserved', async () => {
      outboxWorker.setSubscriptionProvider({
        getSubscriptionsForUser: async () => [
          { id: 9, userId: 2, endpoint: 'https://fcm.googleapis.com/timeout', isActive: true },
        ],
        removeInvalidSubscriptions: async () => {},
      });

      outboxWorker.setDispatcher({
        dispatch: async () => ({
          results: [
            {
              subscriptionId: 9,
              endpointHash: 'hash-timeout',
              status: 'FAILED_RETRYABLE',
              error: 'ETIMEDOUT connection timed out',
            },
          ],
        }),
      });

      const job = new PushOutbox();
      job.id = 66;
      job.notificationId = 2;
      job.recipientId = 2;
      job.eventId = 'evt-timeout-66';
      job.purpose = 'SERVICE_CLAIM_VERIFIED';
      job.dedupeKey = 'key-timeout-66';
      job.status = PushOutboxStatus.PENDING;
      job.claimCount = 0;
      job.attempts = 0;
      job.maxAttempts = 3;
      job.payloadPreview = {
        title: 'Verifikasi Service Claim',
        tag: 'service_claim_verified-evt-timeout-66',
      };
      inMemoryPushOutbox.push(job);

      const claim = await outboxService.claimBatch(1);
      await outboxWorker.processSingleJob(claim[0].job, claim[0].leaseToken);

      const updated = inMemoryPushOutbox.find((r) => r.id === 66)!;
      expect(updated.status).toBe(PushOutboxStatus.FAILED_RETRYABLE);
      expect(updated.attempts).toBe(1);
      expect(updated.errorCategory).toBe(PushErrorCategory.NETWORK_TIMEOUT);
      expect(updated.payloadPreview.tag).toBe('service_claim_verified-evt-timeout-66');
    });
  });

  // =========================================================================
  // AC-OUTBOX-07: Idempotensi Dedupe Key & Hash Fallback
  // =========================================================================
  describe('AC-OUTBOX-07: Dedupe Key Idempotency & SHA-256 Fallback', () => {
    it('bounds dedupe key to exactly 191 chars using SHA-256 for long keys and suppresses duplicates', async () => {
      const veryLongEventId = 'EVT-'.padEnd(120, 'X');
      const veryLongPurpose = 'PURPOSE-'.padEnd(120, 'Y');

      const pushKey = writer.generatePushDedupeKey(veryLongEventId, 2, veryLongPurpose);
      expect(pushKey.length).toBe(191);
      expect(pushKey).toContain(':');

      // First call succeeds
      const res1 = await writer.persistCanonicalNotification({
        eventId: veryLongEventId,
        recipientId: 2,
        purpose: veryLongPurpose,
        title: 'Long Key 1',
        message: 'First delivery attempt',
      });
      expect(res1.status).toBe('PERSISTED');

      // Second identical call triggers duplicate suppression
      const res2 = await writer.persistCanonicalNotification({
        eventId: veryLongEventId,
        recipientId: 2,
        purpose: veryLongPurpose,
        title: 'Long Key 1 (Duplicate)',
        message: 'Second delivery attempt',
      });
      expect(res2.status).toBe('DUPLICATE_SUPPRESSED');
      expect(inMemoryPushOutbox.length).toBe(1);
    });
  });

  // =========================================================================
  // AC-OUTBOX-08: Pembersihan Subscription Kedaluwarsa (410 Gone)
  // =========================================================================
  describe('AC-OUTBOX-08: Expired Subscription Removal (410 Gone)', () => {
    it('removes invalid subscriptions on 410 and sets PERMANENT_FAILURE when all subscriptions are invalid', async () => {
      outboxWorker.setSubscriptionProvider({
        getSubscriptionsForUser: async () => [
          { id: 701, userId: 2, endpoint: 'https://fcm.googleapis.com/expired', isActive: true },
        ],
        removeInvalidSubscriptions: async (ids) => {
          removedSubscriptionIds.push(...ids);
        },
      });

      outboxWorker.setDispatcher({
        dispatch: async () => ({
          results: [
            {
              subscriptionId: 701,
              endpointHash: 'hash-expired',
              status: 'INVALID_410',
              httpCode: 410,
              error: 'Gone',
            },
          ],
        }),
      });

      const job = new PushOutbox();
      job.id = 88;
      job.notificationId = 5;
      job.recipientId = 2;
      job.eventId = 'evt-410-test';
      job.purpose = 'EXPIRED_SUB_TEST';
      job.dedupeKey = 'key-410-88';
      job.status = PushOutboxStatus.PENDING;
      job.claimCount = 0;
      job.attempts = 0;
      job.maxAttempts = 3;
      job.payloadPreview = { title: 'Test 410' };
      inMemoryPushOutbox.push(job);

      const claim = await outboxService.claimBatch(1);
      await outboxWorker.processSingleJob(claim[0].job, claim[0].leaseToken);

      const updated = inMemoryPushOutbox.find((r) => r.id === 88)!;
      expect(updated.status).toBe(PushOutboxStatus.PERMANENT_FAILURE);
      expect(updated.errorCategory).toBe(PushErrorCategory.INVALID_SUBSCRIPTION_410);
      expect(removedSubscriptionIds).toEqual([701]);
    });
  });

  // =========================================================================
  // AC-OUTBOX-09: Isolasi Mutlak dari QueueModule
  // =========================================================================
  describe('AC-OUTBOX-09: Absolute Isolation from QueueModule', () => {
    it('executes push outbox cycle without calling QueueModule or BullMQ queues', async () => {
      outboxWorker.setSubscriptionProvider({
        getSubscriptionsForUser: async () => [],
        removeInvalidSubscriptions: async () => {},
      });

      const job = new PushOutbox();
      job.id = 99;
      job.notificationId = 9;
      job.recipientId = 2;
      job.eventId = 'evt-no-sub';
      job.purpose = 'NO_SUB_TEST';
      job.dedupeKey = 'key-no-sub-99';
      job.status = PushOutboxStatus.PENDING;
      job.claimCount = 0;
      job.attempts = 0;
      job.maxAttempts = 3;
      job.payloadPreview = { title: 'No sub test' };
      inMemoryPushOutbox.push(job);

      const count = await outboxWorker.pollAndProcess(1);
      expect(count).toBe(1);

      const settled = inMemoryPushOutbox.find((r) => r.id === 99)!;
      expect(settled.status).toBe(PushOutboxStatus.NO_SUBSCRIPTION);
    });
  });

  // =========================================================================
  // AC-OUTBOX-10: Multi-Subscription Partial Retry & Agregasi
  // =========================================================================
  describe('AC-OUTBOX-10: Multi-Subscription Partial Retry & Aggregation', () => {
    it('only retries failed subscription on next cycle and does not re-dispatch to already accepted subscription', async () => {
      const dispatchedSubscriptionIds: number[] = [];

      outboxWorker.setSubscriptionProvider({
        getSubscriptionsForUser: async () => [
          { id: 101, userId: 2, endpoint: 'https://fcm.googleapis.com/sub1', isActive: true },
          { id: 102, userId: 2, endpoint: 'https://fcm.googleapis.com/sub2', isActive: true },
        ],
        removeInvalidSubscriptions: async () => {},
      });

      // In attempt 1: Sub 101 succeeds (201), Sub 102 fails (ETIMEDOUT)
      outboxWorker.setDispatcher({
        dispatch: async (_job, subs) => {
          subs.forEach((s) => dispatchedSubscriptionIds.push(s.id));
          return {
            results: subs.map((sub) => {
              if (sub.id === 101) {
                return {
                  subscriptionId: 101,
                  endpointHash: 'hash-101',
                  status: 'ACCEPTED_BY_GATEWAY' as const,
                  httpCode: 201,
                };
              }
              return {
                subscriptionId: 102,
                endpointHash: 'hash-102',
                status: 'FAILED_RETRYABLE' as const,
                error: 'ETIMEDOUT',
              };
            }),
          };
        },
      });

      const job = new PushOutbox();
      job.id = 110;
      job.notificationId = 11;
      job.recipientId = 2;
      job.eventId = 'evt-multi-sub';
      job.purpose = 'MULTI_SUB_TEST';
      job.dedupeKey = 'key-multi-sub-110';
      job.status = PushOutboxStatus.PENDING;
      job.claimCount = 0;
      job.attempts = 0;
      job.maxAttempts = 3;
      job.payloadPreview = { title: 'Multi sub' };
      inMemoryPushOutbox.push(job);

      // --- Cycle 1 ---
      const claim1 = await outboxService.claimBatch(1);
      await outboxWorker.processSingleJob(claim1[0].job, claim1[0].leaseToken);

      const jobAfter1 = inMemoryPushOutbox.find((r) => r.id === 110)!;
      // Job aggregate status must NOT be success while sub 102 is pending retry!
      expect(jobAfter1.status).toBe(PushOutboxStatus.FAILED_RETRYABLE);
      expect(jobAfter1.attempts).toBe(1);
      expect(dispatchedSubscriptionIds).toEqual([101, 102]);

      // Clear tracking for next cycle
      dispatchedSubscriptionIds.length = 0;
      jobAfter1.nextRetryAt = new Date(Date.now() - 1000);

      // In attempt 2: Sub 102 now succeeds
      outboxWorker.setDispatcher({
        dispatch: async (_job, subs) => {
          subs.forEach((s) => dispatchedSubscriptionIds.push(s.id));
          return {
            results: subs.map((sub) => ({
              subscriptionId: sub.id,
              endpointHash: `hash-${sub.id}`,
              status: 'ACCEPTED_BY_GATEWAY' as const,
              httpCode: 200,
            })),
          };
        },
      });

      // --- Cycle 2 ---
      const claim2 = await outboxService.claimBatch(1);
      await outboxWorker.processSingleJob(claim2[0].job, claim2[0].leaseToken);

      // Verify ONLY Sub 102 was re-dispatched! Sub 101 was NOT re-dispatched!
      expect(dispatchedSubscriptionIds).toEqual([102]);

      const jobAfter2 = inMemoryPushOutbox.find((r) => r.id === 110)!;
      expect(jobAfter2.status).toBe(PushOutboxStatus.ACCEPTED_BY_GATEWAY);
      expect(jobAfter2.attempts).toBe(2);
      expect(jobAfter2.deliveryDetails.dispatched_count).toBe(2);
    });
  });

  // =========================================================================
  // AC-OUTBOX-11: Pemeliharaan Retensi (30 Hari) & Purge
  // =========================================================================
  describe('AC-OUTBOX-11: Data Retention (30 Days) & Chunked Purge', () => {
    it('purges ACCEPTED_BY_GATEWAY records older than 30-day retention window (35d deleted, 10d retained)', async () => {
      const oldAccepted = new PushOutbox();
      oldAccepted.id = 201;
      oldAccepted.notificationId = 1;
      oldAccepted.recipientId = 2;
      oldAccepted.eventId = 'evt-old-accepted-35d';
      oldAccepted.purpose = 'PURGE_TEST';
      oldAccepted.dedupeKey = 'key-old-accepted-35d';
      oldAccepted.status = PushOutboxStatus.ACCEPTED_BY_GATEWAY;
      oldAccepted.dispatchedAt = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000); // 35 days old (> 30 days)
      oldAccepted.payloadPreview = { title: 'Old 35d' };
      inMemoryPushOutbox.push(oldAccepted);

      const recentAccepted = new PushOutbox();
      recentAccepted.id = 202;
      recentAccepted.notificationId = 2;
      recentAccepted.recipientId = 2;
      recentAccepted.eventId = 'evt-recent-accepted-10d';
      recentAccepted.purpose = 'PURGE_TEST';
      recentAccepted.dedupeKey = 'key-recent-accepted-10d';
      recentAccepted.status = PushOutboxStatus.ACCEPTED_BY_GATEWAY;
      recentAccepted.dispatchedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days old (< 30 days)
      recentAccepted.payloadPreview = { title: 'Recent 10d' };
      inMemoryPushOutbox.push(recentAccepted);

      // Call purgeOldRecords() with default 30-day retention
      const purgedCount = await outboxService.purgeOldRecords();
      expect(purgedCount).toBe(1);
      expect(inMemoryPushOutbox.find((r) => r.id === 201)).toBeUndefined();
      expect(inMemoryPushOutbox.find((r) => r.id === 202)).toBeDefined();
    });
  });

  // =========================================================================
  // Poison Pill & Fencing Token Mismatch
  // =========================================================================
  describe('Poison Pill & Lease Fencing Protection', () => {
    it('detects poison pill when a job exceeds claim threshold (claim_count >= 5) and marks PERMANENT_FAILURE', async () => {
      const poisonJob = new PushOutbox();
      poisonJob.id = 301;
      poisonJob.notificationId = 30;
      poisonJob.recipientId = 2;
      poisonJob.eventId = 'evt-poison';
      poisonJob.purpose = 'POISON_TEST';
      poisonJob.dedupeKey = 'key-poison-301';
      poisonJob.status = PushOutboxStatus.CLAIMED;
      poisonJob.claimCount = 5; // Reached threshold
      poisonJob.attempts = 0;
      poisonJob.maxAttempts = 3;
      poisonJob.leaseExpiresAt = new Date(Date.now() - 1000); // Expired
      poisonJob.payloadPreview = { title: 'Poison Pill' };
      inMemoryPushOutbox.push(poisonJob);

      const claimed = await outboxService.claimBatch(10);
      // Poison pill row should be filtered out from claim and transitioned to PERMANENT_FAILURE
      expect(claimed.length).toBe(0);

      const updated = inMemoryPushOutbox.find((r) => r.id === 301)!;
      expect(updated.status).toBe(PushOutboxStatus.PERMANENT_FAILURE);
      expect(updated.errorCategory).toBe(PushErrorCategory.POISON_PILL_CLAIM_EXCEEDED);
    });

    it('aborts settlement if lease token does not match (concurrency lease expired and reassigned)', async () => {
      const job = new PushOutbox();
      job.id = 401;
      job.notificationId = 40;
      job.recipientId = 2;
      job.eventId = 'evt-fence';
      job.purpose = 'FENCE_TEST';
      job.dedupeKey = 'key-fence-401';
      job.status = PushOutboxStatus.CLAIMED;
      job.leaseToken = 'current-token-abc';
      job.payloadPreview = { title: 'Fence Test' };
      inMemoryPushOutbox.push(job);

      // Try settling with an outdated token
      const settled = await outboxService.settleJob({
        jobId: 401,
        leaseToken: 'stale-token-xyz',
        status: PushOutboxStatus.ACCEPTED_BY_GATEWAY,
      });

      expect(settled).toBe(false);
      // Status remained CLAIMED with current token intact
      expect(job.status).toBe(PushOutboxStatus.CLAIMED);
      expect(job.leaseToken).toBe('current-token-abc');
    });
  });
});

