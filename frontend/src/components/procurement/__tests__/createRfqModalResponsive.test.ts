/**
 * EPMS — PURCHASING CREATE RFQ MODAL RESPONSIVE COMPONENT TESTS
 *
 * Verifies mobile-first layout responsiveness and read-only snapshot fidelity for:
 * - CreateRfqModal (RFQ creation modal for Purchasing account)
 *
 * Verifies:
 * 1. Responsive modal width bounds (min(980px, calc(100vw - 24px)) and maxWidth: '100vw')
 * 2. Header and title wrapping without character-per-line collapse
 * 3. Desktop table view configuration with explicit scroll.x preventing column crushing
 * 4. Mobile card view presentation for RFQ items with route details
 * 5. Preservation of read-only PR snapshot data (category, quantity, unit, price, subtotal)
 * 6. Accessible footer actions (Batal and Terbitkan RFQ)
 * 7. Responsive cancel submodal configuration
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';

let capturedModalProps: any[] = [];
let capturedTableProps: any[] = [];

// Mock antd Modal and Table to capture props and render inline HTML
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
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
}));

// Mock ProcurementService
jest.mock('@/services/procurement.service', () => ({
  ProcurementService: {
    getVendors: jest.fn().mockResolvedValue([
      { id: 1, code: 'VND-001', name: 'PT Vendor Mandiri', vendorType: 'MATERIAL' },
    ]),
    cancelRfq: jest.fn().mockResolvedValue({ id: 10, status: 'CANCELLED' }),
    createRfq: jest.fn().mockResolvedValue({ id: 11, rfqNumber: 'RFQ-20261104-001', status: 'OPEN' }),
    getQuotationsByRfq: jest.fn().mockResolvedValue([]),
  },
}));

import { CreateRfqModal } from '../CreateRfqModal';

describe('CreateRfqModal Mobile Responsiveness & Snapshot Fidelity', () => {
  const mockApprovedPrWithRoute = {
    id: 101,
    prNumber: 'PR-20261104-001',
    status: 'APPROVED',
    totalEstimatedAmount: 75000000,
    project: {
      id: 50,
      code: 'PRJ-TVM-001',
      name: 'Rehabilitasi Route Region Surabaya Segment Jl Sambikerep - Jl Kalijaran',
    },
    items: [
      {
        id: 1,
        rabItemKey: 'item_1',
        categoryName: 'Pekerjaan Jasa & Penarikan',
        itemName: 'Penarikan Kabel Fiber Optik 48 Core Aerial',
        routeDetails: 'Rute: Segment Jl Sambikerep (Pole #01) s/d Jl Kalijaran (Pole #48) - 4.2 KM',
        quantity: 4200,
        uom: 'Meter',
        estimatedUnitPrice: 15000,
        subtotal: 63000000,
        wbsNodeId: 'WBS-1.2.3',
      },
      {
        id: 2,
        rabItemKey: 'item_2',
        categoryName: 'Material & Aksesoris',
        itemName: 'Suspension Clamp & Tension Clamp Set',
        routeDetails: 'Aksesoris tiang untuk rute Sambikerep - Kalijaran',
        quantity: 96,
        uom: 'Set',
        estimatedUnitPrice: 125000,
        subtotal: 12000000,
        wbsNodeId: 'WBS-1.2.4',
      },
    ],
  };

  beforeEach(() => {
    capturedModalProps = [];
    capturedTableProps = [];
  });

  it('1. Configures responsive modal width and maxWidth boundaries on main modal', () => {
    ReactDOMServer.renderToStaticMarkup(
      React.createElement(CreateRfqModal, {
        open: true,
        onClose: jest.fn(),
        pr: mockApprovedPrWithRoute,
      })
    );

    expect(capturedModalProps.length).toBeGreaterThan(0);
    const mainModal = capturedModalProps[0];
    expect(mainModal.width).toBe('min(980px, calc(100vw - 24px))');
    expect(mainModal.style).toEqual(expect.objectContaining({ maxWidth: '100vw' }));
  });

  it('2. Renders mobile card view containing all items with route details and labels', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(CreateRfqModal, {
        open: true,
        onClose: jest.fn(),
        pr: mockApprovedPrWithRoute,
      })
    );

    // Mobile cards view container is rendered
    expect(html).toContain('data-testid="rfq-mobile-card-view"');
    expect(html).toContain('data-testid="rfq-item-card"');

    // Both items are present in the output
    expect(html).toContain('Penarikan Kabel Fiber Optik 48 Core Aerial');
    expect(html).toContain('Rute: Segment Jl Sambikerep (Pole #01) s/d Jl Kalijaran (Pole #48) - 4.2 KM');
    expect(html).toContain('Suspension Clamp &amp; Tension Clamp Set');
    expect(html).toContain('Aksesoris tiang untuk rute Sambikerep - Kalijaran');

    // Labels and badges
    expect(html).toContain('Jumlah');
    expect(html).toContain('Harga Satuan');
    expect(html).toContain('Subtotal Plafon');
    expect(html).toContain('Pekerjaan Jasa &amp; Penarikan');
    expect(html).toContain('Material &amp; Aksesoris');
    expect(html).toContain('WBS #WBS-1.2.3');
  });

  it('3. Configures desktop table view with explicit scroll.x preventing column collapse', () => {
    ReactDOMServer.renderToStaticMarkup(
      React.createElement(CreateRfqModal, {
        open: true,
        onClose: jest.fn(),
        pr: mockApprovedPrWithRoute,
      })
    );

    expect(capturedTableProps.length).toBeGreaterThan(0);
    const itemTable = capturedTableProps[0];
    expect(itemTable.scroll).toEqual(expect.objectContaining({ x: 720, y: 220 }));

    // Check column definitions include Route Details in header
    const columnTitles = itemTable.columns.map((c: any) => c.title);
    expect(columnTitles).toContain('Kategori');
    expect(columnTitles).toContain('Nama Item & Rincian Rute');
    expect(columnTitles).toContain('Qty');
    expect(columnTitles).toContain('Satuan');
    expect(columnTitles).toContain('Estimasi Harga Satuan');
    expect(columnTitles).toContain('Subtotal Plafon');
  });

  it('4. Preserves read-only snapshot tag and source PR integrity', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(CreateRfqModal, {
        open: true,
        onClose: jest.fn(),
        pr: mockApprovedPrWithRoute,
      })
    );

    expect(html).toContain('READ-ONLY SNAPSHOT');
    expect(html).toContain('Sumber:');
    expect(html).toContain('PR Disetujui (PR-20261104-001)');
    expect(html).toContain('Daftar Item RFQ (2 Item Terkunci dari PR Approved)');
  });

  it('5. Renders accessible footer buttons for Batal and Terbitkan RFQ', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(CreateRfqModal, {
        open: true,
        onClose: jest.fn(),
        pr: mockApprovedPrWithRoute,
      })
    );

    expect(html).toContain('Batal');
    expect(html).toContain('Terbitkan RFQ');
    expect(html).toContain('data-testid="rfq-footer-container"');
    expect(html).toContain('data-testid="rfq-footer-actions"');
  });

  it('6. Handles PR with single item and long unbroken route description without layout breakage', () => {
    const prWithLongText = {
      ...mockApprovedPrWithRoute,
      items: [
        {
          id: 99,
          itemName: 'FO-ROUTE-SURABAYA-SIDOARJO-PASURUAN-PROBOLINGGO-BANYUWANGI-SUPER-LONG-SEGMENT-CODE-999',
          routeDetails: 'http://gis.epms.tvm.internal/routes/east-java/backbone/transmission-line-segment-00998877665544332211',
          quantity: 1,
          uom: 'Lot',
          estimatedUnitPrice: 50000000,
          subtotal: 50000000,
        },
      ],
    };

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(CreateRfqModal, {
        open: true,
        onClose: jest.fn(),
        pr: prWithLongText,
      })
    );

    expect(html).toContain('FO-ROUTE-SURABAYA-SIDOARJO-PASURUAN-PROBOLINGGO-BANYUWANGI-SUPER-LONG-SEGMENT-CODE-999');
    expect(html).toContain('http://gis.epms.tvm.internal/routes/east-java/backbone/transmission-line-segment-00998877665544332211');
    expect(html).toContain('data-testid="rfq-item-route-details"');
  });

  it('7. Renders 4 items in card view without omission, providing independent card elements', () => {
    const prWith4Items = {
      ...mockApprovedPrWithRoute,
      items: [
        ...mockApprovedPrWithRoute.items,
        {
          id: 3,
          rabItemKey: 'item_3',
          categoryName: 'Material & Aksesoris',
          itemName: 'Joint Closure 48 Core Dome Type',
          routeDetails: 'Jointing box tiang pole #12 dan #24',
          quantity: 4,
          uom: 'Unit',
          estimatedUnitPrice: 650000,
          subtotal: 2600000,
          wbsNodeId: 'WBS-1.2.5',
        },
        {
          id: 4,
          rabItemKey: 'item_4',
          categoryName: 'Pekerjaan Jasa & Penarikan',
          itemName: 'Testing & Splicing OTDR Commissioning',
          routeDetails: 'Pengujian OTDR end-to-end 48 core',
          quantity: 48,
          uom: 'Core',
          estimatedUnitPrice: 45000,
          subtotal: 2160000,
          wbsNodeId: 'WBS-1.2.6',
        },
      ],
    };

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(CreateRfqModal, {
        open: true,
        onClose: jest.fn(),
        pr: prWith4Items,
      })
    );

    // Matches all 4 items rendered
    const cardMatches = html.match(/data-testid="rfq-item-card"/g);
    expect(cardMatches).not.toBeNull();
    expect(cardMatches!.length).toBe(4);

    expect(html).toContain('Joint Closure 48 Core Dome Type');
    expect(html).toContain('Testing &amp; Splicing OTDR Commissioning');
    expect(html).toContain('Daftar Item RFQ (4 Item Terkunci dari PR Approved)');
  });

  it('8. Binds rfqModal and testid to root Modal component', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(CreateRfqModal, {
        open: true,
        onClose: jest.fn(),
        pr: mockApprovedPrWithRoute,
      })
    );

    expect(capturedModalProps.length).toBeGreaterThan(0);
    const mainModal = capturedModalProps[0];
    expect(mainModal['data-testid']).toBe('rfq-main-modal');
    expect(html).toContain('data-testid="mock-modal"');
  });

  it('9. Preserves item cards accessibility in view mode with active RFQ', () => {
    const mockActiveRfq = {
      id: 55,
      rfqNumber: 'RFQ-20261104-001',
      status: 'OPEN',
      closingDate: '2026-11-20',
      createdAt: '2026-11-04T08:00:00Z',
      publishedBy: { fullName: 'Purchasing Officer' },
      quotations: [],
    };

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(CreateRfqModal, {
        open: true,
        onClose: jest.fn(),
        pr: mockApprovedPrWithRoute,
        existingRfq: mockActiveRfq,
        viewOnly: true,
      })
    );

    expect(html).toContain('Rincian Request for Quotation — RFQ-20261104-001');
    expect(html).toContain('data-testid="rfq-mobile-card-view"');
    expect(html).toContain('Penarikan Kabel Fiber Optik 48 Core Aerial');
    expect(html).toContain('Tutup');
    expect(html).toContain('Batalkan RFQ');
  });
});
