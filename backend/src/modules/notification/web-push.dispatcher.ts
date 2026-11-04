import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as https from 'https';
import * as tls from 'tls';
import { PushOutbox } from '../../entities/push-outbox.entity';
import {
  IPushDispatcher,
  PushDispatchOutcome,
  PushSubscriptionItem,
  SubscriptionDeliveryResult,
} from './push-outbox.contract';
import {
  PushSsrfGuard,
  PushSsrfException,
  ValidatedPushTarget,
} from './push-ssrf.guard';
import { PushSubscriptionService } from './push-subscription.service';

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface ValidatedVapidContext {
  publicKeyB64Url: string;
  subject: string;
  privateKeyObject: crypto.KeyObject;
}

export interface OutboundPushHttpRequest {
  target: ValidatedPushTarget;
  headers: Record<string, string | number>;
  body: Buffer;
  timeoutMs: number;
}

export interface OutboundPushHttpResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
}

export type PushHttpTransport = (
  req: OutboundPushHttpRequest,
) => Promise<OutboundPushHttpResponse>;

@Injectable()
export class WebPushDispatcher implements IPushDispatcher {
  private readonly logger = new Logger(WebPushDispatcher.name);
  private customVapidConfig?: Partial<VapidConfig> | null;
  private httpTransport: PushHttpTransport;
  private readonly timeoutMs: number = 5000;
  private readonly concurrencyLimit: number = 10;

  constructor(private readonly ssrfGuard: PushSsrfGuard) {
    this.httpTransport = (req) => this.executeHttpsPostWithIpPinning(req);
  }

  /**
   * Allows overriding VAPID configuration in unit/integration tests.
   */
  public setVapidConfig(config: Partial<VapidConfig> | null): void {
    this.customVapidConfig = config;
  }

  /**
   * Allows overriding the outbound HTTP transport in unit/integration tests.
   */
  public setHttpTransport(transport: PushHttpTransport): void {
    this.httpTransport = transport;
  }

