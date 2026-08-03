import { AnalyticsService } from './analytics.service';
import { GetAnalyticsQueryDto } from './dto/get-analytics.dto';
export declare class AnalyticsController {
    private readonly analyticsService;
    constructor(analyticsService: AnalyticsService);
    getDashboardAnalytics(query: GetAnalyticsQueryDto, req: any): Promise<{
        status: string;
        data: {
            period: import("./dto/get-analytics.dto").DashboardPeriod;
            kpi: {
                totalPipeline: number;
                winRate: number;
                avgDealSize: number;
                totalDeals: number;
                momGrowth: number;
            };
            trendLine: any[];
            sectorDistribution: any;
            funnel: {
                stage: string;
                count: number;
            }[];
            insights: {
                topInsight: string;
                warningInsight: string;
            };
        };
    }>;
}
