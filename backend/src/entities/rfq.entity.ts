import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PurchaseRequest } from './purchase-request.entity';

@Entity('rfqs')
export class Rfq {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'pr_id' })
  prId: number;

  @Column({ name: 'rfq_number', unique: true })
  rfqNumber: string;

  @Column({ default: 'OPEN' })
  status: string;

  @Column({ name: 'closing_date', nullable: true })
  closingDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;

  @ManyToOne(() => PurchaseRequest, pr => pr.rfqs, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pr_id' })
  purchaseRequest: PurchaseRequest;
}
