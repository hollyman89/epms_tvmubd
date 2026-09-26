import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { NotificationGateway } from './notification.gateway';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  CanonicalNotificationError,
  CanonicalNotificationInput,
  CanonicalNotificationResult,
} from './canonical-notification.contract';

@Injectable()
export class CanonicalNotificationWriter {
  private readonly logger = new Logger(CanonicalNotificationWriter.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly notificationGateway: NotificationGateway,
    @Optional()
    @InjectQueue('email-send')
    private readonly emailQueue?: Queue,
  ) {}

  /**
   * Deterministic Dedupe Key Generator
   * Format: <eventId>:<recipientId>:<purpose>
   * Bounded by VARCHAR(191) MySQL column length.
   */
  public generateDedupeKey(eventId: string, recipientId: number, purpose: string): string {
    const cleanEventId = String(eventId).trim();
    const cleanPurpose = String(purpose).trim().toUpperCase();
    const key = `${cleanEventId}:${recipientId}:${cleanPurpose}`;
    if (key.length > 191) {
      return key.slice(0, 191);
    }
    return key;
  }

  /**
   * Persists exactly one canonical Bell notification with deterministic deduplication
   * and at-least-once race-safe idempotency.
   */
  public async persistCanonicalNotification(
    input: CanonicalNotificationInput,
  ): Promise<CanonicalNotificationResult> {
    // 1. Strict Contract Validation
    this.validateInput(input);

    const cleanEventId = input.eventId.trim();
    const cleanPurpose = input.purpose.trim().toUpperCase();
    const dedupeKey = this.generateDedupeKey(cleanEventId, input.recipientId, cleanPurpose);

    // 2. Construct Entity
    const notif = new Notification();
    notif.userId = input.recipientId;
    notif.title = input.title.trim();
    notif.message = input.message.trim();
    notif.notificationType = this.mapNotificationType(input.type);
    notif.actionLink = input.actionTarget || '';
    notif.dedupeKey = dedupeKey;
    notif.isRead = false;
    notif.createdBy = 0; // system
    notif.createdAt = new Date();
    notif.metaData = {
      ...(input.metaData || {}),
      eventId: cleanEventId,
      purpose: cleanPurpose,
    };

    // 3. Race-Safe Atomic Persistence
    try {
      const saved = await this.notificationRepo.save(notif);

      // 4. Real-time WebSocket emission strictly on successful new persistence
      this.notificationGateway.sendNotificationToUser(saved.userId, saved);

      // 5. Optional Email dispatch (only on new persistent Bell record)
      if (input.sendEmail && this.emailQueue) {
        await this.queueEmailSafe(saved.userId, input.title, input.message, dedupeKey);
      }

      this.logger.log(
        `[CanonicalNotificationWriter] PERSISTED eventId=${cleanEventId} recipientId=${input.recipientId} purpose=${cleanPurpose} dedupeKey=${dedupeKey}`,
      );

      return {
        status: 'PERSISTED',
        notification: saved,
        notificationId: saved.id,
        dedupeKey,
        eventId: cleanEventId,
        recipientId: input.recipientId,
        purpose: cleanPurpose,
      };
    } catch (err: any) {
      if (this.isDuplicateKeyError(err)) {
        this.logger.warn(
          `[CanonicalNotificationWriter] DUPLICATE_SUPPRESSED eventId=${cleanEventId} recipientId=${input.recipientId} purpose=${cleanPurpose} dedupeKey=${dedupeKey}`,
        );
        return {
          status: 'DUPLICATE_SUPPRESSED',
          dedupeKey,
          eventId: cleanEventId,
          recipientId: input.recipientId,
          purpose: cleanPurpose,
        };
      }

      this.logger.error(
        `[CanonicalNotificationWriter] PERSISTENCE_FAILURE eventId=${cleanEventId} recipientId=${input.recipientId} error=${err.message}`,
        err.stack,
      );
      throw new CanonicalNotificationError(
        'PERSISTENCE_FAILURE',
        `Failed to persist canonical notification: ${err.message}`,
      );
    }
  }

