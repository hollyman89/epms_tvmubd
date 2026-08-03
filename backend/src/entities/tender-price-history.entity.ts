import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tender } from './tender.entity';

@Entity('tender_price_history')
export class TenderPriceHistory {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'bigint', unsigned: true })
  tender_id: number;

  @Column({ type: 'decimal', precision: 19, scale: 2, nullable: true })
  old_price: number;

  @Column({ type: 'decimal', precision: 19, scale: 2, nullable: true })
  new_price: number;

  @Column({ type: 'bigint', unsigned: true })
  changed_by: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Tender)
  @JoinColumn({ name: 'tender_id' })
  tender: Tender;
}
