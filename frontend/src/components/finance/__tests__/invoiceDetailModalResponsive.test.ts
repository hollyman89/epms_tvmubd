/**
 * EPMS — FINANCE PHASE 3: INVOICE DETAIL, VERIFY & REJECT MODAL RESPONSIVE UNIT TESTS
 *
 * Verifies that:
 * 1. Primary InvoiceDetailModal integrates with ResponsiveFinanceModal with domain="INVOICE" and size="full".
 * 2. Primary modal renders structured header, status indicators in footerExtra, and responsive footerActions.
 * 3. Items breakdown renders dual view: Desktop Table View + Mobile Card View.
 * 4. Mobile item cards preserve all canonical item metadata (name, spec, category, WBS, quantities, unit price, total).
 * 5. Payment history renders dual view: Desktop Table View + Mobile Payment Cards.
 * 6. Verify Invoice submodal integrates with ResponsiveFinanceModal with domain="APPROVAL", size="compact", hideSsotBadge.
 * 7. Reject Invoice submodal integrates with ResponsiveFinanceModal with domain="FORM", size="compact", hideSsotBadge, headerIconTheme="red".
 * 8. Graceful fallback on empty items and payments.
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
          'data-hide-ssot': props.hideSsotBadge ? 'true' : 'false',
          'data-primary-danger': props.isPrimaryDanger ? 'true' : 'false',
          'data-primary-text': props.primaryActionText,
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

// Mock AuthContext
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Finance Lead', role: 'FINANCE_LEAD' },
    hasRole: () => true,
    hasPermission: () => true,
  }),
}));

// Mock procurement and finance services
jest.mock('@/services/procurement.service', () => ({
  ProcurementService: {
    getGoodsReceipts: jest.fn().mockResolvedValue([]),
    getGoodsReceipt: jest.fn().mockResolvedValue(null),
    getApprovedServiceClaims: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/services/finance.service', () => ({
  FinanceService: {
    getMatchingDetail: jest.fn().mockResolvedValue({
      isMatched: true,
      overallStatus: 'MATCHED',
      invoiceAmount: 150000000,
      totalAmount: 150000000,
      poAmount: 150000000,
      grAmount: 150000000,
      mismatchCodes: [],
      mismatches: [],
    }),
    verifyInvoice: jest.fn().mockResolvedValue({ success: true }),
    rejectInvoice: jest.fn().mockResolvedValue({ success: true }),
  },
  MISMATCH_DEFINITIONS: {},
}));

import InvoiceDetailModal from '../InvoiceDetailModal';

describe('EPMS Finance Phase 3 — InvoiceDetailModal Responsive Redesign', () => {
  const sampleInvoiceWithItems: any = {
    id: 201,
    invoiceNumber: 'INV-2026-TEST-888',
    status: 'VERIFIED',
    totalAmount: 150000000,
    amount: 150000000,
    taxAmount: 16500000,
    subtotal: 135000000,
    invoiceDate: '2026-11-01',
    dueDate: '2026-12-01',
    paymentStatus: 'PARTIALLY_PAID',
    purchaseOrder: {
      id: 101,
      poNumber: 'PO-2026-TEST-001',
      orderType: 'MATERIAL',
      projectName: 'Pembangunan Gardu Induk UBD',
      projectId: 42,
      projectCode: 'UBD-GI-01',
      totalAmount: 150000000,
      vendor: {
        id: 77,
        name: 'PT Mitra Solusi Mandiri',
        code: 'VND-077',
      },
    },
    items: [
      {
        id: 1,
        itemName: 'Trafo Distribusi 20kV / 400V 630kVA',
        specification: 'Step-down oil immersed transformer',
        categoryName: 'Electrical Equipment',
        wbsNodeId: '1.2.3.1',
        quantity: 2,
        uom: 'Unit',
        unitPrice: 60000000,
        totalPrice: 120000000,
      },
      {
        id: 2,
        itemName: 'Panel Kubikel TM 24kV Incomer',
        specification: 'Standard PLN LMK certified',
        categoryName: 'Electrical Panel',
        wbsNodeId: '1.2.3.2',
        quantity: 1,
        uom: 'Unit',
        unitPrice: 30000000,
        totalPrice: 30000000,
      },
    ],
    payments: [
      {
        id: 501,
        paymentNumber: 'PAY-2026-001',
        paymentDate: '2026-11-03',
        amount: 50000000,
        createdAt: '2026-11-03T10:00:00Z',
      },
      {
        id: 502,
        paymentNumber: 'PAY-2026-002',
        paymentDate: '2026-11-04',
        amount: 50000000,
        createdAt: '2026-11-04T14:30:00Z',
      },
    ],
  };

  beforeEach(() => {
    capturedFinanceModalProps = [];
    jest.clearAllMocks();
  });

  test('TC-P3-01: Primary modal mounts ResponsiveFinanceModal with domain="INVOICE" and size="full"', () => {
    ReactDOMServer.renderToStaticMarkup(
      React.createElement(InvoiceDetailModal, {
        open: true,
        onClose: jest.fn(),
        invoice: sampleInvoiceWithItems,
      })
    );

    expect(capturedFinanceModalProps.length).toBeGreaterThanOrEqual(1);
    const primaryModalProps = capturedFinanceModalProps.find(
      (p) => p.domain === 'INVOICE'
    );
    expect(primaryModalProps).toBeDefined();
    expect(primaryModalProps.open).toBe(true);
    expect(primaryModalProps.size).toBe('full');
    expect(primaryModalProps.title).toContain('INV-2026-TEST-888');
    expect(primaryModalProps.subtitle).toContain('Finance Matching Engine');
  });

  test('TC-P3-02: Primary modal provides authoritative footerExtra and responsive footerActions', () => {
    ReactDOMServer.renderToStaticMarkup(
      React.createElement(InvoiceDetailModal, {
        open: true,
        onClose: jest.fn(),
        invoice: sampleInvoiceWithItems,
      })
    );

    const primaryModalProps = capturedFinanceModalProps.find(
      (p) => p.domain === 'INVOICE'
    );
    expect(primaryModalProps).toBeDefined();
    expect(primaryModalProps.footerExtra).toBeDefined();
    expect(primaryModalProps.footerActions).toBeDefined();

    const footerExtraHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement('div', null, primaryModalProps.footerExtra)
    );
    expect(footerExtraHtml).toContain('INV-2026-TEST-888');
    expect(footerExtraHtml).toContain('Nomor Faktur:');

    const footerActionsHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement('div', null, primaryModalProps.footerActions)
    );
    expect(footerActionsHtml).toContain('Tutup');
  });

  test('TC-P3-03: Renders dual presentation for Items Breakdown (Desktop Table and Mobile Cards)', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(InvoiceDetailModal, {
        open: true,
        onClose: jest.fn(),
        invoice: sampleInvoiceWithItems,
      })
    );

    // Desktop table container
    expect(html).toContain('data-testid="desktop-items-table"');
    // Mobile card container
    expect(html).toContain('data-testid="mobile-items-cards"');
  });

  test('TC-P3-04: Mobile items cards preserve all canonical item metadata and attributes', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(InvoiceDetailModal, {
        open: true,
        onClose: jest.fn(),
        invoice: sampleInvoiceWithItems,
      })
    );

    // Card 1: Trafo Distribusi
    expect(html).toContain('data-testid="mobile-item-card-0"');
    expect(html).toContain('Trafo Distribusi 20kV / 400V 630kVA');
    expect(html).toContain('Step-down oil immersed transformer');
    expect(html).toContain('Electrical Equipment');
    expect(html).toContain('WBS: 1.2.3.1');

    // Card 2: Panel Kubikel
    expect(html).toContain('data-testid="mobile-item-card-1"');
    expect(html).toContain('Panel Kubikel TM 24kV Incomer');
    expect(html).toContain('Standard PLN LMK certified');
    expect(html).toContain('Electrical Panel');
    expect(html).toContain('WBS: 1.2.3.2');
  });

  test('TC-P3-05: Renders dual presentation for Payment History with complete payment cards', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(InvoiceDetailModal, {
        open: true,
        onClose: jest.fn(),
        invoice: sampleInvoiceWithItems,
      })
    );

    // Desktop payment history table
    expect(html).toContain('data-testid="desktop-payment-history-table"');
    // Mobile payment history cards
    expect(html).toContain('data-testid="mobile-payment-history-cards"');
    expect(html).toContain('data-testid="payment-card-0"');
    expect(html).toContain('PAY-2026-001');
    expect(html).toContain('data-testid="payment-card-1"');
    expect(html).toContain('PAY-2026-002');
  });

  test('TC-P3-06: Verify submodal is configured with domain="APPROVAL", size="compact", hideSsotBadge', () => {
    ReactDOMServer.renderToStaticMarkup(
      React.createElement(InvoiceDetailModal, {
        open: true,
        onClose: jest.fn(),
        invoice: sampleInvoiceWithItems,
      })
    );

    const verifyModalProps = capturedFinanceModalProps.find(
      (p) => p.domain === 'APPROVAL'
    );
    expect(verifyModalProps).toBeDefined();
    expect(verifyModalProps.size).toBe('compact');
    expect(verifyModalProps.hideSsotBadge).toBe(true);
    expect(verifyModalProps.headerIconTheme).toBe('green');
    expect(verifyModalProps.primaryActionText).toContain('Verifikasi');
  });

  test('TC-P3-07: Reject submodal is configured with domain="FORM", size="compact", hideSsotBadge, headerIconTheme="red", danger primary action', () => {
    ReactDOMServer.renderToStaticMarkup(
      React.createElement(InvoiceDetailModal, {
        open: true,
        onClose: jest.fn(),
        invoice: sampleInvoiceWithItems,
      })
    );

    const rejectModalProps = capturedFinanceModalProps.find(
      (p) => p.domain === 'FORM'
    );
    expect(rejectModalProps).toBeDefined();
    expect(rejectModalProps.size).toBe('compact');
    expect(rejectModalProps.hideSsotBadge).toBe(true);
    expect(rejectModalProps.headerIconTheme).toBe('red');
    expect(rejectModalProps.isPrimaryDanger).toBe(true);
    expect(rejectModalProps.primaryActionText).toBe('Tolak Invoice');
  });

  test('TC-P3-08: Gracefully handles invoice without items or payments without throwing', () => {
    const emptyInvoice: any = {
      id: 202,
      invoiceNumber: 'INV-EMPTY-001',
      status: 'PENDING_MATCHING',
      totalAmount: 0,
      purchaseOrder: {
        id: 102,
        poNumber: 'PO-EMPTY',
      },
    };

    expect(() => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(InvoiceDetailModal, {
          open: true,
          onClose: jest.fn(),
          invoice: emptyInvoice,
        })
      );
    }).not.toThrow();
  });

  test('TC-P3-09: Renders dual presentation for Invoice Metadata (desktop table and mobile cards)', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(InvoiceDetailModal, {
        open: true,
        onClose: jest.fn(),
        invoice: sampleInvoiceWithItems,
      })
    );

    expect(html).toContain('data-testid="desktop-invoice-metadata"');
    expect(html).toContain('data-testid="mobile-invoice-metadata"');
    expect(html).toContain('INV-2026-TEST-888');
  });

  test('TC-P3-10: Renders vertically structured mismatch warning cards with badge, code, and description', () => {
    const mismatchInvoice: any = {
      ...sampleInvoiceWithItems,
      id: 203,
      matchingResult: {
        isMatched: false,
        overallStatus: 'MISMATCH',
        mismatches: [
          {
            code: 'PRICE_EXCEEDED_PO',
            message: 'Harga satuan item kabel melebihi batas toleransi PO',
          },
        ],
      },
    };

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(InvoiceDetailModal, {
        open: true,
        onClose: jest.fn(),
        invoice: mismatchInvoice,
      })
    );

    expect(html).toContain('data-testid="mismatch-card-0"');
    expect(html).toContain('PRICE_EXCEEDED_PO');
    expect(html).toContain('Harga satuan item kabel melebihi batas toleransi PO');
  });
});
