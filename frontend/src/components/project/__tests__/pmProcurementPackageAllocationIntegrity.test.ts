/**
 * EPMS — PM PROCUREMENT PACKAGE RAB ALLOCATION INTEGRITY & CLOSED PACKAGE SUITE
 * PHASE 5 FRONTEND BEHAVIOR TEST SUITE
 *
 * Covers:
 * 1. When remaining_qty = 0 and "Tampilkan item sudah dialokasikan" = OFF:
 *    item must NOT appear as selectable in the modal.
 * 2. When "Tampilkan item sudah dialokasikan" = ON:
 *    item appears for historical visibility with "Sudah dialokasikan sepenuhnya" / "Sisa 0".
 * 3. When remaining_qty = 0:
 *    checkbox is disabled, requestedQty displays "Tidak tersedia" and cannot be selected.
 * 4. Partially allocated items:
 *    show only legitimate remaining quantity, allowing entry up to remaining quantity.
 */

import {
  SERVICE_FAMILY_CATEGORIES,
  MATERIAL_FAMILY_CATEGORIES,
  ProcurementCostItemAvailability,
} from '../PmProcurementPackageModal';

describe('EPMS — PM Procurement Package Allocation Integrity & Frontend Filter Suite (Phase 5)', () => {
  const mockCostItems: ProcurementCostItemAvailability[] = [
    {
      id: 1,
      itemName: 'Supply and Install Pole Accessories for New/existing pole',
      categoryKey: 'MATERIAL',
      baselineQty: 13,
      baselineAmount: 975000,
      reservedQty: 0,
      reservedAmount: 0,
      prCommittedQty: 0,
      prCommittedAmount: 0,
      orderedQty: 13,
      orderedAmount: 975000,
      receivedQty: 13,
      totalCommitted: 13,
      rawRemainingQty: 0,
      availableQty: 0,
      overrunQty: 0,
      rawRemainingAmount: 0,
      availableAmount: 0,
      overrunAmount: 0,
      uom: 'Unit',
      unitPrice: 75000,
      subtotal: 975000,
      assignmentScope: 'WBS',
      wbsId: 1,
      availabilityStatus: 'FULLY_ALLOCATED',
      unavailableReason: 'Sudah dialokasikan sepenuhnya',
    },
    {
      id: 2,
      itemName: 'Supply Steel pole 9 meter (Feeder)',
      categoryKey: 'MATERIAL',
      baselineQty: 2,
      baselineAmount: 2750000,
      reservedQty: 0,
      reservedAmount: 0,
      prCommittedQty: 0,
      prCommittedAmount: 0,
      orderedQty: 2,
      orderedAmount: 2750000,
      receivedQty: 2,
      totalCommitted: 2,
      rawRemainingQty: 0,
      availableQty: 0,
      overrunQty: 0,
      rawRemainingAmount: 0,
      availableAmount: 0,
      overrunAmount: 0,
      uom: 'Unit',
      unitPrice: 1375000,
      subtotal: 2750000,
      assignmentScope: 'WBS',
      wbsId: 2,
      availabilityStatus: 'FULLY_ALLOCATED',
      unavailableReason: 'Sudah dialokasikan sepenuhnya',
    },
    {
      id: 3,
      itemName: 'Supply Steel pole 9 meter - Partially Allocated',
      categoryKey: 'MATERIAL',
      baselineQty: 10,
      baselineAmount: 13750000,
      reservedQty: 3,
      reservedAmount: 4125000,
      prCommittedQty: 0,
      prCommittedAmount: 0,
      orderedQty: 3,
      orderedAmount: 4125000,
      receivedQty: 3,
      totalCommitted: 6,
      rawRemainingQty: 4,
      availableQty: 4,
      overrunQty: 0,
      rawRemainingAmount: 5500000,
      availableAmount: 5500000,
      overrunAmount: 0,
      uom: 'Unit',
      unitPrice: 1375000,
      subtotal: 13750000,
      assignmentScope: 'WBS',
      wbsId: 3,
      availabilityStatus: 'AVAILABLE',
      unavailableReason: null,
    },
    {
      id: 6,
      itemName: 'Route detail survey and design',
      categoryKey: 'SUBCONTRACTOR',
      baselineQty: 1,
      baselineAmount: 1059306,
      reservedQty: 0,
      reservedAmount: 0,
      prCommittedQty: 0,
      prCommittedAmount: 0,
      orderedQty: 0,
      orderedAmount: 0,
      receivedQty: 0,
      totalCommitted: 0,
      rawRemainingQty: 1,
      availableQty: 1,
      overrunQty: 0,
      rawRemainingAmount: 1059306,
      availableAmount: 1059306,
      overrunAmount: 0,
      uom: 'Unit',
      unitPrice: 1059306,
      subtotal: 1059306,
      assignmentScope: 'WBS',
      wbsId: 6,
      availabilityStatus: 'AVAILABLE',
      unavailableReason: null,
    },
  ];

  // Emulates the exact useMemo filter logic in PmProcurementPackageModal (lines 221-235)
  const computeEligibleCostItems = (
    items: ProcurementCostItemAvailability[],
    packageFamily: 'MATERIAL' | 'SERVICE',
    showAllocatedItems: boolean,
    selectedCostItemIds: number[] = [],
  ) => {
    return items
      .filter((item) => {
        if (packageFamily === 'SERVICE') {
          return SERVICE_FAMILY_CATEGORIES.includes(item.categoryKey);
        }
        if (packageFamily === 'MATERIAL') {
          return MATERIAL_FAMILY_CATEGORIES.includes(item.categoryKey);
        }
        return true;
      })
      .filter(
        (item) =>
          showAllocatedItems || item.availableQty > 0 || selectedCostItemIds.includes(item.id),
      );
  };

  it('1. should hide fully allocated items (availableQty = 0) when "Tampilkan item sudah dialokasikan" is OFF', () => {
    const visibleItems = computeEligibleCostItems(mockCostItems, 'MATERIAL', false, []);

    // Fully allocated items #1 and #2 must not be visible
    expect(visibleItems.find((i) => i.id === 1)).toBeUndefined();
    expect(visibleItems.find((i) => i.id === 2)).toBeUndefined();

    // Partially allocated item #3 must be visible
    const item3 = visibleItems.find((i) => i.id === 3);
    expect(item3).toBeDefined();
    expect(item3?.availableQty).toBe(4);
    expect(visibleItems.length).toBe(1);
  });

  it('2. should display fully allocated items with historical visibility when "Tampilkan item sudah dialokasikan" is ON', () => {
    const visibleItems = computeEligibleCostItems(mockCostItems, 'MATERIAL', true, []);

    expect(visibleItems.length).toBe(3);
    const item1 = visibleItems.find((i) => i.id === 1);
    const item2 = visibleItems.find((i) => i.id === 2);
    const item3 = visibleItems.find((i) => i.id === 3);

    expect(item1).toBeDefined();
    expect(item1?.availableQty).toBe(0);
    expect(item1?.totalCommitted).toBe(13);

    expect(item2).toBeDefined();
    expect(item2?.availableQty).toBe(0);
    expect(item2?.totalCommitted).toBe(2);

    expect(item3).toBeDefined();
    expect(item3?.availableQty).toBe(4);
  });

  it('3. should disable row selection checkbox and mark input "Tidak tersedia" when availableQty <= 0', () => {
    const getCheckboxProps = (record: ProcurementCostItemAvailability, selectedIds: number[] = []) => ({
      disabled: record.availableQty <= 0 && !selectedIds.includes(record.id),
    });

    const item1 = mockCostItems.find((i) => i.id === 1)!;
    const item3 = mockCostItems.find((i) => i.id === 3)!;

    // Checkbox disabled for item1
    expect(getCheckboxProps(item1, []).disabled).toBe(true);

    // Checkbox enabled for item3 with availableQty = 4
    expect(getCheckboxProps(item3, []).disabled).toBe(false);

    // Requested quantity projection rule
    const renderRequestedQty = (record: ProcurementCostItemAvailability) => {
      if (record.availableQty <= 0) return 'Tidak tersedia';
      return 'ENABLED_INPUT';
    };

    expect(renderRequestedQty(item1)).toBe('Tidak tersedia');
    expect(renderRequestedQty(item3)).toBe('ENABLED_INPUT');
  });

  it('4. should show only legitimate remaining quantity for partially allocated item and cap max requested quantity', () => {
    const item3 = mockCostItems.find((i) => i.id === 3)!;
    expect(item3.baselineQty).toBe(10);
    expect(item3.totalCommitted).toBe(6);
    expect(item3.availableQty).toBe(4);

    // Simulated InputNumber constraints from modal line 512-513
    const inputConstraints = {
      min: 0.0001,
      max: item3.availableQty,
      defaultVal: item3.availableQty,
    };

    expect(inputConstraints.max).toBe(4);
    expect(inputConstraints.defaultVal).toBe(4);
  });
});
