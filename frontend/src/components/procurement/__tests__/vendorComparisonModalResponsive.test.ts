/**
 * EPMS — VENDOR COMPARISON MODAL RESPONSIVE COMPONENT TESTS
 *
 * Verifies mobile-first layout responsiveness and commercial comparison fidelity for:
 * - VendorComparisonModal (Purchasing vendor comparison & evaluation modal)
 *
 * Tests:
 * 1. Responsive modal width and boundaries (min(1180px, calc(100vw - 24px)) and maxWidth: '100vw')
 * 2. Renders mobile card view containing all vendors with commercial and lead time details
 * 3. Renders desktop summary table with proper columns and horizontal scroll
 * 4. Preserves Single Winner Policy Radio selection mechanism
 * 5. Preserves system recommendation tags (lowest price, fastest lead time) with tie-awareness
 * 6. Renders item-level price matrix inside controlled scroll container with mobile hint strip
 * 7. Renders accessible footer actions with touch-friendly layout
 * 8. Evaluated mode preserves winner banner, winner badge, and PO action buttons
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
    submitVendorComparison: jest.fn().mockResolvedValue({ success: true, data: [] }),
  },
}));

import { VendorComparisonModal } from '../VendorComparisonModal';

describe('VendorComparisonModal Mobile Responsiveness & Commercial Fidelity', () => {
  const mockRfq = {
    id: 42,
    rfqNumber: 'RFQ-20261104-002',
    status: 'OPEN',
    totalAmount: 15000000,
    budgetCeiling: 15000000,
    projectName: 'Rehabilitasi Jaringan Fiber Optik Surabaya',
    projectCode: 'PRJ-TVM-SURABAYA',
    projectId: 10,
    purchaseRequest: {
      id: 101,
      prNumber: 'PR-20261104-001',
      totalEstimatedAmount: 15000000,
      items: [
        {
          id: 1,
          itemName: 'Kabel Fiber Optik 48 Core Aerial',
          categoryName: 'Material',
          quantity: 1000,
          uom: 'Meter',
          estimatedUnitPrice: 10000,
          subtotal: 10000000,
        },
        {
          id: 2,
          itemName: 'Joint Closure 48 Core',
          categoryName: 'Material',
          quantity: 10,
          uom: 'Unit',
          estimatedUnitPrice: 500000,
          subtotal: 5000000,
        },
      ],
    },
    items: [
      {
        id: 1,
        itemName: 'Kabel Fiber Optik 48 Core Aerial',
        categoryName: 'Material',
        quantity: 1000,
        uom: 'Meter',
        estimatedUnitPrice: 10000,
      },
      {
        id: 2,
        itemName: 'Joint Closure 48 Core',
        categoryName: 'Material',
        quantity: 10,
        uom: 'Unit',
        estimatedUnitPrice: 500000,
      },
    ],
  };

  const mockQuotations = [
    {
      quotationId: 'Q-001',
      vendorId: 1,
      vendorCode: 'VND-001',
      vendorName: 'PT Vendor Alpha Mandiri',
      totalOfferedAmount: 13500000,
      budgetCeiling: 15000000,
      leadTimeDays: 7,
      notes: 'Franco Gudang Surabaya, TOP 30 Hari',
      items: [
        { key: 'item_0', itemName: 'Kabel Fiber Optik 48 Core Aerial', offeredUnitPrice: 9000 },
        { key: 'item_1', itemName: 'Joint Closure 48 Core', offeredUnitPrice: 450000 },
      ],
    },
    {
      quotationId: 'Q-002',
      vendorId: 2,
      vendorCode: 'VND-002',
      vendorName: 'PT Beta Logistik Nusantara',
      totalOfferedAmount: 14000000,
      budgetCeiling: 15000000,
      leadTimeDays: 5,
      notes: 'Pengiriman 5 hari kerja, Garansi 12 bulan',
      items: [
        { key: 'item_0', itemName: 'Kabel Fiber Optik 48 Core Aerial', offeredUnitPrice: 9200 },
        { key: 'item_1', itemName: 'Joint Closure 48 Core', offeredUnitPrice: 480000 },
      ],
    },
    {
      quotationId: 'Q-003',
      vendorId: 3,
      vendorCode: 'VND-003',
      vendorName: 'CV Gamma Solusi Mitra',
      totalOfferedAmount: 15500000,
      budgetCeiling: 15000000,
      leadTimeDays: 14,
      notes: 'Harga belum termasuk PPN 11%',
      items: [
        { key: 'item_0', itemName: 'Kabel Fiber Optik 48 Core Aerial', offeredUnitPrice: 10500 },
        { key: 'item_1', itemName: 'Joint Closure 48 Core', offeredUnitPrice: 500000 },
      ],
    },
  ];

  beforeEach(() => {
    capturedModalProps = [];
    capturedTableProps = [];
  });

  it('1. Configures responsive modal bounds width and style on root Modal', () => {
    ReactDOMServer.renderToStaticMarkup(
      React.createElement(VendorComparisonModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        quotations: mockQuotations,
      })
    );

    expect(capturedModalProps.length).toBeGreaterThan(0);
    const mainModal = capturedModalProps[0];
    expect(mainModal.width).toBe('min(1180px, calc(100vw - 24px))');
    expect(mainModal.style).toEqual(expect.objectContaining({ maxWidth: '100vw' }));
    expect(mainModal['data-testid']).toBe('vendor-comparison-modal');
  });

  it('2. Renders mobile vendor card view with all 3 vendor cards and commercial details', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(VendorComparisonModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        quotations: mockQuotations,
      })
    );

    expect(html).toContain('data-testid="comparison-mobile-card-view"');
    const cardMatches = html.match(/data-testid="comparison-vendor-card"/g);
    expect(cardMatches).not.toBeNull();
    expect(cardMatches!.length).toBe(3);

    // Vendor Alpha (Lowest Price)
    expect(html).toContain('PT Vendor Alpha Mandiri');
    expect(html).toContain('VND-001');
    expect(html).toContain('Rp 13.500.000');
    expect(html).toContain('Rp 1.500.000');
    expect(html).toContain('Hemat');
    expect(html).toContain('Franco Gudang Surabaya, TOP 30 Hari');

    // Vendor Beta (Fastest Lead Time)
    expect(html).toContain('PT Beta Logistik Nusantara');
    expect(html).toContain('VND-002');
    expect(html).toContain('Rp 14.000.000');
    expect(html).toContain('5 hari kerja');

    // Vendor Gamma (Over Budget)
    expect(html).toContain('CV Gamma Solusi Mitra');
    expect(html).toContain('VND-003');
    expect(html).toContain('Rp 15.500.000');
    expect(html).toContain('Over Plafon');
  });

  it('3. Renders desktop summary table view with explicit scroll.x', () => {
    ReactDOMServer.renderToStaticMarkup(
      React.createElement(VendorComparisonModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        quotations: mockQuotations,
      })
    );

    expect(capturedTableProps.length).toBeGreaterThan(0);
    const summaryTable = capturedTableProps[0];
    expect(summaryTable.scroll).toEqual(expect.objectContaining({ x: 720 }));
  });

  it('4. Renders winner selection Radio buttons on mobile vendor cards', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(VendorComparisonModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        quotations: mockQuotations,
      })
    );

    const radioMatches = html.match(/data-testid="vendor-winner-radio"/g);
    expect(radioMatches).not.toBeNull();
    expect(radioMatches!.length).toBe(3);
  });

  it('5. Renders system recommendation tags for lowest price and fastest lead time', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(VendorComparisonModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        quotations: mockQuotations,
      })
    );

    expect(html).toContain('Indikator Rekomendasi Sistem:');
    expect(html).toContain('Harga Terendah:');
    expect(html).toContain('PT Vendor Alpha Mandiri');
    expect(html).toContain('Lead Time Vendor Tercepat:');
    expect(html).toContain('PT Beta Logistik Nusantara');
  });

  it('6. Renders item-level price matrix container with mobile scroll hint strip', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(VendorComparisonModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        quotations: mockQuotations,
      })
    );

    expect(html).toContain('data-testid="comparison-matrix-table-container"');
    expect(html).toContain('← Geser horizontal untuk melihat rincian harga per vendor →');
    expect(html).toContain('Kabel Fiber Optik 48 Core Aerial');
    expect(html).toContain('Joint Closure 48 Core');
  });

  it('7. Renders accessible footer container and action controls', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(VendorComparisonModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        quotations: mockQuotations,
      })
    );

    expect(html).toContain('data-testid="comparison-footer-container"');
    expect(html).toContain('data-testid="comparison-footer-left"');
    expect(html).toContain('data-testid="comparison-footer-actions"');
    expect(html).toContain('Batal');
    expect(html).toContain('Tetapkan Pemenang Evaluasi');
  });

  it('8. Renders evaluated state with winner banner, WINNER badge, and PO actions', () => {
    const mockExistingComparison = {
      comparisonId: 'CMP-101',
      rfqId: 42,
      rfqNumber: 'RFQ-20261104-002',
      prNumber: 'PR-20261104-001',
      projectId: 10,
      projectName: 'Rehabilitasi Jaringan Fiber Optik Surabaya',
      budgetCeiling: 15000000,
      quotationIds: ['Q-001', 'Q-002', 'Q-003'],
      vendorIds: [1, 2, 3],
      selectedWinnerVendorId: 1,
      selectedWinnerVendorCode: 'VND-001',
      selectedWinnerVendorName: 'PT Vendor Alpha Mandiri',
      winnerTotalOfferedAmount: 13500000,
      winnerLeadTimeDays: 7,
      winnerVarianceAmount: -1500000,
      evaluationNotes: 'Penawaran paling efisien dan lead time terverifikasi',
      comparedAt: '2026-11-04T09:00:00Z',
      comparedBy: 'Purchasing Officer',
      status: 'EVALUATED' as const,
    };

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(VendorComparisonModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        quotations: mockQuotations,
        existingComparison: mockExistingComparison,
      })
    );

    // Winner banner
    expect(html).toContain('Vendor Comparison Selesai — Pemenang Terpilih: PT Vendor Alpha Mandiri (VND-001)');
    // Winner badge on card
    expect(html).toContain('● WINNER');
    // Footer button changes to "Tutup" and "Buat Purchase Order (PO)"
    expect(html).toContain('Tutup');
    expect(html).toContain('Buat Purchase Order (PO)');
  });

  it('9. Evaluation notes textarea is editable in authorized evaluation state before PO issuance', () => {
    const mockExistingComparison = {
      comparisonId: 'CMP-101',
      rfqId: 42,
      rfqNumber: 'RFQ-20261104-002',
      prNumber: 'PR-20261104-001',
      projectId: 10,
      projectName: 'Rehabilitasi Jaringan Fiber Optik Surabaya',
      budgetCeiling: 15000000,
      quotationIds: ['Q-001', 'Q-002', 'Q-003'],
      vendorIds: [1, 2, 3],
      selectedWinnerVendorId: 1,
      selectedWinnerVendorCode: 'VND-001',
      selectedWinnerVendorName: 'PT Vendor Alpha Mandiri',
      winnerTotalOfferedAmount: 13500000,
      winnerLeadTimeDays: 7,
      winnerVarianceAmount: -1500000,
      evaluationNotes: 'Penawaran terverifikasi spesifikasi teknis lengkap',
      comparedAt: '2026-11-04T09:00:00Z',
      comparedBy: 'Purchasing Officer',
      status: 'EVALUATED' as const,
    };

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(VendorComparisonModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        quotations: mockQuotations,
        existingComparison: mockExistingComparison,
        existingPo: null, // PO not issued yet
        isProcurement: true,
      })
    );

    // Section 3 label and textarea must be present
    expect(html).toContain('Catatan / Justifikasi Evaluasi Pengadaan (Opsional):');
    expect(html).toContain('data-testid="evaluation-notes-textarea"');
    expect(html).toContain('Penawaran terverifikasi spesifikasi teknis lengkap');

    // Textarea must NOT be disabled when PO is not issued yet
    expect(html).not.toMatch(/<textarea[^>]*data-testid="evaluation-notes-textarea"[^>]*disabled=""/);
  });

  it('10. Evaluation notes textarea is disabled when PO is issued or user is unauthorized', () => {
    const mockExistingPo = {
      id: 201,
      poNumber: 'PO-20261104-001',
      status: 'ISSUED',
      totalAmount: 13500000,
    } as any;

    // A. PO already issued -> disabled
    const htmlPoIssued = ReactDOMServer.renderToStaticMarkup(
      React.createElement(VendorComparisonModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        quotations: mockQuotations,
        existingComparison: null,
        existingPo: mockExistingPo,
        isProcurement: true,
      })
    );

    expect(htmlPoIssued).toContain('data-testid="evaluation-notes-textarea"');
    expect(htmlPoIssued).toMatch(/<textarea[^>]*data-testid="evaluation-notes-textarea"[^>]*disabled/);

    // B. Viewer without procurement or superadmin role -> disabled
    const htmlUnauthorized = ReactDOMServer.renderToStaticMarkup(
      React.createElement(VendorComparisonModal, {
        open: true,
        onClose: jest.fn(),
        rfq: mockRfq,
        quotations: mockQuotations,
        existingComparison: null,
        existingPo: null,
        isProcurement: false,
        isSuperAdmin: false,
      })
    );

    expect(htmlUnauthorized).toContain('data-testid="evaluation-notes-textarea"');
    expect(htmlUnauthorized).toMatch(/<textarea[^>]*data-testid="evaluation-notes-textarea"[^>]*disabled/);
  });
});

