import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany } from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { VendorComparison } from './vendor-comparison.entity';
import { Quotation } from './quotation.entity';

@Entity('vendors')
export class Vendor {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ name: 'tax_id', type: 'varchar', length: 50, nullable: true })
  taxId: string;

  @Column({ name: 'vendor_type', type: 'varchar', length: 50, nullable: true })
  vendorType: string;

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

  @DeleteDateColumn({ name: 'deleted_at', select: false })
  deletedAt: Date;

  @OneToMany(() => PurchaseOrder, po => po.vendor)
  purchaseOrders: PurchaseOrder[];

  @OneToMany(() => VendorComparison, vc => vc.vendor)
  vendorComparisons: VendorComparison[];

  @OneToMany(() => Quotation, q => q.vendor)
  quotations: Quotation[];
}
