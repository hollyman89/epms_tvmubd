import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { PurchaseRequest } from './purchase-request.entity';
import { Quotation } from './quotation.entity';
import { User } from './user.entity';

@Entity('rfqs')
export class Rfq {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'pr_id' })
  prId: number;

  @Column({ name: 'rfq_number', unique: true })
  rfqNumber: string;

  @Column({ default: 'OPEN' })
  status: string;

  @Column({ name: 'closing_date', type: 'datetime', nullable: true })
  closingDate: Date;

  @Column({ name: 'created_by', nullable: true })
  createdBy: number;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: number;

  @Column({ name: 'deleted_by', nullable: true })
  deletedBy: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;

  @ManyToOne(() => PurchaseRequest, pr => pr.rfqs, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pr_id' })
  purchaseRequest: PurchaseRequest;

  @OneToMany(() => Quotation, q => q.rfq)
  quotations: Quotation[];

  @ManyToOne(() => User, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'created_by' })
  creator?: User;
}
