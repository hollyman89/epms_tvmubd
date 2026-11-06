/**
 * EPMS — FINANCE PHASE 2: CREATE INVOICE MODAL RESPONSIVE UNIT TESTS
 *
 * Verifies that CreateInvoiceModal:
 * 1. Integrates with ResponsiveFinanceModal with domain="INVOICE" and size="full".
 * 2. Renders structured header with title, subtitle, and icon.
 * 3. Renders SSOT Authority badge and responsive action buttons.
 * 4. Renders dual presentation: Desktop Table View + Mobile Card View.
 * 5. Preserves all item metadata in Mobile Card View (canonical item name, spec, category, WBS, quantities, unit price, subtotal).
 * 6. Handles empty state gracefully across both views.
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
    createInvoice: jest.fn().mockResolvedValue({ id: 1, invoiceNumber: 'INV-TEST' }),
  },
}));

import { CreateInvoiceModal } from '../CreateInvoiceModal';

describe('EPMS Finance Phase 2 — CreateInvoiceModal Responsive Redesign', () => {
  const sampleMaterialPo = {
    id: 101,
    poNumber: 'PO-2026-TEST-001',
    projectName: 'Pembangunan Gardu Induk UBD',
    projectId: 42,
    vendorName: 'PT Mitra Sukses Mandiri',
    vendorCode: 'VND-001',
    totalAmount: 150000000,
    orderType: 'MATERIAL',
    status: 'ISSUED',
    paymentTerms: 'Termin bertahap',
    items: [
      {
        id: 1,
        itemName: 'Kabel Tembaga NYY 4x16mm',
        specification: 'Standard SPLN 42-2:1992',
        categoryName: 'Material',
        wbsNodeId: '1.2.3',
        quantity: 100,
        receivedQuantity: 50,
        uom: 'Meter',
        unitPrice: 1000000,
        totalPrice: 100000000,
      },
      {
        id: 2,
        itemName: 'Konektor Terminal Kabel 16mm',
        specification: 'Tembaga murni heavy duty',
        categoryName: 'Material',
        wbsNodeId: '1.2.4',
        quantity: 50,
        receivedQuantity: 50,
        uom: 'Pcs',
        unitPrice: 1000000,
        totalPrice: 50000000,
      },
    ],
  };

  const sampleServicePo = {
    id: 102,
    poNumber: 'PO-2026-SRV-002',
    projectName: 'Instalasi Jaringan Telekomunikasi TVM',
    projectId: 43,
    vendorName: 'PT Solusi Fiber Prima',
    vendorCode: 'VND-002',
    totalAmount: 80000000,
    orderType: 'SERVICE',
    status: 'ISSUED',
    paymentTerms: 'Termin bertahap',
    items: [
      {
        id: 10,
        itemName: 'Jasa Pemasangan & Terminasi Kabel Fiber Optik',
        specification: 'Kapasitas 96 core OTDR verified',
        categoryName: 'Jasa / Subkon',
        wbsNodeId: '2.1.1',
        quantity: 1,
        receivedQuantity: 1,
        uom: 'Lot',
        unitPrice: 80000000,
        totalPrice: 80000000,
      },
    ],
  };

  beforeEach(() => {
    capturedFinanceModalProps = [];
  });

  describe('1. ResponsiveFinanceModal Integration', () => {
    it('uses ResponsiveFinanceModal with domain="INVOICE" and size="full"', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(CreateInvoiceModal, {
          open: true,
          onClose: jest.fn(),
          po: sampleMaterialPo,
          canCreateInvoice: true,
        })
      );

      expect(capturedFinanceModalProps.length).toBe(1);
      const modalProps = capturedFinanceModalProps[0];
      expect(modalProps.domain).toBe('INVOICE');
      expect(modalProps.size).toBe('full');
      expect(modalProps.destroyOnClose).toBe(true);
    });

    it('sets contextual title containing the PO number and descriptive subtitle', () => {
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(CreateInvoiceModal, {
          open: true,
          onClose: jest.fn(),
          po: sampleMaterialPo,
          canCreateInvoice: true,
        })
      );

      const modalProps = capturedFinanceModalProps[0];
      expect(modalProps.title).toContain('PO-2026-TEST-001');
      expect(modalProps.subtitle).toContain('Pembuatan faktur penagihan vendor berbasis Purchase Order');
    });

    it('renders SSOT authority badge in the footer', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(CreateInvoiceModal, {
          open: true,
          onClose: jest.fn(),
          po: sampleMaterialPo,
          canCreateInvoice: true,
        })
      );

      expect(html).toContain('BACKEND SSOT');
      expect(html).toContain('MATCHING ENGINE');
    });
  });

  describe('2. Desktop Table & Mobile Card Dual Views', () => {
    it('renders both desktop table and mobile card containers in DOM for Material PO items', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(CreateInvoiceModal, {
          open: true,
          onClose: jest.fn(),
          po: sampleMaterialPo,
          canCreateInvoice: true,
        })
      );

      // Desktop table container presence
      expect(html).toContain('data-testid="desktop-po-items-table"');
      // Mobile card container presence
      expect(html).toContain('data-testid="mobile-po-items-cards"');
      // Mobile item cards presence
      expect(html).toContain('data-testid="po-item-card-0"');
      expect(html).toContain('data-testid="po-item-card-1"');
    });

    it('preserves all item metadata in the mobile card view for Material PO', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(CreateInvoiceModal, {
          open: true,
          onClose: jest.fn(),
          po: sampleMaterialPo,
          canCreateInvoice: true,
        })
      );

      // Card 0 metadata
      expect(html).toContain('Kabel Tembaga NYY 4x16mm');
      expect(html).toContain('Standard SPLN 42-2:1992');
      expect(html).toContain('Material');
      expect(html).toContain('WBS #1.2.3');
      expect(html).toContain('100 Meter');
      expect(html).toContain('50 / 100'); // Realization tag

      // Card 1 metadata
      expect(html).toContain('Konektor Terminal Kabel 16mm');
      expect(html).toContain('Tembaga murni heavy duty');
      expect(html).toContain('WBS #1.2.4');
    });

    it('correctly displays Service PO realization status and tags in mobile card view', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(CreateInvoiceModal, {
          open: true,
          onClose: jest.fn(),
          po: sampleServicePo,
          canCreateInvoice: true,
        })
      );

      expect(html).toContain('data-testid="mobile-po-items-cards"');
      expect(html).toContain('Jasa Pemasangan &amp; Terminasi Kabel Fiber Optik');
      expect(html).toContain('Kapasitas 96 core OTDR verified');
      expect(html).toContain('Jasa / Subkon');
      expect(html).toContain('WBS #2.1.1');
    });
  });

  describe('3. Empty State Handling', () => {
    it('renders empty card state when po items list is empty', () => {
      const emptyPo = {
        ...sampleMaterialPo,
        items: [],
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(CreateInvoiceModal, {
          open: true,
          onClose: jest.fn(),
          po: emptyPo,
          canCreateInvoice: true,
        })
      );

      expect(html).toContain('Belum ada item kontrak PO');
    });
  });

  describe('4. Mobile UI Refinements & TECNO CM7 Android Feedback', () => {
    const poWithPaymentTerms = {
      ...sampleMaterialPo,
      paymentTerms: [
        {
          id: 501,
          sequence: 1,
          termName: 'Down Payment Uang Muka',
          percentage: 20,
          amount: 30000000,
          termType: 'DP',
          status: 'PENDING',
        },
        {
          id: 502,
          sequence: 2,
          termName: 'Progress Lapangan Fisik 50%',
          percentage: 50,
          amount: 75000000,
          termType: 'PROGRESS',
          status: 'PENDING',
        },
      ],
    };

    it('renders compact responsive PO summary card and grid', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(CreateInvoiceModal, {
          open: true,
          onClose: jest.fn(),
          po: poWithPaymentTerms,
          canCreateInvoice: true,
        })
      );

      expect(html).toContain('data-testid="po-summary-card"');
      expect(html).toContain('data-testid="po-summary-grid"');
      expect(html).toContain('PROYEK');
      expect(html).toContain('PURCHASE ORDER');
      expect(html).toContain('VENDOR PENYEDIA');
      expect(html).toContain('KONFIGURASI TERMIN');
    });

    it('renders anti-truncation structured options in payment term dropdown', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(CreateInvoiceModal, {
          open: true,
          onClose: jest.fn(),
          po: poWithPaymentTerms,
          canCreateInvoice: true,
          initialPaymentTermId: 501,
        })
      );

      expect(html).toContain('data-testid="payment-term-select"');
      expect(html).toContain('Down Payment Uang Muka');
      expect(html).toContain('20%');
      expect(html).toContain('30.000.000');
    });

    it('renders distinct rows in footerExtra for Backend SSOT and Matching Engine', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(CreateInvoiceModal, {
          open: true,
          onClose: jest.fn(),
          po: poWithPaymentTerms,
          canCreateInvoice: true,
        })
      );

      expect(html).toContain('data-testid="footer-extra-container"');
      expect(html).toContain('data-testid="footer-authority-row"');
      expect(html).toContain('data-testid="footer-evaluation-row"');
      expect(html).toContain('BACKEND SSOT');
      expect(html).toContain('MATCHING ENGINE');
      expect(html).toContain('data-testid="footer-actions-wrapper"');
      expect(html).toContain('Batal');
      expect(html).toContain('Terbitkan Invoice');
    });

    it('provides scroll container clearance above the pinned footer', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(CreateInvoiceModal, {
          open: true,
          onClose: jest.fn(),
          po: poWithPaymentTerms,
          canCreateInvoice: true,
        })
      );

      expect(html).toContain('data-testid="modal-scroll-content"');
    });
  });
});