  /**
   * Encodes a Buffer into RFC 4648 base64url without padding.
   */
  public static toBase64Url(buf: Buffer): string {
    return buf
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  /**
   * Returns current VAPID readiness status without throwing or exposing secrets.
   */
  public getVapidStatus(): {
    configured: boolean;
    publicKey: string | null;
    reason?: string;
  } {
    try {
      const ctx = this.resolveAndValidateVapid();
      return {
        configured: true,
        publicKey: ctx.publicKeyB64Url,
      };
    } catch (err: any) {
      return {
        configured: false,
        publicKey: null,
        reason: this.sanitizeMessage(err?.message || 'VAPID not configured'),
      };
    }
  }

  /**
   * Returns the VAPID public key for browser subscription handshake, or throws 503 if disabled.
   */
  public getPublicKeyOrThrow(): string {
    const status = this.getVapidStatus();
    if (!status.configured || !status.publicKey) {
      throw new ServiceUnavailableException(
        'Web Push VAPID public key is not configured on this server',
      );
    }
    return status.publicKey;
  }

  /**
   * Validates VAPID configuration (public key, private key, subject) and builds
   * a Node.js KeyObject for ES256 signing.
   */
  public resolveAndValidateVapid(): ValidatedVapidContext {
    const rawPub =
      this.customVapidConfig !== undefined
        ? this.customVapidConfig?.publicKey || ''
        : process.env.VAPID_PUBLIC_KEY || '';
    const rawPriv =
      this.customVapidConfig !== undefined
        ? this.customVapidConfig?.privateKey || ''
        : process.env.VAPID_PRIVATE_KEY || '';
    const rawSub =
      this.customVapidConfig !== undefined
        ? this.customVapidConfig?.subject || ''
        : process.env.VAPID_SUBJECT || '';

    if (!rawPub.trim() || !rawPriv.trim() || !rawSub.trim()) {
      throw new Error(
        'VAPID_ERROR: Missing VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, or VAPID_SUBJECT',
      );
    }

    const subject = rawSub.trim();
    if (!subject.startsWith('mailto:') && !subject.startsWith('https://')) {
      throw new Error(
        'VAPID_ERROR: VAPID_SUBJECT must be a valid "mailto:" or "https://" URI',
      );
    }

    const pubBuf = PushSubscriptionService.decodeBase64Url(rawPub);
    if (pubBuf.length !== 65 || pubBuf[0] !== 0x04) {
      throw new Error(
        'VAPID_ERROR: VAPID_PUBLIC_KEY must decode to 65-byte uncompressed P-256 point',
      );
    }

    const privBuf = PushSubscriptionService.decodeBase64Url(rawPriv);
    if (privBuf.length !== 32) {
      throw new Error(
        'VAPID_ERROR: VAPID_PRIVATE_KEY must decode to 32-byte P-256 private scalar',
      );
    }

    // Verify mathematical correspondence between private scalar and public key point
    let derivedPub: Buffer;
    try {
      const ecdh = crypto.createECDH('prime256v1');
      ecdh.setPrivateKey(privBuf);
      derivedPub = ecdh.getPublicKey();
    } catch {
      throw new Error('VAPID_ERROR: Invalid P-256 private scalar');
    }

    if (!derivedPub.equals(pubBuf)) {
      throw new Error(
        'VAPID_ERROR: VAPID_PUBLIC_KEY does not match VAPID_PRIVATE_KEY',
      );
    }

    const xB64Url = WebPushDispatcher.toBase64Url(pubBuf.subarray(1, 33));
    const yB64Url = WebPushDispatcher.toBase64Url(pubBuf.subarray(33, 65));
    const dB64Url = WebPushDispatcher.toBase64Url(privBuf);

    const privateKeyObject = crypto.createPrivateKey({
      key: {
        kty: 'EC',
        crv: 'P-256',
        x: xB64Url,
        y: yB64Url,
        d: dB64Url,
      },
      format: 'jwk',
    });

    return {
      publicKeyB64Url: WebPushDispatcher.toBase64Url(pubBuf),
      subject,
      privateKeyObject,
    };
  }

  /**
   * Generates RFC 8292 VAPID Authorization header (ES256 JWT).
   */
  public createVapidAuthorizationHeader(
    audienceOrigin: string,
    vapid: ValidatedVapidContext,
  ): string {
    const header = { typ: 'JWT', alg: 'ES256' };
    const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 hours
    const payload = {
      aud: audienceOrigin,
      exp,
      sub: vapid.subject,
    };

    const headerB64 = WebPushDispatcher.toBase64Url(
      Buffer.from(JSON.stringify(header), 'utf8'),
    );
    const payloadB64 = WebPushDispatcher.toBase64Url(
      Buffer.from(JSON.stringify(payload), 'utf8'),
    );
    const signingInput = `${headerB64}.${payloadB64}`;

    const signature = crypto.sign(
      'sha256',
      Buffer.from(signingInput, 'utf8'),
      {
        key: vapid.privateKeyObject,
        dsaEncoding: 'ieee-p1363',
      },
    );

    const jwt = `${signingInput}.${WebPushDispatcher.toBase64Url(signature)}`;
    return `vapid t=${jwt}, k=${vapid.publicKeyB64Url}`;
  }

  /**
   * Encrypts push payload per RFC 8291 (Web Push Message Encryption) and
   * RFC 8188 (aes128gcm Content-Encoding).
   */
  public encryptPayloadRfc8291(
    payloadUtf8: string,
    clientP256dhBase64: string,
    clientAuthBase64: string,
  ): Buffer {
    const uaPublic = PushSubscriptionService.decodeBase64Url(clientP256dhBase64);
    if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) {
      throw new Error('VAPID_ERROR: Invalid client p256dh public key');
    }

    const authSecret = PushSubscriptionService.decodeBase64Url(clientAuthBase64);
    if (authSecret.length !== 16) {
      throw new Error('VAPID_ERROR: Invalid client auth secret length');
    }

    const serverEcdh = crypto.createECDH('prime256v1');
    const asPublic = serverEcdh.generateKeys(); // 65-byte uncompressed P-256 public key
    const ecdhSecret = serverEcdh.computeSecret(uaPublic); // 32-byte shared secret
    const salt = crypto.randomBytes(16);

    // RFC 8291 Section 3.3: key_info = "WebPush: info" || 0x00 || ua_public || as_public
    const keyInfo = Buffer.concat([
      Buffer.from('WebPush: info\0', 'utf8'),
      uaPublic,
      asPublic,
    ]);
    const ikm = Buffer.from(
      crypto.hkdfSync('sha256', ecdhSecret, authSecret, keyInfo, 32),
    );

    // RFC 8188 / RFC 8291 Section 3.4: CEK (16 bytes) and NONCE (12 bytes)
    const cekInfo = Buffer.from('Content-Encoding: aes128gcm\0', 'utf8');
    const cek = Buffer.from(
      crypto.hkdfSync('sha256', ikm, salt, cekInfo, 16),
    );

    const nonceInfo = Buffer.from('Content-Encoding: nonce\0', 'utf8');
    const nonce = Buffer.from(
      crypto.hkdfSync('sha256', ikm, salt, nonceInfo, 12),
    );

    // Final record padding delimiter 0x02 per RFC 8188 Section 2
    const plaintextWithDelimiter = Buffer.concat([
      Buffer.from(payloadUtf8, 'utf8'),
      Buffer.from([0x02]),
    ]);

    const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
    const ciphertext = Buffer.concat([
      cipher.update(plaintextWithDelimiter),
      cipher.final(),
      cipher.getAuthTag(),
    ]);

    // RFC 8188 Section 2.1 header: salt (16B) || rs (4B uint32BE = 4096) || idlen (1B = 65) || keyid (65B)
    const header = Buffer.alloc(21 + asPublic.length);
    salt.copy(header, 0, 0, 16);
    header.writeUInt32BE(4096, 16);
    header.writeUInt8(asPublic.length, 20);
    asPublic.copy(header, 21);

    return Buffer.concat([header, ciphertext]);
  }

