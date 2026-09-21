import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { PurchaseRequest } from './purchase-request.entity';
import { PurchaseRequestItem } from './purchase-request-item.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { CostItem } from './cost-item.entity';
import { WorkBreakdownStructure } from './wbs.entity';
import { User } from './user.entity';

export enum ProcurementReconciliationStatus {
  PENDING = 'PENDING',
  RECONCILED = 'RECONCILED',
  EXCLUDED = 'EXCLUDED',
}

@Entity('procurement_reconciliations')
export class ProcurementReconciliation {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'project_id', type: 'bigint', unsigned: true })
  projectId: number;

  @Column({ name: 'pr_id', type: 'bigint', unsigned: true })
  prId: number;

  @Column({ name: 'pr_item_id', type: 'bigint', unsigned: true, unique: true })
  prItemId: number;

  @Column({ name: 'po_id', type: 'bigint', unsigned: true, nullable: true })
  poId?: number;

  @Column({ name: 'po_item_id', type: 'bigint', unsigned: true, nullable: true })
  poItemId?: number;

  @Column({ name: 'origin', type: 'varchar', length: 30 })
  origin: 'LEGACY' | 'AD_HOC';

  @Column({ name: 'target_cost_item_id', type: 'bigint', unsigned: true, nullable: true })
  targetCostItemId?: number;

  @Column({ name: 'target_wbs_id', type: 'bigint', unsigned: true, nullable: true })
  targetWbsId?: number;

  @Column({ name: 'mapped_quantity', type: 'decimal', precision: 12, scale: 4, default: '0.0000' })
  mappedQuantity: number;

  @Column({ name: 'mapped_amount', type: 'decimal', precision: 19, scale: 2, default: '0.00' })
  mappedAmount: number;

  @Column({ type: 'varchar', length: 30, default: ProcurementReconciliationStatus.PENDING })
  status: ProcurementReconciliationStatus;

  @Column({ name: 'match_type', type: 'varchar', length: 50 })
  matchType: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'reconciled_by', type: 'bigint', unsigned: true, nullable: true })
  reconciledBy?: number;

  @Column({ name: 'reconciled_at', type: 'datetime', nullable: true })
  reconciledAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Project, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => PurchaseRequest, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pr_id' })
  purchaseRequest: PurchaseRequest;

  @OneToOne(() => PurchaseRequestItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pr_item_id' })
  purchaseRequestItem: PurchaseRequestItem;

  @ManyToOne(() => PurchaseOrder, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'po_id' })
  purchaseOrder?: PurchaseOrder;

  @ManyToOne(() => PurchaseOrderItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'po_item_id' })
  purchaseOrderItem?: PurchaseOrderItem;

  @ManyToOne(() => CostItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'target_cost_item_id' })
  targetCostItem?: CostItem;

  @ManyToOne(() => WorkBreakdownStructure, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'target_wbs_id' })
  targetWbs?: WorkBreakdownStructure;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reconciled_by' })
  reconciler?: User;
}
