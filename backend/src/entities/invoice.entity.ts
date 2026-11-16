import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, OneToOne, JoinColumn, VersionColumn } from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { InvoiceItem } from './invoice-item.entity';
import { Payment } from './payment.entity';
import { PoPaymentTerm } from './po-payment-term.entity';
import { ServiceClaim } from './service-claim.entity';
import { InvoiceTaxDetail } from './invoice-tax-detail.entity';
import { PpnMasukanRecord } from './ppn-masukan-record.entity';
import { PphWithholdingRecord } from './pph-withholding-record.entity';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_code', type: 'varchar', length: 10, nullable: true })
  companyCode?: string; // 'UBD' | 'TVM' (DEC-TAX-07)

  @Column({ name: 'po_id' })
  poId: number;

  @Column({ name: 'payment_term_id', type: 'bigint', nullable: true })
  paymentTermId?: number;

  @Column({ name: 'service_claim_id', type: 'bigint', unsigned: true, nullable: true })
  serviceClaimId?: number;

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

  @ManyToOne(() => ServiceClaim, sc => sc.invoices, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'service_claim_id' })
  serviceClaim?: ServiceClaim;

  @OneToMany(() => InvoiceItem, item => item.invoice, { cascade: true })
  items: InvoiceItem[];

  @OneToMany(() => Payment, payment => payment.invoice, { cascade: true })
  payments: Payment[];

  @OneToOne(() => InvoiceTaxDetail, itd => itd.invoice, { cascade: true })
  invoiceTaxDetail?: InvoiceTaxDetail;

  @OneToMany(() => PpnMasukanRecord, pmr => pmr.invoice, { cascade: true })
  ppnMasukanRecords: PpnMasukanRecord[];

  @OneToMany(() => PphWithholdingRecord, pwr => pwr.invoice, { cascade: true })
  pphWithholdingRecords: PphWithholdingRecord[];
}

