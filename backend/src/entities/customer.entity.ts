import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Tender } from './tender.entity';
import { User } from './user.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  company: string;

  @Column({ type: 'varchar', length: 100 })
  contact_person: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  business_sector: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  @Column({ type: 'enum', enum: ['Active', 'Inactive', 'PROSPECT'], default: 'Active' })
  status: string;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  marketing_pic_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'marketing_pic_id' })
  marketing_pic: User;

  @OneToMany(() => Tender, (tender) => tender.customer)
  tenders: Tender[];

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
