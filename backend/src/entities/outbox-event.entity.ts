import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum OutboxStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}

@Entity('outbox_events')
export class OutboxEvent {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  event_id: string;

  @Column({ type: 'varchar', length: 100 })
  event_name: string;

  @Column({ type: 'varchar', length: 20, default: '1.0' })
  event_version: string;

  @Column({ type: 'varchar', length: 50 })
  aggregate_type: string;

  @Column({ type: 'bigint', unsigned: true })
  aggregate_id: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  correlation_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  transaction_id: string;

  @Column({ type: 'json' })
  payload: any;

  @Column({ type: 'enum', enum: OutboxStatus, default: OutboxStatus.PENDING })
  status: OutboxStatus;

  @Column({ type: 'int', default: 0 })
  retry_count: number;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @Column({ type: 'datetime', nullable: true })
  published_at: Date;
}
