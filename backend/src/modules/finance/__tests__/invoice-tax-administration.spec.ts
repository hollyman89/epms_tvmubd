import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from '../finance.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Invoice } from '../../../entities/invoice.entity';
import { Payment } from '../../../entities/payment.entity';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { GoodsReceipt } from '../../../entities/goods-receipt.entity';
import { PoPaymentTerm, PaymentTermStatus, PaymentTermType } from '../../../entities/po-payment-term.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { PpnMasukanRecord } from '../../../entities/ppn-masukan-record.entity';
import { PphWithholdingRecord } from '../../../entities/pph-withholding-record.entity';
import { InvoiceTaxDetail } from '../../../entities/invoice-tax-detail.entity';
import { StatutoryTaxLiability } from '../../../entities/statutory-tax-liability.entity';
import { TaxRegimeRule } from '../../../entities/tax-regime-rule.entity';
import { PaymentRequest, PaymentRequestStatus } from '../../../entities/payment-request.entity';
import { DirectorDecisionAction } from '../dto/decide-payment-request.dto';
import { AuditLog } from '../../../entities/audit-log.entity';
import { CompanyBankAccount } from '../../../entities/company-bank-account.entity';

describe('Invoice Tax Administration Integration Suite (Section 9 Mandate)', () => {
  let service: FinanceService;
  let mockQueryRunner: any;
  let savedRecords: any[];

  const baselinePo = {
    id: 10,
    poNumber: 'PO-20261113-001',
    status: 'ISSUED',
    orderType: 'MATERIAL',
    totalAmount: 100000000,
    companyCode: 'UBD',
    vendorId: 5,
    vendor: { id: 5, name: 'PT Vendor Solusi', npwp: '0123456789012345' },
    items: [
      { id: 101, purchaseOrderId: 10, itemName: 'Server Core Unit', quantity: 1, unitPrice: 100000000, receivedQuantity: 1 },
    ],
    paymentTerms: [],
  };

  const baselineTerm = {
    id: 201,
    poId: 10,
    sequence: 1,
    termName: 'Termin #1 (Down Payment 30%)',
    termType: PaymentTermType.DOWN_PAYMENT,
    percentage: 30.0,
    amount: 30000000,
    status: PaymentTermStatus.PENDING,
    deletedAt: null,
  };

  beforeEach(async () => {
    savedRecords = [];
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          getCount: jest.fn().mockResolvedValue(0),
        }),
        create: jest.fn().mockImplementation((entityClass, data) => ({ ...data })),
        save: jest.fn().mockImplementation((entityClassOrTarget, entity) => {
          const target = entity !== undefined ? entity : entityClassOrTarget;
          const entityClass = entity !== undefined ? entityClassOrTarget : null;
          if (!target.id) {
            target.id = Math.floor(Math.random() * 10000) + 1;
          }
          savedRecords.push({ entityClass, target });
          return Promise.resolve(target);
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
            getRepository: jest.fn().mockImplementation(() => ({
              createQueryBuilder: jest.fn().mockReturnValue({
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockImplementation(async () => {
                  const lastPrq = savedRecords.filter((r) => r.entityClass === PaymentRequest).pop()?.target;
                  return lastPrq || { id: 1, requestedAmount: 990000 };
                }),
              }),
            })),
          },
        },
        { provide: getRepositoryToken(Invoice), useValue: { find: jest.fn(), findOne: jest.fn() } },
        { provide: getRepositoryToken(Payment), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(PurchaseOrder), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(GoodsReceipt), useValue: {} },
        { provide: getRepositoryToken(PoPaymentTerm), useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  // 1. Invoice issuance without tax information
  it('Scenario 1: Invoice issued without tax information succeeds and leaves tax tables untouched', async () => {
    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...baselineTerm });

    const dto = {
      purchaseOrderId: 10,
      paymentTermId: 201,
      invoiceDate: '2026-11-13',
    };

    const result = await service.createInvoice(dto, 99);

    expect(result).toBeDefined();
    expect(result.totalAmount).toBe(30000000);
    expect(result.companyCode).toBe('UBD');

    // Confirm zero tax records were saved
    const taxDetail = savedRecords.find((r) => r.entityClass === InvoiceTaxDetail);
    const ppnRecord = savedRecords.find((r) => r.entityClass === PpnMasukanRecord);
    const pphRecord = savedRecords.find((r) => r.entityClass === PphWithholdingRecord);
    expect(taxDetail).toBeUndefined();
    expect(ppnRecord).toBeUndefined();
    expect(pphRecord).toBeUndefined();
  });

  // 2. Invoice issuance with PPN only
  it('Scenario 2: Invoice issued with PPN only records Faktur Pajak and computes gross liability', async () => {
    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...baselineTerm })
      .mockResolvedValueOnce(null) // existing PPN
      .mockResolvedValueOnce(null); // existing tax detail

    const dto = {
      purchaseOrderId: 10,
      paymentTermId: 201,
      invoiceDate: '2026-11-13',
      tax: {
        ppn: {
          fakturPajakNumber: '010.000-26.12345678',
          fakturPajakDate: '2026-11-13',
          dppAmount: 30000000,
          ppnAmount: 3300000,
        },
      },
    };

    const result = await service.createInvoice(dto, 99);
    expect(result.totalAmount).toBe(30000000); // Gross invoice total unmodified

    const ppnEntry = savedRecords.find((r) => r.entityClass === PpnMasukanRecord);
    expect(ppnEntry).toBeDefined();
    expect(ppnEntry.target.invoiceId).toBe(result.id);
    expect(ppnEntry.target.companyCode).toBe('UBD');
    expect(ppnEntry.target.fakturPajakNumber).toBe('0100002612345678'); // digits only normalized to 16 digits
    expect(ppnEntry.target.ppnAmount).toBe(3300000);

    const taxDetailEntry = savedRecords.find((r) => r.entityClass === InvoiceTaxDetail);
    expect(taxDetailEntry).toBeDefined();
    expect(taxDetailEntry.target.grossCommercialLiability).toBe(33300000); // DPP 30M + PPN 3.3M
    expect(taxDetailEntry.target.pphWithholdingAmount).toBe(0);
    expect(taxDetailEntry.target.netVendorCashPayable).toBe(33300000);
  });

  // 3. Invoice issuance with PPh only
  it('Scenario 3: Invoice issued with PPh only records administrative withholding and does not create/update TaxRegimeRule or StatutoryTaxLiability', async () => {
    const mockLiability = { id: 701, companyCode: 'UBD', taxPeriodYear: 2026, taxPeriodMonth: 11, taxRegime: 'PPH_23', totalWithheldAmount: 0, outstandingBalance: 0 };
    const mockRule = { id: 801, regimeCode: 'PPH_23', taxCategory: 'PPH' };

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo }) // 1. PO
      .mockResolvedValueOnce(null) // 2. candidateNumber check
      .mockResolvedValueOnce({ ...baselineTerm }) // 3. PoPaymentTerm
      .mockResolvedValueOnce(null) // 4. existingActiveInvoiceForTerm
      .mockResolvedValueOnce(mockLiability) // 5. existing statutory liability
      .mockResolvedValueOnce(mockRule) // 6. existing tax regime rule
      .mockResolvedValueOnce(null) // 7. existing PPh withholding record
      .mockResolvedValueOnce(null); // 8. existing tax detail

    const dto = {
      purchaseOrderId: 10,
      paymentTermId: 201,
      invoiceDate: '2026-11-13',
      tax: {
        pph: {
          pphType: 'PPH_23',
          rate: 2.0,
          taxableBase: 30000000,
          withheldAmount: 600000,
          buktiPotongNumber: 'BP-202611-001',
          buktiPotongDate: '2026-11-13',
        },
      },
    };

    const result = await service.createInvoice(dto, 99);
    expect(result.totalAmount).toBe(30000000);

    const pphEntry = savedRecords.find((r) => r.entityClass === PphWithholdingRecord);
    expect(pphEntry).toBeDefined();
    expect(pphEntry.target.invoiceId).toBe(result.id);
    expect(pphEntry.target.withheldAmount).toBe(600000);
    expect(pphEntry.target.buktiPotongNumber).toBe('BP-202611-001');

    // Confirm StatutoryTaxLiability and TaxRegimeRule are NOT created or updated (Correction Requirement 1)
    const liabilitySave = savedRecords.find((r) => r.entityClass === StatutoryTaxLiability);
    const ruleSave = savedRecords.find((r) => r.entityClass === TaxRegimeRule);
    expect(liabilitySave).toBeUndefined();
    expect(ruleSave).toBeUndefined();

    const taxDetailEntry = savedRecords.find((r) => r.entityClass === InvoiceTaxDetail);
    expect(taxDetailEntry).toBeDefined();
    expect(taxDetailEntry.target.pphWithholdingAmount).toBe(600000);
    expect(taxDetailEntry.target.netVendorCashPayable).toBe(29400000); // 30M - 600k
  });

  // 4. Invoice issuance with both PPN and PPh
  it('Scenario 4: Invoice issued with both PPN and PPh records full dual-entry settlement data', async () => {
    const mockLiability = { id: 701, companyCode: 'UBD', taxPeriodYear: 2026, taxPeriodMonth: 11, taxRegime: 'PPH_23' };
    const mockRule = { id: 801, regimeCode: 'PPH_23', taxCategory: 'PPH' };

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo }) // 1. PO
      .mockResolvedValueOnce(null) // 2. candidateNumber check
      .mockResolvedValueOnce({ ...baselineTerm }) // 3. PoPaymentTerm
      .mockResolvedValueOnce(null) // 4. existingActiveInvoiceForTerm
      .mockResolvedValueOnce(null) // 5. existing PPN
      .mockResolvedValueOnce(mockLiability) // 6. liability
      .mockResolvedValueOnce(mockRule) // 7. rule
      .mockResolvedValueOnce(null) // 8. PPh
      .mockResolvedValueOnce(null); // 9. Tax detail

    const dto = {
      purchaseOrderId: 10,
      paymentTermId: 201,
      invoiceDate: '2026-11-13',
      tax: {
        ppn: {
          fakturPajakNumber: '0100002612345678',
          fakturPajakDate: '2026-11-13',
          dppAmount: 30000000,
          ppnAmount: 3300000,
        },
        pph: {
          pphType: 'PPH_23',
          rate: 2.0,
          taxableBase: 30000000,
          withheldAmount: 600000,
          buktiPotongNumber: 'BP-202611-001',
          buktiPotongDate: '2026-11-13',
        },
      },
    };

    const result = await service.createInvoice(dto, 99);

    const taxDetail = savedRecords.find((r) => r.entityClass === InvoiceTaxDetail)?.target;
    expect(taxDetail).toBeDefined();
    expect(taxDetail.dppCommercial).toBe(30000000);
    expect(taxDetail.ppnAmount).toBe(3300000);
    expect(taxDetail.grossCommercialLiability).toBe(33300000);
    expect(taxDetail.pphWithholdingAmount).toBe(600000);
    expect(taxDetail.netVendorCashPayable).toBe(32700000); // 33.3M - 600k = 32.7M
  });

  // 5. Finding 1 Remediation: Strict NSFP Data Integrity (no silent padding or fabrication)
  describe('Scenario 5: Strict NSFP Validation Matrix', () => {
    const makeNsfpDto = (nsfpValue?: string) => ({
      purchaseOrderId: 10,
      paymentTermId: 201,
      invoiceDate: '2026-11-13',
      tax: {
        ppn: {
          fakturPajakNumber: nsfpValue,
          fakturPajakDate: '2026-11-13',
          dppAmount: 30000000,
          ppnAmount: 3300000,
        },
      },
    });

    const setupMockFind = () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baselinePo })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...baselineTerm })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
    };

    it('Scenario 5a: Rejects 4-digit NSFP with BadRequestException', async () => {
      setupMockFind();
      await expect(service.createInvoice(makeNsfpDto('9988'), 99)).rejects.toThrow(
        BadRequestException
      );
    });

    it('Scenario 5b: Rejects 15-digit NSFP with BadRequestException', async () => {
      setupMockFind();
      await expect(service.createInvoice(makeNsfpDto('012345678901234'), 99)).rejects.toThrow(
        BadRequestException
      );
    });

    it('Scenario 5c: Rejects 17-digit NSFP with BadRequestException', async () => {
      setupMockFind();
      await expect(service.createInvoice(makeNsfpDto('01234567890123456'), 99)).rejects.toThrow(
        BadRequestException
      );
    });

    it('Scenario 5d: Rejects empty NSFP when PPN flow is active with BadRequestException', async () => {
      setupMockFind();
      await expect(service.createInvoice(makeNsfpDto(''), 99)).rejects.toThrow(
        BadRequestException
      );
    });

    it('Scenario 5e: Rejects alphabetic or invalid characters in NSFP with BadRequestException', async () => {
      setupMockFind();
      await expect(service.createInvoice(makeNsfpDto('010.000-26.ABCDEF78'), 99)).rejects.toThrow(
        BadRequestException
      );
    });

    it('Scenario 5f: Accepts valid raw 16-digit NSFP', async () => {
      setupMockFind();
      await service.createInvoice(makeNsfpDto('0100002612345678'), 99);
      const ppnEntry = savedRecords.find((r) => r.entityClass === PpnMasukanRecord);
      expect(ppnEntry.target.fakturPajakNumber).toBe('0100002612345678');
    });

    it('Scenario 5g: Accepts valid formatted 16-digit e-Faktur NSFP (010.000-26.12345678)', async () => {
      setupMockFind();
      await service.createInvoice(makeNsfpDto('010.000-26.12345678'), 99);
      const ppnEntry = savedRecords.find((r) => r.entityClass === PpnMasukanRecord);
      expect(ppnEntry.target.fakturPajakNumber).toBe('0100002612345678');
    });
  });

  // 6. Supporting document association
  it('Scenario 6: Supporting document audit snapshot stores document metadata', async () => {
    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...baselineTerm })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const dto = {
      purchaseOrderId: 10,
      paymentTermId: 201,
      invoiceDate: '2026-11-13',
      tax: {
        ppn: {
          fakturPajakNumber: '0100002612345678',
          fakturPajakDate: '2026-11-13',
          dppAmount: 30000000,
          ppnAmount: 3300000,
          documentId: 44,
        },
      },
    };

    await service.createInvoice(dto, 99);
    const taxDetail = savedRecords.find((r) => r.entityClass === InvoiceTaxDetail)?.target;
    expect(taxDetail.taxRuleSnapshot.fakturPajakNumber).toBe('0100002612345678');
    expect(taxDetail.taxRuleSnapshot.mode).toBe('ADMINISTRATIVE_RECORDING');
  });

  // 7. Correct invoice-to-tax record association
  it('Scenario 7: Both PPN and PPh link exactly to generated invoice ID', async () => {
    const mockLiability = { id: 701, companyCode: 'UBD', taxPeriodYear: 2026, taxPeriodMonth: 11, taxRegime: 'PPH_23' };
    const mockRule = { id: 801, regimeCode: 'PPH_23', taxCategory: 'PPH' };

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo }) // 1. PO
      .mockResolvedValueOnce(null) // 2. candidateNumber check
      .mockResolvedValueOnce({ ...baselineTerm }) // 3. PoPaymentTerm
      .mockResolvedValueOnce(null) // 4. existingActiveInvoiceForTerm
      .mockResolvedValueOnce(null) // 5. existing PPN
      .mockResolvedValueOnce(mockLiability) // 6. liability
      .mockResolvedValueOnce(mockRule) // 7. rule
      .mockResolvedValueOnce(null) // 8. PPh
      .mockResolvedValueOnce(null); // 9. Tax detail

    const dto = {
      purchaseOrderId: 10,
      paymentTermId: 201,
      invoiceDate: '2026-11-13',
      tax: {
        ppn: { fakturPajakNumber: '0100002612345678', ppnAmount: 3300000 },
        pph: { pphType: 'PPH_23', withheldAmount: 600000 },
      },
    };

    const inv = await service.createInvoice(dto, 99);
    const ppn = savedRecords.find((r) => r.entityClass === PpnMasukanRecord)?.target;
    const pph = savedRecords.find((r) => r.entityClass === PphWithholdingRecord)?.target;
    const itd = savedRecords.find((r) => r.entityClass === InvoiceTaxDetail)?.target;

    expect(ppn.invoiceId).toBe(inv.id);
    expect(pph.invoiceId).toBe(inv.id);
    expect(itd.invoiceId).toBe(inv.id);
  });

  // 8. Duplicate submission protection
  it('Scenario 8: Rejects second active invoice creation for the same payment term', async () => {
    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...baselineTerm, status: PaymentTermStatus.INVOICE_SUBMITTED }); // Already processed

    const dto = {
      purchaseOrderId: 10,
      paymentTermId: 201,
      invoiceDate: '2026-11-13',
    };

    await expect(service.createInvoice(dto, 99)).rejects.toThrow(
      'Payment term belum dapat ditagihkan atau sudah memiliki proses tagihan.'
    );
  });

  // 9. UBD and TVM ownership isolation
  it('Scenario 9: Correctly assigns company ownership (TVM vs UBD)', async () => {
    const tvmPo = { ...baselinePo, companyCode: 'TVM' };
    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce(tvmPo)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...baselineTerm })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const dto = {
      purchaseOrderId: 10,
      paymentTermId: 201,
      invoiceDate: '2026-11-13',
      tax: {
        ppn: { fakturPajakNumber: '0100002612345678', ppnAmount: 3300000 },
      },
    };

    const inv = await service.createInvoice(dto, 99);
    expect(inv.companyCode).toBe('TVM');

    const ppn = savedRecords.find((r) => r.entityClass === PpnMasukanRecord)?.target;
    expect(ppn.companyCode).toBe('TVM');
  });

  // 10. Existing PO matching and payment settlement behavior
  it('Scenario 10: Invoice total amount strictly preserves payment term target amount', async () => {
    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ ...baselinePo })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...baselineTerm, amount: 30000000 })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const dto = {
      purchaseOrderId: 10,
      paymentTermId: 201,
      invoiceDate: '2026-11-13',
      tax: {
        ppn: { fakturPajakNumber: '0100002612345678', ppnAmount: 3300000 },
        pph: { withheldAmount: 600000 },
      },
    };

    const inv = await service.createInvoice(dto, 99);
    // Even though tax was recorded, invoice.totalAmount strictly equals the term contract value
    expect(inv.totalAmount).toBe(30000000);
    expect(inv.matchStatus).toBe('PENDING');
  });

  // 11. Vendor tax identity handling (Correction Requirement 2)
  it('Scenario 11: Vendor without 16-digit NPWP leaves vendorTaxId as UNVERIFIED without substituting fake data', async () => {
    const poWithoutNpwp = {
      ...baselinePo,
      vendor: { id: 5, name: 'Vendor Tanpa NPWP', npwp: '' }, // empty NPWP
    };

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce(poWithoutNpwp)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...baselineTerm })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const dto = {
      purchaseOrderId: 10,
      paymentTermId: 201,
      invoiceDate: '2026-11-13',
      tax: {
        ppn: { fakturPajakNumber: '0100002612345678', ppnAmount: 3300000 },
      },
    };

    await service.createInvoice(dto, 99);

    const ppnEntry = savedRecords.find((r) => r.entityClass === PpnMasukanRecord);
    expect(ppnEntry).toBeDefined();
    expect(ppnEntry.target.vendorTaxId).toBe('UNVERIFIED');
    expect(ppnEntry.target.vendorTaxId).not.toBe('0000000000000000');
  });

  // 12. Controlled PPN/PPh Settlement Formula Verification Matrix
  describe('Scenario 12: Controlled PPN/PPh Settlement Formula Verification Matrix', () => {
    const testPo900k = {
      id: 24,
      poNumber: 'PO-20261113-003',
      status: 'ISSUED',
      orderType: 'MATERIAL',
      totalAmount: 900000,
      companyCode: 'UBD',
      vendorId: 5,
      vendor: { id: 5, name: 'PT Vendor Solusi', npwp: '0123456789012345' },
      items: [
        { id: 101, purchaseOrderId: 24, itemName: 'Material Standard', quantity: 10, unitPrice: 90000, receivedQuantity: 10 },
      ],
      paymentTerms: [],
    };

    const testTerm900k = {
      id: 24,
      poId: 24,
      sequence: 1,
      termName: 'Pelunasan Penuh',
      termType: PaymentTermType.FINAL_DELIVERY,
      percentage: 100.0,
      amount: 900000,
      status: PaymentTermStatus.PENDING,
      deletedAt: null,
    };

    it('Scenario 12a: Confirmed Test Case (PO-20261113-003) calculates Gross Rp999k and Net Cash Rp990k', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...testPo900k })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...testTerm900k })
        .mockResolvedValueOnce(null) // existing active invoice
        .mockResolvedValueOnce(null) // existing PPN
        .mockResolvedValueOnce({ id: 701, companyCode: 'UBD', taxPeriodYear: 2026, taxPeriodMonth: 11, taxRegime: 'PPH_FINAL_1_PERCENT' })
        .mockResolvedValueOnce({ id: 801, regimeCode: 'PPH_FINAL_1_PERCENT', taxCategory: 'PPH' })
        .mockResolvedValueOnce(null) // existing PPh
        .mockResolvedValueOnce(null); // existing tax detail

      const dto = {
        purchaseOrderId: 24,
        paymentTermId: 24,
        invoiceDate: '2026-11-13',
        tax: {
          ppn: {
            fakturPajakNumber: '0100002612345678',
            fakturPajakDate: '2026-11-13',
            dppAmount: 900000,
            ppnRate: 11.0,
            ppnAmount: 99000,
          },
          pph: {
            pphType: 'PPH_FINAL_1_PERCENT',
            rate: 1.0,
            taxableBase: 900000,
            withheldAmount: 9000,
            buktiPotongNumber: 'BP-202611-003',
            buktiPotongDate: '2026-11-13',
          },
        },
      };

      const inv = await service.createInvoice(dto, 99);
      // Commercial commitment preserved
      expect(inv.totalAmount).toBe(900000);

      const taxDetail = savedRecords.find((r) => r.entityClass === InvoiceTaxDetail)?.target;
      expect(taxDetail).toBeDefined();
      expect(taxDetail.dppCommercial).toBe(900000);
      expect(taxDetail.ppnAmount).toBe(99000);
      expect(taxDetail.grossCommercialLiability).toBe(999000); // DPP + PPN
      expect(taxDetail.pphWithholdingAmount).toBe(9000);
      expect(taxDetail.netVendorCashPayable).toBe(990000); // Gross - PPh
    });

    it('Scenario 12b: submitPaymentRequest allows expected vendor cash Rp990,000 and rejects Rp891,000', async () => {
      const mockItd = {
        id: 1,
        invoiceId: 50,
        dppCommercial: 900000,
        ppnAmount: 99000,
        grossCommercialLiability: 999000,
        pphWithholdingAmount: 9000,
        wapuPpnWithheldAmount: 0,
        priorDeductionsAmount: 0,
        netVendorCashPayable: 990000,
      };

      const mockInvoice = {
        id: 50,
        poId: 24,
        invoiceNumber: 'INV-20261113-003',
        paymentTermId: 24,
        matchStatus: 'MATCHED',
        paymentStatus: 'UNPAID',
        totalAmount: 900000,
        invoiceTaxDetail: mockItd,
        paymentTerm: { ...testTerm900k, status: PaymentTermStatus.VERIFIED },
        purchaseOrder: testPo900k,
      };

      // Submitting unauthorized 891,000 is rejected
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockInvoice }) // Lock invoice
        .mockResolvedValueOnce(null); // Active PRQ check
      mockQueryRunner.manager.find.mockResolvedValueOnce([]); // No previous payments

      await expect(
        service.submitPaymentRequest({ invoiceId: 50, requestedAmount: 891000 }, 1)
      ).rejects.toThrow('tidak sesuai dengan estimasi kas bersih vendor');

      // Submitting authoritative 990,000 succeeds
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockInvoice }) // Lock invoice
        .mockResolvedValueOnce(null); // Active PRQ check
      mockQueryRunner.manager.find.mockResolvedValueOnce([]); // No previous payments

      const prq = await service.submitPaymentRequest({ invoiceId: 50, requestedAmount: 990000 }, 1);
      expect(prq).toBeDefined();
      expect(prq.requestedAmount).toBe(990000);
    });

    it('Scenario 12c: Full Payment with Cash Rp990k + PPh Rp9k satisfies Gross Rp999k, marking invoice and term PAID', async () => {
      const mockItd = {
        id: 1,
        invoiceId: 50,
        dppCommercial: 900000,
        ppnAmount: 99000,
        grossCommercialLiability: 999000,
        pphWithholdingAmount: 9000,
        wapuPpnWithheldAmount: 0,
        priorDeductionsAmount: 0,
        netVendorCashPayable: 990000,
      };

      const mockInvoice = {
        id: 50,
        poId: 24,
        invoiceNumber: 'INV-20261113-003',
        paymentTermId: 24,
        matchStatus: 'MATCHED',
        paymentStatus: 'UNPAID',
        totalAmount: 900000,
        invoiceTaxDetail: mockItd,
      };

      const mockPrq = {
        id: 100,
        invoiceId: 50,
        requestNumber: 'PRQ-20261113-001',
        requestedAmount: 990000,
        approvedAmount: 990000,
        approvedBy: 2, // Director
        status: PaymentRequestStatus.APPROVED_FOR_PAYMENT,
      };

      const mockTerm = {
        id: 24,
        poId: 24,
        amount: 900000,
        status: PaymentTermStatus.VERIFIED,
      };

      const mockCba = {
        id: 1,
        companyCode: 'UBD',
        bankName: 'Bank Mandiri',
        accountNumber: '1234567890',
        accountHolderName: 'PT Utama Bangun Dananjaya',
        accountType: 'GIRO',
        accountPurpose: 'OPERATIONAL',
        status: 'ACTIVE',
        effectiveDate: '2026-01-01',
        expiryDate: null,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockInvoice, companyCode: 'UBD' }) // 1. Invoice lock
        .mockResolvedValueOnce({ ...mockPrq, companyCode: 'UBD' }) // 2. PRQ lock
        .mockResolvedValueOnce({ ...testPo900k, companyCode: 'UBD' }) // 3. PO check
        .mockResolvedValueOnce(mockCba) // 4. CompanyBankAccount check
        .mockResolvedValueOnce({ ...mockTerm }); // 5. Term lock

      mockQueryRunner.manager.find
        .mockResolvedValueOnce([]) // existing invoice payments
        .mockResolvedValueOnce([{ ...mockInvoice }]) // po invoices
        .mockResolvedValueOnce([]); // all po payments before

      const paymentDto = {
        invoiceId: 50,
        paymentRequestId: 100,
        companyBankAccountId: 1,
        amount: 990000,
        paymentDate: '2026-11-13',
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: 'REF-20261113-001',
      };

      const res = await service.createPayment(paymentDto, 1);
      expect(res).toBeDefined();

      const savedInv = savedRecords.find((r) => r.entityClass === Invoice || (r.target && r.target.invoiceNumber === 'INV-20261113-003'))?.target;
      expect(savedInv).toBeDefined();
      expect(savedInv.paymentStatus).toBe('PAID');

      const savedTerm = savedRecords.find((r) => r.entityClass === PoPaymentTerm || (r.target && r.target.id === 24))?.target;
      expect(savedTerm).toBeDefined();
      expect(savedTerm.status).toBe(PaymentTermStatus.PAID);
    });

    it('Scenario 12d: Partial Payment of Rp500k recognizes Rp509k total credit, leaving Rp490k outstanding (PARTIALLY_PAID)', async () => {
      const mockItd = {
        id: 1,
        invoiceId: 50,
        dppCommercial: 900000,
        ppnAmount: 99000,
        grossCommercialLiability: 999000,
        pphWithholdingAmount: 9000,
        wapuPpnWithheldAmount: 0,
        priorDeductionsAmount: 0,
        netVendorCashPayable: 990000,
      };

      const mockInvoice = {
        id: 50,
        poId: 24,
        invoiceNumber: 'INV-20261113-003',
        paymentTermId: null, // Non-term partial payment
        matchStatus: 'MATCHED',
        paymentStatus: 'UNPAID',
        totalAmount: 900000,
        invoiceTaxDetail: mockItd,
      };

      const mockPrq = {
        id: 101,
        invoiceId: 50,
        requestNumber: 'PRQ-20261113-002',
        requestedAmount: 500000,
        approvedAmount: 500000,
        approvedBy: 2,
        status: PaymentRequestStatus.APPROVED_FOR_PAYMENT,
      };

      const mockCba = {
        id: 1,
        companyCode: 'UBD',
        bankName: 'Bank Mandiri',
        accountNumber: '1234567890',
        accountHolderName: 'PT Utama Bangun Dananjaya',
        accountType: 'GIRO',
        accountPurpose: 'OPERATIONAL',
        status: 'ACTIVE',
        effectiveDate: '2026-01-01',
        expiryDate: null,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockInvoice, companyCode: 'UBD' })
        .mockResolvedValueOnce({ ...mockPrq, companyCode: 'UBD' })
        .mockResolvedValueOnce({ ...testPo900k, companyCode: 'UBD' })
        .mockResolvedValueOnce(mockCba);

      mockQueryRunner.manager.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ ...mockInvoice }])
        .mockResolvedValueOnce([]);

      const paymentDto = {
        invoiceId: 50,
        paymentRequestId: 101,
        companyBankAccountId: 1,
        amount: 500000,
        paymentDate: '2026-11-13',
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: 'REF-20261113-002',
      };

      const res = await service.createPayment(paymentDto, 1);
      expect(res).toBeDefined();

      const savedInv = savedRecords.find((r) => r.entityClass === Invoice || (r.target && r.target.invoiceNumber === 'INV-20261113-003'))?.target;
      expect(savedInv).toBeDefined();
      expect(savedInv.paymentStatus).toBe('PARTIALLY_PAID');
    });

    it('Scenario 12e: Service Invoice flow with approved Service Claim computes Gross Rp1,332,000 and Net Cash Rp1,308,000', async () => {
      const servicePo = {
        id: 30,
        poNumber: 'PO-SRV-001',
        status: 'ISSUED',
        orderType: 'SERVICE',
        totalAmount: 1200000,
        companyCode: 'UBD',
        vendorId: 5,
        vendor: { id: 5, name: 'PT Vendor Jasa', npwp: '0123456789012345' },
        items: [{ id: 301, purchaseOrderId: 30, itemName: 'Instalasi Jaringan', quantity: 1, unitPrice: 1200000 }],
        paymentTerms: [],
      };

      const serviceTerm = {
        id: 301,
        poId: 30,
        termName: 'Pelunasan Jasa',
        termType: PaymentTermType.FINAL_DELIVERY,
        percentage: 100,
        amount: 1200000,
        status: PaymentTermStatus.PENDING,
      };

      const mockClaim = {
        id: 401,
        poId: 30,
        vendorId: 5,
        status: 'APPROVED_FOR_INVOICE',
        approvedClaimAmount: 1200000,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...servicePo }) // PO
        .mockResolvedValueOnce(null) // inv num
        .mockResolvedValueOnce({ ...serviceTerm }) // Term
        .mockResolvedValueOnce(null) // active invoice
        .mockResolvedValueOnce(mockClaim) // ServiceClaim
        .mockResolvedValueOnce(null) // existing PPN
        .mockResolvedValueOnce({ id: 702, companyCode: 'UBD', taxPeriodYear: 2026, taxPeriodMonth: 11, taxRegime: 'PPH_23_SERVICE' })
        .mockResolvedValueOnce({ id: 802, regimeCode: 'PPH_23_SERVICE', taxCategory: 'PPH' })
        .mockResolvedValueOnce(null) // existing PPh
        .mockResolvedValueOnce(null); // existing tax detail

      const dto = {
        purchaseOrderId: 30,
        paymentTermId: 301,
        serviceClaimId: 401,
        invoiceDate: '2026-11-13',
        tax: {
          ppn: { fakturPajakNumber: '0100002612345678', ppnAmount: 132000, dppAmount: 1200000 },
          pph: { pphType: 'PPH_23_SERVICE', rate: 2.0, taxableBase: 1200000, withheldAmount: 24000 },
        },
      };

      const inv = await service.createInvoice(dto, 99);
      expect(inv.totalAmount).toBe(1200000);

      const taxDetail = savedRecords.find((r) => r.entityClass === InvoiceTaxDetail)?.target;
      expect(taxDetail).toBeDefined();
      expect(taxDetail.grossCommercialLiability).toBe(1332000); // 1.2M + 132k
      expect(taxDetail.pphWithholdingAmount).toBe(24000);
      expect(taxDetail.netVendorCashPayable).toBe(1308000); // 1.332M - 24k
    });

    it('Scenario 12f: Formula Matrix Invariants (No PPN, PPN Only, PPh Only, WAPU, Prior Deductions)', () => {
      const calcSettlement = (dpp: number, ppn: number, pph: number, wapu: number = 0, ded: number = 0) => {
        const gross = dpp + ppn;
        const netCash = gross - pph - wapu - ded;
        return { gross, netCash };
      };

      // 1. No PPN, No PPh: Cash = DPP
      expect(calcSettlement(900000, 0, 0)).toEqual({ gross: 900000, netCash: 900000 });

      // 2. PPN Only: Cash = DPP + PPN
      expect(calcSettlement(900000, 99000, 0)).toEqual({ gross: 999000, netCash: 999000 });

      // 3. PPh Only: Cash = DPP - PPh
      expect(calcSettlement(900000, 0, 9000)).toEqual({ gross: 900000, netCash: 891000 });

      // 4. PPN + PPh: Cash = DPP + PPN - PPh
      expect(calcSettlement(900000, 99000, 9000)).toEqual({ gross: 999000, netCash: 990000 });

      // 5. WAPU and PPh: Cash = DPP + PPN - PPh - WAPU
      expect(calcSettlement(900000, 99000, 9000, 99000)).toEqual({ gross: 999000, netCash: 891000 });

      // 6. Prior Deductions: Cash = DPP + PPN - PPh - Deductions
      expect(calcSettlement(900000, 99000, 9000, 0, 50000)).toEqual({ gross: 999000, netCash: 940000 });
    });
  });

  // 13. Post-Issuance Tax Data & Document Integrity (getInvoiceTaxDetails serialization & retrieval)
  describe('Scenario 13: Post-Issuance Tax Data & Document Integrity Retrieval', () => {
    it('Scenario 13a: getInvoiceTaxDetails returns canonical taxDetail, ppnRecords, and pphRecords from entity and snapshot', async () => {
      const mockInvoice = {
        id: 24,
        invoiceNumber: 'INV-20261113-003',
        companyCode: 'UBD',
        totalAmount: 900000,
        invoiceTaxDetail: {
          id: 3,
          invoiceId: 24,
          companyCode: 'UBD',
          dppCommercial: 900000,
          ppnRate: 0.11,
          ppnAmount: 99000,
          grossCommercialLiability: 999000,
          pphWithholdingAmount: 9000,
          netVendorCashPayable: 990000,
          taxRuleSnapshot: {
            ppn: {
              fakturPajakNumber: '4545645545354545',
              fakturPajakDate: '2026-11-16',
              dppAmount: 900000,
              ppnRate: 11,
              ppnAmount: 99000,
            },
            pph: {
              pphType: 'PPH_LAINNYA',
              rate: 1,
              taxableBase: 900000,
              withheldAmount: 9000,
              buktiPotongNumber: 'BP-2026-TEST',
              buktiPotongDate: '2026-11-16',
            },
          },
        },
        ppnMasukanRecords: [
          {
            id: 6,
            invoiceId: 24,
            fakturPajakNumber: '4545645545354545',
            fakturPajakDate: '2026-11-16',
            dppAmount: 900000,
            ppnAmount: 99000,
            creditabilityStatus: 'UNVERIFIED',
          },
        ],
        pphWithholdingRecords: [], // empty (administrative recording with custom regime)
      };

      jest.spyOn((service as any).invoiceRepository, 'findOne').mockResolvedValueOnce(mockInvoice as any);

      const res = await service.getInvoiceTaxDetails(24);

      expect(res).toBeDefined();
      expect(res.id).toBe(24);

      // Verify canonical taxDetail
      expect(res.taxDetail).toBeDefined();
      expect(res.taxDetail.fakturPajakNumber).toBe('4545645545354545');
      expect(res.taxDetail.fakturPajakDate).toBe('2026-11-16');
      expect(res.taxDetail.taxBasis).toBe(900000);
      expect(res.taxDetail.ppnRate).toBe(11);
      expect(res.taxDetail.ppnAmount).toBe(99000);
      expect(res.taxDetail.pphType).toBe('PPH_LAINNYA');
      expect(res.taxDetail.pphRate).toBe(1);
      expect(res.taxDetail.pphAmount).toBe(9000);
      expect(res.taxDetail.grossCommercialLiability).toBe(999000);
      expect(res.taxDetail.netVendorCashPayable).toBe(990000);
      expect(res.taxDetail.buktiPotongNumber).toBe('BP-2026-TEST');
      expect(res.taxDetail.buktiPotongDate).toBe('2026-11-16');

      // Verify ppnRecords array
      expect(res.ppnRecords).toHaveLength(1);
      expect(res.ppnRecords[0].fakturPajakNumber).toBe('4545645545354545');
      expect(res.ppnRecords[0].dppAmount).toBe(900000);
      expect(res.ppnRecords[0].ppnAmount).toBe(99000);

      // Verify synthesized pphRecords array from snapshot when DB records are empty
      expect(res.pphRecords).toHaveLength(1);
      expect(res.pphRecords[0].withholdingRate).toBe(1);
      expect(res.pphRecords[0].taxableBase).toBe(900000);
      expect(res.pphRecords[0].withheldAmount).toBe(9000);
      expect(res.pphRecords[0].pphRegime).toBe('PPH_LAINNYA');
      expect(res.pphRecords[0].buktiPotongNumber).toBe('BP-2026-TEST');
      expect(res.pphRecords[0].buktiPotongDate).toBe('2026-11-16');
    });

    it('Scenario 13b: getInvoiceTaxDetails returns null safely for nonexistent invoice', async () => {
      jest.spyOn((service as any).invoiceRepository, 'findOne').mockResolvedValueOnce(null);
      const res = await service.getInvoiceTaxDetails(99999);
      expect(res).toBeNull();
    });
  });

  // 14. Mandatory Tax Administration Field Validation & Verification Gate Matrix
  describe('Scenario 14: Mandatory PPN/PPh Tax Field Validation & Verification Gate', () => {
    const createMockInvoice = (taxOpts: {
      ppnAmount?: number;
      ppnRate?: number;
      nsfp?: string;
      fpDate?: string;
      pphAmount?: number;
      pphRate?: number;
      bpNum?: string;
      bpDate?: string;
    }) => {
      const {
        ppnAmount = 0,
        ppnRate = 0,
        nsfp,
        fpDate,
        pphAmount = 0,
        pphRate = 0,
        bpNum,
        bpDate,
      } = taxOpts;

      const hasTax = ppnAmount > 0 || pphAmount > 0;
      const inv: any = {
        id: 100,
        poId: 10,
        matchStatus: 'PENDING',
        totalAmount: 1000000,
        createdBy: 99,
        paymentTermId: 201,
        purchaseOrder: {
          id: 10,
          totalAmount: 1000000,
          vendorId: 5,
          status: 'COMPLETED',
          items: [{ id: 1, unitPrice: 1000000, receivedQuantity: 1 }],
        },
        paymentTerm: {
          id: 201,
          poId: 10,
          amount: 1000000,
          status: PaymentTermStatus.INVOICE_SUBMITTED,
          termType: PaymentTermType.FINAL_DELIVERY,
          sequence: 1,
          percentage: 100,
        },
        items: [{ id: 1, poItemId: 1, quantity: 1, unitPrice: 1000000, totalPrice: 1000000 }],
        payments: [],
      };

      if (hasTax) {
        inv.invoiceTaxDetail = {
          id: 50,
          invoiceId: 100,
          dppCommercial: 1000000,
          ppnAmount,
          ppnRate,
          pphWithholdingAmount: pphAmount,
          grossCommercialLiability: 1000000 + ppnAmount,
          netVendorCashPayable: 1000000 + ppnAmount - pphAmount,
          taxRuleSnapshot: {
            ppn: ppnAmount > 0 ? {
              ppnAmount,
              ppnRate,
              fakturPajakNumber: nsfp,
              fakturPajakDate: fpDate,
            } : undefined,
            pph: pphAmount > 0 ? {
              withheldAmount: pphAmount,
              rate: pphRate,
              buktiPotongNumber: bpNum,
              buktiPotongDate: bpDate,
            } : undefined,
          },
        };
      }

      return inv;
    };

    const setupVerifyMock = (mockInv: any) => {
      const gr = { id: 1, poId: 10, items: [{ poItemId: 1, receivedQuantity: 1 }] };
      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any) => {
        if (entity === Invoice) return mockInv;
        if (entity === PoPaymentTerm) return mockInv.paymentTerm;
        if (entity === InvoiceTaxDetail) return mockInv.invoiceTaxDetail || null;
        return null;
      });
      mockQueryRunner.manager.find.mockImplementation(async (entity: any) => {
        if (entity === GoodsReceipt) return [gr];
        return [];
      });
      mockQueryRunner.manager.save.mockImplementation(async (entityOrTarget: any, target?: any) => target || entityOrTarget);
    };

    // 1. PPN applicable, NSFP and invoice date complete: PASS
    it('1. PPN applicable, NSFP and invoice date complete: PASS', async () => {
      const mockInv = createMockInvoice({
        ppnAmount: 110000,
        ppnRate: 11,
        nsfp: '0100002612345678',
        fpDate: '2026-11-13',
      });
      setupVerifyMock(mockInv);

      const res = await service.verifyInvoice(100, { approved: true }, 99);
      expect(res.matchStatus).toBe('VERIFIED');
    });

    // 2. PPN applicable, NSFP missing: verification rejected
    it('2. PPN applicable, NSFP missing: verification rejected', async () => {
      const mockInv = createMockInvoice({
        ppnAmount: 110000,
        ppnRate: 11,
        nsfp: '',
        fpDate: '2026-11-13',
      });
      setupVerifyMock(mockInv);

      await expect(service.verifyInvoice(100, { approved: true }, 99)).rejects.toThrow(
        'Nomor Faktur Pajak (NSFP) wajib diisi.'
      );
    });

    // 3. PPN applicable, invoice date missing: verification rejected
    it('3. PPN applicable, invoice date missing: verification rejected', async () => {
      const mockInv = createMockInvoice({
        ppnAmount: 110000,
        ppnRate: 11,
        nsfp: '0100002612345678',
        fpDate: '',
      });
      setupVerifyMock(mockInv);

      await expect(service.verifyInvoice(100, { approved: true }, 99)).rejects.toThrow(
        'Tanggal Faktur Pajak wajib diisi.'
      );
    });

    // 4. NSFP shorter than 16 digits: rejected
    it('4. NSFP shorter than 16 digits: rejected', async () => {
      const mockInv = createMockInvoice({
        ppnAmount: 110000,
        ppnRate: 11,
        nsfp: '010000261234567', // 15 digits
        fpDate: '2026-11-13',
      });
      setupVerifyMock(mockInv);

      await expect(service.verifyInvoice(100, { approved: true }, 99)).rejects.toThrow(
        'Nomor Faktur Pajak (NSFP) harus terdiri dari 16 digit angka.'
      );
    });

    // 5. NSFP longer than 16 digits: rejected
    it('5. NSFP longer than 16 digits: rejected', async () => {
      const mockInv = createMockInvoice({
        ppnAmount: 110000,
        ppnRate: 11,
        nsfp: '01000026123456789', // 17 digits
        fpDate: '2026-11-13',
      });
      setupVerifyMock(mockInv);

      await expect(service.verifyInvoice(100, { approved: true }, 99)).rejects.toThrow(
        'Nomor Faktur Pajak (NSFP) harus terdiri dari 16 digit angka.'
      );
    });

    // 6. NSFP containing non-numeric characters: rejected
    it('6. NSFP containing non-numeric characters: rejected', async () => {
      const mockInv = createMockInvoice({
        ppnAmount: 110000,
        ppnRate: 11,
        nsfp: '010.000-26.ABCDEF78',
        fpDate: '2026-11-13',
      });
      setupVerifyMock(mockInv);

      await expect(service.verifyInvoice(100, { approved: true }, 99)).rejects.toThrow(
        'Nomor Faktur Pajak (NSFP) harus terdiri dari 16 digit angka.'
      );
    });

    // 7. Invalid invoice date: rejected
    it('7. Invalid invoice date: rejected', async () => {
      const mockInv = createMockInvoice({
        ppnAmount: 110000,
        ppnRate: 11,
        nsfp: '0100002612345678',
        fpDate: 'invalid-date',
      });
      setupVerifyMock(mockInv);

      await expect(service.verifyInvoice(100, { approved: true }, 99)).rejects.toThrow(
        'Tanggal Faktur Pajak tidak valid.'
      );
    });

    // 8. PPh applicable, BPU number and date complete: PASS
    it('8. PPh applicable, BPU number and date complete: PASS', async () => {
      const mockInv = createMockInvoice({
        pphAmount: 20000,
        pphRate: 2,
        bpNum: 'BP-2026-001',
        bpDate: '2026-11-13',
      });
      setupVerifyMock(mockInv);

      const res = await service.verifyInvoice(100, { approved: true }, 99);
      expect(res.matchStatus).toBe('VERIFIED');
    });

    // 9. PPh applicable, BPU number missing: verification rejected
    it('9. PPh applicable, BPU number missing: verification rejected', async () => {
      const mockInv = createMockInvoice({
        pphAmount: 20000,
        pphRate: 2,
        bpNum: '',
        bpDate: '2026-11-13',
      });
      setupVerifyMock(mockInv);

      await expect(service.verifyInvoice(100, { approved: true }, 99)).rejects.toThrow(
        'Nomor Bukti Potong wajib diisi.'
      );
    });

    // 10. PPh applicable, BPU date missing: verification rejected
    it('10. PPh applicable, BPU date missing: verification rejected', async () => {
      const mockInv = createMockInvoice({
        pphAmount: 20000,
        pphRate: 2,
        bpNum: 'BP-2026-001',
        bpDate: '',
      });
      setupVerifyMock(mockInv);

      await expect(service.verifyInvoice(100, { approved: true }, 99)).rejects.toThrow(
        'Tanggal Bukti Potong wajib diisi.'
      );
    });

    // 11. Invalid BPU date: rejected
    it('11. Invalid BPU date: rejected', async () => {
      const mockInv = createMockInvoice({
        pphAmount: 20000,
        pphRate: 2,
        bpNum: 'BP-2026-001',
        bpDate: 'invalid-date',
      });
      setupVerifyMock(mockInv);

      await expect(service.verifyInvoice(100, { approved: true }, 99)).rejects.toThrow(
        'Tanggal Bukti Potong tidak valid.'
      );
    });

    // 12. Independent tax scenario: PPN only enforces only PPN fields
    it('12. Independent tax scenario: PPN only enforces only PPN fields (BPU optional)', async () => {
      const mockInv = createMockInvoice({
        ppnAmount: 110000,
        ppnRate: 11,
        nsfp: '0100002612345678',
        fpDate: '2026-11-13',
        // PPh not applicable (pphAmount: 0)
      });
      setupVerifyMock(mockInv);

      const res = await service.verifyInvoice(100, { approved: true }, 99);
      expect(res.matchStatus).toBe('VERIFIED');
    });

    // 13. Independent tax scenario: PPh only enforces only PPh fields
    it('13. Independent tax scenario: PPh only enforces only PPh fields (NSFP optional)', async () => {
      const mockInv = createMockInvoice({
        pphAmount: 20000,
        pphRate: 2,
        bpNum: 'BP-2026-001',
        bpDate: '2026-11-13',
        // PPN not applicable (ppnAmount: 0)
      });
      setupVerifyMock(mockInv);

      const res = await service.verifyInvoice(100, { approved: true }, 99);
      expect(res.matchStatus).toBe('VERIFIED');
    });

    // 14. Independent tax scenario: No PPN and no PPh leaves all four fields optional
    it('14. Independent tax scenario: No PPN and no PPh leaves all four fields optional', async () => {
      const mockInv = createMockInvoice({
        ppnAmount: 0,
        pphAmount: 0,
      });
      setupVerifyMock(mockInv);

      const res = await service.verifyInvoice(100, { approved: true }, 99);
      expect(res.matchStatus).toBe('VERIFIED');
    });

    // 15. Workflow gate: Payment Request blocked before successful required verification
    it('15. Payment Request blocked before successful required verification (unverified invoice)', async () => {
      const unverifiedInv: any = {
        id: 200,
        poId: 10,
        matchStatus: 'PENDING', // Unverified
        totalAmount: 1000000,
        paymentStatus: 'UNPAID',
        paymentTermId: 201,
        purchaseOrder: { id: 10, vendorId: 5, totalAmount: 1000000, vendor: { id: 5 } },
        paymentTerm: { id: 201, poId: 10, amount: 1000000, status: PaymentTermStatus.INVOICE_SUBMITTED },
      };

      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any) => {
        if (entity === Invoice) return unverifiedInv;
        return null;
      });

      await expect(
        service.submitPaymentRequest({ invoiceId: 200, requestedAmount: 1000000 }, 99)
      ).rejects.toThrow('Hanya invoice VERIFIED atau MATCHED yang dapat diajukan pembayarannya.');
    });

    // 16. Completed tax information allows verification, subject to all other existing controls
    it('16. Completed tax information allows verification subject to existing controls (dual tax)', async () => {
      const mockInv = createMockInvoice({
        ppnAmount: 110000,
        ppnRate: 11,
        nsfp: '0100002612345678',
        fpDate: '2026-11-13',
        pphAmount: 20000,
        pphRate: 2,
        bpNum: 'BP-2026-001',
        bpDate: '2026-11-13',
      });
      setupVerifyMock(mockInv);

      const res = await service.verifyInvoice(100, { approved: true }, 99);
      expect(res.matchStatus).toBe('VERIFIED');
      expect(res.paymentTerm.status).toBe(PaymentTermStatus.VERIFIED);
    });
  });

  // 15. Critical Payment Request Tax Settlement Integration Suite (Mandate Verification)
  describe('Scenario 15: Critical Payment Request Tax Settlement Integration Suite', () => {
    const basePo900k = {
      id: 24,
      poNumber: 'PO-20261113-003',
      orderType: 'MATERIAL',
      totalAmount: 900000,
      vendor: { id: 10, name: 'PT Vendor Solusi' },
    };

    const baseTerm900k = {
      id: 24,
      poId: 24,
      termName: 'Pelunasan Penuh',
      amount: 900000,
      status: PaymentTermStatus.VERIFIED,
    };

    // 1. Tax-exclusive DPP Rp900,000, PPN Rp99,000, PPh Rp9,000: request Rp990,000 accepted
    it('1. Tax-exclusive DPP Rp900,000, PPN Rp99,000, PPh Rp9,000: request Rp990,000 accepted', async () => {
      const itd = {
        id: 3,
        invoiceId: 24,
        dppCommercial: 900000,
        ppnAmount: 99000,
        grossCommercialLiability: 999000,
        pphWithholdingAmount: 9000,
        wapuPpnWithheldAmount: 0,
        priorDeductionsAmount: 0,
        netVendorCashPayable: 990000,
      };

      const inv = {
        id: 24,
        invoiceNumber: 'INV-20261113-003',
        poId: 24,
        paymentTermId: 24,
        totalAmount: 900000,
        matchStatus: 'VERIFIED',
        paymentStatus: 'UNPAID',
        invoiceTaxDetail: itd,
        paymentTerm: baseTerm900k,
        purchaseOrder: basePo900k,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...inv }) // lock invoice
        .mockResolvedValueOnce(null); // active request check
      mockQueryRunner.manager.find.mockResolvedValueOnce([]); // no existing payments

      const prq = await service.submitPaymentRequest({ invoiceId: 24, requestedAmount: 990000 }, 1);
      expect(prq).toBeDefined();
      expect(prq.requestedAmount).toBe(990000);
      expect(prq.status).toBe(PaymentRequestStatus.PENDING_DIRECTOR_APPROVAL);
    });

    // 2. Request Rp999,000 rejected when PPh Rp9,000 is withheld
    it('2. Request Rp999,000 rejected when PPh Rp9,000 is withheld', async () => {
      const itd = {
        id: 3,
        invoiceId: 24,
        dppCommercial: 900000,
        ppnAmount: 99000,
        grossCommercialLiability: 999000,
        pphWithholdingAmount: 9000,
        wapuPpnWithheldAmount: 0,
        priorDeductionsAmount: 0,
        netVendorCashPayable: 990000,
      };

      const inv = {
        id: 24,
        invoiceNumber: 'INV-20261113-003',
        poId: 24,
        paymentTermId: 24,
        totalAmount: 900000,
        matchStatus: 'VERIFIED',
        paymentStatus: 'UNPAID',
        invoiceTaxDetail: itd,
        paymentTerm: baseTerm900k,
        purchaseOrder: basePo900k,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...inv })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);

      await expect(
        service.submitPaymentRequest({ invoiceId: 24, requestedAmount: 999000 }, 1)
      ).rejects.toThrow('melebihi sisa kas bersih yang dapat dibayarkan ke vendor (Rp 990.000)');
    });

    // 3. Request exceeding Rp990,000 rejected
    it('3. Request exceeding Rp990,000 (Rp 1,000,000) rejected', async () => {
      const itd = {
        id: 3,
        invoiceId: 24,
        dppCommercial: 900000,
        ppnAmount: 99000,
        grossCommercialLiability: 999000,
        pphWithholdingAmount: 9000,
        netVendorCashPayable: 990000,
      };

      const inv = {
        id: 24,
        invoiceNumber: 'INV-20261113-003',
        poId: 24,
        paymentTermId: 24,
        totalAmount: 900000,
        matchStatus: 'VERIFIED',
        paymentStatus: 'UNPAID',
        invoiceTaxDetail: itd,
        paymentTerm: baseTerm900k,
        purchaseOrder: basePo900k,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...inv })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);

      await expect(
        service.submitPaymentRequest({ invoiceId: 24, requestedAmount: 1000000 }, 1)
      ).rejects.toThrow('melebihi sisa kas bersih yang dapat dibayarkan ke vendor (Rp 990.000)');
    });

    // 4. PPN-only transaction: request Rp999,000 accepted; request Rp1,000,000 rejected
    it('4. PPN-only transaction: request Rp999,000 accepted; request Rp1,000,000 rejected', async () => {
      const itd = {
        id: 4,
        invoiceId: 25,
        dppCommercial: 900000,
        ppnAmount: 99000,
        grossCommercialLiability: 999000,
        pphWithholdingAmount: 0,
        wapuPpnWithheldAmount: 0,
        priorDeductionsAmount: 0,
        netVendorCashPayable: 999000,
      };

      const inv = {
        id: 25,
        invoiceNumber: 'INV-2026-PPN-ONLY',
        poId: 24,
        paymentTermId: 24,
        totalAmount: 900000,
        matchStatus: 'VERIFIED',
        paymentStatus: 'UNPAID',
        invoiceTaxDetail: itd,
        paymentTerm: baseTerm900k,
        purchaseOrder: basePo900k,
      };

      // 4a. 999,000 accepted
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...inv })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);

      const prq = await service.submitPaymentRequest({ invoiceId: 25, requestedAmount: 999000 }, 1);
      expect(prq.requestedAmount).toBe(999000);

      // 4b. 1,000,000 rejected
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...inv })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);

      await expect(
        service.submitPaymentRequest({ invoiceId: 25, requestedAmount: 1000000 }, 1)
      ).rejects.toThrow('melebihi sisa kas bersih yang dapat dibayarkan ke vendor (Rp 999.000)');
    });

    // 5. PPh-only transaction: request Rp882,000 accepted; request Rp900,000 rejected
    it('5. PPh-only transaction: request Rp882,000 accepted; request Rp900,000 rejected', async () => {
      const itd = {
        id: 5,
        invoiceId: 26,
        dppCommercial: 900000,
        ppnAmount: 0,
        grossCommercialLiability: 900000,
        pphWithholdingAmount: 18000,
        wapuPpnWithheldAmount: 0,
        priorDeductionsAmount: 0,
        netVendorCashPayable: 882000,
      };

      const inv = {
        id: 26,
        invoiceNumber: 'INV-2026-PPH-ONLY',
        poId: 24,
        paymentTermId: 24,
        totalAmount: 900000,
        matchStatus: 'VERIFIED',
        paymentStatus: 'UNPAID',
        invoiceTaxDetail: itd,
        paymentTerm: baseTerm900k,
        purchaseOrder: basePo900k,
      };

      // 5a. 882,000 accepted
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...inv })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);

      const prq = await service.submitPaymentRequest({ invoiceId: 26, requestedAmount: 882000 }, 1);
      expect(prq.requestedAmount).toBe(882000);

      // 5b. 900,000 rejected
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...inv })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);

      await expect(
        service.submitPaymentRequest({ invoiceId: 26, requestedAmount: 900000 }, 1)
      ).rejects.toThrow('melebihi sisa kas bersih yang dapat dibayarkan ke vendor (Rp 882.000)');
    });

    // 6. No-tax transaction: request Rp900,000 accepted; request Rp950,000 rejected
    it('6. No-tax transaction: request Rp900,000 accepted; request Rp950,000 rejected', async () => {
      const inv = {
        id: 27,
        invoiceNumber: 'INV-2026-NO-TAX',
        poId: 24,
        paymentTermId: 24,
        totalAmount: 900000,
        matchStatus: 'VERIFIED',
        paymentStatus: 'UNPAID',
        invoiceTaxDetail: null,
        paymentTerm: baseTerm900k,
        purchaseOrder: basePo900k,
      };

      // 6a. 900,000 accepted
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...inv })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);

      const prq = await service.submitPaymentRequest({ invoiceId: 27, requestedAmount: 900000 }, 1);
      expect(prq.requestedAmount).toBe(900000);

      // 6b. 950,000 rejected
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...inv })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);

      await expect(
        service.submitPaymentRequest({ invoiceId: 27, requestedAmount: 950000 }, 1)
      ).rejects.toThrow('melebihi sisa kas bersih yang dapat dibayarkan ke vendor (Rp 900.000)');
    });

    // 7. Partial Payment Request on non-term invoice
    it('7. Partial Payment Request on non-term invoice: request Rp500,000 accepted', async () => {
      const itd = {
        id: 6,
        invoiceId: 28,
        dppCommercial: 900000,
        ppnAmount: 99000,
        grossCommercialLiability: 999000,
        pphWithholdingAmount: 9000,
        netVendorCashPayable: 990000,
      };

      const inv = {
        id: 28,
        invoiceNumber: 'INV-2026-PARTIAL',
        poId: 24,
        paymentTermId: null, // Non-term invoice allows partial requests
        totalAmount: 900000,
        matchStatus: 'VERIFIED',
        paymentStatus: 'UNPAID',
        invoiceTaxDetail: itd,
        purchaseOrder: basePo900k,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...inv })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);

      const prq = await service.submitPaymentRequest({ invoiceId: 28, requestedAmount: 500000 }, 1);
      expect(prq.requestedAmount).toBe(500000);
    });

    // 8. Previous cash payment on invoice
    it('8. Previous cash payment on invoice: remaining net payable Rp490,000 accepted, Rp500,000 rejected', async () => {
      const itd = {
        id: 7,
        invoiceId: 29,
        dppCommercial: 900000,
        ppnAmount: 99000,
        grossCommercialLiability: 999000,
        pphWithholdingAmount: 9000,
        netVendorCashPayable: 990000,
      };

      const inv = {
        id: 29,
        invoiceNumber: 'INV-2026-PREV-PAID',
        poId: 24,
        paymentTermId: null,
        totalAmount: 900000,
        matchStatus: 'VERIFIED',
        paymentStatus: 'PARTIALLY_PAID',
        invoiceTaxDetail: itd,
        purchaseOrder: basePo900k,
      };

      const existingPmt = [{ id: 88, invoiceId: 29, amount: 500000, deletedAt: null }];

      // 8a. 490,000 accepted
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...inv })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.find.mockResolvedValueOnce(existingPmt);

      const prq = await service.submitPaymentRequest({ invoiceId: 29, requestedAmount: 490000 }, 1);
      expect(prq.requestedAmount).toBe(490000);

      // 8b. 500,000 rejected
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...inv })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.find.mockResolvedValueOnce(existingPmt);

      await expect(
        service.submitPaymentRequest({ invoiceId: 29, requestedAmount: 500000 }, 1)
      ).rejects.toThrow('melebihi sisa kas bersih yang dapat dibayarkan ke vendor (Rp 490.000)');
    });

    // 9. Previous PPh and WAPU deductions (PPh 9k, WAPU 99k)
    it('9. Previous PPh and WAPU deductions: request Rp891,000 accepted, Rp990,000 rejected', async () => {
      const itd = {
        id: 8,
        invoiceId: 30,
        dppCommercial: 900000,
        ppnAmount: 99000,
        grossCommercialLiability: 999000,
        pphWithholdingAmount: 9000,
        wapuPpnWithheldAmount: 99000, // WAPU withheld
        priorDeductionsAmount: 0,
        netVendorCashPayable: 891000, // 999k - 9k - 99k = 891k
      };

      const inv = {
        id: 30,
        invoiceNumber: 'INV-2026-WAPU',
        poId: 24,
        paymentTermId: 24,
        totalAmount: 900000,
        matchStatus: 'VERIFIED',
        paymentStatus: 'UNPAID',
        invoiceTaxDetail: itd,
        paymentTerm: baseTerm900k,
        purchaseOrder: basePo900k,
      };

      // 9a. 891,000 accepted
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...inv })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);

      const prq = await service.submitPaymentRequest({ invoiceId: 30, requestedAmount: 891000 }, 1);
      expect(prq.requestedAmount).toBe(891000);

      // 9b. 990,000 rejected
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...inv })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);

      await expect(
        service.submitPaymentRequest({ invoiceId: 30, requestedAmount: 990000 }, 1)
      ).rejects.toThrow('melebihi sisa kas bersih yang dapat dibayarkan ke vendor (Rp 891.000)');
    });

    // 10. Material invoice target transaction flow
    it('10. Material invoice target transaction flow: PO-20261113-003 / INV-20261113-003', async () => {
      const itd = {
        id: 3,
        invoiceId: 24,
        dppCommercial: 900000,
        ppnAmount: 99000,
        grossCommercialLiability: 999000,
        pphWithholdingAmount: 9000,
        wapuPpnWithheldAmount: 0,
        priorDeductionsAmount: 0,
        netVendorCashPayable: 990000,
      };

      const inv = {
        id: 24,
        invoiceNumber: 'INV-20261113-003',
        poId: 24,
        paymentTermId: 24,
        totalAmount: 900000,
        matchStatus: 'VERIFIED',
        paymentStatus: 'UNPAID',
        invoiceTaxDetail: itd,
        paymentTerm: baseTerm900k,
        purchaseOrder: { ...basePo900k, orderType: 'MATERIAL' },
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...inv })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);

      const prq = await service.submitPaymentRequest({ invoiceId: 24, requestedAmount: 990000 }, 1);
      expect(prq.requestedAmount).toBe(990000);
      expect(prq.approvalSnapshot.dppAmount).toBe(900000);
      expect(prq.approvalSnapshot.ppnAmount).toBe(99000);
      expect(prq.approvalSnapshot.grossAmount).toBe(999000);
      expect(prq.approvalSnapshot.pphAmount).toBe(9000);
      expect(prq.approvalSnapshot.netPayableAmount).toBe(990000);
    });

    // 11. Service invoice flow with approved Service Claim
    it('11. Service invoice flow: DPP 1.2M, PPN 132k, PPh 24k -> Net Cash 1.308M accepted, 1.332M rejected', async () => {
      const servicePo = {
        id: 35,
        poNumber: 'PO-SRV-2026-001',
        orderType: 'SERVICE',
        totalAmount: 1200000,
        vendor: { id: 12, name: 'PT Layanan Jasa' },
      };

      const serviceTerm = {
        id: 35,
        poId: 35,
        termName: 'Pelunasan Jasa',
        amount: 1200000,
        status: PaymentTermStatus.VERIFIED,
      };

      const itd = {
        id: 9,
        invoiceId: 35,
        dppCommercial: 1200000,
        ppnAmount: 132000, // 11%
        grossCommercialLiability: 1332000,
        pphWithholdingAmount: 24000, // 2%
        wapuPpnWithheldAmount: 0,
        priorDeductionsAmount: 0,
        netVendorCashPayable: 1308000, // 1.332M - 24k = 1.308M
      };

      const inv = {
        id: 35,
        invoiceNumber: 'INV-SRV-2026-001',
        poId: 35,
        paymentTermId: 35,
        totalAmount: 1200000,
        matchStatus: 'VERIFIED',
        paymentStatus: 'UNPAID',
        invoiceTaxDetail: itd,
        paymentTerm: serviceTerm,
        purchaseOrder: servicePo,
      };

      // 11a. 1,308,000 accepted
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...inv })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);

      const prq = await service.submitPaymentRequest({ invoiceId: 35, requestedAmount: 1308000 }, 1);
      expect(prq.requestedAmount).toBe(1308000);

      // 11b. 1,332,000 rejected
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...inv })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);

      await expect(
        service.submitPaymentRequest({ invoiceId: 35, requestedAmount: 1332000 }, 1)
      ).rejects.toThrow('melebihi sisa kas bersih yang dapat dibayarkan ke vendor (Rp 1.308.000)');
    });

    // 12. Approval Snapshot transparency
    it('12. Approval Snapshot preserves complete financial breakdown for Director review', async () => {
      const itd = {
        id: 3,
        invoiceId: 24,
        dppCommercial: 900000,
        ppnAmount: 99000,
        grossCommercialLiability: 999000,
        pphWithholdingAmount: 9000,
        wapuPpnWithheldAmount: 0,
        priorDeductionsAmount: 0,
        netVendorCashPayable: 990000,
      };

      const inv = {
        id: 24,
        invoiceNumber: 'INV-20261113-003',
        poId: 24,
        paymentTermId: 24,
        totalAmount: 900000,
        matchStatus: 'VERIFIED',
        paymentStatus: 'UNPAID',
        invoiceTaxDetail: itd,
        paymentTerm: baseTerm900k,
        purchaseOrder: basePo900k,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...inv })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);

      const prq = await service.submitPaymentRequest({
        invoiceId: 24,
        requestedAmount: 990000,
        bankName: 'Bank BCA',
        bankAccountNumber: '0987654321',
        bankAccountHolder: 'PT Vendor Solusi',
      }, 1);

      expect(prq.approvalSnapshot).toBeDefined();
      expect(prq.approvalSnapshot.dppAmount).toBe(900000);
      expect(prq.approvalSnapshot.ppnAmount).toBe(99000);
      expect(prq.approvalSnapshot.grossAmount).toBe(999000);
      expect(prq.approvalSnapshot.pphAmount).toBe(9000);
      expect(prq.approvalSnapshot.netPayableAmount).toBe(990000);
      expect(prq.approvalSnapshot.vendorBankName).toBe('Bank BCA');
      expect(prq.approvalSnapshot.vendorBankAccount).toBe('0987654321');
    });

    // 13. Stale snapshot version mismatch prevents Director approval
    it('13. Director approval rejects stale approval snapshot when invoice version has changed', async () => {
      const prq = {
        id: 701,
        invoiceId: 24,
        status: PaymentRequestStatus.PENDING_DIRECTOR_APPROVAL,
        requestedAmount: 990000,
        approvalSnapshot: {
          invoiceId: 24,
          invoiceVersion: 2,
          requestedAmount: 990000,
        },
        invoice: {
          id: 24,
          version: 3, // Invoice was updated after PRQ was submitted!
        },
      };

      mockQueryRunner.manager.findOne.mockResolvedValueOnce(prq);

      await expect(
        service.decidePaymentRequest(
          701,
          { action: DirectorDecisionAction.APPROVE, approvedAmount: 990000 },
          2
        )
      ).rejects.toThrow('Terdeteksi perubahan data invoice (versi 3) setelah pengajuan pembayaran dibuat (versi snapshot 2)');
    });

    // 14. Matching snapshot version permits Director approval
    it('14. Director approval succeeds when snapshot version matches current invoice version', async () => {
      const prq = {
        id: 702,
        invoiceId: 24,
        status: PaymentRequestStatus.PENDING_DIRECTOR_APPROVAL,
        requestedAmount: 990000,
        approvalSnapshot: {
          invoiceId: 24,
          invoiceVersion: 2,
          requestedAmount: 990000,
        },
        invoice: {
          id: 24,
          version: 2, // Versions match!
        },
      };

      mockQueryRunner.manager.findOne.mockResolvedValueOnce(prq);
      mockQueryRunner.manager.save.mockImplementation(async (a: any, b: any) => {
        const ent = b || a;
        return { ...ent, id: ent?.id || 702 };
      });
      jest.spyOn(service, 'getPaymentRequestById').mockImplementation(async (id: number) => ({
        ...prq,
        id,
        status: PaymentRequestStatus.APPROVED_FOR_PAYMENT,
        approvedAmount: 990000,
        approvedBy: 2,
      } as any));

      const approvedPrq = await service.decidePaymentRequest(
        702,
        { action: DirectorDecisionAction.APPROVE, approvedAmount: 990000 },
        2
      );

      expect(approvedPrq.status).toBe(PaymentRequestStatus.APPROVED_FOR_PAYMENT);
      expect(approvedPrq.approvedAmount).toBe(990000);
      expect(approvedPrq.approvedBy).toBe(2);
    });
  });

  // 16. Payment Execution & Settlement Control Suite (Section 11 Matrix)
  describe('Scenario 16: Payment Execution & Settlement Control Suite', () => {
    const basePo = {
      id: 24,
      poNumber: 'PO-20261113-003',
      orderType: 'MATERIAL',
      totalAmount: 900000,
      companyCode: 'UBD',
      vendor: { id: 4, name: 'PT Suplai Makmur', code: 'VND-004', bankAccount: '123-456-7890' },
      deletedAt: null,
    };

    const baseTerm = {
      id: 24,
      poId: 24,
      termName: 'Pelunasan Penuh',
      amount: 900000,
      status: PaymentTermStatus.VERIFIED,
      deletedAt: null,
    };

    const baseItd = {
      id: 3,
      invoiceId: 24,
      companyCode: 'UBD',
      dppCommercial: 900000,
      ppnAmount: 99000,
      grossCommercialLiability: 999000,
      pphWithholdingAmount: 9000,
      wapuPpnWithheldAmount: 0,
      priorDeductionsAmount: 0,
      netVendorCashPayable: 990000,
    };

    const baseInvoice = {
      id: 24,
      invoiceNumber: 'INV-20261113-003',
      companyCode: 'UBD',
      poId: 24,
      paymentTermId: 24,
      totalAmount: 900000,
      matchStatus: 'VERIFIED',
      paymentStatus: 'UNPAID',
      version: 2,
      invoiceTaxDetail: baseItd,
      paymentTerm: baseTerm,
      purchaseOrder: basePo,
      deletedAt: null,
    };

    const basePrq = {
      id: 24,
      requestNumber: 'PRQ-20261115-001',
      invoiceId: 24,
      companyCode: 'UBD',
      paymentTermId: 24,
      status: PaymentRequestStatus.APPROVED_FOR_PAYMENT,
      approvedAmount: 990000,
      approvedBy: 2, // Director
      requestedAmount: 990000,
      approvalSnapshot: {
        invoiceId: 24,
        invoiceVersion: 2,
        vendorBankName: 'Bank Mandiri',
        vendorBankAccount: '123-456-7890',
        vendorBankAccountHolder: 'PT Suplai Makmur',
        dppAmount: 900000,
        ppnAmount: 99000,
        grossAmount: 999000,
        pphAmount: 9000,
        netPayableAmount: 990000,
      },
      deletedAt: null,
    };

    const mockCba = {
      id: 1,
      companyCode: 'UBD',
      bankName: 'Bank Mandiri',
      accountNumber: '1234567890',
      accountHolderName: 'PT Utama Bangun Dananjaya',
      accountType: 'GIRO',
      accountPurpose: 'OPERATIONAL',
      status: 'ACTIVE',
      effectiveDate: '2026-01-01',
      expiryDate: null,
    };

    const setupExecutionMocks = (overrides: {
      invoice?: any;
      prq?: any;
      term?: any;
      existingPayments?: any[];
    } = {}) => {
      const inv = overrides.invoice !== undefined ? overrides.invoice : { ...baseInvoice };
      const prq = overrides.prq !== undefined ? overrides.prq : { ...basePrq };
      const term = overrides.term !== undefined ? overrides.term : { ...baseTerm };
      const existingPayments = overrides.existingPayments || [];

      mockQueryRunner.manager.findOne.mockImplementation(async (entityClass: any) => {
        if (entityClass === Invoice) return inv;
        if (entityClass === PaymentRequest) return prq;
        if (entityClass === PoPaymentTerm) return term;
        if (entityClass === PurchaseOrder) return basePo;
        if (entityClass === CompanyBankAccount) return mockCba;
        if (entityClass === AuditLog) return null;
        if (entityClass === Payment) return null;
        return null;
      });

      mockQueryRunner.manager.find.mockImplementation(async (entityClass: any) => {
        if (entityClass === Payment) return existingPayments;
        if (entityClass === Invoice) return [inv];
        if (entityClass === PoPaymentTerm) return [term];
        return [];
      });

      mockQueryRunner.manager.count.mockResolvedValue(0);
      mockQueryRunner.manager.save.mockImplementation(async (a: any, b: any) => {
        const ent = b || a;
        return { ...ent, id: ent?.id || 1 };
      });
      mockQueryRunner.manager.create.mockImplementation((entityClass: any, data: any) => data);
    };

    // 1. Authoritative Reference Transaction Execution (Rp990,000 cash transfer)
    it('1. Reference Transaction (PO-20261113-003): Cash Rp990,000 executes successfully and marks invoice PAID', async () => {
      setupExecutionMocks();

      const result = await service.createPayment(
        {
          invoiceId: 24,
          paymentRequestId: 24,
          companyBankAccountId: 1,
          paymentDate: '2026-11-15T12:00:00Z',
          paymentAmount: 990000,
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: 'TRX-20261115-001',
          bankName: 'Bank Mandiri (Operasional PT UBD)',
        },
        3 // Finance user
      );

      expect(result).toBeDefined();
      expect(result.amount).toBe(990000);
      expect((result as any).paymentStatus).toBe('PAID');
      expect((result as any).isFullyPaid).toBe(true);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    // 2. Payment execution rejected if Payment Request is not approved
    it('2. Payment execution rejected if Payment Request is not approved', async () => {
      const pendingPrq = { ...basePrq, status: PaymentRequestStatus.PENDING_DIRECTOR_APPROVAL };
      setupExecutionMocks({ prq: pendingPrq });

      await expect(
        service.createPayment(
          {
            invoiceId: 24,
            paymentRequestId: 24,
            companyBankAccountId: 1,
            paymentDate: '2026-11-15T12:00:00Z',
            paymentAmount: 990000,
            paymentMethod: 'BANK_TRANSFER',
            referenceNumber: 'TRX-20261115-001',
          },
          3
        )
      ).rejects.toThrow('Pembayaran ditolak: Payment Request belum disetujui oleh Direktur (APPROVED_FOR_PAYMENT).');
    });

    // 3. Payment amount exceeding approved amount rejected
    it('3. Payment amount exceeding Director approved amount (e.g. attempting gross Rp999,000) rejected', async () => {
      setupExecutionMocks();

      await expect(
        service.createPayment(
          {
            invoiceId: 24,
            paymentRequestId: 24,
            companyBankAccountId: 1,
            paymentDate: '2026-11-15T12:00:00Z',
            paymentAmount: 999000,
            paymentMethod: 'BANK_TRANSFER',
            referenceNumber: 'TRX-20261115-001',
          },
          3
        )
      ).rejects.toThrow('melebihi nominal yang disetujui Direktur (990000)');
    });

    // 4. Stale approval snapshot version blocks payment execution
    it('4. Stale approval snapshot (invoice version changed after approval) blocks payment execution', async () => {
      const updatedInvoice = { ...baseInvoice, version: 3 }; // Invoice modified!
      const stalePrq = { ...basePrq, approvalSnapshot: { ...basePrq.approvalSnapshot, invoiceVersion: 2 } };
      setupExecutionMocks({ invoice: updatedInvoice, prq: stalePrq });

      await expect(
        service.createPayment(
          {
            invoiceId: 24,
            paymentRequestId: 24,
            companyBankAccountId: 1,
            paymentDate: '2026-11-15T12:00:00Z',
            paymentAmount: 990000,
            paymentMethod: 'BANK_TRANSFER',
            referenceNumber: 'TRX-20261115-001',
          },
          3
        )
      ).rejects.toThrow('Terdeteksi perubahan data invoice (versi 3) setelah persetujuan Direktur diberikan (versi snapshot 2)');
    });

    // 5. Missing vendor destination bank account blocks payment execution
    it('5. Missing vendor destination bank account blocks payment execution', async () => {
      const missingBankPrq = {
        ...basePrq,
        approvalSnapshot: { ...basePrq.approvalSnapshot, vendorBankAccount: '' },
      };
      setupExecutionMocks({ prq: missingBankPrq });

      await expect(
        service.createPayment(
          {
            invoiceId: 24,
            paymentRequestId: 24,
            companyBankAccountId: 1,
            paymentDate: '2026-11-15T12:00:00Z',
            paymentAmount: 990000,
            paymentMethod: 'BANK_TRANSFER',
            referenceNumber: 'TRX-20261115-001',
          },
          3
        )
      ).rejects.toThrow('Rekening bank tujuan vendor tidak ditemukan atau belum terdaftar pada master data / snapshot persetujuan.');
    });

    // 6. Missing reference number for bank transfer rejected
    it('6. Missing reference number for bank transfer rejected', async () => {
      setupExecutionMocks();

      await expect(
        service.createPayment(
          {
            invoiceId: 24,
            paymentRequestId: 24,
            companyBankAccountId: 1,
            paymentDate: '2026-11-15T12:00:00Z',
            paymentAmount: 990000,
            paymentMethod: 'BANK_TRANSFER',
            referenceNumber: '',
          },
          3
        )
      ).rejects.toThrow('Nomor referensi transaksi / bukti transfer wajib diisi untuk metode transfer bank.');
    });

    // 7. Duplicate execution prevented on already PAID Payment Request
    it('7. Duplicate execution prevented on already PAID Payment Request', async () => {
      const paidPrq = { ...basePrq, status: PaymentRequestStatus.PAID };
      setupExecutionMocks({ prq: paidPrq });

      await expect(
        service.createPayment(
          {
            invoiceId: 24,
            paymentRequestId: 24,
            companyBankAccountId: 1,
            paymentDate: '2026-11-15T12:00:00Z',
            paymentAmount: 990000,
            paymentMethod: 'BANK_TRANSFER',
            referenceNumber: 'TRX-20261115-001',
          },
          3
        )
      ).rejects.toThrow('Pembayaran ditolak: Payment Request sudah dibayar (PAID).');
    });

    // 8. Re-paying already PAID invoice rejected
    it('8. Re-paying already PAID invoice rejected', async () => {
      const paidInvoice = { ...baseInvoice, paymentStatus: 'PAID' };
      setupExecutionMocks({ invoice: paidInvoice });

      await expect(
        service.createPayment(
          {
            invoiceId: 24,
            paymentRequestId: 24,
            companyBankAccountId: 1,
            paymentDate: '2026-11-15T12:00:00Z',
            paymentAmount: 990000,
            paymentMethod: 'BANK_TRANSFER',
            referenceNumber: 'TRX-20261115-001',
          },
          3
        )
      ).rejects.toThrow('Invoice is already PAID');
    });

    // 9. Maker-Checker Segregation of Duties (approving Director cannot execute payment)
    it('9. Segregation of Duties: Approving Director cannot execute payment as Finance', async () => {
      setupExecutionMocks();

      await expect(
        service.createPayment(
          {
            invoiceId: 24,
            paymentRequestId: 24,
            companyBankAccountId: 1,
            paymentDate: '2026-11-15T12:00:00Z',
            paymentAmount: 990000,
            paymentMethod: 'BANK_TRANSFER',
            referenceNumber: 'TRX-20261115-001',
          },
          2 // User 2 is the Director who approved the PRQ!
        )
      ).rejects.toThrow('Prinsip Segregation of Duties (SoD) melarang penyetuju Payment Request (Checker/Direktur) mengeksekusi pembayaran.');
    });

    // 10. Previous payments on the same Payment Request reduce remaining approved amount
    it('10. Previous payments on the same PRQ reduce remaining approved amount for subsequent payments', async () => {
      const existingPayment = { id: 1, invoiceId: 24, paymentRequestId: 24, amount: 500000, deletedAt: null };
      setupExecutionMocks({ existingPayments: [existingPayment] });

      // Trying to pay 500,000 when only 490,000 remains approved on this PRQ (990k - 500k = 490k)
      await expect(
        service.createPayment(
          {
            invoiceId: 24,
            paymentRequestId: 24,
            companyBankAccountId: 1,
            paymentDate: '2026-11-15T12:00:00Z',
            paymentAmount: 500000,
            paymentMethod: 'BANK_TRANSFER',
            referenceNumber: 'TRX-20261115-002',
          },
          3
        )
      ).rejects.toThrow('melebihi nominal yang disetujui Direktur (490000)');
    });

    // 11. Partial payment remaining cash amount succeeds
    it('11. Exact remaining payment of Rp490,000 on PRQ succeeds and marks invoice PAID', async () => {
      const existingPayment = { id: 1, invoiceId: 24, paymentRequestId: 24, amount: 500000, deletedAt: null };
      const partialInv = { ...baseInvoice, paymentStatus: 'PARTIALLY_PAID' };
      setupExecutionMocks({ invoice: partialInv, existingPayments: [existingPayment] });

      const result = await service.createPayment(
        {
          invoiceId: 24,
          paymentRequestId: 24,
          companyBankAccountId: 1,
          paymentDate: '2026-11-15T12:00:00Z',
          paymentAmount: 490000,
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: 'TRX-20261115-002',
        },
        3
      );

      expect(result).toBeDefined();
      expect(result.amount).toBe(490000);
      expect((result as any).paymentStatus).toBe('PAID');
      expect((result as any).isFullyPaid).toBe(true);
    });

    // 12. Service Order payment execution with Service Claim reference
    it('12. Service Order execution: DPP 1.2M, PPN 132k, PPh 24k -> executes Rp1,308,000 and marks PAID', async () => {
      const srvPo = {
        id: 35,
        poNumber: 'PO-SRV-001',
        orderType: 'SERVICE',
        totalAmount: 1200000,
        companyCode: 'UBD',
        vendor: { id: 12, name: 'PT Vendor Service' },
        deletedAt: null,
      };
      const srvTerm = {
        id: 35,
        poId: 35,
        termName: 'Termin Jasa',
        amount: 1200000,
        status: PaymentTermStatus.VERIFIED,
        deletedAt: null,
      };
      const srvItd = {
        id: 10,
        invoiceId: 35,
        companyCode: 'UBD',
        dppCommercial: 1200000,
        ppnAmount: 132000,
        grossCommercialLiability: 1332000,
        pphWithholdingAmount: 24000,
        wapuPpnWithheldAmount: 0,
        priorDeductionsAmount: 0,
        netVendorCashPayable: 1308000,
      };
      const srvInv = {
        id: 35,
        invoiceNumber: 'INV-SRV-001',
        companyCode: 'UBD',
        poId: 35,
        paymentTermId: 35,
        totalAmount: 1200000,
        matchStatus: 'VERIFIED',
        paymentStatus: 'UNPAID',
        version: 1,
        invoiceTaxDetail: srvItd,
        paymentTerm: srvTerm,
        purchaseOrder: srvPo,
        deletedAt: null,
      };
      const srvPrq = {
        id: 35,
        requestNumber: 'PRQ-SRV-001',
        invoiceId: 35,
        companyCode: 'UBD',
        paymentTermId: 35,
        status: PaymentRequestStatus.APPROVED_FOR_PAYMENT,
        approvedAmount: 1308000,
        approvedBy: 2,
        requestedAmount: 1308000,
        approvalSnapshot: {
          invoiceId: 35,
          invoiceVersion: 1,
          vendorBankName: 'Bank BCA',
          vendorBankAccount: '987-654-3210',
          vendorBankAccountHolder: 'PT Vendor Service',
          dppAmount: 1200000,
          ppnAmount: 132000,
          grossAmount: 1332000,
          pphAmount: 24000,
          netPayableAmount: 1308000,
        },
        deletedAt: null,
      };

      mockQueryRunner.manager.findOne.mockImplementation(async (entityClass: any) => {
        if (entityClass === Invoice) return srvInv;
        if (entityClass === PaymentRequest) return srvPrq;
        if (entityClass === PoPaymentTerm) return srvTerm;
        if (entityClass === PurchaseOrder) return srvPo;
        if (entityClass === CompanyBankAccount) return mockCba;
        return null;
      });
      mockQueryRunner.manager.find.mockImplementation(async (entityClass: any) => {
        if (entityClass === Payment) return [];
        if (entityClass === Invoice) return [srvInv];
        if (entityClass === PoPaymentTerm) return [srvTerm];
        return [];
      });

      const result = await service.createPayment(
        {
          invoiceId: 35,
          paymentRequestId: 35,
          companyBankAccountId: 1,
          paymentDate: '2026-11-15T12:00:00Z',
          paymentAmount: 1308000,
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: 'TRX-SRV-001',
        },
        3
      );

      expect(result).toBeDefined();
      expect(result.amount).toBe(1308000);
      expect((result as any).paymentStatus).toBe('PAID');
      expect((result as any).isFullyPaid).toBe(true);
    });
  });
});

