import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Decimal from 'decimal.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaxDeterminationService } from '../tax-determination.service';
import { TaxRemittanceService } from '../tax-remittance.service';
import { TaxConfigurationService } from '../tax-configuration.service';
import { Invoice } from '../../../entities/invoice.entity';
import { InvoiceItem } from '../../../entities/invoice-item.entity';
import { TaxRegimeRule, TaxCategory, TaxRuleVerificationStatus } from '../../../entities/tax-regime-rule.entity';
import { InvoiceTaxDetail } from '../../../entities/invoice-tax-detail.entity';
import { InvoiceItemTaxDetail, ItemTaxCategory, NonWithholdingReason } from '../../../entities/invoice-item-tax-detail.entity';
import { PphWithholdingRecord, RecognitionStatus, StatutoryTriggerType } from '../../../entities/pph-withholding-record.entity';
import { StatutoryTaxLiability, StatutoryLiabilityStatus } from '../../../entities/statutory-tax-liability.entity';
import { TaxRemittanceRecord, RemittanceStatus } from '../../../entities/tax-remittance-record.entity';
import { TaxRemittanceAllocation, AllocationStatus } from '../../../entities/tax-remittance-allocation.entity';
import { LegalEntityTaxProfile, PkpStatus } from '../../../entities/legal-entity-tax-profile.entity';
import { VendorTaxProfile } from '../../../entities/vendor-tax-profile.entity';

