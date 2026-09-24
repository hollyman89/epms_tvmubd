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
import { User } from './user.entity';
import { ProjectBaselineWbsItem } from './project-baseline-wbs-item.entity';

@Entity('project_baselines')
@Index('uq_project_baseline_version', ['project_id', 'version_number'], { unique: true })
export class ProjectBaseline {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'bigint', unsigned: true })
  project_id: number;

  @Column({ type: 'int', unsigned: true })
  version_number: number;

  @Column({
    type: 'enum',
    enum: ['DRAFT', 'ACTIVE', 'SUPERSEDED'],
    default: 'DRAFT',
  })
  status: 'DRAFT' | 'ACTIVE' | 'SUPERSEDED';

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 100.0,
  })
  total_weight_percentage: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  created_by: number | null;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  activated_by: number | null;

  @Column({ type: 'datetime', nullable: true })
  activated_at: Date | null;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'activated_by' })
  activator: User | null;

  @OneToMany(() => ProjectBaselineWbsItem, (item) => item.baseline)
  wbs_items: ProjectBaselineWbsItem[];

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}
