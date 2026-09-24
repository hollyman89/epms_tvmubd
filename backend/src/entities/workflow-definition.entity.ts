import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { WorkflowVersion } from './workflow-version.entity';

@Entity('workflow_definitions')
export class WorkflowDefinition {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'workflow_key', length: 100, unique: true })
  workflowKey: string;

  @Column({ length: 255, nullable: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 50, nullable: true })
  domain: string;

  @Column({ name: 'active_version', type: 'int', nullable: true })
  activeVersion: number;

  @Column({ length: 50, default: 'DRAFT' })
  status: string; // DRAFT, PUBLISHED, ARCHIVED

  @Column({ name: 'bpmn_json', type: 'json', nullable: true })
  bpmnJson?: any;

  @Column({ name: 'is_active', type: 'tinyint', default: 1, nullable: true })
  isActive?: number;

  @Column({ type: 'int', nullable: true })
  version?: number;

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

  @OneToMany(() => WorkflowVersion, (version) => version.workflowDefinition)
  versions: WorkflowVersion[];
}
