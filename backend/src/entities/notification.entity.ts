import { Entity, PrimaryGeneratedColumn, Column, DeleteDateColumn } from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ length: 100, nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ name: 'notification_type', type: 'enum', enum: ['TASK', 'ALERT', 'SYSTEM'], default: 'TASK' })
  notificationType: string;

  @Column({ name: 'action_link', length: 255, nullable: true })
  actionLink: string;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'meta_data', type: 'json', nullable: true })
  metaData: any;

  @Column({ name: 'created_by', default: 0 })
  createdBy: number;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: number;

  @Column({ name: 'deleted_by', nullable: true })
  deletedBy: number;

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date;
}
