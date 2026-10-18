import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('idx_tasks_project_id')
  @Column({ name: 'project_id', type: 'bigint', unsigned: true })
  projectId: number;

  @Index('idx_tasks_wbs_id')
  @Column({ name: 'wbs_id', type: 'bigint', unsigned: true })
  wbsId: number;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'is_milestone', type: 'tinyint', width: 1, default: 0 })
  isMilestone: boolean;

  @Column({ type: 'date', name: 'start_date', nullable: true })
  startDate: string;

  @Column({ type: 'date', name: 'end_date', nullable: true })
  endDate: string;

  @Column({ type: 'int', unsigned: true, default: 0 })
  duration: number;

  @Index('idx_tasks_predecessor_task_id')
  @Column({
    name: 'predecessor_task_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  predecessorTaskId: number;

  @Column({ name: 'dependency_type', length: 10, default: 'FS' })
  dependencyType: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0.0 })
  progress: number;

  @Column({ length: 50, default: 'PLANNED' })
  status: string;

  @Column({ name: 'actual_start_at', type: 'datetime', nullable: true })
  actualStartAt: Date | null;

  @Column({ name: 'actual_finish_at', type: 'datetime', nullable: true })
  actualFinishAt: Date | null;

  @Column({
    name: 'assignee_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  assigneeId: number;

  @Column({
    name: 'created_by',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  createdBy: number;

  @Column({
    name: 'updated_by',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  updatedBy: number;

  @Column({
    name: 'deleted_by',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  deletedBy: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
