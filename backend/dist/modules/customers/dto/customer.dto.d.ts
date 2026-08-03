export declare class CreateCustomerDto {
    name: string;
    company?: string;
    contact_person: string;
    phone: string;
    email: string;
    business_sector?: string;
    city?: string;
    status?: string;
    marketing_pic_id?: number;
}
export declare class UpdateCustomerDto {
    name?: string;
    company?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    business_sector?: string;
    city?: string;
    status?: string;
    marketing_pic_id?: number;
}
export declare class CustomerQueryDto {
    search?: string;
    sector?: string;
    status?: string;
    page?: number;
    limit?: number;
}
