import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  ManyToOne,
  OneToOne,
  JoinColumn,
  VersionColumn,
} from 'typeorm';
import { PurchaseRequestItem } from './purchase-request-item.entity';
import { Rfq } from './rfq.entity';
import { Project } from './project.entity';

@Entity('purchase_requests')
export class PurchaseRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @VersionColumn()
  version: number;

  @Column({ name: 'project_id' })
  projectId: number;

  @Column({ name: 'package_id', type: 'bigint', unsigned: true, nullable: true, unique: true })
  packageId?: number;

  @Column({ name: 'origin', type: 'varchar', length: 30 })
  origin: 'LEGACY' | 'PACKAGE' | 'AD_HOC';

  @Column({ name: 'requester_id' })
  requesterId: number;

  @Column({ name: 'pr_number', unique: true })
  prNumber: string;

  @Column({ type: 'decimal', precision: 19, scale: 2, name: 'total_estimated_amount', default: 0 })
  totalEstimatedAmount: number;

  @Column({ default: 'DRAFT' })
  status: string;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @OneToOne('ProcurementPackage', (pkg: any) => pkg.purchaseRequest, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'package_id' })
  package?: any;

  @OneToMany(() => PurchaseRequestItem, item => item.purchaseRequest, { cascade: true })
  items: PurchaseRequestItem[];

  @OneToMany(() => Rfq, rfq => rfq.purchaseRequest, { cascade: true })
  rfqs: Rfq[];

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
