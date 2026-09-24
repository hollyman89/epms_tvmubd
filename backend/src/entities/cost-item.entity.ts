import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProjectCostEstimate } from './project-cost-estimate.entity';
import { WorkBreakdownStructure } from './wbs.entity';

@Entity('cost_items')
export class CostItem {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'estimate_id', type: 'bigint', unsigned: true })
  estimateId: number;

  @Column({ name: 'category_key', type: 'varchar', length: 50 })
  categoryKey: string;

  @Column({ name: 'entry_mode', type: 'varchar', length: 20, default: 'ITEMIZED' })
  entryMode: string;

  @Column({ name: 'item_name', type: 'varchar', length: 255 })
  itemName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 1.0 })
  quantity: number;

  @Column({ type: 'varchar', length: 50, default: 'Unit' })
  uom: string;

  @Column({ name: 'rate_type', type: 'varchar', length: 50, default: 'UNIT_RATE', nullable: true })
  rateType: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 19, scale: 2, default: 0.0 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 19, scale: 2, default: 0.0 })
  subtotal: number;

  @Column({ name: 'resource_type', type: 'varchar', length: 50, nullable: true })
  resourceType: string;

  @Column({ name: 'cost_source', type: 'varchar', length: 50, default: 'PM_ESTIMATE', nullable: true })
  costSource: string;

  @Column({ name: 'assignment_scope', type: 'varchar', length: 50, default: 'UNASSIGNED' })
  assignmentScope: string;

  @Column({ name: 'wbs_id', type: 'bigint', unsigned: true, nullable: true })
  wbsId: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdBy: number;

  @Column({ name: 'updated_by', type: 'bigint', unsigned: true, nullable: true })
  updatedBy: number;

  @Column({ name: 'deleted_by', type: 'bigint', unsigned: true, nullable: true })
  deletedBy: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;

  @ManyToOne(() => ProjectCostEstimate, (estimate) => estimate.items)
  @JoinColumn({ name: 'estimate_id' })
  estimate: ProjectCostEstimate;

  @ManyToOne(() => WorkBreakdownStructure, { nullable: true })
  @JoinColumn({ name: 'wbs_id' })
  wbs: WorkBreakdownStructure;
}
