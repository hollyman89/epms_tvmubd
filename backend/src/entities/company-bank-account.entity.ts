import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  OneToMany,
} from 'typeorm';
import { Payment } from './payment.entity';

export enum CompanyBankAccountType {
  GIRO = 'GIRO',
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS',
  ESCROW = 'ESCROW',
  OTHER = 'OTHER',
}

export enum CompanyBankAccountPurpose {
  OPERATIONAL = 'OPERATIONAL',
  PROJECT = 'PROJECT',
  VENDOR_PAYMENT = 'VENDOR_PAYMENT',
  TAX_REMITTANCE = 'TAX_REMITTANCE',
  OTHER = 'OTHER',
}

export enum CompanyBankAccountStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
}

@Entity('company_bank_accounts')
export class CompanyBankAccount {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'company_code', type: 'varchar', length: 10 })
  companyCode: string; // 'UBD' | 'TVM'

  @Column({ name: 'bank_name', type: 'varchar', length: 100 })
  bankName: string;

  @Column({ name: 'bank_code', type: 'varchar', length: 30, nullable: true })
  bankCode?: string | null;

  @Column({ name: 'account_number', type: 'varchar', length: 50 })
  accountNumber: string;

  @Column({ name: 'account_holder_name', type: 'varchar', length: 200 })
  accountHolderName: string;

  @Column({
    name: 'account_type',
    type: 'varchar',
    length: 30,
    default: CompanyBankAccountType.GIRO,
  })
  accountType: CompanyBankAccountType;

  @Column({
    name: 'account_purpose',
    type: 'varchar',
    length: 40,
    default: CompanyBankAccountPurpose.OPERATIONAL,
  })
  accountPurpose: CompanyBankAccountPurpose;

  @Column({ name: 'currency', type: 'varchar', length: 3, default: 'IDR' })
  currency: string;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: CompanyBankAccountStatus.ACTIVE,
  })
  status: CompanyBankAccountStatus;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate: string | Date;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate?: string | Date | null;

  @Column({ name: 'pic_name', type: 'varchar', length: 150, nullable: true })
  picName?: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string | null;

  @Column({ name: 'last_change_reason', type: 'text', nullable: true })
  lastChangeReason?: string | null;

  @VersionColumn()
  version: number;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdBy?: number | null;

  @Column({ name: 'updated_by', type: 'bigint', unsigned: true, nullable: true })
  updatedBy?: number | null;

  @Column({ name: 'deleted_by', type: 'bigint', unsigned: true, nullable: true })
  deletedBy?: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt?: Date | null;

  @OneToMany(() => Payment, (payment) => payment.companyBankAccount)
  payments?: Payment[];
}
