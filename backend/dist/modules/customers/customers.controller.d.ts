import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryDto } from './dto/customer.dto';
export declare class CustomersController {
    private readonly customersService;
    constructor(customersService: CustomersService);
    create(dto: CreateCustomerDto, req: any): Promise<import("../../entities/customer.entity").Customer>;
    findAll(query: CustomerQueryDto): Promise<{
        data: import("../../entities/customer.entity").Customer[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    export(): Promise<{
        filename: string;
        total: number;
        data: import("../../entities/customer.entity").Customer[];
    }>;
    import(body: {
        items: any[];
    }, req: any): Promise<{
        status: string;
        imported: number;
    }>;
    findOne(id: number): Promise<import("../../entities/customer.entity").Customer>;
    update(id: number, dto: UpdateCustomerDto, req: any): Promise<import("../../entities/customer.entity").Customer>;
    remove(id: number, req: any): Promise<{
        message: string;
    }>;
}
