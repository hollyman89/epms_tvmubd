export declare class VendorDataDto {
    vendorId: number;
    offeredAmount: number;
    isWinner: boolean;
}
export declare class SubmitVendorComparisonDto {
    rfqId: number;
    vendors: VendorDataDto[];
}
