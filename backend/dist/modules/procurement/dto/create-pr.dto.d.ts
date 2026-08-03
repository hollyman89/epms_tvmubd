export declare class PrItemDto {
    itemName: string;
    quantity: number;
    estimatedUnitPrice: number;
}
export declare class CreatePurchaseRequestDto {
    projectId: number;
    totalEstimatedAmount: number;
    items: PrItemDto[];
}
