import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany, VersionColumn } from 'typeorm';
import { PurchaseRequestItem } from './purchase-request-item.entity';
import { Rfq } from './rfq.entity';

@Entity('purchase_requests')
export class PurchaseRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @VersionColumn()
  version: number;

  @Column({ name: 'project_id' })
  projectId: number;

  @Column({ name: 'requester_id' })
  requesterId: number;

  @Column({ name: 'pr_number', unique: true })
  prNumber: string;

  @Column({ type: 'decimal', precision: 19, scale: 2, name: 'total_estimated_amount', default: 0 })
  totalEstimatedAmount: number;

  @Column({ default: 'DRAFT' })
  status: string;

  @OneToMany(() => PurchaseRequestItem, item => item.purchaseRequest, { cascade: true })
  items: PurchaseRequestItem[];

  @OneToMany(() => Rfq, rfq => rfq.purchaseRequest, { cascade: true })
  rfqs: Rfq[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
