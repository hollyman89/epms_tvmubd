export declare class InvoiceItemDto {
    poItemId: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}
export declare class CreateInvoiceDto {
    purchaseOrderId: number;
    invoiceDate: string;
    items: InvoiceItemDto[];
}
