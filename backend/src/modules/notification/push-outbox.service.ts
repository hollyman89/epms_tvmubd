import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as crypto from 'crypto';
import {
  PushOutbox,
  PushOutboxStatus,
  PushErrorCategory,
} from '../../entities/push-outbox.entity';
import { ClaimedPushJob, SettleJobParams } from './push-outbox.contract';

@Injectable()
export class PushOutboxService {
  private readonly logger = new Logger(PushOutboxService.name);

  constructor(
    @InjectRepository(PushOutbox)
    private readonly pushOutboxRepo: Repository<PushOutbox>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Phase A: Job Claim (Short Transaction - Row Lock with SKIP LOCKED)
   * Claims up to `batchSize` eligible push jobs.
   * Eligible criteria:
   *  - status = 'PENDING'
   *  - status = 'FAILED_RETRYABLE' and next_retry_at <= NOW()
   *  - status = 'CLAIMED' and lease_expires_at < NOW() (orphan recovery)
   */
  public async claimBatch(
    batchSize = 20,
    leaseDurationSeconds = 30,
  ): Promise<ClaimedPushJob[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const claimedJobs: ClaimedPushJob[] = [];

    try {
      // 1. Select candidate IDs with FOR UPDATE SKIP LOCKED
      const candidates: Array<{
        id: string | number;
        status: string;
        claim_count?: number;
        claimCount?: number;
        lease_expires_at?: Date | null;
        leaseExpiresAt?: Date | null;
      }> = await queryRunner.query(
        `
        SELECT id, status, claim_count, lease_expires_at
        FROM push_outbox
        WHERE (status = ?)
           OR (status = ? AND next_retry_at <= NOW())
           OR (status = ? AND lease_expires_at < NOW())
        ORDER BY id ASC
        LIMIT ?
        FOR UPDATE SKIP LOCKED
      `,
        [
          PushOutboxStatus.PENDING,
          PushOutboxStatus.FAILED_RETRYABLE,
          PushOutboxStatus.CLAIMED,
          batchSize,
        ],
      );

      if (!candidates || candidates.length === 0) {
        await queryRunner.commitTransaction();
        return [];
      }

      const validCandidateIds: number[] = [];

      for (const row of candidates) {
        const id = Number(row.id);
        const claimCount = Number(row.claim_count ?? row.claimCount ?? 0);

        // Crash-loop poison pill protection (claim_count >= 5 and orphan CLAIMED)
        if (row.status === PushOutboxStatus.CLAIMED && claimCount >= 5) {
          await queryRunner.query(
            `
            UPDATE push_outbox
            SET status = ?,
                error_category = ?,
                last_error_message = ?,
                lease_token = NULL,
                lease_expires_at = NULL
            WHERE id = ?
          `,
            [
              PushOutboxStatus.PERMANENT_FAILURE,
              PushErrorCategory.POISON_PILL_CLAIM_EXCEEDED,
              'Job claim count exceeded threshold without dispatch completion (poison pill)',
              id,
            ],
          );
          this.logger.warn(
            `[PushOutboxService] Job id=${id} marked as POISON_PILL_CLAIM_EXCEEDED (claim_count=${claimCount})`,
          );
          continue;
        }

        validCandidateIds.push(id);
      }

      if (validCandidateIds.length > 0) {
        // Generate per-job lease tokens to guarantee unique fencing
        for (const id of validCandidateIds) {
          const leaseToken = crypto.randomUUID();
          await queryRunner.query(
            `
            UPDATE push_outbox
            SET status = ?,
                lease_token = ?,
                lease_expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
                claim_count = claim_count + 1
            WHERE id = ?
          `,
            [PushOutboxStatus.CLAIMED, leaseToken, leaseDurationSeconds, id],
          );

          // Retrieve updated job row
          const [updated] = await queryRunner.query(
            `SELECT * FROM push_outbox WHERE id = ?`,
            [id],
          );

          if (updated) {
            claimedJobs.push({
              job: this.mapRowToEntity(updated),
              leaseToken,
            });
          }
        }
      }

      // Commit transaction immediately: releases all row locks
      await queryRunner.commitTransaction();
      return claimedJobs;
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[PushOutboxService] Failed to claim batch: ${err.message}`,
        err.stack,
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Phase D: Settle Outcome (Short New Transaction with Lease Fencing Token)
   * Updates job status, retry scheduling, and delivery details.
   * Returns true if settled, or false if fencing lease token was lost/expired.
   */
  public async settleJob(params: SettleJobParams): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const updateFields: string[] = ['status = ?'];
      const updateValues: any[] = [params.status];

      if (params.attempts !== undefined) {
        updateFields.push('attempts = ?');
        updateValues.push(params.attempts);
      }

      if (params.nextRetryAt !== undefined) {
        updateFields.push('next_retry_at = ?');
        updateValues.push(params.nextRetryAt);
      }

      // Reset lease tokens on settlement
      updateFields.push('lease_token = NULL');
      updateFields.push('lease_expires_at = NULL');

      if (params.deliveryDetails !== undefined) {
        updateFields.push('delivery_details = ?');
        updateValues.push(
          params.deliveryDetails ? JSON.stringify(params.deliveryDetails) : null,
        );
      }

      if (params.errorCategory !== undefined) {
        updateFields.push('error_category = ?');
        updateValues.push(params.errorCategory);
      }

      if (params.lastErrorMessage !== undefined) {
        updateFields.push('last_error_message = ?');
        updateValues.push(params.lastErrorMessage);
      }

      if (params.dispatchedAt !== undefined) {
        updateFields.push('dispatched_at = ?');
        updateValues.push(params.dispatchedAt);
      }

      // Append lease token guard to enforce concurrency fence
      updateValues.push(params.jobId);
      updateValues.push(params.leaseToken);

      const updateSql = `
        UPDATE push_outbox
        SET ${updateFields.join(', ')}
        WHERE id = ? AND lease_token = ?
      `;

      const result = await queryRunner.query(updateSql, updateValues);
      await queryRunner.commitTransaction();

      const affected = result?.affectedRows ?? result?.rowCount ?? 0;
      if (affected === 0) {
        this.logger.warn(
          `[PushOutboxService] Settle aborted for job id=${params.jobId}: lease token mismatch or expired`,
        );
        return false;
      }

      return true;
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[PushOutboxService] Error settling job id=${params.jobId}: ${err.message}`,
        err.stack,
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Calculates exponential backoff delay in seconds:
   * Delay = min(300, 30 * 2^(attempts - 1))
   * Attempt 1: 30s
   * Attempt 2: 60s
   * Attempt 3: 120s
   */
  public calculateBackoffSeconds(attempt: number): number {
    const exponent = Math.max(0, attempt - 1);
    return Math.min(300, 30 * Math.pow(2, exponent));
  }

  /**
   * Purge old ACCEPTED_BY_GATEWAY records (Retention Policy AC-OUTBOX-11: 30 days)
   */
  public async purgeOldRecords(
    retentionDays = 30,
    batchLimit = 500,
  ): Promise<number> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const result = await queryRunner.query(
        `
        DELETE FROM push_outbox
        WHERE status = ?
          AND dispatched_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        LIMIT ?
      `,
        [PushOutboxStatus.ACCEPTED_BY_GATEWAY, retentionDays, batchLimit],
      );

      const affected = result?.affectedRows ?? 0;
      if (affected > 0) {
        this.logger.log(
          `[PushOutboxService] Purged ${affected} old push_outbox records (> ${retentionDays} days)`,
        );
      }
      return affected;
    } finally {
      await queryRunner.release();
    }
  }

  private mapRowToEntity(row: any): PushOutbox {
    const entity = new PushOutbox();
    entity.id = Number(row.id);
    entity.notificationId = Number(row.notification_id ?? row.notificationId);
    entity.recipientId = Number(row.recipient_id ?? row.recipientId);
    entity.eventId = row.event_id ?? row.eventId;
    entity.purpose = row.purpose;
    entity.dedupeKey = row.dedupe_key ?? row.dedupeKey;
    entity.status = row.status as PushOutboxStatus;
    entity.claimCount = Number(row.claim_count ?? row.claimCount ?? 0);
    entity.attempts = Number(row.attempts ?? 0);
    entity.maxAttempts = Number(row.max_attempts ?? row.maxAttempts ?? 3);
    entity.nextRetryAt =
      row.next_retry_at || row.nextRetryAt
        ? new Date(row.next_retry_at || row.nextRetryAt)
        : null;
    entity.leaseToken = row.lease_token ?? row.leaseToken ?? null;
    entity.leaseExpiresAt =
      row.lease_expires_at || row.leaseExpiresAt
        ? new Date(row.lease_expires_at || row.leaseExpiresAt)
        : null;
    const rawPayload = row.payload_preview ?? row.payloadPreview;
    entity.payloadPreview =
      typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
    const rawDelivery = row.delivery_details ?? row.deliveryDetails;
    entity.deliveryDetails =
      typeof rawDelivery === 'string' ? JSON.parse(rawDelivery) : rawDelivery;
    entity.errorCategory = (row.error_category ??
      row.errorCategory ??
      PushErrorCategory.NONE) as PushErrorCategory;
    entity.lastErrorMessage =
      row.last_error_message ?? row.lastErrorMessage ?? null;
    entity.createdAt = new Date(row.created_at || row.createdAt || Date.now());
    entity.updatedAt = new Date(row.updated_at || row.updatedAt || Date.now());
    entity.dispatchedAt =
      row.dispatched_at || row.dispatchedAt
        ? new Date(row.dispatched_at || row.dispatchedAt)
        : null;
    return entity;
  }
}

