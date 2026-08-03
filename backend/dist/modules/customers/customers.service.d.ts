import { Repository } from 'typeorm';
import { Customer } from '../../entities/customer.entity';
import { Tender } from '../../entities/tender.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryDto } from './dto/customer.dto';
export declare class CustomersService {
    private customerRepo;
    private tendersRepository;
    private auditRepo;
    constructor(customerRepo: Repository<Customer>, tendersRepository: Repository<Tender>, auditRepo: Repository<AuditLog>);
    private logAudit;
    private generateNextCode;
    create(dto: CreateCustomerDto, userId: number): Promise<Customer>;
    findAll(query: CustomerQueryDto): Promise<{
        data: Customer[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    findOne(id: number): Promise<Customer>;
    update(id: number, dto: UpdateCustomerDto, userId: number, ipAddress?: string, userAgent?: string): Promise<Customer>;
    remove(id: number, userId: number, ipAddress?: string, userAgent?: string): Promise<{
        message: string;
    }>;
    exportCustomers(): Promise<{
        filename: string;
        total: number;
        data: Customer[];
    }>;
    importCustomers(items: any[], userId: number): Promise<{
        status: string;
        imported: number;
    }>;
}