describe('EPMS Phase 2B Tax Implementation Test Suite', () => {
  let taxDeterminationService: TaxDeterminationService;
  let taxRemittanceService: TaxRemittanceService;
  let taxConfigurationService: TaxConfigurationService;
  let mockQueryRunner: any;

  beforeEach(async () => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        find: jest.fn(),
        count: jest.fn(),
        save: jest.fn().mockImplementation((entityClass, data) => Promise.resolve(data || entityClass)),
        create: jest.fn().mockImplementation((entityClass, data) => ({ ...data, id: data?.id || 101 })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxDeterminationService,
        TaxRemittanceService,
        TaxConfigurationService,
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
        { provide: getRepositoryToken(Invoice), useValue: { findOne: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(InvoiceItem), useValue: { findOne: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(TaxRegimeRule), useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn() } },
        { provide: getRepositoryToken(InvoiceTaxDetail), useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn() } },
        { provide: getRepositoryToken(InvoiceItemTaxDetail), useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn() } },
        { provide: getRepositoryToken(PphWithholdingRecord), useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn() } },
        { provide: getRepositoryToken(StatutoryTaxLiability), useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn() } },
        { provide: getRepositoryToken(TaxRemittanceRecord), useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn(), count: jest.fn().mockResolvedValue(0) } },
        { provide: getRepositoryToken(TaxRemittanceAllocation), useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn() } },
        { provide: getRepositoryToken(LegalEntityTaxProfile), useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn() } },
        { provide: getRepositoryToken(VendorTaxProfile), useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn() } },
      ],
    }).compile();

    taxDeterminationService = module.get<TaxDeterminationService>(TaxDeterminationService);
    taxRemittanceService = module.get<TaxRemittanceService>(TaxRemittanceService);
    taxConfigurationService = module.get<TaxConfigurationService>(TaxConfigurationService);
  });

  describe('1. Authoritative Six-Dimension Settlement Model & Mathematical Invariants', () => {
    it('FORMULA-01: Correctly calculates L_comm, D_cash, L_rem_comm, and L_tax_stat without adjustments', () => {
      // Commercial test: DPP Rp100.000.000, PPN 11% (Rp11.000.000), PPh 23 2% (Rp2.000.000), WAPU 0, Prior Ded 0
      const dpp = 100000000;
      const ppn = 11000000;
      const pph = 2000000;
      const wapu = 0;
      const pDed = 0;

      const L_comm = dpp + ppn; // 111.000.000
      const D_cash = L_comm - pph - wapu - pDed; // 109.000.000
      const L_rem_comm = L_comm - (D_cash + pph + wapu + pDed); // 0
      const L_tax_stat = pph + wapu; // 2.000.000

      expect(L_comm).toBe(111000000);
      expect(D_cash).toBe(109000000);
      expect(L_rem_comm).toBe(0);
      expect(L_tax_stat).toBe(2000000);

      const evaluation = taxDeterminationService.evaluateDualEntrySettlement(D_cash, L_comm, {
        pphWithholdingAmount: pph,
        wapuPpnWithheldAmount: wapu,
        priorDeductionsAmount: pDed,
      } as any);

      expect(evaluation.isValid).toBe(true);
      expect(evaluation.reconciliationSum).toBe(111000000);
      expect(evaluation.commercialDebtRemaining).toBe(0);
      expect(evaluation.statutoryTaxLiability).toBe(2000000);
      expect(evaluation.discrepancy).toBe(0);
    });

    it('FORMULA-02: Flags discrepancy when cash + withholding != term amount', () => {
      const evaluation = taxDeterminationService.evaluateDualEntrySettlement(
        100000000, // Underpaid cash
        111000000, // Gross term
        {
          pphWithholdingAmount: 2000000, // PPh
          wapuPpnWithheldAmount: 0,
          priorDeductionsAmount: 0,
        } as any,
      );

      expect(evaluation.isValid).toBe(false);
      expect(evaluation.reconciliationSum).toBe(102000000);
      expect(evaluation.discrepancy).toBe(-9000000);
      expect(evaluation.commercialDebtRemaining).toBe(9000000);
    });

    it('FORMULA-03: Zero-withholding invoice behaves identically to gross settlement', () => {
      const evaluation = taxDeterminationService.evaluateDualEntrySettlement(
        111000000,
        111000000,
        null,
      );

      expect(evaluation.isValid).toBe(true);
      expect(evaluation.reconciliationSum).toBe(111000000);
      expect(evaluation.statutoryTaxLiability).toBe(0);
    });
  });

  describe('2. Multi-Company Partitioning & Isolation (DEC-TAX-07)', () => {
    it('COMPANY-01: Rejects company code other than UBD or TVM', async () => {
      await expect(
        taxDeterminationService.determineAndPersistInvoiceTax(
          {
            invoiceId: 1,
            companyCode: 'XYZ_CORP',
          },
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('COMPANY-02: Rejects cross-company invoice processing', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        id: 1,
        companyCode: 'UBD',
        items: [],
      });

      await expect(
        taxDeterminationService.determineAndPersistInvoiceTax(
          {
            invoiceId: 1,
            companyCode: 'TVM',
          },
          1,
        ),
      ).rejects.toThrow('Company code mismatch');
    });

    it('COMPANY-03: Processes valid UBD invoice with shared engine', async () => {
      const invoice = {
        id: 1,
        companyCode: 'UBD',
        totalAmount: 10000000,
        items: [],
      };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(invoice) // find invoice
        .mockResolvedValueOnce(null) // find liability
        .mockResolvedValueOnce(null); // find existing tax detail

      const result = await taxDeterminationService.determineAndPersistInvoiceTax(
        {
          invoiceId: 1,
          companyCode: 'UBD',
        },
        1,
      );

      expect(result.companyCode).toBe('UBD');
      expect(result.dppCommercial).toBe(10000000);
      expect(result.grossCommercialLiability).toBe(10000000);
      expect(result.netVendorCashPayable).toBe(10000000);
    });

    it('COMPANY-04: Processes valid TVM invoice with shared engine', async () => {
      const invoice = {
        id: 2,
        companyCode: 'TVM',
        totalAmount: 20000000,
        items: [],
      };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(invoice)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await taxDeterminationService.determineAndPersistInvoiceTax(
        {
          invoiceId: 2,
          companyCode: 'TVM',
        },
        2,
      );

      expect(result.companyCode).toBe('TVM');
      expect(result.dppCommercial).toBe(20000000);
      expect(result.grossCommercialLiability).toBe(20000000);
      expect(result.netVendorCashPayable).toBe(20000000);
    });
  });

  describe('3. Line-Item Tax Determination & PPh Category Guard (v1.3.2)', () => {
    it('RULE-01: Rejects PPh rule assignment if rule category is PPN', async () => {
      const invoice = {
        id: 1,
        companyCode: 'UBD',
        totalAmount: 50000000,
        items: [{ id: 10, totalPrice: 50000000 }],
      };
      const invalidRule = {
        id: 5,
        regimeCode: 'PPN_11',
        taxCategory: TaxCategory.PPN, // Invalid for withholding
        statutoryRate: 0.11,
        effectiveRateMultiplier: 1.0,
        isActive: true,
        verificationStatus: TaxRuleVerificationStatus.VERIFIED,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(invoice)
        .mockResolvedValueOnce(invalidRule);

      await expect(
        taxDeterminationService.determineAndPersistInvoiceTax(
          {
            invoiceId: 1,
            companyCode: 'UBD',
            lineItems: [
              {
                invoiceItemId: 10,
                itemTaxCategory: ItemTaxCategory.TAXABLE_SERVICES,
                pphTaxRegimeRuleId: 5,
                lineDpp: 50000000,
              },
            ],
          },
          1,
        ),
      ).rejects.toThrow('strictly PPH required');
    });

    it('RULE-02: Rejects inactive or unverified tax rule', async () => {
      const invoice = {
        id: 1,
        companyCode: 'UBD',
        totalAmount: 50000000,
        items: [{ id: 10, totalPrice: 50000000 }],
      };
      const unverifiedRule = {
        id: 6,
        regimeCode: 'PPH_23_SERVICE',
        taxCategory: TaxCategory.PPH,
        statutoryRate: 0.02,
        effectiveRateMultiplier: 1.0,
        isActive: true,
        verificationStatus: TaxRuleVerificationStatus.NOT_VERIFIED, // Not verified!
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(invoice)
        .mockResolvedValueOnce(unverifiedRule);

      await expect(
        taxDeterminationService.determineAndPersistInvoiceTax(
          {
            invoiceId: 1,
            companyCode: 'UBD',
            lineItems: [
              {
                invoiceItemId: 10,
                itemTaxCategory: ItemTaxCategory.TAXABLE_SERVICES,
                pphTaxRegimeRuleId: 6,
                lineDpp: 50000000,
              },
            ],
          },
          1,
        ),
      ).rejects.toThrow('inactive or unverified');
    });

    it('RULE-03: Rejects omitted PPh rule without nonWithholdingReason', async () => {
      const invoice = {
        id: 1,
        companyCode: 'UBD',
        totalAmount: 50000000,
        items: [{ id: 10, totalPrice: 50000000 }],
      };

      mockQueryRunner.manager.findOne.mockResolvedValueOnce(invoice);

      await expect(
        taxDeterminationService.determineAndPersistInvoiceTax(
          {
            invoiceId: 1,
            companyCode: 'UBD',
            lineItems: [
              {
                invoiceItemId: 10,
                itemTaxCategory: ItemTaxCategory.TAXABLE_GOODS,
                pphTaxRegimeRuleId: null,
                nonWithholdingReason: null, // Missing!
                lineDpp: 50000000,
              },
            ],
          },
          1,
        ),
      ).rejects.toThrow('omitted PPh rule without specifying nonWithholdingReason');
    });

    it('RULE-04: Successfully processes non-withholding deliverable with reason', async () => {
      const invoice = {
        id: 1,
        companyCode: 'UBD',
        totalAmount: 50000000,
        items: [{ id: 10, totalPrice: 50000000 }],
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(invoice)
        .mockResolvedValueOnce(null) // existing item tax detail
        .mockResolvedValueOnce(null); // existing invoice tax detail

      const result = await taxDeterminationService.determineAndPersistInvoiceTax(
        {
          invoiceId: 1,
          companyCode: 'UBD',
          lineItems: [
            {
              invoiceItemId: 10,
              itemTaxCategory: ItemTaxCategory.TAXABLE_GOODS,
              pphTaxRegimeRuleId: null,
              nonWithholdingReason: NonWithholdingReason.MATERIAL_SUPPLY,
              lineDpp: 50000000,
            },
          ],
        },
        1,
      );

      expect(result.pphWithholdingAmount).toBe(0);
      expect(result.grossCommercialLiability).toBe(50000000);
      expect(result.netVendorCashPayable).toBe(50000000);
    });
  });

  describe('4. Tax Remittance & Sovereign Liability Reconciliation (DEC-TAX-08)', () => {
    it('REMIT-01: Rejects allocation when dimensions do not match', async () => {
      const remittance = {
        id: 1,
        companyCode: 'UBD',
        taxPeriodYear: 2026,
        taxPeriodMonth: 11,
        taxRegime: 'PPH_23_SERVICE',
        remittanceStatus: RemittanceStatus.SETTLED_NTPN,
        unallocatedAmount: 10000000,
        allocatedAmount: 0,
      };

      const withholding = {
        id: 2,
        companyCode: 'TVM', // Mismatch! TVM vs UBD
        taxPeriodYear: 2026,
        taxPeriodMonth: 11,
        pphRegime: 'PPH_23_SERVICE',
        withheldAmount: 5000000,
        outstandingWithheldAmount: 5000000,
        totalRemittedAmount: 0,
        recognitionStatus: RecognitionStatus.RECOGNIZED_UNREMITTED,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(remittance)
        .mockResolvedValueOnce(withholding);

      await expect(
        taxRemittanceService.allocateRemittance(
          {
            remittanceRecordId: 1,
            withholdingRecordId: 2,
            allocatedAmount: 5000000,
          },
          1,
        ),
      ).rejects.toThrow('Dimensional mismatch');
    });

    it('REMIT-02: Rejects allocation exceeding available unallocated cash', async () => {
      const remittance = {
        id: 1,
        companyCode: 'UBD',
        taxPeriodYear: 2026,
        taxPeriodMonth: 11,
        taxRegime: 'PPH_23_SERVICE',
        remittanceStatus: RemittanceStatus.SETTLED_NTPN,
        unallocatedAmount: 2000000, // Only 2M available
        allocatedAmount: 8000000,
      };

      const withholding = {
        id: 2,
        companyCode: 'UBD',
        taxPeriodYear: 2026,
        taxPeriodMonth: 11,
        pphRegime: 'PPH_23_SERVICE',
        withheldAmount: 5000000,
        outstandingWithheldAmount: 5000000,
        statutoryTaxLiabilityId: 10,
        totalRemittedAmount: 0,
        recognitionStatus: RecognitionStatus.RECOGNIZED_UNREMITTED,
      };

      const liability = {
        id: 10,
        totalWithheldAmount: 5000000,
        totalRemittedAmount: 0,
        outstandingBalance: 5000000,
        status: StatutoryLiabilityStatus.OPEN,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(remittance)
        .mockResolvedValueOnce(withholding)
        .mockResolvedValueOnce(liability);

      await expect(
        taxRemittanceService.allocateRemittance(
          {
            remittanceRecordId: 1,
            withholdingRecordId: 2,
            allocatedAmount: 5000000, // Requests 5M > 2M available
          },
          1,
        ),
      ).rejects.toThrow('exceeds available unallocated remittance cash');
    });

    it('REMIT-03: Successfully allocates settled remittance and updates liability', async () => {
      const remittance = {
        id: 1,
        companyCode: 'UBD',
        taxPeriodYear: 2026,
        taxPeriodMonth: 11,
        taxRegime: 'PPH_23_SERVICE',
        remittanceStatus: RemittanceStatus.SETTLED_NTPN,
        unallocatedAmount: 5000000,
        allocatedAmount: 0,
      };

      const withholding = {
        id: 2,
        companyCode: 'UBD',
        taxPeriodYear: 2026,
        taxPeriodMonth: 11,
        pphRegime: 'PPH_23_SERVICE',
        withheldAmount: 5000000,
        outstandingWithheldAmount: 5000000,
        statutoryTaxLiabilityId: 10,
        totalRemittedAmount: 0,
        recognitionStatus: RecognitionStatus.RECOGNIZED_UNREMITTED,
      };

      const liability = {
        id: 10,
        totalWithheldAmount: 5000000,
        totalRemittedAmount: 0,
        outstandingBalance: 5000000,
        status: StatutoryLiabilityStatus.OPEN,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(remittance)
        .mockResolvedValueOnce(withholding)
        .mockResolvedValueOnce(liability);

      const allocation = await taxRemittanceService.allocateRemittance(
        {
          remittanceRecordId: 1,
          withholdingRecordId: 2,
          allocatedAmount: 5000000,
        },
        1,
      );

      expect(allocation.allocatedAmount).toBe(5000000);
      expect(remittance.allocatedAmount).toBe(5000000);
      expect(remittance.unallocatedAmount).toBe(0);
      expect(withholding.outstandingWithheldAmount).toBe(0);
      expect(withholding.recognitionStatus).toBe(RecognitionStatus.FULLY_REMITTED);
      expect(liability.outstandingBalance).toBe(0);
      expect(liability.status).toBe(StatutoryLiabilityStatus.DISCHARGED);
    });

    it('REMIT-04: Atomic reversal restores unallocated remittance and reopens liabilities', async () => {
      const allocation = {
        id: 100,
        remittanceRecordId: 1,
        withholdingRecordId: 2,
        statutoryLiabilityId: 10,
        allocatedAmount: 5000000,
        allocationStatus: AllocationStatus.ALLOCATED,
      };

      const remittance = {
        id: 1,
        remittanceStatus: RemittanceStatus.SETTLED_NTPN,
        remittedAmount: 5000000,
        allocatedAmount: 5000000,
        unallocatedAmount: 0,
        allocations: [allocation],
      };

      const withholding = {
        id: 2,
        withheldAmount: 5000000,
        totalRemittedAmount: 5000000,
        outstandingWithheldAmount: 0,
        recognitionStatus: RecognitionStatus.FULLY_REMITTED,
      };

      const liability = {
        id: 10,
        totalWithheldAmount: 5000000,
        totalRemittedAmount: 5000000,
        outstandingBalance: 0,
        status: StatutoryLiabilityStatus.DISCHARGED,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(remittance)
        .mockResolvedValueOnce(withholding)
        .mockResolvedValueOnce(liability);

      const reversedRemittance = await taxRemittanceService.reverseRemittance(
        {
          remittanceRecordId: 1,
          reversalReason: 'Wrong DJP billing code allocated by bank operator',
        },
        1,
      );

      expect(reversedRemittance.remittanceStatus).toBe(RemittanceStatus.REVERSED);
      expect(reversedRemittance.allocatedAmount).toBe(0);
      expect(reversedRemittance.unallocatedAmount).toBe(5000000);
      expect(allocation.allocationStatus).toBe(AllocationStatus.REVERSED);
      expect(withholding.outstandingWithheldAmount).toBe(5000000);
      expect(withholding.recognitionStatus).toBe(RecognitionStatus.RECOGNIZED_UNREMITTED);
      expect(liability.outstandingBalance).toBe(5000000);
      expect(liability.status).toBe(StatutoryLiabilityStatus.OPEN);
    });
  });
});

