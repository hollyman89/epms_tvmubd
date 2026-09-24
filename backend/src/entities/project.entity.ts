import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, VersionColumn } from 'typeorm';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'contract_id', type: 'bigint', unsigned: true, nullable: true })
  contractId?: number;

  @Column({ name: 'manager_id' })
  managerId: number;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ default: 'PLANNING' })
  status: string;

  @Column({ type: 'date', name: 'start_date', nullable: true })
  startDate: string;

  @Column({ type: 'date', name: 'end_date', nullable: true })
  endDate: string;

  @Column({ name: 'site_name', type: 'varchar', length: 200, nullable: true })
  siteName: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  province: string;

  @Column({ name: 'postal_code', type: 'varchar', length: 10, nullable: true })
  postalCode: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @VersionColumn({ name: 'version', default: 1 })
  version: number;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdBy?: number;

  @Column({ name: 'updated_by', type: 'bigint', unsigned: true, nullable: true })
  updatedBy?: number;

  @Column({ name: 'deleted_by', type: 'bigint', unsigned: true, nullable: true })
  deletedBy?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
