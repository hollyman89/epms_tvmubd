import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('vendor_comparisons')
export class VendorComparison {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'rfq_id' })
  rfqId: number;

  @Column({ name: 'vendor_id' })
  vendorId: number;

  @Column({ type: 'decimal', precision: 19, scale: 2, name: 'offered_amount' })
  offeredAmount: number;

  @Column({ name: 'is_winner', default: false })
  isWinner: boolean;

  @Column({ nullable: true })
  remarks: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
