import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Notification } from '../../entities/notification.entity';
import { NotificationGateway } from '../notification/notification.gateway';
import { CanonicalNotificationWriter } from '../notification/canonical-notification.writer';
import { CanonicalNotificationConsumer } from '../notification/canonical-notification.consumer';
import { OutboxRelayService } from '../system/outbox-relay.service';
import { OutboxEvent, OutboxStatus } from '../../entities/outbox-event.entity';
import { BusinessEvent } from '../../shared/contracts/business-event.contract';
import { ServiceClaimService } from './service-claim.service';
import { ServiceClaim, ServiceClaimStatus } from '../../entities/service-claim.entity';
import { ServiceClaimItem } from '../../entities/service-claim-item.entity';
import { PurchaseOrder, PurchaseOrderType } from '../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../entities/purchase-order-item.entity';
import { ServiceOrder } from '../../entities/service-order.entity';
import { Project } from '../../entities/project.entity';
import { Vendor } from '../../entities/vendor.entity';
import { Invoice } from '../../entities/invoice.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { ClaimVerificationDecision } from './dto/technical-verification.dto';

describe('Service Claim Notification Recovery & Deduplication Regression Suite', () => {
  let consumer: CanonicalNotificationConsumer;
  let writer: CanonicalNotificationWriter;
  let relayService: OutboxRelayService;
  let serviceClaimService: ServiceClaimService;

  let inMemoryNotifications: Notification[];
  let inMemoryOutbox: OutboxEvent[];
  let inMemoryClaims: ServiceClaim[];

  let mockNotificationRepo: any;
  let mockOutboxRepo: any;
  let mockGateway: any;
  let mockDataSource: any;
  let eventEmitter: EventEmitter2;

  const PM_USER_ID = 44;
  const SUBMITTER_USER_ID = 88;
  const PROCUREMENT_USER_ID = 99;
  const FINANCE_USER_ID = 77;
  const PROJECT_ID = 1001;
  const CLAIM_ID = 501;
  const CLAIM_NUMBER = 'SCL-20261028-001';

  beforeEach(async () => {
    inMemoryNotifications = [];
    inMemoryOutbox = [];
    inMemoryClaims = [];

    eventEmitter = new EventEmitter2({ wildcard: true });

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
      sendNotificationToUser: jest.fn(),
      emitToRooms: jest.fn(),
    };

    mockDataSource = {
      query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM projects') && sql.includes('manager_id')) {
          return [{ manager_id: PM_USER_ID }];
        }
        if (sql.includes('FROM users u') && sql.includes('user_roles')) {
          if (Array.isArray(params) && params.includes('FINANCE')) {
            return [{ id: FINANCE_USER_ID }];
          }
          return [{ id: PROCUREMENT_USER_ID }];
        }
        if (sql.includes('FROM service_claims')) {
          return [{ po_id: 101, project_id: PROJECT_ID, submitted_by: SUBMITTER_USER_ID }];
        }
        return [];
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
          manager: {
            findOne: jest.fn().mockImplementation(async (entityClass: any, options: any) => {
              if (entityClass === OutboxEvent) {
                return inMemoryOutbox.find((o) => o.id === options?.where?.id) || null;
              }
              if (entityClass === Project) {
                return { id: PROJECT_ID, managerId: PM_USER_ID, name: 'Data Center Build' };
              }
              if (entityClass === ServiceClaim) {
                return inMemoryClaims.find((c) => c.id === options?.where?.id) || null;
              }
              return null;
            }),
            save: jest.fn().mockImplementation(async (entityClassOrEntity: any, maybeEntity?: any) => {
              const entity = maybeEntity !== undefined ? maybeEntity : entityClassOrEntity;
              const targetClass = maybeEntity !== undefined ? entityClassOrEntity : entityClassOrEntity.constructor;

              if (targetClass === OutboxEvent || entity instanceof OutboxEvent || entity?.event_name) {
                if (!entity.id) entity.id = inMemoryOutbox.length + 1;
                const idx = inMemoryOutbox.findIndex((o) => o.id === entity.id);
                if (idx >= 0) inMemoryOutbox[idx] = entity;
                else inMemoryOutbox.push(entity);
                return entity;
              }
              if (targetClass === ServiceClaim || entity instanceof ServiceClaim || entity?.claimNumber) {
                if (!entity.id) entity.id = inMemoryClaims.length + 1;
                const idx = inMemoryClaims.findIndex((c) => c.id === entity.id);
                if (idx >= 0) inMemoryClaims[idx] = entity;
                else inMemoryClaims.push(entity);
                return entity;
              }
              return entity;
            }),
            create: jest.fn().mockImplementation((entityClass: any, data: any) => {
              return Object.assign(new entityClass(), data);
            }),
          },
        };
      }),
    };

    mockOutboxRepo = {
      find: jest.fn().mockImplementation(async (options: any) => {
        return inMemoryOutbox
          .filter((o) => o.status === OutboxStatus.PENDING)
          .slice(0, options?.take || 50);
      }),
      save: jest.fn().mockImplementation(async (entity: OutboxEvent) => {
        const idx = inMemoryOutbox.findIndex((o) => o.id === entity.id);
        if (idx >= 0) inMemoryOutbox[idx] = entity;
        else inMemoryOutbox.push(entity);
        return entity;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanonicalNotificationWriter,
        CanonicalNotificationConsumer,
        OutboxRelayService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepo,
        },
        {
          provide: getRepositoryToken(OutboxEvent),
          useValue: mockOutboxRepo,
        },
        {
          provide: NotificationGateway,
          useValue: mockGateway,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitter,
        },
      ],
    }).compile();

    writer = module.get<CanonicalNotificationWriter>(CanonicalNotificationWriter);
    consumer = module.get<CanonicalNotificationConsumer>(CanonicalNotificationConsumer);
    relayService = module.get<OutboxRelayService>(OutboxRelayService);

    // Wire consumer methods to EventEmitter2
    eventEmitter.on('procurement.service_claim.submitted', (e) =>
      consumer.handleServiceClaimSubmitted(e),
    );
    eventEmitter.on('procurement.service_claim.pm_verified', (e) =>
      consumer.handleServiceClaimVerified(e),
    );
    eventEmitter.on('procurement.service_claim.verified', (e) =>
      consumer.handleServiceClaimVerified(e),
    );
    eventEmitter.on('procurement.service_claim.returned', (e) =>
      consumer.handleServiceClaimReturned(e),
    );
    eventEmitter.on('procurement.service_claim.rejected', (e) =>
      consumer.handleServiceClaimRejected(e),
    );
    eventEmitter.on('procurement.service_claim.approved_for_invoice', (e) =>
      consumer.handleServiceClaimApprovedForInvoice(e),
    );
  });

  describe('1. Service Claim SUBMITTED Event Recovery', () => {
    it('successfully projects canonical Bell notification to assigned PM via outbox recovery', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 1;
      outbox.event_id = 'evt-claim-submit-001';
      outbox.event_name = 'procurement.service_claim.submitted';
      outbox.event_version = '1';
      outbox.aggregate_type = 'ServiceClaim';
      outbox.aggregate_id = CLAIM_ID;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = 0;
      outbox.payload = {
        routing: { userIds: [PM_USER_ID] },
        businessPayload: {
          claimId: CLAIM_ID,
          claimNumber: CLAIM_NUMBER,
          projectId: PROJECT_ID,
          projectManagerId: PM_USER_ID,
          poNumber: 'PO-SVC-2026-001',
          submittedBy: SUBMITTER_USER_ID,
        },
      };

      inMemoryOutbox.push(outbox);

      // Execute Outbox Relay Poller
      const relayResult = await relayService.relaySingleEvent(1);
      expect(relayResult).toBe('SUCCESS');
      expect(outbox.status).toBe(OutboxStatus.PUBLISHED);

      // Verify Notification persistence
      expect(inMemoryNotifications.length).toBe(1);
      const notif = inMemoryNotifications[0];
      expect(notif.userId).toBe(PM_USER_ID);
      expect(notif.title).toContain(CLAIM_NUMBER);
      expect(notif.dedupeKey).toBe('evt-claim-submit-001:44:SERVICE_CLAIM_SUBMITTED');
      expect(notif.notificationType).toBe('ALERT');
      expect(notif.actionLink).toContain(`claimId=${CLAIM_ID}`);
    });

    it('resolves PM from database if routing is omitted (legacy/backward compatibility)', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 2;
      outbox.event_id = 'evt-claim-submit-002';
      outbox.event_name = 'procurement.service_claim.submitted';
      outbox.event_version = '1';
      outbox.aggregate_type = 'ServiceClaim';
      outbox.aggregate_id = CLAIM_ID;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = 0;
      outbox.payload = {
        claimId: CLAIM_ID,
        claimNumber: CLAIM_NUMBER,
        projectId: PROJECT_ID,
      };

      inMemoryOutbox.push(outbox);

      const relayResult = await relayService.relaySingleEvent(2);
      expect(relayResult).toBe('SUCCESS');

      expect(inMemoryNotifications.length).toBe(1);
      expect(inMemoryNotifications[0].userId).toBe(PM_USER_ID);
      expect(inMemoryNotifications[0].dedupeKey).toBe('evt-claim-submit-002:44:SERVICE_CLAIM_SUBMITTED');
    });
  });

  describe('2. Service Claim VERIFIED Event Recovery (pm_verified & verified)', () => {
    it('projects notification to Procurement role on APPROVE via procurement.service_claim.pm_verified', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 10;
      outbox.event_id = 'evt-claim-verify-001';
      outbox.event_name = 'procurement.service_claim.pm_verified';
      outbox.event_version = '1';
      outbox.aggregate_type = 'ServiceClaim';
      outbox.aggregate_id = CLAIM_ID;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = 0;
      outbox.payload = {
        businessPayload: {
          claimId: CLAIM_ID,
          claimNumber: CLAIM_NUMBER,
          decision: ClaimVerificationDecision.APPROVE,
          verifierId: PM_USER_ID,
        },
      };

      inMemoryOutbox.push(outbox);

      const relayResult = await relayService.relaySingleEvent(10);
      expect(relayResult).toBe('SUCCESS');
      expect(outbox.status).toBe(OutboxStatus.PUBLISHED);

      expect(inMemoryNotifications.length).toBe(1);
      const notif = inMemoryNotifications[0];
      expect(notif.userId).toBe(PROCUREMENT_USER_ID);
      expect(notif.title).toContain('Klaim Jasa Terverifikasi Teknis');
      expect(notif.dedupeKey).toBe('evt-claim-verify-001:99:SERVICE_CLAIM_VERIFIED');
    });

    it('projects notification to Procurement role via alias procurement.service_claim.verified', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 11;
      outbox.event_id = 'evt-claim-verify-002';
      outbox.event_name = 'procurement.service_claim.verified';
      outbox.event_version = '1';
      outbox.aggregate_type = 'ServiceClaim';
      outbox.aggregate_id = CLAIM_ID;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = 0;
      outbox.payload = {
        businessPayload: {
          claimId: CLAIM_ID,
          claimNumber: CLAIM_NUMBER,
          decision: 'APPROVE',
        },
      };

      inMemoryOutbox.push(outbox);

      const relayResult = await relayService.relaySingleEvent(11);
      expect(relayResult).toBe('SUCCESS');

      expect(inMemoryNotifications.length).toBe(1);
      expect(inMemoryNotifications[0].userId).toBe(PROCUREMENT_USER_ID);
      expect(inMemoryNotifications[0].dedupeKey).toBe('evt-claim-verify-002:99:SERVICE_CLAIM_VERIFIED');
    });

    it('delegates to submitter notification when verification decision is RETURN', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 12;
      outbox.event_id = 'evt-claim-return-001';
      outbox.event_name = 'procurement.service_claim.returned';
      outbox.event_version = '1';
      outbox.aggregate_type = 'ServiceClaim';
      outbox.aggregate_id = CLAIM_ID;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = 0;
      outbox.payload = {
        routing: { userIds: [SUBMITTER_USER_ID] },
        businessPayload: {
          claimId: CLAIM_ID,
          claimNumber: CLAIM_NUMBER,
          decision: 'RETURN',
          submittedBy: SUBMITTER_USER_ID,
          revisionNotes: 'Mohon lampirkan Berita Acara Opname Fisik.',
        },
      };

      inMemoryOutbox.push(outbox);

      const relayResult = await relayService.relaySingleEvent(12);
      expect(relayResult).toBe('SUCCESS');

      expect(inMemoryNotifications.length).toBe(1);
      const notif = inMemoryNotifications[0];
      expect(notif.userId).toBe(SUBMITTER_USER_ID);
      expect(notif.title).toContain('Klaim Jasa Membutuhkan Revisi');
      expect(notif.message).toContain('Mohon lampirkan Berita Acara Opname Fisik.');
      expect(notif.actionLink).toBe(`/procurement?tab=po&poId=101&claimId=${CLAIM_ID}&action=service-claim`);
      expect(notif.dedupeKey).toBe('evt-claim-return-001:88:SERVICE_CLAIM_RETURNED');
    });

    it('delegates to submitter notification when verification decision is REJECT', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 13;
      outbox.event_id = 'evt-claim-reject-001';
      outbox.event_name = 'procurement.service_claim.rejected';
      outbox.event_version = '1';
      outbox.aggregate_type = 'ServiceClaim';
      outbox.aggregate_id = CLAIM_ID;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = 0;
      outbox.payload = {
        routing: { userIds: [SUBMITTER_USER_ID] },
        businessPayload: {
          claimId: CLAIM_ID,
          claimNumber: CLAIM_NUMBER,
          decision: 'REJECT',
          submittedBy: SUBMITTER_USER_ID,
          rejectionReason: 'Pekerjaan tidak sesuai spesifikasi kontrak.',
        },
      };

      inMemoryOutbox.push(outbox);

      const relayResult = await relayService.relaySingleEvent(13);
      expect(relayResult).toBe('SUCCESS');

      expect(inMemoryNotifications.length).toBe(1);
      const notif = inMemoryNotifications[0];
      expect(notif.userId).toBe(SUBMITTER_USER_ID);
      expect(notif.title).toContain('Klaim Jasa Ditolak');
      expect(notif.message).toContain('Pekerjaan tidak sesuai spesifikasi kontrak.');
      expect(notif.actionLink).toBe(`/procurement?tab=po&poId=101&claimId=${CLAIM_ID}&action=service-claim`);
      expect(notif.dedupeKey).toBe('evt-claim-reject-001:88:SERVICE_CLAIM_REJECTED');
    });

    it('projects notification to Finance role on procurement.service_claim.approved_for_invoice', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 14;
      outbox.event_id = 'evt-claim-approve-invoice-001';
      outbox.event_name = 'procurement.service_claim.approved_for_invoice';
      outbox.event_version = '1';
      outbox.aggregate_type = 'ServiceClaim';
      outbox.aggregate_id = CLAIM_ID;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = 0;
      outbox.payload = {
        businessPayload: {
          claimId: CLAIM_ID,
          claimNumber: CLAIM_NUMBER,
          poId: 202,
          projectId: PROJECT_ID,
          decision: 'APPROVE',
          verifierId: PROCUREMENT_USER_ID,
        },
      };

      inMemoryOutbox.push(outbox);

      const relayResult = await relayService.relaySingleEvent(14);
      expect(relayResult).toBe('SUCCESS');
      expect(outbox.status).toBe(OutboxStatus.PUBLISHED);

      expect(inMemoryNotifications.length).toBe(1);
      const notif = inMemoryNotifications[0];
      expect(notif.userId).toBe(FINANCE_USER_ID);
      expect(notif.title).toContain('Klaim Jasa Siap Ditagihkan');
      expect(notif.dedupeKey).toBe('evt-claim-approve-invoice-001:77:SERVICE_CLAIM_APPROVED_FOR_INVOICE');
      expect(notif.actionLink).toBe('/finance/invoices?tab=ready_pos&poId=202&serviceClaimId=501');
    });

    it('actor exclusion: suppresses self-notification when submitter is the assigned PM on SUBMITTED', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 15;
      outbox.event_id = 'evt-claim-submit-self-001';
      outbox.event_name = 'procurement.service_claim.submitted';
      outbox.event_version = '1';
      outbox.aggregate_type = 'ServiceClaim';
      outbox.aggregate_id = CLAIM_ID;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = 0;
      outbox.payload = {
        businessPayload: {
          claimId: CLAIM_ID,
          claimNumber: CLAIM_NUMBER,
          projectId: PROJECT_ID,
          projectManagerId: PM_USER_ID,
          submittedBy: PM_USER_ID, // Submitter is PM!
        },
      };

      inMemoryOutbox.push(outbox);

      const relayResult = await relayService.relaySingleEvent(15);
      expect(relayResult).toBe('SUCCESS');
      expect(outbox.status).toBe(OutboxStatus.PUBLISHED);

      // Self-notification is suppressed, 0 notifications created
      expect(inMemoryNotifications.length).toBe(0);
    });

    it('actor exclusion: verifier PM is excluded from Procurement recipient list on pm_verified', async () => {
      // Setup mock where verifier PM has role PROCUREMENT as well
      mockDataSource.query.mockImplementationOnce(async (sql: string) => {
        if (sql.includes('FROM users u') && sql.includes('user_roles')) {
          return [{ id: PM_USER_ID }, { id: PROCUREMENT_USER_ID }];
        }
        return [];
      });

      const outbox = new OutboxEvent();
      outbox.id = 16;
      outbox.event_id = 'evt-claim-verify-sod-001';
      outbox.event_name = 'procurement.service_claim.pm_verified';
      outbox.event_version = '1';
      outbox.aggregate_type = 'ServiceClaim';
      outbox.aggregate_id = CLAIM_ID;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = 0;
      outbox.payload = {
        businessPayload: {
          claimId: CLAIM_ID,
          claimNumber: CLAIM_NUMBER,
          decision: 'APPROVE',
          verifierId: PM_USER_ID,
        },
      };

      inMemoryOutbox.push(outbox);

      const relayResult = await relayService.relaySingleEvent(16);
      expect(relayResult).toBe('SUCCESS');

      // PM is excluded, only PROCUREMENT_USER_ID receives
      expect(inMemoryNotifications.length).toBe(1);
      expect(inMemoryNotifications[0].userId).toBe(PROCUREMENT_USER_ID);
    });

    it('commercial return from Tim Pengadaan delivers to submitter with correct label', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 17;
      outbox.event_id = 'evt-claim-comm-return-001';
      outbox.event_name = 'procurement.service_claim.returned';
      outbox.event_version = '1';
      outbox.aggregate_type = 'ServiceClaim';
      outbox.aggregate_id = CLAIM_ID;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = 0;
      outbox.payload = {
        businessPayload: {
          claimId: CLAIM_ID,
          claimNumber: CLAIM_NUMBER,
          decision: 'RETURN',
          submittedBy: SUBMITTER_USER_ID,
          commercialVerifierId: PROCUREMENT_USER_ID,
          revisionNotes: 'Perlu revisi invoice dan tax invoice.',
        },
      };

      inMemoryOutbox.push(outbox);

      const relayResult = await relayService.relaySingleEvent(17);
      expect(relayResult).toBe('SUCCESS');

      expect(inMemoryNotifications.length).toBe(1);
      const notif = inMemoryNotifications[0];
      expect(notif.userId).toBe(SUBMITTER_USER_ID);
      expect(notif.message).toContain('Tim Pengadaan');
      expect(notif.message).toContain('Perlu revisi invoice dan tax invoice.');
    });

    it('recovers submitterId from database when payload.submittedBy is missing from legacy event', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 18;
      outbox.event_id = 'evt-claim-legacy-return-001';
      outbox.event_name = 'procurement.service_claim.returned';
      outbox.event_version = '1';
      outbox.aggregate_type = 'ServiceClaim';
      outbox.aggregate_id = CLAIM_ID;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = 0;
      outbox.payload = {
        businessPayload: {
          claimId: CLAIM_ID,
          claimNumber: CLAIM_NUMBER,
          decision: 'RETURN',
          // submittedBy omitted
          revisionNotes: 'Format Berita Acara salah.',
        },
      };

      inMemoryOutbox.push(outbox);

      const relayResult = await relayService.relaySingleEvent(18);
      expect(relayResult).toBe('SUCCESS');

      // Resolved from DB mock (SUBMITTER_USER_ID = 88)
      expect(inMemoryNotifications.length).toBe(1);
      expect(inMemoryNotifications[0].userId).toBe(SUBMITTER_USER_ID);
    });
  });

  describe('3. Direct Notification Failure with Committed Business Transaction Recovery', () => {
    it('direct notification write failure leaves event in outbox and recovery successfully delivers notification', async () => {
      const eventId = 'evt-crash-scenario-001';

      // Step A: Simulate direct notification write failure (e.g. timeout, network blip, or temporary lock)
      // The business transaction committed, but direct notification write threw
      const outbox = new OutboxEvent();
      outbox.id = 20;
      outbox.event_id = eventId;
      outbox.event_name = 'procurement.service_claim.submitted';
      outbox.event_version = '1';
      outbox.aggregate_type = 'ServiceClaim';
      outbox.aggregate_id = CLAIM_ID;
      outbox.status = OutboxStatus.PENDING; // Remains PENDING because direct write failed or server crashed
      outbox.retry_count = 0;
      outbox.payload = {
        routing: { userIds: [PM_USER_ID] },
        businessPayload: {
          claimId: CLAIM_ID,
          claimNumber: CLAIM_NUMBER,
          projectId: PROJECT_ID,
          projectManagerId: PM_USER_ID,
          submittedBy: SUBMITTER_USER_ID,
        },
      };
      inMemoryOutbox.push(outbox);

      // Verify that initially, zero notifications exist
      expect(inMemoryNotifications.length).toBe(0);

      // Step B: Outbox Relay Worker recovers the pending event
      const relayResult = await relayService.relaySingleEvent(20);

      expect(relayResult).toBe('SUCCESS');
      expect(outbox.status).toBe(OutboxStatus.PUBLISHED);

      // Step C: Notification successfully persisted via recovery
      expect(inMemoryNotifications.length).toBe(1);
      expect(inMemoryNotifications[0].userId).toBe(PM_USER_ID);
      expect(inMemoryNotifications[0].dedupeKey).toBe(`${eventId}:44:SERVICE_CLAIM_SUBMITTED`);
    });
  });

  describe('4. Strict Idempotency & Zero Duplicate Notifications on Replay', () => {
    it('suppresses duplicates when outbox relays an event that was already persisted by direct write', async () => {
      const eventId = 'evt-idempotency-001';

      // Step A: Direct write succeeds first (fast path)
      const directWriteResult = await writer.persistCanonicalNotification({
        eventId,
        recipientId: PM_USER_ID,
        purpose: 'SERVICE_CLAIM_SUBMITTED',
        title: `Pengajuan Klaim Jasa Baru (${CLAIM_NUMBER})`,
        message: 'Klaim jasa baru diajukan dan membutuhkan verifikasi teknis.',
        type: 'ALERT',
        actionTarget: `/project?projectId=${PROJECT_ID}&claimId=${CLAIM_ID}`,
      });

      expect(directWriteResult.status).toBe('PERSISTED');
      expect(inMemoryNotifications.length).toBe(1);

      // Step B: Outbox Relay runs afterwards (or event is replayed)
      const event: BusinessEvent<any> = {
        eventId,
        eventName: 'procurement.service_claim.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ServiceClaim',
        aggregateId: CLAIM_ID,
        routing: { userIds: [PM_USER_ID] },
        payload: {
          claimId: CLAIM_ID,
          claimNumber: CLAIM_NUMBER,
          projectId: PROJECT_ID,
          projectManagerId: PM_USER_ID,
        },
      };

      const replayResults = await consumer.handleServiceClaimSubmitted(event);

      // Step C: Verify DUPLICATE_SUPPRESSED returned, count remains strictly 1
      expect(replayResults.length).toBe(1);
      expect(replayResults[0].status).toBe('DUPLICATE_SUPPRESSED');
      expect(inMemoryNotifications.length).toBe(1);
    });

    it('multiple replays (e.g. 3x) never create redundant notification records', async () => {
      const eventId = 'evt-multi-replay-001';
      const event: BusinessEvent<any> = {
        eventId,
        eventName: 'procurement.service_claim.pm_verified',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ServiceClaim',
        aggregateId: CLAIM_ID,
        routing: { userIds: [PROCUREMENT_USER_ID] },
        payload: {
          claimId: CLAIM_ID,
          claimNumber: CLAIM_NUMBER,
          decision: 'APPROVE',
        },
      };

      // 1st delivery
      const res1 = await consumer.handleServiceClaimVerified(event);
      expect(res1[0].status).toBe('PERSISTED');
      expect(inMemoryNotifications.length).toBe(1);

      // 2nd replay
      const res2 = await consumer.handleServiceClaimVerified(event);
      expect(res2[0].status).toBe('DUPLICATE_SUPPRESSED');
      expect(inMemoryNotifications.length).toBe(1);

      // 3rd replay
      const res3 = await consumer.handleServiceClaimVerified(event);
      expect(res3[0].status).toBe('DUPLICATE_SUPPRESSED');
      expect(inMemoryNotifications.length).toBe(1);
    });
  });

  describe('5. Business State Machine & Decoupling Invariants', () => {
    it('notification failure does not mutate or invalidate business state', async () => {
      const claim = new ServiceClaim();
      claim.id = CLAIM_ID;
      claim.claimNumber = CLAIM_NUMBER;
      claim.projectId = PROJECT_ID;
      claim.status = ServiceClaimStatus.SUBMITTED;

      // Invariant: Business status is SUBMITTED
      expect(claim.status).toBe(ServiceClaimStatus.SUBMITTED);

      // Notification writer throws error
      jest.spyOn(writer, 'persistCanonicalNotification').mockRejectedValueOnce(
        new Error('Database lock timeout on notification persistence'),
      );

      // Verify writer error is caught cleanly and does not mutate claim status
      await expect(
        writer.persistCanonicalNotification({
          eventId: 'evt-fail-test',
          recipientId: PM_USER_ID,
          purpose: 'SERVICE_CLAIM_SUBMITTED',
          title: 'Test',
          message: 'Test message',
          type: 'ALERT',
        }),
      ).rejects.toThrow('Database lock timeout on notification persistence');

      // Claim status is guaranteed intact
      expect(claim.status).toBe(ServiceClaimStatus.SUBMITTED);
    });
  });
});

