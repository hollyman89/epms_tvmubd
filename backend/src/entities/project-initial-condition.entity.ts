import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Project } from './project.entity';
import { User } from './user.entity';

@Entity('project_initial_conditions')
export class ProjectInitialCondition {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'project_id', type: 'bigint', unsigned: true })
  @Index('uq_pic_project_id', { unique: true })
  projectId: number;

  @Column({
    name: 'condition_status',
    type: 'varchar',
    length: 50,
    default: 'NORMAL',
  })
  conditionStatus: string;

  @Column({ name: 'location_condition', type: 'text' })
  locationCondition: string;

  @Column({ name: 'existing_infrastructure', type: 'text', nullable: true })
  existingInfrastructure?: string | null;

  @Column({ name: 'access_logistics', type: 'text', nullable: true })
  accessLogistics?: string | null;

  @Column({ name: 'initial_constraints', type: 'text' })
  initialConstraints: string;

  @Column({ name: 'initial_risks', type: 'text' })
  initialRisks: string;

  @Column({ name: 'pm_recommendation', type: 'text', nullable: true })
  pmRecommendation?: string | null;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdBy?: number | null;

  @Column({ name: 'updated_by', type: 'bigint', unsigned: true, nullable: true })
  updatedBy?: number | null;

  @Column({ name: 'deleted_by', type: 'bigint', unsigned: true, nullable: true })
  deletedBy?: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  @Index('idx_pic_deleted_at')
  deletedAt?: Date | null;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator?: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updater?: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'deleted_by' })
  deleter?: User | null;
}
