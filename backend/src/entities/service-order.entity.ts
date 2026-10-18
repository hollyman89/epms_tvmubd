import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { PurchaseOrder } from "./purchase-order.entity";
import { Project } from "./project.entity";
import { Vendor } from "./vendor.entity";
import { User } from "./user.entity";

export enum ServiceOrderDocumentType {
  SPK = "SPK",
  WORK_ORDER = "WORK_ORDER",
}

export enum ServiceOrderStatus {
  DRAFT = "DRAFT",
  ISSUED = "ISSUED",
  CANCELLED = "CANCELLED",
}

@Entity("service_orders")
export class ServiceOrder {
  @PrimaryGeneratedColumn("increment", { type: "bigint", unsigned: true })
  id: number;

  @Column({
    name: "service_order_number",
    type: "varchar",
    length: 100,
    unique: true,
  })
  serviceOrderNumber: string;

  @Column({
    name: "document_type",
    type: "varchar",
    length: 30,
    default: ServiceOrderDocumentType.SPK,
  })
  documentType: ServiceOrderDocumentType | string;

  @Column({ name: "purchase_order_id", type: "bigint", unsigned: true })
  purchaseOrderId: number;

  @Column({ name: "project_id", type: "bigint", unsigned: true })
  projectId: number;

  @Column({ name: "vendor_id", type: "bigint", unsigned: true })
  vendorId: number;

  @Column({ name: "scope_of_work", type: "text" })
  scopeOfWork: string;

  @Column({
    name: "work_location",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  workLocation?: string;

  @Column({ name: "start_date", type: "date", nullable: true })
  startDate?: string;

  @Column({ name: "end_date", type: "date", nullable: true })
  endDate?: string;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @Column({
    type: "varchar",
    length: 30,
    default: ServiceOrderStatus.DRAFT,
  })
  status: ServiceOrderStatus | string;

  @Column({ name: "issued_at", type: "datetime", nullable: true })
  issuedAt?: Date;

  @Column({ name: "issued_by", type: "bigint", unsigned: true, nullable: true })
  issuedBy?: number;

  @Column({
    name: "created_by",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  createdBy?: number;

  @Column({
    name: "updated_by",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  updatedBy?: number;

  @Column({
    name: "deleted_by",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  deletedBy?: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @DeleteDateColumn({ name: "deleted_at", nullable: true })
  deletedAt?: Date;

  @ManyToOne(() => PurchaseOrder, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "purchase_order_id" })
  purchaseOrder: PurchaseOrder;

  @ManyToOne(() => Project, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "project_id" })
  project: Project;

  @ManyToOne(() => Vendor, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "vendor_id" })
  vendor: Vendor;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "issued_by" })
  issuer?: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "created_by" })
  creator?: User;
}