  /**
   * Persists a batch of canonical notifications for multiple resolved recipients.
   */
  public async persistBatch(
    inputs: CanonicalNotificationInput[],
  ): Promise<CanonicalNotificationResult[]> {
    const results: CanonicalNotificationResult[] = [];
    for (const input of inputs) {
      const res = await this.persistCanonicalNotification(input);
      results.push(res);
    }
    return results;
  }

  private validateInput(input: CanonicalNotificationInput): void {
    if (!input || typeof input !== 'object') {
      throw new CanonicalNotificationError('INVALID_PROJECTION', 'Input payload must be an object.');
    }

    if (!input.eventId || typeof input.eventId !== 'string' || input.eventId.trim().length === 0) {
      throw new CanonicalNotificationError(
        'MISSING_EVENT_ID',
        'Canonical notification requires a valid non-empty eventId.',
      );
    }

    if (
      input.recipientId === undefined ||
      input.recipientId === null ||
      typeof input.recipientId !== 'number' ||
      isNaN(input.recipientId) ||
      input.recipientId <= 0
    ) {
      throw new CanonicalNotificationError(
        'MISSING_RECIPIENT',
        'Canonical notification requires a valid positive recipientId.',
      );
    }

    if (!input.purpose || typeof input.purpose !== 'string' || input.purpose.trim().length === 0) {
      throw new CanonicalNotificationError(
        'MISSING_PURPOSE',
        'Canonical notification requires a valid non-empty purpose.',
      );
    }

    if (input.type) {
      const normalizedType = String(input.type).trim().toUpperCase();
      if (normalizedType === 'TASK') {
        throw new CanonicalNotificationError(
          'ACTIONABLE_TASK_NOT_ALLOWED',
          'Canonical Bell notifications cannot be created with type TASK. Actionable tasks must be managed via WorkflowTask.',
        );
      }
    }

    if (!input.title || typeof input.title !== 'string' || input.title.trim().length === 0) {
      throw new CanonicalNotificationError(
        'INVALID_PROJECTION',
        'Canonical notification requires a valid non-empty title.',
      );
    }

    if (!input.message || typeof input.message !== 'string' || input.message.trim().length === 0) {
      throw new CanonicalNotificationError(
        'INVALID_PROJECTION',
        'Canonical notification requires a valid non-empty message.',
      );
    }
  }

  private mapNotificationType(type?: string): string {
    if (!type) return 'ALERT';
    const normalized = String(type).trim().toUpperCase();
    switch (normalized) {
      case 'SYSTEM':
      case 'INFO':
      case 'SUCCESS':
        return 'SYSTEM';
      case 'ALERT':
      case 'WARNING':
      case 'ERROR':
      default:
        return 'ALERT';
    }
  }

  private isDuplicateKeyError(err: any): boolean {
    return Boolean(
      err?.code === 'ER_DUP_ENTRY' ||
        err?.errno === 1062 ||
        err?.message?.includes('ER_DUP_ENTRY') ||
        err?.message?.includes('Duplicate entry') ||
        err?.message?.includes('idx_notif_user_dedupe'),
    );
  }

  private async queueEmailSafe(
    userId: number,
    title: string,
    message: string,
    dedupeKey: string,
  ): Promise<void> {
    try {
      if (this.emailQueue) {
        const userEmail = `user_${userId}@company.com`;
        await this.emailQueue.add(
          'send-email',
          {
            to: userEmail,
            subject: title,
            text: message,
            html: `<p>${message}</p>`,
          },
          {
            jobId: `email:${dedupeKey}`,
          },
        );
      }
    } catch (err: any) {
      this.logger.warn(`Failed to enqueue secondary email for user ${userId}: ${err.message}`);
    }
  }
}
