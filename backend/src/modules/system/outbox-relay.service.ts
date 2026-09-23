import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OutboxEvent, OutboxStatus } from '../../entities/outbox-event.entity';
import { BusinessEvent } from '../../shared/contracts/business-event.contract';

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);
  private isProcessing = false;
  readonly batchSize: number;

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepo: Repository<OutboxEvent>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.batchSize = parseInt(process.env.OUTBOX_BATCH_SIZE || '50', 10);
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

      let delivered = false;
      try {
        // Publish canonical event to in-process EventEmitter2
        delivered = Boolean(this.eventEmitter.emit(canonicalEvent.eventName, canonicalEvent));
      } catch (publishError: any) {
        // Publish failure: increment retry_count, save sanitized error_message, keep PENDING
        event.retry_count = (Number(event.retry_count) || 0) + 1;
        event.error_message = this.sanitizeErrorMessage(publishError);
        await queryRunner.manager.save(OutboxEvent, event);
        await queryRunner.commitTransaction();
        return 'FAILED';
      }

      // Hard Delivery Rule: If zero listeners accepted the event, do NOT mark PUBLISHED
      if (!delivered) {
        this.logger.debug(
          `Zero listeners accepted canonical event '${canonicalEvent.eventName}' (id: ${event.id}). Retaining as PENDING.`,
        );
        await queryRunner.rollbackTransaction();
        return 'SKIPPED';
      }

      // Publish success: transition to PUBLISHED with published_at timestamp
      event.status = OutboxStatus.PUBLISHED;
      event.published_at = new Date();
      event.error_message = null;
      await queryRunner.manager.save(OutboxEvent, event);
      await queryRunner.commitTransaction();

      return 'SUCCESS';
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
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
}
