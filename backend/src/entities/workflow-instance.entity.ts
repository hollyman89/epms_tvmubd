import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  VersionColumn,
} from 'typeorm';
import { WorkflowDefinition } from './workflow-definition.entity';
import { WorkflowVersion } from './workflow-version.entity';
import { WorkflowTask } from './workflow-task.entity';
import { WorkflowTransition } from './workflow-transition.entity';

export enum WorkflowInstanceStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  TERMINATED = 'TERMINATED',
}

@Entity('workflow_instances')
export class WorkflowInstance {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'workflow_definition_id', type: 'bigint', unsigned: true })
  workflowDefinitionId: number;

  @Column({ name: 'workflow_version_id', type: 'bigint', unsigned: true })
  workflowVersionId: number;

  @Column({ name: 'entity_type', length: 100 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'bigint', unsigned: true })
  entityId: number;

  @Column({
    type: 'varchar',
    length: 50,
    default: WorkflowInstanceStatus.IN_PROGRESS,
  })
  status: WorkflowInstanceStatus;

  @Column({ name: 'current_node_id', length: 100, nullable: true })
  currentNodeId: string;

  @Column({ type: 'json', nullable: true })
  context: any;

  @Column({ name: 'current_state_data', type: 'json', nullable: true })
  currentStateData: any;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date;

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

  @ManyToOne(() => WorkflowDefinition, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'workflow_definition_id' })
  workflowDefinition: WorkflowDefinition;

  @ManyToOne(() => WorkflowVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'workflow_version_id' })
  workflowVersion: WorkflowVersion;

  @OneToMany(() => WorkflowTask, (task) => task.workflowInstance)
  tasks: WorkflowTask[];

  @OneToMany(() => WorkflowTransition, (transition) => transition.workflowInstance)
  transitions: WorkflowTransition[];
}
