export declare class GoodsReceiptItemDto {
    poItemId: number;
    receivedQuantity: number;
    remarks?: string;
}
export declare class CreateGoodsReceiptDto {
    purchaseOrderId: number;
    receiptDate: string;
    remarks?: string;
    items: GoodsReceiptItemDto[];
}
