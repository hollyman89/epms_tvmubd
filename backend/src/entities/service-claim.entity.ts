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
} from "typeorm";
import { PurchaseOrder } from "./purchase-order.entity";
import { ServiceOrder } from "./service-order.entity";
import { Project } from "./project.entity";
import { Vendor } from "./vendor.entity";
import { ServiceClaimItem } from "./service-claim-item.entity";
import { Invoice } from "./invoice.entity";

export enum ServiceClaimStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  NEEDS_REVISION = "NEEDS_REVISION",
  PM_VERIFIED = "PM_VERIFIED",
  APPROVED_FOR_INVOICE = "APPROVED_FOR_INVOICE",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

export enum ServiceClaimAcceptanceType {
  BAST = "BAST",
  PROGRESS_CERTIFICATE = "PROGRESS_CERTIFICATE",
  MEASUREMENT_SHEET = "MEASUREMENT_SHEET",
  COMPLETION_REPORT = "COMPLETION_REPORT",
  OTHER = "OTHER",
}

@Entity("service_claims")
export class ServiceClaim {
  @PrimaryGeneratedColumn("increment", { type: "bigint", unsigned: true })
  id: number;

  @Column({ name: "claim_number", type: "varchar", length: 100, unique: true })
  claimNumber: string;

  @Column({ name: "po_id", type: "bigint", unsigned: true })
  poId: number;

  @Column({
    name: "service_order_id",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  serviceOrderId?: number;

  @Column({ name: "project_id", type: "bigint", unsigned: true })
  projectId: number;

  @Column({ name: "vendor_id", type: "bigint", unsigned: true })
  vendorId: number;

  @Column({ name: "claim_period_start", type: "date", nullable: true })
  claimPeriodStart?: string;

  @Column({ name: "claim_period_end", type: "date", nullable: true })
  claimPeriodEnd?: string;

  @Column({
    type: "varchar",
    length: 40,
    default: ServiceClaimStatus.DRAFT,
  })
  status: ServiceClaimStatus | string;

  @Column({
    name: "total_claim_amount",
    type: "decimal",
    precision: 19,
    scale: 2,
    default: 0,
  })
  totalClaimAmount: number;

  @Column({
    name: "approved_claim_amount",
    type: "decimal",
    precision: 19,
    scale: 2,
    default: 0,
  })
  approvedClaimAmount: number;

  @Column({
    name: "acceptance_type",
    type: "varchar",
    length: 50,
    nullable: true,
  })
  acceptanceType?: ServiceClaimAcceptanceType | string;

  @Column({
    name: "acceptance_reference",
    type: "varchar",
    length: 100,
    nullable: true,
  })
  acceptanceReference?: string;

  @Column({ name: "acceptance_date", type: "date", nullable: true })
  acceptanceDate?: string;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @Column({ name: "created_by", type: "bigint", unsigned: true })
  createdBy: number;

  @Column({
    name: "submitted_by",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  submittedBy?: number;

  @Column({ name: "submitted_at", type: "datetime", nullable: true })
  submittedAt?: Date;

  @Column({
    name: "pm_verifier_id",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  pmVerifierId?: number;

  @Column({ name: "pm_verified_at", type: "datetime", nullable: true })
  pmVerifiedAt?: Date;

  @Column({
    name: "commercial_verifier_id",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  commercialVerifierId?: number;

  @Column({ name: "commercial_verified_at", type: "datetime", nullable: true })
  commercialVerifiedAt?: Date;

  @Column({ name: "revision_notes", type: "text", nullable: true })
  revisionNotes?: string;

  @Column({ name: "rejection_reason", type: "text", nullable: true })
  rejectionReason?: string;

  @Column({
    name: "cancelled_by",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  cancelledBy?: number;

  @Column({ name: "cancelled_at", type: "datetime", nullable: true })
  cancelledAt?: Date;

  @VersionColumn()
  version: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @DeleteDateColumn({ name: "deleted_at", nullable: true })
  deletedAt?: Date;

  @ManyToOne(() => PurchaseOrder, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "po_id" })
  purchaseOrder: PurchaseOrder;

  @ManyToOne(() => ServiceOrder, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "service_order_id" })
  serviceOrder?: ServiceOrder;

  @ManyToOne(() => Project, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "project_id" })
  project: Project;

  @ManyToOne(() => Vendor, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "vendor_id" })
  vendor: Vendor;

  @OneToMany(() => ServiceClaimItem, (item) => item.serviceClaim, {
    cascade: true,
  })
  items: ServiceClaimItem[];

  @OneToMany(() => Invoice, (inv) => (inv as any).serviceClaim)
  invoices?: Invoice[];
}
