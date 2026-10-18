import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  VersionColumn,
} from "typeorm";
import { ServiceClaim } from "./service-claim.entity";
import { PurchaseOrderItem } from "./purchase-order-item.entity";

@Entity("service_claim_items")
export class ServiceClaimItem {
  @PrimaryGeneratedColumn("increment", { type: "bigint", unsigned: true })
  id: number;

  @Column({ name: "service_claim_id", type: "bigint", unsigned: true })
  serviceClaimId: number;

  @Column({ name: "po_item_id", type: "bigint", unsigned: true })
  poItemId: number;

  @Column({ name: "item_name_snapshot", type: "varchar", length: 255 })
  itemNameSnapshot: string;

  @Column({
    name: "uom_snapshot",
    type: "varchar",
    length: 50,
    default: "Unit",
  })
  uomSnapshot: string;

  @Column({
    name: "contract_quantity_snapshot",
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  contractQuantitySnapshot: number;

  @Column({
    name: "contract_unit_rate_snapshot",
    type: "decimal",
    precision: 19,
    scale: 2,
  })
  contractUnitRateSnapshot: number;

  @Column({
    name: "contract_value_snapshot",
    type: "decimal",
    precision: 19,
    scale: 2,
  })
  contractValueSnapshot: number;

  @Column({
    name: "previous_approved_quantity",
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 0,
  })
  previousApprovedQuantity: number;

  @Column({
    name: "current_claim_quantity",
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  currentClaimQuantity: number;

  @Column({
    name: "cumulative_approved_quantity",
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  cumulativeApprovedQuantity: number;

  @Column({
    name: "remaining_quantity",
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  remainingQuantity: number;

  @Column({
    name: "previous_approved_amount",
    type: "decimal",
    precision: 19,
    scale: 2,
    default: 0,
  })
  previousApprovedAmount: number;

  @Column({
    name: "current_claim_amount",
    type: "decimal",
    precision: 19,
    scale: 2,
  })
  currentClaimAmount: number;

  @Column({
    name: "cumulative_approved_amount",
    type: "decimal",
    precision: 19,
    scale: 2,
  })
  cumulativeApprovedAmount: number;

  @Column({
    name: "remaining_contract_value",
    type: "decimal",
    precision: 19,
    scale: 2,
  })
  remainingContractValue: number;

  @Column({
    name: "work_location",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  workLocation?: string;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @VersionColumn()
  version: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => ServiceClaim, (claim) => claim.items, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "service_claim_id" })
  serviceClaim: ServiceClaim;

  @ManyToOne(() => PurchaseOrderItem, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "po_item_id" })
  purchaseOrderItem: PurchaseOrderItem;
}
