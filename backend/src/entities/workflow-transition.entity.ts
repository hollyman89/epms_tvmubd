import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WorkflowInstance } from './workflow-instance.entity';
import { WorkflowTask } from './workflow-task.entity';
import { WorkflowVersion } from './workflow-version.entity';
import { User } from './user.entity';

@Entity('workflow_transitions')
export class WorkflowTransition {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'instance_id', type: 'bigint', unsigned: true })
  instanceId: number;

  @Column({ name: 'task_id', type: 'bigint', unsigned: true, nullable: true })
  taskId: number;

  @Column({ name: 'from_node_id', length: 100 })
  fromNodeId: string;

  @Column({ name: 'to_node_id', length: 100 })
  toNodeId: string;

  @Column({ length: 50 })
  action: string; // START, AUTO, APPROVE, REJECT, RETURN, END

  @Column({ name: 'actor_id', type: 'bigint', unsigned: true, nullable: true })
  actorId: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ name: 'version_id', type: 'bigint', unsigned: true })
  versionId: number;

  @Column({ name: 'context_snapshot', type: 'json', nullable: true })
  contextSnapshot: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => WorkflowInstance, (instance) => instance.transitions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instance_id' })
  workflowInstance: WorkflowInstance;

  @ManyToOne(() => WorkflowTask, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'task_id' })
  workflowTask: WorkflowTask;

  @ManyToOne(() => WorkflowVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'version_id' })
  workflowVersion: WorkflowVersion;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor: User;
}
