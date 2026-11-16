import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

export enum TaxCategory {
  PPN = 'PPN',
  PPH = 'PPH',
}

export enum TaxRuleVerificationStatus {
  NOT_VERIFIED = 'NOT_VERIFIED',
  VERIFIED = 'VERIFIED',
}

@Entity('tax_regime_rules')
@Unique('uk_trr_regime_version', ['regimeCode', 'version'])
@Unique('uk_trr_id_category', ['id', 'taxCategory'])
export class TaxRegimeRule {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'regime_code', type: 'varchar', length: 50 })
  regimeCode: string;

  @Column({
    name: 'tax_category',
    type: 'enum',
    enum: TaxCategory,
  })
  taxCategory: TaxCategory;

  @Column({ name: 'article_reference', type: 'varchar', length: 100 })
  articleReference: string;

  @Column({ name: 'statutory_rate', type: 'decimal', precision: 7, scale: 4 })
  statutoryRate: number;

  @Column({
    name: 'effective_rate_multiplier',
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 1.0,
  })
  effectiveRateMultiplier: number;

  @Column({ name: 'governing_regulation', type: 'varchar', length: 255 })
  governingRegulation: string;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string | Date;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo?: string | Date | null;

  @Column({ name: 'version', type: 'int', default: 1 })
  version: number;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean;

  @Column({
    name: 'verification_status',
    type: 'enum',
    enum: TaxRuleVerificationStatus,
    default: TaxRuleVerificationStatus.NOT_VERIFIED,
  })
  verificationStatus: TaxRuleVerificationStatus;

  @Column({ name: 'verified_by', type: 'bigint', unsigned: true, nullable: true })
  verifiedBy?: number | null;

  @Column({ name: 'verified_at', type: 'datetime', nullable: true })
  verifiedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}

