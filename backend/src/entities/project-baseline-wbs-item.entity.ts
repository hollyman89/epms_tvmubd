import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ProjectBaseline } from './project-baseline.entity';

@Entity('project_baseline_wbs_items')
@Index('uq_baseline_wbs', ['baseline_id', 'wbs_id'], { unique: true })
@Index('idx_baseline_wbs_task', ['baseline_id', 'task_id'])
export class ProjectBaselineWbsItem {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'bigint', unsigned: true })
  baseline_id: number;

  @Column({ type: 'bigint', unsigned: true })
  wbs_id: number;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  parent_wbs_id: number | null;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'int' })
  level: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  weight_percentage: number;

  @Column({ type: 'tinyint', width: 1 })
  is_leaf: boolean;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  task_id: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  task_name_snapshot: string | null;

  @ManyToOne(() => ProjectBaseline, (baseline) => baseline.wbs_items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'baseline_id' })
  baseline: ProjectBaseline;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;
}
