import { FinanceService } from './finance.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
export declare class FinanceController {
    private readonly financeService;
    constructor(financeService: FinanceService);
    createInvoice(dto: CreateInvoiceDto, req: any): Promise<{
        message: string;
        data: import("../../entities/invoice.entity").Invoice;
    }>;
    createPayment(dto: CreatePaymentDto, req: any): Promise<{
        message: string;
        data: import("../../entities/payment.entity").Payment;
    }>;
    getInvoices(): Promise<{
        message: string;
        data: import("../../entities/invoice.entity").Invoice[];
    }>;
    getPayments(): Promise<{
        message: string;
        data: import("../../entities/payment.entity").Payment[];
    }>;
}