  /**
   * Fase C: Executes Web Push dispatch across pending subscriptions strictly
   * outside any database transaction.
   */
  public async dispatch(
    job: PushOutbox,
    subscriptions: PushSubscriptionItem[],
  ): Promise<PushDispatchOutcome> {
    if (!subscriptions || subscriptions.length === 0) {
      return { results: [] };
    }

    // Validate VAPID configuration upfront before any network call
    let vapidContext: ValidatedVapidContext;
    try {
      vapidContext = this.resolveAndValidateVapid();
    } catch (vapidErr: any) {
      const sanitized = this.sanitizeMessage(
        vapidErr?.message || 'VAPID_ERROR: Invalid VAPID configuration',
      );
      this.logger.error(
        `[WebPushDispatcher] Aborting job id=${job.id} due to VAPID error: ${sanitized}`,
      );
      return {
        results: subscriptions.map((sub) => ({
          subscriptionId: sub.id,
          endpointHash: PushSubscriptionService.computeEndpointHash(
            sub.endpoint || `sub-${sub.id}`,
          ),
          status: 'PERMANENT_FAILURE',
          error: sanitized,
        })),
      };
    }

    const preview = job.payloadPreview || {};
    const actionTarget = preview.actionTarget || preview.actionLink || '';
    const actionLink = preview.actionLink || preview.actionTarget || '';

    const payloadJson = JSON.stringify({
      ...preview,
      actionTarget,
      actionLink,
      tag: job.dedupeKey,
      notificationId: job.notificationId,
      eventId: job.eventId,
      purpose: job.purpose,
    });

    const results: SubscriptionDeliveryResult[] = [];
    // Process in chunks bounded by concurrencyLimit (10)
    for (let i = 0; i < subscriptions.length; i += this.concurrencyLimit) {
      const chunk = subscriptions.slice(i, i + this.concurrencyLimit);
      const chunkResults = await Promise.all(
        chunk.map((sub) =>
          this.dispatchToSingleSubscription(sub, payloadJson, vapidContext),
        ),
      );
      results.push(...chunkResults);
    }

    return { results };
  }

