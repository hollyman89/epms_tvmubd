import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { InvoiceItem } from './invoice-item.entity';
import { TaxRegimeRule } from './tax-regime-rule.entity';

export enum ItemTaxCategory {
  TAXABLE_GOODS = 'TAXABLE_GOODS',
  TAXABLE_SERVICES = 'TAXABLE_SERVICES',
  NON_TAXABLE = 'NON_TAXABLE',
  EXEMPT = 'EXEMPT',
}

export enum NonWithholdingReason {
  MATERIAL_SUPPLY = 'MATERIAL_SUPPLY',
  SKB_EXEMPT = 'SKB_EXEMPT',
  PP55_FINAL_05 = 'PP55_FINAL_05',
  NON_TAXABLE_OBJECT = 'NON_TAXABLE_OBJECT',
  BELOW_THRESHOLD = 'BELOW_THRESHOLD',
}

@Entity('invoice_item_tax_details')
@Unique('uk_iitd_invoice_item_id', ['invoiceItemId'])
@Unique('uk_iitd_item_rule_category', ['invoiceItemId', 'pphTaxRegimeRuleId', 'pphTaxCategory'])
export class InvoiceItemTaxDetail {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'invoice_item_id', type: 'bigint', unsigned: true, unique: true })
  invoiceItemId: number;

  @Column({
    name: 'item_tax_category',
    type: 'enum',
    enum: ItemTaxCategory,
  })
  itemTaxCategory: ItemTaxCategory;

  @Column({ name: 'pph_tax_regime_rule_id', type: 'bigint', unsigned: true, nullable: true })
  pphTaxRegimeRuleId?: number | null;

  @Column({
    name: 'pph_tax_category',
    type: 'enum',
    enum: ['PPN', 'PPH'],
    nullable: true,
  })
  pphTaxCategory?: 'PPN' | 'PPH' | null;

  @Column({ name: 'line_pph_regime_code', type: 'varchar', length: 50, nullable: true })
  linePphRegimeCode?: string | null;

  @Column({ name: 'line_pph_rule_version', type: 'int', nullable: true })
  linePphRuleVersion?: number | null;

  @Column({
    name: 'non_withholding_reason',
    type: 'enum',
    enum: NonWithholdingReason,
    nullable: true,
  })
  nonWithholdingReason?: NonWithholdingReason | null;

  @Column({
    name: 'line_dpp',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  lineDpp: number;

  @Column({
    name: 'line_ppn_rate',
    type: 'decimal',
    precision: 7,
    scale: 4,
    default: 0.0,
  })
  linePpnRate: number;

  @Column({
    name: 'line_ppn_amount',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  linePpnAmount: number;

  @Column({
    name: 'line_pph_rate',
    type: 'decimal',
    precision: 7,
    scale: 4,
    default: 0.0,
  })
  linePphRate: number;

  @Column({
    name: 'line_pph_amount',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  linePphAmount: number;

  @Column({ name: 'line_tax_rule_snapshot', type: 'json' })
  lineTaxRuleSnapshot: any;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  @OneToOne(() => InvoiceItem, (item: any) => item.taxDetail, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'invoice_item_id' })
  invoiceItem: InvoiceItem;

  @ManyToOne(() => TaxRegimeRule, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'pph_tax_regime_rule_id' })
  pphTaxRegimeRule?: TaxRegimeRule | null;
}
