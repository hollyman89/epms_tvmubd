import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { Invoice } from './invoice.entity';
import { InvoiceItemTaxDetail } from './invoice-item-tax-detail.entity';
import { TaxRegimeRule } from './tax-regime-rule.entity';
import { PoPaymentTerm } from './po-payment-term.entity';
import { Vendor } from './vendor.entity';
import { StatutoryTaxLiability } from './statutory-tax-liability.entity';
import { TaxRemittanceAllocation } from './tax-remittance-allocation.entity';

export enum RecognitionStatus {
  RECOGNIZED_UNREMITTED = 'RECOGNIZED_UNREMITTED',
  PARTIALLY_REMITTED = 'PARTIALLY_REMITTED',
  FULLY_REMITTED = 'FULLY_REMITTED',
  CANCELLED = 'CANCELLED',
}

export enum StatutoryTriggerType {
  PAYMENT = 'PAYMENT',
  DUE_DATE = 'DUE_DATE',
  END_OF_MONTH = 'END_OF_MONTH',
}

@Entity('pph_withholding_records')
@Unique('uk_pwr_id_dim_liability', [
  'id',
  'companyCode',
  'taxPeriodYear',
  'taxPeriodMonth',
  'pphRegime',
  'statutoryTaxLiabilityId',
])
@Index('idx_pwr_company_regime_status', ['companyCode', 'pphRegime', 'recognitionStatus'])
export class PphWithholdingRecord {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'invoice_id', type: 'bigint', unsigned: true })
  invoiceId: number;

  @Column({ name: 'invoice_item_id', type: 'bigint', unsigned: true, nullable: true })
  invoiceItemId?: number | null;

  @Column({ name: 'tax_regime_rule_id', type: 'bigint', unsigned: true })
  taxRegimeRuleId: number;

  @Column({
    name: 'pph_tax_category',
    type: 'enum',
    enum: ['PPN', 'PPH'],
    default: 'PPH',
  })
  pphTaxCategory: 'PPN' | 'PPH';

  @Column({ name: 'payment_term_id', type: 'bigint', unsigned: true, nullable: true })
  paymentTermId?: number | null;

  @Column({ name: 'company_code', type: 'varchar', length: 10 })
  companyCode: string; // 'UBD' | 'TVM' (DEC-TAX-07)

  @Column({ name: 'vendor_id', type: 'bigint', unsigned: true })
  vendorId: number;

  @Column({ name: 'pph_regime', type: 'varchar', length: 30 })
  pphRegime: string;

  @Column({ name: 'tax_period_month', type: 'tinyint', unsigned: true })
  taxPeriodMonth: number;

  @Column({ name: 'tax_period_year', type: 'smallint', unsigned: true })
  taxPeriodYear: number;

  @Column({ name: 'statutory_tax_liability_id', type: 'bigint', unsigned: true })
  statutoryTaxLiabilityId: number;

  @Column({
    name: 'taxable_base',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  taxableBase: number;

  @Column({
    name: 'withholding_rate',
    type: 'decimal',
    precision: 7,
    scale: 4,
    default: 0.0,
  })
  withholdingRate: number;

  @Column({
    name: 'withheld_amount',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  withheldAmount: number; // W_tax

  @Column({
    name: 'total_remitted_amount',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  totalRemittedAmount: number;

  @Column({
    name: 'outstanding_withheld_amount',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  outstandingWithheldAmount: number;

  @Column({
    name: 'statutory_trigger_type',
    type: 'enum',
    enum: StatutoryTriggerType,
  })
  statutoryTriggerType: StatutoryTriggerType;

  @Column({ name: 'statutory_trigger_date', type: 'date' })
  statutoryTriggerDate: string | Date;

  @Column({
    name: 'recognition_status',
    type: 'enum',
    enum: RecognitionStatus,
    default: RecognitionStatus.RECOGNIZED_UNREMITTED,
  })
  recognitionStatus: RecognitionStatus;

  @Column({ name: 'bukti_potong_number', type: 'varchar', length: 50, nullable: true })
  buktiPotongNumber?: string | null;

  @Column({ name: 'bukti_potong_date', type: 'date', nullable: true })
  buktiPotongDate?: string | Date | null;

  @Column({ name: 'cancellation_reason', type: 'varchar', length: 255, nullable: true })
  cancellationReason?: string | null;

  @Column({ name: 'cancelled_by', type: 'bigint', unsigned: true, nullable: true })
  cancelledBy?: number | null;

  @Column({ name: 'cancelled_at', type: 'datetime', nullable: true })
  cancelledAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  @ManyToOne(() => Invoice, (inv: any) => inv.pphWithholdingRecords, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @ManyToOne(() => InvoiceItemTaxDetail, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'invoice_item_id' })
  invoiceItemTaxDetail?: InvoiceItemTaxDetail | null;

  @ManyToOne(() => TaxRegimeRule, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'tax_regime_rule_id' })
  taxRegimeRule: TaxRegimeRule;

  @ManyToOne(() => PoPaymentTerm, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'payment_term_id' })
  paymentTerm?: PoPaymentTerm | null;

  @ManyToOne(() => Vendor, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @ManyToOne(() => StatutoryTaxLiability, stl => stl.withholdingRecords, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'statutory_tax_liability_id' })
  statutoryTaxLiability: StatutoryTaxLiability;

  @OneToMany(() => TaxRemittanceAllocation, tra => tra.withholdingRecord)
  allocations: TaxRemittanceAllocation[];
}
