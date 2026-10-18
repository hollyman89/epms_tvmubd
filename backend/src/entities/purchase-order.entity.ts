import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, OneToMany, VersionColumn } from 'typeorm';
import { PurchaseRequest } from './purchase-request.entity';
import { Vendor } from './vendor.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { GoodsReceipt } from './goods-receipt.entity';
import { Invoice } from './invoice.entity';
import { PoPaymentTerm } from './po-payment-term.entity';
import { User } from './user.entity';
import { ServiceOrder } from './service-order.entity';
import { ServiceClaim } from './service-claim.entity';

export enum PurchaseOrderType {
  MATERIAL = 'MATERIAL',
  SERVICE = 'SERVICE',
  LEGACY_MIXED = 'LEGACY_MIXED',
}

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @VersionColumn()
  version: number;

  @Column({ name: 'pr_id' })
  purchaseRequestId: number;

  @Column({ name: 'vendor_id' })
  vendorId: number;

  @Column({ name: 'po_number', unique: true })
  poNumber: string;

  @Column({
    name: 'order_type',
    type: 'varchar',
    length: 30,
    default: PurchaseOrderType.MATERIAL,
  })
  orderType: PurchaseOrderType;

  @Column({ type: 'decimal', precision: 19, scale: 2, name: 'total_amount', default: 0 })
  totalAmount: number;

  @Column({ default: 'DRAFT' })
  status: string;

  @Column({ name: 'delivery_location', type: 'varchar', length: 255, nullable: true })
  deliveryLocation: string;

  @Column({ name: 'delivery_date', type: 'datetime', nullable: true })
  deliveryDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'service_scope_reconciled_at', type: 'datetime', nullable: true })
  serviceScopeReconciledAt?: Date | null;

  @Column({ name: 'service_scope_reconciled_by', type: 'bigint', unsigned: true, nullable: true })
  serviceScopeReconciledBy?: number | null;

  @Column({ name: 'service_scope_released_amount', type: 'decimal', precision: 19, scale: 2, nullable: true })
  serviceScopeReleasedAmount?: number | null;

  @Column({ name: 'service_scope_reconciliation_reason', type: 'text', nullable: true })
  serviceScopeReconciliationReason?: string | null;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy: number;

  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy: number;

  @Column({ name: 'deleted_by', type: 'bigint', nullable: true })
  deletedBy: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;

  @ManyToOne(() => PurchaseRequest, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pr_id' })
  purchaseRequest: PurchaseRequest;

  @ManyToOne(() => Vendor, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'service_scope_reconciled_by' })
  serviceScopeReconciler?: User | null;

  @OneToMany(() => PurchaseOrderItem, item => item.purchaseOrder, { cascade: true })
  items: PurchaseOrderItem[];

  @OneToMany(() => PoPaymentTerm, term => term.purchaseOrder, { cascade: true })
  paymentTerms: PoPaymentTerm[];

  @OneToMany(() => GoodsReceipt, gr => gr.purchaseOrder)
  goodsReceipts: GoodsReceipt[];

  @OneToMany(() => Invoice, inv => inv.purchaseOrder)
  invoices: Invoice[];

  @OneToMany(() => ServiceOrder, so => so.purchaseOrder)
  serviceOrders: ServiceOrder[];

  @OneToMany(() => ServiceClaim, sc => sc.purchaseOrder)
  serviceClaims: ServiceClaim[];
}
