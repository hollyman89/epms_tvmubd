/**
 * Canonical Line Item Normalization for Invoice Detail (UIUX-ROOT-02 / Ticket #5)
 *
 * Source priority for Item Name:
 * 1. Persisted invoice item snapshot: it.itemName or it.item_name
 * 2. Purchase Order item source: purchaseOrderItem.itemName or purchaseOrderItem.item_name
 * 3. Safe identifier fallback: Item #<poItemId> or Item #<id>
 * 4. Default: '—'
 *
 * Source for UoM (Authoritative PO Item Priority):
 * 1. purchaseOrderItem.uom (Authoritative PO line item UoM: Meter, Batang, Lot, etc.)
 * 2. Upstream fallback if PO UoM is genuinely absent:
 *    - purchaseOrderItem.purchaseRequestItem.uom
 *    - purchaseOrderItem.costItem.uom
 *    - invoiceItem.uom
 * 3. Default: 'Unit'
 *
 * Specification / Route Details:
 * - purchaseOrderItem.costItem.description
 * - purchaseOrderItem.purchaseRequestItem.specification or description
 * - invoiceItem.specification or invoiceItem.description
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
  } else if (it.item_name && typeof it.item_name === 'string' && it.item_name.trim() !== '') {
    itemName = it.item_name.trim();
  } else if (
    it.purchaseOrderItem?.itemName &&
    typeof it.purchaseOrderItem.itemName === 'string' &&
    it.purchaseOrderItem.itemName.trim() !== ''
  ) {
    itemName = it.purchaseOrderItem.itemName.trim();
  } else if (
    it.purchaseOrderItem?.item_name &&
    typeof it.purchaseOrderItem.item_name === 'string' &&
    it.purchaseOrderItem.item_name.trim() !== ''
  ) {
    itemName = it.purchaseOrderItem.item_name.trim();
  } else if (it.poItemId) {
    itemName = `Item #${it.poItemId}`;
  } else if (it.id) {
    itemName = `Item #${it.id}`;
  } else {
    itemName = '—';
  }

  // 2. Resolve canonical UoM (Authoritative Purchase Order Item priority)
  let uom = '';
  if (
    it.purchaseOrderItem?.uom &&
    typeof it.purchaseOrderItem.uom === 'string' &&
    it.purchaseOrderItem.uom.trim() !== ''
  ) {
    uom = it.purchaseOrderItem.uom.trim();
  } else if (
    it.purchaseOrderItem?.purchaseRequestItem?.uom &&
    typeof it.purchaseOrderItem.purchaseRequestItem.uom === 'string' &&
    it.purchaseOrderItem.purchaseRequestItem.uom.trim() !== ''
  ) {
    uom = it.purchaseOrderItem.purchaseRequestItem.uom.trim();
  } else if (
    it.purchaseOrderItem?.costItem?.uom &&
    typeof it.purchaseOrderItem.costItem.uom === 'string' &&
    it.purchaseOrderItem.costItem.uom.trim() !== ''
  ) {
    uom = it.purchaseOrderItem.costItem.uom.trim();
  } else if (it.uom && typeof it.uom === 'string' && it.uom.trim() !== '') {
    uom = it.uom.trim();
  } else {
    uom = 'Unit';
  }

  // 3. Resolve canonical specification / route details (optional)
  let specification: string | null = null;
  if (
    it.purchaseOrderItem?.costItem?.description &&
    typeof it.purchaseOrderItem.costItem.description === 'string' &&
    it.purchaseOrderItem.costItem.description.trim() !== ''
  ) {
    specification = it.purchaseOrderItem.costItem.description.trim();
  } else if (
    it.purchaseOrderItem?.purchaseRequestItem?.specification &&
    typeof it.purchaseOrderItem.purchaseRequestItem.specification === 'string' &&
    it.purchaseOrderItem.purchaseRequestItem.specification.trim() !== ''
  ) {
    specification = it.purchaseOrderItem.purchaseRequestItem.specification.trim();
  } else if (
    it.purchaseOrderItem?.purchaseRequestItem?.description &&
    typeof it.purchaseOrderItem.purchaseRequestItem.description === 'string' &&
    it.purchaseOrderItem.purchaseRequestItem.description.trim() !== ''
  ) {
    specification = it.purchaseOrderItem.purchaseRequestItem.description.trim();
  } else if (
    it.specification &&
    typeof it.specification === 'string' &&
    it.specification.trim() !== ''
  ) {
    specification = it.specification.trim();
  } else if (
    it.description &&
    typeof it.description === 'string' &&
    it.description.trim() !== ''
  ) {
    specification = it.description.trim();
  }

  return {
    itemName,
    uom: String(uom).trim() || 'Unit',
    specification,
  };
}
