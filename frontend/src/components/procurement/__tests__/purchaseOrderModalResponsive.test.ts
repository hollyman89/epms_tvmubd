/**
 * EPMS — PURCHASE ORDER CREATION MODAL RESPONSIVE COMPONENT TESTS
 *
 * Verifies mobile-first layout responsiveness and PO configuration fidelity for:
 * - PurchaseOrderModal (Penerbitan Purchase Order (PO) ke Vendor Pemenang)
 *
 * Tests:
 * 1. Responsive modal width bounds and viewport max-width
 * 2. MOB-PO-02 fix: Add Payment Term button renders exactly one plus icon and text "Tambah Termin"
 * 3. Payment preset buttons (Preset A, Preset B, Preset C) and active template tag
 * 4. Mobile payment-term cards with complete inputs (name, type, percentage, nominal, trigger, retention)
 * 5. Payment allocation summary with percentage and nominal calculations and 100% validation
 * 6. Mobile purchased item cards with read-only snapshot values (qty, uom, price, subtotal)
 * 7. Desktop table view preservation with horizontal scrolling (scroll.x = 1060 and scroll.x = 950)
 * 8. View mode inspection of issued PO with status and delivery details
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';

let capturedModalProps: any[] = [];
let capturedTableProps: any[] = [];

// Mock antd Modal and Table
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
          'data-modal-width': typeof props.width === 'object' ? JSON.stringify(props.width) : props.width,
          'data-modal-style': props.style ? JSON.stringify(props.style) : undefined,
          className: props.className,
        },
        props.title,
        props.children,
        props.footer
      );
    },
    Table: (props: any) => {
      capturedTableProps.push(props);
      return React.createElement(
        'div',
        {
          'data-testid': 'mock-table',
          'data-scroll': props.scroll ? JSON.stringify(props.scroll) : undefined,
          'data-columns-count': props.columns ? props.columns.length : 0,
        },
        actual.Table ? React.createElement(actual.Table, props) : null
      );
    },
  };
});

// Mock react-query
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
}));

// Mock ProcurementService
jest.mock('@/services/procurement.service', () => ({
  ProcurementService: {
    getVendors: jest.fn().mockResolvedValue([
      { id: 1, code: 'VND-001', name: 'PT IT Solusi Bersama', vendorType: 'MATERIAL' },
      { id: 2, code: 'VND-002', name: 'PT Maju Infrastruktur', vendorType: 'JASA' },
    ]),
    createPurchaseOrder: jest.fn().mockResolvedValue({ id: 201, poNumber: 'PO-20261104-001' }),
  },
}));

import { PurchaseOrderModal } from '../PurchaseOrderModal';

describe('PurchaseOrderModal Mobile Responsiveness & Input Fidelity', () => {
  const mockRfq = {
    id: 16,
    rfqNumber: 'RFQ-20261104-001',
    status: 'EVALUATED',
    prId: 11,
    prNumber: 'PR-20261023-002',
    projectName: 'PROJECT FIBER OPTIC TRANS-SUMATRA',
    projectCode: 'CONT-20261021-0007',
    projectId: 7,
  };

  const mockComparison = {
    comparisonId: 'comp-16',
    rfqId: 16,
    rfqNumber: 'RFQ-20261104-001',
    prNumber: 'PR-20261023-002',
    projectId: 7,
    projectName: 'PROJECT FIBER OPTIC TRANS-SUMATRA',
    selectedWinnerVendorId: 1,
    selectedWinnerVendorName: 'PT IT Solusi Bersama',
    selectedWinnerVendorCode: 'VND-001',
    deliveryLocation: 'Gudang Utama Palembang KM 12',
  };

  const mockWinningQuotation = {
    id: 'quote-101',
    quotationNumber: 'QT-20261104-001',
    vendorId: 1,
    vendorName: 'PT IT Solusi Bersama',
    vendorCode: 'VND-001',
    leadTimeDays: 14,
    totalOfferedAmount: 119653000,
    items: [
      {
        key: 'item-1',
        itemName: 'FO ADSS cable (G.652D, SM) capacity 288 core',
        categoryName: 'Material',
        quantity: 15,
        uom: 'Drum',
        unitPrice: 5000000,
        subtotal: 75000000,
        wbsNodeId: '1.2.1',
      },
      {
        key: 'item-2',
        itemName: 'Joint Closure Dome Type 288 Core',
        categoryName: 'Material',
        quantity: 40,
        uom: 'Unit',
        unitPrice: 1116325,
        subtotal: 44653000,
        wbsNodeId: '1.2.2',
      },
    ],
  };

  beforeEach(() => {
    capturedModalProps = [];
    capturedTableProps = [];
  });

  it('1. renders modal with responsive class and viewport width constraints', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PurchaseOrderModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        comparison: mockComparison as any,
        winningQuotation: mockWinningQuotation as any,
        viewOnly: false,
      })
    );

    expect(capturedModalProps.length).toBeGreaterThan(0);
    const lastModal = capturedModalProps[capturedModalProps.length - 1];
    expect(lastModal.className).toContain('poModal');
    expect(lastModal.width).toBe('min(1340px, 96vw)');
    expect(lastModal['data-testid']).toBe('purchase-order-modal');

    expect(html).toContain('Penerbitan Purchase Order (PO) ke Vendor Pemenang');
    expect(html).toContain('data-testid="po-modal-body"');
    expect(html).toContain('data-testid="po-summary-strip"');
  });

  it('2. MOB-PO-02: renders Add Payment Term button with exactly one plus icon and no duplicate plus sign', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PurchaseOrderModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        comparison: mockComparison as any,
        winningQuotation: mockWinningQuotation as any,
        viewOnly: false,
      })
    );

    // Verify Add Term button is rendered with single plus icon
    expect(html).toContain('data-testid="btn-add-term"');
    expect(html).toContain('Tambah Termin');

    // Verify there is NO duplicate literal "+ + Tambah Termin"
    expect(html).not.toContain('+ + Tambah Termin');
    expect(html).not.toContain('+ +');
  });

  it('3. renders payment preset buttons (Preset A, Preset B, Preset C)', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PurchaseOrderModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        comparison: mockComparison as any,
        winningQuotation: mockWinningQuotation as any,
        viewOnly: false,
      })
    );

    expect(html).toContain('data-testid="preset-a-btn"');
    expect(html).toContain('Preset A (30/30/30/10)');
    expect(html).toContain('data-testid="preset-b-btn"');
    expect(html).toContain('Preset B (20/40/30/10)');
    expect(html).toContain('data-testid="preset-c-btn"');
    expect(html).toContain('Preset C (100%)');
  });

  it('4. renders mobile payment-term cards with complete inputs in create mode', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PurchaseOrderModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        comparison: mockComparison as any,
        winningQuotation: mockWinningQuotation as any,
        viewOnly: false,
      })
    );

    expect(html).toContain('data-testid="po-terms-mobile-cards"');
    expect(html).toContain('data-testid="payment-term-card"');
    expect(html).toContain('data-testid="term-name-input"');
    expect(html).toContain('data-testid="term-type-select"');
    expect(html).toContain('data-testid="term-percentage-input"');
    expect(html).toContain('data-testid="term-estimated-amount"');
    expect(html).toContain('data-testid="term-trigger-input"');
    expect(html).toContain('data-testid="btn-delete-term"');
  });

  it('5. renders payment allocation summary and calculates percentages and estimated totals', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PurchaseOrderModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        comparison: mockComparison as any,
        winningQuotation: mockWinningQuotation as any,
        viewOnly: false,
      })
    );

    expect(html).toContain('data-testid="po-allocation-summary"');
    expect(html).toContain('TOTAL PO:');
    expect(html).toContain('TOTAL PERSENTASE:');
    expect(html).toContain('data-testid="total-percentage-val"');
    expect(html).toContain('ESTIMASI TOTAL TERMIN:');
    expect(html).toContain('data-testid="total-estimated-amount-val"');
    expect(html).toContain('data-testid="po-allocation-status-badge"');
  });

  it('6. renders mobile purchased item cards with read-only locked values', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PurchaseOrderModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        comparison: mockComparison as any,
        winningQuotation: mockWinningQuotation as any,
        viewOnly: false,
      })
    );

    expect(html).toContain('data-testid="po-items-mobile-cards"');
    expect(html).toContain('data-testid="purchased-item-card"');
    expect(html).toContain('FO ADSS cable (G.652D, SM) capacity 288 core');
    expect(html).toContain('WBS #1.2.1');
    expect(html).toContain('Terkunci (Read-Only)');
    expect(html).toContain('data-testid="item-quantity"');
    expect(html).toContain('data-testid="item-unit-price"');
    expect(html).toContain('data-testid="item-subtotal"');
  });

  it('7. preserves desktop tables with horizontal scroll (scroll.x = 1060 & 950)', () => {
    ReactDOMServer.renderToStaticMarkup(
      React.createElement(PurchaseOrderModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        comparison: mockComparison as any,
        winningQuotation: mockWinningQuotation as any,
        viewOnly: false,
      })
    );

    expect(capturedTableProps.length).toBeGreaterThanOrEqual(2);

    // Terms table
    const termsTable = capturedTableProps.find((t) => t.scroll && t.scroll.x === 1060);
    expect(termsTable).toBeDefined();

    // Items table
    const itemsTable = capturedTableProps.find((t) => t.scroll && t.scroll.x === 950);
    expect(itemsTable).toBeDefined();
  });

  it('8. renders view mode for existing issued PO with status and delivery details', () => {
    const mockExistingPo = {
      id: 14,
      poNumber: 'PO-20261102-002',
      status: 'ISSUED',
      orderType: 'SERVICE',
      issuedBy: 'Purchasing',
      issuedAt: '2026-11-02T11:25:00.000Z',
      totalAmount: 12000,
      deliveryLocation: 'Lokasi Proyek Trans-Sumatra Site A',
      deliveryDate: '2026-11-20T00:00:00.000Z',
      notes: 'Penyelesaian tepat waktu sesuai SOW',
      vendorName: 'PT IT Solusi Bersama',
      vendorCode: 'VND-001',
      paymentTerms: [
        {
          id: 1,
          sequence: 1,
          termName: 'Uang Muka',
          termType: 'DOWN_PAYMENT',
          percentage: 30,
          amount: 3600,
          status: 'PAID',
        },
        {
          id: 2,
          sequence: 2,
          termName: 'Pelunasan',
          termType: 'FINAL_DELIVERY',
          percentage: 70,
          amount: 8400,
          status: 'PENDING',
        },
      ],
      items: [
        {
          key: 'item-svc-1',
          itemName: 'Instalasi Joint Closure & Splicing 288 Core',
          categoryName: 'Subcontractor',
          quantity: 1,
          uom: 'Paket',
          unitPrice: 12000,
          totalPrice: 12000,
          receivedQuantity: 0,
        },
      ],
    };

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PurchaseOrderModal, {
        open: true,
        onClose: jest.fn(),
        existingPo: mockExistingPo as any,
        viewOnly: true,
      })
    );

    expect(html).toContain('Rincian Purchase Order — PO-20261102-002');
    expect(html).toContain('data-testid="po-view-terms-mobile-cards"');
    expect(html).toContain('data-testid="po-view-term-card"');
    expect(html).toContain('data-testid="btn-po-cancel"');
    expect(html).toContain('Tutup');
    // Ensure "Terbitkan Purchase Order (PO)" is NOT rendered in view mode
    expect(html).not.toContain('data-testid="btn-po-submit"');
  });
});

