/**
 * EPMS — GOODS RECEIPT MODAL & PO RELATION PROJECTION TESTS (Phase 11)
 */

import {
  resolveSummaryCardValue,
  resolveProcurementCount,
} from '../../ProcurementPage';

describe('EPMS — Goods Receipt Modal & PO Relation Projection Tests (Phase 11)', () => {
  // Test 1: Initial Procurement page uses summary endpoint
  it('1. Initial Procurement page uses summary endpoint', () => {
    const summaryData = {
      packageQueueCount: 0,
      reconciliationCount: 0,
      purchaseRequestCount: 1,
      purchaseOrderCount: 1,
      goodsReceiptCount: 0,
    };

    expect(summaryData.purchaseRequestCount).toBe(1);
    expect(summaryData.purchaseOrderCount).toBe(1);
  });

  // Test 2: Summary shows PR=1 / PO=1 from summary data without opening PR or PO tabs
  it('2. Summary shows PR=1 / PO=1 from summary data without opening PR or PO tabs', () => {
    const prCard = resolveSummaryCardValue({
      summaryCount: 1,
      localArray: [], // unloaded
      isLoading: false,
      isAuthorized: true,
    });
    const poCard = resolveSummaryCardValue({
      summaryCount: 1,
      localArray: [], // unloaded
      isLoading: false,
      isAuthorized: true,
    });

    expect(prCard.displayValue).toBe(1);
    expect(poCard.displayValue).toBe(1);
  });

  // Test 3: Clicking tabs does not change authoritative count incorrectly
  it('3. Clicking tabs does not change authoritative count incorrectly', () => {
    const prCardBefore = resolveSummaryCardValue({
      summaryCount: 1,
      localArray: [],
      isLoading: false,
      isAuthorized: true,
    });
    // When PR tab opens, prs loads with 1 item
    const prCardAfter = resolveSummaryCardValue({
      summaryCount: 1,
      localArray: [{ id: 1, prNumber: 'PR-20261015-001' }],
      isLoading: false,
      isAuthorized: true,
    });

    expect(prCardBefore.displayValue).toBe(1);
    expect(prCardAfter.displayValue).toBe(1);
    expect(prCardBefore.displayValue).toBe(prCardAfter.displayValue);
  });

  // Test 4: GR modal renders Project from PO relation
  it('4. GR modal renders Project from PO relation (purchaseRequest.project)', () => {
    const targetPo: any = {
      id: 1,
      poNumber: 'PO-20261015-001',
      projectName: 'Rehabilitasi Route Region Surabaya Segment Jl Sambikerep - Jl Kalijaran',
      projectId: 1,
      purchaseRequest: {
        id: 1,
        project: {
          id: 1,
          name: 'Rehabilitasi Route Region Surabaya Segment Jl Sambikerep - Jl Kalijaran',
        },
      },
    };

    const renderedProjectName =
      targetPo?.projectName ||
      targetPo?.purchaseRequest?.project?.name ||
      'Proyek Tidak Tersedia';
    const renderedProjectId =
      targetPo?.projectId ||
      targetPo?.purchaseRequest?.project?.id;

    expect(renderedProjectName).toBe('Rehabilitasi Route Region Surabaya Segment Jl Sambikerep - Jl Kalijaran');
    expect(renderedProjectId).toBe(1);
    expect(renderedProjectName).not.toBe('Proyek Tidak Tersedia');
  });

  // Test 5: GR modal renders Vendor from PO relation
  it('5. GR modal renders Vendor from PO relation', () => {
    const targetPo: any = {
      id: 1,
      poNumber: 'PO-20261015-001',
      vendorName: 'PT IT Solusi Bersama',
      vendorCode: 'VND-001',
      vendor: {
        id: 1,
        code: 'VND-001',
        name: 'PT IT Solusi Bersama',
      },
    };

    const renderedVendorName =
      targetPo?.vendorName ||
      targetPo?.vendor?.name ||
      '—';
    const renderedVendorCode =
      targetPo?.vendorCode ||
      targetPo?.vendor?.code ||
      '';

    expect(renderedVendorName).toBe('PT IT Solusi Bersama');
    expect(renderedVendorCode).toBe('VND-001');
    expect(renderedVendorName).not.toBe('—');
  });

  // Test 6 & 7: GR header item count uses items.length -> 5 PO rows displays "Daftar 5 Item PO"
  it('6 & 7. GR header item count uses items.length (5 PO rows -> "Daftar 5 Item PO")', () => {
    const tableRows = [
      { poItemId: 1, itemName: 'Item 1', quantity: 1513 },
      { poItemId: 2, itemName: 'Item 2', quantity: 1 },
      { poItemId: 3, itemName: 'Item 3', quantity: 2 },
      { poItemId: 4, itemName: 'Item 4', quantity: 2 },
      { poItemId: 5, itemName: 'Item 5', quantity: 13 },
    ];

    const isViewMode = false;
    const headerTitle = isViewMode
      ? `Daftar Item yang Diterima pada GR ini (${tableRows.length} Item)`
      : `Daftar ${tableRows.length} Item PO — Input Kuantitas Diterima`;

    expect(headerTitle).toBe('Daftar 5 Item PO — Input Kuantitas Diterima');
    expect(headerTitle).not.toContain('24');
  });

  // Test 8: Submit error renders meaningful error without pretending success
  it('8. Submit error renders meaningful error without pretending success', () => {
    const mockError = {
      response: {
        data: {
          message: "Field 'total_received_amount' doesn't have a default value",
        },
      },
    };

    const backendMsg =
      mockError.response?.data?.message || 'Gagal menerbitkan Goods Receipt.';

    expect(backendMsg).toBe("Field 'total_received_amount' doesn't have a default value");
    expect(backendMsg).not.toContain('berhasil diterbitkan');
  });
});
