/**
 * Canonical Line Item Normalization for Invoice Detail (UIUX-ROOT-02)
 *
 * Source priority for Item Name:
 * 1. Persisted invoice item itemName if canonical snapshot exists
 * 2. purchaseOrderItem.itemName
 * 3. Item #<id> fallback only if no item name is available anywhere
 *
 * Source for UoM:
 * 1. purchaseOrderItem.purchaseRequestItem.uom
 * 2. purchaseOrderItem.costItem.uom
 * 3. invoiceItem.uom
 * 4. Default: 'Unit'
 *
 * Specification:
 * - purchaseOrderItem.costItem.description or invoiceItem.specification or invoiceItem.description
 */
export interface NormalizedInvoiceItemPresentation {
  itemName: string;
  uom: string;
  specification: string | null;
}

export function normalizeInvoiceItem(it: any): NormalizedInvoiceItemPresentation {
  if (!it) {
    return {
      itemName: '—',
      uom: 'Unit',
      specification: null,
    };
  }

  // 1. Resolve canonical item name
  let itemName = '';
  if (it.itemName && typeof it.itemName === 'string' && it.itemName.trim() !== '') {
    itemName = it.itemName.trim();
  } else if (
    it.purchaseOrderItem?.itemName &&
    typeof it.purchaseOrderItem.itemName === 'string' &&
    it.purchaseOrderItem.itemName.trim() !== ''
  ) {
    itemName = it.purchaseOrderItem.itemName.trim();
  } else if (it.poItemId) {
    itemName = `Item #${it.poItemId}`;
  } else if (it.id) {
    itemName = `Item #${it.id}`;
  } else {
    itemName = '—';
  }

  // 2. Resolve canonical UoM (never default to Unit if real UoM exists on PR or cost item)
  const uom =
    it.purchaseOrderItem?.purchaseRequestItem?.uom ||
    it.purchaseOrderItem?.costItem?.uom ||
    it.uom ||
    'Unit';

  // 3. Resolve canonical specification (optional)
  const specification =
    it.purchaseOrderItem?.costItem?.description ||
    it.specification ||
    it.description ||
    null;

  return {
    itemName,
    uom: String(uom).trim() || 'Unit',
    specification: specification ? String(specification).trim() : null,
  };
}
