import * as crypto from 'crypto';
import * as https from 'https';
import * as tls from 'tls';
import { EventEmitter } from 'events';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PushSsrfGuard, PushSsrfException } from './push-ssrf.guard';
import { PushSubscriptionService } from './push-subscription.service';
import { WebPushDispatcher } from './web-push.dispatcher';
import { PushOutboxService } from './push-outbox.service';
import { PushOutboxWorker } from './push-outbox.worker';
import { NotificationController } from './notification.controller';
import {
  PushOutbox,
  PushOutboxStatus,
  PushErrorCategory,
} from '../../entities/push-outbox.entity';
import { PushSubscription } from '../../entities/push-subscription.entity';

/**
 * Helper to generate a valid P-256 keypair (65-byte uncompressed public key & 32-byte private key)
 */
function generateP256KeyPair() {
  const ecdh = crypto.createECDH('prime256v1');
  const pubBuf = ecdh.generateKeys();
  const privBuf = ecdh.getPrivateKey();
  return {
    publicKeyB64Url: WebPushDispatcher.toBase64Url(pubBuf),
    privateKeyB64Url: WebPushDispatcher.toBase64Url(privBuf),
    pubBuf,
    privBuf,
  };
}

function generateClientSubscriptionKeys() {
  const clientEcdh = crypto.createECDH('prime256v1');
  const uaPublic = clientEcdh.generateKeys();
  const authSecret = crypto.randomBytes(16);
  return {
    clientEcdh,
    uaPublic,
    authSecret,
    p256dh: WebPushDispatcher.toBase64Url(uaPublic),
    auth: WebPushDispatcher.toBase64Url(authSecret),
  };
}

