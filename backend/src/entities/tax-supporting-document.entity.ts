import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum TaxTargetType {
  VENDOR = 'VENDOR',
  INVOICE = 'INVOICE',
  REMITTANCE = 'REMITTANCE',
}

export enum TaxDocumentCategory {
  E_FAKTUR_PDF = 'E_FAKTUR_PDF',
  BUKTI_POTONG_PDF = 'BUKTI_POTONG_PDF',
  SKB_PPH23 = 'SKB_PPH23',
  SUKET_PP55 = 'SUKET_PP55',
  LPJK_SBU = 'LPJK_SBU',
  NTPN_E_BILLING_RECEIPT = 'NTPN_E_BILLING_RECEIPT',
  OTHER_TAX_DOC = 'OTHER_TAX_DOC',
}

export enum TaxDocVerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

@Entity('tax_supporting_documents')
@Index('idx_tsd_target', ['targetType', 'targetId', 'documentCategory'])
export class TaxSupportingDocument {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({
    name: 'target_type',
    type: 'enum',
    enum: TaxTargetType,
  })
  targetType: TaxTargetType;

  @Column({ name: 'target_id', type: 'bigint', unsigned: true })
  targetId: number;

  @Column({
    name: 'document_category',
    type: 'enum',
    enum: TaxDocumentCategory,
  })
  documentCategory: TaxDocumentCategory;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'file_path', type: 'varchar', length: 500 })
  filePath: string;

  @Column({ name: 'file_size_bytes', type: 'bigint', unsigned: true })
  fileSizeBytes: number;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ name: 'document_hash', type: 'varchar', length: 64, unique: true })
  documentHash: string;

  @Column({ name: 'valid_from', type: 'date', nullable: true })
  validFrom?: string | Date | null;

  @Column({ name: 'valid_to', type: 'date', nullable: true })
  validTo?: string | Date | null;

  @Column({
    name: 'verification_status',
    type: 'enum',
    enum: TaxDocVerificationStatus,
    default: TaxDocVerificationStatus.UNVERIFIED,
  })
  verificationStatus: TaxDocVerificationStatus;

  @Column({ name: 'verified_by', type: 'bigint', unsigned: true, nullable: true })
  verifiedBy?: number | null;

  @Column({ name: 'verified_at', type: 'datetime', nullable: true })
  verifiedAt?: Date | null;

  @Column({ name: 'rejection_reason', type: 'varchar', length: 255, nullable: true })
  rejectionReason?: string | null;

  @Column({ name: 'uploaded_by', type: 'bigint', unsigned: true })
  uploadedBy: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}

