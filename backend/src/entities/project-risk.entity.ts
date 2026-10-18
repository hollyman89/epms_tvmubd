import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  VersionColumn,
  Index,
} from "typeorm";
import { Project } from "./project.entity";
import { Task } from "./task.entity";
import { User } from "./user.entity";

export enum ProjectRiskStatus {
  IDENTIFIED = "IDENTIFIED",
  ASSESSED = "ASSESSED",
  MITIGATING = "MITIGATING",
  MONITORING = "MONITORING",
  MATERIALIZED = "MATERIALIZED",
  CLOSED = "CLOSED",
  CANCELLED = "CANCELLED",
}

export enum ProjectRiskLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum ProjectIssueRiskCategory {
  TECHNICAL = "TECHNICAL",
  SCHEDULE = "SCHEDULE",
  COMMERCIAL = "COMMERCIAL",
  PROCUREMENT = "PROCUREMENT",
  FINANCIAL = "FINANCIAL",
  RESOURCE = "RESOURCE",
  QUALITY = "QUALITY",
  SAFETY = "SAFETY",
  EXTERNAL = "EXTERNAL",
  OTHER = "OTHER",
}

@Entity("project_risks")
@Index("idx_project_risks_project_status", ["projectId", "status"])
@Index("idx_project_risks_project_level", ["projectId", "riskLevel"])
@Index("idx_project_risks_review_date", ["reviewDate"])
export class ProjectRisk {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: number;

  @Column({ name: "project_id", type: "bigint", unsigned: true })
  projectId: number;

  @ManyToOne(() => Project, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "project_id" })
  project: Project;

  @Column({ name: "task_id", type: "bigint", unsigned: true, nullable: true })
  taskId: number | null;

  @ManyToOne(() => Task, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "task_id" })
  task: Task | null;

  @Column({ name: "risk_number", type: "varchar", length: 100, unique: true })
  riskNumber: string;

  @Column({ type: "varchar", length: 255 })
  title: string;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "varchar", length: 50 })
  category: ProjectIssueRiskCategory | string;

  @Column({ type: "tinyint", unsigned: true, nullable: true })
  probability: number | null;

  @Column({ type: "tinyint", unsigned: true, nullable: true })
  impact: number | null;

  @Column({
    name: "risk_score",
    type: "tinyint",
    unsigned: true,
    nullable: true,
  })
  riskScore: number | null;

  @Column({ name: "risk_level", type: "varchar", length: 20, nullable: true })
  riskLevel: ProjectRiskLevel | string | null;

  @Column({
    type: "varchar",
    length: 20,
    default: ProjectRiskStatus.IDENTIFIED,
  })
  status: ProjectRiskStatus;

  @Column({ name: "owner_id", type: "bigint", unsigned: true })
  ownerId: number;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "owner_id" })
  owner: User;

  @Column({ name: "identified_by_id", type: "bigint", unsigned: true })
  identifiedById: number;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "identified_by_id" })
  identifiedBy: User;

  @Column({ name: "identified_at", type: "datetime" })
  identifiedAt: Date;

  @Column({ name: "mitigation_plan", type: "text", nullable: true })
  mitigationPlan: string | null;

  @Column({ name: "contingency_plan", type: "text", nullable: true })
  contingencyPlan: string | null;

  @Column({ name: "target_date", type: "date", nullable: true })
  targetDate: string | null;

  @Column({ name: "review_date", type: "date", nullable: true })
  reviewDate: string | null;

  @Column({
    name: "closed_by_id",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  closedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "closed_by_id" })
  closedBy: User | null;

  @Column({ name: "closed_at", type: "datetime", nullable: true })
  closedAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @VersionColumn({ name: "version", default: 1 })
  version: number;
}
