import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Vendor } from './vendor.entity';

export enum TaxResidence {
  DOMESTIC = 'DOMESTIC',
  FOREIGN = 'FOREIGN',
}

export enum ConstructionQualification {
  NONE = 'NONE',
  KECIL = 'KECIL',
  MENENGAH_BESAR = 'MENENGAH_BESAR',
  TIDAK_TERKUALIFIKASI = 'TIDAK_TERKUALIFIKASI',
}

@Entity('vendor_tax_profiles')
export class VendorTaxProfile {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'vendor_id', type: 'bigint', unsigned: true, unique: true })
  vendorId: number;

  @Column({ name: 'npwp_16', type: 'varchar', length: 16 })
  npwp16: string;

  @Column({ name: 'nitku', type: 'varchar', length: 22, default: '000000' })
  nitku: string;

  @Column({
    name: 'pkp_status',
    type: 'enum',
    enum: ['UNVERIFIED', 'PKP', 'NON_PKP'],
    default: 'UNVERIFIED',
  })
  pkpStatus: 'UNVERIFIED' | 'PKP' | 'NON_PKP';

  @Column({ name: 'sppkp_number', type: 'varchar', length: 100, nullable: true })
  sppkpNumber?: string | null;

  @Column({ name: 'sppkp_date', type: 'date', nullable: true })
  sppkpDate?: string | Date | null;

  @Column({
    name: 'tax_residence',
    type: 'enum',
    enum: TaxResidence,
    default: TaxResidence.DOMESTIC,
  })
  taxResidence: TaxResidence;

  @Column({ name: 'tax_id_country', type: 'varchar', length: 3, default: 'IDN' })
  taxIdCountry: string;

  @Column({ name: 'has_skb_pph23', type: 'boolean', default: false })
  hasSkbPph23: boolean;

  @Column({ name: 'skb_pph23_number', type: 'varchar', length: 100, nullable: true })
  skbPph23Number?: string | null;

  @Column({ name: 'skb_pph23_expiry', type: 'date', nullable: true })
  skbPph23Expiry?: string | Date | null;

  @Column({ name: 'has_suket_pp55', type: 'boolean', default: false })
  hasSuketPp55: boolean;

  @Column({ name: 'suket_pp55_number', type: 'varchar', length: 100, nullable: true })
  suketPp55Number?: string | null;

  @Column({ name: 'suket_pp55_expiry', type: 'date', nullable: true })
  suketPp55Expiry?: string | Date | null;

  @Column({ name: 'is_construction_service', type: 'boolean', default: false })
  isConstructionService: boolean;

  @Column({
    name: 'construction_qualification',
    type: 'enum',
    enum: ConstructionQualification,
    default: ConstructionQualification.NONE,
  })
  constructionQualification: ConstructionQualification;

  @Column({ name: 'sbu_certificate_number', type: 'varchar', length: 100, nullable: true })
  sbuCertificateNumber?: string | null;

  @Column({ name: 'sbu_expiry_date', type: 'date', nullable: true })
  sbuExpiryDate?: string | Date | null;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ name: 'verified_by', type: 'bigint', unsigned: true, nullable: true })
  verifiedBy?: number | null;

  @Column({ name: 'verified_at', type: 'datetime', nullable: true })
  verifiedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  @OneToOne(() => Vendor, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;
}
