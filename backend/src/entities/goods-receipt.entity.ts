import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, VersionColumn } from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { GoodsReceiptItem } from './goods-receipt-item.entity';

@Entity('goods_receipts')
export class GoodsReceipt {
  @PrimaryGeneratedColumn()
  id: number;

  @VersionColumn()
  version: number;

  @Column({ name: 'po_id' })
  poId: number;

  @Column({ name: 'gr_number', unique: true })
  grNumber: string;

  @Column({ name: 'receipt_date', type: 'datetime' })
  receiptDate: Date;

  @Column({ name: 'total_received_amount', type: 'decimal', precision: 19, scale: 2, default: 0 })
  totalReceivedAmount: number;

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

  @ManyToOne(() => PurchaseOrder, po => po.goodsReceipts, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'po_id' })
  purchaseOrder: PurchaseOrder;

  @OneToMany(() => GoodsReceiptItem, item => item.goodsReceipt, { cascade: true })
  items: GoodsReceiptItem[];
}
