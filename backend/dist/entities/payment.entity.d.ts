import { Invoice } from './invoice.entity';
export declare class Payment {
    id: number;
    version: number;
    invoiceId: number;
    paymentNumber: string;
    paymentDate: Date;
    amount: number;
    createdBy: number;
    updatedBy: number;
    deletedBy: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
    invoice: Invoice;
}
