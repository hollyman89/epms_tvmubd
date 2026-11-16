import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, VersionColumn } from 'typeorm';
import { Invoice } from './invoice.entity';
import { CompanyBankAccount } from './company-bank-account.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_code', type: 'varchar', length: 10, nullable: true })
  companyCode?: string; // 'UBD' | 'TVM' (DEC-TAX-07)

  @VersionColumn()
  version: number;

  @Column({ name: 'invoice_id' })
  invoiceId: number;

  @Column({ name: 'payment_request_id', nullable: true })
  paymentRequestId?: number | null;

  @Column({ name: 'payment_number', unique: true })
  paymentNumber: string;

  @Column({ name: 'payment_date', type: 'datetime' })
  paymentDate: Date;

  @Column({ name: 'amount_paid', type: 'decimal', precision: 19, scale: 2 })
  amount: number;

  @Column({ name: 'company_bank_account_id', type: 'bigint', unsigned: true, nullable: true })
  companyBankAccountId?: number | null;

  @Column({ name: 'payment_method', type: 'varchar', length: 50, nullable: true })
  paymentMethod?: string | null;

  @Column({ name: 'reference_number', type: 'varchar', length: 100, nullable: true })
  referenceNumber?: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string | null;

  @Column({ name: 'source_account_snapshot', type: 'json', nullable: true })
  sourceAccountSnapshot?: Record<string, any> | null;

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

  @ManyToOne(() => Invoice, inv => inv.payments, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @ManyToOne(() => CompanyBankAccount, cba => cba.payments, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'company_bank_account_id' })
  companyBankAccount?: CompanyBankAccount;
}
