export declare class TenderDetailResponseDto {
    id: number;
    title: string;
    customerId: number;
    customerName: string | null;
    projectName: string;
    procurementType: string | null;
    source: string | null;
    stage: string | null;
    priority: string | null;
    estimatedBudget: string | null;
    probabilityPercentage: number | null;
    expectedClosingDate: Date | null;
    bidSubmissionDeadline: Date | null;
    marketingPicId: number | null;
    marketingPicName: string | null;
    picCustomerName: string | null;
    picCustomerPhone: string | null;
    projectLocation: string | null;
    notes: string | null;
    status: string;
    legalStatus?: string | null;
    legalNotes?: string | null;
}
