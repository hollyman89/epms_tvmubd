import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { PushSubscription } from '../../entities/push-subscription.entity';
import {
  IPushSubscriptionProvider,
  PushSubscriptionItem,
} from './push-outbox.contract';
import { PushSsrfGuard, PushSsrfException } from './push-ssrf.guard';

export interface UpsertPushSubscriptionInput {
  endpoint: string;
  keys?: {
    p256dh: string;
    auth: string;
  };
  p256dh?: string;
  auth?: string;
  userAgent?: string | null;
}

export interface SanitizedPushSubscriptionView {
  id: number;
  userId: number;
  endpointHash: string;
  endpointOrigin: string;
  userAgent: string | null;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PushSubscriptionService implements IPushSubscriptionProvider {
  constructor(
    @InjectRepository(PushSubscription)
    private readonly subscriptionRepo: Repository<PushSubscription>,
    private readonly ssrfGuard: PushSsrfGuard,
  ) {}

  /**
   * Computes deterministic SHA-256 hex digest (64 chars) of the trimmed endpoint URL.
   */
  public static computeEndpointHash(endpoint: string): string {
    return crypto
      .createHash('sha256')
      .update(endpoint.trim())
      .digest('hex');
  }

  /**
   * Decodes standard base64 or base64url strings safely.
   */
  public static decodeBase64Url(input: string): Buffer {
    if (!input || typeof input !== 'string') {
      return Buffer.alloc(0);
    }
    const trimmed = input.trim();
    if (!/^[A-Za-z0-9+/_=-]+$/.test(trimmed)) {
      return Buffer.alloc(0);
    }
    const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLen);
    return Buffer.from(padded, 'base64');
  }

  /**
   * Validates Web Push subscription input (endpoint SSRF Layers 1-4, p256dh key, and auth secret).
   */
  public validateSubscriptionInput(input: UpsertPushSubscriptionInput): {
    endpoint: string;
    endpointOrigin: string;
    endpointHash: string;
    p256dh: string;
    auth: string;
    userAgent: string | null;
  } {
    if (!input || typeof input !== 'object') {
      throw new BadRequestException('Invalid push subscription payload');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = this.ssrfGuard.validateEndpointUrlSyntax(input.endpoint);
    } catch (err: any) {
      if (err instanceof PushSsrfException) {
        throw new BadRequestException(err.message);
      }
      throw new BadRequestException('Invalid push subscription endpoint URL');
    }

    const rawP256dh = input.keys?.p256dh ?? input.p256dh ?? '';
    const rawAuth = input.keys?.auth ?? input.auth ?? '';

    const p256dhBuf = PushSubscriptionService.decodeBase64Url(rawP256dh);
    // Uncompressed P-256 ECDH public key must be 65 bytes starting with 0x04
    if (p256dhBuf.length !== 65 || p256dhBuf[0] !== 0x04) {
      throw new BadRequestException(
        'Invalid p256dh key: must be a 65-byte uncompressed P-256 public key (0x04 prefix)',
      );
    }

    const authBuf = PushSubscriptionService.decodeBase64Url(rawAuth);
    // RFC 8291 authentication secret must be 16 bytes
    if (authBuf.length !== 16) {
      throw new BadRequestException(
        'Invalid auth secret: must decode to 16 bytes per RFC 8291',
      );
    }

    const normalizedEndpoint = input.endpoint.trim();
    const endpointHash = PushSubscriptionService.computeEndpointHash(normalizedEndpoint);
    const userAgent = input.userAgent
      ? String(input.userAgent).slice(0, 500)
      : null;

    return {
      endpoint: normalizedEndpoint,
      endpointOrigin: parsedUrl.origin,
      endpointHash,
      p256dh: rawP256dh.trim(),
      auth: rawAuth.trim(),
      userAgent,
    };
  }

  /**
   * Registers or updates a push subscription bound strictly to the authenticated userId.
   * - Idempotent when the same user re-registers the same endpoint.
   * - Rejects overwriting an active subscription owned by another user (cross-user isolation).
   * - Allows re-binding only if the previous owner explicitly revoked/deactivated their subscription.
   */
  public async upsertSubscription(
    authenticatedUserId: number,
    input: UpsertPushSubscriptionInput,
  ): Promise<SanitizedPushSubscriptionView> {
    if (!authenticatedUserId || authenticatedUserId <= 0) {
      throw new ForbiddenException('Authenticated userId is required');
    }

    const validated = this.validateSubscriptionInput(input);

    const existing = await this.subscriptionRepo.findOne({
      where: { endpointHash: validated.endpointHash },
    });

    if (existing) {
      if (Number(existing.userId) !== Number(authenticatedUserId)) {
        if (existing.isActive) {
          throw new ForbiddenException(
            'Access denied: cannot overwrite an active push subscription owned by another user',
          );
        }
        // Previous owner explicitly unsubscribed on this shared browser; safe to rebind to new user
        existing.userId = authenticatedUserId;
      }

      existing.endpoint = validated.endpoint;
      existing.p256dh = validated.p256dh;
      existing.auth = validated.auth;
      existing.userAgent = validated.userAgent ?? existing.userAgent ?? null;
      existing.isActive = true;
      existing.unsubscribedAt = null;
      existing.failureReason = null;

      const saved = await this.subscriptionRepo.save(existing);
      return this.toSanitizedView(saved);
    }

    const created = this.subscriptionRepo.create({
      userId: authenticatedUserId,
      endpoint: validated.endpoint,
      endpointHash: validated.endpointHash,
      p256dh: validated.p256dh,
      auth: validated.auth,
      userAgent: validated.userAgent,
      isActive: true,
      unsubscribedAt: null,
      failureReason: null,
      lastUsedAt: null,
    });

    const saved = await this.subscriptionRepo.save(created);
    return this.toSanitizedView(saved);
  }

