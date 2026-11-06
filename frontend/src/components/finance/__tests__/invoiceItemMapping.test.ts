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

  describe('Ticket #5 — Contract Item List & Finance Invoice Term Item Integrity', () => {
    it('1. CamelCase itemName is resolved correctly', () => {
      const item = {
        id: 1,
        itemName: 'Kabel ADSS 288 Core',
      };
      const res = normalizeInvoiceItem(item);
      expect(res.itemName).toBe('Kabel ADSS 288 Core');
    });

    it('2. Snake_case item_name is resolved correctly', () => {
      const item = {
        id: 2,
        item_name: 'Pipa Subduct HDPE 40/34',
      };
      const res = normalizeInvoiceItem(item);
      expect(res.itemName).toBe('Pipa Subduct HDPE 40/34');
    });

    it('3. Empty item name falls back to the Purchase Order Item name', () => {
      const itemEmptyName = {
        id: 3,
        itemName: '   ',
        purchaseOrderItem: {
          itemName: 'Tiang Feeder 9 Meter',
        },
      };
      const res = normalizeInvoiceItem(itemEmptyName);
      expect(res.itemName).toBe('Tiang Feeder 9 Meter');

      const itemSnakePo = {
        id: 4,
        purchaseOrderItem: {
          item_name: 'Tiang Feeder 7 Meter',
        },
      };
      expect(normalizeInvoiceItem(itemSnakePo).itemName).toBe('Tiang Feeder 7 Meter');
    });

    it('4. Cost Item description is displayed as specification', () => {
      const item = {
        id: 5,
        itemName: 'Jasa Tarik Kabel',
        purchaseOrderItem: {
          costItem: {
            description: 'Penarikan kabel fiber optik aerial rute SKF Bekasi sepanjang 3000m',
          },
        },
      };
      const res = normalizeInvoiceItem(item);
      expect(res.specification).toBe('Penarikan kabel fiber optik aerial rute SKF Bekasi sepanjang 3000m');
    });

    it('5. Purchase Order Item UoM Meter is preserved', () => {
      const item = {
        id: 6,
        purchaseOrderItem: {
          itemName: 'HDPE Subduct',
          uom: 'Meter',
        },
      };
      const res = normalizeInvoiceItem(item);
      expect(res.uom).toBe('Meter');
    });

    it('6. Purchase Order Item UoM Batang is preserved', () => {
      const item = {
        id: 7,
        purchaseOrderItem: {
          itemName: 'Tiang 7M',
          uom: 'Batang',
        },
      };
      const res = normalizeInvoiceItem(item);
      expect(res.uom).toBe('Batang');
    });

    it('7. Conflicting upstream UoM does not override valid PO UoM', () => {
      const item = {
        id: 8,
        purchaseOrderItem: {
          itemName: 'Tiang 9M',
          uom: 'Batang', // Authoritative PO line UoM
          purchaseRequestItem: { uom: 'Unit' }, // Conflicting upstream PR
          costItem: { uom: 'PCS' }, // Conflicting upstream cost item
        },
      };
      const res = normalizeInvoiceItem(item);
      expect(res.uom).toBe('Batang'); // Must strictly preserve PO UoM
    });

    it('8. Missing PO UoM uses a valid upstream fallback', () => {
      const itemPrFallback = {
        id: 9,
        purchaseOrderItem: {
          itemName: 'Kabel Drop Core',
          uom: null, // PO UoM absent
          purchaseRequestItem: { uom: 'Meter' },
        },
      };
      expect(normalizeInvoiceItem(itemPrFallback).uom).toBe('Meter');

      const itemCostFallback = {
        id: 10,
        purchaseOrderItem: {
          itemName: 'Klem Tiang',
          uom: '',
          costItem: { uom: 'Lot' },
        },
      };
      expect(normalizeInvoiceItem(itemCostFallback).uom).toBe('Lot');
    });

    it('9. Missing all UoM values falls back to Unit', () => {
      const itemNoUom = {
        id: 11,
        itemName: 'Material Pengadaan',
        purchaseOrderItem: {
          itemName: 'Material Pengadaan',
          uom: null,
          purchaseRequestItem: null,
          costItem: null,
        },
      };
      expect(normalizeInvoiceItem(itemNoUom).uom).toBe('Unit');
    });

    it('10. Missing specification is handled safely', () => {
      const item = {
        id: 12,
        itemName: 'Material Standar',
        purchaseOrderItem: {
          costItem: null,
          purchaseRequestItem: null,
        },
      };
      const res = normalizeInvoiceItem(item);
      expect(res.specification).toBeNull();
    });

    it('11. Existing invoice snapshot item name is preserved', () => {
      const item = {
        id: 13,
        itemName: 'Snapshot Fixed Invoice Name (INV-20261018-001)',
        purchaseOrderItem: {
          itemName: 'Different Upstream Name After Modification',
        },
      };
      const res = normalizeInvoiceItem(item);
      expect(res.itemName).toBe('Snapshot Fixed Invoice Name (INV-20261018-001)');
    });
  });
});
