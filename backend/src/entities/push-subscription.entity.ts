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
import { User } from './user.entity';

@Entity('push_subscriptions')
@Index('uk_push_sub_endpoint_hash', ['endpointHash'], { unique: true })
@Index('idx_push_sub_user_active', ['userId', 'isActive'])
export class PushSubscription {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'text' })
  endpoint: string;

  @Column({ name: 'endpoint_hash', type: 'char', length: 64, unique: true })
  endpointHash: string;

  @Column({ name: 'p256dh', type: 'varchar', length: 255 })
  p256dh: string;

  @Column({ name: 'auth', type: 'varchar', length: 255 })
  auth: string;

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent?: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'failure_reason', type: 'varchar', length: 100, nullable: true })
  failureReason?: string | null;

  @Column({ name: 'last_used_at', type: 'datetime', nullable: true })
  lastUsedAt?: Date | null;

  @Column({ name: 'unsubscribed_at', type: 'datetime', nullable: true })
  unsubscribedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}

