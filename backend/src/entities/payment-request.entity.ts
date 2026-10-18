import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  VersionColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from "typeorm";
import { Invoice } from "./invoice.entity";
import { PoPaymentTerm } from "./po-payment-term.entity";
import { User } from "./user.entity";

export enum PaymentRequestStatus {
  PENDING_DIRECTOR_APPROVAL = "PENDING_DIRECTOR_APPROVAL",
  NEEDS_REVISION = "NEEDS_REVISION",
  APPROVED_FOR_PAYMENT = "APPROVED_FOR_PAYMENT",
  REJECTED = "REJECTED",
  PAID = "PAID",
}

export interface ApprovalSnapshot {
  invoiceId: number;
  invoiceNumber: string;
  invoiceAmount: number;
  invoiceVersion: number;
  invoiceUpdatedAt?: string;
  paymentTermId?: number | null;
  paymentTermName?: string | null;
  requestedAmount: number;
  vendorId?: number | null;
  vendorName?: string | null;
  vendorBankAccount?: string | null;
  vendorBankName?: string | null;
  goodsReceiptId?: number | null;
  goodsReceiptNumber?: string | null;
  poId?: number | null;
  poNumber?: string | null;
  timestamp: string;
}

@Entity("payment_requests")
export class PaymentRequest {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: number;

  @Column({
    name: "request_number",
    type: "varchar",
    length: 100,
    unique: true,
  })
  requestNumber: string;

  @Column({ name: "invoice_id", type: "bigint", unsigned: true })
  invoiceId: number;

  @Column({
    name: "payment_term_id",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  paymentTermId?: number | null;

  @Column({
    name: "requested_amount",
    type: "decimal",
    precision: 19,
    scale: 2,
  })
  requestedAmount: number;

  @Column({
    name: "approved_amount",
    type: "decimal",
    precision: 19,
    scale: 2,
    nullable: true,
  })
  approvedAmount?: number | null;

  @Column({
    type: "enum",
    enum: PaymentRequestStatus,
    default: PaymentRequestStatus.PENDING_DIRECTOR_APPROVAL,
  })
  status: PaymentRequestStatus;

  @Column({ name: "requested_by", type: "bigint", unsigned: true })
  requestedBy: number;

  @Column({
    name: "submitted_at",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
  })
  submittedAt: Date;

  @Column({ name: "returned_at", type: "datetime", nullable: true })
  returnedAt?: Date | null;

  @Column({ name: "revision_notes", type: "text", nullable: true })
  revisionNotes?: string | null;

  @Column({
    name: "approved_by",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  approvedBy?: number | null;

  @Column({ name: "approved_at", type: "datetime", nullable: true })
  approvedAt?: Date | null;

  @Column({ name: "rejection_reason", type: "text", nullable: true })
  rejectionReason?: string | null;

  @Column({ name: "notes", type: "text", nullable: true })
  notes?: string | null;

  @Column({ name: "approval_snapshot", type: "json", nullable: true })
  approvalSnapshot?: ApprovalSnapshot | null;

  @VersionColumn()
  version: number;

  @CreateDateColumn({ name: "created_at", type: "datetime" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "datetime" })
  updatedAt: Date;

  @DeleteDateColumn({ name: "deleted_at", type: "datetime", nullable: true })
  deletedAt?: Date | null;

  @ManyToOne(() => Invoice, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "invoice_id" })
  invoice: Invoice;

  @ManyToOne(() => PoPaymentTerm, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "payment_term_id" })
  paymentTerm?: PoPaymentTerm | null;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "requested_by" })
  requester?: User;

  @ManyToOne(() => User, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "approved_by" })
  approver?: User | null;
}
