import { normalizeGoodsReceiptViewItems } from '../GoodsReceiptModal';

describe('Goods Receipt View-Mode Item Detail Mapping Tests', () => {
  const sampleBackendGrItems = [
    {
      id: 11,
      grId: 4,
      poItemId: 11,
      receivedQuantity: '6000.00',
      remarks: 'Batch 1 safe',
      purchaseOrderItem: {
        id: 11,
        purchaseOrderId: 4,
        prItemId: 13,
        costItemId: 87,
        itemName: 'Cable fo 24C/2T',
        quantity: '6000.00',
        receivedQuantity: '6000.00',
        unitPrice: '63000.00',
        totalPrice: '378000000.00',
        purchaseRequestItem: {
          id: 13,
          prId: 5,
          itemName: 'Cable fo 24C/2T',
          uom: 'Meter',
          quantity: '6000.00',
        },
        costItem: {
          id: 87,
          categoryKey: 'MATERIAL',
          itemName: 'Cable fo 24C/2T',
          description: 'Fiber Optic Cable 24 Core 2 Tube G.652D Aerial',
          uom: 'Meter',
          quantity: '6000.00',
        },
      },
    },
    {
      id: 12,
      grId: 4,
      poItemId: 12,
      receivedQuantity: '2.00',
      remarks: '',
      purchaseOrderItem: {
        id: 12,
        purchaseOrderId: 4,
        prItemId: 14,
        costItemId: 88,
        itemName: 'Tiang 7m 4"',
        quantity: '2.00',
        receivedQuantity: '2.00',
        unitPrice: '1400000.00',
        totalPrice: '2800000.00',
        purchaseRequestItem: {
          id: 14,
          prId: 5,
          itemName: 'Tiang 7m 4"',
          uom: 'Unit',
          quantity: '2.00',
        },
        costItem: {
          id: 88,
          categoryKey: 'MATERIAL',
          itemName: 'Tiang 7m 4"',
          description: null, // missing optional specification
          uom: 'Unit',
          quantity: '2.00',
        },
      },
    },
    {
      id: 21,
      grId: 4,
      poItemId: 21,
      receivedQuantity: '1.00',
      remarks: 'Installed',
      purchaseOrderItem: {
        id: 21,
        purchaseOrderId: 4,
        prItemId: 23,
        costItemId: 111,
        itemName: 'HOMEBASE',
        quantity: '1.00',
        receivedQuantity: '1.00',
        unitPrice: '3000000.00',
        totalPrice: '3000000.00',
        purchaseRequestItem: {
          id: 23,
          prId: 5,
          itemName: 'HOMEBASE',
          uom: 'Unit',
          quantity: '1.00',
        },
        costItem: {
          id: 111,
          categoryKey: 'EQUIPMENT',
          itemName: 'HOMEBASE',
          description: 'Central Base Station Unit',
          uom: 'Unit',
          quantity: '1.00',
        },
      },
    },
  ];

  it('1. Item Name: "Cable fo 24C/2T" resolves as actual item name', () => {
    const normalized = normalizeGoodsReceiptViewItems(sampleBackendGrItems);
    expect(normalized[0].itemName).toBe('Cable fo 24C/2T');
    expect(normalized[0].itemName).not.toBe('Material');
  });

  it('2. Category: "MATERIAL" renders as category badge property, not replacement item name', () => {
    const normalized = normalizeGoodsReceiptViewItems(sampleBackendGrItems);
    expect(normalized[0].categoryName).toBe('MATERIAL');
    expect(normalized[0].itemName).toBe('Cable fo 24C/2T');
  });

  it('3. EQUIPMENT item: "HOMEBASE" renders item name + EQUIPMENT category badge', () => {
    const normalized = normalizeGoodsReceiptViewItems(sampleBackendGrItems);
    expect(normalized[2].itemName).toBe('HOMEBASE');
    expect(normalized[2].categoryName).toBe('EQUIPMENT');
    expect(normalized[2].itemName).not.toBe('EQUIPMENT');
    expect(normalized[2].itemName).not.toBe('Material');
  });

  it('4. Qty Dipesan: 6000 renders correctly from PO item quantity', () => {
    const normalized = normalizeGoodsReceiptViewItems(sampleBackendGrItems);
    expect(normalized[0].orderedQty).toBe(6000);
    expect(normalized[1].orderedQty).toBe(2);
    expect(normalized[2].orderedQty).toBe(1);
  });

  it('5. Satuan: "Meter" and "Unit" render correctly from canonical PR / Cost Item UoM', () => {
    const normalized = normalizeGoodsReceiptViewItems(sampleBackendGrItems);
    expect(normalized[0].uom).toBe('Meter');
    expect(normalized[1].uom).toBe('Unit');
    expect(normalized[2].uom).toBe('Unit');
  });

  it('6. Received Qty: 6000 renders correctly with canonical UoM (e.g. 6000 Meter)', () => {
    const normalized = normalizeGoodsReceiptViewItems(sampleBackendGrItems);
    expect(normalized[0].receivedQuantity).toBe(6000);
    expect(`${normalized[0].receivedQuantity} ${normalized[0].uom}`).toBe('6000 Meter');
    expect(`${normalized[1].receivedQuantity} ${normalized[1].uom}`).toBe('2 Unit');
    expect(`${normalized[2].receivedQuantity} ${normalized[2].uom}`).toBe('1 Unit');
  });

  it('7. Specification: renders when available from Cost Item description', () => {
    const normalized = normalizeGoodsReceiptViewItems(sampleBackendGrItems);
    expect(normalized[0].specification).toBe('Fiber Optic Cable 24 Core 2 Tube G.652D Aerial');
    expect(normalized[2].specification).toBe('Central Base Station Unit');
  });

  it('8. Missing optional specification: does not break row and sets specification to empty string', () => {
    const normalized = normalizeGoodsReceiptViewItems(sampleBackendGrItems);
    expect(normalized[1].specification).toBe('');
    expect(normalized[1].itemName).toBe('Tiang 7m 4"');
    expect(normalized[1].orderedQty).toBe(2);
    expect(normalized[1].receivedQuantity).toBe(2);
    expect(normalized[1].uom).toBe('Unit');
  });

  it('9. No fallback "Material" is shown as the item name across all rows', () => {
    const normalized = normalizeGoodsReceiptViewItems(sampleBackendGrItems);
    for (const item of normalized) {
      expect(item.itemName).not.toBe('Material');
      expect(item.itemName.length).toBeGreaterThan(0);
    }
  });

  it('10. Historical GR Safety: displays own GR receivedQuantity, not recomputed from current PO state', () => {
    // Simulate historical partial GR: PO has cumulative 6000 received, but this GR was batch of 2500
    const historicalGrItem = [
      {
        id: 5,
        grId: 2,
        poItemId: 11,
        receivedQuantity: '2500.00',
        remarks: 'First partial batch',
        purchaseOrderItem: {
          id: 11,
          itemName: 'Cable fo 24C/2T',
          quantity: '6000.00',
          receivedQuantity: '6000.00', // cumulative today
        },
      },
    ];

    const normalized = normalizeGoodsReceiptViewItems(historicalGrItem);
    expect(normalized[0].receivedQuantity).toBe(2500); // Uses this GR's receipt quantity
    expect(normalized[0].orderedQty).toBe(6000); // Uses PO ordered quantity
    expect(normalized[0].previouslyReceivedQty).toBe(6000); // Reflects PO cumulative
  });
});
