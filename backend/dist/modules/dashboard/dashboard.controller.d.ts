import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    getSummary(): Promise<{
        message: string;
        data: {
            totalProjects: number;
            totalRevenue: number;
            avgProfitMargin: number;
            pendingApprovals: number;
            onTimeRate: number;
        };
    }>;
    getProjectTrend(): Promise<{
        message: string;
        data: any[];
    }>;
    getProcurementPending(): Promise<{
        message: string;
        data: {
            id: string;
            type: string;
            number: string;
            date: Date;
            status: string;
        }[];
    }>;
}
