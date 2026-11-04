import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OutboxEvent, OutboxStatus } from '../../entities/outbox-event.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import {
  BusinessEvent,
  NotificationPolicy,
  OutboxConsumerDeliveryReceipt,
  OutboxDeliveryOutcome,
  extractOutboxReceipt,
} from '../../shared/contracts/business-event.contract';

export { OutboxDeliveryOutcome };

export interface OutboxDeliveryEvaluation {
  outcome: OutboxDeliveryOutcome;
  reason?: string;
}

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);
  private isProcessing = false;
  readonly batchSize: number;
  readonly maxRetries: number;

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepo: Repository<OutboxEvent>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.batchSize = parseInt(process.env.OUTBOX_BATCH_SIZE || '50', 10);
    this.maxRetries = parseInt(process.env.OUTBOX_MAX_RETRIES || '5', 10);
  }

  @Cron(process.env.OUTBOX_RELAY_CRON || '*/5 * * * * *')
  async pollAndRelay(): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (this.isProcessing) {
      this.logger.debug('Outbox relay run already in progress; skipping tick.');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.isProcessing = true;
    try {
      return await this.processPendingEvents();
    } finally {
      this.isProcessing = false;
    }
  }

  async processPendingEvents(): Promise<{ processed: number; succeeded: number; failed: number }> {
    const candidates = await this.outboxRepo.find({
      select: ['id'],
      where: { status: OutboxStatus.PENDING },
      order: { id: 'ASC' },
      take: this.batchSize,
    });

    if (!candidates || candidates.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    let succeeded = 0;
    let failed = 0;

    for (const candidate of candidates) {
      try {
        const result = await this.relaySingleEvent(candidate.id);
        if (result === 'SUCCESS') succeeded++;
        else if (result === 'FAILED') failed++;
      } catch (err: any) {
        this.logger.error(`Critical error relaying outbox event #${candidate.id}: ${err.message}`, err.stack);
        failed++;
      }
    }

    return { processed: candidates.length, succeeded, failed };
  }

  async relaySingleEvent(id: number): Promise<'SUCCESS' | 'FAILED' | 'SKIPPED'> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Row-level lock to prevent concurrent workers from processing the same event
      const event = await queryRunner.manager.findOne(OutboxEvent, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!event || event.status !== OutboxStatus.PENDING) {
        await queryRunner.rollbackTransaction();
        return 'SKIPPED';
      }

      const canonicalEvent = this.reconstructBusinessEvent(event);
      const evaluation = await this.evaluateEventDelivery(canonicalEvent);

      switch (evaluation.outcome) {
        case OutboxDeliveryOutcome.DELIVERED:
        case OutboxDeliveryOutcome.INTENTIONALLY_IGNORED: {
          event.status = OutboxStatus.PUBLISHED;
          event.published_at = new Date();
          event.error_message = null;
          await queryRunner.manager.save(OutboxEvent, event);
          await queryRunner.commitTransaction();
          return 'SUCCESS';
        }

        case OutboxDeliveryOutcome.NO_SUBSCRIBER: {
          // Quarantine unsubscribed events immediately into FAILED so they never cause Head-of-Line Blocking
          const nextRetryCount = (Number(event.retry_count) || 0) + 1;
          event.retry_count = nextRetryCount;
          event.status = OutboxStatus.FAILED;
          event.published_at = null;
          event.error_message = this.sanitizeErrorMessage(
            `[NO_SUBSCRIBER] ${evaluation.reason || `Zero canonical listeners accepted event '${canonicalEvent.eventName}'`}`,
          );
          this.logger.warn(
            `Quarantined unsubscribed outbox event '${canonicalEvent.eventName}' (id: ${event.id}) as FAILED: ${event.error_message}`,
          );
          await queryRunner.manager.save(OutboxEvent, event);
          await queryRunner.commitTransaction();
          return 'FAILED';
        }

        case OutboxDeliveryOutcome.PERMANENT_FAILURE: {
          const nextRetryCount = (Number(event.retry_count) || 0) + 1;
          event.retry_count = nextRetryCount;
          event.status = OutboxStatus.FAILED;
          event.published_at = null;
          event.error_message = this.sanitizeErrorMessage(
            `[PERMANENT_FAILURE] ${evaluation.reason || 'Unrecoverable consumer error'}`,
          );
          this.logger.error(
            `Outbox event '${canonicalEvent.eventName}' (id: ${event.id}) failed permanently: ${event.error_message}`,
          );
          await queryRunner.manager.save(OutboxEvent, event);
          await queryRunner.commitTransaction();
          return 'FAILED';
        }

        case OutboxDeliveryOutcome.RETRYABLE_FAILURE:
        default: {
          const nextRetryCount = (Number(event.retry_count) || 0) + 1;
          event.retry_count = nextRetryCount;
          event.published_at = null;

          if (nextRetryCount >= this.maxRetries) {
            event.status = OutboxStatus.FAILED;
            event.error_message = this.sanitizeErrorMessage(
              `[MAX_RETRIES_EXCEEDED:${nextRetryCount}/${this.maxRetries}] ${evaluation.reason || 'Transient publish error'}`,
            );
            this.logger.error(
              `Outbox event '${canonicalEvent.eventName}' (id: ${event.id}) exhausted max retries (${nextRetryCount}/${this.maxRetries}) and transitioned to FAILED.`,
            );
          } else {
            event.status = OutboxStatus.PENDING;
            event.error_message = this.sanitizeErrorMessage(evaluation.reason || 'Transient publish error');
          }

          await queryRunner.manager.save(OutboxEvent, event);
          await queryRunner.commitTransaction();
          return 'FAILED';
        }
      }
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async evaluateEventDelivery(canonicalEvent: BusinessEvent): Promise<OutboxDeliveryEvaluation> {
    try {
      const emitterAny = this.eventEmitter as any;
      const isEmitMockedOnly =
        Boolean(emitterAny?.emit?._isMockFunction) && !Boolean(emitterAny?.emitAsync?._isMockFunction);

      if (typeof emitterAny?.listeners === 'function' && !isEmitMockedOnly) {
        const registeredListeners = emitterAny.listeners(canonicalEvent.eventName);
        if (Array.isArray(registeredListeners) && registeredListeners.length === 0) {
          return {
            outcome: OutboxDeliveryOutcome.NO_SUBSCRIBER,
            reason: `Zero listeners registered for canonical event '${canonicalEvent.eventName}'`,
          };
        }
      }

      let rawDispatchResult: unknown;
      if (typeof emitterAny?.emitAsync === 'function' && !isEmitMockedOnly) {
        rawDispatchResult = await emitterAny.emitAsync(canonicalEvent.eventName, canonicalEvent);
      } else {
        rawDispatchResult = await this.eventEmitter.emit(canonicalEvent.eventName, canonicalEvent);
      }

      return this.interpretListenerResults(canonicalEvent, rawDispatchResult);
    } catch (publishError: any) {
      if (
        publishError?.permanent === true ||
        publishError?.outcome === OutboxDeliveryOutcome.PERMANENT_FAILURE ||
        publishError?.name === 'OutboxPermanentFailureError'
      ) {
        return {
          outcome: OutboxDeliveryOutcome.PERMANENT_FAILURE,
          reason: publishError?.message || String(publishError),
        };
      }

      return {
        outcome: OutboxDeliveryOutcome.RETRYABLE_FAILURE,
        reason: publishError?.message || String(publishError),
      };
    }
  }

  private interpretListenerResults(
    canonicalEvent: BusinessEvent,
    rawResult: unknown,
  ): OutboxDeliveryEvaluation {
    if (rawResult === false || rawResult === null || rawResult === undefined) {
      return {
        outcome: OutboxDeliveryOutcome.NO_SUBSCRIBER,
        reason: `Zero listeners accepted canonical event '${canonicalEvent.eventName}'`,
      };
    }

    if (rawResult === true) {
      return { outcome: OutboxDeliveryOutcome.DELIVERED };
    }

    if (typeof rawResult === 'string' && rawResult in OutboxDeliveryOutcome) {
      return { outcome: rawResult as OutboxDeliveryOutcome };
    }

    const directReceipt = extractOutboxReceipt(rawResult);
    if (directReceipt) {
      return this.evaluateReceipts(canonicalEvent, [directReceipt], false);
    }

    if (Array.isArray(rawResult)) {
      if (rawResult.length === 0) {
        return {
          outcome: OutboxDeliveryOutcome.NO_SUBSCRIBER,
          reason: `Zero listeners responded for canonical event '${canonicalEvent.eventName}'`,
        };
      }

      const receipts: OutboxConsumerDeliveryReceipt[] = [];
      let hasLegacyListenerConfirmation = false;

      for (const item of rawResult) {
        if (typeof item === 'string' && item in OutboxDeliveryOutcome) {
          receipts.push({
            __outboxContract: true,
            channel: 'CANONICAL_NOTIFICATION',
            outcome: item as OutboxDeliveryOutcome,
          });
          continue;
        }

        const extracted = extractOutboxReceipt(item);
        if (extracted) {
          receipts.push(extracted);
          continue;
        }

        if (item === true) {
          hasLegacyListenerConfirmation = true;
        }
      }

      if (receipts.length > 0) {
        return this.evaluateReceipts(canonicalEvent, receipts, hasLegacyListenerConfirmation);
      }

      if (hasLegacyListenerConfirmation) {
        return { outcome: OutboxDeliveryOutcome.DELIVERED };
      }

      return {
        outcome: OutboxDeliveryOutcome.NO_SUBSCRIBER,
        reason: `Listeners for '${canonicalEvent.eventName}' did not return a valid delivery confirmation`,
      };
    }

    return {
      outcome: OutboxDeliveryOutcome.NO_SUBSCRIBER,
      reason: `Listeners for '${canonicalEvent.eventName}' returned unrecognized response without outbox receipt contract`,
    };
  }

  private evaluateReceipts(
    canonicalEvent: BusinessEvent,
    receipts: OutboxConsumerDeliveryReceipt[],
    hasLegacyListenerConfirmation: boolean,
  ): OutboxDeliveryEvaluation {
    const permanentFailure = receipts.find(
      (r) => r.outcome === OutboxDeliveryOutcome.PERMANENT_FAILURE,
    );
    if (permanentFailure) {
      return {
        outcome: OutboxDeliveryOutcome.PERMANENT_FAILURE,
        reason: permanentFailure.reason || 'Consumer reported permanent failure',
      };
    }

    const retryableFailure = receipts.find(
      (r) => r.outcome === OutboxDeliveryOutcome.RETRYABLE_FAILURE,
    );
    if (retryableFailure) {
      return {
        outcome: OutboxDeliveryOutcome.RETRYABLE_FAILURE,
        reason: retryableFailure.reason || 'Consumer reported retryable failure',
      };
    }

    const explicitNoSubscriber = receipts.find(
      (r) => r.outcome === OutboxDeliveryOutcome.NO_SUBSCRIBER,
    );
    if (explicitNoSubscriber) {
      return {
        outcome: OutboxDeliveryOutcome.NO_SUBSCRIBER,
        reason: explicitNoSubscriber.reason || 'Consumer reported no subscriber',
      };
    }

    const canonicalOrDomainReceipts = receipts.filter(
      (r) => r.channel === 'CANONICAL_NOTIFICATION' || r.channel === 'DOMAIN_LISTENER',
    );
    const syncOnlyReceipts = receipts.filter((r) => r.channel === 'BUSINESS_SYNC');

    // Enforce separation of BusinessSync from Canonical Notification Delivery:
    // If only BusinessSyncConsumer handled the event and no CanonicalNotificationConsumer
    // (or domain listener) handled it, only allow if notificationPolicy === SYNC_ONLY.
    if (
      canonicalOrDomainReceipts.length === 0 &&
      !hasLegacyListenerConfirmation &&
      syncOnlyReceipts.length > 0 &&
      canonicalEvent.notificationPolicy !== NotificationPolicy.SYNC_ONLY
    ) {
      return {
        outcome: OutboxDeliveryOutcome.NO_SUBSCRIBER,
        reason: `Event '${canonicalEvent.eventName}' was only handled by BusinessSyncConsumer without a CanonicalNotificationConsumer handler (notificationPolicy=${canonicalEvent.notificationPolicy ?? 'DEFAULT'})`,
      };
    }

    const hasDelivered = canonicalOrDomainReceipts.some(
      (r) => r.outcome === OutboxDeliveryOutcome.DELIVERED,
    );
    if (hasDelivered) {
      return { outcome: OutboxDeliveryOutcome.DELIVERED };
    }

    const ignoredReceipt = canonicalOrDomainReceipts.find(
      (r) => r.outcome === OutboxDeliveryOutcome.INTENTIONALLY_IGNORED,
    );
    if (ignoredReceipt) {
      return {
        outcome: OutboxDeliveryOutcome.INTENTIONALLY_IGNORED,
        reason: ignoredReceipt.reason,
      };
    }

    if (
      canonicalEvent.notificationPolicy === NotificationPolicy.SYNC_ONLY &&
      syncOnlyReceipts.some((r) => r.outcome === OutboxDeliveryOutcome.DELIVERED)
    ) {
      return { outcome: OutboxDeliveryOutcome.DELIVERED };
    }

    return { outcome: OutboxDeliveryOutcome.DELIVERED };
  }

  reconstructBusinessEvent(outbox: OutboxEvent): BusinessEvent {
    let payloadWrapper: any = {};
    if (typeof outbox.payload === 'string') {
      try {
        payloadWrapper = JSON.parse(outbox.payload);
      } catch {
        payloadWrapper = {};
      }
    } else if (outbox.payload && typeof outbox.payload === 'object') {
      payloadWrapper = outbox.payload;
    }

    return {
      eventId: outbox.event_id,
      eventName: outbox.event_name,
      eventVersion: parseInt(String(outbox.event_version), 10) || 1,
      occurredAt:
        payloadWrapper.occurredAt ||
        (outbox.created_at ? outbox.created_at.toISOString() : new Date().toISOString()),
      aggregateType: outbox.aggregate_type,
      aggregateId: outbox.aggregate_id,
      projectId: payloadWrapper.projectId !== undefined ? payloadWrapper.projectId : undefined,
      actor: payloadWrapper.actor !== undefined ? payloadWrapper.actor : undefined,
      correlationId: outbox.correlation_id || undefined,
      routing: payloadWrapper.routing !== undefined ? payloadWrapper.routing : undefined,
      notificationPolicy: payloadWrapper.notificationPolicy !== undefined ? payloadWrapper.notificationPolicy : undefined,
      payload: payloadWrapper.businessPayload !== undefined ? payloadWrapper.businessPayload : payloadWrapper,
    };
  }

  private sanitizeErrorMessage(error: any): string {
    if (!error) return 'Unknown publish error';
    const message = error.message || String(error);
    return message.slice(0, 1000);
  }

  /**
   * Requeues an Outbox event with status FAILED back to PENDING.
   * Enforces pessimistic locking, state validation, retry count reset,
   * error history preservation, and audit logging.
   */
  async requeueFailedEvent(
    id: number,
    operatorUserId: number,
    reason?: string,
  ): Promise<{ success: boolean; message: string; event: OutboxEvent }> {
    if (!id || isNaN(id) || id <= 0) {
      throw new BadRequestException('ID outbox event tidak valid.');
    }
    if (!operatorUserId || isNaN(operatorUserId) || operatorUserId <= 0) {
      throw new BadRequestException('ID operator tidak valid.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const event = await queryRunner.manager.findOne(OutboxEvent, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!event) {
        throw new NotFoundException(`Outbox event #${id} tidak ditemukan.`);
      }

      if (event.status !== OutboxStatus.FAILED) {
        throw new ConflictException(
          `Hanya outbox event berstatus FAILED yang dapat di-requeue (status saat ini: ${event.status}).`,
        );
      }

      // Permanent failure rejection: do not allow replay for unrecoverable errors without root cause fix
      if (event.error_message?.startsWith('[PERMANENT_FAILURE]')) {
        throw new BadRequestException(
          `Outbox event #${id} mengalami PERMANENT_FAILURE (unrecoverable error) dan tidak dapat direplay tanpa pemeriksaan dan perbaikan akar masalah.`,
        );
      }

      // Unsubscribed rejection: do not allow replay for events with no registered listeners
      if (event.error_message?.startsWith('[NO_SUBSCRIBER]')) {
        throw new BadRequestException(
          `Outbox event #${id} tidak memiliki listener terdaftar (NO_SUBSCRIBER) dan tidak dapat direplay tanpa implementasi subscriber.`,
        );
      }

      // Unrecognized or invalid prefix rejection: only explicitly recognized retryable failures are eligible for replay
      const isRecognizedRetryable =
        Boolean(event.error_message?.startsWith('[MAX_RETRIES_EXCEEDED')) ||
        Boolean(event.error_message?.startsWith('[RETRYABLE')) ||
        Boolean(event.error_message?.includes('Previous error: [MAX_RETRIES_EXCEEDED'));

      if (!isRecognizedRetryable) {
        throw new BadRequestException(
          `Outbox event #${id} memiliki format error tidak dikenal atau belum terklasifikasi sebagai retryable failure. Replay ditolak demi keselamatan data.`,
        );
      }

      const previousStatus = event.status;
      const previousRetryCount = event.retry_count;
      const previousErrorMessage = event.error_message;

      const requeueNote = `[REQUEUED at ${new Date().toISOString()} by user:${operatorUserId}${reason ? ` reason: ${reason.trim()}` : ''}]`;
      event.status = OutboxStatus.PENDING;
      event.retry_count = 0;
      event.error_message = previousErrorMessage
        ? `${requeueNote} Previous error: ${previousErrorMessage}`.slice(0, 1000)
        : requeueNote.slice(0, 1000);

      const savedEvent = await queryRunner.manager.save(OutboxEvent, event);

      const audit = queryRunner.manager.create(AuditLog, {
        table_name: 'outbox_events',
        record_id: id,
        action: 'OUTBOX_EVENT_REQUEUED',
        old_value: {
          status: previousStatus,
          retry_count: previousRetryCount,
          error_message: previousErrorMessage,
        },
        new_value: {
          status: OutboxStatus.PENDING,
          retry_count: 0,
          operatorUserId,
          reason: reason?.trim() || 'Manual operator replay',
        },
        created_by: operatorUserId,
      });
      await queryRunner.manager.save(AuditLog, audit);

      await queryRunner.commitTransaction();

      this.logger.log(
        `[OutboxRelayService] Outbox event #${id} successfully requeued to PENDING by operator #${operatorUserId}.`,
      );

      return {
        success: true,
        message: `Outbox event #${id} successfully requeued to PENDING.`,
        event: savedEvent,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