  /**
   * Revokes (deactivates) a subscription owned by the authenticated user.
   * Enforces strict ownership isolation: a user cannot revoke another user's subscription.
   */
  public async revokeSubscription(
    authenticatedUserId: number,
    params: { subscriptionId?: number; endpoint?: string },
  ): Promise<SanitizedPushSubscriptionView> {
    if (!authenticatedUserId || authenticatedUserId <= 0) {
      throw new ForbiddenException('Authenticated userId is required');
    }

    let existing: PushSubscription | null = null;

    if (params.subscriptionId !== undefined && params.subscriptionId !== null) {
      existing = await this.subscriptionRepo.findOne({
        where: { id: Number(params.subscriptionId) },
      });
    } else if (params.endpoint && typeof params.endpoint === 'string') {
      const endpointHash = PushSubscriptionService.computeEndpointHash(params.endpoint);
      existing = await this.subscriptionRepo.findOne({
        where: { endpointHash },
      });
    } else {
      throw new BadRequestException(
        'Either subscriptionId or endpoint must be provided to revoke a subscription',
      );
    }

    if (!existing) {
      throw new NotFoundException('Push subscription not found');
    }

    if (Number(existing.userId) !== Number(authenticatedUserId)) {
      throw new ForbiddenException(
        'Access denied: cannot revoke or modify a subscription belonging to another user',
      );
    }

    existing.isActive = false;
    existing.unsubscribedAt = new Date();

    const saved = await this.subscriptionRepo.save(existing);
    return this.toSanitizedView(saved);
  }

  /**
   * Lists active subscriptions belonging strictly to the authenticated user (sanitized metadata only).
   */
  public async listUserSubscriptions(
    authenticatedUserId: number,
  ): Promise<SanitizedPushSubscriptionView[]> {
    if (!authenticatedUserId || authenticatedUserId <= 0) {
      throw new ForbiddenException('Authenticated userId is required');
    }

    const records = await this.subscriptionRepo.find({
      where: {
        userId: Number(authenticatedUserId),
        isActive: true,
      },
      order: { id: 'DESC' },
    });

    return records.map((r) => this.toSanitizedView(r));
  }

  /**
   * IPushSubscriptionProvider implementation for PushOutboxWorker (Fase B).
   */
  public async getSubscriptionsForUser(
    userId: number,
  ): Promise<PushSubscriptionItem[]> {
    const records = await this.subscriptionRepo.find({
      where: {
        userId: Number(userId),
        isActive: true,
      },
      order: { id: 'ASC' },
    });

    return records.map((r) => ({
      id: Number(r.id),
      userId: Number(r.userId),
      endpoint: r.endpoint,
      p256dh: r.p256dh,
      auth: r.auth,
      isActive: Boolean(r.isActive),
    }));
  }

  /**
   * IPushSubscriptionProvider implementation for PushOutboxWorker (Fase D).
   * Removes only the specific invalid subscriptions (e.g., 404/410 Gone or SSRF blocked)
   * without affecting other active devices of the recipient.
   */
  public async removeInvalidSubscriptions(
    subscriptionIds: number[],
  ): Promise<void> {
    if (!subscriptionIds || subscriptionIds.length === 0) {
      return;
    }
    const cleanIds = subscriptionIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (cleanIds.length === 0) {
      return;
    }
    await this.subscriptionRepo.delete({ id: In(cleanIds) });
  }

  private toSanitizedView(entity: PushSubscription): SanitizedPushSubscriptionView {
    let endpointOrigin = 'https://unknown';
    try {
      endpointOrigin = new URL(entity.endpoint).origin;
    } catch {
      // fallback
    }

    return {
      id: Number(entity.id),
      userId: Number(entity.userId),
      endpointHash: entity.endpointHash,
      endpointOrigin,
      userAgent: entity.userAgent ?? null,
      isActive: Boolean(entity.isActive),
      lastUsedAt: entity.lastUsedAt ?? null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}

