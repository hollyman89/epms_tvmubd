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
import { User } from "./user.entity";
import { Document } from "./document.entity";

export enum ProjectClosureStatus {
  PENDING_HOO_REVIEW = "PENDING_HOO_REVIEW",
  PENDING_DIRECTOR_APPROVAL = "PENDING_DIRECTOR_APPROVAL",
  RETURNED = "RETURNED",
  APPROVED = "APPROVED",
}

@Entity("project_closures")
@Index("idx_project_closures_project_id", ["projectId"])
@Index("idx_project_closures_project_status", ["projectId", "status"])
@Index("idx_project_closures_status", ["status"])
@Index("uq_project_closures_project_cycle", ["projectId", "cycleNumber"], {
  unique: true,
})
export class ProjectClosure {
  @PrimaryGeneratedColumn("increment", { type: "bigint", unsigned: true })
  id: number;

  @Column({ name: "project_id", type: "bigint", unsigned: true })
  projectId: number;

  @Column({ name: "cycle_number", type: "int", unsigned: true })
  cycleNumber: number;

  @Column({
    type: "varchar",
    length: 50,
    default: ProjectClosureStatus.PENDING_HOO_REVIEW,
  })
  status: ProjectClosureStatus | string;

  @Column({ name: "submitted_by", type: "bigint", unsigned: true })
  submittedById: number;

  @Column({ name: "submitted_at", type: "datetime" })
  submittedAt: Date;

  @Column({ name: "submission_notes", type: "text", nullable: true })
  submissionNotes?: string | null;

  @Column({ name: "readiness_snapshot", type: "json" })
  readinessSnapshot: any;

  @Column({ name: "acceptance_document_id", type: "bigint", unsigned: true })
  acceptanceDocumentId: number;

  @Column({ name: "final_report_document_id", type: "bigint", unsigned: true })
  finalReportDocumentId: number;

  @Column({
    name: "hoo_reviewer_id",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  hooReviewerId?: number | null;

  @Column({ name: "hoo_reviewed_at", type: "datetime", nullable: true })
  hooReviewedAt?: Date | null;

  @Column({ name: "hoo_notes", type: "text", nullable: true })
  hooNotes?: string | null;

  @Column({
    name: "director_approver_id",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  directorApproverId?: number | null;

  @Column({ name: "director_approved_at", type: "datetime", nullable: true })
  directorApprovedAt?: Date | null;

  @Column({ name: "director_notes", type: "text", nullable: true })
  directorNotes?: string | null;

  @Column({
    name: "return_actor_id",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  returnActorId?: number | null;

  @Column({ name: "return_role", type: "varchar", length: 50, nullable: true })
  returnRole?: string | null;

  @Column({ name: "return_timestamp", type: "datetime", nullable: true })
  returnTimestamp?: Date | null;

  @Column({ name: "return_reason", type: "text", nullable: true })
  returnReason?: string | null;

  @VersionColumn({ name: "version", default: 1 })
  version: number;

  @CreateDateColumn({ name: "created_at", type: "datetime" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "datetime" })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Project, (project) => project.closures, {
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "project_id" })
  project: Project;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "submitted_by" })
  submittedBy: User;

  @ManyToOne(() => Document, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "acceptance_document_id" })
  acceptanceDocument: Document;

  @ManyToOne(() => Document, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "final_report_document_id" })
  finalReportDocument: Document;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "hoo_reviewer_id" })
  hooReviewer?: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "director_approver_id" })
  directorApprover?: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "return_actor_id" })
  returnActor?: User | null;
}
