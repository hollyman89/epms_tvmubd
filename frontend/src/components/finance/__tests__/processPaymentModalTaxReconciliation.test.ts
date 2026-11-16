/**
 * EPMS — PAYMENT EXECUTION & SETTLEMENT CONTROL ENHANCEMENT TESTS
 *
 * Comprehensive tests for ProcessPaymentModal:
 * 1. 3 Authoritative Financial Summary Cards (DPP, Gross Liability, Net Cash Approved).
 * 2. Prominent Director Decision Summary Banner (Nominal Rp990.000, Subtext, Approver, PPh KPP explanation).
 * 3. Dedicated Rincian Keuangan & Rekonsiliasi Pembayaran section (Arithmetic table).
 * 4. Dedicated Vendor Destination Account section (Bank Mandiri, 123-456-7890, PT Suplai Makmur).
 * 5. Distinction between Company Source Bank (Bank Sumber Dana) and Destination Account.
 * 6. Gating: Stale Snapshot Version Mismatch warning & submission disabling.
 * 7. Gating: Missing Vendor Destination Bank Account warning & submission disabling.
 * 8. Gating: Non-Approved Payment Request status warning & submission disabling.
 * 9. Gating: Already Paid Invoice warning & submission disabling.
 * 10. Segregation of Duties (SoD): Non-Finance role access rejection.
 * 11. Scenarios: PPN-only transaction (Net Cash = Gross).
 * 12. Scenarios: PPh-only transaction (Net Cash = DPP - PPh).
 * 13. Scenarios: No-tax transaction (Net Cash = DPP).
 * 14. Scenarios: Service Order transaction (Order type SERVICE).
 * 15. Scenarios: Partial Payment scenario with prior payment reduction.
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceDto, PaymentRequestDto } from '@/services/finance.service';

// Mock antd Modal to render inline without browser portal
jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  return {
    ...actual,
    Modal: ({ open, children, title, footer }: any) => {
      if (!open) return null;
      return React.createElement(
        'div',
        { 'data-testid': 'mock-modal' },
        React.createElement('div', { className: 'ant-modal-title' }, title),
        React.createElement('div', { className: 'ant-modal-body' }, children),
        React.createElement('div', { className: 'ant-modal-footer' }, footer)
      );
    },
  };
});

// Mock FinanceService
jest.mock('@/services/finance.service', () => {
  const actual = jest.requireActual('@/services/finance.service');
  return {
    ...actual,
    FinanceService: {
      getInvoiceById: jest.fn().mockImplementation((id: number) => Promise.resolve(null)),
      getPaymentRequestById: jest.fn().mockImplementation((id: number) => Promise.resolve(null)),
      createPayment: jest.fn().mockResolvedValue({ id: 1, paymentNumber: 'PAY-20261115-001' }),
    },
  };
});

import { ProcessPaymentModal } from '../ProcessPaymentModal';

describe('ProcessPaymentModal — Payment Execution & Tax Settlement Control Suite', () => {
  // Target reference transaction fixtures:
  // PO-20261113-003, INV-20261113-003, PRQ-20261115-001
  // DPP: Rp900.000, PPN: Rp99.000 (11%), Gross: Rp999.000, PPh: Rp9.000 (1%), Net Cash: Rp990.000
  const targetInvoice: InvoiceDto = {
    id: 24,
    invoiceNumber: 'INV-20261113-003',
    poId: 24,
    invoiceDate: '2026-11-13',
    totalAmount: 900000,
    status: 'UNPAID',
    matchStatus: 'VERIFIED',
    paymentStatus: 'UNPAID',
    version: 1,
    createdAt: '2026-11-13T00:00:00Z',
    purchaseOrder: {
      id: 24,
      poNumber: 'PO-20261113-003',
      orderType: 'MATERIAL',
      vendor: {
        id: 15,
        name: 'PT Suplai Makmur',
        code: 'VND-SM',
        bankName: 'Bank Mandiri',
        bankAccountNumber: '123-456-7890',
        bankAccountHolder: 'PT Suplai Makmur',
      },
      purchaseRequest: {
        id: 10,
        project: {
          id: 5,
          name: 'Pembangunan Gardu Induk TVM',
        },
      },
    } as any,
    paymentTerm: {
      id: 1,
      termName: 'Pelunasan Penuh',
      percentage: 100,
      amount: 900000,
    } as any,
    invoiceTaxDetail: {
      id: 24,
      invoiceId: 24,
      dppCommercial: 900000,
      ppnRate: 11,
      ppnAmount: 99000,
      grossCommercialLiability: 999000,
      pphWithholdingAmount: 9000,
      netVendorCashPayable: 990000,
      nsfp: '0100002612345678',
      taxInvoiceDate: '2026-11-13',
      pphCertificateNumber: 'BP-2026-11-001',
      pphCertificateDate: '2026-11-13',
      taxRuleSnapshot: {
        pph: { rate: 1, pphType: 'PPH_22' },
      },
    } as any,
    payments: [],
  };

  const targetPaymentRequest: PaymentRequestDto = {
    id: 24,
    requestNumber: 'PRQ-20261115-001',
    invoiceId: 24,
    paymentTermId: 1,
    requestedAmount: 990000,
    approvedAmount: 990000,
    status: 'APPROVED_FOR_PAYMENT',
    requestedBy: 5,
    submittedAt: '2026-11-15T08:00:00Z',
    approvedBy: 2,
    approvedAt: '2026-11-15T10:00:00Z',
    notes: 'Pengajuan pembayaran termin penuh pengadaan material',
    approver: {
      id: 2,
      fullName: 'Bambang Soedarmono (Direktur Utama)',
      email: 'director@epms.com',
    },
    approvalSnapshot: {
      invoiceVersion: 1,
      dppAmount: 900000,
      ppnRate: 11,
      ppnAmount: 99000,
      grossAmount: 999000,
      pphRate: 1,
      pphAmount: 9000,
      pphType: 'PPH_22',
      netPayableAmount: 990000,
      requestedAmount: 990000,
      approverName: 'Bambang Soedarmono (Direktur Utama)',
      approvedAt: '2026-11-15T10:00:00Z',
      vendorBankName: 'Bank Mandiri',
      vendorBankAccount: '123-456-7890',
      vendorBankAccountHolder: 'PT Suplai Makmur',
    },
  };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const renderModal = (props: Partial<React.ComponentProps<typeof ProcessPaymentModal>> = {}) => {
    return ReactDOMServer.renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(ProcessPaymentModal, {
          open: true,
          onClose: jest.fn(),
          invoice: targetInvoice,
          paymentRequest: targetPaymentRequest,
          canProcessPayment: true,
          currentUserName: 'Finance Officer',
          ...props,
        })
      )
    );
  };

  describe('1. Authoritative 3-Card Financial Summary', () => {
    it('renders Commercial DPP (Rp900.000) card with correct label', () => {
      const html = renderModal();
      expect(html).toContain('Nilai DPP / Komersial');
      expect(html).toContain('900.000');
      expect(html).toContain('Nilai komersial PO / Dasar Pengenaan Pajak');
    });

    it('renders Gross Invoice Liability (Rp999.000) card with correct label', () => {
      const html = renderModal();
      expect(html).toContain('Total Tagihan Bruto');
      expect(html).toContain('999.000');
      expect(html).toContain('Kewajiban legal faktur (DPP + PPN)');
    });

    it('renders Net Vendor Cash Approved (Rp990.000) card with correct label', () => {
      const html = renderModal();
      expect(html).toContain('Kas Bersih Disetujui');
      expect(html).toContain('990.000');
      expect(html).toContain('Pencairan kas vendor setelah potongan PPh');
    });
  });

  describe('2. Prominent Director Decision Summary Banner', () => {
    it('renders prominent header with exact Director Approved amount', () => {
      const html = renderModal();
      expect(html).toContain('NOMINAL YANG DISETUJUI DIREKTUR');
      expect(html).toContain('Rp 990.000');
      expect(html).toContain('Pencairan Kas Bersih Vendor (D_cash)');
    });

    it('renders approver identity and status tag in the banner', () => {
      const html = renderModal();
      expect(html).toContain('Bambang Soedarmono (Direktur Utama)');
      expect(html).toContain('APPROVED_FOR_PAYMENT');
    });

    it('renders explicit explanation that PPh Rp9.000 is remitted to Kas Negara (KPP), not vendor', () => {
      const html = renderModal();
      expect(html).toContain('Keterangan Kas &amp; Perpajakan:');
      expect(html).toContain('Potongan PPh sebesar');
      expect(html).toContain('9.000');
      expect(html).toContain('1%');
      expect(html).toContain('tidak ditransfer ke vendor');
      expect(html).toContain('disetorkan terpisah oleh Treasury ke Kas Negara (KPP)');
    });
  });

  describe('3. Dedicated Financial & Reconciliation Details Section', () => {
    it('renders complete arithmetic reconciliation breakdown', () => {
      const html = renderModal();
      expect(html).toContain('Rincian Keuangan &amp; Rekonsiliasi Pembayaran');
      expect(html).toContain('Nilai DPP (Dasar Pengenaan):');
      expect(html).toContain('900.000');
      expect(html).toContain('PPN (11%):');
      expect(html).toContain('+ Rp 99.000');
      expect(html).toContain('Total Tagihan Bruto:');
      expect(html).toContain('999.000');
      expect(html).toContain('Potongan PPh (1%):');
      expect(html).toContain('- Rp 9.000');
      expect(html).toContain('Sisa Kas Bersih Vendor yang Berhak Dibayar:');
      expect(html).toContain('990.000');
    });
  });

  describe('4. Dedicated Vendor Destination Account Section', () => {
    it('renders read-only vendor bank account destination details', () => {
      const html = renderModal();
      expect(html).toContain('Rekening Penerima / Vendor (Destination Account)');
      expect(html).toContain('Rekening Terverifikasi');
      expect(html).toContain('NAMA BANK TUJUAN:');
      expect(html).toContain('Bank Mandiri');
      expect(html).toContain('NOMOR REKENING TUJUAN:');
      expect(html).toContain('123-456-7890');
      expect(html).toContain('ATAS NAMA REKENING:');
      expect(html).toContain('PT Suplai Makmur');
      expect(html).toContain('Transfer kas keluar hanya boleh ditujukan ke rekening vendor yang terdaftar di atas');
    });

    it('clearly separates Bank Sumber Dana input from Destination Account', () => {
      const html = renderModal();
      expect(html).toContain('Bank Sumber Dana (Rekening Operasional Perusahaan)');
      expect(html).toContain('Nomor Referensi Transaksi (No. Bukti Transfer)');
      expect(html).toContain('Nominal Pembayaran Realisasi (Rp)');
    });
  });

  describe('5. Gating & Security Controls', () => {
    it('blocks payment execution when snapshot version is stale (invoice.version > snapshot.invoiceVersion)', () => {
      const staleInvoice = {
        ...targetInvoice,
        version: 2, // version bumped
      };
      const html = renderModal({ invoice: staleInvoice });
      expect(html).toContain('Perubahan Data Invoice Terdeteksi (Stale Approval Snapshot)');
      expect(html).toContain('Perlu Revisi Persetujuan');
      expect(html).toContain('disabled=""');
    });

    it('blocks payment execution when vendor bank account is missing or blank', () => {
      const missingBankPrq: PaymentRequestDto = {
        ...targetPaymentRequest,
        approvalSnapshot: {
          ...targetPaymentRequest.approvalSnapshot!,
          vendorBankAccount: '',
        },
      };
      const missingBankInvoice: InvoiceDto = {
        ...targetInvoice,
        purchaseOrder: {
          ...targetInvoice.purchaseOrder,
          vendor: {
            ...targetInvoice.purchaseOrder!.vendor,
            bankAccountNumber: '',
            bankAccount: '',
          },
        } as any,
      };
      const html = renderModal({ invoice: missingBankInvoice, paymentRequest: missingBankPrq });
      expect(html).toContain('Rekening Tujuan Vendor Belum Terdaftar');
      expect(html).toContain('disabled=""');
    });

    it('blocks payment execution when Payment Request is not APPROVED_FOR_PAYMENT', () => {
      const pendingPrq: PaymentRequestDto = {
        ...targetPaymentRequest,
        status: 'PENDING_DIRECTOR_APPROVAL',
      };
      const html = renderModal({ paymentRequest: pendingPrq });
      expect(html).toContain('Payment Request Belum Disetujui Direktur');
      expect(html).toContain('Menunggu Persetujuan Direktur');
      expect(html).toContain('disabled=""');
    });

    it('blocks payment execution when invoice is already PAID', () => {
      const paidInvoice: InvoiceDto = {
        ...targetInvoice,
        paymentStatus: 'PAID',
      };
      const html = renderModal({ invoice: paidInvoice });
      expect(html).toContain('Invoice Ini Sudah Lunas (PAID)');
      expect(html).toContain('Invoice Telah Lunas');
      expect(html).toContain('disabled=""');
    });

    it('enforces Segregation of Duties (SoD): blocks non-finance roles completely', () => {
      const html = renderModal({ canProcessPayment: false });
      expect(html).toContain('Otoritas Pembayaran Ditolak');
      expect(html).toContain('Segregation of Duties (SoD) Enforced');
      expect(html).toContain('Hanya role Finance yang berwenang');
      expect(html).not.toContain('id="btn-submit-process-payment"');
    });
  });

  describe('6. Alternative Tax Scenarios & Modality Verification', () => {
    it('Scenario: PPN-Only Transaction (Net Cash = Gross Liability)', () => {
      const ppnOnlyInvoice: InvoiceDto = {
        ...targetInvoice,
        invoiceTaxDetail: {
          ...targetInvoice.invoiceTaxDetail,
          dppCommercial: 1000000,
          ppnRate: 11,
          ppnAmount: 110000,
          grossCommercialLiability: 1110000,
          pphWithholdingAmount: 0,
          netVendorCashPayable: 1110000,
          taxRuleSnapshot: {},
        } as any,
      };
      const ppnOnlyPrq: PaymentRequestDto = {
        ...targetPaymentRequest,
        requestedAmount: 1110000,
        approvedAmount: 1110000,
        approvalSnapshot: {
          ...targetPaymentRequest.approvalSnapshot!,
          dppAmount: 1000000,
          ppnRate: 11,
          ppnAmount: 110000,
          grossAmount: 1110000,
          pphRate: 0,
          pphAmount: 0,
          netPayableAmount: 1110000,
        },
      };

      const html = renderModal({ invoice: ppnOnlyInvoice, paymentRequest: ppnOnlyPrq });
      expect(html).toContain('1.000.000'); // DPP
      expect(html).toContain('+ Rp 110.000'); // PPN
      expect(html).toContain('1.110.000'); // Gross and Net Cash
      expect(html).toContain('Tidak Ada PPh');
    });

    it('Scenario: PPh-Only Transaction (Net Cash = DPP - PPh)', () => {
      const pphOnlyInvoice: InvoiceDto = {
        ...targetInvoice,
        invoiceTaxDetail: {
          ...targetInvoice.invoiceTaxDetail,
          dppCommercial: 2000000,
          ppnRate: 0,
          ppnAmount: 0,
          grossCommercialLiability: 2000000,
          pphWithholdingAmount: 40000, // 2% PPh 23
          netVendorCashPayable: 1960000,
          taxRuleSnapshot: { pph: { rate: 2, pphType: 'PPH_23' } },
        } as any,
      };
      const pphOnlyPrq: PaymentRequestDto = {
        ...targetPaymentRequest,
        requestedAmount: 1960000,
        approvedAmount: 1960000,
        approvalSnapshot: {
          ...targetPaymentRequest.approvalSnapshot!,
          dppAmount: 2000000,
          ppnRate: 0,
          ppnAmount: 0,
          grossAmount: 2000000,
          pphRate: 2,
          pphAmount: 40000,
          pphType: 'PPH_23',
          netPayableAmount: 1960000,
        },
      };

      const html = renderModal({ invoice: pphOnlyInvoice, paymentRequest: pphOnlyPrq });
      expect(html).toContain('2.000.000'); // DPP & Gross
      expect(html).toContain('Tidak Ada PPN');
      expect(html).toContain('- Rp 40.000'); // PPh
      expect(html).toContain('1.960.000'); // Net Cash
    });

    it('Scenario: No-Tax Transaction (Net Cash = Commercial DPP)', () => {
      const noTaxInvoice: InvoiceDto = {
        ...targetInvoice,
        invoiceTaxDetail: {
          ...targetInvoice.invoiceTaxDetail,
          dppCommercial: 500000,
          ppnRate: 0,
          ppnAmount: 0,
          grossCommercialLiability: 500000,
          pphWithholdingAmount: 0,
          netVendorCashPayable: 500000,
          taxRuleSnapshot: {},
        } as any,
      };
      const noTaxPrq: PaymentRequestDto = {
        ...targetPaymentRequest,
        requestedAmount: 500000,
        approvedAmount: 500000,
        approvalSnapshot: {
          ...targetPaymentRequest.approvalSnapshot!,
          dppAmount: 500000,
          ppnRate: 0,
          ppnAmount: 0,
          grossAmount: 500000,
          pphRate: 0,
          pphAmount: 0,
          netPayableAmount: 500000,
        },
      };

      const html = renderModal({ invoice: noTaxInvoice, paymentRequest: noTaxPrq });
      expect(html).toContain('500.000');
      expect(html).toContain('Tidak Ada PPN');
      expect(html).toContain('Tidak Ada PPh');
    });

    it('Scenario: Service Order Transaction (OrderType SERVICE with PPN and PPh 23)', () => {
      const serviceInvoice: InvoiceDto = {
        ...targetInvoice,
        purchaseOrder: {
          ...targetInvoice.purchaseOrder,
          orderType: 'SERVICE',
          vendor: {
            ...targetInvoice.purchaseOrder!.vendor,
            name: 'PT Jasa Konsultan Mandiri',
          },
        } as any,
        invoiceTaxDetail: {
          ...targetInvoice.invoiceTaxDetail,
          dppCommercial: 1200000,
          ppnRate: 11,
          ppnAmount: 132000,
          grossCommercialLiability: 1332000,
          pphWithholdingAmount: 24000, // 2% PPh 23
          netVendorCashPayable: 1308000,
          taxRuleSnapshot: { pph: { rate: 2, pphType: 'PPH_23' } },
        } as any,
      };
      const servicePrq: PaymentRequestDto = {
        ...targetPaymentRequest,
        requestedAmount: 1308000,
        approvedAmount: 1308000,
        approvalSnapshot: {
          ...targetPaymentRequest.approvalSnapshot!,
          dppAmount: 1200000,
          ppnRate: 11,
          ppnAmount: 132000,
          grossAmount: 1332000,
          pphRate: 2,
          pphAmount: 24000,
          pphType: 'PPH_23',
          netPayableAmount: 1308000,
        },
      };

      const html = renderModal({ invoice: serviceInvoice, paymentRequest: servicePrq });
      expect(html).toContain('SERVICE');
      expect(html).toContain('PT Jasa Konsultan Mandiri');
      expect(html).toContain('1.200.000'); // DPP
      expect(html).toContain('+ Rp 132.000'); // PPN
      expect(html).toContain('1.332.000'); // Gross
      expect(html).toContain('- Rp 24.000'); // PPh
      expect(html).toContain('1.308.000'); // Net Cash
    });

    it('Scenario: Partial Payment on Active Payment Request', () => {
      const partialInvoice: InvoiceDto = {
        ...targetInvoice,
        payments: [
          {
            id: 1,
            paymentNumber: 'PAY-20261114-001',
            invoiceId: 24,
            paymentRequestId: 24,
            amount: 500000,
            paymentDate: '2026-11-14',
            status: 'COMPLETED',
          } as any,
        ],
      };

      const html = renderModal({ invoice: partialInvoice });
      expect(html).toContain('Telah dilakukan pembayaran sebelumnya sebesar Rp 500.000');
      expect(html).toContain('Sisa persetujuan aktif: Rp 490.000');
      expect(html).toContain('Terbayar Sebelumnya:');
      expect(html).toContain('- Rp 500.000');
    });
  });
});
