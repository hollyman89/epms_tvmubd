import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { TaxRemittanceRecord } from './tax-remittance-record.entity';
import { PphWithholdingRecord } from './pph-withholding-record.entity';
import { StatutoryTaxLiability } from './statutory-tax-liability.entity';

export enum AllocationStatus {
  ALLOCATED = 'ALLOCATED',
  REVERSED = 'REVERSED',
}

@Entity('tax_remittance_allocations')
@Index('idx_tra_company_period', ['companyCode', 'taxPeriodYear', 'taxPeriodMonth', 'taxRegime'])
export class TaxRemittanceAllocation {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'remittance_record_id', type: 'bigint', unsigned: true })
  remittanceRecordId: number;

  @Column({ name: 'withholding_record_id', type: 'bigint', unsigned: true })
  withholdingRecordId: number;

  @Column({ name: 'statutory_liability_id', type: 'bigint', unsigned: true })
  statutoryLiabilityId: number;

  @Column({ name: 'company_code', type: 'varchar', length: 10 })
  companyCode: string; // 'UBD' | 'TVM' (DEC-TAX-07)

  @Column({ name: 'tax_period_month', type: 'tinyint', unsigned: true })
  taxPeriodMonth: number;

  @Column({ name: 'tax_period_year', type: 'smallint', unsigned: true })
  taxPeriodYear: number;

  @Column({ name: 'tax_regime', type: 'varchar', length: 30 })
  taxRegime: string;

  @Column({
    name: 'allocated_amount',
    type: 'decimal',
    precision: 19,
    scale: 2,
  })
  allocatedAmount: number;

  @Column({
    name: 'allocation_status',
    type: 'enum',
    enum: AllocationStatus,
    default: AllocationStatus.ALLOCATED,
  })
  allocationStatus: AllocationStatus;

  @Column({ name: 'allocated_by', type: 'bigint', unsigned: true })
  allocatedBy: number;

  @Column({ name: 'reversal_reason', type: 'varchar', length: 255, nullable: true })
  reversalReason?: string | null;

  @Column({ name: 'reversed_by', type: 'bigint', unsigned: true, nullable: true })
  reversedBy?: number | null;

  @Column({ name: 'reversed_at', type: 'datetime', nullable: true })
  reversedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  @ManyToOne(() => TaxRemittanceRecord, trr => trr.allocations, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'remittance_record_id' })
  remittanceRecord: TaxRemittanceRecord;

  @ManyToOne(() => PphWithholdingRecord, pwr => pwr.allocations, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'withholding_record_id' })
  withholdingRecord: PphWithholdingRecord;

  @ManyToOne(() => StatutoryTaxLiability, stl => stl.allocations, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'statutory_liability_id' })
  statutoryLiability: StatutoryTaxLiability;
}

