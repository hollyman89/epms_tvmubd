import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, OneToMany, VersionColumn } from 'typeorm';
import { PurchaseRequest } from './purchase-request.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { GoodsReceipt } from './goods-receipt.entity';
import { Invoice } from './invoice.entity';

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @VersionColumn()
  version: number;

  @Column({ name: 'pr_id' })
  purchaseRequestId: number;

  @Column({ name: 'vendor_id' })
  vendorId: number;

  @Column({ name: 'po_number', unique: true })
  poNumber: string;

  @Column({ type: 'decimal', precision: 19, scale: 2, name: 'total_amount', default: 0 })
  totalAmount: number;

  @Column({ default: 'DRAFT' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;

  @ManyToOne(() => PurchaseRequest, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pr_id' })
  purchaseRequest: PurchaseRequest;

  @OneToMany(() => PurchaseOrderItem, item => item.purchaseOrder, { cascade: true })
  items: PurchaseOrderItem[];

  @OneToMany(() => GoodsReceipt, gr => gr.purchaseOrder)
  goodsReceipts: GoodsReceipt[];

  @OneToMany(() => Invoice, inv => inv.purchaseOrder)
  invoices: Invoice[];
}
