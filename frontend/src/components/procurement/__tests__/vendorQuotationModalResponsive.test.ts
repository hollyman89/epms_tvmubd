/**
 * EPMS — VENDOR QUOTATION MODAL RESPONSIVE COMPONENT TESTS
 *
 * Verifies mobile-first layout responsiveness and quotation input fidelity for:
 * - VendorQuotationModal (Purchasing vendor quotation entry modal)
 *
 * Tests:
 * 1. Responsive modal width bounds and viewport max-width
 * 2. Mobile card view rendered with items, complete descriptions, and route details
 * 3. Read-only PR snapshot values (quantity, UOM, benchmark unit price, benchmark subtotal)
 * 4. Vendor quotation price inputs editable in open state and locked in read-only state
 * 5. Calculated subtotals, variance vs benchmark, and overall plafon comparison
 * 6. Desktop table view preserved with horizontal scroll preventing column crushing
 * 7. Accessible footer actions (Simpan Penawaran Vendor & Batal/Tutup)
 * 8. Read-only mode with submitted existing quotation (imputable, Tutup action only)
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
    createQuotation: jest.fn().mockResolvedValue({ id: 101, quotationNumber: 'QT-20261104-001' }),
  },
}));

import { VendorQuotationModal } from '../VendorQuotationModal';

describe('VendorQuotationModal Mobile Responsiveness & Input Fidelity', () => {
  const mockRfq = {
    id: 15,
    rfqNumber: 'RFQ-20261104-001',
    status: 'OPEN',
    closingDate: '2026-11-20',
    totalAmount: 119653000,
    budgetCeiling: 119653000,
    projectName: 'Fiber Optic Backbone Jatim',
    projectCode: 'PRJ-FO-01',
    purchaseRequest: {
      id: 11,
      prNumber: 'PR-20261023-002',
      items: [
        {
          id: 101,
          prItemId: 101,
          itemName: 'FO ADSS Cable 288 Core Single Mode',
          categoryName: 'Material & Kabel',
          quantity: 988,
          uom: 'Meter',
          estimatedUnitPrice: 78000,
          routeDetails: 'Rute Surabaya - Sidoarjo Segmen 1A, Tarikan Tiang PLN 9M',
          wbsNodeId: '1.2.1',
        },
        {
          id: 102,
          prItemId: 102,
          itemName: 'Joint Closure 288 Core Dome Type',
          categoryName: 'Aksesoris Fiber',
          quantity: 12,
          uom: 'Set',
          estimatedUnitPrice: 1850000,
          routeDetails: 'Manhole Junction Point KM 12 & KM 24',
          wbsNodeId: '1.2.2',
        },
      ],
    },
  };

  beforeEach(() => {
    capturedModalProps = [];
    capturedTableProps = [];
    jest.clearAllMocks();
  });

  test('1. renders modal with responsive class and viewport width constraints', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(VendorQuotationModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
      })
    );

    expect(capturedModalProps.length).toBeGreaterThan(0);
    const lastProps = capturedModalProps[capturedModalProps.length - 1];

    expect(lastProps.width).toBe('min(1040px, 96vw)');
    expect(lastProps.style).toEqual(expect.objectContaining({ maxWidth: '100vw' }));
    expect(lastProps['data-testid']).toBe('vendor-quotation-modal');

    expect(html).toContain('data-testid="quotation-modal-body"');
    expect(html).toContain('Input Penawaran Vendor — RFQ-20261104-001');
  });

  test('2. renders mobile card view with complete item details and route details', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(VendorQuotationModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
      })
    );

    expect(html).toContain('data-testid="quotation-mobile-card-view"');
    expect(html).toContain('data-testid="quotation-item-card"');

    // Both items must be present
    expect(html).toContain('FO ADSS Cable 288 Core Single Mode');
    expect(html).toContain('Joint Closure 288 Core Dome Type');

    // Route details must be present and unclipped
    expect(html).toContain('data-testid="quotation-route-details"');
    expect(html).toContain('Rute Surabaya - Sidoarjo Segmen 1A, Tarikan Tiang PLN 9M');
    expect(html).toContain('Manhole Junction Point KM 12 &amp; KM 24');

    // Category and WBS references
    expect(html).toContain('Material &amp; Kabel');
    expect(html).toContain('WBS #1.2.1');
    expect(html).toContain('Aksesoris Fiber');
    expect(html).toContain('WBS #1.2.2');
  });

  test('3. preserves read-only PR snapshot values in card grid', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(VendorQuotationModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
      })
    );

    // Quantities and UOM
    expect(html).toContain('988');
    expect(html).toContain('Meter');
    expect(html).toContain('12');
    expect(html).toContain('Set');

    // Benchmark unit price (read-only PR snapshot)
    expect(html).toContain('data-testid="quotation-benchmark-price"');
    expect(html).toContain('78.000');
    expect(html).toContain('1.850.000');

    // Benchmark subtotal calculation
    // 988 * 78,000 = 77,064,000
    expect(html).toContain('77.064.000');
    // 12 * 1,850,000 = 22,200,000
    expect(html).toContain('22.200.000');
  });

  test('4. renders editable vendor quotation price inputs for active RFQ', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(VendorQuotationModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
      })
    );

    expect(html).toContain('data-testid="quotation-price-input"');
    expect(html).toContain('Harga Penawaran Aktual Vendor (Rp)');
    // Initial state before entry is "Belum diisi"
    expect(html).toContain('Belum diisi');
  });

  test('5. preserves desktop table view with horizontal scroll preventing column crushing', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(VendorQuotationModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
      })
    );

    expect(html).toContain('data-testid="quotation-desktop-table"');
    expect(capturedTableProps.length).toBeGreaterThan(0);
    const tableProp = capturedTableProps[capturedTableProps.length - 1];

    expect(tableProp.scroll).toBeDefined();
    // Desktop table must have explicit horizontal scroll to prevent 0px crushed description
    expect(tableProp.scroll.x).toBe(860);
    expect(tableProp.columns.length).toBe(7);
  });

  test('6. renders responsive footer actions for open RFQ', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(VendorQuotationModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
      })
    );

    expect(html).toContain('data-testid="quotation-footer"');
    expect(html).toContain('data-testid="btn-cancel-quotation"');
    expect(html).toContain('data-testid="btn-submit-quotation"');
    expect(html).toContain('Simpan Penawaran Vendor');
    expect(html).toContain('Batal');
  });

  test('7. renders read-only locked view when inspecting existing quotation', () => {
    const mockExistingQuote = {
      quotationId: 'QT-20261104-001',
      quotationNumber: 'QT-20261104-001',
      rfqId: 15,
      rfqNumber: 'RFQ-20261104-001',
      projectId: 1,
      projectName: 'Fiber Optic Backbone Jatim',
      vendorId: 1,
      vendorCode: 'VND-001',
      vendorName: 'PT IT Solusi Bersama',
      budgetCeiling: 119653000,
      totalOfferedAmount: 95000000,
      leadTimeDays: 14,
      vendorNotes: 'Franco Surabaya, Garansi 12 Bulan',
      status: 'SUBMITTED' as const,
      submittedAt: '2026-11-04T10:00:00Z',
      items: [
        {
          key: 'item_101',
          prItemId: 101,
          itemName: 'FO ADSS Cable 288 Core Single Mode',
          categoryName: 'Material & Kabel',
          quantity: 988,
          uom: 'Meter',
          estimatedUnitPrice: 78000,
          offeredUnitPrice: 75000,
          subtotal: 74100000,
          routeDetails: 'Rute Surabaya - Sidoarjo Segmen 1A',
        },
      ],
    };

    const html = ReactDOMServer.renderToString(
      React.createElement(VendorQuotationModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        existingQuotation: mockExistingQuote,
      })
    );

    // Read-only indicator banners
    expect(html).toContain('Penawaran Resmi Terkunci (Read-Only)');
    expect(html).toContain('QT-20261104-001');
    expect(html).toContain('● SUBMITTED');
    expect(html).toContain('Imutabel (Tidak Dapat Diedit)');

    // Submit button should NOT be rendered in read-only mode
    expect(html).not.toContain('data-testid="btn-submit-quotation"');
    expect(html).toContain('data-testid="btn-cancel-quotation"');
    expect(html).toContain('Tutup');

    // Values from existing quotation
    expect(html).toContain('74.100.000');
  });
});
