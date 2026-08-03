import { Repository } from 'typeorm';
import { Project } from '../../entities/project.entity';
import { Payment } from '../../entities/payment.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
export declare class DashboardService {
    private projectRepo;
    private paymentRepo;
    private poRepo;
    private prRepo;
    private readonly logger;
    constructor(projectRepo: Repository<Project>, paymentRepo: Repository<Payment>, poRepo: Repository<PurchaseOrder>, prRepo: Repository<PurchaseRequest>);
    getSummary(): Promise<{
        totalProjects: number;
        totalRevenue: number;
        avgProfitMargin: number;
        pendingApprovals: number;
        onTimeRate: number;
    }>;
    getProjectTrend(): Promise<any[]>;
    getProcurementPending(): Promise<{
        id: string;
        type: string;
        number: string;
        date: Date;
        status: string;
    }[]>;
}
