import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('work_breakdown_structures')
export class WorkBreakdownStructure {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'project_id' })
  projectId: number;

  @Column({ name: 'parent_wbs_id', nullable: true })
  parentWbsId: number;

  @Column()
  code: string;

  @Column()
  name: string;

  @Column({ default: 1 })
  level: number;

  @Column({ name: 'weight_percentage', type: 'decimal', precision: 5, scale: 2, default: 0.0 })
  weightPercentage: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  // Audit trail columns — present in DB schema, aligned here for ORM consistency
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
}
