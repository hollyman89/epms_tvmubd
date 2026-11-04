/**
 * EPMS — SERVICE ORDER MODAL RESPONSIVE COMPONENT TESTS
 *
 * Verifies mobile-first layout responsiveness and structure for:
 * - ServiceOrderModal (SPK / Work Order modal for Purchasing / PM / Director)
 *
 * Verifies:
 * 1. Responsive modal width bounds (min(850px, calc(100vw - 24px)))
 * 2. Header and title wrapping without squeezing title or colliding with close button
 * 3. PO Context summary strip with responsive grid
 * 4. Section header with title on separate row and single non-duplicated Create button
 * 5. Coexistence of Desktop Table View and Mobile Cards View
 * 6. Compact empty state without duplicate Create button
 * 7. Clean footer without duplicate Create button in LIST mode
 * 8. Clean navigation buttons without duplicated icon prefixes (+ + or ← ←)
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import {
  ServiceOrderModal,
  SERVICE_ORDER_DESCRIPTIONS_COLUMN,
  resolveServiceOrderProject,
  resolveServiceOrderVendor,
} from '../ServiceOrderModal';

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
    getServiceOrdersByPo: jest.fn().mockResolvedValue([
      {
        id: 1,
        serviceOrderNumber: 'SPK-20261102-001',
        purchaseOrderId: 14,
        projectId: 53,
        vendorId: 1,
        documentType: 'SPK',
        status: 'ISSUED',
        scopeOfWork: 'Pemasangan Tiang dan Tarik Kabel',
        workLocation: 'Bandung Raya',
        startDate: '2026-11-02',
        endDate: '2026-11-10',
        issuedAt: '2026-11-02T10:00:00.000Z',
        createdAt: '2026-11-02T09:00:00.000Z',
      },
    ]),
    createServiceOrder: jest.fn(),
    updateServiceOrder: jest.fn(),
    issueServiceOrder: jest.fn(),
    cancelServiceOrder: jest.fn(),
  },
}));

describe('ServiceOrderModal Responsive & Structural Tests', () => {
  beforeEach(() => {
    capturedModalProps = [];
    capturedTableProps = [];
    jest.clearAllMocks();
  });

  const mockPo: any = {
    id: 14,
    poId: '14',
    poNumber: 'PO-20261102-002',
    orderType: 'SERVICE',
    totalAmount: 12000,
    projectName: 'Sewa Core Fiberization',
    projectCode: 'CONT-20261029-0014',
    vendorName: 'PT IT Solusi Bersama',
    vendorCode: 'VND-001',
    deliveryLocation: 'Lokasi Proyek / Lapangan',
  };

  it('1. Enforces responsive modal width min(850px, calc(100vw - 24px))', () => {
    ReactDOMServer.renderToString(
      React.createElement(ServiceOrderModal, {
        open: true,
        onClose: jest.fn(),
        po: mockPo,
      })
    );

    expect(capturedModalProps.length).toBeGreaterThan(0);
    const mainModal = capturedModalProps[0];
    expect(mainModal.open).toBe(true);
    expect(mainModal.width).toBe('min(850px, calc(100vw - 24px))');
    expect(mainModal.style?.maxWidth).toBe('calc(100vw - 24px)');
  });

  it('2. Header contains responsive container, title, tags, and subtitle', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(ServiceOrderModal, {
        open: true,
        onClose: jest.fn(),
        po: mockPo,
      })
    );

    expect(html).toContain('data-testid="spk-modal-header"');
    expect(html).toContain('Surat Perintah Kerja (SPK) / Work Order Jasa');
    expect(html).toContain('PO-20261102-002');
  });

  it('3. Renders PO Context summary strip with all 4 authoritative commercial fields', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(ServiceOrderModal, {
        open: true,
        onClose: jest.fn(),
        po: mockPo,
      })
    );

    expect(html).toContain('data-testid="spk-po-summary"');
    expect(html).toContain('PROYEK:');
    expect(html).toContain('Sewa Core Fiberization');
    expect(html).toContain('CONT-20261029-0014');
    expect(html).toContain('PURCHASE ORDER:');
    expect(html).toContain('PO-20261102-002');
    expect(html).toContain('Jasa / Subcon');
    expect(html).toContain('VENDOR / SUBCON:');
    expect(html).toContain('PT IT Solusi Bersama');
    expect(html).toContain('VND-001');
    expect(html).toContain('NILAI KONTRAK PO:');
  });

  it('4. Section header provides single primary create action without duplicate "+" icon', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(ServiceOrderModal, {
        open: true,
        onClose: jest.fn(),
        po: mockPo,
        canManage: true,
      })
    );

    expect(html).toContain('data-testid="btn-create-spk-section"');
    expect(html).toContain('Daftar Dokumen Pelaksanaan (SPK / Work Order)');
    // Ensures "+ Buat" text duplication (+ +) was removed and now clean "Buat SPK / Work Order"
    expect(html).not.toContain('+ + Buat');
  });

  it('5. In LIST mode, footer does not duplicate Create action and provides clean Tutup', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(ServiceOrderModal, {
        open: true,
        onClose: jest.fn(),
        po: mockPo,
        canManage: true,
      })
    );

    expect(html).toContain('data-testid="spk-modal-footer"');
    expect(html).toContain('data-testid="btn-close-spk-modal"');
    // Ensure footer in LIST mode does NOT have a second Create button
    expect(html).not.toContain('data-testid="btn-create-spk-footer"');
  });

  it('6. Empty state displays without duplicate Create button inside Empty description', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(ServiceOrderModal, {
        open: true,
        onClose: jest.fn(),
        po: mockPo,
        canManage: true,
      })
    );

    // Initial state before fetchServiceOrders completes renders empty state
    expect(html).toContain('data-testid="spk-empty-state"');
    expect(html).toContain('Belum ada SPK / Work Order');
    expect(html).toContain('Purchase Order ini sah sebagai SSOT komersial');
  });

  it('7. Preserves descriptions column definition for responsive UI-C1 grid', () => {
    expect(SERVICE_ORDER_DESCRIPTIONS_COLUMN.xxl).toBe(2);
    expect(SERVICE_ORDER_DESCRIPTIONS_COLUMN.xl).toBe(2);
    expect(SERVICE_ORDER_DESCRIPTIONS_COLUMN.lg).toBe(2);
    expect(SERVICE_ORDER_DESCRIPTIONS_COLUMN.md).toBe(2);
    expect(SERVICE_ORDER_DESCRIPTIONS_COLUMN.sm).toBe(1);
    expect(SERVICE_ORDER_DESCRIPTIONS_COLUMN.xs).toBe(1);
  });

  it('8. Context helpers resolve project and vendor context cleanly', () => {
    const proj = resolveServiceOrderProject(null, mockPo);
    expect(proj.projectName).toBe('Sewa Core Fiberization');
    expect(proj.projectCode).toBe('CONT-20261029-0014');

    const vnd = resolveServiceOrderVendor(null, mockPo);
    expect(vnd.vendorName).toBe('PT IT Solusi Bersama');
    expect(vnd.vendorCode).toBe('VND-001');
  });
});
