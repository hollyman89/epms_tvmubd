import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Contract } from './contract.entity';
import { User } from './user.entity';

@Entity('contract_amendments')
@Index(['contract_id', 'created_at'])
export class ContractAmendment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'bigint', unsigned: true })
  contract_id: number;

  @Column({ type: 'int', default: 1 })
  version_number: number;

  @Column({ type: 'decimal', precision: 19, scale: 2, nullable: true })
  old_value: number;

  @Column({ type: 'decimal', precision: 19, scale: 2, nullable: true })
  new_value: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  approved_by: number;

  @ManyToOne(() => Contract, contract => contract.amendments)
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approved_by' })
  approver: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
