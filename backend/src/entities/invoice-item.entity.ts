import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, VersionColumn } from 'typeorm';
import { Invoice } from './invoice.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';

@Entity('invoice_items')
export class InvoiceItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'invoice_id' })
  invoiceId: number;

  @Column({ name: 'po_item_id', nullable: true })
  poItemId?: number;

  @Column({ name: 'item_name', type: 'varchar', length: 255, nullable: true })
  itemName?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 19, scale: 2, name: 'unit_price', default: 0 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 19, scale: 2, name: 'total_price', default: 0 })
  totalPrice: number;

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

  @VersionColumn()
  version: number;

  @ManyToOne(() => Invoice, inv => inv.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @ManyToOne(() => PurchaseOrderItem, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'po_item_id' })
  purchaseOrderItem?: PurchaseOrderItem;
}

