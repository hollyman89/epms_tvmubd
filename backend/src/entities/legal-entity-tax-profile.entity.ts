import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PkpStatus {
  UNVERIFIED = 'UNVERIFIED',
  PKP = 'PKP',
  NON_PKP = 'NON_PKP',
}

@Entity('legal_entity_tax_profiles')
export class LegalEntityTaxProfile {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'company_code', type: 'varchar', length: 10, unique: true })
  companyCode: string; // 'UBD' | 'TVM' (DEC-TAX-07)

  @Column({ name: 'legal_entity_name', type: 'varchar', length: 255 })
  legalEntityName: string;

  @Column({ name: 'npwp_16', type: 'varchar', length: 16, unique: true })
  npwp16: string;

  @Column({ name: 'nitku', type: 'varchar', length: 22, default: '000000' })
  nitku: string;

  @Column({ name: 'kpp_pratama_name', type: 'varchar', length: 100 })
  kppPratamaName: string;

  @Column({
    name: 'pkp_status',
    type: 'enum',
    enum: PkpStatus,
    default: PkpStatus.UNVERIFIED,
  })
  pkpStatus: PkpStatus;

  @Column({ name: 'sppkp_number', type: 'varchar', length: 100, nullable: true })
  sppkpNumber?: string | null;

  @Column({ name: 'sppkp_date', type: 'date', nullable: true })
  sppkpDate?: string | Date | null;

  @Column({ name: 'is_wapu', type: 'boolean', default: false })
  isWapu: boolean;

  @Column({ name: 'wapu_decree_number', type: 'varchar', length: 100, nullable: true })
  wapuDecreeNumber?: string | null;

  @Column({ name: 'default_tax_currency', type: 'varchar', length: 3, default: 'IDR' })
  defaultTaxCurrency: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}

