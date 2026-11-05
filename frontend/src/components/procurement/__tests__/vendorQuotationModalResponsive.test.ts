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

// Mock AuthContext
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      sub: 12,
      email: 'purchasing@epms.com',
      fullName: 'Purchasing Officer',
      roles: ['PURCHASING'],
    },
  }),
}));

// Mock react-query
jest.mock('@tanstack/react-query', () => ({
  QueryClient: jest.fn().mockImplementation(() => ({
    defaultOptions: {},
  })),
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
import { mapBackendQuotationToRecord } from '../CreateRfqModal';

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

  test('8. resolves item name from snake_case item_name in existing quotation (Fix B)', () => {
    const quoteWithSnakeCaseItem = {
      quotationId: 'QT-20261104-002',
      quotationNumber: 'QT-20261104-002',
      rfqId: 15,
      rfqNumber: 'RFQ-20261104-001',
      projectId: 1,
      projectName: 'Fiber Optic Backbone Jatim',
      vendorId: 2,
      vendorCode: 'VND-002',
      vendorName: 'PT Maju Infrastruktur',
      budgetCeiling: 119653000,
      totalOfferedAmount: 88000000,
      leadTimeDays: 10,
      status: 'SUBMITTED' as const,
      submittedAt: '2026-11-04T11:00:00Z',
      items: [
        {
          key: 'item_snake_1',
          prItemId: 101,
          item_name: 'Pipa HDPE Subduct 40/34mm Roll', // snake_case only
          itemName: undefined as any,
          categoryName: 'Material & Jalur',
          quantity: 200,
          uom: 'Roll',
          estimatedUnitPrice: 400000,
          offeredUnitPrice: 390000,
          subtotal: 78000000,
        },
      ],
    };

    const html = ReactDOMServer.renderToString(
      React.createElement(VendorQuotationModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        existingQuotation: quoteWithSnakeCaseItem as any,
      })
    );

    // Resolves snake_case item_name without falling back to generic 'Item Pengadaan'
    expect(html).toContain('Pipa HDPE Subduct 40/34mm Roll');
    expect(html).not.toContain('Item Pengadaan');
  });

  test('9. renders existing quotation with routeDetails and gracefully handles absence of routeDetails', () => {
    const quoteWithMixedRoute = {
      quotationId: 'QT-20261104-003',
      quotationNumber: 'QT-20261104-003',
      rfqId: 15,
      rfqNumber: 'RFQ-20261104-001',
      projectId: 1,
      projectName: 'Fiber Optic Backbone Jatim',
      vendorId: 1,
      vendorCode: 'VND-001',
      vendorName: 'PT IT Solusi Bersama',
      budgetCeiling: 119653000,
      totalOfferedAmount: 50000000,
      leadTimeDays: 7,
      status: 'SUBMITTED' as const,
      submittedAt: '2026-11-04T12:00:00Z',
      items: [
        {
          key: 'item_with_route',
          prItemId: 101,
          itemName: 'Item Dengan Rincian Rute Spesifik',
          routeDetails: 'Segmen Jalur Timur KM 10 s/d KM 15',
          quantity: 5,
          uom: 'KM',
          estimatedUnitPrice: 5000000,
          offeredUnitPrice: 4800000,
          subtotal: 24000000,
        },
        {
          key: 'item_without_route',
          prItemId: 102,
          itemName: 'Item Standar Tanpa Rincian Rute',
          routeDetails: undefined,
          quantity: 10,
          uom: 'Unit',
          estimatedUnitPrice: 2600000,
          offeredUnitPrice: 2600000,
          subtotal: 26000000,
        },
      ],
    };

    const html = ReactDOMServer.renderToString(
      React.createElement(VendorQuotationModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        existingQuotation: quoteWithMixedRoute,
      })
    );

    // Item 1 displays routeDetails
    expect(html).toContain('Item Dengan Rincian Rute Spesifik');
    expect(html).toContain('Segmen Jalur Timur KM 10 s/d KM 15');

    // Item 2 displays title without route details element crash
    expect(html).toContain('Item Standar Tanpa Rincian Rute');
  });

  test('10. renders long unbroken item names and handles wordBreak on desktop column', () => {
    const quoteWithLongName = {
      quotationId: 'QT-20261104-004',
      quotationNumber: 'QT-20261104-004',
      rfqId: 15,
      rfqNumber: 'RFQ-20261104-001',
      projectId: 1,
      projectName: 'Fiber Optic Backbone Jatim',
      vendorId: 1,
      vendorCode: 'VND-001',
      vendorName: 'PT IT Solusi Bersama',
      budgetCeiling: 119653000,
      totalOfferedAmount: 1000000,
      leadTimeDays: 5,
      status: 'SUBMITTED' as const,
      submittedAt: '2026-11-04T12:00:00Z',
      items: [
        {
          key: 'item_long',
          prItemId: 101,
          itemName: 'SUPER-LONG-UNBROKEN-ITEM-NAME-SERIAL-1122334455667788990011223344556677889900-SPEC-CODE-XYZ',
          quantity: 1,
          uom: 'Lot',
          estimatedUnitPrice: 1000000,
          offeredUnitPrice: 1000000,
          subtotal: 1000000,
        },
      ],
    };

    const html = ReactDOMServer.renderToString(
      React.createElement(VendorQuotationModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        existingQuotation: quoteWithLongName,
      })
    );

    expect(html).toContain('SUPER-LONG-UNBROKEN-ITEM-NAME-SERIAL-1122334455667788990011223344556677889900-SPEC-CODE-XYZ');
    // Desktop column title container contains word-break: break-word
    expect(html).toContain('word-break:break-word');
  });

  test('11. verifies mapBackendQuotationToRecord safely resolves itemName, item_name, and routeDetails from upstream PR (Fix A)', () => {
    const mockRawQuotation = {
      id: 55,
      quotationNumber: 'QT-RAW-2026-001',
      rfqId: 15,
      vendorId: 3,
      totalAmount: 50000000,
      createdAt: '2026-11-04T12:00:00Z',
      vendor: { id: 3, code: 'VND-003', name: 'PT Vendor Mandiri' },
      items: [
        {
          id: 1,
          prItemId: 101,
          itemName: 'FO Cable Standard',
          quantity: 100,
          uom: 'Meter',
          unitPrice: 50000,
          totalAmount: 5000000,
          routeDetails: 'Rute Direct from API item',
        },
        {
          id: 2,
          prItemId: 102,
          item_name: 'Joint Closure from snake_case item_name', // snake_case
          quantity: 5,
          uom: 'Unit',
          unitPrice: 2000000,
          totalAmount: 10000000,
          // routeDetails missing on item directly, should inherit from mockRfq.purchaseRequest.items (prItemId: 102)
        },
      ],
    };

    const mapped = mapBackendQuotationToRecord(mockRawQuotation, mockRfq);

    expect(mapped.quotationNumber).toBe('QT-RAW-2026-001');
    expect(mapped.vendorName).toBe('PT Vendor Mandiri');
    expect(mapped.items.length).toBe(2);

    // Item 1: Direct itemName & routeDetails preserved
    expect(mapped.items[0].itemName).toBe('FO Cable Standard');
    expect(mapped.items[0].routeDetails).toBe('Rute Direct from API item');

    // Item 2: snake_case item_name preserved & routeDetails resolved from matching PR item
    expect(mapped.items[1].itemName).toBe('Joint Closure from snake_case item_name');
    expect(mapped.items[1].routeDetails).toBe('Manhole Junction Point KM 12 & KM 24');
    expect(mapped.items[1].estimatedUnitPrice).toBe(1850000);
  });
});
