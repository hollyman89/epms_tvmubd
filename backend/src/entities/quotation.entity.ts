import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Rfq } from './rfq.entity';
import { Vendor } from './vendor.entity';
import { QuotationItem } from './quotation-item.entity';

@Entity('quotations')
export class Quotation {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'rfq_id', type: 'bigint' })
  rfqId: number;

  @Column({ name: 'vendor_id', type: 'bigint' })
  vendorId: number;

  @Column({ name: 'quotation_number', type: 'varchar', length: 100, unique: true })
  quotationNumber: string;

  @Column({ name: 'vendor_ref', type: 'varchar', length: 100, nullable: true })
  vendorRef: string;

  @Column({ name: 'quotation_date', type: 'datetime' })
  quotationDate: Date;

  @Column({ name: 'valid_until', type: 'datetime', nullable: true })
  validUntil: Date;

  @Column({ name: 'lead_time_days', type: 'int', default: 14 })
  leadTimeDays: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 19, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'varchar', length: 50, default: 'SUBMITTED' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy: number;

  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy: number;

  @Column({ name: 'deleted_by', type: 'bigint', nullable: true })
  deletedBy: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;

  @ManyToOne(() => Rfq, (rfq) => rfq.quotations, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rfq_id' })
  rfq: Rfq;

  @ManyToOne(() => Vendor, (vendor) => vendor.quotations, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @OneToMany(() => QuotationItem, (item) => item.quotation, { cascade: true })
  items: QuotationItem[];
}
