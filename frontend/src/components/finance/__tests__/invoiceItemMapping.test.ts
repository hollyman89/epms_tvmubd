import { normalizeInvoiceItem } from '../invoiceItemProjection';

describe('PRE-W10 UIUX-DP1 Frontend Invoice Item Mapping Tests (ROOT-02)', () => {
  it('8. purchaseOrderItem.itemName renders accurately from backend relation', () => {
    const rawLineItem = {
      id: 1,
      poItemId: 11,
      quantity: 6000,
      purchaseOrderItem: {
        id: 11,
        itemName: 'Cable fo 24C/2T',
        purchaseRequestItem: {
          uom: 'Meter',
        },
      },
    };

    const res = normalizeInvoiceItem(rawLineItem);
    expect(res.itemName).toBe('Cable fo 24C/2T');
    expect(res.uom).toBe('Meter');
  });

  it('9. poItem property mismatch is eliminated (supports canonical purchaseOrderItem and avoids breaking on old poItem contract)', () => {
    // Legacy frontend expected `it.poItem?.itemName` which was undefined in real entity contract
    const itemWithoutPoItem = {
      id: 2,
      poItemId: 12,
      quantity: 2,
      // Note: no poItem property!
      purchaseOrderItem: {
        id: 12,
        itemName: 'Tiang 7m 4"',
        purchaseRequestItem: {
          uom: 'Unit',
        },
      },
    };

    const res = normalizeInvoiceItem(itemWithoutPoItem);
    expect(res.itemName).toBe('Tiang 7m 4"');
    expect(res.uom).toBe('Unit');
  });

  it('10. UoM renders accurately from linked purchasing line (Meter, Unit, PCS) and does not default to Unit when actual UoM exists', () => {
    const itemMeter = {
      purchaseOrderItem: {
        itemName: 'Kabel Fiber Optik',
        purchaseRequestItem: { uom: 'Meter' },
      },
    };
    const itemPcs = {
      purchaseOrderItem: {
        itemName: 'Konektor RJ45',
        purchaseRequestItem: { uom: 'PCS' },
      },
    };

    expect(normalizeInvoiceItem(itemMeter).uom).toBe('Meter');
    expect(normalizeInvoiceItem(itemPcs).uom).toBe('PCS');
  });

  it('11. Missing optional specification / description is completely safe', () => {
    const itemWithoutSpec = {
      purchaseOrderItem: {
        itemName: 'Tiang 7m 4"',
        purchaseRequestItem: { uom: 'Unit' },
      },
    };

    const res = normalizeInvoiceItem(itemWithoutSpec);
    expect(res.specification).toBeNull();
    expect(res.itemName).toBe('Tiang 7m 4"');

    const itemWithSpec = {
      purchaseOrderItem: {
        itemName: 'Cable fo 24C/2T',
        costItem: {
          description: 'Fiber Optic Cable 24 Core 2 Tube G.652D Aerial',
        },
        purchaseRequestItem: { uom: 'Meter' },
      },
    };

    const resWithSpec = normalizeInvoiceItem(itemWithSpec);
    expect(resWithSpec.specification).toBe('Fiber Optic Cable 24 Core 2 Tube G.652D Aerial');
  });

  it('12. Technical Item # fallback is NOT used when actual item name exists', () => {
    const itemWithName = {
      poItemId: 123,
      purchaseOrderItem: {
        itemName: 'Router Gateway Pro',
      },
    };

    const res = normalizeInvoiceItem(itemWithName);
    expect(res.itemName).not.toBe('Item #123');
    expect(res.itemName).toBe('Router Gateway Pro');

    // Only falls back to Item #123 when no name is available anywhere
    const itemWithoutAnyName = {
      poItemId: 123,
      purchaseOrderItem: null,
    };
    expect(normalizeInvoiceItem(itemWithoutAnyName).itemName).toBe('Item #123');
  });
});
