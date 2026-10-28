import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Notification } from './notification.entity';

export enum PushOutboxStatus {
  PENDING = 'PENDING',
  CLAIMED = 'CLAIMED',
  ACCEPTED_BY_GATEWAY = 'ACCEPTED_BY_GATEWAY',
  FAILED_RETRYABLE = 'FAILED_RETRYABLE',
  PERMANENT_FAILURE = 'PERMANENT_FAILURE',
  NO_SUBSCRIPTION = 'NO_SUBSCRIPTION',
}

export enum PushErrorCategory {
  NONE = 'NONE',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  CONNECTION_RESET = 'CONNECTION_RESET',
  GATEWAY_5XX = 'GATEWAY_5XX',
  RATE_LIMIT_429 = 'RATE_LIMIT_429',
  INVALID_SUBSCRIPTION_410 = 'INVALID_SUBSCRIPTION_410',
  SSRF_REJECTED = 'SSRF_REJECTED',
  VAPID_ERROR = 'VAPID_ERROR',
  EXCEEDED_MAX_ATTEMPTS = 'EXCEEDED_MAX_ATTEMPTS',
  POISON_PILL_CLAIM_EXCEEDED = 'POISON_PILL_CLAIM_EXCEEDED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

@Entity('push_outbox')
@Index('idx_push_outbox_claim', ['status', 'nextRetryAt', 'leaseExpiresAt', 'id'])
@Index('idx_push_outbox_recipient', ['recipientId', 'status'])
@Index('idx_push_outbox_purge', ['status', 'dispatchedAt', 'createdAt'])
export class PushOutbox {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'notification_id', type: 'bigint', unsigned: true })
  notificationId: number;

  @ManyToOne(() => Notification, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'notification_id' })
  notification?: Notification;

  @Column({ name: 'recipient_id', type: 'bigint', unsigned: true })
  recipientId: number;

  @Column({ name: 'event_id', type: 'varchar', length: 100 })
  eventId: string;

  @Column({ name: 'purpose', type: 'varchar', length: 100 })
  purpose: string;

  @Column({ name: 'dedupe_key', type: 'varchar', length: 191, unique: true })
  dedupeKey: string;

  @Column({
    type: 'enum',
    enum: PushOutboxStatus,
    default: PushOutboxStatus.PENDING,
  })
  status: PushOutboxStatus;

  @Column({ name: 'claim_count', type: 'int', unsigned: true, default: 0 })
  claimCount: number;

  @Column({ name: 'attempts', type: 'int', unsigned: true, default: 0 })
  attempts: number;

  @Column({ name: 'max_attempts', type: 'int', unsigned: true, default: 3 })
  maxAttempts: number;

  @Column({ name: 'next_retry_at', type: 'datetime', nullable: true })
  nextRetryAt?: Date | null;

  @Column({ name: 'lease_token', type: 'varchar', length: 64, nullable: true })
  leaseToken?: string | null;

  @Column({ name: 'lease_expires_at', type: 'datetime', nullable: true })
  leaseExpiresAt?: Date | null;

  @Column({ name: 'payload_preview', type: 'json' })
  payloadPreview: Record<string, any>;

  @Column({ name: 'delivery_details', type: 'json', nullable: true })
  deliveryDetails?: Record<string, any> | null;

  @Column({
    name: 'error_category',
    type: 'enum',
    enum: PushErrorCategory,
    default: PushErrorCategory.NONE,
  })
  errorCategory: PushErrorCategory;

  @Column({ name: 'last_error_message', type: 'varchar', length: 500, nullable: true })
  lastErrorMessage?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  @Column({ name: 'dispatched_at', type: 'datetime', nullable: true })
  dispatchedAt?: Date | null;
}

