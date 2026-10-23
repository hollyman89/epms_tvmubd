/**
 * EPMS — FINANCE INVOICE PAYMENT ACTION LEAK REGRESSION TEST
 *
 * Verifies that /finance/invoices (Daftar Invoice Terbit) strictly enforces:
 * 1. CASE 1: Invoice UNPAID & PaymentRequest APPROVED_FOR_PAYMENT:
 *    - "Bayar Sekarang" action button is NOT rendered
 *    - ProcessPaymentModal is NOT openable / does not exist on InvoicesPage
 *    - Read-only "Disetujui Pembayaran" tag is displayed
 * 2. CASE 2: Invoice UNPAID & PaymentRequest PENDING_DIRECTOR_APPROVAL:
 *    - No payment execution action is rendered
 *    - Informational "Menunggu Persetujuan Direktur" tag is displayed
 * 3. CASE 3: Invoice UNPAID & PaymentRequest NEEDS_REVISION:
 *    - No payment execution action is rendered
 *    - "Revisi Pengajuan" button is rendered
 * 4. CASE 4: Invoice PAID & valid payment record exists:
 *    - "Bukti Bayar" button REMAINS AVAILABLE
 *    - Read-only historical evidence is preserved
 * 5. CASE 5: Structural Governance Invariant:
 *    - ProcessPaymentModal is completely eliminated from InvoicesPage
 *    - Direct Invoice -> Payment execution from /finance/invoices is impossible
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import fs from 'fs';
import path from 'path';
import { Space, Button, Tag, Tooltip } from 'antd';
import {
  EyeOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { InvoiceDto, PaymentDto, PaymentRequestDto } from '@/services/finance.service';
import { getPaymentRequestActionState } from '@/components/finance/paymentRequestActionability';

describe('Invoice Page Payment Governance & Action Leak Regression', () => {
  // Helper simulating the exact column render logic in InvoicesPage
  const renderInvoiceRowActions = (
    r: InvoiceDto,
    activePrq: PaymentRequestDto | null,
    allPayments: PaymentDto[] = [],
    canProcessPayment: boolean = true
  ): string => {
    const isPaid = r.paymentStatus === 'PAID';
    const paymentRecord = isPaid
      ? allPayments.find((p) => Number(p.invoiceId) === Number(r.id)) || null
      : null;

    const uiState = getPaymentRequestActionState(r, activePrq, { isFinance: canProcessPayment });

    const element = React.createElement(
      Space,
      { size: 6, wrap: false },
      React.createElement(
        Button,
        {
          size: 'small',
          icon: React.createElement(EyeOutlined),
          id: `btn-detail-invoice-${r.id}`,
        },
        'Lihat Invoice'
      ),
      !isPaid && uiState.actionType === 'PENDING_DIRECTOR_APPROVAL'
        ? React.createElement(
            Tag,
            {
              color: 'orange',
              icon: React.createElement(ClockCircleOutlined),
              id: `tag-pending-director-${r.id}`,
            },
            'Menunggu Persetujuan Direktur'
          )
        : null,
      !isPaid && uiState.actionType === 'NEEDS_REVISION'
        ? React.createElement(
            Button,
            {
              size: 'small',
              type: 'primary',
              icon: React.createElement(SyncOutlined),
              id: `btn-resubmit-payment-request-${r.id}`,
            },
            'Revisi Pengajuan'
          )
        : null,
      !isPaid && uiState.actionType === 'APPROVED_FOR_PAYMENT'
        ? React.createElement(
            Tag,
            {
              color: 'cyan',
              icon: React.createElement(CheckCircleOutlined),
              id: `tag-approved-payment-${r.id}`,
            },
            'Disetujui Pembayaran'
          )
        : null,
      !isPaid && (uiState.actionType === 'SUBMIT_NEW' || uiState.actionType === 'CANNOT_SUBMIT')
        ? React.createElement(
            Tooltip,
            { title: uiState.tooltipMessage },
            React.createElement(
              'span',
              null,
              React.createElement(
                Button,
                {
                  size: 'small',
                  type: 'primary',
                  icon: React.createElement(SendOutlined),
                  id: `btn-submit-payment-request-${r.id}`,
                  disabled: !uiState.canSubmitNew,
                },
                'Ajukan Persetujuan'
              )
            )
          )
        : null,
      isPaid && paymentRecord
        ? React.createElement(
            Button,
            {
              size: 'small',
              icon: React.createElement(CheckCircleOutlined),
              id: `btn-receipt-${r.id}`,
            },
            'Bukti Bayar'
          )
        : null
    );

    return ReactDOMServer.renderToStaticMarkup(element);
  };

  const sampleInvoice: InvoiceDto = {
    id: 101,
    invoiceNumber: 'INV-20261021-001',
    poId: 50,
    invoiceDate: '2026-10-21',
    totalAmount: 75000000,
    status: 'UNPAID',
    paymentStatus: 'UNPAID',
    matchStatus: 'VERIFIED',
    createdAt: '2026-10-21T00:00:00.000Z',
  };

  test('CASE 1: Invoice UNPAID & PaymentRequest APPROVED_FOR_PAYMENT -> "Bayar Sekarang" NOT rendered, read-only tag displayed', () => {
    const approvedPrq: PaymentRequestDto = {
      id: 501,
      requestNumber: 'PRQ-20261021-001',
      invoiceId: 101,
      requestedAmount: 75000000,
      approvedAmount: 75000000,
      status: 'APPROVED_FOR_PAYMENT',
      requestedBy: 2,
      submittedAt: '2026-10-21T09:00:00Z',
    };

    const html = renderInvoiceRowActions(sampleInvoice, approvedPrq, [], true);

    // Assert: Bayar Sekarang MUST NOT be rendered
    expect(html).not.toContain('Bayar Sekarang');
    expect(html).not.toContain('btn-pay-approved-invoice');

    // Assert: Informational read-only status tag MUST be rendered
    expect(html).toContain('Disetujui Pembayaran');
    expect(html).toContain('tag-approved-payment-101');
    expect(html).toContain('Lihat Invoice');
  });

  test('CASE 2: Invoice UNPAID & PaymentRequest PENDING_DIRECTOR_APPROVAL -> No payment execution action', () => {
    const pendingPrq: PaymentRequestDto = {
      id: 502,
      requestNumber: 'PRQ-20261021-002',
      invoiceId: 101,
      requestedAmount: 75000000,
      status: 'PENDING_DIRECTOR_APPROVAL',
      requestedBy: 2,
      submittedAt: '2026-10-21T09:00:00Z',
    };

    const html = renderInvoiceRowActions(sampleInvoice, pendingPrq, [], true);

    expect(html).not.toContain('Bayar Sekarang');
    expect(html).not.toContain('btn-pay-approved-invoice');
    expect(html).toContain('Menunggu Persetujuan Direktur');
    expect(html).toContain('tag-pending-director-101');
    expect(html).toContain('Lihat Invoice');
  });

  test('CASE 3: Invoice UNPAID & PaymentRequest NEEDS_REVISION -> No payment execution action', () => {
    const revisionPrq: PaymentRequestDto = {
      id: 503,
      requestNumber: 'PRQ-20261021-003',
      invoiceId: 101,
      requestedAmount: 75000000,
      status: 'NEEDS_REVISION',
      requestedBy: 2,
      submittedAt: '2026-10-21T09:00:00Z',
      revisionNotes: 'Perbaiki lampiran BAST',
    };

    const html = renderInvoiceRowActions(sampleInvoice, revisionPrq, [], true);

    expect(html).not.toContain('Bayar Sekarang');
    expect(html).not.toContain('btn-pay-approved-invoice');
    expect(html).toContain('Revisi Pengajuan');
    expect(html).toContain('btn-resubmit-payment-request-101');
    expect(html).toContain('Lihat Invoice');
  });

  test('CASE 4: Invoice PAID & Payment record exists -> "Bukti Bayar" remains accessible', () => {
    const paidInvoice: InvoiceDto = {
      ...sampleInvoice,
      paymentStatus: 'PAID',
      status: 'PAID',
    };

    const paymentRecord: PaymentDto = {
      id: 901,
      invoiceId: 101,
      paymentNumber: 'PAY-20261021-001',
      paymentDate: '2026-10-21T10:00:00Z',
      amount: 75000000,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TRX-123456',
      createdAt: '2026-10-21T10:00:00Z',
    };

    const html = renderInvoiceRowActions(paidInvoice, null, [paymentRecord], true);

    expect(html).not.toContain('Bayar Sekarang');
    expect(html).toContain('Bukti Bayar');
    expect(html).toContain('btn-receipt-101');
    expect(html).toContain('Lihat Invoice');
  });

  test('CASE 5: Structural Invariant: InvoicesPage source code does NOT contain ProcessPaymentModal or Bayar Sekarang', () => {
    const pagePath = path.resolve(__dirname, '../../../app/(dashboard)/finance/invoices/page.tsx');
    const pageContent = fs.readFileSync(pagePath, 'utf8');

    // 1. ProcessPaymentModal must not be imported
    expect(pageContent).not.toMatch(/import.*ProcessPaymentModal/);
    expect(pageContent).not.toContain('const ProcessPaymentModal');

    // 2. ProcessPaymentModal must not be rendered as JSX
    expect(pageContent).not.toContain('<ProcessPaymentModal');

    // 3. "Bayar Sekarang" action button must not exist
    expect(pageContent).not.toContain('Bayar Sekarang');
    expect(pageContent).not.toContain('btn-pay-approved-invoice');

    // 4. selectedInvoiceForPay state must not exist (word boundary to not false-match selectedInvoiceForPaymentRequest)
    expect(pageContent).not.toMatch(/\bselectedInvoiceForPay\b/);
    expect(pageContent).not.toContain('isProcessPaymentModalOpen');

    // 5. Bukti Bayar / PaymentReceiptModal must remain
    expect(pageContent).toContain('PaymentReceiptModal');
    expect(pageContent).toContain('Bukti Bayar');
  });
});
