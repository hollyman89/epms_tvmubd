import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, DataSource } from 'typeorm';
import Decimal from 'decimal.js';
import { Invoice } from '../../entities/invoice.entity';
import { InvoiceItem } from '../../entities/invoice-item.entity';
import { TaxRegimeRule, TaxCategory, TaxRuleVerificationStatus } from '../../entities/tax-regime-rule.entity';
import { InvoiceTaxDetail } from '../../entities/invoice-tax-detail.entity';
import { InvoiceItemTaxDetail, ItemTaxCategory, NonWithholdingReason } from '../../entities/invoice-item-tax-detail.entity';
import { PphWithholdingRecord, RecognitionStatus, StatutoryTriggerType } from '../../entities/pph-withholding-record.entity';
import { StatutoryTaxLiability, StatutoryLiabilityStatus } from '../../entities/statutory-tax-liability.entity';
import { DetermineInvoiceTaxDto, DetermineLineTaxDto } from './dto/tax-determination.dto';

@Injectable()
export class TaxDeterminationService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepository: Repository<InvoiceItem>,
    @InjectRepository(TaxRegimeRule)
    private readonly taxRegimeRuleRepository: Repository<TaxRegimeRule>,
    @InjectRepository(InvoiceTaxDetail)
    private readonly invoiceTaxDetailRepository: Repository<InvoiceTaxDetail>,
    @InjectRepository(InvoiceItemTaxDetail)
    private readonly invoiceItemTaxDetailRepository: Repository<InvoiceItemTaxDetail>,
    @InjectRepository(PphWithholdingRecord)
    private readonly pphWithholdingRepository: Repository<PphWithholdingRecord>,
    @InjectRepository(StatutoryTaxLiability)
    private readonly statutoryLiabilityRepository: Repository<StatutoryTaxLiability>,
  ) {}

  private toMoney(val: any): Decimal {
    if (val === undefined || val === null) return new Decimal(0);
    const num = Number(val);
    if (isNaN(num) || !isFinite(num)) return new Decimal(0);
    return new Decimal(String(val).trim()).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  private toRate(val: any): Decimal {
    if (val === undefined || val === null) return new Decimal(0);
    const num = Number(val);
    if (isNaN(num) || !isFinite(num)) return new Decimal(0);
    return new Decimal(String(val).trim()).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  }

  /**
   * Authoritative calculation and persistence of invoice tax determinations
   * strictly adhering to Step 2 v1.1.1 and Step 3 v1.3.2 formulas and invariants.
   */
  async determineAndPersistInvoiceTax(
    dto: DetermineInvoiceTaxDto,
    userId: number,
    externalQueryRunner?: QueryRunner,
  ): Promise<InvoiceTaxDetail> {
    const queryRunner = externalQueryRunner || this.dataSource.createQueryRunner();
    const shouldManageTransaction = !externalQueryRunner;

    if (shouldManageTransaction) {
      await queryRunner.connect();
      await queryRunner.startTransaction();
    }

    try {
      // 1. Validate Company Code (DEC-TAX-07)
      const companyCode = String(dto.companyCode || '').toUpperCase();
      if (!['UBD', 'TVM'].includes(companyCode)) {
        throw new BadRequestException(`Invalid company_code: ${dto.companyCode}. Must be UBD or TVM.`);
      }

      // 2. Load Invoice with relations
      const invoice = await queryRunner.manager.findOne(Invoice, {
        where: { id: dto.invoiceId },
        relations: ['items', 'purchaseOrder', 'purchaseOrder.vendor', 'paymentTerm'],
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice with ID ${dto.invoiceId} not found`);
      }

      // Assert companyCode matches or set on invoice
      if (invoice.companyCode && invoice.companyCode !== companyCode) {
        throw new BadRequestException(
          `Company code mismatch: Invoice belongs to ${invoice.companyCode}, cannot process as ${companyCode}`
        );
      }
      invoice.companyCode = companyCode;
      await queryRunner.manager.save(Invoice, invoice);

      // 3. Resolve Header Rules
      let ppnRule: TaxRegimeRule | null = null;
      let ppnRate = new Decimal(0);
      if (dto.taxRegimePpnId) {
        ppnRule = await queryRunner.manager.findOne(TaxRegimeRule, {
          where: { id: dto.taxRegimePpnId },
        });
        if (!ppnRule) {
          throw new BadRequestException(`PPN tax rule ID ${dto.taxRegimePpnId} not found`);
        }
        if (ppnRule.taxCategory !== TaxCategory.PPN) {
          throw new BadRequestException(`Tax rule ${ppnRule.regimeCode} is not of category PPN`);
        }
        if (!ppnRule.isActive || ppnRule.verificationStatus !== TaxRuleVerificationStatus.VERIFIED) {
          throw new BadRequestException(
            `PPN rule ${ppnRule.regimeCode} is inactive or unverified (${ppnRule.verificationStatus})`
          );
        }
        ppnRate = this.toRate(ppnRule.statutoryRate).mul(this.toRate(ppnRule.effectiveRateMultiplier));
      }

      // 4. Line-by-Line Tax Determination
      let cumulativeDpp = new Decimal(0);
      let cumulativePpn = new Decimal(0);
      let cumulativePph = new Decimal(0);

      const itemDetailsToSave: InvoiceItemTaxDetail[] = [];
      const withholdingsToCreate: Partial<PphWithholdingRecord>[] = [];

      // Determine lines: either provided in DTO or derived from invoice.items
      const lines = dto.lineItems || [];
      const invoiceItems = invoice.items || [];

      const now = new Date();
      const taxPeriodMonth = now.getMonth() + 1;
      const taxPeriodYear = now.getFullYear();

      if (invoiceItems.length > 0 && lines.length > 0) {
        for (const lineDto of lines) {
          const invItem = invoiceItems.find(i => Number(i.id) === Number(lineDto.invoiceItemId));
          if (!invItem) {
            throw new BadRequestException(`Invoice item ${lineDto.invoiceItemId} does not belong to invoice ${dto.invoiceId}`);
          }

          const lineDpp = this.toMoney(lineDto.lineDpp ?? invItem.totalPrice);
          cumulativeDpp = cumulativeDpp.plus(lineDpp);

          // Line PPN
          const itemPpnRate = lineDto.linePpnRate !== undefined ? this.toRate(lineDto.linePpnRate) : ppnRate;
          const linePpnAmount = lineDpp.mul(itemPpnRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          cumulativePpn = cumulativePpn.plus(linePpnAmount);

          // Line PPh
          let linePphRule: TaxRegimeRule | null = null;
          let linePphRate = new Decimal(0);
          let linePphAmount = new Decimal(0);
          let linePphCategory: 'PPN' | 'PPH' | null = null;

          if (lineDto.pphTaxRegimeRuleId) {
            linePphRule = await queryRunner.manager.findOne(TaxRegimeRule, {
              where: { id: lineDto.pphTaxRegimeRuleId },
            });
            if (!linePphRule) {
              throw new BadRequestException(`PPh rule ID ${lineDto.pphTaxRegimeRuleId} not found`);
            }
            if (linePphRule.taxCategory !== TaxCategory.PPH) {
              throw new BadRequestException(`Tax rule ${linePphRule.regimeCode} has invalid category: strictly PPH required`);
            }
            if (!linePphRule.isActive || linePphRule.verificationStatus !== TaxRuleVerificationStatus.VERIFIED) {
              throw new BadRequestException(
                `PPh rule ${linePphRule.regimeCode} is inactive or unverified (${linePphRule.verificationStatus})`
              );
            }
            linePphCategory = 'PPH';
            linePphRate = this.toRate(lineDto.linePphRate ?? linePphRule.statutoryRate).mul(
              this.toRate(linePphRule.effectiveRateMultiplier)
            );
            linePphAmount = lineDpp.mul(linePphRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
            cumulativePph = cumulativePph.plus(linePphAmount);
          } else {
            // Non-withholding deliverable line
            if (!lineDto.nonWithholdingReason) {
              throw new BadRequestException(
                `Line deliverable ${lineDto.invoiceItemId} omitted PPh rule without specifying nonWithholdingReason`
              );
            }
          }

          // Build line snapshot
          const lineSnapshot = {
            ruleId: linePphRule?.id || null,
            regimeCode: linePphRule?.regimeCode || 'NON_WITHHOLDING',
            version: linePphRule?.version || 1,
            statutoryRate: linePphRule ? Number(linePphRule.statutoryRate) : 0,
            effectiveRateMultiplier: linePphRule ? Number(linePphRule.effectiveRateMultiplier) : 1,
            governingRegulation: linePphRule?.governingRegulation || 'N/A',
            calculatedAt: now.toISOString(),
          };

          const itemDetail = queryRunner.manager.create(InvoiceItemTaxDetail, {
            invoiceItemId: invItem.id,
            itemTaxCategory: lineDto.itemTaxCategory || ItemTaxCategory.TAXABLE_SERVICES,
            pphTaxRegimeRuleId: linePphRule ? linePphRule.id : null,
            pphTaxCategory: linePphCategory,
            linePphRegimeCode: linePphRule ? linePphRule.regimeCode : null,
            linePphRuleVersion: linePphRule ? linePphRule.version : null,
            nonWithholdingReason: linePphRule ? null : lineDto.nonWithholdingReason,
            lineDpp: lineDpp.toNumber(),
            linePpnRate: itemPpnRate.toNumber(),
            linePpnAmount: linePpnAmount.toNumber(),
            linePphRate: linePphRate.toNumber(),
            linePphAmount: linePphAmount.toNumber(),
            lineTaxRuleSnapshot: lineSnapshot,
          });

          itemDetailsToSave.push(itemDetail);

          // If withholding is recognized, queue withholding record
          if (linePphRule && linePphAmount.greaterThan(0)) {
            withholdingsToCreate.push({
              invoiceId: invoice.id,
              invoiceItemId: invItem.id,
              taxRegimeRuleId: linePphRule.id,
              pphTaxCategory: 'PPH',
              paymentTermId: invoice.paymentTermId ? Number(invoice.paymentTermId) : null,
              companyCode,
              vendorId: Number(invoice.purchaseOrder?.vendorId || 1),
              pphRegime: linePphRule.regimeCode,
              taxPeriodMonth,
              taxPeriodYear,
              taxableBase: lineDpp.toNumber(),
              withholdingRate: linePphRate.toNumber(),
              withheldAmount: linePphAmount.toNumber(),
              totalRemittedAmount: 0.0,
              outstandingWithheldAmount: linePphAmount.toNumber(),
              statutoryTriggerType: StatutoryTriggerType.DUE_DATE,
              statutoryTriggerDate: invoice.invoiceDate || now,
              recognitionStatus: RecognitionStatus.RECOGNIZED_UNREMITTED,
            });
          }
        }
      } else {
        // Milestone / Unitemized invoice handling (CP1.2-04 Rule 4)
        const dpp = this.toMoney(invoice.totalAmount);
        cumulativeDpp = dpp;
        const linePpn = dpp.mul(ppnRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        cumulativePpn = linePpn;

        if (dto.primaryPphRegimeId) {
          const primaryPph = await queryRunner.manager.findOne(TaxRegimeRule, {
            where: { id: dto.primaryPphRegimeId },
          });
          if (!primaryPph) {
            throw new BadRequestException(`Primary PPh rule ID ${dto.primaryPphRegimeId} not found`);
          }
          if (primaryPph.taxCategory !== TaxCategory.PPH) {
            throw new BadRequestException(`Tax rule ${primaryPph.regimeCode} has invalid category: strictly PPH required`);
          }
          if (!primaryPph.isActive || primaryPph.verificationStatus !== TaxRuleVerificationStatus.VERIFIED) {
            throw new BadRequestException(`PPh rule ${primaryPph.regimeCode} is inactive or unverified`);
          }
          const pphRate = this.toRate(primaryPph.statutoryRate).mul(this.toRate(primaryPph.effectiveRateMultiplier));
          const pphAmount = dpp.mul(pphRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          cumulativePph = pphAmount;

          if (pphAmount.greaterThan(0)) {
            withholdingsToCreate.push({
              invoiceId: invoice.id,
              invoiceItemId: null, // Milestone invoice has null invoice_item_id
              taxRegimeRuleId: primaryPph.id,
              pphTaxCategory: 'PPH',
              paymentTermId: invoice.paymentTermId ? Number(invoice.paymentTermId) : null,
              companyCode,
              vendorId: Number(invoice.purchaseOrder?.vendorId || 1),
              pphRegime: primaryPph.regimeCode,
              taxPeriodMonth,
              taxPeriodYear,
              taxableBase: dpp.toNumber(),
              withholdingRate: pphRate.toNumber(),
              withheldAmount: pphAmount.toNumber(),
              totalRemittedAmount: 0.0,
              outstandingWithheldAmount: pphAmount.toNumber(),
              statutoryTriggerType: StatutoryTriggerType.DUE_DATE,
              statutoryTriggerDate: invoice.invoiceDate || now,
              recognitionStatus: RecognitionStatus.RECOGNIZED_UNREMITTED,
            });
          }
        }
      }

      // 5. Authoritative Six-Dimension Financial Settlement Model
      // L_comm = DPP + PPN_Masukan
      const L_comm = cumulativeDpp.plus(cumulativePpn).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const W_tax = cumulativePph.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const W_wapu_ppn = this.toMoney(dto.wapuPpnWithheldAmount);
      const P_ded = this.toMoney(dto.priorDeductionsAmount);

      // D_cash = L_comm - W_tax - W_wapu_ppn - P_ded
      const D_cash = L_comm.minus(W_tax).minus(W_wapu_ppn).minus(P_ded).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      if (D_cash.isNegative()) {
        throw new BadRequestException(
          `Calculation error: Net vendor cash payable (D_cash = ${D_cash.toNumber()}) cannot be negative`
        );
      }

      // Invariant check: L_rem_comm = L_comm - (D_cash + W_tax + W_wapu_ppn + P_ded) == 0
      const reconciliationSum = D_cash.plus(W_tax).plus(W_wapu_ppn).plus(P_ded);
      if (!reconciliationSum.equals(L_comm)) {
        throw new BadRequestException(
          `Settlement integrity violation: D_cash + W_tax + W_wapu + P_ded (${reconciliationSum.toNumber()}) != L_comm (${L_comm.toNumber()})`
        );
      }

      // L_tax_stat = W_tax + W_wapu_ppn
      const L_tax_stat = W_tax.plus(W_wapu_ppn).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      // Save Item Tax Details first to satisfy foreign key fk_pwr_item_tax_determination
      for (const itemDetail of itemDetailsToSave) {
        // Upsert by invoice_item_id
        const existing = await queryRunner.manager.findOne(InvoiceItemTaxDetail, {
          where: { invoiceItemId: itemDetail.invoiceItemId },
        });
        if (existing) {
          Object.assign(existing, itemDetail);
          await queryRunner.manager.save(InvoiceItemTaxDetail, existing);
        } else {
          await queryRunner.manager.save(InvoiceItemTaxDetail, itemDetail);
        }
      }

      // 6. Process Withholdings and Associate with Statutory Tax Liabilities
      for (const wDto of withholdingsToCreate) {
        // Find or create statutory liability ledger record
        let liability = await queryRunner.manager.findOne(StatutoryTaxLiability, {
          where: {
            companyCode,
            taxPeriodYear,
            taxPeriodMonth,
            taxRegime: wDto.pphRegime!,
          },
          lock: { mode: 'pessimistic_write' },
        });

        if (!liability) {
          liability = queryRunner.manager.create(StatutoryTaxLiability, {
            companyCode,
            taxPeriodYear,
            taxPeriodMonth,
            taxRegime: wDto.pphRegime!,
            totalWithheldAmount: wDto.withheldAmount!,
            totalRemittedAmount: 0.0,
            outstandingBalance: wDto.withheldAmount!,
            status: StatutoryLiabilityStatus.OPEN,
          });
          liability = await queryRunner.manager.save(StatutoryTaxLiability, liability);
        } else {
          const newWithheld = new Decimal(liability.totalWithheldAmount).plus(wDto.withheldAmount!);
          const newOutstanding = new Decimal(liability.outstandingBalance).plus(wDto.withheldAmount!);
          liability.totalWithheldAmount = newWithheld.toNumber();
          liability.outstandingBalance = newOutstanding.toNumber();
          if (liability.status === StatutoryLiabilityStatus.DISCHARGED && newOutstanding.greaterThan(0)) {
            liability.status = StatutoryLiabilityStatus.PARTIALLY_SETTLED;
          }
          liability = await queryRunner.manager.save(StatutoryTaxLiability, liability);
        }

        wDto.statutoryTaxLiabilityId = liability.id;
        const withholdingEntity = queryRunner.manager.create(PphWithholdingRecord, wDto);
        await queryRunner.manager.save(PphWithholdingRecord, withholdingEntity);
      }

      // 7. Save Invoice Tax Detail Header Snapshot
      const headerSnapshot = {
        calculatedAt: now.toISOString(),
        calculationEngineVersion: 'EPMS-TAX-2B-1.3.2',
        ppnRegime: ppnRule?.regimeCode || 'N/A',
        ppnRate: ppnRate.toNumber(),
        totalDpp: cumulativeDpp.toNumber(),
        totalPpn: cumulativePpn.toNumber(),
        totalPph: cumulativePph.toNumber(),
        grossCommercialLiability: L_comm.toNumber(),
        netVendorCashPayable: D_cash.toNumber(),
        statutoryTaxLiability: L_tax_stat.toNumber(),
        calculatedBy: userId,
      };

      let invoiceTaxDetail = await queryRunner.manager.findOne(InvoiceTaxDetail, {
        where: { invoiceId: invoice.id },
      });

      if (!invoiceTaxDetail) {
        invoiceTaxDetail = queryRunner.manager.create(InvoiceTaxDetail, {
          invoiceId: invoice.id,
          companyCode,
          taxRegimePpnId: ppnRule?.id || null,
          primaryPphRegimeId: dto.primaryPphRegimeId || null,
          dppCommercial: cumulativeDpp.toNumber(),
          ppnRate: ppnRate.toNumber(),
          ppnAmount: cumulativePpn.toNumber(),
          grossCommercialLiability: L_comm.toNumber(),
          pphWithholdingAmount: W_tax.toNumber(),
          wapuPpnWithheldAmount: W_wapu_ppn.toNumber(),
          priorDeductionsAmount: P_ded.toNumber(),
          netVendorCashPayable: D_cash.toNumber(),
          statutoryTaxLiability: L_tax_stat.toNumber(),
          calculationEngineVersion: 'EPMS-TAX-2B-1.3.2',
          taxRuleSnapshot: headerSnapshot,
        });
      } else {
        invoiceTaxDetail.companyCode = companyCode;
        invoiceTaxDetail.taxRegimePpnId = ppnRule?.id || null;
        invoiceTaxDetail.primaryPphRegimeId = dto.primaryPphRegimeId || null;
        invoiceTaxDetail.dppCommercial = cumulativeDpp.toNumber();
        invoiceTaxDetail.ppnRate = ppnRate.toNumber();
        invoiceTaxDetail.ppnAmount = cumulativePpn.toNumber();
        invoiceTaxDetail.grossCommercialLiability = L_comm.toNumber();
        invoiceTaxDetail.pphWithholdingAmount = W_tax.toNumber();
        invoiceTaxDetail.wapuPpnWithheldAmount = W_wapu_ppn.toNumber();
        invoiceTaxDetail.priorDeductionsAmount = P_ded.toNumber();
        invoiceTaxDetail.netVendorCashPayable = D_cash.toNumber();
        invoiceTaxDetail.statutoryTaxLiability = L_tax_stat.toNumber();
        invoiceTaxDetail.taxRuleSnapshot = headerSnapshot;
      }

      const savedTaxDetail = await queryRunner.manager.save(InvoiceTaxDetail, invoiceTaxDetail);

      if (shouldManageTransaction) {
        await queryRunner.commitTransaction();
      }

      return savedTaxDetail;
    } catch (err) {
      if (shouldManageTransaction) {
        await queryRunner.rollbackTransaction();
      }
      throw err;
    } finally {
      if (shouldManageTransaction) {
        await queryRunner.release();
      }
    }
  }

  /**
   * Evaluates the Dual-Entry Settlement contract:
   * Total Settlement Credit = D_cash + W_tax + W_wapu_ppn + P_ded == term.amount
   */
  evaluateDualEntrySettlement(
    cashDisbursed: number,
    termAmount: number,
    taxDetail?: InvoiceTaxDetail | null,
  ): {
    isValid: boolean;
    reconciliationSum: number;
    commercialDebtRemaining: number;
    statutoryTaxLiability: number;
    discrepancy: number;
  } {
    const cashDec = this.toMoney(cashDisbursed);
    const termDec = this.toMoney(termAmount);

    const wTaxDec = this.toMoney(taxDetail?.pphWithholdingAmount || 0);
    const wWapuDec = this.toMoney(taxDetail?.wapuPpnWithheldAmount || 0);
    const pDedDec = this.toMoney(taxDetail?.priorDeductionsAmount || 0);

    const totalSettlementCredit = cashDec.plus(wTaxDec).plus(wWapuDec).plus(pDedDec);
    const discrepancy = totalSettlementCredit.minus(termDec).toNumber();
    const isValid = totalSettlementCredit.equals(termDec);

    return {
      isValid,
      reconciliationSum: totalSettlementCredit.toNumber(),
      commercialDebtRemaining: isValid ? 0.0 : termDec.minus(totalSettlementCredit).toNumber(),
      statutoryTaxLiability: wTaxDec.plus(wWapuDec).toNumber(),
      discrepancy,
    };
  }
}

