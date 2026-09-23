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
  VersionColumn,
} from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { Invoice } from './invoice.entity';

export enum PaymentTermType {
  DOWN_PAYMENT = 'DOWN_PAYMENT',
  PROGRESS = 'PROGRESS',
  FINAL_DELIVERY = 'FINAL_DELIVERY',
  RETENTION = 'RETENTION',
}

export enum PaymentTermStatus {
  PENDING = 'PENDING',
  INVOICE_SUBMITTED = 'INVOICE_SUBMITTED',
  VERIFIED = 'VERIFIED',
  PAID = 'PAID',
}

@Entity('po_payment_terms')
export class PoPaymentTerm {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'po_id', type: 'bigint' })
  poId: number;

  @Column({ type: 'int' })
  sequence: number;

  @Column({ name: 'term_name', type: 'varchar', length: 100 })
  termName: string;

  @Column({
    name: 'term_type',
    type: 'enum',
    enum: PaymentTermType,
    default: PaymentTermType.PROGRESS,
  })
  termType: PaymentTermType;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  percentage: number;

  @Column({ type: 'decimal', precision: 19, scale: 2 })
  amount: number;

  @Column({ name: 'trigger_condition', type: 'varchar', length: 255, nullable: true })
  triggerCondition: string;

  @Column({ name: 'is_retention', type: 'boolean', default: false })
  isRetention: boolean;

  @Column({ name: 'retention_days', type: 'int', nullable: true })
  retentionDays: number;

  @Column({
    type: 'enum',
    enum: PaymentTermStatus,
    default: PaymentTermStatus.PENDING,
  })
  status: PaymentTermStatus;

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

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;

  @VersionColumn()
  version: number;

  @ManyToOne(() => PurchaseOrder, (po) => po.paymentTerms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'po_id' })
  purchaseOrder: PurchaseOrder;

  @OneToMany(() => Invoice, (inv) => inv.paymentTerm)
  invoices?: Invoice[];
}

