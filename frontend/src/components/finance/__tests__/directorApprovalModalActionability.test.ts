/**
 * EPMS — DIRECTOR PAYMENT DECISION ACTIONABILITY COMPONENT TESTS
 *
 * Verifies status-aware decision gating for DirectorApprovalModal:
 * 1. PENDING_DIRECTOR_APPROVAL -> "Setujui Pembayaran" visible
 * 2. PENDING_DIRECTOR_APPROVAL -> "Minta Revisi" visible
 * 3. PENDING_DIRECTOR_APPROVAL -> "Tolak Pengajuan" visible
 * 4. APPROVED_FOR_PAYMENT -> all three decision actions absent
 * 5. PAID -> all three decision actions absent
 * 6. REJECTED -> all three decision actions absent
 * 7. NEEDS_REVISION -> all three decision actions absent
 * 8. Historical/read-only mode still shows: request number, invoice, PO, vendor, amount, status
 * 9. Read-only mode shows: Tutup
 * 10. No mutation handler is invoked merely by opening historical detail
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { FinanceService, PaymentRequestDto } from '@/services/finance.service';

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

import { DirectorApprovalModal } from '../DirectorApprovalModal';

describe('DirectorApprovalModal Status-Aware Actionability & Historical Read-Only Mode', () => {
  const basePaymentRequest: PaymentRequestDto = {
    id: 101,
    requestNumber: 'PRQ-20261020-001',
    invoiceId: 202,
    paymentTermId: 1,
    requestedAmount: 150000000,
    status: 'PENDING_DIRECTOR_APPROVAL',
    requestedBy: 5,
    submittedAt: '2026-10-20T10:00:00Z',
    notes: 'Mohon persetujuan pembayaran termin 1',
    invoice: {
      id: 202,
      invoiceNumber: 'INV-20261018-002',
      purchaseOrderId: 303,
      invoiceDate: '2026-10-18',
      totalAmount: 150000000,
      status: 'UNPAID',
      matchStatus: 'MATCHED',
      paymentStatus: 'UNPAID',
      purchaseOrder: {
        id: 303,
        poNumber: 'PO-20261018-002',
        vendor: {
          id: 404,
          name: 'PT Mitra Konstruksi Utama',
        },
      } as any,
    } as any,
    paymentTerm: {
      id: 1,
      name: 'Termin 1 (DP 30%)',
      percentage: 30,
    },
    requester: {
      id: 5,
      fullName: 'Finance Specialist',
      email: 'finance@epms.com',
    },
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderModal = (req: PaymentRequestDto, open: boolean = true) => {
    return ReactDOMServer.renderToStaticMarkup(
      React.createElement(DirectorApprovalModal, {
        open,
        onClose: jest.fn(),
        paymentRequest: req,
      })
    );
  };

  it('1. PENDING_DIRECTOR_APPROVAL -> "Setujui Pembayaran" visible', () => {
    const html = renderModal({
      ...basePaymentRequest,
      status: 'PENDING_DIRECTOR_APPROVAL',
    });
    expect(html).toContain('Setujui Pembayaran');
    expect(html).toContain('id="btn-director-approve"');
  });

  it('2. PENDING_DIRECTOR_APPROVAL -> "Minta Revisi" visible', () => {
    const html = renderModal({
      ...basePaymentRequest,
      status: 'PENDING_DIRECTOR_APPROVAL',
    });
    expect(html).toContain('Minta Revisi');
    expect(html).toContain('id="btn-director-return-mode"');
  });

  it('3. PENDING_DIRECTOR_APPROVAL -> "Tolak Pengajuan" visible', () => {
    const html = renderModal({
      ...basePaymentRequest,
      status: 'PENDING_DIRECTOR_APPROVAL',
    });
    expect(html).toContain('Tolak Pengajuan');
    expect(html).toContain('id="btn-director-reject-mode"');
  });

  it('4. APPROVED_FOR_PAYMENT -> all three decision actions absent', () => {
    const html = renderModal({
      ...basePaymentRequest,
      status: 'APPROVED_FOR_PAYMENT',
    });
    expect(html).not.toContain('Setujui Pembayaran');
    expect(html).not.toContain('id="btn-director-approve"');
    expect(html).not.toContain('Minta Revisi');
    expect(html).not.toContain('id="btn-director-return-mode"');
    expect(html).not.toContain('Tolak Pengajuan');
    expect(html).not.toContain('id="btn-director-reject-mode"');
  });

  it('5. PAID -> all three decision actions absent', () => {
    const html = renderModal({
      ...basePaymentRequest,
      status: 'PAID',
    });
    expect(html).not.toContain('Setujui Pembayaran');
    expect(html).not.toContain('id="btn-director-approve"');
    expect(html).not.toContain('Minta Revisi');
    expect(html).not.toContain('id="btn-director-return-mode"');
    expect(html).not.toContain('Tolak Pengajuan');
    expect(html).not.toContain('id="btn-director-reject-mode"');
  });

  it('6. REJECTED -> all three decision actions absent', () => {
    const html = renderModal({
      ...basePaymentRequest,
      status: 'REJECTED',
      rejectionReason: 'Dokumen kelengkapan pajak tidak valid.',
    });
    expect(html).not.toContain('Setujui Pembayaran');
    expect(html).not.toContain('id="btn-director-approve"');
    expect(html).not.toContain('Minta Revisi');
    expect(html).not.toContain('id="btn-director-return-mode"');
    expect(html).not.toContain('Tolak Pengajuan');
    expect(html).not.toContain('id="btn-director-reject-mode"');
  });

  it('7. NEEDS_REVISION -> all three decision actions absent', () => {
    const html = renderModal({
      ...basePaymentRequest,
      status: 'NEEDS_REVISION',
      revisionNotes: 'Perlu revisi nomor rekening tujuan.',
    });
    expect(html).not.toContain('Setujui Pembayaran');
    expect(html).not.toContain('id="btn-director-approve"');
    expect(html).not.toContain('Minta Revisi');
    expect(html).not.toContain('id="btn-director-return-mode"');
    expect(html).not.toContain('Tolak Pengajuan');
    expect(html).not.toContain('id="btn-director-reject-mode"');
  });

  it('8. Historical/read-only mode still shows: request number, invoice, PO, vendor, amount, status', () => {
    const html = renderModal({
      ...basePaymentRequest,
      status: 'APPROVED_FOR_PAYMENT',
    });
    // Request number
    expect(html).toContain('PRQ-20261020-001');
    // Invoice
    expect(html).toContain('INV-20261018-002');
    // PO
    expect(html).toContain('PO-20261018-002');
    // Vendor
    expect(html).toContain('PT Mitra Konstruksi Utama');
    // Amount
    expect(html).toContain('150.000.000');
    // Status Tag
    expect(html).toContain('Disetujui');
  });

  it('9. Read-only mode shows: Tutup', () => {
    const html = renderModal({
      ...basePaymentRequest,
      status: 'PAID',
    });
    expect(html).toContain('Tutup');
    expect(html).toContain('id="btn-director-close"');
  });

  it('10. No mutation handler is invoked merely by opening historical detail', () => {
    const decideSpy = jest.spyOn(FinanceService, 'decidePaymentRequest');
    renderModal({
      ...basePaymentRequest,
      status: 'APPROVED_FOR_PAYMENT',
    });
    renderModal({
      ...basePaymentRequest,
      status: 'PAID',
    });
    expect(decideSpy).not.toHaveBeenCalled();
  });

  describe('Financial Transparency & Tax Reconciliation', () => {
    const targetTransactionRequest: PaymentRequestDto = {
      id: 201,
      requestNumber: 'PRQ-20261115-001',
      invoiceId: 24,
      paymentTermId: 24,
      requestedAmount: 990000,
      status: 'PENDING_DIRECTOR_APPROVAL',
      requestedBy: 3,
      submittedAt: '2026-11-15T10:00:00Z',
      notes: 'Pengajuan pembayaran termin pelunasan penuh bahan material aksesoris tiang',
      invoice: {
        id: 24,
        invoiceNumber: 'INV-20261113-003',
        purchaseOrderId: 24,
        invoiceDate: '2026-11-13',
        totalAmount: 900000,
        status: 'UNPAID',
        matchStatus: 'VERIFIED',
        paymentStatus: 'UNPAID',
        version: 2,
        purchaseOrder: {
          id: 24,
          poNumber: 'PO-20261113-003',
          orderType: 'MATERIAL',
          vendor: {
            id: 4,
            name: 'PT Suplai Makmur',
            code: 'VND-004',
          },
        } as any,
      } as any,
      paymentTerm: {
        id: 24,
        termName: 'Pelunasan Penuh',
        percentage: 100,
      },
      requester: {
        id: 3,
        fullName: 'Finance Specialist',
        email: 'finance@epms.com',
      },
      approvalSnapshot: {
        invoiceId: 24,
        invoiceNumber: 'INV-20261113-003',
        invoiceAmount: 900000,
        invoiceVersion: 2,
        paymentTermId: 24,
        paymentTermName: 'Pelunasan Penuh',
        requestedAmount: 990000,
        dppAmount: 900000,
        ppnAmount: 99000,
        ppnRate: 11,
        grossAmount: 999000,
        pphAmount: 9000,
        pphType: 'PPH_LAINNYA',
        pphRate: 1,
        wapuAmount: 0,
        priorDeductionsAmount: 0,
        netPayableAmount: 990000,
        fakturPajakNumber: '4545645545354545',
        fakturPajakDate: '2026-11-16',
        buktiPotongNumber: '454545455',
        buktiPotongDate: '2026-11-16',
        vendorId: 4,
        vendorName: 'PT Suplai Makmur',
        vendorBankName: 'Bank Central Asia (BCA)',
        vendorBankAccount: '1234567890',
        vendorBankAccountHolder: 'PT Suplai Makmur',
        goodsReceiptId: 10,
        goodsReceiptNumber: 'GR-20261113-003',
        poId: 24,
        poNumber: 'PO-20261113-003',
        projectName: 'Pembangunan Gardu Induk UBD-TVM',
        matchStatus: 'VERIFIED',
        verifiedByName: 'Finance User',
        timestamp: '2026-11-15T10:00:00Z',
      },
    };

    it('11. Renders authoritative 3-card financial summary (DPP, Gross, Net Cash)', () => {
      const html = renderModal(targetTransactionRequest);

      // Card 1: Nilai DPP / Komersial -> Rp 900.000
      expect(html).toContain('Nilai DPP / Komersial');
      expect(html).toContain('900.000');
      expect(html).toContain('Dasar Pengenaan Pajak / Nilai Komersial PO');

      // Card 2: Total Tagihan Bruto -> Rp 999.000
      expect(html).toContain('Total Tagihan Bruto');
      expect(html).toContain('999.000');
      expect(html).toContain('Kewajiban legal faktur (DPP + PPN)');

      // Card 3: Kas Bersih Diajukan -> Rp 990.000
      expect(html).toContain('Kas Bersih Diajukan');
      expect(html).toContain('990.000');
      expect(html).toContain('Pencairan kas vendor (setelah potongan PPh)');
    });

    it('12. Renders prominent Director Decision Summary banner for exact net vendor cash', () => {
      const html = renderModal(targetTransactionRequest);

      expect(html).toContain('NILAI YANG DIMINTAKAN PERSETUJUAN DIREKTUR');
      expect(html).toContain('990.000');
      expect(html).toContain('Nominal kas yang akan dibayarkan kepada vendor setelah persetujuan dan proses Treasury.');
      expect(html).toContain('Pencairan Kas Bersih');
    });

    it('13. Renders detailed Rincian Keuangan & Perpajakan table with tax identifiers', () => {
      const html = renderModal(targetTransactionRequest);

      // Rincian Rekonsiliasi Keuangan & Perpajakan
      expect(html).toContain('Rincian Rekonsiliasi Keuangan &amp; Perpajakan');
      expect(html).toContain('Nilai DPP (Dasar Pengenaan):');
      expect(html).toContain('PPN (11%):');
      expect(html).toContain('99.000');
      expect(html).toContain('Potongan PPh (1%):');
      expect(html).toContain('9.000');

      // Administrasi Dokumen Perpajakan
      expect(html).toContain('Administrasi Dokumen Perpajakan');
      expect(html).toContain('4545645545354545');
      expect(html).toContain('454545455');
      expect(html).toContain('PPN — Faktur Pajak');
      expect(html).toContain('PPh — Bukti Potong');
    });

    it('14. Renders vendor bank payment destination details', () => {
      const html = renderModal(targetTransactionRequest);

      expect(html).toContain('Informasi Rekening Bank Tujuan Vendor');
      expect(html).toContain('Bank Central Asia (BCA)');
      expect(html).toContain('1234567890');
      expect(html).toContain('PT Suplai Makmur');
    });

    it('15. Renders transaction and 3-way match verification context', () => {
      const html = renderModal(targetTransactionRequest);

      expect(html).toContain('INV-20261113-003');
      expect(html).toContain('PO-20261113-003');
      expect(html).toContain('MATERIAL');
      expect(html).toContain('Pembangunan Gardu Induk UBD-TVM');
      expect(html).toContain('GR-20261113-003');
      expect(html).toContain('Pelunasan Penuh');
      expect(html).toContain('Finance User');
    });

    it('16. Detects stale snapshot version mismatch and disables approval button', () => {
      // Simulate invoice modified to version 3 while snapshot was taken at version 2
      const staleRequest: PaymentRequestDto = {
        ...targetTransactionRequest,
        invoice: {
          ...targetTransactionRequest.invoice!,
          version: 3, // Version mismatch!
        },
      };

      const html = renderModal(staleRequest);

      // Warning alert displayed
      expect(html).toContain('Perubahan Data Invoice Terdeteksi');
      expect(html).toContain('Versi Snapshot: 2 vs Versi Invoice Terkini: 3');
      expect(html).toContain('Persetujuan pembayaran tidak dapat diproses menggunakan snapshot keuangan yang sudah usang');

      // Approve button disabled
      expect(html).toContain('id="btn-director-approve-disabled"');
      expect(html).toContain('Setujui Pembayaran (Data Berubah)');
      expect(html).not.toContain('id="btn-director-approve"');

      // Return and Reject actions remain accessible
      expect(html).toContain('id="btn-director-return-mode"');
      expect(html).toContain('id="btn-director-reject-mode"');
    });

    it('17. Handles PPN-only transaction: vendor receives full gross liability', () => {
      const ppnOnlyRequest: PaymentRequestDto = {
        ...targetTransactionRequest,
        requestedAmount: 999000,
        approvalSnapshot: {
          ...targetTransactionRequest.approvalSnapshot,
          dppAmount: 900000,
          ppnAmount: 99000,
          ppnRate: 11,
          grossAmount: 999000,
          pphAmount: 0,
          netPayableAmount: 999000,
          requestedAmount: 999000,
          buktiPotongNumber: null,
        },
      };

      const html = renderModal(ppnOnlyRequest);
      expect(html).toContain('999.000');
      expect(html).toContain('Tidak Ada PPh');
    });

    it('18. Handles PPh-only transaction: vendor receives net of withholding', () => {
      const pphOnlyRequest: PaymentRequestDto = {
        ...targetTransactionRequest,
        requestedAmount: 882000,
        approvalSnapshot: {
          ...targetTransactionRequest.approvalSnapshot,
          dppAmount: 900000,
          ppnAmount: 0,
          ppnRate: 0,
          grossAmount: 900000,
          pphAmount: 18000,
          pphRate: 2,
          netPayableAmount: 882000,
          requestedAmount: 882000,
          fakturPajakNumber: null,
        },
      };

      const html = renderModal(pphOnlyRequest);
      expect(html).toContain('882.000');
      expect(html).toContain('Tidak Ada PPN');
    });

    it('19. Handles No-Tax transaction: gross and net equal commercial DPP', () => {
      const noTaxRequest: PaymentRequestDto = {
        ...targetTransactionRequest,
        requestedAmount: 900000,
        approvalSnapshot: {
          ...targetTransactionRequest.approvalSnapshot,
          dppAmount: 900000,
          ppnAmount: 0,
          grossAmount: 900000,
          pphAmount: 0,
          netPayableAmount: 900000,
          requestedAmount: 900000,
          fakturPajakNumber: null,
          buktiPotongNumber: null,
        },
      };

      const html = renderModal(noTaxRequest);
      expect(html).toContain('900.000');
      expect(html).toContain('Tidak Ada PPN');
      expect(html).toContain('Tidak Ada PPh');
    });

    it('20. Handles Service Order transaction with Service Claim reference', () => {
      const serviceRequest: PaymentRequestDto = {
        ...targetTransactionRequest,
        approvalSnapshot: {
          ...targetTransactionRequest.approvalSnapshot,
          goodsReceiptNumber: null,
          serviceClaimNumber: 'SC-20261113-001',
        },
        invoice: {
          ...targetTransactionRequest.invoice!,
          purchaseOrder: {
            ...targetTransactionRequest.invoice!.purchaseOrder!,
            orderType: 'SERVICE',
          } as any,
        } as any,
      };

      const html = renderModal(serviceRequest);
      expect(html).toContain('SERVICE');
      expect(html).toContain('SC-20261113-001');
      expect(html).toContain('Dokumen Service Claim:');
    });
  });
});
