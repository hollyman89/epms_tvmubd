import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Project } from './project.entity';
import { Task } from './task.entity';
import { WorkBreakdownStructure } from './wbs.entity';
import { ProjectBaseline } from './project-baseline.entity';
import { User } from './user.entity';
import { ProjectProgressEvidence } from './project-progress-evidence.entity';

@Entity('project_progress_logs')
@Index('idx_progress_logs_query', ['task_id', 'status', 'effective_date', 'created_at', 'id'])
@Index('idx_progress_logs_project', ['project_id', 'status'])
@Index('idx_progress_logs_baseline', ['baseline_id'])
export class ProjectProgressLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'bigint', unsigned: true })
  project_id: number;

  @Column({ type: 'bigint', unsigned: true })
  task_id: number;

  @Column({ type: 'bigint', unsigned: true })
  wbs_id: number;

  @Column({ type: 'bigint', unsigned: true })
  baseline_id: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  previous_progress: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  reported_progress: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  progress_delta: number;

  @Column({ type: 'date' })
  effective_date: string;

  @Column({ type: 'varchar', length: 50 })
  event_type: string;

  @Column({
    type: 'enum',
    enum: ['PENDING_VERIFICATION', 'OFFICIAL', 'REJECTED'],
    default: 'PENDING_VERIFICATION',
  })
  status: 'PENDING_VERIFICATION' | 'OFFICIAL' | 'REJECTED';

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'bigint', unsigned: true })
  submitted_by: number;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  verified_by: number | null;

  @Column({ type: 'datetime', nullable: true })
  verified_at: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Task)
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @ManyToOne(() => WorkBreakdownStructure)
  @JoinColumn({ name: 'wbs_id' })
  wbs: WorkBreakdownStructure;

  @ManyToOne(() => ProjectBaseline)
  @JoinColumn({ name: 'baseline_id' })
  baseline: ProjectBaseline;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'submitted_by' })
  submitter: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'verified_by' })
  verifier: User | null;

  @OneToMany(() => ProjectProgressEvidence, (evidence) => evidence.progress_log)
  evidence: ProjectProgressEvidence[];

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}
