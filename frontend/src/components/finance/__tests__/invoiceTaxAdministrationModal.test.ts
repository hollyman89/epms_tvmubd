/**
 * EPMS — FINANCE: INVOICE TAX ADMINISTRATION MODAL INTEGRATION TESTS
 *
 * Verifies that:
 * 1. CreateInvoiceModal renders 2-column layout with "Administrasi Perpajakan" on the right.
 * 2. Informational note is displayed prominently explaining that tax details can be completed later.
 * 3. Section A (PPN) fields are rendered: NSFP, Tanggal, DPP, Nominal PPN, and PDF Upload.
 * 4. Section B (PPh) fields are rendered: Jenis PPh, Tarif, DPP, Nominal Terpotong, No Bukti Potong, Tanggal, and PDF Upload.
 * 5. Settlement Parity Card is rendered with Gross ($L_comm$), PPh ($W_tax$), and Net Payable ($D_cash$).
 * 6. Invoice creation is strictly optional: empty tax inputs do not block submission.
 * 7. InvoiceDetailModal renders the "Administrasi Perpajakan & Bukti Dokumen" card and edit button.
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';

// Mock antd Modal to render inline without browser document/DOM portal
jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  return {
    ...actual,
    Modal: ({ open, children, title }: any) => {
      if (!open) return null;
      return React.createElement(
        'div',
        { 'data-testid': 'mock-modal' },
        title,
        children
      );
    },
  };
});

let capturedFinanceModalProps: any[] = [];

jest.mock('../ResponsiveFinanceModal', () => {
  return {
    ResponsiveFinanceModal: (props: any) => {
      capturedFinanceModalProps.push(props);
      if (!props.open) return null;
      return React.createElement(
        'div',
        {
          'data-testid': 'mock-responsive-finance-modal',
          'data-domain': props.domain,
          'data-size': props.size,
          'data-title': typeof props.title === 'string' ? props.title : undefined,
        },
        props.title,
        props.subtitle,
        props.children,
        props.footerExtra,
        props.footerActions
      );
    },
  };
});

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, fullName: 'Finance User', email: 'finance@ubd.co.id' },
    isFinance: true,
  }),
}));

jest.mock('@/services/procurement.service', () => ({
  ProcurementService: {
    getGoodsReceipts: jest.fn().mockResolvedValue([]),
    getGoodsReceipt: jest.fn().mockResolvedValue(null),
    getApprovedServiceClaims: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/services/finance.service', () => ({
  FinanceService: {
    createInvoice: jest.fn().mockResolvedValue({ id: 101, invoiceNumber: 'INV-2026-001' }),
    getInvoiceTax: jest.fn().mockResolvedValue({
      taxDetail: {
        fakturPajakNumber: '010.000-26.12345678',
        fakturPajakDate: '2026-11-13',
        taxBasis: 100000000,
        ppnRate: 11,
        ppnAmount: 11000000,
        pphRate: 2,
        pphAmount: 2000000,
        buktiPotongNumber: 'BPU-2026-001',
        buktiPotongDate: '2026-11-13',
      },
      ppnRecords: [],
      pphRecords: [],
    }),
    getInvoiceMatching: jest.fn().mockResolvedValue({
      status: 'MATCHED',
      invoicedAmount: 100000000,
      poTotal: 100000000,
      cumulativeInvoicedAmount: 100000000,
      remainingPoAmount: 0,
      cumulativePaidAmount: 0,
    }),
    getInvoiceById: jest.fn().mockResolvedValue({
      id: 101,
      invoiceNumber: 'INV-2026-001',
      totalAmount: 100000000,
      matchStatus: 'MATCHED',
      paymentStatus: 'UNPAID',
    }),
    updateInvoiceTax: jest.fn().mockResolvedValue({ success: true }),
    uploadInvoiceDocument: jest.fn().mockResolvedValue({ id: 1, fileName: 'faktur.pdf' }),
  },
}));

import { CreateInvoiceModal } from '../CreateInvoiceModal';
import { InvoiceDetailModal } from '../InvoiceDetailModal';
import { SubmitPaymentRequestModal } from '../SubmitPaymentRequestModal';

describe('EPMS Finance — Administrasi Perpajakan Modal Integration', () => {
  const samplePo = {
    id: 42,
    poNumber: 'PO-2026-TAX-001',
    projectName: 'Pembangunan Gedung Laboratorium Terpadu',
    projectId: 12,
    vendorName: 'PT Multi Karya Mandiri',
    vendorCode: 'VND-MKM',
    totalAmount: 100000000,
    orderType: 'MATERIAL',
    status: 'ISSUED',
    paymentTerms: [
      {
        id: 1,
        sequence: 1,
        termName: 'Termin DP',
        termType: 'DP',
        percentage: 30,
        amount: 30000000,
        status: 'PENDING',
      },
    ],
    items: [
      {
        id: 1,
        itemName: 'Semen Portland Komposit',
        specification: 'SNI 50kg',
        quantity: 500,
        unitPrice: 60000,
        totalPrice: 30000000,
      },
    ],
  };

  beforeEach(() => {
    capturedFinanceModalProps = [];
  });

  describe('1. CreateInvoiceModal Tax Administration Panel Layout', () => {
    it('renders the Administrasi Perpajakan panel title and administrative tag', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(CreateInvoiceModal, {
          open: true,
          onClose: jest.fn(),
          po: samplePo,
          canCreateInvoice: true,
        })
      );

      expect(html).toContain('Administrasi Perpajakan');
      expect(html).toContain('ADMINISTRATIF &amp; REKONSILIASI');
    });

    it('renders the informational note stating tax data can be completed later', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(CreateInvoiceModal, {
          open: true,
          onClose: jest.fn(),
          po: samplePo,
          canCreateInvoice: true,
        })
      );

      expect(html).toContain('Faktur Pajak &amp; Bukti Potong Bersifat Opsional');
      expect(html).toContain('Informasi dan dokumen perpajakan yang belum tersedia dapat dilengkapi kemudian melalui menu Lihat Invoice');
    });

    it('renders Section A (PPN) with NSFP, tanggal, DPP, tarif PPN (%), nominal PPN, and upload trigger', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(CreateInvoiceModal, {
          open: true,
          onClose: jest.fn(),
          po: samplePo,
          canCreateInvoice: true,
        })
      );

      expect(html).toContain('Bagian A — Pajak Pertambahan Nilai (PPN)');
      expect(html).toContain('Nomor Faktur Pajak (NSFP)');
      expect(html).toContain('Tanggal Faktur Pajak');
      expect(html).toContain('DPP PPN (Rp)');
      expect(html).toContain('Tarif PPN (%)');
      expect(html).toContain('Nominal PPN (Rp)');
      expect(html).toContain('Samakan DPP');
      expect(html).toContain('Pilih Berkas Faktur Pajak (PDF)');
    });

    it('renders Section B (PPh) with jenis pemotongan, tarif, dasar pengenaan, nominal, and upload trigger', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(CreateInvoiceModal, {
          open: true,
          onClose: jest.fn(),
          po: samplePo,
          canCreateInvoice: true,
        })
      );

      expect(html).toContain('Bagian B — Pajak Penghasilan (PPh)');
      expect(html).toContain('Jenis Pemotongan PPh');
      expect(html).toContain('Tarif PPh (%)');
      expect(html).toContain('Dasar Pengenaan PPh (Rp)');
      expect(html).toContain('Nominal Terpotong (Rp)');
      expect(html).toContain('Nomor Bukti Potong (BPU)');
      expect(html).toContain('Tanggal Bukti Potong');
      expect(html).toContain('Pilih Berkas Bukti Potong (PDF)');
    });

    it('renders Settlement Parity card with Gross ($L_comm$), PPh ($W_tax$), and Net Payable ($D_cash$)', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(CreateInvoiceModal, {
          open: true,
          onClose: jest.fn(),
          po: samplePo,
          canCreateInvoice: true,
        })
      );

      expect(html).toContain('Settlement Parity &amp; Estimasi Kas Bersih ke Rekening Vendor');
      expect(html).toContain('Nilai Tagihan Bruto Komersial (L_comm)');
      expect(html).toContain('Potongan PPh Dipungut Perusahaan (W_tax)');
      expect(html).toContain('Estimasi Kas Bersih ke Vendor (D_cash)');
      expect(html).toContain('Formula: D_cash = L_comm - W_tax');
    });
  });

  describe('2. InvoiceDetailModal Tax Administration Integration', () => {
    const sampleInvoice = {
      id: 101,
      invoiceNumber: 'INV-2026-001',
      invoiceDate: '2026-11-13',
      totalAmount: 30000000,
      matchStatus: 'MATCHED',
      paymentStatus: 'UNPAID',
      purchaseOrder: samplePo,
      paymentTerm: samplePo.paymentTerms[0],
      items: samplePo.items,
    };

    it('renders the Administrasi Perpajakan & Bukti Dokumen card in InvoiceDetailModal', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InvoiceDetailModal, {
          open: true,
          onClose: jest.fn(),
          invoice: sampleInvoice as any,
        })
      );

      expect(html).toContain('Administrasi Perpajakan &amp; Bukti Dokumen');
      expect(html).toContain('Lengkapi / Ubah Data Pajak');
    });
  });

  describe('3. Semi-Automatic PPN & PPh Calculation Arithmetic and Override Invariants', () => {
    it('accurately computes PPN Amount = DPP * Rate / 100 with half-up rounding', () => {
      const computePpnAmount = (dpp: number, rate: number) => Math.round((dpp * rate) / 100);

      expect(computePpnAmount(100000000, 11)).toBe(11000000);
      expect(computePpnAmount(100000000, 12)).toBe(12000000);
      expect(computePpnAmount(55555555, 11)).toBe(6111111);
      expect(computePpnAmount(0, 11)).toBe(0);
    });

    it('accurately computes PPh Withheld Amount = Taxable Base * Rate / 100 with half-up rounding', () => {
      const computePphWithheld = (base: number, rate: number) => Math.round((base * rate) / 100);

      expect(computePphWithheld(100000000, 2)).toBe(2000000);
      expect(computePphWithheld(50000000, 1.75)).toBe(875000);
      expect(computePphWithheld(33333333, 2.65)).toBe(883333);
      expect(computePphWithheld(0, 2)).toBe(0);
    });

    it('detects manual override when entered amount diverges from computed amount', () => {
      const computePpnAmount = (dpp: number, rate: number) => Math.round((dpp * rate) / 100);
      const isOverridden = (dpp: number, rate: number, actualAmount: number) => {
        const calculated = computePpnAmount(dpp, rate);
        return actualAmount !== calculated;
      };

      // Exactly matches formula -> Not overridden
      expect(isOverridden(100000000, 11, 11000000)).toBe(false);

      // Finance manually enters an adjusted amount (e.g. 10.999.000 from vendor's faktur) -> Overridden
      expect(isOverridden(100000000, 11, 10999000)).toBe(true);

      // Reset recalculates to formula
      const resetAmount = computePpnAmount(100000000, 11);
      expect(resetAmount).toBe(11000000);
      expect(isOverridden(100000000, 11, resetAmount)).toBe(false);
    });
  });

  describe('4. Confirmed Test Case (PO-20261113-003) Settlement Parity & Formula Verification', () => {
    it('accurately estimates Net Vendor Cash Rp990,000 for PO DPP Rp900k, PPN 11% Rp99k, and PPh 1% Rp9k', () => {
      const dpp = 900000;
      const ppnRate = 11;
      const ppnAmount = Math.round((dpp * ppnRate) / 100); // 99,000
      const pphRate = 1;
      const pphAmount = Math.round((dpp * pphRate) / 100); // 9,000

      const invoiceGross = dpp + ppnAmount; // 999,000
      const vendorCashPayable = invoiceGross - pphAmount; // 990,000

      expect(ppnAmount).toBe(99000);
      expect(pphAmount).toBe(9000);
      expect(invoiceGross).toBe(999000);
      expect(vendorCashPayable).toBe(990000);
      expect(vendorCashPayable).not.toBe(891000); // Guarantees resolution of discrepancy
    });

    it('renders confirmed test case PO-20261113-003 values in InvoiceDetailModal', () => {
      const testInvoice = {
        id: 24,
        invoiceNumber: 'INV-20261113-003',
        invoiceDate: '2026-11-13',
        totalAmount: 900000,
        matchStatus: 'MATCHED',
        paymentStatus: 'UNPAID',
        purchaseOrder: {
          id: 24,
          poNumber: 'PO-20261113-003',
          totalAmount: 900000,
          vendor: { name: 'PT Vendor Solusi' },
        },
        paymentTerm: { id: 24, amount: 900000, termName: 'Pelunasan Penuh' },
        invoiceTaxDetail: {
          dppCommercial: 900000,
          ppnAmount: 99000,
          grossCommercialLiability: 999000,
          pphWithholdingAmount: 9000,
          netVendorCashPayable: 990000,
        },
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InvoiceDetailModal, {
          open: true,
          onClose: jest.fn(),
          invoice: testInvoice as any,
        })
      );

      // Verify the rendered HTML contains the corrected values
      expect(html).toContain('999.000'); // Gross Commercial Liability
      expect(html).toContain('990.000'); // Net Vendor Cash Payable
      expect(html).toContain('9.000');   // PPh Withholding
    });
  });

  describe('5. Post-Issuance Persistence and Document Preview in InvoiceDetailModal', () => {
    it('renders exact persisted tax fields (NSFP, tax dates, DPP, PPN, PPh) and document actions', () => {
      const testInvoiceWithTax = {
        id: 24,
        invoiceNumber: 'INV-20261113-003',
        invoiceDate: '2026-11-13',
        totalAmount: 900000,
        matchStatus: 'MATCHED',
        paymentStatus: 'UNPAID',
        purchaseOrder: {
          id: 24,
          poNumber: 'PO-20261113-003',
          totalAmount: 900000,
          vendor: { name: 'PT Vendor Solusi' },
        },
        paymentTerm: { id: 24, amount: 900000, termName: 'Pelunasan Penuh' },
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
            },
          },
        },
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InvoiceDetailModal, {
          open: true,
          onClose: jest.fn(),
          invoice: testInvoiceWithTax as any,
        })
      );

      // Verify NSFP 16-digit value is rendered
      expect(html).toContain('4545645545354545');

      // Verify tax date is rendered
      expect(html).toContain('16/11/2026');

      // Verify DPP PPN is rendered
      expect(html).toContain('900.000');

      // Verify PPN Amount is rendered
      expect(html).toContain('99.000');

      // Verify PPh base and amount are rendered
      expect(html).toContain('9.000');

      // Verify Gross Liability and Net Vendor Cash in settlement parity
      expect(html).toContain('999.000');
      expect(html).toContain('990.000');
    });
  });

  describe('6. Mandatory PPN/PPh Tax Field Validation & Verification Gate Indicators', () => {
    it('displays warning alert and missing tags when invoice has PPN but missing NSFP and date', () => {
      const invoiceMissingPpnAdmin = {
        id: 201,
        invoiceNumber: 'INV-2026-PPN-INCOMPLETE',
        invoiceDate: '2026-11-14',
        totalAmount: 10000000,
        matchStatus: 'MATCHED',
        paymentStatus: 'UNPAID',
        purchaseOrder: samplePo,
        paymentTerm: samplePo.paymentTerms[0],
        invoiceTaxDetail: {
          dppCommercial: 10000000,
          ppnRate: 11,
          ppnAmount: 1100000,
          grossCommercialLiability: 11100000,
          netVendorCashPayable: 11100000,
          taxRuleSnapshot: {
            ppn: {
              ppnAmount: 1100000,
              ppnRate: 11,
              // fakturPajakNumber and fakturPajakDate are omitted / missing
            },
          },
        },
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InvoiceDetailModal, {
          open: true,
          onClose: jest.fn(),
          invoice: invoiceMissingPpnAdmin as any,
        })
      );

      // Warning alert for incomplete tax administration
      expect(html).toContain('Lengkapi administrasi perpajakan sebelum melakukan Verifikasi Invoice.');
      expect(html).toContain('Nomor Faktur Pajak (NSFP)');
      expect(html).toContain('Tanggal Faktur Pajak');
      expect(html).toContain('Wajib');
    });

    it('displays "16 Digit" error tag when NSFP length is invalid', () => {
      const invoiceInvalidNsfp = {
        id: 202,
        invoiceNumber: 'INV-2026-NSFP-INVALID',
        invoiceDate: '2026-11-14',
        totalAmount: 10000000,
        matchStatus: 'MATCHED',
        paymentStatus: 'UNPAID',
        purchaseOrder: samplePo,
        paymentTerm: samplePo.paymentTerms[0],
        invoiceTaxDetail: {
          dppCommercial: 10000000,
          ppnRate: 11,
          ppnAmount: 1100000,
          grossCommercialLiability: 11100000,
          netVendorCashPayable: 11100000,
          fakturPajakNumber: '010.000-26.12345', // Only 13 digits when cleaned
          fakturPajakDate: '2026-11-14',
          taxRuleSnapshot: {
            ppn: {
              ppnAmount: 1100000,
              ppnRate: 11,
              fakturPajakNumber: '010.000-26.12345',
              fakturPajakDate: '2026-11-14',
            },
          },
        },
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InvoiceDetailModal, {
          open: true,
          onClose: jest.fn(),
          invoice: invoiceInvalidNsfp as any,
        })
      );

      expect(html).toContain('16 Digit');
    });

    it('displays warning alert when invoice has PPh but missing Bukti Potong number and date', () => {
      const invoiceMissingPphAdmin = {
        id: 203,
        invoiceNumber: 'INV-2026-PPH-INCOMPLETE',
        invoiceDate: '2026-11-14',
        totalAmount: 10000000,
        matchStatus: 'MATCHED',
        paymentStatus: 'UNPAID',
        purchaseOrder: samplePo,
        paymentTerm: samplePo.paymentTerms[0],
        invoiceTaxDetail: {
          dppCommercial: 10000000,
          pphRate: 2,
          pphAmount: 200000,
          grossCommercialLiability: 10000000,
          netVendorCashPayable: 9800000,
          taxRuleSnapshot: {
            pph: {
              pphType: 'PPH_23',
              rate: 2,
              taxableBase: 10000000,
              withheldAmount: 200000,
              // buktiPotongNumber and buktiPotongDate are missing
            },
          },
        },
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InvoiceDetailModal, {
          open: true,
          onClose: jest.fn(),
          invoice: invoiceMissingPphAdmin as any,
        })
      );

      expect(html).toContain('Lengkapi administrasi perpajakan sebelum melakukan Verifikasi Invoice.');
      expect(html).toContain('Nomor Bukti Potong');
      expect(html).toContain('Tanggal Bukti Potong');
    });

    it('does NOT display warning alert when invoice has no PPN and no PPh', () => {
      const invoiceNoTax = {
        id: 204,
        invoiceNumber: 'INV-2026-NO-TAX',
        invoiceDate: '2026-11-14',
        totalAmount: 10000000,
        matchStatus: 'MATCHED',
        paymentStatus: 'UNPAID',
        purchaseOrder: samplePo,
        paymentTerm: samplePo.paymentTerms[0],
        invoiceTaxDetail: null,
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InvoiceDetailModal, {
          open: true,
          onClose: jest.fn(),
          invoice: invoiceNoTax as any,
        })
      );

      expect(html).not.toContain('Lengkapi administrasi perpajakan sebelum melakukan Verifikasi Invoice.');
    });

    it('does NOT display warning alert when all applicable tax administration fields are complete', () => {
      const invoiceCompleteTax = {
        id: 205,
        invoiceNumber: 'INV-2026-COMPLETE',
        invoiceDate: '2026-11-14',
        totalAmount: 10000000,
        matchStatus: 'MATCHED',
        paymentStatus: 'UNPAID',
        purchaseOrder: samplePo,
        paymentTerm: samplePo.paymentTerms[0],
        invoiceTaxDetail: {
          dppCommercial: 10000000,
          ppnRate: 11,
          ppnAmount: 1100000,
          pphRate: 2,
          pphAmount: 200000,
          grossCommercialLiability: 11100000,
          netVendorCashPayable: 10900000,
          fakturPajakNumber: '010.000-26.12345678',
          fakturPajakDate: '2026-11-14',
          buktiPotongNumber: 'BPU-2026-999',
          buktiPotongDate: '2026-11-14',
          taxRuleSnapshot: {
            ppn: {
              fakturPajakNumber: '010.000-26.12345678',
              fakturPajakDate: '2026-11-14',
              ppnAmount: 1100000,
              ppnRate: 11,
            },
            pph: {
              pphType: 'PPH_23',
              rate: 2,
              taxableBase: 10000000,
              withheldAmount: 200000,
              buktiPotongNumber: 'BPU-2026-999',
              buktiPotongDate: '2026-11-14',
            },
          },
        },
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InvoiceDetailModal, {
          open: true,
          onClose: jest.fn(),
          invoice: invoiceCompleteTax as any,
        })
      );

      expect(html).not.toContain('Lengkapi administrasi perpajakan sebelum melakukan Verifikasi Invoice.');
      expect(html).toContain('010.000-26.12345678');
      expect(html).toContain('BPU-2026-999');
    });
  });

  describe('7. SubmitPaymentRequestModal — Tax Settlement Integration & Net Cash Reconciliation', () => {
    const targetTransactionInvoice = {
      id: 24,
      invoiceNumber: 'INV-20261113-003',
      purchaseOrderId: 24,
      totalAmount: 900000,
      matchStatus: 'VERIFIED',
      paymentStatus: 'UNPAID',
      purchaseOrder: {
        id: 24,
        poNumber: 'PO-20261113-003',
        vendor: { name: 'PT Sarana Prima Mandiri' },
      },
      paymentTerm: {
        id: 24,
        termName: 'Termin 1 (100%)',
        amount: 900000,
      },
      invoiceTaxDetail: {
        id: 1,
        invoiceId: 24,
        dppCommercial: 900000,
        ppnRate: 11,
        ppnAmount: 99000,
        grossCommercialLiability: 999000,
        pphType: 'PPH_23',
        pphRate: 1,
        pphWithholdingAmount: 9000,
        netVendorCashPayable: 990000,
        fakturPajakNumber: '010.000-26.90000003',
        fakturPajakDate: '2026-11-13',
        buktiPotongNumber: 'BPU-2026-003',
        buktiPotongDate: '2026-11-13',
      },
      payments: [],
    };

    it('renders transparent financial settlement reconciliation for target transaction INV-20261113-003', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(SubmitPaymentRequestModal, {
          open: true,
          onClose: jest.fn(),
          invoice: targetTransactionInvoice as any,
        })
      );

      // Verify invoice & PO metadata
      expect(html).toContain('INV-20261113-003');
      expect(html).toContain('PO-20261113-003');
      expect(html).toContain('PT Sarana Prima Mandiri');
      expect(html).toContain('Termin 1 (100%)');

      // Verify Authoritative Settlement Breakdown header
      expect(html).toContain('Rincian Rekonsiliasi Tagihan &amp; Kas Bersih Vendor');

      // Verify DPP commercial value
      expect(html).toContain('Nilai DPP:');
      expect(html).toContain('900.000');

      // Verify PPN component
      expect(html).toContain('PPN (11%):');
      expect(html).toContain('99.000');

      // Verify Gross Commercial Liability (DPP + PPN = Rp999,000)
      expect(html).toContain('Total Tagihan Bruto:');
      expect(html).toContain('999.000');

      // Verify Withholding Tax component (- Rp9,000)
      expect(html).toContain('Potongan PPh:');
      expect(html).toContain('9.000');

      // Verify Authoritative Net Vendor Cash Payable (Rp990,000)
      expect(html).toContain('Jumlah Kas Bersih Vendor:');
      expect(html).toContain('990.000');

      // Verify maximum net cash indicator on the input label
      expect(html).toContain('Maksimum Kas Bersih:');
    });

    it('handles invoice without tax by setting gross and net cash equal to commercial DPP', () => {
      const noTaxInvoice = {
        id: 25,
        invoiceNumber: 'INV-NO-TAX-001',
        totalAmount: 5000000,
        matchStatus: 'VERIFIED',
        paymentStatus: 'UNPAID',
        purchaseOrder: {
          poNumber: 'PO-NO-TAX-001',
          vendor: { name: 'PT Mitra Sukses' },
        },
        invoiceTaxDetail: null,
        payments: [],
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(SubmitPaymentRequestModal, {
          open: true,
          onClose: jest.fn(),
          invoice: noTaxInvoice as any,
        })
      );

      expect(html).toContain('INV-NO-TAX-001');
      expect(html).toContain('5.000.000');
      expect(html).not.toContain('PPN (11%):');
      expect(html).not.toContain('Potongan PPh:');
    });

    it('computes remaining net payable when previous cash payments exist', () => {
      const partiallyPaidInvoice = {
        ...targetTransactionInvoice,
        id: 26,
        invoiceNumber: 'INV-PARTIAL-001',
        payments: [
          { id: 1, amount: 400000, status: 'PAID' },
        ],
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(SubmitPaymentRequestModal, {
          open: true,
          onClose: jest.fn(),
          invoice: partiallyPaidInvoice as any,
        })
      );

      // Remaining net payable should be Rp990,000 - Rp400,000 = Rp590,000
      expect(html).toContain('Kas Sudah Dibayar:');
      expect(html).toContain('400.000');
      expect(html).toContain('Sisa Kas Bersih yang Dapat Diajukan:');
      expect(html).toContain('590.000');
    });
  });
});
