import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, OneToMany, VersionColumn } from 'typeorm';
import { Customer } from './customer.entity';
import { Proposal } from './proposal.entity';

export enum TenderStatus {
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  NEGOTIATION = 'NEGOTIATION',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  WON = 'WON',
  LOST = 'LOST',
}

export enum GoNoGoStatus {
  PENDING = 'PENDING',
  GO = 'GO',
  NO_GO = 'NO_GO',
}

export enum TenderStage {
  LEAD = 'LEAD',
  WAITING_GO_NO_GO = 'WAITING_GO_NO_GO',
  QUALIFICATION = 'QUALIFICATION',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  WON = 'WON',
  LOST = 'LOST',
}

export enum RevisionStatus {
  NOT_REQUIRED = 'NOT_REQUIRED',
  REQUIRED = 'REQUIRED',
  COMPLETED = 'COMPLETED',
}

@Entity('tenders')
export class Tender {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @VersionColumn()
  version: number;

  @Column({ type: 'bigint', unsigned: true })
  customer_id: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'datetime', nullable: true })
  submission_deadline: Date;

  @Column({ type: 'decimal', precision: 19, scale: 2, nullable: true })
  estimated_budget: number;

  @Column({ type: 'decimal', precision: 19, scale: 2, nullable: true })
  negotiated_price: number;

  @Column({ type: 'int', default: 20 })
  max_discount_rate: number;

  @Column({ type: 'datetime', nullable: true })
  grace_deadline: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  spk_file_key: string;

  @Column({ type: 'enum', enum: ['UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'SPK_REQUIRED'], default: 'UNVERIFIED' })
  spk_verification_status: string;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  marketing_pic_id: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  pic_customer_name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  pic_customer_phone: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  pic_customer_email: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  business_sector: string;

  @Column({ type: 'varchar', length: 50, default: 'LEAD' })
  stage: string;

  @Column({ type: 'int', default: 0 })
  probability_percentage: number;

  @Column({ type: 'enum', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' })
  priority: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  source: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'date', nullable: true })
  expected_closing_date: Date;

  @Column({ type: 'enum', enum: ['TENDER', 'DIRECT_APPOINTMENT'], default: 'TENDER' })
  procurement_type: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  project_location: string;

  @Column({ type: 'date', nullable: true })
  bid_submission_deadline: Date;

  @Column({ type: 'enum', enum: TenderStatus, default: TenderStatus.NEW })
  status: TenderStatus;

  @Column({ type: 'enum', enum: GoNoGoStatus, default: GoNoGoStatus.PENDING })
  go_nogo_status: GoNoGoStatus;

  @Column({ type: 'text', nullable: true })
  go_nogo_notes: string;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  go_nogo_by: number;

  @Column({ type: 'datetime', nullable: true })
  go_nogo_at: Date;

  @Column({ type: 'enum', enum: RevisionStatus, default: RevisionStatus.NOT_REQUIRED })
  revision_status: RevisionStatus;

  @ManyToOne(() => Customer, (customer) => customer.tenders)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @OneToMany(() => Proposal, (proposal) => proposal.tender)
  proposals: Proposal[];

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  created_by: number;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  updated_by: number;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  deleted_by: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;
}
