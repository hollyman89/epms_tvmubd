export declare class PoItemDto {
    item_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
}
export declare class CreatePurchaseOrderDto {
    purchase_request_id: number;
    vendor_id: number;
    po_items: PoItemDto[];
}
