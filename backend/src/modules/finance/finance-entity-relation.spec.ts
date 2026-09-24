import { Invoice } from '../../entities/invoice.entity';
import { InvoiceItem } from '../../entities/invoice-item.entity';
import { PoPaymentTerm, PaymentTermType, PaymentTermStatus } from '../../entities/po-payment-term.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../entities/purchase-order-item.entity';

describe('Finance Entities & Relations Foundation (Phase 7E-D-1)', () => {
  it('1. should instantiate Invoice entity with optional paymentTerm relation', () => {
    const term = new PoPaymentTerm();
    term.id = 10;
    term.poId = 1;
    term.sequence = 1;
    term.termName = 'Termin 1 — DP — 30%';
    term.termType = PaymentTermType.DOWN_PAYMENT;
    term.percentage = 30.00;
    term.amount = 30143997;
    term.status = PaymentTermStatus.PENDING;

    const invoice = new Invoice();
    invoice.id = 100;
    invoice.poId = 1;
    invoice.paymentTermId = term.id;
    invoice.invoiceNumber = 'INV-20260904-001';
    invoice.totalAmount = 30143997;
    invoice.matchStatus = 'MATCHED';
    invoice.paymentStatus = 'UNPAID';
    invoice.status = 'UNPAID';
    invoice.paymentTerm = term;

    expect(invoice.paymentTermId).toBe(10);
    expect(invoice.paymentTerm).toBeDefined();
    expect(invoice.paymentTerm?.termType).toBe(PaymentTermType.DOWN_PAYMENT);
    expect(invoice.paymentTerm?.amount).toBe(30143997);
  });

  it('2. should instantiate Invoice entity with items relation', () => {
    const invoice = new Invoice();
    invoice.id = 101;
    invoice.poId = 1;
    invoice.invoiceNumber = 'INV-20260904-002';
    invoice.totalAmount = 1000000;

    const item1 = new InvoiceItem();
    item1.id = 1;
    item1.invoiceId = invoice.id;
    item1.poItemId = 5;
    item1.itemName = 'Server Rack 42U';
    item1.quantity = 1;
    item1.unitPrice = 1000000;
    item1.totalPrice = 1000000;
    item1.invoice = invoice;

    invoice.items = [item1];

    expect(invoice.items.length).toBe(1);
    expect(invoice.items[0].itemName).toBe('Server Rack 42U');
    expect(invoice.items[0].invoiceId).toBe(101);
    expect(invoice.items[0].invoice).toBe(invoice);
  });

  it('3. should verify InvoiceItem relations to Invoice and PurchaseOrderItem', () => {
    const poItem = new PurchaseOrderItem();
    poItem.id = 5;
    poItem.purchaseOrderId = 1;
    poItem.itemName = 'Fiber Cable 1000m';
    poItem.quantity = 2;
    poItem.unitPrice = 500000;
    poItem.totalPrice = 1000000;

    const invItem = new InvoiceItem();
    invItem.id = 2;
    invItem.invoiceId = 102;
    invItem.poItemId = poItem.id;
    invItem.purchaseOrderItem = poItem;
    invItem.quantity = 2;
    invItem.unitPrice = 500000;
    invItem.totalPrice = 1000000;

    expect(invItem.poItemId).toBe(5);
    expect(invItem.purchaseOrderItem).toBeDefined();
    expect(invItem.purchaseOrderItem?.itemName).toBe('Fiber Cable 1000m');
  });

  it('4. should verify PoPaymentTerm relation to Invoice collection', () => {
    const term = new PoPaymentTerm();
    term.id = 20;
    term.poId = 1;
    term.sequence = 2;
    term.termName = 'Termin 2 — Progress — 30%';
    term.termType = PaymentTermType.PROGRESS;
    term.percentage = 30.00;
    term.amount = 30143997;
    term.status = PaymentTermStatus.INVOICE_SUBMITTED;

    const inv = new Invoice();
    inv.id = 103;
    inv.poId = 1;
    inv.paymentTermId = term.id;
    inv.invoiceNumber = 'INV-20260904-003';
    inv.paymentTerm = term;

    term.invoices = [inv];

    expect(term.invoices.length).toBe(1);
    expect(term.invoices[0].invoiceNumber).toBe('INV-20260904-003');
    expect(term.invoices[0].paymentTermId).toBe(20);
  });

  it('5. should support standalone item-based invoice without paymentTermId (nullable)', () => {
    const standaloneInv = new Invoice();
    standaloneInv.id = 104;
    standaloneInv.poId = 1;
    standaloneInv.paymentTermId = undefined;
    standaloneInv.invoiceNumber = 'INV-20260904-004';

    expect(standaloneInv.paymentTermId).toBeUndefined();
    expect(standaloneInv.paymentTerm).toBeUndefined();
  });
});