describe('Stage 3B — Web Push Dispatch & Subscription Management', () => {
  // =========================================================================
  // 1. 8-LAYER SSRF GUARD & ENDPOINT VALIDATION
  // =========================================================================
  describe('1. PushSsrfGuard (8-Layer SSRF Protection & Endpoint Validation)', () => {
    let guard: PushSsrfGuard;

    beforeEach(() => {
      guard = new PushSsrfGuard();
      guard.setDnsLookup(async () => [{ address: '142.250.190.42', family: 4 }]);
    });

    it('accepts valid HTTPS endpoints on allowlisted vendor domains', () => {
      const validEndpoints = [
        'https://fcm.googleapis.com/fcm/send/token-123',
        'https://fcm.googleapis.com:443/fcm/send/token-123',
        'https://updates.push.services.mozilla.com/wpush/v2/abc',
        'https://web.push.apple.com/Q12345',
        'https://api.push.apple.com/3/device/abc',
        'https://api.development.push.apple.com/3/device/abc',
        'https://db5.notify.windows.com/?token=xyz',
        'https://sn4.notify.windows.com/?token=xyz',
        'https://hk2.notify.windows.com/?token=xyz',
        'https://client.wns.windows.com/?token=xyz',
      ];

      for (const ep of validEndpoints) {
        const parsed = guard.validateEndpointUrlSyntax(ep);
        expect(parsed.protocol).toBe('https:');
      }
    });

    it('Layer 1: rejects non-HTTPS protocols (http, ftp, file, ws)', () => {
      const invalidProtocols = [
        'http://fcm.googleapis.com/fcm/send/abc',
        'ftp://fcm.googleapis.com/fcm/send/abc',
        'file:///etc/passwd',
        'ws://fcm.googleapis.com/fcm/send/abc',
      ];

      for (const ep of invalidProtocols) {
        expect(() => guard.validateEndpointUrlSyntax(ep)).toThrow(PushSsrfException);
        try {
          guard.validateEndpointUrlSyntax(ep);
        } catch (err: any) {
          expect(err.layer).toBe(1);
        }
      }
    });

    it('Layer 2: rejects non-standard ports (:8080, :8443, :22)', () => {
      const badPorts = [
        'https://fcm.googleapis.com:8080/fcm/send/abc',
        'https://web.push.apple.com:8443/Q123',
        'https://db5.notify.windows.com:22/token',
      ];

      for (const ep of badPorts) {
        expect(() => guard.validateEndpointUrlSyntax(ep)).toThrow(PushSsrfException);
        try {
          guard.validateEndpointUrlSyntax(ep);
        } catch (err: any) {
          expect(err.layer).toBe(2);
        }
      }
    });

    it('Layer 3: rejects URLs containing userinfo credentials', () => {
      const badUserinfo = [
        'https://user:pass@fcm.googleapis.com/fcm/send/abc',
        'https://admin@web.push.apple.com/Q123',
        'https://user:pass@db5.notify.windows.com/token',
      ];

      for (const ep of badUserinfo) {
        expect(() => guard.validateEndpointUrlSyntax(ep)).toThrow(PushSsrfException);
        try {
          guard.validateEndpointUrlSyntax(ep);
        } catch (err: any) {
          expect(err.layer).toBe(3);
        }
      }
    });

    it('Layer 4: rejects root apex domains, malformed DNS labels, evil suffixes, typosquatting, and IP literals', () => {
      const rejectedHostnames = [
        // Root apex (not valid push endpoints)
        'https://push.apple.com/path',
        'https://notify.windows.com/path',
        'https://wns.windows.com/path',
        // Malformed DNS labels RFC 1035/1123
        'https://-bad-.push.apple.com/path',
        'https://bad..push.apple.com/path',
        `https://${'a'.repeat(64)}.push.apple.com/path`,
        'https://-bad-.notify.windows.com/path',
        'https://bad..notify.windows.com/path',
        'https://bad..wns.windows.com/path',
        // Evil suffixes
        'https://push.apple.com.evil.com/path',
        'https://web.push.apple.com.attacker.org/path',
        'https://notify.windows.com.evil.com/path',
        'https://wns.windows.com.attacker.org/path',
        'https://fcm.googleapis.com.evil.com/path',
        // Typosquatting
        'https://evil-push.apple.com/path',
        'https://push-apple.com/path',
        'https://apple.com/path',
        'https://evil-notify.windows.com/path',
        'https://notif-windows.com/path',
        'https://windows.com/path',
        // Direct IP literals
        'https://127.0.0.1/path',
        'https://169.254.169.254/latest/meta-data',
        'https://[::1]/path',
      ];

      for (const ep of rejectedHostnames) {
        expect(() => guard.validateEndpointUrlSyntax(ep)).toThrow(PushSsrfException);
      }
    });

    it('Layer 6: blocks all RFC 6890 special-purpose IPv4 and IPv6 addresses including IPv4-mapped IPv6', async () => {
      const blockedIps = [
        '0.0.0.0',
        '127.0.0.1',
        '10.0.0.1',
        '172.16.0.1',
        '172.31.255.254',
        '192.168.1.1',
        '169.254.169.254', // Cloud metadata
        '100.64.0.1',      // CGNAT
        '192.0.2.1',       // TEST-NET-1
        '198.51.100.1',    // TEST-NET-2
        '203.0.113.1',     // TEST-NET-3
        '224.0.0.1',       // Multicast
        '240.0.0.1',       // Reserved
        '255.255.255.255', // Broadcast
        '::',
        '::1',
        '::ffff:127.0.0.1',
        '::ffff:169.254.169.254',
        '::ffff:10.0.0.1',
        'fe80::1',
        'fc00::1',
        'fd12:3456:789a::1',
        '2001:db8::1',
        'ff02::1',
      ];

      for (const ip of blockedIps) {
        expect(PushSsrfGuard.isPublicGlobalIp(ip)).toBe(false);
        expect(() => guard.assertPublicIp(ip)).toThrow(PushSsrfException);
      }

      // Public IPs should pass
      expect(PushSsrfGuard.isPublicGlobalIp('142.250.190.42')).toBe(true);
      expect(PushSsrfGuard.isPublicGlobalIp('2607:f8b0:4004:800::200a')).toBe(true);
    });

    it('Layer 6: rejects DNS response if ANY record in a multi-record response is private (DNS rebinding defense)', async () => {
      guard.setDnsLookup(async () => [
        { address: '142.250.190.42', family: 4 },
        { address: '169.254.169.254', family: 4 }, // Poisoned second record
      ]);

      await expect(
        guard.resolveAndValidateEndpoint('https://fcm.googleapis.com/fcm/send/token-1'),
      ).rejects.toThrow(PushSsrfException);
    });
  });

  // =========================================================================
  // 2. SUBSCRIPTION MANAGEMENT & CROSS-USER ISOLATION
  // =========================================================================
  describe('2. PushSubscriptionService & NotificationController (CRUD, Idempotency & Cross-User Isolation)', () => {
    let store: Map<number, PushSubscription>;
    let idSeq: number;
    let mockRepo: any;
    let ssrfGuard: PushSsrfGuard;
    let subService: PushSubscriptionService;
    let dispatcher: WebPushDispatcher;
    let controller: NotificationController;

    const validClientKeys = generateClientSubscriptionKeys();
    const validClientKeys2 = generateClientSubscriptionKeys();

    beforeEach(() => {
      store = new Map<number, PushSubscription>();
      idSeq = 1;

      mockRepo = {
        findOne: jest.fn(async ({ where }: any) => {
          for (const item of store.values()) {
            if (where.endpointHash && item.endpointHash === where.endpointHash) {
              return { ...item };
            }
            if (where.id !== undefined && Number(item.id) === Number(where.id)) {
              return { ...item };
            }
          }
          return null;
        }),
        find: jest.fn(async ({ where }: any) => {
          const out: PushSubscription[] = [];
          for (const item of store.values()) {
            if (
              Number(item.userId) === Number(where.userId) &&
              Boolean(item.isActive) === Boolean(where.isActive)
            ) {
              out.push({ ...item });
            }
          }
          return out;
        }),
        create: jest.fn((data: Partial<PushSubscription>) => ({
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        save: jest.fn(async (entity: PushSubscription) => {
          if (!entity.id) {
            entity.id = idSeq++;
          }
          entity.updatedAt = new Date();
          store.set(entity.id, { ...entity });
          return { ...entity };
        }),
        delete: jest.fn(async (criteria: any) => {
          const ids: number[] = criteria?.id?._value || [];
          for (const id of ids) {
            store.delete(Number(id));
          }
          return { affected: ids.length };
        }),
      };

      ssrfGuard = new PushSsrfGuard();
      subService = new PushSubscriptionService(mockRepo, ssrfGuard);
      dispatcher = new WebPushDispatcher(ssrfGuard);
      controller = new NotificationController(
        {} as any,
        subService,
        dispatcher,
      );
    });

    it('creates a new subscription bound strictly to authenticated userId and returns sanitized view', async () => {
      const endpoint = 'https://fcm.googleapis.com/fcm/send/sub-device-1';
      const resp = await controller.subscribePush(
        { user: { userId: 101 }, headers: { 'user-agent': 'Mozilla/5.0 Chrome' } },
        {
          endpoint,
          keys: {
            p256dh: validClientKeys.p256dh,
            auth: validClientKeys.auth,
          },
        },
      );

      expect(resp.data.id).toBe(1);
      expect(resp.data.userId).toBe(101);
      expect(resp.data.isActive).toBe(true);
      expect(resp.data.endpointOrigin).toBe('https://fcm.googleapis.com');
      expect(resp.data.endpointHash).toHaveLength(64);
      // Verify secret keys and full capability path are NOT leaked in response
      expect((resp.data as any).p256dh).toBeUndefined();
      expect((resp.data as any).auth).toBeUndefined();
      expect((resp.data as any).endpoint).toBeUndefined();
    });

    it('handles duplicate registration by the SAME user idempotently (updates keys without creating a second row)', async () => {
      const endpoint = 'https://fcm.googleapis.com/fcm/send/sub-device-same';

      const first = await subService.upsertSubscription(101, {
        endpoint,
        p256dh: validClientKeys.p256dh,
        auth: validClientKeys.auth,
      });

      const second = await subService.upsertSubscription(101, {
        endpoint,
        p256dh: validClientKeys2.p256dh,
        auth: validClientKeys2.auth,
        userAgent: 'Updated Agent',
      });

      expect(second.id).toBe(first.id);
      expect(store.size).toBe(1);
      expect(store.get(first.id)?.p256dh).toBe(validClientKeys2.p256dh);
      expect(store.get(first.id)?.userAgent).toBe('Updated Agent');
    });

    it('enforces cross-user isolation: prevents User B from overwriting, revoking, or deleting User A active subscription', async () => {
      const endpoint = 'https://fcm.googleapis.com/fcm/send/user-a-device';

      const subA = await subService.upsertSubscription(101, {
        endpoint,
        p256dh: validClientKeys.p256dh,
        auth: validClientKeys.auth,
      });

      // User 202 attempts to overwrite User 101's active endpoint -> ForbiddenException
      await expect(
        subService.upsertSubscription(202, {
          endpoint,
          p256dh: validClientKeys2.p256dh,
          auth: validClientKeys2.auth,
        }),
      ).rejects.toThrow(ForbiddenException);

      // User 202 attempts to revoke User 101's subscription by ID -> ForbiddenException
      await expect(
        controller.deletePushSubscription({ user: { userId: 202 } }, subA.id),
      ).rejects.toThrow(ForbiddenException);

      // User 202 attempts to revoke User 101's subscription by endpoint -> ForbiddenException
      await expect(
        controller.unsubscribePush(
          { user: { userId: 202 } },
          { endpoint },
        ),
      ).rejects.toThrow(ForbiddenException);

      // Verify User 101's subscription remains active and owned by 101
      const stored = store.get(subA.id)!;
      expect(stored.userId).toBe(101);
      expect(stored.isActive).toBe(true);
    });

    it('allows User A to revoke their own subscription, and then allows shared-device rebind after explicit revoke', async () => {
      const endpoint = 'https://fcm.googleapis.com/fcm/send/shared-device';

      const subA = await subService.upsertSubscription(101, {
        endpoint,
        p256dh: validClientKeys.p256dh,
        auth: validClientKeys.auth,
      });

      // User 101 revokes their subscription
      const revoked = await subService.revokeSubscription(101, {
        subscriptionId: subA.id,
      });
      expect(revoked.isActive).toBe(false);

      // Active list for User 101 is now empty
      const activeFor101 = await subService.getSubscriptionsForUser(101);
      expect(activeFor101).toHaveLength(0);

      // Now User 202 logs in on the same browser and registers the endpoint -> succeeds safely
      const rebound = await subService.upsertSubscription(202, {
        endpoint,
        p256dh: validClientKeys2.p256dh,
        auth: validClientKeys2.auth,
      });
      expect(rebound.id).toBe(subA.id);
      expect(rebound.userId).toBe(202);
      expect(rebound.isActive).toBe(true);
    });

    it('rejects malformed p256dh or auth secrets and SSRF-violating endpoints on registration', async () => {
      await expect(
        subService.upsertSubscription(101, {
          endpoint: 'http://fcm.googleapis.com/fcm/send/insecure',
          p256dh: validClientKeys.p256dh,
          auth: validClientKeys.auth,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        subService.upsertSubscription(101, {
          endpoint: 'https://fcm.googleapis.com/fcm/send/valid',
          p256dh: 'short-invalid-key',
          auth: validClientKeys.auth,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        subService.upsertSubscription(101, {
          endpoint: 'https://fcm.googleapis.com/fcm/send/valid',
          p256dh: validClientKeys.p256dh,
          auth: 'short',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // 3. RFC 8291 ENCRYPTION, RFC 8292 VAPID & END-TO-END WORKER DISPATCH
  // =========================================================================
  describe('3. WebPushDispatcher & PushOutboxWorker End-to-End Integration', () => {
    const vapidKeys = generateP256KeyPair();
    const vapidSubject = 'mailto:ops@epms.tvmubd.com';

    let ssrfGuard: PushSsrfGuard;
    let dispatcher: WebPushDispatcher;

    beforeEach(() => {
      ssrfGuard = new PushSsrfGuard();
      ssrfGuard.setDnsLookup(async () => [{ address: '142.250.190.42', family: 4 }]);
      dispatcher = new WebPushDispatcher(ssrfGuard);
      dispatcher.setVapidConfig({
        publicKey: vapidKeys.publicKeyB64Url,
        privateKey: vapidKeys.privateKeyB64Url,
        subject: vapidSubject,
      });
    });

    it('encrypts payload per RFC 8291 (aes128gcm) and generates verifiable ES256 VAPID JWT per RFC 8292', () => {
      const client = generateClientSubscriptionKeys();
      const plaintext = JSON.stringify({
        title: 'Service Claim Approved',
        body: 'SC-2026-009 has been verified',
        actionLink: '/procurement/service-claims/9',
      });

      const encrypted = dispatcher.encryptPayloadRfc8291(
        plaintext,
        client.p256dh,
        client.auth,
      );

      // Parse RFC 8188 header: salt (16B) | rs (4B) | idlen (1B) | serverPublicKey (65B)
      const salt = encrypted.subarray(0, 16);
      const rs = encrypted.readUInt32BE(16);
      const idlen = encrypted.readUInt8(20);
      const asPublic = encrypted.subarray(21, 21 + idlen);
      const ciphertextAndTag = encrypted.subarray(21 + idlen);

      expect(rs).toBe(4096);
      expect(idlen).toBe(65);
      expect(asPublic[0]).toBe(0x04);

      // Client decrypts using its ECDH private key to verify RFC 8291 compliance!
      const sharedSecret = client.clientEcdh.computeSecret(asPublic);
      const keyInfo = Buffer.concat([
        Buffer.from('WebPush: info\0', 'utf8'),
        client.uaPublic,
        asPublic,
      ]);
      const ikm = Buffer.from(
        crypto.hkdfSync('sha256', sharedSecret, client.authSecret, keyInfo, 32),
      );
      const cek = Buffer.from(
        crypto.hkdfSync(
          'sha256',
          ikm,
          salt,
          Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'),
          16,
        ),
      );
      const nonce = Buffer.from(
        crypto.hkdfSync(
          'sha256',
          ikm,
          salt,
          Buffer.from('Content-Encoding: nonce\0', 'utf8'),
          12,
        ),
      );

      const authTag = ciphertextAndTag.subarray(ciphertextAndTag.length - 16);
      const rawCiphertext = ciphertextAndTag.subarray(0, ciphertextAndTag.length - 16);

      const decipher = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
      decipher.setAuthTag(authTag);
      const decryptedPadded = Buffer.concat([
        decipher.update(rawCiphertext),
        decipher.final(),
      ]);

      // Last byte must be delimiter 0x02
      expect(decryptedPadded[decryptedPadded.length - 1]).toBe(0x02);
      const decryptedJson = decryptedPadded
        .subarray(0, decryptedPadded.length - 1)
        .toString('utf8');
      expect(JSON.parse(decryptedJson)).toEqual(JSON.parse(plaintext));

      // Verify VAPID ES256 JWT signature with VAPID public key
      const vapidCtx = dispatcher.resolveAndValidateVapid();
      const authHeader = dispatcher.createVapidAuthorizationHeader(
        'https://fcm.googleapis.com',
        vapidCtx,
      );
      expect(authHeader.startsWith('vapid t=')).toBe(true);
      const match = /^vapid t=([^,]+), k=(.+)$/.exec(authHeader);
      expect(match).not.toBeNull();
      const jwt = match![1];
      const kParam = match![2];
      expect(kParam).toBe(vapidKeys.publicKeyB64Url);

      const [hB64, pB64, sB64] = jwt.split('.');
      const pubKeyObj = crypto.createPublicKey({
        key: {
          kty: 'EC',
          crv: 'P-256',
          x: WebPushDispatcher.toBase64Url(vapidKeys.pubBuf.subarray(1, 33)),
          y: WebPushDispatcher.toBase64Url(vapidKeys.pubBuf.subarray(33, 65)),
        },
        format: 'jwk',
      });

      const isValidSig = crypto.verify(
        'sha256',
        Buffer.from(`${hB64}.${pB64}`, 'utf8'),
        { key: pubKeyObj, dsaEncoding: 'ieee-p1363' },
        PushSubscriptionService.decodeBase64Url(sB64),
      );
      expect(isValidSig).toBe(true);
    });

    it('dispatches successfully via mock gateway and settles job as ACCEPTED_BY_GATEWAY', async () => {
      const client = generateClientSubscriptionKeys();
      const transportCalls: any[] = [];

      dispatcher.setHttpTransport(async (req) => {
        transportCalls.push(req);
        return { statusCode: 201, headers: {} };
      });

      const settleCalls: any[] = [];
      const mockOutboxService = {
        settleJob: jest.fn(async (params) => {
          settleCalls.push(params);
          return true;
        }),
        calculateBackoffSeconds: (attempts: number) =>
          Math.min(300, 30 * Math.pow(2, Math.max(0, attempts - 1))),
      } as unknown as PushOutboxService;

      const mockSubProvider = {
        getSubscriptionsForUser: jest.fn(async () => [
          {
            id: 11,
            userId: 500,
            endpoint: 'https://fcm.googleapis.com/fcm/send/device-11',
            p256dh: client.p256dh,
            auth: client.auth,
            isActive: true,
          },
        ]),
        removeInvalidSubscriptions: jest.fn(async () => {}),
      };

      const worker = new PushOutboxWorker(
        mockOutboxService,
        mockSubProvider,
        dispatcher,
      );

      const job: PushOutbox = {
        id: 77,
        notificationId: 900,
        recipientId: 500,
        eventId: 'EVT-STAGE3B-1',
        purpose: 'APPROVAL_REQUIRED',
        dedupeKey: 'EVT-STAGE3B-1:500:APPROVAL_REQUIRED:PUSH',
        status: PushOutboxStatus.CLAIMED,
        claimCount: 1,
        attempts: 0,
        maxAttempts: 3,
        payloadPreview: { title: 'Approval Needed', body: 'Tender 159' },
        errorCategory: PushErrorCategory.NONE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const settled = await worker.processSingleJob(job, 'lease-token-1');
      expect(settled).toBe(true);
      expect(transportCalls).toHaveLength(1);
      expect(transportCalls[0].target.pinnedAddress).toBe('142.250.190.42');
      expect(transportCalls[0].headers['Content-Encoding']).toBe('aes128gcm');
      expect(settleCalls).toHaveLength(1);
      expect(settleCalls[0].status).toBe(PushOutboxStatus.ACCEPTED_BY_GATEWAY);
      expect(settleCalls[0].attempts).toBe(1);
      expect(settleCalls[0].errorCategory).toBe(PushErrorCategory.NONE);
      expect(settleCalls[0].dispatchedAt).toBeInstanceOf(Date);
    });

    it('handles NO_SUBSCRIPTION when recipient has zero active subscriptions', async () => {
      const settleCalls: any[] = [];
      const mockOutboxService = {
        settleJob: jest.fn(async (params) => {
          settleCalls.push(params);
          return true;
        }),
      } as unknown as PushOutboxService;

      const mockSubProvider = {
        getSubscriptionsForUser: jest.fn(async () => []),
        removeInvalidSubscriptions: jest.fn(async () => {}),
      };

      const worker = new PushOutboxWorker(
        mockOutboxService,
        mockSubProvider,
        dispatcher,
      );

      const job = {
        id: 78,
        recipientId: 501,
        attempts: 0,
        maxAttempts: 3,
      } as unknown as PushOutbox;

      await worker.processSingleJob(job, 'lease-78');
      expect(settleCalls[0].status).toBe(PushOutboxStatus.NO_SUBSCRIPTION);
    });

    it('cleans up ONLY invalid 404/410 subscriptions while preserving other active subscriptions', async () => {
      const c1 = generateClientSubscriptionKeys();
      const c2 = generateClientSubscriptionKeys();

      dispatcher.setHttpTransport(async (req) => {
        if (req.target.url.pathname.includes('expired-device')) {
          return { statusCode: 410, headers: {} };
        }
        return { statusCode: 201, headers: {} };
      });

      const removedIds: number[][] = [];
      const settleCalls: any[] = [];

      const mockOutboxService = {
        settleJob: jest.fn(async (params) => {
          settleCalls.push(params);
          return true;
        }),
        calculateBackoffSeconds: () => 30,
      } as unknown as PushOutboxService;

      const mockSubProvider = {
        getSubscriptionsForUser: jest.fn(async () => [
          {
            id: 21,
            userId: 500,
            endpoint: 'https://fcm.googleapis.com/fcm/send/expired-device',
            p256dh: c1.p256dh,
            auth: c1.auth,
            isActive: true,
          },
          {
            id: 22,
            userId: 500,
            endpoint: 'https://fcm.googleapis.com/fcm/send/healthy-device',
            p256dh: c2.p256dh,
            auth: c2.auth,
            isActive: true,
          },
        ]),
        removeInvalidSubscriptions: jest.fn(async (ids: number[]) => {
          removedIds.push(ids);
        }),
      };

      const worker = new PushOutboxWorker(
        mockOutboxService,
        mockSubProvider,
        dispatcher,
      );

      const job = {
        id: 79,
        notificationId: 901,
        recipientId: 500,
        eventId: 'EVT-410',
        purpose: 'ALERT',
        dedupeKey: 'EVT-410:500:ALERT:PUSH',
        attempts: 0,
        maxAttempts: 3,
        payloadPreview: { title: 'Test' },
      } as unknown as PushOutbox;

      await worker.processSingleJob(job, 'lease-79');

      // Only subscription 21 was removed; subscription 22 succeeded
      expect(removedIds).toEqual([[21]]);
      expect(settleCalls[0].status).toBe(PushOutboxStatus.ACCEPTED_BY_GATEWAY);
      expect(settleCalls[0].deliveryDetails.dispatched_count).toBe(1);
    });

    it('performs partial retry ONLY on failed subscriptions without re-sending to already-succeeded subscriptions', async () => {
      const c1 = generateClientSubscriptionKeys();
      const c2 = generateClientSubscriptionKeys();
      const calledEndpoints: string[] = [];

      let attemptNum = 1;
      dispatcher.setHttpTransport(async (req) => {
        calledEndpoints.push(req.target.url.pathname);
        if (attemptNum === 1 && req.target.url.pathname.includes('device-b')) {
          return { statusCode: 503, headers: {} };
        }
        return { statusCode: 201, headers: {} };
      });

      const settleCalls: any[] = [];
      const mockOutboxService = {
        settleJob: jest.fn(async (params) => {
          settleCalls.push(params);
          return true;
        }),
        calculateBackoffSeconds: (a: number) => 30 * Math.pow(2, a - 1),
      } as unknown as PushOutboxService;

      const subs = [
        {
          id: 31,
          userId: 500,
          endpoint: 'https://fcm.googleapis.com/fcm/send/device-a',
          p256dh: c1.p256dh,
          auth: c1.auth,
          isActive: true,
        },
        {
          id: 32,
          userId: 500,
          endpoint: 'https://fcm.googleapis.com/fcm/send/device-b',
          p256dh: c2.p256dh,
          auth: c2.auth,
          isActive: true,
        },
      ];

      const mockSubProvider = {
        getSubscriptionsForUser: jest.fn(async () => subs),
        removeInvalidSubscriptions: jest.fn(async () => {}),
      };

      const worker = new PushOutboxWorker(
        mockOutboxService,
        mockSubProvider,
        dispatcher,
      );

      // Attempt 1: device-a succeeds (201), device-b fails (503)
      const jobAttempt1 = {
        id: 80,
        notificationId: 902,
        recipientId: 500,
        eventId: 'EVT-PARTIAL',
        purpose: 'ALERT',
        dedupeKey: 'EVT-PARTIAL:500:ALERT:PUSH',
        attempts: 0,
        maxAttempts: 3,
        payloadPreview: { title: 'Partial Retry' },
        deliveryDetails: null,
      } as unknown as PushOutbox;

      await worker.processSingleJob(jobAttempt1, 'lease-80-1');
      expect(settleCalls[0].status).toBe(PushOutboxStatus.FAILED_RETRYABLE);
      expect(settleCalls[0].errorCategory).toBe(PushErrorCategory.GATEWAY_5XX);
      expect(calledEndpoints).toEqual(['/fcm/send/device-a', '/fcm/send/device-b']);

      // Attempt 2: pass prior deliveryDetails from Attempt 1
      calledEndpoints.length = 0;
      attemptNum = 2;
      const jobAttempt2 = {
        ...jobAttempt1,
        attempts: 1,
        deliveryDetails: settleCalls[0].deliveryDetails,
      } as unknown as PushOutbox;

      await worker.processSingleJob(jobAttempt2, 'lease-80-2');

      // Device A was NOT called again; only Device B was retried!
      expect(calledEndpoints).toEqual(['/fcm/send/device-b']);
      expect(settleCalls[1].status).toBe(PushOutboxStatus.ACCEPTED_BY_GATEWAY);
      expect(settleCalls[1].deliveryDetails.dispatched_count).toBe(2);
    });

    it('enforces bounded retry (max_attempts = 3) on transient failures (429 / 5xx / timeout) then transitions to PERMANENT_FAILURE', async () => {
      const client = generateClientSubscriptionKeys();
      dispatcher.setHttpTransport(async () => {
        const err: any = new Error('ETIMEDOUT: Socket timeout after 5000ms');
        err.code = 'ETIMEDOUT';
        throw err;
      });

      const settleCalls: any[] = [];
      const mockOutboxService = {
        settleJob: jest.fn(async (params) => {
          settleCalls.push(params);
          return true;
        }),
        calculateBackoffSeconds: (a: number) => Math.min(300, 30 * Math.pow(2, a - 1)),
      } as unknown as PushOutboxService;

      const mockSubProvider = {
        getSubscriptionsForUser: jest.fn(async () => [
          {
            id: 41,
            userId: 500,
            endpoint: 'https://fcm.googleapis.com/fcm/send/device-timeout',
            p256dh: client.p256dh,
            auth: client.auth,
            isActive: true,
          },
        ]),
        removeInvalidSubscriptions: jest.fn(async () => {}),
      };

      const worker = new PushOutboxWorker(
        mockOutboxService,
        mockSubProvider,
        dispatcher,
      );

      for (let prevAttempts = 0; prevAttempts < 3; prevAttempts++) {
        await worker.processSingleJob(
          {
            id: 81,
            notificationId: 903,
            recipientId: 500,
            eventId: 'EVT-RETRY',
            purpose: 'ALERT',
            dedupeKey: 'EVT-RETRY:500:ALERT:PUSH',
            attempts: prevAttempts,
            maxAttempts: 3,
            payloadPreview: { title: 'Timeout test' },
          } as unknown as PushOutbox,
          `lease-${prevAttempts}`,
        );
      }

      // Attempt 1 & 2 -> FAILED_RETRYABLE (NETWORK_TIMEOUT)
      expect(settleCalls[0].status).toBe(PushOutboxStatus.FAILED_RETRYABLE);
      expect(settleCalls[0].errorCategory).toBe(PushErrorCategory.NETWORK_TIMEOUT);
      expect(settleCalls[1].status).toBe(PushOutboxStatus.FAILED_RETRYABLE);
      expect(settleCalls[1].errorCategory).toBe(PushErrorCategory.NETWORK_TIMEOUT);

      // Attempt 3 -> PERMANENT_FAILURE (EXCEEDED_MAX_ATTEMPTS)
      expect(settleCalls[2].status).toBe(PushOutboxStatus.PERMANENT_FAILURE);
      expect(settleCalls[2].errorCategory).toBe(PushErrorCategory.EXCEEDED_MAX_ATTEMPTS);
    });

    it('preserves lease fencing: settleJob aborts and returns false if leaseToken was lost to another worker', async () => {
      const mockDataSource: any = {
        createQueryRunner: () => ({
          connect: jest.fn(),
          startTransaction: jest.fn(),
          query: jest.fn(async () => [{ affectedRows: 0 }]), // Simulated fencing failure
          commitTransaction: jest.fn(),
          rollbackTransaction: jest.fn(),
          release: jest.fn(),
        }),
      };

      const outboxService = new PushOutboxService({} as any, mockDataSource);
      const client = generateClientSubscriptionKeys();
      dispatcher.setHttpTransport(async () => ({ statusCode: 201, headers: {} }));

      const mockSubProvider = {
        getSubscriptionsForUser: jest.fn(async () => [
          {
            id: 51,
            userId: 500,
            endpoint: 'https://fcm.googleapis.com/fcm/send/device-fence',
            p256dh: client.p256dh,
            auth: client.auth,
            isActive: true,
          },
        ]),
        removeInvalidSubscriptions: jest.fn(async () => {}),
      };

      const worker = new PushOutboxWorker(
        outboxService,
        mockSubProvider,
        dispatcher,
      );

      const settled = await worker.processSingleJob(
        {
          id: 82,
          notificationId: 904,
          recipientId: 500,
          eventId: 'EVT-FENCE',
          purpose: 'ALERT',
          dedupeKey: 'EVT-FENCE:500:ALERT:PUSH',
          attempts: 0,
          maxAttempts: 3,
          payloadPreview: { title: 'Fence test' },
        } as unknown as PushOutbox,
        'stale-lease-token',
      );

      expect(settled).toBe(false);
    });
  });

  // =========================================================================
  // 4. VAPID VALIDATION & SECRET SANITIZATION
  // =========================================================================
  describe('4. VAPID Configuration Validation & Secret Sanitization', () => {
    it('boots safely without throwing when VAPID env vars are absent, and settles job as PERMANENT_FAILURE (VAPID_ERROR) if dispatch is attempted', async () => {
      const ssrfGuard = new PushSsrfGuard();
      const dispatcher = new WebPushDispatcher(ssrfGuard);
      dispatcher.setVapidConfig({
        publicKey: '',
        privateKey: '',
        subject: '',
      });

      // Safe status check does not throw
      const status = dispatcher.getVapidStatus();
      expect(status.configured).toBe(false);
      expect(status.publicKey).toBeNull();

      // Public key endpoint throws 503 ServiceUnavailableException cleanly
      expect(() => dispatcher.getPublicKeyOrThrow()).toThrow(
        ServiceUnavailableException,
      );

      // Dispatch returns PERMANENT_FAILURE with VAPID_ERROR without crashing worker
      const settleCalls: any[] = [];
      const mockOutboxService = {
        settleJob: jest.fn(async (params) => {
          settleCalls.push(params);
          return true;
        }),
      } as unknown as PushOutboxService;

      const client = generateClientSubscriptionKeys();
      const mockSubProvider = {
        getSubscriptionsForUser: jest.fn(async () => [
          {
            id: 61,
            userId: 500,
            endpoint: 'https://fcm.googleapis.com/fcm/send/device-61',
            p256dh: client.p256dh,
            auth: client.auth,
            isActive: true,
          },
        ]),
        removeInvalidSubscriptions: jest.fn(async () => {}),
      };

      const worker = new PushOutboxWorker(
        mockOutboxService,
        mockSubProvider,
        dispatcher,
      );

      await worker.processSingleJob(
        {
          id: 83,
          notificationId: 905,
          recipientId: 500,
          eventId: 'EVT-NO-VAPID',
          purpose: 'ALERT',
          dedupeKey: 'EVT-NO-VAPID:500:ALERT:PUSH',
          attempts: 0,
          maxAttempts: 3,
          payloadPreview: { title: 'Test' },
        } as unknown as PushOutbox,
        'lease-83',
      );

      expect(settleCalls[0].status).toBe(PushOutboxStatus.PERMANENT_FAILURE);
      expect(settleCalls[0].errorCategory).toBe(PushErrorCategory.VAPID_ERROR);
    });

    it('detects mismatched VAPID public/private keypair and invalid VAPID_SUBJECT', () => {
      const pair1 = generateP256KeyPair();
      const pair2 = generateP256KeyPair();
      const dispatcher = new WebPushDispatcher(new PushSsrfGuard());

      // Mismatched public and private keys
      dispatcher.setVapidConfig({
        publicKey: pair1.publicKeyB64Url,
        privateKey: pair2.privateKeyB64Url,
        subject: 'mailto:ops@epms.tvmubd.com',
      });
      expect(() => dispatcher.resolveAndValidateVapid()).toThrow(/VAPID_ERROR/);

      // Invalid subject scheme
      dispatcher.setVapidConfig({
        publicKey: pair1.publicKeyB64Url,
        privateKey: pair1.privateKeyB64Url,
        subject: 'invalid-subject-without-scheme',
      });
      expect(() => dispatcher.resolveAndValidateVapid()).toThrow(/VAPID_ERROR/);
    });

    it('sanitizes private keys, auth secrets, p256dh keys, JWTs, and full endpoint capability URLs from error messages', () => {
      const pair = generateP256KeyPair();
      const client = generateClientSubscriptionKeys();
      const dispatcher = new WebPushDispatcher(new PushSsrfGuard());
      dispatcher.setVapidConfig({
        publicKey: pair.publicKeyB64Url,
        privateKey: pair.privateKeyB64Url,
        subject: 'mailto:ops@epms.tvmubd.com',
      });

      const secretEndpoint =
        'https://fcm.googleapis.com/fcm/send/secret-capability-token-99999';
      const fakeJwt =
        'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJodHRwczovL2ZjbS5nb29nbGVhcGlzLmNvbSJ9.sig12345';

      const rawError = `Failed sending to ${secretEndpoint} with priv=${pair.privateKeyB64Url} auth=${client.auth} p256dh=${client.p256dh} token=${fakeJwt}`;
      const sanitized = dispatcher.sanitizeMessage(rawError, [
        client.auth,
        client.p256dh,
      ]);

      expect(sanitized).not.toContain(pair.privateKeyB64Url);
      expect(sanitized).not.toContain(client.auth);
      expect(sanitized).not.toContain(client.p256dh);
      expect(sanitized).not.toContain('secret-capability-token-99999');
      expect(sanitized).not.toContain(fakeJwt);
      expect(sanitized).toContain('https://fcm.googleapis.com/[REDACTED_PATH]');
      expect(sanitized).toContain('[REDACTED_JWT]');
    });
  });

  // =========================================================================
  // 5. SSRF GUARD HARDENING & SUBSCRIPTION CLEANUP ISOLATION (POST-AUDIT FIX)
  // =========================================================================
  describe('5. SSRF Guard Hardening & Subscription Cleanup Isolation (Post-Audit Fix)', () => {
    it('Point 1 & Point 2: accepts valid public destinations and strictly blocks loopback, private, link-local, and arbitrary ULA', async () => {
      const guard = new PushSsrfGuard();
      guard.setDnsLookup(async (host) => {
        if (host === 'ipv4only.arpa') return [];
        return [
          { address: '216.239.38.57', family: 4 },
          { address: '2001:4860:4802:36::37', family: 6 },
        ];
      });

      const target = await guard.resolveAndValidateEndpoint(
        'https://fcm.googleapis.com/fcm/send/device-valid',
      );
      expect(target.hostname).toBe('fcm.googleapis.com');
      expect(target.pinnedAddress).toBe('216.239.38.57');
      expect(target.family).toBe(4);

      // Verify that loopback, RFC 1918 private, link-local, and arbitrary ULA are rejected
      const dangerousIps = [
        '127.0.0.1',
        '10.10.10.10',
        '192.168.1.1',
        '169.254.169.254',
        '::1',
        'fe80::1',
        'fc00::dead:beef',
        'fd00:1234:5678::1',
      ];

      for (const badIp of dangerousIps) {
        expect(PushSsrfGuard.isPublicGlobalIp(badIp)).toBe(false);
      }
    });

    it('Point 3: handles DNS resolution failure safely without unhandled exception', async () => {
      const guard = new PushSsrfGuard();
      guard.setDnsLookup(async (host) => {
        if (host === 'ipv4only.arpa') return [];
        const err: any = new Error('getaddrinfo ENOTFOUND fcm.googleapis.com');
        err.code = 'ENOTFOUND';
        throw err;
      });

      await expect(
        guard.resolveAndValidateEndpoint('https://fcm.googleapis.com/test'),
      ).rejects.toThrow(PushSsrfException);

      try {
        await guard.resolveAndValidateEndpoint('https://fcm.googleapis.com/test');
      } catch (err: any) {
        expect(err.layer).toBe(6);
        expect(err.message).toContain('ENOTFOUND');
      }
    });

    it('Point 4: mixed A/AAAA DNS records reject entire endpoint if ANY single record is private (DNS rebinding defense)', async () => {
      const guard = new PushSsrfGuard();
      guard.setDnsLookup(async (host) => {
        if (host === 'ipv4only.arpa') return [];
        return [
          { address: '216.239.38.57', family: 4 }, // public A
          { address: '127.0.0.1', family: 4 },      // private A (rebinding attempt)
        ];
      });

      await expect(
        guard.resolveAndValidateEndpoint('https://fcm.googleapis.com/test'),
      ).rejects.toThrow(PushSsrfException);
    });

    it('Point 5: DNS64/NAT64 translates verified prefix to public IPv4 safely, but strictly rejects private embedded IPv4 or arbitrary ULA', async () => {
      const guard = new PushSsrfGuard();
      // Configure verified NAT64 prefix (fd00:aa:bb:2090::/96)
      guard.setDiscoveredNat64Prefixes(['fd00:aa:bb:2090::']);

      // 5a. Verified prefix + public IPv4 (216.239.38.57 -> d8ef:2639) -> ACCEPTED
      guard.setDnsLookup(async (host) => {
        if (host === 'ipv4only.arpa') return [];
        return [
          { address: 'fd00:aa:bb:2090::d8ef:2639', family: 6 },
        ];
      });

      const target = await guard.resolveAndValidateEndpoint(
        'https://fcm.googleapis.com/fcm/send/token',
      );
      expect(target.pinnedAddress).toBe('fd00:aa:bb:2090::d8ef:2639');
      expect(target.family).toBe(6);

      // 5b. Verified prefix + private IPv4 (127.0.0.1 -> 7f00:0001) -> REJECTED
      guard.setDnsLookup(async (host) => {
        if (host === 'ipv4only.arpa') return [];
        return [
          { address: 'fd00:aa:bb:2090::7f00:0001', family: 6 },
        ];
      });
      await expect(
        guard.resolveAndValidateEndpoint('https://fcm.googleapis.com/test'),
      ).rejects.toThrow(PushSsrfException);

      // 5c. Arbitrary ULA NOT in verified prefix (fd00:dead:beef::d8ef:2639) -> REJECTED
      guard.setDnsLookup(async (host) => {
        if (host === 'ipv4only.arpa') return [];
        return [
          { address: 'fd00:dead:beef::d8ef:2639', family: 6 },
        ];
      });
      await expect(
        guard.resolveAndValidateEndpoint('https://fcm.googleapis.com/test'),
      ).rejects.toThrow(PushSsrfException);
    });

    it('Point 6 & Point 7: SSRF_REJECTED and DNS/network failures do NOT delete subscriptions', async () => {
      const client = generateClientSubscriptionKeys();
      const removedIds: number[][] = [];
      const settleCalls: any[] = [];

      const mockOutboxService = {
        settleJob: jest.fn(async (params) => {
          settleCalls.push(params);
          return true;
        }),
        calculateBackoffSeconds: () => 30,
      } as unknown as PushOutboxService;

      const mockSubProvider = {
        getSubscriptionsForUser: jest.fn(async () => [
          {
            id: 101,
            userId: 10,
            endpoint: 'https://fcm.googleapis.com/fcm/send/device-ssrf',
            p256dh: client.p256dh,
            auth: client.auth,
            isActive: true,
          },
        ]),
        removeInvalidSubscriptions: jest.fn(async (ids: number[]) => {
          removedIds.push(ids);
        }),
      };

      // Mock dispatcher throwing SSRF_REJECTED
      const ssrfDispatcher = {
        dispatch: async () => ({
          results: [
            {
              subscriptionId: 101,
              endpointHash: 'hash-101',
              status: 'PERMANENT_FAILURE' as const,
              error: 'SSRF_REJECTED [Layer 6]: Resolved IP address falls within a restricted range',
            },
          ],
        }),
      };

      const worker = new PushOutboxWorker(
        mockOutboxService,
        mockSubProvider,
        ssrfDispatcher,
      );

      await worker.processSingleJob(
        {
          id: 901,
          notificationId: 1001,
          recipientId: 10,
          eventId: 'EVT-SSRF-TEST',
          purpose: 'LEGAL_REVIEW_CONTRACT_SUBMITTED',
          dedupeKey: 'EVT-SSRF-TEST:10:LEGAL:PUSH',
          attempts: 0,
          maxAttempts: 3,
        } as unknown as PushOutbox,
        'lease-901',
      );

      // Subscription MUST NOT be removed!
      expect(removedIds).toEqual([]);
      expect(mockSubProvider.removeInvalidSubscriptions).not.toHaveBeenCalled();
      expect(settleCalls[0].status).toBe(PushOutboxStatus.PERMANENT_FAILURE);
      expect(settleCalls[0].errorCategory).toBe(PushErrorCategory.SSRF_REJECTED);

      // Now verify network timeout failure also does not remove subscription
      const networkDispatcher = {
        dispatch: async () => ({
          results: [
            {
              subscriptionId: 101,
              endpointHash: 'hash-101',
              status: 'FAILED_RETRYABLE' as const,
              error: 'ETIMEDOUT: Connection timed out',
            },
          ],
        }),
      };

      const worker2 = new PushOutboxWorker(
        mockOutboxService,
        mockSubProvider,
        networkDispatcher,
      );

      await worker2.processSingleJob(
        {
          id: 902,
          notificationId: 1002,
          recipientId: 10,
          eventId: 'EVT-NET-TEST',
          purpose: 'LEGAL_REVIEW_CONTRACT_SUBMITTED',
          dedupeKey: 'EVT-NET-TEST:10:LEGAL:PUSH',
          attempts: 0,
          maxAttempts: 3,
        } as unknown as PushOutbox,
        'lease-902',
      );

      // Still MUST NOT remove subscription!
      expect(removedIds).toEqual([]);
      expect(mockSubProvider.removeInvalidSubscriptions).not.toHaveBeenCalled();
      expect(settleCalls[1].status).toBe(PushOutboxStatus.FAILED_RETRYABLE);
      expect(settleCalls[1].errorCategory).toBe(PushErrorCategory.NETWORK_TIMEOUT);
    });

    it('Point 8: provider response HTTP 404/410 (INVALID_410) DOES trigger subscription cleanup', async () => {
      const client = generateClientSubscriptionKeys();
      const removedIds: number[][] = [];
      const settleCalls: any[] = [];

      const mockOutboxService = {
        settleJob: jest.fn(async (params) => {
          settleCalls.push(params);
          return true;
        }),
      } as unknown as PushOutboxService;

      const mockSubProvider = {
        getSubscriptionsForUser: jest.fn(async () => [
          {
            id: 202,
            userId: 10,
            endpoint: 'https://fcm.googleapis.com/fcm/send/expired-device',
            p256dh: client.p256dh,
            auth: client.auth,
            isActive: true,
          },
        ]),
        removeInvalidSubscriptions: jest.fn(async (ids: number[]) => {
          removedIds.push(ids);
        }),
      };

      const invalidDispatcher = {
        dispatch: async () => ({
          results: [
            {
              subscriptionId: 202,
              endpointHash: 'hash-202',
              status: 'INVALID_410' as const,
              httpCode: 410,
              error: 'INVALID_SUBSCRIPTION_410: Gateway returned HTTP 410',
            },
          ],
        }),
      };

      const worker = new PushOutboxWorker(
        mockOutboxService,
        mockSubProvider,
        invalidDispatcher,
      );

      await worker.processSingleJob(
        {
          id: 903,
          notificationId: 1003,
          recipientId: 10,
          eventId: 'EVT-410-TEST',
          purpose: 'LEGAL_REVIEW_CONTRACT_SUBMITTED',
          dedupeKey: 'EVT-410-TEST:10:LEGAL:PUSH',
          attempts: 0,
          maxAttempts: 3,
        } as unknown as PushOutbox,
        'lease-903',
      );

      // Subscription 202 MUST be removed!
      expect(removedIds).toEqual([[202]]);
      expect(settleCalls[0].status).toBe(PushOutboxStatus.PERMANENT_FAILURE);
      expect(settleCalls[0].errorCategory).toBe(PushErrorCategory.INVALID_SUBSCRIPTION_410);
    });

    it('Point 9: pinned address is strictly passed to outbound transport preventing DNS rebinding', async () => {
      const guard = new PushSsrfGuard();
      guard.setDnsLookup(async (host) => {
        if (host === 'ipv4only.arpa') return [];
        return [
          { address: '216.239.38.57', family: 4 },
        ];
      });

      const target = await guard.resolveAndValidateEndpoint(
        'https://fcm.googleapis.com/fcm/send/sample-token',
      );

      expect(target.pinnedAddress).toBe('216.239.38.57');
      expect(target.family).toBe(4);
      expect(target.hostname).toBe('fcm.googleapis.com');
    });
  });

  // =========================================================================
  // 6. DNS64/NAT64 CELLULAR SYNTHESIS & CROSS-CORRELATION VERIFICATION (ACTION 5)
  // =========================================================================
  describe('6. DNS64/NAT64 Cellular Synthesis & Cross-Correlation Verification (Action 5)', () => {
    let guard: PushSsrfGuard;

    beforeEach(() => {
      guard = new PushSsrfGuard();
      guard.clearDiscoveredNat64Prefixes();
    });

    it('Test 5.1: Valid public IPv4 for FCM endpoint passes and pins to public IPv4', async () => {
      guard.setDnsLookup(async (host) => {
        if (host === 'ipv4only.arpa') return [];
        return [
          { address: '216.239.38.57', family: 4 },
          { address: '216.239.36.55', family: 4 },
        ];
      });

      const target = await guard.resolveAndValidateEndpoint(
        'https://fcm.googleapis.com/fcm/send/token-ipv4-only',
      );

      expect(target.hostname).toBe('fcm.googleapis.com');
      expect(target.pinnedAddress).toBe('216.239.38.57');
      expect(target.family).toBe(4);
    });

    it('Test 5.2: Combination of public IPv4 and synthesized IPv6 ULA (Cellular Tethering) passes and pins to native public IPv4', async () => {
      // Simulates Android cellular tethering returning public IPv4 and synthesized IPv6 ULA (fd00:aa:bb:2090::d8ef:2439)
      // where ipv4only.arpa is not resolvable by the tethering forwarder.
      guard.setDnsLookup(async (host) => {
        if (host === 'ipv4only.arpa') return [];
        return [
          { address: '216.239.36.57', family: 4 },
          { address: 'fd00:aa:bb:2090::d8ef:2439', family: 6 }, // d8ef:2439 = 216.239.36.57
        ];
      });

      const target = await guard.resolveAndValidateEndpoint(
        'https://fcm.googleapis.com/fcm/send/token-tethering',
      );

      // Verify that cross-correlation dynamically discovered and registered the NAT64 prefix
      const prefixes = guard.getDiscoveredNat64Prefixes();
      const expectedPrefix = 0xfd0000aa00bb20900000000000000000n;
      expect(prefixes.has(expectedPrefix)).toBe(true);

      // Verify that the native public IPv4 address was prioritized for socket pinning
      expect(target.hostname).toBe('fcm.googleapis.com');
      expect(target.pinnedAddress).toBe('216.239.36.57');
      expect(target.family).toBe(4);
    });

    it('Test 5.3: Valid native public IPv6 passes and pins to IPv6', async () => {
      guard.setDnsLookup(async (host) => {
        if (host === 'ipv4only.arpa') return [];
        return [
          { address: '2001:4860:4802:36::37', family: 6 },
          { address: '2001:4860:4802:38::39', family: 6 },
        ];
      });

      const target = await guard.resolveAndValidateEndpoint(
        'https://fcm.googleapis.com/fcm/send/token-ipv6-native',
      );

      expect(target.hostname).toBe('fcm.googleapis.com');
      expect(target.pinnedAddress).toBe('2001:4860:4802:36::37');
      expect(target.family).toBe(6);
    });

    it('Test 5.4: Unverifiable private ULA is strictly rejected even if mixed with public IPv4', async () => {
      // Attack scenario: DNS returns valid public IPv4 but poisons the response with an unverified private ULA
      guard.setDnsLookup(async (host) => {
        if (host === 'ipv4only.arpa') return [];
        return [
          { address: '216.239.36.57', family: 4 },
          { address: 'fd00:1234:5678::1', family: 6 }, // Unverifiable private ULA (lower 32 does not match A record)
        ];
      });

      await expect(
        guard.resolveAndValidateEndpoint('https://fcm.googleapis.com/fcm/send/token-poisoned'),
      ).rejects.toThrow(PushSsrfException);

      // Pure unverifiable ULA without public A records is also strictly rejected
      guard.setDnsLookup(async (host) => {
        if (host === 'ipv4only.arpa') return [];
        return [
          { address: 'fd00:dead:beef::1', family: 6 },
        ];
      });

      await expect(
        guard.resolveAndValidateEndpoint('https://fcm.googleapis.com/fcm/send/token-pure-ula'),
      ).rejects.toThrow(PushSsrfException);
    });

    it('Test 5.5: Loopback, link-local, private IPv4, and non-allowlisted endpoints are strictly rejected', async () => {
      // 5.5a Loopback IPv4
      guard.setDnsLookup(async () => [{ address: '127.0.0.1', family: 4 }]);
      await expect(
        guard.resolveAndValidateEndpoint('https://fcm.googleapis.com/test'),
      ).rejects.toThrow(PushSsrfException);

      // 5.5b Link-Local / Cloud Metadata IPv4
      guard.setDnsLookup(async () => [{ address: '169.254.169.254', family: 4 }]);
      await expect(
        guard.resolveAndValidateEndpoint('https://fcm.googleapis.com/test'),
      ).rejects.toThrow(PushSsrfException);

      // 5.5c RFC 1918 Private IPv4
      guard.setDnsLookup(async () => [{ address: '10.0.0.1', family: 4 }]);
      await expect(
        guard.resolveAndValidateEndpoint('https://fcm.googleapis.com/test'),
      ).rejects.toThrow(PushSsrfException);

      guard.setDnsLookup(async () => [{ address: '192.168.1.1', family: 4 }]);
      await expect(
        guard.resolveAndValidateEndpoint('https://fcm.googleapis.com/test'),
      ).rejects.toThrow(PushSsrfException);

      // 5.5d Loopback & Link-Local IPv6
      guard.setDnsLookup(async () => [{ address: '::1', family: 6 }]);
      await expect(
        guard.resolveAndValidateEndpoint('https://fcm.googleapis.com/test'),
      ).rejects.toThrow(PushSsrfException);

      guard.setDnsLookup(async () => [{ address: 'fe80::1', family: 6 }]);
      await expect(
        guard.resolveAndValidateEndpoint('https://fcm.googleapis.com/test'),
      ).rejects.toThrow(PushSsrfException);

      // 5.5e Non-allowlisted endpoints (rejected at Layer 4 before DNS)
      expect(() => guard.validateEndpointUrlSyntax('https://internal.epms.local/send')).toThrow(PushSsrfException);
      expect(() => guard.validateEndpointUrlSyntax('https://evil-fcm.googleapis.com/send')).toThrow(PushSsrfException);
      expect(() => guard.validateEndpointUrlSyntax('https://169.254.169.254/latest/meta-data')).toThrow(PushSsrfException);
    });

    it('Test 5.6: DNS rebinding defense & consistency of hostname, validation results, and actual socket IP', async () => {
      guard.setDnsLookup(async (host) => {
        if (host === 'ipv4only.arpa') return [];
        return [
          { address: '216.239.36.57', family: 4 },
          { address: 'fd00:aa:bb:2090::d8ef:2439', family: 6 },
        ];
      });

      const target = await guard.resolveAndValidateEndpoint(
        'https://fcm.googleapis.com/fcm/send/token-pinned',
      );

      // Target verification
      expect(target.hostname).toBe('fcm.googleapis.com');
      expect(target.pinnedAddress).toBe('216.239.36.57');
      expect(target.family).toBe(4);

      // Verify dispatcher transport wiring
      const dispatcher = new WebPushDispatcher(guard);
      let capturedTarget: any = null;

      dispatcher.setHttpTransport(async (req) => {
        capturedTarget = req.target;
        return { statusCode: 201, headers: {} };
      });

      const vapidKeys = generateP256KeyPair();
      dispatcher.setVapidConfig({
        publicKey: vapidKeys.publicKeyB64Url,
        privateKey: vapidKeys.privateKeyB64Url,
        subject: 'mailto:admin@epms.com',
      });

      const clientKeys = generateClientSubscriptionKeys();
      const outcome = await dispatcher.dispatch(
        {
          id: 501,
          notificationId: 101,
          recipientId: 769,
          eventId: 'EVT-PIN-TEST',
          purpose: 'PIN_TEST',
          dedupeKey: 'EVT-PIN-TEST:769:PIN:PUSH',
          attempts: 0,
          maxAttempts: 3,
        } as unknown as PushOutbox,
        [
          {
            id: 28,
            userId: 769,
            endpoint: 'https://fcm.googleapis.com/fcm/send/token-pinned',
            p256dh: clientKeys.p256dh,
            auth: clientKeys.auth,
            isActive: true,
          },
        ],
      );

      expect(outcome.results[0].status).toBe('ACCEPTED_BY_GATEWAY');
      expect(outcome.results[0].httpCode).toBe(201);
      expect(capturedTarget).not.toBeNull();
      expect(capturedTarget.hostname).toBe('fcm.googleapis.com');
      expect(capturedTarget.pinnedAddress).toBe('216.239.36.57');
      expect(capturedTarget.family).toBe(4);
    });
  });

  // =========================================================================
  // 7. POST-AUDIT NAT64 CACHE EVICTION, RFC 7050 DISCOVERY & LOW-LEVEL HTTPS PINNING
  // =========================================================================
  describe('7. Post-Audit NAT64 Cache Eviction, RFC 7050 Discovery & Low-Level HTTPS Pinning Regression', () => {
    it('Test 7.1: executeHttpsPostWithIpPinning directly passes pinned IP, hostname, SNI, and checkServerIdentity to https.request, and rejects HTTP 3xx redirects without following them', async () => {
      const guard = new PushSsrfGuard();
      let dnsCallCount = 0;
      guard.setDnsLookup(async (host) => {
        if (host === 'ipv4only.arpa') return [];
        dnsCallCount++;
        return [
          { address: '216.239.36.57', family: 4 },
          { address: 'fd00:aa:bb:2090::d8ef:2439', family: 6 },
        ];
      });

      const dispatcher = new WebPushDispatcher(guard);
      const vapidKeys = generateP256KeyPair();
      dispatcher.setVapidConfig({
        publicKey: vapidKeys.publicKeyB64Url,
        privateKey: vapidKeys.privateKeyB64Url,
        subject: 'mailto:admin@epms.com',
      });
      const clientKeys = generateClientSubscriptionKeys();

      const capturedOptionsList: https.RequestOptions[] = [];
      let simulatedStatusCode = 201;
      let simulatedHeaders: Record<string, string> = {};

      const httpsRequestSpy = jest
        .spyOn(https, 'request')
        .mockImplementation(((options: any, callback: any) => {
          capturedOptionsList.push(options);
          const reqEmitter: any = new EventEmitter();
          reqEmitter.setTimeout = jest.fn();
          reqEmitter.write = jest.fn();
          reqEmitter.destroy = jest.fn();
          reqEmitter.end = jest.fn(() => {
            const resEmitter: any = new EventEmitter();
            resEmitter.statusCode = simulatedStatusCode;
            resEmitter.headers = simulatedHeaders;
            if (typeof callback === 'function') {
              callback(resEmitter);
            }
            resEmitter.emit('data', Buffer.alloc(0));
            resEmitter.emit('end');
          });
          return reqEmitter;
        }) as any);

      const tlsIdentitySpy = jest
        .spyOn(tls, 'checkServerIdentity')
        .mockReturnValue(undefined);

      try {
        // Part A: 201 Created — Verify low-level https.request options, custom lookup, and TLS checkServerIdentity
        const outcomeOk = await dispatcher.dispatch(
          {
            id: 701,
            notificationId: 201,
            recipientId: 769,
            eventId: 'EVT-HTTPS-PIN-1',
            purpose: 'HTTPS_PIN_TEST',
            dedupeKey: 'EVT-HTTPS-PIN-1:769:PIN:PUSH',
            attempts: 0,
            maxAttempts: 3,
          } as unknown as PushOutbox,
          [
            {
              id: 71,
              userId: 769,
              endpoint: 'https://fcm.googleapis.com/fcm/send/token-low-level',
              p256dh: clientKeys.p256dh,
              auth: clientKeys.auth,
              isActive: true,
            },
          ],
        );

        expect(outcomeOk.results[0].status).toBe('ACCEPTED_BY_GATEWAY');
        expect(outcomeOk.results[0].httpCode).toBe(201);
        expect(capturedOptionsList).toHaveLength(1);

        const reqOpts = capturedOptionsList[0];
        expect(reqOpts.protocol).toBe('https:');
        expect(reqOpts.hostname).toBe('fcm.googleapis.com');
        expect(reqOpts.port).toBe(443);
        expect(reqOpts.path).toBe('/fcm/send/token-low-level');
        expect(reqOpts.servername).toBe('fcm.googleapis.com');
        expect(reqOpts.family).toBe(4);
        expect(typeof reqOpts.lookup).toBe('function');
        expect(typeof reqOpts.checkServerIdentity).toBe('function');

        // Verify custom lookup returns pinned IP without triggering any new DNS lookup
        const dnsBeforeLookup = dnsCallCount;
        let singleAddressResult: any = null;
        (reqOpts.lookup as any)(
          'fcm.googleapis.com',
          {},
          (err: any, address: string, family: number) => {
            singleAddressResult = { err, address, family };
          },
        );
        expect(singleAddressResult).toEqual({
          err: null,
          address: '216.239.36.57',
          family: 4,
        });

        let allAddressResult: any = null;
        (reqOpts.lookup as any)(
          'fcm.googleapis.com',
          { all: true },
          (err: any, addresses: any[]) => {
            allAddressResult = { err, addresses };
          },
        );
        expect(allAddressResult).toEqual({
          err: null,
          addresses: [{ address: '216.239.36.57', family: 4 }],
        });
        expect(dnsCallCount).toBe(dnsBeforeLookup);

        // Verify checkServerIdentity delegates to tls.checkServerIdentity with target hostname
        const dummyCert = { subject: { CN: 'fcm.googleapis.com' } } as any;
        reqOpts.checkServerIdentity!('fcm.googleapis.com', dummyCert);
        expect(tlsIdentitySpy).toHaveBeenCalledWith(
          'fcm.googleapis.com',
          dummyCert,
        );

        // Part B: 302 Redirect — Verify HTTP 3xx is strictly rejected as Layer 5 SSRF violation and never followed
        simulatedStatusCode = 302;
        simulatedHeaders = {
          location: 'https://169.254.169.254/latest/meta-data',
        };

        const outcomeRedirect = await dispatcher.dispatch(
          {
            id: 702,
            notificationId: 202,
            recipientId: 769,
            eventId: 'EVT-HTTPS-REDIRECT',
            purpose: 'HTTPS_REDIRECT_TEST',
            dedupeKey: 'EVT-HTTPS-REDIRECT:769:PIN:PUSH',
            attempts: 0,
            maxAttempts: 3,
          } as unknown as PushOutbox,
          [
            {
              id: 72,
              userId: 769,
              endpoint: 'https://fcm.googleapis.com/fcm/send/token-redirect',
              p256dh: clientKeys.p256dh,
              auth: clientKeys.auth,
              isActive: true,
            },
          ],
        );

        // https.request was called only once for this dispatch (redirect not followed)
        expect(capturedOptionsList).toHaveLength(2);
        expect(outcomeRedirect.results[0].status).toBe('PERMANENT_FAILURE');
        expect(outcomeRedirect.results[0].httpCode).toBe(302);
        expect(outcomeRedirect.results[0].error).toContain(
          'SSRF_REJECTED [Layer 5]: HTTP redirect (302) is forbidden',
        );
      } finally {
        httpsRequestSpy.mockRestore();
        tlsIdentitySpy.mockRestore();
      }
    });

    it('Test 7.2: discoverNat64Prefixes via ipv4only.arpa accepts valid RFC 7050 records (192.0.0.170 / 192.0.0.171), rejects invalid records, and deduplicates concurrent discovery', async () => {
      const guard = new PushSsrfGuard();
      guard.clearDiscoveredNat64Prefixes();

      let ipv4OnlyLookupCount = 0;
      guard.setDnsLookup(async (host) => {
        if (host === 'ipv4only.arpa') {
          ipv4OnlyLookupCount++;
          await new Promise((resolve) => setTimeout(resolve, 10));
          return [
            // Valid RFC 7050 §2.1: 192.0.0.170 (0xc00000aa) and 192.0.0.171 (0xc00000ab)
            { address: 'fd00:aa:bb:2090::c000:aa', family: 6 },
            { address: 'fd00:cc:dd:3090::c000:ab', family: 6 },
            // Invalid/forged records (lower 32 bits are not 192.0.0.170/171)
            { address: 'fd00:bad:cafe:9999::1234:5678', family: 6 },
            { address: 'fd00:dead:beef:1111::d8ef:2439', family: 6 },
            { address: '192.0.0.170', family: 4 },
          ];
        }
        return [{ address: '216.239.36.57', family: 4 }];
      });

      // Trigger 3 concurrent discovery calls to verify single-flight deduplication
      const [set1, set2, set3] = await Promise.all([
        guard.discoverNat64Prefixes(),
        guard.discoverNat64Prefixes(),
        guard.discoverNat64Prefixes(),
      ]);

      expect(ipv4OnlyLookupCount).toBe(1);
      expect(set1).toEqual(set2);
      expect(set2).toEqual(set3);

      const prefixes = guard.getDiscoveredNat64Prefixes();
      // Well-known 64:ff9b::/96 + 2 valid RFC 7050 prefixes
      expect(prefixes.has(0x0064ff9b000000000000000000000000n)).toBe(true);
      expect(prefixes.has(0xfd0000aa00bb20900000000000000000n)).toBe(true);
      expect(prefixes.has(0xfd0000cc00dd30900000000000000000n)).toBe(true);
      // Forged prefixes with non-RFC-7050 lower 32 bits must be rejected
      expect(prefixes.has(0xfd000badcafe99990000000000000000n)).toBe(false);
      expect(prefixes.has(0xfd00deadbeef11110000000000000000n)).toBe(false);
    });

    it('Test 7.3: Per-prefix TTL eviction strictly expires stale NAT64 prefixes while preserving active non-expired prefixes', async () => {
      const guard = new PushSsrfGuard();
      guard.clearDiscoveredNat64Prefixes();

      const t0 = 1_700_000_000_000;
      let currentNow = t0;
      const dateNowSpy = jest
        .spyOn(Date, 'now')
        .mockImplementation(() => currentNow);

      try {
        // Step 1 (t = t0): Learn Prefix A (fd00:aa:bb:2090::/96) via dual-stack response
        // Expires at t0 + 300,000ms (5 minutes)
        guard.setDnsLookup(async (host) => {
          if (host === 'ipv4only.arpa') return [];
          return [
            { address: '216.239.36.57', family: 4 },
            { address: 'fd00:aa:bb:2090::d8ef:2439', family: 6 },
          ];
        });

        await guard.resolveAndValidateEndpoint(
          'https://fcm.googleapis.com/fcm/send/token-t0',
        );

        const prefixA = 0xfd0000aa00bb20900000000000000000n;
        const prefixB = 0xfd0000cc00dd30900000000000000000n;
        expect(guard.getDiscoveredNat64Prefixes().has(prefixA)).toBe(true);

        // Step 2 (t = t0 + 2 min): Learn Prefix B (fd00:cc:dd:3090::/96) while Prefix A is still valid
        // Prefix B expires at t0 + 120,000 + 300,000 = t0 + 420,000ms
        currentNow = t0 + 2 * 60 * 1000;
        guard.setDnsLookup(async (host) => {
          if (host === 'ipv4only.arpa') return [];
          return [
            { address: '216.239.36.57', family: 4 },
            { address: 'fd00:cc:dd:3090::d8ef:2439', family: 6 },
          ];
        });

        await guard.resolveAndValidateEndpoint(
          'https://fcm.googleapis.com/fcm/send/token-t1',
        );

        // Both Prefix A and Prefix B must be active at t0 + 2 min
        const prefixesAt2Min = guard.getDiscoveredNat64Prefixes();
        expect(prefixesAt2Min.has(prefixA)).toBe(true);
        expect(prefixesAt2Min.has(prefixB)).toBe(true);

        // Step 3 (t = t0 + 5 min + 1 ms): Prefix A TTL has expired, but Prefix B still has ~2 min left
        currentNow = t0 + 5 * 60 * 1000 + 1;
        const prefixesAt5Min = guard.getDiscoveredNat64Prefixes();
        expect(prefixesAt5Min.has(prefixA)).toBe(false); // Evicted!
        expect(prefixesAt5Min.has(prefixB)).toBe(true); // Preserved!

        // Attempting to use expired Prefix A without a corroborating public IPv4 A record MUST fail
        guard.setDnsLookup(async (host) => {
          if (host === 'ipv4only.arpa') return [];
          return [{ address: 'fd00:aa:bb:2090::d8ef:2439', family: 6 }];
        });

        await expect(
          guard.resolveAndValidateEndpoint(
            'https://fcm.googleapis.com/fcm/send/token-expired-prefix-a',
          ),
        ).rejects.toThrow(PushSsrfException);

        // Meanwhile, still-valid Prefix B continues to work for valid public embedded IPv4
        guard.setDnsLookup(async (host) => {
          if (host === 'ipv4only.arpa') return [];
          return [{ address: 'fd00:cc:dd:3090::d8ef:2439', family: 6 }];
        });

        const validTargetB = await guard.resolveAndValidateEndpoint(
          'https://fcm.googleapis.com/fcm/send/token-active-prefix-b',
        );
        expect(validTargetB.pinnedAddress).toBe('fd00:cc:dd:3090::d8ef:2439');
        expect(validTargetB.family).toBe(6);
      } finally {
        dateNowSpy.mockRestore();
      }
    });

    it('Test 7.4: Cross-request DNS changes after dynamic prefix learning strictly reject embedded private IPv4, loopback, and link-local/metadata', async () => {
      const guard = new PushSsrfGuard();
      guard.clearDiscoveredNat64Prefixes();

      // Request 1: Normal dual-stack response dynamically learns fd00:aa:bb:2090::/96
      guard.setDnsLookup(async (host) => {
        if (host === 'ipv4only.arpa') return [];
        return [
          { address: '216.239.36.57', family: 4 },
          { address: 'fd00:aa:bb:2090::d8ef:2439', family: 6 },
        ];
      });

      const firstTarget = await guard.resolveAndValidateEndpoint(
        'https://fcm.googleapis.com/fcm/send/token-req-1',
      );
      expect(firstTarget.pinnedAddress).toBe('216.239.36.57');
      expect(firstTarget.family).toBe(4);
      expect(
        guard
          .getDiscoveredNat64Prefixes()
          .has(0xfd0000aa00bb20900000000000000000n),
      ).toBe(true);

      // Request 2..N: DNS changes across subsequent requests attempting to pivot into internal/non-public ranges under the learned NAT64 prefix
      const forbiddenTranslatedRecords = [
        'fd00:aa:bb:2090::0a00:0001', // 10.0.0.1 (RFC 1918 Private)
        'fd00:aa:bb:2090::ac10:0001', // 172.16.0.1 (RFC 1918 Private)
        'fd00:aa:bb:2090::c0a8:0101', // 192.168.1.1 (RFC 1918 Private)
        'fd00:aa:bb:2090::7f00:0001', // 127.0.0.1 (Loopback)
        'fd00:aa:bb:2090::a9fe:a9fe', // 169.254.169.254 (Link-Local / Cloud Metadata)
        'fd00:aa:bb:2090::0000:0001', // 0.0.0.1 (RFC 1122 "This" network)
        'fd00:aa:bb:2090::6440:0001', // 100.64.0.1 (RFC 6598 CGNAT)
      ];

      for (const badV6 of forbiddenTranslatedRecords) {
        // Case A: AAAA-only response with embedded non-public IPv4
        guard.setDnsLookup(async (host) => {
          if (host === 'ipv4only.arpa') return [];
          return [{ address: badV6, family: 6 }];
        });

        await expect(
          guard.resolveAndValidateEndpoint(
            'https://fcm.googleapis.com/fcm/send/token-pivot-attempt',
          ),
        ).rejects.toThrow(PushSsrfException);

        // Case B: Mixed valid public IPv4 + poisoned NAT64 record in same response
        guard.setDnsLookup(async (host) => {
          if (host === 'ipv4only.arpa') return [];
          return [
            { address: '216.239.36.57', family: 4 },
            { address: badV6, family: 6 },
          ];
        });

        await expect(
          guard.resolveAndValidateEndpoint(
            'https://fcm.googleapis.com/fcm/send/token-mixed-pivot-attempt',
          ),
        ).rejects.toThrow(PushSsrfException);
      }
    });
  });
});
