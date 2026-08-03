import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, VersionColumn } from 'typeorm';
import { Invoice } from './invoice.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @VersionColumn()
  version: number;

  @Column({ name: 'invoice_id' })
  invoiceId: number;

  @Column({ name: 'payment_number', unique: true })
  paymentNumber: string;

  @Column({ name: 'payment_date', type: 'datetime' })
  paymentDate: Date;

  @Column({ name: 'amount_paid', type: 'decimal', precision: 19, scale: 2 })
  amount: number;


  @Column({ name: 'created_by', nullable: true })
  createdBy: number;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: number;

  @Column({ name: 'deleted_by', nullable: true })
  deletedBy: number;

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date;

  @ManyToOne(() => Invoice, inv => inv.payments, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;
}
