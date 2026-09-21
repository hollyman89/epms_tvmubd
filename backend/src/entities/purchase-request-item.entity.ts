import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PurchaseRequest } from './purchase-request.entity';

@Entity('purchase_request_items')
export class PurchaseRequestItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'pr_id' })
  prId: number;

  @Column({ name: 'package_item_id', type: 'bigint', unsigned: true, nullable: true })
  packageItemId?: number;

  @Column({ name: 'cost_item_id', type: 'bigint', unsigned: true, nullable: true })
  costItemId?: number;

  @Column({ name: 'wbs_id', type: 'bigint', unsigned: true, nullable: true })
  wbsId?: number;

  @Column({ name: 'item_name' })
  itemName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ default: 'PCS' })
  uom: string;

  @Column({ type: 'decimal', precision: 19, scale: 2, name: 'estimated_unit_price' })
  estimatedUnitPrice: number;

  @Column({ type: 'decimal', precision: 19, scale: 2, name: 'total_price', insert: false, update: false })
  totalPrice: number;

  @ManyToOne(() => PurchaseRequest, pr => pr.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pr_id' })
  purchaseRequest: PurchaseRequest;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
