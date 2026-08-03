export declare class CreateTenderDto {
    customerId: number;
    projectName: string;
    marketingPicId?: number;
    picCustomerName?: string;
    picCustomerPhone?: string;
    picCustomerEmail?: string;
    businessSector?: string;
    stage?: string;
    probabilityPercentage?: number;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    source?: string;
    notes?: string;
    estimatedBudget: number;
    expectedClosingDate?: string;
    procurementType?: 'TENDER' | 'DIRECT_APPOINTMENT';
    projectLocation?: string;
    bidSubmissionDeadline?: string;
}
export declare class UpdateTenderStatusDto {
    stage: string;
}
declare const UpdateTenderDto_base: import("@nestjs/common").Type<Partial<CreateTenderDto>>;
export declare class UpdateTenderDto extends UpdateTenderDto_base {
}
export {};
