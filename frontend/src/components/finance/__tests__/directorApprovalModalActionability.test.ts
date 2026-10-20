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
});
