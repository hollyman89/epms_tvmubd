import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  VersionColumn,
} from 'typeorm';
import { WorkflowInstance } from './workflow-instance.entity';
import { Role } from './role.entity';
import { User } from './user.entity';

export enum WorkflowTaskStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  RETURNED = 'RETURNED',
  CANCELED = 'CANCELED',
}

@Entity('workflow_tasks')
export class WorkflowTask {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'workflow_instance_id', type: 'bigint', unsigned: true })
  workflowInstanceId: number;

  @Column({ name: 'node_id', length: 100, nullable: true })
  nodeId: string;

  @Column({ name: 'task_key', length: 100 })
  taskKey: string;

  @Column({ name: 'assignee_role_id', type: 'bigint', unsigned: true, nullable: true })
  assigneeRoleId: number;

  @Column({ name: 'assignee_user_id', type: 'bigint', unsigned: true, nullable: true })
  assigneeUserId: number;

  @Column({
    type: 'varchar',
    length: 50,
    default: WorkflowTaskStatus.PENDING,
  })
  status: WorkflowTaskStatus;

  @Column({ length: 50, nullable: true })
  action: string; // APPROVE, REJECT, RETURN

  @Column({ name: 'decided_by', type: 'bigint', unsigned: true, nullable: true })
  decidedBy: number;

  @Column({ name: 'decided_at', type: 'datetime', nullable: true })
  decidedAt: Date;

  @Column({ name: 'due_at', type: 'datetime', nullable: true })
  dueAt: Date;

  @Column({ type: 'text', nullable: true })
  comments: string;

  @VersionColumn({ default: 1 })
  version: number;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdBy: number;

  @Column({ name: 'updated_by', type: 'bigint', unsigned: true, nullable: true })
  updatedBy: number;

  @Column({ name: 'deleted_by', type: 'bigint', unsigned: true, nullable: true })
  deletedBy: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;

  @ManyToOne(() => WorkflowInstance, (instance) => instance.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_instance_id' })
  workflowInstance: WorkflowInstance;

  @ManyToOne(() => Role, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assignee_role_id' })
  assigneeRole: Role;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignee_user_id' })
  assigneeUser: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'decided_by' })
  decidedByUser: User;
}
