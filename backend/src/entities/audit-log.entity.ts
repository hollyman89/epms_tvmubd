import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  table_name: string;

  @Column({ type: 'bigint', unsigned: true })
  record_id: number;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @Column({ type: 'json', nullable: true })
  old_value: any;

  @Column({ type: 'json', nullable: true })
  new_value: any;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string;

  @Column({ type: 'text', nullable: true })
  user_agent: string;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  created_by: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;
}
