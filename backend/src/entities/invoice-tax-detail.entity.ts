import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Invoice } from './invoice.entity';
import { TaxRegimeRule } from './tax-regime-rule.entity';

@Entity('invoice_tax_details')
export class InvoiceTaxDetail {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'invoice_id', type: 'bigint', unsigned: true, unique: true })
  invoiceId: number;

  @Column({ name: 'company_code', type: 'varchar', length: 10 })
  companyCode: string; // 'UBD' | 'TVM' (DEC-TAX-07)

  @Column({ name: 'tax_regime_ppn_id', type: 'bigint', unsigned: true, nullable: true })
  taxRegimePpnId?: number | null;

  @Column({ name: 'primary_pph_regime_id', type: 'bigint', unsigned: true, nullable: true })
  primaryPphRegimeId?: number | null;

  @Column({
    name: 'dpp_commercial',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  dppCommercial: number;

  @Column({
    name: 'ppn_rate',
    type: 'decimal',
    precision: 7,
    scale: 4,
    default: 0.0,
  })
  ppnRate: number;

  @Column({
    name: 'ppn_amount',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  ppnAmount: number;

  @Column({
    name: 'gross_commercial_liability',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  grossCommercialLiability: number; // L_comm = DPP + PPN_Masukan

  @Column({
    name: 'pph_withholding_amount',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  pphWithholdingAmount: number; // W_tax

  @Column({
    name: 'wapu_ppn_withheld_amount',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  wapuPpnWithheldAmount: number; // W_wapu_ppn

  @Column({
    name: 'prior_deductions_amount',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  priorDeductionsAmount: number; // P_ded

  @Column({
    name: 'net_vendor_cash_payable',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  netVendorCashPayable: number; // D_cash = L_comm - W_tax - W_wapu_ppn - P_ded

  @Column({
    name: 'statutory_tax_liability',
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0.0,
  })
  statutoryTaxLiability: number; // L_tax_stat = W_tax + W_wapu_ppn

  @Column({
    name: 'calculation_engine_version',
    type: 'varchar',
    length: 50,
    default: 'EPMS-TAX-2B-1.3.2',
  })
  calculationEngineVersion: string;

  @Column({ name: 'tax_rule_snapshot', type: 'json' })
  taxRuleSnapshot: any;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  @OneToOne(() => Invoice, (inv: any) => inv.invoiceTaxDetail, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @ManyToOne(() => TaxRegimeRule, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'tax_regime_ppn_id' })
  taxRegimePpn?: TaxRegimeRule | null;

  @ManyToOne(() => TaxRegimeRule, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'primary_pph_regime_id' })
  primaryPphRegime?: TaxRegimeRule | null;
}
