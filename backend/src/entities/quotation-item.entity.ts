import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Quotation } from './quotation.entity';
import { PurchaseRequestItem } from './purchase-request-item.entity';

@Entity('quotation_items')
export class QuotationItem {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'quotation_id', type: 'bigint' })
  quotationId: number;

  @Column({ name: 'pr_item_id', type: 'bigint', nullable: true })
  prItemId: number;

  @Column({ name: 'item_name', type: 'varchar', length: 255 })
  itemName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'varchar', length: 50, default: 'PCS' })
  uom: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 19, scale: 2 })
  unitPrice: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 19, scale: 2 })
  totalAmount: number;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Quotation, (quotation) => quotation.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quotation_id' })
  quotation: Quotation;

  @ManyToOne(() => PurchaseRequestItem, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'pr_item_id' })
  purchaseRequestItem: PurchaseRequestItem;
}
