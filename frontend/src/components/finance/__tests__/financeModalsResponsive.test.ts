/**
 * EPMS — FINANCE & DIRECTOR APPROVAL MODALS RESPONSIVE COMPONENT TESTS
 *
 * Verifies mobile-first layout responsiveness for:
 * 1. DirectorApprovalModal
 * 2. SubmitPaymentRequestModal
 * 3. ResubmitPaymentRequestModal
 * 4. ProcessPaymentModal
 *
 * Checks responsive modal widths, maxWidth boundaries, responsive column breakdowns,
 * and flex-wrap properties preventing mobile truncation / overflow.
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { PaymentRequestDto, InvoiceDto } from '@/services/finance.service';

// Mock antd Modal and components to inspect rendered props & static output
let capturedModalProps: any[] = [];

jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  return {
    ...actual,
    Modal: (props: any) => {
      capturedModalProps.push(props);
      if (!props.open) return null;
      return React.createElement(
        'div',
        {
          'data-testid': 'mock-modal',
          'data-width': typeof props.width === 'object' ? JSON.stringify(props.width) : props.width,
          'data-style': props.style ? JSON.stringify(props.style) : undefined,
        },
        props.title,
        props.children,
        props.footer
      );
    },
  };
});

import { DirectorApprovalModal } from '../DirectorApprovalModal';
import { SubmitPaymentRequestModal } from '../SubmitPaymentRequestModal';
import { ResubmitPaymentRequestModal } from '../ResubmitPaymentRequestModal';
import { ProcessPaymentModal } from '../ProcessPaymentModal';

describe('Finance & Director Approval Modals Mobile Responsiveness', () => {
  const mockPaymentRequest: PaymentRequestDto = {
    id: 101,
    requestNumber: 'PRQ-20261103-001',
    invoiceId: 201,
    paymentTermId: 1,
    requestedAmount: 125000000,
    status: 'PENDING_DIRECTOR_APPROVAL',
    requestedBy: 10,
    submittedAt: '2026-11-03T10:00:00Z',
    notes: 'Pembayaran termin 1 pengadaan struktur baja',
    invoice: {
      id: 201,
      invoiceNumber: 'INV-20261103-001',
      purchaseOrderId: 301,
      invoiceDate: '2026-11-03',
      totalAmount: 125000000,
      status: 'UNPAID',
      matchStatus: 'MATCHED',
      paymentStatus: 'UNPAID',
      purchaseOrder: {
        id: 301,
        poNumber: 'PO-20261101-001',
        vendor: {
          id: 401,
          name: 'PT Baja Perkasa Konstruksi',
        },
      } as any,
    } as any,
    paymentTerm: {
      id: 1,
      name: 'Termin 1 (DP 30%)',
      percentage: 30,
    },
    requester: {
      id: 10,
      fullName: 'Finance Lead',
      email: 'finance@epms.com',
    },
  };

  const mockInvoice: InvoiceDto = {
    id: 201,
    invoiceNumber: 'INV-20261103-001',
    purchaseOrderId: 301,
    invoiceDate: '2026-11-03',
    totalAmount: 125000000,
    status: 'UNPAID',
    matchStatus: 'MATCHED',
    paymentStatus: 'UNPAID',
    purchaseOrder: {
      id: 301,
      poNumber: 'PO-20261101-001',
      vendor: {
        id: 401,
        name: 'PT Baja Perkasa Konstruksi',
      },
    } as any,
    paymentTerm: {
      id: 1,
      name: 'Termin 1',
    } as any,
  };

  beforeEach(() => {
    capturedModalProps = [];
  });

  describe('1. DirectorApprovalModal', () => {
    it('uses responsive width and maxWidth on main modal', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(DirectorApprovalModal, {
          open: true,
          onClose: jest.fn(),
          paymentRequest: mockPaymentRequest,
        })
      );

      expect(capturedModalProps.length).toBeGreaterThan(0);
      const modalProp = capturedModalProps[0];
      expect(modalProp.width).toBe('min(800px, calc(100vw - 24px))');
      expect(modalProp.style).toEqual(expect.objectContaining({ maxWidth: '100vw' }));
    });

    it('renders header title with break-word and action buttons with flexWrap', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(DirectorApprovalModal, {
          open: true,
          onClose: jest.fn(),
          paymentRequest: mockPaymentRequest,
        })
      );

      expect(html).toContain('Review &amp; Persetujuan Pembayaran (Direktur)');
      expect(html).toContain('word-break:break-word');
      expect(html).toContain('flex-wrap:wrap');
      expect(html).toContain('btn-director-approve');
      expect(html).toContain('btn-director-reject-mode');
      expect(html).toContain('btn-director-return-mode');
    });
  });

  describe('2. SubmitPaymentRequestModal', () => {
    it('uses responsive width and maxWidth on modal', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(SubmitPaymentRequestModal, {
          open: true,
          onClose: jest.fn(),
          invoice: mockInvoice,
        })
      );

      expect(capturedModalProps.length).toBeGreaterThan(0);
      const modalProp = capturedModalProps[0];
      expect(modalProp.width).toBe('min(680px, calc(100vw - 24px))');
      expect(modalProp.style).toEqual(expect.objectContaining({ maxWidth: '100vw' }));
    });

    it('renders responsive grid columns for summary card and bank info', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(SubmitPaymentRequestModal, {
          open: true,
          onClose: jest.fn(),
          invoice: mockInvoice,
        })
      );

      expect(html).toContain('Pengajuan Persetujuan Pembayaran ke Direktur');
      // ant-col-xs-24 is produced when xs={24} is specified on Col
      expect(html).toContain('ant-col-xs-24');
      expect(html).toContain('ant-col-sm-12');
      expect(html).toContain('flex-wrap:wrap');
    });
  });

  describe('3. ResubmitPaymentRequestModal', () => {
    it('uses responsive width and maxWidth on modal', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResubmitPaymentRequestModal, {
          open: true,
          onClose: jest.fn(),
          paymentRequest: {
            ...mockPaymentRequest,
            status: 'NEEDS_REVISION',
            revisionNotes: 'Perbaiki nomor rekening tujuan transfer',
          },
        })
      );

      expect(capturedModalProps.length).toBeGreaterThan(0);
      const modalProp = capturedModalProps[0];
      expect(modalProp.width).toBe('min(680px, calc(100vw - 24px))');
      expect(modalProp.style).toEqual(expect.objectContaining({ maxWidth: '100vw' }));
    });

    it('renders revision note and responsive action buttons with flexWrap', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ResubmitPaymentRequestModal, {
          open: true,
          onClose: jest.fn(),
          paymentRequest: {
            ...mockPaymentRequest,
            status: 'NEEDS_REVISION',
            revisionNotes: 'Perbaiki nomor rekening tujuan transfer',
          },
        })
      );

      expect(html).toContain('Perbaiki nomor rekening tujuan transfer');
      expect(html).toContain('flex-wrap:wrap');
      expect(html).toContain('btn-resubmit-payment-request');
    });
  });

  describe('4. ProcessPaymentModal', () => {
    it('uses responsive width and maxWidth on main modal when authorized', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(ProcessPaymentModal, {
          open: true,
          onClose: jest.fn(),
          invoice: mockInvoice,
          canProcessPayment: true,
        })
      );

      expect(capturedModalProps.length).toBeGreaterThan(0);
      const modalProp = capturedModalProps[0];
      expect(modalProp.width).toBe('min(860px, calc(100vw - 24px))');
      expect(modalProp.style).toEqual(expect.objectContaining({ maxWidth: '100vw' }));
    });

    it('uses responsive width and maxWidth on access denied submodal when unauthorized', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(ProcessPaymentModal, {
          open: true,
          onClose: jest.fn(),
          invoice: mockInvoice,
          canProcessPayment: false,
        })
      );

      expect(capturedModalProps.length).toBeGreaterThan(0);
      const modalProp = capturedModalProps[0];
      expect(modalProp.width).toBe('min(480px, calc(100vw - 24px))');
      expect(modalProp.style).toEqual(expect.objectContaining({ maxWidth: '100vw' }));
    });

    it('renders wrapped header title, footer, and amount helper', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ProcessPaymentModal, {
          open: true,
          onClose: jest.fn(),
          invoice: mockInvoice,
          canProcessPayment: true,
        })
      );

      expect(html).toContain('Eksekusi Pembayaran Tagihan');
      expect(html).toContain('word-break:break-word');
      expect(html).toContain('flex-wrap:wrap');
      expect(html).toContain('btn-submit-process-payment');
    });
  });
});

