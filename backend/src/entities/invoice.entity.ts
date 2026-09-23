import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, VersionColumn } from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { InvoiceItem } from './invoice-item.entity';
import { Payment } from './payment.entity';
import { PoPaymentTerm } from './po-payment-term.entity';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'po_id' })
  poId: number;

  @Column({ name: 'payment_term_id', type: 'bigint', nullable: true })
  paymentTermId?: number;

  @Column({ name: 'invoice_number', unique: true })
  invoiceNumber: string;

  @Column({ name: 'invoice_date', type: 'datetime', nullable: true })
  invoiceDate: Date;

  @Column({ type: 'decimal', precision: 19, scale: 2, name: 'total_amount', default: 0 })
  totalAmount: number;

  @Column({ name: 'match_status', default: 'PENDING' })
  matchStatus: string;

  @Column({ name: 'payment_status', default: 'UNPAID' })
  paymentStatus: string;

  @Column({ name: 'status', default: 'UNPAID' })
  status: string;

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

  @ManyToOne(() => PurchaseOrder, po => po.invoices, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'po_id' })
  purchaseOrder: PurchaseOrder;

  @ManyToOne(() => PoPaymentTerm, term => term.invoices, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'payment_term_id' })
  paymentTerm?: PoPaymentTerm;

  @OneToMany(() => InvoiceItem, item => item.invoice, { cascade: true })
  items: InvoiceItem[];

  @OneToMany(() => Payment, payment => payment.invoice, { cascade: true })
  payments: Payment[];
}

