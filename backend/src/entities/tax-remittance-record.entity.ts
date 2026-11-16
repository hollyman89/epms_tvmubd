import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { TaxRemittanceAllocation } from './tax-remittance-allocation.entity';

export enum RemittanceStatus {
  DRAFT_BILLING = 'DRAFT_BILLING',
  SETTLED_NTPN = 'SETTLED_NTPN',
  REVERSED = 'REVERSED',
}

@Entity('tax_remittance_records')
@Unique('uk_trr_remittance_number', ['remittanceNumber'])
@Unique('uk_trr_ntpn', ['ntpn'])
@Unique('uk_trr_id_dimensions', ['id', 'companyCode', 'taxPeriodYear', 'taxPeriodMonth', 'taxRegime'])
@Index('idx_trr_company_period', ['companyCode', 'taxPeriodYear', 'taxPeriodMonth', 'taxRegime'])
export class TaxRemittanceRecord {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'remittance_number', type: 'varchar', length: 100, unique: true })
  remittanceNumber: string;

  @Column({ name: 'company_code', type: 'varchar', length: 10 })
  companyCode: string; // 'UBD' | 'TVM' (DEC-TAX-07)

  @Column({ name: 'tax_period_month', type: 'tinyint', unsigned: true })
  taxPeriodMonth: number;

  @Column({ name: 'tax_period_year', type: 'smallint', unsigned: true })
  taxPeriodYear: number;

  @Column({ name: 'tax_regime', type: 'varchar', length: 30 })
  taxRegime: string;

  @Column({ name: 'djp_billing_code', type: 'varchar', length: 30 })
  djpBillingCode: string;

  @Column({ name: 'djp_billing_expired_at', type: 'datetime', nullable: true })
  djpBillingExpiredAt?: Date | null;

  @Column({ name: 'ntpn', type: 'varchar', length: 30, unique: true, nullable: true })
  ntpn?: string | null;

  @Column({ name: 'remittance_date', type: 'datetime', nullable: true })
  remittanceDate?: Date | null;

  @Column({
    name: 'remitted_amount',
    type: 'decimal',
    precision: 19,
    scale: 2,
  })
  remittedAmount: number; // S_tax

  @Column({
    name: 'allocated_amount',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  allocatedAmount: number;

  @Column({
    name: 'unallocated_amount',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  unallocatedAmount: number;

  @Column({ name: 'bank_reference_number', type: 'varchar', length: 100, nullable: true })
  bankReferenceNumber?: string | null;

  @Column({ name: 'bank_account_number', type: 'varchar', length: 50 })
  bankAccountNumber: string;

  @Column({
    name: 'remittance_status',
    type: 'enum',
    enum: RemittanceStatus,
    default: RemittanceStatus.DRAFT_BILLING,
  })
  remittanceStatus: RemittanceStatus;

  @Column({ name: 'executed_by', type: 'bigint', unsigned: true, nullable: true })
  executedBy?: number | null;

  @Column({ name: 'reversal_reason', type: 'varchar', length: 255, nullable: true })
  reversalReason?: string | null;

  @Column({ name: 'reversed_by', type: 'bigint', unsigned: true, nullable: true })
  reversedBy?: number | null;

  @Column({ name: 'reversed_at', type: 'datetime', nullable: true })
  reversedAt?: Date | null;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true })
  createdBy: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  @OneToMany(() => TaxRemittanceAllocation, tra => tra.remittanceRecord)
  allocations: TaxRemittanceAllocation[];
}

