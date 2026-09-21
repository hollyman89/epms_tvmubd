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
import { ProcurementPackage } from './procurement-package.entity';
import { CostItem } from './cost-item.entity';
import { WorkBreakdownStructure } from './wbs.entity';

@Entity('procurement_package_items')
export class ProcurementPackageItem {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'package_id', type: 'bigint', unsigned: true })
  packageId: number;

  @Column({ name: 'cost_item_id', type: 'bigint', unsigned: true })
  costItemId: number;

  @Column({ name: 'wbs_id', type: 'bigint', unsigned: true, nullable: true })
  wbsId?: number;

  @Column({ name: 'item_name', type: 'varchar', length: 255 })
  itemName: string;

  @Column({ type: 'varchar', length: 50, default: 'Unit' })
  uom: string;

  @Column({
    name: 'baseline_qty',
    type: 'decimal',
    precision: 12,
    scale: 4,
    default: 0.0,
  })
  baselineQty: number;

  @Column({
    name: 'requested_qty',
    type: 'decimal',
    precision: 12,
    scale: 4,
    default: 0.0,
  })
  requestedQty: number;

  @Column({
    name: 'estimated_unit_price',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  estimatedUnitPrice: number;

  @Column({
    name: 'estimated_total',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  estimatedTotal: number;

  @Column({ name: 'required_date', type: 'date', nullable: true })
  requiredDate?: string;

  @Column({ type: 'varchar', length: 50, default: 'PENDING' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  @ManyToOne(() => ProcurementPackage, (pkg) => pkg.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'package_id' })
  package: ProcurementPackage;

  @ManyToOne(() => CostItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cost_item_id' })
  costItem: CostItem;

  @ManyToOne(() => WorkBreakdownStructure, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'wbs_id' })
  wbs?: WorkBreakdownStructure;
}
