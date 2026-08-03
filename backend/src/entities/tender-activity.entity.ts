import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tender } from './tender.entity';
import { User } from './user.entity';

export enum ActivityType {
  SYSTEM = 'SYSTEM',
  COMMENT = 'COMMENT',
}

@Entity('tender_activities')
export class TenderActivity {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'bigint', unsigned: true })
  tender_id: number;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  user_id: number;

  @Column({ type: 'enum', enum: ActivityType, default: ActivityType.COMMENT })
  type: ActivityType;

  @Column({ type: 'text' })
  content: string;

  @ManyToOne(() => Tender)
  @JoinColumn({ name: 'tender_id' })
  tender: Tender;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn()
  created_at: Date;
}
