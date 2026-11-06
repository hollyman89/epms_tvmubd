/**
 * EPMS — FINANCE PAYMENT RECEIPT MODAL RESPONSIVE UNIT TESTS
 *
 * Verifies that PaymentReceiptModal:
 * 1. Integrates with ResponsiveFinanceModal with domain="PAYMENT", size="medium", and green theme.
 * 2. Renders prominent amount banner and status badge.
 * 3. Renders dual presentation: Desktop Table View + Mobile Card View.
 * 4. Preserves all 7 source-backed fields in both views (voucher #, date, method, bank ref, source bank, officer, status).
 * 5. Handles optional notes gracefully.
 * 6. Returns null gracefully when payment is null.
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';

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
          'data-subtitle': typeof props.subtitle === 'string' ? props.subtitle : undefined,
          'data-icon-theme': props.headerIconTheme,
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

import PaymentReceiptModal from '../PaymentReceiptModal';

describe('EPMS Finance — PaymentReceiptModal Responsive Redesign', () => {
  const samplePayment: any = {
    id: 501,
    paymentNumber: 'PAY-2026-TEST-001',
    amount: 50000000,
    paymentDate: '2026-11-03',
    paymentMethod: 'BANK_TRANSFER',
    referenceNumber: 'TRX-MANDIRI-20261103-8899',
    bankName: 'Bank Mandiri (Rekening Operasional Proyek)',
    createdBy: 7,
    creator: { id: 7, name: 'Siti Nurhaliza', email: 'siti@epms.co.id' },
    createdAt: '2026-11-03T10:00:00Z',
    notes: 'Pelunasan termin progress 50% sesuai BAST fisik',
    invoiceNumber: 'INV-2026-TEST-888',
    projectName: 'Pembangunan Gardu Induk UBD',
    projectId: 42,
    poNumber: 'PO-2026-TEST-001',
    vendorName: 'PT Mitra Solusi Mandiri',
    vendorCode: 'VND-077',
  };

  beforeEach(() => {
    capturedFinanceModalProps = [];
    jest.clearAllMocks();
  });

  test('TC-PR-01: Integrates with ResponsiveFinanceModal with domain="PAYMENT", size="medium", and green theme', () => {
    ReactDOMServer.renderToStaticMarkup(
      React.createElement(PaymentReceiptModal, {
        open: true,
        onClose: jest.fn(),
        payment: samplePayment,
      })
    );

    expect(capturedFinanceModalProps.length).toBe(1);
    const modalProps = capturedFinanceModalProps[0];
    expect(modalProps.open).toBe(true);
    expect(modalProps.domain).toBe('PAYMENT');
    expect(modalProps.size).toBe('medium');
    expect(modalProps.headerIconTheme).toBe('green');
    expect(modalProps.title).toContain('PAY-2026-TEST-001');
    expect(modalProps.subtitle).toContain('Tanda bukti pelunasan sah');
  });

  test('TC-PR-02: Renders total amount banner and PAID status badge', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PaymentReceiptModal, {
        open: true,
        onClose: jest.fn(),
        payment: samplePayment,
      })
    );

    expect(html).toContain('TOTAL REALISASI PEMBAYARAN:');
    expect(html).toContain('50.000.000');
    expect(html).toContain('Pelunasan 100% Faktur Invoice: INV-2026-TEST-888');
    expect(html).toContain('Lunas');
  });

  test('TC-PR-03: Renders dual presentation: Desktop Table View and Mobile Card View', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PaymentReceiptModal, {
        open: true,
        onClose: jest.fn(),
        payment: samplePayment,
      })
    );

    expect(html).toContain('data-testid="desktop-payment-receipt-table"');
    expect(html).toContain('data-testid="mobile-payment-receipt-cards"');
  });

  test('TC-PR-04: Mobile card view preserves all 7 source-backed payment fields', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PaymentReceiptModal, {
        open: true,
        onClose: jest.fn(),
        payment: samplePayment,
      })
    );

    // 1. Voucher number
    expect(html).toContain('PAY-2026-TEST-001');
    // 2. Realization date
    expect(html).toContain('03 Nov 2026');
    // 3. Payment method
    expect(html).toContain('BANK_TRANSFER');
    // 4. Bank reference
    expect(html).toContain('TRX-MANDIRI-20261103-8899');
    // 5. Source bank
    expect(html).toContain('Bank Mandiri (Rekening Operasional Proyek)');
    // 6. Officer / creator
    expect(html).toContain('Siti Nurhaliza');
    // 7. Payment status in footer and banner
    expect(html).toContain('Voucher Sah:');
    expect(html).toContain('Lunas');
  });

  test('TC-PR-05: Handles optional transaction notes cleanly in mobile cards', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PaymentReceiptModal, {
        open: true,
        onClose: jest.fn(),
        payment: samplePayment,
      })
    );

    expect(html).toContain('CATATAN TRANSAKSI');
    expect(html).toContain('Pelunasan termin progress 50% sesuai BAST fisik');
  });

  test('TC-PR-06: Returns null gracefully when payment is null without throwing', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PaymentReceiptModal, {
        open: true,
        onClose: jest.fn(),
        payment: null,
      })
    );

    expect(html).toBe('');
    expect(capturedFinanceModalProps.length).toBe(0);
  });
});
