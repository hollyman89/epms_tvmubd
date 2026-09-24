import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WorkflowDefinition } from './workflow-definition.entity';

@Entity('workflow_versions')
export class WorkflowVersion {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'workflow_definition_id', type: 'bigint', unsigned: true })
  workflowDefinitionId: number;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'json', name: 'bpmn_json' })
  bpmnJson: any;

  @Column({ length: 50, default: 'DRAFT' })
  status: string; // DRAFT, PUBLISHED

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  publishedAt: Date;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdBy: number;

  @Column({ name: 'updated_by', type: 'bigint', unsigned: true, nullable: true })
  updatedBy: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => WorkflowDefinition, (definition) => definition.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_definition_id' })
  workflowDefinition: WorkflowDefinition;
}