  private async dispatchToSingleSubscription(
    sub: PushSubscriptionItem,
    payloadJson: string,
    vapidContext: ValidatedVapidContext,
  ): Promise<SubscriptionDeliveryResult> {
    const endpointHash = PushSubscriptionService.computeEndpointHash(
      sub.endpoint || `sub-${sub.id}`,
    );

    // Step 1: Execute 8-Layer SSRF Guard (URL syntax, port, userinfo, allowlist, DNS + RFC 6890 IP check)
    let validatedTarget: ValidatedPushTarget;
    try {
      validatedTarget = await this.ssrfGuard.resolveAndValidateEndpoint(
        sub.endpoint,
      );
    } catch (ssrfErr: any) {
      const errMsg = this.sanitizeMessage(
        ssrfErr instanceof PushSsrfException
          ? ssrfErr.message
          : `SSRF_REJECTED: ${ssrfErr?.message || 'Endpoint validation failed'}`,
        [sub.endpoint, sub.auth, sub.p256dh],
      );
      this.logger.warn(
        `[WebPushDispatcher] SSRF policy blocked subscriptionId=${sub.id} hash=${endpointHash.slice(0, 12)}: ${errMsg}`,
      );
      return {
        subscriptionId: sub.id,
        endpointHash,
        status: 'PERMANENT_FAILURE',
        error: errMsg,
      };
    }

    // Step 2: Encrypt payload per RFC 8291 and build VAPID Authorization header per RFC 8292
    let encryptedBody: Buffer;
    let authHeader: string;
    try {
      encryptedBody = this.encryptPayloadRfc8291(
        payloadJson,
        sub.p256dh || '',
        sub.auth || '',
      );
      authHeader = this.createVapidAuthorizationHeader(
        validatedTarget.url.origin,
        vapidContext,
      );
    } catch (cryptoErr: any) {
      const sanitized = this.sanitizeMessage(
        cryptoErr?.message || 'VAPID_ERROR: Payload encryption failed',
        [sub.endpoint, sub.auth, sub.p256dh],
      );
      return {
        subscriptionId: sub.id,
        endpointHash,
        status: 'PERMANENT_FAILURE',
        error: sanitized,
      };
    }

    // Step 3: Execute HTTPS POST with Socket IP Pinning (Layer 7), Redirect Prohibition (Layer 5), and 5s Timeout (Layer 8)
    try {
      const response = await this.httpTransport({
        target: validatedTarget,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          'Content-Length': encryptedBody.length,
          TTL: 86400,
          Urgency: 'high',
          Authorization: authHeader,
        },
        body: encryptedBody,
        timeoutMs: this.timeoutMs,
      });

      const code = response.statusCode;

      // 200 OK / 201 Created / 202 Accepted -> Gateway Accepted
      if (code >= 200 && code < 300) {
        return {
          subscriptionId: sub.id,
          endpointHash,
          status: 'ACCEPTED_BY_GATEWAY',
          httpCode: code,
        };
      }

      // Layer 5: Reject any 3xx redirect response as an SSRF violation
      if (code >= 300 && code < 400) {
        return {
          subscriptionId: sub.id,
          endpointHash,
          status: 'PERMANENT_FAILURE',
          httpCode: code,
          error: `SSRF_REJECTED [Layer 5]: HTTP redirect (${code}) is forbidden`,
        };
      }

      // 404 Not Found / 410 Gone -> Subscription Expired or Revoked
      if (code === 404 || code === 410) {
        return {
          subscriptionId: sub.id,
          endpointHash,
          status: 'INVALID_410',
          httpCode: code,
          error: `INVALID_SUBSCRIPTION_410: Gateway returned HTTP ${code}`,
        };
      }

      // 429 Too Many Requests -> Rate Limit (Retryable)
      if (code === 429) {
        return {
          subscriptionId: sub.id,
          endpointHash,
          status: 'FAILED_RETRYABLE',
          httpCode: 429,
          error: 'RATE_LIMIT_429: Gateway rate limit exceeded',
        };
      }

      // 5xx -> Gateway Downstream Error (Retryable)
      if (code >= 500 && code <= 599) {
        return {
          subscriptionId: sub.id,
          endpointHash,
          status: 'FAILED_RETRYABLE',
          httpCode: code,
          error: `GATEWAY_5XX: Gateway returned HTTP ${code}`,
        };
      }

      // 400 / 401 / 403 or other 4xx -> Permanent VAPID / Request Error (No Retry)
      return {
        subscriptionId: sub.id,
        endpointHash,
        status: 'PERMANENT_FAILURE',
        httpCode: code,
        error: `VAPID_ERROR: Gateway rejected request with HTTP ${code}`,
      };
    } catch (netErr: any) {
      const rawCode = netErr?.code || '';
      const rawMsg = netErr?.message || 'Network dispatch error';
      const sanitized = this.sanitizeMessage(rawMsg, [
        sub.endpoint,
        sub.auth,
        sub.p256dh,
        authHeader,
      ]);

      if (
        rawCode === 'ETIMEDOUT' ||
        rawCode === 'ESOCKETTIMEDOUT' ||
        sanitized.includes('ETIMEDOUT') ||
        sanitized.toLowerCase().includes('timeout')
      ) {
        return {
          subscriptionId: sub.id,
          endpointHash,
          status: 'FAILED_RETRYABLE',
          error: `ETIMEDOUT: ${sanitized}`,
        };
      }

      return {
        subscriptionId: sub.id,
        endpointHash,
        status: 'FAILED_RETRYABLE',
        error: `ECONNRESET: ${sanitized}`,
      };
    }
  }

  /**
   * Native HTTPS POST transport enforcing:
   * - Layer 5: Zero redirect following
   * - Layer 7: Socket IP pinning (`lookup` returns pinned IP) with TLS SNI preservation (`servername`)
   * - Layer 8: Strict 5000ms socket/request timeout
   */
  private executeHttpsPostWithIpPinning(
    req: OutboundPushHttpRequest,
  ): Promise<OutboundPushHttpResponse> {
    return new Promise((resolve, reject) => {
      const { target, headers, body, timeoutMs } = req;

      const options: https.RequestOptions = {
        protocol: 'https:',
        hostname: target.hostname,
        port: 443,
        path: `${target.url.pathname}${target.url.search}`,
        method: 'POST',
        headers,
        servername: target.hostname, // Preserve TLS SNI for pinned IP
        family: target.family,
        lookup: (_hostname, optsOrCallback: any, maybeCallback?: any) => {
          const cb =
            typeof optsOrCallback === 'function' ? optsOrCallback : maybeCallback;
          const opts =
            typeof optsOrCallback === 'object' && optsOrCallback !== null
              ? optsOrCallback
              : undefined;
          if (typeof cb === 'function') {
            if (opts && (opts as any).all) {
              cb(null, [{ address: target.pinnedAddress, family: target.family }]);
            } else {
              cb(null, target.pinnedAddress, target.family);
            }
          }
        },
        checkServerIdentity: (servername, cert) => {
          return tls.checkServerIdentity(servername, cert);
        },
      };

      const request = https.request(options, (res) => {
        // Drain response body promptly to free socket
        res.on('data', () => {});
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 500,
            headers: res.headers,
          });
        });
      });

      request.setTimeout(timeoutMs, () => {
        const timeoutErr: any = new Error(
          `ETIMEDOUT: Push gateway request timed out after ${timeoutMs}ms`,
        );
        timeoutErr.code = 'ETIMEDOUT';
        request.destroy(timeoutErr);
      });

      request.on('error', (err) => {
        reject(err);
      });

      request.write(body);
      request.end();
    });
  }

  /**
   * Redacts any sensitive key material, capability URLs, or VAPID tokens from diagnostic messages.
   */
  public sanitizeMessage(
    message: string,
    extraSecrets: Array<string | undefined | null> = [],
  ): string {
    if (!message) return 'Unknown error';
    let sanitized = String(message);

    const envPriv = process.env.VAPID_PRIVATE_KEY;
    const customPriv = this.customVapidConfig?.privateKey;

    const secrets = [envPriv, customPriv, ...extraSecrets].filter(
      (s): s is string => Boolean(s && typeof s === 'string' && s.length >= 6),
    );

    for (const secret of secrets) {
      sanitized = sanitized.split(secret).join('[REDACTED]');
    }

    // Redact any full capability endpoint paths (keep only origin if URL appears)
    sanitized = sanitized.replace(
      /https?:\/\/([^\s/?#]+)\/[^\s"']*/gi,
      'https://$1/[REDACTED_PATH]',
    );

    // Redact any JWT tokens
    sanitized = sanitized.replace(
      /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      '[REDACTED_JWT]',
    );

    return sanitized.slice(0, 300);
  }
}

