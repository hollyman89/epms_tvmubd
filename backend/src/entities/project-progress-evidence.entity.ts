import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ProjectProgressLog } from './project-progress-log.entity';
import { Document } from './document.entity';
import { User } from './user.entity';

@Entity('project_progress_evidence')
@Index('uq_progress_log_document', ['progress_log_id', 'document_id'], { unique: true })
@Index('idx_progress_evidence_document', ['document_id'])
export class ProjectProgressEvidence {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'bigint', unsigned: true })
  progress_log_id: number;

  @Column({ type: 'bigint', unsigned: true })
  document_id: number;

  @Column({ type: 'bigint', unsigned: true })
  created_by: number;

  @ManyToOne(() => ProjectProgressLog, (log) => log.evidence, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'progress_log_id' })
  progress_log: ProjectProgressLog;

  @ManyToOne(() => Document, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'document_id' })
  document: Document;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;
}
