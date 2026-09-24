import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Project } from './project.entity';
import { User } from './user.entity';

@Entity('project_management_reviews')
export class ProjectManagementReview {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'project_id', type: 'bigint', unsigned: true })
  @Index('uq_pmr_project_id', { unique: true })
  projectId: number;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'NOT_SUBMITTED',
  })
  @Index('idx_pmr_status')
  status: string;

  @Column({ name: 'submitted_by', type: 'bigint', unsigned: true, nullable: true })
  submittedBy?: number | null;

  @Column({ name: 'submitted_at', type: 'datetime', nullable: true })
  submittedAt?: Date | null;

  @Column({ name: 'decided_by', type: 'bigint', unsigned: true, nullable: true })
  decidedBy?: number | null;

  @Column({ name: 'decided_at', type: 'datetime', nullable: true })
  decidedAt?: Date | null;

  @Column({ name: 'reviewer_role', type: 'varchar', length: 50, nullable: true })
  reviewerRole?: string | null;

  @Column({ name: 'revision_notes', type: 'text', nullable: true })
  revisionNotes?: string | null;

  @Column({ name: 'checklist_snapshot', type: 'text', nullable: true })
  checklistSnapshot?: string | null;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdBy?: number | null;

  @Column({ name: 'updated_by', type: 'bigint', unsigned: true, nullable: true })
  updatedBy?: number | null;

  @Column({ name: 'deleted_by', type: 'bigint', unsigned: true, nullable: true })
  deletedBy?: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  @Index('idx_pmr_deleted_at')
  deletedAt?: Date | null;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'submitted_by' })
  submitter?: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'decided_by' })
  decider?: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator?: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updater?: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'deleted_by' })
  deleter?: User | null;
}
