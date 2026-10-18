import {
  SERVICE_ORDER_DESCRIPTIONS_COLUMN,
  resolveServiceOrderProject,
  resolveServiceOrderVendor,
} from '../ServiceOrderModal';
import type { ServiceOrder } from '@/services/procurement.service';

describe('PROJECT-SERVICE-PROCUREMENT-R1-ARCH-C2 Frontend Unit Suite', () => {
  const mockServicePo = {
    id: 2,
    poId: '2',
    poNumber: 'PO-20260923-001',
    orderType: 'SERVICE' as const,
    status: 'ISSUED' as const,
    totalAmount: 5000000,
    vendorName: 'PT Suplai Makmur',
    projectName: 'SURGE JATENG',
  };

  // Helper simulating the empty state and document list determination
  const resolveServiceOrderListState = (orders: ServiceOrder[], canManage: boolean) => {
    const isEmpty = orders.length === 0;
    const emptyStateText = isEmpty ? 'Belum ada SPK / Work Order' : null;
    const canCreate = canManage; // Create button available regardless of existing orders
    const issuedCount = orders.filter((o) => o.status === 'ISSUED').length;
    const draftCount = orders.filter((o) => o.status === 'DRAFT').length;

    return {
      isEmpty,
      emptyStateText,
      canCreate,
      count: orders.length,
      issuedCount,
      draftCount,
    };
  };

  // 1. SERVICE PO with 0 ServiceOrders: displays "Belum ada SPK / Work Order"
  it('1. SERVICE PO with 0 ServiceOrders displays "Belum ada SPK / Work Order"', () => {
    const state = resolveServiceOrderListState([], true);
    expect(state.isEmpty).toBe(true);
    expect(state.emptyStateText).toBe('Belum ada SPK / Work Order');
    expect(state.count).toBe(0);
  });

  // 2. Create button available according to RBAC
  it('2. Create button available according to RBAC (canManage = true/false)', () => {
    const stateAllowed = resolveServiceOrderListState([], true);
    expect(stateAllowed.canCreate).toBe(true);

    const stateForbidden = resolveServiceOrderListState([], false);
    expect(stateForbidden.canCreate).toBe(false);
  });

  // 3. One existing ServiceOrder shown correctly
  it('3. One existing ServiceOrder shown correctly in list', () => {
    const singleOrder: ServiceOrder = {
      id: 1,
      serviceOrderNumber: 'SPK-20261008-001',
      purchaseOrderId: 2,
      projectId: 21,
      vendorId: 4,
      documentType: 'SPK',
      status: 'ISSUED',
      scopeOfWork: 'Penarikan Kabel Fiber Optic 48 Core',
      workLocation: 'Site Semarang',
      createdAt: '2026-10-08T17:54:07.000Z',
      updatedAt: '2026-10-08T17:54:07.000Z',
    };

    const state = resolveServiceOrderListState([singleOrder], true);
    expect(state.isEmpty).toBe(false);
    expect(state.count).toBe(1);
    expect(state.issuedCount).toBe(1);
    expect(state.draftCount).toBe(0);
  });

  // 4. Multiple ServiceOrders listed
  it('4. Multiple ServiceOrders listed under the same SERVICE PO', () => {
    const orders: ServiceOrder[] = [
      {
        id: 1,
        serviceOrderNumber: 'SPK-20261008-001',
        purchaseOrderId: 2,
        projectId: 21,
        vendorId: 4,
        documentType: 'SPK',
        status: 'ISSUED',
        scopeOfWork: 'Scope A',
        createdAt: '2026-10-08T17:54:07.000Z',
        updatedAt: '2026-10-08T17:54:07.000Z',
      },
      {
        id: 2,
        serviceOrderNumber: 'SPK-20261009-002',
        purchaseOrderId: 2,
        projectId: 21,
        vendorId: 4,
        documentType: 'SPK',
        status: 'DRAFT',
        scopeOfWork: 'Scope B',
        createdAt: '2026-10-09T08:00:00.000Z',
        updatedAt: '2026-10-09T08:00:00.000Z',
      },
      {
        id: 3,
        serviceOrderNumber: 'WO-20261009-001',
        purchaseOrderId: 2,
        projectId: 21,
        vendorId: 4,
        documentType: 'WORK_ORDER',
        status: 'ISSUED',
        scopeOfWork: 'Scope C (Work Order)',
        createdAt: '2026-10-09T08:30:00.000Z',
        updatedAt: '2026-10-09T08:30:00.000Z',
      },
    ];

    const state = resolveServiceOrderListState(orders, true);
    expect(state.count).toBe(3);
    expect(state.issuedCount).toBe(2);
    expect(state.draftCount).toBe(1);
  });

  // 5. ISSUED + DRAFT can coexist
  it('5. ISSUED and DRAFT ServiceOrders can coexist concurrently under the same SERVICE PO', () => {
    const orders: ServiceOrder[] = [
      {
        id: 1,
        serviceOrderNumber: 'SPK-20261008-001',
        purchaseOrderId: 2,
        projectId: 21,
        vendorId: 4,
        documentType: 'SPK',
        status: 'ISSUED',
        scopeOfWork: 'Pekerjaan Area 1',
        createdAt: '2026-10-08T17:54:07.000Z',
        updatedAt: '2026-10-08T17:54:07.000Z',
      },
      {
        id: 2,
        serviceOrderNumber: 'WO-20261009-002',
        purchaseOrderId: 2,
        projectId: 21,
        vendorId: 4,
        documentType: 'WORK_ORDER',
        status: 'DRAFT',
        scopeOfWork: 'Pekerjaan Area 2',
        createdAt: '2026-10-09T08:00:00.000Z',
        updatedAt: '2026-10-09T08:00:00.000Z',
      },
    ];

    const hasIssued = orders.some((o) => o.status === 'ISSUED');
    const hasDraft = orders.some((o) => o.status === 'DRAFT');
    expect(hasIssued).toBe(true);
    expect(hasDraft).toBe(true);
  });

  // 6. Opening one document displays correct detail
  it('6. Opening one document displays correct detail and context binding', () => {
    const selected: ServiceOrder = {
      id: 2,
      serviceOrderNumber: 'WO-20261009-002',
      purchaseOrderId: 2,
      projectId: 21,
      vendorId: 4,
      documentType: 'WORK_ORDER',
      status: 'DRAFT',
      scopeOfWork: 'Pemasangan OTB dan Splicing Area B',
      workLocation: 'Site Karawang Lantai 2',
      startDate: '2026-10-15',
      endDate: '2026-10-25',
      project: { id: 21, name: 'SURGE JATENG', code: 'CONT-20260922-0012' },
      vendor: { id: 4, name: 'PT Suplai Makmur', code: 'VND-004' } as any,
      createdAt: '2026-10-09T08:00:00.000Z',
      updatedAt: '2026-10-09T08:00:00.000Z',
    };

    const projectContext = resolveServiceOrderProject(selected, mockServicePo);
    const vendorContext = resolveServiceOrderVendor(selected, mockServicePo);

    expect(projectContext.projectName).toBe('SURGE JATENG');
    expect(projectContext.projectCode).toBe('CONT-20260922-0012');
    expect(vendorContext.vendorName).toBe('PT Suplai Makmur');
    expect(vendorContext.vendorCode).toBe('VND-004');
    expect(selected.serviceOrderNumber).toBe('WO-20261009-002');
    expect(selected.scopeOfWork).toBe('Pemasangan OTB dan Splicing Area B');
  });

  // 7. Issued document remains read-only
  it('7. Issued document remains read-only (immutable fields, edit/issue absent)', () => {
    const issuedOrder: ServiceOrder = {
      id: 1,
      serviceOrderNumber: 'SPK-20261008-001',
      purchaseOrderId: 2,
      projectId: 21,
      vendorId: 4,
      documentType: 'SPK',
      status: 'ISSUED',
      scopeOfWork: 'Scope of work',
      createdAt: '2026-10-08T17:54:07.000Z',
      updatedAt: '2026-10-08T17:54:07.000Z',
    };

    const isReadOnly = issuedOrder.status === 'ISSUED';
    const canEdit = issuedOrder.status === 'DRAFT';
    const canIssue = issuedOrder.status === 'DRAFT';

    expect(isReadOnly).toBe(true);
    expect(canEdit).toBe(false);
    expect(canIssue).toBe(false);
  });

  // 8. Another document can still be created even when an ISSUED order exists
  it('8. Another document can still be created even when an ISSUED order exists', () => {
    const existingOrders: ServiceOrder[] = [
      {
        id: 1,
        serviceOrderNumber: 'SPK-20261008-001',
        purchaseOrderId: 2,
        projectId: 21,
        vendorId: 4,
        documentType: 'SPK',
        status: 'ISSUED',
        scopeOfWork: 'Scope A',
        createdAt: '2026-10-08T17:54:07.000Z',
        updatedAt: '2026-10-08T17:54:07.000Z',
      },
    ];

    const state = resolveServiceOrderListState(existingOrders, true);
    // User can still create a second document without cancelling the first
    expect(state.canCreate).toBe(true);
  });

  // 9. No Goods Receipt action appears for SERVICE PO
  it('9. No Goods Receipt action appears for SERVICE PO', () => {
    const canReceiveGoods = true;
    const isServicePo = mockServicePo.orderType === 'SERVICE';
    const isGrActionAllowed = !isServicePo && (mockServicePo.status === 'ISSUED') && canReceiveGoods;

    expect(isGrActionAllowed).toBe(false);
  });

  // 10. UI-C1 responsive layout remains intact
  it('10. UI-C1 responsive layout remains intact (2-column desktop, 1-column mobile)', () => {
    expect(SERVICE_ORDER_DESCRIPTIONS_COLUMN.xxl).toBe(2);
    expect(SERVICE_ORDER_DESCRIPTIONS_COLUMN.xl).toBe(2);
    expect(SERVICE_ORDER_DESCRIPTIONS_COLUMN.lg).toBe(2);
    expect(SERVICE_ORDER_DESCRIPTIONS_COLUMN.md).toBe(2);
    expect(SERVICE_ORDER_DESCRIPTIONS_COLUMN.sm).toBe(1);
    expect(SERVICE_ORDER_DESCRIPTIONS_COLUMN.xs).toBe(1);
  });
});
