import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { PphWithholdingRecord } from './pph-withholding-record.entity';
import { TaxRemittanceAllocation } from './tax-remittance-allocation.entity';

export enum StatutoryLiabilityStatus {
  OPEN = 'OPEN',
  PARTIALLY_SETTLED = 'PARTIALLY_SETTLED',
  DISCHARGED = 'DISCHARGED',
}

@Entity('statutory_tax_liabilities')
@Unique('uk_stl_company_period_regime', ['companyCode', 'taxPeriodYear', 'taxPeriodMonth', 'taxRegime'])
@Unique('uk_stl_id_dimensions', ['id', 'companyCode', 'taxPeriodYear', 'taxPeriodMonth', 'taxRegime'])
export class StatutoryTaxLiability {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'company_code', type: 'varchar', length: 10 })
  companyCode: string; // 'UBD' | 'TVM' (DEC-TAX-07)

  @Column({ name: 'tax_period_month', type: 'tinyint', unsigned: true })
  taxPeriodMonth: number;

  @Column({ name: 'tax_period_year', type: 'smallint', unsigned: true })
  taxPeriodYear: number;

  @Column({ name: 'tax_regime', type: 'varchar', length: 30 })
  taxRegime: string;

  @Column({
    name: 'total_withheld_amount',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  totalWithheldAmount: number;

  @Column({
    name: 'total_remitted_amount',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  totalRemittedAmount: number;

  @Column({
    name: 'outstanding_balance',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  outstandingBalance: number;

  @Column({
    name: 'status',
    type: 'enum',
    enum: StatutoryLiabilityStatus,
    default: StatutoryLiabilityStatus.OPEN,
  })
  status: StatutoryLiabilityStatus;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  @OneToMany(() => PphWithholdingRecord, pwr => pwr.statutoryTaxLiability)
  withholdingRecords: PphWithholdingRecord[];

  @OneToMany(() => TaxRemittanceAllocation, tra => tra.statutoryLiability)
  allocations: TaxRemittanceAllocation[];
}

