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
import { ProjectRisk, ProjectIssueRiskCategory } from "./project-risk.entity";

export enum ProjectIssueStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
  CANCELLED = "CANCELLED",
}

export enum ProjectIssueSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum ProjectIssuePriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

@Entity("project_issues")
@Index("idx_project_issues_project_status", ["projectId", "status"])
@Index("idx_project_issues_project_owner", ["projectId", "ownerId"])
@Index("idx_project_issues_due_date", ["dueDate"])
export class ProjectIssue {
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

  @Column({ name: "issue_number", type: "varchar", length: 100, unique: true })
  issueNumber: string;

  @Column({ type: "varchar", length: 255 })
  title: string;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "varchar", length: 50 })
  category: ProjectIssueRiskCategory | string;

  @Column({ type: "varchar", length: 20 })
  severity: ProjectIssueSeverity | string;

  @Column({ type: "varchar", length: 20 })
  priority: ProjectIssuePriority | string;

  @Column({ type: "varchar", length: 20, default: ProjectIssueStatus.OPEN })
  status: ProjectIssueStatus;

  @Column({ name: "owner_id", type: "bigint", unsigned: true })
  ownerId: number;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "owner_id" })
  owner: User;

  @Column({ name: "reported_by_id", type: "bigint", unsigned: true })
  reportedById: number;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "reported_by_id" })
  reportedBy: User;

  @Column({ name: "reported_at", type: "datetime" })
  reportedAt: Date;

  @Column({ name: "due_date", type: "date", nullable: true })
  dueDate: string | null;

  @Column({ type: "text", nullable: true })
  resolution: string | null;

  @Column({
    name: "resolved_by_id",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  resolvedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "resolved_by_id" })
  resolvedBy: User | null;

  @Column({ name: "resolved_at", type: "datetime", nullable: true })
  resolvedAt: Date | null;

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

  @Column({
    name: "source_risk_id",
    type: "bigint",
    unsigned: true,
    nullable: true,
    unique: true,
  })
  sourceRiskId: number | null;

  @ManyToOne(() => ProjectRisk, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "source_risk_id" })
  sourceRisk: ProjectRisk | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @VersionColumn({ name: "version", default: 1 })
  version: number;
}
