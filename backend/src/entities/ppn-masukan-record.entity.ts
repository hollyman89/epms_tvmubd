import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { Invoice } from './invoice.entity';

export enum CreditabilityStatus {
  UNVERIFIED = 'UNVERIFIED',
  CREDITABLE = 'CREDITABLE',
  NON_CREDITABLE = 'NON_CREDITABLE',
  EXEMPT = 'EXEMPT',
}

export enum SptMasaStatus {
  UNREPORTED = 'UNREPORTED',
  INCLUDED_IN_SPT = 'INCLUDED_IN_SPT',
  AUDITED = 'AUDITED',
}

export enum ValidationStatus {
  VALID = 'VALID',
  INVALID_NSFP = 'INVALID_NSFP',
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',
  VENDOR_MISMATCH = 'VENDOR_MISMATCH',
}

@Entity('ppn_masukan_records')
@Unique('uk_pmr_nsfp_replacement', ['fakturPajakNumber', 'replacementCode'])
@Index('idx_pmr_company_period', ['companyCode', 'reportingPeriodYear', 'reportingPeriodMonth', 'creditabilityStatus'])
export class PpnMasukanRecord {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'invoice_id', type: 'bigint', unsigned: true })
  invoiceId: number;

  @Column({ name: 'company_code', type: 'varchar', length: 10 })
  companyCode: string; // 'UBD' | 'TVM' (DEC-TAX-07)

  @Column({ name: 'vendor_tax_id', type: 'varchar', length: 16 })
  vendorTaxId: string;

  @Column({ name: 'faktur_pajak_number', type: 'varchar', length: 20 })
  fakturPajakNumber: string;

  @Column({ name: 'faktur_pajak_date', type: 'date' })
  fakturPajakDate: string | Date;

  @Column({ name: 'transaction_code', type: 'varchar', length: 2 })
  transactionCode: string;

  @Column({ name: 'replacement_code', type: 'varchar', length: 1, default: '0' })
  replacementCode: string;

  @Column({
    name: 'dpp_amount',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  dppAmount: number;

  @Column({
    name: 'ppn_amount',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  ppnAmount: number;

  @Column({
    name: 'creditability_status',
    type: 'enum',
    enum: CreditabilityStatus,
    default: CreditabilityStatus.UNVERIFIED,
  })
  creditabilityStatus: CreditabilityStatus;

  @Column({
    name: 'creditability_verified_by',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  creditabilityVerifiedBy?: number | null;

  @Column({ name: 'creditability_verified_at', type: 'datetime', nullable: true })
  creditabilityVerifiedAt?: Date | null;

  @Column({
    name: 'creditability_decision_basis',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  creditabilityDecisionBasis?: string | null;

  @Column({ name: 'reporting_period_month', type: 'tinyint', unsigned: true })
  reportingPeriodMonth: number;

  @Column({ name: 'reporting_period_year', type: 'smallint', unsigned: true })
  reportingPeriodYear: number;

  @Column({
    name: 'spt_masa_status',
    type: 'enum',
    enum: SptMasaStatus,
    default: SptMasaStatus.UNREPORTED,
  })
  sptMasaStatus: SptMasaStatus;

  @Column({
    name: 'validation_status',
    type: 'enum',
    enum: ValidationStatus,
    default: ValidationStatus.VALID,
  })
  validationStatus: ValidationStatus;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  @ManyToOne(() => Invoice, (inv: any) => inv.ppnMasukanRecords, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;
}
