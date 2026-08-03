import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Tender } from './tender.entity';
import { Contract } from './contract.entity';

@Entity('proposals')
export class Proposal {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'bigint', unsigned: true })
  tender_id: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  proposal_number: string;

  @Column({ type: 'decimal', precision: 19, scale: 2, nullable: true })
  proposed_amount: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status: string;

  @ManyToOne(() => Tender, (tender) => tender.proposals)
  @JoinColumn({ name: 'tender_id' })
  tender: Tender;

  @OneToMany(() => Contract, (contract) => contract.proposal)
  contracts: Contract[];

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
