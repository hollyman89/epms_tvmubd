import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { GoodsReceipt } from './goods-receipt.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';

@Entity('goods_receipt_items')
export class GoodsReceiptItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'gr_id' })
  grId: number;

  @Column({ name: 'po_item_id' })
  poItemId: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'received_quantity', default: 0 })
  receivedQuantity: number;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ name: 'created_by', nullable: true })
  createdBy: number;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: number;

  @Column({ name: 'deleted_by', nullable: true })
  deletedBy: number;

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date;

  @ManyToOne(() => GoodsReceipt, gr => gr.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gr_id' })
  goodsReceipt: GoodsReceipt;

  @ManyToOne(() => PurchaseOrderItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'po_item_id' })
  purchaseOrderItem: PurchaseOrderItem;
}
