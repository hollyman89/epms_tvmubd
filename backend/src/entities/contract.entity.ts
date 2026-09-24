import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, OneToMany, VersionColumn } from 'typeorm';
import { Proposal } from './proposal.entity';
import { Customer } from './customer.entity';
import { User } from './user.entity';
import { ContractAmendment } from './contract-amendment.entity';

export enum LegalStatus {
  DRAFT = 'DRAFT',
  ON_REVIEW = 'ON_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
}

@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @VersionColumn()
  version: number;

  @Column({ type: 'bigint', unsigned: true })
  proposal_id: number;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  tender_id: number;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  customer_id: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  contract_number: string;

  @Column({ type: 'decimal', precision: 19, scale: 2, nullable: true })
  contract_value: number;

  @Column({ type: 'date', nullable: true })
  start_date: Date;

  @Column({ type: 'date', nullable: true })
  end_date: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status: string;

  // New Fields for Legal
  @Column({ type: 'enum', enum: LegalStatus, default: LegalStatus.DRAFT })
  legal_status: LegalStatus;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  legal_reviewer_id: number;

  @Column({ type: 'text', nullable: true })
  legal_notes: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  spk_file_url: string;

  @ManyToOne(() => Proposal, (proposal) => proposal.contracts)
  @JoinColumn({ name: 'proposal_id' })
  proposal: Proposal;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'legal_reviewer_id' })
  legal_reviewer: User;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  project_manager_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'project_manager_id' })
  project_manager: User;

  @Column({ type: 'datetime', nullable: true })
  ops_team_activated_at: Date;

  @Column({ type: 'datetime', nullable: true })
  grace_deadline: Date;

  @Column({ type: 'int', default: 0 })
  grace_extension_count: number;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  grace_extended_by: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'grace_extended_by' })
  grace_extended_by_user: User;

  @Column({ type: 'datetime', nullable: true })
  grace_extended_at: Date;

  @OneToMany(() => ContractAmendment, amendment => amendment.contract)
  amendments: ContractAmendment[];

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
