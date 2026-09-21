import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  VersionColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { User } from './user.entity';
import { ProcurementPackageItem } from './procurement-package-item.entity';
import { PurchaseRequest } from './purchase-request.entity';

export enum ProcurementPackageStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  RETURNED = 'RETURNED',
  PR_CREATED = 'PR_CREATED',
  CANCELLED = 'CANCELLED',
  CLOSED = 'CLOSED',
}

@Entity('procurement_packages')
export class ProcurementPackage {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'package_number', type: 'varchar', length: 100, unique: true })
  packageNumber: string;

  @Column({ name: 'project_id', type: 'bigint', unsigned: true })
  projectId: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'required_date', type: 'date', nullable: true })
  requiredDate?: string;

  @Column({
    name: 'total_estimated_amount',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  totalEstimatedAmount: number;

  @Column({
    type: 'varchar',
    length: 50,
    default: ProcurementPackageStatus.DRAFT,
  })
  status: ProcurementPackageStatus;

  @Column({ name: 'requested_by', type: 'bigint', unsigned: true })
  requestedBy: number;

  @Column({ name: 'submitted_at', type: 'datetime', nullable: true })
  submittedAt?: Date;

  @Column({ name: 'reviewed_by', type: 'bigint', unsigned: true, nullable: true })
  reviewedBy?: number;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewedAt?: Date;

  @Column({ name: 'rejection_notes', type: 'text', nullable: true })
  rejectionNotes?: string;

  @VersionColumn({ default: 1 })
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
  deletedAt?: Date;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by' })
  requester: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer?: User;

  @OneToMany(() => ProcurementPackageItem, (item) => item.package, {
    cascade: true,
  })
  items: ProcurementPackageItem[];

  @OneToOne(() => PurchaseRequest, (pr) => pr.package, { nullable: true })
  purchaseRequest?: PurchaseRequest;
}
