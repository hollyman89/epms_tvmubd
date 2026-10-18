import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { PurchaseRequestItem } from './purchase-request-item.entity';
import { CostItem } from './cost-item.entity';

@Entity('purchase_order_items')
export class PurchaseOrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'purchase_order_id' })
  purchaseOrderId: number;

  @Column({ name: 'pr_item_id', type: 'bigint', unsigned: true, nullable: true })
  prItemId?: number;

  @Column({ name: 'cost_item_id', type: 'bigint', unsigned: true, nullable: true })
  costItemId?: number;

  @Column({ name: 'item_name' })
  itemName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'varchar', length: 50, nullable: true, default: 'Unit' })
  uom?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'received_quantity', default: 0 })
  receivedQuantity: number;

  @Column({ type: 'decimal', precision: 19, scale: 2, name: 'unit_price' })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 19, scale: 2, name: 'total_price', default: 0 })
  totalPrice: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;

  @ManyToOne(() => PurchaseOrder, po => po.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  @ManyToOne(() => PurchaseRequestItem, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pr_item_id' })
  purchaseRequestItem?: PurchaseRequestItem;

  @ManyToOne(() => CostItem, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cost_item_id' })
  costItem?: CostItem;
}
